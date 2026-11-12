import * as THREE from 'three';
import { Garment, TYPES, UNLOCKS } from './garments.js';
import { L, ropeY, makeSponge, makePitcher, makePeg, makeGlove } from './room.js';
import { toon, canvasTex, rand, pick, clamp, lerp, damp, easeInOut, easeOut } from './materials.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const _v = V(), _v2 = V(), _down = V(0, -1, 0);
const SAVE_KEY = 'suds-sunshine-v1';
const MS = 96;
const box = (a) => new THREE.Box3(V(a[0], a[1], a[2]), V(a[3], a[4], a[5]));

const ZONES = {
  wash: { box: box([-1.5, 0.8, -0.35, 0.45, 1.45, 0.75]), depth: 0.2, tag: V(-0.55, 1.5, 0.2), label: '🧼 Wash here' },
  machine: { box: box([-3.85, 0, -1.65, -3.05, 1.15, -0.85]), depth: -0.7, tag: V(-3.45, 1.35, -1.25), label: '🌀 Machine wash' },
  line: { box: box([0.7, 1.1, -1.55, 3.0, 2.4, -1.05]), depth: -1.15, tag: V(1.85, 2.5, -1.3), label: '☀ Hang to dry' },
  fold: { box: box([1.1, 0.8, 0.1, 2.8, 1.35, 1.1]), depth: 0.6, tag: V(1.95, 1.25, 0.6), label: '✨ Fold here' },
};

const UPGRADES = [
  { id: 'sponge', name: 'Big Sponge', icon: '🧽', color: '#ffe08a', base: 12, mul: 1.55, max: 8, desc: 'Scrub a wider patch' },
  { id: 'soap', name: 'Super Suds', icon: '🫧', color: '#cdeafe', base: 15, mul: 1.6, max: 8, desc: 'Stains lift faster' },
  { id: 'arms', name: 'Strong Arms', icon: '💪', color: '#ffc8b4', base: 20, mul: 1.6, max: 6, desc: 'Fewer twists to wring dry' },
  { id: 'sun', name: 'Sunny Window', icon: '☀️', color: '#fff1a8', base: 25, mul: 1.65, max: 8, desc: 'Laundry dries faster' },
  { id: 'softener', name: 'Fabric Softener', icon: '🌸', color: '#ffd0e4', base: 40, mul: 1.9, max: 4, desc: '+15% pay for every item' },
  { id: 'clientele', name: 'Fancy Clients', icon: '🎩', color: '#d9d0ff', base: 60, mul: 2.3, max: 6, desc: '+25% pay and bigger tips' },
  { id: 'machine', name: 'Washing Machine', icon: '🌀', color: '#bfeee0', base: 150, mul: 1.8, max: 5, desc: 'Drop dirty laundry in, get it back clean. Upgrades spin faster.' },
];

function wrapAngle(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }

export class Game {
  constructor({ scene, camera, renderer, room, fx, audio, ui }) {
    Object.assign(this, { scene, camera, renderer, room, fx, audio, ui });
    this.canvas = renderer.domElement;
    this.env = room.env;
    this.garments = [];
    this.mode = 'title';
    this.view = 'title';
    this.t = 0;
    this.load();
    this.shown = this.coins;
    this.camPos = V(3.6, 3.5, 7.4); this.camLook = V(0, 0.9, -0.4);
    camera.position.copy(this.camPos); camera.lookAt(this.camLook);
    this.ndc = new THREE.Vector2(); this.mx = 0; this.my = 0; this.sx = 0; this.sy = 0;
    this.pressed = false;
    this.ray = new THREE.Raycaster();
    this.down = new THREE.Raycaster();
    this.spawnQ = [];
    this.lineOcc = [];
    this.stack = []; this.stackH = 0;
    this.leaving = [];
    this.held = null;
    this.hover = null;
    this.hot = null;
    this.timers = [];

    // props
    this.sponge = makeSponge(); this.sponge.visible = false; scene.add(this.sponge);
    this.pitcher = makePitcher(); this.pitcher.visible = false; scene.add(this.pitcher);
    this.gloves = [makeGlove(), makeGlove()];
    for (const gl of this.gloves) { gl.visible = false; scene.add(gl); }
    this.rinseGrid = new Float32Array(MS * MS);

    // fold guide: marching dashed strip + arrow
    const dash = document.createElement('canvas'); dash.width = 64; dash.height = 8;
    const dg = dash.getContext('2d'); dg.fillStyle = '#fff'; dg.beginPath(); dg.roundRect(2, 1, 38, 6, 3); dg.fill();
    this.dashTex = new THREE.CanvasTexture(dash); this.dashTex.wrapS = THREE.RepeatWrapping;
    this.guide = new THREE.Group(); this.guide.visible = false; scene.add(this.guide);
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.016), new THREE.MeshBasicMaterial({ map: this.dashTex, transparent: true, depthWrite: false, color: 0xffffff }));
    strip.rotation.x = -Math.PI / 2; strip.renderOrder = 5; this.guide.add(strip); this.guideStrip = strip;
    this.arrow = new THREE.Group(); this.arrow.visible = false; scene.add(this.arrow);
    const am = toon(0xff8f70, { rim: 0.6 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.09, 10), am); shaft.rotation.z = Math.PI / 2; shaft.position.x = -0.03; this.arrow.add(shaft);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.06, 16), am); tip.rotation.z = -Math.PI / 2; tip.position.x = 0.04; this.arrow.add(tip);
    for (const m of [shaft, tip]) m.castShadow = true;

    this.tags = {};
    for (const [id, z] of Object.entries(ZONES)) this.tags[id] = ui.zoneTag(id, z.label);

    // machine ring
    this.machineRing = ui.ring(); this.machineRing.style.display = 'none'; this.machineRing.querySelector('span').textContent = '🌀';
    this.machineJob = null;
    if (this.up.machine > 0) this.enableMachine();

    ui.onShop = (open) => { if (open) this.renderShop(); };
    this.renderShop();
    ui.setCoins(this.coins);
  }

  // ---------- save ----------
  load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { s = null; }
    this.coins = s?.coins ?? 0;
    this.basketNum = s?.basketNum ?? 1;
    this.up = Object.fromEntries(UPGRADES.map((u) => [u.id, s?.up?.[u.id] ?? 0]));
    this.prefs = { music: s?.prefs?.music ?? true, sfx: s?.prefs?.sfx ?? true };
  }
  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ coins: this.coins, basketNum: this.basketNum, up: this.up, prefs: this.prefs })); } catch (e) { /* storage blocked */ }
  }

  // ---------- flow ----------
  start() {
    this.mode = 'overview'; this.view = 'overview';
    this.newBasket();
  }

  later(sec, fn) { this.timers.push({ t: sec, fn }); }

  newBasket() {
    const n = Math.min(10, 3 + this.basketNum);
    const tier = Math.min(UNLOCKS.length, this.basketNum);
    const pool = UNLOCKS.slice(0, tier).flat();
    const newest = UNLOCKS[tier - 1];
    this.basket = { items: [], total: n, done: 0, earned: 0 };
    for (let i = 0; i < n; i++) {
      const type = i === 1 && this.basketNum > 1 ? pick(newest) : pick(pool);
      this.spawnQ.push({ t: 0.25 + i * 0.16, type, layer: i });
    }
    this.ui.setBasket(this.basketNum, 0, n);
  }

  spawnGarment(type, layer) {
    const g = new Garment(type);
    const B = L.basket, c = g.cloth;
    g.layer = layer; g.where = 'pile';
    c.spheres = [[B.x, -0.62, B.z, 1.1 + 0.03 * layer]];
    c.canSleep = true;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2 + rand(-0.6, 0.6), rand(0, 6.28), rand(-0.5, 0.5)));
    const ox = B.x + rand(-0.14, 0.14), oz = B.z + rand(-0.14, 0.14), oy = 1.45 + rand(0, 0.35);
    const ph = rand(0, 6);
    c.place((rx, ry, o) => {
      _v.set(rx * 0.8, ry * 0.8, 0.07 * Math.sin(rx * 11 + ry * 7 + ph)).applyQuaternion(q);
      o[0] = ox + _v.x; o[1] = oy + _v.y; o[2] = oz + _v.z;
    }, (o, v) => { v[0] = rand(-0.2, 0.2); v[1] = -1.2; v[2] = rand(-0.2, 0.2); });
    c.updateGeometry();
    this.scene.add(g.mesh);
    this.garments.push(g);
    this.basket.items.push(g);
    this.audio.plop();
    return g;
  }

  // ---------- pointer ----------
  pointer(type, e) {
    const r = this.canvas.getBoundingClientRect();
    this.sx = e.clientX; this.sy = e.clientY;
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.mx = this.ndc.x; this.my = this.ndc.y;
    if (type === 'down') {
      if (this.ui.shopOpen) return;
      this.pressed = true;
      this.ray.setFromCamera(this.ndc, this.camera);
      this.onDown();
    } else if (type === 'up') {
      if (!this.pressed) return;
      this.pressed = false;
      this.onUp();
    }
  }

  grabbables() { return this.garments.filter((g) => g.where === 'pile' || g.where === 'free' || g.where === 'line'); }

  pickGarment() {
    const list = this.grabbables();
    if (!list.length) return null;
    const hit = this.ray.intersectObjects(list.map((g) => g.mesh), false)[0];
    return hit ? { g: hit.object.userData.garment, point: hit.point.clone() } : null;
  }

  onDown() {
    const m = this.mode;
    if (m === 'overview') {
      const h = this.pickGarment();
      if (h) this.grab(h.g, h.point);
    } else if (m === 'fold') {
      const f = this.fold;
      if (f.phase === 'ready') {
        const a = this.tableHit();
        if (a) { f.drag = true; f.a0 = f.cur.ax === 'x' ? a.x : a.z; f.p = 0; }
      }
    } else if (m === 'wring') {
      this.wring.lastA = null;
    } else if (m === 'celebrate') {
      if (!this.cele.shown) this.showCele();
    }
  }

  onUp() {
    if (this.mode === 'overview' && this.held) this.release();
    if (this.mode === 'fold' && this.fold.drag) {
      const f = this.fold; f.drag = false;
      f.anim = { from: f.p, to: f.p > 0.4 ? 1 : 0, t: 0, dur: f.p > 0.4 ? 0.16 : 0.14 };
      f.phase = 'anim';
    }
  }

  // ---------- grab & throw ----------
  grab(g, point) {
    const c = g.cloth;
    if (g.where === 'line') this.unhang(g);
    c.spheres = []; c.canSleep = false; c.wake(); c.clearSprings(); c.unpinAll();
    c.wind[0] = c.wind[1] = c.wind[2] = 0;
    const k = c.nearest(point.x, point.y, point.z);
    const pinch = [], off = [];
    for (let j = 0; j < c.n; j++) {
      if (Math.hypot(c.rx[j] - c.rx[k], c.ry[j] - c.ry[k]) < 0.05) {
        pinch.push(j);
        off.push(c.pos[j * 3] - c.pos[k * 3], c.pos[j * 3 + 1] - c.pos[k * 3 + 1], c.pos[j * 3 + 2] - c.pos[k * 3 + 2]);
      }
    }
    c.setTethers([k], 1.04);
    let hang = 0;
    for (let j = 0; j < c.n; j++) hang = Math.max(hang, Math.hypot(c.rx[j] - c.rx[k], c.ry[j] - c.ry[k]));
    const p = V(c.pos[k * 3], c.pos[k * 3 + 1], c.pos[k * 3 + 2]);
    this.held = { g, k, pinch, off, s: 1, point: p, last: p.clone(), target: p.clone(), vel: V(), depth: clamp(point.z, -0.3, 0.8), hang };
    g.prevWhere = g.where; g.where = 'held';
    g.setHighlight(false);
    this.audio.grab();
    this.ui.hint(null);
  }

  release() {
    const h = this.held; this.held = null;
    const g = h.g, c = g.cloth;
    c.unpinAll(); c.clearTethers(); c.canSleep = true;
    const sub = 1 / 120, v = h.vel.clampLength(0, 6);
    for (const j of h.pinch) { const i = j * 3; c.prev[i] = c.pos[i] - v.x * sub; c.prev[i + 1] = c.pos[i + 1] - v.y * sub; c.prev[i + 2] = c.pos[i + 2] - v.z * sub; }
    this.audio.setLoop('whoosh', 0);
    g.where = 'free';
    const z = this.hot;
    this.hot = null;
    if (z === 'wash') this.startScrub(g);
    else if (z === 'machine') this.startMachine(g);
    else if (z === 'line') this.hang(g);
    else if (z === 'fold') this.startFold(g);
    else if (this.hotBad) {
      const p = this.screenOf(h.point);
      this.ui.popup(this.hotBad, p.x, p.y - 30, 'small');
      this.audio.deny();
    }
    this.hotBad = null;
  }

  validZones(g) {
    if (!g.clean) return this.up.machine > 0 && !this.machineJob ? ['wash', 'machine'] : ['wash'];
    if (!g.dry) return ['line'];
    return ['fold'];
  }

  updateHeld(dt) {
    const h = this.held, g = h.g;
    this.ray.setFromCamera(this.ndc, this.camera);
    // which zone is under the cursor?
    let best = null, bd = 1e9;
    for (const [id, z] of Object.entries(ZONES)) {
      if (id === 'machine' && !(this.up.machine > 0)) continue;
      const p = this.ray.ray.intersectBox(z.box, _v);
      if (p) { const d = p.distanceTo(this.ray.ray.origin); if (d < bd) { bd = d; best = id; } }
    }
    const valid = this.validZones(g);
    const ok = best && valid.includes(best);
    let bad = null;
    if (best && !ok) {
      if (best === 'fold' && g.clean && !g.dry) bad = 'Still damp!';
      else if (best === 'fold' && !g.clean) bad = 'Wash it first!';
      else if (best === 'line' && !g.clean) bad = 'Wash it first!';
      else if (best === 'machine' && this.machineJob) bad = 'Machine is busy';
    }
    if (ok && best === 'line' && !this.findSlot(g, 1.85)) { bad = 'The line is full!'; }
    this.hot = ok && !bad ? best : null;
    this.hotBad = bad;
    const depth = this.hot ? ZONES[this.hot].depth : (best === 'line' ? -1.15 : 0.35);
    h.depth = damp(h.depth, depth, 6, dt);
    // intersect cursor ray with plane z = depth
    const o = this.ray.ray.origin, d = this.ray.ray.direction;
    const t = Math.abs(d.z) > 1e-4 ? (h.depth - o.z) / d.z : 5;
    _v2.copy(d).multiplyScalar(Math.max(0.5, t)).add(o);
    _v2.x = clamp(_v2.x, -4, 3.8);
    // keep the whole garment dangling clear of whatever is underneath
    _v2.y = clamp(_v2.y, this.surfaceAt(_v2.x, _v2.z) + h.hang * 0.92 + 0.07, 2.7);
    h.target.copy(_v2);
    // tags
    for (const [id, z] of Object.entries(ZONES)) {
      const show = valid.includes(id) && (id !== 'machine' || this.up.machine > 0);
      const el = this.tags[id];
      el.classList.toggle('hidden', !show);
      el.classList.toggle('hot', this.hot === id);
      if (show) { const s = this.screenOf(z.tag); this.ui.place(el, s.x, s.y, s.vis); }
    }
    g.setHighlight(!!this.hot);
    const sp = h.vel.length();
    this.audio.setLoop('whoosh', clamp((sp - 0.6) * 0.09, 0, 0.35), 0.7 + sp * 0.2);
  }

  fixedHeld(dt) {
    const h = this.held, c = h.g.cloth;
    h.last.copy(h.point);
    h.point.lerp(h.target, 1 - Math.exp(-20 * dt));
    h.vel.copy(h.point).sub(h.last).divideScalar(dt);
    h.s = damp(h.s, 0.35, 5, dt);
    for (let n = 0; n < h.pinch.length; n++) {
      c.setPin(h.pinch[n], h.point.x + h.off[n * 3] * h.s, h.point.y + h.off[n * 3 + 1] * h.s, h.point.z + h.off[n * 3 + 2] * h.s);
    }
  }

  kickFrom(b, except) {
    for (const g of this.garments) {
      if (g === except || g.where !== 'free') continue;
      g.cloth.centroid(_v);
      if (_v.x > b.min.x && _v.x < b.max.x && _v.z > b.min.z && _v.z < b.max.z && _v.y < b.max.y + 0.3) {
        const c = g.cloth; c.wake();
        const vx = rand(-0.4, 0.4), vy = 2.4, vz = 2.6, s = 1 / 120;
        for (let k = 0; k < c.n; k++) { const i = k * 3; c.prev[i] = c.pos[i] - vx * s; c.prev[i + 1] = c.pos[i + 1] - vy * s; c.prev[i + 2] = c.pos[i + 2] - vz * s; }
      }
    }
  }

  setFlat(g, x0, y, z0, k0) {
    const c = g.cloth;
    for (let k = 0; k < c.n; k++) { const i = k * 3; c.sT[i] = x0 + c.rx[k]; c.sT[i + 1] = y; c.sT[i + 2] = z0 - c.ry[k]; c.sK[k] = k0; }
    c.hasSprings = true;
  }

  // ---------- scrub ----------
  startScrub(g) {
    const M = L.mat, c = g.cloth;
    this.kickFrom(ZONES.wash.box, g);
    this.mode = 'scrub'; this.view = 'wash';
    g.where = 'station'; c.canSleep = false; c.wake();
    this.setFlat(g, M.x, M.top + 0.006, M.z, 0.02);
    this.scrub = { g, t: 0, prog: 0, cov: 1, done: false, last: null, vel: V(), speed: 0, foamAt: V(99, 0, 0), frame: 0 };
    this.sponge.visible = true; this.sponge.position.set(M.x + 0.25, 1.0, M.z + 0.3);
    this.audio.plop();
    this.hideTags();
    this.ui.task(`Scrub the ${g.type.name}`, 'Hold the mouse and rub out the stains', 0);
    this.ui.hint('Hold &amp; rub to <b>scrub</b> the stains');
  }

  updateScrub(dt) {
    const s = this.scrub, g = s.g, M = L.mat;
    s.t += dt;
    const c = g.cloth;
    for (let k = 0; k < c.n; k++) c.sK[k] = lerp(0.02, 0.07, Math.min(1, s.t / 0.5));
    // sponge on the mat plane
    this.ray.setFromCamera(this.ndc, this.camera);
    const hit = this.planeHit(M.top + 0.01);
    if (hit) { hit.x = clamp(hit.x, M.x - 0.56, M.x + 0.56); hit.z = clamp(hit.z, M.z - 0.56, M.z + 0.62); }
    const sp = this.sponge.position;
    const press = this.pressed && !s.done;
    const ty = press ? M.top + 0.008 : M.top + 0.09;
    if (hit) { sp.x = damp(sp.x, hit.x, 30, dt); sp.z = damp(sp.z, hit.z, 30, dt); }
    sp.y = damp(sp.y, ty, 22, dt);
    if (!s.last) s.last = sp.clone();
    s.vel.copy(sp).sub(s.last).divideScalar(Math.max(dt, 1e-4)); s.last.copy(sp);
    s.speed = damp(s.speed, Math.hypot(s.vel.x, s.vel.z), 12, dt);
    this.sponge.rotation.y = damp(this.sponge.rotation.y, clamp(-s.vel.x * 0.25, -0.5, 0.5), 8, dt);
    this.sponge.rotation.z = damp(this.sponge.rotation.z, clamp(-s.vel.x * 0.08, -0.2, 0.2), 10, dt);
    const sq = press ? clamp(s.speed * 0.15, 0, 0.22) : 0;
    this.sponge.scale.set(1 + sq * 0.6, 1 - sq, 1 + sq * 0.4);
    s.press = press && s.t > 0.35;
    this.audio.setLoop('scrub', s.press ? clamp(s.speed * 0.45, 0.04, 0.5) : 0, 0.8 + s.speed * 0.6);
    if (s.press) {
      const uv = this.uvBelow(g, sp.x, sp.z);
      if (uv) {
        const lvS = this.up.sponge, lvP = this.up.soap;
        const r = 0.048 * (1 + 0.12 * lvS);
        const str = (0.05 + s.speed * dt * 4.2) * (1 + 0.22 * lvP) / g.type.tough;
        g.erase(g.stain, g.sctx, uv.x, uv.y, r, str);
        if (sp.distanceTo(s.foamAt) > 0.018) { g.addFoam(uv.x, uv.y, r * 1.15, 0.35 + 0.06 * lvP); s.foamAt.copy(sp); }
        g.composite();
        if (Math.random() < clamp(s.speed * 1.4, 0.12, 0.9)) this.fx.bubble(sp.x + rand(-0.07, 0.07), sp.y + 0.03, sp.z + rand(-0.05, 0.05), rand(0.008, 0.024), [rand(-0.15, 0.15), rand(0.25, 0.6), rand(-0.15, 0.15)]);
      }
    }
    if (++s.frame % 6 === 0 && !s.done) {
      s.cov = g.coverage(g.stain) / g.stain0;
      s.prog = clamp((1 - s.cov) / 0.95, 0, 1);
      this.ui.task(undefined, undefined, s.prog);
      if (s.cov <= 0.05) this.finishScrub();
    }
  }

  fixedScrub(dt) {
    const s = this.scrub; if (!s.press) return;
    const c = s.g.cloth, sp = this.sponge.position, R = 0.11 * (1 + 0.1 * this.up.sponge);
    const dx = s.vel.x * dt * 0.5, dz = s.vel.z * dt * 0.5, ymax = L.mat.top + 0.01;
    for (let k = 0; k < c.n; k++) {
      const i = k * 3, ex = c.pos[i] - sp.x, ez = c.pos[i + 2] - sp.z, d = Math.sqrt(ex * ex + ez * ez);
      if (d < R) { const f = 1 - d / R; c.pos[i] += dx * f; c.pos[i + 2] += dz * f; if (c.pos[i + 1] > ymax) c.pos[i + 1] = lerp(c.pos[i + 1], ymax, f); }
    }
  }

  finishScrub() {
    const s = this.scrub, g = s.g;
    s.done = true;
    g.sctx.clearRect(0, 0, g.stain.width, g.stain.height); g.composite();
    this.ui.task(undefined, 'Spotless!', 1);
    g.cloth.centroid(_v);
    this.fx.sparkleBurst(_v.x, _v.y + 0.05, _v.z, 22, 0.35);
    this.audio.setLoop('scrub', 0);
    this.audio.success();
    const p = this.screenOf(_v); this.ui.popup('Spotless!', p.x, p.y - 40, 'gold');
    this.later(0.65, () => this.startRinse(g));
  }

  // ---------- rinse ----------
  startRinse(g) {
    this.mode = 'rinse';
    this.sponge.visible = false;
    this.pitcher.visible = true; this.pitcher.position.copy(this.sponge.position).setY(1.15); this.pitcher.rotation.set(0, 0, 0);
    this.rinseGrid.fill(0);
    this.rinse = { g, prog: 0, tilt: 0, frame: 0, done: false };
    this.ui.task(`Rinse the ${g.type.name}`, 'Hold the mouse to pour water over the suds', 0);
    this.ui.hint('Hold to <b>pour</b> and rinse away the suds');
  }

  updateRinse(dt) {
    const r = this.rinse, g = r.g, M = L.mat;
    this.ray.setFromCamera(this.ndc, this.camera);
    const hit = this.planeHit(1.12);
    const pp = this.pitcher.position;
    if (hit) { pp.x = damp(pp.x, clamp(hit.x - 0.1, M.x - 0.62, M.x + 0.5), 18, dt); pp.z = damp(pp.z, clamp(hit.z, M.z - 0.55, M.z + 0.6), 18, dt); }
    pp.y = damp(pp.y, 1.12 + (this.pressed ? 0 : 0.05), 10, dt);
    r.tilt = damp(r.tilt, this.pressed && !r.done ? -1.15 : 0, 9, dt);
    this.pitcher.rotation.z = r.tilt + Math.sin(this.t * 3) * 0.02;
    const pour = r.tilt < -0.55 && !r.done;
    this.audio.setLoop('pour', pour ? 0.35 : 0, 1);
    if (!pour) return;
    this.pitcher.updateMatrixWorld();
    const sp = this.pitcher.localToWorld(_v.copy(this.pitcher.userData.spout));
    for (let i = 0; i < 3; i++) this.fx.drop(sp.x + rand(-0.008, 0.008), sp.y - 0.01, sp.z + rand(-0.008, 0.008), rand(0.25, 0.45), rand(-0.3, 0), rand(-0.05, 0.05), rand(0.008, 0.013), Math.random() < 0.35);
    const lx = sp.x + 0.08, lz = sp.z;
    const uv = this.uvBelow(g, lx, lz);
    if (uv) {
      const rad = 0.075;
      g.erase(g.foam, g.fctx, uv.x, uv.y, rad * 1.2, 0.35);
      g.composite();
      this.wetGrid(g, uv.x, uv.y, rad, dt * 3.2);
      if (Math.random() < 0.25) this.fx.bubble(lx + rand(-0.05, 0.05), L.mat.top + 0.03, lz + rand(-0.05, 0.05), rand(0.01, 0.02), [rand(-0.3, 0.3), rand(0.2, 0.5), rand(-0.3, 0.3)]);
      r.at = [lx, lz];
    } else r.at = null;
    if (++r.frame % 6 === 0) {
      let sum = 0;
      for (let i = 0; i < MS * MS; i++) if (g.mask[i]) sum += Math.min(1, this.rinseGrid[i]);
      r.prog = clamp(sum / g.maskCount / 0.9, 0, 1);
      g.setWet(0.1 + 0.85 * r.prog);
      this.ui.task(undefined, undefined, r.prog);
      if (r.prog >= 1) this.finishRinse();
    }
  }

  fixedRinse() {
    const r = this.rinse; if (!r || !r.at || r.done) return;
    const c = r.g.cloth, [x, z] = r.at;
    for (let k = 0; k < c.n; k++) {
      const i = k * 3, d = Math.hypot(c.pos[i] - x, c.pos[i + 2] - z);
      if (d < 0.08) c.pos[i + 1] -= 0.0012 * (1 - d / 0.08);
    }
  }

  wetGrid(g, u, v, r, amt) {
    const T = g.type, cx = u * MS, cy = (1 - v) * MS, rx = r / T.W * MS, ry = r / T.H * MS;
    const x0 = Math.max(0, Math.floor(cx - rx)), x1 = Math.min(MS - 1, Math.ceil(cx + rx));
    const y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(MS - 1, Math.ceil(cy + ry));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry, d = dx * dx + dy * dy;
      if (d < 1) this.rinseGrid[y * MS + x] += amt * (1 - d * 0.6);
    }
  }

  finishRinse() {
    const r = this.rinse, g = r.g;
    r.done = true;
    g.fctx.clearRect(0, 0, g.foam.width, g.foam.height); g.composite();
    g.setWet(0.95);
    this.audio.setLoop('pour', 0);
    this.audio.success();
    g.cloth.centroid(_v);
    this.fx.sparkleBurst(_v.x, _v.y + 0.05, _v.z, 18, 0.35, 0xbfe8ff);
    const p = this.screenOf(_v); this.ui.popup('Squeaky clean!', p.x, p.y - 40, 'gold');
    this.later(0.55, () => this.startWring(g));
  }

  // ---------- wring ----------
  startWring(g) {
    this.mode = 'wring'; this.view = 'wring';
    this.pitcher.visible = false;
    const c = g.cloth, T = g.type;
    c.clearSprings(); c.canSleep = false; c.wake();
    const H = T.H, yb = L.tub.top + 0.14;
    const w = this.wring = {
      g, gx: L.tub.x, gz: L.tub.z + 0.02, yb0: yb, yt: yb + H * 0.97, H,
      theta: 0, p: 0, lastA: null, t: 0, intro: 0.55, phase: 'intro',
      need: Math.PI * 2 * 1.5 / (1 + 0.3 * this.up.arms), from: new Float32Array(c.n * 3), angVel: 0,
    };
    w.from.set(c.pos);
    this.ui.task(`Wring the ${T.name}`, 'Hold and circle the mouse to twist', 0);
    this.ui.hint('Hold and <b>circle</b> the mouse to wring it out');
    for (const gl of this.gloves) gl.visible = true;
  }

  wringTarget(k, top, out) {
    const w = this.wring, c = w.g.cloth, p = w.p;
    if (top) { out[0] = w.gx + c.rx[k] * (1 - 0.45 * p); out[1] = w.yt; out[2] = w.gz; return out; }
    const ox = c.rx[k] * (1 - 0.65 * p), th = w.theta;
    out[0] = w.gx + ox * Math.cos(th); out[1] = w.yb0 + w.H * 0.22 * p; out[2] = w.gz - ox * Math.sin(th);
    return out;
  }

  updateWring(dt) {
    const w = this.wring, g = w.g;
    w.t += dt;
    const mid = V(w.gx, (w.yt + w.yb0 + w.H * 0.22 * w.p) / 2, w.gz);
    const sc = this.screenOf(mid);
    if (w.phase === 'play') {
      this.ui.wringGuide.classList.remove('hidden');
      this.ui.place(this.ui.wringGuide, sc.x, sc.y);
      if (this.pressed) {
        const a = Math.atan2(this.sy - sc.y, this.sx - sc.x);
        if (w.lastA !== null) {
          const d = clamp(wrapAngle(a - w.lastA), -0.6, 0.6);
          w.theta += d;
          w.angVel = damp(w.angVel, Math.abs(d) / Math.max(dt, 1e-3), 10, dt);
        }
        w.lastA = a;
      } else { w.lastA = null; w.angVel = damp(w.angVel, 0, 8, dt); }
      w.p = clamp(Math.abs(w.theta) / w.need, 0, 1);
      g.setWet(0.95 - 0.35 * w.p);
      this.ui.task(undefined, undefined, w.p);
      this.audio.setLoop('wring', clamp(w.angVel * 0.06, 0, 0.45), 0.8 + w.p * 0.9);
      // drips
      const rate = clamp(w.angVel * 6 * (1.1 - w.p * 0.6), 0, 40);
      let n = rate * dt; while (n > 0) {
        if (Math.random() < n) {
          const c = g.cloth, k = (Math.random() * c.n) | 0, i = k * 3;
          this.fx.drop(c.pos[i], c.pos[i + 1], c.pos[i + 2], rand(-0.4, 0.4), rand(-0.2, 0.3), rand(-0.4, 0.4), rand(0.007, 0.012));
        }
        n -= 1;
      }
      if (w.p >= 1) this.finishWring();
    } else this.ui.wringGuide.classList.add('hidden');
    // gloves
    const [g1, g2] = this.gloves;
    g1.position.set(w.gx, w.yt + 0.045, w.gz + 0.03); g1.rotation.set(0, 0, 0);
    g2.position.set(w.gx, w.yb0 + w.H * 0.22 * w.p - 0.045, w.gz + 0.03); g2.rotation.set(Math.PI, w.theta, 0);
    if (w.phase === 'out') { for (const gl of this.gloves) gl.visible = false; }
  }

  fixedWring() {
    const w = this.wring, g = w.g, c = g.cloth, o = [0, 0, 0];
    if (w.phase === 'intro') {
      const e = easeInOut(Math.min(1, w.t / w.intro));
      for (const k of g.topRow) { this.wringTarget(k, true, o); const i = k * 3; c.setPin(k, lerp(w.from[i], o[0], e), lerp(w.from[i + 1], o[1], e), lerp(w.from[i + 2], o[2], e)); }
      for (const k of g.botRow) { this.wringTarget(k, false, o); const i = k * 3; c.setPin(k, lerp(w.from[i], o[0], e), lerp(w.from[i + 1], o[1], e), lerp(w.from[i + 2], o[2], e)); }
      if (w.t >= w.intro) w.phase = 'play';
    } else if (w.phase === 'play') {
      for (const k of g.topRow) { this.wringTarget(k, true, o); c.setPin(k, o[0], o[1], o[2]); }
      for (const k of g.botRow) { this.wringTarget(k, false, o); c.setPin(k, o[0], o[1], o[2]); }
    } else if (w.phase === 'out') {
      const e = easeInOut(Math.min(1, w.ot / 0.4));
      for (const k of g.topRow) { this.wringTarget(k, true, o); c.setPin(k, lerp(o[0], L.mat.x + c.rx[k] * 0.6, e), lerp(o[1], 1.3, e), lerp(o[2], L.mat.z, e)); }
    }
  }

  finishWring() {
    const w = this.wring, g = w.g, c = g.cloth;
    w.phase = 'out'; w.ot = 0;
    for (const k of g.botRow) c.unpin(k);
    g.clean = true; g.dry = false; g.setWet(0.6);
    this.audio.setLoop('wring', 0);
    this.audio.success();
    this.ui.wringGuide.classList.add('hidden');
    const p = this.screenOf(V(w.gx, w.yt - 0.2, w.gz)); this.ui.popup('Wrung out!', p.x, p.y, 'gold');
    for (let i = 0; i < 25; i++) this.fx.drop(w.gx + rand(-0.1, 0.1), w.yb0 + rand(0, 0.3), w.gz + rand(-0.05, 0.05), rand(-0.6, 0.6), rand(0, 0.8), rand(-0.5, 0.5));
  }

  // ---------- hang ----------
  findSlot(g, want) {
    const w = g.type.W + 0.06, lo = L.line.x0 + 0.08, hi = L.line.x1 - 0.08;
    const free = (c) => c - w / 2 >= lo - 1e-6 && c + w / 2 <= hi + 1e-6 && this.lineOcc.every((o) => o.g === g || c + w / 2 <= o.x0 || c - w / 2 >= o.x1);
    const cands = [clamp(want, lo + w / 2, hi - w / 2), lo + w / 2, hi - w / 2];
    for (const o of this.lineOcc) cands.push(o.x1 + w / 2 + 0.001, o.x0 - w / 2 - 0.001);
    let best = null, bd = 1e9;
    for (const c of cands) if (free(c) && Math.abs(c - want) < bd) { bd = Math.abs(c - want); best = c; }
    return best === null ? null : { c: best, w };
  }

  hang(g) {
    const c = g.cloth;
    c.centroid(_v);
    const slot = this.findSlot(g, _v.x);
    if (!slot) return;
    g.where = 'line'; c.canSleep = false; c.wake();
    const occ = { g, x0: slot.c - slot.w / 2, x1: slot.c + slot.w / 2 };
    this.lineOcc.push(occ);
    // pick pin particles: the outer top corners (+ the middle for wide pieces)
    const top = g.topRow.slice().sort((a, b) => c.rx[a] - c.rx[b]);
    const pins = [top[0], top[top.length - 1]];
    if (g.type.W > 0.5) pins.push(top[(top.length / 2) | 0]);
    const z = L.line.z + 0.012;
    g.line = { occ, pins: [], pegs: [], ring: this.ui.ring(), cx: slot.c, phase: rand(0, 6) };
    pins.forEach((k, n) => {
      const x = slot.c + c.rx[k], y = ropeY(x) - 0.012;
      g.line.pins.push({ k, from: [c.pos[k * 3], c.pos[k * 3 + 1], c.pos[k * 3 + 2]], to: [x, y, z], t: -n * 0.05 });
      const peg = makePeg(); peg.position.set(x, y + 0.03, z + 0.004); peg.scale.setScalar(0.001); this.scene.add(peg);
      g.line.pegs.push(peg);
      this.later(0.18 + n * 0.08, () => { this.audio.pin(); this.fx.sparkleBurst(x, y + 0.03, z + 0.02, 5, 0.08); });
    });
    this.audio.grab();
  }

  unhang(g) {
    const ln = g.line; if (!ln) return;
    this.lineOcc = this.lineOcc.filter((o) => o !== ln.occ);
    for (const p of ln.pegs) { this.fx.sparkleBurst(p.position.x, p.position.y, p.position.z, 3, 0.05); this.scene.remove(p); }
    ln.ring.remove();
    g.cloth.unpinAll();
    g.line = null;
    this.audio.pin();
  }

  fixedLine(g, dt) {
    const c = g.cloth, ln = g.line, t = this.t + ln.phase;
    const gust = 0.55 + 0.45 * Math.sin(t * 0.71) * Math.sin(t * 0.23 + 1);
    c.wind[0] = 0.25 * Math.sin(t * 0.37); c.wind[1] = 0; c.wind[2] = gust * (1 + 0.6 * (1 - g.wet) * 0);
    for (const p of ln.pins) {
      p.t += dt;
      const e = easeOut(clamp(p.t / 0.28, 0, 1));
      c.setPin(p.k, lerp(p.from[0], p.to[0], e), lerp(p.from[1], p.to[1], e), lerp(p.from[2], p.to[2], e));
    }
  }

  updateLine(g, dt) {
    const ln = g.line;
    ln.pegs.forEach((p, n) => { const t = ln.pins[n].t; const s = t < 0.2 ? 0.001 : Math.min(1, easeOut((t - 0.2) / 0.15) * 1.15); p.scale.setScalar(Math.max(0.001, s)); });
    if (!g.dry) {
      const dryTime = (9 + g.type.value * 0.45) / (1 + 0.3 * this.up.sun);
      g.setWet(g.wet - dt * 0.6 / dryTime);
      if (Math.random() < dt * 3) { // little steam wisps
        const c = g.cloth, k = (Math.random() * c.n) | 0;
        this.fx.spark(c.pos[k * 3], c.pos[k * 3 + 1], c.pos[k * 3 + 2] + 0.02, rand(0.03, 0.06), 0xffffff, rand(0.6, 1), [0, 0.25, 0.05]);
      }
      if (g.wet <= 0.001) {
        g.dry = true; g.setWet(0);
        ln.ring.classList.add('done'); ln.ring.querySelector('span').textContent = '✓';
        this.audio.sparkle();
        g.cloth.centroid(_v);
        this.fx.sparkleBurst(_v.x, _v.y, _v.z + 0.05, 16, 0.3);
      }
    }
    const pct = g.dry ? 100 : (1 - g.wet / 0.6) * 100;
    ln.ring.style.setProperty('--p', `${clamp(pct, 0, 100).toFixed(1)}%`);
    const s = this.screenOf(_v.set(ln.cx, ropeY(ln.cx) + 0.16, L.line.z));
    this.ui.place(ln.ring, s.x, s.y, s.vis && this.view === 'overview');
  }

  // ---------- machine ----------
  enableMachine() {
    const m = this.room.machine;
    if (m.visible) return;
    m.visible = true; m.userData.contact.visible = true;
    this.env.boxes.push(m.userData.box);
  }

  startMachine(g) {
    const m = this.room.machine;
    g.where = 'machine';
    const door = V(L.machine.x, 0.42, L.machine.z + 0.36);
    this.machineJob = { g, t: 0, dur: 12 / (1 + 0.45 * (this.up.machine - 1)), door, suck: 0 };
    m.userData.drumFace.visible = true;
    this.audio.plop();
  }

  updateMachine(dt) {
    const j = this.machineJob; if (!j) { this.machineRing.style.display = 'none'; return; }
    const m = this.room.machine, g = j.g;
    j.t += dt;
    if (j.suck < 1) {
      j.suck = Math.min(1, j.suck + dt / 0.35);
      const s = 1 - easeInOut(j.suck);
      g.mesh.scale.setScalar(Math.max(0.001, s)); g.mesh.position.copy(j.door).multiplyScalar(1 - s);
      if (j.suck >= 1) g.mesh.visible = false;
    }
    m.userData.drum.rotation.z -= dt * (6 + 4 * Math.sin(j.t * 0.8));
    m.position.x = L.machine.x + Math.sin(j.t * 37) * 0.004;
    if (Math.random() < dt * 8) this.fx.bubble(j.door.x + rand(-0.15, 0.15), j.door.y + rand(-0.15, 0.15), j.door.z + 0.02, rand(0.01, 0.02), [rand(-0.1, 0.1), rand(0.1, 0.3), 0.15]);
    const s = this.screenOf(_v.set(L.machine.x, 1.15, L.machine.z));
    this.machineRing.style.setProperty('--p', `${clamp(j.t / j.dur * 100, 0, 100)}%`);
    this.ui.place(this.machineRing, s.x, s.y, s.vis && this.view === 'overview');
    if (j.t >= j.dur) {
      this.machineJob = null;
      m.position.x = L.machine.x;
      m.userData.drumFace.visible = false;
      g.sctx.clearRect(0, 0, 512, 512); g.fctx.clearRect(0, 0, 512, 512); g.composite();
      g.clean = true; g.dry = false; g.setWet(0.6);
      g.mesh.visible = true; g.mesh.scale.setScalar(1); g.mesh.position.set(0, 0, 0);
      const c = g.cloth, d = j.door;
      c.place((rx, ry, o) => { o[0] = d.x + rx * 0.5; o[1] = d.y + ry * 0.3; o[2] = d.z + 0.15 + Math.sin(rx * 9) * 0.03; }, (o, v) => { v[0] = rand(-0.3, 0.3); v[1] = 1.6; v[2] = 2.4; });
      c.canSleep = true; g.where = 'free';
      this.audio.success(); this.audio.splash();
      this.fx.sparkleBurst(d.x, d.y, d.z + 0.2, 16, 0.3);
      const p = this.screenOf(d); this.ui.popup('Clean!', p.x, p.y - 40, 'gold');
    }
  }

  // ---------- fold ----------
  startFold(g) {
    const F = L.fold, c = g.cloth;
    this.kickFrom(new THREE.Box3(V(F.x0, 0.7, F.z0), V(F.sx - 0.25, 1.4, F.z1)), g);
    this.mode = 'fold'; this.view = 'fold';
    g.where = 'station'; c.canSleep = false; c.wake();
    this.setFlat(g, F.fx, F.top + 0.006, F.fz, 0.03);
    this.fold = { g, phase: 'flatten', t: 0, step: 0, p: 0, drag: false, X: new Float32Array(c.n), Y: new Float32Array(c.n), Z: new Float32Array(c.n) };
    this.audio.plop();
    this.hideTags();
    const n = g.type.folds.length;
    this.ui.task(`Fold the ${g.type.name}`, `Fold 1 of ${n}`, 0);
    this.ui.hint('Drag across the <b>dashed line</b> to fold');
  }

  fixedFold() {
    const f = this.fold; if (f.phase !== 'flatten') return;
    const c = f.g.cloth, k0 = lerp(0.03, 0.3, Math.min(1, f.t / 0.5));
    for (let k = 0; k < c.n; k++) c.sK[k] = k0;
  }

  updateFold(dt) {
    const f = this.fold, g = f.g, c = g.cloth, F = L.fold;
    f.t += dt;
    if (f.phase === 'flatten') {
      if (f.t > 0.6) {
        for (let k = 0; k < c.n; k++) { f.X[k] = F.fx + c.rx[k]; f.Z[k] = F.fz - c.ry[k]; f.Y[k] = 0.006; }
        c.clearSprings(); g.kin = true;
        this.prepFold();
        this.poseFold(0);
      }
      return;
    }
    if (f.phase === 'ready' && f.drag) {
      this.ray.setFromCamera(this.ndc, this.camera);
      const a = this.tableHit();
      if (a) {
        const cur = f.cur, v = cur.ax === 'x' ? a.x : a.z;
        f.p = clamp((v - f.a0) * -cur.m / (2 * cur.e) * 1.25, 0, 1);
      }
      this.poseFold(f.p);
      this.audio.setLoop('whoosh', f.p > 0.02 && f.p < 0.98 ? 0.12 : 0, 1.4);
    } else if (f.phase === 'anim') {
      const A = f.anim; A.t += dt;
      const e = easeOut(Math.min(1, A.t / A.dur));
      f.p = lerp(A.from, A.to, e);
      this.poseFold(f.p);
      if (A.t >= A.dur) {
        this.audio.setLoop('whoosh', 0);
        if (A.to === 1) this.commitFold(); else f.phase = 'ready';
      }
    } else if (f.phase === 'fly') {
      this.updateFly(dt);
    }
    // guide animation
    if (f.phase === 'ready' || f.phase === 'anim') {
      this.dashTex.offset.x -= dt * 1.5;
      const cur = f.cur, b = Math.sin(this.t * 5) * 0.5 + 0.5;
      const show = f.phase === 'ready' && !f.drag;
      this.arrow.visible = show; this.guide.visible = f.phase === 'ready';
      const ax = cur.ax === 'x';
      const fc = cur.c + cur.m * cur.e * 0.5 - (-cur.m) * 0 + (-cur.m) * b * 0.05;
      if (ax) this.arrow.position.set(fc, F.top + cur.yAxis + 0.06, cur.mid);
      else this.arrow.position.set(cur.mid, F.top + cur.yAxis + 0.06, fc);
    } else { this.arrow.visible = false; this.guide.visible = false; }
  }

  prepFold() {
    const f = this.fold, st = f.g.type.folds[f.step];
    const A = st.ax === 'x' ? f.X : f.Z, B = st.ax === 'x' ? f.Z : f.X;
    let mn = 1e9, mx = -1e9, bmn = 1e9, bmx = -1e9, ymax = 0;
    for (let k = 0; k < A.length; k++) { mn = Math.min(mn, A[k]); mx = Math.max(mx, A[k]); bmn = Math.min(bmn, B[k]); bmx = Math.max(bmx, B[k]); ymax = Math.max(ymax, f.Y[k]); }
    const c = mn + st.t * (mx - mn);
    const m = st.ax === 'x' ? (st.s < 0 ? -1 : 1) : (st.s > 0 ? 1 : -1);
    const moving = new Uint8Array(A.length);
    let e = 0.01;
    for (let k = 0; k < A.length; k++) if ((A[k] - c) * m > 1e-5) { moving[k] = 1; e = Math.max(e, Math.abs(A[k] - c)); }
    f.cur = { ax: st.ax, c, m, e, yAxis: ymax + 0.008, moving, mid: (bmn + bmx) / 2, len: bmx - bmn };
    f.phase = 'ready'; f.p = 0;
    // guide strip along the fold line
    const F = L.fold, len = bmx - bmn + 0.12;
    this.guide.rotation.set(0, st.ax === 'x' ? Math.PI / 2 : 0, 0);
    if (st.ax === 'x') this.guide.position.set(c, F.top + ymax + 0.012, (bmn + bmx) / 2);
    else this.guide.position.set((bmn + bmx) / 2, F.top + ymax + 0.012, c);
    this.guideStrip.scale.x = len; this.dashTex.repeat.x = len / 0.06;
    this.arrow.rotation.set(0, st.ax === 'x' ? (m > 0 ? Math.PI : 0) : (m > 0 ? Math.PI / 2 : -Math.PI / 2), 0);
    const n = f.g.type.folds.length;
    this.ui.task(undefined, `Fold ${f.step + 1} of ${n}`, f.step / n);
  }

  poseFold(p) {
    const f = this.fold, c = f.g.cloth, cur = f.cur, F = L.fold, pos = c.pos;
    for (let k = 0; k < c.n; k++) {
      const i = k * 3;
      let x = f.X[k], y = f.Y[k], z = f.Z[k];
      if (cur && cur.moving[k] && p > 0) {
        const A = cur.ax === 'x' ? x : z;
        const d = Math.abs(A - cur.c);
        const th = Math.PI * Math.min(1, p * (1.3 - 0.3 * d / cur.e));
        const h = y - cur.yAxis;
        const d2 = d * Math.cos(th) - h * Math.sin(th), h2 = d * Math.sin(th) + h * Math.cos(th);
        const a2 = cur.c + cur.m * d2;
        if (cur.ax === 'x') x = a2; else z = a2;
        y = cur.yAxis + h2;
      }
      pos[i] = x; pos[i + 1] = F.top + y; pos[i + 2] = z;
    }
    c.prev.set(pos);
    c.updateGeometry();
  }

  commitFold() {
    const f = this.fold, cur = f.cur;
    const A = cur.ax === 'x' ? f.X : f.Z;
    for (let k = 0; k < A.length; k++) if (cur.moving[k]) { A[k] = cur.c - cur.m * Math.abs(A[k] - cur.c); f.Y[k] = 2 * cur.yAxis - f.Y[k]; }
    f.cur = null;
    this.poseFold(0);
    this.audio.fold();
    const F = L.fold;
    for (let i = 0; i < 6; i++) {
      const along = rand(-0.5, 0.5) * 0.3;
      if (cur.ax === 'x') this.fx.spark(cur.c, F.top + 0.03, cur.mid + along, rand(0.04, 0.08)); else this.fx.spark(cur.mid + along, F.top + 0.03, cur.c, rand(0.04, 0.08));
    }
    f.step++;
    const n = f.g.type.folds.length;
    if (f.step >= n) {
      this.ui.task(undefined, 'Neatly folded!', 1);
      f.phase = 'wait';
      this.later(0.22, () => this.startFly());
    } else this.prepFold();
  }

  startFly() {
    const f = this.fold;
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, ym = 0;
    for (let k = 0; k < f.X.length; k++) { x0 = Math.min(x0, f.X[k]); x1 = Math.max(x1, f.X[k]); z0 = Math.min(z0, f.Z[k]); z1 = Math.max(z1, f.Z[k]); ym = Math.max(ym, f.Y[k]); }
    f.fly = { t: 0, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, ym, base: this.stackH, rot: rand(-0.25, 0.25) };
    f.phase = 'fly';
    this.audio.grab();
  }

  updateFly(dt) {
    const f = this.fold, fl = f.fly, c = f.g.cloth, F = L.fold, pos = c.pos;
    fl.t += dt;
    const D = 0.42, e = easeInOut(Math.min(1, fl.t / D));
    const tx = lerp(fl.cx, F.sx, e), tz = lerp(fl.cz, F.sz, e);
    const arc = Math.sin(Math.PI * e) * 0.32;
    const st = Math.max(0, fl.t - D), sq = st < 0.3 ? Math.sin(Math.PI * st / 0.3) * (1 - st / 0.3) : 0;
    const sy = 1 - 0.45 * sq, sxz = 1 + 0.08 * sq;
    const r = fl.rot * e, cr = Math.cos(r), sr = Math.sin(r);
    for (let k = 0; k < c.n; k++) {
      const i = k * 3, lx = (f.X[k] - fl.cx) * sxz, lz = (f.Z[k] - fl.cz) * sxz;
      pos[i] = tx + lx * cr - lz * sr; pos[i + 2] = tz + lx * sr + lz * cr;
      pos[i + 1] = F.top + lerp(0, fl.base, e) + arc + f.Y[k] * sy;
    }
    c.prev.set(pos); c.updateGeometry();
    if (fl.t >= D && !fl.landed) { fl.landed = true; this.landStack(); }
    if (fl.t >= D + 0.32) this.finishFold();
  }

  landStack() {
    const f = this.fold, g = f.g, F = L.fold, T = g.type;
    const val = Math.round(T.value * (1 + 0.15 * this.up.softener) * (1 + 0.25 * this.up.clientele));
    this.coins += val; this.basket.earned += val;
    this.audio.plop(); this.audio.sparkle();
    const top = V(F.sx, F.top + this.stackH + f.fly.ym + 0.05, F.sz);
    this.fx.sparkleBurst(top.x, top.y, top.z, 20, 0.25);
    this.fx.ring(top.x, F.top + this.stackH + 0.01, top.z, 0.05, 0.3, 0.5, 0xfff2b0);
    const s = this.screenOf(top);
    this.ui.popup(`+${val}`, s.x, s.y - 30, 'gold');
    this.flyCoins(s.x, s.y, val);
    this.stackH += f.fly.ym + 0.012;
    this.save();
  }

  finishFold() {
    const f = this.fold, g = f.g;
    f.phase = 'done';
    g.where = 'stack';
    this.stack.push(g);
    this.basket.done++;
    this.ui.setBasket(this.basketNum, this.basket.done, this.basket.total);
    this.ui.hideTask();
    this.fold = null;
    if (this.basket.done >= this.basket.total) this.later(0.35, () => this.basketComplete());
    else { this.mode = 'overview'; this.view = 'overview'; }
  }

  flyCoins(x, y, val) {
    const n = Math.min(14, Math.max(3, Math.ceil(val / 2)));
    const per = val / n;
    this.ui.flyCoins(x, y, n, (i) => {
      this.shown = Math.min(this.coins, this.shown + per);
      if (i === n - 1) this.shown = this.coins;
      this.ui.setCoins(this.shown, true);
      this.audio.coin(i);
      if (i === n - 1) this.renderShop();
    });
  }

  // ---------- celebration ----------
  basketComplete() {
    this.mode = 'celebrate'; this.view = 'celebrate';
    const F = L.fold;
    this.audio.fanfare();
    this.fx.confettiBurst(F.sx, F.top + this.stackH + 0.25, F.sz, 160, 3.2);
    this.later(0.45, () => this.fx.confettiBurst(F.sx - 0.6, F.top + 0.5, F.sz - 0.2, 80, 2.6));
    this.later(0.75, () => this.fx.confettiBurst(F.sx + 0.4, F.top + 0.5, F.sz + 0.1, 80, 2.6));
    this.cele = { t: 0, shown: false };
    this.ui.hint(null);
  }

  showCele() {
    if (this.cele.shown) return;
    this.cele.shown = true;
    const b = this.basket;
    const tip = Math.round(b.earned * 0.25 * (1 + 0.2 * this.up.clientele));
    this.ui.showCelebrate([
      ['Items washed', `${b.total}`],
      ['Earned', `+${b.earned}`],
      ['Happy-customer tip', `+${tip}`],
      ['Basket total', `${b.earned + tip}`],
    ], () => this.nextBasket(tip));
    this.audio.success();
  }

  nextBasket(tip) {
    this.coins += tip;
    this.flyCoins(innerWidth / 2, innerHeight / 2, tip);
    this.basketNum++;
    this.save();
    // deliver the stack
    this.stack.forEach((g, i) => { g.where = 'leaving'; this.leaving.push({ g, t: -i * 0.07 }); });
    this.stack = []; this.stackH = 0;
    this.mode = 'overview'; this.view = 'overview';
    this.later(0.5, () => this.newBasket());
  }

  updateLeaving(dt) {
    for (const l of this.leaving) {
      l.t += dt;
      const e = Math.max(0, l.t) / 0.7, m = l.g.mesh;
      m.position.set(e * e * 2.5, e * 1.2 + Math.sin(Math.PI * Math.min(1, e)) * 0.3, -e * 1.0);
      if (l.t > 0.75) { this.scene.remove(m); l.g.dispose(); l.dead = true; this.garments = this.garments.filter((g) => g !== l.g); }
    }
    this.leaving = this.leaving.filter((l) => !l.dead);
  }

  // ---------- shop ----------
  costOf(u) { return Math.round(u.base * Math.pow(u.mul, this.up[u.id])); }
  renderShop() {
    const items = UPGRADES.map((u) => ({
      id: u.id, name: u.name, icon: u.icon, color: u.color, desc: u.desc,
      level: this.up[u.id], max: u.max, cost: this.costOf(u),
      levelText: u.id === 'machine' && !this.up.machine ? 'new!' : `Lv ${this.up[u.id]}`,
    }));
    this.ui.renderShop(items, this.coins, (id) => this.buy(id));
  }
  buy(id) {
    const u = UPGRADES.find((x) => x.id === id), cost = this.costOf(u);
    if (this.up[id] >= u.max || this.coins < cost) { this.audio.deny(); return; }
    this.coins -= cost; this.shown = this.coins; this.up[id]++;
    if (id === 'machine') { this.enableMachine(); this.fx.sparkleBurst(L.machine.x, 1, L.machine.z, 30, 0.6); }
    this.audio.buy();
    this.ui.setCoins(this.coins, true);
    this.save();
    this.renderShop();
  }

  // ---------- helpers ----------
  screenOf(p) {
    _v2.copy(p).project(this.camera);
    const r = this.canvas.getBoundingClientRect();
    return { x: r.left + (_v2.x * 0.5 + 0.5) * r.width, y: r.top + (-_v2.y * 0.5 + 0.5) * r.height, vis: _v2.z < 1 && Math.abs(_v2.x) < 1.05 && Math.abs(_v2.y) < 1.05 };
  }
  planeHit(y) {
    const o = this.ray.ray.origin, d = this.ray.ray.direction;
    if (Math.abs(d.y) < 1e-5) return null;
    const t = (y - o.y) / d.y; if (t < 0) return null;
    return V(o.x + d.x * t, y, o.z + d.z * t);
  }
  surfaceAt(x, z) {
    const T = L.tub, B = L.bench, F = L.fold, K = L.basket;
    if (Math.hypot(x - T.x, z - T.z) < T.r + 0.08) return T.top;
    if (x > B.x0 - 0.05 && x < B.x1 + 0.05 && z > B.z0 - 0.05 && z < B.z1 + 0.05) return B.top;
    if (x > F.x0 - 0.05 && x < F.x1 + 0.05 && z > F.z0 - 0.05 && z < F.z1 + 0.05) return F.top;
    if (Math.hypot(x - K.x, z - K.z) < K.rout + 0.05) return K.rimY;
    if (this.up.machine > 0 && x > L.machine.x - 0.45 && x < L.machine.x + 0.45 && z > L.machine.z - 0.45 && z < L.machine.z + 0.45) return 1.0;
    return 0;
  }
  tableHit() { return this.planeHit(L.fold.top + 0.01); }
  uvBelow(g, x, z) {
    this.down.set(_v.set(x, 2.5, z), _down);
    const h = this.down.intersectObject(g.mesh, false)[0];
    return h ? h.uv : null;
  }
  hideTags() { for (const t of Object.values(this.tags)) t.classList.add('hidden'); }

  // ---------- main loops ----------
  fixed(dt) {
    if (this.mode === 'title') return;
    if (this.held) this.fixedHeld(dt);
    if (this.mode === 'scrub') this.fixedScrub(dt);
    if (this.mode === 'rinse') this.fixedRinse(dt);
    if (this.mode === 'wring') this.fixedWring(dt);
    if (this.mode === 'fold') this.fixedFold(dt);
    for (const g of this.garments) {
      if (g.kin || g.where === 'stack' || g.where === 'machine' || g.where === 'leaving') continue;
      const c = g.cloth;
      if (g.where === 'line') this.fixedLine(g, dt);
      c.step(dt, this.env, 2);
      if (c.sleeping) continue;
      if (g.where === 'free' || g.where === 'held' || g.where === 'pile') {
        const p = c.pos;
        for (let i = 0; i < p.length; i += 3) {
          if (p[i] < -4.3) p[i] = -4.3; else if (p[i] > 4.2) p[i] = 4.2;
          if (p[i + 2] > 2.6) p[i + 2] = 2.6;
        }
      }
      c.updateGeometry();
    }
  }

  update(dt) {
    this.t += dt;
    for (const tm of this.timers) { tm.t -= dt; if (tm.t <= 0 && !tm.done) { tm.done = true; tm.fn(); } }
    this.timers = this.timers.filter((t) => !t.done);
    for (const s of this.spawnQ) { s.t -= dt; if (s.t <= 0) { s.done = true; this.spawnGarment(s.type, s.layer); } }
    this.spawnQ = this.spawnQ.filter((s) => !s.done);

    const m = this.mode;
    if (m === 'overview') this.updateOverview(dt);
    else if (m === 'scrub') this.updateScrub(dt);
    else if (m === 'rinse') this.updateRinse(dt);
    else if (m === 'wring') this.updateWring(dt);
    else if (m === 'fold') this.updateFold(dt);
    else if (m === 'celebrate') { this.cele.t += dt; if (this.cele.t > 1.4 && !this.cele.shown) this.showCele(); }
    if (m === 'wring' && this.wring.phase === 'out') {
      this.wring.ot += dt;
      if (this.wring.ot > 0.45) {
        const g = this.wring.g; g.cloth.unpinAll(); g.cloth.canSleep = true; g.where = 'free';
        this.wring = null; this.mode = 'overview'; this.view = 'overview';
        this.ui.hideTask();
      }
    }
    if (m !== 'scrub') this.sponge.visible = false;
    if (m !== 'rinse') this.pitcher.visible = false;
    if (m !== 'wring') { for (const gl of this.gloves) gl.visible = false; this.ui.wringGuide.classList.add('hidden'); }

    for (const g of this.garments) if (g.where === 'line') this.updateLine(g, dt);
    this.updateMachine(dt);
    this.updateLeaving(dt);
    this.updateCamera(dt);

    // cursor
    let cur = 'default';
    if (m === 'overview') cur = this.held ? 'grabbing' : (this.hover ? 'grab' : 'default');
    else if (m === 'scrub' || m === 'rinse') cur = 'none';
    else if (m === 'wring' || m === 'fold') cur = this.pressed ? 'grabbing' : 'grab';
    if (this.canvas.style.cursor !== cur) this.canvas.style.cursor = cur;
  }

  updateOverview(dt) {
    if (this.held) { this.updateHeld(dt); }
    else {
      this.hideTags();
      this.ray.setFromCamera(this.ndc, this.camera);
      const h = this.ui.shopOpen ? null : this.pickGarment();
      const g = h ? h.g : null;
      if (g !== this.hover) { this.hover?.setHighlight(false); g?.setHighlight(true); this.hover = g; }
    }
    // hint
    let hint = null;
    if (this.held) {
      const g = this.held.g;
      hint = !g.clean ? (this.up.machine > 0 ? 'Drop it on the <b>wash bench</b> or in the <b>machine</b>' : 'Drop it on the <b>wash bench</b>') : !g.dry ? 'Hang it on the <b>clothesline</b>' : 'Bring it to the <b>folding table</b>';
    } else {
      const fr = this.garments.filter((g) => g.where === 'free' || g.where === 'pile' || g.where === 'line');
      if (fr.some((g) => g.where === 'line' && g.dry)) hint = 'It\'s dry! Drag it to the <b>folding table</b>';
      else if (fr.some((g) => g.where !== 'line' && g.clean && !g.dry)) hint = 'Drag the wet laundry to the <b>clothesline</b>';
      else if (fr.some((g) => !g.clean)) hint = 'Drag laundry from the <b>basket</b> to the <b>wash bench</b>';
      else if (fr.some((g) => g.where === 'line')) hint = 'Drying in the sunshine… ☀';
    }
    this.ui.hint(hint);
  }

  viewTarget(out, look) {
    const v = this.view, M = L.mat, F = L.fold;
    if (v === 'title') { const a = this.t * 0.12; out.set(0.6 + Math.sin(a) * 1.6, 3.3 + Math.sin(a * 0.7) * 0.2, 6.9); look.set(-0.2, 0.9, -0.4); }
    else if (v === 'overview') { out.set(this.mx * 0.22, 3.4 + this.my * 0.1, 6.2); look.set(this.mx * 0.08, 0.85, -0.2); }
    else if (v === 'wash') { out.set(M.x - 0.08, 2.05, M.z + 1.22); look.set(M.x - 0.08, 0.8, M.z + 0.04); }
    else if (v === 'wring') { const w = this.wring, H = w ? w.H : 0.8, cy = L.tub.top + 0.14 + H * 0.5; out.set(L.tub.x + 0.05, cy + 0.3, L.tub.z + 1.2 + H * 0.75); look.set(L.tub.x, cy - 0.03, L.tub.z); }
    else if (v === 'fold') { out.set(1.98, 2.15, 1.95); look.set(1.98, 0.8, 0.56); }
    else if (v === 'celebrate') { out.set(F.sx - 0.35, 1.7, F.sz + 1.35); look.set(F.sx - 0.1, 0.95, F.sz); }
  }

  updateCamera(dt) {
    this.viewTarget(_v, _v2);
    const k = 1 - Math.exp(-(this.view === 'title' ? 1.5 : 4.2) * dt);
    this.camPos.lerp(_v, k);
    this.viewTarget(_v, _v2);
    this.camLook.lerp(_v2, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }
}
