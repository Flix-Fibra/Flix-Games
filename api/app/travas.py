"""Travas do login (em memória: a API roda num processo só; reiniciar zera, o que é aceitável).

Nada aqui vai para o banco nem para log: o documento entra só como hash com sal aleatório do processo
(não dá para voltar ao CPF nem comparar entre reinícios).

- Por documento: 5 senhas erradas em 15 min bloqueiam aquele CPF/CNPJ por 15 min (igual à API Própria).
- Por IP: 20 tentativas em 15 min (quem testa muitos CPFs diferentes).
- Geral: 50 chamadas por minuto à API Própria (a chave aceita 60; sobra margem e um ataque não derruba todo mundo).
"""
import hashlib
import secrets
import threading
import time
from collections import deque

from fastapi import Request

JANELA_S = 15 * 60
ERROS_POR_DOCUMENTO = 5
TENTATIVAS_POR_IP = 20
CHAMADAS_POR_MINUTO = 50

_SAL = secrets.token_bytes(16)
_trava = threading.Lock()
_erros_doc: dict[bytes, deque[float]] = {}
_tentativas_ip: dict[str, deque[float]] = {}
_chamadas: deque[float] = deque()


def _h(documento: str) -> bytes:
    return hashlib.sha256(_SAL + documento.encode()).digest()


def ip_do_cliente(request: Request) -> str:
    """O nginx do servidor é o único que alcança a API (porta só em 127.0.0.1) e manda o IP real em X-Real-IP."""
    ip = request.headers.get("x-real-ip", "").strip()
    if ip and len(ip) <= 45:
        return ip
    return request.client.host if request.client else "?"


def _limpar(fila: deque[float], agora: float, janela: float) -> None:
    while fila and fila[0] <= agora - janela:
        fila.popleft()


def _faxina(agora: float) -> None:
    """Remove chaves vazias para a memória não crescer sem limite."""
    for tabela in (_erros_doc, _tentativas_ip):
        if len(tabela) > 10_000:
            for k in [k for k, f in tabela.items() if not f or f[-1] <= agora - JANELA_S]:
                del tabela[k]


def pode_tentar(documento: str, ip: str) -> bool:
    """Registra a tentativa e diz se ela pode ir à API Própria."""
    agora = time.monotonic()
    with _trava:
        _faxina(agora)
        f_ip = _tentativas_ip.setdefault(ip, deque())
        _limpar(f_ip, agora, JANELA_S)
        f_doc = _erros_doc.get(_h(documento))
        if f_doc is not None:
            _limpar(f_doc, agora, JANELA_S)
        _limpar(_chamadas, agora, 60)
        if len(f_ip) >= TENTATIVAS_POR_IP:
            return False
        f_ip.append(agora)  # conta mesmo se for barrada abaixo: quem insiste num CPF travado também gasta a cota do IP
        if f_doc is not None and len(f_doc) >= ERROS_POR_DOCUMENTO:
            return False
        if len(_chamadas) >= CHAMADAS_POR_MINUTO:
            return False
        _chamadas.append(agora)
        return True


def senha_errada(documento: str) -> None:
    with _trava:
        _erros_doc.setdefault(_h(documento), deque()).append(time.monotonic())


def acertou(documento: str) -> None:
    """Login certo zera os erros daquele documento (como num app comum)."""
    with _trava:
        _erros_doc.pop(_h(documento), None)


def zerar() -> None:
    """Só para os testes."""
    with _trava:
        _erros_doc.clear()
        _tentativas_ip.clear()
        _chamadas.clear()
