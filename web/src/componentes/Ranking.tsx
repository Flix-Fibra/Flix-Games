import { regraDoRanking } from '../dados/formatar';
import type { Jogo, Perfil } from '../dados/tipos';
import { Mini } from './Icones';
import { Linha, Podio, SemRanking, useRanking } from './ListaRanking';

interface Props {
  jogos: Jogo[];
  perfil: Perfil;
  jogoId: string | null;
  onJogo: (id: string) => void;
}

export function Ranking({ jogos, perfil, jogoId, onJogo }: Props) {
  const comRanking = jogos.filter((j) => j.ranking);
  const jogo = comRanking.find((j) => j.id === jogoId) ?? comRanking[0];
  const { linhas, erro } = useRanking(jogo ?? { id: '', ranking: false } as Jogo, perfil.id + perfil.apelido + perfil.oculto);

  return (
    <section className="gx-view ativa" aria-label="Ranking">
      <div className="titulo-pagina">
        <h1>Ranking</h1>
        <p>Um ranking permanente para cada jogo{jogo ? ` · ${regraDoRanking(jogo).toLowerCase()}` : ''}</p>
      </div>
      {!jogo ? <p className="perfil-dica">Nenhum jogo com ranking publicado ainda.</p> : (
        <>
          <div className="gx-filtro-jogos" role="tablist" aria-label="Escolha o jogo">
            {comRanking.map((j) => (
              <button key={j.id} className="gx-filtro" role="tab" aria-selected={j.id === jogo.id} onClick={() => onJogo(j.id)}>
                <Mini jogo={j} />{j.nome}
              </button>
            ))}
          </div>
          <div className="card gx-ranking-card">
            {linhas === null ? <p className="perfil-dica">Carregando…</p>
              : linhas.length === 0 ? <SemRanking erro={erro} />
              : (
                <>
                  <Podio linhas={linhas} jogo={jogo} />
                  <ol className="gx-top">
                    {(linhas.length >= 3 ? linhas.slice(3) : linhas).map((l) => <Linha key={l.posicao + l.apelido} l={l} jogo={jogo} />)}
                  </ol>
                </>
              )}
          </div>
        </>
      )}
    </section>
  );
}
