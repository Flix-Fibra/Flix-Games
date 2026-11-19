import Phaser from 'phaser';
import type { Expression } from '@flix/avatar';
import type { HubBridge } from '@flix/game-sdk';
import { unlockAudio } from '../audio';
import type { Cause } from '../logic';
import { saveBest } from '../storage';
import { COLORS, FONT, FONT_TEXT, GAME_H, GAME_W } from '../theme';
import { drawBackground } from '../ui';
import { telaFimDeJogo } from '@flix/game-kit/src/phaserHud';
import { portraitKey } from './BootScene';

interface GameOverData {
  score: number;
  items: number;
  cause: Cause;
  previousBest: number;
  expression: Expression;
}

const CAUSE_TEXT: Record<Cause, string> = {
  obstacle: 'O CABO BATEU NA CERCA',
  self: 'O CABO SE ENROLOU',
  timeout: 'TEMPO ESGOTADO!',
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

    const restart = () => {
      unlockAudio();
      this.scene.start('Play');
    };

    // Tela padrão dos jogos Flix (fliperama). O botão de recomeçar é sempre o do jogo (o hub não mostra outro);
    // a mensagem `restart` do hub continua valendo.
    telaFimDeJogo(this, {
      largura: GAME_W,
      altura: GAME_H,
      retrato: this.add.image(0, 0, portraitKey(data.expression)).setScale(4),
      pontos: data.score,
      linhas: [
        { texto: CAUSE_TEXT[data.cause] },
        { texto: `${data.items} ${data.items === 1 ? 'ITEM CONECTADO' : 'ITENS CONECTADOS'}` },
        newRecord ? { texto: 'NOVO RECORDE!', cor: 0xf5c04a } : { texto: `SEU MELHOR: ${best}`, cor: 0xb8c6e0 },
      ],
      px: { titulo: 5, pontos: 10, texto: 3, botao: 4 },
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
        .text(GAME_W / 2, GAME_H - 28, 'modo de desenvolvimento (sem hub)', { fontFamily: FONT_TEXT, fontSize: '20px', color: '#6f8ab0' })
        .setOrigin(0.5)
        .setResolution(2);
    }
  }
}
