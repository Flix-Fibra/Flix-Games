import { useMemo, useState, type CSSProperties } from 'react';
import type { Jogo, Perfil } from '../dados/tipos';
import { useAviso } from './Aviso';
import { DetalheJogo } from './DetalheJogo';
import { CapaJogo, Coracao, Play } from './Icones';

interface Props {
  jogos: Jogo[];
  perfil: Perfil;
  onJogar: (jogo: Jogo) => void;
  onFavoritar: (jogo: Jogo) => Promise<void>;
}

const TODOS = 'Todos';
const FAVORITOS = 'Favoritos';

/** Página "Jogos": todos os jogos do hub, com filtro de favoritos e por categoria (gênero do jogo). */
export function Jogos({ jogos, perfil, onJogar, onFavoritar }: Props) {
  const avisar = useAviso();
  const [filtro, setFiltro] = useState(TODOS);
  const [aberto, setAberto] = useState<Jogo | null>(null); // jogo aberto no botão "Ver"

  // Categorias vêm dos próprios jogos: aparece só categoria que tem jogo, com a contagem.
  const categorias = useMemo(() => {
    const conta = new Map<string, number>();
    for (const j of jogos) conta.set(j.genero, (conta.get(j.genero) ?? 0) + 1);
    return [...conta.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
  }, [jogos]);

  const favoritos = jogos.filter((j) => perfil.favoritos.includes(j.id));
  const lista = filtro === TODOS ? jogos : filtro === FAVORITOS ? favoritos : jogos.filter((j) => j.genero === filtro);

  function jogar(j: Jogo) {
    if (j.pasta) onJogar(j);
    else avisar(`"${j.nome}" chega em breve`);
  }

  if (aberto) return <DetalheJogo jogo={aberto} perfil={perfil} onJogar={jogar} onFavoritar={onFavoritar} onVoltar={() => setAberto(null)} />;

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
          <div className="gx-categorias" role="tablist" aria-label="Categorias">
            {/* Favoritos vem antes de Todos */}
            {[[FAVORITOS, favoritos.length] as const, [TODOS, jogos.length] as const, ...categorias].map(([nome, n]) => (
              <button key={nome} type="button" role="tab" aria-selected={filtro === nome}
                className={'gx-categoria' + (filtro === nome ? ' ativo' : '') + (nome === FAVORITOS ? ' fav' : '')} onClick={() => setFiltro(nome)}>
                {nome === FAVORITOS && <Coracao />}{nome}<span className="gx-categoria-n">{n}</span>
              </button>
            ))}
          </div>

          {filtro === FAVORITOS && favoritos.length === 0 && (
            <p className="perfil-dica gx-vazio">Você ainda não tem favoritos. No Início, escolha um jogo e toque em Favoritar.</p>
          )}
          <ul className="gx-grade-jogos">
            {lista.map((j) => (
              <li key={j.id} className="gx-cartao-jogo">
                <button type="button" data-capa={j.id} className="gx-cartao-capa" style={{ '--t1': j.cor1, '--t2': j.cor2 } as CSSProperties}
                  onClick={() => setAberto(j)} aria-label={`Ver ${j.nome}`}>
                  <CapaJogo jogo={j} />
                  {perfil.favoritos.includes(j.id) && <span className="gx-tile-fav"><Coracao /></span>}
                </button>
                <span className="gx-cartao-info">
                  <strong>{j.nome}</strong>
                  <small>{j.genero}</small>
                </span>
                <span className="gx-cartao-botoes">
                  <button type="button" className="gx-cartao-jogar" onClick={() => jogar(j)}><Play />{j.pasta ? 'Jogar' : 'Em breve'}</button>
                  <button type="button" className="gx-cartao-ver" onClick={() => setAberto(j)}>Ver</button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
