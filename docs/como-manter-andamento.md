# Instrução de trabalho — criar e manter docs/andamento.md

Aplicar esta instrução em toda mudança que altere o estado do FLIX Games. Português, texto direto. Qualquer pessoa ou IA pode continuar; não há donos por área. A autoria está no `git log`.

## 1. Finalidade

`docs/andamento.md` é o painel de controle versionado do projeto e a fonte única de verdade sobre seu estado. Seu início deve responder em menos de dois minutos:

1. O que já está pronto?
2. O que está parcial e por quê?
3. O que ainda não começou?
4. O que está bloqueado e esperando o quê?
5. Qual a próxima fase e como começar?

O painel deve permitir retomar o trabalho lendo apenas ele e os documentos apontados. Não é documentação técnica, diário, lista de commits, lista de desejos ou atribuição de trabalho. Arquitetura, regras e decisões ficam em documentos separados. Só o escopo aprovado entra como obrigação; hipóteses e ideias devem ser explicitamente identificadas e submetidas a decisão.

## 2. Ler antes de escrever

Nesta ordem:

1. `AGENTS.md`, se existir e for aplicável; `CLAUDE.md`, `README.md`, contexto, decisões e requisitos.
2. Estrutura e código: verificar o que executa de fato, sem confundir plano e implementação.
3. `git log` e `git status` do checkout usado. Se a inspeção for somente remota, declarar que o estado local dos colaboradores é desconhecido.
4. Testes, migrações, scripts e deploy, se existirem.

Determinar objetivo final e critério de conclusão; unidade natural de entrega que a equipe realmente valida; fases e dependências; trabalho de plataforma; convenções existentes. Se objetivo, unidade ou conclusão forem essencialmente ambíguos, fazer poucas perguntas objetivas antes de assumir decisões.

Neste projeto, a criação inicial foi autorizada para registrar dúvidas já levantadas. Usar o objetivo informado e identificar a decomposição em fases como provisória; não interromper esse registro para exigir respostas que o solicitante pediu para deixar no documento. A aprovação da primeira versão continua pendente.

Antes de alterações no sistema/servidor, cumprir o requisito de backup completo, datado, exclusivo e validado. Preservar segredos e backups antigos; registrar caminho/resultado sem expor credenciais. Se o backup necessário falhar, não modificar o alvo até existir alternativa válida. Para banco futuro, obter cópia consistente e testar restauração.

## 3. Estrutura obrigatória do painel

Manter a seguinte ordem:

### 3.1 Cabeçalho

Título; data da situação inicial em dd/mm/aaaa; frase de finalidade. Indicar última conferência para evitar que data inicial pareça data de atualização.

### 3.2 Legenda e pronto

| Símbolo | Significado |
|---|---|
| ⬜ | não começou |
| 🟡 | em andamento / parcial |
| ✅ | pronto |
| ⛔ | bloqueado; motivo em Obs. |
| — | não se aplica; justificar |

Definir critérios verificáveis adequados à entrega. Base:

- Funciona: existe e executa o fluxo ponta a ponta.
- Validado: conferido contra regra/resultado esperado identificado, com evidência.
- Testado: teste automatizado ou roteiro manual reproduzível registrado.
- Entregável: disponível no ambiente onde será usado, não só na máquina de desenvolvimento.

Documentos podem ter critérios adaptados, explicitados no painel. Uma parte só vira ✅ quando todos os critérios aplicáveis estão ✅; se faltar um e houver trabalho, é 🟡. Nunca marcar pronto por otimismo. Não usar “—” para esconder critério faltante.

### 3.3 Próxima fase

Apontar a primeira fase não concluída na ordem de dependência. Informar entrega em uma ou duas frases, pré-requisitos com links, documentos prévios, comandos exatos para rodar/testar e armadilhas conhecidas. Se não houver aplicação executável, declarar e fornecer comandos reais de inspeção, sem inventar execução. Detalhar migrações/cargas pendentes quando existirem. Atualizar quando a fase terminar.

### 3.4 Resumo

Tabela curta com fase, unidade de entrega, partes prontas/total e situação em uma frase. Última linha: total. Conferir os números com as tabelas detalhadas. Contagens têm unidade e data de conferência.

### 3.5 Onde parou

Parágrafos curtos e datados, mais recentes primeiro. Dizer o que foi feito, o que falta e exatamente o que quem continuar precisa executar: comandos, migrações e cargas. Condensar/apagar entradas obsoletas; preservar o estado útil, não um diário de commits.

### 3.6 Fases/unidades

Cada fase contém:

- Tabela `Parte | Funciona | Validado | Testado | Entregável | Data | Obs.`; ajustar os critérios somente se necessário e explicar.
- Tabela `Item | Situação | Data | Obs.` para pendências.

Sem coluna de responsável. Bloqueio identifica causa e informação/ação que desbloqueia. Fases ainda propostas não são compromissos aprovados.

### 3.7 Plataforma

Tabela `Item | Situação | Data | Obs.`: identidade, permissões, deploy, agendamento, segurança, backup, monitoramento e outros itens necessários à operação. Separar requisito confirmado de mecanismo ainda proposto.

### 3.8 Documentação e repositório

Registrar documentos ausentes/desatualizados, contradições, numeração, variáveis não documentadas e outras dívidas. Não deixar vazio: se nada se aplicar, escrever “—” e explicar por quê.

### 3.9 Perguntas em aberto

Tabela `Pergunta | Quem pode responder | Resposta | Data`. A fonte pode ser solicitante, setor, cliente ou fornecedor; não é responsável pela execução. Manter identificadores estáveis Q01 etc. Registrar toda decisão que depende de terceiros. Ao responder, preencher resposta, fonte/evidência e data; nunca apagar a pergunta. Evitar dados confidenciais, pois a visibilidade do repositório precisa ser considerada.

## 4. Evidência e escrita

| Etiqueta | Uso |
|---|---|
| [F] | observado diretamente no código, arquivo, banco ou tela |
| [C] | confirmado por teste, cálculo ou pessoa identificável |
| [REL] | relato ainda não verificado |
| [H] | hipótese ou proposta |
| [D] | desconhecido |
| [X] | contradição sem explicação |

Regras:

1. Etiquetar afirmações factuais e propostas. Explicar o que foi ou não verificado. Etiquetas podem abranger uma célula ou parágrafo claramente delimitado.
2. Toda linha que muda de estado recebe data dd/mm; manter ano de referência explícito.
3. Escrever para quem não acompanhou a conversa, sem “como combinamos” ou referências vagas.
4. Ser específico sobre divergência, impedimento e desbloqueio.
5. Números com unidade e data da conferência; não inventar estimativas ou percentuais.
6. Usar caminhos, comandos e commits exatos; links devem resolver.
7. Nenhum ⛔ sem motivo e condição de desbloqueio.
8. Não duplicar regras técnicas: apontar para a documentação correspondente.
9. Manter curto. Células com cerca de cinco linhas ou mais devem ser movidas para documento próprio e substituídas por link.
10. Não apagar pendências resolvidas: marcar ✅ com data/evidência; condensar apenas quando o histórico ficar longo.
11. Corrigir divergências entre resumo e detalhes com base na evidência real; quando não conseguir confirmar, registrar [D] ou [X].

## 5. Criação e conferência da primeira versão

1. Ler o repositório e listar unidade de entrega, fases e dependências.
2. Perguntar o essencial, respeitando a autorização de registrar as dúvidas pendentes.
3. Preencher todas as seções; itens inexistentes ficam ⬜. Seção inaplicável leva “—” com motivo.
4. Verificar todo ✅ no código/teste; documentação só pode estar pronta com seu próprio aceite/evidência. Não inferir código a partir de README.
5. Tornar a próxima fase executável por alguém sem memória da conversa.
6. Registrar lacunas documentais e comandos indisponíveis.
7. Informar ao solicitante o resumo, próxima fase, perguntas e limites da verificação; fornecer o link publicado ou declarar precisamente a falha de publicação.

## 6. Manutenção em cada mudança

Atualizar o andamento no mesmo commit da mudança que altera algum estado. Antes:

- Reler o painel inteiro e confrontar resumo, detalhes e implementação.
- Registrar a evidência, teste e data de cada alteração de estado.
- Atualizar “Onde parou” com os passos para a próxima pessoa continuar.
- Reapontar a próxima fase quando a atual terminar.
- Manter respostas antigas e pendências resolvidas; não preencher resposta por dedução.
- Se encontrar erro fora do trabalho atual e não conseguir conferir, registrar pendência/pergunta em vez de corrigir no escuro.
- Manter o topo legível em menos de dois minutos e detalhes em links quando necessário.

A honestidade é o critério principal: parcial demonstrado vale mais do que pronto sem comprovação.
