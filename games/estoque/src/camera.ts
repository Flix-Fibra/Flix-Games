import type Phaser from 'phaser';
import { GAME_H, GAME_W } from './theme';

/**
 * Nitidez: o jogo é pensado em GAME_W x GAME_H (270 x 480: todas as posições e tamanhos), mas desenha numa tela
 * RENDER vezes maior e a câmera aproxima na mesma proporção. RENDER sai do tamanho real da tela (e da densidade de
 * pixels do aparelho), então o navegador nunca precisa esticar a imagem: fica liso em celular, notebook e monitor.
 */
function calcularRender(): number {
  if (typeof window === 'undefined') return 3;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const escala = Math.min(window.innerWidth / GAME_W, window.innerHeight / GAME_H);
  return Math.min(6, Math.max(2, Math.ceil(escala * dpr)));
}
export const RENDER = calcularRender();

/** Câmera da cena vendo o mundo inteiro (GAME_W x GAME_H). */
export function ajustarCamera(cena: Phaser.Scene): void {
  cena.cameras.main.setZoom(RENDER).centerOn(GAME_W / 2, GAME_H / 2);
}
