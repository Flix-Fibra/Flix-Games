/**
 * "GAMES" em letras pixeladas (grade 7x7 por letra, traço de 2 pixels), desenhado em SVG: sem fonte externa,
 * nítido em qualquer tamanho. Usado ao lado do oval da FLIX no topo.
 */
const LETRAS: Record<string, string[]> = {
  // traço de 2 pixels (letras grossas), grade 7x7
  G: ['.#####.', '##...##', '##.....', '##.####', '##...##', '##...##', '.#####.'],
  A: ['.#####.', '##...##', '##...##', '#######', '##...##', '##...##', '##...##'],
  M: ['##...##', '###.###', '##.#.##', '##.#.##', '##...##', '##...##', '##...##'],
  E: ['#######', '##.....', '##.....', '######.', '##.....', '##.....', '#######'],
  S: ['.######', '##.....', '##.....', '.#####.', '.....##', '.....##', '######.'],
};

const PALAVRA = 'GAMES';
const LARGURA = PALAVRA.length * 8 - 1;

const pixels = PALAVRA.split('').flatMap((l, i) =>
  LETRAS[l]!.flatMap((linha, y) => linha.split('').map((c, x) => (c === '#' ? [i * 8 + x, y] : null)).filter((p): p is number[] => !!p)),
);

export function LogoGames({ altura = 18 }: { altura?: number }) {
  return (
    <svg viewBox={`0 0 ${LARGURA + 0.6} 7.6`} height={altura} width={(altura * (LARGURA + 0.6)) / 7.6}
      style={{ height: altura, width: (altura * (LARGURA + 0.6)) / 7.6 }} shapeRendering="crispEdges" role="img" aria-label="Games" className="logo-games">
      {/* sombra de 1 pixel para destacar em fundo claro ou escuro */}
      {pixels.map(([x, y]) => <rect key={`s${x}-${y}`} x={x! + 0.6} y={y! + 0.6} width="1" height="1" fill="rgba(0,0,0,.45)" />)}
      {pixels.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="currentColor" />)}
    </svg>
  );
}
