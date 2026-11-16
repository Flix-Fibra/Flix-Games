import { describe, expect, it } from 'vitest';
import {
  COLS, MAPS, ROWS, createState, enqueueDir, freeCell, levelFor, mulberry32, step, tickMs, type GameState,
} from './logic';

const rng = () => mulberry32(42);

function fresh(): GameState {
  const s = createState(rng());
  s.obstacles = [];
  s.signal = null;
  return s;
}

describe('mapas', () => {
  it('ficam dentro da grade e nunca bloqueiam o começo do cabo', () => {
    for (const map of MAPS) {
      for (const p of map) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThan(COLS);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThan(ROWS);
        expect(p.y >= 11 && p.y <= 15).toBe(false);
      }
    }
  });
});

describe('createState', () => {
  it('começa com 3 segmentos, pontuação zero e casa fora de obstáculos e do cabo', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = createState(mulberry32(seed));
      expect(s.snake).toHaveLength(3);
      expect(s.score).toBe(0);
      expect(s.alive).toBe(true);
      expect(s.obstacles.some((o) => o.x === s.house.x && o.y === s.house.y)).toBe(false);
      expect(s.snake.some((p) => p.x === s.house.x && p.y === s.house.y)).toBe(false);
    }
  });
});

describe('curvas', () => {
  it('ignora a direção oposta e repetições', () => {
    const s = fresh();
    expect(enqueueDir(s, 'left')).toBe(false);
    expect(enqueueDir(s, 'right')).toBe(false);
    expect(enqueueDir(s, 'up')).toBe(true);
    expect(enqueueDir(s, 'down')).toBe(false); // oposta à última da fila
  });

  it('guarda no máximo 2 curvas', () => {
    const s = fresh();
    expect(enqueueDir(s, 'up')).toBe(true);
    expect(enqueueDir(s, 'left')).toBe(true);
    expect(enqueueDir(s, 'down')).toBe(false);
    expect(s.queue).toHaveLength(2);
  });
});

describe('step', () => {
  it('move o cabo uma casa sem mudar o tamanho', () => {
    const s = fresh();
    s.house = { x: 0, y: 0 };
    const head = s.snake[0]!;
    step(s, rng());
    expect(s.snake[0]).toEqual({ x: head.x + 1, y: head.y });
    expect(s.snake).toHaveLength(3);
  });

  it('cresce e pontua ao conectar uma casa, com multiplicador do nível', () => {
    const s = fresh();
    const head = s.snake[0]!;
    s.house = { x: head.x + 1, y: head.y };
    step(s, rng());
    expect(s.snake).toHaveLength(4);
    expect(s.houses).toBe(1);
    expect(s.score).toBe(10);
    expect(s.lastEvent).toBe('house');
    expect(s.house).not.toEqual({ x: head.x + 1, y: head.y });
  });

  it('o sinal dobra os pontos enquanto o bônus durar', () => {
    const s = fresh();
    const head = s.snake[0]!;
    s.boostLeft = 10;
    s.house = { x: head.x + 1, y: head.y };
    step(s, rng());
    expect(s.score).toBe(20);
  });

  it('pegar o sinal liga o bônus', () => {
    const s = fresh();
    const head = s.snake[0]!;
    s.house = { x: 0, y: 0 };
    s.signal = { x: head.x + 1, y: head.y };
    s.signalLeft = 30;
    step(s, rng());
    expect(s.signal).toBeNull();
    expect(s.boostLeft).toBeGreaterThan(0);
    expect(s.lastEvent).toBe('signal');
  });

  it('atravessa a parede e surge do lado oposto, sem fim de jogo', () => {
    const right = fresh();
    right.house = { x: 0, y: 0 };
    right.snake = [{ x: COLS - 1, y: 13 }, { x: COLS - 2, y: 13 }, { x: COLS - 3, y: 13 }];
    step(right, rng());
    expect(right.alive).toBe(true);
    expect(right.snake[0]).toEqual({ x: 0, y: 13 });

    const left = fresh();
    left.house = { x: 5, y: 5 };
    left.snake = [{ x: 0, y: 13 }, { x: 1, y: 13 }, { x: 2, y: 13 }];
    left.dir = 'left';
    step(left, rng());
    expect(left.alive).toBe(true);
    expect(left.snake[0]).toEqual({ x: COLS - 1, y: 13 });

    const top = fresh();
    top.house = { x: 5, y: 5 };
    top.snake = [{ x: 9, y: 0 }, { x: 9, y: 1 }, { x: 9, y: 2 }];
    top.dir = 'up';
    step(top, rng());
    expect(top.snake[0]).toEqual({ x: 9, y: ROWS - 1 });

    const bottom = fresh();
    bottom.house = { x: 5, y: 5 };
    bottom.snake = [{ x: 9, y: ROWS - 1 }, { x: 9, y: ROWS - 2 }, { x: 9, y: ROWS - 3 }];
    bottom.dir = 'down';
    step(bottom, rng());
    expect(bottom.snake[0]).toEqual({ x: 9, y: 0 });
  });

  it('conecta a casa do outro lado da borda e ainda bate no obstáculo que estiver lá', () => {
    const s = fresh();
    s.snake = [{ x: COLS - 1, y: 13 }, { x: COLS - 2, y: 13 }, { x: COLS - 3, y: 13 }];
    s.house = { x: 0, y: 13 };
    step(s, rng());
    expect(s.houses).toBe(1);

    const o = fresh();
    o.house = { x: 5, y: 5 };
    o.snake = [{ x: COLS - 1, y: 13 }, { x: COLS - 2, y: 13 }, { x: COLS - 3, y: 13 }];
    o.obstacles = [{ x: 0, y: 13 }];
    step(o, rng());
    expect(o.cause).toBe('obstacle');
  });

  it('morre no obstáculo', () => {
    const s = fresh();
    const head = s.snake[0]!;
    s.house = { x: 0, y: 0 };
    s.obstacles = [{ x: head.x + 1, y: head.y }];
    step(s, rng());
    expect(s.cause).toBe('obstacle');
  });

  it('morre ao bater em si mesmo', () => {
    const s = fresh();
    s.house = { x: 0, y: 0 };
    s.snake = [
      { x: 5, y: 5 }, { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 7, y: 6 }, { x: 7, y: 5 }, { x: 7, y: 4 }, { x: 6, y: 4 }, { x: 5, y: 4 },
    ];
    s.dir = 'up';
    s.queue = ['right'];
    // vai para (6,5) e depois... (6,5) está livre; força a batida indo para baixo em seguida
    step(s, rng());
    s.queue = ['down'];
    step(s, rng());
    expect(s.alive).toBe(false);
    expect(s.cause).toBe('self');
  });

  it('seguir a própria ponta não conta como batida', () => {
    const s = fresh();
    s.house = { x: 0, y: 0 };
    s.snake = [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 6 }, { x: 5, y: 6 }];
    s.dir = 'down';
    step(s, rng());
    expect(s.alive).toBe(true);
  });

  it('não faz nada depois da derrota', () => {
    const s = fresh();
    s.alive = false;
    const before = JSON.stringify(s.snake);
    step(s, rng());
    expect(JSON.stringify(s.snake)).toBe(before);
  });
});

describe('dificuldade', () => {
  it('o nível sobe a cada 3 casas e tem teto', () => {
    expect(levelFor(0)).toBe(1);
    expect(levelFor(2)).toBe(1);
    expect(levelFor(3)).toBe(2);
    expect(levelFor(1000)).toBe(10);
  });

  it('o intervalo entre passos diminui até um mínimo', () => {
    expect(tickMs(1)).toBe(170);
    expect(tickMs(2)).toBeLessThan(tickMs(1));
    expect(tickMs(10)).toBeGreaterThanOrEqual(70);
  });
});

describe('freeCell', () => {
  it('nunca devolve uma célula ocupada', () => {
    const s = fresh();
    s.obstacles = MAPS[0]!.map((p) => ({ ...p }));
    for (let i = 0; i < 200; i++) {
      const c = freeCell(s, mulberry32(i))!;
      expect(s.snake.some((p) => p.x === c.x && p.y === c.y)).toBe(false);
      expect(s.obstacles.some((p) => p.x === c.x && p.y === c.y)).toBe(false);
    }
  });
});
