/**
 * Placar em pixel art para jogos em Phaser: registra a fonte de ./hudFont como bitmap font e cria textos com ela.
 * Importar direto deste arquivo (não do index) para os jogos sem Phaser não dependerem dele.
 */
import Phaser from 'phaser';
import { HUD_CELL_H, HUD_CELL_W, HUD_CHARS, buildHudAtlas, hudSafe } from './hudFont';
// No RetroFont do Phaser o "tamanho" da fonte é a LARGURA da célula: fontSize = HUD_CELL_W × px dá escala exata px.

export const HUD_FONT = 'flix-hud';
const POR_LINHA = 16;

/** Registra a fonte uma vez por jogo (textura com filtro "nearest" para não borrar ao ampliar). */
export function registerHudFont(scene: Phaser.Scene): void {
  if (scene.cache.bitmapFont.exists(HUD_FONT)) return;
  if (!scene.textures.exists(HUD_FONT)) scene.textures.addCanvas(HUD_FONT, buildHudAtlas(POR_LINHA));
  scene.textures.get(HUD_FONT).setFilter(Phaser.Textures.FilterMode.NEAREST);
  const data = Phaser.GameObjects.RetroFont.Parse(scene, {
    image: HUD_FONT,
    width: HUD_CELL_W,
    height: HUD_CELL_H,
    chars: HUD_CHARS,
    charsPerRow: POR_LINHA,
    spacing: { x: 0, y: 0 },
    offset: { x: 0, y: 0 },
    lineSpacing: 2,
  } as unknown as Phaser.Types.GameObjects.BitmapText.RetroFontConfig);
  scene.cache.bitmapFont.add(HUD_FONT, data);
}

/**
 * Texto do placar. `px` = tamanho de 1 pixel da arte na tela (altura da letra = 7 × px). Use px que, vezes o zoom
 * da câmera, dê número inteiro: senão o filtro "nearest" some com linhas da letra.
 * Branco com contorno escuro; para outra cor use setTint (o contorno escurece junto e continua legível).
 */
export function hudText(scene: Phaser.Scene, x: number, y: number, text: string, px: number): Phaser.GameObjects.BitmapText {
  registerHudFont(scene);
  return scene.add.bitmapText(x, y, HUD_FONT, hudSafe(text), HUD_CELL_W * px).setLetterSpacing(-1); // espaço em unidades da fonte: as letras se encostam pelo contorno
}

export { hudSafe };

export interface TelaFimDeJogo {
  /** Área visível do jogo (coordenadas da cena). */
  largura: number;
  altura: number;
  pontos: number | string;
  /** Linhas abaixo de "PONTOS" (ex.: "25 m · 0 abates", "NOVO RECORDE!"), com cor opcional. */
  linhas?: { texto: string; cor?: number }[];
  /** Tamanho do pixel da arte de cada parte (veja hudText: px × zoom da câmera deve dar inteiro). */
  px: { titulo: number; pontos: number; texto: number; botao: number };
  depth: number;
  /** Imagem opcional acima do título (ex.: retrato do avatar). */
  retrato?: Phaser.GameObjects.Image;
  /**
   * Altura máxima do retrato, em px da cena (padrão: 20% da altura). O retrato pode vir em qualquer tamanho (o
   * personagem da plataforma é bem maior que o avatar antigo): acima disso, ele é reduzido.
   */
  retratoMax?: number;
  titulo?: string;
  /** Texto embaixo do número grande (padrão "PONTOS"; jogos de menor-é-melhor podem usar "TACADAS", por exemplo). */
  rotulo?: string;
  botao?: string;
  /** Cor e opacidade do véu sobre o jogo. */
  veu?: [number, number];
  /** true se a câmera do jogo rola (a tela fica presa à câmera). Não usar com câmera com zoom centralizado. */
  presaNaCamera?: boolean;
  onReiniciar: () => void;
}

/**
 * Tela de fim de jogo padrão dos jogos Flix (estilo fliperama): véu azul-escuro sobre o jogo, "FIM DE JOGO" em creme,
 * pontos grandes, linhas de detalhe e o botão REINICIAR em pixel art (vermelho Flix). Enter/espaço também reiniciam.
 * O botão é sempre do jogo, dentro e fora do hub (docs/hub-iframe.md).
 */
export function telaFimDeJogo(scene: Phaser.Scene, o: TelaFimDeJogo): Phaser.GameObjects.Container {
  const cx = o.largura / 2;
  const c = scene.add.container(0, 0).setDepth(o.depth);
  if (o.presaNaCamera) c.setScrollFactor(0);
  const [corVeu, alfaVeu] = o.veu ?? [0x0a1640, 0.62];
  c.add(scene.add.rectangle(cx, o.altura / 2, o.largura, o.altura, corVeu, alfaVeu).setInteractive()); // bloqueia toques no jogo

  // monta a pilha de cima para baixo e depois centraliza na tela
  type Item = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform & { displayHeight: number };
  const itens: { obj: Item; gap: number }[] = [];
  if (o.retrato) {
    const r = o.retrato.setOrigin(0.5, 0).setPosition(cx, 0);
    const max = o.retratoMax ?? Math.round(o.altura * 0.2);
    if (r.displayHeight > max) {
      const s = max / r.height;
      r.setScale(s >= 1 ? Math.floor(s) : s); // ampliação inteira mantém a pixel art nítida
    }
    itens.push({ obj: r, gap: 4 * o.px.texto });
  }
  const t = (s: string, px: number, cor = 0xffffff) => hudText(scene, cx, 0, s, px).setOrigin(0.5, 0).setTint(cor);
  itens.push({ obj: t(o.titulo ?? 'FIM DE JOGO', o.px.titulo, 0xf6e7c1), gap: 4 * o.px.texto });
  itens.push({ obj: t(String(o.pontos), o.px.pontos), gap: -2 * o.px.texto });
  itens.push({ obj: t(o.rotulo ?? 'PONTOS', o.px.texto), gap: 4 * o.px.texto });
  for (const l of o.linhas ?? []) itens.push({ obj: t(l.texto, o.px.texto, l.cor), gap: 2 * o.px.texto });
  if (itens.length) itens[itens.length - 1]!.gap = 6 * o.px.texto;

  // botão em pixel art: contorno escuro, borda clara, vermelho Flix, sombra embaixo, cantos "mordidos"
  const p = o.px.botao;
  const rotulo = t(o.botao ?? 'REINICIAR', p);
  const bw = Math.round(rotulo.width + 16 * p);
  const bh = Math.round(7 * p + 12 * p);
  const g = scene.add.graphics();
  const caixa = (inset: number, cor: number) => {
    g.fillStyle(cor, 1);
    g.fillRect(-bw / 2 + inset + p, inset, bw - 2 * inset - 2 * p, bh - 2 * inset);
    g.fillRect(-bw / 2 + inset, inset + p, bw - 2 * inset, bh - 2 * inset - 2 * p);
  };
  caixa(0, 0x2a0710);
  caixa(p, 0xf0606f);
  caixa(2 * p, 0xd4142c);
  g.fillStyle(0x8e0c1e, 1).fillRect(-bw / 2 + 2 * p, bh - 3 * p, bw - 4 * p, p);
  rotulo.setPosition(0, bh / 2 - 6 * p - p / 2); // a célula da fonte tem 2 linhas de acento em cima
  const botao = scene.add.container(cx, 0, [g, rotulo]).setSize(bw, bh);
  itens.push({ obj: botao, gap: 0 });

  // A pilha inteira sempre cabe na tela, com margem: o botão nunca fica para fora (o retrato é a parte que encolhe)
  const somar = () => itens.reduce((s, i) => s + i.obj.displayHeight + i.gap, 0);
  const margem = 4 * o.px.texto;
  let total = somar();
  if (o.retrato && total > o.altura - 2 * margem) {
    const sobra = total - (o.altura - 2 * margem);
    o.retrato.setScale(Math.max(0, (o.retrato.displayHeight - sobra) / o.retrato.height));
    total = somar();
  }
  let y = Math.round(o.altura / 2 - total / 2);
  for (const i of itens) {
    i.obj.y = y;
    y += i.obj.displayHeight + i.gap;
    c.add(i.obj);
  }

  let foi = false;
  const reiniciar = () => {
    if (foi) return;
    foi = true;
    o.onReiniciar();
  };
  const zona = scene.add.zone(cx, botao.y + bh / 2, bw, bh).setInteractive({ useHandCursor: true });
  c.add(zona);
  zona.on('pointerover', () => botao.setScale(1.05));
  zona.on('pointerout', () => botao.setScale(1));
  zona.on('pointerup', reiniciar);
  // teclas só depois de um instante: quem estava apertando espaço na hora de perder não pula a tela sem querer
  scene.time.delayedCall(700, () => {
    scene.input.keyboard?.once('keydown-ENTER', reiniciar);
    scene.input.keyboard?.once('keydown-SPACE', reiniciar);
  });
  return c;
}
