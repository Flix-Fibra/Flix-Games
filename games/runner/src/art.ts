/**
 * Arte do Flix Runner desenhada por código: roteador (bônus) em pixel art e ondas de wifi. O personagem vem dos sprites
 * recortados da folha do gestor (ver `theme.ts`, `IMAGES`).
 */
import Phaser from 'phaser';

const C = { outline: '#190c10' };

function addOutline(buf: string[], W: number, H: number): string[] {
  const out = buf.slice();
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (buf[y * W + x]) continue;
      const n =
        (x > 0 && buf[y * W + x - 1]) || (x < W - 1 && buf[y * W + x + 1]) ||
        (y > 0 && buf[(y - 1) * W + x]) || (y < H - 1 && buf[(y + 1) * W + x]);
      if (n) out[y * W + x] = C.outline;
    }
  return out;
}

function toCanvas(buf: string[], w: number, h: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d')!;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const col = buf[y * w + x];
      if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
    }
  return cv;
}

// ---- roteador (bônus), mochila e ondas ----------------------------------------------------------------------------

function drawRouter(): string[] {
  const W = 24, H = 18;
  const buf: string[] = new Array(W * H).fill('');
  const rect = (x: number, y: number, w: number, h: number, c: string) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) buf[(y + j) * W + x + i] = c;
  };
  rect(4, 1, 2, 7, '#9aa4b8'); rect(18, 1, 2, 7, '#9aa4b8'); // antenas
  rect(4, 1, 2, 2, '#3fa9ff'); rect(18, 1, 2, 2, '#3fa9ff');
  rect(1, 8, 22, 8, '#2d3340'); // corpo
  rect(1, 8, 22, 1, '#56617a');
  rect(1, 15, 22, 1, '#1a1e27');
  rect(1, 13, 22, 2, '#d4142c'); // faixa Flix
  rect(4, 10, 2, 2, '#3ee07a'); rect(8, 10, 2, 2, '#3fa9ff'); rect(12, 10, 2, 2, '#3fa9ff'); rect(16, 10, 2, 2, '#ffffff');
  return addOutline(buf, W, H);
}

/** Texturas do roteador (`router`, 24x18), onda de wifi (`wifi_wave`) e brilho (`glow`). */
export function makeItemTextures(scene: Phaser.Scene): void {
  const addPix = (key: string, cv: HTMLCanvasElement) => {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, cv)?.setFilter(Phaser.Textures.FilterMode.NEAREST);
  };
  addPix('router', toCanvas(drawRouter(), 24, 18));

  // onda de wifi apontando para baixo: três arcos azuis concêntricos (suave, não pixelada)
  if (!scene.textures.exists('wifi_wave')) {
    const w = 120, h = 80;
    const t = scene.textures.createCanvas('wifi_wave', w, h);
    if (t) {
      const g = t.getContext();
      g.lineCap = 'round';
      const arc = (r: number, lw: number, col: string) => {
        g.strokeStyle = col; g.lineWidth = lw;
        g.beginPath(); g.arc(w / 2, 4, r, Math.PI * 0.18, Math.PI * 0.82); g.stroke();
      };
      for (const [r, a] of [[70, 0.55], [48, 0.8], [28, 1]] as const) {
        arc(r, 11, `rgba(18,110,235,${a})`);
        arc(r, 6, `rgba(120,200,255,${a})`);
        arc(r, 2.4, `rgba(235,248,255,${a})`);
      }
      t.refresh();
    }
  }
  if (!scene.textures.exists('glow')) {
    const t = scene.textures.createCanvas('glow', 128, 128);
    if (t) {
      const g = t.getContext();
      const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
      gr.addColorStop(0, 'rgba(120,200,255,0.9)');
      gr.addColorStop(1, 'rgba(120,200,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      t.refresh();
    }
  }
}
