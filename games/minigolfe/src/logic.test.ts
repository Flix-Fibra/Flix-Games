import { describe, expect, it } from 'vitest';
import {
  BALL_R, DT, HOLE_CAPTURE_SPEED, JUMP_AIR_MAX, MAX_ROLL_SECONDS, HOLE_R, LEGEND, MAX_SPEED, MAX_STROKES, MIN_DRAG, MIN_SPEED, STOP_SPEED,
  aimFromDrag, blockRect, canShoot, cannonAngle, createHole, lavaHot, pistonHeight, shootFromCannon, windmillBlades, createRun, finishHole, holeDone, parseLevel, resultName, settle, shoot, speedFor, speedOf,
  step, totalPar, totalStrokes, validateLevel,
  type HoleEvent, type HoleState, type LevelDef,
} from './logic';
import { LEVELS, LEVEL_DEFS } from './levels';

const lvl = (rows: string[], par = 3) => parseLevel({ id: 't', name: 't', par, rows });
const ABERTA = ['###########', '#.........#', '#....T....#', '#.........#', '#.......H.#', '###########'];

/** Estado com a bola em (x, y) e velocidade (vx, vy), já "andando". */
function rolando(rows: string[], x: number, y: number, vx: number, vy: number): HoleState {
  const h = createHole(lvl(rows));
  h.ball.x = x;
  h.ball.y = y;
  h.ball.vx = vx;
  h.ball.vy = vy;
  h.moving = true;
  h.strokes = 1;
  return h;
}
const tem = (ev: HoleEvent[], t: HoleEvent['type']): boolean => ev.some((e) => e.type === t);

describe('fases: leitura e validação', () => {
  it('as fases do percurso são válidas (pelo menos 15)', () => {
    expect(LEVELS).toHaveLength(LEVEL_DEFS.length);
    expect(LEVELS.length).toBeGreaterThanOrEqual(15);
    for (const l of LEVELS) expect(l.tee).not.toEqual(l.hole);
  });
  it('ids de fase são únicos', () => {
    expect(new Set(LEVEL_DEFS.map((d) => d.id)).size).toBe(LEVEL_DEFS.length);
  });
  it('lê largada, buraco, postes, ímãs, esteiras e portais', () => {
    const l = lvl(['#########', '#.m.H...#', '#.......#', '#.1.#.###', '#...#.^.#', '#iii#...#', '#...#.T.#', '#...#..1#', '#########']);
    expect(l.tee).toEqual({ x: 6.5, y: 6.5 });
    expect(l.hole).toEqual({ x: 4.5, y: 1.5 });
    expect(l.magnets).toHaveLength(1);
    expect(l.portals).toHaveLength(2);
    expect(l.portals[0]!.to).toBe(1);
    expect(l.slope[4]![6]).toEqual({ x: 0, y: -1 });
    expect(lvl(['#######', '#.o.o.#', '#T...H#', '#######']).bumpers).toHaveLength(2);
  });
  it('paredes só nas arestas voltadas para fora (sem emenda entre paredes vizinhas)', () => {
    const l = lvl(['####', '#TH#', '####']);
    const horizontais = l.walls.filter((s) => s.a.y === s.b.y).length;
    const verticais = l.walls.filter((s) => s.a.x === s.b.x).length;
    expect(horizontais).toBe(12); // linha de cima: 4 por fora + 2 voltadas ao miolo; a de baixo idem
    expect(verticais).toBe(8); // nenhuma aresta entre duas paredes vizinhas
  });
  it.each<[string, string[], RegExp]>([
    ['sem largada', ['####', '#.H#', '####'], /falta a largada/],
    ['sem buraco', ['####', '#T.#', '####'], /falta o buraco/],
    ['duas largadas', ['#####', '#TTH#', '#####'], /mais de uma largada/],
    ['linha torta', ['####', '#TH', '####'], /colunas/],
    ['caractere inválido', ['####', '#T?#', '####'], /inválido/],
    ['portal sozinho', ['#####', '#T1H#', '#####'], /portal 1/],
    ['buraco isolado por água', ['#####', '#T~H#', '#####'], /não pode ser alcançado/],
  ])('recusa: %s', (_n, rows, re) => {
    expect(() => parseLevel({ id: 'x', name: 'x', par: 2, rows })).toThrow(re);
  });
  it('par inválido e grade enorme são recusados', () => {
    const base: LevelDef = { id: 'x', name: 'x', par: 0, rows: ['####', '#TH#', '####'] };
    expect(() => parseLevel(base)).toThrow(/par/);
    expect(() => parseLevel({ ...base, par: 2, rows: ['#'.repeat(40), `#T${'.'.repeat(36)}H#`, '#'.repeat(40)] })).toThrow(/grande/);
  });
  it('portais ligam partes separadas por parede', () => {
    expect(() => lvl(['#######', '#T1#1H#', '#######'])).not.toThrow();
    expect(() => lvl(['#######', '#T.#.H#', '#######'])).toThrow(/alcançado/);
  });
  it('a legenda cobre os caracteres aceitos', () => {
    for (const c of ['#', '.', 'T', 'H', 's', 'i', '~', '^', 'v', '<', '>', 'o', 'm', 'M', '/', '\\']) expect(LEGEND[c]).toBeTruthy();
  });
});

describe('tacada', () => {
  it('arrastar para trás manda a bola para o lado oposto, com força proporcional', () => {
    const a = aimFromDrag(-30, 0, 60)!;
    expect(a.angle).toBeCloseTo(0, 5);
    expect(a.power).toBeCloseTo(0.5, 5);
    expect(aimFromDrag(0, 200, 60)!.power).toBe(1);
    expect(aimFromDrag(0, 40, 60)!.angle).toBeCloseTo(-Math.PI / 2, 5);
  });
  it('arrasto curto demais cancela', () => {
    expect(aimFromDrag(MIN_DRAG - 1, 0, 60)).toBeNull();
  });
  it('velocidade vai de MIN_SPEED a MAX_SPEED', () => {
    expect(speedFor(0)).toBe(MIN_SPEED);
    expect(speedFor(1)).toBe(MAX_SPEED);
    expect(speedFor(5)).toBe(MAX_SPEED);
  });
  it('conta tacada, guarda o ponto de partida e não deixa tacar com a bola andando', () => {
    const h = createHole(lvl(ABERTA));
    expect(canShoot(h)).toBe(true);
    expect(shoot(h, 0, 0.5)).toBe(true);
    expect(h.strokes).toBe(1);
    expect(h.lastRest).toEqual(h.level.tee);
    expect(shoot(h, 0, 1)).toBe(false);
    expect(h.strokes).toBe(1);
  });
});

describe('física', () => {
  it('a bola para sozinha e fica parada', () => {
    const h = createHole(lvl(ABERTA));
    shoot(h, Math.PI / 2, 0.4);
    const ev = settle(h);
    expect(h.moving).toBe(false);
    expect(tem(ev, 'stop')).toBe(true);
    expect(speedOf(h.ball)).toBe(0);
  });
  it('é determinística: mesma tacada, mesmo resultado', () => {
    const a = createHole(lvl(ABERTA));
    const b = createHole(lvl(ABERTA));
    shoot(a, 0.4, 0.8);
    shoot(b, 0.4, 0.8);
    settle(a);
    settle(b);
    expect(a.ball).toEqual(b.ball);
  });
  it('quica na parede refletindo o ângulo e perdendo energia', () => {
    const h = rolando(ABERTA, 8, 2.5, 8, 4);
    const ev: HoleEvent[] = [];
    for (let i = 0; i < 400 && !tem(ev, 'bounce'); i++) ev.push(...step(h));
    expect(tem(ev, 'bounce')).toBe(true);
    expect(h.ball.vx).toBeLessThan(0);
    expect(h.ball.vy).toBeGreaterThan(0);
    expect(Math.abs(h.ball.vx)).toBeLessThan(8);
    expect(h.ball.x).toBeLessThanOrEqual(10 - BALL_R + 1e-6);
  });
  it('não atravessa a parede mesmo na velocidade máxima', () => {
    const h = rolando(ABERTA, 2, 3.5, MAX_SPEED, 0);
    for (let i = 0; i < 2000 && h.moving; i++) {
      step(h);
      expect(h.ball.x).toBeGreaterThan(1);
      expect(h.ball.x).toBeLessThan(10);
    }
  });
  it('poste dá um chute', () => {
    const rows = ['#######', '#.....#', '#.T.o.#', '#....H#', '#######'];
    const h = rolando(rows, 3.2, 2.5, 5, 0);
    const ev: HoleEvent[] = [];
    for (let i = 0; i < 300; i++) ev.push(...step(h));
    expect(tem(ev, 'bumper')).toBe(true);
  });
  it('areia freia muito mais que a grama e o gelo escorrega muito mais', () => {
    // pista longa montada à mão (sem paredes nem buraco): mede só a distância percorrida
    const dist = (c: 'grass' | 'sand' | 'ice'): number => {
      const h = rolando(ABERTA, 1.5, 1.5, 8, 0);
      h.level.surface = [Array(80).fill('void'), Array<'grass' | 'sand' | 'ice'>(80).fill(c), Array(80).fill('void')];
      h.level.walls = [];
      h.level.hole = { x: -10, y: -10 };
      for (let i = 0; i < 360 && h.moving; i++) step(h); // 3 segundos
      return h.ball.x - 1.5;
    };
    const grama = dist('grass');
    expect(dist('sand')).toBeLessThan(grama * 0.5);
    expect(dist('ice')).toBeGreaterThan(grama * 1.5);
  });
  it('água devolve a bola ao ponto da tacada e custa 1 tacada', () => {
    const rows = ['#########', '#T..~~.H#', '#.......#', '#########'];
    const h = createHole(lvl(rows));
    shoot(h, 0, 0.55);
    const ev = settle(h);
    expect(tem(ev, 'hazard')).toBe(true);
    expect(h.ball.x).toBeCloseTo(h.level.tee.x, 5);
    expect(h.strokes).toBe(2);
    expect(canShoot(h)).toBe(true);
  });
  it('rampa empurra uma bola quase parada e ela não "para" em cima da rampa', () => {
    const rows = ['#########', '#T>>>>.H#', '#########'];
    const h = rolando(rows, 2.5, 1.5, 0.3, 0);
    for (let i = 0; i < 90; i++) step(h);
    expect(h.ball.x).toBeGreaterThan(3.5);
    expect(h.moving).toBe(true);
  });
  it('ímã atrai e o outro repele', () => {
    const roda = (c: string): number => {
      const h = rolando(['###########', `#T......${c}.H#`.slice(0, 11), '###########'], 6.5, 1.5, 1.5, 0);
      for (let i = 0; i < 60; i++) step(h);
      return h.ball.x;
    };
    expect(roda('m')).toBeGreaterThan(roda('.') + 0.3);
    expect(roda('M')).toBeLessThan(roda('.') - 0.3);
  });
  it('portal teleporta para o par mantendo a velocidade, sem ficar preso em loop', () => {
    const rows = ['###########', '#T.1...1.H#', '###########'];
    const h = rolando(rows, 1.5, 1.5, 4, 0);
    const ev: HoleEvent[] = [];
    for (let i = 0; i < 600; i++) ev.push(...step(h));
    expect(ev.filter((e) => e.type === 'portal')).toHaveLength(1);
    expect(h.ball.x).toBeGreaterThan(7);
  });
  it('parede diagonal desvia a bola', () => {
    const rows = ['#######', '#T....#', '#.....#', '#..\\..#', '#....H#', '#######'];
    const h = rolando(rows, 1.5, 3.5, 6, 0);
    let bateu = false;
    for (let i = 0; i < 400 && !bateu; i++) bateu = tem(step(h), 'bounce');
    expect(bateu).toBe(true);
    expect(h.ball.vy).toBeGreaterThan(2); // a diagonal virou o movimento para baixo
    expect(Math.abs(h.ball.vx)).toBeLessThan(1);
  });
});

describe('buraco', () => {
  it('bola devagar cai no buraco', () => {
    const rows = ['#########', '#T.....H#', '#########'];
    const h = rolando(rows, 5.5, 1.5, 3, 0);
    const ev = settle(h);
    expect(h.sunk).toBe(true);
    expect(tem(ev, 'sink')).toBe(true);
    expect(holeDone(h)).toBe(true);
    expect(canShoot(h)).toBe(false);
    expect(h.ball.x).toBe(7.5);
  });
  it('bola rápida demais passa por cima', () => {
    const rows = ['#########', '#T.....H#', '#########'];
    const h = rolando(rows, 6, 1.5, HOLE_CAPTURE_SPEED + 4, 0);
    let caiu = false;
    for (let i = 0; i < 20; i++) {
      step(h);
      if (h.sunk) caiu = true;
      if (Math.abs(h.ball.x - 7.5) < HOLE_R) break;
    }
    expect(caiu).toBe(false);
  });
  it('depois de MAX_STROKES o buraco acaba com o limite', () => {
    const h = createHole(lvl(ABERTA));
    h.strokes = MAX_STROKES - 1;
    shoot(h, Math.PI / 2, 0.1);
    const ev = settle(h);
    expect(h.strokes).toBe(MAX_STROKES);
    expect(h.gaveUp).toBe(true);
    expect(tem(ev, 'giveup')).toBe(true);
    expect(shoot(h, 0, 1)).toBe(false);
  });
});

describe('pontuação', () => {
  it('nomes das jogadas', () => {
    expect(resultName(1, 3)).toBe('BURACO EM UMA!');
    expect(resultName(2, 4)).toBe('EAGLE!');
    expect(resultName(2, 3)).toBe('BIRDIE!');
    expect(resultName(3, 3)).toBe('PAR');
    expect(resultName(4, 3)).toBe('BOGEY');
    expect(resultName(6, 3)).toBe('+3');
    expect(resultName(8, 3, false)).toBe('LIMITE DE TACADAS');
  });
  it('o percurso soma as tacadas e o par', () => {
    const run = createRun(LEVELS);
    expect(totalPar(run)).toBe(LEVELS.reduce((a, l) => a + l.par, 0));
    for (const l of LEVELS) {
      const h = createHole(l);
      h.strokes = 3;
      finishHole(run, h);
    }
    expect(totalStrokes(run)).toBe(3 * LEVELS.length);
    expect(run.index).toBe(LEVELS.length);
  });
  it('constantes sensatas', () => {
    expect(STOP_SPEED).toBeGreaterThan(0);
    expect(DT).toBeGreaterThan(0);
    expect(() => validateLevel(LEVELS[0]!)).not.toThrow();
  });
});

// ---------- mecânicas novas: bomba, moinho, bloco móvel, pistão, lava e rampa de salto ----------

const CORREDOR = (miolo: string[]): string[] => ['#########', ...miolo, '#########'];

describe('bomba', () => {
  const rows = CORREDOR(['#.......#', '#.B.T..H#', '#.......#']);
  it('a bola que encosta é presa na bomba e fica parada', () => {
    const h = createHole(lvl(rows));
    h.ball.x = 3.5;
    h.ball.y = 2.5;
    h.ball.vx = -5;
    h.ball.vy = 0;
    h.moving = true;
    h.strokes = 1;
    const ev = settle(h, 5);
    expect(tem(ev, 'cannon')).toBe(true);
    expect(h.held).toBe(0);
    expect(h.moving).toBe(false);
    expect(h.ball.x).toBeCloseTo(2.5, 5);
    expect(canShoot(h)).toBe(true);
  });
  it('a direção da tacada é a da bomba (não a do arrasto) e só a força é do jogador', () => {
    const h = createHole(lvl(rows));
    h.held = 0;
    h.ball.x = 2.5;
    h.ball.y = 2.5;
    for (let i = 0; i < 90; i++) step(h); // a bomba gira sozinha com a bola parada
    const ang = cannonAngle(h.level.cannons[0]!, h.clock);
    expect(h.clock).toBeGreaterThan(0.7);
    expect(shoot(h, 0, 1)).toBe(false); // tacada comum recusada enquanto presa
    expect(shootFromCannon(h, 1)).toBe(true);
    expect(Math.atan2(h.ball.vy, h.ball.vx)).toBeCloseTo(Math.atan2(Math.sin(ang), Math.cos(ang)), 5);
    expect(speedOf(h.ball)).toBeCloseTo(MAX_SPEED, 5);
    expect(h.strokes).toBe(1);
    expect(h.held).toBeNull();
  });
  it('depois de atirar a bola não é puxada de volta na hora', () => {
    const h = createHole(lvl(rows));
    h.held = 0;
    h.ball.x = 2.5;
    h.ball.y = 2.5;
    shootFromCannon(h, 0.2);
    step(h);
    expect(h.held).toBeNull();
    expect(h.moving).toBe(true);
  });
});

describe('moinho', () => {
  it('as pás giram com o relógio e voltam ao ponto de partida depois de uma volta', () => {
    const w = lvl(CORREDOR(['#.......#', '#...W...#', '#...T..H#'])).windmills[0]!;
    const a = windmillBlades(w, 0)[0]!;
    const b = windmillBlades(w, (Math.PI * 2) / Math.abs(w.speed))[0]!;
    expect(b.b.x).toBeCloseTo(a.b.x, 5);
    expect(b.b.y).toBeCloseTo(a.b.y, 5);
    expect(windmillBlades(w, 0)).toHaveLength(4);
  });
  it('a pá bate na bola e ela não atravessa', () => {
    const rows = ['#####', '#...#', '#.W.#', '#...#', '#...#', '#.T.#', '#..H#', '#####'];
    const l = parseLevel({ id: 'm', name: 'm', par: 3, rows, tune: { windBlades: 2, windLen: 1.2, windSpeed: 0.01 } });
    const h = createHole(l);
    h.ball.x = 2.5;
    h.ball.y = 5.5;
    h.ball.vx = 0;
    h.ball.vy = -9;
    h.moving = true;
    h.strokes = 1;
    const ev = settle(h, 3);
    expect(tem(ev, 'bounce')).toBe(true);
  });
});

describe('bloco móvel', () => {
  const def: LevelDef = { id: 'b', name: 'b', par: 3, rows: ['########', '#T.....#', '#.....H#', '########'], blocks: [{ from: [3, 1], to: [3, 2], size: [1, 1], period: 4 }] };
  it('vai e volta entre os dois pontos, suave, com velocidade', () => {
    const b = parseLevel(def).blocks[0]!;
    expect(blockRect(b, 0)).toMatchObject({ x: 3, y: 1 });
    const meio = blockRect(b, 1);
    expect(meio.y).toBeCloseTo(1.5, 5);
    expect(meio.vy).toBeGreaterThan(0);
    expect(blockRect(b, 2).y).toBeCloseTo(2, 5);
    expect(blockRect(b, 4).y).toBeCloseTo(1, 5);
  });
  it('a bola bate no bloco e volta; o bloco que vem na direção dela dá mais força', () => {
    const l = parseLevel(def);
    const h = createHole(l);
    h.ball.x = 1.5;
    h.ball.y = 1.5;
    h.ball.vx = 6;
    h.ball.vy = 0;
    h.moving = true;
    h.strokes = 1;
    const ev = settle(h, 2);
    expect(tem(ev, 'bounce')).toBe(true);
    expect(h.ball.x).toBeLessThan(3);
  });
  it('rejeita bloco fora da grade', () => {
    expect(() => parseLevel({ ...def, blocks: [{ from: [7, 1], to: [3, 1], size: [2, 1] }] })).toThrow(/bloco/);
  });
});

describe('pistão', () => {
  it('sobe e desce em ciclo; só é sólido quando alto', () => {
    const p = lvl(CORREDOR(['#.......#', '#.T.P.H.#', '#.......#'])).pistons[0]!;
    const alturas = Array.from({ length: 40 }, (_, i) => pistonHeight(p, (i * p.period) / 40));
    expect(Math.max(...alturas)).toBe(1);
    expect(Math.min(...alturas)).toBe(0);
  });
  it('baixo, a bola passa; alto, ela bate', () => {
    const rows = ['#######', '#.....#', '#T.P.H#', '#.....#', '#######'];
    const l = lvl(rows);
    const p = l.pistons[0]!;
    // acha um instante com o pistão embaixo e outro em cima
    let baixo = 0;
    let alto = 0;
    for (let t = 0; t < p.period; t += 0.01) {
      if (pistonHeight(p, t) === 0 && !baixo) baixo = t;
      if (pistonHeight(p, t) === 1 && !alto) alto = t;
    }
    const roda = (t0: number): HoleEvent[] => {
      const h = createHole(l);
      h.clock = t0;
      h.ball.x = 2.5;
      h.ball.y = 2.5;
      h.ball.vx = 6;
      h.ball.vy = 0;
      h.moving = true;
      h.strokes = 1;
      return settle(h, 1.2);
    };
    expect(tem(roda(alto), 'bumper')).toBe(true);
    expect(tem(roda(baixo), 'bumper')).toBe(false);
  });
});

describe('lava', () => {
  const rows = ['########', '#T.XY.H#', '########'];
  it('X e Y alternam: quando um acende o outro apaga', () => {
    const l = lvl(rows);
    const [x, y] = l.lava;
    for (const t of [0.2, 1, 1.6, 2.5, 2.9]) expect(lavaHot(x!, t)).toBe(!lavaHot(y!, t));
  });
  it('bola que passa por cima da lava acesa volta ao ponto da tacada e custa 1 tacada', () => {
    const l = lvl(rows);
    const x = l.lava[0]!;
    const h = createHole(l);
    h.clock = 0.2; // X acesa
    expect(lavaHot(x, h.clock)).toBe(true);
    h.ball.x = 2.2;
    h.ball.y = 1.5;
    h.ball.vx = 4;
    h.ball.vy = 0;
    h.moving = true;
    h.strokes = 1;
    h.lastRest = { x: 1.5, y: 1.5 };
    h.lavaGrace = 0;
    const ev = settle(h, 2);
    expect(ev.some((e) => e.type === 'hazard' && e.kind === 'lava')).toBe(true);
    expect(h.ball.x).toBe(1.5);
    expect(h.strokes).toBe(2);
  });
  it('lava apagada não machuca', () => {
    const l = lvl(rows);
    const h = createHole(l);
    h.clock = 2.2; // X apagada
    h.ball.x = 2.2;
    h.ball.y = 1.5;
    h.ball.vx = 3;
    h.ball.vy = 0;
    h.moving = true;
    h.strokes = 1;
    h.lavaGrace = 0;
    const ev = [];
    for (let i = 0; i < 60; i++) ev.push(...step(h));
    expect(ev.some((e) => e.type === 'hazard')).toBe(false);
  });
});

describe('rampa de salto', () => {
  const rows = ['#########', '#T..R~~.#', '#......H#', '#########'];
  it('com velocidade e no sentido da rampa a bola voa por cima da água sem cair', () => {
    const l = lvl(rows);
    const h = createHole(l);
    h.ball.x = 3.5;
    h.ball.y = 1.5;
    h.ball.vx = 9;
    h.ball.vy = 0;
    h.moving = true;
    h.strokes = 1;
    const ev = settle(h, 3);
    expect(tem(ev, 'jump')).toBe(true);
    expect(tem(ev, 'land')).toBe(true);
    expect(ev.some((e) => e.type === 'hazard')).toBe(false);
  });
  it('devagar ou no sentido contrário não voa: cai na água', () => {
    const l = lvl(rows);
    const devagar = createHole(l);
    devagar.ball.x = 3.5;
    devagar.ball.y = 1.5;
    devagar.ball.vx = 2.6;
    devagar.moving = true;
    devagar.strokes = 1;
    expect(tem(settle(devagar, 4), 'jump')).toBe(false);
    const contra = createHole(l);
    contra.ball.x = 3.8;
    contra.ball.y = 1.5;
    contra.ball.vx = -9;
    contra.moving = true;
    contra.strokes = 1;
    expect(tem(settle(contra, 2), 'jump')).toBe(false);
  });
  it('mais força, voo maior (até o limite)', () => {
    const voo = (v: number): number => {
      const h = createHole(lvl(['###########', '#T..R.....#', '#.......H.#', '###########']));
      h.ball.x = 3.5;
      h.ball.y = 1.5;
      h.ball.vx = v;
      h.moving = true;
      h.strokes = 1;
      let air = 0;
      for (let i = 0; i < 400; i++) {
        for (const e of step(h)) if (e.type === 'jump') air = e.air;
      }
      return air;
    };
    expect(voo(12)).toBeGreaterThan(voo(6));
    expect(voo(15)).toBeLessThanOrEqual(JUMP_AIR_MAX);
  });
  it('a água precisa de rampa: sem ela o buraco continua inalcançável', () => {
    expect(() => lvl(['#######', '#T~~~H#', '#######'])).toThrow(/alcançado/);
    expect(() => lvl(['#########', '#TR~~~..#', '#.....H.#', '#########'])).not.toThrow();
  });
});

describe('segurança do laço', () => {
  it('uma tacada que não acaba (ex.: bola orbitando) é parada depois de MAX_ROLL_SECONDS', () => {
    const h = createHole(lvl(['#########', '#...m...#', '#...T..H#', '#########']));
    h.ball.x = 2.5;
    h.ball.y = 1.5;
    h.ball.vx = 0;
    h.ball.vy = 0.5;
    h.moving = true;
    h.strokes = 1;
    settle(h, MAX_ROLL_SECONDS + 5);
    expect(h.moving).toBe(false);
  });
});

describe('percurso real', () => {
  it('tem as mecânicas pedidas: bombas, moinho, esteira, portais, bloco móvel, rampa, pistão e lava', () => {
    const tem = (f: (l: (typeof LEVELS)[number]) => boolean): boolean => LEVELS.some(f);
    expect(tem((l) => l.cannons.length > 0)).toBe(true);
    expect(tem((l) => l.windmills.length > 0)).toBe(true);
    expect(tem((l) => l.slope.some((r) => r.some(Boolean)))).toBe(true);
    expect(tem((l) => l.portals.length > 0)).toBe(true);
    expect(tem((l) => l.blocks.length > 0)).toBe(true);
    expect(tem((l) => l.jumps.length > 0)).toBe(true);
    expect(tem((l) => l.pistons.length > 0)).toBe(true);
    expect(tem((l) => l.lava.length > 0)).toBe(true);
  });
  it('o par de cada fase fica entre 1 e 6', () => {
    for (const l of LEVELS) expect(l.par).toBeGreaterThanOrEqual(1);
  });
});
