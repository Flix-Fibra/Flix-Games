import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { servico } from '../../dados/servico';
import type { Perfil } from '../../dados/tipos';
import {
  abaDe, carregarCatalogo, desenhar, ehPersonagemFlix, fotoDoRosto, padrao, temTom, urlDaFoto, visualDe, visuaisDaCategoria, visuaisDoCorpo,
  type Catalogo, type PersonagemFlix,
} from '../../personagem/flix';
import { useAviso } from '../Aviso';
import { Pessoa } from '../Icones';
import { Segredo } from '../Segredo';

const sortear = <T,>(l: T[]) => l[Math.floor(Math.random() * l.length)]!;

/** Personagem desenhado num canvas ampliado sem borrar (1 pixel da arte = vários pixels da tela). */
export function PreviaPersonagem({ personagem, altura = 340 }: { personagem: PersonagemFlix; altura?: number }) {
  const tela = useRef<HTMLCanvasElement>(null);
  const [cat, setCat] = useState<Catalogo | null>(null);
  useEffect(() => { void carregarCatalogo().then(setCat).catch(() => {}); }, []);
  useEffect(() => {
    const ctx = tela.current?.getContext('2d');
    if (ctx && cat) void desenhar(ctx, personagem, cat);
  }, [cat, personagem]);
  if (!cat) return <div style={{ height: altura }} />;
  const v = visualDe(cat, personagem);
  const foto = v ? urlDaFoto(v) : null;
  // Personagem secreto: foto nítida (não é pixel art)
  if (foto) return <img className="pf-foto" src={foto} alt="Seu personagem" style={{ height: altura }} draggable={false} />;
  const [w, h] = cat.tamanho;
  return <canvas ref={tela} width={w} height={h} className="pf-previa" role="img" aria-label="Seu personagem"
    style={{ height: altura, width: (altura * w) / h }} />;
}

/** Miniatura do rosto de um personagem, para os botões de escolha. */
function Mini({ p }: { p: PersonagemFlix }) {
  const [url, setUrl] = useState<string | null>(null);
  const chave = JSON.stringify(p);
  useEffect(() => {
    let ativo = true;
    void fotoDoRosto(p).then((u) => { if (ativo) setUrl(u); });
    return () => { ativo = false; };
  }, [chave]); // eslint-disable-line react-hooks/exhaustive-deps
  return url ? <img src={url} alt="" draggable={false} /> : <span className="pf-mini-vazio" />;
}

interface Props { perfil: Perfil; onSalvo: (p: Perfil) => void; onFechar: () => void }

export function EditorPersonagem({ perfil, onSalvo, onFechar }: Props) {
  const avisar = useAviso();
  const [cat, setCat] = useState<Catalogo | null>(null);
  const [p, setP] = useState<PersonagemFlix | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [sem, setSem] = useState(false); // opção "sem avatar" escolhida
  const [aba, setAba] = useState<string | null>(null); // corpo (m/f) ou categoria especial

  useEffect(() => {
    void carregarCatalogo().then((c) => {
      setCat(c);
      const inicial = ehPersonagemFlix(perfil.personagem) ? perfil.personagem : padrao(c);
      setP(inicial);
      setAba(abaDe(c, inicial));
    }).catch(() => avisar('Não foi possível carregar o editor.'));
  }, [perfil.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  async function salvar() {
    if (!p && !sem) return;
    setSalvando(true);
    try {
      if (sem) {
        onSalvo(await servico.removerPersonagem(perfil.id));
        avisar('Perfil sem avatar.');
      } else {
        onSalvo(await servico.salvarPersonagem(perfil.id, p!));
        avisar('Personagem salvo!');
      }
      onFechar();
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  function aleatorio() {
    if (!cat) return;
    const corpo = sortear(cat.corpos).id;
    const v = sortear(visuaisDoCorpo(cat, corpo));
    const tons = (cat.peles?.tons ?? []).filter((t) => temTom(cat, v, t.id));
    const pele = tons.length ? sortear(tons).id : undefined;
    setP({ v: 4, motor: 'flix', corpo, visual: v.id, ...(pele && pele !== cat.peles?.padrao ? { pele } : {}) });
    setSem(false);
    setAba(corpo);
  }

  function exportar() {
    if (!cat || !p) return;
    const [w, h] = cat.tamanho;
    const base = document.createElement('canvas');
    base.width = w; base.height = h;
    void desenhar(base.getContext('2d')!, p, cat).then(() => {
      const grande = document.createElement('canvas');
      grande.width = w * 4; grande.height = h * 4;
      const g = grande.getContext('2d')!;
      g.imageSmoothingEnabled = false;
      g.drawImage(base, 0, 0, grande.width, grande.height);
      grande.toBlob((b) => {
        if (!b) return;
        const url = URL.createObjectURL(b);
        const a = document.createElement('a');
        a.href = url; a.download = `personagem-${perfil.apelido}.png`; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, 'image/png');
    });
  }

  return createPortal(
    <div className="gx-av pf" role="dialog" aria-modal="true" aria-label="Criar personagem">
      <div className="gx-jogo-barra">
        <button className="gx-jogo-btn" type="button" onClick={onFechar} aria-label="Fechar sem salvar">✕</button>
        <strong>Seu personagem</strong>
        <span className="gx-segredo-lugar">
          <Segredo onUsar={(x) => { setP(x); setSem(false); setAba('secreto'); avisar('Personagem secreto! Toque em Salvar para usar.'); }} />
        </span>
      </div>

      <div className="gx-av-corpo">
        <div className="gx-av-palco pf-palco">
          {sem
            ? <div className="pf-sem" role="img" aria-label="Sem avatar"><Pessoa /></div>
            : p ? <PreviaPersonagem personagem={p} /> : <p className="perfil-dica">Carregando…</p>}
          <div className="pf-acoes">
            <button type="button" className="btn light" onClick={aleatorio} disabled={!p}>🎲 Aleatório</button>
            <button type="button" className="btn light" onClick={exportar} disabled={!p || sem}>Baixar imagem</button>
          </div>
        </div>

        <div className="gx-av-painel">
          {cat && p && (
            <>
              <div className="gx-filtro-jogos" role="tablist" aria-label="Tipo de personagem">
                {cat.corpos.map((c) => (
                  <button key={c.id} type="button" role="tab" aria-selected={aba === c.id} className="gx-filtro gx-av-aba"
                    onClick={() => setAba(c.id)}>{c.nome}</button>
                ))}
                {(cat.categorias ?? []).map((c) => (
                  <button key={c.id} type="button" role="tab" aria-selected={aba === c.id} className="gx-filtro gx-av-aba"
                    onClick={() => setAba(c.id)}>{c.nome}</button>
                ))}
              </div>
              {cat.peles && cat.corpos.some((c) => c.id === aba) && (
                <>
                  <h4>Tom de pele</h4>
                  <div className="pf-tons" role="radiogroup" aria-label="Tom de pele">
                    {cat.peles.tons.map((t) => {
                      const atual = (p.pele ?? cat.peles!.padrao) === t.id;
                      const disponivel = temTom(cat, visualDe(cat, p), t.id) || abaDe(cat, p) !== aba;
                      return (
                        <button key={t.id} type="button" role="radio" aria-checked={atual} aria-label={t.nome} title={t.nome}
                          className={'pf-tom' + (atual ? ' ativo' : '')} style={{ background: t.cor }} disabled={!disponivel}
                          onClick={() => { setP({ ...p, pele: t.id === cat.peles!.padrao ? undefined : t.id }); setSem(false); }}>
                          <span>{t.nome}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
              <h4>Visual</h4>
              <div className="pf-grade">
                <button type="button" className={'pf-op' + (sem ? ' ativo' : '')} aria-pressed={sem} onClick={() => setSem(true)}>
                  <span className="pf-mini-vazio pf-mini-sem"><Pessoa /></span><span>Sem avatar</span>
                </button>
                {(cat.corpos.some((c) => c.id === aba) ? visuaisDoCorpo(cat, aba ?? p.corpo) : visuaisDaCategoria(cat, aba ?? '')).map((v) => {
                  // nas abas de corpo, as opções já aparecem no tom escolhido (se o visual tiver esse tom)
                  const pele = !v.categoria && p.pele && temTom(cat, v, p.pele) ? p.pele : undefined;
                  const op: PersonagemFlix = { v: 4, motor: 'flix', corpo: v.corpo, visual: v.id, ...(pele ? { pele } : {}) };
                  const ativo = !sem && p.visual === v.id && p.corpo === v.corpo;
                  return (
                    <button key={`${v.corpo}-${v.id}`} type="button" className={'pf-op' + (ativo ? ' ativo' : '')} aria-pressed={ativo}
                      onClick={() => { setP(op); setSem(false); }}>
                      <Mini p={op} /><span>{v.nome}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="gx-av-rodape">
        <button className="btn light" type="button" onClick={onFechar}>Cancelar</button>
        <button className="btn" type="button" onClick={salvar} disabled={salvando || (!p && !sem)}>{salvando ? 'Salvando…' : sem ? 'Salvar sem avatar' : 'Salvar personagem'}</button>
      </div>
    </div>,
    document.body,
  );
}

/** Retrato do personagem salvo (Início). */
export function RetratoPersonagem({ personagem, altura = 140 }: { personagem: PersonagemFlix; altura?: number }) {
  return <PreviaPersonagem personagem={personagem} altura={altura} />;
}
