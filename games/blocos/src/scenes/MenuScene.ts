import Phaser from 'phaser';
import { BALL_R, brickRect, LEVELS, parseLevel, PADDLE_Y } from '../logic';
import { RACKET_DX, Surfer } from '../surfer';
import { BALL_TAIL_PX, DEPTH, FONT, FONT_TEXT, GAME_W } from '../theme';

const ACCEPT_AFTER_MS = 350; // ignora o toque logo que a tela abre (evita começar sem querer depois de perder)

/** Tela de início: os blocos da primeira fase escurecidos, com o nome do jogo. */
export class MenuScene extends Phaser.Scene {
  private openedAt = 0;
  private starting = false;

  constructor() {
    super('Menu');
  }

  create(): void {
    this.starting = false;
    this.openedAt = this.time.now;

    this.add.image(0, 0, 'bg').setOrigin(0).setDepth(DEPTH.bg);
    for (const b of parseLevel(LEVELS[1]!)) {
      const r = brickRect(b.col, b.row);
      const key = b.kind === 'n' ? `brick_n${b.color}` : `brick_${b.kind}`;
      this.add.image(r.x, r.y - 50, key).setOrigin(0).setDisplaySize(r.w, r.h).setDepth(DEPTH.bricks).setAlpha(0.3);
    }
    // a jogadora surfando e rebatendo a bola de raios
    const surfer = new Surfer(this, GAME_W / 2);
    this.events.on(Phaser.Scenes.Events.UPDATE, (_t: number, d: number) => surfer.update(GAME_W / 2, d / 1000));
    const ballX = GAME_W / 2 + RACKET_DX;
    const ball = this.add
      .image(ballX, PADDLE_Y - 200, 'bola')
      .setOrigin(1 - BALL_TAIL_PX / this.textures.get('bola').getSourceImage().width, 0.5)
      .setDepth(DEPTH.balls)
      .setAngle(90);
    this.tweens.add({
      targets: ball,
      y: PADDLE_Y - BALL_R,
      duration: 560,
      ease: 'Quad.easeIn',
      yoyo: true,
      repeat: -1,
      onYoyo: () => {
        ball.setAngle(-90);
        surfer.swing();
      },
      onRepeat: () => ball.setAngle(90),
    });

    const title = this.add
      .text(GAME_W / 2, 270, 'SPACE\nPING', {
        fontFamily: FONT, fontSize: '104px', color: '#FFFFFF', stroke: '#2a1a6e', strokeThickness: 16, align: 'center', lineSpacing: -10,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);
    title.setTint(0x9fe6ff, 0x9fe6ff, 0xffd23f, 0xffd23f);
    this.tweens.add({ targets: title, y: title.y - 10, duration: 1500, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });

    const prompt = this.add
      .text(GAME_W / 2, 560, 'TOQUE PARA JOGAR', { fontFamily: FONT, fontSize: '44px', color: '#FFFFFF', stroke: '#0a0d1f', strokeThickness: 9 })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);
    this.tweens.add({ targets: prompt, alpha: 0.45, duration: 800, yoyo: true, repeat: -1 });
    this.add
      .text(GAME_W / 2, 650, 'Mova o mouse (ou arraste o dedo) para levar\na jogadora. A bola sai sozinha.\nJunte 20 bolas-raio e ganhe uma vida extra!' + (this.sys.game.device.input.touch ? '' : '\nBotão direito ou P solta o mouse.'), {
        fontFamily: FONT_TEXT, fontSize: '28px', color: '#E2E8FF', stroke: '#0a0d1f', strokeThickness: 6, align: 'center', lineSpacing: 8,
      })
      .setOrigin(0.5, 0)
      .setDepth(DEPTH.hud);

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
