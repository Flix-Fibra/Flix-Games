import Phaser from 'phaser';
import { hudText } from '@flix/game-kit/src/phaserHud';
import type { Expression } from '@flix/avatar';
import type { HubBridge } from '@flix/game-sdk';
import { sfx } from '../audio';
import { drawCourse, drawGadgets, layoutFor, toScreen, type Layout } from '../course';
import { LEVELS } from '../levels';
import {
  BALL_R, DT, MAX_STROKES, aimFromDrag, canShoot, cannonAngle, createHole, createRun, finishHole, holeDone, resultName, runFinished, shoot,
  shootFromCannon, step,
  totalPar, totalStrokes, type HoleEvent, type HoleState, type Run,
} from '../logic';
import { RENDER } from '../camera';
import { loadBest } from '../storage';
import { BAR_H, COLORS, FONT, GAME_H, GAME_W, HUD_H, MAX_DRAG } from '../theme';
import { portraitKey } from './BootScene';

const NEXT_HOLE_MS = 1500;

export class PlayScene extends Phaser.Scene {
  private bridge!: HubBridge;
  private run!: Run;
  private hole!: HoleState;
  private lay!: Layout;
  private runId = '';
  private elapsed = 0;
  private acc = 0;
  private transition = false;
  private previousBest = 0;
  private everShot = false;

  private course?: Phaser.GameObjects.Graphics;
  private gadgetG!: Phaser.GameObjects.Graphics;
  private ballG!: Phaser.GameObjects.Graphics;
  private aimG!: Phaser.GameObjects.Graphics;
  private hud: Record<'hole' | 'par' | 'strokes' | 'total', Phaser.GameObjects.BitmapText> = {} as never;
  private portrait!: Phaser.GameObjects.Image;
  private hint!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private nameText!: Phaser.GameObjects.Text;
  private drag: { x0: number; y0: number; x1: number; y1: number } | null = null;
  private sinkT = 0;

  constructor() {
    super('Play');
  }

  create(): void {
    this.bridge = this.registry.get('bridge') as HubBridge;
    this.runId = this.bridge.newRunId();
    this.elapsed = 0;
    this.acc = 0;
    this.transition = false;
    this.everShot = false;
    this.drag = null;
    this.previousBest = loadBest();
    this.cameras.main.setBackgroundColor(COLORS.background);
    this.run = createRun(LEVELS);

    this.buildHud();
    this.gadgetG = this.add.graphics().setDepth(2);
    this.ballG = this.add.graphics().setDepth(3);
    this.aimG = this.add.graphics().setDepth(4);
    this.banner = this.add
      .text(GAME_W / 2, GAME_H / 2 - 10, '', { fontFamily: FONT, fontSize: '26px', fontStyle: 'bold', color: COLORS.text, stroke: '#000000', strokeThickness: 5 })
      .setOrigin(0.5)
      .setDepth(8)
      .setAlpha(0);
    this.loadHole();
    this.setupInput();
    this.bridge.sendStarted(this.runId);
  }

  // ---------- montagem ----------

  private buildHud(): void {
    this.add.rectangle(0, 0, GAME_W, HUD_H, 0x000000, 0.45).setOrigin(0, 0).setDepth(6);
    this.add.rectangle(0, GAME_H - BAR_H, GAME_W, BAR_H, 0x000000, 0.35).setOrigin(0, 0).setDepth(6);
    this.portrait = this.add.image(20, HUD_H / 2, portraitKey('neutral')).setDepth(7);
    const col = (key: 'hole' | 'par' | 'strokes' | 'total', label: string, x: number): void => {
      hudText(this, x, 6, label, 1).setDepth(7);
      this.hud[key] = hudText(this, x, 18, '0', 3).setDepth(7);
    };
    col('hole', 'BURACO', 40);
    this.hud.hole.setFontSize((this.hud.hole.fontSize * 2) / 3).setY(22); // "16/16" cabe sem encostar no PAR
    col('par', 'PAR', 112);
    col('strokes', 'TACADAS', 150);
    col('total', 'TOTAL', 220);
    this.nameText = this.add.text(GAME_W / 2, GAME_H - BAR_H + 9, '', { fontFamily: FONT, fontSize: '11px', color: COLORS.textMuted }).setOrigin(0.5, 0).setDepth(7);
    this.hint = this.add
      .text(GAME_W / 2, GAME_H - 15, 'Arraste para trás e solte para tacar', { fontFamily: FONT, fontSize: '10px', color: COLORS.text })
      .setOrigin(0.5)
      .setDepth(7);
  }

  private loadHole(): void {
    const level = this.run.levels[this.run.index]!;
    this.hole = createHole(level);
    this.lay = layoutFor(level);
    this.course?.destroy();
    this.course = drawCourse(this, level, this.lay).setDepth(1);
    this.nameText.setText(level.name.toUpperCase());
    this.sinkT = 0;
    this.transition = false;
    this.portrait.setTexture(portraitKey('neutral'));
    this.updateHud();
  }

  private updateHud(): void {
    const h = this.hole;
    this.hud.hole.setText(`${this.run.index + 1}/${this.run.levels.length}`);
    this.hud.par.setText(String(h.level.par));
    this.hud.strokes.setText(String(h.strokes));
    this.hud.total.setText(String(totalStrokes(this.run) + h.strokes));
  }

  // ---------- entrada: arrastar para trás e soltar ----------

  private setupInput(): void {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!canShoot(this.hole) || this.transition) return;
      this.drag = { x0: p.worldX, y0: p.worldY, x1: p.worldX, y1: p.worldY };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.drag) {
        this.drag.x1 = p.worldX;
        this.drag.y1 = p.worldY;
      }
    });
    const release = (): void => {
      const d = this.drag;
      this.drag = null;
      if (!d || !canShoot(this.hole) || this.transition) return;
      const aim = aimFromDrag(d.x1 - d.x0, d.y1 - d.y0, MAX_DRAG);
      if (this.hole.held !== null) {
        // bomba: a direção é a dela; o jogador só dá a força (um toque sem arrastar vale 0,6)
        const power = aim ? aim.power : 0.6;
        if (shootFromCannon(this.hole, power)) {
          sfx('hit', power);
          this.everShot = true;
          this.hint.setVisible(false);
          this.updateHud();
        }
        return;
      }
      if (!aim) return;
      if (shoot(this.hole, aim.angle, aim.power)) {
        sfx('hit', aim.power);
        this.everShot = true;
        this.hint.setVisible(false);
        this.updateHud();
      }
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
  }

  // ---------- laço ----------

  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.05);
    if (!this.transition) this.elapsed += delta;
    // o relógio da fase corre sempre (a bomba gira, o moinho roda, a lava pisca), com a bola parada ou não
    this.acc += dt;
    while (this.acc >= DT) {
      this.acc -= DT;
      for (const e of step(this.hole)) this.onEvent(e);
    }
    if (this.hole.sunk) this.sinkT = Math.min(1, this.sinkT + dt * 4);
    drawGadgets(this.gadgetG, this.hole.level, this.lay, this.hole);
    this.drawBall();
    this.drawAim();
  }

  private onEvent(e: HoleEvent): void {
    switch (e.type) {
      case 'bounce':
        sfx('bounce', Math.min(1, e.speed / 12));
        break;
      case 'bumper':
        sfx('bumper');
        this.flash(0xf2c230);
        break;
      case 'portal':
        sfx('portal');
        this.flash(0xa855f7);
        break;
      case 'hazard':
        sfx('splash');
        if (e.kind === 'lava') sfx('burn');
        this.say(e.kind === 'water' ? 'ÁGUA! +1' : e.kind === 'lava' ? 'LAVA! +1' : 'FORA! +1', 900);
        this.updateHud();
        break;
      case 'cannon':
        sfx('cannon');
        this.flash(0xffd23d);
        this.say('BOMBA! ESCOLHA A FORÇA', 1100);
        this.hint.setText('A bomba mira sozinha: toque ou arraste só para a força').setVisible(true);
        this.updateHud();
        break;
      case 'jump':
        sfx('jump');
        break;
      case 'land':
        sfx('bounce', 0.5);
        break;
      case 'stop':
        this.updateHud();
        break;
      case 'sink': {
        sfx('sink');
        const name = resultName(this.hole.strokes, this.hole.level.par);
        const good = this.hole.strokes <= this.hole.level.par;
        if (good) this.time.delayedCall(250, () => sfx('good'));
        this.portrait.setTexture(portraitKey(good ? 'happy' : 'neutral'));
        this.say(name, NEXT_HOLE_MS - 200);
        this.updateHud();
        this.endHole();
        break;
      }
      case 'giveup':
        sfx('giveup');
        this.portrait.setTexture(portraitKey('sad'));
        this.say(`LIMITE DE ${MAX_STROKES} TACADAS`, NEXT_HOLE_MS - 200);
        this.updateHud();
        this.endHole();
        break;
    }
  }

  private say(text: string, ms: number): void {
    this.banner.setText(text).setAlpha(1).setScale(1.25);
    this.tweens.killTweensOf(this.banner);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 160 });
    this.tweens.add({ targets: this.banner, alpha: 0, delay: Math.max(200, ms - 300), duration: 300 });
  }

  private flash(color: number): void {
    const p = toScreen(this.lay, this.hole.ball.x, this.hole.ball.y);
    const ring = this.add.circle(p.x, p.y, this.lay.ts * 0.3, color, 0.7).setDepth(5);
    this.tweens.add({ targets: ring, scale: 2.2, alpha: 0, duration: 260, onComplete: () => ring.destroy() });
  }

  // ---------- fim de buraco e de percurso ----------

  private endHole(): void {
    if (this.transition || !holeDone(this.hole)) return;
    this.transition = true;
    finishHole(this.run, this.hole);
    this.time.delayedCall(NEXT_HOLE_MS, () => {
      if (runFinished(this.run)) this.finishRun();
      else this.loadHole();
    });
  }

  private finishRun(): void {
    sfx('end');
    const total = totalStrokes(this.run);
    const par = totalPar(this.run);
    const expression: Expression = total <= par ? 'happy' : total <= par + this.run.levels.length * 2 ? 'neutral' : 'sad';
    this.bridge.sendGameOver({
      runId: this.runId,
      score: total,
      durationMs: this.elapsed,
      meta: { holes: this.run.levels.length, par, strokes: this.run.results.join(',') },
    });
    this.scene.start('GameOver', { total, par, results: this.run.results, previousBest: this.previousBest, expression });
  }

  // ---------- desenho dinâmico ----------

  private drawBall(): void {
    const g = this.ballG;
    g.clear();
    const { ts } = this.lay;
    const h = this.hole;
    const p = toScreen(this.lay, h.ball.x, h.ball.y);
    const r = BALL_R * ts * (h.sunk ? 1 - this.sinkT * 0.9 : 1) * (h.held !== null ? 0.8 : 1);
    if (h.sunk && this.sinkT >= 1) return;
    // no ar (rampa de salto): a bola sobe num arco e a sombra fica no chão
    const arc = h.air > 0 && h.airTotal > 0 ? Math.sin(Math.PI * (1 - h.air / h.airTotal)) : 0;
    const lift = arc * ts * 1.1;
    g.fillStyle(0x000000, 0.28 - arc * 0.1).fillCircle(p.x + 1.2, p.y + 1.8, r * (1 - arc * 0.25));
    const by = p.y - lift;
    const br = r * (1 + arc * 0.45);
    g.fillStyle(COLORS.ball, 1).fillCircle(p.x, by, br);
    g.fillStyle(0xcfd6e6, 1).fillCircle(p.x + br * 0.25, by + br * 0.3, br * 0.55);
    g.fillStyle(0xffffff, 1).fillCircle(p.x - br * 0.3, by - br * 0.3, br * 0.3);
  }

  private drawAim(): void {
    const g = this.aimG;
    g.clear();
    const d = this.drag;
    if (!canShoot(this.hole)) return;
    const held = this.hole.held;
    const aim =
      held !== null
        ? { angle: cannonAngle(this.hole.level.cannons[held]!, this.hole.clock), power: d ? (aimFromDrag(d.x1 - d.x0, d.y1 - d.y0, MAX_DRAG)?.power ?? 0.6) : 0.6 }
        : d
          ? aimFromDrag(d.x1 - d.x0, d.y1 - d.y0, MAX_DRAG)
          : null;
    if (!aim) return;
    const { ts } = this.lay;
    const b = toScreen(this.lay, this.hole.ball.x, this.hole.ball.y);
    const dx = Math.cos(aim.angle);
    const dy = Math.sin(aim.angle);
    // pontos na direção da tacada; quanto mais força, mais longe
    const len = ts * (1.2 + aim.power * 4.5);
    const hot = Phaser.Display.Color.Interpolate.ColorWithColor(new Phaser.Display.Color(255, 255, 255), new Phaser.Display.Color(255, 74, 90), 100, aim.power * 100);
    const color = Phaser.Display.Color.GetColor(hot.r, hot.g, hot.b);
    for (let s = ts * 0.7; s < len; s += 7) g.fillStyle(color, 1 - (s / len) * 0.55).fillCircle(b.x + dx * s, b.y + dy * s, 1.8);
    if (held !== null) {
      if (d) this.drawPowerBar(g, aim.power, color);
      return;
    }
    // o "taco" para trás da bola, afastando conforme a força
    const back = BALL_R * ts + 4 + aim.power * 16;
    g.lineStyle(3, 0xd9b48a, 1).lineBetween(b.x - dx * (back + 22), b.y - dy * (back + 22), b.x - dx * back, b.y - dy * back);
    g.lineStyle(3, 0x777f95, 1).lineBetween(b.x - dx * back, b.y - dy * back, b.x - dx * (back - 4), b.y - dy * (back - 4));
    this.drawPowerBar(g, aim.power, color);
  }

  private drawPowerBar(g: Phaser.GameObjects.Graphics, power: number, color: number): void {
    const bw = 110;
    const bx = GAME_W / 2 - bw / 2;
    const by = GAME_H - BAR_H + 22;
    g.fillStyle(0x000000, 0.6).fillRect(bx - 1, by - 1, bw + 2, 8);
    g.fillStyle(color, 1).fillRect(bx, by, bw * power, 6);
  }
}
