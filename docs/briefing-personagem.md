# Briefing: arte do personagem do Flix Games (pixel art)

Para o pixel artist. Complementa a seção 9 do [prompt dos minigames](prompt-inicio-minigames-flix.md) (rig, camadas e modelo de dados). O sistema (editor, catálogo, gravação e envio aos jogos) já está pronto; falta a arte.

## O que é

O cliente monta o próprio personagem no portal escolhendo peças de uma lista. O mesmo personagem aparece:
- **no portal**, de corpo inteiro no editor e como retrato (cabeça e ombros) no perfil e no ranking;
- **nos jogos**, como sprite de corpo inteiro com animações (rig da seção 9.2; tamanho a confirmar, ver "Estilo").

## Estilo

**Referência de estilo: o personagem da Flix** (menina de cabelo cacheado ruivo, roupa preta, em pose de ação), enviado pelo solicitante em 16/11/2026. Foi feito com ferramenta de IA/gerador: serve **só como referência de estilo**. Todas as peças do catálogo são desenhadas à mão pelo artista, em camadas, com autoria humana e direitos cedidos à Flix. A imagem não fica neste repositório público.

- Pixel art **chibi de corpo inteiro**: cabeça grande, olhos grandes com brilho, corpo pequeno, pose com atitude.
- Cabelo com muito volume e mechas em vários tons da mesma cor; roupas com dobras e sombra.
- Contorno escuro de 1 px; luz vindo da esquerda e de cima; rampas de 4 tons por cor (contorno, sombra, base, luz).
- Original da Flix: não reproduzir personagens de outros jogos. Sem violência gráfica (objetos de ação em tom de brincadeira), sem marcas ou times de terceiros.
- **Se possível, o mesmo artista do personagem da Flix**, para todo o catálogo ter o mesmo traço.

[D] Tamanho: o rig v1 da seção 9.2 do prompt dos minigames prevê sprite de 32×32, mas o personagem de referência tem bem mais detalhe que isso. Definir com quem faz os jogos se o rig passa a ser maior (por exemplo 64×64) antes de o artista começar.

## Como entregar cada peça

- **Camadas separadas**, alinhadas no mesmo quadro (tamanho do rig a confirmar, ver "Estilo"), com fundo transparente.
- Ordem de cima para baixo: `accessory_back`, `hair_back`, `body`, `shoes`, `bottom`, `top`, `face`, `hair_front`, `accessory_face`, `hat`, `overlay` (seção 9.2).
- **Peças que mudam de cor** (pele, cabelo, roupas, chapéu) em **tons de cinza**, com o sombreado; o sistema pinta com a cor escolhida. Marcar qual parte é `primary`, `secondary` ou fixa (olhos, detalhes).
- Arquivo fonte do Aseprite + PNG exportado + `catalog.json` com o id de cada peça.
- **Cessão de direitos para a Flix** e declaração de que a arte é original (vai para o `ASSETS.md`).

## Lista de peças (fase 1)

**Fonte única: `packages/flix-avatar/src/catalog.json` e `palettes.json`** (os mesmos arquivos que os jogos e a API usam). Hoje o catálogo é um placeholder pequeno; o artista entrega as peças com IDs novos e o catálogo é ampliado junto, com o nome de cada peça no campo `labels`.

Metas da fase 1 (seção 9.4 do prompt dos minigames): 2 corpos, 3 olhos/expressões, 3 bocas, 8 cabelos (+ sem cabelo), 6 camisetas, 4 calças ou bermudas, 4 calçados, até 6 chapéus e acessórios, 3 visuais completos (incluindo o Técnico Flix, `flix_tech`); paletas de pele (12 realistas + 4 fantasia), cabelo (10) e roupa (16), cada cor com rampa de tons.

Sugestões vindas dos testes com o cliente (opcionais, a aprovar): sardas, cor dos olhos (castanho, verde, azul), brincos.

## Ordem de entrega sugerida

1. Corpo base (2 tipos) com rosto, olhos e bocas, no mesmo estilo do personagem da Flix: é o que define se o estilo está aprovado.
2. Cabelos (frente e trás), camisetas, calças e calçados.
3. Chapéus, acessórios e visuais completos (incluindo o personagem oficial da Flix como visual completo).
4. Animações dos jogos (visões `side` e `portrait`; `top` e `fp_hands` depois, seção 9.2).

## Critério de aceite

- Toda combinação de peças encaixa sem buracos nem sobreposição errada (chapéu sobre cabelo, óculos sobre olhos).
- Pele, cabelo e roupa ficam bonitos nas cores de todas as paletas, inclusive tons de pele escuros e cores fantasia.
- Aprovado pelo cliente em uma prévia com 5 combinações diferentes.
