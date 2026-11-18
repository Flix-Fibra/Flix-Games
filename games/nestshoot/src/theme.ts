/**
 * Identidade do Nest Shot (G15). Jogo em retrato 720x1280, escala "fit" para a tela.
 * Arte do gestor (`Nest Shoot Assets/`), recortada e reduzida para a escala do jogo (`public/img/`,
 * por `tools/preparar-assets.py`).
 */
export const GAME_W = 720;
export const GAME_H = 1280;

export const FONT = '"Arial Black", "Segoe UI Black", Impact, sans-serif';
export const FONT_TEXT = 'system-ui, "Segoe UI", Roboto, Arial, sans-serif';

export const COLORS = {
  background: '#0d2014',
  text: '#FFFFFF',
  textMuted: '#D8E8C8',
  stroke: '#13240f',
  accent: 0xe0a33a,
};

const frames = (prefix: string, n: number): Array<[string, string]> =>
  Array.from({ length: n }, (_, i): [string, string] => [`${prefix}_${i}`, `${prefix}_${i}.png`]);

/** Imagens carregadas na abertura (chave, arquivo em `public/img/`). */
export const IMAGES: Array<[string, string]> = [
  ['fundo', 'fundo.jpg'],
  ['tronco', 'tronco.png'],
  ['orelha', 'orelha.png'],
  ['galho', 'galho.png'],
  ['musgo', 'musgo.png'],
  ['ninho', 'ninho.png'],
  ['pedra', 'pedra.png'],
  ...frames('macaco', 4),
  ...frames('sapo', 4),
  ...frames('passaro', 7),
  ...frames('morcego', 33),
];

/** Camadas (profundidade) do desenho. */
export const DEPTH = {
  bg: 0,
  support: 8, // atrás do tronco: o apoio sai de trás dele
  trunk: 10,
  moss: 20,
  frog: 30,
  nest: 40,
  monkey: 50,
  bird: 55,
  bat: 57,
  stone: 60,
  edges: 65,
  dots: 70,
  fx: 80,
  hud: 100,
  over: 200,
};

/** Na tela, o macaco fica nesta altura (y) depois de cada subida. */
export const MONKEY_SCREEN_Y = 1080; // mais embaixo, para sobrar espaço para o ninho de cima

/** Tom vermelho aplicado à floresta do fundo durante a onda de morcegos. */
export const WAVE_TINT = 0xd97566; // 0xff8a78 escurecido como o fundo (85%)

/** Fundo da floresta 15% mais escuro (tom multiplicado na imagem). */
export const BG_TINT = 0xd9d9d9;
