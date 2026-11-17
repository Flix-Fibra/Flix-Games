import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { Jogo } from '../dados/tipos';
import { CapaJogo } from './Icones';

interface Props {
  jogo: Jogo;
  /** Chamado quando a capa termina de se desfazer sobre o jogo. */
  onFim: () => void;
}

const DURACAO_MS = 700; // viagem (~520 ms) + desfazer (~180 ms), num movimento só, sem pausa
const CHEGADA = 0.74; // fração do tempo em que a capa chega ao quadro do jogo
// A curva vale por trecho (não no movimento inteiro): partida e chegada suaves na viagem; o desfazer é linear.
const VIAGEM = 'cubic-bezier(.4,0,.2,1)';

/** Capa visível do jogo na tela (marcada com data-capa), para a animação sair dela. */
function capaNaTela(id: string): DOMRect | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-capa="${CSS.escape(id)}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight) return r;
  }
  return null;
}

/**
 * Abertura do jogo: o jogo já abre no clique (por baixo, carregando) e a capa sai de onde está, viaja até o
 * centro do quadro do jogo e se desfaz enquanto o jogo aparece no mesmo lugar. Um movimento contínuo, sem pausa.
 */
export function Lancamento({ jogo, onFim }: Props) {
  const capa = useRef<HTMLDivElement>(null);
  const [origem] = useState(() => capaNaTela(jogo.id));

  // useLayoutEffect: a capa já nasce na posição de origem (sem piscar no canto da tela)
  useLayoutEffect(() => {
    const el = capa.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { onFim(); return; }

    // Destino: centro do quadro onde o jogo vai aparecer (o jogo já foi montado nesta mesma renderização)
    const q = document.querySelector('.gx-jogo-quadro')?.getBoundingClientRect();
    const alvo = q && q.width > 0 ? q : new DOMRect(0, 0, window.innerWidth, window.innerHeight);
    const lado = Math.min(260, alvo.width * 0.7, alvo.height * 0.45);
    el.style.width = el.style.height = `${lado}px`;
    const fim = { x: alvo.left + (alvo.width - lado) / 2, y: alvo.top + (alvo.height - lado) / 2 };
    const de = origem ?? new DOMRect(fim.x + lado * 0.2, fim.y + lado * 0.2, lado * 0.6, lado * 0.6);
    const esc = de.width / lado;

    const anim = el.animate(
      [
        { offset: 0, easing: VIAGEM, transform: `translate(${de.left}px, ${de.top}px) scale(${esc})`, opacity: origem ? 1 : 0, borderRadius: `${22 / esc}px` },
        { offset: CHEGADA, easing: 'linear', transform: `translate(${fim.x}px, ${fim.y}px) scale(1)`, opacity: 1, borderRadius: '40px' },
        { offset: 1, transform: `translate(${fim.x}px, ${fim.y}px) scale(1.04)`, opacity: 0, borderRadius: '40px' },
      ],
      { duration: DURACAO_MS, easing: 'linear', fill: 'forwards' },
    );
    anim.finished.then(onFim).catch(() => {});
    return () => anim.cancel();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="gx-lanca" aria-hidden="true">
      <div ref={capa} className="gx-lanca-capa" style={{ '--t1': jogo.cor1, '--t2': jogo.cor2 } as CSSProperties}>
        <CapaJogo jogo={jogo} />
      </div>
    </div>
  );
}
