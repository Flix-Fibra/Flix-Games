import Phaser from 'phaser';
import { PADDLE_Y } from './logic';
import { DEPTH } from './theme';

/**
 * A jogadora com a raquete em cima da prancha voadora, embaixo da tela.
 * Medidas das imagens de `public/img/` (impressas por `tools/preparar-assets.py`):
 * - jogadora_N.png (203x251): pés em (79, 250), cabeça da raquete (quadro 0) em (160, 78).
 * - prancha_N.png (278x122): topo do deck (no meio) em y = 15.
 * Tudo desenhado na escala `SCALE`.
 */
const FEET = { x: 79, y: 250 };
const RACKET = { x: 160, y: 78 };
const BOARD_TOP = 15;
const FEET_SINK = 3; // os pés entram um pouco no deck, para ficarem colados
const SCALE = 0.62;
const TURN_SPEED = 60; // px/s: abaixo disso não vira (evita tremer quando o dedo para)
/** Tempo seguido indo para o outro lado antes de ela virar (ms). */
export const TURN_DELAY_MS = 100;
export const BOARD_FRAMES = 30;

/** Pés da jogadora: a cabeça da raquete fica exatamente na linha da rebatida. */
export const FEET_Y = PADDLE_Y + (FEET.y - RACKET.y) * SCALE;
/** Centro da área de rebatida em relação aos pés (entre a cabeça dela e a raquete). */
export const HIT_DX = Math.round(45 * SCALE);
/** Cabeça da raquete em relação ao centro da área de rebatida. */
export const RACKET_DX = (RACKET.x - FEET.x) * SCALE - HIT_DX;

const SWING = [1, 2, 3, 0];
const SWING_MS = 70;

export function makeBoardAnim(scene: Phaser.Scene): void {
  if (scene.anims.exists('prancha')) return;
  scene.anims.create({
    key: 'prancha',
    frames: Array.from({ length: BOARD_FRAMES }, (_, i) => ({ key: `prancha_${i}` })),
    frameRate: 10,
    repeat: -1,
  });
}

export class Surfer {
  readonly root: Phaser.GameObjects.Container;
  private girl: Phaser.GameObjects.Image;
  private board: Phaser.GameObjects.Sprite;
  private swingTimer: Phaser.Time.TimerEvent | null = null;
  private t = 0;
  private lastHitX: number;
  private tilt = 0;
  /** 1 = virada para a direita (raquete à direita), -1 = para a esquerda. */
  private facing = 1;
  /** Deslocamento do corpo em relação à área de rebatida; desliza ao virar, sem pulo. */
  private offset = HIT_DX;
  /** Há quanto tempo (s) o mouse está indo para o lado contrário ao que ela olha. */
  private turnT = 0;

  constructor(private scene: Phaser.Scene, hitX: number) {
    this.board = scene.add.sprite(0, FEET_SINK - BOARD_TOP, 'prancha_0').setOrigin(0.5, 0);
    this.board.play('prancha');
    this.girl = scene.add.image(0, 0, 'jogadora_0');
    this.girl.setOrigin(FEET.x / this.girl.width, FEET.y / this.girl.height);
    this.root = scene.add.container(hitX - HIT_DX, FEET_Y, [this.board, this.girl]).setScale(SCALE).setDepth(DEPTH.paddle);
    this.lastHitX = hitX;
  }

  /** Cabeça da raquete agora (acompanha o lado para onde ela está virada). */
  racketX(hitX: number): number {
    return hitX - this.offset + (HIT_DX + RACKET_DX) * this.facing;
  }

  /**
   * Posiciona pela área de rebatida (centro em x), vira para o lado em que está andando
   * e anima a flutuação e a inclinação.
   */
  update(hitX: number, dt: number): void {
    this.t += dt;
    const vx = dt > 0 ? (hitX - this.lastHitX) / dt : 0;
    this.lastHitX = hitX;
    const dir = Math.abs(vx) > TURN_SPEED ? (vx > 0 ? 1 : -1) : 0;
    if (dir !== 0 && dir !== this.facing) {
      this.turnT += dt;
      if (this.turnT * 1000 >= TURN_DELAY_MS) {
        this.facing = dir;
        this.turnT = 0;
      }
    } else if (dir === this.facing) {
      this.turnT = 0; // voltou para o lado em que já olha: zera a espera
    }
    this.girl.scaleX = this.facing;
    const target = this.facing * HIT_DX;
    this.offset += (target - this.offset) * Math.min(1, dt * 14);
    const tiltTo = Phaser.Math.Clamp(vx * 0.012, -9, 9);
    this.tilt += (tiltTo - this.tilt) * Math.min(1, dt * 10);
    this.root.setPosition(hitX - this.offset, FEET_Y + Math.sin(this.t * 3.2) * 3).setAngle(this.tilt);
  }

  /** Raquetada: quadros 1, 2, 3 e volta ao 0. */
  swing(): void {
    this.swingTimer?.remove();
    let i = 0;
    this.girl.setTexture(`jogadora_${SWING[0]}`);
    this.swingTimer = this.scene.time.addEvent({
      delay: SWING_MS,
      repeat: SWING.length - 2,
      callback: () => this.girl.setTexture(`jogadora_${SWING[++i]}`),
    });
  }

  setTint(c: number | null): void {
    for (const o of [this.girl, this.board]) {
      if (c === null) o.clearTint();
      else o.setTint(c);
    }
  }
}
