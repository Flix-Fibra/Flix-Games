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
export const FATIA_W = 41;
export const FATIA_H = 19;
/** Quadros de rotação (cada um gira 360/ANGULOS graus). */
export const ANGULOS = 120;
/** Lado do quadro pronto. */
export const QUADRO = 64;
/** Os quadros ficam numa grade de COLUNAS (a imagem não passa de 4096 px de largura, limite de algumas placas). */
const COLUNAS = 12;

type Token = 'B' | 'D' | 'K' | 'W' | 'H' | 'G';
/** x, y, largura, altura, cor */
type Ret = readonly [number, number, number, number, Token];

/** Roda: pneu (K) com um miolo cinza (G) por cima. x, y = canto do pneu (8 x 4). */
const roda = (x: number, y: number): Ret[] => [[x, y, 8, 4, 'K']];
const RODAS: Ret[] = [...roda(5, 0), ...roda(5, 15), ...roda(28, 0), ...roda(28, 15)];
const MIOLOS: Ret[] = [[8, 1, 2, 2, 'G'], [8, 16, 2, 2, 'G'], [31, 1, 2, 2, 'G'], [31, 16, 2, 2, 'G']];

/**
 * Da base (0) ao topo (9). Frente do carro = direita. Pneus nas 6 primeiras camadas (o miolo cinza só na de cima);
 * carroceria, bico e entradas de ar no meio; halo, capacete e motor em cima; aerofólio traseiro de duas lâminas com
 * placas laterais na cor do carro; aerofólio dianteiro branco com placas escuras.
 */
export const FATIAS: ReadonlyArray<readonly Ret[]> = [
  [...RODAS, [6, 5, 31, 9, 'D'], [36, 1, 5, 17, 'W']],
  [...RODAS, [6, 5, 30, 9, 'B'], [35, 7, 4, 5, 'B'], [36, 2, 5, 15, 'W'], [36, 1, 5, 1, 'D'], [36, 17, 5, 1, 'D'], [2, 6, 4, 7, 'D']],
  [...RODAS, [7, 5, 28, 9, 'B'], [34, 7, 4, 5, 'B'], [23, 4, 3, 1, 'D'], [23, 14, 3, 1, 'D'], [3, 7, 3, 5, 'D'], [9, 4, 9, 1, 'B'], [9, 14, 9, 1, 'B']],
  [...RODAS, [8, 6, 26, 7, 'B'], [33, 8, 4, 3, 'B'], [14, 7, 4, 5, 'D'], [22, 9, 15, 1, 'W'], [3, 8, 3, 3, 'D']],
  [...RODAS, [9, 7, 22, 5, 'B'], [30, 8, 5, 3, 'B'], [18, 7, 8, 5, 'D'], [26, 9, 9, 1, 'W'], [3, 9, 3, 1, 'D']],
  [...RODAS, ...MIOLOS, [10, 8, 7, 3, 'B'], [17, 7, 10, 5, 'G'], [18, 8, 8, 3, 'D'], [20, 8, 4, 4, 'H'], [0, 2, 6, 15, 'W']],
  [[11, 8, 5, 3, 'B'], [17, 7, 10, 5, 'G'], [18, 8, 8, 3, 'D'], [21, 8, 2, 3, 'H'], [0, 2, 6, 15, 'W']],
  [[12, 9, 3, 1, 'B'], [0, 2, 6, 15, 'W'], [0, 1, 6, 1, 'B'], [0, 17, 6, 1, 'B']],
  [[1, 3, 4, 13, 'W'], [0, 1, 6, 1, 'B'], [0, 17, 6, 1, 'B'], [0, 2, 6, 1, 'B'], [0, 16, 6, 1, 'B']],
  [[0, 1, 6, 1, 'B'], [0, 17, 6, 1, 'B']],
];

export function hex(c: number, k = 1): string {
  const r = Math.min(255, Math.round(((c >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((c >> 8) & 255) * k));
  const b = Math.min(255, Math.round((c & 255) * k));
  return `rgb(${r},${g},${b})`;
}

function paleta(cor: number): Record<Token, number> {
  const mix = (c: number, k: number) => (Math.round(((c >> 16) & 255) * k) << 16) | (Math.round(((c >> 8) & 255) * k) << 8) | Math.round((c & 255) * k);
  return { B: cor, D: mix(cor, 0.55), K: 0x1c1c20, W: 0xf2f2f2, H: 0xffd23f, G: 0x8a8f98 };
}

/** Mapa de uma camada: cor (0xRRGGBB) de cada pixel, ou -1 para vazio. */
export type MapaCamada = number[];

/** Pinta as camadas (mapas de cor) em canvas, com sombreado por altura e contorno escuro. Serve a qualquer objeto empilhado. */
export function renderizarFatias(mapas: readonly MapaCamada[], w: number, h: number): HTMLCanvasElement[] {
  return mapas.map((mapa, i) => {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const g = cv.getContext('2d')!;
    const luz = 0.7 + 0.3 * (i / Math.max(1, mapas.length - 1)); // quanto mais alto, mais claro
    const vazio = (xx: number, yy: number) => xx < 0 || yy < 0 || xx >= w || yy >= h || mapa[yy * w + xx]! < 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = mapa[y * w + x]!;
        if (c < 0) continue;
        const borda = vazio(x - 1, y) || vazio(x + 1, y) || vazio(x, y - 1) || vazio(x, y + 1);
        g.fillStyle = hex(c, borda ? luz * 0.62 : luz);
        g.fillRect(x, y, 1, 1);
      }
    }
    return cv;
  });
}

/** Camadas feitas de retângulos [x, y, largura, altura, símbolo da cor]. */
export function fatiasDeRets(camadas: ReadonlyArray<ReadonlyArray<readonly [number, number, number, number, string]>>, w: number, h: number, pal: Record<string, number>): HTMLCanvasElement[] {
  const mapas = camadas.map((rets) => {
    const mapa: MapaCamada = new Array<number>(w * h).fill(-1);
    for (const [x, y, rw, rh, t] of rets) {
      for (let yy = y; yy < y + rh; yy++) for (let xx = x; xx < x + rw; xx++) mapa[yy * w + xx] = pal[t] ?? 0;
    }
    return mapa;
  });
  return renderizarFatias(mapas, w, h);
}

export function criarFatias(cor: number): HTMLCanvasElement[] {
  return fatiasDeRets(FATIAS, FATIA_W, FATIA_H, paleta(cor));
}

/**
 * Empilha as fatias já giradas num quadro. `ang` em radianos (0 = frente para a direita).
 * Cada fatia gira em torno do próprio centro, sem suavização (vizinho mais próximo).
 */
export function desenharQuadro(g: CanvasRenderingContext2D, fatias: HTMLCanvasElement[], ang: number, ox: number, oy: number, quadro = QUADRO): void {
  g.imageSmoothingEnabled = false;
  const fw = fatias[0]!.width, fh = fatias[0]!.height;
  const cx = ox + quadro / 2 + 0.5;
  const cy = oy + quadro / 2 + 0.5;
  // sombra no chão: silhueta da fatia 0, deslocada
  const sil = document.createElement('canvas');
  sil.width = fw;
  sil.height = fh;
  const sg = sil.getContext('2d')!;
  sg.drawImage(fatias[0]!, 0, 0);
  sg.globalCompositeOperation = 'source-in';
  sg.fillStyle = '#000';
  sg.fillRect(0, 0, fw, fh);
  g.save();
  g.globalAlpha = 0.3;
  g.translate(Math.floor(cx) + 3, Math.floor(cy) + 3);
  g.rotate(ang);
  g.drawImage(sil, -fw / 2, -fh / 2);
  g.restore();
  // pilha: cada fatia 1 px acima da anterior
  fatias.forEach((f, i) => {
    g.save();
    g.translate(Math.floor(cx) + 0.5, Math.floor(cy) - i + 0.5);
    g.rotate(ang);
    g.drawImage(f, -fw / 2, -fh / 2);
    g.restore();
  });
}

/** Cria a textura `chave` com `angulos` quadros (0..angulos-1) do objeto empilhado, numa grade de `colunas`. */
export function criarTexturaStack(scene: Phaser.Scene, chave: string, fatias: HTMLCanvasElement[], quadro: number, angulos: number, colunas = COLUNAS): void {
  if (scene.textures.exists(chave)) return;
  const cols = Math.min(colunas, angulos);
  const tex = scene.textures.createCanvas(chave, quadro * cols, quadro * Math.ceil(angulos / cols))!;
  const g = tex.getContext();
  for (let i = 0; i < angulos; i++) {
    const ox = (i % cols) * quadro, oy = Math.floor(i / cols) * quadro;
    desenharQuadro(g, fatias, (i / angulos) * Math.PI * 2, ox, oy, quadro);
    tex.add(i, 0, ox, oy, quadro, quadro);
  }
  tex.refresh();
}

/** Cria a textura `chave` com ANGULOS quadros (0..ANGULOS-1) do carro na cor dada. */
export function criarTexturaCarro(scene: Phaser.Scene, chave: string, cor: number): void {
  criarTexturaStack(scene, chave, criarFatias(cor), QUADRO, ANGULOS);
}

export function quadroDoAngulo(ang: number, n = ANGULOS): number {
  const t = ang / (Math.PI * 2);
  return ((Math.round((t - Math.floor(t)) * n) % n) + n) % n;
}
