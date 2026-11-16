# Personagem personalizado (avatar) — resumo da especificação

Fonte completa: seção 9 do `prompt-inicio-minigames-flix.md`. Código: `packages/flix-avatar`.

## Princípios
- O jogador monta o personagem no hub e ele aparece em todos os jogos. O editor é do hub; o código que desenha é um só, compartilhado.
- **Só estética**: nunca muda a jogabilidade nem a área de colisão.
- Sem texto livre e sem upload: só IDs de um catálogo. O perfil é ligado à conta Flix do cliente (decisão de 16/11/2026).
- O jogo funciona sem personagem: o hub pode enviar `avatar: null` e o jogo usa o padrão.

## Modelo de dados (`AvatarConfig`, versão 1)
`body {type, skinTone}`, `face {eyes, mouth}`, `hair {style, color} | null`, `top`, `bottom`, `shoes`, `hat`, `accessories` (até 3) e `skinPreset`. Todo valor é ID de `catalog.json` ou `palettes.json`. A função `sanitizeAvatar` troca valores desconhecidos pelo padrão e nunca lança erro.

## Níveis de uso nos jogos
- **A**: o personagem é o protagonista (visões `side` ou `top`).
- **B**: o personagem aparece no HUD e na tela de fim (visão `portrait`; 3 expressões: `neutral`, `happy`, `sad`). O G03 é nível B e também pinta o cabo com a cor principal da roupa.

## Estado atual
- [F] Existe só a visão `portrait`, desenhada por código (placeholder) em `compose.ts`, com contorno de 1 px.
- [F] `catalog.json` e `palettes.json` têm poucos itens; os números finais vêm do designer.
- [D] Kit do designer (peças em tons de cinza, rig 32x32, animações) ainda não existe. Quando chegar, trocar o desenho por código pela pintura do atlas, mantendo `composePortrait(config, expression)`.
