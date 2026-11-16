import { describe, expect, it } from 'vitest';
import { GLYPH_H, GLYPH_W, KNOWN_GLYPHS, buildPixelText, glyphRows } from './pixelFont';

describe('fonte pixel art', () => {
  it('toda letra tem 5 colunas e 7 linhas (acentuadas têm linhas extras no topo)', () => {
    for (const ch of KNOWN_GLYPHS) {
      const rows = glyphRows(ch)!;
      expect(rows.length).toBeGreaterThanOrEqual(GLYPH_H);
      for (const r of rows) expect(r).toHaveLength(GLYPH_W);
    }
  });

  it('tem as letras e os dígitos usados em LEVEL UP e NÍVEL n', () => {
    for (const ch of 'LEVUPNÍ0123456789') expect(glyphRows(ch)).toBeDefined();
  });

  it('gera pixels dentro da imagem, com contorno e sem repetir posição', () => {
    const img = buildPixelText('LEVEL UP', { arrow: true });
    expect(img.width).toBeGreaterThan(40);
    const seen = new Set<string>();
    for (const c of img.cells) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeLessThan(img.width);
      expect(c.y).toBeLessThan(img.height);
      const k = `${c.x},${c.y}`;
      expect(seen.has(k)).toBe(false);
      seen.add(k);
    }
    expect(img.cells.some((c) => c.color === '#1D1D1F')).toBe(true);
    expect(img.cells.some((c) => c.color === '#3CCB4A')).toBe(true);
  });

  it('ignora caracteres desconhecidos e cabe a palavra com acento', () => {
    const a = buildPixelText('NÍVEL 10');
    const b = buildPixelText('NÍVEL 10@@');
    expect(b.width).toBe(a.width);
    expect(a.height).toBe(GLYPH_H + 2 + 2);
  });
});
