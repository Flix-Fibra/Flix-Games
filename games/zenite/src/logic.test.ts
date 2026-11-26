import { describe, expect, it } from 'vitest';
import { ROOMS } from './levels';
import {
  SEM_ENTRADA, T, cabe, chegada, comAtalho, faseRelogio, noRelogio, soprar, ventos, marcas, naPorta, novoCorpo, passoCorpo, portas, sala, type Corpo, type Entrada,
} from './logic';
import { ALCANCE_FAISCA, CHEFE_HP, MURO, NUCLEO, PARADO, Partida } from './sim';

/** Salta a partir do chão de uma sala vazia e mede altura e distância. */
function medirPulo(segurar: number) {
  const s = sala('F1-5');
  const c = novoCorpo(12 * T, 11 * T); // vão entre as duas plataformas
  c.noChao = true;
  let alto = c.y;
  let passos = 0;
  do {
    passoCorpo(s, c, { ...SEM_ENTRADA, dir: true, pulo: passos < segurar, puloApertado: passos === 0 });
    alto = Math.min(alto, c.y);
    passos++;
  } while (!c.noChao && passos < 200);
  return { altura: 11 * T - alto, distancia: c.x - 12 * T };
}

type Alvo = (c: Corpo) => boolean;
const ACOES: Omit<Entrada, 'puloApertado'>[] = [];
for (const lado of [0, -1, 1])
  for (const v of [0, -1, 1])
    for (const pulo of [false, true])
      ACOES.push({ esq: lado < 0, dir: lado > 0, cima: v < 0, baixo: v > 0, pulo });

interface Opcoes {
  gancho?: boolean;
  repique?: boolean;
  /** ponto para onde procurar primeiro (só acelera a busca) */
  rumo?: { x: number; y: number };
}

/**
 * Robô: procura, com a física do jogo (inclusive relógio e vento), uma sequência de botões que leve ao alvo.
 * Explora primeiro o que chegou mais perto do rumo.
 */
function alcanca(id: string, inicio: { x: number; y: number; naEscada?: boolean }, alvo: Alvo, o: Opcoes = {}): boolean {
  // atalho aberto: é assim que a sala fica depois da alavanca
  const base = comAtalho(sala(id), true);
  const vistas = [noRelogio(base, 0), noRelogio(base, 1)];
  const faixas = ventos(base);
  const temRelogio = vistas[0] !== base;
  const hab = { gancho: o.gancho ?? id >= 'F2', repique: o.repique ?? false };
  const c0 = novoCorpo(inicio.x, inicio.y);
  c0.noChao = !inicio.naEscada;
  c0.naEscada = !!inicio.naEscada;
  type No = { c: Corpo; segurando: boolean; t: number };
  const chave = ({ c, segurando, t }: No) =>
    [Math.round(c.x / 4), Math.round(c.y / 4), Math.round(c.vy / 60), +c.naEscada, +c.noChao, +c.pulando, +segurando,
      +c.repicou, Math.round(c.impulso / 40), temRelogio ? (t % 180) / 6 : '',
      c.cabo ? `${c.cabo.ax}:${Math.round(c.cabo.ang * 8)}:${Math.round(c.cabo.w)}` : ''].join();
  const baldes: No[][] = [];
  let menor = 0;
  const guardar = (n: No) => {
    const d = o.rumo ? Math.floor(Math.hypot(n.c.x - o.rumo.x, n.c.y - o.rumo.y) / 12) : 0;
    const b = d + Math.floor(n.t / 240);
    (baldes[b] ??= []).push(n);
    menor = Math.min(menor, b);
  };
  const raiz = { c: c0, segurando: false, t: 0 };
  const vistos = new Set([chave(raiz)]);
  guardar(raiz);
  while (vistos.size < 700000) {
    while (menor < baldes.length && !baldes[menor]?.length) menor++;
    const atual = baldes[menor]?.pop();
    if (!atual) return false;
    for (const a of ACOES) {
      const c = { ...atual.c, cabo: atual.c.cabo && { ...atual.c.cabo! } };
      let t = atual.t;
      let achou = false;
      let fio = false;
      for (let p = 0; p < 6 && !achou && !fio; p++) {
        const s = vistas[faseRelogio(++t)]!;
        passoCorpo(s, c, { ...a, puloApertado: a.pulo && p === 0 && !atual.segurando }, hab);
        soprar(s, faixas, c);
        fio = s.tiles[Math.floor((c.y - 1) / T)]?.[Math.floor(c.x / T)] === '^';
        achou = !fio && alvo(c);
      }
      if (achou) return true;
      if (fio) continue;
      const no = { c, segurando: a.pulo, t };
      const k = chave(no);
      if (!vistos.has(k)) {
        vistos.add(k);
        guardar(no);
      }
    }
  }
  return false;
}

// quem vem de um segredo ainda fechado chega atrás de uma barreira
const entradas = (id: string) => {
  const s = comAtalho(sala(id), true);
  const p = marcas(s, 'P')[0];
  if (p) return [{ x: (p.col + 0.5) * T, y: (p.lin + 1) * T }];
  return portas(id).filter((d) => !d.destino.endsWith('-S') && !d.destino.startsWith('F4')).map((d) => chegada(s, [d.lin, d.col]));
};

describe('descer da plataforma', () => {
  const s = sala('F1-5'); // plataforma na linha 8, chão na linha 11
  const emPe = (x: number, lin: number) => {
    const c = novoCorpo(x * T, lin * T);
    c.noChao = true;
    return c;
  };

  it('seta para baixo atravessa a plataforma e para no chão', () => {
    const c = emPe(7, 8);
    for (let i = 0; i < 60; i++) passoCorpo(s, c, { ...SEM_ENTRADA, baixo: true });
    expect(c.y).toBe(11 * T);
    expect(c.noChao).toBe(true);
  });

  it('sem apertar nada continua em cima; no chão firme a seta não faz nada', () => {
    const alto = emPe(7, 8);
    const chao = emPe(14, 11);
    for (let i = 0; i < 30; i++) {
      passoCorpo(s, alto, SEM_ENTRADA);
      passoCorpo(s, chao, { ...SEM_ENTRADA, baixo: true });
    }
    expect(alto.y).toBe(8 * T);
    expect(chao.y).toBe(11 * T);
  });
});

describe('pulo', () => {
  it('segurando sobe 3 tiles e anda 4', () => {
    const m = medirPulo(99);
    expect(m.altura).toBeGreaterThanOrEqual(48);
    expect(m.altura).toBeLessThan(54);
    expect(m.distancia).toBeGreaterThanOrEqual(60);
    expect(m.distancia).toBeLessThan(70);
  });
  it('soltando cedo o pulo é baixo', () => {
    expect(medirPulo(1).altura).toBeLessThan(30);
  });
});

describe('mapas das fases 1 a 3', () => {
  it('toda sala tem as linhas do tamanho declarado e um tipo para cada inimigo', () => {
    for (const s of ROOMS) {
      expect(s.tiles.length, s.id).toBe(s.height);
      for (const l of s.tiles) expect(l.length, s.id).toBe(s.width);
      expect(marcas(s, 'EB').length, s.id).toBe(s.enemies.length);
    }
  });

  it('quem entra por uma porta aparece num espaço livre', () => {
    for (const s of ROOMS) for (const e of entradas(s.id)) expect(cabe(comAtalho(s, true), e.x, e.y), s.id).toBe(true);
  });

  // a porta atrás da parede rachada precisa do Impulso, que só vem na fase 4
  const fechada = (sala_: string, destino: string) => destino.endsWith('-S') || destino.startsWith('F4');
  // o item no alto à esquerda da Galeria só sai com o Repique, na fase 3
  const depois = (sala_: string, c: string) => sala_ === 'F2-3' && c === 'I';
  const casos = ROOMS.filter((s) => !s.id.endsWith('-S')).flatMap((s) => entradas(s.id).map((e, i) => ({ id: s.id, e, i })));

  it.each(casos)('$id, entrada $i: chega às passagens, aos itens, à repetidora e à alavanca', ({ id, e }) => {
    const s = comAtalho(sala(id), true);
    for (const p of portas(id)) {
      if (fechada(id, p.destino)) continue;
      const rumo = { x: (p.col + 0.5) * T, y: (p.lin + 1) * T };
      expect(alcanca(id, e, (c) => naPorta(s, c, p), { rumo }), `porta para ${p.destino}`).toBe(true);
    }
    for (const m of marcas(s, 'ISL')) {
      if (depois(id, m.c)) continue;
      const x = (m.col + 0.5) * T;
      const y = (m.lin + 1) * T;
      expect(alcanca(id, e, (c) => Math.abs(c.x - x) < 11 && Math.abs(c.y - y) < 4, { rumo: { x, y } }), `${m.c} em ${m.col},${m.lin}`).toBe(true);
    }
  }, 60000);

  it.each([['F2-3', 'F2-4'], ['F2-5', 'F2-6'], ['F2-6', 'F3-1']])('%s: sem o cabo não se chega à saída', (id, destino) => {
    const s = sala(id);
    const esquerda = portas(id).find((d) => d.col === 0)!;
    const p = portas(id).find((d) => d.destino === destino)!;
    expect(alcanca(id, chegada(s, [esquerda.lin, esquerda.col]), (c) => naPorta(s, c, p), { gancho: false })).toBe(false);
  }, 60000);

  it('o item alto da Galeria só sai com o Repique', () => {
    const s = sala('F2-3');
    const m = marcas(s, 'I')[0]!;
    const rumo = { x: (m.col + 0.5) * T, y: (m.lin + 1) * T };
    const pegou = (c: Corpo) => Math.abs(c.x - rumo.x) < 11 && Math.abs(c.y - rumo.y) < 4;
    const e = chegada(s, [8, 0]);
    expect(alcanca('F2-3', e, pegou, { rumo })).toBe(false);
    expect(alcanca('F2-3', e, pegou, { rumo, repique: true })).toBe(true);
  }, 120000);

  it('a parede rachada segura a porta do segredo', () => {
    const s = sala('F1-3');
    const p = portas('F1-3').find((d) => d.destino === 'F1-S')!;
    expect(alcanca('F1-3', entradas('F1-3')[0]!, (c) => naPorta(s, c, p))).toBe(false);
  }, 60000);
});

describe('partida', () => {
  const rodar = (j: Partida, n: number, c = PARADO) => {
    for (let i = 0; i < n; i++) j.passo(c);
  };

  it('o golpe acerta uma vez por ataque e derrota a Faísca', () => {
    const j = new Partida();
    const f = j.inimigos[0]!;
    j.corpo.x = f.x - 34;
    f.lado = 1;
    j.passo({ ...PARADO, golpeApertado: true });
    rodar(j, 30);
    expect(j.inimigos).toHaveLength(0);
    expect(j.pontos).toBe(100);
  });

  it('morrer volta para a repetidora com a vida cheia', () => {
    const j = new Partida('F1-3');
    const s = marcas(j.sala, 'S')[0]!;
    j.corpo.x = (s.col + 0.5) * T;
    rodar(j, 2);
    j.entrar('F1-4', 3 * T, 13 * T, 1);
    j.hp = 1;
    const d = j.inimigos.find((i) => i.tipo === 'faisca')!;
    j.corpo.x = d.x;
    j.corpo.y = d.y;
    rodar(j, 1);
    expect(j.morta).toBeGreaterThan(0);
    rodar(j, 130);
    expect(j.sala.id).toBe('F1-3');
    expect(j.hp).toBe(j.hpMax);
  });

  it('o chefe só se fere quando está caído, e a porta abre quando ele cai', () => {
    const j = new Partida('F1-5');
    const b = j.chefe!;
    j.corpo.x = b.x - 30;
    j.passo({ ...PARADO, golpeApertado: true });
    rodar(j, 20);
    expect(b.hp).toBe(CHEFE_HP.transformador);
    expect(j.portasFechadas()).toBe(true);
    for (let i = 0; i < 20000 && b.estado !== 'morto'; i++) {
      j.invencivel = 99;
      if (b.estado === 'aberto') {
        j.corpo.x = b.x - 30;
        j.corpo.lado = 1;
      }
      j.passo({ ...PARADO, golpeApertado: b.estado === 'aberto' });
    }
    expect(b.estado).toBe('morto');
    expect(j.portasFechadas()).toBe(false);
    // atravessa a porta da direita: começa a fase 2
    j.corpo.x = 24 * T;
    j.corpo.y = 11 * T;
    for (let i = 0; i < 600 && j.sala.id === 'F1-5'; i++) {
      j.invencivel = 99;
      j.passo({ ...PARADO, dir: true });
    }
    expect(j.sala.id).toBe('F2-1');
    expect(j.fim).toBe(false);
    expect(j.pontos).toBeGreaterThanOrEqual(2000);
  });

  it('o transformador só machuca quando cai em cima da heroína', () => {
    const j = new Partida('F1-5');
    const b = j.chefe!;
    // encostada no robô parado: nada acontece
    j.corpo.x = b.x;
    j.passo(PARADO);
    expect(j.hp).toBe(j.hpMax);
    // parada no lugar, ele mira nela e cai em cima
    for (let i = 0; i < 200 && b.estado !== 'aberto'; i++) {
      expect(j.hp).toBe(j.hpMax);
      j.passo(PARADO);
    }
    expect(b.estado).toBe('aberto');
    expect(j.hp).toBe(j.hpMax - 1);
  });

  it('quem sai de debaixo antes da queda não se machuca com o corpo', () => {
    const j = new Partida('F1-5');
    const b = j.chefe!;
    for (let i = 0; i < 200 && b.estado !== 'salto'; i++) j.passo(PARADO);
    j.corpo.x = b.para.x < 15 * T ? 26 * T : 4 * T;
    for (let i = 0; i < 100 && b.estado !== 'aberto'; i++) j.passo(PARADO);
    expect(j.hp).toBe(j.hpMax);
  });

  it.each(['F2-1', 'F2-3', 'F2-5'])('%s: os ratos continuam no piso deles', (id) => {
    const j = new Partida(id);
    const antes = j.inimigos.filter((i) => i.tipo === 'rato').map((i) => i.y);
    for (let p = 0; p < 1800; p++) {
      j.invencivel = 99;
      j.passo(PARADO);
      j.inimigos.filter((i) => i.tipo === 'rato').forEach((r, n) => {
        expect(r.y).toBeLessThanOrEqual(antes[n]! + 0.01);
        expect(r.y).toBeGreaterThan(antes[n]! - 24);
      });
    }
  });

  it.each([['F1-5', 'transformador'], ['F2-6', 'matriarca'], ['F3-6', 'firewall']] as const)('%s: os golpes do chefe somem a duas larguras dele', (id, tipo) => {
    const j = new Partida(id);
    const ate = ALCANCE_FAISCA[tipo];
    let longe = 0;
    for (let p = 0; p < 3000; p++) {
      j.invencivel = 99;
      j.passo(PARADO);
      for (const f of j.faiscas) {
        const d = Math.abs(f.x - f.limite.origem);
        expect(d).toBeLessThanOrEqual(ate);
        longe = Math.max(longe, d);
      }
    }
    // chegam até o limite (a não ser que a parede venha antes)
    expect(longe).toBeGreaterThan(ate - 3);
  });

  it('a alavanca abre o atalho entre a Estação e a Caixa de Emenda', () => {
    const j = new Partida('F2-4');
    expect(j.sala.tiles[11]![18]).toBe('A');
    const l = marcas(j.sala, 'L')[0]!;
    j.corpo.x = (l.col + 0.5) * T;
    j.passo(PARADO);
    expect(j.atalhos.has('F2')).toBe(true);
    expect(j.atalhos.has('F3')).toBe(false);
    expect(j.sala.tiles[11]![18]).toBe('H');
    // desce pela escada e chega pendurada na outra sala; sobe de volta
    j.corpo.x = 18.5 * T;
    for (let i = 0; i < 60 && j.sala.id === 'F2-4'; i++) j.passo({ ...PARADO, baixo: true });
    expect(j.sala.id).toBe('F2-2');
    expect(j.corpo.naEscada).toBe(true);
    for (let i = 0; i < 60 && j.sala.id === 'F2-2'; i++) j.passo({ ...PARADO, cima: true });
    expect(j.sala.id).toBe('F2-4');
  });

  it('a Matriarca só aparece depois do aviso, cai e leva à fase 3', () => {
    const j = new Partida('F2-6');
    const b = j.chefe!;
    for (let i = 0; i < 30000 && b.estado !== 'morto'; i++) {
      j.invencivel = 99;
      const aberta = b.estado === 'aberto';
      if (aberta) {
        j.corpo.x = b.x - 32;
        j.corpo.y = 11 * T;
        j.corpo.lado = 1;
      }
      j.passo({ ...PARADO, golpeApertado: aberta });
    }
    expect(b.estado).toBe('morto');
    j.corpo.x = 27 * T;
    j.corpo.y = 11 * T;
    for (let i = 0; i < 600 && j.sala.id === 'F2-6'; i++) {
      j.invencivel = 99;
      j.passo({ ...PARADO, dir: true });
    }
    expect(j.sala.id).toBe('F3-1');
    expect(j.fim).toBe(false);
  });

  it('o Pacote se divide em dois menores', () => {
    const j = new Partida('F3-3');
    const p = j.inimigos[0]!;
    j.corpo.x = p.x - 30;
    j.corpo.y = p.y;
    j.corpo.lado = 1;
    j.passo({ ...PARADO, golpeApertado: true });
    for (let i = 0; i < 12; i++) j.passo(PARADO);
    expect(j.inimigos.map((i) => i.tipo)).toEqual(['pacotinho', 'pacotinho']);
  });

  it('o ventilador empurra para a esquerda e não quebra', () => {
    const j = new Partida('F3-5');
    const v = j.inimigos.find((i) => i.tipo === 'cooler')!;
    j.corpo.x = v.x - 24;
    j.corpo.y = v.y;
    j.corpo.lado = 1;
    j.invencivel = 99;
    const x = j.corpo.x;
    j.passo({ ...PARADO, golpeApertado: true });
    for (let i = 0; i < 20; i++) j.passo(PARADO);
    expect(j.corpo.x).toBeLessThan(x);
    expect(j.inimigos).toContain(v);
  });

  it('o Firewall avança, recua a cada 3 golpes no núcleo e entrega o Repique', () => {
    const j = new Partida('F3-6');
    const b = j.chefe!;
    for (let i = 0; i < 960; i++) {
      j.invencivel = 99;
      j.passo(PARADO);
    }
    expect(b.x).toBeGreaterThan(MURO.inicio + 3 * T);
    let recuou = 0;
    for (let i = 0; i < 4000 && b.estado !== 'morto'; i++) {
      j.invencivel = 99;
      // em cima do pilar, ao lado do núcleo
      Object.assign(j.corpo, { x: NUCLEO.x - 26, y: NUCLEO.y, vy: 0, noChao: true, lado: 1 });
      const antes = b.x;
      j.passo({ ...PARADO, golpeApertado: true });
      if (b.x < antes - T) recuou++;
    }
    expect(b.estado).toBe('morto');
    // o primeiro recuo acontece com o muro já avançado; os outros param no começo da sala
    expect(recuou).toBeGreaterThanOrEqual(1);
    expect(j.temRepique).toBe(true);
    for (let i = 0; i < 900 && !j.fim; i++) {
      j.invencivel = 99;
      Object.assign(j.corpo, j.corpo.x < 27 * T ? { x: 27 * T, y: NUCLEO.y } : {});
      j.passo({ ...PARADO, dir: true });
    }
    expect(j.fim).toBe(true);
  });
});
