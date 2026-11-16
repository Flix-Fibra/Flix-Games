import type Phaser from 'phaser';
import { ITEMS } from './theme';

type G = Phaser.GameObjects.Graphics;
type P = [number, number];

/** Tamanho da textura de cada célula (desenhada em 64 unidades e ampliada 2x para ficar nítida em telas de alta densidade). */
export const CELL_TEX = 128;
const K = 2;

export const cellKey = (item: number): string => `cell_${item}`;

/** Pontos de uma elipse, com rotação em graus. */
function ellipse(cx: number, cy: number, rx: number, ry: number, rotDeg = 0, from = 0, to = Math.PI * 2, n = 48): P[] {
  const r = (rotDeg * Math.PI) / 180;
  const pts: P[] = [];
  for (let i = 0; i <= n; i++) {
    const a = from + ((to - from) * i) / n;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    pts.push([cx + x * Math.cos(r) - y * Math.sin(r), cy + x * Math.sin(r) + y * Math.cos(r)]);
  }
  return pts;
}
const fillPoly = (g: G, pts: P[]): void => {
  g.fillPoints(pts.map(([x, y]) => ({ x, y })) as Phaser.Geom.Point[], true);
};
const strokePoly = (g: G, pts: P[], closed = false): void => {
  g.strokePoints(pts.map(([x, y]) => ({ x, y })) as Phaser.Geom.Point[], closed);
};
const line = (g: G, w: number, color: number, pts: P[], alpha = 1): void => {
  g.lineStyle(w, color, alpha);
  strokePoly(g, pts);
};

/** Cartão colorido atrás do item: dá cor ao tipo e faz os grupos iguais "grudarem" visualmente. */
function drawCard(g: G, item: number): void {
  const it = ITEMS[item]!;
  g.fillStyle(it.cardDark, 1).fillRoundedRect(2, 3, 60, 59, 11);
  g.fillStyle(it.card, 1).fillRoundedRect(2, 2, 60, 56, 11);
  g.fillStyle(0xffffff, 0.32).fillRoundedRect(7, 5, 50, 9, 5);
  g.lineStyle(1.2, 0x000000, 0.18).strokeRoundedRect(2, 2, 60, 60, 11);
}

/** Roteador preto com quatro antenas e LEDs. */
function drawRouter(g: G): void {
  for (const [bx, lean] of [[14, -4], [25, -1.5], [39, 1.5], [50, 4]] as const) {
    line(g, 3.6, 0x14151a, [[bx, 38], [bx + lean, 11]]);
    g.fillStyle(0x14151a, 1).fillCircle(bx + lean, 11, 2.4);
    line(g, 1, 0x4a4e5c, [[bx - 0.6, 36], [bx + lean - 0.6, 13]], 0.8);
  }
  g.fillStyle(0x0d0e12, 1).fillRoundedRect(7, 38, 50, 17, 5);
  g.fillStyle(0x23252e, 1).fillRoundedRect(7, 37, 50, 15, 5);
  g.fillStyle(0x3b3e4b, 1).fillRoundedRect(9, 38, 46, 4, 2);
  // grade de ventilação
  for (let i = 0; i < 4; i++) line(g, 1, 0x0d0e12, [[34 + i * 5, 44], [37 + i * 5, 44]], 0.9);
  // LEDs
  g.fillStyle(0x35e07a, 1).fillCircle(15, 47, 1.9);
  g.fillStyle(0xffb02e, 1).fillCircle(21, 47, 1.9);
  g.fillStyle(0x35e07a, 1).fillCircle(27, 47, 1.9);
  g.fillStyle(0x23252e, 1).fillRect(13, 54, 6, 2).fillRect(45, 54, 6, 2);
}

/** Cabo de rede azul enrolado, com os conectores à vista. */
function drawCable(g: G): void {
  const rings: Array<[number, number]> = [[22, 16], [16, 11.5], [10, 7]];
  const cx = 32;
  const cy = 29;
  for (const [rx, ry] of rings) line(g, 7.2, 0x103f80, ellipse(cx, cy, rx, ry, -8));
  for (const [rx, ry] of rings) line(g, 5, 0x2b86ff, ellipse(cx, cy, rx, ry, -8));
  for (const [rx, ry] of rings) line(g, 1.4, 0xa8d3ff, ellipse(cx, cy - 1.2, rx - 0.5, ry - 0.5, -8, Math.PI * 1.05, Math.PI * 1.75, 20), 0.9);
  // faixas que prendem o rolo
  g.fillStyle(0x103f80, 1).fillRoundedRect(29, 11, 6, 8, 2);
  g.fillStyle(0xd9e6ff, 1).fillRoundedRect(29.6, 11.6, 4.8, 6.8, 1.6);
  // cabos e conectores
  line(g, 4.6, 0x103f80, [[14, 41], [14, 48]]);
  line(g, 3, 0x2b86ff, [[14, 41], [14, 48]]);
  line(g, 4.6, 0x103f80, [[50, 41], [50, 48]]);
  line(g, 3, 0x2b86ff, [[50, 41], [50, 48]]);
  for (const x of [14, 50]) {
    g.fillStyle(0x7d8596, 1).fillRoundedRect(x - 6, 47, 12, 11, 2.2);
    g.fillStyle(0xeaf0f8, 1).fillRoundedRect(x - 5.2, 47, 10.4, 8.6, 2);
    for (let i = 0; i < 4; i++) g.fillStyle(0xe2a93a, 1).fillRect(x - 4 + i * 2.4, 54.6, 1.2, 3.4);
  }
}

/** Monitor com paisagem na tela. */
function drawMonitor(g: G): void {
  g.fillStyle(0x0d0e12, 1).fillRoundedRect(6, 9, 52, 36, 4);
  g.fillStyle(0x1b1d24, 1).fillRoundedRect(6, 9, 52, 34, 4);
  // tela
  g.fillStyle(0x4fa9f2, 1).fillRoundedRect(9.5, 12.5, 45, 26, 1.5);
  g.fillStyle(0x8ccdfa, 1).fillRoundedRect(9.5, 12.5, 45, 11, 1.5);
  // nuvem
  g.fillStyle(0xffffff, 0.95);
  g.fillCircle(40, 21, 3.1).fillCircle(44.5, 19.8, 4.2).fillCircle(49, 21.4, 3).fillRect(40, 21, 9, 3);
  // colina (recortada nas bordas da tela)
  const hill = ellipse(26, 47, 36, 15).map(([x, y]) => [Math.max(9.5, Math.min(54.5, x)), Math.min(38.5, y)] as P);
  g.fillStyle(0x3fbf5b, 1);
  fillPoly(g, hill);
  const hill2 = ellipse(46, 48, 22, 12).map(([x, y]) => [Math.max(9.5, Math.min(54.5, x)), Math.min(38.5, y)] as P);
  g.fillStyle(0x2ea34a, 1);
  fillPoly(g, hill2);
  g.fillStyle(0xffffff, 0.12).fillTriangle(9.5, 12.5, 30, 12.5, 9.5, 36);
  // base
  g.fillStyle(0x1b1d24, 1).fillRect(29, 43, 6, 8);
  g.fillStyle(0x0d0e12, 1);
  fillPoly(g, ellipse(32, 53, 14, 3.6));
  g.fillStyle(0x2b2e38, 1);
  fillPoly(g, ellipse(32, 52.4, 13, 2.6));
  g.fillStyle(0x35e07a, 1).fillCircle(50, 41, 0.9);
}

/** Furadeira a bateria amarela e preta. */
function drawDrill(g: G): void {
  // broca
  line(g, 2.4, 0x9aa0ae, [[50, 23], [61, 23]]);
  line(g, 1, 0x5a5f6c, [[52, 24], [60, 22.4]], 0.8);
  // mandril
  g.fillStyle(0x15161b, 1).fillRoundedRect(42, 16.5, 10, 13, 2.4);
  g.fillStyle(0x3a3d48, 1).fillRect(45, 17.5, 1.2, 11).fillRect(48.4, 17.5, 1.2, 11);
  // corpo
  g.fillStyle(0xb98400, 1).fillRoundedRect(8, 14.5, 36, 17, 7);
  g.fillStyle(0xffc40a, 1).fillRoundedRect(8, 13, 36, 15, 7);
  g.fillStyle(0xffe27a, 1).fillRoundedRect(12, 14.2, 26, 3.6, 2);
  g.fillStyle(0x15161b, 1).fillRoundedRect(5, 16.5, 7, 11, 3);
  g.fillStyle(0x15161b, 1).fillRoundedRect(23, 21, 9, 3, 1.4);
  // cabo (empunhadura)
  g.fillStyle(0xe5ae00, 1);
  fillPoly(g, [[19, 28], [34, 28], [32, 52], [21, 52]]);
  g.fillStyle(0x15161b, 1);
  fillPoly(g, [[20.2, 35], [33.2, 35], [32.2, 52], [21, 52]]);
  for (let i = 0; i < 4; i++) line(g, 1, 0x3a3d48, [[21.6, 38 + i * 3.6], [32, 38 + i * 3.6]], 0.9);
  // gatilho
  g.fillStyle(0x15161b, 1).fillRoundedRect(34, 28, 5, 6, 1.6);
  // bateria
  g.fillStyle(0x15161b, 1).fillRoundedRect(14, 51, 26, 8, 2.4);
  g.fillStyle(0xffc40a, 1).fillRect(14, 53.4, 26, 1.8);
}

/** Antena parabólica branca com o braço e o LNB. */
function drawDish(g: G): void {
  // suporte e base
  line(g, 3.6, 0x8c94a3, [[40, 34], [44, 50]]);
  line(g, 2.2, 0xe9edf3, [[40, 34], [44, 50]]);
  g.fillStyle(0x8c94a3, 1).fillRoundedRect(37, 50, 14, 6, 2);
  g.fillStyle(0xdfe4ec, 1).fillRoundedRect(37, 49.4, 14, 4.6, 2);
  // braço com o LNB
  const arm: P[] = [[31, 37], [26, 46], [18, 47], [12, 40], [11, 29]];
  line(g, 4.4, 0x8c94a3, arm);
  line(g, 2.8, 0xe9edf3, arm);
  g.fillStyle(0x8c94a3, 1).fillRoundedRect(5, 20, 11, 11, 2.6);
  g.fillStyle(0xf1f4f9, 1).fillRoundedRect(5.6, 20, 9.8, 9.4, 2.4);
  g.fillStyle(0x6b7384, 1).fillRect(8, 31, 5, 3);
  // prato
  g.fillStyle(0x8c94a3, 1);
  fillPoly(g, ellipse(38, 24, 21, 14.5, -38));
  g.fillStyle(0xe4e8ef, 1);
  fillPoly(g, ellipse(37.4, 23.4, 20.2, 13.7, -38));
  g.fillStyle(0xf8f9fc, 1);
  fillPoly(g, ellipse(36.4, 22.6, 17, 11, -38));
  g.fillStyle(0xdde2ea, 1);
  fillPoly(g, ellipse(39, 25, 12, 7.4, -38));
  for (const [x, y] of [[33, 24], [37.5, 20], [41, 28.6], [44.6, 24.4]] as P[]) g.fillStyle(0x9aa2b2, 1).fillCircle(x, y, 1.1);
}

const DRAWERS: Record<number, (g: G) => void> = { 1: drawRouter, 2: drawCable, 3: drawMonitor, 4: drawDrill, 5: drawDish };

/** Cria uma textura lisa por item (cartão + desenho). Chamar uma vez, antes do menu. */
export function buildItemTextures(scene: Phaser.Scene): void {
  for (let item = 1; item <= 5; item++) {
    const key = cellKey(item);
    if (scene.textures.exists(key)) continue;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.scaleCanvas(K, K);
    drawCard(g, item);
    DRAWERS[item]!(g);
    g.generateTexture(key, CELL_TEX, CELL_TEX);
    g.destroy();
  }
}
