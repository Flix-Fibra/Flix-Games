import Phaser from 'phaser';
import { BOSS_H, BOSS_W, BRICK_H } from './logic';
import { BRICK_COLORS, GAME_H, GAME_W } from './theme';

/** Largura da textura do bloco (o bloco na tela tem 64,4 px; a imagem é esticada). */
const BW = 64;
const BH = BRICK_H;

function draw(scene: Phaser.Scene, key: string, w: number, h: number, fn: (g: Phaser.GameObjects.Graphics) => void): void {
  if (scene.textures.exists(key)) return;
  const g = new Phaser.GameObjects.Graphics(scene);
  fn(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

const shade = (c: number, pct: number): number => {
  const col = Phaser.Display.Color.IntegerToColor(c);
  return (pct < 0 ? col.darken(-pct) : col.lighten(pct)).color;
};

function brick(g: Phaser.GameObjects.Graphics, c: number): void {
  g.fillStyle(shade(c, -35), 1);
  g.fillRoundedRect(0, 0, BW, BH, 6);
  g.fillStyle(c, 1);
  g.fillRoundedRect(2, 2, BW - 4, BH - 6, 5);
  g.fillStyle(0xffffff, 0.35);
  g.fillRoundedRect(6, 5, BW - 12, 6, 3);
}

/** Todas as texturas do jogo, desenhadas por código. */
export function makeTextures(scene: Phaser.Scene): void {
  BRICK_COLORS.forEach((c, i) => draw(scene, `brick_n${i}`, BW, BH, (g) => brick(g, c)));

  // prata (2 batidas): faixa diagonal brilhante
  draw(scene, 'brick_s', BW, BH, (g) => {
    brick(g, 0xb8c2d6);
    g.fillStyle(0xffffff, 0.5);
    g.fillTriangle(20, 2, 32, 2, 18, BH - 4);
    g.fillTriangle(32, 2, 36, 2, 22, BH - 4);
  });
  // ouro (3 batidas): losango no meio
  draw(scene, 'brick_t', BW, BH, (g) => {
    brick(g, 0xe6b422);
    g.fillStyle(0xfff3b0, 0.9);
    g.fillTriangle(BW / 2, 7, BW / 2 + 9, BH / 2 - 1, BW / 2, BH - 9);
    g.fillTriangle(BW / 2, 7, BW / 2 - 9, BH / 2 - 1, BW / 2, BH - 9);
  });
  // aço (indestrutível): placa escura com rebites
  draw(scene, 'brick_x', BW, BH, (g) => {
    g.fillStyle(0x23293a, 1);
    g.fillRoundedRect(0, 0, BW, BH, 5);
    g.fillStyle(0x4a5470, 1);
    g.fillRoundedRect(2, 2, BW - 4, BH - 6, 4);
    g.fillStyle(0x7a86a6, 1);
    for (const [x, y] of [[7, 7], [BW - 7, 7], [7, BH - 10], [BW - 7, BH - 10]] as const) g.fillCircle(x, y, 2.5);
  });
  // rachaduras por cima dos blocos que já levaram batida
  draw(scene, 'crack1', BW, BH, (g) => {
    g.lineStyle(2, 0x000000, 0.45);
    g.beginPath();
    g.moveTo(14, 3);
    g.lineTo(22, 13);
    g.lineTo(18, 20);
    g.lineTo(27, BH - 5);
    g.strokePath();
  });
  draw(scene, 'crack2', BW, BH, (g) => {
    g.lineStyle(2, 0x000000, 0.5);
    g.beginPath();
    g.moveTo(14, 3);
    g.lineTo(22, 13);
    g.lineTo(18, 20);
    g.lineTo(27, BH - 5);
    g.moveTo(22, 13);
    g.lineTo(38, 15);
    g.lineTo(46, 6);
    g.moveTo(38, 15);
    g.lineTo(50, BH - 6);
    g.strokePath();
  });

  // vida no placar: bolinha azul com raio, no estilo da bola do jogo
  draw(scene, 'vida', 28, 28, (g) => {
    g.fillStyle(0x4fd1ff, 0.25);
    g.fillCircle(14, 14, 14);
    g.fillStyle(0x1f5bff, 1);
    g.fillCircle(14, 14, 11);
    g.lineStyle(2, 0x9fe6ff, 1);
    g.strokeCircle(14, 14, 11);
    g.fillStyle(0xffffff, 1);
    g.fillPoints([{ x: 16, y: 6 }, { x: 10, y: 15 }, { x: 14, y: 15 }, { x: 12, y: 22 }, { x: 18, y: 12 }, { x: 14, y: 12 }] as Phaser.Types.Math.Vector2Like[], true);
  });

  // bônus: fichas redondas com ícone próprio
  const token = (key: string, c: number, icon: (g: Phaser.GameObjects.Graphics) => void) =>
    draw(scene, key, 56, 56, (g) => {
      g.fillStyle(shade(c, -40), 1);
      g.fillCircle(28, 28, 28);
      g.fillStyle(c, 1);
      g.fillCircle(28, 28, 24);
      g.lineStyle(3, 0xffffff, 0.9);
      g.strokeCircle(28, 28, 24);
      g.fillStyle(0xffffff, 1);
      g.lineStyle(6, 0xffffff, 1);
      icon(g);
    });
  token('pu_multi', 0x4f8cff, (g) => {
    g.fillCircle(28, 19, 6);
    g.fillCircle(19, 34, 6);
    g.fillCircle(37, 34, 6);
  });
  token('pu_speed', 0xff7a1a, (g) => {
    g.fillPoints([
      { x: 31, y: 10 }, { x: 17, y: 31 }, { x: 27, y: 31 }, { x: 23, y: 46 }, { x: 39, y: 23 }, { x: 29, y: 23 },
    ] as Phaser.Types.Math.Vector2Like[], true);
  });
  token('pu_shield', 0x22b866, (g) => {
    g.fillPoints([
      { x: 28, y: 11 }, { x: 41, y: 16 }, { x: 39, y: 32 }, { x: 28, y: 45 }, { x: 17, y: 32 }, { x: 15, y: 16 },
    ] as Phaser.Types.Math.Vector2Like[], true);
  });
  token('pu_magnet', 0xe23b4e, (g) => {
    g.beginPath();
    g.moveTo(18, 14);
    g.lineTo(18, 28);
    g.arc(28, 28, 10, Math.PI, 0, true);
    g.lineTo(38, 14);
    g.strokePath();
    g.fillStyle(0xc9d2f0, 1);
    g.fillRect(15, 11, 6, 6);
    g.fillRect(35, 11, 6, 6);
  });

  // chefão: bloco gigante com cara brava
  draw(scene, 'boss', BOSS_W, BOSS_H, (g) => {
    const w = BOSS_W;
    const h = BOSS_H;
    g.fillStyle(0x2a1150, 1);
    g.fillRoundedRect(0, 0, w, h, 18);
    g.fillStyle(0x7c3aed, 1);
    g.fillRoundedRect(4, 4, w - 8, h - 12, 15);
    g.fillStyle(0xffffff, 0.18);
    g.fillRoundedRect(14, 10, w - 28, 12, 6);
    // olhos
    for (const ex of [w / 2 - 50, w / 2 + 50]) {
      g.fillStyle(0xffffff, 1);
      g.fillCircle(ex, 50, 20);
      g.fillStyle(0x16081f, 1);
      g.fillCircle(ex + (ex < w / 2 ? 6 : -6), 54, 9);
    }
    // sobrancelhas
    g.fillStyle(0x16081f, 1);
    g.fillPoints([{ x: w / 2 - 78, y: 22 }, { x: w / 2 - 22, y: 36 }, { x: w / 2 - 24, y: 44 }, { x: w / 2 - 80, y: 30 }] as Phaser.Types.Math.Vector2Like[], true);
    g.fillPoints([{ x: w / 2 + 78, y: 22 }, { x: w / 2 + 22, y: 36 }, { x: w / 2 + 24, y: 44 }, { x: w / 2 + 80, y: 30 }] as Phaser.Types.Math.Vector2Like[], true);
    // boca com dentes
    g.fillStyle(0x16081f, 1);
    g.fillRoundedRect(w / 2 - 44, 78, 88, 16, 6);
    g.fillStyle(0xffffff, 1);
    for (let i = 0; i < 5; i++) g.fillTriangle(w / 2 - 40 + i * 17, 78, w / 2 - 26 + i * 17, 78, w / 2 - 33 + i * 17, 87);
  });

  draw(scene, 'bolt', 24, 24, (g) => {
    g.fillStyle(0xff3355, 0.3);
    g.fillCircle(12, 12, 12);
    g.fillStyle(0xff5577, 1);
    g.fillCircle(12, 12, 7);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(10, 10, 3);
  });

  draw(scene, 'spark', 10, 10, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 10, 10);
  });

  if (!scene.textures.exists('bg')) {
    const tex = scene.textures.createCanvas('bg', GAME_W, GAME_H)!;
    const ctx = tex.getContext();
    const grad = ctx.createLinearGradient(0, 0, 0, GAME_H);
    grad.addColorStop(0, '#0b1026');
    grad.addColorStop(1, '#1d1240');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    // estrelas fixas (mesma semente sempre)
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 140; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.15 + rnd() * 0.5})`;
      const s = rnd() < 0.85 ? 2 : 3;
      ctx.fillRect(rnd() * GAME_W, rnd() * GAME_H, s, s);
    }
    tex.refresh();
  }
}
