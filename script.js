/* ============================================================
   Teams Democracy — script.js
   Animated counters · FAQ accordion · Confetti · Mobile nav
   ============================================================ */

// ---- Mobile nav toggle ----
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');

if (hamburger && mobileMenu) {
  hamburger.addEventListener('click', () => {
    mobileMenu.classList.toggle('open');
  });

  // Close on link click
  mobileMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => mobileMenu.classList.remove('open'));
  });
}

// ---- Scroll-triggered fade-in ----
function initFadeIns() {
  const els = document.querySelectorAll(
    '.feature-card, .testimonial-card, .step, .process-box, .pricing-card, .faq-item, .stat'
  );
  els.forEach(el => el.classList.add('fade-in'));

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  els.forEach(el => observer.observe(el));
}

// ---- Animated counters ----
function easeOutQuart(t) {
  return 1 - Math.pow(1 - t, 4);
}

function animateCounter(el) {
  const target = parseInt(el.dataset.target, 10);
  const suffix = el.dataset.suffix || '';
  const duration = 1800;
  const start = performance.now();

  function frame(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const value = Math.round(easeOutQuart(progress) * target);
    el.textContent = value.toLocaleString() + suffix;
    if (progress < 1) {
      requestAnimationFrame(frame);
    }
  }

  requestAnimationFrame(frame);
}

function initCounters() {
  const statEls = document.querySelectorAll('.stat-number[data-target]');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  statEls.forEach(el => observer.observe(el));
}

// ---- FAQ accordion ----
function initFAQ() {
  const questions = document.querySelectorAll('.faq-question');
  questions.forEach(btn => {
    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      const answer = btn.nextElementSibling;

      // Close all others
      questions.forEach(other => {
        other.setAttribute('aria-expanded', 'false');
        const otherAnswer = other.nextElementSibling;
        if (otherAnswer) otherAnswer.classList.remove('open');
      });

      // Toggle this one
      if (!expanded) {
        btn.setAttribute('aria-expanded', 'true');
        answer.classList.add('open');
      }
    });
  });
}

// ---- Confetti ----
const canvas = document.getElementById('confettiCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;
let confettiParticles = [];
let confettiAnimFrame = null;
let confettiActive = false;

const CONFETTI_COLORS = [
  '#6264A7', '#7B83EB', '#a78bfa',
  '#e74c3c', '#f39c12', '#27ae60',
  '#ffffff', '#ffd700'
];

function createParticle(x, y) {
  return {
    x,
    y,
    vx: (Math.random() - 0.5) * 8,
    vy: (Math.random() * -10) - 4,
    width: Math.random() * 10 + 4,
    height: Math.random() * 5 + 3,
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.3,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    opacity: 1,
    gravity: 0.35 + Math.random() * 0.2,
    shape: Math.random() > 0.5 ? 'rect' : 'circle'
  };
}

function fireConfetti(originX, originY) {
  if (!canvas || !ctx) return;

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.display = 'block';

  const cx = originX ?? window.innerWidth / 2;
  const cy = originY ?? window.innerHeight / 3;

  for (let i = 0; i < 120; i++) {
    confettiParticles.push(createParticle(cx, cy));
  }

  if (!confettiActive) {
    confettiActive = true;
    tickConfetti();
  }
}

function tickConfetti() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  confettiParticles = confettiParticles.filter(p => p.opacity > 0.02);

  confettiParticles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += p.gravity;
    p.vx *= 0.99;
    p.angle += p.spin;

    // Fade out when near bottom or after a while
    if (p.y > canvas.height * 0.75) p.opacity -= 0.025;
    else if (p.vy > 8) p.opacity -= 0.01;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.globalAlpha = Math.max(0, p.opacity);
    ctx.fillStyle = p.color;

    if (p.shape === 'rect') {
      ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, p.width / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  });

  if (confettiParticles.length > 0) {
    confettiAnimFrame = requestAnimationFrame(tickConfetti);
  } else {
    confettiActive = false;
    canvas.style.display = 'none';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

// ---- CTA button interactions ----
function initCTAButtons() {
  const heroBtn = document.getElementById('heroInstallBtn');
  const ctaBtn = document.getElementById('ctaInstallBtn');

  function handleInstallClick(e) {
    e.preventDefault();
    const rect = this.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    fireConfetti(cx, cy);
    this.classList.add('pulse');
    setTimeout(() => this.classList.remove('pulse'), 500);
    showToast();
  }

  if (heroBtn) heroBtn.addEventListener('click', handleInstallClick);
  if (ctaBtn) ctaBtn.addEventListener('click', handleInstallClick);
}

// ---- Toast notification ----
function showToast() {
  // Remove existing toast if any
  const existing = document.querySelector('.td-toast');
  if (existing) existing.remove();

  const messages = [
    "🗳️ Installing... IT approval required. Good luck.",
    "✅ Successfully installed! Your coworkers have been notified. Sort of.",
    "🏛️ Democracy has been added to your tenant. Brad has been warned.",
    "📬 Confirmation sent to your inbox and your manager's inbox. Oops.",
    "🎉 Welcome to meeting democracy. May the odds be ever in your favor.",
  ];

  const toast = document.createElement('div');
  toast.className = 'td-toast';
  toast.textContent = messages[Math.floor(Math.random() * messages.length)];

  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '24px',
    left: '50%',
    transform: 'translateX(-50%) translateY(80px)',
    background: '#1e1f3a',
    color: 'white',
    padding: '14px 24px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '500',
    fontFamily: 'Inter, sans-serif',
    boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
    zIndex: '10000',
    transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)',
    maxWidth: '90vw',
    textAlign: 'center',
    border: '1px solid rgba(123,131,235,0.3)',
  });

  document.body.appendChild(toast);

  // Slide in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.style.transform = 'translateX(-50%) translateY(0)';
    });
  });

  // Slide out and remove
  setTimeout(() => {
    toast.style.transform = 'translateX(-50%) translateY(80px)';
    setTimeout(() => toast.remove(), 400);
  }, 3800);
}

// ---- Mock vote button in hero ----
function initMockVote() {
  const btn = document.getElementById('mockVoteBtn');
  if (!btn) return;

  let votes = 3;
  const maxVotes = 5;
  const fillEl = document.querySelector('.vote-fill:not(.danger-fill)');
  const subEl = fillEl?.closest('.mockup-alert')?.querySelector('.alert-sub');

  btn.addEventListener('click', () => {
    if (votes >= maxVotes) {
      btn.textContent = '🎉 Meeting Ended!';
      btn.disabled = true;
      btn.style.background = '#27ae60';
      btn.style.borderColor = '#27ae60';
      if (subEl) subEl.textContent = 'Quorum reached. Meeting ending democratically...';
      if (fillEl) fillEl.style.width = '100%';
      fireConfetti(
        btn.getBoundingClientRect().left + btn.offsetWidth / 2,
        btn.getBoundingClientRect().top
      );
      showToast();
      return;
    }

    votes++;
    const pct = Math.round((votes / maxVotes) * 100);
    if (fillEl) fillEl.style.width = pct + '%';
    if (subEl) subEl.textContent = `${votes} of ${maxVotes} participants have voted. Quorum at ${pct}%.`;
    btn.textContent = `✋ Voted (${votes}/${maxVotes})`;

    if (votes >= maxVotes) {
      btn.textContent = '🎉 Meeting Ended!';
      btn.disabled = true;
      btn.style.background = '#27ae60';
      btn.style.borderColor = '#27ae60';
      if (subEl) subEl.textContent = 'Quorum reached. Meeting ending democratically...';
      fireConfetti(
        btn.getBoundingClientRect().left + btn.offsetWidth / 2,
        btn.getBoundingClientRect().top
      );
      showToast();
    }
  });
}

// ---- Nav active state on scroll ----
function initNavActiveLinks() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navLinks.forEach(link => {
          link.style.color = '';
          link.style.fontWeight = '';
          if (link.getAttribute('href') === `#${id}`) {
            link.style.color = 'var(--teams-purple)';
          }
        });
      }
    });
  }, { threshold: 0.4 });

  sections.forEach(s => observer.observe(s));
}

// ---- Resize canvas on window resize ----
window.addEventListener('resize', () => {
  if (canvas && confettiActive) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
});

// ---- Init everything on DOM ready ----
document.addEventListener('DOMContentLoaded', () => {
  initFadeIns();
  initCounters();
  initFAQ();
  initCTAButtons();
  initMockVote();
  initNavActiveLinks();
});
