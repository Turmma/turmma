# Validação — reengenharia-continuacao (X6)

## Rodada 2 — 16/11/2026

**Escopo:** funcionalidade completa
**Commit validado:** `26031b5a`
**Veredito: APROVADA**

Revalidação depois da rodada 1 (`37edd161`, APROVADA). De `37edd161` a `26031b5a` entraram duas correções, e só elas tocam código:
`d3a935f4` (correção `2026-11-16-censo-e2e-entrar-na-escola`, só `e2e/entrar-na-escola.spec.ts`) e `40d676a5` (correção
`2026-11-16-reserva-no-mesmo-milissegundo`, só `apps/worker/test/enviar-email.int.test.ts` e `enviar-email-da-conta.int.test.ts`). Os
outros três commits são registros de estado e da validação. `git diff 37edd161..26031b5a` não toca nenhum arquivo de `apps/*/src`,
`packages/*/src`, `infra/` nem `docs/`: o código de cada RF é o mesmo da rodada 1, e as citações de código dela continuam valendo. Mesmo
assim, nesta rodada rodei de novo os testes de evidência dos RF, fiz três mutações novas, em cláusulas que a rodada 1 não mutou, e li de
novo as fotos das telas.

Lidos de novo: `prd.md`, `tasks.md` (critério de pronto), `estado.md`, a Tech Spec nas seções "Como a N.0 ficou" e 12, as regras 00,
40, 60 e 80 por extenso (10, 20, 30 e 70 estavam no contexto), os dois documentos de correção e os achados deles
(`tasks/correcoes/achados/`).

### 1. RF a RF

| RF | Situação | O que mudou desde a rodada 1 | Evidência desta rodada |
|---|---|---|---|
| RF1 | ATENDIDO | nada | `fila-de-ia.int.test.ts` e `registro-de-comandos.test.ts` verdes em `26031b5a` |
| RF2 | ATENDIDO | nada | `fila-de-ia.int.test.ts` ("cinco ferramentas da A juntas…") verde |
| RF3 | ATENDIDO | nada | `execucao-interrompida.int.test.ts` e `fila-de-ia.int.test.ts` verdes |
| RF4 | ATENDIDO | nada | `tutor-modelo.int.test.ts` verde; **mutação nova** do sinal da D36 no worker (abaixo) |
| RF5 | ATENDIDO | nada | `corte-da-espera.int.test.ts` e `sem-resposta.int.test.ts` verdes. **Fotos lidas de novo**: `.processo/vitrine/validacao-x6--corte--computador.png` ("O Tutor não conseguiu responder agora. Tente de novo." com o botão, "Hoje: 0 de 60"), `professora--professor-turmas-01a1e6fc-9444-7e80-8fbf-100358a43cf4--computador.png` e `--celular.png` ("1 pergunta que o Tutor não respondeu hoje", sem texto da pergunta). A `apps/web` não mudou desde as fotos. No computador, a tabela do painel "O que o Tutor viu" corta a coluna "Em que estava" na borda: é a região rolável do `Table` (`apps/web/src/components/ui/Table.tsx:85`, `overflow-x-auto`, com `role="region"` e foco), anterior à X6, e não esconde ação: não é defeito da lista |
| RF6 | ATENDIDO | nada | a corrida de 16/11 (`11_task.md`, "A corrida"; `docs/infra.md` §10), não repetida (relatório, não portão) |
| RF7 | ATENDIDO | nada | `llm-gateway.test.ts`, `token-limiter.test.ts` e `token-limiter.int.test.ts` verdes |
| RF8 | ATENDIDO | nada | `llm-gateway.test.ts` verde; alertas e runbook sem mudança |
| RF9 | ATENDIDO | nada | `soberania-na-subida.int.test.ts` e `soberania.test.ts` verdes; **mutação nova** da conferência na subida (abaixo) |
| RF10 | ATENDIDO | nada | `llm-gateway.test.ts` (bloco da D62) e `tarefas.test.ts` verdes |
| RF11 | ATENDIDO | nada | `client.test.ts` e `respostas.test.ts` verdes |
| RF12 | ATENDIDO | nada | `AreaErrorBoundary.test.tsx` verde. **Foto lida de novo**: `.processo/vitrine/validacao-x6--falha--celular.png` (título com foco, texto do que fazer, "Tentar de novo" e "Voltar ao início" um abaixo do outro, sem corte a 360 px) |
| RF13 | ATENDIDO | o arquivo de e2e mudou, num caso que não é do RF13 (`:94`, a entrada sem provedor liberado); os três casos do RF13 deslizaram duas linhas | `mfa.int.test.ts`, `troca-de-escola.int.test.ts`, `espera-do-indisponivel.test.ts` e `SeletorDeEscola.test.tsx` verdes; `e2e/entrar-na-escola.spec.ts` inteiro, 26 de 26 verdes (`chromebook` e `celular`), com os casos do RF13 agora em `:335`, `:368` e `:400` (de 5,0 a 7,0 s). **Foto lida de novo**: `.processo/vitrine/validacao-x6--espera--celular.png` ("Tentando de novo em instantes (10 s)", botão "Entrando…" desabilitado) |
| RF14 | ATENDIDO | nada nos documentos | a leitura da rodada 1 vale: nenhum arquivo de `docs/` mudou. A esteira do último commit é do Orquestrador, no fechamento |

Provas de mutação (feitas por mim, uma de cada vez, restauradas com `git checkout --`; árvore limpa no fim):

| RF ou correção | Cláusula removida | Teste que ficou vermelho |
|---|---|---|
| RF9 (D62 na subida do `worker-ia`) | `if (motivos.length === 0) return true` trocada por `if (motivos.length >= 0) return true` (`packages/core/src/ia/soberania.ts:154`): a conferência passa com qualquer cadastro | `soberania-na-subida.int.test.ts` › "externo com o cadastro que não cobre: nenhum consumidor e nenhum batimento; corrigido o cadastro, passa a consumir sozinho" (`expected true to be false`) |
| RF4 (D36 no worker) | `await tutor.gravarSinal(pergunta.execucaoId, pergunta.turmaId, { tipo: 'atencao_humana' })` de `#encaminhar` (`apps/api/src/tutor/turno.command.ts:273`) | `tutor-modelo.int.test.ts -t "assunto delicado"`: 3 casos vermelhos, entre eles "o modelo classificou assunto delicado e a execução já foi encerrada…" e "abre antes da conclusão…" (`expected [] to deeply equal [ { tipo: 'atencao_humana', … } ]`) |
| Correção `reserva-no-mesmo-milissegundo` (o teste corrigido ainda prova a posse da reserva) | `eq(convite.envioReservadoEm, reserva)` do `concluir` (`packages/core/src/email/envio.repository.ts:90`), a mutação que o documento da correção declara | `enviar-email.int.test.ts` › "o desfecho é da reserva: `concluir` e `devolver` com a marca de uma reserva que outro processo já retomou não gravam nada" (`expected true to be false`) |

As três mutações da rodada 1 (a D62 no gateway, o escopo de escola em `encerrarRodando`, a idade do corte de 20 s) recaem sobre código
que não mudou.

### 2. Regras de negócio, casos de borda e critério de pronto

Sem mudança desde a rodada 1: o código, os testes de cada regra e de cada caso de borda e os documentos são os mesmos, e os testes
citados lá rodaram verdes de novo aqui (seção 3). A tabela da rodada 1 vale inteira, inclusive a regra do Tutor desligado (D84) e fora da
política (D19), que segue registrada como divergência (Tech Spec §5, "Como a 5.0 ficou" (7); `cenarios.md` §2). O item "o roteiro da
demonstração não muda de tela" foi conferido na rodada 1 contra o mesmo código de `apps/` e `e2e/roteiro-da-demonstracao.spec.ts`, que
não mudaram; não o rodei de novo.

| Item | Situação | Evidência |
|---|---|---|
| As duas correções novas não mudam comportamento de produto | cumprida | o diff só toca dois testes de integração do worker de e-mail e um caso de e2e; as asserções do `:94` são as mesmas, na mesma ordem; o teste da reserva ficou mais forte (confere também `reservadoEm: segunda.reserva` em `enviar-email.int.test.ts:341`) |
| Pronto: esteira verde no último commit | do fechamento | não entra neste veredito |

### 3. Portão

| Portão | Resultado |
|---|---|
| `npm run typecheck`, `npm run lint`, `npm run test`, `test:e2e`, `test:infra` inteiros | não rodados (escopo de funcionalidade, D79): esteira conferida no fechamento |
| Unidade que serve de evidência | ✅ `llm-gateway.test.ts`, `soberania.test.ts`, `token-limiter.test.ts`, `tarefas.test.ts`, `registro-de-comandos.test.ts`, `client.test.ts`, `respostas.test.ts`, `AreaErrorBoundary.test.tsx`, `espera-do-indisponivel.test.ts`, `SeletorDeEscola.test.tsx`: 10 arquivos, 308 passaram |
| Integração que serve de evidência | ✅ `fila-de-ia`, `execucao-interrompida`, `corte-da-espera`, `soberania-na-subida`, `tutor-modelo`, `sem-resposta`, `token-limiter` (Redis), `mfa`, `troca-de-escola`, mais os dois da correção (`enviar-email`, `enviar-email-da-conta`): 11 arquivos, 257 passaram. Os workers e despachantes do ambiente de teste 0 ficaram parados durante a corrida e as mutações, para não roubarem as filas da bancada, e foram religados depois |
| e2e que serve de evidência | ✅ `e2e/entrar-na-escola.spec.ts`: 26 passaram (`chromebook` e `celular`), em 51,6 s; o caso corrigido (`:94`) levou 1,7 s e 0,9 s |
| Mutações | ✅ 3 de 3 vermelhas por caso que rodou (seção 1) |
| Esteira do GitHub | roda no fechamento, depois desta validação (D78, D79): não entra no veredito |
| Revisões com veto registradas e aprovadas | ✅ as duas correções novas: `censo-e2e-entrar-na-escola` com os seis obrigatórios (`test-engineer`, `revisor-geral` e os quatro guardiões) APROVADO na 1ª; `reserva-no-mesmo-milissegundo` com os cinco obrigatórios APROVADO, o `test-engineer` também na 2ª (o `revisor-geral` não é obrigatório: dois arquivos, `.claude/skills/corrigir/SKILL.md`). As 14 tarefas, como na rodada 1 |

Observação: o `node_modules` deste andar segue anterior ao `package-lock.json`. Não rodei `npm ci` (só vale para escopo de tarefa), e
todos os testes acima passaram com o que está instalado.

Processo: nenhum commit `Fora do processo:` com código (`git log origin/develop..HEAD -i --grep='^Fora do processo:' -- apps packages
infra e2e tools` vazio), e todo commit de código desde a base leva `(tarefa N.0)` ou `(correção <slug>)`, os dois novos inclusive.

### 4. Achados

**Críticos**
- Nenhum.

**Maiores**
- Nenhum.

**Menores** (os sete da rodada 1 seguem, com os mesmos donos; abaixo, só os novos)
8. Recomendações das duas correções novas sem linha no `TODO.md` (`grep` de `envio.repository`, `reserva-no-mesmo` e `censo-e2e-entrar`
   no `TODO.md` não acha nada). (a) `tasks/correcoes/2026-11-16-reserva-no-mesmo-milissegundo.md`, "Recomendações sem aplicar": blocos de
   mutação para `devolver` e para `concluirLink`/`devolverLink` (`packages/core/src/email/envio.repository.ts:100,133,144`), com destino
   "a tarefa futura que tocar `envio.repository.ts`", que ninguém vai achar sem o `TODO.md`. (b) `apps/worker/test/enviar-email.int.test.ts:337`
   e `enviar-email-da-conta.int.test.ts:303`: com a marca da primeira 3 min antes, o `toBeGreaterThan(marcaDaPrimeira)` passa sempre e já
   não prova nada sozinho (recomendação do `infra-guardian` e do `conformidade-reviewer`, 1ª rodada). Quem prova a regra são os
   `concluir`/`devolver` → `false` e a linha com `reservadoEm: segunda.reserva`, e a mutação desta rodada confirma. Correção: um comentário
   que diga isso, ou tirar a asserção. (c) `tasks/correcoes/2026-11-16-censo-e2e-entrar-na-escola.md`: o `:218` a 17,8 s, perto dos 20 s do
   censo, e se a nova tentativa do `gotoComNovaTentativa` deve contar no censo (destino: retro da X6); e citar no fechamento a execução da
   esteira cujo `--censo` confirme o `:94` fora da lista. Dono: Orquestrador, no fechamento
9. A rodada 1 cita os casos do RF13 em `e2e/entrar-na-escola.spec.ts:333,366,398`; depois da correção do censo eles estão em `:335`,
   `:368` e `:400`. Só citação; esta rodada usa as novas. Dono: nenhum (registro)

**Positivos**
- A correção da reserva troca o relógio por um dado que o teste escreve: o caso deixou de depender de dois `clock_timestamp()` caírem em
  milissegundos diferentes e ganhou a asserção da marca gravada. É o padrão para todo teste de posse por marca de tempo

### 5. Conclusão

APROVADA. Depois da rodada 1 só entraram duas correções de teste, sem nenhuma linha de código de produção, documento ou infraestrutura.
Os 14 RF continuam com código e teste efetivo para cada parte do critério de aceite. Os testes de evidência rodaram verdes de novo em
`26031b5a`: 308 de unidade, 257 de integração e 26 de e2e. As três mutações novas ficaram vermelhas: a D62 na subida do `worker-ia`
(RF9), o sinal da D36 no worker (RF4) e a posse da reserva no teste corrigido. Com as da rodada 1, são seis cláusulas de risco
provadas. As telas dos RF5, RF12 e RF13 foram lidas de novo nas fotos, e a `apps/web` não mudou desde elas. As duas correções têm
todos os revisores obrigatórios com APROVADO. Ficam dois menores novos, que não mudam o veredito e vão ao `TODO.md` no fechamento. A
esteira do commit validado é do Orquestrador.

### 6. Pendências herdadas

As da rodada 1 (tabela abaixo, na seção 6 dela), mais:

| Pendência | Dono | Arquivo |
|---|---|---|
| Blocos de mutação de `devolver`, `concluirLink` e `devolverLink`; a asserção `toBeGreaterThan(marcaDaPrimeira)` que não prova nada sozinha (menor 8a e 8b) | Orquestrador no `TODO.md`; a próxima tarefa em `envio.repository.ts` | `packages/core/src/email/envio.repository.ts`; `apps/worker/test/enviar-email*.int.test.ts` |
| O `:218` perto do limite do censo e a nova tentativa contando no censo; a execução da esteira que confirma o `:94` (menor 8c) | retro da X6 (D86); Orquestrador no fechamento | `e2e/entrar-na-escola.spec.ts`; `tools/processo/esteira.ts --censo` |

Commits `Fora do processo:` com código da spec: nenhum.

## Rodada 1 — 16/11/2026

**Escopo:** funcionalidade completa
**Commit validado:** `37edd161`
**Veredito: APROVADA**

Validado contra `prd.md` (RF1 a RF14, com o RF9 revisto pelo Joaquim em 16/11), `techspec.md` (inclusive as seções "Como a N.0
ficou"), `cenarios.md`, `tasks.md` (critério de pronto) e o "Pronto quando" da X6 no `ROADMAP.md`. Regras lidas por extenso: 00, 10,
20, 30, 40, 50, 60, 70 e 80. Nenhuma suíte inteira rodou: só os testes que servem de evidência, isolados (seção 3).

### 1. RF a RF

| RF | Situação | Código | Teste | Observação |
|---|---|---|---|---|
| RF1 — toda IA no worker, por job; nenhuma requisição espera o modelo | ATENDIDO | `apps/api/src/ia/ia.module.ts:33` (o `IaModule` da API sem `LLM_PROVIDER`); `apps/api/src/ia/ia-do-worker.module.ts:59` (o único `createLLMGateway`); `apps/api/src/worker.module.ts` e `main-worker.ts` (contexto sem HTTP); `ExecucaoScheduler` grava execução e job no outbox | `apps/api/src/ia/fila-de-ia.int.test.ts` ("o `AppModule` não tem o provedor… o `main-worker` tem o provedor e nenhum controller", "o turno do Tutor: 202… e o worker a conclui uma vez", "a execução `pendente` e o job nascem na mesma transação"); `apps/api/src/ia/registro-de-comandos.test.ts` ("toda tarefa do catálogo que alguém chama tem o comando…", "o alvo que some reprova…") | Seis comandos (`*.command.ts`), só o `relatorio_da_correcao` sem chamador, com caso próprio. A guarda `tools/guardas/executor-so-na-bancada.ts` impede a suíte de trocar o executor por fora da bancada |
| RF2 — Tutor e ferramenta em filas separadas, vaga por escola | ATENDIDO | `fila` de cada comando: `tutor/turno.command.ts:186` `interativa`; `assistente/proposta.command.ts:36`, `artefato/ferramentas.command.ts:65,88`, `artefato/adaptacao.command.ts:22` `ferramenta`; `governanca/analista.command.ts:29` `normal`; `packages/core/src/settings/operational-settings.ts:22-23` | `fila-de-ia.int.test.ts` ("cinco ferramentas da A juntas: a quinta espera, o Tutor da A responde, e a ferramenta da B segue": quatro jobs da A ativos e o quinto `aguardando`, Tutor da A `concluida`, a da B chamou o modelo) | As três partes do critério têm asserção própria |
| RF3 — entrega dupla ou worker morto: uma chamada, `EXECUCAO_INTERROMPIDA`, troca não conta, consumo a mais | ATENDIDO | `apps/api/src/ia/execucao.repository.ts:148-155` (`encerrarRodando`, `where estado = 'rodando'` na escola do contexto); `execucao.processor.ts:81`; `varredura-de-execucoes.ts`; `packages/core/src/ia/consumo.ts` (linha estimada) | `apps/api/src/ia/execucao-interrompida.int.test.ts` ("worker morto: a reentrega encerra…, sem modelo, e deixa uma linha estimada", "duplicada em corrida… o modelo é chamado uma vez só", "as duas leem `pendente`…", "fora do freio: … a pergunta da execução interrompida não conta no dia", "linha estimada, externo: o envio e o provedor…, e a execução entra no `rastroDoAluno`"); `fila-de-ia.int.test.ts` ("job duplicado sobre a execução concluída", "clique duplo…") | A linha estimada leva os dois tetos e o destino do adaptador configurado (superestima, D14) |
| RF4 — D36 e S12 no worker | ATENDIDO | `tutor/turno.command.ts:201` (`preparar`, alcance e avaliação aberta), `:246` (`antesDeConcluir`, a mensagem fixa e o sinal em transação própria), `:250` (`concluir`, a S12 de novo); `tutor/tutor.service.ts:101,147` (`#encaminhar` antes da fila) | `apps/api/src/tutor/tutor-modelo.int.test.ts` ("o modelo classificou assunto delicado e a execução já foi encerrada…", "D36 na reentrega…: o sinal e a mensagem fixa seguem um só", "o job em dois workers…", "abre entre a execução e a conclusão…"); `tutor.int.test.ts` ("com a fila segura… o encaminhamento responde na hora", "com o Redis de fila parado, o encaminhamento responde igual", "abre entre o 202 e a execução…") | Pela bancada `fila-de-ia.fixture.ts` (fila real) |
| RF5 — 20 s na fila: sem modelo, "Tentar de novo", troca não conta, visível ao professor, alerta e runbook | ATENDIDO | `execucao.repository.ts:81-95` (`marcarRodando` com a idade na `interativa`), `:102` (`cortarEspera`); `execucoes.service.ts` (o corte no `GET`); `ia/metricas-da-execucao.ts`; `tutor/supervisao.repository.ts:222` (`#semResposta`); `infra/grafana/alertas/ia-espera-estourada-por-escola.yaml`; `docs/runbook.md:810,834` | `apps/api/src/ia/corte-da-espera.int.test.ts` (processador e `GET` aos 21 s, aos 15 s, ferramenta com 21 s, as duas ordens da corrida, isolamento, "a pergunta cortada não conta no freio"); `apps/api/src/tutor/sem-resposta.int.test.ts`; `infra/test/alertas.test.ts` (a expressão que separa uma escola de várias); `tools/guardas/alerta-tem-runbook.test.ts`; `e2e/aluno-tutor.spec.ts:378,423`; `e2e/a3-a4-professor.spec.ts:160` | **Fotos:** `.processo/vitrine/validacao-x6--corte--computador.png` e `validacao-x6--corte-janela--celular.png` (o `GET` real cortou a pendente de 25 s: "O Tutor não conseguiu responder agora. Tente de novo." com o botão, "Hoje: 0 de 60"); `.processo/vitrine/professora--professor-turmas-01a1e6fc-9444-…--computador.png` e `--celular.png` ("1 pergunta que o Tutor não respondeu hoje", separada do "0 de 60", sem texto); vazias: `vazia--aluno--aluno-tutor--celular.png`, `vazia--professora--professor-turmas-01a1e6fc-95e8-…--celular.png`. Nenhuma rola a 1366 × 768. Ver o menor 1 (a pergunta cortada depois de recarregar) |
| RF6 — p95 do turno ≤ base + 1 s; espera p95 Tutor < 2 s, ferramenta < 10 s, nenhum indisponível | ATENDIDO | `infra/k6/justica-entre-escolas.js` (`FASE=sala`), `infra/carga.env`, `infra/scripts/carga.ts` | `11_task.md`, "A corrida" (16/11): base anterior `58782107` 335 ms × árvore 353 ms (+18 ms); espera p95 do Tutor 62 a 107 ms; ferramenta 133 a 237 ms; 0 indisponível; 21 `EXECUCAO_INTERROMPIDA` do `kill -9` (teto 60); `docs/infra.md` §10; `infra/test/carga-da-manha.int.test.ts` e `carga.test.ts` (a semente, as medidas e o veredito) | Corrida não repetida por mim (relatório, não portão). Rodou com a máquina sem calma (load 2,9 a 5,1): a folga é de duas ordens de grandeza, e a repetição está no `TODO.md` (menor 4) |
| RF7 — limite de tokens por minuto, baldes, espera de 8 s, modelo menor fora do Tutor, `IA_INDISPONIVEL` sem erro cru | ATENDIDO | `packages/core/src/ia/token-limiter.ts:93,108`; `llm-gateway.ts:52` (`ESPERA_MAXIMA_DA_VAGA_MS`), `:342` (`chamarAteValer`); `packages/core/src/config/llm-config.ts:136` (obrigatória fora do `local`) | `packages/core/src/ia/llm-gateway.test.ts`, bloco "o limite de tokens e a degradação" (um caso por degrau, "o turno do Tutor pula o modelo menor", "sem modelo menor configurado… o degrau é pulado", "o prazo que vence durante a espera…"); `token-limiter.test.ts` (80 %, 15 %, 10 %, `reward`, seguro ÷ réplicas); `token-limiter.int.test.ts` ("duas réplicas… somam no mesmo balde", "com o Redis fora, cada réplica segura o teto ÷ IA_REPLICAS"); `apps/api/src/ia/prazo-com-tokens.int.test.ts` | "Até metade" do RF7: a `normal` tem 10 % (dentro do limite); a ferramenta, 15 %, abaixo dos 80 % do Tutor |
| RF8 — métricas de IA sem usuário nem escola; alertas "Provedor de IA fora" e "Tokens acima de 80 %" com runbook | ATENDIDO | `llm-gateway.ts:57` (`ia.degradacao{degrau}`), `token-limiter.ts:30` (`ia.tokens.uso_do_teto`), `resilient-adapter.ts:37` (`ia.disjuntor.aberto`); `infra/grafana/alertas/ia-provedor-fora.yaml`, `ia-tokens-acima-do-teto.yaml`; `docs/runbook.md:1342,1366,1384` | `llm-gateway.test.ts` ("as métricas do gateway nunca levam usuário nem escola…", "a duração e os erros da chamada…", "o uso do teto é o da última reserva…"); `infra/test/alertas.test.ts:239-260`; `tools/guardas/alerta-tem-runbook.test.ts:32-35` | Só `ia.espera_estourada` e `ia.execucao.interrompida` levam `escola_id`, como o PRD §8 permite |
| RF9 — o `worker-ia` não consome sem a D62; falso e local consomem; banco fora não consome; a prontidão da API não depende da D62 | ATENDIDO | `packages/core/src/ia/soberania.ts:70` (`SoberaniaNaSubida`, só no `IaDoWorkerModule`); `apps/api/src/worker.module.ts` (`onApplicationBootstrap` espera `aguardarConferida`) | `apps/api/src/ia/soberania-na-subida.int.test.ts` (a API responde 200 em `/prontidao` com o cadastro que não cobre e sem suboperador ou banco; o falso e o local consomem; "externo com o cadastro que não cobre: nenhum consumidor e nenhum batimento; corrigido…, passa a consumir sozinho"; banco fora); `packages/core/src/ia/soberania.test.ts` (campo a campo, "uma por categoria") | O RF9 revisto pela decisão A do Joaquim (16/11) está no PRD, na Tech Spec §5 e nos cenários §5: desvio registrado, não silencioso |
| RF10 — o gateway recusa texto de aluno a provedor sem a D62, antes de qualquer envio; toda tarefa declara | ATENDIDO | `packages/core/src/ia/llm-gateway.ts:287-295` (`exigirSoberania`); `packages/core/src/ia/task.ts:72` (`levaTextoDeAluno` obrigatório) | `llm-gateway.test.ts`, bloco "a D62 na chamada, antes do orçamento e do envio" (nenhuma chamada, orçamento não consultado, sem consumo; a regra fixa da D36 ainda responde); `packages/core/src/ia/tasks/tarefas.test.ts:176-178` (`@ts-expect-error` sem `categoriasEnviadas` e sem `levaTextoDeAluno`); `apps/api/test/architecture.test.ts` (todo `createLLMGateway` de produção entrega a `soberania`) | Mutação própria (seção abaixo) |
| RF11 — prazo em toda chamada da web; estouro mostra "Tentar de novo"; cancelamento não vira erro; a resposta de prova pendurada não trava as outras | ATENDIDO | `apps/web/src/api/client.ts:54` (`PRAZOS_DA_CHAMADA_MS`), `:66` (`comPrazo`); `apps/web/src/api/atividades-do-aluno.ts:67` (`tipo: 'prova'`); `areas/aluno/respostas.ts` (`paraOFim`); a guarda `no-restricted-globals` e `no-restricted-syntax` | `apps/web/src/api/client.test.ts`, bloco "prazo da chamada (RF11, 52.0)" (20 s, 30 s, 180 s, 10 s, corpo pendurado, cancelamento); `areas/professor/artefatos/Criados.test.tsx:512,541`; `areas/aluno/respostas.test.ts:416-525`; `tools/guardas/guardas.test.ts:743` | O estouro desemboca no mesmo `ErrorState` com "Tentar de novo" das fotos do RF13 (`validacao-x6--espera-erro--*.png`) |
| RF12 — tela que quebra fora de área mostra a falha com o caminho de volta | ATENDIDO | `apps/web/src/routes.tsx:212,229` (`AreaErrorBoundary … paginaInteira`); `components/AreaErrorBoundary.tsx` ("Voltar ao início") | `apps/web/src/components/AreaErrorBoundary.test.tsx` (raiz, "Voltar ao início" link comum, `/operacao`); `e2e/tela-de-falha.spec.ts` (foco, 1366 × 768 sem rolar, 360 px sem corte e 44 px, a volta sai da falha), 16 casos verdes nos dois projetos, rodados aqui | **Fotos:** `.processo/vitrine/validacao-x6--falha--computador.png` e `--celular.png` (a vitrine não alcança: feitas com o mesmo `addInitScript` do e2e): título com foco, texto que diz o que fazer, os dois botões, a 360 px um abaixo do outro, sem corte |
| RF13 — Redis fora: segundo fator e escolha de escola dão "tente de novo" com espera, sem gastar tentativa; a web espera uma vez | ATENDIDO | `apps/api/src/credencial/challenge.ts:172` (`conferirLivre`), `:197` (`#semRedis`); `apps/web/src/pages/espera-do-indisponivel.ts` | `apps/api/test/mfa.int.test.ts:762,797,815,858`; `apps/api/test/troca-de-escola.int.test.ts:770,815`; `apps/web/src/pages/espera-do-indisponivel.test.ts`; `components/SeletorDeEscola.test.tsx:148,174`; `e2e/entrar-na-escola.spec.ts:333,366,398` (verdes aqui, nos dois projetos) | **Fotos:** `.processo/vitrine/validacao-x6--espera--computador.png` e `--celular.png` ("Tentando de novo em instantes (10 s)", botão desabilitado "Entrando…"), `validacao-x6--espera-erro--computador.png` e `--celular.png` (o segundo 503: o `ErrorState` com "Tentar de novo" e o "Entrar" de volta) |
| RF14 — suíte verde; e2e obrigatórios e invariantes das regras 10, 20 e 70 seguem provados; os documentos dizem onde a IA roda | ATENDIDO | `docs/arquitetura.md:136,144-152`; `docs/infra.md:269,309,337,458`; `docs/guia-do-desenvolvedor.md:290,306`; `docs/aia/tutor.md:186,411,425,436`; `docs/lgpd.md:116`; `docs/roteiro-da-demonstracao.md` (os `worker-ia` no lugar das APIs) | Leitura dos documentos; os testes de isolamento e de regra 70 da spec rodados aqui (seção 3) | A parte "esteira verde no último commit" é do Orquestrador, no fechamento. Nenhum documento de `docs/` ainda descreve a IA no processo da API, salvo os históricos (menor 3) |

Provas de mutação (feitas por mim, uma de cada vez, com o arquivo restaurado por `git checkout --` e a árvore limpa no fim):

| RF | Cláusula removida | Teste que ficou vermelho |
|---|---|---|
| RF10 | `throw new LLMError('IA_INDISPONIVEL')` de `exigirSoberania` (`packages/core/src/ia/llm-gateway.ts:294`) | `llm-gateway.test.ts -t "D62"`: 7 casos vermelhos (a chamada sairia sem a D62, e reservaria tokens antes da recusa) |
| Regra 10 (RF3, isolamento da reentrega) | `eq(execucaoAgente.escolaId, requireEscolaId())` do `update` de `encerrarRodando` (`apps/api/src/ia/execucao.repository.ts:153`) | `execucao-interrompida.int.test.ts` › "isolamento, reentrega: o job da A com o `execucaoId` da B, já `rodando`, não muda nada na B e não deixa linha" (`expected { …(4) } to be undefined`) |
| RF5 | a condição de idade (`gte(criadaEm, now() - 20 s)`) de `marcarRodando` (`execucao.repository.ts:90`) | `corte-da-espera.int.test.ts` › "processador corta: aos 21 s, sem GET…" (`expected { estado: 'concluida' } to match { estado: 'falhou' }`: o modelo seria chamado) |

### 2. Regras de negócio, casos de borda e critério de pronto

| Item | Situação | Evidência |
|---|---|---|
| Regra: o que a escola vê só muda no RF5, RF11 a RF13 e no degrau do RF7 | cumprida | as telas tocadas são as do Tutor (falha), da turma (contador), da `Falha` e do aviso da espera; nada mais mudou de marcação no diff |
| Regra: o job leva só o id da execução; a escola vem do registro do job | cumprida | `fila-de-ia.int.test.ts` ("só o id da execução: sem id, id que não é uuid, campo a mais e texto livre são recusados", "job da A com o `execucaoId` da B: nada muda…") |
| Regra: a conferência do assunto delicado roda antes da fila, sem modelo | cumprida | `tutor.service.ts:101`; `tutor.int.test.ts:1178,1197` |
| Regra: Tutor desligado (D84), suspenso (D9) ou fora da política (D19) não cria job | cumprida no que existe; justificada no resto | a suspensão, a avaliação aberta e o pacote têm caso de "nenhum job"; o desligado e o fora da política **não existem na API** (`tutor.service.ts:197`, conferido aqui: nenhuma coluna nem conferência). Divergência registrada na Tech Spec §5 "Como a 5.0 ficou" (7) e nos cenários §2 (pendência herdada) |
| Regra: nenhum teste chama provedor pago | cumprida | os testes de IA usam `ScriptedAdapter`, o falso ou o servidor falso local; a carga usa o falso |
| Borda: às 10h, seis turmas no Tutor e a prova de 50 s | coberta | `fila-de-ia.int.test.ts` (RF2) e a `FASE=sala` (ferramenta de ~50 s, `IA_LATENCIA_FALSA_MS_PADRAO`) |
| Borda: uma escola de 900 alunos enche as vagas | coberta | RF2 (só a A espera) e `infra/test/alertas.test.ts:203` (a regra "uma escola" separada de "várias") |
| Borda: o professor abre a avaliação com a dúvida na fila; "quero sumir" ainda recebe o CVV | coberta | `tutor.int.test.ts:537`; `tutor-modelo.int.test.ts:263,556,568` |
| Borda: a rede trava no meio da prova | coberta | `respostas.test.ts:446,472` (estoura em 10 s, vai para o fim, as outras seguem) |
| Borda: o Redis cai às 7h30 na troca de escola | coberta | `troca-de-escola.int.test.ts:770`; `e2e/entrar-na-escola.spec.ts:398` |
| Pronto: nenhuma chamada de modelo no processo HTTP; filas por papel com vaga por escola | cumprido | RF1, RF2 |
| Pronto: execução duplicada ou interrompida; D36 e S12 no worker | cumprido | RF3, RF4 |
| Pronto: 20 s com "Tentar de novo", visível ao professor, alerta e runbook | cumprido | RF5, com as fotos |
| Pronto: p95 e esperas da carga, com a corrida registrada | cumprido | RF6 (`11_task.md`, `docs/infra.md` §10) |
| Pronto: tokens com degradação, métricas e alertas; D62 na subida e no gateway | cumprido | RF7 a RF10 |
| Pronto: a web com prazo, tela de falha com volta, Redis fora sem gastar tentativa | cumprido | RF11 a RF13 |
| Pronto: os seis documentos atualizados; esteira verde no último commit | cumprido nos documentos; a esteira é do fechamento | RF14 |
| Pronto: o roteiro da demonstração não muda de tela (a 7.0 e a 9.0 conferem contra `e2e/roteiro-da-demonstracao.spec.ts`) | cumprido (conferido aqui) | `e2e/roteiro-da-demonstracao.spec.ts` rodado por mim no commit validado: 2 de 2 verdes (`chromebook` e `celular`, 1,5 min cada), com a IA já no `worker-ia`. O `7_task.md` e o `9_task.md` não registram a conferência que o critério pedia a eles (menor 7) |
| Roadmap, "Pronto quando" da X6 | cumprido | nenhuma requisição espera modelo (RF1); o Tutor não espera a ferramenta e fica +18 ms no p95 (RF2, RF6); o limite degrada sem erro cru (RF7); texto de aluno não sai sem a D62 (RF9, RF10); toda chamada da web tem prazo (RF11); o Redis fora não gasta tentativa (RF13) |

### 3. Portão

| Portão | Resultado |
|---|---|
| `npm run typecheck`, `npm run lint`, `npm run test`, `test:e2e`, `test:infra` inteiros | não rodados aqui (escopo de funcionalidade, D79): esteira conferida no fechamento |
| Unidade que serve de evidência | ✅ `llm-gateway.test.ts`, `token-limiter.test.ts`, `tarefas.test.ts`, `registro-de-comandos.test.ts`: 178 passaram; `client.test.ts`, `respostas.test.ts`, `AreaErrorBoundary.test.tsx`, `espera-do-indisponivel.test.ts`, `SeletorDeEscola.test.tsx`, `ciclo-de-execucao.test.ts`, `soberania.test.ts`, `teto-de-entrada.test.ts`: 174 passaram |
| Integração que serve de evidência | ✅ `fila-de-ia`, `execucao-interrompida`, `corte-da-espera`, `soberania-na-subida`, `teto-de-entrada`, `prazo-com-tokens`, `sem-resposta`, `tutor-modelo`, `token-limiter` (Redis), `mfa`, `troca-de-escola`: 11 arquivos, 225 passaram (com os workers e despachantes do compose de teste parados durante a corrida, para não roubarem as filas da bancada, e religados depois) |
| e2e que serve de evidência | ✅ `e2e/tela-de-falha.spec.ts` e `e2e/entrar-na-escola.spec.ts`: 34 passaram (`chromebook` e `celular`); `e2e/roteiro-da-demonstracao.spec.ts`: 2 passaram |
| Mutações | ✅ 3 de 3 vermelhas por caso que rodou (seção 1) |
| Esteira do GitHub | roda no fechamento, depois desta validação (D78, D79): não entra no veredito |
| Revisões com veto registradas e aprovadas | ✅ nas 14 tarefas, todo revisor obrigatório (`test-engineer`, `revisor-geral` e os da tabela de `tasks.md`) tem rodada, e a última de cada um é APROVADO; `revisao-spec.md` com veredito APROVADA na 6ª rodada (15/11) |

Observação: o `node_modules` deste andar é anterior ao `package-lock.json` (a conferência da seção 4 do validador deu "velho"); não rodei `npm ci`, que só vale para o escopo de tarefa, e os testes acima passaram com o que está instalado.

### 4. Achados

**Críticos**
- Nenhum.

**Maiores**
- Nenhum.

**Menores**
1. `apps/web/src/areas/aluno/Tutor.tsx:153,243` (`pendenteNoTutor` lê o ciclo da sessão): a pergunta cortada (ou que falhou por qualquer código de `PASSAGEIROS`), **depois de recarregar a página ou de voltar à atividade**, fica na conversa sem resposta e sem aviso nenhum; o "Tentar de novo" só existe na sessão que enviou. Foto: `.processo/vitrine/aluno--aluno-tutor-01a1e6fc-9483-7774-a092-5568d6b58233--computador.png` (a pergunta "Como eu balanceio…", `falhou IA_INDISPONIVEL`, sem nada embaixo). O comportamento é anterior à X6 e o PRD tira mudança de tela do escopo, mas a X6 torna a falha mais frequente (o corte de 20 s, o teto, a D62). Correção sugerida: a conversa (`GET /v1/tutor/conversa`) dizer, por pergunta, que ela terminou sem resposta (o mesmo `#semResposta` da 9.0), e a tela mostrar o aviso calmo com "Perguntar de novo". Dono: a spec que tocar na tela do Tutor (F9), com o `TODO.md`
2. `tasks/prd-reengenharia-continuacao/8_task.md`, Autoconferência 4: cita como controle casos da prontidão da API ("prova o 200 antes de cada recusa", "confere o 503 antes do 200") que saíram com a decisão A; a linha "recusa por campo" cita um caso de `soberania.test.ts` com nome antigo; e o bloco de mutação de `app.module.ts` prova uma ausência (já apontado no `estado.md`). Só documento. Dono: Orquestrador, no `TODO.md` ou na retro
3. `docs/decisoes.md:1120-1121` (D77, item 5) e `TODO.md:1559` ainda tratam a "execução de IA no processo da API" (`TODO(fila)`) como dívida aberta; a X6 a pagou na 5.0 (a parte da extração de PDF foi da F4). Correção: anotar na D77 que a dívida foi paga (X6, 5.0) e fechar o item do `TODO.md`. Dono: Orquestrador, no fechamento
4. `11_task.md`, "A corrida": a carga de 16/11 rodou com a máquina sem a calma que o runbook pede (load 2,9 a 5,1, outras pilhas de pé). Passou com folga de duas ordens de grandeza; a repetição já está no `TODO.md`. Dono: Joaquim, antes do piloto
5. `techspec.md:4`: "Status: rascunho", com a spec aprovada e implementada. Dono: Arquiteto, na retro
6. Pendências do `estado.md` que precisam de destino no fechamento: o achado do Arquiteto na triagem da 4.0 (o Analista devolve os agregados inteiros na saída, com 6.000 tokens de saída, e falha com modelo real acima de ~4 mil tokens de entrada: decisão do Joaquim junto da U03-12, D32); `VAGAS_ESCOLA_FERRAMENTA=4`, `IA_LATENCIA_FALSA_MS_PADRAO=0`, `IA_TOKENS_FALSOS_ENTRADA=0` e `IA_TOKENS_FALSOS_SAIDA=0` no `.env` da VPS antes do primeiro deploy; a 5.0 só vai para produção com a 10.0 (pousam juntas, já na mesma spec). Dono: Orquestrador, no pedido de pouso
7. `tasks.md`, critério de pronto, último item: ele pedia que a 7.0 e a 9.0 conferissem o roteiro da demonstração contra `e2e/roteiro-da-demonstracao.spec.ts`, e nem o `7_task.md` nem o `9_task.md` citam o roteiro. Conferi aqui (2 de 2 verdes); o que falta é o hábito: critério de pronto que nomeia uma tarefa precisa de uma linha no documento dela. Dono: Arquiteto, na retro (D86)

**Positivos**
- A bancada `apps/api/test/fila-de-ia.fixture.ts` (outbox, despachante e `JobExecutor` reais) com a guarda `tools/guardas/executor-so-na-bancada.ts`: os testes de IA passam pela fila de verdade, e nenhum volta a trocar o executor por fora
- Toda transição de `execucao_agente` é um `update` condicional com o `now()` do banco, e "quem recebe a linha" decide efeito e métrica: as corridas (reentrega, corte, varredura com duas réplicas) se provam com barreira, e não com tempo
- A divergência de desenho da 8.0 (a prontidão da API presa à D62) subiu ao Joaquim e voltou escrita no PRD, na Tech Spec e nos cenários antes do commit: nenhum desvio ficou em silêncio nesta spec

### 5. Conclusão

APROVADA. Os 14 RF têm código e teste efetivo para cada parte do critério de aceite; as três mutações que fiz nas cláusulas de maior risco (a D62 no gateway, o escopo de escola na reentrega e a idade do corte de 20 s) ficaram vermelhas por caso que rodou. As telas dos RF5, RF12 e RF13 foram vistas nas fotos, cheias e vazias onde a vitrine alcança e, onde não alcança, com o mesmo truque do e2e; nenhuma rola a 1366 × 768 e nenhuma tem defeito da lista do `frontend-reviewer`. O corte de 20 s foi visto de ponta a ponta: uma pendente de 25 s, sem job, foi cortada pelo `GET` real e a tela mostrou "Tentar de novo" sem gastar a troca. Os casos de borda do PRD têm teste; a única regra de negócio sem conferência (o Tutor desligado e a política por turma) não existe no sistema e está registrada como divergência. O roteiro da demonstração continua verde de ponta a ponta. Sobram sete menores, que não mudam o veredito e vão ao `TODO.md` no fechamento. A esteira do commit validado é do Orquestrador.

### 6. Pendências herdadas

| Pendência | Dono | Arquivo |
|---|---|---|
| A pergunta sem resposta, depois de recarregar, sem aviso na tela do Tutor (menor 1) | a spec que tocar na tela do Tutor (F9) | `apps/web/src/areas/aluno/Tutor.tsx` |
| O "nenhum job" do Tutor desligado na escola (D84) e fora da política da turma (D19) | quem criar essas conferências (F9, a fatia do piloto) | `techspec.md` §5 "Como a 5.0 ficou" (7); `cenarios.md` §2 |
| A Autoconferência 4 e duas linhas da tabela de testes da 8.0 (menor 2) | Orquestrador | `tasks/prd-reengenharia-continuacao/8_task.md` |
| A D77 (item 5) e o `TODO(fila)` do `TODO.md` (menor 3) | Orquestrador | `docs/decisoes.md`, `TODO.md` |
| A corrida de carga com a máquina calma (menor 4) | Joaquim | `TODO.md`; `docs/runbook.md` "Rodar a carga da manhã" |
| O status da Tech Spec (menor 5) | Arquiteto | `techspec.md` |
| O Analista que falha com modelo real acima de ~4 mil tokens de entrada; as variáveis do `.env` da VPS; a 5.0 só com a 10.0 (menor 6) | Joaquim (D32, U03-12) e Orquestrador no pedido de pouso | `estado.md`; `TODO.md` |
| O teto real de tokens e o modelo menor de cada perfil; o uso por menor nos termos do provedor | D37 | `prd.md` §10 |

Commits `Fora do processo:` com código da spec: nenhum (`git log origin/develop..HEAD -i --grep='^Fora do processo:' -- apps packages infra e2e tools` vazio). Todo commit de código desde a base tem `(tarefa N.0)` ou `(correção <slug>)`; os demais são merges das linhas e registros de estado.
