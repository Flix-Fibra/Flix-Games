import { DEFAULT_AVATAR, composePortrait, type AvatarConfig, type Expression } from '@flix/avatar';
import { createHubBridge, type HubToGame, type PersonagemImagens } from '@flix/game-sdk';
import { DICA_SOLTAR_MOUSE, soltarMouseSemEsc } from '@flix/game-kit/src/soltarMouse';
import game_json from '../game.json';
import { setMuted, sfx, unlockAudio } from './audio';
import {
  CHARGE_MAX, FEVER_STREAK, FLOOR_THICK, FLOORS_PER_PHASE, ROCKET_FLOORS, Tower, floorY, newBall, phaseOf, segmentUnderBall, speedOf, step,
  type BallState,
} from './logic';
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

// Fullscreen on phones: browsers only allow it after a user gesture, so it starts on the first touch (on desktop the hub has its own button).
// Inside the hub iframe it works because the iframe has allow="fullscreen"; if it fails (e.g. iPhone) the game just carries on.
if (window.matchMedia('(pointer: coarse)').matches) {
  const enterFullscreen = () => {
    window.removeEventListener('pointerup', enterFullscreen);
    try {
      if (document.fullscreenElement || !document.fullscreenEnabled) return;
      void document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
    } catch {
      /* not supported */
    }
  };
  window.addEventListener('pointerup', enterFullscreen);
}

// ---------- Painel (HTML por cima do canvas) ----------
const hud = document.getElementById('hud')!;
hud.innerHTML = `
  <div class="top">
    <div class="portrait"></div>
    <div class="score"><b data-score>0</b><small data-score-label>ANDARES</small></div>
    <div class="best"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M6 2h12v2h4v3a5 5 0 0 1-5 5h-.3A6 6 0 0 1 13 15.9V19h4v3H7v-3h4v-3.1A6 6 0 0 1 7.3 12H7a5 5 0 0 1-5-5V4h4V2Zm0 4H4v1a3 3 0 0 0 2 2.8V6Zm12 0v3.8A3 3 0 0 0 20 7V6h-2Z"/></svg><small data-best-label>RECORDE</small><b data-best>0</b></div>
  </div>
  <div class="stats">
    <div class="phase"><span data-phase-name></span><span class="shield" data-shield>Escudo</span><div class="bar"><i data-bar></i></div></div>
    <div class="rocket" data-rocket-box><span data-rocket-label>FOGUETE</span><div class="bar"><i data-rocket></i></div></div>
  </div>
  <div class="toast" data-toast></div>
  <div class="overlay on" data-menu>
    <h1 class="logo"><img src="./img/logo.png" alt="Signal Drop" width="512" height="512" /></h1>
    <p>Arraste para girar a torre.<br />Passe pelos vãos e fuja da <span class="hot">alta tensão</span>.</p>
    <p class="muted">3 andares seguidos sem quicar quebram o próximo,<br />e o pouso de impacto queima a alta tensão.<br />O <span class="sig">sinal</span> dá um escudo.</p>
    <p class="muted so-mouse">${DICA_SOLTAR_MOUSE}.</p>
    <button data-start>Toque para começar</button>
  </div>
  <div class="overlay fim" data-pausa>
    <div class="fim-titulo">PAUSADO</div>
    <div class="fim-linha">O mouse está livre.</div>
    <div class="fim-linha" style="opacity:.7">Na partida: ${DICA_SOLTAR_MOUSE.toLowerCase()}.</div>
    <button class="fim-botao" data-continuar>CONTINUAR</button>
  </div>
  <div class="overlay fim" data-over>
    <div class="fim-titulo">FIM DE JOGO</div>
    <div class="fim-pontos" data-final></div>
    <div class="fim-rotulo">ANDARES</div>
    <div class="fim-linha" data-final-best-box><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 2h12v2h4v3a5 5 0 0 1-5 5h-.3A6 6 0 0 1 13 15.9V19h4v3H7v-3h4v-3.1A6 6 0 0 1 7.3 12H7a5 5 0 0 1-5-5V4h4V2Zm0 4H4v1a3 3 0 0 0 2 2.8V6Zm12 0v3.8A3 3 0 0 0 20 7V6h-2Z"/></svg><span data-final-best></span></div>
    <button class="fim-botao" data-again>REINICIAR</button>
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
  pausa: q('[data-pausa]'),
  continuar: q<HTMLButtonElement>('[data-continuar]'),
  final: q('[data-final]'),
  finalBest: q('[data-final-best]'),
  finalBestBox: q('[data-final-best-box]'),
  again: q<HTMLButtonElement>('[data-again]'),
  start: q<HTMLButtonElement>('[data-start]'),
};

// ---------- Estado ----------
type Mode = 'loading' | 'menu' | 'play' | 'over';
let mode: Mode = 'loading';
let paused = false; // pausa pedida pelo hub
let pausaMouse = false; // computador: a pessoa soltou o mouse (Esc) no meio da partida
const parado = () => paused || pausaMouse;
let avatar: AvatarConfig = DEFAULT_AVATAR;
const portraits = new Map<Expression, HTMLCanvasElement>();
/** Retrato do personagem que o jogador criou no hub (SDK 0.2.0). Quando existe, é ele que aparece no canto. */
let retratoHub: HTMLImageElement | null = null;
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
  portraitTimer = holdSeconds;
  if (retratoHub) {
    // o retrato do hub não tem expressões: a reação aparece como um pulinho (feliz) ou tremida (triste)
    el.portrait.classList.remove('feliz', 'triste');
    if (expr !== 'neutral') {
      void el.portrait.offsetWidth;
      el.portrait.classList.add(expr === 'happy' ? 'feliz' : 'triste');
    }
    if (el.portrait.firstChild !== retratoHub) el.portrait.replaceChildren(retratoHub);
    return;
  }
  const c = portraits.get(expr);
  if (!c) return;
  el.portrait.replaceChildren(c);
}

/** Usa o personagem do hub; sem ele (jogador sem personagem ou fora do hub), cai no avatar antigo. */
function applyPersonagem(p: PersonagemImagens | null): void {
  if (!p) {
    retratoHub = null;
    return;
  }
  const img = new Image();
  img.alt = '';
  img.decoding = 'async';
  img.src = p.retrato;
  retratoHub = img;
}

function applyAvatar(a: AvatarConfig): void {
  avatar = a;
  portraits.clear();
  for (const e of ['neutral', 'happy', 'sad'] as Expression[]) portraits.set(e, composePortrait(avatar, e));
  setPortrait('neutral');
  // A bola tem cor fixa (vermelho vivo): precisa ser reconhecida num olhar, seja qual for o avatar.
}

function showToast(text: string): void {
  el.toast.textContent = text;
  el.toast.classList.add('on');
  toastTimer = 1.6;
}

function updateHud(): void {
  const rocketing = ball.rocket > 0 || ball.safeLanding;
  // placar com fonte lisa (estilo próprio do Signal Drop, igual à tela de fim)
  el.score.textContent = String(score);
  el.best.textContent = String(best);
  el.phaseName.textContent = paletteFor(phase).name.toUpperCase();
  el.bar.style.width = `${((score % FLOORS_PER_PHASE) / FLOORS_PER_PHASE) * 100}%`;
  world.setProgressoFase((score % FLOORS_PER_PHASE) / FLOORS_PER_PHASE);
  el.shield.classList.toggle('on', ball.shield);
  // Barra do foguete: enche com os andares; durante o foguete, mostra quanto falta.
  el.rocket.style.width = `${(rocketing ? ball.rocket / ROCKET_FLOORS : ball.charge / CHARGE_MAX) * 100}%`;
  el.rocketBox.classList.toggle('on', rocketing);
}

function newRun(): void {
  tower = new Tower((Math.random() * 2 ** 31) | 0);
  ball = newBall();
  rotation = 0;
  pausaMouse = false;
  el.pausa.classList.remove('on');
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
  soltarMouse(); // o cursor volta para clicar em REINICIAR
  sfx('shock');
  setPortrait('sad');
  best = saveBest(score);
  bridge.sendGameOver({
    runId,
    score,
    durationMs: performance.now() - startedAt,
    meta: { floors: score, phase: phase + 1, cause },
  });
  // Tela de fim no estilo próprio do Signal Drop (fonte lisa, igual ao placar)
  const recorde = score >= best && score > 0;
  el.final.textContent = String(score);
  el.finalBest.textContent = recorde ? 'NOVO RECORDE!' : `RECORDE: ${best}`;
  el.finalBestBox.classList.toggle('recorde', recorde);
  // O botão de recomeçar é sempre o do jogo (o hub não mostra outro).
  el.again.hidden = false;
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
        case 'impact':
          world.refazerAndar(tower, e.floor);
          world.onShock(false);
          sfx('break');
          showToast('Impacto! A alta tensão queimou');
          setPortrait('happy', 1.2);
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
  const real = (now - last) / 1000;
  const dt = Math.min(0.05, real); // trava para não "pular" depois de aba em segundo plano
  last = now;
  if (!parado()) world.medirQuadro(real); // aparelho fraco: baixa a resolução sozinho
  if (!parado()) {
    if (mode === 'play') simulate(dt);
    world.setRotation(rotation);
    world.setBall(ball.y, mode === 'play' && ball.streak >= FEVER_STREAK, ball.shield, mode === 'play' && ball.streak > 0);
    // Sombra da bola na placa logo abaixo (só se ali houver placa: no vão, não há onde projetar)
    const abaixo = tower.get(nextFloor);
    const temPlaca = !abaixo.broken && abaixo.segs[segmentUnderBall(rotation)] !== 'gap' && ball.rocket <= 0;
    world.setShadow(temPlaca ? floorY(nextFloor) + FLOOR_THICK : null, ball.y);
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
  if (e.pointerType === 'mouse') return; // mouse gira sem clicar (abaixo); arrastar é só para o toque
  if (dragX === null || mode !== 'play' || parado()) return;
  rotation += ((e.clientX - dragX) / canvas.clientWidth) * Math.PI * 2 * DRAG_TURNS_PER_WIDTH;
  dragX = e.clientX;
});
const endDrag = () => (dragX = null);
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

// Mouse (computador): durante a partida o cursor some e basta mover o mouse para girar a torre, sem clicar.
// Ao começar (clique no botão), o ponteiro é travado na página (Pointer Lock): o mouse nunca bate na borda da tela.
// Se a trava não vier (Esc, navegador sem suporte, recomeço pelo hub), mover o mouse continua girando.
const comMouse = window.matchMedia('(pointer: fine)').matches;
function travarMouse(): void {
  if (!comMouse) return;
  document.body.classList.add('jogando');
  const pedido = canvas.requestPointerLock?.() as unknown as Promise<void> | undefined;
  pedido?.catch?.(() => {}); // sem trava: segue com o cursor escondido
}
let soltandoPeloJogo = false; // o próprio jogo soltou (fim de jogo): não é pausa
function soltarMouse(): void {
  document.body.classList.remove('jogando');
  if (document.pointerLockElement) {
    soltandoPeloJogo = true;
    document.exitPointerLock();
  }
}
// Liberar o mouse: Esc (o navegador solta a trava) pausa a partida e mostra o cursor; "Continuar" volta a prender.
function pausarPeloMouse(): void {
  if (mode !== 'play' || pausaMouse) return;
  pausaMouse = true;
  document.body.classList.remove('jogando');
  el.pausa.classList.add('on');
}
function continuarPeloMouse(): void {
  pausaMouse = false;
  el.pausa.classList.remove('on');
  travarMouse();
}
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement) return;
  if (soltandoPeloJogo) soltandoPeloJogo = false;
  else pausarPeloMouse();
});
// Botão direito ou P também soltam (o Esc do Chrome sai da tela cheia e minimiza a página do hub)
if (comMouse) soltarMouseSemEsc();
// sem trava (navegador não deu): Esc ou P também pausam; com a pausa aberta, Esc ou Espaço continuam
window.addEventListener('keydown', (e) => {
  if (!comMouse || mode !== 'play') return;
  if (pausaMouse && (e.key === 'Escape' || e.key === ' ')) continuarPeloMouse();
  else if (e.key === 'Escape' || (e.code === 'KeyP' && !document.pointerLockElement)) {
    // com a trava, o navegador costuma soltar sozinho (e a pausa vem pelo pointerlockchange); se não soltar, solta aqui
    if (document.pointerLockElement) document.exitPointerLock();
    else pausarPeloMouse();
  }
});
document.addEventListener('mousemove', (e) => {
  if (!comMouse || mode !== 'play' || parado()) return;
  rotation += (e.movementX / canvas.clientWidth) * Math.PI * 2 * DRAG_TURNS_PER_WIDTH;
});

// Teclado (para testar no computador).
const keys = new Set<string>();
window.addEventListener('keydown', (e) => keys.add(e.key));
window.addEventListener('keyup', (e) => keys.delete(e.key));
setInterval(() => {
  if (mode !== 'play' || parado()) return;
  if (keys.has('ArrowLeft')) rotation -= 0.07;
  if (keys.has('ArrowRight')) rotation += 0.07;
}, 1000 / 60);

el.continuar.addEventListener('click', continuarPeloMouse);
el.start.addEventListener('click', () => {
  unlockAudio();
  if (mode === 'menu') travarMouse();
  if (mode === 'menu') newRun();
});
el.again.addEventListener('click', () => {
  unlockAudio();
  if (mode === 'over') travarMouse();
  if (mode === 'over') newRun();
});

window.addEventListener('resize', () => world.resize());
window.addEventListener('contextmenu', (e) => e.preventDefault());

// ---------- Hub ----------
let initDone = false;
function finishInit(a: AvatarConfig, muted: boolean, p: PersonagemImagens | null = null): void {
  if (initDone) return;
  initDone = true;
  setMuted(muted);
  applyPersonagem(p);
  applyAvatar(a);
  mode = 'menu';
  updateHud();
}

bridge.onHubMessage((msg: HubToGame) => {
  switch (msg.type) {
    case 'init':
      if (initDone) {
        applyPersonagem(msg.personagem ?? null);
        applyAvatar(msg.avatar);
        setMuted(msg.muted);
      } else finishInit(msg.avatar, msg.muted, msg.personagem ?? null);
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
      if (mode === 'over' || mode === 'menu') {
        travarMouse(); // sem clique a trava não vem, mas o cursor some e o mouse gira igual
        newRun();
      }
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
