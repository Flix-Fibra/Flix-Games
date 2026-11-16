"""Aplica as migrações SQL de api/migracoes em ordem, uma vez cada.

Uso: python -m app.migracoes
Trava (advisory lock) para dois processos não aplicarem ao mesmo tempo.
"""
from pathlib import Path

import psycopg

from .config import config

PASTA = Path(__file__).resolve().parent.parent / "migracoes"
TRAVA = 715_001  # número fixo da trava deste projeto


def aplicar(database_url: str | None = None) -> list[str]:
    aplicadas: list[str] = []
    with psycopg.connect(database_url or config.database_url, autocommit=True) as c:
        c.execute("SELECT pg_advisory_lock(%s)", (TRAVA,))
        try:
            c.execute(
                "CREATE TABLE IF NOT EXISTS schema_migracoes (nome TEXT PRIMARY KEY, aplicada_em TIMESTAMPTZ NOT NULL DEFAULT now())"
            )
            feitas = {r[0] for r in c.execute("SELECT nome FROM schema_migracoes")}
            for arquivo in sorted(PASTA.glob("*.sql")):
                if arquivo.name in feitas:
                    continue
                with c.transaction():  # migração inteira ou nada
                    c.execute(arquivo.read_text(encoding="utf-8"))
                    c.execute("INSERT INTO schema_migracoes (nome) VALUES (%s)", (arquivo.name,))
                aplicadas.append(arquivo.name)
        finally:
            c.execute("SELECT pg_advisory_unlock(%s)", (TRAVA,))
    return aplicadas


if __name__ == "__main__":
    feitas = aplicar()
    print("Migrações aplicadas:", ", ".join(feitas) if feitas else "nenhuma (banco já atualizado)")
