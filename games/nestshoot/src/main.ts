import Phaser from 'phaser';
import { createHubBridge, type HubToGame } from '@flix/game-sdk';
import game_json from '../game.json';
import * as logic from './logic';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { PlayScene } from './scenes/PlayScene';
import { COLORS, GAME_H, GAME_W } from './theme';
import { telaCheiaNoToque } from '@flix/game-kit/src/telaCheia';

const bridge = createHubBridge({
  gameId: game_json.id,
  sdkVersion: game_json.sdkVersion,
  avatarTier: game_json.avatarTier as 'A' | 'B',
  avatarViews: game_json.avatarViews as Array<'side'>,
});

// Retrato 720x1280; escala "fit" para a tela. Arte já reduzida para a escala do jogo (filtro suave).
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: COLORS.background,
  pixelArt: false,
  antialias: true,
  roundPixels: false,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 2 },
  scene: [BootScene, MenuScene, PlayScene],
} as Phaser.Types.Core.GameConfig);

game.registry.set('bridge', bridge);
telaCheiaNoToque();

bridge.onHubMessage((msg: HubToGame) => {
  switch (msg.type) {
    case 'init':
      game.registry.set('hubInit', msg);
      game.events.emit('hub-init', msg);
      break;
    case 'mute':
      game.sound.mute = msg.muted;
      break;
    case 'pause':
      game.pause();
      break;
    case 'resume':
      game.resume();
      break;
    case 'restart':
      game.events.emit('hub-restart');
      break;
  }
});

bridge.sendReady();
window.addEventListener('contextmenu', (e) => e.preventDefault());
if (new URLSearchParams(window.location.search).has('debug')) {
  Object.assign(window, { __flixGame: game, __nestLogic: logic });
}
