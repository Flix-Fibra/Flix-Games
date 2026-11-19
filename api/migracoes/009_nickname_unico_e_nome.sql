-- Nickname (coluna `apelido`) passa a ser único entre TODOS os perfis, não só dentro da conta; e o perfil ganha o nome
-- verdadeiro da pessoa, que só aparece para os outros quando ela habilita (decisão do solicitante, 19/11/2026).

-- 1) Nicknames repetidos entre contas (antes eram únicos só dentro da conta): o perfil mais antigo fica com o
--    nickname; os demais ganham um sufixo numérico ("Ana" → "Ana-2"), cabendo nos 20 caracteres. Se o sufixo colidir
--    com um nickname já existente, o índice abaixo falha e a migração inteira é desfeita (nada fica pela metade).
WITH repetidos AS (
    SELECT id, apelido,
           row_number() OVER (PARTITION BY lower(apelido) ORDER BY criado_em, id) AS n
      FROM perfis
)
UPDATE perfis p
   SET apelido = left(r.apelido, 20 - length(r.n::text) - 1) || '-' || r.n
  FROM repetidos r
 WHERE r.id = p.id AND r.n > 1;

-- 2) Único sem diferenciar maiúsculas ("Ana_Gamer" e "ana_gamer" são o mesmo nickname). Substitui o índice por conta.
CREATE UNIQUE INDEX perfis_apelido_unico ON perfis (lower(apelido));
DROP INDEX perfis_apelido_por_conta;

-- 3) Nome verdadeiro: opcional; só aparece no ranking quando mostrar_nome está ligado (padrão: desligado).
ALTER TABLE perfis
    ADD COLUMN nome         TEXT    CHECK (char_length(nome) BETWEEN 1 AND 40),
    ADD COLUMN sobrenome    TEXT    CHECK (char_length(sobrenome) BETWEEN 1 AND 60),
    ADD COLUMN mostrar_nome BOOLEAN NOT NULL DEFAULT FALSE,
    ADD CONSTRAINT perfis_mostrar_nome_exige_nome CHECK (NOT mostrar_nome OR nome IS NOT NULL);
