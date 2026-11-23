import { useEffect, useRef, useState } from 'react';
import type { Jogo } from '../dados/tipos';
import { usePlataformaCongelada } from './Congelada';
import { urlDaPrevia, urlNoJogo } from './Icones';

interface Item { src: string; alt: string; animacao: boolean }

/**
 * Galeria da página "Ver": primeiro a animação do jogo em ação (prévia), depois as telas do jogo. Passa de card em
 * card com setas discretas nas laterais (somem quando não há mais para onde ir); no toque, também arrastando.
 * Com "reduzir movimento", a animação dá lugar à primeira tela parada.
 */
export function GaleriaJogo({ jogo }: { jogo: Jogo }) {
  const congelada = usePlataformaCongelada();
  const previa = urlDaPrevia(jogo);
  const telas = (jogo.imagens ?? []).map((c, i) => ({ src: urlNoJogo(jogo, c), alt: `Tela ${i + 1} de ${jogo.nome}`, animacao: false }));
  const itens: Item[] = [...(previa ? [{ src: previa, alt: `${jogo.nome} em ação`, animacao: true }] : []), ...telas];

  const trilho = useRef<HTMLDivElement>(null);
  const [podeVoltar, setPodeVoltar] = useState(false);
  const [podeAvancar, setPodeAvancar] = useState(false);

  // As setas aparecem conforme a posição da rolagem (avisada pelo navegador, sem consultar a cada quadro)
  useEffect(() => {
    const el = trilho.current;
    if (!el) return;
    const conferir = () => {
      setPodeVoltar(el.scrollLeft > 4);
      setPodeAvancar(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };
    conferir();
    el.addEventListener('scroll', conferir, { passive: true });
    // A moldura não muda de largura quando uma imagem carrega; os cards mudam. Por isso observa os dois.
    const obs = new ResizeObserver(conferir);
    obs.observe(el);
    for (const card of Array.from(el.children)) obs.observe(card);
    return () => { el.removeEventListener('scroll', conferir); obs.disconnect(); };
  }, [jogo.id, itens.length]);

  if (itens.length === 0) return null;

  // Uma seta = um card (a largura do card visível mais o espaço entre eles)
  const passar = (dir: 1 | -1) => {
    const el = trilho.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    const passo = card ? card.offsetWidth + 12 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * passo, behavior: 'smooth' });
  };
  const parada = telas[0]?.src;
  // Jogo aberto por cima: a animação vira a primeira tela parada (uma imagem WebP animada não pausa por CSS)
  const srcAnimacao = (src: string) => (congelada && parada ? parada : src);

  return (
    <div className="gx-galeria" aria-label={`Imagens de ${jogo.nome}`} role="region">
      <div ref={trilho} className="gx-galeria-trilho">
        {itens.map((it) => (
          <figure key={it.src} className={'gx-galeria-card' + (it.animacao ? ' animacao' : '')}>
            {it.animacao ? (
              <picture>
                {parada && <source srcSet={parada} media="(prefers-reduced-motion: reduce)" />}
                <img src={srcAnimacao(it.src)} alt={it.alt} draggable={false} decoding="async" />
              </picture>
            ) : (
              <img src={it.src} alt={it.alt} draggable={false} decoding="async" loading="lazy" />
            )}
            {it.animacao && <figcaption className="gx-galeria-selo">Em ação</figcaption>}
          </figure>
        ))}
      </div>
      {podeVoltar && (
        <button type="button" className="gx-galeria-seta esq" onClick={() => passar(-1)} aria-label="Imagem anterior">‹</button>
      )}
      {podeAvancar && (
        <button type="button" className="gx-galeria-seta dir" onClick={() => passar(1)} aria-label="Próxima imagem">›</button>
      )}
    </div>
  );
}
