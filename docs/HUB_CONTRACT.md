# Contrato entre jogo e hub (versão 2)

O jogo roda em um **iframe** do hub e eles conversam por `postMessage`. O jogo **não** envia pontuação para API, não mostra anúncio, não guarda chaves e não guarda o personagem. Quem faz isso é o hub. Implementação do lado do jogo: `packages/flix-game-sdk`.

## Jogo → hub

```ts
{ source: 'flix-game', v: 2, type: 'ready', gameId, capabilities: { sdkVersion, avatarTier: 'A'|'B', avatarViews: ('side'|'top'|'portrait'|'fp_hands')[] } }
{ source: 'flix-game', v: 2, type: 'started', gameId, runId }
{ source: 'flix-game', v: 2, type: 'gameover', gameId, runId, score, durationMs, meta? }
```

- `runId`: UUID novo a cada partida.
- `score`: inteiro maior ou igual a 0. `durationMs`: duração da partida. `meta`: números ou textos simples (no G03: `houses`, `level`, `cause`).

## Hub → jogo

```ts
{ source: 'flix-hub', v: 2, type: 'init', avatar: AvatarConfig | null, muted: boolean, locale?: string }
{ source: 'flix-hub', v: 2, type: 'restart' }
{ source: 'flix-hub', v: 2, type: 'pause' }
{ source: 'flix-hub', v: 2, type: 'resume' }
{ source: 'flix-hub', v: 2, type: 'mute', muted: boolean }
```

## Fluxo

1. O jogo carrega e envia `ready`.
2. O hub responde `init`. Se não chegar em 1,5 s, o jogo segue com o personagem padrão.
3. O jogador toca e começa; o jogo envia `started`.
4. Ao perder (ou acabar o tempo), o jogo envia `gameover` e **espera**.
5. O hub envia `restart` quando o jogador pedir. **Sem anúncio por enquanto** (decisão de 16/11/2026).
6. Fora de um iframe (desenvolvimento), o jogo mostra um botão próprio de recomeçar.

## Segurança

- O jogo só aceita mensagens com `event.origin` igual ao `hubOrigin` configurado (`?hubOrigin=` na URL) e vindas de `window.parent`. Nunca usa `'*'` como destino.
- Mensagens sem `source` e `v` esperados são ignoradas.
- O `AvatarConfig` é validado contra o catálogo; ID desconhecido vira o item padrão.
- O hub deve tratar a pontuação como **não confiável**: limite de requisições, faixa plausível por jogo e por `durationMs`, e rejeitar `runId` repetido.

## Testar sem o hub

`npm run dev:snake` e abrir `/dev-host.html`. A página simula o hub: responde `init` com personagens de teste, mostra o fim da partida e envia `restart`, `pause`, `resume` e `mute`. O log mostra todas as mensagens.
