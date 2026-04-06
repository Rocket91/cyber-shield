// ─── SUPABASE INIT ────────────────────────────────────────────
const { createClient } = supabase;
const SUPABASE_URL = 'https://bazgtcrhrifsxyrwzfpk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhemd0Y3Jocmlmc3h5cnd6ZnBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNjU4NjIsImV4cCI6MjA4OTk0MTg2Mn0.gkNA26aFphKbsN3x7UiqDYTUjuq0HNwmGZPTRiEDeX0';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── PROTECCIÓN DE SESIÓN Y PLAN MOCKING ──────────────────────
const userPlan = localStorage.getItem('userPlan') || 'basico';

(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) window.location.href = 'login.html';
})();

// DYNAMIC UI RENDERING BASED ON PLAN
document.addEventListener('DOMContentLoaded', () => {
  const topCardPlan = document.querySelector('.card-header .plan-chip');
  const sidebarPlan = document.querySelector('.user-plan');
  
  let planText = 'Básico';
  let planColor = 'var(--green-400)';
  if (userPlan === 'premium') { planText = 'Premium'; planColor = '#f59e0b'; }
  if (userPlan === 'institucional') { planText = 'Institucional'; planColor = '#8b5cf6'; }
  
  if (sidebarPlan && topCardPlan) {
    sidebarPlan.innerHTML = `✦ Plan ${planText}`;
    sidebarPlan.style.color = planColor;
    topCardPlan.innerHTML = `<span class="chip-dot" style="background:${planColor}"></span>Plan ${planText}`;
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

function navigate(viewId, navEl) {
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
    cls: 'clean', icon: '✅',
    title: '¡Sin amenazas detectadas!',
    detail: 'El objetivo fue analizado por múltiples motores y no presenta indicadores de compromiso.',
    count: '0', countCls: 'green', countLabel: 'motores alertaron'
  },
  phishing: {
    cls: 'danger', icon: '🚨',
    title: 'Phishing detectado',
    detail: 'Este sitio ha sido identificado como página de suplantación de identidad. No lo visites.',
    count: '14', countCls: 'red', countLabel: 'motores lo bloquearon'
  },
  malware: {
    cls: 'danger', icon: '🦠',
    title: 'Malware identificado',
    detail: 'El archivo contiene código malicioso. Clasificado como troyano por múltiples motores.',
    count: '52', countCls: 'red', countLabel: 'de 70 motores'
  },
};

function runScan() {
  const input = document.getElementById('scan-input').value.trim();
  if (!input) return;

  const result  = document.getElementById('scan-result');
  const spinner = document.getElementById('result-spinner');
  const icon    = document.getElementById('result-icon');
  const title   = document.getElementById('result-title');
  const detail  = document.getElementById('result-detail');
  const engines = document.getElementById('result-engines');

  // Show loading
  result.className = 'scan-result show loading';
  spinner.style.display = 'block';
  icon.style.display    = 'none';
  engines.style.display = 'none';
  title.textContent  = 'Analizando…';
  detail.textContent = 'Consultando motores de análisis';

  setTimeout(() => {
    // Determine mock result
    let res;
    const low = input.toLowerCase();
    if (low.includes('malware') || low.includes('.exe') || low.includes('virus')) res = mockResults.malware;
    else if (low.includes('phish') || low.includes('login-') || low.includes('.xyz')) res = mockResults.phishing;
    else res = mockResults.clean;

    result.className = 'scan-result show ' + res.cls;
    spinner.style.display = 'none';
    icon.style.display    = 'block';
    icon.textContent      = res.icon;
    title.textContent     = res.title;
    detail.textContent    = res.detail;
    engines.style.display = 'block';
    engines.innerHTML = `<div class="count ${res.countCls}">${res.count}</div><div class="label">${res.countLabel}</div>`;
  }, 1800);
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
  const result  = document.getElementById('scan-result');
  const spinner = document.getElementById('result-spinner');
  const icon    = document.getElementById('result-icon');
  const title   = document.getElementById('result-title');
  const detail  = document.getElementById('result-detail');
  const engines = document.getElementById('result-engines');

  result.className   = 'scan-result show loading';
  spinner.style.display = 'block';
  icon.style.display    = 'none';
  engines.style.display = 'none';
  title.textContent  = `Analizando ${name}…`;
  detail.textContent = 'Subiendo y procesando archivo';

  setTimeout(() => {
    const res = name.includes('.exe') ? mockResults.malware : mockResults.clean;
    result.className      = 'scan-result show ' + res.cls;
    spinner.style.display = 'none';
    icon.style.display    = 'block';
    icon.textContent      = res.icon;
    title.textContent     = res.title;
    detail.textContent    = res.detail;
    engines.style.display = 'block';
    engines.innerHTML = `<div class="count ${res.countCls}">${res.count}</div><div class="label">${res.countLabel}</div>`;
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
