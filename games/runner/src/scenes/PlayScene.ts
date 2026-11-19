import Phaser from 'phaser';
import type { HubBridge } from '@flix/game-sdk';
import { hudText, telaFimDeJogo } from '@flix/game-kit/src/phaserHud';
import {
  ENERGY_MS, FIRE_COOLDOWN, GUN_SHOTS, JETPACK_MS, JETPACK_WARN_MS, SHOT_R, SHOT_SPEED, VIRUS_HIT_R, VIRUS_LOW, VIRUS_R, WAVE_HIT_R,
  addKill, distanceM, scoreOf, circleHitsBox, circlesOverlap, createPlayer, createRun, giveEnergy, giveGun, giveJetpack, hitbox, multiplier, mulberry32, useShot,
  nextPickupGap, nextPickupHeight, nextVirusGap, nextVirusHeight, virusDensityAt, onGround, pickPickupKind, speedAt, stepPlayer, tickRun,
  type Controls, type PickupKind,
} from '../logic';
import {
  BRIDGE, COLORS, ENEMIES, ENEMY_SCALE, FONT, FONT_TEXT, GAME_H, GAME_W, GROUND_Y, MARGEM_X, PLAYER_X, PORTAL, SCENES, SCENE_REPEAT, SCENE_W, SPRITE_ANCHOR, START_OFFSET, SPRITE_SCALE,
} from '../theme';

// Portal na troca de estado: quando o centro do portal chega aqui, a animação da Julia entrando começa exatamente
// onde a personagem está (PLAYER_X). Metade das medidas da folha: a arte é desenhada em 2x.
const PORTAL_GATILHO = PLAYER_X + (PORTAL.entrada.portalX - PORTAL.entrada.juliaX) / 2;
// Na saída, o portal fica à esquerda e a Julia termina a animação em PLAYER_X.
const PORTAL_SAIDA_X = PLAYER_X - (PORTAL.saida.juliaX - PORTAL.saida.portalX) / 2;
const PORTAL_CHAO = 4; // a base do portal um pouco abaixo da linha dos pés, como a sombra
const PORTAL_SEM_INIMIGOS = 340; // sem inimigos nem bônus novos atrás do portal: só para quando ele está a menos disto da borda direita

const STRIDE_PX = 24.5; // distância percorrida a cada troca de quadro da corrida (4 quadros)
// Botão ATIRAR (toque): próprio, no canto inferior direito, só aparece com munição. Pular e abaixar são por gesto (arrastar).
// dependem da largura do mundo (GAME_W), que pode mudar entre partidas (tela cheia no computador): recalculadas no create()
let FIRE_BTN = { x: 0, y: GAME_H - 64, w: 140, h: 76 };
const ARRASTO = 16; // quanto o dedo precisa andar (unidades do jogo) para valer como "arrastar para cima/baixo"
const SLIDE_STEP = 0.06; // segundos por quadro ao entrar no deslize
const GETUP_S = 0.14; // tempo do quadro de levantar ao soltar o botão de abaixar
const PICKUP_R = 32; // raio de colisão dos bônus
// velocidade própria do vírus (além do cenário): na largada ele cruza a tela a 490 px/s, 30% mais que os 377 de antes
const VIRUS_EXTRA_SPEED = 254;
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
/** Inimigo (o nome interno continua "vírus": a regra é a mesma; só o desenho mudou). `chao`: anda no chão, sem flutuar. */
interface Virus { x: number; h: number; phase: number; img: Phaser.GameObjects.Sprite; sombra: Phaser.GameObjects.Ellipse; chao: boolean; pisar: number }
/**
 * Quanto cada inimigo de chão desce no desenho para as patas pisarem na linha do chão, em cima da sombra (medido na
 * arte: o Pacote Corrompido tem mais espaço vazio embaixo). A colisão continua no mesmo lugar.
 */
const PISAR: Record<string, number> = { en_rompe_fibra: 8, en_pacote_corrompido: 12 };
interface Shot { x: number; y: number; img: Phaser.GameObjects.Image }

const PICKUP_LOOK: Record<PickupKind, { tex: string; scale: number; glow: number; toast: string }> = {
  router: { tex: 'router', scale: 3, glow: 0x66b8ff, toast: 'WI-FI JETPACK!' },
  energy: { tex: 'bateria', scale: 0.42, glow: 0x66ff99, toast: 'ENERGIA! DISTÂNCIA x3' },
  gun: { tex: 'arma', scale: 0.55, glow: 0x66ddff, toast: 'ARMA WI-FI! 10 TIROS (ESPAÇO)' },
};

type BarId = 'jet' | 'energy' | 'gun';
// Barras dos bônus (topo, no centro), na ordem em que aparecem: ícone = arte do próprio bônus, barra em gomos e texto.
const BARS: Array<{ id: BarId; nome: string; tex: string; color: number }> = [
  { id: 'energy', nome: 'DISTÂNCIA x3', tex: 'bateria', color: 0x2fd4a0 },
  { id: 'gun', nome: 'ARMA WI-FI', tex: 'arma', color: 0x35d0ff },
  { id: 'jet', nome: 'WI-FI JETPACK', tex: 'router', color: 0xffc83a },
];
const GOMOS = GUN_SHOTS; // 10 quadrados em todas as barras: na arma, 1 quadrado = 1 tiro
let BAR_X = 0; // começo da barra (o ícone fica à esquerda, o texto à direita)
const GOMO_W = 11;
const GOMO_GAP = 3;
const BAR_W = GOMOS * GOMO_W + (GOMOS - 1) * GOMO_GAP;
const LINHA_Y = 24; // centro da primeira linha de barras
const LINHA_H = 26;

/** Corrida lateral infinita (G01): correr, saltar, abaixar, pegar bônus (jetpack, energia x3, arma de wifi) e fugir ou abater vírus. */
export class PlayScene extends Phaser.Scene {
  private bridge!: HubBridge;
  private runId = '';
  private state: 'playing' | 'portal' | 'dead' = 'playing';
  /** Portal vindo pela direita (fim do estado) e o que fica para trás depois da saída. */
  private portalVindo: Phaser.GameObjects.Sprite | null = null;
  private portalIndo: Phaser.GameObjects.Sprite | null = null;
  private overShown = false;

  /** Cenário em 3 posições que se revezam (cidade, torre 5G na emenda e ponte); `bgX` é a distância total percorrida. */
  private cities: Phaser.GameObjects.Image[] = [];
  private towers: Phaser.GameObjects.Image[] = [];
  private bridges: Phaser.GameObjects.Image[] = [];
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
  private wasAir = false;
  private landT = 0; // agachada de aterrissagem do salto com arma
  private slideT = 0; // tempo deslizando (0 = de pé)
  private getupT = 0; // levantando depois do deslize
  private helpOpen = false;
  private helpPanel!: Phaser.GameObjects.Container;
  private firePressed = false;
  private fireBtn!: Phaser.GameObjects.Container;

  private waves: Wave[] = [];
  private wavePool: Phaser.GameObjects.Image[] = [];
  private waveTimer = 0;

  private seconds = 0;
  private stride = 0;
  private animT = 0;
  private jumpBuffer = 0;

  private keys!: Record<'help' | 'esc' | 'space' | 'up' | 'w' | 'down' | 's' | 'enter', Phaser.Input.Keyboard.Key>;
  private jumpPointers = new Set<number>();
  private duckPointers = new Set<number>();
  /** Dedos na tela (fora do botão de tiro): ponto de referência do arrasto e o gesto atual. */
  private gestos = new Map<number, { ref: number; modo: 'cima' | 'baixo' | null }>();

  private hudScore!: Phaser.GameObjects.BitmapText;
  private hudMult!: Phaser.GameObjects.BitmapText;
  private hudDist!: Phaser.GameObjects.BitmapText;
  private hudKills!: Phaser.GameObjects.BitmapText;
  private bars: Array<{ id: BarId; icon: Phaser.GameObjects.Image; g: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.BitmapText; desenho: string }> = [];
  private toast!: Phaser.GameObjects.BitmapText;

  constructor() {
    super('Play');
  }

  create(): void {
    FIRE_BTN = { ...FIRE_BTN, x: GAME_W - MARGEM_X - 66 };
    BAR_X = GAME_W / 2 - 84;
    this.bridge = this.registry.get('bridge') as HubBridge;
    this.state = 'playing';
    this.portalVindo = this.portalIndo = null;
    this.helpOpen = false;
    this.overShown = false;
    this.player = createPlayer();
    this.run = createRun();
    this.seconds = this.stride = this.animT = this.jumpBuffer = this.waveTimer = this.fireTimer = 0;
    // começa no cenário mostrado no menu (ou num sorteado, se o hub reiniciou direto) e com a primeira torre fora da tela
    const picked = this.registry.get('startScene') as number | undefined;
    this.registry.remove('startScene');
    const startIdx = picked ?? Math.floor(Math.random() * SCENES.length);
    this.bgX = startIdx * SCENE_REPEAT * SCENE_W + START_OFFSET;
    this.waves = [];
    this.wavePool = [];
    this.pickups = [];
    this.viruses = [];
    this.shots = [];
    this.gestos.clear();
    this.jumpPointers.clear();
    this.duckPointers.clear();
    this.nextPickupIn = 500; // o primeiro bônus aparece cedo
    this.nextVirusIn = 900;

    this.buildScenery();
    this.buildPlayer();
    this.buildHud();
    this.buildHelp();
    this.bindInput();

    const onRestart = () => this.scene.restart();
    this.game.events.on('hub-restart', onRestart);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off('hub-restart', onRestart));

    this.runId = this.bridge.newRunId();
    this.bridge.sendStarted(this.runId);
  }

  // ---- montagem ---------------------------------------------------------------------------------------------------

  /**
   * Cenário infinito: a lista `SCENES` com cada cenário repetido `SCENE_REPEAT` vezes e uma torre 5G sobre cada emenda, que esconde o
   * corte entre as imagens (sem fade). Só três posições existem; elas trocam de imagem conforme o cenário rola.
   */
  private buildScenery(): void {
    this.cities = [];
    this.towers = [];
    this.bridges = [];
    for (let i = 0; i < 3; i++) {
      this.cities.push(this.add.image(0, 0, SCENES[0].key).setOrigin(0, 0).setDepth(DEPTH.city));
      // a torre é o plano da frente: a personagem passa por trás dela
      const t = this.add.image(0, GAME_H, 'torre').setOrigin(0.5, 1).setDepth(DEPTH.tower);
      t.setScale(TOWER_H / t.height);
      this.towers.push(t);
      // cenário com rio: a ponte fica por cima da água, com o piso na linha do chão, e a personagem corre sobre ela
      this.bridges.push(this.add.image(0, GROUND_Y - BRIDGE.deckTop, 'ponte').setOrigin(0, 0).setDepth(DEPTH.bridge));
    }
    this.positionScenery();
  }

  private buildPlayer(): void {
    this.shadow = this.add.ellipse(PLAYER_X, GROUND_Y + 2, 56, 10, 0x000000, 0.32).setDepth(DEPTH.shadow);
    this.sprite = this.add.image(PLAYER_X, GROUND_Y, 'pl_run_0').setOrigin(SPRITE_ANCHOR.run_0, 1).setScale(SPRITE_SCALE).setDepth(DEPTH.player);
    // arma pequena nas mãos quando ela não está na pose de corrida armada (salto, voo, agachada)
    this.gunImg = this.add.image(0, 0, 'arma').setScale(0.21).setAngle(25).setDepth(DEPTH.shot).setVisible(false);
  }

  private buildHud(): void {
    // Placar de fliperama: fonte pixel branca com contorno escuro, direto sobre o cenário (sem caixa)
    // px: 1 pixel da letra = px unidades do jogo (a câmera amplia 2x; px × 2 inteiro mantém a letra nítida)
    hudText(this, MARGEM_X, 6, 'PONTOS', 2).setDepth(DEPTH.hud);
    this.hudScore = hudText(this, MARGEM_X - 2, 22, '0000', 3.5).setDepth(DEPTH.hud);
    this.hudDist = hudText(this, MARGEM_X, 60, '0 m', 2).setDepth(DEPTH.hud);
    this.hudMult = hudText(this, 0, 28, 'x3', 2).setTint(0x5cff9a).setDepth(DEPTH.hud).setVisible(false);
    hudText(this, GAME_W - MARGEM_X, 6, 'ABATES', 2).setOrigin(1, 0).setDepth(DEPTH.hud);
    this.hudKills = hudText(this, GAME_W - MARGEM_X + 2, 22, '0', 3.5).setOrigin(1, 0).setDepth(DEPTH.hud);

    // uma linha por bônus ativo, empilhadas no topo, no centro: [ícone] [gomos] [texto]
    this.bars = BARS.map((b) => {
      const icon = this.add.image(BAR_X - 18, 0, b.tex).setDepth(DEPTH.hud).setVisible(false);
      icon.setScale(24 / Math.max(icon.width, icon.height));
      return {
        id: b.id,
        icon,
        g: this.add.graphics().setDepth(DEPTH.hud).setVisible(false),
        label: hudText(this, BAR_X + BAR_W + 12, 0, '', 2.5).setOrigin(0, 0.5).setDepth(DEPTH.hud).setVisible(false),
        desenho: '',
      };
    });

    // nome do bônus que acabou de pegar, logo abaixo das barras (some sozinho)
    this.toast = hudText(this, GAME_W / 2, 0, '', 2).setOrigin(0.5).setDepth(DEPTH.hud + 10).setAlpha(0);

    // controles sempre à vista, nos cantos de baixo
    const toque = this.sys.game.device.input.touch;
    if (toque) {
      // celular: pular e abaixar arrastando o dedo em qualquer lugar da tela
      hudText(this, MARGEM_X, GAME_H - 40, '▲ ARRASTE PARA CIMA: PULAR', 2).setOrigin(0, 0.5).setDepth(DEPTH.hud);
      hudText(this, MARGEM_X, GAME_H - 18, '▼ ARRASTE PARA BAIXO: ABAIXAR', 2).setOrigin(0, 0.5).setDepth(DEPTH.hud);
    } else {
      hudText(this, MARGEM_X, GAME_H - 20, '▼ ABAIXAR', 2.5).setOrigin(0, 0.5).setDepth(DEPTH.hud);
      hudText(this, GAME_W - MARGEM_X, GAME_H - 20, '▲ PULAR', 2.5).setOrigin(1, 0.5).setDepth(DEPTH.hud);
    }
    // botão ATIRAR enquanto houver munição: no toque é um botão próprio; no teclado, a dica do espaço
    const fb = this.add.graphics();
    if (toque) {
      const { w, h } = FIRE_BTN;
      fb.fillStyle(0x0b1530, 0.9).fillRect(-w / 2, -h / 2, w, h); // contorno escuro
      fb.fillStyle(0x35d0ff, 1).fillRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6); // borda clara
      fb.fillStyle(0x0a4fb5, 0.92).fillRect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12);
      fb.fillStyle(0x06214d, 0.9).fillRect(-w / 2 + 6, h / 2 - 12, w - 12, 6); // sombra embaixo
    }
    const ft = toque ? hudText(this, 0, -2, '⊕ ATIRAR', 2.5).setOrigin(0.5) : hudText(this, 66, 0, 'ESPAÇO: ATIRAR', 2).setOrigin(1, 0.5) // termina na margem direita;
    this.fireBtn = this.add.container(FIRE_BTN.x, toque ? FIRE_BTN.y : GAME_H - 48, [fb, ft]).setDepth(DEPTH.hud).setVisible(false);
  }

  /** Painel com os controles (tecla H). O jogo fica parado enquanto o painel está aberto. Sem botão "?" na tela. */
  private buildHelp(): void {
    const lines: Array<[string, string]> = [
      ['PULAR', '↑ ou W, ou arraste o dedo para cima (segurar pula mais alto)'],
      ['ABAIXAR', '↓ ou S, ou arraste o dedo para baixo (segurar)'],
      ['ATIRAR', 'ESPAÇO, ou botão ATIRAR no toque (só com a arma de wifi)'],
      ['ROTEADOR', 'vira jetpack: segure PULAR para subir. Só gasta no ar'],
      ['ARMA WI-FI', '10 disparos: mire na altura do inimigo e atire'],
      ['ENERGIA', 'a distância vale x3 por 15 segundos'],
      ['INIMIGOS', 'encostar = fim de jogo. Pule, abaixe ou atire neles'],
      ['PONTOS', 'distância percorrida (m) x inimigos abatidos'],
    ];
    const objs: Phaser.GameObjects.GameObject[] = [
      this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x03122e, 0.62),
      this.add.rectangle(GAME_W / 2, GAME_H / 2, 800, 430, 0x06214d, 0.96).setStrokeStyle(4, 0x66ddff),
      this.add.text(GAME_W / 2, 92, 'COMO JOGAR', { fontFamily: FONT, fontSize: '36px', color: '#FFFFFF' }).setOrigin(0.5),
    ];
    lines.forEach(([k, v], i) => {
      const y = 142 + i * 42;
      objs.push(this.add.text(120, y, k, { fontFamily: FONT, fontSize: '20px', color: '#66DDFF' }).setOrigin(0, 0.5));
      objs.push(this.add.text(290, y, v, { fontFamily: FONT_TEXT, fontSize: '18px', color: '#FFFFFF' }).setOrigin(0, 0.5));
    });
    objs.push(this.add.text(GAME_W / 2, 470, 'Toque na tela, aperte H ou ESC para voltar ao jogo', { fontFamily: FONT_TEXT, fontSize: '18px', color: COLORS.textMuted }).setOrigin(0.5));
    this.helpPanel = this.add.container(0, 0, objs).setDepth(DEPTH.over + 5).setVisible(false);
  }

  /** Posição do dedo/mouse no mundo do jogo (960x540), descontando o zoom da câmera. */
  private noMundo(p: Phaser.Input.Pointer): Phaser.Math.Vector2 {
    return this.cameras.main.getWorldPoint(p.x, p.y);
  }

  private toggleHelp(open: boolean): void {
    if (this.helpOpen === open) return;
    this.helpOpen = open;
    this.helpPanel.setVisible(open);
    if (open) {
      this.gestos.clear();
      this.jumpPointers.clear();
      this.duckPointers.clear();
    }
  }

  private bindInput(): void {
    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      help: kb.addKey(K.H), esc: kb.addKey(K.ESC), space: kb.addKey(K.SPACE), up: kb.addKey(K.UP), w: kb.addKey(K.W), down: kb.addKey(K.DOWN), s: kb.addKey(K.S), enter: kb.addKey(K.ENTER),
    };
    kb.addCapture([K.SPACE, K.UP, K.DOWN]);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.state !== 'playing') return;
      if (this.helpOpen) return this.toggleHelp(false); // qualquer toque fecha a ajuda
      // posição no mundo de 960x540 (p.x/p.y vêm na tela desenhada em 2x, RENDER, e erravam os botões)
      const { x, y } = this.noMundo(p);
      // botão ATIRAR: só ele dispara; nunca vira pulo nem abaixar
      if (this.run.gunAmmo > 0 && Math.abs(x - FIRE_BTN.x) < FIRE_BTN.w / 2 + 8 && Math.abs(y - FIRE_BTN.y) < FIRE_BTN.h / 2 + 8) {
        this.firePressed = true;
        return;
      }
      this.gestos.set(p.id, { ref: y, modo: null });
    });
    // arrastar: para cima pula (segurando, pula mais alto / voa com o jetpack); para baixo abaixa enquanto segurar.
    // Dá para trocar no meio: voltar o dedo na direção contrária troca o gesto.
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const g = this.gestos.get(p.id);
      if (!g || this.state !== 'playing' || this.helpOpen) return;
      const { y } = this.noMundo(p);
      if (g.modo === 'cima') g.ref = Math.min(g.ref, y);
      else if (g.modo === 'baixo') g.ref = Math.max(g.ref, y);
      const dy = y - g.ref;
      if (dy <= -ARRASTO && g.modo !== 'cima') {
        g.modo = 'cima';
        g.ref = y;
        this.duckPointers.delete(p.id);
        this.jumpPointers.add(p.id);
        this.jumpBuffer = 0.12;
      } else if (dy >= ARRASTO && g.modo !== 'baixo') {
        g.modo = 'baixo';
        g.ref = y;
        this.jumpPointers.delete(p.id);
        this.duckPointers.add(p.id);
      }
    });
    const up = (p: Phaser.Input.Pointer) => {
      this.gestos.delete(p.id);
      this.jumpPointers.delete(p.id);
      this.duckPointers.delete(p.id);
    };
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', up);
    this.input.on('gameout', () => {
      this.gestos.clear();
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
        this.goMenu();
      }
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.help)) this.toggleHelp(!this.helpOpen);
    if (this.helpOpen && Phaser.Input.Keyboard.JustDown(this.keys.esc)) this.toggleHelp(false);
    if (this.helpOpen) return; // jogo parado enquanto a ajuda está aberta
    if (this.state === 'portal') return; // a passagem pelo portal é uma animação: o mundo para e nada acontece

    this.seconds += dt;
    const speed = speedAt(this.seconds);

    // controles
    const k = this.keys;
    if ((!this.run.gunAmmo && Phaser.Input.Keyboard.JustDown(k.space)) || Phaser.Input.Keyboard.JustDown(k.up) || Phaser.Input.Keyboard.JustDown(k.w)) {
      this.jumpBuffer = 0.12;
    }
    // com munição, o espaço atira (pular fica em ↑/W/toque); sem munição, o espaço volta a pular
    const gunArmed = this.run.gunAmmo > 0;
    const spaceJump = !gunArmed && k.space.isDown;
    const fire = gunArmed && (Phaser.Input.Keyboard.JustDown(k.space) || this.firePressed);
    this.firePressed = false;
    const jumpHeld = spaceJump || k.up.isDown || k.w.isDown || this.jumpPointers.size > 0;
    const duckHeld = k.down.isDown || k.s.isDown || this.duckPointers.size > 0;
    const ctl: Controls = { jumpHeld, duckHeld, jumpPressed: this.jumpBuffer > 0 && onGround(this.player) };
    if (ctl.jumpPressed) this.jumpBuffer = 0;
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);

    stepPlayer(this.player, ctl, dt);
    tickRun(this.run, dt, speed);
    this.stride += speed * dt;

    this.scrollScenery(speed * dt);
    this.updatePortal(speed * dt);
    if (this.state !== 'playing') return; // entrou no portal neste quadro
    this.updateSpawns(speed, dt);
    this.updateGun(dt, fire);
    this.updateShots(dt);
    this.updatePickups(speed, dt);
    this.updateViruses(speed, dt);
    this.updatePlayerSprite(dt);
    this.updateWaves(dt);
    this.updateHud();
  }

  // ---- portal na troca de estado ----------------------------------------------------------------------------------

  /** Índice do primeiro trecho do próximo estado (cada estado tem SCENE_REPEAT trechos seguidos). */
  private proximoEstado(): number {
    return (Math.floor(Math.floor(this.bgX / SCENE_W) / SCENE_REPEAT) + 1) * SCENE_REPEAT;
  }

  /** Posição do portal no mundo: antes da emenda, para o próximo estado não aparecer antes da hora. */
  private portalX(): number {
    const emenda = this.proximoEstado() * SCENE_W - this.bgX;
    return emenda - (GAME_W - PORTAL_GATILHO) - 80;
  }

  private portalSozinho(x: number, depth: number): Phaser.GameObjects.Sprite {
    const P = PORTAL.girando;
    return this.add.sprite(x, GROUND_Y + PORTAL_CHAO, P.key).setOrigin(P.portalX / P.w, P.base / P.h).setScale(0.5).setDepth(depth);
  }

  /** O portal surge na direita, vem com o cenário e, ao chegar na personagem, ela entra nele. */
  private updatePortal(dx: number): void {
    if (this.portalIndo) {
      this.portalIndo.x -= dx;
      if (this.portalIndo.x < -150) {
        this.portalIndo.destroy();
        this.portalIndo = null;
      }
    }
    const x = this.portalX();
    if (!this.portalVindo && x < GAME_W + 120) this.portalVindo = this.portalSozinho(x, DEPTH.item).play('portal_abre').chain('portal_gira');
    if (!this.portalVindo) return;
    this.portalVindo.x = x;
    if (x <= PORTAL_GATILHO) this.entrarNoPortal();
  }

  /**
   * Troca de estado: Julia corre para dentro do portal, a tela escurece, o cenário vira o do próximo estado, um portal
   * abre no escuro e ela sai dele correndo. Nada a acerta durante a passagem; pontos e velocidade continuam de onde estavam.
   */
  private entrarNoPortal(): void {
    const P = PORTAL;
    this.state = 'portal';
    this.portalVindo?.destroy();
    this.portalVindo = null;
    for (const v of this.viruses) { v.img.destroy(); v.sombra.destroy(); }
    this.viruses = [];
    for (let i = this.pickups.length - 1; i >= 0; i--) this.destroyPickup(i);
    this.gestos.clear();
    this.jumpPointers.clear();
    this.duckPointers.clear();
    Object.assign(this.player, { y: 0, vy: 0, ducking: false });
    for (const o of [this.sprite, this.shadow, this.gunImg]) o.setVisible(false);

    const fim = Phaser.Animations.Events.ANIMATION_COMPLETE;
    const entra = this.add.sprite(PORTAL_GATILHO, GROUND_Y + PORTAL_CHAO, P.entrada.key)
      .setOrigin(P.entrada.portalX / P.entrada.w, P.entrada.base / P.entrada.h).setScale(0.5).setDepth(DEPTH.player);
    entra.play('portal_entra').once(fim, () => {
      // tela escura (o placar continua por cima)
      const preto = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 1).setDepth(DEPTH.tower + 1).setAlpha(0);
      this.tweens.add({
        targets: preto, alpha: 1, duration: 300,
        onComplete: () => {
          entra.destroy();
          this.bgX = this.proximoEstado() * SCENE_W + START_OFFSET; // próximo estado, com a torre da emenda fora da tela
          this.positionScenery();
          // portal abrindo no escuro, no lugar de onde ela vai sair
          const abre = this.portalSozinho(PORTAL_SAIDA_X, DEPTH.tower + 2).play('portal_abre');
          abre.once(fim, () => {
            abre.destroy();
            this.tweens.add({ targets: preto, alpha: 0, duration: 350, onComplete: () => preto.destroy() });
            const sai = this.add.sprite(PORTAL_SAIDA_X, GROUND_Y + PORTAL_CHAO, P.saida.key)
              .setOrigin(P.saida.portalX / P.saida.w, P.saida.base / P.saida.h).setScale(0.5).setDepth(DEPTH.player);
            sai.play('portal_sai').once(fim, () => {
              sai.destroy();
              // o portal fica para trás e sai da tela com o cenário; a personagem volta a correr de onde a animação parou
              this.portalIndo = this.portalSozinho(PORTAL_SAIDA_X, DEPTH.item).play('portal_gira');
              this.sprite.setVisible(true);
              this.shadow.setVisible(true);
              this.nextVirusIn = Math.max(this.nextVirusIn, 250); // primeiro inimigo ~1 s depois de sair do portal
              this.nextPickupIn = Math.max(this.nextPickupIn, 400);
              this.state = 'playing';
            });
          });
        },
      });
    });
  }

  private scrollScenery(dx: number): void {
    this.bgX += dx;
    this.positionScenery();
  }

  /** Posiciona as três imagens visíveis e a torre 5G no início de cada uma. */
  private positionScenery(): void {
    const off = Math.floor(this.bgX);
    const first = Math.floor(off / SCENE_W);
    for (let j = 0; j < 3; j++) {
      const k = first + j; // índice do trecho no cenário infinito
      const scene = SCENES[Math.floor(k / SCENE_REPEAT) % SCENES.length]!;
      const x = k * SCENE_W - off;
      this.cities[j]!.setTexture(scene.key).setPosition(x, 0).setVisible(x < GAME_W && x + SCENE_W > 0);
      const t = this.towers[j]!;
      t.setPosition(x, GAME_H).setVisible(Math.abs(x - GAME_W / 2) < GAME_W / 2 + t.displayWidth / 2);
      const br = this.bridges[j]!;
      br.setPosition(x + BRIDGE.x, GROUND_Y - BRIDGE.deckTop).setVisible(scene.bridge && br.x < GAME_W && br.x + br.width > 0);
    }
  }

  // ---- personagem -----------------------------------------------------------------------------------------------

  /** Ponta da arma de wifi na tela (de onde sai o tiro). */
  private muzzle(): { x: number; y: number } {
    const p = this.player;
    return { x: PLAYER_X + 27, y: GROUND_Y - p.y - (p.ducking ? 25 : 43) };
  }

  private updatePlayerSprite(dt: number): void {
    const p = this.player;
    const jet = p.jetMs > 0;
    const grounded = onGround(p);
    const gun = this.run.gunAmmo > 0;
    this.animT += dt;

    const pre = gun ? 'slideg' : 'slide';
    if (!p.ducking && this.slideT > 0) {
      this.slideT = 0;
      this.getupT = grounded && !jet ? GETUP_S : 0;
    }
    if (!grounded || jet) this.getupT = 0;
    if (!grounded && !jet) this.wasAir = true;
    else if (grounded && this.wasAir) {
      this.wasAir = false;
      this.landT = gun ? 0.09 : 0;
    }
    this.landT = Math.max(0, this.landT - dt);
    let name: string;
    if (p.ducking) {
      // deslizando (vale com jetpack, arma ou no ar): quadros 1 a 3 do GIF e fica no último enquanto segurar
      this.slideT += dt;
      this.getupT = 0;
      name = `${pre}_${1 + Math.min(2, Math.floor(this.slideT / SLIDE_STEP))}`;
    } else if (this.getupT > 0 && grounded && !jet) {
      this.getupT -= dt; // levanta: quadros 4 e 5 do GIF
      name = `${pre}_${this.getupT > GETUP_S / 2 ? 4 : 5}`;
    } else if (jet) name = `fly_${Math.floor(this.animT * (p.thrusting ? 4 : 2.5)) % 2}`; // troca lenta, para não piscar
    else if (!grounded && gun) name = p.vy > 500 ? 'jumpg_1' : p.vy > -150 ? 'jumpg_2' : 'jumpg_3'; // subindo, topo, descendo
    else if (!grounded) name = p.vy > 0 ? 'jump' : 'fall';
    else if (gun && this.landT > 0) name = 'jumpg_0'; // aterrissando agachada
    else if (gun) name = `rung_${Math.floor(this.stride / STRIDE_PX) % 4}`;
    else name = `run_${Math.floor(this.stride / STRIDE_PX) % 4}`;
    this.sprite.setTexture(`pl_${name}`).setOrigin(SPRITE_ANCHOR[name] ?? 0.5, 1);
    this.sprite.setScale(SPRITE_SCALE);

    const feetY = GROUND_Y - p.y;
    this.sprite.y = feetY;
    const sh = Math.max(0.35, 1 - p.y / 420);
    this.shadow.setScale(sh, sh).setAlpha(0.32 * sh);

    // arma pequena quando o sprite não é o da pose armada
    const m = this.muzzle();
    this.gunImg.setVisible(gun && !/^(rung|slideg|jumpg)_/.test(name)).setPosition(m.x - 10, m.y);

    // pisca nos últimos segundos do jetpack
    const warn = jet && p.jetMs < JETPACK_WARN_MS;
    this.sprite.setAlpha(warn && Math.floor(this.animT * 10) % 2 === 0 ? 0.55 : 1);

    // ondas de wifi para baixo, saindo do roteador nas costas
    if (jet && p.thrusting) {
      this.waveTimer -= dt;
      while (this.waveTimer <= 0) {
        this.waveTimer += WAVE_INTERVAL;
        this.emitWave(PLAYER_X - 24, feetY - 41);
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
      const esc = w.s0 + (w.s1 - w.s0) * t;
      w.img.setScale(esc).setAlpha(0.95 * (1 - t * t));
      // o "vapor" do jetpack mata os vírus que encosta (conta como abate, igual ao tiro)
      if (this.state !== 'dead') {
        const hit = this.viruses.findIndex((v) => circlesOverlap(w.img.x, w.img.y, WAVE_HIT_R * esc, v.x, GROUND_Y - v.h, VIRUS_R));
        if (hit >= 0) this.killVirus(hit);
      }
    }
  }

  // ---- surgimento de bônus e vírus ------------------------------------------------------------------------------

  /** Nada (bônus ou vírus) perto do ponto de surgimento: evita sobrepor. */
  private clearAtSpawn(): boolean {
    const x = GAME_W + 60;
    return [...this.pickups, ...this.viruses].every((e) => Math.abs(e.x - x) > 280);
  }

  private updateSpawns(speed: number, dt: number): void {
    // caminho livre até o portal; a contagem continua correndo, para o próximo inimigo vir logo depois dele
    const livre = this.portalX() >= GAME_W + PORTAL_SEM_INIMIGOS;
    this.nextPickupIn -= speed * dt;
    this.nextVirusIn -= speed * dt;
    if (!livre) return;
    if (this.nextPickupIn <= 0) {
      if (this.clearAtSpawn()) {
        this.spawnPickup(pickPickupKind(this.rng));
        this.nextPickupIn = nextPickupGap(this.rng);
      } else {
        this.nextPickupIn = 150;
      }
    }
    if (this.nextVirusIn <= 0) {
      if (this.clearAtSpawn()) {
        this.spawnVirus();
        this.nextVirusIn = nextVirusGap(this.rng, virusDensityAt(this.seconds));
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
    this.showToast(BARS.find((b) => b.id === (kind === 'router' ? 'jet' : kind))!.nome);
    if (kind === 'router') {
      giveJetpack(this.player);
      // Só a onda de wifi em volta da personagem. Sem pulinho automático: ele jogava a personagem em cima de um
      // inimigo voando e ela morria sem ter apertado nada. Quem decide subir é o jogador (segurar PULAR).
      for (let i = 0; i < 3; i++) this.time.delayedCall(i * 80, () => this.emitWave(this.sprite.x - 14, this.sprite.y - 63));
    } else if (kind === 'energy') {
      giveEnergy(this.run);
    } else {
      giveGun(this.run);
      this.fireTimer = 0;
    }
  }

  /** Depois de perder, volta à tela de início (que sorteia um novo cenário). */
  private goMenu(): void {
    this.scene.start('Menu');
  }

  private showToast(text: string): void {
    this.toast.setText(text).setAlpha(1).setScale(0.6);
    this.tweens.killTweensOf(this.toast);
    this.tweens.add({ targets: this.toast, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.toast, alpha: 0, delay: 2200, duration: 500 });
  }

  // ---- arma de wifi e tiros -------------------------------------------------------------------------------------

  /** Espaço (ou o botão de tiro, no toque) dispara em linha reta; são GUN_SHOTS disparos. Para acertar, alinhe a altura com o vírus. */
  private updateGun(dt: number, fire: boolean): void {
    this.fireTimer = Math.max(0, this.fireTimer - dt);
    if (!fire || this.fireTimer > 0 || !useShot(this.run)) return;
    this.fireTimer = FIRE_COOLDOWN;
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
    // Na altura de pular vem um inimigo de chão; na de abaixar, um que flutua
    const chao = h === VIRUS_LOW;
    const opcoes = ENEMIES.filter((e) => e.chao === chao);
    const e = opcoes[Math.floor(this.rng() * opcoes.length)]!;
    const img = this.add.sprite(x, GROUND_Y - h, e.key).setScale(ENEMY_SCALE).setDepth(DEPTH.virus).setFlipX(e.virar);
    img.play({ key: e.key, startFrame: Math.floor(this.rng() * 4) });
    // sombra no chão, como a da personagem: sem ela o inimigo parece flutuar (a do que voa é menor e mais fraca)
    const sombra = this.add.ellipse(x, GROUND_Y + 3, chao ? 72 : 46, chao ? 14 : 9, 0x000000, chao ? 0.42 : 0.2).setDepth(DEPTH.shadow);
    this.viruses.push({ x, h, phase: this.rng() * 6.28, img, sombra, chao, pisar: chao ? (PISAR[e.key] ?? 8) : 0 });
  }

  private updateViruses(speed: number, dt: number): void {
    // ao soltar o abaixar, a personagem ainda aparece agachada por GETUP_S (quadros de levantar): a caixa segue o desenho,
    // senão um inimigo que ela vê passar por cima a acerta (ex.: soltar o dedo para tocar em ATIRAR)
    const levantando = (this.getupT > 0 || this.slideT > 0) && onGround(this.player); // slideT: soltou neste quadro
    const box = hitbox(levantando ? { ...this.player, ducking: true } : this.player, PLAYER_X);
    for (let i = this.viruses.length - 1; i >= 0; i--) {
      const v = this.viruses[i]!;
      v.x -= (speed + VIRUS_EXTRA_SPEED) * dt;
      v.sombra.setX(v.x);
      if (v.chao) v.img.setPosition(v.x, GROUND_Y - v.h + v.pisar); // no chão: só anda (a animação do GIF já mexe as patas)
      else v.img.setPosition(v.x, GROUND_Y - v.h + Math.sin(this.seconds * 5 + v.phase) * 3).setAngle(Math.sin(this.seconds * 3 + v.phase) * 6);
      if (circleHitsBox(v.x, v.h, VIRUS_HIT_R, box)) {
        this.die();
        return;
      }
      if (v.x < -100) {
        v.img.destroy();
        v.sombra.destroy();
        this.viruses.splice(i, 1);
      }
    }
  }

  private killVirus(i: number): void {
    const v = this.viruses[i]!;
    const pts = addKill(this.run);
    this.viruses.splice(i, 1);
    v.img.stop();
    v.sombra.destroy();
    this.tweens.add({ targets: v.img, scale: ENEMY_SCALE * 1.6, alpha: 0, duration: 180, onComplete: () => v.img.destroy() });
    const t = this.add
      .text(v.x, GROUND_Y - v.h - 30, `+${pts}`, { fontFamily: FONT, fontSize: '30px', color: multiplier(this.run) > 1 ? '#5CFF9A' : '#FFD43B', stroke: '#06214d', strokeThickness: 6 })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);
    this.tweens.add({ targets: t, y: t.y - 50, alpha: 0, duration: 800, onComplete: () => t.destroy() });
  }

  // ---- fim de jogo ----------------------------------------------------------------------------------------------

  /** Pontuação mostrada e enviada ao hub. */
  get score(): number {
    return scoreOf(this.run);
  }

  private die(): void {
    if (this.state === 'dead') return;
    this.state = 'dead';
    this.toggleHelp(false);
    this.gestos.clear();
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
      meta: { kills: this.run.kills, distanceM: distanceM(this.run) },
    });
    this.time.delayedCall(600, () => this.showGameOver());
  }

  private showGameOver(): void {
    this.overShown = true;
    // Tela padrão dos jogos Flix (fliperama). O botão de recomeçar é sempre o do jogo; a mensagem `restart` do hub continua valendo.
    const k = this.run.kills;
    telaFimDeJogo(this, {
      largura: GAME_W,
      altura: GAME_H,
      pontos: this.score,
      linhas: [{ texto: `${distanceM(this.run)} m · ${k} ${k === 1 ? 'ABATE' : 'ABATES'}` }],
      px: { titulo: 3.5, pontos: 6, texto: 2, botao: 2.5 },
      depth: DEPTH.over,
      onReiniciar: () => this.goMenu(),
    });
  }

  // ---- HUD ----------------------------------------------------------------------------------------------------------

  private updateHud(): void {
    const r = this.run;
    this.hudScore.setText(String(this.score).padStart(4, '0')); // o x3 da energia aparece na barra dela
    this.hudMult.setVisible(false); // o x3 agora aparece na barra da energia
    this.hudKills.setText(String(r.kills));
    this.hudDist.setText(`${distanceM(r)} m`);
    this.fireBtn.setVisible(r.gunAmmo > 0);

    const left: Record<BarId, { ms: number; max: number }> = {
      jet: { ms: this.player.jetMs, max: JETPACK_MS },
      energy: { ms: r.energyMs, max: ENERGY_MS },
      gun: { ms: r.gunAmmo, max: GUN_SHOTS },
    };
    let row = 0;
    for (const b of this.bars) {
      const info = left[b.id];
      const on = info.ms > 0;
      for (const o of [b.icon, b.g, b.label]) o.setVisible(on);
      if (!on) continue;
      const y = LINHA_Y + row * LINHA_H;
      row++;
      const segundos = Math.ceil(info.ms / 1000);
      b.icon.setY(y);
      b.label.setY(y).setText(b.id === 'gun' ? `${info.ms} ${info.ms === 1 ? 'TIRO' : 'TIROS'}` : b.id === 'energy' ? `x3 · ${segundos}s` : `${segundos}s`);
      const cheios = Math.ceil((info.ms / info.max) * GOMOS);
      const warn = info.ms < (b.id === 'jet' ? JETPACK_WARN_MS : b.id === 'gun' ? 3 : 2000) && Math.floor(this.animT * 8) % 2 === 0;
      const desenho = `${y}|${cheios}|${warn}`;
      if (desenho === b.desenho) continue; // só redesenha quando muda
      b.desenho = desenho;
      const cor = warn ? 0xff4a5a : BARS.find((x) => x.id === b.id)!.color;
      const g = b.g.clear();
      g.fillStyle(0x0b1530, 1).fillRect(BAR_X - 3, y - 9, BAR_W + 6, 18); // contorno
      for (let i = 0; i < GOMOS; i++) {
        const x = BAR_X + i * (GOMO_W + GOMO_GAP);
        if (i < cheios) {
          g.fillStyle(cor, 1).fillRect(x, y - 6, GOMO_W, 12);
          g.fillStyle(0xffffff, 0.35).fillRect(x, y - 6, GOMO_W, 3); // brilho em cima do gomo
        } else {
          g.fillStyle(0x2a3550, 1).fillRect(x, y - 6, GOMO_W, 12);
        }
      }
    }
    this.toast.setY(LINHA_Y + Math.max(1, row) * LINHA_H - 2);
  }

}
