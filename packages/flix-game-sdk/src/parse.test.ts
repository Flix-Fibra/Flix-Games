import { describe, expect, it } from 'vitest';
import { DEFAULT_AVATAR } from '@flix/avatar';
import { normalizeScore, parseHubMessage } from './parse';

const HUB = 'https://hub.exemplo.test';
const parent = { id: 'parent' };
const ev = (data: unknown, origin = HUB, source: unknown = parent) => ({ origin, source, data });
const base = { source: 'flix-hub', v: 2 };

describe('parseHubMessage', () => {
  it('aceita mensagens válidas da origem esperada', () => {
    expect(parseHubMessage(ev({ ...base, type: 'restart' }), HUB, parent)).toEqual({ type: 'restart' });
    expect(parseHubMessage(ev({ ...base, type: 'pause' }), HUB, parent)).toEqual({ type: 'pause' });
    expect(parseHubMessage(ev({ ...base, type: 'mute', muted: true }), HUB, parent)).toEqual({ type: 'mute', muted: true });
  });

  it('rejeita origem diferente, remetente diferente e hubOrigin ausente', () => {
    const msg = { ...base, type: 'restart' };
    expect(parseHubMessage(ev(msg, 'https://outro.test'), HUB, parent)).toBeNull();
    expect(parseHubMessage(ev(msg, HUB, { id: 'outro' }), HUB, parent)).toBeNull();
    expect(parseHubMessage(ev(msg), null, parent)).toBeNull();
  });

  it('rejeita mensagens sem source/v esperados ou com tipo desconhecido', () => {
    expect(parseHubMessage(ev({ type: 'restart' }), HUB, parent)).toBeNull();
    expect(parseHubMessage(ev({ source: 'flix-hub', v: 1, type: 'restart' }), HUB, parent)).toBeNull();
    expect(parseHubMessage(ev({ ...base, type: 'hack' }), HUB, parent)).toBeNull();
    expect(parseHubMessage(ev('texto'), HUB, parent)).toBeNull();
    expect(parseHubMessage(ev(null), HUB, parent)).toBeNull();
  });

  it('no init, avatar nulo ou inválido vira o personagem padrão', () => {
    const a = parseHubMessage(ev({ ...base, type: 'init', avatar: null, muted: false }), HUB, parent);
    expect(a).toMatchObject({ type: 'init', muted: false });
    expect(a && a.type === 'init' && a.avatar).toEqual(DEFAULT_AVATAR);
  });
});

describe('normalizeScore', () => {
  it('devolve inteiro não negativo', () => {
    expect(normalizeScore(12.9)).toBe(12);
    expect(normalizeScore(-5)).toBe(0);
    expect(normalizeScore(Number.NaN)).toBe(0);
    expect(normalizeScore(Infinity)).toBe(0);
  });
});
