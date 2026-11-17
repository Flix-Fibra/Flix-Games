import { useState } from 'react';
import { CoracaoFavorito } from './Icones';

interface Props {
  favorito: boolean;
  onAlternar: () => Promise<void>;
  className?: string;
}

/**
 * Botão Favoritar/Favorito. Só o coração fica vermelho (o texto mantém a cor normal); ao favoritar, o coração
 * pula e se preenche. A animação toca só no clique, não ao abrir uma página de um jogo que já era favorito.
 */
export function BotaoFavoritar({ favorito, onAlternar, className = '' }: Props) {
  const [animar, setAnimar] = useState(false);
  return (
    <button type="button" className={'gx-btn gx-btn-sec gx-btn-fav ' + className} aria-pressed={favorito}
      onClick={() => { setAnimar(!favorito); void onAlternar(); }}>
      <CoracaoFavorito cheio={favorito} animar={animar} />
      <span>{favorito ? 'Favorito' : 'Favoritar'}</span>
    </button>
  );
}
