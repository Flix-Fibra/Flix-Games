import Phaser from 'phaser';
import { renderHudText } from '@flix/game-kit/src/hudFont';
import { PAD, PLAYER, VEHICLE_LEN, logKey, propKey, vehicleKey } from '../art';
import { unlockAudio } from '../audio';
import { loadBest } from '../storage';
import { CELL, COLORS, FONT, GAME_H, GAME_W } from '../theme';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  /**
   * Texto na fonte pixel da plataforma como imagem nítida (cada pixel da letra vira `px` x `px`). `contorno` da cor do
   * fundo deixa a letra limpa (letra escura sobre o botão verde, por exemplo).
   */
  private pixel(chave: string, texto: string, cor: string, contorno: string, x: number, y: number, px: number): Phaser.GameObjects.Image {
    if (this.textures.exists(chave)) this.textures.remove(chave);
    // negrito: a mesma letra pintada duas vezes, a 2ª um pixel à direita (traço grosso, como no modelo)
    const base = renderHudText(texto, cor, contorno);
    const c = document.createElement('canvas');
    c.width = base.width + 1;
    c.height = base.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(base, 0, 0);
    ctx.drawImage(base, 1, 0);
    this.textures.addCanvas(chave, c);
    this.textures.get(chave).setFilter(Phaser.Textures.FilterMode.NEAREST);
    return this.add.image(x, y, chave).setScale(px);
  }

  create(): void {
    // Visual do modelo enviado pelo solicitante (25/11/2026), adaptado à tela em pé: título pixel com a barra laranja,
    // a cena da obra no meio e o botão verde COMEÇAR. Peças da cena: as mesmas do jogo (art.ts), nada desenhado de novo.
    this.cameras.main.setBackgroundColor(COLORS.background);
    const fundo = '#10151F';

    // título: barra laranja à esquerda, SINAL (creme) e VERDE (verde da logo)
    // a célula da fonte tem 2 linhas de acento em cima: a letra começa 2 px (x escala) abaixo do y
    this.add.rectangle(18, 26, 6, 86, 0xf28c28).setOrigin(0, 0);
    this.pixel('titulo_1', 'SINAL', '#F4EAD5', fundo, 32, 16, 5).setOrigin(0, 0);
    this.pixel('titulo_2', 'VERDE', '#7ED957', fundo, 32, 62, 5).setOrigin(0, 0);
    const best = loadBest();
    this.add
      .text(20, 128, best > 0 ? `Seu melhor: ${best} faixas` : 'Atravesse a obra sem ser atingido!', {
        fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: COLORS.text,
      })
      .setOrigin(0, 0);

    // mini cenário: grama, estrada, rio, estrada e grama, com o técnico atravessando
    const top = 158;
    const bands: Array<'grass' | 'road' | 'river'> = ['grass', 'road', 'river', 'road', 'grass'];
    bands.forEach((kind, i) => {
      const y = top + i * CELL;
      const color = kind === 'grass' ? (i % 2 ? COLORS.grassB : COLORS.grassA) : kind === 'road' ? COLORS.asphalt : COLORS.water;
      this.add.rectangle(0, y, GAME_W, CELL, color).setOrigin(0, 0);
    });
    const mid = (i: number): number => top + i * CELL + CELL / 2;
    this.add.image(40, mid(0), propKey(0)).setDisplaySize(CELL, CELL);
    this.add.image(190, mid(0), propKey(2)).setDisplaySize(CELL, CELL);
    this.add.image(230, mid(4), propKey(0)).setDisplaySize(CELL, CELL);
    this.add.image(60, mid(4), propKey(1)).setDisplaySize(CELL, CELL);
    for (const x of [40, 110, 190]) this.add.image(x, mid(2), PAD).setDisplaySize(CELL, CELL);
    const slide = (key: string, w: number, row: number, from: number, to: number, ms: number, flip = false): void => {
      const img = this.add.image(from, mid(row), key).setDisplaySize(w, CELL).setFlipX(flip);
      this.tweens.add({ targets: img, x: to, duration: ms, repeat: -1 });
    };
    slide(vehicleKey(0), VEHICLE_LEN[0] * CELL, 1, -40, GAME_W + 40, 2600);
    slide(vehicleKey(2), VEHICLE_LEN[2] * CELL, 3, GAME_W + 60, -60, 3400, true);
    const log = this.add.image(0, mid(2), logKey(3, 1)).setDisplaySize(3 * CELL, CELL);
    this.tweens.add({ targets: log, x: { from: -50, to: GAME_W + 50 }, duration: 5200, repeat: -1 });
    const hero = this.add.image(GAME_W / 2, mid(4), PLAYER).setDisplaySize(CELL, CELL);
    this.tweens.add({ targets: hero, y: mid(0), duration: 1400, yoyo: true, repeat: -1, hold: 300, ease: 'Sine.easeInOut' });

    // botão COMEÇAR: verde com canto chanfrado e sombra embaixo; letra escura em pixel
    const bx = GAME_W / 2, by = 352, bw = 216, bh = 50, ch = 6;
    const g = this.add.graphics();
    const chanfrado = (dy: number, cor: number): void => {
      g.fillStyle(cor, 1);
      g.fillPoints([
        { x: bx - bw / 2 + ch, y: by - bh / 2 + dy }, { x: bx + bw / 2 - ch, y: by - bh / 2 + dy }, { x: bx + bw / 2, y: by - bh / 2 + ch + dy },
        { x: bx + bw / 2, y: by + bh / 2 - ch + dy }, { x: bx + bw / 2 - ch, y: by + bh / 2 + dy }, { x: bx - bw / 2 + ch, y: by + bh / 2 + dy },
        { x: bx - bw / 2, y: by + bh / 2 - ch + dy }, { x: bx - bw / 2, y: by - bh / 2 + ch + dy },
      ], true);
    };
    chanfrado(4, 0x4e8f2e);
    chanfrado(0, 0x7ac74f);
    const rotulo = this.pixel('btn_comecar', 'COMEÇAR', '#16210F', '#7AC74F', bx, by, 3);
    this.tweens.add({ targets: rotulo, alpha: 0.75, duration: 700, yoyo: true, repeat: -1 }); // convite discreto a tocar

    this.add
      .text(GAME_W / 2, GAME_H - 44, '↑ ou W para avançar · ← → para mover · ↓ para voltar\nNo celular, toque para avançar e deslize para mover.', {
        fontFamily: FONT, fontSize: '10px', color: COLORS.text, align: 'center', lineSpacing: 4,
      })
      .setOrigin(0.5);

    this.input.once('pointerdown', () => this.begin());
    this.input.keyboard?.once('keydown', () => this.begin());
  }

  private begin(): void {
    unlockAudio();
    this.scene.start('Play');
  }
}
