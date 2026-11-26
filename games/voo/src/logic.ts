import { AVIAO_SIZE, HITBOXES } from './hitboxes';
import { GAME_H, N_GUINDASTES, N_PREDIOS } from './theme';

/** Proporções conferidas no Flappy Bird de flappybird.io (altura do campo = 1280): espaçamento 723, vão visível 358, velocidade constante ~423 px/s. */
/** Regras do Voo Rasante, sem Phaser (testáveis). Unidades: px e segundos; y cresce para baixo. */

export const PLANE_X = 210; // o avião fica parado na horizontal; o mundo é que corre para a esquerda
export const GRAVITY = 2300;
export const FLAP_VY = -760;
export const MAX_FALL = 1150;
export const FLOOR_Y = GAME_H - 24;

export const SPEED_START = 420;
export const SPEED_MAX = 420;
export const SPEED_STEP = 0; // por par de obstáculos passado
export const SPACING = 723; // distância horizontal entre dois pares
export const FIRST_X = 980; // posição do primeiro par quando a partida começa
export const GAP_START = 358;
export const GAP_MIN = 260;
export const GAP_STEP = 10; // o vão fecha 10 px por par
export const CENTER_MIN = 380; // faixa do centro do vão (garante que o prédio chega ao chão e o guindaste ao teto)
export const CENTER_MAX = 740;
export const MAX_SHIFT = 260; // variação máxima do centro entre pares seguidos (sempre dá para passar)

/** Fundo anda bem mais devagar que os obstáculos, na mesma direção. */
export const BG_FACTOR = 0.12;

/** Círculos de colisão do avião (relativos ao centro do sprite), um pouco menores que o desenho. */
export const PLANE_CIRCLES: ReadonlyArray<{ x: number; y: number; r: number }> = [
  { x: 2, y: 3, r: 22 },
  { x: 29, y: 0, r: 14 },
  { x: -27, y: 5, r: 14 },
];
export const PLANE_HALF_H = AVIAO_SIZE[1] / 2;

export interface Obstacle {
  x: number; // centro
  center: number; // centro do vão
  gap: number;
  predio: number;
  guindaste: number;
  passed: boolean;
}

export interface World {
  y: number; // centro do avião
  vy: number;
  speed: number;
  score: number;
  obstacles: Obstacle[];
  nextX: number;
  lastCenter: number;
  rng: () => number;
}

export const gapFor = (score: number): number => Math.max(GAP_MIN, GAP_START - GAP_STEP * score);
export const speedFor = (score: number): number => Math.min(SPEED_MAX, SPEED_START + SPEED_STEP * score);

export function makeWorld(rng: () => number = Math.random): World {
  return { y: GAME_H / 2 - 40, vy: 0, speed: SPEED_START, score: 0, obstacles: [], nextX: FIRST_X, lastCenter: (CENTER_MIN + CENTER_MAX) / 2, rng };
}

export function flap(w: World): void {
  w.vy = FLAP_VY;
}

/** Centro do próximo vão: sorteado, mas a no máximo MAX_SHIFT do anterior. */
export function nextCenter(prev: number, rng: () => number): number {
  const lo = Math.max(CENTER_MIN, prev - MAX_SHIFT);
  const hi = Math.min(CENTER_MAX, prev + MAX_SHIFT);
  return Math.round(lo + rng() * (hi - lo));
}

export function spawn(w: World): Obstacle {
  const center = nextCenter(w.lastCenter, w.rng);
  w.lastCenter = center;
  const o: Obstacle = {
    x: w.nextX,
    center,
    gap: gapFor(w.score),
    predio: Math.floor(w.rng() * N_PREDIOS),
    guindaste: Math.floor(w.rng() * N_GUINDASTES),
    passed: false,
  };
  w.obstacles.push(o);
  w.nextX += SPACING;
  return o;
}

/** Posição do sprite: prédio sai do chão para cima até `top`; guindaste desce do teto até `bottom`. */
export const buildingTop = (o: Obstacle): number => o.center + o.gap / 2;
export const craneBottom = (o: Obstacle): number => o.center - o.gap / 2;

/** Caixa [esq, topo, larg, alt] de cada pedaço do obstáculo no mundo. */
export function obstacleRects(o: Obstacle): Array<[number, number, number, number]> {
  const out: Array<[number, number, number, number]> = [];
  const b = HITBOXES[`predio_${o.predio}`];
  const g = HITBOXES[`guindaste_${o.guindaste}`];
  if (b) {
    const left = o.x - b.w / 2, top = buildingTop(o);
    for (const [x, y, w, h] of b.rects) out.push([left + x, top + y, w, h]);
  }
  if (g) {
    const left = o.x - g.w / 2, top = craneBottom(o) - g.h;
    for (const [x, y, w, h] of g.rects) out.push([left + x, top + y, w, h]);
  }
  return out;
}

export const MARGIN = 3; // folga a favor do jogador nas caixas

export function circleHitsRect(cx: number, cy: number, r: number, rect: [number, number, number, number]): boolean {
  const [rx, ry, rw, rh] = rect;
  const nx = Math.max(rx + MARGIN, Math.min(cx, rx + rw - MARGIN));
  const ny = Math.max(ry + MARGIN, Math.min(cy, ry + rh - MARGIN));
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

export function planeHits(w: World): boolean {
  if (w.y + PLANE_HALF_H * 0.7 >= FLOOR_Y) return true;
  for (const o of w.obstacles) {
    if (Math.abs(o.x - PLANE_X) > 220) continue;
    const rects = obstacleRects(o);
    for (const c of PLANE_CIRCLES) {
      for (const r of rects) if (circleHitsRect(PLANE_X + c.x, w.y + c.y, c.r, r)) return true;
    }
  }
  return false;
}

export interface StepResult {
  scored: number; // pares passados neste passo
  crashed: boolean;
}

/** Avança `dt` segundos. `dt` deve ser pequeno (o jogo limita a 1/30). */
export function step(w: World, dt: number): StepResult {
  w.vy = Math.min(MAX_FALL, w.vy + GRAVITY * dt);
  w.y += w.vy * dt;
  if (w.y < PLANE_HALF_H * 0.6) {
    w.y = PLANE_HALF_H * 0.6; // teto: encosta e para de subir, sem morrer
    if (w.vy < 0) w.vy = 0;
  }

  for (const o of w.obstacles) o.x -= w.speed * dt;
  w.nextX -= w.speed * dt;
  while (w.nextX < FIRST_X + SPACING) spawn(w);
  w.obstacles = w.obstacles.filter((o) => o.x > -400);

  let scored = 0;
  for (const o of w.obstacles) {
    if (!o.passed && o.x < PLANE_X - 100) {
      o.passed = true;
      scored++;
    }
  }
  w.score += scored;
  w.speed = speedFor(w.score);
  return { scored, crashed: planeHits(w) };
}

/** Inclinação do avião (graus) a partir da velocidade vertical. */
export const tiltFor = (vy: number): number => Math.max(-22, Math.min(40, vy * 0.035));

/** Imagens do fundo em sequência: cada uma tem `width`; as de índice ímpar são espelhadas (normal, espelhada, normal...). */
export function backgroundLayout(offset: number, width: number, count: number): Array<{ x: number; flip: boolean }> {
  const idx = Math.floor(offset / width);
  const out: Array<{ x: number; flip: boolean }> = [];
  for (let i = 0; i < count; i++) {
    const n = idx + i;
    out.push({ x: n * width - offset, flip: Math.abs(n) % 2 === 1 });
  }
  return out;
}
