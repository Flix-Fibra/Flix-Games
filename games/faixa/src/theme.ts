/**
 * Identidade visual do Sinal Verde (obra de fibra ótica na rua). Gráfico vetorial liso, desenhado por código em
 * `art.ts` e `laneView.ts`; sem arquivos de arte de terceiros. Para mudar o tema (cores, tipos de faixa), é aqui.
 */
import { COLS } from './logic';

export const GAME_W = 270;
export const GAME_H = 480;
/** Lado de cada bloco da grade. */
export const CELL = 26;
export const PLAY_W = COLS * CELL; // 234
/** As barreiras (tapume da obra) ocupam o que sobra de cada lado: o jogador nunca passa daqui. */
export const PLAY_X = (GAME_W - PLAY_W) / 2; // 18
export const HUD_H = 34;

export const COLORS = {
  background: 0x10151f,
  text: '#F5F5F7',
  textMuted: '#A1A1A6',
  flixRed: 0xd4142c,
  flixRedText: '#FF4A5A',
  gold: '#F5C04A',
  grassA: 0x4f9a3c,
  grassB: 0x59a645,
  grassDark: 0x3e7d2f,
  asphalt: 0x3b3e48,
  asphaltEdge: 0x2c2e36,
  roadLine: 0xe9e2b4,
  water: 0x2b82c4,
  waterLight: 0x5aa8e0,
  gravel: 0x7a6a55,
  gravelDark: 0x5a4c3b,
  rail: 0xb9bfcb,
  tie: 0x4a3b2c,
  fence: 0x1b2230,
  hazardYellow: 0xf2c230,
  warnRed: 0xff3b3b,
} as const;

export const FONT = '"Trebuchet MS", Verdana, sans-serif';

/** Cor da carroceria de cada tipo de veículo (variantes 0 e 1 são carros; 2 e 3, caminhões). */
export const CAR_COLORS = [0xe8434f, 0x2f7fff] as const;
