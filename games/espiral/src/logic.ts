/**
 * Regras do G14 (Descida em espiral), sem nada de desenho: dá para testar sem navegador.
 *
 * Coordenadas: a torre é um poste vertical. Cada andar fica em y = -i * FLOOR_GAP e é dividido em SEGMENTS
 * fatias iguais. A bola fica parada num ângulo fixo do mundo (na frente da câmera); quem gira é a torre.
 * O ângulo da bola "no referencial da torre" é BALL_WORLD_ANGLE - rotação da torre.
 */

export const SEGMENTS = 12;
export const SEG_ANGLE = (Math.PI * 2) / SEGMENTS;
export const FLOOR_GAP = 3; // distância vertical entre andares
export const FLOOR_THICK = 0.4;
export const BALL_R = 0.32;
export const BALL_WORLD_ANGLE = -Math.PI / 2; // na frente da câmera (+z)
export const GRAVITY = -32;
export const BOUNCE_SPEED = 10.5; // pico de ~1,7: a bola não encosta no andar de cima
export const MAX_FALL = -24;
export const FEVER_STREAK = 3; // andares seguidos sem quicar para quebrar o próximo
export const FLOORS_PER_PHASE = 10; // marco: muda o cenário e acelera um pouco
export const CHARGE_MAX = 12; // andares atravessados para encher a barra do foguete
export const ROCKET_FLOORS = 8; // andares que o foguete quebra em sequência
export const ROCKET_SPEED = 20; // descida do foguete (constante, sem gravidade)

export type Seg = 'solid' | 'gap' | 'danger' | 'bonus';
export type DeathCause = 'danger';

export interface Floor {
  index: number;
  segs: Seg[];
  broken: boolean;
}

export interface BallState {
  y: number; // centro da bola
  vy: number;
  streak: number; // andares atravessados desde o último quique
  shield: boolean;
  charge: number; // carga do foguete (0 a CHARGE_MAX)
  rocket: number; // andares que o foguete ainda vai quebrar (0 = desligado)
  safeLanding: boolean; // fim do foguete: o próximo pouso é seguro, até na alta tensão
}

export type StepEvent =
  | { type: 'bounce'; floor: number; seg: number }
  | { type: 'pass'; floor: number }
  | { type: 'break'; floor: number }
  | { type: 'shield-used'; floor: number; seg: number }
  | { type: 'shield-got'; floor: number; seg: number }
  | { type: 'rocket-start' }
  | { type: 'rocket-end'; floor: number }
  | { type: 'dead'; floor: number; seg: number; cause: DeathCause };

/** Gerador pseudoaleatório com semente (mulberry32): a mesma semente gera a mesma torre. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function phaseOf(floorsPassed: number): number {
  return Math.floor(floorsPassed / FLOORS_PER_PHASE);
}

/** Multiplicador de velocidade da simulação: sobe 6% por marco, até 1,5x. */
export function speedOf(phase: number): number {
  return Math.min(1.5, 1 + phase * 0.06);
}

export function floorY(index: number): number {
  return -index * FLOOR_GAP;
}

function wrap(i: number): number {
  return ((i % SEGMENTS) + SEGMENTS) % SEGMENTS;
}

/** Ângulo normalizado em [0, 2π). */
export function normAngle(a: number): number {
  const t = a % (Math.PI * 2);
  return t < 0 ? t + Math.PI * 2 : t;
}

/** Fatia da torre que está debaixo da bola, dada a rotação atual da torre. */
export function segmentUnderBall(rotation: number): number {
  return Math.floor(normAngle(BALL_WORLD_ANGLE - rotation) / SEG_ANGLE) % SEGMENTS;
}

/**
 * Gera o andar `index`. `prevGapSegs` são as fatias vazadas do andar de cima: a fatia logo abaixo delas
 * nunca é perigosa, porque é onde a bola cai se o jogador não girar (queda justa).
 */
export function generateFloor(index: number, rand: () => number, prevGapSegs: number[]): Floor {
  const segs: Seg[] = new Array<Seg>(SEGMENTS).fill('solid');
  if (index === 0) {
    // Primeiro andar: só um vão, sem perigo, para aprender.
    segs[wrap(Math.floor(rand() * SEGMENTS))] = 'gap';
    return { index, segs, broken: false };
  }

  // Vão: 2 fatias no começo, 1 fatia a partir do andar 25.
  const gapWidth = index < 25 ? 2 : 1;
  const gapStart = Math.floor(rand() * SEGMENTS);
  for (let k = 0; k < gapWidth; k++) segs[wrap(gapStart + k)] = 'gap';

  // Perigo: nenhum nos 3 primeiros andares, depois cresce até 5 fatias.
  const safe = new Set(prevGapSegs.map(wrap));
  const dangerCount = index < 3 ? 0 : Math.min(5, 1 + Math.floor(index / 8));
  let placed = 0;
  for (let tries = 0; placed < dangerCount && tries < 50; tries++) {
    const k = Math.floor(rand() * SEGMENTS);
    if (segs[k] !== 'solid' || safe.has(k)) continue;
    segs[k] = 'danger';
    placed++;
  }

  // Bônus de sinal (escudo): mais ou menos 1 a cada 7 andares, numa fatia sólida.
  if (index >= 4 && rand() < 0.15) {
    const solids = segs.map((s, k) => (s === 'solid' ? k : -1)).filter((k) => k >= 0);
    const pick = solids[Math.floor(rand() * solids.length)];
    if (pick !== undefined) segs[pick] = 'bonus';
  }
  return { index, segs, broken: false };
}

/** Torre infinita: gera andares sob demanda, sempre na mesma ordem para a mesma semente. */
export class Tower {
  private readonly rand: () => number;
  private readonly floors = new Map<number, Floor>();
  private lastGenerated = -1;

  constructor(seed: number) {
    this.rand = rng(seed);
  }

  get(index: number): Floor {
    while (this.lastGenerated < index) {
      const i = this.lastGenerated + 1;
      const prev = this.floors.get(i - 1);
      const prevGaps = prev ? prev.segs.map((s, k) => (s === 'gap' ? k : -1)).filter((k) => k >= 0) : [];
      this.floors.set(i, generateFloor(i, this.rand, prevGaps));
      this.lastGenerated = i;
    }
    const f = this.floors.get(index);
    if (!f) throw new Error(`andar ${index} descartado`);
    return f;
  }

  /** Libera da memória andares já bem acima da bola. */
  forgetAbove(index: number): void {
    for (const k of this.floors.keys()) if (k < index) this.floors.delete(k);
  }
}

export function newBall(): BallState {
  return { y: floorY(0) + FLOOR_THICK + BALL_R + 1.2, vy: 0, streak: 0, shield: false, charge: 0, rocket: 0, safeLanding: false };
}

/**
 * Avança a bola por `dt` segundos. `nextFloor` é o índice do próximo andar abaixo da bola.
 * Devolve o novo `nextFloor` e os eventos (quique, passagem, quebra, morte...).
 */
export function step(
  ball: BallState,
  tower: Tower,
  rotation: number,
  nextFloor: number,
  dt: number,
): { nextFloor: number; events: StepEvent[] } {
  const events: StepEvent[] = [];
  const prevBottom = ball.y - BALL_R;
  ball.vy = ball.rocket > 0 ? -ROCKET_SPEED : Math.max(MAX_FALL, ball.vy + GRAVITY * dt);
  ball.y += ball.vy * dt;

  // Pode cruzar mais de um andar no mesmo passo se cair muito rápido; trata um por vez.
  while (ball.vy < 0) {
    const floor = tower.get(nextFloor);
    const top = floorY(floor.index) + FLOOR_THICK;
    const bottom = ball.y - BALL_R;
    if (!(prevBottom >= top && bottom < top)) break;

    if (floor.broken) {
      nextFloor++;
      continue;
    }
    const seg = segmentUnderBall(rotation);
    const kind = floor.segs[seg] ?? 'solid';

    if (ball.rocket > 0) {
      // Foguete: quebra o andar, qualquer que seja a fatia, e segue descendo.
      floor.broken = true;
      ball.rocket--;
      if (ball.rocket === 0) ball.safeLanding = true;
      events.push({ type: 'break', floor: floor.index }, { type: 'pass', floor: floor.index });
      nextFloor++;
      continue;
    }

    if (kind === 'gap') {
      // Andar atravessado se desfaz (não fica um anel inteiro acima da bola).
      floor.broken = true;
      ball.streak++;
      events.push({ type: 'pass', floor: floor.index });
      charge(ball, events);
      nextFloor++;
      continue;
    }

    if (ball.streak >= FEVER_STREAK) {
      // Boost: atravessou andares seguidos e destrói este, qualquer que seja a fatia. A bola não quica no ar
      // onde estava o andar: segue caindo e quica no próximo (o boost acaba aqui).
      floor.broken = true;
      ball.streak = 0;
      events.push({ type: 'break', floor: floor.index }, { type: 'pass', floor: floor.index });
      charge(ball, events);
      nextFloor++;
      continue;
    }

    if (kind === 'danger' && !ball.safeLanding) {
      if (ball.shield) {
        ball.shield = false;
        events.push({ type: 'shield-used', floor: floor.index, seg });
      } else {
        ball.y = top + BALL_R;
        ball.vy = 0;
        events.push({ type: 'dead', floor: floor.index, seg, cause: 'danger' });
        return { nextFloor, events };
      }
    } else if (kind === 'bonus') {
      floor.segs[seg] = 'solid';
      ball.shield = true;
      events.push({ type: 'shield-got', floor: floor.index, seg });
    }
    ball.streak = 0;
    if (ball.safeLanding) {
      ball.safeLanding = false;
      events.push({ type: 'rocket-end', floor: floor.index });
    }
    land(ball, top);
    events.push({ type: 'bounce', floor: floor.index, seg });
    break;
  }
  return { nextFloor, events };
}

/** Cada andar atravessado carrega o foguete; com a barra cheia, ele liga na hora. */
function charge(ball: BallState, events: StepEvent[]): void {
  if (ball.safeLanding) return;
  ball.charge++;
  if (ball.charge < CHARGE_MAX) return;
  ball.charge = 0;
  ball.rocket = ROCKET_FLOORS;
  ball.streak = 0;
  ball.vy = -ROCKET_SPEED;
  events.push({ type: 'rocket-start' });
}

function land(ball: BallState, top: number): void {
  ball.y = top + BALL_R;
  ball.vy = BOUNCE_SPEED;
}
