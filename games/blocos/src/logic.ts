/** Regras puras do Space Ping (G04): sem Phaser, testáveis. Coordenadas na tela de 720x1280. */

// ---- campo ------------------------------------------------------------------------------------------------------------

export const FIELD_L = 20;
export const FIELD_R = 700;
export const FIELD_T = 150; // abaixo do placar

export const COLS = 10;
export const GAP = 4;
export const BRICK_W = (FIELD_R - FIELD_L - GAP * (COLS - 1)) / COLS; // 64,4
export const BRICK_H = 32;
export const GRID_TOP = 230;

export const PADDLE_Y = 1016; // linha da rebatida: altura da cabeça da raquete da jogadora
export const PADDLE_W = 180; // área de rebatida (da cabeça da jogadora à raquete)
/** Área de rebatida: da cabeça da raquete até os pés da jogadora (cobre a personagem toda). */
export const HIT_TOP = PADDLE_Y - 22;
export const HIT_BOTTOM = PADDLE_Y + 108;
export const BALL_R = 13;
export const SHIELD_Y = PADDLE_Y + 150; // linha do escudo, abaixo dos pés da jogadora (na prancha)
export const MAX_BALLS = 12;

export const BOSS_W = 240;
export const BOSS_H = 110;
export const BOSS_Y = 330; // centro

/** Retângulo da área de rebatida com o centro em `x`. */
export function paddleRect(x: number): Rect {
  return { x: x - PADDLE_W / 2, y: HIT_TOP, w: PADDLE_W, h: HIT_BOTTOM - HIT_TOP };
}

/** Ângulo máximo da rebatida (a partir da vertical), na ponta da raquete. */
export const MAX_BOUNCE_DEG = 62;

// ---- blocos e fases ---------------------------------------------------------------------------------------------------

/** n = comum (1 batida), s = prata (2), t = ouro (3), x = aço (indestrutível). */
export type BrickKind = 'n' | 's' | 't' | 'x';

export interface BrickDef {
  col: number;
  row: number;
  kind: BrickKind;
  /** Cor do bloco comum (0..4); nos outros tipos, 0. */
  color: number;
}

export interface LevelDef {
  /** Uma linha por fileira, 10 caracteres: '.' vazio, '1'..'5' comum, 'S' prata, 'T' ouro, 'X' aço. */
  rows: string[];
  boss?: boolean;
}

export const LEVELS: LevelDef[] = [
  {
    rows: ['..........', '1111111111', '2222222222', '3333333333', '4444444444', '5555555555'],
  },
  {
    rows: ['....33....', '...3443...', '..344443..', '.34455443.', '3445SS5443', 'SSSSSSSSSS'],
  },
  {
    rows: ['1.2.3.4.5.', '.1.2.3.4.5', 'S.S.S.S.S.', '.5.4.3.2.1', '5.4.3.2.1.', '..X....X..'],
  },
  {
    rows: ['....TT....', '...2552...', '..255552..', '.25544552.', '..255552..', '...2552...', '....SS....'],
  },
  {
    boss: true,
    rows: ['..........', '..........', '..........', '..........', '..........', '..........', '..........', '1S1S1S1S1S'],
  },
  {
    rows: ['XX......XX', 'X.333333.X', 'X.3TTTT3.X', 'X.3TTTT3.X', 'X.333333.X', 'X........X', 'XXXX..XXXX'],
  },
  {
    rows: ['1111......', '..2222....', '....3333..', '......4444', '....5555..', '..SSSS....', 'TTTT......'],
  },
  {
    rows: ['..444444..', '.4......4.', '4..1..1..4', '4........4', '4.2....2.4', '4..2222..4', '.4......4.', '..444444..'],
  },
  {
    rows: ['SSSSSSSSSS', '5555555555', 'TT44TT44TT', '3333333333', '2S2S2S2S2S', '1111111111'],
  },
  {
    boss: true,
    rows: ['..........', '..........', '..........', '..........', '..........', '..........', '..........', 'X.SSSSSS.X', '..T....T..'],
  },
];

/** Fase `n` (1, 2, 3...). Depois da última, as fases se repetem num ciclo mais difícil. */
export function levelAt(n: number): { def: LevelDef; cycle: number } {
  const i = Math.max(0, n - 1);
  return { def: LEVELS[i % LEVELS.length]!, cycle: Math.floor(i / LEVELS.length) };
}

export function parseLevel(def: LevelDef): BrickDef[] {
  const out: BrickDef[] = [];
  def.rows.forEach((line, row) => {
    for (let col = 0; col < COLS; col++) {
      const ch = line[col] ?? '.';
      if (ch >= '1' && ch <= '5') out.push({ col, row, kind: 'n', color: Number(ch) - 1 });
      else if (ch === 'S') out.push({ col, row, kind: 's', color: 0 });
      else if (ch === 'T') out.push({ col, row, kind: 't', color: 0 });
      else if (ch === 'X') out.push({ col, row, kind: 'x', color: 0 });
    }
  });
  return out;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Retângulo do bloco (canto superior esquerdo). */
export function brickRect(col: number, row: number): Rect {
  return { x: FIELD_L + col * (BRICK_W + GAP), y: GRID_TOP + row * (BRICK_H + GAP), w: BRICK_W, h: BRICK_H };
}

export function brickHp(kind: BrickKind): number {
  return kind === 'n' ? 1 : kind === 's' ? 2 : kind === 't' ? 3 : Infinity;
}

export function brickPoints(kind: BrickKind): number {
  return kind === 'n' ? 10 : kind === 's' ? 25 : kind === 't' ? 40 : 0;
}

export function bossHp(cycle: number, bossIndex: number): number {
  return 24 + bossIndex * 8 + cycle * 12;
}

// ---- bola -------------------------------------------------------------------------------------------------------------

/** Velocidade da bola (px/s): sobe com a fase e, um pouco, a cada rebatida na raquete. */
export function ballSpeed(level: number, paddleHits: number): number {
  const base = Math.min(780 + 20 * (level - 1), 1040);
  return base + Math.min(paddleHits * 3, 120);
}

/** Rebatida na raquete: `offset` de -1 (ponta esquerda) a 1 (ponta direita) define o ângulo. */
export function paddleBounce(offset: number, speed: number): { vx: number; vy: number } {
  const o = Math.max(-1, Math.min(1, offset));
  const a = (o * MAX_BOUNCE_DEG * Math.PI) / 180;
  return { vx: speed * Math.sin(a), vy: -speed * Math.cos(a) };
}

export interface Hit {
  nx: number;
  ny: number;
  depth: number;
}

/** Colisão círculo x retângulo: normal (do retângulo para o círculo) e quanto entrou, ou `null`. */
export function circleRect(cx: number, cy: number, r: number, rc: Rect): Hit | null {
  const px = Math.max(rc.x, Math.min(cx, rc.x + rc.w));
  const py = Math.max(rc.y, Math.min(cy, rc.y + rc.h));
  const dx = cx - px;
  const dy = cy - py;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return null;
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    return { nx: dx / d, ny: dy / d, depth: r - d };
  }
  // centro dentro do retângulo: sai pelo lado mais próximo
  const left = cx - rc.x;
  const right = rc.x + rc.w - cx;
  const top = cy - rc.y;
  const bottom = rc.y + rc.h - cy;
  const m = Math.min(left, right, top, bottom);
  if (m === top) return { nx: 0, ny: -1, depth: top + r };
  if (m === bottom) return { nx: 0, ny: 1, depth: bottom + r };
  if (m === left) return { nx: -1, ny: 0, depth: left + r };
  return { nx: 1, ny: 0, depth: right + r };
}

/** Reflete a velocidade na normal (só se estiver indo contra ela). */
export function reflect(vx: number, vy: number, nx: number, ny: number): { vx: number; vy: number } {
  const dot = vx * nx + vy * ny;
  if (dot >= 0) return { vx, vy };
  return { vx: vx - 2 * dot * nx, vy: vy - 2 * dot * ny };
}

/** Evita a bola quase na horizontal (ficaria batendo de parede em parede): garante um mínimo de vertical. */
export function keepAngle(vx: number, vy: number, minRatio = 0.25): { vx: number; vy: number } {
  const s = Math.hypot(vx, vy);
  if (s === 0) return { vx, vy };
  const minVy = s * minRatio;
  if (Math.abs(vy) >= minVy) return { vx, vy };
  const ny = (vy < 0 ? -1 : 1) * minVy;
  const nx = (vx < 0 ? -1 : 1) * Math.sqrt(s * s - ny * ny);
  return { vx: nx, vy: ny };
}

/** Gira a velocidade em `deg` graus (para a multibolinha). */
export function rotate(vx: number, vy: number, deg: number): { vx: number; vy: number } {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { vx: vx * c - vy * s, vy: vx * s + vy * c };
}

// ---- bônus e moedas ---------------------------------------------------------------------------------------------------

export type PowerKind = 'multi' | 'speed' | 'shield' | 'magnet';
export type DropKind = PowerKind | 'coin';

/** Duração dos bônus com tempo (ms). A multibolinha é instantânea. */
export const POWER_MS: Record<Exclude<PowerKind, 'multi'>, number> = { speed: 7000, shield: 12000, magnet: 10000 };

export const POWER_CHANCE = 0.13;
export const COIN_CHANCE = 0.25;
const POWER_WEIGHTS: Array<[PowerKind, number]> = [
  ['multi', 3],
  ['speed', 2],
  ['shield', 2],
  ['magnet', 2],
];

/** O que cai do bloco quebrado: um bônus, uma moeda ou nada. */
export function rollDrop(rng: () => number): DropKind | null {
  const r = rng();
  if (r < POWER_CHANCE) {
    const total = POWER_WEIGHTS.reduce((s, [, w]) => s + w, 0);
    let p = rng() * total;
    for (const [k, w] of POWER_WEIGHTS) {
      if ((p -= w) < 0) return k;
    }
    return 'multi';
  }
  if (r < POWER_CHANCE + COIN_CHANCE) return 'coin';
  return null;
}

export const COIN_POINTS = 50;
/** A cada tantas mini bolas-raio juntadas, uma vida extra. */
export const ORBS_PER_LIFE = 20;
export const BOSS_HIT_POINTS = 20;
export const BOSS_KILL_POINTS = 1000;
export const LEVEL_POINTS = 500;

/** Bônus de tempo ao terminar a fase: 20 pontos por segundo abaixo de 90 s. */
export function timeBonus(ms: number): number {
  return Math.max(0, Math.round((90000 - ms) / 1000)) * 20;
}
