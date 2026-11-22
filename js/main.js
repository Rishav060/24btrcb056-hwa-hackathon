(() => {
  'use strict';

  document.documentElement.classList.add('js');

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const header = document.querySelector('.site-header');
  const nav = document.querySelector('.nav');
  const navToggle = document.querySelector('.nav-toggle');
  const heroMedia = document.querySelector('.hero-media');
  const ritualSection = document.querySelector('.ritual');
  const ritualTrack = document.querySelector('.ritual-track');
  const ritualProgress = document.querySelector('.ritual-progress span');
  const ritualCount = document.querySelector('[data-ritual-count]');
  const ritualSteps = ritualTrack ? Array.from(ritualTrack.querySelectorAll('.step')) : [];

  let closeMenu = () => {};

  if (nav && navToggle) {
    closeMenu = () => {
      nav.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
      navToggle.setAttribute('aria-label', 'Open menu');
      document.body.classList.remove('menu-open');
    };

    navToggle.addEventListener('click', () => {
      const open = !nav.classList.contains('is-open');
      nav.classList.toggle('is-open', open);
      navToggle.setAttribute('aria-expanded', String(open));
      navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      document.body.classList.toggle('menu-open', open);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMenu();
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 900) closeMenu();
    });
  }

  function createSmoothScroll() {
    if (prefersReduced || !finePointer) return null;

    let current = window.scrollY;
    let target = current;
    let running = false;
    let frameId = 0;
    let lastTime = 0;

    const clamp = (value) => Math.min(Math.max(value, 0), Math.max(0, document.documentElement.scrollHeight - window.innerHeight));

    const frame = (time) => {
      const delta = lastTime ? Math.min(64, Math.max(1, time - lastTime)) : 16.67;
      lastTime = time;
      current += (target - current) * (1 - Math.exp(-delta / 100));

      if (Math.abs(target - current) < 0.4) {
        current = target;
        window.scrollTo(0, current);
        running = false;
        frameId = 0;
        return;
      }

      window.scrollTo(0, current);
      frameId = window.requestAnimationFrame(frame);
    };

    const start = () => {
      if (running) return;
      running = true;
      lastTime = 0;
      frameId = window.requestAnimationFrame(frame);
    };

    const scrollTo = (value) => {
      current = window.scrollY;
      target = clamp(value);
      start();
    };

    const stop = () => {
      running = false;
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = 0;
      current = window.scrollY;
      target = current;
    };

    window.addEventListener('wheel', (event) => {
      if (event.ctrlKey) return;
      const origin = event.target;
      if (origin instanceof Element && origin.closest('input, textarea, select, [data-native-scroll]')) return;
      event.preventDefault();
      target = clamp(target + event.deltaY);
      start();
    }, { passive: false });

    window.addEventListener('scroll', () => {
      if (!running) {
        current = window.scrollY;
        target = current;
      }
    }, { passive: true });

    window.addEventListener('keydown', (event) => {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) {
        stop();
      }
    });

    window.addEventListener('resize', () => {
      target = clamp(target);
    });

    return { scrollTo };
  }

  const smoothScroll = createSmoothScroll();

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const hash = link.getAttribute('href');
      if (!hash || hash.length < 2) return;

      const destination = document.querySelector(hash);
      if (!destination) return;

      event.preventDefault();
      const top = destination.getBoundingClientRect().top + window.scrollY - 88;

      if (smoothScroll) {
        smoothScroll.scrollTo(top);
      } else {
        window.scrollTo({ top, behavior: prefersReduced ? 'auto' : 'smooth' });
      }

      closeMenu();
      if (window.history.pushState) window.history.pushState(null, '', hash);
    });
  });

  const revealElements = Array.from(document.querySelectorAll('[data-reveal]'));

  if (revealElements.length) {
    if (prefersReduced || !('IntersectionObserver' in window)) {
      revealElements.forEach((element) => element.classList.add('is-visible'));
    } else {
      const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          const element = entry.target;
          const delay = Number(element.dataset.delay || 0) * 90;

          window.setTimeout(() => element.classList.add('is-visible'), delay);
          revealObserver.unobserve(element);
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });

      revealElements.forEach((element) => revealObserver.observe(element));
    }
  }

  let ritualDesktop = false;
  let ritualTravel = 0;

  function measureRitual() {
    ritualDesktop = Boolean(ritualSection && ritualTrack) && !prefersReduced && window.innerWidth > 900;

    if (!ritualDesktop) {
      if (ritualTrack) ritualTrack.style.transform = '';
      if (ritualProgress) ritualProgress.style.transform = '';
      ritualSteps.forEach((step) => step.classList.add('is-active'));
      if (ritualCount) ritualCount.textContent = '01';
      return;
    }

    const trackStyle = window.getComputedStyle(ritualTrack);
    const trackPadding = parseFloat(trackStyle.paddingRight) || 0;
    ritualTravel = Math.max(0, ritualTrack.scrollWidth - window.innerWidth + trackPadding);
  }

  function updateRitual() {
    if (!ritualDesktop) return;

    const bounds = ritualSection.getBoundingClientRect();
    const scrollable = ritualSection.offsetHeight - window.innerHeight;
    const progress = scrollable > 0 ? Math.min(1, Math.max(0, -bounds.top / scrollable)) : 0;

    ritualTrack.style.transform = `translate3d(${(-progress * ritualTravel).toFixed(2)}px, 0, 0)`;
    if (ritualProgress) ritualProgress.style.transform = `scaleX(${progress.toFixed(4)})`;

    const active = Math.min(ritualSteps.length - 1, Math.round(progress * (ritualSteps.length - 1)));
    ritualSteps.forEach((step, index) => step.classList.toggle('is-active', index === active));
    if (ritualCount) ritualCount.textContent = String(active + 1).padStart(2, '0');
  }

  let ticking = false;

  function updateScrollEffects() {
    ticking = false;

    if (header) header.classList.toggle('is-scrolled', window.scrollY > 24);

    if (heroMedia && !prefersReduced) {
      const shift = Math.min(window.scrollY * 0.12, 90);
      heroMedia.style.transform = `translate3d(0, ${shift.toFixed(2)}px, 0)`;
    }

    updateRitual();
  }

  function requestScrollUpdate() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(updateScrollEffects);
  }

  window.addEventListener('scroll', requestScrollUpdate, { passive: true });

  if (ritualSection && ritualTrack) {
    measureRitual();
    window.addEventListener('resize', () => {
      measureRitual();
      requestScrollUpdate();
    });
    window.addEventListener('load', () => {
      measureRitual();
      requestScrollUpdate();
    });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        measureRitual();
        requestScrollUpdate();
      });
    }
  }

  requestScrollUpdate();

  if (finePointer && !prefersReduced) {
    const glow = document.querySelector('.cursor-glow');

    if (glow) {
      let glowX = window.innerWidth / 2;
      let glowY = window.innerHeight / 2;
      let targetX = glowX;
      let targetY = glowY;
      let shown = false;

      window.addEventListener('pointermove', (event) => {
        targetX = event.clientX;
        targetY = event.clientY;

        if (!shown) {
          shown = true;
          document.body.classList.add('has-pointer');
        }
      }, { passive: true });

      const renderGlow = () => {
        glowX += (targetX - glowX) * 0.08;
        glowY += (targetY - glowY) * 0.08;
        glow.style.transform = `translate3d(${glowX.toFixed(1)}px, ${glowY.toFixed(1)}px, 0) translate(-50%, -50%)`;
        window.requestAnimationFrame(renderGlow);
      };

      renderGlow();
    }

    document.querySelectorAll('.card').forEach((card) => {
      card.addEventListener('pointermove', (event) => {
        if (event.pointerType && event.pointerType !== 'mouse') return;

        const rect = card.getBoundingClientRect();
        const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
        const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));

        card.style.setProperty('--mx', `${(x * 100).toFixed(2)}%`);
        card.style.setProperty('--my', `${(y * 100).toFixed(2)}%`);

        const rotateX = (0.5 - y) * 4.5;
        const rotateY = (x - 0.5) * 4.5;
        card.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-5px)`;
      });

      card.addEventListener('pointerleave', () => {
        card.style.transform = '';
        card.style.removeProperty('--mx');
        card.style.removeProperty('--my');
      });
    });

    document.querySelectorAll('[data-magnetic]').forEach((element) => {
      element.addEventListener('pointermove', (event) => {
        if (event.pointerType && event.pointerType !== 'mouse') return;

        const rect = element.getBoundingClientRect();
        const x = (event.clientX - rect.left - rect.width / 2) / (rect.width / 2);
        const y = (event.clientY - rect.top - rect.height / 2) / (rect.height / 2);

        element.style.transform = `translate(${(x * 5).toFixed(2)}px, ${(y * 4).toFixed(2)}px)`;
      });

      element.addEventListener('pointerleave', () => {
        element.style.transform = '';
      });
    });
  }
})();
