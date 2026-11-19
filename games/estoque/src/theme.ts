/**
 * Identidade visual do Estoque Flix. Gráfico vetorial liso (sem pixel art): os itens são desenhados por código em
 * `art.ts` e viram texturas. Para deixar com a cara da Flix, edite as cores aqui.
 */
export const GAME_W = 270;
export const GAME_H = 480;
export const CELL = 18;
export const HUD_H = 60;
/** Faixa de cada lado da prateleira onde aparecem os conectores (e, ao completar a linha, os aparelhos). */
export const PLUG_W = 26;
export const BOARD_X = 45; // aparelho (0..19) + conector (19..45) + prateleira 10 x 18 (45..225) + conector + aparelho
export const BOARD_Y = 66; // prateleira 10 x 20: termina em 66 + 20*18 = 426
export const DEVICE_X = 10; // centro do aparelho da esquerda (o da direita é espelhado)
export const BAR_Y = 432; // faixa de baixo: dicas e próxima peça

export const COLORS = {
  background: 0x0b0b0d,
  hud: 0x16161a,
  shelf: 0x14151c,
  shelfLine: 0x20222c,
  rail: 0x2a2c38,
  railLight: 0x3a3d4c,
  text: '#F5F5F7',
  textMuted: '#A1A1A6',
  flixRed: 0xd4142c,
  flixRedText: '#FF4A5A',
  gold: '#F5C04A',
  ghost: 0xffffff,
} as const;

/** Cor de cada cabo (1 a 7). Cada formato de peça é sempre o mesmo cabo (ver SHAPES em logic.ts). */
export const ITEMS: Record<number, { name: string; card: number; cardDark: number }> = {
  1: { name: 'Vermelho', card: 0xe8434f, cardDark: 0x9e1f2b },
  2: { name: 'Ciano', card: 0x2fc4e8, cardDark: 0x157f9c },
  3: { name: 'Amarelo', card: 0xf2c230, cardDark: 0xa98213 },
  4: { name: 'Verde', card: 0x3fc46a, cardDark: 0x20803f },
  5: { name: 'Roxo', card: 0x9b6bf0, cardDark: 0x5e3cb0 },
  6: { name: 'Azul', card: 0x2f7fff, cardDark: 0x1a4cb0 },
  7: { name: 'Laranja', card: 0xf58a2e, cardDark: 0xa95514 },
};

export const FONT = '"Trebuchet MS", Verdana, sans-serif';
