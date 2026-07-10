/* ═══════════════════════════════════════════
   AL MANARAT ISLAMIYAT — JAVASCRIPT
═══════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

  /* ─── NAVBAR SCROLL EFFECT ─── */
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 60) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });

  /* ─── MOBILE BURGER MENU ─── */
  const navBurger = document.getElementById('navBurger');
  const navLinks  = document.getElementById('navLinks');

  navBurger.addEventListener('click', () => {
    navLinks.classList.toggle('open');
    const isOpen = navLinks.classList.contains('open');
    navBurger.setAttribute('aria-pressed', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });

  // Fermer le menu quand on clique sur un lien
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      document.body.style.overflow = '';
    });
  });

  /* ─── BACK TO TOP ─── */
  const backToTop = document.getElementById('backToTop');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 400) {
      backToTop.classList.add('visible');
    } else {
      backToTop.classList.remove('visible');
    }
  });

  backToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ─── COUNTER ANIMATION ─── */
  const counters = document.querySelectorAll('.stat-number');
  let countersStarted = false;

  function animateCounters() {
    counters.forEach(counter => {
      const target = parseInt(counter.getAttribute('data-target'));
      const duration = 2000;
      const start = performance.now();

      const update = (currentTime) => {
        const elapsed = currentTime - start;
        const progress = Math.min(elapsed / duration, 1);
        // Easing: easeOutExpo
        const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        const value = Math.round(eased * target);
        counter.textContent = value.toLocaleString('fr-FR');
        if (progress < 1) requestAnimationFrame(update);
      };

      requestAnimationFrame(update);
    });
  }

  // Déclencher les compteurs quand la section hero est visible
  const heroSection = document.getElementById('hero');
  const heroObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !countersStarted) {
        countersStarted = true;
        setTimeout(animateCounters, 800);
      }
    });
  }, { threshold: 0.3 });

  if (heroSection) heroObserver.observe(heroSection);

  /* ─── SCROLL REVEAL ANIMATION ─── */
  const revealEls = document.querySelectorAll(
    '.about-grid, .program-card, .activity-card, .event-card, .gallery-item, .testimonial-card, .contact-item, .value-card'
  );

  revealEls.forEach(el => el.classList.add('reveal'));

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        // Stagger délai
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, 80 * i);
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  revealEls.forEach(el => revealObserver.observe(el));
  setTimeout(() => {
    revealEls.forEach(el => el.classList.add('visible'));
  }, 900);

  /* ─── GALLERY FILTER ─── */
  const filterBtns = document.querySelectorAll('.filter-btn');
  const galleryItems = document.querySelectorAll('.gallery-item');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.getAttribute('data-filter');

      galleryItems.forEach(item => {
        const cat = item.getAttribute('data-cat');
        if (filter === 'all' || cat === filter) {
          item.style.display = '';
          item.style.opacity = '0';
          item.style.transform = 'scale(0.95)';
          setTimeout(() => {
            item.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
            item.style.opacity = '1';
            item.style.transform = 'scale(1)';
          }, 50);
        } else {
          item.style.opacity = '0';
          item.style.transform = 'scale(0.9)';
          setTimeout(() => { item.style.display = 'none'; }, 400);
        }
      });
    });
  });

  /* ─── LIGHTBOX GALLERY ─── */
  const lightbox       = document.getElementById('lightbox');
  const lightboxImg    = document.getElementById('lightboxImg');
  const lightboxCaption = document.getElementById('lightboxCaption');
  const lightboxClose  = document.getElementById('lightboxClose');
  const lightboxPrev   = document.getElementById('lightboxPrev');
  const lightboxNext   = document.getElementById('lightboxNext');

  let currentIndex = 0;
  let visibleItems = [];

  function openLightbox(index) {
    visibleItems = [...document.querySelectorAll('.gallery-item')].filter(
      el => el.style.display !== 'none'
    );
    currentIndex = index;
    updateLightbox();
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
  }

  function updateLightbox() {
    const item = visibleItems[currentIndex];
    if (!item) return;
    const img     = item.querySelector('.gallery-img');
    const caption = item.querySelector('.gallery-caption');
    lightboxImg.src = img.src;
    lightboxImg.alt = img.alt;
    lightboxCaption.textContent = caption ? caption.textContent.trim() : '';

    // Animate
    lightboxImg.style.opacity = '0';
    lightboxImg.style.transform = 'scale(0.95)';
    setTimeout(() => {
      lightboxImg.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      lightboxImg.style.opacity = '1';
      lightboxImg.style.transform = 'scale(1)';
    }, 50);
  }

  galleryItems.forEach((item, index) => {
    item.addEventListener('click', () => {
      const allItems = [...document.querySelectorAll('.gallery-item')].filter(
        el => el.style.display !== 'none'
      );
      const visibleIndex = allItems.indexOf(item);
      openLightbox(visibleIndex);
    });
  });

  lightboxClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  lightboxPrev.addEventListener('click', (e) => {
    e.stopPropagation();
    currentIndex = (currentIndex - 1 + visibleItems.length) % visibleItems.length;
    updateLightbox();
  });

  lightboxNext.addEventListener('click', (e) => {
    e.stopPropagation();
    currentIndex = (currentIndex + 1) % visibleItems.length;
    updateLightbox();
  });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('active')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') {
      currentIndex = (currentIndex - 1 + visibleItems.length) % visibleItems.length;
      updateLightbox();
    }
    if (e.key === 'ArrowRight') {
      currentIndex = (currentIndex + 1) % visibleItems.length;
      updateLightbox();
    }
  });

  /* ─── TESTIMONIALS CAROUSEL ─── */
  const track    = document.getElementById('testimonialsTrack');
  const cards    = track.querySelectorAll('.testimonial-card');
  const dotsContainer = document.getElementById('testiDots');
  const prevBtn  = document.getElementById('testiPrev');
  const nextBtn  = document.getElementById('testiNext');

  let currentSlide = 0;
  const totalSlides = Math.ceil(cards.length / 2);

  // Create dots
  for (let i = 0; i < totalSlides; i++) {
    const dot = document.createElement('div');
    dot.className = 'testi-dot' + (i === 0 ? ' active' : '');
    dot.addEventListener('click', () => goToSlide(i));
    dotsContainer.appendChild(dot);
  }

  function goToSlide(index) {
    currentSlide = Math.max(0, Math.min(index, totalSlides - 1));
    const cardWidth = cards[0].offsetWidth + 24; // width + gap
    track.style.transform = `translateX(-${currentSlide * cardWidth * 2}px)`;

    dotsContainer.querySelectorAll('.testi-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === currentSlide);
    });
  }

  prevBtn.addEventListener('click', () => goToSlide(currentSlide - 1));
  nextBtn.addEventListener('click', () => goToSlide(currentSlide + 1));

  // Auto-play
  let autoPlay = setInterval(() => {
    goToSlide((currentSlide + 1) % totalSlides);
  }, 5000);

  track.addEventListener('mouseenter', () => clearInterval(autoPlay));
  track.addEventListener('mouseleave', () => {
    autoPlay = setInterval(() => {
      goToSlide((currentSlide + 1) % totalSlides);
    }, 5000);
  });

  // Recalculate on resize
  window.addEventListener('resize', () => goToSlide(currentSlide));

  /* ─── CONTACT FORM ─── */
  const form        = document.getElementById('contactForm');
  const submitBtn   = document.getElementById('submitBtn');
  const formSuccess = document.getElementById('formSuccess');

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    // Validation basique
    const required = form.querySelectorAll('[required]');
    let isValid = true;

    required.forEach(field => {
      field.style.borderColor = '';
      if (!field.value.trim()) {
        field.style.borderColor = '#ef4444';
        isValid = false;
      }
    });

    if (!isValid) {
      // Shake animation
      form.style.animation = 'none';
      setTimeout(() => {
        form.style.animation = 'shake 0.5s ease';
      }, 10);
      return;
    }

    // Simulate submission
    submitBtn.disabled = true;
    submitBtn.querySelector('span').textContent = 'Envoi en cours...';

    setTimeout(() => {
      submitBtn.style.display = 'none';
      formSuccess.style.display = 'block';
      form.reset();

      setTimeout(() => {
        submitBtn.style.display = 'flex';
        submitBtn.disabled = false;
        submitBtn.querySelector('span').textContent = 'Envoyer la demande';
        formSuccess.style.display = 'none';
      }, 5000);
    }, 1800);
  });

  /* ─── ACTIVE NAV LINK ON SCROLL ─── */
  const sections = document.querySelectorAll('section[id]');

  function updateActiveNav() {
    const scrollY = window.scrollY + 100;
    sections.forEach(section => {
      const top    = section.offsetTop;
      const height = section.offsetHeight;
      const id     = section.id;
      const link   = document.querySelector(`.nav-link[href="#${id}"]`);
      if (link) {
        if (scrollY >= top && scrollY < top + height) {
          link.style.color = '';
          link.style.fontWeight = '700';
        } else {
          link.style.fontWeight = '';
        }
      }
    });
  }

  window.addEventListener('scroll', updateActiveNav);

  /* ─── SMOOTH ANCHOR SCROLL ─── */
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        e.preventDefault();
        const offset = 80;
        window.scrollTo({
          top: target.offsetTop - offset,
          behavior: 'smooth'
        });
      }
    });
  });

  /* ─── TICKER PAUSE ON HOVER ─── */
  const tickerTrack = document.querySelector('.ticker-track');
  if (tickerTrack) {
    tickerTrack.addEventListener('mouseenter', () => {
      tickerTrack.style.animationPlayState = 'paused';
    });
    tickerTrack.addEventListener('mouseleave', () => {
      tickerTrack.style.animationPlayState = 'running';
    });
  }

  /* ─── SHAKE ANIMATION KEYFRAMES (injected) ─── */
  const style = document.createElement('style');
  style.textContent = `
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      20% { transform: translateX(-8px); }
      40% { transform: translateX(8px); }
      60% { transform: translateX(-4px); }
      80% { transform: translateX(4px); }
    }
  `;
  document.head.appendChild(style);

  /* ─── DYNAMIC CONTENT (logo, social icons, footer) ─── */
  if (window.initPublicPage) {
    initPublicPage({ updateHero: false, updateStats: false });
  }

  console.log('🌟 Al Manarat Islamiyat — Site web initialisé avec succès !');
});
