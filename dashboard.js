// ─── SUPABASE INIT ────────────────────────────────────────────
const { createClient } = supabase;
const SUPABASE_URL = 'https://bazgtcrhrifsxyrwzfpk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhemd0Y3Jocmlmc3h5cnd6ZnBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNjU4NjIsImV4cCI6MjA4OTk0MTg2Mn0.gkNA26aFphKbsN3x7UiqDYTUjuq0HNwmGZPTRiEDeX0';

// Use the same storage that was chosen during login
const _rememberMe = localStorage.getItem('sb-remember-me') === '1';
const sb = _rememberMe
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { storage: sessionStorage, storageKey: 'sb-bazgtcrhrifsxyrwzfpk-auth', autoRefreshToken: true, persistSession: true }
  });

let userPlan = null;
let _currentUserId = null;

(async () => {
  const { data: { user }, error } = await sb.auth.getUser();
  if (!user || error) {
    await sb.auth.signOut({ scope: 'local' });
    localStorage.removeItem('userPlan');
    localStorage.removeItem('sb-remember-me');
    window.location.href = 'login.html';
    return;
  }
  _currentUserId = user.id;

  const [{ data: profile }, { data: sub }] = await Promise.all([
    sb.from('perfiles').select('nombre,apellido,plan').eq('id', user.id).maybeSingle(),
    sb.from('suscripciones')
      .select('plan,fecha_vencimiento')
      .eq('user_id', user.id)
      .eq('activo', true)
      .order('fecha_vencimiento', { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  const hoy = new Date();
  const subValida = sub && sub.plan && (!sub.fecha_vencimiento || new Date(sub.fecha_vencimiento) >= hoy);

  if (subValida) {
    userPlan = sub.plan;
  } else if (profile && profile.plan) {
    userPlan = profile.plan;
  } else {
    userPlan = 'basico';
  }
  localStorage.setItem('userPlan', userPlan);

  if (profile) {
    const fn = profile.nombre || '';
    const ln = profile.apellido || '';
    const initials = ((fn[0] || '') + (ln[0] || '')).toUpperCase() || '??';
    const fullName = `${fn} ${ln}`.trim();
    const nameEl = document.getElementById('sidebar-name');
    const avatarEl = document.getElementById('sidebar-avatar');
    const topbarAvatarEl = document.getElementById('topbar-avatar');
    if (nameEl) nameEl.textContent = fullName;
    if (avatarEl) avatarEl.textContent = initials;
    if (topbarAvatarEl) topbarAvatarEl.textContent = initials;
  }

  updateUIForPlan();
})();

function updateUIForPlan() {
  const plan = userPlan || 'basico';
  const topCardPlan = document.querySelector('.card-header .plan-chip');
  const statPlanActive = document.getElementById('stat-plan-active');

  let planText = 'Básico';
  let planColor = 'var(--slate-400)';
  if (plan === 'premium') { planText = 'Premium'; planColor = '#f59e0b'; }
  if (plan === 'institucional') { planText = 'Institucional'; planColor = '#10b981'; }

  const sidebarPlanEl = document.getElementById('sidebar-plan');
  if (sidebarPlanEl) { sidebarPlanEl.textContent = `✦ Plan ${planText}`; sidebarPlanEl.style.color = planColor; }
  if (topCardPlan) topCardPlan.innerHTML = `<span class="chip-dot" style="background:${planColor}"></span>Plan ${planText}`;
  if (statPlanActive) { statPlanActive.textContent = planText; statPlanActive.style.color = planColor; }

  const plans = ['basico', 'premium', 'institucional'];
  const maxIndex = plans.indexOf(plan);

  document.querySelectorAll('.nav-item[data-plan]').forEach(el => {
    el.style.display = plans.indexOf(el.getAttribute('data-plan')) <= maxIndex ? 'flex' : 'none';
  });
  document.querySelectorAll('.nav-group-label[data-plan-header]').forEach(el => {
    el.style.display = plans.indexOf(el.getAttribute('data-plan-header')) <= maxIndex ? 'block' : 'none';
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
    loadDashboardMetrics();
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
  dashboard: 'Dashboard <span>/ Resumen</span>',
  scan: 'Escanear <span>/ Motor de análisis</span>',
  history: 'Historial <span>/ Análisis recientes</span>',
  notifications: 'Alertas <span>/ Notificaciones</span>',
  reports: 'Reportes <span>/ Generación y exportación</span>',
};

async function navigate(viewId, navEl) {
  if (viewId === 'reports') {
    if (!_suscripcionVerificada) {
      await verificarSuscripcionYRenderizar();
    }
    if (_planActivo === 'basico' || _planActivo === null) {
      const mod = document.getElementById('reports-module');
      const blk = document.getElementById('reports-blocked');
      if (mod) mod.style.display = 'none';
      if (blk) blk.style.display = 'block';
    } else {
      const mod = document.getElementById('reports-module');
      const blk = document.getElementById('reports-blocked');
      if (mod) mod.style.display = 'block';
      if (blk) blk.style.display = 'none';
    }
  }

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + viewId).classList.add('active');

  if (navEl) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    navEl.classList.add('active');
  }

  if (Object.keys(titles).includes(viewId)) {
    document.getElementById('topbar-title').innerHTML = titles[viewId];
  }
}


// ─── SCAN TABS ────────────────────────────────────────────────
const scanConfig = {
  // Básicos
  file: { title: 'Analizar Archivo', icon: '📁', placeholder: 'Selecciona o arrastra un archivo...' },
  url: { title: 'Analizar URL', icon: '🔗', placeholder: 'Pega una URL, ej: https://ejemplo.com' },
  breach: { title: 'Brechas de Datos', icon: '🔓', placeholder: 'Introduce tu correo para verificar brechas...' },
  phishing: { title: 'Phishing / Malware', icon: '🛡', placeholder: 'Pega el dominio o URL sospechosos...' },
  pass: { title: 'Fortaleza Contraseña', icon: '🔑', placeholder: 'Escribe tu contraseña para verificarla (no se almacena)' },

  // Premium
  osint: { title: 'OSINT / Puertos', icon: '🌐', placeholder: 'Dirección IP para buscar puertos expuestos...' },
  domain: { title: 'Reputación Dominio', icon: '📡', placeholder: 'Dominio o email, ej: empresa.com' },
  phishtank: { title: 'Base de Phishing', icon: '🎣', placeholder: 'Introduce el dominio para comparar con la base...' },
  ssl: { title: 'Auditoría SSL/TLS', icon: '🔒', placeholder: 'Dominio a auditar...' },
  ip: { title: 'Reputación IP', icon: '📍', placeholder: 'Dirección IP, ej: 190.85.42.17' },

  // Institucional
  assets: { title: 'Exposición Activos', icon: '🕸', placeholder: 'Dominio de tu empresa...' },
  noise: { title: 'Inteligencia Ruido', icon: '🔬', placeholder: 'IP para filtrar escaneos benignos/maliciosos...' },
  dns: { title: 'Historial DNS', icon: '🗺', placeholder: 'Dominio a consultar...' },
  threat: { title: 'Threat Intelligence', icon: '🧬', placeholder: 'Asociar Hashes o IPs a grupos APT...' },
  custom: { title: 'Módulo Personal', icon: '🧩', placeholder: 'Acceso a configuraciones del módulo...' }
};
let currentTab = 'url';

function setTab(tab, btnEl) {
  currentTab = tab;

  // Show/hide inputs
  const textInput = document.getElementById('scan-text-input');
  const fileArea = document.getElementById('file-upload-area');
  const customArea = document.getElementById('custom-module-area');
  const result = document.getElementById('scan-result');
  result.classList.remove('show');

  const cfg = scanConfig[tab];

  // Update topbar title for specific tool
  document.getElementById('topbar-title').innerHTML = `${cfg.title} <span>/ Herramientas</span>`;

  if (tab === 'file') {
    textInput.style.display = 'none';
    if (customArea) customArea.style.display = 'none';
    fileArea.style.display = 'block';
  } else if (tab === 'custom') {
    textInput.style.display = 'none';
    fileArea.style.display = 'none';
    if (customArea) customArea.style.display = 'block';
  } else {
    textInput.style.display = 'block';
    fileArea.style.display = 'none';
    if (customArea) customArea.style.display = 'none';
    document.getElementById('scan-input-icon').textContent = cfg.icon;
    document.getElementById('scan-input').placeholder = cfg.placeholder;
    document.getElementById('scan-input').value = '';
  }
}

// ─── BACKEND API ──────────────────────────────────────────────
const API_BASE = 'http://localhost:8000';

async function getSupabaseToken() {
  const { data: { session } } = await sb.auth.getSession();
  return session?.access_token || null;
}

async function callScanAPI(endpoint, payload) {
  const token = await getSupabaseToken();
  if (!token) throw new Error('Sesión no válida. Por favor inicia sesión nuevamente.');

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let detail = 'Error en el servidor.';
    try { detail = (await response.json()).detail || detail; } catch (_) { }
    throw new Error(detail);
  }
  return response.json();
}

// ─── PASSWORD STRENGTH (client-side, sin API) ─────────────────
function analyzePasswordStrength(password) {
  const common = ['123456', 'password', '12345678', 'qwerty', 'abc123', '111111',
    'letmein', '123456789', 'welcome', 'monkey', 'dragon', 'master', 'password1'];

  if (common.includes(password.toLowerCase())) {
    return {
      status: 'danger',
      score: 5,
      label: 'Contraseña muy común',
      title: 'Contraseña extremadamente débil',
      explanation: 'Esta contraseña es una de las más usadas en el mundo y aparece en todas las listas de ataques de diccionario. Es prácticamente inútil como protección.',
      tips: [
        'Usa una frase larga con palabras aleatorias combinadas.',
        'Añade números, mayúsculas y símbolos (!@#$%) en posiciones no predecibles.',
        'Considera usar un gestor de contraseñas para crear claves únicas.',
      ],
      engines_alerted: 1,
      total_engines: 1,
    };
  }

  let score = 0;
  const checks = {
    length8: password.length >= 8,
    length12: password.length >= 12,
    length16: password.length >= 16,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    numbers: /[0-9]/.test(password),
    symbols: /[^a-zA-Z0-9]/.test(password),
  };
  if (checks.length8) score += 15;
  if (checks.length12) score += 20;
  if (checks.length16) score += 15;
  if (checks.uppercase) score += 10;
  if (checks.lowercase) score += 10;
  if (checks.numbers) score += 15;
  if (checks.symbols) score += 15;
  score = Math.min(100, score);

  let status, label, title, explanation;
  if (score < 30) {
    status = 'danger'; label = 'Débil';
    title = 'Contraseña débil — alto riesgo';
    explanation = `Tu contraseña tiene un puntaje de seguridad de ${score}/100. Es vulnerable a ataques de fuerza bruta en segundos.`;
  } else if (score < 60) {
    status = 'warning'; label = 'Regular';
    title = 'Contraseña regular — riesgo moderado';
    explanation = `Tu contraseña tiene un puntaje de ${score}/100. Podría ser descifrada en minutos u horas con herramientas comunes.`;
  } else if (score < 85) {
    status = 'warning'; label = 'Buena';
    title = 'Contraseña buena — riesgo bajo';
    explanation = `Tu contraseña tiene un puntaje de ${score}/100. Es resistente a ataques comunes, pero puede mejorarse.`;
  } else {
    status = 'clean'; label = 'Excelente';
    title = '¡Contraseña excelente!';
    explanation = `Tu contraseña tiene un puntaje de ${score}/100. Es altamente segura y muy difícil de descifrar.`;
  }

  const missing = [];
  if (!checks.length12) missing.push('al menos 12 caracteres');
  if (!checks.uppercase) missing.push('una letra mayúscula');
  if (!checks.numbers) missing.push('al menos un número');
  if (!checks.symbols) missing.push('un símbolo especial (!@#$%)');

  const tips = missing.length > 0
    ? [`Agrega: ${missing.join(', ')}.`,
      'Nunca uses la misma contraseña en dos servicios distintos.',
      'Considera usar un gestor de contraseñas como Bitwarden o 1Password.']
    : ['¡Excelente contraseña! Activa también el doble factor de autenticación.',
      'Rota tus contraseñas importantes cada 6 meses.',
      'Nunca compartas esta contraseña, ni siquiera con soporte técnico.'];

  return { status, score, label, title, explanation, tips, engines_alerted: 0, total_engines: 0 };
}

// ─── RENDER RESULT (función reutilizable) ─────────────────────
function renderScanResult(data, inputValue) {
  const resultBox = document.getElementById('scan-result');
  const loader = document.getElementById('result-loading');
  const content = document.getElementById('result-content');

  const statusMap = {
    clean: { cls: 'clean', tag: 'Limpio', icon: '✅', countCls: 'green' },
    warning: { cls: 'warning', tag: 'Sospechoso', icon: '⚠️', countCls: 'amber' },
    danger: { cls: 'danger', tag: 'Amenaza', icon: '🚨', countCls: 'red' },
  };
  const ui = statusMap[data.status] || statusMap.clean;

  resultBox.className = `scan-result show ${ui.cls}`;
  loader.style.display = 'none';
  content.style.display = 'flex';

  document.getElementById('result-icon').textContent = ui.icon;
  document.getElementById('result-status-tag').textContent = ui.tag;
  document.getElementById('result-title').textContent = data.title;
  document.getElementById('result-explanation').textContent = data.explanation;

  const enginesAlerted = data.engines_alerted ?? 0;
  const totalEngines = data.total_engines ?? 0;
  const countLabel = data.breach_count != null
    ? `${data.breach_count} brecha(s) encontrada(s)`
    : data.score != null
      ? `Puntaje de seguridad: ${data.score}/100`
      : totalEngines > 0
        ? `${enginesAlerted} de ${totalEngines} motores alertaron`
        : 'Análisis completado';

  document.getElementById('result-engines').innerHTML = `
    <div class="count ${ui.countCls}">${enginesAlerted || data.score || '0'}</div>
    <div class="label">${countLabel}</div>
  `;

  const tipsList = document.getElementById('result-tips-list');
  tipsList.innerHTML = (data.tips || []).map((tip, idx) => `
    <div class="tip-item">
      <div class="tip-dot">${idx + 1}</div>
      <div>${tip}</div>
    </div>
  `).join('');

  // Guardar en Supabase
  const typeMap = {
    url: 'url', breach: 'url', phishing: 'url', pass: 'contrasena',
    osint: 'ip', domain: 'url', phishtank: 'url', ssl: 'url', ip: 'ip', noise: 'ip',
    dns: 'url', threat: 'hash', file: 'archivo'
  };
  const herramientaMap = {
    url: 'VirusTotal', breach: 'LeakCheck', phishing: 'Google Safe Browsing',
    pass: 'Análisis local', osint: 'Shodan', ip: 'AbuseIPDB', file: 'VirusTotal',
  };
  const resultadoMap = { clean: 'limpio', warning: 'sospechoso', danger: 'peligroso' };
  saveAnalisis(
    typeMap[currentTab] || currentTab,
    resultadoMap[data.status] || 'limpio',
    inputValue,
    herramientaMap[currentTab] || currentTab,
  );
}

// ─── RUN SCAN (real) ──────────────────────────────────────────
async function runScan() {
  const input = document.getElementById('scan-input').value.trim();
  if (!input) return;

  const resultBox = document.getElementById('scan-result');
  const loader = document.getElementById('result-loading');
  const content = document.getElementById('result-content');

  // Fortaleza de Contraseña: 100% client-side
  if (currentTab === 'pass') {
    const pwResult = analyzePasswordStrength(input);
    resultBox.className = 'scan-result show loading';
    loader.style.display = 'flex';
    content.style.display = 'none';
    setTimeout(() => renderScanResult(pwResult, '(contraseña oculta)'), 600);
    return;
  }

  // Verificar que el backend esté activo antes de continuar
  resultBox.className = 'scan-result show loading';
  loader.style.display = 'flex';
  content.style.display = 'none';

  const endpointMap = {
    url: '/api/v1/scan/url',
    breach: '/api/v1/scan/breach',
    phishing: '/api/v1/scan/phishing',
    file: '/api/v1/scan/file',
    osint: '/api/v1/scan/osint',
    domain: '/api/v1/scan/domain',
    phishtank: '/api/v1/scan/phishtank',
    ssl: '/api/v1/scan/ssl',
    ip: '/api/v1/scan/ip',
    assets: '/api/v1/scan/assets',
    noise: '/api/v1/scan/noise',
    dns: '/api/v1/scan/dns',
    threat: '/api/v1/scan/threat',
  };
  const endpoint = endpointMap[currentTab];

  const _planAccess = {
    osint: 'premium', domain: 'premium', phishtank: 'premium', ssl: 'premium', ip: 'premium',
    assets: 'institucional', noise: 'institucional', dns: 'institucional', threat: 'institucional',
  };
  const plans = ['basico', 'premium', 'institucional'];
  const requiredPlan = _planAccess[currentTab];
  if (requiredPlan && plans.indexOf(userPlan || 'basico') < plans.indexOf(requiredPlan)) {
    const label = requiredPlan === 'premium' ? 'Premium' : 'Institucional';
    resultBox.className = 'scan-result';
    showToastInline(`Esta herramienta requiere plan ${label}`, 'error');
    return;
  }

  const payloadMap = {
    '/api/v1/scan/url': { url: input },
    '/api/v1/scan/breach': { email: input },
    '/api/v1/scan/phishing': { url: input },
    '/api/v1/scan/osint': { ip: input },
    '/api/v1/scan/domain': { domain: input },
    '/api/v1/scan/phishtank': { url: input },
    '/api/v1/scan/ssl': { domain: input },
    '/api/v1/scan/ip': { ip: input },
    '/api/v1/scan/assets': { domain: input },
    '/api/v1/scan/noise': { ip: input },
    '/api/v1/scan/dns': { domain: input },
    '/api/v1/scan/threat': { query: input },
  };

  try {
    const data = await callScanAPI(endpoint, payloadMap[endpoint]);
    renderScanResult(data, input);
  } catch (err) {
    resultBox.className = 'scan-result show warning';
    loader.style.display = 'none';
    content.style.display = 'flex';
    document.getElementById('result-icon').textContent = '⚙️';
    document.getElementById('result-status-tag').textContent = 'Error';
    document.getElementById('result-title').textContent = 'No se pudo conectar con el servidor';
    document.getElementById('result-explanation').textContent =
      `Asegúrate de que el backend FastAPI esté corriendo en localhost:8000. Detalle: ${err.message}`;
    document.getElementById('result-engines').innerHTML = '';
    document.getElementById('result-tips-list').innerHTML = `
      <div class="tip-item"><div class="tip-dot">1</div><div>Ejecuta: uvicorn api.main:app --reload --port 8000</div></div>
    `;
  }
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
  if (file) realFileScan(file);
}
function handleDrop(event) {
  event.preventDefault();
  document.getElementById('file-upload-area').classList.remove('dragover');
  const file = event.dataTransfer.files[0];
  if (file) realFileScan(file);
}

async function realFileScan(file) {
  navigate('scan', null);
  currentTab = 'file';

  const resultBox = document.getElementById('scan-result');
  const loader = document.getElementById('result-loading');
  const content = document.getElementById('result-content');

  resultBox.className = 'scan-result show loading';
  loader.style.display = 'flex';
  content.style.display = 'none';

  try {
    const token = await getSupabaseToken();
    if (!token) throw new Error('Sesión no válida.');

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/api/v1/scan/file`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });

    if (!response.ok) {
      let detail = 'Error en el servidor.';
      try { detail = (await response.json()).detail || detail; } catch (_) { }
      throw new Error(detail);
    }

    const data = await response.json();
    renderScanResult(data, file.name);

  } catch (err) {
    resultBox.className = 'scan-result show warning';
    loader.style.display = 'none';
    content.style.display = 'flex';
    document.getElementById('result-icon').textContent = '⚙️';
    document.getElementById('result-status-tag').textContent = 'Error';
    document.getElementById('result-title').textContent = 'No se pudo analizar el archivo';
    document.getElementById('result-explanation').textContent = `Detalle: ${err.message}`;
    document.getElementById('result-engines').innerHTML = '';
    document.getElementById('result-tips-list').innerHTML = `
      <div class="tip-item"><div class="tip-dot">1</div><div>Verifica que el backend esté corriendo en localhost:8000</div></div>
    `;
  }
}

// ─── HISTORY FILTERS ──────────────────────────────────────────
function applyHistoryFilters() {
  const typeF = document.getElementById('filter-type').value;
  const statusF = document.getElementById('filter-status').value;
  const dateF = document.getElementById('filter-date').value;

  const body = document.getElementById('history-table-body');
  const rows = body.querySelectorAll('tr[data-type]');
  const noRes = document.getElementById('history-no-results');

  let visibleCount = 0;

  rows.forEach(row => {
    const rType = row.getAttribute('data-type');
    const rStatus = row.getAttribute('data-status');
    const rDate = row.getAttribute('data-date');

    const matchType = (typeF === 'all' || typeF === rType);
    const matchStatus = (statusF === 'all' || statusF === rStatus);
    const matchDate = (dateF === 'all' || dateF === rDate);

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
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return 'ahora';
  if (diffMin < 60) return `hace ${diffMin} min`;
  if (diffHrs < 24) return `hace ${diffHrs}h`;
  if (diffDays === 1) return 'Ayer';
  return `hace ${diffDays} días`;
}

function renderAnalisisRow(a, includeDate = false) {
  const tipoIconMap = { url: '🔗', archivo: '📁', ip: '🌐', hash: '🧬', contrasena: '🔑', brecha: '🔓', phishing: '🛡️' };
  const tipoClassMap = { url: 'type-url', archivo: 'type-file', ip: 'type-ip', hash: 'type-hash', contrasena: 'type-hash', brecha: 'type-url', phishing: 'type-url' };
  const statusMap = {
    limpio: { cls: 'pill-clean', label: 'Limpio', dataSt: 'clean' },
    sospechoso: { cls: 'pill-warning', label: 'Sospechoso', dataSt: 'warning' },
    peligroso: { cls: 'pill-threat', label: 'Peligroso', dataSt: 'threat' },
  };
  const s = statusMap[a.resultado] || statusMap.limpio;
  const icon = tipoIconMap[a.tipo] || '📌';
  const iconClass = tipoClassMap[a.tipo] || 'type-url';
  const dateCol = includeDate
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
      <td><span class="target-text">${a.detalle?.length > 30 ? a.detalle.slice(0, 30) + '…' : (a.detalle || '-')}</span></td>
      <td style="font-size:0.75rem;color:var(--slate-400)">${a.herramienta || '-'}</td>
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

// ─── DASHBOARD METRICS & CHART ───────────────────────────────────
async function loadDashboardMetrics() {
  if (!_currentUserId || typeof sb === 'undefined') return;

  const { data, error } = await sb
    .from('analisis')
    .select('created_at, resultado, tipo')
    .eq('user_id', _currentUserId);

  if (error) {
    console.warn('Error cargando métricas:', error.message);
    return;
  }

  const now = new Date();
  const todayStr = now.toDateString();
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toDateString();

  // Last 7 days boundary
  const startOfWeek = new Date(now);
  startOfWeek.setDate(startOfWeek.getDate() - 6);
  startOfWeek.setHours(0, 0, 0, 0);

  let todayCount = 0;
  let yesterdayCount = 0;
  let threatsTotal = 0;
  let threatsThisWeek = 0;
  let cleanTotal = 0;
  let totalScans = data.length;

  // Chart data: indexes 0-6 represent Sunday(0) to Saturday(6)
  const weekData = {
    0: { count: 0, threats: 0 }, 1: { count: 0, threats: 0 },
    2: { count: 0, threats: 0 }, 3: { count: 0, threats: 0 },
    4: { count: 0, threats: 0 }, 5: { count: 0, threats: 0 },
    6: { count: 0, threats: 0 }
  };

  data.forEach(a => {
    const d = new Date(a.created_at);
    const dStr = d.toDateString();

    if (dStr === todayStr) todayCount++;
    if (dStr === yesterdayStr) yesterdayCount++;

    const isThreat = a.resultado === 'peligroso' || a.resultado === 'sospechoso';
    if (isThreat) threatsTotal++;
    else if (a.resultado === 'limpio') cleanTotal++;

    // Weekly chart grouping
    if (d >= startOfWeek) {
      if (isThreat) threatsThisWeek++;
      const dayIndex = d.getDay();
      weekData[dayIndex].count++;
      if (isThreat) weekData[dayIndex].threats++;
    }
  });

  // Calculate trends
  const todayTrend = yesterdayCount === 0
    ? (todayCount > 0 ? '+100%' : '0%')
    : ((todayCount - yesterdayCount) / yesterdayCount * 100).toFixed(0) + '%';
  const todayTrendCls = yesterdayCount === 0 && todayCount > 0 ? 'up' : (todayCount >= yesterdayCount ? 'up' : 'down');
  const todayTrendSymbol = todayCount >= yesterdayCount ? '↑' : '↓';

  const cleanRate = totalScans === 0 ? 0 : ((cleanTotal / totalScans) * 100).toFixed(1);

  // Update DOM
  const statAnalysisToday = document.getElementById('stat-analysis-today');
  const statAnalysisTrend = document.getElementById('stat-analysis-trend');
  if (statAnalysisToday) statAnalysisToday.textContent = todayCount;
  if (statAnalysisTrend) statAnalysisTrend.innerHTML = `<span class="${todayTrendCls}">${todayTrendSymbol} ${todayTrend}</span> vs ayer`;

  const statThreatsTotal = document.getElementById('stat-threats-total');
  const statThreatsTrend = document.getElementById('stat-threats-trend');
  if (statThreatsTotal) statThreatsTotal.textContent = threatsTotal;
  if (statThreatsTrend) {
    if (threatsThisWeek > 0) {
      statThreatsTrend.innerHTML = `<span class="down">↑ ${threatsThisWeek}</span> esta semana`;
    } else {
      statThreatsTrend.innerHTML = `<span class="up">↓ 0</span> esta semana`;
    }
  }

  const statCleanTotal = document.getElementById('stat-clean-total');
  const statCleanTrend = document.getElementById('stat-clean-trend');
  if (statCleanTotal) statCleanTotal.textContent = cleanTotal;
  if (statCleanTrend) statCleanTrend.innerHTML = `<span class="up">${cleanRate}%</span> tasa de seguridad`;

  updateWeeklyChart(weekData);
}

function updateWeeklyChart(weekData) {
  // Find max count to scale bars
  let maxCount = 0;
  for (let i = 0; i < 7; i++) {
    if (weekData[i].count > maxCount) maxCount = weekData[i].count;
  }

  // If no data this week, maxCount = 1 to avoid division by zero
  if (maxCount === 0) maxCount = 1;

  for (let i = 0; i < 7; i++) {
    const bar = document.getElementById(`chart-bar-${i}`);
    if (!bar) continue;

    const data = weekData[i];
    // Calculate height percentage (min 5% so it's visible if 0)
    const heightPercent = data.count === 0 ? 5 : (data.count / maxCount) * 100;
    bar.style.height = `${heightPercent}%`;

    // Apply threat class if there are any threats that day
    if (data.threats > 0) {
      bar.classList.add('threat');
    } else {
      bar.classList.remove('threat');
    }
  }
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
window.markAlertRead = async function (id) {
  if (typeof sb === 'undefined') return;
  const { error } = await sb.from('analisis').update({ leida: true }).eq('id', id);
  if (!error) loadAlerts();
}

window.markAllRead = async function () {
  if (!_currentUserId || typeof sb === 'undefined') return;
  const { error } = await sb
    .from('analisis')
    .update({ leida: true })
    .eq('user_id', _currentUserId)
    .in('resultado', ['peligroso', 'sospechoso']);
  if (!error) loadAlerts();
}

// ─── UTILS ──────────────────────────────────────────────────────────────
function logout() {
  sb.auth.signOut().then(() => {
    localStorage.removeItem('userPlan');
    localStorage.removeItem('sb-remember-me');
    localStorage.removeItem('sb-bazgtcrhrifsxyrwzfpk-auth');
    sessionStorage.removeItem('sb-bazgtcrhrifsxyrwzfpk-auth');
    window.location.href = 'login.html';
  });
}


// ─── ESTADO GLOBAL DE SUSCRIPCIÓN ────────────────────────────────────────────
let _suscripcionVerificada = false;
let _planActivo = null;
let _tipoPago = null;
let _diasRestantes = null;

const _TIPO_MAP = {
  urls: ['url'],
  archivos: ['archivo', 'hash'],
  ips: ['ip'],
  full: ['url', 'archivo', 'hash', 'ip', 'osint', 'dominio', 'ssl', 'phishing', 'brecha', 'contrasena']
};
let _reporteActualData = [];

// ─── BLOQUE A: AUTENTICACIÓN Y PLAN ──────────────────────────────────────────
async function verificarSuscripcionYRenderizar() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) { window.location.href = 'login.html'; return; }

  const { data: sub, error } = await sb
    .from('suscripciones')
    .select('plan,tipo_pago,activo,fecha_vencimiento')
    .eq('user_id', user.id)
    .eq('activo', true)
    .order('fecha_vencimiento', { ascending: false })
    .limit(1)
    .single();

  if (error || !sub) {
    showToastInline('No se pudo verificar tu suscripción', 'error');
    _bloquearModuloReportes();
    return;
  }

  const hoy = new Date();
  const vencido = sub.fecha_vencimiento && new Date(sub.fecha_vencimiento) < hoy;
  _planActivo = (!sub || vencido) ? 'basico' : sub.plan;
  _tipoPago = sub.tipo_pago ?? null;
  _diasRestantes = sub.fecha_vencimiento
    ? Math.ceil((new Date(sub.fecha_vencimiento) - hoy) / 86400000) : null;
  _suscripcionVerificada = true;

  if (_diasRestantes !== null && _diasRestantes <= 7) {
    _mostrarAlertaVencimiento(_diasRestantes);
  }

  if (_planActivo === 'basico') {
    _bloquearModuloReportes();
  } else {
    _habilitarModuloReportes();
  }
}

function _bloquearModuloReportes() {
  const mod = document.getElementById('reports-module');
  const blocked = document.getElementById('reports-blocked');
  if (mod) mod.style.display = 'none';
  if (blocked) blocked.style.display = 'block';
}

function _habilitarModuloReportes() {
  const mod = document.getElementById('reports-module');
  const blocked = document.getElementById('reports-blocked');
  if (mod) mod.style.display = 'block';
  if (blocked) blocked.style.display = 'none';
}

function _mostrarAlertaVencimiento(dias) {
  const container = document.getElementById('reports-module');
  if (!container) return;
  const existing = document.getElementById('alerta-vencimiento');
  if (existing) return;
  const alerta = document.createElement('div');
  alerta.id = 'alerta-vencimiento';
  alerta.style.cssText = 'background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:12px 16px;margin-bottom:16px;color:#92400e;font-weight:500;font-size:0.9rem;';
  alerta.textContent = `⚠️ Tu suscripción vence en ${dias} día${dias !== 1 ? 's' : ''}.`;
  container.prepend(alerta);
}

function checkAccessGlobal(plan) {
  const navReports = document.getElementById('nav-reports');
  if (navReports) navReports.style.display = (plan === 'institucional' || plan === 'profesional') ? 'flex' : 'none';
}

// ─── REPORTES: FUNCIONES UI ───────────────────────────────────────────────────
function openReportModal() {
  if (!_suscripcionVerificada) { verificarSuscripcionYRenderizar(); return; }
  if (_planActivo === 'basico') { showToastInline('Requiere plan Profesional o Institucional', 'error'); return; }
  document.getElementById('report-modal').classList.add('active');
}

function closeReportModal() {
  document.getElementById('report-modal').classList.remove('active');
}

function showToastInline(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = type === 'success' ? `✅ ${msg}` : `⚠️ ${msg}`;
  container.appendChild(t);
  setTimeout(() => { t.style.animation = 'fadeOut 0.3s ease forwards'; setTimeout(() => t.remove(), 300); }, 4000);
}

// ─── BLOQUE B: GENERAR REPORTE CON DATOS REALES ──────────────────────────────
async function generateReportSimulation() {
  if (!_suscripcionVerificada) {
    showToastInline('Verificando suscripción...', 'success');
    await verificarSuscripcionYRenderizar();
    if (!_suscripcionVerificada || _planActivo === 'basico') return;
  }

  const name = document.getElementById('report-name').value.trim();
  const typeKey = document.getElementById('report-type').value;
  const typeStr = document.getElementById('report-type').options[document.getElementById('report-type').selectedIndex].text;
  const from = document.getElementById('report-from').value;
  const to = document.getElementById('report-to').value;

  if (!name || !from || !to) { showToastInline('Todos los campos son obligatorios', 'error'); return; }

  const { data: { user } } = await sb.auth.getUser();
  if (!user) { showToastInline('Sesión no válida', 'error'); return; }

  const tipos = _TIPO_MAP[typeKey] || _TIPO_MAP.full;
  const { data, error } = await sb
    .from('analisis')
    .select('tipo,resultado,detalle,herramienta,created_at')
    .eq('user_id', user.id)
    .in('tipo', tipos)
    .gte('created_at', from + 'T04:00:00.000Z')
    .lte('created_at', to + 'T03:59:59.999Z')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) { showToastInline(`Error: ${error.message}`, 'error'); return; }

  _reporteActualData = data || [];
  closeReportModal();
  showToastInline('Reporte generado correctamente', 'success');

  const emptyState = document.getElementById('reports-empty-state');
  if (emptyState) emptyState.style.display = 'none';

  const dateStr = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  const tbody = document.getElementById('reports-table-body');
  const tr = document.createElement('tr');
  tr.dataset.reportData = JSON.stringify(_reporteActualData);
  tr.dataset.reportType = typeStr;
  tr.dataset.reportRange = `${from} al ${to}`;
  tr.dataset.reportDate = dateStr;
  tr.innerHTML = `
    <td style="font-weight:600;color:var(--slate-800)">${name}</td>
    <td>${typeStr}</td>
    <td style="font-size:0.85rem;color:var(--slate-500)">${from} al ${to}</td>
    <td style="font-size:0.85rem;color:var(--slate-500)">${dateStr}</td>
    <td style="font-size:0.85rem;color:var(--slate-500)">${data.length} registros</td>
    <td><div style="display:flex;gap:6px;">
      <button class="btn-secondary" style="padding:4px 10px;font-size:0.75rem;" onclick="abrirDetalleReporte(this)">Abrir</button>
      <button class="btn-secondary btn-pdf" style="padding:4px 10px;font-size:0.75rem;" onclick="descargarPdfReporte()">PDF</button>
      <button class="btn-secondary btn-print" style="padding:4px 10px;font-size:0.75rem;" onclick="imprimirReporte()">Imprimir</button>
    </div></td>`;
  tbody.prepend(tr);
}

function abrirDetalleReporte(btn) {
  const row = btn.closest('tr');
  const rows = JSON.parse(row.dataset.reportData || '[]');
  document.getElementById('detail-report-name').textContent = row.cells[0].textContent;
  document.getElementById('detail-report-type').textContent = row.dataset.reportType;
  document.getElementById('detail-report-range').textContent = row.dataset.reportRange;
  document.getElementById('detail-report-date').textContent = row.dataset.reportDate;

  const limpio = rows.filter(r => r.resultado === 'limpio').length;
  const sospechoso = rows.filter(r => r.resultado === 'sospechoso').length;
  const peligroso = rows.filter(r => r.resultado === 'peligroso').length;
  const ultimoDate = rows.length ? new Date(rows[0].created_at).toLocaleString('es-ES') : '—';

  const statsEl = document.getElementById('detail-report-stats');
  if (statsEl) statsEl.innerHTML = `
    <div style="padding:16px;background:var(--slate-50);border-radius:8px;border:1px solid var(--slate-200);">
      <div style="font-size:1.8rem;font-weight:800;color:var(--green-600)">${limpio}</div>
      <div style="font-size:0.82rem;color:var(--slate-500)">Limpios</div>
    </div>
    <div style="padding:16px;background:var(--slate-50);border-radius:8px;border:1px solid var(--slate-200);">
      <div style="font-size:1.8rem;font-weight:800;color:var(--amber-600)">${sospechoso}</div>
      <div style="font-size:0.82rem;color:var(--slate-500)">Sospechosos</div>
    </div>
    <div style="padding:16px;background:var(--slate-50);border-radius:8px;border:1px solid var(--slate-200);">
      <div style="font-size:1.8rem;font-weight:800;color:var(--red-600)">${peligroso}</div>
      <div style="font-size:0.82rem;color:var(--slate-500)">Peligrosos</div>
    </div>
    <div style="padding:16px;background:var(--slate-50);border-radius:8px;border:1px solid var(--slate-200);">
      <div style="font-size:1.1rem;font-weight:700;color:var(--slate-800)">${ultimoDate}</div>
      <div style="font-size:0.82rem;color:var(--slate-500)">Más reciente</div>
    </div>`;

  const tableBody = document.getElementById('detail-records-body');
  if (tableBody) {
    tableBody.innerHTML = !rows.length
      ? `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--slate-400)">Sin análisis en este período</td></tr>`
      : rows.map(r => `<tr>
          <td style="font-size:0.82rem;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.detalle || '—'}</td>
          <td><span style="font-size:0.75rem;font-weight:600;text-transform:uppercase;color:var(--slate-500)">${r.tipo}</span></td>
          <td><span style="font-size:0.75rem;font-weight:700;color:${r.resultado === 'limpio' ? 'var(--green-600)' : r.resultado === 'sospechoso' ? 'var(--amber-600)' : 'var(--red-600)'}">${r.resultado}</span></td>
          <td style="font-size:0.78rem;color:var(--slate-400)">${new Date(r.created_at).toLocaleDateString('es-ES')}</td>
        </tr>`).join('');
  }

  document.getElementById('reports-module').style.display = 'none';
  document.getElementById('report-detail-view').style.display = 'block';
}

function volverReportes() {
  document.getElementById('report-detail-view').style.display = 'none';
  document.getElementById('reports-module').style.display = 'block';
}

function imprimirReporte() { window.print(); }

function descargarPdfReporte() {
  const name = document.getElementById('detail-report-name').textContent;
  if (typeof window.jspdf !== 'undefined') {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text(`Reporte: ${name}`, 10, 10);
    _reporteActualData.forEach((r, i) => {
      doc.setFontSize(9);
      doc.text(`${r.tipo} | ${r.resultado} | ${r.detalle || ''} | ${new Date(r.created_at).toLocaleDateString('es-ES')}`, 10, 20 + i * 6);
    });
    doc.save(`CyberShield_${name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
  } else {
    window.print();
  }
}
