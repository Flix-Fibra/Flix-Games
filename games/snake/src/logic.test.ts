import { describe, expect, it } from 'vitest';
import {
  BOOST_MS, COLS, FOOD_KINDS, MAPS, MAP_BARS, ROWS, START_LENGTH, createState, enqueueDir, freeCell, levelFor, mulberry32, nextFoodKind, step, tickMs, type GameState,
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
        expect(p.y >= 8 && p.y <= 12).toBe(false);
      }
    }
  });
});

describe('createState', () => {
  it('começa com o cabo inteiro, pontuação zero e item fora de obstáculos e do cabo', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = createState(mulberry32(seed));
      expect(s.snake).toHaveLength(START_LENGTH);
      expect(s.score).toBe(0);
      expect(s.eaten).toBe(0);
      expect(s.alive).toBe(true);
      expect(s.foodKind).toBeGreaterThanOrEqual(0);
      expect(s.foodKind).toBeLessThan(FOOD_KINDS);
      expect(s.obstacles.some((o) => o.x === s.food.x && o.y === s.food.y)).toBe(false);
      expect(s.snake.some((p) => p.x === s.food.x && p.y === s.food.y)).toBe(false);
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
    s.food = { x: 0, y: 0 };
    const head = s.snake[0]!;
    step(s, rng());
    expect(s.snake[0]).toEqual({ x: head.x + 1, y: head.y });
    expect(s.snake).toHaveLength(START_LENGTH);
  });

  it('cresce e pontua ao conectar o item, com o multiplicador do nível, e sorteia outro tipo', () => {
    const s = fresh();
    const head = s.snake[0]!;
    const kind = s.foodKind;
    s.food = { x: head.x + 1, y: head.y };
    step(s, rng());
    expect(s.snake).toHaveLength(START_LENGTH + 1);
    expect(s.eaten).toBe(1);
    expect(s.score).toBe(10);
    expect(s.lastEvent).toBe('item');
    expect(s.food).not.toEqual({ x: head.x + 1, y: head.y });
    expect(s.foodKind).not.toBe(kind);
  });

  it('atravessa a parede e surge do lado oposto, sem fim de jogo', () => {
    const right = fresh();
    right.food = { x: 0, y: 0 };
    right.snake = [{ x: COLS - 1, y: 8 }, { x: COLS - 2, y: 8 }, { x: COLS - 3, y: 8 }];
    step(right, rng());
    expect(right.alive).toBe(true);
    expect(right.snake[0]).toEqual({ x: 0, y: 8 });

    const left = fresh();
    left.food = { x: 5, y: 5 };
    left.snake = [{ x: 0, y: 8 }, { x: 1, y: 8 }, { x: 2, y: 8 }];
    left.dir = 'left';
    step(left, rng());
    expect(left.alive).toBe(true);
    expect(left.snake[0]).toEqual({ x: COLS - 1, y: 8 });

    const top = fresh();
    top.food = { x: 5, y: 5 };
    top.snake = [{ x: 4, y: 0 }, { x: 4, y: 1 }, { x: 4, y: 2 }];
    top.dir = 'up';
    step(top, rng());
    expect(top.snake[0]).toEqual({ x: 4, y: ROWS - 1 });

    const bottom = fresh();
    bottom.food = { x: 5, y: 5 };
    bottom.snake = [{ x: 4, y: ROWS - 1 }, { x: 4, y: ROWS - 2 }, { x: 4, y: ROWS - 3 }];
    bottom.dir = 'down';
    step(bottom, rng());
    expect(bottom.snake[0]).toEqual({ x: 4, y: 0 });
  });

  it('conecta o item do outro lado da borda e ainda bate no obstáculo que estiver lá', () => {
    const s = fresh();
    s.snake = [{ x: COLS - 1, y: 8 }, { x: COLS - 2, y: 8 }, { x: COLS - 3, y: 8 }];
    s.food = { x: 0, y: 8 };
    step(s, rng());
    expect(s.eaten).toBe(1);

    const o = fresh();
    o.food = { x: 5, y: 5 };
    o.snake = [{ x: COLS - 1, y: 8 }, { x: COLS - 2, y: 8 }, { x: COLS - 3, y: 8 }];
    o.obstacles = [{ x: 0, y: 8 }];
    step(o, rng());
    expect(o.cause).toBe('obstacle');
  });

  it('morre no obstáculo', () => {
    const s = fresh();
    const head = s.snake[0]!;
    s.food = { x: 0, y: 0 };
    s.obstacles = [{ x: head.x + 1, y: head.y }];
    step(s, rng());
    expect(s.cause).toBe('obstacle');
    expect(s.alive).toBe(false);
  });

  it('morre ao bater em si mesmo', () => {
    const s = fresh();
    s.food = { x: 0, y: 0 };
    s.snake = [
      { x: 5, y: 5 }, { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 7, y: 6 }, { x: 7, y: 5 }, { x: 7, y: 4 }, { x: 6, y: 4 }, { x: 5, y: 4 },
    ];
    s.dir = 'up';
    s.queue = ['right'];
    step(s, rng());
    s.queue = ['down'];
    step(s, rng());
    expect(s.alive).toBe(false);
    expect(s.cause).toBe('self');
  });

  it('seguir a própria ponta não conta como batida', () => {
    const s = fresh();
    s.food = { x: 0, y: 0 };
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

describe('itens de pontuação', () => {
  it('o tipo sorteado nunca repete o anterior e fica dentro da faixa', () => {
    const r = mulberry32(7);
    for (let prev = 0; prev < FOOD_KINDS; prev++) {
      for (let i = 0; i < 200; i++) {
        const k = nextFoodKind(prev, r);
        expect(k).not.toBe(prev);
        expect(k).toBeGreaterThanOrEqual(0);
        expect(k).toBeLessThan(FOOD_KINDS);
      }
    }
  });

  it('todos os tipos aparecem ao longo de uma partida', () => {
    const r = mulberry32(99);
    const seen = new Set<number>();
    let k = 0;
    for (let i = 0; i < 200; i++) {
      k = nextFoodKind(k, r);
      seen.add(k);
    }
    expect(seen.size).toBe(FOOD_KINDS);
  });
});

describe('dificuldade', () => {
  it('o nível sobe a cada 3 itens e tem teto', () => {
    expect(levelFor(0)).toBe(1);
    expect(levelFor(2)).toBe(1);
    expect(levelFor(3)).toBe(2);
    expect(levelFor(1000)).toBe(10);
  });

  it('o intervalo entre passos diminui até um mínimo', () => {
    expect(tickMs(1)).toBe(200);
    expect(tickMs(2)).toBeLessThan(tickMs(1));
    expect(tickMs(10)).toBeGreaterThanOrEqual(85);
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
      expect(c.x === s.food.x && c.y === s.food.y).toBe(false);
    }
  });
});

describe('muros (cercas)', () => {
  it('cada trecho tem 3 ou 4 casas, cabe na grade e bate com as células dos mapas', () => {
    MAP_BARS.forEach((bars, i) => {
      const cells = new Set<string>();
      for (const b of bars) {
        expect([3, 4]).toContain(b.len);
        const endX = b.x + (b.vertical ? 0 : b.len - 1);
        const endY = b.y + (b.vertical ? b.len - 1 : 0);
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(endX).toBeLessThan(COLS);
        expect(endY).toBeLessThan(ROWS);
        for (let k = 0; k < b.len; k++) {
          const key = b.vertical ? `${b.x},${b.y + k}` : `${b.x + k},${b.y}`;
          expect(cells.has(key)).toBe(false); // trechos não se sobrepõem
          cells.add(key);
        }
      }
      expect(cells.size).toBe(MAPS[i]!.length);
    });
  });

  it('o estado guarda os trechos do mapa sorteado', () => {
    const s = createState(mulberry32(5));
    expect(s.walls.length).toBeGreaterThan(0);
    const fromWalls = s.walls.reduce((n, b) => n + b.len, 0);
    expect(fromWalls).toBe(s.obstacles.length);
  });
});

describe('globo de ponto extra', () => {
  it('pegar o globo liga o modo de ponto extra por alguns segundos', () => {
    const s = fresh();
    const head = s.snake[0]!;
    s.food = { x: 0, y: 0 };
    s.signal = { x: head.x + 1, y: head.y };
    s.signalLeft = 30;
    step(s, rng());
    expect(s.signal).toBeNull();
    expect(s.boostLeft).toBeGreaterThan(0);
    expect(s.boostLeft * tickMs(1)).toBeGreaterThanOrEqual(BOOST_MS);
    expect(s.lastEvent).toBe('signal');
    expect(s.eaten).toBe(0); // o globo não é comida: não faz o cabo crescer nem conta como item
    expect(s.snake).toHaveLength(START_LENGTH);
  });

  it('com o ponto extra ligado, os itens valem o dobro', () => {
    const s = fresh();
    const head = s.snake[0]!;
    s.boostLeft = 10;
    s.food = { x: head.x + 1, y: head.y };
    step(s, rng());
    expect(s.score).toBe(20);
  });

  it('o modo acaba depois de alguns passos', () => {
    const s = fresh();
    s.food = { x: 0, y: 0 };
    s.boostLeft = 2;
    step(s, rng());
    step(s, rng());
    expect(s.boostLeft).toBe(0);
  });

  it('o globo some sozinho se ninguém pegar', () => {
    const s = fresh();
    s.food = { x: 0, y: 0 };
    s.signal = { x: 0, y: 15 };
    s.signalLeft = 1;
    step(s, rng());
    expect(s.signal).toBeNull();
  });

  it('aparece só de vez em quando e nunca em cima de obstáculo, do cabo ou do item', () => {
    let spawned = 0;
    const total = 400;
    for (let i = 0; i < total; i++) {
      const s = createState(mulberry32(i + 1000));
      const head = s.snake[0]!;
      s.food = { x: head.x + 1, y: head.y };
      step(s, mulberry32(i));
      if (s.signal) {
        spawned++;
        expect(s.snake.some((c) => c.x === s.signal!.x && c.y === s.signal!.y)).toBe(false);
        expect(s.obstacles.some((c) => c.x === s.signal!.x && c.y === s.signal!.y)).toBe(false);
        expect(s.signal.x === s.food.x && s.signal.y === s.food.y).toBe(false);
      }
    }
    expect(spawned).toBeGreaterThan(total * 0.1);
    expect(spawned).toBeLessThan(total * 0.4);
  });

  it('não aparece outro globo durante o ponto extra', () => {
    for (let i = 0; i < 100; i++) {
      const s = createState(mulberry32(i + 1));
      const head = s.snake[0]!;
      s.boostLeft = 20;
      s.food = { x: head.x + 1, y: head.y };
      step(s, mulberry32(i));
      expect(s.signal).toBeNull();
    }
  });
});

describe('ponto extra atravessa muros', () => {
  it('com bônus o cabo passa pelo muro; sem bônus morre', () => {
    const mk = () => {
      const s = createState(mulberry32(1));
      s.snake = Array.from({ length: 4 }, (_, i) => ({ x: 4 - i, y: 10 }));
      s.dir = 'right';
      s.obstacles = [{ x: 5, y: 10 }];
      s.food = { x: 0, y: 0 };
      return s;
    };
    const ghost = mk();
    ghost.boostLeft = 5;
    step(ghost, mulberry32(2));
    expect(ghost.alive).toBe(true);
    expect(ghost.snake[0]).toEqual({ x: 5, y: 10 });
    const normal = mk();
    step(normal, mulberry32(2));
    expect(normal.alive).toBe(false);
    expect(normal.cause).toBe('obstacle');
  });
});
