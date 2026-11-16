import { useEffect, useState, type CSSProperties } from 'react';
import { iniciais } from '../dados/apelido';
import { servico } from '../dados/servico';
import type { Jogo, LinhaRanking, Perfil } from '../dados/tipos';

const num = (n: number) => n.toLocaleString('pt-BR');

/** Busca o ranking de um jogo no serviço (hoje simulado). */
export function useRanking(jogo: Jogo, perfil: Perfil): LinhaRanking[] | null {
  const [linhas, setLinhas] = useState<LinhaRanking[] | null>(null);
  useEffect(() => {
    let ativo = true; // ignora resposta atrasada se o jogo/perfil mudou no meio
    setLinhas(null);
    servico.ranking(jogo, perfil).then((l) => { if (ativo) setLinhas(l); }).catch(() => { if (ativo) setLinhas([]); });
    return () => { ativo = false; };
  }, [jogo, perfil]);
  return linhas;
}

export function Linha({ l, unidade, cor }: { l: LinhaRanking; unidade?: string; cor: string }) {
  const p = l.posicao <= 3 ? ' p' + l.posicao : '';
  return (
    <li className={'gx-linha' + (l.eu ? ' eu' : '')}>
      <span className={'gx-pos' + p}>{l.posicao}º</span>
      <span className="gx-mini-av" style={l.eu ? { background: cor } : undefined}>{iniciais(l.apelido)}</span>
      <span className="gx-apelido">{l.apelido}{l.eu ? ' (você)' : ''}</span>
      <span className="gx-pontos">{num(l.pontos)} <small>{unidade}</small></span>
    </li>
  );
}

export function Podio({ linhas }: { linhas: LinhaRanking[] }) {
  const [p1, p2, p3] = linhas;
  if (!p1 || !p2 || !p3) return null;
  const itens: [LinhaRanking, string][] = [[p2, 'var(--silver)'], [p1, 'var(--gold)'], [p3, 'var(--bronze)']];
  return (
    <div className="gx-podio">
      {itens.map(([l, cor]) => (
        <div key={l.posicao} className="gx-podio-item" style={{ '--cor': cor } as CSSProperties}>
          <div className="gx-podio-av">{iniciais(l.apelido)}</div>
          <div className="gx-podio-base"><strong>{l.posicao}º {l.apelido}</strong><span>{num(l.pontos)}</span></div>
        </div>
      ))}
    </div>
  );
}
