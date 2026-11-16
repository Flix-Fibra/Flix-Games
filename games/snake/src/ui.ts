import Phaser from 'phaser';
import { COLORS, FONT, GAME_H, GAME_W } from './theme';

/** Fundo da tela: degradê azul-escuro com um brilho suave no alto. */
export function drawBackground(scene: Phaser.Scene): void {
  const g = scene.add.graphics().setDepth(-10);
  g.fillGradientStyle(0x0b2a5c, 0x0b2a5c, 0x040c1c, 0x040c1c, 1);
  g.fillRect(0, 0, GAME_W, GAME_H);
  g.fillStyle(0x2f7be0, 0.12);
  g.fillCircle(GAME_W / 2, 140, 360);
}

/** Textura de brilho (círculo que some nas bordas) usada atrás da casa e do sinal. Criada uma vez. */
export function ensureGlowTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists('brilho')) return;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  scene.textures.addCanvas('brilho', canvas);
}

export interface ButtonOptions {
  width?: number;
  height?: number;
  fontSize?: number;
  onClick?: () => void;
}

/** Botão arredondado vermelho Flix, com brilho e texto em negrito. Sem `onClick`, serve só de visual. */
export function makeButton(scene: Phaser.Scene, x: number, y: number, label: string, opts: ButtonOptions = {}): Phaser.GameObjects.Container {
  const w = opts.width ?? 360;
  const h = opts.height ?? 88;
  const g = scene.add.graphics();
  g.fillStyle(0x7a0412, 1);
  g.fillRoundedRect(-w / 2, -h / 2 + 8, w, h, h / 2); // sombra de baixo (relevo)
  g.fillStyle(COLORS.flixRed, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  g.fillStyle(0xff6b78, 0.55);
  g.fillRoundedRect(-w / 2 + 14, -h / 2 + 8, w - 28, h / 2 - 8, (h / 2 - 8) / 2); // reflexo
  g.lineStyle(4, 0xffffff, 0.9);
  g.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  const t = scene.add
    .text(0, 2, label, { fontFamily: FONT, fontSize: `${opts.fontSize ?? 34}px`, color: '#FFFFFF', stroke: '#7a0412', strokeThickness: 6 })
    .setOrigin(0.5)
    .setResolution(2);
  const c = scene.add.container(x, y, [g, t]);
  if (opts.onClick) {
    c.setSize(w, h + 8).setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => {
      scene.tweens.add({ targets: c, scale: 0.94, duration: 70, yoyo: true });
      opts.onClick?.();
    });
  }
  return c;
}

/** Texto de título com contorno, no estilo dos logos do jogo. */
export function titleText(scene: Phaser.Scene, x: number, y: number, text: string, size: number, color = '#FFE14A', stroke = '#8a2b00'): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, color, stroke, strokeThickness: Math.round(size / 6) })
    .setOrigin(0.5)
    .setResolution(2)
    .setShadow(0, Math.round(size / 10), '#000000', 0, true, true);
}
