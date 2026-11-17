import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { formatarPontos, regraDoRanking } from '../dados/formatar';
import type { Jogo, Perfil } from '../dados/tipos';
import { carregar } from '../lpc/motor';
import { useAviso } from './Aviso';
import { Barras, CapaJogo, Coracao, Mini, Pessoa, Play, Trofeu } from './Icones';
import { BotaoFavoritar } from './BotaoFavoritar';
import { Linha, SemRanking, useRanking } from './ListaRanking';
import { RetratoLpc } from './personagem/EditorLpc';

interface Props {
  jogos: Jogo[];
  perfil: Perfil;
  onFavoritar: (jogo: Jogo) => Promise<void>;
  onVerRanking: (jogo: Jogo) => void;
  onJogar: (jogo: Jogo) => void;
  onCriarPersonagem: () => void;
}

/** O primeiro item da fileira é o atalho do personagem; depois vêm os jogos. */
type Item = { tipo: 'personagem' } | { tipo: 'jogo'; jogo: Jogo };

// Vermelho Flix + roxo: o degradê do topo mistura os dois quando o card do personagem está selecionado
const COR_PERSONAGEM = { c1: '#D2232A', c2: '#7B2FF7' };
// O card em si continua vermelho → vinho
const CARD_PERSONAGEM = { t1: '#D2232A', t2: '#5E0B12' };

export function Inicio({ jogos, perfil, onFavoritar, onVerRanking, onJogar, onCriarPersonagem }: Props) {
  const avisar = useAviso();
  const itens: Item[] = [{ tipo: 'personagem' }, ...jogos.map((jogo) => ({ tipo: 'jogo' as const, jogo }))];
  const [sel, setSel] = useState(0);
  const tiles = useRef<(HTMLButtonElement | null)[]>([]);
  const atual = itens[Math.min(sel, itens.length - 1)]!;
  const jogo = atual.tipo === 'jogo' ? atual.jogo : null;

  const jogar = useCallback(() => {
    if (!jogo) { onCriarPersonagem(); return; }
    if (jogo.pasta) onJogar(jogo);
    else avisar(`"${jogo.nome}" chega em breve`);
  }, [avisar, jogo, onJogar, onCriarPersonagem]);

  const selecionar = useCallback((i: number, focar = false, rolar = true) => {
    const n = (i + itens.length) % itens.length;
    setSel(n);
    const el = tiles.current[n];
    if (rolar) el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    if (focar) el?.focus({ preventScroll: true });
  }, [itens.length]);

  // Cor do fundo acompanha o item selecionado
  useEffect(() => {
    document.documentElement.style.setProperty('--c1', jogo?.cor1 ?? COR_PERSONAGEM.c1);
    document.documentElement.style.setProperty('--c2', jogo?.cor2 ?? COR_PERSONAGEM.c2);
  }, [jogo]);

  // Teclado: setas trocam de item
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo?.closest('.gx-acoes, .gx-cont, input, .gx-av')) return; // .gx-av: editor de personagem aberto
      if (e.key === 'ArrowRight') { selecionar(sel + 1, true); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { selecionar(sel - 1, true); e.preventDefault(); }
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [sel, selecionar]);

  // Controle: direcional troca, botão A joga (ou abre o personagem)
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

  const temPersonagem = !!perfil.personagem;

  return (
    <section className="gx-view ativa" aria-label="Início">
      <div className="gx-trilho" role="listbox" aria-label="Personagem e jogos">
        {itens.map((it, i) => {
          const ativo = i === sel;
          const comum = {
            ref: (el: HTMLButtonElement | null) => { tiles.current[i] = el; },
            role: 'option',
            'aria-selected': ativo,
            tabIndex: ativo ? 0 : -1,
            onClick: () => (ativo ? jogar() : selecionar(i)),
            // Como no PS5: com mouse, passar por cima já leva o foco para o item (sem rolar a fileira)
            onMouseEnter: () => { if (!ativo && window.matchMedia('(hover: hover)').matches) selecionar(i, false, false); },
          };
          if (it.tipo === 'personagem') {
            const nome = temPersonagem ? 'Editar personagem' : 'Criar personagem';
            return (
              <button key="personagem" {...comum} className={'gx-tile gx-tile-personagem' + (ativo ? ' ativo' : '')}
                aria-label={nome} style={{ '--t1': CARD_PERSONAGEM.t1, '--t2': CARD_PERSONAGEM.t2 } as CSSProperties}>
                <Pessoa />
                <span className="gx-tile-mais" aria-hidden="true">+</span>
                <span className="gx-tile-nome">{nome}</span>
              </button>
            );
          }
          const j = it.jogo;
          return (
            <button key={j.id} {...comum} data-capa={j.id} className={'gx-tile' + (ativo ? ' ativo' : '')} aria-label={j.nome}
              style={{ '--t1': j.cor1, '--t2': j.cor2 } as CSSProperties}>
              <CapaJogo jogo={j} />
              {perfil.favoritos.includes(j.id) && <span className="gx-tile-fav"><Coracao /></span>}
              <span className="gx-tile-nome">{j.nome}</span>
            </button>
          );
        })}
      </div>

      {jogo
        ? <HeroJogo key={jogo.id} jogo={jogo} jogos={jogos} perfil={perfil} onJogar={jogar} onFavoritar={onFavoritar}
            onVerRanking={onVerRanking} onSelecionar={(j) => selecionar(jogos.indexOf(j) + 1)} />
        : <HeroPersonagem perfil={perfil} semJogos={jogos.length === 0} onCriar={onCriarPersonagem} />}
    </section>
  );
}

/** Destaque do atalho do personagem: abre o editor direto, sem passar pelo Perfil. */
function HeroPersonagem({ perfil, semJogos, onCriar }: { perfil: Perfil; semJogos: boolean; onCriar: () => void }) {
  const tem = !!perfil.personagem;
  // Retrato: o motor carrega a configuração salva deste perfil
  useEffect(() => { if (perfil.personagem) void carregar(perfil.personagem); }, [perfil.personagem]);
  return (
    <>
      <div className="gx-hero gx-hero-personagem" aria-live="polite">
        <div className="gx-hero-texto">
          <p className="gx-sobre">Seu personagem</p>
          <h1 className="gx-hero-titulo">{tem ? 'Seu personagem' : 'Crie seu personagem'}</h1>
          <p className="gx-hero-desc">
            {tem ? 'Troque cabelo, roupa e cores quando quiser.' : 'Monte o seu visual: corpo, cabelo, roupa e cores.'} Ele aparece no seu perfil e no ranking.
          </p>
          <div className="gx-acoes">
            <button className="gx-btn gx-btn-jogar" onClick={onCriar}><Pessoa /><span>{tem ? 'Editar personagem' : 'Criar personagem'}</span></button>
          </div>
        </div>
        {tem && <div className="gx-hero-retrato" aria-hidden="true"><RetratoLpc tamanho={140} /></div>}
      </div>
      {semJogos && (
        <div className="gx-faixas">
          <section className="card">
            <h2 className="card-titulo">Jogos</h2>
            <p className="perfil-dica">Os jogos chegam em breve. Enquanto isso, já dá para criar o seu personagem.</p>
          </section>
        </div>
      )}
    </>
  );
}

interface HeroJogoProps {
  jogo: Jogo;
  jogos: Jogo[];
  perfil: Perfil;
  onJogar: () => void;
  onFavoritar: (jogo: Jogo) => Promise<void>;
  onVerRanking: (jogo: Jogo) => void;
  onSelecionar: (jogo: Jogo) => void;
}

function HeroJogo({ jogo, jogos, perfil, onJogar, onFavoritar, onVerRanking, onSelecionar }: HeroJogoProps) {
  const avisar = useAviso();
  const st = perfil.jogos[jogo.id] ?? {};
  const fav = perfil.favoritos.includes(jogo.id);
  const { linhas: top, erro } = useRanking(jogo, `${perfil.id}|${perfil.apelido}|${perfil.oculto}|${perfil.partidas}`);
  const continuar = jogos.filter((j) => perfil.jogos[j.id]?.progresso);

  return (
    <>
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
          <button className="gx-btn gx-btn-jogar" onClick={onJogar}><Play /><span>{!jogo.pasta ? 'Em breve' : st.progresso ? 'Continuar' : 'Jogar'}</span></button>
          <BotaoFavoritar favorito={fav}
            onAlternar={() => onFavoritar(jogo).then(() => avisar(fav ? 'Removido dos favoritos' : 'Adicionado aos favoritos')).catch((e: Error) => avisar(e.message))} />
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
                <button key={j.id} className="gx-cont" onClick={() => { onSelecionar(j); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
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
    </>
  );
}
