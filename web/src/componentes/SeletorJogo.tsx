import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { normalizarBusca } from '../dados/formatar';
import type { Jogo } from '../dados/tipos';
import { Lupa, Mini } from './Icones';

interface Props {
  jogos: Jogo[];
  atual: Jogo;
  onEscolher: (jogo: Jogo) => void;
}

/** A partir de quantos jogos a lista ganha o campo de pesquisa (abaixo disso, a lista inteira cabe de uma olhada). */
const PESQUISA_A_PARTIR_DE = 6;

/**
 * Escolha do jogo no ranking: um botão só, com o jogo atual, que abre a lista dos jogos com pesquisa. Ocupa o mesmo
 * espaço com 6 ou com 60 jogos (a fileira de etiquetas crescia a cada jogo novo). Teclado: ↑ ↓ andam na lista,
 * Enter escolhe, Esc fecha e devolve o foco ao botão.
 */
export function SeletorJogo({ jogos, atual, onEscolher }: Props) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [destaque, setDestaque] = useState(0);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const id = useId();

  const termo = normalizarBusca(busca);
  const visiveis = termo ? jogos.filter((j) => normalizarBusca(j.nome).includes(termo)) : jogos;
  const comPesquisa = jogos.length >= PESQUISA_A_PARTIR_DE;

  // Ao abrir: pesquisa limpa, destaque no jogo atual e foco no campo (ou na lista, quando não há campo)
  useEffect(() => {
    if (!aberto) return;
    setBusca('');
    setDestaque(Math.max(0, jogos.findIndex((j) => j.id === atual.id)));
    (comPesquisa ? campo.current : lista.current)?.focus();
    // Toque ou clique fora fecha
    const fora = (e: PointerEvent) => { if (!raiz.current?.contains(e.target as Node)) setAberto(false); };
    document.addEventListener('pointerdown', fora);
    return () => document.removeEventListener('pointerdown', fora);
  }, [aberto]); // só ao abrir/fechar: trocar de jogo com a lista aberta não deve reiniciar a pesquisa

  // Mantém o item destacado visível ao andar com as setas
  useEffect(() => {
    if (aberto) lista.current?.querySelector<HTMLElement>(`[data-i="${destaque}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [destaque, aberto]);

  const fechar = () => { setAberto(false); botao.current?.focus(); };
  const escolher = (j: Jogo) => { onEscolher(j); fechar(); };

  function teclas(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); fechar(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setDestaque((d) => Math.min(d + 1, visiveis.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setDestaque((d) => Math.max(d - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); const j = visiveis[destaque]; if (j) escolher(j); }
  }

  const opcao = (i: number) => `${id}-op-${i}`;
  return (
    <div className="gx-seletor" ref={raiz}>
      <button ref={botao} type="button" className="gx-seletor-botao" aria-haspopup="listbox" aria-expanded={aberto}
        aria-label={`Jogo do ranking: ${atual.nome}. Trocar de jogo`} onClick={() => setAberto((a) => !a)}>
        <Mini jogo={atual} />
        <span className="gx-seletor-nome">{atual.nome}</span>
        <svg className="gx-seletor-seta" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>

      {aberto && (
        <div className="gx-seletor-painel" onKeyDown={teclas}>
          {comPesquisa && (
            <label className="gx-busca gx-seletor-busca">
              <Lupa />
              <input ref={campo} type="search" value={busca} placeholder={`Pesquisar entre ${jogos.length} jogos`}
                aria-label="Pesquisar jogo" autoComplete="off" role="combobox" aria-expanded="true" aria-controls={`${id}-lista`}
                aria-activedescendant={visiveis[destaque] ? opcao(destaque) : undefined}
                onChange={(e) => { setBusca(e.target.value); setDestaque(0); }} />
            </label>
          )}
          <ul ref={lista} id={`${id}-lista`} className="gx-seletor-lista" role="listbox" aria-label="Jogos com ranking"
            tabIndex={comPesquisa ? -1 : 0} aria-activedescendant={!comPesquisa && visiveis[destaque] ? opcao(destaque) : undefined}>
            {visiveis.map((j, i) => (
              <li key={j.id} id={opcao(i)} data-i={i} role="option" aria-selected={j.id === atual.id}
                className={'gx-seletor-opcao' + (i === destaque ? ' destaque' : '')}
                onPointerMove={() => setDestaque(i)} onClick={() => escolher(j)}>
                <Mini jogo={j} />
                <span className="gx-seletor-texto"><strong>{j.nome}</strong><small>{j.metrica}</small></span>
                {j.id === atual.id && (
                  <svg className="gx-seletor-marca" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                )}
              </li>
            ))}
            {visiveis.length === 0 && <li className="gx-seletor-vazio">Nenhum jogo com “{busca.trim()}” no nome.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
