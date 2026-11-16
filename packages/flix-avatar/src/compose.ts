import { mixColor } from './color';
import { avatarFingerprint, clothSwatch, hairSwatch, skinSwatch } from './sanitize';
import type { AvatarConfig, Expression } from './types';

const SIZE = 32;
const OUTLINE = '#1D1D1F';
const EYE = '#1D1D1F';

const cache = new Map<string, HTMLCanvasElement>();

/**
 * PLACEHOLDER do compositor do retrato (visão `portrait`, 32x32).
 * Desenha o personagem por código, sem nenhum arquivo de terceiros. Quando o designer entregar o kit,
 * esta função passa a pintar as peças em tons de cinza do atlas (AVATAR_SPEC.md), mantendo a mesma assinatura.
 */
export function composePortrait(config: AvatarConfig, expression: Expression): HTMLCanvasElement {
  const key = `${avatarFingerprint(config)}|${expression}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.imageSmoothingEnabled = false;

  const px = (color: string, x: number, y: number, w = 1, h = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };

  const skin = skinSwatch(config);
  const flixTech = config.skinPreset === 'flix_tech';
  const shirt = flixTech ? clothSwatch('c01') : clothSwatch(config.top?.primary);
  const hair = config.hair ? hairSwatch(config.hair.color) : null;

  // camiseta
  if (config.top || flixTech) {
    px(shirt.base, 5, 24, 22, 8);
    px(shirt.shade, 5, 29, 22, 3);
    if (flixTech) px('#F5F5F7', 5, 26, 22, 1);
  }
  // pescoço e cabeça
  px(skin.shade, 13, 21, 6, 4);
  px(skin.base, 8, 7, 16, 15);
  px(skin.shade, 22, 9, 2, 13);

  // sem cabelo: cabeça careca com topo arredondado e um brilho
  if (!hair) {
    for (const [x, y] of [[8, 7], [9, 7], [22, 7], [23, 7], [8, 8], [23, 8]] as const) ctx.clearRect(x, y, 1, 1);
    const shine = mixColor(skin.base, 0xffffff, 0.6);
    px(shine, 12, 8, 4, 1);
    px(shine, 11, 9, 2, 1);
    px(shine, 10, 10, 1, 2);
    px('#FFFFFF', 13, 8, 2, 1);
    px('#FFFFFF', 11, 9, 1, 1);
  }

  // cabelo
  if (hair) {
    const style = config.hair?.style;
    px(hair.base, 8, 5, 16, 5);
    px(hair.shade, 8, 9, 16, 1);
    if (style === 'h02_long') {
      px(hair.base, 6, 7, 3, 17);
      px(hair.base, 23, 7, 3, 17);
    } else if (style === 'h03_spiky') {
      px(hair.base, 9, 3, 3, 2);
      px(hair.base, 14, 2, 3, 3);
      px(hair.base, 19, 3, 3, 2);
    } else {
      px(hair.base, 7, 7, 2, 6);
      px(hair.base, 23, 7, 2, 6);
    }
  }
  // boné (acessório de Flix tech ou chapéu escolhido)
  if (config.hat || flixTech) {
    const cap = flixTech ? clothSwatch('c01') : clothSwatch(config.hat?.primary);
    px(cap.base, 7, 4, 18, 5);
    px(cap.shade, 7, 8, 18, 1);
    px(cap.base, 20, 8, 7, 2);
  }

  // rosto
  const eyeY = 14;
  if (expression === 'happy') {
    px(EYE, 11, eyeY + 1, 1, 1); px(EYE, 12, eyeY, 2, 1); px(EYE, 14, eyeY + 1, 1, 1);
    px(EYE, 17, eyeY + 1, 1, 1); px(EYE, 18, eyeY, 2, 1); px(EYE, 20, eyeY + 1, 1, 1);
    px(EYE, 12, 19, 8, 1); px(EYE, 13, 20, 6, 1);
    px('#FFFFFF', 14, 19, 4, 1);
  } else if (expression === 'sad') {
    px(EYE, 12, eyeY, 2, 3); px(EYE, 19, eyeY, 2, 3);
    px(EYE, 11, eyeY - 2, 3, 1); px(EYE, 19, eyeY - 2, 3, 1);
    px(EYE, 14, 20, 4, 1); px(EYE, 13, 21, 1, 1); px(EYE, 18, 21, 1, 1);
    px('#6FB7E8', 12, eyeY + 3, 1, 2);
  } else {
    px(EYE, 12, eyeY, 2, 3); px(EYE, 19, eyeY, 2, 3);
    px(EYE, 14, 20, 5, 1);
  }

  addOutline(ctx);
  cache.set(key, canvas);
  return canvas;
}

/** Contorno escuro de 1 pixel em volta de tudo que foi desenhado. */
function addOutline(ctx: CanvasRenderingContext2D): void {
  const img = ctx.getImageData(0, 0, SIZE, SIZE);
  const src = img.data;
  const alphaAt = (x: number, y: number): number =>
    x < 0 || y < 0 || x >= SIZE || y >= SIZE ? 0 : (src[(y * SIZE + x) * 4 + 3] ?? 0);
  const marks: Array<[number, number]> = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (alphaAt(x, y) > 0) continue;
      if (alphaAt(x - 1, y) > 0 || alphaAt(x + 1, y) > 0 || alphaAt(x, y - 1) > 0 || alphaAt(x, y + 1) > 0) {
        marks.push([x, y]);
      }
    }
  }
  ctx.fillStyle = OUTLINE;
  for (const [x, y] of marks) ctx.fillRect(x, y, 1, 1);
}
