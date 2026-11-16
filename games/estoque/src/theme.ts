/**
 * Identidade visual do Estoque Flix. Gráfico vetorial liso (sem pixel art): os itens são desenhados por código em
 * `art.ts` e viram texturas. Para deixar com a cara da Flix, edite as cores aqui.
 */
export const GAME_W = 270;
export const GAME_H = 480;
export const CELL = 34;
export const HUD_H = 60;
export const BOARD_X = 16;
export const BOARD_Y = 66; // o tabuleiro termina em 66 + 11*34 = 440
export const BAR_Y = 440; // faixa de baixo: dica e próxima peça

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

/** Nome e cor do cartão de cada item (1 a 5). O desenho de cada item fica em `art.ts`. */
export const ITEMS: Record<number, { name: string; card: number; cardDark: number }> = {
  1: { name: 'Roteador', card: 0xffa6b0, cardDark: 0xd8606f },
  2: { name: 'Cabo', card: 0xbfe0ff, cardDark: 0x6aa8e6 },
  3: { name: 'Monitor', card: 0xffe29a, cardDark: 0xe0b14a },
  4: { name: 'Furadeira', card: 0xa8ecc6, cardDark: 0x52b886 },
  5: { name: 'Antena', card: 0x8f7df0, cardDark: 0x5a47c4 },
};

export const FONT = '"Trebuchet MS", Verdana, sans-serif';
