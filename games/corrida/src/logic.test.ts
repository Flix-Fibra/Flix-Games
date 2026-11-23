import { describe, expect, it } from 'vitest';
import { amostraMaisProxima, amostrarPista, andarCarro, batida, comprimentoPista, contato, controlarIA, ESTA_RODANDO, evitar, FISICA, fatorTeto, formatarTempo, Progresso, reforcoRival, REFORCO_MAX, rodar, separar, Voltas, type Carro } from './logic';
import { PISTAS } from './pistas';

describe('pistas', () => {
  it.each(PISTAS.map((p) => [p.id, p] as const))('%s: volta de 30 a 60 s perto da velocidade máxima, dentro do mundo', (_id, def) => {
    const am = amostrarPista(def.pontos);
    const seg = comprimentoPista(am) / (FISICA.vmax.asfalto * 0.85);
    expect(seg).toBeGreaterThan(30);
    expect(seg).toBeLessThan(60);
    for (const a of am) {
      expect(a.x).toBeGreaterThan(0);
      expect(a.y).toBeGreaterThan(0);
      expect(a.x).toBeLessThan(def.w);
      expect(a.y).toBeLessThan(def.h);
    }
  });
});

describe('carro', () => {
  const novo = (): Carro => ({ x: 0, y: 0, ang: 0, vx: 0, vy: 0 });
  it('acelera sozinho até o limite do asfalto', () => {
    const c = novo();
    for (let i = 0; i < 300; i++) andarCarro(c, { giro: 0, freio: false }, 'asfalto', 1 / 60);
    expect(c.vx).toBeCloseTo(FISICA.vmax.asfalto, 0);
  });
  it('na grama perde velocidade até o limite dela', () => {
    const c = novo();
    for (let i = 0; i < 300; i++) andarCarro(c, { giro: 0, freio: false }, 'asfalto', 1 / 60);
    for (let i = 0; i < 300; i++) andarCarro(c, { giro: 0, freio: false }, 'grama', 1 / 60);
    expect(c.vx).toBeCloseTo(FISICA.vmax.grama, 0);
  });
  it('parado não vira; em movimento vira', () => {
    const p = novo();
    andarCarro(p, { giro: 1, freio: false }, 'asfalto', 1 / 60);
    expect(p.ang).toBeLessThan(0.01);
    const m = novo();
    for (let i = 0; i < 120; i++) andarCarro(m, { giro: 1, freio: false }, 'asfalto', 1 / 60);
    expect(m.ang).toBeGreaterThan(1);
  });
  it('freia até parar sem andar para trás', () => {
    const c = novo();
    for (let i = 0; i < 200; i++) andarCarro(c, { giro: 0, freio: false }, 'asfalto', 1 / 60);
    for (let i = 0; i < 200; i++) andarCarro(c, { giro: 0, freio: true }, 'asfalto', 1 / 60);
    expect(c.vx).toBe(0);
  });
});

describe('voltas', () => {
  it('conta a volta ao passar pelos 4 quartos na ordem e guarda a melhor', () => {
    const v = new Voltas(400);
    for (let i = 0; i < 400; i += 4) v.atualizar(i, 500);
    const fechou = v.atualizar(2, 500);
    expect(fechou).toBe(true);
    expect(v.voltas).toBe(1);
    expect(v.melhor).toBe(v.ultimaVolta);
  });
  it('não conta volta indo e voltando na linha de largada', () => {
    const v = new Voltas(400);
    for (let k = 0; k < 5; k++) {
      v.atualizar(395, 100);
      v.atualizar(3, 100);
    }
    expect(v.voltas).toBe(0);
  });
});

describe('formatarTempo', () => {
  it('formata m:ss.cc', () => expect(formatarTempo(83450)).toBe('1:23.45'));
});

describe('velocidade na pista', () => {
  it('teto começa em 146 e chega a 210 px/s em 3 s', () => {
    expect(fatorTeto(0) * FISICA.vmax.asfalto).toBeCloseTo(146, 5);
    expect(fatorTeto(1500) * FISICA.vmax.asfalto).toBeCloseTo(178, 5);
    expect(fatorTeto(3000) * FISICA.vmax.asfalto).toBeCloseTo(210, 5);
    expect(fatorTeto(60000) * FISICA.vmax.asfalto).toBeCloseTo(210, 5);
  });
  it('o carro chega perto de 210 px/s depois de 3 s e não passa disso', () => {
    const c: Carro = { x: 0, y: 0, ang: 0, vx: 0, vy: 0 };
    let max = 0;
    for (let i = 0; i < 360; i++) {
      andarCarro(c, { giro: 0, freio: false }, 'asfalto', 1 / 60, fatorTeto(i * (1000 / 60)));
      max = Math.max(max, c.vx);
    }
    expect(c.vx).toBeGreaterThan(205);
    expect(max).toBeLessThanOrEqual(210.01);
  });
});

describe('adversários', () => {
  it.each(PISTAS.map((p) => [p.id, p] as const))('%s: o piloto automático completa 2 voltas ficando no asfalto', (_id, def) => {
    const am = amostrarPista(def.pontos);
    const a0 = am[0]!;
    const c: Carro = { x: a0.x - Math.cos(a0.ang) * 30, y: a0.y - Math.sin(a0.ang) * 30, ang: a0.ang, vx: 0, vy: 0 };
    let idx = am.length - 8;
    const prog = new Progresso(am.length, idx);
    let fora = 0;
    let passos = 0;
    for (let t = 0; t < 240 * 60 && prog.valor() < am.length * 2; t++) {
      idx = amostraMaisProxima(am, c.x, c.y, idx);
      const a = am[idx]!;
      const dist = Math.hypot(c.x - a.x, c.y - a.y);
      const sup = dist < def.largura / 2 ? 'asfalto' : dist < def.largura / 2 + 5 ? 'zebra' : 'grama';
      if (sup === 'grama') fora++;
      andarCarro(c, controlarIA(c, am, idx, 0), sup, 1 / 60, fatorTeto(t * (1000 / 60)) * 0.95);
      prog.atualizar(idx);
      passos++;
    }
    expect(prog.valor()).toBeGreaterThanOrEqual(am.length * 2); // terminou em menos de 240 s
    expect(fora / passos).toBeLessThan(0.03);
  });
  it('carros que se sobrepõem são afastados até não se tocarem', () => {
    const a: Carro = { x: 0, y: 0, ang: 0, vx: 100, vy: 0 };
    const b: Carro = { x: 10, y: 0, ang: 0, vx: 0, vy: 0 };
    expect(separar(a, b, 8)).toBe(true);
    for (let i = 0; i < 10 && contato(a, b, 8); i++) separar(a, b, 8);
    expect(contato(a, b, 8)).toBeNull();
  });
  it('a cápsula pega o carro de ponta a ponta (batida por trás a 31 px)', () => {
    const a: Carro = { x: 0, y: 0, ang: 0, vx: 0, vy: 0 };
    expect(contato(a, { x: 31, y: 0, ang: 0, vx: 0, vy: 0 }, 8)).not.toBeNull();
    expect(contato(a, { x: 40, y: 0, ang: 0, vx: 0, vy: 0 }, 8)).toBeNull();
  });
});

describe('batidas e rodopio', () => {
  const car = (x: number, vx: number): Carro => ({ x, y: 0, ang: 0, vx, vy: 0 });
  it('quem bate forte por trás rodopia e desliza até quase parar', () => {
    const tras = car(0, 200), frente = car(26, 60);
    const b = batida(tras, frente, 8)!;
    expect(b.atacante).toBe(tras);
    expect(ESTA_RODANDO(tras)).toBe(true);
    for (let i = 0; i < 400 && ESTA_RODANDO(tras); i++) andarCarro(tras, { giro: 0, freio: false }, 'asfalto', 1 / 60);
    expect(ESTA_RODANDO(tras)).toBe(false);
    expect(Math.hypot(tras.vx, tras.vy)).toBeLessThan(15);
    expect(Math.abs(tras.ang)).toBeGreaterThan(3); // girou
  });
  it('quem foi atingido por trás não rodopia, só segue', () => {
    const tras = car(0, 220), frente = car(26, 60);
    const b = batida(tras, frente, 8)!;
    expect(b.vitima).toBe(frente);
    expect(ESTA_RODANDO(frente)).toBe(false);
    expect(ESTA_RODANDO(tras)).toBe(true);
  });
  it('desvia de um carro logo à frente na mesma faixa', () => {
    const eu = car(0, 150), outro = car(40, 100);
    const r = evitar(eu, [eu, outro], 0);
    expect(r.lateral).not.toBe(0);
    expect(evitar(eu, [eu, car(40, 100) as Carro], 0).freio).toBe(false); // 40 px: ainda não precisa frear
    expect(evitar(eu, [eu, car(30, 50)], 0).freio).toBe(true);
    expect(evitar(eu, [eu, { ...outro, y: 40 }], 0).lateral).toBe(0); // em outra faixa
  });
  it('batida fraca só empurra', () => {
    const a = car(0, 100), b = car(26, 90);
    batida(a, b, 8);
    expect(ESTA_RODANDO(a)).toBe(false);
    expect(ESTA_RODANDO(b)).toBe(false);
  });
  it('golpe de propósito faz a vítima rodar mesmo em baixa velocidade', () => {
    const rival = car(0, 230), jogador = car(26, 210);
    batida(rival, jogador, 8, rival);
    expect(ESTA_RODANDO(jogador)).toBe(true);
    expect(ESTA_RODANDO(rival)).toBe(false);
  });
  it('depois de rodar fica imune por um tempo', () => {
    const c = car(0, 150);
    rodar(c, 1, 1);
    for (let i = 0; i < 400 && ESTA_RODANDO(c); i++) andarCarro(c, { giro: 0, freio: false }, 'asfalto', 1 / 60);
    expect(c.imuneMs).toBeGreaterThan(0);
    batida(car(-26, 250), c, 8);
    expect(ESTA_RODANDO(c)).toBe(false);
  });
  it('rivais aceleram mais quanto mais atrás ficam, até o limite', () => {
    expect(reforcoRival(100)).toBe(1);
    expect(reforcoRival(850)).toBeCloseTo(1 + REFORCO_MAX / 2, 5);
    expect(reforcoRival(5000)).toBeCloseTo(1 + REFORCO_MAX, 5);
  });
  it('o piloto automático com reforço máximo ainda completa as voltas na pista', () => {
    const def = PISTAS[0]!;
    const am = amostrarPista(def.pontos);
    const a0 = am[0]!;
    const c: Carro = { x: a0.x - 30, y: a0.y, ang: a0.ang, vx: 0, vy: 0 };
    let idx = am.length - 8;
    const prog = new Progresso(am.length, idx);
    let fora = 0, passos = 0;
    for (let t = 0; t < 200 * 60 && prog.valor() < am.length * 2; t++) {
      idx = amostraMaisProxima(am, c.x, c.y, idx);
      const d = Math.hypot(c.x - am[idx]!.x, c.y - am[idx]!.y);
      const sup = d < def.largura / 2 ? 'asfalto' : d < def.largura / 2 + 5 ? 'zebra' : 'grama';
      if (sup === 'grama') fora++;
      andarCarro(c, controlarIA(c, am, idx, 0), sup, 1 / 60, fatorTeto(t * (1000 / 60)) * 0.97 * (1 + REFORCO_MAX));
      prog.atualizar(idx);
      passos++;
    }
    expect(prog.valor()).toBeGreaterThanOrEqual(am.length * 2);
    expect(fora / passos).toBeLessThan(0.05);
  });
});
