import Phaser from 'phaser';
import { cellKey } from '../art';
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

    // os cinco itens do estoque "flutuando" em sequência
    const size = 44;
    const gap = 6;
    const x0 = GAME_W / 2 - (5 * size + 4 * gap) / 2 + size / 2;
    for (let i = 0; i < 5; i++) {
      const img = this.add.image(x0 + i * (size + gap), 92, cellKey(i + 1)).setDisplaySize(size, size);
      this.tweens.add({ targets: img, y: 84, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: i * 140 });
    }

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
      .text(GAME_W / 2, 352, best > 0 ? `Seu melhor: ${best}` : 'Junte mais de 3 iguais: vale muito mais', {
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
      .text(GAME_W / 2, GAME_H - 30, 'Arraste para os lados · toque para girar\ndeslize para baixo para derrubar', {
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
