# FLIX Games — andamento

Situação inicial: 13/11/2026. Última conferência: 13/11/2026.

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

**13/11/2026 — [F]** Inspeção da branch `Principal` no commit `fe898e5776c745871e71a131f99bf7f0beedfad2`: apenas `README.md`; sem código, testes, scripts, migrações, deploy, `CLAUDE.md` ou `AGENTS.md`. [C] A direção de produto e a solicitação de documentação vieram do solicitante; [H] opções técnicas foram registradas sem escolher uma. Quem continuar deve executar os comandos da próxima fase, confirmar que o repositório não recebeu implementação posterior, priorizar Q01–Q15 e Q39–Q43 e preencher respostas com fonte/data. Não há serviço para reiniciar, migração para aplicar ou carga para executar [F].

## 5. Fases e partes

### Fase 0 — descoberta e escopo

| Parte | Funciona | Validado | Testado | Entregável | Data | Obs. |
|---|---|---|---|---|---|---|
| F0.1 Contexto, escopo e aceite | 🟡 | ⬜ | ⬜ | ⬜ | 13/11 | [C] Direção registrada em [visão](visao-projeto.md); [D] primeira versão e aceite não aprovados. Confirmar Q11–Q15 e Q43. |
| F0.2 Identidade e elegibilidade especificadas | ⬜ | ⬜ | ⬜ | ⬜ | 13/11 | [D] Fornecedor e contrato de integração ausentes; obter Q01–Q10. |
| F0.3 Arquitetura e plano de validação escolhidos | 🟡 | ⬜ | ⬜ | ⬜ | 13/11 | [H] A/B comparadas na visão; [D] sem decisão, capacidade ou custo estimado com evidência. |

| Item | Situação | Data | Obs. |
|---|---|---|---|
| Obter documentação e homologação do fornecedor | ⛔ | 13/11 | [D] Fornecedor não identificado; desbloqueia com Q01–Q03 e acesso autorizado a ambiente de teste. |
| Receber lista inicial de jogos | ⛔ | 13/11 | [C] Solicitante informou que enviará; [D] lista ausente. Desbloqueia com títulos e origem em Q11–Q12. |
| Aprovar escopo e arquitetura | ⬜ | 13/11 | [H] Usar respostas prioritárias para registrar decisão; não transformar hipótese em requisito. |

### Fase 1 — base técnica reproduzível

| Parte | Funciona | Validado | Testado | Entregável | Data | Obs. |
|---|---|---|---|---|---|---|
| F1.1 Projeto local e comandos documentados | ⬜ | ⬜ | ⬜ | ⬜ | 13/11 | [F] Sem manifests/lockfiles; [D] stack aguarda F0.3. |
| F1.2 Persistência e evolução de dados | ⬜ | ⬜ | ⬜ | ⬜ | 13/11 | [D] Modelo, banco e migrações não definidos. |
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
| F3.1 Catálogo aprovado e jogo integrado | ⬜ | ⬜ | ⬜ | ⬜ | 13/11 | [D] Sem títulos; quantidade de jogos só será fixada na fase 0. |
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
| Q01. Qual sistema/fornecedor mantém o login e o cadastro dos clientes? O site institucional usa a mesma identidade do Minha Flix? | TI FLIX e fornecedor do Minha Flix | [D] Pendente | 13/11 |
| Q02. Há SSO OpenID Connect/SAML, API oficial ou possibilidade de passagem segura por código de uso único? | Fornecedor e TI FLIX | [D] Pendente; nenhuma alternativa testada | 13/11 |
| Q03. Há documentação, ambiente de homologação e possibilidade de alterar o botão/fluxo do app e do site? | Fornecedor, TI e gestão do site/app | [D] Pendente | 13/11 |
| Q04. Qual identificador estável vincula pessoa, cliente e contrato? Como tratar vários contratos e troca de titular? | Fornecedor e operação FLIX | [D] Pendente | 13/11 |
| Q05. Quais planos e estados de contrato dão direito ao Games? Suspensão/inadimplência bloqueiam o benefício? | Diretoria/comercial FLIX | [D] Pendente; ser cliente é a intenção, não uma regra técnica completa | 13/11 |
| Q06. Há webhook de cancelamento/suspensão ou será necessário consultar status? Com quais limites e atrasos? | Fornecedor | [D] Pendente | 13/11 |
| Q07. Em quanto tempo a perda de elegibilidade deve encerrar acesso? Há tolerância e tratamento de partida em curso? | Diretoria/operação FLIX | [D] Pendente | 13/11 |
| Q08. O que fazer quando o sistema de clientes estiver fora do ar: negar, aguardar ou permitir acesso recentemente validado por prazo limitado? | Diretoria, operação e TI FLIX | [D] Pendente | 13/11 |
| Q09. Qual duração de sessão, quantidade de aparelhos/sessões e comportamento de logout/revogação são desejados? | Produto/segurança FLIX e fornecedor | [D] Pendente | 13/11 |
| Q10. Se não houver SSO, o fornecedor permite verificar vínculo por código enviado ao contato cadastrado? Como recuperar acesso? | Fornecedor e atendimento FLIX | [D] Pendente; CPF sozinho não comprova vínculo | 13/11 |
| Q11. Quais títulos entram na primeira versão? São individuais, multiplayer, navegador, externos ou streaming? | Solicitante e produto FLIX | [D] Lista ainda não recebida | 13/11 |
| Q12. Qual a origem de cada jogo e quem confirma direito de distribuição/incorporação, inclusive imagens e sons? | Produto, fornecedor dos jogos e jurídico FLIX | [D] Pendente por título | 13/11 |
| Q13. Quais dispositivos/navegadores suportar: celular, computador, TV, controle? O app abrirá WebView ou navegador externo? | Produto FLIX e fornecedor do app | [D] Pendente | 13/11 |
| Q14. Qual limite de tamanho/carregamento e qual aparelho mínimo serão usados no aceite? | Produto e TI FLIX | [D] Pendente | 13/11 |
| Q15. Cada jogo permite iniciar/finalizar partida, recuperar progresso e validar resultado? Há API/SDK ou código-fonte? | Fornecedor dos jogos e equipe técnica | [D] Pendente por título | 13/11 |
| Q16. Qual identidade visual, navegação, acessibilidade, áudio e comportamento de erro devem ser aprovados para o portal? | Produto e marketing FLIX | [C] Referência de navegação PS5; [D] composição final e critérios pendentes | 13/11 |
| Q17. O catálogo será visível a visitantes? Como explicar o benefício a quem ainda não é cliente? | Comercial e produto FLIX | [D] Pendente | 13/11 |
| Q18. O ranking será por jogo, modo, temporada ou geral? Haverá ranking regional opcional? | Produto FLIX | [C] Ranking entre clientes solicitado; [D] modalidades pendentes | 13/11 |
| Q19. Qual cálculo de pontuação, desempate, limite de tentativas e período de fechamento? | Produto e fornecedor de cada jogo | [D] Pendente por jogo | 13/11 |
| Q20. Haverá XP/conquistas? Como separar participação de habilidade e evitar somar pontuações incompatíveis? | Produto FLIX | [H] Ideia, sem aprovação | 13/11 |
| Q21. Haverá temporadas/desafios? Qual calendário, fuso e regra de histórico após fechamento? | Produto e marketing FLIX | [H] Ideia, sem aprovação | 13/11 |
| Q22. Haverá prêmio? Quais regras, público, revisão e validação antes de anunciar vencedores? | Diretoria, marketing e jurídico FLIX | [H] Ideia, sem aprovação | 13/11 |
| Q23. Quantos jogadores por contrato? Titular pode gerenciar perfis familiares e limites de sessão? | Produto e diretoria FLIX | [D] Pendente | 13/11 |
| Q24. Quais dados públicos de perfil: apelido, avatar, região? Pode ocultar perfil/posição? | Produto e privacidade FLIX | [D] Pendente | 13/11 |
| Q25. Como moderar apelidos/imagens e tratar denúncias/recursos? | Atendimento e produto FLIX | [D] Pendente | 13/11 |
| Q26. Favoritos e continuar jogando entram na primeira versão? Por jogo, haverá salvamento e sincronização? | Produto FLIX e fornecedor dos jogos | [H] Ideia, sem aprovação | 13/11 |
| Q27. Amigos, presença, duelos, salas e chat são necessários no lançamento ou ficam fora? | Produto FLIX | [H] Ideias; nenhuma aprovada | 13/11 |
| Q28. Quais jogos precisam de multiplayer ao vivo, reconexão, matchmaking e regras executadas no servidor? | Produto e fornecedor dos jogos | [D] Pendente; influencia arquitetura A/B | 13/11 |
| Q29. Qual nível de prevenção de fraude e revisão de resultados é necessário? Como tratar falha, reenvio e partida offline? | Produto, segurança e fornecedores dos jogos | [D] Pendente | 13/11 |
| Q30. Crianças poderão jogar? Quais faixas etárias, controles familiares e restrições por título? | Diretoria, produto e jurídico FLIX | [D] Pendente | 13/11 |
| Q31. Quais dados mínimos serão tratados e por quanto tempo? Como atender exclusão/exportação e preservar integridade de rankings? | Privacidade/jurídico FLIX | [D] Pendente | 13/11 |
| Q32. Que dados sairão para fornecedores e quais rastreadores/analytics serão permitidos? | TI, privacidade e fornecedores | [D] Pendente | 13/11 |
| Q33. O que acontece com perfil, progresso e ranking após cancelamento, retorno ou troca de titular? | Produto, operação e privacidade FLIX | [D] Pendente | 13/11 |
| Q34. Jogos terão anúncios, compras ou links externos? Isso é compatível com o benefício e o público pretendido? | Diretoria, comercial e jurídico FLIX | [D] Pendente; não aprovado | 13/11 |
| Q35. Quais ações precisam existir no painel administrativo na primeira versão? | Produto e operação FLIX | [H] Publicação/retirada de jogos e revisão de resultados propostas | 13/11 |
| Q36. Quais perfis administrativos, exigências de autenticação e ações auditadas? | Operação e segurança FLIX | [D] Pendente | 13/11 |
| Q37. Como atendimento identifica falhas, trata bloqueios e recebe recurso de ranking sem acessar senhas? | Atendimento e TI FLIX | [D] Pendente | 13/11 |
| Q38. Como retirar um jogo problemático, responder a incidentes e comunicar indisponibilidade? | Operação, atendimento e produto FLIX | [D] Pendente | 13/11 |
| Q39. Onde hospedar, qual domínio e como separar homologação/produção? Há restrições de rede ou fornecedores? | TI e diretoria FLIX | [D] Pendente; não usar o ambiente de viabilidade por suposição | 13/11 |
| Q40. Quantos clientes elegíveis e jogadores simultâneos são esperados, em qual data de referência? Qual meta de disponibilidade/latência? | Operação, produto e TI FLIX | [D] Pendente; registrar unidades e data ao responder | 13/11 |
| Q41. Qual orçamento inicial/mensal e quais custos de jogos/licenças, tráfego e infraestrutura cabem nele? | Diretoria e financeiro FLIX | [D] Pendente | 13/11 |
| Q42. Quais prazos aceitáveis de recuperação/perda de dados, retenção de backup e limites de alerta/custo? | Diretoria, operação e TI FLIX | [C] Backup antes de alterações é obrigatório; [D] metas e rotina pendentes | 13/11 |
| Q43. Qual escopo, prazo, grupo piloto, roteiro e evidências autorizam considerar a primeira versão concluída? | Solicitante, produto e diretoria FLIX | [D] Pendente; não há aceite de produção definido | 13/11 |
| Q44. O repositório deve permanecer público? Qual política de licença, materiais e contribuição? | Diretoria e gestão do GitHub FLIX | [F] Público na inspeção; [D] política desejada não confirmada | 13/11 |
| Q45. Quais revisões e verificações serão obrigatórias na branch Principal, sem donos fixos por área? | Equipe e gestão do GitHub FLIX | [C] Qualquer pessoa/IA pode continuar; [D] regras de merge pendentes | 13/11 |
| Q46. Qual arquitetura e stack serão adotadas e com quais critérios para revisar a escolha? | Equipe técnica e produto FLIX | [H] A: modular própria; B: servidor de games; nenhuma escolhida | 13/11 |
