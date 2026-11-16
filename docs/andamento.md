# FLIX Games — andamento

Situação inicial: 13/11/2026. Última conferência: 16/11/2026.

Painel do estado atual, bloqueios e próxima entrega para qualquer pessoa ou IA continuar sem depender da conversa original.

## 1. Legenda e critério de pronto

| Símbolo | Significado |
|---|---|
| ⬜ | não começou |
| 🟡 | em andamento / parcial |
| ✅ | pronto |
| ⛔ | bloqueado; motivo e condição de desbloqueio em Obs. |
| — | não se aplica; motivo explícito |

Evidência: **[F]** observado diretamente; **[C]** confirmado por teste, cálculo ou pessoa; **[REL]** relato não verificado; **[H]** hipótese/proposta; **[D]** desconhecido; **[X]** contradição sem explicação. As etiquetas no início de uma célula se aplicam às afirmações daquela célula. Datas de estado: dd/mm; ano de referência: 2026.

Critérios: **Funciona** = entrega executa o fluxo ponta a ponta; **Validado** = resultado conferido contra regra/aceite identificado; **Testado** = teste automatizado ou roteiro manual reproduzível registrado; **Entregável** = disponível no ambiente de uso. Para descoberta, significam respectivamente documento utilizável, decisão confirmada, evidências revisadas e documento versionado/acessível. Qualquer exceção precisa ser justificada e aceita; não converter ausência de evidência em ✅.

Uma parte só está ✅ com todos os critérios aplicáveis ✅; qualquer critério faltante torna a parte 🟡 se houver trabalho ou ⬜ se não começou. ⛔ indica impedimento explícito. Nenhuma funcionalidade está marcada como pronta nesta versão [F].

## 2. Próxima fase

**Fase 0 — fechar descoberta e escopo da primeira versão [H].** Entrega: definir catálogo inicial, regras de acesso e ranking, selecionar uma arquitetura e registrar critérios de aceite. O conceito está confirmado; essas decisões ainda não [C/D].

**Pré-requisitos:** acesso de leitura ao repositório [F]; [contexto registrado](#fase-0--descoberta-e-escopo), parte F0.1, ainda parcial. Obter informações de FLIX e fornecedor para Q01–Q10 e catálogo Q11–Q15; isso bloqueia a decisão de integração, mas permite avançar nas outras perguntas [D]. Não iniciar implementação de funcionalidades antes da aprovação do escopo [C].

**Ler:** [visão e alternativas](visao-projeto.md), [perguntas em aberto](#9-perguntas-em-aberto) e [como manter este painel](como-manter-andamento.md).

**Comandos para começar, em uma pasta nova com Git instalado e acesso ao GitHub:**

```bash
git clone --branch Principal https://github.com/Flix-Fibra/Flix-Games-.git
cd Flix-Games-
git status --short --branch
git log -5 --oneline
git ls-files
cat docs/andamento.md
cat docs/visao-projeto.md
cat docs/como-manter-andamento.md
```

**Execução e testes:** não há aplicação, dependências, migrações ou comandos de inicialização/teste no estado inspecionado [F]. Não inventar `npm run dev`, `uvicorn` ou serviços. Nesta fase, validar respostas com sua fonte, links dos documentos e consistência entre resumo e tabelas. Se usar um checkout existente, verificar alterações locais antes de trocar de branch ou atualizar; não descartar trabalho de terceiros.

**Armadilhas:** branch principal chama-se `Principal` [F]; repositório é público [F]; fornecedor e jogos não foram informados [D]; print do site não comprova integração com o app [F/D]; alternativas A/B e recursos extras são propostas [H]. Não publicar dados de clientes, credenciais ou documentação confidencial. Nenhum dado deve ser recarregado e nenhuma migração deve ser aplicada: não existem no repositório inspecionado [F].

## 3. Resumo

[H] Unidade de entrega adotada para organizar o plano: fluxo verificável; na fase de descoberta, documento com decisão verificável. Ordem proposta sujeita ao fechamento da fase 0. Contagens conferidas nas tabelas abaixo em 13/11/2026 [F].

| Fase | Entrega | Partes prontas | Situação |
|---|---|---|---|
| 0 | Descoberta e escopo | 0/3 partes | 🟡 Contexto registrado; catálogo, integração e aceite pendentes [C/D] |
| 1 | Base técnica reproduzível | 0/3 partes | ⬜ Depende da escolha técnica; não há código [F/D] |
| 2 | Acesso do cliente e portal | 0/3 partes | ⬜ Depende de integração, elegibilidade e UX aprovadas [D] |
| 3 | Jogos e ranking | 0/3 partes | ⬜ Depende da lista de jogos e regras verificáveis [D] |
| 4 | Piloto e lançamento | 0/3 partes | ⬜ Depende dos fluxos anteriores e aceite operacional [D] |
| **Total** | **Plano preliminar** | **0/15 partes** | **[F] Nenhum fluxo de aplicação implementado no repositório inspecionado** |

## 4. Onde parou

**16/11/2026 — [F]** API criada em `api/` (FastAPI 0.162 + PostgreSQL 16.16, Docker): sessão por aparelho com cookie HttpOnly e hash no banco; login simulado só em desenvolvimento; até 2 perfis com trava contra corrida; partidas pelo contrato do hub (seção 6 do prompt dos minigames) com runId único, faixa plausível por jogo, duração mínima e duração limitada ao tempo real; ranking por jogo com `maior`/`menor` vence e perfis ocultos. Conferido: 19 testes passando; API local com migrações e dados fictícios; porta só em 127.0.0.1. [H] Limites de pontuação por jogo são provisórios. [D] Plugin `docker compose` não instalado no Mac do Rafael (Colima); validado com `docker run`. Próximo: ligar `web/` à API e ler o catálogo real.

**16/11/2026 — [F]** Interface migrada para `web/` (React + TS + Vite), mesmas telas do protótipo: Início, Ranking, Perfil e "Quem vai jogar?" (2 perfis). Conferido localmente: tipos e build sem erros; build de produção com JS de 79 KB comprimido; fluxos de perfil (entrar, trocar, criar, excluir, apelido repetido recusado), favoritar, ranking pelo botão e links `#ranking`/`#perfil`. Próximo: `api/` FastAPI + Postgres com Compose local, trocando `servicoSimulado` por chamadas HTTP.

**16/11/2026 — [C]** Decisões do solicitante após a leitura dos documentos: sem anúncios por enquanto (Q34); catálogo começa com 15 jogos e a meta é 20 (Q11); conta Flix com perfis ligados ao cliente (Q23); público igual à Q30; Doom-like com menos violência (inimigo e projétil diferentes); sem donos fixos por área, com o hub originalmente com o Rafael; trechos pontuais de código de referência permitidos; Tetris-like pode ser feito e vai ao jurídico depois de pronto (Q47–Q49). O prompt `prompt-inicio-minigames-flix.md` (v2.2) foi atualizado com essas decisões. Documentação movida para `docs/` e enviada ao GitHub no commit `ad9bc1e`. `visao-projeto.md` corrigido na seção 7 (catálogo de 15 jogos, meta 20). Gerar código só quando solicitado; commit e push só quando pedido.

**16/11/2026 — [C]** Protótipo visual em `prototipo/` (HTML/CSS/JS estático, sem servidor; dados fictícios) no padrão Flix Pulse, com escolha de até 2 perfis por conta (Q23). Stack decidida (Q46). Próximo: tornar o repositório privado (Q44), aprovar escopo da v1 (Q43) e iniciar a Fase 1 com login simulado atrás de uma interface, trocando pela API real quando a documentação chegar. Primeiro fluxo ponta a ponta sugerido [H]: jogo próprio Voo Flix gravando pontuação no ranking pelo servidor.

**16/11/2026 — [C]** Solicitante respondeu Q01–Q46 (exceto Q32), registradas na seção 9. Decisões principais: mesma conta do App Flix via API do dono do sistema; elegibilidade por API do CRM com bloqueio em até ~1 h; jogos leves para jogar sozinho, com ranking permanente por jogo; sem multiplayer, prêmios ou anúncios na primeira versão; hospedagem própria; repositório deve ficar privado. [D] Ainda pendentes: documentação da API de login/elegibilidade, lista de jogos com licença conferida (Q12), Q32 e aceite da primeira versão.

**13/11/2026 — [F]** Inspeção da branch `Principal` no commit `fe898e5776c745871e71a131f99bf7f0beedfad2`: apenas `README.md`; sem código, testes, scripts, migrações, deploy, `CLAUDE.md` ou `AGENTS.md`. [C] A direção de produto e a solicitação de documentação vieram do solicitante; [H] opções técnicas foram registradas sem escolher uma. Quem continuar deve executar os comandos da próxima fase, confirmar que o repositório não recebeu implementação posterior, priorizar Q01–Q15 e Q39–Q43 e preencher respostas com fonte/data. Não há serviço para reiniciar, migração para aplicar ou carga para executar [F].

## 5. Fases e partes

### Fase 0 — descoberta e escopo

| Parte | Funciona | Validado | Testado | Entregável | Data | Obs. |
|---|---|---|---|---|---|---|
| F0.1 Contexto, escopo e aceite | 🟡 | ⬜ | ⬜ | ⬜ | 13/11 | [C] Direção registrada em [visão](visao-projeto.md); [D] primeira versão e aceite não aprovados. Confirmar Q11–Q15 e Q43. |
| F0.2 Identidade e elegibilidade especificadas | ⬜ | ⬜ | ⬜ | ⬜ | 13/11 | [D] Fornecedor e contrato de integração ausentes; obter Q01–Q10. |
| F0.3 Arquitetura e plano de validação escolhidos | 🟡 | 🟡 | ⬜ | ⬜ | 16/11 | [C] Stack decidida pelo solicitante (ver Q46). [D] Falta plano de validação: roteiro de teste do primeiro fluxo e confirmação de Docker no servidor. |

| Item | Situação | Data | Obs. |
|---|---|---|---|
| Obter documentação e homologação do fornecedor | ⛔ | 13/11 | [D] Fornecedor não identificado; desbloqueia com Q01–Q03 e acesso autorizado a ambiente de teste. |
| Receber lista inicial de jogos | 🟡 | 16/11 | [C] Lista de trabalho com 15 jogos em `docs/prompt-inicio-minigames-flix.md` (seção 10). [D] Falta conferir licença e origem por título (Q12) e aprovar o catálogo. |
| Aprovar escopo e arquitetura | ⬜ | 13/11 | [H] Usar respostas prioritárias para registrar decisão; não transformar hipótese em requisito. |

### Fase 1 — base técnica reproduzível

| Parte | Funciona | Validado | Testado | Entregável | Data | Obs. |
|---|---|---|---|---|---|---|
| F1.1 Projeto local e comandos documentados | 🟡 | ⬜ | ⬜ | ⬜ | 16/11 | [F] `web/` em React 19 + TypeScript 5.9 + Vite 6.4 com versões fixas e `package-lock.json`; `npm run verificar` e `npm run build` sem erros; comandos no README. Dados simulados atrás de `ServicoGames`. [D] `api/`, `tarefas/` e Compose ainda não criados. |
| F1.2 Persistência e evolução de dados | 🟡 | ⬜ | 🟡 | ⬜ | 16/11 | [F] PostgreSQL 16 com migrações SQL numeradas (`api/migracoes/`), catálogo G01–G15 (todos não publicados; G10 bloqueado até o jurídico), perfis, sessões por aparelho, partidas, favoritos e progresso. [C] 19 testes automáticos passando em banco real. [D] Backup/restauração ainda não ensaiados. |
| F1.3 Verificações e homologação | ⬜ | ⬜ | ⬜ | ⬜ | 13/11 | [F] Sem automação; [D] ambiente depende de Q39–Q42. |

| Item | Situação | Data | Obs. |
|---|---|---|---|
| Definir versões, estrutura e contribuição | ⬜ | 13/11 | [H] Adotar após F0.3; não existem convenções de código herdadas. |
| Criar dados fictícios e configuração de exemplo | ⬜ | 13/11 | [H] Documentar somente nomes de variáveis, sem segredos. |

### Fase 2 — acesso do cliente e portal

| Parte | Funciona | Validado | Testado | Entregável | Data | Obs. |
|---|---|---|---|---|---|---|
| F2.1 Login, elegibilidade e encerramento de sessão | ⬜ | ⬜ | ⬜ | ⬜ | 13/11 | [D] Depende de F0.2; validar cliente permitido/negado, revogação e indisponibilidade. |
| F2.2 Entrada no site/app e catálogo adaptável | ⬜ | ⬜ | ⬜ | ⬜ | 13/11 | [C] Experiência desejada; [D] integração real e dispositivos não definidos. |
| F2.3 Identidade pública do jogador | ⬜ | ⬜ | ⬜ | ⬜ | 13/11 | [H] Apelido/avatar; [D] quantidade de perfis e visibilidade dependem de Q23–Q25. |

| Item | Situação | Data | Obs. |
|---|---|---|---|
| Validar abertura pelo Minha Flix | ⛔ | 13/11 | [D] Sem fornecedor, app de teste ou confirmação de WebView/navegador. Desbloqueia com Q03 e Q13. |
| Registrar jornada e critérios de acessibilidade | ⬜ | 13/11 | [H] Propor estados de carregamento, falha, acesso negado, toque e teclado; aprovar em Q16. |

### Fase 3 — jogos e ranking

| Parte | Funciona | Validado | Testado | Entregável | Data | Obs. |
|---|---|---|---|---|---|---|
| F3.1 Catálogo aprovado e jogo integrado | ⬜ | ⬜ | ⬜ | ⬜ | 16/11 | [C] Catálogo de trabalho com 15 jogos (G01–G15) no prompt dos minigames; meta de 20. [D] Licença e aprovação por título pendentes; nenhum jogo integrado. |
| F3.2 Partida, progresso e resultado verificável | ⬜ | ⬜ | ⬜ | ⬜ | 13/11 | [D] Depende de suporte de cada título e Q15/Q29; progresso é opcional até decisão. |
| F3.3 Ranking de clientes | ⬜ | ⬜ | ⬜ | ⬜ | 13/11 | [C] Ranking solicitado; [D] regras, desempate e revisão ainda não definidos. |

| Item | Situação | Data | Obs. |
|---|---|---|---|
| Confirmar distribuição e integração por título | ⛔ | 13/11 | [D] Sem lista e permissões; desbloqueia com ficha de cada jogo em Q11–Q12/Q15. |
| Especificar validação e prevenção de reenvio | ⬜ | 13/11 | [H] Registrar por jogo; token válido não comprova resultado verdadeiro. |
| Decidir recursos opcionais | ⬜ | 13/11 | [H] Avaliar Q18–Q22/Q26–Q28; aprovação atual não existe. |

### Fase 4 — piloto e lançamento

| Parte | Funciona | Validado | Testado | Entregável | Data | Obs. |
|---|---|---|---|---|---|---|
| F4.1 Operação e administração mínimas | ⬜ | ⬜ | ⬜ | ⬜ | 13/11 | [H] Capacidade de retirar jogo e tratar acesso/resultados; aprovar Q35–Q38. |
| F4.2 Piloto com evidências de uso e carga | ⬜ | ⬜ | ⬜ | ⬜ | 13/11 | [D] Público, limites, dispositivos e métricas não definidos. |
| F4.3 Publicação e aceite da primeira versão | ⬜ | ⬜ | ⬜ | ⬜ | 13/11 | [D] Ambiente e aceite pendentes; depende de plataforma e F4.2. |

| Item | Situação | Data | Obs. |
|---|---|---|---|
| Definir roteiro de aceite e amostra do piloto | ⬜ | 13/11 | [D] Q40–Q43 precisam de resposta para medir conclusão. |
| Ensaiar reversão e restauração antes da abertura | ⬜ | 13/11 | [C] Backup é requisito; [D] ferramentas só podem ser fixadas após ambiente definido. |

## 6. Plataforma

| Item | Situação | Data | Obs. |
|---|---|---|---|
| Provedor de identidade e consulta de elegibilidade | ⛔ | 13/11 | [D] Sem fornecedor/contrato técnico; desbloqueia com F0.2 e Q01–Q10. |
| Sessões, revogação e permissões administrativas | ⬜ | 13/11 | [H] Implementar/testar após definição de integração e perfis administrativos. |
| Homologação, domínio, HTTPS e publicação | ⬜ | 13/11 | [D] Q39–Q42 definem destino; não há deploy existente. |
| Segredos e isolamento dos jogos | ⬜ | 13/11 | [H] Definir privilégios mínimos; nenhum jogo deve receber a sessão principal do portal. |
| Backup completo, integridade e restauração | ⬜ | 13/11 | [C] Obrigatório antes de alterações no sistema/servidor; [D] rotina operacional ainda não existe. |
| Monitoramento, alertas e incidentes | ⬜ | 13/11 | [D] Definir métricas, limites e canal operacional em Q38/Q40/Q42. |
| Capacidade, banda e controle de custos | ⬜ | 13/11 | [D] Sem títulos, concorrência ou medições; não estimar capacidade sem teste. |
| Agendamentos | ⬜ | 13/11 | [D] Necessidade depende de sincronização e eventuais temporadas; não há tarefas existentes. |
| Proteção de dados e retenção | ⬜ | 13/11 | [D] Q30–Q34 definem tratamento e públicos; validar com setor competente. |

## 7. Documentação e repositório

| Item | Situação | Data | Obs. |
|---|---|---|---|
| Contexto e alternativas acessíveis | 🟡 | 13/11 | [F] Conteúdo preparado em [visão](visao-projeto.md); [D] decisões e homologação pendentes. |
| Referências visuais e ativos oficiais | ⬜ | 13/11 | [F] Prints só na conversa; [D] falta destino acessível e aprovação de uso. |
| Arquitetura, requisitos e aceite aprovados | ⬜ | 13/11 | [D] Ainda não existem decisões técnicas executáveis. |
| Convenções e comandos reproduzíveis | ⬜ | 13/11 | [F] Apenas documentação; [D] definir quando houver implementação. |
| Continuidade do andamento no mesmo commit | 🟡 | 13/11 | [F] Procedimento documentado em [manutenção](como-manter-andamento.md); [D] sem mecanismo automatizado de conferência. |
| Visibilidade e regras de contribuição | ⬜ | 13/11 | [F] Repositório público, branch `Principal` sem proteção indicada pela API em 13/11; [D] confirmar política em Q44–Q45. Nenhuma configuração foi alterada. |
| Situação de checkouts e servidores | ⬜ | 13/11 | [D] Não inspecionados; leitura remota não comprova `git status` de colaboradores. |

## 8. Como atualizar

Siga [como-manter-andamento.md](como-manter-andamento.md). Atualizar tabelas, totais, próxima fase, evidências e “Onde parou” no mesmo commit que alterar um estado [C: instrução do solicitante]. Não atribuir tarefas a pessoas; “Quem pode responder” identifica fonte da informação. Manter respostas e pendências resolvidas com data.

## 9. Perguntas em aberto

[D] “Pendente” significa que nenhuma resposta foi confirmada. As fontes abaixo são setores capazes de informar, não responsáveis por execução. Q01–Q15 e Q39–Q43 são prioritárias para fechar a fase 0 [H]. Respostas existentes são mantidas; novas respostas devem indicar fonte, data e evidência pública sanitizada. Não colar contratos confidenciais ou segredos.

| Pergunta | Quem pode responder | Resposta | Data |
|---|---|---|---|
| Q01. Qual sistema/fornecedor mantém o login e o cadastro dos clientes? O site institucional usa a mesma identidade do Minha Flix? | TI FLIX e fornecedor do Minha Flix | [C: solicitante, 16/11] A conta do Flix Games é a mesma do App Flix / portal do assinante: login por CPF do titular ou CNPJ + senha do portal (tela mostrada em 13/11). [D] Falta o nome técnico do sistema que valida o login e confirmar se o site institucional usa a mesma base. [H] Senha inicial igual ao CPF/CNPJ é fraca: o Games não deve pedir nem guardar essa senha. | 16/11 |
| Q02. Há SSO OpenID Connect/SAML, API oficial ou possibilidade de passagem segura por código de uso único? | Fornecedor e TI FLIX | [C: solicitante, 16/11] Sim: o responsável pelo sistema do App Flix vai disponibilizar uma API de integração. [D] Protocolo (OAuth/OIDC, código de uso único etc.), documentação e prazo ainda não recebidos. [H] Preferir que o App/portal autentique e entregue ao Games um código de uso único e curto, trocado servidor a servidor. | 16/11 |
| Q03. Há documentação, ambiente de homologação e possibilidade de alterar o botão/fluxo do app e do site? | Fornecedor, TI e gestão do site/app | [C: solicitante, 16/11] O App Flix já tem o botão Games; no site Flix Fibra será adicionada uma opção Games na área indicada pelo solicitante (print). [D] Documentação e ambiente de homologação da API pendentes. | 16/11 |
| Q04. Qual identificador estável vincula pessoa, cliente e contrato? Como tratar vários contratos e troca de titular? | Fornecedor e operação FLIX | [C: solicitante, 16/11] Existe um código único por cliente, vindo do cadastro do sistema; contratos não entram no vínculo. [D] Confirmar o nome do campo e o que acontece na troca de titular. | 16/11 |
| Q05. Quais planos e estados de contrato dão direito ao Games? Suspensão/inadimplência bloqueiam o benefício? | Diretoria/comercial FLIX | [C: solicitante, 16/11] Todos os clientes com acesso ao App Flix terão acesso ao Games. [D] Confirmar se cliente suspenso/inadimplente perde acesso ao App (e portanto ao Games). | 16/11 |
| Q06. Há webhook de cancelamento/suspensão ou será necessário consultar status? Com quais limites e atrasos? | Fornecedor | [C: solicitante, 16/11] Haverá API ligada ao CRM, responsável por informar a elegibilidade. [D] Webhook ou consulta periódica, limites e atrasos ainda não definidos. | 16/11 |
| Q07. Em quanto tempo a perda de elegibilidade deve encerrar acesso? Há tolerância e tratamento de partida em curso? | Diretoria/operação FLIX | [C: solicitante, 16/11] Bloquear em até cerca de 1 hora após a perda de elegibilidade. [H] Revalidar elegibilidade no servidor pelo menos a cada hora; partida em curso pode terminar, mas sem gravar ranking após o bloqueio. | 16/11 |
| Q08. O que fazer quando o sistema de clientes estiver fora do ar: negar, aguardar ou permitir acesso recentemente validado por prazo limitado? | Diretoria, operação e TI FLIX | [C: solicitante, 16/11] Se o sistema de clientes cair, manter as sessões já abertas; ao voltar, revalidar quem mudou de situação nesse intervalo. [H] Novos logins dependem do sistema de identidade e ficam indisponíveis durante a queda. | 16/11 |
| Q09. Qual duração de sessão, quantidade de aparelhos/sessões e comportamento de logout/revogação são desejados? | Produto/segurança FLIX e fornecedor | [C: solicitante, 16/11] Sessão sem prazo de término no aparelho; sair desconecta só aquele aparelho; um aparelho tem uma pessoa conectada por vez; a mesma conta pode estar em vários aparelhos. [H] Sessão longa exige: token renovável revogável no servidor, revalidação de elegibilidade (Q07) e opção de encerrar todas as sessões pelo atendimento. | 16/11 |
| Q10. Se não houver SSO, o fornecedor permite verificar vínculo por código enviado ao contato cadastrado? Como recuperar acesso? | Fornecedor e atendimento FLIX | [C: solicitante, 16/11] Não haverá verificação alternativa; será usado o login existente do App Flix. Recuperação de acesso segue o 'Esqueci minha senha' do portal. | 16/11 |
| Q11. Quais títulos entram na primeira versão? São individuais, multiplayer, navegador, externos ou streaming? | Solicitante e produto FLIX | [C: solicitante, 16/11] Lista em análise. Direção: jogos leves, de navegador, para jogar sozinho e com ranking, que rodem em qualquer celular; exemplos citados: estilo DOOM e estilo Flappy Bird. Sem multiplayer na primeira versão (Q28). [C: solicitante, 16/11] Atualização: o catálogo começa com 15 jogos (G01–G15, ver prompt dos minigames) e a meta futura é 20. Doom-like com menos violência: outro inimigo e outro tipo de projétil no lugar da arma de fogo. | 16/11 |
| Q12. Qual a origem de cada jogo e quem confirma direito de distribuição/incorporação, inclusive imagens e sons? | Produto, fornecedor dos jogos e jurídico FLIX | [C: solicitante, 16/11] Solicitante considerou respondida pela Q11. [H] Ainda falta conferir a licença de cada jogo: o motor do DOOM é GPL, mas os dados do jogo original são comerciais (usar Freedoom ou similar livre); 'Flappy Bird' é nome/arte de terceiros, então fazer jogo próprio com mecânica parecida e outro nome. Registrar licença e origem de imagens e sons por título. [C: solicitante, 16/11] Atualização: trechos pontuais de código dos jogos de referência podem ser usados, sem copiar grande parte ou toda a obra; registrar origem e licença no `ASSETS.md`. [H] Trechos de repositórios GPL, CC BY-SA ou sem licença seguem como risco a avaliar pelo jurídico. | 16/11 |
| Q13. Quais dispositivos/navegadores suportar: celular, computador, TV, controle? O app abrirá WebView ou navegador externo? | Produto FLIX e fornecedor do app | [C: solicitante, 16/11] Android, iPhone, computador e tablet. Controle aceito em alguns jogos. [D] Confirmar se o App abre em WebView ou navegador externo. | 16/11 |
| Q14. Qual limite de tamanho/carregamento e qual aparelho mínimo serão usados no aceite? | Produto e TI FLIX | [C: solicitante, 16/11] Precisa rodar bem em celulares simples; carregamento máximo de 5 minutos. [H] 5 min é o limite aceito; meta técnica sugerida bem menor (ex.: menos de 10 s em 4G para abrir o portal). [D] Definir aparelho mínimo de teste. | 16/11 |
| Q15. Cada jogo permite iniciar/finalizar partida, recuperar progresso e validar resultado? Há API/SDK ou código-fonte? | Fornecedor dos jogos e equipe técnica | [C: solicitante, 16/11] Alguns jogos terão ranking (ex.: estilo Flappy Bird registra quantos obstáculos passou); nem todos usarão ranking. [D] Por título: como validar a pontuação (ver Q29). | 16/11 |
| Q16. Qual identidade visual, navegação, acessibilidade, áudio e comportamento de erro devem ser aprovados para o portal? | Produto e marketing FLIX | [C: solicitante, 16/11] Visual de console (referência PS5) com cores Flix e padrão do Flix Pulse; protótipo navegável em `prototipo/` (início, ranking, perfil, escolha de até 2 perfis, tema claro/escuro, celular primeiro). [D] Aprovação final, acessibilidade e mensagens de erro pendentes. | 16/11 |
| Q17. O catálogo será visível a visitantes? Como explicar o benefício a quem ainda não é cliente? | Comercial e produto FLIX | [C: solicitante, 16/11] Aparecerá como no print enviado pelo solicitante (quarto print). [D] Confirmar se visitante não cliente vê o catálogo antes do login. | 16/11 |
| Q18. O ranking será por jogo, modo, temporada ou geral? Haverá ranking regional opcional? | Produto FLIX | [C: solicitante, 16/11] Um ranking separado e permanente para cada jogo; classificação por perfil (cada cliente tem um perfil). Sem ranking regional por ora. | 16/11 |
| Q19. Qual cálculo de pontuação, desempate, limite de tentativas e período de fechamento? | Produto e fornecedor de cada jogo | [C: solicitante, 16/11] Em geral maior pontuação; a regra depende de cada jogo. [D] Desempate e limite de tentativas por jogo. | 16/11 |
| Q20. Haverá XP/conquistas? Como separar participação de habilidade e evitar somar pontuações incompatíveis? | Produto FLIX | [C: solicitante, 16/11] Terá conquistas; detalhes e evolução do perfil serão definidos no desenvolvimento. | 16/11 |
| Q21. Haverá temporadas/desafios? Qual calendário, fuso e regra de histórico após fechamento? | Produto e marketing FLIX | [C: solicitante, 16/11] Não por enquanto; avaliar mais à frente. | 16/11 |
| Q22. Haverá prêmio? Quais regras, público, revisão e validação antes de anunciar vencedores? | Diretoria, marketing e jurídico FLIX | [C: solicitante, 16/11] Prêmios não definidos; solicitante não sabe se é interessante. Fora da primeira versão. [H] Prêmio exige regulamento e revisão jurídica antes. | 16/11 |
| Q23. Quantos jogadores por contrato? Titular pode gerenciar perfis familiares e limites de sessão? | Produto e diretoria FLIX | [C: solicitante, 16/11] Até 2 perfis por conta, escolhidos na tela "Quem vai jogar?". Cada perfil tem apelido, avatar, ranking, progresso, favoritos e conquistas próprios; aparelhos conectados são da conta. Substitui o registro anterior de um perfil por conta. [D] Proteção por PIN entre perfis, quem pode excluir perfil e se os dois perfis podem aparecer no mesmo ranking ainda não definidos. [C: solicitante, 16/11] Reconfirmado: conta Flix com perfis ligados ao cliente; não haverá ranking por apelido anônimo. | 16/11 |
| Q24. Quais dados públicos de perfil: apelido, avatar, região? Pode ocultar perfil/posição? | Produto e privacidade FLIX | [C: solicitante, 16/11] Públicos: apelido, avatar e posição no ranking. O cliente poderá ocultar o perfil/posição. | 16/11 |
| Q25. Como moderar apelidos/imagens e tratar denúncias/recursos? | Atendimento e produto FLIX | [C: solicitante, 16/11] Haverá verificação de conteúdo inapropriado e botão de denúncia; a equipe FLIX analisa. [D] Prazo de análise e recurso. | 16/11 |
| Q26. Favoritos e continuar jogando entram na primeira versão? Por jogo, haverá salvamento e sincronização? | Produto FLIX e fornecedor dos jogos | [C: solicitante, 16/11] Sim: favoritos e progresso salvo para continuar depois, ligado à conta e sincronizado entre aparelhos. [D] Confirmar por jogo se o salvamento é viável. | 16/11 |
| Q27. Amigos, presença, duelos, salas e chat são necessários no lançamento ou ficam fora? | Produto FLIX | [C: solicitante, 16/11] Fora da primeira versão (amigos, presença, duelos, salas e chat). | 16/11 |
| Q28. Quais jogos precisam de multiplayer ao vivo, reconexão, matchmaking e regras executadas no servidor? | Produto e fornecedor dos jogos | [C: solicitante, 16/11] Nenhum jogo da primeira versão terá disputa ao vivo. | 16/11 |
| Q29. Qual nível de prevenção de fraude e revisão de resultados é necessário? Como tratar falha, reenvio e partida offline? | Produto, segurança e fornecedores dos jogos | [C: solicitante, 16/11] Não será tratado agora. [H] Risco: sem validação, ranking pode ser fraudado pelo navegador; ao menos limitar pontuação plausível e permitir revisão/remoção pela equipe. | 16/11 |
| Q30. Crianças poderão jogar? Quais faixas etárias, controles familiares e restrições por título? | Diretoria, produto e jurídico FLIX | [C: solicitante, 16/11] Sem jogos infantis. [C: solicitante, 16/11] Reconfirmado: público mantido como está. | 16/11 |
| Q31. Quais dados mínimos serão tratados e por quanto tempo? Como atender exclusão/exportação e preservar integridade de rankings? | Privacidade/jurídico FLIX | [C: solicitante, 16/11] Guardar perfil, progresso, partidas e histórico de ranking enquanto o cliente estiver ativo. Exclusão segue a Q33. [D] Exportação de dados (LGPD) ainda não definida. | 16/11 |
| Q32. Que dados sairão para fornecedores e quais rastreadores/analytics serão permitidos? | TI, privacidade e fornecedores | [D] Pendente; sem resposta em 16/11. [H] Padrão proposto: nenhum dado enviado a terceiros e nenhum analytics/rastreador de terceiros na primeira versão. | 16/11 |
| Q33. O que acontece com perfil, progresso e ranking após cancelamento, retorno ou troca de titular? | Produto, operação e privacidade FLIX | [C: solicitante, 16/11] O perfil é excluído (após cancelamento). [H] Remover também do ranking; retorno de cliente começa perfil novo. [D] Confirmar prazo até a exclusão. | 16/11 |
| Q34. Jogos terão anúncios, compras ou links externos? Isso é compatível com o benefício e o público pretendido? | Diretoria, comercial e jurídico FLIX | [C: solicitante, 16/11] Sem anúncios, compras ou links externos. [C: solicitante, 16/11] Reconfirmado: sem anúncios por enquanto, inclusive na tela de game over; o prompt dos minigames foi ajustado. | 16/11 |
| Q35. Quais ações precisam existir no painel administrativo na primeira versão? | Produto e operação FLIX | [C: solicitante, 16/11] Painel: adicionar jogos, organizar destaques e analisar pontuações. | 16/11 |
| Q36. Quais perfis administrativos, exigências de autenticação e ações auditadas? | Operação e segurança FLIX | [C: solicitante, 16/11] Apenas a equipe de TI acessa o painel. [H] Login individual (sem conta compartilhada), segundo fator e registro de auditoria das ações. | 16/11 |
| Q37. Como atendimento identifica falhas, trata bloqueios e recebe recurso de ranking sem acessar senhas? | Atendimento e TI FLIX | [C: solicitante, 16/11] Pelo atendimento atual: WhatsApp e área de FAQ. Atendimento não acessa senhas. | 16/11 |
| Q38. Como retirar um jogo problemático, responder a incidentes e comunicar indisponibilidade? | Operação, atendimento e produto FLIX | [C: solicitante, 16/11] A equipe desativa o jogo, corrige e depois reativa. [H] Painel precisa de botão de desativar jogo com mensagem ao cliente. | 16/11 |
| Q39. Onde hospedar, qual domínio e como separar homologação/produção? Há restrições de rede ou fornecedores? | TI e diretoria FLIX | [C: solicitante, 16/11] Hospedagem no servidor próprio já usado pela equipe (detalhes de infraestrutura fora deste repositório). [D] Domínio e separação homologação/produção pendentes. | 16/11 |
| Q40. Quantos clientes elegíveis e jogadores simultâneos são esperados, em qual data de referência? Qual meta de disponibilidade/latência? | Operação, produto e TI FLIX | [C: solicitante, 16/11] Início com no máximo cerca de 50 clientes jogando, não ao mesmo tempo (estimativa de 16/11). | 16/11 |
| Q41. Qual orçamento inicial/mensal e quais custos de jogos/licenças, tráfego e infraestrutura cabem nele? | Diretoria e financeiro FLIX | [C: solicitante, 16/11] Sem orçamento previsto: usar recursos e jogos gratuitos/livres. [H] 'Gratuito' ainda exige conferir licença (Q12). | 16/11 |
| Q42. Quais prazos aceitáveis de recuperação/perda de dados, retenção de backup e limites de alerta/custo? | Diretoria, operação e TI FLIX | [C: solicitante, 16/11] Backup antes de alterações é obrigatório; o restante foi delegado. [H] Proposta: backup diário do banco + backup antes de cada deploy; guardar 7 diários e 4 semanais; perda máxima aceitável de 24 h de progresso; volta ao ar em até 4 h. Ajustar se houver objeção. | 16/11 |
| Q43. Qual escopo, prazo, grupo piloto, roteiro e evidências autorizam considerar a primeira versão concluída? | Solicitante, produto e diretoria FLIX | [C: solicitante, 16/11] Escopo: os jogos e a plataforma com visual estilo PS5 funcionando. Sem data desejada. [D] Grupo piloto e roteiro de aceite pendentes. | 16/11 |
| Q44. O repositório deve permanecer público? Qual política de licença, materiais e contribuição? | Diretoria e gestão do GitHub FLIX | [C: solicitante, 16/11] O repositório deve ser privado. [F] Estava público em 16/11; mudança de visibilidade pendente. | 16/11 |
| Q45. Quais revisões e verificações serão obrigatórias na branch Principal, sem donos fixos por área? | Equipe e gestão do GitHub FLIX | [C: solicitante, 16/11] Seguir o padrão de revisão e deploy já usado pela equipe FLIX. | 16/11 |
| Q46. Qual arquitetura e stack serão adotadas e com quais critérios para revisar a escolha? | Equipe técnica e produto FLIX | [C: solicitante, 16/11] Stack escolhida: interface React + TypeScript + Vite; backend Python + FastAPI + Uvicorn; PostgreSQL; nginx + HTTPS na entrada; Docker Compose na implantação; processo Python separado para revalidar clientes no CRM e reconciliar acessos após indisponibilidade. [H] Cuidados no servidor: Docker publica portas por fora do ufw, então Postgres sem porta publicada e API só em 127.0.0.1; HTTPS no nginx já existente do servidor (vhost novo), não um segundo nginx disputando 80/443; limites de CPU/memória por serviço; backup por pg_dump. [D] Docker ainda não confirmado no servidor. | 16/11 |
| Q47. O Tetris-like (G10) pode ser desenvolvido antes do parecer do jurídico? | Solicitante, jurídico FLIX | [C: solicitante, 16/11] Sim: será feito, apresentado pronto e depois avaliado pelo jurídico. [H] Não publicar sem o parecer. [D] Data e responsável do parecer. | 16/11 |
| Q48. Como o time deve usar o código dos jogos de referência e identificar os assets para trocar pela identidade Flix? | Solicitante e equipe técnica | [C: solicitante, 16/11] Pode usar e colar trechos pontuais de código das referências, sem copiar grande parte ou toda a obra. A IA deve explicar onde ficam os assets de cada jogo para o time trocá-los. Ver decisões no início do prompt dos minigames. | 16/11 |
| Q49. Quem cuida de cada área, em especial do hub? | Solicitante | [C: solicitante, 16/11] Não há donos fixos por área; o Rafael foi originalmente encarregado do hub, mas qualquer pessoa pode atuar em qualquer área. | 16/11 |
