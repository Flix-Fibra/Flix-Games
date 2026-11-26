import Phaser from 'phaser';
import { createHubBridge, type HubToGame } from '@flix/game-sdk';
import { telaCheiaNoToque } from '@flix/game-kit/src/telaCheia';
import game_json from '../game.json';
import { aoGirar, esperarPaisagem } from './girar';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { PlayScene } from './scenes/PlayScene';
import { ALTURA_TELA, LARGURA_TELA, ZOOM } from './tela';
import { som } from './som';

const bridge = createHubBridge({
  gameId: game_json.id,
  sdkVersion: game_json.sdkVersion,
  avatarTier: game_json.avatarTier as 'A' | 'B',
  avatarViews: game_json.avatarViews as Array<'side'>,
});

let game: Phaser.Game | null = null;
bridge.onHubMessage((msg: HubToGame) => {
  switch (msg.type) {
    case 'init':
    case 'mute':
      som.mudo = msg.muted;
      break;
    case 'pause':
      game?.pause();
      break;
    case 'resume':
      game?.resume();
      break;
    case 'restart':
      game?.events.emit('hub-restart');
      break;
  }
});
bridge.sendReady();
window.addEventListener('contextmenu', (e) => e.preventDefault());
telaCheiaNoToque();

const toque = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
await esperarPaisagem(toque);

game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: LARGURA_TELA * ZOOM,
  height: ALTURA_TELA * ZOOM,
  backgroundColor: '#070b16',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 4 },
  scene: [BootScene, TitleScene, PlayScene],
});
const jogo = game;
jogo.registry.set('bridge', bridge);
jogo.registry.set('toque', toque);
jogo.events.on('hub-restart', () => {
  for (const cena of jogo.scene.getScenes(true)) if (cena.scene.key !== 'Boot') cena.scene.start('Play');
});

if (toque) aoGirar((emPe) => (emPe ? jogo.pause() : jogo.resume()));
if (new URLSearchParams(window.location.search).has('debug')) Object.assign(window, { __flixGame: jogo });
