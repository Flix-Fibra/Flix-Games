import Phaser from 'phaser';
import type { Expression } from '@flix/avatar';
import type { HubBridge } from '@flix/game-sdk';
import { unlockAudio } from '../audio';
import { renderRj45Logo } from '../logoArt';
import type { Cause } from '../logic';
import { saveBest } from '../storage';
import { CABLE_BLUE_PALETTE, COLORS, FONT, GAME_H, GAME_W } from '../theme';
import { portraitKey } from './BootScene';

interface GameOverData {
  score: number;
  houses: number;
  cause: Cause;
  previousBest: number;
  expression: Expression;
}

const CAUSE_TEXT: Record<Cause, string> = {
  self: 'O cabo se enrolou',
  obstacle: 'O cabo bateu na obra',
  timeout: 'Tempo esgotado!',
};

/**
 * Tela de fim de partida, sem anúncio. O `gameover` já foi enviado pela PlayScene.
 * Dentro do hub, o botão de recomeçar é do hub (mensagem `restart`). Fora dele (desenvolvimento), mostramos o nosso.
 */
export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create(data: GameOverData): void {
    const bridge = this.registry.get('bridge') as HubBridge;
    this.cameras.main.setBackgroundColor(COLORS.background);
    const best = saveBest(data.score);
    const newRecord = data.score > 0 && data.score > data.previousBest;

    // emblema: close do conector RJ45 em pixel art, sem texto
    const logoKey = 'logo_rj45';
    if (!this.textures.exists(logoKey)) this.textures.addCanvas(logoKey, renderRj45Logo(CABLE_BLUE_PALETTE));
    const logo = this.add.image(GAME_W / 2, 106, logoKey).setScale(0);
    this.tweens.add({ targets: logo, scale: 2, duration: 320, ease: 'Back.easeOut' });
    this.tweens.add({ targets: logo, y: 102, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 400 });

    this.add
      .text(GAME_W / 2, 214, CAUSE_TEXT[data.cause], { fontFamily: FONT, fontSize: '14px', color: COLORS.textMuted })
      .setOrigin(0.5)
      .setResolution(2);
    this.add.image(44, 276, portraitKey(data.expression)).setScale(2);
    this.add.text(166, 240, 'PONTOS', { fontFamily: FONT, fontSize: '11px', color: COLORS.textMuted }).setOrigin(0.5).setResolution(2);
    this.add
      .text(166, 276, String(data.score), { fontFamily: FONT, fontSize: '44px', fontStyle: 'bold', color: COLORS.text })
      .setOrigin(0.5)
      .setResolution(2);
    this.add
      .text(GAME_W / 2, 326, `${data.houses} ${data.houses === 1 ? 'casa conectada' : 'casas conectadas'}`, {
        fontFamily: FONT, fontSize: '13px', color: COLORS.text,
      })
      .setOrigin(0.5)
      .setResolution(2);
    this.add
      .text(GAME_W / 2, 350, newRecord ? 'NOVO RECORDE!' : `Seu melhor: ${best}`, {
        fontFamily: FONT, fontSize: '13px', fontStyle: newRecord ? 'bold' : 'normal', color: newRecord ? COLORS.gold : COLORS.textMuted,
      })
      .setOrigin(0.5)
      .setResolution(2);

    const restart = () => {
      unlockAudio();
      this.scene.start('Play');
    };

    if (bridge.embedded) {
      const off = bridge.onHubMessage((msg) => {
        if (msg.type === 'restart') restart();
      });
      this.events.once('shutdown', off);
    } else {
      const btn = this.add
        .text(GAME_W / 2, 410, 'JOGAR DE NOVO', {
          fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: '#FFFFFF', backgroundColor: '#D4142C', padding: { x: 18, y: 10 },
        })
        .setOrigin(0.5)
        .setResolution(2)
        .setInteractive({ useHandCursor: true });
      btn.on('pointerdown', restart);
      this.add
        .text(GAME_W / 2, GAME_H - 18, 'modo de desenvolvimento (sem hub)', { fontFamily: FONT, fontSize: '9px', color: COLORS.textMuted })
        .setOrigin(0.5)
        .setResolution(2);
    }
  }
}
