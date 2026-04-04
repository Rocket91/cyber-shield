// ─── SUPABASE INIT ────────────────────────────────────────────
const { createClient } = supabase;
const SUPABASE_URL = 'https://bazgtcrhrifsxyrwzfpk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhemd0Y3Jocmlmc3h5cnd6ZnBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNjU4NjIsImV4cCI6MjA4OTk0MTg2Mn0.gkNA26aFphKbsN3x7UiqDYTUjuq0HNwmGZPTRiEDeX0';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── PROTECCIÓN DE SESIÓN ─────────────────────────────────────
(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) window.location.href = 'login.html';
})();

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
  url:    { icon: '🔗', placeholder: 'Pega una URL, ej: https://ejemplo.com' },
  ip:     { icon: '🌐', placeholder: 'Dirección IP, ej: 190.85.42.17' },
  hash:   { icon: '🧬', placeholder: 'Hash MD5/SHA256, ej: a1b2c3d4e5f6…' },
  pass:   { icon: '🔑', placeholder: 'Escribe tu contraseña para verificarla (no se almacena)' },
  domain: { icon: '📡', placeholder: 'Dominio o email, ej: empresa.com' },
  file:   { icon: '📁', placeholder: '' },
};
let currentTab = 'url';

function setTab(tab, btnEl) {
  currentTab = tab;
  // Update tab buttons
  if (btnEl) {
    document.querySelectorAll('.scan-tab').forEach(t => t.classList.remove('active'));
    btnEl.classList.add('active');
  } else {
    document.querySelectorAll('.scan-tab').forEach(t => {
      const onclick = t.getAttribute('onclick') || '';
      if (onclick.includes("'" + tab + "'")) t.classList.add('active');
      else t.classList.remove('active');
    });
  }
  // Show/hide inputs
  const textInput = document.getElementById('scan-text-input');
  const fileArea  = document.getElementById('file-upload-area');
  const result    = document.getElementById('scan-result');
  result.classList.remove('show');

  if (tab === 'file') {
    textInput.style.display = 'none';
    fileArea.style.display  = 'block';
  } else {
    textInput.style.display = 'block';
    fileArea.style.display  = 'none';
    const cfg = scanConfig[tab];
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
