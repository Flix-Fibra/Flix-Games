import Phaser from 'phaser';
import { BRANCH, SHELF, TRUNK, WORLD_W, type SlotInfo } from './logic';
import { DEPTH } from './theme';

const MOSS_SCALE = 0.7;
/** Centro da parte visível do tronco (x) a partir da borda da tela, para o musgo cobrir as emendas. */
const MOSS_X = (WORLD_W - (TRUNK.x + TRUNK.bodyL)) / 2;

interface Segment {
  top: number;
  objs: Phaser.GameObjects.GameObject[];
}

/**
 * Os dois troncos, presos às bordas da tela: a imagem do tronco liso empilhada de baixo para cima, com musgo em cada emenda.
 * O tronco nunca sai do lugar; os apoios (`addSupport`) ficam atrás dele.
 */
export class TrunkColumns {
  private sides: Array<{ top: number; segs: Segment[] }>;

  constructor(
    private scene: Phaser.Scene,
    startBottom: number,
  ) {
    this.sides = [
      { top: startBottom, segs: [] },
      { top: startBottom, segs: [] },
    ];
  }

  /** Empilha troncos até acima de `viewTop` e apaga os que ficaram bem abaixo de `viewBottom`. */
  update(viewTop: number, viewBottom: number): void {
    this.sides.forEach((s, side) => {
      while (s.top > viewTop - 300) {
        const top = s.top - TRUNK.h;
        const right = side === 1;
        // a imagem é a do lado direito; à esquerda, espelhada
        const img = this.scene.add
          .image(right ? TRUNK.x : WORLD_W - TRUNK.x - TRUNK.w, top, TRUNK.key)
          .setOrigin(0, 0)
          .setFlipX(!right)
          .setDepth(DEPTH.trunk);
        const objs: Phaser.GameObjects.GameObject[] = [img];
        if (s.segs.length > 0) {
          objs.push(
            this.scene.add
              .image(right ? WORLD_W - MOSS_X : MOSS_X, s.top, 'musgo')
              .setScale(MOSS_SCALE)
              .setFlipX(Math.random() < 0.5)
              .setDepth(DEPTH.moss),
          );
        }
        s.segs.push({ top, objs });
        s.top = top;
      }
      while (s.segs.length > 1 && s.segs[0]!.top > viewBottom + 400) {
        for (const o of s.segs.shift()!.objs) o.destroy();
      }
    });
  }
}

/**
 * Desenha o apoio de um slot (orelha de pau ou galho) atrás do tronco do lado dele. Com `animate`, ele sai de trás do tronco:
 * começa escondido (atrás do tronco e fora da tela) e desliza para o lugar.
 */
export function addSupport(scene: Phaser.Scene, slot: SlotInfo, animate: boolean): Phaser.GameObjects.Image {
  const right = slot.side === 'right';
  let img: Phaser.GameObjects.Image;
  let hide: number;
  if (slot.kind === 'shelf') {
    // a imagem é a orelha do lado direito; à esquerda, espelhada
    const x = right ? SHELF.left : WORLD_W - SHELF.left - SHELF.w;
    img = scene.add.image(x, slot.pieceY, 'orelha').setOrigin(0, 0).setFlipX(!right).setDepth(DEPTH.support);
    hide = SHELF.w + 10;
  } else {
    // a imagem é o galho do lado esquerdo; à direita, espelhado
    const x = right ? WORLD_W - BRANCH.left - BRANCH.w : BRANCH.left;
    img = scene.add.image(x, slot.pieceY, 'galho').setOrigin(0, 0).setFlipX(right).setDepth(DEPTH.support);
    hide = BRANCH.w;
  }
  if (animate) {
    const finalX = img.x;
    img.x += right ? hide : -hide;
    scene.tweens.add({ targets: img, x: finalX, duration: 380, ease: 'Cubic.easeOut' });
  }
  return img;
}
