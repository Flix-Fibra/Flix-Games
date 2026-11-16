import type { Sprite } from './plugArt';

/**
 * Ícone do "sinal" (bônus que dobra os pontos): um globo azul em pixel art, com contorno, equador e meridianos escuros
 * e faixas que vão do ciano claro (em cima) ao azul escuro (embaixo). Desenhado por código, 15x15 px.
 */
export const GLOBE_SIZE = 15;
const LINE = 0x0a1020;
const BANDS = [0x6fe8ee, 0x3fb4ea, 0x2f86d6, 0x2a52a8]; // de cima para baixo

export function buildGlobe(): Sprite {
  const N = GLOBE_SIZE;
  const c = (N - 1) / 2;
  const cells = new Array<number>(N * N).fill(-1);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx = x - c;
      const dy = y - c;
      const d = Math.hypot(dx, dy);
      if (d > c + 0.6) continue;
      if (d > c - 0.45) {
        cells[y * N + x] = LINE; // contorno
        continue;
      }
      // equador (linha horizontal no meio)
      if (y === 7) {
        cells[y * N + x] = LINE;
        continue;
      }
      // meridianos: um central e dois curvos que se fecham perto dos polos
      const bulge = Math.sqrt(Math.max(0, 1 - (dy / c) ** 2)) * 3.6;
      if (Math.abs(dx) < 0.6 || Math.abs(Math.abs(dx) - bulge) < 0.55) {
        cells[y * N + x] = LINE;
        continue;
      }
      const band = y < 4 ? 0 : y < 8 ? 1 : y < 11 ? 2 : 3;
      cells[y * N + x] = BANDS[band] as number;
    }
  }
  return { w: N, h: N, cells };
}
