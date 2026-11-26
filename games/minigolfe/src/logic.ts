/**
 * G06 Minigolfe: lógica pura (sem Phaser), determinística e testável.
 *
 * AS FASES SÃO TEXTO EM GRADE (uma letra por bloco; legenda em `LEGEND` e em docs/ADDING_LEVELS.md). Para recriar uma
 * fase a partir de uma imagem basta desenhar a grade; `parseLevel` valida e `validateLevel` garante que dá para
 * chegar ao buraco. Todas as unidades são em BLOCOS (1 bloco = 1 unidade), então a física não depende do tamanho
 * da tela: a cena só escolhe a escala para a fase caber.
 */

export type Rng = () => number;

export interface Vec {
  x: number;
  y: number;
}
export interface Seg {
  a: Vec;
  b: Vec;
}

// ---------- constantes de física (em blocos e segundos) ----------

export const DT = 1 / 120;
export const BALL_R = 0.26;
export const HOLE_R = 0.4;
/** A bola só cai no buraco se chegar mais devagar que isso; mais rápida, passa por cima. */
export const HOLE_CAPTURE_SPEED = 7;
export const MIN_SPEED = 2.5;
export const MAX_SPEED = 15;
/** Abaixo disso (e sem força agindo), a bola para. */
export const STOP_SPEED = 0.12;
/** Quanto da velocidade perpendicular sobra depois de bater na parede. */
export const WALL_RESTITUTION = 0.78;
export const BUMPER_RESTITUTION = 1.1;
export const BUMPER_MIN_KICK = 3;
export const BUMPER_R = 0.45;
export const SLOPE_ACCEL = 5;
export const MAGNET_R = 3;
export const MAGNET_FORCE = 16;
export const PORTAL_CAPTURE = 0.3;
/** Bomba: a bola que encosta nela é puxada para dentro e fica presa, girando, até a próxima tacada. */
export const CANNON_CAPTURE = 0.46;
export const CANNON_SPEED = 1.7; // rad/s
export const CANNON_COOLDOWN = 0.45;
/** Moinho: pás finas que giram. */
export const WINDMILL_LEN = 1.3;
export const WINDMILL_SPEED = 1.15;
export const WINDMILL_HUB = 0.3;
export const BLADE_R = 0.07;
/** Pistão: sobe e desce; só é sólido quando está alto. */
export const PISTON_R = 0.55;
export const PISTON_PERIOD = 2.6;
export const PISTON_UP = 0.5;
export const PISTON_RAMP = 0.07;
/** Lava: acende e apaga; a bola que passa por cima enquanto está acesa volta ao ponto da tacada (+1). */
export const LAVA_PERIOD = 3;
export const LAVA_HOT = 0.5;
/** Rampa de salto: a bola que sobe nela voa; o tempo no ar cresce com a velocidade. */
export const JUMP_MIN_SPEED = 3;
export const JUMP_AIR_PER_SPEED = 0.1;
export const JUMP_AIR_MAX = 1.5;
export const GRACE_AFTER_SHOT = 0.4;
/** Rede de segurança: uma tacada que anda mais que isso (ex.: bola orbitando um ímã) é parada. */
export const MAX_ROLL_SECONDS = 20;
export const PORTAL_COOLDOWN = 0.5;
/** Tacadas máximas por buraco: ao chegar nelas sem encaçapar, o buraco acaba com esse valor. */
export const MAX_STROKES = 8;
/** Distância mínima de arrasto (em unidades da tela) para valer como tacada. */
export const MIN_DRAG = 5;

export type Surface = 'grass' | 'sand' | 'ice' | 'water' | 'void';

/** `drag`: perda de velocidade proporcional (1/s). `roll`: perda constante (blocos/s²). */
export const SURFACES: Record<Surface, { drag: number; roll: number }> = {
  grass: { drag: 0.7, roll: 1.4 },
  sand: { drag: 3, roll: 3 },
  ice: { drag: 0.06, roll: 0 },
  water: { drag: 0.7, roll: 1.4 },
  void: { drag: 0.7, roll: 1.4 },
};

// ---------- fases ----------

/** Legenda da grade. Qualquer outro caractere é erro. */
export const LEGEND: Record<string, string> = {
  '#': 'parede',
  ' ': 'vazio (fora do campo)',
  '.': 'grama',
  T: 'largada (grama)',
  H: 'buraco (grama)',
  s: 'areia (freia muito)',
  i: 'gelo (escorrega)',
  '~': 'água (volta ao ponto da tacada, +1 tacada)',
  '^': 'esteira para cima (empurra a bola)',
  v: 'esteira para baixo',
  '<': 'esteira para a esquerda',
  '>': 'esteira para a direita',
  o: 'poste (quica com força)',
  m: 'ímã que atrai',
  M: 'ímã que repele',
  '1-9': 'portal de sinal: cada número aparece duas vezes e leva ao par',
  B: 'bomba: prende a bola e mira sozinha, girando (você só escolhe a força)',
  W: 'moinho: pás que giram',
  P: 'pistão: sobe e desce',
  X: 'lava, grupo A (acesa quando o grupo B apaga)',
  Y: 'lava, grupo B',
  U: 'rampa de salto para cima',
  D: 'rampa de salto para baixo',
  L: 'rampa de salto para a esquerda',
  R: 'rampa de salto para a direita',
  '/': 'parede diagonal (de baixo à esquerda para cima à direita)',
  '\\': 'parede diagonal (de cima à esquerda para baixo à direita)',
};

/** Bloco que desliza entre dois pontos (cantos de cima à esquerda, em blocos da grade). */
export interface BlockDef {
  from: [number, number];
  to: [number, number];
  /** Tamanho em blocos; padrão 1 x 1. */
  size?: [number, number];
  /** Segundos de ida e volta; padrão 4. */
  period?: number;
  /** Onde do ciclo ele começa (0 a 1). */
  phase?: number;
}
export interface LevelDef {
  id: string;
  name: string;
  par: number;
  rows: string[];
  blocks?: BlockDef[];
  /** Ajustes opcionais dos engenhos da fase. */
  tune?: { cannonSpeed?: number; windSpeed?: number; windBlades?: number; windLen?: number; lavaPeriod?: number; pistonPeriod?: number };
}
export interface Cannon extends Vec {
  speed: number;
  phase: number;
}
export interface Windmill extends Vec {
  blades: number;
  len: number;
  speed: number;
  phase: number;
}
export interface Block {
  from: Vec;
  to: Vec;
  w: number;
  h: number;
  period: number;
  phase: number;
}
export interface Piston extends Vec {
  r: number;
  period: number;
  phase: number;
  up: number;
}
export interface Lava {
  x: number;
  y: number;
  w: number;
  h: number;
  period: number;
  phase: number;
  hot: number;
}
export interface Jump extends Vec {
  dir: Vec;
}
export interface Bumper extends Vec {
  r: number;
}
export interface Magnet extends Vec {
  /** 1 atrai, -1 repele. */
  sign: 1 | -1;
}
export interface Portal extends Vec {
  digit: string;
  /** Índice do portal par em `Level.portals`. */
  to: number;
}
export interface Level {
  id: string;
  name: string;
  par: number;
  w: number;
  h: number;
  surface: Surface[][];
  slope: (Vec | null)[][];
  walls: Seg[];
  bumpers: Bumper[];
  magnets: Magnet[];
  portals: Portal[];
  cannons: Cannon[];
  windmills: Windmill[];
  blocks: Block[];
  pistons: Piston[];
  lava: Lava[];
  jumps: Jump[];
  tee: Vec;
  hole: Vec;
  /** Grade original (a cena desenha a partir dela). */
  rows: string[];
}

export class LevelError extends Error {
  constructor(id: string, msg: string) {
    super(`fase "${id}": ${msg}`);
  }
}

const SLOPES: Record<string, Vec> = { '^': { x: 0, y: -1 }, v: { x: 0, y: 1 }, '<': { x: -1, y: 0 }, '>': { x: 1, y: 0 } };
const VALID = new Set(['#', ' ', '.', 'T', 'H', 's', 'i', '~', '^', 'v', '<', '>', 'o', 'm', 'M', '/', '\\', 'B', 'W', 'P', 'X', 'Y', 'U', 'D', 'L', 'R', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
export const MAX_W = 16;
export const MAX_H = 24;

/** Lê uma fase em texto. Erra com mensagem clara se a grade estiver malformada. */
export function parseLevel(def: LevelDef): Level {
  const { id, rows } = def;
  if (!Number.isInteger(def.par) || def.par < 1 || def.par > 6) throw new LevelError(id, `par deve ser de 1 a 6 (veio ${def.par})`);
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  if (h < 3 || w < 3) throw new LevelError(id, 'a grade precisa ter pelo menos 3 x 3');
  if (w > MAX_W || h > MAX_H) throw new LevelError(id, `grade grande demais (${w}x${h}; máximo ${MAX_W}x${MAX_H})`);

  const surface: Surface[][] = [];
  const slope: (Vec | null)[][] = [];
  const walls: Seg[] = [];
  const bumpers: Bumper[] = [];
  const magnets: Magnet[] = [];
  const found: { digit: string; x: number; y: number }[] = [];
  const cannons: Cannon[] = [];
  const windmills: Windmill[] = [];
  const pistons: Piston[] = [];
  const lava: Lava[] = [];
  const jumps: Jump[] = [];
  const tune = def.tune ?? {};
  let tee: Vec | null = null;
  let hole: Vec | null = null;
  const isWall = (x: number, y: number): boolean => rows[y]?.[x] === '#';

  rows.forEach((row, y) => {
    if (row.length !== w) throw new LevelError(id, `linha ${y + 1} tem ${row.length} colunas; as outras têm ${w}`);
    const sr: Surface[] = [];
    const lr: (Vec | null)[] = [];
    for (let x = 0; x < w; x++) {
      const c = row[x]!;
      if (!VALID.has(c)) throw new LevelError(id, `caractere "${c}" inválido na linha ${y + 1}, coluna ${x + 1}`);
      const center = { x: x + 0.5, y: y + 0.5 };
      let s: Surface = 'grass';
      let sl: Vec | null = null;
      switch (c) {
        case ' ': s = 'void'; break;
        case '#': s = 'void'; break;
        case 's': s = 'sand'; break;
        case 'i': s = 'ice'; break;
        case '~': s = 'water'; break;
        case 'T':
          if (tee) throw new LevelError(id, 'mais de uma largada (T)');
          tee = center;
          break;
        case 'H':
          if (hole) throw new LevelError(id, 'mais de um buraco (H)');
          hole = center;
          break;
        case 'o': bumpers.push({ ...center, r: BUMPER_R }); break;
        case 'B': cannons.push({ ...center, speed: (tune.cannonSpeed ?? CANNON_SPEED) * (cannons.length % 2 === 0 ? 1 : -1), phase: cannons.length * 2.1 }); break;
        case 'W': windmills.push({ ...center, blades: tune.windBlades ?? 4, len: tune.windLen ?? WINDMILL_LEN, speed: (tune.windSpeed ?? WINDMILL_SPEED) * (windmills.length % 2 === 0 ? 1 : -1), phase: windmills.length * 0.7 }); break;
        case 'P': pistons.push({ ...center, r: PISTON_R, period: tune.pistonPeriod ?? PISTON_PERIOD, phase: (pistons.length * 0.37) % 1, up: PISTON_UP }); break;
        case 'X': lava.push({ x, y, w: 1, h: 1, period: tune.lavaPeriod ?? LAVA_PERIOD, phase: 0, hot: LAVA_HOT }); break;
        case 'Y': lava.push({ x, y, w: 1, h: 1, period: tune.lavaPeriod ?? LAVA_PERIOD, phase: 0.5, hot: LAVA_HOT }); break;
        case 'U': jumps.push({ ...center, dir: { x: 0, y: -1 } }); break;
        case 'D': jumps.push({ ...center, dir: { x: 0, y: 1 } }); break;
        case 'L': jumps.push({ ...center, dir: { x: -1, y: 0 } }); break;
        case 'R': jumps.push({ ...center, dir: { x: 1, y: 0 } }); break;
        case 'm': magnets.push({ ...center, sign: 1 }); break;
        case 'M': magnets.push({ ...center, sign: -1 }); break;
        case '/': walls.push({ a: { x, y: y + 1 }, b: { x: x + 1, y } }); break;
        case '\\': walls.push({ a: { x, y }, b: { x: x + 1, y: y + 1 } }); break;
        default:
          if (SLOPES[c]) sl = SLOPES[c]!;
          else if (c >= '1' && c <= '9') found.push({ digit: c, x: center.x, y: center.y });
      }
      sr.push(s);
      lr.push(sl);
      if (c === '#') {
        // só as arestas voltadas para fora: não há "emenda" entre duas paredes vizinhas para a bola prender
        if (!isWall(x, y - 1)) walls.push({ a: { x, y }, b: { x: x + 1, y } });
        if (!isWall(x, y + 1)) walls.push({ a: { x, y: y + 1 }, b: { x: x + 1, y: y + 1 } });
        if (!isWall(x - 1, y)) walls.push({ a: { x, y }, b: { x, y: y + 1 } });
        if (!isWall(x + 1, y)) walls.push({ a: { x: x + 1, y }, b: { x: x + 1, y: y + 1 } });
      }
    }
    surface.push(sr);
    slope.push(lr);
  });
  if (!tee) throw new LevelError(id, 'falta a largada (T)');
  if (!hole) throw new LevelError(id, 'falta o buraco (H)');

  const portals: Portal[] = [];
  for (const d of new Set(found.map((f) => f.digit))) {
    const pair = found.filter((f) => f.digit === d);
    if (pair.length !== 2) throw new LevelError(id, `o portal ${d} aparece ${pair.length} vez(es); precisa de exatamente 2`);
    const i = portals.length;
    portals.push({ digit: d, x: pair[0]!.x, y: pair[0]!.y, to: i + 1 }, { digit: d, x: pair[1]!.x, y: pair[1]!.y, to: i });
  }
  const blocks: Block[] = (def.blocks ?? []).map((b, i) => {
    const [bw, bh] = b.size ?? [1, 1];
    const ok = (c: [number, number]): boolean => c[0] >= 0 && c[1] >= 0 && c[0] + bw <= w && c[1] + bh <= h;
    if (!ok(b.from) || !ok(b.to)) throw new LevelError(id, `o bloco móvel ${i + 1} sai da grade`);
    return { from: { x: b.from[0], y: b.from[1] }, to: { x: b.to[0], y: b.to[1] }, w: bw, h: bh, period: b.period ?? 4, phase: b.phase ?? 0 };
  });
  const level: Level = { id, name: def.name, par: def.par, w, h, surface, slope, walls, bumpers, magnets, portals, cannons, windmills, blocks, pistons, lava, jumps, tee, hole, rows };
  validateLevel(level);
  return level;
}

/** Erra se o buraco não puder ser alcançado a partir da largada (andando por grama, areia, gelo e portais). */
export function validateLevel(l: Level): void {
  const key = (x: number, y: number): number => y * l.w + x;
  const open = (x: number, y: number): boolean => {
    const s = l.surface[y]?.[x];
    // com rampa de salto na fase, a água pode ser vencida voando (o vazio, não)
    return s !== undefined && s !== 'void' && (s !== 'water' || l.jumps.length > 0);
  };
  const seen = new Set<number>();
  const queue: Vec[] = [{ x: Math.floor(l.tee.x), y: Math.floor(l.tee.y) }];
  seen.add(key(queue[0]!.x, queue[0]!.y));
  for (let i = 0; i < queue.length; i++) {
    const { x, y } = queue[i]!;
    const next: Vec[] = [{ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 }];
    const portal = l.portals.find((p) => Math.floor(p.x) === x && Math.floor(p.y) === y);
    if (portal) {
      const to = l.portals[portal.to]!;
      next.push({ x: Math.floor(to.x), y: Math.floor(to.y) });
    }
    for (const n of next) {
      if (open(n.x, n.y) && !seen.has(key(n.x, n.y))) {
        seen.add(key(n.x, n.y));
        queue.push(n);
      }
    }
  }
  if (!seen.has(key(Math.floor(l.hole.x), Math.floor(l.hole.y)))) throw new LevelError(l.id, 'o buraco não pode ser alcançado a partir da largada');
}

// ---------- engenhos que se mexem (função pura do relógio da fase) ----------

const frac = (u: number): number => ((u % 1) + 1) % 1;

export const cannonAngle = (c: Cannon, t: number): number => c.phase + c.speed * t;

/** Pás do moinho no instante `t`, do centro até a ponta. */
export function windmillBlades(w: Windmill, t: number): Seg[] {
  const out: Seg[] = [];
  for (let i = 0; i < w.blades; i++) {
    const a = w.phase + w.speed * t + (i * Math.PI * 2) / w.blades;
    out.push({ a: { x: w.x, y: w.y }, b: { x: w.x + Math.cos(a) * w.len, y: w.y + Math.sin(a) * w.len } });
  }
  return out;
}

export interface BlockRect {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
}
/** Posição (canto de cima à esquerda) e velocidade do bloco móvel: vai e volta suave entre `from` e `to`. */
export function blockRect(b: Block, t: number): BlockRect {
  const u = frac(t / b.period + b.phase);
  const s = (1 - Math.cos(u * Math.PI * 2)) / 2;
  const ds = (Math.PI / b.period) * Math.sin(u * Math.PI * 2);
  const dx = b.to.x - b.from.x;
  const dy = b.to.y - b.from.y;
  return { x: b.from.x + dx * s, y: b.from.y + dy * s, w: b.w, h: b.h, vx: dx * ds, vy: dy * ds };
}

/** Altura do pistão de 0 (embaixo) a 1 (em cima). Só é sólido quando passa de 0,7. */
export function pistonHeight(p: Piston, t: number): number {
  const u = frac(t / p.period + p.phase);
  if (u < PISTON_RAMP) return u / PISTON_RAMP;
  if (u < p.up) return 1;
  if (u < p.up + PISTON_RAMP) return 1 - (u - p.up) / PISTON_RAMP;
  return 0;
}
export const pistonSolid = (p: Piston, t: number): boolean => pistonHeight(p, t) >= 0.7;

export const lavaHot = (l: Lava, t: number): boolean => frac(t / l.period + l.phase) < l.hot;
/** 0 a 1: aviso piscando antes de acender. 1 = acesa. */
export function lavaWarning(l: Lava, t: number): number {
  const u = frac(t / l.period + l.phase);
  if (u < l.hot) return 1;
  return Math.max(0, 1 - (1 - u) / 0.18);
}

// ---------- estado do buraco ----------

export interface Ball extends Vec {
  vx: number;
  vy: number;
}
export type HoleEvent =
  | { type: 'bounce'; speed: number }
  | { type: 'bumper'; speed: number }
  | { type: 'portal' }
  | { type: 'hazard'; kind: 'water' | 'out' | 'lava' }
  | { type: 'cannon' }
  | { type: 'jump'; air: number }
  | { type: 'land' }
  | { type: 'sink'; strokes: number }
  | { type: 'stop' }
  | { type: 'giveup' };

export interface HoleState {
  level: Level;
  ball: Ball;
  moving: boolean;
  strokes: number;
  sunk: boolean;
  gaveUp: boolean;
  /** Onde a bola estava na última tacada (para onde ela volta na água ou fora do campo). */
  lastRest: Vec;
  portalCd: number;
  /** Segundos desde a primeira tacada deste buraco. */
  time: number;
  /** Relógio da fase: corre sempre (a bomba gira, o moinho roda, a lava pisca), com a bola parada ou não. */
  clock: number;
  /** Índice da bomba que está segurando a bola (ou null). */
  held: number | null;
  cannonCd: number;
  /** Tempo de voo que falta (rampa de salto) e o total do voo atual. */
  air: number;
  airTotal: number;
  jumpCd: number;
  /** Logo depois da tacada a lava não vale (a bola pode ter parado em cima dela). */
  lavaGrace: number;
  /** Segundos desde o começo da tacada atual. */
  roll: number;
}

export function createHole(level: Level): HoleState {
  return {
    level,
    ball: { x: level.tee.x, y: level.tee.y, vx: 0, vy: 0 },
    moving: false,
    strokes: 0,
    sunk: false,
    gaveUp: false,
    lastRest: { ...level.tee },
    portalCd: 0,
    time: 0,
    clock: 0,
    held: null,
    cannonCd: 0,
    air: 0,
    airTotal: 0,
    jumpCd: 0,
    lavaGrace: 0,
    roll: 0,
  };
}

export const holeDone = (h: HoleState): boolean => h.sunk || h.gaveUp;
export const canShoot = (h: HoleState): boolean => !h.moving && !holeDone(h);

/** Direção e força a partir do arrasto (para trás): a bola vai no sentido contrário ao arrasto. */
export function aimFromDrag(dx: number, dy: number, maxDrag: number): { angle: number; power: number } | null {
  const len = Math.hypot(dx, dy);
  if (len < MIN_DRAG) return null;
  return { angle: Math.atan2(-dy, -dx), power: Math.min(1, len / maxDrag) };
}

export const speedFor = (power: number): number => MIN_SPEED + Math.max(0, Math.min(1, power)) * (MAX_SPEED - MIN_SPEED);

/** Dá a tacada. Devolve false se não puder (bola andando, buraco acabado). */
export function shoot(h: HoleState, angle: number, power: number): boolean {
  if (!canShoot(h) || h.held !== null) return false;
  const v = speedFor(power);
  h.ball.vx = Math.cos(angle) * v;
  h.ball.vy = Math.sin(angle) * v;
  h.lastRest = { x: h.ball.x, y: h.ball.y };
  h.strokes++;
  h.moving = true;
  h.portalCd = 0;
  h.lavaGrace = GRACE_AFTER_SHOT;
  h.roll = 0;
  return true;
}

/** Tacada da bola presa na bomba: a direção é a que a bomba aponta agora; o jogador escolhe só a força (0 a 1). */
export function shootFromCannon(h: HoleState, power: number): boolean {
  if (!canShoot(h) || h.held === null) return false;
  const c = h.level.cannons[h.held]!;
  const angle = cannonAngle(c, h.clock);
  const v = speedFor(power);
  h.ball.x = c.x; // sai do centro da bomba (se ela aponta para uma parede colada, a bola bate e volta); o `cannonCd` evita ser puxada de novo
  h.ball.y = c.y;
  h.ball.vx = Math.cos(angle) * v;
  h.ball.vy = Math.sin(angle) * v;
  h.lastRest = { x: c.x, y: c.y };
  h.strokes++;
  h.moving = true;
  h.held = null;
  h.portalCd = 0;
  h.cannonCd = CANNON_COOLDOWN;
  h.lavaGrace = GRACE_AFTER_SHOT;
  h.roll = 0;
  return true;
}

export const speedOf = (b: Ball): number => Math.hypot(b.vx, b.vy);

function surfaceAt(l: Level, x: number, y: number): Surface {
  return l.surface[Math.floor(y)]?.[Math.floor(x)] ?? 'void';
}

/** Empurra a bola para fora do ponto `p` (raio `r`) e reflete a velocidade. Devolve a velocidade do impacto (0 se não bateu). */
function bounceOff(b: Ball, p: Vec, r: number, e: number): number {
  let nx = b.x - p.x;
  let ny = b.y - p.y;
  const d = Math.hypot(nx, ny);
  if (d >= r) return 0;
  if (d < 1e-9) {
    nx = 0;
    ny = -1;
  } else {
    nx /= d;
    ny /= d;
  }
  b.x = p.x + nx * r;
  b.y = p.y + ny * r;
  const vn = b.vx * nx + b.vy * ny;
  if (vn >= 0) return 0;
  b.vx -= (1 + e) * vn * nx;
  b.vy -= (1 + e) * vn * ny;
  return -vn;
}

/**
 * Bola contra um ponto de um objeto que SE MOVE com velocidade (vx, vy) naquele ponto (ex.: a ponta da pá do moinho):
 * empurra a bola para fora e reflete a velocidade RELATIVA. Se o objeto vem na direção da bola, ela sai levada por ele
 * (a pá "varre" a bola), em vez de só ricochetear como numa parede parada.
 */
function bounceMoving(b: Ball, p: Vec, r: number, e: number, vx: number, vy: number): number {
  let nx = b.x - p.x;
  let ny = b.y - p.y;
  const d = Math.hypot(nx, ny);
  if (d >= r) return 0;
  if (d < 1e-9) {
    const s = Math.hypot(vx, vy);
    nx = s > 1e-9 ? vx / s : 0;
    ny = s > 1e-9 ? vy / s : -1;
  } else {
    nx /= d;
    ny /= d;
  }
  b.x = p.x + nx * r;
  b.y = p.y + ny * r;
  const vn = (b.vx - vx) * nx + (b.vy - vy) * ny;
  if (vn >= 0) return 0;
  b.vx -= (1 + e) * vn * nx;
  b.vy -= (1 + e) * vn * ny;
  return -vn;
}

/** Velocidade de um ponto da pá do moinho (giro em torno do centro). */
const bladePointVel = (w: Windmill, p: Vec): Vec => ({ x: -w.speed * (p.y - w.y), y: w.speed * (p.x - w.x) });

/** Quanto a bola sai quicando de uma pá (a pá é de madeira: absorve um pouco). */
const BLADE_RESTITUTION = 0.55;
/** Velocidade com que o pistão, ao subir, joga para o lado a bola que estava em cima dele. */
const PISTON_KICK = 2.2;

/**
 * Engenhos que se movem (pás, blocos, pistão subindo) também empurram a bola PARADA. Devolve true se ela foi
 * empurrada (ela volta a rolar, sem contar tacada).
 */
function pushResting(h: HoleState): boolean {
  const b = h.ball;
  const l = h.level;
  const t = h.clock;
  let hit = false;
  for (const w of l.windmills) {
    for (const seg of windmillBlades(w, t)) {
      const c = closestOnSeg(seg, b);
      const v = bladePointVel(w, c);
      if (bounceMoving(b, c, BALL_R + BLADE_R, BLADE_RESTITUTION, v.x, v.y) > 0) hit = true;
    }
  }
  for (const bk of l.blocks) if (bounceRect(b, blockRect(bk, t), 0.4) > 0) hit = true;
  for (const p of l.pistons) {
    if (!pistonSolid(p, t)) continue;
    const d = Math.hypot(b.x - p.x, b.y - p.y);
    if (d < p.r + BALL_R) {
      const nx = d > 1e-6 ? (b.x - p.x) / d : 0;
      const ny = d > 1e-6 ? (b.y - p.y) / d : -1;
      b.x = p.x + nx * (p.r + BALL_R);
      b.y = p.y + ny * (p.r + BALL_R);
      b.vx = nx * PISTON_KICK;
      b.vy = ny * PISTON_KICK;
      hit = true;
    }
  }
  return hit;
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Bola contra um retângulo que se move: empurra para fora e reflete a velocidade RELATIVA. Devolve a velocidade do impacto. */
function bounceRect(b: Ball, r: BlockRect, e: number): number {
  const cx = clamp(b.x, r.x, r.x + r.w);
  const cy = clamp(b.y, r.y, r.y + r.h);
  let nx = b.x - cx;
  let ny = b.y - cy;
  const d = Math.hypot(nx, ny);
  if (d >= BALL_R) return 0;
  if (d < 1e-9) {
    // centro dentro do bloco: sai pelo lado mais perto
    const gaps = [b.x - r.x, r.x + r.w - b.x, b.y - r.y, r.y + r.h - b.y];
    const m = Math.min(...gaps);
    if (m === gaps[0]) { nx = -1; ny = 0; b.x = r.x - BALL_R; }
    else if (m === gaps[1]) { nx = 1; ny = 0; b.x = r.x + r.w + BALL_R; }
    else if (m === gaps[2]) { nx = 0; ny = -1; b.y = r.y - BALL_R; }
    else { nx = 0; ny = 1; b.y = r.y + r.h + BALL_R; }
  } else {
    nx /= d;
    ny /= d;
    b.x = cx + nx * BALL_R;
    b.y = cy + ny * BALL_R;
  }
  const vn = (b.vx - r.vx) * nx + (b.vy - r.vy) * ny;
  if (vn >= 0) return 0;
  b.vx -= (1 + e) * vn * nx;
  b.vy -= (1 + e) * vn * ny;
  return -vn;
}

function closestOnSeg(s: Seg, p: Vec): Vec {
  const dx = s.b.x - s.a.x;
  const dy = s.b.y - s.a.y;
  const t = Math.max(0, Math.min(1, ((p.x - s.a.x) * dx + (p.y - s.a.y) * dy) / (dx * dx + dy * dy)));
  return { x: s.a.x + dx * t, y: s.a.y + dy * t };
}

/**
 * Avança o relógio da fase e, se a bola estiver andando, um passo da física. Chame sempre (mesmo com a bola parada):
 * é o que faz a bomba girar, o moinho rodar e a lava piscar. Devolve os eventos do passo (para som e efeitos).
 */
export function step(h: HoleState, dt = DT): HoleEvent[] {
  const ev: HoleEvent[] = [];
  h.clock += dt;
  if (h.cannonCd > 0) h.cannonCd = Math.max(0, h.cannonCd - dt);
  if (holeDone(h)) return ev;
  if (!h.moving) {
    // bola parada: a pá, o bloco ou o pistão que encosta nela a leva junto
    if (h.held !== null || !pushResting(h)) return ev;
    h.moving = true;
    h.roll = 0;
    ev.push({ type: 'bounce', speed: Math.max(0.5, speedOf(h.ball)) });
  }
  const b = h.ball;
  const l = h.level;
  const t = h.clock;
  h.time += dt;
  h.roll += dt;
  if (h.portalCd > 0) h.portalCd = Math.max(0, h.portalCd - dt);
  if (h.jumpCd > 0) h.jumpCd = Math.max(0, h.jumpCd - dt);
  if (h.lavaGrace > 0) h.lavaGrace = Math.max(0, h.lavaGrace - dt);
  const flying = h.air > 0;
  if (flying) {
    h.air = Math.max(0, h.air - dt);
    if (h.air === 0) ev.push({ type: 'land' });
  }

  // forças: esteira e ímãs (no ar a bola não sente o chão)
  let ax = 0;
  let ay = 0;
  if (!flying) {
    const sl = l.slope[Math.floor(b.y)]?.[Math.floor(b.x)];
    if (sl) {
      ax += sl.x * SLOPE_ACCEL;
      ay += sl.y * SLOPE_ACCEL;
    }
    for (const m of l.magnets) {
      const dx = m.x - b.x;
      const dy = m.y - b.y;
      const d = Math.hypot(dx, dy);
      if (d < MAGNET_R && d > 0.05) {
        const f = MAGNET_FORCE * (1 - d / MAGNET_R) * m.sign;
        ax += (dx / d) * f;
        ay += (dy / d) * f;
      }
    }
  }
  b.vx += ax * dt;
  b.vy += ay * dt;

  // atrito da superfície (no ar não há atrito)
  const surf = SURFACES[surfaceAt(l, b.x, b.y)];
  let v = speedOf(b);
  if (!flying && v > 0) {
    const nv = Math.max(0, v * Math.exp(-surf.drag * dt) - surf.roll * dt);
    const k = nv / v;
    b.vx *= k;
    b.vy *= k;
    v = nv;
  }

  // rampa de salto: subir nela, no sentido dela e com velocidade, faz a bola voar
  if (!flying && h.jumpCd === 0 && l.jumps.length > 0 && v >= JUMP_MIN_SPEED) {
    const cx = Math.floor(b.x);
    const cy = Math.floor(b.y);
    const jp = l.jumps.find((j) => Math.floor(j.x) === cx && Math.floor(j.y) === cy);
    if (jp && (b.vx * jp.dir.x + b.vy * jp.dir.y) / v > 0.35) {
      h.air = h.airTotal = Math.min(JUMP_AIR_MAX, JUMP_AIR_PER_SPEED * v);
      h.jumpCd = h.air + 0.25;
      ev.push({ type: 'jump', air: h.air });
    }
  }

  b.x += b.vx * dt;
  b.y += b.vy * dt;

  // colisões (duas passadas para cantos)
  const blades = flying ? [] : l.windmills.flatMap((w) => windmillBlades(w, t).map((seg) => ({ seg, w })));
  const rects = flying ? [] : l.blocks.map((bk) => blockRect(bk, t));
  for (let pass = 0; pass < 2; pass++) {
    for (const s of l.walls) {
      const imp = bounceOff(b, closestOnSeg(s, b), BALL_R, WALL_RESTITUTION);
      if (imp > 0.4) ev.push({ type: 'bounce', speed: imp });
    }
    if (flying) continue; // no ar a bola passa por cima de tudo que não é parede
    for (const p of l.bumpers) {
      const imp = bounceOff(b, p, p.r + BALL_R, BUMPER_RESTITUTION);
      if (imp > 0) {
        const sp = speedOf(b);
        if (sp < BUMPER_MIN_KICK && sp > 0) {
          b.vx *= BUMPER_MIN_KICK / sp;
          b.vy *= BUMPER_MIN_KICK / sp;
        }
        ev.push({ type: 'bumper', speed: imp });
      }
    }
    for (const w of l.windmills) {
      const imp = bounceOff(b, w, WINDMILL_HUB + BALL_R, 0.9);
      if (imp > 0.4) ev.push({ type: 'bounce', speed: imp });
    }
    for (const { seg, w } of blades) {
      const c = closestOnSeg(seg, b);
      const v = bladePointVel(w, c);
      const imp = bounceMoving(b, c, BALL_R + BLADE_R, BLADE_RESTITUTION, v.x, v.y);
      if (imp > 0.4) ev.push({ type: 'bounce', speed: imp });
    }
    for (const r of rects) {
      const imp = bounceRect(b, r, 0.85);
      if (imp > 0.4) ev.push({ type: 'bounce', speed: imp });
    }
    for (const p of l.pistons) {
      if (!pistonSolid(p, t)) continue;
      const imp = bounceOff(b, p, p.r + BALL_R, 0.9);
      if (imp > 0.4) ev.push({ type: 'bumper', speed: imp });
    }
  }

  // portais
  if (!flying && h.portalCd === 0) {
    for (const p of l.portals) {
      if (Math.hypot(b.x - p.x, b.y - p.y) < PORTAL_CAPTURE) {
        const to = l.portals[p.to]!;
        b.x = to.x;
        b.y = to.y;
        h.portalCd = PORTAL_COOLDOWN;
        ev.push({ type: 'portal' });
        break;
      }
    }
  }

  // bomba: a bola que encosta é puxada para dentro e fica presa até a próxima tacada
  if (!flying && h.cannonCd === 0) {
    for (let i = 0; i < l.cannons.length; i++) {
      const c = l.cannons[i]!;
      if (Math.hypot(b.x - c.x, b.y - c.y) < CANNON_CAPTURE) {
        b.x = c.x;
        b.y = c.y;
        b.vx = b.vy = 0;
        h.moving = false;
        h.held = i;
        h.lastRest = { x: c.x, y: c.y };
        ev.push({ type: 'cannon' });
        if (h.strokes >= MAX_STROKES) endByLimit(h, ev);
        return ev;
      }
    }
  }

  // perigos: água, fora do campo e lava acesa (no ar nada disso vale)
  if (!flying) {
    const here = surfaceAt(l, b.x, b.y);
    let kind: 'water' | 'out' | 'lava' | null = here === 'water' ? 'water' : here === 'void' ? 'out' : null;
    if (!kind && h.lavaGrace === 0 && l.lava.some((z) => lavaHot(z, t) && b.x > z.x && b.x < z.x + z.w && b.y > z.y && b.y < z.y + z.h)) kind = 'lava';
    if (kind) {
      ev.push({ type: 'hazard', kind });
      returnToLastRest(h);
      h.strokes = Math.min(MAX_STROKES, h.strokes + 1); // penalidade
      if (h.strokes >= MAX_STROKES) endByLimit(h, ev);
      return ev;
    }
  }

  // buraco: cai se vier devagar; rápida demais, passa por cima (e no ar passa por cima de qualquer jeito)
  if (!flying && Math.hypot(b.x - l.hole.x, b.y - l.hole.y) < HOLE_R && speedOf(b) <= HOLE_CAPTURE_SPEED) {
    b.x = l.hole.x;
    b.y = l.hole.y;
    b.vx = b.vy = 0;
    h.moving = false;
    h.sunk = true;
    ev.push({ type: 'sink', strokes: h.strokes });
    return ev;
  }

  // parar: devagar e sem força que a mantenha andando (esteira ou ímã mais forte que o atrito), ou tempo demais rolando
  if (!flying && ((speedOf(b) < STOP_SPEED && Math.hypot(ax, ay) <= surf.roll + 0.01) || h.roll > MAX_ROLL_SECONDS)) {
    b.vx = b.vy = 0;
    h.moving = false;
    h.lastRest = { x: b.x, y: b.y };
    ev.push({ type: 'stop' });
    if (h.strokes >= MAX_STROKES) endByLimit(h, ev);
  }
  return ev;
}

function returnToLastRest(h: HoleState): void {
  h.ball.x = h.lastRest.x;
  h.ball.y = h.lastRest.y;
  h.ball.vx = h.ball.vy = 0;
  h.moving = false;
  h.air = 0;
  h.held = null;
  // voltou para dentro de uma bomba (a tacada saiu dela): fica presa nela de novo
  const i = h.level.cannons.findIndex((c) => Math.hypot(c.x - h.ball.x, c.y - h.ball.y) < 0.01);
  if (i >= 0) h.held = i;
}

function endByLimit(h: HoleState, ev: HoleEvent[]): void {
  h.gaveUp = true;
  ev.push({ type: 'giveup' });
}

/** Roda `step` até a bola parar (ou acabar o buraco). Útil em testes e em simulações. */
export function settle(h: HoleState, maxSeconds = 30): HoleEvent[] {
  const all: HoleEvent[] = [];
  for (let t = 0; t < maxSeconds && h.moving; t += DT) all.push(...step(h));
  return all;
}

// ---------- pontuação ----------

/** Nome da jogada pela diferença para o par. */
export function resultName(strokes: number, par: number, sunk = true): string {
  if (!sunk) return 'LIMITE DE TACADAS';
  if (strokes === 1) return 'BURACO EM UMA!';
  const d = strokes - par;
  if (d <= -2) return 'EAGLE!';
  if (d === -1) return 'BIRDIE!';
  if (d === 0) return 'PAR';
  if (d === 1) return 'BOGEY';
  return `+${d}`;
}

export interface Run {
  levels: Level[];
  index: number;
  /** Tacadas de cada buraco já terminado. */
  results: number[];
}

export const createRun = (levels: Level[]): Run => ({ levels, index: 0, results: [] });
/** Total de tacadas do percurso (a pontuação: menos é melhor). */
export const totalStrokes = (r: Run): number => r.results.reduce((a, b) => a + b, 0);
export const totalPar = (r: Run): number => r.levels.reduce((a, l) => a + l.par, 0);
export const runFinished = (r: Run): boolean => r.index >= r.levels.length;
/** Registra o fim do buraco atual e passa para o próximo. */
export function finishHole(r: Run, h: HoleState): void {
  r.results.push(h.strokes);
  r.index++;
}
