import Phaser from 'phaser';
import type { Expression } from '@flix/avatar';
import type { HubBridge } from '@flix/game-sdk';
import { unlockAudio } from '../audio';
import type { Cause } from '../logic';
import { saveBest } from '../storage';
import { COLORS, FONT, FONT_TEXT, GAME_H, GAME_W } from '../theme';
import { drawBackground, makeButton } from '../ui';
import { portraitKey } from './BootScene';

interface GameOverData {
  score: number;
  items: number;
  cause: Cause;
  previousBest: number;
  expression: Expression;
}

const CAUSE_TEXT: Record<Cause, string> = {
  obstacle: 'O cabo bateu na cerca',
  self: 'O cabo se enrolou',
  timeout: 'Tempo esgotado!',
};

/**
 * Tela de fim de partida, sem anúncio. O `gameover` já foi enviado pela PlayScene.
 * O botão de recomeçar é sempre o do jogo, dentro e fora do hub (o hub também pode mandar `restart`).
 */
export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create(data: GameOverData): void {
    const bridge = this.registry.get('bridge') as HubBridge;
    this.cameras.main.setBackgroundColor(COLORS.background);
    drawBackground(this);
    const best = saveBest(data.score);
    const newRecord = data.score > 0 && data.score > data.previousBest;

    // logo do jogo (modelo do gestor), entrando com um "pulo"
    const logo = this.add.image(GAME_W / 2, 250, 'logo').setScale(0);
    const logoScale = 380 / logo.width;
    this.tweens.add({ targets: logo, scale: logoScale, duration: 380, ease: 'Back.easeOut' });
    this.tweens.add({ targets: logo, y: 238, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 450 });

    this.add
      .text(GAME_W / 2, 490, CAUSE_TEXT[data.cause], { fontFamily: FONT_TEXT, fontSize: '34px', color: COLORS.textMuted })
      .setOrigin(0.5)
      .setResolution(2);

    this.add.image(92, 590, portraitKey(data.expression)).setScale(4);
    this.add.text(330, 535, 'PONTOS', { fontFamily: FONT_TEXT, fontSize: '24px', color: COLORS.textMuted }).setOrigin(0.5).setResolution(2);
    this.add
      .text(330, 595, String(data.score), { fontFamily: FONT, fontSize: '84px', color: '#FFFFFF', stroke: '#0a1c3a', strokeThickness: 10 })
      .setOrigin(0.5)
      .setResolution(2);

    this.add
      .text(GAME_W / 2, 690, `${data.items} ${data.items === 1 ? "item conectado" : "itens conectados"}`, {
        fontFamily: FONT_TEXT, fontSize: '32px', color: '#FFFFFF',
      })
      .setOrigin(0.5)
      .setResolution(2);
    this.add
      .text(GAME_W / 2, 742, newRecord ? 'NOVO RECORDE!' : `Seu melhor: ${best}`, {
        fontFamily: newRecord ? FONT : FONT_TEXT, fontSize: '32px', color: newRecord ? COLORS.gold : COLORS.textMuted,
      })
      .setOrigin(0.5)
      .setResolution(2);

    const restart = () => {
      unlockAudio();
      this.scene.start('Play');
    };

    // O botão de recomeçar é sempre o do jogo (o hub não mostra outro); a mensagem `restart` do hub continua valendo.
    makeButton(this, GAME_W / 2, 850, 'JOGAR', { width: 230, height: 70, fontSize: 32, onClick: restart });
    if (bridge.embedded) {
      const off = bridge.onHubMessage((msg) => {
        if (msg.type === 'restart') restart();
      });
      this.events.once('shutdown', off);
    } else {
      this.add
        .text(GAME_W / 2, GAME_H - 28, 'modo de desenvolvimento (sem hub)', { fontFamily: FONT_TEXT, fontSize: '20px', color: '#6f8ab0' })
        .setOrigin(0.5)
        .setResolution(2);
    }
  }
}
