import Phaser from 'phaser';
import { DEFAULT_AVATAR, composePortrait, type AvatarConfig, type Expression } from '@flix/avatar';
import type { HubToGame } from '@flix/game-sdk';
import { setMuted } from '../audio';
import { COLORS, FONT, GAME_H, GAME_W } from '../theme';

const INIT_TIMEOUT_MS = 1500;
export const EXPRESSIONS: Expression[] = ['neutral', 'happy', 'sad'];
export const portraitKey = (e: Expression): string => `portrait_${e}`;

/**
 * Espera a mensagem `init` do hub por até 1,5 s. Se não chegar, segue com o personagem padrão:
 * o jogo nunca fica travado esperando o personagem.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.background);
    this.add
      .text(GAME_W / 2, GAME_H / 2, 'Carregando...', { fontFamily: FONT, fontSize: '14px', color: COLORS.textMuted })
      .setOrigin(0.5)
      .setResolution(2);

    const existing = this.registry.get('hubInit') as Extract<HubToGame, { type: 'init' }> | undefined;
    if (existing) {
      this.finish(existing.avatar, existing.muted);
      return;
    }

    let done = false;
    const complete = (avatar: AvatarConfig, muted: boolean) => {
      if (done) return;
      done = true;
      this.finish(avatar, muted);
    };
    this.game.events.once('hub-init', (msg: Extract<HubToGame, { type: 'init' }>) => complete(msg.avatar, msg.muted));
    this.time.delayedCall(INIT_TIMEOUT_MS, () => complete(DEFAULT_AVATAR, false));
  }

  private finish(avatar: AvatarConfig, muted: boolean): void {
    setMuted(muted);
    this.registry.set('avatar', avatar);
    for (const expr of EXPRESSIONS) {
      const key = portraitKey(expr);
      if (this.textures.exists(key)) this.textures.remove(key);
      this.textures.addCanvas(key, composePortrait(avatar, expr));
    }
    this.scene.start('Menu');
  }
}
