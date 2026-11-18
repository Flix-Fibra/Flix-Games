import Phaser from 'phaser';
import { createHubBridge, type HubToGame } from '@flix/game-sdk';
import game_json from '../game.json';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { PlayScene } from './scenes/PlayScene';
import { COLORS, GAME_H, GAME_W } from './theme';

const bridge = createHubBridge({
  gameId: game_json.id,
  sdkVersion: game_json.sdkVersion,
  avatarTier: game_json.avatarTier as 'A' | 'B',
  avatarViews: game_json.avatarViews as Array<'side'>,
});

// Nitidez: o jogo é pensado em 960x540 (todas as posições e tamanhos), mas desenha numa tela RENDER vezes maior e a
// câmera aproxima na mesma proporção. Sem isso o navegador estica 960x540 até a tela (4x em Retina) e tudo borra.
const RENDER = 2;
// Texto também é desenhado em resolução maior (senão a câmera amplia um texto pequeno e ele borra do mesmo jeito)
const criarTexto = Phaser.GameObjects.GameObjectFactory.prototype.text;
Phaser.GameObjects.GameObjectFactory.prototype.text = function (this: Phaser.GameObjects.GameObjectFactory, ...args: Parameters<typeof criarTexto>) {
  return criarTexto.apply(this, args).setResolution(RENDER);
};

// Paisagem 960x540; escala "fit" para a tela. Cenário suave (não pixelado); o personagem usa filtro NEAREST por textura.
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W * RENDER,
  height: GAME_H * RENDER,
  backgroundColor: COLORS.background,
  pixelArt: false,
  antialias: true,
  roundPixels: false,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 3 },
  scene: [BootScene, MenuScene, PlayScene],
} as Phaser.Types.Core.GameConfig);

game.registry.set('bridge', bridge);

// Cada cena enxerga o mundo de 960x540: câmera com zoom RENDER, centrada (vale também quando a cena reinicia)
game.events.once(Phaser.Core.Events.READY, () => {
  for (const cena of game.scene.scenes) {
    const ajustar = () => cena.cameras.main.setZoom(RENDER).centerOn(GAME_W / 2, GAME_H / 2);
    cena.events.on(Phaser.Scenes.Events.START, ajustar); // antes do preload (barra de carregamento)
    cena.events.on(Phaser.Scenes.Events.CREATE, ajustar);
  }
});

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
  Object.assign(window, { __flixGame: game });
}
