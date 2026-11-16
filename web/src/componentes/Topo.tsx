import { useEffect, useState, type ReactNode } from 'react';
import { iniciais } from '../dados/apelido';
import type { Aba, Perfil } from '../dados/tipos';
import { Barras, Casa, Pessoa } from './Icones';
import { LogoGames } from './LogoGames';

interface Props {
  aba: Aba;
  perfil: Perfil;
  onAba: (a: Aba) => void;
  onTrocarPerfil: () => void;
}

const ITENS: { aba: Aba; rotulo: string; Icone: () => ReactNode }[] = [
  { aba: 'inicio', rotulo: 'Início', Icone: Casa },
  { aba: 'ranking', rotulo: 'Ranking', Icone: Barras },
  { aba: 'perfil', rotulo: 'Perfil', Icone: Pessoa },
];

function alternarTema() {
  const raiz = document.documentElement;
  const escuro = raiz.getAttribute('data-theme') === 'dark';
  if (escuro) raiz.removeAttribute('data-theme');
  else raiz.setAttribute('data-theme', 'dark');
  try { localStorage.setItem('flixgames-tema', escuro ? 'light' : 'dark'); } catch { /* sem storage */ }
}

export function Topo({ aba, perfil, onAba, onTrocarPerfil }: Props) {
  // Vidro escuro no topo depois de rolar (padrão Flix Pulse)
  const [rolado, setRolado] = useState(false);
  useEffect(() => {
    const f = () => setRolado(window.scrollY > 8);
    f();
    window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);

  return (
    <header className={rolado ? 'rolado' : undefined}>
      <div className="barra">
        <button className="marca" onClick={() => onAba('inicio')} aria-label="Flix Games, início">
          <img src="/logo-flix-chapada.png" alt="Flix" width={218} height={84} />
          <LogoGames altura={13} />
        </button>
        <nav className="gx-nav" aria-label="Seções">
          {ITENS.map(({ aba: a, rotulo, Icone }) => (
            <button key={a} className={'gx-nav-item' + (a === aba ? ' ativo' : '')} aria-current={a === aba ? 'page' : undefined} onClick={() => onAba(a)}>
              <Icone /><span>{rotulo}</span>
            </button>
          ))}
        </nav>
        <div className="acoes">
          <button className="theme-toggle" type="button" aria-label="Alternar tema claro/escuro" onClick={alternarTema}>
            <svg className="tema-sol" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
            <svg className="tema-lua" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" /></svg>
            <span className="tema-bola" />
          </button>
          <button className="avatar" type="button" aria-label="Trocar de perfil" style={{ background: perfil.cor }} onClick={onTrocarPerfil}>
            {iniciais(perfil.apelido)}
          </button>
        </div>
      </div>
    </header>
  );
}
