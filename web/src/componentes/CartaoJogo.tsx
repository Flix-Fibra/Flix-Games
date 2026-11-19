import { useState, type CSSProperties } from 'react';
import type { Jogo } from '../dados/tipos';
import { useAviso } from './Aviso';
import { CapaJogo, CoracaoFavorito, Lixeira, Play } from './Icones';
import { NotaEstrelas } from './NotaEstrelas';

interface Props {
  jogo: Jogo;
  favorito: boolean;
  onJogar: (jogo: Jogo) => void;
  onVer: (jogo: Jogo) => void;
  onFavoritar: (jogo: Jogo) => Promise<void>;
  /**
   * `alternar` (aba Jogos): coração que favorita e desfavorita sem abrir o jogo.
   * `remover` (Favoritos do Início): lixeira, que tira o jogo da lista.
   */
  favoritoComo?: 'alternar' | 'remover';
}

/** Cartão de jogo com capa, nome, nota em estrelas, gênero e os botões Jogar, Ver e coração (ou lixeira). Mesmo cartão na aba Jogos e nos Favoritos. */
export function CartaoJogo({ jogo: j, favorito, onJogar, onVer, onFavoritar, favoritoComo = 'alternar' }: Props) {
  const avisar = useAviso();
  const [animar, setAnimar] = useState(false);
  const alternar = () => {
    setAnimar(!favorito);
    onFavoritar(j)
      .then(() => avisar(favorito ? `${j.nome} saiu dos favoritos` : `${j.nome} está nos favoritos`))
      .catch((e: Error) => avisar(e.message));
  };

  return (
    <li className="gx-cartao-jogo">
      <button type="button" data-capa={j.id} className="gx-cartao-capa" style={{ '--t1': j.cor1, '--t2': j.cor2 } as CSSProperties}
        onClick={() => onVer(j)} aria-label={`Ver ${j.nome}`}>
        <CapaJogo jogo={j} />
      </button>
      <span className="gx-cartao-info">
        <strong>{j.nome}</strong>
        <NotaEstrelas avaliacao={j.avaliacao} />
        <small>{j.genero}</small>
      </span>
      <span className="gx-cartao-botoes">
        <button type="button" className="gx-cartao-jogar" onClick={() => onJogar(j)}><Play />{j.pasta ? 'Jogar' : 'Em breve'}</button>
        <button type="button" className="gx-cartao-ver" onClick={() => onVer(j)}>Ver</button>
        {favoritoComo === 'remover' ? (
          <button type="button" className="gx-cartao-fav gx-cartao-remover" onClick={alternar}
            aria-label={`Remover ${j.nome} dos favoritos`} title="Remover dos favoritos">
            <Lixeira />
          </button>
        ) : (
          <button type="button" className="gx-cartao-fav" onClick={alternar} aria-pressed={favorito}
            aria-label={favorito ? `Remover ${j.nome} dos favoritos` : `Favoritar ${j.nome}`} title={favorito ? 'Remover dos favoritos' : 'Favoritar'}>
            <CoracaoFavorito cheio={favorito} animar={animar} />
          </button>
        )}
      </span>
    </li>
  );
}
