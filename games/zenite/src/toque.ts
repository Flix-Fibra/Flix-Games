import Phaser from 'phaser';
import { ZOOM } from './tela';

export type Botao = 'esq' | 'dir' | 'cima' | 'baixo' | 'pulo' | 'golpe' | 'pulso';

const BOTOES: { id: Botao; x: number; y: number; r: number }[] = [
  { id: 'esq', x: 24, y: 230, r: 21 },
  { id: 'dir', x: 100, y: 230, r: 21 },
  { id: 'cima', x: 62, y: 205, r: 18 },
  { id: 'baixo', x: 62, y: 250, r: 18 },
  { id: 'golpe', x: 394, y: 243, r: 22 },
  { id: 'pulo', x: 450, y: 226, r: 25 },
  { id: 'pulso', x: 434, y: 176, r: 17 },
];

/** Desenha o ícone de cada botão com formas simples (sem arte externa). */
function icone(g: Phaser.GameObjects.Graphics, id: Botao, r: number): void {
  const s = r * 0.42;
  g.fillStyle(0xffffff, 0.9);
  if (id === 'esq') g.fillTriangle(-s, 0, s * 0.7, -s, s * 0.7, s);
  if (id === 'dir') g.fillTriangle(s, 0, -s * 0.7, -s, -s * 0.7, s);
  if (id === 'cima') g.fillTriangle(0, -s, -s, s * 0.7, s, s * 0.7);
  if (id === 'baixo') g.fillTriangle(0, s, -s, -s * 0.7, s, -s * 0.7);
  if (id === 'pulo') {
    g.fillTriangle(0, -s, -s, 0, s, 0);
    g.fillRect(-s * 0.4, 0, s * 0.8, s * 0.8);
  }
  if (id === 'golpe') {
    g.lineStyle(3, 0x9ff4ff, 1).lineBetween(-s, s, s, -s);
    g.fillCircle(s, -s, 3);
  }
  if (id === 'pulso') {
    g.lineStyle(2, 0x9ff4ff, 1).strokeCircle(0, 0, s);
    g.fillCircle(0, 0, s * 0.4);
  }
}

/** Botões na tela: vários dedos ao mesmo tempo, e dá para deslizar de um botão para o outro. */
export class Toque {
  private desenhos = new Map<Botao, Phaser.GameObjects.Container>();

  constructor(private cena: Phaser.Scene, private visivel: boolean) {
    for (const b of BOTOES) {
      const g = cena.add.graphics();
      g.fillStyle(0x0b1530, 0.55).fillCircle(0, 0, b.r);
      g.lineStyle(1.5, 0x9ff4ff, 0.7).strokeCircle(0, 0, b.r);
      icone(g, b.id, b.r);
      this.desenhos.set(b.id, cena.add.container(b.x, b.y, [g]).setDepth(90).setAlpha(0.6).setVisible(visivel));
    }
  }

  mostrarPulso(sim: boolean): void {
    this.desenhos.get('pulso')!.setVisible(sim && this.visivel);
  }

  apertados(): Set<Botao> {
    const out = new Set<Botao>();
    for (const p of this.cena.input.manager.pointers) {
      if (!p.isDown) continue;
      const x = p.x / ZOOM;
      const y = p.y / ZOOM;
      // o botão mais próximo, com folga em volta (dedo é grande)
      let melhor: Botao | null = null;
      let dist = 12;
      for (const b of BOTOES) {
        if (!this.desenhos.get(b.id)!.visible) continue;
        const d = Math.hypot(x - b.x, y - b.y) - b.r;
        if (d < dist) {
          dist = d;
          melhor = b.id;
        }
      }
      if (melhor) out.add(melhor);
    }
    for (const [id, d] of this.desenhos) d.setAlpha(out.has(id) ? 1 : 0.6).setScale(out.has(id) ? 1.12 : 1);
    return out;
  }
}
