import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { formatarPontos } from '../dados/formatar';
import { ErroApi, servico } from '../dados/servico';
import type { AvatarConfig, Jogo, ResultadoPartida } from '../dados/tipos';
import { Fechar, Pausa, Som, TelaCheia, Trofeu } from './Icones';
import { fotoDoCorpo, fotoDoRosto, type PersonagemFlix } from '../personagem/flix';

/**
 * Lado do HUB do contrato com os jogos (docs/prompt-inicio-minigames-flix.md, seção 6).
 *
 * Segurança:
 * - iframe com sandbox="allow-scripts" SEM allow-same-origin: o jogo vira uma origem isolada ("null"),
 *   não lê o cookie de sessão nem o armazenamento do portal e só fala por postMessage.
 * - Só aceita mensagens vindas DESTE iframe (event.source) e no formato do contrato.
 * - A pontuação vem do navegador: a API valida tudo (runId, faixa, duração). Aqui só filtramos lixo.
 */

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ESPERA_READY_MS = 15000;

type Fase =
  | { tipo: 'carregando' }
  | { tipo: 'jogando' }
  | { tipo: 'enviando' }
  | { tipo: 'resultado'; pontos: number; r: ResultadoPartida }
  | { tipo: 'erro'; texto: string };

interface Props {
  jogo: Jogo;
  avatar: AvatarConfig | null;
  /** Personagem novo do jogador (editor da plataforma); vai desenhado para o jogo no `init`. null = sem avatar. */
  personagem: PersonagemFlix | null;
  onFechar: (houvePartida: boolean) => void;
  /** Aberto pela animação de lançamento: o jogo aparece junto com a capa se desfazendo. */
  entrando?: boolean;
}

type MsgJogo =
  | { source: 'flix-game'; v: 2; type: 'ready' }
  | { source: 'flix-game'; v: 2; type: 'started'; runId: string }
  | { source: 'flix-game'; v: 2; type: 'gameover'; runId: string; score: number; durationMs: number }
  | { source: 'flix-game'; v: 2; type: 'layout'; imersivo: boolean }
  | { source: 'flix-game'; v: 2; type: 'exit' };

function lerMensagem(d: unknown): MsgJogo | null {
  if (!d || typeof d !== 'object') return null;
  const m = d as Record<string, unknown>;
  if (m.source !== 'flix-game' || m.v !== 2 || typeof m.type !== 'string') return null;
  if (m.type === 'ready' || m.type === 'exit') return m as MsgJogo;
  if (m.type === 'layout') return typeof m.imersivo === 'boolean' ? (m as MsgJogo) : null;
  if (typeof m.runId !== 'string' || !RE_UUID.test(m.runId)) return null;
  if (m.type === 'started') return m as MsgJogo;
  if (m.type === 'gameover' && Number.isSafeInteger(m.score) && (m.score as number) >= 0
    && Number.isSafeInteger(m.durationMs) && (m.durationMs as number) >= 0) return m as MsgJogo;
  return null;
}

/**
 * Proporção (largura/altura) dos jogos desenhados numa tela fixa. No computador, o quadro do jogo fica nessa
 * proporção, o maior possível, com o fundo nas cores do jogo dos lados. Jogo fora da lista ocupa a tela toda.
 */
const PROPORCAO: Record<string, number> = { snake: 540 / 960 };

/** Computador: mouse e tela larga. No celular e no tablet o jogo continua como está. */
const ehComputador = () => window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 900px)').matches;

const AVISO_MS = 4500; // tempo do aviso de ranking no topo

export function Jogando({ jogo, avatar, personagem, onFechar, entrando = false }: Props) {
  const [comEntrada] = useState(entrando); // fixo desde a abertura (não reanima ao terminar o lançamento)
  const raiz = useRef<HTMLDivElement>(null);
  const [computador] = useState(ehComputador);
  const [telaCheia, setTelaCheia] = useState(false);
  const proporcao = jogo.pasta ? PROPORCAO[jogo.pasta] : undefined;
  const quadro = useRef<HTMLIFrameElement>(null);
  const [fase, setFase] = useState<Fase>({ tipo: 'carregando' });
  const [mudo, setMudo] = useState(false);
  // Pausa pelo botão da barra (ou ao pedir para sair). Refs: lidas dentro de ouvintes de evento sem recriá-los.
  const [pausado, setPausado] = useState(false);
  const pausadoRef = useRef(false);
  const mudoRef = useRef(false);
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  const pronto = useRef(false); // o jogo já mandou `ready` (antes disso, sair não perde nada)
  const botaoAlerta = useRef<HTMLButtonElement>(null);
  const botaoContinuar = useRef<HTMLButtonElement>(null);
  // Jogo imersivo (pedido pelo próprio jogo): sem a barra do hub; o jogo tem o próprio botão de voltar
  const [imersivo, setImersivo] = useState(false);
  const runAtual = useRef<string | null>(null);   // partida aberta (registrada no "started")
  const inicioOk = useRef<Promise<unknown> | null>(null);
  const houvePartida = useRef(false);
  // Imagens do personagem para o jogo (retrato e corpo inteiro, PNG), preparadas já na abertura: quando o jogo
  // mandar `ready`, ficam prontas a tempo (ele espera o `init` só 1,5 s). Ficam em cache por personagem.
  const chavePersonagem = personagem ? JSON.stringify(personagem) : '';
  const imagens = useRef<Promise<{ retrato: string; corpo: string | null } | null>>(Promise.resolve(null));
  useEffect(() => {
    imagens.current = personagem
      ? Promise.all([fotoDoRosto(personagem), fotoDoCorpo(personagem)]).then(([retrato, corpo]) => (retrato ? { retrato, corpo } : null))
      : Promise.resolve(null);
  }, [chavePersonagem]); // eslint-disable-line react-hooks/exhaustive-deps

  const enviar = useCallback((m: Record<string, unknown>) => {
    // Iframe isolado tem origem "null": não dá para usar a origem como alvo. O destino é a janela
    // deste iframe (contentWindow), então a mensagem não vai para nenhum outro lugar.
    quadro.current?.contentWindow?.postMessage({ source: 'flix-hub', v: 2, ...m }, '*');
  }, []);

  // Mensagens do jogo
  useEffect(() => {
    const ouvir = (e: MessageEvent) => {
      if (e.source !== quadro.current?.contentWindow) return; // só deste iframe
      const m = lerMensagem(e.data);
      if (!m) return;
      if (m.type === 'ready') {
        pronto.current = true;
        // avatar null = jogo usa o personagem padrão; personagem null = o jogador não criou (ou "Sem avatar")
        void imagens.current.catch(() => null).then((p) => enviar({ type: 'init', avatar, personagem: p, muted: mudo, locale: 'pt-BR' }));
        setFase((f) => (f.tipo === 'carregando' ? { tipo: 'jogando' } : f));
      } else if (m.type === 'layout') {
        setImersivo(m.imersivo);
      } else if (m.type === 'exit') {
        pedirSaidaRef.current(); // botão de sair do próprio jogo (imersivo): mesma confirmação do X
      } else if (m.type === 'started') {
        runAtual.current = m.runId;
        houvePartida.current = true;
        inicioOk.current = servico.iniciarPartida(jogo.id, m.runId).catch((err) => {
          runAtual.current = null;
          setFase({ tipo: 'erro', texto: err instanceof ErroApi ? err.message : 'Sem conexão. A partida não vai contar.' });
        });
      } else if (m.type === 'gameover') {
        if (m.runId !== runAtual.current) return; // gameover de partida que não foi registrada
        runAtual.current = null;
        setFase({ tipo: 'enviando' });
        (inicioOk.current ?? Promise.resolve())
          .then(() => servico.finalizarPartida(m.runId, m.score, m.durationMs))
          .then((r) => setFase({ tipo: 'resultado', pontos: m.score, r }))
          .catch((err) => setFase({ tipo: 'erro', texto: err instanceof ErroApi ? err.message : 'Sem conexão. A partida não foi salva.' }));
      }
    };
    window.addEventListener('message', ouvir);
    return () => window.removeEventListener('message', ouvir);
  }, [enviar, jogo.id, mudo, avatar, onFechar]);

  // Se o jogo não se apresentar, avisa em vez de ficar travado
  useEffect(() => {
    if (fase.tipo !== 'carregando') return;
    const t = window.setTimeout(() => setFase({ tipo: 'erro', texto: 'O jogo não respondeu. Tente de novo.' }), ESPERA_READY_MS);
    return () => window.clearTimeout(t);
  }, [fase.tipo]);

  // ---------- Pausa e confirmação de saída ----------
  // Pausado, o jogo também fica mudo: game.pause() do Phaser congela o jogo, mas não necessariamente a música.
  const pausar = useCallback(() => {
    if (pausadoRef.current) return;
    pausadoRef.current = true;
    setPausado(true);
    enviar({ type: 'pause' });
    enviar({ type: 'mute', muted: true });
  }, [enviar]);
  const continuar = useCallback(() => {
    pausadoRef.current = false;
    setPausado(false);
    setConfirmarSaida(false);
    enviar({ type: 'resume' });
    enviar({ type: 'mute', muted: mudoRef.current });
    quadro.current?.focus(); // teclado volta para o jogo
  }, [enviar]);
  /** X, Esc ou o botão de sair do jogo: pausa e pergunta. Jogo que nem carregou fecha direto (nada a perder). */
  const pedirSaida = useCallback(() => {
    if (!pronto.current) { onFechar(houvePartida.current); return; }
    pausar();
    setConfirmarSaida(true);
  }, [pausar, onFechar]);
  const pedirSaidaRef = useRef(pedirSaida);
  pedirSaidaRef.current = pedirSaida;
  // "Não": volta ao jogo, mas pausado (o jogador retoma quando quiser)
  const ficar = useCallback(() => {
    setConfirmarSaida(false);
    window.setTimeout(() => botaoContinuar.current?.focus(), 0);
  }, []);
  useEffect(() => { if (confirmarSaida) botaoAlerta.current?.focus(); }, [confirmarSaida]);
  useEffect(() => { if (pausado && !confirmarSaida) botaoContinuar.current?.focus(); }, [pausado, confirmarSaida]);

  // App em segundo plano: pausa; voltou: retoma, a não ser que o jogador tenha pausado
  useEffect(() => {
    const vis = () => {
      if (document.hidden) enviar({ type: 'pause' });
      else if (!pausadoRef.current) enviar({ type: 'resume' });
    };
    document.addEventListener('visibilitychange', vis);
    return () => document.removeEventListener('visibilitychange', vis);
  }, [enviar]);

  // Esc: pede para sair (com o alerta aberto, Esc é o "Não"); trava a rolagem da página de trás
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (confirmarSaida) ficar(); else pedirSaida();
    };
    document.addEventListener('keydown', tecla);
    // trava a página de trás inteira (no Safari só o body não bastava: a rolagem passava para o documento)
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', tecla);
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [confirmarSaida, ficar, pedirSaida]);

  // O aviso de resultado some sozinho (o jogo segue na tela de fim dele)
  useEffect(() => {
    if (fase.tipo !== 'resultado' && fase.tipo !== 'erro') return;
    const t = window.setTimeout(() => setFase({ tipo: 'jogando' }), AVISO_MS);
    return () => window.clearTimeout(t);
  }, [fase]);

  function alternarSom() {
    const novo = !mudo;
    setMudo(novo);
    mudoRef.current = novo;
    if (!pausadoRef.current) enviar({ type: 'mute', muted: novo }); // pausado, continua mudo até retomar
  }

  // Altura da parte VISÍVEL da tela. `position: fixed; inset: 0` inclui, em alguns celulares (Safari 26 com a barra
  // flutuante, navegadores Android com a barra embaixo), o pedaço que fica atrás da barra do navegador: o jogo se
  // encaixava nessa área e a faixa de baixo (ex.: "jogar de novo" do Snake) ficava coberta. Usa o menor entre a área
  // que o navegador diz estar visível (visualViewport) e 100svh (altura com as barras abertas); recalcula quando a
  // barra aparece, some ou a tela gira.
  useEffect(() => {
    const el = raiz.current;
    const vv = window.visualViewport;
    if (!el) return;
    const sonda = document.createElement('div');
    sonda.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100svh;visibility:hidden;pointer-events:none';
    document.body.appendChild(sonda);
    const medir = () => {
      const alturas = [window.innerHeight, sonda.offsetHeight || Infinity, vv ? vv.height : Infinity];
      el.style.setProperty('--altura-visivel', `${Math.round(Math.min(...alturas))}px`);
    };
    medir();
    vv?.addEventListener('resize', medir);
    window.addEventListener('resize', medir);
    return () => {
      vv?.removeEventListener('resize', medir);
      window.removeEventListener('resize', medir);
      sonda.remove();
    };
  }, []);

  // O jogo abre dentro do navegador (sem tela cheia automática); o botão ⛶ deixa o cliente escolher.
  // Ao sair do jogo, sai da tela cheia se ela estiver ligada.
  useEffect(() => {
    const mudou = () => setTelaCheia(document.fullscreenElement === raiz.current);
    document.addEventListener('fullscreenchange', mudou);
    return () => {
      document.removeEventListener('fullscreenchange', mudou);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, []);

  function alternarTelaCheia() {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else raiz.current?.requestFullscreen?.().catch(() => {});
  }

  const origem = window.location.origin;
  const src = `/games/${encodeURIComponent(jogo.pasta ?? '')}/?hubOrigin=${encodeURIComponent(origem)}`;

  return (
    <div ref={raiz} role="dialog" aria-modal="true" aria-label={`Jogando ${jogo.nome}`}
      className={'gx-jogo' + (computador ? ' pc' : '') + (telaCheia ? ' cheia' : '') + (computador && proporcao ? ' proporcional' : '') + (comEntrada ? ' entrando' : '') + (imersivo ? ' imersivo' : '')}
      style={{ '--t1': jogo.cor1, '--t2': jogo.cor2, '--prop': proporcao ?? 1 } as CSSProperties}>
      <div className="gx-jogo-barra">
        <button className="gx-jogo-btn" type="button" onClick={pedirSaida} aria-label="Sair do jogo"><Fechar /></button>
        <strong>{jogo.nome}</strong>
        <span className="gx-jogo-dir">
          <button className="gx-jogo-btn" type="button" onClick={pausado ? continuar : pausar} disabled={fase.tipo === 'carregando'}
            aria-pressed={pausado} aria-label={pausado ? 'Continuar o jogo' : 'Pausar o jogo'} title={pausado ? 'Continuar' : 'Pausar'}>
            <Pausa pausado={pausado} />
          </button>
          {computador && (
            <button className="gx-jogo-btn" type="button" onClick={alternarTelaCheia} aria-pressed={telaCheia}
              aria-label={telaCheia ? 'Sair da tela cheia' : 'Tela cheia'} title={telaCheia ? 'Sair da tela cheia (Esc)' : 'Tela cheia'}>
              <TelaCheia ligada={telaCheia} />
            </button>
          )}
          <button className="gx-jogo-btn" type="button" onClick={alternarSom} aria-pressed={mudo} aria-label={mudo ? 'Ligar som' : 'Desligar som'}>
            <Som mudo={mudo} />
          </button>
        </span>
      </div>
      <div className="gx-jogo-palco">
      <iframe
        ref={quadro}
        className="gx-jogo-quadro"
        title={jogo.nome}
        src={src}
        sandbox="allow-scripts allow-pointer-lock"
        allow="gamepad; fullscreen"
        referrerPolicy="no-referrer"
      />
      {pausado && !confirmarSaida && (
        <div className="gx-jogo-pausa">
          <button ref={botaoContinuar} type="button" className="gx-jogo-continuar" onClick={continuar} aria-label="Continuar o jogo">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" /></svg>
          </button>
          <strong>Jogo pausado</strong>
        </div>
      )}
      </div>
      {confirmarSaida && (
        <div className="gx-jogo-alerta" role="alertdialog" aria-modal="true" aria-labelledby="sair-titulo" aria-describedby="sair-texto">
          <div className="gx-jogo-alerta-caixa">
            <div className="gx-jogo-alerta-texto">
              <h2 id="sair-titulo">Deseja sair do jogo?</h2>
              <p id="sair-texto">{runAtual.current ? 'A partida em andamento não vai contar para o ranking.' : 'Você pode voltar a jogar quando quiser.'}</p>
            </div>
            <div className="gx-jogo-alerta-botoes">
              <button ref={botaoAlerta} type="button" onClick={ficar}>Não</button>
              <button type="button" className="sair" onClick={() => onFechar(houvePartida.current)}>Sair</button>
            </div>
          </div>
        </div>
      )}
      {fase.tipo === 'carregando' && <div className="gx-jogo-aviso">Carregando…</div>}
      {/* Fim de partida: a tela de fim e o "jogar de novo" são do próprio jogo. O hub só avisa, discreto e sem
          bloquear, a posição no ranking (ou por que a partida não contou). */}
      {(fase.tipo === 'resultado' || fase.tipo === 'erro') && (
        <div key={fase.tipo === 'resultado' ? `r${fase.pontos}` : fase.texto} className="gx-jogo-toast" role="status">
          {fase.tipo === 'erro' && fase.texto}
          {fase.tipo === 'resultado' && (fase.r.aceita
            ? (jogo.ranking && fase.r.posicao
              ? <><Trofeu />{fase.r.posicao}º no ranking · recorde {formatarPontos(fase.r.melhor ?? 0, jogo.unidade)}</>
              : <>Pontuação salva: {formatarPontos(fase.pontos, jogo.unidade)}</>)
            : <>Partida não contou ({fase.r.motivo}).</>)}
        </div>
      )}
    </div>
  );
}
