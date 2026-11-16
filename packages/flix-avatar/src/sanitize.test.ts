import { describe, expect, it } from 'vitest';
import { DEFAULT_AVATAR, avatarFingerprint, primaryColor, sanitizeAvatar } from './sanitize';

describe('sanitizeAvatar', () => {
  it('o personagem inicial é careca', () => {
    expect(DEFAULT_AVATAR.hair).toBeNull();
    expect(sanitizeAvatar({ v: 1 }).hair).toBeNull();
  });

  it('devolve o personagem padrão para entradas inválidas', () => {
    for (const bad of [null, undefined, 42, 'x', [], {}, { v: 2 }]) {
      expect(sanitizeAvatar(bad)).toEqual(DEFAULT_AVATAR);
    }
  });

  it('troca IDs desconhecidos pelo item padrão', () => {
    const out = sanitizeAvatar({
      v: 1,
      body: { type: 'zzz', skinTone: '#ff0000' },
      face: { eyes: 'e02', mouth: 'nope' },
      hair: { style: 'h02_long', color: 'rosa' },
      top: { item: 't02_hoodie', primary: 'c03' },
    });
    expect(out.body).toEqual({ type: 'b01', skinTone: 'sk01' });
    expect(out.face).toEqual({ eyes: 'e02', mouth: 'm01' });
    expect(out.hair).toEqual({ style: 'h02_long', color: 'hc01' });
    expect(out.top).toEqual({ item: 't02_hoodie', primary: 'c03' });
  });

  it('aceita cabelo nulo (sem cabelo) e limita acessórios', () => {
    const out = sanitizeAvatar({ v: 1, hair: null, accessories: ['a', 'b', 'c', 'd'] });
    expect(out.hair).toBeNull();
    expect(out.accessories.length).toBeLessThanOrEqual(3);
  });

  it('é determinístico: mesma configuração gera a mesma impressão digital', () => {
    const a = sanitizeAvatar({ v: 1, top: { item: 't01_tee', primary: 'c02' } });
    const b = sanitizeAvatar({ v: 1, top: { item: 't01_tee', primary: 'c02' } });
    expect(avatarFingerprint(a)).toBe(avatarFingerprint(b));
  });

  it('a cor principal vem da roupa de cima', () => {
    const out = sanitizeAvatar({ v: 1, top: { item: 't01_tee', primary: 'c02' } });
    expect(primaryColor(out)).toBe('#2F6FDE');
  });
});
