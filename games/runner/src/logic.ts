/**
 * Regras do Flix Runner (G01) sem Phaser, para poder testar. Unidades: pixels lógicos e segundos.
 * `y` é a altura dos pés acima do chão (0 = no chão, positivo = para cima).
 */

export const GRAVITY = 2600;
export const JUMP_VELOCITY = 900; // altura do salto cheio: v²/2g ≈ 156 px
export const JUMP_CUT_VELOCITY = 320; // soltar o botão cedo corta a subida
export const FAST_FALL_ACCEL = 3200;

export const JETPACK_MS = 7000;
export const JETPACK_WARN_MS = 1800;
export const JETPACK_GRAVITY = 1000;
export const JETPACK_THRUST = 3000;
export const JETPACK_MAX_UP = 420;
export const JETPACK_MAX_DOWN = 380;
export const JETPACK_CEILING = 330; // altura máxima dos pés

export const SPEED_BASE = 235.872; // 336,96 (versão anterior) -30%
export const SPEED_DOUBLE_AT = 90; // teste: aos 1:30 de partida a velocidade chega a 200% da inicial
export const SPEED_RAMP = SPEED_BASE / SPEED_DOUBLE_AT; // ~1,11% da inicial por segundo (antes 0,5%/s)
export const SPEED_MAX = SPEED_BASE * 2; // para de acelerar nos 200%

// personagem 30% menor: caixas de colisão também (de pé 36x87 -> 25x61; abaixada 56x62 -> 39x43)
export const STAND_HIT = { halfW: 12.6, h: 61 };
export const DUCK_HIT = { halfW: 19.6, h: 43 };

export interface Player {
  y: number;
  vy: number;
  ducking: boolean;
  /** milissegundos de jetpack restantes (0 = sem jetpack) */
  jetMs: number;
  /** subindo com o jetpack neste quadro (para o efeito das ondas) */
  thrusting: boolean;
}

export interface Controls {
  jumpHeld: boolean;
  jumpPressed: boolean;
  duckHeld: boolean;
}

export const createPlayer = (): Player => ({ y: 0, vy: 0, ducking: false, jetMs: 0, thrusting: false });
export const onGround = (p: Player): boolean => p.y <= 0 && p.vy <= 0;
export const speedAt = (seconds: number): number => Math.min(SPEED_MAX, SPEED_BASE + SPEED_RAMP * seconds);

/** Liga o jetpack (ou renova o tempo, se já estiver ligado). */
export function giveJetpack(p: Player): void {
  p.jetMs = JETPACK_MS;
}

/** Avança o personagem `dt` segundos. */
export function stepPlayer(p: Player, c: Controls, dt: number): void {
  p.thrusting = false;
  const grounded = onGround(p);

  if (p.jetMs > 0) {
    // a barra do jetpack só gasta fora do chão (ou ao decolar); parado no chão ele não consome
    if (!grounded || c.jumpHeld) p.jetMs = Math.max(0, p.jetMs - dt * 1000);
    p.ducking = c.duckHeld; // abaixa também voando
    let a = -JETPACK_GRAVITY;
    if (c.jumpHeld) {
      a += JETPACK_THRUST;
      p.thrusting = true;
    }
    if (c.duckHeld) a -= FAST_FALL_ACCEL * 0.5;
    p.vy = Math.max(-JETPACK_MAX_DOWN, Math.min(JETPACK_MAX_UP, p.vy + a * dt));
  } else {
    if (grounded) {
      p.ducking = c.duckHeld;
      if (c.jumpPressed) {
        p.vy = JUMP_VELOCITY;
        p.ducking = false;
      }
    } else {
      p.ducking = c.duckHeld; // abaixa também no ar
      if (!c.jumpHeld && p.vy > JUMP_CUT_VELOCITY) p.vy = JUMP_CUT_VELOCITY;
    }
    let a = -GRAVITY;
    if (!grounded && c.duckHeld) a -= FAST_FALL_ACCEL;
    p.vy += a * dt;
  }

  p.y += p.vy * dt;
  if (p.y <= 0) {
    p.y = 0;
    if (p.vy < 0) p.vy = 0;
  }
  if (p.y >= JETPACK_CEILING && p.jetMs > 0) {
    p.y = JETPACK_CEILING;
    if (p.vy > 0) p.vy = 0;
  }
}

/** Caixa de colisão do personagem em coordenadas do mundo (y para cima, a partir do chão). */
export function hitbox(p: Player, x: number): { x0: number; x1: number; y0: number; y1: number } {
  const h = p.ducking ? DUCK_HIT : STAND_HIT;
  return { x0: x - h.halfW, x1: x + h.halfW, y0: p.y, y1: p.y + h.h };
}

/** Círculo (centro cx, cy acima do chão; raio r) toca a caixa? */
export function circleHitsBox(cx: number, cy: number, r: number, b: { x0: number; x1: number; y0: number; y1: number }): boolean {
  const nx = Math.max(b.x0, Math.min(cx, b.x1));
  const ny = Math.max(b.y0, Math.min(cy, b.y1));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy <= r * r;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const PICKUP_GAP_MIN = 2400; // distância percorrida entre roteadores
export const PICKUP_GAP_MAX = 3800;
export const PICKUP_LOW = 46; // altura do centro: ao alcance andando
export const PICKUP_HIGH_MIN = 170; // exige saltar
export const PICKUP_HIGH_MAX = 230;

export function nextPickupGap(rng: () => number): number {
  return PICKUP_GAP_MIN + rng() * (PICKUP_GAP_MAX - PICKUP_GAP_MIN);
}

/** Altura do centro do próximo roteador: metade baixo, metade alto. */
export function nextPickupHeight(rng: () => number): number {
  return rng() < 0.5 ? PICKUP_LOW : PICKUP_HIGH_MIN + rng() * (PICKUP_HIGH_MAX - PICKUP_HIGH_MIN);
}

// ---- bônus, pontuação e vírus ---------------------------------------------------------------------------------------

export type PickupKind = 'router' | 'energy' | 'gun';

export const ENERGY_MS = 15000; // pontuação x3 por 15 s
export const ENERGY_MULT = 3;
export const GUN_SHOTS = 10; // arma de wifi: 10 disparos, o jogador escolhe quando atirar (espaço)
export const PX_PER_METER = 50; // 50 px de cenário = 1 m de distância
export const FIRE_COOLDOWN = 0.18; // segundos mínimos entre dois disparos
export const SHOT_SPEED = 720;
export const SHOT_R = 14;
export const VIRUS_R = 30; // raio do vírus (tiro acerta por aqui)
export const VIRUS_HIT_R = 25; // raio que machuca a personagem (um pouco menor que o desenho: mais justo)
export const VIRUS_LOW = 38; // altura do centro: no chão, exige saltar
export const VIRUS_HIGH = 80; // no ar, exige abaixar (ou atirar): a parte de baixo (55) fica entre a altura abaixada (43) e a de pé (61)
export const VIRUS_GAP_MIN = 800 / 1.3; // distância percorrida entre vírus (1,3x mais vírus que os 800–1500 anteriores)
export const VIRUS_GAP_MAX = 1500 / 1.3;

export interface Run {
  /** distância atravessada em metros (fracionária; com a energia ligada cada metro conta 3) */
  distance: number;
  energyMs: number;
  /** disparos restantes da arma de wifi (0 = sem arma) */
  gunAmmo: number;
  kills: number;
}

export const createRun = (): Run => ({ distance: 0, energyMs: 0, gunAmmo: 0, kills: 0 });
export const multiplier = (r: Run): number => (r.energyMs > 0 ? ENERGY_MULT : 1);

/** Avança a partida: soma a distância percorrida (`speed` em px/s; x3 com a energia) e gasta os bônus temporizados. */
export function tickRun(r: Run, dt: number, speed: number): void {
  r.distance += (speed * dt * multiplier(r)) / PX_PER_METER;
  r.energyMs = Math.max(0, r.energyMs - dt * 1000);
}

/** Distância inteira, em metros, que conta para a pontuação. */
export const distanceM = (r: Run): number => Math.floor(r.distance);

/** Pontuação final: distância atravessada (m) x vírus abatidos. */
export const scoreOf = (r: Run): number => distanceM(r) * r.kills;

/** Vírus abatido. Devolve quantos pontos ele acrescentou à pontuação (a distância atual). */
export function addKill(r: Run): number {
  r.kills += 1;
  return distanceM(r);
}
export const giveEnergy = (r: Run): void => void (r.energyMs = ENERGY_MS);
export const giveGun = (r: Run): void => void (r.gunAmmo = GUN_SHOTS);
/** Gasta um disparo. Devolve false se não há munição. */
export function useShot(r: Run): boolean {
  if (r.gunAmmo <= 0) return false;
  r.gunAmmo -= 1;
  return true;
}

export function circlesOverlap(ax: number, ay: number, ar: number, bx: number, by: number, br: number): boolean {
  const dx = ax - bx, dy = ay - by, rr = ar + br;
  return dx * dx + dy * dy <= rr * rr;
}

/** Sorteia o próximo bônus: roteador (jetpack), energia (x3) ou arma de wifi. */
export function pickPickupKind(rng: () => number): PickupKind {
  const v = rng();
  return v < 0.34 ? 'router' : v < 0.68 ? 'energy' : 'gun';
}

export const VIRUS_DENSITY_STEP = 0.1; // +10% de vírus a cada 10 s...
export const VIRUS_DENSITY_EVERY = 10;
export const VIRUS_DENSITY_MAX = 1.4; // ...até 40% a mais
/** Fator de população de vírus após `seconds` de partida (1 = inicial). */
export const virusDensityAt = (seconds: number): number =>
  Math.min(VIRUS_DENSITY_MAX, 1 + VIRUS_DENSITY_STEP * Math.floor(seconds / VIRUS_DENSITY_EVERY));
/** Distância até o próximo vírus; mais população = intervalo menor. */
export const nextVirusGap = (rng: () => number, density = 1): number => (VIRUS_GAP_MIN + rng() * (VIRUS_GAP_MAX - VIRUS_GAP_MIN)) / density;
export const nextVirusHeight = (rng: () => number): number => (rng() < 0.6 ? VIRUS_LOW : VIRUS_HIGH);
