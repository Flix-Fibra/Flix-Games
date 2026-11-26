"""Acesso da equipe ao site no ar enquanto o login do cliente (API Própria) não está liberado.

Cada pessoa tem usuário e senha. No servidor fica só o hash scrypt da senha com sal (arquivo de segredo do compose, uma
linha por pessoa: `usuario:sal_hex:hash_hex`), gerado com scripts/deploy/codigo_equipe.py. A senha nunca passa por log,
chat ou repositório. O arquivo é lido a cada tentativa: cadastrar ou remover alguém vale na hora.
"""
import hashlib
import hmac
import re

from .config import config

RE_NOME = re.compile(r"^[a-z0-9-]{2,30}$")
SCRYPT = {"n": 2**14, "r": 8, "p": 1, "dklen": 32}


def hash_codigo(codigo: str, sal: bytes) -> bytes:
    return hashlib.scrypt(codigo.encode(), salt=sal, **SCRYPT)


def _linhas() -> list[tuple[str, bytes, bytes]]:
    try:
        with open(config.equipe_arquivo, encoding="utf-8") as f:
            texto = f.read()
    except OSError:
        return []
    saida = []
    for linha in texto.splitlines():
        partes = linha.strip().split(":")
        if len(partes) != 3 or not RE_NOME.fullmatch(partes[0]):
            continue
        try:
            saida.append((partes[0], bytes.fromhex(partes[1]), bytes.fromhex(partes[2])))
        except ValueError:
            continue
    return saida


def conferir(usuario: str, senha: str) -> str | None:
    """O usuário, se a senha confere; senão None. Usuário inexistente também calcula um hash (tempo parecido)."""
    usuario = usuario.strip().lower()
    for nome, sal, h in _linhas():
        if nome == usuario:
            return nome if hmac.compare_digest(hash_codigo(senha, sal), h) else None
    hash_codigo(senha, b"\x00" * 16)
    return None
