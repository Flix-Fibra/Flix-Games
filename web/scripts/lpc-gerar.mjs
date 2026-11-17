// Gera o catálogo do Universal LPC (5 módulos *-metadata.js) chamando o GERADOR ORIGINAL do projeto
// (web/lpc/scripts/generate_sources.ts, GPL-3.0). Saída em web/lpc-gerado/ (não versionada).
// Também gera api/app/lpc_permitidos.json: peças liberadas pela regra de licença do portal, para a API validar.
// Uso: node scripts/lpc-gerar.mjs   (Node 22.19+ ou 24, que executam .ts direto)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// mesma regra do editor (src/lpc/motor.ts): categorias e cores de pele fora do perfil
const FORA = JSON.parse(readFileSync(path.join(web, 'src', 'lpc', 'fora-do-perfil.json'), 'utf8'));
const categoriaLiberada = (caminho) => { const p = caminho.join('/'); return !FORA.categorias.some((f) => p === f || p.startsWith(f + '/')); };
const lpc = path.join(web, 'lpc');
const saida = path.join(web, 'lpc-gerado');

if (!existsSync(path.join(lpc, 'sheet_definitions'))) {
  console.error('Submódulo do LPC ausente. Rode: git submodule update --init --depth 1 web/lpc');
  process.exit(1);
}
mkdirSync(saida, { recursive: true });
const commitLpc = execFileSync('git', ['-C', lpc, 'rev-parse', 'HEAD']).toString().trim();

// O gerador lê sheet_definitions/ e palette_definitions/ a partir da pasta atual
process.chdir(lpc);
const { generateSources } = await import(pathToFileURL(path.join(lpc, 'scripts', 'generate_sources.ts')).href);
generateSources({
  env: 'production',
  writeMetadata: true,
  writeCredits: false, // o CREDITS.csv original do LPC fica intacto
  metadataOutputPath: path.join(saida, 'item-metadata.js'),
});
console.log('Catálogo LPC gerado em', path.relative(web, saida));

// ---------- Peças PERMITIDAS (a API valida o que o navegador envia) ----------
// Regra do portal: nas imagens REALMENTE usadas (por tipo de corpo e variação), todas precisam ter ao menos
// uma licença sem "compartilhar igual": CC0, OGA-BY (qualquer versão) ou CC-BY (sem -SA).
// Fora: CC-BY-SA, OGA-SA, GPL; e a subcategoria de ferimentos (wounds).
const licencaPermitida = (l) => {
  const s = l.trim().toUpperCase();
  return s.startsWith('CC0') || s.startsWith('OGA-BY') || (s.startsWith('CC-BY') && !s.startsWith('CC-BY-SA'));
};
const importar = (rel) => import(pathToFileURL(path.join(lpc, 'sources', rel)).href);
const { createCatalog } = await importar('state/catalog.ts');
// Créditos das imagens usadas: função original do LPC, a mesma que gera a lista de créditos do editor
const { getAllCredits } = await importar('utils/credits.ts');
const modulo = (n) => import(pathToFileURL(path.join(saida, `${n}-metadata.js`)).href);
const [ind, pal, ite, cre, cam] = await Promise.all(['index', 'palette', 'item', 'credits', 'layers'].map(modulo));
const { reader, writer } = createCatalog();
writer.registerIndexMetadata({ aliasMetadata: ind.aliasMetadata, categoryTree: ind.categoryTree, metadataIndexes: ind.metadataIndexes });
writer.registerPaletteMetadata(pal.paletteMetadata);
writer.registerItemMetadata(ite.itemMetadata);
writer.registerCreditsMetadata(cre.itemCredits);
writer.registerLayersMetadata(cam.itemLayers);

const CORPOS = ['male', 'female', 'teen', 'muscular'];
const itens = {};
let fora = 0;
for (const id of Object.keys(ite.itemMetadata)) {
  const meta = reader.getItemMerged(id).unwrapOr(null);
  if (!meta || !categoriaLiberada(meta.path ?? [])) { fora++; continue; }
  const r = (meta.recolors ?? []).map((rc, i) => ({ g: i === 0 ? meta.type_name : (rc.type_name ?? meta.type_name), c: (rc.variants ?? []).filter((c) => !c.includes('.') && !((rc.variants ?? []).includes('zombie') && FORA.coresDePeleFora.includes(c))) }));
  const variacoes = meta.variants?.length ? meta.variants : [''];
  // b: por tipo de corpo, as variações em que todas as imagens usadas têm licença permitida
  const b = {};
  for (const corpo of CORPOS) {
    const ok = variacoes.filter((variante) => {
      const sel = { [meta.type_name]: { itemId: id, name: '', variant: variante || null, recolor: r[0]?.c?.[0] ?? null } };
      const creditos = getAllCredits(reader, sel, corpo);
      return creditos.length > 0 && creditos.every((c) => (c.licenses ?? []).some(licencaPermitida));
    });
    if (ok.length) b[corpo] = ok;
  }
  if (!Object.keys(b).length) { fora++; continue; }
  itens[id] = { t: meta.type_name, v: meta.variants ?? [], r, b };
}
const destino = path.resolve(web, '..', 'api', 'app', 'lpc_permitidos.json');
writeFileSync(destino, JSON.stringify({
  commit_lpc: commitLpc,
  regra: 'por tipo de corpo e variação: todas as imagens usadas com CC0, OGA-BY ou CC-BY (sem -SA)',
  itens,
}));
console.log(`Peças permitidas: ${Object.keys(itens).length} (fora: ${fora}) -> ${path.relative(web, destino)}`);
