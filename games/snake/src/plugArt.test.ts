import { describe, expect, it } from 'vitest';
import { PLUG_BIG, PLUG_COLORS, PLUG_MINI, buildPlug, rotateGrid } from './plugArt';
import { CABLE_BLUE_PALETTE } from './theme';

const filled = (cells: number[]) => cells.filter((c) => c >= 0).length;

describe('conector RJ45 visto de cima', () => {
  for (const [name, spec] of [['grande', PLUG_BIG], ['pequeno', PLUG_MINI]] as const) {
    describe(name, () => {
      const s = buildPlug(spec, CABLE_BLUE_PALETTE);

      it('tem largura ímpar (eixo central) e grade completa', () => {
        expect(s.w % 2).toBe(1);
        expect(s.cells).toHaveLength(s.w * s.h);
      });

      it('os contatos dourados ficam no topo, um por contato', () => {
        const topRows = s.cells.slice(0, s.w * 4);
        const goldColumns = new Set<number>();
        topRows.forEach((c, i) => {
          if (c === PLUG_COLORS.goldLight) goldColumns.add(i % s.w);
        });
        expect(goldColumns.size).toBe(spec.pins);
      });

      it('tem plaquinha, frisos e a cor do cabo', () => {
        expect(s.cells.includes(PLUG_COLORS.plate)).toBe(true);
        expect(s.cells.includes(PLUG_COLORS.plateLine)).toBe(true);
        expect(s.cells.includes(PLUG_COLORS.ridge)).toBe(true);
        expect(s.cells.includes(CABLE_BLUE_PALETTE.main)).toBe(true);
      });

      it('a ponta (primeira linha) é mais estreita que a capa', () => {
        const first = s.cells.slice(0, s.w).filter((c) => c >= 0).length;
        expect(first).toBeLessThan(s.w);
      });
    });
  }

  it('girar troca largura e altura e não perde pixels', () => {
    const s = buildPlug(PLUG_BIG, CABLE_BLUE_PALETTE);
    const r = rotateGrid(s, 1);
    expect(r.w).toBe(s.h);
    expect(r.h).toBe(s.w);
    expect(filled(r.cells)).toBe(filled(s.cells));
    expect(rotateGrid(s, 4).cells).toEqual(s.cells);
    // a ponta dos contatos (topo) vira a direita
    const rightColumn = Array.from({ length: r.h }, (_, y) => r.cells[y * r.w + (r.w - 1)]!);
    expect(rightColumn.some((c) => c >= 0)).toBe(true);
  });
});
