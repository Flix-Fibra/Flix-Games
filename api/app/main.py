"""Flix Games — API (hub). Só atende em 127.0.0.1; o HTTPS fica no nginx do servidor."""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from . import rotas_conta, rotas_jogos
from .config import config
from .db import conexao, pool


@asynccontextmanager
async def ciclo(_: FastAPI):
    pool.open(wait=True, timeout=30)
    yield
    pool.close()


app = FastAPI(
    title="Flix Games API",
    lifespan=ciclo,
    # Documentação interativa só em desenvolvimento
    docs_url="/api/docs" if config.desenvolvimento else None,
    redoc_url=None,
    openapi_url="/api/openapi.json" if config.desenvolvimento else None,
)

METODOS_QUE_ALTERAM = {"POST", "PUT", "PATCH", "DELETE"}


@app.middleware("http")
async def protecao_csrf(request: Request, call_next):
    """Toda alteração exige o cabeçalho X-Flix-Games. Outro site não consegue enviá-lo
    sem passar pelo CORS (que não liberamos), então não consegue agir em nome do cliente."""
    if request.method in METODOS_QUE_ALTERAM and request.headers.get("x-flix-games") != "1":
        return JSONResponse({"detail": "Requisição recusada."}, status_code=403)
    resposta = await call_next(request)
    resposta.headers["Cache-Control"] = "no-store"
    resposta.headers["X-Content-Type-Options"] = "nosniff"
    return resposta


@app.get("/api/saude")
def saude() -> dict:
    """Confere o banco de verdade (serviço 'no ar' não prova que funciona)."""
    for c in conexao():
        c.execute("SELECT 1")
    return {"ok": True}


app.include_router(rotas_conta.router)
app.include_router(rotas_jogos.router)
