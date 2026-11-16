import { describe, expect, it } from 'vitest';
import { LOGO_SIZE, buildRj45Logo, terrain } from './logoArt';
import { PLUG_COLORS } from '@flix/game-kit';
import { CABLE_BLUE_PALETTE } from './theme';

const at = (g: number[], x: number, y: number) => g[y * LOGO_SIZE + x]!;

describe('emblema do fim de partida', () => {
  const g = buildRj45Logo(CABLE_BLUE_PALETTE);

  it('tem o tamanho esperado, cantos transparentes e centro preenchido', () => {
    expect(g).toHaveLength(LOGO_SIZE * LOGO_SIZE);
    expect(at(g, 0, 0)).toBe(-1);
    expect(at(g, LOGO_SIZE - 1, LOGO_SIZE - 1)).toBe(-1);
    expect(at(g, 48, 48)).toBeGreaterThanOrEqual(0);
  });

  it('desenha a esfera, o cabo azul e o conector com 8 contatos, plaquinha e frisos', () => {
    expect(g.includes(0x5da8f5)).toBe(true); // esfera: faixa clara
    expect(g.includes(CABLE_BLUE_PALETTE.main)).toBe(true);
    expect(g.filter((c) => c === PLUG_COLORS.goldLight).length).toBeGreaterThanOrEqual(8 * 2);
    expect(g.includes(PLUG_COLORS.plate)).toBe(true);
    expect(g.includes(PLUG_COLORS.ridge)).toBe(true);
  });

  it('o cabo cortado mostra os quatro pares trançados e a espuma de alumínio', () => {
    for (const c of [0xf08a24, 0x2e9e5b, 0x7b4a2b, 0xf4f4f4, 0xdbe3ec]) expect(g.includes(c)).toBe(true);
  });

  it('o planeta tem oceano e continentes', () => {
    expect(g.includes(0x46a047)).toBe(true); // floresta
    expect(g.includes(0x2f7be0)).toBe(true); // oceano
  });

  it('o terreno é determinístico e tem terra e mar', () => {
    expect(terrain(0.3, -0.1)).toBe(terrain(0.3, -0.1));
    const values: number[] = [];
    for (let lon = -1.5; lon <= 1.5; lon += 0.1) for (let lat = -1.2; lat <= 1.2; lat += 0.1) values.push(terrain(lon, lat));
    expect(values.some((v) => v > 0.2)).toBe(true);
    expect(values.some((v) => v < 0.2)).toBe(true);
  });

  it('todas as cores são válidas (0xRRGGBB ou transparente)', () => {
    for (const c of g) expect(c === -1 || (c >= 0 && c <= 0xffffff)).toBe(true);
  });
});
