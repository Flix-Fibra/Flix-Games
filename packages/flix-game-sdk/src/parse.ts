import { sanitizeAvatar } from '@flix/avatar';
import type { HubToGame, PersonagemImagens } from './types';

// Só PNG em data URL (nada de endereço externo, que vazaria a existência do jogador para outro servidor) e com
// tamanho limitado: o retrato e o corpo do personagem têm poucos KB.
const RE_PNG = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;
const MAX_IMAGEM = 300_000;
const imagemValida = (v: unknown): v is string => typeof v === 'string' && v.length <= MAX_IMAGEM && RE_PNG.test(v);

/** Personagem do `init`: retrato obrigatório para valer; corpo opcional. Qualquer coisa fora do formato vira null. */
export function lerPersonagem(v: unknown): PersonagemImagens | null {
  if (typeof v !== 'object' || v === null) return null;
  const p = v as Record<string, unknown>;
  if (!imagemValida(p.retrato)) return null;
  return { retrato: p.retrato, corpo: imagemValida(p.corpo) ? p.corpo : null };
}

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
        personagem: lerPersonagem(m.personagem),
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
