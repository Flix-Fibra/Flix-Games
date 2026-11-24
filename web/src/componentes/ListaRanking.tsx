import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { iniciais } from '../dados/apelido';
import { formatarNumero, rotuloUnidade } from '../dados/formatar';
import { servico } from '../dados/servico';
import type { Jogo, LinhaRanking, RankingGeral, Temporadas } from '../dados/tipos';

/**
 * Busca o ranking de um jogo na API. `versao` muda quando o perfil muda (força nova busca). `temporada` ("AAAA-MM")
 * restringe ao mês; sem ela, recorde de todos os tempos.
 */
export function useRanking(jogo: Jogo, versao: string, temporada?: string | null): { linhas: LinhaRanking[] | null; erro: boolean } {
  const [linhas, setLinhas] = useState<LinhaRanking[] | null>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    let ativo = true; // ignora resposta atrasada se o jogo mudou no meio
    setLinhas(null);
    setErro(false);
    if (!jogo.ranking) { setLinhas([]); return; }
    servico.ranking(jogo.id, temporada ?? undefined)
      .then((l) => { if (ativo) setLinhas(l); })
      .catch(() => { if (ativo) { setLinhas([]); setErro(true); } });
    return () => { ativo = false; };
  }, [jogo.id, jogo.ranking, versao, temporada]);
  return { linhas, erro };
}

/** Busca o ranking geral de uma temporada (`null` = a atual). */
export function useRankingGeral(temporada: string | null, versao: string): { dados: RankingGeral | null; erro: boolean } {
  const [dados, setDados] = useState<RankingGeral | null>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    let ativo = true;
    setDados(null);
    setErro(false);
    servico.rankingGeral(temporada ?? undefined)
      .then((d) => { if (ativo) setDados(d); })
      .catch(() => { if (ativo) setErro(true); });
    return () => { ativo = false; };
  }, [temporada, versao]);
  return { dados, erro };
}

/** Temporadas oferecidas na página Ranking (busca uma vez por visita à página). */
export function useTemporadas(): Temporadas | null {
  const [dados, setDados] = useState<Temporadas | null>(null);
  useEffect(() => {
    let ativo = true;
    servico.temporadas().then((t) => { if (ativo) setDados(t); }).catch(() => undefined); // sem lista, o seletor só não aparece
    return () => { ativo = false; };
  }, []);
  return dados;
}

/** Miolo de uma linha (posição, avatar, nickname e nome, valor). Igual no ranking de cada jogo e no geral. */
export function ConteudoLinha({ l, valor, unidade }: { l: LinhaRanking; valor: string; unidade: string }) {
  const p = l.posicao <= 3 ? ' p' + l.posicao : '';
  return (
    <>
      <span className={'gx-pos' + p}>{l.posicao}º</span>
      <span className="gx-mini-av" style={l.eu ? { background: l.cor, color: '#fff' } : undefined}>{iniciais(l.apelido)}</span>
      <span className="gx-apelido"><strong>{l.apelido}{l.eu ? ' (você)' : ''}</strong>{l.nome && <small>{l.nome}</small>}</span>
      <span className="gx-pontos">{valor} <small>{unidade}</small></span>
    </>
  );
}

export function Linha({ l, jogo }: { l: LinhaRanking; jogo: Jogo }) {
  return (
    <li className={'gx-linha' + (l.eu ? ' eu' : '')}>
      <ConteudoLinha l={l} valor={formatarNumero(l.pontos, jogo.unidade)} unidade={rotuloUnidade(jogo.unidade)} />
    </li>
  );
}

interface ItemPodio<L extends LinhaRanking> {
  linhas: L[];
  valor: (l: L) => string;
  /** Pódio do geral: cada degrau é um botão que abre o detalhe dos pontos. */
  aberto?: string | null;
  onAbrir?: (l: L) => void;
}

export function Podio<L extends LinhaRanking>({ linhas, valor, aberto, onAbrir }: ItemPodio<L>) {
  const [p1, p2, p3] = linhas;
  if (!p1 || !p2 || !p3) return null;
  const itens: [L, string][] = [[p2, 'var(--silver)'], [p1, 'var(--gold)'], [p3, 'var(--bronze)']];
  return (
    <div className="gx-podio">
      {itens.map(([l, cor], i) => {
        const miolo: ReactNode = (
          <>
            <div className="gx-podio-av">{iniciais(l.apelido)}</div>
            <div className="gx-podio-base">
              <strong>{l.posicao}º {l.apelido}</strong>
              {l.nome && <small className="gx-podio-nome">{l.nome}</small>}
              <span>{valor(l)}</span>
            </div>
          </>
        );
        const estilo = { '--cor': cor } as CSSProperties;
        return onAbrir ? (
          <button key={i} type="button" className="gx-podio-item" style={estilo} aria-expanded={aberto === l.apelido}
            aria-label={`${l.posicao}º ${l.apelido}, ${valor(l)}: ver pontos por jogo`} onClick={() => onAbrir(l)}>
            {miolo}
          </button>
        ) : (
          <div key={i} className="gx-podio-item" style={estilo}>{miolo}</div>
        );
      })}
    </div>
  );
}

export function SemRanking({ erro, texto }: { erro: boolean; texto?: string }) {
  return <p className="perfil-dica">{erro ? 'Não foi possível carregar o ranking.' : texto ?? 'Ninguém pontuou neste jogo ainda. Seja o primeiro!'}</p>;
}
