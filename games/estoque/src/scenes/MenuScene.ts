import Phaser from 'phaser';
import { DEVICE_LEFT, DEVICE_RIGHT, GLOW_KEY, PLUG_RATIO, cellKey, plugKey } from '../art';
import { unlockAudio } from '../audio';
import { loadBest } from '../storage';
import { COLORS, GAME_H, GAME_W } from '../theme';
import { botao, fundo, painel, pecaDecorativa, rotulo, texto } from '../ui';

/** Formas das peças decorativas que caem devagar ao fundo do menu. */
const FORMAS: [number, number][][] = [
  [[0, 0], [1, 0], [2, 0], [3, 0]],
  [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [1, 1]],
  [[1, 0], [2, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [1, 1], [2, 1]],
  [[0, 0], [0, 1], [1, 1], [2, 1]],
  [[2, 0], [0, 1], [1, 1], [2, 1]],
];

export class MenuScene extends Phaser.Scene {
  private started = false;

  constructor() {
    super('Menu');
  }

  create(): void {
    this.started = false;
    fundo(this);

    // peças caindo devagar, atrás de tudo
    for (let i = 0; i < 9; i++) this.pecaCaindo(i, true);

    this.caboComSinal(78);

    texto(this, GAME_W / 2, 132, 'ESTOQUE', { tam: 44, peso: '800', espaco: 2 }).setOrigin(0.5);
    texto(this, GAME_W / 2, 174, 'FLIX', { tam: 44, peso: '800', espaco: 8, cor: COLORS.flixRedText }).setOrigin(0.5);
    texto(this, GAME_W / 2, 208, 'Ligue os cabos de ponta a ponta!', { tam: 10, peso: '600', cor: COLORS.textMuted }).setOrigin(0.5);

    const best = loadBest();
    const g = this.add.graphics();
    painel(g, GAME_W / 2 - 70, 236, 140, 50, 12);
    rotulo(this, GAME_W / 2, 247, 'SEU RECORDE').setOrigin(0.5, 0);
    texto(this, GAME_W / 2, 270, best > 0 ? best.toLocaleString('pt-BR') : '—', { tam: 18, peso: '800' }).setOrigin(0.5);

    const b = botao(this, GAME_W / 2, 330, 'JOGAR', () => this.begin());
    this.tweens.add({ targets: b, scale: 1.04, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const toque = this.sys.game.device.input.touch;
    const dica = toque
      ? 'Arraste para os lados para mover\nToque para girar · arraste para baixo para descer'
      : '← →  mover     ↑  girar     ↓  descer\nespaço  derrubar     Z  girar ao contrário';
    texto(this, GAME_W / 2, GAME_H - 52, dica, { tam: 9, peso: '600', cor: COLORS.textMuted }).setOrigin(0.5).setLineSpacing(5);

    this.input.once('pointerup', () => this.begin());
    this.input.keyboard?.once('keydown', () => this.begin());
  }

  /** Um cabo de 7 pedaços (as 7 cores) ligando o roteador ao computador, com o sinal passando. */
  private caboComSinal(y: number): void {
    const size = 22;
    const plugW = 24;
    const dev = 28;
    const cableW = 7 * size;
    const x0 = GAME_W / 2 - cableW / 2;
    for (let i = 0; i < 7; i++) this.add.image(x0 + i * size + size / 2, y, cellKey(i + 1)).setDisplaySize(size, size);
    this.add.image(x0 - plugW / 2, y, plugKey(1)).setDisplaySize(plugW, plugW / PLUG_RATIO).setFlipX(true);
    this.add.image(x0 + cableW + plugW / 2, y, plugKey(7)).setDisplaySize(plugW, plugW / PLUG_RATIO);
    const left = this.add.image(x0 - plugW - dev / 2 + 3, y, DEVICE_LEFT).setDisplaySize(dev, dev);
    const right = this.add.image(x0 + cableW + plugW + dev / 2 - 3, y, DEVICE_RIGHT).setDisplaySize(dev, dev);
    const sinal = this.add.image(left.x, y, GLOW_KEY).setDisplaySize(22, 22).setBlendMode(Phaser.BlendModes.ADD).setTint(0xbfefff);
    this.tweens.add({ targets: sinal, x: right.x, duration: 1200, repeat: -1, repeatDelay: 500, ease: 'Sine.easeInOut' });
  }

  /** Uma peça decorativa que cai do topo e recomeça quando sai da tela. */
  private pecaCaindo(i: number, inicio: boolean): void {
    const forma = FORMAS[i % FORMAS.length]!;
    const tam = 10 + Math.random() * 8;
    const x = 10 + Math.random() * (GAME_W - 40);
    const y = inicio ? Math.random() * GAME_H : -50;
    const p = pecaDecorativa(this, x, y, forma, (i % 7) + 1, tam)
      .setAlpha(0.1 + Math.random() * 0.12)
      .setAngle(Math.floor(Math.random() * 4) * 90)
      .setDepth(-5);
    const dur = 9000 + Math.random() * 9000;
    this.tweens.add({
      targets: p,
      y: GAME_H + 60,
      duration: dur * ((GAME_H + 60 - y) / (GAME_H + 110)),
      onComplete: () => {
        p.destroy();
        this.pecaCaindo(i, false);
      },
    });
  }

  private begin(): void {
    if (this.started) return;
    this.started = true;
    unlockAudio();
    this.cameras.main.fadeOut(160, 8, 11, 22);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Play'));
  }
}
