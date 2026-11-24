import type Phaser from 'phaser';
import type { PistaPronta } from './pistas';

/**
 * Minimapa no canto da tela: a pista inteira vista de cima (arte da pista escurecida, com o traçado realçado e a
 * largada), os carros (o jogador maior, com uma seta para onde está indo; o líder com um anel amarelo) e os itens
 * na pista. É uma textura pequena redesenhada poucas vezes por segundo (barato até em celular).
 */
export const MAPA_W = 240;
export const MAPA_H = 150;
const MARGEM = 8;
const INTERVALO_MS = 66; // ~15 vezes por segundo

export interface PontoMapa {
  x: number;
  y: number;
  ang: number;
  cor: string;
  jogador?: boolean;
  lider?: boolean;
}

export type TipoMarcador = 'turbo' | 'arco' | 'roleta' | 'poca' | 'vaca' | 'meteoro';
export interface Marcador {
  x: number;
  y: number;
  tipo: TipoMarcador;
}

const COR_MARCADOR: Record<TipoMarcador, string> = {
  turbo: '#4fb4ff',
  arco: '#ff5ad1',
  roleta: '#ffd23f',
  poca: '#6fa8ff',
  vaca: '#ffffff',
  meteoro: '#ff7a1c',
};

export class Minimapa {
  readonly chave = 'minimapa';
  private readonly tex: Phaser.Textures.CanvasTexture;
  private base: HTMLCanvasElement | null = null;
  private escala = 1;
  private ox = 0;
  private oy = 0;
  private espera = 0;

  constructor(private readonly scene: Phaser.Scene) {
    if (scene.textures.exists(this.chave)) scene.textures.remove(this.chave);
    this.tex = scene.textures.createCanvas(this.chave, MAPA_W, MAPA_H)!;
  }

  /** Prepara o fundo da pista (uma vez por pista). `arte`: chave da textura da arte, se houver. */
  usarPista(pista: PistaPronta, arte?: string): void {
    const { w, h } = pista.def;
    const area = (MAPA_W - 2 * MARGEM) / w < (MAPA_H - 2 * MARGEM) / h ? (MAPA_W - 2 * MARGEM) / w : (MAPA_H - 2 * MARGEM) / h;
    this.escala = area;
    this.ox = (MAPA_W - w * area) / 2;
    this.oy = (MAPA_H - h * area) / 2;
    const cv = document.createElement('canvas');
    cv.width = MAPA_W;
    cv.height = MAPA_H;
    const g = cv.getContext('2d')!;
    // painel com cantos arredondados
    g.fillStyle = 'rgba(12,14,20,0.82)';
    g.beginPath();
    g.roundRect(0, 0, MAPA_W, MAPA_H, 12);
    g.fill();
    if (arte && this.scene.textures.exists(arte)) {
      g.save();
      g.globalAlpha = 0.45; // cenário apagado: o traçado é que tem que aparecer
      g.imageSmoothingEnabled = true;
      g.drawImage(this.scene.textures.get(arte).getSourceImage() as CanvasImageSource, this.ox, this.oy, w * area, h * area);
      g.restore();
    }
    // traçado: contorno escuro e asfalto claro
    const am = pista.amostras;
    const tracar = (larg: number, cor: string) => {
      g.beginPath();
      am.forEach((a, i) => (i ? g.lineTo(this.mx(a.x), this.my(a.y)) : g.moveTo(this.mx(a.x), this.my(a.y))));
      g.closePath();
      g.lineJoin = 'round';
      g.strokeStyle = cor;
      g.lineWidth = larg;
      g.stroke();
    };
    tracar(6, 'rgba(0,0,0,0.85)');
    tracar(3.5, '#d8dce4');
    // largada: traço quadriculado perpendicular à pista
    const a0 = am[0]!;
    const nx = -Math.sin(a0.ang), ny = Math.cos(a0.ang);
    for (let k = -2; k <= 2; k++) {
      g.fillStyle = k % 2 === 0 ? '#ffffff' : '#111111';
      g.fillRect(this.mx(a0.x) + nx * k * 1.6 - 1, this.my(a0.y) + ny * k * 1.6 - 1, 2, 2);
    }
    g.strokeStyle = 'rgba(255,255,255,0.18)';
    g.lineWidth = 1;
    g.beginPath();
    g.roundRect(0.5, 0.5, MAPA_W - 1, MAPA_H - 1, 12);
    g.stroke();
    this.base = cv;
    this.espera = 0;
  }

  private mx(x: number): number {
    return this.ox + x * this.escala;
  }
  private my(y: number): number {
    return this.oy + y * this.escala;
  }

  /** Redesenha (no máximo ~15 vezes por segundo). O jogador vai por último, por cima de todos. */
  atualizar(delta: number, carros: readonly PontoMapa[], marcadores: readonly Marcador[]): void {
    this.espera -= delta;
    if (this.espera > 0 || !this.base) return;
    this.espera = INTERVALO_MS;
    const g = this.tex.getContext();
    g.clearRect(0, 0, MAPA_W, MAPA_H);
    g.drawImage(this.base, 0, 0);
    for (const m of marcadores) {
      const x = this.mx(m.x), y = this.my(m.y);
      g.fillStyle = COR_MARCADOR[m.tipo];
      if (m.tipo === 'poca') {
        g.globalAlpha = 0.8;
        g.beginPath();
        g.ellipse(x, y, 3, 2, 0, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
      } else {
        // losango (bônus e perigos)
        g.beginPath();
        g.moveTo(x, y - 3);
        g.lineTo(x + 3, y);
        g.lineTo(x, y + 3);
        g.lineTo(x - 3, y);
        g.closePath();
        g.fill();
      }
    }
    const ordem = [...carros].sort((a, b) => Number(!!a.jogador) - Number(!!b.jogador));
    for (const c of ordem) {
      const x = this.mx(c.x), y = this.my(c.y);
      if (c.lider) {
        g.strokeStyle = '#ffd23f';
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(x, y, c.jogador ? 7 : 5.5, 0, Math.PI * 2);
        g.stroke();
      }
      if (c.jogador) {
        // seta apontando para onde o carro vai, com contorno branco
        const s = 6;
        g.save();
        g.translate(x, y);
        g.rotate(c.ang);
        g.beginPath();
        g.moveTo(s, 0);
        g.lineTo(-s * 0.7, -s * 0.65);
        g.lineTo(-s * 0.35, 0);
        g.lineTo(-s * 0.7, s * 0.65);
        g.closePath();
        g.fillStyle = c.cor;
        g.fill();
        g.strokeStyle = '#ffffff';
        g.lineWidth = 1.5;
        g.stroke();
        g.restore();
      } else {
        g.fillStyle = '#000000';
        g.beginPath();
        g.arc(x, y, 3.2, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = c.cor;
        g.beginPath();
        g.arc(x, y, 2.3, 0, Math.PI * 2);
        g.fill();
      }
    }
    this.tex.refresh();
  }
}
