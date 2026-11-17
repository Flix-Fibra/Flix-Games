-- Capa do jogo: caminho de uma imagem DENTRO da pasta do jogo (servida em /games/<pasta>/<capa>).
-- A fonte é o game.json de cada jogo; quem grava aqui é scripts/sincronizar-catalogo.mjs.
-- NULL = sem capa (o portal mostra o ícone desenhado). Sem ".." nem barra inicial: não sai da pasta do jogo.
ALTER TABLE jogos ADD COLUMN capa TEXT CHECK (capa ~ '^[a-z0-9_-]+(/[a-z0-9_-]+)*\.(png|jpg|jpeg|webp)$' AND length(capa) <= 80);
