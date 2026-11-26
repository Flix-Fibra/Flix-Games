import Phaser from 'phaser';
import { hudText, telaFimDeJogo } from '@flix/game-kit/src/phaserHud';
import type { HubBridge } from '@flix/game-sdk';
import { AVISO_RELOGIO, DT, RELOGIO, T, faseRelogio, ganchoAoAlcance, marcas, solido, ventos, vertical } from '../logic';
import { BOBINA, CHEFE_HP, NUCLEO, MURO, GOLPE_ATIVO, GOLPE_PREPARO, Partida, type Chefe, type Evento, type Inimigo, type TipoItem } from '../sim';
import { ALTURA_TELA, LARGURA_TELA, ajustarCamera } from '../tela';
import { Toque, type Botao } from '../toque';
import { som } from '../som';

const AVISO_ITEM: Record<TipoItem, string> = {
  lampada: 'ENERGIA',
  cura: 'KIT DE REPARO',
  pulso: 'PULSO EMP! USE O BOTÃO DE PULSO',
  nucleo: 'NÚCLEO DE VIDA',
  gancho: 'CABO-GANCHO! NO AR, APERTE PULO DE NOVO E SEGURE',
  repique: 'REPIQUE! APERTE PULO DE NOVO NO AR',
  fragmento: 'ENERGIA CHEIA',
};

const NOME_FASE: Record<string, string> = { F1: 'FASE 1 · GALPÃO DE BASE', F2: 'FASE 2 · DUTOS SUBTERRÂNEOS', F3: 'FASE 3 · SALA DOS SERVIDORES' };
const FOLHA_INIMIGO: Record<Inimigo['tipo'], string> = { faisca: 'faisca-anda', drone: 'drone-voa', rato: 'rato-corre', bobina: 'bobina-parada', pacote: 'pacote-anda',
  pacotinho: 'pacote-anda', cooler: 'cooler' };
const FIM_CHEFE: Record<string, string> = {
  'F1-5': 'GERADOR RELIGADO! SIGA PELA PORTA',
  'F2-6': 'FIBRA RECONECTADA! SIGA PELA PORTA',
};

type Sprite = Phaser.GameObjects.Sprite;

export class PlayScene extends Phaser.Scene {
  private jogo!: Partida;
  private toque!: Toque;
  private teclas!: Record<string, Phaser.Input.Keyboard.Key>;
  private cenario!: Phaser.GameObjects.Container;
  private heroina!: Sprite;
  private inimigos = new Map<number, Sprite>();
  private chefe: Sprite | null = null;
  private muroDeCima: Sprite | null = null;
  private itens = new Map<string, Phaser.GameObjects.Image>();
  private portas: Phaser.GameObjects.Image[] = [];
  private saves: Phaser.GameObjects.Image[] = [];
  private ganchos: Phaser.GameObjects.Image[] = [];
  private relogios: { img: Phaser.GameObjects.Image; fase: 0 | 1 }[] = [];
  private nucleo: Phaser.GameObjects.Image | null = null;
  private bolas: Phaser.GameObjects.Image[] = [];
  private repique = 0;
  private arcos = new Map<number, Phaser.GameObjects.Image>();
  private efeitos!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Graphics;
  private nomeSala!: Phaser.GameObjects.BitmapText;
  private aviso!: Phaser.GameObjects.BitmapText;
  private pausaTexto!: Phaser.GameObjects.BitmapText;
  private avisoAte = 0;
  private acumulado = 0;
  private antes = new Set<Botao>();
  private pendentes = new Set<Botao>();
  private subindo = false;
  private pausado = false;
  private ox = 0;
  private oy = 0;
  private runId = '';

  constructor() {
    super('Play');
  }

  create(): void {
    ajustarCamera(this);
    this.inimigos = new Map();
    this.itens = new Map();
    this.chefe = null;
    this.acumulado = 0;
    this.pausado = false;
    this.antes = new Set();
    this.pendentes = new Set();
    this.jogo = this.novaPartida();
    this.arcos = new Map();
    this.bolas = [];
    this.nucleo = null;
    this.repique = 0;
    this.cenario = this.add.container(0, 0);
    this.heroina = this.add.sprite(0, 0, 'iara-parada').setOrigin(0.5, 1).setScale(0.5).setDepth(20);
    this.efeitos = this.add.graphics().setDepth(30);
    this.hud = this.add.graphics().setDepth(80);
    this.nomeSala = hudText(this, LARGURA_TELA - 4, 3, '', 0.5).setOrigin(1, 0).setDepth(81).setTint(0xf6e7c1);
    this.aviso = hudText(this, LARGURA_TELA / 2, 50, '', 1).setOrigin(0.5, 0).setDepth(81).setTint(0x9ff4ff);
    this.pausaTexto = hudText(this, LARGURA_TELA / 2, 120, 'PAUSA', 2).setOrigin(0.5).setDepth(95).setVisible(false);
    this.toque = new Toque(this, this.registry.get('toque') as boolean);
    this.toque.mostrarPulso(this.jogo.temPulso);

    const teclado = this.input.keyboard!;
    this.teclas = teclado.addKeys('LEFT,RIGHT,UP,DOWN,A,D,W,S,SPACE,Z,K,X,J,C,L') as Record<string, Phaser.Input.Keyboard.Key>;
    const pausar = () => {
      this.pausado = !this.pausado;
      this.pausaTexto.setVisible(this.pausado);
    };
    teclado.on('keydown-P', pausar);
    teclado.on('keydown-ESC', pausar);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      teclado.off('keydown-P', pausar);
      teclado.off('keydown-ESC', pausar);
    });

    const bridge = this.registry.get('bridge') as HubBridge;
    this.runId = bridge.newRunId();
    bridge.sendStarted(this.runId);
    this.montarSala();
    this.mostrarAviso('RELIGUE O GERADOR DA TORRE', 3000);
  }

  /** Com ?debug&sala=F2-1 na URL dá para começar de qualquer sala, já com as habilidades dela. */
  private novaPartida(): Partida {
    const q = new URLSearchParams(window.location.search);
    const inicio = q.has('debug') ? q.get('sala') : null;
    if (!inicio) return new Partida();
    const j = new Partida(inicio);
    j.temPulso = inicio >= 'F1-5';
    j.energia = j.temPulso ? 5 : 0;
    j.temGancho = inicio >= 'F2-3';
    j.temRepique = inicio > 'F3-6';
    return j;
  }

  // ---------- cenário ----------

  private montarSala(): void {
    const s = this.jogo.base;
    this.cenario.removeAll(true);
    this.nucleo?.destroy();
    this.nucleo = null;
    for (const b of this.bolas) b.destroy();
    this.bolas = [];
    for (const sp of this.inimigos.values()) sp.destroy();
    this.inimigos.clear();
    for (const a of this.arcos.values()) a.destroy();
    this.arcos.clear();
    this.itens.clear();
    this.chefe?.destroy();
    this.chefe = null;
    this.muroDeCima?.destroy();
    this.muroDeCima = null;
    this.ox = (LARGURA_TELA - s.width * T) / 2;
    // sala baixa fica no alto, sobrando espaço embaixo para os botões; sala alta é centralizada
    this.oy = Math.min(22, Math.floor((ALTURA_TELA - s.height * T) / 2) + 5);
    const { ox, oy, cenario } = this;
    const add = <O extends Phaser.GameObjects.GameObject>(o: O): O => {
      cenario.add(o);
      return o;
    };

    // cada fase tem os seus blocos e o seu fundo
    const f = s.id[1] === '1' ? '' : s.id[1]!;
    const fundo = add(this.add.tileSprite(0, 0, LARGURA_TELA, ALTURA_TELA, `fundo${f}`).setOrigin(0));
    fundo.setTileScale(0.5);
    fundo.tilePositionX = (Number(s.id.slice(-1)) || 0) * 330;

    // parede (também acima e abaixo da sala, mais escura)
    for (let lin = -2; lin <= Math.ceil(ALTURA_TELA / T); lin++) {
      const fora = lin < 0 || lin >= s.height;
      for (let col = 0; col < s.width; col++) {
        const base = Math.max(0, Math.min(s.height - 1, lin));
        if (!solido(s, col, base)) continue;
        const x = ox + col * T;
        const y = oy + lin * T;
        const quadro = (((lin % 4) + 4) % 4) * 4 + (col % 4);
        if (!fora && s.tiles[lin]![col] === 'X') {
          add(this.add.image(x, y, 'rachada').setOrigin(0).setDisplaySize(T, T));
          continue;
        }
        const bloco = add(this.add.image(x, y, `parede${f}`, quadro).setOrigin(0).setScale(0.5));
        if (fora) {
          bloco.setTint(0x6d7a90);
          continue;
        }
        if (lin > 0 && !solido(s, col, lin - 1)) add(this.add.image(x, y, `borda${f}`, col % 4).setOrigin(0).setScale(0.5));
        if (col > 0 && !solido(s, col - 1, lin)) add(this.add.rectangle(x, y, 1, T, 0x6f8fae, 0.8).setOrigin(0));
        if (col < s.width - 1 && !solido(s, col + 1, lin)) add(this.add.rectangle(x + T - 1, y, 1, T, 0x6f8fae, 0.8).setOrigin(0));
        if (lin < s.height - 1 && !solido(s, col, lin + 1)) add(this.add.rectangle(x, y + T - 1, T, 1, 0x6f8fae, 0.8).setOrigin(0));
      }
    }

    for (const m of marcas(s, 'H')) {
      add(this.add.image(ox + m.col * T, oy + m.lin * T, `escada${f}`, m.lin % 2).setOrigin(0).setScale(0.5));
    }
    // plataformas e fios em trechos contínuos
    s.tiles.forEach((linha, lin) => {
      for (const t of linha.matchAll(/=+|\^+/g)) {
        const x = ox + t.index * T;
        const largura = t[0].length * T;
        if (t[0][0] === '=') add(this.add.tileSprite(x, oy + lin * T, largura, 9, `plataforma${f}`).setOrigin(0).setTileScale(0.5));
        else add(this.add.tileSprite(x, oy + (lin + 1) * T, largura, f ? 15 : 12, `fio${f}`).setOrigin(0, 1).setTileScale(0.5));
      }
    });

    this.portas = this.jogo.portas.filter((p) => !vertical(s, p.lin)).map((p) =>
      add(this.add.image(ox + (p.col === 0 ? 0 : s.width * T), oy + (p.lin + 1) * T, 'porta-fechada')
        .setOrigin(p.col === 0 ? 0 : 1, 1).setScale(0.5)));
    // a parede rachada fica na frente da porta do segredo
    for (const m of marcas(s, 'X')) add(this.add.image(ox + m.col * T, oy + m.lin * T, 'rachada').setOrigin(0).setDisplaySize(T, T));
    this.relogios = [];
    s.tiles.forEach((linha, lin) => {
      for (const t of linha.matchAll(/O+|o+/g)) {
        const fase = t[0][0] === 'O' ? 0 : 1;
        const img = add(this.add.image(ox + t.index * T, oy + lin * T, `relogio-${fase ? 'b' : 'a'}`).setOrigin(0)
          .setDisplaySize(t[0].length * T, 11));
        this.relogios.push({ img, fase });
      }
    });
    for (const m of marcas(s, 'A')) {
      add(this.add.image(ox + (m.col + 0.5) * T, oy + (m.lin === 0 ? m.lin + 1 : m.lin) * T, 'alcapao').setOrigin(0.5, m.lin === 0 ? 1 : 0).setScale(0.5));
    }
    for (const m of marcas(s, 'L')) {
      add(this.add.image(ox + (m.col + 0.5) * T, oy + (m.lin + 1) * T, this.jogo.atalhos.has(s.id.slice(0, 2)) ? 'alavanca-on' : 'alavanca-off').setOrigin(0.5, 1).setScale(0.5));
    }
    this.ganchos = marcas(s, 'G').map((m) => add(this.add.image(ox + (m.col + 0.5) * T, oy + (m.lin + 0.5) * T, 'gancho').setScale(0.5)));
    if (this.jogo.chefe?.tipo === 'firewall') {
      this.nucleo = this.add.image(ox + NUCLEO.x, oy + NUCLEO.y, 'nucleo').setOrigin(0.5, 1).setScale(0.5).setDepth(16);
    }
    this.saves = marcas(s, 'S').map((m) =>
      add(this.add.image(ox + (m.col + 0.5) * T, oy + (m.lin + 1) * T, 'save-off').setOrigin(0.5, 1).setScale(0.5)));
    for (const it of this.jogo.itens) {
      const img = add(this.add.image(ox + it.x, oy + it.y - 2, `item-${it.tipo}`).setOrigin(0.5, 1).setScale(0.5));
      this.tweens.add({ targets: img, y: img.y - 3, duration: 650, yoyo: true, repeat: -1 });
      this.itens.set(it.chave, img);
    }
    this.nomeSala.setText(s.name.toUpperCase());
    this.cameras.main.fadeIn(160, 4, 8, 18);
  }

  // ---------- laço ----------

  update(_t: number, delta: number): void {
    const dedos = this.toque.apertados();
    const t = this.teclas;
    const tecla = (...ks: string[]) => ks.some((k) => t[k]!.isDown);
    const nova = (...ks: string[]) => ks.map((k) => Phaser.Input.Keyboard.JustDown(t[k]!)).some(Boolean);
    // apertos novos ficam guardados até o próximo passo do jogo (telas de 120 Hz têm quadros sem passo)
    for (const b of dedos) if (!this.antes.has(b)) this.pendentes.add(b);
    if (nova('SPACE', 'Z', 'K')) this.pendentes.add('pulo');
    if (nova('X', 'J')) this.pendentes.add('golpe');
    if (nova('C', 'L')) this.pendentes.add('pulso');
    this.antes = dedos;
    if (this.pausado) {
      this.pendentes.clear();
      return;
    }
    if (this.jogo.fim) return;

    this.acumulado = Math.min(this.acumulado + delta / 1000, 0.1);
    while (this.acumulado >= DT && !this.jogo.fim) {
      this.acumulado -= DT;
      const cima = dedos.has('cima') || tecla('UP', 'W');
      const baixo = dedos.has('baixo') || tecla('DOWN', 'S');
      this.subindo = cima || baixo;
      const eventos = this.jogo.passo({
        esq: dedos.has('esq') || tecla('LEFT', 'A'),
        dir: dedos.has('dir') || tecla('RIGHT', 'D'),
        cima,
        baixo,
        pulo: dedos.has('pulo') || tecla('SPACE', 'Z', 'K') || this.pendentes.has('pulo'),
        puloApertado: this.pendentes.has('pulo'),
        golpeApertado: this.pendentes.has('golpe'),
        pulsoApertado: this.pendentes.has('pulso'),
      });
      this.pendentes.clear();
      for (const e of eventos) this.reagir(e);
    }
    this.desenhar();
  }

  private efeito(nome: string, x: number, y: number, escala = 0.5): void {
    const s = this.add.sprite(this.ox + x, this.oy + y, nome).setScale(escala).setDepth(31).setBlendMode(Phaser.BlendModes.ADD);
    s.play(nome).once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.destroy());
  }

  private mostrarAviso(texto: string, ms = 1800): void {
    this.aviso.setText(texto).setVisible(true);
    this.avisoAte = this.time.now + ms;
  }

  private reagir(e: Evento): void {
    som.tocar(e.tipo);
    if (e.tipo === 'sala') this.montarSala();
    else if (e.tipo === 'pouso') this.efeito('fx-poeira', e.x, e.y - 5);
    else if (e.tipo === 'acerto') this.efeito('fx-impacto', e.x, e.y);
    else if (e.tipo === 'bloqueado') this.efeito('fx-brilho', e.x, e.y, 0.35);
    else if (e.tipo === 'inimigo-morto' && e.alvo) {
      this.inimigos.get(e.alvo.id)?.destroy();
      this.inimigos.delete(e.alvo.id);
      this.arcos.get(e.alvo.id)?.destroy();
      this.arcos.delete(e.alvo.id);
      const voa = e.alvo.tipo === 'drone';
      const tipo = e.alvo.tipo === 'pacotinho' ? 'pacote' : e.alvo.tipo;
      const nome = `${tipo}-morre`;
      const s = this.add.sprite(this.ox + e.x, this.oy + e.y + (voa ? 10 : 0), nome).setOrigin(0.5, 1).setScale(0.5).setDepth(19);
      s.play(nome).once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.destroy());
      this.efeito('fx-estouro', e.x, e.y - 6);
    } else if (e.tipo === 'item') {
      this.efeito('fx-brilho', e.x, e.y - 8);
      for (const [chave, img] of this.itens) {
        if (!this.jogo.itens.some((i) => i.chave === chave)) {
          img.destroy();
          this.itens.delete(chave);
        }
      }
      this.mostrarAviso(AVISO_ITEM[e.item], e.item === 'pulso' || e.item === 'repique' ? 4500 : 1400);
      if (e.item === 'pulso') this.toque.mostrarPulso(true);
    } else if (e.tipo === 'salva') {
      this.efeito('fx-pulso', e.x, e.y - 12, 0.7);
      this.mostrarAviso('PONTO SALVO', 1400);
    } else if (e.tipo === 'chefe-pouso') {
      this.cameras.main.shake(180, 0.006);
      this.efeito('fx-poeira', e.x, e.y - 6, 0.9);
    } else if (e.tipo === 'chefe-morto') {
      this.cameras.main.shake(500, 0.01);
      for (let i = 0; i < 5; i++) {
        this.time.delayedCall(i * 140, () => this.efeito('fx-estouro', e.x - 20 + i * 10, e.y - 10 - ((i * 17) % 30), 0.8));
      }
      // o Firewall solta o Repique logo em seguida, com o próprio aviso
      this.mostrarAviso(FIM_CHEFE[this.jogo.sala.id] ?? '', 4000);
    } else if (e.tipo === 'alavanca') {
      this.montarSala();
      this.mostrarAviso('ATALHO ABERTO', 2000);
    } else if (e.tipo === 'fase') this.mostrarAviso(NOME_FASE[this.jogo.sala.id.slice(0, 2)] ?? '', 3500);
    else if (e.tipo === 'fim') this.terminar();
  }

  private terminar(): void {
    const j = this.jogo;
    const segundos = Math.round(j.passos / 60);
    const bridge = this.registry.get('bridge') as HubBridge;
    bridge.sendGameOver({ runId: this.runId, score: j.pontos, durationMs: segundos * 1000, meta: { fase: 3, quedas: j.mortes } });
    telaFimDeJogo(this, {
      largura: LARGURA_TELA,
      altura: ALTURA_TELA,
      titulo: 'FASE 3 CONCLUÍDA',
      pontos: j.pontos,
      linhas: [{ texto: `TEMPO ${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')} · QUEDAS ${j.mortes}` }],
      botao: 'JOGAR DE NOVO',
      px: { titulo: 1.5, pontos: 2.5, texto: 1, botao: 1 },
      depth: 100,
      onReiniciar: () => this.scene.restart(),
    });
  }

  // ---------- desenho ----------

  private desenhar(): void {
    const j = this.jogo;
    const c = j.corpo;
    const { ox, oy } = this;
    const h = this.heroina;
    h.setPosition(Math.round((ox + c.x) * 2) / 2, Math.round((oy + c.y) * 2) / 2).setFlipX(c.lado < 0 && !c.naEscada);
    const quadro = (folha: string, n: number) => {
      h.anims.stop();
      h.setTexture(folha, n);
    };
    if (j.morta > 0) {
      if (h.anims.currentAnim?.key !== 'morte' || h.texture.key !== 'iara-dano') h.play('morte');
    } else if (j.recuo > 0) quadro('iara-dano', 0);
    else if (j.golpe >= 0) {
      const ativo = j.golpe >= GOLPE_PREPARO && j.golpe < GOLPE_PREPARO + GOLPE_ATIVO;
      if (c.noChao) {
        const f = j.golpe < GOLPE_PREPARO ? (j.golpe < 3 ? 0 : 1) : ativo ? 2 : j.golpe < 20 ? 3 : 4;
        quadro('iara-golpe', f);
      } else quadro('iara-golpe-ar', j.golpe < GOLPE_PREPARO ? 0 : ativo ? 1 : 2);
    } else if (j.lancando > 0) quadro('iara-pulso', j.lancando > 12 ? 1 : 2);
    else if (c.cabo) quadro('iara-gancho', c.cabo.ang * c.lado < 0 ? 0 : 1);
    else if (!c.noChao && c.repicou && c.vy < -60) quadro('iara-repique', c.vy < -190 ? 0 : 1);
    else if (c.naEscada) {
      h.play('escada', true);
      if (this.subindo) h.anims.resume();
      else h.anims.pause();
    } else if (!c.noChao) quadro('iara-pulo', c.vy < -120 ? 1 : c.vy < 80 ? 2 : 3);
    else if (c.vx !== 0) h.play('corrida', true);
    else h.play('parada', true);
    h.setAlpha(j.invencivel > 0 && j.morta === 0 && j.passos % 8 < 4 ? 0.35 : 1);

    const fechadas = j.portasFechadas();
    for (const p of this.portas) p.setTexture(!fechadas && Math.abs(ox + c.x - p.x) < 48 ? 'porta-aberta' : 'porta-fechada');
    for (const s of this.saves) {
      if (Math.abs(ox + c.x - s.x) < 12 && Math.abs(oy + c.y - s.y) < 4) s.setTexture('save-on');
    }

    // plataformas de relógio: acesas, piscando antes de trocar, ou apagadas
    const fase = faseRelogio(j.relogio);
    const piscando = j.relogio % RELOGIO >= RELOGIO - AVISO_RELOGIO && j.relogio % 10 < 5;
    for (const r of this.relogios) {
      const letra = r.fase ? 'b' : 'a';
      const ligada = r.fase === fase;
      r.img.setTexture(`relogio-${letra}${!ligada ? '-off' : piscando ? '-aviso' : ''}`).setAlpha(ligada ? 1 : 0.35)
        .setDisplaySize(r.img.displayWidth, 11);
    }

    const alvo = j.temGancho && !c.cabo ? ganchoAoAlcance(j.sala, c) : null;
    for (const a of this.ganchos) {
      const aceso = [alvo, c.cabo].some((k) => k && ox + k.ax === a.x && oy + k.ay === a.y);
      a.setTexture(aceso ? 'gancho-aceso' : 'gancho');
    }

    const g = this.efeitos.clear();
    // riscos de vento na frente dos ventiladores
    for (const v of ventos(j.base)) {
      g.lineStyle(1, 0xbfe8ff, 0.45);
      for (let k = 0; k < 9; k++) {
        const x = v.x1 - 14 - ((j.passos * 2.2 + k * 47) % (v.x1 - v.x0 - 20));
        const y = v.y0 + 10 + ((k * 29) % (v.y1 - v.y0 - 16));
        g.lineBetween(ox + x, oy + y, ox + x + 11, oy + y);
      }
    }
    if (c.cabo) {
      g.lineStyle(2, 0x0b1020, 1).lineBetween(ox + c.cabo.ax, oy + c.cabo.ay, ox + c.x, oy + c.y - 24);
      g.lineStyle(1, 0xa9c4d6, 1).lineBetween(ox + c.cabo.ax, oy + c.cabo.ay, ox + c.x, oy + c.y - 24);
    }
    for (const p of j.pulsos) {
      g.fillStyle(0x38e8ff, 0.35).fillCircle(ox + p.x, oy + p.y, 6);
      g.fillStyle(0xe8ffff, 1).fillCircle(ox + p.x, oy + p.y, 2.5);
    }
    let bola = 0;
    for (const f of j.faiscas) {
      if (j.chefe?.tipo === 'firewall') {
        if (f.espera > 0) continue;
        const img = (this.bolas[bola] ??= this.add.image(0, 0, 'bola').setScale(0.5).setDepth(30));
        img.setVisible(true).setPosition(ox + f.x, oy + f.y - 5);
        bola++;
        continue;
      }
      if (f.espera > 0) {
        g.fillStyle(0xff9a2f, j.passos % 10 < 5 ? 0.9 : 0.4).fillCircle(ox + f.x, oy + f.y - 3, 3);
        continue;
      }
      // raio rasteiro em zigue-zague
      g.lineStyle(2, j.passos % 6 < 3 ? 0x9ff4ff : 0xe86bff, 1).beginPath().moveTo(ox + f.x - 8, oy + f.y - 1);
      for (let i = 1; i <= 4; i++) g.lineTo(ox + f.x - 8 + i * 4, oy + f.y - (i % 2 ? 7 : 1));
      g.strokePath();
    }

    for (const img of this.bolas.slice(bola)) img.setVisible(false);

    this.desenharInimigos(j.inimigos);
    this.desenharChefe();
    this.desenharHud();
  }

  private desenharInimigos(lista: Inimigo[]): void {
    for (const i of lista) {
      let s = this.inimigos.get(i.id);
      if (!s) {
        s = this.add.sprite(0, 0, FOLHA_INIMIGO[i.tipo]).setOrigin(0.5, 1).setScale(0.5).setDepth(18);
        if (i.tipo !== 'bobina') s.play(i.tipo === 'pacotinho' ? 'pacote' : i.tipo);
        if (i.tipo === 'pacotinho') s.setScale(0.34);
        this.inimigos.set(i.id, s);
      }
      // o rato foi desenhado olhando para a direita, como os outros
      s.setPosition(this.ox + i.x, this.oy + i.y + 1).setFlipX(i.lado < 0);
      if (i.tipo === 'bobina') this.desenharBobina(i, s);
      // o ventilador foi desenhado soprando para a direita
      if (i.tipo === 'cooler') s.setFlipX(true);
      if (i.dor > 6) s.setTintFill(0xffffff);
      else s.clearTint();
    }
  }

  private desenharBobina(i: Inimigo, s: Sprite): void {
    const f = i.t % BOBINA.ciclo;
    if (f >= BOBINA.aviso) s.setTexture('bobina-aviso', Math.floor(f / 6) % 2);
    else s.setTexture('bobina-parada', Math.floor(f / 20) % 2);
    const caixa = this.jogo.caixaArco(i);
    let arco = this.arcos.get(i.id);
    if (!caixa) {
      arco?.setVisible(false);
      return;
    }
    if (!arco) {
      arco = this.add.image(0, 0, 'arco').setScale(0.5).setDepth(19);
      this.arcos.set(i.id, arco);
    }
    arco.setVisible(true).setFlipX(i.lado > 0).setPosition(this.ox + (caixa.x0 + caixa.x1) / 2, this.oy + (caixa.y0 + caixa.y1) / 2);
  }

  private desenharMatriarca(b: Chefe): void {
    this.chefe ??= this.add.sprite(0, 0, 'matriarca-parada').setOrigin(0.5, 1).setScale(0.5).setDepth(17);
    const s = this.chefe;
    s.setPosition(this.ox + b.x, this.oy + b.y + 2).setFlipX(b.lado < 0).setVisible(b.estado === 'aberto' || b.estado === 'morto');
    if (b.estado === 'morto') s.setTexture('matriarca-morta');
    else if (b.dor > 0) s.setTexture('matriarca-dano');
    else if (b.t > 50 && b.t < 84) s.setTexture('matriarca-ataque');
    else if (b.hp <= CHEFE_HP.matriarca / 2) s.setTexture('matriarca-furia');
    else s.setTexture('matriarca-parada', Math.floor(Math.max(0, b.t) / 18) % 2);
    if (b.estado === 'aviso') {
      // poeira avisa por onde ela vai sair
      const g = this.efeitos;
      for (let k = 0; k < 7; k++) {
        const sobe = (b.t * 1.4 + k * 11) % 20;
        g.fillStyle(0x9aa7b8, 1 - sobe / 22).fillCircle(this.ox + b.x - 18 + k * 6, this.oy + b.y - sobe, 2.5);
      }
    }
  }

  private desenharMuro(b: Chefe): void {
    // dois blocos empilhados; a frente do muro é a borda direita
    this.chefe ??= this.add.sprite(0, 0, 'muro').setOrigin(1, 1).setScale(0.5).setDepth(17);
    const s = this.chefe;
    if (b.estado === 'morto') {
      s.setTexture('muro-furia').setAlpha(Math.max(0, 1 - b.t / 40));
      this.nucleo?.setTint(0x3a3f4d);
      return;
    }
    const furioso = b.hp <= CHEFE_HP.firewall / 2;
    const textura = furioso ? 'muro-furia' : 'muro';
    s.setTexture(textura).setPosition(this.ox + b.x, this.oy + b.y);
    const g = this.efeitos;
    // o resto do muro: cópias para cima e para fora da sala
    g.fillStyle(0x1a1526, 0.96).fillRect(this.ox, this.oy + T, Math.max(0, b.x - s.displayWidth + 4), b.y - T);
    if (b.estado === 'aviso') g.fillStyle(0xff8a2a, 0.35 + 0.3 * Math.sin(b.t / 3)).fillRect(this.ox + b.x - 4, this.oy + T, 5, b.y - T);
    if (b.dor > 8) this.nucleo?.setTintFill(0xffffff);
    else this.nucleo?.clearTint();
    // segunda fileira de blocos
    if (!this.muroDeCima) this.muroDeCima = this.add.sprite(0, 0, textura).setOrigin(1, 1).setScale(0.5).setDepth(17);
    this.muroDeCima.setTexture(textura).setPosition(this.ox + b.x, this.oy + b.y - s.displayHeight).setVisible(b.x > MURO.inicio);
  }

  private desenharChefe(): void {
    const b = this.jogo.chefe;
    if (!b) return;
    if (b.tipo === 'matriarca') {
      this.desenharMatriarca(b);
      return;
    }
    if (b.tipo === 'firewall') {
      this.desenharMuro(b);
      if (b.estado === 'morto') this.muroDeCima?.setAlpha(Math.max(0, 1 - b.t / 40));
      return;
    }
    this.chefe ??= this.add.sprite(0, 0, 'chefe-parado').setOrigin(0.5, 1).setScale(0.5).setDepth(17);
    const s = this.chefe;
    const furioso = b.hp <= CHEFE_HP.transformador / 2;
    s.setPosition(this.ox + b.x, this.oy + b.y + 1).setFlipX(b.lado < 0);
    if (b.estado === 'morto') s.setTexture('chefe-morto');
    else if (b.estado === 'aberto') s.setTexture('chefe-aberto');
    else if (b.estado === 'aviso') s.setTexture(furioso ? 'chefe-furia' : 'chefe-aviso', 0);
    else if (b.estado === 'salto') {
      if (b.t < 30) s.setTexture('chefe-salto', b.t < 15 ? 0 : 1);
      else s.setTexture('chefe-caindo');
    } else s.setTexture('chefe-parado');
    if (b.dor > 8) s.setTintFill(0xffffff);
    else if (furioso && b.estado !== 'morto') s.setTint(0xff9be8);
    else s.clearTint();
  }

  private desenharHud(): void {
    const j = this.jogo;
    const energia = j.temPulso || j.energia > 0;
    const g = this.hud.clear();
    g.fillStyle(0x04070f, 0.65).fillRect(2, 2, 8 + j.hpMax * 8, energia ? 18 : 11);
    for (let i = 0; i < j.hpMax; i++) g.fillStyle(i < j.hp ? 0xff4d5e : 0x3a2430, 1).fillRect(6 + i * 8, 4, 6, 7);
    if (energia) {
      for (let i = 0; i < 5; i++) g.fillStyle(i < j.energia ? 0x38e8ff : 0x16303c, 1).fillRect(6 + i * 8, 13, 6, 5);
    }
    const b = j.chefe;
    if (b && b.estado !== 'morto') {
      g.fillStyle(0x04070f, 0.7).fillRect(138, 12, 204, 9);
      g.fillStyle(0xb946ff, 1).fillRect(140, 14, (200 * b.hp) / CHEFE_HP[b.tipo], 5);
    }
    if (this.time.now > this.avisoAte) this.aviso.setVisible(false);
  }
}
