# Como adicionar fases (G06 Minigolfe Flix)

As fases são **texto em grade**: uma letra por bloco. Para recriar um campo a partir de uma imagem, desenhe a grade bloco a bloco. Nada de editor externo.

## Onde

`games/minigolfe/src/levels.ts`, lista `LEVEL_DEFS`. Cada fase é um objeto; a **ordem da lista é a ordem do percurso**. O ranking é o total de tacadas no percurso inteiro (menos é melhor).

```ts
{
  id: 'cidade-01',      // único, sem espaços
  name: 'Calçada',      // aparece embaixo da tela
  par: 3,               // de 1 a 6
  rows: [
    '#########',
    '#...H...#',
    '#..o.o..#',
    '#...T...#',
    '#########',
  ],
}
```

## Legenda

| Letra | Significa |
|---|---|
| `#` | parede (a bola quica) |
| (espaço) | vazio, fora do campo (a bola que chega aqui volta, +1 tacada) |
| `.` | grama |
| `T` | largada (uma só) |
| `H` | buraco (um só) |
| `s` | areia: freia muito |
| `i` | gelo: escorrega |
| `~` | água: a bola volta ao ponto da tacada, +1 tacada |
| `^` `v` `<` `>` | esteira (chão vermelho com setas): empurra a bola nessa direção |
| `o` | poste de cabo: quica com força |
| `m` / `M` | ímã que atrai / que repele |
| `1` a `9` | portal de sinal: cada número aparece **exatamente 2 vezes** e leva ao par |
| `/` `\` | parede diagonal (corta o bloco de canto a canto) |
| `B` | **bomba**: prende a bola e mira sozinha, girando; o jogador só escolhe a força |
| `W` | **moinho**: pás que giram (4 pás, no centro do bloco) |
| `P` | **pistão**: sobe e desce |
| `X` / `Y` | **lava**: acende e apaga; X e Y se alternam (quando um acende o outro apaga) |
| `U` `D` `L` `R` | **rampa de salto** para cima, baixo, esquerda e direita: a bola voa por cima da água, lava, pistão e moinho |

## Engenhos que se mexem

Bomba, moinho, pistão, lava e rampa de salto entram só com a letra na grade. O **bloco móvel** (o bloco branco que desliza pela trilha) entra no campo `blocks` da fase, com os cantos de cima à esquerda do começo e do fim, em blocos da grade:

```ts
blocks: [{ from: [5, 4], to: [3, 4], size: [2, 1], period: 4, phase: 0 }],
```

`size` é largura x altura em blocos (padrão 1 x 1), `period` é o tempo de ida e volta em segundos (padrão 4) e `phase` (0 a 1) é onde do ciclo ele começa; use fases diferentes para blocos que se alternam. A trilha é desenhada sozinha.

Para ajustar uma fase só, `tune` aceita `cannonSpeed`, `windSpeed`, `windBlades`, `windLen`, `lavaPeriod` e `pistonPeriod` (ex.: `tune: { windBlades: 2, windLen: 2.3 }` faz uma pá gigante). Os padrões estão em `logic.ts`.

O relógio da fase corre sempre, com a bola parada: a bomba gira, o moinho roda e a lava pisca enquanto o jogador mira. Isso é de propósito: a graça é esperar o momento certo.

## Regras (conferidas ao carregar; o erro diz a fase e a linha)

- Todas as linhas com o **mesmo número de colunas**; no máximo **16 x 24** blocos.
- Uma `T` e um `H`. O buraco precisa ser **alcançável** a partir da largada (andando por grama, areia, gelo e portais; água e vazio não contam).
- Cerque o campo com `#`. A grade pode ter qualquer formato (L, T, corredores).
- Par é a sua estimativa de tacadas para um jogador bom.
- A água pode ficar no caminho **se a fase tiver uma rampa de salto** (a validação considera que dá para voar por cima); sem rampa, a água isola o buraco e a fase é recusada.
- Bomba, moinho, pistão, lava e bloco móvel contam como chão livre na validação (dependem de tempo). **Confira sempre com o robô** (abaixo): ele joga a fase e diz se dá para encaçapar.

## Como testar

```bash
npm test                  # confere que toda fase em levels.ts é válida
SOLVE=1 npx vitest run games/minigolfe/tools   # robô joga cada fase e mostra o melhor número de tacadas que achou (calibra o par)
npm run dev:minigolfe     # http://localhost:5173 (abra com ?debug para mexer no jogo pelo console)
```

Em `?debug`, no console: `__flixGame.scene.getScene('Play')` dá a cena; `run.index = N; loadHole()` pula para a fase N.

## Ajustes finos da física

Em `games/minigolfe/src/logic.ts` (tudo em blocos e segundos): `MAX_SPEED`, `SURFACES` (atrito de cada piso), `WALL_RESTITUTION`, `HOLE_CAPTURE_SPEED` (acima disso a bola passa por cima do buraco), `SLOPE_ACCEL`, `MAGNET_FORCE`, `MAX_STROKES` (limite por buraco), `CANNON_SPEED`, `WINDMILL_SPEED`, `PISTON_PERIOD`, `LAVA_PERIOD`, `JUMP_AIR_PER_SPEED` (quanto tempo a bola fica no ar por velocidade).

O conceito de cada fase do percurso (caminho seguro x atalho arriscado) está em `docs/MINIGOLFE_FASES.md`.
