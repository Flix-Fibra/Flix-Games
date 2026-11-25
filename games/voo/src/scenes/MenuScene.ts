import Phaser from 'phaser';
import { PLANE_X } from '../logic';
import { DEPTH, FONT, FONT_TEXT, GAME_H, GAME_W } from '../theme';
import { Backdrop } from './Backdrop';

const ACCEPT_AFTER_MS = 350; // ignora o toque logo que a tela abre (evita começar sem querer depois de perder)

/** Tela de início: cidade ao fundo (andando devagar), avião pairando e o nome do jogo. */
export class MenuScene extends Phaser.Scene {
  private openedAt = 0;
  private starting = false;
  private backdrop!: Backdrop;

  constructor() {
    super('Menu');
  }

  create(): void {
    this.starting = false;
    this.openedAt = this.time.now;
    this.backdrop = new Backdrop(this);

    const plane = this.add.image(PLANE_X, GAME_H / 2 - 40, 'aviao').setDepth(DEPTH.plane);
    this.tweens.add({ targets: plane, y: plane.y - 26, angle: -4, duration: 900, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });

    this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x0c0820, 0.35).setDepth(DEPTH.hud);
    const title = this.add
      .text(GAME_W / 2, 330, 'VOO\nRASANTE', { fontFamily: FONT, fontSize: '110px', color: '#FFE9A8', stroke: '#2a0d24', strokeThickness: 16, align: 'center', lineSpacing: -6 })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud + 1);
    this.tweens.add({ targets: title, y: title.y - 10, duration: 1500, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });

    const prompt = this.add
      .text(GAME_W / 2, 780, 'TOQUE PARA JOGAR', { fontFamily: FONT, fontSize: '44px', color: '#FFFFFF', stroke: '#1a1030', strokeThickness: 9 })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud + 1);
    this.tweens.add({ targets: prompt, alpha: 0.45, duration: 800, yoyo: true, repeat: -1 });
    this.add
      .text(GAME_W / 2, 860, 'Toque (ou espaço) para subir.\nPasse entre os prédios e os guindastes.', {
        fontFamily: FONT_TEXT, fontSize: '28px', color: '#F1EAFF', stroke: '#1a1030', strokeThickness: 6, align: 'center', lineSpacing: 8,
      })
      .setOrigin(0.5, 0)
      .setDepth(DEPTH.hud + 1);

    const kb = this.input.keyboard!;
    kb.addCapture([Phaser.Input.Keyboard.KeyCodes.SPACE]);
    const onKey = () => this.start();
    kb.on('keydown-SPACE', onKey);
    kb.on('keydown-UP', onKey);
    kb.on('keydown-ENTER', onKey);
    this.input.on('pointerdown', onKey);
    const onRestart = () => this.start(true);
    this.game.events.on('hub-restart', onRestart);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('hub-restart', onRestart);
      kb.off('keydown-SPACE', onKey);
      kb.off('keydown-UP', onKey);
      kb.off('keydown-ENTER', onKey);
    });
  }

  update(_t: number, dtMs: number): void {
    this.backdrop.advance((420 * dtMs) / 1000);
  }

  private start(force = false): void {
    if (this.starting || (!force && this.time.now - this.openedAt < ACCEPT_AFTER_MS)) return;
    this.starting = true;
    this.scene.start('Play');
  }
}
