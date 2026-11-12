import * as THREE from 'three';
import { toon, canvasTex, rand } from './materials.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _v = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _c = new THREE.Color();

class Pool {
  constructor(scene, geo, mat, max, color = false) {
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    if (color) this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3).fill(1), 3);
    this.max = max; this.items = []; this.mesh.count = 0;
    scene.add(this.mesh);
  }
  spawn(o) { if (this.items.length >= this.max) this.items.shift(); this.items.push(o); return o; }
  flush(write) {
    let n = 0;
    for (const it of this.items) { write(it, n); n++; }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

const bubbleMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { uTime: { value: 0 } },
  vertexShader: `
    varying vec3 vN; varying vec3 vV; varying float vSeed;
    void main(){
      vec4 wp = modelMatrix * instanceMatrix * vec4(position,1.0);
      vec4 mv = viewMatrix * wp;
      vN = normalize(mat3(viewMatrix) * mat3(modelMatrix) * mat3(instanceMatrix) * normal);
      vV = normalize(-mv.xyz);
      vSeed = instanceMatrix[3].x * 7.0 + instanceMatrix[3].z * 3.0;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    uniform float uTime; varying vec3 vN; varying vec3 vV; varying float vSeed;
    void main(){
      vec3 n = normalize(vN);
      float f = 1.0 - abs(dot(n, vV));
      vec3 iri = 0.6 + 0.4 * cos(6.2831 * (f * 1.3 + uTime * 0.15 + vSeed + vec3(0.0, 0.33, 0.67)));
      float a = 0.06 + 0.8 * pow(f, 2.2);
      float spec = smoothstep(0.9, 0.97, dot(n, normalize(vec3(-0.45, 0.6, 0.66))));
      float spec2 = smoothstep(0.95, 0.99, dot(n, normalize(vec3(0.5, -0.4, 0.75)))) * 0.5;
      vec3 col = mix(iri, vec3(1.0), 0.25) ;
      gl_FragColor = vec4(col + spec + spec2, max(a, spec + spec2));
    }`,
});

export class FX {
  constructor(scene, camera, ground) {
    this.scene = scene; this.camera = camera; this.ground = ground;
    this.onPop = null; this.onDrip = null; this.time = 0;
    this.bubbles = new Pool(scene, new THREE.SphereGeometry(1, 16, 12), bubbleMat, 400);
    this.drops = new Pool(scene, new THREE.SphereGeometry(1, 8, 6), toon(0x7cc7f0, { rim: 0.8, rimColor: 0xffffff }), 500);
    const starTex = canvasTex(64, 64, (g) => {
      const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,255,255,.5)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(32, 0); g.quadraticCurveTo(35, 29, 64, 32); g.quadraticCurveTo(35, 35, 32, 64); g.quadraticCurveTo(29, 35, 0, 32); g.quadraticCurveTo(29, 29, 32, 0); g.fill();
    }, { srgb: false });
    this.sparks = new Pool(scene, new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: starTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), 300, true);
    this.confetti = new Pool(scene, new THREE.PlaneGeometry(0.035, 0.02), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), 400, true);
    const ringGeo = new THREE.RingGeometry(0.82, 1, 28); ringGeo.rotateX(-Math.PI / 2);
    this.rings = new Pool(scene, ringGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), 80, true);
    this.splatCount = 0;
  }

  bubble(x, y, z, r = rand(0.01, 0.03), vel = null) {
    this.bubbles.spawn({ x, y, z, vx: vel ? vel[0] : rand(-0.08, 0.08), vy: vel ? vel[1] : rand(0.08, 0.25), vz: vel ? vel[2] : rand(-0.08, 0.08), r, age: 0, life: rand(0.8, 2.2), ph: rand(0, 6) });
  }
  drop(x, y, z, vx = 0, vy = 0, vz = 0, r = rand(0.008, 0.014), splash = true) {
    this.drops.spawn({ x, y, z, vx, vy, vz, r, splash, floor: this.ground(x, z) });
  }
  spark(x, y, z, s = rand(0.05, 0.12), color = 0xfff2b0, life = rand(0.4, 0.8), vel = [0, 0, 0]) {
    _c.set(color);
    this.sparks.spawn({ x, y, z, s, age: 0, life, r: _c.r, g: _c.g, b: _c.b, vx: vel[0], vy: vel[1], vz: vel[2], rot: rand(0, 3) });
  }
  sparkleBurst(x, y, z, n = 12, spread = 0.3, color = 0xfff2b0) {
    for (let i = 0; i < n; i++) this.spark(x + rand(-spread, spread), y + rand(-spread, spread) * 0.6, z + rand(-spread, spread) * 0.5, rand(0.05, 0.14), color, rand(0.4, 0.9), [rand(-0.3, 0.3), rand(0.1, 0.6), rand(-0.3, 0.3)]);
  }
  ring(x, y, z, r0 = 0.02, r1 = 0.12, life = 0.6, color = 0xbfe8ff) {
    _c.set(color);
    this.rings.spawn({ x, y, z, r0, r1, age: 0, life, cr: _c.r, cg: _c.g, cb: _c.b });
  }
  confettiBurst(x, y, z, n = 120, power = 3) {
    const cols = [0xff7a59, 0xffc93c, 0x3cc8a0, 0x5aa8ff, 0xff8fb1, 0xb59bff];
    for (let i = 0; i < n; i++) {
      const a = rand(0, 6.283), up = rand(0.6, 1);
      _c.set(cols[i % cols.length]);
      this.confetti.spawn({ x, y, z, vx: Math.cos(a) * rand(0.3, 1) * power * 0.45, vy: up * power, vz: Math.sin(a) * rand(0.3, 1) * power * 0.35, rx: rand(0, 6), ry: rand(0, 6), wr: rand(4, 12), age: 0, life: rand(2.5, 4), r: _c.r, g: _c.g, b: _c.b, ph: rand(0, 6) });
    }
  }

  update(dt) {
    this.time += dt;
    bubbleMat.uniforms.uTime.value = this.time;
    const cam = this.camera;
    // bubbles
    const B = this.bubbles.items;
    for (let i = B.length - 1; i >= 0; i--) {
      const b = B[i]; b.age += dt;
      b.vy += dt * 0.05; b.vx *= 0.98; b.vz *= 0.98;
      b.x += (b.vx + Math.sin(b.age * 5 + b.ph) * 0.04) * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      if (b.age > b.life) {
        B.splice(i, 1);
        for (let k = 0; k < 3; k++) this.spark(b.x, b.y, b.z, b.r * 2.5, 0xffffff, 0.18, [rand(-0.4, 0.4), rand(-0.4, 0.4), rand(-0.4, 0.4)]);
        this.onPop?.(b.r);
      }
    }
    this.bubbles.flush((b, n) => {
      const g = Math.min(1, b.age * 8) * (1 + 0.06 * Math.sin(b.age * 12 + b.ph));
      _s.set(b.r * g, b.r * g * (1 + 0.08 * Math.sin(b.age * 9)), b.r * g);
      _m.compose(_p.set(b.x, b.y, b.z), _q.identity(), _s); this.bubbles.mesh.setMatrixAt(n, _m);
    });
    // drops
    const D = this.drops.items;
    for (let i = D.length - 1; i >= 0; i--) {
      const d = D[i];
      d.vy -= 9.8 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      if (d.y < d.floor) {
        D.splice(i, 1);
        if (d.splash) {
          this.ring(d.x, d.floor + 0.003, d.z, 0.01, d.floor > 1 ? 0.09 : 0.05, 0.5);
          for (let k = 0; k < 2; k++) this.drop(d.x, d.floor + 0.01, d.z, rand(-0.4, 0.4), rand(0.6, 1.2), rand(-0.4, 0.4), d.r * 0.45, false);
          this.onDrip?.(d.floor);
        }
      }
    }
    this.drops.flush((d, n) => {
      _v.set(d.vx, d.vy, d.vz); const sp = _v.length();
      if (sp > 1e-4) _q.setFromUnitVectors(_up, _v.multiplyScalar(1 / sp)); else _q.identity();
      _s.set(d.r, d.r * (1 + sp * 0.35), d.r);
      _m.compose(_p.set(d.x, d.y, d.z), _q, _s); this.drops.mesh.setMatrixAt(n, _m);
    });
    // sparks (billboards)
    const S = this.sparks.items;
    for (let i = S.length - 1; i >= 0; i--) { const s = S[i]; s.age += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.vx *= 0.95; s.vy *= 0.95; s.vz *= 0.95; if (s.age > s.life) S.splice(i, 1); }
    this.sparks.flush((s, n) => {
      const t = s.age / s.life, k = Math.sin(Math.PI * Math.min(1, t)) * s.s;
      _q.copy(cam.quaternion); _q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), s.rot + t * 2));
      _m.compose(_p.set(s.x, s.y, s.z), _q, _s.set(k, k, k)); this.sparks.mesh.setMatrixAt(n, _m);
      _c.setRGB(s.r, s.g, s.b); this.sparks.mesh.setColorAt(n, _c);
    });
    // confetti
    const C = this.confetti.items;
    for (let i = C.length - 1; i >= 0; i--) {
      const c = C[i]; c.age += dt;
      c.vy -= 4.5 * dt; const drag = Math.exp(-2.2 * dt); c.vx *= drag; c.vy *= drag; c.vz *= drag;
      c.x += (c.vx + Math.sin(c.age * 6 + c.ph) * 0.25) * dt; c.y += c.vy * dt; c.z += c.vz * dt;
      c.rx += c.wr * dt; c.ry += c.wr * 0.7 * dt;
      if (c.y < 0.01) { c.y = 0.01; c.vy = 0; c.vx *= 0.8; c.vz *= 0.8; c.wr *= 0.9; }
      if (c.age > c.life) C.splice(i, 1);
    }
    this.confetti.flush((c, n) => {
      const k = Math.min(1, (c.life - c.age) * 2);
      _q.setFromEuler(new THREE.Euler(c.rx, c.ry, 0));
      _m.compose(_p.set(c.x, c.y, c.z), _q, _s.set(k, k, k)); this.confetti.mesh.setMatrixAt(n, _m);
      _c.setRGB(c.r, c.g, c.b); this.confetti.mesh.setColorAt(n, _c);
    });
    // rings
    const R = this.rings.items;
    for (let i = R.length - 1; i >= 0; i--) { const r = R[i]; r.age += dt; if (r.age > r.life) R.splice(i, 1); }
    this.rings.flush((r, n) => {
      const t = r.age / r.life, rr = r.r0 + (r.r1 - r.r0) * (1 - (1 - t) * (1 - t));
      _m.compose(_p.set(r.x, r.y, r.z), _q.identity(), _s.set(rr, 1, rr)); this.rings.mesh.setMatrixAt(n, _m);
      const f = (1 - t) * 0.8; _c.setRGB(r.cr * f, r.cg * f, r.cb * f); this.rings.mesh.setColorAt(n, _c);
    });
  }
}
