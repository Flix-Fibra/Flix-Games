import { createContext, useContext } from 'react';

/**
 * Plataforma congelada: verdadeiro enquanto um jogo está aberto por cima dela. A página de trás para de trabalhar:
 * nenhuma animação, transição, laço de desenho (plasma), leitura de controle ou imagem animada roda, e ela não
 * responde a teclado, toque nem foco (atributo `inert`). Ao fechar o jogo, tudo volta de onde parou.
 */
export const Congelada = createContext(false);

export const usePlataformaCongelada = () => useContext(Congelada);
