/**
 * Tela cheia no celular: o navegador só permite depois de um gesto do usuário, então entra no primeiro toque na tela
 * (em computador não muda nada: lá o hub tem o botão ⛶). Dentro do hub (iframe) o pedido só vale porque o iframe tem
 * `allow="fullscreen"`; se falhar (ex.: iPhone, que não suporta), o jogo segue normalmente.
 * Serve para jogos Phaser (a escala "fit" acompanha o redimensionamento da janela) e para jogos sem Phaser.
 */
export function telaCheiaNoToque(alvo: HTMLElement = document.documentElement): void {
  if (typeof window === 'undefined' || !window.matchMedia('(pointer: coarse)').matches) return;
  const entrar = () => {
    window.removeEventListener('pointerup', entrar);
    try {
      if (document.fullscreenElement || !document.fullscreenEnabled) return;
      void alvo.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
    } catch {
      /* sem suporte */
    }
  };
  window.addEventListener('pointerup', entrar);
}
