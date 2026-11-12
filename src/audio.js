// All sounds are synthesised with WebAudio: no asset files.
export class Audio {
  constructor() {
    this.ctx = null; this.sfxOn = true; this.musicOn = true;
    this._last = {};
  }
  unlock() {
    if (this.ctx) { this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const ctx = this.ctx = new C();
    this.master = ctx.createGain(); this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3;
    this.master.connect(comp); comp.connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxOn ? 1 : 0; this.sfx.connect(this.master);
    this.mus = ctx.createGain(); this.mus.gain.value = this.musicOn ? 0.16 : 0; this.mus.connect(this.master);
    // reverb-ish delay for sparkle
    this.verb = ctx.createConvolver(); this.verb.buffer = this._impulse(1.6); const vg = ctx.createGain(); vg.gain.value = 0.25; this.verb.connect(vg); vg.connect(this.master);
    const len = ctx.sampleRate * 2; const nb = ctx.createBuffer(1, len, ctx.sampleRate); const d = nb.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = nb;
    this.loops = {
      scrub: this._loop('bandpass', 2200, 0.8),
      pour: this._loop('lowpass', 1100, 0.5),
      whoosh: this._loop('bandpass', 500, 1.2),
      wring: this._loop('bandpass', 380, 6),
    };
    this._music();
  }
  _impulse(sec) {
    const ctx = this.ctx, n = ctx.sampleRate * sec, b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3); }
    return b;
  }
  _loop(type, f, q) {
    const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const filt = ctx.createBiquadFilter(); filt.type = type; filt.frequency.value = f; filt.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(filt); filt.connect(g); g.connect(this.sfx); src.start();
    return { filt, g, base: f };
  }
  setLoop(name, v, fmul = 1) {
    if (!this.ctx) return;
    const L = this.loops[name], t = this.ctx.currentTime;
    L.g.gain.setTargetAtTime(Math.max(0, v), t, 0.05);
    L.filt.frequency.setTargetAtTime(L.base * fmul, t, 0.05);
  }
  setSfx(on) { this.sfxOn = on; if (this.ctx) this.sfx.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.05); }
  setMusic(on) { this.musicOn = on; if (this.ctx) this.mus.gain.setTargetAtTime(on ? 0.16 : 0, this.ctx.currentTime, 0.3); }

  _rate(name, ms) { const now = performance.now(); if (this._last[name] && now - this._last[name] < ms) return false; this._last[name] = now; return true; }
  _tone(type, f0, f1, dur, vol, { at = 0, attack = 0.004, dest = null, verb = 0 } = {}) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfx); if (verb) { const vg = this.ctx.createGain(); vg.gain.value = verb; g.connect(vg); vg.connect(this.verb); }
    o.start(t); o.stop(t + dur + 0.05);
  }
  _noise(dur, vol, type, f0, f1, q = 1, at = 0) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime + at, s = ctx.createBufferSource(); s.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(0.03, dur * 0.3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfx); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  pop() { if (!this._rate('pop', 45)) return; const f = 700 + Math.random() * 900; this._tone('sine', f, f * 1.8, 0.06, 0.12); }
  drip(high = false) { if (!this._rate('drip', 60)) return; const f = (high ? 1400 : 900) + Math.random() * 500; this._tone('sine', f, f * 0.45, 0.09, 0.13, { verb: 0.4 }); }
  click() { this._noise(0.04, 0.35, 'highpass', 3000, 2500, 1); this._tone('square', 1800, 900, 0.03, 0.05); }
  grab() { this._noise(0.18, 0.25, 'bandpass', 400, 1600, 1.2); }
  plop() { this._tone('sine', 220, 90, 0.18, 0.3); this._noise(0.12, 0.15, 'lowpass', 900, 300, 1); }
  fold() { this._noise(0.28, 0.3, 'bandpass', 500, 2400, 1.4); this._tone('sine', 300, 420, 0.12, 0.06, { at: 0.18 }); }
  pin() { this.click(); this._tone('triangle', 1600, 1700, 0.05, 0.06, { at: 0.03 }); }
  coin(i = 0) {
    if (!this._rate('coin' + (i % 3), 40)) return;
    const b = 988 * Math.pow(2, (i % 5) / 24);
    this._tone('triangle', b, b, 0.08, 0.12); this._tone('triangle', b * 1.335, b * 1.335, 0.22, 0.12, { at: 0.06, verb: 0.3 });
  }
  sparkle() { [0, 1, 2, 3].forEach((i) => this._tone('sine', 1568 * Math.pow(1.26, i), 1568 * Math.pow(1.26, i), 0.25, 0.05, { at: i * 0.05, verb: 0.6 })); }
  success() { [523, 659, 784, 1047].forEach((f, i) => this._tone('triangle', f, f, 0.32, 0.14, { at: i * 0.075, verb: 0.4 })); }
  buy() { [784, 988, 1175].forEach((f, i) => this._tone('triangle', f, f, 0.18, 0.12, { at: i * 0.05, verb: 0.3 })); }
  deny() { this._tone('square', 220, 180, 0.12, 0.05); }
  fanfare() {
    const seq = [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.36], [784, 0.52], [1047, 0.64]];
    seq.forEach(([f, t]) => { this._tone('triangle', f, f, 0.35, 0.15, { at: t, verb: 0.4 }); this._tone('sine', f / 2, f / 2, 0.35, 0.08, { at: t }); });
    [523, 659, 784, 1047].forEach((f) => this._tone('triangle', f, f, 1.4, 0.07, { at: 0.8, attack: 0.05, verb: 0.6 }));
    this._noise(1.2, 0.08, 'highpass', 6000, 9000, 0.5, 0.8);
  }
  splash() { this._noise(0.35, 0.3, 'lowpass', 2500, 500, 0.8); }

  _music() {
    const ctx = this.ctx, bpm = 84, beat = 60 / bpm;
    const chords = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]];
    const scale = [60, 62, 64, 67, 69, 72, 74, 76];
    const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
    let next = ctx.currentTime + 0.3, step = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; lp.connect(this.mus);
    const pluck = (m, t, v) => {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = mtof(m);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      o.connect(g); g.connect(lp); const vg = ctx.createGain(); vg.gain.value = 0.5; g.connect(vg); vg.connect(this.verb); o.start(t); o.stop(t + 1.2);
    };
    const pad = (notes, t, dur) => {
      for (const m of notes) for (const det of [-6, 6]) {
        const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = mtof(m - 12); o.detune.value = det;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + dur * 0.4); g.gain.linearRampToValueAtTime(0, t + dur);
        o.connect(g); g.connect(lp); o.start(t); o.stop(t + dur + 0.1);
      }
    };
    const tick = () => {
      while (next < ctx.currentTime + 0.5) {
        const bar = Math.floor(step / 8) % 4, s8 = step % 8;
        if (s8 === 0) { pad(chords[bar], next, beat * 4.2); pluck(chords[bar][0] - 12, next, 0.12); }
        if (s8 === 4) pluck(chords[bar][2] - 12, next, 0.08);
        if (Math.random() < (s8 % 2 ? 0.25 : 0.5)) pluck(scale[(Math.random() * scale.length) | 0], next, 0.05 + Math.random() * 0.04);
        next += beat / 2; step++;
      }
    };
    setInterval(tick, 120);
  }
}
