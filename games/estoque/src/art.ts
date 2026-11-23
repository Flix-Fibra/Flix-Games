import type Phaser from 'phaser';
import { ITEMS } from './theme';

type G = Phaser.GameObjects.Graphics;
type P = [number, number];

/** Tamanho da textura de cada célula (desenhada em 64 unidades e ampliada 2x para ficar nítida em telas de alta densidade). */
export const CELL_TEX = 128;
const K = 2;

/** Pedaço de cabo (um bloco da peça). */
export const cellKey = (item: number): string => `cell_${item}`;
/** Conector RJ45 apontando para a direita (o da esquerda é o mesmo, espelhado). */
export const plugKey = (item: number): string => `plug_${item}`;
/** Aparelhos que se ligam nas pontas de uma linha completa. */
export const DEVICE_LEFT = 'dev_router';
export const DEVICE_RIGHT = 'dev_pc';
/** Proporção do conector (largura / altura). */
export const PLUG_RATIO = 64 / 40;

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


/**
 * Bloco = pedaço de cabo de rede deitado, de ponta a ponta da célula (os vizinhos na mesma linha emendam).
 * O fundo levemente colorido deixa ver o formato da peça.
 */
function drawCableCell(g: G, item: number): void {
  const c = ITEMS[item]!;
  g.fillStyle(c.card, 0.3).fillRoundedRect(1.5, 1.5, 61, 61, 8);
  g.lineStyle(1.5, c.card, 0.5).strokeRoundedRect(1.5, 1.5, 61, 61, 8);
  // tubo do cabo
  g.fillStyle(0x000000, 0.35).fillRect(0, 24, 64, 22);
  g.fillStyle(c.cardDark, 1).fillRect(0, 20, 64, 23);
  g.fillStyle(c.card, 1).fillRect(0, 20, 64, 17);
  g.fillStyle(0xffffff, 0.45).fillRect(0, 23, 64, 4);
  g.fillStyle(0xffffff, 0.15).fillRect(0, 28, 64, 3);
  // emenda nas pontas: mostra os pedaços
  g.fillStyle(c.cardDark, 1).fillRect(0, 18.5, 3, 26).fillRect(61, 18.5, 3, 26);
  g.fillStyle(0xffffff, 0.25).fillRect(3, 20, 1, 17).fillRect(60, 20, 1, 17);
}

/** Conector RJ45 visto de lado, com a ponta para a direita: capa colorida com nervuras, corpo transparente, pinos. */
function drawPlug(g: G, item: number): void {
  const c = ITEMS[item]!;
  // capa (protege a emenda do cabo)
  g.fillStyle(c.cardDark, 1).fillRoundedRect(0, 11, 24, 19, 3);
  g.fillStyle(c.card, 1).fillRoundedRect(0, 10, 24, 16, 3);
  for (let i = 0; i < 4; i++) g.fillStyle(c.cardDark, 0.9).fillRect(4 + i * 4.6, 11, 1.8, 17);
  g.fillStyle(0xffffff, 0.35).fillRect(1, 12, 22, 2.5);
  // corpo transparente
  g.fillStyle(0x9fb0c0, 1).fillRoundedRect(22, 6, 40, 29, 3);
  g.fillStyle(0xe4edf5, 1).fillRoundedRect(22, 6, 40, 26, 3);
  // fios coloridos dentro
  const wires = [0xf28c28, 0x3fbf5b, 0x2b86ff, 0x8a5a2b];
  wires.forEach((w, i) => line(g, 1.6, w, [[24, 12 + i * 4.5], [50, 12 + i * 4.5]], 0.85));
  g.fillStyle(0xffffff, 0.55).fillRect(24, 8, 36, 3);
  // trava em cima
  g.fillStyle(0xb7c6d3, 1);
  fillPoly(g, [[30, 6], [52, 6], [48, 1.5], [33, 1.5]]);
  // pinos dourados na ponta
  for (let i = 0; i < 4; i++) g.fillStyle(0xe2a93a, 1).fillRect(52, 10 + i * 5.2, 8, 2.4);
  g.lineStyle(1, 0x000000, 0.25).strokeRoundedRect(22, 6, 40, 29, 3);
}

/** Cria as texturas do jogo (cabos, conectores e aparelhos). Chamar uma vez, antes do menu. */
export function buildItemTextures(scene: Phaser.Scene): void {
  const make = (key: string, w: number, h: number, draw: (g: G) => void) => {
    if (scene.textures.exists(key)) return;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.scaleCanvas(K, K);
    draw(g);
    g.generateTexture(key, w * K, h * K);
    g.destroy();
  };
  for (let item = 1; item <= 7; item++) {
    make(cellKey(item), 64, 64, (g) => drawCableCell(g, item));
    make(plugKey(item), 64, 40, (g) => drawPlug(g, item));
  }
  make(DEVICE_LEFT, 64, 64, drawRouter);
  make(DEVICE_RIGHT, 64, 64, drawMonitor);
}
