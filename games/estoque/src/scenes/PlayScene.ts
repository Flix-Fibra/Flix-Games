import Phaser from 'phaser';
import { hudText } from '@flix/game-kit/src/phaserHud';
import type { Expression } from '@flix/avatar';
import type { HubBridge } from '@flix/game-sdk';
import { DEVICE_LEFT, DEVICE_RIGHT, PLUG_RATIO, cellKey, plugKey } from '../art';
import { sfx } from '../audio';
import {
  COLS, ROWS, createState, gravity, hardDrop, landingY, levelFor, lock, moveH, mulberry32, rotate, spawn,
  type Board, type Cause, type GameState, type LockResult,
} from '../logic';
import { loadBest } from '../storage';
import { BAR_Y, BOARD_X, BOARD_Y, CELL, COLORS, DEVICE_X, FONT, GAME_H, GAME_W, HUD_H, ITEMS, PLUG_W } from '../theme';
import { portraitKey } from './BootScene';

const READY_MS = 800;
/** Segurar a seta para o lado: espera DAS_MS e então anda uma coluna a cada ARR_MS. */
const DAS_MS = 170;
const ARR_MS = 50;
const SWIPE_STEP = CELL * 1.2;
const SOFT_PX = 18;
const HARD_PX = 60;
const HARD_FAST_MS = 220;
const TAP_MS = 260;
/** Linha completa: os aparelhos aparecem (CONNECT_MS), o sinal corre pelo cabo (PULSE_MS) e a linha some (FLASH_MS). */
const CONNECT_MS = 160;
const PULSE_MS = 340;
const FLASH_MS = 200;
const PREVIEW_CELL = 10;
const PREVIEW_X = 214;
const DEVICE_SIZE = 20;
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
  /** Animação de linhas completas em andamento: a próxima peça espera. */
  private busy = false;

  private disp: Board = [];
  private cells: Phaser.GameObjects.Image[] = [];
  private pieceImgs: Phaser.GameObjects.Image[] = [];
  private ghostImgs: Phaser.GameObjects.Image[] = [];
  private nextImgs: Phaser.GameObjects.Image[] = [];
  /** Conectores do lado de fora da prateleira: [linha * 2 + lado] (0 = esquerda, 1 = direita). */
  private plugs: Phaser.GameObjects.Image[] = [];
  private pulse!: Phaser.GameObjects.Graphics;
  private fx!: Phaser.GameObjects.Graphics;
  private flash!: Phaser.GameObjects.Graphics;
  private danger!: Phaser.GameObjects.Graphics;
  private crate!: Phaser.GameObjects.Container;
  private portrait!: Phaser.GameObjects.Image;
  private scoreText!: Phaser.GameObjects.BitmapText;
  private levelText!: Phaser.GameObjects.BitmapText;
  private linesText!: Phaser.GameObjects.BitmapText;
  private readyText!: Phaser.GameObjects.Text;
  private expressionTimer?: Phaser.Time.TimerEvent;
  private sparks: Spark[] = [];

  private softHeld = false;
  private heldDir = 0;
  private dasLeft = 0;
  private touchActive = false;
  private touchStartX = 0;
  private touchStartY = 0;
  private touchAnchorX = 0;
  private touchStartT = 0;
  private touchMoved = false;
  private touchHard = false;

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
    this.sparks = [];
    this.softHeld = false;
    this.heldDir = 0;
    this.touchActive = false;
    this.disp = copy(this.state.board);

    this.cameras.main.setBackgroundColor(COLORS.background);
    this.drawShelf();
    this.cells = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        this.cells.push(this.add.image(cx(x), cy(y), cellKey(1)).setDisplaySize(SIZE, SIZE).setVisible(false));
      }
    }
    const four = [0, 1, 2, 3];
    this.ghostImgs = four.map(() => this.add.image(0, 0, cellKey(1)).setDisplaySize(SIZE, SIZE).setAlpha(0.22).setVisible(false).setDepth(2));
    this.pieceImgs = four.map(() => this.add.image(0, 0, cellKey(1)).setDisplaySize(SIZE, SIZE).setVisible(false).setDepth(3));
    this.nextImgs = four.map(() => this.add.image(0, 0, cellKey(1)).setDisplaySize(PREVIEW_CELL, PREVIEW_CELL).setVisible(false).setDepth(6));
    const plugH = (PLUG_W - 1) / PLUG_RATIO;
    this.plugs = [];
    for (let y = 0; y < ROWS; y++) {
      for (const side of [0, 1]) {
        const x = side === 0 ? BOARD_X - PLUG_W / 2 : BOARD_X + COLS * CELL + PLUG_W / 2;
        this.plugs.push(this.add.image(x, cy(y), plugKey(1)).setDisplaySize(PLUG_W - 1, plugH).setFlipX(side === 0).setVisible(false).setDepth(4));
      }
    }
    this.danger = this.add.graphics().setDepth(1);
    this.flash = this.add.graphics().setDepth(8);
    this.pulse = this.add.graphics().setDepth(9);
    this.fx = this.add.graphics().setDepth(10);
    this.buildHud();
    this.buildBar();
    this.readyText = this.add
      .text(BOARD_X + (COLS * CELL) / 2, BOARD_Y + (ROWS * CELL) / 2 - 20, 'PRONTO?', {
        fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: COLORS.text, stroke: '#000000', strokeThickness: 4,
      })
      .setOrigin(0.5)
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
      // a repetição do teclado do sistema é ignorada: o jogo controla a sua (DAS_MS e ARR_MS)
      const press = (dir: number) => (e: KeyboardEvent) => {
        if (e.repeat) return;
        this.heldDir = dir;
        this.dasLeft = DAS_MS;
        this.tryMove(dir);
      };
      const release = (dir: number) => () => {
        if (this.heldDir === dir) this.heldDir = 0;
      };
      kb.on('keydown-LEFT', press(-1));
      kb.on('keydown-A', press(-1));
      kb.on('keydown-RIGHT', press(1));
      kb.on('keydown-D', press(1));
      kb.on('keyup-LEFT', release(-1));
      kb.on('keyup-A', release(-1));
      kb.on('keyup-RIGHT', release(1));
      kb.on('keyup-D', release(1));
      const turn = (dir: 1 | -1) => (e: KeyboardEvent) => {
        if (!e.repeat) this.tryRotate(dir);
      };
      kb.on('keydown-UP', turn(1));
      kb.on('keydown-W', turn(1));
      kb.on('keydown-X', turn(1));
      kb.on('keydown-Z', turn(-1));
      kb.on('keydown-SPACE', (e: KeyboardEvent) => {
        if (!e.repeat) this.tryHardDrop();
      });
      kb.on('keydown-DOWN', () => (this.softHeld = true));
      kb.on('keyup-DOWN', () => (this.softHeld = false));
      kb.on('keydown-S', () => (this.softHeld = true));
      kb.on('keyup-S', () => (this.softHeld = false));
    }

    // toque: arrastar para os lados move, tocar gira, arrastar para baixo acelera, deslizar rápido para baixo derruba
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.touchActive = true;
      this.touchStartX = this.touchAnchorX = p.worldX;
      this.touchStartY = p.worldY;
      this.touchStartT = this.time.now;
      this.touchMoved = false;
      this.touchHard = false;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.touchActive || !p.isDown || this.touchHard) return;
      while (Math.abs(p.worldX - this.touchAnchorX) >= SWIPE_STEP) {
        const dir = p.worldX > this.touchAnchorX ? 1 : -1;
        this.touchAnchorX += dir * SWIPE_STEP;
        this.touchMoved = true;
        this.tryMove(dir);
      }
      const dy = p.worldY - this.touchStartY;
      const dx = Math.abs(p.worldX - this.touchStartX);
      if (dy > HARD_PX && dy > dx * 1.5 && this.time.now - this.touchStartT < HARD_FAST_MS) {
        this.touchHard = true;
        this.touchMoved = true;
        this.softHeld = false;
        this.tryHardDrop();
      } else if (dy > SOFT_PX && dy > dx) {
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
      if (!this.touchMoved && this.time.now - this.touchStartT < TAP_MS) this.tryRotate(1);
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
  }

  private tryMove(dx: number): boolean {
    if (!this.canAct() || !moveH(this.state, dx)) return false;
    sfx('move');
    return true;
  }
  private tryRotate(dir: 1 | -1): void {
    if (this.canAct() && rotate(this.state, dir)) sfx('rotate');
  }
  private tryHardDrop(): void {
    if (!this.canAct()) return;
    const n = hardDrop(this.state);
    sfx('drop');
    if (n > 0) this.cameras.main.shake(70, 0.004);
    this.handleLock(lock(this.state));
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

    // seta para o lado segurada: repete o passo
    if (this.heldDir !== 0 && this.canAct()) {
      this.dasLeft -= delta;
      while (this.dasLeft <= 0) {
        this.dasLeft += ARR_MS;
        if (!this.tryMove(this.heldDir)) {
          this.dasLeft = Math.max(this.dasLeft, 0.001);
          break;
        }
      }
    }

    if (!this.busy && this.state.piece) {
      const r = gravity(this.state, delta, this.softHeld);
      if (r.locked) this.handleLock(r.locked);
    }
    this.render();
  }

  private handleLock(r: LockResult): void {
    if (r.cleared.length === 0) {
      sfx('land');
      this.disp = copy(this.state.board);
      if (!this.state.alive) this.finish('overflow');
      else this.nextPiece();
      return;
    }
    // linha completa: um aparelho se liga em cada ponta, o sinal corre pelo cabo e a linha some
    this.busy = true;
    this.softHeld = false;
    this.disp = copy(r.before);
    sfx('rotate');
    this.setExpression('happy', 1200);

    const w = COLS * CELL;
    const devices: Phaser.GameObjects.Image[] = [];
    for (const y of r.cleared) {
      for (const [key, x] of [[DEVICE_LEFT, DEVICE_X], [DEVICE_RIGHT, GAME_W - DEVICE_X]] as const) {
        const d = this.add.image(x, cy(y), key).setDepth(9).setScale(0);
        const scale = DEVICE_SIZE / d.width;
        devices.push(d);
        this.tweens.add({ targets: d, scale, duration: CONNECT_MS, ease: 'Back.easeOut' });
      }
    }
    const x0 = DEVICE_X;
    const x1 = GAME_W - DEVICE_X;
    // `done`: o último quadro do sinal pode chegar depois do fim da animação; sem a trava, o rastro ficava na tela
    const run = { t: 0, done: false };
    this.tweens.add({
      targets: run, t: 1, delay: CONNECT_MS, duration: PULSE_MS, ease: 'Sine.easeInOut',
      onStart: () => sfx('collect', r.cleared.length),
      onComplete: () => this.pulse.clear(),
      onUpdate: () => {
        if (run.done) return;
        const g = this.pulse;
        g.clear();
        const x = x0 + (x1 - x0) * run.t;
        for (const y of r.cleared) {
          g.fillStyle(0xffffff, 0.28).fillRect(x0, cy(y) - 3, x - x0, 6);
          g.fillStyle(0x9fe6ff, 0.5).fillCircle(x, cy(y), 7);
          g.fillStyle(0xffffff, 1).fillCircle(x, cy(y), 3.5);
        }
      },
    });

    this.time.delayedCall(CONNECT_MS + PULSE_MS, () => {
      run.done = true;
      this.pulse.clear();
      if (this.over) return;
      this.flash.clear();
      for (const y of r.cleared) this.flash.fillStyle(0xffffff, 1).fillRect(BOARD_X - PLUG_W, BOARD_Y + y * CELL, w + PLUG_W * 2, CELL);
      this.flash.setAlpha(0.9);
      this.tweens.add({ targets: this.flash, alpha: 0, duration: FLASH_MS });
      for (const y of r.cleared) {
        for (let x = 0; x < COLS; x++) if (Math.random() < 0.5) this.sparks.push(this.makeSpark(cx(x), cy(y), r.before[y]![x]!));
      }
      const midY = r.cleared.reduce((a, y) => a + cy(y), 0) / r.cleared.length;
      this.floatText(BOARD_X + w / 2, midY, `+${r.gain}`);
      if (r.cleared.length >= 2) this.bigText(r.cleared.length === 4 ? '4 CONEXÕES!' : `${r.cleared.length} CONEXÕES`, r.cleared.length);
      this.tweens.add({ targets: devices, alpha: 0, duration: FLASH_MS, onComplete: () => devices.forEach((d) => d.destroy()) });
      this.disp = copy(this.state.board);
      this.bumpCrate();
    });

    this.time.delayedCall(CONNECT_MS + PULSE_MS + FLASH_MS, () => {
      if (this.over) return;
      this.flash.clear();
      this.pulse.clear();
      this.busy = false;
      if (r.levelUp) this.showLevelUp(levelFor(this.state.lines));
      this.nextPiece();
    });
  }

  private nextPiece(): void {
    if (this.over) return;
    if (!spawn(this.state, this.rng)) this.finish('overflow');
  }

  // ---------- efeitos ----------

  private makeSpark(x: number, y: number, item: number): Spark {
    const a = Math.random() * Math.PI * 2;
    const v = 40 + Math.random() * 90;
    return {
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, r: 1.4 + Math.random() * 1.6,
      color: Math.random() < 0.5 ? 0xffffff : (ITEMS[item]?.cardDark ?? 0xffffff), life: 0, max: 380 + Math.random() * 220,
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
      .setDepth(12);
    this.tweens.add({ targets: t, y: y - 26, alpha: 0, duration: 800, onComplete: () => t.destroy() });
  }

  /** Aviso quando o jogador limpa 2 ou mais linhas de uma vez. */
  private bigText(text: string, n: number): void {
    const t = this.add
      .text(BOARD_X + (COLS * CELL) / 2, BOARD_Y + ROWS * CELL * 0.3, text, {
        fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: COLORS.gold, stroke: '#000000', strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setScale(0)
      .setDepth(14);
    this.tweens.add({ targets: t, scale: 1 + (n - 2) * 0.18, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, y: t.y - 16, delay: 650, duration: 300, onComplete: () => t.destroy() });
  }

  private showLevelUp(level: number): void {
    sfx('level');
    const t = this.add
      .text(BOARD_X + (COLS * CELL) / 2, BOARD_Y + ROWS * CELL * 0.45, `NÍVEL ${level}`, {
        fontFamily: FONT, fontSize: '30px', fontStyle: 'bold', color: COLORS.gold, stroke: '#000000', strokeThickness: 5,
      })
      .setOrigin(0.5)
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
    this.heldDir = 0;
    const s = this.state;
    s.alive = false;
    s.cause = cause;
    sfx('over');
    this.cameras.main.shake(260, 0.01);
    const expression: Expression = s.lines === 0 ? 'sad' : 'happy';
    this.setExpression(expression);

    const level = levelFor(s.lines);
    this.bridge.sendGameOver({
      runId: this.runId,
      score: s.score,
      durationMs: this.elapsed,
      meta: { lines: s.lines, level, quads: s.quads, cause },
    });

    const result = { score: s.score, lines: s.lines, level, cause, previousBest: loadBest(), expression };
    this.time.delayedCall(800, () => this.scene.start('GameOver', result));
  }

  // ---------- desenho ----------

  private drawShelf(): void {
    const g = this.add.graphics();
    const w = COLS * CELL;
    const h = ROWS * CELL;
    g.fillStyle(COLORS.shelf, 1).fillRoundedRect(BOARD_X - 2, BOARD_Y - 2, w + 4, h + 4, 4);
    g.lineStyle(1, COLORS.shelfLine, 1);
    for (let x = 1; x < COLS; x++) g.lineBetween(BOARD_X + x * CELL, BOARD_Y, BOARD_X + x * CELL, BOARD_Y + h);
    for (let y = 1; y < ROWS; y++) g.lineBetween(BOARD_X, BOARD_Y + y * CELL, BOARD_X + w, BOARD_Y + y * CELL);
    // paredes laterais com a "porta" de cada linha, onde o conector encaixa
    for (const x of [BOARD_X - 3, BOARD_X + w + 1]) {
      g.fillStyle(COLORS.rail, 1).fillRect(x, BOARD_Y - 3, 2, h + 6);
      for (let r = 0; r < ROWS; r++) g.fillStyle(COLORS.railLight, 1).fillRect(x, BOARD_Y + r * CELL + CELL / 2 - 3, 2, 6);
    }
    g.fillStyle(COLORS.rail, 1).fillRoundedRect(BOARD_X - 3, BOARD_Y + h + 2, w + 6, 3, 1.5);
    g.fillStyle(COLORS.hud, 1).fillRect(0, BAR_Y, GAME_W, GAME_H - BAR_Y);
  }

  private buildHud(): void {
    this.add.rectangle(GAME_W / 2, HUD_H / 2, GAME_W, HUD_H, COLORS.hud).setDepth(5);
    this.add.rectangle(GAME_W / 2, HUD_H - 0.5, GAME_W, 1, COLORS.flixRed).setDepth(5);
    this.portrait = this.add.image(32, HUD_H / 2 - 1, portraitKey('neutral')).setScale(1.75).setDepth(6);
    // placar de fliperama: fonte pixel branca com contorno escuro (mesma de todos os jogos Flix)
    hudText(this, 66, 3, 'PONTOS', 1).setDepth(6);
    this.scoreText = hudText(this, 65, 14, '0', 3).setDepth(6);
    // conexões feitas (linhas completas)
    hudText(this, STORE_X - 22, 3, 'CONEXÕES', 1).setDepth(6);
    this.crate = this.add.container(STORE_X - 8, STORE_Y + 4).setDepth(6);
    this.crate.add(this.add.image(0, 0, plugKey(6)).setDisplaySize(22, 22 / PLUG_RATIO));
    this.linesText = hudText(this, STORE_X + 7, 31, '0', 2).setOrigin(0, 0.5).setDepth(6);
    hudText(this, GAME_W - 6, 3, 'NÍVEL', 1).setOrigin(1, 0).setDepth(6);
    this.levelText = hudText(this, GAME_W - 5, 14, '1', 3).setOrigin(1, 0).setDepth(6);
  }

  /** Faixa de baixo: dicas dos controles à esquerda, próxima peça à direita. */
  private buildBar(): void {
    const style = { fontFamily: FONT, fontSize: '9px', color: COLORS.textMuted, lineSpacing: 3 };
    this.add.text(12, BAR_Y + 24, '← → mover   ↑ girar\n↓ descer   espaço: derrubar', style).setOrigin(0, 0.5).setDepth(6);
    hudText(this, PREVIEW_X - 32, BAR_Y + 24, 'PRÓXIMA', 1).setOrigin(1, 0.5).setDepth(6);
    const g = this.add.graphics().setDepth(5);
    g.fillStyle(COLORS.shelf, 1).fillRoundedRect(PREVIEW_X - 28, BAR_Y + 6, 56, 36, 5);
    g.lineStyle(1, COLORS.shelfLine, 1).strokeRoundedRect(PREVIEW_X - 28, BAR_Y + 6, 56, 36, 5);
  }

  private render(): void {
    const s = this.state;
    if (!this.busy && !this.over && this.readyLeft <= 0) this.disp = copy(s.board);
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const v = this.disp[y]?.[x] ?? 0;
        const img = this.cells[y * COLS + x]!;
        if (v === 0) img.setVisible(false);
        else img.setVisible(true).setTexture(cellKey(v));
      }
    }

    // conector do lado de fora de cada linha que tem cabo encostado na lateral
    for (let y = 0; y < ROWS; y++) {
      const row = this.disp[y]!;
      for (const side of [0, 1]) {
        const v = row[side === 0 ? 0 : COLS - 1] ?? 0;
        const plug = this.plugs[y * 2 + side]!;
        if (v === 0) plug.setVisible(false);
        else plug.setVisible(true).setTexture(plugKey(v));
      }
    }

    // peça que cai e sombra de aterrissagem (a parte acima da prateleira fica escondida)
    const p = s.piece;
    this.pieceImgs.forEach((i) => i.setVisible(false));
    this.ghostImgs.forEach((i) => i.setVisible(false));
    if (p && !this.over && !this.busy) {
      const gy = landingY(s);
      p.cells.forEach((c, i) => {
        const y = p.y + c.y;
        if (y >= 0) this.pieceImgs[i]!.setTexture(cellKey(c.item)).setPosition(cx(p.x + c.x), cy(y)).setVisible(true);
        if (gy > p.y && gy + c.y >= 0) this.ghostImgs[i]!.setTexture(cellKey(c.item)).setPosition(cx(p.x + c.x), cy(gy + c.y)).setVisible(true);
      });
    }

    // próxima peça, centralizada na caixa
    const n = s.next;
    const xs = n.cells.map((c) => c.x);
    const ys = n.cells.map((c) => c.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const nw = (Math.max(...xs) - minX + 1) * PREVIEW_CELL;
    const nh = (Math.max(...ys) - minY + 1) * PREVIEW_CELL;
    const left = PREVIEW_X - nw / 2;
    const top = BAR_Y + 24 - nh / 2;
    this.nextImgs.forEach((img, k) => {
      const c = n.cells[k]!;
      img
        .setTexture(cellKey(c.item))
        .setPosition(left + (c.x - minX) * PREVIEW_CELL + PREVIEW_CELL / 2, top + (c.y - minY) * PREVIEW_CELL + PREVIEW_CELL / 2)
        .setVisible(true);
    });

    // alerta: pilha chegando ao topo
    const dg = this.danger;
    dg.clear();
    let near = false;
    for (let y = 0; y < 4 && !near; y++) if (s.board[y]!.some((v) => v !== 0)) near = true;
    if (near && !this.over) {
      const a = 0.1 + 0.12 * (0.5 + 0.5 * Math.sin(this.time.now / 110));
      dg.fillStyle(0xff3b4e, a).fillRoundedRect(BOARD_X, BOARD_Y, COLS * CELL, CELL * 4, 4);
    }

    // HUD
    this.scoreText.setText(String(s.score));
    this.linesText.setText(String(s.lines));
    this.levelText.setText(String(levelFor(s.lines)));
  }
}
