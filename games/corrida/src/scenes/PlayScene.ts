import Phaser from 'phaser';
import { criarTexturaCarroDeImagem, quadroDoAngulo } from '../carro';
import { andarCarro, amostraMaisProxima, apontar, batida, controlarIA, ESTA_RODANDO, evitar, classificou, embaralhar, fatorTeto, formatarTempo, LIMITE_CLASSIFICACAO, proximaEtapa, TURBO_MS, PASSO_AMOSTRA, Progresso, reforcoRival, velocidade, Voltas, type Carro } from '../logic';
import { Itens, type Evento, type Piloto } from '../itens';
import { criarArteItens } from '../itensArte';
import { chaveArte, criarPista, PISTAS, type PistaPronta } from '../pistas';
import { MAPA_H, Minimapa, type PontoMapa } from '../minimapa';
import { MenuCorrida, type Escolha } from '../menu';
import { CaixaHud, caixaBotao, caixaPad, caixaPista, caixaTeclas, caixaTempo, caixaVelocidade, type TipoPad } from '../hud';
import { ALTURA_ARTE, ALTURA_REFERENCIA_UI, LARGURA_ARTE, COLORS, FONT } from '../theme';

interface Rival {
  nome: string;
  carro: Carro;
  sprite: Phaser.GameObjects.Image;
  indice: number;
  lateral: number;
  /** Fração do teto de velocidade do jogador (rivais um pouco mais lentos). */
  habilidade: number;
  prog: Progresso;
  /** ms restantes de um golpe de propósito no jogador (0 = não está atacando). */
  ataqueMs: number;
  rodava: boolean;
  /** Textura do carro (cor). */
  chave: string;
  /** Desvio aleatório em torno do centro da faixa (px): o rival não anda sempre reto. */
  desvioAtual: number;
  alvoDesvio: number;
  trocaMs: number;
  /** Faixa (px do centro da pista) em que o rival está andando agora; vai até o alvo aos poucos. */
  faixaAtual: number;
  /** Colado atrás do jogador (na faixa dele). */
  seguindo: boolean;
  /** Atento: freia se o jogador freia na frente dele (não cai no break check). Sorteado cada vez que ele passa a seguir. */
  atento: boolean;
}

/**
 * Carros da equipe (public/img/carros, ver scripts/corrida/montar_carros.py). O jogador é o 01, vermelho com o
 * patrocínio FLIX; os outros 10 são os adversários. A habilidade cai da frente para o fundo do grid.
 */
const CARRO_JOGADOR = 'vermelho-flix';
/** A arte detalhada dos carros tem 8x o tamanho do carro no jogo (scripts/corrida/montar_carros.py, HD). */
const ESCALA_HD = 1 / 8;
/** Cor de cada carro no minimapa (a cor principal da pintura). */
const COR_NO_MAPA: Record<string, string> = {
  'vermelho-flix': '#e0182c', 'marrom-torq': '#9a5a2c', 'grafite-volt': '#b6f23a', 'prata-orbit': '#d6dbe4',
  'turquesa-onda': '#22c7c7', 'rosa-pop': '#ff3fa0', 'roxo-nova': '#a45ce0', 'verde-serra': '#2f9a4f',
  'laranja-brasa': '#ff7a1c', 'azul-mare': '#2f6fff', 'amarelo-zing': '#ffc21c',
};
const RIVAIS = (['marrom-torq', 'grafite-volt', 'prata-orbit', 'turquesa-onda', 'rosa-pop', 'roxo-nova', 'verde-serra', 'laranja-brasa', 'azul-mare', 'amarelo-zing'] as const).map((nome, i) => ({
  nome,
  chave: `carro_${nome}`,
  habilidade: 0.985 - 0.009 * i,
}));
/** Posição do jogador no grid de largada (6º de 11). */
const SLOT_JOGADOR = 5;
const FILA_PASSOS = 14; // amostras (x4 px) entre uma fileira e a seguinte
/**
 * Faixas dos rivais (px do centro da pista) e quanto cada um se desvia ao acaso do centro da sua faixa, para o asfalto
 * de referência (94 px); em pista mais estreita as duas medidas encolhem na mesma proporção (`ASFALTO_REF`).
 */
const FAIXA = 24;
const DESVIO_MAX = 10;
const ASFALTO_REF = 94;
/** Botões de toque (celular, tela deitada): lado e margem em pixels de uma tela de 540 de altura. */
const PAD = 92;
const PAD_MARGEM = 20;
const PAD_VAO = 14;
/** A corrida termina quando o jogador completa esta quantidade de voltas. */
const VOLTAS_TOTAIS = 10;
/** Treino (só o jogador, sem fim): teto de velocidade 30% acima do da corrida, e não sobe a cada volta. */
const TREINO_VEL = 1.3;
/** A cada volta completada o zoom do mundo diminui 10% (o jogador fica mais rápido); a mudança leva ~1 s, suave. */
const ZOOM_POR_VOLTA = 0.9;
const ZOOM_TRANSICAO_MS = 1000;
/** Perspectiva nova: o carro fica parado na tela (apontando para cima) e a pista gira. Quanto o centro da câmera fica à frente do carro (px do mundo). */
const VISTA_A_FRENTE_PX = 55;
/** A rotação da câmera acompanha o carro com atraso (constante de tempo, s): as curvas ficam suaves e o carro inclina um pouco nelas. */
const VISTA_SUAVIDADE_S = 0.25;
/**
 * Break check: um rival que fica logo atrás do jogador passa a seguir a faixa dele (colado) e, se não estiver atento, não
 * freia quando o jogador freia na frente: ele bate por trás e quem bate por trás rodopia.
 */
const SEGUIR_MIN_PX = 20;
const SEGUIR_MAX_PX = 150;
const SEGUIR_LATERAL_PX = 45;
const CHANCE_ATENTO = 0.3;
const RAIO_CARRO = 9.5;
/** Tempo (ms) que a roleta gira antes de mostrar o resultado, e que o resultado fica na tela. */
const ROLETA_GIRO_MS = 2000;
const ROLETA_RESULTADO_MS = 2000; // dois círculos por carro (cápsula), ver logic.ts
/** Tempo mínimo (ms) entre duas vezes em que o jogador é atingido/rodopia, e janela do golpe aleatório. */
const INTERVALO_GOLPE_MS = 15000;
const PRIMEIRO_GOLPE_MS = 8000;
const CHANCE_GOLPE_POR_S = 0.15;
const DURACAO_ATAQUE_MS = 6000;
const ALCANCE_ATAQUE_PX = 360;

/**
 * Cena de teste do carro e das pistas: acelera sozinho, setas ou A/D viram, S/espaço freiam, 1 e 2 trocam de pista.
 * No toque: arrastar para a esquerda ou direita vira.
 */
/** Margens da área segura (câmera, entalhe, barra de gestos) em pixels do jogo; lidas do CSS env() a cada meio segundo. */
let margens = { esq: 0, dir: 0, topo: 0, base: 0 };
let margensEm = -1;
function areaSegura(): typeof margens {
  const agora = performance.now();
  if (agora - margensEm < 500) return margens;
  margensEm = agora;
  const el = document.getElementById('area-segura');
  if (!el) return margens;
  const cs = getComputedStyle(el);
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const v = (n: string) => (parseFloat(n) || 0) * dpr;
  margens = { esq: v(cs.paddingLeft), dir: v(cs.paddingRight), topo: v(cs.paddingTop), base: v(cs.paddingBottom) };
  return margens;
}

/** Acima de tudo do mundo (os carros usam 1 + y, até ~2.500) e do minimapa. */
const PROFUNDIDADE_PLACAR = 100_000;

export class PlayScene extends Phaser.Scene {
  private pista!: PistaPronta;
  private carro!: Carro;
  private sprite!: Phaser.GameObjects.Image;
  private sombras: Phaser.GameObjects.Image[] = [];
  private fundo?: Phaser.GameObjects.Image;
  private voltas!: Voltas;
  private indice = 0;
  private keys!: Record<'left' | 'right' | 'a' | 'd' | 'up' | 'w' | 'down' | 's' | 'space' | 'enter' | 'n' | 'p', Phaser.Input.Keyboard.Key>;
  /** Aceleração automática (tecla T, só no computador): o carro acelera sem segurar nada. No celular são os botões. */
  private autoAcelera = true;
  /** Celular: botões na tela (esquerda, direita, freio, acelerar e turbo) no lugar de arrastar o dedo. */
  private toque = false;
  private pads: Array<{ tipo: TipoPad; cx: CaixaHud; fx: number; dx: number; ox: number; dy: number }> = [];
  private padsAntes = new Set<TipoPad>();
  private imgMapa!: Phaser.GameObjects.Image;
  /** Celular: botão de reiniciar a corrida (pede um 2º toque em até 2 s, para não reiniciar sem querer). */
  private cxReiniciar: CaixaHud | null = null;
  private confirmaReiniciarMs = 0;
  /** Celular: botão de voltar ao menu no meio da corrida (também pede o 2º toque: a corrida se perde). */
  private cxMenu: CaixaHud | null = null;
  private confirmaMenuMs = 0;
  // placar em caixas com a fonte pixel (hud.ts); a barra de teclas só existe no computador
  private cxPista!: CaixaHud;
  private cxTempo!: CaixaHud;
  private cxVel!: CaixaHud;
  private cxTeclas: CaixaHud | null = null;
  private pistaAtual = 0;
  /** Arte da pista ainda baixando: o jogo espera (nada anda). */
  private carregando = false;
  private minimapa!: Minimapa;
  /** Desvio máximo dos rivais nesta pista (DESVIO_MAX na proporção do asfalto). */
  private desvioMax = DESVIO_MAX;
  private rivais: Rival[] = [];
  private progJogador!: Progresso;
  private tempoCorrida = 0;
  private ultimoGolpe = 0;
  private posicaoAtual = 1;
  private aviso!: Phaser.GameObjects.Text;
  private avisoMs = 0;
  private novaVoltaMs = 0; // "NOVA VOLTA!" na caixa do tempo
  private jogadorBateu = false;
  /** Triângulo amarelo acima do carro do jogador. */
  private marcador!: Phaser.GameObjects.Image;
  /** Conferência do modelo (tecla M): o carro em 8 ângulos, ampliado. */
  private modelo: Phaser.GameObjects.Image[] = [];
  private itens?: Itens;
  /** Chama do turbo de cada carro (0 = jogador, depois os rivais). */
  private chamas: Phaser.GameObjects.Image[] = [];
  /** Motivo do rodopio do jogador (vaca, meteoro, poça...), para o aviso. */
  private causa: string | null = null;
  /** Turbo guardado (pego na pista), esperando o jogador apertar ESPAÇO. */
  private turboGuardado = false;
  /** Roleta girando: ms que faltam (o carro pisca e continua sob controle do jogador até sair o resultado). */
  private roletaMs = 0;
  /** Corrida terminada: o carro do jogador freia sozinho e a tela de resultado aparece. */
  private fim = false;
  /** Campeonato: ordem sorteada das pistas no começo do jogo e etapa atual. Só avança ficando entre os 6 primeiros. */
  private ordem: number[] = [];
  private etapa = 0;
  private classificado = false;
  /** Campeonato (24 pistas sorteadas) ou corrida livre (pista escolhida no menu). */
  private modo: 'campeonato' | 'livre' | 'treino' = 'campeonato';
  private menu!: MenuCorrida;
  private noMenu = false; // com o menu aberto o jogo fica parado
  private posicaoFinal = 99;
  /** Escolha livre de pista (?livre na URL): teclas N e P, para testes. */
  private livre = new URLSearchParams(window.location.search).has('livre');
  /** true = carro parado na tela e pista girando (teste); false = visão fixa de cima. Tecla V alterna. */
  private girar = false;
  private camRot = 0;
  /** Zoom inteiro do mundo (cada pixel da arte = zoomBase pixels da tela), conforme a altura da janela. */
  private zoomBase = 3;
  private zoomAtual = 3;
  private zoomDe = 3;
  private zoomPara = 3;
  private zoomT = ZOOM_TRANSICAO_MS;
  private voltasDoZoom = 0;
  /** Objetos da interface fixos na tela (a escala e a posição acompanham o zoom). */
  private ui: Array<{ obj: Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform; fx: number; fy: number; dx: number; dy: number; mult: number; fonte?: { px: number; stroke: number }; nativo?: boolean }> = [];
  private tempoFim = 0;
  private resultado!: Phaser.GameObjects.Text;
  private veu!: Phaser.GameObjects.Rectangle;
  private dicaTurbo!: Phaser.GameObjects.Text;

  constructor() {
    super('Play');
  }

  preload(): void {
    for (const nome of [CARRO_JOGADOR, ...RIVAIS.map((r) => r.nome)]) {
      this.load.image(`arte_${nome}`, `img/carros/${nome}.png`);
      this.load.image(`hd_${nome}`, `img/carros/hd/${nome}.png`);
    }
    for (const v of ['lado', 'diagonal', 'frente']) this.load.image(`vaca_${v}`, `img/vaca/${v}.png`); // arte da equipe (montar_vaca.py)
  }

  create(): void {
    criarTexturaCarroDeImagem(this, 'carro', `arte_${CARRO_JOGADOR}`);
    for (const r of RIVAIS) criarTexturaCarroDeImagem(this, r.chave, `arte_${r.nome}`);
    // arco-íris: versão clara e sem cor do carro, tingida em degradê durante o efeito
    criarTexturaCarroDeImagem(this, 'carro_arco', `arte_${CARRO_JOGADOR}`, true);
    // Carros na pista: arte detalhada (8x) desenhada no tamanho do carro e girada pela placa de vídeo, com suavização,
    // para os nomes e números da pintura aparecerem (a versão 41 x 19 empilhada vira blocos com o zoom da câmera)
    for (const nome of [CARRO_JOGADOR, ...RIVAIS.map((r) => r.nome)]) this.textures.get(`hd_${nome}`).setFilter(Phaser.Textures.FilterMode.LINEAR);
    if (!this.textures.exists('hd_arco')) {
      const fonte = this.textures.get(`hd_${CARRO_JOGADOR}`).getSourceImage() as HTMLImageElement;
      const t = this.textures.createCanvas('hd_arco', fonte.width, fonte.height)!;
      const g = t.getContext();
      g.drawImage(fonte, 0, 0);
      const d = g.getImageData(0, 0, fonte.width, fonte.height);
      for (let i = 0; i < d.data.length; i += 4) {
        const l = 0.3 * d.data[i]! + 0.59 * d.data[i + 1]! + 0.11 * d.data[i + 2]!;
        d.data[i] = d.data[i + 1] = d.data[i + 2] = Math.min(255, 90 + l * 0.75);
      }
      g.putImageData(d, 0, 0);
      t.refresh();
      t.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    criarArteItens(this);
    if (!this.textures.exists('marcador')) {
      // triângulo de 9 x 5 px apontando para baixo, amarelo com contorno escuro (pixel a pixel)
      const tex = this.textures.createCanvas('marcador', 11, 7)!;
      const g = tex.getContext();
      for (let y = 0; y < 7; y++) {
        const meia = 5 - y; // metade da largura da linha (contorno incluído)
        for (let x = 5 - meia; x <= 5 + meia; x++) {
          const borda = y === 0 || x === 5 - meia || x === 5 + meia || y === 6;
          g.fillStyle = borda ? '#3a2a00' : '#ffd23f';
          g.fillRect(x, y, 1, 1);
        }
      }
      tex.refresh();
    }
    this.marcador = this.add.image(0, 0, 'marcador').setDepth(900);
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys({
      left: 'LEFT', right: 'RIGHT', a: 'A', d: 'D', up: 'UP', w: 'W', down: 'DOWN', s: 'S', space: 'SPACE', enter: 'ENTER', n: 'N', p: 'P',
    }) as typeof this.keys;
    kb.on('keydown-N', () => {
      if (this.livre) this.carregarPista((this.pistaAtual + 1) % PISTAS.length);
    });
    kb.on('keydown-P', () => {
      if (this.livre) this.carregarPista((this.pistaAtual + PISTAS.length - 1) % PISTAS.length);
    });
    kb.on('keydown-ENTER', () => {
      if (this.fim) this.continuar();
    });
    kb.on('keydown-V', () => {
      this.girar = !this.girar;
      this.aplicarLimites();
    });
    kb.on('keydown-T', () => this.alternarAuto());
    kb.on('keydown-M', () => this.modelo.forEach((m) => m.setVisible(!m.visible)));
    kb.on('keydown-R', () => this.carregarPista(this.pistaAtual));
    kb.on('keydown-ESC', () => this.abrirMenu());

    // Toque: botões na tela (lidos a cada quadro em padsApertados, vários dedos ao mesmo tempo). Tocar fora deles no
    // fim da corrida segue adiante, como o ENTER.
    this.input.addPointer(3);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.cxMenu?.img.visible && this.noBotao(this.cxMenu, p.x, p.y)) {
        if (this.confirmaMenuMs > 0) {
          this.confirmaMenuMs = 0;
          this.abrirMenu();
        } else this.confirmaMenuMs = 2000;
        return;
      }
      if (!this.cxReiniciar?.img.visible || !this.noBotao(this.cxReiniciar, p.x, p.y)) return;
      if (this.confirmaReiniciarMs > 0) {
        this.confirmaReiniciarMs = 0;
        this.carregarPista(this.pistaAtual);
      } else this.confirmaReiniciarMs = 2000;
    });
    this.input.on('pointerup', () => {
      if (this.fim && this.tempoCorrida - this.tempoFim > 1200) this.continuar();
    });
    this.toque = !!this.sys.game.device.input.touch;
    if (this.toque) {
      this.autoAcelera = false; // no celular quem acelera é o botão ACELERAR
      const passo = PAD + PAD_VAO;
      const base = -PAD_MARGEM;
      const pads: Array<[TipoPad, number, number, number, number]> = [
        ['esq', 0, PAD_MARGEM, 0, base],
        ['dir', 0, PAD_MARGEM + passo, 0, base],
        ['acel', 1, -PAD_MARGEM, 1, base],
        ['freio', 1, -PAD_MARGEM - passo, 1, base],
        ['turbo', 1, -PAD_MARGEM, 1, base - passo],
      ];
      this.cxReiniciar = this.fixarNativo(new CaixaHud(this, 'hud_reiniciar'), 1, 0, 1, -12, 10);
      this.cxMenu = this.fixarNativo(new CaixaHud(this, 'hud_menu'), 1, 0, 1, -12, 10);
      for (const [tipo, fx, dx, ox, dy] of pads) {
        const cx = this.fixarNativo(new CaixaHud(this, `pad_${tipo}`), fx, 1, ox, dx, dy, 1);
        this.pads.push({ tipo, cx, fx, dx, ox, dy });
      }
    }

    // interface: a câmera do mundo tem zoom; os textos ficam sem zoom (escala 1/zoom compensa), então saem nítidos.
    // Posição = fração da tela + deslocamento em pixels de uma tela de 540 de altura (escalado pela altura real).
    const fonte = { fontFamily: FONT, fontSize: '18px', color: COLORS.text, stroke: '#000', strokeThickness: 4 };
    // minimapa no canto de baixo, à direita: ~24% da altura da tela
    this.minimapa = new Minimapa(this);
    this.imgMapa = this.fixar(this.add.image(0, 0, this.minimapa.chave).setOrigin(1, 1), 1, 1, -12, -12, 1500, (0.24 * ALTURA_REFERENCIA_UI) / MAPA_H);
    this.cxPista = this.fixarNativo(new CaixaHud(this, 'hud_pista'), 0, 0, 0, 12, 10);
    this.cxTempo = this.fixarNativo(new CaixaHud(this, 'hud_tempo'), 0.5, 0, 0.5, 0, 10);
    this.cxVel = this.fixarNativo(new CaixaHud(this, 'hud_vel'), 1, 0, 1, -12, 10);
    if (!this.sys.game.device.input.touch) this.cxTeclas = this.fixarNativo(new CaixaHud(this, 'hud_teclas'), 0, 1, 0, 12, -12, 1);
    this.dicaTurbo = this.fixar(this.add.text(0, 0, '', { ...fonte, color: '#7FCAFF' }).setOrigin(0.5), 0.5, 1, 0, -56, 1000, 1, { px: 28, stroke: 5 });
    this.aviso = this.fixar(this.add.text(0, 0, '', { ...fonte, color: '#FFD23F' }).setOrigin(0.5), 0.5, 0, 0, 110, 1000, 1, { px: 28, stroke: 5 });
    this.veu = this.fixar(this.add.rectangle(0, 0, 10, 10, 0x000000, 0.7), 0.5, 0.5, 0, 0, 3000).setVisible(false);
    this.resultado = this.fixar(this.add.text(0, 0, '', { ...fonte, align: 'center', lineSpacing: 10 }).setOrigin(0.5), 0.5, 0.5, 0, 0, 3001, 1, { px: 26, stroke: 4 }).setVisible(false);
    for (let i = 0; i < 8; i++) {
      this.modelo.push(this.fixar(this.add.image(0, 0, 'carro', i * 9), 0, 1, 90 + i * 110, -90, 2000, 2).setVisible(false));
    }
    // começo do jogo: a ordem das pistas é sorteada
    this.ordem = embaralhar(PISTAS.length);
    this.etapa = 0;
    const inicial = Number(new URLSearchParams(window.location.search).get('pista') ?? 0) - 1;
    if (Number.isFinite(inicial) && inicial >= 0 && inicial < PISTAS.length) {
      // ?pista=N (teste): põe essa pista como a primeira da ordem
      const k = this.ordem.indexOf(inicial);
      [this.ordem[0], this.ordem[k]] = [this.ordem[k]!, this.ordem[0]!];
    }
    this.scale.on('resize', () => this.recalcular());
    this.recalcular();
    // Jogo imersivo: pede ao hub a tela toda (sem a barra dele); voltar ao hub é o botão do menu
    const bridge = this.registry.get('bridge') as { sendLayout?: (i: boolean) => void; sendExit?: () => void } | undefined;
    bridge?.sendLayout?.(true);
    this.menu = new MenuCorrida(PISTAS, () => bridge?.sendExit?.());
    // ?pista=N e ?livre (testes) entram direto na corrida; o normal é abrir o menu
    if (this.livre || new URLSearchParams(window.location.search).has('pista')) this.carregarPista(this.ordem[0]!);
    else {
      // abertura: uma pista sorteada passa ao fundo (a câmera percorre o traçado) com os carros parados no grid
      this.abrirMenu('abertura');
      this.carregarPista(this.ordem[0]!);
    }
  }

  /** Menu do começo: o jogo para e o teclado do jogo é desligado (as setas e o Enter passam a ser do menu). */
  private abrirMenu(tela: 'abertura' | 'modos' = 'modos'): void {
    if (this.menu.aberto) return;
    this.noMenu = true;
    this.mostrarUi(false);
    this.menu.avisoGirar(false);
    const kb = this.input.keyboard!;
    kb.enabled = false;
    kb.disableGlobalCapture();
    this.menu.abrir((e) => this.iniciar(e), tela);
  }

  /** Placar, botões e minimapa somem com o menu aberto (a abertura mostra só a pista). */
  private mostrarUi(sim: boolean): void {
    for (const { obj } of this.ui) (obj as unknown as Phaser.GameObjects.Components.Alpha).setAlpha?.(sim ? 1 : 0);
    this.marcador?.setAlpha(sim ? 1 : 0);
  }

  /** Fundo da abertura: a câmera percorre a linha central da pista, afastada, com os carros parados onde estão. */
  private vitrineT = 0;
  private vitrine(delta: number): void {
    const am = this.pista.amostras;
    if (!am.length) return;
    this.vitrineT += delta;
    const pos = (this.vitrineT * 0.09) / PASSO_AMOSTRA; // ~90 px/s pelo traçado
    const a = am[Math.floor(pos) % am.length]!, b = am[(Math.floor(pos) + 1) % am.length]!, f = pos % 1;
    const cam = this.cameras.main;
    cam.setRotation(0);
    this.camRot = 0;
    cam.setZoom(this.zoomBase * 0.8);
    cam.centerOn(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f);
    const visuais = [{ car: this.carro, spr: this.sprite }, ...this.rivais.map((r) => ({ car: r.carro, spr: r.sprite }))];
    visuais.forEach(({ car, spr }, i) => {
      spr.setPosition(car.x, car.y).setRotation(car.ang).setDepth(1 + Math.round(car.y)).setScale(ESCALA_HD);
      this.sombras[i]?.setPosition(car.x + 2, car.y + 3).setRotation(car.ang).setDepth(0.5).setVisible(true);
    });
  }

  private iniciar(e: Escolha): void {
    const kb = this.input.keyboard!;
    kb.enabled = true;
    kb.enableGlobalCapture();
    kb.resetKeys();
    this.noMenu = false;
    this.mostrarUi(true);
    this.menu.fecharAcoes();
    this.modo = e.modo;
    if (e.modo === 'livre' || e.modo === 'treino') {
      this.carregarPista(e.pista);
      return;
    }
    this.ordem = embaralhar(PISTAS.length);
    this.etapa = 0;
    this.carregarPista(this.ordem[0]!);
  }

  private carregarPista(i: number): void {
    this.confirmaReiniciarMs = 0;
    this.confirmaMenuMs = 0;
    this.menu?.fecharAcoes(); // R no fim da corrida também tira os botões do resultado
    const def = PISTAS[i]!;
    // Arte da pista: só a da corrida atual fica na memória (as 24 juntas passariam de 90 MB de vídeo no celular).
    if (def.arte && !this.textures.exists(chaveArte(def))) {
      this.carregando = true;
      this.load.image(chaveArte(def), def.arte);
      this.load.once(Phaser.Loader.Events.COMPLETE, () => this.carregarPista(i));
      this.load.start();
      return;
    }
    const anterior = PISTAS[this.pistaAtual];
    this.pistaAtual = i;
    this.carregando = false;
    this.pista = criarPista(this, def, 'pista');
    this.fundo?.destroy();
    if (anterior?.arte && anterior !== def && this.textures.exists(chaveArte(anterior))) this.textures.remove(chaveArte(anterior));
    this.fundo = (def.arte
      ? this.add.image(0, 0, chaveArte(def)).setScale(def.escala ?? 1) // arte da equipe ampliada sem suavizar (pixelArt)
      : this.add.image(0, 0, 'pista')).setOrigin(0, 0).setDepth(0);
    this.minimapa?.usarPista(this.pista, def.arte ? chaveArte(def) : 'pista');
    const prop = def.largura / ASFALTO_REF;
    const faixa = Math.round(FAIXA * prop);
    this.desvioMax = DESVIO_MAX * prop;
    const am = this.pista.amostras;
    const n = am.length;
    // grade de largada: 2 fileiras atrás da linha; o jogador sai na fileira da frente, à direita
    const posicao = (passos: number, lateral: number): Carro => {
      const a = am[(n - passos) % n]!;
      return { x: a.x - Math.sin(a.ang) * lateral, y: a.y + Math.cos(a.ang) * lateral, ang: a.ang, vx: 0, vy: 0 };
    };
    // grade de largada: 2 carros por fileira; o jogador sai em 6º
    const slotPadrao = (k: number) => ({ passos: 10 + FILA_PASSOS * Math.floor(k / 2) + (k % 2 === 0 ? 0 : 5), lateral: k % 2 === 0 ? -faixa : faixa });
    // grid desenhado na arte: cada carro na sua marca (amostra mais próxima no fim da volta e distância ao centro)
    const slotDaArte = (k: number) => {
      const [gx, gy] = def.grade![k]!;
      let melhor = n - 1, dm = Infinity;
      for (let j = Math.floor(n * 0.75); j < n; j++) {
        const d = (am[j]!.x - gx) ** 2 + (am[j]!.y - gy) ** 2;
        if (d < dm) { dm = d; melhor = j; }
      }
      const a = am[melhor]!;
      return { passos: n - melhor, lateral: -(gx - a.x) * Math.sin(a.ang) + (gy - a.y) * Math.cos(a.ang) };
    };
    const slot = (k: number) => (def.grade && def.grade.length > k ? slotDaArte(k) : slotPadrao(k));
    const meuSlot = slot(SLOT_JOGADOR);
    this.carro = posicao(meuSlot.passos, meuSlot.lateral);
    this.indice = n - meuSlot.passos;
    this.voltas = new Voltas(n);
    this.voltas.atualizar(0, 0);
    this.progJogador = new Progresso(n, this.indice);
    this.tempoCorrida = 0;
    this.ultimoGolpe = 0;
    this.posicaoAtual = 1;
    this.sprite?.destroy();
    this.sprite = this.add.image(0, 0, `hd_${CARRO_JOGADOR}`).setScale(ESCALA_HD);
    this.rivais.forEach((r) => r.sprite.destroy());
    this.sombras.forEach((s) => s.destroy());
    // sombra de cada carro (a mesma imagem, escura e transparente, um pouco deslocada)
    this.sombras = Array.from({ length: (this.modo === 'treino' ? 0 : RIVAIS.length) + 1 }, () => this.add.image(0, 0, `hd_${CARRO_JOGADOR}`).setScale(ESCALA_HD).setTint(0x000000).setAlpha(0.3));
    this.rivais = (this.modo === 'treino' ? [] : RIVAIS).map((r, i) => {
      const k = i < SLOT_JOGADOR ? i : i + 1; // pula o slot do jogador
      const { passos, lateral } = slot(k);
      return {
        nome: r.nome,
        carro: posicao(passos, lateral),
        sprite: this.add.image(0, 0, `hd_${r.nome}`).setScale(ESCALA_HD),
        indice: n - passos,
        lateral,
        habilidade: r.habilidade,
        prog: new Progresso(n, n - passos),
        ataqueMs: 0,
        rodava: false,
        chave: r.chave,
        desvioAtual: 0,
        alvoDesvio: 0,
        trocaMs: Math.random() * 2000,
        faixaAtual: lateral,
        seguindo: false,
        atento: false,
      };
    });
    this.itens?.destruir();
    this.itens = new Itens(this, this.pista, (e, p) => this.aoEvento(e, p));
    this.chamas.forEach((ch) => ch.destroy());
    this.chamas = [this.sprite, ...this.rivais.map((r) => r.sprite)].map(() => this.add.image(0, 0, 'chama0').setOrigin(1, 0.5).setVisible(false));
    this.causa = null;
    this.turboGuardado = false;
    this.roletaMs = 0;
    this.fim = false;
    this.zoomAtual = this.zoomDe = this.zoomPara = this.zoomBase;
    this.zoomT = ZOOM_TRANSICAO_MS;
    this.voltasDoZoom = 0;
    this.cameras.main.setZoom(this.zoomBase);
    this.atualizarUi();
    this.veu.setVisible(false);
    this.resultado.setVisible(false);
    this.camRot = this.girar ? -Math.PI / 2 - this.carro.ang : 0; // começa já alinhado
    this.aplicarLimites();
  }

  update(_t: number, delta: number): void {
    if (this.carregando || !this.pista) return;
    if (this.noMenu) {
      this.vitrine(delta);
      return;
    }
    const emPe = this.toque && this.W < this.H;
    this.menu.avisoGirar(emPe);
    if (emPe) return; // corrida parada até o celular deitar
    const dt = Math.min(delta, 50) / 1000;
    const k = this.keys;
    let giro = (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0);
    const ap = this.toque ? this.padsApertados() : new Set<TipoPad>();
    if (giro === 0) giro = (ap.has('dir') ? 1 : 0) - (ap.has('esq') ? 1 : 0);
    const freio = this.fim || k.down.isDown || k.s.isDown || ap.has('freio');
    const acelera = !this.fim && !ap.has('freio') && (this.autoAcelera || k.up.isDown || k.w.isDown || ap.has('acel'));
    if (!this.fim && ap.has('turbo') && !this.padsAntes.has('turbo')) this.ativarTurbo();
    this.padsAntes = ap;
    if (this.confirmaReiniciarMs > 0) this.confirmaReiniciarMs -= delta;
    if (this.confirmaMenuMs > 0) this.confirmaMenuMs -= delta;
    if (this.fim) giro = 0;
    if (!this.fim && Phaser.Input.Keyboard.JustDown(k.space)) this.ativarTurbo();

    this.tempoCorrida += delta;
    // treino: mais rápido e sem o acréscimo por volta (as voltas não têm fim)
    const teto = this.modo === 'treino' ? fatorTeto(this.tempoCorrida, 0) * TREINO_VEL : fatorTeto(this.tempoCorrida, this.voltas.voltas);
    const c = this.carro;
    const meuProg = this.progJogador.valor();
    const rodavaJogador = ESTA_RODANDO(c);

    // golpe aleatório no jogador: no mínimo 15 s depois da última vez que ele foi atingido
    if (
      !this.fim &&
      this.tempoCorrida >= PRIMEIRO_GOLPE_MS &&
      this.tempoCorrida - this.ultimoGolpe >= INTERVALO_GOLPE_MS &&
      !rodavaJogador &&
      !this.rivais.some((r) => r.ataqueMs > 0) &&
      Math.random() < CHANCE_GOLPE_POR_S * dt
    ) {
      const atras = this.rivais
        .filter((r) => !ESTA_RODANDO(r.carro) && (meuProg - r.prog.valor()) * PASSO_AMOSTRA > 20 && (meuProg - r.prog.valor()) * PASSO_AMOSTRA < ALCANCE_ATAQUE_PX)
        .sort((x, y) => y.prog.valor() - x.prog.valor())[0];
      if (atras) atras.ataqueMs = DURACAO_ATAQUE_MS;
    }

    andarCarro(c, { giro, freio, acelera }, this.pista.superficie(c.x, c.y), dt, teto);

    for (const r of this.rivais) {
      r.indice = amostraMaisProxima(this.pista.amostras, r.carro.x, r.carro.y, r.indice);
      const sup = this.pista.superficie(r.carro.x, r.carro.y);
      const gap = (meuProg - r.prog.valor()) * PASSO_AMOSTRA;
      // jogador na frente e rival muito atrás: o rival acelera mais para voltar à disputa
      const reforco = this.posicaoAtual === 1 ? reforcoRival(gap) : 1;
      if (r.ataqueMs > 0) {
        r.ataqueMs -= delta;
        const alvoX = c.x + c.vx * 0.25, alvoY = c.y + c.vy * 0.25;
        andarCarro(r.carro, apontar(r.carro, alvoX, alvoY), sup, dt, teto * r.habilidade * 1.2);
      } else {
        // não anda sempre reto: sorteia um desvio de até ±10 px do centro da faixa e vai até ele aos poucos
        r.trocaMs -= delta;
        if (r.trocaMs <= 0) {
          r.alvoDesvio = (Math.random() * 2 - 1) * this.desvioMax;
          r.trocaMs = 900 + Math.random() * 1600;
        }
        r.desvioAtual += (r.alvoDesvio - r.desvioAtual) * Math.min(1, dt * 1.6);
        // colado atrás do jogador: segue a faixa dele (é assim que dá para fazer break check)
        const ref = this.pista.amostras[r.indice]!;
        const latJogador = Phaser.Math.Clamp((c.x - ref.x) * -Math.sin(ref.ang) + (c.y - ref.y) * Math.cos(ref.ang), -32, 32);
        const atras = (meuProg - r.prog.valor()) * PASSO_AMOSTRA;
        const seguir = !this.fim && !ESTA_RODANDO(c) && atras > SEGUIR_MIN_PX && atras < SEGUIR_MAX_PX && Math.abs(latJogador - r.faixaAtual) < SEGUIR_LATERAL_PX;
        if (seguir && !r.seguindo) r.atento = Math.random() < CHANCE_ATENTO;
        r.seguindo = seguir;
        const alvoFaixa = seguir ? latJogador : r.lateral + r.desvioAtual;
        r.faixaAtual += (alvoFaixa - r.faixaAtual) * Math.min(1, dt * 3);
        const desvio = evitar(r.carro, this.rivais.map((o) => o.carro), r.faixaAtual);
        const cmd = controlarIA(r.carro, this.pista.amostras, r.indice, desvio.lateral);
        // rival atento freia quando está chegando rápido demais no jogador
        const fechando = velocidade(r.carro) - velocidade(c);
        const freiaPeloJogador = r.seguindo && r.atento && atras < 70 && fechando > 25;
        andarCarro(r.carro, { giro: cmd.giro, freio: cmd.freio || desvio.freio || freiaPeloJogador }, sup, dt, teto * r.habilidade * reforco);
      }
      r.prog.atualizar(r.indice);
    }

    // itens e obstáculos (poças, bônus, vaca, meteoro)
    const pilotos: Piloto[] = [{ carro: c, jogador: true, indice: this.indice }, ...this.rivais.map((r) => ({ carro: r.carro, jogador: false, indice: r.indice }))];
    if (!this.fim) this.itens?.atualizar(delta, this.tempoCorrida, pilotos, this.camRot);

    // batidas entre todos os carros (rivais com rivais, e rivais com o jogador)
    const carros: Array<{ car: Carro; rival?: Rival }> = [{ car: c }, ...this.rivais.map((r) => ({ car: r.carro, rival: r }))];
    for (let i = 0; i < carros.length; i++) {
      for (let j = i + 1; j < carros.length; j++) {
        const A = carros[i]!, B = carros[j]!;
        const agressor = A.rival && A.rival.ataqueMs > 0 && B.car === c ? A.car : B.rival && B.rival.ataqueMs > 0 && A.car === c ? B.car : undefined;
        const bt = batida(A.car, B.car, RAIO_CARRO, agressor);
        if (bt && (A.car === c || B.car === c)) this.jogadorBateu = bt.atacante === c && !agressor;
        // o jogador freou na frente de um rival e ele bateu por trás e rodou: break check
        if (bt && !agressor && bt.vitima === c && ESTA_RODANDO(bt.atacante) && (k.down.isDown || k.s.isDown)) this.mostrarAviso('BREAK CHECK!');
        if (bt && agressor) (agressor === A.car ? A : B).rival!.ataqueMs = 0;
      }
    }
    for (const x of carros) {
      x.car.x = Phaser.Math.Clamp(x.car.x, 4, this.pista.def.w - 4);
      x.car.y = Phaser.Math.Clamp(x.car.y, 4, this.pista.def.h - 4);
    }

    this.indice = amostraMaisProxima(this.pista.amostras, c.x, c.y, this.indice);
    const fechou = this.voltas.atualizar(this.indice, delta);
    if (this.novaVoltaMs > 0) this.novaVoltaMs -= delta;
    const meu = this.progJogador.atualizar(this.indice);
    const posicao = 1 + this.rivais.filter((r) => r.prog.valor() > meu).length;
    this.posicaoAtual = posicao;
    this.atualizarMinimapa(delta, meu);
    if (!this.fim && this.modo !== 'treino' && this.voltas.voltas >= VOLTAS_TOTAIS) this.terminar(posicao);

    // quando o rodopio acaba, o carro volta a apontar na direção da pista
    if (rodavaJogador && !ESTA_RODANDO(c)) this.indice = this.fimDoRodopio(c, this.indice);
    if (ESTA_RODANDO(c) && !rodavaJogador) {
      this.ultimoGolpe = this.tempoCorrida;
      this.mostrarAviso(this.causa ?? (this.jogadorBateu ? 'VOCÊ BATEU!' : 'BATERAM EM VOCÊ!'));
      this.causa = null;
    }
    for (const r of this.rivais) {
      if (r.rodava && !ESTA_RODANDO(r.carro)) r.indice = this.fimDoRodopio(r.carro, r.indice);
      r.rodava = ESTA_RODANDO(r.carro);
    }
    if (this.avisoMs > 0) {
      this.avisoMs -= delta;
      if (this.avisoMs <= 0) this.aviso.setText('');
    }

    // câmera: com a vista girando, o carro aponta sempre para cima na tela
    let rot = 0;
    if (this.girar) {
      const alvo = -Math.PI / 2 - c.ang;
      const dif = Math.atan2(Math.sin(alvo - this.camRot), Math.cos(alvo - this.camRot)); // menor volta até o alvo
      this.camRot += dif * (1 - Math.exp(-dt / VISTA_SUAVIDADE_S));
      rot = this.camRot;
    }
    this.camRot = rot;

    // posição em pixels inteiros; ordenação pelo ponto de contato com o chão (y do carro)
    const visuais = [{ car: c, spr: this.sprite, nome: CARRO_JOGADOR }, ...this.rivais.map((r) => ({ car: r.carro, spr: r.sprite, nome: r.nome }))];
    visuais.forEach(({ car, spr, nome }, i) => {
      const chave = `hd_${nome}`;
      const arco = (car.arcoMs ?? 0) > 0;
      if (spr.scale !== ESCALA_HD) spr.setScale(ESCALA_HD);
      this.sombras[i]?.setVisible(true);
      const chaveAtual = arco ? 'hd_arco' : chave;
      if (spr.texture.key !== chaveAtual) spr.setTexture(chaveAtual);
      // arco-íris: o carro (versão branca) muda de cor em degradê
      if (arco) spr.setTint(Phaser.Display.Color.HSVToRGB(((this.tempoCorrida / 700) + i * 0.09) % 1, 0.9, 1).color);
      else spr.clearTint();
      // posição sem arredondar (a arte detalhada desliza suave; a de pixels precisava de pixels inteiros)
      spr.setPosition(car.x, car.y);
      spr.setRotation(car.ang);
      spr.setDepth(1 + Math.round(car.y));
      const sombra = this.sombras[i];
      if (sombra) {
        if (sombra.texture.key !== chaveAtual) sombra.setTexture(chaveAtual);
        // sombra para baixo e à direita na tela, também com a câmera girando
        sombra.setPosition(car.x + 2 * Math.cos(rot) + 3 * Math.sin(rot), car.y + 3 * Math.cos(rot) - 2 * Math.sin(rot)).setRotation(car.ang).setDepth(0.5);
      }
      // pisca enquanto está sendo jogado para fora (vai reaparecer na pista)
      const piscaMeteoro = car.reaparecer && ESTA_RODANDO(car);
      const piscaRoleta = i === 0 && this.roletaMs > 0;
      spr.setAlpha((piscaMeteoro || piscaRoleta) && Math.floor(this.tempoCorrida / 90) % 2 ? 0.35 : 1);
      this.mostrarChama(i, car, spr.depth);
    });

    // marcador sempre acima do carro do jogador, com leve sobe e desce (pixels inteiros)
    const subida = 33 + (Math.floor(this.tempoCorrida / 250) % 2);
    this.marcador.setPosition(Math.round(c.x - subida * Math.sin(rot)), Math.round(c.y - subida * Math.cos(rot))).setRotation(-rot);
    const cam = this.cameras.main;
    // zoom: diminui 10% a cada volta, com transição suave de ~1 s
    if (this.voltas.voltas !== this.voltasDoZoom) {
      this.voltasDoZoom = this.voltas.voltas;
      this.zoomDe = this.zoomAtual;
      this.zoomPara = this.zoomBase * ZOOM_POR_VOLTA ** this.voltasDoZoom;
      this.zoomT = 0;
    }
    if (this.zoomT < ZOOM_TRANSICAO_MS) {
      this.zoomT = Math.min(ZOOM_TRANSICAO_MS, this.zoomT + delta);
      const k = this.zoomT / ZOOM_TRANSICAO_MS;
      this.zoomAtual = this.zoomDe + (this.zoomPara - this.zoomDe) * (k * k * (3 - 2 * k)); // começa e termina devagar
      cam.setZoom(this.zoomAtual);
    }
    if (this.girar) {
      // o centro da câmera fica um pouco à frente do carro: ele aparece na parte de baixo da tela, olhando para a pista
      cam.setRotation(rot);
      cam.scrollX = c.x + Math.cos(c.ang) * VISTA_A_FRENTE_PX - this.W / 2;
      cam.scrollY = c.y + Math.sin(c.ang) * VISTA_A_FRENTE_PX - this.H / 2;
    } else {
      cam.setRotation(0);
      // com zoom, o scroll é relativo ao centro da câmera: o centro acompanha o carro sem sair do mundo (pixels inteiros)
      const vw = this.W / this.zoomAtual, vh = this.H / this.zoomAtual;
      cam.scrollX = Math.round(Phaser.Math.Clamp(c.x, vw / 2, this.pista.def.w - vw / 2)) - this.W / 2;
      cam.scrollY = Math.round(Phaser.Math.Clamp(c.y, vh / 2, this.pista.def.h - vh / 2)) - this.H / 2;
    }
    this.atualizarUi();

    // roleta: gira (números trocando na tela, carro piscando) e depois põe o jogador na posição sorteada
    if (this.roletaMs > 0) {
      this.roletaMs -= delta;
      this.avisoMs = 300; // mantém o aviso enquanto gira
      this.aviso.setText(`ROLETA: ${1 + (Math.floor(this.tempoCorrida / 70) * 7) % (this.rivais.length + 1)}º LUGAR...`);
      if (this.roletaMs <= 0) {
        this.roletaMs = 0;
        this.roleta();
      }
    }

    // texto do turbo: avisa que dá para ativar, ou mostra o tempo que falta
    if ((c.turboMs ?? 0) > 0) this.dicaTurbo.setText(`TURBO ${(Math.ceil((c.turboMs ?? 0) / 100) / 10).toFixed(1)}s`);
    else if (this.turboGuardado) this.dicaTurbo.setText(Math.floor(this.tempoCorrida / 350) % 2 ? '' : 'APERTE ESPAÇO: TURBO!');
    else this.dicaTurbo.setText('');

    const v = this.voltas;
    // tamanho das caixas: pela altura da tela, mas sem passar da largura (celular em pé: as 3 caixas de cima cabem)
    const ku = Math.min(this.H / ALTURA_REFERENCIA_UI, this.W / 620);
    caixaPista(this.cxPista, ku, {
      nome: this.pista.def.nome,
      pista: this.modo === 'livre' ? 'CORRIDA LIVRE' : this.modo === 'treino' ? 'TREINO' : `PISTA ${this.etapa + 1}/${PISTAS.length}`,
      volta: this.modo === 'treino' ? String(v.voltas + 1) : `${Math.min(v.voltas + 1, VOLTAS_TOTAIS)}/${VOLTAS_TOTAIS}`,
      posicao: this.modo === 'treino' ? '-' : `${posicao}/${this.rivais.length + 1}`,
    });
    if (fechou) this.novaVoltaMs = 2000;
    caixaTempo(this.cxTempo, ku, { tempo: formatarTempo(v.tempo), melhor: v.melhor === null ? '--' : formatarTempo(v.melhor), novaVolta: this.novaVoltaMs > 0 });
    caixaVelocidade(this.cxVel, ku, { vel: Math.round(velocidade(c)) });
    if (this.cxTeclas) {
      caixaTeclas(this.cxTeclas, ku, [
        ...(this.livre ? [{ tecla: 'N', texto: 'Pista' }, { tecla: 'P', texto: 'Volta pista' }] : []),
        { tecla: 'R', texto: 'Reiniciar' },
        { tecla: 'ESC', texto: 'Menu' },
        { tecla: 'T', texto: this.autoAcelera ? 'Auto: sim' : 'Auto: não' },
        { tecla: '▲', texto: 'Acelerar' },
        { tecla: '▼', texto: 'Frear' },
      ]);
    }
    if (this.toque) {
      const kp = this.H / ALTURA_REFERENCIA_UI;
      for (const pad of this.pads) {
        const ver = pad.tipo !== 'turbo' || this.turboGuardado;
        pad.cx.img.setVisible(ver && !this.fim);
        if (ver) caixaPad(pad.cx, kp, PAD * kp, pad.tipo, this.padsAntes.has(pad.tipo));
      }
      if (this.cxReiniciar) {
        this.cxReiniciar.img.setVisible(!this.fim);
        caixaBotao(this.cxReiniciar, ku, this.confirmaReiniciarMs > 0 ? 'TOQUE DE NOVO' : 'REINICIAR', this.confirmaReiniciarMs > 0);
        const eR = this.ui.find((u) => u.obj === this.cxReiniciar!.img);
        if (eR) eR.dy = 10 + (this.cxVel.img.height + 8) / kp; // logo abaixo da caixa da velocidade
      }
      if (this.cxMenu && this.cxReiniciar) {
        this.cxMenu.img.setVisible(!this.fim);
        caixaBotao(this.cxMenu, ku, this.confirmaMenuMs > 0 ? 'TOQUE DE NOVO' : 'MENU', this.confirmaMenuMs > 0);
        const eM = this.ui.find((u) => u.obj === this.cxMenu!.img);
        if (eM) eM.dy = 10 + (this.cxVel.img.height + 8 + this.cxReiniciar.img.height + 8) / kp; // abaixo do reiniciar
      }
      // celular: os botões ocupam os cantos de baixo; o minimapa sobe para baixo da caixa da pista
      const eMapa = this.ui.find((u) => u.obj === this.imgMapa);
      if (eMapa) {
        eMapa.fx = 0;
        eMapa.fy = 0;
        eMapa.dx = 12;
        eMapa.dy = 10 + (this.cxPista.img.height + 8) / kp;
        eMapa.mult = (0.2 * ALTURA_REFERENCIA_UI) / MAPA_H;
        this.imgMapa.setOrigin(0, 0);
      }
    }
    // celular em pé: as 3 caixas não cabem lado a lado; o tempo desce para baixo da velocidade
    const eTempo = this.ui.find((u) => u.obj === this.cxTempo.img);
    if (eTempo) {
      const empe = this.W < this.H;
      eTempo.fx = empe ? 1 : 0.5;
      eTempo.dx = empe ? -12 : 0;
      eTempo.dy = empe ? 10 + (this.cxVel.img.height + 6) / (this.H / ALTURA_REFERENCIA_UI) : 10;
      this.cxTempo.img.setOrigin(empe ? 1 : 0.5, 0);
    }
  }

  private mostrarAviso(texto: string): void {
    this.avisoMs = 1800;
    this.aviso.setText(texto);
  }

  /** Efeitos dos itens: avisos para o jogador e a roleta. */
  private aoEvento(e: Evento, p: Piloto): void {
    if (!p.jogador) return;
    const textos: Record<Evento, string> = {
      turbo: 'TURBO!',
      arco: 'ARCO-ÍRIS!',
      roleta: '',
      vaca: 'COICE DA VACA!',
      meteoro: 'METEORO!',
      poca: 'DERRAPOU NA POÇA!',
    };
    if (e === 'roleta') {
      // treino: sem rivais não há posição para sortear (antes travava o jogo ao terminar de girar)
      if (!this.rivais.length) {
        this.mostrarAviso('ROLETA: SÓ VOCÊ NA PISTA!');
        return;
      }
      if (this.roletaMs <= 0) this.roletaMs = ROLETA_GIRO_MS;
    }
    else if (e === 'turbo') {
      this.turboGuardado = true;
      this.mostrarAviso('TURBO GUARDADO!');
    } else if (e === 'arco') this.mostrarAviso(textos[e]);
    else this.causa = textos[e];
  }

  /** Roleta: o jogador vai parar em qualquer uma das posições da corrida, ao acaso. */
  private roleta(): void {
    const am = this.pista.amostras;
    const n = am.length;
    if (!this.rivais.length) return; // segurança: sem rivais não há com quem trocar de lugar
    const alvo = 1 + Math.floor(Math.random() * (this.rivais.length + 1));
    const outros = [...this.rivais].sort((a, b) => b.prog.valor() - a.prog.valor());
    // para ficar em alvo-ésimo: logo atrás de quem fica à frente (ou à frente de todos, no 1º lugar)
    const ref = alvo === 1 ? outros[0]! : outros[alvo - 2]!;
    const valor = ref.prog.valor() + (alvo === 1 ? 16 : -16);
    const idx = ((Math.round(valor) % n) + n) % n;
    const a = am[idx]!;
    const c = this.carro;
    const v = velocidade(ref.carro);
    c.x = a.x;
    c.y = a.y;
    c.ang = a.ang;
    c.vx = Math.cos(a.ang) * v;
    c.vy = Math.sin(a.ang) * v;
    c.imuneMs = 1500; // chegou colado em outro carro: não rodopia por isso
    this.indice = idx;
    this.progJogador.definir(valor);
    this.voltas.ajustar(idx, valor < 0);
    this.mostrarAviso(`ROLETA: ${alvo}º LUGAR!`);
    this.avisoMs = ROLETA_RESULTADO_MS;
  }

  /** Acabou o rodopio: se foi o meteoro, o carro reaparece na pista (parado, imune 2 s); senão só volta a apontar para a frente. */
  private fimDoRodopio(car: Carro, indice: number): number {
    const am = this.pista.amostras;
    if (!car.reaparecer) {
      car.ang = am[indice]!.ang;
      return indice;
    }
    const idx = amostraMaisProxima(am, car.x, car.y, indice, 120);
    const a = am[idx]!;
    car.x = a.x;
    car.y = a.y;
    car.ang = a.ang;
    car.vx = 0;
    car.vy = 0;
    car.imuneMs = 2000;
    car.reaparecer = false;
    return idx;
  }

  /** ESPAÇO (ou toque rápido): gasta o turbo guardado, +30% de velocidade por 4 s. */
  private ativarTurbo(): void {
    if (!this.turboGuardado || ESTA_RODANDO(this.carro) || (this.carro.turboMs ?? 0) > 0) return;
    this.turboGuardado = false;
    this.carro.turboMs = TURBO_MS;
    this.mostrarAviso('TURBO!');
  }

  /** Fim da corrida: o carro freia sozinho e mostra o resultado. */
  private terminar(posicao: number): void {
    this.fim = true;
    this.tempoFim = this.tempoCorrida;
    this.turboGuardado = false;
    this.roletaMs = 0;
    this.aviso.setText('');
    const v = this.voltas;
    this.classificado = classificou(posicao);
    this.posicaoFinal = posicao;
    const prox = proximaEtapa(this.etapa, PISTAS.length, posicao);
    let situacao: string;
    let seguir: string;
    if (this.modo === 'livre') situacao = '';
    else if (!this.classificado) situacao = `Fora dos ${LIMITE_CLASSIFICACAO} primeiros: você precisa ficar\nentre os ${LIMITE_CLASSIFICACAO} primeiros para avançar.`;
    else if (prox === null) situacao = `CAMPEONATO COMPLETO! Você passou pelas ${PISTAS.length} pistas.`;
    else situacao = `CLASSIFICADO! Próxima pista: ${PISTAS[this.ordem[prox]!]!.nome} (${prox + 1}/${PISTAS.length})`;
    this.resultado.setText(
      `CORRIDA TERMINADA!\n\n${this.pista.def.nome}\nPosição: ${posicao}º de ${this.rivais.length + 1}\nTempo total: ${formatarTempo(this.tempoCorrida)}\nMelhor volta: ${v.melhor === null ? '--' : formatarTempo(v.melhor)}\n\n${situacao}`,
    );
    if (this.modo === 'livre') seguir = 'CORRER DE NOVO';
    else seguir = !this.classificado ? 'TENTAR DE NOVO' : prox === null ? 'NOVO CAMPEONATO' : 'SEGUIR';
    this.veu.setVisible(true);
    this.resultado.setVisible(true);
    this.menu.mostrarAcoes(seguir, () => this.continuar(), () => this.abrirMenu());
  }

  private get W(): number {
    return this.scale.width;
  }
  private get H(): number {
    return this.scale.height;
  }

  /** Fixa um objeto da interface na tela: sem rolagem e com escala 1/zoom (cancela o zoom do mundo). Posição = (fx, fy) da tela + (dx, dy) px da altura de referência. */
  private fixar<T extends Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth>(
    obj: T,
    fx: number,
    fy: number,
    dx: number,
    dy: number,
    depth = 1000,
    mult = 1,
    fonte?: { px: number; stroke: number },
  ): T {
    obj.setScrollFactor(0).setDepth(depth);
    this.ui.push({ obj, fx, fy, dx, dy, mult, fonte });
    return obj;
  }

  /** Caixa do placar desenhada no tamanho real da tela: só desfaz o zoom (sem ampliar), para a letra ficar nítida. */
  private fixarNativo(cx: CaixaHud, fx: number, fy: number, ox: number, dx: number, dy: number, oy = 0): CaixaHud {
    cx.img.setOrigin(ox, oy).setScrollFactor(0).setDepth(PROFUNDIDADE_PLACAR);
    this.ui.push({ obj: cx.img, fx, fy, dx, dy, mult: 1, nativo: true });
    return cx;
  }

  /** Zoom inteiro conforme a altura da janela (arte nítida) e tamanho da interface proporcional. Roda no início e ao redimensionar. */
  private recalcular(): void {
    // zoom quebrado (não arredonda): o inteiro afastava a câmera em medidas bem diferentes conforme a tela, e o zoom já
    // fica quebrado a partir da 2ª volta (ZOOM_POR_VOLTA); a pista da equipe e os carros detalhados aguentam bem
    const base = Math.max(1, Math.min(this.H / ALTURA_ARTE, this.W / LARGURA_ARTE));
    this.zoomBase = base;
    this.zoomAtual = this.zoomDe = this.zoomPara = base * ZOOM_POR_VOLTA ** this.voltasDoZoom;
    this.zoomT = ZOOM_TRANSICAO_MS;
    this.cameras.main.setZoom(this.zoomAtual);
    const k = this.H / ALTURA_REFERENCIA_UI;
    for (const { obj, fonte } of this.ui) {
      if (fonte && obj instanceof Phaser.GameObjects.Text) {
        obj.setFontSize(Math.max(10, Math.round(fonte.px * k)));
        obj.setStroke('#000', Math.max(2, Math.round(fonte.stroke * k)));
        obj.setLineSpacing(Math.round(8 * k));
      }
    }
    this.atualizarUi();
  }

  private atualizarUi(): void {
    const z = this.zoomAtual;
    const rot = this.camRot;
    const k = this.H / ALTURA_REFERENCIA_UI;
    const cos = Math.cos(-rot), sin = Math.sin(-rot);
    for (const { obj, fx, fy, dx, dy, mult, nativo } of this.ui) {
      // a câmera gira e dá zoom também nos objetos sem rolagem: desfaz os dois para o texto ficar reto e nítido
      if (obj instanceof Phaser.GameObjects.Rectangle) obj.setSize(this.W, this.H);
      const { x: sx, y: sy } = this.naTela(fx, fy, dx, dy);
      const px = (sx - this.W / 2) / z, py = (sy - this.H / 2) / z;
      // textos já têm a fonte escalada por k; imagens escalam aqui
      obj.setScale((nativo ? 1 : obj instanceof Phaser.GameObjects.Image ? mult * k : mult) / z).setRotation(-rot);
      obj.setPosition(this.W / 2 + px * cos - py * sin, this.H / 2 + px * sin + py * cos);
    }
  }

  /** Turbo: chama azul saindo pela traseira do carro `i`. */
  private mostrarChama(i: number, car: Carro, depth: number): void {
    const chama = this.chamas[i]!;
    const ligado = (car.turboMs ?? 0) > 0 && !ESTA_RODANDO(car);
    chama.setVisible(ligado);
    if (ligado) {
      chama
        .setTexture(`chama${Math.floor(this.tempoCorrida / 60) % 2}`)
        .setPosition(Math.round(car.x - Math.cos(car.ang) * 20), Math.round(car.y - Math.sin(car.ang) * 20) - 4)
        .setRotation(car.ang)
        .setDepth(depth + 0.1);
    }
  }

  /** O ponto (x, y) da tela está sobre o pedal? (área um pouco maior que o desenho, para acertar fácil) */
  private alternarAuto(): void {
    this.autoAcelera = !this.autoAcelera;
    this.mostrarAviso(this.autoAcelera ? 'Aceleração automática: LIGADA' : 'Aceleração automática: DESLIGADA (↑ ou W)');
  }

  /**
   * Ponto da tela para um item da interface: fração da tela (fx, fy) + deslocamento (dx, dy) numa tela de 540 de altura,
   * afastado da área da câmera/entalhe do celular (o jogo desenha atrás dela, mas placar e botões não ficam lá).
   */
  private naTela(fx: number, fy: number, dx: number, dy: number): { x: number; y: number } {
    const k = this.H / ALTURA_REFERENCIA_UI;
    const m = areaSegura();
    const x = fx * this.W + dx * k + (fx === 0 ? m.esq : fx === 1 ? -m.dir : 0);
    const y = fy * this.H + dy * k + (fy === 0 ? m.topo : fy === 1 ? -m.base : 0);
    return { x, y };
  }

  /** O toque (x, y) caiu neste botão da interface? (com folga, para acertar fácil; botões ancorados à direita) */
  private noBotao(cx: CaixaHud, x: number, y: number): boolean {
    const img = cx.img;
    const e = this.ui.find((u) => u.obj === img);
    if (!e) return false;
    const t = this.naTela(e.fx, e.fy, e.dx, e.dy);
    const folga = 6 * (this.H / ALTURA_REFERENCIA_UI);
    return x >= t.x - img.width - folga && x <= t.x + folga && y >= t.y - folga && y <= t.y + img.height + folga;
  }

  /** Botões de toque com algum dedo em cima agora (o dedo pode escorregar de um botão para o outro). */
  private padsApertados(): Set<TipoPad> {
    const ap = new Set<TipoPad>();
    const ponteiros = this.input.manager.pointers.filter((p) => p.isDown);
    if (!ponteiros.length) return ap;
    const kp = this.H / ALTURA_REFERENCIA_UI;
    for (const pad of this.pads) {
      if (!pad.cx.img.visible) continue;
      const w = pad.cx.img.width, h = pad.cx.img.height;
      const t = this.naTela(pad.fx, 1, pad.dx, pad.dy);
      const x0 = t.x - pad.ox * w, y0 = t.y - h;
      const folga = 6 * kp; // um pouco maior que o desenho: dedo no canto ainda conta
      if (ponteiros.some((p) => p.x >= x0 - folga && p.x <= x0 + w + folga && p.y >= y0 - folga && p.y <= y0 + h + folga)) ap.add(pad.tipo);
    }
    return ap;
  }

  /** Minimapa: carros (jogador com seta, líder com anel) e itens na pista. */
  private atualizarMinimapa(delta: number, meuProgresso: number): void {
    let lider: Rival | null = null;
    for (const r of this.rivais) if (r.prog.valor() > meuProgresso && (!lider || r.prog.valor() > lider.prog.valor())) lider = r;
    const pontos: PontoMapa[] = this.rivais.map((r) => ({ x: r.carro.x, y: r.carro.y, ang: r.carro.ang, cor: COR_NO_MAPA[r.nome] ?? '#ffffff', lider: r === lider }));
    pontos.push({ x: this.carro.x, y: this.carro.y, ang: this.carro.ang, cor: COR_NO_MAPA[CARRO_JOGADOR]!, jogador: true, lider: lider === null });
    this.minimapa.atualizar(delta, pontos, this.itens?.marcadores() ?? []);
  }

  /** Limites da câmera: só na vista fixa (a vista girando pode mostrar além da borda da pista). */
  private aplicarLimites(): void {
    const cam = this.cameras.main;
    if (this.girar) cam.removeBounds();
    else {
      cam.setBounds(0, 0, this.pista.def.w, this.pista.def.h);
      cam.setRotation(0);
      this.camRot = 0;
    }
    this.atualizarUi();
  }

  /** Depois da corrida: avança se ficou entre os 6 primeiros (ou recomeça o campeonato ao fim), senão repete a pista. */
  private continuar(): void {
    this.menu.fecharAcoes();
    if (this.modo === 'livre') {
      this.carregarPista(this.pistaAtual); // corrida livre: a mesma pista de novo
      return;
    }
    const prox = proximaEtapa(this.etapa, PISTAS.length, this.posicaoFinal);
    if (prox === null) {
      this.ordem = embaralhar(PISTAS.length); // campeonato completo: nova ordem
      this.etapa = 0;
    } else this.etapa = prox;
    this.carregarPista(this.ordem[this.etapa]!);
  }
}
