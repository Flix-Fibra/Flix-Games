import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { formatarPontos, regraDoRanking } from '../dados/formatar';
import { nomeCompleto } from '../dados/apelido';
import { NOVIDADES, dataDaNovidade } from '../dados/novidades';
import { servico } from '../dados/servico';
import type { Jogo, LinhaRanking, Perfil, ResumoAvaliacao } from '../dados/tipos';
import { useAviso } from './Aviso';
import { Barras, CapaJogo, Coracao, Megafone, Mini, Pessoa, Play, Trofeu } from './Icones';
import { BotaoFavoritar } from './BotaoFavoritar';
import { CartaoJogo } from './CartaoJogo';
import { usePlataformaCongelada } from './Congelada';
import { DetalheJogo } from './DetalheJogo';
import { Linha, SemRanking, useRanking } from './ListaRanking';
import { RetratoPersonagem } from './personagem/EditorPersonagem';
import { fotoDoBusto, type PersonagemFlix } from '../personagem/flix';

interface Props {
  jogos: Jogo[];
  perfil: Perfil;
  onFavoritar: (jogo: Jogo) => Promise<void>;
  onVerRanking: (jogo: Jogo) => void;
  onJogar: (jogo: Jogo) => void;
  onCriarPersonagem: () => void;
  onAvaliado?: (jogoId: string, avaliacao: ResumoAvaliacao) => void;
  onExplorar: () => void; // abre a aba Jogos (fileira sem jogos recentes)
}

/**
 * A fileira começa pelas Novidades, pelos Favoritos e pelo atalho do personagem; depois vêm só os últimos jogos que o
 * perfil jogou ("Jogados recentemente", em cards um pouco menores). Sem nenhum jogo ainda, um atalho para a aba Jogos.
 */
type Item = { tipo: 'novidades' } | { tipo: 'favoritos' } | { tipo: 'personagem' } | { tipo: 'jogo'; jogo: Jogo } | { tipo: 'explorar' };

/** Quantos jogos a fileira do Início mostra: os jogados mais recentemente pelo perfil (regra do solicitante, 19/11). */
const RECENTES_NO_INICIO = 3;

// Vermelho Flix + roxo: o degradê do topo mistura os dois quando o card do personagem está selecionado
const COR_PERSONAGEM = { c1: '#D2232A', c2: '#7B2FF7' };
// O card em si continua vermelho → vinho
const CARD_PERSONAGEM = { t1: '#D2232A', t2: '#5E0B12' };
// Novidades: roxo → azul-noite, para não se confundir com o personagem (vermelho) nem com as capas dos jogos
const COR_NOVIDADES = { c1: '#7B2FF7', c2: '#1F3FBF' };
const CARD_NOVIDADES = { t1: '#7B2FF7', t2: '#24127A' };
// Favoritos: rosa do coração → vinho
const COR_FAVORITOS = { c1: '#E8416F', c2: '#7B2FF7' };
const CARD_FAVORITOS = { t1: '#E8416F', t2: '#6E1035' };

export function Inicio({ jogos, perfil, onFavoritar, onVerRanking, onJogar, onCriarPersonagem, onAvaliado, onExplorar }: Props) {
  const avisar = useAviso();
  const congelada = usePlataformaCongelada(); // jogo aberto por cima: teclado e controle não mexem na fileira
  const doHub = new Map(jogos.map((j) => [j.id, j]));
  const recentes = (perfil.recentes ?? []).flatMap((id) => { const j = doHub.get(id); return j ? [j] : []; }).slice(0, RECENTES_NO_INICIO);
  const itens: Item[] = [
    { tipo: 'novidades' }, { tipo: 'favoritos' }, { tipo: 'personagem' },
    ...(recentes.length ? recentes.map((jogo) => ({ tipo: 'jogo' as const, jogo })) : [{ tipo: 'explorar' as const }]),
  ];
  const indiceDo = (j: Jogo) => itens.findIndex((it) => it.tipo === 'jogo' && it.jogo.id === j.id);
  const primeiroJogo = itens.findIndex((it) => it.tipo === 'jogo' || it.tipo === 'explorar');
  const [sel, setSel] = useState(0);
  const [aberto, setAberto] = useState<Jogo | null>(null); // "Ver" nos Favoritos: página do jogo, como na aba Jogos
  const tiles = useRef<(HTMLButtonElement | null)[]>([]);
  const atual = itens[Math.min(sel, itens.length - 1)]!;
  const jogo = atual.tipo === 'jogo' ? atual.jogo : null;

  const lideres = useLideres(jogos, `${perfil.id}|${perfil.apelido}|${perfil.oculto}|${perfil.partidas}`);

  const jogar = useCallback(() => {
    if (atual.tipo === 'explorar') { onExplorar(); return; }
    if (atual.tipo === 'novidades' || atual.tipo === 'favoritos') {
      document.querySelector('.gx-faixas')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (!jogo) { onCriarPersonagem(); return; }
    if (jogo.pasta) onJogar(jogo);
    else avisar(`"${jogo.nome}" chega em breve`);
  }, [avisar, atual.tipo, jogo, onJogar, onCriarPersonagem, onExplorar]);
  const jogarEste = useCallback((j: Jogo) => {
    if (j.pasta) onJogar(j);
    else avisar(`"${j.nome}" chega em breve`);
  }, [avisar, onJogar]);

  const selecionar = useCallback((i: number, focar = false, rolar = true) => {
    const n = (i + itens.length) % itens.length;
    setSel(n);
    const el = tiles.current[n];
    if (rolar) el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    if (focar) el?.focus({ preventScroll: true });
  }, [itens.length]);

  // Cor do fundo acompanha o item selecionado
  useEffect(() => {
    const cor = atual.tipo === 'novidades' ? COR_NOVIDADES : atual.tipo === 'favoritos' ? COR_FAVORITOS : COR_PERSONAGEM;
    document.documentElement.style.setProperty('--c1', jogo?.cor1 ?? cor.c1);
    document.documentElement.style.setProperty('--c2', jogo?.cor2 ?? cor.c2);
  }, [jogo, atual.tipo, aberto]);

  // Teclado: setas trocam de item
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (aberto || congelada) return; // página do jogo (ou o próprio jogo) aberta por cima da fileira
      if (alvo?.closest('.gx-acoes, .gx-cont, input, .gx-av')) return; // .gx-av: editor de personagem aberto
      if (e.key === 'ArrowRight') { selecionar(sel + 1, true); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { selecionar(sel - 1, true); e.preventDefault(); }
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [sel, selecionar, aberto, congelada]);

  // Controle: direcional troca, botão A joga (ou abre o personagem). Com o jogo aberto, o laço nem roda: o botão A
  // do jogo não pode apertar "Jogar" na fileira escondida.
  useEffect(() => {
    if (congelada) return;
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
  }, [sel, selecionar, jogar, avisar, congelada]);

  const temPersonagem = !!perfil.personagem;

  // Atalho para um jogo (Novidades, Continuar jogando): seleciona o card se ele está na fileira; se não está entre os
  // recentes, abre a página do jogo
  const irParaJogo = (j: Jogo) => {
    const i = indiceDo(j);
    if (i >= 0) { selecionar(i); window.scrollTo({ top: 0, behavior: 'smooth' }); } else setAberto(j);
  };

  if (aberto) {
    return <DetalheJogo jogo={aberto} perfil={perfil} onJogar={jogarEste} onFavoritar={onFavoritar} onVoltar={() => setAberto(null)} onAvaliado={onAvaliado} />;
  }

  return (
    <section className="gx-view ativa" aria-label="Início">
      {/* --folga-da-vez: quanto os cards depois do ativo deslizam (o card ativo de jogo é menor que os do sistema) */}
      <div className="gx-trilho" role="listbox" aria-label="Novidades, favoritos, personagem e jogados recentemente"
        style={{ '--folga-da-vez': atual.tipo === 'jogo' || atual.tipo === 'explorar' ? 'var(--folga-jogo)' : 'var(--folga-sistema)' } as CSSProperties}>
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
          if (it.tipo === 'novidades') {
            return (
              <button key="novidades" {...comum} className={'gx-tile gx-tile-novidades' + (ativo ? ' ativo' : '')}
                aria-label="Novidades" style={{ '--t1': CARD_NOVIDADES.t1, '--t2': CARD_NOVIDADES.t2 } as CSSProperties}>
                <span className="gx-tile-arte" aria-hidden="true"><Megafone /></span>
                <span className="gx-tile-nome">Novidades</span>
              </button>
            );
          }
          if (it.tipo === 'favoritos') {
            return (
              <button key="favoritos" {...comum} className={'gx-tile gx-tile-favoritos' + (ativo ? ' ativo' : '')}
                aria-label="Favoritos" style={{ '--t1': CARD_FAVORITOS.t1, '--t2': CARD_FAVORITOS.t2 } as CSSProperties}>
                <span className="gx-tile-arte" aria-hidden="true"><Coracao /></span>
                <span className="gx-tile-nome">Favoritos</span>
              </button>
            );
          }
          if (it.tipo === 'personagem') {
            const nome = temPersonagem ? 'Editar personagem' : 'Criar personagem';
            return (
              <button key="personagem" {...comum} className={'gx-tile gx-tile-personagem' + (ativo ? ' ativo' : '')}
                aria-label={nome} style={{ '--t1': CARD_PERSONAGEM.t1, '--t2': CARD_PERSONAGEM.t2 } as CSSProperties}>
                <span className="gx-tile-arte" aria-hidden="true"><Pessoa /></span>
                <span className="gx-tile-mais" aria-hidden="true">+</span>
                <span className="gx-tile-nome">{nome}</span>
              </button>
            );
          }
          const rotulo = i === primeiroJogo && <span className="gx-trilho-rotulo" aria-hidden="true">Jogados recentemente</span>;
          if (it.tipo === 'explorar') {
            return (
              <button key="explorar" {...comum} className={'gx-tile gx-tile-jogo gx-tile-explorar' + (ativo ? ' ativo' : '')} aria-label="Escolher um jogo">
                {rotulo}
                <span className="gx-tile-arte" aria-hidden="true"><Play /></span>
                <span className="gx-tile-nome">Escolher um jogo</span>
              </button>
            );
          }
          const j = it.jogo;
          return (
            <button key={j.id} {...comum} data-capa={j.id} className={'gx-tile gx-tile-jogo' + (ativo ? ' ativo' : '')} aria-label={j.nome}
              style={{ '--t1': j.cor1, '--t2': j.cor2 } as CSSProperties}>
              {rotulo}
              <span className="gx-tile-arte" aria-hidden="true"><CapaJogo jogo={j} /></span>
              {perfil.favoritos.includes(j.id) && <span className="gx-tile-fav"><Coracao /></span>}
              <span className="gx-tile-nome">{j.nome}</span>
            </button>
          );
        })}
      </div>

      {atual.tipo === 'favoritos'
        ? <HeroFavoritos jogos={jogos} perfil={perfil} onJogar={jogarEste} onVer={setAberto} onFavoritar={onFavoritar} />
        : atual.tipo === 'novidades'
        ? <HeroNovidades jogos={jogos} perfil={perfil} lideres={lideres} onVerRanking={onVerRanking} onSelecionar={irParaJogo} />
        : atual.tipo === 'explorar'
        ? <HeroExplorar onExplorar={onExplorar} />
        : jogo
        ? <HeroJogo key={jogo.id} jogo={jogo} jogos={jogos} perfil={perfil} onJogar={jogar} onFavoritar={onFavoritar}
            onVerRanking={onVerRanking} onSelecionar={irParaJogo} />
        : <HeroPersonagem perfil={perfil} jogos={jogos} onCriar={onCriarPersonagem} />}
    </section>
  );
}

/**
 * Líder de cada jogo com ranking (null = ninguém pontuou ou falhou). Buscado uma vez no Início, e não a cada vez
 * que o card de Novidades é selecionado: passar o mouse pela fileira não dispara novas consultas.
 */
function useLideres(jogos: Jogo[], versao: string): Record<string, LinhaRanking | null> | null {
  const [lideres, setLideres] = useState<Record<string, LinhaRanking | null> | null>(null);
  const chave = jogos.filter((j) => j.ranking).map((j) => j.id).join(',');
  useEffect(() => {
    let ativo = true;
    const comRanking = jogos.filter((j) => j.ranking);
    void Promise.all(comRanking.map((j) => servico.ranking(j.id)
      .then((l) => [j.id, l[0] ?? null] as const)
      .catch(() => [j.id, null] as const)))
      .then((pares) => { if (ativo) setLideres(Object.fromEntries(pares)); });
    return () => { ativo = false; };
  }, [chave, versao]); // eslint-disable-line react-hooks/exhaustive-deps
  return lideres;
}

interface HeroNovidadesProps {
  jogos: Jogo[];
  perfil: Perfil;
  lideres: Record<string, LinhaRanking | null> | null;
  onVerRanking: (jogo: Jogo) => void;
  onSelecionar: (jogo: Jogo) => void;
}

/** Destaque das Novidades: atualizações da plataforma, jogos novos no catálogo e líderes do ranking de cada jogo. */
function HeroNovidades({ jogos, perfil, lideres, onVerRanking, onSelecionar }: HeroNovidadesProps) {
  const doCatalogo = new Map(jogos.map((j) => [j.id, j]));
  const plataforma = NOVIDADES.filter((n) => n.tipo === 'plataforma');
  const novosJogos = NOVIDADES.flatMap((n) => {
    const j = n.tipo === 'jogo' && n.jogoId ? doCatalogo.get(n.jogoId) : undefined;
    return j ? [{ n, j }] : [];
  });
  const comRanking = jogos.filter((j) => j.ranking);
  const abrir = (j: Jogo) => onSelecionar(j);

  return (
    <>
      <div className="gx-hero" aria-live="polite">
        <p className="gx-sobre">Flix Games</p>
        <h1 className="gx-hero-titulo">Novidades</h1>
        <p className="gx-hero-desc">O que mudou na plataforma, os jogos que acabaram de chegar e quem lidera cada ranking.</p>
      </div>

      {/* Como antes: atualizações à esquerda (agora um card para cada, um embaixo do outro, com imagem quando ela
          ajuda a entender) e, à direita, jogos novos e líderes do ranking */}
      <div className="gx-faixas gx-novidades">
      <section className="gx-nov-secao" aria-labelledby="nov-atualizacoes">
        <h2 id="nov-atualizacoes" className="gx-nov-secao-titulo">Atualizações</h2>
        <div className="gx-nov-grade">
          {plataforma.map((n) => (
            <article key={n.data + n.titulo} className={'card gx-nov-card' + (n.imagem ? ' com-imagem' : '')}>
              {n.imagem && <img className="gx-nov-imagem" src={n.imagem} alt={n.imagemAlt ?? ''} loading="lazy" decoding="async" />}
              <div className="gx-nov-corpo">
                <span className="gx-nov-data">{dataDaNovidade(n.data)}</span>
                <h3>{n.titulo}</h3>
                {n.texto && <p>{n.texto}</p>}
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="gx-nov-coluna">
          {novosJogos.length > 0 && (
            <section className="card">
              <h2 className="card-titulo">Novos jogos</h2>
              <div className="gx-continuar">
                {novosJogos.map(({ n, j }) => (
                  <button key={j.id} className="gx-cont" onClick={() => abrir(j)}>
                    <Mini jogo={j} />
                    <span className="gx-cont-info">
                      <strong>{n.titulo}</strong>
                      <small>{dataDaNovidade(n.data)} · {n.texto ?? j.genero}</small>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {comRanking.length > 0 && (
            <section className="card">
              <h2 className="card-titulo">Líderes do ranking</h2>
              <div className="gx-continuar">
                {comRanking.map((j) => {
                  const l = lideres?.[j.id];
                  const minha = perfil.jogos[j.id]?.posicao;
                  return (
                    <button key={j.id} className="gx-cont" onClick={() => onVerRanking(j)}>
                      <Mini jogo={j} />
                      <span className="gx-cont-info">
                        <strong>{j.nome}</strong>
                        <small>
                          {lideres === null ? 'Carregando…'
                            : l ? <><Trofeu /> {l.apelido}{l.eu ? ' (você)' : ''} · {formatarPontos(l.pontos, j.unidade)}</>
                            : 'Ninguém pontuou ainda. Seja o primeiro!'}
                          {minha && !l?.eu ? ` · você: ${minha}º` : ''}
                        </small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
      </div>
      </div>
    </>
  );
}

/** Foto 3x4 (do peito para cima) do personagem, na ficha do jogador; enquanto fica pronta, o ícone de pessoa. */
function Foto3x4({ personagem }: { personagem: PersonagemFlix }) {
  const [foto, setFoto] = useState<string | null>(null);
  const chave = JSON.stringify(personagem);
  useEffect(() => {
    setFoto(null);
    let ativo = true;
    fotoDoBusto(personagem).then((url) => { if (ativo) setFoto(url); }).catch(() => {});
    return () => { ativo = false; };
  }, [chave]); // eslint-disable-line react-hooks/exhaustive-deps
  return foto ? <img src={foto} alt="Foto 3x4 do seu personagem" draggable={false} /> : <Pessoa />;
}

/**
 * Destaque do atalho do personagem: abre o editor direto, sem passar pelo Perfil. Abaixo do botão, como nas outras
 * telas, vêm os quadros: a ficha do jogador (bio montada com os dados do perfil e foto 3x4) e o avatar de corpo inteiro.
 */
function HeroPersonagem({ perfil, jogos, onCriar }: { perfil: Perfil; jogos: Jogo[]; onCriar: () => void }) {
  const p = perfil.personagem;
  const comPosicao = jogos.filter((j) => j.ranking && perfil.jogos[j.id]?.posicao);
  const melhor = [...comPosicao].sort((a, b) => perfil.jogos[a.id]!.posicao! - perfil.jogos[b.id]!.posicao!)[0];
  const feitas = perfil.conquistas.filter((c) => c.feita).length;
  const favoritos = perfil.favoritos.filter((id) => jogos.some((j) => j.id === id)).length;
  return (
    <>
      <div className="gx-hero" aria-live="polite">
        <p className="gx-sobre">Seu personagem</p>
        <h1 className="gx-hero-titulo">{p ? 'Seu personagem' : 'Crie seu personagem'}</h1>
        <p className="gx-hero-desc">
          {p ? 'Troque o visual quando quiser.' : 'Escolha corpo e cabelo e monte o seu visual.'} Ele aparece no seu perfil e no ranking.
        </p>
        <div className="gx-acoes">
          <button className="gx-btn gx-btn-jogar" onClick={onCriar}><Pessoa /><span>{p ? 'Editar personagem' : 'Criar personagem'}</span></button>
        </div>
      </div>

      <div className="gx-faixas">
        <section className="card">
          <h2 className="card-titulo">Ficha do jogador</h2>
          <div className="gx-ficha">
            <div className="gx-ficha-3x4">{p ? <Foto3x4 personagem={p} /> : <Pessoa />}</div>
            <div className="perfil-dados">
              <h2>{perfil.apelido}</h2>
              {nomeCompleto(perfil) && <p className="gx-nome-real">{nomeCompleto(perfil)}{perfil.mostrarNome ? '' : ' · só você vê'}</p>}
              <p>Cliente Flix · jogando desde {perfil.desde}</p>
              <span className="perfil-papel">Nível {perfil.nivel}</span>
            </div>
          </div>
          <dl className="perfil-fatos gx-ficha-fatos">
            <div><dt>Partidas</dt><dd>{perfil.partidas.toLocaleString('pt-BR')}</dd></div>
            <div><dt>Conquistas</dt><dd>{feitas} de {perfil.conquistas.length}</dd></div>
            <div><dt>Melhor posição</dt><dd>{melhor ? `${perfil.jogos[melhor.id]!.posicao}º · ${melhor.nome}` : '—'}</dd></div>
            <div><dt>Favoritos</dt><dd>{favoritos === 1 ? '1 jogo' : `${favoritos} jogos`}</dd></div>
          </dl>
        </section>
        <section className="card">
          <h2 className="card-titulo">Avatar</h2>
          <div className="gx-corpo-inteiro">
            {p ? <RetratoPersonagem personagem={p} altura={260} />
              : <p className="perfil-dica">Crie o seu personagem para vê-lo aqui de corpo inteiro.</p>}
          </div>
        </section>
        {jogos.length === 0 && (
          <section className="card">
            <h2 className="card-titulo">Jogos</h2>
            <p className="perfil-dica">Os jogos chegam em breve. Enquanto isso, já dá para criar o seu personagem.</p>
          </section>
        )}
      </div>
    </>
  );
}

/** Destaque do atalho "Escolher um jogo" (perfil que ainda não jogou nada): leva à aba Jogos. */
function HeroExplorar({ onExplorar }: { onExplorar: () => void }) {
  return (
    <div className="gx-hero" aria-live="polite">
      <p className="gx-sobre">Jogados recentemente</p>
      <h1 className="gx-hero-titulo">Escolha um jogo</h1>
      <p className="gx-hero-desc">Os últimos jogos que você jogar aparecem aqui, ao lado do seu personagem.</p>
      <div className="gx-acoes">
        <button className="gx-btn gx-btn-jogar" onClick={onExplorar}><Play /><span>Ver jogos</span></button>
      </div>
    </div>
  );
}

/** Destaque dos Favoritos: os jogos marcados com o coração, com o mesmo cartão da aba Jogos (Jogar, Ver e Remover). */
function HeroFavoritos({ jogos, perfil, onJogar, onVer, onFavoritar }: {
  jogos: Jogo[];
  perfil: Perfil;
  onJogar: (jogo: Jogo) => void;
  onVer: (jogo: Jogo) => void;
  onFavoritar: (jogo: Jogo) => Promise<void>;
}) {
  const doCatalogo = new Map(jogos.map((j) => [j.id, j]));
  const favoritos = perfil.favoritos.flatMap((id) => { const j = doCatalogo.get(id); return j ? [j] : []; });
  return (
    <>
      <div className="gx-hero" aria-live="polite">
        <p className="gx-sobre">Sua lista</p>
        <h1 className="gx-hero-titulo">Favoritos</h1>
        <p className="gx-hero-desc">Os jogos que você marcou com o coração, sempre à mão.</p>
      </div>
      <div className="gx-faixas gx-favoritos">
        <section className="card">
          <h2 className="card-titulo">Seus favoritos</h2>
          {favoritos.length ? (
            <ul className="gx-grade-jogos">
              {favoritos.map((j) => (
                <CartaoJogo key={j.id} jogo={j} favorito onJogar={onJogar} onVer={onVer} onFavoritar={onFavoritar} favoritoComo="remover" />
              ))}
            </ul>
          ) : (
            <p className="perfil-dica">Nenhum favorito ainda. Na aba Jogos, toque no coração abaixo de um jogo para guardá-lo aqui.</p>
          )}
        </section>
      </div>
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
                <button key={j.id} className="gx-cont" onClick={() => onSelecionar(j)}>
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
