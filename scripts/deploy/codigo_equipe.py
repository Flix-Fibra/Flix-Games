#!/usr/bin/env python3
"""
Cadastra (ou troca, ou remove) a senha de acesso de uma pessoa da equipe (usuário = nome) no Flix Games do servidor.

A senha é digitada sem aparecer na tela e nunca é gravado: no arquivo fica só o hash scrypt com sal, o mesmo que a
API confere (api/app/equipe.py). Vale na hora, sem reiniciar nada.

Uso no servidor:
  sudo python3 /opt/flix-games/app/scripts/deploy/codigo_equipe.py rafael          # cadastra ou troca
  sudo python3 /opt/flix-games/app/scripts/deploy/codigo_equipe.py tobias --remover
"""
import getpass
import hashlib
import os
import re
import secrets
import sys

ARQUIVO = os.environ.get("EQUIPE_ARQUIVO", "/opt/flix-games/segredos/equipe")
UID_API = 10001  # usuário da API dentro do contêiner (api/Dockerfile)
SCRYPT = {"n": 2**14, "r": 8, "p": 1, "dklen": 32}  # igual a api/app/equipe.py


def main() -> None:
    if len(sys.argv) < 2 or not re.fullmatch(r"[a-z0-9-]{2,30}", sys.argv[1]):
        raise SystemExit("Informe o nome (minúsculas, sem espaço), ex.: rafael")
    nome = sys.argv[1]
    linhas = []
    if os.path.exists(ARQUIVO):
        with open(ARQUIVO, encoding="utf-8") as f:
            linhas = [l for l in f.read().splitlines() if l.strip() and not l.startswith(nome + ":")]
    if "--remover" not in sys.argv:
        codigo = getpass.getpass(f"Senha para {nome} (mínimo 8 caracteres, não aparece na tela): ")
        if len(codigo) < 8 or len(codigo) > 128:
            raise SystemExit("A senha precisa ter de 8 a 128 caracteres.")
        if getpass.getpass("Repita a senha: ") != codigo:
            raise SystemExit("Os dois não conferem. Nada foi alterado.")
        sal = secrets.token_bytes(16)
        linhas.append(f"{nome}:{sal.hex()}:{hashlib.scrypt(codigo.encode(), salt=sal, **SCRYPT).hex()}")
    # escreve no mesmo arquivo (mesmo inode): o contêiner enxerga a mudança sem reiniciar
    fd = os.open(ARQUIVO, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o400)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write("\n".join(linhas) + ("\n" if linhas else ""))
    os.chmod(ARQUIVO, 0o400)
    os.chown(ARQUIVO, UID_API, UID_API)
    print(f"{'Removido' if '--remover' in sys.argv else 'Cadastrado'}: {nome}. Pessoas com acesso: {len(linhas)}.")


if __name__ == "__main__":
    main()
