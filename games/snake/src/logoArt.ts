import { lerp, mixColor, type V } from './cablePath';
import { PLUG_BIG, buildPlug, rotateGrid } from '@flix/game-kit';

/**
 * Emblema do fim de partida, em pixel art e sem texto: um cabo de rede azul com conector RJ45 em close,
 * dando a volta em um planeta (oceano azul e continentes), com o conector RJ45 numa ponta e os fios internos na outra, num fundo escuro de hexágonos. Desenhado por código, pixel a pixel,
 * sem arquivo de imagem. O conector segue o desenho de referência (plugArt.ts). Mostrar com escala inteira (2x).
 */
export const LOGO_SIZE = 96;

export interface LogoPalette {
  main: number;
  shade: number;
  light: number;
}

const OUTLINE = 0x0a1a38;
const SPHERE = [0x0f3a8a, 0x1857b8, 0x2f7be0, 0x5da8f5, 0x9fd0ff];

// ---------- planeta: continentes em coordenadas de longitude/latitude (curvam junto com a esfera) ----------
const LAND = [0x1c4f2a, 0x2b7a35, 0x46a047, 0x7cc65a, 0xb6e27c]; // do escuro (sombra) ao claro (luz)
const HIGHLAND = [0x5a4630, 0x7d6341, 0xa08455, 0xc4a870, 0xe0cb94];
const SAND = [0x8a7a4a, 0xb09a5e, 0xd2bb7a, 0xe8d594, 0xf6e8b0];
const ICE = [0x8fa8c8, 0xb8cde6, 0xdfeaf7, 0xf2f8ff, 0xffffff];

/** Continentes: manchas (longitude, latitude, raios) em radianos. */
const CONTINENTS = [
  { lon: -0.95, lat: 0.25, rx: 0.65, ry: 0.55 },
  { lon: -0.55, lat: -0.35, rx: 0.4, ry: 0.4 },
  { lon: 0.35, lat: -0.15, rx: 0.7, ry: 0.45 },
  { lon: 0.15, lat: 0.62, rx: 0.4, ry: 0.28 },
  { lon: 1.05, lat: 0.45, rx: 0.4, ry: 0.35 },
  { lon: -0.1, lat: -0.8, rx: 0.5, ry: 0.22 },
];

function hash2(ix: number, iy: number): number {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263)) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = lerp(hash2(ix, iy), hash2(ix + 1, iy), sx);
  const b = lerp(hash2(ix, iy + 1), hash2(ix + 1, iy + 1), sx);
  return lerp(a, b, sy);
}

/** Altura do terreno em (lon, lat): abaixo de 0.2 é oceano, acima de 0.62 é montanha. */
export function terrain(lon: number, lat: number): number {
  let v = 0;
  for (const c of CONTINENTS) {
    const dl = (lon - c.lon) / c.rx;
    const dp = (lat - c.lat) / c.ry;
    v = Math.max(v, 1 - (dl * dl + dp * dp));
  }
  // ruído para recortar a costa e espalhar ilhas pequenas
  const n = valueNoise(lon * 5 + 20, lat * 5 + 20) * 0.6 + valueNoise(lon * 11, lat * 11) * 0.4;
  return v * 0.9 + (n - 0.5) * 0.55;
}

/** Devolve a grade LOGO_SIZE x LOGO_SIZE de cores 0xRRGGBB; -1 = transparente. */
export function buildRj45Logo(p: LogoPalette): number[] {
  const N = LOGO_SIZE;
  const grid = new Array<number>(N * N).fill(-1);
  const sphereMask = new Array<boolean>(N * N).fill(false);
  const px = (x: number, y: number, c: number) => {
    if (x >= 0 && y >= 0 && x < N && y < N) grid[y * N + x] = c;
  };
  const rect = (x0: number, y0: number, x1: number, y1: number, c: number) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) px(x, y, c);
  };
  const disc = (cx: number, cy: number, r: number, c: number) => {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) px(x, y, c);
      }
    }
  };

  // 1b. cabo dando a volta ao mundo: uma espiral em volta do planeta. A parte de trás é desenhada antes do planeta
  // (que cobre a maior parte dela) e a da frente depois. As duas pontas ficam na frente.
  const orbit = { cx: 47, cy: 40, rx: 37, ry: 11, t0: 0.72 * Math.PI, t1: -1.6 * Math.PI, drop: 18 };
  const samples: Array<V & { front: boolean }> = [];
  const STEPS = 560;
  for (let i = 0; i <= STEPS; i++) {
    const s = i / STEPS;
    const a = lerp(orbit.t0, orbit.t1, s);
    samples.push({
      x: orbit.cx + orbit.rx * Math.cos(a),
      y: orbit.cy + orbit.ry * Math.sin(a) - orbit.drop / 2 + orbit.drop * s,
      front: Math.sin(a) >= 0,
    });
  }
  const R0 = 4.5;
  interface CablePalette {
    outline: number;
    shade: number;
    main: number;
    light: number;
  }
  const stampCable = (subset: Array<V & { front: boolean }>, pal: CablePalette) => {
    for (const v of subset) disc(v.x, v.y, R0 + 1.5, pal.outline);
    for (const v of subset) disc(v.x, v.y, R0, pal.shade);
    for (const v of subset) disc(v.x - 0.6, v.y - 0.7, R0 - 1.3, pal.main);
    for (const v of subset) disc(v.x - R0 * 0.35, v.y - R0 * 0.4, R0 * 0.45, pal.light);
    for (const v of subset) disc(v.x - R0 * 0.5, v.y - R0 * 0.55, R0 * 0.16 + 0.3, mixColor(pal.light, 0xffffff, 0.75));
  };
  const darker = (c: number) => mixColor(c, 0x000000, 0.4);
  stampCable(samples.filter((v) => !v.front), { outline: OUTLINE, shade: darker(p.shade), main: darker(p.main), light: darker(p.light) });

  // 2. esfera azul brilhante (luz de cima e da esquerda)
  const cx = 47;
  const cy = 47;
  const R = 36;
  const lx = -0.5;
  const ly = -0.6;
  const lz = 0.62;
  const ll = Math.hypot(lx, ly, lz);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const nx = (x + 0.5 - cx) / R;
      const ny = (y + 0.5 - cy) / R;
      const d2 = nx * nx + ny * ny;
      if (d2 > 1) continue;
      const nz = Math.sqrt(1 - d2);
      const k = Math.max(0, (nx * lx + ny * ly + nz * lz) / ll);
      const band = k < 0.18 ? 0 : k < 0.42 ? 1 : k < 0.64 ? 2 : k < 0.84 ? 3 : 4;
      let color = SPHERE[band] as number;
      const lon = Math.atan2(nx, nz);
      const lat = Math.asin(Math.max(-1, Math.min(1, -ny)));
      const h = terrain(lon, lat);
      if (Math.abs(lat) > 1.2) color = ICE[band] as number; // calotas de gelo
      else if (h > 0.62) color = HIGHLAND[band] as number; // montanhas
      else if (h > 0.2) color = h < 0.27 ? (SAND[band] as number) : (LAND[band] as number); // praia e floresta
      px(x, y, d2 > 0.9 ? 0x0a2a66 : color);
      sphereMask[y * N + x] = true;
    }
  }
  rect(30, 26, 36, 28, 0xffffff);
  rect(28, 28, 33, 29, 0xe6f4ff);
  rect(34, 25, 38, 26, 0xe6f4ff);

  // 3. parte da frente do cabo, com a sombra projetada no planeta
  const front = samples.filter((v) => v.front);
  for (const v of front) {
    const sx = v.x + 3;
    const sy = v.y + 4;
    for (let y = Math.floor(sy - R0); y <= Math.ceil(sy + R0); y++) {
      for (let x = Math.floor(sx - R0); x <= Math.ceil(sx + R0); x++) {
        if (x < 0 || y < 0 || x >= N || y >= N || !sphereMask[y * N + x]) continue;
        if (Math.hypot(x + 0.5 - sx, y + 0.5 - sy) <= R0 + 0.5) px(x, y, mixColor(grid[y * N + x]!, 0x000000, 0.45));
      }
    }
  }
  stampCable(front, { outline: OUTLINE, shade: p.shade, main: p.main, light: p.light });

  // 3b. ponta cortada do cabo: a espuma de alumínio e os pares trançados saindo para fora
  const s0 = samples[0]!;
  const s1 = samples[8]!;
  let ux = s0.x - s1.x;
  let uy = s0.y - s1.y;
  const ul = Math.hypot(ux, uy) || 1;
  ux /= ul;
  uy /= ul; // aponta para fora do corte
  const vx = -uy;
  const vy = ux;
  const cxE = s0.x + ux * 1.5;
  const cyE = s0.y + uy * 1.5;
  for (let y = Math.floor(cyE - 8); y <= Math.ceil(cyE + 8); y++) {
    for (let x = Math.floor(cxE - 8); x <= Math.ceil(cxE + 8); x++) {
      const dx = x + 0.5 - cxE;
      const dy = y + 0.5 - cyE;
      const a = dx * ux + dy * uy;
      const b = dx * vx + dy * vy;
      const q = (a / 2.6) ** 2 + (b / 6.4) ** 2;
      if (q <= 1.3) px(x, y, q <= 0.42 ? 0x56657a : q <= 1 ? 0xdbe3ec : OUTLINE);
    }
  }
  // quatro pares trançados (cada par = um fio liso + um fio listrado de branco), como no cabo de rede aberto
  const pairColors = [0xf08a24, 0x2e9e5b, 0x2f6fde, 0x7b4a2b]; // laranja, verde, azul, marrom
  const quad = (p0: V, p1: V, p2: V, f: number): V => ({
    x: (1 - f) * (1 - f) * p0.x + 2 * (1 - f) * f * p1.x + f * f * p2.x,
    y: (1 - f) * (1 - f) * p0.y + 2 * (1 - f) * f * p1.y + f * f * p2.y,
  });
  pairColors.forEach((color, k) => {
    const o = k - 1.5;
    const len = 10 + (k % 2) * 2;
    const p0 = { x: cxE + vx * o * 1.1, y: cyE + vy * o * 1.1 };
    const p1 = { x: cxE + ux * len * 0.5 + vx * o * 2.6, y: cyE + uy * len * 0.5 + vy * o * 2.6 - 3 };
    const p2 = { x: cxE + ux * len + vx * o * 4.6, y: cyE + uy * len + vy * o * 4.6 - 1 };
    const steps = 40;
    for (let j = 0; j <= steps; j++) {
      const f = j / steps;
      const c = quad(p0, p1, p2, f);
      const c2 = quad(p0, p1, p2, Math.min(1, f + 0.02));
      let tx = c2.x - c.x;
      let ty = c2.y - c.y;
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl;
      ty /= tl;
      const side = Math.floor(j / 3) % 2 === 0 ? 1 : -1; // a torção: os dois fios trocam de lado
      const nx = -ty;
      const ny = tx;
      const plain = j === steps ? mixColor(color, 0xffffff, 0.4) : color;
      // fio colorido de 1 pixel; a listra branca é um fio ainda mais fino: só alguns pixels, trocando de lado (torção)
      px(Math.round(c.x - 0.5), Math.round(c.y - 0.5), plain);
      if (j % 3 === 0) px(Math.round(c.x - nx * side - 0.5), Math.round(c.y - ny * side - 0.5), 0xf4f4f4);
    }
  });
  // fio de dreno (prata), mais fino e mais longo
  {
    const p0 = { x: cxE - vx * 3, y: cyE - vy * 3 };
    const p1 = { x: cxE + ux * 7 - vx * 6, y: cyE + uy * 7 - vy * 6 - 2 };
    const p2 = { x: cxE + ux * 13 - vx * 8, y: cyE + uy * 13 - vy * 8 + 1.5 };
    for (let j = 0; j <= 26; j++) {
      const c = quad(p0, p1, p2, j / 26);
      px(Math.round(c.x - 0.5), Math.round(c.y - 0.5), j % 4 === 3 ? 0x9aa6b4 : 0xdfe5ec);
    }
  }

  const endPt = samples[samples.length - 1]!;
  const plugX = Math.round(endPt.x);
  const plugY = Math.round(endPt.y);

  // 4. conector RJ45 visto de cima (desenho de referência), apontando para a direita
  const plug = rotateGrid(buildPlug(PLUG_BIG, p), 1);
  const left = plugX - 3;
  const top = plugY - Math.floor(plug.h / 2);
  for (let y = 0; y < plug.h; y++) {
    for (let x = 0; x < plug.w; x++) {
      const c = plug.cells[y * plug.w + x]!;
      if (c >= 0) px(left + x, top + y, c);
    }
  }

  // 5. brilhos
  const sparkle = (x: number, y: number) => {
    px(x, y, 0xffffff);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) px(x + dx, y + dy, 0xcfe6f3);
  };
  sparkle(80, 14);
  sparkle(13, 58);
  sparkle(86, 34);

  return grid;
}

export function renderRj45Logo(p: LogoPalette): HTMLCanvasElement {
  const grid = buildRj45Logo(p);
  const canvas = document.createElement('canvas');
  canvas.width = LOGO_SIZE;
  canvas.height = LOGO_SIZE;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    for (let i = 0; i < grid.length; i++) {
      const c = grid[i]!;
      if (c < 0) continue;
      ctx.fillStyle = `#${c.toString(16).padStart(6, '0')}`;
      ctx.fillRect(i % LOGO_SIZE, Math.floor(i / LOGO_SIZE), 1, 1);
    }
  }
  return canvas;
}
