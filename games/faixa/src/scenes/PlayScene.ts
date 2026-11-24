import Phaser from 'phaser';
import { hudText } from '@flix/game-kit/src/phaserHud';
import type { Expression } from '@flix/avatar';
import type { HubBridge } from '@flix/game-sdk';
import { PLAYER, SPLASH, TAPUME } from '../art';
import { sfx } from '../audio';
import { LaneView } from '../laneView';
import { createGame, move, score, update, type Cause, type Dir, type Game } from '../logic';
import { RENDER } from '../camera';
import { loadBest } from '../storage';
import { CELL, COLORS, GAME_H, GAME_W, HUD_H, PLAY_W, PLAY_X } from '../theme';
import { portraitKey } from './BootScene';

const READY_MS = 600;
/** Passo máximo da simulação (os trens andam rápido: passos pequenos evitam atravessar o jogador). */
const STEP = 1 / 60;
const SWIPE_PX = 18;
const TAP_PX = 10;
const MILESTONE = 10;
const ROWS_ON_SCREEN = Math.ceil(GAME_H / CELL) + 2;

const KEY_DIR: Record<string, Dir> = {
  ArrowUp: 'up', KeyW: 'up', Space: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};
const ANGLE: Record<Dir, number> = { up: 0, right: 90, down: 180, left: 270 };

export class PlayScene extends Phaser.Scene {
  private g!: Game;
  private bridge!: HubBridge;
  private runId = '';
  private elapsed = 0;
  private readyLeft = READY_MS;
  private over = false;
  private lastScore = 0;
  private previousBest = 0;

  private readonly views = new Map<number, LaneView>();
  private player!: Phaser.GameObjects.Image;
  private sx = 0;
  private sy = 0;
  private bump = 1;
  private leftWall!: Phaser.GameObjects.TileSprite;
  private rightWall!: Phaser.GameObjects.TileSprite;
  private hudBar!: Phaser.GameObjects.Rectangle;
  private danger!: Phaser.GameObjects.Rectangle;
  private portrait!: Phaser.GameObjects.Image;
  private scoreText!: Phaser.GameObjects.BitmapText;
  private bestText!: Phaser.GameObjects.BitmapText;
  private readyText!: Phaser.GameObjects.Text;
  private camTop = 0;

  constructor() {
    super('Play');
  }

  create(): void {
    this.bridge = this.registry.get('bridge') as HubBridge;
    this.runId = this.bridge.newRunId();
    this.elapsed = 0;
    this.readyLeft = READY_MS;
    this.over = false;
    this.lastScore = 0;
    this.previousBest = loadBest();
    this.views.clear();
    this.bump = 1;
    this.cameras.main.setBackgroundColor(COLORS.background);

    this.g = createGame(Math.floor(Math.random() * 2 ** 31));
    this.syncViews();

    this.leftWall = this.add.tileSprite(0, 0, PLAY_X, GAME_H, TAPUME).setOrigin(0, 0).setTileScale(1 / 3, 1 / 3).setDepth(5);
    this.rightWall = this.add.tileSprite(PLAY_X + PLAY_W, 0, PLAY_X, GAME_H, TAPUME).setOrigin(0, 0).setTileScale(1 / 3, 1 / 3).setDepth(5);

    this.player = this.add.image(0, 0, PLAYER).setDepth(3);
    this.sx = this.targetX();
    this.sy = this.targetY();

    // HUD: fica presa à tela porque é reposicionada a cada quadro (ver placeScreenObjects)
    this.hudBar = this.add.rectangle(0, 0, GAME_W, HUD_H, 0x000000, 0.4).setOrigin(0, 0).setDepth(6);
    this.danger = this.add.rectangle(0, 0, GAME_W, 14, COLORS.warnRed, 0).setOrigin(0, 0).setDepth(6);
    this.portrait = this.add.image(0, 0, portraitKey('neutral')).setScale(1).setDepth(7);
    this.scoreText = hudText(this, GAME_W / 2, 0, '0', 4).setOrigin(0.5, 0).setDepth(7);
    this.bestText = hudText(this, GAME_W - 6, 0, `MELHOR ${this.previousBest}`, 1).setOrigin(1, 0).setDepth(7);
    this.readyText = this.add
      .text(GAME_W / 2, 0, 'VAI!', { fontFamily: 'sans-serif', fontSize: '30px', fontStyle: 'bold', color: COLORS.text })
      .setOrigin(0.5)
      .setDepth(7);

    this.setupInput();
    this.bridge.sendStarted(this.runId);
    this.placeCamera();
  }

  // ---------- coordenadas ----------

  private targetX = (): number => PLAY_X + this.g.x * CELL + CELL / 2;
  private targetY = (): number => -this.g.row * CELL - CELL / 2;

  // ---------- entrada ----------

  private setupInput(): void {
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      const dir = KEY_DIR[e.code];
      if (!dir || e.repeat) return;
      e.preventDefault();
      this.step(dir);
    });
    // toque: deslizar escolhe o lado (dispara assim que passa do limite); toque curto avança
    let start: { x: number; y: number } | null = null;
    let fired = false;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      start = { x: p.x, y: p.y };
      fired = false;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!start || fired || !p.isDown) return;
      const dx = (p.x - start.x) / RENDER;
      const dy = (p.y - start.y) / RENDER;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return;
      fired = true;
      this.step(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down');
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (start && !fired) {
        const d = Math.hypot(p.x - start.x, p.y - start.y) / RENDER;
        if (d < TAP_PX) this.step('up');
      }
      start = null;
    });
  }

  private step(dir: Dir): void {
    if (this.over || this.readyLeft > 0) return;
    const moved = move(this.g, dir);
    if (!moved) {
      sfx('blocked');
      this.bump = 0.9;
      return;
    }
    sfx(dir === 'left' || dir === 'right' ? 'side' : 'hop');
    this.player.setAngle(ANGLE[dir]);
    this.bump = 1.18;
    this.syncViews();
  }

  // ---------- faixas ----------

  /** Cria a visão das faixas que entraram na janela da câmera e destrói (e esquece) as que ficaram para trás. */
  private syncViews(): void {
    const w = this.g.world;
    const from = Math.floor(this.g.camRow) - 1;
    for (let i = from; i <= from + ROWS_ON_SCREEN + 1; i++) {
      if (i < 0 || this.views.has(i) || !w.has(i)) continue;
      const lane = w.lane(i);
      const view = new LaneView(this, lane, w.has(i + 1) && w.lane(i + 1).kind === 'road');
      view.onBeep = () => sfx('warn');
      view.onTrain = () => sfx('train');
      this.views.set(i, view);
    }
    for (const i of w.prune(from - 2)) {
      this.views.get(i)?.destroy();
      this.views.delete(i);
    }
  }

  // ---------- laço do jogo ----------

  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.05);
    if (this.readyLeft > 0) {
      this.readyLeft -= delta;
      if (this.readyLeft <= 0) this.readyText.setVisible(false);
    } else if (!this.over) {
      this.elapsed += delta;
      for (let rem = dt; rem > 0; rem -= STEP) update(this.g, Math.min(rem, STEP));
      this.syncViews();
      if (!this.g.alive) this.finish(this.g.cause ?? 'time');
    }

    for (const v of this.views.values()) v.update(this.g.t);
    this.moveVisual(dt);
    this.placeCamera();
    this.updateHud();
  }

  /** O jogador anda na grade no cálculo, mas é desenhado deslizando até lá. */
  private moveVisual(dt: number): void {
    const tx = this.targetX();
    const ty = this.targetY();
    const k = 1 - Math.exp(-dt * 38);
    this.sx = Math.abs(tx - this.sx) > CELL * 3 ? tx : this.sx + (tx - this.sx) * k;
    this.sy = Math.abs(ty - this.sy) > CELL * 3 ? ty : this.sy + (ty - this.sy) * k;
    this.bump += (1 - this.bump) * (1 - Math.exp(-dt * 16));
    if (this.player.visible) this.player.setPosition(this.sx, this.sy).setDisplaySize(CELL * this.bump, CELL * this.bump);
  }

  private placeCamera(): void {
    const centerY = Math.round((-this.g.camRow * CELL - GAME_H / 2) * RENDER) / RENDER;
    this.cameras.main.centerOn(GAME_W / 2, centerY);
    this.camTop = centerY - GAME_H / 2;
    this.leftWall.setY(this.camTop).setTilePosition(0, this.camTop * 3);
    this.rightWall.setY(this.camTop).setTilePosition(0, this.camTop * 3);
  }

  private updateHud(): void {
    const top = this.camTop;
    this.hudBar.setY(top);
    this.portrait.setPosition(18, top + HUD_H / 2);
    this.scoreText.setPosition(GAME_W / 2, top + 5);
    this.bestText.setPosition(GAME_W - 6, top + 4);
    this.readyText.setY(top + GAME_H * 0.45);
    // aviso vermelho embaixo quando a base da tela está chegando no jogador
    const gap = this.g.row - this.g.camRow;
    const close = Phaser.Math.Clamp((2.2 - gap) / 2.2, 0, 1);
    this.danger.setY(top + GAME_H - 14).setAlpha(this.g.alive ? close * (0.35 + 0.25 * Math.sin(this.time.now / 90)) : 0);

    const s = score(this.g);
    if (s !== this.lastScore) {
      this.lastScore = s;
      this.scoreText.setText(String(s));
      if (s % MILESTONE === 0) {
        sfx('milestone');
        this.tweens.add({ targets: this.scoreText, scale: { from: 1.5, to: 1 }, duration: 260 });
      }
      if (s > this.previousBest && this.previousBest > 0) this.bestText.setText(`MELHOR ${s}`);
    }
  }

  // ---------- fim de partida ----------

  private finish(cause: Cause): void {
    if (this.over) return;
    this.over = true;
    const s = score(this.g);
    const expression: Expression = s >= MILESTONE ? 'happy' : 'sad';
    this.portrait.setTexture(portraitKey(expression === 'happy' ? 'happy' : 'sad'));

    if (cause === 'water' || cause === 'carried') {
      sfx('splash');
      this.player.setVisible(false);
      this.splash(this.sx, this.sy);
    } else if (cause === 'time') {
      sfx('time');
      this.tweens.add({ targets: this.player, alpha: 0, duration: 400 });
    } else {
      sfx('crash');
      this.cameras.main.shake(260, 0.012);
      this.player.setTint(0xff6666).setDisplaySize(CELL * 1.3, CELL * 0.4);
    }

    this.bridge.sendGameOver({
      runId: this.runId,
      score: s,
      durationMs: this.elapsed,
      meta: { cause },
    });
    const result = { score: s, cause, previousBest: this.previousBest, expression };
    this.time.delayedCall(900, () => this.scene.start('GameOver', result));
  }

  private splash(x: number, y: number): void {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const drop = this.add.image(x, y, SPLASH).setDisplaySize(5, 5).setTint(i % 2 ? 0xffffff : COLORS.waterLight).setDepth(4);
      this.tweens.add({
        targets: drop, x: x + Math.cos(a) * 20, y: y + Math.sin(a) * 20, alpha: 0, scale: 0.3, duration: 480,
        onComplete: () => drop.destroy(),
      });
    }
  }
}
