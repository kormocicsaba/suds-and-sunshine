import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toon, canvasTex, rand } from './materials.js';
import { Cloth } from './cloth.js';

// ---------- layout (metres) ----------
export const L = {
  basket: { x: -2.35, z: 0.35, rin: 0.52, rout: 0.58, rimY: 0.5, floorY: 0.06 },
  bench: { x0: -1.55, x1: 0.45, z0: -0.35, z1: 0.7, top: 0.8 },
  tub: { x: -1.05, z: 0.18, r: 0.31, top: 1.08, water: 1.03 },
  mat: { x: -0.1, z: 0.18, w: 0.98, d: 0.98, top: 0.814 },
  line: { x0: 0.7, x1: 3.0, z: -1.3, y: 2.14, sag: 0.09 },
  fold: { x0: 1.1, x1: 2.8, z0: 0.12, z1: 1.08, top: 0.8, fx: 1.6, fz: 0.6, sx: 2.43, sz: 0.62 },
  wallZ: -2.2,
  machine: { x: -3.45, z: -1.25 },
};
export function ropeY(x) {
  const m = (L.line.x0 + L.line.x1) / 2, h = (L.line.x1 - L.line.x0) / 2, t = (x - m) / h;
  return L.line.y - L.line.sag * (1 - t * t);
}

const rbox = (w, h, d, r = 0.02, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
export function mesh(geo, mat, { x = 0, y = 0, z = 0, cast = true, recv = true, parent = null } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = recv;
  if (parent) parent.add(m);
  return m;
}

// ---------- textures ----------
function woodFloor() {
  return canvasTex(1024, 1024, (g, w, h) => {
    const cols = ['#d99a5e', '#cf8f55', '#e2a76a', '#c98a50', '#dba062'];
    const ph = h / 8;
    for (let r = 0; r < 8; r++) {
      let x = -((r * 397) % 600);
      while (x < w) {
        const len = 380 + ((r * 131 + x) % 260);
        g.fillStyle = cols[(r * 3 + Math.abs(x) / 7 | 0) % cols.length];
        g.fillRect(x, r * ph, len, ph);
        g.globalAlpha = 0.12;
        for (let k = 0; k < 6; k++) { g.fillStyle = k & 1 ? '#8a5530' : '#f6c48c'; g.fillRect(x, r * ph + rand(4, ph - 4), len, rand(1, 3)); }
        g.globalAlpha = 1;
        g.fillStyle = 'rgba(90,50,25,.55)'; g.fillRect(x, r * ph, 3, ph);
        x += len;
      }
      g.fillStyle = 'rgba(90,50,25,.5)'; g.fillRect(0, r * ph, w, 3);
      g.fillStyle = 'rgba(255,230,190,.25)'; g.fillRect(0, r * ph + 3, w, 2);
    }
  }, { repeat: [3.2, 2.4] });
}
function wallpaper() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#fbe6cc'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 64) { g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x, 0, 22, h); }
    for (let y = 32, r = 0; y < h; y += 96, r++) for (let x = 32 + (r & 1) * 64; x < w + 64; x += 128) {
      g.save(); g.translate(x, y);
      g.strokeStyle = '#9cc59a'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 14); g.quadraticCurveTo(4, 0, 0, -10); g.stroke();
      g.fillStyle = '#9cc59a'; g.beginPath(); g.ellipse(-7, 4, 7, 3.5, -0.6, 0, 7); g.fill(); g.beginPath(); g.ellipse(7, 0, 7, 3.5, 0.6, 0, 7); g.fill();
      g.fillStyle = '#ff9a7a'; for (let k = 0; k < 5; k++) { const a = k * 1.256; g.beginPath(); g.arc(Math.cos(a) * 5, -12 + Math.sin(a) * 5, 4, 0, 7); g.fill(); }
      g.fillStyle = '#ffd26b'; g.beginPath(); g.arc(0, -12, 3, 0, 7); g.fill();
      g.restore();
    }
  }, { repeat: [5, 1.4] });
}
function wainscot() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#93c4a4'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32) { g.fillStyle = 'rgba(40,90,70,.28)'; g.fillRect(x, 0, 3, h); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x + 3, 0, 3, h); }
  }, { repeat: [14, 1] });
}
function wicker() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#c98f4f'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 32) {
      const o = ((y / 16) & 1) * 16;
      const grd = g.createLinearGradient(0, y, 0, y + 16);
      grd.addColorStop(0, '#f0c27e'); grd.addColorStop(0.5, '#dca460'); grd.addColorStop(1, '#a86f36');
      g.fillStyle = grd; g.beginPath(); g.roundRect(x + o + 2, y + 2, 28, 12, 6); g.fill();
    }
    g.fillStyle = 'rgba(90,50,20,.45)'; for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 3, h);
  }, { repeat: [10, 3] });
}
function staves() {
  return canvasTex(256, 128, (g, w, h) => {
    for (let x = 0; x < w; x += 32) { g.fillStyle = (x / 32) & 1 ? '#c98b52' : '#d89c60'; g.fillRect(x, 0, 32, h); g.fillStyle = 'rgba(80,40,20,.45)'; g.fillRect(x, 0, 2, h); }
    g.fillStyle = '#8f9aa6'; g.fillRect(0, 14, w, 12); g.fillRect(0, h - 26, w, 12);
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(0, 15, w, 3); g.fillRect(0, h - 25, w, 3);
  }, { repeat: [4, 1] });
}
function skyTex() {
  return canvasTex(512, 400, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#79c6f2'); grd.addColorStop(0.65, '#bfe6ff'); grd.addColorStop(1, '#ffe7c4');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,250,220,.9)'; g.beginPath(); g.arc(w * 0.78, h * 0.22, 34, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,240,180,.3)'; g.beginPath(); g.arc(w * 0.78, h * 0.22, 60, 0, 7); g.fill();
    const cloud = (x, y, s) => { g.fillStyle = '#ffffff'; for (const [a, b, r] of [[0, 0, 1], [0.9, 0.15, 0.75], [-0.9, 0.2, 0.7], [0.4, -0.45, 0.75], [-0.4, -0.35, 0.6]]) { g.beginPath(); g.arc(x + a * s, y + b * s, r * s, 0, 7); g.fill(); } g.fillStyle = 'rgba(160,190,230,.35)'; g.fillRect(x - 1.6 * s, y + 0.55 * s, 3.2 * s, 0.3 * s); };
    cloud(110, 120, 28); cloud(330, 80, 20); cloud(240, 190, 16);
    g.fillStyle = '#8fd07a'; g.beginPath(); g.moveTo(0, h * 0.8); g.quadraticCurveTo(w * 0.3, h * 0.6, w * 0.6, h * 0.78); g.quadraticCurveTo(w * 0.85, h * 0.68, w, h * 0.74); g.lineTo(w, h); g.lineTo(0, h); g.fill();
    g.fillStyle = '#6dbb62'; g.beginPath(); g.moveTo(0, h * 0.9); g.quadraticCurveTo(w * 0.5, h * 0.74, w, h * 0.88); g.lineTo(w, h); g.lineTo(0, h); g.fill();
    for (const [x, y, s] of [[90, 300, 26], [420, 288, 30], [460, 300, 20]]) { g.fillStyle = '#7a5236'; g.fillRect(x - 3, y, 6, s * 0.8); g.fillStyle = '#4fa257'; g.beginPath(); g.arc(x, y, s * 0.6, 0, 7); g.fill(); }
  });
}
function blobTex() {
  return canvasTex(128, 128, (g, w, h) => {
    const grd = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    grd.addColorStop(0, 'rgba(60,30,15,.55)'); grd.addColorStop(0.55, 'rgba(60,30,15,.25)'); grd.addColorStop(1, 'rgba(60,30,15,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  }, { srgb: false });
}
function rugTex() {
  return canvasTex(512, 512, (g, w, h) => {
    const rings = ['#ff8f70', '#fff0d6', '#ffc75a', '#fff0d6', '#ff8f70', '#7cc7a8', '#fff0d6', '#ff8f70'];
    rings.forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(256, 256, 252 - i * 30, 0, 7); g.fill(); });
    g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 2; g.setLineDash([6, 8]);
    for (let r = 240; r > 20; r -= 30) { g.beginPath(); g.arc(256, 256, r, 0, 7); g.stroke(); }
  });
}
function stripesTex(a, b) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = a; g.fillRect(0, 0, w, h);
    g.fillStyle = b; for (let x = 0; x < w; x += 64) g.fillRect(x, 0, 26, h);
    g.fillStyle = 'rgba(255,255,255,.25)'; for (let x = 0; x < w; x += 64) g.fillRect(x + 30, 0, 4, h);
  });
}

// ---------- props used by the game ----------
export function makeSponge() {
  const g = new THREE.Group();
  mesh(rbox(0.16, 0.06, 0.1, 0.025), toon(0xffd25a, { rim: 0.5 }), { y: 0.03, parent: g });
  mesh(rbox(0.16, 0.022, 0.1, 0.01), toon(0x5cc489, { rim: 0.4 }), { y: 0.005, parent: g });
  const holes = toon(0xe9b03c);
  for (let i = 0; i < 6; i++) { const s = mesh(new THREE.SphereGeometry(0.008, 8, 6), holes, { x: rand(-0.06, 0.06), y: 0.06, z: rand(-0.035, 0.035), cast: false, parent: g }); s.scale.y = 0.4; }
  return g;
}
export function makePitcher() {
  const g = new THREE.Group();
  const pts = [[0, 0], [0.085, 0], [0.095, 0.03], [0.09, 0.12], [0.075, 0.18], [0.085, 0.22], [0.08, 0.225]].map(([x, y]) => new THREE.Vector2(x, y));
  const body = mesh(new THREE.LatheGeometry(pts, 28), toon(0x7cc7e8, { side: THREE.DoubleSide, rim: 0.55 }), { parent: g });
  mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 20, Math.PI), toon(0x7cc7e8), { x: -0.095, y: 0.11, parent: g }).rotation.set(0, 0, Math.PI / 2);
  const spout = mesh(new THREE.ConeGeometry(0.03, 0.07, 12, 1, true), toon(0x7cc7e8, { side: THREE.DoubleSide }), { x: 0.09, y: 0.21, parent: g });
  spout.rotation.z = -1.2;
  mesh(new THREE.TorusGeometry(0.088, 0.008, 6, 28), toon(0xffffff), { y: 0.06, parent: g }).rotation.x = Math.PI / 2;
  const water = mesh(new THREE.CircleGeometry(0.078, 24), toon(0x5fb6ea, { rim: 0.6 }), { y: 0.19, cast: false, parent: g });
  water.rotation.x = -Math.PI / 2;
  g.userData.spout = new THREE.Vector3(0.12, 0.23, 0);
  g.userData.body = body;
  return g;
}
export function makeGlove() {
  const g = new THREE.Group();
  const m = toon(0xff8fb1, { rim: 0.55 });
  mesh(new THREE.CapsuleGeometry(0.045, 0.1, 6, 12), m, { parent: g }).rotation.z = Math.PI / 2;
  for (let i = 0; i < 4; i++) mesh(new THREE.CapsuleGeometry(0.016, 0.03, 4, 8), m, { x: -0.05 + i * 0.033, y: -0.045, z: 0.03, parent: g }).rotation.x = 0.6;
  mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.04, 16), toon(0xffd25a), { x: 0.1, parent: g }).rotation.z = Math.PI / 2;
  return g;
}
const pinGeo = rbox(0.02, 0.07, 0.016, 0.006);
const pinMats = [0xff8f70, 0x7cc7a8, 0xffc75a, 0x8fb6ff].map((c) => toon(c, { rim: 0.5 }));
export function makePeg() {
  const g = new THREE.Group();
  const m = pinMats[(Math.random() * pinMats.length) | 0];
  mesh(pinGeo, m, { z: 0.009, parent: g, cast: true });
  mesh(pinGeo, m, { z: -0.009, parent: g, cast: true });
  mesh(new THREE.TorusGeometry(0.01, 0.003, 4, 10), toon(0xcfd6de), { y: 0.005, parent: g }).rotation.y = Math.PI / 2;
  return g;
}

// ---------- room ----------
export function buildRoom(scene) {
  const room = new THREE.Group(); scene.add(room);
  const env = { wallZ: L.wallZ, boxes: [], basket: { ...L.basket } };
  const blob = blobTex();
  const blobMat = new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const contact = (x, z, w, d, o = 1) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), o === 1 ? blobMat : blobMat.clone());
    if (o !== 1) m.material.opacity = o;
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.004, z); m.renderOrder = 1; room.add(m); return m;
  };

  // floor & walls
  const floor = mesh(new THREE.PlaneGeometry(16, 12), toon(0xffffff, { map: woodFloor(), rim: 0 }), { z: 2, cast: false, parent: room });
  floor.rotation.x = -Math.PI / 2;
  const wallH = 4.4;
  mesh(new THREE.PlaneGeometry(16, wallH - 1.05), toon(0xffffff, { map: wallpaper(), rim: 0 }), { y: 1.05 + (wallH - 1.05) / 2, z: L.wallZ, cast: false, parent: room });
  mesh(new THREE.PlaneGeometry(16, 1.05), toon(0xffffff, { map: wainscot(), rim: 0 }), { y: 0.525, z: L.wallZ + 0.002, cast: false, parent: room });
  mesh(rbox(16, 0.06, 0.06, 0.02), toon(0xfff4e4), { y: 1.06, z: L.wallZ + 0.03, parent: room });
  mesh(rbox(16, 0.14, 0.04, 0.015), toon(0xfff4e4), { y: 0.07, z: L.wallZ + 0.02, parent: room });
  for (const sx of [-1, 1]) {
    const w = mesh(new THREE.PlaneGeometry(10, wallH), toon(0xffffff, { map: wallpaper(), rim: 0 }), { x: sx * 5.2, y: wallH / 2, z: 2.5, cast: false, parent: room });
    w.rotation.y = -sx * Math.PI / 2;
  }

  // rug
  const rug = mesh(new THREE.CircleGeometry(1.5, 48), toon(0xffffff, { map: rugTex(), rim: 0 }), { x: 0.1, y: 0.006, z: 1.65, cast: false, parent: room });
  rug.rotation.x = -Math.PI / 2; rug.scale.set(1.35, 0.8, 1);

  // window
  const win = { x: 1.85, y: 2.62, w: 1.75, h: 1.35 };
  const sky = mesh(new THREE.PlaneGeometry(win.w, win.h), new THREE.MeshBasicMaterial({ map: skyTex() }), { x: win.x, y: win.y, z: L.wallZ + 0.01, cast: false, recv: false, parent: room });
  const frameM = toon(0xfffaf0, { rim: 0.5 });
  const fw = 0.08;
  mesh(rbox(win.w + fw * 2, fw, 0.08, 0.02), frameM, { x: win.x, y: win.y + win.h / 2 + fw / 2, z: L.wallZ + 0.04, parent: room });
  mesh(rbox(win.w + fw * 2.6, fw * 0.9, 0.2, 0.03), frameM, { x: win.x, y: win.y - win.h / 2 - fw / 2, z: L.wallZ + 0.09, parent: room });
  for (const sx of [-1, 1]) mesh(rbox(fw, win.h, 0.08, 0.02), frameM, { x: win.x + sx * (win.w / 2 + fw / 2), y: win.y, z: L.wallZ + 0.04, parent: room });
  mesh(rbox(0.04, win.h, 0.05, 0.01), frameM, { x: win.x, y: win.y, z: L.wallZ + 0.035, parent: room });
  mesh(rbox(win.w, 0.04, 0.05, 0.01), frameM, { x: win.x, y: win.y + 0.12, z: L.wallZ + 0.035, parent: room });
  // sill plant
  const potM = toon(0xe9825c, { rim: 0.45 });
  mesh(new THREE.CylinderGeometry(0.07, 0.055, 0.11, 16), potM, { x: win.x - 0.55, y: win.y - win.h / 2 + 0.06, z: L.wallZ + 0.1, parent: room });
  const leafM = toon(0x67b866, { rim: 0.55 });
  for (let i = 0; i < 7; i++) { const l = mesh(new THREE.SphereGeometry(0.05, 10, 8), leafM, { x: win.x - 0.55 + rand(-0.05, 0.05), y: win.y - win.h / 2 + 0.16 + rand(0, 0.08), z: L.wallZ + 0.1 + rand(-0.03, 0.03), parent: room }); l.scale.set(0.7, 1.2, 0.7); l.rotation.z = rand(-0.6, 0.6); }

  // curtains (cloth!)
  const rodY = win.y + win.h / 2 + 0.2;
  mesh(new THREE.CylinderGeometry(0.015, 0.015, win.w + 0.9, 10), toon(0xc98b52), { x: win.x, y: rodY, z: L.wallZ + 0.14, parent: room }).rotation.z = Math.PI / 2;
  for (const sx of [-1, 1]) mesh(new THREE.SphereGeometry(0.035, 12, 10), toon(0xc98b52), { x: win.x + sx * (win.w / 2 + 0.45), y: rodY, z: L.wallZ + 0.14, parent: room });
  const curtainTex = stripesTex('#fff3df', '#ffb08f');
  const curtains = [];
  for (const sx of [-1, 1]) {
    const c = new Cloth({ nx: 9, ny: 22, width: 0.62, height: 1.62, inside: () => true, bend: 0.06, density: 0.3 });
    c.iters = 6; c.drag = 1.4; c.damping = 0.99;
    const cx = win.x + sx * (win.w / 2 + 0.08);
    c.place((rx, ry, o) => { o[0] = cx + rx * 0.62; o[1] = rodY - 0.03 + ry - 1.62 / 2; o[2] = L.wallZ + 0.14 + 0.03 * Math.sin(rx * 30); });
    for (let k = 0; k < c.n; k++) if (c.gj[k] === 22) c.setPin(k, c.pos[k * 3], c.pos[k * 3 + 1], c.pos[k * 3 + 2], true);
    const m = mesh(c.geometry, toon(0xffffff, { map: curtainTex, side: THREE.DoubleSide, backDarken: 0.85, rim: 0.35 }), { parent: room });
    m.frustumCulled = false;
    curtains.push({ c, m, phase: sx });
  }

  // light shafts & dust
  const shaftTex = canvasTex(64, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, 'rgba(255,240,200,.55)'); grd.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    const s = g.createLinearGradient(0, 0, w, 0); s.addColorStop(0, 'rgba(0,0,0,1)'); s.addColorStop(0.3, 'rgba(0,0,0,0)'); s.addColorStop(0.7, 'rgba(0,0,0,0)'); s.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = s; g.fillRect(0, 0, w, h);
  }, { srgb: false });
  const shaftMat = new THREE.MeshBasicMaterial({ map: shaftTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.28, side: THREE.DoubleSide });
  const shafts = new THREE.Group(); room.add(shafts);
  const dir = new THREE.Vector3(-0.35, -1, 1.25).normalize();
  for (let i = 0; i < 3; i++) {
    const len = 4.2, wdt = [0.7, 0.45, 0.6][i];
    const geo = new THREE.PlaneGeometry(wdt, len); geo.translate(0, -len / 2, 0);
    const s = new THREE.Mesh(geo, shaftMat);
    s.position.set(win.x - 0.55 + i * 0.55, win.y + 0.35, L.wallZ + 0.05);
    s.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    s.rotateY(0.4);
    s.renderOrder = 5;
    shafts.add(s);
  }
  const dustN = 140;
  const dustGeo = new THREE.BufferGeometry();
  const dp = new Float32Array(dustN * 3), dseed = new Float32Array(dustN);
  for (let i = 0; i < dustN; i++) { dp[i * 3] = win.x + rand(-1.4, 1.2); dp[i * 3 + 1] = rand(0.6, 3.2); dp[i * 3 + 2] = rand(-2, 1.2); dseed[i] = rand(0, 100); }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dotTex = canvasTex(32, 32, (g) => { const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16); grd.addColorStop(0, 'rgba(255,250,230,1)'); grd.addColorStop(1, 'rgba(255,250,230,0)'); g.fillStyle = grd; g.fillRect(0, 0, 32, 32); }, { srgb: false });
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.025, map: dotTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7 }));
  room.add(dust);

  // wall decor: shelf with bottles, frames, clock
  const woodM = toon(0xd39258, { rim: 0.35 });
  const woodDark = toon(0xb0703f, { rim: 0.3 });
  mesh(rbox(1.3, 0.05, 0.26, 0.015), woodM, { x: -0.55, y: 1.88, z: L.wallZ + 0.13, parent: room });
  for (const sx of [-1, 1]) mesh(rbox(0.04, 0.16, 0.2, 0.01), woodDark, { x: -0.55 + sx * 0.5, y: 1.8, z: L.wallZ + 0.1, parent: room });
  const bottleCols = [0x7cc7e8, 0xff9ab8, 0xffd25a, 0x8fd16a, 0xb59bff];
  for (let i = 0; i < 5; i++) {
    const h = rand(0.16, 0.26), r = rand(0.04, 0.06);
    const pts = [[0, 0], [r, 0], [r, h * 0.7], [r * 0.45, h * 0.85], [r * 0.4, h], [0, h]].map(([a, b]) => new THREE.Vector2(a, b));
    mesh(new THREE.LatheGeometry(pts, 18), toon(bottleCols[i], { rim: 0.6 }), { x: -1.08 + i * 0.25, y: 1.905, z: L.wallZ + 0.14, parent: room });
    mesh(new THREE.CylinderGeometry(r * 0.45, r * 0.45, 0.03, 12), toon(0xffffff), { x: -1.08 + i * 0.25, y: 1.905 + h + 0.012, z: L.wallZ + 0.14, parent: room });
  }
  const art = (x, y, w, h, draw) => {
    mesh(rbox(w + 0.08, h + 0.08, 0.04, 0.015), toon(0xfff6e8), { x, y, z: L.wallZ + 0.03, parent: room });
    mesh(new THREE.PlaneGeometry(w, h), toon(0xffffff, { map: canvasTex(256, Math.round(256 * h / w), draw), rim: 0 }), { x, y, z: L.wallZ + 0.052, cast: false, parent: room });
  };
  art(-2.55, 2.35, 0.55, 0.42, (g, w, h) => { g.fillStyle = '#ffe2c4'; g.fillRect(0, 0, w, h); g.fillStyle = '#ff9a6a'; g.beginPath(); g.arc(w * 0.5, h * 0.62, w * 0.25, Math.PI, 0); g.fill(); g.fillStyle = '#7cc7e8'; for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(w * 0.5, h * (0.72 + i * 0.1), w * 0.45, h * 0.035, 0, 0, 7); g.fill(); } });
  art(-1.8, 2.6, 0.36, 0.48, (g, w, h) => { g.fillStyle = '#d8f0e2'; g.fillRect(0, 0, w, h); g.fillStyle = '#ff8fb1'; for (let i = 0; i < 5; i++) { const a = i * 1.256; g.beginPath(); g.arc(w / 2 + Math.cos(a) * 26, h * 0.4 + Math.sin(a) * 26, 22, 0, 7); g.fill(); } g.fillStyle = '#ffd25a'; g.beginPath(); g.arc(w / 2, h * 0.4, 18, 0, 7); g.fill(); g.fillStyle = '#5aa86a'; g.fillRect(w / 2 - 4, h * 0.5, 8, h * 0.5); });
  // clock
  const clock = new THREE.Group(); clock.position.set(-0.55, 2.75, L.wallZ + 0.03); room.add(clock);
  mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 32), toon(0xff8f70, { rim: 0.5 }), { parent: clock }).rotation.x = Math.PI / 2;
  mesh(new THREE.CircleGeometry(0.18, 32), toon(0xfffaf0, { rim: 0 }), { z: 0.026, cast: false, parent: clock });
  const hand = (len, w) => { const h = mesh(rbox(w, len, 0.01, 0.004), toon(0x5a3a28), { z: 0.035, cast: false, parent: clock }); h.geometry.translate(0, len / 2 - 0.01, 0); return h; };
  const hourHand = hand(0.1, 0.02), minHand = hand(0.15, 0.014);
  for (let i = 0; i < 12; i++) mesh(new THREE.CircleGeometry(0.01, 8), toon(0x5a3a28), { x: Math.sin(i / 12 * 6.283) * 0.15, y: Math.cos(i / 12 * 6.283) * 0.15, z: 0.03, cast: false, parent: clock });

  // basket
  const B = L.basket;
  const basket = new THREE.Group(); basket.position.set(B.x, 0, B.z); room.add(basket);
  const prof = [[0.44, 0.0], [0.5, 0.03], [0.53, 0.2], [0.56, 0.42], [0.58, 0.5]].map(([a, b]) => new THREE.Vector2(a, b));
  mesh(new THREE.LatheGeometry(prof, 40), toon(0xffffff, { map: wicker(), side: THREE.DoubleSide, rim: 0.45, backDarken: 0.7 }), { parent: basket });
  mesh(new THREE.CircleGeometry(0.45, 32), toon(0xb07a42), { y: 0.02, parent: basket }).rotation.x = -Math.PI / 2;
  const rimM = toon(0xe6aa62, { rim: 0.5 });
  mesh(new THREE.TorusGeometry(0.575, 0.035, 10, 48), rimM, { y: 0.5, parent: basket }).rotation.x = Math.PI / 2;
  for (const sx of [-1, 1]) { const h = mesh(new THREE.TorusGeometry(0.1, 0.022, 8, 20, Math.PI), rimM, { x: sx * 0.58, y: 0.5, parent: basket }); h.rotation.set(0, Math.PI / 2, 0); h.rotation.x = 0; h.rotation.y = Math.PI / 2; }
  contact(B.x, B.z, 1.7, 1.7);

  // wash bench
  const bn = L.bench;
  const bw = bn.x1 - bn.x0, bd = bn.z1 - bn.z0, bcx = (bn.x0 + bn.x1) / 2, bcz = (bn.z0 + bn.z1) / 2;
  mesh(rbox(bw, 0.07, bd, 0.025), woodM, { x: bcx, y: bn.top - 0.035, z: bcz, parent: room });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(rbox(0.07, bn.top - 0.07, 0.07, 0.015), woodDark, { x: bcx + sx * (bw / 2 - 0.08), y: (bn.top - 0.07) / 2, z: bcz + sz * (bd / 2 - 0.08), parent: room });
  mesh(rbox(bw - 0.1, 0.04, bd - 0.12, 0.01), woodDark, { x: bcx, y: 0.22, z: bcz, parent: room });
  // stacked towels under bench
  const tcols = [0xffb08f, 0x8fd1c0, 0xfff1d6];
  tcols.forEach((c, i) => mesh(rbox(0.45, 0.07, 0.36, 0.03), toon(c, { rim: 0.45 }), { x: bn.x0 + 0.45, y: 0.275 + i * 0.07, z: bcz, parent: room }));
  // soap box & bottle on bench
  mesh(rbox(0.16, 0.22, 0.1, 0.03), toon(0xff8fb1, { rim: 0.5 }), { x: 0.3, y: bn.top + 0.11, z: -0.22, parent: room });
  mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.06, 10), toon(0xffffff), { x: 0.3, y: bn.top + 0.25, z: -0.22, parent: room });
  mesh(new THREE.SphereGeometry(0.06, 16, 12), toon(0xfff2a8, { rim: 0.6 }), { x: 0.15, y: bn.top + 0.04, z: -0.24, parent: room }).scale.set(1.2, 0.55, 0.85);
  contact(bcx, bcz, bw + 0.5, bd + 0.5, 0.8);
  // wash mat
  const M = L.mat;
  const matTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#7cc0e6'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,.22)'; for (let y = 0; y < h; y += 16) g.fillRect(0, y, w, 6); g.strokeStyle = '#5aa4d0'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10); });
  mesh(rbox(M.w, 0.016, M.d, 0.007), toon(0xffffff, { map: matTex, rim: 0.2 }), { x: M.x, y: bn.top + 0.007, z: M.z, cast: false, parent: room });
  env.boxes.push([bn.x0, 0, bn.z0, bn.x1, M.top - 0.004, bn.z1]);

  // tub with water
  const T = L.tub;
  const tub = new THREE.Group(); tub.position.set(T.x, bn.top, T.z); room.add(tub);
  const tprof = [[T.r * 0.82, 0], [T.r * 0.9, 0.02], [T.r, T.top - bn.top]].map(([a, b]) => new THREE.Vector2(a, b));
  mesh(new THREE.LatheGeometry(tprof, 36), toon(0xffffff, { map: staves(), side: THREE.DoubleSide, rim: 0.4, backDarken: 0.65 }), { parent: tub });
  mesh(new THREE.TorusGeometry(T.r, 0.018, 8, 40), toon(0xa6b0ba, { rim: 0.6 }), { y: T.top - bn.top, parent: tub }).rotation.x = Math.PI / 2;
  const waterMat = toon(0x6fc3ee, { rim: 0.7, rimColor: 0xffffff, transparent: true, opacity: 0.88 });
  const water = mesh(new THREE.CircleGeometry(T.r * 0.97, 36), waterMat, { y: T.water - bn.top, cast: false, parent: tub });
  water.rotation.x = -Math.PI / 2;
  const foamM = toon(0xffffff, { rim: 0.3 });
  for (let i = 0; i < 9; i++) { const a = rand(0, 6.28), r = rand(0.12, 0.26); const f = mesh(new THREE.SphereGeometry(rand(0.025, 0.05), 10, 8), foamM, { x: Math.cos(a) * r, y: T.water - bn.top, z: Math.sin(a) * r, cast: false, parent: tub }); f.scale.y = 0.5; }
  env.boxes.push([T.x - T.r, bn.top, T.z - T.r, T.x + T.r, T.top, T.z + T.r]);

  // clothesline
  const LN = L.line;
  const postM = toon(0xc98b52, { rim: 0.4 });
  for (const x of [LN.x0 - 0.03, LN.x1 + 0.03]) {
    mesh(new THREE.CylinderGeometry(0.03, 0.035, LN.y + 0.1, 12), postM, { x, y: (LN.y + 0.1) / 2, z: LN.z, parent: room });
    mesh(new THREE.SphereGeometry(0.045, 12, 10), toon(0xff8f70), { x, y: LN.y + 0.13, z: LN.z, parent: room });
    mesh(rbox(0.3, 0.04, 0.06, 0.015), postM, { x, y: 0.02, z: LN.z, parent: room });
    mesh(rbox(0.06, 0.04, 0.3, 0.015), postM, { x, y: 0.02, z: LN.z, parent: room });
    contact(x, LN.z, 0.5, 0.5, 0.6);
  }
  const rp = [];
  for (let i = 0; i <= 30; i++) { const x = LN.x0 - 0.03 + (LN.x1 - LN.x0 + 0.06) * i / 30; rp.push(new THREE.Vector3(x, ropeY(Math.min(LN.x1, Math.max(LN.x0, x))), LN.z)); }
  mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rp), 60, 0.008, 6), toon(0xfff3dc, { rim: 0.5 }), { parent: room });

  // fold table
  const F = L.fold;
  const fw2 = F.x1 - F.x0, fd = F.z1 - F.z0, fcx = (F.x0 + F.x1) / 2, fcz = (F.z0 + F.z1) / 2;
  mesh(rbox(fw2, 0.07, fd, 0.025), toon(0xe7ad6e, { rim: 0.35 }), { x: fcx, y: F.top - 0.035, z: fcz, parent: room });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(rbox(0.07, F.top - 0.07, 0.07, 0.015), woodDark, { x: fcx + sx * (fw2 / 2 - 0.08), y: (F.top - 0.07) / 2, z: fcz + sz * (fd / 2 - 0.08), parent: room });
  const runner = canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#fff3df'; g.fillRect(0, 0, w, h); g.fillStyle = '#ff9a7a'; for (let x = 0; x < w; x += 32) for (let y = 0; y < h; y += 32) if (((x + y) / 32) & 1) g.fillRect(x, y, 32, 32); g.globalAlpha = 0.5; g.fillStyle = '#fff3df'; g.fillRect(0, 0, w, h); });
  mesh(new THREE.PlaneGeometry(0.9, 0.82), toon(0xffffff, { map: runner, rim: 0 }), { x: F.fx, y: F.top + 0.002, z: F.fz, cast: false, parent: room }).rotation.x = -Math.PI / 2;
  contact(fcx, fcz, fw2 + 0.5, fd + 0.5, 0.8);
  env.boxes.push([F.x0, 0, F.z0, F.x1, F.top, F.z1]);

  // plant in corner
  const plant = new THREE.Group(); plant.position.set(3.65, 0, -1.4); room.add(plant);
  mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.5, 20), toon(0xff9a6a, { rim: 0.45 }), { y: 0.25, parent: plant });
  mesh(new THREE.TorusGeometry(0.26, 0.03, 8, 24), toon(0xffb48a), { y: 0.5, parent: plant }).rotation.x = Math.PI / 2;
  const leaves = [];
  for (let i = 0; i < 11; i++) {
    const lg = new THREE.Group(); lg.position.y = 0.5; lg.rotation.y = i * 2.4; lg.rotation.z = 0.35 + rand(0, 0.5); plant.add(lg);
    const lf = mesh(new THREE.SphereGeometry(0.16, 12, 8), toon(i & 1 ? 0x6cc26a : 0x58ae5e, { rim: 0.55 }), { y: 0.42 + rand(0, 0.25), parent: lg });
    lf.scale.set(0.45, 1.25, 0.18);
    leaves.push(lg);
  }
  contact(3.65, -1.4, 0.9, 0.9);

  // sleepy cat on the rug
  const cat = new THREE.Group(); cat.position.set(0.95, 0, 1.75); cat.rotation.y = -0.5; room.add(cat);
  const furM = toon(0xffa75e, { rim: 0.6 }), furL = toon(0xfff1de, { rim: 0.5 });
  const body = mesh(new THREE.SphereGeometry(0.2, 20, 16), furM, { y: 0.11, parent: cat }); body.scale.set(1.25, 0.6, 0.95);
  const head = mesh(new THREE.SphereGeometry(0.1, 18, 14), furM, { x: 0.2, y: 0.1, z: 0.07, parent: cat }); head.scale.set(1, 0.85, 1);
  mesh(new THREE.SphereGeometry(0.05, 12, 10), furL, { x: 0.27, y: 0.08, z: 0.11, parent: cat }).scale.set(1, 0.7, 0.9);
  for (const sz of [-1, 1]) { const e = mesh(new THREE.ConeGeometry(0.035, 0.07, 4), furM, { x: 0.2, y: 0.18, z: 0.07 + sz * 0.05, parent: cat }); e.rotation.x = sz * 0.3; }
  const eyeM = toon(0x5a3a28);
  for (const sz of [-1, 1]) { const e = mesh(new THREE.TorusGeometry(0.014, 0.004, 4, 8, Math.PI), eyeM, { x: 0.29, y: 0.12, z: 0.07 + sz * 0.035, cast: false, parent: cat }); e.rotation.set(0, Math.PI / 2, Math.PI); }
  const tail = mesh(new THREE.TorusGeometry(0.18, 0.03, 8, 20, Math.PI * 0.9), furM, { x: -0.05, y: 0.04, parent: cat }); tail.rotation.set(Math.PI / 2, 0, 0.3);
  for (let i = 0; i < 3; i++) { const s = mesh(new THREE.SphereGeometry(0.06, 10, 8), furL, { x: -0.05 + i * 0.07, y: 0.17, z: 0, cast: false, parent: cat }); s.scale.set(0.5, 0.15, 1.6); }
  contact(0.95, 1.75, 0.7, 0.55, 0.7);
  const zzz = [];

  // washing machine (unlockable)
  const MC = L.machine;
  const machine = new THREE.Group(); machine.position.set(MC.x, 0, MC.z); machine.visible = false; room.add(machine);
  mesh(rbox(0.74, 0.92, 0.7, 0.07, 4), toon(0xfdfbf7, { rim: 0.5 }), { y: 0.46, parent: machine });
  mesh(rbox(0.74, 0.16, 0.05, 0.03), toon(0x8fd1c0, { rim: 0.4 }), { y: 0.82, z: 0.34, parent: machine });
  for (let i = 0; i < 3; i++) mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 14), toon([0xff8f70, 0xffd25a, 0xffffff][i]), { x: -0.2 + i * 0.12, y: 0.83, z: 0.37, parent: machine }).rotation.x = Math.PI / 2;
  mesh(new THREE.TorusGeometry(0.24, 0.045, 10, 40), toon(0xd8dee6, { rim: 0.7 }), { y: 0.42, z: 0.36, parent: machine });
  const drum = new THREE.Group(); drum.position.set(0, 0.42, 0.33); machine.add(drum);
  const drumTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#3e5f7a'; g.fillRect(0, 0, w, h); const cols = ['#ff8f70', '#ffd25a', '#7cc7a8', '#8fb6ff', '#ff8fb1']; for (let i = 0; i < 9; i++) { g.fillStyle = cols[i % 5]; g.beginPath(); g.ellipse(rand(40, 216), rand(40, 216), rand(20, 50), rand(12, 30), rand(0, 3), 0, 7); g.fill(); } });
  const drumFace = mesh(new THREE.CircleGeometry(0.22, 32), new THREE.MeshBasicMaterial({ map: drumTex, color: 0xb8c8d8 }), { cast: false, parent: drum });
  drumFace.visible = false;
  mesh(new THREE.CircleGeometry(0.22, 32), new THREE.MeshBasicMaterial({ color: 0x9fd4f2, transparent: true, opacity: 0.38 }), { z: 0.035, cast: false, recv: false, parent: machine }).position.y = 0.42;
  const glassHi = mesh(new THREE.PlaneGeometry(0.05, 0.25), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 }), { x: -0.06, y: 0.46, z: 0.37, cast: false, parent: machine }); glassHi.rotation.z = 0.7;
  const machineContact = contact(MC.x, MC.z, 1.2, 1.2); machineContact.visible = false;
  machine.userData = { drum, drumFace, contact: machineContact, box: [MC.x - 0.37, 0, MC.z - 0.35, MC.x + 0.37, 0.92, MC.z + 0.35] };

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight(0xfff0dc, 0xb88a6a, 1.15); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffe2b8, 2.2);
  key.position.set(4.5, 7.5, 4.5); key.target.position.set(0, 0.6, -0.4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const sc = key.shadow.camera; sc.left = -5.5; sc.right = 5.5; sc.top = 5; sc.bottom = -4; sc.near = 1; sc.far = 20;
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 4;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xbfe0ff, 1.1); rim.position.set(-3, 4, -6); scene.add(rim);
  const fill = new THREE.PointLight(0xffc89a, 1.2, 9, 1.6); fill.position.set(-2.5, 2.6, 1.8); scene.add(fill);

  scene.background = new THREE.Color(0xf6dcc0);
  scene.fog = new THREE.Fog(0xf6dcc0, 12, 22);

  function update(dt, t) {
    for (const cu of curtains) {
      const g = 0.5 + 0.5 * Math.sin(t * 0.6 + cu.phase) * Math.sin(t * 0.23 + 1);
      cu.c.wind[0] = 0.2 * Math.sin(t * 0.4 + cu.phase); cu.c.wind[1] = 0; cu.c.wind[2] = 0.35 + 0.6 * g;
      cu.c.step(dt, env, 1); cu.c.updateGeometry();
    }
    const p = dust.geometry.attributes.position.array;
    for (let i = 0; i < dustN; i++) {
      p[i * 3] += Math.sin(t * 0.3 + dseed[i]) * 0.0006;
      p[i * 3 + 1] += 0.0012 * Math.sin(t * 0.21 + dseed[i] * 2) + 0.0004;
      p[i * 3 + 2] += 0.0005 * Math.cos(t * 0.17 + dseed[i]);
      if (p[i * 3 + 1] > 3.3) p[i * 3 + 1] = 0.5;
    }
    dust.geometry.attributes.position.needsUpdate = true;
    shaftMat.opacity = 0.24 + 0.05 * Math.sin(t * 0.5);
    body.scale.y = 0.6 + 0.025 * Math.sin(t * 2.2);
    tail.rotation.z = 0.3 + 0.12 * Math.sin(t * 0.9);
    leaves.forEach((l, i) => { l.rotation.x = 0.04 * Math.sin(t * 1.1 + i); });
    const now = new Date(); minHand.rotation.z = -now.getMinutes() / 60 * 6.283; hourHand.rotation.z = -(now.getHours() % 12 + now.getMinutes() / 60) / 12 * 6.283;
    waterMat.userData.rim.value = 0.6 + 0.1 * Math.sin(t * 1.7);
  }

  return { room, env, update, water, tub, basket, machine, key, curtains, cat, contact };
}
