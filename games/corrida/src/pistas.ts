import type Phaser from 'phaser';
import { amostrarPista, type Amostra, type Pt, type Superficie } from './logic';
import { PISTAS_ARTE } from './pistasDados';

/**
 * Pistas. Cada uma é só uma linha central fechada (pontos de controle); o resto sai dela:
 * pintura em pixel art (grama, areia, zebra vermelha e branca, asfalto, faixa central, largada), mapa de superfície
 * para a física e enfeites (árvores ou pneus). O mundo é bem maior que a tela (480 x 270) e a câmera segue o carro.
 */
export type Tema = 'gramado' | 'pneus' | 'obra' | 'cidade' | 'lago';

export interface PistaDef {
  id: string;
  nome: string;
  /** Tema do cenário pintado por código (pista sem arte). */
  tema?: Tema;
  w: number;
  h: number;
  /** Largura do asfalto (px). O carro tem 41 px de comprimento (a pista tem 2,3 carros de largura). */
  largura: number;
  pontos: readonly Pt[];
  /** A pista cruza com ela mesma (como o oito de Suzuka). */
  cruza?: boolean;
  /**
   * Arte da equipe (cenário inteiro num PNG, carregado no preload com a chave `pista_<id>`): o jogo só amplia a imagem
   * `escala` vezes, sem suavizar. Sem arte, a pista é pintada por código a partir do `tema`.
   */
  arte?: string;
  escala?: number;
  /** Grid de largada desenhado na arte: posição de cada carro (1º ao 11º). Sem ele, o jogo monta o grid sozinho. */
  grade?: readonly Pt[];
}

/** Pistas antigas, pintadas por código (fora do jogo desde as pistas da equipe; ficam como referência de tema). */
export const PISTAS_PINTADAS: readonly PistaDef[] = [
  {
    id: 'melbourne',
    nome: 'Melbourne',
    tema: 'lago',
    w: 1000,
    h: 625,
    largura: 94,
    pontos: [[560, 545], [380, 560], [230, 520], [140, 430], [130, 320], [190, 215], [310, 170], [420, 215], [470, 300], [560, 330], [650, 260], [760, 175], [860, 215], [885, 330], [850, 440], [740, 500], [650, 545]],
  },
  {
    id: 'shanghai',
    nome: 'Xangai',
    tema: 'cidade',
    w: 1000,
    h: 625,
    largura: 94,
    pontos: [[300, 550], [520, 556], [700, 548], [830, 500], [880, 420], [840, 340], [760, 330], [720, 390], [650, 440], [570, 420], [540, 340], [600, 260], [700, 210], [610, 150], [450, 115], [290, 125], [160, 175], [115, 265], [190, 335], [260, 420], [235, 500]],
  },
  {
    id: 'suzuka',
    nome: 'Suzuka',
    tema: 'gramado',
    w: 1000,
    h: 625,
    largura: 94,
    cruza: true,
    pontos: [[860, 310], [845, 251], [803, 210], [736, 201], [650, 227], [551, 279], [449, 341], [350, 393], [264, 419], [197, 410], [155, 369], [140, 310], [155, 251], [197, 210], [264, 201], [350, 227], [449, 279], [551, 341], [650, 393], [736, 419], [803, 410], [845, 369]],
  },
  {
    id: 'sakhir',
    nome: 'Sakhir',
    tema: 'obra',
    w: 1000,
    h: 625,
    largura: 94,
    pontos: [[350, 540], [600, 545], [820, 540], [890, 485], [870, 415], [770, 395], [710, 345], [770, 295], [860, 275], [900, 210], [865, 140], [770, 115], [700, 160], [640, 230], [560, 260], [500, 205], [460, 135], [380, 110], [300, 150], [260, 230], [180, 260], [120, 330], [140, 420], [220, 470], [290, 520]],
  },
  {
    id: 'jeddah',
    nome: 'Jeddah',
    tema: 'cidade',
    w: 1000,
    h: 625,
    largura: 94,
    pontos: [[500, 470], [680, 470], [820, 440], [900, 380], [880, 300], [800, 250], [700, 230], [600, 260], [500, 230], [400, 200], [300, 230], [200, 215], [120, 260], [100, 340], [150, 420], [260, 455], [380, 470]],
  },
  {
    id: 'miami',
    nome: 'Miami',
    tema: 'cidade',
    w: 1000,
    h: 625,
    largura: 94,
    pontos: [[450, 545], [640, 550], [800, 520], [880, 440], [830, 360], [720, 350], [640, 290], [710, 220], [840, 200], [900, 130], [800, 95], [660, 105], [560, 170], [480, 250], [400, 200], [300, 140], [180, 150], [115, 240], [160, 330], [250, 380], [210, 450], [260, 520]],
  },
  {
    id: 'montreal',
    nome: 'Montreal',
    tema: 'lago',
    w: 1000,
    h: 625,
    largura: 94,
    pontos: [[400, 560], [640, 565], [840, 545], [910, 470], [860, 400], [720, 390], [640, 330], [700, 260], [840, 250], [910, 180], [860, 105], [700, 95], [560, 150], [470, 240], [380, 190], [290, 110], [170, 120], [110, 210], [150, 300], [250, 350], [210, 430], [260, 500]],
  },
  {
    id: 'montecarlo',
    nome: 'Mônaco',
    tema: 'cidade',
    w: 1000,
    h: 625,
    largura: 94,
    pontos: [[420, 520], [560, 500], [700, 430], [790, 350], [870, 300], [910, 220], [850, 150], [760, 160], [700, 230], [620, 260], [540, 200], [480, 120], [380, 100], [290, 150], [250, 230], [170, 280], [115, 370], [160, 450], [260, 500]],
  },
  {
    id: 'barcelona',
    nome: 'Barcelona',
    tema: 'gramado',
    w: 1000,
    h: 625,
    largura: 94,
    pontos: [[500, 560], [700, 565], [860, 520], [900, 430], [850, 350], [760, 330], [700, 260], [780, 190], [870, 150], [840, 95], [720, 110], [620, 170], [520, 140], [420, 100], [320, 135], [250, 215], [160, 260], [110, 350], [150, 440], [250, 490], [330, 545]],
  },
  {
    id: 'redbull',
    nome: 'Spielberg',
    tema: 'gramado',
    w: 1000,
    h: 625,
    largura: 94,
    pontos: [[540, 540], [700, 520], [830, 470], [900, 390], [860, 290], [780, 220], [680, 180], [580, 115], [470, 150], [390, 230], [300, 260], [200, 320], [140, 420], [190, 500], [300, 545], [420, 550]],
  },
  {
    id: 'silverstone',
    nome: 'Silverstone',
    tema: 'gramado',
    w: 1000,
    h: 625,
    largura: 94,
    pontos: [[520, 560], [720, 565], [850, 520], [890, 430], [820, 360], [720, 340], [660, 270], [720, 200], [830, 160], [850, 100], [720, 95], [600, 150], [520, 230], [420, 210], [340, 150], [230, 130], [130, 180], [115, 280], [190, 350], [290, 380], [300, 460], [260, 530], [380, 556]],
  },
  {
    id: 'spa',
    nome: 'Spa',
    tema: 'gramado',
    w: 1000,
    h: 625,
    largura: 94,
    pontos: [[480, 560], [660, 550], [800, 490], [880, 390], [900, 290], [840, 200], [740, 150], [650, 100], [540, 130], [470, 210], [380, 250], [300, 200], [200, 150], [130, 210], [120, 320], [190, 400], [280, 430], [330, 500], [400, 556]],
  },
  {
    id: 'hungaroring',
    nome: 'Budapeste',
    tema: 'gramado',
    w: 1000,
    h: 625,
    largura: 94,
    pontos: [[480, 555], [660, 560], [800, 520], [860, 440], [800, 370], [700, 380], [620, 330], [690, 260], [790, 240], [850, 170], [790, 100], [660, 100], [560, 160], [470, 110], [350, 95], [240, 140], [180, 230], [250, 300], [180, 380], [130, 470], [200, 540], [320, 556]],
  },
  {
    id: 'zandvoort',
    nome: 'Zandvoort',
    tema: 'pneus',
    w: 1000,
    h: 625,
    largura: 94,
    pontos: [[500, 555], [690, 560], [830, 520], [890, 430], [820, 350], [700, 340], [630, 270], [700, 190], [810, 150], [780, 95], [650, 100], [560, 170], [470, 240], [380, 180], [300, 110], [190, 120], [125, 210], [170, 300], [260, 350], [200, 430], [150, 510], [260, 545]],
  },
  {
    id: 'monza',
    nome: 'Monza',
    tema: 'gramado',
    w: 1000,
    h: 625,
    largura: 94,
    pontos: [[450, 520], [650, 520], [800, 515], [880, 470], [910, 390], [880, 320], [800, 290], [700, 300], [600, 280], [500, 240], [400, 215], [300, 200], [210, 215], [140, 270], [120, 350], [160, 430], [240, 490], [340, 515]],
  },
  {
    id: 'madrid',
    nome: 'Madri',
    tema: 'cidade',
    w: 1000,
    h: 625,
    largura: 94,
    pontos: [[450, 550], [650, 555], [800, 530], [890, 460], [885, 375], [800, 320], [700, 335], [630, 275], [670, 200], [760, 170], [840, 150], [870, 110], [800, 85], [690, 100], [590, 160], [500, 200], [420, 140], [330, 105], [230, 140], [160, 220], [190, 310], [120, 380], [130, 470], [220, 525], [320, 550]],
  },
  {
    id: 'baku',
    nome: 'Baku',
    tema: 'cidade',
    w: 1000,
    h: 625,
    largura: 94,
    pontos: [[430, 550], [680, 555], [860, 545], [920, 480], [900, 400], [820, 360], [740, 380], [690, 320], [730, 250], [820, 215], [900, 160], [860, 100], [740, 92], [640, 140], [560, 205], [480, 170], [400, 105], [290, 95], [200, 135], [150, 215], [190, 290], [150, 370], [120, 460], [190, 530], [300, 552]],
  },
  {
    id: 'marinabay',
    nome: 'Singapura',
    tema: 'cidade',
    w: 1000,
    h: 625,
    largura: 94,
    pontos: [[500, 545], [700, 545], [830, 540], [890, 470], [860, 390], [770, 380], [700, 320], [780, 255], [880, 230], [910, 150], [830, 100], [700, 110], [620, 175], [540, 115], [430, 95], [330, 130], [250, 200], [310, 270], [220, 330], [130, 380], [130, 470], [230, 520], [360, 548]],
  },
  {
    id: 'austin',
    nome: 'Austin',
    tema: 'gramado',
    w: 1000,
    h: 625,
    largura: 94,
    pontos: [[470, 560], [660, 556], [810, 500], [880, 410], [850, 320], [770, 260], [840, 190], [870, 110], [760, 95], [640, 150], [560, 230], [460, 200], [380, 130], [280, 100], [190, 150], [150, 240], [220, 310], [150, 380], [125, 470], [210, 530], [330, 552]],
  },
  {
    id: 'mexico',
    nome: 'Cidade do México',
    tema: 'cidade',
    w: 1000,
    h: 625,
    largura: 94,
    pontos: [[440, 550], [670, 556], [840, 540], [900, 470], [870, 390], [780, 360], [700, 300], [750, 230], [850, 200], [900, 130], [820, 92], [700, 110], [600, 170], [510, 240], [430, 170], [340, 110], [230, 120], [150, 190], [120, 290], [190, 360], [140, 430], [150, 510], [260, 548]],
  },
  {
    id: 'interlagos',
    nome: 'São Paulo',
    tema: 'gramado',
    w: 1000,
    h: 625,
    largura: 94,
    pontos: [[520, 540], [690, 520], [800, 450], [840, 360], [790, 285], [700, 275], [640, 215], [690, 150], [770, 120], [680, 100], [580, 115], [480, 160], [400, 215], [310, 190], [230, 140], [150, 170], [120, 260], [170, 340], [250, 385], [200, 450], [270, 520], [400, 548]],
  },
  {
    id: 'lasvegas',
    nome: 'Las Vegas',
    tema: 'cidade',
    w: 1000,
    h: 625,
    largura: 94,
    pontos: [[430, 550], [700, 556], [870, 545], [920, 470], [900, 370], [800, 330], [780, 240], [860, 170], [900, 100], [760, 92], [560, 95], [380, 100], [250, 130], [170, 200], [130, 290], [190, 360], [130, 430], [150, 505], [260, 548]],
  },
  {
    id: 'losail',
    nome: 'Lusail',
    tema: 'lago',
    w: 1000,
    h: 625,
    largura: 94,
    pontos: [[450, 550], [660, 556], [820, 520], [900, 440], [880, 350], [790, 300], [700, 330], [630, 270], [690, 200], [790, 165], [860, 120], [800, 85], [690, 95], [590, 150], [500, 210], [420, 150], [320, 105], [210, 125], [145, 200], [180, 290], [260, 340], [200, 420], [150, 500], [250, 540], [340, 552]],
  },
  {
    id: 'yas',
    nome: 'Abu Dhabi',
    tema: 'obra',
    w: 1000,
    h: 625,
    largura: 94,
    pontos: [[470, 550], [690, 556], [850, 540], [910, 470], [880, 390], [790, 370], [700, 310], [750, 240], [850, 220], [905, 150], [840, 100], [710, 92], [600, 135], [520, 200], [430, 160], [340, 100], [230, 105], [150, 170], [130, 260], [200, 330], [140, 400], [130, 480], [220, 535], [330, 550]],
  },
];

/**
 * As 24 pistas do jogo: arte e traçado da equipe (assets/jogos/corrida/pistas), na ordem do pôster, preparados por
 * scripts/corrida/montar_pistas.py (linha central, largura e mundo já ampliados 4x).
 */
export const PISTAS: readonly PistaDef[] = PISTAS_ARTE;

/** Chave da textura da arte da pista. */
export const chaveArte = (def: PistaDef): string => `pista_${def.id}`;

const ZEBRA = 5; // largura da zebra de cada lado
const AREIA = 16; // largura da faixa de areia depois da zebra

// Paleta (a imagem é reduzida a estas cores: sem bordas suavizadas)
const P = {
  grama: [90, 158, 60],
  grama2: [100, 170, 68],
  grama3: [80, 146, 54],
  areia: [232, 204, 140],
  areia2: [220, 190, 124],
  vermelho: [216, 40, 30],
  zebraBranco: [246, 246, 246],
  asfalto: [62, 62, 68],
  asfalto2: [70, 70, 76],
  faixa: [240, 240, 240],
  preto: [28, 28, 32],
  copa: [48, 124, 52],
  copaClara: [78, 156, 66],
  sombra: [68, 126, 46],
  pneuCinza: [138, 138, 146],
  terra: [150, 112, 72],
  terra2: [162, 124, 82],
  terra3: [138, 102, 64],
  concreto: [148, 152, 154],
  concreto2: [158, 162, 164],
  concreto3: [138, 142, 144],
  calcada: [206, 204, 196],
  laranja: [246, 124, 24],
  agua: [58, 128, 200],
  agua2: [110, 172, 228],
  sombraTerra: [112, 82, 52],
  sombraConcreto: [112, 116, 120],
  telhado: [196, 198, 206],
  telhado2: [166, 168, 178],
  telhadoVerm: [212, 20, 44],
  telhadoAzul: [62, 102, 172],
  carretel: [196, 144, 62],
  carretelEscuro: [120, 84, 36],
} as const;
type Cor = keyof typeof P;
const NOMES = Object.keys(P) as Cor[];
const SUP: Partial<Record<Cor, Superficie>> = {
  asfalto: 'asfalto',
  asfalto2: 'asfalto',
  faixa: 'asfalto',
  preto: 'asfalto',
  vermelho: 'zebra',
  zebraBranco: 'zebra',
  areia: 'areia',
  areia2: 'areia',
  calcada: 'areia',
  laranja: 'zebra',
};

/** Cores de cada tema: chão (3 tons), faixa fora do asfalto, cor da zebra e da sombra dos enfeites. */
const TEMAS: Record<Tema, { chao: [Cor, Cor, Cor]; runoff: Cor; zebra: Cor; sombra: Cor }> = {
  gramado: { chao: ['grama', 'grama2', 'grama3'], runoff: 'areia', zebra: 'vermelho', sombra: 'sombra' },
  pneus: { chao: ['grama', 'grama2', 'grama3'], runoff: 'areia', zebra: 'vermelho', sombra: 'sombra' },
  obra: { chao: ['terra', 'terra2', 'terra3'], runoff: 'areia', zebra: 'laranja', sombra: 'sombraTerra' },
  cidade: { chao: ['concreto', 'concreto2', 'concreto3'], runoff: 'calcada', zebra: 'vermelho', sombra: 'sombraConcreto' },
  lago: { chao: ['grama', 'grama2', 'grama3'], runoff: 'areia', zebra: 'vermelho', sombra: 'sombra' },
};

export interface PistaPronta {
  def: PistaDef;
  amostras: Amostra[];
  /** Superfície no pixel (x, y) do mundo. */
  superficie(x: number, y: number): Superficie;
}

function rng(semente: number): () => number {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function caminho(g: CanvasRenderingContext2D, am: readonly Amostra[]): void {
  g.beginPath();
  am.forEach((a, i) => (i ? g.lineTo(a.x, a.y) : g.moveTo(a.x, a.y)));
  g.closePath();
}

function rgb(c: Cor): string {
  const [r, g, b] = P[c];
  return `rgb(${r},${g},${b})`;
}

function disco(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, cor: Cor): void {
  g.fillStyle = rgb(cor);
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.floor(Math.sqrt(r * r + 0.5 - dy * dy));
    g.fillRect(Math.round(cx) - w, Math.round(cy) + dy, w * 2 + 1, 1);
  }
}

/**
 * Pista com arte da equipe: a imagem já está carregada (`chaveArte`); aqui só sai o mapa de superfície, da geometria
 * (linha central e largura), na resolução da imagem (1 célula = `escala` px do mundo): asfalto, zebra, areia, grama.
 */
function criarPistaDeArte(def: PistaDef): PistaPronta {
  const am = amostrarPista(def.pontos);
  const k = def.escala ?? 1;
  const mw = Math.ceil(def.w / k), mh = Math.ceil(def.h / k);
  const cv = document.createElement('canvas');
  cv.width = mw;
  cv.height = mh;
  const g = cv.getContext('2d', { willReadFrequently: true })!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, mw, mh);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const tracar = (largura: number, cor: string) => {
    g.beginPath();
    am.forEach((a, i) => (i ? g.lineTo(a.x / k, a.y / k) : g.moveTo(a.x / k, a.y / k)));
    g.closePath();
    g.strokeStyle = cor;
    g.lineWidth = largura / k;
    g.stroke();
  };
  const L = def.largura;
  tracar(L + 2 * (ZEBRA + AREIA), '#0000ff'); // areia
  tracar(L + 2 * ZEBRA, '#00ff00'); // zebra
  tracar(L, '#ff0000'); // asfalto
  const d = g.getImageData(0, 0, mw, mh).data;
  const mapa = new Uint8Array(mw * mh); // 0 grama, 1 asfalto, 2 zebra, 3 areia (a cor mais forte da célula vence)
  for (let i = 0; i < mw * mh; i++) {
    const r = d[i * 4]!, gg = d[i * 4 + 1]!, b = d[i * 4 + 2]!;
    const m = Math.max(r, gg, b);
    mapa[i] = m < 100 ? 0 : m === r ? 1 : m === gg ? 2 : 3;
  }
  const sup: Superficie[] = ['grama', 'asfalto', 'zebra', 'areia'];
  return {
    def,
    amostras: am,
    superficie: (x, y) => {
      const xx = Math.floor(x / k), yy = Math.floor(y / k);
      if (xx < 0 || yy < 0 || xx >= mw || yy >= mh) return 'grama';
      return sup[mapa[yy * mw + xx]!]!;
    },
  };
}

/** Pinta a pista na textura `chave` e devolve a geometria e o mapa de superfície (pista com arte: só o mapa). */
export function criarPista(scene: Phaser.Scene, def: PistaDef, chave: string): PistaPronta {
  if (def.arte) return criarPistaDeArte(def);
  const am = amostrarPista(def.pontos);
  const cv = document.createElement('canvas');
  cv.width = def.w;
  cv.height = def.h;
  const g = cv.getContext('2d', { willReadFrequently: true })!;
  const rand = rng(def.id.length * 7919 + def.w);

  // grama com manchas
  const tema = def.tema ?? 'gramado';
  const T = TEMAS[tema];
  g.fillStyle = rgb(T.chao[0]);
  g.fillRect(0, 0, def.w, def.h);
  for (let i = 0; i < (def.w * def.h) / 70; i++) {
    g.fillStyle = rgb(rand() < 0.6 ? T.chao[1] : T.chao[2]);
    g.fillRect(Math.floor(rand() * def.w), Math.floor(rand() * def.h), 2 + Math.floor(rand() * 3), 1);
  }

  g.lineJoin = 'round';
  g.lineCap = 'butt';
  const L = def.largura;
  // areia
  caminho(g, am);
  g.strokeStyle = rgb(T.runoff);
  g.lineWidth = L + 2 * (ZEBRA + AREIA);
  g.stroke();
  // zebra: dois traçados tracejados alternados (vermelho e branco)
  const dash = 7;
  g.lineWidth = L + 2 * ZEBRA;
  g.setLineDash([dash, dash]);
  g.strokeStyle = rgb(T.zebra);
  g.lineDashOffset = 0;
  caminho(g, am);
  g.stroke();
  g.strokeStyle = rgb('zebraBranco');
  g.lineDashOffset = dash;
  caminho(g, am);
  g.stroke();
  g.setLineDash([]);
  // asfalto
  g.strokeStyle = rgb('asfalto');
  g.lineWidth = L;
  caminho(g, am);
  g.stroke();
  // faixa central tracejada
  g.strokeStyle = rgb('faixa');
  g.lineWidth = 2;
  g.setLineDash([10, 12]);
  caminho(g, am);
  g.stroke();
  g.setLineDash([]);
  // linha de largada (xadrez em 2 colunas), perpendicular à pista na amostra 0
  const a0 = am[0]!;
  g.save();
  g.translate(Math.round(a0.x), Math.round(a0.y));
  g.rotate(a0.ang);
  const q = 4;
  for (let j = -Math.floor(L / 2 / q); j < Math.floor(L / 2 / q); j++) {
    for (let i = 0; i < 2; i++) {
      g.fillStyle = (i + j) % 2 === 0 ? rgb('faixa') : rgb('preto');
      g.fillRect(i * q - q, j * q, q, q);
    }
  }
  g.restore();

  // reduz à paleta (tira o serrilhado suave) e monta o mapa de superfície
  const img = g.getImageData(0, 0, def.w, def.h);
  const d = img.data;
  const mapa = new Uint8Array(def.w * def.h); // 0 grama, 1 asfalto, 2 zebra, 3 areia
  const paleta = NOMES.map((n) => P[n]);
  const cache = new Map<number, number>();
  for (let i = 0; i < def.w * def.h; i++) {
    const r = d[i * 4]!, gg = d[i * 4 + 1]!, b = d[i * 4 + 2]!;
    const chaveCor = (r << 16) | (gg << 8) | b;
    let melhor = cache.get(chaveCor);
    if (melhor === undefined) {
      melhor = 0;
      let dm = Infinity;
      for (let k = 0; k < paleta.length; k++) {
        const c = paleta[k]!;
        const dd = (c[0] - r) ** 2 + (c[1] - gg) ** 2 + (c[2] - b) ** 2;
        if (dd < dm) {
          dm = dd;
          melhor = k;
        }
      }
      cache.set(chaveCor, melhor);
    }
    const c = paleta[melhor]!;
    d[i * 4] = c[0];
    d[i * 4 + 1] = c[1];
    d[i * 4 + 2] = c[2];
    const s = SUP[NOMES[melhor]!];
    mapa[i] = s === 'asfalto' ? 1 : s === 'zebra' ? 2 : s === 'areia' ? 3 : 0;
  }
  g.putImageData(img, 0, 0);
  const sup: Superficie[] = ['grama', 'asfalto', 'zebra', 'areia'];
  const livre = (x: number, y: number, folga: number): boolean => {
    for (let dy = -folga; dy <= folga; dy += 2) {
      for (let dx = -folga; dx <= folga; dx += 2) {
        const xx = Math.round(x + dx), yy = Math.round(y + dy);
        if (xx < 0 || yy < 0 || xx >= def.w || yy >= def.h || mapa[yy * def.w + xx] !== 0) return false;
      }
    }
    return true;
  };

  // enfeites (só na grama, longe da pista)
  const arvore = (x: number, y: number, r: number): void => {
    disco(g, x + 3, y + 4, r, T.sombra);
    disco(g, x, y, r, 'copa');
    disco(g, x - 1, y - 2, Math.max(2, r - 3), 'copaClara');
  };
  const livreRet = (x: number, y: number, w: number, h: number, folga: number): boolean => {
    for (let yy = y - folga; yy <= y + h + folga; yy += 4) {
      for (let xx = x - folga; xx <= x + w + folga; xx += 4) {
        if (xx < 0 || yy < 0 || xx >= def.w || yy >= def.h || mapa[yy * def.w + xx] !== 0) return false;
      }
    }
    return true;
  };
  const ret = (x: number, y: number, w: number, h: number, cor: Cor): void => {
    g.fillStyle = rgb(cor);
    g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };
  const distBorda = L / 2 + ZEBRA + AREIA + 4;
  if (tema === 'cidade') {
    // quarteirões: prédios vistos de cima (telhado, sombra e caixas de ar), com algumas árvores pequenas nas calçadas
    const telhados: Cor[] = ['telhado', 'telhado2', 'telhadoVerm', 'telhadoAzul', 'telhado'];
    for (let i = 0; i < 420; i++) {
      const w = 40 + Math.floor(rand() * 50), h = 40 + Math.floor(rand() * 50);
      const x = Math.round(12 + rand() * (def.w - 24 - w)), y = Math.round(12 + rand() * (def.h - 24 - h));
      if (!livreRet(x, y, w + 6, h + 6, 10)) continue;
      const cor = telhados[Math.floor(rand() * telhados.length)]!;
      ret(x + 6, y + 7, w, h, T.sombra);
      ret(x, y, w, h, 'preto');
      ret(x + 2, y + 2, w - 4, h - 4, cor);
      ret(x + 2, y + 2, w - 4, 3, 'faixa'); // beirada clara
      ret(x + 8, y + 10, 10, 8, 'preto');
      ret(x + 9, y + 11, 8, 6, 'telhado2');
      if (w > 60) ret(x + w - 22, y + h - 20, 12, 10, 'telhado2');
    }
    for (let i = 0; i < 120; i++) {
      const x = 12 + rand() * (def.w - 24), y = 12 + rand() * (def.h - 24);
      if (livre(x, y, 8)) arvore(x, y, 4);
    }
  } else if (tema === 'obra') {
    // cones ao longo da pista e carretéis de cabo no canteiro
    for (let i = 0; i < am.length; i += 5) {
      const a = am[i]!;
      for (const lado of [-1, 1]) {
        const x = a.x - Math.sin(a.ang) * distBorda * lado, y = a.y + Math.cos(a.ang) * distBorda * lado;
        if (!livre(x, y, 3)) continue;
        disco(g, x + 1, y + 2, 3, T.sombra);
        disco(g, x, y, 3, 'laranja');
        disco(g, x, y, 1, 'faixa');
      }
    }
    for (let i = 0; i < 70; i++) {
      const x = 14 + rand() * (def.w - 28), y = 14 + rand() * (def.h - 28);
      if (!livre(x, y, 12)) continue;
      disco(g, x + 3, y + 4, 8, T.sombra);
      disco(g, x, y, 8, 'carretelEscuro');
      disco(g, x, y, 6, 'carretel');
      disco(g, x, y, 3, 'carretelEscuro');
      disco(g, x, y, 1, 'preto');
    }
    for (let i = 0; i < 40; i++) {
      const x = 14 + rand() * (def.w - 28), y = 14 + rand() * (def.h - 28);
      if (livre(x, y, 10)) {
        disco(g, x, y, 6, 'terra3'); // montes de terra
        disco(g, x - 1, y - 1, 3, 'terra2');
      }
    }
  } else if (tema === 'lago') {
    // lagos (água com margem de areia) e árvores
    for (let i = 0; i < 40; i++) {
      const rx = 30 + rand() * 50, ry = 20 + rand() * 30;
      const x = rx + 14 + rand() * (def.w - 2 * rx - 28), y = ry + 14 + rand() * (def.h - 2 * ry - 28);
      if (!livreRet(x - rx, y - ry, rx * 2, ry * 2, 14)) continue;
      for (const [k, cor] of [[1.18, 'areia'], [1, 'agua'], [0.7, 'agua2'], [0.62, 'agua']] as const) {
        g.fillStyle = rgb(cor);
        for (let yy = -ry * k; yy <= ry * k; yy++) {
          const w = Math.floor(rx * k * Math.sqrt(Math.max(0, 1 - (yy / (ry * k)) ** 2)));
          g.fillRect(Math.round(x) - w, Math.round(y + yy), w * 2 + 1, 1);
        }
      }
    }
    for (let i = 0; i < 160; i++) {
      const x = 12 + rand() * (def.w - 24), y = 12 + rand() * (def.h - 24);
      const r = 5 + Math.floor(rand() * 4);
      if (livre(x, y, r + 5)) arvore(x, y, r);
    }
  } else if (tema === 'gramado') {
    for (let i = 0; i < 260; i++) {
      const x = 12 + rand() * (def.w - 24), y = 12 + rand() * (def.h - 24);
      const r = 5 + Math.floor(rand() * 4);
      if (livre(x, y, r + 5)) arvore(x, y, r);
    }
  } else {
    // fileiras de pneus (pretos, com um miolo cinza ou vermelho) um pouco depois da areia
    const dist = L / 2 + ZEBRA + AREIA + 4;
    for (let i = 0; i < am.length; i += 3) {
      const a = am[i]!;
      for (const lado of [-1, 1]) {
        const x = a.x - Math.sin(a.ang) * dist * lado;
        const y = a.y + Math.cos(a.ang) * dist * lado;
        if (!livre(x, y, 3)) continue;
        disco(g, x + 1, y + 1, 3, T.sombra);
        disco(g, x, y, 3, 'preto');
        disco(g, x, y, 1, i % 6 === 0 ? 'vermelho' : 'pneuCinza');
      }
    }
    for (let i = 0; i < 90; i++) {
      const x = 12 + rand() * (def.w - 24), y = 12 + rand() * (def.h - 24);
      if (livre(x, y, 10)) arvore(x, y, 6);
    }
  }

  if (scene.textures.exists(chave)) scene.textures.remove(chave);
  const tex = scene.textures.createCanvas(chave, def.w, def.h)!;
  tex.getContext().drawImage(cv, 0, 0);
  tex.refresh();

  return {
    def,
    amostras: am,
    superficie: (x, y) => {
      const xx = Math.round(x), yy = Math.round(y);
      if (xx < 0 || yy < 0 || xx >= def.w || yy >= def.h) return 'grama';
      return sup[mapa[yy * def.w + xx]!]!;
    },
  };
}
