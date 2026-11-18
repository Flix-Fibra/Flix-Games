/**
 * Regras do Nest Shot (G15), sem Phaser, para poder testar.
 *
 * Mundo: x de 0 a 720 (as bordas da tela são as paredes que rebatem a pedra; as árvores não têm física), y cresce para baixo e
 * o jogo sobe (y negativo). Os troncos são colunas lisas presas às bordas da tela, repetidas na vertical (musgo nas emendas).
 * Os apoios são peças soltas presas ao tronco: a **orelha de pau** (perto do tronco) ou o **galho** (comprido, o ninho e o macaco
 * podem ficar perto do tronco ou no meio da tela). Os apoios são numerados de baixo para cima (slot 0, 1, 2...): o macaco está
 * num slot e o ninho alvo está sempre no slot seguinte. A altura entre um apoio e o seguinte é sorteada.
 */

export const WORLD_W = 720;

// ---- peças da árvore (imagens em `public/img/`, já na escala do jogo) -------------------------------------------------

/**
 * Tronco liso (`tronco.png`, 355x1343, repetido na vertical com musgo nas emendas). O corpo vai de `bodyL` a `bodyR` na imagem;
 * os raminhos passam disso. `x`: posição da imagem do lado direito (o corpo encosta na borda e passa um pouco dela); à esquerda,
 * espelhada. Os apoios ficam atrás do tronco e saem de trás dele.
 */
export const TRUNK = { key: 'tronco', w: 355, h: 1343, bodyL: 66, bodyR: 216, x: 579 } as const; // só a metade de dentro do corpo (75 px) aparece
/** Lado de dentro do corpo do tronco da direita (x); o da esquerda é `WORLD_W - TRUNK_INNER`. */
export const TRUNK_INNER = TRUNK.x + TRUNK.bodyL;

/**
 * Orelha de pau (`orelha.png`, 127x199, do lado direito; espelhada à esquerda). `left`: x da imagem do lado direito;
 * (`surfX`, `surfY`): centro do topo, onde ficam o ninho e o macaco, relativo à imagem.
 */
export const SHELF = { w: 127, h: 199, left: 557, surfX: 56, surfY: 14 } as const;

/**
 * Galho (`galho.png`, 427x301, do lado esquerdo; espelhado à direita). `left`: x da imagem do lado esquerdo.
 * `TOP`: topo do galho (x, y) relativo à imagem; o ninho e o macaco ficam entre `NEST_RANGE` (x relativo à imagem).
 */
export const BRANCH = { w: 427, h: 301, left: 40 } as const;
export const BRANCH_TOP: ReadonlyArray<readonly [number, number]> = [
  [24, 106], [36, 102], [48, 101], [60, 97], [72, 93], [84, 90], [96, 90], [108, 88], [120, 88], [132, 88], [144, 88], [156, 90],
  [168, 93], [180, 93], [192, 93], [204, 95], [216, 99], [228, 99], [240, 101], [252, 101], [264, 99], [276, 99], [288, 93], [300, 88],
];
export const BRANCH_NEST_RANGE: readonly [number, number] = [60, 320];
/** Quanto os pés (e a base do ninho) afundam no topo do apoio. */
export const SURFACE_DY = 6;

// ---- física ----------------------------------------------------------------------------------------------------------
export const GRAVITY = 2400; // px/s²
export const STONE_R = 16;
export const WALL_RESTITUTION = 0.82;
export const NEST_RESTITUTION = 0.5;
/** Arrasto máximo considerado (px do jogo) e velocidade de lançamento correspondente. */
export const MAX_PULL = 260;
export const MIN_PULL = 22;
export const V_MAX = 2100;

/**
 * Corpo do ninho, relativo ao centro da base (o ponto onde ele pousa). A boca é a linha entre as duas bordas (`rims`):
 * a pedra que a atravessa descendo, entre as bordas, cai dentro do ninho.
 */
export const NEST_W = 150; // largura da imagem `ninho.png` (150x129; as pontas da palha ficam 60 px acima da base)
/** Os ovos ficam acima da palha: a pedra que desce entre as pontas da palha, na altura do meio dos ovos, cai no ninho. */
export const NEST_MOUTH_Y = -92;
export const NEST_MOUTH_HALF = 58;
export const NEST_RIMS: ReadonlyArray<{ x: number; y: number; r: number }> = [
  { x: -68, y: -62, r: 9 },
  { x: 68, y: -62, r: 9 },
];
export const NEST_SEGMENTS: ReadonlyArray<readonly [number, number, number, number]> = [
  [-74, -58, -54, -10],
  [-54, -10, 54, -10],
  [54, -10, 74, -58],
];
/** Onde a pedra fica depois de cair no ninho (no meio dos ovos), relativo à base. */
export const NEST_STONE_Y = -86;
/** O ninho fica alguns px abaixo da superfície do apoio (encaixado, sem parecer flutuar). */
export const NEST_SINK = 24;

/** Área do macaco que "pega" a pedra de volta (segunda chance), relativa aos pés. */
export const MONKEY_CATCH = { dx: 0, dy: -58, r: 52 };
/** O macaco gira em torno do centro do corpo (`MONKEY_CENTER_DY` acima dos pés), no máximo `MAX_TILT` para cada lado. */
export const MONKEY_CENTER_DY = -60;
export const MAX_TILT = (75 * Math.PI) / 180;
/** Ponta do estilingue, de onde a pedra sai, relativa ao centro do corpo (olhando para a esquerda; espelha para a direita). */
export const SLING_TIP = { dx: -40, dy: -38 };

export interface Vec {
  x: number;
  y: number;
}

export interface Stone {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

// ---- apoios ------------------------------------------------------------------------------------------------------------

export type Side = 'left' | 'right';
export type SlotKind = 'shelf' | 'branch';

export interface SlotInfo {
  index: number;
  side: Side;
  kind: SlotKind;
  /** Onde ficam o ninho e o macaco. */
  x: number;
  /** y da superfície onde se pousa (no ponto `x`). */
  y: number;
  /** y do topo da imagem do apoio (orelha ou galho). */
  pieceY: number;
}

export const otherSide = (s: Side): Side => (s === 'left' ? 'right' : 'left');

/** Topo do galho (relativo à imagem) no x relativo `lx`. */
export function branchTopLocal(lx: number): number {
  const pts = BRANCH_TOP;
  if (lx <= pts[0]![0]) return pts[0]![1];
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i]!;
    const [x0, y0] = pts[i - 1]!;
    if (lx <= x1) return y0 + ((y1 - y0) * (lx - x0)) / (x1 - x0);
  }
  return pts[pts.length - 1]![1];
}

/** x relativo à imagem do galho -> x do mundo (e o contrário). */
export const branchWorldX = (lx: number, side: Side): number => (side === 'left' ? BRANCH.left + lx : WORLD_W - BRANCH.left - lx);
export const branchLocalX = (x: number, side: Side): number => (side === 'left' ? x - BRANCH.left : WORLD_W - BRANCH.left - x);

/** Faixa x (mundo) em que o ninho pode ficar (e deslizar) no galho. */
export function branchRange(side: Side): [number, number] {
  const a = branchWorldX(BRANCH_NEST_RANGE[0], side);
  const b = branchWorldX(BRANCH_NEST_RANGE[1], side);
  return a < b ? [a, b] : [b, a];
}

/** y da superfície do galho do apoio `slot` no x do mundo. */
export function branchSurfaceY(slot: SlotInfo, x: number): number {
  return slot.pieceY + branchTopLocal(branchLocalX(x, slot.side)) + SURFACE_DY;
}

export const shelfX = (side: Side): number => (side === 'right' ? SHELF.left + SHELF.surfX : WORLD_W - SHELF.left - SHELF.surfX);

/** Apoio de orelha de pau com a superfície em `y`. */
export function shelfSlot(index: number, side: Side, y: number): SlotInfo {
  return { index, side, kind: 'shelf', x: shelfX(side), y, pieceY: y - SURFACE_DY - SHELF.surfY };
}

/** Apoio de galho com o ninho/macaco no x relativo `lx` e a superfície (nesse ponto) em `y`. */
export function branchSlot(index: number, side: Side, y: number, lx: number): SlotInfo {
  const pieceY = y - SURFACE_DY - branchTopLocal(lx);
  return { index, side, kind: 'branch', x: branchWorldX(lx, side), y, pieceY };
}

/** O primeiro apoio: orelha à direita, na altura 0. */
export const firstSlot = (): SlotInfo => shelfSlot(0, 'right', 0);

// ---- dificuldade -------------------------------------------------------------------------------------------------------

/** Cestas (ninhos acertados) antes de qualquer ninho se mexer. */
export const STATIC_UNTIL = 8;

/** Chance de o ninho alvo se mexer, pelo número de acertos até ali. */
export function moveChance(hits: number): number {
  if (hits < STATIC_UNTIL) return 0;
  return Math.min(0.7, 0.3 + (hits - STATIC_UNTIL) * 0.03);
}

/** Fator de velocidade dos ninhos que se mexem (1 no início, até 1,8). */
export function moveSpeedFactor(hits: number): number {
  return 1 + Math.min(0.8, Math.max(0, hits - STATIC_UNTIL) * 0.025);
}

/**
 * Altura entre um apoio e o seguinte: no começo de 300 a 380 px; com os acertos a faixa abre até 230 (perto) a 540 (bem longe).
 */
export const GAP_START: readonly [number, number] = [300, 380];
export const GAP_END: readonly [number, number] = [230, 540];
export const GAP_RAMP_HITS = 20;
export function gapRange(hits: number): [number, number] {
  const k = Math.min(1, Math.max(0, hits) / GAP_RAMP_HITS);
  return [GAP_START[0] + (GAP_END[0] - GAP_START[0]) * k, GAP_START[1] + (GAP_END[1] - GAP_START[1]) * k];
}
/**
 * Do mesmo lado, os apoios ficam pelo menos `SAME_SIDE_MIN_GAP` afastados (para as peças não se encostarem) e no máximo
 * `SAME_SIDE_MAX_GAP` (com o ninho quase em cima do macaco e muito alto, não há tiro que alcance).
 */
export const SAME_SIDE_MIN_GAP = 320;
export const SAME_SIDE_MAX_GAP = 440;

/** Chance de o próximo apoio ficar do mesmo lado (exige tabela ou arco por cima). */
export const sameSideChance = (hits: number): number => (hits < 2 ? 0 : 0.3);
/**
 * Chance de o próximo apoio ser um galho. No galho o ninho sempre desliza de um lado para o outro, então ele só aparece
 * depois que os ninhos começam a se mexer (`STATIC_UNTIL`).
 */
export const branchChance = (hits: number): number => (hits < STATIC_UNTIL ? 0 : Math.min(0.5, 0.25 + (hits - STATIC_UNTIL) * 0.015));

/**
 * Sorteia o próximo apoio a partir do atual. `hits` = acertos quando o ninho estiver nele (o slot seguinte é mirado com
 * `prev.index` acertos).
 */
export function nextSlot(prev: SlotInfo, rnd: () => number): SlotInfo {
  const hits = prev.index;
  const index = prev.index + 1;
  const same = rnd() < sameSideChance(hits);
  const side = same ? prev.side : otherSide(prev.side);
  const branch = rnd() < branchChance(hits);
  const [gmin, gmax] = gapRange(hits);
  let gap = gmin + rnd() * (gmax - gmin);
  if (same) gap = Math.min(SAME_SIDE_MAX_GAP, Math.max(gap, SAME_SIDE_MIN_GAP));
  const y = prev.y - gap;
  if (!branch) return shelfSlot(index, side, y);
  const [a, b] = BRANCH_NEST_RANGE;
  return branchSlot(index, side, y, a + rnd() * (b - a));
}

/** Sapo: a base do ninho fica pelo menos `FROG_LIFT` acima do apoio e sobe mais até `frogAmp` (px). */
export const FROG_LIFT = 300; // acima do topo da magia do cajado
export const FROG_AMP_MAX = 220;
export const frogAmp = (hits: number): number => Math.min(FROG_AMP_MAX, 150 + Math.max(0, hits - STATIC_UNTIL) * 4);
/** Escala do desenho do sapo (quadros de 96x344, quase tudo é a magia do cajado). */
export const FROG_SCALE = 0.85;
/** O sapo só aparece se o ninho estiver a pelo menos `FROG_MIN_DX` na horizontal e `FROG_MAX_GAP` na vertical do macaco. */
export const FROG_MIN_DX = 200;
export const FROG_MAX_GAP = 330;

/**
 * Ninho levitado pelo sapo (sobe e desce)? Só nas orelhas de pau, e só quando o ninho não fica nem logo acima do macaco nem
 * longe demais na altura, porque ele sobe bem acima do sapo e precisa continuar alcançável.
 */
export function rollFrog(slot: SlotInfo, rnd: () => number, from?: SlotInfo): boolean {
  if (slot.kind !== 'shelf') return false;
  if (from && (Math.abs(slot.x - from.x) < FROG_MIN_DX || from.y - slot.y > FROG_MAX_GAP)) return false;
  const hits = slot.index - 1;
  return rnd() < moveChance(hits) * 0.6;
}

// ---- morcegos ---------------------------------------------------------------------------------------------------------

/** Pontos por morcego abatido. */
export const BAT_POINTS = 10;
/** Raio do corpo do morcego (desenho de 130x141) para a pedra acertar e para ele pegar o macaco. */
export const BAT_R = 44;
/** Depois da primeira, uma onda de morcegos a cada 5 a 10 ninhos (sorteado). */
export const nextWaveGap = (rnd: () => number): number => 5 + Math.floor(rnd() * 6);
/** A primeira onda vem depois de 3 ninhos. */
export const FIRST_WAVE_AT = 3;
/** Um morcego por onda; em dupla a partir de 25 ninhos e em trio a partir de 60. */
export const batCount = (hits: number): number => (hits >= 60 ? 3 : hits >= 25 ? 2 : 1);
/** Quadros do morcego: voo, atingido e queda (morrendo). */
export const BAT_FLY_FRAMES = 18;
export const BAT_DEATH_FRAMES: readonly number[] = [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];
/** Velocidade de descida (px/s), um pouco maior com o tempo. */
export const batSpeed = (hits: number): number => Math.min(228, 126 + hits * 1.44); // 20% mais rápido que a 1ª versão

/**
 * Padrões de voo dos morcegos: cada um da mesma onda usa um diferente. `amp` largura do zigue-zague (px), `w` rapidez (rad/s),
 * `shape` seno (curvas suaves) ou triângulo (vai e volta em linha reta, com viradas secas), `surge` quanto a descida acelera e
 * freia em ondas (0 = constante), `homing` quanto ele puxa para o lado do macaco (px/s).
 */
export interface BatPattern {
  amp: number;
  w: number;
  shape: 'sine' | 'tri';
  surge: number;
  homing: number;
}
export const BAT_PATTERNS: readonly BatPattern[] = [
  { amp: 200, w: 2.4, shape: 'sine', surge: 0, homing: 45 },
  { amp: 170, w: 3.4, shape: 'tri', surge: 0.25, homing: 30 },
  { amp: 240, w: 1.7, shape: 'sine', surge: 0.6, homing: 60 },
];

/** Deslocamento lateral do padrão no instante `t` (entre -amp e +amp). */
export function batSwing(p: BatPattern, t: number): number {
  const ph = t * p.w;
  if (p.shape === 'sine') return p.amp * Math.sin(ph);
  // onda triangular com o mesmo período do seno
  const u = (((ph / (2 * Math.PI)) % 1) + 1) % 1;
  return p.amp * (u < 0.25 ? 4 * u : u < 0.75 ? 2 - 4 * u : 4 * u - 4);
}

/** Padrões dos morcegos de uma onda: todos diferentes entre si (ordem sorteada). */
export function pickBatPatterns(n: number, rnd: () => number): BatPattern[] {
  const idx = BAT_PATTERNS.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [idx[i], idx[j]] = [idx[j]!, idx[i]!];
  }
  return idx.slice(0, n).map((i) => BAT_PATTERNS[i]!);
}

/** A pedra encostou no círculo? */
export function stoneHits(st: Stone, c: Circle): boolean {
  return Math.hypot(st.x - c.x, st.y - c.y) < STONE_R + c.r;
}

// ---- pássaro ----------------------------------------------------------------------------------------------------------

/** Raio da área do pássaro que rebate a pedra (desenho de 120x114, centro do corpo um pouco abaixo do centro da imagem). */
export const BIRD_R = 30;
export const BIRD_BODY_DY = 8;
export const BIRD_RESTITUTION = 0.6;
/** Acertos antes de o primeiro pássaro aparecer. */
export const BIRD_FROM = 4;
export type BirdMode = 'h' | 'v';

export function birdChance(hits: number): number {
  if (hits < BIRD_FROM) return 0;
  return Math.min(0.5, 0.25 + (hits - BIRD_FROM) * 0.02);
}

/** Pássaro voando perto do ninho alvo? Só em ninhos parados: de um lado para o outro (`h`) ou para cima e para baixo (`v`). */
export function rollBird(hits: number, rnd: () => number): BirdMode | null {
  if (rnd() >= birdChance(hits)) return null;
  return rnd() < 0.5 ? 'h' : 'v';
}

export interface Circle {
  x: number;
  y: number;
  r: number;
}

// ---- pontuação (igual à do gênero) -----------------------------------------------------------------------------------

export interface ScoreState {
  score: number;
  /** Acertos limpos seguidos (sem tocar no ninho antes de entrar). */
  streak: number;
  hits: number;
  bestStreak: number;
}

export const newScore = (): ScoreState => ({ score: 0, streak: 0, hits: 0, bestStreak: 0 });

export interface CatchResult {
  points: number;
  clean: boolean;
  bounce: boolean;
  streak: number;
}

/**
 * Pontos de um acerto: 1 ponto; acerto limpo (sem encostar no ninho) vale 1 + a sequência de limpos (2, 3, 4...);
 * encostar zera a sequência. Tabela na parede antes de entrar: +1.
 */
export function scoreCatch(s: ScoreState, clean: boolean, wallBounces: number): CatchResult {
  s.streak = clean ? s.streak + 1 : 0;
  s.bestStreak = Math.max(s.bestStreak, s.streak);
  const bounce = wallBounces > 0;
  const points = (clean ? 1 + s.streak : 1) + (bounce ? 1 : 0);
  s.score += points;
  s.hits++;
  return { points, clean, bounce, streak: s.streak };
}

// ---- lançamento --------------------------------------------------------------------------------------------------------

/** Velocidade do lançamento a partir do arrasto (início - posição atual): puxa para trás, a pedra vai para frente. */
export function launchVelocity(pull: Vec): Vec | null {
  const len = Math.hypot(pull.x, pull.y);
  if (len < MIN_PULL) return null;
  const k = (Math.min(len, MAX_PULL) / MAX_PULL) * V_MAX;
  return { x: (pull.x / len) * k, y: (pull.y / len) * k };
}

export const pullPower = (pull: Vec): number => Math.min(1, Math.hypot(pull.x, pull.y) / MAX_PULL);

// ---- passo de física ---------------------------------------------------------------------------------------------------

export interface StepEvents {
  wall: boolean;
  nestTouch: boolean;
  entered: boolean;
  /** Bateu num obstáculo (pássaro). */
  obstacle: boolean;
}

/** Colisão círculo x segmento; devolve true se houve contato (e corrige posição e velocidade). */
function collideSegment(st: Stone, ax: number, ay: number, bx: number, by: number, e: number): boolean {
  const abx = bx - ax;
  const aby = by - ay;
  const t = Math.max(0, Math.min(1, ((st.x - ax) * abx + (st.y - ay) * aby) / (abx * abx + aby * aby)));
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  return collidePoint(st, cx, cy, 0, e);
}

function collidePoint(st: Stone, px: number, py: number, pr: number, e: number): boolean {
  const dx = st.x - px;
  const dy = st.y - py;
  const d = Math.hypot(dx, dy);
  const min = STONE_R + pr;
  if (d >= min || d === 0) return false;
  const nx = dx / d;
  const ny = dy / d;
  st.x = px + nx * min;
  st.y = py + ny * min;
  const vn = st.vx * nx + st.vy * ny;
  if (vn < 0) {
    st.vx -= (1 + e) * vn * nx;
    st.vy -= (1 + e) * vn * ny;
    st.vx *= 0.92;
  }
  return true;
}

/**
 * Avança a pedra `dt` segundos: gravidade, paredes (bordas da tela) e o ninho alvo (posição da base `nest`, ou null).
 * `entered`: a pedra atravessou a boca do ninho descendo, entre as bordas.
 */
export function stepStone(st: Stone, dt: number, nest: Vec | null, obstacles: ReadonlyArray<Circle> = []): StepEvents {
  const ev: StepEvents = { wall: false, nestTouch: false, entered: false, obstacle: false };
  const prevY = st.y;
  st.vy += GRAVITY * dt;
  st.x += st.vx * dt;
  st.y += st.vy * dt;

  if (st.x < STONE_R && st.vx < 0) {
    st.x = STONE_R;
    st.vx = -st.vx * WALL_RESTITUTION;
    ev.wall = true;
  } else if (st.x > WORLD_W - STONE_R && st.vx > 0) {
    st.x = WORLD_W - STONE_R;
    st.vx = -st.vx * WALL_RESTITUTION;
    ev.wall = true;
  }

  for (const o of obstacles) if (collidePoint(st, o.x, o.y, o.r, BIRD_RESTITUTION)) ev.obstacle = true;

  if (nest) {
    const mouthY = nest.y + NEST_MOUTH_Y;
    if (st.vy > 0 && prevY < mouthY && st.y >= mouthY && Math.abs(st.x - nest.x) < NEST_MOUTH_HALF) {
      ev.entered = true;
      return ev;
    }
    for (const r of NEST_RIMS) if (collidePoint(st, nest.x + r.x, nest.y + r.y, r.r, NEST_RESTITUTION)) ev.nestTouch = true;
    for (const [ax, ay, bx, by] of NEST_SEGMENTS) {
      if (collideSegment(st, nest.x + ax, nest.y + ay, nest.x + bx, nest.y + by, NEST_RESTITUTION)) ev.nestTouch = true;
    }
  }
  return ev;
}

/** Pontos da trajetória prevista (só gravidade e paredes), um a cada `every` segundos, por `duration` segundos. */
export function predictPath(from: Vec, v: Vec, duration = 0.5, every = 0.04, dt = 1 / 240): Vec[] {
  const st: Stone = { x: from.x, y: from.y, vx: v.x, vy: v.y };
  const out: Vec[] = [];
  let t = 0;
  let next = every;
  while (t < duration) {
    stepStone(st, dt, null);
    t += dt;
    if (t >= next) {
      out.push({ x: st.x, y: st.y });
      next += every;
    }
  }
  return out;
}

/**
 * Pedra presa: se ela fica `STUCK_S` segundos sem sair de um círculo de `STUCK_RADIUS` px (por exemplo, encalhada entre a
 * borda da tela e a palha do ninho, ou equilibrada na ponta da palha), o jogador ganha uma segunda chance.
 * A pedra no alto de um arco fica bem menos que isso parada (cerca de 0,4 s em 40 px), então tiros normais não disparam.
 */
export const STUCK_RADIUS = 40;
export const STUCK_S = 1.2;
export interface StuckWatch {
  ax: number;
  ay: number;
  t: number;
}
export const newStuckWatch = (x: number, y: number): StuckWatch => ({ ax: x, ay: y, t: 0 });
/** Atualiza a vigia com a posição da pedra; devolve true quando ela está presa. */
export function watchStuck(w: StuckWatch, x: number, y: number, dt: number): boolean {
  if (Math.hypot(x - w.ax, y - w.ay) > STUCK_RADIUS) {
    w.ax = x;
    w.ay = y;
    w.t = 0;
    return false;
  }
  w.t += dt;
  return w.t >= STUCK_S;
}

/** A pedra caindo pegou no macaco (segunda chance)? */
export function hitsMonkey(st: Stone, feet: Vec): boolean {
  if (st.vy <= 0) return false;
  return Math.hypot(st.x - (feet.x + MONKEY_CATCH.dx), st.y - (feet.y + MONKEY_CATCH.dy)) < MONKEY_CATCH.r + STONE_R;
}

/** Ponta do estilingue no mundo, com o macaco girado `rot` radianos (sentido horário, como no Phaser). */
export function slingTip(feet: Vec, facingRight: boolean, rot = 0): Vec {
  const ox = facingRight ? -SLING_TIP.dx : SLING_TIP.dx;
  const oy = SLING_TIP.dy;
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return { x: feet.x + ox * c - oy * s, y: feet.y + MONKEY_CENTER_DY + ox * s + oy * c };
}

/**
 * Giro do macaco para o estilingue apontar na direção do tiro: o desenho mira na horizontal (para a esquerda, ou para a direita
 * quando espelhado). Limitado a `MAX_TILT`.
 */
export function aimTilt(dir: Vec, facingRight: boolean): number {
  let r = facingRight ? Math.atan2(dir.y, dir.x) : Math.atan2(dir.y, dir.x) - Math.PI;
  while (r > Math.PI) r -= 2 * Math.PI;
  while (r < -Math.PI) r += 2 * Math.PI;
  return Math.max(-MAX_TILT, Math.min(MAX_TILT, r));
}

/**
 * Pontos da mira mostrados ao jogador: a subida inteira (com tabelas) e só o primeiro ponto da descida, para não entregar
 * onde a pedra cai.
 */
export function visibleAimPoints(pts: Vec[], from: Vec): Vec[] {
  const out: Vec[] = [];
  let prevY = from.y;
  for (const p of pts) {
    out.push(p);
    if (p.y > prevY) break;
    prevY = p.y;
  }
  return out;
}
