// modulo_personal.js

document.addEventListener('DOMContentLoaded', () => {
  verificarAcceso();
});

async function verificarAcceso() {
  try {
    const { createClient } = supabase;
    const _rememberMe = localStorage.getItem('sb-remember-me') === '1';
    const sb = _rememberMe
      ? createClient('https://bazgtcrhrifsxyrwzfpk.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhemd0Y3Jocmlmc3h5cnd6ZnBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNjU4NjIsImV4cCI6MjA4OTk0MTg2Mn0.gkNA26aFphKbsN3x7UiqDYTUjuq0HNwmGZPTRiEDeX0')
      : createClient('https://bazgtcrhrifsxyrwzfpk.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhemd0Y3Jocmlmc3h5cnd6ZnBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNjU4NjIsImV4cCI6MjA4OTk0MTg2Mn0.gkNA26aFphKbsN3x7UiqDYTUjuq0HNwmGZPTRiEDeX0', {
        auth: { storage: sessionStorage, storageKey: 'sb-bazgtcrhrifsxyrwzfpk-auth', autoRefreshToken: true, persistSession: true }
      });
    const { data: { user } } = await sb.auth.getUser();
    if (user) {
      const { data: perfil } = await sb.from('perfiles').select('nombre,apellido').eq('id', user.id).maybeSingle();
      if (perfil) {
        const nombre = perfil.nombre || '';
        const apellido = perfil.apellido || '';
        const _tav = document.getElementById('topbar-avatar');
        if (_tav) _tav.textContent = ((nombre[0] || '') + (apellido[0] || '')).toUpperCase();
      }
    }
  } catch (e) { }

  const userPlan = localStorage.getItem('userPlan') || 'basico';

  if (userPlan === 'institucional') {
    document.getElementById('module-content').style.display = 'block';
    document.getElementById('module-blocked').style.display = 'none';
  } else {
    document.getElementById('module-content').style.display = 'none';
    document.getElementById('module-blocked').style.display = 'block';
  }
}

function toggleFormFields() {
  const selectedType = document.querySelector('input[name="integ-type"]:checked').value;

  document.getElementById('fields-api').style.display = selectedType === 'api' ? 'flex' : 'none';
  document.getElementById('fields-webhook').style.display = selectedType === 'webhook' ? 'flex' : 'none';
  document.getElementById('fields-script').style.display = selectedType === 'script' ? 'flex' : 'none';
}

function guardarConfiguracion() {
  const selectedType = document.querySelector('input[name="integ-type"]:checked').value;
  let valid = true;

  // Validación básica de campos requeridos
  if (selectedType === 'api') {
    if (!document.getElementById('api-url').value) valid = false;
    if (!document.getElementById('api-key').value) valid = false;
  } else if (selectedType === 'webhook') {
    if (!document.getElementById('webhook-url').value) valid = false;
  } else if (selectedType === 'script') {
    if (!document.getElementById('script-code').value) valid = false;
  }

  if (!valid) {
    alert('Por favor, completa los campos requeridos para continuar.');
    return;
  }

  // Simular guardado
  const btnSubmit = document.querySelector('button[type="submit"]');
  const originalText = btnSubmit.textContent;
  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Guardando...';

  setTimeout(() => {
    btnSubmit.disabled = false;
    btnSubmit.textContent = originalText;

    // Mostrar mensaje de éxito
    const successMsg = document.getElementById('success-msg');
    successMsg.style.display = 'block';

    // Ocultar mensaje después de 3 segundos
    setTimeout(() => {
      successMsg.style.display = 'none';
    }, 3000);
  }, 800);
}
