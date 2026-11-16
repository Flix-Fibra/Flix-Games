-- Personagem do perfil (AvatarConfig v1, seção 9.3 do prompt dos minigames).
-- Só IDs do catálogo, validados na API antes de gravar. NUNCA imagem: a câmera roda só no aparelho.
ALTER TABLE perfis ADD COLUMN avatar JSONB CHECK (avatar IS NULL OR (jsonb_typeof(avatar) = 'object' AND pg_column_size(avatar) < 2048));
