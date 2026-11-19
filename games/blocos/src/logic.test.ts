import { describe, expect, it } from 'vitest';
import {
  ballSpeed, brickHp, brickRect, BRICK_W, circleRect, COLS, FIELD_L, FIELD_R, keepAngle, LEVELS, levelAt, MAX_BOUNCE_DEG,
  paddleBounce, parseLevel, reflect, rollDrop, rotate, timeBonus,
} from './logic';

describe('fases', () => {
  it('todas têm 10 colunas e algo para quebrar (ou chefão)', () => {
    for (const def of LEVELS) {
      for (const row of def.rows) expect(row).toHaveLength(COLS);
      const bricks = parseLevel(def);
      expect(def.boss || bricks.some((b) => b.kind !== 'x')).toBe(true);
    }
  });

  it('a cada 5 fases tem chefão', () => {
    expect(LEVELS[4]!.boss).toBe(true);
    expect(LEVELS[9]!.boss).toBe(true);
    expect(LEVELS.filter((l) => l.boss)).toHaveLength(2);
  });

  it('lê os tipos de bloco', () => {
    const b = parseLevel({ rows: ['1.S.T.X..5'] });
    expect(b.map((x) => x.kind)).toEqual(['n', 's', 't', 'x', 'n']);
    expect(b[4]!.color).toBe(4);
    expect([brickHp('n'), brickHp('s'), brickHp('t'), brickHp('x')]).toEqual([1, 2, 3, Infinity]);
  });

  it('depois da última fase repete num ciclo mais difícil', () => {
    expect(levelAt(1).cycle).toBe(0);
    expect(levelAt(LEVELS.length + 1)).toEqual({ def: LEVELS[0], cycle: 1 });
  });

  it('a grade cabe exatamente no campo', () => {
    const last = brickRect(COLS - 1, 0);
    expect(brickRect(0, 0).x).toBe(FIELD_L);
    expect(last.x + BRICK_W).toBeCloseTo(FIELD_R);
  });
});

describe('bola', () => {
  it('no centro da raquete sobe reto; nas pontas sai no ângulo máximo', () => {
    const c = paddleBounce(0, 600);
    expect(c.vx).toBeCloseTo(0);
    expect(c.vy).toBeCloseTo(-600);
    const r = paddleBounce(1, 600);
    expect((Math.atan2(r.vx, -r.vy) * 180) / Math.PI).toBeCloseTo(MAX_BOUNCE_DEG);
    expect(paddleBounce(5, 600)).toEqual(paddleBounce(1, 600));
  });

  it('a velocidade sobe com a fase, com teto', () => {
    expect(ballSpeed(2, 0)).toBeGreaterThan(ballSpeed(1, 0));
    expect(ballSpeed(100, 1000)).toBe(1040 + 120);
  });

  it('colisão com retângulo dá a normal do lado certo', () => {
    const rc = { x: 0, y: 0, w: 100, h: 20 };
    expect(circleRect(50, 28, 10, rc)).toMatchObject({ nx: 0, ny: 1 });
    expect(circleRect(50, -8, 10, rc)).toMatchObject({ nx: 0, ny: -1 });
    expect(circleRect(-5, 10, 10, rc)).toMatchObject({ nx: -1, ny: 0 });
    expect(circleRect(50, 40, 10, rc)).toBeNull();
    expect(circleRect(50, 5, 10, rc)).toMatchObject({ nx: 0, ny: -1 }); // centro dentro, sai pelo lado mais próximo
  });

  it('reflete só quando vai contra a normal', () => {
    expect(reflect(100, -200, 0, 1)).toEqual({ vx: 100, vy: 200 });
    expect(reflect(100, 200, 0, 1)).toEqual({ vx: 100, vy: 200 });
  });

  it('não deixa a bola quase na horizontal e mantém a velocidade', () => {
    const k = keepAngle(500, -10);
    expect(Math.abs(k.vy)).toBeCloseTo(Math.hypot(500, 10) * 0.25);
    expect(Math.hypot(k.vx, k.vy)).toBeCloseTo(Math.hypot(500, 10));
    expect(k.vy).toBeLessThan(0);
  });

  it('girar mantém a velocidade', () => {
    const v = rotate(0, -600, 25);
    expect(Math.hypot(v.vx, v.vy)).toBeCloseTo(600);
    expect(v.vx).toBeGreaterThan(0);
  });
});

describe('bônus', () => {
  it('sorteia bônus, moeda ou nada', () => {
    const seq = (...v: number[]) => () => v.shift()!;
    expect(rollDrop(seq(0.01, 0))).toBe('multi');
    expect(rollDrop(seq(0.01, 0.99))).toBe('magnet');
    expect(rollDrop(seq(0.2))).toBe('coin');
    expect(rollDrop(seq(0.9))).toBeNull();
  });

  it('bônus de tempo só abaixo de 90 s', () => {
    expect(timeBonus(30000)).toBe(60 * 20);
    expect(timeBonus(120000)).toBe(0);
  });
});
