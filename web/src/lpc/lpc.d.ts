/**
 * Tipos (só os que o portal usa) dos módulos do Universal LPC em web/lpc/sources.
 * O código do LPC é escrito para TypeScript 7 e regras próprias; para não editá-lo, o portal importa
 * por apelidos `@lpc/*` (vite.config.ts aponta para os arquivos reais) e o TypeScript enxerga só isto.
 * Ao atualizar o submódulo, conferir se as assinaturas abaixo continuam iguais às do LPC.
 */

declare module '@lpc/resultado' {
  /** Subconjunto do `Result` do neverthrow usado pelo LPC. */
  export interface Resultado<T> {
    isOk(): boolean;
    isErr(): boolean;
    unwrapOr<D>(padrao: D): T | D;
  }
}

declare module '@lpc/catalog' {
  import type { Resultado } from '@lpc/resultado';
  export type Credit = { file: string; notes?: string; authors: string[]; licenses: string[]; urls: string[] };
  export type PaletteRecolor = { label?: string; type_name?: string; variants?: string[]; matchBodyColor?: boolean };
  export type ItemMerged = {
    name: string;
    type_name: string;
    path: string[];
    variants: string[];
    recolors: PaletteRecolor[];
    credits: Credit[];
    required?: string[];
    animations?: string[];
    matchBodyColor?: boolean;
  };
  export type CategoryTreeNode = { items?: string[]; children?: Record<string, CategoryTreeNode>; label?: string };
  export type CatalogReady = {
    readonly onIndexReady: Promise<void>;
    readonly onLiteReady: Promise<void>;
    readonly onCreditsReady: Promise<void>;
    readonly onPaletteReady: Promise<void>;
    readonly onLayersReady: Promise<void>;
    readonly onAllReady: Promise<void>;
  };
  export type CatalogReader = {
    getItemMerged(id: string): Resultado<ItemMerged>;
    getItemCredits(id: string): Resultado<Credit[]>;
    getCategoryTree(): Resultado<CategoryTreeNode>;
    isLiteReady(): boolean;
    isCreditsReady(): boolean;
    isPaletteReady(): boolean;
    isLayersReady(): boolean;
    readonly ready: CatalogReady;
  };
}

declare module '@lpc/state' {
  import type { CatalogReader } from '@lpc/catalog';
  export type Selection = { itemId: string; name: string; subId?: number | null; variant?: string | null; recolor?: string | null };
  export type Selections = Record<string, Selection>;
  export type State = {
    selections: Selections;
    bodyType: string;
    selectedAnimation: string;
    expandedNodes: Record<string, boolean>;
    searchQuery: string;
    matchBodyColorEnabled: boolean;
    compactDisplay: boolean;
    previewBootstrapRenderDone: boolean;
    isRenderingCharacter: boolean;
    enabledLicenses: Record<string, boolean>;
    enabledAnimations: Record<string, boolean>;
  };
  export function createState(): State;
  export function configureStateCatalog(catalog: CatalogReader): void;
  export function setStateDeps(overrides: {
    redraw?: () => void;
    syncSelectionsToHash?: (state: State) => void;
    loadSelectionsFromHash?: (state: State) => void;
  }): void;
  export function selectDefaults(state: State): Promise<void>;
  export function resetAll(state: State): Promise<void>;
  export function selectItem(state: State, itemId: string, variant: string, isSelected?: boolean, subId?: number | null): void;
  export function getSelectionGroup(itemId: string): string;
}

declare module '@lpc/install-item-metadata' {
  import type { CatalogReader } from '@lpc/catalog';
  export function createLoadedCatalog(): CatalogReader;
}

declare module '@lpc/performance-profiler' {
  export class PerformanceProfiler {
    constructor(options?: { enabled?: boolean; verbose?: boolean; logSlowOperations?: boolean });
  }
}

declare module '@lpc/renderer' {
  import type { CatalogReader } from '@lpc/catalog';
  import type { Selections, State } from '@lpc/state';
  export const SHEET_WIDTH: number;
  export const SHEET_HEIGHT: number;
  export let canvas: HTMLCanvasElement | null;
  export function initCanvas(): void;
  export function renderCharacter(catalog: CatalogReader, state: State, selections: Selections, bodyType: string, targetCanvas?: HTMLCanvasElement | null): Promise<void>;
}

declare module '@lpc/filters' {
  import type { CatalogReader } from '@lpc/catalog';
  import type { State } from '@lpc/state';
  export function isItemLicenseCompatible(catalog: CatalogReader, state: State, itemId: string): boolean;
}

declare module '@lpc/category-tree' {
  import type { CatalogReader } from '@lpc/catalog';
  import type { State } from '@lpc/state';
  export type PaletteTileModel = {
    readonly key: string;
    readonly label: string;
    readonly colors: readonly string[];
    readonly isSelected: boolean;
    select(): void;
    draw(canvas: HTMLCanvasElement, isCancelled: () => boolean): Promise<number>;
  };
  export type PaletteVersionModel = { readonly key: string; readonly label: string; readonly isExpanded: boolean; readonly tiles: readonly PaletteTileModel[]; toggle(): void };
  export type PaletteSelectModalModel = { readonly loadingMessage: string } | { readonly title: string; readonly size: number; readonly versions: readonly PaletteVersionModel[] };
  export type RecolorPaletteOptionModel = { readonly label?: string; readonly colors?: string[] | null; prepareSelection(): void; readonly createModalModel: () => PaletteSelectModalModel };
  export type VariantItemModel = {
    readonly key: string;
    readonly label: string;
    readonly isSelected: boolean;
    readonly isCompatible: boolean;
    readonly size: number;
    select(): void;
    loadPreview(canvas: HTMLCanvasElement): Promise<{ redraw: (size: number) => void; imagesLoaded: number }>;
  };
  export type ItemWithVariantsModel = { readonly name: string; readonly isCompatible: boolean; readonly isExpanded: boolean; readonly variants: readonly VariantItemModel[]; toggle(): number };
  export type ItemWithRecolorsModel = {
    readonly name: string;
    readonly isCompatible: boolean;
    readonly isExpanded: boolean;
    readonly isSelected: boolean;
    readonly paletteReady: boolean;
    readonly paletteOptions: readonly RecolorPaletteOptionModel[];
    toggle(): void;
    drawPreview(canvas: HTMLCanvasElement, colors?: Record<string, string>, isCancelled?: () => boolean): Promise<number>;
  };
  export type TreeItemModel =
    | { readonly kind: 'skeleton'; readonly key: string }
    | { readonly kind: 'simple'; readonly key: string; readonly name: string; readonly isCompatible: boolean; readonly isSelected: boolean; select(): void }
    | { readonly kind: 'variants'; readonly key: string; readonly createModel: () => ItemWithVariantsModel }
    | { readonly kind: 'recolors'; readonly key: string; readonly createModel: () => ItemWithRecolorsModel };
  export type TreeNodeModel = {
    readonly name: string;
    readonly title?: string;
    readonly isCompatible: boolean;
    readonly isExpanded: boolean;
    readonly children: readonly { readonly key: string; readonly createModel: () => TreeNodeModel | null }[];
    readonly items: readonly TreeItemModel[];
    toggle(): void;
  };
  export type CategoryTreeModel =
    | { readonly isLoading: true }
    | {
        readonly isLoading: false;
        readonly liteReady: boolean;
        readonly roots: readonly { readonly key: string; readonly createModel: () => TreeNodeModel | null }[];
        reset(): void;
      };
  export const categoryTreeModelFactory: { create(catalog: CatalogReader, state: State): CategoryTreeModel };
}

declare module '@lpc/credits-utils' {
  import type { CatalogReader, Credit } from '@lpc/catalog';
  import type { Selections } from '@lpc/state';
  export type CreditWithFileName = Credit & { fileName: string };
  export function getAllCredits(catalog: CatalogReader, selections: Selections, bodyType: string, selectedAnimation?: string): CreditWithFileName[];
  export function creditsToTxt(all: CreditWithFileName[]): string;
  export function creditsToCsv(all: CreditWithFileName[]): string;
}
