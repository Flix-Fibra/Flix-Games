/**
 * Regras do G10 (Estoque Flix), sem nenhuma dependência de Phaser nem do navegador.
 *
 * Mistura de blocos que caem com combinação de itens iguais: um item por vez cai pela prateleira,
 * o jogador escolhe a coluna, e ele trava no chão ou em cima de outros itens. Qualquer grupo de 3 ou mais itens
 * IGUAIS ligados (lado a lado, em cima ou embaixo) é guardado e libera espaço; o que sobra desce e pode formar
 * novos grupos em cadeia. A partida termina quando não há lugar para a próxima peça ou quando acabam os 2 minutos. Grupos grandes valem muito mais: o jogo premia juntar mais de 3 de uma vez.
 */

export interface Pt {
  x: number;
  y: number;
}
export type Rng = () => number;
export type Cause = 'overflow' | 'timeout';

export const ROUND_MS = 120_000;
export const COLS = 7;
export const ROWS = 11;
/** 1 roteador, 2 cabo, 3 monitor, 4 furadeira, 5 antena parabólica. */
export const ITEM_TYPES = 5;
export const MIN_GROUP = 3;
export const ITEMS_PER_LEVEL = 12;
export const MAX_LEVEL = 10;
/** Pontos de um grupo: cresce mais que proporcional ao tamanho (3 = 30, 4 = 80, 5 = 150, 6 = 240, 7 = 350). */
export const groupPoints = (size: number): number => BASE_POINTS * size * (size - MIN_GROUP + 1);
export const BASE_POINTS = 10;

export interface PieceCell extends Pt {
  item: number;
}
export interface Piece {
  shape: string;
  /** Posições relativas ao canto superior esquerdo da peça. */
  cells: PieceCell[];
  /** Canto superior esquerdo no tabuleiro. */
  x: number;
  y: number;
}

export type Board = number[][];

interface ShapeDef {
  id: string;
  cells: Array<[number, number]>;
  weight: number;
}
/** Cada peça é um único item. A estrutura de células fica genérica, mas o jogo só usa a peça de 1 bloco. */
export const SHAPES: readonly ShapeDef[] = [{ id: 'dot', cells: [[0, 0]], weight: 1 }];

export interface StepResult {
  /** 1 na primeira rodada, 2 na reação em cadeia seguinte, e assim por diante. */
  chain: number;
  groups: number[];
  removed: Array<PieceCell>;
  /** Itens que desceram depois da limpeza (para animar). */
  falls: Array<{ x: number; fromY: number; toY: number; item: number }>;
  gain: number;
  /** Tabuleiro depois da queda. */
  board: Board;
}
export interface LockResult {
  /** Células da peça no tabuleiro logo ao travar, antes de limpar. */
  placed: PieceCell[];
  steps: StepResult[];
  gain: number;
  stored: number;
  levelUp: boolean;
}

export interface GameState {
  board: Board;
  piece: Piece | null;
  next: Piece;
  score: number;
  /** Itens guardados (removidos do tabuleiro). */
  stored: number;
  bestChain: number;
  fallLeft: number;
  alive: boolean;
  cause: Cause | null;
}

export const levelFor = (stored: number): number => Math.min(MAX_LEVEL, 1 + Math.floor(stored / ITEMS_PER_LEVEL));
/** Tipos de item em jogo: 4 no começo e 5 a partir do nível 3 (mais variedade, grupos mais difíceis). */
export const typesFor = (stored: number): number => (levelFor(stored) >= 3 ? ITEM_TYPES : ITEM_TYPES - 1);
/** Tempo entre quedas de uma linha: 550 ms no começo, 8 ms mais rápido por item guardado, mínimo 150 ms. */
export const fallInterval = (stored: number): number => Math.max(150, 550 - 8 * stored);
export const SOFT_DROP_MS = 55;

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

export const pieceWidth = (p: { cells: Pt[] }): number => Math.max(...p.cells.map((c) => c.x)) + 1;
export const pieceHeight = (p: { cells: Pt[] }): number => Math.max(...p.cells.map((c) => c.y)) + 1;

export function makePiece(rng: Rng, types: number): Piece {
  const total = SHAPES.reduce((a, s) => a + s.weight, 0);
  let r = rng() * total;
  let def = SHAPES[0]!;
  for (const s of SHAPES) {
    r -= s.weight;
    if (r < 0) {
      def = s;
      break;
    }
  }
  const cells = def.cells.map(([x, y]) => ({ x, y, item: 1 + Math.floor(rng() * types) }));
  const piece: Piece = { shape: def.id, cells, x: 0, y: 0 };
  piece.x = Math.floor((COLS - pieceWidth(piece)) / 2);
  return piece;
}

/** A peça, deslocada de (dx, dy), bate na parede, no chão ou em algum item? */
export function collides(board: Board, piece: Piece, dx = 0, dy = 0, cells: PieceCell[] = piece.cells): boolean {
  for (const c of cells) {
    const x = piece.x + dx + c.x;
    const y = piece.y + dy + c.y;
    if (x < 0 || x >= COLS || y >= ROWS) return true;
    if (y >= 0 && board[y]![x] !== 0) return true;
  }
  return false;
}

export function createState(rng: Rng): GameState {
  const board = emptyBoard();
  const first = makePiece(rng, typesFor(0));
  const state: GameState = {
    board,
    piece: first,
    next: makePiece(rng, typesFor(0)),
    score: 0,
    stored: 0,
    bestChain: 0,
    fallLeft: fallInterval(0),
    alive: true,
    cause: null,
  };
  return state;
}

/** Entra a próxima peça. Devolve false (e termina a partida) se não houver lugar. */
export function spawn(state: GameState, rng: Rng): boolean {
  if (!state.alive) return false;
  const piece = state.next;
  piece.y = 0;
  state.next = makePiece(rng, typesFor(state.stored));
  state.fallLeft = fallInterval(state.stored);
  if (collides(state.board, piece)) {
    state.piece = null;
    state.alive = false;
    state.cause = 'overflow';
    return false;
  }
  state.piece = piece;
  return true;
}

export function moveH(state: GameState, dx: number): boolean {
  const p = state.piece;
  if (!state.alive || !p || collides(state.board, p, dx, 0)) return false;
  p.x += dx;
  return true;
}

/** Gira 90° no sentido horário, com pequenos ajustes laterais para não travar na parede. */
export function rotate(state: GameState): boolean {
  const p = state.piece;
  if (!state.alive || !p || p.cells.length === 1) return false;
  const maxY = Math.max(...p.cells.map((c) => c.y));
  let rotated = p.cells.map((c) => ({ x: maxY - c.y, y: c.x, item: c.item }));
  const minX = Math.min(...rotated.map((c) => c.x));
  const minY = Math.min(...rotated.map((c) => c.y));
  rotated = rotated.map((c) => ({ x: c.x - minX, y: c.y - minY, item: c.item }));
  for (const kick of [0, -1, 1, -2, 2]) {
    if (!collides(state.board, p, kick, 0, rotated)) {
      p.cells = rotated;
      p.x += kick;
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

/** Derruba a peça até o fim. Devolve quantas linhas desceu. */
export function hardDrop(state: GameState): number {
  let n = 0;
  while (fall(state)) n++;
  return n;
}

/** Grupos de itens iguais ligados, com 3 ou mais. */
export function findGroups(board: Board): Pt[][] {
  const seen = Array.from({ length: ROWS }, () => Array<boolean>(COLS).fill(false));
  const groups: Pt[][] = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const item = board[y]![x]!;
      if (item === 0 || seen[y]![x]) continue;
      const stack: Pt[] = [{ x, y }];
      const group: Pt[] = [];
      seen[y]![x] = true;
      while (stack.length) {
        const c = stack.pop()!;
        group.push(c);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = c.x + dx;
          const ny = c.y + dy;
          if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS || seen[ny]![nx] || board[ny]![nx] !== item) continue;
          seen[ny]![nx] = true;
          stack.push({ x: nx, y: ny });
        }
      }
      if (group.length >= MIN_GROUP) groups.push(group);
    }
  }
  return groups;
}

/** Faz os itens soltos descerem. Devolve o que se moveu. */
function applyGravity(board: Board): StepResult['falls'] {
  const falls: StepResult['falls'] = [];
  for (let x = 0; x < COLS; x++) {
    let write = ROWS - 1;
    for (let y = ROWS - 1; y >= 0; y--) {
      const item = board[y]![x]!;
      if (item === 0) continue;
      if (y !== write) {
        board[write]![x] = item;
        board[y]![x] = 0;
        falls.push({ x, fromY: y, toY: write, item });
      }
      write--;
    }
  }
  return falls;
}

/** Trava a peça no tabuleiro e resolve todas as reações em cadeia. A próxima peça só entra com `spawn`. */
export function lock(state: GameState): LockResult {
  const p = state.piece;
  const result: LockResult = { placed: [], steps: [], gain: 0, stored: 0, levelUp: false };
  if (!p) return result;
  for (const c of p.cells) {
    const x = p.x + c.x;
    const y = p.y + c.y;
    if (y >= 0) state.board[y]![x] = c.item;
    result.placed.push({ x, y, item: c.item });
  }
  state.piece = null;

  const levelBefore = levelFor(state.stored);
  let chain = 0;
  for (;;) {
    const groups = findGroups(state.board);
    if (groups.length === 0) break;
    chain++;
    const removed: PieceCell[] = [];
    let gain = 0;
    for (const g of groups) {
      for (const c of g) removed.push({ x: c.x, y: c.y, item: state.board[c.y]![c.x]! });
      gain += groupPoints(g.length) * chain;
    }
    for (const c of removed) state.board[c.y]![c.x] = 0;
    const falls = applyGravity(state.board);
    state.score += gain;
    state.stored += removed.length;
    result.gain += gain;
    result.stored += removed.length;
    result.steps.push({ chain, groups: groups.map((g) => g.length), removed, falls, gain, board: copyBoard(state.board) });
  }
  state.bestChain = Math.max(state.bestChain, chain);
  result.levelUp = levelFor(state.stored) > levelBefore;
  return result;
}

export interface GravityResult {
  moved: boolean;
  locked: LockResult | null;
}

/**
 * Avança o relógio da queda. A cada intervalo a peça desce uma linha; se não puder descer, trava.
 * Com `soft`, o intervalo encolhe (o jogador segura a seta para baixo).
 */
export function gravity(state: GameState, dtMs: number, soft: boolean): GravityResult {
  const out: GravityResult = { moved: false, locked: null };
  if (!state.alive || !state.piece) return out;
  state.fallLeft -= dtMs;
  if (state.fallLeft > 0) return out;
  state.fallLeft = soft ? Math.min(SOFT_DROP_MS, fallInterval(state.stored)) : fallInterval(state.stored);
  if (fall(state)) out.moved = true;
  else out.locked = lock(state);
  return out;
}
