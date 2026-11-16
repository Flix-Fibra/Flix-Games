# Hub: como o portal abre os jogos

Complementa a seção 6 do [prompt dos minigames](prompt-inicio-minigames-flix.md) (contrato v2) com o que o **lado do hub** já faz e o que isso exige de cada jogo. Implementação: `web/src/componentes/Jogando.tsx`.

## O que o hub faz

1. Abre `/games/<pasta>/?hubOrigin=<origem do portal>` num iframe em tela cheia. `pasta` vem da coluna `jogos.pasta` na API (NULL = "em breve").
2. Ao receber `ready`, responde `init` (`avatar: null` por enquanto, `muted`, `locale: 'pt-BR'`).
3. `started` → `POST /api/partidas/inicio` com o `runId`. `gameover` → `POST /api/partidas/fim` com `score` e `durationMs`, e mostra o resultado (pontos, posição, recorde) ou o motivo da recusa.
4. "Jogar de novo" → `restart` (sem anúncio). App em segundo plano → `pause`; voltou → `resume`. Botão de som → `mute`.
5. Só aceita mensagens vindas do próprio iframe e no formato do contrato (`source: 'flix-game'`, `v: 2`, `runId` UUID, `score` e `durationMs` inteiros ≥ 0). `gameover` de um `runId` que não foi registrado é ignorado.

A pontuação é tratada como não confiável (seção 6.4). A API recusa: `runId` repetido, pontuação fora da faixa do jogo, partida mais curta que o mínimo do jogo e `durationMs` maior que o tempo real desde o `started`. Recusas ficam gravadas com o motivo para a TI revisar. Limites por jogo: tabela `jogos` (`pontos_min`, `pontos_max`, `duracao_min_ms`), **provisórios** até cada jogo ficar pronto.

## Isolamento: o que muda para o jogo

O iframe usa `sandbox="allow-scripts allow-pointer-lock"`, **sem** `allow-same-origin`. O jogo roda como origem isolada ("null"): não lê o cookie de sessão nem o armazenamento do portal e não faz requisições em nome do cliente. Consequências para quem faz o jogo:

- **Sem `localStorage`, `sessionStorage`, IndexedDB ou cookies** dentro do jogo (o navegador lança erro). Progresso e preferências ficam com o hub.
- **Arquivos do jogo precisam de `Access-Control-Allow-Origin: *`** para o Phaser carregar JSON, imagens e áudio por requisição. O servidor de desenvolvimento (`web/vite.config.ts`) já envia; o nginx de produção precisa enviar em `/games/`. São arquivos públicos, sem cookie.
- O jogo envia mensagens com `window.parent.postMessage(msg, hubOrigin)` e valida `event.origin === hubOrigin` (seção 6.4). O hub, como não consegue usar a origem "null" como alvo, envia para a janela do iframe (`contentWindow`) com alvo `'*'`; a mensagem só chega àquele iframe.
- Teclado: depois do primeiro toque, o foco fica dentro do iframe e o portal não recebe as teclas (o Esc não fecha o jogo). Para sair: botão ✕ no topo ou "Sair" na tela de fim.

## Testar sem o jogo real

`games/_teste-hub/index.html` é um jogo mínimo que fala o contrato v2 (toque para manter a bolinha no ar; botão "Enviar pontuação absurda" para testar a recusa). Em desenvolvimento, o `semear` aponta G01, G02 e G15 para ele. Quando os jogos reais tiverem pasta, trocar `jogos.pasta` e apagar o jogo de teste.

O servidor de desenvolvimento serve `/games/<pasta>/` a partir de `games/<pasta>/dist` (build) ou `games/<pasta>/` (sem build), recusando caminhos que saiam da pasta.
