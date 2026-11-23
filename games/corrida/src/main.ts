import Phaser from 'phaser';
import { createHubBridge, type HubToGame } from '@flix/game-sdk';
import game_json from '../game.json';
import { PlayScene } from './scenes/PlayScene';
import { COLORS, GAME_H, GAME_W } from './theme';

const bridge = createHubBridge({
  gameId: game_json.id,
  sdkVersion: game_json.sdkVersion,
  avatarTier: game_json.avatarTier as 'A' | 'B',
  avatarViews: game_json.avatarViews as Array<'portrait'>,
});

// Tela interna pequena (pixel art): o navegador amplia sem suavizar (pixelArt = filtro vizinho mais próximo).
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: COLORS.background,
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 2 },
  scene: [PlayScene],
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
