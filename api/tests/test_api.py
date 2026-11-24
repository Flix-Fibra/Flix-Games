"""Regras de negócio e de segurança da API."""
import time
import uuid

from fastapi.testclient import TestClient

from app.config import config
from app.main import app

from .conftest import CABECALHO, com_perfil, novo, novo_cliente, sql


# ---------- Segurança básica ----------
def test_sem_sessao_recebe_401(app_ativo):
    assert TestClient(app).get("/api/sessao").status_code == 401


def test_alteracao_sem_cabecalho_csrf_e_recusada(app_ativo):
    c = novo_cliente(app_ativo)
    r = c.post("/api/perfis", json=novo("Teste"), headers={"X-Flix-Games": ""})
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
def test_limite_de_4_perfis_por_conta(app_ativo):
    c = novo_cliente(app_ativo)
    assert c.get("/api/sessao").json()["maxPerfis"] == 4  # a interface lê o limite daqui
    assert c.post("/api/perfis", json=novo("Um")).status_code == 422  # curto demais
    criados = [c.post("/api/perfis", json=novo(a)) for a in ("Primeiro", "Segundo", "Terceiro", "Quarto")]
    assert [r.status_code for r in criados] == [201] * 4
    assert len({r.json()["cor"] for r in criados}) == 4  # cada perfil com uma cor diferente
    r = c.post("/api/perfis", json=novo("Quinto"))
    assert r.status_code == 409 and "Limite de 4" in r.json()["detail"]


def test_apelido_invalido_repetido_e_proibido(app_ativo):
    c = novo_cliente(app_ativo)
    assert c.post("/api/perfis", json=novo("<b>oi</b>")).status_code == 422
    assert c.post("/api/perfis", json=novo("Admin Geral")).status_code == 422
    assert c.post("/api/perfis", json=novo("Duplo")).status_code == 201
    assert c.post("/api/perfis", json=novo("duplo")).status_code == 409  # sem diferenciar maiúscula


def test_nickname_e_unico_entre_todas_as_contas(app_ativo):
    a = novo_cliente(app_ativo)
    b = novo_cliente(app_ativo)
    assert a.post("/api/perfis", json=novo("So Um No Mundo")).status_code == 201
    r = b.post("/api/perfis", json=novo("so um no mundo"))  # outra conta, maiúsculas diferentes
    assert r.status_code == 409 and "nickname já está em uso" in r.json()["detail"]
    pid = b.post("/api/perfis", json=novo("Outro Nome")).json()["id"]
    assert b.patch(f"/api/perfis/{pid}", json={"apelido": "SO UM NO MUNDO"}).status_code == 409  # nem renomeando


def test_nome_verdadeiro_so_aparece_no_ranking_quando_habilitado(app_ativo):
    c, pid = com_perfil(app_ativo, "Nome Escondido")
    outro, _ = com_perfil(app_ativo, "Quem Olha")
    r = c.patch(f"/api/perfis/{pid}", json={"nome": "  Ana   Clara ", "sobrenome": "D'Ávila Souza"})
    assert r.status_code == 200, r.text
    assert (r.json()["nome"], r.json()["sobrenome"], r.json()["mostrarNome"]) == ("Ana Clara", "D'Ávila Souza", False)
    _jogar(c, "g03", pontos=130, duracao_ms=3500, espera=1.6)

    def linha_vista_pelo_outro():
        return next(l for l in outro.get("/api/ranking/g03").json() if l["apelido"] == "Nome Escondido")

    assert linha_vista_pelo_outro()["nome"] is None  # desligado: a API nem envia o nome
    assert c.patch(f"/api/perfis/{pid}", json={"mostrarNome": True}).json()["mostrarNome"] is True
    assert linha_vista_pelo_outro()["nome"] == "Ana Clara D'Ávila Souza"
    # nome é obrigatório: não dá para apagar; desligar a exibição esconde de novo
    assert c.patch(f"/api/perfis/{pid}", json={"nome": ""}).status_code == 422
    assert c.patch(f"/api/perfis/{pid}", json={"mostrarNome": False}).json()["mostrarNome"] is False
    assert linha_vista_pelo_outro()["nome"] is None


def test_criar_perfil_exige_nome_e_sobrenome(app_ativo):
    c = novo_cliente(app_ativo)
    assert c.post("/api/perfis", json={"apelido": "Sem Nome Nenhum"}).status_code == 422
    assert c.post("/api/perfis", json=novo("Sem Sobrenome", sobrenome="  ")).status_code == 422
    r = c.post("/api/perfis", json=novo("Com Nome Visivel", nome="Ana", sobrenome="Souza", mostrarNome=True))
    assert r.status_code == 201, r.text
    assert (r.json()["nome"], r.json()["sobrenome"], r.json()["mostrarNome"]) == ("Ana", "Souza", True)
    assert c.post("/api/perfis", json=novo("Nome Oculto Padrao")).json()["mostrarNome"] is False  # padrão: desligado


def test_cor_do_perfil_escolhida_da_paleta(app_ativo):
    c = novo_cliente(app_ativo)
    cores = c.get("/api/sessao").json()["cores"]
    assert len(cores) >= 4 and len(set(cores)) == len(cores)
    r = c.post("/api/perfis", json=novo("Cor Escolhida", cor=cores[5].lower()))  # maiúscula ou minúscula
    assert r.status_code == 201 and r.json()["cor"] == cores[5]
    assert c.post("/api/perfis", json=novo("Cor Livre", cor="#123456")).status_code == 422  # fora da paleta
    assert c.patch(f"/api/perfis/{r.json()['id']}", json={"cor": cores[2]}).json()["cor"] == cores[2]
    assert c.patch(f"/api/perfis/{r.json()['id']}", json={"cor": "red"}).status_code == 422


def test_nome_invalido_ou_mostrar_sem_nome_e_recusado(app_ativo):
    c, pid = com_perfil(app_ativo, "Sem Nome Ainda")
    sql("UPDATE perfis SET nome = NULL, sobrenome = NULL WHERE id = %s", pid)  # perfil antigo, de antes do nome obrigatório
    assert c.patch(f"/api/perfis/{pid}", json={"nome": "<script>"}).status_code == 422
    assert c.patch(f"/api/perfis/{pid}", json={"nome": "Ana2"}).status_code == 422  # número não é nome
    assert c.patch(f"/api/perfis/{pid}", json={"sobrenome": "x" * 61}).status_code == 422
    r = c.patch(f"/api/perfis/{pid}", json={"mostrarNome": True})
    assert r.status_code == 422 and "Preencha o nome" in r.json()["detail"]


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


def test_catalogo_devolve_a_capa_do_jogo(app_ativo):
    c, _ = com_perfil(app_ativo, "Capista")
    sql("UPDATE jogos SET pasta = 'snake', capa = 'img/logo.png' WHERE id = 'g03'")
    jogos = {j["id"]: j for j in c.get("/api/jogos").json()}
    assert jogos["g03"]["capa"] == "img/logo.png"
    assert "capa" in jogos["g05"] and jogos["g05"]["capa"] is None


def test_previa_so_aceita_animacao_dentro_da_pasta_do_jogo(app_ativo):
    import psycopg
    import pytest
    sql("UPDATE jogos SET pasta = 'snake', previa = 'img/previa.webp' WHERE id = 'g03'")
    jogos = {j["id"]: j for j in TestClient(app).get("/api/jogos").json()}
    assert jogos["g03"]["previa"] == "img/previa.webp"
    for ruim in ("../x.webp", "/etc/x.webp", "img/../../x.webp", "x.mp4", "https://x.com/a.webp"):
        with pytest.raises(psycopg.errors.CheckViolation):
            sql(f"UPDATE jogos SET previa = '{ruim}' WHERE id = 'g03'")
    sql("UPDATE jogos SET previa = NULL WHERE id = 'g03'")


def test_imagens_so_aceitam_caminhos_dentro_da_pasta_do_jogo(app_ativo):
    import psycopg
    import pytest
    sql("UPDATE jogos SET imagens = ARRAY['img/telas/tela-1.webp', 'img/telas/tela-2.png'] WHERE id = 'g03'")
    jogos = {j["id"]: j for j in TestClient(app).get("/api/jogos").json()}
    assert jogos["g03"]["imagens"] == ["img/telas/tela-1.webp", "img/telas/tela-2.png"]
    ruins = [["../x.webp"], ["img/ok.webp", "/etc/x.png"], ["https://x.com/a.png"], ["x.gif"], [f"img/{i}.png" for i in range(9)]]
    for ruim in ruins:
        with pytest.raises(psycopg.errors.CheckViolation):
            sql("UPDATE jogos SET imagens = %s WHERE id = 'g03'", ruim)
    sql("UPDATE jogos SET imagens = '{}' WHERE id = 'g03'")


def test_capa_nao_aceita_caminho_fora_da_pasta_do_jogo(app_ativo):
    import psycopg
    import pytest
    for ruim in ("../segredo.png", "/etc/x.png", "img/../../x.png", "capa.svg", "https://x.com/a.png"):
        with pytest.raises(psycopg.errors.CheckViolation):
            sql(f"UPDATE jogos SET capa = '{ruim}' WHERE id = 'g03'")


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


# ---------- Ranking geral: Pontos Flix por colocação, temporada mensal (Q20) ----------
def _resultado(perfil_id: str, jogo: str, pontos: int, quando: str) -> None:
    """Partida já terminada numa data escolhida (temporadas passadas não se misturam com as partidas dos outros testes)."""
    sql(
        """INSERT INTO partidas (run_id, perfil_id, jogo_id, status, iniciada_em, finalizada_em, pontos, duracao_ms)
           VALUES (%s, %s, %s, 'finalizada', %s::timestamptz - interval '1 minute', %s::timestamptz, %s, 60000)""",
        str(uuid.uuid4()), perfil_id, jogo, quando, quando, pontos,
    )


def _no_hub(*jogos: str) -> None:
    """O ranking geral só conta jogos que abrem no hub (com pasta entregue)."""
    pastas = {"g03": "snake", "g12": "corrida", "g14": "espiral"}
    for j in jogos:
        sql("UPDATE jogos SET pasta = %s WHERE id = %s", pastas[j], j)


def test_ranking_geral_soma_pontos_flix_pela_colocacao(app_ativo):
    """Pontuações de unidades e sentidos diferentes viram Pontos Flix pela colocação: 1000 × (N − posição + 0,5) / N."""
    _no_hub("g03", "g12", "g14")
    _, a = com_perfil(app_ativo, "Geral A")
    _, b = com_perfil(app_ativo, "Geral B")
    _, cc = com_perfil(app_ativo, "Geral C")
    quando = "2025-03-15 12:00-03"
    for pid, pts in ((a, 300), (b, 200), (cc, 100)):      # g03: vence o maior; N = 3 → 833, 500, 167
        _resultado(pid, "g03", pts, quando)
    _resultado(a, "g03", 50, quando)                        # partida pior não muda nada: conta a melhor
    _resultado(b, "g12", 40_000, quando)                    # g12: vence o MENOR tempo; N = 2 → 750, 250
    _resultado(a, "g12", 50_000, quando)
    _resultado(cc, "g14", 10, quando)                       # sozinho no jogo: 500 (vencer sem concorrência vale menos)
    _resultado(cc, "g13", 9, quando)                        # g13 só cadastrado, sem pasta no hub: não soma nada

    olhando, _ = com_perfil(app_ativo, "Geral Plateia")
    r = olhando.get("/api/ranking/geral", params={"temporada": "2025-03"})
    assert r.status_code == 200, r.text
    corpo = r.json()
    assert corpo["temporada"] == "2025-03"
    linhas = [(l["apelido"], l["posicao"], l["pontos"]) for l in corpo["linhas"]]
    assert linhas == [("Geral B", 1, 1250), ("Geral A", 2, 1083), ("Geral C", 3, 667)]
    b_jogos = corpo["linhas"][0]["jogos"]
    assert b_jogos == [
        {"jogoId": "g12", "posicao": 1, "jogadores": 2, "melhor": 40_000, "pontos": 750},
        {"jogoId": "g03", "posicao": 2, "jogadores": 3, "melhor": 200, "pontos": 500},
    ]
    assert not any(l["eu"] for l in corpo["linhas"])        # quem olha não jogou nessa temporada


def test_temporada_do_ranking_geral_segue_o_fuso_de_brasilia(app_ativo):
    _no_hub("g03")
    c, pid = com_perfil(app_ativo, "Geral Virada")
    _resultado(pid, "g03", 100, "2025-06-01 01:00+00")      # 31/05 às 22h em Brasília: ainda é maio
    maio = c.get("/api/ranking/geral", params={"temporada": "2025-05"}).json()["linhas"]
    junho = c.get("/api/ranking/geral", params={"temporada": "2025-06"}).json()["linhas"]
    assert [l["apelido"] for l in maio] == ["Geral Virada"] and maio[0]["eu"]
    assert junho == []


def test_ranking_geral_oculto_conta_nos_pontos_mas_some_para_os_outros(app_ativo):
    _no_hub("g03")
    dono, oculto = com_perfil(app_ativo, "Geral Oculto")
    outro, visivel = com_perfil(app_ativo, "Geral Visivel")
    _resultado(oculto, "g03", 500, "2025-07-10 12:00-03")
    _resultado(visivel, "g03", 100, "2025-07-10 12:00-03")
    assert dono.patch(f"/api/perfis/{oculto}", json={"oculto": True}).status_code == 200
    # Os pontos não mudam conforme quem olha: o 2º de 2 vale 250, mesmo sem ver quem está na frente
    para_outro = outro.get("/api/ranking/geral", params={"temporada": "2025-07"}).json()["linhas"]
    assert [(l["apelido"], l["pontos"]) for l in para_outro] == [("Geral Visivel", 250)]
    para_dono = dono.get("/api/ranking/geral", params={"temporada": "2025-07"}).json()["linhas"]
    assert [(l["apelido"], l["pontos"], l["eu"]) for l in para_dono] == [("Geral Oculto", 750, True), ("Geral Visivel", 250, False)]


def test_ranking_geral_temporada_atual_e_invalida(app_ativo):
    c, _ = com_perfil(app_ativo, "Geral Agora")
    corpo = c.get("/api/ranking/geral").json()
    lista = c.get("/api/ranking/temporadas").json()
    assert corpo["temporada"] == corpo["atual"] == lista["atual"] == lista["temporadas"][0]
    assert c.get("/api/ranking/geral", params={"temporada": "2099-01"}).json()["linhas"] == []
    for ruim in ("2025-13", "25-03", "2025-3", "geral"):
        assert c.get("/api/ranking/geral", params={"temporada": ruim}).status_code == 422
        assert c.get("/api/ranking/g03", params={"temporada": ruim}).status_code == 422


def test_ranking_do_jogo_por_temporada_e_de_todos_os_tempos(app_ativo):
    """Mesmo filtro de mês do geral: o ranking do jogo no mês só vê as partidas daquele mês."""
    a, pa = com_perfil(app_ativo, "Mes A")
    _, pb = com_perfil(app_ativo, "Mes B")
    _resultado(pa, "g03", 100, "2025-08-10 12:00-03")
    _resultado(pb, "g03", 70, "2025-08-20 12:00-03")
    _resultado(pa, "g03", 50, "2025-09-05 12:00-03")
    agosto = [(l["apelido"], l["posicao"], l["pontos"]) for l in a.get("/api/ranking/g03", params={"temporada": "2025-08"}).json()]
    setembro = [(l["apelido"], l["posicao"], l["pontos"]) for l in a.get("/api/ranking/g03", params={"temporada": "2025-09"}).json()]
    assert agosto == [("Mes A", 1, 100), ("Mes B", 2, 70)]
    assert setembro == [("Mes A", 1, 50)]                    # em setembro, vale a melhor partida de setembro
    sempre = {l["apelido"]: l["pontos"] for l in a.get("/api/ranking/g03").json() if l["eu"]}
    assert sempre == {"Mes A": 100}                          # todos os tempos: a melhor de qualquer mês


def test_limite_de_partidas_por_minuto(app_ativo):
    c, _ = com_perfil(app_ativo, "Spammer")
    codigos = [c.post("/api/partidas/inicio", json={"jogoId": "g01", "runId": str(uuid.uuid4())}).status_code for _ in range(22)]
    assert codigos.count(201) == 20 and codigos[-1] == 429


# ---------- Personagem (AvatarConfig v1, seção 9.3) ----------
AVATAR_OK = {  # IDs do catálogo único: packages/flix-avatar/src/catalog.json e palettes.json
    "v": 1,
    "body": {"type": "b01", "skinTone": "sk03"},
    "face": {"eyes": "e01", "mouth": "m01"},
    "hair": {"style": "h02_long", "color": "hc04"},
    "top": {"item": "t02_hoodie", "primary": "c02"},
    "bottom": {"item": "p01_pants", "primary": "c06"},
    "shoes": {"item": "s01_sneaker", "primary": "c01"},
    "hat": {"item": "hat01_cap", "primary": "c05"},
    "accessories": [],
    "skinPreset": None,
}

def test_salva_e_devolve_o_personagem(app_ativo):
    c, pid = com_perfil(app_ativo, "Estiloso")
    r = c.put(f"/api/perfis/{pid}/avatar", json=AVATAR_OK)
    assert r.status_code == 200, r.text
    assert r.json()["avatar"]["body"]["skinTone"] == "sk03"
    assert c.get("/api/sessao").json()["perfis"][0]["avatar"]["hair"]["style"] == "h02_long"


def test_personagem_so_aceita_ids_do_catalogo(app_ativo):
    c, pid = com_perfil(app_ativo, "Criativo")
    ruins = [
        {**AVATAR_OK, "body": {"type": "b01", "skinTone": "#FF0000"}},            # cor livre
        {**AVATAR_OK, "hat": {"item": "<script>", "primary": None}},              # fora do catálogo
        {**AVATAR_OK, "accessories": ["a", "b", "c", "d"]},                         # mais de 3
        {**AVATAR_OK, "accessories": ["oculos"]},                                   # fora do catálogo
        {**AVATAR_OK, "foto": "data:image/png;base64,AAAA"},                        # campo extra (imagem)
        {**AVATAR_OK, "v": 2},
    ]
    for corpo in ruins:
        assert c.put(f"/api/perfis/{pid}/avatar", json=corpo).status_code == 422, corpo


def test_nao_altera_personagem_de_outra_conta(app_ativo):
    _, pid_alheio = com_perfil(app_ativo, "Alvo")
    invasor = novo_cliente(app_ativo)
    assert invasor.put(f"/api/perfis/{pid_alheio}/avatar", json=AVATAR_OK).status_code == 404


def test_catalogo_do_editor_vem_do_pacote_do_personagem(app_ativo):
    cat = TestClient(app).get("/api/avatar/catalogo").json()
    assert {c["id"] for c in cat["paletas"]["pele"]} >= {"sk01", "sk_f01"}
    assert {"id": "h02_long", "nome": "Longo"} in cat["cabelos"]
    assert cat["padrao"]["body"]["type"] == "b01"


def test_personagem_com_peca_retirada_volta_como_padrao(app_ativo):
    """Peça que saiu do catálogo não quebra o perfil: o personagem volta como None (padrão)."""
    c, pid = com_perfil(app_ativo, "Antigo")
    sql("UPDATE perfis SET avatar = %s::jsonb WHERE id = %s", '{"v": 1, "body": {"type": "corpo-a"}}', pid)
    assert c.get("/api/sessao").json()["perfis"][0]["avatar"] is None


# ---------- Personagem Flix (arte própria) ----------
FLIX_OK = {"v": 4, "motor": "flix", "corpo": "f", "visual": "box-braids-longas"}


def test_salva_personagem_flix(app_ativo):
    c, pid = com_perfil(app_ativo, "Pixelado")
    r = c.put(f"/api/perfis/{pid}/personagem", json=FLIX_OK)
    assert r.status_code == 200, r.text
    assert r.json()["personagem"] == FLIX_OK


def test_personagem_flix_com_tom_de_pele(app_ativo):
    c, pid = com_perfil(app_ativo, "Tonalizado")
    escura = {**FLIX_OK, "pele": "escura"}
    r = c.put(f"/api/perfis/{pid}/personagem", json=escura)
    assert r.status_code == 200, r.text
    assert c.get("/api/sessao").json()["perfis"][0]["personagem"] == escura
    ruins = [
        {**FLIX_OK, "pele": "#000000"},           # cor livre
        {**FLIX_OK, "pele": "azul"},              # tom que não existe
        {**FLIX_OK, "pele": "media"},             # o padrão não se guarda (pele ausente)
        {"v": 4, "motor": "flix", "corpo": "m", "visual": "arthur", "pele": "escura"},  # Desenvolvedores: sem troca
    ]
    for corpo in ruins:
        assert c.put(f"/api/perfis/{pid}/personagem", json=corpo).status_code == 422, corpo


def test_personagem_flix_so_aceita_visual_do_catalogo(app_ativo):
    c, pid = com_perfil(app_ativo, "Recusado")
    ruins = [
        {**FLIX_OK, "corpo": "x"},
        {**FLIX_OK, "visual": "../../etc"},
        {**FLIX_OK, "visual": "<script>"},
        {**FLIX_OK, "corpo": "m"},                # visual feminino no corpo masculino
        {**FLIX_OK, "extra": 1},                  # campo desconhecido
        {**FLIX_OK, "v": 3},
        {k: v for k, v in FLIX_OK.items() if k != "visual"},
    ]
    for corpo in ruins:
        assert c.put(f"/api/perfis/{pid}/personagem", json=corpo).status_code == 422, corpo


def test_personagem_lpc_antigo_volta_como_none(app_ativo):
    """Personagem salvo no editor antigo (LPC, removido) não quebra o perfil: volta como None e a pessoa cria de novo."""
    c, pid = com_perfil(app_ativo, "Antigo LPC")
    sql("UPDATE perfis SET personagem = %s::jsonb WHERE id = %s", '{"v": 2, "motor": "lpc", "bodyType": "female", "selections": {}}', pid)
    assert c.get("/api/sessao").json()["perfis"][0]["personagem"] is None


def test_sem_avatar_remove_o_personagem(app_ativo):
    c, pid = com_perfil(app_ativo, "Sem Avatar")
    assert c.put(f"/api/perfis/{pid}/personagem", json=FLIX_OK).status_code == 200
    r = c.delete(f"/api/perfis/{pid}/personagem")
    assert r.status_code == 200, r.text
    assert r.json()["personagem"] is None
    assert c.get("/api/sessao").json()["perfis"][0]["personagem"] is None


def test_sem_avatar_nao_mexe_em_perfil_de_outra_conta(app_ativo):
    dono, pid = com_perfil(app_ativo, "Dono Avatar")
    assert dono.put(f"/api/perfis/{pid}/personagem", json=FLIX_OK).status_code == 200
    invasor = novo_cliente(app_ativo)
    assert invasor.delete(f"/api/perfis/{pid}/personagem").status_code == 404
    assert dono.get("/api/sessao").json()["perfis"][0]["personagem"] == FLIX_OK


# ---------- Página do jogo: avaliação, comentários e denúncias ----------
def test_catalogo_traz_a_media_das_avaliacoes(app_ativo):
    a, _ = com_perfil(app_ativo, "Critica A")
    b, _ = com_perfil(app_ativo, "Critica B")
    assert a.put("/api/jogos/g01/avaliacao", json={"nota": 5}).status_code == 200
    assert b.put("/api/jogos/g01/avaliacao", json={"nota": 4}).status_code == 200
    jogos = {j["id"]: j for j in a.get("/api/jogos").json()}
    det = a.get("/api/jogos/g01/detalhes").json()["avaliacao"]
    assert jogos["g01"]["avaliacao"] == {"media": det["media"], "total": det["total"]}  # mesma conta da página do jogo
    assert jogos["g01"]["avaliacao"]["total"] >= 2
    sem_nota = next(j for j in jogos.values() if j["avaliacao"]["total"] == 0)
    assert sem_nota["avaliacao"]["media"] is None


def test_perfil_traz_os_jogos_jogados_por_ultimo(app_ativo):
    c, _ = com_perfil(app_ativo, "Jogador Recente")
    assert c.get("/api/sessao").json()["perfis"][0]["recentes"] == []
    for jogo in ("g01", "g03", "g01"):  # o g01 de novo: volta para o começo, sem repetir
        assert c.post("/api/partidas/inicio", json={"jogoId": jogo, "runId": str(uuid.uuid4())}).status_code == 201
        time.sleep(0.01)
    assert c.get("/api/sessao").json()["perfis"][0]["recentes"] == ["g01", "g03"]


def test_catalogo_conta_as_partidas_terminadas(app_ativo):
    c, _ = com_perfil(app_ativo, "Conta Partidas")
    antes = {j["id"]: j["partidas"] for j in c.get("/api/jogos").json()}
    _jogar(c, "g03", pontos=50, duracao_ms=3500, espera=1.6)
    c.post("/api/partidas/inicio", json={"jogoId": "g03", "runId": str(uuid.uuid4())})  # aberta: não conta
    depois = {j["id"]: j["partidas"] for j in c.get("/api/jogos").json()}
    assert depois["g03"] == antes["g03"] + 1

def test_avaliacao_uma_nota_por_perfil_e_media(app_ativo):
    a, _ = com_perfil(app_ativo, "Avaliador A")
    b, _ = com_perfil(app_ativo, "Avaliador B")
    assert a.put("/api/jogos/g03/avaliacao", json={"nota": 5}).json()["minha"] == 5
    a.put("/api/jogos/g03/avaliacao", json={"nota": 4})  # muda a nota, não soma outra
    r = b.put("/api/jogos/g03/avaliacao", json={"nota": 2}).json()
    assert r["total"] == 2 and r["media"] == 3.0 and r["minha"] == 2
    assert a.put("/api/jogos/g03/avaliacao", json={"nota": 6}).status_code == 422
    assert a.put("/api/jogos/g10/avaliacao", json={"nota": 5}).status_code == 404  # não publicado


def test_comentario_publica_na_hora_e_aparece_para_todos(app_ativo):
    a, _ = com_perfil(app_ativo, "Comentarista")
    b, _ = com_perfil(app_ativo, "Leitora")
    r = a.post("/api/jogos/g03/comentarios", json={"texto": "  Jogo muito bom,   viciante!  "})
    assert r.status_code == 201 and r.json()["texto"] == "Jogo muito bom, viciante!" and r.json()["meu"]
    vistos = b.get("/api/jogos/g03/detalhes").json()["comentarios"]
    assert vistos[0]["apelido"] == "Comentarista" and not vistos[0]["meu"]


def test_filtro_recusa_palavrao_link_email_e_telefone(app_ativo):
    c, _ = com_perfil(app_ativo, "Testador Filtro")
    for ruim in ("que p0rr4 de jogo", "PORRRRA", "p.o.r.r.a", "veja www.golpe.com", "acesse http://x.io",
                 "me chama em ze@mail.com", "zap 11 98765-4321", "x"):
        r = c.post("/api/jogos/g03/comentarios", json={"texto": ruim})
        assert r.status_code == 422, ruim
    assert c.post("/api/jogos/g03/comentarios", json={"texto": "fiz 120 pontos no nível 3"}).status_code == 201


def test_limite_de_comentarios_por_minuto(app_ativo):
    c, _ = com_perfil(app_ativo, "Comenta Rapido")
    codigos = [c.post("/api/jogos/g03/comentarios", json={"texto": f"comentário {i}"}).status_code for i in range(4)]
    assert codigos == [201, 201, 201, 429]


def test_so_apaga_o_proprio_comentario(app_ativo):
    a, _ = com_perfil(app_ativo, "Dono Comentario")
    b, _ = com_perfil(app_ativo, "Intruso")
    cid = a.post("/api/jogos/g03/comentarios", json={"texto": "meu comentário"}).json()["id"]
    assert b.delete(f"/api/comentarios/{cid}").status_code == 404
    assert a.delete(f"/api/comentarios/{cid}").status_code == 204
    assert all(x["id"] != cid for x in a.get("/api/jogos/g03/detalhes").json()["comentarios"])


def test_tres_denuncias_ocultam_e_denuncia_repetida_nao_conta(app_ativo):
    autor, _ = com_perfil(app_ativo, "Autor")
    cid = autor.post("/api/jogos/g03/comentarios", json={"texto": "comentário polêmico"}).json()["id"]
    assert autor.post(f"/api/comentarios/{cid}/denuncia").status_code == 400  # não denuncia o próprio
    d1, _ = com_perfil(app_ativo, "Denunciante 1")
    for _ in range(3):
        d1.post(f"/api/comentarios/{cid}/denuncia")  # a mesma pessoa conta uma vez só
    assert any(x["id"] == cid for x in autor.get("/api/jogos/g03/detalhes").json()["comentarios"])
    for n in (2, 3):
        dn, _ = com_perfil(app_ativo, f"Denunciante {n}")
        assert dn.post(f"/api/comentarios/{cid}/denuncia").status_code == 204
    assert all(x["id"] != cid for x in autor.get("/api/jogos/g03/detalhes").json()["comentarios"])


def test_perfil_oculto_comenta_como_jogador_flix(app_ativo):
    a, pid = com_perfil(app_ativo, "Discreta")
    b, _ = com_perfil(app_ativo, "Curiosa")
    sql("UPDATE perfis SET oculto = true WHERE id = %s", pid)
    a.post("/api/jogos/g03/comentarios", json={"texto": "anônimo aqui"})
    assert b.get("/api/jogos/g03/detalhes").json()["comentarios"][0]["apelido"] == "Jogador Flix"
    assert a.get("/api/jogos/g03/detalhes").json()["comentarios"][0]["apelido"] == "Discreta"
