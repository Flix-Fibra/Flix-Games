import Phaser from 'phaser';
import { STONE_R } from './logic';

/**
 * Texturas feitas por código: a pedra e o halo do morcego. (O fundo da floresta é a imagem `fundo.jpg` do gestor.)
 */
export function makeTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists('pedra')) {
    const s = STONE_R * 2 + 4;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    const c = s / 2;
    g.fillStyle(0x1a1a1a, 1).fillCircle(c, c, STONE_R + 1.5);
    g.fillStyle(0x7d7f84, 1).fillCircle(c, c, STONE_R);
    g.fillStyle(0x5d5f63, 1).fillCircle(c + 2, c + 2.5, STONE_R - 3);
    g.fillStyle(0xb9bbc0, 1).fillCircle(c - 3, c - 3, 2.6);
    g.generateTexture('pedra', s, s);
    g.destroy();
  }
  // halo claro atrás do morcego, para ele se destacar da floresta vermelha
  if (!scene.textures.exists('halo')) {
    const size = 170;
    const tex = scene.textures.createCanvas('halo', size, size)!;
    const ctx = tex.getContext();
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,240,200,0.75)');
    grad.addColorStop(0.55, 'rgba(255,220,170,0.35)');
    grad.addColorStop(1, 'rgba(255,200,150,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    tex.refresh();
  }
}
