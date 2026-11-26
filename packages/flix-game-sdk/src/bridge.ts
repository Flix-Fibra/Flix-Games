import { normalizeScore, parseHubMessage } from './parse';
import type { BridgeOptions, GameOverPayload, GameToHub, HubBridge, HubToGame } from './types';

function readHubOrigin(explicit?: string): string | null {
  if (explicit) return explicit;
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('hubOrigin');
    return fromUrl || null;
  } catch {
    return null;
  }
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'run-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

/**
 * Ponte entre o jogo e o hub, por `postMessage`. Nunca usa `'*'` como destino:
 * sem `hubOrigin` configurado, o jogo dentro de iframe não envia mensagens (e avisa no console).
 */
export function createHubBridge(options: BridgeOptions): HubBridge {
  const hubOrigin = readHubOrigin(options.hubOrigin);
  const embedded = typeof window !== 'undefined' && window.parent !== window;
  let warned = false;

  function post(msg: GameToHub): void {
    if (!embedded) return; // modo de desenvolvimento sem hub
    if (!hubOrigin) {
      if (!warned) {
        warned = true;
        console.warn('[flix-game-sdk] hubOrigin não configurado; mensagens para o hub não serão enviadas.');
      }
      return;
    }
    window.parent.postMessage(msg, hubOrigin);
  }

  return {
    embedded,
    sendReady() {
      post({
        source: 'flix-game',
        v: 2,
        type: 'ready',
        gameId: options.gameId,
        capabilities: {
          sdkVersion: options.sdkVersion,
          avatarTier: options.avatarTier,
          avatarViews: options.avatarViews,
        },
      });
    },
    sendStarted(runId: string) {
      post({ source: 'flix-game', v: 2, type: 'started', gameId: options.gameId, runId });
    },
    sendGameOver(payload: GameOverPayload) {
      post({
        source: 'flix-game',
        v: 2,
        type: 'gameover',
        gameId: options.gameId,
        runId: payload.runId,
        score: normalizeScore(payload.score),
        durationMs: Math.max(0, Math.floor(payload.durationMs)),
        meta: payload.meta,
      });
    },
    /** Pede ao hub a tela toda, sem a barra dele (o jogo passa a ter o próprio botão de voltar: sendExit). */
    sendLayout(imersivo: boolean) {
      post({ source: 'flix-game', v: 2, type: 'layout', gameId: options.gameId, imersivo });
    },
    /** Fecha o jogo e volta ao hub (botão do próprio jogo). */
    sendExit() {
      post({ source: 'flix-game', v: 2, type: 'exit', gameId: options.gameId });
    },
    onHubMessage(listener: (msg: HubToGame) => void) {
      const handler = (ev: MessageEvent) => {
        const msg = parseHubMessage(ev, hubOrigin, window.parent);
        if (msg) listener(msg);
      };
      window.addEventListener('message', handler);
      return () => window.removeEventListener('message', handler);
    },
    newRunId: uuid,
  };
}
