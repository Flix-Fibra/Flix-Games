/**
 * Identidade visual do G12. Pixel art desenhada por código (sem arquivos de terceiros): o carro é um modelo de
 * fatias empilhadas (`carro.ts`) e as pistas são pintadas a partir de uma linha central (`pistas.ts`).
 * A tela interna é pequena (480 x 270) e o navegador amplia sem suavizar: 1 pixel do jogo = vários da tela.
 */
export const GAME_W = 480;
export const GAME_H = 270;

export const COLORS = {
  background: 0x0b0b0d,
  text: '#F5F5F7',
  textMuted: '#A1A1A6',
  flixRed: 0xd4142c,
} as const;

export const FONT = '"Trebuchet MS", Verdana, sans-serif';

/** Cores dos carros (a cor principal do personagem vai pintar o carro no jogo final). */
export const CAR_COLORS = {
  flix: 0xd4142c,
  azul: 0x2f6fe0,
  amarelo: 0xf2b824,
  verde: 0x2fa84f,
  laranja: 0xf07a1c,
  roxo: 0x8a4fd8,
  ciano: 0x22c7d6,
  rosa: 0xe85aa8,
  branco: 0xe8e8ec,
  cinza: 0x6d7480,
  marrom: 0x8a5a33,
} as const;
