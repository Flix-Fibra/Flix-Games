-- Imagens do jogo (telas do jogo em ação) na galeria da página "Ver", junto da prévia animada.
-- Mesma regra da capa: só caminhos dentro da pasta do jogo, sem "..", sem barra inicial e sem endereço externo;
-- no máximo 8 imagens, cada caminho com até 80 caracteres. Vêm do game.json (scripts/sincronizar-catalogo.mjs).
ALTER TABLE jogos ADD COLUMN imagens TEXT[] NOT NULL DEFAULT '{}'
    CHECK (cardinality(imagens) <= 8
           AND (cardinality(imagens) = 0
                OR array_to_string(imagens, '|') ~ '^[a-z0-9_-]+(/[a-z0-9_-]+)*\.(png|jpg|jpeg|webp)(\|[a-z0-9_-]+(/[a-z0-9_-]+)*\.(png|jpg|jpeg|webp))*$')
           AND length(array_to_string(imagens, '|')) <= 8 * 81);
