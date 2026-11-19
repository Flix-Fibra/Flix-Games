import { useCallback, useEffect, useState } from 'react';
import { ProvedorAviso, useAviso } from './componentes/Aviso';
import { Creditos } from './componentes/Creditos';
import { Inicio } from './componentes/Inicio';
import { FundoPlasma } from './componentes/FundoPlasma';
import { Jogando } from './componentes/Jogando';
import { Lancamento } from './componentes/Lancamento';
import { Jogos } from './componentes/Jogos';
import { EditorPersonagem } from './componentes/personagem/EditorPersonagem';
import { Perfil } from './componentes/Perfil';
import { QuemVaiJogar } from './componentes/QuemVaiJogar';
import { Ranking } from './componentes/Ranking';
import { Topo } from './componentes/Topo';
import { ErroApi, servico } from './dados/servico';
import type { AlteracaoPerfil, Aba, Jogo, Perfil as TPerfil, ResumoAvaliacao, NovoPerfil } from './dados/tipos';

const ABAS: Aba[] = ['inicio', 'jogos', 'ranking', 'perfil', 'creditos'];

type Carga =
  | { estado: 'carregando' }
  | { estado: 'sem-sessao' }
  | { estado: 'erro' }
  | { estado: 'pronto'; jogos: Jogo[]; perfis: TPerfil[]; perfilId: string | null; maxPerfis: number; cores: string[] };

function Portal() {
  const avisar = useAviso();
  const [carga, setCarga] = useState<Carga>({ estado: 'carregando' });
  const [aba, setAba] = useState<Aba>('inicio');
  const [quemAberto, setQuemAberto] = useState(false);
  const [rankingJogo, setRankingJogo] = useState<string | null>(null);
  const [jogando, setJogando] = useState<Jogo | null>(null);
  const [lancando, setLancando] = useState<Jogo | null>(null); // animação de abertura do jogo
  const [editorAberto, setEditorAberto] = useState(false); // editor de personagem aberto pelo atalho do Início

  // Abertura: sessão deste aparelho + catálogo. Links diretos: #perfis abre a escolha;
  // #inicio, #ranking e #perfil abrem a aba (se já houver perfil escolhido neste aparelho).
  useEffect(() => {
    Promise.all([servico.sessao(), servico.jogos()])
      .then(([s, jogos]) => {
        const hash = window.location.hash.slice(1);
        setCarga({ estado: 'pronto', jogos, perfis: s.perfis, perfilId: s.perfilId, maxPerfis: s.maxPerfis, cores: s.cores ?? [] });
        if ((ABAS as string[]).includes(hash)) setAba(hash as Aba);
        setQuemAberto(hash === 'perfis' || !s.perfilId);
      })
      .catch((e) => setCarga({ estado: e instanceof ErroApi && e.status === 401 ? 'sem-sessao' : 'erro' }));
  }, []);

  // Troca de # sem recarregar (link direto, botão voltar do celular): segue a aba
  useEffect(() => {
    const seguir = () => {
      const h = window.location.hash.slice(1);
      if ((ABAS as string[]).includes(h)) { setAba(h as Aba); window.scrollTo(0, 0); }
      else if (h === 'perfis') setQuemAberto(true);
    };
    window.addEventListener('hashchange', seguir);
    return () => window.removeEventListener('hashchange', seguir);
  }, []);

  const irPara = useCallback((a: Aba) => {
    setAba(a);
    window.scrollTo(0, 0);
    if (window.location.hash !== '#' + a) history.pushState(null, '', '#' + a); // "voltar" do celular volta de aba
  }, []);

  if (carga.estado === 'carregando') return null;
  if (carga.estado === 'sem-sessao' || carga.estado === 'erro') {
    return (
      <section className="gx-quem" aria-live="polite">
        <img className="gx-quem-logo" src="/logo-flix-chapada.png" alt="Flix" width={218} height={84} />
        <h1>{carga.estado === 'sem-sessao' ? 'Entre pelo App Flix' : 'Não foi possível abrir o Flix Games'}</h1>
        <p className="gx-quem-sub">
          {carga.estado === 'sem-sessao' ? 'Abra o Flix Games pelo botão Games do App Flix ou do site.' : 'Verifique sua conexão e tente de novo.'}
        </p>
        <button className="btn" type="button" onClick={() => window.location.reload()}>Tentar de novo</button>
      </section>
    );
  }

  const pronto = carga; // já estreitado para 'pronto' (as funções abaixo usam esta constante)
  const { perfis, perfilId, maxPerfis, cores } = pronto;
  // Só aparecem no hub os jogos que abrem de verdade: com pasta entregue e que não sejam o jogo de teste do hub.
  const jogos = pronto.jogos.filter(jogoNoHub);
  const perfil = perfis.find((p) => p.id === perfilId) ?? null;
  // Jogar: o jogo abre NA HORA (carregando por baixo) e a capa voa até ele (Lancamento). Clique repetido é ignorado.
  const abrirJogo = (j: Jogo) => { if (!lancando && !jogando) { setJogando(j); setLancando(j); } };
  const trocarPerfil = (p: TPerfil) => setCarga({ ...pronto, perfis: perfis.map((x) => (x.id === p.id ? p : x)) });

  async function entrar(id: string) {
    await servico.escolherPerfil(id);
    setCarga({ ...pronto, perfilId: id });
    setQuemAberto(false);
    irPara('inicio');
    const p = perfis.find((x) => x.id === id);
    if (p) avisar(`Olá, ${p.apelido}!`);
  }

  async function criar(dados: NovoPerfil) {
    const novo = await servico.criarPerfil(dados);
    await servico.escolherPerfil(novo.id);
    setCarga({ ...pronto, perfis: [...perfis, novo], perfilId: novo.id });
    setQuemAberto(false);
    irPara('inicio');
    avisar(`Olá, ${novo.apelido}!`);
  }

  // Gerenciar perfis: edita qualquer perfil da conta (não só o que está jogando)
  async function editarPerfil(id: string, dados: AlteracaoPerfil) {
    const p = await servico.alterarPerfil(id, dados);
    setCarga((c) => (c.estado !== 'pronto' ? c : { ...c, perfis: c.perfis.map((x) => (x.id === p.id ? p : x)) }));
    avisar(`Perfil ${p.apelido} salvo`);
  }

  async function excluir(id: string) {
    const nome = perfis.find((p) => p.id === id)?.apelido ?? '';
    await servico.excluirPerfil(id);
    setCarga({ ...pronto, perfis: perfis.filter((p) => p.id !== id), perfilId: perfilId === id ? null : perfilId });
    avisar(`Perfil ${nome} excluído`);
  }

  async function favoritar(j: Jogo) {
    if (!perfil) return;
    const sim = !perfil.favoritos.includes(j.id);
    await servico.favoritar(perfil.id, j.id, sim);
    trocarPerfil({ ...perfil, favoritos: sim ? [...perfil.favoritos, j.id] : perfil.favoritos.filter((f) => f !== j.id) });
  }

  // Nova nota dada na página do jogo: atualiza a média no catálogo em memória (cartões com estrelas)
  function avaliado(jogoId: string, r: ResumoAvaliacao) {
    setCarga((c) => c.estado !== 'pronto' ? c : {
      ...c, jogos: c.jogos.map((j) => (j.id === jogoId ? { ...j, avaliacao: { media: r.media, total: r.total } } : j)),
    });
  }

  async function salvar(dados: AlteracaoPerfil) {
    if (!perfil) return;
    trocarPerfil(await servico.alterarPerfil(perfil.id, dados));
  }

  // Fechou o jogo: se houve partida, busca o perfil de novo (recorde, posição, conquistas)
  async function fecharJogo(houvePartida: boolean) {
    setJogando(null);
    if (!houvePartida) return;
    try {
      const s = await servico.sessao();
      setCarga({ ...pronto, perfis: s.perfis });
    } catch { /* mantém o que estava na tela */ }
  }

  async function sair() {
    await servico.sairDesteAparelho();
    window.location.reload(); // sem sessão: mostra "Entre pelo App Flix"
  }

  return (
    <>
      <FundoPlasma pausado={!!jogando} />
      {perfil && (
        <>
          <Topo aba={aba} perfil={perfil} onAba={irPara} onTrocarPerfil={() => setQuemAberto(true)} />
          <main>
            {aba === 'inicio' && (
              <Inicio jogos={jogos} perfil={perfil} onFavoritar={favoritar} onCriarPersonagem={() => setEditorAberto(true)}
                onVerRanking={(j) => { setRankingJogo(j.id); irPara('ranking'); }} onJogar={abrirJogo} onAvaliado={avaliado}
                onExplorar={() => irPara('jogos')} />
            )}
            {aba === 'jogos' && <Jogos jogos={jogos} perfil={perfil} onJogar={abrirJogo} onFavoritar={favoritar} onAvaliado={avaliado} />}
            {aba === 'ranking' && (jogos.some((j) => j.ranking)
              ? <Ranking jogos={jogos} perfil={perfil} jogoId={rankingJogo} onJogo={setRankingJogo} />
              : <p className="perfil-dica gx-vazio">O ranking aparece quando os jogos chegarem.</p>)}
            {aba === 'creditos' && <Creditos />}
            {aba === 'perfil' && (
              <Perfil jogos={jogos} perfil={perfil} perfis={perfis} onSalvar={salvar}
                onTrocarPerfil={() => setQuemAberto(true)} onSair={sair} onAtualizado={trocarPerfil} />
            )}
          </main>
          <p className="gx-aviso-prototipo">
            <a href="#creditos">Créditos e Licenças</a> {import.meta.env.DEV && ' · desenvolvimento: conta de teste e dados fictícios'}
          </p>
        </>
      )}
      {editorAberto && perfil && <EditorPersonagem perfil={perfil} onSalvo={trocarPerfil} onFechar={() => setEditorAberto(false)} />}
      {jogando && perfil && <Jogando entrando={!!lancando} jogo={jogando} avatar={perfil.avatar} onFechar={fecharJogo} />}
      {lancando && <Lancamento jogo={lancando} onFim={() => setLancando(null)} />}
      {(quemAberto || !perfil) && (
        <QuemVaiJogar perfis={perfis} maxPerfis={maxPerfis} cores={cores} atualId={perfilId} onEntrar={entrar} onCriar={criar} onEditar={editarPerfil} onExcluir={excluir} />
      )}
    </>
  );
}

/** O jogo aparece no hub só se abre de verdade: pasta entregue e que não seja o jogo de teste do hub. */
function jogoNoHub(j: Jogo): boolean {
  return !!j.pasta && j.pasta !== '_teste-hub';
}

export function App() {
  return (
    <ProvedorAviso>
      <Portal />
    </ProvedorAviso>
  );
}
