import Phaser from 'phaser';
import { unlockAudio } from '../audio';
import { mixColor, roundedPath } from '../cablePath';
import { loadBest } from '../storage';
import { CABLE_BLUE, COLORS, FONT, GAME_H, GAME_W } from '../theme';
import { portraitKey } from './BootScene';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.background);
    const cable: number = CABLE_BLUE.base;
    const shade: number = CABLE_BLUE.shade;

    // cabo decorativo
    const g = this.add.graphics();
    const path = roundedPath(
      [{ x: -10, y: 120 }, { x: 60, y: 120 }, { x: 60, y: 90 }, { x: 210, y: 90 }, { x: 210, y: 150 }, { x: GAME_W + 10, y: 150 }],
      14,
      8,
    );
    const shifted = (d: number) => path.map((v) => ({ x: v.x + d, y: v.y + d }));
    g.lineStyle(13, COLORS.cableOutline, 1);
    g.strokePoints(path, false, false);
    g.lineStyle(9, shade, 1);
    g.strokePoints(path, false, false);
    g.lineStyle(6, cable, 1);
    g.strokePoints(shifted(-0.7), false, false);
    g.lineStyle(2, mixColor(cable, 0xffffff, 0.4), 1);
    g.strokePoints(shifted(-1.8), false, false);
    g.lineStyle(1, mixColor(cable, 0xffffff, 0.8), 1);
    g.strokePoints(shifted(-2.4), false, false);

    this.add
      .text(GAME_W / 2, 190, 'FIBRA', { fontFamily: FONT, fontSize: '40px', fontStyle: 'bold', color: COLORS.text })
      .setOrigin(0.5)
      .setResolution(2);
    this.add
      .text(GAME_W / 2, 232, 'CONECTA', { fontFamily: FONT, fontSize: '40px', fontStyle: 'bold', color: COLORS.flixRedText })
      .setOrigin(0.5)
      .setResolution(2);

    this.add.image(GAME_W / 2, 305, portraitKey('happy')).setScale(3);

    const best = loadBest();
    this.add
      .text(GAME_W / 2, 372, best > 0 ? `Seu melhor: ${best}` : 'Conecte as casas em 2 minutos', {
        fontFamily: FONT,
        fontSize: '13px',
        color: COLORS.textMuted,
      })
      .setOrigin(0.5)
      .setResolution(2);

    const tap = this.add
      .text(GAME_W / 2, 420, 'TOQUE PARA COMEÇAR', { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: COLORS.text })
      .setOrigin(0.5)
      .setResolution(2);
    this.tweens.add({ targets: tap, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });
    this.add
      .text(GAME_W / 2, GAME_H - 18, 'Deslize o dedo para virar o cabo', { fontFamily: FONT, fontSize: '10px', color: COLORS.textMuted })
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
