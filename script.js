/* AC Fire Protection — dependency-free interaction layer. */
(() => {
  'use strict';
  const root = document.documentElement;
  const header = document.querySelector('.site-header');
  const menuButton = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#primary-nav');
  const motionButton = document.querySelector('#motion-toggle');
  const mediaMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobileMedia = window.matchMedia('(max-width: 680px)');
  const progress = document.querySelector('.scroll-progress');
  const visual = document.querySelector('.hero-visual');
  const year = document.querySelector('#year');
  let reduceMotion = mediaMotion.matches;
  let framePending = false;

  // Only device-local animation preferences are stored. No visitor tracking.
  try {
    const stored = localStorage.getItem('ac-fire-reduce-motion');
    if (stored === 'true') reduceMotion = true;
  } catch { /* Storage may be disabled; all interactions still work. */ }

  function syncMotion() {
    root.classList.toggle('motion-reduced', reduceMotion);
    motionButton.setAttribute('aria-pressed', String(reduceMotion));
    motionButton.textContent = reduceMotion ? 'Motion reduced' : 'Reduce motion';
    if (reduceMotion && visual) {
      visual.style.removeProperty('--image-x');
      visual.style.removeProperty('--image-y');
    }
  }

  motionButton.hidden = false;
  syncMotion();
  motionButton.addEventListener('click', () => {
    reduceMotion = !reduceMotion;
    syncMotion();
    try { localStorage.setItem('ac-fire-reduce-motion', String(reduceMotion)); } catch { /* Optional preference. */ }
  });
  mediaMotion.addEventListener('change', (event) => {
    reduceMotion = event.matches;
    syncMotion();
  });

  function setMenu(open, returnFocus = false) {
    nav.classList.toggle('is-open', open);
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    if (returnFocus) menuButton.focus();
  }
  menuButton.hidden = false;
  root.classList.add('js');
  menuButton.addEventListener('click', () => setMenu(menuButton.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', (event) => {
    if (!event.target.closest('a')) return;
    setMenu(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') setMenu(false, true);
  });
  document.addEventListener('click', (event) => {
    if (!header.contains(event.target) && menuButton.getAttribute('aria-expanded') === 'true') setMenu(false);
  });
  header.addEventListener('focusout', (event) => {
    if (event.relatedTarget && !header.contains(event.relatedTarget)) setMenu(false);
  });
  mobileMedia.addEventListener('change', () => setMenu(false));

  // Keep normal anchor URLs and history, and move keyboard focus to the destination.
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (event) => {
      if (anchor.hasAttribute('data-open-call')) return;
      const target = document.getElementById(anchor.getAttribute('href').slice(1));
      if (!target) return;
      event.preventDefault();
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.classList.add('is-visible');
      target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      // Embedded previews can restrict navigation; in-page scrolling still works.
      try { history.replaceState(null, '', '#' + target.id); } catch { /* Keep the page intact. */ }
      requestAnimationFrame(() => target.focus({ preventScroll: true }));
    });
  });

  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -18px 0px' });
    reveals.forEach((element) => revealObserver.observe(element));

    const navLinks = [...nav.querySelectorAll('a[href^="#"]')];
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((link) => {
          if (link.getAttribute('href') === '#' + entry.target.id) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-15% 0px -65% 0px', threshold: 0 });
    document.querySelectorAll('main > section[id]').forEach((section) => sectionObserver.observe(section));
  } else {
    reveals.forEach((element) => element.classList.add('is-visible'));
  }

  function updateScroll() {
    const distance = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const ratio = distance > 0 ? Math.min(1, Math.max(0, window.scrollY / distance)) : 0;
    progress.style.transform = 'scaleX(' + ratio + ')';
    header.classList.toggle('is-scrolled', window.scrollY > 40);
    if (window.scrollY < 150) nav.querySelectorAll('[aria-current]').forEach((link) => link.removeAttribute('aria-current'));
    framePending = false;
  }
  function queueScroll() {
    if (framePending) return;
    framePending = true;
    requestAnimationFrame(updateScroll);
  }
  window.addEventListener('scroll', queueScroll, { passive: true });
  window.addEventListener('resize', queueScroll, { passive: true });
  document.querySelectorAll('.service-card').forEach((card) => card.addEventListener('toggle', queueScroll));
  updateScroll();

  if (visual && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    visual.addEventListener('pointermove', (event) => {
      if (reduceMotion) return;
      const bounds = visual.getBoundingClientRect();
      visual.style.setProperty('--image-x', ((event.clientX - bounds.left) / bounds.width - 0.5) * 8 + 'px');
      visual.style.setProperty('--image-y', ((event.clientY - bounds.top) / bounds.height - 0.5) * 8 + 'px');
    }, { passive: true });
    visual.addEventListener('pointerleave', () => {
      visual.style.setProperty('--image-x', '0px');
      visual.style.setProperty('--image-y', '0px');
    });
  }

  const contactButton = document.querySelector('#save-contact');
  contactButton.hidden = false;
  contactButton.addEventListener('click', () => {
    const vcard = [
      'BEGIN:VCARD', 'VERSION:3.0', 'FN:Casey - AC Fire Protection',
      'N:;Casey;;;', 'ORG:AC Fire Protection', 'TITLE:Technician',
      'TEL;TYPE=WORK,VOICE:+17139988149', 'TEL;TYPE=WORK,FAX:+18888513746',
      'ADR;TYPE=WORK:;;2327 Naomi St;Houston;TX;77054;United States',
      'END:VCARD', ''
    ].join('\r\n');
    const file = new Blob([vcard], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const download = document.createElement('a');
    download.href = url;
    download.download = 'AC-Fire-Protection-Casey.vcf';
    document.body.appendChild(download);
    download.click();
    download.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    document.querySelector('#contact-feedback').textContent = 'Contact card ready. Open the downloaded file to save it.';
  });

  year.textContent = String(new Date().getFullYear());
})();
