/** Visões do personagem (AVATAR_SPEC.md). Neste momento só `portrait` existe como placeholder. */
export type AvatarView = 'side' | 'top' | 'portrait' | 'fp_hands';
export type Expression = 'neutral' | 'happy' | 'sad';

/** Objeto enviado pelo hub na mensagem `init`. Só contém IDs do catálogo, nunca cor livre nem texto. */
export interface AvatarConfig {
  v: 1;
  body: { type: string; skinTone: string };
  face: { eyes: string; mouth: string };
  hair: { style: string; color: string } | null;
  top: { item: string; primary: string; secondary?: string } | null;
  bottom: { item: string; primary: string; secondary?: string } | null;
  shoes: { item: string; primary: string } | null;
  hat: { item: string; primary?: string } | null;
  accessories: string[];
  skinPreset: string | null;
}

export interface ColorSwatch {
  base: string;
  shade: string;
}
