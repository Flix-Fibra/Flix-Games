-- Estrutura inicial do Flix Games.
-- Conta = cliente Flix (vem do sistema do App Flix). Perfis = até 2 por conta (limite aplicado na API, Q23).

CREATE TABLE contas (
    id          BIGSERIAL PRIMARY KEY,
    cliente_ref TEXT        NOT NULL UNIQUE,          -- código único do cliente no sistema do App Flix (Q04)
    ativo       BOOLEAN     NOT NULL DEFAULT TRUE,    -- falso = perdeu elegibilidade (Q05–Q07)
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE perfis (
    id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    conta_id  BIGINT      NOT NULL REFERENCES contas (id) ON DELETE CASCADE,
    apelido   TEXT        NOT NULL CHECK (char_length(apelido) BETWEEN 3 AND 20),
    cor       TEXT        NOT NULL CHECK (cor ~ '^#[0-9A-Fa-f]{6}$'),
    oculto    BOOLEAN     NOT NULL DEFAULT FALSE,     -- some do ranking para os outros (Q24)
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX perfis_apelido_por_conta ON perfis (conta_id, lower(apelido));

-- Uma sessão por aparelho, sem prazo de término; "sair" revoga só ela (Q09).
-- Guardamos só o hash do token: quem ler o banco não consegue usar a sessão.
CREATE TABLE sessoes (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    conta_id    BIGINT      NOT NULL REFERENCES contas (id) ON DELETE CASCADE,
    token_hash  BYTEA       NOT NULL UNIQUE,
    perfil_id   UUID        REFERENCES perfis (id) ON DELETE SET NULL,  -- quem está jogando neste aparelho
    aparelho    TEXT        NOT NULL DEFAULT '',
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
    visto_em    TIMESTAMPTZ NOT NULL DEFAULT now(),
    revogada_em TIMESTAMPTZ
);
CREATE INDEX sessoes_ativas_por_conta ON sessoes (conta_id) WHERE revogada_em IS NULL;

CREATE TABLE jogos (
    id             TEXT    PRIMARY KEY CHECK (id ~ '^g[0-9]{2}$'),
    nome           TEXT    NOT NULL,
    genero         TEXT    NOT NULL,
    descricao      TEXT    NOT NULL DEFAULT '',
    cor1           TEXT    NOT NULL,
    cor2           TEXT    NOT NULL,
    metrica        TEXT    NOT NULL,                  -- o que a pontuação mede (texto para a tela)
    unidade        TEXT    NOT NULL,
    ordem          TEXT    NOT NULL CHECK (ordem IN ('maior', 'menor')),  -- 'menor' = menos tacadas/tempo vence
    tem_ranking    BOOLEAN NOT NULL DEFAULT TRUE,
    pontos_min     INTEGER NOT NULL DEFAULT 0 CHECK (pontos_min >= 0),
    pontos_max     INTEGER NOT NULL CHECK (pontos_max > 0),
    duracao_min_ms INTEGER NOT NULL DEFAULT 1000 CHECK (duracao_min_ms >= 0),
    onda           SMALLINT NOT NULL,
    vitrine        SMALLINT NOT NULL DEFAULT 99,      -- ordem na fileira do Início
    publicado      BOOLEAN NOT NULL DEFAULT FALSE,    -- só publicado aparece e aceita partida
    CHECK (pontos_min < pontos_max)
);

-- Partida: o hub registra o runId no "started" e fecha no "gameover" (contrato do hub, seção 6).
CREATE TABLE partidas (
    id            BIGSERIAL   PRIMARY KEY,
    run_id        UUID        NOT NULL UNIQUE,        -- runId repetido é recusado
    perfil_id     UUID        NOT NULL REFERENCES perfis (id) ON DELETE CASCADE,
    jogo_id       TEXT        NOT NULL REFERENCES jogos (id),
    status        TEXT        NOT NULL DEFAULT 'iniciada' CHECK (status IN ('iniciada', 'finalizada', 'rejeitada')),
    iniciada_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
    finalizada_em TIMESTAMPTZ,
    pontos        INTEGER,
    duracao_ms    INTEGER,
    motivo        TEXT                                -- por que foi rejeitada (revisão pela TI)
);
CREATE INDEX partidas_validas ON partidas (jogo_id, perfil_id, pontos) WHERE status = 'finalizada';
CREATE INDEX partidas_por_perfil ON partidas (perfil_id, iniciada_em);

CREATE TABLE favoritos (
    perfil_id UUID        NOT NULL REFERENCES perfis (id) ON DELETE CASCADE,
    jogo_id   TEXT        NOT NULL REFERENCES jogos (id),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (perfil_id, jogo_id)
);

CREATE TABLE progresso (
    perfil_id     UUID        NOT NULL REFERENCES perfis (id) ON DELETE CASCADE,
    jogo_id       TEXT        NOT NULL REFERENCES jogos (id),
    percentual    SMALLINT    NOT NULL CHECK (percentual BETWEEN 0 AND 100),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (perfil_id, jogo_id)
);
