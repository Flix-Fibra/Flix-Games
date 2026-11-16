import Phaser from 'phaser';
import { createHubBridge, type HubToGame } from '@flix/game-sdk';
import { setMuted } from './audio';
import game_json from '../game.json';
import { BootScene } from './scenes/BootScene';
import { GameOverScene } from './scenes/GameOverScene';
import { MenuScene } from './scenes/MenuScene';
import { PlayScene } from './scenes/PlayScene';
import { COLORS, GAME_H, GAME_W } from './theme';

const bridge = createHubBridge({
  gameId: game_json.id,
  sdkVersion: game_json.sdkVersion,
  avatarTier: game_json.avatarTier as 'A' | 'B',
  avatarViews: game_json.avatarViews as Array<'portrait'>,
});

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: COLORS.background,
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 1 },
  scene: [BootScene, MenuScene, PlayScene, GameOverScene],
});

game.registry.set('bridge', bridge);

// Mensagens do hub. `restart` é tratado na tela de fim; as demais valem em qualquer momento.
bridge.onHubMessage((msg: HubToGame) => {
  switch (msg.type) {
    case 'init':
      game.registry.set('hubInit', msg);
      game.events.emit('hub-init', msg);
      break;
    case 'mute':
      setMuted(msg.muted);
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

// Os ouvintes já estão registrados; agora o hub pode responder com `init`.
bridge.sendReady();

// Evita menu de contexto e rolagem durante o jogo (o canvas ocupa a tela toda).
window.addEventListener('contextmenu', (e) => e.preventDefault());

// Ajuda de depuração: abrir com ?debug na URL expõe o jogo em `window.__flixGame`.
if (new URLSearchParams(window.location.search).has('debug')) {
  Object.assign(window, { __flixGame: game });
}
