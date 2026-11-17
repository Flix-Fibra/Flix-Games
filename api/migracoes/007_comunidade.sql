-- Página do jogo: avaliação por estrelas, comentários e denúncias.
-- O perfil sempre vem da sessão (nunca do cliente). Apagar o perfil apaga o que ele escreveu (ON DELETE CASCADE).

-- Uma nota de 1 a 5 por perfil e jogo; mudar a nota substitui a anterior.
CREATE TABLE avaliacoes (
    perfil_id     UUID        NOT NULL REFERENCES perfis (id) ON DELETE CASCADE,
    jogo_id       TEXT        NOT NULL REFERENCES jogos (id),
    nota          SMALLINT    NOT NULL CHECK (nota BETWEEN 1 AND 5),
    atualizada_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (perfil_id, jogo_id)
);
CREATE INDEX avaliacoes_por_jogo ON avaliacoes (jogo_id);

-- Comentários: publicados na hora, depois do filtro da API (palavrões, links, telefones e e-mails).
-- oculto = escondido pela equipe ou por denúncias (fica guardado para revisão, não aparece para ninguém).
CREATE TABLE comentarios (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    perfil_id  UUID        NOT NULL REFERENCES perfis (id) ON DELETE CASCADE,
    jogo_id    TEXT        NOT NULL REFERENCES jogos (id),
    texto      TEXT        NOT NULL CHECK (char_length(texto) BETWEEN 2 AND 500),
    criado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
    oculto     BOOLEAN     NOT NULL DEFAULT false,
    denuncias  INTEGER     NOT NULL DEFAULT 0 CHECK (denuncias >= 0)
);
CREATE INDEX comentarios_por_jogo ON comentarios (jogo_id, criado_em DESC) WHERE NOT oculto;
CREATE INDEX comentarios_por_perfil ON comentarios (perfil_id, criado_em DESC);

-- Uma denúncia por perfil e comentário (denunciar de novo não conta duas vezes).
CREATE TABLE denuncias_comentario (
    comentario_id UUID        NOT NULL REFERENCES comentarios (id) ON DELETE CASCADE,
    perfil_id     UUID        NOT NULL REFERENCES perfis (id) ON DELETE CASCADE,
    criada_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (comentario_id, perfil_id)
);
