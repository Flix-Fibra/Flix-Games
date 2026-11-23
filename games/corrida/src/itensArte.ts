import type Phaser from 'phaser';
import { criarTexturaStack, fatiasDeRets, renderizarFatias, type MapaCamada } from './carro';

/**
 * Arte dos itens e obstáculos. Todos os objetos são *stacks* de pixels, como o carro (mesma base em `carro.ts`):
 * vaca (gira para andar em qualquer direção), meteoro, e os três bônus (turbo, arco-íris e roleta, que giram
 * parados no chão). A poça, a sombra do meteoro e a chama do turbo são desenhos planos.
 */

export const PICKUP_QUADRO = 32;
export const PICKUP_ANGULOS = 24;
export const VACA_QUADRO = 40;
export const VACA_ANGULOS = 72;

type Set = (x: number, y: number, cor: number) => void;

function camadas(n: number, w: number, h: number, f: (i: number, set: Set) => void): MapaCamada[] {
  return Array.from({ length: n }, (_, i) => {
    const mapa: MapaCamada = new Array<number>(w * h).fill(-1);
    f(i, (x, y, cor) => {
      if (x >= 0 && y >= 0 && x < w && y < h) mapa[y * w + x] = cor;
    });
    return mapa;
  });
}

function hsv(h: number, s: number, v: number): number {
  const f = (n: number): number => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return (Math.round(f(5) * 255) << 16) | (Math.round(f(3) * 255) << 8) | Math.round(f(1) * 255);
}

const dist = (x: number, y: number, cx: number, cy: number): number => Math.hypot(x - cx, y - cy);

// ---- vaca (21 x 11, frente para a direita) -------------------------------------------------------------------------

const VACA_PAL: Record<string, number> = { w: 0xf4f4f4, k: 0x232327, p: 0xf0a0b0, g: 0x55555c, h: 0xe8d8a0 };
const VACA = [
  [[3, 1, 2, 2, 'g'], [3, 8, 2, 2, 'g'], [14, 1, 2, 2, 'g'], [14, 8, 2, 2, 'g']],
  [[3, 1, 2, 2, 'w'], [3, 8, 2, 2, 'w'], [14, 1, 2, 2, 'w'], [14, 8, 2, 2, 'w']],
  [[3, 1, 15, 9, 'w'], [6, 2, 3, 3, 'k'], [11, 6, 4, 3, 'k']],
  [[3, 2, 14, 7, 'w'], [6, 3, 3, 2, 'k'], [12, 5, 3, 3, 'k'], [17, 3, 4, 5, 'w']],
  [[4, 3, 12, 5, 'w'], [7, 4, 3, 2, 'k'], [17, 3, 4, 5, 'w'], [20, 4, 1, 3, 'p'], [17, 2, 1, 1, 'h'], [17, 8, 1, 1, 'h'], [1, 5, 3, 1, 'k']],
  [[5, 4, 9, 3, 'w'], [17, 4, 3, 3, 'w'], [14, 5, 2, 1, 'k']],
] as const;

// ---- meteoro (19 x 19) ---------------------------------------------------------------------------------------------

function meteoro(): MapaCamada[] {
  const raios = [8, 9, 9, 8, 7, 5, 3];
  return camadas(raios.length, 19, 19, (i, set) => {
    const r = raios[i]!;
    for (let y = 0; y < 19; y++) {
      for (let x = 0; x < 19; x++) {
        const d = dist(x, y, 9, 9);
        if (d > r) continue;
        let cor = 0x7a6a5a;
        const ruido = (x * 7 + y * 13 + i * 3) % 7;
        if (ruido === 0) cor = 0x5a4a3c;
        else if (ruido === 3) cor = 0x9a8a78;
        if (d > r - 1.4) cor = i < 3 ? 0xff9a2a : 0x4a3a30; // base em brasa, topo escuro
        if (i === raios.length - 1) cor = 0xffd23f;
        set(x, y, cor);
      }
    }
  });
}

// ---- bônus (15 x 15) -----------------------------------------------------------------------------------------------

function turbo(): MapaCamada[] {
  const raio = 8; // camadas
  return camadas(raio, 15, 15, (i, set) => {
    for (let y = 0; y < 15; y++) {
      for (let x = 0; x < 15; x++) {
        const d = dist(x, y, 7, 7);
        if (d > 6) continue;
        const topo = i === raio - 1;
        set(x, y, topo ? 0xcfe8ff : d > 5 ? 0x9ed0ff : 0x2a7bff);
      }
    }
    if (i === raio - 1) {
      // raio amarelo na tampa
      const raioPts = [[8, 3], [9, 3], [7, 4], [8, 4], [6, 5], [7, 5], [6, 6], [7, 6], [8, 6], [9, 6], [8, 7], [9, 7], [7, 8], [8, 8], [6, 9], [7, 9], [5, 10], [6, 10]];
      for (const [x, y] of raioPts) set(x!, y!, 0xffb300);
    }
  });
}

function arco(): MapaCamada[] {
  return camadas(8, 15, 15, (i, set) => {
    for (let y = 0; y < 15; y++) {
      for (let x = 0; x < 15; x++) {
        const d = dist(x, y, 7, 7);
        if (d <= 6.3 && d >= 3) set(x, y, hsv(i * 45, 0.85, 1));
      }
    }
  });
}

function roleta(): MapaCamada[] {
  return camadas(7, 15, 15, (i, set) => {
    for (let y = 0; y < 15; y++) {
      for (let x = 0; x < 15; x++) {
        const d = dist(x, y, 7, 7);
        if (d > 6.3) continue;
        if (i < 3) {
          set(x, y, 0x333338);
          continue;
        }
        if (d > 5.2) {
          set(x, y, 0xf2b824); // aro dourado
          continue;
        }
        const setor = Math.floor(((Math.atan2(y - 7, x - 7) + Math.PI) / (Math.PI * 2)) * 8);
        set(x, y, d < 1.6 ? 0x232327 : setor % 2 === 0 ? 0xd4142c : 0xf2f2f2);
      }
    }
  });
}

// ---- desenhos planos -----------------------------------------------------------------------------------------------

function canvasPlano(scene: Phaser.Scene, chave: string, w: number, h: number, pintar: (g: CanvasRenderingContext2D) => void): void {
  if (scene.textures.exists(chave)) return;
  const tex = scene.textures.createCanvas(chave, w, h)!;
  pintar(tex.getContext());
  tex.refresh();
}

function pixel(g: CanvasRenderingContext2D, x: number, y: number, cor: string): void {
  g.fillStyle = cor;
  g.fillRect(x, y, 1, 1);
}

/** Cria todas as texturas dos itens (uma vez). */
export function criarArteItens(scene: Phaser.Scene): void {
  criarTexturaStack(scene, 'vaca', fatiasDeRets(VACA as unknown as ReadonlyArray<ReadonlyArray<readonly [number, number, number, number, string]>>, 21, 11, VACA_PAL), VACA_QUADRO, VACA_ANGULOS);
  criarTexturaStack(scene, 'meteoro', renderizarFatias(meteoro(), 19, 19), VACA_QUADRO, 1);
  criarTexturaStack(scene, 'turbo', renderizarFatias(turbo(), 15, 15), PICKUP_QUADRO, PICKUP_ANGULOS, 8);
  criarTexturaStack(scene, 'arco', renderizarFatias(arco(), 15, 15), PICKUP_QUADRO, PICKUP_ANGULOS, 8);
  criarTexturaStack(scene, 'roleta', renderizarFatias(roleta(), 15, 15), PICKUP_QUADRO, PICKUP_ANGULOS, 8);

  // poça de água (64 x 34): borda escura, miolo claro, ondas e brilhos
  canvasPlano(scene, 'poca', 64, 34, (g) => {
    for (let y = 0; y < 34; y++) {
      for (let x = 0; x < 64; x++) {
        const e = ((x - 31.5) / 32) ** 2 + ((y - 16.5) / 17) ** 2;
        if (e > 1) continue;
        let cor = e > 0.8 ? '#2a6aa8' : '#3f86c8';
        if (e > 0.32 && e < 0.4) cor = '#8fc4ee';
        if (e > 0.1 && e < 0.14) cor = '#6aaee0';
        pixel(g, x, y, cor);
      }
    }
    for (const [x, y] of [[20, 10], [21, 10], [22, 10], [44, 22], [45, 22], [30, 14], [31, 14]]) pixel(g, x!, y!, '#e8f6ff');
  });
  // sombra do meteoro (elipse escura)
  canvasPlano(scene, 'sombra', 64, 34, (g) => {
    for (let y = 0; y < 34; y++) {
      for (let x = 0; x < 64; x++) {
        if (((x - 31.5) / 32) ** 2 + ((y - 16.5) / 17) ** 2 <= 1) pixel(g, x, y, '#000');
      }
    }
  });
  // chama azul do turbo: base à direita (no carro), ponta à esquerda; duas versões que se alternam
  for (const v of [0, 1]) {
    canvasPlano(scene, `chama${v}`, 24, 9, (g) => {
      const comp = v === 0 ? 24 : 18;
      for (let x = 0; x < 24; x++) {
        const t = (x - (24 - comp)) / comp; // 0 na ponta, 1 na base
        if (t < 0) continue;
        const meia = 4.4 * t;
        for (let y = 0; y < 9; y++) {
          const dy = Math.abs(y - 4);
          if (dy > meia) continue;
          if ((x * 5 + y * 3 + v) % 9 === 0 && t < 0.6) continue; // falhas na ponta: cintilar
          const k = dy / Math.max(0.5, meia);
          pixel(g, x, y, k < 0.35 ? '#ffffff' : k < 0.7 ? '#7fcaff' : '#2a7bff');
        }
      }
    });
  }
}
