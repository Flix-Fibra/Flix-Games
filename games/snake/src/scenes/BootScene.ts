import Phaser from 'phaser';
import { DEFAULT_AVATAR, composePortrait, type AvatarConfig, type Expression } from '@flix/avatar';
import type { HubToGame } from '@flix/game-sdk';
import { setMuted } from '../audio';
import { COLORS, FONT_TEXT, GAME_H, GAME_W, IMAGES } from '../theme';
import { drawBackground, ensureGlowTexture } from '../ui';

const INIT_TIMEOUT_MS = 1500;
export const EXPRESSIONS: Expression[] = ['neutral', 'happy', 'sad'];
export const portraitKey = (e: Expression): string => `portrait_${e}`;

/**
 * Carrega as imagens (com barra de progresso) e espera a mensagem `init` do hub por até 1,5 s.
 * Se o `init` não chegar, segue com o personagem padrão: o jogo nunca fica travado esperando o personagem.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.cameras.main.setBackgroundColor(COLORS.background);
    drawBackground(this);
    const barW = 320;
    const frame = this.add.rectangle(GAME_W / 2, GAME_H / 2, barW + 8, 28, 0x000000, 0.4).setStrokeStyle(3, 0xffffff, 0.6);
    const bar = this.add.rectangle(GAME_W / 2 - barW / 2, GAME_H / 2, 0, 20, COLORS.flixRed).setOrigin(0, 0.5);
    this.add
      .text(GAME_W / 2, GAME_H / 2 - 50, 'Carregando...', { fontFamily: FONT_TEXT, fontSize: '28px', color: COLORS.textMuted })
      .setOrigin(0.5)
      .setResolution(2);
    this.load.on('progress', (v: number) => {
      bar.width = barW * v;
    });
    this.load.once('complete', () => frame.destroy());
    // as imagens ficam em public/img/ (caminho relativo: funciona em qualquer subpasta)
    for (const [key, file] of IMAGES) this.load.image(key, `img/${file}`);
  }

  /** Céu noturno provisório (gradiente, estrelas e lua), desenhado aqui até existir um asset próprio: troque a textura 'ceu_noite'. */
  private makeNightSky(): void {
    if (this.textures.exists('ceu_noite')) return;
    const w = 1080;
    const h = 296;
    const tex = this.textures.createCanvas('ceu_noite', w, h);
    if (!tex) return;
    const c = tex.getContext();
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#050a24');
    g.addColorStop(1, '#1a2a63');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    let a = 12345;
    const rnd = () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 130; i++) {
      c.fillStyle = `rgba(255,255,255,${0.35 + rnd() * 0.65})`;
      const r = rnd() < 0.15 ? 2.4 : 1.2;
      c.beginPath();
      c.arc(rnd() * w, rnd() * h * 0.85, r, 0, Math.PI * 2);
      c.fill();
    }
    const mx = w * 0.74;
    const my = 80;
    const glow = c.createRadialGradient(mx, my, 10, mx, my, 110);
    glow.addColorStop(0, 'rgba(255,248,210,0.55)');
    glow.addColorStop(1, 'rgba(255,248,210,0)');
    c.fillStyle = glow;
    c.fillRect(mx - 120, my - 120, 240, 240);
    c.fillStyle = '#fff6d0';
    c.beginPath();
    c.arc(mx, my, 34, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#10194a'; // crescente
    c.beginPath();
    c.arc(mx + 16, my - 8, 30, 0, Math.PI * 2);
    c.fill();
    tex.refresh();
  }

  create(): void {
    ensureGlowTexture(this);
    this.makeNightSky();
    const existing = this.registry.get('hubInit') as Extract<HubToGame, { type: 'init' }> | undefined;
    if (existing) {
      this.finish(existing.avatar, existing.muted);
      return;
    }

    let done = false;
    const complete = (avatar: AvatarConfig, muted: boolean) => {
      if (done) return;
      done = true;
      this.finish(avatar, muted);
    };
    this.game.events.once('hub-init', (msg: Extract<HubToGame, { type: 'init' }>) => complete(msg.avatar, msg.muted));
    this.time.delayedCall(INIT_TIMEOUT_MS, () => complete(DEFAULT_AVATAR, false));
  }

  private finish(avatar: AvatarConfig, muted: boolean): void {
    setMuted(muted);
    this.registry.set('avatar', avatar);
    for (const expr of EXPRESSIONS) {
      const key = portraitKey(expr);
      if (this.textures.exists(key)) this.textures.remove(key);
      const tex = this.textures.addCanvas(key, composePortrait(avatar, expr));
      tex?.setFilter(Phaser.Textures.FilterMode.NEAREST); // o retrato do personagem continua nítido, sem borrar
    }
    this.scene.start('Menu');
  }
}
