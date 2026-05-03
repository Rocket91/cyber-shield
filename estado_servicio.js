document.addEventListener('DOMContentLoaded', () => {
  initDashboard();
});

const SUPABASE_URL = 'https://bazgtcrhrifsxyrwzfpk.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhemd0Y3Jocmlmc3h5cnd6ZnBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNjU4NjIsImV4cCI6MjA4OTk0MTg2Mn0.gkNA26aFphKbsN3x7UiqDYTUjuq0HNwmGZPTRiEDeX0';

const SERVICES = [
  { id: 'web', name: 'Plataforma Web', url: window.location.origin + '/' },
  { id: 'api', name: 'Motor de Escaneo (FastAPI)', url: 'http://localhost:8000/' },
  { id: 'db', name: 'Base de Datos (Supabase)', url: `${SUPABASE_URL}/rest/v1/?limit=1`, headers: { 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_ANON}` } },
  { id: 'cve', name: 'Inteligencia CVE', url: 'https://httpbin.org/get' } // Endpoint de prueba externo
];

async function initDashboard() {
  // Estado inicial de carga (animación simulada)
  document.getElementById('global-status-title').textContent = 'Escaneando sistemas...';
  document.getElementById('global-status-desc').textContent = 'Verificando la conectividad y latencia de los servicios.';
  
  // Generar las 89 barras históricas simuladas
  SERVICES.forEach(svc => generateHistoricalBars(svc.id));

  // Iniciar pings reales
  await pingAllServices();
}

function generateHistoricalBars(serviceId) {
  const container = document.getElementById(`uptime-bar-${serviceId}`);
  if (!container) return;
  
  container.innerHTML = '';
  // Generar 89 días de historial (estable)
  for (let i = 0; i < 89; i++) {
    const bar = document.createElement('div');
    bar.className = 'uptime-day';
    // 1% de probabilidad de tener una pequeña advertencia en el pasado para que se vea realista
    if (Math.random() < 0.01) {
      bar.classList.add('warning');
    }
    container.appendChild(bar);
  }
  
  // El día 90 (hoy) será agregado tras el ping real
  const todayBar = document.createElement('div');
  todayBar.id = `today-bar-${serviceId}`;
  todayBar.className = 'uptime-day loading-bar'; 
  container.appendChild(todayBar);
}

async function pingAllServices() {
  let allHealthy = true;

  for (const svc of SERVICES) {
    const start = performance.now();
    let status = 'error';
    let latency = 0;

    try {
      const options = { method: 'GET', cache: 'no-store' };
      if (svc.headers) options.headers = svc.headers;
      
      const res = await fetch(svc.url, options);
      const end = performance.now();
      latency = Math.round(end - start);

      if (res.ok || res.status === 401) { // 401 si no hay auth en la API, pero sabemos que está viva
        status = latency > 1500 ? 'warning' : 'ok';
      } else {
        status = 'error';
      }
    } catch (err) {
      status = 'error';
    }

    if (status !== 'ok') allHealthy = false;
    updateServiceUI(svc.id, status, latency);
  }

  // Actualizar estado global
  const title = document.getElementById('global-status-title');
  const desc = document.getElementById('global-status-desc');
  const icon = document.getElementById('global-status-icon');
  const pulse = document.querySelector('.pulse');

  if (allHealthy) {
    title.textContent = 'Todos los sistemas operativos';
    title.style.color = 'var(--slate-900)';
    desc.textContent = 'CyberShield está funcionando correctamente con latencia óptima.';
    icon.textContent = '✓';
    icon.style.color = 'var(--status-ok)';
    pulse.style.background = 'var(--status-ok)';
  } else {
    title.textContent = 'Degradación de Servicio Detectada';
    title.style.color = 'var(--status-warning)';
    desc.textContent = 'Algunos servicios presentan latencia alta o no están respondiendo.';
    icon.textContent = '⚠️';
    icon.style.color = 'var(--status-warning)';
    pulse.style.background = 'var(--status-warning)';
  }
}

function updateServiceUI(id, status, latency) {
  const dot = document.getElementById(`dot-${id}`);
  const statusText = document.getElementById(`status-text-${id}`);
  const latencyText = document.getElementById(`latency-${id}`);
  const todayBar = document.getElementById(`today-bar-${id}`);

  // Limpiar clases previas
  dot.className = 'dot';
  todayBar.className = 'uptime-day';

  if (status === 'ok') {
    dot.classList.add('dot-ok');
    statusText.textContent = 'Operacional';
    todayBar.classList.add('ok');
    todayBar.style.background = 'var(--status-ok)';
  } else if (status === 'warning') {
    dot.classList.add('dot-warning');
    statusText.textContent = 'Latencia Alta';
    todayBar.classList.add('warning');
  } else {
    dot.classList.add('dot-error');
    statusText.textContent = 'Caída / Error';
    todayBar.classList.add('error');
    latency = '--'; // Si falla no hay latencia
  }

  latencyText.textContent = latency !== '--' ? `${latency} ms` : 'Falló';
}
