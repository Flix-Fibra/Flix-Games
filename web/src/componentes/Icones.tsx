import type { CSSProperties, ReactNode } from 'react';
import type { Jogo } from '../dados/tipos';

export function Svg({ children }: { children: ReactNode }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">{children}</svg>;
}

const DESENHOS: Record<string, ReactNode> = {
  voo: <><path d="M4 13c3-5 8-6 12-4l4-2-1 4c0 4-4 7-9 7-3 0-5-1-6-2l3-1c-2 0-3-1-3-2z" /><circle cx="15" cy="10" r="1.2" fill="#000" /></>,
  labirinto: <path d="M3 3h18v18H3zm3 3v12h12V6zm3 3h6v6H9z" fillRule="evenodd" />,
  soma: <path d="M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z" opacity=".95" />,
  cobrinha: <><path d="M4 18h6v-6h6V6h4v4h-2v6h-6v6H4z" /><circle cx="19" cy="7.5" r="1" fill="#000" /></>,
  blocos: <path d="M4 14h5v5H4zm5 0h5v5H9zm5 0h5v5h-5zM9 9h5v5H9zM9 4h5v5H9z" />,
  corrida: <path d="M13 4a2 2 0 1 1 0 .01zM8 21l3-7 3 2v5h2v-6l-3-3 1-3c1 2 3 3 5 3v-2c-2 0-3-1-4-3l-1-1c-1 0-2 0-3 1L7 10v4h2v-3l2-1-4 11z" />,
  paciencia: <path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm5 4c-2 2-4 3-4 5a2 2 0 0 0 3.5 1.3L11 16h2l-.5-2.7A2 2 0 0 0 16 12c0-2-2-3-4-5z" />,
  memoria: <><path d="M3 5h8v14H3zm10 0h8v14h-8z" opacity=".95" /><path d="M7 10l1 2-1 2-1-2zm10 0l1 2-1 2-1-2z" fill="#000" /></>,
  golfe: <><path d="M11 3v15h2V9l6-3-6-3z" /><ellipse cx="12" cy="20" rx="6" ry="1.6" /></>,
  bola: <><circle cx="12" cy="12" r="8" /><path d="M12 7l3 2-1 4h-4l-1-4z" fill="#000" opacity=".55" /></>,
};

// Desenho de cada jogo do catálogo (G01–G15). Jogo novo sem desenho usa 'blocos'.
const DESENHO_DO_JOGO: Record<string, string> = {
  g01: 'corrida', g02: 'voo', g03: 'cobrinha', g04: 'soma', g05: 'labirinto', g06: 'golfe', g07: 'blocos', g08: 'labirinto',
  g09: 'soma', g10: 'blocos', g11: 'labirinto', g12: 'corrida', g13: 'bola', g14: 'memoria', g15: 'bola',
};

export const IconeJogo = ({ id }: { id: string }) => <Svg>{DESENHOS[DESENHO_DO_JOGO[id] ?? 'blocos']}</Svg>;

/** Endereço da capa do jogo (servida junto com o jogo, em /games/<pasta>/<capa>), ou null. */
export function urlDaCapa(jogo: Jogo): string | null {
  if (!jogo.pasta || !jogo.capa) return null;
  return `/games/${encodeURIComponent(jogo.pasta)}/${jogo.capa.split('/').map(encodeURIComponent).join('/')}`;
}

/** Endereço da prévia animada do jogo (também servida junto com o jogo), ou null. */
/** Endereço de um arquivo dentro da pasta do jogo (capa, prévia, telas), com cada trecho do caminho escapado. */
export function urlNoJogo(jogo: Jogo, caminho: string): string {
  return `/games/${encodeURIComponent(jogo.pasta ?? '')}/${caminho.split('/').map(encodeURIComponent).join('/')}`;
}

export function urlDaPrevia(jogo: Jogo): string | null {
  if (!jogo.pasta || !jogo.previa) return null;
  return urlNoJogo(jogo, jogo.previa);
}

/** Capa do jogo (imagem que vem do próprio jogo); sem capa, o ícone desenhado. */
export function CapaJogo({ jogo }: { jogo: Jogo }) {
  const url = urlDaCapa(jogo);
  // capa cujo arquivo termina em "-cheia" (ex.: capa-cheia.png) preenche o quadrado todo, em vez de ficar com margem
  const cheia = /-cheia\.[a-z]+$/.test(jogo.capa ?? '');
  return url ? <img className={'gx-capa-img' + (cheia ? ' gx-capa-cheia' : '')} src={url} alt="" loading="lazy" decoding="async" draggable={false} /> : <IconeJogo id={jogo.id} />;
}

/** Quadradinho colorido com a capa do jogo */
export function Mini({ jogo }: { jogo: Jogo }) {
  return (
    <span className="gx-mini" style={{ '--t1': jogo.cor1, '--t2': jogo.cor2 } as CSSProperties}>
      <CapaJogo jogo={jogo} />
    </span>
  );
}

export const Trofeu = () => <Svg><path d="M7 4h10v3a5 5 0 0 1-4 4.9V15h3v3H8v-3h3v-3.1A5 5 0 0 1 7 7zM4 5h2v2a2 2 0 0 1-2-2zm16 0a2 2 0 0 1-2 2V5z" /></Svg>;
/**
 * Coração do botão Favoritar: contorno + preenchimento vermelho. Marcado, o vermelho preenche o coração; com
 * `animar` (só logo depois do clique), o coração dá um "pulo" e o vermelho se expande de dentro para fora.
 */
export function CoracaoFavorito({ cheio, animar }: { cheio: boolean; animar: boolean }) {
  return (
    <svg className={'gx-coracao' + (cheio ? ' cheio' : '') + (animar ? ' anima' : '')} viewBox="0 0 24 24" aria-hidden="true">
      <path className="gx-coracao-cheio" d="M12 21s-7.5-4.6-9.5-9.3C1.1 8.3 3.3 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.7 0 5.9 3.8 4.5 7.2C19.5 16.4 12 21 12 21z" />
      <path className="gx-coracao-contorno" d="M12 21s-7.5-4.6-9.5-9.3C1.1 8.3 3.3 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.7 0 5.9 3.8 4.5 7.2C19.5 16.4 12 21 12 21z" />
    </svg>
  );
}

export const Coracao = () => <Svg><path d="M12 21s-7.5-4.6-9.5-9.3C1.1 8.3 3.3 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.7 0 5.9 3.8 4.5 7.2C19.5 16.4 12 21 12 21z" /></Svg>;
/** Lápis: editar perfil (Gerenciar perfis). */
export const Lapis = () => <Svg><path d="M4 17.2V20h2.8l8.3-8.3-2.8-2.8zm12.7-7.5 1.6-1.6a1 1 0 0 0 0-1.4l-1.3-1.3a1 1 0 0 0-1.4 0L14 7z" /></Svg>;
export const Lixeira = () => <Svg><path d="M9 3h6l1 2h4v2H4V5h4zM6 9h12l-1 12H7z" /></Svg>;
export const Play = () => <Svg><path d="M8 5v14l11-7z" /></Svg>;
export const Barras = () => <Svg><path d="M4 20V10h4v10zm6 0V4h4v16zm6 0v-7h4v7z" /></Svg>;
export const Casa = () => <Svg><path d="M3 11 12 4l9 7v9h-6v-6H9v6H3z" /></Svg>;
export const Controle = () => (
  <Svg><path d="M7 7h10a5 5 0 0 1 4.9 6l-.8 3.8a2.5 2.5 0 0 1-4.3 1.2L14.5 16h-5l-2.3 2a2.5 2.5 0 0 1-4.3-1.2L2.1 13A5 5 0 0 1 7 7zm1 3v1.5H6.5v2H8V15h2v-1.5h1.5v-2H10V10zm7.5 1a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zm2.5-2a1.2 1.2 0 1 0 0 2.4A1.2 1.2 0 0 0 18 9z" /></Svg>
);
/** Megafone: card de Novidades do Início. */
export const Megafone = () => <Svg><path d="M3 10v4a1 1 0 0 0 1 1h2l1.2 4.2a1 1 0 0 0 1 .8H10l-1.3-5H9l8 4V5L9 9H4a1 1 0 0 0-1 1zm16-1.5v7a3.5 3.5 0 0 0 0-7z" /></Svg>;
export const Pessoa = () => <Svg><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6z" /></Svg>;
export const Trocar = () => (
  <Svg><path d="M7 7h11l-3-3m3 3-3 3M17 17H6l3 3m-3-3 3-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></Svg>
);
export const Camera = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
);

const APARELHO: Record<'cel' | 'pc' | 'tab', ReactNode> = {
  cel: <><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></>,
  pc: <><rect x="3" y="4.5" width="18" height="12" rx="2" /><path d="M2 19.5h20" /></>,
  tab: <><rect x="4.5" y="2.5" width="15" height="19" rx="2.5" /><path d="M11 18.5h2" /></>,
};
export const IconeAparelho = ({ tipo }: { tipo: 'cel' | 'pc' | 'tab' }) => <Svg>{APARELHO[tipo]}</Svg>;

/** Ícones de traço da barra do jogo (mesmo estilo entre si: linha 2, pontas arredondadas). */
function Traco({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>
  );
}
export const Fechar = () => <Traco><path d="M6 6l12 12M18 6 6 18" /></Traco>;
export const TelaCheia = ({ ligada }: { ligada: boolean }) => (
  <Traco>{ligada
    ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
    : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}</Traco>
);
export const Som = ({ mudo }: { mudo: boolean }) => (
  <Traco>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
    {mudo ? <path d="M16 9.5l5 5M21 9.5l-5 5" /> : <path d="M15.5 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />}
  </Traco>
);

/** Lupa: campo de pesquisa da aba Jogos. */
export const Lupa = () => (
  <Svg><path d="M10.5 3a7.5 7.5 0 0 1 5.9 12.1l4.2 4.2-1.4 1.4-4.2-4.2A7.5 7.5 0 1 1 10.5 3zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z" /></Svg>
);
