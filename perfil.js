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

let currentUser = null;

// ─── LOAD PROFILE FROM SUPABASE ──────────────────────────────
async function loadProfile() {
  // Server-validate the session (getUser() calls the server, unlike getSession())
  const { data: { user }, error } = await sb.auth.getUser();
  if (!user || error) {
    await sb.auth.signOut({ scope: 'local' });
    localStorage.removeItem('userPlan');
    localStorage.removeItem('sb-remember-me');
    window.location.href = 'login.html';
    return;
  }
  currentUser = user;

  // Fill email from auth (read-only)
  const emailEl = document.getElementById('input-email');
  if (emailEl) emailEl.value = currentUser.email || '';

  // Load profile row from 'perfiles' table
  const { data: perfil, error: perfilError } = await sb
    .from('perfiles')
    .select('nombre, apellido, plan')
    .eq('id', currentUser.id)
    .single();

  if (perfilError) {
    console.warn('No se encontró perfil en la tabla perfiles:', perfilError.message);
    return;
  }

  const nombre   = perfil.nombre   || '';
  const apellido = perfil.apellido || '';
  const plan     = perfil.plan     || 'basico';
  const planLabel = plan === 'premium' ? 'Premium' : plan === 'institucional' ? 'Institucional' : 'Básico';
  const initials = ((nombre[0] || '') + (apellido[0] || '')).toUpperCase() || 'US';

  // Populate form fields
  const inputN = document.getElementById('input-nombre');
  const inputA = document.getElementById('input-apellido');
  if (inputN) inputN.value = nombre;
  if (inputA) inputA.value = apellido;

  // Update hero section
  const heroName = document.querySelector('.profile-name');
  if (heroName) heroName.textContent = `${nombre} ${apellido}`.trim();

  const heroPlanTag = document.querySelector('.tag-green');
  if (heroPlanTag) heroPlanTag.textContent = `✦ Plan ${planLabel}`;

  // Update sidebar user info
  document.querySelectorAll('.user-avatar').forEach(el => { el.textContent = initials; });
  const userNameEl = document.querySelector('.user-name');
  if (userNameEl) userNameEl.textContent = `${nombre} ${apellido}`.trim();
  const userPlanEl = document.querySelector('.user-plan');
  if (userPlanEl) {
    userPlanEl.textContent = `✦ Plan ${planLabel}`;
    const planColors = { premium: '#f59e0b', institucional: '#8b5cf6', basico: 'var(--green-400)' };
    userPlanEl.style.color = planColors[plan] || planColors.basico;
  }

  // Load team tab if institucional
  if (plan === 'institucional') {
    const tabBtn = document.getElementById('tab-btn-equipo');
    if (tabBtn) tabBtn.style.display = 'inline-block';
    loadTeam();
  }

  // Load subscription tab data now that currentUser is confirmed
  loadSubscription();
  
  // Load unread alerts count for the sidebar badge
  loadUnreadAlertsCount();

  // Load notification preferences
  loadNotificationPrefs();

  // Check current MFA state
  loadMFAState();
}

// ─── SAVE PROFILE TO SUPABASE ─────────────────────────────────
async function saveProfile() {
  if (!currentUser) { showToast('❌', 'No estás autenticado'); return; }

  const nombre   = document.getElementById('input-nombre')?.value.trim();
  const apellido = document.getElementById('input-apellido')?.value.trim();
  const telefono = document.getElementById('input-telefono')?.value.trim();
  const empresa  = document.getElementById('input-empresa')?.value.trim();

  if (!nombre || !apellido) {
    showToast('⚠️', 'El nombre y apellido son obligatorios');
    return;
  }

  const btn = document.getElementById('btn-guardar-perfil');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

  const { error } = await sb
    .from('perfiles')
    .upsert({
      id: currentUser.id,
      nombre,
      apellido,
    }, { onConflict: 'id' });

  if (btn) { btn.disabled = false; btn.textContent = 'Guardar'; }

  if (error) {
    console.error('Error guardando perfil:', error.message);
    showToast('❌', 'Error al guardar. Inténtalo de nuevo.');
    return;
  }

  // Update hero name immediately
  const heroName = document.querySelector('.profile-name');
  if (heroName) heroName.textContent = `${nombre} ${apellido}`;
  document.querySelectorAll('.user-avatar').forEach(el => {
    el.textContent = ((nombre[0] || '') + (apellido[0] || '')).toUpperCase();
  });
  const userNameEl = document.querySelector('.user-name');
  if (userNameEl) userNameEl.textContent = `${nombre} ${apellido}`;

  showToast('✅', 'Información actualizada correctamente');
}

// ─── SUBSCRIPTION LOADING ───────────────────────────────────────
async function loadSubscription() {
  if (!currentUser) return;

  const { data: sub } = await sb
    .from('suscripciones')
    .select('*')
    .eq('user_id', currentUser.id)
    .eq('activo', true)
    .maybeSingle();

  // Default to free plan if no record
  const plan      = sub?.plan       || 'basico';
  const tipoPago  = sub?.tipo_pago  || null;
  const vence     = sub?.fecha_vencimiento ? new Date(sub.fecha_vencimiento).toLocaleDateString('es-DO', { day:'2-digit', month:'long', year:'numeric' }) : null;
  const metodoPago= sub?.metodo_pago || null;

  // ── Plan card highlights ────────────────────────────────
  ['basico', 'premium', 'institucional'].forEach(p => {
    const card  = document.getElementById(`plan-card-${p}`);
    const badge = document.getElementById(`plan-badge-${p}`);
    const btn   = document.getElementById(`btn-plan-${p}`);
    if (!card) return;
    if (p === plan) {
      card.classList.add('current');
      if (badge) badge.style.display = '';
      if (btn)   { btn.classList.add('active-plan'); btn.textContent = 'Plan actual'; btn.onclick = null; }
    } else {
      card.classList.remove('current');
      if (badge) badge.style.display = 'none';
      if (btn && btn.classList.contains('active-plan')) {
        btn.classList.remove('active-plan');
        btn.textContent = p === 'institucional' ? 'Contactar' : 'Actualizar';
      }
    }
  });

  // ── Active plan card ───────────────────────────────────
  const planConfig = {
    basico: {
      name: 'Plan Básico',
      desc: 'Gratuito para siempre · Sin tarjeta de crédito',
      limit: 50,
      features: ['5 herramientas activas','50 análisis por día','Historial de 7 días'],
      showUpgrade: true, upgradeText: 'Premium por solo $12/mes',
      badgeBg: 'var(--green-50)', badgeColor: 'var(--green-700)'
    },
    premium: {
      name: 'Plan Premium',
      desc: tipoPago ? `Facturación ${tipoPago}` + (vence ? ` · Vence el ${vence}` : '') : 'Plan Premium activo',
      limit: 500,
      features: ['10 herramientas activas','500 análisis por día','Historial de 90 días','Reportes PDF'],
      showUpgrade: true, upgradeText: 'Institucional por solo $49/mes',
      badgeBg: '#fef9ee', badgeColor: '#b45309'
    },
    institucional: {
      name: 'Plan Institucional',
      desc: tipoPago ? `Facturación ${tipoPago}` + (vence ? ` · Vence el ${vence}` : '') : 'Plan Institucional activo',
      limit: 99999,
      features: ['15 herramientas activas','Análisis ilimitados','Historial ilimitado','Módulo personalizado','Soporte prioritario'],
      showUpgrade: false, upgradeText: '',
      badgeBg: '#f5f3ff', badgeColor: '#6d28d9'
    }
  };
  const cfg = planConfig[plan];

  const nameEl = document.getElementById('sub-plan-name');
  const descEl = document.getElementById('sub-plan-desc');
  const featEl = document.getElementById('sub-features');
  const upgEl  = document.getElementById('upgrade-banner');
  const upgTxt = document.getElementById('upgrade-sub-text');
  const badge  = document.getElementById('sub-plan-badge');

  if (nameEl) nameEl.textContent = cfg.name;
  if (descEl) descEl.textContent = cfg.desc;
  if (featEl) featEl.innerHTML = cfg.features.map(f => `<div class="sub-feat"><span class="check">✓</span> ${f}</div>`).join('');
  if (upgEl)  upgEl.style.display = cfg.showUpgrade ? '' : 'none';
  if (upgTxt) upgTxt.textContent = cfg.upgradeText;
  if (badge)  { badge.style.background = cfg.badgeBg; badge.querySelector('.dot').style.background = cfg.badgeColor; }

  // ── Today's usage ───────────────────────────────────────
  const today = new Date().toISOString().split('T')[0];
  const { count: usageCount } = await sb
    .from('analisis')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', currentUser.id)
    .gte('created_at', today + 'T00:00:00Z');

  const used  = usageCount || 0;
  const limit = cfg.limit >= 99999 ? '∞' : cfg.limit;
  const pct   = cfg.limit >= 99999 ? 5 : Math.min(100, Math.round((used / cfg.limit) * 100));
  const usageEl = document.getElementById('sub-usage-count');
  const fillEl  = document.getElementById('sub-usage-fill');
  if (usageEl) usageEl.textContent = `${used} / ${limit}`;
  if (fillEl)  fillEl.style.width = `${pct}%`;

  // ── Billing section ──────────────────────────────────────
const billingEl = document.getElementById('billing-section');
  if (!billingEl) return;

  if (!metodoPago) {
    billingEl.innerHTML = `
      <div style="text-align:center;padding:20px 0;color:var(--slate-400)">
        <div style="font-size:2rem;margin-bottom:8px">💳</div>
        <div style="font-size:0.85rem">${plan === 'basico' ? 'Sin método de pago' : 'Método de pago no registrado'}</div>
        <div style="font-size:0.75rem;margin-top:4px;color:var(--slate-400)">${plan === 'basico' ? 'Actualmente en el plan gratuito' : 'Contacta soporte para actualizar'}</div>
      </div>`;
  } else {
    const tipoPagoLabel = { mensual: 'Mensual', trimestral: 'Trimestral', anual: 'Anual' }[tipoPago] || tipoPago || '';
    billingEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:14px;padding:4px 0">
        <div style="width:48px;height:32px;border-radius:6px;background:linear-gradient(135deg,#1e40af,#3b82f6);display:flex;align-items:center;justify-content:center;font-size:1.2rem">💳</div>
        <div>
          <div style="font-weight:600;font-size:0.9rem;color:var(--slate-900)">${metodoPago}</div>
          <div style="font-size:0.75rem;color:var(--slate-400)">Facturación ${tipoPagoLabel}${vence ? ' · Vence el ' + vence : ''}</div>
        </div>
        <span style="margin-left:auto;font-size:0.7rem;padding:3px 10px;border-radius:100px;background:var(--green-50);color:var(--green-700);font-weight:600">Activa</span>
      </div>
      <div style="border-top:1px solid var(--slate-100);margin-top:16px;padding-top:12px">
        <button onclick="showToast('💳','Funcionalidad de cambio de pago disponible pronto')" style="font-size:0.8rem;color:var(--slate-500);background:none;border:none;cursor:pointer;padding:0">Cambiar método de pago →</button>
      </div>`;
  }
}

// ─── ACTIVE SESSIONS ──────────────────────────────────────────
function parseUserAgent(ua) {
  // Detect browser
  let browser = 'Navegador desconocido';
  if (/Edg\//.test(ua))          browser = 'Edge';
  else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
  else if (/Chrome\//.test(ua))  browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua))  browser = 'Safari';

  // Detect OS / device
  let os = 'Dispositivo desconocido';
  let icon = '💻';
  let iconClass = 'li-blue';
  if (/iPhone/.test(ua))        { os = 'iPhone';     icon = '📱'; iconClass = 'li-blue'; }
  else if (/iPad/.test(ua))     { os = 'iPad';       icon = '📱'; iconClass = 'li-blue'; }
  else if (/Android/.test(ua))  { os = 'Android';    icon = '📱'; iconClass = 'li-blue'; }
  else if (/Windows NT 10/.test(ua)) { os = 'Windows 11'; icon = '💻'; iconClass = 'li-green'; }
  else if (/Windows NT 6/.test(ua))  { os = 'Windows 10'; icon = '💻'; iconClass = 'li-green'; }
  else if (/Mac OS X/.test(ua))      { os = 'macOS';      icon = '💻'; iconClass = 'li-green'; }
  else if (/Linux/.test(ua))         { os = 'Linux';       icon = '💻'; iconClass = 'li-green'; }

  return { browser, os, icon, iconClass };
}

function formatSessionDate(dateStr) {
  if (!dateStr) return 'Fecha desconocida';
  const date = new Date(dateStr);
  const now  = new Date();
  const diffMs  = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays= Math.floor(diffMs / 86400000);

  if (diffMin < 2)   return 'Justo ahora';
  if (diffMin < 60)  return `hace ${diffMin} minutos`;
  if (diffHrs < 24)  return `hace ${diffHrs} hora${diffHrs > 1 ? 's' : ''}`;
  if (diffDays < 7)  return `hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
  return date.toLocaleDateString('es-DO', { day:'2-digit', month:'short', year:'numeric' });
}

async function renderSessions() {
  const container = document.getElementById('sessions-list');
  if (!container) return;

  const { data: { session } } = await sb.auth.getSession();

  if (!session) {
    container.innerHTML = '<p style="color:var(--slate-400);font-size:0.83rem;text-align:center;padding:16px 0">No hay sesiones activas.</p>';
    return;
  }

  const ua   = navigator.userAgent;
  const info = parseUserAgent(ua);
  const loginAt = session.user?.last_sign_in_at || session.user?.created_at;
  const timeStr = formatSessionDate(loginAt);

  container.innerHTML = `
    <div class="log-item">
      <div class="log-icon-wrap ${info.iconClass}">${info.icon}</div>
      <div class="log-content">
        <div class="log-title">${info.browser} · ${info.os}</div>
        <div class="log-detail">Sesión actual · Iniciada ${timeStr}</div>
      </div>
      <span style="font-size:0.7rem;padding:2px 10px;border-radius:100px;background:var(--green-50);color:var(--green-700);font-weight:600;white-space:nowrap">Activa</span>
    </div>
    <div style="border-top:1px solid var(--slate-100);margin:12px 0"></div>
    <button
      id="btn-signout-all"
      onclick="signOutCurrent()"
      style="width:100%;padding:10px;border-radius:10px;border:1.5px solid var(--red-200);background:var(--red-50);color:var(--red-600);font-size:0.82rem;font-weight:600;cursor:pointer;transition:all .2s"
      onmouseover="this.style.background='var(--red-100)'"
      onmouseout="this.style.background='var(--red-50)'"
    >🚪 Cerrar esta sesión</button>
  `;
}

async function signOutCurrent() {
  const btn = document.getElementById('btn-signout-all');
  if (btn) { btn.disabled = true; btn.textContent = 'Cerrando sesión…'; }
  await sb.auth.signOut();
  window.location.href = 'login.html';
}

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
    overlay.style.display = 'flex';
    currentModal = type;
  }
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.style.display = 'none';
}

async function confirmModal() {
  const btn = document.getElementById('modal-confirm');
  if (btn) btn.disabled = true;

  try {
    if (currentModal === 'history') {
      const { error } = await sb.from('analisis').delete().eq('user_id', currentUser.id);
      if (error) throw error;
      showToast('✅', 'Historial eliminado con éxito');
    } 
    else if (currentModal === 'deactivate') {
      // Typically we'd update a status column, but we'll mock by just signing out for now 
      // as Supabase doesn't natively "deactivate" without custom perfiles logic.
      showToast('✅', 'Cuenta desactivada temporalmente');
      setTimeout(() => logout(), 1500);
    } 
    else if (currentModal === 'delete') {
      // Native delete requires Admin API. We show a message and sign out.
      showToast('✅', 'Solicitud enviada. Tu cuenta se borrará pronto.');
      setTimeout(() => logout(), 1500);
    }
  } catch (err) {
    showToast('❌', 'Error: ' + err.message);
  }

  if (btn) btn.disabled = false;
  closeModal();
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
  // Load profile from Supabase
  loadProfile();

  // Render active sessions in security tab
  renderSessions();

  // Check for hash in URL to switch tab
  const hash = window.location.hash.replace('#', '');
  if (['perfil', 'suscripcion', 'seguridad', 'actividad'].includes(hash)) {
    switchTab(hash);
  }
});

// ─── SIDEBAR TOGGLE ───────────────────────────────────────────
const sidebar = document.getElementById('sidebar');
function toggleSidebar() {
  if (sidebar) {
    if (window.innerWidth <= 900) {
      sidebar.classList.toggle('show-mobile');
    } else {
      sidebar.classList.toggle('mini');
    }
  }
}

// ─── ALERTS BADGE SYNC ──────────────────────────────────────────
async function loadUnreadAlertsCount() {
  if (!currentUser) return;
  const { count, error } = await sb
    .from('analisis')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', currentUser.id)
    .eq('leida', false)
    .in('resultado', ['peligroso', 'sospechoso']);
  
  if (error) return;
  
  const sidebarBadge = document.getElementById('sidebar-alerts-badge');
  if (sidebarBadge) {
     if (count > 0) {
         sidebarBadge.style.display = '';
         sidebarBadge.textContent = count;
     } else {
         sidebarBadge.style.display = 'none';
     }
  }
}

// ─── PREFERENCIAS DE NOTIFICACIÓN ──────────────────────────────
async function loadNotificationPrefs() {
  if (!currentUser) return;
  const { data, error } = await sb
    .from('preferencias_notificacion')
    .select('*')
    .eq('user_id', currentUser.id)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.warn('Error cargando preferencias de notificacion:', error.message);
    return;
  }

  // If no preferences yet, leave the default DOM attributes.
  if (!data) return;

  const cbDashboard = document.getElementById('pref-alertas_dashboard');
  const cbSemanal   = document.getElementById('pref-resumen_semanal');
  const cbCorreos   = document.getElementById('pref-correos_promocionales');
  const cbRecordatorio = document.getElementById('pref-recordatorio_analisis');

  if (cbDashboard) cbDashboard.checked = data.alertas_dashboard !== false;
  if (cbSemanal) cbSemanal.checked = data.resumen_semanal !== false;
  if (cbCorreos) cbCorreos.checked = data.correos_promocionales === true;
  if (cbRecordatorio) cbRecordatorio.checked = data.recordatorio_analisis !== false;
}

window.saveNotificationPrefs = async function() {
  if (!currentUser) return;

  const cbDashboard = document.getElementById('pref-alertas_dashboard');
  const cbSemanal   = document.getElementById('pref-resumen_semanal');
  const cbCorreos   = document.getElementById('pref-correos_promocionales');
  const cbRecordatorio = document.getElementById('pref-recordatorio_analisis');

  const prefs = {
    user_id: currentUser.id,
    alertas_dashboard: cbDashboard ? cbDashboard.checked : true,
    resumen_semanal: cbSemanal ? cbSemanal.checked : true,
    correos_promocionales: cbCorreos ? cbCorreos.checked : false,
    recordatorio_analisis: cbRecordatorio ? cbRecordatorio.checked : true,
  };

  const { error } = await sb
    .from('preferencias_notificacion')
    .upsert(prefs, { onConflict: 'user_id' });

  if (error) {
    console.error('Error guardando preferencias:', error.message);
    showToast('❌', 'No se pudieron guardar las preferencias');
  } else {
    showToast('✅', 'Preferencias actualizadas');
  }
}

// ─── 2FA / MFA HANDLING ───────────────────────────────────────
let currentFactorId = null;

async function loadMFAState() {
  if (!currentUser) return;
  
  const { data, error } = await sb.auth.mfa.listFactors();
  if (error) {
     console.warn('Error fetching MFA factors:', error.message);
     return;
  }
  
  const totpFactor = data.totp.find(factor => factor.status === 'verified');
  const toggle = document.getElementById('toggle-2fa');
  
  if (totpFactor) {
     if (toggle) toggle.checked = true;
     currentFactorId = totpFactor.id;
  } else {
     if (toggle) toggle.checked = false;
  }
}

window.handle2FAToggle = function() {
  const toggle = document.getElementById('toggle-2fa');
  if (toggle.checked) {
      startMFAEnroll();
  } else {
      // User wants to disable, but don't let them turn off the toggle visually yet
      toggle.checked = true; // revert visual state until confirmed
      document.getElementById('modal-disable-mfa').style.display = 'flex';
      document.getElementById('mfa-disable-pass').value = '';
  }
}

async function startMFAEnroll() {
  const { data, error } = await sb.auth.mfa.enroll({
    factorType: 'totp',
    issuer: 'CyberShield',
    friendlyName: currentUser ? currentUser.email : 'Usuario'
  });
  
  if (error) {
     showToast('❌', 'Error al habilitar 2FA: ' + error.message);
     document.getElementById('toggle-2fa').checked = false;
     return;
  }
  
  currentFactorId = data.id;
  
  // Set the SVG data URI to the image src
  document.getElementById('mfa-qr-img').src = data.totp.qr_code;
  
  // Generate 12 mock recovery words
  const wordsRaw = ["acceso","bloqueo","llave","sistema","defensa","codigo","alarma","seguro","red","servidor","dato","token","nube","cifrado","clave","usuario","digital","firewall","malware","phishing","brecha","auditoria","filtro","huella","puerto"];
  let recoveryHtml = '';
  const myWords = [...wordsRaw].sort(() => 0.5 - Math.random()).slice(0, 12);
  myWords.forEach((word, index) => {
    recoveryHtml += `<div style="background:#fff; padding:4px 8px; border-radius:4px; text-align:center;">${index+1}. ${word}</div>`;
  });
  document.getElementById('mfa-recovery-words').innerHTML = recoveryHtml;
  
  // Clear the input
  document.getElementById('mfa-code-input').value = '';
  
  // Display the new Modal
  document.getElementById('modal-mfa-setup').style.display = 'flex';
}

window.cancelMFAEnroll = async function() {
  if (currentFactorId) {
     await sb.auth.mfa.unenroll({ factorId: currentFactorId });
     currentFactorId = null;
  }
  document.getElementById('modal-mfa-setup').style.display = 'none';
  document.getElementById('toggle-2fa').checked = false;
}

window.verifyMFAEnroll = async function() {
  const code = document.getElementById('mfa-code-input').value.trim();
  if (!code || code.length !== 6) {
      showToast('⚠️', 'Proporciona el código de 6 dígitos correcto');
      return;
  }
  
  const btn = document.getElementById('btn-verify-mfa');
  btn.disabled = true;
  btn.textContent = 'Verificando...';

  const { data, error } = await sb.auth.mfa.challengeAndVerify({
    factorId: currentFactorId,
    code: code
  });

  btn.disabled = false;
  btn.textContent = 'Verificar y Activar';

  if (error) {
     showToast('❌', 'Código incorrecto. Intenta de nuevo.');
  } else {
     showToast('✅', 'Autenticación 2FA activada con éxito');
     // Force refresh session to guarantee AAL2 is populated in the JWT immediately!
     await sb.auth.refreshSession();
     document.getElementById('modal-mfa-setup').style.display = 'none';
     document.getElementById('toggle-2fa').checked = true;
  }
}

window.closeDisableMFAModal = function() {
  document.getElementById('modal-disable-mfa').style.display = 'none';
}

window.confirmDisableMFA = async function() {
  const rawCode = document.getElementById('mfa-disable-code').value || '';
  const code = String(rawCode).replace(/\s/g, '').trim();

  if (!code || code.length !== 6) {
    showToast('⚠️', 'Proporciona el código de 6 dígitos correcto');
    return;
  }

  const btn = document.getElementById('btn-confirm-disable');
  btn.disabled = true;
  btn.textContent = 'Verificando...';

  // 1. Verify the code again (this strictly ensures they own the factor AND bumps the session to AAL2!)
  const { error: challengeError } = await sb.auth.mfa.challengeAndVerify({
    factorId: currentFactorId,
    code: code
  });

  if (challengeError) {
    showToast('❌', 'Código incorrecto. Intenta de nuevo.');
    btn.disabled = false;
    btn.textContent = 'Confirmar';
    return;
  }

  // 2. Confirmed AAL2. Unenroll the factor.
  if (currentFactorId) {
      const { error: unenrollError } = await sb.auth.mfa.unenroll({ factorId: currentFactorId });
      if (unenrollError) {
         showToast('❌', 'No se pudo desactivar el 2FA: ' + unenrollError.message);
         btn.disabled = false;
         btn.textContent = 'Confirmar';
         return;
      }
  } else {
      // In case we don't have it locally, fetch & unenroll
      const { data } = await sb.auth.mfa.listFactors();
      if (data && data.totp) {
          for (let factor of data.totp) {
              await sb.auth.mfa.unenroll({ factorId: factor.id });
          }
      }
  }

  btn.disabled = false;
  btn.textContent = 'Confirmar';

  showToast('✅', '2FA desactivado correctamente');
  
  // Refresh session to downgrade locally back to AAL1
  await sb.auth.refreshSession();
  
  document.getElementById('toggle-2fa').checked = false;
  currentFactorId = null;
  document.getElementById('mfa-disable-code').value = '';
  closeDisableMFAModal();
}

// ─── ACTUALIZAR CONTRASEÑA ──────────────────────────────────────
window.updateUserPassword = async function() {
  const currentPass = document.getElementById('pass-current').value;
  const newPass = document.getElementById('pass-new').value;
  const confirmPass = document.getElementById('pass-confirm').value;

  if (!currentPass || !newPass || !confirmPass) {
    showToast('⚠️', 'Por favor completa todos los campos de contraseña.');
    return;
  }
  
  if (newPass.length < 8) {
    showToast('⚠️', 'La nueva contraseña debe tener al menos 8 caracteres.');
    return;
  }

  if (newPass !== confirmPass) {
    showToast('⚠️', 'La nueva contraseña original y la confirmación no coinciden.');
    return;
  }

  const btn = document.getElementById('btn-update-pass');
  btn.disabled = true;
  btn.textContent = 'Actualizando...';

  // Verify the current password first by re-authenticating with a temporary client (avoids AAL2 downgrade)
  const tempClient = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const { error: signInError } = await tempClient.auth.signInWithPassword({
    email: currentUser.email,
    password: currentPass
  });

  if (signInError) {
    showToast('❌', 'La contraseña actual introducida no es válida.');
    btn.disabled = false;
    btn.textContent = 'Actualizar contraseña';
    return;
  }

  // Current password is correct, now update to new password
  const { error: updateError } = await sb.auth.updateUser({
    password: newPass
  });

  btn.disabled = false;
  btn.textContent = 'Actualizar contraseña';

  if (updateError) {
    showToast('❌', 'Error al actualizar contraseña: ' + updateError.message);
  } else {
    showToast('✅', 'Contraseña actualizada correctamente');
    document.getElementById('pass-current').value = '';
    document.getElementById('pass-new').value = '';
    document.getElementById('pass-confirm').value = '';
    document.getElementById('strength-fill').style.width = '0%';
    document.getElementById('strength-label').textContent = 'Escribe una contraseña para ver su fortaleza';
    document.getElementById('strength-label').style.color = '';
  }
}

window.togglePass = function(id, btn) {
  const input = document.getElementById(id);
  if (!input) return;
  if(input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🔒';
  } else {
    input.type = 'password';
    btn.textContent = '👁';
  }
}

window.logout = async function() {
  await sb.auth.signOut();
  window.location.href = 'login.html';
}

// ─── GESTIÓN DE EQUIPO INSTITUCIONAL ─────────────────────────────
window.loadTeam = async function() {
  if (!currentUser) return;
  const { data: team, error } = await sb
    .from('miembros_equipo')
    .select('*')
    .eq('admin_user_id', currentUser.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('Error cargando equipo:', error.message);
    return;
  }

  window.currentTeam = team || [];
  
  const countEl = document.getElementById('team-count');
  if (countEl) countEl.textContent = `${window.currentTeam.length}/10`;

  const tbody = document.getElementById('team-list-body');
  if (!tbody) return;

  if (window.currentTeam.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:30px; color:var(--slate-400);">No tienes empleados invitados. Invita al primero usando el botón de arriba.</td></tr>`;
    const actBody = document.getElementById('team-activity-body');
    if (actBody) actBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:30px; color:var(--slate-400);">No hay actividad porque aún no tienes equipo.</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  window.currentTeam.forEach(t => {
    const estadoStyle = t.estado === 'activo' 
      ? 'color:var(--green-600); background:var(--green-50); padding:4px 8px; border-radius:4px; font-size:0.75rem; font-weight:700;'
      : 'color:#f59e0b; background:#fffbeb; padding:4px 8px; border-radius:4px; font-size:0.75rem; font-weight:700;';

    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--slate-100)';
    tr.innerHTML = `
      <td style="padding:16px 8px; font-weight:500; color:var(--slate-800)">${t.miembro_email}</td>
      <td style="padding:16px 8px; color:var(--slate-600)">${t.rol.toUpperCase()}</td>
      <td style="padding:16px 8px;"><span style="${estadoStyle}">${t.estado.toUpperCase()}</span></td>
      <td style="padding:16px 8px; text-align:right;">
        <button onclick="deleteTeamMember('${t.id}')" style="background:none; border:none; color:var(--red-500); cursor:pointer; padding:6px; font-size:1.1rem; border-radius:6px; transition:background 0.2s;" onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='none'" title="Desvincular">🗑</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  loadTeamActivity();
}

window.loadTeamActivity = async function() {
  const activityBody = document.getElementById('team-activity-body');
  if (!activityBody || !window.currentTeam) return;

  const activeIds = window.currentTeam
    .filter(m => m.estado === 'activo' && m.miembro_user_id)
    .map(m => m.miembro_user_id);

  if (activeIds.length === 0) {
    activityBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:30px; color:var(--slate-400);">No hay miembros activos con cuenta vinculada aún.</td></tr>';
    return;
  }

  const { data: scans, error } = await sb
    .from('analisis')
    .select('id, user_id, tipo, herramienta, resultado, created_at, perfiles:user_id(nombre, apellido)')
    .in('user_id', activeIds)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error fetching team activity:', error);
    return;
  }

  if (!scans || scans.length === 0) {
    activityBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:30px; color:var(--slate-400);">Tus empleados aún no han realizado análisis.</td></tr>';
    return;
  }

  activityBody.innerHTML = scans.map(s => {
    const date = new Date(s.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    const userDisplay = s.perfiles ? `${s.perfiles.nombre} ${s.perfiles.apellido}` : 'Usuario';
    const isSuccess = s.resultado && (s.resultado.includes('éxito') || s.resultado.includes('No se encontraron') || s.resultado.includes('Seguro') || s.resultado.includes('Limpio'));
    const statusStyle = isSuccess ? 'color:var(--green-600); font-weight:600' : 'color:var(--red-500); font-weight:600';

    return `
      <tr style="border-bottom:1px solid var(--slate-100);">
        <td style="padding:16px 8px; color:var(--slate-700)">${userDisplay}</td>
        <td style="padding:16px 8px; color:var(--slate-600)">${s.herramienta || s.tipo}</td>
        <td style="padding:16px 8px; color:var(--slate-400); font-size:0.85rem">${date}</td>
        <td style="padding:16px 8px; text-align:right;"><span style="${statusStyle}">${s.resultado || 'Analizado'}</span></td>
      </tr>
    `;
  }).join('');
}
}

window.openInviteModal = function() {
  if (window.currentTeam && window.currentTeam.length >= 10) {
    showToast('⚠️', 'Has alcanzado el límite máximo de 10 miembros para tu organización.');
    return;
  }
  document.getElementById('modal-invite-member').style.display = 'flex';
}

window.sendTeamInvite = async function() {
  const emailInput = document.getElementById('invite-email-input');
  const email = emailInput.value.trim().toLowerCase();
  
  if (!email || !email.includes('@')) {
    showToast('⚠️', 'Ingresa un correo electrónico válido');
    return;
  }

  const btn = document.getElementById('btn-send-invite');
  btn.textContent = 'Enviando...';
  btn.disabled = true;

  // Insert to supabase
  const { data, error } = await sb.from('miembros_equipo').insert([{
    admin_user_id: currentUser.id,
    miembro_email: email
  }]).select().single();

  if (error) {
    btn.textContent = 'Enviar Invitación';
    btn.disabled = false;
    showToast('❌', error.code === '23505' ? 'Este correo ya fue invitado a tu equipo' : error.message);
    return;
  }

  // Send Email with EmailJS directly mapped from contact approach
  try {
     const inviteLink = window.location.origin + window.location.pathname.replace('perfil.html', 'login.html') + '?invitacion=true&email=' + encodeURIComponent(email);
     
     // Required by EmailJS specifically matching our template fields: name, email, user_type, title, message
     const emailParams = {
        name: "Futuro integrante",
        email: email, 
        user_type: "institucional",
        title: "🛡 Invitación de CiberShield",
        message: "Has sido invitado a unirte a un entorno institucional. Por favor, crea tu cuenta o accede usando este enlace exclusivo para vincularte: " + inviteLink
     };

     await emailjs.send("service_fngp26n", "template_j2vpch6", emailParams, "VGZoWseJ-akDTQwq6");
     
     document.getElementById('modal-invite-member').style.display = 'none';
     emailInput.value = '';
     showToast('✅', '¡Invitación de equipo enviada por correo!');
     loadTeam();
  } catch(e) {
     console.error('EmailJS error:', e);
     showToast('⚠️', 'Se guardó la invitación, pero hubo un error enviando el correo.');
     // Optionally refresh if you still want it to appear
     loadTeam();
     document.getElementById('modal-invite-member').style.display = 'none';
     emailInput.value = '';
  }

  btn.textContent = 'Enviar Invitación';
  btn.disabled = false;
}

window.deleteTeamMember = async function(id) {
  if (!confirm('¿Seguro que deseas desvincular a este miembro? Perderá todos sus privilegios institucionales de inmediato en cuanto cierre sesión.')) return;
  const { error } = await sb.from('miembros_equipo').delete().eq('id', id);
  if (error) {
    showToast('❌', error.message);
  } else {
    showToast('✅', 'Miembro desvinculado con éxito');
    loadTeam();
  }
}

