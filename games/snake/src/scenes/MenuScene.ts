import Phaser from 'phaser';
import { unlockAudio } from '../audio';
import { loadBest } from '../storage';
import { COLORS, FONT, FONT_TEXT, GAME_W } from '../theme';
import { drawBackground, makeButton } from '../ui';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.background);
    drawBackground(this);

    const logo = this.add.image(GAME_W / 2, 360, 'logo');
    logo.setScale(500 / logo.width);
    this.tweens.add({ targets: logo, y: 346, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const best = loadBest();
    this.add
      .text(GAME_W / 2, 700, best > 0 ? `Seu melhor: ${best}` : 'Conecte as casas em 2 minutos', {
        fontFamily: FONT_TEXT,
        fontSize: '30px',
        color: COLORS.textMuted,
      })
      .setOrigin(0.5)
      .setResolution(2);

    const play = makeButton(this, GAME_W / 2, 790, 'TOQUE PARA COMEÇAR', { width: 440, height: 96, fontSize: 32 });
    this.tweens.add({ targets: play, scale: 1.06, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.add
      .text(GAME_W / 2, 910, 'Deslize o dedo para virar o cabo', { fontFamily: FONT, fontSize: '24px', color: '#6f8ab0' })
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
