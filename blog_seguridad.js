// ─── DATOS DE ARTÍCULOS ──────────────────────────────────────────
const articles = {
  'attacks-rd': {
    title: 'RD bajo fuego digital: 233 millones de ataques en 2026',
    category: 'Amenazas Locales',
    date: 'Abril 10, 2026',
    image: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=800',
    content: `
      <p>La República Dominicana se ha consolidado como uno de los objetivos principales de la ciberdelincuencia en la región del Caribe. Según el informe trimestral de CyberShield, se han registrado más de <strong>233 millones de intentos de ataques</strong> en los primeros 90 días del año 2026.</p>
      
      <h3>Análisis de Vectores de Ataque</h3>
      <p>El incremento del 45% respecto al año anterior se debe principalmente a la proliferación de botnets automatizadas que buscan vulnerabilidades en servicios expuestos de la administración pública y el sector financiero. Los vectores principales identificados son:</p>
      <ul>
        <li><strong>Ataques de Fuerza Bruta (RDP/SSH):</strong> 62% de los intentos, dirigidos a servidores de teletrabajo mal configurados.</li>
        <li><strong>Ransomware as a Service (RaaS):</strong> Campañas dirigidas a PYMES dominicanas utilizando variantes evolucionadas de LockBit.</li>
        <li><strong>Explotación de Zero-Days:</strong> Intentos detectados contra infraestructuras críticas de energía y agua.</li>
      </ul>

      <h3>Impacto en la Economía Local</h3>
      <p>Se estima que las pérdidas económicas acumuladas por interrupción de servicios y rescates pagados ascienden a millones de pesos. CyberShield recomienda a las instituciones dominicanas implementar arquitecturas de <em>Zero Trust</em> y reforzar el monitoreo 24/7 de sus perímetros digitales.</p>
    `
  },
  'vishing-guide': {
    title: 'Vishing y Phishing Bancario: Guía bajo Normativa de la SB',
    category: 'Guías Técnicas',
    date: 'Abril 05, 2026',
    image: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&q=80&w=800',
    content: `
      <p>El fraude bancario ha evolucionado hacia técnicas de ingeniería social altamente sofisticadas. En respuesta, la <strong>Superintendencia de Bancos (SB)</strong> ha emitido nuevas normativas para reforzar la protección del usuario financiero.</p>
      
      <h3>Identificando el Vishing (Voice Phishing)</h3>
      <p>Los atacantes ahora utilizan Inteligencia Artificial para clonar voces de ejecutivos bancarios conocidos. Según la normativa vigente:</p>
      <ul>
        <li>Ninguna entidad bancaria solicitará nunca códigos OTP, tokens o contraseñas por llamada telefónica.</li>
        <li>Si recibe una llamada "urgente" sobre un bloqueo de cuenta, cuelgue y llame usted mismo al número oficial del banco.</li>
        <li>Desconfíe de llamadas que soliciten realizar transferencias de "prueba" para desbloquear fondos.</li>
      </ul>

      <h3>Protocolo de Acción ante Sospechas</h3>
      <p>Si cree haber sido víctima de una campaña de phishing bancario local, debe reportar el incidente inmediatamente a través de la plataforma <strong>ProUsuario</strong> y proceder con el bloqueo preventivo de sus credenciales digitales.</p>
    `
  },
  'indotel-dni': {
    title: 'Acuerdo INDOTEL-DNI: El escudo para infraestructuras críticas',
    category: 'Seguridad Nacional',
    date: 'Marzo 28, 2026',
    image: 'Imagenes/infraestructura.png',
    content: `
      <p>El reciente acuerdo estratégico firmado entre el <strong>Instituto Dominicano de las Telecomunicaciones (INDOTEL)</strong> y la <strong>Dirección Nacional de Inteligencia (DNI)</strong> marca un hito en la defensa nacional.</p>
      
      <h3>Protección de Redes Críticas</h3>
      <p>Este marco de cooperación establece estándares de ciberseguridad obligatorios para todos los proveedores de servicios de telecomunicaciones que operan en territorio nacional. Los puntos clave del acuerdo incluyen:</p>
      <ul>
        <li><strong>Intercambio de Inteligencia en Tiempo Real:</strong> Creación de un canal seguro para reportar amenazas a la infraestructura de fibra óptica y redes 5G/6G.</li>
        <li><strong>Auditorías de Seguridad Obligatorias:</strong> Evaluaciones técnicas semestrales a los centros de datos que albergan información sensible del Estado.</li>
        <li><strong>Respuesta a Incidentes Nacionales:</strong> Protocolos coordinados para mitigar ataques distribuidos de denegación de servicio (DDoS) que puedan afectar la conectividad del país.</li>
      </ul>

      <h3>Soberanía Digital</h3>
      <p>El análisis técnico de CyberShield indica que este acuerdo es fundamental para garantizar la resiliencia del país ante conflictos híbridos y espionaje corporativo internacional, protegiendo los activos digitales que sustentan la economía dominicana.</p>
    `
  }
};

// ─── LÓGICA DEL MODAL ──────────────────────────────────────────
const modal = document.getElementById('blog-modal');
const modalContent = document.getElementById('modal-body-content');
const closeModalBtn = document.getElementById('close-modal');

// Abrir Modal
document.querySelectorAll('.blog-card').forEach(card => {
  card.addEventListener('click', () => {
    const articleId = card.getAttribute('data-article');
    const data = articles[articleId];

    if (data) {
      modalContent.innerHTML = `
        <div class="modal-header-img" style="background-image: url('${data.image}')"></div>
        <div class="modal-inner-content">
          <div class="modal-meta">
            <span>${data.category}</span>
            <span>•</span>
            <span>${data.date}</span>
          </div>
          <h2>${data.title}</h2>
          <div class="modal-text">
            ${data.content}
          </div>
        </div>
      `;
      modal.classList.add('active');
      document.body.style.overflow = 'hidden'; // Evitar scroll de fondo
    }
  });
});

// Cerrar Modal
function closeModal() {
  modal.classList.remove('active');
  document.body.style.overflow = '';
}

closeModalBtn.addEventListener('click', closeModal);

// Cerrar al hacer clic fuera
window.addEventListener('click', (e) => {
  if (e.target === modal) {
    closeModal();
  }
});

// Cerrar con tecla ESC
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal.classList.contains('active')) {
    closeModal();
  }
});

// ─── LÓGICA DEL NEWSLETTER (BACKEND FASTAPI) ──────────────────────────
const BACKEND_URL = 'http://localhost:8000/api/v1/newsletter/subscribe';

const newsletterForm = document.getElementById('newsletter-form');
const emailInput = document.getElementById('newsletter-email');
const submitBtn = document.getElementById('newsletter-submit');
const messageBox = document.getElementById('newsletter-message');

newsletterForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  
  const email = emailInput.value.trim();
  if (!email) return;

  // Cambiar estado del botón
  submitBtn.disabled = true;
  submitBtn.innerText = 'Procesando...';
  messageBox.style.display = 'none';

  try {
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: email })
    });

    if (response.ok) {
      const data = await response.json();
      messageBox.innerText = data.message || '¡Correo de confirmación enviado!';
      
      if (data.status === 'success') {
        messageBox.style.color = '#1db85e'; // Verde CyberShield
      } else {
        messageBox.style.color = '#f59e0b'; // Ámbar si hubo fallo parcial
      }
      emailInput.value = ''; // Limpiar campo
    } else {
      // Manejo de errores desde el backend (ej. correo ya existe = 409)
      const errorData = await response.json();
      
      if (response.status === 409) {
        messageBox.innerText = errorData.detail || 'Este correo ya se encuentra suscrito a nuestro Newsletter.';
        messageBox.style.color = '#f59e0b'; // Ámbar de advertencia
      } else {
        messageBox.innerText = errorData.detail || 'Ocurrió un error al procesar tu suscripción. Intenta nuevamente.';
        messageBox.style.color = '#ef4444'; // Rojo error
      }
    }
  } catch (error) {
    console.error('Error:', error);
    messageBox.innerText = 'Error de conexión con el servidor. Verifica que FastAPI esté en ejecución.';
    messageBox.style.color = '#ef4444';
  } finally {
    // Restaurar estado
    messageBox.style.display = 'block';
    submitBtn.disabled = false;
    submitBtn.innerText = 'Suscribirme';
  }
});
