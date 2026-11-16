import Phaser from 'phaser';
import type { Expression } from '@flix/avatar';
import type { HubBridge } from '@flix/game-sdk';
import { unlockAudio } from '../audio';
import { cellKey } from '../art';
import type { Cause } from '../logic';
import { saveBest } from '../storage';
import { COLORS, FONT, GAME_H, GAME_W } from '../theme';
import { portraitKey } from './BootScene';

interface GameOverData {
  score: number;
  stored: number;
  bestChain: number;
  cause: Cause;
  previousBest: number;
  expression: Expression;
}

const CAUSE_TEXT: Record<Cause, string> = {
  overflow: 'O estoque lotou!',
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

    // emblema: os itens do estoque
    const size = 40;
    for (let i = 0; i < 5; i++) {
      const img = this.add.image(GAME_W / 2 + (i - 2) * (size + 4), 92, cellKey(i + 1)).setDisplaySize(size, size);
      this.tweens.add({ targets: img, y: 86, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: i * 120 });
    }

    this.add
      .text(GAME_W / 2, 160, CAUSE_TEXT[data.cause], { fontFamily: FONT, fontSize: '15px', color: COLORS.textMuted })
      .setOrigin(0.5)
      .setResolution(2);
    this.add.image(44, 238, portraitKey(data.expression)).setScale(2);
    this.add.text(166, 204, 'PONTOS', { fontFamily: FONT, fontSize: '11px', color: COLORS.textMuted }).setOrigin(0.5).setResolution(2);
    this.add
      .text(166, 240, String(data.score), { fontFamily: FONT, fontSize: '44px', fontStyle: 'bold', color: COLORS.text })
      .setOrigin(0.5)
      .setResolution(2);
    this.add
      .text(GAME_W / 2, 300, `${data.stored} ${data.stored === 1 ? 'item guardado' : 'itens guardados'}  ·  cadeia x${data.bestChain}`, {
        fontFamily: FONT, fontSize: '12px', color: COLORS.text,
      })
      .setOrigin(0.5)
      .setResolution(2);
    this.add
      .text(GAME_W / 2, 326, newRecord ? 'NOVO RECORDE!' : `Seu melhor: ${best}`, {
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
        .text(GAME_W / 2, 400, 'JOGAR DE NOVO', {
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
