import { useCallback, useEffect, useState } from 'react';
import { ProvedorAviso, useAviso } from './componentes/Aviso';
import { Creditos } from './componentes/Creditos';
import { Inicio } from './componentes/Inicio';
import { Jogando } from './componentes/Jogando';
import { Perfil } from './componentes/Perfil';
import { QuemVaiJogar } from './componentes/QuemVaiJogar';
import { Ranking } from './componentes/Ranking';
import { Topo } from './componentes/Topo';
import { ErroApi, servico } from './dados/servico';
import type { Aba, Jogo, Perfil as TPerfil } from './dados/tipos';

const ABAS: Aba[] = ['inicio', 'ranking', 'perfil', 'creditos'];

type Carga =
  | { estado: 'carregando' }
  | { estado: 'sem-sessao' }
  | { estado: 'erro' }
  | { estado: 'pronto'; jogos: Jogo[]; perfis: TPerfil[]; perfilId: string | null; maxPerfis: number };

function Portal() {
  const avisar = useAviso();
  const [carga, setCarga] = useState<Carga>({ estado: 'carregando' });
  const [aba, setAba] = useState<Aba>('inicio');
  const [quemAberto, setQuemAberto] = useState(false);
  const [rankingJogo, setRankingJogo] = useState<string | null>(null);
  const [jogando, setJogando] = useState<Jogo | null>(null);

  // Abertura: sessão deste aparelho + catálogo. Links diretos: #perfis abre a escolha;
  // #inicio, #ranking e #perfil abrem a aba (se já houver perfil escolhido neste aparelho).
  useEffect(() => {
    Promise.all([servico.sessao(), servico.jogos()])
      .then(([s, jogos]) => {
        const hash = window.location.hash.slice(1);
        setCarga({ estado: 'pronto', jogos, perfis: s.perfis, perfilId: s.perfilId, maxPerfis: s.maxPerfis });
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
  const { jogos, perfis, perfilId, maxPerfis } = pronto;
  const perfil = perfis.find((p) => p.id === perfilId) ?? null;
  const trocarPerfil = (p: TPerfil) => setCarga({ ...pronto, perfis: perfis.map((x) => (x.id === p.id ? p : x)) });

  async function entrar(id: string) {
    await servico.escolherPerfil(id);
    setCarga({ ...pronto, perfilId: id });
    setQuemAberto(false);
    irPara('inicio');
    const p = perfis.find((x) => x.id === id);
    if (p) avisar(`Olá, ${p.apelido}!`);
  }

  async function criar(apelido: string) {
    const novo = await servico.criarPerfil(apelido);
    await servico.escolherPerfil(novo.id);
    setCarga({ ...pronto, perfis: [...perfis, novo], perfilId: novo.id });
    setQuemAberto(false);
    irPara('inicio');
    avisar(`Olá, ${novo.apelido}!`);
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

  async function salvar(dados: { apelido?: string; oculto?: boolean }) {
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
      <div className="gx-fundo" aria-hidden="true" />
      {perfil && (
        <>
          <Topo aba={aba} perfil={perfil} onAba={irPara} onTrocarPerfil={() => setQuemAberto(true)} />
          <main>
            {jogos.length === 0 ? <p className="perfil-dica">Nenhum jogo publicado ainda.</p> : (
              <>
                {aba === 'inicio' && (
                  <Inicio jogos={jogos} perfil={perfil} onFavoritar={favoritar}
                    onVerRanking={(j) => { setRankingJogo(j.id); irPara('ranking'); }} onJogar={setJogando} />
                )}
                {aba === 'ranking' && <Ranking jogos={jogos} perfil={perfil} jogoId={rankingJogo} onJogo={setRankingJogo} />}
                {aba === 'creditos' && <Creditos />}
                {aba === 'perfil' && (
                  <Perfil jogos={jogos} perfil={perfil} perfis={perfis} onSalvar={salvar}
                    onTrocarPerfil={() => setQuemAberto(true)} onSair={sair} onAtualizado={trocarPerfil} />
                )}
              </>
            )}
          </main>
          <p className="gx-aviso-prototipo">
            <a href="#creditos">Créditos e Licenças</a> · código-fonte sob GPL-3.0{import.meta.env.DEV && ' · desenvolvimento: conta de teste e dados fictícios'}
          </p>
        </>
      )}
      {jogando && perfil && <Jogando jogo={jogando} avatar={perfil.avatar} onFechar={fecharJogo} />}
      {(quemAberto || !perfil) && (
        <QuemVaiJogar perfis={perfis} maxPerfis={maxPerfis} atualId={perfilId} onEntrar={entrar} onCriar={criar} onExcluir={excluir} />
      )}
    </>
  );
}

export function App() {
  return (
    <ProvedorAviso>
      <Portal />
    </ProvedorAviso>
  );
}
