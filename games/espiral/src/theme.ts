/**
 * Identidade visual do G14: arcade 3D fosco. Torre de telecom vermelha e branca (aço pintado), placas de metal
 * grafite, alta tensão em listras vermelhas e a bola vermelha viva. Cada marco de 10 andares troca só o cenário
 * (céu e cidade); o que é jogável (placas, perigo, bola, torre) não muda de cor.
 */
export const FLIX_RED = '#d4142c';
export const FONT = '"Trebuchet MS", Verdana, sans-serif';

export interface Palette {
  name: string;
  sky: number; // neblina (mistura os andares de baixo com o horizonte)
  plate: number; // fatia sólida
  plateEdge: number; // borda clara da fatia
  pole: number; // suportes metálicos
  band: number; // trechos coloridos da treliça
  // Céu em degradê (backdrop.ts): só aparece numa fase sem arte de fundo; `horizon` também colore a neblina
  top: string; // céu no alto
  horizon: string; // céu embaixo
  /** Arte da equipe para o fundo inteiro (céu e bairro numa imagem, em `public/img/`). */
  fundo?: string;
}

/** Cenários em ordem; depois do último, volta ao primeiro. */
export const PALETTES: Palette[] = [
  {
    name: 'Fim de tarde', sky: 0x7a4a6e, plate: 0xe9e4f2, plateEdge: 0xffffff, pole: 0x8a8f9c, band: 0xd4142c,
    top: '#292441', horizon: '#D39172', fundo: 'img/fundos/fim-de-tarde.jpg',
  },
  {
    name: 'Noite na cidade', sky: 0x1a2550, plate: 0x7fa6ff, plateEdge: 0xc7d7ff, pole: 0x5b6274, band: 0xd4142c,
    top: '#050a1c', horizon: '#26325e', fundo: 'img/fundos/noite-na-cidade.jpg',
  },
  {
    name: 'Amanhecer', sky: 0xf2b58a, plate: 0x3a3550, plateEdge: 0x6b6385, pole: 0xc9c2b5, band: 0xd4142c,
    top: '#6d8fd1', horizon: '#ffcf9e', fundo: 'img/fundos/amanhecer.jpg',
  },
  {
    name: 'Céu limpo', sky: 0x9ad6f5, plate: 0x1f2a44, plateEdge: 0x3c4c74, pole: 0xe8eef5, band: 0xd4142c,
    top: '#2f8fd8', horizon: '#c4ecff', fundo: 'img/fundos/ceu-limpo.jpg',
  },
  {
    name: 'Tempestade', sky: 0x3a414c, plate: 0xb6f0d2, plateEdge: 0xeafff4, pole: 0x6f7780, band: 0xf5c04a,
    top: '#14181e', horizon: '#4a525e', fundo: 'img/fundos/tempestade.jpg',
  },
];

export const DANGER = { red: '#F04450', stripe: '#9F1829' }; // alta tensão: listras diagonais
export const PLATE = { top: 0x414a56, side: 0x252c35 }; // placa: topo grafite médio, laterais grafite escuro
export const STEEL = { red: 0xb91f35, white: 0xe4e7eb, antenna: 0xd7dce2 }; // torre (aço pintado) e antenas
export const BALL_HEX = '#FF3349'; // bola: vermelho vivo, acetinada
export const SIGNAL = 0x37e2ff; // bônus de sinal e escudo

export function paletteFor(phase: number): Palette {
  return PALETTES[phase % PALETTES.length] ?? PALETTES[0]!;
}
