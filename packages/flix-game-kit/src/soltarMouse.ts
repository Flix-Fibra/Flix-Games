/**
 * Jogos que prendem o mouse (Pointer Lock): além do Esc do navegador, o jogador solta o mouse com o BOTÃO DIREITO
 * ou a tecla P. O Esc, no Chrome, também sai da tela cheia e minimiza a página do hub, o que atrapalha.
 * Ao soltar, o navegador dispara `pointerlockchange` (o jogo pausa por ele). Devolve a função que desliga os ouvintes.
 */
export const DICA_SOLTAR_MOUSE = 'Botão direito ou P solta o mouse';

export function soltarMouseSemEsc(): () => void {
  const soltar = (e: Event): void => {
    if (!document.pointerLockElement) return;
    e.preventDefault();
    e.stopPropagation();
    document.exitPointerLock();
  };
  const tecla = (e: KeyboardEvent): void => {
    if (e.code === 'KeyP' && !e.repeat) soltar(e);
  };
  const botao = (e: MouseEvent): void => {
    if (e.button === 2) soltar(e);
  };
  // fase de captura: chega antes do jogo (o clique direito não vira ação dentro da partida)
  window.addEventListener('keydown', tecla, true);
  window.addEventListener('mousedown', botao, true);
  return () => {
    window.removeEventListener('keydown', tecla, true);
    window.removeEventListener('mousedown', botao, true);
  };
}
