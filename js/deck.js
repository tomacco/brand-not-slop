/* Brand, not slop — deck v2 engine. Contract: ../STYLE.md
   CSS defines every FINAL state; JS stages from-states and animates toward CSS truth.
   Interrupt-safe: repeat guard, in-flight cancel, back-nav lands on finished slides. */

const { animate, createTimeline, stagger, utils, cubicBezier } = anime;
const WEIGHTY = cubicBezier(.82, 0, .18, 1);
const slides = [...document.querySelectorAll('.slide')];
const PRINT = new URLSearchParams(location.search).has('print');

const SCATTER = [
  { x: -220, y: -140, r: -28 }, { x: 180, y: -190, r: 40 },
  { x: -320, y:   60, r:  18 }, { x: 260, y:  120, r: -35 },
  { x: -140, y:  200, r:  50 }, { x: 330, y:  -60, r:  12 },
  { x:  -60, y: -240, r: -45 }, { x: 120, y:  230, r:  25 },
];

/* ---------- scenes: enter(s, tl, hold) stages + choreographs extras;
   steps = presenter beats inside the slide; step(s) plays the next beat;
   clean(s) restores anything a scene touched beyond the standard staged props. */
const SCENES = {

  reveal: { // word exercise: word first, panel (card+chips) on presenter beat
    steps: 1,
    enter(s, tl, hold) {
      const panel = s.querySelector('.reveal-panel');
      utils.set(panel, { opacity: 0, y: 34 });
    },
    step(s) {
      animate(s.querySelector('.reveal-panel'), { opacity: 1, y: 0, duration: 750, ease: WEIGHTY });
    },
  },

  flood: { // color exercise: full-bleed color, brand card on presenter beat
    steps: 1,
    enter(s, tl, hold) {
      const panel = s.querySelector('.reveal-panel');
      utils.set(panel, { opacity: 0, y: 34 });
    },
    step(s) {
      animate(s.querySelector('.reveal-panel'), { opacity: 1, y: 0, duration: 750, ease: WEIGHTY });
    },
  },

  lens: { // search: a magnifying glass sweeps the word, then the reveal
    steps: 1,
    enter(s, tl, hold) {
      utils.set(s.querySelector('.reveal-panel'), { opacity: 0, y: 34 });
      const word = s.querySelector('.word');
      const lens = s.querySelector('.lens');
      const copy = s.querySelector('.lens-copy');
      const K = 1.6; // magnification
      const w = word.getBoundingClientRect().width;
      const cy = word.getBoundingClientRect().height / 2;
      const r = lens.getBoundingClientRect().width / 2;
      const p = { cx: -r * .5 };
      const apply = () => {
        utils.set(lens, { x: p.cx - r });
        utils.set(copy, { x: r - K * p.cx, y: r - K * cy, scale: K });
      };
      apply();
      tl.add(lens, { opacity: [0, 1], duration: 300 }, hold + 1250);
      tl.add(p, { cx: w + r * .5, duration: 2300, ease: WEIGHTY, onUpdate: apply }, hold + 1400);
      tl.add(lens, { opacity: 0, duration: 350 }, hold + 3750);
    },
    step(s) {
      animate(s.querySelector('.reveal-panel'), { opacity: 1, y: 0, duration: 750, ease: WEIGHTY });
      setTimeout(clawdCameo, 650); // Claw'd pops up alongside the "Also in the chat" chips
    },
  },

  melt: { // Milka: chocolate pours down the lilac, then the name surfaces
    steps: 1,
    enter(s, tl, hold) {
      utils.set(s.querySelector('.reveal-panel'), { opacity: 0, y: 34 });
      utils.set(s.querySelector('.melt .pool'), { scaleY: 0 });
      utils.set(s.querySelectorAll('.melt .drip'), { scaleY: 0 });
    },
    step(s) {
      const mtl = createTimeline({ defaults: { ease: WEIGHTY } });
      s._meltTl = mtl;
      mtl.add(s.querySelector('.melt .pool'), { scaleY: 1, duration: 450 }, 0);
      s.querySelectorAll('.melt .drip').forEach((d, k) =>
        mtl.add(d, { scaleY: 1, duration: 1250 + (k % 3) * 380 }, 150 + (k % 4) * 110));
      s.querySelectorAll('.melt .droplet').forEach((p, k) => {
        mtl.add(p, { opacity: [0, 1], duration: 160 }, 1250 + k * 300);
        mtl.add(p, { y: '64vh', opacity: 0, duration: 950, ease: 'in(3)' }, 1400 + k * 300);
      });
      mtl.add(s.querySelector('.reveal-panel'), { opacity: 1, y: 0, duration: 750 }, 2250);
    },
    clean(s) {
      if (s._meltTl) { s._meltTl.cancel(); s._meltTl = null; }
      s.querySelectorAll('.melt .droplet').forEach(p => {
        p.style.removeProperty('transform'); p.style.removeProperty('opacity');
      });
    },
  },

  typed: { // the question types itself
    enter(s, tl, hold) {
      const el = s.querySelector('.typed');
      if (!el.dataset.full) el.dataset.full = el.textContent;
      const full = el.dataset.full;
      el.textContent = '';
      const p = { n: 0 };
      tl.add(p, { n: full.length, duration: full.length * 34, ease: 'linear',
        onUpdate: () => { el.textContent = full.slice(0, Math.round(p.n)); } }, hold + 300);
    },
    clean(s) {
      const el = s.querySelector('.typed');
      if (el.dataset.full) el.textContent = el.dataset.full;
    },
  },

  signals: { // scatter → snap
    enter(s, tl, hold) {
      const sigs = s.querySelectorAll('.sig');
      sigs.forEach((el, k) => {
        const o = SCATTER[k % SCATTER.length];
        utils.set(el, { x: o.x, y: o.y, rotate: o.r, opacity: .5 });
      });
      tl.add(sigs, { x: 0, y: 0, rotate: 0, opacity: 1, duration: 1150, delay: stagger(55, { from: 'center' }) }, hold + 100);
    },
  },

  race: { // color arrives before type arrives before words
    enter(s, tl, hold) {
      const lanes = [
        { el: s.querySelector('.lane-1 .runner'), dur: 550 },
        { el: s.querySelector('.lane-2 .runner'), dur: 1050 },
        { el: s.querySelector('.lane-3 .runner'), dur: 1600 },
      ];
      lanes.forEach(l => {
        utils.set(l.el, { x: '-46vw', opacity: 0 });
        tl.add(l.el, { x: '0vw', opacity: 1, duration: l.dur }, hold + 250);
      });
    },
  },

  converge: { // hairlines draw from the signals toward the sentence
    enter(s, tl, hold) {
      const beams = s.querySelectorAll('.beam');
      utils.set(beams, { scaleX: 0 });
      tl.add(beams, { scaleX: 1, duration: 900, delay: stagger(120) }, hold + 700);
    },
  },

  hello: { // four voices, each with its own entrance personality
    enter(s, tl, hold) {
      const loud = s.querySelector('.h-loud'), calm = s.querySelector('.h-calm'),
            mono = s.querySelector('.h-mono'), air = s.querySelector('.h-air');
      utils.set(loud, { scale: 2.1, opacity: 0 });
      tl.add(loud, { scale: 1, opacity: 1, duration: 420, ease: 'out(4)' }, hold + 200);
      utils.set(calm, { opacity: 0, y: 14 });
      tl.add(calm, { opacity: 1, y: 0, duration: 1600, ease: 'outSine' }, hold + 500);
      const chars = mono.querySelectorAll('span');
      utils.set(chars, { opacity: 0 });
      tl.add(chars, { opacity: 1, duration: 60, ease: 'linear', delay: stagger(120) }, hold + 900);
      utils.set(air, { opacity: 0, letterSpacing: '0em' });
      tl.add(air, { opacity: 1, letterSpacing: '0.55em', duration: 1200 }, hold + 1400);
    },
    clean(s) { s.querySelector('.h-air')?.style.removeProperty('letter-spacing'); },
  },

  breakit: { // four calm signals, then the slop blob wrecks the row
    enter(s, tl, hold) {
      const sigs = s.querySelectorAll('.breakrow .sig');
      const blob = s.querySelector('.blob');
      const row = s.querySelector('.breakrow');
      const cap = s.querySelector('.break-cap');
      utils.set(sigs, { opacity: 0, y: 26 });
      tl.add(sigs, { opacity: 1, y: 0, duration: 700, delay: stagger(130) }, hold);
      utils.set(blob, { opacity: 0, y: -220, scale: 1.5 });
      tl.add(blob, { opacity: 1, y: 0, scale: 1, duration: 550, ease: 'out(4)' }, hold + 1300);
      tl.add(row, { keyframes: [{ x: -14 }, { x: 11 }, { x: -7 }, { x: 4 }, { x: 0 }], duration: 480, ease: 'linear' }, hold + 1850);
      if (cap) { utils.set(cap, { opacity: 0 }); tl.add(cap, { opacity: 1, duration: 600 }, hold + 2200); }
    },
  },

  stress: { // survival checks: each beat draws a checkmark and the specimen takes the hit
    steps: 3,
    enter(s, tl, hold) {
      s._stressIdx = 0;
      const checks = s.querySelectorAll('.check');
      s.querySelectorAll('.ck path').forEach(p => utils.set(p, { strokeDashoffset: 34 }));
      utils.set(checks, { opacity: 0 });
      utils.set(s.querySelector('.specimen'), { opacity: 0, y: 26 });
      tl.add(checks, { opacity: .35, y: [26, 0], duration: 700, delay: stagger(140) }, hold + 200);
      tl.add(s.querySelector('.specimen'), { opacity: 1, y: 0, duration: 750 }, hold + 500);
    },
    step(s) {
      const i = s._stressIdx++;
      const check = s.querySelectorAll('.check')[i];
      if (!check) return;
      const spec = s.querySelector('.specimen');
      s._stressTl?.cancel();
      const mtl = createTimeline({ defaults: { ease: WEIGHTY } });
      s._stressTl = mtl;
      mtl.add(check, { opacity: 1, duration: 400 }, 0);
      mtl.add(check.querySelector('.ck path'), { strokeDashoffset: 0, duration: 450 }, 100);
      if (i === 0) { // 16 pixels: shrink to favicon size inside the hairline frame, come back
        const frame = s.querySelector('.rig-frame');
        mtl.add(spec, { scale: .075, duration: 900 }, 150);
        mtl.add(frame, { opacity: [0, 1], duration: 300 }, 750);
        mtl.add(frame, { opacity: 0, duration: 300 }, 2050);
        mtl.add(spec, { scale: 1, duration: 800 }, 2150);
      } else if (i === 1) { // grayscale: colors drain, then return
        const p = { g: 0 };
        const paint = () => { spec.style.filter = `grayscale(${p.g})`; };
        mtl.add(p, { g: 1, duration: 600, onUpdate: paint }, 150);
        mtl.add(p, { g: 0, duration: 700, onUpdate: paint,
          onComplete: () => spec.style.removeProperty('filter') }, 2100);
      } else { // cracked phone: small, dim, cracks across — still Bananie
        const cracks = s.querySelectorAll('.crack');
        const q = { b: 1 };
        const paint = () => { spec.style.filter = `brightness(${q.b})`; };
        mtl.add(spec, { scale: .55, duration: 800 }, 150);
        mtl.add(q, { b: .45, duration: 800, onUpdate: paint }, 150);
        mtl.add(cracks, { opacity: [0, 1], duration: 350, delay: stagger(140) }, 850);
        mtl.add(cracks, { opacity: 0, duration: 300 }, 2400);
        mtl.add(spec, { scale: 1, duration: 800 }, 2500);
        mtl.add(q, { b: 1, duration: 800, onUpdate: paint,
          onComplete: () => spec.style.removeProperty('filter') }, 2500);
      }
    },
    clean(s) {
      s._stressTl?.cancel(); s._stressTl = null;
      s.querySelector('.specimen')?.style.removeProperty('filter');
      s.querySelectorAll('.ck path').forEach(p => p.style.removeProperty('stroke-dashoffset'));
    },
  },

  pipeline: { // truth → guardrails → execution cascade
    enter(s, tl, hold) {
      const stages = s.querySelectorAll('.pipe .stage');
      const links = s.querySelectorAll('.pipe .link');
      utils.set(stages, { opacity: 0, y: 26 });
      utils.set(links, { scaleX: 0 });
      stages.forEach((st, k) => tl.add(st, { opacity: 1, y: 0, duration: 700 }, hold + k * 520));
      links.forEach((ln, k) => tl.add(ln, { scaleX: 1, duration: 420 }, hold + 380 + k * 520));
    },
  },

  chain: { // seven prompts: cards cascade, links draw, a token travels output→input
    enter(s, tl, hold) {
      const cards = s.querySelectorAll('.pcard');
      const links = s.querySelectorAll('.plink');
      const tok = s.querySelector('.tok');
      const row = s.querySelector('.chain');
      utils.set(cards, { opacity: 0, y: 26 });
      utils.set(links, { scaleX: 0 });
      cards.forEach((c, k) => tl.add(c, { opacity: 1, y: 0, duration: 550 }, hold + k * 220));
      links.forEach((l, k) => tl.add(l, { scaleX: 1, duration: 260 }, hold + 170 + k * 220));
      if (tok && row) {
        const dist = row.getBoundingClientRect().width - tok.getBoundingClientRect().width;
        tl.add(tok, { opacity: [0, 1], duration: 200 }, hold + 1900);
        tl.add(tok, { x: dist, duration: 1900, ease: WEIGHTY }, hold + 1950);
        tl.add(tok, { opacity: 0, duration: 350 }, hold + 3850);
      }
    },
    clean(s) { const t = s.querySelector('.tok'); if (t) { t.style.removeProperty('transform'); t.style.removeProperty('opacity'); } },
  },

  stack: { // brand OS layers land in reading order: DNA first, prompts last
    enter(s, tl, hold) {
      const layers = s.querySelectorAll('.stack .layer');
      utils.set(layers, { opacity: 0, y: 30 });
      tl.add(layers, { opacity: 1, y: 0, duration: 650, delay: stagger(180) }, hold + 100);
    },
  },
};

/* ---------- engine ---------- */
const slideTls = new Map();
const STAGED = '.anim-rise,.anim-fade,.anim-rule,.frame,.sig,.reveal-panel,.beam,.runner,.blob,.break-cap,.stack .layer,.pipe .stage,.pipe .link,.h-loud,.h-calm,.h-mono span,.h-air,.breakrow,.pcard,.plink,.tok,.melt .pool,.melt .drip,.melt .droplet,.lens,.lens-copy,.check,.specimen,.rig-frame,.crack';

function sceneOf(s) { return SCENES[s.dataset.scene] || null; }

function revertTl(el) {
  const t = slideTls.get(el);
  if (t) { t.revert(); slideTls.delete(el); }
  el.querySelectorAll(STAGED).forEach(n => {
    n.style.removeProperty('transform');
    n.style.removeProperty('opacity');
    n.style.removeProperty('clip-path');
  });
  el.style.removeProperty('clip-path');
  sceneOf(el)?.clean?.(el);
}

function playSlide(i, hold = 0) {
  const s = slides[i];
  revertTl(s);
  const tl = createTimeline({ defaults: { ease: WEIGHTY, duration: 850 } });
  slideTls.set(s, tl);

  const rises = s.querySelectorAll('.anim-rise');
  const fades = s.querySelectorAll('.anim-fade');
  if (rises.length) {
    utils.set(rises, { y: '112%' });
    tl.add(rises, { y: '0%', duration: 950, delay: stagger(130) }, hold);
  }
  s.querySelectorAll('.anim-rule').forEach(el => {
    utils.set(el, { scaleX: 0 });
    tl.add(el, { scaleX: 1, duration: 900 }, hold + 150);
  });
  s.querySelectorAll('.frame').forEach(f => {
    const horiz = f.classList.contains('t') || f.classList.contains('b');
    utils.set(f, horiz ? { scaleX: 0 } : { scaleY: 0 });
    tl.add(f, horiz ? { scaleX: 1, duration: 650 } : { scaleY: 1, duration: 650 }, hold + 900);
  });
  sceneOf(s)?.enter?.(s, tl, hold);
  if (fades.length) {
    utils.set(fades, { opacity: 0 });
    tl.add(fades, { opacity: 1, duration: 650, delay: stagger(80) }, hold + (s.dataset.scene ? 1200 : 450));
  }
}

let cur = -1;
let stepsLeft = 0;

function show(i, dir = 1) {
  if (i < 0 || i >= slides.length || i === cur) return;
  const prev = cur; cur = i;
  const nxt = slides[i];
  const out = prev >= 0 ? slides[prev] : null;
  utils.remove(slides);
  slides.forEach(s => { if (s !== nxt && s !== out) { s.classList.remove('active'); revertTl(s); } });
  nxt.classList.add('active', 'staging');
  requestAnimationFrame(() => requestAnimationFrame(() => nxt.classList.remove('staging')));
  let hold = 0;
  if (out) {
    hold = 260; // the signature tone wipe carries you in
    utils.set(nxt, { clipPath: dir > 0 ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)' });
    animate(nxt, { clipPath: 'inset(0 0% 0 0%)', duration: 800, ease: WEIGHTY,
      onComplete: () => {
        nxt.style.removeProperty('clip-path');
        out.classList.remove('active');
        revertTl(out);
      } });
  }
  history.replaceState(null, '', '#' + i);
  if (dir > 0 || !out) {
    stepsLeft = sceneOf(nxt)?.steps || 0;
    playSlide(i, hold);
  } else {
    stepsLeft = 0;            // back-nav lands on the finished slide, steps included
    revertTl(nxt);
  }
  updateCue();
}

/* chat participation cue: shows while a slide is waiting for the audience */
const cue = document.getElementById('chatcue');
function updateCue() {
  if (!cue || PRINT) return;
  const s = cur >= 0 ? slides[cur] : null;
  const mode = s?.dataset.cue;
  cue.classList.toggle('show', mode === 'hold' || (mode === 'steps' && stepsLeft > 0));
}

function next() {
  const sc = cur >= 0 ? sceneOf(slides[cur]) : null;
  if (sc && stepsLeft > 0) { stepsLeft--; sc.step(slides[cur]); updateCue(); return; }
  show(cur + 1, 1);
}

/* counters "NN / NN" */
slides.forEach((s, i) => s.querySelectorAll('.count').forEach(c => {
  c.textContent = String(i + 1).padStart(2, '0') + ' / ' + slides.length;
}));

/* Claw'd cameo on the Search slide (GSAP rig; pixel art after Suan Kim's pen) */
let clawd = null, clawdTimers = [];
const clawdSvg = document.getElementById('deck-clawd');
if (!PRINT && window.Mascot && clawdSvg) {
  clawd = Mascot.create('#deck-clawd', { jumpHeight: 22 });
  gsap.set(clawdSvg, { yPercent: 112 }); // anime.js maps y to the SVG attribute, so the peek runs on gsap
} else if (clawdSvg) {
  clawdSvg.closest('.cameo-holder').style.display = 'none';
}
function clawdCameo() {
  if (!clawd) return;
  clawdTimers.forEach(clearTimeout); clawdTimers = [];
  clawd.setState('excited');
  gsap.to(clawdSvg, { yPercent: 10, duration: .7, ease: 'steps(7)' }); // pixel-y rise
  clawdTimers.push(setTimeout(() => clawd.jump(), 1900));
  clawdTimers.push(setTimeout(() => {
    clawd.setState('idle');
    gsap.to(clawdSvg, { yPercent: 112, duration: .5, ease: 'steps(5)' });
  }, 5200));
}

/* prompts appendix: jump links, accordion, copy */
let jumpFrom = -1;
document.querySelectorAll('[data-goto]').forEach(el => el.addEventListener('click', () => {
  const idx = slides.indexOf(document.getElementById(el.dataset.goto));
  if (idx >= 0 && idx !== cur) { jumpFrom = cur; show(idx, idx > cur ? 1 : -1); }
}));
document.querySelectorAll('[data-goback]').forEach(el => el.addEventListener('click', () => {
  const dest = jumpFrom >= 0 ? jumpFrom : cur - 1;
  jumpFrom = -1;
  show(dest, dest > cur ? 1 : -1);
}));
document.querySelectorAll('.acc-head').forEach(h => h.addEventListener('click', () => {
  const item = h.parentElement;
  const wasOpen = item.classList.contains('open');
  item.closest('.acc').querySelectorAll('.acc-item.open').forEach(i => i.classList.remove('open'));
  if (!wasOpen) item.classList.add('open');
}));
document.querySelectorAll('.copybtn').forEach(b => b.addEventListener('click', async () => {
  const text = b.parentElement.querySelector('pre').textContent;
  try { await navigator.clipboard.writeText(text); }
  catch {
    const t = document.createElement('textarea');
    t.value = text; document.body.appendChild(t); t.select();
    document.execCommand('copy'); t.remove();
  }
  b.textContent = 'Copied';
  setTimeout(() => { b.textContent = 'Copy prompt'; }, 1400);
}));

/* full screen toggle: button in the nav corner + F key */
const fsbtn = document.getElementById('fsbtn');
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen();
}
fsbtn?.addEventListener('click', () => { toggleFullscreen(); fsbtn.blur(); });
document.addEventListener('fullscreenchange', () => {
  if (fsbtn) fsbtn.textContent = document.fullscreenElement ? '⛶ exit full screen' : '⛶ full screen';
});

if (PRINT) {
  document.body.classList.add('print');
  slides.forEach(s => s.classList.add('active'));
} else {
  addEventListener('keydown', e => {
    if (e.repeat) return;
    if (e.target.closest?.('button, a, input, textarea')) return; // don't nav while a control has focus
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') next();
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') show(cur - 1, -1);
    if (e.key === 'f' || e.key === 'F') toggleFullscreen();
  });
  // boot only once the display font is in — a mid-entrance font swap reads as a stutter
  const boot = () => show(Math.min(Math.max(parseInt(location.hash.slice(1)) || 0, 0), slides.length - 1));
  Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]).then(boot);
}
