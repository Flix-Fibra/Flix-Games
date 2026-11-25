import Phaser from 'phaser';
import type { HubBridge } from '@flix/game-sdk';
import { hudText, telaFimDeJogo } from '@flix/game-kit/src/phaserHud';
import {
  buildingTop, craneBottom, flap, FLOOR_Y, PLANE_HALF_H, makeWorld, MARGIN, obstacleRects, PLANE_CIRCLES, PLANE_X, step, tiltFor, type Obstacle, type World,
} from '../logic';
import { HITBOXES } from '../hitboxes';
import { DEPTH, GAME_H, GAME_W } from '../theme';
import { Backdrop } from './Backdrop';

type State = 'ready' | 'playing' | 'dead';

interface Sprites {
  predio: Phaser.GameObjects.Image;
  guindaste: Phaser.GameObjects.Image;
}

/** Partida: toque sobe, a gravidade puxa; passe entre prédio (embaixo) e braço de guindaste (em cima). */
export class PlayScene extends Phaser.Scene {
  private bridge!: HubBridge;
  private world!: World;
  private state: State = 'ready';
  private backdrop!: Backdrop;
  private plane!: Phaser.GameObjects.Image;
  private sprites = new Map<Obstacle, Sprites>();
  private scoreText!: Phaser.GameObjects.BitmapText;
  private hint!: Phaser.GameObjects.Text;
  private runId = '';
  private startedAt = 0;
  private hover = 0;
  private hitGfx!: Phaser.GameObjects.Graphics;
  private showHitboxes = false; // desenvolvimento: tecla H mostra as hitboxes

  constructor() {
    super('Play');
  }

  create(): void {
    this.bridge = this.registry.get('bridge') as HubBridge;
    this.world = makeWorld();
    this.state = 'ready';
    this.sprites.clear();
    this.hover = 0;
    this.backdrop = new Backdrop(this);
    this.plane = this.add.image(PLANE_X, this.world.y, 'aviao').setDepth(DEPTH.plane);

    this.hitGfx = this.add.graphics().setDepth(DEPTH.hud - 1);
    this.input.keyboard!.on('keydown-H', () => (this.showHitboxes = !this.showHitboxes));

    this.scoreText = hudText(this, GAME_W / 2, 70, '0', 12).setOrigin(0.5, 0).setDepth(DEPTH.hud);
    this.hint = this.add
      .text(GAME_W / 2, 820, 'TOQUE PARA SUBIR', { fontFamily: '"Arial Black", Impact, sans-serif', fontSize: '40px', color: '#FFFFFF', stroke: '#1a1030', strokeThickness: 8 })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);
    this.tweens.add({ targets: this.hint, alpha: 0.4, duration: 700, yoyo: true, repeat: -1 });

    const kb = this.input.keyboard!;
    kb.addCapture([Phaser.Input.Keyboard.KeyCodes.SPACE]);
    const onFlap = () => this.onFlap();
    kb.on('keydown-SPACE', onFlap);
    kb.on('keydown-UP', onFlap);
    this.input.on('pointerdown', onFlap);
    const onRestart = () => this.scene.restart();
    this.game.events.on('hub-restart', onRestart);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('hub-restart', onRestart);
      kb.off('keydown-SPACE', onFlap);
      kb.off('keydown-UP', onFlap);
    });
  }

  private onFlap(): void {
    if (this.state === 'dead') return;
    if (this.state === 'ready') {
      this.state = 'playing';
      this.hint.destroy();
      this.runId = this.bridge.newRunId();
      this.startedAt = this.time.now;
      this.bridge.sendStarted(this.runId);
    }
    flap(this.world);
  }

  update(_t: number, dtMs: number): void {
    const dt = Math.min(dtMs, 33) / 1000;
    if (this.state === 'ready') {
      this.hover += dt;
      this.plane.y = this.world.y + Math.sin(this.hover * 4) * 12;
      this.backdrop.advance(420 * dt);
      return;
    }

    if (this.state === 'playing') {
      const { scored, crashed } = step(this.world, dt);
      this.backdrop.advance(this.world.speed * dt);
      if (scored) this.scoreText.setText(String(this.world.score));
      this.syncObstacles();
      if (crashed) this.die();
    } else {
      // morto: o avião cai até o chão; o mundo para
      const w = this.world;
      w.vy = Math.min(1150, w.vy + 2300 * dt);
      w.y = Math.min(GAME_H - 60, w.y + w.vy * dt);
      this.plane.angle = Math.min(80, this.plane.angle + 240 * dt);
    }
    this.plane.y = this.world.y;
    this.drawHitboxes();
    if (this.state === 'playing') this.plane.angle = tiltFor(this.world.vy);
  }

  /** Mostra em vermelho exatamente o que conta como colisão (caixas dos obstáculos e círculos do avião). */
  private drawHitboxes(): void {
    const g = this.hitGfx;
    g.clear();
    if (!this.showHitboxes) return;
    g.lineStyle(2, 0xff0000, 1).fillStyle(0xff0000, 0.28);
    for (const o of this.world.obstacles) {
      for (const [x, y, w, h] of obstacleRects(o)) {
        const rx = x + MARGIN, ry = y + MARGIN, rw = w - 2 * MARGIN, rh = h - 2 * MARGIN;
        if (rw <= 0 || rh <= 0) continue;
        g.fillRect(rx, ry, rw, rh).strokeRect(rx, ry, rw, rh);
      }
    }
    const w = this.world;
    for (const c of PLANE_CIRCLES) {
      // os círculos não giram com a inclinação do desenho: valem na posição do avião
      g.fillCircle(PLANE_X + c.x, w.y + c.y, c.r).strokeCircle(PLANE_X + c.x, w.y + c.y, c.r);
    }
    // chão: o avião morre quando a parte de baixo dele chega nesta linha
    const floor = FLOOR_Y - PLANE_HALF_H * 0.7;
    g.lineStyle(2, 0xff0000, 1).lineBetween(0, floor + PLANE_HALF_H * 0.7, GAME_W, floor + PLANE_HALF_H * 0.7);
  }

  private syncObstacles(): void {
    const alive = new Set(this.world.obstacles);
    for (const [o, s] of this.sprites) {
      if (!alive.has(o)) {
        s.predio.destroy();
        s.guindaste.destroy();
        this.sprites.delete(o);
      }
    }
    for (const o of this.world.obstacles) {
      let s = this.sprites.get(o);
      if (!s) {
        const b = HITBOXES[`predio_${o.predio}`]!;
        const g = HITBOXES[`guindaste_${o.guindaste}`]!;
        s = {
          predio: this.add.image(o.x, buildingTop(o), `predio_${o.predio}`).setOrigin(0.5, 0).setDepth(DEPTH.obstacle),
          guindaste: this.add.image(o.x, craneBottom(o) - g.h, `guindaste_${o.guindaste}`).setOrigin(0.5, 0).setDepth(DEPTH.obstacle),
        };
        void b;
        this.sprites.set(o, s);
      }
      s.predio.x = o.x;
      s.guindaste.x = o.x;
    }
  }

  private die(): void {
    if (this.state === 'dead') return;
    this.state = 'dead';
    this.cameras.main.shake(220, 0.01);
    this.cameras.main.flash(120, 255, 255, 255, false);
    this.bridge.sendGameOver({
      runId: this.runId,
      score: this.world.score,
      durationMs: Math.round(this.time.now - this.startedAt),
      meta: { passes: this.world.score },
    });
    this.time.delayedCall(700, () => this.showGameOver());
  }

  private showGameOver(): void {
    const n = this.world.score;
    telaFimDeJogo(this, {
      largura: GAME_W,
      altura: GAME_H,
      pontos: n,
      linhas: [{ texto: `${n} ${n === 1 ? 'OBSTACULO' : 'OBSTACULOS'} VENCIDOS` }],
      px: { titulo: 8, pontos: 14, texto: 3, botao: 6 },
      depth: DEPTH.over,
      veu: [0x120a2a, 0.62],
      onReiniciar: () => this.scene.start('Menu'),
    });
  }
}
