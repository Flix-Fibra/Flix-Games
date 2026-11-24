// Formatos devolvidos pela API (api/app). Mudou lá, muda aqui.
import type { PersonagemFlix } from '../personagem/flix';

export type Aba = 'inicio' | 'jogos' | 'ranking' | 'perfil' | 'creditos';

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
  capa: string | null;   // imagem dentro da pasta do jogo (vem do game.json); null = ícone desenhado
  previa?: string | null; // animação curta (WebP) dentro da pasta do jogo, atrás do topo da página "Ver"
  avaliacao?: { media: number | null; total: number }; // média de 1 a 5 (1 casa) e total de notas; media null = sem notas
  partidas?: number;      // partidas terminadas de todos os jogadores (filtro "Mais jogados")
  imagens?: string[];     // telas do jogo (dentro da pasta dele), na galeria da página "Ver" junto da prévia
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

/** Até 4 por conta (Q23; limite em MAX_PERFIS na API). Cada um tem ranking, progresso, favoritos e conquistas próprios. */
export interface Perfil {
  id: string;
  apelido: string;
  cor: string;
  oculto: boolean;
  // Nome verdadeiro (opcional). O dono sempre vê; os outros só no ranking, e só com mostrarNome ligado.
  nome: string | null;
  sobrenome: string | null;
  mostrarNome: boolean;
  avatar: AvatarConfig | null; // null = personagem padrão
  personagem: PersonagemFlix | null; // personagem Flix (configuração para reconstruir, não imagem)
  desde: string;         // MM/AAAA
  partidas: number;
  nivel: number;
  conquistas: Conquista[];
  favoritos: string[];
  recentes: string[];    // jogos pela partida mais recente (a fileira do Início mostra os 3 primeiros que estão no hub)
  jogos: Record<string, EstatJogo>;
}

export interface Sessao {
  perfilId: string | null; // quem está jogando neste aparelho
  perfis: Perfil[];
  maxPerfis: number;
  cores: string[];       // paleta da cor de fundo do perfil (a API só aceita estas)
}

export interface LinhaRanking {
  posicao: number;
  apelido: string;       // nickname: único entre todos os jogadores, sempre visível
  nome: string | null;   // nome verdadeiro, só quando o jogador habilitou (a API não envia nos outros casos)
  cor: string;
  pontos: number;
  eu: boolean;
}

/** Pontos Flix de um perfil num jogo, na temporada: 1000 × (jogadores − posição + 0,5) / jogadores. */
export interface PontosNoJogo {
  jogoId: string;
  posicao: number;
  jogadores: number;
  melhor: number;        // melhor resultado na temporada, na unidade do jogo
  pontos: number;
}

/** Linha do ranking geral: `pontos` é a soma dos Pontos Flix de todos os jogos, com o detalhe em `jogos`. */
export interface LinhaRankingGeral extends LinhaRanking {
  jogos: PontosNoJogo[];
}

/** Ranking geral de uma temporada (mês "AAAA-MM", fuso de Brasília). */
export interface RankingGeral {
  temporada: string;
  atual: string;
  linhas: LinhaRankingGeral[];
}

/** Temporadas que a página Ranking oferece: a atual e as anteriores com partidas (até 12), da mais nova para a mais velha. */
export interface Temporadas {
  atual: string;
  temporadas: string[];
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

// ---------- Personagem (AvatarConfig v1, seção 9.3 do prompt dos minigames) ----------
// Só IDs do catálogo. A API valida contra o catálogo antes de gravar.
export interface AvatarConfig {
  v: 1;
  body: { type: string; skinTone: string };
  face: { eyes: string; mouth: string };
  hair: { style: string; color: string } | null;
  top: { item: string; primary: string; secondary?: string | null } | null;
  bottom: { item: string; primary: string; secondary?: string | null } | null;
  shoes: { item: string; primary: string } | null;
  hat: { item: string; primary?: string | null } | null;
  accessories: string[];
  skinPreset: string | null;
}

export interface CorCatalogo { id: string; hex: string; tipo?: 'realista' | 'fantasia' }
export interface ItemCatalogo { id: string; nome: string }

/** Catálogo servido pela API, lido de packages/flix-avatar (fonte única, a mesma dos jogos). */
export interface CatalogoAvatar {
  versao: number;
  provisorio: boolean;
  paletas: { pele: CorCatalogo[]; cabelo: CorCatalogo[]; roupa: CorCatalogo[] };
  corpos: ItemCatalogo[];
  olhos: ItemCatalogo[];
  bocas: ItemCatalogo[];
  cabelos: ItemCatalogo[];
  camisetas: ItemCatalogo[];
  calcas: ItemCatalogo[];
  calcados: ItemCatalogo[];
  chapeus: ItemCatalogo[];
  acessorios: ItemCatalogo[];
  skins: ItemCatalogo[];
  padrao: AvatarConfig; // personagem padrão, o mesmo do packages/flix-avatar
}

/** Página do jogo: média das notas (1 a 5), quantas avaliações e a nota deste perfil. */
export interface ResumoAvaliacao {
  media: number | null;
  total: number;
  minha: number | null;
}

export interface Comentario {
  id: string;
  apelido: string; // "Jogador Flix" quando o autor está oculto no ranking
  cor: string;
  texto: string;
  criadoEm: string;
  meu: boolean;
}

export interface DetalhesJogo {
  avaliacao: ResumoAvaliacao;
  comentarios: Comentario[];
}

/** Campos que o dono pode mudar no perfil. Só os enviados mudam; nome/sobrenome vazios apagam. */
export interface AlteracaoPerfil {
  apelido?: string;
  oculto?: boolean;
  nome?: string | null;
  sobrenome?: string | null;
  mostrarNome?: boolean;
  cor?: string;
}

/** Criação de perfil: nickname, nome e sobrenome obrigatórios; o nome só aparece no ranking com mostrarNome. */
export interface NovoPerfil {
  apelido: string;
  nome: string;
  sobrenome: string;
  mostrarNome: boolean;
  cor?: string; // da paleta de Sessao.cores; sem cor, a API usa a primeira ainda não usada na conta
}
