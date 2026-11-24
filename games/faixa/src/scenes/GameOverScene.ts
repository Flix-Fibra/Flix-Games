import Phaser from 'phaser';
import type { Expression } from '@flix/avatar';
import type { HubBridge } from '@flix/game-sdk';
import { telaFimDeJogo } from '@flix/game-kit/src/phaserHud';
import { unlockAudio } from '../audio';
import type { Cause } from '../logic';
import { saveBest } from '../storage';
import { COLORS, FONT, GAME_H, GAME_W } from '../theme';
import { portraitKey } from './BootScene';

interface GameOverData {
  score: number;
  lanes: number;
  bonus: number;
  cause: Cause;
  previousBest: number;
  expression: Expression;
}

export const CAUSE_TEXT: Record<Cause, string> = {
  vehicle: 'ATROPELADO!',
  train: 'O TREM PASSOU!',
  water: 'CAIU NO RIO!',
  carried: 'ARRASTADO PELO RIO!',
  time: 'DEMOROU DEMAIS!',
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
    const best = saveBest(data.score);
    const newRecord = data.score > 0 && data.score > data.previousBest;

    const restart = () => {
      unlockAudio();
      this.scene.start('Play');
    };

    telaFimDeJogo(this, {
      largura: GAME_W,
      altura: GAME_H,
      retrato: this.add.image(0, 0, portraitKey(data.expression)).setScale(2),
      pontos: data.score,
      linhas: [
        { texto: CAUSE_TEXT[data.cause] },
        { texto: data.lanes === 1 ? '1 FAIXA ATRAVESSADA' : `${data.lanes} FAIXAS ATRAVESSADAS` },
        ...(data.bonus > 0 ? [{ texto: `BÔNUS DE COMBO: +${data.bonus}`, cor: 0xf5c04a }] : []),
        newRecord ? { texto: 'NOVO RECORDE!', cor: 0xf5c04a } : { texto: `SEU MELHOR: ${best}`, cor: 0xb8c6e0 },
      ],
      px: { titulo: 3, pontos: 5, texto: 1, botao: 2 },
      depth: 10,
      onReiniciar: restart,
    });
    if (bridge.embedded) {
      const off = bridge.onHubMessage((msg) => {
        if (msg.type === 'restart') restart();
      });
      this.events.once('shutdown', off);
    } else {
      this.add
        .text(GAME_W / 2, GAME_H - 18, 'modo de desenvolvimento (sem hub)', { fontFamily: FONT, fontSize: '9px', color: COLORS.textMuted })
        .setOrigin(0.5);
    }
  }
}
