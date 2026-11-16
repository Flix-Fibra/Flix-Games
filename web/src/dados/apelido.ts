import type { Perfil } from './tipos';

// Checagem no aparelho só para ajudar quem digita. A validação e a moderação de verdade são no servidor (Q25).
const RE_APELIDO = /^[A-Za-zÀ-ÿ0-9 _-]{3,20}$/;

export function limparApelido(v: string): string {
  return v.trim().replace(/\s+/g, ' ');
}

/** Devolve a mensagem de erro, ou null se o apelido pode ser usado. */
export function validarApelido(v: string, perfis: Perfil[], excetoId: string | null): string | null {
  if (!RE_APELIDO.test(v)) return 'Use de 3 a 20 caracteres: letras, números, espaço, _ ou -.';
  const repetido = perfis.some((p) => p.id !== excetoId && p.apelido.toLowerCase() === v.toLowerCase());
  return repetido ? 'Esse apelido já está em uso nesta conta.' : null;
}

export function iniciais(apelido: string): string {
  return apelido.replace(/[^A-Za-zÀ-ÿ0-9]/g, '').slice(0, 2).toUpperCase();
}
