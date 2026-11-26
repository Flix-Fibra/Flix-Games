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
    }
  /** O jogo pede para ocupar a tela toda (o hub esconde a própria barra). Opcional; hub antigo ignora. */
  | { source: 'flix-game'; v: 2; type: 'layout'; gameId: string; imersivo: boolean }
  /** O jogador pediu para voltar ao hub pelo botão do próprio jogo (jogos imersivos não têm a barra do hub). */
  | { source: 'flix-game'; v: 2; type: 'exit'; gameId: string };

/**
 * Personagem que o jogador criou no editor da plataforma, já desenhado pelo hub (PNG em data URL, pixel art).
 * `retrato`: a cabeça, quadrada (ex.: quadro do avatar no placar). `corpo`: o personagem inteiro, de frente.
 * O jogo só desenha essas imagens; não guarda nem envia para lugar nenhum.
 */
export interface PersonagemImagens {
  retrato: string;
  corpo: string | null;
}

/**
 * Mensagens do hub para o jogo, já validadas. No `init`, o avatar já passou pelo catálogo (nunca é nulo).
 * `personagem` (desde o SDK 0.2.0): o personagem novo do jogador, ou null se ele não criou (ou escolheu "Sem avatar");
 * nesse caso o jogo usa o avatar antigo/padrão.
 */
export type HubToGame =
  | { type: 'init'; avatar: AvatarConfig; personagem: PersonagemImagens | null; muted: boolean; locale?: string }
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
  /** Pede ao hub a tela toda, sem a barra dele (o jogo precisa ter o próprio botão de voltar). */
  sendLayout(imersivo: boolean): void;
  /** Fecha o jogo e volta ao hub. */
  sendExit(): void;
  /** Registra um ouvinte de mensagens válidas do hub. Devolve a função que remove o ouvinte. */
  onHubMessage(listener: (msg: HubToGame) => void): () => void;
  newRunId(): string;
}
