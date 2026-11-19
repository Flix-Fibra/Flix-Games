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

// Arte em alta resolução (não é pixel art): suavização ligada. O jogo é desenhado em 540x960 e escala para a tela.
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
  input: { activePointers: 1 },
  scene: [BootScene, MenuScene, PlayScene, GameOverScene],
} as Phaser.Types.Core.GameConfig);

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
// Arrastar o dedo (deslizar a cobra) nunca pode rolar a página nem acionar o puxar-para-atualizar do navegador.
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());

// Ajuda de depuração: abrir com ?debug na URL expõe o jogo em `window.__flixGame`.
if (new URLSearchParams(window.location.search).has('debug')) {
  Object.assign(window, { __flixGame: game });
}

// Tela cheia no celular: o navegador só permite depois de um toque, então entra no primeiro toque na tela (em computador não muda
// nada). Dentro do hub (iframe) o pedido só vale se o iframe tiver `allow="fullscreen"`; se falhar, o jogo segue normalmente.
if (window.matchMedia('(pointer: coarse)').matches) {
  const enterFullscreen = () => {
    window.removeEventListener('pointerup', enterFullscreen);
    try {
      if (game.scale.isFullscreen || !game.scale.fullscreen.available) return;
      game.scale.startFullscreen({ navigationUI: 'hide' });
    } catch {
      /* sem suporte (ex.: iPhone) */
    }
  };
  window.addEventListener('pointerup', enterFullscreen);
}
