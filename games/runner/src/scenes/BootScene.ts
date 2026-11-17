import Phaser from 'phaser';
import type { HubToGame } from '@flix/game-sdk';
import { makeItemTextures } from '../art';
import { COLORS, FONT_TEXT, GAME_H, GAME_W, IMAGES } from '../theme';

const INIT_TIMEOUT_MS = 1500;

/** Carrega o cenário, gera as texturas por código e espera o `init` do hub por até 1,5 s (nunca trava esperando). */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.cameras.main.setBackgroundColor(COLORS.background);
    const barW = 320;
    this.add.text(GAME_W / 2, GAME_H / 2 - 40, 'Carregando...', { fontFamily: FONT_TEXT, fontSize: '28px', color: COLORS.textMuted }).setOrigin(0.5);
    this.add.rectangle(GAME_W / 2, GAME_H / 2, barW + 8, 24, 0x000000, 0.35);
    const bar = this.add.rectangle(GAME_W / 2 - barW / 2, GAME_H / 2, 0, 16, COLORS.flixRed).setOrigin(0, 0.5);
    this.load.on('progress', (v: number) => (bar.width = barW * v));
    for (const [key, file] of IMAGES) this.load.image(key, `img/${file}`);
  }

  create(): void {
    makeItemTextures(this);

    const existing = this.registry.get('hubInit') as Extract<HubToGame, { type: 'init' }> | undefined;
    if (existing) {
      this.finish(existing.muted);
      return;
    }
    let done = false;
    const complete = (muted: boolean) => {
      if (done) return;
      done = true;
      this.finish(muted);
    };
    this.game.events.once('hub-init', (m: Extract<HubToGame, { type: 'init' }>) => complete(m.muted));
    this.time.delayedCall(INIT_TIMEOUT_MS, () => complete(false));
  }

  private finish(muted: boolean): void {
    this.game.sound.mute = muted;
    this.scene.start('Menu');
  }
}
