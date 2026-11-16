/**
 * Identidade visual do Network Snake (G03), no estilo enviado pelo gestor: ilustrações em alta resolução (não pixel art).
 * O jogo é desenhado em 540x960 (mesma proporção do cenário do gestor) e escala para a tela. Para mudar cores,
 * tamanhos ou trocar imagens, edite aqui: as imagens ficam em `public/img/` (geradas por `tools/preparar-assets.cjs`)
 * e são listadas em `IMAGES`.
 */
export const GAME_W = 540;
export const GAME_H = 960;

/** Campo de jogo: 15 colunas x 20 linhas de 36 px (540 x 720): largura inteira, entre o topo (céu e cidade, só um pouco maior que o menu) e o rodapé. */
export const CELL = 36;
export const FIELD_X = 0;
export const FIELD_Y = 148;
export const FIELD_COLS = 15;
export const FIELD_ROWS = 20;

/** Fundo do campo: painel escuro com a grade, da base do topo (céu e cidade) até o fim da tela. */
export const PANEL = { x: 0, y: 148, w: 540, h: 812, radius: 0 };

/** Menu superior (desenhado por código sobre o topo do cenário): quadro do avatar e as caixas SCORE, TEMPO e NÍVEL. */
export const HUD = {
  plate: { x: 6, y: 17, w: 528, h: 110, radius: 24 },
  avatar: { x: 66, y: 72, size: 84 },
  score: { x: 189 },
  time: { x: 326 },
  level: { x: 463 },
  labelY: 42,
  boxY: 90,
  boxW: 122,
  boxH: 46,
};

export const COLORS = {
  background: 0x061226,
  text: '#FFFFFF',
  textMuted: '#9DB4D6',
  flixRed: 0xd4142c,
  flixRedText: '#FF4A5A',
  gold: '#FFD43B',
  panel: 0x0e1118,
  panelGrid: 0x2b3342,
} as const;

/** Fontes do sistema (sem arquivo externo): títulos pesados e texto comum. */
export const FONT = "'Arial Black', 'Segoe UI Black', 'Trebuchet MS', Arial, sans-serif";
export const FONT_TEXT = "'Segoe UI', 'Trebuchet MS', Arial, sans-serif";

/** Imagens carregadas na abertura: [chave, arquivo em `public/img/`]. */
export const IMAGES: ReadonlyArray<readonly [string, string]> = [
  ['ceu', 'ceu.jpg'],
  ['cidade', 'cidade.png'],
  ['rodape', 'rodape.png'],
  ['cobra_azul_cabeca', 'cobra_azul_cabeca.png'],
  ['cobra_azul_corpo', 'cobra_azul_corpo.png'],
  ['cobra_azul_cauda', 'cobra_azul_cauda.png'],
  ['cobra_metal_cabeca', 'cobra_metal_cabeca.png'],
  ['cobra_metal_corpo', 'cobra_metal_corpo.png'],
  ['cobra_metal_cauda', 'cobra_metal_cauda.png'],
  ['logo', 'logo.png'],
  ['muro', 'muro.png'],
  ['item_casa', 'casa.png'],
  ['item_globo', 'globo.png'],
  ['item_antena', 'item_antena.png'],
  ['item_cpe', 'item_cpe.png'],
  ['item_caixa', 'item_caixa.png'],
  ['item_roteador', 'item_roteador.png'],
  ['item_switch', 'item_switch.png'],
];

/**
 * Itens de pontuação: todos os modelos enviados pelo gestor. Um aparece por vez, sorteado (a ordem daqui é o índice
 * `foodKind` da lógica). `size` é a maior dimensão do item na tela.
 */
export const FOOD_ITEMS: ReadonlyArray<{ key: string; size: number }> = [
  { key: 'item_casa', size: 46 },
  { key: 'item_antena', size: 46 },
  { key: 'item_cpe', size: 52 },
  { key: 'item_caixa', size: 46 },
  { key: 'item_roteador', size: 54 },
  { key: 'item_switch', size: 58 },
];

/** O globo digital: não é comida, é o bônus de ponto extra (aparece de vez em quando). */
export const SIGNAL_ITEM = { key: 'item_globo', size: 58 };

/** Cores do corpo da cobra por versão: azul (normal) e a vermelha/cinza do ponto extra. */
export const TUBE = {
  azul: { outline: 0x07204a, mid: 0x1672e0, light: 0x6fd0ff },
  metal: { outline: 0x1a1016, mid: 0x5a6272, light: 0xff4a5a },
} as const;

/**
 * Tamanho da cobra: as imagens foram recortadas a 25% da arte original (corpo com 49,5 px de altura visível).
 * `SPRITE_K` converte esses pixels da imagem em pixels do jogo. `BODY_H` é a espessura do corpo no jogo.
 */
export const BODY_H = 25;
export const SPRITE_K = BODY_H / 49.5;
/** Quanto a ponta do conector da cabeça (e da cauda) passa do centro da casa, em pixels do jogo. */
export const HEAD_FRONT = 23;
export const TAIL_BACK = 23;
