import Phaser from 'phaser';
import { createHubBridge, type HubToGame } from '@flix/game-sdk';
import game_json from '../game.json';
import { PlayScene } from './scenes/PlayScene';
import { COLORS } from './theme';

const bridge = createHubBridge({
  gameId: game_json.id,
  sdkVersion: game_json.sdkVersion,
  avatarTier: game_json.avatarTier as 'A' | 'B',
  avatarViews: game_json.avatarViews as Array<'portrait'>,
});

// Tela interna = tamanho real da janela em pixels do aparelho (considera telas de alta densidade): nada é ampliado pelo
// navegador, e o zoom do mundo é inteiro. Assim a arte pixelada fica nítida.
const dpr = Math.max(1, window.devicePixelRatio || 1);
const tamanho = (): { w: number; h: number } => ({ w: Math.max(320, Math.round(window.innerWidth * dpr)), h: Math.max(240, Math.round(window.innerHeight * dpr)) });
const t0 = tamanho();
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: t0.w,
  height: t0.h,
  backgroundColor: COLORS.background,
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.NONE },
  input: { activePointers: 4 }, // celular: dois polegares nos botões e folga para o turbo
  scene: [PlayScene],
});
window.addEventListener('resize', () => {
  const t = tamanho();
  game.scale.resize(t.w, t.h);
});

game.registry.set('bridge', bridge);

bridge.onHubMessage((msg: HubToGame) => {
  switch (msg.type) {
    case 'init':
      game.registry.set('hubInit', msg);
      break;
    case 'mute':
      break;
    case 'pause':
      game.pause();
      break;
    case 'resume':
      game.resume();
      break;
    case 'restart':
      break;
  }
});

bridge.sendReady();

window.addEventListener('contextmenu', (e) => e.preventDefault());

if (new URLSearchParams(window.location.search).has('debug')) {
  Object.assign(window, { __flixGame: game });
}
