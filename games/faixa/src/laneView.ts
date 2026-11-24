import Phaser from 'phaser';
import { PAD, VEHICLE_LEN, logKey, propKey, vehicleKey } from './art';
import {
  COLS, MARGIN, mulberry32, moverLeft, trainState,
  type Lane, type Mover, type RailLane,
} from './logic';
import { CELL, COLORS, GAME_W, PLAY_X } from './theme';

/** Posição horizontal da borda esquerda de um objeto (em blocos) na tela. */
const px = (left: number): number => PLAY_X + left * CELL;

interface Sprite {
  img: Phaser.GameObjects.Image;
  m: Mover;
  w: number;
}

/**
 * Tudo o que se vê de uma faixa: fundo, obstáculos e os objetos em movimento. A posição dos objetos vem de
 * `moverLeft(t)`, nunca de estado guardado aqui, então a cena só precisa chamar `update(t)`. `destroy` libera tudo
 * quando a faixa fica para trás da câmera.
 */
export class LaneView {
  readonly container: Phaser.GameObjects.Container;
  private readonly sprites: Sprite[] = [];
  private train?: Phaser.GameObjects.Graphics;
  private signal?: Phaser.GameObjects.Graphics;
  private lastBeep = -1;
  /** Cena avisa quando o sinal do trem pisca (para tocar o bipe). */
  onBeep?: () => void;
  onTrain?: () => void;
  private wasPassing = false;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly lane: Lane,
    roadAbove: boolean,
  ) {
    const topY = -(lane.index + 1) * CELL;
    this.container = scene.add.container(0, topY).setDepth(0);
    const bg = scene.add.graphics();
    this.container.add(bg);
    const rng = mulberry32(lane.index * 7919 + 13);

    switch (lane.kind) {
      case 'grass': {
        bg.fillStyle(lane.index % 2 === 0 ? COLORS.grassA : COLORS.grassB, 1).fillRect(0, 0, GAME_W, CELL);
        bg.fillStyle(COLORS.grassDark, 0.5);
        for (let i = 0; i < 9; i++) bg.fillRect(PLAY_X + rng() * 230, 3 + rng() * 20, 1.5, 3);
        lane.blocked.forEach((b, c) => {
          if (b) this.add(scene.add.image(PLAY_X + c * CELL + CELL / 2, CELL / 2, propKey(lane.props[c] ?? 0)).setDisplaySize(CELL, CELL));
        });
        break;
      }
      case 'road': {
        bg.fillStyle(COLORS.asphalt, 1).fillRect(0, 0, GAME_W, CELL);
        bg.fillStyle(COLORS.asphaltEdge, 1).fillRect(0, 0, GAME_W, 1.5).fillRect(0, CELL - 1.5, GAME_W, 1.5);
        if (roadAbove) {
          bg.fillStyle(COLORS.roadLine, 0.85);
          for (let x = 0; x < GAME_W; x += 20) bg.fillRect(x, -1, 11, 2);
        }
        for (const v of lane.vehicles) {
          const w = VEHICLE_LEN[v.variant] ?? 1.4;
          const img = scene.add.image(0, CELL / 2, vehicleKey(v.variant)).setOrigin(0, 0.5).setDisplaySize(w * CELL, CELL).setFlipX(lane.dir === -1);
          this.add(img);
          this.sprites.push({ img, m: v, w: w * CELL });
        }
        break;
      }
      case 'river': {
        bg.fillStyle(COLORS.water, 1).fillRect(0, 0, GAME_W, CELL);
        bg.fillStyle(COLORS.waterLight, 0.35);
        for (let i = 0; i < 14; i++) bg.fillRect(PLAY_X + rng() * 220, 2 + rng() * 21, 8 + rng() * 8, 1.4);
        if (lane.mode === 'pads') {
          lane.pads.forEach((p, c) => {
            if (p) this.add(scene.add.image(PLAY_X + c * CELL + CELL / 2, CELL / 2, PAD).setDisplaySize(CELL, CELL).setAngle(rng() * 360));
          });
        } else {
          for (const g of lane.logs) {
            const img = scene.add.image(0, CELL / 2, logKey(g.len, g.variant)).setOrigin(0, 0.5).setDisplaySize(g.len * CELL, CELL);
            this.add(img);
            this.sprites.push({ img, m: g, w: g.len * CELL });
          }
        }
        break;
      }
      case 'rail': {
        bg.fillStyle(COLORS.gravel, 1).fillRect(0, 0, GAME_W, CELL);
        bg.fillStyle(COLORS.gravelDark, 0.6);
        for (let i = 0; i < 24; i++) bg.fillRect(rng() * GAME_W, rng() * CELL, 2, 1.5);
        bg.fillStyle(COLORS.tie, 1);
        for (let x = 3; x < GAME_W; x += 9) bg.fillRect(x, 3, 4, CELL - 6);
        bg.fillStyle(COLORS.rail, 1).fillRect(0, 7, GAME_W, 2.2).fillRect(0, CELL - 9, GAME_W, 2.2);
        this.train = scene.add.graphics();
        this.signal = scene.add.graphics();
        this.container.add([this.train, this.signal]);
        break;
      }
    }
  }

  private add(o: Phaser.GameObjects.GameObject): void {
    this.container.add(o);
  }

  update(t: number): void {
    const lane = this.lane;
    if (lane.kind === 'road' || (lane.kind === 'river' && lane.mode === 'logs')) {
      for (const s of this.sprites) {
        const left = moverLeft(s.m, lane.dir, lane.speed, t);
        s.img.setX(px(left));
        s.img.setVisible(left + s.m.len > -0.5 && left < COLS + 0.5);
      }
    } else if (lane.kind === 'rail') {
      this.updateRail(lane, t);
    }
  }

  private updateRail(lane: RailLane, t: number): void {
    const s = trainState(lane, t);
    const sig = this.signal!;
    const trn = this.train!;
    sig.clear();
    trn.clear();
    if (s.phase === 'warning') {
      const on = Math.floor(t * 4) % 2 === 0;
      // placas de sinal nos dois cantos da faixa, piscando; mais rápido quanto mais perto o trem
      for (const x of [PLAY_X + 7, PLAY_X + COLS * CELL - 7]) {
        sig.fillStyle(0x15161a, 1).fillCircle(x, CELL / 2, 6);
        sig.fillStyle(on ? COLORS.warnRed : 0x5a1a1a, 1).fillCircle(x, CELL / 2, 4.2);
      }
      sig.fillStyle(COLORS.warnRed, on ? 0.18 : 0.06).fillRect(PLAY_X, 0, COLS * CELL, CELL);
      const beep = Math.floor(t * 4);
      if (beep !== this.lastBeep && on) this.onBeep?.();
      this.lastBeep = beep;
    }
    const passing = s.phase === 'passing';
    if (passing && !this.wasPassing) this.onTrain?.();
    this.wasPassing = passing;
    if (passing) {
      // locomotiva + vagões; a frente é o lado para onde o trem anda
      const len = lane.trainLen;
      const x0 = px(s.left);
      const w = len * CELL;
      const front = lane.dir === 1 ? x0 + w : x0;
      const dir = lane.dir;
      const car = 3.2 * CELL;
      let n = 0;
      for (let off = 0; off < w - 1; off += car, n++) {
        const cw = Math.min(car - 3, w - off);
        const cx = dir === 1 ? front - off - cw : front + off;
        const loco = off === 0;
        trn.fillStyle(0x000000, 0.25).fillRoundedRect(cx, 5, cw, CELL - 6, 4);
        trn.fillStyle(loco ? COLORS.flixRed : n % 2 ? 0x59606e : 0xdfe3ec, 1).fillRoundedRect(cx, 2.5, cw, CELL - 6, 4);
        trn.fillStyle(0x1b2c3d, 1);
        for (let wx = 6; wx < cw - 8; wx += 12) trn.fillRect(cx + wx, 7, 7, CELL - 16);
        if (loco) {
          trn.fillStyle(0xfff2a8, 1).fillRect(dir === 1 ? cx + cw - 4 : cx + 1, 6, 3, 4).fillRect(dir === 1 ? cx + cw - 4 : cx + 1, CELL - 14, 3, 4);
        }
      }
    }
  }

  destroy(): void {
    this.container.destroy(true);
    this.sprites.length = 0;
  }
}
