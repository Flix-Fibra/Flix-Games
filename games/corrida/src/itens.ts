import Phaser from 'phaser';
import type { Marcador } from './minimapa';
import { ARCO_MS, ESTA_RODANDO, rodar, TURBO_MS, type Amostra, type Carro } from './logic';
import type { PistaPronta } from './pistas';

/**
 * Itens e obstáculos da pista (todos empilhados em pixels, ver `itensArte.ts`):
 * - poças de água fixas: o carro derrapa e dá voltas;
 * - bônus (turbo, arco-íris e roleta): giram no chão e voltam depois de pegos;
 * - vaca que atravessa a pista de vez em quando: quem encosta toma um coice e sai da pista;
 * - meteoro: a sombra cresce no chão à frente do jogador e, quando ele cai, joga os carros próximos para fora
 *   da pista; eles reaparecem na pista depois de 2 s.
 */

export type Evento = 'turbo' | 'arco' | 'roleta' | 'vaca' | 'meteoro' | 'poca';

export interface Piloto {
  carro: Carro;
  jogador: boolean;
  /** Índice da amostra mais próxima na linha central. */
  indice: number;
}

export type TipoBonus = 'turbo' | 'arco' | 'roleta';

export type TipoItem = TipoBonus | 'poca';

/**
 * Poças e bônus aparecem em lugares aleatórios e com pouca frequência: de tempos em tempos um item surge na pista, um
 * pedaço à frente do jogador, numa posição e faixa sorteadas. No máximo `ITENS_MAX` ao mesmo tempo; some quando fica para
 * trás ou depois de um tempo.
 */
export const ITENS_MAX = 3;
export const PRIMEIRO_ITEM_MS = 6000;
export const INTERVALO_ITEM_MS: readonly [number, number] = [9000, 16000];
/** Quanto à frente do jogador (em px ao longo da pista) o item pode surgir. */
export const DISTANCIA_ITEM_PX: readonly [number, number] = [600, 1500];
const VIDA_ITEM_MS = 45000;
const ATRAS_MAX_PX = 500;

/** Sorteia o tipo (r de 0 a 1): turbo 30%, poça 30%, arco-íris 25%, roleta 15%. */
export function tipoSorteado(r: number): TipoItem {
  if (r < 0.3) return 'turbo';
  if (r < 0.6) return 'poca';
  if (r < 0.85) return 'arco';
  return 'roleta';
}

const RAIO_BONUS = 22;
const POCA_RX = 30;
const POCA_RY = 15;
const VACA_VEL = 26;
const VACA_RAIO = 10;
const METEORO_MS = 2100;
const METEORO_RAIO = 34;
export const PRIMEIRA_VACA_MS = 17000;
export const PRIMEIRO_METEORO_MS = 23000;

const normal = (a: Amostra): [number, number] => [-Math.sin(a.ang), Math.cos(a.ang)];
const aleat = (min: number, max: number): number => min + Math.random() * (max - min);

/** Pontos (frente e traseira) que representam o carro nas colisões com os itens. */
function pontosDoCarro(c: Carro): Array<[number, number]> {
  return [
    [c.x + Math.cos(c.ang) * 11, c.y + Math.sin(c.ang) * 11],
    [c.x - Math.cos(c.ang) * 11, c.y - Math.sin(c.ang) * 11],
  ];
}

interface Bonus {
  tipo: TipoBonus;
  x: number;
  y: number;
  sprite: Phaser.GameObjects.Image;
  indice: number;
  vida: number;
}
interface Poca {
  x: number;
  y: number;
  ang: number;
  sprite: Phaser.GameObjects.Image;
  indice: number;
  vida: number;
}
interface Vaca {
  x: number;
  y: number;
  dx: number;
  dy: number;
  restante: number;
  sprite: Phaser.GameObjects.Image;
  sombra: Phaser.GameObjects.Image;
}
interface Meteoro {
  x: number;
  y: number;
  t: number;
  sombra: Phaser.GameObjects.Image;
  rocha: Phaser.GameObjects.Image;
}

export class Itens {
  private bonus: Bonus[] = [];
  private pocas: Poca[] = [];
  private vaca: Vaca | null = null;
  private meteoro: Meteoro | null = null;
  private proximaVaca = PRIMEIRA_VACA_MS;
  private proximoMeteoro = PRIMEIRO_METEORO_MS;
  private proximoItem = PRIMEIRO_ITEM_MS;
  private rot = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly pista: PistaPronta,
    private readonly aoEvento: (e: Evento, p: Piloto) => void,
  ) {}

  /** Posições dos itens e perigos na pista, para o minimapa (só leitura). */
  marcadores(): Marcador[] {
    const out: Marcador[] = [
      ...this.bonus.map((b) => ({ x: b.x, y: b.y, tipo: b.tipo })),
      ...this.pocas.map((p) => ({ x: p.x, y: p.y, tipo: 'poca' as const })),
    ];
    if (this.vaca) out.push({ x: this.vaca.x, y: this.vaca.y, tipo: 'vaca' });
    if (this.meteoro) out.push({ x: this.meteoro.x, y: this.meteoro.y, tipo: 'meteoro' });
    return out;
  }

  destruir(): void {
    this.bonus.forEach((b) => b.sprite.destroy());
    this.pocas.forEach((p) => p.sprite.destroy());
    this.vaca?.sprite.destroy();
    this.vaca?.sombra.destroy();
    this.meteoro?.sombra.destroy();
    this.meteoro?.rocha.destroy();
    this.bonus = [];
    this.pocas = [];
    this.vaca = null;
    this.meteoro = null;
  }

  /**
   * `rot` = rotação da câmera (rad). Os objetos empilhados (stacks) são contra-rotacionados para a pilha continuar sempre
   * apontando para cima na tela; os desenhos planos (poça, sombra) giram com o mundo.
   */
  atualizar(delta: number, tempo: number, pilotos: readonly Piloto[], rot = 0): void {
    this.rot = rot;
    const dt = delta / 1000;
    const jogador = pilotos.find((p) => p.jogador);

    this.sortearItem(delta, jogador);

    // bônus: giram no chão; quem encosta leva o efeito e o bônus some
    const quadro = Math.floor(tempo / 60) % 24;
    for (const b of [...this.bonus]) {
      b.vida -= delta;
      b.sprite.setFrame(quadro).setDepth(1 + b.y).setRotation(-rot);
      if (this.sumiu(b.indice, b.vida, jogador)) {
        this.remover(b);
        continue;
      }
      for (const p of pilotos) {
        if (b.tipo === 'roleta' && !p.jogador) continue; // só o jogador usa a roleta
        if (ESTA_RODANDO(p.carro)) continue;
        if (!pontosDoCarro(p.carro).some(([x, y]) => Math.hypot(x - b.x, y - b.y) < RAIO_BONUS)) continue;
        if (b.tipo === 'turbo' && !p.jogador) p.carro.turboMs = TURBO_MS; // o jogador guarda e ativa com ESPAÇO
        else if (b.tipo === 'arco') p.carro.arcoMs = ARCO_MS;
        this.remover(b);
        this.aoEvento(b.tipo, p);
        break;
      }
    }

    // poças: derrapa e dá voltas
    for (const po of [...this.pocas]) {
      po.vida -= delta;
      if (this.sumiu(po.indice, po.vida, jogador)) {
        this.remover(po);
        continue;
      }
      for (const p of pilotos) {
        const c = p.carro;
        if (ESTA_RODANDO(c) || (c.imuneMs ?? 0) > 0 || (c.arcoMs ?? 0) > 0) continue;
        const dx = c.x - po.x, dy = c.y - po.y;
        const lx = dx * Math.cos(-po.ang) - dy * Math.sin(-po.ang);
        const ly = dx * Math.sin(-po.ang) + dy * Math.cos(-po.ang);
        if ((lx / POCA_RX) ** 2 + (ly / POCA_RY) ** 2 >= 1 || Math.hypot(c.vx, c.vy) < 40) continue;
        rodar(c, Math.random() < 0.5 ? -1 : 1, 0.6);
        this.aoEvento('poca', p);
      }
    }

    this.atualizarVaca(dt, delta, pilotos, jogador);
    this.atualizarMeteoro(delta, tempo, pilotos, jogador);
  }

  // ---- surgimento aleatório -----------------------------------------------------------------------------------------

  /** Passou da hora ou ficou muito para trás do jogador? */
  private sumiu(indice: number, vida: number, jogador: Piloto | undefined): boolean {
    if (vida <= 0) return true;
    if (!jogador) return false;
    const n = this.pista.amostras.length;
    const atras = (((jogador.indice - indice) % n) + n) % n; // amostras que o item ficou atrás do jogador
    return atras > 4 && atras < n / 2 && atras * 4 > ATRAS_MAX_PX;
  }

  private remover(item: Bonus | Poca): void {
    item.sprite.destroy();
    this.bonus = this.bonus.filter((b) => b !== item);
    this.pocas = this.pocas.filter((p) => p !== item);
  }

  /** De tempos em tempos põe um item novo na pista, à frente do jogador, em lugar e faixa sorteados. */
  private sortearItem(delta: number, jogador: Piloto | undefined): void {
    this.proximoItem -= delta;
    if (this.proximoItem > 0 || !jogador) return;
    this.proximoItem = aleat(INTERVALO_ITEM_MS[0], INTERVALO_ITEM_MS[1]);
    if (this.bonus.length + this.pocas.length >= ITENS_MAX) return;
    const am = this.pista.amostras;
    const tipo = tipoSorteado(Math.random());
    const idx = (jogador.indice + Math.round(aleat(DISTANCIA_ITEM_PX[0], DISTANCIA_ITEM_PX[1]) / 4)) % am.length;
    const a = am[idx]!;
    const [nx, ny] = normal(a);
    const lim = this.pista.def.largura / 2 - 20;
    const lateral = aleat(-lim, lim);
    const x = Math.round(a.x + nx * lateral), y = Math.round(a.y + ny * lateral);
    if (tipo === 'poca') {
      const sprite = this.scene.add.image(x, y, 'poca').setDepth(0.3).setRotation(a.ang);
      this.pocas.push({ x, y, ang: a.ang, sprite, indice: idx, vida: VIDA_ITEM_MS });
    } else {
      const sprite = this.scene.add.image(x, y, tipo, 0);
      this.bonus.push({ tipo, x, y, sprite, indice: idx, vida: VIDA_ITEM_MS });
    }
  }

  // ---- vaca ----------------------------------------------------------------------------------------------------------

  private atualizarVaca(dt: number, delta: number, pilotos: readonly Piloto[], jogador: Piloto | undefined): void {
    const am = this.pista.amostras;
    if (!this.vaca) {
      this.proximaVaca -= delta;
      if (this.proximaVaca > 0 || !jogador) return;
      // aparece na beira da pista, uns 700 px à frente do jogador, e atravessa
      const a = am[(jogador.indice + 175) % am.length]!;
      const [nx, ny] = normal(a);
      const lado = Math.random() < 0.5 ? -1 : 1;
      const meio = this.pista.def.largura / 2 + 36;
      const x = a.x + nx * meio * lado, y = a.y + ny * meio * lado;
      const dx = -nx * lado, dy = -ny * lado;
      const sprite = this.scene.add.image(Math.round(x), Math.round(y), 'vaca_lado');
      const sombra = this.scene.add.image(Math.round(x), Math.round(y), 'vaca_lado').setTint(0x000000).setAlpha(0.3).setDepth(0.4);
      this.vaca = { x, y, dx, dy, restante: ((meio * 2) / VACA_VEL) * 1000, sprite, sombra };
      return;
    }
    const v = this.vaca;
    v.x += v.dx * VACA_VEL * dt;
    v.y += v.dy * VACA_VEL * dt;
    v.restante -= delta;
    // arte da vaca em 3 ângulos (de lado, diagonal e de frente): escolhe pelo sentido em que ela anda na tela e espelha
    // quando vai para a esquerda; indo para cima (não há vista de costas) usa a de lado
    const { chave, espelha } = visualDaVaca(Math.atan2(v.dy, v.dx) + this.rot);
    v.sprite.setTexture(chave).setFlipX(espelha).setPosition(Math.round(v.x), Math.round(v.y)).setDepth(1 + Math.round(v.y)).setRotation(-this.rot);
    v.sombra.setTexture(chave).setFlipX(espelha).setRotation(-this.rot)
      .setPosition(Math.round(v.x + 2 * Math.cos(this.rot) + 3 * Math.sin(this.rot)), Math.round(v.y + 3 * Math.cos(this.rot) - 2 * Math.sin(this.rot)));
    for (const p of pilotos) {
      const c = p.carro;
      if (ESTA_RODANDO(c) || (c.imuneMs ?? 0) > 0) continue;
      if (!pontosDoCarro(c).some(([x, y]) => Math.hypot(x - v.x, y - v.y) < VACA_RAIO + 9)) continue;
      // coice: joga o carro para o lado em que a vaca anda (para fora da pista) e ele rodopia
      c.vx = v.dx * 450 + c.vx * 0.2; // era 300 (x1,5 com as velocidades)
      c.vy = v.dy * 450 + c.vy * 0.2;
      rodar(c, Math.random() < 0.5 ? -1 : 1, 0.8);
      this.aoEvento('vaca', p);
    }
    if (v.restante <= 0) {
      v.sprite.destroy();
      v.sombra.destroy();
      this.vaca = null;
      this.proximaVaca = aleat(20000, 42000);
    }
  }

  // ---- meteoro -------------------------------------------------------------------------------------------------------

  private atualizarMeteoro(delta: number, tempo: number, pilotos: readonly Piloto[], jogador: Piloto | undefined): void {
    const am = this.pista.amostras;
    if (!this.meteoro) {
      this.proximoMeteoro -= delta;
      if (this.proximoMeteoro > 0 || !jogador) return;
      // cai onde o jogador estará daqui a ~2 s, na mesma faixa em que ele está agora
      const c = jogador.carro;
      const adiante = Math.round((Math.hypot(c.vx, c.vy) * (METEORO_MS / 1000)) / 4);
      const a = am[(jogador.indice + Math.max(20, adiante)) % am.length]!;
      const [nx, ny] = normal(a);
      const atual = am[jogador.indice]!;
      const lat = Math.max(-34, Math.min(34, (c.x - atual.x) * -Math.sin(atual.ang) + (c.y - atual.y) * Math.cos(atual.ang)));
      const x = Math.round(a.x + nx * lat), y = Math.round(a.y + ny * lat);
      const sombra = this.scene.add.image(x, y, 'sombra').setDepth(0.5).setScale(0.25).setAlpha(0.25);
      const rocha = this.scene.add.image(x, y - 300, 'meteoro', 0).setDepth(5000);
      this.meteoro = { x, y, t: 0, sombra, rocha };
      return;
    }
    const m = this.meteoro;
    m.t += delta;
    const k = Math.min(1, m.t / METEORO_MS);
    m.sombra.setScale(0.25 + 0.75 * k).setAlpha(0.25 + 0.3 * k);
    // a pedra cai pelo alto da tela (com a câmera girada, "para cima" muda no mundo)
    const h = 300 * (1 - k) * (1 - k);
    m.rocha.setPosition(Math.round(m.x - h * Math.sin(this.rot)), Math.round(m.y - h * Math.cos(this.rot))).setRotation(-this.rot);
    if (k < 1) return;

    // impacto: quem está perto é jogado para fora e reaparece na pista depois de 2 s
    for (const p of pilotos) {
      const c = p.carro;
      if (!pontosDoCarro(c).some(([x, y]) => Math.hypot(x - m.x, y - m.y) < METEORO_RAIO)) continue;
      let dx = c.x - m.x, dy = c.y - m.y;
      const d = Math.hypot(dx, dy);
      if (d < 1) {
        const ang = Math.random() * Math.PI * 2;
        dx = Math.cos(ang);
        dy = Math.sin(ang);
      } else {
        dx /= d;
        dy /= d;
      }
      c.vx = dx * 340;
      c.vy = dy * 340;
      rodar(c, Math.random() < 0.5 ? -1 : 1, 1, 2000);
      c.reaparecer = true;
      this.aoEvento('meteoro', p);
    }
    const onda = this.scene.add.image(m.x, m.y, 'sombra').setDepth(4000).setTint(0xffb02e).setScale(0.6).setAlpha(0.8);
    this.scene.tweens.add({ targets: onda, scale: 1.8, alpha: 0, duration: 350, onComplete: () => onda.destroy() });
    this.scene.cameras.main.shake(220, 0.006);
    m.sombra.destroy();
    m.rocha.destroy();
    this.meteoro = null;
    this.proximoMeteoro = aleat(33000, 53000);
    void tempo;
  }
}

/** Qual desenho da vaca usar para o sentido `ang` (radianos, na tela: 0 = direita, π/2 = para baixo). */
export function visualDaVaca(ang: number): { chave: string; espelha: boolean } {
  const g = ((((ang * 180) / Math.PI) % 360) + 540) % 360 - 180; // -180..180
  const a = Math.abs(g);
  if (g > 0 && a > 22.5 && a <= 67.5) return { chave: 'vaca_diagonal', espelha: false };
  if (g > 0 && a > 67.5 && a <= 112.5) return { chave: 'vaca_frente', espelha: false };
  if (g > 0 && a > 112.5 && a <= 157.5) return { chave: 'vaca_diagonal', espelha: true };
  return { chave: 'vaca_lado', espelha: a > 90 };
}
