import { describe, expect, it } from 'vitest';
import { classificou, embaralhar, LIMITE_CLASSIFICACAO, proximaEtapa, amostraMaisProxima, amostrarPista, andarCarro, batida, comprimentoPista, contato, controlarIA, ESTA_RODANDO, evitar, FISICA, fatorTeto, ACRESCIMO_POR_VOLTA, formatarTempo, Progresso, reforcoRival, REFORCO_MAX, rodar, separar, SOLTO, VEL_INICIAL, TURBO_FATOR, TURBO_MS, VEL_FINAL, Voltas, type Carro } from './logic';
import { PISTAS } from './pistas';

describe('pistas', () => {
  // Pistas da equipe (assets/jogos/corrida/pistas, ampliadas 3x): o traçado vem da arte e é mais longo que o das pistas
  // antigas (que ficavam entre 30 e 70 s nesta conta); aqui, 50 a 105 s a 85% da velocidade de largada (146 px/s),
  // ou seja ~25 a ~50 s na velocidade de corrida (VEL_FINAL, 260 px/s, ou mais).
  it.each(PISTAS.map((p) => [p.id, p] as const))('%s: volta no tamanho certo (pistas da equipe: 40 a 85 s; antigas ampliadas: 50 a 105 s) a 85% da velocidade de largada, dentro do mundo', (_id, def) => {
    const am = amostrarPista(def.pontos);
    const seg = comprimentoPista(am) / (FISICA.vmax.asfalto * 0.85);
    // pistas da equipe no tamanho do jogo (escala 1, asfalto de 190 px desde 23/11/2026), com as velocidades x1,5:
    // ~17 a ~25 s por volta a 390 px/s; 30 a 60 s nesta conta conservadora (85% da velocidade de largada)
    const [min, max] = (def.escala ?? 1) === 1 ? [30, 60] : [50, 105];
    expect(seg).toBeGreaterThan(min);
    expect(seg).toBeLessThan(max);
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
  it('com o acelerador do jogador: acelera segurando e perde velocidade aos poucos ao soltar (sem dar ré)', () => {
    const c = novo();
    for (let i = 0; i < 300; i++) andarCarro(c, { giro: 0, freio: false, acelera: true }, 'asfalto', 1 / 60);
    expect(c.vx).toBeCloseTo(FISICA.vmax.asfalto, 0);
    andarCarro(c, { giro: 0, freio: false, acelera: false }, 'asfalto', 1);
    expect(c.vx).toBeCloseTo(FISICA.vmax.asfalto - FISICA.arrasto * SOLTO, 0);
    const parado = novo();
    for (let i = 0; i < 300; i++) andarCarro(parado, { giro: 0, freio: false, acelera: false }, 'asfalto', 1 / 60);
    expect(parado.vx).toBe(0);
    // soltar freia bem menos que o freio
    const a = novo(), b = novo();
    for (let i = 0; i < 300; i++) { andarCarro(a, { giro: 0, freio: false }, 'asfalto', 1 / 60); andarCarro(b, { giro: 0, freio: false }, 'asfalto', 1 / 60); }
    andarCarro(a, { giro: 0, freio: false, acelera: false }, 'asfalto', 0.25);
    andarCarro(b, { giro: 0, freio: true }, 'asfalto', 0.25);
    expect(a.vx).toBeGreaterThan(b.vx);
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
  it('teto começa em VEL_INICIAL e chega a VEL_FINAL px/s em 3 s', () => {
    expect(fatorTeto(0) * FISICA.vmax.asfalto).toBeCloseTo(VEL_INICIAL, 5);
    expect(fatorTeto(1500) * FISICA.vmax.asfalto).toBeCloseTo((VEL_INICIAL + VEL_FINAL) / 2, 5); // meio da rampa
    expect(fatorTeto(3000) * FISICA.vmax.asfalto).toBeCloseTo(VEL_FINAL, 5);
    expect(fatorTeto(60000) * FISICA.vmax.asfalto).toBeCloseTo(VEL_FINAL, 5);
  });
  it('o carro chega perto de VEL_FINAL px/s depois de 3 s e não passa disso', () => {
    const c: Carro = { x: 0, y: 0, ang: 0, vx: 0, vy: 0 };
    let max = 0;
    for (let i = 0; i < 360; i++) {
      andarCarro(c, { giro: 0, freio: false }, 'asfalto', 1 / 60, fatorTeto(i * (1000 / 60)));
      max = Math.max(max, c.vx);
    }
    expect(c.vx).toBeGreaterThan(205);
    expect(max).toBeLessThanOrEqual(VEL_FINAL + 0.01);
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
    // pistas da equipe têm asfalto mais estreito (51 a 63 px) e chicanes fechadas (Sakhir, Miami): o rival raspa a
    // zebra um pouco mais (medido ~3,2%); 4% ainda pega um piloto automático que sai da pista de verdade
    expect(fora / passos).toBeLessThan(def.arte && (def.escala ?? 1) > 1 ? 0.04 : 0.03);
  });
  it('carros que se sobrepõem são afastados até não se tocarem', () => {
    const a: Carro = { x: 0, y: 0, ang: 0, vx: 100, vy: 0 };
    const b: Carro = { x: 10, y: 0, ang: 0, vx: 0, vy: 0 };
    expect(separar(a, b, 8)).toBe(true);
    for (let i = 0; i < 10 && contato(a, b, 8); i++) separar(a, b, 8);
    expect(contato(a, b, 8)).toBeNull();
  });
  it('a cápsula pega o carro de ponta a ponta (batida por trás a 40 px)', () => {
    const a: Carro = { x: 0, y: 0, ang: 0, vx: 0, vy: 0 };
    expect(contato(a, { x: 40, y: 0, ang: 0, vx: 0, vy: 0 }, 9.5)).not.toBeNull();
    expect(contato(a, { x: 50, y: 0, ang: 0, vx: 0, vy: 0 }, 9.5)).toBeNull();
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
    const eu = car(0, 150), outro = car(60, 100);
    const r = evitar(eu, [eu, outro], 0);
    expect(r.lateral).not.toBe(0);
    expect(evitar(eu, [eu, car(60, 100) as Carro], 0).freio).toBe(false); // 60 px: ainda não precisa frear
    expect(evitar(eu, [eu, car(30, 50)], 0).freio).toBe(true);
    expect(evitar(eu, [eu, { ...outro, y: 50 }], 0).lateral).toBe(0); // em outra faixa
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

describe('carro rodopiando', () => {
  it('fica sem colisão: os outros passam por ele', () => {
    const rodando: Carro = { x: 0, y: 0, ang: 0, vx: 0, vy: 0 };
    rodar(rodando, 1, 1);
    const passando: Carro = { x: 5, y: 0, ang: 0, vx: 200, vy: 0 };
    expect(batida(passando, rodando, 9.5)).toBeNull();
    expect(passando.x).toBe(5);
    expect(ESTA_RODANDO(passando)).toBe(false);
  });
});

describe('velocidade por volta', () => {
  it('cada volta completada soma 30 px/s ao teto do asfalto', () => {
    expect(fatorTeto(3000, 0) * FISICA.vmax.asfalto).toBeCloseTo(VEL_FINAL, 5);
    expect(fatorTeto(3000, 1) * FISICA.vmax.asfalto).toBeCloseTo(VEL_FINAL + ACRESCIMO_POR_VOLTA, 5);
    expect(fatorTeto(3000, 4) * FISICA.vmax.asfalto).toBeCloseTo(VEL_FINAL + 4 * ACRESCIMO_POR_VOLTA, 5);
  });
  it.each(PISTAS.map((p) => [p.id, p] as const))('%s: o piloto automático segue na pista mesmo com +4 voltas (VEL_FINAL + 120 px/s)', (_id, def) => {
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
      andarCarro(c, controlarIA(c, am, idx, 0), sup, 1 / 60, fatorTeto(60000, 4) * 0.985);
      prog.atualizar(idx);
      passos++;
    }
    expect(prog.valor()).toBeGreaterThanOrEqual(am.length * 2);
    expect(fora / passos).toBeLessThan(0.08);
  });
});

describe('bônus', () => {
  const rodarAte = (c: Carro, passos: number): void => {
    for (let i = 0; i < passos; i++) andarCarro(c, { giro: 0, freio: false }, 'asfalto', 1 / 60, 1);
  };
  it('turbo dá 30% a mais de velocidade por 4 s e depois acaba', () => {
    const c: Carro = { x: 0, y: 0, ang: 0, vx: 0, vy: 0, turboMs: TURBO_MS };
    rodarAte(c, 180); // 3 s
    expect(c.vx).toBeCloseTo(FISICA.vmax.asfalto * TURBO_FATOR, 0);
    rodarAte(c, 120); // passa de 4 s
    expect(c.turboMs).toBe(0);
    expect(c.vx).toBeCloseTo(FISICA.vmax.asfalto, 0);
  });
  it('arco-íris: sem colisão com outros carros', () => {
    const a: Carro = { x: 0, y: 0, ang: 0, vx: 200, vy: 0, arcoMs: 1000 };
    const b: Carro = { x: 20, y: 0, ang: 0, vx: 50, vy: 0 };
    expect(batida(a, b, 9.5)).toBeNull();
    expect(a.x).toBe(0);
  });
  it('rodar aceita uma duração própria (meteoro: 2 s)', () => {
    const c: Carro = { x: 0, y: 0, ang: 0, vx: 300, vy: 0 };
    rodar(c, 1, 1, 2000);
    expect(c.rodaMs).toBe(2000);
  });
  it('depois de um teletransporte o progresso e as voltas são ajustados', () => {
    const p = new Progresso(1000, 950);
    p.definir(300);
    expect(p.valor()).toBe(300);
    p.definir(-20);
    expect(p.valor()).toBe(-20);
    // teletransportado para o 3º quarto: a volta continua valendo ao cruzar a linha
    const v = new Voltas(1000);
    v.ajustar(520, false);
    for (let i = 520; i < 1000; i += 4) v.atualizar(i, 10);
    expect(v.atualizar(5, 10)).toBe(true);
    // teletransportado antes da largada: o 1º cruzamento da linha ainda não é volta
    const w = new Voltas(1000);
    w.ajustar(990, true);
    expect(w.atualizar(5, 10)).toBe(false);
  });
});

describe('itens aleatórios', () => {
  it('o sorteio do tipo segue as chances e só dá tipos válidos', async () => {
    const { tipoSorteado } = await import('./itens');
    expect(tipoSorteado(0)).toBe('turbo');
    expect(tipoSorteado(0.45)).toBe('poca');
    expect(tipoSorteado(0.7)).toBe('arco');
    expect(tipoSorteado(0.99)).toBe('roleta');
  });
  it('poucos itens por vez e com intervalo grande', async () => {
    const { ITENS_MAX, INTERVALO_ITEM_MS, DISTANCIA_ITEM_PX } = await import('./itens');
    expect(ITENS_MAX).toBeLessThanOrEqual(3);
    expect(INTERVALO_ITEM_MS[0]).toBeGreaterThanOrEqual(8000);
    expect(DISTANCIA_ITEM_PX[0]).toBeGreaterThan(400);
  });
});

describe('traçados', () => {
  it('há 24 pistas, todas com id único', () => {
    expect(PISTAS.length).toBe(24);
    expect(new Set(PISTAS.map((p) => p.id)).size).toBe(24);
  });
  // Pista pintada por código: trechos distantes ficam bem separados. Pista da equipe: segue a arte, em que alguns
  // trechos passam colados (Baku, Jeddah, Miami); só se exige que não fiquem um em cima do outro (> 8 px entre centros).
  it.each(PISTAS.filter((p) => !p.cruza).map((p) => [p.id, p] as const))('%s: trechos distantes não se sobrepõem', (_id, def) => {
    const am = amostrarPista(def.pontos);
    const n = am.length;
    let min = Infinity;
    for (let i = 0; i < n; i += 2) {
      for (let j = i + 200; j < n; j += 2) {
        if (n - (j - i) < 200) continue;
        min = Math.min(min, Math.hypot(am[i]!.x - am[j]!.x, am[i]!.y - am[j]!.y));
      }
    }
    expect(min).toBeGreaterThan(def.arte && (def.escala ?? 1) > 1 ? 8 : def.largura + 40);
  });
});

describe('campeonato', () => {
  it('a ordem das pistas é uma permutação, e muda com o sorteio', () => {
    const a = embaralhar(24);
    expect([...a].sort((x, y) => x - y)).toEqual(Array.from({ length: 24 }, (_, i) => i));
    let t = 1;
    const semente = () => ((t = (t * 16807) % 2147483647) / 2147483647);
    const b = embaralhar(24, semente);
    const c = embaralhar(24, () => 0);
    expect(c).not.toEqual(Array.from({ length: 24 }, (_, i) => i)); // não é a ordem original
    expect(new Set(b).size).toBe(24);
  });
  it('só avança entre os 6 primeiros; senão repete a pista', () => {
    expect(LIMITE_CLASSIFICACAO).toBe(6);
    expect(classificou(6)).toBe(true);
    expect(classificou(7)).toBe(false);
    expect(proximaEtapa(3, 24, 1)).toBe(4);
    expect(proximaEtapa(3, 24, 6)).toBe(4);
    expect(proximaEtapa(3, 24, 7)).toBe(3);
    expect(proximaEtapa(3, 24, 11)).toBe(3);
  });
  it('depois da última pista o campeonato termina', () => {
    expect(proximaEtapa(23, 24, 2)).toBeNull();
    expect(proximaEtapa(23, 24, 9)).toBe(23);
  });
});

describe('vaca (arte em 3 ângulos)', () => {
  it('escolhe o desenho pelo sentido na tela e espelha para a esquerda', async () => {
    const { visualDaVaca } = await import('./itens');
    const g = (graus: number) => visualDaVaca((graus * Math.PI) / 180);
    expect(g(0)).toEqual({ chave: 'vaca_lado', espelha: false });
    expect(g(45)).toEqual({ chave: 'vaca_diagonal', espelha: false });
    expect(g(90)).toEqual({ chave: 'vaca_frente', espelha: false });
    expect(g(135)).toEqual({ chave: 'vaca_diagonal', espelha: true });
    expect(g(180)).toEqual({ chave: 'vaca_lado', espelha: true });
    expect(g(-60)).toEqual({ chave: 'vaca_lado', espelha: false }); // subindo à direita: de lado
    expect(g(-120)).toEqual({ chave: 'vaca_lado', espelha: true }); // subindo à esquerda: de lado, espelhada
    expect(g(360 + 90)).toEqual({ chave: 'vaca_frente', espelha: false });
  });
});
