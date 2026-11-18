import { describe, expect, it } from 'vitest';
import {
  aimTilt,
  BIRD_R,
  branchChance,
  branchRange,
  branchSlot,
  branchSurfaceY,
  BRANCH_NEST_RANGE,
  FROG_AMP_MAX,
  FROG_LIFT,
  FROG_MAX_GAP,
  FROG_MIN_DX,
  firstSlot,
  GAP_END,
  gapRange,
  hitsMonkey,
  launchVelocity,
  MAX_PULL,
  MAX_TILT,
  MIN_PULL,
  batCount,
  moveChance,
  NEST_MOUTH_Y,
  newScore,
  nextSlot,
  nextWaveGap,
  newStuckWatch,
  watchStuck,
  pickBatPatterns,
  batSwing,
  BAT_PATTERNS,
  NEST_SINK,
  FIRST_WAVE_AT,
  frogChance,
  rollComboBird,
  afterMiss,
  WAVE_STONES,
  SAME_SIDE_MIN_GAP,
  SAME_SIDE_MAX_GAP,
  scoreCatch,
  shelfSlot,
  slingTip,
  stepStone,
  stoneHits,
  V_MAX,
  visibleAimPoints,
  WORLD_W,
  type Side,
  type SlotInfo,
  type Stone,
  type Vec,
} from './logic';

/** Procura um lançamento (ângulo e força) que coloque a pedra no ninho. */
function findShot(feet: Vec, at: Vec): { angle: number; power: number; walls: number } | null {
  const nest = { x: at.x, y: at.y + NEST_SINK }; // a base do ninho fica um pouco abaixo da superfície do apoio
  for (let power = 0.3; power <= 1.0001; power += 0.02) {
    for (let deg = -175; deg <= -5; deg += 1) {
      const a = (deg * Math.PI) / 180;
      const right = Math.cos(a) > 0;
      const tip = slingTip(feet, right);
      const st: Stone = { x: tip.x, y: tip.y, vx: Math.cos(a) * V_MAX * power, vy: Math.sin(a) * V_MAX * power };
      let walls = 0;
      for (let i = 0; i < 240 * 4; i++) {
        const ev = stepStone(st, 1 / 240, nest);
        if (ev.wall) walls++;
        if (ev.entered) return { angle: deg, power, walls };
        if (st.y > feet.y + 400) break;
      }
    }
  }
  return null;
}

/** Apoios possíveis numa altura: orelha e galho nas pontas da faixa, dos dois lados. */
function variants(index: number, y: number): SlotInfo[] {
  const out: SlotInfo[] = [];
  for (const side of ['left', 'right'] as Side[]) {
    out.push(shelfSlot(index, side, y));
    for (const lx of BRANCH_NEST_RANGE) out.push(branchSlot(index, side, y, lx));
  }
  return out;
}

describe('apoios', () => {
  it('o primeiro apoio é a orelha da direita', () => {
    const s = firstSlot();
    expect(s.side).toBe('right');
    expect(s.kind).toBe('shelf');
    expect(s.x).toBeGreaterThan(WORLD_W / 2);
  });

  it('no galho, o ninho fica entre o tronco e o meio da tela, e a superfície acompanha o galho', () => {
    const [a, b] = branchRange('left');
    expect(a).toBeLessThan(200);
    expect(b).toBeGreaterThan(WORLD_W / 2 - 20);
    const [c, d] = branchRange('right');
    expect(c).toBeCloseTo(WORLD_W - b);
    expect(d).toBeCloseTo(WORLD_W - a);
    const s = branchSlot(5, 'left', -1000, 150);
    expect(branchSurfaceY(s, s.x)).toBeCloseTo(-1000);
  });

  it('o sorteio sobe sempre, respeita a faixa de altura e afasta apoios do mesmo lado', () => {
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    let s = firstSlot();
    let sameSide = 0;
    let branches = 0;
    for (let i = 0; i < 400; i++) {
      const n = nextSlot(s, rnd);
      const gap = s.y - n.y;
      const [gmin, gmax] = gapRange(s.index);
      expect(gap).toBeGreaterThanOrEqual(gmin - 1e-9);
      expect(gap).toBeLessThanOrEqual(Math.max(gmax, SAME_SIDE_MIN_GAP) + 1e-9);
      if (n.side === s.side) expect(gap).toBeLessThanOrEqual(SAME_SIDE_MAX_GAP + 1e-9);
      if (n.side === s.side) {
        sameSide++;
        expect(gap).toBeGreaterThanOrEqual(SAME_SIDE_MIN_GAP);
      }
      if (n.kind === 'branch') branches++;
      s = n;
    }
    expect(sameSide).toBeGreaterThan(50);
    expect(branches).toBeGreaterThan(80);
  });

  it('a faixa de altura abre com os acertos', () => {
    const [a0, b0] = gapRange(0);
    const [a1, b1] = gapRange(40);
    expect(a1).toBeLessThan(a0);
    expect(b1).toBeGreaterThan(b0);
  });
});

describe('todo ninho é alcançável', () => {
  // o pior caso de altura (540) entre todas as combinações de lado, orelha e galho (pontas da faixa)
  it('altura máxima, todas as combinações', () => {
    for (const from of variants(0, 0)) {
      for (const to of [...variants(1, -GAP_END[1]).filter((t) => t.side !== from.side), ...variants(1, -SAME_SIDE_MAX_GAP).filter((t) => t.side === from.side)]) {
        const shot = findShot(from, to);
        expect(shot, `${from.side}/${from.kind}@${from.x.toFixed(0)} -> ${to.side}/${to.kind}@${to.x.toFixed(0)}`).not.toBeNull();
      }
    }
  }, 120_000);

  it('altura mínima do mesmo lado (logo acima, precisa de tabela ou arco)', () => {
    for (const from of variants(0, 0)) {
      for (const to of variants(1, -SAME_SIDE_MIN_GAP).filter((t) => t.side === from.side)) {
        expect(findShot(from, to), `${from.kind}@${from.x.toFixed(0)} -> ${to.kind}@${to.x.toFixed(0)}`).not.toBeNull();
      }
    }
  }, 120_000);

  it('ninho do sapo no ponto mais alto (orelha do outro lado, até FROG_MAX_GAP acima)', () => {
    const top = FROG_LIFT + FROG_AMP_MAX;
    for (const from of variants(0, 0)) {
      for (const gap of [GAP_END[0], FROG_MAX_GAP]) {
        for (const to of variants(1, -gap).filter((t) => t.kind === 'shelf' && t.side !== from.side)) {
          expect(Math.abs(to.x - from.x)).toBeGreaterThanOrEqual(FROG_MIN_DX);
          expect(findShot(from, { x: to.x, y: to.y - top })).not.toBeNull();
        }
      }
    }
  }, 120_000);

  it('o sorteio põe o sapo numa orelha do outro lado, perto o bastante', () => {
    let seed = 5;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    let s = firstSlot();
    let frogs = 0;
    let branches = 0;
    for (let i = 0; i < 400; i++) {
      const n = nextSlot(s, rnd);
      if (n.frog) {
        frogs++;
        expect(n.kind).toBe('shelf');
        expect(n.side).not.toBe(s.side);
        expect(s.y - n.y).toBeLessThanOrEqual(FROG_MAX_GAP + 1e-9);
        expect(n.index).toBeGreaterThan(10);
      }
      if (n.kind === 'branch') {
        branches++;
        expect(n.index).toBeGreaterThan(10);
      }
      s = n;
    }
    expect(frogs).toBeGreaterThan(100);
    expect(branches).toBeGreaterThan(100);
  });
});

describe('física', () => {
  it('a borda da tela rebate a pedra', () => {
    const st: Stone = { x: WORLD_W - 12, y: 0, vx: 900, vy: 0 };
    const ev = stepStone(st, 1 / 60, null);
    expect(ev.wall).toBe(true);
    expect(st.vx).toBeLessThan(0);
  });

  it('a pedra que desce pela boca entra no ninho', () => {
    const nest = { x: 300, y: 500 };
    const st: Stone = { x: 300, y: nest.y + NEST_MOUTH_Y - 4, vx: 0, vy: 300 };
    expect(stepStone(st, 1 / 60, nest).entered).toBe(true);
  });

  it('a pedra que vem por baixo passa direto pelo apoio e pelo ninho, e não vale cair de volta nele', () => {
    const nest = { x: 300, y: 500 };
    const st: Stone = { x: 300, y: 560, vx: 0, vy: -900 };
    let entered = false;
    let touched = false;
    for (let i = 0; i < 240; i++) {
      const ev = stepStone(st, 1 / 240, nest);
      entered ||= ev.entered;
      touched ||= ev.nestTouch;
    }
    expect(touched).toBe(false); // sem física no fundo do ninho nem no apoio
    expect(st.y).toBeGreaterThan(nest.y); // subiu, parou e caiu de volta, atravessando
    expect(entered).toBe(false); // entrou por baixo: não conta
  });

  it('a pedra rebate no pássaro', () => {
    const st: Stone = { x: 300, y: 300, vx: 0, vy: -600 };
    let hit = false;
    for (let i = 0; i < 60; i++) hit ||= stepStone(st, 1 / 240, null, [{ x: 300, y: 260, r: BIRD_R }]).obstacle;
    expect(hit).toBe(true);
    expect(st.vy).toBeGreaterThan(0);
  });

  it('pedra caindo no macaco é pega (segunda chance), subindo não', () => {
    const feet = { x: 500, y: 600 };
    expect(hitsMonkey({ x: 500, y: 550, vx: 0, vy: 200 }, feet)).toBe(true);
    expect(hitsMonkey({ x: 500, y: 550, vx: 0, vy: -200 }, feet)).toBe(false);
    expect(hitsMonkey({ x: 200, y: 550, vx: 0, vy: 200 }, feet)).toBe(false);
  });

  it('arrasto curto não atira; arrasto longo fica limitado', () => {
    expect(launchVelocity({ x: MIN_PULL - 1, y: 0 })).toBeNull();
    const v = launchVelocity({ x: 0, y: MAX_PULL * 3 })!;
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(V_MAX);
  });
});

describe('pedra presa', () => {
  it('parada num canto por mais de 1,2 s: presa', () => {
    const w = newStuckWatch(700, 100);
    let stuck = false;
    for (let i = 0; i < 240 * 1.3 && !stuck; i++) stuck = watchStuck(w, 700 + Math.sin(i) * 10, 100 + Math.cos(i) * 10, 1 / 240);
    expect(stuck).toBe(true);
  });

  it('um tiro normal (inclusive reto para cima, passando pelo alto do arco) não é considerado preso', () => {
    for (const v of [{ x: 0, y: -1500 }, { x: 600, y: -1800 }, { x: -1200, y: -900 }]) {
      const st: Stone = { x: 360, y: 0, vx: v.x, vy: v.y };
      const w = newStuckWatch(st.x, st.y);
      for (let i = 0; i < 240 * 3; i++) {
        stepStone(st, 1 / 240, null);
        expect(watchStuck(w, st.x, st.y, 1 / 240)).toBe(false);
      }
    }
  });
});

describe('morcegos', () => {
  it('3 pedras por onda; cada erro tira 20% dos pontos, arredondado', () => {
    expect(WAVE_STONES).toBe(3);
    expect(afterMiss(100)).toBe(80);
    expect(afterMiss(7)).toBe(6); // 5,6 -> 6
    expect(afterMiss(0)).toBe(0);
  });

  it('onda a cada 8 a 10 ninhos; 1, depois 2 (30) e 3 (60) morcegos', () => {
    expect(FIRST_WAVE_AT).toBe(3);
    expect(nextWaveGap(() => 0)).toBe(5);
    expect(nextWaveGap(() => 0.999)).toBe(10);
    expect(batCount(24)).toBe(1);
    expect(batCount(25)).toBe(2);
    expect(batCount(60)).toBe(3);
  });

  it('os morcegos de uma onda seguem padrões diferentes', () => {
    for (let k = 0; k < 20; k++) {
      const ps = pickBatPatterns(3, Math.random);
      expect(new Set(ps).size).toBe(3);
    }
    // seno e triângulo ficam dentro da largura do padrão e passam pelos dois lados
    for (const p of BAT_PATTERNS) {
      const xs = Array.from({ length: 200 }, (_, i) => batSwing(p, i * 0.02));
      expect(Math.max(...xs)).toBeLessThanOrEqual(p.amp + 1e-9);
      expect(Math.min(...xs)).toBeGreaterThanOrEqual(-p.amp - 1e-9);
      expect(Math.max(...xs)).toBeGreaterThan(p.amp * 0.8);
    }
  });

  it('a pedra acerta o morcego', () => {
    expect(stoneHits({ x: 100, y: 100, vx: 0, vy: 0 }, { x: 130, y: 120, r: 30 })).toBe(true);
    expect(stoneHits({ x: 100, y: 100, vx: 0, vy: 0 }, { x: 200, y: 200, r: 30 })).toBe(false);
  });
});

describe('mira', () => {
  it('mostra a subida e só o primeiro ponto da descida', () => {
    const pts = [{ x: 0, y: 90 }, { x: 0, y: 80 }, { x: 0, y: 75 }, { x: 0, y: 78 }, { x: 0, y: 90 }];
    expect(visibleAimPoints(pts, { x: 0, y: 100 })).toHaveLength(4);
  });

  it('o macaco gira para o lado da mira, com limite', () => {
    expect(aimTilt({ x: -1, y: 0 }, false)).toBeCloseTo(0);
    expect(aimTilt({ x: 1, y: 0 }, true)).toBeCloseTo(0);
    expect(aimTilt({ x: -1, y: -1 }, false)).toBeCloseTo(Math.PI / 4);
    expect(aimTilt({ x: 1, y: -1 }, true)).toBeCloseTo(-Math.PI / 4);
    expect(Math.abs(aimTilt({ x: 0.01, y: -1 }, true))).toBeLessThanOrEqual(MAX_TILT + 1e-9);
  });

  it('a ponta do estilingue acompanha o giro', () => {
    const feet = { x: 300, y: 500 };
    expect(slingTip(feet, false, Math.PI / 4).y).toBeLessThan(slingTip(feet, false, 0).y);
  });
});

describe('pontuação', () => {
  it('acerto comum vale 1; limpos seguidos valem 2, 3, 4; encostar zera a sequência', () => {
    const s = newScore();
    expect(scoreCatch(s, false, 0).points).toBe(1);
    expect(scoreCatch(s, true, 0).points).toBe(2);
    expect(scoreCatch(s, true, 0).points).toBe(3);
    expect(scoreCatch(s, true, 0).points).toBe(4);
    expect(scoreCatch(s, false, 0).points).toBe(1);
    expect(s.streak).toBe(0);
    expect(s.bestStreak).toBe(3);
    expect(s.score).toBe(11);
    expect(s.hits).toBe(5);
  });

  it('tabela na parede soma 1', () => {
    const s = newScore();
    expect(scoreCatch(s, false, 2).points).toBe(2);
    expect(scoreCatch(s, true, 1).points).toBe(3);
  });

  it('a partir do nível 15, ninho que se mexe pode vir com pássaro no movimento contrário', () => {
    expect(rollComboBird('h', 14, () => 0)).toBeNull();
    expect(rollComboBird('h', 15, () => 0)).toBe('v');
    expect(rollComboBird('v', 15, () => 0)).toBe('h');
    expect(rollComboBird('h', 15, () => 0.99)).toBeNull();
    expect(branchChance(10)).toBeGreaterThanOrEqual(0.4);
  });

  it('o ninho se mexe só depois de 8 acertos, e o galho (onde o ninho sempre desliza) também só aparece a partir daí', () => {
    expect(moveChance(9)).toBe(0);
    expect(moveChance(10)).toBeGreaterThan(0);
    expect(branchChance(9)).toBe(0);
    expect(branchChance(10)).toBeGreaterThan(0);
    expect(frogChance(9)).toBe(0);
    expect(frogChance(10)).toBeGreaterThanOrEqual(0.3);
  });
});
