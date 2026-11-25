import Phaser from 'phaser';
import type { Level } from './logic';
import type { HoleState } from './logic';
import { BALL_R, BUMPER_R, CANNON_CAPTURE, HOLE_R, MAGNET_R, WINDMILL_HUB, blockRect, cannonAngle, lavaHot, lavaWarning, pistonHeight, windmillBlades } from './logic';
import { BAR_H, COLORS, FIELD_PAD, GAME_H, GAME_W, HUD_H, PORTAL_COLORS } from './theme';

/** Onde a fase fica na tela: escala (pixels por bloco) e deslocamento, para qualquer tamanho de grade. */
export interface Layout {
  ts: number;
  ox: number;
  oy: number;
}

export function layoutFor(l: Level): Layout {
  const availW = GAME_W - FIELD_PAD * 2;
  const availH = GAME_H - HUD_H - BAR_H;
  const ts = Math.min(availW / l.w, availH / l.h, 40);
  return { ts, ox: (GAME_W - l.w * ts) / 2, oy: HUD_H + (availH - l.h * ts) / 2 };
}

/** Posição de um ponto da fase (em blocos) na tela. */
export const toScreen = (lay: Layout, x: number, y: number): { x: number; y: number } => ({ x: lay.ox + x * lay.ts, y: lay.oy + y * lay.ts });

const glyph = (g: Phaser.GameObjects.Graphics, color: number, a = 1): Phaser.GameObjects.Graphics => g.fillStyle(color, a);

/**
 * Desenha a fase inteira (parte estática) num Graphics. A bola e a mira são desenhadas à parte, a cada quadro.
 * Tudo vem da grade de texto: para um novo tema visual, mude as cores em theme.ts ou os desenhos abaixo.
 */
export function drawCourse(scene: Phaser.Scene, l: Level, lay: Layout): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  const { ts } = lay;
  const px = (x: number): number => lay.ox + x * ts;
  const py = (y: number): number => lay.oy + y * ts;

  for (let y = 0; y < l.h; y++) {
    for (let x = 0; x < l.w; x++) {
      const c = l.rows[y]![x]!;
      const surf = l.surface[y]![x]!;
      if (c === '#' || c === ' ') continue;
      const X = px(x);
      const Y = py(y);
      switch (surf) {
        case 'sand':
          glyph(g, COLORS.sand).fillRect(X, Y, ts + 0.5, ts + 0.5);
          glyph(g, COLORS.sandDot);
          for (let i = 0; i < 5; i++) g.fillRect(X + ((i * 37 + x * 11 + y * 7) % 100) / 100 * ts * 0.9, Y + ((i * 53 + x * 5 + y * 13) % 100) / 100 * ts * 0.9, 1.5, 1.5);
          break;
        case 'ice':
          glyph(g, COLORS.ice).fillRect(X, Y, ts + 0.5, ts + 0.5);
          glyph(g, COLORS.iceLine).fillRect(X + ts * 0.15, Y + ts * 0.25, ts * 0.4, 1.5).fillRect(X + ts * 0.45, Y + ts * 0.65, ts * 0.35, 1.5);
          break;
        case 'water':
          glyph(g, COLORS.water).fillRect(X, Y, ts + 0.5, ts + 0.5);
          glyph(g, COLORS.waterLight, 0.5).fillRect(X + ts * 0.1, Y + ts * 0.3, ts * 0.45, 1.5).fillRect(X + ts * 0.4, Y + ts * 0.7, ts * 0.45, 1.5);
          break;
        default:
          glyph(g, (x + y) % 2 === 0 ? COLORS.grassA : COLORS.grassB).fillRect(X, Y, ts + 0.5, ts + 0.5);
      }
    }
  }

  // rampas: setas claras na direção que empurra
  for (let y = 0; y < l.h; y++) {
    for (let x = 0; x < l.w; x++) {
      const s = l.slope[y]![x];
      if (!s) continue;
      glyph(g, (x + y) % 2 === 0 ? COLORS.belt : COLORS.beltDark).fillRect(px(x), py(y), ts + 0.5, ts + 0.5);
      const cx = px(x + 0.5);
      const cy = py(y + 0.5);
      glyph(g, 0xffffff, 0.9);
      for (const k of [-0.18, 0.12]) {
        const bx = cx + s.x * ts * k;
        const by = cy + s.y * ts * k;
        const tip = { x: bx + s.x * ts * 0.22, y: by + s.y * ts * 0.22 };
        const w = ts * 0.26;
        g.fillTriangle(tip.x, tip.y, bx - s.y * w - s.x * ts * 0.0, by + s.x * w, bx + s.y * w, by - s.x * w);
      }
    }
  }

  // rampas de salto: piso laranja com setas escuras na direção do salto
  for (const j of l.jumps) {
    const X = px(Math.floor(j.x));
    const Y = py(Math.floor(j.y));
    glyph(g, COLORS.jump).fillRect(X, Y, ts + 0.5, ts + 0.5);
    glyph(g, 0xffffff, 0.25).fillRect(X, Y, ts + 0.5, ts * 0.12);
    g.lineStyle(Math.max(2, ts * 0.09), COLORS.jumpDark, 1);
    const cx = X + ts / 2;
    const cy = Y + ts / 2;
    const nx = -j.dir.y;
    const ny = j.dir.x;
    for (const k of [-0.26, 0.02, 0.3]) {
      const tx = cx + j.dir.x * ts * (k + 0.16);
      const ty = cy + j.dir.y * ts * (k + 0.16);
      const bx = cx + j.dir.x * ts * (k - 0.1);
      const by = cy + j.dir.y * ts * (k - 0.1);
      g.lineBetween(bx + nx * ts * 0.3, by + ny * ts * 0.3, tx, ty).lineBetween(tx, ty, bx - nx * ts * 0.3, by - ny * ts * 0.3);
    }
  }

  // trilhos dos blocos móveis: faixa clara com uma engrenagem no meio
  for (const bk of l.blocks) {
    const x0 = Math.min(bk.from.x, bk.to.x);
    const y0 = Math.min(bk.from.y, bk.to.y);
    const x1 = Math.max(bk.from.x, bk.to.x) + bk.w;
    const y1 = Math.max(bk.from.y, bk.to.y) + bk.h;
    glyph(g, COLORS.track, 0.55).fillRect(px(x0), py(y0), (x1 - x0) * ts, (y1 - y0) * ts);
    const mx = px((x0 + x1) / 2);
    const my = py((y0 + y1) / 2);
    g.lineStyle(2, COLORS.trackDark, 0.8).strokeCircle(mx, my, ts * 0.28);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      g.lineBetween(mx + Math.cos(a) * ts * 0.28, my + Math.sin(a) * ts * 0.28, mx + Math.cos(a) * ts * 0.4, my + Math.sin(a) * ts * 0.4);
    }
  }

  // paredes: blocos escuros com borda clara nas arestas voltadas para o campo
  for (let y = 0; y < l.h; y++) {
    for (let x = 0; x < l.w; x++) {
      if (l.rows[y]![x] === '#') glyph(g, COLORS.wall).fillRect(px(x), py(y), ts + 0.5, ts + 0.5);
    }
  }
  for (const s of l.walls) {
    g.lineStyle(Math.max(2, ts * 0.09), s.a.x !== s.b.x && s.a.y !== s.b.y ? COLORS.wallLight : COLORS.wallLight, 1);
    g.lineBetween(px(s.a.x), py(s.a.y), px(s.b.x), py(s.b.y));
  }

  // ímãs: anéis que pulsam por fora (a cena não anima; aqui só os anéis fixos)
  for (const m of l.magnets) {
    const color = m.sign === 1 ? COLORS.magnetPull : COLORS.magnetPush;
    g.lineStyle(1.5, color, 0.25).strokeCircle(px(m.x), py(m.y), MAGNET_R * ts * 0.5);
    g.lineStyle(1.5, color, 0.4).strokeCircle(px(m.x), py(m.y), MAGNET_R * ts * 0.28);
    glyph(g, color, 0.9).fillCircle(px(m.x), py(m.y), ts * 0.22);
    glyph(g, 0xffffff, 0.8).fillCircle(px(m.x), py(m.y), ts * 0.09);
  }

  // portais
  l.portals.forEach((p) => {
    const color = PORTAL_COLORS[(Number(p.digit) - 1) % PORTAL_COLORS.length]!;
    glyph(g, 0x000000, 0.35).fillCircle(px(p.x), py(p.y), ts * 0.36);
    g.lineStyle(2, color, 1).strokeCircle(px(p.x), py(p.y), ts * 0.33);
    g.lineStyle(1.5, color, 0.7).strokeCircle(px(p.x), py(p.y), ts * 0.2);
    glyph(g, color, 0.9).fillCircle(px(p.x), py(p.y), ts * 0.08);
  });

  // postes de cabo
  for (const b of l.bumpers) {
    glyph(g, 0x000000, 0.25).fillCircle(px(b.x) + 1.5, py(b.y) + 2, BUMPER_R * ts);
    glyph(g, COLORS.postDark).fillCircle(px(b.x), py(b.y), BUMPER_R * ts);
    glyph(g, COLORS.post).fillCircle(px(b.x), py(b.y), BUMPER_R * ts * 0.82);
    glyph(g, 0xffffff, 0.55).fillCircle(px(b.x) - ts * 0.1, py(b.y) - ts * 0.1, ts * 0.1);
  }

  // largada
  g.lineStyle(1.5, 0xffffff, 0.5).strokeCircle(px(l.tee.x), py(l.tee.y), BALL_R * ts * 1.7);

  // buraco com bandeira
  glyph(g, 0x000000, 0.3).fillCircle(px(l.hole.x) + 1, py(l.hole.y) + 1.5, HOLE_R * ts);
  glyph(g, COLORS.hole).fillCircle(px(l.hole.x), py(l.hole.y), HOLE_R * ts);
  g.lineStyle(1.5, 0xffffff, 1).lineBetween(px(l.hole.x), py(l.hole.y), px(l.hole.x), py(l.hole.y) - ts * 0.95);
  glyph(g, COLORS.flag).fillTriangle(px(l.hole.x), py(l.hole.y) - ts * 0.95, px(l.hole.x) + ts * 0.5, py(l.hole.y) - ts * 0.72, px(l.hole.x), py(l.hole.y) - ts * 0.5);
  return g;
}

/**
 * Desenha o que se mexe (lava, blocos, pistões, moinhos, bombas), a cada quadro, a partir do relógio da fase.
 * Limpa o Graphics antes. A parte parada da fase continua em `drawCourse`.
 */
export function drawGadgets(g: Phaser.GameObjects.Graphics, l: Level, lay: Layout, h: HoleState): void {
  g.clear();
  const { ts } = lay;
  const t = h.clock;
  const px = (x: number): number => lay.ox + x * ts;
  const py = (y: number): number => lay.oy + y * ts;

  // lava: acesa (laranja viva, com brilho) ou apagada (marrom escura); pisca antes de acender
  for (const z of l.lava) {
    const hot = lavaHot(z, t);
    const warn = lavaWarning(z, t);
    const X = px(z.x) + 0.5;
    const Y = py(z.y) + 0.5;
    const W = z.w * ts - 1;
    const H = z.h * ts - 1;
    glyph(g, hot ? COLORS.lavaHot : COLORS.lavaCold).fillRect(X, Y, W, H);
    if (hot) {
      glyph(g, COLORS.lavaGlow, 0.35 + 0.25 * Math.sin(t * 9)).fillRect(X + ts * 0.14, Y + ts * 0.14, W - ts * 0.28, H - ts * 0.28);
    } else if (warn > 0) {
      glyph(g, COLORS.lavaHot, warn * (0.3 + 0.4 * Math.abs(Math.sin(t * 20)))).fillRect(X, Y, W, H);
    }
    g.lineStyle(2, hot ? COLORS.lavaGlow : COLORS.lavaColdEdge, hot ? 0.9 : 1).strokeRect(X + 1, Y + 1, W - 2, H - 2);
    // marca em X (como no desenho do gestor)
    const m = ts * 0.22;
    g.lineStyle(2, hot ? 0x7a1d00 : COLORS.lavaColdEdge, 0.9);
    for (let cx = 0; cx < z.w; cx++) {
      for (let cy = 0; cy < z.h; cy++) {
        const mx = px(z.x + cx + 0.5);
        const my = py(z.y + cy + 0.5);
        g.lineBetween(mx - m, my - m, mx + m, my + m).lineBetween(mx - m, my + m, mx + m, my - m);
      }
    }
  }

  // blocos móveis
  for (const bk of l.blocks) {
    const r = blockRect(bk, t);
    glyph(g, 0x000000, 0.25).fillRect(px(r.x) + 2, py(r.y) + 3, r.w * ts, r.h * ts);
    glyph(g, COLORS.blockEdge).fillRect(px(r.x), py(r.y), r.w * ts, r.h * ts);
    glyph(g, COLORS.blockFill).fillRect(px(r.x) + 2, py(r.y) + 2, r.w * ts - 4, r.h * ts - 4);
    glyph(g, COLORS.blockEdge, 0.5).fillRect(px(r.x) + 2, py(r.y + r.h) - 5, r.w * ts - 4, 3);
  }

  // pistões: anel no chão e uma coluna vermelha que sobe e desce
  for (const p of l.pistons) {
    const k = pistonHeight(p, t);
    const x = px(p.x);
    const y = py(p.y);
    const R = p.r * ts;
    g.lineStyle(2, COLORS.pistonDark, 0.6).strokeCircle(x, y, R);
    glyph(g, 0x000000, 0.25).fillCircle(x, y, R * (0.35 + 0.65 * k));
    if (k <= 0.02) continue;
    const lift = k * ts * 0.14;
    glyph(g, COLORS.pistonDark).fillCircle(x, y - lift * 0.4, R * (0.4 + 0.6 * k));
    glyph(g, COLORS.piston).fillCircle(x, y - lift, R * (0.4 + 0.52 * k));
    glyph(g, 0xffffff, 0.45 * k).fillCircle(x - R * 0.2, y - lift - R * 0.2, R * 0.16 * k);
  }

  // moinhos
  for (const w of l.windmills) {
    for (const seg of windmillBlades(w, t)) {
      g.lineStyle(Math.max(4, ts * 0.22), COLORS.windBladeEdge, 1).lineBetween(px(seg.a.x), py(seg.a.y), px(seg.b.x), py(seg.b.y));
      g.lineStyle(Math.max(2.5, ts * 0.14), COLORS.windBlade, 1).lineBetween(px(seg.a.x), py(seg.a.y), px(seg.b.x), py(seg.b.y));
    }
    glyph(g, COLORS.windBladeEdge).fillCircle(px(w.x), py(w.y), WINDMILL_HUB * ts * 1.15);
    glyph(g, COLORS.windHub).fillCircle(px(w.x), py(w.y), WINDMILL_HUB * ts * 0.95);
    glyph(g, 0xffffff, 0.6).fillCircle(px(w.x) - ts * 0.08, py(w.y) - ts * 0.08, ts * 0.07);
  }

  // bombas: esfera preta com um cano que aponta para onde ela vai atirar
  l.cannons.forEach((c, i) => {
    const x = px(c.x);
    const y = py(c.y);
    const R = CANNON_CAPTURE * ts * 0.95;
    const a = cannonAngle(c, t);
    const holding = h.held === i;
    if (holding) glyph(g, 0xffd23d, 0.25 + 0.15 * Math.sin(t * 10)).fillCircle(x, y, R * 1.45);
    glyph(g, 0x000000, 0.3).fillCircle(x + 1.5, y + 2, R);
    glyph(g, COLORS.bomb).fillCircle(x, y, R);
    glyph(g, COLORS.bombLight, 0.9).fillCircle(x - R * 0.3, y - R * 0.3, R * 0.32);
    const bx = x + Math.cos(a) * R * 0.75;
    const by = y + Math.sin(a) * R * 0.75;
    const tx = x + Math.cos(a) * R * 1.55;
    const ty = y + Math.sin(a) * R * 1.55;
    g.lineStyle(Math.max(4, ts * 0.2), COLORS.bombLight, 1).lineBetween(bx, by, tx, ty);
    glyph(g, 0xff4a2a).fillCircle(tx, ty, Math.max(2.5, ts * 0.1));
  });
}
