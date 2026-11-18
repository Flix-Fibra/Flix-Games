import Phaser from 'phaser';
import { firstSlot, NEST_SINK, shelfSlot } from '../logic';
import { addSupport, TrunkColumns } from '../tree';
import { BG_TINT, DEPTH, FONT, FONT_TEXT, GAME_H, GAME_W, MONKEY_SCREEN_Y } from '../theme';

const ACCEPT_AFTER_MS = 350; // ignora o toque logo que a tela abre (evita começar sem querer depois de perder)

/** Tela de início: a mesma árvore em que a partida começa, escurecida, com o nome do jogo e o macaco mirando. */
export class MenuScene extends Phaser.Scene {
  private openedAt = 0;
  private starting = false;

  constructor() {
    super('Menu');
  }

  create(): void {
    this.starting = false;
    this.openedAt = this.time.now;

    // a mesma árvore do começo da partida (câmera na mesma posição), escurecida
    this.add.image(0, 0, 'fundo').setOrigin(0).setScrollFactor(0).setDepth(DEPTH.bg).setTint(BG_TINT);
    const start = firstSlot();
    this.cameras.main.setScroll(0, start.y - MONKEY_SCREEN_Y);
    new TrunkColumns(this, start.y + GAME_H).update(start.y - MONKEY_SCREEN_Y, start.y - MONKEY_SCREEN_Y + GAME_H);
    const up = shelfSlot(1, 'left', start.y - 340);
    addSupport(this, start, false);
    addSupport(this, up, false);
    this.add.image(up.x, up.y + NEST_SINK, 'ninho').setOrigin(0.5, 1).setDepth(DEPTH.nest);

    const monkey = this.add.image(start.x, start.y, 'macaco_0').setOrigin(0.5, 1).setDepth(DEPTH.monkey);
    let f = 0;
    this.time.addEvent({ delay: 360, loop: true, callback: () => monkey.setTexture(`macaco_${(f = (f + 1) % 4)}`) });

    this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x061008, 0.45).setScrollFactor(0).setDepth(DEPTH.hud);

    const title = this.add
      .text(GAME_W / 2, 330, 'NEST SHOT', { fontFamily: FONT, fontSize: '96px', color: '#F6E7B8', stroke: '#2a1a08', strokeThickness: 14 })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud + 1);
    this.tweens.add({ targets: title, y: title.y - 10, duration: 1500, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });

    const prompt = this.add
      .text(GAME_W / 2, 560, 'TOQUE PARA JOGAR', { fontFamily: FONT, fontSize: '44px', color: '#FFFFFF', stroke: '#13240f', strokeThickness: 9 })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud + 1);
    this.tweens.add({ targets: prompt, alpha: 0.45, duration: 800, yoyo: true, repeat: -1 });
    this.add
      .text(GAME_W / 2, 650, 'Arraste para trás e solte para atirar.\nAcerte o ninho de cima para subir na árvore.\nUse as laterais da tela para tabelar.', {
        fontFamily: FONT_TEXT, fontSize: '28px', color: '#E6F2D8', stroke: '#13240f', strokeThickness: 6, align: 'center', lineSpacing: 8,
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud + 1);

    const kb = this.input.keyboard!;
    kb.addCapture([Phaser.Input.Keyboard.KeyCodes.SPACE]);
    kb.on('keydown-SPACE', () => this.start());
    kb.on('keydown-ENTER', () => this.start());
    this.input.on('pointerup', () => this.start());
    const onRestart = () => this.start(true);
    this.game.events.on('hub-restart', onRestart);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('hub-restart', onRestart);
      kb.off('keydown-SPACE');
      kb.off('keydown-ENTER');
    });
  }

  private start(force = false): void {
    if (this.starting || (!force && this.time.now - this.openedAt < ACCEPT_AFTER_MS)) return;
    this.starting = true;
    this.scene.start('Play');
  }
}
