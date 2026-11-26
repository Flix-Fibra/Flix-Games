/**
 * A partida inteira sem Phaser: sala atual, heroína, cabo-gancho, golpe, pulso, inimigos, chefe, itens e repetidoras.
 * A cena só desenha este estado e toca sons conforme os eventos de cada passo.
 */
import {
  ALTURA, DT, GRAVIDADE, LARGURA, SEM_ENTRADA, T, chegada, comAtalho, marcas, moverX, moverY, naPorta, novoCorpo,
  passoCorpo, portas, sala, solido, faseRelogio, noRelogio, soprar, ventos,
  type Corpo, type Entrada, type Porta,
} from './logic';
import { ROOMS, type EnemyType, type RoomDef } from './levels';

export const HP_INICIAL = 8;
export const ENERGIA_MAX = 5;
/** golpe: preparo, ativo e recuperação, em passos */
export const GOLPE_PREPARO = 6;
export const GOLPE_ATIVO = 7;
export const GOLPE_TOTAL = 27;
export const ALCANCE = 40; // 2,5 tiles a partir do centro
export type TipoChefe = 'transformador' | 'matriarca' | 'firewall';
export const CHEFE_HP: Record<TipoChefe, number> = { transformador: 12, matriarca: 14, firewall: 12 };
/** buracos de onde a Matriarca sai (o meio da arena é o fio) */
export const BOCAS = [5.5 * T, 22.5 * T, 26 * T];
/** os golpes de cada chefe somem a duas larguras do desenho dele, contadas do ponto de onde saíram */
export const ALCANCE_FAISCA: Record<TipoChefe, number> = {
  transformador: 2 * 41.5, matriarca: 2 * 91.5, firewall: 2 * 74,
};
/** Firewall: começa fora da sala, avança 1 tile a cada 4 s (3 s furioso) e recua a cada 3 golpes no núcleo */
export const MURO = { inicio: -24, limite: 21 * T, recuo: 6 * T, ciclo: 190, aviso: 45 };
/** núcleo do Firewall, em cima do pilar da direita */
export const NUCLEO = { x: 431, y: 96 };
/** bobina: passos do ciclo, do começo do aviso e do disparo */
export const BOBINA = { ciclo: 150, aviso: 90, tiro: 122, alcance: 96 };

export type TipoItem = 'lampada' | 'cura' | 'pulso' | 'nucleo' | 'gancho' | 'repique' | 'fragmento';
/** O que cada 'I' de cada sala entrega, em ordem de leitura. */
export const ITENS: Record<string, TipoItem[]> = {
  'F1-1': ['lampada'],
  'F1-2': ['lampada', 'cura'],
  'F1-3': ['cura'],
  'F1-4': ['pulso'],
  'F1-S': ['nucleo'],
  'F2-2': ['gancho'],
  'F2-3': ['nucleo'],
  'F2-4': ['cura'],
  'F3-2': ['cura'],
  'F3-4': ['cura'],
  'F3-S': ['fragmento'],
};

export interface Controles extends Entrada {
  golpeApertado: boolean;
  pulsoApertado: boolean;
}
export const PARADO: Controles = { ...SEM_ENTRADA, golpeApertado: false, pulsoApertado: false };

export interface Retangulo { x0: number; y0: number; x1: number; y1: number }
const cruza = (a: Retangulo, b: Retangulo) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
/** caixa com apoio no meio, embaixo */
const caixa = (x: number, y: number, w: number, h: number): Retangulo => ({ x0: x - w / 2, y0: y - h, x1: x + w / 2, y1: y });

export interface Inimigo {
  id: number;
  tipo: Exclude<EnemyType, TipoChefe> | 'pacotinho';
  vy: number;
  x: number;
  y: number;
  x0: number;
  y0: number;
  lado: 1 | -1;
  hp: number;
  t: number;
  /** passos de piscada depois de apanhar */
  dor: number;
}

export type EstadoChefe = 'toca' | 'parado' | 'aviso' | 'salto' | 'aberto' | 'morto';
export interface Chefe {
  tipo: TipoChefe;
  x: number;
  y: number;
  lado: 1 | -1;
  hp: number;
  estado: EstadoChefe;
  t: number;
  dor: number;
  de: { x: number; y: number };
  para: { x: number; y: number };
  saltos: number;
}

export interface Faisca {
  x: number;
  y: number;
  vx: number;
  espera: number;
  vida: number;
  /** some ao passar de `ate` px do ponto `origem` */
  limite: { origem: number; ate: number };
}
export interface Pulso { x: number; y: number; vx: number; vy: number }
export interface Item { chave: string; tipo: TipoItem; x: number; y: number }

export type Evento =
  | { tipo: 'gancho' | 'alavanca' | 'fase' | 'pulo' | 'pouso' | 'golpe' | 'pulso' | 'dano' | 'morte' | 'salva' | 'sala' | 'chefe-pouso' | 'chefe-morto' | 'fim' | 'bloqueado'; x: number; y: number }
  | { tipo: 'acerto' | 'inimigo-morto'; x: number; y: number; alvo?: Inimigo }
  | { tipo: 'item'; x: number; y: number; item: TipoItem };

export class Partida {
  sala!: RoomDef;
  portas: Porta[] = [];
  corpo!: Corpo;
  hp = HP_INICIAL;
  hpMax = HP_INICIAL;
  energia = 0;
  temPulso = false;
  temGancho = false;
  temRepique = false;
  /** fases em que a alavanca do atalho já foi puxada ('F2', 'F3') */
  atalhos = new Set<string>();
  /** a sala como está no mapa (com as duas plataformas de relógio); `sala` é a vista da física neste instante */
  base!: RoomDef;
  relogio = 0;
  private faixas: ReturnType<typeof ventos> = [];
  /** -1 = sem golpe; senão, passo atual do golpe */
  golpe = -1;
  lancando = 0;
  invencivel = 0;
  recuo = 0;
  morta = 0;
  fim = false;
  passos = 0;
  mortes = 0;
  pontos = 0;
  inimigos: Inimigo[] = [];
  chefe: Chefe | null = null;
  faiscas: Faisca[] = [];
  pulsos: Pulso[] = [];
  itens: Item[] = [];
  vencidos = new Set<string>();
  private proximoId = 100;
  private coletados = new Set<string>();
  private atingidos = new Set<number>();
  private portaLivre = false;
  private chao = { x: 0, y: 0 };
  private save: { sala: string; x: number; y: number };
  eventos: Evento[] = [];
  private sorteio: number;

  constructor(inicio = 'F1-1', semente = 7) {
    this.sorteio = semente;
    const s = sala(inicio);
    const p = marcas(s, 'P')[0];
    const x = p ? (p.col + 0.5) * T : 3 * T;
    const y = p ? (p.lin + 1) * T : (s.height - 1) * T;
    this.save = { sala: inicio, x, y };
    this.entrar(inicio, x, y, 1);
  }

  private aleatorio(): number {
    this.sorteio = (this.sorteio * 16807) % 2147483647;
    return this.sorteio / 2147483647;
  }

  entrar(id: string, x: number, y: number, lado: 1 | -1): void {
    this.base = comAtalho(sala(id), this.atalhos.has(id.slice(0, 2)));
    this.relogio = 0;
    this.sala = noRelogio(this.base, 0);
    this.faixas = ventos(this.base);
    this.portas = portas(id);
    this.corpo = novoCorpo(x, y);
    this.corpo.lado = lado;
    this.corpo.noChao = true;
    this.chao = { x, y };
    this.golpe = -1;
    this.lancando = this.recuo = 0;
    this.faiscas = [];
    this.pulsos = [];
    this.portaLivre = false;
    this.inimigos = [];
    this.chefe = null;
    let n = 0;
    for (const m of marcas(this.sala, 'EB')) {
      const tipo = this.sala.enemies[n++]!;
      const ex = (m.col + 0.5) * T;
      const ey = (m.lin + 1) * T;
      if (tipo === 'transformador' || tipo === 'matriarca' || tipo === 'firewall') {
        if (this.vencidos.has(id)) continue;
        const bx = tipo === 'transformador' ? ex + 48 : tipo === 'firewall' ? MURO.inicio : BOCAS[1]!;
        this.chefe = {
          tipo, x: bx, y: tipo === 'firewall' ? (this.sala.height - 1) * T : ey, lado: -1, hp: CHEFE_HP[tipo],
          estado: tipo === 'matriarca' ? 'toca' : 'parado', t: -40,
          dor: 0, de: { x: ex, y: ey }, para: { x: ex, y: ey }, saltos: 0,
        };
      } else this.inimigos.push(this.criar(n, tipo, ex, ey));
    }
    this.itens = marcas(this.sala, 'I')
      .map((m, i) => ({ chave: `${id}:${i}`, tipo: ITENS[id]?.[i] ?? 'lampada', x: (m.col + 0.5) * T, y: (m.lin + 1) * T }))
      .filter((it) => !this.coletados.has(it.chave));
    this.eventos.push({ tipo: 'sala', x, y });
  }

  private criar(id: number, tipo: Inimigo['tipo'], x: number, y: number): Inimigo {
    return { id, tipo, x, y, x0: x, y0: y, vy: 0, lado: -1, hp: tipo === 'drone' || tipo === 'rato' || tipo === 'bobina' ? 2 : 1, t: 0, dor: 0 };
  }

  /** As portas da arena ficam fechadas enquanto o chefe está de pé. */
  portasFechadas(): boolean {
    return !!this.chefe && this.chefe.estado !== 'morto';
  }

  caixaHeroina(): Retangulo {
    return caixa(this.corpo.x, this.corpo.y, LARGURA, ALTURA - 2);
  }

  caixaGolpe(): Retangulo | null {
    if (this.golpe < GOLPE_PREPARO || this.golpe >= GOLPE_PREPARO + GOLPE_ATIVO) return null;
    const { x, y, lado } = this.corpo;
    return { x0: lado > 0 ? x : x - ALCANCE, x1: lado > 0 ? x + ALCANCE : x, y0: y - 24, y1: y - 3 };
  }

  passo(c: Controles): Evento[] {
    this.eventos = [];
    if (this.fim) return this.eventos;
    this.passos++;
    if (this.morta > 0) {
      if (++this.morta > 110) this.renascer();
      return this.eventos;
    }
    // as plataformas de relógio trocam de lado a cada 1,5 s
    const fase = faseRelogio(++this.relogio);
    if (fase !== faseRelogio(this.relogio - 1)) this.sala = noRelogio(this.base, fase);
    this.passoHeroina(c);
    this.passoInimigos();
    this.passoChefe();
    this.passoProjeteis();
    this.passoContatos();
    return this.eventos;
  }

  private passoHeroina(c: Controles): void {
    const corpo = this.corpo;
    if (this.invencivel > 0) this.invencivel--;
    const parada = this.recuo > 0;
    let e: Entrada = c;
    if (parada) {
      this.recuo--;
      e = SEM_ENTRADA;
    }
    if (this.golpe < 0 && this.lancando === 0 && !parada && !corpo.cabo) {
      if (c.golpeApertado) {
        this.golpe = 0;
        this.atingidos.clear();
        this.eventos.push({ tipo: 'golpe', x: corpo.x, y: corpo.y });
      } else if (c.pulsoApertado && this.temPulso) {
        if (this.energia > 0) {
          this.energia--;
          this.lancando = 18;
          this.pulsos.push({ x: corpo.x + corpo.lado * 8, y: corpo.y - 20, vx: corpo.lado * 175, vy: -130 });
          this.eventos.push({ tipo: 'pulso', x: corpo.x, y: corpo.y });
        } else this.eventos.push({ tipo: 'bloqueado', x: corpo.x, y: corpo.y });
      }
    }
    // golpe no chão ou na escada prende o lugar; no ar o movimento continua
    const preso = (this.golpe >= 0 || this.lancando > 0) && (corpo.noChao || corpo.naEscada);
    if (preso) e = { ...SEM_ENTRADA };
    const lado = corpo.lado;
    // atacando no ar não lança o cabo
    const r = passoCorpo(this.sala, corpo, e, { gancho: this.temGancho && this.golpe < 0, repique: this.temRepique });
    soprar(this.sala, this.faixas, corpo);
    if (r.agarrou) this.eventos.push({ tipo: 'gancho', x: corpo.x, y: corpo.y });
    if (this.golpe >= 0) corpo.lado = lado;
    if (parada && !corpo.naEscada) moverX(this.sala, corpo, -corpo.lado * 80 * DT);
    if (r.pulou) this.eventos.push({ tipo: 'pulo', x: corpo.x, y: corpo.y });
    if (r.pousou) this.eventos.push({ tipo: 'pouso', x: corpo.x, y: corpo.y });
    if (this.golpe >= 0 && ++this.golpe >= GOLPE_TOTAL) this.golpe = -1;
    if (this.lancando > 0) this.lancando--;

    // último chão firme (para voltar depois de pisar no fio)
    const pe = Math.floor(corpo.y / T);
    if (corpo.noChao && solido(this.sala, Math.floor((corpo.x - 6) / T), pe) && solido(this.sala, Math.floor((corpo.x + 6) / T), pe)) {
      const fioPerto = [-1, 0, 1].some((d) => this.sala.tiles[pe - 1]?.[Math.floor(corpo.x / T) + d] === '^');
      if (!fioPerto) this.chao = { x: corpo.x, y: corpo.y };
    }
  }

  private passoInimigos(): void {
    for (const i of this.inimigos) {
      i.t++;
      if (i.dor > 0) {
        i.dor--;
        continue;
      }
      if (i.tipo === 'pacote' || i.tipo === 'pacotinho') {
        const piso = Math.floor((i.y + 1) / T);
        const frente = Math.floor((i.x + i.lado * 9) / T);
        const firme = solido(this.sala, frente, piso) || this.sala.tiles[piso]?.[frente] === '=';
        const passo = (i.tipo === 'pacote' ? 26 : 44) * DT;
        if (!firme || moverX(this.sala, i, i.lado * passo, 12, 14)) i.lado = i.lado > 0 ? -1 : 1;
      } else if (i.tipo === 'cooler') {
        // fixo: só sopra
      } else if (i.tipo === 'faisca') {
        const frente = i.x + i.lado * 9;
        const semChao = !solido(this.sala, Math.floor(frente / T), Math.floor((i.y + 1) / T));
        if (semChao || moverX(this.sala, i, i.lado * 28 * DT, 12, 14)) i.lado = i.lado > 0 ? -1 : 1;
      } else if (i.tipo === 'rato') {
        const piso = Math.floor((i.y + 1) / T);
        // rato anda no chão e nas plataformas vazadas
        const firme = (col: number) => solido(this.sala, col, piso) || this.sala.tiles[piso]?.[col] === '=';
        const noChao = i.vy === 0 && firme(Math.floor(i.x / T));
        const frente = Math.floor((i.x + i.lado * 11) / T);
        const semCaminho = noChao && (!firme(frente) || this.sala.tiles[piso - 1]?.[frente] === '^');
        if (semCaminho || moverX(this.sala, i, i.lado * 58 * DT, 18, 12)) i.lado = i.lado > 0 ? -1 : 1;
        // pulinho de 1 tile de vez em quando, se houver piso à frente
        if (noChao && i.t % 100 === 60 && firme(Math.floor((i.x + i.lado * 34) / T))) i.vy = -175;
        i.vy += GRAVIDADE * DT;
        if (moverY(this.sala, i, i.vy * DT, false, 12) !== null) i.vy = 0;
      } else if (i.tipo === 'bobina') {
        // vira para a heroína só antes do aviso, para o disparo ser previsível
        if (i.t % BOBINA.ciclo < BOBINA.aviso) i.lado = this.corpo.x < i.x ? -1 : 1;
      } else {
        // drone: vai e volta em onda
        if (moverX(this.sala, i, i.lado * 34 * DT, 18, 10) || Math.abs(i.x - i.x0) > 52) i.lado = i.x > i.x0 ? -1 : 1;
        i.y = i.y0 - 6 + Math.sin(i.t / 22) * 12;
      }
    }
  }

  /** O arco da bobina passa na altura do balanço: quem está no chão fica por baixo. */
  caixaArco(i: Inimigo): Retangulo | null {
    if (i.tipo !== 'bobina' || i.t % BOBINA.ciclo < BOBINA.tiro) return null;
    const x0 = i.lado > 0 ? i.x + 6 : i.x - 6 - BOBINA.alcance;
    return { x0, x1: x0 + BOBINA.alcance, y0: i.y - 40, y1: i.y - 30 };
  }

  private passoMatriarca(b: Chefe): void {
    const furiosa = b.hp <= CHEFE_HP.matriarca / 2;
    const trocar = (estado: EstadoChefe) => {
      b.estado = estado;
      b.t = 0;
    };
    if (b.estado === 'toca') {
      if (b.t > (furiosa ? 26 : 44)) {
        // sai por uma boca perto ou longe, alternando, mas nunca debaixo dos pés da heroína
        const livres = BOCAS.filter((x) => Math.abs(x - this.corpo.x) > 34)
          .sort((p, q) => Math.abs(p - this.corpo.x) - Math.abs(q - this.corpo.x));
        b.x = livres[b.saltos % 2 === 0 ? 0 : livres.length - 1]!;
        b.saltos++;
        trocar('aviso');
      }
    } else if (b.estado === 'aviso') {
      b.lado = this.corpo.x < b.x ? -1 : 1;
      if (b.t > 48) {
        trocar('aberto');
        this.eventos.push({ tipo: 'chefe-pouso', x: b.x, y: b.y });
        // na metade da vida ela chega acompanhada
        for (let n = this.inimigos.length; furiosa && n < 2; n++) {
          const rato = this.criar(this.proximoId++, 'rato', b.x + (n ? 20 : -20), b.y);
          rato.lado = this.corpo.x < b.x ? -1 : 1;
          this.inimigos.push(rato);
        }
      }
    } else if (b.estado === 'aberto') {
      if (b.t === 62) {
        const tiros: [number, number][] = furiosa ? [[b.lado, 0], [-b.lado, 0], [b.lado, 28]] : [[b.lado, 0], [-b.lado, 14]];
        const limite = { origem: b.x, ate: ALCANCE_FAISCA.matriarca };
        for (const [dir, espera] of tiros) this.faiscas.push({ x: b.x + dir * 28, y: b.y, vx: dir * 100, espera, vida: 240, limite });
      }
      if (b.t > 120) trocar('toca');
    }
  }

  private passoMuro(b: Chefe): void {
    const furioso = b.hp <= CHEFE_HP.firewall / 2;
    b.x = Math.min(MURO.limite, b.x + (T / (furioso ? 180 : 240)));
    const f = b.t % MURO.ciclo;
    b.estado = b.t > 0 && f >= MURO.ciclo - MURO.aviso ? 'aviso' : 'parado';
    if (b.t > 0 && f === 0) {
      // bolas de fogo na altura dos pés da heroína, saindo da frente do muro
      const limite = { origem: b.x, ate: ALCANCE_FAISCA.firewall };
      for (let n = 0; n < (furioso ? 2 : 1); n++) {
        this.faiscas.push({ x: b.x + 4, y: this.corpo.y - 3, vx: 95, espera: n * 34, vida: 300, limite });
      }
      this.eventos.push({ tipo: 'pulso', x: b.x, y: this.corpo.y });
    }
  }

  private passoChefe(): void {
    const b = this.chefe;
    if (!b) return;
    if (b.dor > 0) b.dor--;
    b.t++;
    if (b.estado === 'morto') return;
    if (b.tipo === 'matriarca') {
      this.passoMatriarca(b);
      return;
    }
    if (b.tipo === 'firewall') {
      this.passoMuro(b);
      return;
    }
    const furioso = b.hp <= CHEFE_HP.transformador / 2;
    const trocar = (estado: EstadoChefe) => {
      b.estado = estado;
      b.t = 0;
    };
    if (b.estado === 'parado') {
      b.lado = this.corpo.x < b.x ? -1 : 1;
      if (b.t > (furioso ? 24 : 40)) trocar('aviso');
    } else if (b.estado === 'aviso') {
      if (b.t > (furioso ? 32 : 40)) {
        // alterna entre cair perto da heroína e fugir para um dos lados da arena
        const largura = this.sala.width * T;
        const perto = b.saltos % 2 === 0;
        let alvo = perto ? this.corpo.x : this.corpo.x < largura / 2 ? largura - 5 * T : 5 * T;
        alvo = Math.max(3.5 * T, Math.min(largura - 3.5 * T, alvo + (this.aleatorio() - 0.5) * 24));
        b.de = { x: b.x, y: b.y };
        b.para = { x: alvo, y: b.y };
        b.lado = alvo < b.x ? -1 : 1;
        b.saltos++;
        trocar('salto');
      }
    } else if (b.estado === 'salto') {
      const dur = furioso ? 46 : 60;
      const k = Math.min(1, b.t / dur);
      b.x = b.de.x + (b.para.x - b.de.x) * k;
      b.y = b.de.y - Math.sin(Math.PI * k) * 88;
      if (k >= 1) {
        b.y = b.para.y;
        trocar('aberto');
        const n = furioso ? 5 : 3;
        // faíscas correm pelo chão, alternando os lados; a pessoa pula ou sobe na plataforma
        for (let i = 0; i < n; i++) {
          const dir = i % 2 === 0 ? (this.corpo.x < b.x ? -1 : 1) : this.corpo.x < b.x ? 1 : -1;
          this.faiscas.push({
            x: b.x + dir * 22, y: b.y, vx: dir * 105, espera: 18 + Math.floor(i / 2) * 30, vida: 260,
            limite: { origem: b.x, ate: ALCANCE_FAISCA.transformador },
          });
        }
        this.eventos.push({ tipo: 'chefe-pouso', x: b.x, y: b.y });
        // o corpo do robô só machuca aqui: quando ele cai em cima de onde a heroína está
        if (cruza(this.caixaHeroina(), caixa(b.x, b.y, 34, 46))) this.ferir(1, b.x);
      }
    } else if (b.estado === 'aberto') {
      if (b.t > 66) trocar('parado');
    }
  }

  private ferirChefe(dano: number): void {
    const b = this.chefe!;
    // o transformador e a Matriarca só se ferem à vista; o núcleo do Firewall, sempre
    if (b.estado !== 'aberto' && b.tipo !== 'firewall') {
      this.eventos.push({ tipo: 'bloqueado', x: b.x, y: b.y - 28 });
      return;
    }
    b.hp = Math.max(0, b.hp - dano);
    b.dor = 14;
    this.eventos.push({ tipo: 'acerto', x: b.x, y: b.y - 24 });
    if (b.hp === 0) {
      b.estado = 'morto';
      b.t = 0;
      this.faiscas = [];
      this.vencidos.add(this.sala.id);
      this.pontos += 2000;
      this.eventos.push({ tipo: 'chefe-morto', x: b.x, y: b.y });
      if (b.tipo === 'firewall') {
        this.temRepique = true;
        this.eventos.push({ tipo: 'item', x: this.corpo.x, y: this.corpo.y, item: 'repique' });
      }
    } else if (b.tipo === 'firewall' && (CHEFE_HP.firewall - b.hp) % 3 === 0) {
      b.x = Math.max(MURO.inicio, b.x - MURO.recuo);
      this.faiscas = [];
    }
  }

  private ferirInimigo(i: Inimigo, dano: number): void {
    if (i.tipo === 'cooler') {
      this.eventos.push({ tipo: 'bloqueado', x: i.x, y: i.y - 14 });
      return;
    }
    i.hp -= dano;
    i.dor = 14;
    this.eventos.push({ tipo: 'acerto', x: i.x, y: i.y - 8 });
    if (i.hp > 0) return;
    this.inimigos = this.inimigos.filter((o) => o !== i);
    this.pontos += i.tipo === 'faisca' ? 100 : 150;
    if (this.temPulso) this.energia = Math.min(ENERGIA_MAX, this.energia + 1);
    this.eventos.push({ tipo: 'inimigo-morto', x: i.x, y: i.y, alvo: i });
    if (i.tipo === 'pacote') {
      // o pacote se divide em dois menores, que demoram um instante para valer
      for (const lado of [-1, 1] as const) {
        const p = this.criar(this.proximoId++, 'pacote', i.x, i.y);
        p.tipo = 'pacotinho';
        p.lado = lado;
        p.dor = 24;
        moverX(this.sala, p, lado * 14, 12, 14);
        this.inimigos.push(p);
      }
    }
  }

  private caixaInimigo(i: Inimigo): Retangulo {
    if (i.tipo === 'drone') return caixa(i.x, i.y, 18, 10);
    if (i.tipo === 'rato') return caixa(i.x, i.y, 20, 13);
    if (i.tipo === 'bobina') return caixa(i.x, i.y, 18, 18);
    if (i.tipo === 'pacotinho') return caixa(i.x, i.y, 9, 11);
    if (i.tipo === 'cooler') return caixa(i.x, i.y, 18, 26);
    return caixa(i.x, i.y, 13, 15);
  }

  /** Só há corpo para acertar quando o chefe está à vista. */
  private caixaChefe(): Retangulo | null {
    const b = this.chefe;
    if (!b || b.estado === 'morto') return null;
    if (b.tipo === 'matriarca') return b.estado === 'aberto' ? caixa(b.x, b.y, 44, 34) : null;
    if (b.tipo === 'firewall') return caixa(NUCLEO.x, NUCLEO.y, 30, 34);
    return caixa(b.x, b.y, 34, b.estado === 'aberto' ? 34 : 46);
  }

  private passoProjeteis(): void {
    for (const p of [...this.pulsos]) {
      p.vy += 520 * DT;
      p.x += p.vx * DT;
      p.y += p.vy * DT;
      const r = { x0: p.x - 5, y0: p.y - 5, x1: p.x + 5, y1: p.y + 5 };
      const alvo = this.inimigos.find((i) => i.dor === 0 && cruza(r, this.caixaInimigo(i)));
      const chefe = this.caixaChefe();
      const noChefe = !!chefe && cruza(r, chefe);
      if (alvo) this.ferirInimigo(alvo, 2);
      else if (noChefe) this.ferirChefe(1);
      else if (!solido(this.sala, Math.floor(p.x / T), Math.floor(p.y / T))) continue;
      else this.eventos.push({ tipo: 'bloqueado', x: p.x, y: p.y });
      this.pulsos = this.pulsos.filter((o) => o !== p);
    }
    for (const f of this.faiscas) {
      if (f.espera > 0) {
        f.espera--;
        continue;
      }
      f.x += f.vx * DT;
      f.vida--;
      if (Math.abs(f.x - f.limite.origem) > f.limite.ate) f.vida = 0;
      if (solido(this.sala, Math.floor(f.x / T), Math.floor((f.y - 4) / T))) f.vida = 0;
    }
    this.faiscas = this.faiscas.filter((f) => f.vida > 0);
  }

  private passoContatos(): void {
    const golpe = this.caixaGolpe();
    if (golpe) {
      for (const i of [...this.inimigos]) {
        if (!this.atingidos.has(i.id) && i.dor === 0 && cruza(golpe, this.caixaInimigo(i))) {
          this.atingidos.add(i.id);
          this.ferirInimigo(i, 1);
        }
      }
      const chefe = this.caixaChefe();
      if (chefe && !this.atingidos.has(0) && cruza(golpe, chefe)) {
        this.atingidos.add(0);
        this.ferirChefe(1);
      }
    }

    const eu = this.caixaHeroina();
    for (const i of this.inimigos) {
      if (i.dor === 0 && i.tipo !== 'cooler' && cruza(eu, this.caixaInimigo(i))) this.ferir(1, i.x);
      const arco = this.caixaArco(i);
      if (arco && cruza(eu, arco)) this.ferir(1, i.x);
    }
    const b = this.chefe;
    const corpoChefe = this.caixaChefe();
    // encostar no transformador não machuca (só a queda em cima); a Matriarca machuca quem chega muito perto
    if (b?.tipo === 'matriarca' && corpoChefe && cruza(eu, corpoChefe)) this.ferir(1, b.x);
    // encostar no muro fere e empurra para a frente
    if (b?.tipo === 'firewall' && b.estado !== 'morto' && eu.x0 < b.x) {
      this.ferir(1, b.x - 20);
      moverX(this.sala, this.corpo, b.x + 20 - this.corpo.x);
    }
    for (const f of this.faiscas) {
      if (f.espera === 0 && cruza(eu, caixa(f.x, f.y, 16, 7))) this.ferir(1, f.x - f.vx);
    }

    const col = Math.floor(this.corpo.x / T);
    const lin = Math.floor((this.corpo.y - 1) / T);
    if (this.sala.tiles[lin]?.[col] === '^') {
      this.ferir(1, this.corpo.x, true);
      if (this.hp > 0) Object.assign(this.corpo, { x: this.chao.x, y: this.chao.y, vx: 0, vy: 0, impulso: 0, cabo: null });
    }

    for (const it of [...this.itens]) {
      if (!cruza(eu, caixa(it.x, it.y, 14, 16))) continue;
      this.coletados.add(it.chave);
      this.itens = this.itens.filter((o) => o !== it);
      this.pontos += 50;
      if (it.tipo === 'cura') this.hp = Math.min(this.hpMax, this.hp + 4);
      if (it.tipo === 'lampada') this.energia = Math.min(ENERGIA_MAX, this.energia + 3);
      if (it.tipo === 'pulso') {
        this.temPulso = true;
        this.energia = ENERGIA_MAX;
      }
      if (it.tipo === 'nucleo') this.hp = ++this.hpMax;
      if (it.tipo === 'gancho') this.temGancho = true;
      if (it.tipo === 'fragmento') this.energia = ENERGIA_MAX;
      this.eventos.push({ tipo: 'item', x: it.x, y: it.y, item: it.tipo });
    }

    for (const s of marcas(this.sala, 'S')) {
      const x = (s.col + 0.5) * T;
      const y = (s.lin + 1) * T;
      if (Math.abs(this.corpo.x - x) < 12 && Math.abs(this.corpo.y - y) < 4 && (this.save.sala !== this.sala.id || this.hp < this.hpMax)) {
        this.save = { sala: this.sala.id, x, y };
        this.hp = this.hpMax;
        this.eventos.push({ tipo: 'salva', x, y });
      }
    }

    const trecho = this.base.id.slice(0, 2);
    const l = this.atalhos.has(trecho) ? undefined : marcas(this.base, 'L')[0];
    if (l && Math.abs(this.corpo.x - (l.col + 0.5) * T) < 10 && Math.abs(this.corpo.y - (l.lin + 1) * T) < 4) {
      this.atalhos.add(trecho);
      this.base = comAtalho(sala(this.base.id), true);
      this.sala = noRelogio(this.base, faseRelogio(this.relogio));
      this.eventos.push({ tipo: 'alavanca', x: this.corpo.x, y: this.corpo.y });
    }

    if (this.morta > 0) return;
    const porta = this.portas.find((p) => naPorta(this.sala, this.corpo, p));
    if (!porta) this.portaLivre = true;
    else if (this.portaLivre && !this.portasFechadas()) {
      if (ROOMS.some((s) => s.id === porta.destino)) {
        const novaFase = porta.destino > this.sala.id && porta.destino.slice(0, 2) !== this.sala.id.slice(0, 2);
        const destino = sala(porta.destino);
        const p = chegada(destino, porta.destinoEm);
        this.entrar(destino.id, p.x, p.y, p.lado);
        this.corpo.naEscada = p.naEscada;
        this.corpo.noChao = !p.naEscada;
        if (novaFase) {
          // começo de fase também é ponto salvo
          this.save = { sala: destino.id, x: p.x, y: p.y };
          this.hp = this.hpMax;
          this.eventos.push({ tipo: 'fase', x: p.x, y: p.y });
        }
      } else {
        this.fim = true;
        // quem termina mais rápido e morre menos pontua mais
        this.pontos += Math.max(0, 3000 - Math.floor(this.passos / 60) * 5) + Math.max(0, 1000 - this.mortes * 250);
        this.eventos.push({ tipo: 'fim', x: this.corpo.x, y: this.corpo.y });
      }
    }
  }

  private ferir(dano: number, deOnde: number, semRecuo = false): void {
    if (this.invencivel > 0 || this.morta > 0) return;
    this.hp = Math.max(0, this.hp - dano);
    this.invencivel = 60;
    this.golpe = -1;
    this.eventos.push({ tipo: 'dano', x: this.corpo.x, y: this.corpo.y });
    if (this.hp === 0) {
      this.morta = 1;
      this.mortes++;
      this.eventos.push({ tipo: 'morte', x: this.corpo.x, y: this.corpo.y });
      return;
    }
    if (!semRecuo && !this.corpo.naEscada) {
      this.recuo = 12;
      this.corpo.lado = deOnde >= this.corpo.x ? 1 : -1;
      this.corpo.vy = -90;
    }
  }

  private renascer(): void {
    this.morta = 0;
    this.hp = this.hpMax;
    this.invencivel = 60;
    if (this.temPulso) this.energia = Math.max(this.energia, 2);
    this.entrar(this.save.sala, this.save.x, this.save.y, 1);
  }
}
