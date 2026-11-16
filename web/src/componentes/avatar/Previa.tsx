import type { AvatarConfig, CatalogoAvatar } from '../../dados/tipos';

/**
 * PLACEHOLDER: silhueta neutra com as cores escolhidas, sem traços de rosto.
 * A arte final (pixel art desenhada à mão) vem do designer — ver docs/briefing-personagem.md —
 * e será desenhada pelo compositor do packages/flix-avatar (seção 9.5 do prompt dos minigames).
 */

export function avatarPadrao(cat: CatalogoAvatar): AvatarConfig {
  return {
    v: 1,
    body: { type: cat.corpos[0]!.id, skinTone: cat.paletas.pele[5]!.id },
    face: { eyes: cat.olhos[0]!.id, mouth: cat.bocas[0]!.id },
    hair: { style: cat.cabelos[0]!.id, color: cat.paletas.cabelo[1]!.id },
    top: { item: cat.camisetas[0]!.id, primary: cat.paletas.roupa[0]!.id },
    bottom: { item: cat.calcas[0]!.id, primary: cat.paletas.roupa[4]!.id },
    shoes: { item: cat.calcados[0]!.id, primary: cat.paletas.roupa[2]!.id },
    hat: null,
    accessories: [],
    skinPreset: null,
  };
}

const cor = (lista: { id: string; hex: string }[], id: string | null | undefined, padrao: string) => lista.find((c) => c.id === id)?.hex ?? padrao;

export function Previa({ avatar, cat, tamanho = 160 }: { avatar: AvatarConfig; cat: CatalogoAvatar; tamanho?: number }) {
  const skin = avatar.skinPreset;
  const pele = cor(cat.paletas.pele, avatar.body.skinTone, '#C98B63');
  const cabelo = avatar.hair && !skin ? cor(cat.paletas.cabelo, avatar.hair.color, '#3B2A20') : null;
  const longo = avatar.hair?.style === 'cabelo-longo' || avatar.hair?.style === 'cabelo-crespo' || avatar.hair?.style === 'cabelo-cacheado';
  const roupa = skin === 'skin-tecnico-flix' ? '#D4142C' : skin === 'skin-astronauta' ? '#E4E9EF' : skin === 'skin-ninja' ? '#2B2B33'
    : cor(cat.paletas.roupa, avatar.top?.primary, '#D4142C');
  const chapeu = skin === 'skin-tecnico-flix' ? '#F2F2F4' : !skin && avatar.hat ? cor(cat.paletas.roupa, avatar.hat.primary, '#2773D2') : null;

  return (
    <svg viewBox="0 0 64 64" width={tamanho} height={tamanho} style={{ width: tamanho, height: tamanho }} role="img"
      aria-label="Prévia simplificada do personagem" className="gx-av-previa">
      {cabelo && longo && <path d="M15 26C15 9 49 9 49 26V48H15Z" fill={cabelo} />}
      <path d="M8 64C8 51 18 45 32 45S56 51 56 64Z" fill={roupa} />
      <rect x="28" y="38" width="8" height="9" rx="3" fill={pele} />
      <ellipse cx="32" cy="27" rx="12" ry="14" fill={pele} />
      {cabelo && <path d="M19.5 25C19 15 25 11 32 11S45 15 44.5 25C41 20 37 18.5 32 18.5S23 20 19.5 25Z" fill={cabelo} />}
      {chapeu && <path d="M18.5 21C18.5 11 25 8 32 8S45.5 11 45.5 21ZM16 20H51V23H16Z" fill={chapeu} />}
    </svg>
  );
}
