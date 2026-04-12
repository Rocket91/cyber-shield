// ─── SUPABASE INIT ────────────────────────────────────────────
const { createClient } = supabase;
const SUPABASE_URL = 'https://bazgtcrhrifsxyrwzfpk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhemd0Y3Jocmlmc3h5cnd6ZnBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNjU4NjIsImV4cCI6MjA4OTk0MTg2Mn0.gkNA26aFphKbsN3x7UiqDYTUjuq0HNwmGZPTRiEDeX0';

// Use the same storage that was chosen during login
const _rememberMe = localStorage.getItem('sb-remember-me') !== '0';
const sb = _rememberMe
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { storage: sessionStorage, storageKey: 'sb-bazgtcrhrifsxyrwzfpk-auth', autoRefreshToken: true, persistSession: true }
    });

// ─── PROTECCIÓN DE SESIÓN Y PLAN MOCKING ──────────────────────
let userPlan = localStorage.getItem('userPlan') || 'basico';
let _currentUserId = null;
let _teamInfo = null;

(async () => {
  const { data: { user }, error } = await sb.auth.getUser();
  if (!user || error) {
    // Stale/invalid session — clean up and redirect
    await sb.auth.signOut({ scope: 'local' });
    localStorage.removeItem('userPlan');
    localStorage.removeItem('sb-remember-me');
    window.location.href = 'login.html';
    return;
  }
  _currentUserId = user.id;

  // Check if user is part of an institutional team
  const { data: teamData } = await sb
    .from('miembros_equipo')
    .select('admin_user_id, perfiles:admin_user_id(nombre, apellido)')
    .eq('miembro_user_id', user.id)
    .eq('estado', 'activo')
    .maybeSingle();

  if (teamData) {
    userPlan = 'institucional';
    _teamInfo = teamData;
    // Update UI if already rendered
    updateUIForPlan();
  }
})();

function updateUIForPlan() {
  const topCardPlan = document.querySelector('.card-header .plan-chip');
  const sidebarPlan = document.getElementById('sidebar-plan');
  
  let planText = 'Básico';
  let planColor = 'var(--green-400)';
  if (userPlan === 'premium') { planText = 'Premium'; planColor = '#f59e0b'; }
  if (userPlan === 'institucional') { planText = 'Institucional'; planColor = '#10b981'; } // Distinctive emerald/purple
  
  if (sidebarPlan && topCardPlan) {
    sidebarPlan.innerHTML = `✦ Plan ${planText}`;
    sidebarPlan.style.color = planColor;
    topCardPlan.innerHTML = `<span class="chip-dot" style="background:${planColor}"></span>Plan ${planText}`;
  }

  // Show team badge if applicable
  const teamBadge = document.getElementById('team-badge');
  const teamNameEl = document.getElementById('team-name');
  if (_teamInfo && teamBadge && teamNameEl) {
    const admin = _teamInfo.perfiles;
    teamNameEl.textContent = admin ? `${admin.nombre || 'Empresa'}` : 'Institución';
    teamBadge.style.display = 'block';
  }

  // Show/Hide sidebar tools based on plan
  const plans = ['basico', 'premium', 'institucional'];
  const maxIndex = plans.indexOf(userPlan);

  document.querySelectorAll('.nav-item[data-plan]').forEach(el => {
    const itemPlan = el.getAttribute('data-plan');
    if (plans.indexOf(itemPlan) <= maxIndex) {
      el.style.display = 'flex';
    } else {
      el.style.display = 'none';
    }
  });

  document.querySelectorAll('.nav-group-label[data-plan-header]').forEach(el => {
    const itemPlan = el.getAttribute('data-plan-header');
    if (plans.indexOf(itemPlan) <= maxIndex) {
      el.style.display = 'block';
    } else {
      el.style.display = 'none';
    }
  });
}

// DYNAMIC UI RENDERING BASED ON PLAN
document.addEventListener('DOMContentLoaded', () => {
  updateUIForPlan();

  // Check for hash in URL to switch view
  const hash = window.location.hash.replace('#', '');
  if (hash && Object.keys(titles).includes(hash)) {
    // Find matching nav item to highlight
    let navEl = null;
    document.querySelectorAll('.nav-item').forEach(n => {
      const onclick = n.getAttribute('onclick');
      if (onclick && onclick.includes(`'${hash}'`)) navEl = n;
    });
    navigate(hash, navEl);
  }

  // Load real data from Supabase (delayed to let session init complete)
  setTimeout(() => {
    loadRecentActivity();
    loadHistoryFromDB();
    loadAlerts();
  }, 600);
});

// ─── CERRAR SESIÓN ────────────────────────────────────────────
async function logout() {
  await sb.auth.signOut();
  window.location.href = 'login.html';
}

// ─── SIDEBAR TOGGLE ───────────────────────────────────────────
const sidebar = document.getElementById('sidebar');
function toggleSidebar() {
  if (window.innerWidth <= 900) {
    sidebar.classList.toggle('show-mobile');
  } else {
    sidebar.classList.toggle('mini');
  }
}


// ─── NAVIGATION ───────────────────────────────────────────────
const titles = {
  dashboard:     'Dashboard <span>/ Resumen</span>',
  scan:          'Escanear <span>/ Motor de análisis</span>',
  history:       'Historial <span>/ Análisis recientes</span>',
  notifications: 'Alertas <span>/ Notificaciones</span>',
  reports:       'Reportes <span>/ Generación y exportación</span>',
};

async function navigate(viewId, navEl) {
  // ─── VERIFICACIÓN DE PLAN PARA REPORTES ───
  if (viewId === 'reports') {
    let uid = _currentUserId;
    if (!uid && typeof sb !== 'undefined') {
      const { data: { user } } = await sb.auth.getUser();
      if (user) uid = user.id;
    }
    if (uid && typeof sb !== 'undefined') {
      const { data: sub } = await sb
        .from('suscripciones')
        .select('plan')
        .eq('user_id', uid)
        .eq('activo', true)
        .maybeSingle();

      const isInst = sub && sub.plan === 'institucional';
      const mod = document.getElementById('reports-module');
      const blk = document.getElementById('reports-blocked');
      if (mod && blk) {
        mod.style.display = isInst ? 'block' : 'none';
        blk.style.display = isInst ? 'none' : 'block';
      }
    }
  }

  // Hide all views
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + viewId).classList.add('active');

  // Update nav highlight
  if (navEl) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    navEl.classList.add('active');
  }

  // Update topbar title
  if (Object.keys(titles).includes(viewId)) {
    document.getElementById('topbar-title').innerHTML = titles[viewId];
  }
}

// ─── SCAN TABS ────────────────────────────────────────────────
const scanConfig = {
  // Básicos
  file:     { title: 'Analizar Archivo', icon: '📁', placeholder: 'Selecciona o arrastra un archivo...' },
  url:      { title: 'Analizar URL', icon: '🔗', placeholder: 'Pega una URL, ej: https://ejemplo.com' },
  breach:   { title: 'Brechas de Datos', icon: '🔓', placeholder: 'Introduce tu correo para verificar brechas...' },
  phishing: { title: 'Phishing / Malware', icon: '🛡', placeholder: 'Pega el dominio o URL sospechosos...' },
  pass:     { title: 'Fortaleza Contraseña', icon: '🔑', placeholder: 'Escribe tu contraseña para verificarla (no se almacena)' },

  // Premium
  osint:    { title: 'OSINT / Puertos', icon: '🌐', placeholder: 'Dirección IP para buscar puertos expuestos...' },
  domain:   { title: 'Reputación Dominio', icon: '📡', placeholder: 'Dominio o email, ej: empresa.com' },
  phishtank:{ title: 'Base de Phishing', icon: '🎣', placeholder: 'Introduce el dominio para comparar con la base...' },
  ssl:      { title: 'Auditoría SSL/TLS', icon: '🔒', placeholder: 'Dominio a auditar...' },
  ip:       { title: 'Reputación IP', icon: '📍', placeholder: 'Dirección IP, ej: 190.85.42.17' },

  // Institucional
  assets:   { title: 'Exposición Activos', icon: '🕸', placeholder: 'Dominio de tu empresa...' },
  noise:    { title: 'Inteligencia Ruido', icon: '🔬', placeholder: 'IP para filtrar escaneos benignos/maliciosos...' },
  dns:      { title: 'Historial DNS', icon: '🗺', placeholder: 'Dominio a consultar...' },
  threat:   { title: 'Threat Intelligence', icon: '🧬', placeholder: 'Asociar Hashes o IPs a grupos APT...' },
  custom:   { title: 'Módulo Personal', icon: '🧩', placeholder: 'Acceso a configuraciones del módulo...' }
};
let currentTab = 'url';

function setTab(tab, btnEl) {
  currentTab = tab;
  
  // Show/hide inputs
  const textInput = document.getElementById('scan-text-input');
  const fileArea  = document.getElementById('file-upload-area');
  const customArea= document.getElementById('custom-module-area');
  const result    = document.getElementById('scan-result');
  result.classList.remove('show');

  const cfg = scanConfig[tab];

  // Update topbar title for specific tool
  document.getElementById('topbar-title').innerHTML = `${cfg.title} <span>/ Herramientas</span>`;

  if (tab === 'file') {
    textInput.style.display = 'none';
    if(customArea) customArea.style.display = 'none';
    fileArea.style.display  = 'block';
  } else if (tab === 'custom') {
    textInput.style.display = 'none';
    fileArea.style.display  = 'none';
    if(customArea) customArea.style.display = 'block';
  } else {
    textInput.style.display = 'block';
    fileArea.style.display  = 'none';
    if(customArea) customArea.style.display = 'none';
    document.getElementById('scan-input-icon').textContent = cfg.icon;
    document.getElementById('scan-input').placeholder = cfg.placeholder;
    document.getElementById('scan-input').value = '';
  }
}

// ─── SCAN SIMULATION ─────────────────────────────────────────
const mockResults = {
  clean: {
    cls: 'clean', tag: 'Limpio', icon: '✅',
    title: '¡Sin amenazas detectadas!',
    explanation: 'Este elemento ha sido analizado por múltiples motores de seguridad y no se han encontrado rastros de virus, estafas o contenido malicioso. Puedes interactuar con él con tranquilidad.',
    tips: [
      'Mantén tu navegador y sistema operativo siempre actualizados.',
      'No compartas tus contraseñas ni información sensible aunque el sitio sea seguro.',
      'Si recibes correos inesperados con este enlace, verifica siempre el remitente.'
    ],
    count: '0', countCls: 'green', countLabel: 'Motores alertaron'
  },
  phishing: {
    cls: 'danger', tag: 'Amenaza', icon: '🚨',
    title: 'Peligro: Phishing detectado',
    explanation: 'Este sitio web está diseñado para robar tus datos personales o contraseñas suplantando a otra entidad (como un banco o red social). El riesgo de robo de identidad es CRÍTICO.',
    tips: [
      'Cierra esta pestaña inmediatamente y no introduzcas ningún dato.',
      'Si ya introdujiste una contraseña, cámbiala de inmediato en el sitio oficial.',
      'Reporta el enlace para ayudar a proteger a otros usuarios.'
    ],
    count: '14', countCls: 'red', countLabel: 'Motores lo bloquearon'
  },
  malware: {
    cls: 'danger', tag: 'Amenaza', icon: '🦠',
    title: 'Peligro: Malware identificado',
    explanation: 'Este archivo contiene código malicioso que puede dañar tu equipo, espiar tu actividad o cifrar tus archivos. No se recomienda su descarga o ejecución bajo ninguna circunstancia.',
    tips: [
      'Elimina el archivo de inmediato si ya lo has descargado.',
      'Realiza un análisis completo con tu antivirus de confianza.',
      'Desconfía de archivos que prometen funciones gratuitas o "activadores".'
    ],
    count: '52', countCls: 'red', countLabel: 'Amenazas en 70 motores'
  },
  warning: {
    cls: 'warning', tag: 'Sospechoso', icon: '⚠️',
    title: 'Análisis sospechoso',
    explanation: 'Aunque no hay una amenaza confirmada al 100%, algunos motores detectaron comportamientos inusuales o reportes antiguos. Procede con mucha cautela.',
    tips: [
      'No descargues archivos si no confías plenamente en la fuente.',
      'Evita introducir tarjetas de crédito o datos bancarios en este sitio.',
      'Verifica si el dominio tiene errores ortográficos o es inusual.'
    ],
    count: '3', countCls: 'amber', countLabel: 'Alertas sospechosas'
  }
};

function runScan() {
  const input = document.getElementById('scan-input').value.trim();
  if (!input) return;

  const resultBox = document.getElementById('scan-result');
  const loader    = document.getElementById('result-loading');
  const content   = document.getElementById('result-content');

  // Reset and Show loading
  resultBox.className = 'scan-result show loading';
  loader.style.display = 'flex';
  content.style.display = 'none';

  setTimeout(() => {
    // Determine mock result
    let res;
    const low = input.toLowerCase();
    if (low.includes('malware') || low.includes('.exe') || low.includes('virus')) res = mockResults.malware;
    else if (low.includes('phish') || low.includes('login-') || low.includes('.xyz')) res = mockResults.phishing;
    else if (low.includes('admin') || low.includes('test') || low.includes('danger')) res = mockResults.warning;
    else res = mockResults.clean;

    // Populate UI
    resultBox.className = 'scan-result show ' + res.cls;
    loader.style.display = 'none';
    content.style.display = 'flex';

    document.getElementById('result-icon').textContent = res.icon;
    document.getElementById('result-status-tag').textContent = res.tag;
    document.getElementById('result-title').textContent = res.title;
    document.getElementById('result-explanation').textContent = res.explanation;
    document.getElementById('result-engines').innerHTML = `
      <div class="count ${res.countCls}">${res.count}</div>
      <div class="label">${res.countLabel}</div>
    `;

    // Tips
    const tipsList = document.getElementById('result-tips-list');
    tipsList.innerHTML = res.tips.map((tip, idx) => `
      <div class="tip-item">
        <div class="tip-dot">${idx + 1}</div>
        <div>${tip}</div>
      </div>
    `).join('');

    // ═══ Save to Supabase ═══════════════════════════════
    const typeMap = { url:'url', breach:'url', phishing:'url', osint:'ip', domain:'url', phishtank:'url', ssl:'url', ip:'ip', noise:'ip', dns:'url', threat:'hash' };
    const tipoScan = typeMap[currentTab] || currentTab;
    const resultadoMap = { clean: 'limpio', warning: 'sospechoso', danger: 'peligroso' };
    const herramientaMap = { url: 'URLScan + Google', breach: 'HIBP', phishing: 'Google Safe Browsing', osint: 'Shodan', ip: 'AbuseIPDB', hash: 'VirusTotal' };
    saveAnalisis(tipoScan, resultadoMap[res.cls] || 'limpio', input, herramientaMap[tipoScan] || currentTab);

  }, 1500);
}

// Allow Enter key
if (document.getElementById('scan-input')) {
  document.getElementById('scan-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') runScan();
  });
}

// ─── FILE HANDLERS ────────────────────────────────────────────
function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) simulateFileScan(file.name);
}
function handleDrop(event) {
  event.preventDefault();
  document.getElementById('file-upload-area').classList.remove('dragover');
  const file = event.dataTransfer.files[0];
  if (file) simulateFileScan(file.name);
}
function simulateFileScan(name) {
  navigate('scan', null);
  const resultBox = document.getElementById('scan-result');
  const loader    = document.getElementById('result-loading');
  const content   = document.getElementById('result-content');

  resultBox.className = 'scan-result show loading';
  loader.style.display = 'flex';
  content.style.display = 'none';

  setTimeout(() => {
    const res = name.includes('.exe') ? mockResults.malware : mockResults.clean;
    
    // Populate UI
    resultBox.className = 'scan-result show ' + res.cls;
    loader.style.display = 'none';
    content.style.display = 'flex';

    document.getElementById('result-icon').textContent = res.icon;
    document.getElementById('result-status-tag').textContent = res.tag;
    document.getElementById('result-title').textContent = res.title;
    document.getElementById('result-explanation').textContent = res.explanation;
    document.getElementById('result-engines').innerHTML = `
      <div class="count ${res.countCls}">${res.count}</div>
      <div class="label">${res.countLabel}</div>
    `;

    // Tips
    const tipsList = document.getElementById('result-tips-list');
    tipsList.innerHTML = res.tips.map((tip, idx) => `
      <div class="tip-item">
        <div class="tip-dot">${idx + 1}</div>
        <div>${tip}</div>
      </div>
    `).join('');

    // ═══ Save to Supabase ═══════════════════════════════
    const resultadoMap = { clean: 'limpio', warning: 'sospechoso', danger: 'peligroso' };
    saveAnalisis('archivo', resultadoMap[res.cls] || 'limpio', name, 'VirusTotal');

  }, 2200);
}

// ─── NOTIFICATIONS ────────────────────────────────────────────
function markAllRead() {
  document.querySelectorAll('.notif-item.unread').forEach(n => n.classList.remove('unread'));
  document.querySelectorAll('.unread-dot').forEach(d => d.remove());
  if (document.querySelector('.notif-count')) {
    document.querySelector('.notif-count').textContent = '0 nuevas';
  }
  if (document.querySelector('.icon-btn .badge-dot')) {
    document.querySelector('.icon-btn .badge-dot').style.display = 'none';
  }
  document.querySelectorAll('.nav-badge').forEach(b => b.remove());
}

// ─── MODAL FUNCTIONS ──────────────────────────────────────────
function openReportModal() {
  document.getElementById('report-modal').classList.add('active');
  // Set default dates
  const today = new Date().toISOString().split('T')[0];
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);
  
  document.getElementById('report-from').value = lastWeek.toISOString().split('T')[0];
  document.getElementById('report-to').value = today;
}

function closeReportModal() {
  document.getElementById('report-modal').classList.remove('active');
}

function generateReportSimulation() {
  const name = document.getElementById('report-name').value.trim();
  if (!name) {
    alert('Por favor, asigne un nombre al reporte.');
    return;
  }

  // Simulate process
  const btn = event.target;
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Generando...';

  setTimeout(() => {
    closeReportModal();
    alert(`✅ Reporte "${name}" generado con éxito. Se ha enviado una copia a su correo institucional.`);
    
    // Reset button
    btn.disabled = false;
    btn.textContent = originalText;
    // Clean inputs
    document.getElementById('report-name').value = '';
  }, 1500);
}

// ─── HISTORY FILTERS ──────────────────────────────────────────
function applyHistoryFilters() {
  const typeF   = document.getElementById('filter-type').value;
  const statusF = document.getElementById('filter-status').value;
  const dateF   = document.getElementById('filter-date').value;

  const body   = document.getElementById('history-table-body');
  const rows   = body.querySelectorAll('tr[data-type]'); 
  const noRes  = document.getElementById('history-no-results');
  
  let visibleCount = 0;

  rows.forEach(row => {
    const rType   = row.getAttribute('data-type');
    const rStatus = row.getAttribute('data-status');
    const rDate   = row.getAttribute('data-date');

    const matchType   = (typeF === 'all' || typeF === rType);
    const matchStatus = (statusF === 'all' || statusF === rStatus);
    const matchDate   = (dateF === 'all' || dateF === rDate);

    if (matchType && matchStatus && matchDate) {
      row.style.display = 'table-row';
      visibleCount++;
    } else {
      row.style.display = 'none';
    }
  });

  noRes.style.display = (visibleCount === 0) ? 'table-row' : 'none';
}

// ─── SUPABASE ANALISIS HELPERS ───────────────────────────────────
async function saveAnalisis(tipo, resultado, detalle, herramienta) {
  if (!_currentUserId) return; // user_id not loaded yet, skip silently
  const { error } = await sb.from('analisis').insert({
    user_id: _currentUserId,
    tipo,
    resultado,
    detalle,
    herramienta
  });
  if (error) console.warn('Error guardando análisis:', error.message);
  else {
    // Refresh both tables after saving
    loadRecentActivity();
    loadHistoryFromDB();
  }
}

function timeAgo(dateStr) {
  const diffMs  = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays= Math.floor(diffMs / 86400000);
  if (diffMin < 1)   return 'ahora';
  if (diffMin < 60)  return `hace ${diffMin} min`;
  if (diffHrs < 24)  return `hace ${diffHrs}h`;
  if (diffDays === 1) return 'Ayer';
  return `hace ${diffDays} días`;
}

function renderAnalisisRow(a, includeDate = false) {
  const tipoIconMap  = { url:'🔗', archivo:'📁', ip:'🌐', hash:'🧬', contrasena:'🔑', brecha:'🔓', phishing:'🛡️' };
  const tipoClassMap = { url:'type-url', archivo:'type-file', ip:'type-ip', hash:'type-hash', contrasena:'type-hash', brecha:'type-url', phishing:'type-url' };
  const statusMap    = {
    limpio:     { cls:'pill-clean',   label:'Limpio',     dataSt:'clean' },
    sospechoso: { cls:'pill-warning', label:'Sospechoso', dataSt:'warning' },
    peligroso:  { cls:'pill-threat',  label:'Peligroso',  dataSt:'threat' },
  };
  const s = statusMap[a.resultado] || statusMap.limpio;
  const icon      = tipoIconMap[a.tipo]  || '📌';
  const iconClass = tipoClassMap[a.tipo] || 'type-url';
  const dateCol   = includeDate
    ? `<td style="font-size:0.75rem;color:var(--slate-400)">${timeAgo(a.created_at)}</td>`
    : `<td style="font-size:0.75rem;color:var(--slate-400)">${timeAgo(a.created_at)}</td>`;

  // Date category for history filters
  const d = new Date(a.created_at);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const diffDays = Math.floor((now - d) / 86400000);
  const dateData = sameDay ? 'today' : diffDays === 1 ? 'yesterday' : 'month';

  return `
    <tr data-type="${a.tipo}" data-status="${s.dataSt}" data-date="${dateData}">
      <td><span class="type-icon ${iconClass}">${icon}</span></td>
      <td><span class="target-text">${a.detalle?.length > 30 ? a.detalle.slice(0,30)+'…' : (a.detalle||'-')}</span></td>
      <td style="font-size:0.75rem;color:var(--slate-400)">${a.herramienta||'-'}</td>
      <td><span class="status-pill ${s.cls}"><span class="status-dot"></span>${s.label}</span></td>
      ${dateCol}
    </tr>
  `;
}

async function loadRecentActivity() {
  const tbody = document.getElementById('recent-activity-body');
  if (!tbody || !_currentUserId) return;

  const { data, error } = await sb
    .from('analisis')
    .select('*')
    .eq('user_id', _currentUserId)
    .order('created_at', { ascending: false })
    .limit(6);

  if (error) { console.warn('Error cargando actividad reciente:', error.message); return; }

  if (!data || data.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="5" style="text-align:center;padding:28px;color:var(--slate-400);font-size:0.83rem">
        <div style="font-size:1.5rem;margin-bottom:6px">🔍</div>
        Aún no tienes análisis. ¡Comienza escaneando una URL o archivo!</td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(a => renderAnalisisRow(a)).join('');
}

async function loadHistoryFromDB() {
  const tbody = document.getElementById('history-table-body');
  if (!tbody || !_currentUserId) return;

  const { data, error } = await sb
    .from('analisis')
    .select('*')
    .eq('user_id', _currentUserId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) { console.warn('Error cargando historial:', error.message); return; }

  if (!data || data.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="6" style="text-align:center;padding:40px;color:var(--slate-400);">
        <div style="font-size:2rem;margin-bottom:10px">🔍</div>
        No tienes análisis en el historial todavía.</td></tr>`;
    return;
  }
  // Keep the no-results row in place for filters
  const rows = data.map(a => renderAnalisisRow(a, true)).join('');
  tbody.innerHTML = rows + `
    <tr id="history-no-results" style="display:none">
      <td colspan="6" style="text-align:center;padding:40px;color:var(--slate-400);">
        <div style="font-size:2rem;margin-bottom:10px">🔍</div>
        No se encontraron análisis con los filtros seleccionados.
      </td>
    </tr>`;
}

// ─── ALERTAS Y NOTIFICACIONES ─────────────────────────────────
async function loadAlerts() {
  if (!_currentUserId || typeof sb === 'undefined') return;

  const { data, error } = await sb
    .from('analisis')
    .select('*')
    .eq('user_id', _currentUserId)
    .in('resultado', ['peligroso', 'sospechoso'])
    .order('created_at', { ascending: false });

  if (error) { console.warn('Error cargando alertas:', error); return; }

  const dashboardList = document.getElementById('dashboard-alerts-list');
  const notifList = document.getElementById('notif-list');
  const bellDot = document.getElementById('header-bell-dot');
  const notifCount = document.getElementById('notif-count-text');
  const sidebarBadge = document.getElementById('sidebar-alerts-badge');

  if (!data || data.length === 0) {
    const emptyMsg = `
      <div style="text-align:center; padding: 40px 20px; color: var(--slate-400);">
        <div style="font-size:2rem; margin-bottom:10px">✅</div>
        No tienes alertas de seguridad pendientes. ¡Todo en orden!
      </div>`;
    if (dashboardList) dashboardList.innerHTML = emptyMsg;
    if (notifList) notifList.innerHTML = emptyMsg;
    if (bellDot) bellDot.style.display = 'none';
    if (notifCount) notifCount.textContent = '0 nuevas';
    if (sidebarBadge) sidebarBadge.style.display = 'none';
    return;
  }

  let unreadCount = 0;
  let dashboardHtml = '';
  let notifHtml = '';

  data.forEach((alert, i) => {
    if (!alert.leida) unreadCount++;

    const isCritical = alert.resultado === 'peligroso';
    const icon = isCritical ? '🚨' : '⚠️';
    const cls = isCritical ? 'critical' : 'warning';
    const naCls = isCritical ? 'na-red' : 'na-amber';
    
    // Description in human terms
    let desc = `El objetivo analizado presenta indicadores de riesgo.`;
    if (alert.resultado === 'peligroso') {
        if (alert.tipo === 'url' || alert.tipo === 'dominio' || alert.tipo === 'phishing') desc = 'El enlace analizado fue detectado como un posible sitio malicioso o de phishing. Evita interactuar con él.';
        else if (alert.tipo === 'archivo') desc = 'El archivo analizado contiene código malicioso o malware. No lo ejecutes bajo ninguna circunstancia.';
        else if (alert.tipo === 'ip') desc = 'Esta dirección IP está reportada en listas negras de ciberataques. Se recomienda bloquearla.';
    } else {
        desc = `Se encontraron comportamientos inusuales en este análisis. Procede con precaución.`;
        if (alert.tipo === 'url' || alert.tipo === 'dominio' || alert.tipo === 'phishing') desc = 'Este sitio no es seguro o tiene reportes recientes de comportamiento sospechoso.';
        else if (alert.tipo === 'archivo') desc = 'Algunos motores marcaron este archivo como sospechoso, aunque no hay consenso. Actúa con cautela.';
    }

    const timeStr = new Date(alert.created_at).toLocaleString('es-DO', { 
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });

    const isUnread = !alert.leida ? 'unread' : '';

    // Dashboard preview item (limit to max 3)
    if (i < 3) {
      dashboardHtml += `
        <div class="alert-item ${cls}">
          <span class="alert-icon">${icon}</span>
          <div class="alert-content">
            <div class="alert-title">${isCritical ? 'Amenaza detectada' : 'Alerta sospechosa'}: ${alert.detalle || 'Objetivo'}</div>
            <div class="alert-desc">${desc}</div>
            <div class="alert-time">${timeStr}</div>
          </div>
          ${!alert.leida ? `<button class="alert-dismiss" onclick="markAlertRead('${alert.id}')" title="Marcar leída">✓</button>` : ''}
        </div>
      `;
    }

    // Full notifications list item
    notifHtml += `
      <div class="notif-item ${isUnread}">
        <div class="notif-avatar ${naCls}">${icon}</div>
        <div class="notif-body">
          <div class="notif-title">${isCritical ? 'Amenaza Crítica' : 'Alerta de Seguridad'} — ${alert.detalle || 'Objetivo'}</div>
          <div class="notif-desc">${desc}</div>
          <div class="notif-time">${timeStr}</div>
        </div>
        ${!alert.leida ? '<div class="unread-dot"></div>' : ''}
        ${!alert.leida ? `<button style="background:none;border:none;color:var(--slate-400);cursor:pointer;padding:10px;font-size:1.2rem;font-weight:bold" onclick="markAlertRead('${alert.id}')" title="Marcar como leída">✓</button>` : ''}
      </div>
    `;
  });

  if (dashboardList) dashboardList.innerHTML = dashboardHtml || `<div style="text-align:center; padding: 20px; color: var(--slate-400);">No hay alertas recientes para mostrar.</div>`;
  if (notifList) notifList.innerHTML = notifHtml;

  // Update counters
  if (bellDot) bellDot.style.display = unreadCount > 0 ? 'block' : 'none';
  if (notifCount) notifCount.textContent = `${unreadCount} nuevas`;
  if (sidebarBadge) {
      if (unreadCount > 0) {
          sidebarBadge.style.display = '';
          sidebarBadge.textContent = unreadCount;
      } else {
          sidebarBadge.style.display = 'none';
      }
  }
}

// Ensure markAlertRead is attached to window in case of module scoping
window.markAlertRead = async function(id) {
  if (typeof sb === 'undefined') return;
  const { error } = await sb.from('analisis').update({ leida: true }).eq('id', id);
  if (!error) loadAlerts();
}

window.markAllRead = async function() {
  if (!_currentUserId || typeof sb === 'undefined') return;
  const { error } = await sb
    .from('analisis')
    .update({ leida: true })
    .eq('user_id', _currentUserId)
    .in('resultado', ['peligroso', 'sospechoso']);
  if (!error) loadAlerts();
}
