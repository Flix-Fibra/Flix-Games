-- Onde está o build de cada jogo: servido em /games/<pasta>/ e aberto no iframe do hub.
-- NULL = jogo ainda não entregue ("em breve"). Só letras minúsculas, números, _ e - (vira caminho de URL).
ALTER TABLE jogos ADD COLUMN pasta TEXT CHECK (pasta ~ '^[a-z0-9_-]{1,40}$');
