// Navbar scroll
window.addEventListener('scroll', () => {
  const navbar = document.getElementById('navbar');
  if (navbar) {
    navbar.classList.toggle('scrolled', window.scrollY > 20);
  }
});

// Scroll reveal
const observerOptions = {
  threshold: 0.1
};

const revealObserver = new IntersectionObserver(entries => {
  entries.forEach((e, i) => {
    if (e.isIntersecting) {
      setTimeout(() => e.target.classList.add('visible'), i * 100);
      revealObserver.unobserve(e.target);
    }
  });
}, observerOptions);

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
});

// Billing toggle
let isAnnual = false;
const prices = {
  basic:   { monthly: 0,  annual: 0  },
  premium: { monthly: 12, annual: 10 },
  inst:    { monthly: 49, annual: 39 },
};

function toggleBilling() {
  isAnnual = !isAnnual;
  const btn = document.getElementById('billing-toggle');
  if (btn) btn.classList.toggle('annual', isAnnual);

  const labelMonthly = document.getElementById('label-monthly');
  const labelAnnual = document.getElementById('label-annual');
  const saveChip = document.getElementById('save-chip');

  if (labelMonthly) labelMonthly.classList.toggle('active', !isAnnual);
  if (labelAnnual) labelAnnual.classList.toggle('active', isAnnual);
  if (saveChip) saveChip.style.opacity = isAnnual ? '1' : '0.4';

  // Update prices
  const priceBasic = document.getElementById('price-basic');
  const pricePremium = document.getElementById('price-premium');
  const priceInst = document.getElementById('price-inst');

  if (priceBasic) priceBasic.textContent = prices.basic[isAnnual ? 'annual' : 'monthly'];
  if (pricePremium) pricePremium.textContent = prices.premium[isAnnual ? 'annual' : 'monthly'];
  if (priceInst) priceInst.textContent = prices.inst[isAnnual ? 'annual' : 'monthly'];

  const noteBasic = document.getElementById('note-basic');
  const notePremium = document.getElementById('note-premium');
  const noteInst = document.getElementById('note-inst');

  if (noteBasic) noteBasic.textContent = 'Gratis para siempre';
  if (notePremium) {
    notePremium.innerHTML = isAnnual
      ? '<span class="strike">$12</span> → <span class="save">$10/mes · Ahorras $24/año</span>'
      : 'Facturación mensual';
  }
  if (noteInst) {
    noteInst.innerHTML = isAnnual
      ? '<span class="strike">$49</span> → <span class="save">$39/mes · Ahorras $120/año</span>'
      : 'Facturación mensual';
  }
}

// FAQ
function toggleFaq(item) {
  const isOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item').forEach(f => f.classList.remove('open'));
  if (!isOpen) item.classList.add('open');
}

// Modal
const modalData = {
  premium:      { icon:'⚡', title:'Obtener Premium',       desc:'Accede a 10 herramientas avanzadas, análisis ilimitados y reportes PDF.', btn:'Ir al pago →' },
  institucional:{ icon:'🏢', title:'Plan Institucional',    desc:'Un asesor te contactará para personalizar el plan según las necesidades de tu empresa.', btn:'Enviar solicitud →' },
};
function showModal(type) {
  const d = modalData[type];
  const mIcon = document.getElementById('m-icon');
  const mTitle = document.getElementById('m-title');
  const mDesc = document.getElementById('m-desc');
  const mBtn = document.getElementById('m-btn');
  const ov = document.getElementById('modal-overlay');

  if (d && mIcon && mTitle && mDesc && mBtn && ov) {
    mIcon.textContent = d.icon;
    mTitle.textContent = d.title;
    mDesc.textContent = d.desc;
    mBtn.textContent = d.btn;
    ov.style.display = 'flex';
  }
}
function closeModal() {
  const ov = document.getElementById('modal-overlay');
  if (ov) ov.style.display = 'none';
}
