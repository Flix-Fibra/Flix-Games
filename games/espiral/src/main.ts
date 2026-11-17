import { DEFAULT_AVATAR, composePortrait, primaryColor, type AvatarConfig, type Expression } from '@flix/avatar';
import { createHubBridge, type HubToGame } from '@flix/game-sdk';
import game_json from '../game.json';
import { setMuted, sfx, unlockAudio } from './audio';
import { CHARGE_MAX, FEVER_STREAK, FLOORS_PER_PHASE, ROCKET_FLOORS, Tower, newBall, phaseOf, speedOf, step, type BallState } from './logic';
import { loadBest, saveBest } from './storage';
import { paletteFor } from './theme';
import { World } from './world';

const INIT_TIMEOUT_MS = 1500;
const STEP = 1 / 120; // passo fixo da física
const DRAG_TURNS_PER_WIDTH = 1.1; // arrastar a largura da tela gira 1,1 volta

const bridge = createHubBridge({
  gameId: game_json.id,
  sdkVersion: game_json.sdkVersion,
  avatarTier: game_json.avatarTier as 'A' | 'B',
  avatarViews: game_json.avatarViews as Array<'portrait'>,
});

// ---------- Painel (HTML por cima do canvas) ----------
const hud = document.getElementById('hud')!;
hud.innerHTML = `
  <div class="top">
    <div class="portrait"></div>
    <div class="score"><b data-score>0</b><small>andares</small></div>
    <div class="best">Recorde<br /><b data-best>0</b></div>
  </div>
  <div class="phase"><span data-phase-name></span><div class="bar"><i data-bar></i></div><span class="shield" data-shield>Escudo</span></div>
  <div class="rocket" data-rocket-box><span>Foguete</span><div class="bar"><i data-rocket></i></div></div>
  <div class="toast" data-toast></div>
  <div class="overlay on" data-menu>
    <h1>Torre de Sinal</h1>
    <p>Arraste para girar a torre.<br />Passe pelos vãos e fuja da <span class="hot">alta tensão</span>.</p>
    <p class="muted">3 andares seguidos sem quicar quebram o próximo.<br />O <span class="sig">sinal</span> dá um escudo.</p>
    <button data-start>Toque para começar</button>
  </div>
  <div class="overlay" data-over>
    <h2>Sinal perdido!</h2>
    <p class="big"><b data-final>0</b> andares</p>
    <p class="muted" data-final-best></p>
    <button data-again>Jogar de novo</button>
  </div>`;
const q = <T extends HTMLElement = HTMLElement>(sel: string) => hud.querySelector<T>(sel)!;
const el = {
  portrait: q('.portrait'),
  score: q('[data-score]'),
  best: q('[data-best]'),
  phaseName: q('[data-phase-name]'),
  bar: q('[data-bar]'),
  shield: q('[data-shield]'),
  rocket: q('[data-rocket]'),
  rocketBox: q('[data-rocket-box]'),
  toast: q('[data-toast]'),
  menu: q('[data-menu]'),
  over: q('[data-over]'),
  final: q('[data-final]'),
  finalBest: q('[data-final-best]'),
  again: q<HTMLButtonElement>('[data-again]'),
  start: q<HTMLButtonElement>('[data-start]'),
};

// ---------- Estado ----------
type Mode = 'loading' | 'menu' | 'play' | 'over';
let mode: Mode = 'loading';
let paused = false;
let avatar: AvatarConfig = DEFAULT_AVATAR;
const portraits = new Map<Expression, HTMLCanvasElement>();
let portraitTimer = 0;

const world = new World(document.getElementById('game')!);
let tower = new Tower(1);
let ball: BallState = newBall();
let rotation = 0;
let nextFloor = 0;
let score = 0;
let phase = 0;
let runId = '';
let startedAt = 0;
let best = loadBest();
let acc = 0;
let toastTimer = 0;

function setPortrait(expr: Expression, holdSeconds = 0): void {
  const c = portraits.get(expr);
  if (!c) return;
  el.portrait.replaceChildren(c);
  portraitTimer = holdSeconds;
}

function applyAvatar(a: AvatarConfig): void {
  avatar = a;
  portraits.clear();
  for (const e of ['neutral', 'happy', 'sad'] as Expression[]) portraits.set(e, composePortrait(avatar, e));
  setPortrait('neutral');
  world.setBallColor(primaryColor(avatar));
}

function showToast(text: string): void {
  el.toast.textContent = text;
  el.toast.classList.add('on');
  toastTimer = 1.6;
}

function updateHud(): void {
  el.score.textContent = String(score);
  el.best.textContent = String(best);
  el.phaseName.textContent = paletteFor(phase).name;
  el.bar.style.width = `${((score % FLOORS_PER_PHASE) / FLOORS_PER_PHASE) * 100}%`;
  el.shield.classList.toggle('on', ball.shield);
  // Barra do foguete: enche com os andares; durante o foguete, mostra quanto falta.
  const rocketing = ball.rocket > 0 || ball.safeLanding;
  el.rocket.style.width = `${(rocketing ? ball.rocket / ROCKET_FLOORS : ball.charge / CHARGE_MAX) * 100}%`;
  el.rocketBox.classList.toggle('on', rocketing);
}

function newRun(): void {
  tower = new Tower((Math.random() * 2 ** 31) | 0);
  ball = newBall();
  rotation = 0;
  nextFloor = 0;
  score = 0;
  phase = 0;
  acc = 0;
  world.reset(ball.y);
  world.sync(tower, nextFloor);
  world.setRotation(rotation);
  runId = bridge.newRunId();
  startedAt = performance.now();
  mode = 'play';
  el.menu.classList.remove('on');
  el.over.classList.remove('on');
  setPortrait('neutral');
  updateHud();
  bridge.sendStarted(runId);
}

function gameOver(cause: string): void {
  mode = 'over';
  sfx('shock');
  setPortrait('sad');
  best = saveBest(score);
  bridge.sendGameOver({
    runId,
    score,
    durationMs: performance.now() - startedAt,
    meta: { floors: score, phase: phase + 1, cause },
  });
  el.final.textContent = String(score);
  el.finalBest.textContent = score >= best && score > 0 ? 'Novo recorde!' : `Recorde: ${best}`;
  // Dentro do hub, o botão de recomeçar é do hub (mensagem `restart`).
  el.again.hidden = bridge.embedded;
  window.setTimeout(() => {
    if (mode === 'over') el.over.classList.add('on');
  }, 700);
  updateHud();
}

// ---------- Simulação ----------
function simulate(dt: number): void {
  acc += dt * speedOf(phase);
  while (acc >= STEP && mode === 'play') {
    acc -= STEP;
    const r = step(ball, tower, rotation, nextFloor, STEP);
    nextFloor = r.nextFloor;
    for (const e of r.events) {
      switch (e.type) {
        case 'pass':
          score++;
          world.onBreak(e.floor); // no boost, o 'break' já desfez; aqui não faz nada
          sfx('pass', ball.streak);
          if (phaseOf(score) !== phase) {
            phase = phaseOf(score);
            world.setPhase(phase);
            sfx('phase');
            showToast(`Marco ${phase}: ${paletteFor(phase).name}`);
            setPortrait('happy', 1.6);
          }
          break;
        case 'bounce':
          sfx('bounce');
          world.onBounce(e.floor, rotation);
          break;
        case 'break':
          sfx('break');
          world.onBreak(e.floor);
          break;
        case 'shield-got':
          sfx('shield');
          world.onBonusTaken(e.floor, e.seg);
          break;
        case 'rocket-start':
          world.setRocket(true);
          sfx('rocket');
          showToast('Foguete!');
          break;
        case 'rocket-end':
          world.setRocket(false);
          break;
        case 'shield-used':
          world.onShock(false);
          sfx('shieldUsed');
          showToast('Escudo usado!');
          break;
        case 'dead':
          world.setRocket(false);
          world.onShock(true);
          gameOver(e.cause);
          break;
      }
    }
  }
  tower.forgetAbove(nextFloor - 4);
  world.sync(tower, nextFloor);
}

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000); // trava para não "pular" depois de aba em segundo plano
  last = now;
  if (!paused) {
    if (mode === 'play') simulate(dt);
    world.setRotation(rotation);
    world.setBall(ball.y, mode === 'play' && ball.streak >= FEVER_STREAK, ball.shield, mode === 'play' && ball.streak > 0);
    world.update(dt, ball.y);
    if (mode === 'play') updateHud();
    if (toastTimer > 0 && (toastTimer -= dt) <= 0) el.toast.classList.remove('on');
    if (portraitTimer > 0 && (portraitTimer -= dt) <= 0 && mode === 'play') setPortrait('neutral');
  }
  world.render();
  requestAnimationFrame(frame);
}

// ---------- Controles ----------
const canvas = world.renderer.domElement;
let dragX: number | null = null;
canvas.addEventListener('pointerdown', (e) => {
  unlockAudio();
  dragX = e.clientX;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (dragX === null || mode !== 'play' || paused) return;
  rotation += ((e.clientX - dragX) / canvas.clientWidth) * Math.PI * 2 * DRAG_TURNS_PER_WIDTH;
  dragX = e.clientX;
});
const endDrag = () => (dragX = null);
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

// Teclado (para testar no computador).
const keys = new Set<string>();
window.addEventListener('keydown', (e) => keys.add(e.key));
window.addEventListener('keyup', (e) => keys.delete(e.key));
setInterval(() => {
  if (mode !== 'play' || paused) return;
  if (keys.has('ArrowLeft')) rotation -= 0.07;
  if (keys.has('ArrowRight')) rotation += 0.07;
}, 1000 / 60);

el.start.addEventListener('click', () => {
  unlockAudio();
  if (mode === 'menu') newRun();
});
el.again.addEventListener('click', () => {
  unlockAudio();
  if (mode === 'over') newRun();
});

window.addEventListener('resize', () => world.resize());
window.addEventListener('contextmenu', (e) => e.preventDefault());

// ---------- Hub ----------
let initDone = false;
function finishInit(a: AvatarConfig, muted: boolean): void {
  if (initDone) return;
  initDone = true;
  setMuted(muted);
  applyAvatar(a);
  mode = 'menu';
  updateHud();
}

bridge.onHubMessage((msg: HubToGame) => {
  switch (msg.type) {
    case 'init':
      if (initDone) {
        applyAvatar(msg.avatar);
        setMuted(msg.muted);
      } else finishInit(msg.avatar, msg.muted);
      break;
    case 'mute':
      setMuted(msg.muted);
      break;
    case 'pause':
      paused = true;
      break;
    case 'resume':
      paused = false;
      last = performance.now();
      break;
    case 'restart':
      if (mode === 'over' || mode === 'menu') newRun();
      break;
  }
});
bridge.sendReady();
window.setTimeout(() => finishInit(DEFAULT_AVATAR, false), INIT_TIMEOUT_MS);

world.reset(ball.y);
world.sync(tower, 0);
requestAnimationFrame(frame);

if (new URLSearchParams(window.location.search).has('debug')) {
  Object.assign(window, { __espiral: { world, get state() { return { mode, score, phase, rotation, ball, nextFloor }; } } });
}
