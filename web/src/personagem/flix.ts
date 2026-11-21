/**
 * Personagem Flix: arte própria da equipe (assets/personagem/fontes). Cada visual é um personagem completo, já com
 * o cabelo no corpo, padronizado por scripts/personagem/montar.py (mesmo tamanho, olhos no mesmo ponto).
 * O perfil guarda só o corpo e o visual escolhidos.
 */

export interface PersonagemFlix {
  v: 4;
  motor: 'flix';
  corpo: string;
  visual: string;
  /** tom de pele (id do catálogo); ausente = tom padrão, a arte original */
  pele?: string;
}

interface Corpo { id: string; nome: string; padrao: string }
interface Visual { id: string; nome: string; corpo: string; categoria?: string; foto?: string; rosto?: [number, number, number]; peles?: string[] }
export interface TomDePele { id: string; nome: string; cor: string }
interface Categoria { id: string; nome: string }
export interface Catalogo {
  v: 2;
  versao: string;
  tamanho: [number, number];
  olhos: [number, number];
  corpos: Corpo[];
  categorias?: Categoria[];
  peles?: { padrao: string; tons: TomDePele[] } | null;
  visuais: Visual[];
}

const BASE = '/personagem/';
let catalogo: Promise<Catalogo> | null = null;
let versao = '';
const imagens = new Map<string, Promise<HTMLImageElement | null>>();

export function carregarCatalogo(): Promise<Catalogo> {
  catalogo ??= fetch(BASE + 'catalogo.json', { cache: 'no-cache' }).then((r) => {
    if (!r.ok) throw new Error('Catálogo do personagem indisponível.');
    return r.json() as Promise<Catalogo>;
  }).then((c) => { versao = c.versao; return c; });
  catalogo.catch(() => { catalogo = null; });
  return catalogo;
}

function imagem(nome: string): Promise<HTMLImageElement | null> {
  let p = imagens.get(nome);
  if (!p) {
    p = new Promise((ok) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => ok(null);
      i.src = `${BASE}${nome}?v=${encodeURIComponent(versao)}`;
    });
    imagens.set(nome, p);
  }
  return p;
}

/** Visuais da aba do corpo (femininos no feminino, masculinos no masculino), fora das categorias especiais. */
export function visuaisDoCorpo(cat: Catalogo, corpo: string): Visual[] {
  return cat.visuais.filter((v) => v.corpo === corpo && !v.categoria);
}

/** Visuais de uma categoria especial (ex.: Desenvolvedores), de qualquer corpo. */
export function visuaisDaCategoria(cat: Catalogo, categoria: string): Visual[] {
  return cat.visuais.filter((v) => v.categoria === categoria);
}

/** Aba em que o personagem aparece: a categoria do visual, se tiver; senão, o corpo. */
export function abaDe(cat: Catalogo, p: PersonagemFlix): string {
  return cat.visuais.find((v) => v.id === p.visual && v.corpo === p.corpo)?.categoria ?? p.corpo;
}

export function padrao(cat: Catalogo, corpo = cat.corpos[0]!.id): PersonagemFlix {
  const c = cat.corpos.find((x) => x.id === corpo) ?? cat.corpos[0]!;
  return { v: 4, motor: 'flix', corpo: c.id, visual: c.padrao };
}

/** Personagem salvo num formato antigo (LPC, camadas): não serve, a pessoa escolhe de novo. */
export function ehPersonagemFlix(p: unknown): p is PersonagemFlix {
  return !!p && typeof p === 'object' && (p as { motor?: unknown }).motor === 'flix' && (p as { v?: unknown }).v === 4;
}

/** Visual do personagem (ou undefined se saiu do catálogo). */
export function visualDe(cat: Catalogo, p: PersonagemFlix): Visual | undefined {
  return cat.visuais.find((x) => x.id === p.visual && x.corpo === p.corpo);
}

/** Endereço da foto (personagem secreto, nítido, sem pixel art). */
export function urlDaFoto(v: Visual): string | null {
  return v.foto ? `${BASE}${v.foto}?v=${encodeURIComponent(versao)}` : null;
}

/** O visual tem esse tom de pele? (o padrão, todo visual tem; os outros, só quem tem a arte daquele tom) */
export function temTom(cat: Catalogo, v: Visual | undefined, tom: string | undefined): boolean {
  return !tom || tom === cat.peles?.padrao || !!v?.peles?.includes(tom);
}

/** Desenha o personagem no tamanho original do catálogo (1 pixel da arte = 1 pixel), fundo transparente. */
export async function desenhar(ctx: CanvasRenderingContext2D, p: PersonagemFlix, cat: Catalogo): Promise<void> {
  const v = cat.visuais.find((x) => x.id === p.visual && x.corpo === p.corpo);
  // tom sem arte para este visual: mostra o padrão
  const tom = p.pele && p.pele !== cat.peles?.padrao && v?.peles?.includes(p.pele) ? `-${p.pele}` : '';
  const img = await imagem(`${v?.id ?? 'careca'}-${v?.corpo ?? p.corpo}${tom}.png`);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.imageSmoothingEnabled = false;
  if (img) ctx.drawImage(img, 0, 0);
}

/**
 * Enquadramentos da foto do personagem: `rosto` (só a cabeça, quadrada, para ícones pequenos como o botão de perfil)
 * e `busto` (do peito para cima, retrato 3x4, para a ficha do jogador no Início).
 */
export type Enquadre = 'rosto' | 'busto';

const QUEIXO_PX = 13; // o queixo fica ~13 px abaixo dos olhos em todos os personagens
const PEITO_PX = 28; // o meio do peito fica ~28 px abaixo dos olhos: o busto mostra os ombros inteiros
const MIN_BUSTO_L = 44; // largura mínima do 3x4, em pixels da arte (careca não fica com o rosto colado na borda)

const fotos = new Map<string, Promise<string | null>>();
/** Foto do rosto (data URL) para ícones pequenos, como o botão de perfil. Com cache por personagem. */
export function fotoDoRosto(p: PersonagemFlix): Promise<string | null> {
  return foto(p, 'rosto');
}
/** Foto 3x4 do peito para cima (data URL), para a ficha do jogador no Início. Com cache por personagem. */
export function fotoDoBusto(p: PersonagemFlix): Promise<string | null> {
  return foto(p, 'busto');
}

function foto(p: PersonagemFlix, enquadre: Enquadre): Promise<string | null> {
  const chave = enquadre + JSON.stringify(p);
  let f = fotos.get(chave);
  if (!f) {
    f = carregarCatalogo().then(async (cat) => {
      const v = visualDe(cat, p);
      if (v?.foto && v.rosto) {
        // Secreto: recorte na foto, com suavização (é foto, não pixel art). O busto desce e abre o quadro.
        const img = await imagem(v.foto);
        if (!img) return null;
        const [cx, cy, l] = v.rosto;
        const lado = l * img.width;
        const out = document.createElement('canvas');
        if (enquadre === 'busto') {
          // 3x4: desce e abre o quadro a partir do rosto
          const w = lado * 1.5, h = (w * 4) / 3;
          out.width = 240; out.height = 320;
          out.getContext('2d')!.drawImage(img, cx * img.width - w / 2, cy * img.height - h * 0.35, w, h, 0, 0, 240, 320);
        } else {
          out.width = out.height = 160;
          out.getContext('2d')!.drawImage(img, cx * img.width - lado / 2, cy * img.height - lado / 2, lado, lado, 0, 0, 160, 160);
        }
        return out.toDataURL('image/jpeg', 0.9);
      }
      const tela = document.createElement('canvas');
      [tela.width, tela.height] = cat.tamanho;
      const ctx = tela.getContext('2d', { willReadFrequently: true })!;
      await desenhar(ctx, p, cat);
      // Acha o topo real da cabeça (com o cabelo) acima dos olhos: cabelo alto (black power, coque) pede um quadro
      // maior; careca, um menor.
      const [ox, oy] = cat.olhos;
      const faixa = ctx.getImageData(Math.round(ox - 30), 0, 60, Math.round(oy)).data;
      let topo = Math.round(oy) - 14;
      for (let yy = 0; yy < oy; yy++) {
        let cheio = 0;
        for (let xx = 0; xx < 60; xx++) if (faixa[(yy * 60 + xx) * 4 + 3]! > 0) cheio++;
        if (cheio >= 3) { topo = yy; break; }
      }
      let w: number;
      let h: number;
      let y: number;
      if (enquadre === 'busto') {
        // 3x4 do topo da cabeça (com 3 px de folga) até o meio do peito, corte rente à borda de baixo. Cabelo muito
        // largo (black power) pode passar das laterais, como numa foto 3x4 de verdade.
        const base = Math.round(oy + PEITO_PX);
        w = Math.max(MIN_BUSTO_L, Math.round(((base - (topo - 3)) * 3) / 4));
        h = Math.round((w * 4) / 3);
        y = base - h;
      } else {
        // Cabeça inteira centralizada no quadrado
        const queixo = oy + QUEIXO_PX;
        w = h = Math.max(40, Math.round((queixo - topo) * 1.25));
        y = Math.round((topo + queixo) / 2 - h / 2);
      }
      const x = Math.round(ox - w / 2);
      // Ampliação inteira (1 pixel da arte = n pixels), sem suavizar: nítido em tela Retina
      const n = enquadre === 'busto' ? Math.max(2, Math.ceil(320 / h)) : 2;
      const out = document.createElement('canvas');
      out.width = w * n;
      out.height = h * n;
      const o = out.getContext('2d')!;
      o.imageSmoothingEnabled = false;
      o.drawImage(tela, x, y, w, h, 0, 0, w * n, h * n);
      return out.toDataURL('image/png');
    }).catch(() => null);
    fotos.set(chave, f);
  }
  return f;
}
