/* ==========================================================================
   Podlahářství Dragoun – script.js
   Jemná interaktivita: navigace, odhalování obsahu, FAQ accordion,
   galerie realizací s lightboxem a odeslání formuláře přes Formspree.
   ========================================================================== */
(function () {
  'use strict';

  document.documentElement.classList.add('js');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Hero na mobilu: pevná výška ----------
     Výška obrazovky se změří jednou a uloží do --hero-h. Při scrollu se na telefonu schovává lišta prohlížeče
     a okno se zvětší – hero se tím ale už nepřepočítá ani neposkočí. Nově se měří jen při změně šířky (otočení telefonu). */
  const setHeroHeight = () => document.documentElement.style.setProperty('--hero-h', window.innerHeight + 'px');
  let heroWidth = window.innerWidth;
  setHeroHeight();
  const onResize = () => {
    if (window.innerWidth !== heroWidth) { heroWidth = window.innerWidth; setHeroHeight(); }
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 300));
  if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(document.documentElement);

  /* ---------- Navigace: stín při posunu, hamburger menu, aktivní odkaz ---------- */
  const navbar = document.getElementById('navbar');
  const toggle = navbar && navbar.querySelector('.navbar__toggle');
  const menu = document.getElementById('hlavni-menu');

  if (navbar) {
    const onScroll = () => navbar.classList.toggle('is-scrolled', window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  if (toggle && menu) {
    const setMenu = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Zavřít menu' : 'Otevřít menu');
      menu.classList.toggle('is-open', open);
    };
    toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) { setMenu(false); toggle.focus(); }
    });
    document.addEventListener('click', (e) => {
      if (menu.classList.contains('is-open') && !navbar.contains(e.target)) setMenu(false);
    });
  }

  // zvýraznění položky menu podle sekce v zorném poli
  const navLinks = Array.from(document.querySelectorAll('.navbar__link'));
  if ('IntersectionObserver' in window && navLinks.length) {
    const map = new Map();
    navLinks.forEach((link) => {
      const href = link.getAttribute('href');
      if (!href.startsWith('#')) return;   // 404 odkazuje na sekce úvodní stránky („/#sluzby“)
      const section = document.querySelector(href);
      if (section) map.set(section, link);
    });
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const link = map.get(entry.target);
        if (!link) return;
        if (entry.isIntersecting) {
          navLinks.forEach((l) => { l.classList.remove('is-active'); l.removeAttribute('aria-current'); });
          link.classList.add('is-active');
          link.setAttribute('aria-current', 'location');
        } else if (link.classList.contains('is-active')) {
          link.classList.remove('is-active');
          link.removeAttribute('aria-current');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    map.forEach((_, section) => spy.observe(section));
  }

  /* ---------- Nenápadné objevení obsahu při posunu ---------- */
  const reveals = document.querySelectorAll('.reveal');
  if (!reduceMotion && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add('is-visible'); obs.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-visible'));
  }

  /* ---------- FAQ accordion (button + aria-expanded, ovládání klávesnicí) ---------- */
  document.querySelectorAll('[data-accordion] .faq__button').forEach((button) => {
    const panel = document.getElementById(button.getAttribute('aria-controls'));
    if (!panel) return;
    button.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', String(open));
      panel.classList.toggle('is-open', open);
    });
  });

  /* ---------- Galerie: záložky realizací ---------- */
  document.querySelectorAll('[data-tabs]').forEach((wrap) => {
    const tablist = wrap.querySelector('[role="tablist"]');
    const tabs = Array.from(wrap.querySelectorAll('[role="tab"]'));
    const panels = tabs.map((tab) => document.getElementById(tab.getAttribute('aria-controls')));

    const select = (index, focus) => {
      tabs.forEach((tab, i) => {
        const active = i === index;
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
        if (panels[i]) panels[i].hidden = !active;
      });
      if (focus) tabs[index].focus();
    };

    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(i, false));
      tab.addEventListener('keydown', (e) => {
        let next = null;
        if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
        if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
        if (e.key === 'Home') next = 0;
        if (e.key === 'End') next = tabs.length - 1;
        if (next !== null) { e.preventDefault(); select(next, true); }
      });
    });

    tablist.classList.add('is-ready');
    select(0, false);
  });

  /* ---------- Lightbox (nativní <dialog>) ---------- */
  const dialog = document.getElementById('lightbox');
  if (dialog && typeof dialog.showModal === 'function') {
    const picture = dialog.querySelector('[data-lightbox-picture]');
    const source = picture.querySelector('source');
    const img = picture.querySelector('img');
    const caption = dialog.querySelector('[data-lightbox-caption]');
    const counter = dialog.querySelector('[data-lightbox-counter]');
    let items = [];
    let current = 0;
    let opener = null;

    const prevBtn = dialog.querySelector('[data-lightbox-prev]');
    const nextBtn = dialog.querySelector('[data-lightbox-next]');

    // galerie jde od první fotky k poslední, dokola neběží
    const show = (index) => {
      if (index < 0 || index > items.length - 1) return;
      current = index;
      const focused = document.activeElement;
      prevBtn.disabled = current === 0;
      nextBtn.disabled = current === items.length - 1;
      // skrytá šipka nesmí ztratit fokus z klávesnice – přejde na druhou šipku (nebo na Zavřít)
      if ((focused === prevBtn || focused === nextBtn) && focused.disabled) {
        const other = focused === prevBtn ? nextBtn : prevBtn;
        (other.disabled ? dialog.querySelector('[data-lightbox-close]') : other).focus();
      }
      const item = items[current];
      const thumb = item.querySelector('img');
      source.srcset = item.dataset.avif || '';
      img.src = item.getAttribute('href');
      img.alt = thumb ? thumb.alt : '';
      caption.textContent = thumb ? thumb.alt : '';
      counter.textContent = (item.dataset.caption ? item.dataset.caption + ' · ' : '') + (current + 1) + ' / ' + items.length;
    };

    document.querySelectorAll('.gallery').forEach((gallery) => {
      const links = Array.from(gallery.querySelectorAll('.gallery__item'));
      links.forEach((link, i) => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          items = links;
          opener = link;
          show(i);
          dialog.showModal();
        });
      });
    });

    prevBtn.addEventListener('click', () => show(current - 1));
    nextBtn.addEventListener('click', () => show(current + 1));
    dialog.querySelector('[data-lightbox-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') show(current - 1);
      if (e.key === 'ArrowRight') show(current + 1);
    });
    // klik mimo fotografii zavře lightbox
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog || e.target.classList.contains('lightbox__stage')) dialog.close();
    });
    dialog.addEventListener('close', () => { if (opener) opener.focus(); });

    // swipe na dotykových zařízeních
    let touchX = null;
    dialog.addEventListener('touchstart', (e) => { touchX = e.changedTouches[0].clientX; }, { passive: true });
    dialog.addEventListener('touchend', (e) => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
      touchX = null;
    }, { passive: true });
  }

  /* ---------- Kontaktní formulář (Formspree) ----------
     Endpoint je v index.html v atributu action formuláře #poptavka.
     Potvrzení se zobrazí pouze po skutečně úspěšném odeslání. */
  const form = document.getElementById('poptavka');
  if (form) {
    const submit = form.querySelector('[type="submit"]');
    const success = form.querySelector('[data-form-success]');
    const error = form.querySelector('[data-form-error]');
    const messages = {
      jmeno: 'Vyplňte prosím své jméno.',
      email: 'Vyplňte prosím platný e-mail.',
      telefon: 'Vyplňte prosím telefon, alespoň 9 číslic.',
      zprava: 'Napište nám prosím zprávu.'
    };

    const validateField = (field) => {
      const out = document.getElementById(field.id + '-chyba');
      const valid = field.checkValidity();
      field.setAttribute('aria-invalid', String(!valid));
      if (out) out.textContent = valid ? '' : messages[field.name] || '';
      return valid;
    };

    form.querySelectorAll('[required]').forEach((field) => {
      field.addEventListener('blur', () => { if (field.value) validateField(field); });
      field.addEventListener('input', () => { if (field.getAttribute('aria-invalid') === 'true') validateField(field); });
    });

    const setSending = (sending) => {
      submit.disabled = sending;
      submit.setAttribute('aria-busy', String(sending));
      submit.textContent = sending ? 'Odesílám…' : submit.dataset.label;
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      success.hidden = true;
      error.hidden = true;

      const required = Array.from(form.querySelectorAll('[required]'));
      const invalid = required.filter((field) => !validateField(field));
      if (invalid.length) { invalid[0].focus(); return; }

      const endpoint = form.getAttribute('action') || '';
      if (endpoint.includes('ZDE_DOPLNIT')) {
        // formulář zatím není napojený – nikdy nesimulujeme úspěch
        console.warn('Formspree endpoint není nastaven (atribut action formuláře #poptavka).');
        error.hidden = false;
        return;
      }

      setSending(true);
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          body: new FormData(form),
          headers: { Accept: 'application/json' }
        });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        form.reset();
        form.querySelectorAll('[aria-invalid]').forEach((f) => f.removeAttribute('aria-invalid'));
        success.hidden = false;
        success.setAttribute('tabindex', '-1');
        success.focus();
      } catch (err) {
        error.hidden = false;
      } finally {
        setSending(false);
      }
    });
  }
})();
