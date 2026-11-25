import Phaser from 'phaser';
import { FUNDO_SIZE } from '../hitboxes';
import { backgroundLayout, BG_FACTOR } from '../logic';
import { DEPTH } from '../theme';

/**
 * Fundo contínuo: a imagem, depois ela espelhada na horizontal, depois normal, depois espelhada, e assim por diante
 * (as pontas de cada par se encontram, então não aparece emenda). Anda para a esquerda, na mesma direção dos
 * obstáculos, mas bem mais devagar (BG_FACTOR da velocidade deles).
 */
export class Backdrop {
  private readonly imgs: Phaser.GameObjects.Image[];
  private offset = 0;

  constructor(scene: Phaser.Scene) {
    const [w] = FUNDO_SIZE;
    const count = Math.ceil(scene.scale.width / w) + 2;
    this.imgs = Array.from({ length: count }, () => scene.add.image(0, 0, 'fundo').setOrigin(0, 0).setDepth(DEPTH.bg));
    this.layout();
  }

  /** `dx`: quanto os obstáculos andaram neste quadro (px); o fundo anda a fração BG_FACTOR disso. */
  advance(dx: number): void {
    this.offset += dx * BG_FACTOR;
    this.layout();
  }

  private layout(): void {
    const [w] = FUNDO_SIZE;
    backgroundLayout(this.offset, w, this.imgs.length).forEach((p, i) => {
      const img = this.imgs[i]!;
      img.setX(Math.round(p.x)).setFlipX(p.flip);
    });
  }
}
