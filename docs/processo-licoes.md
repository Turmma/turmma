# Lições do processo

> **Gênero:** referência viva · **Quem altera:** o Arquiteto, na retrospectiva (`retro`) e na revisão do processo (X7).
> **Para que serve:** os procedimentos (`.claude/skills/`) dizem o que fazer; este arquivo guarda **por que**, com o
> caso que ensinou. Quem implementa não precisa lê-lo para trabalhar: precisa dele quem vai mudar uma regra do
> procedimento e quer saber o que ela evita. Nada sai de um procedimento sem destino: o caso migra para cá, com data
> e origem, e a regra fica no procedimento.

A data é a do último commit do `N_task.md` citado, ou, quando o caso é da spec inteira, a da validação (`até`). A
origem é a spec (pasta `tasks/prd-<nome>/`) e a tarefa.

## 1. O que saiu do `executar-task` (X7, 18.0, 24/10/2026)

| Data | Origem | O que aconteceu | Onde a regra ficou |
|---|---|---|---|
| 2026-10-05 | F3 (`lgpd-e-titular`), Tech Spec | A Tech Spec passava de cem mil caracteres; lê-la toda é começar com a janela cheia | `executar-task`, passo 1: a Tech Spec inteira só quando o documento não aponta seção |
| até 2026-09-21 | F1 (`identidade-e-tenancy`) | Seis reprovações foram implementação que se afastou da spec ou da subtarefa sem dizer. Em duas, a saída foi editar o documento para acomodar o resultado: a linha do cenário de carga reescrita depois da medição, e o limite de dois grupos do k6 desligado | `executar-task`, passo 2, `<critical>`: divergência se registra, critério de aceite não se baixa |
| 2026-09-25 | A0b (`apresentacao-painel`), validação | O maior achado da validação foi seis decisões de tarefa que só estavam no `N_task.md`, e não na `techspec.md` nem no `cenarios.md` | `executar-task`, passo 2, `<critical>`: o que diverge entra nos três documentos antes dos revisores |
| até 2026-09-21 | F0 e começo do F1 | O `test-engineer` foi quem mais reprovou: 38% das rodadas | `task-template.md`, "Autoconferência" |
| 2026-10-11 | F3 (`lgpd-e-titular`) | 17 reprovações foram cláusula sem teste que falhe sem ela; em cinco, a seção "Mutações" afirmava um vermelho que não acontecia | `task-template.md`, "Autoconferência", 1; o portão aplica cada bloco (`tools/processo/mutacoes.ts`) |
| 2026-10-19 | X3 (`telas-do-professor`) | Oito reprovações do mesmo tipo, todas em cláusula de tela: o JSX que mostra ou esconde um pedaço, o efeito (foco devolvido, medida gravada com `style.setProperty`), o id dentro de uma `queryKey` | `task-template.md`, "Autoconferência", 1 |
| 2026-10-18 e 2026-10-19 | X3 (`telas-do-professor`), 1.0 e 6.0 | O sino em `main` (1.0) e o rótulo "Gabarito" do interruptor (6.0) quebraram e2e que contavam o texto na página inteira, fora do diff; a esteira ficou vermelha em seis execuções, porque o portão só puxa os specs que citam texto removido | `task-template.md`, "Autoconferência", 2 |
| até 2026-09-21 | F1 (`identidade-e-tenancy`) | Maior causa técnica de reprovação, catorze vezes: a regra estava no código, mas o teste tinha uma turma só, uma escola só, um estado só ou o valor padrão só, e apagar a cláusula não deixava nada vermelho | `task-template.md`, "Autoconferência", 3 e 11 (o teste de isolamento) |
| até 2026-09-21 | F1 (`identidade-e-tenancy`) | Cinco reprovações foram teste verde pelo motivo errado: a rota caía em `requireAnoEmCurso()`, ou o e-mail não achava ninguém, e a cláusula que o teste dizia provar nunca era alcançada | `task-template.md`, "Autoconferência", 4 |
| 2026-10-22 | X5 (`reengenharia`), 9.0 | A tarefa levou cinco reprovações, uma forma de escape por rodada (reexportação, `import *`, `import()`, caminho como texto, alias) | `task-template.md`, "Autoconferência", 6 |
| 2026-10-23 | X5 (`reengenharia`), 12.0 | Três reprovações: cercas que paravam de vigiar sem que nenhum teste falhasse (arquivo que mudou de lugar, `ignore` que escondia o real) | `task-template.md`, "Autoconferência", 6 |
| até 2026-09-21 | F1 (`identidade-e-tenancy`) | Quatro reprovações por comentário, docblock ou nota que afirmava o que o código não fazia, três delas no mesmo docblock em rodadas seguidas. Neste repositório a regra do módulo mora no comentário: quem lê "e só elas" conclui que o caso está barrado | `task-template.md`, "Autoconferência", 7 |
| 2026-09-24 | A0 (`apresentacao-operacao`), 3.0, 5.0 e 6.0 | Três reprovações por divergência registrada sem o cenário que a prova; numa delas, sem a pergunta de carga: a tentativa segurada passou a gravar no banco a cada requisição anônima | `task-template.md`, "Autoconferência", 8 |
| 2026-10-13 | X1 (`pele-e-casca`), 1.0 | Sete reprovações do `revisor-geral` foram decisão que só estava no `N_task.md`, ou a coluna "Onde está na spec" citando seção que não a dizia; na 1.0, três rodadas seguidas, um documento por vez | `task-template.md`, "Autoconferência", 8 |
| 2026-10-22 | X5 (`reengenharia`), 36.0, 97.0 e 48.0 | A 36.0 e a 97.0 marcaram a busca feita com caminho velho no `README` e numa AIA; a 48.0 marcou a caracterização sem o commit | `task-template.md`, "Autoconferência", 8: a subtarefa de busca ou de commit à parte só fica `[x]` com a prova no documento |
| até 2026-09-24 | F1 a A0 | Sete recomendações foram código que refazia o que o repositório já tinha: o hash do token de convite, o formato do apelido, a conferência de senha na vez, um módulo importando o service de outro | `task-template.md`, "Autoconferência", 9 |
| 2026-10-02 | A1 (`apresentacao-escola`), 4.0, 7.0, 11.0, 14.0 e o W6 da 16.0 | Corrida entre duas operações diferentes provada com `Promise.all` solto: passa a ordem que sair, e vira intermitente no banco carregado da esteira. A saída foi forçar a ordem (`GatilhoDeParada`, C5 e C11) | `task-template.md`, "Autoconferência", 10 |
| 2026-10-09 | F3 (`lgpd-e-titular`), 6.0 | A tarefa foi escrita em 6 minutos e levou cinco horas, porque cada tentativa de acertar um e2e rodou o portão inteiro, de uns 30 minutos | `executar-task`, passo 4, `<critical>`: o portão não é ferramenta de depuração |
| 2026-10-16 | X2 (`telas-da-coordenacao`), cargas de 9 a 24 | O e2e de duas linhas ao mesmo tempo estourou os 30 s | `executar-task`, passo 4: a fila de carga é do comando (`tools/ci/fila-de-carga.ts`) |
| 2026-10-17 | X2 (`telas-da-coordenacao`) | Cinco laços de espera com `pgrep`: o padrão casa com a linha de comando do próprio laço, e o laço não sai. Perto de 4 h de linha parada | `executar-task`, passo 4: nunca escreva laço de espera com `pgrep` |
| 2026-10-16 e 2026-10-17 | X1 (`pele-e-casca`) e X2 (`telas-da-coordenacao`) | Casos de e2e de 19 a 29 s na máquina (X1); quatro dos sete casos de prazo já passavam de 15 s (X2). A esteira leva o dobro e o prazo é de 30 s | `executar-task`, passo 4: o portão mede metade do prazo, 15 s |
| 2026-10-17 | X2 (`telas-da-coordenacao`) | O W12 da casca ("Governança") e o sino da 6.0 ("Refazer o convite de") quebraram e2e fora do diff, só na esteira | `executar-task`, passo 4: o portão roda o e2e que cita texto removido |
| 2026-10-19 | X3 (`telas-do-professor`), 3.0 | Antes de 19/10/2026 o texto que saía de um arquivo e continuava em outro puxava spec: "Tentar de novo" levou 53 dos 68 specs ao portão da 3.0 | `executar-task`, passo 4: o texto só conta como tirado quando nenhum `apps/web/src/**/*.{ts,tsx}` ainda o tem |
| 2026-10-10 | F3 (`lgpd-e-titular`), 11.0, 13.0, 14.0 e 15.0 | Deixaram três listas fechadas vermelhas (`apps/api/test/retencao.int.test.ts`, `apps/api/src/assistente/assistente.int.test.ts`, `infra/test/metricas.int.test.ts`), que só apareceram com a suíte inteira, quatro tarefas depois | `executar-task`, passo 4, "Lista fechada" |
| 2026-10-02 | A1 (`apresentacao-escola`), 16.0, W6 | Passou em três portões locais e caiu na esteira por uma ordem de entrega que só a máquina lenta produziu (a máquina roda o e2e com 6 trabalhadores e a esteira com 2) | `executar-task`, passo 4: spec de e2e novo roda também com `--repeat-each 3 --workers 2` |
| 2026-10-02 | A1 (`apresentacao-escola`), 15.0 | O commit saiu parcial e só foi refeito porque alguém olhou | `executar-task`, passo 7: `git diff --cached --name-only` antes e `git show --stat HEAD` depois |

## 2. A auditoria das skills (X7, 19.0, 24/10/2026)

Seis perguntas por skill: o **objetivo** (a uma frase), o **escopo** (onde ela vale), o **conflito** com regra ou decisão, a
**redundância** com outra skill ou com um arquivo de código, a **desatualização** (contra a versão do que o repositório usa) e a
**decisão**. Onde a skill é de terceiros, o texto do conflito está em `docs/skills-de-terceiros.md`, e a primeira linha depois do
frontmatter do `SKILL.md` o repete (`tools/processo/harness/metadados.test.ts` confere). "Nenhum" quer dizer que olhei e não achei.

### As do processo (nossas)

| Skill | Objetivo | Escopo | Conflito | Redundância | Desatualização | Decisão |
|---|---|---|---|---|---|---|
| `seguir` | O único comando: o Orquestrador lê o estado e conduz até a próxima decisão do Joaquim | Orquestrador, térreo | Nenhum | O índice é dela; cada passo mora em `passos/` | Partida em 17.0; 24.000 B é o teto de `seguir.test.ts` | Fica |
| `vigia` | A rotina de 30 minutos: olha o time e só age se alguém está preso | Orquestrador | Nenhum | Nenhuma: o quadro é `tools/processo/vigia.ts` | A tabela dela diz o arquivo de cada passo do `/seguir` (18.0) | Fica |
| `descobrir` | Entrevista que fecha uma decisão em aberto antes de virar PRD | Arquiteto | Nenhum | Nenhuma | O exemplo de identidade visual saiu (D80, 18.0) | Fica |
| `registrar-decisao` | Escreve a D<n> em `docs/decisoes.md` e no índice do `CLAUDE.md` | Arquiteto | Nenhum | Nenhuma | Nenhuma | Fica |
| `criar-prd` | O PRD de uma funcionalidade | Arquiteto | Nenhum | Nenhuma | Nenhuma | Fica |
| `criar-techspec` | A Tech Spec, a partir do PRD | Arquiteto | Nenhum | Nenhuma | Nenhuma | Fica |
| `revisar-spec` | Audita PRD e Tech Spec com os guardiões antes das tarefas | Arquiteto | Nenhum | A tabela natureza → guardião é só a do `criar-tasks` (18.0) | Nenhuma | Fica |
| `criar-tasks` | A lista de tarefas, a partir do PRD e da Tech Spec | Arquiteto | Nenhum | Dona da tabela natureza → guardião | A autoconferência subiu para 12 perguntas (18.0) | Fica |
| `executar-task` | O procedimento do Implementador, uma tarefa por vez | Implementador | Nenhum | Os 26 casos datados foram para a seção 1 deste documento (18.0) | 342 linhas, com limite de 499 | Fica |
| `revisar-tarefa` | A rodada da Mesa e a ordem de correção | Mesa de revisão | Nenhum | O passo 2 é o único lugar que diz a ordem dos revisores (18.0) | Nenhuma | Fica |
| `corrigir` | Corrige um defeito fora de uma tarefa, com teste que reproduz | Implementador | Nenhum | Nenhuma | Diz que a esteira roda em todo push (D79) | Fica |
| `validar` | A validação independente, RF a RF | Validador | Nenhum | Nenhuma | A ressalva menor da D79 revista (17.0) | Fica |
| `retro` | Transforma o histórico de revisões em mudança de processo | Arquiteto | Nenhum | Nenhuma | O aviso da D79 (17.0) | Fica |
| `status` | Dizia onde o projeto está e o próximo passo | Orquestrador | Nenhum | Total: `tools/processo/estado.ts` calcula a fase, e o `/seguir` roda o `estado.ts` direto | A skill lia o mesmo `estado.ts` e acrescentava só o formato do relatório | **Sai** (19.0), com toda citação dela |

### As de terceiros

| Skill | Objetivo | Escopo | Conflito | Redundância | Desatualização | Decisão |
|---|---|---|---|---|---|---|
| `frontend-design` | Direção estética ousada para tela nova | Tela | Com a regra 50 (Chromebook fraco, professora com quarenta minutos) e a D80 (a pele está fechada) | Nenhuma | Nenhuma | **Sai** (19.0), pasta e `skills-lock.json` |
| `supabase-postgres-best-practices` | Boas práticas de Postgres | Schema, migration, consulta | RLS no lugar do repository (regra 10) | Parcial com a `drizzle-orm-patterns` | Mantida pela Supabase | Fica, com o conflito na primeira linha |
| `vercel-react-best-practices` | Desempenho de React | Web | Escrita para Next.js; somos SPA com Vite (regra 50) | Nenhuma | Nenhuma | Fica, com o conflito na primeira linha |
| `playwright-best-practices` | Escrever e depurar teste de Playwright | `e2e/` | Geolocalização, PWA e app nativo não se aplicam (regra 50); toque e celular se aplicam (D51) | Parcial com a `accessibility` (axe-core) | `@playwright/test` 1.63 no repositório; a skill é 1.2 | Fica, com o conflito na primeira linha |
| `lgpd-brasil` | Resume a LGPD | Dado pessoal | A regra 20 e `docs/lgpd.md` são mais restritivos | Parcial com `docs/lgpd.md` | Resume a lei de 2018; o ECA Digital (2026) não está nela, e está em `docs/regulacao.md` | Fica, com o conflito na primeira linha |
| `nestjs-best-practices` | Boas práticas de NestJS | `apps/api` | A estrutura de `docs/arquitetura.md` prevalece | Nenhuma | Nest 12 no repositório; a skill é 1.2.0 | Fica, com o conflito na primeira linha |
| `drizzle-orm-patterns` | Schema, consulta e migration com Drizzle | `packages/nucleo` | Nenhum | Parcial com a `supabase-postgres-best-practices` | Drizzle 0.45 no repositório; a skill não diz a versão | Fica |
| `bullmq-specialist` | Fila com BullMQ | Worker | Nenhum | Nenhuma | BullMQ 6.3 no repositório; a skill não diz a versão | Fica |
| `tanstack-query-best-practices` | Cache e mutação no React Query | `apps/web` | Nenhum | Nenhuma | TanStack Query 5 no repositório; a skill não diz a versão | Fica |
| `tailwind-design-system` | Sistema de design em Tailwind | `apps/web` | Nenhum | Nenhuma | Fala de Tailwind 4, que é o do repositório | Fica |
| `accessibility` | Acessibilidade pela WCAG 2.2 | `apps/web` | Nenhum | Parcial com a `playwright-best-practices` (axe-core) | WCAG 2.2 é a vigente | Fica |
| `vitest` | Teste de unidade com Vitest | Todos os pacotes | Nenhum | Nenhuma | Escrita para o Vitest 5, que é o do repositório | Fica |
