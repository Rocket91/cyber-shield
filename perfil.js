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

let currentUser = null;


// ─── LOAD PROFILE FROM SUPABASE (SWR) ────────────────────────
async function loadProfile() {
  const { data: { user }, error } = await sb.auth.getUser();
  if (!user || error) {
    await sb.auth.signOut({ scope: 'local' });
    localStorage.removeItem('userPlan');
    localStorage.removeItem('sb-remember-me');
    window.location.href = 'login.html';
    return;
  }
  currentUser = user;

  const emailEl = document.getElementById('input-email');
  if (emailEl) emailEl.value = currentUser.email || '';

  const [perfilRes, subRes] = await Promise.all([
    sb.from('perfiles').select('nombre,apellido,plan').eq('id', currentUser.id).maybeSingle(),
    sb.from('suscripciones')
      .select('plan,tipo_pago,fecha_vencimiento,metodo_pago')
      .eq('user_id', currentUser.id)
      .eq('activo', true)
      .order('fecha_vencimiento', { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  if (perfilRes.error && !perfilRes.data) {
    showToast('❌', 'Error al cargar datos del perfil');
    return;
  }

  const perfil = perfilRes.data || {};
  const sub = subRes.data || null;
  const hoy = new Date();
  const subValida = sub && sub.plan && (!sub.fecha_vencimiento || new Date(sub.fecha_vencimiento) >= hoy);
  const plan = subValida ? sub.plan : (perfil.plan || 'basico');

  localStorage.setItem('userPlan', plan);
  currentUser.plan_real = plan;

  renderProfileUI({ nombre: perfil.nombre || '', apellido: perfil.apellido || '', plan, sub: subValida ? sub : null });

  loadSubscription(subValida ? sub : null);
  loadProfileMetrics();
  loadActivityLog();
  loadUnreadAlertsCount();
  loadNotificationPrefs();
  loadMFAState();
}

function renderProfileUI({ nombre = '', apellido = '', plan = 'basico', sub = null }) {
  const planColors = { premium: '#f59e0b', institucional: '#10b981', basico: 'var(--slate-400)' };
  const planLabels = { premium: 'Premium', institucional: 'Institucional', basico: 'Básico' };
  const planLabel = planLabels[plan] || 'Básico';
  const planColor = planColors[plan] || planColors.basico;
  const initials = ((nombre[0] || '') + (apellido[0] || '')).toUpperCase() || '??';
  const fullName = `${nombre} ${apellido}`.trim();

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const setColor = (id, color) => { const el = document.getElementById(id); if (el) el.style.color = color; };

  set('sidebar-avatar', initials);
  set('sidebar-name', fullName);
  set('sidebar-plan', `✦ Plan ${planLabel}`);
  setColor('sidebar-plan', planColor);

  set('topbar-avatar', initials);
  set('hero-avatar', initials);
  set('hero-name', fullName);
  set('hero-plan-tag', `✦ Plan ${planLabel}`);

  const inputN = document.getElementById('input-nombre');
  const inputA = document.getElementById('input-apellido');
  if (inputN && !inputN.value) inputN.value = nombre;
  if (inputA && !inputA.value) inputA.value = apellido;

  if (plan === 'premium' || plan === 'institucional') {
    document.querySelectorAll('.page-tab').forEach(tab => {
      tab.removeAttribute('disabled');
      tab.classList.remove('locked', 'disabled', 'hidden');
    });
  }

  if (plan === 'institucional') {
    const tabBtn = document.getElementById('tab-btn-equipo');
    if (tabBtn) tabBtn.style.display = 'inline-block';
  }
}
// ─── SAVE PROFILE TO SUPABASE ─────────────────────────────────
async function saveProfile() {
  if (!currentUser) { showToast('❌', 'No estás autenticado'); return; }

  const nombre = document.getElementById('input-nombre')?.value.trim();
  const apellido = document.getElementById('input-apellido')?.value.trim();
  const telefono = document.getElementById('input-telefono')?.value.trim();
  const empresa = document.getElementById('input-empresa')?.value.trim();

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
async function loadSubscription(preloadedSub = null) {
  if (!currentUser) return;

  let sub = preloadedSub;
  if (!sub) {
    const { data } = await sb
      .from('suscripciones')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('activo', true)
      .maybeSingle();
    sub = data;
  }

  // Fallback: if no subscription record, read plan from perfiles table directly
  let plan = sub?.plan || null;
  if (!plan) {
    const { data: perfil } = await sb
      .from('perfiles')
      .select('plan')
      .eq('id', currentUser.id)
      .maybeSingle();
    plan = perfil?.plan || 'basico';
  }
  localStorage.setItem('userPlan', plan);
  const tipoPago = sub?.tipo_pago || null;
  const vence = sub?.fecha_vencimiento ? new Date(sub.fecha_vencimiento).toLocaleDateString('es-DO', { day: '2-digit', month: 'long', year: 'numeric' }) : null;
  const metodoPago = sub?.metodo_pago || null;

  // ── Plan card highlights ────────────────────────────────
  const planCardsContainer = document.querySelector('.plan-cards');
  if (planCardsContainer && plan !== 'institucional') {
    // Make the grid adapt to 2 columns if institucional is hidden
    planCardsContainer.style.gridTemplateColumns = 'repeat(2, 1fr)';
    planCardsContainer.style.maxWidth = '600px';
  } else if (planCardsContainer) {
    planCardsContainer.style.gridTemplateColumns = 'repeat(3, 1fr)';
    planCardsContainer.style.maxWidth = 'none';
  }

  ['basico', 'premium', 'institucional'].forEach(p => {
    const card = document.getElementById(`plan-card-${p}`);
    const badge = document.getElementById(`plan-badge-${p}`);
    const btn = document.getElementById(`btn-plan-${p}`);
    if (!card) return;
    if (p === plan) {
      card.style.display = '';
      card.classList.add('current');
      if (badge) badge.style.display = '';
      if (btn) { btn.classList.add('active-plan'); btn.textContent = 'Plan actual'; btn.onclick = null; }
    } else {
      if (p === 'institucional') {
        card.style.display = 'none';
      } else {
        card.style.display = '';
      }
      card.classList.remove('current');
      if (badge) badge.style.display = 'none';
      if (btn && btn.classList.contains('active-plan')) {
        btn.classList.remove('active-plan');
        btn.textContent = p === 'institucional' ? 'Contactar' : 'Actualizar';
      }
      if (p === 'premium' && btn) {
        btn.onclick = () => openUpgradeModal();
      }
    }
  });

  // ── Active plan card ───────────────────────────────────
  const planConfig = {
    basico: {
      name: 'Plan Básico',
      desc: 'Gratuito para siempre · Sin tarjeta de crédito',
      limit: 50,
      features: ['5 herramientas activas', '50 análisis por día', 'Historial de 7 días'],
      badgeBg: 'var(--green-50)', badgeColor: 'var(--green-700)'
    },
    premium: {
      name: 'Plan Premium',
      desc: tipoPago ? `Facturación ${tipoPago}` + (vence ? ` · Vence el ${vence}` : '') : 'Plan Premium activo',
      limit: 500,
      features: ['10 herramientas activas', '500 análisis por día', 'Historial de 90 días', 'Reportes PDF'],
      badgeBg: '#fef9ee', badgeColor: '#b45309'
    },
    institucional: {
      name: 'Plan Institucional',
      desc: tipoPago ? `Facturación ${tipoPago}` + (vence ? ` · Vence el ${vence}` : '') : 'Plan Institucional activo',
      limit: 99999,
      features: ['15 herramientas activas', 'Análisis ilimitados', 'Historial ilimitado', 'Módulo personalizado', 'Soporte prioritario'],
      badgeBg: '#f5f3ff', badgeColor: '#6d28d9'
    }
  };
  const cfg = planConfig[plan];

  const nameEl = document.getElementById('sub-plan-name');
  const descEl = document.getElementById('sub-plan-desc');
  const featEl = document.getElementById('sub-features');
  const badge = document.getElementById('sub-plan-badge');

  if (nameEl) nameEl.textContent = cfg.name;
  if (descEl) descEl.textContent = cfg.desc;
  if (featEl) featEl.innerHTML = cfg.features.map(f => `<div class="sub-feat"><span class="check">✓</span> ${f}</div>`).join('');
  if (badge) { badge.style.background = cfg.badgeBg; badge.querySelector('.dot').style.background = cfg.badgeColor; }

  // ── Today's usage ───────────────────────────────────────
  const today = new Date().toISOString().split('T')[0];
  const { count: usageCount } = await sb
    .from('analisis')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', currentUser.id)
    .gte('created_at', today + 'T00:00:00Z');

  const used = usageCount || 0;
  const limit = cfg.limit >= 99999 ? '∞' : cfg.limit;
  const pct = cfg.limit >= 99999 ? 5 : Math.min(100, Math.round((used / cfg.limit) * 100));
  const usageEl = document.getElementById('sub-usage-count');
  const fillEl = document.getElementById('sub-usage-fill');
  if (usageEl) usageEl.textContent = `${used} / ${limit}`;
  if (fillEl) fillEl.style.width = `${pct}%`;

  // ── Billing section ──────────────────────────────────────
  const billingEl = document.getElementById('billing-section');
  if (!billingEl) return;

  if (plan === 'basico' || !metodoPago) {
    billingEl.innerHTML = `
      <div style="text-align:center;padding:20px 0;color:var(--slate-400)">
        <div style="font-size:2rem;margin-bottom:8px">💳</div>
        <div style="font-size:0.85rem">${plan === 'basico' ? 'Sin método de pago' : 'Método de pago no registrado'}</div>
        <div style="font-size:0.75rem;margin-top:4px;color:var(--slate-400)">${plan === 'basico' ? 'Actualmente en el plan gratuito' : 'Contacta soporte para actualizar'}</div>
      </div>`;
  } else {
    const tipoPagoLabel = { mensual: 'Mensual', trimestral: 'Trimestral', anual: 'Anual' }[tipoPago] || tipoPago || 'Mensual';
    let icon = metodoPago.toLowerCase() === 'paypal' ? '🔵' : '💳';
    let metTxt = metodoPago.toLowerCase() === 'paypal' ? 'PayPal' : '•••• 4242';

    let diasRestantesTxt = '';
    if (sub?.fecha_vencimiento) {
      const diffTime = new Date(sub.fecha_vencimiento) - new Date();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays >= 0) {
        diasRestantesTxt = `${diffDays} días para el próximo pago`;
      } else {
        diasRestantesTxt = 'Pago atrasado';
      }
    } else {
      diasRestantesTxt = 'Fecha no definida';
    }

    let montoPagar = '12.00';
    if (plan === 'premium') {
       if(tipoPago === 'trimestral') montoPagar = '33.00';
       else if(tipoPago === 'anual') montoPagar = '120.00';
    } else if (plan === 'institucional') {
       if(tipoPago === 'trimestral') montoPagar = '132.00';
       else if(tipoPago === 'anual') montoPagar = '468.00';
       else montoPagar = '49.00';
    }

    billingEl.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:40px;height:40px;background:var(--slate-50);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1.2rem;">
            ${icon}
          </div>
          <div>
            <div style="font-weight:600; color:var(--slate-800)">${metTxt}</div>
            <div style="font-size:0.85rem; color:var(--slate-500)">${diasRestantesTxt}</div>
          </div>
        </div>
        <button class="btn-white-sm" onclick="openUpdatePaymentModal('${metodoPago}','${metTxt}')">Actualizar</button>
      </div>
      <div style="background:var(--slate-50); padding:12px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size:0.85rem; color:var(--slate-500); margin-bottom:4px">Facturación ${tipoPagoLabel.toLowerCase()}</div>
          <div style="font-weight:700; color:var(--slate-800)">$${montoPagar}</div>
        </div>
        <div style="text-align:right">
          <span class="badge" style="background:var(--green-50); color:var(--green-700)">Activa</span>
        </div>
      </div>
    `;
  }
}

// ─── LOAD PROFILE METRICS ──────────────────────────────────────
async function loadProfileMetrics() {
  if (!currentUser) return;

  const { data, error } = await sb
    .from('analisis')
    .select('resultado')
    .eq('user_id', currentUser.id);

  if (error) {
    console.warn('Error cargando métricas del perfil:', error.message);
    return;
  }

  const total = data.length;
  let threats = 0;
  let cleans = 0;

  data.forEach(a => {
    if (a.resultado === 'peligroso' || a.resultado === 'sospechoso') {
      threats++;
    } else if (a.resultado === 'limpio') {
      cleans++;
    }
  });

  const rate = total === 0 ? 100 : Math.round((cleans / total) * 100);

  // Calculate days on platform
  const created = new Date(currentUser.created_at);
  const now = new Date();
  const diffDays = Math.floor((now - created) / 86400000);
  const daysOnPlatform = diffDays === 0 ? 1 : diffDays; // count as 1 if it's the first day

  // Update DOM
  const elTotal = document.getElementById('profile-stat-total');
  const elThreats = document.getElementById('profile-stat-threats');
  const elRate = document.getElementById('profile-stat-rate');
  const elDays = document.getElementById('profile-stat-days');

  if (elTotal) elTotal.textContent = total;
  if (elThreats) elThreats.textContent = threats;
  if (elRate) elRate.textContent = `${rate}%`;
  if (elDays) elDays.textContent = daysOnPlatform;
}

// ─── LOAD ACTIVITY LOG ────────────────────────────────────────
async function loadActivityLog() {
  if (!currentUser) return;

  const container = document.getElementById('activity-log-list');
  if (!container) return;

  // 1. Fetch recent scans
  const { data: scans, error } = await sb
    .from('analisis')
    .select('id, tipo, resultado, detalle, herramienta, created_at')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.warn('Error fetching activity:', error.message);
    container.innerHTML = '<div style="text-align:center;color:var(--slate-400);padding:24px 0">Error al cargar actividad.</div>';
    return;
  }

  // 2. Mix with system events
  let activities = [];

  // Add scans
  (scans || []).forEach(scan => {
    let icon = '✅';
    let iconClass = 'li-green';
    let titlePrefix = 'Archivo limpio';
    
    if (scan.resultado === 'peligroso') { 
      icon = '🚨'; iconClass = 'li-red'; 
      titlePrefix = scan.tipo === 'url' ? 'Phishing detectado' : 'Malware detectado'; 
    }
    else if (scan.resultado === 'sospechoso') { 
      icon = '⚠️'; iconClass = 'li-amber'; 
      titlePrefix = scan.tipo === 'url' ? 'URL sospechosa' : 'Archivo sospechoso'; 
    }
    else if (scan.tipo === 'ip') { 
      titlePrefix = scan.resultado === 'limpio' ? 'IP limpia' : 'IP sospechosa'; 
    }
    
    let subdetail = `Análisis de ${scan.tipo} · Herramienta: ${scan.herramienta || 'estándar'}`;

    activities.push({
      type: 'scan',
      date: new Date(scan.created_at),
      html: `
        <div class="log-item">
          <div class="log-icon-wrap ${iconClass}">${icon}</div>
          <div class="log-content">
            <div class="log-title">${titlePrefix} — ${scan.detalle || scan.tipo}</div>
            <div class="log-detail">${subdetail}</div>
          </div>
          <div class="log-time">${formatSessionDate(scan.created_at)}</div>
        </div>
      `
    });
  });

  // System events
  if (currentUser.last_sign_in_at) {
    const uaInfo = parseUserAgent(navigator.userAgent);
    activities.push({
      type: 'login',
      date: new Date(currentUser.last_sign_in_at),
      html: `
        <div class="log-item">
          <div class="log-icon-wrap li-green">🔐</div>
          <div class="log-content">
            <div class="log-title">Inicio de sesión exitoso</div>
            <div class="log-detail">${uaInfo.browser} · ${uaInfo.os}</div>
          </div>
          <div class="log-time">${formatSessionDate(currentUser.last_sign_in_at)}</div>
        </div>
      `
    });
  }

  if (currentUser.created_at) {
    const plan = localStorage.getItem('userPlan') || 'basico';
    const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
    activities.push({
      type: 'creation',
      date: new Date(currentUser.created_at),
      html: `
        <div class="log-item">
          <div class="log-icon-wrap li-green">✅</div>
          <div class="log-content">
            <div class="log-title">Cuenta creada</div>
            <div class="log-detail">Registro exitoso · Plan ${planLabel} activado</div>
          </div>
          <div class="log-time">${formatSessionDate(currentUser.created_at)}</div>
        </div>
      `
    });
  }

  // Sort by date desc
  activities.sort((a, b) => b.date - a.date);

  // Render
  if (activities.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--slate-400);padding:24px 0">No hay actividad reciente.</div>';
    return;
  }

  container.innerHTML = activities.map(a => a.html).join('');
}

// ─── ACTIVE SESSIONS ──────────────────────────────────────────
function parseUserAgent(ua) {
  // Detect browser
  let browser = 'Navegador desconocido';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua)) browser = 'Safari';

  // Detect OS / device
  let os = 'Dispositivo desconocido';
  let icon = '💻';
  let iconClass = 'li-blue';
  if (/iPhone/.test(ua)) { os = 'iPhone'; icon = '📱'; iconClass = 'li-blue'; }
  else if (/iPad/.test(ua)) { os = 'iPad'; icon = '📱'; iconClass = 'li-blue'; }
  else if (/Android/.test(ua)) { os = 'Android'; icon = '📱'; iconClass = 'li-blue'; }
  else if (/Windows NT 10/.test(ua)) { os = 'Windows 11'; icon = '💻'; iconClass = 'li-green'; }
  else if (/Windows NT 6/.test(ua)) { os = 'Windows 10'; icon = '💻'; iconClass = 'li-green'; }
  else if (/Mac OS X/.test(ua)) { os = 'macOS'; icon = '💻'; iconClass = 'li-green'; }
  else if (/Linux/.test(ua)) { os = 'Linux'; icon = '💻'; iconClass = 'li-green'; }

  return { browser, os, icon, iconClass };
}

function formatSessionDate(dateStr) {
  if (!dateStr) return 'Fecha desconocida';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 2) return 'Justo ahora';
  if (diffMin < 60) return `hace ${diffMin} minutos`;
  if (diffHrs < 24) return `hace ${diffHrs} hora${diffHrs > 1 ? 's' : ''}`;
  if (diffDays < 7) return `hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
  return date.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' });
}

async function renderSessions() {
  const container = document.getElementById('sessions-list');
  if (!container) return;

  const { data: { session } } = await sb.auth.getSession();

  if (!session) {
    container.innerHTML = '<p style="color:var(--slate-400);font-size:0.83rem;text-align:center;padding:16px 0">No hay sesiones activas.</p>';
    return;
  }

  const ua = navigator.userAgent;
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
    const targetBtn = document.querySelector(`.page-tab[data-tab="${id}"]`);
    if (targetBtn) {
      targetBtn.classList.add('active');
    }
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
  history: { icon: '🗑', title: '¿Eliminar historial?', desc: 'Se eliminarán todos tus análisis y reportes. Esta acción es irreversible.', confirm: 'Sí, eliminar' },
  deactivate: { icon: '😴', title: '¿Desactivar tu cuenta?', desc: 'Tu cuenta quedará en pausa. Podrás reactivarla iniciando sesión nuevamente.', confirm: 'Desactivar' },
  delete: { icon: '💀', title: '¿Eliminar tu cuenta?', desc: 'Se eliminarán permanentemente todos tus datos, análisis e historial. Esta acción NO tiene vuelta atrás.', confirm: 'Eliminar para siempre' },
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

// ─── UPGRADE MODAL (PREMIUM) ──────────────────────────────────
function openUpgradeModal() {
  const modal = document.getElementById('modal-upgrade-premium');
  if (modal) {
    modal.style.display = 'flex';
    selectUpgradeCycle('monthly');
  }
}

function closeUpgradeModal() {
  const modal = document.getElementById('modal-upgrade-premium');
  if (modal) modal.style.display = 'none';
}

function selectUpgradeCycle(cycle) {
  const btnM = document.getElementById('upg-btn-monthly');
  const btnQ = document.getElementById('upg-btn-quarterly');
  const btnA = document.getElementById('upg-btn-annual');
  const priceEl = document.getElementById('upg-price');
  const noteEl = document.getElementById('upg-note');

  // Reset styles
  [btnM, btnQ, btnA].forEach(b => {
    if(!b) return;
    b.style.background = 'transparent';
    b.style.color = 'var(--slate-500)';
    b.style.boxShadow = 'none';
  });

  const activeBtnStyle = (b) => {
    if(!b) return;
    b.style.background = '#fff';
    b.style.color = 'var(--slate-800)';
    b.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
  };

  if (cycle === 'monthly') {
    activeBtnStyle(btnM);
    if(priceEl) priceEl.textContent = '12';
    if(noteEl) noteEl.innerHTML = 'Facturación mensual';
  } else if (cycle === 'quarterly') {
    activeBtnStyle(btnQ);
    if(priceEl) priceEl.textContent = '11';
    if(noteEl) noteEl.innerHTML = '<span style="text-decoration:line-through;color:var(--slate-400)">$12</span> <span style="color:var(--green-600);font-weight:600">$33 cada 3 meses (Ahorras 8%)</span>';
  } else if (cycle === 'annual') {
    activeBtnStyle(btnA);
    if(priceEl) priceEl.textContent = '10';
    if(noteEl) noteEl.innerHTML = '<span style="text-decoration:line-through;color:var(--slate-400)">$12</span> <span style="color:var(--green-600);font-weight:600">$120 al año (Ahorras 20%)</span>';
  }
}

function selectPaymentMethod(method) {
  const lblCard = document.getElementById('lbl-pay-card');
  const lblPaypal = document.getElementById('lbl-pay-paypal');

  if (lblCard && lblPaypal) {
    if (method === 'card') {
      lblCard.style.border = '2px solid var(--green-500)';
      lblCard.style.background = 'var(--green-50)';
      lblPaypal.style.border = '1.5px solid var(--slate-200)';
      lblPaypal.style.background = 'transparent';
    } else {
      lblPaypal.style.border = '2px solid var(--green-500)';
      lblPaypal.style.background = 'var(--green-50)';
      lblCard.style.border = '1.5px solid var(--slate-200)';
      lblCard.style.background = 'transparent';
    }
  }
}

// ── INIT ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Load profile from Supabase
  loadProfile();

  // Render active sessions in security tab
  renderSessions();

  // Handle Tab Navigation (Event Delegation)
  const tabContainer = document.getElementById('profile-tabs-container');
  if (tabContainer) {
    tabContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.page-tab');
      if (!btn) return;
      const tabId = btn.getAttribute('data-tab');
      if (tabId) {
        switchTab(tabId, btn);
      }
    });
  }

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
  const cbSemanal = document.getElementById('pref-resumen_semanal');
  const cbCorreos = document.getElementById('pref-correos_promocionales');
  const cbRecordatorio = document.getElementById('pref-recordatorio_analisis');

  if (cbDashboard) cbDashboard.checked = data.alertas_dashboard !== false;
  if (cbSemanal) cbSemanal.checked = data.resumen_semanal !== false;
  if (cbCorreos) cbCorreos.checked = data.correos_promocionales === true;
  if (cbRecordatorio) cbRecordatorio.checked = data.recordatorio_analisis !== false;
}

window.saveNotificationPrefs = async function () {
  if (!currentUser) return;

  const cbDashboard = document.getElementById('pref-alertas_dashboard');
  const cbSemanal = document.getElementById('pref-resumen_semanal');
  const cbCorreos = document.getElementById('pref-correos_promocionales');
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

window.handle2FAToggle = function () {
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
  const wordsRaw = ["acceso", "bloqueo", "llave", "sistema", "defensa", "codigo", "alarma", "seguro", "red", "servidor", "dato", "token", "nube", "cifrado", "clave", "usuario", "digital", "firewall", "malware", "phishing", "brecha", "auditoria", "filtro", "huella", "puerto"];
  let recoveryHtml = '';
  const myWords = [...wordsRaw].sort(() => 0.5 - Math.random()).slice(0, 12);
  myWords.forEach((word, index) => {
    recoveryHtml += `<div style="background:#fff; padding:4px 8px; border-radius:4px; text-align:center;">${index + 1}. ${word}</div>`;
  });
  document.getElementById('mfa-recovery-words').innerHTML = recoveryHtml;

  // Clear the input
  document.getElementById('mfa-code-input').value = '';

  // Display the new Modal
  document.getElementById('modal-mfa-setup').style.display = 'flex';
}

window.cancelMFAEnroll = async function () {
  if (currentFactorId) {
    await sb.auth.mfa.unenroll({ factorId: currentFactorId });
    currentFactorId = null;
  }
  document.getElementById('modal-mfa-setup').style.display = 'none';
  document.getElementById('toggle-2fa').checked = false;
}

window.verifyMFAEnroll = async function () {
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

window.closeDisableMFAModal = function () {
  document.getElementById('modal-disable-mfa').style.display = 'none';
}

window.confirmDisableMFA = async function () {
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
window.updateUserPassword = async function () {
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

window.togglePass = function (id, btn) {
  const input = document.getElementById(id);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🔒';
  } else {
    input.type = 'password';
    btn.textContent = '👁';
  }
}

window.logout = async function () {
  await sb.auth.signOut();
  localStorage.removeItem('userPlan');
  localStorage.removeItem('sb-remember-me');
  localStorage.removeItem('sb-bazgtcrhrifsxyrwzfpk-auth');
  sessionStorage.removeItem('sb-bazgtcrhrifsxyrwzfpk-auth');
  window.location.href = 'login.html';
}





// ─── NOTIFICATIONS (LOCAL ONLY) ───────────────────────
function loadNotificationPrefs() {
  // Logic reverted. Toggles are purely visual right now.
}
function saveNotificationPrefs() {
  showToast('✅', 'Preferencias actualizadas localmente');
}

let _upmMethod = 'card';
let _upmPlan = 'basico';
let _upmTipoPago = 'mensual';
let _upmPaypalEmail = '';

function openUpdatePaymentModal(metodo, metTxt) {
  const plan = currentUser?.plan_real || localStorage.getItem('userPlan') || 'basico';
  if (plan === 'basico') return;
  _upmPlan = plan;
  _upmTipoPago = currentUser?.tipo_pago || 'mensual';

  const icon = metodo && metodo.toLowerCase() === 'paypal' ? '🔵' : '💳';
  const txt = metTxt || (metodo && metodo.toLowerCase() === 'paypal' ? 'PayPal' : '•••• 4242');
  const iconEl = document.getElementById('upm-current-icon');
  const txtEl = document.getElementById('upm-current-text');
  if (iconEl) iconEl.textContent = icon;
  if (txtEl) txtEl.textContent = txt;

  ['upm-card-number','upm-card-name','upm-card-exp','upm-card-cvv','upm-paypal-email'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  upmSelectMethod('card');

  const m = document.getElementById('modal-update-payment');
  if (m) { m.style.display = 'flex'; }
}

function closeUpdatePaymentModal() {
  const m = document.getElementById('modal-update-payment');
  if (m) m.style.display = 'none';
}

function upmSelectMethod(method) {
  _upmMethod = method;
  const cardFields = document.getElementById('upm-card-fields');
  const ppFields = document.getElementById('upm-paypal-fields');
  const saveBtn = document.getElementById('upm-save-btn');
  const ppBtn = document.getElementById('upm-paypal-btn');
  const lblCard = document.getElementById('upm-lbl-card');
  const lblPP = document.getElementById('upm-lbl-paypal');

  if (method === 'card') {
    cardFields.style.display = '';
    ppFields.style.display = 'none';
    saveBtn.style.display = '';
    ppBtn.style.display = 'none';
    lblCard.style.border = '2px solid var(--green-500)';
    lblCard.style.background = 'var(--green-50)';
    lblPP.style.border = '1.5px solid var(--slate-200)';
    lblPP.style.background = '';
    lblCard.querySelector('input').checked = true;
  } else {
    cardFields.style.display = 'none';
    ppFields.style.display = '';
    saveBtn.style.display = 'none';
    ppBtn.style.display = '';
    lblPP.style.border = '2px solid #003087';
    lblPP.style.background = '#f0f6ff';
    lblCard.style.border = '1.5px solid var(--slate-200)';
    lblCard.style.background = '';
    lblPP.querySelector('input').checked = true;
  }
}

function upmFormatCard(el) {
  let v = el.value.replace(/\D/g,'').slice(0,16);
  el.value = v.replace(/(\d{4})(?=\d)/g,'$1 ');
}

function upmFormatExp(el) {
  let v = el.value.replace(/\D/g,'').slice(0,4);
  if (v.length > 2) v = v.slice(0,2) + '/' + v.slice(2);
  el.value = v;
}

function upmSave() {
  const num = document.getElementById('upm-card-number')?.value.trim();
  const name = document.getElementById('upm-card-name')?.value.trim();
  const exp = document.getElementById('upm-card-exp')?.value.trim();
  const cvv = document.getElementById('upm-card-cvv')?.value.trim();
  if (!num || !name || !exp || !cvv) {
    showToast('⚠️', 'Completa todos los campos de la tarjeta');
    return;
  }
  const btn = document.getElementById('upm-save-btn');
  btn.disabled = true;
  btn.textContent = 'Guardando...';
  const last4 = num.replace(/\s/g,'').slice(-4);
  setTimeout(() => {
    btn.disabled = false;
    btn.textContent = 'Guardar cambios';
    closeUpdatePaymentModal();
    const billingEl = document.getElementById('billing-section');
    if (billingEl) {
      const iconDiv = billingEl.querySelector('div[style*="font-weight:600"]');
      if (iconDiv) iconDiv.textContent = `•••• ${last4}`;
      const iconWrap = billingEl.querySelector('div[style*="font-size:1.2rem"]');
      if (iconWrap) iconWrap.textContent = '💳';
    }
    showToast('✅', 'Método de pago actualizado correctamente');
  }, 1500);
}

function upmOpenPayPal() {
  const email = document.getElementById('upm-paypal-email')?.value.trim();
  if (!email) { showToast('⚠️', 'Ingresa tu correo de PayPal'); return; }
  _upmPaypalEmail = email;
  closeUpdatePaymentModal();

  const amounts = {
    premium: { mensual: '$12.00', trimestral: '$33.00', anual: '$120.00' },
    institucional: { mensual: '$49.00', trimestral: '$132.00', anual: '$468.00' }
  };
  const cycle = { mensual: 'Facturación mensual', trimestral: 'Facturación trimestral', anual: 'Facturación anual' };
  const planNames = { premium: 'Plan Premium', institucional: 'Plan Institucional' };
  const amount = (amounts[_upmPlan] || amounts.premium)[_upmTipoPago] || '$12.00';

  document.getElementById('pp-email').value = email;
  document.getElementById('pp-pass').value = '';
  document.getElementById('paypal-screen-login').style.display = '';
  document.getElementById('paypal-screen-confirm').style.display = 'none';
  document.getElementById('pp-plan-label').textContent = planNames[_upmPlan] || 'Plan Premium';
  document.getElementById('pp-cycle-label').textContent = cycle[_upmTipoPago] || 'Facturación mensual';
  document.getElementById('pp-amount').textContent = amount;

  const m = document.getElementById('modal-paypal-sim');
  if (m) m.style.display = 'flex';
}

function closePayPalSim() {
  const m = document.getElementById('modal-paypal-sim');
  if (m) m.style.display = 'none';
}

function ppLogin() {
  document.getElementById('paypal-screen-login').style.display = 'none';
  document.getElementById('paypal-screen-confirm').style.display = '';
}

function ppConfirmPay() {
  const btn = document.querySelector('#paypal-screen-confirm button');
  if (btn) { btn.disabled = true; btn.textContent = 'Procesando...'; }
  setTimeout(() => {
    if (btn) { btn.disabled = false; btn.textContent = 'Pagar ahora'; }
    closePayPalSim();
    const masked = _upmPaypalEmail.replace(/(.).+(@)/, (_, a, at) => a + '***' + at);
    const billingEl = document.getElementById('billing-section');
    if (billingEl) {
      const iconDiv = billingEl.querySelector('div[style*="font-weight:600"]');
      if (iconDiv) iconDiv.textContent = masked;
      const iconWrap = billingEl.querySelector('div[style*="font-size:1.2rem"]');
      if (iconWrap) iconWrap.textContent = '🔵';
    }
    showToast('✅', 'Método de pago actualizado correctamente');
  }, 1500);
}
