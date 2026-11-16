/**
 * Fonte pixel art 5x7 desenhada por código (sem arquivo de fonte de terceiros), usada nos textos de destaque
 * como o "LEVEL UP". Cada letra é uma grade de 5 colunas x 7 linhas; letras acentuadas têm linhas extras no topo.
 */

export const GLYPH_W = 5;
export const GLYPH_H = 7;

const G: Record<string, string[]> = {
  L: ['X....', 'X....', 'X....', 'X....', 'X....', 'X....', 'XXXXX'],
  E: ['XXXXX', 'X....', 'X....', 'XXXX.', 'X....', 'X....', 'XXXXX'],
  V: ['X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.X.X.', '..X..'],
  U: ['X...X', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.XXX.'],
  P: ['XXXX.', 'X...X', 'X...X', 'XXXX.', 'X....', 'X....', 'X....'],
  N: ['X...X', 'XX..X', 'X.X.X', 'X..XX', 'X...X', 'X...X', 'X...X'],
  I: ['XXXXX', '..X..', '..X..', '..X..', '..X..', '..X..', 'XXXXX'],
  Í: ['...X.', '..X..', 'XXXXX', '..X..', '..X..', '..X..', '..X..', '..X..', 'XXXXX'],
  '0': ['.XXX.', 'X...X', 'X..XX', 'X.X.X', 'XX..X', 'X...X', '.XXX.'],
  '1': ['..X..', '.XX..', '..X..', '..X..', '..X..', '..X..', '.XXX.'],
  '2': ['.XXX.', 'X...X', '....X', '...X.', '..X..', '.X...', 'XXXXX'],
  '3': ['.XXX.', 'X...X', '....X', '..XX.', '....X', 'X...X', '.XXX.'],
  '4': ['...X.', '..XX.', '.X.X.', 'X..X.', 'XXXXX', '...X.', '...X.'],
  '5': ['XXXXX', 'X....', 'XXXX.', '....X', '....X', 'X...X', '.XXX.'],
  '6': ['.XXX.', 'X....', 'X....', 'XXXX.', 'X...X', 'X...X', '.XXX.'],
  '7': ['XXXXX', '....X', '...X.', '..X..', '..X..', '..X..', '..X..'],
  '8': ['.XXX.', 'X...X', 'X...X', '.XXX.', 'X...X', 'X...X', '.XXX.'],
  '9': ['.XXX.', 'X...X', 'X...X', '.XXXX', '....X', '...X.', '.XXX.'],
};

const ARROW = [
  '...X...',
  '..XXX..',
  '.XXXXX.',
  'XXXXXXX',
  '..XXX..',
  '..XXX..',
  '..XXX..',
  '..XXX..',
];

const SPACE_W = 3;
const LETTER_GAP = 1;
const ARROW_GAP = 2;

export interface PixelTextOptions {
  /** Cores do degradê, de cima para baixo: linhas 0-1, 2-3 e 4-6 de cada letra. */
  colors?: [string, string, string];
  outline?: string;
  arrow?: boolean;
}

export interface PixelCell {
  x: number;
  y: number;
  color: string;
}

export interface PixelImage {
  width: number;
  height: number;
  cells: PixelCell[];
}

export const KNOWN_GLYPHS: string[] = Object.keys(G);
export const glyphRows = (ch: string): string[] | undefined => G[ch];

const DEFAULT_COLORS: [string, string, string] = ['#FFD93B', '#FF9A1F', '#E5322B'];
const ARROW_MAIN = '#3CCB4A';
const ARROW_LIGHT = '#8DFF7A';
const ARROW_SHADE = '#1E8F2E';

/** Monta a imagem do texto em pixels (função pura, sem canvas). Caracteres desconhecidos são ignorados. */
export function buildPixelText(text: string, options: PixelTextOptions = {}): PixelImage {
  const colors = options.colors ?? DEFAULT_COLORS;
  const outline = options.outline ?? '#1D1D1F';
  const chars = [...text.toUpperCase()].filter((c) => c === ' ' || G[c]);
  const maxExtra = Math.max(0, ...chars.map((c) => (G[c] ? G[c]!.length - GLYPH_H : 0)));
  const textH = GLYPH_H + maxExtra;

  const fill = new Map<string, string>();
  const key = (x: number, y: number) => `${x},${y}`;
  let cursor = 0;

  chars.forEach((c, i) => {
    if (i > 0) cursor += LETTER_GAP;
    if (c === ' ') {
      cursor += SPACE_W;
      return;
    }
    const rows = G[c]!;
    const extra = rows.length - GLYPH_H;
    rows.forEach((row, r) => {
      const y = maxExtra - extra + r;
      const gradRow = Math.max(0, r - extra);
      const color = gradRow <= 1 ? colors[0] : gradRow <= 3 ? colors[1] : colors[2];
      for (let x = 0; x < GLYPH_W; x++) if (row[x] === 'X') fill.set(key(cursor + x, y), color);
    });
    cursor += GLYPH_W;
  });

  let width = cursor;
  let height = textH;

  if (options.arrow) {
    const ax = width + ARROW_GAP;
    const ay = Math.max(textH, ARROW.length) - ARROW.length;
    ARROW.forEach((row, r) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] !== 'X') continue;
        const color = x <= 1 && r >= 3 ? ARROW_LIGHT : x >= 5 || r === 3 ? ARROW_SHADE : ARROW_MAIN;
        fill.set(key(ax + x, ay + r), color);
      }
    });
    width = ax + ARROW[0]!.length;
    height = Math.max(textH, ARROW.length);
    // se a seta for mais alta que o texto, o texto desce junto com a base
    if (ARROW.length > textH) {
      const shift = ARROW.length - textH;
      const moved = new Map<string, string>();
      for (const [k, v] of fill) {
        const [sx, sy] = k.split(',').map(Number) as [number, number];
        const isArrow = sx >= ax;
        moved.set(key(sx, isArrow ? sy : sy + shift), v);
      }
      fill.clear();
      for (const [k, v] of moved) fill.set(k, v);
    }
  }

  // contorno de 1 pixel (8 vizinhos), deslocando tudo 1 pixel para dar margem
  const out = new Map<string, string>();
  for (const [k, v] of fill) {
    const [x, y] = k.split(',').map(Number) as [number, number];
    out.set(key(x + 1, y + 1), v);
  }
  const edge = new Set<string>();
  for (const k of out.keys()) {
    const [x, y] = k.split(',').map(Number) as [number, number];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!out.has(key(x + dx, y + dy))) edge.add(key(x + dx, y + dy));
  }

  const cells: PixelCell[] = [];
  for (const k of edge) {
    const [x, y] = k.split(',').map(Number) as [number, number];
    cells.push({ x, y, color: outline });
  }
  for (const [k, v] of out) {
    const [x, y] = k.split(',').map(Number) as [number, number];
    cells.push({ x, y, color: v });
  }
  return { width: width + 2, height: height + 2, cells };
}

/** Desenha o texto em um canvas de 1 pixel por "pixel de arte". Amplie na tela com escala inteira. */
export function renderPixelText(text: string, options: PixelTextOptions = {}): HTMLCanvasElement {
  const img = buildPixelText(text, options);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    for (const c of img.cells) {
      ctx.fillStyle = c.color;
      ctx.fillRect(c.x, c.y, 1, 1);
    }
  }
  return canvas;
}
