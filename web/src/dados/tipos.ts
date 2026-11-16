export type JogoId = 'voo' | 'labirinto' | 'soma' | 'cobrinha' | 'blocos' | 'corrida' | 'paciencia' | 'memoria';
export type Aba = 'inicio' | 'ranking' | 'perfil';

export interface Jogo {
  id: JogoId;
  nome: string;
  genero: string;
  c1: string;
  c2: string;
  desc: string;
  tamanho: string;
  ranking: boolean;
  unidade?: string;
  controle?: boolean;
}

/** Desempenho de um perfil em um jogo. Sem posição = ainda não pontuou. */
export interface EstatJogo {
  melhor?: number;
  posicao?: number;
  progresso?: number;
}

/** Até 2 por conta (Q23). Cada um tem ranking, progresso, favoritos e conquistas próprios. */
export interface Perfil {
  id: string;
  apelido: string;
  cor: string;
  nivel: number;
  partidas: number;
  desde: string;
  oculto: boolean;
  conquistas: boolean[];
  favoritos: JogoId[];
  jogos: Partial<Record<JogoId, EstatJogo>>;
}

export interface LinhaRanking {
  posicao: number;
  apelido: string;
  pontos: number;
  eu?: boolean;
}

/** Aparelhos são da conta, não do perfil (Q09). */
export interface Aparelho {
  id: string;
  nome: string;
  detalhe: string;
  tipo: 'cel' | 'pc' | 'tab';
  atual?: boolean;
}

export interface Conquista {
  nome: string;
  desc: string;
}
