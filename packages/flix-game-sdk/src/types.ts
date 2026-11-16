import type { AvatarConfig, AvatarView } from '@flix/avatar';

/** Mensagens do jogo para o hub (HUB_CONTRACT.md, contrato v2). */
export type GameToHub =
  | {
      source: 'flix-game';
      v: 2;
      type: 'ready';
      gameId: string;
      capabilities: { sdkVersion: string; avatarTier: 'A' | 'B'; avatarViews: AvatarView[] };
    }
  | { source: 'flix-game'; v: 2; type: 'started'; gameId: string; runId: string }
  | {
      source: 'flix-game';
      v: 2;
      type: 'gameover';
      gameId: string;
      runId: string;
      score: number;
      durationMs: number;
      meta?: Record<string, number | string>;
    };

/** Mensagens do hub para o jogo, já validadas. No `init`, o avatar já passou pelo catálogo (nunca é nulo). */
export type HubToGame =
  | { type: 'init'; avatar: AvatarConfig; muted: boolean; locale?: string }
  | { type: 'restart' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'mute'; muted: boolean };

export interface BridgeOptions {
  gameId: string;
  sdkVersion: string;
  avatarTier: 'A' | 'B';
  avatarViews: AvatarView[];
  /** Origem do hub. Se ausente, lê `?hubOrigin=` da URL. Sem origem, o jogo dentro de iframe não envia nada. */
  hubOrigin?: string;
}

export interface GameOverPayload {
  runId: string;
  score: number;
  durationMs: number;
  meta?: Record<string, number | string>;
}

export interface HubBridge {
  /** `true` quando o jogo está dentro de um iframe do hub. */
  readonly embedded: boolean;
  sendReady(): void;
  sendStarted(runId: string): void;
  sendGameOver(payload: GameOverPayload): void;
  /** Registra um ouvinte de mensagens válidas do hub. Devolve a função que remove o ouvinte. */
  onHubMessage(listener: (msg: HubToGame) => void): () => void;
  newRunId(): string;
}
