import Phaser from 'phaser';
import { COLORS, FONT, FONT_TEXT, GAME_H, GAME_W, SCENES, START_OFFSET } from '../theme';

const ACCEPT_AFTER_MS = 350; // ignora o toque/tecla logo que a tela abre (evita começar sem querer depois de perder)

/**
 * Tela de início: o logo flutua de leve, a personagem aparece à direita e o fundo é um cenário sorteado, escurecido como uma prévia
 * do jogo. Aparece ao abrir o jogo e toda vez que o jogador reinicia depois de perder, e cada vez com um cenário diferente.
 */
export class MenuScene extends Phaser.Scene {
  private sceneIndex = 0;
  private openedAt = 0;
  private starting = false;

  constructor() {
    super('Menu');
  }

  create(): void {
    this.starting = false;
    this.openedAt = this.time.now;
    // cenário sorteado (nunca o mesmo da vez anterior, quando há mais de um)
    const last = this.registry.get('lastScene') as number | undefined;
    do this.sceneIndex = Math.floor(Math.random() * SCENES.length);
    while (SCENES.length > 1 && this.sceneIndex === last);
    this.registry.set('lastScene', this.sceneIndex);

    // fundo na mesma posição em que a partida começa, com um filtro escuro (prévia)
    this.add.image(-START_OFFSET, 0, SCENES[this.sceneIndex]!.key).setOrigin(0, 0);
    this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000814, 0.5);

    // personagem à direita, abaixo do logo, no meio da altura da tela
    this.add.image(GAME_W - 168, GAME_H / 2 + 38, 'menu_personagem').setScale(0.8);

    // logo flutuando poucos pixels para cima e para baixo
    const logo = this.add.image(GAME_W / 2 - 40, 142, 'menu_logo').setScale(0.9);
    this.tweens.add({ targets: logo, y: logo.y - 8, duration: 1500, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });

    const prompt = this.add
      .text(GAME_W / 2 - 150, 392, 'TOQUE OU APERTE ESPAÇO\nPARA JOGAR', {
        fontFamily: FONT, fontSize: '30px', color: '#FFFFFF', stroke: '#06214d', strokeThickness: 7, align: 'center',
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.45, duration: 800, yoyo: true, repeat: -1 });
    this.add
      .text(GAME_W / 2 - 150, 466, '↑ pular   ↓ abaixar   espaço atira (com a arma)', {
        fontFamily: FONT_TEXT, fontSize: '18px', color: COLORS.textMuted, stroke: '#06214d', strokeThickness: 4,
      })
      .setOrigin(0.5);

    const kb = this.input.keyboard!;
    kb.addCapture([Phaser.Input.Keyboard.KeyCodes.SPACE]);
    kb.on('keydown-SPACE', () => this.start());
    kb.on('keydown-ENTER', () => this.start());
    this.input.on('pointerdown', () => this.start());
    // o hub pode pedir a reinicialização enquanto o menu está aberto: começa a partida
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
    this.registry.set('startScene', this.sceneIndex);
    this.scene.start('Play');
  }
}
