import * as THREE from 'three';
import { Cloth } from './cloth.js';
import { toon, rand, pick } from './materials.js';

const S = 512;     // texture size
const MS = 96;     // mask size

// outline paths in normalised canvas space (x right, y DOWN, 0..1)
function P(cmds) {
  return (s) => {
    const p = new Path2D();
    for (const c of cmds) {
      const [op, ...a] = c;
      const v = a.map((n) => n * s);
      if (op === 'M') p.moveTo(...v);
      else if (op === 'L') p.lineTo(...v);
      else if (op === 'Q') p.quadraticCurveTo(...v);
      else if (op === 'C') p.bezierCurveTo(...v);
      else if (op === 'Z') p.closePath();
    }
    return p;
  };
}
function roundRect(x, y, w, h, r) {
  return (s) => { const p = new Path2D(); p.roundRect(x * s, y * s, w * s, h * s, r * s); return p; };
}

export const TYPES = {
  bandana: {
    name: 'Bandana', W: 0.44, H: 0.44, nx: 14, ny: 14, value: 3, tough: 0.8, bend: 0.12, stains: [1, 2],
    path: roundRect(0.03, 0.03, 0.94, 0.94, 0.05), patterns: ['paisley', 'dots', 'gingham'],
    folds: [{ ax: 'z', t: 0.5, s: 1 }, { ax: 'x', t: 0.5, s: -1 }],
    detail(g, s, c) { g.strokeStyle = c.b; g.lineWidth = s * 0.035; g.strokeRect(s * 0.1, s * 0.1, s * 0.8, s * 0.8); },
  },
  sock: {
    name: 'Sock', W: 0.24, H: 0.46, nx: 8, ny: 16, value: 4, tough: 1.0, bend: 0.3, stains: [1, 2],
    path: P([['M', 0.12, 0.0], ['L', 0.72, 0.0], ['L', 0.74, 0.6], ['Q', 0.99, 0.66, 0.98, 0.84], ['Q', 0.96, 1.0, 0.74, 1.0], ['L', 0.34, 1.0], ['Q', 0.08, 1.0, 0.12, 0.76], ['Z']]),
    patterns: ['stripes', 'dots', 'solid'],
    folds: [{ ax: 'z', t: 0.5, s: -1 }],
    detail(g, s, c) {
      g.fillStyle = c.b; g.fillRect(0, 0, s, s * 0.16);
      g.fillStyle = 'rgba(255,255,255,.35)'; for (let y = 0.02; y < 0.15; y += 0.04) g.fillRect(0, y * s, s, s * 0.012);
      g.fillStyle = c.b; g.beginPath(); g.ellipse(s * 0.84, s * 0.86, s * 0.2, s * 0.2, 0, 0, 7); g.fill();
      g.beginPath(); g.ellipse(s * 0.22, s * 0.86, s * 0.14, s * 0.2, 0, 0, 7); g.fill();
    },
  },
  tshirt: {
    name: 'T-shirt', W: 0.72, H: 0.74, nx: 24, ny: 24, value: 7, tough: 1.0, bend: 0.18, stains: [2, 3],
    path: P([['M', 0.37, 0.03], ['Q', 0.5, 0.15, 0.63, 0.03], ['L', 0.8, 0.07], ['Q', 0.92, 0.12, 0.99, 0.27], ['L', 0.88, 0.4], ['L', 0.78, 0.33], ['L', 0.79, 0.95], ['Q', 0.5, 0.99, 0.21, 0.95], ['L', 0.22, 0.33], ['L', 0.12, 0.4], ['L', 0.01, 0.27], ['Q', 0.08, 0.12, 0.2, 0.07], ['Z']]),
    patterns: ['solid', 'stripes', 'stars', 'hearts'],
    folds: [{ ax: 'x', t: 0.3, s: -1 }, { ax: 'x', t: 0.57, s: 1 }, { ax: 'z', t: 0.5, s: 1 }],
    detail(g, s, c) {
      g.strokeStyle = c.b; g.lineWidth = s * 0.035; g.lineCap = 'round';
      g.beginPath(); g.moveTo(s * 0.37, s * 0.04); g.quadraticCurveTo(s * 0.5, s * 0.16, s * 0.63, s * 0.04); g.stroke();
      stitch(g, [[0.22, 0.91], [0.5, 0.95], [0.78, 0.91]], s);
      stitch(g, [[0.03, 0.29], [0.13, 0.37]], s); stitch(g, [[0.97, 0.29], [0.87, 0.37]], s);
      if (c.emblem) { g.fillStyle = c.b; g.beginPath(); g.arc(s * 0.5, s * 0.42, s * 0.09, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.85)'; star(g, s * 0.5, s * 0.42, s * 0.06); }
    },
  },
  towel: {
    name: 'Towel', W: 0.56, H: 0.84, nx: 17, ny: 26, value: 9, tough: 1.2, bend: 0.45, stains: [2, 3],
    path: roundRect(0.02, 0.01, 0.96, 0.98, 0.04), patterns: ['bands'],
    folds: [{ ax: 'x', t: 0.5, s: -1 }, { ax: 'z', t: 0.5, s: 1 }, { ax: 'z', t: 0.5, s: -1 }],
    detail(g, s, c) {
      g.fillStyle = 'rgba(255,255,255,.18)';
      for (let x = 0; x < s; x += 6) g.fillRect(x, 0, 2, s);
      g.fillStyle = c.b; g.fillRect(0, s * 0.1, s, s * 0.05); g.fillRect(0, s * 0.85, s, s * 0.05);
    },
  },
  shorts: {
    name: 'Shorts', W: 0.58, H: 0.5, nx: 20, ny: 17, value: 11, tough: 1.15, bend: 0.3, stains: [2, 3],
    path: P([['M', 0.06, 0.02], ['L', 0.94, 0.02], ['L', 0.99, 0.94], ['L', 0.56, 0.98], ['L', 0.5, 0.42], ['L', 0.44, 0.98], ['L', 0.01, 0.94], ['Z']]),
    patterns: ['solid', 'plaid'],
    folds: [{ ax: 'x', t: 0.5, s: -1 }, { ax: 'z', t: 0.5, s: 1 }],
    detail(g, s, c) {
      g.fillStyle = c.b; g.fillRect(0, s * 0.02, s, s * 0.1);
      g.strokeStyle = '#fff'; g.lineWidth = s * 0.012; g.beginPath(); g.moveTo(s * 0.47, s * 0.12); g.quadraticCurveTo(s * 0.44, s * 0.25, s * 0.4, s * 0.27); g.moveTo(s * 0.53, s * 0.12); g.quadraticCurveTo(s * 0.56, s * 0.25, s * 0.6, s * 0.27); g.stroke();
      stitch(g, [[0.03, 0.9], [0.43, 0.94]], s); stitch(g, [[0.57, 0.94], [0.97, 0.9]], s);
    },
  },
  dress: {
    name: 'Sundress', W: 0.64, H: 0.96, nx: 20, ny: 30, value: 16, tough: 1.3, bend: 0.1, stains: [2, 4],
    path: P([['M', 0.3, 0.0], ['L', 0.36, 0.0], ['Q', 0.5, 0.14, 0.64, 0.0], ['L', 0.7, 0.0], ['L', 0.72, 0.3], ['Q', 0.67, 0.36, 0.7, 0.42], ['L', 0.99, 0.96], ['Q', 0.5, 1.02, 0.01, 0.96], ['L', 0.3, 0.42], ['Q', 0.33, 0.36, 0.28, 0.3], ['Z']]),
    patterns: ['flowers', 'dots', 'gingham'],
    folds: [{ ax: 'x', t: 0.33, s: -1 }, { ax: 'x', t: 0.5, s: 1 }, { ax: 'z', t: 0.5, s: 1 }],
    detail(g, s, c) { g.fillStyle = c.b; g.fillRect(0, s * 0.39, s, s * 0.035); stitch(g, [[0.03, 0.93], [0.5, 0.98], [0.97, 0.93]], s); },
  },
  jeans: {
    name: 'Jeans', W: 0.52, H: 0.96, nx: 16, ny: 30, value: 20, tough: 1.5, bend: 0.5, stains: [3, 4],
    path: P([['M', 0.08, 0.0], ['L', 0.92, 0.0], ['L', 0.98, 0.99], ['L', 0.59, 1.0], ['L', 0.5, 0.3], ['L', 0.41, 1.0], ['L', 0.02, 0.99], ['Z']]),
    patterns: ['denim'],
    folds: [{ ax: 'x', t: 0.5, s: -1 }, { ax: 'z', t: 0.5, s: 1 }, { ax: 'z', t: 0.5, s: 1 }],
    detail(g, s, c) {
      g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, 0, s, s * 0.06);
      stitch(g, [[0.08, 0.06], [0.92, 0.06]], s, '#f2a33a');
      stitch(g, [[0.12, 0.08], [0.2, 0.2], [0.34, 0.2]], s, '#f2a33a'); stitch(g, [[0.88, 0.08], [0.8, 0.2], [0.66, 0.2]], s, '#f2a33a');
      stitch(g, [[0.5, 0.06], [0.5, 0.28]], s, '#f2a33a');
      g.fillStyle = '#d9a441'; g.beginPath(); g.arc(s * 0.5, s * 0.03, s * 0.016, 0, 7); g.fill();
    },
  },
};

export const UNLOCKS = [['bandana', 'sock', 'tshirt'], ['towel'], ['shorts'], ['dress'], ['jeans']];

const PALETTES = [
  { a: '#ff7a8a', b: '#fff1e6' }, { a: '#ffc23d', b: '#ff8a3d' }, { a: '#55c8a8', b: '#eafff6' },
  { a: '#5aa8ff', b: '#ffffff' }, { a: '#a98bff', b: '#fff1fb' }, { a: '#ff9a62', b: '#fff6d8' },
  { a: '#2fb7b3', b: '#ffd36b' }, { a: '#ff6f61', b: '#fff4dc' }, { a: '#8fd16a', b: '#fffbe6' },
  { a: '#f78fc6', b: '#ffffff' },
];
const DENIM = { a: '#4a78b8', b: '#365c94' };

export const STAINS = [
  { name: 'mud', c: '#6b4426', c2: '#4a2c16' },
  { name: 'ketchup', c: '#c8261e', c2: '#8f150f' },
  { name: 'grass', c: '#4f8f2a', c2: '#2f5e14' },
  { name: 'coffee', c: '#8a5a2b', c2: '#5e3a18' },
  { name: 'grape', c: '#6a2a7e', c2: '#3f1250' },
  { name: 'ink', c: '#27449a', c2: '#14256a' },
];

function stitch(g, pts, s, color = 'rgba(255,255,255,.7)') {
  g.save(); g.strokeStyle = color; g.lineWidth = s * 0.008; g.setLineDash([s * 0.018, s * 0.014]);
  g.beginPath(); g.moveTo(pts[0][0] * s, pts[0][1] * s);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0] * s, pts[i][1] * s);
  g.stroke(); g.restore();
}
function star(g, x, y, r) {
  g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i & 1 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fill();
}
function heart(g, x, y, r) {
  g.beginPath(); g.moveTo(x, y + r * 0.7);
  g.bezierCurveTo(x - r * 1.2, y - r * 0.1, x - r * 0.5, y - r * 1.0, x, y - r * 0.35);
  g.bezierCurveTo(x + r * 0.5, y - r * 1.0, x + r * 1.2, y - r * 0.1, x, y + r * 0.7); g.fill();
}

function drawPattern(g, s, pat, c, aspect) {
  // aspect = W/H, so patterns look round on the actual garment
  const sy = aspect;
  g.fillStyle = c.a; g.fillRect(0, 0, s, s);
  if (pat === 'stripes') { g.fillStyle = c.b; for (let y = 0; y < s; y += s * 0.09 * sy) g.fillRect(0, y, s, s * 0.04 * sy); }
  else if (pat === 'bands') { g.fillStyle = c.b; for (let y = s * 0.2; y < s * 0.8; y += s * 0.12) g.fillRect(0, y, s, s * 0.025); }
  else if (pat === 'dots') { g.fillStyle = c.b; for (let y = 0, r = 0; y < s * 1.1; y += s * 0.08 * sy, r++) for (let x = (r & 1) * s * 0.04; x < s * 1.1; x += s * 0.08) { g.beginPath(); g.ellipse(x, y, s * 0.016, s * 0.016 * sy, 0, 0, 7); g.fill(); } }
  else if (pat === 'gingham' || pat === 'plaid') {
    g.fillStyle = c.b; g.globalAlpha = 0.45;
    const st = s * (pat === 'plaid' ? 0.12 : 0.07);
    for (let x = 0; x < s; x += st * 2) g.fillRect(x, 0, st, s);
    for (let y = 0; y < s; y += st * 2 * sy) g.fillRect(0, y, s, st * sy);
    g.globalAlpha = 1;
    if (pat === 'plaid') { g.strokeStyle = c.b; g.lineWidth = 3; for (let x = st * 0.5; x < s; x += st * 2) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, s); g.stroke(); } }
  }
  else if (pat === 'stars') { g.fillStyle = c.b; for (let y = s * 0.05, r = 0; y < s; y += s * 0.13 * sy, r++) for (let x = s * 0.06 + (r & 1) * s * 0.065; x < s; x += s * 0.13) { g.save(); g.translate(x, y); g.scale(1, sy); star(g, 0, 0, s * 0.03); g.restore(); } }
  else if (pat === 'hearts') { g.fillStyle = c.b; for (let y = s * 0.05, r = 0; y < s; y += s * 0.12 * sy, r++) for (let x = s * 0.06 + (r & 1) * s * 0.06; x < s; x += s * 0.12) { g.save(); g.translate(x, y); g.scale(1, sy); heart(g, 0, 0, s * 0.025); g.restore(); } }
  else if (pat === 'flowers') {
    for (let y = s * 0.04, r = 0; y < s; y += s * 0.11 * sy, r++) for (let x = s * 0.05 + (r & 1) * s * 0.06; x < s; x += s * 0.12) {
      g.save(); g.translate(x, y); g.scale(1, sy); g.fillStyle = c.b;
      for (let k = 0; k < 5; k++) { const a = k * 1.2566; g.beginPath(); g.arc(Math.cos(a) * s * 0.016, Math.sin(a) * s * 0.016, s * 0.012, 0, 7); g.fill(); }
      g.fillStyle = '#ffc93c'; g.beginPath(); g.arc(0, 0, s * 0.009, 0, 7); g.fill(); g.restore();
    }
  }
  else if (pat === 'paisley') {
    g.fillStyle = c.b; for (let y = s * 0.15, r = 0; y < s; y += s * 0.16 * sy, r++) for (let x = s * 0.12 + (r & 1) * s * 0.08; x < s; x += s * 0.16) {
      g.save(); g.translate(x, y); g.rotate(0.7); g.beginPath(); g.ellipse(0, 0, s * 0.035, s * 0.02, 0, 0, 7); g.fill();
      g.fillStyle = c.a; g.beginPath(); g.arc(-s * 0.008, 0, s * 0.008, 0, 7); g.fill(); g.fillStyle = c.b; g.restore();
    }
  }
  else if (pat === 'denim') {
    for (let i = 0; i < 9000; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,40,.08)'; g.fillRect(Math.random() * s, Math.random() * s, 3, 1); }
    const grd = g.createRadialGradient(s * 0.3, s * 0.4, 10, s * 0.3, s * 0.4, s * 0.3); grd.addColorStop(0, 'rgba(255,255,255,.12)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, s, s);
  }
}

let weave = null;
function weavePattern(g) {
  if (!weave) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const w = c.getContext('2d');
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const v = ((x + y) & 3) === 0 ? 255 : ((x ^ y) & 1) ? 0 : 128;
      w.fillStyle = `rgba(${v},${v},${v},${0.05 + Math.random() * 0.06})`; w.fillRect(x, y, 1, 1);
    }
    weave = c;
  }
  return g.createPattern(weave, 'repeat');
}

function blobPath(g, x, y, r, sy, n = 14) {
  g.beginPath();
  const ph = Math.random() * 6, k = 2 + ((Math.random() * 3) | 0);
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (0.72 + 0.22 * Math.sin(a * k + ph) + 0.12 * Math.random());
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * sy;
    i ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.closePath();
}

let probe = null;
function getProbe() {
  if (!probe) { probe = document.createElement('canvas'); probe.width = probe.height = MS; probe.ctx = probe.getContext('2d', { willReadFrequently: true }); }
  return probe;
}

export class Garment {
  constructor(typeId) {
    const T = TYPES[typeId];
    this.typeId = typeId; this.type = T;
    const colors = typeId === 'jeans' ? { ...DENIM } : { ...pick(PALETTES) };
    colors.emblem = Math.random() < 0.4;
    this.colors = colors;
    this.pattern = pick(T.patterns);
    this.path = T.path(S);

    // mask
    const m = document.createElement('canvas'); m.width = m.height = MS;
    const mg = m.getContext('2d', { willReadFrequently: true });
    mg.fill(T.path(MS));
    const md = mg.getImageData(0, 0, MS, MS).data;
    this.mask = new Uint8Array(MS * MS);
    let cnt = 0;
    for (let i = 0; i < MS * MS; i++) { this.mask[i] = md[i * 4 + 3] > 127 ? 1 : 0; cnt += this.mask[i]; }
    this.maskCount = cnt;
    const inside = (u, v) => {
      const x = Math.min(MS - 1, Math.max(0, Math.floor(u * MS))), y = Math.min(MS - 1, Math.max(0, Math.floor((1 - v) * MS)));
      return this.mask[y * MS + x] === 1;
    };

    // canvases
    const mk = () => { const c = document.createElement('canvas'); c.width = c.height = S; return c; };
    this.base = mk(); this.stain = mk(); this.foam = mk(); this.map = mk();
    this.bctx = this.base.getContext('2d'); this.sctx = this.stain.getContext('2d'); this.fctx = this.foam.getContext('2d'); this.mctx = this.map.getContext('2d');
    this.drawBase();
    this.drawStains();
    this.texture = new THREE.CanvasTexture(this.map);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
    this.composite();

    this.cloth = new Cloth({ nx: T.nx, ny: T.ny, width: T.W, height: T.H, inside, bend: T.bend });
    this.material = toon(0xffffff, { map: this.texture, side: THREE.DoubleSide, alphaTest: 0.5, backDarken: 0.8, rim: 0.32 });
    this.mesh = new THREE.Mesh(this.cloth.geometry, this.material);
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: this.texture, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh.frustumCulled = false;
    this.mesh.userData.garment = this;

    this.state = 'new';
    this.wet = 0; this.clean = false; this.dry = true;
    this.stain0 = Math.max(0.0001, this.coverage(this.stain));
    this.layer = 0;
    // top row & bottom row particles
    let jmax = 0, jmin = 1e9;
    for (let k = 0; k < this.cloth.n; k++) { jmax = Math.max(jmax, this.cloth.gj[k]); jmin = Math.min(jmin, this.cloth.gj[k]); }
    this.topRow = []; this.botRow = [];
    for (let k = 0; k < this.cloth.n; k++) { if (this.cloth.gj[k] === jmax) this.topRow.push(k); if (this.cloth.gj[k] === jmin) this.botRow.push(k); }
    this.setWet(0);
  }

  drawBase() {
    const g = this.bctx, T = this.type, c = this.colors;
    g.clearRect(0, 0, S, S);
    g.save();
    g.clip(this.path);
    drawPattern(g, S, this.pattern, c, T.W / T.H);
    T.detail?.(g, S, c);
    g.fillStyle = weavePattern(g); g.fillRect(0, 0, S, S);
    // soft inner edge shading (hem)
    g.lineWidth = S * 0.035; g.strokeStyle = 'rgba(80,40,30,.22)'; g.stroke(this.path);
    g.lineWidth = S * 0.012; g.strokeStyle = 'rgba(255,255,255,.25)'; g.setLineDash([S * 0.016, S * 0.012]);
    g.restore();
  }

  drawStains() {
    const g = this.sctx, T = this.type;
    g.clearRect(0, 0, S, S);
    g.save(); g.clip(this.path);
    const n = T.stains[0] + ((Math.random() * (T.stains[1] - T.stains[0] + 1)) | 0);
    const sy = T.W / T.H;
    this.stainKinds = [];
    for (let i = 0; i < n; i++) {
      let x = 0, y = 0;
      for (let t = 0; t < 60; t++) {
        x = rand(0.15, 0.85); y = rand(0.15, 0.85);
        const mx = Math.floor(x * MS), my = Math.floor(y * MS);
        if (this.mask[my * MS + mx]) break;
      }
      const st = pick(STAINS); this.stainKinds.push(st.name);
      const r = S * rand(0.07, 0.13) * Math.min(1.6, 0.5 / Math.max(0.25, T.W));
      g.filter = 'blur(1.5px)';
      g.globalAlpha = 0.9; g.fillStyle = st.c; blobPath(g, x * S, y * S, r, sy); g.fill();
      g.globalAlpha = 0.55; g.fillStyle = st.c2; blobPath(g, x * S + rand(-r, r) * 0.2, y * S + rand(-r, r) * 0.2 * sy, r * 0.55, sy); g.fill();
      g.globalAlpha = 0.85; g.fillStyle = st.c;
      const drops = 3 + ((Math.random() * 5) | 0);
      for (let d = 0; d < drops; d++) {
        const a = rand(0, 6.28), dist = r * rand(1.1, 1.9), rr = r * rand(0.08, 0.2);
        g.beginPath(); g.ellipse(x * S + Math.cos(a) * dist, y * S + Math.sin(a) * dist * sy, rr, rr * sy, 0, 0, 7); g.fill();
      }
      g.filter = 'none';
    }
    g.restore();
    g.globalAlpha = 1;
  }

  composite() {
    const g = this.mctx;
    g.clearRect(0, 0, S, S);
    g.globalCompositeOperation = 'source-over';
    g.drawImage(this.base, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.drawImage(this.stain, 0, 0);
    g.globalAlpha = 0.82; g.drawImage(this.foam, 0, 0); g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    this.texture.needsUpdate = true;
  }

  coverage(canvas) {
    const p = getProbe(), g = p.ctx;
    g.clearRect(0, 0, MS, MS);
    g.drawImage(canvas, 0, 0, MS, MS);
    const d = g.getImageData(0, 0, MS, MS).data;
    let sum = 0;
    for (let i = 0; i < MS * MS; i++) if (this.mask[i]) sum += d[i * 4 + 3];
    return sum / (255 * this.maskCount);
  }

  // brush helpers in uv space; r in metres
  _brush(ctx, u, v, r, fn) {
    const T = this.type, x = u * S, y = (1 - v) * S;
    const rx = r / T.W * S, ry = r / T.H * S;
    ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx); fn(ctx, rx); ctx.restore();
  }
  erase(canvas, ctx, u, v, r, strength) {
    this._brush(ctx, u, v, r, (g, R) => {
      g.globalCompositeOperation = 'destination-out';
      const grd = g.createRadialGradient(0, 0, 0, 0, 0, R);
      grd.addColorStop(0, `rgba(0,0,0,${Math.min(1, strength)})`);
      grd.addColorStop(0.6, `rgba(0,0,0,${Math.min(1, strength * 0.7)})`);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd; g.beginPath(); g.arc(0, 0, R, 0, 7); g.fill();
      g.globalCompositeOperation = 'source-over';
    });
  }
  addFoam(u, v, r, amount) {
    this._brush(this.fctx, u, v, r, (g, R) => {
      const n = Math.ceil(4 * amount);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.28, d = Math.random() * R * 0.9, rr = R * rand(0.12, 0.32);
        const x = Math.cos(a) * d, y = Math.sin(a) * d;
        g.fillStyle = `rgba(255,255,255,${rand(0.55, 0.9)})`;
        g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill();
        if (Math.random() < 0.5) { g.strokeStyle = 'rgba(170,200,235,.7)'; g.lineWidth = 1.5; g.beginPath(); g.arc(x + rr * 0.3, y - rr * 0.2, rr * 0.45, 0, 7); g.stroke(); }
      }
    });
  }

  setWet(w) {
    this.wet = Math.max(0, Math.min(1, w));
    const k = this.wet;
    this.material.color.setRGB(1 - 0.34 * k, 1 - 0.31 * k, 1 - 0.24 * k);
    this.material.userData.rim.value = 0.32 + 0.25 * k;
  }

  setHighlight(on) { this.material.emissive.setRGB(on ? 0.16 : 0, on ? 0.11 : 0, on ? 0.05 : 0); }

  dispose() {
    this.cloth.geometry.dispose(); this.material.dispose(); this.texture.dispose(); this.mesh.customDepthMaterial.dispose();
  }
}
