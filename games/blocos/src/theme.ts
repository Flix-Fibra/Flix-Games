/**
 * Identidade do Space Ping (G04). Jogo em retrato 720x1280, escala "fit" para a tela.
 * Jogadora, prancha e bola de raios: arte do gestor (`Space Ping Assets/`, ver ASSETS.md); o resto é desenhado
 * por código (`art.ts`).
 */
export const GAME_W = 720;
export const GAME_H = 1280;

export const FONT = '"Arial Black", "Segoe UI Black", Impact, sans-serif';
export const FONT_TEXT = 'system-ui, "Segoe UI", Roboto, Arial, sans-serif';

export const COLORS = {
  background: '#0b1026',
  text: '#FFFFFF',
  textMuted: '#C9D2F0',
  stroke: '#0a0d1f',
  accent: 0x4fd1ff,
};

/** Imagens carregadas na abertura (chave, arquivo em `public/img/`), preparadas por `tools/preparar-assets.py`. */
export const IMAGES: Array<[string, string]> = [
  ...Array.from({ length: 4 }, (_, i): [string, string] => [`jogadora_${i}`, `jogadora_${i}.png`]),
  ...Array.from({ length: 30 }, (_, i): [string, string] => [`prancha_${i}`, `prancha_${i}.png`]),
  ['bola', 'bola.png'],
  ['bola_rapida', 'bola_rapida.png'],
];

/** Na imagem da bola, o centro da bola fica a 25 px da borda direita (o rastro vem da esquerda). */
export const BALL_TAIL_PX = 25;

/** Cores dos blocos comuns ('1'..'5' nos mapas das fases). */
export const BRICK_COLORS = [0xef4f5f, 0xf7a531, 0xf5d93b, 0x3ccf7a, 0x4f8cff];

/** Camadas (profundidade) do desenho. */
export const DEPTH = {
  bg: 0,
  walls: 5,
  bricks: 10,
  boss: 15,
  shield: 20,
  paddle: 30,
  drops: 35,
  bolts: 38,
  balls: 40,
  fx: 60,
  hud: 100,
  over: 200,
};
