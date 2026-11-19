/**
 * Regras do G10 (Estoque Flix), sem nenhuma dependência de Phaser nem do navegador.
 *
 * Peças de 4 blocos caem numa prateleira de 10 x 20. O jogador move para os lados, gira, acelera a descida ou
 * derruba de uma vez. Cada bloco é um pedaço de cabo: a linha completa liga um aparelho de cada lado (uma conexão)
 * e some; o que está acima desce. Mais linhas de uma
 * vez valem muito mais. Sem limite de tempo: a partida só termina quando a próxima peça não cabe.
 * Cada formato de peça é sempre o mesmo item (mesma cor e desenho).
 */

export interface Pt {
  x: number;
  y: number;
}
export type Rng = () => number;
export type Cause = 'overflow';

export const COLS = 10;
export const ROWS = 20;
/** Cores de cabo (`theme.ts`): uma por formato de peça. */
export const ITEM_TYPES = 7;
export const LINES_PER_LEVEL = 5;
export const MAX_LEVEL = 10;
/** Pontos por linhas limpas de uma vez (1, 2, 3, 4), multiplicados pelo nível. */
export const LINE_POINTS = [0, 100, 300, 500, 800] as const;
export const SOFT_DROP_POINTS = 1;
export const HARD_DROP_POINTS = 2;
/** Tempo que a peça fica no chão antes de travar (dá para ajustar no último instante). */
export const LOCK_DELAY_MS = 500;
/** Quantas vezes mover ou girar no chão reinicia o tempo de travar (evita girar para sempre). */
export const MAX_LOCK_RESETS = 15;
export const SOFT_DROP_MS = 40;

export type ShapeId = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

interface ShapeDef {
  id: ShapeId;
  /** Item (cor e desenho) da peça. */
  item: number;
  /** Lado da caixa em que a peça gira. */
  size: number;
  /** Células na posição de entrada, dentro da caixa size x size. */
  cells: Array<[number, number]>;
}

/** As 7 peças de 4 blocos. */
export const SHAPES: readonly ShapeDef[] = [
  { id: 'I', item: 2, size: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]] }, // reta
  { id: 'O', item: 3, size: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] }, // quadrado
  { id: 'T', item: 5, size: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  { id: 'S', item: 4, size: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] }, // escadinha
  { id: 'Z', item: 1, size: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] }, // escadinha ao contrário
  { id: 'J', item: 6, size: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  { id: 'L', item: 7, size: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
];
const SHAPE_BY_ID = Object.fromEntries(SHAPES.map((s) => [s.id, s])) as Record<ShapeId, ShapeDef>;

export interface PieceCell extends Pt {
  item: number;
}
export interface Piece {
  shape: ShapeId;
  size: number;
  /** Posições relativas ao canto da caixa da peça. */
  cells: PieceCell[];
  /** Canto superior esquerdo da caixa no tabuleiro (y pode ser negativo: acima da prateleira). */
  x: number;
  y: number;
}

export type Board = number[][];

export interface LockResult {
  /** Células da peça no tabuleiro ao travar. */
  placed: PieceCell[];
  /** Tabuleiro com a peça, antes de tirar as linhas (para animar). */
  before: Board;
  /** Linhas completas (de cima para baixo), já retiradas do tabuleiro. */
  cleared: number[];
  gain: number;
  levelUp: boolean;
}

export interface GameState {
  board: Board;
  piece: Piece | null;
  next: Piece;
  /** Saco com as próximas peças: as 7 saem embaralhadas antes de repetir. */
  bag: ShapeId[];
  score: number;
  lines: number;
  /** Quantas vezes limpou 4 linhas de uma vez. */
  quads: number;
  fallLeft: number;
  /** Tempo para travar, contando só enquanto a peça está apoiada. */
  lockLeft: number;
  lockResets: number;
  alive: boolean;
  cause: Cause | null;
}

export const levelFor = (lines: number): number => Math.min(MAX_LEVEL, 1 + Math.floor(lines / LINES_PER_LEVEL));
const FALL_MS = [800, 680, 570, 470, 380, 300, 230, 170, 120, 85];
/** Tempo entre quedas de uma linha, por nível. */
export const fallInterval = (level: number): number => FALL_MS[Math.min(MAX_LEVEL, Math.max(1, level)) - 1]!;

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

export const emptyBoard = (): Board => Array.from({ length: ROWS }, () => Array<number>(COLS).fill(0));
const copyBoard = (b: Board): Board => b.map((r) => r.slice());

export const pieceWidth = (p: { cells: Pt[] }): number => Math.max(...p.cells.map((c) => c.x)) - Math.min(...p.cells.map((c) => c.x)) + 1;
export const pieceHeight = (p: { cells: Pt[] }): number => Math.max(...p.cells.map((c) => c.y)) - Math.min(...p.cells.map((c) => c.y)) + 1;

/** Peça na posição de entrada: centralizada, com a primeira fileira de blocos no topo da prateleira. */
export function makePiece(id: ShapeId): Piece {
  const def = SHAPE_BY_ID[id];
  const cells = def.cells.map(([x, y]) => ({ x, y, item: def.item }));
  const minY = Math.min(...cells.map((c) => c.y));
  return { shape: id, size: def.size, cells, x: Math.floor((COLS - def.size) / 2), y: -minY };
}

/** Quanto a reta (4 em fileira) sai a mais que as outras: +10 pontos percentuais (de 1/7 ≈ 14% para ≈ 24%). */
export const I_BONUS = 0.1;
/** Chance de, a cada peça, sair uma reta extra sem gastar o saco. Assim a reta sai 1/7 + I_BONUS das vezes. */
export const EXTRA_I_CHANCE = I_BONUS / (1 - 1 / 7);

/**
 * Próxima peça: às vezes uma reta extra (EXTRA_I_CHANCE); senão, a próxima do saco. Quando o saco esvazia,
 * entram as 7 de novo, embaralhadas (nenhuma forma some por muito tempo).
 */
export function drawShape(bag: ShapeId[], rng: Rng): ShapeId {
  if (rng() < EXTRA_I_CHANCE) return 'I';
  if (bag.length === 0) {
    const fresh = SHAPES.map((s) => s.id);
    for (let i = fresh.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [fresh[i], fresh[j]] = [fresh[j]!, fresh[i]!];
    }
    bag.push(...fresh);
  }
  return bag.shift()!;
}

/** A peça, deslocada de (dx, dy), bate na parede, no chão ou em algum bloco? Acima da prateleira é livre. */
export function collides(board: Board, piece: Piece, dx = 0, dy = 0, cells: PieceCell[] = piece.cells): boolean {
  for (const c of cells) {
    const x = piece.x + dx + c.x;
    const y = piece.y + dy + c.y;
    if (x < 0 || x >= COLS || y >= ROWS) return true;
    if (y >= 0 && board[y]![x] !== 0) return true;
  }
  return false;
}

export const grounded = (state: GameState): boolean => !!state.piece && collides(state.board, state.piece, 0, 1);

export function createState(rng: Rng): GameState {
  const bag: ShapeId[] = [];
  const first = makePiece(drawShape(bag, rng));
  return {
    board: emptyBoard(),
    piece: first,
    next: makePiece(drawShape(bag, rng)),
    bag,
    score: 0,
    lines: 0,
    quads: 0,
    fallLeft: fallInterval(1),
    lockLeft: LOCK_DELAY_MS,
    lockResets: 0,
    alive: true,
    cause: null,
  };
}

/** Entra a próxima peça. Devolve false (e termina a partida) se não houver lugar. */
export function spawn(state: GameState, rng: Rng): boolean {
  if (!state.alive) return false;
  const piece = state.next;
  state.next = makePiece(drawShape(state.bag, rng));
  state.fallLeft = fallInterval(levelFor(state.lines));
  state.lockLeft = LOCK_DELAY_MS;
  state.lockResets = 0;
  if (collides(state.board, piece)) {
    state.piece = null;
    state.alive = false;
    state.cause = 'overflow';
    return false;
  }
  state.piece = piece;
  return true;
}

/** Mover ou girar com a peça apoiada dá mais um tempo antes de travar (até MAX_LOCK_RESETS vezes). */
function touchLock(state: GameState): void {
  if (state.lockResets < MAX_LOCK_RESETS) {
    state.lockLeft = LOCK_DELAY_MS;
    state.lockResets++;
  }
}

export function moveH(state: GameState, dx: number): boolean {
  const p = state.piece;
  if (!state.alive || !p || collides(state.board, p, dx, 0)) return false;
  p.x += dx;
  touchLock(state);
  return true;
}

/** Tentativas de encaixe ao girar perto da parede ou de blocos: no lugar, para os lados, um pouco acima. */
const KICKS: ReadonlyArray<[number, number]> = [[0, 0], [-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0], [-1, -1], [1, -1]];

/** Gira 90° (1 = horário, -1 = anti-horário) dentro da caixa da peça. O quadrado não gira. */
export function rotate(state: GameState, dir: 1 | -1 = 1): boolean {
  const p = state.piece;
  if (!state.alive || !p || p.shape === 'O') return false;
  const n = p.size - 1;
  const rotated = p.cells.map((c) => (dir === 1 ? { x: n - c.y, y: c.x, item: c.item } : { x: c.y, y: n - c.x, item: c.item }));
  for (const [kx, ky] of KICKS) {
    if (!collides(state.board, p, kx, ky, rotated)) {
      p.cells = rotated;
      p.x += kx;
      p.y += ky;
      touchLock(state);
      return true;
    }
  }
  return false;
}

/** Desce uma linha, se der. */
export function fall(state: GameState): boolean {
  const p = state.piece;
  if (!state.alive || !p || collides(state.board, p, 0, 1)) return false;
  p.y++;
  state.lockLeft = LOCK_DELAY_MS;
  return true;
}

/** Linha onde a peça pararia se caísse agora (para a sombra de aterrissagem). */
export function landingY(state: GameState): number {
  const p = state.piece;
  if (!p) return 0;
  let dy = 0;
  while (!collides(state.board, p, 0, dy + 1)) dy++;
  return p.y + dy;
}

/** Derruba a peça até o fim (2 pontos por linha descida). Quem chama trava a peça em seguida. */
export function hardDrop(state: GameState): number {
  let n = 0;
  while (fall(state)) n++;
  state.score += n * HARD_DROP_POINTS;
  return n;
}

/** Linhas completas do tabuleiro, de cima para baixo. */
export function fullRows(board: Board): number[] {
  const rows: number[] = [];
  for (let y = 0; y < ROWS; y++) if (board[y]!.every((v) => v !== 0)) rows.push(y);
  return rows;
}

/** Trava a peça, tira as linhas completas e soma os pontos. A próxima peça só entra com `spawn`. */
export function lock(state: GameState): LockResult {
  const p = state.piece;
  const result: LockResult = { placed: [], before: copyBoard(state.board), cleared: [], gain: 0, levelUp: false };
  if (!p) return result;
  let above = false;
  for (const c of p.cells) {
    const x = p.x + c.x;
    const y = p.y + c.y;
    if (y >= 0) state.board[y]![x] = c.item;
    else above = true;
    result.placed.push({ x, y, item: c.item });
  }
  state.piece = null;
  result.before = copyBoard(state.board);

  const cleared = fullRows(state.board);
  const levelBefore = levelFor(state.lines);
  if (cleared.length) {
    const keep = state.board.filter((_, y) => !cleared.includes(y));
    state.board = [...Array.from({ length: cleared.length }, () => Array<number>(COLS).fill(0)), ...keep];
    result.gain = LINE_POINTS[cleared.length]! * levelBefore;
    state.score += result.gain;
    state.lines += cleared.length;
    if (cleared.length === 4) state.quads++;
  }
  result.cleared = cleared;
  result.levelUp = levelFor(state.lines) > levelBefore;
  // travou com parte da peça acima da prateleira e nada foi limpo: lotou
  if (above && cleared.length === 0) {
    state.alive = false;
    state.cause = 'overflow';
  }
  return result;
}

export interface GravityResult {
  moved: boolean;
  locked: LockResult | null;
}

/**
 * Avança o relógio da queda. A cada intervalo a peça desce uma linha. Apoiada, ela espera LOCK_DELAY_MS e trava.
 * Com `soft` (seta para baixo segurada), desce bem mais rápido e ganha 1 ponto por linha.
 */
export function gravity(state: GameState, dtMs: number, soft: boolean): GravityResult {
  const out: GravityResult = { moved: false, locked: null };
  if (!state.alive || !state.piece) return out;
  const interval = soft ? Math.min(SOFT_DROP_MS, fallInterval(levelFor(state.lines))) : fallInterval(levelFor(state.lines));
  if (grounded(state)) {
    state.fallLeft = Math.min(state.fallLeft, interval);
    state.lockLeft -= dtMs;
    if (state.lockLeft <= 0) out.locked = lock(state);
    return out;
  }
  state.fallLeft = Math.min(state.fallLeft, interval) - dtMs;
  while (state.fallLeft <= 0 && fall(state)) {
    out.moved = true;
    if (soft) state.score += SOFT_DROP_POINTS;
    state.fallLeft += interval;
  }
  if (state.fallLeft <= 0) state.fallLeft = interval;
  return out;
}
