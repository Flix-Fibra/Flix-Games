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
def test_limite_de_4_perfis_por_conta(app_ativo):
    c = novo_cliente(app_ativo)
    assert c.get("/api/sessao").json()["maxPerfis"] == 4  # a interface lê o limite daqui
    assert c.post("/api/perfis", json={"apelido": "Um"}).status_code == 422  # curto demais
    criados = [c.post("/api/perfis", json={"apelido": a}) for a in ("Primeiro", "Segundo", "Terceiro", "Quarto")]
    assert [r.status_code for r in criados] == [201] * 4
    assert len({r.json()["cor"] for r in criados}) == 4  # cada perfil com uma cor diferente
    r = c.post("/api/perfis", json={"apelido": "Quinto"})
    assert r.status_code == 409 and "Limite de 4" in r.json()["detail"]


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
    c, pid = com_perfil(app_ativo, "Antigo")
    sql("UPDATE perfis SET personagem = %s::jsonb WHERE id = %s", '{"v": 2, "motor": "lpc", "bodyType": "female", "selections": {}}', pid)
    assert c.get("/api/sessao").json()["perfis"][0]["personagem"] is None


# ---------- Página do jogo: avaliação, comentários e denúncias ----------
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
    c, _ = com_perfil(app_ativo, "Apressado")
    codigos = [c.post("/api/jogos/g03/comentarios", json={"texto": f"comentário {i}"}).status_code for i in range(4)]
    assert codigos == [201, 201, 201, 429]


def test_so_apaga_o_proprio_comentario(app_ativo):
    a, _ = com_perfil(app_ativo, "Dono")
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
    a, pid = com_perfil(app_ativo, "Discreto")
    b, _ = com_perfil(app_ativo, "Curiosa")
    sql("UPDATE perfis SET oculto = true WHERE id = %s", pid)
    a.post("/api/jogos/g03/comentarios", json={"texto": "anônimo aqui"})
    assert b.get("/api/jogos/g03/detalhes").json()["comentarios"][0]["apelido"] == "Jogador Flix"
    assert a.get("/api/jogos/g03/detalhes").json()["comentarios"][0]["apelido"] == "Discreto"
