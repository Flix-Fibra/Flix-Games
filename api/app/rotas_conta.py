"""Login com CPF/CNPJ (API Própria), login simulado (só desenvolvimento), sessão, aparelhos, perfis e favoritos."""
import re
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException, Path, Request, Response
from pydantic import BaseModel, Field, field_validator
from psycopg.errors import CheckViolation, UniqueViolation

from . import travas
from .conferidor import Situacao, conferir, documento_valido
from .config import config
from .consultas import montar_perfil
from .sessao import COOKIE, Db, Sessao, criar_sessao

router = APIRouter(prefix="/api")

MAX_PERFIS = 4  # Q23 (era 2 até 18/11/2026)
# Paleta da cor de fundo do perfil (o jogador escolhe ao criar ou editar). Sem escolha, vem a primeira ainda não usada
# na conta. A interface lê esta lista de /api/sessao: uma fonte só. As 4 primeiras são as cores antigas.
# 16 cores em duas fileiras de 8 na tela; todas escuras o bastante para as iniciais brancas ficarem legíveis.
CORES = [
    "#D2232A", "#2773D2", "#7654C4", "#15803D", "#E8590C", "#DB2777", "#0E7490", "#4B5563",
    "#B45309", "#4D7C0F", "#0284C7", "#4338CA", "#9333EA", "#C026D3", "#BE123C", "#7C2D12",
]


def _cor_da_paleta(v: str | None) -> str | None:
    if v is None:
        return None
    v = v.upper()
    if v not in CORES:
        raise ValueError("Escolha uma das cores da paleta.")
    return v
RE_APELIDO = re.compile(r"^[A-Za-zÀ-ÿ0-9 _-]{3,20}$")
# Nome verdadeiro: letras (com acento), espaço, hífen e apóstrofo ("Ana Clara", "D'Ávila", "Silva-Souza")
RE_NOME = re.compile(r"^[A-Za-zÀ-ÿ' -]+$")
NICKNAME_EM_USO = "Esse nickname já está em uso. Escolha outro."  # único entre todos os jogadores (migração 009)
# [H] Lista mínima; a moderação de verdade (Q25) é revisão da equipe + denúncia.
PROIBIDOS = ("admin", "flix", "moderador", "suporte")


def _limpar_apelido(v: str) -> str:
    v = " ".join(v.split())
    if not RE_APELIDO.fullmatch(v):
        raise ValueError("Use de 3 a 20 caracteres: letras, números, espaço, _ ou -.")
    if any(p in v.lower() for p in PROIBIDOS):
        raise ValueError("Esse apelido não pode ser usado.")
    return v


def _limpar_nome(v: str | None, maximo: int, campo: str) -> str:
    """Nome ou sobrenome: obrigatórios (decisão do solicitante, 19/11/2026); fora do padrão é recusado."""
    v = " ".join((v or "").split())
    if not v:
        raise ValueError(f"Preencha o {campo}.")
    if len(v) > maximo or not RE_NOME.fullmatch(v):
        raise ValueError(f"Use até {maximo} caracteres: letras, espaço, hífen ou apóstrofo.")
    return v


class NovoPerfil(BaseModel):
    """Criação: nickname, nome e sobrenome obrigatórios; o nome só aparece no ranking com mostrarNome ligado."""

    apelido: str = Field(max_length=40)
    nome: str = Field(max_length=80)
    sobrenome: str = Field(max_length=120)
    mostrar_nome: bool = Field(default=False, alias="mostrarNome")
    cor: str | None = None

    @field_validator("cor")
    @classmethod
    def _cor(cls, v: str | None) -> str | None:
        return _cor_da_paleta(v)

    @field_validator("apelido")
    @classmethod
    def _apelido(cls, v: str) -> str:
        return _limpar_apelido(v)

    @field_validator("nome")
    @classmethod
    def _nome(cls, v: str) -> str:
        return _limpar_nome(v, 40, "nome")

    @field_validator("sobrenome")
    @classmethod
    def _sobrenome(cls, v: str) -> str:
        return _limpar_nome(v, 60, "sobrenome")


class AlteraPerfil(BaseModel):
    """Só os campos enviados mudam. Nome e sobrenome, quando enviados, não podem ficar vazios (são obrigatórios)."""

    apelido: str | None = Field(default=None, max_length=40)
    oculto: bool | None = None
    nome: str | None = Field(default=None, max_length=80)
    sobrenome: str | None = Field(default=None, max_length=120)
    mostrar_nome: bool | None = Field(default=None, alias="mostrarNome")
    cor: str | None = None

    @field_validator("cor")
    @classmethod
    def _cor(cls, v: str | None) -> str | None:
        return _cor_da_paleta(v)

    @field_validator("apelido")
    @classmethod
    def _apelido(cls, v: str | None) -> str | None:
        return None if v is None else _limpar_apelido(v)

    @field_validator("nome")
    @classmethod
    def _nome(cls, v: str | None) -> str:
        return _limpar_nome(v, 40, "nome")

    @field_validator("sobrenome")
    @classmethod
    def _sobrenome(cls, v: str | None) -> str:
        return _limpar_nome(v, 60, "sobrenome")


class EscolhaPerfil(BaseModel):
    perfil_id: UUID = Field(alias="perfilId")


class EntradaDev(BaseModel):
    cliente_ref: str = Field(default="DEV-0001", alias="clienteRef", pattern=r"^[A-Z0-9-]{3,40}$")


class Entrada(BaseModel):
    """CPF/CNPJ (aceita com pontos, traço e barra) e a senha do Minha Flix. A senha nunca é guardada nem registrada."""

    documento: str = Field(max_length=20)
    senha: str = Field(min_length=1, max_length=128, repr=False)

    @field_validator("documento")
    @classmethod
    def _documento(cls, v: str) -> str:
        d = re.sub(r"[.\-/\s]", "", v)
        if not documento_valido(d):
            raise ValueError("Confira o CPF ou CNPJ digitado.")
        return d


# Mensagens para o cliente (a API Própria pede: com o sistema fora, nunca dizer que a senha está errada)
MSG_SENHA = "CPF/CNPJ ou senha incorretos."
MSG_ESPERA = "Muitas tentativas. Espere alguns minutos e tente de novo."
MSG_SEM_GAMES = "Sua conta Flix ainda não tem o Flix Games. Fale com a Flix para ativar."
MSG_BLOQUEADO = "O acesso está suspenso por pendência no contrato. Regularize pelo Minha Flix para jogar."
MSG_FORA = "Não conseguimos conferir seu acesso agora. Tente de novo em alguns minutos."


def _do_dono(c, perfil_id: UUID, conta_id: int) -> None:
    """404 (e não 403) para não revelar que o perfil de outra conta existe."""
    if not c.execute("SELECT 1 FROM perfis WHERE id = %s AND conta_id = %s", (perfil_id, conta_id)).fetchone():
        raise HTTPException(404, "Perfil não encontrado.")


# ---------- Login do cliente: CPF/CNPJ + senha do Minha Flix, conferidos na API Própria ----------
@router.post("/entrar", status_code=204)
def entrar(dados: Entrada, request: Request, response: Response, c: Db) -> None:
    if not travas.pode_tentar(dados.documento, travas.ip_do_cliente(request)):
        raise HTTPException(429, MSG_ESPERA)
    r = conferir(dados.documento, dados.senha)
    if r.situacao is Situacao.SENHA_ERRADA:
        travas.senha_errada(dados.documento)
        raise HTTPException(401, MSG_SENHA)
    if r.situacao is Situacao.MUITAS_TENTATIVAS:
        raise HTTPException(429, MSG_ESPERA)
    if r.situacao is Situacao.SEM_GAMES:
        raise HTTPException(403, MSG_SEM_GAMES)
    if r.situacao is Situacao.BLOQUEADO:
        raise HTTPException(403, MSG_BLOQUEADO)
    if r.situacao is not Situacao.LIBERADO or not r.cliente_ref:
        raise HTTPException(503, MSG_FORA)
    travas.acertou(dados.documento)
    # Só o cliente_ref (código anônimo da API Própria) fica no banco; nunca o CPF/CNPJ
    conta = c.execute(
        "INSERT INTO contas (cliente_ref) VALUES (%s) ON CONFLICT (cliente_ref) DO UPDATE SET ativo = TRUE RETURNING id",
        (r.cliente_ref,),
    ).fetchone()
    assert conta is not None
    criar_sessao(c, conta["id"], request, response)


# ---------- Login simulado: só existe em desenvolvimento ----------
@router.post("/dev/entrar", status_code=204)
def entrar_simulado(dados: EntradaDev, request: Request, response: Response, c: Db) -> None:
    if not config.desenvolvimento:
        raise HTTPException(404)
    conta = c.execute(
        "INSERT INTO contas (cliente_ref) VALUES (%s) ON CONFLICT (cliente_ref) DO UPDATE SET cliente_ref = EXCLUDED.cliente_ref RETURNING id",
        (dados.cliente_ref,),
    ).fetchone()
    assert conta is not None
    criar_sessao(c, conta["id"], request, response)


# ---------- Sessão ----------
@router.get("/sessao")
def ver_sessao(s: Sessao, c: Db) -> dict:
    perfis = c.execute("SELECT id FROM perfis WHERE conta_id = %s ORDER BY criado_em", (s["conta_id"],)).fetchall()
    return {
        "perfilId": str(s["perfil_id"]) if s["perfil_id"] else None,
        "perfis": [montar_perfil(c, p["id"]) for p in perfis],
        "maxPerfis": MAX_PERFIS,
        "cores": CORES,
    }


@router.put("/sessao/perfil", status_code=204)
def escolher_perfil(dados: EscolhaPerfil, s: Sessao, c: Db) -> None:
    _do_dono(c, dados.perfil_id, s["conta_id"])
    c.execute("UPDATE sessoes SET perfil_id = %s WHERE id = %s", (dados.perfil_id, s["id"]))


@router.delete("/sessao", status_code=204)
def sair_deste_aparelho(s: Sessao, response: Response, c: Db) -> None:
    c.execute("UPDATE sessoes SET revogada_em = now() WHERE id = %s", (s["id"],))
    response.delete_cookie(COOKIE, path="/api")


# ---------- Aparelhos (sessões da conta) ----------
@router.get("/aparelhos")
def listar_aparelhos(s: Sessao, c: Db) -> list[dict]:
    linhas = c.execute(
        "SELECT id, aparelho, visto_em FROM sessoes WHERE conta_id = %s AND revogada_em IS NULL ORDER BY visto_em DESC",
        (s["conta_id"],),
    ).fetchall()
    return [{"id": str(l["id"]), "nome": l["aparelho"], "vistoEm": l["visto_em"].isoformat(), "atual": l["id"] == s["id"]} for l in linhas]


@router.delete("/aparelhos/{aparelho_id}", status_code=204)
def desconectar_aparelho(aparelho_id: UUID, s: Sessao, c: Db) -> None:
    r = c.execute(
        "UPDATE sessoes SET revogada_em = now() WHERE id = %s AND conta_id = %s AND revogada_em IS NULL RETURNING id",
        (aparelho_id, s["conta_id"]),
    ).fetchone()
    if not r:
        raise HTTPException(404, "Aparelho não encontrado.")


# ---------- Perfis ----------
@router.post("/perfis", status_code=201)
def criar_perfil(dados: NovoPerfil, s: Sessao, c: Db) -> dict:
    # Trava a conta: duas requisições ao mesmo tempo não passam do limite de MAX_PERFIS
    c.execute("SELECT id FROM contas WHERE id = %s FOR UPDATE", (s["conta_id"],))
    usadas = [r["cor"] for r in c.execute("SELECT cor FROM perfis WHERE conta_id = %s", (s["conta_id"],))]
    if len(usadas) >= MAX_PERFIS:
        raise HTTPException(409, f"Limite de {MAX_PERFIS} perfis por conta.")
    cor = dados.cor or next((x for x in CORES if x not in usadas), CORES[0])
    try:
        with c.transaction():
            p = c.execute(
                "INSERT INTO perfis (conta_id, apelido, cor, nome, sobrenome, mostrar_nome) VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
                (s["conta_id"], dados.apelido, cor, dados.nome, dados.sobrenome, dados.mostrar_nome),
            ).fetchone()
    except UniqueViolation:
        raise HTTPException(409, NICKNAME_EM_USO) from None
    assert p is not None
    return montar_perfil(c, p["id"])


@router.patch("/perfis/{perfil_id}")
def alterar_perfil(perfil_id: UUID, dados: AlteraPerfil, s: Sessao, c: Db) -> dict:
    _do_dono(c, perfil_id, s["conta_id"])
    enviados = dados.model_fields_set
    try:
        with c.transaction():
            if dados.apelido is not None:
                c.execute("UPDATE perfis SET apelido = %s WHERE id = %s", (dados.apelido, perfil_id))
            if dados.oculto is not None:
                c.execute("UPDATE perfis SET oculto = %s WHERE id = %s", (dados.oculto, perfil_id))
            if dados.cor is not None:
                c.execute("UPDATE perfis SET cor = %s WHERE id = %s", (dados.cor, perfil_id))
            # Ligar a exibição vem DEPOIS de gravar o nome (a regra do banco exige nome para mostrar; os dois podem
            # chegar na mesma requisição). Perfis antigos, criados antes do nome obrigatório, podem estar sem nome.
            if "nome" in enviados:
                c.execute("UPDATE perfis SET nome = %s WHERE id = %s", (dados.nome, perfil_id))
            if "sobrenome" in enviados:
                c.execute("UPDATE perfis SET sobrenome = %s WHERE id = %s", (dados.sobrenome, perfil_id))
            if dados.mostrar_nome is not None:
                c.execute("UPDATE perfis SET mostrar_nome = %s WHERE id = %s", (dados.mostrar_nome, perfil_id))
    except UniqueViolation:
        raise HTTPException(409, NICKNAME_EM_USO) from None
    except CheckViolation:
        raise HTTPException(422, "Preencha o nome para mostrá-lo no ranking.") from None
    return montar_perfil(c, perfil_id)


@router.delete("/perfis/{perfil_id}", status_code=204)
def excluir_perfil(perfil_id: UUID, s: Sessao, c: Db) -> None:
    c.execute("SELECT id FROM contas WHERE id = %s FOR UPDATE", (s["conta_id"],))
    _do_dono(c, perfil_id, s["conta_id"])
    total = c.execute("SELECT count(*) AS n FROM perfis WHERE conta_id = %s", (s["conta_id"],)).fetchone()
    if total and total["n"] <= 1:
        raise HTTPException(409, "A conta precisa de pelo menos um perfil.")
    c.execute("DELETE FROM perfis WHERE id = %s", (perfil_id,))


# ---------- Favoritos ----------
@router.put("/perfis/{perfil_id}/favoritos/{jogo_id}", status_code=204)
def favoritar(perfil_id: UUID, jogo_id: Annotated[str, Path(pattern=r"^g[0-9]{2}$")], s: Sessao, c: Db) -> None:
    _do_dono(c, perfil_id, s["conta_id"])
    if not c.execute("SELECT 1 FROM jogos WHERE id = %s AND publicado", (jogo_id,)).fetchone():
        raise HTTPException(404, "Jogo não encontrado.")
    c.execute("INSERT INTO favoritos (perfil_id, jogo_id) VALUES (%s, %s) ON CONFLICT DO NOTHING", (perfil_id, jogo_id))


@router.delete("/perfis/{perfil_id}/favoritos/{jogo_id}", status_code=204)
def desfavoritar(perfil_id: UUID, jogo_id: str, s: Sessao, c: Db) -> None:
    _do_dono(c, perfil_id, s["conta_id"])
    c.execute("DELETE FROM favoritos WHERE perfil_id = %s AND jogo_id = %s", (perfil_id, jogo_id))
