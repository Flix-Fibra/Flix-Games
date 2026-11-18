import { startTransition, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { fotoDoRosto } from '../personagem/flix';
import { iniciais } from '../dados/apelido';
import type { Aba, Perfil } from '../dados/tipos';
import { Barras, Casa, Controle, Pessoa } from './Icones';
import { LogoGames } from './LogoGames';

interface Props {
  aba: Aba;
  perfil: Perfil;
  onAba: (a: Aba) => void;
  onTrocarPerfil: () => void;
}

const ITENS: { aba: Aba; rotulo: string; Icone: () => ReactNode }[] = [
  { aba: 'inicio', rotulo: 'Início', Icone: Casa },
  { aba: 'jogos', rotulo: 'Jogos', Icone: Controle },
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

/** Foto do rosto do personagem criado; sem personagem (ou enquanto a foto fica pronta), as iniciais. */
function FotoDoPerfil({ perfil }: { perfil: Perfil }) {
  const [foto, setFoto] = useState<string | null>(null);
  const chave = perfil.personagem ? JSON.stringify(perfil.personagem) : '';
  useEffect(() => {
    setFoto(null);
    if (!perfil.personagem) return;
    let ativo = true;
    fotoDoRosto(perfil.personagem).then((url) => { if (ativo) setFoto(url); }).catch(() => {});
    return () => { ativo = false; };
  }, [perfil.id, chave]); // eslint-disable-line react-hooks/exhaustive-deps
  return foto ? <img className="avatar-foto" src={foto} alt="" draggable={false} /> : <>{iniciais(perfil.apelido)}</>;
}

export function Topo({ aba, perfil, onAba, onTrocarPerfil }: Props) {
  // Pílula de seleção: mede o botão ativo e desliza até ele. Na primeira medida não anima (nasce no lugar certo).
  const nav = useRef<HTMLElement>(null);
  // Seleção local: muda NA HORA do clique (a pílula já sai andando); a troca de página vem em seguida, sem travar
  // a animação (startTransition deixa o React desenhar a página nova sem bloquear os quadros da pílula).
  const [sel, setSel] = useState(aba);
  useEffect(() => setSel(aba), [aba]);
  const escolher = (a: Aba) => { setSel(a); startTransition(() => onAba(a)); };
  const [indicador, setIndicador] = useState({ x: 0, y: 0, w: 0, h: 0, pronto: false });
  useLayoutEffect(() => {
    const medir = () => {
      const el = nav.current?.querySelector<HTMLElement>(`[data-aba="${sel}"]`);
      setIndicador((atual) => ({ x: el?.offsetLeft ?? 0, y: el?.offsetTop ?? 0, w: el?.offsetWidth ?? 0, h: el?.offsetHeight ?? 0, pronto: atual.w > 0 }));
    };
    medir();
    window.addEventListener('resize', medir);
    void document.fonts?.ready.then(medir); // a largura muda quando a fonte termina de carregar
    return () => window.removeEventListener('resize', medir);
  }, [sel]);

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
        <nav className="gx-nav" aria-label="Seções" ref={nav}>
          {/* Pílula de seleção única: desliza até o botão escolhido (só no computador) */}
          <span className={'gx-nav-indicador' + (indicador.pronto ? ' pronto' : '')} aria-hidden="true"
            style={{ transform: `translate(${indicador.x}px, ${indicador.y}px)`, width: indicador.w, height: indicador.h, opacity: indicador.w ? 1 : 0 }} />
          {ITENS.map(({ aba: a, rotulo, Icone }) => (
            <button key={a} data-aba={a} className={'gx-nav-item' + (a === sel ? ' ativo' : '')} aria-current={a === aba ? 'page' : undefined} onClick={() => escolher(a)}>
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
            <FotoDoPerfil perfil={perfil} />
          </button>
        </div>
      </div>
    </header>
  );
}
