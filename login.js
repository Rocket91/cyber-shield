// ─── SUPABASE INIT ────────────────────────────────────────────
const { createClient } = supabase;
const SUPABASE_URL = 'https://bazgtcrhrifsxyrwzfpk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhemd0Y3Jocmlmc3h5cnd6ZnBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNjU4NjIsImV4cCI6MjA4OTk0MTg2Mn0.gkNA26aFphKbsN3x7UiqDYTUjuq0HNwmGZPTRiEDeX0';

// Default client (uses localStorage — persists across browser restarts)
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── SESSION PERSISTENCE CHECK ──────────────────────────────────────────
// Use getUser() (server-validated) to avoid ghost sessions from deleted accounts
(async () => {
  const qp = new URLSearchParams(window.location.search);
  const planParam = qp.get('plan');
  const tipoRaw  = qp.get('tipo');
  const billingMap = { monthly: 'mensual', quarterly: 'trimestral', annual: 'anual' };
  const tipoParam  = billingMap[tipoRaw] || tipoRaw || 'mensual';

  const { data: { user }, error } = await sb.auth.getUser();

  if (user && !error) {
    if (planParam === 'basico') {
      // Downgrade to free: delete paid subscription row and reset profile plan
      await sb.from('suscripciones').delete().eq('user_id', user.id);
      await sb.from('perfiles').upsert({ id: user.id, plan: 'basico' }, { onConflict: 'id' });
      localStorage.setItem('userPlan', 'basico');
    } else if (planParam) {
      // Upgrade/change to a paid plan — sync to Supabase first
      await syncPlanToSupabase(user.id, planParam, tipoParam);
      localStorage.setItem('userPlan', planParam);
    }
    window.location.replace('dashboard.html');
  } else {
    // Invalid or expired session — clear all stale local data
    await sb.auth.signOut({ scope: 'local' });
    localStorage.removeItem('userPlan');
    localStorage.removeItem('sb-remember-me');
    sessionStorage.removeItem('sb-bazgtcrhrifsxyrwzfpk-auth');

    // If a premium/inst plan was pre-selected, open the Register tab automatically
    if (planParam && planParam !== 'basico') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => switchTab('register'));
      } else {
        switchTab('register');
      }
    }

    // Handle Team Invitations Pre-fill
    const isInvited = qp.get('invitacion') === 'true';
    const invitedEmail = qp.get('email');
    if (invitedEmail) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => populateInvitedEmail(invitedEmail, isInvited));
      } else {
        populateInvitedEmail(invitedEmail, isInvited);
      }
    }
  }
})();

function populateInvitedEmail(email, isInvited) {
  const loginEmail = document.getElementById('login-email');
  const regEmail = document.getElementById('reg-email');
  if (loginEmail) loginEmail.value = email;
  if (regEmail) regEmail.value = email;
  
  if (isInvited) {
    switchTab('register');
    // Optionally lock it or show a message
    console.log('Invitación detectada para:', email);
  }
}

// ─── AUTO-LINK INVITATIONS ───────────────────────────────────────
sb.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
    const user = session?.user;
    if (user && user.email) {
      // Check for pending invitation that matches this email but isn't linked yet
      const { data: invitations, error } = await sb
        .from('miembros_equipo')
        .select('*')
        .eq('miembro_email', user.email)
        .eq('estado', 'pendiente')
        .is('miembro_user_id', null);

      if (invitations && invitations.length > 0) {
        console.log('Vinculando cuenta a organización institucional...');
        await sb.from('miembros_equipo')
          .update({ 
            miembro_user_id: user.id, 
            estado: 'activo' 
          })
          .eq('miembro_email', user.email);
        
        // After linking, we might want to refresh the profile plan if not already set
        // But the dashboard.js should handle the role check anyway
      }
    }
  }
});

// ─── PLAN FROM URL ─────────────────────────────────────────────────
const urlParams    = new URLSearchParams(window.location.search);
const selectedPlan = urlParams.get('plan') || 'basico';
const _bmap        = { monthly: 'mensual', quarterly: 'trimestral', annual: 'anual' };
const selectedTipo = _bmap[urlParams.get('tipo')] || urlParams.get('tipo') || 'mensual';

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

// ─── SYNC PLAN TO SUPABASE ────────────────────────────────────────
async function syncPlanToSupabase(userId, plan, tipoPago) {
  if (!userId || !plan || plan === 'basico') return; // basico is default

  const today = new Date().toISOString().split('T')[0];
  const vence = new Date();
  // Adjust expiry date based on billing cycle
  if (tipoPago === 'trimestral') vence.setMonth(vence.getMonth() + 3);
  else if (tipoPago === 'anual')  vence.setFullYear(vence.getFullYear() + 1);
  else                            vence.setMonth(vence.getMonth() + 1); // mensual

  const { error: subErr } = await sb.from('suscripciones').upsert({
    user_id: userId,
    plan,
    tipo_pago: tipoPago || 'mensual',
    fecha_inicio: today,
    fecha_vencimiento: vence.toISOString().split('T')[0],
    activo: true,
  }, { onConflict: 'user_id' });
  if (subErr) console.warn('Error sincronizando suscripción:', subErr.message);

  // Also update perfiles.plan so the sidebar/profile header reflect the plan
  const { error: perfilErr } = await sb.from('perfiles').upsert({
    id: userId,
    plan,
  }, { onConflict: 'id' });
  if (perfilErr) console.warn('Error actualizando plan en perfiles:', perfilErr.message);
}

// ─── LOGIN ───────────────────────────────────────────────────────────────
async function submitLogin() {
  const email     = document.getElementById('login-email').value.trim();
  const pass      = document.getElementById('login-pass').value;
  const rememberMe = document.getElementById('remember-me').checked;

  // Validación
  let valid = true;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  setError('login-email', 'err-login-email', !emailOk);
  if (!emailOk) valid = false;
  setError('login-pass', 'err-login-pass', !pass);
  if (!pass) valid = false;
  if (!valid) return;

  setLoading('btn-login', true);

  // If "Remember Me" is NOT checked, use a sessionStorage-backed client
  // so the session is cleared when the browser is closed.
  let authClient = sb;
  if (!rememberMe) {
    authClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        storage: sessionStorage,
        storageKey: 'sb-bazgtcrhrifsxyrwzfpk-auth',
        autoRefreshToken: true,
        persistSession: true,
      }
    });
  }

  const { error } = await authClient.auth.signInWithPassword({ email, password: pass });

  setLoading('btn-login', false);

  if (error) {
    showAlert('login-alert', 'error', error.message);
  } else {
    // Get session to obtain user id
    const { data: { session: loginSession } } = await authClient.auth.getSession();
    
    // Check if MFA is required
    const mfaLevel = await authClient.auth.mfa.getAuthenticatorAssuranceLevel();
    if (mfaLevel.data && mfaLevel.data.nextLevel === 'aal2' && mfaLevel.data.currentLevel !== 'aal2') {
        // MFA REQUIRED
        document.getElementById('panel-login').classList.add('hidden');
        document.getElementById('panel-register')?.classList.add('hidden');
        document.getElementById('panel-forgot')?.classList.add('hidden');
        document.getElementById('panel-mfa').classList.remove('hidden');
        return;
    }
    
    if (loginSession) {
      await syncPlanToSupabase(loginSession.user.id, selectedPlan, selectedTipo);
    }
    localStorage.setItem('userPlan', selectedPlan);
    localStorage.setItem('sb-remember-me', rememberMe ? '1' : '0');
    showAlert('login-alert', 'success', '¡Sesión iniciada! Redirigiendo…');
    setTimeout(() => window.location.href = 'dashboard.html', 1000);
  }
}

// ─── SUBMIT MFA ────────────────────────────────────────────────────────
async function submitMFA() {
  const code = document.getElementById('mfa-code').value.trim();
  if (!code || code.length !== 6) {
      showAlert('mfa-alert', 'error', 'Ingresa el código de 6 dígitos completo.');
      return;
  }
  
  setLoading('btn-mfa', true);
  
  const authClient = localStorage.getItem('sb-remember-me') !== '0'
    ? sb
    : createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { storage: sessionStorage, storageKey: 'sb-bazgtcrhrifsxyrwzfpk-auth', autoRefreshToken: true, persistSession: true }
      });
      
  const { data: factorsData, error: factorsError } = await authClient.auth.mfa.listFactors();
  
  if (factorsError) {
      setLoading('btn-mfa', false);
      showAlert('mfa-alert', 'error', 'Error leyendo verificación en dos pasos.');
      return;
  }
  
  const totpFactor = factorsData.totp.find(f => f.status === 'verified');
  if (!totpFactor) {
      setLoading('btn-mfa', false);
      showAlert('mfa-alert', 'error', 'No tienes autenticadores activos.');
      return;
  }
  
  const { data, error } = await authClient.auth.mfa.challengeAndVerify({
      factorId: totpFactor.id,
      code: code
  });
  
  setLoading('btn-mfa', false);
  
  if (error) {
      showAlert('mfa-alert', 'error', 'Código incorrecto o expirado.');
  } else {
      const { data: { session } } = await authClient.auth.getSession();
      if (session) {
         await syncPlanToSupabase(session.user.id, selectedPlan, selectedTipo);
      }
      localStorage.setItem('userPlan', selectedPlan);
      showAlert('mfa-alert', 'success', 'Código correcto. Iniciando sesión...');
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
    localStorage.setItem('userPlan', selectedPlan);
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      await syncPlanToSupabase(session.user.id, selectedPlan, selectedTipo);
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

// ─── TERMS CHECKBOX ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const termsCheck = document.getElementById('accept-terms');
  const btnRegister = document.getElementById('btn-register');
  if (termsCheck && btnRegister) {
    termsCheck.addEventListener('change', (e) => {
      btnRegister.disabled = !e.target.checked;
    });
  }
});
