import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

/** Aviso curto no rodapé (toast). Use: const avisar = useAviso(); avisar('Salvo!') */
const Ctx = createContext<(msg: string) => void>(() => {});

export function ProvedorAviso({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState('');
  const [visivel, setVisivel] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const avisar = useCallback((m: string) => {
    setMsg(m);
    setVisivel(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setVisivel(false), 2400);
  }, []);

  return (
    <Ctx.Provider value={avisar}>
      {children}
      <div className={'gx-toast' + (visivel ? ' on' : '')} role="status" aria-live="polite">{msg}</div>
    </Ctx.Provider>
  );
}

export const useAviso = () => useContext(Ctx);
