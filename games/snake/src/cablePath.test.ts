import { describe, expect, it } from 'vitest';
import { lerp, roundedPath } from './cablePath';

describe('roundedPath', () => {
  it('mantém as pontas e não gera valores inválidos', () => {
    const pts = [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 30 }, { x: 60, y: 30 }];
    const out = roundedPath(pts, 7);
    expect(out[0]).toEqual({ x: 0, y: 0 });
    expect(out[out.length - 1]).toEqual({ x: 60, y: 30 });
    for (const p of out) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });

  it('arredonda o canto: nenhum ponto cai exatamente no vértice', () => {
    const out = roundedPath([{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 30 }], 7);
    expect(out.some((p) => p.x === 30 && p.y === 0)).toBe(false);
  });

  it('aguenta segmentos de comprimento zero e linhas curtas', () => {
    expect(roundedPath([{ x: 1, y: 1 }], 7)).toEqual([{ x: 1, y: 1 }]);
    const out = roundedPath([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }], 7);
    expect(out.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
  });

  it('lerp interpola', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
  });
});

import { mixColor, pathLength, resample, splitPath } from './cablePath';

describe('medidas da linha', () => {
  const line = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];

  it('calcula o comprimento', () => {
    expect(pathLength(line)).toBe(20);
  });

  it('divide no comprimento pedido, mantendo o ponto de corte nos dois lados', () => {
    const { head, rest } = splitPath(line, 15);
    expect(head[head.length - 1]).toEqual({ x: 10, y: 5 });
    expect(rest[0]).toEqual({ x: 10, y: 5 });
    expect(pathLength(head) + pathLength(rest)).toBeCloseTo(20);
  });

  it('corte nos extremos', () => {
    expect(splitPath(line, 0).rest).toHaveLength(3);
    expect(splitPath(line, 99).rest).toHaveLength(1);
  });

  it('reamostra com espaçamento regular e mantém as pontas', () => {
    const pts = resample(line, 2);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[pts.length - 1]).toEqual({ x: 10, y: 10 });
    expect(pts.length).toBeGreaterThanOrEqual(10);
  });

  it('mistura cores', () => {
    expect(mixColor(0x000000, 0xffffff, 0)).toBe(0x000000);
    expect(mixColor(0x000000, 0xffffff, 1)).toBe(0xffffff);
    expect(mixColor(0x000000, 0xfefefe, 0.5)).toBe(0x7f7f7f);
  });
});

import { endDirection } from './cablePath';

describe('endDirection', () => {
  const line = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
  it('aponta para fora em cada ponta', () => {
    expect(endDirection(line, true)).toEqual({ x: 0, y: 1 });
    expect(endDirection(line, false)).toEqual({ x: -1, y: 0 });
  });
  it('ignora pontos repetidos e linhas curtas', () => {
    expect(endDirection([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 5, y: 0 }], false)).toEqual({ x: -1, y: 0 });
    expect(endDirection([{ x: 1, y: 1 }], true)).toBeNull();
    expect(endDirection([{ x: 1, y: 1 }, { x: 1, y: 1 }], true)).toBeNull();
  });
});

import { buildTrack, sampleTrack } from './cablePath';

describe('trilha (posições ao longo da linha)', () => {
  const t = buildTrack([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);

  it('mede o comprimento total', () => {
    expect(t.total).toBe(20);
  });

  it('acha o ponto e o ângulo a uma distância', () => {
    const a = sampleTrack(t, 5);
    expect(a.x).toBeCloseTo(5);
    expect(a.y).toBeCloseTo(0);
    expect(a.angle).toBeCloseTo(0);
    const b = sampleTrack(t, 15);
    expect(b.x).toBeCloseTo(10);
    expect(b.y).toBeCloseTo(5);
    expect(b.angle).toBeCloseTo(Math.PI / 2);
  });

  it('limita às pontas e aguenta pontos repetidos', () => {
    expect(sampleTrack(t, -5)).toMatchObject({ x: 0, y: 0 });
    expect(sampleTrack(t, 99)).toMatchObject({ x: 10, y: 10 });
    const dup = buildTrack([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 4, y: 0 }]);
    const s = sampleTrack(dup, 2);
    expect(s.x).toBeCloseTo(2);
    expect(Number.isFinite(s.angle)).toBe(true);
  });
});
