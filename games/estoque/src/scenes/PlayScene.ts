import Phaser from 'phaser';
import type { Expression } from '@flix/avatar';
import type { HubBridge } from '@flix/game-sdk';
import { cellKey } from '../art';
import { sfx } from '../audio';
import {
  COLS, ROUND_MS, ROWS, SOFT_DROP_MS, createState, fallInterval, gravity, hardDrop, landingY, levelFor, lock, mulberry32, moveH,
  pieceHeight, pieceWidth, spawn, type Board, type Cause, type GameState, type LockResult, type StepResult,
} from '../logic';
import { loadBest } from '../storage';
import { BAR_Y, BOARD_X, BOARD_Y, CELL, COLORS, FONT, GAME_H, GAME_W, HUD_H, ITEMS } from '../theme';
import { portraitKey } from './BootScene';

const READY_MS = 800;
const SWIPE_STEP = CELL * 0.85;
const SOFT_PX = 16;
const HARD_PX = 58;
const TAP_MS = 260;
const PREVIEW_CELL = 12;
const STORE_X = 148;
const STORE_Y = 30;
const SIZE = CELL - 1;

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: number;
  life: number;
  max: number;
}

const cx = (x: number): number => BOARD_X + x * CELL + CELL / 2;
const cy = (y: number): number => BOARD_Y + y * CELL + CELL / 2;
const copy = (b: Board): Board => b.map((r) => r.slice());

export class PlayScene extends Phaser.Scene {
  private state!: GameState;
  private bridge!: HubBridge;
  private rng = mulberry32(1);
  private runId = '';
  private elapsed = 0;
  private readyLeft = READY_MS;
  private over = false;
  private busy = false;

  private disp: Board = [];
  private hidden = new Set<number>();
  private cells: Phaser.GameObjects.Image[] = [];
  private pieceImgs: Phaser.GameObjects.Image[] = [];
  private ghostImgs: Phaser.GameObjects.Image[] = [];
  private nextImgs: Phaser.GameObjects.Image[] = [];
  private fx!: Phaser.GameObjects.Graphics;
  private danger!: Phaser.GameObjects.Graphics;
  private crate!: Phaser.GameObjects.Container;
  private portrait!: Phaser.GameObjects.Image;
  private scoreText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private storedText!: Phaser.GameObjects.Text;
  private chainText!: Phaser.GameObjects.Text;
  private readyText!: Phaser.GameObjects.Text;
  private expressionTimer?: Phaser.Time.TimerEvent;
  private sparks: Spark[] = [];

  private softHeld = false;
  private touchActive = false;
  private touchStartX = 0;
  private touchStartY = 0;
  private touchAnchorX = 0;
  private touchStartT = 0;
  private touchMoved = false;
  private touchHard = false;
  private pieceKey = '';

  constructor() {
    super('Play');
  }

  create(): void {
    this.bridge = this.registry.get('bridge') as HubBridge;
    this.rng = mulberry32(Math.floor(Math.random() * 2 ** 32));
    this.state = createState(this.rng);
    this.runId = this.bridge.newRunId();
    this.elapsed = 0;
    this.readyLeft = READY_MS;
    this.over = false;
    this.busy = false;
    this.hidden = new Set();
    this.sparks = [];
    this.softHeld = false;
    this.touchActive = false;
    this.pieceKey = '';
    this.disp = copy(this.state.board);

    this.cameras.main.setBackgroundColor(COLORS.background);
    this.drawShelf();
    this.cells = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        this.cells.push(this.add.image(cx(x), cy(y), cellKey(1)).setDisplaySize(SIZE, SIZE).setVisible(false));
      }
    }
    this.ghostImgs = [0, 1, 2].map(() => this.add.image(0, 0, cellKey(1)).setDisplaySize(SIZE, SIZE).setAlpha(0.2).setVisible(false).setDepth(2));
    this.pieceImgs = [0, 1, 2].map(() => this.add.image(0, 0, cellKey(1)).setDisplaySize(SIZE, SIZE).setVisible(false).setDepth(3));
    this.nextImgs = [0, 1, 2].map(() => this.add.image(0, 0, cellKey(1)).setDisplaySize(PREVIEW_CELL, PREVIEW_CELL).setVisible(false));
    this.danger = this.add.graphics().setDepth(1);
    this.fx = this.add.graphics().setDepth(10);
    this.buildHud();
    this.buildBar();
    this.readyText = this.add
      .text(GAME_W / 2, BOARD_Y + (ROWS * CELL) / 2 - 20, 'PRONTO?', {
        fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: COLORS.text, stroke: '#000000', strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setDepth(15);

    this.bridge.sendStarted(this.runId);
    this.setupInput();
    this.events.once('shutdown', () => {
      this.input.removeAllListeners();
      this.input.keyboard?.removeAllListeners();
    });
  }

  // ---------- entrada ----------

  private canAct(): boolean {
    return !this.over && !this.busy && this.readyLeft <= 0 && this.state.piece !== null;
  }

  private setupInput(): void {
    const kb = this.input.keyboard;
    if (kb) {
      kb.addCapture('UP,DOWN,LEFT,RIGHT,SPACE');
      const left = () => this.tryMove(-1);
      const right = () => this.tryMove(1);
      kb.on('keydown-LEFT', left);
      kb.on('keydown-A', left);
      kb.on('keydown-RIGHT', right);
      kb.on('keydown-D', right);
      kb.on('keydown-UP', () => this.tryHardDrop());
      kb.on('keydown-W', () => this.tryHardDrop());
      kb.on('keydown-SPACE', () => this.tryHardDrop());
      kb.on('keydown-DOWN', () => (this.softHeld = true));
      kb.on('keyup-DOWN', () => (this.softHeld = false));
      kb.on('keydown-S', () => (this.softHeld = true));
      kb.on('keyup-S', () => (this.softHeld = false));
    }

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.touchActive = true;
      this.touchStartX = this.touchAnchorX = p.x;
      this.touchStartY = p.y;
      this.touchStartT = this.time.now;
      this.touchMoved = false;
      this.touchHard = false;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.touchActive || !p.isDown) return;
      while (Math.abs(p.x - this.touchAnchorX) >= SWIPE_STEP) {
        const dir = p.x > this.touchAnchorX ? 1 : -1;
        this.touchAnchorX += dir * SWIPE_STEP;
        this.touchMoved = true;
        this.tryMove(dir);
      }
      const dy = p.y - this.touchStartY;
      const dx = Math.abs(p.x - this.touchStartX);
      if (dy > HARD_PX && dy > dx * 1.2 && !this.touchHard) {
        this.touchHard = true;
        this.touchMoved = true;
        this.softHeld = false;
        this.tryHardDrop();
      } else if (dy > SOFT_PX && dy > dx && !this.touchHard) {
        this.touchMoved = true;
        this.softHeld = true;
      } else if (dy <= SOFT_PX) {
        this.softHeld = false;
      }
    });
    const release = () => {
      if (!this.touchActive) return;
      this.touchActive = false;
      this.softHeld = false;
      if (!this.touchMoved && this.time.now - this.touchStartT < TAP_MS) this.tryHardDrop();
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
  }

  private tryMove(dx: number): void {
    if (this.canAct() && moveH(this.state, dx)) sfx('move');
  }
  private tryHardDrop(): void {
    if (!this.canAct()) return;
    const n = hardDrop(this.state);
    sfx('drop');
    if (n >= 0) this.lockNow();
  }

  // ---------- laço ----------

  update(_time: number, rawDelta: number): void {
    const delta = Math.min(rawDelta, 100);
    this.advanceSparks(delta);
    if (this.over) {
      this.render();
      return;
    }

    if (this.readyLeft > 0) {
      this.readyLeft -= delta;
      if (this.readyLeft <= 0) this.readyText.setVisible(false);
      else if (this.readyLeft < READY_MS / 2) this.readyText.setText('VAI!');
      this.render();
      return;
    }

    this.elapsed += delta;
    if (this.elapsed >= ROUND_MS) {
      this.elapsed = ROUND_MS;
      this.finish('timeout');
      this.render();
      return;
    }

    if (!this.busy && this.state.piece) {
      const r = gravity(this.state, delta, this.softHeld);
      if (r.locked) this.handleLock(r.locked);
    }
    this.render();
  }

  private lockNow(): void {
    this.handleLock(lock(this.state));
  }

  private handleLock(r: LockResult): void {
    sfx('land');
    for (const c of r.placed) if (c.y >= 0) this.disp[c.y]![c.x] = c.item;
    if (r.steps.length === 0) {
      this.disp = copy(this.state.board);
      this.nextPiece();
      return;
    }
    this.busy = true;
    this.softHeld = false;
    this.playStep(r, 0);
  }

  private nextPiece(): void {
    if (this.over) return;
    if (!spawn(this.state, this.rng)) {
      this.finish('overflow');
      return;
    }
    this.pieceKey = '';
  }

  // ---------- animação de guardar e cair ----------

  private playStep(r: LockResult, i: number): void {
    if (this.over) return;
    const step = r.steps[i];
    if (!step) {
      this.disp = copy(this.state.board);
      this.hidden.clear();
      this.busy = false;
      this.chainText.setText('');
      if (r.levelUp) this.showLevelUp(levelFor(this.state.stored));
      this.nextPiece();
      return;
    }
    const FLY_MS = 280;
    const POP_MS = 90;
    const STAGGER = Math.min(120, 18 * step.removed.length) / Math.max(1, step.removed.length);

    sfx('collect', step.chain);
    this.setExpression('happy', 900);
    if (step.chain >= 2) this.chainText.setText(`CADEIA x${step.chain}`);

    // os itens guardados saem do tabuleiro e voam até a caixa de estoque
    step.removed.forEach((c, k) => {
      this.hidden.add(c.y * COLS + c.x);
      const img = this.add.image(cx(c.x), cy(c.y), cellKey(c.item)).setDisplaySize(SIZE, SIZE).setDepth(11);
      const sc = img.scaleX;
      this.tweens.add({ targets: img, scaleX: sc * 1.14, scaleY: sc * 1.14, duration: POP_MS, ease: 'Quad.easeOut' });
      this.tweens.add({
        targets: img, x: STORE_X, y: STORE_Y, scaleX: sc * 0.22, scaleY: sc * 0.22, alpha: 0.3,
        delay: POP_MS + k * STAGGER, duration: FLY_MS, ease: 'Cubic.easeIn',
        onComplete: () => img.destroy(),
      });
      for (let n = 0; n < 3; n++) this.sparks.push(this.makeSpark(cx(c.x), cy(c.y), c.item));
    });
    const gx = step.removed.reduce((a, c) => a + cx(c.x), 0) / step.removed.length;
    const gy = step.removed.reduce((a, c) => a + cy(c.y), 0) / step.removed.length;
    this.floatText(gx, gy, `+${step.gain}`);
    const biggest = Math.max(...step.groups);
    if (biggest >= 4) this.bigGroupText(biggest);
    const clearTotal = POP_MS + FLY_MS + STAGGER * step.removed.length;

    this.time.delayedCall(clearTotal, () => {
      this.bumpCrate();
      this.storedText.setText(String(this.storedAfter(r, i)));
      this.scoreText.setText(String(this.scoreAfter(r, i)));
      this.dropStep(step, () => this.playStep(r, i + 1));
    });
  }

  private storedAfter(r: LockResult, i: number): number {
    const done = r.steps.slice(0, i + 1).reduce((a, s) => a + s.removed.length, 0);
    return this.state.stored - r.stored + done;
  }
  private scoreAfter(r: LockResult, i: number): number {
    const done = r.steps.slice(0, i + 1).reduce((a, s) => a + s.gain, 0);
    return this.state.score - r.gain + done;
  }

  /** Itens de cima descem para preencher o espaço liberado. */
  private dropStep(step: StepResult, done: () => void): void {
    if (this.over) return;
    for (const c of step.removed) this.disp[c.y]![c.x] = 0;
    const FALL_MS = 200;
    if (step.falls.length === 0) {
      this.disp = copy(step.board);
      this.hidden.clear();
      done();
      return;
    }
    for (const f of step.falls) {
      this.disp[f.fromY]![f.x] = 0;
      this.hidden.add(f.toY * COLS + f.x);
      const img = this.add.image(cx(f.x), cy(f.fromY), cellKey(f.item)).setDisplaySize(SIZE, SIZE).setDepth(9);
      this.tweens.add({ targets: img, y: cy(f.toY), duration: FALL_MS, ease: 'Quad.easeIn', onComplete: () => img.destroy() });
    }
    this.hidden = new Set([...this.hidden].filter((k) => step.falls.some((f) => f.toY * COLS + f.x === k)));
    this.time.delayedCall(FALL_MS + 20, () => {
      this.disp = copy(step.board);
      this.hidden.clear();
      sfx('land');
      done();
    });
  }

  private makeSpark(x: number, y: number, item: number): Spark {
    const a = Math.random() * Math.PI * 2;
    const v = 40 + Math.random() * 90;
    return {
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, r: 1.6 + Math.random() * 1.8,
      color: Math.random() < 0.5 ? 0xffffff : ITEMS[item]!.cardDark, life: 0, max: 380 + Math.random() * 220,
    };
  }

  private advanceSparks(dt: number): void {
    const g = this.fx;
    g.clear();
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i]!;
      s.life += dt;
      if (s.life >= s.max) {
        this.sparks.splice(i, 1);
        continue;
      }
      s.vy += 260 * (dt / 1000);
      s.x += s.vx * (dt / 1000);
      s.y += s.vy * (dt / 1000);
      g.fillStyle(s.color, 1 - s.life / s.max).fillCircle(s.x, s.y, s.r);
    }
  }

  private bumpCrate(): void {
    this.tweens.add({ targets: this.crate, scale: 1.3, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
  }

  private floatText(x: number, y: number, text: string): void {
    const t = this.add
      .text(x, y, text, { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: COLORS.gold, stroke: '#000000', strokeThickness: 3 })
      .setOrigin(0.5)
      .setResolution(2)
      .setDepth(12);
    this.tweens.add({ targets: t, y: y - 26, alpha: 0, duration: 800, onComplete: () => t.destroy() });
  }

  /** Aviso quando o jogador junta mais de 3 de uma vez. */
  private bigGroupText(size: number): void {
    const t = this.add
      .text(GAME_W / 2, BOARD_Y + ROWS * CELL * 0.25, `${size} DE UMA VEZ!`, {
        fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: COLORS.gold, stroke: '#000000', strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setScale(0)
      .setDepth(14);
    this.tweens.add({ targets: t, scale: 1 + Math.min(0.5, (size - 4) * 0.12), duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, y: t.y - 16, delay: 650, duration: 300, onComplete: () => t.destroy() });
  }

  private showLevelUp(level: number): void {
    sfx('level');
    const t = this.add
      .text(GAME_W / 2, BOARD_Y + ROWS * CELL * 0.4, `NÍVEL ${level}`, {
        fontFamily: FONT, fontSize: '34px', fontStyle: 'bold', color: COLORS.gold, stroke: '#000000', strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setScale(0)
      .setDepth(14);
    this.tweens.add({ targets: t, scale: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, delay: 900, duration: 350, onComplete: () => t.destroy() });
  }

  private setExpression(expr: Expression, resetMs?: number): void {
    this.portrait.setTexture(portraitKey(expr));
    this.expressionTimer?.remove(false);
    if (resetMs) this.expressionTimer = this.time.delayedCall(resetMs, () => this.portrait.setTexture(portraitKey('neutral')));
  }

  private finish(cause: Cause): void {
    if (this.over) return;
    this.over = true;
    this.softHeld = false;
    const s = this.state;
    s.alive = false;
    s.cause = cause;
    const failed = cause !== 'timeout';
    sfx(failed ? 'over' : 'end');
    if (failed) this.cameras.main.shake(260, 0.01);
    const expression: Expression = failed || s.stored === 0 ? 'sad' : 'happy';
    this.setExpression(expression);

    this.bridge.sendGameOver({
      runId: this.runId,
      score: s.score,
      durationMs: this.elapsed,
      meta: { stored: s.stored, level: levelFor(s.stored), bestChain: s.bestChain, cause },
    });

    const result = { score: s.score, stored: s.stored, bestChain: s.bestChain, cause, previousBest: loadBest(), expression };
    this.time.delayedCall(failed ? 800 : 450, () => this.scene.start('GameOver', result));
  }

  // ---------- desenho ----------

  private drawShelf(): void {
    const g = this.add.graphics();
    const w = COLS * CELL;
    const h = ROWS * CELL;
    g.fillStyle(COLORS.shelf, 1).fillRoundedRect(BOARD_X - 2, BOARD_Y - 2, w + 4, h + 4, 6);
    g.lineStyle(1, COLORS.shelfLine, 1);
    for (let x = 1; x < COLS; x++) g.lineBetween(BOARD_X + x * CELL, BOARD_Y, BOARD_X + x * CELL, BOARD_Y + h);
    for (let y = 1; y < ROWS; y++) g.lineBetween(BOARD_X, BOARD_Y + y * CELL, BOARD_X + w, BOARD_Y + y * CELL);
    // montantes laterais de prateleira, com furos
    for (const x of [BOARD_X - 12, BOARD_X + w + 4]) {
      g.fillStyle(COLORS.rail, 1).fillRoundedRect(x, BOARD_Y - 4, 8, h + 8, 3);
      g.fillStyle(COLORS.railLight, 1).fillRect(x + 1, BOARD_Y - 2, 1.5, h + 4);
      for (let r = 0; r < ROWS; r++) g.fillStyle(COLORS.background, 1).fillRoundedRect(x + 2.5, BOARD_Y + r * CELL + CELL / 2 - 3, 3, 6, 1.5);
    }
    g.fillStyle(COLORS.rail, 1).fillRoundedRect(BOARD_X - 12, BOARD_Y + h + 2, w + 24, 5, 2);
    g.fillStyle(COLORS.hud, 1).fillRect(0, BAR_Y + 8, GAME_W, GAME_H - BAR_Y - 8);
  }

  private buildHud(): void {
    this.add.rectangle(GAME_W / 2, HUD_H / 2, GAME_W, HUD_H, COLORS.hud).setDepth(5);
    this.add.rectangle(GAME_W / 2, HUD_H - 0.5, GAME_W, 1, COLORS.flixRed).setDepth(5);
    this.portrait = this.add.image(32, HUD_H / 2 - 1, portraitKey('neutral')).setScale(1.75).setDepth(6);
    const label = { fontFamily: FONT, fontSize: '9px', color: COLORS.textMuted };
    this.add.text(68, 6, 'PONTOS', label).setResolution(2).setDepth(6);
    this.scoreText = this.add
      .text(68, 16, '0', { fontFamily: FONT, fontSize: '23px', fontStyle: 'bold', color: COLORS.text })
      .setResolution(2)
      .setDepth(6);
    // caixa de estoque: para onde os itens guardados voam
    this.add.text(STORE_X - 16, 6, 'ESTOQUE', label).setResolution(2).setDepth(6);
    this.crate = this.add.container(STORE_X - 6, STORE_Y + 4).setDepth(6);
    const cg = this.add.graphics();
    cg.fillStyle(0xa8742c, 1).fillRoundedRect(-9, -7, 18, 15, 2.5);
    cg.fillStyle(0xd9a05a, 1).fillRoundedRect(-9, -7, 18, 6, 2.5);
    cg.fillStyle(0xf0d9a0, 1).fillRect(-2, -7, 4, 15);
    cg.lineStyle(1, 0x000000, 0.3).strokeRoundedRect(-9, -7, 18, 15, 2.5);
    this.crate.add(cg);
    this.storedText = this.add
      .text(STORE_X + 8, 22, '0', { fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: COLORS.text })
      .setOrigin(0, 0.5)
      .setResolution(2)
      .setDepth(6);
    this.chainText = this.add
      .text(68, 46, '', { fontFamily: FONT, fontSize: '10px', fontStyle: 'bold', color: COLORS.gold })
      .setResolution(2)
      .setDepth(6);
    this.add.text(GAME_W - 8, 6, 'TEMPO', label).setOrigin(1, 0).setResolution(2).setDepth(6);
    this.timeText = this.add
      .text(GAME_W - 8, 16, '2:00', { fontFamily: FONT, fontSize: '23px', fontStyle: 'bold', color: COLORS.text })
      .setOrigin(1, 0)
      .setResolution(2)
      .setDepth(6);
    this.levelText = this.add
      .text(GAME_W - 8, 46, 'NÍVEL 1', { fontFamily: FONT, fontSize: '10px', color: COLORS.textMuted })
      .setOrigin(1, 0)
      .setResolution(2)
      .setDepth(6);
  }

  private buildBar(): void {
    const style = { fontFamily: FONT, fontSize: '9px', color: COLORS.textMuted, lineSpacing: 2 };
    this.add.text(BOARD_X - 6, BAR_Y + 12, '← → mover   ↑ girar\n↓ descer   espaço: cair', style).setResolution(2).setDepth(6);
    this.add.text(GAME_W - 56, BAR_Y + 19, 'PRÓXIMA', { ...style, fontSize: '8px' }).setOrigin(1, 0.5).setResolution(2).setDepth(6);
  }

  private render(): void {
    const s = this.state;
    // itens parados
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const v = this.disp[y]?.[x] ?? 0;
        const img = this.cells[y * COLS + x]!;
        if (v === 0 || this.hidden.has(y * COLS + x)) img.setVisible(false);
        else img.setVisible(true).setTexture(cellKey(v));
      }
    }
    if (!this.busy && !this.over && this.readyLeft <= 0) this.disp = copy(s.board);

    // peça que cai e sombra de aterrissagem
    const p = s.piece;
    this.pieceImgs.forEach((i) => i.setVisible(false));
    this.ghostImgs.forEach((i) => i.setVisible(false));
    if (p && !this.over) {
      const gy = landingY(s);
      const smooth = !this.busy && this.readyLeft <= 0 && gy > p.y ? Math.max(0, Math.min(1, 1 - s.fallLeft / (this.softHeld ? SOFT_DROP_MS : fallInterval(s.stored)))) : 0;
      p.cells.forEach((c, i) => {
        const pi = this.pieceImgs[i]!;
        pi.setTexture(cellKey(c.item)).setPosition(cx(p.x + c.x), cy(p.y + c.y) + smooth * CELL * (gy > p.y ? 1 : 0)).setVisible(true);
        const gi = this.ghostImgs[i]!;
        if (gy > p.y) gi.setTexture(cellKey(c.item)).setPosition(cx(p.x + c.x), cy(gy + c.y)).setVisible(true);
      });
    }

    // próxima peça
    const n = s.next;
    const nw = pieceWidth(n) * PREVIEW_CELL;
    const nh = pieceHeight(n) * PREVIEW_CELL;
    const left = GAME_W - 50 + (36 - nw) / 2;
    const top = BAR_Y + 20 - nh / 2;
    this.nextImgs.forEach((i, k) => {
      const c = n.cells[k];
      if (!c) return i.setVisible(false);
      i.setTexture(cellKey(c.item)).setPosition(left + c.x * PREVIEW_CELL + PREVIEW_CELL / 2, top + c.y * PREVIEW_CELL + PREVIEW_CELL / 2).setVisible(true);
    });

    // alerta: pilha chegando ao topo
    const dg = this.danger;
    dg.clear();
    let near = false;
    for (let y = 0; y < 3 && !near; y++) if (s.board[y]!.some((v) => v !== 0)) near = true;
    if (near && !this.over) {
      const a = 0.1 + 0.12 * (0.5 + 0.5 * Math.sin(this.time.now / 110));
      dg.fillStyle(0xff3b4e, a).fillRoundedRect(BOARD_X, BOARD_Y, COLS * CELL, CELL * 3, 6);
    }

    // HUD (durante a animação, placar e estoque são atualizados passo a passo)
    if (!this.busy) {
      this.scoreText.setText(String(s.score));
      this.storedText.setText(String(s.stored));
    }
    const sec = Math.ceil(Math.max(0, ROUND_MS - this.elapsed) / 1000);
    this.timeText.setText(`${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`);
    this.timeText.setColor(sec <= 10 ? COLORS.flixRedText : COLORS.text);
    this.levelText.setText(`NÍVEL ${levelFor(s.stored)}`);
  }
}
