import { useMemo, useState } from 'react';
import type { Jogo, Perfil, ResumoAvaliacao } from '../dados/tipos';
import { useAviso } from './Aviso';
import { CartaoJogo } from './CartaoJogo';
import { DetalheJogo } from './DetalheJogo';
import { Coracao, Lupa } from './Icones';
import { jogosNovos } from '../dados/novidades';

interface Props {
  jogos: Jogo[];
  perfil: Perfil;
  onJogar: (jogo: Jogo) => void;
  onFavoritar: (jogo: Jogo) => Promise<void>;
  onAvaliado?: (jogoId: string, avaliacao: ResumoAvaliacao) => void;
}

const TODOS = 'Todos';
const FAVORITOS = 'Favoritos';
const NOVOS = 'Novos';
const MAIS_JOGADOS = 'Mais jogados';

/** Texto sem acento e em minúsculas, para a pesquisa achar "Cabecada" em "Cabeçada". */
const normalizar = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/**
 * Página "Jogos": todos os jogos do hub, com pesquisa por nome e filtros (Favoritos, Todos, Novos, Mais jogados e
 * as categorias, que são os gêneros dos jogos). A pesquisa vale dentro do filtro escolhido.
 */
export function Jogos({ jogos, perfil, onJogar, onFavoritar, onAvaliado }: Props) {
  const avisar = useAviso();
  const [filtro, setFiltro] = useState(TODOS);
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState<Jogo | null>(null); // jogo aberto no botão "Ver"

  // Categorias vêm dos próprios jogos: aparece só categoria que tem jogo, com a contagem.
  const categorias = useMemo(() => {
    const conta = new Map<string, number>();
    for (const j of jogos) conta.set(j.genero, (conta.get(j.genero) ?? 0) + 1);
    return [...conta.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
  }, [jogos]);

  const favoritos = jogos.filter((j) => perfil.favoritos.includes(j.id));
  const novos = useMemo(() => jogosNovos(jogos), [jogos]);
  // Mais jogados: só quem já teve partida terminada, do mais para o menos jogado (empate: ordem do catálogo)
  const maisJogados = useMemo(() => jogos.filter((j) => (j.partidas ?? 0) > 0).sort((a, b) => (b.partidas ?? 0) - (a.partidas ?? 0)), [jogos]);
  const doFiltro = filtro === TODOS ? jogos : filtro === FAVORITOS ? favoritos : filtro === NOVOS ? novos
    : filtro === MAIS_JOGADOS ? maisJogados : jogos.filter((j) => j.genero === filtro);
  const termo = normalizar(busca);
  const lista = termo ? doFiltro.filter((j) => normalizar(j.nome).includes(termo)) : doFiltro;

  function jogar(j: Jogo) {
    if (j.pasta) onJogar(j);
    else avisar(`"${j.nome}" chega em breve`);
  }

  if (aberto) return <DetalheJogo jogo={aberto} perfil={perfil} onJogar={jogar} onFavoritar={onFavoritar} onVoltar={() => setAberto(null)} onAvaliado={onAvaliado} />;

  return (
    <section className="gx-view ativa" aria-label="Jogos">
      <div className="titulo-pagina">
        <h1>Jogos</h1>
        <p>Escolha um jogo para começar.</p>
      </div>

      {jogos.length === 0 ? (
        <p className="perfil-dica gx-vazio">Os jogos chegam em breve.</p>
      ) : (
        <>
          <label className="gx-busca">
            <Lupa />
            <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar jogos pelo nome"
              aria-label="Pesquisar jogos pelo nome" autoComplete="off" enterKeyHint="search" />
          </label>

          <div className="gx-categorias" role="tablist" aria-label="Filtros">
            {/* Favoritos vem antes de Todos; depois, Novos e Mais jogados; por fim, as categorias */}
            {[[FAVORITOS, favoritos.length] as const, [TODOS, jogos.length] as const, [NOVOS, novos.length] as const,
              [MAIS_JOGADOS, maisJogados.length] as const, ...categorias].map(([nome, n]) => (
              <button key={nome} type="button" role="tab" aria-selected={filtro === nome}
                className={'gx-categoria' + (filtro === nome ? ' ativo' : '') + (nome === FAVORITOS ? ' fav' : '')} onClick={() => setFiltro(nome)}>
                {nome === FAVORITOS && <Coracao />}{nome}<span className="gx-categoria-n">{n}</span>
              </button>
            ))}
          </div>

          {lista.length === 0 && (
            <p className="perfil-dica gx-vazio">
              {termo ? `Nenhum jogo com “${busca.trim()}” no nome${filtro === TODOS ? '' : ` em ${filtro}`}.`
                : filtro === FAVORITOS ? 'Você ainda não tem favoritos. Toque no coração abaixo de um jogo para favoritá-lo.'
                : filtro === NOVOS ? 'Nenhum jogo chegou nos últimos 30 dias.'
                : filtro === MAIS_JOGADOS ? 'Ninguém terminou uma partida ainda.'
                : 'Nenhum jogo nesta categoria.'}
            </p>
          )}
          <ul className="gx-grade-jogos">
            {lista.map((j) => (
              <CartaoJogo key={j.id} jogo={j} favorito={perfil.favoritos.includes(j.id)}
                onJogar={jogar} onVer={setAberto} onFavoritar={onFavoritar} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
