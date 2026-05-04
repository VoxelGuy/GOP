import * as THREE from 'https://unpkg.com/three@0.164.1/build/three.module.js';
import * as CANNON from 'https://unpkg.com/cannon-es@0.20.0/dist/cannon-es.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10131a);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 7, 10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.getElementById('app').prepend(renderer.domElement);

const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.5, 0) });
world.solver.iterations = 12;
world.defaultContactMaterial.friction = 0.48;
world.defaultContactMaterial.restitution = 0.06;

const light = new THREE.DirectionalLight(0xffffff, 1.2); light.position.set(6, 10, 4);
scene.add(light, new THREE.AmbientLight(0xffffff, .45));

const groundMat = new THREE.MeshStandardMaterial({ color: 0x263447 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), groundMat);
ground.rotation.x = -Math.PI / 2; scene.add(ground);
const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
groundBody.quaternion.setFromEuler(-Math.PI/2, 0, 0); world.addBody(groundBody);

const state = { phase: 'idle', targetPos: 0, targetVel: 0.02, targetLock: null, powerLock: null, turn: 'player', playerScore: 0, enemyScore: 0 };
const playerPogs = [], enemyPogs = [], stackPogs = [];
const pogBackColor = new THREE.Color('#2f2f35');
const faceColors = Array.from({length:20}, (_,i)=> new THREE.Color().setHSL(i/20,0.8,0.55));

function createPog(color, z){
  const group = new THREE.Group();
  const geo = new THREE.CylinderGeometry(0.55,0.55,0.08,36);
  const bodyMat = new THREE.MeshStandardMaterial({ color: pogBackColor });
  const ring = new THREE.Mesh(geo, bodyMat);
  const top = new THREE.Mesh(new THREE.CircleGeometry(0.52, 32), new THREE.MeshStandardMaterial({color}));
  top.rotation.x = -Math.PI/2; top.position.y = 0.041;
  group.add(ring, top);

  const body = new CANNON.Body({ mass: .1, shape: new CANNON.Cylinder(.55,.55,.08,24), material: new CANNON.Material('pog') });
  body.position.set(0, .2, z);
  body.angularDamping = .28;
  body.linearDamping = .18;
  body.allowSleep = true;
  body.sleepSpeedLimit = 0.12;
  body.sleepTimeLimit = 0.35;

  scene.add(group); world.addBody(body);
  return { mesh: group, body, captured: null };
}

for (let i=0;i<10;i++) {
  const p = createPog(faceColors[i], 5.5 + i*0.05); p.body.type = CANNON.Body.STATIC; p.body.updateMassProperties(); p.body.position.set(-4 + i*0.85, .2, 6.8); playerPogs.push(p);
  const e = createPog(faceColors[i+10], -5.5 - i*0.05); e.body.type = CANNON.Body.STATIC; e.body.updateMassProperties(); e.body.position.set(-4 + i*0.85, .2, -6.8); enemyPogs.push(e);
}

function refreshStrips(){
  const pWrap = document.getElementById('playerPogs'); pWrap.innerHTML='';
  const eWrap = document.getElementById('enemyPogs'); eWrap.innerHTML='';
  playerPogs.forEach((p)=>{ const d=document.createElement('div'); d.className='pog-chip'; d.style.background=p.mesh.children[1].material.color.getStyle(); pWrap.append(d);});
  enemyPogs.forEach((p)=>{ const d=document.createElement('div'); d.className='pog-chip'; d.style.background=p.mesh.children[1].material.color.getStyle(); eWrap.append(d);});
}
refreshStrips();

function animateToStack(t){
  const all=[...playerPogs,...enemyPogs];
  all.forEach((p,i)=>{
    p.body.type=CANNON.Body.DYNAMIC; p.body.updateMassProperties();
    setTimeout(()=>{ p.body.position.set((Math.random()-.5)*.2, .8 + i*0.13, (Math.random()-.5)*.2); p.body.velocity.set(0,0,0); }, i*45);
    stackPogs.push(p);
  });
  let start = performance.now();
  function camStep(now){
    const a=Math.min((now-start)/1300,1);
    camera.position.lerpVectors(new THREE.Vector3(0,7,10), new THREE.Vector3(4.8,4.6,4.8), a);
    camera.lookAt(0,1.3,0);
    if (a<1) requestAnimationFrame(camStep); else t();
  }
  requestAnimationFrame(camStep);
}

function startMiniGame(){
  state.phase='target';
  document.getElementById('minigame').style.display='block';
  document.getElementById('message').textContent=`${state.turn === 'player' ? 'Votre tour: Espace pour verrouiller la cible' : 'Tour adversaire (IA): calcul en cours...'}`;
  buildPowerTrack();
}

function buildPowerTrack(){
  const track = document.getElementById('powerTrack'); track.innerHTML='';
  for(let i=0;i<50;i++){
    const seg=document.createElement('div');
    seg.style.position='absolute'; seg.style.left=`${i*2}%`; seg.style.width='2%'; seg.style.top='0'; seg.style.bottom='0';
    const green = Math.random();
    seg.style.background=`rgb(${Math.floor(220*(1-green))}, ${Math.floor(220*green)}, 70)`;
    track.append(seg);
  }
  const n=document.createElement('div'); n.id='powerNeedle'; track.append(n);
}

function launchKini(){
  state.phase='launch';
  document.getElementById('message').textContent = 'Lancement du Kini...';
  const kiniGeo = new THREE.CylinderGeometry(0.62,0.62,0.24,36);
  const kini = new THREE.Mesh(kiniGeo, new THREE.MeshStandardMaterial({ color: 0xe8eaf2, metalness:.2, roughness:.4 }));
  scene.add(kini);
  const body = new CANNON.Body({ mass: .55, shape: new CANNON.Cylinder(.62,.62,.24,24) });
  const x = (state.targetLock - 0.5) * 2.2;
  body.position.set(x, 5, 5.2);
  body.velocity.set(0, -7 - state.powerLock * 8, -17 - state.powerLock * 8);
  body.angularVelocity.set(20,0,0);
  world.addBody(body);

  let elapsed = 0;
  const check = setInterval(()=>{
    elapsed += 100;
    kini.position.copy(body.position); kini.quaternion.copy(body.quaternion);
    if (elapsed > 3500) {
      clearInterval(check);
      world.removeBody(body); scene.remove(kini);
      scoreTurn();
    }
  }, 16);
}

function scoreTurn(){
  let gained = 0;
  for (const p of stackPogs) {
    if (p.captured) continue;
    const up = new THREE.Vector3(0,1,0).applyQuaternion(p.mesh.quaternion);
    const flipped = up.y < 0;
    if (flipped) { p.captured = state.turn; gained++; }
  }
  if (state.turn === 'player') state.playerScore += gained; else state.enemyScore += gained;
  document.getElementById('playerScore').textContent = state.playerScore;
  document.getElementById('enemyScore').textContent = state.enemyScore;
  const total = state.playerScore + state.enemyScore;
  if (total >= stackPogs.length) return endGame();
  state.turn = state.turn === 'player' ? 'enemy' : 'player';
  document.getElementById('message').textContent = `+${gained} pog(s). Reformation de la pile...`;
  restackRemaining(() => {
    startMiniGame();
    if (state.turn === 'enemy') setTimeout(()=>autoPlay(), 800);
  });
}

function autoPlay(){
  state.targetLock = Math.random(); state.powerLock=Math.random(); launchKini();
}

function endGame(){
  state.phase='done';
  document.getElementById('minigame').style.display='none';
  document.getElementById('scoreBoard').style.display='grid';
  document.getElementById('finalScore').textContent = `Vous: ${state.playerScore} | Adversaire: ${state.enemyScore}`;
}

function restackRemaining(done){
  const remaining = stackPogs.filter((p) => !p.captured);
  remaining
    .sort((a,b) => a.body.position.y - b.body.position.y)
    .forEach((p, i) => {
      p.body.velocity.setZero();
      p.body.angularVelocity.setZero();
      p.body.position.set((Math.random() - .5) * 0.06, 0.62 + i * 0.095, (Math.random() - .5) * 0.06);
      p.body.quaternion.setFromEuler(0, Math.random() * 0.08, 0);
      p.body.wakeUp();
    });
  setTimeout(done, 850);
}

document.getElementById('startBtn').onclick = () => {
  document.getElementById('centerPanel').style.display='none';
  document.getElementById('message').textContent='Mélange et empilage des 20 pogs...';
  animateToStack(() => {
    state.turn = Math.random() < .5 ? 'player' : 'enemy';
    document.getElementById('message').textContent = `Pile ou face: ${state.turn === 'player' ? 'Vous commencez' : "L'adversaire commence"}.`;
    setTimeout(startMiniGame, 900);
    if (state.turn === 'enemy') setTimeout(()=>autoPlay(), 2300);
  });
};

document.getElementById('restartBtn').onclick = () => location.reload();

addEventListener('keydown', (e)=>{
  if (e.code !== 'Space' || state.turn !== 'player') return;
  if (state.phase === 'target') { state.targetLock = state.targetPos; state.phase='power'; document.getElementById('message').textContent='Cible verrouillée. Espace pour figer la puissance.'; }
  else if (state.phase === 'power') { state.powerLock = (Math.sin(performance.now()*0.014)+1)/2; launchKini(); }
});

function tick(){
  requestAnimationFrame(tick);
  world.step(1/60);

  for (const p of [...playerPogs,...enemyPogs]) { p.mesh.position.copy(p.body.position); p.mesh.quaternion.copy(p.body.quaternion); }

  if (state.phase === 'target' && state.turn === 'player') {
    state.targetPos += state.targetVel;
    if (state.targetPos > 1 || state.targetPos < 0) { state.targetVel *= -1; state.targetPos = Math.min(1, Math.max(0, state.targetPos)); }
  }
  const dot = document.getElementById('targetDot');
  dot.style.left = `calc(${(state.phase==='target'?state.targetPos:(state.targetLock ?? 0.5))*100}% - 10px)`;
  const needle = document.getElementById('powerNeedle');
  if (needle) {
    const p = state.phase==='power' ? (Math.sin(performance.now()*0.014)+1)/2 : (state.powerLock ?? 0);
    needle.style.left = `calc(${p*100}% - 3px)`;
  }

  renderer.render(scene, camera);
}
tick();

addEventListener('resize', ()=>{ camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
