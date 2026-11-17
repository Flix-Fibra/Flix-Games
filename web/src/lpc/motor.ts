/**
 * Ponte entre o Universal LPC (web/lpc, GPL-3.0) e o React.
 * Reaproveita o núcleo original — catálogo, estado, seleção, renderizador em canvas e recolor —
 * repetindo a inicialização de lpc/sources/main.ts, sem a interface Mithril.
 *
 * Este arquivo, como todo o portal web/, é distribuído sob GPL-3.0 (ver web/LICENSE).
 */
import { createLoadedCatalog } from '@lpc/install-item-metadata';
import { PerformanceProfiler } from '@lpc/performance-profiler';
import * as renderer from '@lpc/renderer';
import { configureStateCatalog, createState, getSelectionGroup, resetAll, selectDefaults, selectItem, setStateDeps, type Selections, type State } from '@lpc/state';
import { isItemLicenseCompatible } from '@lpc/filters';
import { creditsToTxt, getAllCredits } from '@lpc/credits-utils';
import type { CatalogReader, CategoryTreeNode } from '@lpc/catalog';
import FORA from './fora-do-perfil.json';

/** Categoria liberada no editor (fora: chapéus, objetos, armas e partes de fantasia; ver fora-do-perfil.json). */
export function categoriaLiberada(caminho: readonly string[]): boolean {
  const p = caminho.join('/');
  return !FORA.categorias.some((f) => p === f || p.startsWith(f + '/'));
}

/** Cor de paleta liberada: tira os tons de pele de fantasia (verde, azul, zumbi, pelo). */
export const corLiberada = (nome: string) => !FORA.coresDePeleFora.includes(nome.toLowerCase().replace(/\s+/g, '_'));

/** Remove do personagem as peças de categorias fora do editor (ex.: personagem salvo antes da mudança). */
function limpar(selecoes: Selections): Selections {
  const { catalogo } = obterMotor();
  return Object.fromEntries(Object.entries(selecoes).filter(([, s]) => {
    const meta = s?.itemId ? catalogo.getItemMerged(s.itemId).unwrapOr(null) : null;
    return !meta || categoriaLiberada(meta.path);
  })) as Selections;
}

/** Licenças liberadas no editor: sem "compartilhar igual" (CC-BY-SA e GPL ficam de fora). */
export const LICENCAS_PERMITIDAS = ['CC0', 'OGA-BY', 'CC-BY'] as const;

/**
 * Corpos oferecidos (BODY_TYPES do LPC). Fora: "child" e "pregnant"; e "muscular", cujo corpo base
 * só existe em CC-BY-SA/GPL (ver lpc_permitidos.json).
 */
export const CORPOS = [
  { valor: 'male', nome: 'Masculino' },
  { valor: 'female', nome: 'Feminino' },
  { valor: 'teen', nome: 'Adolescente' },
] as const;

/** O que fica salvo no perfil: dá para reconstruir o personagem inteiro (não é uma imagem). */
export interface PersonagemLpc {
  v: 2;
  motor: 'lpc';
  bodyType: string;
  selections: Selections;
}

type Ouvinte = () => void;
const ouvintes = new Set<Ouvinte>();
let versao = 0;
let agendado = false;

/** O LPC chama `redraw` quando algo muda; aqui isso vira uma nova versão para o React. */
function avisar() {
  if (agendado) return;
  agendado = true;
  queueMicrotask(() => {
    agendado = false;
    versao++;
    ouvintes.forEach((f) => f());
  });
}

/** Ações do React que mudam o estado do LPC chamam isto para redesenhar. */
export const atualizar = () => avisar();
export const assinar = (f: Ouvinte) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; };
export const versaoAtual = () => versao;

let motor: { catalogo: CatalogReader; estado: State; pronto: Promise<void> } | null = null;

/** Inicializa uma única vez (catálogo carrega em partes; o canvas só depois do índice). */
export function obterMotor() {
  if (motor) return motor;
  // o renderizador do LPC registra medições em window.profiler (desligado aqui)
  (window as unknown as { profiler: PerformanceProfiler }).profiler = new PerformanceProfiler({ enabled: false, verbose: false, logSlowOperations: false });
  const catalogo = createLoadedCatalog();
  const estado = createState();
  configureStateCatalog(catalogo);
  // Sem URL do LPC: o portal tem a própria navegação (#inicio, #perfil...)
  setStateDeps({ redraw: avisar, syncSelectionsToHash: () => {}, loadSelectionsFromHash: () => {} });
  estado.enabledLicenses = Object.fromEntries(['CC0', 'CC-BY-SA', 'CC-BY', 'OGA-BY', 'GPL'].map((k) => [k, (LICENCAS_PERMITIDAS as readonly string[]).includes(k)]));
  estado.matchBodyColorEnabled = true;

  const pronto = (async () => {
    await Promise.all([catalogo.ready.onIndexReady, catalogo.ready.onLiteReady]);
    renderer.initCanvas();
    estado.previewBootstrapRenderDone = true;
    avisar();
  })();
  for (const etapa of [catalogo.ready.onCreditsReady, catalogo.ready.onPaletteReady, catalogo.ready.onLayersReady]) void etapa.then(avisar);
  motor = { catalogo, estado, pronto };
  return motor;
}

/** Carrega um personagem salvo (ou o padrão do LPC, se não houver). */
export async function carregar(p: PersonagemLpc | null) {
  const { estado, pronto } = obterMotor();
  await pronto;
  if (p && p.motor === 'lpc') {
    estado.bodyType = p.bodyType;
    estado.selections = limpar(JSON.parse(JSON.stringify(p.selections)) as Selections);
    avisar();
  } else {
    estado.selections = {};
    await selectDefaults(estado);
  }
}

export async function restaurarPadrao() {
  const { estado } = obterMotor();
  estado.bodyType = 'male';
  await resetAll(estado);
}

export function exportarConfig(): PersonagemLpc {
  const { estado } = obterMotor();
  return { v: 2, motor: 'lpc', bodyType: estado.bodyType, selections: limpar(JSON.parse(JSON.stringify(estado.selections)) as Selections) };
}

/** Desenha o personagem atual no canvas interno do LPC (spritesheet universal 832x3456). */
export async function desenhar(alvo?: HTMLCanvasElement) {
  const { catalogo, estado, pronto } = obterMotor();
  await pronto; // o canvas do LPC só existe depois de initCanvas()
  await renderer.renderCharacter(catalogo, estado, estado.selections, estado.bodyType, alvo ?? null);
}

/**
 * Desenha só se o personagem mudou (corpo, peças, cores ou etapa do catálogo). Abrir/fechar categorias
 * também avisa o React, mas não muda o desenho. Um desenho por vez, na ordem (o canvas do LPC é único).
 */
let ultimaChave = '';
let fila: Promise<void> = Promise.resolve();
export function desenharSeMudou(): Promise<void> {
  const { catalogo, estado } = obterMotor();
  // desenho parcial (sem camadas ou cores) seria refeito logo depois: espera o catálogo; a mudança de etapa avisa de novo
  if (!catalogo.isLayersReady() || !catalogo.isPaletteReady()) return fila;
  const chave = JSON.stringify([estado.bodyType, estado.selections]);
  if (chave !== ultimaChave) {
    ultimaChave = chave;
    fila = fila.catch(() => {}).then(() => desenhar());
  }
  return fila;
}

/** CC0, OGA-BY (qualquer versão) e CC-BY (sem -SA). Mesma regra de scripts/lpc-gerar.mjs e da API. */
export function licencaPermitida(l: string): boolean {
  const s = l.trim().toUpperCase();
  return s.startsWith('CC0') || s.startsWith('OGA-BY') || (s.startsWith('CC-BY') && !s.startsWith('CC-BY-SA'));
}

/**
 * Peça liberada no portal. Mais rígida que o filtro do LPC (que aceita se QUALQUER imagem tiver licença
 * permitida): aqui TODAS as imagens da peça precisam ter uma licença permitida, e o filtro do LPC
 * (licença + corpo/animação) também precisa aceitar. Ferimentos (wounds) ficam de fora.
 */
export function itemPermitido(itemId: string, variante?: string): boolean {
  const { catalogo, estado } = obterMotor();
  const meta = catalogo.getItemMerged(itemId).unwrapOr(null);
  if (!meta || !categoriaLiberada(meta.path)) return false;
  if (!isItemLicenseCompatible(catalogo, estado, itemId)) return false;
  // imagens realmente usadas por este corpo/variação (função original do LPC)
  const v = variante ?? meta.variants[0] ?? null;
  const sel = { [meta.type_name]: { itemId, name: '', variant: v || null, recolor: meta.recolors[0]?.variants?.[0] ?? null } };
  const creditos = getAllCredits(catalogo, sel, estado.bodyType);
  return creditos.length > 0 && creditos.every((c) => c.licenses.some(licencaPermitida));
}

/** Confere o personagem inteiro antes de salvar: devolve as peças com imagem fora da regra de licença. */
export function pecasBloqueadas(): string[] {
  const { catalogo, estado } = obterMotor();
  return getAllCredits(catalogo, estado.selections, estado.bodyType)
    .filter((c) => !c.licenses.some(licencaPermitida))
    .map((c) => c.fileName);
}

/** Créditos das imagens do personagem atual (autores, licenças e links), pela função original do LPC. */
export function creditosAtuais() {
  const { catalogo, estado } = obterMotor();
  return getAllCredits(catalogo, estado.selections, estado.bodyType);
}

export { creditsToTxt };

export { renderer };

// ---------- Personagem aleatório (o LPC não tem; usa o catálogo e o selectItem dele) ----------
const sortear = <T,>(lista: readonly T[]): T | undefined => lista[Math.floor(Math.random() * lista.length)];

/** Ids de peças de uma categoria do catálogo (ex.: ['hair'], ['torso', 'shirts']). */
function pecasDe(caminho: string[]): string[] {
  const { catalogo } = obterMotor();
  let no: CategoryTreeNode | undefined = catalogo.getCategoryTree().unwrapOr(undefined);
  for (const parte of caminho) no = no?.children?.[parte];
  const ids: string[] = [];
  const andar = (n: CategoryTreeNode | undefined) => { if (!n) return; ids.push(...(n.items ?? [])); Object.values(n.children ?? {}).forEach(andar); };
  andar(no);
  return ids.filter((id) => itemPermitido(id));
}

/** Escolhe a peça com uma variação ou cor sorteada (só entre as liberadas pela licença). */
function vestir(id: string) {
  const { catalogo, estado } = obterMotor();
  const meta = catalogo.getItemMerged(id).unwrapOr(null);
  if (!meta) return;
  if (meta.variants.length) {
    const v = sortear(meta.variants.filter((x) => itemPermitido(id, x)));
    if (v) selectItem(estado, id, v);
  } else {
    selectItem(estado, id, sortear((meta.recolors[0]?.variants ?? []).filter((c) => !c.includes('.'))) ?? '');
  }
}

export async function aleatorio() {
  const { catalogo, estado, pronto } = obterMotor();
  await pronto;
  estado.bodyType = sortear(CORPOS)!.valor;
  estado.selections = {};
  await selectDefaults(estado); // corpo, cabeça e expressão básicos do LPC
  // tom de pele: a cor do corpo; "combinar cor do corpo" leva a mesma cor para cabeça e orelhas
  // só tons de pele humanos (o LPC também tem cores de fantasia: verde, azul, zumbi...)
  const corPele = sortear((catalogo.getItemMerged('body').unwrapOr(null)?.recolors[0]?.variants ?? []).filter(corLiberada));
  if (corPele) selectItem(estado, 'body', corPele);
  const cabeca = estado.bodyType === 'female' ? 'heads_human_female' : 'heads_human_male';
  if (itemPermitido(cabeca)) selectItem(estado, cabeca, corPele ?? 'light');
  for (const caminho of [['hair'], ['torso', 'shirts'], ['legs', 'pants'], ['feet', 'shoes']]) {
    const id = sortear(pecasDe(caminho).filter((x) => !/beard|mustache/.test(x)));
    if (id) vestir(id);
  }
  avisar();
}

// ---------- Uma peça por área ----------
// No LPC, extensões de cabelo, camisa, jaqueta e armadura são camadas diferentes e se empilham.
// No portal, escolher uma peça de uma área tira a anterior da mesma área.
const AREAS: string[][] = [
  ['hair/afro', 'hair/curly', 'hair/bald', 'hair/short', 'hair/spiky', 'hair/pigtails', 'hair/bob', 'hair/braids', 'hair/long', 'hair/xlong', 'hair/extensions'],
  ['torso/dresses', 'torso/shirts', 'torso/jacket', 'torso/vest', 'torso/armour', 'torso/torso_chainmail', 'torso/torso_bandages'],
  ['legs'],
  ['feet/shoes', 'feet/boots', 'feet/feet_armour', 'feet/feet_slippers', 'feet/feet_sandals'],
];
const naArea = (caminho: readonly string[], area: string[]) => {
  const p = caminho.join('/');
  return area.some((a) => p === a || p.startsWith(a + '/'));
};

/** Depois de escolher `itemId`, tira as outras peças da mesma área (cabelo, parte de cima, de baixo, calçado). */
export function umaPorArea(itemId: string) {
  const { catalogo, estado } = obterMotor();
  const meta = catalogo.getItemMerged(itemId).unwrapOr(null);
  const area = meta && AREAS.find((a) => naArea(meta.path, a));
  if (!area) return;
  for (const [grupo, s] of Object.entries(estado.selections)) {
    if (!s?.itemId || s.itemId === itemId) continue;
    const outra = catalogo.getItemMerged(s.itemId).unwrapOr(null);
    if (outra && naArea(outra.path, area)) delete estado.selections[grupo];
  }
}

/** Grupo de seleção de uma peça (para saber se já está escolhida). */
export const grupoDe = (id: string) => getSelectionGroup(id);
