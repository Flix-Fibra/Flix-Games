import { describe, expect, it } from 'vitest';
import {
  ENERGY_MS, GUN_MS, addKill, circlesOverlap, createRun, giveEnergy, giveGun, multiplier, pickPickupKind, tickRun,
  VIRUS_GAP_MAX, VIRUS_GAP_MIN, nextVirusGap, nextVirusHeight,
  JETPACK_CEILING, JETPACK_MS, PICKUP_GAP_MAX, PICKUP_GAP_MIN, SPEED_MAX, circleHitsBox, createPlayer, giveJetpack, hitbox,
  mulberry32, nextPickupGap, nextPickupHeight, onGround, speedAt, stepPlayer, type Controls,
} from './logic';

const none: Controls = { jumpHeld: false, jumpPressed: false, duckHeld: false };
const run = (p: ReturnType<typeof createPlayer>, c: Controls, secs: number, dt = 1 / 60) => {
  let maxY = 0;
  for (let t = 0; t < secs; t += dt) {
    stepPlayer(p, c, dt);
    maxY = Math.max(maxY, p.y);
  }
  return maxY;
};

describe('salto', () => {
  it('sobe cerca de 150 px e volta ao chão', () => {
    const p = createPlayer();
    stepPlayer(p, { jumpHeld: true, jumpPressed: true, duckHeld: false }, 1 / 60);
    const max = run(p, { ...none, jumpHeld: true }, 1.2);
    expect(max).toBeGreaterThan(130);
    expect(max).toBeLessThan(170);
    expect(onGround(p)).toBe(true);
  });
  it('soltar o botão cedo faz um salto mais baixo', () => {
    const p = createPlayer();
    stepPlayer(p, { jumpHeld: true, jumpPressed: true, duckHeld: false }, 1 / 60);
    const max = run(p, none, 1.2);
    expect(max).toBeLessThan(80);
  });
  it('não salta no ar', () => {
    const p = createPlayer();
    p.y = 100;
    p.vy = -50;
    stepPlayer(p, { jumpHeld: true, jumpPressed: true, duckHeld: false }, 1 / 60);
    expect(p.vy).toBeLessThan(0);
  });
});

describe('abaixar', () => {
  it('só no chão e solta ao soltar a tecla', () => {
    const p = createPlayer();
    stepPlayer(p, { ...none, duckHeld: true }, 1 / 60);
    expect(p.ducking).toBe(true);
    expect(hitbox(p, 0).y1).toBeLessThan(hitbox(createPlayer(), 0).y1);
    stepPlayer(p, none, 1 / 60);
    expect(p.ducking).toBe(false);
  });
});

describe('jetpack wifi', () => {
  it('segurando o botão sobe e para no teto', () => {
    const p = createPlayer();
    giveJetpack(p);
    const max = run(p, { ...none, jumpHeld: true }, 3);
    expect(max).toBeCloseTo(JETPACK_CEILING, 0);
    expect(p.thrusting).toBe(true);
  });
  it('sem segurar flutua para baixo devagar', () => {
    const p = createPlayer();
    giveJetpack(p);
    p.y = 200;
    run(p, none, 0.3);
    expect(p.y).toBeGreaterThan(100);
    expect(p.vy).toBeGreaterThanOrEqual(-380);
  });
  it('acaba depois de JETPACK_MS e o personagem cai', () => {
    const p = createPlayer();
    giveJetpack(p);
    run(p, { ...none, jumpHeld: true }, JETPACK_MS / 1000 + 0.05);
    expect(p.jetMs).toBe(0);
    run(p, none, 2);
    expect(onGround(p)).toBe(true);
  });
  it('pegar outro renova o tempo', () => {
    const p = createPlayer();
    giveJetpack(p);
    run(p, none, 3);
    giveJetpack(p);
    expect(p.jetMs).toBe(JETPACK_MS);
  });
});

describe('colisão e sorteio', () => {
  it('círculo toca a caixa do personagem', () => {
    const b = hitbox(createPlayer(), 250);
    expect(circleHitsBox(250, 50, 30, b)).toBe(true);
    expect(circleHitsBox(250, 220, 30, b)).toBe(false);
    expect(circleHitsBox(330, 50, 30, b)).toBe(false);
  });
  it('velocidade cresce e tem teto', () => {
    expect(speedAt(0)).toBe(192);
    expect(speedAt(2)).toBeCloseTo(192 * 1.01, 5);
    expect(speedAt(60)).toBeCloseTo(192 * 1.3, 5);
    expect(speedAt(0)).toBeLessThan(speedAt(10));
    expect(speedAt(9999)).toBe(SPEED_MAX);
  });
  it('distância e altura do roteador ficam nas faixas', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 200; i++) {
      const g = nextPickupGap(r);
      expect(g).toBeGreaterThanOrEqual(PICKUP_GAP_MIN);
      expect(g).toBeLessThanOrEqual(PICKUP_GAP_MAX);
      const h = nextPickupHeight(r);
      expect(h === 46 || (h >= 170 && h <= 230)).toBe(true);
    }
  });
});

describe('pontuação e bônus', () => {
  it('cada segundo vale 10 pontos', () => {
    const r = createRun();
    for (let i = 0; i < 60; i++) tickRun(r, 1 / 60);
    expect(Math.floor(r.score + 1e-6)).toBe(10);
  });
  it('energia triplica o tempo e os vírus por 15 s e depois acaba', () => {
    const r = createRun();
    giveEnergy(r);
    expect(multiplier(r)).toBe(3);
    tickRun(r, 1);
    expect(r.score).toBeCloseTo(30, 5);
    expect(addKill(r)).toBe(150);
    for (let i = 0; i < 14; i++) tickRun(r, 1);
    expect(r.energyMs).toBe(0);
    expect(multiplier(r)).toBe(1);
    const before = r.score;
    tickRun(r, 1);
    expect(r.score - before).toBeCloseTo(10, 5);
    expect(ENERGY_MS).toBe(15000);
  });
  it('vírus abatido vale 50 sem energia', () => {
    const r = createRun();
    expect(addKill(r)).toBe(50);
    expect(r.kills).toBe(1);
  });
  it('arma de wifi dura GUN_MS', () => {
    const r = createRun();
    giveGun(r);
    expect(r.gunMs).toBe(GUN_MS);
    tickRun(r, GUN_MS / 1000 + 0.1);
    expect(r.gunMs).toBe(0);
  });
  it('círculos: tiro acerta o vírus', () => {
    expect(circlesOverlap(100, 50, 14, 130, 50, 30)).toBe(true);
    expect(circlesOverlap(100, 50, 14, 200, 50, 30)).toBe(false);
  });
  it('sorteios ficam nas faixas e todos os bônus saem', () => {
    const rng = mulberry32(3);
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      seen.add(pickPickupKind(rng));
      const g = nextVirusGap(rng);
      expect(g).toBeGreaterThanOrEqual(VIRUS_GAP_MIN);
      expect(g).toBeLessThanOrEqual(VIRUS_GAP_MAX);
      expect([38, 112]).toContain(nextVirusHeight(rng));
    }
    expect(seen.size).toBe(3);
  });
});
