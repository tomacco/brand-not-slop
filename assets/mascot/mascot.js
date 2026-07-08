/*!
 * mascot.js — reusable SVG mascot animation module.
 *
 * Original implementation of techniques described in the Codrops article
 * "Reverse-Engineering Claude AI's Mascot Animations with SVG and GSAP"
 * (Ayotomiwa Wale-Durojaye, May 2026):
 *   https://tympanus.net/codrops/2026/05/05/reverse-engineering-claude-ais-mascot-animations-with-svg-and-gsap/
 * No article code is reproduced here; the character artwork is original.
 *
 * Peer dependency: GSAP core >= 3.10 (window.gsap). No GSAP plugins needed.
 *
 * Element conventions (query'd inside the SVG you pass in):
 *   [data-mascot-body]          required — group that carries lean/squash/jump
 *   [data-mascot-eye]           0..n — eye groups (blink via scaleY)
 *   [data-mascot-pupil]         0..n — pupils inside eyes (cursor tracking)
 *   [data-mascot-leg="left"|"right"]  optional — counter-stretch on lean
 *   [data-mascot-mouth]         optional — scaled by expression states
 *   [data-mascot-shadow]        optional — ground shadow, squashed mid-air
 */
(function (root, factory) {
  if (typeof module === "object" && typeof module.exports === "object") {
    module.exports = factory();
  } else {
    root.Mascot = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var DEFAULTS = {
    idle: true,               // breathing wobble while in the "idle" state
    blink: true,              // autonomous randomized blinking
    track: true,              // pupils follow the pointer
    eyeRadius: 5,             // max pupil travel, in SVG user units
    blinkEvery: [2.4, 6],     // [min, max] seconds between blinks
    leanAngle: 9,             // degrees used by lean() and the "curious" state
    jumpHeight: 46,           // jump apex, in SVG user units
    respectReducedMotion: true
  };

  var EYE_OPEN = { idle: 1, happy: 0.55, curious: 1, sleepy: 0.35, excited: 1 };

  function resolve(target) {
    if (typeof target === "string") return document.querySelector(target);
    return target || null;
  }

  function MascotController(target, options) {
    var g = typeof gsap !== "undefined" ? gsap : null;
    if (!g) throw new Error("[mascot] GSAP 3.10+ must be loaded before mascot.js");
    this.gsap = g;

    var svg = resolve(target);
    if (!svg) throw new Error("[mascot] SVG element not found: " + target);
    this.svg = svg;

    this.opts = Object.assign({}, DEFAULTS, options || {});

    var body = svg.querySelector("[data-mascot-body]");
    if (!body) throw new Error("[mascot] missing required [data-mascot-body] group");
    this.parts = {
      body: body,
      eyes: Array.prototype.slice.call(svg.querySelectorAll("[data-mascot-eye]")),
      pupils: Array.prototype.slice.call(svg.querySelectorAll("[data-mascot-pupil]")),
      legL: svg.querySelector('[data-mascot-leg="left"]'),
      legR: svg.querySelector('[data-mascot-leg="right"]'),
      mouth: svg.querySelector("[data-mascot-mouth]"),
      shadow: svg.querySelector("[data-mascot-shadow]")
    };

    this.reduced = !!(this.opts.respectReducedMotion &&
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches);

    // One transform origin per element, set ONCE. GSAP stores the origin as
    // element state, not per tween — switching origins mid-flight makes the
    // element visibly jump. The body pivots at its own bottom-center (the
    // ground, as long as the feet are inside the body group).
    g.set(body, { transformOrigin: "50% 100%" });
    if (this.parts.eyes.length) g.set(this.parts.eyes, { transformOrigin: "50% 50%" });
    if (this.parts.mouth) g.set(this.parts.mouth, { transformOrigin: "50% 50%" });
    if (this.parts.shadow) g.set(this.parts.shadow, { transformOrigin: "50% 50%" });
    [this.parts.legL, this.parts.legR].forEach(function (leg) {
      if (leg) g.set(leg, { transformOrigin: "50% 100%" });
    });

    this._eyeOpen = 1;      // blink returns eyelids to this value (states change it)
    this._stateTl = null;
    this._breathTl = null;
    this._actionTl = null;
    this._blinkCall = null;
    this._blinkTl = null;
    this._onMove = null;
    this.state = null;

    // quickTo gives one persistent, re-targetable tween per pupil axis —
    // the cheap way to chase a cursor without spawning a tween per event.
    var self = this;
    this._pupilTo = this.parts.pupils.map(function (p) {
      return {
        x: g.quickTo(p, "x", { duration: 0.3, ease: "power2.out" }),
        y: g.quickTo(p, "y", { duration: 0.3, ease: "power2.out" })
      };
    });

    if (!this.reduced) {
      if (this.opts.blink && this.parts.eyes.length) this._scheduleBlink();
      if (this.opts.track && this._pupilTo.length) this._enableTracking();
    }
    this.setState("idle");
  }

  // ---------------------------------------------------------------- idle

  MascotController.prototype._startBreath = function () {
    if (this.reduced || !this.opts.idle || this._breathTl) return;
    var g = this.gsap;
    this._breathTl = g.timeline({ repeat: -1, yoyo: true, defaults: { ease: "sine.inOut" } })
      .to(this.parts.body, { scaleY: 0.973, scaleX: 1.02, duration: 1.5 }, 0);
    if (this.parts.eyes.length) {
      this._breathTl.to(this.parts.eyes, { y: 1.2, duration: 1.5 }, 0);
    }
  };

  MascotController.prototype._stopBreath = function () {
    if (this._breathTl) { this._breathTl.kill(); this._breathTl = null; }
  };

  // ---------------------------------------------------------------- blink

  MascotController.prototype._scheduleBlink = function () {
    var g = this.gsap, self = this;
    var span = this.opts.blinkEvery;
    this._blinkCall = g.delayedCall(g.utils.random(span[0], span[1]), function () {
      self.blinkOnce();
      self._scheduleBlink();
    });
  };

  MascotController.prototype.blinkOnce = function () {
    if (!this.parts.eyes.length) return null;
    var g = this.gsap;
    if (this._blinkTl) this._blinkTl.kill();
    this._blinkTl = g.timeline()
      .to(this.parts.eyes, { scaleY: 0.06, duration: 0.07, ease: "power2.in" })
      .to(this.parts.eyes, { scaleY: this._eyeOpen, duration: 0.13, ease: "power2.out" });
    return this._blinkTl;
  };

  // ------------------------------------------------------------- tracking

  MascotController.prototype._enableTracking = function () {
    var g = this.gsap, self = this;
    this._onMove = function (e) {
      var r = self.svg.getBoundingClientRect();
      if (!r.width) return;
      var nx = g.utils.clamp(-1, 1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2));
      var ny = g.utils.clamp(-1, 1, (e.clientY - (r.top + r.height / 2)) / (r.height / 2));
      self._pupilTo.forEach(function (q) {
        q.x(nx * self.opts.eyeRadius);
        q.y(ny * self.opts.eyeRadius);
      });
    };
    window.addEventListener("pointermove", this._onMove, { passive: true });
  };

  /** Manually aim the eyes. nx/ny in [-1, 1]; (0,0) looks straight ahead. */
  MascotController.prototype.look = function (nx, ny) {
    var g = this.gsap, r = this.opts.eyeRadius;
    nx = g.utils.clamp(-1, 1, nx || 0);
    ny = g.utils.clamp(-1, 1, ny || 0);
    if (this._pupilTo.length) {
      this._pupilTo.forEach(function (q) { q.x(nx * r); q.y(ny * r); });
    }
  };

  // --------------------------------------------------------------- states

  /**
   * Every state timeline starts by settling shared properties back to
   * neutral, so states can be switched at any moment without leftover pose.
   */
  MascotController.prototype._settle = function (tl) {
    var P = this.parts;
    tl.to(P.body, { rotation: 0, scaleX: 1, scaleY: 1, y: 0, duration: 0.3, ease: "power2.out" }, 0);
    if (P.eyes.length) tl.to(P.eyes, { scaleY: 1, x: 0, duration: 0.3, ease: "power2.out" }, 0);
    if (P.mouth) tl.to(P.mouth, { scaleX: 1, scaleY: 1, duration: 0.3, ease: "power2.out" }, 0);
    if (P.legL) tl.to(P.legL, { scaleY: 1, duration: 0.3, ease: "power2.out" }, 0);
    if (P.legR) tl.to(P.legR, { scaleY: 1, duration: 0.3, ease: "power2.out" }, 0);
    if (P.shadow) tl.to(P.shadow, { scale: 1, opacity: 1, duration: 0.3, ease: "power2.out" }, 0);
    return tl;
  };

  MascotController.prototype._buildState = function (name) {
    var g = this.gsap, P = this.parts, o = this.opts;
    var tl = this._settle(g.timeline());

    if (name === "idle") return tl;

    if (name === "happy") {
      // Squinted eyes + a two-beat bounce with anticipation-free landing
      // squash and elastic recovery (follow-through).
      if (P.eyes.length) tl.to(P.eyes, { scaleY: 0.55, duration: 0.18, ease: "power2.out" }, 0.05);
      if (P.mouth) tl.to(P.mouth, { scaleX: 1.35, scaleY: 1.3, duration: 0.2, ease: "back.out(2)" }, 0.05);
      tl.to(P.body, { y: -12, duration: 0.18, ease: "sine.out" }, 0.1)
        .to(P.body, { y: 0, duration: 0.13, ease: "power3.in" })
        .to(P.body, { scaleY: 0.93, scaleX: 1.05, duration: 0.07, ease: "power2.out" })
        .to(P.body, { scaleY: 1, scaleX: 1, duration: 0.25, ease: "elastic.out(1, 0.5)" })
        .to(P.body, { y: -7, duration: 0.16, ease: "sine.out" })
        .to(P.body, { y: 0, duration: 0.12, ease: "power3.in" })
        .to(P.body, { scaleY: 0.96, scaleX: 1.03, duration: 0.06, ease: "power2.out" })
        .to(P.body, { scaleY: 1, scaleX: 1, duration: 0.2, ease: "elastic.out(1, 0.5)" });
      return tl;
    }

    if (name === "curious") {
      // The article's "weighted lean": body rotates from a ground pivot,
      // the eye group shifts in the lean direction, and the legs
      // counter-stretch — near leg compresses, far leg extends — so the
      // character reads as supporting its own weight.
      var a = o.leanAngle;
      var sway = g.timeline({ repeat: -1, yoyo: true, defaults: { ease: "sine.inOut" } });
      sway.to(P.body, { rotation: a, duration: 1.4 }, 0);
      if (P.eyes.length) sway.to(P.eyes, { x: 3.5, duration: 1.4 }, 0);
      if (P.legR) sway.to(P.legR, { scaleY: 0.85, duration: 1.4 }, 0);
      if (P.legL) sway.to(P.legL, { scaleY: 1.14, duration: 1.4 }, 0);
      sway.to(P.body, { rotation: -a, duration: 2.8 }, ">");
      if (P.eyes.length) sway.to(P.eyes, { x: -3.5, duration: 2.8 }, "<");
      if (P.legR) sway.to(P.legR, { scaleY: 1.14, duration: 2.8 }, "<");
      if (P.legL) sway.to(P.legL, { scaleY: 0.85, duration: 2.8 }, "<");
      tl.add(sway, 0.3);
      return tl;
    }

    if (name === "sleepy") {
      if (P.eyes.length) tl.to(P.eyes, { scaleY: 0.35, duration: 0.6, ease: "power2.inOut" }, 0);
      if (P.mouth) tl.to(P.mouth, { scaleX: 0.7, scaleY: 0.7, duration: 0.5 }, 0);
      var drowse = g.timeline({ repeat: -1, yoyo: true, defaults: { ease: "sine.inOut" } })
        .to(P.body, { rotation: 3, scaleY: 0.985, duration: 2.6 }, 0);
      tl.add(drowse, 0.4);
      return tl;
    }

    if (name === "excited") {
      // Continuous small hops. Each hop: crouch (anticipation), rise on a
      // decelerating ease, fall on an accelerating ease (split-arc gravity),
      // landing squash, recovery. Shadow shrinks while airborne.
      var h = o.jumpHeight * 0.4;
      var hop = g.timeline({ repeat: -1, repeatDelay: 0.08 });
      hop.to(P.body, { scaleY: 0.9, scaleX: 1.06, duration: 0.1, ease: "power2.in" })
        .to(P.body, { y: -h, scaleY: 1.05, scaleX: 0.97, duration: 0.2, ease: "sine.out" })
        .to(P.body, { y: 0, duration: 0.15, ease: "power3.in" })
        .to(P.body, { scaleY: 0.92, scaleX: 1.06, duration: 0.06, ease: "power2.out" })
        .to(P.body, { scaleY: 1, scaleX: 1, duration: 0.18, ease: "power2.out" });
      if (P.shadow) {
        hop.to(P.shadow, { scale: 0.78, opacity: 0.65, duration: 0.2, ease: "sine.out" }, 0.1)
          .to(P.shadow, { scale: 1, opacity: 1, duration: 0.15, ease: "power3.in" }, 0.3);
      }
      tl.add(hop, 0.3);
      return tl;
    }

    throw new Error("[mascot] unknown state: " + name);
  };

  MascotController.prototype.setState = function (name) {
    if (!(name in EYE_OPEN)) throw new Error("[mascot] unknown state: " + name);
    var g = this.gsap, P = this.parts;
    if (this._stateTl) { this._stateTl.kill(); this._stateTl = null; }
    this._eyeOpen = EYE_OPEN[name];
    this.state = name;

    if (this.reduced) {
      // Static poses only: no loops, no travel.
      g.set(P.body, { rotation: name === "sleepy" ? 3 : 0, scaleX: 1, scaleY: 1, y: 0 });
      if (P.eyes.length) g.set(P.eyes, { scaleY: this._eyeOpen, x: 0 });
      if (P.mouth) g.set(P.mouth, {
        scaleX: name === "happy" ? 1.35 : name === "sleepy" ? 0.7 : 1,
        scaleY: name === "happy" ? 1.3 : name === "sleepy" ? 0.7 : 1
      });
      return null;
    }

    if (name === "idle") this._startBreath();
    else this._stopBreath();

    this._stateTl = this._buildState(name);
    return this._stateTl;
  };

  // -------------------------------------------------------------- actions

  MascotController.prototype._action = function (build) {
    if (this.reduced) return null;
    if (this._actionTl && this._actionTl.isActive()) return null; // ignore while busy
    var self = this;
    if (this._breathTl) this._breathTl.pause();
    if (this._stateTl) this._stateTl.pause();
    var tl = build();
    tl.eventCallback("onComplete", function () {
      self._actionTl = null;
      if (self._breathTl) self._breathTl.resume();
      if (self._stateTl) self._stateTl.resume();
    });
    this._actionTl = tl;
    return tl;
  };

  /**
   * One-shot jump. The arc is two tweens, not one: rise decelerates
   * ("sine.out" — gravity bleeding off upward velocity), fall accelerates
   * ("power3.in" — gravity piling on). A crouch telegraphs the jump
   * (anticipation) and an elastic recovery after the landing squash sells
   * the mass (follow-through).
   */
  MascotController.prototype.jump = function () {
    var g = this.gsap, P = this.parts, o = this.opts;
    return this._action(function () {
      var tl = g.timeline();
      tl.to(P.body, { scaleY: 0.85, scaleX: 1.09, duration: 0.14, ease: "power3.in" });
      tl.addLabel("air");
      tl.to(P.body, { y: -o.jumpHeight, scaleY: 1.06, scaleX: 0.96, duration: 0.34, ease: "sine.out" }, "air");
      tl.to(P.body, { y: 0, duration: 0.2, ease: "power3.in" }, "air+=0.34");
      if (P.shadow) {
        tl.to(P.shadow, { scale: 0.6, opacity: 0.5, duration: 0.34, ease: "sine.out" }, "air");
        tl.to(P.shadow, { scale: 1, opacity: 1, duration: 0.2, ease: "power3.in" }, "air+=0.34");
      }
      tl.to(P.body, { scaleY: 0.88, scaleX: 1.08, duration: 0.07, ease: "power2.out" });
      tl.to(P.body, { scaleY: 1, scaleX: 1, duration: 0.35, ease: "elastic.out(1, 0.45)" });
      return tl;
    });
  };

  /**
   * Persistent lean pose. dir: -1 left, 1 right, 0 upright.
   * Same weighted-lean recipe as the "curious" state, held statically.
   */
  MascotController.prototype.lean = function (dir) {
    dir = dir || 0;
    var g = this.gsap, P = this.parts, o = this.opts;
    if (this.reduced) {
      g.set(P.body, { rotation: o.leanAngle * dir });
      return null;
    }
    var tl = g.timeline({ defaults: { duration: 0.5, ease: "power2.inOut" } });
    tl.to(P.body, { rotation: o.leanAngle * dir }, 0);
    if (P.eyes.length) tl.to(P.eyes, { x: 3.5 * dir }, 0);
    if (P.legR) tl.to(P.legR, { scaleY: dir === 0 ? 1 : dir > 0 ? 0.85 : 1.14 }, 0);
    if (P.legL) tl.to(P.legL, { scaleY: dir === 0 ? 1 : dir > 0 ? 1.14 : 0.85 }, 0);
    return tl;
  };

  // -------------------------------------------------------------- cleanup

  MascotController.prototype.destroy = function () {
    var g = this.gsap, P = this.parts;
    if (this._blinkCall) this._blinkCall.kill();
    [this._blinkTl, this._breathTl, this._stateTl, this._actionTl].forEach(function (t) {
      if (t) t.kill();
    });
    if (this._onMove) window.removeEventListener("pointermove", this._onMove);
    var all = [P.body, P.mouth, P.shadow, P.legL, P.legR]
      .concat(P.eyes, P.pupils)
      .filter(Boolean);
    g.killTweensOf(all);
    g.set(all, { clearProps: "transform,opacity" });
  };

  // ---------------------------------------------------- sprite-loop helper

  /**
   * Frame-by-frame playback for hand-drawn pose sequences (the article's
   * flag-waver / gym technique): show one <g> frame at a time with
   * gsap.set() display swaps — no tweening between frames is possible for
   * discrete artwork. `getDelay(frameIndex)` enables rhythm holds: return a
   * longer delay on effort frames so the loop doesn't feel like a metronome.
   *
   * opts: { getDelay?, frameDuration?=0.09, startFrame?=0, loopFrom?=0 }
   *   loopFrom — index the loop restarts at, so intro frames play only once.
   * Returns { kill() }.
   */
  function spriteLoop(frames, opts) {
    var g = typeof gsap !== "undefined" ? gsap : null;
    if (!g) throw new Error("[mascot] GSAP must be loaded before spriteLoop()");
    opts = opts || {};
    var els = g.utils.toArray(frames);
    if (!els.length) throw new Error("[mascot] spriteLoop: no frames");
    var getDelay = opts.getDelay || function () { return opts.frameDuration || 0.09; };
    var loopFrom = opts.loopFrom || 0;
    var i = opts.startFrame || 0;
    var killed = false, pending = null;

    els.forEach(function (el, n) { g.set(el, { display: n === i ? "" : "none" }); });

    function step() {
      if (killed) return;
      g.set(els[i], { display: "none" });
      i = i + 1 < els.length ? i + 1 : loopFrom;
      g.set(els[i], { display: "" });
      pending = g.delayedCall(getDelay(i), step);
    }
    pending = g.delayedCall(getDelay(i), step);

    return {
      kill: function () { killed = true; if (pending) pending.kill(); }
    };
  }

  return {
    version: "1.0.0",
    create: function (target, options) { return new MascotController(target, options); },
    spriteLoop: spriteLoop
  };
});
