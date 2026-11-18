import Phaser from 'phaser';
import type { HubBridge } from '@flix/game-sdk';
import {
  aimTilt,
  BIRD_BODY_DY,
  BIRD_R,
  branchRange,
  branchSurfaceY,
  firstSlot,
  FROG_LIFT,
  FROG_SCALE,
  frogAmp,
  hitsMonkey,
  launchVelocity,
  MONKEY_CATCH,
  MONKEY_CENTER_DY,
  BAT_POINTS,
  BAT_R,
  batCount,
  batSpeed,
  moveSpeedFactor,
  NEST_MOUTH_Y,
  newScore,
  nextSlot,
  nextWaveGap,
  FIRST_WAVE_AT,
  predictPath,
  pullPower,
  rollBird,
  rollFrog,
  scoreCatch,
  slingTip,
  STONE_R,
  stepStone,
  stoneHits,
  BAT_DEATH_FRAMES,
  batSwing,
  pickBatPatterns,
  NEST_SINK,
  NEST_STONE_Y,
  type BatPattern,
  BAT_FLY_FRAMES,
  visibleAimPoints,
  type BirdMode,
  type Circle,
  type ScoreState,
  type SlotInfo,
  type Stone,
  type Vec,
} from '../logic';
import { COLORS, DEPTH, FONT, FONT_TEXT, GAME_H, GAME_W, MONKEY_SCREEN_Y, WAVE_TINT } from '../theme';
import { addSupport, TrunkColumns } from '../tree';

type State = 'aim' | 'flying' | 'climbing' | 'wave' | 'dead';
type MoveKind = 'static' | 'h' | 'v';

interface Target {
  slot: SlotInfo;
  kind: MoveKind;
  nest: Phaser.GameObjects.Image;
  frog?: Phaser.GameObjects.Image;
  /** Base do ninho (centro de baixo), no mundo. */
  pos: Vec;
  t: number;
  /** Velocidade angular do vaivém (rad/s). */
  w: number;
  /** Altura extra máxima da levitação (sapo). */
  amp: number;
  moving: boolean;
  bird?: Bird;
}

/** Pássaro que voa perto de um ninho parado, atrapalhando: de um lado para o outro ou para cima e para baixo. */
interface Bird {
  img: Phaser.GameObjects.Image;
  mode: BirdMode;
  cx: number;
  cy: number;
  half: number;
  t: number;
  w: number;
  frame: number;
  clock: number;
  leaving: boolean;
}

/** Bat da onda: desce da parte de cima da tela em zigue-zague, indo na direção do macaco. */
interface Bat {
  img: Phaser.GameObjects.Image;
  halo: Phaser.GameObjects.Image;
  pattern: BatPattern;
  baseX: number;
  y: number;
  t: number;
  /** Segundos até entrar na tela (os da dupla e do trio entram em sequência). */
  delay: number;
  alive: boolean;
}

/** Pedra da onda de morcegos (pedras infinitas: várias no ar ao mesmo tempo). */
interface WaveStone {
  st: Stone;
  img: Phaser.GameObjects.Image;
  t: number;
}

const PHYS_DT = 1 / 240;
const AIM_PREVIEW_S = 0.8; // quanto da trajetória a mira mostra

/** Faixas de pixels nas bordas da tela (as paredes que rebatem): blocos de `EDGE_BLOCK` px, largura variando suavemente. */
const EDGE_BLOCK = 12;
const EDGE_ALPHA = [1, 0.78, 0.52, 0.3];
const EDGE_FLASH_MS = 380;
const EDGE_SPEED = 0.0009; // ondulação das faixas (rad/ms)

const POWER_COLORS = [0x7ce06a, 0xffd84a, 0xff4a3a].map((c) => Phaser.Display.Color.ValueToColor(c));

/** Cor da mira pela força: verde até amarelo (metade) até vermelho (máxima). */
function powerColor(p: number): number {
  const [a, b] = p < 0.5 ? [POWER_COLORS[0]!, POWER_COLORS[1]!] : [POWER_COLORS[1]!, POWER_COLORS[2]!];
  const t = p < 0.5 ? p / 0.5 : (p - 0.5) / 0.5;
  const c = Phaser.Display.Color.Interpolate.ColorWithColor(a, b, 100, Math.round(t * 100));
  return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
}

const H_PERIOD_S = 3.4; // vaivém no galho, no início
const V_PERIOD_S = 3.0; // sobe e desce do sapo, no início
const FROG_FRAME_MS = 220;
const BIRD_FRAME_MS = 90;
const BIRD_PERIOD_S = 2.8;
const BAT_FRAME_MS = 80; // como no GIF
const BAT_STAGGER_S = 1.1;
const WAVE_FIRE_COOLDOWN_MS = 220;
const MAX_FLIGHT_S = 10;
const NEST_SHRINK = 0.93; // ninho acertado encolhe ~10 px
const NEST_BLINK_MS = 300; // e pisca em vermelho antes de cair
const SUPPORT_SLIDE_MS = 380; // o apoio sai de trás do tronco

/** A partida: o macaco atira pedras com o estilingue e sobe a árvore de ninho em ninho. */
export class PlayScene extends Phaser.Scene {
  private bridge!: HubBridge;
  private runId = '';
  private startedAt = 0;
  private state: State = 'aim';

  private trunks!: TrunkColumns;
  private slots: SlotInfo[] = [];
  private supports = new Map<number, Phaser.GameObjects.Image>();
  private bg!: Phaser.GameObjects.Image;

  private cur!: SlotInfo;
  private feet: Vec = { x: 0, y: 0 };
  private facingRight = false;
  private monkey!: Phaser.GameObjects.Image;
  private target: Target | null = null;

  private stone: Stone | null = null;
  private stoneImg!: Phaser.GameObjects.Image;
  private dots!: Phaser.GameObjects.Graphics;
  private aim: { id: number; start: Vec; pull: Vec } | null = null;
  private wallBounces = 0;
  private touched = false;
  private flightT = 0;
  private leftMonkey = false;

  private bats: Bat[] = [];
  private waveStones: WaveStone[] = [];
  private nextWaveAt = 0;
  private lastWaveShot = 0;

  private score: ScoreState = newScore();
  private hudScore!: Phaser.GameObjects.Text;
  private hudStreak!: Phaser.GameObjects.Text;
  private frogClock = 0;
  private frogFrame = 0;
  private edges!: Phaser.GameObjects.Graphics;
  /** Brilho das faixas logo depois de a pedra rebater (ms restantes), esquerda e direita. */
  private edgeFlash = [0, 0];

  constructor() {
    super('Play');
  }

  create(): void {
    this.bridge = this.registry.get('bridge') as HubBridge;
    this.state = 'aim';
    this.slots = [];
    this.supports.clear();
    this.score = newScore();
    this.stone = null;
    this.aim = null;
    this.target = null;
    this.bats = [];
    this.waveStones = [];
    this.frogClock = 0;
    this.nextWaveAt = FIRST_WAVE_AT;

    this.bg = this.add.image(0, 0, 'fundo').setOrigin(0).setScrollFactor(0).setDepth(DEPTH.bg);

    this.cur = this.slot(0);
    this.feet = { x: this.cur.x, y: this.cur.y };
    this.cameras.main.setScroll(0, this.cur.y - MONKEY_SCREEN_Y);
    this.trunks = new TrunkColumns(this, this.cur.y + GAME_H);
    this.ensureWorld();

    // origem no centro do corpo, para girar com a mira
    this.monkey = this.add.image(0, 0, 'macaco_0').setDepth(DEPTH.monkey);
    this.placeMonkey(this.feet.x, this.feet.y);
    this.stoneImg = this.add.image(0, 0, 'pedra').setDepth(DEPTH.stone).setVisible(false);
    this.dots = this.add.graphics().setDepth(DEPTH.dots);
    this.edges = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.edges);
    this.edgeFlash = [0, 0];

    this.spawnTarget(1);
    this.faceTarget();

    this.hudScore = this.add
      .text(GAME_W / 2, 70, '0', { fontFamily: FONT, fontSize: '84px', color: COLORS.text, stroke: COLORS.stroke, strokeThickness: 12 })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud);
    this.hudStreak = this.add
      .text(GAME_W / 2, 180, '', { fontFamily: FONT, fontSize: '30px', color: '#FFE08A', stroke: COLORS.stroke, strokeThickness: 7 })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud);

    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointerupoutside', this.onUp, this);

    const onRestart = () => this.scene.restart();
    this.game.events.on('hub-restart', onRestart);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off('hub-restart', onRestart));

    this.runId = this.bridge.newRunId();
    this.bridge.sendStarted(this.runId);
    this.startedAt = this.time.now;
  }

  // ---- árvore ---------------------------------------------------------------------------------------------------------

  /** Apoio `i` (sorteado na primeira vez que é pedido, a partir do anterior). */
  private slot(i: number): SlotInfo {
    if (this.slots.length === 0) this.slots.push(firstSlot());
    while (this.slots.length <= i) this.slots.push(nextSlot(this.slots[this.slots.length - 1]!, Math.random));
    return this.slots[i]!;
  }

  /** Troncos na tela e apoios do macaco e do ninho alvo; apaga o que ficou para baixo. */
  private ensureWorld(): void {
    const top = this.cameras.main.scrollY;
    this.trunks.update(top, top + GAME_H);
    if (!this.supports.has(this.cur.index)) this.supports.set(this.cur.index, addSupport(this, this.cur, false));
    for (const [i, img] of this.supports) {
      if (i < this.cur.index - 1 && img.y > top + GAME_H + 200) {
        img.destroy();
        this.supports.delete(i);
      }
    }
  }

  // ---- ninho alvo -----------------------------------------------------------------------------------------------------

  private spawnTarget(index: number): void {
    const slot = this.slot(index);
    this.ensureWorld();
    // o apoio sai de trás do tronco; o ninho aparece depois (na primeira vez, já está no lugar)
    const animate = index > 1;
    if (!this.supports.has(index)) this.supports.set(index, addSupport(this, slot, animate));
    const appear = animate ? SUPPORT_SLIDE_MS : 0;
    const hits = this.score.hits;
    const factor = moveSpeedFactor(hits);
    let kind: MoveKind = 'static';
    if (slot.kind === 'branch') kind = 'h'; // no galho grande o ninho sempre desliza
    else if (rollFrog(slot, Math.random, this.cur)) kind = 'v';

    const t: Target = {
      slot,
      kind,
      nest: this.add.image(slot.x, slot.y, 'ninho').setOrigin(0.5, 1).setDepth(DEPTH.nest),
      pos: { x: slot.x, y: slot.y + NEST_SINK },
      t: Math.random() * Math.PI * 2,
      w: 0,
      amp: 0,
      moving: true,
    };
    if (kind === 'h') {
      t.w = ((Math.PI * 2) / H_PERIOD_S) * factor;
    } else if (kind === 'v') {
      t.w = ((Math.PI * 2) / V_PERIOD_S) * factor;
      t.amp = frogAmp(hits);
      const right = slot.side === 'right';
      t.frog = this.add
        .image(slot.x + (right ? 19 : -19), slot.y + 2, 'sapo_0')
        .setOrigin(0.5, 1)
        .setScale(FROG_SCALE)
        .setFlipX(right)
        .setDepth(DEPTH.frog);
    }
    if (kind === 'static') {
      const mode = rollBird(hits, Math.random);
      if (mode) t.bird = this.makeBird(mode, slot);
    }
    this.target = t;
    this.moveTarget(0);
    t.nest.setScale(0);
    this.tweens.add({ targets: t.nest, scale: 1, duration: 260, delay: appear, ease: 'Back.easeOut' });
    if (t.frog) {
      t.frog.setAlpha(0);
      this.tweens.add({ targets: t.frog, alpha: 1, duration: 260, delay: appear });
    }
  }

  private moveTarget(dt: number): void {
    const t = this.target;
    if (!t || t.kind === 'static' || !t.moving) return;
    t.t += dt * t.w;
    if (t.kind === 'h') {
      const [a, b] = branchRange(t.slot.side);
      t.pos.x = (a + b) / 2 + ((b - a) / 2) * Math.sin(t.t);
      t.pos.y = branchSurfaceY(t.slot, t.pos.x) + NEST_SINK;
    } else {
      t.pos.y = t.slot.y - FROG_LIFT - t.amp * (0.5 - 0.5 * Math.cos(t.t));
    }
    t.nest.setPosition(t.pos.x, t.pos.y);
  }

  // ---- pássaro --------------------------------------------------------------------------------------------------------

  /**
   * Cria o pássaro perto do ninho: `h` voa de um lado para o outro acima da boca do ninho; `v` sobe e desce ao lado do ninho,
   * do lado de onde vem o macaco, cortando o caminho da pedra.
   */
  private makeBird(mode: BirdMode, slot: SlotInfo): Bird {
    let cx: number;
    let cy: number;
    if (mode === 'h') {
      cx = Phaser.Math.Clamp(slot.x, 200, GAME_W - 200);
      cy = slot.y + NEST_MOUTH_Y - 120;
    } else {
      const toward = this.feet.x >= slot.x ? 1 : -1;
      cx = slot.x + toward * 125;
      if (cx < 70 || cx > GAME_W - 70) cx = slot.x - toward * 125;
      cy = slot.y - 130;
    }
    const img = this.add.image(cx, cy, 'passaro_0').setDepth(DEPTH.bird).setAlpha(0);
    this.tweens.add({ targets: img, alpha: 1, duration: 300 });
    return { img, mode, cx, cy, half: 150, t: Math.random() * Math.PI * 2, w: (Math.PI * 2) / BIRD_PERIOD_S, frame: 0, clock: 0, leaving: false };
  }

  private updateBird(dt: number, delta: number): void {
    const b = this.target?.bird;
    if (!b) return;
    b.clock += delta;
    if (b.clock >= BIRD_FRAME_MS) {
      b.clock = 0;
      b.frame = (b.frame + 1) % 7;
      b.img.setTexture(`passaro_${b.frame}`);
    }
    if (b.leaving) return;
    b.t += dt * b.w;
    if (b.mode === 'h') {
      b.img.setPosition(b.cx + b.half * Math.sin(b.t), b.cy + 10 * Math.sin(b.t * 2));
      b.img.setFlipX(Math.cos(b.t) > 0); // o desenho olha para a esquerda
    } else {
      b.img.setPosition(b.cx + 8 * Math.sin(b.t * 2), b.cy + b.half * Math.sin(b.t));
      b.img.setFlipX(this.feet.x > b.cx);
    }
  }

  /** Corpo do pássaro que rebate a pedra. */
  private birdBodies(): Circle[] {
    const b = this.target?.bird;
    if (!b || b.leaving) return [];
    return [{ x: b.img.x, y: b.img.y + BIRD_BODY_DY, r: BIRD_R }];
  }

  /** O pássaro vai embora voando. */
  private birdLeaves(b: Bird): void {
    if (b.leaving) return;
    b.leaving = true;
    const dir = b.img.x < GAME_W / 2 ? -1 : 1;
    b.img.setFlipX(dir > 0);
    this.tweens.add({ targets: b.img, x: b.img.x + dir * 500, y: b.img.y - 260, duration: 900, ease: 'Sine.easeIn', onComplete: () => b.img.destroy() });
  }

  /** A pedra bateu no pássaro: ele pisca (só um aviso por batida). */
  private birdHit(): void {
    const b = this.target?.bird;
    if (!b || b.img.getData('hitAt') > this.time.now - 300) return;
    b.img.setData('hitAt', this.time.now);
    b.img.setTintFill(0xffffff);
    this.time.delayedCall(90, () => b.img.clearTint());
  }

  // ---- mira e tiro ----------------------------------------------------------------------------------------------------

  private canAim(): boolean {
    return this.state === 'aim' || this.state === 'wave';
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (!this.canAim() || this.aim) return;
    this.aim = { id: p.id, start: { x: p.x, y: p.y }, pull: { x: 0, y: 0 } };
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (!this.aim || p.id !== this.aim.id || !this.canAim()) return;
    this.aim.pull = { x: this.aim.start.x - p.x, y: this.aim.start.y - p.y };
    const v = launchVelocity(this.aim.pull);
    this.dots.clear();
    if (!v) {
      this.monkey.setTexture('macaco_0').setRotation(0);
      return;
    }
    if (Math.abs(this.aim.pull.x) > 4) this.setFacing(this.aim.pull.x > 0);
    this.monkey.setTexture(pullPower(this.aim.pull) < 0.45 ? 'macaco_1' : 'macaco_2');
    // o macaco gira para o estilingue apontar para onde o tiro vai
    this.monkey.setRotation(aimTilt(v, this.facingRight));
    // pontos grandes; a cor vai do verde (fraco) ao amarelo e ao vermelho (força máxima). Da descida, só o primeiro ponto.
    const color = powerColor(pullPower(this.aim.pull));
    const tip = this.tip();
    const pts = visibleAimPoints(predictPath(tip, v, AIM_PREVIEW_S, 0.05), tip);
    pts.forEach((pt, i) => {
      const k = i / pts.length;
      const a = 1 - k * 0.7;
      const r = 13 - k * 6;
      this.dots.fillStyle(0x1a0f05, 0.55 * a).fillCircle(pt.x, pt.y, r + 3);
      this.dots.fillStyle(color, a).fillCircle(pt.x, pt.y, r);
    });
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (!this.aim || p.id !== this.aim.id) return;
    const v = this.canAim() ? launchVelocity(this.aim.pull) : null;
    this.aim = null;
    this.dots.clear();
    if (!v) {
      this.monkey.setTexture('macaco_0');
      this.straighten();
      return;
    }
    if (this.state === 'wave') this.fireWave(v);
    else this.fire(v);
  }

  private fire(v: Vec): void {
    const tip = this.tip();
    this.stone = { x: tip.x, y: tip.y, vx: v.x, vy: v.y };
    this.stoneImg.setPosition(tip.x, tip.y).setVisible(true).setAlpha(1).setScale(1);
    this.state = 'flying';
    this.wallBounces = 0;
    this.touched = false;
    this.flightT = 0;
    this.leftMonkey = false;
    this.shootPose();
  }

  /** Na onda de morcegos as pedras são infinitas: cada tiro é uma pedra nova, mesmo com outras no ar. */
  private fireWave(v: Vec): void {
    if (this.time.now - this.lastWaveShot < WAVE_FIRE_COOLDOWN_MS) return;
    this.lastWaveShot = this.time.now;
    const tip = this.tip();
    const img = this.add.image(tip.x, tip.y, 'pedra').setDepth(DEPTH.stone);
    this.waveStones.push({ st: { x: tip.x, y: tip.y, vx: v.x, vy: v.y }, img, t: 0 });
    this.shootPose();
  }

  private shootPose(): void {
    this.monkey.setTexture('macaco_3');
    this.time.delayedCall(260, () => {
      if (this.state !== 'climbing' && this.state !== 'dead') this.monkey.setTexture('macaco_0');
      this.straighten();
    });
  }

  /** Ponta do estilingue, considerando o giro atual do macaco. */
  private tip(): Vec {
    return slingTip(this.feet, this.facingRight, this.monkey.rotation);
  }

  /** Posiciona o macaco pelos pés (a imagem tem origem no centro do corpo). */
  private placeMonkey(x: number, feetY: number): void {
    this.monkey.setPosition(x, feetY + MONKEY_CENTER_DY);
  }

  /** Volta o macaco à posição reta. */
  private straighten(): void {
    this.tweens.add({ targets: this.monkey, rotation: 0, duration: 160, ease: 'Sine.easeOut' });
  }

  private setFacing(right: boolean): void {
    this.facingRight = right;
    this.monkey.setFlipX(right); // o desenho olha para a esquerda
  }

  private faceTarget(): void {
    const tx = this.target?.pos.x ?? GAME_W / 2;
    this.setFacing(tx > this.feet.x || (Math.abs(tx - this.feet.x) < 30 && this.feet.x < GAME_W / 2));
  }

  // ---- laço -----------------------------------------------------------------------------------------------------------

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000;
    this.animateFrog(delta);
    this.updateBird(dt, delta);
    if (this.state !== 'dead' && this.state !== 'climbing') this.moveTarget(dt);
    if (this.state === 'flying') this.updateStone(dt);
    if (this.state === 'wave') this.updateWave(dt);
    this.ensureWorld();
    this.drawEdges(delta);
  }

  /** Faixa de pixels em cada borda: largura de 1 a 4 blocos, ondulando devagar ao longo da altura e do tempo. */
  private drawEdges(delta: number): void {
    const g = this.edges;
    g.clear();
    const t = this.time.now;
    for (let side = 0; side < 2; side++) {
      this.edgeFlash[side] = Math.max(0, this.edgeFlash[side]! - delta);
      const flash = this.edgeFlash[side]! / EDGE_FLASH_MS;
      const color = flash > 0 ? Phaser.Display.Color.GetColor(242 + 13 * flash, 255, 150 + 105 * flash) : 0xf2ff96;
      for (let row = 0; row * EDGE_BLOCK < GAME_H; row++) {
        const w = 26 + 12 * Math.sin(t * EDGE_SPEED + row * 0.11 + side * 2.1) + 5 * Math.sin(t * EDGE_SPEED * 1.7 - row * 0.047 + side);
        const n = Math.max(1, Math.min(EDGE_ALPHA.length, Math.round(w / EDGE_BLOCK) + Math.round(flash * 2)));
        for (let b = 0; b < n; b++) {
          const x = side === 0 ? b * EDGE_BLOCK : GAME_W - (b + 1) * EDGE_BLOCK;
          g.fillStyle(color, EDGE_ALPHA[b]! * (0.85 + 0.15 * flash));
          g.fillRect(x, row * EDGE_BLOCK, EDGE_BLOCK, EDGE_BLOCK);
        }
      }
    }
  }

  private animateFrog(delta: number): void {
    const frog = this.target?.frog;
    if (!frog) return;
    this.frogClock += delta;
    if (this.frogClock >= FROG_FRAME_MS) {
      this.frogClock = 0;
      this.frogFrame = (this.frogFrame + 1) % 4;
      frog.setTexture(`sapo_${this.frogFrame}`);
    }
  }

  private flashEdge(x: number): void {
    this.edgeFlash[x < GAME_W / 2 ? 0 : 1] = EDGE_FLASH_MS;
  }

  private updateStone(dt: number): void {
    const st = this.stone!;
    const target = this.target!;
    const steps = Math.max(1, Math.round(dt / PHYS_DT));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const ev = stepStone(st, h, target.pos, this.birdBodies());
      if (ev.obstacle) this.birdHit();
      this.flightT += h;
      if (ev.wall) {
        this.wallBounces++;
        this.flashEdge(st.x);
      }
      if (ev.nestTouch) this.touched = true;
      if (ev.entered) {
        this.onCatch();
        return;
      }
      const mc = { x: this.feet.x + MONKEY_CATCH.dx, y: this.feet.y + MONKEY_CATCH.dy };
      if (!this.leftMonkey && Math.hypot(st.x - mc.x, st.y - mc.y) > MONKEY_CATCH.r + STONE_R + 6) this.leftMonkey = true;
      if (this.leftMonkey && hitsMonkey(st, this.feet)) {
        this.secondChance();
        return;
      }
    }
    this.stoneImg.setPosition(st.x, st.y).setRotation(this.stoneImg.rotation + st.vx * dt * 0.02);
    const camBottom = this.cameras.main.scrollY + GAME_H;
    if (st.y > camBottom + STONE_R * 2 + 20 || this.flightT > MAX_FLIGHT_S) this.die();
  }

  /** A pedra voltou e caiu no macaco: ele pega e pode atirar de novo. */
  private secondChance(): void {
    this.stone = null;
    this.stoneImg.setVisible(false);
    this.state = 'aim';
    this.monkey.setTexture('macaco_0').setRotation(0);
    this.popup(this.feet.x, this.feet.y - 150, 'PEGOU!', '#E6F2D8', 34);
  }

  private onCatch(): void {
    this.state = 'climbing';
    const t = this.target!;
    t.moving = false;
    const res = scoreCatch(this.score, !this.touched, this.wallBounces);
    this.stone = null;
    this.stoneImg.setVisible(false);
    // a pedra fica no meio dos ovos (uma cópia, que cai junto com o ninho)
    const inNest = this.add.image(t.pos.x, t.pos.y + NEST_STONE_Y - 8, 'pedra').setDepth(DEPTH.stone);
    this.tweens.add({ targets: inNest, y: t.pos.y + NEST_STONE_Y, scale: 0.9, duration: 120 });
    if (t.bird) this.birdLeaves(t.bird);
    this.nestHitEffect(t.nest, inNest);

    this.updateScore();
    this.hudStreak.setText(res.streak >= 1 ? `NA MOSCA x${res.streak}` : '');
    let y = t.pos.y - 140;
    this.popup(t.pos.x, y, `+${res.points}`, '#FFFFFF', 46);
    if (res.clean) this.popup(t.pos.x, (y -= 52), res.streak > 1 ? `NA MOSCA x${res.streak}` : 'NA MOSCA!', '#FFE08A', 32);
    if (res.bounce) this.popup(t.pos.x, (y -= 44), 'TABELA!', '#BDF5A8', 30);

    this.time.delayedCall(NEST_BLINK_MS, () => this.climb());
  }

  /** Ninho acertado: encolhe alguns px, pisca em vermelho por 0,3 s e cai lá de cima (com a pedra dentro). */
  private nestHitEffect(nest: Phaser.GameObjects.Image, inNest: Phaser.GameObjects.Image): void {
    this.tweens.add({ targets: nest, scale: NEST_SHRINK, duration: 90, ease: 'Quad.easeOut' });
    let on = true;
    nest.setTint(0xff3a3a);
    this.time.addEvent({
      delay: NEST_BLINK_MS / 4,
      repeat: 3,
      callback: () => {
        on = !on;
        if (on) nest.setTint(0xff3a3a);
        else nest.clearTint();
      },
    });
    this.time.delayedCall(NEST_BLINK_MS, () => {
      nest.clearTint();
      const dir = nest.x < GAME_W / 2 ? -1 : 1;
      this.tweens.add({
        targets: [nest, inNest],
        y: `+=${GAME_H + 200}`,
        x: `+=${dir * 60}`,
        angle: dir * 35,
        duration: 1000,
        ease: 'Quad.easeIn',
        onComplete: () => {
          nest.destroy();
          inNest.destroy();
        },
      });
    });
  }

  private updateScore(): void {
    this.hudScore.setText(String(this.score.score));
    this.tweens.add({ targets: this.hudScore, scale: 1.18, duration: 90, yoyo: true });
  }

  /** O macaco pula até o ninho acertado; a câmera sobe; aparece o próximo ninho (ou vem a onda de morcegos). */
  private climb(): void {
    const t = this.target!;
    // o macaco pousa no apoio (a superfície), não na base do ninho, que fica um pouco afundada
    const landing: Vec =
      t.kind === 'v' ? { x: t.slot.x, y: t.slot.y } : t.kind === 'h' ? { x: t.pos.x, y: branchSurfaceY(t.slot, t.pos.x) } : { x: t.slot.x, y: t.slot.y };
    const from = { ...this.feet };
    this.setFacing(landing.x > from.x);
    this.monkey.setTexture('macaco_0').setRotation(0);
    const arc = 90;
    const prog = { v: 0 };
    this.tweens.add({
      targets: prog,
      v: 1,
      duration: 480,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        const p = prog.v;
        this.placeMonkey(from.x + (landing.x - from.x) * p, from.y + (landing.y - from.y) * p - Math.sin(Math.PI * p) * arc);
      },
    });
    if (t.frog) this.tweens.add({ targets: t.frog, alpha: 0, y: t.frog.y - 30, duration: 300 });
    this.tweens.add({ targets: this.cameras.main, scrollY: landing.y - MONKEY_SCREEN_Y, duration: 600, ease: 'Sine.easeInOut', delay: 120 });

    this.time.delayedCall(620, () => {
      if (this.state === 'dead') return;
      t.frog?.destroy();
      this.target = null;
      this.feet = landing;
      this.placeMonkey(landing.x, landing.y);
      this.cur = t.slot;
      this.ensureWorld();
      if (this.score.hits >= this.nextWaveAt) {
        this.startWave();
        return;
      }
      this.spawnTarget(this.cur.index + 1);
      this.faceTarget();
      this.state = 'aim';
    });
  }

  // ---- onda de morcegos ----------------------------------------------------------------------------------------------

  /**
   * Depois de 3 ninhos e então a cada 5 a 10: sem ninho, a floresta fica vermelha e vêm morcegos de cima (1; 2 a partir de 25 ninhos; 3 a partir
   * de 60) em zigue-zague na direção do macaco. Pedras infinitas; cada morcego abatido vale 10. Só depois de abater todos o
   * próximo ninho aparece. Se um morcego alcança o macaco, a partida acaba.
   */
  private startWave(): void {
    this.state = 'wave';
    this.setRedForest(true);
    const n = batCount(this.score.hits);
    this.banner(n === 1 ? 'MORCEGO!' : `${n} MORCEGOS!`, '#FF8A7A');
    const top = this.cameras.main.scrollY;
    const patterns = pickBatPatterns(n, Math.random);
    for (let i = 0; i < n; i++) {
      // cada um entra numa faixa da tela, para não virem juntos
      const baseX = 140 + ((i + 0.2 + Math.random() * 0.6) / n) * (GAME_W - 280);
      const img = this.add.image(baseX, top - 90, 'morcego_0').setDepth(DEPTH.bat).setVisible(false);
      const halo = this.add.image(baseX, top - 90, 'halo').setDepth(DEPTH.bat - 1).setVisible(false);
      this.bats.push({ img, halo, pattern: patterns[i]!, baseX, y: top - 90, t: Math.random() * Math.PI * 2, delay: 0.6 + i * BAT_STAGGER_S, alive: true });
    }
    this.setFacing(this.feet.x < GAME_W / 2);
  }

  private updateWave(dt: number): void {
    const speed = batSpeed(this.score.hits);
    const frame = Math.floor(this.time.now / BAT_FRAME_MS) % BAT_FLY_FRAMES;
    const head = { x: this.feet.x, y: this.feet.y + MONKEY_CENTER_DY };
    for (const m of this.bats) {
      if (!m.alive) continue;
      if (m.delay > 0) {
        m.delay -= dt;
        continue;
      }
      m.img.setVisible(true).setTexture(`morcego_${frame}`);
      const p = m.pattern;
      m.t += dt;
      m.y += speed * dt * (1 + p.surge * Math.sin(m.t * p.w * 2));
      m.baseX += Phaser.Math.Clamp(head.x - m.baseX, -p.homing * dt, p.homing * dt);
      // perto do macaco o zigue-zague fecha, para ele não passar ao lado
      const close = Phaser.Math.Clamp((head.y - m.y) / 500, 0.25, 1);
      const swing = batSwing(p, m.t);
      const x = Phaser.Math.Clamp(m.baseX + close * swing, 50, GAME_W - 50);
      m.img.setPosition(x, m.y).setFlipX(batSwing(p, m.t + 0.02) > swing); // o desenho olha para a esquerda
      m.halo.setVisible(true).setPosition(x, m.y).setScale(0.95 + 0.08 * Math.sin(this.time.now * 0.008));
      if (Math.hypot(x - head.x, m.y - head.y) < BAT_R + 36) {
        this.die();
        return;
      }
    }

    const camBottom = this.cameras.main.scrollY + GAME_H;
    const steps = Math.max(1, Math.round(dt / PHYS_DT));
    const h = dt / steps;
    for (const ws of this.waveStones) {
      for (let i = 0; i < steps && ws.img.active; i++) {
        const ev = stepStone(ws.st, h, null);
        if (ev.wall) this.flashEdge(ws.st.x);
        for (const m of this.bats) {
          if (m.alive && m.delay <= 0 && stoneHits(ws.st, { x: m.img.x, y: m.img.y, r: BAT_R })) {
            this.killBat(m);
            ws.img.destroy();
            break;
          }
        }
      }
      if (!ws.img.active) continue;
      ws.t += dt;
      ws.img.setPosition(ws.st.x, ws.st.y).setRotation(ws.img.rotation + ws.st.vx * dt * 0.02);
      if (ws.st.y > camBottom + 60 || ws.t > MAX_FLIGHT_S) ws.img.destroy();
    }
    this.waveStones = this.waveStones.filter((ws) => ws.img.active);

    if (this.bats.every((m) => !m.alive)) this.endWave();
  }

  private killBat(m: Bat): void {
    m.alive = false;
    this.score.score += BAT_POINTS;
    this.updateScore();
    this.popup(m.img.x, m.img.y - 60, `+${BAT_POINTS}`, '#FFB0A0', 44);
    // animação de morte (atingido e queda) só na hora em que é acertado
    let k = 0;
    this.time.addEvent({
      delay: BAT_FRAME_MS,
      repeat: BAT_DEATH_FRAMES.length - 1,
      callback: () => m.img.active && m.img.setTexture(`morcego_${BAT_DEATH_FRAMES[k++]}`),
    });
    m.img.setTexture(`morcego_${BAT_DEATH_FRAMES[0]}`);
    const fall = BAT_DEATH_FRAMES.length * BAT_FRAME_MS;
    this.tweens.add({ targets: m.img, y: m.img.y + 40, duration: 6 * BAT_FRAME_MS, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: m.img, y: m.img.y + 700, alpha: 0, delay: 6 * BAT_FRAME_MS, duration: fall, ease: 'Quad.easeIn', onComplete: () => m.img.destroy() });
    this.tweens.add({ targets: m.halo, alpha: 0, scale: 1.6, duration: 300, onComplete: () => m.halo.destroy() });
  }

  private endWave(): void {
    for (const ws of this.waveStones) ws.img.destroy();
    this.waveStones = [];
    this.bats = [];
    this.setRedForest(false);
    this.banner('LIVRE!', '#BDF5A8');
    this.nextWaveAt = this.score.hits + nextWaveGap(Math.random);
    this.spawnTarget(this.cur.index + 1);
    this.faceTarget();
    this.state = 'aim';
  }

  /** Filtro vermelho na imagem de fundo da floresta (entra e sai suavemente). */
  private setRedForest(on: boolean): void {
    const from = Phaser.Display.Color.ValueToColor(on ? 0xffffff : WAVE_TINT);
    const to = Phaser.Display.Color.ValueToColor(on ? WAVE_TINT : 0xffffff);
    this.tweens.addCounter({
      from: 0,
      to: 100,
      duration: 500,
      onUpdate: (tw) => {
        const c = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, 100, tw.getValue() ?? 0);
        this.bg.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
      },
      onComplete: () => {
        if (!on) this.bg.clearTint();
      },
    });
  }

  private banner(s: string, color: string): void {
    const t = this.add
      .text(GAME_W / 2, GAME_H * 0.36, s, { fontFamily: FONT, fontSize: '64px', color, stroke: COLORS.stroke, strokeThickness: 12 })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud)
      .setScale(0.6)
      .setAlpha(0);
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, duration: 400, delay: 1100, onComplete: () => t.destroy() });
  }

  // ---- fim de jogo ----------------------------------------------------------------------------------------------------

  private die(): void {
    if (this.state === 'dead') return;
    this.state = 'dead';
    this.stone = null;
    this.stoneImg.setVisible(false);
    this.dots.clear();
    this.aim = null;
    this.monkey.setTint(0xff7a7a);
    this.cameras.main.shake(220, 0.01);
    this.bridge.sendGameOver({
      runId: this.runId,
      score: this.score.score,
      durationMs: Math.round(this.time.now - this.startedAt),
      meta: { nests: this.score.hits, bestStreak: this.score.bestStreak },
    });
    this.time.delayedCall(600, () => this.showGameOver());
  }

  private showGameOver(): void {
    const cx = GAME_W / 2;
    const fix = <T extends Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth>(o: T, d: number) =>
      o.setScrollFactor(0).setDepth(d);
    fix(this.add.rectangle(cx, GAME_H / 2, GAME_W, GAME_H, 0x061008, 0.6), DEPTH.over);
    fix(this.add.rectangle(cx, 600, 560, 520, 0x3a2410, 0.95).setStrokeStyle(6, 0xf6e7b8, 0.9), DEPTH.over + 1);
    const txt = (y: number, s: string, size: number, color: string, font = FONT) =>
      fix(
        this.add.text(cx, y, s, { fontFamily: font, fontSize: `${size}px`, color, stroke: '#1a0f05', strokeThickness: 7, align: 'center' }).setOrigin(0.5),
        DEPTH.over + 2,
      );
    txt(420, 'FIM DE JOGO', 58, '#FF8A6A');
    txt(500, 'PONTOS', 26, COLORS.textMuted, FONT_TEXT);
    txt(570, String(this.score.score), 86, '#FFFFFF');
    const n = this.score.hits;
    txt(650, `${n} ${n === 1 ? 'ninho' : 'ninhos'} · melhor sequência ${this.score.bestStreak}`, 28, '#F6E7B8', FONT_TEXT);

    // Dentro do hub, o botão de recomeçar é do hub (mensagem `restart`); fora dele (desenvolvimento) mostramos o nosso.
    if (!this.bridge.embedded) {
      const btn = fix(this.add.rectangle(cx, 760, 320, 84, 0x5d8a2e).setStrokeStyle(5, 0xffffff), DEPTH.over + 2).setInteractive({ useHandCursor: true });
      txt(760, 'REINICIAR', 38, '#FFFFFF');
      btn.once('pointerup', () => this.scene.start('Menu'));
      this.input.keyboard?.once('keydown-ENTER', () => this.scene.start('Menu'));
      this.input.keyboard?.once('keydown-SPACE', () => this.scene.start('Menu'));
    } else {
      txt(760, 'Toque em “Jogar de novo”', 28, COLORS.textMuted, FONT_TEXT);
    }
  }

  // ---- efeitos --------------------------------------------------------------------------------------------------------

  private popup(x: number, y: number, s: string, color: string, size: number): void {
    const t = this.add
      .text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, stroke: COLORS.stroke, strokeThickness: 7 })
      .setOrigin(0.5)
      .setDepth(DEPTH.fx);
    t.x = Phaser.Math.Clamp(x, t.width / 2 + 10, GAME_W - t.width / 2 - 10);
    this.tweens.add({ targets: t, y: y - 70, alpha: 0, duration: 1100, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }
}
