/**
 * G09 Faixa a Faixa: lógica pura (sem Phaser), determinística e testável.
 *
 * O mundo é uma pilha infinita de FAIXAS (lanes). Cada faixa tem 9 colunas jogáveis e é gerada sob demanda, de baixo
 * para cima, por `World.ensure`. Faixas que ficaram para trás da câmera são descartadas por `World.prune`.
 *
 * COMO O GERADOR EVITA BLOQUEIOS IMPOSSÍVEIS (resumo; detalhes em docs/GAMEPLAY_SHEETS/faixa.md)
 *  1. Cada faixa guarda `reach`: as colunas onde o jogador pode estar de pé, de forma segura e estática, e que são
 *     alcançáveis a partir do começo da fase.
 *  2. Ao gerar a faixa N, ela recebe o `reach` da faixa N-1 e é OBRIGADA a ter ao menos uma coluna "alinhada":
 *     uma coluna que está em `reach(N-1)` e que é transitável em N (sem obstáculo na grama, com vitória-régia no rio).
 *     Se o sorteio não deixou nenhuma, o gerador abre uma à força.
 *  3. O `reach` da faixa N é a região conectada (andando de lado) a partir das colunas alinhadas. Assim a regra vale
 *     por indução: a fase inteira é sempre atravessável, e duas faixas de vitória-régia seguidas sempre têm uma
 *     vitória-régia alinhada.
 *  4. Perigos em movimento (carros, troncos, trem) são periódicos e têm vãos mínimos proporcionais à velocidade,
 *     então existe sempre uma janela de tempo para passar. A margem depois de um rio de troncos nunca tem obstáculos.
 */

export type Rng = () => number;

/** Gerador pseudoaleatório pequeno e determinístico (mesma semente, mesma fase). */
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

// ---------- constantes de projeto ----------

/** Largura jogável de cada faixa, em blocos. Fora dela ficam as barreiras (desenhadas pela cena; o jogador não passa). */
export const COLS = 9;
/** Colunas fora da área jogável por onde carros e troncos entram e saem. */
export const MARGIN = 3;
/** Comprimento do circuito de cada faixa em movimento: o objeto que sai por um lado volta pelo outro. */
export const LOOP = COLS + 2 * MARGIN;
/** Faixas de trás da linha de largada (a câmera começa mostrando elas). */
export const START_ROW = 3;
export const START_COL = 4;
/** As primeiras faixas depois da largada são sempre seguras: grama, sem obstáculo no caminho. */
export const SAFE_AHEAD = 5;
/** No máximo tantas faixas perigosas seguidas; depois vem uma faixa de descanso. */
export const MAX_HAZARD_STREAK = 4;
/** Aviso mínimo do trem, em segundos (o jogo nunca dá menos que isso, mesmo na dificuldade máxima). */
export const MIN_TRAIN_WARNING = 1;
/** Tamanho da zona do jogador na colisão: ele ocupa [x + HIT_PAD, x + 1 - HIT_PAD]. */
export const HIT_PAD = 0.2;
/** Quantas faixas existem à frente da câmera. */
export const LOOKAHEAD = 26;

/** Segundos para alcançar a próxima faixa nova e manter o combo (a barra da tela mostra o que resta). */
export const COMBO_WINDOW = 0.2;
/** Bônus máximo por faixa de um combo: a faixa de número n do combo vale n - 1 pontos extras, até aqui. */
export const COMBO_BONUS_CAP = 5;

export type LaneKind = 'grass' | 'road' | 'river' | 'rail';
export type Dir = 'up' | 'down' | 'left' | 'right';
export type Cause = 'vehicle' | 'train' | 'water' | 'carried' | 'time';

/** Objeto em movimento num circuito: `x0` é a borda esquerda em t = 0, em [0, LOOP). */
export interface Mover {
  x0: number;
  len: number;
  variant: number;
}

interface LaneBase {
  index: number;
  /** Colunas onde o jogador pode estar de pé e que dá para alcançar (ver o comentário do arquivo). */
  reach: boolean[];
}
export interface GrassLane extends LaneBase {
  kind: 'grass';
  /** true = tem obstáculo (árvore, cone, caixa). */
  blocked: boolean[];
  /** Qual desenho de obstáculo usar em cada coluna (0..2). */
  props: number[];
  /** Margem depois de um rio de troncos: sem obstáculos. */
  bank: boolean;
}
export interface RoadLane extends LaneBase {
  kind: 'road';
  dir: 1 | -1;
  /** Blocos por segundo. */
  speed: number;
  vehicles: Mover[];
}
export interface RiverLane extends LaneBase {
  kind: 'river';
  mode: 'logs' | 'pads';
  dir: 1 | -1;
  speed: number;
  logs: Mover[];
  /** Vitórias-régias fixas (modo `pads`). */
  pads: boolean[];
}
export interface RailLane extends LaneBase {
  kind: 'rail';
  dir: 1 | -1;
  /** Segundos entre o começo de uma passagem do trem e o da próxima. */
  period: number;
  offset: number;
  /** Segundos de sinal antes do trem entrar. */
  warn: number;
  trainLen: number;
  /** Blocos por segundo. */
  trainSpeed: number;
}
export type Lane = GrassLane | RoadLane | RiverLane | RailLane;

// ---------- dificuldade ----------

/** Faixas já avançadas (a primeira faixa depois da largada é a 1). */
export const progress = (index: number): number => index - START_ROW;

/** 0 no começo, sobe suavemente e se aproxima de 1 (cerca de 0,63 na faixa 75 e 0,88 na 150). */
export function difficulty(index: number): number {
  const n = Math.max(0, progress(index) - SAFE_AHEAD);
  return 1 - Math.exp(-n / 70);
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const mod = (a: number, n: number): number => ((a % n) + n) % n;

// ---------- movimento periódico (função só do tempo) ----------

/** Borda esquerda de um objeto do circuito no instante t (pode ser negativa ou maior que COLS: está fora da tela). */
export function moverLeft(m: Mover, dir: 1 | -1, speed: number, t: number): number {
  return mod(m.x0 + dir * speed * t, LOOP) - MARGIN;
}

export type TrainPhase = 'idle' | 'warning' | 'passing';
export interface TrainState {
  phase: TrainPhase;
  /** Borda esquerda do trem (só em `passing`). */
  left: number;
  /** Segundos até o trem entrar (só em `warning`). */
  eta: number;
}

export const trainCrossTime = (l: RailLane): number => (COLS + l.trainLen) / l.trainSpeed;

export function trainState(l: RailLane, t: number): TrainState {
  const c = mod(t + l.offset, l.period);
  const cross = trainCrossTime(l);
  if (c < cross) {
    const front = l.trainSpeed * c; // quanto a frente já andou desde que o trem estava todo fora
    const left = l.dir === 1 ? front - l.trainLen : COLS - front;
    return { phase: 'passing', left, eta: 0 };
  }
  if (c >= l.period - l.warn) return { phase: 'warning', left: 0, eta: l.period - c };
  return { phase: 'idle', left: 0, eta: 0 };
}

const overlaps = (a0: number, a1: number, b0: number, b1: number): boolean => a0 < b1 && b0 < a1;

/** O jogador (borda esquerda `x`) está encostando em algum veículo da estrada? */
export function hitByVehicle(l: RoadLane, x: number, t: number): boolean {
  for (const v of l.vehicles) {
    const left = moverLeft(v, l.dir, l.speed, t);
    if (overlaps(x + HIT_PAD, x + 1 - HIT_PAD, left + 0.05, left + v.len - 0.05)) return true;
  }
  return false;
}

export function hitByTrain(l: RailLane, x: number, t: number): boolean {
  const s = trainState(l, t);
  return s.phase === 'passing' && overlaps(x + HIT_PAD, x + 1 - HIT_PAD, s.left, s.left + l.trainLen);
}

/** O que sustenta o jogador na faixa de rio: vitória-régia, tronco (com a velocidade dele) ou nada (afoga). */
export type Support = { kind: 'pad'; vx: number } | { kind: 'log'; vx: number } | null;

export function supportAt(l: RiverLane, x: number, t: number): Support {
  const cx = x + 0.5;
  if (l.mode === 'pads') {
    const col = Math.floor(cx);
    return col >= 0 && col < COLS && l.pads[col] ? { kind: 'pad', vx: 0 } : null;
  }
  for (const g of l.logs) {
    const left = moverLeft(g, l.dir, l.speed, t);
    if (cx > left + 0.1 && cx < left + g.len - 0.1) return { kind: 'log', vx: l.dir * l.speed };
  }
  return null;
}

// ---------- geração ----------

const allTrue = (): boolean[] => Array<boolean>(COLS).fill(true);

/** Colunas livres conectadas (andando de lado) às colunas `from`. */
function flood(free: boolean[], from: boolean[]): boolean[] {
  const out = Array<boolean>(COLS).fill(false);
  for (let c = 0; c < COLS; c++) {
    if (!from[c] || !free[c] || out[c]) continue;
    let a = c;
    let b = c;
    while (a > 0 && free[a - 1]) a--;
    while (b < COLS - 1 && free[b + 1]) b++;
    for (let k = a; k <= b; k++) out[k] = true;
  }
  return out;
}

/** Sorteia uma coluna entre as marcadas (assume que existe pelo menos uma). */
function pickCol(rng: Rng, among: boolean[]): number {
  const cols = among.flatMap((v, c) => (v ? [c] : []));
  return cols[Math.floor(rng() * cols.length)] ?? START_COL;
}

/**
 * Distribui objetos de comprimentos `lens` num circuito de tamanho LOOP, com vão mínimo `minGap` entre eles
 * (vale também de um lado ao outro da emenda do circuito). `jitter` em [0, 1]: 0 = vãos iguais, 1 = bem irregulares.
 * Devolve null se não couber.
 */
export function placeMovers(rng: Rng, lens: number[], variants: number[], minGap: number, jitter: number): Mover[] | null {
  const n = lens.length;
  const free = LOOP - lens.reduce((a, b) => a + b, 0);
  if (n === 0 || free < n * minGap) return null;
  const w = lens.map(() => 1 - jitter * 0.5 + rng() * jitter);
  const wSum = w.reduce((a, b) => a + b, 0);
  const extra = free - n * minGap;
  let pos = rng() * LOOP;
  return lens.map((len, i) => {
    const m: Mover = { x0: mod(pos, LOOP), len, variant: variants[i] ?? 0 };
    pos += len + minGap + (extra * (w[i] ?? 1)) / wSum;
    return m;
  });
}

/** Estado carregado de uma faixa para a próxima durante a geração. */
interface GenCtx {
  prevReach: boolean[];
  prevKind: LaneKind;
  prevRoadDir: 1 | -1;
  prevRiverMode: 'logs' | 'pads' | null;
  sameKind: number;
  hazardStreak: number;
}

function pickKind(index: number, d: number, ctx: GenCtx, rng: Rng): LaneKind {
  const p = progress(index);
  if (p <= SAFE_AHEAD) return 'grass';
  if (ctx.hazardStreak >= MAX_HAZARD_STREAK) return 'grass';
  const w: Record<LaneKind, number> = {
    grass: (4.5 - 3.3 * d) * (ctx.prevKind === 'grass' ? 0.5 : 1),
    road: 3 + d,
    river: p >= 8 ? 1.2 + d : 0,
    rail: p >= 12 ? 0.4 + d : 0,
  };
  if (ctx.sameKind >= 3) w[ctx.prevKind] = 0;
  const total = w.grass + w.road + w.river + w.rail;
  let r = rng() * total;
  for (const k of ['grass', 'road', 'river', 'rail'] as const) {
    r -= w[k];
    if (r < 0) return k;
  }
  return 'grass';
}

function genGrass(index: number, d: number, ctx: GenCtx, rng: Rng): GrassLane {
  const safeZone = progress(index) <= SAFE_AHEAD;
  const bank = ctx.prevKind === 'river' && ctx.prevRiverMode === 'logs';
  const blocked = Array<boolean>(COLS).fill(false);
  const props = Array.from({ length: COLS }, () => Math.floor(rng() * 3));
  if (!bank) {
    const density = safeZone ? 0.2 : 0.22 + 0.2 * d;
    for (let c = 0; c < COLS; c++) {
      const central = c >= START_COL - 1 && c <= START_COL + 1;
      blocked[c] = rng() < density && !(safeZone && central);
    }
  }
  // Garantia 2: pelo menos uma coluna alinhada com a faixa anterior.
  if (!blocked.some((b, c) => !b && ctx.prevReach[c])) blocked[pickCol(rng, ctx.prevReach)] = false;
  const free = blocked.map((b) => !b);
  const aligned = free.map((f, c) => f && (ctx.prevReach[c] ?? false));
  return { index, kind: 'grass', blocked, props, bank, reach: flood(free, aligned) };
}

function genRoad(index: number, d: number, ctx: GenCtx, rng: Rng): RoadLane {
  const dir: 1 | -1 = ctx.prevKind === 'road' && rng() < 0.7 ? (-ctx.prevRoadDir as 1 | -1) : rng() < 0.5 ? 1 : -1;
  const speed = lerp(1.6, 3.2, rng()) * (1 + 0.9 * d);
  // vão mínimo proporcional à velocidade: sempre dá tempo de atravessar
  const minGap = Math.max(2.2, speed * 0.85);
  let n = 1 + Math.floor(rng() * (2 + 2 * d));
  const truckChance = 0.15 + 0.25 * d;
  const variants: number[] = [];
  const lens: number[] = [];
  for (let i = 0; i < n + 3; i++) {
    const truck = rng() < truckChance;
    variants.push(truck ? 2 + Math.floor(rng() * 2) : Math.floor(rng() * 2));
    lens.push(truck ? 2.6 : 1.4);
  }
  let vehicles: Mover[] | null = null;
  while (n > 0 && !(vehicles = placeMovers(rng, lens.slice(0, n), variants.slice(0, n), minGap, 0.8))) n--;
  return { index, kind: 'road', dir, speed, vehicles: vehicles ?? [], reach: allTrue() };
}

function genRiver(index: number, d: number, ctx: GenCtx, rng: Rng): RiverLane {
  const dir: 1 | -1 = rng() < 0.5 ? 1 : -1;
  const pads = rng() < 0.4;
  if (pads) {
    // Garantia 2 e 3: vitória-régia alinhada com a faixa anterior (vale também para duas faixas de vitória-régia seguidas).
    const density = 0.62 - 0.2 * d;
    const cells = Array.from({ length: COLS }, () => rng() < density);
    const forced = pickCol(rng, ctx.prevReach);
    cells[forced] = true;
    // sem ilhas minúsculas demais: ao menos 3 vitórias-régias na faixa
    while (cells.filter(Boolean).length < 3) cells[Math.floor(rng() * COLS)] = true;
    const aligned = cells.map((f, c) => f && (ctx.prevReach[c] ?? false));
    return { index, kind: 'river', mode: 'pads', dir, speed: 0, logs: [], pads: cells, reach: flood(cells, aligned) };
  }
  const speed = lerp(1, 1.8, rng()) * (1 + 0.5 * d);
  const cover = 0.58 - 0.18 * d;
  const lens: number[] = [];
  const variants: number[] = [];
  const maxLen = 4 - Math.round(d);
  for (let i = 0; i < 6; i++) {
    lens.push(2 + Math.floor(rng() * (maxLen - 1)));
    variants.push(Math.floor(rng() * 2));
  }
  let n = Math.max(2, Math.round((LOOP * cover) / 3));
  let logs: Mover[] | null = null;
  while (n > 1 && !(logs = placeMovers(rng, lens.slice(0, n), variants.slice(0, n), 1.2, 0.5))) n--;
  return { index, kind: 'river', mode: 'logs', dir, speed, logs: logs ?? [], pads: [], reach: allTrue() };
}

function genRail(index: number, d: number, rng: Rng): RailLane {
  const dir: 1 | -1 = rng() < 0.5 ? 1 : -1;
  const trainLen = 14;
  const trainSpeed = 24;
  const warn = Math.max(MIN_TRAIN_WARNING, lerp(1.7, 1.15, d));
  const idle = lerp(3.5, 1.6, d) + rng() * 1.5;
  const lane: RailLane = { index, kind: 'rail', dir, period: 0, offset: 0, warn, trainLen, trainSpeed, reach: allTrue() };
  lane.period = trainCrossTime(lane) + warn + idle;
  lane.offset = rng() * lane.period;
  return lane;
}

/** Faixas geradas sob demanda (uma só vez cada, em ordem) e descartadas quando ficam para trás. */
export class World {
  private readonly rng: Rng;
  private readonly map = new Map<number, Lane>();
  private next = 0;
  private ctx: GenCtx = {
    prevReach: allTrue(),
    prevKind: 'grass',
    prevRoadDir: 1,
    prevRiverMode: null,
    sameKind: 0,
    hazardStreak: 0,
  };

  constructor(readonly seed: number) {
    this.rng = mulberry32(seed);
  }

  /** Quantas faixas estão na memória agora. */
  get size(): number {
    return this.map.size;
  }

  /** Primeira faixa ainda na memória. */
  get lowest(): number {
    return Math.min(...this.map.keys());
  }

  /** Garante que todas as faixas até `maxIndex` existam. */
  ensure(maxIndex: number): void {
    while (this.next <= maxIndex) this.generate(this.next++);
  }

  lane(index: number): Lane {
    this.ensure(index);
    const l = this.map.get(index);
    if (!l) throw new Error(`faixa ${index} já foi descartada`);
    return l;
  }

  has(index: number): boolean {
    return this.map.has(index);
  }

  /** Descarta as faixas abaixo de `below` (devolve os índices descartados, para a cena destruir os objetos). */
  prune(below: number): number[] {
    const gone: number[] = [];
    for (const i of this.map.keys()) {
      if (i < below) {
        this.map.delete(i);
        gone.push(i);
      }
    }
    return gone;
  }

  private generate(index: number): void {
    const { rng, ctx } = this;
    const d = difficulty(index);
    const kind = pickKind(index, d, ctx, rng);
    let lane: Lane;
    switch (kind) {
      case 'grass':
        lane = genGrass(index, d, ctx, rng);
        break;
      case 'road':
        lane = genRoad(index, d, ctx, rng);
        break;
      case 'river':
        lane = genRiver(index, d, ctx, rng);
        break;
      case 'rail':
        lane = genRail(index, d, rng);
        break;
    }
    this.ctx = {
      prevReach: lane.reach,
      prevKind: kind,
      prevRoadDir: lane.kind === 'road' ? lane.dir : ctx.prevRoadDir,
      prevRiverMode: lane.kind === 'river' ? lane.mode : null,
      sameKind: kind === ctx.prevKind ? ctx.sameKind + 1 : 1,
      hazardStreak: kind === 'grass' ? 0 : ctx.hazardStreak + 1,
    };
    this.map.set(index, lane);
  }
}

// ---------- partida ----------

export interface Game {
  world: World;
  /** Tempo de simulação, em segundos. */
  t: number;
  alive: boolean;
  cause: Cause | null;
  /** Faixa do jogador e posição (borda esquerda; inteiro, exceto em cima de um tronco). */
  row: number;
  x: number;
  /** Faixa mais alta já alcançada. */
  maxRow: number;
  /** Faixa na base da tela (decimal). Só sobe. Quando passa do jogador, ele perdeu por demorar. */
  camRow: number;
  /** Faixas novas seguidas, cada uma dentro de COMBO_WINDOW da anterior (0 = sem combo). */
  combo: number;
  /** Segundos que restam para o combo continuar. */
  comboLeft: number;
  /** Pontos extras acumulados pelos combos. */
  bonus: number;
  /** Bônus ganho no último passo (a cena mostra "+N"). */
  lastBonus: number;
}

/** Velocidade com que a base da tela sobe sozinha, em faixas por segundo (aumenta com a dificuldade). */
export const creepSpeed = (maxRow: number): number => lerp(0.7, 1.2, difficulty(maxRow));
/** Quantas faixas de folga o jogador mais avançado tem abaixo dele na tela. */
export const FOLLOW_ROWS = 5;

export function createGame(seed: number): Game {
  const world = new World(seed);
  world.ensure(START_ROW + LOOKAHEAD);
  return { world, t: 0, alive: true, cause: null, row: START_ROW, x: START_COL, maxRow: START_ROW, camRow: 0, combo: 0, comboLeft: 0, bonus: 0, lastBonus: 0 };
}

/** Faixas atravessadas além da largada. */
export const lanes = (g: Game): number => g.maxRow - START_ROW;
/** Pontuação: faixas atravessadas mais o bônus de combo. */
export const score = (g: Game): number => lanes(g) + g.bonus;

/** Coluna inteira mais próxima de x que esteja livre na faixa; null se nenhuma das duas vizinhas estiver. */
function snapFree(lane: Lane, x: number): number | null {
  const c0 = Math.round(x);
  const ok = (c: number): boolean => c >= 0 && c < COLS && !(lane.kind === 'grass' && lane.blocked[c]);
  if (ok(c0)) return c0;
  if (Math.abs(x - c0) < 1e-6) return null; // numa coluna exata, obstáculo à frente bloqueia (nada de passo na diagonal)
  const other = x > c0 ? c0 + 1 : c0 - 1; // vindo de um tronco (posição fracionária): tenta a outra coluna vizinha
  return ok(other) ? other : null;
}

/** Tem veículo ou trem ocupando esta posição agora? Andar para dentro dele é recusado (só morre quando ele passa por cima). */
function occupied(lane: Lane, x: number, t: number): boolean {
  return (lane.kind === 'road' && hitByVehicle(lane, x, t)) || (lane.kind === 'rail' && hitByTrain(lane, x, t));
}

/** Tenta um passo. Devolve true se o jogador andou (não anda para dentro de obstáculo nem para fora das colunas). */
export function move(g: Game, dir: Dir): boolean {
  if (!g.alive) return false;
  if (dir === 'left' || dir === 'right') {
    const nx = g.x + (dir === 'left' ? -1 : 1);
    if (nx < -0.001 || nx > COLS - 1 + 0.001) return false; // barreira lateral
    const lane = g.world.lane(g.row);
    if (lane.kind === 'grass' && lane.blocked[Math.round(nx)]) return false;
    if (occupied(lane, nx, g.t)) return false;
    g.x = nx;
    return true;
  }
  const nrow = g.row + (dir === 'up' ? 1 : -1);
  if (nrow < 0 || nrow < Math.floor(g.camRow)) return false;
  g.world.ensure(nrow + LOOKAHEAD);
  const target = g.world.lane(nrow);
  // em cima de um tronco o jogador pode ficar fora da grade; em qualquer outra faixa ele volta para uma coluna
  const keepsFloat = target.kind === 'river' && target.mode === 'logs';
  const nx = keepsFloat ? g.x : snapFree(target, g.x);
  if (nx === null || occupied(target, nx, g.t)) return false;
  g.row = nrow;
  g.x = nx;
  g.lastBonus = 0;
  if (nrow > g.maxRow) {
    g.maxRow = nrow;
    g.combo = g.comboLeft > 0 ? g.combo + 1 : 1;
    g.comboLeft = COMBO_WINDOW;
    if (g.combo >= 2) g.lastBonus = Math.min(g.combo - 1, COMBO_BONUS_CAP);
    g.bonus += g.lastBonus;
  }
  return true;
}

function die(g: Game, cause: Cause): void {
  if (g.alive) {
    g.alive = false;
    g.cause = cause;
  }
}

/** Avança a simulação. Chamar com passos pequenos (até 1/60 s). */
export function update(g: Game, dt: number): void {
  if (!g.alive) return;
  g.t += dt;
  if (g.comboLeft > 0) {
    g.comboLeft = Math.max(0, g.comboLeft - dt);
    if (g.comboLeft === 0) g.combo = 0;
  }

  // A câmera acompanha o jogador mais avançado e, mesmo parado, sobe sozinha: quem demora é alcançado.
  const target = g.maxRow - FOLLOW_ROWS;
  if (target > g.camRow) g.camRow += (target - g.camRow) * Math.min(1, dt * 5);
  g.camRow += creepSpeed(g.maxRow) * dt;
  g.world.ensure(Math.ceil(g.camRow) + LOOKAHEAD);

  const lane = g.world.lane(g.row);
  switch (lane.kind) {
    case 'road':
      if (hitByVehicle(lane, g.x, g.t)) die(g, 'vehicle');
      break;
    case 'rail':
      if (hitByTrain(lane, g.x, g.t)) die(g, 'train');
      break;
    case 'river': {
      const s = supportAt(lane, g.x, g.t);
      if (!s) die(g, 'water');
      else if (s.kind === 'log') {
        g.x += s.vx * dt;
        if (g.x < -0.5 || g.x > COLS - 0.5) die(g, 'carried');
      }
      break;
    }
    case 'grass':
      break;
  }
  if (g.alive && g.row < g.camRow - 0.9) die(g, 'time');
}
