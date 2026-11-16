import type { Aparelho, Jogo, LinhaRanking, Perfil, Sessao } from './tipos';

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

  aparelhos: () => api<Aparelho[]>('GET', '/aparelhos'),
  desconectarAparelho: (id: string) => api<void>('DELETE', `/aparelhos/${encodeURIComponent(id)}`),
};
