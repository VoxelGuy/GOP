import * as THREE from 'https://unpkg.com/three@0.163.0/build/three.module.js';
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js';

const canvas = document.getElementById('game');
const startBtn = document.getElementById('startBtn');
const statusEl = document.getElementById('status');
const coinFlipEl = document.getElementById('coinFlip');
const powerWrap = document.getElementById('powerWrap');
const powerCursor = document.getElementById('powerCursor');
const playerScoreEl = document.getElementById('playerScore');
const enemyScoreEl = document.getElementById('enemyScore');
const endScreen = document.getElementById('endScreen');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10243d);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 7, 12);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

const light = new THREE.DirectionalLight(0xffffff, 1.1);
light.position.set(4, 8, 5);
scene.add(light, new THREE.AmbientLight(0xffffff, 0.4));

const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -18, 0) });
world.broadphase = new CANNON.SAPBroadphase(world);

const floorBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(floorBody);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 18), new THREE.MeshStandardMaterial({ color: 0x264653 }));
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const pogs = [];
let kini = null;
let turn = 'player';
let phase = 'idle';
let targetX = -2;
let targetDir = 1;
let powerT = 0;
let powerDir = 1;
let playerScore = 0;
let enemyScore = 0;

const target = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.07, 10, 20), new THREE.MeshBasicMaterial({ color: 0xfff200 }));
target.visible = false;
scene.add(target);

function makePog(faceColor, x, z) {
  const group = new THREE.Group();
  const r = 0.7;
  const h = 0.2;
  const side = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 32), new THREE.MeshStandardMaterial({ color: 0x657786 }));
  const face = new THREE.Mesh(new THREE.CircleGeometry(r * 0.96, 32), new THREE.MeshStandardMaterial({ color: faceColor }));
  const back = new THREE.Mesh(new THREE.CircleGeometry(r * 0.96, 32), new THREE.MeshStandardMaterial({ color: 0x2d3436 }));
  face.rotation.x = -Math.PI / 2;
  face.position.y = h / 2 + 0.001;
  back.rotation.x = Math.PI / 2;
  back.position.y = -h / 2 - 0.001;
  group.add(side, face, back);
  scene.add(group);

  const body = new CANNON.Body({ mass: 0.3, shape: new CANNON.Cylinder(r, r, h, 16), position: new CANNON.Vec3(x, h / 2, z) });
  body.quaternion.setFromEuler(Math.PI / 2, 0, 0);
  world.addBody(body);

  pogs.push({ mesh: group, body, owner: z > 0 ? 'player' : 'enemy', turned: false });
}

const colors = [0xe63946, 0xf4a261, 0xffc300, 0x4cc9f0, 0x80ed99, 0x9b5de5, 0xff006e, 0x06d6a0, 0xff7f50, 0xa8dadc];
for (let i = 0; i < 10; i++) {
  makePog(colors[i], -6 + i * 1.3, 5.8);
  makePog(colors[i], -6 + i * 1.3, -5.8);
}

function syncBodies() {
  for (const p of pogs) {
    p.mesh.position.copy(p.body.position);
    p.mesh.quaternion.copy(p.body.quaternion);
  }
  if (kini) {
    kini.mesh.position.copy(kini.body.position);
    kini.mesh.quaternion.copy(kini.body.quaternion);
  }
}

function stackPogs() {
  phase = 'stacking';
  statusEl.textContent = 'Empilement en cours...';
  const center = new CANNON.Vec3(0, 0.6, 0);
  pogs.forEach((p, i) => {
    p.body.position.set(center.x + (Math.random() - 0.5) * 0.2, center.y + i * 0.22, center.z + (Math.random() - 0.5) * 0.2);
    p.body.velocity.setZero();
    p.body.angularVelocity.setZero();
  });
  setTimeout(() => {
    camera.position.set(3.5, 6.5, 6.5);
    camera.lookAt(0, 2.2, 0);
    const toss = Math.random() < 0.5 ? 'player' : 'enemy';
    turn = toss;
    coinFlipEl.textContent = `Pile ou face: ${toss === 'player' ? 'Joueur commence' : 'Adversaire commence'}`;
    startMiniGame();
  }, 1400);
}

function startMiniGame() {
  phase = 'target';
  statusEl.textContent = `${turn === 'player' ? 'Ton tour' : 'Tour adversaire'}: espace pour stopper la cible.`;
  target.visible = true;
}

function launchKini(power, aim) {
  if (kini) {
    world.removeBody(kini.body);
    scene.remove(kini.mesh);
  }
  const r = 0.9, h = 0.42;
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 32), new THREE.MeshStandardMaterial({ color: 0xf1faee }));
  scene.add(mesh);
  const body = new CANNON.Body({ mass: 2.6, shape: new CANNON.Cylinder(r, r, h, 16), position: new CANNON.Vec3(aim, 1.8, turn === 'player' ? 6 : -6) });
  body.quaternion.setFromEuler(Math.PI / 2, 0, 0);
  const dir = turn === 'player' ? -1 : 1;
  body.velocity.set(0, 1.5 + power * 2, dir * (9 + power * 8));
  world.addBody(body);
  kini = { mesh, body };
  phase = 'resolve';
  statusEl.textContent = 'Impact du Kini...';
  setTimeout(resolveTurn, 2200);
}

function resolveTurn() {
  let gained = 0;
  for (const p of pogs) {
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(p.mesh.quaternion);
    const isTurned = up.y < 0;
    if (isTurned && !p.turned) {
      p.turned = true;
      gained++;
    }
  }
  if (turn === 'player') playerScore += gained;
  else enemyScore += gained;
  playerScoreEl.textContent = playerScore;
  enemyScoreEl.textContent = enemyScore;

  const allTurned = pogs.every((p) => p.turned);
  if (allTurned) {
    phase = 'done';
    endScreen.classList.remove('hidden');
    endScreen.innerHTML = `<h2>Partie terminée</h2><p>Joueur: ${playerScore}</p><p>Adversaire: ${enemyScore}</p>`;
    statusEl.textContent = 'Fin de partie';
    return;
  }
  turn = turn === 'player' ? 'enemy' : 'player';
  phase = 'target';
  target.visible = true;
  powerWrap.classList.add('hidden');
  statusEl.textContent = `${turn === 'player' ? 'Ton tour' : 'Tour adversaire'}: espace pour stopper la cible.`;
}

window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space') return;
  e.preventDefault();
  if (phase === 'target') {
    phase = 'power';
    powerWrap.classList.remove('hidden');
    statusEl.textContent = 'Espace pour verrouiller la puissance';
  } else if (phase === 'power') {
    powerWrap.classList.add('hidden');
    target.visible = false;
    launchKini(powerT, targetX);
  }
});

startBtn.addEventListener('click', () => {
  startBtn.style.display = 'none';
  stackPogs();
});

function animate() {
  requestAnimationFrame(animate);
  world.step(1 / 60);

  if (phase === 'target') {
    targetX += 0.08 * targetDir;
    if (targetX > 1.7 || targetX < -1.7) targetDir *= -1;
    target.position.set(targetX, 4.8, 0);
  }
  if (phase === 'power') {
    powerT += 0.02 * powerDir;
    if (powerT > 1 || powerT < 0) {
      powerDir *= -1;
      powerT = Math.max(0, Math.min(1, powerT));
    }
    powerCursor.style.left = `${powerT * 100}%`;
  }

  syncBodies();
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
