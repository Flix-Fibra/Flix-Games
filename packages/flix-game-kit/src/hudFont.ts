/**
 * Fonte pixel art do placar (estilo arcade): letras 5x7 desenhadas por código, sem arquivo de fonte de terceiros,
 * preenchimento branco e contorno escuro grosso, para ler sobre qualquer cenário sem caixa atrás.
 * Cada caractere ocupa uma célula de 7x12 (5x7 + 2 linhas de acento em cima + 1 de cedilha embaixo + contorno).
 * Sem Phaser aqui: os jogos em Phaser usam ./phaserHud; os em HTML usam renderHudText.
 */

const B = '.....';
// 7 linhas por letra (corpo); acentos ficam em ACENTO, cedilha em BAIXO.
const CORPO: Record<string, string[]> = {
  A: ['.XXX.', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X', 'X...X'],
  B: ['XXXX.', 'X...X', 'X...X', 'XXXX.', 'X...X', 'X...X', 'XXXX.'],
  C: ['.XXX.', 'X...X', 'X....', 'X....', 'X....', 'X...X', '.XXX.'],
  D: ['XXXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', 'XXXX.'],
  E: ['XXXXX', 'X....', 'X....', 'XXXX.', 'X....', 'X....', 'XXXXX'],
  F: ['XXXXX', 'X....', 'X....', 'XXXX.', 'X....', 'X....', 'X....'],
  G: ['.XXX.', 'X...X', 'X....', 'X.XXX', 'X...X', 'X...X', '.XXXX'],
  H: ['X...X', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X', 'X...X'],
  I: ['XXXXX', '..X..', '..X..', '..X..', '..X..', '..X..', 'XXXXX'],
  J: ['..XXX', '...X.', '...X.', '...X.', '...X.', 'X..X.', '.XX..'],
  K: ['X...X', 'X..X.', 'X.X..', 'XX...', 'X.X..', 'X..X.', 'X...X'],
  L: ['X....', 'X....', 'X....', 'X....', 'X....', 'X....', 'XXXXX'],
  M: ['X...X', 'XX.XX', 'X.X.X', 'X.X.X', 'X...X', 'X...X', 'X...X'],
  N: ['X...X', 'XX..X', 'X.X.X', 'X..XX', 'X...X', 'X...X', 'X...X'],
  O: ['.XXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.XXX.'],
  P: ['XXXX.', 'X...X', 'X...X', 'XXXX.', 'X....', 'X....', 'X....'],
  Q: ['.XXX.', 'X...X', 'X...X', 'X...X', 'X.X.X', 'X..X.', '.XX.X'],
  R: ['XXXX.', 'X...X', 'X...X', 'XXXX.', 'X.X..', 'X..X.', 'X...X'],
  S: ['.XXXX', 'X....', 'X....', '.XXX.', '....X', '....X', 'XXXX.'],
  T: ['XXXXX', '..X..', '..X..', '..X..', '..X..', '..X..', '..X..'],
  U: ['X...X', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.XXX.'],
  V: ['X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.X.X.', '..X..'],
  W: ['X...X', 'X...X', 'X...X', 'X.X.X', 'X.X.X', 'XX.XX', 'X...X'],
  X: ['X...X', 'X...X', '.X.X.', '..X..', '.X.X.', 'X...X', 'X...X'],
  Y: ['X...X', 'X...X', '.X.X.', '..X..', '..X..', '..X..', '..X..'],
  Z: ['XXXXX', '....X', '...X.', '..X..', '.X...', 'X....', 'XXXXX'],
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
  // minúsculas que aparecem no placar (metros, multiplicador, segundos); as outras viram maiúsculas
  m: [B, B, 'XX.X.', 'X.X.X', 'X.X.X', 'X.X.X', 'X.X.X'],
  x: [B, B, 'X...X', '.X.X.', '..X..', '.X.X.', 'X...X'],
  s: [B, B, '.XXXX', 'X....', '.XXX.', '....X', 'XXXX.'],
  ' ': [B, B, B, B, B, B, B],
  '.': [B, B, B, B, B, B, '..X..'],
  ',': [B, B, B, B, B, '..X..', '.X...'],
  ':': [B, '..X..', B, B, B, '..X..', B],
  '!': ['..X..', '..X..', '..X..', '..X..', '..X..', B, '..X..'],
  '?': ['.XXX.', 'X...X', '....X', '...X.', '..X..', B, '..X..'],
  '+': [B, '..X..', '..X..', 'XXXXX', '..X..', '..X..', B],
  '-': [B, B, B, '.XXX.', B, B, B],
  '·': [B, B, B, '..X..', B, B, B],
  '⊕': [B, '.XXX.', 'X.X.X', 'XXXXX', 'X.X.X', '.XXX.', B], // mira (botão ATIRAR)
  '/': ['....X', '....X', '...X.', '..X..', '.X...', 'X....', 'X....'],
  '%': ['XX..X', 'XX..X', '...X.', '..X..', '.X...', 'X..XX', 'X..XX'],
  "'": ['..X..', '..X..', B, B, B, B, B],
  '(': ['...X.', '..X..', '.X...', '.X...', '.X...', '..X..', '...X.'],
  ')': ['.X...', '..X..', '...X.', '...X.', '...X.', '..X..', '.X...'],
  '▲': [B, B, '..X..', '.XXX.', 'XXXXX', B, B],
  '▼': [B, B, 'XXXXX', '.XXX.', '..X..', B, B],
  '★': ['..X..', '..X..', 'XXXXX', '.XXX.', '.XXX.', 'X...X', B],
};

const ACENTO: Record<string, [string, string]> = {
  agudo: ['...X.', '..X..'],
  circ: ['..X..', '.X.X.'],
  til: ['.X..X', 'X.XX.'],
  crase: ['.X...', '..X..'],
};
const ACENTUADAS: Record<string, [string, keyof typeof ACENTO]> = {
  Á: ['A', 'agudo'], À: ['A', 'crase'], Â: ['A', 'circ'], Ã: ['A', 'til'],
  É: ['E', 'agudo'], Ê: ['E', 'circ'], Í: ['I', 'agudo'],
  Ó: ['O', 'agudo'], Ô: ['O', 'circ'], Õ: ['O', 'til'], Ú: ['U', 'agudo'],
};

export const HUD_GLYPH_W = 5;
export const HUD_CELL_W = 7; // 5 + contorno dos dois lados
export const HUD_CELL_H = 12; // 2 (acento) + 7 + 1 (cedilha) + contorno
export const HUD_OUTLINE = '#0b1530';

/** Linhas (10) de um caractere: 2 de acento, 7 de corpo, 1 de cedilha. undefined se não houver desenho. */
function linhas(ch: string): string[] | undefined {
  if (CORPO[ch]) return [B, B, ...CORPO[ch]!, B];
  const ac = ACENTUADAS[ch];
  if (ac) return [...ACENTO[ac[1]]!, ...CORPO[ac[0]]!, B];
  if (ch === 'Ç') return [B, B, ...CORPO.C!, '..X..'];
  return undefined;
}

/** Caracteres da fonte (maiúsculas, minúsculas e acentuadas; as minúsculas sem desenho próprio usam a maiúscula). */
export const HUD_CHARS: string = (() => {
  const base = [...Object.keys(CORPO), ...Object.keys(ACENTUADAS), 'Ç'];
  const min = base.filter((c) => c.toLowerCase() !== c && !CORPO[c.toLowerCase()]).map((c) => c.toLowerCase());
  return [...base, ...min].join('');
})();

function desenhoDe(ch: string): string[] {
  return linhas(ch) ?? linhas(ch.toUpperCase()) ?? linhas('?')!;
}

/** Deixa o texto só com caracteres da fonte (tira acentos que não existem nela). */
export function hudSafe(text: string): string {
  return [...text]
    .map((c) => {
      if (HUD_CHARS.includes(c)) return c;
      const sem = c.normalize('NFD').replace(/[̀-ͯ]/g, '');
      return HUD_CHARS.includes(sem) ? sem : HUD_CHARS.includes(sem.toUpperCase()) ? sem.toUpperCase() : '';
    })
    .join('');
}

/** Pinta um caractere (com contorno) na posição (x, y) de um contexto 2D, 1 pixel = 1 pixel da arte. */
function pintar(ctx: CanvasRenderingContext2D, ch: string, x: number, y: number, cor: string, contorno: string): void {
  const rows = desenhoDe(ch);
  const cheio = (cx: number, cy: number) => cy >= 0 && cy < rows.length && cx >= 0 && cx < HUD_GLYPH_W && rows[cy]![cx] === 'X';
  ctx.fillStyle = contorno;
  for (let cy = -1; cy <= rows.length; cy++)
    for (let cx = -1; cx <= HUD_GLYPH_W; cx++) {
      if (cheio(cx, cy)) continue;
      let perto = false;
      for (let dy = -1; dy <= 1 && !perto; dy++) for (let dx = -1; dx <= 1; dx++) if (cheio(cx + dx, cy + dy)) { perto = true; break; }
      if (perto) ctx.fillRect(x + cx + 1, y + cy + 1, 1, 1);
    }
  ctx.fillStyle = cor;
  for (let cy = 0; cy < rows.length; cy++) for (let cx = 0; cx < HUD_GLYPH_W; cx++) if (cheio(cx, cy)) ctx.fillRect(x + cx + 1, y + cy + 1, 1, 1);
}

/** Folha com todos os caracteres (branco + contorno), uma célula 7x12 por caractere, `porLinha` por linha. */
export function buildHudAtlas(porLinha = 16, contorno = HUD_OUTLINE): HTMLCanvasElement {
  const n = [...HUD_CHARS].length;
  const c = document.createElement('canvas');
  c.width = porLinha * HUD_CELL_W;
  c.height = Math.ceil(n / porLinha) * HUD_CELL_H;
  const ctx = c.getContext('2d')!;
  [...HUD_CHARS].forEach((ch, i) => pintar(ctx, ch, (i % porLinha) * HUD_CELL_W, Math.floor(i / porLinha) * HUD_CELL_H, '#FFFFFF', contorno));
  return c;
}

/**
 * Texto do placar num canvas pequeno (1 pixel = 1 pixel da arte). Amplie com CSS `image-rendering: pixelated`.
 * As letras se encostam pelo contorno (passo de 6 pixels), como nos placares de fliperama.
 */
export function renderHudText(text: string, cor = '#FFFFFF', contorno = HUD_OUTLINE): HTMLCanvasElement {
  const chars = [...hudSafe(text)];
  const c = document.createElement('canvas');
  c.width = Math.max(1, chars.length * (HUD_CELL_W - 1) + 1);
  c.height = HUD_CELL_H;
  const ctx = c.getContext('2d')!;
  chars.forEach((ch, i) => pintar(ctx, ch, i * (HUD_CELL_W - 1), 0, cor, contorno));
  return c;
}
