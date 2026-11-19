import { describe, expect, it } from 'vitest';
import {
  COLS, I_BONUS, LINE_POINTS, LOCK_DELAY_MS, MAX_LOCK_RESETS, ROWS, SHAPES, collides, createState, drawShape, emptyBoard, fallInterval, fullRows,
  gravity, hardDrop, landingY, levelFor, lock, makePiece, moveH, mulberry32, rotate, spawn, type GameState, type ShapeId,
} from './logic';

/** Estado com tabuleiro vazio e a peça pedida na posição de entrada. */
function with_(id: ShapeId): GameState {
  const st = createState(mulberry32(1));
  st.board = emptyBoard();
  st.piece = makePiece(id);
  return st;
}
const abs = (st: GameState) => st.piece!.cells.map((c) => [st.piece!.x + c.x, st.piece!.y + c.y].join(',')).sort();

describe('peças', () => {
  it('são as 7 de 4 blocos, cada uma com um item próprio', () => {
    expect(SHAPES.map((s) => s.id).sort()).toEqual(['I', 'J', 'L', 'O', 'S', 'T', 'Z']);
    expect(new Set(SHAPES.map((s) => s.item)).size).toBe(7);
    for (const s of SHAPES) expect(s.cells).toHaveLength(4);
  });
  it('nascem centralizadas, encostadas no topo', () => {
    for (const s of SHAPES) {
      const p = makePiece(s.id);
      const ys = p.cells.map((c) => p.y + c.y);
      expect(Math.min(...ys)).toBe(0);
      const xs = p.cells.map((c) => p.x + c.x);
      expect(Math.min(...xs)).toBeGreaterThanOrEqual(3);
      expect(Math.max(...xs)).toBeLessThanOrEqual(6);
      expect(collides(emptyBoard(), p)).toBe(false);
    }
  });
  it('saem do saco: as outras 6 formas aparecem antes de qualquer uma repetir (a reta pode sair a mais)', () => {
    const rng = mulberry32(9);
    const bag: ShapeId[] = [];
    const others: ShapeId[] = [];
    while (others.length < 6 * 20) {
      const id = drawShape(bag, rng);
      if (id !== 'I') others.push(id);
    }
    for (let k = 0; k < others.length; k += 6) expect(new Set(others.slice(k, k + 6)).size).toBe(6);
  });
  it('a reta sai cerca de 10 pontos percentuais a mais que as outras', () => {
    const rng = mulberry32(4);
    const bag: ShapeId[] = [];
    const n = 70_000;
    let i = 0;
    for (let k = 0; k < n; k++) if (drawShape(bag, rng) === 'I') i++;
    expect(i / n).toBeGreaterThan(1 / 7 + I_BONUS - 0.01);
    expect(i / n).toBeLessThan(1 / 7 + I_BONUS + 0.01);
  });
});

describe('movimento', () => {
  it('anda para os lados até a parede', () => {
    const st = with_('O');
    let n = 0;
    while (moveH(st, -1)) n++;
    expect(n).toBe(4);
    expect(Math.min(...st.piece!.cells.map((c) => st.piece!.x + c.x))).toBe(0);
  });
  it('girar 4 vezes volta à posição de partida (e anti-horário desfaz o horário)', () => {
    for (const id of ['I', 'T', 'S', 'Z', 'J', 'L'] as ShapeId[]) {
      const st = with_(id);
      st.piece!.y = 5;
      const start = abs(st);
      for (let i = 0; i < 4; i++) expect(rotate(st)).toBe(true);
      expect(abs(st)).toEqual(start);
      rotate(st, 1);
      rotate(st, -1);
      expect(abs(st)).toEqual(start);
    }
  });
  it('a reta deitada vira em pé', () => {
    const st = with_('I');
    st.piece!.y = 5;
    rotate(st);
    const xs = new Set(st.piece!.cells.map((c) => c.x));
    expect(xs.size).toBe(1);
  });
  it('o quadrado não gira', () => {
    expect(rotate(with_('O'))).toBe(false);
  });
  it('girar encostado na parede empurra a peça para dentro', () => {
    const st = with_('I');
    st.piece!.y = 5;
    rotate(st); // em pé
    while (moveH(st, 1));
    expect(rotate(st)).toBe(true); // deita de novo sem sair da prateleira
    expect(Math.max(...st.piece!.cells.map((c) => st.piece!.x + c.x))).toBeLessThan(COLS);
  });
});

describe('queda e trava', () => {
  it('derrubar leva a peça até o chão e dá 2 pontos por linha', () => {
    const st = with_('O');
    const n = hardDrop(st);
    expect(n).toBe(ROWS - 2);
    expect(st.score).toBe(2 * (ROWS - 2));
    expect(landingY(st)).toBe(st.piece!.y);
  });
  it('a gravidade desce uma linha por intervalo do nível', () => {
    const st = with_('T');
    const y = st.piece!.y;
    st.fallLeft = fallInterval(1);
    gravity(st, fallInterval(1) - 1, false);
    expect(st.piece!.y).toBe(y);
    gravity(st, 1, false);
    expect(st.piece!.y).toBe(y + 1);
  });
  it('descida rápida ganha 1 ponto por linha', () => {
    const st = with_('T');
    gravity(st, 200, true);
    expect(st.score).toBeGreaterThanOrEqual(4);
  });
  it('apoiada, a peça espera antes de travar; mexer dá mais tempo, mas com limite', () => {
    const st = with_('T');
    hardDrop(st);
    expect(gravity(st, LOCK_DELAY_MS - 10, false).locked).toBeNull();
    moveH(st, 1);
    expect(gravity(st, LOCK_DELAY_MS - 10, false).locked).toBeNull();
    for (let i = 0; i < MAX_LOCK_RESETS + 5; i++) moveH(st, i % 2 ? 1 : -1);
    expect(gravity(st, LOCK_DELAY_MS, false).locked).not.toBeNull();
  });
});

describe('linhas', () => {
  it('linha completa some, o de cima desce, e pontua pelo nível', () => {
    const st = with_('I');
    for (let x = 0; x < COLS; x++) if (x < 3 || x > 6) st.board[ROWS - 1]![x] = 1;
    st.board[ROWS - 2]![0] = 5;
    hardDrop(st);
    const r = lock(st);
    expect(r.cleared).toEqual([ROWS - 1]);
    expect(r.gain).toBe(LINE_POINTS[1]);
    expect(st.lines).toBe(1);
    expect(st.board[ROWS - 1]![0]).toBe(5);
    expect(fullRows(st.board)).toEqual([]);
  });
  it('4 linhas de uma vez valem 800 e contam como quádrupla', () => {
    const st = with_('I');
    for (let y = ROWS - 4; y < ROWS; y++) for (let x = 0; x < COLS - 1; x++) st.board[y]![x] = 2;
    rotate(st); // em pé
    while (moveH(st, 1));
    hardDrop(st);
    const r = lock(st);
    expect(r.cleared).toHaveLength(4);
    expect(r.gain).toBe(800);
    expect(st.quads).toBe(1);
    expect(st.board.every((row) => row.every((v) => v === 0))).toBe(true);
  });
  it('nível sobe a cada 5 linhas e a queda acelera', () => {
    expect(levelFor(0)).toBe(1);
    expect(levelFor(5)).toBe(2);
    expect(levelFor(999)).toBe(10);
    for (let l = 2; l <= 10; l++) expect(fallInterval(l)).toBeLessThan(fallInterval(l - 1));
  });
});

describe('fim', () => {
  it('termina quando a próxima peça não cabe', () => {
    const st = with_('T');
    for (let y = 0; y < 2; y++) for (let x = 2; x < 8; x++) st.board[y]![x] = 3;
    expect(spawn(st, mulberry32(3))).toBe(false);
    expect(st.alive).toBe(false);
    expect(st.cause).toBe('overflow');
  });
});
