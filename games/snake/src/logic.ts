/**
 * Regras do G03 (Fibra Conecta), sem nenhuma dependência de Phaser nem do navegador.
 * Tudo aqui é testável em `logic.test.ts`.
 */

export type Dir = 'up' | 'down' | 'left' | 'right';
export interface Pt {
  x: number;
  y: number;
}
export type Rng = () => number;
export type Cause = 'self' | 'obstacle' | 'timeout';
export type StepEvent = 'none' | 'house' | 'signal' | 'crash';

export const COLS = 18;
export const ROWS = 27;
export const ROUND_MS = 120_000;
export const BASE_POINTS = 10;
export const SIGNAL_BOOST_STEPS = 25;
export const SIGNAL_LIFETIME_STEPS = 45;
export const SIGNAL_CHANCE = 0.25;
export const MAX_LEVEL = 10;

const DELTA: Record<Dir, Pt> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

export interface GameState {
  /** Cabo: o primeiro item é a cabeça (o conector). */
  snake: Pt[];
  dir: Dir;
  /** Curvas pedidas e ainda não executadas (no máximo 2). */
  queue: Dir[];
  house: Pt;
  signal: Pt | null;
  signalLeft: number;
  boostLeft: number;
  obstacles: Pt[];
  score: number;
  houses: number;
  alive: boolean;
  cause: Cause | null;
  lastEvent: StepEvent;
  /** Pontos ganhos no último passo (0 se não comeu). */
  lastGain: number;
  /** Casa onde estava a ponta do cabo antes do último passo (null se o cabo cresceu). Usada só para animar. */
  prevTail: Pt | null;
}

/** Layouts de "obra" originais. Todos deixam livre a faixa central onde o cabo começa. */
const bar = (x: number, y: number, len: number, vertical = false): Pt[] =>
  Array.from({ length: len }, (_, i) => (vertical ? { x, y: y + i } : { x: x + i, y }));

export const MAPS: readonly Pt[][] = [
  [...bar(3, 5, 4), ...bar(11, 5, 4), ...bar(3, 21, 4), ...bar(11, 21, 4), ...bar(8, 9, 2), ...bar(8, 17, 2)],
  [...bar(4, 4, 5, true), ...bar(13, 4, 5, true), ...bar(4, 18, 5, true), ...bar(13, 18, 5, true)],
  [
    { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 3 },
    { x: 14, y: 2 }, { x: 15, y: 2 }, { x: 15, y: 3 },
    { x: 2, y: 24 }, { x: 3, y: 24 }, { x: 2, y: 23 },
    { x: 14, y: 24 }, { x: 15, y: 24 }, { x: 15, y: 23 },
    ...bar(8, 6, 2), ...bar(8, 20, 2),
  ],
];

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

/** Nível sobe a cada 3 casas conectadas. */
export function levelFor(houses: number): number {
  return Math.min(MAX_LEVEL, 1 + Math.floor(houses / 3));
}

/** Intervalo entre passos, em milissegundos. Quanto maior o nível, mais rápido. */
export function tickMs(level: number): number {
  return Math.max(70, 170 - (level - 1) * 12);
}

export function freeCell(state: Pick<GameState, 'snake' | 'obstacles' | 'house' | 'signal'>, rng: Rng, minDistFrom?: Pt, minDist = 0): Pt | null {
  const taken = new Set<string>();
  const key = (p: Pt) => `${p.x},${p.y}`;
  for (const p of state.snake) taken.add(key(p));
  for (const p of state.obstacles) taken.add(key(p));
  taken.add(key(state.house));
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

export function createState(rng: Rng): GameState {
  const map = MAPS[Math.floor(rng() * MAPS.length)] ?? MAPS[0] ?? [];
  const snake: Pt[] = [{ x: 9, y: 13 }, { x: 8, y: 13 }, { x: 7, y: 13 }];
  const partial = { snake, obstacles: map.map((p) => ({ ...p })), house: { x: -1, y: -1 }, signal: null };
  const house = freeCell(partial, rng, snake[0], 5) ?? { x: 15, y: 13 };
  return {
    snake,
    dir: 'right',
    queue: [],
    house,
    signal: null,
    signalLeft: 0,
    boostLeft: 0,
    obstacles: partial.obstacles,
    score: 0,
    houses: 0,
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

  const eating = same(target, state.house);
  // Se não está crescendo, a ponta do cabo sai do lugar, então não conta como colisão.
  const body = eating ? state.snake : state.snake.slice(0, -1);
  if (body.some((s) => same(s, target))) return die(state, 'self');

  if (state.boostLeft > 0) state.boostLeft--;
  if (state.signal) {
    state.signalLeft--;
    if (state.signalLeft <= 0) state.signal = null;
  }

  state.snake.unshift(target);
  state.prevTail = eating ? null : (state.snake.pop() ?? null);

  if (eating) {
    state.houses++;
    const gain = BASE_POINTS * levelFor(state.houses) * (state.boostLeft > 0 ? 2 : 1);
    state.score += gain;
    state.lastGain = gain;
    state.lastEvent = 'house';
    const newHouse = freeCell(state, rng, target, 4);
    if (newHouse) state.house = newHouse;
    if (!state.signal && rng() < SIGNAL_CHANCE) {
      const sig = freeCell(state, rng, target, 3);
      if (sig) {
        state.signal = sig;
        state.signalLeft = SIGNAL_LIFETIME_STEPS;
      }
    }
  } else if (state.signal && same(target, state.signal)) {
    state.signal = null;
    state.boostLeft = SIGNAL_BOOST_STEPS;
    state.lastEvent = 'signal';
  }
}

function die(state: GameState, cause: Cause): void {
  state.alive = false;
  state.cause = cause;
  state.lastEvent = 'crash';
}
