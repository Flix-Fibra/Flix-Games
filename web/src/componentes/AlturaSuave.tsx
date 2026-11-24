import { useLayoutEffect, useRef, type ReactNode } from 'react';

/**
 * Caixa cuja altura acompanha o conteúdo com transição, em vez de saltar: quando o conteúdo muda de tamanho (outro
 * filtro, um detalhe que abre), a altura desliza até o novo valor. A medida vem de um ResizeObserver (o navegador
 * avisa quando muda; nada é medido a cada quadro). Com "reduzir movimento", a altura muda direto (CSS).
 */
export function AlturaSuave({ children }: { children: ReactNode }) {
  const caixa = useRef<HTMLDivElement>(null);
  const miolo = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const c = caixa.current;
    const m = miolo.current;
    if (!c || !m) return;
    const medir = () => { c.style.height = `${m.offsetHeight}px`; };
    medir(); // primeira medida antes da pintura: a caixa já nasce com a altura certa, sem animar
    const obs = new ResizeObserver(medir);
    obs.observe(m);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={caixa} className="gx-altura-suave">
      <div ref={miolo}>{children}</div>
    </div>
  );
}
