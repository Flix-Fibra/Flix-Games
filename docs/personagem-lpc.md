# Personagem: editor Universal LPC

Decisão do solicitante em 16/11/2026: o editor de personagens do portal passa a usar o **Universal LPC Spritesheet Character Generator** (código, lógica de composição e sprites). Para isso, **o portal web (`web/`) é distribuído sob GPL-3.0**. API, banco e servidor (`api/`) continuam proprietários: a GPL-3.0 só obriga o que é distribuído, e o código do servidor não sai do servidor.

Auditoria completa (licenças, riscos, alternativas): feita em 16/11/2026, antes desta implementação. **Não é parecer jurídico**; ver "Pendências" abaixo.

## Como está montado

| Parte | Onde | Origem |
|---|---|---|
| Código e sprites do LPC | `web/lpc` (submódulo Git, commit `0414067`, sem alterações) | Universal LPC, GPL-3.0 (código) + licenças por imagem (arte) |
| Catálogo de peças | `web/lpc-gerado/` (não versionado) | Gerador original do LPC, chamado por `web/scripts/lpc-gerar.mjs` |
| Peças liberadas para a API | `api/app/lpc_permitidos.json` (versionado) | Mesmo script, usando o catálogo e o `getAllCredits` do LPC |
| Ponte LPC ↔ React | `web/src/lpc/motor.ts`, `usarMotor.ts`, tipos em `lpc.d.ts` | Nossa |
| Editor | `web/src/componentes/personagem/` | Nossa (interface) sobre os modelos do LPC (`models/`) |
| Créditos e Licenças | `web/src/componentes/Creditos.tsx` (`#creditos`) | Nossa, com dados do catálogo do LPC |
| Salvar | `PUT /api/perfis/{id}/personagem` → `perfis.personagem` (migração 005) | Nossa |

Reaproveitado do LPC sem alterar: catálogo, estado e seleção (`state/`), renderizador por camadas e recolor WebGL/CPU (`canvas/`), modelos de árvore, variações, paletas e créditos (`models/`, `utils/credits.ts`), miniaturas (`loadPreview`, `drawPreview`) e o gerador de metadados. Escrito por nós: interface React, gerador aleatório (o LPC não tem), salvar e validar na API, exportação PNG e a página de créditos.

## Regra de licença das peças

Só entram peças cujas **imagens realmente usadas** (por tipo de corpo e variação) têm ao menos uma licença sem "compartilhar igual": **CC0, OGA-BY ou CC-BY**. Fora: CC-BY-SA, OGA-SA, GPL e a subcategoria de ferimentos. Assim o personagem gerado não herda "compartilhar igual". Aplicada no editor (`itemPermitido`, `pecasBloqueadas`) e na API (`lpc_permitidos.json`). Resultado no commit atual: 513 de 657 peças.

Consequência: o corpo **Musculoso** fica de fora (o corpo base dele só existe em CC-BY-SA/GPL). Corpos oferecidos: Masculino, Feminino e Adolescente.

O filtro de licença do próprio LPC é mais fraco (aceita a peça se **qualquer** imagem tiver licença permitida); por isso o portal aplica a regra acima por cima dele.

## Rodar

```bash
git submodule update --init --depth 1 web/lpc   # primeira vez (~500 MB de checkout)
cd web && npm ci && npm run dev                  # predev roda scripts/lpc-gerar.mjs
```

Atualizar o LPC: mudar o commit do submódulo, rodar `npm run lpc:gerar`, conferir `src/lpc/lpc.d.ts` contra as assinaturas do LPC e versionar o novo `api/app/lpc_permitidos.json`.

## Pendências

- **Fonte do portal (GPL-3.0):** a página de créditos aponta o repositório no GitHub. A Q44 pede repositório **privado**; se ficar privado, o código-fonte de `web/` precisa ser oferecido de outro jeito (por exemplo, um pacote para download no próprio portal).
- **Deploy:** `git archive` não inclui submódulos. O build precisa rodar num checkout com `web/lpc` (ou o deploy envia o `web/dist` gerado a partir do commit).
- **Jogos:** os jogos ainda recebem no `init` o `AvatarConfig` antigo (`packages/flix-avatar`). Mostrar o personagem LPC dentro dos jogos exige adaptar o contrato e o SDK.
- **Parecer jurídico** sobre: GPL no portal, a cláusula de DRM das licenças CC-BY com a distribuição pelo App Flix, e se personagens exportados são obra derivada.
- Uma imagem falta no próprio repositório do LPC (`hair/relm_xlong/adult/bg/climb.png`); o renderizador ignora e a animação de escalar desse cabelo fica sem ele.
