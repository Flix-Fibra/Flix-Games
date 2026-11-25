import { appendFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import { DT, MAX_STROKES, createHole, settle, shoot, shootFromCannon, step, type HoleState, type Level } from '../src/logic';
import { LEVELS } from '../src/levels';

/**
 * Robô que joga cada fase sozinho para provar que dá para chegar ao buraco e para calibrar o par.
 * Só roda com SOLVE=1 (demora): `SOLVE=1 npx vitest run games/minigolfe/tools/levels.solve.test.ts`.
 * Mostra, por fase, quantas tentativas encaçaparam e o MENOR número de tacadas que o robô achou (o par deve ficar perto dele).
 */
const RUN = process.env.SOLVE === '1';
const ONLY = process.env.LEVEL; // ex.: LEVEL=moinho
const TRIALS = Number(process.env.TRIALS ?? 40);
const CANDIDATES = 14;

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clone = (h: HoleState): HoleState => ({ ...h, ball: { ...h.ball }, lastRest: { ...h.lastRest } });

interface Action {
  wait: number;
  angle: number;
  power: number;
}

function play(h0: HoleState, a: Action): HoleState {
  const h = clone(h0);
  for (let t = 0; t < a.wait; t += DT) step(h);
  if (h.held !== null) shootFromCannon(h, a.power);
  else shoot(h, a.angle, a.power);
  settle(h, 14);
  return h;
}

function solve(l: Level, seed: number): { sunk: number; tries: number; best: number } {
  const rnd = mulberry(seed);
  let best = Infinity;
  let sunk = 0;
  for (let trial = 0; trial < TRIALS; trial++) {
    let h = createHole(l);
    for (let guard = 0; guard < 40 && !h.sunk && !h.gaveUp; guard++) {
      const toHole = Math.atan2(l.hole.y - h.ball.y, l.hole.x - h.ball.x);
      const make = (): Action => ({
        wait: rnd() * 3,
        angle: rnd() < 0.6 ? toHole + (rnd() - 0.5) * 1.1 : rnd() * Math.PI * 2,
        power: 0.15 + rnd() * 0.85,
      });
      let chosen = make();
      if (rnd() < 0.6) {
        let bestScore = Infinity;
        for (let k = 0; k < CANDIDATES; k++) {
          const a = make();
          const r = play(h, a);
          const score = r.sunk ? -1000 : r.gaveUp ? 1e6 : Math.hypot(l.hole.x - r.ball.x, l.hole.y - r.ball.y) + (r.strokes - h.strokes - 1) * 3;
          if (score < bestScore) {
            bestScore = score;
            chosen = a;
          }
        }
      }
      h = play(h, chosen);
    }
    if (h.sunk) {
      sunk++;
      best = Math.min(best, h.strokes);
    }
  }
  return { sunk, tries: TRIALS, best };
}

describe.skipIf(!RUN)('robô: toda fase tem solução', () => {
  const levels = ONLY ? LEVELS.filter((l) => l.id === ONLY) : LEVELS;
  it.each(levels.map((l) => [l.id, l] as const))('%s', (_id, l) => {
    const t0 = Date.now();
    const r = solve(l, 12345);
    appendFileSync(process.env.SOLVE_OUT ?? 'solve.log', `${l.id.padEnd(18)} par ${l.par}  encaçapou ${r.sunk}/${r.tries}  melhor ${r.best === Infinity ? '-' : r.best} (limite ${MAX_STROKES})  ${((Date.now() - t0) / 1000).toFixed(1)}s
`);
    if (r.sunk === 0) throw new Error(`o robô não conseguiu encaçapar "${l.id}" em ${r.tries} tentativas`);
  }, 600_000);
});
