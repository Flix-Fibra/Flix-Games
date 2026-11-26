import Phaser from 'phaser';
import type { HubBridge } from '@flix/game-sdk';
import { unlockAudio } from '../audio';
import type { Cause } from '../logic';
import { saveBest } from '../storage';
import { COLORS, GAME_H, GAME_W } from '../theme';
import { botao, fundo, painel, rotulo, texto } from '../ui';

interface GameOverData {
  score: number;
  lines: number;
  level: number;
  cause: Cause;
  previousBest: number;
}

/**
 * Tela de fim de partida, sem anúncio. O `gameover` já foi enviado pela PlayScene.
 * O botão de recomeçar é sempre o do jogo, dentro e fora do hub (o hub também pode mandar `restart`).
 */
export class GameOverScene extends Phaser.Scene {
  private started = false;

  constructor() {
    super('GameOver');
  }

  create(data: GameOverData): void {
    this.started = false;
    const bridge = this.registry.get('bridge') as HubBridge;
    fundo(this);
    this.cameras.main.fadeIn(220, 8, 11, 22);
    const best = saveBest(data.score);
    const newRecord = data.score > 0 && data.score > data.previousBest;

    const restart = () => {
      if (this.started) return;
      this.started = true;
      unlockAudio();
      this.cameras.main.fadeOut(160, 8, 11, 22);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Play'));
    };

    const mid = GAME_W / 2;
    texto(this, mid, 74, 'FIM DE JOGO', { tam: 13, peso: '800', espaco: 3, cor: COLORS.textMuted }).setOrigin(0.5);
    texto(this, mid, 96, 'A pilha chegou ao topo', { tam: 10, peso: '600', cor: COLORS.label }).setOrigin(0.5);

    // cartão principal com a pontuação
    const g = this.add.graphics();
    painel(g, 24, 122, GAME_W - 48, 176, 16);
    rotulo(this, mid, 140, 'PONTOS').setOrigin(0.5, 0);
    const pontos = texto(this, mid, 182, '0', { tam: 44, peso: '800' }).setOrigin(0.5);
    const conta = { v: 0 };
    this.tweens.add({
      targets: conta, v: data.score, duration: Math.min(900, 300 + data.score / 20), ease: 'Quad.easeOut',
      onUpdate: () => pontos.setText(Math.round(conta.v).toLocaleString('pt-BR')),
    });

    if (newRecord) {
      const selo = this.add.container(mid, 220);
      const sg = this.add.graphics();
      sg.fillStyle(0xffd54a, 0.16).fillRoundedRect(-58, -11, 116, 22, 11);
      sg.lineStyle(1, 0xffd54a, 0.6).strokeRoundedRect(-58, -11, 116, 22, 11);
      selo.add([sg, texto(this, 0, 0, 'NOVO RECORDE!', { tam: 10, peso: '800', espaco: 1.5, cor: COLORS.gold }).setOrigin(0.5)]);
      selo.setScale(0);
      this.tweens.add({ targets: selo, scale: 1, delay: 500, duration: 300, ease: 'Back.easeOut' });
    } else {
      texto(this, mid, 220, `Recorde: ${best.toLocaleString('pt-BR')}`, { tam: 10, peso: '600', cor: COLORS.textMuted }).setOrigin(0.5);
    }

    // linhas e nível
    g.lineStyle(1, 0xffffff, 0.07).lineBetween(40, 242, GAME_W - 40, 242).lineBetween(mid, 252, mid, 288);
    rotulo(this, mid - 52, 254, 'CONEXÕES').setOrigin(0.5, 0);
    texto(this, mid - 52, 276, String(data.lines), { tam: 18, peso: '800' }).setOrigin(0.5);
    rotulo(this, mid + 52, 254, 'NÍVEL').setOrigin(0.5, 0);
    texto(this, mid + 52, 276, String(data.level), { tam: 18, peso: '800' }).setOrigin(0.5);

    botao(this, mid, 346, 'JOGAR DE NOVO', restart, 180, 42);
    const toque = this.sys.game.device.input.touch;
    texto(this, mid, 384, toque ? 'ou toque em qualquer lugar' : 'ou aperte Enter / Espaço', { tam: 9, peso: '600', cor: COLORS.label }).setOrigin(0.5);

    // evita recomeçar sem querer com o toque/tecla que acabou de terminar a partida
    this.time.delayedCall(500, () => {
      this.input.on('pointerup', restart);
      this.input.keyboard?.on('keydown-ENTER', restart);
      this.input.keyboard?.on('keydown-SPACE', restart);
    });

    if (bridge.embedded) {
      const off = bridge.onHubMessage((msg) => {
        if (msg.type === 'restart') restart();
      });
      this.events.once('shutdown', off);
    } else {
      texto(this, mid, GAME_H - 18, 'modo de desenvolvimento (sem hub)', { tam: 8, peso: 'normal', cor: COLORS.label }).setOrigin(0.5);
    }
    this.events.once('shutdown', () => {
      this.input.removeAllListeners();
      this.input.keyboard?.removeAllListeners();
    });
  }
}
