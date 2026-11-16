import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { formatarPontos, regraDoRanking } from '../dados/formatar';
import type { Jogo, Perfil } from '../dados/tipos';
import { useAviso } from './Aviso';
import { Barras, Coracao, IconeJogo, Mini, Play, Trofeu } from './Icones';
import { Linha, SemRanking, useRanking } from './ListaRanking';

interface Props {
  jogos: Jogo[];
  perfil: Perfil;
  onFavoritar: (jogo: Jogo) => Promise<void>;
  onVerRanking: (jogo: Jogo) => void;
}

export function Inicio({ jogos, perfil, onFavoritar, onVerRanking }: Props) {
  const avisar = useAviso();
  const [sel, setSel] = useState(0);
  const tiles = useRef<(HTMLButtonElement | null)[]>([]);
  const jogo = jogos[Math.min(sel, jogos.length - 1)]!;
  const st = perfil.jogos[jogo.id] ?? {};
  const fav = perfil.favoritos.includes(jogo.id);

  const jogar = useCallback(() => avisar(`Em breve: "${jogo.nome}" abre aqui`), [avisar, jogo.nome]);

  const selecionar = useCallback((i: number, focar = false) => {
    const n = (i + jogos.length) % jogos.length;
    setSel(n);
    const el = tiles.current[n];
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    if (focar) el?.focus({ preventScroll: true });
  }, [jogos.length]);

  // Cor do fundo acompanha o jogo selecionado
  useEffect(() => {
    document.documentElement.style.setProperty('--c1', jogo.cor1);
    document.documentElement.style.setProperty('--c2', jogo.cor2);
  }, [jogo]);

  // Teclado: setas trocam de jogo
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo?.closest('.gx-acoes, .gx-cont, input')) return;
      if (e.key === 'ArrowRight') { selecionar(sel + 1, true); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { selecionar(sel - 1, true); e.preventDefault(); }
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [sel, selecionar]);

  // Controle: direcional troca, botão A joga
  useEffect(() => {
    let rodando = false, quadro = 0;
    const antes: Record<number, boolean> = {};
    const ler = () => {
      const p = Array.from(navigator.getGamepads?.() ?? []).find(Boolean);
      if (!p) { rodando = false; return; }
      const apertou = (n: number) => { const b = !!p.buttons[n]?.pressed; const a = antes[n]; antes[n] = b; return b && !a; };
      if (apertou(15)) selecionar(sel + 1);
      if (apertou(14)) selecionar(sel - 1);
      if (apertou(0)) jogar();
      quadro = requestAnimationFrame(ler);
    };
    const conectou = () => { avisar('Controle conectado'); if (!rodando) { rodando = true; quadro = requestAnimationFrame(ler); } };
    window.addEventListener('gamepadconnected', conectou);
    if (Array.from(navigator.getGamepads?.() ?? []).some(Boolean)) { rodando = true; quadro = requestAnimationFrame(ler); }
    return () => { window.removeEventListener('gamepadconnected', conectou); cancelAnimationFrame(quadro); };
  }, [sel, selecionar, jogar, avisar]);

  const { linhas: top, erro } = useRanking(jogo, perfil.id + perfil.apelido + perfil.oculto);
  const continuar = jogos.filter((j) => perfil.jogos[j.id]?.progresso);

  return (
    <section className="gx-view ativa" aria-label="Início">
      <div className="gx-trilho" role="listbox" aria-label="Jogos">
        {jogos.map((j, i) => (
          <button
            key={j.id}
            ref={(el) => { tiles.current[i] = el; }}
            className={'gx-tile' + (j.id === jogo.id ? ' ativo' : '')}
            role="option"
            aria-selected={j.id === jogo.id}
            aria-label={j.nome}
            tabIndex={j.id === jogo.id ? 0 : -1}
            style={{ '--t1': j.cor1, '--t2': j.cor2 } as CSSProperties}
            onClick={() => (j.id === jogo.id ? jogar() : selecionar(i))}
          >
            <IconeJogo id={j.id} />
            {perfil.favoritos.includes(j.id) && <span className="gx-tile-fav"><Coracao /></span>}
            <span className="gx-tile-nome">{j.nome}</span>
          </button>
        ))}
      </div>

      <div className="gx-hero" aria-live="polite">
        <p className="gx-sobre">{jogo.genero} · 1 jogador</p>
        <h1 className="gx-hero-titulo">{jogo.nome}</h1>
        <div className="gx-chips">
          {jogo.ranking && st.posicao ? (
            <>
              <span className="gx-chip ouro"><Trofeu />{st.posicao}º no ranking</span>
              <span className="gx-chip">Recorde: {formatarPontos(st.melhor ?? 0, jogo.unidade)}</span>
            </>
          ) : jogo.ranking ? <span className="gx-chip">Você ainda não pontuou</span> : null}
          {jogo.ranking && <span className="gx-chip">{regraDoRanking(jogo)}</span>}
        </div>
        <p className="gx-hero-desc">{jogo.descricao}</p>
        <div className="gx-acoes">
          <button className="gx-btn gx-btn-jogar" onClick={jogar}><Play /><span>{st.progresso ? 'Continuar' : 'Jogar'}</span></button>
          <button className="gx-btn gx-btn-sec" aria-pressed={fav}
            onClick={() => onFavoritar(jogo).then(() => avisar(fav ? 'Removido dos favoritos' : 'Adicionado aos favoritos')).catch((e: Error) => avisar(e.message))}>
            <Coracao /><span>{fav ? 'Favorito' : 'Favoritar'}</span>
          </button>
          {jogo.ranking && <button className="gx-btn gx-btn-sec" onClick={() => onVerRanking(jogo)}><Barras /><span>Ranking</span></button>}
        </div>
      </div>

      <div className="gx-faixas">
        <section className="card">
          <h2 className="card-titulo">Continuar jogando</h2>
          <div className="gx-continuar">
            {continuar.length ? continuar.map((j) => {
              const p = perfil.jogos[j.id]?.progresso ?? 0;
              return (
                <button key={j.id} className="gx-cont" onClick={() => { selecionar(jogos.indexOf(j)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                  <Mini jogo={j} />
                  <span className="gx-cont-info">
                    <strong>{j.nome}</strong><small>{p}% concluído</small>
                    <span className="gx-barra"><i style={{ width: p + '%' }} /></span>
                  </span>
                </button>
              );
            }) : <p className="perfil-dica">Nenhum jogo em andamento. Escolha um jogo acima para começar.</p>}
          </div>
        </section>
        {jogo.ranking && (
          <section className="card">
            <h2 className="card-titulo">Top 5 · {jogo.nome}</h2>
            <ol className="gx-top">
              {top === null ? <li className="perfil-dica">Carregando…</li>
                : top.length === 0 ? <li><SemRanking erro={erro} /></li>
                : top.slice(0, 5).map((l) => <Linha key={l.posicao + l.apelido} l={l} jogo={jogo} />)}
            </ol>
          </section>
        )}
      </div>
    </section>
  );
}
