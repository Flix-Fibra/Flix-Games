import Phaser from 'phaser';
import { criarTexturaCarro, quadroDoAngulo } from '../carro';
import { andarCarro, amostraMaisProxima, apontar, batida, controlarIA, ESTA_RODANDO, evitar, fatorTeto, formatarTempo, PASSO_AMOSTRA, Progresso, reforcoRival, velocidade, Voltas, type Carro } from '../logic';
import { criarPista, PISTAS, type PistaPronta } from '../pistas';
import { CAR_COLORS, COLORS, FONT, GAME_H, GAME_W } from '../theme';

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
}

/** Cores dos adversários (o jogador é o vermelho Flix). A habilidade cai da frente para o fundo do grid. */
const RIVAIS = (['azul', 'amarelo', 'verde', 'laranja', 'roxo', 'ciano', 'rosa', 'branco', 'cinza', 'marrom'] as const).map((nome, i) => ({
  nome,
  chave: `carro_${nome}`,
  cor: CAR_COLORS[nome],
  habilidade: 0.985 - 0.009 * i,
}));
/** Posição do jogador no grid de largada (6º de 11). */
const SLOT_JOGADOR = 5;
const FILA_PASSOS = 12; // amostras (x4 px) entre uma fileira e a seguinte
const RAIO_CARRO = 8; // dois círculos por carro (cápsula), ver logic.ts
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
  private fundo?: Phaser.GameObjects.Image;
  private voltas!: Voltas;
  private indice = 0;
  private keys!: Record<'left' | 'right' | 'a' | 'd' | 'down' | 's' | 'space', Phaser.Input.Keyboard.Key>;
  private hud!: Phaser.GameObjects.Text;
  private hud2!: Phaser.GameObjects.Text;
  private pistaAtual = 0;
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
  /** Conferência do modelo (tecla M): o carro em 8 ângulos, ampliado. */
  private modelo: Phaser.GameObjects.Image[] = [];

  constructor() {
    super('Play');
  }

  create(): void {
    criarTexturaCarro(this, 'carro', CAR_COLORS.flix);
    for (const r of RIVAIS) criarTexturaCarro(this, r.chave, r.cor);
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys({
      left: 'LEFT', right: 'RIGHT', a: 'A', d: 'D', down: 'DOWN', s: 'S', space: 'SPACE',
    }) as typeof this.keys;
    kb.on('keydown-ONE', () => this.carregarPista(0));
    kb.on('keydown-TWO', () => this.carregarPista(1));
    kb.on('keydown-M', () => this.modelo.forEach((m) => m.setVisible(!m.visible)));
    kb.on('keydown-R', () => this.carregarPista(this.pistaAtual));

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => (this.toqueX0 = p.x));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown && this.toqueX0 !== null) this.giroToque = Phaser.Math.Clamp((p.x - this.toqueX0) / 40, -1, 1);
    });
    this.input.on('pointerup', () => {
      this.toqueX0 = null;
      this.giroToque = 0;
    });

    const fonte = { fontFamily: FONT, fontSize: '10px', color: COLORS.text, stroke: '#000', strokeThickness: 3 };
    this.hud = this.add.text(6, 4, '', fonte).setScrollFactor(0).setDepth(1000);
    this.hud2 = this.add.text(GAME_W - 6, 4, '', { ...fonte, align: 'right' }).setOrigin(1, 0).setScrollFactor(0).setDepth(1000);

    this.aviso = this.add
      .text(GAME_W / 2, 52, '', { ...fonte, fontSize: '14px', color: '#FFD23F' })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1000);
    for (let i = 0; i < 8; i++) {
      this.modelo.push(this.add.image(44 + i * 56, GAME_H - 44, 'carro', i * 9).setScale(1.2).setScrollFactor(0).setDepth(2000).setVisible(false));
    }
    const inicial = Number(new URLSearchParams(window.location.search).get('pista') ?? 1) - 1;
    this.carregarPista(Phaser.Math.Clamp(inicial, 0, PISTAS.length - 1));
  }

  private carregarPista(i: number): void {
    this.pistaAtual = i;
    const def = PISTAS[i]!;
    this.pista = criarPista(this, def, 'pista');
    this.fundo?.destroy();
    this.fundo = this.add.image(0, 0, 'pista').setOrigin(0, 0).setDepth(0);
    const am = this.pista.amostras;
    const n = am.length;
    // grade de largada: 2 fileiras atrás da linha; o jogador sai na fileira da frente, à direita
    const posicao = (passos: number, lateral: number): Carro => {
      const a = am[(n - passos) % n]!;
      return { x: a.x - Math.sin(a.ang) * lateral, y: a.y + Math.cos(a.ang) * lateral, ang: a.ang, vx: 0, vy: 0 };
    };
    // grade de largada: 2 carros por fileira; o jogador sai em 6º
    const slot = (k: number) => ({ passos: 10 + FILA_PASSOS * Math.floor(k / 2) + (k % 2 === 0 ? 0 : 4), lateral: k % 2 === 0 ? -14 : 14 });
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
    this.sprite = this.add.image(0, 0, 'carro', 0);
    this.rivais.forEach((r) => r.sprite.destroy());
    this.rivais = RIVAIS.map((r, i) => {
      const k = i < SLOT_JOGADOR ? i : i + 1; // pula o slot do jogador
      const { passos, lateral } = slot(k);
      return {
        nome: r.nome,
        carro: posicao(passos, lateral),
        sprite: this.add.image(0, 0, r.chave, 0),
        indice: n - passos,
        lateral,
        habilidade: r.habilidade,
        prog: new Progresso(n, n - passos),
        ataqueMs: 0,
        rodava: false,
      };
    });
    this.cameras.main.setBounds(0, 0, def.w, def.h);
  }

  update(_t: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000;
    const k = this.keys;
    let giro = (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0);
    if (giro === 0) giro = this.giroToque;
    const freio = k.down.isDown || k.s.isDown || k.space.isDown;

    this.tempoCorrida += delta;
    const teto = fatorTeto(this.tempoCorrida);
    const c = this.carro;
    const meuProg = this.progJogador.valor();
    const rodavaJogador = ESTA_RODANDO(c);

    // golpe aleatório no jogador: no mínimo 15 s depois da última vez que ele foi atingido
    if (
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

    andarCarro(c, { giro, freio }, this.pista.superficie(c.x, c.y), dt, teto);

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
        const desvio = evitar(r.carro, this.rivais.map((o) => o.carro), r.lateral);
        const cmd = controlarIA(r.carro, this.pista.amostras, r.indice, desvio.lateral);
        andarCarro(r.carro, { giro: cmd.giro, freio: cmd.freio || desvio.freio }, sup, dt, teto * r.habilidade * reforco);
      }
      r.prog.atualizar(r.indice);
    }

    // batidas entre todos os carros (rivais com rivais, e rivais com o jogador)
    const carros: Array<{ car: Carro; rival?: Rival }> = [{ car: c }, ...this.rivais.map((r) => ({ car: r.carro, rival: r }))];
    for (let i = 0; i < carros.length; i++) {
      for (let j = i + 1; j < carros.length; j++) {
        const A = carros[i]!, B = carros[j]!;
        const agressor = A.rival && A.rival.ataqueMs > 0 && B.car === c ? A.car : B.rival && B.rival.ataqueMs > 0 && A.car === c ? B.car : undefined;
        const bt = batida(A.car, B.car, RAIO_CARRO, agressor);
        if (bt && (A.car === c || B.car === c)) this.jogadorBateu = bt.atacante === c && !agressor;
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

    // quando o rodopio acaba, o carro volta a apontar na direção da pista
    if (rodavaJogador && !ESTA_RODANDO(c)) c.ang = this.pista.amostras[this.indice]!.ang;
    if (ESTA_RODANDO(c) && !rodavaJogador) {
      this.ultimoGolpe = this.tempoCorrida;
      this.avisoMs = 1800;
      this.aviso.setText(this.jogadorBateu ? 'VOCÊ BATEU!' : 'BATERAM EM VOCÊ!');
    }
    for (const r of this.rivais) {
      if (r.rodava && !ESTA_RODANDO(r.carro)) r.carro.ang = this.pista.amostras[r.indice]!.ang;
      r.rodava = ESTA_RODANDO(r.carro);
    }
    if (this.avisoMs > 0) {
      this.avisoMs -= delta;
      if (this.avisoMs <= 0) this.aviso.setText('');
    }

    // posição em pixels inteiros; ordenação pelo ponto de contato com o chão (y do carro)
    for (const [car, spr] of [[c, this.sprite] as const, ...this.rivais.map((r) => [r.carro, r.sprite] as const)]) {
      spr.setPosition(Math.round(car.x), Math.round(car.y));
      spr.setFrame(quadroDoAngulo(car.ang));
      spr.setDepth(1 + Math.round(car.y));
    }

    const cam = this.cameras.main;
    cam.scrollX = Math.round(Phaser.Math.Clamp(c.x - GAME_W / 2, 0, this.pista.def.w - GAME_W));
    cam.scrollY = Math.round(Phaser.Math.Clamp(c.y - GAME_H / 2, 0, this.pista.def.h - GAME_H));

    const v = this.voltas;
    this.hud.setText(`${this.pista.def.nome}
Volta ${v.voltas + 1}   ${formatarTempo(v.tempo)}
Posição ${posicao}/${this.rivais.length + 1}`);
    this.hud2.setText(`${Math.round(velocidade(c))} px/s
Melhor ${v.melhor === null ? '--' : formatarTempo(v.melhor)}${fechou ? '  NOVA VOLTA' : ''}
[1] [2] pista  [R] reiniciar`);
  }
}
