import type { Perfil } from './tipos';

// Checagem no aparelho só para ajudar quem digita. A validação e a moderação de verdade são no servidor (Q25).
const RE_APELIDO = /^[A-Za-zÀ-ÿ0-9 _-]{3,20}$/;

export function limparApelido(v: string): string {
  return v.trim().replace(/\s+/g, ' ');
}

/** Devolve a mensagem de erro, ou null se o nickname pode ser usado (o apelido é o nickname). */
export function validarApelido(v: string, perfis: Perfil[], excetoId: string | null): string | null {
  if (!RE_APELIDO.test(v)) return 'Use de 3 a 20 caracteres: letras, números, espaço, _ ou -.';
  const repetido = perfis.some((p) => p.id !== excetoId && p.apelido.toLowerCase() === v.toLowerCase());
  return repetido ? 'Esse nickname já está em uso. Escolha outro.' : null; // a unicidade entre todas as contas é da API
}

export function iniciais(apelido: string): string {
  return apelido.replace(/[^A-Za-zÀ-ÿ0-9]/g, '').slice(0, 2).toUpperCase();
}

/** Limpa nome ou sobrenome para enviar: espaços repetidos saem; vazio vira null (apaga). */
export function limparNome(v: string): string | null {
  const s = v.trim().replace(/\s+/g, ' ');
  return s || null;
}

/** Nome completo para exibir ("Ana Clara Souza"), ou null sem nome. */
export function nomeCompleto(p: { nome: string | null; sobrenome: string | null }): string | null {
  return p.nome ? `${p.nome} ${p.sobrenome ?? ''}`.trim() : null;
}

const RE_NOME = /^[A-Za-zÀ-ÿ' -]+$/;
/** Nome ou sobrenome (obrigatórios): mensagem de erro, ou null se pode ser usado. A regra que vale é a da API. */
export function validarNome(v: string, campo: 'nome' | 'sobrenome'): string | null {
  const s = v.trim().replace(/\s+/g, ' ');
  const maximo = campo === 'nome' ? 40 : 60;
  if (!s) return `Preencha o ${campo}.`;
  if (s.length > maximo || !RE_NOME.test(s)) return `No ${campo}, use até ${maximo} caracteres: letras, espaço, hífen ou apóstrofo.`;
  return null;
}
