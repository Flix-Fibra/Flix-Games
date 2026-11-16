import Phaser from 'phaser';
import { DEFAULT_AVATAR, composePortrait, type AvatarConfig, type Expression } from '@flix/avatar';
import type { HubToGame } from '@flix/game-sdk';
import { setMuted } from '../audio';
import { COLORS, FONT_TEXT, GAME_H, GAME_W, IMAGES } from '../theme';
import { drawBackground, ensureGlowTexture } from '../ui';

const INIT_TIMEOUT_MS = 1500;
export const EXPRESSIONS: Expression[] = ['neutral', 'happy', 'sad'];
export const portraitKey = (e: Expression): string => `portrait_${e}`;

/**
 * Carrega as imagens (com barra de progresso) e espera a mensagem `init` do hub por até 1,5 s.
 * Se o `init` não chegar, segue com o personagem padrão: o jogo nunca fica travado esperando o personagem.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.cameras.main.setBackgroundColor(COLORS.background);
    drawBackground(this);
    const barW = 320;
    const frame = this.add.rectangle(GAME_W / 2, GAME_H / 2, barW + 8, 28, 0x000000, 0.4).setStrokeStyle(3, 0xffffff, 0.6);
    const bar = this.add.rectangle(GAME_W / 2 - barW / 2, GAME_H / 2, 0, 20, COLORS.flixRed).setOrigin(0, 0.5);
    this.add
      .text(GAME_W / 2, GAME_H / 2 - 50, 'Carregando...', { fontFamily: FONT_TEXT, fontSize: '28px', color: COLORS.textMuted })
      .setOrigin(0.5)
      .setResolution(2);
    this.load.on('progress', (v: number) => {
      bar.width = barW * v;
    });
    this.load.once('complete', () => frame.destroy());
    // as imagens ficam em public/img/ (caminho relativo: funciona em qualquer subpasta)
    for (const [key, file] of IMAGES) this.load.image(key, `img/${file}`);
  }

  create(): void {
    ensureGlowTexture(this);
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
      const tex = this.textures.addCanvas(key, composePortrait(avatar, expr));
      tex?.setFilter(Phaser.Textures.FilterMode.NEAREST); // o retrato do personagem continua nítido, sem borrar
    }
    this.scene.start('Menu');
  }
}
