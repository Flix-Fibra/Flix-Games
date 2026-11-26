import Phaser from 'phaser';
import { hudText } from '@flix/game-kit/src/phaserHud';
import { ajustarCamera } from '../tela';
import { som } from '../som';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    ajustarCamera(this);
    const toque = this.registry.get('toque') as boolean;
    this.add.image(240, 135, 'fundo').setScale(0.5);
    const logo = this.add.image(240, 98, 'logo');
    logo.setScale(Math.min(0.5, 150 / logo.height));
    const chamada = hudText(this, 240, 192, toque ? 'TOQUE PARA JOGAR' : 'APERTE ENTER', 1.5).setOrigin(0.5).setTint(0x9ff4ff);
    this.tweens.add({ targets: chamada, alpha: 0.35, duration: 600, yoyo: true, repeat: -1 });
    hudText(this, 240, 220, 'FASES 1 A 3', 1).setOrigin(0.5).setTint(0xf6e7c1);
    if (!toque) {
      hudText(this, 240, 246, 'SETAS: ANDAR, SUBIR E DESCER · ESPAÇO: PULAR · X: ATACAR · C: PULSO · P: PAUSA', 0.5).setOrigin(0.5);
    }
    let foi = false;
    const jogar = () => {
      if (foi) return;
      foi = true;
      som.liberar();
      this.scene.start('Play');
    };
    this.input.once('pointerup', jogar);
    this.input.keyboard?.once('keydown-ENTER', jogar);
    this.input.keyboard?.once('keydown-SPACE', jogar);
  }
}
