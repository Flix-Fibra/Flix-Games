import type Phaser from 'phaser';
import { RENDER } from './camera';
import { CELL, COLORS, GAME_H, GAME_W, ITEMS, PLUG_W } from './theme';

/**
 * Texturas do jogo, desenhadas no canvas 2D com degradês reais e no tamanho exato em que aparecem na tela
 * (CELL x RENDER pixels): nada é esticado, então fica liso em qualquer aparelho.
 */

/** Bloco de cada cor (1 a 7): um pedaço de cabo de rede, que emenda com o vizinho da mesma linha. */
export const cellKey = (item: number): string => `bloco_${item}`;
/** Conector RJ45 apontando para a direita (o da esquerda é o mesmo, espelhado). */
export const plugKey = (item: number): string => `conector_${item}`;
/** Aparelhos que se ligam nas pontas de uma linha completa. */
export const DEVICE_LEFT = 'roteador';
export const DEVICE_RIGHT = 'computador';
/** Proporção do conector (largura / altura). */
export const PLUG_RATIO = 1.6;
/** Tamanho (no mundo do jogo) em que os aparelhos são desenhados. */
export const DEVICE_SIZE = 20;
/** Contorno da sombra de aterrissagem de cada cor. */
export const ghostKey = (item: number): string => `sombra_${item}`;
/** Fundo da tela inteira. */
export const BG_KEY = 'fundo';
/** Ponto de luz suave (partículas e brilho do sinal). */
export const GLOW_KEY = 'brilho';
/** Faixa de luz horizontal (o sinal que corre pela linha completa). */
export const BEAM_KEY = 'feixe';

type Ctx = CanvasRenderingContext2D;

function caminhoArredondado(c: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
}

function desenharBloco(c: Ctx, s: number, item: number): void {
  const cor = ITEMS[item]!;
  const p = s * 0.05;
  const w = s - p * 2;
  const r = s * 0.2;
  // corpo: degradê de cima (claro) para baixo (escuro)
  const g = c.createLinearGradient(0, p, 0, p + w);
  g.addColorStop(0, cor.base);
  g.addColorStop(1, cor.dark);
  caminhoArredondado(c, p, p, w, w, r);
  c.globalAlpha = 0.55;
  c.fillStyle = g;
  c.fill();
  c.globalAlpha = 1;
  // o cabo: tubo deitado de ponta a ponta (passa pelo vão e emenda com o bloco vizinho)
  const ty = s * 0.38;
  const th = s * 0.24;
  const tubo = c.createLinearGradient(0, ty, 0, ty + th);
  tubo.addColorStop(0, cor.light);
  tubo.addColorStop(0.35, cor.base);
  tubo.addColorStop(1, cor.dark);
  c.fillStyle = 'rgba(0,0,0,0.28)';
  c.fillRect(0, ty + th * 0.15, s, th);
  c.fillStyle = tubo;
  c.fillRect(0, ty, s, th);
  c.fillStyle = 'rgba(255,255,255,0.5)';
  c.fillRect(0, ty + th * 0.16, s, Math.max(1, th * 0.16));
  // brilho de vidro na metade de cima
  const m = s * 0.12;
  const brilho = c.createLinearGradient(0, p + m * 0.6, 0, s * 0.55);
  brilho.addColorStop(0, 'rgba(255,255,255,0.32)');
  brilho.addColorStop(1, 'rgba(255,255,255,0)');
  caminhoArredondado(c, p + m, p + m * 0.6, w - m * 2, s * 0.42, r * 0.7);
  c.fillStyle = brilho;
  c.fill();
  // borda clara fina
  caminhoArredondado(c, p + 0.5, p + 0.5, w - 1, w - 1, r);
  c.lineWidth = Math.max(1, s * 0.03);
  c.strokeStyle = cor.light;
  c.globalAlpha = 0.7;
  c.stroke();
  c.globalAlpha = 1;
}

/** Conector RJ45 visto de lado, ponta para a direita: capa colorida, corpo transparente, fios e pinos dourados. */
function desenharConector(c: Ctx, w: number, h: number, item: number): void {
  const cor = ITEMS[item]!;
  const u = w / 64; // desenhado numa grade de 64 x 40
  // capa (com nervuras) que protege a emenda do cabo
  const capa = c.createLinearGradient(0, 10 * u, 0, 30 * u);
  capa.addColorStop(0, cor.light);
  capa.addColorStop(0.4, cor.base);
  capa.addColorStop(1, cor.dark);
  caminhoArredondado(c, 0, 10 * u, 24 * u, 19 * u, 4 * u);
  c.fillStyle = capa;
  c.fill();
  c.fillStyle = 'rgba(0,0,0,0.22)';
  for (let i = 0; i < 4; i++) c.fillRect((5 + i * 4.6) * u, 12 * u, 1.6 * u, 15 * u);
  // corpo transparente
  const corpo = c.createLinearGradient(0, 6 * u, 0, 35 * u);
  corpo.addColorStop(0, 'rgba(245,250,255,0.98)');
  corpo.addColorStop(1, 'rgba(170,190,210,0.95)');
  caminhoArredondado(c, 22 * u, 6 * u, 40 * u, 29 * u, 5 * u);
  c.fillStyle = corpo;
  c.fill();
  // fios coloridos dentro
  ['#F28C28', '#3FBF5B', '#2B86FF', '#8A5A2B'].forEach((f, i) => {
    c.fillStyle = f;
    c.globalAlpha = 0.8;
    c.fillRect(25 * u, (12 + i * 4.6) * u, 26 * u, 1.8 * u);
  });
  c.globalAlpha = 1;
  // trava em cima
  c.fillStyle = 'rgba(200,214,228,1)';
  c.beginPath();
  c.moveTo(30 * u, 6 * u);
  c.lineTo(52 * u, 6 * u);
  c.lineTo(48 * u, 1.5 * u);
  c.lineTo(33 * u, 1.5 * u);
  c.closePath();
  c.fill();
  // pinos dourados
  const ouro = c.createLinearGradient(0, 0, 0, h);
  ouro.addColorStop(0, '#FFE08A');
  ouro.addColorStop(1, '#D99A1E');
  c.fillStyle = ouro;
  for (let i = 0; i < 4; i++) c.fillRect(53 * u, (10 + i * 5.2) * u, 8 * u, 2.6 * u);
  // reflexo
  c.fillStyle = 'rgba(255,255,255,0.7)';
  c.fillRect(25 * u, 8 * u, 34 * u, 2 * u);
}

/** Roteador: corpo escuro arredondado, 4 antenas e LEDs verdes. */
function desenharRoteador(c: Ctx, s: number): void {
  const u = s / 64;
  c.lineCap = 'round';
  for (const [bx, lean] of [[16, -5], [26, -2], [38, 2], [48, 5]] as const) {
    c.strokeStyle = '#2A2F42';
    c.lineWidth = 4 * u;
    c.beginPath();
    c.moveTo(bx * u, 38 * u);
    c.lineTo((bx + lean) * u, 10 * u);
    c.stroke();
  }
  const corpo = c.createLinearGradient(0, 34 * u, 0, 56 * u);
  corpo.addColorStop(0, '#4A5070');
  corpo.addColorStop(1, '#1A1E2E');
  caminhoArredondado(c, 6 * u, 34 * u, 52 * u, 20 * u, 7 * u);
  c.fillStyle = corpo;
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.18)';
  c.fillRect(10 * u, 36 * u, 44 * u, 2 * u);
  for (const [x, cor] of [[16, '#3DF58A'], [23, '#3DF58A'], [30, '#FFC23D']] as const) {
    const led = c.createRadialGradient(x * u, 45 * u, 0, x * u, 45 * u, 5 * u);
    led.addColorStop(0, cor);
    led.addColorStop(0.4, cor);
    led.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = led;
    c.fillRect((x - 5) * u, 40 * u, 10 * u, 10 * u);
  }
}

/** Computador: monitor com tela azul acesa e base. */
function desenharComputador(c: Ctx, s: number): void {
  const u = s / 64;
  caminhoArredondado(c, 5 * u, 8 * u, 54 * u, 38 * u, 6 * u);
  c.fillStyle = '#23283A';
  c.fill();
  const tela = c.createLinearGradient(0, 12 * u, 0, 42 * u);
  tela.addColorStop(0, '#7CC8FF');
  tela.addColorStop(1, '#2563EB');
  caminhoArredondado(c, 9 * u, 12 * u, 46 * u, 30 * u, 3 * u);
  c.fillStyle = tela;
  c.fill();
  // sinal de wi-fi na tela
  c.strokeStyle = 'rgba(255,255,255,0.9)';
  c.lineCap = 'round';
  c.lineWidth = 2.6 * u;
  for (const r of [5, 10, 15]) {
    c.beginPath();
    c.arc(32 * u, 36 * u, r * u, Math.PI * 1.25, Math.PI * 1.75);
    c.stroke();
  }
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(32 * u, 36 * u, 2 * u, 0, Math.PI * 2);
  c.fill();
  // base
  c.fillStyle = '#23283A';
  c.fillRect(29 * u, 46 * u, 6 * u, 6 * u);
  caminhoArredondado(c, 18 * u, 51 * u, 28 * u, 4 * u, 2 * u);
  c.fill();
}

function desenharSombra(c: Ctx, s: number, item: number): void {
  const cor = ITEMS[item]!;
  const p = s * 0.09;
  const w = s - p * 2;
  caminhoArredondado(c, p, p, w, w, s * 0.18);
  c.globalAlpha = 0.14;
  c.fillStyle = cor.base;
  c.fill();
  c.globalAlpha = 0.75;
  c.lineWidth = Math.max(1.5, s * 0.06);
  c.strokeStyle = cor.base;
  c.stroke();
  c.globalAlpha = 1;
}

function desenharFundo(c: Ctx, w: number, h: number): void {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, COLORS.bgTop);
  g.addColorStop(1, COLORS.bgBottom);
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  // luzes suaves (vermelho Flix em cima à direita, roxo embaixo à esquerda)
  for (const [x, y, r, cor] of [
    [w * 0.95, h * 0.04, w * 0.85, 'rgba(229,23,63,0.22)'],
    [w * 0.0, h * 0.85, w * 0.95, 'rgba(99,72,255,0.18)'],
  ] as const) {
    const rg = c.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, cor);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = rg;
    c.fillRect(0, 0, w, h);
  }
}

function desenharBrilho(c: Ctx, s: number): void {
  const rg = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  rg.addColorStop(0, 'rgba(255,255,255,1)');
  rg.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = rg;
  c.fillRect(0, 0, s, s);
}

function desenharFeixe(c: Ctx, w: number, h: number): void {
  const g = c.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(160,230,255,0)');
  g.addColorStop(0.75, 'rgba(160,230,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,1)');
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  const v = c.createLinearGradient(0, 0, 0, h);
  v.addColorStop(0, 'rgba(0,0,0,1)');
  v.addColorStop(0.5, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,1)');
  c.globalCompositeOperation = 'destination-out';
  c.fillStyle = v;
  c.fillRect(0, 0, w, h);
  c.globalCompositeOperation = 'source-over';
}

/** Cria as texturas do jogo. Chamar uma vez, antes do menu. */
export function buildItemTextures(scene: Phaser.Scene): void {
  const make = (key: string, w: number, h: number, draw: (c: Ctx, w: number, h: number) => void) => {
    if (scene.textures.exists(key)) return;
    const t = scene.textures.createCanvas(key, w, h);
    if (!t) return;
    draw(t.getContext(), w, h);
    t.refresh();
  };
  const s = Math.round(CELL * RENDER);
  for (let item = 1; item <= 7; item++) {
    make(cellKey(item), s, s, (c) => desenharBloco(c, s, item));
    make(ghostKey(item), s, s, (c) => desenharSombra(c, s, item));
  }
  const pw = Math.round(PLUG_W * RENDER * 1.25);
  const ph = Math.round(pw / PLUG_RATIO);
  for (let item = 1; item <= 7; item++) make(plugKey(item), pw, ph, (c) => desenharConector(c, pw, ph, item));
  const ds = Math.round(DEVICE_SIZE * RENDER * 1.6);
  make(DEVICE_LEFT, ds, ds, (c) => desenharRoteador(c, ds));
  make(DEVICE_RIGHT, ds, ds, (c) => desenharComputador(c, ds));
  make(BG_KEY, Math.round(GAME_W * RENDER), Math.round(GAME_H * RENDER), desenharFundo);
  make(GLOW_KEY, 64, 64, (c) => desenharBrilho(c, 64));
  make(BEAM_KEY, 256, 32, desenharFeixe);
}
