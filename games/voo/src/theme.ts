/** Identidade do Voo Rasante (G02). Retrato 720x1280, escala "fit". Arte do gestor em `Voo Rasante Assets/`, preparada por `tools/preparar-assets.py`. */
export const GAME_W = 720;
export const GAME_H = 1280;

export const FONT = '"Arial Black", "Segoe UI Black", Impact, sans-serif';
export const FONT_TEXT = 'system-ui, "Segoe UI", Roboto, Arial, sans-serif';

export const COLORS = { background: '#1c1633', stroke: '#1a1030' };

export const N_PREDIOS = 5;
export const N_GUINDASTES = 5;

export const IMAGES: Array<[string, string]> = [
  ['fundo', 'fundo.jpg'],
  ['aviao', 'aviao.png'],
  ...Array.from({ length: N_PREDIOS }, (_, i): [string, string] => [`predio_${i}`, `predio_${i}.png`]),
  ...Array.from({ length: N_GUINDASTES }, (_, i): [string, string] => [`guindaste_${i}`, `guindaste_${i}.png`]),
];

export const DEPTH = { bg: 0, obstacle: 10, plane: 20, hud: 100, over: 200 };
