import Phaser from 'phaser';
import { soltarMouseSemEsc } from '@flix/game-kit/src/soltarMouse';
import type { HubBridge } from '@flix/game-sdk';
import {
  BALL_R, ballSpeed, BOSS_H, BOSS_HIT_POINTS, BOSS_KILL_POINTS, BOSS_W, BOSS_Y, bossHp, brickHp, brickPoints, brickRect,
  circleRect, COIN_POINTS, ORBS_PER_LIFE, type BrickDef, type DropKind, FIELD_L, FIELD_R, FIELD_T, keepAngle, LEVEL_POINTS, levelAt,
  HIT_TOP, MAX_BALLS, PADDLE_W, paddleRect, PADDLE_Y, paddleBounce, parseLevel, POWER_MS, type PowerKind, type Rect, reflect,
  rollDrop, rotate, SHIELD_Y, timeBonus,
} from '../logic';
import { Surfer } from '../surfer';
import { BALL_TAIL_PX, BRICK_COLORS, COLORS, DEPTH, FONT, FONT_TEXT, GAME_H, GAME_W } from '../theme';

const START_LIVES = 3;
const SUBSTEP_PX = 5; // a bola anda no máximo isso por passo de colisão (não atravessa bloco)
const FAST_MUL = 1.45; // supervelocidade
const DROP_VY = 270;
const MAGNET_SPEED = 760;
const BOLT_VY = 400;
const STUN_MS = 900;
/** Tiros do chefão (ms entre um e outro): começa espaçado e acelera um pouco quando ele perde vida e a cada ciclo. */
const BOSS_FIRST_SHOT_MS = 4000;
const BOSS_SHOT_MS = 5000;
const BOSS_SHOT_MIN_MS = 3000;
const SERVE_DELAY_MS = 250;
const ORB_SCALE = 0.6; // mini bola-raio que cai dos blocos
const AUTO_LAUNCH_MS = 1500; // a bola sai sozinha (não precisa clicar)
/** TESTE: mostra a área de rebatida em vermelho. Desligar antes de publicar. */
const SHOW_HITBOX = false;

type State = 'serve' | 'play' | 'clear' | 'dead';
type TimedPower = Exclude<PowerKind, 'multi'>;

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  img: Phaser.GameObjects.Image;
  lost: boolean;
}
interface Brick {
  def: BrickDef;
  hp: number;
  rect: Rect;
  img: Phaser.GameObjects.Image;
  crack: Phaser.GameObjects.Image | null;
}
interface Drop {
  kind: DropKind;
  x: number;
  y: number;
  img: Phaser.GameObjects.Image;
}
interface Boss {
  x: number;
  hp: number;
  maxHp: number;
  t: number;
  shootIn: number;
  img: Phaser.GameObjects.Image;
  bar: Phaser.GameObjects.Graphics;
}
interface Bolt {
  x: number;
  y: number;
  img: Phaser.GameObjects.Image;
}

const POWER_NAMES: Record<PowerKind, string> = {
  multi: 'MULTIBOLINHA!',
  speed: 'SUPERVELOCIDADE!',
  shield: 'ESCUDO!',
  magnet: 'ÍMÃ!',
};
const TIMED: TimedPower[] = ['speed', 'shield', 'magnet'];

/** A partida: rebater a bola, quebrar os blocos, pegar bônus e mini bolas-raio (20 = vida extra), derrotar o chefão a cada 5 fases. */
export class PlayScene extends Phaser.Scene {
  private bridge!: HubBridge;
  private runId = '';
  private startedAt = 0;
  private state: State = 'serve';

  private level = 1;
  private cycle = 0;
  private bossCount = 0;
  private levelStartedAt = 0;
  private serveAt = 0;
  private lives = START_LIVES;
  private score = 0;
  private paddleHits = 0;
  private bricksBroken = 0;
  private coins = 0;

  private surfer!: Surfer;
  private paddleX = GAME_W / 2;
  private targetX = GAME_W / 2;
  private stunT = 0;

  private balls: Ball[] = [];
  private bricks: Brick[] = [];
  private drops: Drop[] = [];
  private bolts: Bolt[] = [];
  private boss: Boss | null = null;
  private timers: Record<TimedPower, number> = { speed: 0, shield: 0, magnet: 0 };

  private shield!: Phaser.GameObjects.Graphics;
  private hitbox: Phaser.GameObjects.Graphics | null = null;
  private hudScore!: Phaser.GameObjects.Text;
  private hudLevel!: Phaser.GameObjects.Text;
  private hudLives!: Phaser.GameObjects.Container;
  private hudOrbs!: Phaser.GameObjects.Text;
  private hudPowers!: Phaser.GameObjects.Graphics;
  private hudPowerIcons: Record<TimedPower, Phaser.GameObjects.Image> = {} as Record<TimedPower, Phaser.GameObjects.Image>;
  private keys!: { left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key; a: Phaser.Input.Keyboard.Key; d: Phaser.Input.Keyboard.Key };

  constructor() {
    super('Play');
  }

  create(): void {
    this.bridge = this.registry.get('bridge') as HubBridge;
    this.state = 'serve';
    this.level = 1;
    this.bossCount = 0;
    this.lives = START_LIVES;
    this.score = 0;
    this.paddleHits = 0;
    this.bricksBroken = 0;
    this.coins = 0;
    this.balls = [];
    this.bricks = [];
    this.drops = [];
    this.bolts = [];
    this.boss = null;
    this.timers = { speed: 0, shield: 0, magnet: 0 };
    this.paddleX = this.targetX = GAME_W / 2;
    this.stunT = 0;

    this.add.image(0, 0, 'bg').setOrigin(0).setDepth(DEPTH.bg);
    const walls = this.add.graphics().setDepth(DEPTH.walls);
    walls.fillStyle(0x2a3360, 1);
    walls.fillRect(0, FIELD_T - 10, GAME_W, 10);
    walls.fillRect(0, FIELD_T - 10, FIELD_L, GAME_H);
    walls.fillRect(FIELD_R, FIELD_T - 10, GAME_W - FIELD_R, GAME_H);
    walls.fillStyle(0x4fd1ff, 0.5);
    walls.fillRect(FIELD_L - 2, FIELD_T, 2, GAME_H);
    walls.fillRect(FIELD_R, FIELD_T, 2, GAME_H);
    walls.fillRect(FIELD_L, FIELD_T - 2, FIELD_R - FIELD_L, 2);

    this.shield = this.add.graphics().setDepth(DEPTH.shield);
    this.hitbox = SHOW_HITBOX ? this.add.graphics().setDepth(DEPTH.fx) : null;
    this.surfer = new Surfer(this, this.paddleX);

    this.makeHud();

    this.input.mouse?.requestPointerLock(); // TESTE
    // botão direito ou P soltam o mouse (o Esc do Chrome sai da tela cheia e minimiza a página do hub)
    const desligarSoltar = soltarMouseSemEsc();
    this.input.on('pointerdown', this.onPointer, this);
    this.input.on('pointermove', this.onPointer, this);
    this.input.on('pointerup', this.onUp, this);
    const kb = this.input.keyboard!;
    kb.addCapture([Phaser.Input.Keyboard.KeyCodes.SPACE]);
    this.keys = {
      left: kb.addKey('LEFT'),
      right: kb.addKey('RIGHT'),
      a: kb.addKey('A'),
      d: kb.addKey('D'),
    };
    kb.on('keydown-SPACE', () => this.launch());

    const onRestart = () => this.scene.restart();
    this.game.events.on('hub-restart', onRestart);
    // o mouse some enquanto controla a personagem (volta no fim de jogo e ao sair da partida)
    this.input.setDefaultCursor('none');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      desligarSoltar();
      if (document.pointerLockElement) document.exitPointerLock();
      this.input.setDefaultCursor('default');
      this.game.events.off('hub-restart', onRestart);
      kb.off('keydown-SPACE');
    });

    this.startLevel(1);
    this.runId = this.bridge.newRunId();
    this.bridge.sendStarted(this.runId);
    this.startedAt = this.time.now;
  }

  // ---- fases ----------------------------------------------------------------------------------------------------------

  private startLevel(n: number): void {
    this.level = n;
    const { def, cycle } = levelAt(n);
    this.cycle = cycle;
    for (const b of this.bricks) {
      b.img.destroy();
      b.crack?.destroy();
    }
    this.bricks = [];
    this.clearMoving();
    this.destroyBoss();

    for (const d of parseLevel(def)) {
      const rect = brickRect(d.col, d.row);
      const key = d.kind === 'n' ? `brick_n${d.color}` : `brick_${d.kind}`;
      const img = this.add.image(rect.x + rect.w / 2, rect.y + rect.h / 2, key).setDisplaySize(rect.w, rect.h).setDepth(DEPTH.bricks);
      // entra caindo de leve, fileira por fileira
      img.setAlpha(0).y -= 30;
      this.tweens.add({ targets: img, alpha: 1, y: img.y + 30, duration: 320, delay: d.row * 50 + d.col * 12, ease: 'Back.easeOut' });
      this.bricks.push({ def: d, hp: brickHp(d.kind), rect, img, crack: null });
    }

    if (def.boss) this.spawnBoss();

    this.hudLevel.setText(`FASE ${n}`);
    this.levelStartedAt = this.time.now;
    this.serve();
    this.banner(def.boss ? 'CHEFÃO!' : `FASE ${n}`, def.boss ? '#FF6B8A' : '#9FE6FF');
  }

  /** Bola nova parada em cima da raquete, esperando o toque. */
  private serve(): void {
    for (const b of this.balls) b.img.destroy();
    this.balls = [];
    this.addBall(this.surfer.racketX(this.paddleX), HIT_TOP - BALL_R, 0, 0).img.setAngle(-90);
    this.state = 'serve';
    this.serveAt = this.time.now;
  }

  private launch(): void {
    if (this.state !== 'serve' || this.time.now - this.serveAt < SERVE_DELAY_MS) return;
    const b = this.balls[0];
    if (!b) return;
    const v = paddleBounce(Phaser.Math.FloatBetween(-0.3, 0.3), this.speed());
    b.vx = v.vx;
    b.vy = v.vy;
    this.state = 'play';
    this.surfer.swing();
  }

  private levelClear(): void {
    this.state = 'clear';
    const bonus = timeBonus(this.time.now - this.levelStartedAt);
    this.addScore(LEVEL_POINTS + bonus);
    for (const b of this.balls) b.img.destroy();
    this.balls = [];
    this.clearMoving();
    this.banner('FASE CONCLUÍDA!', '#FFD23F');
    if (bonus > 0) this.time.delayedCall(500, () => this.popup(GAME_W / 2, GAME_H * 0.46, `+${LEVEL_POINTS + bonus} pontos`, '#FFFFFF', 40));
    this.time.delayedCall(1800, () => {
      if (this.state === 'clear') this.startLevel(this.level + 1);
    });
  }

  private loseLife(): void {
    this.lives--;
    this.drawLives();
    this.clearMoving();
    this.cameras.main.shake(200, 0.008);
    if (this.lives <= 0) {
      this.die();
      return;
    }
    this.banner(this.lives === 1 ? 'ÚLTIMA BOLA!' : 'BOLA PERDIDA', '#FF8A6A');
    this.serve();
  }

  /** Remove bônus caindo, tiros do chefão e bônus ativos. */
  private clearMoving(): void {
    for (const d of this.drops) d.img.destroy();
    for (const b of this.bolts) b.img.destroy();
    this.drops = [];
    this.bolts = [];
    this.timers = { speed: 0, shield: 0, magnet: 0 };
    this.stunT = 0;
    this.surfer?.setTint(null);
  }

  // ---- entrada --------------------------------------------------------------------------------------------------------

  private onPointer(p: Phaser.Input.Pointer): void {
    // TESTE: mouse travado dentro do jogo (pointer lock); movimento relativo
    if (this.input.mouse?.locked) {
      this.targetX = Phaser.Math.Clamp(this.targetX + p.movementX / this.scale.displayScale.x, FIELD_L, FIELD_R);
      return;
    }
    if (!p.wasTouch) this.input.mouse?.requestPointerLock();
    this.targetX = p.worldX;
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (!this.input.mouse?.locked) this.targetX = p.worldX;
    this.launch();
  }

  // ---- laço -----------------------------------------------------------------------------------------------------------

  update(_time: number, delta: number): void {
    if (this.state === 'dead') return;
    const ms = Math.min(delta, 50);
    const dt = ms / 1000;

    // raquete
    const kbDir = (this.keys.right.isDown || this.keys.d.isDown ? 1 : 0) - (this.keys.left.isDown || this.keys.a.isDown ? 1 : 0);
    if (kbDir !== 0) this.targetX = this.paddleX + kbDir * 900 * dt;
    if (this.stunT > 0) {
      this.stunT -= ms;
      if (this.stunT <= 0) this.surfer.setTint(null);
    } else {
      const half = PADDLE_W / 2;
      this.paddleX = Phaser.Math.Clamp(this.targetX, FIELD_L + half, FIELD_R - half);
    }
    this.surfer.update(this.paddleX, dt);

    for (const k of TIMED) this.timers[k] = Math.max(0, this.timers[k] - ms);
    this.drawShield();
    this.drawPowers();
    if (this.state === 'serve' && this.time.now - this.serveAt >= AUTO_LAUNCH_MS) this.launch();
    if (this.hitbox) {
      this.hitbox.clear();
      this.hitbox.lineStyle(3, 0xff0000, 1);
      this.hitbox.fillStyle(0xff0000, 0.25);
      const hr = paddleRect(this.paddleX);
      this.hitbox.fillRect(hr.x, hr.y, hr.w, hr.h);
      this.hitbox.strokeRect(hr.x, hr.y, hr.w, hr.h);
    }

    if (this.state === 'serve') {
      const b = this.balls[0];
      if (b) {
        b.x = this.surfer.racketX(this.paddleX);
        b.y = HIT_TOP - BALL_R;
        b.img.setPosition(b.x, b.y);
      }
    } else if (this.state === 'play') {
      for (const b of this.balls) this.stepBall(b, dt);
      const lost = this.balls.filter((b) => b.lost);
      if (lost.length > 0) {
        for (const b of lost) b.img.destroy();
        this.balls = this.balls.filter((b) => !b.lost);
        if (this.balls.length === 0) {
          this.loseLife();
          return;
        }
      }
    }

    this.updateDrops(dt);
    this.updateBoss(dt, ms);
    this.checkClear();
  }

  private speed(): number {
    return ballSpeed(this.level, this.paddleHits);
  }

  private addBall(x: number, y: number, vx: number, vy: number): Ball {
    const b: Ball = { x, y, vx, vy, img: this.ballImage(x, y), lost: false };
    this.balls.push(b);
    return b;
  }

  private stepBall(b: Ball, dt: number): void {
    const fast = this.timers.speed > 0;
    const mul = fast ? FAST_MUL : 1;
    const dist = Math.hypot(b.vx, b.vy) * mul * dt;
    const steps = Math.max(1, Math.ceil(dist / SUBSTEP_PX));
    const h = (dt * mul) / steps;
    const r = BALL_R;

    for (let i = 0; i < steps; i++) {
      b.x += b.vx * h;
      b.y += b.vy * h;

      // paredes
      if (b.x < FIELD_L + r) {
        b.x = FIELD_L + r;
        b.vx = Math.abs(b.vx);
      } else if (b.x > FIELD_R - r) {
        b.x = FIELD_R - r;
        b.vx = -Math.abs(b.vx);
      }
      if (b.y < FIELD_T + r) {
        b.y = FIELD_T + r;
        b.vy = Math.abs(b.vy);
      }

      // raquete
      if (b.vy > 0) {
        const pr = paddleRect(this.paddleX);
        if (circleRect(b.x, b.y, r, pr)) {
          const v = paddleBounce((b.x - this.paddleX) / (PADDLE_W / 2), this.speed());
          b.vx = v.vx;
          b.vy = v.vy;
          if (b.y < pr.y) b.y = pr.y - r; // batida por cima; de lado, só muda a direção (sobe sozinha)
          this.paddleHits++;
          this.surfer.swing();
        }
      }

      // escudo
      if (this.timers.shield > 0 && b.vy > 0 && b.y + r >= SHIELD_Y) {
        b.y = SHIELD_Y - r;
        b.vy = -Math.abs(b.vy);
        this.sparks(b.x, SHIELD_Y, 0x5dff9d, 5);
      }

      // chefão
      if (this.boss && this.boss.hp > 0) {
        const br: Rect = { x: this.boss.x - BOSS_W / 2, y: BOSS_Y - BOSS_H / 2, w: BOSS_W, h: BOSS_H };
        const hit = circleRect(b.x, b.y, r, br);
        if (hit) {
          b.x += hit.nx * hit.depth;
          b.y += hit.ny * hit.depth;
          const v = reflect(b.vx, b.vy, hit.nx, hit.ny);
          b.vx = v.vx;
          b.vy = v.vy;
          this.hitBoss(fast ? 3 : 1, b.x, b.y);
        }
      }

      // blocos (um por passo; na supervelocidade atravessa os que quebram)
      for (const br of this.bricks) {
        const hit = circleRect(b.x, b.y, r, br.rect);
        if (!hit) continue;
        if (fast && br.def.kind !== 'x') {
          this.destroyBrick(br);
          continue;
        }
        b.x += hit.nx * hit.depth;
        b.y += hit.ny * hit.depth;
        const v = reflect(b.vx, b.vy, hit.nx, hit.ny);
        b.vx = v.vx;
        b.vy = v.vy;
        this.damageBrick(br);
        break;
      }
      if (this.bricks.some((x) => x.hp <= 0)) this.bricks = this.bricks.filter((x) => x.hp > 0);

      if (b.y - r > GAME_H) {
        b.lost = true;
        return;
      }
    }

    const k = keepAngle(b.vx, b.vy);
    b.vx = k.vx;
    b.vy = k.vy;
    this.drawBall(b, fast);
  }

  // ---- blocos ---------------------------------------------------------------------------------------------------------

  private damageBrick(br: Brick): void {
    if (br.def.kind === 'x') {
      this.sparks(br.img.x, br.img.y, 0xc9d2f0, 3);
      this.flash(br.img);
      return;
    }
    br.hp--;
    if (br.hp <= 0) {
      this.destroyBrick(br);
      return;
    }
    // bloco resistente: racha e pisca
    const lost = brickHp(br.def.kind) - br.hp;
    const key = lost >= 2 ? 'crack2' : 'crack1';
    if (br.crack) br.crack.setTexture(key);
    else br.crack = this.add.image(br.img.x, br.img.y, key).setDisplaySize(br.rect.w, br.rect.h).setDepth(DEPTH.bricks + 1);
    this.flash(br.img);
    this.addScore(5);
  }

  private destroyBrick(br: Brick): void {
    br.hp = 0;
    this.bricksBroken++;
    this.addScore(brickPoints(br.def.kind));
    const color = br.def.kind === 'n' ? BRICK_COLORS[br.def.color]! : br.def.kind === 's' ? 0xb8c2d6 : 0xe6b422;
    this.sparks(br.img.x, br.img.y, color, 7);
    const img = br.img;
    this.tweens.add({ targets: img, scale: img.scale * 1.15, alpha: 0, duration: 140, onComplete: () => img.destroy() });
    br.crack?.destroy();
    const drop = rollDrop(Math.random);
    if (drop) this.spawnDrop(drop, br.img.x, br.img.y);
  }

  private checkClear(): void {
    if (this.state !== 'play' && this.state !== 'serve') return;
    if (this.boss) {
      if (this.boss.hp <= 0) this.levelClear();
      return;
    }
    if (!this.bricks.some((b) => b.def.kind !== 'x')) this.levelClear();
  }

  // ---- bônus e moedas -------------------------------------------------------------------------------------------------

  private spawnDrop(kind: DropKind, x: number, y: number): void {
    let img: Phaser.GameObjects.Image;
    if (kind === 'coin') {
      // mini bola-raio caindo, com o rastro para cima
      img = this.ballImage(x, y).setScale(ORB_SCALE).setDepth(DEPTH.drops).setAngle(90);
    } else {
      img = this.add.image(x, y, `pu_${kind}`).setDepth(DEPTH.drops);
      this.tweens.add({ targets: img, angle: { from: -12, to: 12 }, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    this.drops.push({ kind, x, y, img });
  }

  private updateDrops(dt: number): void {
    if (this.drops.length === 0) return;
    const magnet = this.timers.magnet > 0 && this.state === 'play';
    const keep: Drop[] = [];
    for (const d of this.drops) {
      if (magnet) {
        const dx = this.paddleX - d.x;
        const dy = PADDLE_Y - d.y;
        const len = Math.hypot(dx, dy) || 1;
        d.x += (dx / len) * MAGNET_SPEED * dt;
        d.y += (dy / len) * MAGNET_SPEED * dt;
        if (d.kind === 'coin') d.img.setRotation(Math.atan2(dy, dx)); // o rastro acompanha o ímã
      } else {
        d.y += DROP_VY * dt;
      }
      d.img.setPosition(d.x, d.y);
      const caught = circleRect(d.x, d.y, 20, paddleRect(this.paddleX)) !== null;
      if (caught && this.state !== 'clear') {
        this.collect(d);
        d.img.destroy();
      } else if (d.y > GAME_H + 40) {
        d.img.destroy();
      } else {
        keep.push(d);
      }
    }
    this.drops = keep;
  }

  private collect(d: Drop): void {
    if (d.kind === 'coin') {
      this.coins++;
      this.addScore(COIN_POINTS);
      this.popup(d.x, PADDLE_Y - 40, `+${COIN_POINTS}`, '#9FE6FF', 30);
      if (this.coins % ORBS_PER_LIFE === 0) {
        this.lives++;
        this.drawLives();
        this.banner('VIDA EXTRA!', '#5DFF9D');
        this.sparks(this.paddleX, PADDLE_Y, 0x4fd1ff, 14);
      }
      this.drawOrbs();
      return;
    }
    this.popup(this.paddleX, PADDLE_Y - 60, POWER_NAMES[d.kind], '#FFFFFF', 34);
    this.sparks(this.paddleX, PADDLE_Y, 0xffffff, 8);
    if (d.kind === 'multi') this.multiBall();
    else this.timers[d.kind] = POWER_MS[d.kind];
  }

  /** Cada bola em jogo vira três (até o limite). */
  private multiBall(): void {
    if (this.state === 'serve') this.launch();
    const current = [...this.balls];
    for (const b of current) {
      for (const deg of [-25, 25]) {
        if (this.balls.length >= MAX_BALLS) return;
        const v = rotate(b.vx, b.vy, deg);
        this.addBall(b.x, b.y, v.vx, v.vy);
      }
    }
  }

  // ---- chefão ---------------------------------------------------------------------------------------------------------

  private spawnBoss(): void {
    this.bossCount++;
    const hp = bossHp(this.cycle, this.bossCount - 1);
    const img = this.add.image(GAME_W / 2, BOSS_Y, 'boss').setDepth(DEPTH.boss).setScale(0);
    this.tweens.add({ targets: img, scale: 1, duration: 500, ease: 'Back.easeOut' });
    this.boss = { x: GAME_W / 2, hp, maxHp: hp, t: 0, shootIn: BOSS_FIRST_SHOT_MS, img, bar: this.add.graphics().setDepth(DEPTH.boss + 1) };
    this.drawBossBar();
  }

  private destroyBoss(): void {
    if (!this.boss) return;
    this.boss.img.destroy();
    this.boss.bar.destroy();
    this.boss = null;
  }

  private updateBoss(dt: number, ms: number): void {
    const boss = this.boss;
    if (!boss || boss.hp <= 0) return;
    if (this.state === 'play') {
      boss.t += dt;
      const range = (FIELD_R - FIELD_L) / 2 - BOSS_W / 2 - 10;
      boss.x = GAME_W / 2 + Math.sin(boss.t * (0.8 + this.cycle * 0.15)) * range;
      boss.img.x = boss.x;
      boss.shootIn -= ms;
      if (boss.shootIn <= 0) {
        boss.shootIn = Math.max(BOSS_SHOT_MIN_MS, BOSS_SHOT_MS - this.cycle * 400 - (1 - boss.hp / boss.maxHp) * 1200);
        const img = this.add.image(boss.x, BOSS_Y + BOSS_H / 2, 'bolt').setDepth(DEPTH.bolts);
        this.bolts.push({ x: boss.x, y: BOSS_Y + BOSS_H / 2, img });
        this.tweens.add({ targets: boss.img, scaleY: 0.92, duration: 90, yoyo: true });
      }
    }
    this.drawBossBar();

    const keep: Bolt[] = [];
    for (const bolt of this.bolts) {
      bolt.y += BOLT_VY * dt;
      bolt.img.setPosition(bolt.x, bolt.y);
      const hitPaddle = circleRect(bolt.x, bolt.y, 8, paddleRect(this.paddleX)) !== null;
      if (hitPaddle) {
        this.stunT = STUN_MS;
        this.surfer.setTint(0xff6b6b);
        this.cameras.main.shake(150, 0.006);
        this.sparks(bolt.x, bolt.y, 0xff5577, 8);
        bolt.img.destroy();
      } else if (bolt.y > GAME_H + 20) {
        bolt.img.destroy();
      } else {
        keep.push(bolt);
      }
    }
    this.bolts = keep;
  }

  private hitBoss(dmg: number, x: number, y: number): void {
    const boss = this.boss!;
    boss.hp = Math.max(0, boss.hp - dmg);
    this.addScore(BOSS_HIT_POINTS * dmg);
    this.sparks(x, y, 0xd6b4ff, 6);
    boss.img.setTintFill(0xffffff);
    this.time.delayedCall(70, () => boss.img.active && boss.img.clearTint());
    this.drawBossBar();
    if (boss.hp <= 0) {
      this.addScore(BOSS_KILL_POINTS);
      this.cameras.main.shake(400, 0.015);
      for (let i = 0; i < 6; i++) {
        this.time.delayedCall(i * 90, () =>
          this.sparks(boss.x + Phaser.Math.Between(-100, 100), BOSS_Y + Phaser.Math.Between(-40, 40), i % 2 ? 0x7c3aed : 0xffd23f, 10),
        );
      }
      this.tweens.add({ targets: boss.img, scale: 1.3, alpha: 0, angle: 8, duration: 600, ease: 'Cubic.easeIn' });
      boss.bar.clear();
      this.popup(boss.x, BOSS_Y, `+${BOSS_KILL_POINTS}`, '#FFD23F', 48);
    }
  }

  private drawBossBar(): void {
    const boss = this.boss;
    if (!boss || boss.hp <= 0) return;
    const w = 200;
    const x = boss.x - w / 2;
    const y = BOSS_Y - BOSS_H / 2 - 22;
    const g = boss.bar;
    g.clear();
    g.fillStyle(0x000000, 0.6);
    g.fillRoundedRect(x - 3, y - 3, w + 6, 14, 6);
    g.fillStyle(0xff4d6d, 1);
    g.fillRoundedRect(x, y, w * (boss.hp / boss.maxHp), 8, 4);
  }

  // ---- HUD ------------------------------------------------------------------------------------------------------------

  private makeHud(): void {
    this.hudLevel = this.add
      .text(FIELD_L + 6, 34, 'FASE 1', { fontFamily: FONT, fontSize: '30px', color: COLORS.textMuted, stroke: COLORS.stroke, strokeThickness: 6 })
      .setDepth(DEPTH.hud);
    this.hudScore = this.add
      .text(GAME_W / 2, 18, '0', { fontFamily: FONT, fontSize: '68px', color: COLORS.text, stroke: COLORS.stroke, strokeThickness: 10 })
      .setOrigin(0.5, 0)
      .setDepth(DEPTH.hud);
    this.hudLives = this.add.container(FIELD_R - 6, 50).setDepth(DEPTH.hud);
    this.drawLives();
    // contador de mini bolas-raio até a próxima vida extra
    this.add.image(FIELD_R - 92, 98, 'bola').setScale(0.42).setAngle(-35).setDepth(DEPTH.hud).setOrigin(1 - BALL_TAIL_PX / this.textures.get('bola').getSourceImage().width, 0.5);
    this.hudOrbs = this.add
      .text(FIELD_R - 6, 98, '', { fontFamily: FONT, fontSize: '26px', color: '#9FE6FF', stroke: COLORS.stroke, strokeThickness: 6 })
      .setOrigin(1, 0.5)
      .setDepth(DEPTH.hud);
    this.drawOrbs();
    this.hudPowers = this.add.graphics().setDepth(DEPTH.hud);
    for (const k of TIMED) this.hudPowerIcons[k] = this.add.image(0, 0, `pu_${k}`).setScale(0.5).setDepth(DEPTH.hud).setVisible(false);
  }

  private drawOrbs(): void {
    this.hudOrbs.setText(`${this.coins % ORBS_PER_LIFE}/${ORBS_PER_LIFE}`);
  }

  private drawLives(): void {
    this.hudLives.removeAll(true);
    for (let i = 0; i < Math.max(0, this.lives); i++) this.hudLives.add(this.add.image(-i * 34 - 14, 0, 'vida'));
  }

  /** Ícones dos bônus ativos com a barra do tempo que falta, logo abaixo do placar. */
  private drawPowers(): void {
    const g = this.hudPowers;
    g.clear();
    const active = TIMED.filter((k) => this.timers[k] > 0);
    const step = 110;
    let x = GAME_W / 2 - ((active.length - 1) * step) / 2;
    for (const k of TIMED) {
      const icon = this.hudPowerIcons[k];
      if (this.timers[k] <= 0) {
        icon.setVisible(false);
        continue;
      }
      const left = this.timers[k];
      // pisca no último segundo e meio
      icon.setVisible(left > 1500 || Math.floor(left / 150) % 2 === 0).setPosition(x - 26, 116);
      g.fillStyle(0x000000, 0.5);
      g.fillRoundedRect(x - 8, 111, 50, 10, 4);
      g.fillStyle(0xffffff, 0.9);
      g.fillRoundedRect(x - 8, 111, 50 * (left / POWER_MS[k]), 10, 4);
      x += step;
    }
  }

  private drawShield(): void {
    const g = this.shield;
    g.clear();
    const t = this.timers.shield;
    if (t <= 0) return;
    if (t < 1500 && Math.floor(t / 150) % 2 === 1) return;
    g.fillStyle(0x5dff9d, 0.18);
    g.fillRect(FIELD_L, SHIELD_Y, FIELD_R - FIELD_L, 14);
    g.fillStyle(0x5dff9d, 0.9);
    g.fillRect(FIELD_L, SHIELD_Y, FIELD_R - FIELD_L, 4);
  }

  private addScore(n: number): void {
    this.score += n;
    this.hudScore.setText(String(this.score));
  }

  // ---- fim de jogo ----------------------------------------------------------------------------------------------------

  private die(): void {
    if (this.state === 'dead') return;
    this.state = 'dead';
    this.bridge.sendGameOver({
      runId: this.runId,
      score: this.score,
      durationMs: Math.round(this.time.now - this.startedAt),
      meta: { level: this.level, bricks: this.bricksBroken, coins: this.coins },
    });
    this.time.delayedCall(500, () => this.showGameOver());
  }

  private showGameOver(): void {
    this.input.setDefaultCursor('default');
    const cx = GAME_W / 2;
    const d = DEPTH.over;
    this.add.rectangle(cx, GAME_H / 2, GAME_W, GAME_H, 0x05071a, 0.65).setDepth(d);
    this.add.rectangle(cx, 600, 560, 520, 0x1a1f45, 0.96).setStrokeStyle(6, 0x9fe6ff, 0.9).setDepth(d + 1);
    const txt = (y: number, s: string, size: number, color: string, font = FONT) =>
      this.add
        .text(cx, y, s, { fontFamily: font, fontSize: `${size}px`, color, stroke: COLORS.stroke, strokeThickness: 7, align: 'center' })
        .setOrigin(0.5)
        .setDepth(d + 2);
    txt(420, 'FIM DE JOGO', 58, '#FF8A6A');
    txt(500, 'PONTOS', 26, COLORS.textMuted, FONT_TEXT);
    txt(570, String(this.score), 86, '#FFFFFF');
    txt(650, `fase ${this.level} · ${this.bricksBroken} blocos · ${this.coins} bolas-raio`, 28, '#9FE6FF', FONT_TEXT);

    // Dentro do hub, o botão de recomeçar é do hub (mensagem `restart`); fora dele (desenvolvimento) mostramos o nosso.
    if (!this.bridge.embedded) {
      const btn = this.add.rectangle(cx, 760, 320, 84, 0x2f6bff).setStrokeStyle(5, 0xffffff).setDepth(d + 2).setInteractive({ useHandCursor: true });
      txt(760, 'REINICIAR', 38, '#FFFFFF');
      btn.once('pointerup', () => this.scene.start('Menu'));
      this.input.keyboard?.once('keydown-ENTER', () => this.scene.start('Menu'));
    } else {
      txt(760, 'Toque em “Jogar de novo”', 28, COLORS.textMuted, FONT_TEXT);
    }
  }

  // ---- efeitos --------------------------------------------------------------------------------------------------------

  private flash(img: Phaser.GameObjects.Image): void {
    img.setTintFill(0xffffff);
    this.time.delayedCall(60, () => img.active && img.clearTint());
  }

  private sparks(x: number, y: number, color: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const s = this.add.image(x, y, 'spark').setTint(color).setDepth(DEPTH.fx).setScale(Phaser.Math.FloatBetween(0.5, 1));
      const a = Math.random() * Math.PI * 2;
      const dist = Phaser.Math.Between(25, 70);
      this.tweens.add({
        targets: s,
        x: x + Math.cos(a) * dist,
        y: y + Math.sin(a) * dist + 20,
        angle: Phaser.Math.Between(-180, 180),
        alpha: 0,
        scale: 0.1,
        duration: Phaser.Math.Between(300, 520),
        ease: 'Cubic.easeOut',
        onComplete: () => s.destroy(),
      });
    }
  }

  /** Bola de raios: o rastro da imagem fica para trás, na direção contrária ao movimento. */
  private ballImage(x: number, y: number): Phaser.GameObjects.Image {
    const img = this.add.image(x, y, 'bola').setDepth(DEPTH.balls);
    this.setBallOrigin(img);
    return img;
  }

  private setBallOrigin(img: Phaser.GameObjects.Image): void {
    img.setOrigin(1 - BALL_TAIL_PX / img.width, 0.5);
  }

  private drawBall(b: Ball, fast: boolean): void {
    const key = fast ? 'bola_rapida' : 'bola';
    if (b.img.texture.key !== key) {
      b.img.setTexture(key);
      this.setBallOrigin(b.img);
    }
    b.img.setPosition(b.x, b.y);
    if (b.vx !== 0 || b.vy !== 0) b.img.setRotation(Math.atan2(b.vy, b.vx));
  }

  private banner(s: string, color: string): void {
    const t = this.add
      .text(GAME_W / 2, GAME_H * 0.4, s, { fontFamily: FONT, fontSize: '64px', color, stroke: COLORS.stroke, strokeThickness: 12 })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud)
      .setScale(0.6)
      .setAlpha(0);
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, duration: 400, delay: 1100, onComplete: () => t.destroy() });
  }

  private popup(x: number, y: number, s: string, color: string, size: number): void {
    const t = this.add
      .text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, stroke: COLORS.stroke, strokeThickness: 7 })
      .setOrigin(0.5)
      .setDepth(DEPTH.fx);
    t.x = Phaser.Math.Clamp(x, t.width / 2 + 10, GAME_W - t.width / 2 - 10);
    this.tweens.add({ targets: t, y: y - 70, alpha: 0, duration: 1100, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }
}
