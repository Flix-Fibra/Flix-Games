import { useEffect, useRef } from 'react';
import type {
  ItemWithRecolorsModel, ItemWithVariantsModel, PaletteTileModel, RecolorPaletteOptionModel, TreeItemModel, TreeNodeModel, VariantItemModel,
} from '@lpc/category-tree';
import { atualizar, categoriaLiberada, corLiberada, itemPermitido, obterMotor, umaPorArea } from '../../lpc/motor';
import { pt } from '../../lpc/traducao';

/** Executa a ação original do LPC e avisa o React (no LPC, quem redesenha é o Mithril). */
const acao = (f: () => unknown) => () => { f(); atualizar(); };
/** Escolher uma peça: ação do LPC + tirar a peça anterior da mesma área. */
const escolher = (id: string, f: () => unknown) => () => { f(); umaPorArea(id); atualizar(); };

/**
 * Renderiza os MODELOS do LPC (models/category-tree.ts, item-with-variants.ts, item-with-recolors.ts,
 * palette-select-modal.ts) em React. As ações (select, toggle) são as originais do LPC.
 * Peças fora da regra de licença do portal não aparecem (itemPermitido).
 */

const traduzir = (s: string) => NOMES[s.toLowerCase()] ?? pt(s);
const NOMES: Record<string, string> = {
  heads: 'Cabeças', eyes: 'Olhos', eyebrows: 'Sobrancelhas', faces: 'Expressões', ears: 'Orelhas', nose: 'Nariz', appendages: 'Chifres e antenas',
  beards: 'Barbas', mustaches: 'Bigodes', extensions: 'Extensões', shirts: 'Camisas', dresses: 'Vestidos', jacket: 'Jaquetas', vest: 'Coletes',
  armour: 'Armaduras', cape: 'Capas', backpack: 'Mochilas', aprons: 'Aventais', waist: 'Cintura', pants: 'Calças', leggings: 'Leggings',
  shorts: 'Bermudas', skirts: 'Saias', shoes: 'Sapatos', boots: 'Botas', socks: 'Meias', accessory: 'Acessórios', hats: 'Chapéus',
  helmets: 'Capacetes', coverings: 'Lenços e capuzes', accessories: 'Acessórios', neck: 'Pescoço', wrists: 'Pulsos', shoulders: 'Ombros',
  shields: 'Escudos', ranged: 'À distância', sword: 'Espadas', blunt: 'Maças', polearm: 'Lanças', magic: 'Mágicos', special: 'Especiais',
  prostheses: 'Próteses', wings: 'Asas', tails: 'Caudas', lizard: 'Lagarto', furry_ears: 'Orelhas de bicho',
  afro: 'Afro', curly: 'Cacheados', 'bald / shaved': 'Careca / raspado', bald: 'Careca', short: 'Curtos', spiky: 'Espetados',
  pigtails: 'Marias-chiquinhas', bob: 'Chanel', 'braids, ponytails, updos': 'Tranças, rabos e coques', long: 'Longos', medium: 'Médios',
  'xlong': 'Muito longos', buns: 'Coques', mohawk: 'Moicano', bangs: 'Franjas', ponytail: 'Rabo de cavalo', tools: 'Ferramentas',
};

function Miniatura({ v }: { v: VariantItemModel }) {
  const tela = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!tela.current) return;
    v.loadPreview(tela.current).then(({ redraw }) => redraw(v.size)).catch(() => {});
  }, [v.key, v.size]); // eslint-disable-line react-hooks/exhaustive-deps
  return <canvas ref={tela} width={v.size} height={v.size} className="lpc-mini" />;
}

function ComVariacoes({ id, criar }: { id: string; criar: () => ItemWithVariantsModel }) {
  const m = criar();
  const variacoes = m.variants.filter((v) => v.isCompatible && itemPermitido(id, v.key));
  if (!variacoes.length) return null;
  return (
    <div className="lpc-item">
      <button type="button" className={'lpc-cab' + (m.isExpanded ? ' aberto' : '')} onClick={acao(() => m.toggle())}>{pt(m.name)}</button>
      {m.isExpanded && (
        <div className="lpc-grade">
          {variacoes.map((v) => (
            <button key={v.key} type="button" className={'lpc-op' + (v.isSelected ? ' ativo' : '')} aria-pressed={v.isSelected} title={pt(v.label)} onClick={escolher(id, () => v.select())}>
              <Miniatura v={v} /><span>{pt(v.label)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Peca({ id, t }: { id: string; t: PaletteTileModel }) {
  return (
    <button type="button" className={'lpc-cor' + (t.isSelected ? ' ativo' : '')} aria-pressed={t.isSelected} title={pt(t.label)} onClick={escolher(id, () => t.select())}>
      <span style={{ background: `linear-gradient(90deg, ${t.colors.slice(0, 6).join(', ')})` }} />
    </button>
  );
}

function Paleta({ id, op, varias }: { id: string; op: RecolorPaletteOptionModel; varias: boolean }) {
  let modal = op.createModalModel();
  if ('loadingMessage' in modal) return <p className="perfil-dica">Carregando cores…</p>;
  // O LPC só monta as cores das versões abertas: abre todas para achar a principal.
  if (modal.versions.some((v) => !v.isExpanded)) {
    const { estado } = obterMotor();
    modal.versions.forEach((v) => { estado.expandedNodes[v.key] = true; });
    modal = op.createModalModel();
    if ('loadingMessage' in modal) return <p className="perfil-dica">Carregando cores…</p>;
  }
  // Só a paleta principal (cores sem prefixo de versão, como "light"); "LPC revisado" e as outras ficam de fora.
  const ver = modal.versions.find((v) => v.tiles.length > 0 && v.tiles.every((t) => !t.key.includes('.') && t.key !== 'source')) ?? modal.versions[0];
  if (!ver) return null;
  return (
    <div className="lpc-paleta">
      <h5>{varias && op.label ? `Cor · ${pt(op.label)}` : 'Cor'}</h5>
      <div className="lpc-cores">{ver.tiles.filter((t) => !ver.key.includes('-body.') || corLiberada(t.label)).map((t) => <Peca key={t.key} id={id} t={t} />)}</div>
    </div>
  );
}

function ComCores({ id, criar }: { id: string; criar: () => ItemWithRecolorsModel }) {
  const m = criar();
  const tela = useRef<HTMLCanvasElement>(null);
  useEffect(() => { if (tela.current) void m.drawPreview(tela.current).catch(() => {}); }); // atualiza a miniatura a cada mudança
  return (
    <div className="lpc-item">
      <button type="button" className={'lpc-cab com-mini' + (m.isExpanded ? ' aberto' : '') + (m.isSelected ? ' escolhido' : '')} onClick={acao(() => m.toggle())}>
        <canvas ref={tela} width={64} height={64} className="lpc-mini" />{pt(m.name)}
      </button>
      {m.isExpanded && (m.paletteReady ? m.paletteOptions.map((op, i) => <Paleta key={i} id={id} op={op} varias={m.paletteOptions.length > 1} />) : <p className="perfil-dica">Carregando cores…</p>)}
    </div>
  );
}

function Item({ it }: { it: TreeItemModel }) {
  if (it.kind === 'skeleton') return null;
  const id = it.key;
  if (!itemPermitido(id)) return null;
  if (it.kind === 'simple') {
    return <button type="button" className={'lpc-op texto' + (it.isSelected ? ' ativo' : '')} aria-pressed={it.isSelected} onClick={escolher(id, () => it.select())}>{pt(it.name)}</button>;
  }
  if (it.kind === 'variants') return <ComVariacoes id={id} criar={it.createModel} />;
  return <ComCores id={id} criar={it.createModel} />;
}

/** Um nó da árvore de categorias do LPC (com subcategorias recolhíveis). */
export function NoLpc({ no, caminho, nivel = 0 }: { no: TreeNodeModel; caminho: string; nivel?: number }) {
  if (!categoriaLiberada(caminho.split('/'))) return null; // fantasia, ferimentos etc.: fora do portal
  const filhos = no.children.filter((c) => categoriaLiberada([...caminho.split('/'), c.key])).map((c) => ({ key: c.key, m: c.createModel() })).filter((c) => c.m);
  const conteudo = (
    <>
      {no.items.map((it) => <Item key={it.key} it={it} />)}
      {filhos.map((c) => <NoLpc key={c.key} no={c.m!} caminho={`${caminho}/${c.key}`} nivel={nivel + 1} />)}
    </>
  );
  if (nivel === 0) return <div className="lpc-no">{conteudo}</div>;
  return (
    <section className="lpc-no">
      <button type="button" className={'lpc-sub' + (no.isExpanded ? ' aberto' : '')} onClick={acao(() => no.toggle())}>{traduzir(no.name)}</button>
      {no.isExpanded && <div className="lpc-filhos">{conteudo}</div>}
    </section>
  );
}
