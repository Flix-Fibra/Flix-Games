"""Regras de negócio e de segurança da API."""
import time
import uuid

from fastapi.testclient import TestClient

from app.config import config
from app.main import app

from .conftest import CABECALHO, com_perfil, novo_cliente, sql


# ---------- Segurança básica ----------
def test_sem_sessao_recebe_401(app_ativo):
    assert TestClient(app).get("/api/sessao").status_code == 401


def test_alteracao_sem_cabecalho_csrf_e_recusada(app_ativo):
    c = novo_cliente(app_ativo)
    r = c.post("/api/perfis", json={"apelido": "Teste"}, headers={"X-Flix-Games": ""})
    assert r.status_code == 403


def test_login_simulado_nao_existe_em_producao(app_ativo, monkeypatch):
    monkeypatch.setattr(config, "modo", "producao")
    r = TestClient(app, headers=CABECALHO).post("/api/dev/entrar", json={})
    assert r.status_code == 404


def test_cookie_de_sessao_e_httponly(app_ativo):
    r = TestClient(app, headers=CABECALHO).post("/api/dev/entrar", json={})
    cookie = r.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie and "path=/api" in cookie


def test_saude_confere_o_banco(app_ativo):
    assert TestClient(app).get("/api/saude").json() == {"ok": True}


# ---------- Perfis (Q23) ----------
def test_limite_de_2_perfis_por_conta(app_ativo):
    c = novo_cliente(app_ativo)
    assert c.post("/api/perfis", json={"apelido": "Um"}).status_code == 422  # curto demais
    assert c.post("/api/perfis", json={"apelido": "Primeiro"}).status_code == 201
    assert c.post("/api/perfis", json={"apelido": "Segundo"}).status_code == 201
    r = c.post("/api/perfis", json={"apelido": "Terceiro"})
    assert r.status_code == 409 and "Limite" in r.json()["detail"]


def test_apelido_invalido_repetido_e_proibido(app_ativo):
    c = novo_cliente(app_ativo)
    assert c.post("/api/perfis", json={"apelido": "<b>oi</b>"}).status_code == 422
    assert c.post("/api/perfis", json={"apelido": "Admin Geral"}).status_code == 422
    assert c.post("/api/perfis", json={"apelido": "Duplo"}).status_code == 201
    assert c.post("/api/perfis", json={"apelido": "duplo"}).status_code == 409  # sem diferenciar maiúscula


def test_nao_exclui_o_unico_perfil(app_ativo):
    c, pid = com_perfil(app_ativo, "Sozinho")
    assert c.delete(f"/api/perfis/{pid}").status_code == 409


def test_nao_mexe_em_perfil_de_outra_conta(app_ativo):
    _, pid_alheio = com_perfil(app_ativo, "Vitima")
    invasor = novo_cliente(app_ativo)
    assert invasor.patch(f"/api/perfis/{pid_alheio}", json={"apelido": "Hackeado"}).status_code == 404
    assert invasor.put("/api/sessao/perfil", json={"perfilId": pid_alheio}).status_code == 404
    assert invasor.delete(f"/api/perfis/{pid_alheio}").status_code == 404


# ---------- Aparelhos (Q09) ----------
def test_sair_desconecta_so_este_aparelho(app_ativo):
    ref = f"T-{uuid.uuid4().hex[:8].upper()}"
    celular = novo_cliente(app_ativo, ref)
    notebook = novo_cliente(app_ativo, ref)
    assert len(celular.get("/api/aparelhos").json()) == 2
    token_antigo = celular.cookies.get("fg_sessao")
    assert celular.delete("/api/sessao").status_code == 204
    assert notebook.get("/api/sessao").status_code == 200
    # Mesmo guardando o token antigo, a sessão foi revogada no servidor
    copia = TestClient(app)
    copia.cookies.set("fg_sessao", token_antigo, path="/api")
    assert copia.get("/api/sessao").status_code == 401


def test_conta_sem_elegibilidade_perde_acesso(app_ativo):
    ref = f"T-{uuid.uuid4().hex[:8].upper()}"
    c = novo_cliente(app_ativo, ref)
    sql("UPDATE contas SET ativo = FALSE WHERE cliente_ref = %s", ref)
    assert c.get("/api/sessao").status_code == 401


# ---------- Partidas e ranking (contrato do hub, seção 6.4) ----------
def _jogar(c: TestClient, jogo: str, pontos: int, duracao_ms: int = 1500, espera: float = 0.0) -> dict:
    run = str(uuid.uuid4())
    assert c.post("/api/partidas/inicio", json={"jogoId": jogo, "runId": run}).status_code == 201
    if espera:
        time.sleep(espera)
    r = c.post("/api/partidas/fim", json={"runId": run, "pontos": pontos, "duracaoMs": duracao_ms})
    assert r.status_code == 200, r.text
    return r.json()


def test_partida_valida_entra_no_ranking(app_ativo):
    c, _ = com_perfil(app_ativo, "Corredor")
    r = _jogar(c, "g03", pontos=120, duracao_ms=3500, espera=1.6)
    assert r["aceita"] is True and r["melhor"] == 120
    linhas = c.get("/api/ranking/g03").json()
    assert any(l["eu"] and l["pontos"] == 120 for l in linhas)


def test_run_id_repetido_e_recusado(app_ativo):
    c, _ = com_perfil(app_ativo, "Repetido")
    run = str(uuid.uuid4())
    assert c.post("/api/partidas/inicio", json={"jogoId": "g01", "runId": run}).status_code == 201
    assert c.post("/api/partidas/inicio", json={"jogoId": "g01", "runId": run}).status_code == 409
    c.post("/api/partidas/fim", json={"runId": run, "pontos": 1, "duracaoMs": 3000})
    assert c.post("/api/partidas/fim", json={"runId": run, "pontos": 1, "duracaoMs": 3000}).status_code == 409


def test_pontuacao_fora_da_faixa_e_rejeitada(app_ativo):
    c, _ = com_perfil(app_ativo, "Trapaceiro")
    r = _jogar(c, "g02", pontos=999_999, duracao_ms=2500, espera=0.6)
    assert r == {"aceita": False, "motivo": "pontuação fora da faixa do jogo"}


def test_duracao_maior_que_o_tempo_real_e_rejeitada(app_ativo):
    c, _ = com_perfil(app_ativo, "Apressado")
    r = _jogar(c, "g02", pontos=10, duracao_ms=60_000)  # diz 60 s, mas passou menos de 1 s
    assert r["aceita"] is False and "tempo real" in r["motivo"]


def test_jogo_nao_publicado_nao_aceita_partida(app_ativo):
    c, _ = com_perfil(app_ativo, "Curioso")
    r = c.post("/api/partidas/inicio", json={"jogoId": "g10", "runId": str(uuid.uuid4())})
    assert r.status_code == 404  # G10 só após parecer do jurídico (Q47)


def test_ranking_de_menor_vence(app_ativo):
    """Minigolfe (g06): menos tacadas fica na frente."""
    a, _ = com_perfil(app_ativo, "Golfista A")
    b, _ = com_perfil(app_ativo, "Golfista B")
    for cli, tacadas in ((a, 30), (b, 20)):
        run = str(uuid.uuid4())
        cli.post("/api/partidas/inicio", json={"jogoId": "g06", "runId": run})
        sql("UPDATE partidas SET iniciada_em = now() - interval '30 seconds' WHERE run_id = %s", run)
        assert cli.post("/api/partidas/fim", json={"runId": run, "pontos": tacadas, "duracaoMs": 25_000}).json()["aceita"]
    linhas = {l["apelido"]: l["posicao"] for l in a.get("/api/ranking/g06").json()}
    assert linhas["Golfista B"] < linhas["Golfista A"]


def test_perfil_oculto_some_para_os_outros(app_ativo):
    dono, pid = com_perfil(app_ativo, "Discreto")
    run = str(uuid.uuid4())
    dono.post("/api/partidas/inicio", json={"jogoId": "g15", "runId": run})
    sql("UPDATE partidas SET iniciada_em = now() - interval '10 seconds' WHERE run_id = %s", run)
    dono.post("/api/partidas/fim", json={"runId": run, "pontos": 50, "duracaoMs": 5000})
    assert dono.patch(f"/api/perfis/{pid}", json={"oculto": True}).status_code == 200
    outro, _ = com_perfil(app_ativo, "Observador")
    assert all(l["apelido"] != "Discreto" for l in outro.get("/api/ranking/g15").json())
    assert any(l["apelido"] == "Discreto" for l in dono.get("/api/ranking/g15").json())  # o dono ainda se vê


def test_limite_de_partidas_por_minuto(app_ativo):
    c, _ = com_perfil(app_ativo, "Spammer")
    codigos = [c.post("/api/partidas/inicio", json={"jogoId": "g01", "runId": str(uuid.uuid4())}).status_code for _ in range(22)]
    assert codigos.count(201) == 20 and codigos[-1] == 429


# ---------- Personagem (AvatarConfig v1, seção 9.3) ----------
AVATAR_OK = {
    "v": 1,
    "body": {"type": "corpo-a", "skinTone": "pele-06"},
    "face": {"eyes": "olhos-redondos", "mouth": "boca-sorriso"},
    "hair": {"style": "cabelo-cacheado", "color": "cab-castanho"},
    "top": {"item": "camiseta-basica", "primary": "cor-vermelho-flix"},
    "bottom": {"item": "calca-jeans", "primary": "cor-azul"},
    "shoes": {"item": "calcado-tenis", "primary": "cor-branco"},
    "hat": None,
    "accessories": ["oculos"],
    "skinPreset": None,
}


def test_salva_e_devolve_o_personagem(app_ativo):
    c, pid = com_perfil(app_ativo, "Estiloso")
    r = c.put(f"/api/perfis/{pid}/avatar", json=AVATAR_OK)
    assert r.status_code == 200, r.text
    assert r.json()["avatar"]["body"]["skinTone"] == "pele-06"
    assert c.get("/api/sessao").json()["perfis"][0]["avatar"]["hair"]["style"] == "cabelo-cacheado"


def test_personagem_so_aceita_ids_do_catalogo(app_ativo):
    c, pid = com_perfil(app_ativo, "Criativo")
    ruins = [
        {**AVATAR_OK, "body": {"type": "corpo-a", "skinTone": "#FF0000"}},        # cor livre
        {**AVATAR_OK, "hat": {"item": "<script>", "primary": None}},              # fora do catálogo
        {**AVATAR_OK, "accessories": ["oculos", "fone", "oculos-sol", "oculos"]},  # mais de 3
        {**AVATAR_OK, "accessories": ["oculos", "oculos"]},                         # repetido
        {**AVATAR_OK, "foto": "data:image/png;base64,AAAA"},                        # campo extra (imagem)
        {**AVATAR_OK, "v": 2},
    ]
    for corpo in ruins:
        assert c.put(f"/api/perfis/{pid}/avatar", json=corpo).status_code == 422, corpo


def test_nao_altera_personagem_de_outra_conta(app_ativo):
    _, pid_alheio = com_perfil(app_ativo, "Alvo")
    invasor = novo_cliente(app_ativo)
    assert invasor.put(f"/api/perfis/{pid_alheio}/avatar", json=AVATAR_OK).status_code == 404
