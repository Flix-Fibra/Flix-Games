import { mixColor } from './cablePath';

/**
 * Conector RJ45 visto de cima, em pixel art (desenho de referência do solicitante): contatos dourados em moldura
 * escura, corpo transparente, capa azul com a meia-lua escura da trava, plaquinha com linhas e frisos brancos nas
 * laterais. É gerado por código com um número de contatos e de detalhes ajustável: uma versão grande para o emblema
 * e uma pequena para a cabeça do cabo no jogo. O desenho "aponta para cima"; use `rotateGrid` para girar.
 */
export interface PlugSpec {
  pins: number;
  /** Folga lateral da capa em relação ao corpo transparente. */
  margin: number;
  pinLight: number;
  pinDark: number;
  clearRows: number;
  tabRows: number;
  plateLines: number;
  ridgeBars: number;
}

export interface PlugPalette {
  main: number;
  shade: number;
  light: number;
}

export interface Sprite {
  w: number;
  h: number;
  /** Cores 0xRRGGBB em linhas, de cima para baixo; -1 = transparente. */
  cells: number[];
}

export const PLUG_COLORS = {
  outline: 0x0a1a38,
  frame: 0x1c2a38,
  goldLight: 0xf7d04a,
  goldDark: 0xe8a336,
  clearLeft: 0xb4dcff,
  clearRight: 0x66b0f5,
  plate: 0xe6edf5,
  plateLine: 0x3d5a80,
  ridge: 0xf2f6fb,
} as const;

/** Versão grande, usada no emblema. */
export const PLUG_BIG: PlugSpec = { pins: 8, margin: 3, pinLight: 2, pinDark: 2, clearRows: 3, tabRows: 5, plateLines: 3, ridgeBars: 3 };
/** Versão pequena, usada na cabeça do cabo durante o jogo. */
export const PLUG_MINI: PlugSpec = { pins: 4, margin: 2, pinLight: 2, pinDark: 1, clearRows: 2, tabRows: 3, plateLines: 2, ridgeBars: 2 };

export function buildPlug(spec: PlugSpec, pal: PlugPalette): Sprite {
  const C = PLUG_COLORS;
  const clearW = 2 * spec.pins + 1;
  const W = clearW + 2 * spec.margin;
  const cx = (W - 1) / 2;
  const c0 = spec.margin;
  const c1 = W - 1 - spec.margin;

  const hoodL = mixColor(pal.main, 0xffffff, 0.28);
  const hoodR = pal.main;
  const lowL = pal.main;
  const lowR = pal.shade;
  const tabL = mixColor(pal.main, 0x000000, 0.25);
  const tabR = mixColor(pal.main, 0x000000, 0.4);

  const rows: number[][] = [];
  const addRow = (x0: number, x1: number, fn: (x: number) => number, edge = true) => {
    const row = new Array<number>(W).fill(-1);
    for (let x = x0; x <= x1; x++) row[x] = fn(x);
    if (edge) {
      row[x0] = C.outline;
      row[x1] = C.outline;
    }
    rows.push(row);
  };
  const upper = (x: number) => (x < cx ? hoodL : hoodR);
  const lower = (x: number) => (x < cx ? lowL : lowR);

  // contatos dourados na moldura escura
  addRow(c0, c1, () => C.outline, false);
  const pin = (gold: number) => (x: number) => (x > c0 && x < c1 && (x - (c0 + 1)) % 2 === 0 ? gold : C.frame);
  for (let i = 0; i < spec.pinLight; i++) addRow(c0, c1, pin(C.goldLight));
  for (let i = 0; i < spec.pinDark; i++) addRow(c0, c1, pin(C.goldDark));
  addRow(c0, c1, () => C.frame);
  // corpo transparente
  for (let i = 0; i < spec.clearRows; i++) addRow(c0, c1, (x) => (x < cx ? C.clearLeft : C.clearRight));
  // capa azul: ombros e topo
  addRow(1, W - 2, () => C.outline, false);
  addRow(0, W - 1, upper);
  addRow(0, W - 1, upper);
  // meia-lua escura da trava
  const tabHalf = Math.max(2, Math.floor(cx) - 3);
  for (let i = 0; i < spec.tabRows; i++) {
    const half = Math.max(1, Math.floor(tabHalf * Math.sqrt(1 - (i / spec.tabRows) ** 2)));
    addRow(0, W - 1, (x) => (Math.abs(x - cx) <= half ? (x < cx ? tabL : tabR) : upper(x)));
  }
  addRow(0, W - 1, upper);
  // plaquinha com linhas
  const ph = Math.max(3, Math.floor(cx) - 3 - (spec.margin > 2 ? 1 : 0));
  const plateRow = (line: boolean) => (x: number) => {
    const d = Math.abs(x - cx);
    if (d > ph) return lower(x);
    return line && d < ph ? C.plateLine : C.plate;
  };
  addRow(0, W - 1, plateRow(false));
  for (let i = 0; i < spec.plateLines; i++) {
    addRow(0, W - 1, plateRow(true));
    addRow(0, W - 1, plateRow(false));
  }
  addRow(0, W - 1, lower);
  // afunilamento com frisos brancos nas laterais
  const total = spec.ridgeBars * 2;
  const barW = Math.max(2, Math.floor(W / 5));
  let halfW = Math.floor(cx);
  for (let j = 0; j < total; j++) {
    halfW = Math.floor(cx) - Math.floor((j * 3) / total);
    const x0 = Math.round(cx - halfW);
    const x1 = Math.round(cx + halfW);
    const bar = j % 2 === 0;
    addRow(x0, x1, (x) => (bar && (x - x0 <= barW && x - x0 >= 1 || x1 - x <= barW && x1 - x >= 1) ? C.ridge : lower(x)));
  }
  addRow(Math.round(cx - halfW) + 1, Math.round(cx + halfW) - 1, () => C.outline, false);

  return { w: W, h: rows.length, cells: rows.flat() };
}

/** Gira a imagem em passos de 90° no sentido horário (0 a 3). */
export function rotateGrid(s: Sprite, quarterTurns: number): Sprite {
  let cur = s;
  for (let t = 0; t < ((quarterTurns % 4) + 4) % 4; t++) {
    const w = cur.h;
    const h = cur.w;
    const cells = new Array<number>(w * h).fill(-1);
    for (let y = 0; y < cur.h; y++) {
      for (let x = 0; x < cur.w; x++) {
        // (x, y) -> (altura - 1 - y, x)
        cells[x * w + (cur.h - 1 - y)] = cur.cells[y * cur.w + x]!;
      }
    }
    cur = { w, h, cells };
  }
  return cur;
}

export function spriteToCanvas(s: Sprite): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = s.w;
  canvas.height = s.h;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    for (let i = 0; i < s.cells.length; i++) {
      const c = s.cells[i]!;
      if (c < 0) continue;
      ctx.fillStyle = `#${c.toString(16).padStart(6, '0')}`;
      ctx.fillRect(i % s.w, Math.floor(i / s.w), 1, 1);
    }
  }
  return canvas;
}
