import { createPortal } from 'react-dom';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { iniciais } from '../dados/apelido';
import { regraDoRanking, vistoHa } from '../dados/formatar';
import { servico } from '../dados/servico';
import type { Comentario, Jogo, Perfil, ResumoAvaliacao } from '../dados/tipos';
import { useAviso } from './Aviso';
import { BotaoFavoritar } from './BotaoFavoritar';
import { CapaJogo, Play, urlDaPrevia } from './Icones';
import { Linha, SemRanking, useRanking } from './ListaRanking';

interface Props {
  jogo: Jogo;
  perfil: Perfil;
  onJogar: (jogo: Jogo) => void;
  onFavoritar: (jogo: Jogo) => Promise<void>;
  onVoltar: () => void;
}

const LIMITE = 500;

/** Página do jogo: jogar, avaliar (1 a 5 estrelas), ranking e comentários dos clientes. */
export function DetalheJogo({ jogo, perfil, onJogar, onFavoritar, onVoltar }: Props) {
  const fav = perfil.favoritos.includes(jogo.id);
  const avisar = useAviso();
  const previa = urlDaPrevia(jogo);
  // A animação vai do alto da tela até logo abaixo do topo da página (capa, nome, botões e estrelas)
  const topo = useRef<HTMLDivElement>(null);
  const [alturaPrevia, setAlturaPrevia] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!previa) return;
    const medir = () => {
      const r = topo.current?.getBoundingClientRect();
      if (r) setAlturaPrevia(Math.round(r.bottom + window.scrollY + 24));
    };
    medir();
    const obs = new ResizeObserver(medir);
    if (topo.current) obs.observe(topo.current);
    window.addEventListener('resize', medir);
    return () => { obs.disconnect(); window.removeEventListener('resize', medir); };
  }, [previa]);
  const [avaliacao, setAvaliacao] = useState<ResumoAvaliacao | null>(null);
  const [comentarios, setComentarios] = useState<Comentario[] | null>(null);
  const [erro, setErro] = useState(false);
  const { linhas: top, erro: erroRanking } = useRanking(jogo, `${perfil.id}|${perfil.partidas}`);

  // Brilho do topo da página nas cores deste jogo
  useEffect(() => {
    document.documentElement.style.setProperty('--c1', jogo.cor1);
    document.documentElement.style.setProperty('--c2', jogo.cor2);
  }, [jogo.cor1, jogo.cor2]);

  useEffect(() => {
    let ativo = true;
    setErro(false);
    servico.detalhesJogo(jogo.id)
      .then((d) => { if (ativo) { setAvaliacao(d.avaliacao); setComentarios(d.comentarios); } })
      .catch(() => { if (ativo) { setErro(true); setComentarios([]); } });
    window.scrollTo({ top: 0 });
    return () => { ativo = false; };
  }, [jogo.id, perfil.id]);

  async function avaliar(nota: number) {
    try {
      setAvaliacao(await servico.avaliar(jogo.id, nota));
      avisar(`Você deu ${nota} ${nota === 1 ? 'estrela' : 'estrelas'}`);
    } catch (e) { avisar(e instanceof Error ? e.message : 'Não foi possível avaliar.'); }
  }

  return (
    <section className="gx-view ativa gx-detalhe" aria-label={jogo.nome}>
      <button type="button" className="gx-voltar" onClick={onVoltar}>‹ Voltar</button>

      {/* Topo no estilo de página de produto: capa, nome, categoria com a média, e Jogar com a nota ao lado */}
      {/* div, não <header>: o estilo global transforma todo <header> na barra fixa do topo */}
      {/* Trecho do jogo rodando atrás do alto da página, de ponta a ponta, como um GIF ilustrativo (só decoração) */}
      {previa && createPortal(
        <div className="gx-previa-fundo" aria-hidden="true" style={alturaPrevia ? ({ '--previa-h': `${alturaPrevia}px` } as CSSProperties) : undefined}>
          <img src={previa} alt="" draggable={false} decoding="async" />
        </div>,
        document.body,
      )}
      <div ref={topo} className={'gx-detalhe-topo' + (previa ? ' com-previa' : '')}>
        <span data-capa={jogo.id} className="gx-cartao-capa gx-detalhe-capa" style={{ '--t1': jogo.cor1, '--t2': jogo.cor2 } as CSSProperties}>
          <CapaJogo jogo={jogo} />
        </span>
        <div className="gx-detalhe-info">
          <h1 className="gx-detalhe-nome">{jogo.nome}</h1>
          <p className="gx-detalhe-sub">{jogo.genero}<Media avaliacao={avaliacao} /></p>
          <div className="gx-detalhe-acoes">
            <button type="button" className="gx-btn gx-btn-jogar gx-detalhe-jogar"
              onClick={() => (jogo.pasta ? onJogar(jogo) : avisar(`"${jogo.nome}" chega em breve`))}>
              <Play /><span>{jogo.pasta ? 'Jogar' : 'Em breve'}</span>
            </button>
            <BotaoFavoritar favorito={fav} className="gx-detalhe-fav"
              onAlternar={() => onFavoritar(jogo).then(() => avisar(fav ? 'Removido dos favoritos' : 'Adicionado aos favoritos')).catch((e: Error) => avisar(e.message))} />
            <Estrelas nota={avaliacao?.minha ?? 0} onNota={avaliar} />
          </div>
        </div>
      </div>

      <section className="gx-secao">
        <h2 className="gx-secao-titulo">Sobre</h2>
        <p className="gx-secao-texto">{jogo.descricao}</p>
      </section>

      {/* Comentários à esquerda e ranking à direita (no celular, um embaixo do outro) */}
      <div className="gx-detalhe-colunas">
      <section className="gx-secao gx-col-comentarios">
        <h2 className="gx-secao-titulo">Comentários{comentarios && comentarios.length > 0 ? <span className="gx-secao-conta">{comentarios.length}</span> : null}</h2>
        <NovoComentario jogo={jogo} perfil={perfil} onPublicado={(c) => setComentarios((l) => [c, ...(l ?? [])])} />
        {comentarios === null ? <p className="perfil-dica">Carregando…</p>
          : erro ? <p className="perfil-dica">Não foi possível carregar os comentários.</p>
          : comentarios.length === 0 ? <p className="gx-secao-nota">Ninguém comentou ainda. Seja o primeiro.</p>
          : (
            <ul className="gx-lista-comentarios">
              {comentarios.map((c) => (
                <ItemComentario key={c.id} c={c} onApagado={() => setComentarios((l) => (l ?? []).filter((x) => x.id !== c.id))} />
              ))}
            </ul>
          )}
      </section>
      {jogo.ranking && (
        <section className="gx-secao gx-col-ranking">
          <h2 className="gx-secao-titulo">Ranking</h2>
          <p className="gx-secao-nota">{regraDoRanking(jogo)}</p>
          <ol className="gx-top gx-detalhe-ranking">
            {top === null ? <li className="perfil-dica">Carregando…</li>
              : top.length === 0 ? <li><SemRanking erro={erroRanking} /></li>
              : top.slice(0, 10).map((l) => <Linha key={l.posicao + l.apelido} l={l} jogo={jogo} />)}
          </ol>
        </section>
      )}

      </div>
    </section>
  );
}

function Media({ avaliacao }: { avaliacao: ResumoAvaliacao | null }) {
  if (!avaliacao?.total) return null;
  const media = avaliacao.media ?? 0;
  return (
    <span className="gx-media" aria-label={`Nota ${media.toLocaleString('pt-BR')} de 5, ${avaliacao.total} avaliações`}>
      <span aria-hidden="true"> · ★ </span>
      {media.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
      <span aria-hidden="true"> ({avaliacao.total})</span>
    </span>
  );
}

function Estrelas({ nota, onNota }: { nota: number; onNota: (n: number) => void }) {
  const [sobre, setSobre] = useState(0);
  const mostrar = sobre || nota;
  return (
    <div className="gx-avaliar">
      <div className="gx-estrelas" role="radiogroup" aria-label="Sua nota" onMouseLeave={() => setSobre(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={nota === n} aria-label={`Dar ${n} ${n === 1 ? 'estrela' : 'estrelas'}`}
            className={'gx-estrela' + (n <= mostrar ? ' cheia' : '')} onMouseEnter={() => setSobre(n)} onClick={() => onNota(n)}>
            ★
          </button>
        ))}
      </div>
      <span className="gx-avaliar-rotulo">{nota ? 'Sua nota' : 'Avaliar'}</span>
    </div>
  );
}

function NovoComentario({ jogo, perfil, onPublicado }: { jogo: Jogo; perfil: Perfil; onPublicado: (c: Comentario) => void }) {
  const avisar = useAviso();
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const t = texto.trim();
    if (t.length < 2 || enviando) return;
    setEnviando(true);
    setMsg(null);
    try {
      onPublicado(await servico.comentar(jogo.id, t));
      setTexto('');
      avisar('Comentário publicado');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Não foi possível publicar.');
    } finally { setEnviando(false); }
  }

  return (
    <form className="gx-novo-comentario" onSubmit={enviar}>
      <span className="gx-com-av" style={{ background: perfil.cor }} aria-hidden="true">{iniciais(perfil.apelido)}</span>
      <div className="gx-novo-campo">
        <textarea value={texto} maxLength={LIMITE} rows={3} placeholder={`O que você achou de ${jogo.nome}?`}
          aria-label="Escreva um comentário" onChange={(e) => { setTexto(e.target.value); setMsg(null); }} />
        <div className="gx-novo-rodape">
          <small className={msg ? 'gx-novo-erro' : 'perfil-dica'} role={msg ? 'alert' : undefined}>
            {msg ?? 'Sem links, e-mails ou telefones. Seja gentil.'}
          </small>
          <small className="perfil-dica">{texto.length}/{LIMITE}</small>
          <button type="submit" className="btn" disabled={enviando || texto.trim().length < 2}>{enviando ? 'Publicando…' : 'Publicar'}</button>
        </div>
      </div>
    </form>
  );
}

function ItemComentario({ c, onApagado }: { c: Comentario; onApagado: () => void }) {
  const avisar = useAviso();
  const [confirmar, setConfirmar] = useState<'apagar' | 'denunciar' | null>(null);
  const [denunciado, setDenunciado] = useState(false);

  async function agir() {
    try {
      if (confirmar === 'apagar') { await servico.apagarComentario(c.id); onApagado(); avisar('Comentário apagado'); }
      else { await servico.denunciarComentario(c.id); setDenunciado(true); avisar('Obrigado! A equipe vai revisar.'); }
    } catch (e) { avisar(e instanceof Error ? e.message : 'Não foi possível completar.'); }
    setConfirmar(null);
  }

  return (
    <li className="gx-comentario">
      <span className="gx-com-av" style={{ background: c.cor }} aria-hidden="true">{iniciais(c.apelido)}</span>
      <div className="gx-com-corpo">
        <p className="gx-com-cab"><strong>{c.apelido}{c.meu && ' (você)'}</strong><span>{vistoHa(c.criadoEm)}</span></p>
        <p className="gx-com-texto">{c.texto}</p>
        <div className="gx-com-acoes">
          {confirmar ? (
            <>
              <span>{confirmar === 'apagar' ? 'Apagar seu comentário?' : 'Denunciar este comentário?'}</span>
              <button type="button" onClick={agir}>Sim</button>
              <button type="button" onClick={() => setConfirmar(null)}>Não</button>
            </>
          ) : c.meu ? (
            <button type="button" onClick={() => setConfirmar('apagar')}>Apagar</button>
          ) : denunciado ? (
            <span>Denunciado</span>
          ) : (
            <button type="button" onClick={() => setConfirmar('denunciar')}>Denunciar</button>
          )}
        </div>
      </div>
    </li>
  );
}
