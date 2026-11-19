import Phaser from 'phaser';
import type { HubToGame } from '@flix/game-sdk';
import { makeItemTextures } from '../art';
import { hudText } from '@flix/game-kit/src/phaserHud';
import { ajustarCamera } from '../camera';
import { ENEMIES, ENEMY_FRAME, GAME_H, GAME_W, IMAGES, PORTAL } from '../theme';

const INIT_TIMEOUT_MS = 1500;

/** Carrega o cenário, gera as texturas por código e espera o `init` do hub por até 1,5 s (nunca trava esperando). */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    // Tela de carregamento no estilo dos jogos Flix: fundo azul-escuro, texto pixel e barra em 10 gomos vermelhos
    ajustarCamera(this); // a câmera já com o zoom certo (antes o carregamento aparecia num canto da tela)
    this.cameras.main.setBackgroundColor(0x0a1640);
    const cx = GAME_W / 2;
    const cy = GAME_H / 2;
    hudText(this, cx, cy - 46, 'FLIX RUNNER', 4).setOrigin(0.5).setTint(0xf6e7c1);
    hudText(this, cx, cy + 46, 'CARREGANDO...', 2).setOrigin(0.5);
    const GOMOS = 10;
    const gw = 22;
    const gap = 5;
    const bw = GOMOS * gw + (GOMOS - 1) * gap;
    const g = this.add.graphics();
    const desenhar = (v: number) => {
      const cheios = Math.round(v * GOMOS);
      g.clear();
      g.fillStyle(0x0b1530, 1).fillRect(cx - bw / 2 - 5, cy - 14, bw + 10, 28);
      for (let i = 0; i < GOMOS; i++) {
        const x = cx - bw / 2 + i * (gw + gap);
        g.fillStyle(i < cheios ? 0xd4142c : 0x2a3550, 1).fillRect(x, cy - 9, gw, 18);
        if (i < cheios) g.fillStyle(0xf0606f, 1).fillRect(x, cy - 9, gw, 4); // brilho em cima do gomo
      }
    };
    desenhar(0);
    this.load.on('progress', desenhar);
    for (const [key, file] of IMAGES) this.load.image(key, `img/${file}`);
    for (const e of ENEMIES) this.load.spritesheet(e.key, `img/${e.file}`, { frameWidth: ENEMY_FRAME, frameHeight: ENEMY_FRAME });
    for (const p of Object.values(PORTAL)) this.load.spritesheet(p.key, `img/${p.file}`, { frameWidth: p.w, frameHeight: p.h });
  }

  create(): void {
    makeItemTextures(this);
    // Portal: Julia entrando (sem o tchauzinho), Julia saindo, e o portal sozinho abrindo e girando
    const P = PORTAL;
    const anim = (key: string, sheet: string, de: number, ate: number, fps: number, repeat = 0) => {
      if (!this.anims.exists(key)) this.anims.create({ key, frames: this.anims.generateFrameNumbers(sheet, { start: de, end: ate }), frameRate: fps, repeat });
    };
    anim('portal_entra', P.entrada.key, 0, P.entrada.quadros - 1, P.entrada.fps);
    anim('portal_sai', P.saida.key, 0, P.saida.quadros - 1, P.saida.fps);
    anim('portal_abre', P.girando.key, P.girando.abrir[0], P.girando.abrir[1], P.girando.fps);
    anim('portal_gira', P.girando.key, P.girando.girar[0], P.girando.girar[1], P.girando.fps, -1);
    // Animação de cada inimigo (4 quadros em loop, no ritmo do GIF original)
    for (const e of ENEMIES) {
      if (!this.anims.exists(e.key)) {
        this.anims.create({ key: e.key, frames: this.anims.generateFrameNumbers(e.key, { start: 0, end: 3 }), frameRate: e.fps, repeat: -1 });
      }
    }

    const existing = this.registry.get('hubInit') as Extract<HubToGame, { type: 'init' }> | undefined;
    if (existing) {
      this.finish(existing.muted);
      return;
    }
    let done = false;
    const complete = (muted: boolean) => {
      if (done) return;
      done = true;
      this.finish(muted);
    };
    this.game.events.once('hub-init', (m: Extract<HubToGame, { type: 'init' }>) => complete(m.muted));
    this.time.delayedCall(INIT_TIMEOUT_MS, () => complete(false));
  }

  private finish(muted: boolean): void {
    this.game.sound.mute = muted;
    this.scene.start('Menu');
  }
}
