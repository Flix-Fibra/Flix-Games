import { parseLevel, type Level, type LevelDef } from './logic';

/**
 * Percurso do Minigolfe Flix. Cada fase é uma grade de texto (legenda: `LEGEND` em logic.ts e docs/ADDING_LEVELS.md).
 * A ordem vai da mais fácil para a mais difícil (`ORDEM`, no fim do arquivo): primeiro as fases de aprender
 * (`FACEIS`), depois uma mecânica por vez e, no fim, as que combinam várias. As 7 fases desenhadas pelo gestor
 * (pasta "Fases Mini Golf") continuam no percurso, em outra posição. Conceito de cada fase em docs/MINIGOLFE_FASES.md.
 * Par: calibrado pelo robô de `levels.solve.test.ts` (SOLVE=1 npx vitest run games/minigolfe/tools).
 */
const BASE: LevelDef[] = [
  // 1. Moinho (imagem 1): três bombas nos cantos, moinho no corredor do buraco
  {
    id: 'moinho',
    name: 'Moinho',
    par: 3,
    rows: [
      '###########',
      '####.H.####',
      '####...####',
      '####...####',
      '####.W.####',
      '####...####',
      '####...####',
      '###.....###',
      '##.......##',
      '#....o....#',
      '#.B..T..B.#',
      '#...o.o...#',
      '##.......##',
      '###..B..###',
      '###########',
    ],
  },
  // 2. Esteira (imagem 2): a faixa vermelha leva a bola para cima
  {
    id: 'esteira',
    name: 'Esteira',
    par: 3,
    rows: [
      '#########',
      '#.......#',
      '#.....^^#',
      '#...##^^#',
      '#...##^^#',
      '#...##^^#',
      '#.H.##^^#',
      '#...##.T#',
      '#########',
    ],
  },
  // 3. Pescoço (imagem 3): bloco no estreito, portais nos cantos
  {
    id: 'pescoco',
    name: 'Pescoço',
    par: 3,
    rows: [
      '############',
      '#1........T#',
      '#..........#',
      '#####..#####',
      '###....#####',
      '#####..#####',
      '#..........#',
      '#H........1#',
      '############',
    ],
    blocks: [{ from: [5, 4], to: [3, 4], size: [2, 1], period: 4 }],
  },
  // 4. Salto (imagem 4): a rampa faz a bola voar por cima da água
  {
    id: 'salto',
    name: 'Salto',
    par: 2,
    rows: [
      '#######',
      '##.H.##',
      '##...##',
      '##...##',
      '##.s.##',
      '##...##',
      '##~~~##',
      '##~~~##',
      '##~~~##',
      '##...##',
      '##...##',
      '##.U.##',
      '##...##',
      '##.T.##',
      '#######',
    ],
  },
  // 5. Pistões (imagem 5): três pistões sobem e descem
  {
    id: 'pistoes',
    name: 'Pistões',
    par: 2,
    rows: [
      '########',
      '#P...H.#',
      '#.P....#',
      '#...P..#',
      '#...####',
      '#...####',
      '#...####',
      '#...####',
      '#.T.####',
      '########',
    ],
  },
  // 6. Dois blocos (imagem 6): dois blocos saem do nicho e fecham o corredor
  {
    id: 'dois-blocos',
    name: 'Dois Blocos',
    par: 2,
    rows: [
      '#######',
      '####.H#',
      '####..#',
      '####..#',
      '####..#',
      '#.....#',
      '#.....#',
      '#.....#',
      '#.....#',
      '####..#',
      '####..#',
      '####..#',
      '####T.#',
      '#######',
    ],
    blocks: [
      { from: [2, 5], to: [4, 5], size: [2, 1], period: 4 },
      { from: [2, 7], to: [4, 7], size: [2, 1], period: 4, phase: 0.5 },
    ],
  },
  // 7. Lava (imagem 7): quatro pares de blocos que acendem e apagam
  {
    id: 'lava',
    name: 'Lava',
    par: 2,
    rows: [
      '########',
      '###.H###',
      '###XX###',
      '###..###',
      '###..###',
      '#oY..Yo#',
      '#.Y..Y.#',
      '###..###',
      '###..###',
      '###XX###',
      '###..###',
      '###T.###',
      '########',
    ],
  },
  // 8. Teleporte e esteira: portais atravessam a parede; a esteira empurra contra
  {
    id: 'teleporte-esteira',
    name: 'Contramão',
    par: 3,
    rows: [
      '#########',
      '#H..#...#',
      '#...#.1.#',
      '#...#vvv#',
      '#...#vvv#',
      '#.1.#vvv#',
      '#...#...#',
      '#...#.T.#',
      '#########',
    ],
  },
  // 9. Bomba na esteira: a esteira leva a bola até a bomba; o atalho é o buraco em uma
  {
    id: 'bomba-esteira',
    name: 'Correia Bomba',
    par: 3,
    rows: [
      '#########',
      '#H......#',
      '#.......#',
      '#.##.##.#',
      '#.......#',
      '#.......#',
      '#T>>>>>B#',
      '#########',
    ],
  },
  // 10. Moinho duplo: duas pás gigantes, em sentidos opostos, com gelo no meio
  {
    id: 'moinho-duplo',
    name: 'Moinho Duplo',
    par: 3,
    tune: { windBlades: 2, windLen: 2.3, windSpeed: 1.0 },
    rows: [
      '#######',
      '#..H..#',
      '#.....#',
      '#.....#',
      '#..W..#',
      '#.....#',
      '#iiiii#',
      '#iiiii#',
      '#.....#',
      '#..W..#',
      '#.....#',
      '#.....#',
      '#..T..#',
      '#######',
    ],
  },
  // 11. Lava e rampa: a água só se vence voando; a lava espera do outro lado
  {
    id: 'lava-rampa',
    name: 'Voo sobre a Lava',
    par: 3,
    rows: [
      '#######',
      '##.H.##',
      '##...##',
      '##XXX##',
      '##...##',
      '##~~~##',
      '##~~~##',
      '##...##',
      '##...##',
      '##.U.##',
      '##...##',
      '##.T.##',
      '#######',
    ],
  },
  // 12. Portal dos pistões: pistões guardam o portal que leva ao buraco
  {
    id: 'portal-pistoes',
    name: 'Portal dos Pistões',
    par: 3,
    rows: [
      '#########',
      '#...H...#',
      '#.......#',
      '#1......#',
      '#########',
      '#......1#',
      '#..P.P..#',
      '#.......#',
      '#..P.P..#',
      '#T......#',
      '#########',
    ],
  },
  // 13. Ímãs e moinho: ímãs repelem e atraem, empurrando a bola contra as pás
  {
    id: 'imas-moinho',
    name: 'Ímãs e Moinho',
    par: 3,
    rows: [
      '###########',
      '#....H....#',
      '#.........#',
      '#.M.....M.#',
      '#....W....#',
      '#.........#',
      '#.m.....m.#',
      '#.........#',
      '#....T....#',
      '###########',
    ],
  },
  // 14. Gelo e bomba: o gelo escorrega, as bombas dos cantos prendem a bola
  {
    id: 'gelo-bomba',
    name: 'Pista de Gelo',
    par: 3,
    rows: [
      '###########',
      '#B...H...B#',
      '#iiiiiiiii#',
      '#iiiioiiii#',
      '#iiiiiiiii#',
      '#iioiiioii#',
      '#iiiiiiiii#',
      '#....T....#',
      '###########',
    ],
  },
  // 15. Cruzamento: bloco varrendo, esteira contra e lava nas laterais
  {
    id: 'cruzamento',
    name: 'Cruzamento',
    par: 3,
    rows: [
      '#########',
      '#...H...#',
      '#.......#',
      '#XXX.YYY#',
      '#XXX.YYY#',
      '#.......#',
      '#<<<<<<<#',
      '#.......#',
      '#.......#',
      '#...T...#',
      '#########',
    ],
    blocks: [{ from: [1, 8], to: [6, 8], size: [2, 1], period: 5 }],
  },
  // 16. Grande final: bombas, gelo, moinho e lava guardando o buraco
  {
    id: 'final',
    name: 'Grande Final',
    par: 4,
    rows: [
      '###########',
      '####.H.####',
      '####...####',
      '####XYX####',
      '####...####',
      '####.W.####',
      '####...####',
      '###.....###',
      '#B.......B#',
      '#..iiiii..#',
      '#..iiiii..#',
      '#....T....#',
      '###########',
    ],
  },
];

/** Fases para aprender: uma ideia por vez, sem engenhos que punem. */
const FACEIS: LevelDef[] = [
  // reta: só mirar e dosar a força
  {
    id: 'reta',
    name: 'Primeira Tacada',
    par: 2,
    rows: [
      '#######',
      '##.H.##',
      '##...##',
      '##...##',
      '##...##',
      '##...##',
      '##...##',
      '##.T.##',
      '#######',
    ],
  },
  // curva: o buraco fica depois de uma esquina
  {
    id: 'curva',
    name: 'Esquina',
    par: 3,
    rows: [
      '#########',
      '#H......#',
      '#.......#',
      '#####...#',
      '#####...#',
      '#####...#',
      '#####.T.#',
      '#########',
    ],
  },
  // tabela: um bloco no meio; dá para contornar ou usar a parede
  {
    id: 'tabela',
    name: 'Tabela',
    par: 2,
    rows: [
      '#########',
      '#...H...#',
      '#.......#',
      '#..###..#',
      '#..###..#',
      '#.......#',
      '#...T...#',
      '#########',
    ],
  },
  // areia: freia muito; quem passa pelo lado chega mais fácil
  {
    id: 'areia',
    name: 'Banco de Areia',
    par: 2,
    rows: [
      '#########',
      '#...H...#',
      '#.......#',
      '#.sssss.#',
      '#.sssss.#',
      '#.......#',
      '#...T...#',
      '#########',
    ],
  },
  // postes: quicam com força; desviar ou aproveitar o quique
  {
    id: 'postes',
    name: 'Postes',
    par: 2,
    rows: [
      '#########',
      '#...H...#',
      '#.......#',
      '#.o...o.#',
      '#...o...#',
      '#.......#',
      '#.o...o.#',
      '#...T...#',
      '#########',
    ],
  },
  // ziguezague: duas esquinas, uma de cada lado
  {
    id: 'zigue',
    name: 'Ziguezague',
    par: 4,
    rows: [
      '#########',
      '#H......#',
      '#.......#',
      '#####...#',
      '#.......#',
      '#.......#',
      '#...#####',
      '#.......#',
      '#......T#',
      '#########',
    ],
  },
  // lago: água no caminho reto (+1); o caminho seguro é pela direita
  {
    id: 'lago',
    name: 'Lago',
    par: 3,
    rows: [
      '#########',
      '#...H...#',
      '#.......#',
      '#~~~~~..#',
      '#~~~~~..#',
      '#.......#',
      '#...T...#',
      '#########',
    ],
  },
  // gelo: escorrega; tacada fraca basta
  {
    id: 'patinacao',
    name: 'Patinação',
    par: 2,
    rows: [
      '#######',
      '##.H.##',
      '##...##',
      '##iii##',
      '##iii##',
      '##iii##',
      '##...##',
      '##.T.##',
      '#######',
    ],
  },
  // moinho simples: só esperar a pá passar
  {
    id: 'moinho-simples',
    name: 'Moinho Clássico',
    par: 2,
    rows: [
      '#######',
      '##.H.##',
      '##...##',
      '##...##',
      '##.W.##',
      '##...##',
      '##...##',
      '##.T.##',
      '#######',
    ],
  },
];

/** Ordem do percurso: da mais fácil para a mais difícil. */
const ORDEM = [
  'reta', 'curva', 'tabela', 'areia', 'postes', 'zigue', 'lago', 'patinacao',
  'esteira', 'moinho-simples', 'salto', 'pistoes', 'dois-blocos', 'lava', 'pescoco', 'teleporte-esteira',
  'moinho', 'bomba-esteira', 'portal-pistoes', 'gelo-bomba', 'lava-rampa', 'imas-moinho', 'moinho-duplo', 'cruzamento',
  'final',
];

const TODAS = new Map([...FACEIS, ...BASE].map((d) => [d.id, d]));
export const LEVEL_DEFS: LevelDef[] = ORDEM.map((id) => {
  const d = TODAS.get(id);
  if (!d) throw new Error(`fase "${id}" não existe`);
  return d;
});
if (LEVEL_DEFS.length !== TODAS.size) throw new Error('alguma fase ficou fora de ORDEM');

export const LEVELS: Level[] = LEVEL_DEFS.map(parseLevel);
