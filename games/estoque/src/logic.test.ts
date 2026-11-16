import { describe, expect, it } from 'vitest';
import {
  COLS, ROWS, SHAPES, collides, createState, emptyBoard, groupPoints, fall, fallInterval, findGroups, gravity, hardDrop, landingY, levelFor, lock,
  makePiece, moveH, mulberry32, pieceHeight, pieceWidth, rotate, spawn, typesFor, type GameState, type Piece,
} from './logic';

function fresh(cells: Array<[number, number, number]>, x = 3, y = 0): GameState {
  const st = createState(mulberry32(1));
  st.board = emptyBoard();
  const piece: Piece = { shape: 't', cells: cells.map(([cx, cy, item]) => ({ x: cx, y: cy, item })), x, y };
  st.piece = piece;
  return st;
}

describe('peças', () => {
  it('são de um item só, sorteado entre os tipos em jogo', () => {
    const rng = mulberry32(5);
    for (let i = 0; i < 300; i++) {
      const p = makePiece(rng, 4);
      expect(p.cells).toHaveLength(1);
      expect(p.cells.every((c) => c.item >= 1 && c.item <= 4)).toBe(true);
      expect(p.x + pieceWidth(p)).toBeLessThanOrEqual(COLS);
    }
    expect(new Set(SHAPES.map((s) => s.id)).size).toBe(SHAPES.length);
  });
  it('nascem centralizadas no topo', () => {
    const st = createState(mulberry32(2));
    expect(st.piece!.y).toBe(0);
    expect(collides(st.board, st.piece!)).toBe(false);
  });
});

describe('movimento', () => {
  it('anda para os lados e para na parede', () => {
    const st = fresh([[0, 0, 1]], 0);
    expect(moveH(st, -1)).toBe(false);
    expect(moveH(st, 1)).toBe(true);
    st.piece!.x = COLS - 1;
    expect(moveH(st, 1)).toBe(false);
  });
  it('não atravessa itens', () => {
    const st = fresh([[0, 0, 1]], 2, 5);
    st.board[5]![3] = 2;
    expect(moveH(st, 1)).toBe(false);
    expect(moveH(st, -1)).toBe(true);
  });
  it('desce até o chão e depois não desce mais', () => {
    const st = fresh([[0, 0, 1]], 3, 0);
    expect(hardDrop(st)).toBe(ROWS - 1);
    expect(fall(st)).toBe(false);
    expect(landingY(st)).toBe(ROWS - 1);
  });
  it('a sombra de aterrissagem considera os itens embaixo', () => {
    const st = fresh([[0, 0, 1], [0, 1, 2]], 3, 0);
    st.board[8]![3] = 4;
    expect(landingY(st)).toBe(6);
  });
  it('gira mantendo cada item preso à sua posição e cabendo na parede', () => {
    const st = fresh([[0, 0, 1], [0, 1, 2], [0, 2, 3]], COLS - 1, 0);
    expect(rotate(st)).toBe(true);
    const p = st.piece!;
    expect(pieceWidth(p)).toBe(3);
    expect(pieceHeight(p)).toBe(1);
    expect(p.x + pieceWidth(p)).toBeLessThanOrEqual(COLS);
    expect(p.cells.map((c) => c.item).sort()).toEqual([1, 2, 3]);
    // quatro giros voltam ao começo
    rotate(st);
    rotate(st);
    rotate(st);
    expect(pieceHeight(st.piece!)).toBe(3);
  });
  it('um item só não gira; girar sem espaço falha', () => {
    expect(rotate(fresh([[0, 0, 1]]))).toBe(false);
    const st = fresh([[0, 0, 1], [0, 1, 2], [0, 2, 3]], 0, 0);
    for (let x = 1; x < COLS; x++) st.board[0]![x] = 5; // a linha de cima fica tomada: deitar a peça não cabe
    expect(rotate(st)).toBe(false);
  });
});

describe('grupos', () => {
  it('2 iguais não contam, 3 ligados contam (inclusive em L)', () => {
    const b = emptyBoard();
    b[10]![0] = 1;
    b[10]![1] = 1;
    expect(findGroups(b)).toHaveLength(0);
    b[9]![1] = 1;
    const g = findGroups(b);
    expect(g).toHaveLength(1);
    expect(g[0]).toHaveLength(3);
  });
  it('diagonal não liga e itens diferentes não se misturam', () => {
    const b = emptyBoard();
    b[10]![0] = 1;
    b[9]![1] = 1;
    b[8]![2] = 1;
    b[10]![1] = 2;
    expect(findGroups(b)).toHaveLength(0);
  });
});

describe('guardar e reação em cadeia', () => {
  it('trava, guarda o grupo e pontua', () => {
    const st = fresh([[0, 0, 1]], 2, 0);
    st.board[10]![0] = 1;
    st.board[10]![1] = 1;
    hardDrop(st);
    const r = lock(st);
    expect(r.steps).toHaveLength(1);
    expect(r.stored).toBe(3);
    expect(st.stored).toBe(3);
    expect(st.score).toBe(30);
    expect(st.board[10]!.every((v) => v === 0)).toBe(true);
    expect(st.piece).toBeNull();
  });
  it('grupo maior vale muito mais (5 de uma vez = 150)', () => {
    const st = fresh([[0, 0, 1]], 3, 0);
    for (const x of [0, 1, 2, 4]) st.board[10]![x] = 1;
    hardDrop(st);
    lock(st);
    expect(st.score).toBe(150);
    expect(groupPoints(4)).toBe(80);
    expect(groupPoints(6)).toBe(240);
  });
  it('os itens de cima descem e formam uma nova cadeia (valor dobrado)', () => {
    const st = fresh([[0, 0, 2], [0, 1, 1]], 0, 0); // peça de 2 itens: um 2 sobre um 1
    st.board[10]![0] = 1;
    st.board[9]![0] = 1;
    st.board[10]![1] = 2;
    st.board[9]![1] = 2;
    hardDrop(st);
    expect(st.piece!.y).toBe(7);
    const r = lock(st);
    // 1) os três 1 da coluna 0 são guardados; 2) o 2 solto desce, encosta nos 2 da coluna 1 e forma um grupo de 3
    expect(r.steps).toHaveLength(2);
    expect(r.steps[0]!.falls).toEqual([{ x: 0, fromY: 7, toY: 10, item: 2 }]);
    expect(r.steps[1]!.chain).toBe(2);
    expect(st.bestChain).toBe(2);
    expect(st.score).toBe(30 + 3 * 10 * 2);
    expect(st.stored).toBe(6);
    expect(st.board.every((row) => row.every((v) => v === 0))).toBe(true);
  });
  it('subir de nível aparece no resultado', () => {
    const st = fresh([[0, 0, 1]], 2, 0);
    st.stored = 10;
    st.board[10]![0] = 1;
    st.board[10]![1] = 1;
    hardDrop(st);
    expect(lock(st).levelUp).toBe(true);
    expect(levelFor(st.stored)).toBe(2);
  });
});

describe('queda, progressão e fim', () => {
  it('a peça só desce quando o relógio zera e trava no fundo', () => {
    const st = fresh([[0, 0, 1]], 3, ROWS - 1);
    st.fallLeft = 500;
    expect(gravity(st, 400, false).moved).toBe(false);
    const r = gravity(st, 200, false);
    expect(r.locked).not.toBeNull();
    expect(st.piece).toBeNull();
    expect(st.board[ROWS - 1]![3]).toBe(1);
  });
  it('queda acelera com os itens guardados e tem mínimo; queda rápida é mais curta', () => {
    expect(fallInterval(0)).toBe(550);
    expect(fallInterval(20)).toBeLessThan(fallInterval(10));
    expect(fallInterval(9999)).toBe(150);
    const st = fresh([[0, 0, 1]], 3, 0);
    st.fallLeft = 0;
    gravity(st, 1, true);
    expect(st.fallLeft).toBeLessThan(fallInterval(0));
  });
  it('mais variedade de item a partir do nível 3', () => {
    expect(typesFor(0)).toBe(4);
    expect(typesFor(24)).toBe(5);
  });
  it('termina quando a próxima peça não tem onde entrar', () => {
    const st = createState(mulberry32(3));
    st.piece = null;
    for (let y = 0; y < 3; y++) for (let x = 0; x < COLS; x++) st.board[y]![x] = 1 + ((x + y * 2) % 4);
    expect(spawn(st, mulberry32(4))).toBe(false);
    expect(st.alive).toBe(false);
    expect(st.cause).toBe('overflow');
  });
  it('um jogador que solta tudo no mesmo lugar termina e a pontuação é inteira', () => {
    const rng = mulberry32(99);
    const st = createState(rng);
    let guard = 0;
    while (st.alive && guard++ < 5000) {
      hardDrop(st);
      lock(st);
      spawn(st, rng);
    }
    expect(st.alive).toBe(false);
    expect(Number.isInteger(st.score)).toBe(true);
  });
  it('um jogador que espalha as peças guarda itens', () => {
    const rng = mulberry32(7);
    const st = createState(rng);
    let guard = 0;
    while (st.alive && guard++ < 400) {
      const p = st.piece!;
      let best = 0;
      let bestScore = -1;
      for (let x = 0; x <= COLS - pieceWidth(p); x++) {
        const test = { ...p, x };
        let dy = 0;
        while (!collides(st.board, test, 0, dy + 1)) dy++;
        const score = dy + (x % 2);
        if (score > bestScore) {
          bestScore = score;
          best = x;
        }
      }
      p.x = best;
      hardDrop(st);
      lock(st);
      spawn(st, rng);
    }
    expect(st.stored).toBeGreaterThan(0);
  });
});
