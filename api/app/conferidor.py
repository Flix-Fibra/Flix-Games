"""Confere o cliente na API Própria da Flix (rota do Flix Games, só leitura).

Contrato (recado da API Própria, 24/11/2026):
  POST {FLIX_GAMES_CONFERE_URL}   cabeçalho x-api-key; corpo {"documento": "<só números>", "senha": "<Minha Flix>"}
  200 + flix_games_ativo:true   -> login certo e cliente com o Games (vêm cliente_ref e nome_curto)
  200 + flix_games_ativo:false  -> login certo; motivo sem_flix_games ou contrato_bloqueado
  401 senha/documento errados · 422 campo faltando · 429 tentativas demais · 502/503 sistema da Flix fora

Regras: a senha só passa por esta chamada (nunca é guardada nem vai para log); guardamos só o cliente_ref; a rota só é
chamada pelo servidor (a chave só funciona a partir do IP do servidor). Nenhum dado do cliente vai para exceção ou log.
"""
import hashlib
import json
import urllib.error
import urllib.request
from dataclasses import dataclass
from enum import Enum

from .config import config


class Situacao(str, Enum):
    LIBERADO = "liberado"
    SEM_GAMES = "sem_games"
    BLOQUEADO = "bloqueado"
    SENHA_ERRADA = "senha_errada"
    MUITAS_TENTATIVAS = "muitas_tentativas"
    INDISPONIVEL = "indisponivel"  # API Própria fora, chave recusada ou resposta que não entendemos


@dataclass(frozen=True)
class Resultado:
    situacao: Situacao
    cliente_ref: str | None = None


TEMPO_LIMITE_S = 10  # bem abaixo do corte de ~100 s do Cloudflare


def _chave() -> str | None:
    """A chave fica num arquivo que só o serviço lê (segredo do compose), nunca no ambiente nem no repositório."""
    arq = config.chave_api_propria_arquivo
    if not arq:
        return None
    try:
        with open(arq, encoding="utf-8") as f:
            v = f.read().strip()
    except OSError:
        return None
    return v or None


def _interpretar(status: int, corpo: bytes) -> Resultado:
    if status == 401:
        return Resultado(Situacao.SENHA_ERRADA)
    if status == 429:
        return Resultado(Situacao.MUITAS_TENTATIVAS)
    if status != 200:
        return Resultado(Situacao.INDISPONIVEL)  # 422 não deveria acontecer (validamos antes); 5xx = fora
    try:
        d = json.loads(corpo)
    except ValueError:
        return Resultado(Situacao.INDISPONIVEL)
    if not isinstance(d, dict):
        return Resultado(Situacao.INDISPONIVEL)
    if d.get("flix_games_ativo") is True:
        ref = d.get("cliente_ref")
        if not isinstance(ref, str) or not (1 <= len(ref) <= 80) or not ref.isprintable():
            return Resultado(Situacao.INDISPONIVEL)
        return Resultado(Situacao.LIBERADO, ref)
    if d.get("flix_games_ativo") is False:
        motivo = d.get("motivo")
        return Resultado(Situacao.BLOQUEADO if motivo == "contrato_bloqueado" else Situacao.SEM_GAMES)
    return Resultado(Situacao.INDISPONIVEL)


def _conferir_api_propria(documento: str, senha: str) -> Resultado:
    chave = _chave()
    if not chave:
        return Resultado(Situacao.INDISPONIVEL)
    req = urllib.request.Request(
        config.confere_url,
        data=json.dumps({"documento": documento, "senha": senha}).encode(),
        headers={"x-api-key": chave, "content-type": "application/json", "user-agent": "flix-games-api"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=TEMPO_LIMITE_S) as r:  # noqa: S310 (URL fixa da configuração, https)
            return _interpretar(r.status, r.read(64 * 1024))
    except urllib.error.HTTPError as e:
        return _interpretar(e.code, b"")
    except (urllib.error.URLError, TimeoutError, OSError):
        return Resultado(Situacao.INDISPONIVEL)


def _conferir_simulado(documento: str, senha: str) -> Resultado:
    """Só em desenvolvimento: senha igual ao documento entra (como no 1º acesso do Minha Flix).
    Documentos de teste: 11144477735 (liberado), 52998224725 (sem o Games), 39053344705 (bloqueado)."""
    if senha != documento:
        return Resultado(Situacao.SENHA_ERRADA)
    if documento == "52998224725":
        return Resultado(Situacao.SEM_GAMES)
    if documento == "39053344705":
        return Resultado(Situacao.BLOQUEADO)
    return Resultado(Situacao.LIBERADO, "SIM-" + hashlib.sha256(documento.encode()).hexdigest()[:12].upper())


def conferir(documento: str, senha: str) -> Resultado:
    if config.conferidor == "simulado":
        return _conferir_simulado(documento, senha)
    return _conferir_api_propria(documento, senha)


# ---------- Validação local do CPF/CNPJ (não gasta chamada da API Própria com documento impossível) ----------
def _cpf_valido(d: str) -> bool:
    if len(d) != 11 or d == d[0] * 11:
        return False
    for n in (9, 10):
        s = sum(int(d[i]) * (n + 1 - i) for i in range(n))
        if (s * 10 % 11) % 10 != int(d[n]):
            return False
    return True


def _cnpj_valido(d: str) -> bool:
    if len(d) != 14 or d == d[0] * 14:
        return False
    for n, pesos in ((12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]), (13, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])):
        s = sum(int(d[i]) * pesos[i] for i in range(n))
        dv = 0 if s % 11 < 2 else 11 - s % 11
        if dv != int(d[n]):
            return False
    return True


def documento_valido(d: str) -> bool:
    return d.isdigit() and (_cpf_valido(d) if len(d) == 11 else _cnpj_valido(d) if len(d) == 14 else False)
