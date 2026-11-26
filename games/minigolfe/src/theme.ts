/**
 * Identidade visual do Minigolfe Flix (campos de cidade, com cabos, postes e portais de sinal). Gráfico vetorial liso,
 * desenhado por código em `course.ts`; sem arquivos de arte de terceiros.
 */
export const GAME_W = 270;
export const GAME_H = 480;
/** Faixa de cima (HUD) e de baixo (dicas); o campo usa o que sobra. */
export const HUD_H = 46;
export const BAR_H = 40;
export const FIELD_PAD = 8;
/** Arrasto (em unidades da tela) que dá a força máxima. */
export const MAX_DRAG = 70;

export const COLORS = {
  background: 0x10151f,
  text: '#F5F5F7',
  textMuted: '#A1A1A6',
  flixRedText: '#FF4A5A',
  gold: '#F5C04A',
  grassA: 0x4f9a3c,
  grassB: 0x59a645,
  sand: 0xe3c98a,
  sandDot: 0xc9a967,
  ice: 0xbfe6f5,
  iceLine: 0xe9f8ff,
  water: 0x2b82c4,
  waterLight: 0x5aa8e0,
  wall: 0x39425c,
  wallLight: 0x7a86a8,
  wallDark: 0x232a3d,
  post: 0xf2c230,
  postDark: 0x8a6a10,
  magnetPull: 0x4aa3ff,
  magnetPush: 0xff5a6a,
  belt: 0xd9473f,
  beltDark: 0xbf3a33,
  jump: 0xe8a43a,
  jumpDark: 0x8a5a14,
  track: 0x86c765,
  trackDark: 0x2f6b2f,
  blockFill: 0xf5f5f7,
  blockEdge: 0x8f98ad,
  lavaHot: 0xff5a1f,
  lavaGlow: 0xffd23d,
  lavaCold: 0x4a1f26,
  lavaColdEdge: 0x2b1015,
  windBlade: 0xf0dfa8,
  windBladeEdge: 0x8a6a30,
  windHub: 0xd4142c,
  piston: 0xe0463d,
  pistonDark: 0x8e1d1d,
  bomb: 0x15171d,
  bombLight: 0x424858,
  hole: 0x0a0c12,
  flag: 0xd4142c,
  ball: 0xffffff,
} as const;

export const FONT = '"Trebuchet MS", Verdana, sans-serif';
/** Cor de cada par de portais (1 a 9). */
export const PORTAL_COLORS = [0xff7a1a, 0xa855f7, 0x22d3ee, 0xf472b6, 0xfacc15, 0x34d399, 0xf87171, 0x60a5fa, 0xe879f9] as const;
