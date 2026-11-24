import { useEffect, useState } from 'react';

/**
 * Respostas já recebidas, por chave. Voltar a uma tela já vista mostra o resultado na hora e busca de novo por trás
 * (o ranking muda quando outros jogam). Limite simples: as 60 mais recentes.
 */
const guardadas = new Map<string, unknown>();
const LIMITE = 60;

function guardar(chave: string, dados: unknown) {
  guardadas.delete(chave);
  guardadas.set(chave, dados);
  if (guardadas.size > LIMITE) guardadas.delete(guardadas.keys().next().value!);
}

export interface Busca<T> {
  /** Dados da chave pedida (da rede ou guardados); `null` enquanto não chegam. */
  dados: T | null;
  /** Para telas que trocam sem piscar: os dados da chave pedida ou, enquanto não chegam, os da chave anterior. */
  ultimos: T | null;
  /** Chave a que `ultimos` pertence (serve de `key` para animar a troca de conteúdo). */
  chaveDosUltimos: string | null;
  /** Pedido em andamento sem nada guardado para a chave atual: a tela mostra `ultimos` esmaecido. */
  carregando: boolean;
  erro: boolean;
}

/**
 * Busca com troca suave: ao mudar a `chave`, os dados anteriores continuam disponíveis até os novos chegarem, em vez
 * de a tela esvaziar e encher de novo. `chave` null = nada a buscar. `buscar` é lido só quando a chave muda.
 */
export function useBusca<T>(chave: string | null, buscar: () => Promise<T>): Busca<T> {
  const [estado, setEstado] = useState<{ chave: string; dados: T } | null>(null);
  const [erroDe, setErroDe] = useState<string | null>(null);

  useEffect(() => {
    if (chave === null) return;
    let ativo = true; // resposta atrasada de uma chave antiga não sobrescreve a atual
    buscar()
      .then((d) => { guardar(chave, d); if (ativo) { setEstado({ chave, dados: d }); setErroDe(null); } })
      .catch(() => { if (ativo) setErroDe(chave); });
    return () => { ativo = false; };
  }, [chave]); // `buscar` é recriado a cada renderização; o que define o pedido é a chave

  // Já na renderização (não num efeito, que piscaria por um quadro): a chave pedida tem dados guardados?
  const daChave = chave === null ? undefined
    : estado?.chave === chave ? estado.dados
    : (guardadas.get(chave) as T | undefined);
  const temDaChave = daChave !== undefined;
  return {
    dados: temDaChave ? daChave : null,
    ultimos: temDaChave ? daChave : estado?.dados ?? null,
    chaveDosUltimos: temDaChave ? chave : estado?.chave ?? null,
    carregando: chave !== null && !temDaChave && erroDe !== chave,
    erro: chave !== null && erroDe === chave,
  };
}
