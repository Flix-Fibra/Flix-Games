import { useEffect, useState, type CSSProperties } from 'react';
import { iniciais } from '../dados/apelido';
import { formatarNumero, rotuloUnidade } from '../dados/formatar';
import { servico } from '../dados/servico';
import type { Jogo, LinhaRanking } from '../dados/tipos';

/** Busca o ranking de um jogo na API. `versao` muda quando o perfil muda (força nova busca). */
export function useRanking(jogo: Jogo, versao: string): { linhas: LinhaRanking[] | null; erro: boolean } {
  const [linhas, setLinhas] = useState<LinhaRanking[] | null>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    let ativo = true; // ignora resposta atrasada se o jogo mudou no meio
    setLinhas(null);
    setErro(false);
    if (!jogo.ranking) { setLinhas([]); return; }
    servico.ranking(jogo.id)
      .then((l) => { if (ativo) setLinhas(l); })
      .catch(() => { if (ativo) { setLinhas([]); setErro(true); } });
    return () => { ativo = false; };
  }, [jogo.id, jogo.ranking, versao]);
  return { linhas, erro };
}

export function Linha({ l, jogo }: { l: LinhaRanking; jogo: Jogo }) {
  const p = l.posicao <= 3 ? ' p' + l.posicao : '';
  return (
    <li className={'gx-linha' + (l.eu ? ' eu' : '')}>
      <span className={'gx-pos' + p}>{l.posicao}º</span>
      <span className="gx-mini-av" style={l.eu ? { background: l.cor, color: '#fff' } : undefined}>{iniciais(l.apelido)}</span>
      <span className="gx-apelido">{l.apelido}{l.eu ? ' (você)' : ''}</span>
      <span className="gx-pontos">{formatarNumero(l.pontos, jogo.unidade)} <small>{rotuloUnidade(jogo.unidade)}</small></span>
    </li>
  );
}

export function Podio({ linhas, jogo }: { linhas: LinhaRanking[]; jogo: Jogo }) {
  const [p1, p2, p3] = linhas;
  if (!p1 || !p2 || !p3) return null;
  const itens: [LinhaRanking, string][] = [[p2, 'var(--silver)'], [p1, 'var(--gold)'], [p3, 'var(--bronze)']];
  return (
    <div className="gx-podio">
      {itens.map(([l, cor], i) => (
        <div key={i} className="gx-podio-item" style={{ '--cor': cor } as CSSProperties}>
          <div className="gx-podio-av">{iniciais(l.apelido)}</div>
          <div className="gx-podio-base"><strong>{l.posicao}º {l.apelido}</strong><span>{formatarNumero(l.pontos, jogo.unidade)}</span></div>
        </div>
      ))}
    </div>
  );
}

export function SemRanking({ erro }: { erro: boolean }) {
  return <p className="perfil-dica">{erro ? 'Não foi possível carregar o ranking.' : 'Ninguém pontuou neste jogo ainda. Seja o primeiro!'}</p>;
}
