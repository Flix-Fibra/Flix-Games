/**
 * Celular em pé: o Flix Runner é um jogo deitado. Mostra um aviso "GIRE O CELULAR" (fonte pixel dos jogos Flix) até a
 * pessoa deitar o aparelho. O navegador do iPhone não deixa a página girar a tela sozinha, então o aviso é o caminho.
 */
import { renderHudText } from '@flix/game-kit/src/hudFont';

const emPe = () => window.innerHeight > window.innerWidth;
let aviso: HTMLDivElement | null = null;

function mostrarAviso(mostrar: boolean): void {
  if (!aviso) {
    aviso = document.createElement('div');
    aviso.setAttribute('role', 'alert');
    aviso.style.cssText =
      'position:fixed;inset:0;z-index:10;display:none;flex-direction:column;align-items:center;justify-content:center;gap:18px;' +
      'background:#0a1640;touch-action:none';
    // celular desenhado com CSS (contorno), girando para deitar
    const cel = document.createElement('div');
    cel.style.cssText =
      'width:46px;height:80px;border:5px solid #fff;border-radius:9px;box-shadow:0 0 0 4px #0b1530;' +
      'animation:flix-girar 1.6s ease-in-out infinite';
    const estilo = document.createElement('style');
    estilo.textContent =
      '@keyframes flix-girar{0%,25%{transform:rotate(0)}55%,85%{transform:rotate(-90deg)}100%{transform:rotate(0)}}' +
      '.flix-pix canvas{display:block;image-rendering:pixelated}';
    const linha = (texto: string, px: number, cor?: string) => {
      const c = renderHudText(texto, cor);
      c.style.width = `${c.width * px}px`;
      c.style.height = `${c.height * px}px`;
      const d = document.createElement('div');
      d.className = 'flix-pix';
      d.appendChild(c);
      return d;
    };
    aviso.append(estilo, cel, linha('GIRE O CELULAR', 4, '#f6e7c1'), linha('O FLIX RUNNER É JOGADO DEITADO', 2));
    document.body.appendChild(aviso);
  }
  aviso.style.display = mostrar ? 'flex' : 'none';
}

/** Resolve quando a tela estiver deitada (na hora, se não for celular ou se já estiver deitada). */
export function esperarPaisagem(toque: boolean): Promise<void> {
  if (!toque || !emPe()) return Promise.resolve();
  mostrarAviso(true);
  return new Promise((ok) => {
    const ver = () => {
      if (emPe()) return;
      window.removeEventListener('resize', ver);
      mostrarAviso(false);
      // espera a barra do navegador assentar depois do giro, para medir a tela certa
      window.setTimeout(ok, 250);
    };
    window.addEventListener('resize', ver);
  });
}

/** Avisa quando a pessoa gira o celular durante o jogo (true = ficou em pé) e mostra/esconde o aviso. */
export function aoGirar(cb: (emPe: boolean) => void): void {
  let antes = emPe();
  window.addEventListener('resize', () => {
    const agora = emPe();
    if (agora === antes) return;
    antes = agora;
    mostrarAviso(agora);
    cb(agora);
  });
}
