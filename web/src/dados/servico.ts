import { CORES_PERFIL, MAX_PERFIS } from './catalogo';
import type { Aparelho, Jogo, LinhaRanking, Perfil } from './tipos';

/**
 * Tudo o que a interface pede ao servidor passa por aqui.
 * Hoje: implementação SIMULADA (dados fictícios no navegador).
 * Depois: a mesma interface chamando a API FastAPI, que fala com a API do App Flix e com o CRM.
 * Por isso as funções já são assíncronas.
 */
export interface ServicoGames {
  listarPerfis(): Promise<Perfil[]>;
  criarPerfil(apelido: string): Promise<Perfil>;
  atualizarPerfil(perfil: Perfil): Promise<Perfil>;
  excluirPerfil(id: string): Promise<void>;
  ranking(jogo: Jogo, perfil: Perfil): Promise<LinhaRanking[]>;
  listarAparelhos(): Promise<Aparelho[]>;
  desconectarAparelho(id: string): Promise<void>;
}

// ---------- Simulação ----------
const CHAVE_PERFIS = 'flixgames-perfis';

const PERFIS_EXEMPLO: Perfil[] = [
  { id: 'p1', apelido: 'RafaPlayer', cor: '#D2232A', nivel: 7, partidas: 248, desde: 'nov/2026', oculto: false,
    conquistas: [true, true, true, true, false, false], favoritos: [],
    jogos: { voo: { melhor: 87, posicao: 4 }, labirinto: { melhor: 15420, posicao: 12, progresso: 35 }, soma: { melhor: 24310, posicao: 2, progresso: 60 },
      cobrinha: { melhor: 312, posicao: 9 }, blocos: { melhor: 64, posicao: 21 }, corrida: { melhor: 4380, posicao: 33 }, paciencia: { progresso: 80 } } },
  { id: 'p2', apelido: 'Ana_Gamer', cor: '#2773D2', nivel: 3, partidas: 41, desde: 'nov/2026', oculto: false,
    conquistas: [true, false, false, false, false, false], favoritos: ['memoria'],
    jogos: { voo: { melhor: 34, posicao: 18 }, memoria: { progresso: 45 }, cobrinha: { melhor: 120, posicao: 27 } } },
];

// Pontuação do 1º lugar no ranking fictício de cada jogo
const TOPO: Partial<Record<string, number>> = { voo: 108, labirinto: 26100, soma: 27300, cobrinha: 470, blocos: 150, corrida: 13400 };
const OUTROS = ['NightOwl', 'Guh_77', 'LariGamer', 'Toddy', 'Bruxinha', 'Zé Turbo', 'Neguinho_BR', 'Pixel', 'Mih', 'Kaique', 'DonaCida', 'Lobo', 'Fefe', 'Jotapê'];

let aparelhos: Aparelho[] = [
  { id: 'a1', nome: 'Este celular', detalhe: 'App Flix · Android · agora', tipo: 'cel', atual: true },
  { id: 'a2', nome: 'Notebook', detalhe: 'Chrome · Windows · ontem às 21:40', tipo: 'pc' },
  { id: 'a3', nome: 'Tablet', detalhe: 'Safari · iPadOS · há 6 dias', tipo: 'tab' },
];

function ler(): Perfil[] {
  try {
    const bruto = JSON.parse(localStorage.getItem(CHAVE_PERFIS) ?? 'null') as unknown;
    if (Array.isArray(bruto) && bruto.length > 0 && bruto.length <= MAX_PERFIS) return bruto as Perfil[];
  } catch { /* storage bloqueado ou dado inválido: usa o exemplo */ }
  return JSON.parse(JSON.stringify(PERFIS_EXEMPLO)) as Perfil[]; // cópia (structuredClone falta em celulares antigos)
}
function gravar(perfis: Perfil[]): void {
  try { localStorage.setItem(CHAVE_PERFIS, JSON.stringify(perfis)); } catch { /* sem storage: fica só na memória */ }
}
const pronto = <T,>(v: T): Promise<T> => Promise.resolve(v);

export const servicoSimulado: ServicoGames = {
  listarPerfis: () => pronto(ler()),

  async criarPerfil(apelido) {
    const perfis = ler();
    if (perfis.length >= MAX_PERFIS) throw new Error(`Limite de ${MAX_PERFIS} perfis por conta.`);
    const usadas = perfis.map((p) => p.cor);
    const novo: Perfil = {
      id: `p${Date.now()}`, apelido, cor: CORES_PERFIL.find((c) => !usadas.includes(c)) ?? CORES_PERFIL[0]!,
      nivel: 1, partidas: 0, desde: 'hoje', oculto: false, conquistas: [false, false, false, false, false, false], favoritos: [], jogos: {},
    };
    gravar([...perfis, novo]);
    return novo;
  },

  async atualizarPerfil(perfil) {
    gravar(ler().map((p) => (p.id === perfil.id ? perfil : p)));
    return perfil;
  },

  async excluirPerfil(id) {
    const perfis = ler();
    if (perfis.length < 2) throw new Error('A conta precisa de pelo menos um perfil.');
    gravar(perfis.filter((p) => p.id !== id));
  },

  async ranking(jogo, perfil) {
    if (!jogo.ranking) return [];
    const eu = perfil.jogos[jogo.id] ?? {};
    const topo = TOPO[jogo.id] ?? 100;
    const lista: LinhaRanking[] = [];
    for (let i = 1; i <= 10; i++) {
      if (i === eu.posicao) { lista.push({ posicao: i, apelido: perfil.apelido, pontos: eu.melhor ?? 0, eu: true }); continue; }
      lista.push({ posicao: i, apelido: OUTROS[(i * 3 + jogo.nome.length) % OUTROS.length]!, pontos: Math.round(topo * (1 - (i - 1) * 0.06)) });
    }
    if (eu.posicao && eu.posicao > 10) lista.push({ posicao: eu.posicao, apelido: perfil.apelido, pontos: eu.melhor ?? 0, eu: true });
    return lista;
  },

  listarAparelhos: () => pronto([...aparelhos]),

  async desconectarAparelho(id) {
    aparelhos = aparelhos.filter((a) => a.id !== id);
  },
};

export const servico: ServicoGames = servicoSimulado;
