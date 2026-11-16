import { useCallback, useEffect, useState } from 'react';
import { ProvedorAviso, useAviso } from './componentes/Aviso';
import { Inicio } from './componentes/Inicio';
import { Perfil } from './componentes/Perfil';
import { QuemVaiJogar } from './componentes/QuemVaiJogar';
import { Ranking } from './componentes/Ranking';
import { Topo } from './componentes/Topo';
import { servico } from './dados/servico';
import type { Aba, JogoId, Perfil as TPerfil } from './dados/tipos';

const ABAS: Aba[] = ['inicio', 'ranking', 'perfil'];
const CHAVE_PERFIL_APARELHO = 'flixgames-perfil'; // perfil escolhido NESTE aparelho (Q09: uma pessoa por aparelho)

function lerHash(): string { return window.location.hash.slice(1); }
function perfilDoAparelho(): string | null {
  try { return localStorage.getItem(CHAVE_PERFIL_APARELHO); } catch { return null; }
}
function lembrarPerfil(id: string | null): void {
  try { if (id) localStorage.setItem(CHAVE_PERFIL_APARELHO, id); else localStorage.removeItem(CHAVE_PERFIL_APARELHO); } catch { /* sem storage */ }
}

function Portal() {
  const avisar = useAviso();
  const [perfis, setPerfis] = useState<TPerfil[] | null>(null);
  const [atualId, setAtualId] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>('inicio');
  const [quemAberto, setQuemAberto] = useState(false);
  const [rankingJogo, setRankingJogo] = useState<JogoId>('voo');

  // Abertura: carrega perfis e decide se pergunta "Quem vai jogar?".
  // Links diretos: #perfis abre a escolha; #inicio, #ranking e #perfil entram no perfil salvo (ou no 1º).
  useEffect(() => {
    servico.listarPerfis().then((lista) => {
      const hash = lerHash();
      const salvo = lista.find((p) => p.id === perfilDoAparelho())?.id ?? null;
      const direto = (ABAS as string[]).includes(hash);
      setPerfis(lista);
      setAtualId(salvo ?? (direto ? lista[0]!.id : null));
      if (direto) setAba(hash as Aba);
      setQuemAberto(hash === 'perfis' || (!salvo && !direto));
    }).catch(() => setPerfis([]));
  }, []);

  const irPara = useCallback((a: Aba) => {
    setAba(a);
    window.scrollTo(0, 0);
    history.replaceState(null, '', '#' + a);
  }, []);

  const perfil = perfis?.find((p) => p.id === atualId) ?? null;

  async function salvarPerfil(p: TPerfil) {
    await servico.atualizarPerfil(p);
    setPerfis((lista) => lista?.map((x) => (x.id === p.id ? p : x)) ?? lista);
  }

  function entrar(id: string) {
    setAtualId(id);
    lembrarPerfil(id);
    setQuemAberto(false);
    irPara('inicio');
    const p = perfis?.find((x) => x.id === id);
    if (p) avisar(`Olá, ${p.apelido}!`);
  }

  async function criar(apelido: string) {
    const novo = await servico.criarPerfil(apelido);
    setPerfis((lista) => [...(lista ?? []), novo]);
    setAtualId(novo.id);
    lembrarPerfil(novo.id);
    setQuemAberto(false);
    irPara('inicio');
    avisar(`Olá, ${novo.apelido}!`);
  }

  async function excluir(id: string) {
    const nome = perfis?.find((p) => p.id === id)?.apelido ?? '';
    await servico.excluirPerfil(id);
    setPerfis((lista) => lista?.filter((p) => p.id !== id) ?? lista);
    if (atualId === id) { setAtualId(null); lembrarPerfil(null); }
    avisar(`Perfil ${nome} excluído`);
  }

  if (perfis === null) return null; // carregando (instantâneo na simulação)
  if (!perfis.length) return <p className="gx-aviso-prototipo">Não foi possível carregar os perfis. Tente de novo.</p>;

  return (
    <>
      <div className="gx-fundo" aria-hidden="true" />
      {perfil && (
        <>
          <Topo aba={aba} perfil={perfil} onAba={irPara} onTrocarPerfil={() => setQuemAberto(true)} />
          <main>
            {aba === 'inicio' && (
              <Inicio
                perfil={perfil}
                onFavoritar={(j) => {
                  const favs = perfil.favoritos.includes(j.id) ? perfil.favoritos.filter((f) => f !== j.id) : [...perfil.favoritos, j.id];
                  void salvarPerfil({ ...perfil, favoritos: favs });
                }}
                onVerRanking={(j) => { setRankingJogo(j.id); irPara('ranking'); }}
              />
            )}
            {aba === 'ranking' && <Ranking perfil={perfil} jogoId={rankingJogo} onJogo={setRankingJogo} />}
            {aba === 'perfil' && <Perfil perfil={perfil} perfis={perfis} onSalvar={salvarPerfil} onTrocarPerfil={() => setQuemAberto(true)} />}
          </main>
          <p className="gx-aviso-prototipo">Protótipo · jogos e números são exemplos</p>
        </>
      )}
      {(quemAberto || !perfil) && (
        <QuemVaiJogar perfis={perfis} atualId={atualId} onEntrar={entrar} onCriar={criar} onExcluir={excluir} />
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
