import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { servico } from '../../dados/servico';
import type { AvatarConfig, CatalogoAvatar, CorCatalogo, ItemCatalogo, Perfil } from '../../dados/tipos';
import { useAviso } from '../Aviso';
import { Previa, avatarPadrao } from './Previa';

type Aba = 'pele' | 'cabelo' | 'rosto' | 'roupa' | 'extras';
const ABAS: [Aba, string][] = [['pele', 'Pele'], ['cabelo', 'Cabelo'], ['rosto', 'Rosto'], ['roupa', 'Roupa'], ['extras', 'Extras']];

interface Props {
  perfil: Perfil;
  onSalvo: (p: Perfil) => void;
  onFechar: () => void;
}

function Cores({ cores, valor, onEscolher, rotulo }: { cores: CorCatalogo[]; valor: string | null | undefined; onEscolher: (id: string) => void; rotulo: string }) {
  return (
    <div className="gx-av-cores" role="radiogroup" aria-label={rotulo}>
      {cores.map((c) => (
        <button key={c.id} type="button" role="radio" aria-checked={c.id === valor} aria-label={`${rotulo}: ${c.id}`}
          className={'gx-av-cor' + (c.id === valor ? ' ativo' : '')} style={{ background: c.hex }} onClick={() => onEscolher(c.id)} />
      ))}
    </div>
  );
}

function Itens({ itens, valor, onEscolher, rotulo, nenhum }: { itens: ItemCatalogo[]; valor: string | null | undefined; onEscolher: (id: string | null) => void; rotulo: string; nenhum?: string }) {
  return (
    <div className="gx-av-itens" role="radiogroup" aria-label={rotulo}>
      {nenhum && <button type="button" role="radio" aria-checked={!valor} className={'gx-av-item' + (!valor ? ' ativo' : '')} onClick={() => onEscolher(null)}>{nenhum}</button>}
      {itens.map((i) => (
        <button key={i.id} type="button" role="radio" aria-checked={i.id === valor} className={'gx-av-item' + (i.id === valor ? ' ativo' : '')} onClick={() => onEscolher(i.id)}>{i.nome}</button>
      ))}
    </div>
  );
}

/** Editor do personagem (seção 9): só escolhas do catálogo; a API valida antes de gravar. */
export function Editor({ perfil, onSalvo, onFechar }: Props) {
  const avisar = useAviso();
  const [cat, setCat] = useState<CatalogoAvatar | null>(null);
  const [av, setAv] = useState<AvatarConfig | null>(null);
  const [aba, setAba] = useState<Aba>('pele');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    servico.catalogoAvatar()
      .then((c) => { setCat(c); setAv(perfil.avatar ?? avatarPadrao(c)); })
      .catch(() => { avisar('Não foi possível abrir o editor.'); onFechar(); });
  }, [perfil.avatar, avisar, onFechar]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Portal no <body>: dentro da aba (que tem animação) o position:fixed ficaria preso a ela
  if (!cat || !av) return createPortal(<div className="gx-av"><p className="gx-jogo-aviso">Carregando…</p></div>, document.body);

  const mudar = (f: (a: AvatarConfig) => AvatarConfig) => setAv(f(av));

  async function salvar() {
    if (!av) return;
    setSalvando(true);
    try {
      onSalvo(await servico.salvarAvatar(perfil.id, av));
      avisar('Personagem salvo! Ele aparece nos jogos.');
      onFechar();
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  const realistas = cat.paletas.pele.filter((c) => c.tipo !== 'fantasia');
  const fantasia = cat.paletas.pele.filter((c) => c.tipo === 'fantasia');

  return createPortal(
    <div className="gx-av" role="dialog" aria-modal="true" aria-label="Criar personagem">
      <div className="gx-jogo-barra">
        <button className="gx-jogo-btn" type="button" onClick={onFechar} aria-label="Fechar sem salvar">✕</button>
        <strong>Seu personagem</strong>
        <span />
      </div>

      <div className="gx-av-corpo">
        <div className="gx-av-palco">
          <Previa avatar={av} cat={cat} tamanho={300} />
        </div>

        <div className="gx-av-painel">
            <div className="gx-filtro-jogos" role="tablist" aria-label="Partes do personagem">
              {ABAS.map(([id, nome]) => (
                <button key={id} type="button" role="tab" aria-selected={aba === id} className="gx-filtro gx-av-aba" onClick={() => setAba(id)}>{nome}</button>
              ))}
            </div>

            {aba === 'pele' && (
              <>
                <h4>Tom de pele</h4>
                <Cores cores={realistas} valor={av.body.skinTone} rotulo="Tom de pele" onEscolher={(id) => mudar((a) => ({ ...a, body: { ...a.body, skinTone: id } }))} />
                <h4>Cores fantasia</h4>
                <Cores cores={fantasia} valor={av.body.skinTone} rotulo="Cor fantasia" onEscolher={(id) => mudar((a) => ({ ...a, body: { ...a.body, skinTone: id } }))} />
                <h4>Corpo</h4>
                <Itens itens={cat.corpos} valor={av.body.type} rotulo="Corpo" onEscolher={(id) => id && mudar((a) => ({ ...a, body: { ...a.body, type: id } }))} />
              </>
            )}
            {aba === 'cabelo' && (
              <>
                <h4>Estilo</h4>
                <Itens itens={cat.cabelos} valor={av.hair?.style} rotulo="Estilo de cabelo" nenhum="Sem cabelo"
                  onEscolher={(id) => mudar((a) => ({ ...a, hair: id ? { style: id, color: a.hair?.color ?? cat.paletas.cabelo[0]!.id } : null }))} />
                {av.hair && (
                  <>
                    <h4>Cor</h4>
                    <Cores cores={cat.paletas.cabelo} valor={av.hair.color} rotulo="Cor do cabelo" onEscolher={(id) => mudar((a) => ({ ...a, hair: { ...a.hair!, color: id } }))} />
                  </>
                )}
              </>
            )}
            {aba === 'rosto' && (
              <>
                <h4>Olhos</h4>
                <Itens itens={cat.olhos} valor={av.face.eyes} rotulo="Olhos" onEscolher={(id) => id && mudar((a) => ({ ...a, face: { ...a.face, eyes: id } }))} />
                <h4>Boca</h4>
                <Itens itens={cat.bocas} valor={av.face.mouth} rotulo="Boca" onEscolher={(id) => id && mudar((a) => ({ ...a, face: { ...a.face, mouth: id } }))} />
              </>
            )}
            {aba === 'roupa' && (
              <>
                <h4>Visual completo</h4>
                <Itens itens={cat.skins} valor={av.skinPreset} rotulo="Visual completo" nenhum="Montar peça por peça" onEscolher={(id) => mudar((a) => ({ ...a, skinPreset: id }))} />
                {!av.skinPreset && (
                  <>
                    <h4>Camiseta</h4>
                    <Itens itens={cat.camisetas} valor={av.top?.item} rotulo="Camiseta"
                      onEscolher={(id) => id && mudar((a) => ({ ...a, top: { item: id, primary: a.top?.primary ?? cat.paletas.roupa[0]!.id } }))} />
                    {av.top && <Cores cores={cat.paletas.roupa} valor={av.top.primary} rotulo="Cor da camiseta" onEscolher={(id) => mudar((a) => ({ ...a, top: { ...a.top!, primary: id } }))} />}
                    <h4>Calça</h4>
                    <Itens itens={cat.calcas} valor={av.bottom?.item} rotulo="Calça"
                      onEscolher={(id) => id && mudar((a) => ({ ...a, bottom: { item: id, primary: a.bottom?.primary ?? cat.paletas.roupa[4]!.id } }))} />
                    {av.bottom && <Cores cores={cat.paletas.roupa} valor={av.bottom.primary} rotulo="Cor da calça" onEscolher={(id) => mudar((a) => ({ ...a, bottom: { ...a.bottom!, primary: id } }))} />}
                    <h4>Calçado</h4>
                    <Itens itens={cat.calcados} valor={av.shoes?.item} rotulo="Calçado"
                      onEscolher={(id) => id && mudar((a) => ({ ...a, shoes: { item: id, primary: a.shoes?.primary ?? cat.paletas.roupa[2]!.id } }))} />
                  </>
                )}
              </>
            )}
            {aba === 'extras' && (
              <>
                <h4>Chapéu</h4>
                <Itens itens={cat.chapeus} valor={av.hat?.item} rotulo="Chapéu" nenhum="Nenhum"
                  onEscolher={(id) => mudar((a) => ({ ...a, hat: id ? { item: id, primary: a.hat?.primary ?? cat.paletas.roupa[4]!.id } : null }))} />
                {av.hat && av.hat.item !== 'capacete-tecnico' && (
                  <Cores cores={cat.paletas.roupa} valor={av.hat.primary} rotulo="Cor do chapéu" onEscolher={(id) => mudar((a) => ({ ...a, hat: { ...a.hat!, primary: id } }))} />
                )}
                {cat.acessorios.length > 0 && <h4>Acessórios (até 3)</h4>}
                <div className="gx-av-itens">
                  {cat.acessorios.map((i) => {
                    const on = av.accessories.includes(i.id);
                    return (
                      <button key={i.id} type="button" aria-pressed={on} className={'gx-av-item' + (on ? ' ativo' : '')}
                        disabled={!on && av.accessories.length >= 3}
                        onClick={() => mudar((a) => ({ ...a, accessories: on ? a.accessories.filter((x) => x !== i.id) : [...a.accessories, i.id] }))}>
                        {i.nome}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            {cat.provisorio && <p className="perfil-dica">Escolha Masculino ou Feminino na aba Pele e monte o seu personagem.</p>}
          </div>
      </div>

      <div className="gx-av-rodape">
        <button className="btn light" type="button" onClick={() => setAv(avatarPadrao(cat))}>Voltar ao padrão</button>
        <button className="btn" type="button" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar personagem'}</button>
      </div>
    </div>,
    document.body,
  );
}
