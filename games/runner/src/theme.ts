/**
 * Identidade do Flix Runner (G01). Jogo em paisagem 960x540 (padrão do prompt dos minigames), escala "fit" para a tela.
 * O cenário alterna duas cidades (`cidade_a.jpg`, `cidade_b.jpg`, 1938x540) separadas por uma torre 5G (`torre.png`), em laço infinito.
 */
export const GAME_W = 960;
export const GAME_H = 540;

/** Linha do chão (onde ficam os pés), em y de tela. Ajustada à calçada/rua do cenário. */
export const GROUND_Y = 478;
/** Posição horizontal fixa do personagem. */
export const PLAYER_X = 250;
/** Os sprites do personagem (`public/img/personagem/`) são mostrados nesta escala: ~115 px de altura na tela. */
export const SPRITE_SCALE = 0.49;
/** Posição horizontal do tronco em cada sprite (0 = esquerda, 1 = direita), para o personagem não "andar" entre quadros. */
export const SPRITE_ANCHOR: Record<string, number> = {
  gun: 0.502, run_0: 0.513, run_1: 0.513, run_2: 0.513, run_3: 0.513, duck_0: 0.494, duck_1: 0.52, jump: 0.503, fall: 0.551, fly_0: 0.513, fly_1: 0.54,
};

/** O sprite com a arma de wifi (`gun`) é um pouco maior que os outros: reduzido para ficar do mesmo tamanho. */
export const GUN_SPRITE_FIX = 0.94;

/** Ponte sobre o rio da cidade B (`ponte.png`, 1360x382): o piso fica na linha do chão, então a personagem corre por cima da água. */
export const BRIDGE = { x: 270, deckTop: 51 };

export const COLORS = {
  background: 0x4aa3ff,
  text: '#FFFFFF',
  textMuted: '#DCEBFF',
  flixRed: 0xd4142c,
  wifi: 0x3fa9ff,
  wifiLight: 0xbfe6ff,
  gold: '#FFD43B',
} as const;

export const FONT = "'Arial Black', 'Segoe UI Black', 'Trebuchet MS', Arial, sans-serif";
export const FONT_TEXT = "'Segoe UI', 'Trebuchet MS', Arial, sans-serif";

/** Imagens carregadas na abertura: [chave, arquivo em `public/img/`]. */
export const IMAGES: ReadonlyArray<readonly [string, string]> = [
  ['cidade_a', 'cidade_a.jpg'], // cidade Flix (1938x540)
  ['cidade_b', 'cidade_b.jpg'], // cidade com a ponte e o rio (1938x540)
  ['torre', 'torre.png'], // torre 5G sem fundo (321x800): separa uma cidade da outra
  ['ponte', 'ponte.png'],
  ['arma', 'itens/arma.png'], // arma de wifi (bônus), 100x104
  ['bateria', 'itens/bateria.png'], // sinal de energia (bônus x3), 78x143
  ['virus', 'itens/virus.png'], // vírus (inimigo), 156x161 // tabuleiro da ponte vermelha, sem fundo e sem a treliça de cima (1360x382)
  // personagem de lado (recortado da folha do gestor): corrida (run_2 e run_3 têm as pernas trocadas), agachada, salto, queda e jetpack
  ...(['run_0', 'run_1', 'run_2', 'run_3', 'duck_0', 'duck_1', 'gun', 'jump', 'fall', 'fly_0', 'fly_1'] as const).map((n) => [`pl_${n}`, `personagem/${n}.png`] as const),
];
