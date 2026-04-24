/* ============================================================
   Sirus H. Dehdari — main.js
   ============================================================ */

// ── Footer year ──────────────────────────────────────────────
document.getElementById('year').textContent = new Date().getFullYear();

// ── Navbar scroll effect ─────────────────────────────────────
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

// ── Mobile nav toggle ────────────────────────────────────────
const navToggle = document.getElementById('navToggle');
const navLinks  = document.getElementById('navLinks');

navToggle.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  navToggle.classList.toggle('open', open);
  navToggle.setAttribute('aria-expanded', open);
});

// Close mobile nav when a link is clicked
navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    navToggle.classList.remove('open');
    navToggle.setAttribute('aria-expanded', false);
  });
});

// ── Active nav link on scroll ─────────────────────────────────
const sections = document.querySelectorAll('section[id]');
const navAnchors = document.querySelectorAll('.nav-links a[href^="#"]');

function updateActiveLink() {
  const scrollY = window.scrollY + 100;
  sections.forEach(section => {
    const top    = section.offsetTop;
    const height = section.offsetHeight;
    const id     = section.getAttribute('id');
    if (scrollY >= top && scrollY < top + height) {
      navAnchors.forEach(a => {
        a.classList.toggle('active', a.getAttribute('href') === `#${id}`);
      });
    }
  });
}

window.addEventListener('scroll', updateActiveLink, { passive: true });
updateActiveLink();

// ── Scroll reveal (Intersection Observer) ────────────────────
const revealEls = document.querySelectorAll('.reveal, .fade-up');

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry, idx) => {
      if (!entry.isIntersecting) return;
      // Stagger sibling cards in grids
      const siblings = entry.target.parentElement
        ? [...entry.target.parentElement.querySelectorAll('.reveal, .fade-up')]
        : [];
      const delay = siblings.indexOf(entry.target) * 80;
      setTimeout(() => {
        entry.target.classList.add('visible');
      }, delay);
      revealObserver.unobserve(entry.target);
    });
  },
  { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
);

revealEls.forEach(el => revealObserver.observe(el));

// ── Abstract toggle ───────────────────────────────────────────
document.querySelectorAll('.btn-abstract').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.dataset.target;
    const panel    = document.getElementById(targetId);
    const expanded = btn.getAttribute('aria-expanded') === 'true';

    if (expanded) {
      // Collapse with animation
      panel.style.maxHeight = panel.scrollHeight + 'px';
      panel.style.overflow  = 'hidden';
      panel.style.opacity   = '1';

      requestAnimationFrame(() => {
        panel.style.transition = 'max-height .3s ease, opacity .25s ease';
        panel.style.maxHeight  = '0';
        panel.style.opacity    = '0';
      });

      panel.addEventListener('transitionend', () => {
        panel.hidden = true;
        panel.style.cssText = '';
      }, { once: true });

      btn.setAttribute('aria-expanded', 'false');
      btn.querySelector('svg').style.transform = '';
    } else {
      // Expand
      panel.hidden = false;
      panel.style.overflow   = 'hidden';
      panel.style.maxHeight  = '0';
      panel.style.opacity    = '0';
      panel.style.transition = 'max-height .35s ease, opacity .3s ease';

      requestAnimationFrame(() => {
        panel.style.maxHeight = panel.scrollHeight + 'px';
        panel.style.opacity   = '1';
      });

      panel.addEventListener('transitionend', () => {
        panel.style.cssText = '';
      }, { once: true });

      btn.setAttribute('aria-expanded', 'true');
    }
  });
});
