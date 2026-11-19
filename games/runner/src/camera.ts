import Phaser from 'phaser';
import { GAME_H, GAME_W } from './theme';

/**
 * Nitidez: o jogo é pensado em GAME_W x 540 (todas as posições e tamanhos), mas desenha numa tela RENDER vezes maior e a
 * câmera aproxima na mesma proporção. Sem isso o navegador estica a imagem até a tela (4x em Retina) e tudo borra.
 */
export const RENDER = 2;

/** Câmera da cena vendo o mundo inteiro (GAME_W x 540). */
export function ajustarCamera(cena: Phaser.Scene): void {
  cena.cameras.main.setZoom(RENDER).centerOn(GAME_W / 2, GAME_H / 2);
}
