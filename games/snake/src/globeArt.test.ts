import { describe, expect, it } from 'vitest';
import { GLOBE_SIZE, buildGlobe } from './globeArt';

describe('ícone do globo (sinal)', () => {
  const s = buildGlobe();

  it('tem 15x15, cantos transparentes e centro preenchido', () => {
    expect(s.w).toBe(GLOBE_SIZE);
    expect(s.h).toBe(GLOBE_SIZE);
    expect(s.cells).toHaveLength(GLOBE_SIZE * GLOBE_SIZE);
    expect(s.cells[0]).toBe(-1);
    expect(s.cells[7 * GLOBE_SIZE + 7]).toBeGreaterThanOrEqual(0);
  });

  it('tem contorno escuro e as quatro faixas de azul', () => {
    for (const c of [0x0a1020, 0x6fe8ee, 0x3fb4ea, 0x2f86d6, 0x2a52a8]) expect(s.cells.includes(c)).toBe(true);
  });

  it('é simétrico na horizontal', () => {
    for (let y = 0; y < GLOBE_SIZE; y++) {
      for (let x = 0; x < GLOBE_SIZE; x++) {
        expect(s.cells[y * GLOBE_SIZE + x]).toBe(s.cells[y * GLOBE_SIZE + (GLOBE_SIZE - 1 - x)]);
      }
    }
  });
});
