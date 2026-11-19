import Phaser from 'phaser';
import { DEVICE_LEFT, DEVICE_RIGHT, PLUG_RATIO, cellKey, plugKey } from '../art';
import { unlockAudio } from '../audio';
import { loadBest } from '../storage';
import { COLORS, FONT, GAME_H, GAME_W } from '../theme';
import { portraitKey } from './BootScene';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.background);

    // um cabo de 7 pedaços (as 7 cores) ligando o roteador ao computador, com o sinal passando
    const size = 22;
    const plugW = 24;
    const devSize = 26;
    const rowY = 90;
    const cableW = 7 * size;
    const x0 = GAME_W / 2 - cableW / 2;
    for (let i = 0; i < 7; i++) this.add.image(x0 + i * size + size / 2, rowY, cellKey(i + 1)).setDisplaySize(size, size);
    this.add.image(x0 - plugW / 2, rowY, plugKey(1)).setDisplaySize(plugW, plugW / PLUG_RATIO).setFlipX(true);
    this.add.image(x0 + cableW + plugW / 2, rowY, plugKey(7)).setDisplaySize(plugW, plugW / PLUG_RATIO);
    const left = this.add.image(x0 - plugW - devSize / 2 + 2, rowY, DEVICE_LEFT).setDisplaySize(devSize, devSize);
    const right = this.add.image(x0 + cableW + plugW + devSize / 2 - 2, rowY, DEVICE_RIGHT).setDisplaySize(devSize, devSize);
    const pulse = this.add.graphics();
    const run = { t: 0 };
    this.tweens.add({
      targets: run, t: 1, duration: 1100, repeat: -1, repeatDelay: 500, ease: 'Sine.easeInOut',
      onUpdate: () => {
        const x = left.x + (right.x - left.x) * run.t;
        pulse.clear();
        pulse.fillStyle(0x9fe6ff, 0.5).fillCircle(x, rowY, 7);
        pulse.fillStyle(0xffffff, 1).fillCircle(x, rowY, 3.5);
      },
    });

    this.add
      .text(GAME_W / 2, 178, 'ESTOQUE', { fontFamily: FONT, fontSize: '38px', fontStyle: 'bold', color: COLORS.text })
      .setOrigin(0.5)
      .setResolution(2);
    this.add
      .text(GAME_W / 2, 218, 'FLIX', { fontFamily: FONT, fontSize: '38px', fontStyle: 'bold', color: COLORS.flixRedText })
      .setOrigin(0.5)
      .setResolution(2);

    this.add.image(GAME_W / 2, 292, portraitKey('happy')).setScale(2.5);

    const best = loadBest();
    this.add
      .text(GAME_W / 2, 352, best > 0 ? `Seu melhor: ${best}` : 'Ligue os cabos de ponta a ponta!', {
        fontFamily: FONT, fontSize: '13px', color: COLORS.textMuted,
      })
      .setOrigin(0.5)
      .setResolution(2);

    const tap = this.add
      .text(GAME_W / 2, 404, 'TOQUE PARA COMEÇAR', { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: COLORS.text })
      .setOrigin(0.5)
      .setResolution(2);
    this.tweens.add({ targets: tap, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });
    this.add
      .text(GAME_W / 2, GAME_H - 34, '← → mover · ↑ girar · ↓ descer\nespaço: derrubar de uma vez\nNo celular: arraste para mover, toque para girar', {
        fontFamily: FONT, fontSize: '10px', color: COLORS.textMuted, align: 'center', lineSpacing: 3,
      })
      .setOrigin(0.5)
      .setResolution(2);

    this.input.once('pointerdown', () => this.begin());
    this.input.keyboard?.once('keydown', () => this.begin());
  }

  private begin(): void {
    unlockAudio();
    this.scene.start('Play');
  }
}
