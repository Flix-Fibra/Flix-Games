# Relatório de teste — G03 Fibra Conecta (rodada 1, 16/11/2026)

## Verificado [F]
| Item | Como | Resultado |
|---|---|---|
| Regras do jogo | `npm test` (Vitest): 26 testes em regras do jogo, SDK e personagem | Passou |
| Tipos | `npm run typecheck` | Passou |
| Build estático | `npm run build:snake`: `dist/index.html` + 1 arquivo JS, base relativa | 1,2 MB (327 KB gzip), dentro da meta de 3 MB |
| Contrato com o hub | `dev-host.html` no Chrome do computador: `ready` → `init` → `started` → `gameover` → `restart` → `started` | Funcionou; sem erros no console |
| Jogabilidade (teclado) | Menu → contagem → curva com seta → bateu na parede → tela de fim → recomeçar | Funcionou |
| Personagem | `init` com `avatar: null`: retrato padrão no menu, HUD e fim | Funcionou |

## Atualização (16/11/2026, fim do dia)
- [F] `npm test`: 61 testes passam (regras, travessia da parede, SDK, personagem, fonte e emblema pixel art, caminho do cabo, conector). `npm run typecheck` e `npm run build:snake` passam (333 KB gzip).
- [F] Vistos no Chrome durante o desenvolvimento: movimento fluido, onda vermelha e "LEVEL UP", cabo azul com conector, globo do sinal, travessia da borda e emblema do game over.
- [D] Não vistos rodando: conector nas duas pontas com espessura uniforme (última mudança) e o emblema sem fundo; o servidor foi encerrado por falta de memória.

## Não verificado [D]
- Celular real (Android de entrada e iPhone), toque/deslize, fluidez (meta: 30 FPS estáveis) e retomada ao trocar de aba.
- Navegadores além do Chrome no computador.
- Nenhuma requisição externa: o build não referencia domínios externos, mas falta conferir na aba de rede.
- Personagens de teste (azul, uniforme Flix, inválido) e o limite de 1,5 s sem `init`.
- Pontuação inválida no hub (negativa, enorme, repetida): é responsabilidade do hub.
- O ritmo do jogo durante o teste ficou lento porque a aba do navegador de automação estava em segundo plano; confirmar a velocidade real no celular.

## Como repetir
```bash
npm install
npm test
npm run typecheck
npm run dev:snake      # abrir http://localhost:5173/dev-host.html (ou o endereço de rede no celular)
npm run build:snake
```
