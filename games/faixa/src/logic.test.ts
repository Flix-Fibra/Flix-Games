import { describe, expect, it } from 'vitest';
import {
  COLS, LOOP, MARGIN, MAX_HAZARD_STREAK, MIN_TRAIN_WARNING, SAFE_AHEAD, START_COL, START_ROW,
  World, createGame, creepSpeed, difficulty, hitByTrain, hitByVehicle, move, moverLeft, mulberry32, placeMovers, score,
  supportAt, COMBO_WINDOW, COMBO_BONUS_CAP, lanes, trainCrossTime, trainState, update,
  type Game, type GrassLane, type Lane, type RailLane, type RiverLane, type RoadLane,
} from './logic';

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);
const FAIXAS = 400;

function mundo(seed: number, n = FAIXAS): Lane[] {
  const w = new World(seed);
  w.ensure(n);
  return Array.from({ length: n + 1 }, (_, i) => w.lane(i));
}

/** Jogo com uma faixa de cada tipo escolhida à mão, para testar movimento sem depender do sorteio. */
function jogoCom(lanes: Record<number, Lane>): Game {
  const g = createGame(1);
  for (const [i, l] of Object.entries(lanes)) (g.world as unknown as { map: Map<number, Lane> }).map.set(Number(i), l);
  g.world.ensure(60);
  return g;
}
const grama = (index: number, blocked: number[] = []): GrassLane => ({
  index, kind: 'grass', bank: false, props: Array(COLS).fill(0),
  blocked: Array.from({ length: COLS }, (_, c) => blocked.includes(c)), reach: Array(COLS).fill(true),
});
const rio = (index: number, over: Partial<RiverLane> = {}): RiverLane => ({
  index, kind: 'river', mode: 'logs', dir: 1, speed: 1, logs: [], pads: [], reach: Array(COLS).fill(true), ...over,
});
const rua = (index: number, over: Partial<RoadLane> = {}): RoadLane => ({
  index, kind: 'road', dir: 1, speed: 2, vehicles: [], reach: Array(COLS).fill(true), ...over,
});
const trilho = (index: number, over: Partial<RailLane> = {}): RailLane => ({
  index, kind: 'rail', dir: 1, period: 6, offset: 0, warn: 1.5, trainLen: 14, trainSpeed: 24, reach: Array(COLS).fill(true), ...over,
});

describe('gerador: começo da fase', () => {
  it('as 5 faixas depois da largada (e as de trás) são grama sem obstáculo no caminho do meio', () => {
    for (const seed of SEEDS) {
      const lanes = mundo(seed, 30);
      for (let i = 0; i <= START_ROW + SAFE_AHEAD; i++) {
        const l = lanes[i]!;
        expect(l.kind).toBe('grass');
        const g = l as GrassLane;
        for (let c = START_COL - 1; c <= START_COL + 1; c++) expect(g.blocked[c]).toBe(false);
      }
    }
  });
  it('a largada é sempre alcançável', () => {
    for (const seed of SEEDS) expect((mundo(seed, 5)[START_ROW] as GrassLane).reach[START_COL]).toBe(true);
  });
});

describe('gerador: nunca bloqueia a passagem', () => {
  it('toda faixa tem uma coluna alinhada com o alcance da anterior (400 faixas x 200 sementes)', () => {
    for (const seed of SEEDS) {
      const lanes = mundo(seed);
      for (let i = 1; i < lanes.length; i++) {
        const prev = lanes[i - 1]!;
        const l = lanes[i]!;
        const passavel = (c: number): boolean =>
          l.kind === 'grass' ? !l.blocked[c]! : l.kind === 'river' && l.mode === 'pads' ? l.pads[c]! : true;
        const alinhada = Array.from({ length: COLS }, (_, c) => c).some((c) => prev.reach[c] && passavel(c) && l.reach[c]);
        expect(alinhada, `semente ${seed}, faixa ${i} (${l.kind})`).toBe(true);
      }
    }
  });
  it('grama nunca é bloqueada por inteiro', () => {
    for (const seed of SEEDS) for (const l of mundo(seed)) if (l.kind === 'grass') expect(l.blocked.every(Boolean)).toBe(false);
  });
  it('duas faixas de vitória-régia seguidas têm sempre uma vitória-régia alinhada', () => {
    let pares = 0;
    for (const seed of SEEDS) {
      const lanes = mundo(seed);
      for (let i = 1; i < lanes.length; i++) {
        const a = lanes[i - 1]!;
        const b = lanes[i]!;
        if (a.kind === 'river' && a.mode === 'pads' && b.kind === 'river' && b.mode === 'pads') {
          pares++;
          expect(a.pads.some((p, c) => p && b.pads[c] && a.reach[c])).toBe(true);
        }
      }
    }
    expect(pares).toBeGreaterThan(0); // o teste só vale se esse caso aparece
  });
  it('a margem depois de um rio de troncos não tem obstáculos', () => {
    let margens = 0;
    for (const seed of SEEDS) {
      const lanes = mundo(seed);
      for (let i = 1; i < lanes.length; i++) {
        const a = lanes[i - 1]!;
        const b = lanes[i]!;
        if (a.kind === 'river' && a.mode === 'logs' && b.kind === 'grass') {
          margens++;
          expect(b.bank).toBe(true);
          expect(b.blocked.some(Boolean)).toBe(false);
        }
      }
    }
    expect(margens).toBeGreaterThan(0);
  });
  it('nunca passa de MAX_HAZARD_STREAK faixas perigosas seguidas', () => {
    for (const seed of SEEDS) {
      let seq = 0;
      for (const l of mundo(seed)) {
        seq = l.kind === 'grass' ? 0 : seq + 1;
        expect(seq).toBeLessThanOrEqual(MAX_HAZARD_STREAK);
      }
    }
  });
});

describe('gerador: perigos em movimento são justos', () => {
  it('vão mínimo entre veículos e entre troncos, inclusive na emenda do circuito', () => {
    for (const seed of SEEDS) {
      for (const l of mundo(seed, 200)) {
        const grupos = l.kind === 'road' ? [l.vehicles] : l.kind === 'river' && l.mode === 'logs' ? [l.logs] : [];
        for (const movers of grupos) {
          expect(movers.length).toBeGreaterThan(0);
          const ord = [...movers].sort((a, b) => a.x0 - b.x0);
          const minGap = l.kind === 'road' ? Math.max(2.2, l.speed * 0.85) : 1.2;
          ord.forEach((m, i) => {
            const n = ord[(i + 1) % ord.length]!;
            const vao = (((n.x0 - m.x0 - m.len) % LOOP) + LOOP) % LOOP;
            expect(movers.length === 1 || vao >= minGap - 1e-9).toBe(true);
          });
        }
      }
    }
  });
  it('o trem sempre avisa pelo menos MIN_TRAIN_WARNING segundos antes de entrar', () => {
    let trilhos = 0;
    for (const seed of SEEDS.slice(0, 30)) {
      for (const l of mundo(seed)) {
        if (l.kind !== 'rail') continue;
        trilhos++;
        expect(l.warn).toBeGreaterThanOrEqual(MIN_TRAIN_WARNING);
        // varre o tempo: depois de `warning` vem `passing`, nunca direto de `idle`
        let antes = trainState(l, 0).phase;
        for (let t = 0.02; t < l.period * 2; t += 0.02) {
          const agora = trainState(l, t).phase;
          if (agora === 'passing') expect(antes === 'warning' || antes === 'passing').toBe(true);
          antes = agora;
        }
      }
    }
    expect(trilhos).toBeGreaterThan(0);
  });
  it('objetos entram e saem fora da tela (nunca aparecem do nada)', () => {
    const l = mundo(7, 200).find((x) => x.kind === 'road') as RoadLane;
    for (let t = 0; t < 60; t += 1 / 60) {
      for (const v of l.vehicles) {
        const a = moverLeft(v, l.dir, l.speed, t);
        const b = moverLeft(v, l.dir, l.speed, t + 1 / 60);
        if (Math.abs(a - b) > 1) {
          // salto da emenda: tem de estar totalmente fora da área jogável dos dois lados
          for (const left of [a, b]) expect(left + v.len <= 0 || left >= COLS).toBe(true);
        }
      }
    }
  });
});

describe('gerador: curva de dificuldade', () => {
  it('sobe com a distância e fica entre 0 e 1', () => {
    expect(difficulty(START_ROW + SAFE_AHEAD)).toBe(0);
    for (let i = START_ROW; i < 500; i++) {
      expect(difficulty(i + 1)).toBeGreaterThanOrEqual(difficulty(i));
      expect(difficulty(i)).toBeLessThan(1);
    }
    expect(difficulty(START_ROW + 300)).toBeGreaterThan(0.95);
  });
  it('faixas perigosas e velocidades aumentam de verdade', () => {
    const cedo = { perigo: 0, total: 0, vel: 0, n: 0 };
    const tarde = { perigo: 0, total: 0, vel: 0, n: 0 };
    for (const seed of SEEDS) {
      mundo(seed, 400).forEach((l, i) => {
        const p = i - START_ROW;
        const alvo = p >= 6 && p < 40 ? cedo : p >= 250 ? tarde : null;
        if (!alvo) return;
        alvo.total++;
        if (l.kind !== 'grass') alvo.perigo++;
        if (l.kind === 'road' || (l.kind === 'river' && l.mode === 'logs')) {
          alvo.vel += l.speed;
          alvo.n++;
        }
      });
    }
    expect(tarde.perigo / tarde.total).toBeGreaterThan(cedo.perigo / cedo.total + 0.1);
    expect(tarde.vel / tarde.n).toBeGreaterThan((cedo.vel / cedo.n) * 1.3);
  });
  it('rios só depois da faixa 8 e trilhos só depois da 12', () => {
    for (const seed of SEEDS) {
      mundo(seed, 60).forEach((l, i) => {
        if (l.kind === 'river') expect(i - START_ROW).toBeGreaterThanOrEqual(8);
        if (l.kind === 'rail') expect(i - START_ROW).toBeGreaterThanOrEqual(12);
      });
    }
  });
});

describe('World: determinismo e descarte', () => {
  it('mesma semente gera a mesma fase, mesmo gerando aos poucos', () => {
    const a = new World(42);
    a.ensure(300);
    const b = new World(42);
    for (let i = 0; i <= 300; i += 7) b.ensure(i);
    b.ensure(300);
    for (let i = 0; i <= 300; i++) expect(b.lane(i)).toEqual(a.lane(i));
  });
  it('descartar faixas antigas não muda as futuras e libera memória', () => {
    const a = new World(9);
    a.ensure(526);
    const b = new World(9);
    for (let i = 0; i <= 500; i += 10) {
      b.ensure(i + 26);
      b.prune(i - 5);
    }
    b.ensure(500);
    expect(b.lowest).toBe(495); // a última poda do laço
    expect(b.size).toBeLessThan(40); // 495..526: nada além da janela fica na memória
    expect(() => b.lane(10)).toThrow();
    for (let i = 495; i <= 526; i++) expect(b.lane(i)).toEqual(a.lane(i));
  });
  it('sementes diferentes geram fases diferentes', () => {
    expect(mundo(1, 80)).not.toEqual(mundo(2, 80));
  });
});

describe('placeMovers', () => {
  it('devolve null quando não cabe', () => {
    expect(placeMovers(mulberry32(1), [3, 3, 3, 3, 3, 3], [], 1, 0)).toBeNull();
  });
});

describe('jogador: movimento', () => {
  it('anda para cima e a pontuação conta as faixas além da largada', () => {
    const g = jogoCom({ [START_ROW + 1]: grama(START_ROW + 1), [START_ROW + 2]: grama(START_ROW + 2) });
    expect(lanes(g)).toBe(0);
    expect(move(g, 'up')).toBe(true);
    expect(move(g, 'up')).toBe(true);
    expect(lanes(g)).toBe(2);
    expect(move(g, 'down')).toBe(true);
    expect(lanes(g)).toBe(2); // voltar não tira ponto
    expect(score(g)).toBe(3); // 2 faixas + 1 de bônus (as duas vieram sem pausa)
  });
  it('árvore bloqueia o passo, de frente e de lado', () => {
    const g = jogoCom({ [START_ROW + 1]: grama(START_ROW + 1, [START_COL]), [START_ROW]: grama(START_ROW, [START_COL + 1]) });
    expect(move(g, 'up')).toBe(false);
    expect(move(g, 'right')).toBe(false);
    expect(move(g, 'left')).toBe(true);
  });
  it('as bordas laterais barram o jogador', () => {
    const g = jogoCom({ [START_ROW]: grama(START_ROW) });
    for (let i = 0; i < 20; i++) move(g, 'left');
    expect(g.x).toBe(0);
    for (let i = 0; i < 20; i++) move(g, 'right');
    expect(g.x).toBe(COLS - 1);
  });
  it('não volta para baixo da base da tela', () => {
    const g = createGame(3);
    g.camRow = 5;
    g.row = 5;
    g.maxRow = 5;
    expect(move(g, 'down')).toBe(false);
  });
});

describe('jogador: perigos', () => {
  it('carro atropela e a mesma estrada vazia não', () => {
    const vazia = jogoCom({ [START_ROW]: rua(START_ROW) });
    update(vazia, 1 / 60);
    expect(vazia.alive).toBe(true);
    const cheia = jogoCom({ [START_ROW]: rua(START_ROW, { speed: 0.001, vehicles: [{ x0: START_COL + MARGIN - 0.2, len: 1.4, variant: 0 }] }) });
    update(cheia, 1 / 60);
    expect(cheia.alive).toBe(false);
    expect(cheia.cause).toBe('vehicle');
  });
  it('andar para dentro de um carro ou do trem é recusado e não mata', () => {
    const carro = { x0: START_COL + MARGIN - 0.2, len: 1.4, variant: 0 };
    const g = jogoCom({ [START_ROW + 1]: rua(START_ROW + 1, { speed: 0.001, vehicles: [carro] }), [START_ROW]: grama(START_ROW) });
    expect(move(g, 'up')).toBe(false);
    expect(g.row).toBe(START_ROW);
    update(g, 1 / 60);
    expect(g.alive).toBe(true);
    const t = jogoCom({ [START_ROW + 1]: trilho(START_ROW + 1), [START_ROW]: grama(START_ROW) });
    t.t = trainCrossTime(trilho(0)) / 2; // trem no meio da passagem
    expect(move(t, 'up')).toBe(false);
    expect(t.alive).toBe(true);
  });
  it('mas o carro que vem até o jogador parado ainda atropela', () => {
    const g = jogoCom({ [START_ROW]: rua(START_ROW, { speed: 3, vehicles: [{ x0: MARGIN - 3, len: 1.4, variant: 0 }] }) });
    for (let i = 0; i < 600 && g.alive; i++) update(g, 1 / 60);
    expect(g.cause).toBe('vehicle');
  });
  it('carro que passa só pela coluna ao lado não atinge', () => {
    const r = rua(START_ROW, { speed: 0.001, vehicles: [{ x0: START_COL + 1.1 + MARGIN, len: 1.4, variant: 0 }] });
    expect(hitByVehicle(r, START_COL, 0)).toBe(false);
  });
  it('rio sem tronco afoga; em cima de um tronco leva junto; sair da tela mata', () => {
    const sem = jogoCom({ [START_ROW]: rio(START_ROW) });
    update(sem, 1 / 60);
    expect(sem.cause).toBe('water');

    const log = { x0: START_COL - 1 + MARGIN, len: 3, variant: 0 };
    const g = jogoCom({ [START_ROW]: rio(START_ROW, { speed: 2, logs: [log] }) });
    const x0 = g.x;
    for (let i = 0; i < 30; i++) update(g, 1 / 60);
    expect(g.alive).toBe(true);
    expect(g.x).toBeGreaterThan(x0 + 0.9);
    for (let i = 0; i < 600 && g.alive; i++) update(g, 1 / 60);
    expect(g.alive).toBe(false);
    expect(['carried', 'water']).toContain(g.cause);
  });
  it('vitória-régia sustenta; sem ela afoga', () => {
    const pads = Array.from({ length: COLS }, (_, c) => c === START_COL);
    const g = jogoCom({ [START_ROW]: rio(START_ROW, { mode: 'pads', pads }) });
    for (let i = 0; i < 120; i++) update(g, 1 / 60);
    expect(g.alive).toBe(true);
    expect(supportAt(rio(0, { mode: 'pads', pads }), START_COL + 1, 0)).toBeNull();
  });
  it('trem: inofensivo parado, avisa antes e só mata quando passa', () => {
    const l = trilho(START_ROW);
    expect(trainState(l, 0).phase).toBe('passing'); // offset 0: começa passando
    const cross = trainCrossTime(l);
    expect(trainState(l, cross + 0.5).phase).toBe('idle');
    expect(trainState(l, l.period - 1).phase).toBe('warning');
    expect(trainState(l, l.period - 1).eta).toBeCloseTo(1, 5);
    expect(hitByTrain(l, START_COL, cross + 0.5)).toBe(false);
    expect(hitByTrain(l, START_COL, l.period - 1)).toBe(false);
    // no meio da passagem, o trem cobre a faixa inteira
    const meio = cross / 2;
    expect(hitByTrain(l, START_COL, meio)).toBe(true);
  });
  it('trem é simétrico nas duas direções', () => {
    const a = trainState(trilho(0, { dir: 1 }), 0.3);
    const b = trainState(trilho(0, { dir: -1 }), 0.3);
    expect(a.left + 14 + b.left).toBeCloseTo(COLS, 5); // espelhados em torno do centro
  });
  it('quem fica parado é alcançado pela base da tela', () => {
    const g = createGame(5);
    let t = 0;
    while (g.alive && t < 60) {
      update(g, 1 / 60);
      t += 1 / 60;
    }
    expect(g.alive).toBe(false);
    expect(g.cause).toBe('time');
    expect(t).toBeLessThan(20);
    expect(t).toBeGreaterThan(3);
  });
  it('a pressão do tempo aumenta com a distância', () => {
    expect(creepSpeed(START_ROW + 300)).toBeGreaterThan(creepSpeed(START_ROW));
  });
});

describe('combo de faixas', () => {
  const novo = (): Game => createGame(1); // faixas seguras logo à frente da largada
  it('faixas novas dentro da janela formam combo e dão bônus crescente', () => {
    const g = novo();
    expect(move(g, 'up')).toBe(true);
    expect([g.combo, g.bonus, g.lastBonus]).toEqual([1, 0, 0]);
    update(g, COMBO_WINDOW / 2);
    move(g, 'up');
    expect([g.combo, g.bonus, g.lastBonus]).toEqual([2, 1, 1]);
    update(g, COMBO_WINDOW / 2);
    move(g, 'up');
    expect([g.combo, g.bonus]).toEqual([3, 3]);
    expect(lanes(g)).toBe(3);
    expect(score(g)).toBe(6);
  });
  it('a janela é de 0,2 s: passou disso, o combo zera', () => {
    expect(COMBO_WINDOW).toBeCloseTo(0.2, 5);
    const g = novo();
    move(g, 'up');
    for (let i = 0; i < 14; i++) update(g, 1 / 60); // 0,23 s
    expect(g.combo).toBe(0);
    move(g, 'up');
    expect([g.combo, g.bonus]).toEqual([1, 0]);
  });
  it('o bônus por faixa tem teto', () => {
    const g = novo();
    for (let i = 0; i < 5; i++) {
      move(g, 'up');
      update(g, 0.05);
    }
    expect(g.lastBonus).toBeLessThanOrEqual(COMBO_BONUS_CAP);
    g.combo = 20;
    g.comboLeft = COMBO_WINDOW;
    move(g, 'up');
    expect(g.lastBonus).toBe(COMBO_BONUS_CAP);
  });
  it('voltar para uma faixa já vista não conta como faixa nova', () => {
    const g = novo();
    move(g, 'up');
    update(g, 0.05);
    move(g, 'down');
    update(g, 0.05);
    move(g, 'up');
    expect(g.combo).toBe(1);
    expect(g.bonus).toBe(0);
  });
});
