/**
 * Regras do G03 (Network Snake), sem nenhuma dependência de Phaser nem do navegador.
 * Tudo aqui é testável em `logic.test.ts`.
 *
 * Um item de pontuação aparece por vez, em um lugar livre; cada item é de um tipo sorteado (`foodKind`: casa, globo,
 * antena, CPE, caixa de fibra, roteador ou switch). Ao conectar o item, o cabo cresce, pontua e outro item aparece.
 */

export type Dir = 'up' | 'down' | 'left' | 'right';
export interface Pt {
  x: number;
  y: number;
}
export type Rng = () => number;
export type Cause = 'self' | 'obstacle' | 'timeout';
export type StepEvent = 'none' | 'item' | 'signal' | 'crash';

export const COLS = 15;
export const ROWS = 20;
export const ROUND_MS = 120_000;
export const BASE_POINTS = 10;
/** Tempo extra ganho a cada item conectado. */
export const ITEM_BONUS_MS = 5000;
export const MAX_LEVEL = 10;
/** Tipos de item de pontuação (casa, antena, CPE, caixa de fibra, roteador, switch). O globo não é comida: é o bônus. */
export const FOOD_KINDS = 6;
/** O globo (sinal) aparece de vez em quando; ao pegar, liga o modo de ponto extra (pontos em dobro) por alguns segundos. */
export const SIGNAL_CHANCE = 0.22;
export const SIGNAL_LIFETIME_MS = 9000;
export const BOOST_MS = 6000;
export const START_LENGTH = 6;
const ITEMS_PER_LEVEL = 3;

const DELTA: Record<Dir, Pt> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

export interface GameState {
  /** Cabo: o primeiro item é a cabeça (o conector com o olho). */
  snake: Pt[];
  dir: Dir;
  /** Curvas pedidas e ainda não executadas (no máximo 2). */
  queue: Dir[];
  /** Onde está o item de pontuação e de que tipo ele é (0 a FOOD_KINDS - 1). */
  food: Pt;
  foodKind: number;
  /** Globo de ponto extra no campo (null = não há). `signalLeft` = passos até ele sumir. */
  signal: Pt | null;
  signalLeft: number;
  /** Passos que faltam do modo de ponto extra (0 = desligado). */
  boostLeft: number;
  obstacles: Pt[];
  /** Os mesmos muros, como trechos retos (para desenhar uma cerca por trecho). */
  walls: Bar[];
  score: number;
  /** Itens conectados. */
  eaten: number;
  alive: boolean;
  cause: Cause | null;
  lastEvent: StepEvent;
  /** Pontos ganhos no último passo (0 se não conectou). */
  lastGain: number;
  /** Casa onde estava a ponta do cabo antes do último passo (null se o cabo cresceu). Usada só para animar. */
  prevTail: Pt | null;
}

/** Um trecho reto de muro (a cerca de madeira do gestor), com `len` casas, na horizontal ou na vertical. */
export interface Bar {
  x: number;
  y: number;
  len: number;
  vertical: boolean;
}

const cellsOf = (b: Bar): Pt[] => Array.from({ length: b.len }, (_, i) => (b.vertical ? { x: b.x, y: b.y + i } : { x: b.x + i, y: b.y }));
const h = (x: number, y: number, len = 3): Bar => ({ x, y, len, vertical: false });
const v = (x: number, y: number, len = 3): Bar => ({ x, y, len, vertical: true });

/** Layouts de muro (um é sorteado por partida). Todos deixam livre a faixa do meio, onde o cabo começa (linhas 8 a 12). */
export const MAP_BARS: readonly (readonly Bar[])[] = [
  [h(2, 3), h(10, 3), h(2, 16), h(10, 16)],
  [v(2, 2), v(12, 2), v(2, 15), v(12, 15)],
  [h(1, 2), h(11, 2), h(1, 17), h(11, 17), v(7, 3), v(7, 14)],
];
export const MAPS: readonly Pt[][] = MAP_BARS.map((bars) => bars.flatMap(cellsOf));

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const same = (a: Pt, b: Pt): boolean => a.x === b.x && a.y === b.y;

/** Nível sobe a cada 3 itens conectados. */
export function levelFor(eaten: number): number {
  return Math.min(MAX_LEVEL, 1 + Math.floor(eaten / ITEMS_PER_LEVEL));
}

/** Intervalo entre passos, em milissegundos. Quanto maior o nível, mais rápido. */
export function tickMs(level: number): number {
  return Math.max(85, 200 - (level - 1) * 12);
}

export function freeCell(state: Pick<GameState, 'snake' | 'obstacles' | 'food' | 'signal'>, rng: Rng, minDistFrom?: Pt, minDist = 0): Pt | null {
  const taken = new Set<string>();
  const key = (p: Pt) => `${p.x},${p.y}`;
  for (const p of state.snake) taken.add(key(p));
  for (const p of state.obstacles) taken.add(key(p));
  taken.add(key(state.food));
  if (state.signal) taken.add(key(state.signal));

  const free: Pt[] = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (taken.has(`${x},${y}`)) continue;
      if (minDistFrom && Math.abs(x - minDistFrom.x) + Math.abs(y - minDistFrom.y) < minDist) continue;
      free.push({ x, y });
    }
  }
  if (free.length === 0) return null;
  return free[Math.floor(rng() * free.length)] ?? null;
}

/** Sorteia um tipo de item diferente do anterior, para não repetir o mesmo seguidamente. */
export function nextFoodKind(previous: number, rng: Rng): number {
  return (previous + 1 + Math.floor(rng() * (FOOD_KINDS - 1))) % FOOD_KINDS;
}

export function createState(rng: Rng): GameState {
  const idx = Math.floor(rng() * MAPS.length);
  const map = MAPS[idx] ?? MAPS[0] ?? [];
  const snake: Pt[] = Array.from({ length: START_LENGTH }, (_, i) => ({ x: 9 - i, y: 10 }));
  const partial = { snake, obstacles: map.map((p) => ({ ...p })), food: { x: -1, y: -1 }, signal: null };
  const food = freeCell(partial, rng, snake[0], 4) ?? { x: 14, y: 10 };
  return {
    snake,
    dir: 'right',
    queue: [],
    food,
    foodKind: Math.floor(rng() * FOOD_KINDS),
    signal: null,
    signalLeft: 0,
    boostLeft: 0,
    obstacles: partial.obstacles,
    walls: (MAP_BARS[idx] ?? MAP_BARS[0] ?? []).map((b) => ({ ...b })),
    score: 0,
    eaten: 0,
    alive: true,
    cause: null,
    lastEvent: 'none',
    lastGain: 0,
    prevTail: null,
  };
}

/** Pede uma curva. Ignora a direção oposta à última e repetições; guarda no máximo 2 curvas. */
export function enqueueDir(state: GameState, dir: Dir): boolean {
  const last = state.queue[state.queue.length - 1] ?? state.dir;
  if (dir === last || dir === OPPOSITE[last]) return false;
  if (state.queue.length >= 2) return false;
  state.queue.push(dir);
  return true;
}

/** Avança o cabo uma casa. Altera o estado. */
export function step(state: GameState, rng: Rng): void {
  state.lastEvent = 'none';
  state.lastGain = 0;
  if (!state.alive) return;

  const next = state.queue.shift();
  if (next) state.dir = next;
  const head = state.snake[0];
  if (!head) return;
  const d = DELTA[state.dir];
  // a parede é uma passagem: o cabo sai por um lado e surge do lado oposto
  const target: Pt = { x: (head.x + d.x + COLS) % COLS, y: (head.y + d.y + ROWS) % ROWS };

  if (state.obstacles.some((o) => same(o, target))) return die(state, 'obstacle');

  const eating = same(target, state.food);
  // Se não está crescendo, a ponta do cabo sai do lugar, então não conta como colisão.
  const body = eating ? state.snake : state.snake.slice(0, -1);
  if (body.some((s) => same(s, target))) return die(state, 'self');

  // os contadores do bônus andam a cada passo (antes de conectar, para o item deste passo já usar o estado novo)
  if (state.boostLeft > 0) state.boostLeft--;
  if (state.signal) {
    state.signalLeft--;
    if (state.signalLeft <= 0) state.signal = null;
  }

  state.snake.unshift(target);
  state.prevTail = eating ? null : (state.snake.pop() ?? null);

  if (eating) {
    state.eaten++;
    const gain = BASE_POINTS * levelFor(state.eaten) * (state.boostLeft > 0 ? 2 : 1);
    state.score += gain;
    state.lastGain = gain;
    state.lastEvent = 'item';
    const placed = freeCell(state, rng, target, 3);
    if (placed) state.food = placed;
    state.foodKind = nextFoodKind(state.foodKind, rng);
    // de vez em quando aparece o globo de ponto extra
    if (!state.signal && state.boostLeft === 0 && rng() < SIGNAL_CHANCE) {
      const sig = freeCell(state, rng, target, 3);
      if (sig) {
        state.signal = sig;
        state.signalLeft = Math.ceil(SIGNAL_LIFETIME_MS / tickMs(levelFor(state.eaten)));
      }
    }
  } else if (state.signal && same(target, state.signal)) {
    state.signal = null;
    state.boostLeft = Math.ceil(BOOST_MS / tickMs(levelFor(state.eaten)));
    state.lastEvent = 'signal';
  }
}

function die(state: GameState, cause: Cause): void {
  state.alive = false;
  state.cause = cause;
  state.lastEvent = 'crash';
}
