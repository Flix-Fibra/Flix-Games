import Phaser from 'phaser';

/**
 * Textura feita por código: o halo do morcego. (A pedra e o fundo da floresta são imagens do gestor.)
 */
export function makeTextures(scene: Phaser.Scene): void {
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
