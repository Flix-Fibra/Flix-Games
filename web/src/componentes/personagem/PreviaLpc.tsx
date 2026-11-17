import { useEffect, useRef, useState } from 'react';
import { carregar, desenharQuandoPronto, desenharSeMudou, renderer, type PersonagemLpc } from '../../lpc/motor';
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

/**
 * Recorte do rosto no quadro de frente (parado) do LPC, dentro do quadro de 64×64: a cabeça começa por volta da
 * linha 15 e os olhos ficam na 30. 26×26 a partir da linha 12 pega o rosto inteiro, com respiro para o cabelo.
 */
const ROSTO = { x: 19, y: 12, lado: 26 };
const fotos = new Map<string, string>(); // personagem (JSON) → foto pronta
let filaFoto: Promise<unknown> = Promise.resolve();

/**
 * Foto fixa do rosto de um personagem SALVO, como imagem (data URL), para ícones pequenos (ex.: botão de perfil
 * do topo). É fixa de propósito: a prévia animada segue o motor ao vivo e mostraria mudanças não salvas do editor.
 * Uma foto por vez (o motor e o canvas do LPC são únicos) e com cache por personagem.
 */
export function fotoDoRosto(p: PersonagemLpc): Promise<string | null> {
  const chave = JSON.stringify(p);
  const pronta = fotos.get(chave);
  if (pronta) return Promise.resolve(pronta);
  const tarefa = filaFoto.catch(() => {}).then(async () => {
    await carregar(p);
    if (!(await desenharQuandoPronto())) return null;
    const folha = renderer.canvas as HTMLCanvasElement | undefined;
    if (!folha) return null;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(folha, ROSTO.x, (ANDAR.linha + 2) * Q + ROSTO.y, ROSTO.lado, ROSTO.lado, 0, 0, 64, 64);
    const url = c.toDataURL('image/png');
    fotos.set(chave, url);
    return url;
  });
  filaFoto = tarefa;
  return tarefa;
}
