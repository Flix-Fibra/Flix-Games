/**
 * Identidade visual do G12. Pixel art desenhada por código (sem arquivos de terceiros): o carro é um modelo de
 * fatias empilhadas (`carro.ts`) e as pistas são pintadas a partir de uma linha central (`pistas.ts`).
 * A tela interna tem o tamanho real da janela e o mundo é visto com zoom inteiro.
 */
/**
 * Resolução: a tela interna tem o tamanho real da janela (em pixels do aparelho), sem ampliação do navegador. O mundo é
 * visto com um zoom INTEIRO (cada pixel da arte vira N x N pixels da tela), então a arte fica pixelada porém nítida.
 * `ALTURA_ARTE` é quantos pixels de arte aparecem na altura da tela, mais ou menos (define o zoom).
 */
export const ALTURA_ARTE = 420; // era 240 (zoom inteiro); 335 com a câmera afastada; 420 com a pista de 190 px (23/11/2026)
/** Idem na largura (para telas estreitas, como celular em pé). */
export const LARGURA_ARTE = 700; // era 400
/** A interface foi desenhada para uma tela de 540 de altura; os tamanhos escalam com a altura real. */
export const ALTURA_REFERENCIA_UI = 540;

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
