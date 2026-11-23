import type Phaser from 'phaser';
import { amostrarPista, type Amostra, type Pt, type Superficie } from './logic';

/**
 * Pistas. Cada uma é só uma linha central fechada (pontos de controle); o resto sai dela:
 * pintura em pixel art (grama, areia, zebra vermelha e branca, asfalto, faixa central, largada), mapa de superfície
 * para a física e enfeites (árvores ou pneus). O mundo é bem maior que a tela (480 x 270) e a câmera segue o carro.
 */
export interface PistaDef {
  id: string;
  nome: string;
  tema: 'gramado' | 'pneus';
  w: number;
  h: number;
  /** Largura do asfalto (px). O carro tem 33 px de comprimento. */
  largura: number;
  pontos: readonly Pt[];
}

export const PISTAS: readonly PistaDef[] = [
  {
    id: 'verde',
    nome: 'Circuito Verde',
    tema: 'gramado',
    w: 1600,
    h: 1000,
    largura: 62,
    pontos: [[330, 860], [700, 880], [1100, 860], [1360, 800], [1440, 640], [1330, 520], [1120, 500], [980, 420], [1050, 300], [1220, 230], [1300, 120], [1150, 80], [900, 150], [760, 300], [700, 470], [560, 540], [430, 420], [300, 300], [160, 330], [110, 500], [130, 700], [200, 820]],
  },
  {
    id: 'pneus',
    nome: 'Pista dos Pneus',
    tema: 'pneus',
    w: 1600,
    h: 1000,
    largura: 62,
    pontos: [[260, 300], [260, 120], [480, 90], [640, 200], [640, 360], [820, 440], [1000, 360], [1000, 160], [1200, 90], [1420, 160], [1480, 340], [1400, 520], [1200, 600], [1180, 760], [1340, 880], [1200, 950], [900, 930], [760, 800], [580, 760], [380, 860], [180, 820], [120, 640], [240, 500]],
  },
];

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

/** Pinta a pista na textura `chave` e devolve a geometria e o mapa de superfície. */
export function criarPista(scene: Phaser.Scene, def: PistaDef, chave: string): PistaPronta {
  const am = amostrarPista(def.pontos);
  const cv = document.createElement('canvas');
  cv.width = def.w;
  cv.height = def.h;
  const g = cv.getContext('2d', { willReadFrequently: true })!;
  const rand = rng(def.id.length * 7919 + def.w);

  // grama com manchas
  g.fillStyle = rgb('grama');
  g.fillRect(0, 0, def.w, def.h);
  for (let i = 0; i < (def.w * def.h) / 70; i++) {
    g.fillStyle = rgb(rand() < 0.6 ? 'grama2' : 'grama3');
    g.fillRect(Math.floor(rand() * def.w), Math.floor(rand() * def.h), 2 + Math.floor(rand() * 3), 1);
  }

  g.lineJoin = 'round';
  g.lineCap = 'butt';
  const L = def.largura;
  // areia
  caminho(g, am);
  g.strokeStyle = rgb('areia');
  g.lineWidth = L + 2 * (ZEBRA + AREIA);
  g.stroke();
  // zebra: dois traçados tracejados alternados (vermelho e branco)
  const dash = 7;
  g.lineWidth = L + 2 * ZEBRA;
  g.setLineDash([dash, dash]);
  g.strokeStyle = rgb('vermelho');
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
  for (let i = 0; i < def.w * def.h; i++) {
    const r = d[i * 4]!, gg = d[i * 4 + 1]!, b = d[i * 4 + 2]!;
    let melhor = 0;
    let dm = Infinity;
    for (let k = 0; k < paleta.length; k++) {
      const c = paleta[k]!;
      const dd = (c[0] - r) ** 2 + (c[1] - gg) ** 2 + (c[2] - b) ** 2;
      if (dd < dm) {
        dm = dd;
        melhor = k;
      }
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
    disco(g, x + 3, y + 4, r, 'sombra');
    disco(g, x, y, r, 'copa');
    disco(g, x - 1, y - 2, Math.max(2, r - 3), 'copaClara');
  };
  if (def.tema === 'gramado') {
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
        disco(g, x + 1, y + 1, 3, 'sombra');
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
