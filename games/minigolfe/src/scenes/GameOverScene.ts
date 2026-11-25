import Phaser from 'phaser';
import type { Expression } from '@flix/avatar';
import type { HubBridge } from '@flix/game-sdk';
import { telaFimDeJogo } from '@flix/game-kit/src/phaserHud';
import { unlockAudio } from '../audio';
import { saveBest } from '../storage';
import { COLORS, FONT, GAME_H, GAME_W } from '../theme';
import { portraitKey } from './BootScene';

interface GameOverData {
  total: number;
  par: number;
  results: number[];
  previousBest: number;
  expression: Expression;
}

/**
 * Tela de fim do percurso, sem anúncio. O `gameover` já foi enviado pela PlayScene.
 * O botão de recomeçar é sempre o do jogo, dentro e fora do hub (o hub também pode mandar `restart`).
 */
export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create(data: GameOverData): void {
    const bridge = this.registry.get('bridge') as HubBridge;
    this.cameras.main.setBackgroundColor(COLORS.background);
    const best = saveBest(data.total);
    // menos tacadas é melhor: recorde é terminar com menos que o melhor anterior
    const newRecord = data.previousBest === 0 || data.total < data.previousBest;
    const diff = data.total - data.par;
    const vsPar = diff === 0 ? 'NO PAR' : diff < 0 ? `${-diff} ABAIXO DO PAR` : `${diff} ACIMA DO PAR`;

    const restart = () => {
      unlockAudio();
      this.scene.start('Play');
    };

    telaFimDeJogo(this, {
      largura: GAME_W,
      altura: GAME_H,
      retrato: this.add.image(0, 0, portraitKey(data.expression)).setScale(2),
      pontos: data.total,
      rotulo: 'TACADAS',
      titulo: 'PERCURSO COMPLETO',
      linhas: [
        { texto: `PAR ${data.par} · ${vsPar}` },
        { texto: `BURACOS: ${data.results.join(' ')}`, cor: 0xb8c6e0 },
        newRecord ? { texto: 'NOVO RECORDE!', cor: 0xf5c04a } : { texto: `SEU MELHOR: ${best}`, cor: 0xb8c6e0 },
      ],
      px: { titulo: 2, pontos: 5, texto: 1, botao: 2 },
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
