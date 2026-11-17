import type { PersonagemLpc } from '../lpc/motor';
import type { Aparelho, AvatarConfig, CatalogoAvatar, Comentario, DetalhesJogo, Jogo, LinhaRanking, Perfil, ResultadoPartida, ResumoAvaliacao, Sessao } from './tipos';

/** Erro da API com a mensagem já pronta para mostrar ao cliente. */
export class ErroApi extends Error {
  constructor(public status: number, mensagem: string) {
    super(mensagem);
  }
}

async function api<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  const alteracao = metodo !== 'GET';
  const r = await fetch('/api' + caminho, {
    method: metodo,
    credentials: 'same-origin',
    headers: {
      ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
      // A API recusa alterações sem este cabeçalho (proteção contra outro site agir pelo cliente)
      ...(alteracao ? { 'X-Flix-Games': '1' } : {}),
    },
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  });
  if (r.ok) return (r.status === 204 ? undefined : await r.json()) as T;
  let msg = 'Não foi possível completar. Tente de novo.';
  try {
    const d = (await r.json()) as { detail?: unknown };
    if (typeof d.detail === 'string') msg = d.detail;
    // Erro de validação do FastAPI (422): lista; usa a primeira mensagem
    else if (Array.isArray(d.detail) && typeof d.detail[0]?.msg === 'string') msg = d.detail[0].msg.replace(/^Value error, /, '');
  } catch { /* resposta sem JSON */ }
  throw new ErroApi(r.status, msg);
}

/** Tudo o que a interface pede ao servidor passa por aqui. */
export const servico = {
  /**
   * Sessão deste aparelho. Em desenvolvimento, sem sessão, entra pela conta de teste
   * (login simulado da API). Em produção o cliente chega pelo App Flix (API do sistema dele, Q02).
   */
  async sessao(): Promise<Sessao> {
    try {
      return await api<Sessao>('GET', '/sessao');
    } catch (e) {
      if (import.meta.env.DEV && e instanceof ErroApi && e.status === 401) {
        await api<void>('POST', '/dev/entrar', {});
        return api<Sessao>('GET', '/sessao');
      }
      throw e;
    }
  },
  escolherPerfil: (perfilId: string) => api<void>('PUT', '/sessao/perfil', { perfilId }),
  sairDesteAparelho: () => api<void>('DELETE', '/sessao'),

  jogos: () => api<Jogo[]>('GET', '/jogos'),
  ranking: (jogoId: string) => api<LinhaRanking[]>('GET', `/ranking/${encodeURIComponent(jogoId)}`),

  criarPerfil: (apelido: string) => api<Perfil>('POST', '/perfis', { apelido }),
  alterarPerfil: (id: string, dados: { apelido?: string; oculto?: boolean }) => api<Perfil>('PATCH', `/perfis/${encodeURIComponent(id)}`, dados),
  excluirPerfil: (id: string) => api<void>('DELETE', `/perfis/${encodeURIComponent(id)}`),
  favoritar: (perfilId: string, jogoId: string, sim: boolean) =>
    api<void>(sim ? 'PUT' : 'DELETE', `/perfis/${encodeURIComponent(perfilId)}/favoritos/${encodeURIComponent(jogoId)}`),

  // Partidas: o JOGO avisa o hub por postMessage; o HUB chama estas rotas (contrato, seção 6)
  iniciarPartida: (jogoId: string, runId: string) => api<{ runId: string }>('POST', '/partidas/inicio', { jogoId, runId }),
  finalizarPartida: (runId: string, pontos: number, duracaoMs: number) =>
    api<ResultadoPartida>('POST', '/partidas/fim', { runId, pontos, duracaoMs }),

  catalogoAvatar: () => api<CatalogoAvatar>('GET', '/avatar/catalogo'),
  salvarPersonagem: (perfilId: string, personagem: PersonagemLpc) =>
    api<Perfil>('PUT', `/perfis/${encodeURIComponent(perfilId)}/personagem`, personagem),
  salvarAvatar: (perfilId: string, avatar: AvatarConfig) => api<Perfil>('PUT', `/perfis/${encodeURIComponent(perfilId)}/avatar`, avatar),

  // Página do jogo: o perfil vem da sessão (a API nunca aceita o perfil do cliente)
  detalhesJogo: (jogoId: string) => api<DetalhesJogo>('GET', `/jogos/${encodeURIComponent(jogoId)}/detalhes`),
  avaliar: (jogoId: string, nota: number) => api<ResumoAvaliacao>('PUT', `/jogos/${encodeURIComponent(jogoId)}/avaliacao`, { nota }),
  comentar: (jogoId: string, texto: string) => api<Comentario>('POST', `/jogos/${encodeURIComponent(jogoId)}/comentarios`, { texto }),
  apagarComentario: (id: string) => api<void>('DELETE', `/comentarios/${encodeURIComponent(id)}`),
  denunciarComentario: (id: string) => api<void>('POST', `/comentarios/${encodeURIComponent(id)}/denuncia`),

  aparelhos: () => api<Aparelho[]>('GET', '/aparelhos'),
  desconectarAparelho: (id: string) => api<void>('DELETE', `/aparelhos/${encodeURIComponent(id)}`),
};
