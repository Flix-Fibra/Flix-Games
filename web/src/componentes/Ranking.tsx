import { useEffect, useState } from 'react';
import { formatarNumero, formatarPontos, formatarPontosFlix, nomeDaTemporada, regraDoRanking } from '../dados/formatar';
import { servico } from '../dados/servico';
import type { Jogo, LinhaRanking, LinhaRankingGeral, Perfil, RankingGeral } from '../dados/tipos';
import { useBusca } from '../dados/useBusca';
import { AlturaSuave } from './AlturaSuave';
import { Mini } from './Icones';
import { chaveDoRanking, ConteudoLinha, Linha, Podio, SemRanking, useTemporadas } from './ListaRanking';
import { SeletorJogo } from './SeletorJogo';

interface Props {
  jogos: Jogo[];
  perfil: Perfil;
  /** `null` = ranking geral; um id = ranking daquele jogo. */
  jogoId: string | null;
  onJogo: (id: string | null) => void;
}

/** O que o cartão mostra: as linhas de um jogo ou o ranking geral de uma temporada. */
type Visao = LinhaRanking[] | RankingGeral;
const chaveDoGeral = (temporada: string | null, versao: string) => `geral|${temporada ?? ''}|${versao}`;

/**
 * Página Ranking, em dois modos:
 * - Geral: soma dos Pontos Flix de todos os jogos, por temporada (mês). Ver a regra em api/app/consultas.py.
 * - Por jogo: o recorde de todos os tempos de cada jogo, na unidade dele, ou só as partidas de um mês.
 * O jogo é escolhido num seletor único (não numa fileira de etiquetas), que não cresce com o catálogo.
 * A temporada escolhida vale para os dois modos: vendo outubro no Geral e trocando para o Por jogo, continua outubro,
 * e a posição do detalhe do Geral ("1º de 7") é a mesma do ranking do jogo naquele mês. `null` = o padrão de cada
 * modo (mês atual no Geral, todos os tempos no Por jogo).
 *
 * Troca de filtro sem solavanco: o cartão é um só nos dois modos; enquanto o resultado novo não chega, o anterior
 * continua à vista, esmaecido; quando chega, entra com um esmaecimento curto e a altura do cartão desliza até a nova.
 */
export function Ranking({ jogos, perfil, jogoId, onJogo }: Props) {
  const comRanking = jogos.filter((j) => j.ranking);
  const jogo = jogoId ? comRanking.find((j) => j.id === jogoId) ?? comRanking[0] ?? null : null;
  const versao = `${perfil.id}|${perfil.apelido}|${perfil.oculto}|${perfil.partidas}`;
  // Ao voltar do Geral para o Por jogo, reabre o último jogo escolhido (não o primeiro da lista)
  const [ultimoJogo, setUltimoJogo] = useState(jogoId);
  useEffect(() => { if (jogoId) setUltimoJogo(jogoId); }, [jogoId]);
  const [temporada, setTemporada] = useState<string | null>(null);
  const lista = useTemporadas();

  const chave = comRanking.length === 0 ? null : jogo ? chaveDoRanking(jogo.id, temporada, versao) : chaveDoGeral(temporada, versao);
  const busca = useBusca<Visao>(chave, () => (jogo
    ? servico.ranking(jogo.id, temporada ?? undefined)
    : servico.rankingGeral(temporada ?? undefined)));

  // Detalhe aberto no Geral: vale só para o resultado em que foi aberto (trocar o filtro fecha)
  const [aberto, setAberto] = useState<{ chave: string; apelido: string } | null>(null);

  if (comRanking.length === 0) {
    return (
      <section className="gx-view ativa" aria-label="Ranking">
        <div className="titulo-pagina"><h1>Ranking</h1></div>
        <p className="perfil-dica">Nenhum jogo com ranking publicado ainda.</p>
      </section>
    );
  }

  const exibida = busca.chaveDosUltimos;
  const visao = busca.ultimos;
  // De qual jogo e temporada é o conteúdo à vista (pode ser o anterior, enquanto o novo carrega)
  const [, idExibido, temporadaExibida] = exibida?.split('|') ?? [];
  const jogoExibido = exibida?.startsWith('ranking|') ? comRanking.find((j) => j.id === idExibido) ?? null : null;
  const apelidoAberto = aberto && aberto.chave === exibida ? aberto.apelido : null;

  return (
    <section className="gx-view ativa" aria-label="Ranking">
      <div className="titulo-pagina">
        <h1>Ranking</h1>
        <p>{!jogo ? 'Pontos Flix somados em todos os jogos, por temporada'
          : `${temporada ? nomeDaTemporada(temporada) : 'Recorde de todos os tempos'} · ${regraDoRanking(jogo).toLowerCase()}`}</p>
      </div>

      <div className="gx-ranking-barra">
        <div className="gx-segmentos" role="tablist" aria-label="Tipo de ranking">
          <button type="button" role="tab" aria-selected={!jogo} onClick={() => onJogo(null)}>Geral</button>
          <button type="button" role="tab" aria-selected={!!jogo} onClick={() => onJogo(jogo?.id ?? ultimoJogo ?? comRanking[0]!.id)}>Por jogo</button>
        </div>
        {jogo && <SeletorJogo jogos={comRanking} atual={jogo} onEscolher={(j) => onJogo(j.id)} />}
      </div>

      {lista && (
        <label className="gx-temporada">
          <span>Temporada</span>
          <select value={temporada ?? (jogo ? '' : lista.atual)} onChange={(e) => setTemporada(e.target.value || null)}>
            {jogo && <option value="">Todos os tempos</option>}
            {lista.temporadas.map((t) => <option key={t} value={t}>{nomeDaTemporada(t)}{t === lista.atual ? ' (atual)' : ''}</option>)}
          </select>
        </label>
      )}

      <div className="card gx-ranking-card" aria-busy={busca.carregando}>
        <AlturaSuave>
          <div className={'gx-ranking-estado' + (busca.carregando && visao ? ' carregando' : '')}>
            {busca.erro ? <SemRanking erro />
              : !visao ? <p className="perfil-dica gx-ranking-espera">Carregando…</p>
              : (
                // A `key` é o resultado à vista: quando ele troca, o conteúdo novo entra com esmaecimento
                <div key={exibida} className="gx-ranking-conteudo">
                  {Array.isArray(visao)
                    ? jogoExibido && <ConteudoDoJogo jogo={jogoExibido} linhas={visao} temporada={temporadaExibida || null} atual={lista?.atual} />
                    : <ConteudoGeral dados={visao} jogos={comRanking} aberto={apelidoAberto}
                        onAbrir={(l) => setAberto(apelidoAberto === l.apelido ? null : { chave: exibida!, apelido: l.apelido })} />}
                </div>
              )}
          </div>
        </AlturaSuave>
      </div>

      {!jogo && (
        <p className="gx-ranking-regra">
          <strong>Como funciona:</strong> em cada jogo, sua melhor partida do mês vale até 1.000 Pontos Flix, conforme a
          parcela de jogadores que você superou; quanto mais gente no jogo, mais vale ficar na frente. O ranking geral soma
          todos os jogos e recomeça no dia 1 de cada mês. Toque num jogador para ver os pontos de cada jogo.
        </p>
      )}
    </section>
  );
}

function ConteudoDoJogo({ jogo, linhas, temporada, atual }: { jogo: Jogo; linhas: LinhaRanking[]; temporada: string | null; atual?: string }) {
  if (linhas.length === 0) {
    const texto = !temporada ? undefined
      : temporada === atual ? 'Ninguém pontuou neste jogo nesta temporada ainda. Seja o primeiro!'
      : `Ninguém pontuou neste jogo em ${nomeDaTemporada(temporada).toLowerCase()}.`;
    return <SemRanking erro={false} texto={texto} />;
  }
  return (
    <>
      <Podio linhas={linhas} valor={(l) => formatarNumero(l.pontos, jogo.unidade)} />
      <ol className="gx-top">
        {(linhas.length >= 3 ? linhas.slice(3) : linhas).map((l) => <Linha key={l.posicao + l.apelido} l={l} jogo={jogo} />)}
      </ol>
    </>
  );
}

interface GeralProps {
  dados: RankingGeral;
  jogos: Jogo[];
  aberto: string | null; // nickname do jogador com o detalhe aberto
  onAbrir: (l: LinhaRankingGeral) => void;
}

function ConteudoGeral({ dados, jogos, aberto, onAbrir }: GeralProps) {
  const { linhas } = dados;
  if (linhas.length === 0) {
    return <SemRanking erro={false} texto={dados.temporada === dados.atual
      ? 'Ninguém pontuou nesta temporada ainda. Jogue qualquer jogo para entrar no ranking geral!'
      : 'Ninguém pontuou nesta temporada.'} />;
  }
  const noPodio = linhas.length >= 3 ? linhas.slice(0, 3) : [];
  const abertoNoPodio = noPodio.find((l) => l.apelido === aberto);
  const total = (l: LinhaRankingGeral) => `${formatarPontosFlix(l.pontos)} pts`;
  return (
    <>
      {noPodio.length > 0 && <Podio linhas={noPodio} valor={total} aberto={aberto} onAbrir={onAbrir} />}
      {abertoNoPodio && <PontosPorJogo l={abertoNoPodio} jogos={jogos} />}
      <ol className="gx-top">
        {(noPodio.length ? linhas.slice(3) : linhas).map((l) => (
          <li key={l.posicao + l.apelido} className={'gx-linha gx-linha-geral' + (l.eu ? ' eu' : '')}>
            <button type="button" className="gx-linha-botao" aria-expanded={aberto === l.apelido} onClick={() => onAbrir(l)}>
              <ConteudoLinha l={l} valor={formatarPontosFlix(l.pontos)} unidade="Pontos Flix" />
              <svg className="gx-linha-seta" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
            </button>
            {aberto === l.apelido && <PontosPorJogo l={l} jogos={jogos} />}
          </li>
        ))}
      </ol>
    </>
  );
}

/** Detalhe de um jogador no geral: de onde veio cada parte do total. */
function PontosPorJogo({ l, jogos }: { l: LinhaRankingGeral; jogos: Jogo[] }) {
  const porId = new Map(jogos.map((j) => [j.id, j]));
  return (
    <ul className="gx-pontos-jogos" aria-label={`Pontos Flix de ${l.apelido} por jogo`}>
      {l.jogos.map((pj) => {
        const j = porId.get(pj.jogoId);
        if (!j) return null;
        return (
          <li key={pj.jogoId}>
            <Mini jogo={j} />
            <span className="gx-pontos-jogo-texto">
              <strong>{j.nome}</strong>
              <small>{pj.posicao}º de {pj.jogadores} · {formatarPontos(pj.melhor, j.unidade)}</small>
            </span>
            <span className="gx-pontos-jogo-valor">{formatarPontosFlix(pj.pontos)}</span>
          </li>
        );
      })}
    </ul>
  );
}
