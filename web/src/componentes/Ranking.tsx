import { JOGOS } from '../dados/catalogo';
import type { Jogo, JogoId, Perfil } from '../dados/tipos';
import { Mini } from './Icones';
import { Linha, Podio, useRanking } from './ListaRanking';

const COM_RANKING = JOGOS.filter((j) => j.ranking);

interface Props {
  perfil: Perfil;
  jogoId: JogoId;
  onJogo: (id: JogoId) => void;
}

export function Ranking({ perfil, jogoId, onJogo }: Props) {
  const jogo: Jogo = COM_RANKING.find((j) => j.id === jogoId) ?? COM_RANKING[0]!;
  const linhas = useRanking(jogo, perfil);

  return (
    <section className="gx-view ativa" aria-label="Ranking">
      <div className="titulo-pagina">
        <h1>Ranking</h1>
        <p>Um ranking permanente para cada jogo · vale a maior pontuação</p>
      </div>
      <div className="gx-filtro-jogos" role="tablist" aria-label="Escolha o jogo">
        {COM_RANKING.map((j) => (
          <button key={j.id} className="gx-filtro" role="tab" aria-selected={j.id === jogo.id} onClick={() => onJogo(j.id)}>
            <Mini jogo={j} />{j.nome}
          </button>
        ))}
      </div>
      <div className="card gx-ranking-card">
        {linhas === null ? <p className="perfil-dica">Carregando…</p> : (
          <>
            <Podio linhas={linhas} />
            <ol className="gx-top">
              {linhas.slice(3).map((l) => <Linha key={l.posicao} l={l} unidade={jogo.unidade} cor={perfil.cor} />)}
            </ol>
          </>
        )}
      </div>
    </section>
  );
}
