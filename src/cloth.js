import * as THREE from 'three';

// Position-based (Verlet) cloth on a masked grid.
// Rest layout lives in a 2D plane: rx (right), ry (up), in metres.
export class Cloth {
  constructor({ nx, ny, width, height, inside, bend = 0.25, shear = 0.7, density = 0.22 }) {
    this.nx = nx; this.ny = ny; this.W = width; this.H = height;
    const cells = new Uint8Array(nx * ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      let any = false;
      for (let a = 0; a <= 2 && !any; a++) for (let b = 0; b <= 2 && !any; b++) {
        if (inside((i + a * 0.5) / nx, (j + b * 0.5) / ny)) any = true;
      }
      cells[j * nx + i] = any ? 1 : 0;
    }
    const cell = (i, j) => (i >= 0 && j >= 0 && i < nx && j < ny) ? cells[j * nx + i] : 0;
    const idx = new Int32Array((nx + 1) * (ny + 1)).fill(-1);
    let n = 0;
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      if (cell(i - 1, j - 1) || cell(i, j - 1) || cell(i - 1, j) || cell(i, j)) idx[j * (nx + 1) + i] = n++;
    }
    const P = (i, j) => (i < 0 || j < 0 || i > nx || j > ny) ? -1 : idx[j * (nx + 1) + i];
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.prev = new Float32Array(n * 3);
    this.force = new Float32Array(n * 3);
    this.rx = new Float32Array(n);
    this.ry = new Float32Array(n);
    this.gi = new Int16Array(n);
    this.gj = new Int16Array(n);
    this.uv = new Float32Array(n * 2);
    this.pin = new Uint8Array(n);
    this.pinFrom = new Float32Array(n * 3);
    this.pinTo = new Float32Array(n * 3);
    this.tAnchor = new Int32Array(n).fill(-1);
    this.tLen = new Float32Array(n);
    this.sK = new Float32Array(n);
    this.sT = new Float32Array(n * 3);
    this.hasTethers = false;
    this.hasSprings = false;
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const k = P(i, j); if (k < 0) continue;
      this.rx[k] = (i / nx - 0.5) * width;
      this.ry[k] = (j / ny - 0.5) * height;
      this.gi[k] = i; this.gj[k] = j;
      this.uv[k * 2] = i / nx; this.uv[k * 2 + 1] = j / ny;
    }
    // triangles (alternate diagonals for nicer folding)
    const tris = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      if (!cell(i, j)) continue;
      const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1);
      if ((i + j) & 1) tris.push(a, b, c, a, c, d); else tris.push(a, b, d, b, c, d);
    }
    this.tris = new Uint32Array(tris);
    // constraints
    const C = [];
    const add = (p, q, k) => {
      if (p < 0 || q < 0) return;
      C.push(p, q, Math.hypot(this.rx[p] - this.rx[q], this.ry[p] - this.ry[q]), k);
    };
    const hE = (i, j) => cell(i, j - 1) || cell(i, j);
    const vE = (i, j) => cell(i - 1, j) || cell(i, j);
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      if (i < nx && hE(i, j)) add(P(i, j), P(i + 1, j), 1);
      if (j < ny && vE(i, j)) add(P(i, j), P(i, j + 1), 1);
    }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      if (!cell(i, j)) continue;
      add(P(i, j), P(i + 1, j + 1), shear);
      add(P(i + 1, j), P(i, j + 1), shear);
    }
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      if (i + 2 <= nx && hE(i, j) && hE(i + 1, j)) add(P(i, j), P(i + 2, j), bend);
      if (j + 2 <= ny && vE(i, j) && vE(i, j + 1)) add(P(i, j), P(i, j + 2), bend);
    }
    const m = C.length / 4;
    this.cA = new Int32Array(m); this.cB = new Int32Array(m);
    this.cR = new Float32Array(m); this.cK = new Float32Array(m);
    for (let c = 0; c < m; c++) { this.cA[c] = C[c * 4]; this.cB[c] = C[c * 4 + 1]; this.cR[c] = C[c * 4 + 2]; this.cK[c] = C[c * 4 + 3]; }
    this.mass = density * width * height * 0.8 / n;
    this.invMass = 1 / this.mass;
    this.damping = 0.997;
    this.drag = 1.1;
    this.wind = [0, 0, 0];
    this.gravity = -9.8;
    this.friction = 0.55;
    this.iters = 10;
    this.spheres = [];
    this.sleeping = false;
    this._calm = 0;
    this.useColliders = true;
    this.extraBoxes = null;
    // geometry
    const geo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(this.pos, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', posAttr);
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2));
    geo.setIndex(new THREE.BufferAttribute(this.tris, 1));
    this.geometry = geo;
  }

  // place particles via fn(rx, ry, out[3]) and zero velocity (or give initial velocity fn)
  place(fn, velFn = null, h = 1 / 120) {
    const o = [0, 0, 0], v = [0, 0, 0];
    for (let k = 0; k < this.n; k++) {
      fn(this.rx[k], this.ry[k], o, k);
      const x = k * 3;
      this.pos[x] = o[0]; this.pos[x + 1] = o[1]; this.pos[x + 2] = o[2];
      if (velFn) { velFn(o, v, k); this.prev[x] = o[0] - v[0] * h; this.prev[x + 1] = o[1] - v[1] * h; this.prev[x + 2] = o[2] - v[2] * h; }
      else { this.prev[x] = o[0]; this.prev[x + 1] = o[1]; this.prev[x + 2] = o[2]; }
    }
    this.wake();
  }

  wake() { this.sleeping = false; this._calm = 0; }

  setPin(k, x, y, z, snap = false) {
    const i = k * 3;
    if (!this.pin[k] || snap) {
      this.pinFrom[i] = snap ? x : this.pos[i];
      this.pinFrom[i + 1] = snap ? y : this.pos[i + 1];
      this.pinFrom[i + 2] = snap ? z : this.pos[i + 2];
    }
    this.pin[k] = 1;
    this.pinTo[i] = x; this.pinTo[i + 1] = y; this.pinTo[i + 2] = z;
  }
  unpin(k) { this.pin[k] = 0; }
  unpinAll() { this.pin.fill(0); }

  setTethers(anchors, slack = 1.03) {
    for (let k = 0; k < this.n; k++) {
      let best = -1, bd = 1e9;
      for (const a of anchors) {
        const d = Math.hypot(this.rx[k] - this.rx[a], this.ry[k] - this.ry[a]);
        if (d < bd) { bd = d; best = a; }
      }
      this.tAnchor[k] = best === k ? -1 : best;
      this.tLen[k] = bd * slack + 0.002;
    }
    this.hasTethers = true;
  }
  clearTethers() { this.tAnchor.fill(-1); this.hasTethers = false; }

  clearSprings() { this.sK.fill(0); this.hasSprings = false; }

  nearest(x, y, z, filter = null) {
    let best = 0, bd = 1e9;
    for (let k = 0; k < this.n; k++) {
      if (filter && !filter(k)) continue;
      const i = k * 3;
      const d = (this.pos[i] - x) ** 2 + (this.pos[i + 1] - y) ** 2 + (this.pos[i + 2] - z) ** 2;
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }

  centroid(out) {
    let x = 0, y = 0, z = 0;
    for (let k = 0; k < this.n; k++) { x += this.pos[k * 3]; y += this.pos[k * 3 + 1]; z += this.pos[k * 3 + 2]; }
    out.set(x / this.n, y / this.n, z / this.n);
    return out;
  }

  speed() {
    let s = 0;
    for (let k = 0; k < this.n; k += 3) {
      const i = k * 3;
      s += Math.abs(this.pos[i] - this.prev[i]) + Math.abs(this.pos[i + 1] - this.prev[i + 1]) + Math.abs(this.pos[i + 2] - this.prev[i + 2]);
    }
    return s / Math.ceil(this.n / 3) * 120;
  }

  step(dt, env, sub = 2) {
    if (this.sleeping || !(dt > 1e-5)) return;
    const h = dt / sub;
    const pos = this.pos, prev = this.prev, pin = this.pin;
    let motion = 0;
    for (let s = 0; s < sub; s++) {
      const a = (s + 1) / sub;
      this._aero(h);
      const g = this.gravity * h * h, im = this.invMass * h * h, damp = this.damping, f = this.force;
      for (let k = 0; k < this.n; k++) {
        const i = k * 3;
        if (pin[k]) {
          pos[i] = this.pinFrom[i] + (this.pinTo[i] - this.pinFrom[i]) * a;
          pos[i + 1] = this.pinFrom[i + 1] + (this.pinTo[i + 1] - this.pinFrom[i + 1]) * a;
          pos[i + 2] = this.pinFrom[i + 2] + (this.pinTo[i + 2] - this.pinFrom[i + 2]) * a;
          prev[i] = pos[i]; prev[i + 1] = pos[i + 1]; prev[i + 2] = pos[i + 2];
          continue;
        }
        const vx = (pos[i] - prev[i]) * damp, vy = (pos[i + 1] - prev[i + 1]) * damp, vz = (pos[i + 2] - prev[i + 2]) * damp;
        prev[i] = pos[i]; prev[i + 1] = pos[i + 1]; prev[i + 2] = pos[i + 2];
        pos[i] += vx + f[i] * im;
        pos[i + 1] += vy + g + f[i + 1] * im;
        pos[i + 2] += vz + f[i + 2] * im;
      }
      for (let it = 0; it < this.iters; it++) this._solve();
      if (this.hasTethers) this._tether();
      if (this.hasSprings) this._springs();
      if (this.useColliders) this._collide(env);
    }
    for (let k = 0; k < this.n; k++) {
      const i = k * 3;
      if (pin[k]) { this.pinFrom[i] = this.pinTo[i]; this.pinFrom[i + 1] = this.pinTo[i + 1]; this.pinFrom[i + 2] = this.pinTo[i + 2]; continue; }
      const m = Math.abs(pos[i] - prev[i]) + Math.abs(pos[i + 1] - prev[i + 1]) + Math.abs(pos[i + 2] - prev[i + 2]);
      if (m > motion) motion = m;
    }
    this.motion = motion;
    if (this.canSleep && motion < 0.00025) { if (++this._calm > 50) this.sleeping = true; } else this._calm = 0;
  }

  _aero(h) {
    const f = this.force; f.fill(0);
    if (!this.drag) return;
    const pos = this.pos, prev = this.prev, T = this.tris;
    const wx = this.wind[0], wy = this.wind[1], wz = this.wind[2];
    const c = this.drag * 0.5 / 3, ih = 1 / (3 * h);
    for (let t = 0; t < T.length; t += 3) {
      const a = T[t] * 3, b = T[t + 1] * 3, d = T[t + 2] * 3;
      const e1x = pos[b] - pos[a], e1y = pos[b + 1] - pos[a + 1], e1z = pos[b + 2] - pos[a + 2];
      const e2x = pos[d] - pos[a], e2y = pos[d + 1] - pos[a + 1], e2z = pos[d + 2] - pos[a + 2];
      const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
      const nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (nl < 1e-12) continue;
      const vx = (pos[a] - prev[a] + pos[b] - prev[b] + pos[d] - prev[d]) * ih;
      const vy = (pos[a + 1] - prev[a + 1] + pos[b + 1] - prev[b + 1] + pos[d + 1] - prev[d + 1]) * ih;
      const vz = (pos[a + 2] - prev[a + 2] + pos[b + 2] - prev[b + 2] + pos[d + 2] - prev[d + 2]) * ih;
      const rx = wx - vx, ry = wy - vy, rz = wz - vz;
      const dot = (nx * rx + ny * ry + nz * rz) / nl;
      const s = c * dot;
      const fx = nx * s, fy = ny * s, fz = nz * s;
      f[a] += fx; f[a + 1] += fy; f[a + 2] += fz;
      f[b] += fx; f[b + 1] += fy; f[b + 2] += fz;
      f[d] += fx; f[d + 1] += fy; f[d + 2] += fz;
    }
  }

  _solve() {
    const pos = this.pos, pin = this.pin, A = this.cA, B = this.cB, R = this.cR, K = this.cK;
    for (let c = 0, m = A.length; c < m; c++) {
      const a = A[c], b = B[c];
      const wa = pin[a] ? 0 : 1, wb = pin[b] ? 0 : 1;
      const ws = wa + wb; if (!ws) continue;
      const ia = a * 3, ib = b * 3;
      const dx = pos[ib] - pos[ia], dy = pos[ib + 1] - pos[ia + 1], dz = pos[ib + 2] - pos[ia + 2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < 1e-9) continue;
      const s = (d - R[c]) / d * K[c] / ws;
      if (wa) { pos[ia] += dx * s; pos[ia + 1] += dy * s; pos[ia + 2] += dz * s; }
      if (wb) { pos[ib] -= dx * s; pos[ib + 1] -= dy * s; pos[ib + 2] -= dz * s; }
    }
  }

  _tether() {
    const pos = this.pos;
    for (let k = 0; k < this.n; k++) {
      const a = this.tAnchor[k]; if (a < 0 || this.pin[k]) continue;
      const i = k * 3, j = a * 3;
      const dx = pos[i] - pos[j], dy = pos[i + 1] - pos[j + 1], dz = pos[i + 2] - pos[j + 2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz), L = this.tLen[k];
      if (d > L) { const s = L / d; pos[i] = pos[j] + dx * s; pos[i + 1] = pos[j + 1] + dy * s; pos[i + 2] = pos[j + 2] + dz * s; }
    }
  }

  _springs() {
    const pos = this.pos, T = this.sT, K = this.sK;
    for (let k = 0; k < this.n; k++) {
      const s = K[k]; if (!s || this.pin[k]) continue;
      const i = k * 3;
      pos[i] += (T[i] - pos[i]) * s; pos[i + 1] += (T[i + 1] - pos[i + 1]) * s; pos[i + 2] += (T[i + 2] - pos[i + 2]) * s;
    }
  }

  _collide(env) {
    const pos = this.pos, prev = this.prev, th = 0.007, mu = this.friction;
    const boxes = env.boxes, sph = this.spheres, bk = env.basket;
    for (let k = 0; k < this.n; k++) {
      if (this.pin[k]) continue;
      const i = k * 3;
      let x = pos[i], y = pos[i + 1], z = pos[i + 2];
      let hit = false;
      if (y < th) { y = th; hit = true; }
      if (z < env.wallZ + th) { z = env.wallZ + th; hit = true; }
      for (let b = 0; b < boxes.length; b++) {
        const B = boxes[b];
        if (x > B[0] - th && x < B[3] + th && z > B[2] - th && z < B[5] + th && y < B[4] + th && y > B[1]) {
          const dTop = B[4] + th - y, d0 = x - (B[0] - th), d1 = B[3] + th - x, d2 = z - (B[2] - th), d3 = B[5] + th - z;
          const m = Math.min(dTop, d0, d1, d2, d3);
          if (m === dTop) y = B[4] + th; else if (m === d0) x = B[0] - th; else if (m === d1) x = B[3] + th; else if (m === d2) z = B[2] - th; else z = B[5] + th;
          hit = true;
        }
      }
      if (bk) {
        const dx = x - bk.x, dz = z - bk.z, r = Math.sqrt(dx * dx + dz * dz);
        if (y < bk.rimY && r > bk.rin && r < bk.rout + th) {
          const target = r < (bk.rin + bk.rout) * 0.5 ? bk.rin : bk.rout + th;
          x = bk.x + dx / r * target; z = bk.z + dz / r * target; hit = true;
        }
        if (y < bk.floorY && r < bk.rin) { y = bk.floorY; hit = true; }
      }
      for (let s = 0; s < sph.length; s++) {
        const S = sph[s];
        const dx = x - S[0], dy = y - S[1], dz = z - S[2];
        const d2 = dx * dx + dy * dy + dz * dz, r = S[3] + th;
        if (d2 < r * r) { const d = Math.sqrt(d2) || 1e-6, f = r / d; x = S[0] + dx * f; y = S[1] + dy * f; z = S[2] + dz * f; hit = true; }
      }
      if (hit) {
        pos[i] = x; pos[i + 1] = y; pos[i + 2] = z;
        prev[i] += (x - prev[i]) * mu; prev[i + 1] += (y - prev[i + 1]) * mu; prev[i + 2] += (z - prev[i + 2]) * mu;
      }
    }
  }

  updateGeometry() {
    const g = this.geometry;
    g.attributes.position.needsUpdate = true;
    g.computeVertexNormals();
    g.computeBoundingSphere();
  }
}
