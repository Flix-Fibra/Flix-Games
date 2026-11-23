/**
 * Novidades do Início (card "Novidades", o primeiro da fileira). Fonte única: este arquivo, atualizado pela equipe
 * a cada entrega que o jogador percebe (jogo novo no catálogo, mudança visível na plataforma).
 *
 * Regras:
 * - mais recente primeiro; `data` no formato AAAA-MM-DD;
 * - texto para o cliente: o que ele ganha, sem detalhe técnico;
 * - `tipo: 'jogo'` leva `jogoId` e só aparece quando o jogo está no catálogo publicado (novidade de jogo que ainda
 *   não está no hub fica guardada aqui e aparece sozinha quando ele entrar); sem `texto`, usa a descrição do jogo.
 *   A data dela também põe o jogo no filtro "Novos" da aba Jogos por DIAS_DE_NOVO dias.
 *
 * - `imagem` (opcional, quando ajuda a entender): caminho em web/public/novidades/ (WebP, 16:9, ~960 px de largura),
 *   com `imagemAlt` descrevendo o que ela mostra. Sem dado pessoal real na imagem (use perfis de teste).
 *
 * O "ranking" das novidades não vem daqui: são os líderes de cada jogo, lidos da API na hora (sem somar pontuações
 * de jogos diferentes, que medem coisas diferentes; ver Q20 em docs/andamento.md).
 */
export type TipoNovidade = 'jogo' | 'plataforma';

export interface Novidade {
  data: string;
  tipo: TipoNovidade;
  titulo: string;
  texto?: string;
  jogoId?: string;
  imagem?: string;
  imagemAlt?: string;
}

export const NOVIDADES: Novidade[] = [
  {
    data: '2026-11-19',
    tipo: 'plataforma',
    titulo: 'Seu personagem dentro dos jogos',
    texto: 'O personagem que você cria aqui agora aparece nos jogos, começando pelo Network Snake. E, enquanto você joga, a plataforma por trás fica parada para o jogo rodar mais leve.',
  },
  {
    data: '2026-11-19',
    tipo: 'plataforma',
    titulo: 'Pesquisa e novos filtros em Jogos',
    texto: 'Procure um jogo pelo nome, veja os Novos e os Mais jogados e confira a nota de cada jogo em estrelas. O coração abaixo de cada jogo favorita sem precisar abrir.',
    imagem: '/novidades/pesquisa-e-filtros.webp',
    imagemAlt: 'Aba Jogos com o campo de pesquisa, os filtros Favoritos, Todos, Novos e Mais jogados e os jogos com a nota em estrelas',
  },
  {
    data: '2026-11-19',
    tipo: 'plataforma',
    titulo: 'Nickname único e nome no ranking',
    texto: 'Cada jogador tem um nickname só seu, que ninguém mais pode usar. Ao criar o perfil, você escolhe a cor e informa nome e sobrenome; o nome só aparece no ranking, discretamente abaixo do nickname, se você ligar essa opção.',
    imagem: '/novidades/nickname-e-nome.webp',
    imagemAlt: 'Criação de perfil com a cor de fundo escolhida, nickname, nome, sobrenome e a opção de mostrar o nome no ranking',
  },
  {
    data: '2026-11-19',
    tipo: 'plataforma',
    titulo: 'Ficha do jogador e favoritos no Início',
    texto: 'Selecione o seu personagem para ver a ficha do jogador, com foto 3x4 e o seu avatar de corpo inteiro. Os jogos que você marcou com o coração ficam no card Favoritos. Prefere não ter avatar? Escolha “Sem avatar” no editor.',
  },
  {
    data: '2026-11-18',
    tipo: 'plataforma',
    titulo: 'Editor de personagem novo',
    texto: 'Visuais desenhados pela equipe Flix: dezenas de combinações de corpo e cabelo para montar o seu personagem.',
    imagem: '/novidades/editor-de-personagem.webp',
    imagemAlt: 'Editor de personagem com os visuais de cabelo e a opção Sem avatar',
  },
  { data: '2026-11-18', tipo: 'jogo', jogoId: 'g14', titulo: 'Signal Drop chegou' },
  { data: '2026-11-18', tipo: 'jogo', jogoId: 'g01', titulo: 'Flix Runner chegou' },
  {
    data: '2026-11-18',
    tipo: 'plataforma',
    titulo: 'Até 4 jogadores por conta',
    texto: 'Cada conta Flix pode ter até 4 perfis, cada um com apelido, ranking e progresso próprios.',
  },
  {
    data: '2026-11-18',
    tipo: 'plataforma',
    titulo: 'Plataforma mais rápida',
    texto: 'Animações mais leves em qualquer aparelho, e o Network Snake responde na hora a cada curva.',
  },
  { data: '2026-11-17', tipo: 'jogo', jogoId: 'g03', titulo: 'Network Snake no ar' },
];

/** Quantos dias um jogo fica no filtro "Novos" da aba Jogos, contados da data da novidade dele. */
export const DIAS_DE_NOVO = 30;

/**
 * Jogos novos: os que têm novidade do tipo 'jogo' nos últimos DIAS_DE_NOVO dias, do mais recente para o mais antigo.
 * A data de chegada do jogo é a da novidade: uma fonte só, a mesma que aparece no card Novidades do Início.
 */
export function jogosNovos<T extends { id: string }>(jogos: T[], hoje = new Date()): T[] {
  const limite = new Date(hoje.getTime() - DIAS_DE_NOVO * 86_400_000);
  const porId = new Map(jogos.map((j) => [j.id, j]));
  const vistos = new Set<string>();
  return NOVIDADES.filter((n) => n.tipo === 'jogo' && n.jogoId && new Date(`${n.data}T12:00:00`) >= limite)
    .sort((a, b) => b.data.localeCompare(a.data))
    .flatMap((n) => {
      const j = porId.get(n.jogoId!);
      if (!j || vistos.has(j.id)) return [];
      vistos.add(j.id);
      return [j];
    });
}

/** "19 de nov." a partir de AAAA-MM-DD (meio-dia, para o fuso não trocar o dia). */
export function dataDaNovidade(data: string): string {
  return new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
}
