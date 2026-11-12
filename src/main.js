import * as THREE from 'three';
import { buildRoom, L } from './room.js';
import { FX } from './fx.js';
import { Audio } from './audio.js';
import { UI } from './ui.js';
import { Game } from './game.js';

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 40);
const room = buildRoom(scene);

function ground(x, z) {
  const T = L.tub, M = L.bench, F = L.fold;
  if (Math.hypot(x - T.x, z - T.z) < T.r) return T.water;
  if (x > M.x0 && x < M.x1 && z > M.z0 && z < M.z1) return L.mat.top;
  if (x > F.x0 && x < F.x1 && z > F.z0 && z < F.z1) return F.top;
  return 0;
}

const fx = new FX(scene, camera, ground);
const audio = new Audio();
fx.onPop = () => audio.pop();
fx.onDrip = (f) => audio.drip(f > 0.9);
const ui = new UI();
const game = new Game({ scene, camera, renderer, room, fx, audio, ui });
window.__game = game;

audio.sfxOn = game.prefs.sfx; audio.musicOn = game.prefs.music;
const btnMusic = document.getElementById('btnMusic'), btnSound = document.getElementById('btnSound');
const syncBtns = () => { btnMusic.classList.toggle('off', !game.prefs.music); btnSound.classList.toggle('off', !game.prefs.sfx); };
syncBtns();
btnMusic.onclick = () => { game.prefs.music = !game.prefs.music; audio.setMusic(game.prefs.music); syncBtns(); game.save(); audio.click(); };
btnSound.onclick = () => { game.prefs.sfx = !game.prefs.sfx; audio.setSfx(game.prefs.sfx); syncBtns(); game.save(); };

function resize() {
  const w = window.innerWidth, h = window.innerHeight, a = w / h;
  renderer.setSize(w, h, false);
  renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px';
  camera.aspect = a;
  // keep the whole room wide enough on narrow windows
  const needH = Math.atan(3.9 / 6.8);
  const vf = 2 * Math.atan(Math.tan(needH) / a) * 180 / Math.PI;
  camera.fov = Math.max(34, Math.min(62, vf));
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize); resize();

const cv = renderer.domElement;
cv.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; cv.setPointerCapture?.(e.pointerId); game.pointer('down', e); });
cv.addEventListener('pointermove', (e) => game.pointer('move', e));
window.addEventListener('pointerup', (e) => game.pointer('up', e));
window.addEventListener('pointercancel', (e) => game.pointer('up', e));
cv.addEventListener('contextmenu', (e) => e.preventDefault());

document.getElementById('btnPlay').onclick = () => {
  audio.unlock(); audio.click();
  ui.title.classList.add('hidden');
  game.start();
};
document.addEventListener('pointerdown', () => audio.ctx && audio.ctx.state === 'suspended' && audio.ctx.resume(), { capture: true });

const clock = new THREE.Clock();
let acc = 0, t = 0;
const STEP = 1 / 60;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  t += dt; acc += dt;
  let n = 0;
  while (acc >= STEP && n < 3) { game.fixed(STEP); acc -= STEP; n++; }
  if (n === 3) acc = 0;
  game.update(dt);
  room.update(Math.min(dt, 1 / 30), t);
  fx.update(dt);
  renderer.render(scene, camera);
}
frame();
