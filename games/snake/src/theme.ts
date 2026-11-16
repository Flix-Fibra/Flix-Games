/**
 * Identidade visual do jogo. Para deixar o jogo "com a cara da Flix", edite as cores e medidas aqui.
 * Todo o desenho (cabo, casas, obras, sinal, fundo) é feito por código nas cenas, sem arquivos de imagem.
 * Os valores seguem o padrão do Flix Pulse (vermelho #D4142C e fundo escuro).
 */
export const GAME_W = 270;
export const GAME_H = 480;
export const CELL = 15;
export const HUD_H = 64;
export const FIELD_X = 0;
export const FIELD_Y = HUD_H + 5; // 69; o campo termina em 69 + 27*15 = 474

export const COLORS = {
  background: 0x0b0b0d,
  hud: 0x16161a,
  field: 0x111116,
  fieldDot: 0x23232b,
  text: '#F5F5F7',
  textMuted: '#A1A1A6',
  flixRed: 0xd4142c,
  flixRedText: '#FF4A5A',
  gold: '#F5C04A',
  cableOutline: 0x1d1d1f,
  cableShine: 0xffffff,
  houseRoof: 0xd4142c,
  houseWall: 0xf5f5f7,
  houseDoor: 0x7a0412,
  coneOrange: 0xf2873d,
  coneStripe: 0xf5f5f7,
  signal: 0x35c8ff,
  signalBoost: 0x35c8ff,
} as const;

export const FONT = 'monospace';

/** Azul padrão de cabo de rede RJ45. O cabo do jogo e o emblema usam esta cor (não a cor do personagem). */
export const CABLE_BLUE = { base: 0x1f7ae0, shade: 0x1457b0, light: 0x6fb2ff } as const;
export const CABLE_BLUE_PALETTE = { main: CABLE_BLUE.base, shade: CABLE_BLUE.shade, light: CABLE_BLUE.light };
