import Phaser from 'phaser';
import { hudText } from '@flix/game-kit/src/phaserHud';
import type { Expression } from '@flix/avatar';
import type { HubBridge } from '@flix/game-sdk';
import { sfx } from '../audio';
import {
  COLS, ITEM_BONUS_MS, ROUND_MS, ROWS, createState, enqueueDir, levelFor, mulberry32, step, tickMs, turnRush, type Cause, type Dir, type GameState, type Pt,
} from '../logic';
import { buildTrack, endDirection, lerp, roundedPath, sampleTrack, type V } from '../cablePath';
import { loadBest } from '../storage';
import {
  BODY_H, CELL, COLORS, FIELD_X, FIELD_Y, FONT, FONT_TEXT, FOOD_ITEMS, GAME_H, GAME_W, HEAD_FRONT, HUD, PANEL, SIGNAL_ITEM, SPRITE_K, TAIL_BACK, TUBE,
} from '../theme';
import { ensureGlowTexture, titleText } from '../ui';
import { portraitKey } from './BootScene';

const READY_MS = 800;
const BLINK_PHASE_MS = 150;
const BOOST_WARN_MS = 1800;
const SWIPE_PX = 28;
const WAVE_MS = 800;
const WAVE_MAX_R = 760;
const LEVEL_TEXT_DELAY_MS = 380;
const DEPTH_PANEL = 1;
const DEPTH_ITEMS = 2;
const DEPTH_SNAKE = 3;
const DEPTH_HUD = 5;
const DEPTH_FX = 10;
const DEPTH_TEXT = 11;

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
  /** Tempo extra acumulado (5 s por item conectado). */
  private bonusMs = 0;
  private acc = 0;
  private rush = 1; // > 1 enquanto uma curva pendente acelera o passo em curso (ver turnRush)
  private timeColor = '';
  private readyLeft = READY_MS;
  private over = false;
  private steps = 0;
  private lastLevel = 1;
  private headPulse = 0;
  /** Ângulo mostrado da cabeça (gira aos poucos até o ângulo real) e duração do último quadro. */
  private headAngle: number | null = null;
  private frameMs = 16;

  private fx!: Phaser.GameObjects.Graphics;
  private waves: Wave[] = [];
  private snakeLayer!: Phaser.GameObjects.Container;
  private bodyG!: Phaser.GameObjects.Graphics;
  private pills: Phaser.GameObjects.Image[] = [];
  private heads: Phaser.GameObjects.Image[] = [];
  private tails: Phaser.GameObjects.Image[] = [];
  private foodImg!: Phaser.GameObjects.Image;
  private foodGlow!: Phaser.GameObjects.Image;
  private shownKind = -1;
  private signalImg!: Phaser.GameObjects.Image;
  private signalGlow!: Phaser.GameObjects.Image;
  private boostText!: Phaser.GameObjects.BitmapText;

  private portrait!: Phaser.GameObjects.Image;
  private scoreText!: Phaser.GameObjects.BitmapText;
  private levelText!: Phaser.GameObjects.BitmapText;
  private timeText!: Phaser.GameObjects.BitmapText;
  private readyText!: Phaser.GameObjects.Text;
  private expressionTimer?: Phaser.Time.TimerEvent;

  private swipeX = 0;
  private swipeY = 0;
  private tracking = false;

  constructor() {
    super('Play');
  }

  create(): void {
    this.bridge = this.registry.get('bridge') as HubBridge;
    ensureGlowTexture(this);

    this.state = createState(mulberry32(Math.floor(Math.random() * 2 ** 32)));
    this.runId = this.bridge.newRunId();
    this.elapsed = 0;
    this.bonusMs = 0;
    this.acc = 0;
    this.rush = 1;
    this.timeColor = '';
    this.readyLeft = READY_MS;
    this.over = false;
    this.steps = 0;
    this.lastLevel = 1;
    this.headPulse = 0;
    this.headAngle = null;
    this.tracking = false;
    this.waves = [];
    this.shownKind = -1;

    this.cameras.main.setBackgroundColor(COLORS.panel);
    this.buildScenery();
    this.buildObstacles();
    this.buildFood();
    this.buildSnake();
    this.buildHud();
    this.fx = this.add.graphics().setDepth(DEPTH_FX).setBlendMode(Phaser.BlendModes.ADD);

    this.readyText = titleText(this, GAME_W / 2, FIELD_Y + (ROWS * CELL) / 2 - 40, 'PRONTO?', 68, '#FFFFFF', '#0a1c3a').setDepth(DEPTH_TEXT);

    this.bridge.sendStarted(this.runId);

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
      // o Phaser lê a tecla e só depois cancela o efeito padrão do navegador: sem isto, no Safari as setas rolavam a
      // página do hub atrás do jogo (25/11/2026). Não usar preventDefault antes do Phaser: ele ignora tecla cancelada.
      kb.addCapture('UP,DOWN,LEFT,RIGHT,SPACE');
    }

    this.events.once('shutdown', () => {
      this.input.removeAllListeners();
      this.input.keyboard?.removeAllListeners();
    });
  }

  private turn(dir: Dir): void {
    if (this.over) return;
    if (!enqueueDir(this.state, dir)) return;
    sfx('turn');
    this.armRush();
  }

  /** Curva pendente: o resto do passo em curso anda mais rápido, para a curva aparecer em até TURN_WAIT_MS. */
  private armRush(): void {
    if (this.state.queue.length === 0 || this.readyLeft > 0) { this.rush = 1; return; }
    this.rush = turnRush(tickMs(levelFor(this.state.eaten)) - this.acc);
  }

  update(_time: number, rawDelta: number): void {
    const delta = Math.min(rawDelta, 100);
    this.frameMs = delta;
    this.advanceWaves(delta);
    this.headPulse = Math.max(0, this.headPulse - delta / 260);
    if (this.over) return;

    if (this.readyLeft > 0) {
      this.readyLeft -= delta;
      if (this.readyLeft <= 0) this.readyText.setVisible(false);
      else if (this.readyLeft < READY_MS / 2) this.readyText.setText('VAI!');
      this.render();
      return;
    }

    this.elapsed += delta;
    if (this.elapsed >= ROUND_MS + this.bonusMs) {
      this.elapsed = ROUND_MS + this.bonusMs;
      this.finish('timeout');
      this.render();
      return;
    }

    this.acc += delta * this.rush;
    let guard = 0;
    let stepped = false;
    while (!this.over && this.acc >= tickMs(levelFor(this.state.eaten)) && guard++ < 4) {
      // a aceleração vale só até o centro da casa: o que sobrou do quadro volta ao ritmo normal
      if (!stepped && this.rush > 1) this.acc = tickMs(levelFor(this.state.eaten)) + (this.acc - tickMs(levelFor(this.state.eaten))) / this.rush;
      this.acc -= tickMs(levelFor(this.state.eaten));
      step(this.state, Math.random);
      this.steps++;
      stepped = true;
      this.handleEvent();
      if (!this.state.alive) {
        this.finish(this.state.cause ?? 'self');
        break;
      }
    }
    if (stepped) this.armRush(); // segunda curva na fila (ex.: meia-volta rápida) também chega logo
    this.render();
  }

  private handleEvent(): void {
    const s = this.state;
    if (s.lastEvent === 'signal') {
      sfx('signal');
      this.setExpression('happy', 600);
      this.headPulse = 1;
      const hd = s.snake[0];
      if (hd) this.spawnWave(cellX(hd.x) + CELL / 2, cellY(hd.y) + CELL / 2);
      return;
    }
    if (s.lastEvent !== 'item') return;
    sfx('house');
    this.setExpression('happy', 600);
    this.headPulse = 1;
    this.bonusMs += ITEM_BONUS_MS;
    this.showTimeBonus();
    const head = s.snake[0];
    if (head) {
      this.floatText(cellX(head.x) + CELL / 2, cellY(head.y), `+${s.lastGain}`);
      this.spawnWave(cellX(head.x) + CELL / 2, cellY(head.y) + CELL / 2);
    }
    const level = levelFor(s.eaten);
    if (level > this.lastLevel) {
      this.lastLevel = level;
      this.showLevelUp(level);
    }
  }

  /** “+5s” sobe da caixa de tempo quando um item dá tempo extra. */
  private showTimeBonus(): void {
    const x = HUD.time.x;
    const y = HUD.boxY + 34;
    const t = titleText(this, x, y, `+${ITEM_BONUS_MS / 1000}s`, 30, '#8CFF9A', '#0a4a1a').setDepth(DEPTH_TEXT);
    this.tweens.add({ targets: t, y: y + 34, alpha: 0, duration: 900, ease: 'Sine.easeOut', onComplete: () => t.destroy() });
    this.tweens.add({ targets: this.timeText, scale: { from: 1.25, to: 1 }, duration: 260, ease: 'Back.easeOut' });
  }

  private floatText(x: number, y: number, text: string): void {
    const t = titleText(this, x, y, text, 40, COLORS.gold, '#5a3a00').setDepth(DEPTH_TEXT);
    this.tweens.add({ targets: t, y: y - 64, alpha: 0, duration: 800, onComplete: () => t.destroy() });
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
    if (crashed) this.cameras.main.shake(250, 0.012);
    this.setExpression(crashed || s.eaten === 0 ? 'sad' : 'happy');

    this.bridge.sendGameOver({
      runId: this.runId,
      score: s.score,
      durationMs: this.elapsed,
      meta: { items: s.eaten, level: levelFor(s.eaten), bonusMs: this.bonusMs, cause },
    });

    const result = { score: s.score, items: s.eaten, cause, previousBest: loadBest(), expression: crashed || s.eaten === 0 ? 'sad' : 'happy' };
    this.time.delayedCall(crashed ? 750 : 400, () => this.scene.start('GameOver', result));
  }

  // ---------- efeitos ----------

  /** Onda vermelha (anéis de luz) que se espalha a partir do item conectado. */
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
      const fade = 1 - k;
      g.lineStyle(46 * fade + 6, 0xd4142c, 0.55 * fade);
      g.strokeCircle(w.x, w.y, r);
      g.lineStyle(18 * fade + 3, 0xff6b78, 0.8 * fade);
      g.strokeCircle(w.x, w.y, r);
      if (r > 60) {
        g.lineStyle(10 * fade + 2, 0xffd6da, 0.5 * fade);
        g.strokeCircle(w.x, w.y, r * 0.82);
      }
    }
  }

  /** “LEVEL UP!” pequeno, com o novo nível e uma seta verde, na parte de cima do campo (para não tampar o jogo). */
  private showLevelUp(level: number): void {
    const cx = GAME_W / 2;
    const cy = FIELD_Y + 46;
    const arrowScale = 0.34;
    const up = titleText(this, cx - 16, cy, 'LEVEL UP!', 38).setDepth(DEPTH_TEXT).setScale(0);
    const lv = titleText(this, cx - 16, cy + 28, `NÍVEL ${level}`, 20, '#FFFFFF', '#0a3a8a').setDepth(DEPTH_TEXT).setScale(0);
    const arrow = this.add.graphics().setDepth(DEPTH_TEXT);
    arrow.fillStyle(0x3ccb4a, 1);
    arrow.lineStyle(6, 0x145a1f, 1);
    const ax = (up.width / 2 + 16) / arrowScale;
    arrow.beginPath();
    arrow.moveTo(ax, -34);
    arrow.lineTo(ax + 34, 4);
    arrow.lineTo(ax + 14, 4);
    arrow.lineTo(ax + 14, 38);
    arrow.lineTo(ax - 14, 38);
    arrow.lineTo(ax - 14, 4);
    arrow.lineTo(ax - 34, 4);
    arrow.closePath();
    arrow.fillPath();
    arrow.strokePath();
    arrow.setPosition(cx - 16, cy).setScale(0);
    sfx('level');

    this.tweens.add({
      targets: up,
      scale: 1,
      delay: LEVEL_TEXT_DELAY_MS,
      duration: 260,
      ease: 'Back.easeOut',
    });
    this.tweens.add({
      targets: arrow,
      scale: arrowScale,
      delay: LEVEL_TEXT_DELAY_MS,
      duration: 260,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: [up, lv, arrow],
          alpha: 0,
          y: '-=16',
          delay: 650,
          duration: 300,
          onComplete: () => {
            up.destroy();
            lv.destroy();
            arrow.destroy();
          },
        });
      },
    });
    this.tweens.add({ targets: lv, scale: 1, delay: LEVEL_TEXT_DELAY_MS + 120, duration: 240, ease: 'Back.easeOut' });
  }

  // ---------- construção da cena ----------

  /**
   * Fundo: no topo, o céu (o menu fica por cima); abaixo, o painel escuro com a grade
   * do jogo e, no fim da tela, o rodapé do gestor (calçada, arbustos, van e cones).
   */
  private buildScenery(): void {
    // céu diurno ou noturno, conforme o tema do navegador (e acompanha a mudança durante o jogo)
    const dark = window.matchMedia?.('(prefers-color-scheme: dark)');
    const sky = this.add.image(GAME_W / 2, 0, dark?.matches ? 'ceu_noite' : 'ceu').setOrigin(0.5, 0).setDepth(0);
    sky.setDisplaySize(GAME_W, FIELD_Y);
    const onTheme = (e: MediaQueryListEvent) => sky.setTexture(e.matches ? 'ceu_noite' : 'ceu').setDisplaySize(GAME_W, FIELD_Y);
    dark?.addEventListener?.('change', onTheme);
    this.events.once('shutdown', () => dark?.removeEventListener?.('change', onTheme));

    const g = this.add.graphics().setDepth(DEPTH_PANEL);
    g.fillStyle(COLORS.panel, 1);
    g.fillRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h);
    g.lineStyle(1.5, COLORS.panelGrid, 1);
    const w = COLS * CELL;
    const h = ROWS * CELL;
    for (let x = 0; x <= COLS; x++) g.lineBetween(cellX(x), FIELD_Y, cellX(x), FIELD_Y + h);
    for (let y = 0; y <= ROWS; y++) g.lineBetween(FIELD_X, cellY(y), FIELD_X + w, cellY(y));

    const foot = this.add.image(GAME_W / 2, GAME_H, 'rodape').setOrigin(0.5, 1).setDepth(DEPTH_PANEL + 0.5);
    foot.setScale(GAME_W / foot.width);
  }

  /** Muros: uma cerca de madeira com flores (asset do gestor) por trecho reto; nos trechos horizontais ela é girada. */
  private buildObstacles(): void {
    // Todas as sombras num desenho só, transformado em imagem (ver bakeStatic). Coordenadas relativas ao topo do campo.
    const shadows = this.make.graphics({}, false);
    shadows.fillStyle(0x000000, 0.3);
    for (const w of this.state.walls) {
      const along = w.len * CELL - 4; // comprimento do trecho (com uma folga nas pontas)
      const across = CELL * 0.86; // espessura da cerca
      const cx = cellX(w.x) + (w.vertical ? CELL / 2 : (w.len * CELL) / 2);
      const cy = cellY(w.y) + (w.vertical ? (w.len * CELL) / 2 : CELL / 2);
      const sy = cy - FIELD_Y;
      if (w.vertical) shadows.fillRoundedRect(cx - across / 2 + 4, sy - along / 2 + 5, across, along, 8);
      else shadows.fillRoundedRect(cx - along / 2 + 5, sy - across / 2 + 4, along, across, 8);
      const img = this.add.image(cx, cy, 'muro').setDepth(DEPTH_ITEMS + 0.1);
      img.setDisplaySize(across, along);
      if (!w.vertical) img.setAngle(90);
    }
    this.bakeStatic(shadows, 'muro_sombras', 0, FIELD_Y, GAME_W, ROWS * CELL + 12, DEPTH_ITEMS);
  }

  /**
   * Transforma um desenho que não muda durante a partida em imagem (textura), feita uma vez por rodada.
   * Motivo: no WebGL o Phaser refaz a geometria de todo Graphics a cada quadro, mesmo parado. Medido em 18/11/2026
   * (Mac Intel HD 630): placa do HUD 5,5 ms e sombras das cercas 1,4 ms por quadro, ~80% do JavaScript da partida.
   * Como imagem, custa o mesmo que um sprite. A textura tem o tamanho do jogo (1:1 com o canvas), sem perda de nitidez.
   * Os comandos de `g` usam coordenadas relativas a (x, y); `g` não pode estar na cena (criar com make.graphics(..., false)).
   */
  private bakeStatic(g: Phaser.GameObjects.Graphics, key: string, x: number, y: number, w: number, h: number, depth: number): Phaser.GameObjects.Image {
    // generateTexture desenha POR CIMA de uma textura existente, sem limpar: a da rodada anterior sai antes
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, Math.ceil(w), Math.ceil(h));
    g.destroy();
    return this.add.image(x, y, key).setOrigin(0, 0).setDepth(depth);
  }

  private buildFood(): void {
    this.foodGlow = this.add.image(0, 0, 'brilho').setTint(0xfff0a0).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH_ITEMS).setAlpha(0.7);
    this.foodGlow.setDisplaySize(CELL * 2.6, CELL * 2.6);
    this.foodImg = this.add.image(0, 0, FOOD_ITEMS[0]!.key).setDepth(DEPTH_ITEMS + 0.2);
    // globo de ponto extra (aparece de vez em quando; não é comida)
    this.signalGlow = this.add.image(0, 0, 'brilho').setTint(0x35c8ff).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH_ITEMS).setVisible(false);
    this.signalGlow.setDisplaySize(CELL * 3.4, CELL * 3.4);
    this.signalImg = this.add.image(0, 0, SIGNAL_ITEM.key).setDepth(DEPTH_ITEMS + 0.2).setVisible(false);
    this.signalImg.setScale(SIGNAL_ITEM.size / Math.max(this.signalImg.width, this.signalImg.height));
  }

  private buildSnake(): void {
    this.snakeLayer = this.add.container(0, 0).setDepth(DEPTH_SNAKE);
    // o cabo é recortado pelo campo: ao atravessar a borda ele aparece saindo por um lado e entrando pelo outro
    const maskShape = this.make.graphics({ x: 0, y: 0 }, false);
    maskShape.fillStyle(0xffffff, 1).fillRect(FIELD_X, FIELD_Y, COLS * CELL, ROWS * CELL);
    this.snakeLayer.setMask(maskShape.createGeometryMask());
    // ordem na camada: tubo contínuo do corpo, segmentos (criados sob demanda), depois cabeças e caudas por cima
    this.bodyG = this.add.graphics();
    this.snakeLayer.add(this.bodyG);
    this.pills = [];
    this.heads = [];
    this.tails = [];
  }

  /** Cabeça/cauda de cada cópia do cabo, criadas sob demanda (um cabo longo que cruza as bordas pode ter até 9 cópias). */
  private endAt(list: Phaser.GameObjects.Image[], i: number, key: string): Phaser.GameObjects.Image {
    let img = list[i];
    if (!img) {
      img = this.add.image(0, 0, key);
      this.snakeLayer.add(img);
      list[i] = img;
    }
    return img;
  }

  /**
   * Menu superior: cobre o topo do cenário com uma placa escura de borda vermelha e desenha o quadro do avatar e as
   * caixas SCORE, TEMPO (com ícone de relógio) e NÍVEL (com as barras verdes ascendentes).
   */
  private buildHud(): void {
    const pl = HUD.plate;
    const g = this.make.graphics({}, false); // vira imagem no fim (bakeStatic): a placa não muda durante a partida
    g.fillStyle(0x10131b, 0.5); // translúcido: dá para ver o céu atrás do menu
    g.fillRoundedRect(pl.x, pl.y, pl.w, pl.h, pl.radius);
    g.lineStyle(10, 0xd4142c, 0.3);
    g.strokeRoundedRect(pl.x, pl.y, pl.w, pl.h, pl.radius);
    g.lineStyle(4, 0xe8283f, 1);
    g.strokeRoundedRect(pl.x, pl.y, pl.w, pl.h, pl.radius);

    // quadro do avatar
    const a = HUD.avatar;
    g.fillStyle(0x0b0d12, 0.62);
    g.fillRoundedRect(a.x - a.size / 2, a.y - a.size / 2, a.size, a.size, 18);
    g.lineStyle(5, 0xe8283f, 1);
    g.strokeRoundedRect(a.x - a.size / 2, a.y - a.size / 2, a.size, a.size, 18);
    this.portrait = this.add.image(a.x, a.y + 1, portraitKey('neutral')).setDisplaySize(a.size - 18, a.size - 18).setDepth(DEPTH_HUD + 1);

    // caixas de valor
    const box = (cx: number) => {
      g.fillStyle(0x080a0f, 0.7);
      g.fillRoundedRect(cx - HUD.boxW / 2, HUD.boxY - HUD.boxH / 2, HUD.boxW, HUD.boxH, 16);
      g.lineStyle(2, 0x7a8294, 1);
      g.strokeRoundedRect(cx - HUD.boxW / 2, HUD.boxY - HUD.boxH / 2, HUD.boxW, HUD.boxH, 16);
    };
    box(HUD.score.x);
    box(HUD.time.x);
    box(HUD.level.x);
    // divisórias entre o avatar e as caixas
    g.lineStyle(2, 0x3a3f4b, 1);
    g.lineBetween(116, 34, 116, 110);

    const label = (cx: number, text: string, iconWidth: number): number => {
      // placar de fliperama: fonte pixel branca com contorno escuro (mesma de todos os jogos Flix)
      const t2 = hudText(this, cx + iconWidth / 2, HUD.labelY, text, 2).setOrigin(0.5).setDepth(DEPTH_HUD + 1);
      return t2.x - t2.width / 2 - iconWidth / 2 - 4; // centro do ícone fica logo à esquerda do texto
    };
    label(HUD.score.x, 'PONTOS', 0);

    // TEMPO + relógio
    const clockX = label(HUD.time.x, 'TEMPO', 26) + 4;
    const cy = HUD.labelY;
    g.lineStyle(3, 0xffffff, 1);
    g.strokeCircle(clockX, cy, 11);
    g.fillStyle(0xffffff, 1);
    g.fillRect(clockX - 4, cy - 15, 8, 3); // botão do relógio
    g.lineStyle(3, 0xffffff, 1);
    g.lineBetween(clockX, cy, clockX, cy - 7);
    g.lineBetween(clockX, cy, clockX + 5, cy + 3);

    // NÍVEL + barras verdes ascendentes
    const barsX = label(HUD.level.x, 'NÍVEL', 26) + 4;
    const heights = [8, 14, 20];
    heights.forEach((h, i) => {
      const bx = barsX - 11 + i * 8.5;
      g.fillStyle(0x145a1f, 1);
      g.fillRoundedRect(bx - 1, cy + 11 - h - 1, 8, h + 2, 2);
      g.fillStyle(i === 2 ? 0x3ce05a : 0x2fc24a, 1);
      g.fillRoundedRect(bx, cy + 11 - h, 6, h, 2);
    });
    this.bakeStatic(g, 'hud_placa', 0, 0, GAME_W, pl.y + pl.h + 8, DEPTH_HUD);

    const value = (cx: number) =>
      hudText(this, cx, HUD.boxY + 1, '0', 4).setOrigin(0.5).setDepth(DEPTH_HUD + 1);
    this.scoreText = value(HUD.score.x);
    this.timeText = value(HUD.time.x).setText('2:00');
    this.levelText = value(HUD.level.x).setText('1');

    this.boostText = hudText(this, GAME_W / 2, FIELD_Y - 10, '', 2).setTint(0xff7a88).setOrigin(0.5).setDepth(DEPTH_HUD + 1);
  }

  // ---------- atualização por quadro ----------

  private render(): void {
    const s = this.state;
    this.updateFood();
    this.updateSnake();

    this.scoreText.setText(String(s.score));
    this.levelText.setText(String(levelFor(s.eaten)));
    const sec = Math.ceil(Math.max(0, ROUND_MS + this.bonusMs - this.elapsed) / 1000);
    this.timeText.setText(`${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`);
    const timeColor = sec <= 10 ? COLORS.flixRedText : '#FFFFFF'; // vira tinta da fonte pixel
    if (timeColor !== this.timeColor) {
      this.timeColor = timeColor; // setColor redesenha o texto e reenvia a textura: só quando a cor muda de fato
      this.timeText.setTint(Phaser.Display.Color.HexStringToColor(timeColor).color);
    }
    this.boostText.setText(s.boostLeft > 0 ? 'PONTO EXTRA x2' : '');
  }

  /** Item de pontuação atual (um dos modelos do gestor, sorteado), com brilho e leve flutuação. */
  private updateFood(): void {
    const s = this.state;
    if (s.foodKind !== this.shownKind) {
      this.shownKind = s.foodKind;
      const item = FOOD_ITEMS[s.foodKind] ?? FOOD_ITEMS[0]!;
      this.foodImg.setTexture(item.key);
      this.foodImg.setScale(item.size / Math.max(this.foodImg.width, this.foodImg.height));
      // um pulinho ao aparecer
      this.tweens.add({ targets: this.foodImg, scale: { from: 0, to: item.size / Math.max(this.foodImg.width, this.foodImg.height) }, duration: 260, ease: 'Back.easeOut' });
    }
    const t = this.time.now;
    const x = cellX(s.food.x) + CELL / 2;
    const y = cellY(s.food.y) + CELL / 2;
    this.foodImg.setPosition(x, y - 2 + Math.sin(t / 220) * 3);
    this.foodGlow.setPosition(x, y).setAlpha(0.5 + Math.sin(t / 260) * 0.2);

    // globo: pisca quando está para sumir
    const sig = s.signal;
    const blink = sig !== null && s.signalLeft < 10 && Math.floor(t / 150) % 2 === 0;
    if (!sig || blink) {
      this.signalImg.setVisible(false);
      this.signalGlow.setVisible(false);
      return;
    }
    const sx = cellX(sig.x) + CELL / 2;
    const sy = cellY(sig.y) + CELL / 2;
    this.signalImg.setPosition(sx, sy + Math.sin(t / 200) * 3).setVisible(true);
    this.signalGlow.setPosition(sx, sy).setVisible(true).setAlpha(0.6 + Math.sin(t / 240) * 0.25);
  }

  private pillAt(i: number): Phaser.GameObjects.Image {
    let img = this.pills[i];
    if (!img) {
      img = this.add.image(0, 0, 'cobra_azul_corpo');
      this.snakeLayer.addAt(img, 1 + i); // logo depois do tubo, abaixo das cabeças e caudas
      this.pills[i] = img;
    }
    return img;
  }

  /**
   * Monta a cobra com as imagens do gestor: cabeça RJ45 com o olho, corpo contínuo e conector RJ45 na cauda. O corpo
   * é um tubo azul contínuo (sem vãos) com os segmentos do modelo por cima, que acompanham a curva do caminho. A lógica
   * anda de casa em casa; aqui a cabeça desliza e a ponta recua entre um passo e o seguinte. Perto da borda, as peças
   * também aparecem do lado oposto (recortadas pela máscara do campo).
   */
  private updateSnake(): void {
    const s = this.state;
    const snake = s.snake;
    const head = snake[0];
    if (!head) return;

    const tick = tickMs(levelFor(s.eaten));
    const p = this.steps === 0 || !s.alive || this.readyLeft > 0 ? 1 : Phaser.Math.Clamp(this.acc / tick, 0, 1);
    const center = (c: Pt): V => ({ x: FIELD_X + c.x * CELL + CELL / 2, y: FIELD_Y + c.y * CELL + CELL / 2 });
    const unwrap = (d: number, size: number): number => (d > size / 2 ? d - size : d < -size / 2 ? d + size : d);

    // casas “desenroladas”: contínuas mesmo quando o cabo cruza a borda
    const cells: Pt[] = [{ x: head.x, y: head.y }];
    for (let i = 1; i < snake.length; i++) {
      const prev = cells[i - 1]!;
      const a = snake[i - 1]!;
      const b = snake[i]!;
      cells.push({ x: prev.x + unwrap(b.x - a.x, COLS), y: prev.y + unwrap(b.y - a.y, ROWS) });
    }
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
    const path = roundedPath(points, CELL * 0.6);
    const track = buildTrack(path);
    const headDir = endDirection(path, false) ?? {
      x: s.dir === 'right' ? 1 : s.dir === 'left' ? -1 : 0,
      y: s.dir === 'down' ? 1 : s.dir === 'up' ? -1 : 0,
    };
    // a cabeça gira suavemente até a nova direção (em vez de virar de uma vez); o caminho do cabo já vem arredondado
    const targetA = Math.atan2(headDir.y, headDir.x);
    if (this.headAngle === null || this.readyLeft > 0) this.headAngle = targetA;
    else {
      const diff = Math.atan2(Math.sin(targetA - this.headAngle), Math.cos(targetA - this.headAngle));
      this.headAngle += diff * (1 - Math.exp(-this.frameMs / 30)); // 30 ms: a cabeça acompanha a curva sem atraso visível
    }
    const shownHead: V = { x: Math.cos(this.headAngle), y: Math.sin(this.headAngle) };
    const tailDir = endDirection(path, true) ?? { x: -headDir.x, y: -headDir.y };

    // no ponto extra a cobra fica vermelha; nos últimos segundos do bônus ela pisca entre vermelho e azul
    const warn = s.boostLeft > 0 && s.boostLeft * tick <= BOOST_WARN_MS;
    const red = s.boostLeft > 0 && (!warn || Math.floor(this.time.now / BLINK_PHASE_MS) % 2 === 0);
    const skin = red ? 'metal' : 'azul';
    const tubeColors = TUBE[skin];
    const headTex = this.textures.get(`cobra_${skin}_cabeca`).getSourceImage();
    const tailTex = this.textures.get(`cobra_${skin}_cauda`).getSourceImage();
    const pillTex = this.textures.get(`cobra_${skin}_corpo`).getSourceImage();
    const headW = headTex.width * SPRITE_K;
    const tailW = tailTex.width * SPRITE_K;
    const pillW = pillTex.width * SPRITE_K;
    const bodyStart = headW - HEAD_FRONT; // a cabeça termina aqui (distância a partir da casa da cabeça)
    const bodyEnd = track.total - (tailW - TAIL_BACK);
    const bodyLen = Math.max(0, bodyEnd - bodyStart);
    // segmentos bem juntos (com sobreposição), para o meio nunca ficar vago nem quebrado nas curvas
    const n = bodyLen > 2 ? Math.max(1, Math.ceil(bodyLen / (pillW * 0.8))) : 0;
    const spacing = n > 0 ? bodyLen / n : pillW;

    // cópias que aparecem dentro do campo (a normal e, perto da borda, as do lado oposto)
    const fieldW = COLS * CELL;
    const fieldH = ROWS * CELL;
    const pad = headW;
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

    // tubo contínuo sob os segmentos: preenche qualquer vão entre eles, mesmo nas curvas
    const g = this.bodyG;
    g.clear();
    const tube: V[] = [];
    if (bodyLen > 0) {
      const from = Math.max(0, bodyStart - 10);
      const to = Math.min(track.total, bodyEnd + 10);
      for (let d = from; d < to; d += 4) {
        const q = sampleTrack(track, d);
        tube.push({ x: q.x, y: q.y });
      }
      const last = sampleTrack(track, to);
      tube.push({ x: last.x, y: last.y });
    }

    // orienta uma imagem que “olha” para a esquerda (cabeça) ou para a direita (cauda) na direção d, sem ficar de cabeça para baixo
    const orient = (img: Phaser.GameObjects.Image, d: V, facesLeft: boolean) => {
      const a = Math.atan2(d.y, d.x);
      const rightward = d.x >= 0;
      img.setFlipX(facesLeft ? rightward : !rightward);
      img.setRotation(rightward ? a : a > 0 ? a - Math.PI : a + Math.PI);
    };

    const pulse = 1 + 0.2 * this.headPulse;
    let pi = 0;
    let ci = 0;
    for (const [ox, oy] of copies) {
      if (tube.length > 1) {
        const shifted = tube.map((v) => ({ x: v.x + ox, y: v.y + oy }));
        g.lineStyle(BODY_H + 3, tubeColors.outline, 1);
        g.strokePoints(shifted, false, false);
        g.lineStyle(BODY_H - 3, tubeColors.mid, 1);
        g.strokePoints(shifted, false, false);
        g.lineStyle(4, tubeColors.light, 0.8);
        g.strokePoints(shifted.map((v) => ({ x: v.x - 2, y: v.y - 5 })), false, false);
      }

      const headImg = this.endAt(this.heads, ci, `cobra_${skin}_cabeca`);
      const tailImg = this.endAt(this.tails, ci, `cobra_${skin}_cauda`);
      ci++;
      headImg.setTexture(`cobra_${skin}_cabeca`).setVisible(true).setScale(SPRITE_K * pulse);
      headImg.setPosition(path[0]!.x - shownHead.x * (headW / 2 - HEAD_FRONT) + ox, path[0]!.y - shownHead.y * (headW / 2 - HEAD_FRONT) + oy);
      orient(headImg, shownHead, true);
      const end = path[path.length - 1]!;
      tailImg.setTexture(`cobra_${skin}_cauda`).setVisible(true).setScale(SPRITE_K);
      tailImg.setPosition(end.x - tailDir.x * (tailW / 2 - TAIL_BACK) + ox, end.y - tailDir.y * (tailW / 2 - TAIL_BACK) + oy);
      orient(tailImg, tailDir, false);

      for (let i = 0; i < n; i++) {
        const sp = sampleTrack(track, bodyStart + (i + 0.5) * spacing);
        const pill = this.pillAt(pi++);
        pill.setTexture(`cobra_${skin}_corpo`).setVisible(true);
        pill.setPosition(sp.x + ox, sp.y + oy).setRotation(sp.angle).setScale(((spacing * 1.25) / pillTex.width), SPRITE_K);
      }
    }
    for (let i = ci; i < this.heads.length; i++) this.heads[i]?.setVisible(false);
    for (let i = ci; i < this.tails.length; i++) this.tails[i]?.setVisible(false);
    for (let i = pi; i < this.pills.length; i++) this.pills[i]?.setVisible(false);
  }
}
