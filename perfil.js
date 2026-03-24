// ── TAB SWITCHING ──────────────────────────────────────────────
function switchTab(id, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.page-tab').forEach(b => b.classList.remove('active'));
  const targetPanel = document.getElementById('tab-' + id);
  if (targetPanel) {
    targetPanel.classList.add('active');
  }
  if (btn) {
    btn.classList.add('active');
  } else {
    document.querySelectorAll('.page-tab').forEach(b => {
      if (b.textContent.toLowerCase().includes(id.slice(0, 4))) {
        b.classList.add('active');
      }
    });
  }
}

// ── TOAST ──────────────────────────────────────────────────────
let toastTimer;
function showToast(icon, msg) {
  const t = document.getElementById('toast');
  const tIcon = document.getElementById('toast-icon');
  const tMsg = document.getElementById('toast-msg');
  if (t && tIcon && tMsg) {
    tIcon.textContent = icon;
    tMsg.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
  }
}

// ── MODAL ──────────────────────────────────────────────────────
const modalConfigs = {
  history:    { icon:'🗑', title:'¿Eliminar historial?',    desc:'Se eliminarán todos tus análisis y reportes. Esta acción es irreversible.',   confirm:'Sí, eliminar' },
  deactivate: { icon:'😴', title:'¿Desactivar tu cuenta?', desc:'Tu cuenta quedará en pausa. Podrás reactivarla iniciando sesión nuevamente.',  confirm:'Desactivar' },
  delete:     { icon:'💀', title:'¿Eliminar tu cuenta?',   desc:'Se eliminarán permanentemente todos tus datos, análisis e historial. Esta acción NO tiene vuelta atrás.', confirm:'Eliminar para siempre' },
};
let currentModal = null;

function openModal(type) {
  const cfg = modalConfigs[type];
  const mIcon = document.getElementById('modal-icon');
  const mTitle = document.getElementById('modal-title');
  const mDesc = document.getElementById('modal-desc');
  const mConfirm = document.getElementById('modal-confirm');
  const overlay = document.getElementById('modal-overlay');

  if (cfg && mIcon && mTitle && mDesc && mConfirm && overlay) {
    mIcon.textContent = cfg.icon;
    mTitle.textContent = cfg.title;
    mDesc.textContent = cfg.desc;
    mConfirm.textContent = cfg.confirm;
    overlay.classList.add('open');
    currentModal = type;
  }
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.classList.remove('open');
}

function confirmModal() {
  closeModal();
  const msgs = { history: '🗑 Historial eliminado', deactivate: '😴 Cuenta desactivada', delete: '👋 Cuenta eliminada' };
  showToast('✅', msgs[currentModal] || 'Acción completada');
}

// ── PASSWORD STRENGTH ──────────────────────────────────────────
function checkStrength(val) {
  const fill = document.getElementById('strength-fill');
  const label = document.getElementById('strength-label');
  if (!fill || !label) return;

  if (!val) {
    fill.style.width = '0%';
    label.textContent = 'Escribe una contraseña';
    return;
  }

  let score = 0;
  if (val.length >= 8) score++;
  if (val.length >= 12) score++;
  if (/[A-Z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;

  const levels = [
    { w: '20%', bg: 'var(--red-400)', lbl: 'Muy débil' },
    { w: '40%', bg: 'var(--amber-400)', lbl: 'Débil' },
    { w: '60%', bg: 'var(--amber-400)', lbl: 'Regular' },
    { w: '80%', bg: 'var(--blue-500)', lbl: 'Fuerte' },
    { w: '100%', bg: 'var(--green-500)', lbl: 'Muy fuerte ✓' },
  ];
  const lvl = levels[Math.min(score, 4)];
  fill.style.width = lvl.w;
  fill.style.background = lvl.bg;
  label.textContent = lvl.lbl;
}

// ── INIT ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Check for hash in URL to switch tab
  const hash = window.location.hash.replace('#', '');
  if (hash === 'settings') {
    switchTab('perfil');
  } else if (['perfil', 'suscripcion', 'seguridad', 'actividad'].includes(hash)) {
    switchTab(hash);
  }
});
