/**
 * Identidade visual do Estoque Flix: visual moderno e liso (sem pixel art). Blocos com degradê e brilho, fundo escuro
 * com luzes suaves, tabuleiro de vidro. Tudo é desenhado por código em `art.ts`, na resolução real da tela.
 * Para mudar cores, edite aqui.
 */
export const GAME_W = 270;
export const GAME_H = 480;

/**
 * Prateleira 10 x 20 no meio; dos lados, a faixa dos conectores (PLUG_W) e dos aparelhos que acendem quando a linha
 * completa (roteador à esquerda, computador à direita). Placar em cima, recorde e próxima peça embaixo.
 */
export const CELL = 18;
export const TOP_H = 60;
export const PLUG_W = 26;
export const BOARD_X = 45; // aparelho (0..19) + conector (19..45) + prateleira 10 x 18 (45..225) + conector + aparelho
export const BOARD_Y = 68;
export const BOARD_W = 10 * CELL; // 180
export const BOARD_H = 20 * CELL; // 360 (termina em 428)
export const DEVICE_X = 10; // centro do aparelho da esquerda (o da direita é espelhado)
export const BAR_Y = 436; // faixa de baixo: recorde e próxima peça

export const COLORS = {
  background: 0x080b16,
  bgTop: '#111733',
  bgBottom: '#05070f',
  panel: 0x0f1427,
  panelLine: 0xffffff,
  grid: 0xffffff,
  text: '#F5F7FF',
  textMuted: '#8C93B0',
  label: '#6C7494',
  flixRed: 0xe5173f,
  flixRedText: '#FF3D5E',
  gold: '#FFD54A',
  danger: 0xff3b5c,
} as const;

/** Cor de cada peça (1 a 7): cor base, mais clara (topo do degradê) e mais escura (base). */
export const ITEMS: Record<number, { name: string; base: string; light: string; dark: string; hex: number }> = {
  1: { name: 'Vermelho', base: '#FF4D6A', light: '#FF8FA2', dark: '#C21F3F', hex: 0xff4d6a },
  2: { name: 'Ciano', base: '#22D3EE', light: '#8BEFFF', dark: '#0891B2', hex: 0x22d3ee },
  3: { name: 'Amarelo', base: '#FACC15', light: '#FFE779', dark: '#C29400', hex: 0xfacc15 },
  4: { name: 'Verde', base: '#34D399', light: '#8DF5C9', dark: '#059669', hex: 0x34d399 },
  5: { name: 'Roxo', base: '#A78BFA', light: '#D2C4FF', dark: '#6D4ED8', hex: 0xa78bfa },
  6: { name: 'Azul', base: '#3B82F6', light: '#93BBFF', dark: '#1D4ED8', hex: 0x3b82f6 },
  7: { name: 'Laranja', base: '#FB923C', light: '#FFC08F', dark: '#D9600B', hex: 0xfb923c },
};

/** Fonte do sistema (lisa e nítida em qualquer aparelho, sem baixar arquivo). */
export const FONT = '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
