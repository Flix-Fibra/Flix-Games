import { useEffect, useRef } from 'react';
import { composePortrait, sanitizeAvatar } from '@flix/avatar';
import type { AvatarConfig, CatalogoAvatar } from '../../dados/tipos';

/**
 * Retrato do personagem desenhado pelo MESMO compositor dos jogos (packages/flix-avatar, seção 9.5):
 * o que o cliente vê no editor é o que aparece no jogo. Quando o designer entregar o kit,
 * a arte muda lá dentro e esta tela acompanha sozinha.
 */
export function avatarPadrao(cat: CatalogoAvatar): AvatarConfig {
  return JSON.parse(JSON.stringify(cat.padrao)) as AvatarConfig;
}

export function Previa({ avatar, tamanho = 160 }: { avatar: AvatarConfig; cat?: CatalogoAvatar; tamanho?: number }) {
  const tela = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = tela.current?.getContext('2d');
    if (!ctx) return;
    const retrato = composePortrait(sanitizeAvatar(avatar), 'happy');
    ctx.clearRect(0, 0, retrato.width, retrato.height);
    ctx.drawImage(retrato, 0, 0);
  }, [avatar]);
  return (
    <canvas ref={tela} width={32} height={32} className="gx-av-previa" role="img" aria-label="Prévia do personagem"
      style={{ width: tamanho, height: tamanho, imageRendering: 'pixelated' }} />
  );
}
