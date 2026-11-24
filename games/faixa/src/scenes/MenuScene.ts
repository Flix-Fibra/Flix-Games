import Phaser from 'phaser';
import { PAD, PLAYER, VEHICLE_LEN, logKey, propKey, vehicleKey } from '../art';
import { unlockAudio } from '../audio';
import { loadBest } from '../storage';
import { CELL, COLORS, FONT, GAME_H, GAME_W } from '../theme';
import { portraitKey } from './BootScene';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.background);

    // mini cenário: grama, estrada, rio, estrada e grama, com o técnico atravessando
    const top = 96;
    const bands: Array<'grass' | 'road' | 'river'> = ['grass', 'road', 'river', 'road', 'grass'];
    bands.forEach((kind, i) => {
      const y = top + i * CELL;
      const color = kind === 'grass' ? (i % 2 ? COLORS.grassB : COLORS.grassA) : kind === 'road' ? COLORS.asphalt : COLORS.water;
      this.add.rectangle(0, y, GAME_W, CELL, color).setOrigin(0, 0);
    });
    const mid = (i: number): number => top + i * CELL + CELL / 2;
    this.add.image(40, mid(0), propKey(0)).setDisplaySize(CELL, CELL);
    this.add.image(190, mid(0), propKey(2)).setDisplaySize(CELL, CELL);
    this.add.image(230, mid(4), propKey(0)).setDisplaySize(CELL, CELL);
    this.add.image(60, mid(4), propKey(1)).setDisplaySize(CELL, CELL);
    for (const x of [40, 110, 190]) this.add.image(x, mid(2), PAD).setDisplaySize(CELL, CELL);
    const slide = (key: string, w: number, row: number, from: number, to: number, ms: number, flip = false): void => {
      const img = this.add.image(from, mid(row), key).setDisplaySize(w, CELL).setFlipX(flip);
      this.tweens.add({ targets: img, x: to, duration: ms, repeat: -1 });
    };
    slide(vehicleKey(0), VEHICLE_LEN[0] * CELL, 1, -40, GAME_W + 40, 2600);
    slide(vehicleKey(2), VEHICLE_LEN[2] * CELL, 3, GAME_W + 60, -60, 3400, true);
    const log = this.add.image(0, mid(2), logKey(3, 1)).setDisplaySize(3 * CELL, CELL);
    this.tweens.add({ targets: log, x: { from: -50, to: GAME_W + 50 }, duration: 5200, repeat: -1 });
    const hero = this.add.image(GAME_W / 2, mid(4), PLAYER).setDisplaySize(CELL, CELL);
    this.tweens.add({ targets: hero, y: mid(0), duration: 1400, yoyo: true, repeat: -1, hold: 300, ease: 'Sine.easeInOut' });

    this.add
      .text(GAME_W / 2, 40, 'FAIXA', { fontFamily: FONT, fontSize: '38px', fontStyle: 'bold', color: COLORS.text })
      .setOrigin(0.5);
    this.add
      .text(GAME_W / 2, 74, 'A FAIXA', { fontFamily: FONT, fontSize: '26px', fontStyle: 'bold', color: COLORS.flixRedText })
      .setOrigin(0.5);

    this.add.image(GAME_W / 2, 268, portraitKey('happy')).setScale(2.5);
    const best = loadBest();
    this.add
      .text(GAME_W / 2, 330, best > 0 ? `Seu melhor: ${best} faixas` : 'Atravesse a obra sem ser atingido!', {
        fontFamily: FONT, fontSize: '13px', color: COLORS.textMuted,
      })
      .setOrigin(0.5);

    const tap = this.add
      .text(GAME_W / 2, 386, 'TOQUE PARA COMEÇAR', { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: COLORS.text })
      .setOrigin(0.5);
    this.tweens.add({ targets: tap, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });
    this.add
      .text(GAME_W / 2, GAME_H - 38, '↑ ou W: avançar · ← → : lado · ↓ : voltar\nNo celular: toque para avançar,\ndeslize para os lados ou para baixo', {
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
