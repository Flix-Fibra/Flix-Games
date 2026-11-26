import Phaser from 'phaser';
import art from '../art.json';

const PECAS = ['porta-fechada', 'porta-aberta', 'save-off', 'save-on', 'rachada', 'item-lampada', 'item-cura', 'item-nucleo',
  'item-pulso', 'parede', 'borda', 'plataforma', 'escada', 'fio', 'logo', 'parede2', 'borda2', 'plataforma2', 'escada2',
  'fio2', 'arco', 'alavanca-off', 'alavanca-on', 'alcapao', 'gancho', 'gancho-aceso', 'item-gancho',
  'parede3', 'borda3', 'plataforma3', 'escada3', 'fio3', 'relogio-a', 'relogio-a-aviso', 'relogio-a-off', 'relogio-b',
  'relogio-b-aviso', 'relogio-b-off', 'nucleo', 'bola', 'item-repique', 'item-fragmento'];

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    const barra = this.add.rectangle(240, 270, 4, 8, 0x38e8ff).setOrigin(0, 0.5);
    this.load.on('progress', (p: number) => barra.setSize(480 * p, 8).setX(240));
    for (const [nome, q] of Object.entries(art)) {
      this.load.spritesheet(nome, `img/${nome}.png`, { frameWidth: q.w, frameHeight: q.h });
    }
    for (const nome of PECAS) this.load.image(nome, `img/${nome}.png`);
    this.load.image('fundo', 'img/fundo.jpg');
    this.load.image('fundo2', 'img/fundo2.jpg');
    this.load.image('fundo3', 'img/fundo3.jpg');
  }

  create(): void {
    // parede: 4 x 4 pedaços de um tile (32 px de textura); a borda de cima em 4 pedaços (um conjunto por fase)
    for (const f of ['', '2', '3']) {
      const parede = this.textures.get(`parede${f}`);
      for (let i = 0; i < 16; i++) parede.add(i, 0, (i % 4) * 32, Math.floor(i / 4) * 32, 32, 32);
      const borda = this.textures.get(`borda${f}`);
      for (let i = 0; i < 4; i++) borda.add(i, 0, i * 32, 0, 32, 14);
      const escada = this.textures.get(`escada${f}`);
      for (let i = 0; i < 2; i++) escada.add(i, 0, 0, i * 32, 32, 32);
    }

    const anima = (key: string, folha: keyof typeof art, taxa: number, repetir = -1, quadros?: number[]) => {
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers(folha, quadros ? { frames: quadros } : {}),
        frameRate: taxa,
        repeat: repetir,
      });
    };
    anima('parada', 'iara-parada', 3);
    anima('corrida', 'iara-corrida', 14);
    anima('escada', 'iara-escada', 8);
    anima('morte', 'iara-dano', 8, 0, [1, 2, 3, 4, 5, 6]);
    anima('faisca', 'faisca-anda', 9);
    anima('faisca-morre', 'faisca-morre', 14, 0);
    anima('drone', 'drone-voa', 8);
    anima('drone-morre', 'drone-morre', 10, 0);
    anima('rato', 'rato-corre', 10);
    anima('rato-morre', 'rato-morre', 10, 0);
    anima('bobina-morre', 'bobina-morre', 10, 0);
    anima('pacote', 'pacote-anda', 8);
    anima('pacote-morre', 'pacote-morre', 12, 0);
    anima('cooler', 'cooler', 16);
    for (const fx of ['fx-impacto', 'fx-estouro', 'fx-poeira', 'fx-pulso', 'fx-brilho'] as const) anima(fx, fx, 16, 0);

    this.scene.start('Title');
  }
}
