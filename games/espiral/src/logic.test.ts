import { describe, expect, it } from 'vitest';
import {
  BALL_R,
  BOUNCE_SPEED,
  CHARGE_MAX,
  ROCKET_FLOORS,
  BALL_WORLD_ANGLE,
  FEVER_STREAK,
  FLOOR_THICK,
  SEG_ANGLE,
  SEGMENTS,
  RETA_MAX,
  RETA_MIN,
  Tower,
  floorY,
  gapStartOf,
  generateFloor,
  newBall,
  rng,
  segmentUnderBall,
  speedOf,
  step,
  type BallState,
  type Seg,
} from './logic';

/** Rotação da torre que deixa a fatia `seg` exatamente debaixo da bola. */
function rotationFor(seg: number): number {
  return BALL_WORLD_ANGLE - (seg + 0.5) * SEG_ANGLE;
}

/** Torre com andares fixos, para testar a física sem depender do sorteio. */
function fixedTower(floors: Seg[][]): Tower {
  const t = new Tower(1);
  floors.forEach((segs, i) => {
    const f = t.get(i);
    f.segs = [...segs];
  });
  return t;
}

const all = (s: Seg): Seg[] => new Array<Seg>(SEGMENTS).fill(s);
const withSeg = (base: Seg, seg: number, kind: Seg): Seg[] => {
  const a = all(base);
  a[seg] = kind;
  return a;
};

/** Solta a bola logo acima do andar `floor` e simula até o primeiro evento decisivo. */
function dropOn(tower: Tower, floor: number, rotation: number, ball?: Partial<BallState>) {
  const b: BallState = { ...newBall(), ...ball, y: floorY(floor) + FLOOR_THICK + BALL_R + 0.5, vy: -1 };
  const events = [];
  let next = floor;
  for (let i = 0; i < 2000; i++) {
    const r = step(b, tower, rotation, next, 1 / 120);
    next = r.nextFloor;
    events.push(...r.events);
    if (r.events.some((e) => e.type === 'bounce' || e.type === 'dead')) break;
  }
  return { ball: b, events, next };
}

describe('gerador', () => {
  it('a mesma semente gera a mesma torre', () => {
    const a = new Tower(42);
    const b = new Tower(42);
    for (let i = 0; i < 40; i++) expect(a.get(i).segs).toEqual(b.get(i).segs);
  });

  it('todo andar tem pelo menos um vão', () => {
    const t = new Tower(7);
    for (let i = 0; i < 200; i++) expect(t.get(i).segs).toContain('gap');
  });

  it('os primeiros andares não têm perigo', () => {
    const t = new Tower(3);
    for (let i = 0; i < 3; i++) expect(t.get(i).segs).not.toContain('danger');
  });

  it('a fatia logo abaixo do vão de cima nunca é perigosa', () => {
    const t = new Tower(99);
    for (let i = 1; i < 300; i++) {
      const prev = t.get(i - 1).segs;
      const cur = t.get(i).segs;
      prev.forEach((s, k) => {
        if (s === 'gap') expect(cur[k]).not.toBe('danger');
      });
    }
  });

  it('o perigo cresce com a profundidade e para em 5', () => {
    const count = (f: Seg[]) => f.filter((s) => s === 'danger').length;
    const r = rng(5);
    expect(count(generateFloor(4, r, []).segs)).toBe(1);
    expect(count(generateFloor(200, r, []).segs)).toBe(5);
  });
});

describe('física', () => {
  it('a fatia debaixo da bola segue a rotação', () => {
    for (let k = 0; k < SEGMENTS; k++) expect(segmentUnderBall(rotationFor(k))).toBe(k);
  });

  it('quica numa fatia sólida', () => {
    const t = fixedTower([all('solid')]);
    const { ball, events } = dropOn(t, 0, rotationFor(3));
    expect(events.at(-1)).toMatchObject({ type: 'bounce', floor: 0, seg: 3 });
    expect(ball.vy).toBeGreaterThan(0);
  });

  it('atravessa o vão e conta o andar', () => {
    const t = fixedTower([withSeg('solid', 5, 'gap'), all('solid')]);
    const { events, next } = dropOn(t, 0, rotationFor(5));
    expect(events.map((e) => e.type)).toEqual(['pass', 'bounce']);
    expect(next).toBe(1);
    expect(t.get(0).broken).toBe(true);
  });

  it('morre na fatia perigosa', () => {
    const t = fixedTower([withSeg('solid', 2, 'danger')]);
    const { events } = dropOn(t, 0, rotationFor(2));
    expect(events.at(-1)).toMatchObject({ type: 'dead', seg: 2 });
  });

  it('o escudo salva uma vez e some', () => {
    const t = fixedTower([withSeg('solid', 2, 'danger')]);
    const { ball, events } = dropOn(t, 0, rotationFor(2), { shield: true });
    expect(events.map((e) => e.type)).toEqual(['shield-used', 'bounce']);
    expect(ball.shield).toBe(false);
  });

  it('pegar o bônus dá escudo', () => {
    const t = fixedTower([withSeg('solid', 8, 'bonus')]);
    const { ball, events } = dropOn(t, 0, rotationFor(8));
    expect(events[0]).toMatchObject({ type: 'shield-got' });
    expect(ball.shield).toBe(true);
    expect(t.get(0).segs[8]).toBe('solid');
  });

  it(`depois de ${FEVER_STREAK} andares seguidos, quebra até o perigo`, () => {
    const gap = withSeg('solid', 0, 'gap');
    const t = fixedTower([gap, gap, gap, all('danger'), all('solid')]);
    const { events } = dropOn(t, 0, rotationFor(0));
    const types = events.map((e) => e.type);
    expect(types).toContain('break');
    expect(types).not.toContain('dead');
    expect(t.get(3).broken).toBe(true);
    // Não quica no ar onde estava o andar quebrado: o primeiro quique é no andar de baixo.
    expect(events.find((e) => e.type === 'bounce')).toMatchObject({ floor: 4 });
    expect(types.filter((e) => e === 'pass')).toHaveLength(4);
  });

  it('pouso de impacto: depois da quebra pela sequência, cair na alta tensão queima a placa em vez de matar', () => {
    const gap = withSeg('solid', 0, 'gap');
    // o caso do jogo: 3 vãos alinhados, o 4º andar quebra e o 5º tem alta tensão bem embaixo
    const t = fixedTower([gap, gap, gap, all('solid'), withSeg('solid', 0, 'danger'), all('solid')]);
    const { ball, events } = dropOn(t, 0, rotationFor(0));
    const types = events.map((e) => e.type);
    expect(types).not.toContain('dead');
    expect(events.find((e) => e.type === 'impact')).toMatchObject({ floor: 4, seg: 0 });
    expect(t.get(4).segs[0]).toBe('solid');
    expect(events.at(-1)).toMatchObject({ type: 'bounce', floor: 4 });
    expect(ball.impacto).toBe(false); // vale só para um pouso
  });

  it('o impacto vale só para o pouso logo depois da quebra', () => {
    const t = fixedTower([withSeg('solid', 0, 'danger')]);
    const { events } = dropOn(t, 0, rotationFor(0), { impacto: false });
    expect(events.at(-1)).toMatchObject({ type: 'dead' });
  });

  it('o quique não alcança o andar de cima', () => {
    const t = fixedTower([all('solid')]);
    const b: BallState = { ...newBall(), y: floorY(1) + FLOOR_THICK + BALL_R, vy: BOUNCE_SPEED };
    let maxY = b.y;
    for (let i = 0; i < 240; i++) {
      step(b, t, 0, 1, 1 / 120);
      maxY = Math.max(maxY, b.y);
    }
    expect(maxY + BALL_R).toBeLessThan(floorY(0));
  });

  it('cada andar atravessado carrega o foguete', () => {
    const t = fixedTower([all('gap'), all('gap'), all('solid')]);
    const { ball } = dropOn(t, 0, rotationFor(0));
    expect(ball.charge).toBe(2);
    expect(ball.rocket).toBe(0);
  });

  it('barra cheia liga o foguete: quebra tudo, até alta tensão, e pousa seguro no fim', () => {
    const floors: Seg[][] = [];
    for (let i = 0; i < CHARGE_MAX; i++) floors.push(all('gap'));
    for (let i = 0; i < ROCKET_FLOORS; i++) floors.push(i % 2 ? all('danger') : all('solid'));
    floors.push(all('danger')); // pouso final em cima da alta tensão
    const t = fixedTower(floors);
    const { ball, events } = dropOn(t, 0, rotationFor(0));
    const types = events.map((e) => e.type);
    expect(types).toContain('rocket-start');
    expect(types).not.toContain('dead');
    expect(types.filter((x) => x === 'break')).toHaveLength(ROCKET_FLOORS);
    expect(events.find((e) => e.type === 'rocket-end')).toMatchObject({ floor: CHARGE_MAX + ROCKET_FLOORS });
    expect(events.at(-1)).toMatchObject({ type: 'bounce', floor: CHARGE_MAX + ROCKET_FLOORS });
    expect(ball.charge).toBe(0);
    expect(ball.safeLanding).toBe(false);
    // Depois do pouso seguro, a alta tensão volta a matar.
    expect(dropOn(t, CHARGE_MAX + ROCKET_FLOORS, rotationFor(0)).events.at(-1)).toMatchObject({ type: 'dead' });
  });

  it('gera retas: trechos de andares com o vão alinhado, de RETA_MIN a RETA_MAX andares', () => {
    const t = new Tower(2024);
    const inicios = Array.from({ length: 300 }, (_, i) => gapStartOf(t.get(i)));
    expect(inicios.every((g) => g !== undefined)).toBe(true);
    // tamanho de cada trecho com o mesmo vão seguido
    const trechos: number[] = [];
    let n = 1;
    for (let i = 1; i < inicios.length; i++) {
      if (inicios[i] === inicios[i - 1]) n++;
      else { trechos.push(n); n = 1; }
    }
    const retas = trechos.filter((x) => x >= RETA_MIN);
    expect(retas.length).toBeGreaterThan(20); // muitas retas em 300 andares
    // depois de uma reta vem um andar com o vão em outro lugar: retas não emendam
    expect(Math.max(...trechos)).toBeLessThanOrEqual(RETA_MAX);
    // a fatia logo abaixo de um vão nunca é perigosa, então a reta é segura de despencar
    for (let i = 1; i < 300; i++) {
      const g = inicios[i - 1]!;
      expect(t.get(i).segs[g]).not.toBe('danger');
    }
  });

  it('a velocidade sobe por marco e tem teto', () => {
    expect(speedOf(0)).toBe(1);
    expect(speedOf(5)).toBeCloseTo(1.3);
    expect(speedOf(50)).toBe(1.5);
  });
});
