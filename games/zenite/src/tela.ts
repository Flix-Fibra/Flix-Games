import type Phaser from 'phaser';

/** O jogo é pensado em 480 x 270 (30 x ~17 tiles) e desenhado 2x maior, com a câmera aproximando na mesma medida. */
export const LARGURA_TELA = 480;
export const ALTURA_TELA = 270;
export const ZOOM = 2;

export function ajustarCamera(cena: Phaser.Scene): void {
  cena.cameras.main.setZoom(ZOOM).centerOn(LARGURA_TELA / 2, ALTURA_TELA / 2);
}
