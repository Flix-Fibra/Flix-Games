import type { Jogo } from './tipos';

const num = (n: number) => n.toLocaleString('pt-BR');

/** Pontuação como o cliente entende: tempo em m:ss,cc; o resto com a unidade do jogo. */
export function formatarPontos(valor: number, unidade: string): string {
  if (unidade === 'ms') {
    const min = Math.floor(valor / 60000);
    const seg = Math.floor((valor % 60000) / 1000);
    const cent = Math.floor((valor % 1000) / 10);
    return `${min}:${String(seg).padStart(2, '0')},${String(cent).padStart(2, '0')}`;
  }
  return `${num(valor)} ${unidade}`;
}

/** Só o número (pódio e listas, onde a unidade aparece à parte). */
export function formatarNumero(valor: number, unidade: string): string {
  return unidade === 'ms' ? formatarPontos(valor, unidade) : num(valor);
}

export function regraDoRanking(j: Jogo): string {
  return j.ordem === 'menor' ? `Vence o menor: ${j.metrica.toLowerCase()}` : `Vence o maior: ${j.metrica.toLowerCase()}`;
}

export function rotuloUnidade(unidade: string): string {
  return unidade === 'ms' ? 'tempo' : unidade;
}

export function tipoAparelho(nome: string): 'cel' | 'pc' | 'tab' {
  if (/iPad/i.test(nome)) return 'tab';
  if (/iPhone|Android/i.test(nome)) return 'cel';
  return 'pc';
}

export function vistoHa(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 2) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.round(h / 24)} dias`;
}
