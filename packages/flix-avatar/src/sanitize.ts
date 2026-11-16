import catalog from './catalog.json';
import palettes from './palettes.json';
import type { AvatarConfig, ColorSwatch } from './types';

const d = catalog.defaults;

/** Personagem padrão (inicial): careca, com brilho na cabeça. Usado quando o hub não envia nada ou envia algo inválido. */
export const DEFAULT_AVATAR: AvatarConfig = {
  v: 1,
  body: { type: d.body, skinTone: d.skinTone },
  face: { eyes: d.eyes, mouth: d.mouth },
  hair: null,
  top: { item: d.top, primary: d.clothColor },
  bottom: { item: d.bottom, primary: 'c02' },
  shoes: { item: d.shoes, primary: 'c06' },
  hat: null,
  accessories: [],
  skinPreset: null,
};

type Rec = Record<string, unknown>;

function isRec(x: unknown): x is Rec {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function pick(value: unknown, allowed: readonly string[], fallback: string): string {
  return typeof value === 'string' && allowed.includes(value) ? value : fallback;
}

const skinIds = Object.keys(palettes.skin);
const hairIds = Object.keys(palettes.hair);
const clothIds = Object.keys(palettes.cloth);

/**
 * Valida um objeto vindo do hub contra o catálogo. Nunca lança erro:
 * valor desconhecido vira o item padrão; objeto inválido vira o personagem padrão.
 */
export function sanitizeAvatar(raw: unknown): AvatarConfig {
  if (!isRec(raw) || raw.v !== 1) return structuredCloneSafe(DEFAULT_AVATAR);
  const body = isRec(raw.body) ? raw.body : {};
  const face = isRec(raw.face) ? raw.face : {};
  const out: AvatarConfig = {
    v: 1,
    body: {
      type: pick(body.type, catalog.bodies, d.body),
      skinTone: pick(body.skinTone, skinIds, d.skinTone),
    },
    face: {
      eyes: pick(face.eyes, catalog.eyes, d.eyes),
      mouth: pick(face.mouth, catalog.mouths, d.mouth),
    },
    hair: null,
    top: null,
    bottom: null,
    shoes: null,
    hat: null,
    accessories: [],
    skinPreset: null,
  };

  if (raw.hair === null) {
    out.hair = null;
  } else if (isRec(raw.hair)) {
    out.hair = {
      style: pick(raw.hair.style, catalog.hairStyles, d.hairStyle),
      color: pick(raw.hair.color, hairIds, d.hairColor),
    };
  } else {
    out.hair = null; // sem cabelo informado: fica careca, como o personagem inicial
  }

  if (isRec(raw.top)) {
    out.top = { item: pick(raw.top.item, catalog.tops, d.top), primary: pick(raw.top.primary, clothIds, d.clothColor) };
  } else if (raw.top !== null) {
    out.top = { item: d.top, primary: d.clothColor };
  }

  if (isRec(raw.bottom)) {
    out.bottom = { item: pick(raw.bottom.item, catalog.bottoms, d.bottom), primary: pick(raw.bottom.primary, clothIds, 'c02') };
  } else if (raw.bottom !== null) {
    out.bottom = { item: d.bottom, primary: 'c02' };
  }

  if (isRec(raw.shoes)) {
    out.shoes = { item: pick(raw.shoes.item, catalog.shoes, d.shoes), primary: pick(raw.shoes.primary, clothIds, 'c06') };
  } else if (raw.shoes !== null) {
    out.shoes = { item: d.shoes, primary: 'c06' };
  }

  if (isRec(raw.hat)) {
    out.hat = { item: pick(raw.hat.item, catalog.hats, catalog.hats[0] ?? 'hat01_cap'), primary: pick(raw.hat.primary, clothIds, d.clothColor) };
  }

  if (Array.isArray(raw.accessories)) {
    out.accessories = raw.accessories
      .filter((a): a is string => typeof a === 'string' && (catalog.accessories as string[]).includes(a))
      .slice(0, 3);
  }

  out.skinPreset =
    typeof raw.skinPreset === 'string' && catalog.skinPresets.includes(raw.skinPreset) ? raw.skinPreset : null;

  return out;
}

function structuredCloneSafe(a: AvatarConfig): AvatarConfig {
  return JSON.parse(JSON.stringify(a)) as AvatarConfig;
}

/** Impressão digital estável da configuração, usada como chave de cache. */
export function avatarFingerprint(config: AvatarConfig): string {
  return JSON.stringify(config);
}

export function skinSwatch(config: AvatarConfig): ColorSwatch {
  return (palettes.skin as Record<string, ColorSwatch>)[config.body.skinTone] ?? palettes.skin.sk01;
}

export function hairSwatch(color: string): ColorSwatch {
  return (palettes.hair as Record<string, ColorSwatch>)[color] ?? palettes.hair.hc01;
}

export function clothSwatch(color: string | undefined): ColorSwatch {
  return (palettes.cloth as Record<string, ColorSwatch>)[color ?? d.clothColor] ?? palettes.cloth.c01;
}

/** Cor principal (base e sombra) do personagem. O G03 usa para pintar o cabo com volume. */
export function primarySwatch(config: AvatarConfig): ColorSwatch {
  return config.skinPreset === 'flix_tech' ? clothSwatch('c01') : clothSwatch(config.top?.primary);
}

/** Cor principal do personagem (a roupa de cima). Usada pelos jogos, por exemplo para pintar o cabo do G03. */
export function primaryColor(config: AvatarConfig): string {
  if (config.skinPreset === 'flix_tech') return palettes.cloth.c01.base;
  return clothSwatch(config.top?.primary).base;
}
