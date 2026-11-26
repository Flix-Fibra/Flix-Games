import { createHubBridge, type HubToGame } from '@flix/game-sdk';
import { telaCheiaNoToque } from '@flix/game-kit/src/telaCheia';
import game_json from '../game.json';
import { setMuted, sfx, unlockAudio } from './audio';
import { LEVELS } from './levels';
import {
  DT, MAX_STROKES, canShoot, cannonAngle, createHole, createRun, finishHole, holeDone, resultName, runFinished, shoot, shootFromCannon, step,
  totalPar, totalStrokes, type HoleEvent, type HoleState, type Run,
} from './logic';
import { Mundo3D, type Mira } from './mundo3d';
import { loadBest, saveBest } from './storage';
import { Telas } from './telas';

/**
 * Minigolfe Flix em 3D: física em `logic.ts` (testada), desenho em `mundo3d.ts` (Three.js), interface em `telas.ts`.
 * Este arquivo liga tudo: hub, entrada (arrastar e soltar), laço e fim do percurso.
 */

const NEXT_HOLE_MS = 1600;
/** Arrasto (px da tela) que dá a força máxima, e o mínimo para valer como tacada. */
const DRAG_MAX_PX = 120;
const DRAG_MIN_PX = 8;
const INIT_TIMEOUT_MS = 1500;

const bridge = createHubBridge({
  gameId: game_json.id,
  sdkVersion: game_json.sdkVersion,
  avatarTier: game_json.avatarTier as 'A' | 'B',
  avatarViews: game_json.avatarViews as Array<'portrait'>,
});

const host = document.getElementById('game')!;
host.style.position = 'relative';
const mundo = new Mundo3D(host);
const ui = new Telas(host);

let run: Run = createRun(LEVELS);
let hole: HoleState = createHole(LEVELS[0]!);
let jogando = false;
let transicao = false;
let pausado = false;
let runId = '';
let elapsed = 0;
let acc = 0;
let sinkT = 0;
let previousBest = 0;
let drag: { x0: number; y0: number; x1: number; y1: number } | null = null;

// ---------- fluxo ----------

function menu(): void {
  jogando = false;
  mundo.modoVitrine = true;
  hole = createHole(LEVELS[0]!);
  mundo.carregar(hole.level);
  ui.menu(LEVELS.length, loadBest(), comecar);
}

function comecar(): void {
  unlockAudio();
  ui.fecharTela();
  run = createRun(LEVELS);
  runId = bridge.newRunId();
  elapsed = 0;
  previousBest = loadBest();
  jogando = true;
  mundo.modoVitrine = false;
  carregarBuraco();
  bridge.sendStarted(runId);
}

function carregarBuraco(): void {
  const level = run.levels[run.index]!;
  hole = createHole(level);
  sinkT = 0;
  transicao = false;
  drag = null;
  mundo.margens = ui.margens();
  mundo.carregar(level);
  ui.faixa(level.name, run.index === 0 ? 'Arraste para trás e solte para tacar' : '');
  atualizarPlacar();
}

function atualizarPlacar(): void {
  ui.placar(run.index + 1, run.levels.length, hole.level.par, hole.strokes, totalStrokes(run) + hole.strokes);
}

function fimDoBuraco(): void {
  if (transicao || !holeDone(hole)) return;
  transicao = true;
  finishHole(run, hole);
  window.setTimeout(() => {
    if (runFinished(run)) fimDoPercurso();
    else carregarBuraco();
  }, NEXT_HOLE_MS);
}

function fimDoPercurso(): void {
  sfx('end');
  jogando = false;
  const total = totalStrokes(run);
  const par = totalPar(run);
  bridge.sendGameOver({
    runId,
    score: total,
    durationMs: elapsed,
    meta: { holes: run.levels.length, par, strokes: run.results.join(',') },
  });
  const melhor = saveBest(total);
  const recorde = previousBest === 0 || total < previousBest;
  mundo.modoVitrine = true;
  ui.fim({ total, par, resultados: run.results, pares: run.levels.map((l) => l.par), melhor, recorde, dev: !bridge.embedded }, comecar);
}

// ---------- eventos da física ----------

function onEvent(e: HoleEvent): void {
  switch (e.type) {
    case 'bounce':
      sfx('bounce', Math.min(1, e.speed / 12));
      break;
    case 'bumper':
      sfx('bumper');
      mundo.pulsarPoste(hole);
      break;
    case 'portal':
      sfx('portal');
      mundo.estouro(hole, [0xa855f7, 0x22d3ee, 0xffffff], 14, 1.5);
      break;
    case 'hazard':
      sfx('splash');
      if (e.kind === 'lava') sfx('burn');
      mundo.estouro(hole, e.kind === 'lava' ? [0xff5a1f, 0xffd23d] : [0x5aa8e0, 0xffffff], 18, 2);
      ui.avisar(e.kind === 'water' ? 'ÁGUA! +1' : e.kind === 'lava' ? 'LAVA! +1' : 'FORA! +1', 1000, 'ruim');
      atualizarPlacar();
      break;
    case 'cannon':
      sfx('cannon');
      ui.avisar('BOMBA!', 900);
      ui.faixa(hole.level.name, 'A bomba mira sozinha: toque ou arraste só para dar a força');
      atualizarPlacar();
      break;
    case 'jump':
      sfx('jump');
      break;
    case 'land':
      sfx('bounce', 0.5);
      break;
    case 'stop':
      atualizarPlacar();
      break;
    case 'sink': {
      sfx('sink');
      const nome = resultName(hole.strokes, hole.level.par);
      const bom = hole.strokes <= hole.level.par;
      if (bom) window.setTimeout(() => sfx('good'), 250);
      mundo.estouro(hole, bom ? [0xffd54a, 0xff3d5e, 0x22d3ee, 0x34d399, 0xffffff] : [0xffffff, 0x9aa3c0], bom ? 40 : 16, 3);
      ui.avisar(nome, NEXT_HOLE_MS - 150, bom ? 'bom' : '');
      atualizarPlacar();
      fimDoBuraco();
      break;
    }
    case 'giveup':
      sfx('giveup');
      ui.avisar(`LIMITE DE ${MAX_STROKES}`, NEXT_HOLE_MS - 150, 'ruim');
      atualizarPlacar();
      fimDoBuraco();
      break;
  }
}

// ---------- entrada: arrastar para trás e soltar ----------

/** Direção e força a partir do arrasto: a bola vai para o lado contrário do arrasto, no chão do campo. */
function miraDoArrasto(d: NonNullable<typeof drag>): Mira | null {
  const px = Math.hypot(d.x1 - d.x0, d.y1 - d.y0);
  if (px < DRAG_MIN_PX) return null;
  const a = mundo.noChao(d.x0, d.y0);
  const b = mundo.noChao(d.x1, d.y1);
  if (!a || !b) return null;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.hypot(dx, dy) < 1e-4) return null;
  return { angle: Math.atan2(-dy, -dx), power: Math.min(1, px / DRAG_MAX_PX) };
}

function miraAtual(): Mira | null {
  if (!jogando || !canShoot(hole) || transicao) return null;
  if (hole.held !== null) {
    const c = hole.level.cannons[hole.held]!;
    const power = drag ? Math.min(1, Math.hypot(drag.x1 - drag.x0, drag.y1 - drag.y0) / DRAG_MAX_PX) || 0.6 : 0.6;
    return { angle: cannonAngle(c, hole.clock), power };
  }
  return drag ? miraDoArrasto(drag) : null;
}

host.addEventListener('pointerdown', (e) => {
  if (!jogando || !canShoot(hole) || transicao) return;
  drag = { x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY };
  host.setPointerCapture?.(e.pointerId);
});
host.addEventListener('pointermove', (e) => {
  if (!drag) return;
  drag.x1 = e.clientX;
  drag.y1 = e.clientY;
});
const soltar = (): void => {
  const d = drag;
  drag = null;
  ui.barraForca(null);
  if (!d || !jogando || !canShoot(hole) || transicao) return;
  if (hole.held !== null) {
    // bomba: a direção é a dela; o jogador só dá a força (um toque sem arrastar vale 0,6)
    const px = Math.hypot(d.x1 - d.x0, d.y1 - d.y0);
    const power = px >= DRAG_MIN_PX ? Math.min(1, px / DRAG_MAX_PX) : 0.6;
    if (shootFromCannon(hole, power)) {
      sfx('hit', power);
      ui.faixa(hole.level.name, '');
      atualizarPlacar();
    }
    return;
  }
  const mira = miraDoArrasto(d);
  if (mira && shoot(hole, mira.angle, mira.power)) {
    sfx('hit', mira.power);
    ui.faixa(hole.level.name, '');
    atualizarPlacar();
  }
};
host.addEventListener('pointerup', soltar);
host.addEventListener('pointercancel', () => {
  drag = null;
  ui.barraForca(null);
});

// ---------- laço ----------

let ultimo = performance.now();
function quadro(agora: number): void {
  requestAnimationFrame(quadro);
  const dt = Math.min((agora - ultimo) / 1000, 0.05);
  ultimo = agora;
  if (pausado) return;
  if (jogando && !transicao) elapsed += dt * 1000;
  // o relógio da fase corre sempre (a bomba gira, o moinho roda, a lava pisca), com a bola parada ou não
  acc += dt;
  while (acc >= DT) {
    acc -= DT;
    const ev = step(hole);
    if (jogando) for (const e of ev) onEvent(e);
  }
  if (hole.sunk) sinkT = Math.min(1, sinkT + dt * 3);
  const mira = miraAtual();
  if (drag && mira) ui.barraForca(mira.power);
  mundo.atualizar(hole, dt, mira, sinkT);
}

window.addEventListener('resize', () => {
  if (jogando) mundo.margens = ui.margens();
  mundo.resize();
});

// ---------- hub ----------

let iniciado = false;
const iniciar = (muted: boolean) => {
  if (iniciado) return;
  iniciado = true;
  setMuted(muted);
  menu();
};
bridge.onHubMessage((msg: HubToGame) => {
  switch (msg.type) {
    case 'init':
      iniciar(msg.muted);
      break;
    case 'mute':
      setMuted(msg.muted);
      break;
    case 'pause':
      pausado = true;
      break;
    case 'resume':
      pausado = false;
      ultimo = performance.now();
      break;
    case 'restart':
      if (!jogando && iniciado) comecar();
      break;
  }
});
bridge.sendReady();
window.setTimeout(() => iniciar(false), INIT_TIMEOUT_MS);
telaCheiaNoToque();
requestAnimationFrame(quadro);

// Evita menu de contexto e rolagem durante o jogo.
window.addEventListener('contextmenu', (e) => e.preventDefault());

// Ajuda de depuração: ?debug expõe o estado em `window.__minigolfe`.
if (new URLSearchParams(window.location.search).has('debug')) {
  Object.assign(window, { __minigolfe: { get hole() { return hole; }, get run() { return run; }, mundo, comecar, ir: (n: number) => { run.index = n; carregarBuraco(); } } });
}
