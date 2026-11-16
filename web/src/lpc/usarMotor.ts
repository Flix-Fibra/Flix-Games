import { useSyncExternalStore } from 'react';
import { assinar, obterMotor, versaoAtual } from './motor';

/** Redesenha o componente sempre que o estado do LPC muda (o `redraw` do LPC vira uma nova versão). */
export function usarMotor() {
  const versao = useSyncExternalStore(assinar, versaoAtual);
  const { catalogo, estado } = obterMotor();
  return { versao, catalogo, estado };
}
