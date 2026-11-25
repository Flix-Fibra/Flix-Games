import type Phaser from 'phaser';
import { GAME_H, GAME_W } from './theme';

/**
 * Nitidez: o jogo é pensado em GAME_W x GAME_H (270 x 480: todas as posições e tamanhos), mas desenha numa tela
 * RENDER vezes maior e a câmera aproxima na mesma proporção. Sem isso o navegador estica a imagem pequena até a tela
 * e os blocos (18 px) perdem o desenho do cabo. Mesmo esquema do G01 (games/runner/src/camera.ts).
 */
export const RENDER = 3;

/** Câmera da cena vendo o mundo inteiro (GAME_W x GAME_H). */
export function ajustarCamera(cena: Phaser.Scene): void {
  cena.cameras.main.setZoom(RENDER).centerOn(GAME_W / 2, GAME_H / 2);
}
