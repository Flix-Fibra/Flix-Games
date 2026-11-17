import { useEffect, useRef, useState } from 'react';
import { desenharSeMudou, renderer } from '../../lpc/motor';
import { usarMotor } from '../../lpc/usarMotor';

/** Linhas da folha universal do LPC (sources/state/constants.ts): andar começa na 8; cada direção é uma linha. */
const ANDAR = { linha: 8, quadros: [1, 2, 3, 4, 5, 6, 7, 8] };
export const DIRECOES = ['up', 'left', 'down', 'right'] as const;
const Q = 64; // tamanho de cada quadro

/**
 * Prévia em tempo real: o renderizador ORIGINAL do LPC compõe as camadas na folha de sprites,
 * e aqui só copiamos o quadro da animação para um canvas maior, sem borrar (pixelated).
 */
export function PreviaLpc({ tamanho = 256, direcao = 2, animar = true }: { tamanho?: number; direcao?: number; animar?: boolean }) {
  const { versao } = usarMotor();
  const tela = useRef<HTMLCanvasElement>(null);
  const [pronto, setPronto] = useState(0);

  // Recompõe só quando o personagem muda (desenharSeMudou ignora avisos que não mudam o desenho)
  useEffect(() => {
    let ativo = true;
    desenharSeMudou().then(() => { if (ativo) setPronto((n) => n + 1); }).catch(() => {});
    return () => { ativo = false; };
  }, [versao]);

  // Anima o andar copiando o quadro atual da folha composta pelo LPC
  useEffect(() => {
    const ctx = tela.current?.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    let i = 0, quadro = 0, ultimo = 0;
    const pintar = (t: number) => {
      const folha = renderer.canvas;
      if (folha && (t - ultimo > 110 || ultimo === 0)) {
        ultimo = t;
        const col = animar ? ANDAR.quadros[i++ % ANDAR.quadros.length]! : 0;
        ctx.clearRect(0, 0, Q, Q);
        ctx.drawImage(folha, col * Q, (ANDAR.linha + direcao) * Q, Q, Q, 0, 0, Q, Q);
      }
      if (animar) quadro = requestAnimationFrame(pintar);
    };
    quadro = requestAnimationFrame(pintar);
    return () => cancelAnimationFrame(quadro);
  }, [pronto, direcao, animar]);

  return <canvas ref={tela} width={Q} height={Q} className="lpc-previa" role="img" aria-label="Seu personagem"
    style={{ width: tamanho, height: tamanho, imageRendering: 'pixelated' }} />;
}
