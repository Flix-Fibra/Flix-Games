/**
 * Identidade do Flix Runner (G01). Jogo em paisagem 960x540 (padrão do prompt dos minigames), escala "fit" para a tela.
 * O cenário percorre 18 cenários (`cenarios/*.jpg`, 1620x540), cada uma repetida duas vezes, separadas por uma torre 5G (`torre.png`), em laço infinito.
 */
/**
 * Largura do mundo visível. A altura é sempre 540; a largura acompanha o formato da tela (de 960 a LARGURA_MAX) para o
 * jogo ocupar a tela inteira sem faixas pretas. Definida antes de criar o jogo e de novo quando a janela muda de formato fora da partida (definirLargura, em main.ts).
 */
export let GAME_W = 960;
export const GAME_H = 540;
/** 800: telas 16:10 e 3:2 (notebooks, Mac) também ocupam tudo, sem faixas em cima e embaixo. */
export const LARGURA_MIN = 800;
/** Limite: tela muito larga mostraria os inimigos cedo demais (ficaria mais fácil que nos outros aparelhos). */
export const LARGURA_MAX = 1280;
/** Distância do texto do placar até a borda (maior no celular: cantos arredondados e entalhe da tela). */
export let MARGEM_X = 20;
export function definirLargura(largura: number, margem: number): void {
  GAME_W = Math.round(Math.min(LARGURA_MAX, Math.max(LARGURA_MIN, largura)));
  MARGEM_X = margem;
}

/** Linha do chão (onde ficam os pés), em y de tela. Ajustada à calçada/rua do cenário. */
export const GROUND_Y = 478;
/** Posição horizontal fixa do personagem. */
export const PLAYER_X = 250;
/** Os sprites do personagem (`public/img/personagem/`) são mostrados nesta escala: ~80 px de altura na tela. */
export const SPRITE_SCALE = 0.343; // 0.49 (versão anterior) -30%
/** Posição horizontal do tronco em cada sprite (0 = esquerda, 1 = direita), para o personagem não "andar" entre quadros. */
export const SPRITE_ANCHOR: Record<string, number> = {
  run_0: 0.513, run_1: 0.513, run_2: 0.513, run_3: 0.513, jump: 0.503, fall: 0.551, fly_0: 0.513, fly_1: 0.54, jumpg_0: 0.524, jumpg_1: 0.489, jumpg_2: 0.522, jumpg_3: 0.532,
};


/** Ponte sobre o rio da cidade B (`ponte.png`, 1360x382): o piso fica na linha do chão, então a personagem corre por cima da água. */
export const BRIDGE = { x: 130, deckTop: 51 };

/**
 * Cenários de fundo (1620x540 cada), na ordem em que aparecem; cada um se repete `SCENE_REPEAT` vezes seguidas, com uma torre 5G
 * em cada emenda (cenário 1, torre, cenário 1, torre..., portal, cenário 2...), e a lista volta ao início.
 * `bridge`: tem rio no chão, então a ponte vai por cima da água.
 */
export const SCENES = [
  { key: 'cen_comercial', file: 'cenarios/comercial.jpg', bridge: false }, // cidade Flix, comércio e galpão
  { key: 'cen_resende', file: 'cenarios/resende.jpg', bridge: true }, // Resende, rio e ponte
  { key: 'cen_mg', file: 'cenarios/mg.jpg', bridge: false }, // cidade histórica de Minas
  { key: 'cen_rj', file: 'cenarios/rj.jpg', bridge: false }, // orla carioca
  { key: 'cen_es', file: 'cenarios/es.jpg', bridge: false }, // Vitória e Vila Velha
  { key: 'cen_sp', file: 'cenarios/sp.jpg', bridge: false }, // São Paulo
  { key: 'cen_pe', file: 'cenarios/pe.jpg', bridge: false }, // Recife e Olinda
  { key: 'cen_pi', file: 'cenarios/pi.jpg', bridge: false }, // Serra da Capivara
  { key: 'cen_rr', file: 'cenarios/rr.jpg', bridge: false }, // Monte Roraima
  { key: 'cen_sc', file: 'cenarios/sc.jpg', bridge: false }, // Serra Catarinense
  { key: 'cen_am', file: 'cenarios/am.jpg', bridge: false }, // Amazonas, fauna e flora
  { key: 'cen_ba', file: 'cenarios/ba.jpg', bridge: false }, // Salvador
  { key: 'cen_ce', file: 'cenarios/ce.jpg', bridge: false }, // Falésias e jangadas do Ceará
  { key: 'cen_df', file: 'cenarios/df.jpg', bridge: false }, // Brasília
  { key: 'cen_go', file: 'cenarios/go.jpg', bridge: false }, // Pirenópolis e cerrado
  { key: 'cen_ma', file: 'cenarios/ma.jpg', bridge: false }, // Lençóis Maranhenses
  { key: 'cen_rn', file: 'cenarios/rn.jpg', bridge: false }, // Forte dos Reis Magos
  { key: 'cen_rs', file: 'cenarios/rs.jpg', bridge: false }, // Estação no pampa gaúcho
] as const;
export const SCENE_REPEAT = 4; // 4 trechos por estado (~21 s): o portal ocupa o fim de cada um
/** Deslocamento inicial do cenário na partida (a torre da primeira emenda começa fora da tela); o menu usa o mesmo. */
export const START_OFFSET = 250;
export const SCENE_W = 1620;

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

/**
 * Inimigos (GIFs do gestor viraram folhas de 4 quadros de 192x192, em `public/img/inimigos/`). `chao` = aparecem na
 * altura de pular (VIRUS_LOW); os outros flutuam na altura de abaixar (VIRUS_HIGH). A colisão é a mesma de antes.
 * `virar` = espelhar na horizontal (todos vêm da direita e devem olhar para a esquerda, para a personagem).
 */
export const ENEMIES = [
  { key: 'en_rompe_fibra', file: 'inimigos/rompe_fibra.png', fps: 6.7, chao: true, virar: false }, // Rompe Fibra: corta o cabo
  { key: 'en_pacote_corrompido', file: 'inimigos/pacote_corrompido.png', fps: 6.7, chao: true, virar: false }, // Pacote Corrompido
  { key: 'en_curto_circuito', file: 'inimigos/curto_circuito.png', fps: 8.3, chao: false, virar: false }, // Curto Circuito
  { key: 'en_lagao', file: 'inimigos/lagao.png', fps: 5.5, chao: false, virar: true }, // Lagão (o lag): espelhado para olhar para a personagem
] as const;
export const ENEMY_FRAME = 192;

/**
 * Portal da Flix na troca de estado (arte da equipe, montada por scripts/runner/montar_portal.py, desenhada em 2x).
 * `portalX`/`base`: centro e base do portal dentro do quadro; `juliaX`: onde a Julia está no 1º (entrada) ou no
 * último quadro (saída). Tudo em pixels da folha (metade disso no mundo do jogo).
 */
export const PORTAL = {
  entrada: { key: 'portal_entrada', file: 'portal/portal_entrada.png', w: 343, h: 267, portalX: 255, base: 265, juliaX: 47, quadros: 12, fps: 8 },
  saida: { key: 'portal_saida', file: 'portal/portal_saida.png', w: 403, h: 267, portalX: 86, base: 265, juliaX: 347, quadros: 19, fps: 10 },
  // o portal sozinho: abre (aparece aos poucos), gira em loop e fecha
  girando: { key: 'portal_girando', file: 'portal/portal_girando.png', w: 176, h: 266, portalX: 88, base: 266, abrir: [0, 8], girar: [9, 40], fps: 10 },
} as const;
export const ENEMY_SCALE = 0.46; // ~88 px na tela, perto do tamanho do vírus antigo (78 px)

/** Imagens carregadas na abertura: [chave, arquivo em `public/img/`]. */
export const IMAGES: ReadonlyArray<readonly [string, string]> = [
  ['menu_logo', 'menu/logo.png'], // logo Flix Runner em blocos pixel, sem fundo (780x336, desenhado em 2x; original em assets/jogos/flix-runner/menu)
  ['menu_personagem', 'menu/personagem.png'], // personagem com a arma de wifi (571x680, desenhada em 2x)
  ...SCENES.map((s) => [s.key, s.file] as const), // cenários de fundo (1620x540)
  ['torre', 'torre.png'], // torre 5G sem fundo (321x800): separa uma cidade da outra
  ['ponte', 'ponte.png'],
  ['arma', 'itens/arma.png'], // arma de wifi (bônus), 100x104
  ['bateria', 'itens/bateria.png'], // sinal de energia (bônus x3), 78x143
  // personagem de lado (recortado da folha do gestor): corrida (run_2 e run_3 têm as pernas trocadas), agachada, salto, queda e jetpack
  ...(['run_0', 'run_1', 'run_2', 'run_3', 'jump', 'fall', 'fly_0', 'fly_1'] as const).map((n) => [`pl_${n}`, `personagem/${n}.png`] as const),
  // salto com arma (4 quadros do gestor): agachar, subir, topo e descer
  ...[0, 1, 2, 3].map((i) => [`pl_jumpg_${i}`, `personagem/jumpg_${i}.png`] as const),
  // GIFs do gestor (quadros 258x246, pés na borda de baixo, personagem centrada): correndo com arma e deslizar (sem e com arma)
  ...[0, 1, 2, 3].map((i) => [`pl_rung_${i}`, `personagem/rung_${i}.png`] as const),
  ...[0, 1, 2, 3, 4, 5, 6, 7].flatMap((i) => [[`pl_slide_${i}`, `personagem/slide_${i}.png`] as const, [`pl_slideg_${i}`, `personagem/slideg_${i}.png`] as const]),
];
