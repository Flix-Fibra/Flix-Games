"""Testes contra um Postgres de verdade, num banco separado (flixgames_teste), recriado a cada execução.

Rodar: docker compose run --rm api pytest -q
"""
import os
import uuid

import psycopg
import pytest

# Precisa ser antes de importar o app: a configuração é lida na importação.
_URL_PRINCIPAL = os.environ["DATABASE_URL"]
_BASE, _, _ = _URL_PRINCIPAL.rpartition("/")
URL_TESTE = f"{_BASE}/flixgames_teste"
os.environ["DATABASE_URL"] = URL_TESTE
os.environ["MODO"] = "desenvolvimento"

with psycopg.connect(_URL_PRINCIPAL, autocommit=True) as _c:
    _c.execute("DROP DATABASE IF EXISTS flixgames_teste WITH (FORCE)")
    _c.execute("CREATE DATABASE flixgames_teste")

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.migracoes import aplicar  # noqa: E402

aplicar(URL_TESTE)
with psycopg.connect(URL_TESTE, autocommit=True) as _c:
    _c.execute("UPDATE jogos SET publicado = (id <> 'g10')")

CABECALHO = {"X-Flix-Games": "1"}


@pytest.fixture(scope="session")
def app_ativo():
    with TestClient(app) as tc:  # abre o pool (lifespan)
        yield tc


def novo_cliente(app_ativo, ref: str | None = None) -> TestClient:
    """Um aparelho novo, logado (login simulado) numa conta própria."""
    c = TestClient(app, headers=CABECALHO)
    r = c.post("/api/dev/entrar", json={"clienteRef": ref or f"T-{uuid.uuid4().hex[:10].upper()}"})
    assert r.status_code == 204, r.text
    return c


def novo(apelido: str, **extra) -> dict:
    """Corpo de criação de perfil: nickname, mais nome e sobrenome (obrigatórios)."""
    return {"apelido": apelido, "nome": "Teste", "sobrenome": "Flix", **extra}


def com_perfil(app_ativo, apelido: str = "Jogador1", ref: str | None = None) -> tuple[TestClient, str]:
    c = novo_cliente(app_ativo, ref)
    r = c.post("/api/perfis", json=novo(apelido))
    assert r.status_code == 201, r.text
    pid = r.json()["id"]
    assert c.put("/api/sessao/perfil", json={"perfilId": pid}).status_code == 204
    return c, pid


def sql(consulta: str, *args):
    with psycopg.connect(URL_TESTE, autocommit=True) as c:
        cur = c.execute(consulta, args)
        return cur.fetchall() if cur.description else None
