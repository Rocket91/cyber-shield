const { createClient } = supabase;
const SUPABASE_URL = 'https://bazgtcrhrifsxyrwzfpk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhemd0Y3Jocmlmc3h5cnd6ZnBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNjU4NjIsImV4cCI6MjA4OTk0MTg2Mn0.gkNA26aFphKbsN3x7UiqDYTUjuq0HNwmGZPTRiEDeX0';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

sb.auth.onAuthStateChange(async (event, session) => {
  if (event == "PASSWORD_RECOVERY") {
    // La sesión actual permite actualizar la contraseña
    console.log("Recuperación de contraseña en curso...");
  }
});

function togglePass(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
    btn.style.color = 'var(--green-500)';
  } else {
    input.type = 'password';
    btn.style.color = 'var(--slate-400)';
  }
}

function setError(inputId, idError, isError) {
  const input = document.getElementById(inputId);
  const errBox = document.getElementById(idError);
  if (isError) {
    input.classList.add('error');
    errBox.classList.add('show');
  } else {
    input.classList.remove('error');
    errBox.classList.remove('show');
  }
}

function showAlert(id, type, msg) {
  const box = document.getElementById(id);
  box.className = 'alert-box ' + type + ' show';
  box.innerHTML = type === 'success' ? `<span>✓</span> ${msg}` : `<span>⚠</span> ${msg}`;
}

async function submitReset() {
  const newPass = document.getElementById('new-pass').value;
  const confirmPass = document.getElementById('confirm-pass').value;

  setError('new-pass', 'err-new-pass', newPass.length < 8);
  if (newPass.length < 8) return;

  setError('confirm-pass', 'err-confirm-pass', newPass !== confirmPass);
  if (newPass !== confirmPass) return;

  const btn = document.getElementById('btn-reset');
  btn.classList.add('loading');

  const { data, error } = await sb.auth.updateUser({ password: newPass });

  btn.classList.remove('loading');

  if (error) {
    showAlert('reset-alert', 'error', error.message || 'Hubo un error al restablecer tu contraseña. El enlace puede haber caducado.');
    return;
  }

  showAlert('reset-alert', 'success', '¡Contraseña actualizada con éxito! Redirigiendo al inicio de sesión...');
  
  // Cerrar la sesión iniciada automáticamente por la recuperación (opcional, pero buena práctica)
  await sb.auth.signOut();

  setTimeout(() => {
    window.location.href = 'login.html';
  }, 3000);
}
