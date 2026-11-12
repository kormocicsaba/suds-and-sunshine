import * as THREE from 'three';

let _grad = null;
// Soft 4-band toon ramp: readable bands with smooth edges.
export function gradientMap() {
  if (_grad) return _grad;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 1;
  const g = c.getContext('2d');
  const img = g.createImageData(256, 1);
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let x = 0; x < 256; x++) {
    const t = x / 255;
    const v = 0.36 + 0.28 * ss(0.30, 0.42, t) + 0.22 * ss(0.54, 0.62, t) + 0.14 * ss(0.76, 0.84, t);
    const b = Math.round(v * 255);
    img.data[x * 4] = b; img.data[x * 4 + 1] = b; img.data[x * 4 + 2] = b; img.data[x * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  _grad = new THREE.CanvasTexture(c);
  _grad.minFilter = _grad.magFilter = THREE.LinearFilter;
  _grad.generateMipmaps = false;
  return _grad;
}

// Toon material with a fresnel rim light and optional darker back faces (for cloth).
export function toon(color, o = {}) {
  const params = { color, gradientMap: gradientMap() };
  for (const k of ['map', 'side', 'transparent', 'opacity', 'alphaTest', 'emissive', 'depthWrite', 'vertexColors']) if (o[k] !== undefined) params[k] = o[k];
  const m = new THREE.MeshToonMaterial(params);
  const rim = { value: o.rim ?? 0.4 };
  const rimColor = { value: new THREE.Color(o.rimColor ?? 0xfff1d8) };
  const back = o.backDarken ?? 1.0;
  m.userData.rim = rim;
  m.onBeforeCompile = (s) => {
    s.uniforms.uRim = rim;
    s.uniforms.uRimColor = rimColor;
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uRim;\nuniform vec3 uRimColor;')
      .replace('#include <opaque_fragment>', `
        {
          float rf = 1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0);
          outgoingLight += uRimColor * pow(rf, 2.4) * uRim * (0.35 + 0.65 * diffuseColor.rgb);
        }
        #include <opaque_fragment>`);
    if (back < 1) {
      s.fragmentShader = s.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>\n if (!gl_FrontFacing) diffuseColor.rgb *= ${back.toFixed(3)};`);
    }
  };
  m.customProgramCacheKey = () => 'toonrim_' + back;
  return m;
}

export function canvasTex(w, h, draw, { repeat = null, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

export function rand(a = 0, b = 1) { return a + Math.random() * (b - a); }
export function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
export const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
export const easeInOut = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
