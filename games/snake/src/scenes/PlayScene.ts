import Phaser from 'phaser';
import type { Expression } from '@flix/avatar';
import type { HubBridge } from '@flix/game-sdk';
import { sfx } from '../audio';
import {
  COLS, ROUND_MS, ROWS, createState, enqueueDir, levelFor, mulberry32, step, tickMs, type Cause, type Dir, type GameState, type Pt,
} from '../logic';
import { endDirection, lerp, mixColor, roundedPath, type V } from '../cablePath';
import { buildGlobe } from '../globeArt';
import { PLUG_MINI, buildPlug, renderPixelText, spriteToCanvas } from '@flix/game-kit';
import { loadBest } from '../storage';
import { CABLE_BLUE, CABLE_BLUE_PALETTE, CELL, COLORS, FIELD_X, FIELD_Y, FONT, GAME_H, GAME_W, HUD_H } from '../theme';
import { portraitKey } from './BootScene';

const READY_MS = 800;
const SWIPE_PX = 14;
const CABLE_W = 9;
const WAVE_MS = 700;
const WAVE_BLOCK = 6;
const WAVE_MAX_R = 340;
const LEVEL_TEXT_DELAY_MS = 380;
const PLUG_TIP_PX = 10; // quanto a ponta do conector passa do centro da casa da cabeça

interface Wave {
  x: number;
  y: number;
  t: number;
}

const cellX = (x: number): number => FIELD_X + x * CELL;
const cellY = (y: number): number => FIELD_Y + y * CELL;

export class PlayScene extends Phaser.Scene {
  private state!: GameState;
  private bridge!: HubBridge;
  private runId = '';
  private elapsed = 0;
  private acc = 0;
  private readyLeft = READY_MS;
  private over = false;
  private startedSent = false;
  private steps = 0;
  private fx!: Phaser.GameObjects.Graphics;
  private waves: Wave[] = [];
  private lastLevel = 1;
  private plugsHead: Phaser.GameObjects.Image[] = [];
  private plugsTail: Phaser.GameObjects.Image[] = [];
  private signalImg!: Phaser.GameObjects.Image;

  private g!: Phaser.GameObjects.Graphics;
  private portrait!: Phaser.GameObjects.Image;
  private scoreText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private boostText!: Phaser.GameObjects.Text;
  private readyText!: Phaser.GameObjects.Text;
  private cableColor: number = CABLE_BLUE.base;
  private cableShade: number = CABLE_BLUE.shade;
  private expressionTimer?: Phaser.Time.TimerEvent;

  private swipeX = 0;
  private swipeY = 0;
  private tracking = false;

  constructor() {
    super('Play');
  }

  create(): void {
    this.bridge = this.registry.get('bridge') as HubBridge;

    this.state = createState(mulberry32(Math.floor(Math.random() * 2 ** 32)));
    this.runId = this.bridge.newRunId();
    this.elapsed = 0;
    this.acc = 0;
    this.readyLeft = READY_MS;
    this.over = false;
    this.startedSent = false;
    this.steps = 0;
    this.tracking = false;

    this.cameras.main.setBackgroundColor(COLORS.background);
    this.drawStaticField();
    this.g = this.add.graphics();
    this.buildHud();
    this.waves = [];
    this.lastLevel = 1;
    this.fx = this.add.graphics().setDepth(10);
    const plugSprite = buildPlug(PLUG_MINI, CABLE_BLUE_PALETTE);
    if (!this.textures.exists('plug_mini')) this.textures.addCanvas('plug_mini', spriteToCanvas(plugSprite));
    if (!this.textures.exists('globe')) this.textures.addCanvas('globe', spriteToCanvas(buildGlobe()));
    this.signalImg = this.add.image(0, 0, 'globe').setVisible(false).setDepth(1);
    // o cabo e o conector são recortados pelo campo: assim aparecem saindo por um lado e entrando pelo outro
    const maskShape = this.make.graphics({ x: 0, y: 0 }, false);
    maskShape.fillStyle(0xffffff, 1).fillRect(FIELD_X, FIELD_Y, COLS * CELL, ROWS * CELL);
    const fieldMask = maskShape.createGeometryMask();
    this.g.setMask(fieldMask);
    this.plugsHead = [];
    this.plugsTail = [];
    for (const pool of [this.plugsHead, this.plugsTail]) {
      for (let i = 0; i < 4; i++) {
        const img = this.add.image(0, 0, 'plug_mini').setOrigin(0.5, (PLUG_TIP_PX + 0.5) / plugSprite.h).setDepth(2).setVisible(false);
        img.setMask(fieldMask);
        pool.push(img);
      }
    }
    this.readyText = this.add
      .text(GAME_W / 2, FIELD_Y + (ROWS * CELL) / 2 - 30, 'PRONTO?', {
        fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: COLORS.text,
      })
      .setOrigin(0.5)
      .setResolution(2);

    this.bridge.sendStarted(this.runId);
    this.startedSent = true;

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.swipeX = p.x;
      this.swipeY = p.y;
      this.tracking = true;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.tracking || !p.isDown) return;
      const dx = p.x - this.swipeX;
      const dy = p.y - this.swipeY;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return;
      this.turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
      this.swipeX = p.x;
      this.swipeY = p.y;
    });
    this.input.on('pointerup', () => {
      this.tracking = false;
    });

    const kb = this.input.keyboard;
    if (kb) {
      const bind = (code: string, dir: Dir) => kb.on(`keydown-${code}`, () => this.turn(dir));
      bind('UP', 'up'); bind('W', 'up');
      bind('DOWN', 'down'); bind('S', 'down');
      bind('LEFT', 'left'); bind('A', 'left');
      bind('RIGHT', 'right'); bind('D', 'right');
    }

    this.events.once('shutdown', () => {
      this.input.removeAllListeners();
      this.input.keyboard?.removeAllListeners();
    });
  }

  private turn(dir: Dir): void {
    if (this.over) return;
    if (enqueueDir(this.state, dir)) sfx('turn');
  }

  update(_time: number, rawDelta: number): void {
    const delta = Math.min(rawDelta, 100);
    this.advanceWaves(delta);
    if (this.over) return;

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

    this.acc += delta;
    let guard = 0;
    while (!this.over && this.acc >= tickMs(levelFor(this.state.houses)) && guard++ < 4) {
      this.acc -= tickMs(levelFor(this.state.houses));
      step(this.state, Math.random);
      this.steps++;
      this.handleEvent();
      if (!this.state.alive) {
        this.finish(this.state.cause ?? 'self');
        break;
      }
    }
    this.render();
  }

  private handleEvent(): void {
    const s = this.state;
    if (s.lastEvent === 'house') {
      sfx('house');
      this.setExpression('happy', 600);
      const head = s.snake[0];
      if (head) {
        this.floatText(cellX(head.x) + CELL / 2, cellY(head.y), `+${s.lastGain}`);
        this.spawnWave(cellX(head.x) + CELL / 2, cellY(head.y) + CELL / 2);
      }
      const level = levelFor(s.houses);
      if (level > this.lastLevel) {
        this.lastLevel = level;
        this.showLevelUp(level);
      }
    } else if (s.lastEvent === 'signal') {
      sfx('signal');
      this.setExpression('happy', 600);
    }
  }

  private floatText(x: number, y: number, text: string): void {
    const t = this.add
      .text(x, y, text, { fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: COLORS.gold })
      .setOrigin(0.5)
      .setResolution(2);
    this.tweens.add({ targets: t, y: y - 22, alpha: 0, duration: 700, onComplete: () => t.destroy() });
  }

  private setExpression(expr: Expression, resetMs?: number): void {
    this.portrait.setTexture(portraitKey(expr));
    this.expressionTimer?.remove(false);
    if (resetMs) {
      this.expressionTimer = this.time.delayedCall(resetMs, () => this.portrait.setTexture(portraitKey('neutral')));
    }
  }

  private finish(cause: Cause): void {
    if (this.over) return;
    this.over = true;
    const s = this.state;
    s.alive = false;
    s.cause = cause;
    const crashed = cause !== 'timeout';
    sfx(crashed ? 'crash' : 'end');
    if (crashed) this.cameras.main.shake(250, 0.01);
    this.setExpression(crashed || s.houses === 0 ? 'sad' : 'happy');

    this.bridge.sendGameOver({
      runId: this.runId,
      score: s.score,
      durationMs: this.elapsed,
      meta: { houses: s.houses, level: levelFor(s.houses), cause },
    });

    const result = { score: s.score, houses: s.houses, cause, previousBest: loadBest(), expression: crashed || s.houses === 0 ? 'sad' : 'happy' };
    this.time.delayedCall(crashed ? 750 : 400, () => this.scene.start('GameOver', result));
  }

  // ---------- efeitos ----------

  /** Onda vermelha em pixels que se espalha a partir da casa conectada. */
  private spawnWave(x: number, y: number): void {
    this.waves.push({ x, y, t: 0 });
  }

  private advanceWaves(dt: number): void {
    const g = this.fx;
    g.clear();
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i]!;
      w.t += dt;
      const k = w.t / WAVE_MS;
      if (k >= 1) {
        this.waves.splice(i, 1);
        continue;
      }
      const eased = 1 - (1 - k) * (1 - k);
      const r = eased * WAVE_MAX_R;
      const thick = 26 - k * 10;
      const fade = 0.85 * (1 - k);
      const x0 = Math.max(0, Math.floor((w.x - r) / WAVE_BLOCK));
      const x1 = Math.min(Math.ceil(GAME_W / WAVE_BLOCK), Math.ceil((w.x + r) / WAVE_BLOCK));
      const y0 = Math.max(0, Math.floor((w.y - r) / WAVE_BLOCK));
      const y1 = Math.min(Math.ceil(GAME_H / WAVE_BLOCK), Math.ceil((w.y + r) / WAVE_BLOCK));
      for (let by = y0; by < y1; by++) {
        for (let bx = x0; bx < x1; bx++) {
          const d = Math.hypot(bx * WAVE_BLOCK + WAVE_BLOCK / 2 - w.x, by * WAVE_BLOCK + WAVE_BLOCK / 2 - w.y);
          if (d > r || d <= r - thick) continue;
          const band = (r - d) / thick; // 0 na frente da onda, 1 na parte de trás
          const color = band < 0.25 ? 0xff6b78 : band < 0.6 ? 0xd4142c : 0x7a0412;
          g.fillStyle(color, fade * (1 - band * 0.6));
          g.fillRect(bx * WAVE_BLOCK, by * WAVE_BLOCK, WAVE_BLOCK, WAVE_BLOCK);
        }
      }
    }
  }

  /** "LEVEL UP" em pixel art e o novo nível logo abaixo. */
  private showLevelUp(level: number): void {
    const upKey = 'pixel_levelup';
    const lvKey = `pixel_level_${level}`;
    if (!this.textures.exists(upKey)) this.textures.addCanvas(upKey, renderPixelText('LEVEL UP', { arrow: true }));
    if (!this.textures.exists(lvKey)) this.textures.addCanvas(lvKey, renderPixelText(`NÍVEL ${level}`));

    const cx = GAME_W / 2;
    const cy = FIELD_Y + ROWS * CELL * 0.3;
    const up = this.add.image(cx, cy, upKey).setScale(0).setDepth(11);
    const lv = this.add.image(cx, cy + 36, lvKey).setScale(0).setDepth(11);
    sfx('level');

    this.tweens.add({
      targets: up,
      scale: 3,
      delay: LEVEL_TEXT_DELAY_MS,
      duration: 260,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: [up, lv],
          alpha: 0,
          y: '-=14',
          delay: 950,
          duration: 350,
          onComplete: () => {
            up.destroy();
            lv.destroy();
          },
        });
      },
    });
    this.tweens.add({ targets: lv, scale: 2, delay: LEVEL_TEXT_DELAY_MS + 150, duration: 240, ease: 'Back.easeOut' });
  }

  // ---------- desenho ----------

  private drawStaticField(): void {
    const g = this.add.graphics();
    g.fillStyle(COLORS.field, 1);
    g.fillRect(FIELD_X, FIELD_Y, COLS * CELL, ROWS * CELL);
    g.fillStyle(COLORS.fieldDot, 1);
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) g.fillRect(cellX(x) + 7, cellY(y) + 7, 1, 1);
    }
  }

  private buildHud(): void {
    this.add.rectangle(GAME_W / 2, HUD_H / 2, GAME_W, HUD_H, COLORS.hud);
    this.add.rectangle(GAME_W / 2, HUD_H - 0.5, GAME_W, 1, COLORS.flixRed);
    this.portrait = this.add.image(34, HUD_H / 2, portraitKey('neutral')).setScale(2);
    const label = { fontFamily: FONT, fontSize: '9px', color: COLORS.textMuted };
    this.add.text(74, 8, 'PONTOS', label).setResolution(2);
    this.scoreText = this.add
      .text(74, 20, '0', { fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: COLORS.text })
      .setResolution(2);
    this.boostText = this.add
      .text(74, 49, '', { fontFamily: FONT, fontSize: '10px', fontStyle: 'bold', color: '#35C8FF' })
      .setResolution(2);
    this.add.text(GAME_W - 8, 8, 'TEMPO', label).setOrigin(1, 0).setResolution(2);
    this.timeText = this.add
      .text(GAME_W - 8, 20, '2:00', { fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: COLORS.text })
      .setOrigin(1, 0)
      .setResolution(2);
    this.levelText = this.add
      .text(GAME_W - 8, 49, 'NÍVEL 1', { fontFamily: FONT, fontSize: '10px', color: COLORS.textMuted })
      .setOrigin(1, 0)
      .setResolution(2);
  }

  private render(): void {
    const s = this.state;
    const g = this.g;
    g.clear();

    // obras
    for (const o of s.obstacles) this.drawCone(o);
    // sinal
    this.updateSignal();
    // casa
    this.drawHouse(s.house);
    // cabo
    this.drawCable();

    // HUD
    this.scoreText.setText(String(s.score));
    const remaining = Math.max(0, ROUND_MS - this.elapsed);
    const sec = Math.ceil(remaining / 1000);
    this.timeText.setText(`${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`);
    this.timeText.setColor(sec <= 10 ? COLORS.flixRedText : COLORS.text);
    this.levelText.setText(`NÍVEL ${levelFor(s.houses)}`);
    this.boostText.setText(s.boostLeft > 0 ? 'SINAL x2' : '');
  }

  private drawCone(p: Pt): void {
    const g = this.g;
    const x = cellX(p.x);
    const y = cellY(p.y);
    g.fillStyle(COLORS.coneOrange, 1);
    g.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
    g.fillStyle(COLORS.coneStripe, 1);
    g.fillRect(x + 2, y + 6, CELL - 4, 3);
    g.fillStyle(COLORS.cableOutline, 1);
    g.fillRect(x + 1, y + CELL - 3, CELL - 2, 2);
  }

  private drawHouse(p: Pt): void {
    const g = this.g;
    const x = cellX(p.x);
    const y = cellY(p.y);
    const pulse = 1 + Math.sin(this.time.now / 180) * 0.6;
    g.fillStyle(COLORS.houseWall, 1);
    g.fillRect(x + 2, y + 7, CELL - 4, CELL - 8);
    g.fillStyle(COLORS.houseRoof, 1);
    g.fillTriangle(x + 1, y + 8, x + CELL - 1, y + 8, x + CELL / 2, y + 1 - pulse * 0.2);
    g.fillStyle(COLORS.houseDoor, 1);
    g.fillRect(x + 6, y + 10, 3, 4);
  }

  /** Mostra o globo (bônus de sinal) na casa do sinal, com leve flutuação; pisca quando está para sumir. */
  private updateSignal(): void {
    const s = this.state;
    const sig = s.signal;
    const blink = sig !== null && s.signalLeft < 12 && Math.floor(this.time.now / 150) % 2 === 0;
    if (!sig || blink) {
      this.signalImg.setVisible(false);
      return;
    }
    const bob = Math.round(Math.sin(this.time.now / 200));
    this.signalImg.setPosition(cellX(sig.x) + CELL / 2, cellY(sig.y) + CELL / 2 + bob).setVisible(true);
  }

  /**
   * Desenha o cabo de rede: tubo brilhante (contorno, sombra, cor, brilho e reflexo), com a mesma espessura dos dois lados,
   * com um conector RJ45 em cada ponta. A lógica anda de casa em casa, mas aqui a cabeça desliza e a ponta recua
   * entre um passo e o seguinte (progresso `p` de 0 a 1), e o cabo é uma linha contínua com curvas.
   * Quando o cabo atravessa a borda da tela, ele é desenhado "desenrolado" e repetido do lado oposto
   * (recortado pela máscara do campo), então aparece saindo por um lado e entrando pelo outro ao mesmo tempo.
   */
  private drawCable(): void {
    const g = this.g;
    const s = this.state;
    const snake = s.snake;
    const head = snake[0];
    if (!head) return;

    const tick = tickMs(levelFor(s.houses));
    const p = this.steps === 0 || !s.alive || this.readyLeft > 0 ? 1 : Phaser.Math.Clamp(this.acc / tick, 0, 1);
    const center = (c: Pt): V => ({ x: FIELD_X + c.x * CELL + CELL / 2, y: FIELD_Y + c.y * CELL + CELL / 2 });
    const unwrap = (d: number, size: number): number => (d > size / 2 ? d - size : d < -size / 2 ? d + size : d);

    // casas "desenroladas": contínuas mesmo quando o cabo cruza a borda
    const cells: Pt[] = [{ x: head.x, y: head.y }];
    for (let i = 1; i < snake.length; i++) {
      const prev = cells[i - 1]!;
      const a = snake[i - 1]!;
      const b = snake[i]!;
      cells.push({ x: prev.x + unwrap(b.x - a.x, COLS), y: prev.y + unwrap(b.y - a.y, ROWS) });
    }

    // vértices do cabo, da cabeça até a ponta
    const points: V[] = [];
    const h = center(cells[0]!);
    if (cells[1] && p < 1) {
      const from = center(cells[1]);
      points.push({ x: lerp(from.x, h.x, p), y: lerp(from.y, h.y, p) });
    } else {
      points.push(h);
    }
    for (let i = 1; i < cells.length; i++) points.push(center(cells[i]!));
    if (s.prevTail && p < 1 && snake.length > 1) {
      const last = snake[snake.length - 1]!;
      const lc = cells[cells.length - 1]!;
      const end = center(lc);
      const old = center({ x: lc.x + unwrap(s.prevTail.x - last.x, COLS), y: lc.y + unwrap(s.prevTail.y - last.y, ROWS) });
      points.push({ x: lerp(old.x, end.x, p), y: lerp(old.y, end.y, p) });
    }

    const path = roundedPath(points, CELL * 0.55);
    const boosted = s.boostLeft > 0;

    const body = path; // espessura igual dos dois lados, como um cabo de verdade

    const main = boosted ? mixColor(this.cableColor, COLORS.signal, 0.45) : this.cableColor;
    const shade = boosted ? mixColor(this.cableShade, COLORS.signal, 0.25) : this.cableShade;
    const light = mixColor(main, 0xffffff, 0.4);
    const spec = boosted ? mixColor(COLORS.signal, 0xffffff, 0.6) : mixColor(main, 0xffffff, 0.8);

    // cópias do cabo que aparecem dentro do campo (a normal e, perto da borda, a do lado oposto)
    const fieldW = COLS * CELL;
    const fieldH = ROWS * CELL;
    const pad = CABLE_W + 6;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const v of path) {
      minX = Math.min(minX, v.x);
      maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.y);
      maxY = Math.max(maxY, v.y);
    }
    const copies: Array<[number, number]> = [];
    for (const ox of [-fieldW, 0, fieldW]) {
      for (const oy of [-fieldH, 0, fieldH]) {
        if (maxX + ox + pad > FIELD_X && minX + ox - pad < FIELD_X + fieldW && maxY + oy + pad > FIELD_Y && minY + oy - pad < FIELD_Y + fieldH) {
          copies.push([ox, oy]);
        }
      }
    }
    const at = (pts: V[], ox: number, oy: number): V[] => pts.map((v) => ({ x: v.x + ox, y: v.y + oy }));

    for (const [ox, oy] of copies) {
      // 1. contorno
      g.lineStyle(CABLE_W + 4, COLORS.cableOutline, 1);
      g.strokePoints(at(body, ox, oy), false, false);
      // 2. sombra (parte de baixo do tubo)
      g.lineStyle(CABLE_W, shade, 1);
      g.strokePoints(at(body, ox, oy), false, false);
      // 3. cor principal, deslocada para a luz (cima e esquerda)
      g.lineStyle(CABLE_W - 3, main, 1);
      g.strokePoints(at(body, ox - 0.7, oy - 0.7), false, false);
      // 4. brilho largo
      g.lineStyle(2, light, 1);
      g.strokePoints(at(body, ox - 1.8, oy - 1.8), false, false);
      // 5. reflexo fino
      g.lineStyle(1, spec, 1);
      g.strokePoints(at(body, ox - 2.4, oy - 2.4), false, false);
    }

    // conector RJ45 em cada ponta, virado para fora do cabo
    const headDir = endDirection(path, false) ?? {
      x: s.dir === 'right' ? 1 : s.dir === 'left' ? -1 : 0,
      y: s.dir === 'down' ? 1 : s.dir === 'up' ? -1 : 0,
    };
    const tailDir = endDirection(path, true) ?? { x: -headDir.x, y: -headDir.y };
    this.placePlug(this.plugsHead, path[0] ?? h, headDir.x, headDir.y);
    this.placePlug(this.plugsTail, path[path.length - 1] ?? h, tailDir.x, tailDir.y);
  }

  /** Posiciona e gira o conector (sprite de pixel art) na ponta do cabo, virado para onde ele anda. */
  private placePlug(pool: Phaser.GameObjects.Image[], hp: V, dx: number, dy: number): void {
    const horizontal = Math.abs(dx) > Math.abs(dy);
    const angle = horizontal ? (dx > 0 ? 90 : -90) : dy > 0 ? 180 : 0;
    const fieldW = COLS * CELL;
    const fieldH = ROWS * CELL;
    const reach = PLUG_TIP_PX + 8;
    let used = 0;
    for (const ox of [-fieldW, 0, fieldW]) {
      for (const oy of [-fieldH, 0, fieldH]) {
        const x = hp.x + ox;
        const y = hp.y + oy;
        if (x < FIELD_X - reach || x > FIELD_X + fieldW + reach || y < FIELD_Y - reach || y > FIELD_Y + fieldH + reach) continue;
        const img = pool[used++];
        if (img) img.setPosition(Math.round(x), Math.round(y)).setAngle(angle).setVisible(true);
      }
    }
    for (let i = used; i < pool.length; i++) pool[i]?.setVisible(false);
  }
}
