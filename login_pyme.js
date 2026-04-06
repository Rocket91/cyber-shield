// ─── SUPABASE INIT ────────────────────────────────────────────
const { createClient } = supabase;
const SUPABASE_URL = 'https://bazgtcrhrifsxyrwzfpk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhemd0Y3Jocmlmc3h5cnd6ZnBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNjU4NjIsImV4cCI6MjA4OTk0MTg2Mn0.gkNA26aFphKbsN3x7UiqDYTUjuq0HNwmGZPTRiEDeX0';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── PLAN MOCKING ─────────────────────────────────────────────
const urlParams = new URLSearchParams(window.location.search);
const selectedPlan = urlParams.get('plan') || 'basico';

// ─── TAB SWITCH ───────────────────────────────────────────────
function switchTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('panel-login').classList.toggle('hidden', !isLogin);
  document.getElementById('panel-register').classList.toggle('hidden', isLogin);
  document.getElementById('tab-login').classList.toggle('active', isLogin);
  document.getElementById('tab-register').classList.toggle('active', !isLogin);
}

// ─── TOGGLE PASSWORD ──────────────────────────────────────────
function togglePass(id, btn) {
  const inp = document.getElementById(id);
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  btn.textContent = show ? '🙈' : '👁';
}

// ─── PASSWORD STRENGTH ────────────────────────────────────────
const strengthLevels = [
  { label: 'Muy débil',  color: '#ef4444', w: '15%'  },
  { label: 'Débil',      color: '#f97316', w: '30%'  },
  { label: 'Regular',    color: '#f59e0b', w: '55%'  },
  { label: 'Buena',      color: '#22c55e', w: '75%'  },
  { label: 'Excelente',  color: '#16a34a', w: '100%' },
];
function checkStrength(val) {
  const wrap = document.getElementById('strength-wrap');
  if (!val) { wrap.classList.remove('show'); return; }
  wrap.classList.add('show');
  let score = 0;
  if (val.length >= 8)  score++;
  if (val.length >= 12) score++;
  if (/[A-Z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^a-zA-Z0-9]/.test(val)) score++;
  score = Math.max(1, score);
  const l = strengthLevels[score - 1];
  const fill = document.getElementById('strength-fill');
  fill.style.width      = l.w;
  fill.style.background = l.color;
  const lbl = document.getElementById('strength-label');
  lbl.textContent = l.label;
  lbl.style.color = l.color;
}

// ─── HELPERS ──────────────────────────────────────────────────
function setError(inputId, errId, show) {
  const inp = document.getElementById(inputId);
  const err = document.getElementById(errId);
  if (inp) inp.classList.toggle('error', show);
  if (err) err.classList.toggle('show', show);
}
function showAlert(id, type, msg) {
  const el = document.getElementById(id);
  if (el) {
    el.className = 'alert-box show ' + type;
    el.textContent = (type === 'success' ? '✓ ' : '⚠ ') + msg;
  }
}
function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (btn) btn.classList.toggle('loading', loading);
}

// ─── LOGIN ────────────────────────────────────────────────────
async function submitLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;

  // Validación
  let valid = true;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  setError('login-email', 'err-login-email', !emailOk);
  if (!emailOk) valid = false;
  setError('login-pass', 'err-login-pass', !pass);
  if (!pass) valid = false;
  if (!valid) return;

  setLoading('btn-login', true);

  const { error } = await sb.auth.signInWithPassword({ email, password: pass });

  setLoading('btn-login', false);

  if (error) {
    showAlert('login-alert', 'error', error.message);
  } else {
    // Simular el guardado del plan
    localStorage.setItem('userPlan', selectedPlan);
    showAlert('login-alert', 'success', '¡Sesión iniciada! Redirigiendo…');
    setTimeout(() => window.location.href = 'dashboard.html', 1000);
  }
}

// ─── REGISTER ─────────────────────────────────────────────────
async function submitRegister() {
  const name     = document.getElementById('reg-name').value.trim();
  const lastname = document.getElementById('reg-lastname').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const pass     = document.getElementById('reg-pass').value;
  const terms    = document.getElementById('accept-terms').checked;

  // Validación
  let valid = true;
  setError('reg-name',     'err-reg-name',     !name);
  setError('reg-lastname', 'err-reg-lastname',  !lastname);
  if (!name || !lastname) valid = false;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  setError('reg-email', 'err-reg-email', !emailOk);
  if (!emailOk) valid = false;
  setError('reg-pass', 'err-reg-pass', pass.length < 8);
  if (pass.length < 8) valid = false;
  if (!terms) { showAlert('register-alert', 'error', 'Debes aceptar los términos para continuar.'); return; }
  if (!valid) return;

  setLoading('btn-register', true);

  const { error } = await sb.auth.signUp({
    email,
    password: pass,
    options: {
      data: { nombre: name, apellido: lastname }
    }
  });

  setLoading('btn-register', false);

  if (error) {
    showAlert('register-alert', 'error', error.message);
  } else {
    // Simular el guardado del plan
    localStorage.setItem('userPlan', selectedPlan);
    // Si la confirmación está desactivada, hay sesión activa → ir al dashboard
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      showAlert('register-alert', 'success', '¡Cuenta creada! Redirigiendo…');
      setTimeout(() => window.location.href = 'dashboard.html', 800);
    } else {
      showAlert('register-alert', 'success', '¡Cuenta creada! Revisa tu correo para confirmar.');
    }
  }
}

// ─── SOCIAL LOGIN ─────────────────────────────────────────────
async function socialLogin(provider) {
  const { error } = await sb.auth.signInWithOAuth({
    provider: provider.toLowerCase(),
    options: { redirectTo: window.location.origin + '/dashboard.html' }
  });
  if (error) alert('Error con ' + provider + ': ' + error.message);
}

// ─── FORGOT PASSWORD ──────────────────────────────────────────
function showForgot(e) {
  if (e) e.preventDefault();
  const overlay = document.getElementById('forgot-overlay');
  if (overlay) overlay.style.display = 'flex';
}
function closeForgot() {
  const overlay = document.getElementById('forgot-overlay');
  if (overlay) overlay.style.display = 'none';
}
async function sendReset() {
  const email = document.getElementById('forgot-email').value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    alert('Introduce un correo válido.');
    return;
  }
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/login.html'
  });
  closeForgot();
  if (error) {
    showAlert('login-alert', 'error', error.message);
  } else {
    showAlert('login-alert', 'success', `Enlace de recuperación enviado a ${email}`);
  }
}

// ─── ENTER KEY ────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const loginPanel = document.getElementById('panel-login');
  if (!loginPanel) return;
  const loginHidden = loginPanel.classList.contains('hidden');
  if (!loginHidden) submitLogin(); else submitRegister();
});
