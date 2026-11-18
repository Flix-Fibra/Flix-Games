-- Prévia animada do jogo (WebP/GIF curto, sem som) mostrada atrás do topo da página "Ver".
-- Mesma regra da capa: só caminho dentro da pasta do jogo, sem "..", sem barra inicial e sem endereço externo.
ALTER TABLE jogos ADD COLUMN previa TEXT
    CHECK (previa ~ '^[a-z0-9_-]+(/[a-z0-9_-]+)*\.(webp|gif)$' AND length(previa) <= 80);
