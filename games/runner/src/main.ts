import Phaser from 'phaser';
import { createHubBridge, type HubToGame } from '@flix/game-sdk';
import game_json from '../game.json';
import { COLORS, GAME_H, GAME_W, MARGEM_X, definirLargura } from './theme';
import { ajustarCamera, RENDER } from './camera';
import { aoGirar, esperarPaisagem } from './girar';
import { telaCheiaNoToque } from '@flix/game-kit/src/telaCheia';

const bridge = createHubBridge({
  gameId: game_json.id,
  sdkVersion: game_json.sdkVersion,
  avatarTier: game_json.avatarTier as 'A' | 'B',
  avatarViews: game_json.avatarViews as Array<'side'>,
});

// Texto também é desenhado em resolução maior (senão a câmera amplia um texto pequeno e ele borra do mesmo jeito)
const criarTexto = Phaser.GameObjects.GameObjectFactory.prototype.text;
Phaser.GameObjects.GameObjectFactory.prototype.text = function (this: Phaser.GameObjects.GameObjectFactory, ...args: Parameters<typeof criarTexto>) {
  return criarTexto.apply(this, args).setResolution(RENDER);
};

// Mensagens do hub: o jogo pode ainda não existir (esperando o celular deitar); guarda o estado e aplica ao criar.
let game: Phaser.Game | null = null;
let hubInit: Extract<HubToGame, { type: 'init' }> | null = null;
let mudo = false;
bridge.onHubMessage((msg: HubToGame) => {
  switch (msg.type) {
    case 'init':
      hubInit = msg;
      mudo = msg.muted;
      if (game) {
        game.registry.set('hubInit', msg);
        game.events.emit('hub-init', msg);
      }
      break;
    case 'mute':
      mudo = msg.muted;
      if (game) game.sound.mute = msg.muted;
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
// "pronto" já agora: o hub não fica esperando enquanto a pessoa gira o celular
bridge.sendReady();
window.addEventListener('contextmenu', (e) => e.preventDefault());
// antes de esperar o giro: o toque na tela do aviso "GIRE O CELULAR" já pode abrir a tela cheia
telaCheiaNoToque();

// Celular em pé: pede para girar e só cria o jogo deitado (o formato da tela define a largura do mundo).
const toque = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
await esperarPaisagem(toque);
definirLargura((GAME_H * window.innerWidth) / window.innerHeight, toque ? 44 : 20);
// as cenas usam GAME_W já ao carregar o módulo: só importa depois de definir a largura
const [{ BootScene }, { MenuScene }, { PlayScene }] = await Promise.all([
  import('./scenes/BootScene'),
  import('./scenes/MenuScene'),
  import('./scenes/PlayScene'),
]);

// Altura 540 e largura no formato da tela (800 a 1280); escala "fit": sem faixas pretas na maioria dos aparelhos.
game = new Phaser.Game({
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
const jogo = game;

jogo.registry.set('bridge', bridge);
if (hubInit) jogo.registry.set('hubInit', hubInit);
jogo.sound.mute = mudo;

// Janela mudou de formato (tela cheia no computador, janela redimensionada): a largura do mundo acompanha, para não
// sobrar faixa. Nunca no meio de uma partida (mudaria o quanto se vê à frente): fica pendente e vale na próxima cena.
let larguraPendente = false;
function aplicarLargura(): boolean {
  const antes = GAME_W;
  definirLargura((GAME_H * window.innerWidth) / window.innerHeight, MARGEM_X);
  if (GAME_W === antes) return false;
  jogo.scale.setGameSize(GAME_W * RENDER, GAME_H * RENDER);
  return true;
}

// Cada cena enxerga o mundo de GAME_W x 540: câmera com zoom RENDER, centrada (vale também quando a cena reinicia)
jogo.events.once(Phaser.Core.Events.READY, () => {
  for (const cena of jogo.scene.scenes) {
    cena.events.on(Phaser.Scenes.Events.START, () => {
      if (larguraPendente) {
        larguraPendente = false;
        aplicarLargura(); // antes do create(): a cena já nasce com a largura nova
      }
      ajustarCamera(cena);
    });
    cena.events.on(Phaser.Scenes.Events.CREATE, () => ajustarCamera(cena));
  }
});

let esperaResize = 0;
window.addEventListener('resize', () => {
  window.clearTimeout(esperaResize);
  esperaResize = window.setTimeout(() => {
    if (toque && window.innerHeight > window.innerWidth) return; // celular em pé: o aviso de girar cuida disso
    if (jogo.scene.isActive('Menu')) {
      if (aplicarLargura()) jogo.scene.getScene('Menu').scene.restart();
    } else larguraPendente = true; // carregando ou em partida (inclusive na tela de fim): vale na próxima cena
  }, 200);
});

// Girou para em pé no meio do jogo: pausa e mostra o aviso; deitou de novo: continua.
if (toque) aoGirar((emPe) => (emPe ? jogo.pause() : jogo.resume()));

if (new URLSearchParams(window.location.search).has('debug')) {
  Object.assign(window, { __flixGame: jogo });
}
