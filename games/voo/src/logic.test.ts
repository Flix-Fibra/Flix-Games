import { describe, expect, it } from 'vitest';
import {
  backgroundLayout, buildingTop, CENTER_MAX, CENTER_MIN, craneBottom, FLOOR_Y, flap, gapFor, GAP_MIN, GAP_START, makeWorld,
  MAX_SHIFT, nextCenter, obstacleRects, planeHits, PLANE_X, spawn, speedFor, SPEED_MAX, step,
} from './logic';
import { GAME_H } from './theme';
import { HITBOXES } from './hitboxes';

const seq = (...v: number[]) => {
  let i = 0;
  return () => v[i++ % v.length]!;
};

describe('física', () => {
  it('cai com a gravidade e o toque dá impulso para cima', () => {
    const w = makeWorld();
    const y0 = w.y;
    step(w, 1 / 60);
    step(w, 1 / 60);
    expect(w.y).toBeGreaterThan(y0);
    flap(w);
    step(w, 1 / 60);
    expect(w.vy).toBeLessThan(0);
  });
  it('bate no teto sem morrer e para de subir', () => {
    const w = makeWorld();
    w.obstacles = [];
    w.nextX = 5000;
    w.y = 10;
    w.vy = -900;
    step(w, 1 / 60);
    expect(w.vy).toBe(0);
    expect(planeHits(w)).toBe(false);
  });
  it('chão mata', () => {
    const w = makeWorld();
    w.y = FLOOR_Y;
    expect(planeHits(w)).toBe(true);
  });
});

describe('vãos', () => {
  it('o centro respeita a faixa e o deslocamento máximo', () => {
    for (let i = 0; i < 200; i++) {
      const prev = CENTER_MIN + Math.random() * (CENTER_MAX - CENTER_MIN);
      const c = nextCenter(prev, Math.random);
      expect(c).toBeGreaterThanOrEqual(CENTER_MIN);
      expect(c).toBeLessThanOrEqual(CENTER_MAX);
      expect(Math.abs(c - prev)).toBeLessThanOrEqual(MAX_SHIFT + 1);
    }
  });
  it('o prédio sempre alcança o chão e o guindaste sempre sai do teto, em qualquer par', () => {
    for (let i = 0; i < 5; i++)
      for (let j = 0; j < 5; j++)
        for (const c of [CENTER_MIN, CENTER_MAX])
          for (const gap of [GAP_MIN, GAP_START]) {
            const o = { x: 0, center: c, gap, predio: i, guindaste: j, passed: false };
            expect(buildingTop(o) + HITBOXES[`predio_${i}`]!.h).toBeGreaterThanOrEqual(GAME_H);
            expect(craneBottom(o) - HITBOXES[`guindaste_${j}`]!.h).toBeLessThanOrEqual(0);
          }
  });
  it('o vão fecha com a pontuação até o mínimo, e a velocidade sobe até o teto', () => {
    expect(gapFor(0)).toBe(GAP_START);
    expect(gapFor(1000)).toBe(GAP_MIN);
    expect(speedFor(1000)).toBe(SPEED_MAX);
  });
});

describe('colisão', () => {
  it('passa pelo meio do vão e bate no prédio e no guindaste', () => {
    const w = makeWorld(seq(0.5));
    const o = spawn(w);
    w.obstacles = [o];
    o.x = PLANE_X;
    w.y = o.center;
    expect(planeHits(w)).toBe(false);
    w.y = buildingTop(o) - 10;
    expect(planeHits(w)).toBe(true);
    w.y = craneBottom(o) + 10;
    expect(planeHits(w)).toBe(true);
  });
  it('obstáculo longe não colide', () => {
    const w = makeWorld(seq(0.5));
    const o = spawn(w);
    w.obstacles = [o];
    o.x = PLANE_X + 600;
    w.y = buildingTop(o) + 50;
    expect(planeHits(w)).toBe(false);
    expect(obstacleRects(o).length).toBeGreaterThan(10);
  });
});

describe('partida', () => {
  it('pontua ao passar um par e gera pares novos à frente', () => {
    const w = makeWorld(seq(0.5));
    let scored = 0;
    for (let i = 0; i < 60 * 12; i++) {
      const alvo = w.obstacles.find((o) => o.x > PLANE_X - 150);
      w.y = alvo ? alvo.center : 640; // voa reto pelo meio do vão
      w.vy = 0;
      const r = step(w, 1 / 60);
      expect(r.crashed).toBe(false);
      scored += r.scored;
    }
    expect(scored).toBeGreaterThan(2);
    expect(w.score).toBe(scored);
    expect(w.obstacles.length).toBeGreaterThan(1);
  });
});

describe('fundo espelhado', () => {
  it('alterna normal e espelhado em sequência sem emendas', () => {
    const L = backgroundLayout(0, 1000, 3);
    expect(L.map((p) => p.flip)).toEqual([false, true, false]);
    expect(L.map((p) => p.x)).toEqual([0, 1000, 2000]);
    const M = backgroundLayout(1250, 1000, 3);
    expect(M.map((p) => p.flip)).toEqual([true, false, true]);
    expect(M[0]!.x).toBe(-250);
    expect(M[1]!.x - M[0]!.x).toBe(1000);
  });
});
