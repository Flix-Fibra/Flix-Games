import Phaser from 'phaser';

/**
 * Carro em *sprite stacking*: um modelo feito de fatias (cada uma é um desenho de cima de uma camada do carro,
 * da base ao topo). Para girar, cada fatia é girada pelo mesmo ângulo e empilhada 1 pixel acima da anterior.
 *
 * Em vez de empilhar a cada quadro (várias imagens por carro, ordenação e arredondamento por fatia), o empilhamento
 * é feito uma vez no carregamento: para cada ângulo sai um quadro pronto. O carro no jogo é uma imagem comum, com
 * um único pipeline de desenho, posição em pixels inteiros e ordenação pelo ponto de contato com o chão.
 *
 * Para trocar o modelo: edite `FATIAS` (ou entregue uma folha de fatias e use `fatiasDeFolha`).
 */

/** Comprimento x largura de cada fatia. Frente do carro = lado direito. Tamanhos ímpares: o centro cai em um pixel. */
export const FATIA_W = 33;
export const FATIA_H = 15;
/** Quadros de rotação (cada um gira 360/ANGULOS graus). */
export const ANGULOS = 72;
/** Lado do quadro pronto. */
export const QUADRO = 48;

type Token = 'B' | 'D' | 'K' | 'W' | 'H';
/** x, y, largura, altura, cor */
type Ret = readonly [number, number, number, number, Token];

const RODAS: Ret[] = [
  [3, 0, 5, 3, 'K'], [3, 8, 5, 3, 'K'], // traseiras
  [16, 0, 5, 3, 'K'], [16, 8, 5, 3, 'K'], // dianteiras
];

/** Da base (0) ao topo. As cinco primeiras camadas também levam as rodas. */
/** Modelo desenhado em 25 x 11; `FATIAS` é o mesmo modelo ampliado para FATIA_W x FATIA_H. */
const BASE_W = 25;
const BASE_H = 11;
const BASE: ReadonlyArray<readonly Ret[]> = [
  [...RODAS, [4, 3, 19, 5, 'D'], [22, 1, 3, 9, 'W']],
  [...RODAS, [4, 3, 18, 5, 'B'], [21, 4, 3, 3, 'B'], [22, 1, 3, 9, 'W'], [8, 2, 8, 1, 'D'], [8, 8, 8, 1, 'D']],
  [...RODAS, [5, 3, 15, 5, 'B'], [20, 4, 3, 3, 'B'], [3, 4, 2, 3, 'D'], [9, 2, 6, 1, 'B'], [9, 8, 6, 1, 'B']],
  [...RODAS, [6, 3, 13, 5, 'B'], [19, 4, 3, 3, 'B'], [3, 4, 2, 3, 'D'], [13, 5, 8, 1, 'W']],
  [...RODAS, [6, 3, 4, 5, 'B'], [10, 3, 2, 5, 'D'], [12, 4, 6, 3, 'D'], [18, 4, 3, 3, 'B'], [3, 4, 2, 3, 'D'], [19, 5, 2, 1, 'W']],
  [[6, 4, 5, 3, 'B'], [11, 4, 2, 3, 'D'], [11, 4, 5, 3, 'H'], [0, 1, 5, 9, 'W'], [6, 5, 8, 1, 'W']],
  [[7, 5, 4, 1, 'B'], [13, 5, 2, 1, 'H'], [0, 1, 5, 9, 'W']],
  [[0, 1, 5, 1, 'W'], [0, 9, 5, 1, 'W'], [1, 2, 4, 7, 'W']],
];

const ampliar = (v: number, de: number, para: number): number => Math.round((v * para) / de);
export const FATIAS: ReadonlyArray<readonly Ret[]> = BASE.map((rets) =>
  rets.map(([x, y, w, h, t]): Ret => {
    const x0 = ampliar(x, BASE_W, FATIA_W), x1 = ampliar(x + w, BASE_W, FATIA_W);
    const y0 = ampliar(y, BASE_H, FATIA_H), y1 = ampliar(y + h, BASE_H, FATIA_H);
    return [x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0), t];
  }),
);

function hex(c: number, k = 1): string {
  const r = Math.min(255, Math.round(((c >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((c >> 8) & 255) * k));
  const b = Math.min(255, Math.round((c & 255) * k));
  return `rgb(${r},${g},${b})`;
}

function paleta(cor: number): Record<Token, number> {
  const mix = (c: number, k: number) => (Math.round(((c >> 16) & 255) * k) << 16) | (Math.round(((c >> 8) & 255) * k) << 8) | Math.round((c & 255) * k);
  return { B: cor, D: mix(cor, 0.55), K: 0x1c1c20, W: 0xf2f2f2, H: 0xffd23f };
}

/** Desenha as fatias (cada uma num canvas FATIA_W x FATIA_H) com sombreado por altura e contorno escuro. */
export function criarFatias(cor: number): HTMLCanvasElement[] {
  const pal = paleta(cor);
  return FATIAS.map((rets, i) => {
    const cv = document.createElement('canvas');
    cv.width = FATIA_W;
    cv.height = FATIA_H;
    const g = cv.getContext('2d')!;
    const luz = 0.7 + 0.3 * (i / (FATIAS.length - 1)); // quanto mais alto, mais claro
    const mapa = new Array<number>(FATIA_W * FATIA_H).fill(-1);
    for (const [x, y, w, h, t] of rets) {
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) mapa[yy * FATIA_W + xx] = pal[t];
    }
    for (let y = 0; y < FATIA_H; y++) {
      for (let x = 0; x < FATIA_W; x++) {
        const c = mapa[y * FATIA_W + x]!;
        if (c < 0) continue;
        const vazio = (xx: number, yy: number) => xx < 0 || yy < 0 || xx >= FATIA_W || yy >= FATIA_H || mapa[yy * FATIA_W + xx]! < 0;
        const borda = vazio(x - 1, y) || vazio(x + 1, y) || vazio(x, y - 1) || vazio(x, y + 1);
        g.fillStyle = hex(c, borda ? luz * 0.62 : luz);
        g.fillRect(x, y, 1, 1);
      }
    }
    return cv;
  });
}

/**
 * Empilha as fatias já giradas num quadro. `ang` em radianos (0 = frente para a direita).
 * Cada fatia gira em torno do próprio centro, sem suavização (vizinho mais próximo).
 */
export function desenharQuadro(g: CanvasRenderingContext2D, fatias: HTMLCanvasElement[], ang: number, ox: number, oy: number): void {
  g.imageSmoothingEnabled = false;
  const cx = ox + QUADRO / 2 + 0.5;
  const cy = oy + QUADRO / 2 + 0.5;
  // sombra no chão: silhueta da fatia 0, deslocada
  const sil = document.createElement('canvas');
  sil.width = FATIA_W;
  sil.height = FATIA_H;
  const sg = sil.getContext('2d')!;
  sg.drawImage(fatias[0]!, 0, 0);
  sg.globalCompositeOperation = 'source-in';
  sg.fillStyle = '#000';
  sg.fillRect(0, 0, FATIA_W, FATIA_H);
  g.save();
  g.globalAlpha = 0.3;
  g.translate(Math.floor(cx) + 2, Math.floor(cy) + 2);
  g.rotate(ang);
  g.drawImage(sil, -FATIA_W / 2, -FATIA_H / 2);
  g.restore();
  // pilha: cada fatia 1 px acima da anterior
  fatias.forEach((f, i) => {
    g.save();
    g.translate(Math.floor(cx) + 0.5, Math.floor(cy) - i + 0.5);
    g.rotate(ang);
    g.drawImage(f, -FATIA_W / 2, -FATIA_H / 2);
    g.restore();
  });
}

/** Cria a textura `chave` com ANGULOS quadros (0..ANGULOS-1) do carro na cor dada. */
export function criarTexturaCarro(scene: Phaser.Scene, chave: string, cor: number): void {
  if (scene.textures.exists(chave)) return;
  const tex = scene.textures.createCanvas(chave, QUADRO * ANGULOS, QUADRO)!;
  const g = tex.getContext();
  const fatias = criarFatias(cor);
  for (let i = 0; i < ANGULOS; i++) {
    desenharQuadro(g, fatias, (i / ANGULOS) * Math.PI * 2, i * QUADRO, 0);
    tex.add(i, 0, i * QUADRO, 0, QUADRO, QUADRO);
  }
  tex.refresh();
}

export function quadroDoAngulo(ang: number): number {
  const t = ang / (Math.PI * 2);
  return ((Math.round((t - Math.floor(t)) * ANGULOS) % ANGULOS) + ANGULOS) % ANGULOS;
}
