"""Login com CPF/CNPJ: rota /api/entrar, travas, validade da sessão e limite de aparelhos.

Em desenvolvimento o conferidor é o simulado (senha = documento entra). A leitura da resposta real da API Própria é
testada direto em _interpretar, com as respostas do contrato.
"""
import json

import psycopg
import pytest
from fastapi.testclient import TestClient

from app import conferidor, rotas_conta, travas
from app.conferidor import Resultado, Situacao, _interpretar, documento_valido
from app.main import app

from .conftest import CABECALHO, URL_TESTE

CPF_OK = "11144477735"
CPF_SEM_GAMES = "52998224725"
CPF_BLOQUEADO = "39053344705"
CNPJ_OK = "11222333000181"


@pytest.fixture(autouse=True)
def _zera_travas():
    travas.zerar()
    yield
    travas.zerar()


def _cliente(ip: str = "203.0.113.10") -> TestClient:
    return TestClient(app, headers={**CABECALHO, "X-Real-IP": ip})


def _entrar(c: TestClient, doc: str, senha: str):
    return c.post("/api/entrar", json={"documento": doc, "senha": senha})


def _banco(sql: str, args: tuple = ()):
    with psycopg.connect(URL_TESTE, autocommit=True) as b:
        b.execute(sql, args)


# ---------- validação do documento ----------
def test_documentos_validos_e_invalidos():
    assert documento_valido(CPF_OK) and documento_valido(CNPJ_OK)
    assert not documento_valido("11144477736")  # dígito errado
    assert not documento_valido("11111111111")  # repetido
    assert not documento_valido("123")
    assert not documento_valido("1114447773a")


def test_documento_mal_formado_nao_chama_a_api_propria(app_ativo, monkeypatch):
    chamadas = []
    monkeypatch.setattr(rotas_conta, "conferir", lambda d, s: chamadas.append(d) or Resultado(Situacao.LIBERADO, "X"))
    r = _entrar(_cliente(), "111.444.777-36", "x")
    assert r.status_code == 422
    assert chamadas == []


# ---------- caminhos da conferência ----------
def test_login_certo_abre_sessao_e_aceita_pontuacao(app_ativo):
    c = _cliente()
    r = _entrar(c, "111.444.777-35", CPF_OK)  # com pontos e traço
    assert r.status_code == 204, r.text
    assert "httponly" in r.headers["set-cookie"].lower()
    assert c.get("/api/sessao").status_code == 200


def test_cnpj_entra(app_ativo):
    assert _entrar(_cliente(), "11.222.333/0001-81", CNPJ_OK).status_code == 204


def test_mesmo_cliente_cai_na_mesma_conta(app_ativo):
    a, b = _cliente(), _cliente()
    assert _entrar(a, CPF_OK, CPF_OK).status_code == 204
    assert _entrar(b, CPF_OK, CPF_OK).status_code == 204
    ida = a.get("/api/aparelhos").json()
    assert len([x for x in ida if not x["atual"]]) >= 1  # o outro aparelho aparece na mesma conta


def test_cpf_nunca_vai_para_o_banco(app_ativo):
    assert _entrar(_cliente(), CPF_OK, CPF_OK).status_code == 204
    with psycopg.connect(URL_TESTE) as b:
        refs = [r[0] for r in b.execute("SELECT cliente_ref FROM contas")]
    assert all(CPF_OK not in ref for ref in refs)


def test_senha_errada(app_ativo):
    r = _entrar(_cliente(), CPF_OK, "errada")
    assert r.status_code == 401
    assert "incorretos" in r.json()["detail"]
    assert "set-cookie" not in r.headers


def test_sem_games_e_bloqueado(app_ativo):
    r = _entrar(_cliente(), CPF_SEM_GAMES, CPF_SEM_GAMES)  # ex-cliente: só contrato cancelado
    assert r.status_code == 403 and "contrato ativo" in r.json()["detail"]
    r = _entrar(_cliente(), CPF_BLOQUEADO, CPF_BLOQUEADO)  # bloqueado por débito
    assert r.status_code == 403 and "fatura em aberto" in r.json()["detail"]


def test_sistema_fora_nunca_diz_senha_errada(app_ativo, monkeypatch):
    monkeypatch.setattr(rotas_conta, "conferir", lambda d, s: Resultado(Situacao.INDISPONIVEL))
    r = _entrar(_cliente(), CPF_OK, CPF_OK)
    assert r.status_code == 503
    assert "senha" not in r.json()["detail"].lower()


def test_429_da_api_propria_vira_espera(app_ativo, monkeypatch):
    monkeypatch.setattr(rotas_conta, "conferir", lambda d, s: Resultado(Situacao.MUITAS_TENTATIVAS))
    assert _entrar(_cliente(), CPF_OK, CPF_OK).status_code == 429


# ---------- travas ----------
def test_5_senhas_erradas_travam_o_documento(app_ativo):
    for _ in range(5):
        assert _entrar(_cliente(), CPF_OK, "errada").status_code == 401
    # a 6ª, mesmo certa e de outro IP, espera
    assert _entrar(_cliente("198.51.100.7"), CPF_OK, CPF_OK).status_code == 429
    # outro documento continua entrando
    assert _entrar(_cliente("198.51.100.7"), CNPJ_OK, CNPJ_OK).status_code == 204


def test_ip_testando_muitos_documentos_espera(app_ativo):
    c = _cliente("192.0.2.50")
    for _ in range(travas.TENTATIVAS_POR_IP):
        assert _entrar(c, CPF_SEM_GAMES, "errada").status_code in (401, 429)
    assert _entrar(c, CNPJ_OK, CNPJ_OK).status_code == 429
    assert _entrar(_cliente("192.0.2.51"), CNPJ_OK, CNPJ_OK).status_code == 204


def test_login_certo_zera_os_erros(app_ativo):
    for _ in range(4):
        _entrar(_cliente(), CPF_OK, "errada")
    assert _entrar(_cliente(), CPF_OK, CPF_OK).status_code == 204
    for _ in range(4):
        assert _entrar(_cliente(), CPF_OK, "errada").status_code == 401


# ---------- sessão ----------
def _sessao_nova() -> TestClient:
    c = _cliente()
    assert _entrar(c, CNPJ_OK, CNPJ_OK).status_code == 204
    return c


def test_sessao_cai_depois_de_5h_parada(app_ativo):
    c = _sessao_nova()
    aparelho = c.get("/api/aparelhos").json()
    atual = next(a["id"] for a in aparelho if a["atual"])
    _banco("UPDATE sessoes SET visto_em = now() - interval '5 hours 1 minute' WHERE id = %s", (atual,))
    assert c.get("/api/sessao").status_code == 401


def test_sessao_em_uso_se_renova(app_ativo):
    c = _sessao_nova()
    atual = next(a["id"] for a in c.get("/api/aparelhos").json() if a["atual"])
    _banco("UPDATE sessoes SET visto_em = now() - interval '4 hours' WHERE id = %s", (atual,))
    assert c.get("/api/sessao").status_code == 200  # renovou o visto_em
    _banco("UPDATE sessoes SET visto_em = visto_em - interval '4 hours' WHERE id = %s", (atual,))
    assert c.get("/api/sessao").status_code == 200


def test_sessao_dura_no_maximo_24h(app_ativo):
    c = _sessao_nova()
    atual = next(a["id"] for a in c.get("/api/aparelhos").json() if a["atual"])
    _banco("UPDATE sessoes SET criado_em = now() - interval '24 hours 1 minute' WHERE id = %s", (atual,))
    assert c.get("/api/sessao").status_code == 401


def test_sexto_aparelho_derruba_o_mais_antigo(app_ativo):
    doc = "11444777000161"
    assert documento_valido(doc)
    aparelhos = []
    for _ in range(6):
        c = _cliente()
        assert _entrar(c, doc, doc).status_code == 204
        aparelhos.append(c)
        _banco("UPDATE sessoes SET visto_em = visto_em - interval '1 second' WHERE revogada_em IS NULL")
    assert aparelhos[0].get("/api/sessao").status_code == 401
    assert all(a.get("/api/sessao").status_code == 200 for a in aparelhos[1:])
    assert len(aparelhos[-1].get("/api/aparelhos").json()) == 5


# ---------- leitura da resposta da API Própria (contrato de 24/11/2026) ----------
def _j(d: dict) -> bytes:
    return json.dumps(d).encode()


def test_interpretar_respostas_do_contrato():
    ok = _interpretar(200, _j({"flix_games_ativo": True, "cliente_ref": "c-123", "nome_curto": "Ana"}))
    assert ok == Resultado(Situacao.LIBERADO, "c-123")
    assert _interpretar(200, _j({"flix_games_ativo": False, "motivo": "sem_flix_games"})).situacao is Situacao.SEM_GAMES
    assert _interpretar(200, _j({"flix_games_ativo": False, "motivo": "contrato_bloqueado"})).situacao is Situacao.BLOQUEADO
    assert _interpretar(401, b"").situacao is Situacao.SENHA_ERRADA
    assert _interpretar(429, b"").situacao is Situacao.MUITAS_TENTATIVAS
    for st in (422, 500, 502, 503, 403):
        assert _interpretar(st, b"").situacao is Situacao.INDISPONIVEL


def test_interpretar_resposta_estranha_e_indisponivel():
    assert _interpretar(200, b"nao e json").situacao is Situacao.INDISPONIVEL
    assert _interpretar(200, _j({"flix_games_ativo": True})).situacao is Situacao.INDISPONIVEL  # sem cliente_ref
    assert _interpretar(200, _j({"flix_games_ativo": True, "cliente_ref": ""})).situacao is Situacao.INDISPONIVEL
    assert _interpretar(200, _j({"flix_games_ativo": "sim"})).situacao is Situacao.INDISPONIVEL


def test_sem_chave_nao_chama_a_rota(monkeypatch, tmp_path):
    monkeypatch.setattr(conferidor.config, "chave_api_propria_arquivo", str(tmp_path / "nao-existe"))

    def proibido(*a, **k):
        raise AssertionError("não deveria chamar a rede sem chave")

    monkeypatch.setattr(conferidor.urllib.request, "urlopen", proibido)
    assert conferidor._conferir_api_propria(CPF_OK, CPF_OK).situacao is Situacao.INDISPONIVEL


def test_chamada_real_manda_so_o_contrato(monkeypatch, tmp_path):
    arq = tmp_path / "chave"
    arq.write_text("chave-de-teste\n")
    monkeypatch.setattr(conferidor.config, "chave_api_propria_arquivo", str(arq))
    visto = {}

    class Resp:
        status = 200

        def read(self, n):
            return _j({"flix_games_ativo": True, "cliente_ref": "ref-1", "nome_curto": "Ana"})

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    def falso(req, timeout):
        visto.update(url=req.full_url, corpo=json.loads(req.data), chave=req.get_header("X-api-key"), timeout=timeout)
        return Resp()

    monkeypatch.setattr(conferidor.urllib.request, "urlopen", falso)
    r = conferidor._conferir_api_propria(CPF_OK, "senha1")
    assert r == Resultado(Situacao.LIBERADO, "ref-1")
    assert visto["url"].startswith("https://api-server.flixfibra.com.br/")
    assert visto["corpo"] == {"documento": CPF_OK, "senha": "senha1"}
    assert visto["chave"] == "chave-de-teste"
    assert visto["timeout"] <= 15


# ---------- acesso da equipe ----------
def _arquivo_equipe(tmp_path, pessoas: dict[str, str]):
    from app.equipe import hash_codigo

    linhas = []
    for nome, codigo in pessoas.items():
        sal = bytes(range(16))
        linhas.append(f"{nome}:{sal.hex()}:{hash_codigo(codigo, sal).hex()}")
    arq = tmp_path / "equipe"
    arq.write_text("\n".join(linhas) + "\n")
    return str(arq)


def _entrar_equipe(c: TestClient, codigo: str, usuario: str | None = None):
    # nos testes a senha "codigo-do-<nome>" pertence ao usuário <nome>
    u = usuario or (codigo.removeprefix("codigo-do-") if codigo.startswith("codigo-do-") else "rafael")
    return c.post("/api/entrar-equipe", json={"usuario": u, "senha": codigo})


def test_equipe_entra_com_o_proprio_codigo(app_ativo, monkeypatch, tmp_path):
    from app import config as cfg

    monkeypatch.setattr(cfg.config, "equipe_arquivo", _arquivo_equipe(tmp_path, {"rafael": "codigo-do-rafael", "tobias": "codigo-do-tobias"}))
    c = _cliente()
    assert _entrar_equipe(c, "codigo-do-tobias").status_code == 204
    assert c.get("/api/sessao").status_code == 200
    with psycopg.connect(URL_TESTE) as b:
        assert b.execute("SELECT 1 FROM contas WHERE cliente_ref = 'EQUIPE-TOBIAS'").fetchone()


def test_equipe_codigo_errado_e_trava_por_ip(app_ativo, monkeypatch, tmp_path):
    from app import config as cfg

    monkeypatch.setattr(cfg.config, "equipe_arquivo", _arquivo_equipe(tmp_path, {"rafael": "codigo-do-rafael"}))
    c = _cliente("198.51.100.99")
    for _ in range(5):
        r = _entrar_equipe(c, "codigo-errado")
        assert r.status_code == 401 and "set-cookie" not in r.headers
    assert _entrar_equipe(c, "codigo-do-rafael").status_code == 429  # travado neste IP
    assert _entrar_equipe(_cliente("198.51.100.100"), "codigo-do-rafael").status_code == 204  # outro IP entra


def test_equipe_sem_arquivo_ninguem_entra(app_ativo, monkeypatch, tmp_path):
    from app import config as cfg

    monkeypatch.setattr(cfg.config, "equipe_arquivo", str(tmp_path / "nao-existe"))
    assert _entrar_equipe(_cliente(), "qualquer-codigo").status_code == 401


def test_equipe_senha_de_um_nao_abre_o_outro(app_ativo, monkeypatch, tmp_path):
    from app import config as cfg

    monkeypatch.setattr(cfg.config, "equipe_arquivo", _arquivo_equipe(tmp_path, {"rafael": "codigo-do-rafael", "tobias": "codigo-do-tobias"}))
    assert _entrar_equipe(_cliente("203.0.113.77"), "codigo-do-rafael", usuario="tobias").status_code == 401
    assert _entrar_equipe(_cliente("203.0.113.78"), "codigo-do-rafael", usuario="RAFAEL").status_code == 204

