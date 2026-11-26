import Phaser from 'phaser';
import { BG_KEY, cellKey } from './art';
import { CELL, COLORS, FONT, GAME_H, GAME_W } from './theme';

/** Fundo comum a todas as telas (degradê com luzes suaves). */
export function fundo(cena: Phaser.Scene): void {
  cena.cameras.main.setBackgroundColor(COLORS.background);
  cena.add.image(GAME_W / 2, GAME_H / 2, BG_KEY).setDisplaySize(GAME_W, GAME_H).setDepth(-10);
}

/** Painel de vidro: fundo escuro translúcido, borda clara fina. */
export function painel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, r = 8): void {
  g.fillStyle(COLORS.panel, 0.78).fillRoundedRect(x, y, w, h, r);
  g.lineStyle(1, COLORS.panelLine, 0.09).strokeRoundedRect(x, y, w, h, r);
}

type Estilo = { tam: number; cor?: string; peso?: 'normal' | 'bold' | '600' | '800'; espaco?: number };

/** Texto na fonte do jogo. */
export function texto(cena: Phaser.Scene, x: number, y: number, t: string, e: Estilo): Phaser.GameObjects.Text {
  return cena.add
    .text(x, y, t, {
      fontFamily: FONT,
      fontSize: `${e.tam}px`,
      fontStyle: e.peso ?? 'bold',
      color: e.cor ?? COLORS.text,
      align: 'center',
    })
    .setLetterSpacing(e.espaco ?? 0);
}

/** Rótulo pequeno em maiúsculas e espaçado (PONTOS, NÍVEL...). */
export const rotulo = (cena: Phaser.Scene, x: number, y: number, t: string): Phaser.GameObjects.Text =>
  texto(cena, x, y, t, { tam: 7, cor: COLORS.label, peso: '800', espaco: 1.2 });

/** Botão em pílula vermelha. Responde a toque/clique; teclado fica com a cena. */
export function botao(cena: Phaser.Scene, x: number, y: number, t: string, aoTocar: () => void, w = 150, h = 40): Phaser.GameObjects.Container {
  const c = cena.add.container(x, y);
  const g = cena.add.graphics();
  g.fillStyle(0xe5173f, 0.25).fillRoundedRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, (h + 6) / 2);
  g.fillStyle(0xe5173f, 1).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  g.fillStyle(0xffffff, 0.14).fillRoundedRect(-w / 2 + 4, -h / 2 + 3, w - 8, h / 2 - 3, (h / 2 - 3) / 2);
  const rot = texto(cena, 0, 0, t, { tam: 14, peso: '800', espaco: 1.5 }).setOrigin(0.5);
  c.add([g, rot]);
  c.setSize(w, h).setInteractive({ useHandCursor: true });
  c.on('pointerdown', () => cena.tweens.add({ targets: c, scale: 0.95, duration: 60, yoyo: true }));
  c.on('pointerup', aoTocar);
  return c;
}

/** Peça desenhada (para menu e telas): lista de células [x, y] na cor `item`. */
export function pecaDecorativa(cena: Phaser.Scene, x: number, y: number, celulas: [number, number][], item: number, tam = CELL): Phaser.GameObjects.Container {
  const c = cena.add.container(x, y);
  for (const [cx, cy] of celulas) c.add(cena.add.image(cx * tam, cy * tam, cellKey(item)).setDisplaySize(tam, tam));
  return c;
}
