import Phaser from 'phaser';
import type { HubBridge } from '@flix/game-sdk';
import {
  ENERGY_MS, FIRE_INTERVAL, GUN_MS, JETPACK_MS, JETPACK_WARN_MS, SHOT_R, SHOT_SPEED, VIRUS_HIT_R, VIRUS_R,
  addKill, circleHitsBox, circlesOverlap, createPlayer, createRun, giveEnergy, giveGun, giveJetpack, hitbox, multiplier, mulberry32,
  nextPickupGap, nextPickupHeight, nextVirusGap, nextVirusHeight, onGround, pickPickupKind, speedAt, stepPlayer, tickRun,
  type Controls, type PickupKind,
} from '../logic';
import {
  BRIDGE, COLORS, FONT, FONT_TEXT, GAME_H, GAME_W, GROUND_Y, GUN_SPRITE_FIX, PLAYER_X, SPRITE_ANCHOR, SPRITE_SCALE,
} from '../theme';

const STRIDE_PX = 30; // distância percorrida a cada troca de quadro da corrida (4 quadros)
const PICKUP_R = 32; // raio de colisão dos bônus
const VIRUS_EXTRA_SPEED = 40; // o vírus avança um pouco mais rápido que o cenário
const TOWER_H = 520; // altura da torre 5G na tela (o jogo tem 540); a base fica na borda inferior
const WAVE_INTERVAL = 0.11; // segundos entre ondas de wifi com o jetpack subindo

/**
 * Três planos: o fundo (cidades e ponte, profundidade 0 a 2), o meio (personagem, bônus, vírus e tiros, 5 a 11) e a frente
 * (torre 5G, 12): a personagem passa por trás da torre. A interface fica acima de tudo (50 em diante).
 */
const DEPTH = { city: 0, bridge: 2, shadow: 5, item: 8, virus: 9, player: 10, shot: 11, tower: 12, hud: 50, over: 90 } as const;

interface Wave {
  img: Phaser.GameObjects.Image;
  age: number;
  life: number;
  vx: number;
  vy: number;
  s0: number;
  s1: number;
}
interface Pickup { kind: PickupKind; x: number; h: number; img: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image }
interface Virus { x: number; h: number; phase: number; img: Phaser.GameObjects.Image }
interface Shot { x: number; y: number; img: Phaser.GameObjects.Image }

const PICKUP_LOOK: Record<PickupKind, { tex: string; scale: number; glow: number; toast: string }> = {
  router: { tex: 'router', scale: 3, glow: 0x66b8ff, toast: 'WI-FI JETPACK!' },
  energy: { tex: 'bateria', scale: 0.42, glow: 0x66ff99, toast: 'ENERGIA! PONTOS x3' },
  gun: { tex: 'arma', scale: 0.55, glow: 0x66ddff, toast: 'ARMA WI-FI! ATIRA SOZINHA' },
};

type BarId = 'jet' | 'energy' | 'gun';
const BARS: Array<{ id: BarId; label: string; color: number }> = [
  { id: 'jet', label: 'WI-FI JETPACK', color: COLORS.wifi },
  { id: 'energy', label: 'ENERGIA x3', color: 0x2fd46b },
  { id: 'gun', label: 'ARMA WI-FI', color: 0x35d0ff },
];

/** Corrida lateral infinita (G01): correr, saltar, abaixar, pegar bônus (jetpack, energia x3, arma de wifi) e fugir ou abater vírus. */
export class PlayScene extends Phaser.Scene {
  private bridge!: HubBridge;
  private runId = '';
  private state: 'playing' | 'dead' = 'playing';
  private overShown = false;

  /** Ciclo do cenário: [cidade A, cidade B]; cada uma aparece duas vezes (ciclo atual e próximo). */
  private cities: Phaser.GameObjects.Image[] = [];
  private towers: Phaser.GameObjects.Image[] = [];
  private cityStarts: number[] = []; // início de cada cidade dentro de um ciclo
  private bridges: Phaser.GameObjects.Image[] = []; // uma ponte sobre o rio de cada cidade B
  private cycleW = 0; // largura de um ciclo (A + B)
  private bgX = 0;

  private player = createPlayer();
  private run = createRun();
  private sprite!: Phaser.GameObjects.Image;
  private gunImg!: Phaser.GameObjects.Image;
  private shadow!: Phaser.GameObjects.Ellipse;

  private rng = mulberry32(Date.now() & 0xffff);
  private pickups: Pickup[] = [];
  private viruses: Virus[] = [];
  private shots: Shot[] = [];
  private nextPickupIn = 0;
  private nextVirusIn = 0;
  private fireTimer = 0;

  private waves: Wave[] = [];
  private wavePool: Phaser.GameObjects.Image[] = [];
  private waveTimer = 0;

  private seconds = 0;
  private stride = 0;
  private animT = 0;
  private jumpBuffer = 0;

  private keys!: Record<'space' | 'up' | 'w' | 'down' | 's' | 'enter', Phaser.Input.Keyboard.Key>;
  private jumpPointers = new Set<number>();
  private duckPointers = new Set<number>();

  private hudScore!: Phaser.GameObjects.Text;
  private hudMult!: Phaser.GameObjects.Text;
  private hudKills!: Phaser.GameObjects.Text;
  private bars: Array<{ id: BarId; bg: Phaser.GameObjects.Rectangle; fill: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }> = [];
  private hints: Phaser.GameObjects.GameObject[] = [];
  private toast!: Phaser.GameObjects.Text;

  constructor() {
    super('Play');
  }

  create(): void {
    this.bridge = this.registry.get('bridge') as HubBridge;
    this.state = 'playing';
    this.overShown = false;
    this.player = createPlayer();
    this.run = createRun();
    this.seconds = this.stride = this.animT = this.jumpBuffer = this.waveTimer = this.fireTimer = 0;
    this.bgX = 250; // começa com a torre da primeira emenda já fora da tela
    this.waves = [];
    this.wavePool = [];
    this.pickups = [];
    this.viruses = [];
    this.shots = [];
    this.jumpPointers.clear();
    this.duckPointers.clear();
    this.nextPickupIn = 500; // o primeiro bônus aparece cedo
    this.nextVirusIn = 900;

    this.buildScenery();
    this.buildPlayer();
    this.buildHud();
    this.bindInput();

    const onRestart = () => this.scene.restart();
    this.game.events.on('hub-restart', onRestart);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off('hub-restart', onRestart));

    this.runId = this.bridge.newRunId();
    this.bridge.sendStarted(this.runId);
  }

  // ---- montagem ---------------------------------------------------------------------------------------------------

  /**
   * Cenário infinito: cidade A, torre 5G, cidade B, torre 5G, e de novo. A torre fica em cima de cada emenda e esconde o corte
   * entre as duas imagens (sem fade). Quatro cidades e quatro torres revezam de posição conforme o cenário rola.
   */
  private buildScenery(): void {
    const wA = this.textures.get('cidade_a').getSourceImage().width as number;
    const wB = this.textures.get('cidade_b').getSourceImage().width as number;
    this.cityStarts = [0, wA];
    this.cycleW = wA + wB;
    this.cities = [];
    this.towers = [];
    this.bridges = [];
    for (let n = 0; n < 2; n++) {
      for (const key of ['cidade_a', 'cidade_b']) {
        this.cities.push(this.add.image(0, 0, key).setOrigin(0, 0).setDepth(DEPTH.city));
        // a torre é o plano da frente: a personagem passa por trás dela
        const t = this.add.image(0, GAME_H, 'torre').setOrigin(0.5, 1).setDepth(DEPTH.tower);
        t.setScale(TOWER_H / t.height);
        this.towers.push(t);
      }
      // o rio está na cidade B: a ponte fica por cima da água, com o piso na linha do chão, e a personagem corre sobre ela
      this.bridges.push(this.add.image(0, GROUND_Y - BRIDGE.deckTop, 'ponte').setOrigin(0, 0).setDepth(DEPTH.bridge));
    }
    this.positionScenery();
  }

  private buildPlayer(): void {
    this.shadow = this.add.ellipse(PLAYER_X, GROUND_Y + 2, 80, 14, 0x000000, 0.32).setDepth(DEPTH.shadow);
    this.sprite = this.add.image(PLAYER_X, GROUND_Y, 'pl_run_0').setOrigin(SPRITE_ANCHOR.run_0, 1).setScale(SPRITE_SCALE).setDepth(DEPTH.player);
    // arma pequena nas mãos quando ela não está na pose de corrida armada (salto, voo, agachada)
    this.gunImg = this.add.image(0, 0, 'arma').setScale(0.3).setAngle(25).setDepth(DEPTH.shot).setVisible(false);
  }

  private buildHud(): void {
    const stroke = { stroke: '#0a2a5c', strokeThickness: 6 };
    this.add.text(24, 14, 'PONTOS', { fontFamily: FONT_TEXT, fontSize: '18px', color: COLORS.textMuted, ...stroke }).setDepth(DEPTH.hud);
    this.hudScore = this.add.text(24, 34, '0', { fontFamily: FONT, fontSize: '46px', color: COLORS.text, ...stroke }).setDepth(DEPTH.hud);
    this.hudMult = this.add.text(0, 44, 'x3', { fontFamily: FONT, fontSize: '30px', color: '#5CFF9A', ...stroke }).setDepth(DEPTH.hud).setVisible(false);
    this.add
      .text(GAME_W - 24, 14, 'VÍRUS ABATIDOS', { fontFamily: FONT_TEXT, fontSize: '18px', color: COLORS.textMuted, ...stroke })
      .setOrigin(1, 0)
      .setDepth(DEPTH.hud);
    this.hudKills = this.add
      .text(GAME_W - 24, 34, '0', { fontFamily: FONT, fontSize: '46px', color: '#FF7A85', ...stroke })
      .setOrigin(1, 0)
      .setDepth(DEPTH.hud);

    // uma barra por bônus ativo, empilhadas no topo, no centro
    this.bars = BARS.map((b) => ({
      id: b.id,
      bg: this.add.rectangle(GAME_W / 2, 0, 300, 24, 0x06214d, 0.72).setStrokeStyle(3, 0xffffff, 0.85).setDepth(DEPTH.hud).setVisible(false),
      fill: this.add.rectangle(GAME_W / 2 - 146, 0, 292, 16, b.color).setOrigin(0, 0.5).setDepth(DEPTH.hud + 1).setVisible(false),
      label: this.add
        .text(GAME_W / 2, 0, b.label, { fontFamily: FONT_TEXT, fontSize: '15px', color: '#FFFFFF', stroke: '#06214d', strokeThickness: 4 })
        .setOrigin(0.5)
        .setDepth(DEPTH.hud + 2)
        .setVisible(false),
    }));

    this.toast = this.add
      .text(GAME_W / 2, 150, '', { fontFamily: FONT, fontSize: '38px', color: '#FFFFFF', stroke: '#0a4fb5', strokeThickness: 8 })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud + 10)
      .setAlpha(0);

    // dicas de controle, somem depois de alguns segundos
    const hint = (x: number, text: string) =>
      this.add
        .text(x, GAME_H - 28, text, { fontFamily: FONT_TEXT, fontSize: '22px', color: '#FFFFFF', stroke: '#0a2a5c', strokeThickness: 5, align: 'center' })
        .setOrigin(0.5)
        .setDepth(DEPTH.hud);
    this.hints = [hint(GAME_W * 0.15, '▼ ABAIXAR\n(segurar)'), hint(GAME_W * 0.65, '▲ PULAR\n(segurar = voar com o roteador)')];
    this.time.delayedCall(6000, () => this.tweens.add({ targets: this.hints, alpha: 0, duration: 600 }));
  }

  private bindInput(): void {
    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      space: kb.addKey(K.SPACE), up: kb.addKey(K.UP), w: kb.addKey(K.W), down: kb.addKey(K.DOWN), s: kb.addKey(K.S), enter: kb.addKey(K.ENTER),
    };
    kb.addCapture([K.SPACE, K.UP, K.DOWN]);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.state !== 'playing') return;
      if (p.x < GAME_W * 0.3) {
        this.duckPointers.add(p.id);
      } else {
        this.jumpPointers.add(p.id);
        this.jumpBuffer = 0.12;
      }
    });
    const up = (p: Phaser.Input.Pointer) => {
      this.jumpPointers.delete(p.id);
      this.duckPointers.delete(p.id);
    };
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', up);
    this.input.on('gameout', () => {
      this.jumpPointers.clear();
      this.duckPointers.clear();
    });
  }

  // ---- laço -------------------------------------------------------------------------------------------------------

  update(_t: number, deltaMs: number): void {
    const dt = Math.min(deltaMs, 50) / 1000;

    if (this.state === 'dead') {
      this.updateWaves(dt);
      if (this.overShown && (Phaser.Input.Keyboard.JustDown(this.keys.enter) || Phaser.Input.Keyboard.JustDown(this.keys.space))) {
        this.scene.restart();
      }
      return;
    }

    this.seconds += dt;
    const speed = speedAt(this.seconds);

    // controles
    const k = this.keys;
    if (Phaser.Input.Keyboard.JustDown(k.space) || Phaser.Input.Keyboard.JustDown(k.up) || Phaser.Input.Keyboard.JustDown(k.w)) {
      this.jumpBuffer = 0.12;
    }
    const jumpHeld = k.space.isDown || k.up.isDown || k.w.isDown || this.jumpPointers.size > 0;
    const duckHeld = k.down.isDown || k.s.isDown || this.duckPointers.size > 0;
    const ctl: Controls = { jumpHeld, duckHeld, jumpPressed: this.jumpBuffer > 0 && onGround(this.player) };
    if (ctl.jumpPressed) this.jumpBuffer = 0;
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);

    stepPlayer(this.player, ctl, dt);
    tickRun(this.run, dt);
    this.stride += speed * dt;

    this.scrollScenery(speed * dt);
    this.updateSpawns(speed, dt);
    this.updateGun(dt);
    this.updateShots(dt);
    this.updatePickups(speed, dt);
    this.updateViruses(speed, dt);
    this.updatePlayerSprite(dt);
    this.updateWaves(dt);
    this.updateHud();
  }

  private scrollScenery(dx: number): void {
    this.bgX = (this.bgX + dx) % this.cycleW;
    this.positionScenery();
  }

  /** Posiciona as cidades e as torres (uma torre sobre o início de cada cidade). */
  private positionScenery(): void {
    const off = Math.floor(this.bgX);
    let i = 0;
    for (let n = 0; n < 2; n++) {
      for (const start of this.cityStarts) {
        const x = n * this.cycleW + start - off;
        this.cities[i]!.setPosition(x, 0).setVisible(x < GAME_W && x + this.cities[i]!.width > 0);
        const t = this.towers[i]!;
        t.setPosition(x, GAME_H).setVisible(Math.abs(x - GAME_W / 2) < GAME_W / 2 + t.displayWidth / 2);
        if (i % 2 === 1) {
          const br = this.bridges[(i - 1) / 2]!;
          br.x = x + BRIDGE.x;
          br.setVisible(br.x < GAME_W && br.x + br.width > 0);
        }
        i++;
      }
    }
  }

  // ---- personagem -----------------------------------------------------------------------------------------------

  /** Ponta da arma de wifi na tela (de onde sai o tiro). */
  private muzzle(): { x: number; y: number } {
    const p = this.player;
    return { x: PLAYER_X + 38, y: GROUND_Y - p.y - (p.ducking && onGround(p) && p.jetMs <= 0 ? 36 : 62) };
  }

  private updatePlayerSprite(dt: number): void {
    const p = this.player;
    const jet = p.jetMs > 0;
    const grounded = onGround(p);
    const gun = this.run.gunMs > 0;
    this.animT += dt;

    let name: string;
    if (jet) name = `fly_${Math.floor(this.animT * (p.thrusting ? 4 : 2.5)) % 2}`; // troca lenta, para não piscar
    else if (!grounded) name = p.vy > 0 ? 'jump' : 'fall';
    else if (p.ducking) name = 'duck';
    else if (gun) name = 'gun';
    else name = `run_${Math.floor(this.stride / STRIDE_PX) % 4}`;
    this.sprite.setTexture(`pl_${name}`).setOrigin(SPRITE_ANCHOR[name] ?? 0.5, 1);
    this.sprite.setScale(SPRITE_SCALE * (name === 'gun' ? GUN_SPRITE_FIX : 1));

    const feetY = GROUND_Y - p.y;
    this.sprite.y = feetY;
    const sh = Math.max(0.35, 1 - p.y / 420);
    this.shadow.setScale(sh, sh).setAlpha(0.32 * sh);

    // arma pequena quando o sprite não é o da pose armada
    const m = this.muzzle();
    this.gunImg.setVisible(gun && name !== 'gun').setPosition(m.x - 14, m.y);

    // pisca nos últimos segundos do jetpack
    const warn = jet && p.jetMs < JETPACK_WARN_MS;
    this.sprite.setAlpha(warn && Math.floor(this.animT * 10) % 2 === 0 ? 0.55 : 1);

    // ondas de wifi para baixo, saindo do roteador nas costas
    if (jet && p.thrusting) {
      this.waveTimer -= dt;
      while (this.waveTimer <= 0) {
        this.waveTimer += WAVE_INTERVAL;
        this.emitWave(PLAYER_X - 34, feetY - 58);
      }
    } else {
      this.waveTimer = 0;
    }
  }

  private emitWave(x: number, y: number): void {
    const img =
      this.wavePool.pop() ?? this.add.image(0, 0, 'wifi_wave').setDepth(DEPTH.item).setBlendMode(Phaser.BlendModes.ADD);
    const s0 = 0.35 + this.rng() * 0.1;
    img.setPosition(x + (this.rng() - 0.5) * 8, y).setScale(s0).setAlpha(0.95).setVisible(true);
    this.waves.push({ img, age: 0, life: 0.55 + this.rng() * 0.1, vx: -40, vy: 420, s0, s1: 1.15 });
  }

  private updateWaves(dt: number): void {
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i]!;
      w.age += dt;
      const t = w.age / w.life;
      if (t >= 1) {
        w.img.setVisible(false);
        this.wavePool.push(w.img);
        this.waves.splice(i, 1);
        continue;
      }
      w.img.x += w.vx * dt;
      w.img.y += w.vy * dt;
      w.img.setScale(w.s0 + (w.s1 - w.s0) * t).setAlpha(0.95 * (1 - t * t));
    }
  }

  // ---- surgimento de bônus e vírus ------------------------------------------------------------------------------

  /** Nada (bônus ou vírus) perto do ponto de surgimento: evita sobrepor. */
  private clearAtSpawn(): boolean {
    const x = GAME_W + 60;
    return [...this.pickups, ...this.viruses].every((e) => Math.abs(e.x - x) > 280);
  }

  private updateSpawns(speed: number, dt: number): void {
    this.nextPickupIn -= speed * dt;
    if (this.nextPickupIn <= 0) {
      if (this.clearAtSpawn()) {
        this.spawnPickup(pickPickupKind(this.rng));
        this.nextPickupIn = nextPickupGap(this.rng);
      } else {
        this.nextPickupIn = 150;
      }
    }
    this.nextVirusIn -= speed * dt;
    if (this.nextVirusIn <= 0) {
      if (this.clearAtSpawn()) {
        this.spawnVirus();
        this.nextVirusIn = nextVirusGap(this.rng);
      } else {
        this.nextVirusIn = 150;
      }
    }
  }

  // ---- bônus ----------------------------------------------------------------------------------------------------------

  private spawnPickup(kind: PickupKind): void {
    const look = PICKUP_LOOK[kind];
    const x = GAME_W + 60;
    const h = nextPickupHeight(this.rng);
    const glow = this.add.image(x, GROUND_Y - h, 'glow').setDepth(DEPTH.item - 1).setScale(1.2).setTint(look.glow).setBlendMode(Phaser.BlendModes.ADD);
    const img = this.add.image(x, GROUND_Y - h, look.tex).setScale(look.scale).setDepth(DEPTH.item);
    this.pickups.push({ kind, x, h, img, glow });
  }

  private updatePickups(speed: number, dt: number): void {
    const box = hitbox(this.player, PLAYER_X);
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const it = this.pickups[i]!;
      it.x -= speed * dt;
      const bob = Math.sin(this.seconds * 4 + it.h) * 6;
      const y = GROUND_Y - it.h - bob;
      it.img.setPosition(it.x, y);
      it.glow.setPosition(it.x, y).setAlpha(0.5 + Math.sin(this.seconds * 6) * 0.2);
      if (circleHitsBox(it.x, it.h + bob, PICKUP_R, box)) {
        this.collect(it.kind);
        this.destroyPickup(i);
      } else if (it.x < -80) {
        this.destroyPickup(i);
      }
    }
  }

  private destroyPickup(i: number): void {
    const it = this.pickups[i]!;
    it.img.destroy();
    it.glow.destroy();
    this.pickups.splice(i, 1);
  }

  private collect(kind: PickupKind): void {
    this.showToast(PICKUP_LOOK[kind].toast);
    if (kind === 'router') {
      const had = this.player.jetMs > 0;
      giveJetpack(this.player);
      // pequeno impulso para cima e uma onda de wifi ao redor da personagem
      if (!had && onGround(this.player)) this.player.vy = 380;
      for (let i = 0; i < 3; i++) this.time.delayedCall(i * 80, () => this.emitWave(this.sprite.x - 20, this.sprite.y - 90));
    } else if (kind === 'energy') {
      giveEnergy(this.run);
    } else {
      giveGun(this.run);
      this.fireTimer = 0.15; // o primeiro tiro sai logo
    }
  }

  private showToast(text: string): void {
    this.toast.setText(text).setAlpha(1).setScale(0.6);
    this.tweens.killTweensOf(this.toast);
    this.tweens.add({ targets: this.toast, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.toast, alpha: 0, delay: 1100, duration: 500 });
  }

  // ---- arma de wifi e tiros -------------------------------------------------------------------------------------

  /** Com a arma ligada ela atira sozinha, em linha reta, a cada FIRE_INTERVAL. Para acertar, alinhe a altura com o vírus. */
  private updateGun(dt: number): void {
    if (this.run.gunMs <= 0) return;
    this.fireTimer -= dt;
    if (this.fireTimer > 0) return;
    this.fireTimer = FIRE_INTERVAL;
    const m = this.muzzle();
    const img = this.add.image(m.x, m.y, 'wifi_wave').setAngle(-90).setScale(0.45).setDepth(DEPTH.shot).setBlendMode(Phaser.BlendModes.ADD);
    this.shots.push({ x: m.x, y: m.y, img });
  }

  private updateShots(dt: number): void {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i]!;
      s.x += SHOT_SPEED * dt;
      s.img.setPosition(s.x, s.y).setScale(0.45 + (s.x - PLAYER_X) / 2400);
      const hit = this.viruses.findIndex((v) => circlesOverlap(s.x, s.y, SHOT_R, v.x, GROUND_Y - v.h, VIRUS_R));
      if (hit >= 0) {
        this.killVirus(hit);
        s.img.destroy();
        this.shots.splice(i, 1);
      } else if (s.x > GAME_W + 60) {
        s.img.destroy();
        this.shots.splice(i, 1);
      }
    }
  }

  // ---- vírus ----------------------------------------------------------------------------------------------------------

  private spawnVirus(): void {
    const h = nextVirusHeight(this.rng);
    const x = GAME_W + 60;
    const img = this.add.image(x, GROUND_Y - h, 'virus').setScale(0.5).setDepth(DEPTH.virus);
    this.viruses.push({ x, h, phase: this.rng() * 6.28, img });
  }

  private updateViruses(speed: number, dt: number): void {
    const box = hitbox(this.player, PLAYER_X);
    for (let i = this.viruses.length - 1; i >= 0; i--) {
      const v = this.viruses[i]!;
      v.x -= (speed + VIRUS_EXTRA_SPEED) * dt;
      v.img.setPosition(v.x, GROUND_Y - v.h + Math.sin(this.seconds * 5 + v.phase) * 3).setAngle(Math.sin(this.seconds * 3 + v.phase) * 8);
      if (circleHitsBox(v.x, v.h, VIRUS_HIT_R, box)) {
        this.die();
        return;
      }
      if (v.x < -100) {
        v.img.destroy();
        this.viruses.splice(i, 1);
      }
    }
  }

  private killVirus(i: number): void {
    const v = this.viruses[i]!;
    const pts = addKill(this.run);
    this.viruses.splice(i, 1);
    this.tweens.add({ targets: v.img, scale: 0.85, alpha: 0, duration: 180, onComplete: () => v.img.destroy() });
    const t = this.add
      .text(v.x, GROUND_Y - v.h - 30, `+${pts}`, { fontFamily: FONT, fontSize: '30px', color: multiplier(this.run) > 1 ? '#5CFF9A' : '#FFD43B', stroke: '#06214d', strokeThickness: 6 })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);
    this.tweens.add({ targets: t, y: t.y - 50, alpha: 0, duration: 800, onComplete: () => t.destroy() });
  }

  // ---- fim de jogo ----------------------------------------------------------------------------------------------

  /** Pontuação mostrada e enviada ao hub. */
  get score(): number {
    return Math.floor(this.run.score);
  }

  private die(): void {
    if (this.state === 'dead') return;
    this.state = 'dead';
    this.jumpPointers.clear();
    this.duckPointers.clear();
    this.sprite.setTint(0xff5a5a).setAlpha(1);
    this.gunImg.setVisible(false);
    this.cameras.main.shake(250, 0.012);
    this.updateHud();
    this.bridge.sendGameOver({
      runId: this.runId,
      score: this.score,
      durationMs: Math.round(this.seconds * 1000),
      meta: { kills: this.run.kills },
    });
    this.time.delayedCall(600, () => this.showGameOver());
  }

  private showGameOver(): void {
    this.overShown = true;
    const cx = GAME_W / 2;
    this.add.rectangle(cx, GAME_H / 2, GAME_W, GAME_H, 0x041022, 0.62).setDepth(DEPTH.over);
    this.add.rectangle(cx, 270, 520, 360, 0x0b2a5c, 0.94).setStrokeStyle(5, 0xffffff, 0.9).setDepth(DEPTH.over + 1);
    const txt = (y: number, s: string, size: number, color: string, font = FONT) =>
      this.add
        .text(cx, y, s, { fontFamily: font, fontSize: `${size}px`, color, stroke: '#041022', strokeThickness: 6 })
        .setOrigin(0.5)
        .setDepth(DEPTH.over + 2);
    txt(130, 'FIM DE JOGO', 46, '#FF5A6A');
    txt(190, 'PONTOS', 20, COLORS.textMuted, FONT_TEXT);
    txt(242, String(this.score), 64, '#FFFFFF');
    txt(300, `${this.run.kills} ${this.run.kills === 1 ? 'vírus abatido' : 'vírus abatidos'}`, 24, '#FFD1D6', FONT_TEXT);

    // Dentro do hub, o botão de recomeçar é do hub (mensagem `restart`); fora dele (desenvolvimento) mostramos o nosso.
    if (!this.bridge.embedded) {
      const btn = this.add.rectangle(cx, 372, 260, 64, COLORS.flixRed).setStrokeStyle(4, 0xffffff).setDepth(DEPTH.over + 2).setInteractive({ useHandCursor: true });
      txt(372, 'REINICIAR', 30, '#FFFFFF');
      btn.on('pointerover', () => btn.setFillStyle(0xf0304a));
      btn.on('pointerout', () => btn.setFillStyle(COLORS.flixRed));
      btn.once('pointerdown', () => this.scene.restart());
    } else {
      txt(372, 'Toque em “Jogar de novo”', 22, COLORS.textMuted, FONT_TEXT);
    }
  }

  // ---- HUD ----------------------------------------------------------------------------------------------------------

  private updateHud(): void {
    const r = this.run;
    this.hudScore.setText(String(this.score)).setColor(r.energyMs > 0 ? '#5CFF9A' : COLORS.text);
    this.hudMult.setVisible(r.energyMs > 0).setX(this.hudScore.x + this.hudScore.width + 10);
    this.hudKills.setText(String(r.kills));

    const left: Record<BarId, { ms: number; max: number }> = {
      jet: { ms: this.player.jetMs, max: JETPACK_MS },
      energy: { ms: r.energyMs, max: ENERGY_MS },
      gun: { ms: r.gunMs, max: GUN_MS },
    };
    let row = 0;
    for (const b of this.bars) {
      const info = left[b.id];
      const on = info.ms > 0;
      for (const o of [b.bg, b.fill, b.label]) o.setVisible(on);
      if (!on) continue;
      const y = 26 + row * 34;
      row++;
      b.bg.setY(y);
      b.fill.setY(y);
      b.label.setY(y).setText(`${BARS.find((x) => x.id === b.id)!.label} · ${Math.ceil(info.ms / 1000)}s`);
      b.fill.width = 292 * (info.ms / info.max);
      const warn = info.ms < (b.id === 'jet' ? JETPACK_WARN_MS : 2000) && Math.floor(this.animT * 8) % 2 === 0;
      b.fill.setFillStyle(warn ? 0xff4a5a : BARS.find((x) => x.id === b.id)!.color);
    }
  }
}
