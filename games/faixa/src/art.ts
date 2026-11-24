import Phaser from 'phaser';
import { CAR_COLORS, CELL, COLORS } from './theme';

/** Resolução das texturas: cada pixel lógico vira K pixels (a câmera do jogo também aproxima 3x). */
const K = 3;

type G = Phaser.GameObjects.Graphics;
type Draw = (g: G, k: number) => void;

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: Draw): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g, K);
  g.generateTexture(key, Math.ceil(w * K), Math.ceil(h * K));
  g.destroy();
}

/** Atalhos de desenho em pixels lógicos (multiplicam por k). */
const rect = (g: G, k: number, c: number, x: number, y: number, w: number, h: number, a = 1): void => {
  g.fillStyle(c, a).fillRect(x * k, y * k, w * k, h * k);
};
const rrect = (g: G, k: number, c: number, x: number, y: number, w: number, h: number, r: number, a = 1): void => {
  g.fillStyle(c, a).fillRoundedRect(x * k, y * k, w * k, h * k, r * k);
};
const circ = (g: G, k: number, c: number, x: number, y: number, r: number, a = 1): void => {
  g.fillStyle(c, a).fillCircle(x * k, y * k, r * k);
};
const ell = (g: G, k: number, c: number, x: number, y: number, w: number, h: number, a = 1): void => {
  g.fillStyle(c, a).fillEllipse(x * k, y * k, w * k, h * k);
};

export const propKey = (variant: number): string => `prop_${variant}`;
export const vehicleKey = (variant: number): string => `veh_${variant}`;
export const logKey = (len: number, variant: number): string => `log_${len}_${variant}`;
export const PAD = 'pad';
export const PLAYER = 'player';
export const TAPUME = 'tapume';
export const SPLASH = 'splash';

/** Comprimento (em blocos) de cada variante de veículo: 0 e 1 carros, 2 e 3 caminhões. Combina com `genRoad`. */
export const VEHICLE_LEN = [1.4, 1.4, 2.6, 2.6] as const;

export function buildTextures(scene: Phaser.Scene): void {
  // ----- obstáculos da grama (vistos de cima) -----
  make(scene, propKey(0), CELL, CELL, (g, k) => {
    ell(g, k, 0x000000, 13.5, 16, 22, 16, 0.18);
    circ(g, k, 0x2f6b2a, 13, 13, 11);
    circ(g, k, 0x3f8a37, 12, 11, 9);
    circ(g, k, 0x5bb04c, 10, 9, 5);
    circ(g, k, 0x73c761, 9, 8, 2.2);
  });
  make(scene, propKey(1), CELL, CELL, (g, k) => {
    ell(g, k, 0x000000, 13.5, 17, 20, 12, 0.18);
    rrect(g, k, 0x6d7280, 4, 6, 18, 15, 6);
    rrect(g, k, 0x9097a6, 5, 6, 16, 11, 5);
    rrect(g, k, 0xb7bdca, 8, 8, 7, 4, 2);
  });
  make(scene, propKey(2), CELL, CELL, (g, k) => {
    ell(g, k, 0x000000, 13.5, 16, 18, 12, 0.18);
    rrect(g, k, 0xe8a21c, 5, 5, 16, 16, 3);
    circ(g, k, 0xff7a1a, 13, 13, 7.5);
    circ(g, k, 0xffffff, 13, 13, 5);
    circ(g, k, 0xff7a1a, 13, 13, 2.8);
  });

  // ----- veículos: desenhados andando para a direita (a frente é a direita) -----
  const lenPx = (v: number): number => Math.round(VEHICLE_LEN[v]! * CELL);
  for (const v of [0, 1]) {
    make(scene, vehicleKey(v), lenPx(v), CELL, (g, k) => {
      const w = lenPx(v);
      rrect(g, k, 0x000000, 1, 6, w - 2, 16, 5, 0.2);
      for (const wx of [w * 0.2, w * 0.68]) {
        rect(g, k, 0x15161a, wx, 3, 8, 3);
        rect(g, k, 0x15161a, wx, 20, 8, 3);
      }
      rrect(g, k, CAR_COLORS[v]!, 1, 5, w - 2, 16, 5);
      rrect(g, k, 0xffffff, w * 0.3, 7.5, w * 0.34, 11, 3, 0.28); // teto
      rrect(g, k, 0x1b2c3d, w * 0.64, 7, w * 0.17, 12, 3); // para-brisa
      rect(g, k, 0xfff2a8, w - 4, 6.5, 2.5, 3);
      rect(g, k, 0xfff2a8, w - 4, 16.5, 2.5, 3);
      rect(g, k, 0xff3b3b, 2.5, 6.5, 1.8, 3);
      rect(g, k, 0xff3b3b, 2.5, 16.5, 1.8, 3);
    });
  }
  for (const v of [2, 3]) {
    make(scene, vehicleKey(v), lenPx(v), CELL, (g, k) => {
      const w = lenPx(v);
      const cab = 19;
      rrect(g, k, 0x000000, 1, 5, w - 2, 18, 4, 0.2);
      for (const wx of [w * 0.12, w * 0.38, w - cab - 1]) {
        rect(g, k, 0x15161a, wx, 2.5, 9, 3);
        rect(g, k, 0x15161a, wx, 20.5, 9, 3);
      }
      if (v === 2) {
        // caminhão da obra: caçamba branca com a faixa vermelha da Flix
        rrect(g, k, 0xf0f1f5, 1, 4.5, w - cab - 2, 17, 3);
        rect(g, k, COLORS.flixRed, 1, 11, w - cab - 2, 4);
        rrect(g, k, 0xd8dbe3, 3, 6, w - cab - 6, 3, 1.5);
      } else {
        // carreta de bobina de cabo
        rrect(g, k, 0x59606e, 1, 5, w - cab - 2, 16, 3);
        circ(g, k, 0xb9772e, (w - cab) / 2 - 1, 13, 7.5);
        circ(g, k, 0xd9954a, (w - cab) / 2 - 1, 13, 6);
        circ(g, k, 0x3a2a18, (w - cab) / 2 - 1, 13, 2);
      }
      rrect(g, k, v === 2 ? 0xd4142c : 0xf2c230, w - cab, 4.5, cab - 1, 17, 4);
      rrect(g, k, 0x1b2c3d, w - 9, 7, 6.5, 12, 2.5);
      rect(g, k, 0xfff2a8, w - 3.5, 6, 2.5, 3);
      rect(g, k, 0xfff2a8, w - 3.5, 17, 2.5, 3);
    });
  }

  // ----- troncos e paletes no rio -----
  for (const len of [2, 3, 4]) {
    const w = len * CELL;
    make(scene, logKey(len, 0), w, CELL, (g, k) => {
      // palete de madeira
      rrect(g, k, 0x000000, 1, 5, w - 2, 18, 4, 0.2);
      rrect(g, k, 0xb98550, 1, 3, w - 2, 19, 4);
      for (let i = 0; i < len * 2; i++) {
        rect(g, k, 0x8c5f33, 1 + i * (CELL / 2), 3, 1.5, 19);
        rect(g, k, 0xd2a066, 3 + i * (CELL / 2), 6, CELL / 2 - 5, 3, 0.7);
      }
      rect(g, k, 0x8c5f33, 1, 11, w - 2, 1.5);
      rect(g, k, 0x8c5f33, 1, 17, w - 2, 1.5);
    });
    make(scene, logKey(len, 1), w, CELL, (g, k) => {
      // tronco
      rrect(g, k, 0x000000, 1, 5, w - 2, 18, 8, 0.2);
      rrect(g, k, 0x7a4d28, 1, 3, w - 2, 19, 9);
      rrect(g, k, 0x956338, 3, 4, w - 6, 8, 4);
      for (const ex of [4.5, w - 4.5]) {
        circ(g, k, 0xd9a566, ex, 12.5, 6.5);
        circ(g, k, 0xb8844a, ex, 12.5, 4);
        circ(g, k, 0xd9a566, ex, 12.5, 2);
      }
    });
  }

  // ----- vitória-régia -----
  make(scene, PAD, CELL, CELL, (g, k) => {
    circ(g, k, 0x000000, 13.5, 14.5, 10.5, 0.18);
    circ(g, k, 0x2f9e4a, 13, 13, 10.5);
    circ(g, k, 0x46c062, 12, 12, 8);
    g.fillStyle(COLORS.water, 1);
    g.slice(13 * k, 13 * k, 11 * k, Phaser.Math.DegToRad(-20), Phaser.Math.DegToRad(20), false).fillPath();
    circ(g, k, 0xff8fb1, 11, 11, 2.4);
    circ(g, k, 0xffe27a, 11, 11, 1);
  });

  // ----- técnico visto de cima, virado para cima -----
  make(scene, PLAYER, CELL, CELL, (g, k) => {
    ell(g, k, 0x000000, 13.5, 16, 18, 16, 0.22);
    ell(g, k, 0xd4142c, 13, 14.5, 18, 11); // ombros (colete)
    rect(g, k, 0xf2c230, 8, 12, 2.2, 5, 0.9);
    rect(g, k, 0xf2c230, 15.8, 12, 2.2, 5, 0.9);
    circ(g, k, 0xffd9b0, 4.8, 12, 2.2);
    circ(g, k, 0xffd9b0, 21.2, 12, 2.2);
    circ(g, k, 0xf5b800, 13, 11, 6.6); // capacete
    circ(g, k, 0xffd84a, 12, 10, 4.2);
    rect(g, k, 0xffffff, 12.2, 5, 1.6, 12, 0.8);
    circ(g, k, 0xfff7c0, 13, 4.6, 1.6); // lanterna na frente
  });

  // ----- tapume lateral (barreira da obra), ladrilho de 18 x 32 -----
  make(scene, TAPUME, 18, 32, (g, k) => {
    rect(g, k, COLORS.fence, 0, 0, 18, 32);
    for (let y = 0; y < 32; y += 16) {
      rect(g, k, 0x242d40, 1, y + 1, 13, 14);
      rect(g, k, 0x2c3650, 2, y + 2, 11, 2);
    }
    // faixa de aviso amarela e preta na borda de dentro
    rect(g, k, 0x15161a, 14, 0, 4, 32);
    g.fillStyle(COLORS.hazardYellow, 1);
    for (let y = -4; y < 32; y += 8) {
      g.fillPoints(
        [
          new Phaser.Geom.Point(14 * k, y * k),
          new Phaser.Geom.Point(18 * k, (y - 4) * k),
          new Phaser.Geom.Point(18 * k, y * k),
          new Phaser.Geom.Point(14 * k, (y + 4) * k),
        ],
        true,
      );
    }
  });

  make(scene, SPLASH, 8, 8, (g, k) => circ(g, k, 0xffffff, 4, 4, 3.5));
}
