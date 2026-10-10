(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Preloader (runs on every load/refresh) ---------- */
  const preloader = document.getElementById('preloader');
  const MIN_SHOW = 2200;                         // ms since navigation start, so the animation is always seen
  const MAX_SHOW = 4500;                         // safety: never block the page longer than this
  let preloaderDone = false;

  function finishPreloader() {
    if (preloaderDone) return;
    preloaderDone = true;
    root.classList.remove('loading');
    if (preloader) {
      preloader.classList.add('done');
      setTimeout(() => preloader.remove(), 900);
    }
    initReveal();      // start scroll animations only once the page is actually visible
    updateParallax();
  }
  function onPageReady() {
    setTimeout(finishPreloader, Math.max(0, MIN_SHOW - performance.now()));
  }
  if (document.readyState === 'complete') onPageReady();
  else window.addEventListener('load', onPageReady);
  setTimeout(finishPreloader, MAX_SHOW);

  /* ---------- Header + mobile menu ---------- */
  const header = document.querySelector('.site-header');
  const menuToggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.site-nav');
  const navLinks = nav.querySelectorAll('a');

  const updateHeader = () => header.classList.toggle('scrolled', window.scrollY > 12);
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });

  function closeMenu() {
    nav.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Open navigation menu');
    document.body.classList.remove('menu-open');
  }
  menuToggle.addEventListener('click', () => {
    const opening = menuToggle.getAttribute('aria-expanded') !== 'true';
    menuToggle.setAttribute('aria-expanded', String(opening));
    menuToggle.setAttribute('aria-label', opening ? 'Close navigation menu' : 'Open navigation menu');
    nav.classList.toggle('open', opening);
    document.body.classList.toggle('menu-open', opening);
  });
  navLinks.forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
  window.addEventListener('resize', () => { if (window.innerWidth > 800) closeMenu(); });

  /* ---------- Cake filter ---------- */
  const filterButtons = document.querySelectorAll('.filter-button');
  const cakeCards = document.querySelectorAll('.cake-card');
  filterButtons.forEach(button => button.addEventListener('click', () => {
    const filter = button.dataset.filter;
    filterButtons.forEach(item => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    cakeCards.forEach(card => { card.hidden = filter !== 'all' && card.dataset.category !== filter; });
    requestParallax();
  }));

  /* ---------- Enquiry form ---------- */
  const form = document.getElementById('cake-form');
  const summary = document.getElementById('form-error-summary');
  const dateInput = document.getElementById('event-date');
  const categorySelect = document.getElementById('cake-category');
  const localToday = new Date();
  dateInput.min = `${localToday.getFullYear()}-${String(localToday.getMonth() + 1).padStart(2, '0')}-${String(localToday.getDate()).padStart(2, '0')}`;

  const validators = {
    'customer-name': value => value.trim().length >= 2 ? '' : 'Please enter your name (at least 2 characters).',
    'customer-phone': value => /^[+\d()\s.-]{7,20}$/.test(value.trim()) && value.replace(/\D/g, '').length >= 7 ? '' : 'Please enter a valid contact number.',
    'cake-category': value => value ? '' : 'Please choose a cake category.',
    'event-date': value => value && value >= dateInput.min ? '' : 'Please choose today or a future event date.',
    'design': value => value.trim().length >= 3 ? '' : 'Please share a little about your cake idea.',
    'reference': value => !value.trim() || /^https?:\/\/.+\..+/i.test(value.trim()) ? '' : 'Please enter a complete URL beginning with https:// or http://.'
  };

  // One shared function: runs the validator, shows/clears the message, returns true if valid.
  function validateField(id) {
    const input = document.getElementById(id);
    const error = validators[id](input.value);
    const field = input.closest('.field');
    field.classList.toggle('invalid', Boolean(error));
    const message = field.querySelector('.field-error');
    if (message) message.textContent = error;
    input.setAttribute('aria-invalid', String(Boolean(error)));
    return !error;
  }
  Object.keys(validators).forEach(id => {
    const input = document.getElementById(id);
    const revalidate = () => { if (input.closest('.field').classList.contains('invalid')) validateField(id); };
    input.addEventListener('blur', () => validateField(id));
    input.addEventListener('input', revalidate);
    input.addEventListener('change', revalidate);
  });

  // Clicking a cake card pre-selects the matching category in the form.
  const categoryMap = {
    birthday: 'Birthday & theme cake',
    chocolate: 'Chocolate cake',
    celebration: 'Anniversary & celebration',
    custom: 'Custom creation'
  };
  cakeCards.forEach(card => {
    const link = card.querySelector('.cake-photo');
    if (!link) return;
    link.addEventListener('click', () => {
      const value = categoryMap[card.dataset.category];
      if (!value) return;
      categorySelect.value = value;
      if (categorySelect.closest('.field').classList.contains('invalid')) validateField('cake-category');
    });
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    let firstInvalid = null;
    Object.keys(validators).forEach(id => {
      if (!validateField(id) && !firstInvalid) firstInvalid = document.getElementById(id);
    });
    if (firstInvalid) {
      summary.textContent = 'A couple of details need your attention. Please check the fields marked below.';
      firstInvalid.focus();
      return;
    }
    summary.textContent = '';
    const data = new FormData(form);
    const val = name => String(data.get(name) || '').trim();
    const message = [
      "Hello The Cake Home! I'd like to enquire about a cake.", '',
      `Name: ${val('customerName')}`,
      `Contact number: ${val('phone')}`,
      `Cake category: ${val('category')}`,
      `Flavour: ${val('flavour') || 'Not decided yet'}`,
      `Approximate weight: ${val('weight') || 'Not decided yet'}`,
      `Event date: ${val('eventDate')}`,
      `Theme/design: ${val('design')}`,
      `Reference image URL: ${val('reference') || 'Not provided'}`,
      `Budget: ${val('budget') || 'Prefer to discuss'}`,
      '', 'Please let me know the next steps.'
    ].join('\n');
    const whatsappUrl = `https://wa.me/919597833830?text=${encodeURIComponent(message)}`;

    // NOTE: do not pass 'noopener' as a feature here — it makes window.open always return null.
    // We detach the opener manually instead.
    const win = window.open(whatsappUrl, '_blank');
    const existing = form.querySelector('.whatsapp-fallback');
    if (win) {
      try { win.opener = null; } catch (e) { /* ignore */ }
      if (existing) existing.remove();
    } else {
      summary.textContent = 'Your browser blocked the WhatsApp window. Use the link below to continue.';
      const fallback = existing || document.createElement('a');
      if (!existing) {
        fallback.className = 'whatsapp-fallback underlined-link';
        fallback.textContent = 'Open your WhatsApp enquiry ↗';
        fallback.target = '_blank';
        fallback.rel = 'noopener noreferrer';
        form.appendChild(fallback);
      }
      fallback.href = whatsappUrl;
    }
  });

  document.getElementById('year').textContent = new Date().getFullYear();

  /* ---------- Scroll reveal (starts after the preloader) ---------- */
  function initReveal() {
    const revealElements = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
      }), { threshold: 0.12 });
      revealElements.forEach(el => observer.observe(el));
    } else {
      revealElements.forEach(el => el.classList.add('is-visible'));
    }
  }

  /* ---------- Image parallax (subtle drift while scrolling) ---------- */
  const layers = [...document.querySelectorAll('.cake-photo img, .img-frame img, .social-tiles img')]
    .map(img => ({ img, frame: img.parentElement }));
  let ticking = false;
  // Parallax is the only continuous movement, so it is the one effect skipped for "reduce motion" users.
  const parallaxOn = !reduceMotion;

  function updateParallax() {
    ticking = false;
    if (!parallaxOn) return;
    const vh = window.innerHeight;
    layers.forEach(({ img, frame }) => {
      const rect = frame.getBoundingClientRect();
      if (!rect.height || rect.bottom < -60 || rect.top > vh + 60) return;   // hidden or off-screen
      const progress = ((rect.top + rect.height / 2) - vh / 2) / vh;          // about -0.6 .. 0.6 as the image crosses the screen
      const limit = rect.height * 0.1;                                         // must stay inside the 1.25 image scale headroom (12.5%)
      const shift = Math.max(-limit, Math.min(limit, -progress * rect.height * 0.3));
      img.style.setProperty('--py', `${shift.toFixed(1)}px`);
    });
  }
  function requestParallax() {
    if (ticking || !parallaxOn) return;
    ticking = true;
    window.requestAnimationFrame(updateParallax);
  }
  window.addEventListener('scroll', requestParallax, { passive: true });
  window.addEventListener('resize', requestParallax);
})();
