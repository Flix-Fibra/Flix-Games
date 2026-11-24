/**
 * Regras do G12 (corrida top-down): geometria da pista, física do carro e contagem de voltas.
 * Nada aqui depende do Phaser nem do navegador, para poder ser testado.
 */

export type Pt = readonly [number, number];

export interface Amostra {
  x: number;
  y: number;
  /** Ângulo (rad) da direção da pista neste ponto. */
  ang: number;
}

/** Espaço (px) entre as amostras da linha central. */
export const PASSO_AMOSTRA = 4;

/** Linha central fechada (Catmull-Rom uniforme) reamostrada a cada `PASSO_AMOSTRA` px. */
export function amostrarPista(pontos: readonly Pt[], passo = PASSO_AMOSTRA): Amostra[] {
  const n = pontos.length;
  const p = (i: number): Pt => pontos[((i % n) + n) % n]!;
  // 1) curva densa
  const densos: Array<[number, number]> = [];
  const sub = 24;
  for (let i = 0; i < n; i++) {
    const p0 = p(i - 1), p1 = p(i), p2 = p(i + 1), p3 = p(i + 2);
    for (let s = 0; s < sub; s++) {
      const t = s / sub, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      densos.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  // 2) reamostra por comprimento de arco
  const m = densos.length;
  const out: Amostra[] = [];
  let acum = 0;
  let prox = 0;
  for (let i = 0; i < m; i++) {
    const a = densos[i]!, b = densos[(i + 1) % m]!;
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    while (prox <= acum + seg && seg > 0) {
      const t = (prox - acum) / seg;
      out.push({ x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, ang: 0 });
      prox += passo;
    }
    acum += seg;
  }
  for (let i = 0; i < out.length; i++) {
    const a = out[i]!, b = out[(i + 1) % out.length]!;
    a.ang = Math.atan2(b.y - a.y, b.x - a.x);
  }
  return out;
}

export function comprimentoPista(amostras: readonly Amostra[], passo = PASSO_AMOSTRA): number {
  return amostras.length * passo;
}

/** Índice da amostra mais próxima de (x, y), procurando só perto de `desde` (a pista pode se cruzar). */
export function amostraMaisProxima(amostras: readonly Amostra[], x: number, y: number, desde: number, janela = 40): number {
  const n = amostras.length;
  let melhor = desde;
  let dMelhor = Infinity;
  for (let k = -janela; k <= janela; k++) {
    const i = (((desde + k) % n) + n) % n;
    const a = amostras[i]!;
    const d = (a.x - x) ** 2 + (a.y - y) ** 2;
    if (d < dMelhor) {
      dMelhor = d;
      melhor = i;
    }
  }
  return melhor;
}

// ---- carro ------------------------------------------------------------------------------------------------------

export type Superficie = 'asfalto' | 'zebra' | 'areia' | 'grama';

export const FISICA = {
  /** Velocidade máxima (px/s) em cada superfície. */
  // 23/11/2026: velocidades x1,5 para todos (pista de 190 px e câmera afastada deixaram o jogo lento na tela);
  // antes: asfalto 146, zebra 130, areia 68, grama 57, acel 150, freio 247, arrasto 156, vGiro 65
  vmax: { asfalto: 219, zebra: 195, areia: 102, grama: 86 } as Record<Superficie, number>,
  /** Aceleração (px/s²). */
  acel: 225,
  freio: 370,
  /** Resistência quando solta o acelerador ou passa do limite da superfície (px/s²). */
  arrasto: 234,
  /** Giro máximo (rad/s), alcançado a partir de `vGiro` px/s. */
  giroMax: 3.4, // era 2.7 (subiu com a velocidade de corrida, 210 -> 260 px/s, para a curva não ficar pesada)
  vGiro: 98,
  /** Quão rápido a velocidade lateral some (1/s): menor = derrapa mais. */
  aderencia: { asfalto: 8.5, zebra: 7, areia: 2.6, grama: 2.2 } as Record<Superficie, number>,
};

/** O teto de velocidade no asfalto começa em VEL_INICIAL e sobe em linha reta até VEL_FINAL em 3 s de corrida. */
export const VEL_INICIAL = 219; // = FISICA.vmax.asfalto
export const VEL_FINAL = 390; // era 260 (x1,5 em 23/11/2026)
export const RAMPA_MS = 3000;

/** A cada volta completada, o teto de velocidade de todos os carros sobe mais 45 px/s (era 30). */
export const ACRESCIMO_POR_VOLTA = 45;

/** Multiplicador do teto de velocidade: 1 na largada, VEL_FINAL/VEL_INICIAL depois de `RAMPA_MS`, e +ACRESCIMO_POR_VOLTA px/s por volta completada. */
export function fatorTeto(tempoCorridaMs: number, voltasCompletas = 0): number {
  const t = Math.min(1, Math.max(0, tempoCorridaMs / RAMPA_MS));
  return 1 + (VEL_FINAL / VEL_INICIAL - 1) * t + (Math.max(0, voltasCompletas) * ACRESCIMO_POR_VOLTA) / VEL_INICIAL;
}

export interface Carro {
  x: number;
  y: number;
  ang: number;
  vx: number;
  vy: number;
  /** Rodopio (batida): ms que faltam e velocidade de giro (rad/s). Sem controle enquanto rodopia. */
  rodaMs?: number;
  w?: number;
  /** Depois de rodar, fica ms sem poder rodar de novo (evita sequência de batidas). */
  imuneMs?: number;
  /** Turbo: ms restantes (+30% de velocidade e arrancada forte). */
  turboMs?: number;
  /** Arco-íris: ms restantes (sem colisão com outros carros). */
  arcoMs?: number;
  /** Depois do rodopio, volta para a pista (meteoro). */
  reaparecer?: boolean;
}

export const TURBO_FATOR = 1.3;
export const TURBO_MS = 4000;
export const ARCO_MS = 6000;

export const ESTA_RODANDO = (c: Carro): boolean => (c.rodaMs ?? 0) > 0;

/** Põe o carro para rodopiar e deslizar até quase parar. `intensidade` (0 a 1): giro mais violento e mais longo. */
export function rodar(c: Carro, lado: number, intensidade: number, ms?: number): void {
  const k = Math.max(0, Math.min(1, intensidade));
  c.w = (lado >= 0 ? 1 : -1) * (6 + 6 * k);
  c.rodaMs = ms ?? 1300 + 1200 * k;
}

export interface Comando {
  /** -1 (esquerda) a 1 (direita). */
  giro: number;
  /** true = freia. */
  freio: boolean;
  /**
   * Acelerador do jogador (↑/W ou pedal na tela). Solto (false), o carro perde velocidade aos poucos (`SOLTO`).
   * Ausente = acelera sozinho (rivais e piloto automático).
   */
  acelera?: boolean;
}

/** Desaceleração com o acelerador solto, em fração do arrasto (bem mais suave que o freio). */
export const SOLTO = 0.5;

export function velocidade(c: Carro): number {
  return Math.hypot(c.vx, c.vy);
}

/** Avança o carro `dt` segundos. */
export function andarCarro(c: Carro, cmd: Comando, sup: Superficie, dt: number, teto = 1): void {
  if ((c.imuneMs ?? 0) > 0) c.imuneMs = Math.max(0, (c.imuneMs ?? 0) - dt * 1000);
  if ((c.turboMs ?? 0) > 0) c.turboMs = Math.max(0, (c.turboMs ?? 0) - dt * 1000);
  if ((c.arcoMs ?? 0) > 0) c.arcoMs = Math.max(0, (c.arcoMs ?? 0) - dt * 1000);
  const turbo = (c.turboMs ?? 0) > 0;
  if ((c.rodaMs ?? 0) > 0) {
    // rodopio: sem controle; o carro desliza na direção em que ia, perdendo velocidade (mais na grama e na areia)
    c.rodaMs = (c.rodaMs ?? 0) - dt * 1000;
    c.ang += (c.w ?? 0) * dt;
    c.w = (c.w ?? 0) * Math.exp(-0.7 * dt);
    const atrito = Math.exp(-(sup === 'asfalto' || sup === 'zebra' ? 1.5 : 2.6) * dt);
    c.vx *= atrito;
    c.vy *= atrito;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    if (c.rodaMs <= 0) {
      c.rodaMs = 0;
      c.w = 0;
      c.vx *= 0.2;
      c.vy *= 0.2;
      c.imuneMs = 1500;
    }
    return;
  }
  const fx = Math.cos(c.ang), fy = Math.sin(c.ang);
  let frente = c.vx * fx + c.vy * fy; // velocidade ao longo do carro
  let lado = -c.vx * fy + c.vy * fx; // velocidade de lado (derrapagem)

  const vmax = FISICA.vmax[sup] * teto * (turbo ? TURBO_FATOR : 1);
  if (cmd.freio) frente = Math.max(0, frente - FISICA.freio * dt);
  else if (cmd.acelera === false) frente = Math.max(0, frente - FISICA.arrasto * SOLTO * dt);
  else if (frente > vmax) frente = Math.max(vmax, frente - FISICA.arrasto * dt);
  else frente = Math.min(vmax, frente + FISICA.acel * (turbo ? 2.5 : 1) * dt);

  lado *= Math.exp(-FISICA.aderencia[sup] * dt);

  // giro cresce com a velocidade; no vagar o carro quase não vira
  const eficacia = Math.min(1, Math.abs(frente) / FISICA.vGiro);
  c.ang += cmd.giro * FISICA.giroMax * eficacia * dt;

  const nx = Math.cos(c.ang), ny = Math.sin(c.ang);
  c.vx = nx * frente - ny * lado;
  c.vy = ny * frente + nx * lado;
  c.x += c.vx * dt;
  c.y += c.vy * dt;
}

// ---- voltas ------------------------------------------------------------------------------------------------------

/**
 * Conta voltas pelo avanço ao longo da linha central. Só vale a volta quando o carro passou por todos os
 * quartos da pista na ordem (não dá para ganhar volta indo e voltando na linha de largada).
 */
export class Voltas {
  private ultimo = 0;
  private quarto = 0; // maior quarto já visitado nesta volta (0..3)
  voltas = 0;
  /** Tempo (ms) desde o início da volta atual. */
  tempo = 0;
  melhor: number | null = null;
  ultimaVolta: number | null = null;

  constructor(private readonly total: number) {}

  /** Depois de um teletransporte: recalcula em que quarto da pista o carro está (antes da largada = nenhum). */
  ajustar(indice: number, antesDaLargada: boolean): void {
    this.ultimo = indice;
    this.quarto = antesDaLargada ? 0 : Math.min(3, Math.floor((indice / this.total) * 4));
  }

  atualizar(indice: number, dtMs: number): boolean {
    this.tempo += dtMs;
    const q = Math.floor((indice / this.total) * 4);
    if (q === this.quarto + 1) this.quarto = q;
    let fechou = false;
    const cruzou = this.ultimo > this.total * 0.75 && indice < this.total * 0.25;
    if (cruzou && this.quarto === 3) {
      this.voltas++;
      this.ultimaVolta = this.tempo;
      if (this.melhor === null || this.tempo < this.melhor) this.melhor = this.tempo;
      this.tempo = 0;
      this.quarto = 0;
      fechou = true;
    }
    this.ultimo = indice;
    return fechou;
  }
}

export function formatarTempo(ms: number): string {
  const t = Math.max(0, Math.floor(ms));
  const m = Math.floor(t / 60000);
  const s = Math.floor((t % 60000) / 1000);
  const c = Math.floor((t % 1000) / 10);
  return `${m}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
}

// ---- adversários -------------------------------------------------------------------------------------------------

const volta = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Piloto automático: mira num ponto da linha central à frente (mais longe quanto mais rápido), deslocado de
 * `lateral` px para o lado (cada adversário tem a sua faixa), e freia antes de curva fechada.
 */
export function controlarIA(c: Carro, am: readonly Amostra[], indice: number, lateral: number): Comando {
  const n = am.length;
  const v = velocidade(c);
  const olhar = Math.round(6 + v / 14);
  const alvo = am[(indice + olhar) % n]!;
  const tx = alvo.x - Math.sin(alvo.ang) * lateral;
  const ty = alvo.y + Math.cos(alvo.ang) * lateral;
  const diff = volta(Math.atan2(ty - c.y, tx - c.x) - c.ang);
  const adiante = Math.abs(volta(am[(indice + olhar * 3) % n]!.ang - am[indice]!.ang));
  return {
    giro: Math.max(-1, Math.min(1, diff * 2.5)),
    freio: (Math.abs(diff) > 0.8 && v > 165) || (adiante > 1.1 && v > 263), // eram 110 e 175 (x1,5 com as velocidades)
  };
}

/** O carro é uma cápsula: dois círculos (frente e traseira) a `CAPSULA` px do centro, no sentido em que aponta. */
export const CAPSULA = 11;

export interface Contato {
  /** Normal do choque, de `a` para `b`. */
  nx: number;
  ny: number;
  /** Quanto os círculos se penetram (px). */
  prof: number;
}

/** Contato entre as cápsulas de dois carros (círculos de raio `raio`); null se não se tocam. */
export function contato(a: Carro, b: Carro, raio: number): Contato | null {
  const pts = (c: Carro): Array<[number, number]> => [
    [c.x + Math.cos(c.ang) * CAPSULA, c.y + Math.sin(c.ang) * CAPSULA],
    [c.x - Math.cos(c.ang) * CAPSULA, c.y - Math.sin(c.ang) * CAPSULA],
  ];
  let melhor: Contato | null = null;
  for (const p of pts(a)) {
    for (const q of pts(b)) {
      const dx = q[0] - p[0], dy = q[1] - p[1];
      const d = Math.hypot(dx, dy);
      if (d >= raio * 2) continue;
      const prof = raio * 2 - d;
      if (melhor && prof <= melhor.prof) continue;
      let nx = d > 0 ? dx / d : 1, ny = d > 0 ? dy / d : 0;
      if (nx * (b.x - a.x) + ny * (b.y - a.y) < 0) {
        nx = -nx;
        ny = -ny;
      }
      melhor = { nx, ny, prof };
    }
  }
  return melhor;
}

/** Afasta dois carros que se sobrepõem e tira um pouco da velocidade da batida. */
export function separar(a: Carro, b: Carro, raio: number): boolean {
  const ct = contato(a, b, raio);
  if (!ct) return false;
  const { nx, ny } = ct;
  const folga = ct.prof / 2 + 0.01;
  a.x -= nx * folga;
  a.y -= ny * folga;
  b.x += nx * folga;
  b.y += ny * folga;
  for (const c of [a, b]) {
    const sentido = c === a ? 1 : -1;
    const vn = c.vx * nx + c.vy * ny; // velocidade na direção da batida
    if (vn * sentido > 0) {
      c.vx -= nx * vn * 0.6;
      c.vy -= ny * vn * 0.6;
    }
  }
  return true;
}

/** Progresso acumulado ao longo da pista (para a classificação). Começa antes da linha de largada (volta -1). */
export class Progresso {
  private ultimo: number;
  private voltas = -1;
  constructor(private readonly total: number, indiceInicial: number) {
    this.ultimo = indiceInicial;
  }
  atualizar(indice: number): number {
    if (this.ultimo > this.total * 0.75 && indice < this.total * 0.25) this.voltas++;
    else if (this.ultimo < this.total * 0.25 && indice > this.total * 0.75) this.voltas--;
    this.ultimo = indice;
    return this.valor();
  }
  valor(): number {
    return this.voltas * this.total + this.ultimo;
  }
  /** Põe o carro num progresso (em amostras) qualquer, por exemplo depois de um teletransporte. */
  definir(valor: number): void {
    this.voltas = Math.floor(valor / this.total);
    this.ultimo = valor - this.voltas * this.total;
  }
}

// ---- batidas e disputa ---------------------------------------------------------------------------------------------

/** Fechamento mínimo (px/s) para a batida por trás fazer o atacante deslizar. */
export const LIMITE_BATIDA = 60; // era 40 (x1,5 com as velocidades, 23/11/2026)

export interface Batida {
  atacante: Carro;
  vitima: Carro;
  /** Velocidade (px/s) com que um fechou sobre o outro. */
  fechamento: number;
}

/**
 * Trata o choque de dois carros (círculos de raio `raio`): afasta, e se o fechamento for forte o carro que bateu
 * por trás (o atacante) rodopia e desliza; a vítima não rodopia, a não ser que o atacante seja `agressor` (golpe
 * de propósito, que o jogador sofre de vez em quando). Quem acabou de rodar fica imune por um tempo. Devolve a batida, ou null se não houve choque.
 */
export function batida(a: Carro, b: Carro, raio: number, agressor?: Carro): Batida | null {
  // carro rodopiando fica sem física de colisão: os outros passam por ele
  if (ESTA_RODANDO(a) || ESTA_RODANDO(b)) return null;
  // arco-íris: sem física entre carros
  if ((a.arcoMs ?? 0) > 0 || (b.arcoMs ?? 0) > 0) return null;
  const ct = contato(a, b, raio);
  if (!ct) return null;
  const { nx, ny } = ct;
  const fechamento = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  // quem vinha mais "para cima" do outro é o atacante
  const empurraA = a.vx * nx + a.vy * ny;
  const empurraB = -(b.vx * nx + b.vy * ny);
  const atacante = agressor ?? (empurraA >= empurraB ? a : b);
  const vitima = atacante === a ? b : a;
  separar(a, b, raio);
  if (fechamento <= 0) return { atacante, vitima, fechamento };

  const livre = (c: Carro): boolean => !ESTA_RODANDO(c) && (c.imuneMs ?? 0) <= 0;
  const lado = Math.sign(-ny * Math.cos(vitima.ang) + nx * Math.sin(vitima.ang)) || 1;
  if (agressor !== undefined) {
    // golpe de propósito: a vítima rodopia forte; o atacante só leva um tranco
    if (livre(vitima)) rodar(vitima, lado, 0.9);
    atacante.vx *= 0.7;
    atacante.vy *= 0.7;
  } else {
    // regra: quem bate por trás é quem desliza; quem foi atingido segue (só é empurrado)
    if (fechamento > LIMITE_BATIDA && livre(atacante)) rodar(atacante, -lado, Math.min(1, fechamento / 220));
  }
  return { atacante, vitima, fechamento };
}

/** Quanto os rivais aceleram a mais quando o jogador lidera e eles ficaram muito atrás (gap em px). 1 = nada. */
export const FOLGA_SEM_REFORCO = 350;
export const REFORCO_MAX = 0.22;
export function reforcoRival(gapPx: number): number {
  if (gapPx <= FOLGA_SEM_REFORCO) return 1;
  return 1 + REFORCO_MAX * Math.min(1, (gapPx - FOLGA_SEM_REFORCO) / 1000);
}

/** Comando para ir direto num ponto (usado pelo rival que vai bater no jogador de propósito). */
export function apontar(c: Carro, x: number, y: number): Comando {
  const diff = volta(Math.atan2(y - c.y, x - c.x) - c.ang);
  return { giro: Math.max(-1, Math.min(1, diff * 3)), freio: false };
}

/**
 * Desvio entre rivais: se há outro carro logo à frente na mesma faixa, muda de faixa para o lado oposto e, se está
 * chegando rápido demais, freia. Devolve a faixa (`lateral`) e se deve frear.
 */
export function evitar(c: Carro, outros: readonly Carro[], lateralBase: number): { lateral: number; freio: boolean } {
  const cs = Math.cos(c.ang), sn = Math.sin(c.ang);
  let perto: { fwd: number; side: number; o: Carro } | null = null;
  for (const o of outros) {
    if (o === c) continue;
    const dx = o.x - c.x, dy = o.y - c.y;
    const fwd = dx * cs + dy * sn;
    const side = -dx * sn + dy * cs;
    if (fwd > 0 && fwd < 85 && Math.abs(side) < 22 && (!perto || fwd < perto.fwd)) perto = { fwd, side, o };
  }
  if (!perto) return { lateral: lateralBase, freio: false };
  const lateral = Math.max(-30, Math.min(30, lateralBase + (perto.side > 0 ? -24 : 24)));
  return { lateral, freio: perto.fwd < 50 && velocidade(c) > velocidade(perto.o) + 8 };
}

// ---- campeonato --------------------------------------------------------------------------------------------------

/** O jogador só passa para a próxima pista ficando entre os primeiros. */
export const LIMITE_CLASSIFICACAO = 6;
export const classificou = (posicao: number): boolean => posicao <= LIMITE_CLASSIFICACAO;

/** Ordem aleatória das pistas (embaralhamento de Fisher-Yates): devolve uma permutação de 0..n-1. */
export function embaralhar(n: number, aleatorio: () => number = Math.random): number[] {
  const v = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [v[i], v[j]] = [v[j]!, v[i]!];
  }
  return v;
}

/**
 * Qual a próxima etapa: avança se o jogador se classificou, senão repete a mesma pista. Passando da última, o
 * campeonato termina (devolve `null`).
 */
export function proximaEtapa(etapa: number, total: number, posicao: number): number | null {
  if (!classificou(posicao)) return etapa;
  return etapa + 1 < total ? etapa + 1 : null;
}
