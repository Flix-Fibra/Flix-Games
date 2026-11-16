-- Personagem do editor Universal LPC: configuração para reconstruir o personagem (não uma imagem).
-- Validado na API contra app/lpc_permitidos.json (gerado do catálogo do LPC, só licenças sem "compartilhar igual").
ALTER TABLE perfis ADD COLUMN personagem JSONB CHECK (personagem IS NULL OR (jsonb_typeof(personagem) = 'object' AND pg_column_size(personagem) < 16384));
