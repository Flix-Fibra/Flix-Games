import Phaser from 'phaser';
import type { HubToGame } from '@flix/game-sdk';
import { buildItemTextures } from '../art';
import { setMuted } from '../audio';
import { COLORS, FONT, GAME_H, GAME_W } from '../theme';

const INIT_TIMEOUT_MS = 1500;

/**
 * Espera a mensagem `init` do hub por até 1,5 s (só para saber se o som começa mudo). Se não chegar, segue:
 * o jogo nunca fica travado esperando o hub. O visual moderno não usa o retrato pixelado do personagem.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.background);
    this.add
      .text(GAME_W / 2, GAME_H / 2, 'Carregando...', { fontFamily: FONT, fontSize: '12px', color: COLORS.textMuted })
      .setOrigin(0.5);

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
    this.game.events.once('hub-init', (msg: Extract<HubToGame, { type: 'init' }>) => complete(msg.muted));
    this.time.delayedCall(INIT_TIMEOUT_MS, () => complete(false));
  }

  private finish(muted: boolean): void {
    setMuted(muted);
    buildItemTextures(this);
    this.scene.start('Menu');
  }
}
