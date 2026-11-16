// Formatos devolvidos pela API (api/app). Mudou lá, muda aqui.

export type Aba = 'inicio' | 'ranking' | 'perfil';

export interface Jogo {
  id: string;            // g01..g15
  nome: string;
  genero: string;
  descricao: string;
  cor1: string;
  cor2: string;
  metrica: string;       // o que a pontuação mede
  unidade: string;       // 'pontos', 'tacadas', 'ms'...
  ordem: 'maior' | 'menor'; // 'menor' = menos tacadas/tempo vence
  ranking: boolean;
  pasta: string | null;  // build em /games/<pasta>/; null = ainda não entregue
}

/** Desempenho de um perfil em um jogo. Sem posição = ainda não pontuou. */
export interface EstatJogo {
  melhor?: number;
  posicao?: number;
  progresso?: number;
}

export interface Conquista {
  nome: string;
  desc: string;
  feita: boolean;
}

/** Até 2 por conta (Q23). Cada um tem ranking, progresso, favoritos e conquistas próprios. */
export interface Perfil {
  id: string;
  apelido: string;
  cor: string;
  oculto: boolean;
  desde: string;         // MM/AAAA
  partidas: number;
  nivel: number;
  conquistas: Conquista[];
  favoritos: string[];
  jogos: Record<string, EstatJogo>;
}

export interface Sessao {
  perfilId: string | null; // quem está jogando neste aparelho
  perfis: Perfil[];
  maxPerfis: number;
}

export interface LinhaRanking {
  posicao: number;
  apelido: string;
  cor: string;
  pontos: number;
  eu: boolean;
}

/** Resposta da API ao fim da partida. Recusada = não entra no ranking (motivo fica gravado para a TI). */
export type ResultadoPartida =
  | { aceita: true; melhor: number | null; posicao: number | null }
  | { aceita: false; motivo: string };

/** Aparelhos são da conta, não do perfil (Q09). */
export interface Aparelho {
  id: string;
  nome: string;          // ex.: "Chrome · Android"
  vistoEm: string;       // ISO
  atual: boolean;
}
