import Phaser from 'phaser';
import { renderHudText } from '@flix/game-kit/src/hudFont';

/**
 * Placar do Flix Grid no estilo enviado pelo solicitante (25/11/2026): caixas escuras com cantos chanfrados e letras
 * na fonte pixel da plataforma (packages/flix-game-kit). Cada caixa é um canvas desenhado no tamanho REAL da tela
 * (cada pixel da letra vira um quadrado inteiro de pixels), por isso as letras ficam nítidas em qualquer tela.
 * Só redesenha quando o conteúdo ou o tamanho da tela mudam.
 */

const FUNDO = 'rgba(16,18,23,0.92)';
const BORDA = 'rgba(255,255,255,0.10)';
const DIVISA = 'rgba(255,255,255,0.14)';
const CONTORNO = '#101217';
export const COR = { branco: '#F5F5F7', cinza: '#A3A8B2', amarelo: '#FFC83D', vermelho: '#D4142C', azul: '#7FCAFF' } as const;
/** Tamanhos da letra em "pixels da letra" numa tela de 540 de altura (escalam com a tela; arredondados para inteiro). */
const T = { rotulo: 1.15, nome: 2, valor: 2.6, tecla: 1.6 } as const;

const cache = new Map<string, HTMLCanvasElement>();
function letras(texto: string, cor: string): HTMLCanvasElement {
  const chave = cor + '|' + texto;
  let c = cache.get(chave);
  if (!c) {
    if (cache.size > 400) cache.clear(); // o tempo muda a cada quadro: não deixa o cache crescer sem limite
    c = renderHudText(texto, cor, CONTORNO);
    cache.set(chave, c);
  }
  return c;
}

/** Medidas de um texto já em pixels de tela. A célula da fonte tem 2 linhas de acento em cima e 1 de cedilha embaixo. */
interface Bloco { c: HTMLCanvasElement; p: number; w: number; h: number }
function bloco(texto: string, cor: string, p: number): Bloco {
  const c = letras(texto.toUpperCase(), cor); // só maiúsculas: as minúsculas da fonte pixel ficam estranhas
  return { c, p, w: (c.width + 1) * p, h: c.height * p };
}
/** Letra em negrito: pinta duas vezes, a segunda 1 pixel da fonte à direita (traço grosso, como no modelo). */
function pintar(g: CanvasRenderingContext2D, b: Bloco, x: number, y: number): void {
  const w = b.c.width * b.p;
  g.drawImage(b.c, Math.round(x), Math.round(y), w, b.h);
  g.drawImage(b.c, Math.round(x) + b.p, Math.round(y), w, b.h);
}

function caixa(g: CanvasRenderingContext2D, w: number, h: number, chanfro: number): void {
  g.beginPath();
  g.moveTo(chanfro, 0);
  g.lineTo(w - chanfro, 0);
  g.lineTo(w, chanfro);
  g.lineTo(w, h - chanfro);
  g.lineTo(w - chanfro, h);
  g.lineTo(chanfro, h);
  g.lineTo(0, h - chanfro);
  g.lineTo(0, chanfro);
  g.closePath();
  g.fillStyle = FUNDO;
  g.fill();
  g.strokeStyle = BORDA;
  g.lineWidth = 1;
  g.stroke();
}

/** Uma caixa do placar: imagem com textura própria (canvas), redesenhada só quando muda. */
export class CaixaHud {
  readonly img: Phaser.GameObjects.Image;
  private readonly tex: Phaser.Textures.CanvasTexture;
  private assinatura = '';

  constructor(scene: Phaser.Scene, chave: string) {
    if (scene.textures.exists(chave)) scene.textures.remove(chave);
    this.tex = scene.textures.createCanvas(chave, 4, 4)!;
    this.tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.img = scene.add.image(0, 0, chave);
  }

  /** `desenho` recebe o contexto já do tamanho pedido por `medir`. Nada acontece se a assinatura não mudou. */
  atualizar(assinatura: string, medir: () => { w: number; h: number; pintar: (g: CanvasRenderingContext2D) => void }): void {
    if (assinatura === this.assinatura) return;
    this.assinatura = assinatura;
    const { w, h, pintar: desenhar } = medir();
    const W = Math.max(4, Math.ceil(w)), H = Math.max(4, Math.ceil(h));
    if (this.tex.width !== W || this.tex.height !== H) this.tex.setSize(W, H);
    const g = this.tex.getContext();
    g.clearRect(0, 0, W, H);
    g.imageSmoothingEnabled = false;
    desenhar(g);
    this.tex.refresh();
    // a imagem guarda o tamanho antigo da textura: sem isto a origem (centro, direita, base) fica errada
    this.img.setSizeToFrame(this.tex.get()).setOrigin(this.img.originX, this.img.originY);
  }
}

const px = (k: number, n: number) => Math.max(1, Math.round(n * k));

/** Caixa de cima, à esquerda: pista, número da pista, volta e posição. */
export function caixaPista(cx: CaixaHud, k: number, d: { nome: string; pista: string; volta: string; posicao: string }): void {
  cx.atualizar(`${k}|${d.nome}|${d.pista}|${d.volta}|${d.posicao}`, () => {
    const pad = px(k, 9), barra = px(k, 4), gap = px(k, 22);
    const nome = bloco(d.nome.toUpperCase(), COR.branco, px(k, T.nome));
    const pista = bloco(d.pista.toUpperCase(), COR.cinza, px(k, T.rotulo));
    const rVolta = bloco('VOLTA', COR.cinza, px(k, T.rotulo));
    const rPos = bloco('POSIÇÃO', COR.cinza, px(k, T.rotulo));
    const vVolta = bloco(d.volta, COR.amarelo, px(k, T.valor));
    const vPos = bloco(d.posicao, COR.amarelo, px(k, T.valor));
    const largo = bloco('88/88', COR.amarelo, px(k, T.valor)).w; // largura fixa: a caixa não "pula" quando o número muda
    const colA = Math.max(rVolta.w, vVolta.w, largo);
    const colB = Math.max(rPos.w, vPos.w, largo);
    const linha1 = nome.w + gap + pista.w;
    const linha2 = colA + gap * 2 + colB;
    const w = barra + pad * 2 + Math.max(linha1, linha2);
    const yDiv = pad + nome.h;
    const y2 = yDiv + px(k, 5);
    const h = y2 + rVolta.h + vVolta.h - px(k, 2) + pad;
    return {
      w, h,
      pintar: (g) => {
        caixa(g, w, h, px(k, 5));
        g.fillStyle = COR.vermelho;
        g.fillRect(0, px(k, 5), barra, h - px(k, 10));
        const x0 = barra + pad;
        pintar(g, nome, x0, pad);
        pintar(g, pista, w - pad - pista.w, pad + nome.h - pista.h);
        g.fillStyle = DIVISA;
        g.fillRect(x0, yDiv + px(k, 1), w - x0 - pad, Math.max(1, Math.round(k)));
        pintar(g, rVolta, x0, y2);
        pintar(g, vVolta, x0, y2 + rVolta.h - px(k, 2));
        const xSep = x0 + colA + gap;
        g.fillRect(xSep, y2 + px(k, 3), Math.max(1, Math.round(k)), h - y2 - pad - px(k, 3));
        pintar(g, rPos, xSep + gap, y2);
        pintar(g, vPos, xSep + gap, y2 + rPos.h - px(k, 2));
      },
    };
  });
}

/** Caixa de cima, no meio: tempo da corrida e melhor volta (ou o aviso de volta nova). */
export function caixaTempo(cx: CaixaHud, k: number, d: { tempo: string; melhor: string; novaVolta: boolean }): void {
  cx.atualizar(`${k}|${d.tempo}|${d.melhor}|${d.novaVolta}`, () => {
    const pad = px(k, 8);
    const rot = bloco('TEMPO', COR.cinza, px(k, T.rotulo));
    const tempo = bloco(d.tempo, COR.branco, px(k, T.valor));
    const largo = bloco('88:88.88', COR.branco, px(k, T.valor)).w;
    const baixo = bloco(d.novaVolta ? 'NOVA VOLTA!' : `MELHOR ${d.melhor}`, d.novaVolta ? COR.amarelo : COR.cinza, px(k, T.rotulo));
    const w = pad * 2 + Math.max(rot.w, largo, baixo.w);
    const h = pad + rot.h + tempo.h + baixo.h - px(k, 4) + pad;
    return {
      w, h,
      pintar: (g) => {
        caixa(g, w, h, px(k, 5));
        let y = pad;
        pintar(g, rot, (w - rot.w) / 2, y);
        y += rot.h - px(k, 2);
        pintar(g, tempo, (w - tempo.w) / 2, y);
        y += tempo.h - px(k, 2);
        pintar(g, baixo, (w - baixo.w) / 2, y);
      },
    };
  });
}

/** Caixa de cima, à direita: velocidade. */
export function caixaVelocidade(cx: CaixaHud, k: number, d: { vel: number }): void {
  cx.atualizar(`${k}|${d.vel}`, () => {
    const pad = px(k, 9), gap = px(k, 6);
    const rot = bloco('VELOCIDADE', COR.cinza, px(k, T.rotulo));
    const num = bloco(String(d.vel), COR.branco, px(k, T.valor));
    const largo = bloco('888', COR.branco, px(k, T.valor)).w;
    const un = bloco('px/s', COR.cinza, px(k, T.rotulo));
    const w = pad * 2 + Math.max(rot.w, largo + gap + un.w);
    const h = pad + rot.h + num.h - px(k, 2) + pad;
    return {
      w, h,
      pintar: (g) => {
        caixa(g, w, h, px(k, 5));
        pintar(g, rot, (w - rot.w) / 2, pad);
        const y = pad + rot.h - px(k, 2);
        pintar(g, un, w - pad - un.w, y + num.h - un.h - px(k, 1));
        pintar(g, num, w - pad - un.w - gap - num.w, y);
      },
    };
  });
}

/** Barra de baixo com as teclas (só no computador; no celular aparecem o pedal e o botão da aceleração automática). */
export function caixaTeclas(cx: CaixaHud, k: number, itens: ReadonlyArray<{ tecla: string; texto: string }>): void {
  cx.atualizar(`${k}|${itens.map((i) => i.tecla + i.texto).join('|')}`, () => {
    const pad = px(k, 8), gapItem = px(k, 16), gapTecla = px(k, 6), bordaTecla = Math.max(1, Math.round(k));
    const partes = itens.map((i) => ({
      tecla: bloco(i.tecla, COR.branco, px(k, T.tecla)),
      texto: bloco(i.texto, COR.branco, px(k, T.tecla)),
    }));
    const lado = Math.max(...partes.map((p) => p.tecla.h)) + px(k, 1);
    const larguraTecla = (p: (typeof partes)[number]) => Math.max(lado, p.tecla.w + px(k, 6));
    const w = pad * 2 + partes.reduce((s, p, i) => s + larguraTecla(p) + gapTecla + p.texto.w + (i ? gapItem : 0), 0);
    const h = pad * 2 + lado;
    return {
      w, h,
      pintar: (g) => {
        caixa(g, w, h, px(k, 5));
        let x = pad;
        partes.forEach((p, i) => {
          if (i) x += gapItem;
          const lt = larguraTecla(p);
          g.strokeStyle = COR.branco;
          g.lineWidth = bordaTecla;
          g.strokeRect(x + bordaTecla / 2, pad + bordaTecla / 2, lt - bordaTecla, lado - bordaTecla);
          pintar(g, p.tecla, x + (lt - p.tecla.w) / 2, pad + (lado - p.tecla.h) / 2 + px(k, 0.5));
          x += lt + gapTecla;
          pintar(g, p.texto, x, pad + (lado - p.texto.h) / 2 + px(k, 0.5));
          x += p.texto.w;
        });
      },
    };
  });
}

/** Botão da aceleração automática no celular (toque): mesma caixa do placar, borda amarela quando ligada. */
export function caixaBotao(cx: CaixaHud, k: number, texto: string, ligado: boolean): void {
  cx.atualizar(`${k}|${texto}|${ligado}`, () => {
    const pad = px(k, 8);
    const t = bloco(texto, ligado ? COR.amarelo : COR.branco, px(k, T.tecla));
    const w = pad * 2 + t.w, h = pad * 2 + t.h - px(k, 3);
    return {
      w, h,
      pintar: (g) => {
        caixa(g, w, h, px(k, 5));
        if (ligado) {
          g.strokeStyle = COR.amarelo;
          g.lineWidth = Math.max(1, Math.round(k));
          g.strokeRect(1, 1, w - 2, h - 2);
        }
        pintar(g, t, pad, pad - px(k, 2));
      },
    };
  });
}

export type TipoPad = 'esq' | 'dir' | 'freio' | 'acel' | 'turbo';

/**
 * Botão de toque (celular): quadrado com canto chanfrado, semitransparente; aceso enquanto o dedo está nele.
 * `lado` já em pixels de tela. Setas são triângulos simples; acelerar e freio levam o nome embaixo.
 */
export function caixaPad(cx: CaixaHud, k: number, lado: number, tipo: TipoPad, apertado: boolean): void {
  cx.atualizar(`${k}|${lado}|${tipo}|${apertado}`, () => {
    const L = Math.round(lado);
    const cor = tipo === 'acel' ? '#3DDC84' : tipo === 'freio' ? '#FF5A5A' : tipo === 'turbo' ? COR.azul : COR.branco;
    return {
      w: L, h: L,
      pintar: (g) => {
        const ch = px(k, 8);
        g.beginPath();
        g.moveTo(ch, 0); g.lineTo(L - ch, 0); g.lineTo(L, ch); g.lineTo(L, L - ch); g.lineTo(L - ch, L); g.lineTo(ch, L); g.lineTo(0, L - ch); g.lineTo(0, ch);
        g.closePath();
        g.fillStyle = apertado ? 'rgba(40,44,54,0.92)' : 'rgba(16,18,23,0.55)';
        g.fill();
        g.lineWidth = Math.max(2, Math.round(2 * k));
        g.strokeStyle = apertado ? cor : 'rgba(255,255,255,0.35)';
        g.stroke();
        g.fillStyle = cor;
        const m = L / 2, t = L * 0.22;
        const rotulo = tipo === 'acel' ? 'ACELERAR' : tipo === 'freio' ? 'FREIO' : tipo === 'turbo' ? 'TURBO' : '';
        const yS = rotulo && tipo !== 'turbo' ? m - L * 0.1 : m; // seta sobe um pouco quando tem nome embaixo
        g.beginPath();
        if (tipo === 'esq') { g.moveTo(m - t, m); g.lineTo(m + t * 0.8, m - t); g.lineTo(m + t * 0.8, m + t); }
        else if (tipo === 'dir') { g.moveTo(m + t, m); g.lineTo(m - t * 0.8, m - t); g.lineTo(m - t * 0.8, m + t); }
        else if (tipo === 'acel') { g.moveTo(m, yS - t); g.lineTo(m + t, yS + t * 0.8); g.lineTo(m - t, yS + t * 0.8); }
        else if (tipo === 'freio') { g.moveTo(m, yS + t); g.lineTo(m + t, yS - t * 0.8); g.lineTo(m - t, yS - t * 0.8); }
        g.closePath();
        if (tipo !== 'turbo') g.fill();
        if (rotulo) {
          let p = px(k, T.rotulo);
          let b = bloco(rotulo, cor, p);
          while (b.w > L - px(k, 8) && p > 1) b = bloco(rotulo, cor, --p); // nome cabe no botão
          pintar(g, b, (L - b.w) / 2, tipo === 'turbo' ? m - b.h / 2 : L - b.h - px(k, 6));
        }
      },
    };
  });
}
