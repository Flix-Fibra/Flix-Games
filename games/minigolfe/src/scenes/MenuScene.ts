import Phaser from 'phaser';
import { unlockAudio } from '../audio';
import { LEVELS } from '../levels';
import { loadBest } from '../storage';
import { COLORS, FONT, GAME_H, GAME_W } from '../theme';
import { portraitKey } from './BootScene';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.background);

    // mini campo com a bola indo para o buraco
    const gx = GAME_W / 2 - 80;
    const gy = 104;
    const g = this.add.graphics();
    g.fillStyle(COLORS.wall, 1).fillRoundedRect(gx - 5, gy - 5, 170, 66, 6);
    g.fillStyle(COLORS.grassA, 1).fillRoundedRect(gx, gy, 160, 56, 3);
    g.fillStyle(COLORS.grassB, 1).fillRect(gx + 20, gy, 20, 56).fillRect(gx + 60, gy, 20, 56).fillRect(gx + 100, gy, 20, 56);
    g.fillStyle(COLORS.hole, 1).fillCircle(gx + 138, gy + 28, 7);
    g.lineStyle(1.5, 0xffffff, 1).lineBetween(gx + 138, gy + 28, gx + 138, gy + 8);
    g.fillStyle(COLORS.flag, 1).fillTriangle(gx + 138, gy + 8, gx + 150, gy + 13, gx + 138, gy + 18);
    const ball = this.add.circle(gx + 18, gy + 28, 4.5, 0xffffff);
    this.tweens.add({ targets: ball, x: gx + 135, duration: 1500, ease: 'Sine.easeOut', repeat: -1, repeatDelay: 600 });

    this.add.text(GAME_W / 2, 40, 'MINIGOLFE', { fontFamily: FONT, fontSize: '34px', fontStyle: 'bold', color: COLORS.text }).setOrigin(0.5);
    this.add.text(GAME_W / 2, 74, 'FLIX', { fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: COLORS.flixRedText }).setOrigin(0.5);

    this.add.image(GAME_W / 2, 238, portraitKey('happy')).setScale(2.5);
    const best = loadBest();
    this.add
      .text(GAME_W / 2, 300, best > 0 ? `Seu melhor: ${best} tacadas` : `${LEVELS.length} buracos. Menos tacadas, melhor!`, {
        fontFamily: FONT, fontSize: '13px', color: COLORS.textMuted,
      })
      .setOrigin(0.5);

    const tap = this.add
      .text(GAME_W / 2, 360, 'TOQUE PARA COMEÇAR', { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: COLORS.text })
      .setOrigin(0.5);
    this.tweens.add({ targets: tap, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });
    this.add
      .text(GAME_W / 2, GAME_H - 44, 'Arraste para trás para mirar\ne solte para tacar.\nÁgua e fora do campo custam 1 tacada.', {
        fontFamily: FONT, fontSize: '10px', color: COLORS.textMuted, align: 'center', lineSpacing: 3,
      })
      .setOrigin(0.5);

    this.input.once('pointerdown', () => this.begin());
    this.input.keyboard?.once('keydown', () => this.begin());
  }

  private begin(): void {
    unlockAudio();
    this.scene.start('Play');
  }
}
