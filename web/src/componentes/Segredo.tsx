import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { carregarCatalogo, urlDaFoto, type Catalogo, type PersonagemFlix } from '../personagem/flix';

/**
 * Easter egg do editor de personagem: um ponto minúsculo no canto superior direito. Clicou, aparece o personagem
 * secreto (foto nítida); "Usar" coloca ele na prévia do editor (salva com o botão normal). Não aparece nas abas.
 */
export function Segredo({ onUsar }: { onUsar: (p: PersonagemFlix) => void }) {
  const [aberto, setAberto] = useState(false);
  const [cat, setCat] = useState<Catalogo | null>(null);

  useEffect(() => { void carregarCatalogo().then(setCat).catch(() => {}); }, []);
  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [aberto]);

  const secreto = cat?.visuais.find((v) => v.categoria === 'secreto');
  const foto = secreto ? urlDaFoto(secreto) : null;

  function usar() {
    if (!secreto) return;
    onUsar({ v: 4, motor: 'flix', corpo: secreto.corpo, visual: secreto.id });
    setAberto(false);
  }

  if (!secreto) return null; // sem o personagem secreto no catálogo (ex.: repositório sem a foto), nada de ponto

  return (
    <>
      <button type="button" className="gx-segredo" aria-label="Segredo" title="" onClick={() => setAberto(true)} />
      {aberto && createPortal(
        <div className="gx-segredo-fundo" role="dialog" aria-modal="true" aria-label="Personagem secreto" onClick={() => setAberto(false)}>
          <div className="gx-segredo-cartao" onClick={(e) => e.stopPropagation()}>
            {foto ? <img src={foto} alt="Personagem secreto" draggable={false} /> : <div className="gx-segredo-carregando" />}
            <p className="gx-segredo-titulo">Você achou o personagem secreto 👀</p>
            <div className="gx-segredo-acoes">
              <button type="button" className="btn light" onClick={() => setAberto(false)}>Fechar</button>
              <button type="button" className="btn" onClick={usar} disabled={!secreto}>Usar como personagem</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
