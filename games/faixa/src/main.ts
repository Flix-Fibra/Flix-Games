import Phaser from 'phaser';
import { createHubBridge, type HubToGame } from '@flix/game-sdk';
import { setMuted } from './audio';
import { ajustarCamera, RENDER } from './camera';
import game_json from '../game.json';
import { BootScene } from './scenes/BootScene';
import { GameOverScene } from './scenes/GameOverScene';
import { MenuScene } from './scenes/MenuScene';
import { PlayScene } from './scenes/PlayScene';
import { COLORS, GAME_H, GAME_W } from './theme';
import { telaCheiaNoToque } from '@flix/game-kit/src/telaCheia';

const bridge = createHubBridge({
  gameId: game_json.id,
  sdkVersion: game_json.sdkVersion,
  avatarTier: game_json.avatarTier as 'A' | 'B',
  avatarViews: game_json.avatarViews as Array<'portrait'>,
});

// Texto também é desenhado em resolução maior (senão a câmera amplia um texto pequeno e ele borra do mesmo jeito)
const criarTexto = Phaser.GameObjects.GameObjectFactory.prototype.text;
Phaser.GameObjects.GameObjectFactory.prototype.text = function (this: Phaser.GameObjects.GameObjectFactory, ...args: Parameters<typeof criarTexto>) {
  return criarTexto.apply(this, args).setResolution(RENDER);
};

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W * RENDER,
  height: GAME_H * RENDER,
  backgroundColor: COLORS.background,
  antialias: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 1 },
  scene: [BootScene, MenuScene, PlayScene, GameOverScene],
});

game.registry.set('bridge', bridge);
telaCheiaNoToque();

// Cada cena enxerga o mundo de GAME_W x GAME_H: câmera com zoom RENDER (vale também quando a cena reinicia)
game.events.once(Phaser.Core.Events.READY, () => {
  for (const cena of game.scene.scenes) {
    cena.events.on(Phaser.Scenes.Events.START, () => ajustarCamera(cena));
    cena.events.on(Phaser.Scenes.Events.CREATE, () => ajustarCamera(cena));
  }
});

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
