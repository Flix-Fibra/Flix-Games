import { type CSSProperties, type ReactNode } from 'react';
import { iniciais } from '../dados/apelido';
import { formatarNumero, rotuloUnidade } from '../dados/formatar';
import { servico } from '../dados/servico';
import type { Jogo, LinhaRanking, Temporadas } from '../dados/tipos';
import { useBusca } from '../dados/useBusca';

/**
 * Ranking de um jogo (Início, página do jogo). `versao` muda quando o perfil muda (força nova busca). `temporada`
 * ("AAAA-MM") restringe ao mês; sem ela, recorde de todos os tempos. Resultado já visto aparece na hora (useBusca).
 */
export function useRanking(jogo: Jogo, versao: string, temporada?: string | null): { linhas: LinhaRanking[] | null; erro: boolean } {
  const chave = jogo.ranking ? chaveDoRanking(jogo.id, temporada ?? null, versao) : null;
  const { dados, erro } = useBusca(chave, () => servico.ranking(jogo.id, temporada ?? undefined));
  if (!jogo.ranking) return { linhas: [], erro: false };
  return { linhas: erro ? [] : dados, erro };
}

/** Mesma chave na página Ranking e no Início: o que um já buscou, o outro mostra na hora. */
export const chaveDoRanking = (jogoId: string, temporada: string | null, versao: string) => `ranking|${jogoId}|${temporada ?? ''}|${versao}`;

/** Temporadas oferecidas na página Ranking. */
export function useTemporadas(): Temporadas | null {
  return useBusca('temporadas', () => servico.temporadas()).dados;
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
