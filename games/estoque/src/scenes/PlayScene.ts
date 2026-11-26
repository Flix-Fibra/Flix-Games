import Phaser from 'phaser';
import type { HubBridge } from '@flix/game-sdk';
import { BEAM_KEY, DEVICE_LEFT, DEVICE_RIGHT, DEVICE_SIZE, GLOW_KEY, PLUG_RATIO, cellKey, ghostKey, plugKey } from '../art';
import { sfx } from '../audio';
import {
  COLS, LINES_PER_LEVEL, MAX_LEVEL, ROWS, createState, gravity, hardDrop, landingY, levelFor, lock, moveH, mulberry32,
  rotate, spawn, type Board, type Cause, type GameState, type LockResult,
} from '../logic';
import { loadBest } from '../storage';
import { BAR_Y, BOARD_H, BOARD_W, BOARD_X, BOARD_Y, CELL, COLORS, DEVICE_X, GAME_H, GAME_W, ITEMS, PLUG_W } from '../theme';
import { fundo, painel, rotulo, texto } from '../ui';

const READY_MS = 900;
/** Segurar a seta para o lado: espera DAS_MS e então anda uma coluna a cada ARR_MS. */
const DAS_MS = 170;
const ARR_MS = 50;
const SWIPE_STEP = CELL * 1.1;
const SOFT_PX = 18;
const HARD_PX = 60;
const HARD_FAST_MS = 220;
const TAP_MS = 260;
/** Linha completa: um aparelho se liga em cada ponta (CONNECT_MS), o sinal corre pelo cabo (SWEEP_MS) e a linha some (FLASH_MS). */
const CONNECT_MS = 160;
const SWEEP_MS = 320;
const FLASH_MS = 200;
const PREVIEW_CELL = 9;
const PREVIEW_X = GAME_W - 44;
const SIZE = CELL;

interface Spark {
  img: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
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
  private fx!: Phaser.GameObjects.Graphics;
  private flash!: Phaser.GameObjects.Graphics;
  private danger!: Phaser.GameObjects.Graphics;
  private levelBar!: Phaser.GameObjects.Graphics;
  private scoreText!: Phaser.GameObjects.Text;
  private bestText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private linesText!: Phaser.GameObjects.Text;
  private readyText!: Phaser.GameObjects.Text;
  private sparks: Spark[] = [];
  private shownScore = 0;
  private best = 0;

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
    this.shownScore = 0;
    this.best = loadBest();
    this.disp = copy(this.state.board);

    fundo(this);
    this.cameras.main.fadeIn(200, 8, 11, 22);
    this.drawBoard();
    this.cells = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        this.cells.push(this.add.image(cx(x), cy(y), cellKey(1)).setDisplaySize(SIZE, SIZE).setVisible(false).setDepth(2));
      }
    }
    const four = [0, 1, 2, 3];
    this.ghostImgs = four.map(() => this.add.image(0, 0, ghostKey(1)).setDisplaySize(SIZE, SIZE).setVisible(false).setDepth(2));
    this.pieceImgs = four.map(() => this.add.image(0, 0, cellKey(1)).setDisplaySize(SIZE, SIZE).setVisible(false).setDepth(3));
    this.nextImgs = four.map(() => this.add.image(0, 0, cellKey(1)).setDisplaySize(PREVIEW_CELL, PREVIEW_CELL).setVisible(false).setDepth(6));
    const plugW = PLUG_W - 1;
    this.plugs = [];
    for (let y = 0; y < ROWS; y++) {
      for (const side of [0, 1]) {
        const x = side === 0 ? BOARD_X - PLUG_W / 2 - 1 : BOARD_X + BOARD_W + PLUG_W / 2 + 1;
        this.plugs.push(this.add.image(x, cy(y), plugKey(1)).setDisplaySize(plugW, plugW / PLUG_RATIO).setFlipX(side === 0).setVisible(false).setDepth(4));
      }
    }
    this.danger = this.add.graphics().setDepth(1);
    this.flash = this.add.graphics().setDepth(8);
    this.fx = this.add.graphics().setDepth(9).setBlendMode(Phaser.BlendModes.ADD);
    this.buildTop();
    this.buildBar();
    this.readyText = texto(this, BOARD_X + BOARD_W / 2, BOARD_Y + BOARD_H / 2 - 20, 'PRONTO?', { tam: 30, peso: '800', espaco: 2 })
      .setOrigin(0.5)
      .setDepth(15);
    this.readyText.setShadow(0, 4, 'rgba(0,0,0,0.6)', 12, false, true);

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
    const p = this.state.piece!;
    const from = p.cells.map((c) => ({ x: p.x + c.x, y: p.y + c.y, item: c.item }));
    const n = hardDrop(this.state);
    sfx('drop');
    if (n > 0) {
      this.trail(from, n);
      this.cameras.main.shake(70, 0.003);
    }
    this.handleLock(lock(this.state));
  }

  // ---------- laço ----------

  update(_time: number, rawDelta: number): void {
    const delta = Math.min(rawDelta, 100);
    this.advanceSparks(delta);
    if (this.over) {
      this.render(delta);
      return;
    }

    if (this.readyLeft > 0) {
      this.readyLeft -= delta;
      if (this.readyLeft <= 0) {
        this.tweens.add({ targets: this.readyText, alpha: 0, scale: 1.4, duration: 180, onComplete: () => this.readyText.setVisible(false) });
      } else if (this.readyLeft < READY_MS / 2 && this.readyText.text !== 'VAI!') {
        this.readyText.setText('VAI!').setColor(COLORS.flixRedText).setScale(0.6);
        this.tweens.add({ targets: this.readyText, scale: 1, duration: 160, ease: 'Back.easeOut' });
      }
      this.render(delta);
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
    this.render(delta);
  }

  private handleLock(r: LockResult): void {
    this.lockFlash(r);
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

    const devices: Phaser.GameObjects.Image[] = [];
    for (const y of r.cleared) {
      for (const [key, x] of [[DEVICE_LEFT, DEVICE_X], [DEVICE_RIGHT, GAME_W - DEVICE_X]] as const) {
        const d = this.add.image(x, cy(y), key).setDepth(9).setDisplaySize(DEVICE_SIZE, DEVICE_SIZE);
        const sx = d.scaleX;
        d.setScale(0);
        devices.push(d);
        this.tweens.add({ targets: d, scale: sx, duration: CONNECT_MS, ease: 'Back.easeOut' });
      }
    }
    const beams: Phaser.GameObjects.Image[] = [];
    for (const y of r.cleared) {
      const b = this.add
        .image(DEVICE_X, cy(y), BEAM_KEY)
        .setDisplaySize(80, CELL * 1.6)
        .setOrigin(1, 0.5)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0)
        .setDepth(10);
      beams.push(b);
    }
    this.tweens.add({
      targets: beams, x: GAME_W - DEVICE_X + 20, alpha: 1, delay: CONNECT_MS, duration: SWEEP_MS, ease: 'Sine.easeInOut',
      onStart: () => sfx('collect', r.cleared.length),
    });
    const glow = { a: 0 };
    this.tweens.add({
      targets: glow, a: 0.5, delay: CONNECT_MS, duration: SWEEP_MS, ease: 'Quad.easeIn',
      onUpdate: () => {
        this.flash.clear();
        for (const y of r.cleared) this.flash.fillStyle(0xffffff, glow.a).fillRoundedRect(BOARD_X, BOARD_Y + y * CELL, BOARD_W, CELL, 4);
      },
    });

    this.time.delayedCall(CONNECT_MS + SWEEP_MS, () => {
      beams.forEach((b) => b.destroy());
      if (this.over) return;
      this.flash.clear();
      for (const y of r.cleared) this.flash.fillStyle(0xffffff, 1).fillRoundedRect(BOARD_X - PLUG_W, BOARD_Y + y * CELL, BOARD_W + PLUG_W * 2, CELL, 5);
      this.flash.setAlpha(1);
      this.tweens.add({ targets: this.flash, alpha: 0, duration: FLASH_MS });
      for (const y of r.cleared) {
        for (let x = 0; x < COLS; x++) {
          const item = r.before[y]![x]!;
          for (let k = 0; k < 2; k++) this.spark(cx(x), cy(y), ITEMS[item]?.hex ?? 0xffffff);
        }
      }
      const midY = r.cleared.reduce((a, y) => a + cy(y), 0) / r.cleared.length;
      this.floatText(BOARD_X + BOARD_W / 2, midY, `+${r.gain.toLocaleString('pt-BR')}`);
      if (r.cleared.length >= 2) this.bigText(r.cleared.length === 4 ? '4 CONEXÕES!' : `${r.cleared.length} CONEXÕES`, r.cleared.length);
      this.cameras.main.shake(90 + r.cleared.length * 30, 0.002 + r.cleared.length * 0.0012);
      this.tweens.add({ targets: devices, alpha: 0, duration: FLASH_MS, onComplete: () => devices.forEach((d) => d.destroy()) });
      this.disp = copy(this.state.board);
      this.pop(this.linesText);
    });

    this.time.delayedCall(CONNECT_MS + SWEEP_MS + FLASH_MS, () => {
      if (this.over) return;
      this.flash.clear().setAlpha(1);
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

  /** Brilho rápido nas células da peça que acabou de travar. */
  private lockFlash(r: LockResult): void {
    const g = this.add.graphics().setDepth(7);
    for (const c of r.placed) {
      if (c.y >= 0) g.fillStyle(0xffffff, 1).fillRoundedRect(BOARD_X + c.x * CELL + 1, BOARD_Y + c.y * CELL + 1, CELL - 2, CELL - 2, 4);
    }
    g.setAlpha(0.45);
    this.tweens.add({ targets: g, alpha: 0, duration: 160, onComplete: () => g.destroy() });
  }

  /** Rastro de luz da peça derrubada de uma vez. */
  private trail(from: { x: number; y: number; item: number }[], n: number): void {
    const g = this.add.graphics().setDepth(1).setBlendMode(Phaser.BlendModes.ADD);
    const cols = new Map<number, { top: number; item: number }>();
    for (const c of from) {
      const cur = cols.get(c.x);
      if (!cur || c.y < cur.top) cols.set(c.x, { top: c.y, item: c.item });
    }
    for (const [x, { top, item }] of cols) {
      const y0 = BOARD_Y + Math.max(0, top) * CELL;
      const y1 = BOARD_Y + (top + n) * CELL;
      if (y1 <= y0) continue;
      const cor = ITEMS[item]?.hex ?? 0xffffff;
      g.fillGradientStyle(cor, cor, cor, cor, 0, 0, 0.35, 0.35).fillRect(BOARD_X + x * CELL + 2, y0, CELL - 4, y1 - y0);
    }
    this.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
  }

  private spark(x: number, y: number, color: number): void {
    const a = Math.random() * Math.PI * 2;
    const v = 50 + Math.random() * 120;
    const size = 5 + Math.random() * 7;
    const img = this.add
      .image(x, y, GLOW_KEY)
      .setDisplaySize(size, size)
      .setTint(Math.random() < 0.35 ? 0xffffff : color)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(11);
    this.sparks.push({ img, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 50, life: 0, max: 420 + Math.random() * 300, size });
  }

  private advanceSparks(dt: number): void {
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i]!;
      s.life += dt;
      if (s.life >= s.max) {
        s.img.destroy();
        this.sparks.splice(i, 1);
        continue;
      }
      s.vy += 280 * (dt / 1000);
      s.vx *= 0.985;
      s.img.x += s.vx * (dt / 1000);
      s.img.y += s.vy * (dt / 1000);
      const k = 1 - s.life / s.max;
      s.img.setAlpha(k).setDisplaySize(s.size * (0.4 + 0.6 * k), s.size * (0.4 + 0.6 * k));
    }
  }

  private pop(t: Phaser.GameObjects.Text): void {
    this.tweens.add({ targets: t, scale: 1.25, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
  }

  private floatText(x: number, y: number, text: string): void {
    const t = texto(this, x, y, text, { tam: 16, peso: '800', cor: COLORS.gold }).setOrigin(0.5).setDepth(12);
    t.setShadow(0, 2, 'rgba(0,0,0,0.7)', 6, false, true);
    this.tweens.add({ targets: t, y: y - 30, alpha: 0, duration: 900, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
  }

  /** Aviso quando o jogador limpa 2 ou mais linhas de uma vez. */
  private bigText(text: string, n: number): void {
    const t = texto(this, BOARD_X + BOARD_W / 2, BOARD_Y + BOARD_H * 0.3, text, { tam: n === 4 ? 19 : 17, peso: '800', espaco: 0.5, cor: COLORS.gold })
      .setOrigin(0.5)
      .setScale(0)
      .setDepth(14);
    t.setShadow(0, 3, 'rgba(0,0,0,0.7)', 10, false, true);
    this.tweens.add({ targets: t, scale: 1, duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, y: t.y - 16, delay: 700, duration: 300, onComplete: () => t.destroy() });
  }

  private showLevelUp(level: number): void {
    sfx('level');
    this.pop(this.levelText);
    const t = texto(this, BOARD_X + BOARD_W / 2, BOARD_Y + BOARD_H * 0.45, `NÍVEL ${level}`, { tam: 30, peso: '800', espaco: 2 })
      .setOrigin(0.5)
      .setScale(0)
      .setDepth(14);
    t.setShadow(0, 4, 'rgba(229,23,63,0.8)', 16, false, true);
    this.tweens.add({ targets: t, scale: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, delay: 900, duration: 350, onComplete: () => t.destroy() });
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
    this.cameras.main.shake(260, 0.008);

    // as peças paradas apagam de baixo para cima
    for (let y = ROWS - 1; y >= 0; y--) {
      for (let x = 0; x < COLS; x++) {
        const img = this.cells[y * COLS + x]!;
        if (img.visible) this.tweens.add({ targets: img, alpha: 0.18, delay: (ROWS - 1 - y) * 25, duration: 200 });
      }
    }

    const level = levelFor(s.lines);
    this.bridge.sendGameOver({
      runId: this.runId,
      score: s.score,
      durationMs: this.elapsed,
      meta: { lines: s.lines, level, quads: s.quads, cause },
    });

    const result = { score: s.score, lines: s.lines, level, cause, previousBest: loadBest() };
    this.time.delayedCall(1000, () => {
      this.cameras.main.fadeOut(200, 8, 11, 22);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('GameOver', result));
    });
  }

  // ---------- desenho ----------

  private drawBoard(): void {
    const g = this.add.graphics().setDepth(0);
    // sombra e painel de vidro
    g.fillStyle(0x000000, 0.35).fillRoundedRect(BOARD_X - 5, BOARD_Y - 3, BOARD_W + 10, BOARD_H + 10, 12);
    painel(g, BOARD_X - 5, BOARD_Y - 5, BOARD_W + 10, BOARD_H + 10, 12);
    // paredes laterais com a "porta" de cada linha, onde o conector encaixa
    for (const x of [BOARD_X - 5, BOARD_X + BOARD_W + 3]) {
      for (let r = 0; r < ROWS; r++) g.fillStyle(0xffffff, 0.1).fillRoundedRect(x, BOARD_Y + r * CELL + CELL / 2 - 3, 2, 6, 1);
    }
    // pontinhos nos cruzamentos da grade (mais limpo que linhas)
    g.fillStyle(COLORS.grid, 0.09);
    for (let y = 1; y < ROWS; y++) for (let x = 1; x < COLS; x++) g.fillCircle(BOARD_X + x * CELL, BOARD_Y + y * CELL, 0.8);
  }

  private buildTop(): void {
    const g = this.add.graphics().setDepth(4);
    painel(g, 8, 8, GAME_W - 16, 52, 12);
    rotulo(this, 20, 17, 'PONTOS').setDepth(5);
    this.scoreText = texto(this, 19, 27, '0', { tam: 22, peso: '800' }).setDepth(5);
    // conexões feitas (linhas completas), com um conector ao lado
    const mx = 160;
    rotulo(this, mx, 17, 'CONEXÕES').setOrigin(0.5, 0).setDepth(5);
    this.add.image(mx - 13, 40, plugKey(6)).setDisplaySize(20, 20 / PLUG_RATIO).setDepth(5);
    this.linesText = texto(this, mx + 3, 40, '0', { tam: 18, peso: '800' }).setOrigin(0, 0.5).setDepth(5);
    rotulo(this, GAME_W - 20, 17, 'NÍVEL').setOrigin(1, 0).setDepth(5);
    this.levelText = texto(this, GAME_W - 20, 25, '1', { tam: 18, peso: '800' }).setOrigin(1, 0).setDepth(5);
    this.levelBar = this.add.graphics().setDepth(5);
  }

  /** Faixa de baixo: recorde à esquerda, próxima peça à direita. */
  private buildBar(): void {
    const g = this.add.graphics().setDepth(4);
    painel(g, 8, BAR_Y, GAME_W - 16, GAME_H - BAR_Y - 8, 12);
    rotulo(this, 20, BAR_Y + 9, 'RECORDE').setDepth(5);
    this.bestText = texto(this, 19, BAR_Y + 19, this.best > 0 ? this.best.toLocaleString('pt-BR') : '—', { tam: 14, peso: '800', cor: COLORS.textMuted }).setDepth(5);
    rotulo(this, PREVIEW_X - 30, BAR_Y + 18, 'PRÓXIMA').setOrigin(1, 0.5).setDepth(5);
    g.fillStyle(0xffffff, 0.05).fillRoundedRect(PREVIEW_X - 26, BAR_Y + 5, 52, 26, 7);
  }

  private render(delta: number): void {
    const s = this.state;
    if (!this.busy && !this.over && this.readyLeft <= 0) this.disp = copy(s.board);
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const v = this.disp[y]?.[x] ?? 0;
        const img = this.cells[y * COLS + x]!;
        if (v === 0) img.setVisible(false);
        else if (!img.visible || img.texture.key !== cellKey(v)) img.setVisible(true).setTexture(cellKey(v));
      }
    }

    // conector do lado de fora de cada linha que tem cabo encostado na lateral
    for (let y = 0; y < ROWS; y++) {
      const row = this.disp[y]!;
      for (const side of [0, 1]) {
        const v = row[side === 0 ? 0 : COLS - 1] ?? 0;
        const plug = this.plugs[y * 2 + side]!;
        if (v === 0) plug.setVisible(false);
        else if (!plug.visible || plug.texture.key !== plugKey(v)) plug.setVisible(true).setTexture(plugKey(v));
      }
    }

    // peça que cai e sombra de aterrissagem (a parte acima do tabuleiro fica escondida)
    const p = s.piece;
    this.pieceImgs.forEach((i) => i.setVisible(false));
    this.ghostImgs.forEach((i) => i.setVisible(false));
    if (p && !this.over && !this.busy) {
      const gy = landingY(s);
      p.cells.forEach((c, i) => {
        const y = p.y + c.y;
        if (y >= 0) this.pieceImgs[i]!.setTexture(cellKey(c.item)).setPosition(cx(p.x + c.x), cy(y)).setVisible(true);
        if (gy > p.y && gy + c.y >= 0) this.ghostImgs[i]!.setTexture(ghostKey(c.item)).setPosition(cx(p.x + c.x), cy(gy + c.y)).setVisible(true);
      });
    }

    // próxima peça, centralizada no cartão
    const n = s.next;
    const xs = n.cells.map((c) => c.x);
    const ys = n.cells.map((c) => c.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const nw = (Math.max(...xs) - minX + 1) * PREVIEW_CELL;
    const nh = (Math.max(...ys) - minY + 1) * PREVIEW_CELL;
    const left = PREVIEW_X - nw / 2;
    const top = BAR_Y + 18 - nh / 2;
    this.nextImgs.forEach((img, k) => {
      const c = n.cells[k]!;
      img
        .setTexture(cellKey(c.item))
        .setPosition(left + (c.x - minX) * PREVIEW_CELL + PREVIEW_CELL / 2, top + (c.y - minY) * PREVIEW_CELL + PREVIEW_CELL / 2)
        .setVisible(true);
    });

    // alerta: pilha chegando ao topo (luz vermelha pulsando no alto do tabuleiro)
    const dg = this.danger;
    dg.clear();
    let near = false;
    for (let y = 0; y < 4 && !near; y++) if (s.board[y]!.some((v) => v !== 0)) near = true;
    if (near && !this.over) {
      const a = 0.18 + 0.16 * (0.5 + 0.5 * Math.sin(this.time.now / 120));
      dg.fillGradientStyle(COLORS.danger, COLORS.danger, COLORS.danger, COLORS.danger, a, a, 0, 0).fillRect(BOARD_X, BOARD_Y, BOARD_W, CELL * 5);
    }

    // placar: os pontos sobem contando, não pulam
    if (this.shownScore !== s.score) {
      const diff = s.score - this.shownScore;
      this.shownScore = diff > 0 ? Math.min(s.score, this.shownScore + Math.max(1, Math.ceil(diff * Math.min(1, delta / 120)))) : s.score;
      this.scoreText.setText(this.shownScore.toLocaleString('pt-BR'));
      if (s.score > this.best && this.best > 0) this.bestText.setText(s.score.toLocaleString('pt-BR')).setColor(COLORS.gold);
    }
    const level = levelFor(s.lines);
    this.levelText.setText(String(level));
    this.linesText.setText(String(s.lines));

    // barra de progresso até o próximo nível
    const prog = level >= MAX_LEVEL ? 1 : (s.lines % LINES_PER_LEVEL) / LINES_PER_LEVEL;
    const bw = 34;
    const bx = GAME_W - 20 - bw;
    const by = 50;
    this.levelBar.clear();
    this.levelBar.fillStyle(0xffffff, 0.08).fillRoundedRect(bx, by, bw, 4, 2);
    if (prog > 0) this.levelBar.fillStyle(COLORS.flixRed, 1).fillRoundedRect(bx, by, Math.max(4, bw * prog), 4, 2);
  }
}
