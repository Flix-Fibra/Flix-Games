import { sanitizeAvatar } from '@flix/avatar';
import type { HubToGame } from './types';

export interface RawMessageEvent {
  origin: string;
  source: unknown;
  data: unknown;
}

/**
 * Valida uma mensagem recebida. Devolve `null` se a origem ou o remetente não forem os esperados,
 * ou se `source`, `v` ou `type` não baterem com o contrato. No `init`, o avatar é validado contra o catálogo.
 */
export function parseHubMessage(
  event: RawMessageEvent,
  expectedOrigin: string | null,
  expectedSource: unknown,
): HubToGame | null {
  if (!expectedOrigin || event.origin !== expectedOrigin) return null;
  if (event.source !== expectedSource) return null;
  const data = event.data;
  if (typeof data !== 'object' || data === null) return null;
  const m = data as Record<string, unknown>;
  if (m.source !== 'flix-hub' || m.v !== 2) return null;

  switch (m.type) {
    case 'init':
      return {
        type: 'init',
        avatar: sanitizeAvatar(m.avatar),
        muted: m.muted === true,
        locale: typeof m.locale === 'string' ? m.locale : undefined,
      };
    case 'restart':
    case 'pause':
    case 'resume':
      return { type: m.type };
    case 'mute':
      return { type: 'mute', muted: m.muted === true };
    default:
      return null;
  }
}

/** Valida o placar antes de enviar: inteiro não negativo. */
export function normalizeScore(score: number): number {
  if (!Number.isFinite(score) || score < 0) return 0;
  return Math.floor(score);
}
