/**
 * Regras puras de movimento e colisão (sem Phaser), usadas pelo jogo e pelos testes.
 * Unidades: pixels do mundo e segundos; o jogo avança em passos fixos de 1/60 s.
 */
import { LINKS, ROOMS, type LinkDef, type RoomDef } from './levels';

export const T = 16;
export const DT = 1 / 60;

export const ANDAR = 96; // 6 tiles/s
export const GRAVIDADE = 900;
export const PULO = 300; // sobe ~50 px (3 tiles) e anda 4 tiles no ar
export const PULO_CORTADO = 150; // soltar o botão cedo: pulo baixo
export const QUEDA_MAX = 360;
export const ESCADA = 64; // 4 tiles/s
export const COYOTE = 6;
export const BUFFER = 6;
export const LARGURA = 10;
export const ALTURA = 28;

export interface Entrada {
  esq: boolean;
  dir: boolean;
  cima: boolean;
  baixo: boolean;
  pulo: boolean;
  /** true só no passo em que o botão foi apertado */
  puloApertado: boolean;
}

export const SEM_ENTRADA: Entrada = { esq: false, dir: false, cima: false, baixo: false, pulo: false, puloApertado: false };

/** x = centro, y = pés. */
export interface Corpo {
  x: number;
  y: number;
  vx: number;
  vy: number;
  lado: 1 | -1;
  noChao: boolean;
  naEscada: boolean;
  coyote: number;
  buffer: number;
  pulando: boolean;
  /** preso no cabo: âncora, comprimento (atual e desejado), ângulo a partir da vertical e velocidade angular */
  cabo: { ax: number; ay: number; l: number; alvo: number; ang: number; w: number } | null;
  /** velocidade horizontal herdada do balanço, até pousar */
  impulso: number;
  /** passos até poder agarrar de novo */
  folga: number;
  /** já usou o pulo extra desde a última vez no chão */
  repicou: boolean;
}

export function novoCorpo(x: number, y: number): Corpo {
  return { x, y, vx: 0, vy: 0, lado: 1, noChao: false, naEscada: false, coyote: 0, buffer: 0, pulando: false, cabo: null, impulso: 0, folga: 0, repicou: false };
}

export function sala(id: string): RoomDef {
  const s = ROOMS.find((r) => r.id === id);
  if (!s) throw new Error(`sala desconhecida: ${id}`);
  return s;
}

export const letra = (s: RoomDef, col: number, lin: number): string => s.tiles[lin]?.[col] ?? '#';
export const solido = (s: RoomDef, col: number, lin: number): boolean => {
  const c = letra(s, col, lin);
  return c === '#' || c === 'X' || c === 'A';
};
export const escada = (s: RoomDef, col: number, lin: number): boolean => s.tiles[lin]?.[col] === 'H';
/** Topo de escada e plataforma vazada: seguram quem cai de cima, deixam passar por baixo. */
const vazada = (s: RoomDef, col: number, lin: number): boolean =>
  letra(s, col, lin) === '=' || (escada(s, col, lin) && !escada(s, col, lin - 1));

const colunas = (x: number, w: number): [number, number] => [Math.floor((x - w / 2) / T), Math.floor((x + w / 2 - 0.001) / T)];

export function cabe(s: RoomDef, x: number, y: number, w = LARGURA, h = ALTURA): boolean {
  const [c0, c1] = colunas(x, w);
  for (let l = Math.floor((y - h) / T); l <= Math.floor((y - 0.001) / T); l++)
    for (let c = c0; c <= c1; c++) if (solido(s, c, l)) return false;
  return true;
}

/** Move na horizontal, encostando na parede. Devolve true se bateu. */
export function moverX(s: RoomDef, c: { x: number; y: number }, dx: number, w = LARGURA, h = ALTURA): boolean {
  if (dx === 0) return false;
  const nx = c.x + dx;
  if (cabe(s, nx, c.y, w, h)) {
    c.x = nx;
    return false;
  }
  const borda = dx > 0 ? Math.floor((nx + w / 2) / T) * T - w / 2 : Math.ceil((nx - w / 2) / T) * T + w / 2;
  if (cabe(s, borda, c.y, w, h)) c.x = borda;
  return true;
}

/** Move na vertical. Devolve 'chao', 'teto' ou null. */
export function moverY(
  s: RoomDef, c: { x: number; y: number }, dy: number, descendoEscada = false, h = ALTURA,
): 'chao' | 'teto' | null {
  const [c0, c1] = colunas(c.x, LARGURA);
  const ny = c.y + dy;
  if (dy > 0) {
    for (let l = Math.ceil((c.y - 0.001) / T); l * T <= ny; l++) {
      for (let col = c0; col <= c1; col++) {
        if (solido(s, col, l) || (!descendoEscada && vazada(s, col, l))) {
          c.y = l * T;
          return 'chao';
        }
      }
    }
  } else if (dy < 0) {
    if (!cabe(s, c.x, ny, LARGURA, h)) {
      c.y = Math.ceil((ny - h) / T) * T + h;
      return 'teto';
    }
  }
  c.y = ny;
  return null;
}

/** Coluna de escada que o corpo consegue agarrar (centro perto do meio do tile). */
function colunaEscada(s: RoomDef, c: Corpo, descendo: boolean): number | null {
  const col = Math.floor(c.x / T);
  if (Math.abs(c.x - (col + 0.5) * T) > 9) return null;
  const linhas = descendo ? [Math.floor((c.y + 1) / T)] : [Math.floor((c.y - 1) / T), Math.floor((c.y - ALTURA / 2) / T)];
  return linhas.some((l) => escada(s, col, l)) ? col : null;
}

/** Os pés estão só sobre plataforma vazada (nenhum chão firme segurando). */
function sobrePlataforma(s: RoomDef, c: { x: number; y: number }): boolean {
  const [c0, c1] = colunas(c.x, LARGURA);
  const lin = Math.round(c.y / T);
  let plataforma = false;
  for (let col = c0; col <= c1; col++) {
    if (solido(s, col, lin)) return false;
    if (letra(s, col, lin) === '=') plataforma = true;
  }
  return plataforma;
}

export interface Passo {
  pulou: boolean;
  pousou: boolean;
  agarrou: boolean;
}

export interface Habilidades {
  gancho: boolean;
  /** pulo extra no ar */
  repique?: boolean;
}

/** passos de cada metade do relógio (1,5 s) e do aviso antes da troca (0,5 s) */
export const RELOGIO = 90;
export const AVISO_RELOGIO = 30;
/** 0 = plataformas 'O' ligadas; 1 = plataformas 'o' ligadas */
export const faseRelogio = (passos: number): 0 | 1 => (Math.floor(passos / RELOGIO) % 2 ? 1 : 0);

/** A sala vista pela física numa das metades do relógio: a plataforma ligada segura como as outras vazadas. */
export function noRelogio(s: RoomDef, fase: 0 | 1): RoomDef {
  if (!s.tiles.some((l) => /[Oo]/.test(l))) return s;
  const ligada = fase ? 'o' : 'O';
  return { ...s, tiles: s.tiles.map((l) => l.replace(/[Oo]/g, (c) => (c === ligada ? '=' : ' '))) };
}

/** empurrão do ventilador desgovernado, para a esquerda (2 tiles/s) */
export const VENTO = 32;

/** Faixas sopradas pelos ventiladores da sala. */
export function ventos(s: RoomDef): { x0: number; x1: number; y0: number; y1: number }[] {
  let n = 0;
  return marcas(s, 'EB')
    .filter(() => s.enemies[n++] === 'cooler')
    .map((m) => {
      const x = (m.col + 0.5) * T;
      const y = (m.lin + 1) * T;
      return { x0: x - 190, x1: x, y0: y - 52, y1: y + 28 };
    });
}

export function soprar(s: RoomDef, faixas: ReturnType<typeof ventos>, c: Corpo): void {
  if (c.naEscada || c.cabo) return;
  if (faixas.some((f) => c.x > f.x0 && c.x < f.x1 && c.y > f.y0 && c.y - ALTURA / 2 < f.y1)) moverX(s, c, -VENTO * DT);
}

/** Alcance do cabo, do meio do corpo até a âncora (5 tiles e uma folga). */
export const ALCANCE_GANCHO = 92;
/** meio do corpo, onde o cabo prende */
const PEITO = 14;
/** amplitude mínima do balanço: garante que dá para atravessar sem pegar embalo */
const AMPLITUDE = 1.0;

/** Âncora mais próxima que dá para agarrar daqui (acima do corpo e dentro do alcance). */
export function ganchoAoAlcance(s: RoomDef, c: { x: number; y: number }): { ax: number; ay: number } | null {
  let melhor: { ax: number; ay: number } | null = null;
  let dist = ALCANCE_GANCHO;
  for (const m of marcas(s, 'G')) {
    const ax = (m.col + 0.5) * T;
    const ay = (m.lin + 0.5) * T;
    const d = Math.hypot(c.x - ax, c.y - PEITO - ay);
    if (d <= dist && c.y - PEITO > ay + 8) {
      dist = d;
      melhor = { ax, ay };
    }
  }
  return melhor;
}

function agarrar(s: RoomDef, c: Corpo, a: { ax: number; ay: number }): void {
  const dx = c.x - a.ax;
  const dy = c.y - PEITO - a.ay;
  const l = Math.hypot(dx, dy);
  // encurta o cabo o bastante para os pés não baterem no que houver embaixo da âncora
  const col = Math.floor(a.ax / T);
  let lin = Math.floor(a.ay / T) + 1;
  while (lin < s.height && !solido(s, col, lin) && letra(s, col, lin) !== '^') lin++;
  const alvo = Math.max(28, Math.min(56, lin * T - a.ay - PEITO - 8));
  const ang = Math.atan2(dx, dy);
  const falta = Math.cos(Math.min(Math.abs(ang), AMPLITUDE)) - Math.cos(AMPLITUDE);
  const minimo = Math.sqrt(Math.max(0, ((2 * GRAVIDADE) / alvo) * falta));
  c.cabo = { ...a, l, alvo, ang, w: c.lado * Math.max(minimo, 1) };
  c.repicou = false;
  c.vx = c.vy = 0;
  c.pulando = false;
  c.buffer = c.coyote = c.impulso = 0;
}

function soltar(c: Corpo): void {
  const k = c.cabo!;
  const dir = Math.abs(k.w) > 0.6 ? Math.sign(k.w) : c.lado;
  const vx = k.l * k.w * Math.cos(k.ang);
  const vy = -k.l * k.w * Math.sin(k.ang);
  // soltar dá um embalo extra (uns 2 tiles a mais)
  c.impulso = dir * Math.max(120, Math.min(190, Math.abs(vx)));
  c.vy = Math.max(-290, Math.min(0, vy) - 180);
  c.lado = dir > 0 ? 1 : -1;
  c.cabo = null;
  c.folga = 14;
}

function balancar(s: RoomDef, c: Corpo, e: Entrada, eixo: number): void {
  const k = c.cabo!;
  if (!e.pulo) {
    soltar(c);
    return;
  }
  k.l += Math.max(-90 * DT, Math.min(90 * DT, k.alvo - k.l));
  k.w += (-(GRAVIDADE / k.l) * Math.sin(k.ang) + eixo * 3) * DT;
  k.w = Math.max(-6, Math.min(6, k.w));
  let ang = k.ang + k.w * DT;
  if (Math.abs(ang) > 1.3) {
    ang = Math.sign(ang) * 1.3;
    k.w = 0;
  }
  const x = k.ax + k.l * Math.sin(ang);
  const y = k.ay + k.l * Math.cos(ang) + PEITO;
  if (cabe(s, x, y)) {
    k.ang = ang;
    c.x = x;
    c.y = y;
  } else k.w = -k.w * 0.6; // bateu na parede: volta
  if (Math.abs(k.w) > 0.3) c.lado = k.w > 0 ? 1 : -1;
}

/** Um passo (1/60 s) do corpo da heroína. */
export function passoCorpo(s: RoomDef, c: Corpo, e: Entrada, hab: Habilidades = { gancho: false }): Passo {
  const r: Passo = { pulou: false, pousou: false, agarrou: false };
  const eixo = (e.dir ? 1 : 0) - (e.esq ? 1 : 0);
  if (c.cabo) {
    balancar(s, c, e, eixo);
    return r;
  }
  if (eixo !== 0) c.lado = eixo > 0 ? 1 : -1;
  c.buffer = e.puloApertado ? BUFFER : Math.max(0, c.buffer - 1);
  if (c.folga > 0) c.folga--;
  // no ar, apertar o pulo perto de uma âncora lança o cabo (segurar para ficar pendurada)
  if (hab.gancho && e.puloApertado && !c.noChao && !c.naEscada && c.coyote === 0 && c.folga === 0) {
    const a = ganchoAoAlcance(s, c);
    if (a) {
      agarrar(s, c, a);
      r.agarrou = true;
      return r;
    }
  }
  // sem gancho por perto, o segundo aperto no ar vira o pulo extra
  if (hab.repique && e.puloApertado && !c.noChao && !c.naEscada && c.coyote === 0 && !c.repicou) {
    c.repicou = true;
    c.vy = -PULO;
    c.pulando = true;
    c.buffer = 0;
    r.pulou = true;
  }

  if (!c.naEscada && (e.cima || e.baixo)) {
    const descendo = e.baixo && !e.cima;
    const col = colunaEscada(s, c, descendo);
    if (col !== null && (!descendo || c.noChao)) {
      c.naEscada = true;
      c.x = (col + 0.5) * T;
      c.vx = c.vy = 0;
      c.pulando = false;
      c.repicou = false;
    }
  }

  if (c.naEscada) {
    c.noChao = false;
    c.coyote = 0;
    if (c.buffer > 0) {
      c.naEscada = false;
      c.buffer = 0;
      c.vy = -PULO * 0.75;
      c.pulando = true;
      r.pulou = true;
    } else if (eixo !== 0 && !e.cima && !e.baixo) {
      // sai para o lado; se houver um piso logo ali, sobe nele
      const piso = Math.round(c.y / T) * T;
      const colLado = Math.floor(c.x / T) + eixo;
      if (Math.abs(piso - c.y) <= 7 && solido(s, colLado, piso / T) && cabe(s, c.x + eixo * 8, piso)) c.y = piso;
      c.naEscada = false;
    } else {
      const col = Math.floor(c.x / T);
      let topo = Math.floor((c.y - 1) / T);
      while (escada(s, col, topo - 1)) topo--;
      const dy = ((e.baixo ? 1 : 0) - (e.cima ? 1 : 0)) * ESCADA * DT;
      if (dy < 0) {
        // para no topo da escada (onde dá para ficar em pé)
        const limite = escada(s, col, topo) ? topo * T : (topo + 1) * T;
        c.y = Math.max(limite, c.y + dy);
        if (c.y === limite) {
          c.naEscada = false;
          c.noChao = true;
          c.vy = 0;
        }
      } else if (dy > 0) {
        if (moverY(s, c, dy, true) === 'chao') {
          c.naEscada = false;
          c.noChao = true;
        } else if (!escada(s, col, Math.floor((c.y - 1) / T)) && !escada(s, col, Math.floor((c.y + 1) / T))) {
          c.naEscada = false;
        }
      }
      return r;
    }
    if (c.naEscada) return r;
  }

  // seta para baixo em cima de uma plataforma vazada: desce por ela (em chão firme não faz nada)
  if (c.noChao && e.baixo && !e.cima && sobrePlataforma(s, c)) {
    c.y += 1;
    c.noChao = false;
    c.coyote = 0;
  }

  if (c.impulso !== 0 && eixo * c.impulso < 0) c.impulso = 0;
  c.vx = c.impulso !== 0 ? c.impulso : eixo * ANDAR;
  if (c.buffer > 0 && (c.noChao || c.coyote > 0)) {
    c.vy = -PULO;
    c.pulando = true;
    c.noChao = false;
    c.coyote = 0;
    c.buffer = 0;
    r.pulou = true;
  }
  if (c.pulando && !e.pulo && c.vy < -PULO_CORTADO) c.vy = -PULO_CORTADO;

  if (moverX(s, c, c.vx * DT)) c.impulso = 0;
  const antes = c.noChao;
  // integra pela velocidade média: a altura do pulo não depende da taxa de passos
  const vy = Math.min(QUEDA_MAX, c.vy + GRAVIDADE * DT);
  const bateu = moverY(s, c, ((c.vy + vy) / 2) * DT);
  c.vy = vy;
  if (bateu === 'chao') {
    r.pousou = !antes && vy > 120;
    c.noChao = true;
    c.pulando = false;
    c.vy = 0;
    c.impulso = 0;
    c.repicou = false;
    c.coyote = COYOTE;
  } else {
    if (bateu === 'teto') c.vy = 0;
    c.noChao = false;
    if (c.coyote > 0) c.coyote--;
  }
  return r;
}

export interface Porta {
  col: number;
  lin: number;
  destino: string;
  destinoEm: [number, number];
  atalho: boolean;
}

/** Portas da sala (as ligações valem nos dois sentidos). */
export function portas(id: string): Porta[] {
  const out: Porta[] = [];
  for (const l of LINKS as LinkDef[]) {
    const atalho = !!l.atalho;
    if (l.from === id) out.push({ lin: l.at[0], col: l.at[1], destino: l.to, destinoEm: l.toAt, atalho });
    else if (l.to === id) out.push({ lin: l.toAt[0], col: l.toAt[1], destino: l.from, destinoEm: l.at, atalho });
  }
  return out;
}

/** Passagem no teto ou no piso, usada pela escada. */
export const vertical = (s: RoomDef, lin: number): boolean => lin === 0 || lin === s.height - 1;

/** A porta tem 1 tile; basta chegar perto dela pelo lado de dentro. Na escada, basta chegar ao teto ou entrar no piso. */
export function naPorta(s: RoomDef, c: { x: number; y: number; naEscada?: boolean }, p: Porta): boolean {
  if (vertical(s, p.lin)) {
    if (!c.naEscada || Math.floor(c.x / T) !== p.col) return false;
    return p.lin === 0 ? c.y <= 2 * T : c.y >= p.lin * T + 8;
  }
  const dentro = p.col === 0 ? c.x - LARGURA / 2 < T + 1 : c.x + LARGURA / 2 > (s.width - 1) * T - 1;
  return dentro && c.y > p.lin * T && c.y - ALTURA < (p.lin + 1) * T;
}

/** Onde a heroína aparece ao entrar pela passagem da linha/coluna dadas. */
export function chegada(s: RoomDef, em: [number, number]): { x: number; y: number; lado: 1 | -1; naEscada: boolean } {
  const [lin, col] = em;
  if (vertical(s, lin)) {
    // pelo teto: pendurada na escada; pelo piso: em pé no topo dela
    return { x: (col + 0.5) * T, y: lin === 0 ? 3 * T : lin * T, lado: 1, naEscada: lin === 0 };
  }
  const lado = col === 0 ? 1 : -1;
  return { x: (col + 0.5 + lado * 1.6) * T, y: (lin + 1) * T, lado, naEscada: false };
}

/** A sala como está agora: com o atalho fechado a passagem vira parede; aberto, a escotilha vira escada. */
export function comAtalho(s: RoomDef, aberto: boolean): RoomDef {
  const passagens = portas(s.id).filter((p) => p.atalho);
  if (!passagens.length) return s;
  const tiles = s.tiles.map((linha, lin) =>
    [...linha].map((c, col) => {
      if (c === 'A') return aberto ? 'H' : 'A';
      if (!aberto && c === 'H' && passagens.some((p) => p.lin === lin && p.col === col)) return 'A';
      return c;
    }).join(''));
  return { ...s, tiles };
}

export interface Marca {
  col: number;
  lin: number;
  c: string;
}

export function marcas(s: RoomDef, letras: string): Marca[] {
  const out: Marca[] = [];
  s.tiles.forEach((linha, lin) => {
    [...linha].forEach((c, col) => {
      if (letras.includes(c)) out.push({ col, lin, c });
    });
  });
  return out;
}
