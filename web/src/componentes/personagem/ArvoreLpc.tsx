import { useEffect, useRef } from 'react';
import type {
  ItemWithRecolorsModel, ItemWithVariantsModel, PaletteTileModel, RecolorPaletteOptionModel, TreeItemModel, TreeNodeModel, VariantItemModel,
} from '@lpc/category-tree';
import { atualizar, itemPermitido } from '../../lpc/motor';
import { pt } from '../../lpc/traducao';

/** Executa a ação original do LPC e avisa o React (no LPC, quem redesenha é o Mithril). */
const acao = (f: () => unknown) => () => { f(); atualizar(); };

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
            <button key={v.key} type="button" className={'lpc-op' + (v.isSelected ? ' ativo' : '')} aria-pressed={v.isSelected} title={pt(v.label)} onClick={acao(() => v.select())}>
              <Miniatura v={v} /><span>{pt(v.label)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Peca({ t }: { t: PaletteTileModel }) {
  return (
    <button type="button" className={'lpc-cor' + (t.isSelected ? ' ativo' : '')} aria-pressed={t.isSelected} title={pt(t.label)} onClick={acao(() => t.select())}>
      <span style={{ background: `linear-gradient(90deg, ${t.colors.slice(0, 6).join(', ')})` }} />
    </button>
  );
}

function Paleta({ op }: { op: RecolorPaletteOptionModel }) {
  const modal = op.createModalModel();
  if ('loadingMessage' in modal) return <p className="perfil-dica">Carregando cores…</p>;
  return (
    <div className="lpc-paleta">
      {op.label && <h5>{pt(op.label)}</h5>}
      {modal.versions.map((ver) => (
        <div key={ver.key}>
          <button type="button" className={'lpc-sub' + (ver.isExpanded ? ' aberto' : '')} onClick={acao(() => ver.toggle())}>{pt(ver.label)}</button>
          {ver.isExpanded && <div className="lpc-cores">{ver.tiles.map((t) => <Peca key={t.key} t={t} />)}</div>}
        </div>
      ))}
    </div>
  );
}

function ComCores({ criar }: { criar: () => ItemWithRecolorsModel }) {
  const m = criar();
  const tela = useRef<HTMLCanvasElement>(null);
  useEffect(() => { if (tela.current) void m.drawPreview(tela.current).catch(() => {}); }); // atualiza a miniatura a cada mudança
  return (
    <div className="lpc-item">
      <button type="button" className={'lpc-cab com-mini' + (m.isExpanded ? ' aberto' : '') + (m.isSelected ? ' escolhido' : '')} onClick={acao(() => m.toggle())}>
        <canvas ref={tela} width={64} height={64} className="lpc-mini" />{pt(m.name)}
      </button>
      {m.isExpanded && (m.paletteReady ? m.paletteOptions.map((op, i) => <Paleta key={i} op={op} />) : <p className="perfil-dica">Carregando cores…</p>)}
    </div>
  );
}

function Item({ it }: { it: TreeItemModel }) {
  if (it.kind === 'skeleton') return null;
  const id = it.key;
  if (!itemPermitido(id)) return null;
  if (it.kind === 'simple') {
    return <button type="button" className={'lpc-op texto' + (it.isSelected ? ' ativo' : '')} aria-pressed={it.isSelected} onClick={acao(() => it.select())}>{pt(it.name)}</button>;
  }
  if (it.kind === 'variants') return <ComVariacoes id={id} criar={it.createModel} />;
  return <ComCores criar={it.createModel} />;
}

/** Um nó da árvore de categorias do LPC (com subcategorias recolhíveis). */
export function NoLpc({ no, nivel = 0 }: { no: TreeNodeModel; nivel?: number }) {
  if (no.name.toLowerCase() === 'wounds') return null; // ferimentos: fora do portal
  const filhos = no.children.map((c) => ({ key: c.key, m: c.createModel() })).filter((c) => c.m);
  const conteudo = (
    <>
      {no.items.map((it) => <Item key={it.key} it={it} />)}
      {filhos.map((c) => <NoLpc key={c.key} no={c.m!} nivel={nivel + 1} />)}
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
