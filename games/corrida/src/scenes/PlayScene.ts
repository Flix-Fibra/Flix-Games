import Phaser from 'phaser';
import { criarTexturaCarroDeImagem, quadroDoAngulo } from '../carro';
import { andarCarro, amostraMaisProxima, apontar, batida, controlarIA, ESTA_RODANDO, evitar, classificou, embaralhar, fatorTeto, formatarTempo, LIMITE_CLASSIFICACAO, proximaEtapa, TURBO_MS, PASSO_AMOSTRA, Progresso, reforcoRival, velocidade, Voltas, type Carro } from '../logic';
import { Itens, type Evento, type Piloto } from '../itens';
import { criarArteItens } from '../itensArte';
import { chaveArte, criarPista, PISTAS, type PistaPronta } from '../pistas';
import { MAPA_H, Minimapa, type PontoMapa } from '../minimapa';
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
/** Pedal do acelerador na tela de toque: tamanho e posição (canto de baixo, à esquerda; o minimapa fica à direita). */
const PEDAL = 104;
const PEDAL_DX = 78;
const PEDAL_DY = -78;
/** A corrida termina quando o jogador completa esta quantidade de voltas. */
const VOLTAS_TOTAIS = 10;
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
export class PlayScene extends Phaser.Scene {
  private pista!: PistaPronta;
  private carro!: Carro;
  private sprite!: Phaser.GameObjects.Image;
  private sombras: Phaser.GameObjects.Image[] = [];
  private fundo?: Phaser.GameObjects.Image;
  private voltas!: Voltas;
  private indice = 0;
  private keys!: Record<'left' | 'right' | 'a' | 'd' | 'up' | 'w' | 'down' | 's' | 'space' | 'enter' | 'n' | 'p', Phaser.Input.Keyboard.Key>;
  /** Pedal do acelerador na tela (só em aparelho de toque) e o dedo que está nele. */
  private pedal?: Phaser.GameObjects.Image;
  private dedoPedal: number | null = null;
  /** Dedo que vira o carro (arrastar para os lados). */
  private dedoGiro: number | null = null;
  private hud!: Phaser.GameObjects.Text;
  private hud2!: Phaser.GameObjects.Text;
  private pistaAtual = 0;
  /** Arte da pista ainda baixando: o jogo espera (nada anda). */
  private carregando = false;
  private minimapa!: Minimapa;
  /** Desvio máximo dos rivais nesta pista (DESVIO_MAX na proporção do asfalto). */
  private desvioMax = DESVIO_MAX;
  private toqueX0: number | null = null;
  private giroToque = 0;
  private rivais: Rival[] = [];
  private progJogador!: Progresso;
  private tempoCorrida = 0;
  private ultimoGolpe = 0;
  private posicaoAtual = 1;
  private aviso!: Phaser.GameObjects.Text;
  private avisoMs = 0;
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
  private ui: Array<{ obj: Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform; fx: number; fy: number; dx: number; dy: number; mult: number; fonte?: { px: number; stroke: number } }> = [];
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
    kb.on('keydown-M', () => this.modelo.forEach((m) => m.setVisible(!m.visible)));
    kb.on('keydown-R', () => this.carregarPista(this.pistaAtual));

    // Toque: um dedo no pedal (acelera) e outro arrastando para os lados (vira); toque rápido fora do pedal = turbo
    this.input.addPointer(1);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.pedal && this.dedoPedal === null && this.noPedal(p.x, p.y)) {
        this.dedoPedal = p.id;
        this.pedal.setAlpha(1);
        return;
      }
      if (this.dedoGiro === null) {
        this.dedoGiro = p.id;
        this.toqueX0 = p.x;
      }
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown && p.id === this.dedoGiro && this.toqueX0 !== null) this.giroToque = Phaser.Math.Clamp((p.x - this.toqueX0) / 40, -1, 1);
    });
    const soltar = (p: Phaser.Input.Pointer) => {
      if (p.id === this.dedoPedal) {
        this.dedoPedal = null;
        this.pedal?.setAlpha(0.55);
        return;
      }
      if (p.id !== this.dedoGiro) return;
      if (this.fim && this.tempoCorrida - this.tempoFim > 1200) {
        this.dedoGiro = null;
        this.toqueX0 = null;
        this.continuar();
        return;
      }
      // toque rápido, sem arrastar: ativa o turbo guardado
      if (this.toqueX0 !== null && Math.abs(p.x - this.toqueX0) < 10 && p.getDuration() < 300) this.ativarTurbo();
      this.dedoGiro = null;
      this.toqueX0 = null;
      this.giroToque = 0;
    };
    this.input.on('pointerup', soltar);
    this.input.on('pointerupoutside', soltar);
    if (this.sys.game.device.input.touch) {
      if (!this.textures.exists('pedal')) {
        const t = this.textures.createCanvas('pedal', PEDAL, PEDAL)!;
        const g = t.getContext();
        const r = PEDAL / 2;
        g.fillStyle = 'rgba(10,12,18,0.75)';
        g.beginPath(); g.arc(r, r, r - 2, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#ffffff'; g.lineWidth = 3;
        g.beginPath(); g.arc(r, r, r - 4, 0, Math.PI * 2); g.stroke();
        // seta para cima
        g.fillStyle = '#ffffff';
        g.beginPath(); g.moveTo(r, r - 28); g.lineTo(r + 20, r - 4); g.lineTo(r + 8, r - 4); g.lineTo(r + 8, r + 10); g.lineTo(r - 8, r + 10); g.lineTo(r - 8, r - 4); g.lineTo(r - 20, r - 4); g.closePath(); g.fill();
        g.font = 'bold 12px sans-serif'; g.textAlign = 'center';
        g.fillText('ACELERAR', r, r + 30);
        t.refresh();
      }
      this.pedal = this.fixar(this.add.image(0, 0, 'pedal'), 0, 1, PEDAL_DX, PEDAL_DY, 1500).setAlpha(0.55);
    }

    // interface: a câmera do mundo tem zoom; os textos ficam sem zoom (escala 1/zoom compensa), então saem nítidos.
    // Posição = fração da tela + deslocamento em pixels de uma tela de 540 de altura (escalado pela altura real).
    const fonte = { fontFamily: FONT, fontSize: '18px', color: COLORS.text, stroke: '#000', strokeThickness: 4 };
    // minimapa no canto de baixo, à direita: ~24% da altura da tela
    this.minimapa = new Minimapa(this);
    this.fixar(this.add.image(0, 0, this.minimapa.chave).setOrigin(1, 1), 1, 1, -12, -12, 1500, (0.24 * ALTURA_REFERENCIA_UI) / MAPA_H);
    this.hud = this.fixar(this.add.text(0, 0, '', fonte), 0, 0, 12, 8, 1000, 1, { px: 18, stroke: 4 });
    this.hud2 = this.fixar(this.add.text(0, 0, '', { ...fonte, align: 'right' }).setOrigin(1, 0), 1, 0, -12, 8, 1000, 1, { px: 18, stroke: 4 });
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
    this.carregarPista(this.ordem[0]!);
  }

  private carregarPista(i: number): void {
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
    this.sombras = Array.from({ length: RIVAIS.length + 1 }, () => this.add.image(0, 0, `hd_${CARRO_JOGADOR}`).setScale(ESCALA_HD).setTint(0x000000).setAlpha(0.3));
    this.rivais = RIVAIS.map((r, i) => {
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
    const dt = Math.min(delta, 50) / 1000;
    const k = this.keys;
    let giro = (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0);
    if (giro === 0) giro = this.giroToque;
    const freio = this.fim || k.down.isDown || k.s.isDown;
    const acelera = !this.fim && (k.up.isDown || k.w.isDown || this.dedoPedal !== null);
    if (this.fim) giro = 0;
    if (!this.fim && Phaser.Input.Keyboard.JustDown(k.space)) this.ativarTurbo();

    this.tempoCorrida += delta;
    const teto = fatorTeto(this.tempoCorrida, this.voltas.voltas);
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
    const meu = this.progJogador.atualizar(this.indice);
    const posicao = 1 + this.rivais.filter((r) => r.prog.valor() > meu).length;
    this.posicaoAtual = posicao;
    this.atualizarMinimapa(delta, meu);
    if (!this.fim && this.voltas.voltas >= VOLTAS_TOTAIS) this.terminar(posicao);

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
    this.hud.setText(`${this.pista.def.nome}  (pista ${this.etapa + 1}/${PISTAS.length})
Volta ${Math.min(v.voltas + 1, VOLTAS_TOTAIS)}/${VOLTAS_TOTAIS}   ${formatarTempo(v.tempo)}
Posição ${posicao}/${this.rivais.length + 1}`);
    this.hud2.setText(`${Math.round(velocidade(c))} px/s
Melhor ${v.melhor === null ? '--' : formatarTempo(v.melhor)}${fechou ? '  NOVA VOLTA' : ''}
${this.livre ? '[N] [P] pista  ' : ''}[R] reiniciar  ↑ acelera  ↓ freia`);
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
    if (!this.classificado) situacao = `Fora dos ${LIMITE_CLASSIFICACAO} primeiros: você precisa ficar\nentre os ${LIMITE_CLASSIFICACAO} primeiros para avançar.\n\nENTER ou toque: tentar esta pista de novo`;
    else if (prox === null) situacao = `CAMPEONATO COMPLETO! Você passou pelas ${PISTAS.length} pistas.\n\nENTER ou toque: novo campeonato (nova ordem)`;
    else situacao = `CLASSIFICADO! Próxima pista: ${PISTAS[this.ordem[prox]!]!.nome} (${prox + 1}/${PISTAS.length})\n\nENTER ou toque: seguir`;
    this.resultado.setText(
      `CORRIDA TERMINADA!\n\n${this.pista.def.nome}\nPosição: ${posicao}º de ${this.rivais.length + 1}\nTempo total: ${formatarTempo(this.tempoCorrida)}\nMelhor volta: ${v.melhor === null ? '--' : formatarTempo(v.melhor)}\n\n${situacao}`,
    );
    this.veu.setVisible(true);
    this.resultado.setVisible(true);
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
    for (const { obj, fx, fy, dx, dy, mult } of this.ui) {
      // a câmera gira e dá zoom também nos objetos sem rolagem: desfaz os dois para o texto ficar reto e nítido
      if (obj instanceof Phaser.GameObjects.Rectangle) obj.setSize(this.W, this.H);
      const sx = fx * this.W + dx * k, sy = fy * this.H + dy * k;
      const px = (sx - this.W / 2) / z, py = (sy - this.H / 2) / z;
      // textos já têm a fonte escalada por k; imagens escalam aqui
      obj.setScale((obj instanceof Phaser.GameObjects.Image ? mult * k : mult) / z).setRotation(-rot);
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
  private noPedal(x: number, y: number): boolean {
    const k = this.H / ALTURA_REFERENCIA_UI;
    return Math.hypot(x - PEDAL_DX * k, y - (this.H + PEDAL_DY * k)) < PEDAL * 0.6 * k;
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
    const prox = proximaEtapa(this.etapa, PISTAS.length, this.posicaoFinal);
    if (prox === null) {
      this.ordem = embaralhar(PISTAS.length); // campeonato completo: nova ordem
      this.etapa = 0;
    } else this.etapa = prox;
    this.carregarPista(this.ordem[this.etapa]!);
  }
}
