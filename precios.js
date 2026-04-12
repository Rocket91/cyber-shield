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

// Billing toggle 3-state
let currentBilling = 'monthly'; // monthly, quarterly, annual
const prices = {
  basic:   { monthly: 0,  quarterly: 0,  annual: 0  },
  premium: { monthly: 12, quarterly: 11, annual: 10 },
  inst:    { monthly: null, quarterly: 44, annual: 39 }, 
};

function setBilling(mode) {
  currentBilling = mode;
  
  // UI Switcher
  const options = document.querySelectorAll('.switch-opt');
  const indicator = document.querySelector('.switch-indicator');
  const saveChip = document.getElementById('save-chip');
  
  let activeIndex = 0;
  options.forEach((opt, i) => {
    if (opt.dataset.billing === mode) {
      opt.classList.add('active');
      activeIndex = i;
    } else {
      opt.classList.remove('active');
    }
  });

  // Animate indicator
  const activeBtn = options[activeIndex];
  indicator.style.width = `${activeBtn.offsetWidth}px`;
  indicator.style.transform = `translateX(${activeBtn.offsetLeft - 4}px)`;

  // Update save chip
  if (saveChip) {
    if (mode === 'quarterly') {
      saveChip.textContent = 'Ahorra 8%';
      saveChip.style.opacity = '1';
    } else if (mode === 'annual') {
      saveChip.textContent = 'Ahorra 20%';
      saveChip.style.opacity = '1';
    } else {
      saveChip.style.opacity = '0';
    }
  }

  // Update DOM elements
  const priceBasic = document.getElementById('price-basic');
  const pricePremium = document.getElementById('price-premium');
  const priceInst = document.getElementById('price-inst');

  if (priceBasic) priceBasic.textContent = prices.basic[mode];
  if (pricePremium) pricePremium.textContent = prices.premium[mode];
  
  // Handle Institutional null (no monthly)
  if (priceInst) {
    const val = prices.inst[mode];
    if (val === null) {
      priceInst.textContent = '---';
      priceInst.parentElement.classList.add('no-price');
    } else {
      priceInst.textContent = val;
      priceInst.parentElement.classList.remove('no-price');
    }
  }

  // Update notes
  const notePremium = document.getElementById('note-premium');
  const noteInst = document.getElementById('note-inst');

  if (notePremium) {
    if (mode === 'monthly') notePremium.textContent = 'Facturación mensual';
    else if (mode === 'quarterly') notePremium.innerHTML = '<span class="strike">$12</span> → <span class="save">$11/mes · $33 cada 3 meses</span>';
    else notePremium.innerHTML = '<span class="strike">$12</span> → <span class="save">$10/mes · Ahorras $24/año</span>';
  }

  if (noteInst) {
    if (mode === 'monthly') noteInst.innerHTML = '<span style="color:var(--red-500);font-weight:600">Solo disponible en pago trimestral o anual</span>';
    else if (mode === 'quarterly') noteInst.innerHTML = '<span class="strike">$49</span> → <span class="save">$44/mes · $132 cada 3 meses</span>';
    else noteInst.innerHTML = '<span class="strike">$49</span> → <span class="save">$39/mes · Ahorras $120/año</span>';
  }
}

// Iniciar posición del switch
document.addEventListener('DOMContentLoaded', () => {
  setBilling('monthly');
  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
});

// Billing key → tipo_pago (Spanish DB values)
const billingToTipo = { monthly: 'mensual', quarterly: 'trimestral', annual: 'anual' };

// Institucional click handler: block monthly, open login for trimestral/anual
function handleInstClick() {
  if (currentBilling === 'monthly') {
    // Flash the note with an error
    const note = document.getElementById('note-inst');
    if (note) {
      note.innerHTML = '<span style="color:#ef4444;font-weight:700">⚠ Plan Institucional requiere pago Trimestral o Anual</span>';
      setTimeout(() => setBilling('monthly'), 3000); // reset after 3s
    }
    // Shake the button
    const btn = document.getElementById('btn-institucional');
    if (btn) {
      btn.style.animation = 'none';
      btn.classList.add('shake-error');
      setTimeout(() => btn.classList.remove('shake-error'), 600);
    }
    return;
  }
  const tipo = billingToTipo[currentBilling] || 'trimestral';
  window.open(`login_pyme.html?plan=institucional&tipo=${tipo}`, '_blank');
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
