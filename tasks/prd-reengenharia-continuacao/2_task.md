# Tarefa 2.0 — O Tutor roda por comando: a D36 grava em transação própria e a S12 se confere no `preparar` e no `concluir` (42.0)

**Funcionalidade:** reengenharia-continuacao · **Depende de:** 1.0
**Subagentes obrigatórios:** `tenancy-guardian`, `conformidade-reviewer`, `infra-guardian`, `llm-integrator`
**Porte:** grande

## Objetivo

O turno do Tutor ganha comando registrado. O `assunto_delicado` do modelo grava a mensagem fixa e o `atencao_humana` numa
transação própria, mesmo com a execução encerrada; a avaliação aberta se confere no `preparar` e no `concluir`. Toda
`TarefaDeIa` passa a ter comando, e o `ExecucaoRequest` perde as closures.

## Contexto necessário

- `techspec.md` §5 "O comando", "O contexto no worker" e "A D36 e a S12"
- `prd.md` RF1, RF4; §6
- `tasks/prd-reengenharia/onda-3a.md` "T9 — o Command por tarefa"; regras 10, 30 (10, 11), 40, 70 (3, 4), 80
- Código: `apps/api/src/tutor/tutor.service.ts`: `agendar` (l.200), `entrada` (l.215), `aoConcluir` (l.241; avaliação
  aberta, l.247), assunto delicado do modelo (l.344), `#encaminhar` (l.370)

## Subtarefas

- [x] 2.1 — Confira que a caracterização da 1.0 cobre o prompt do turno
- [x] 2.2 — `turno.command.ts`: o `preparar` relê a pergunta pelo id, com o alcance e a avaliação aberta; `lido` tipado
- [x] 2.3 — O `concluir`: o `assunto_delicado` numa transação própria, antes da conclusão condicional; a avaliação de novo
- [x] 2.4 — O `#encaminhar` continua na requisição, sem comando nem execução nova
- [x] 2.5 — `ExecucaoRequest` só com `aoGravar` além dos dados; o `agendar` busca o comando no registro
- [x] 2.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/src/tutor/turno.command.ts`, `apps/api/src/tutor/turno.command.test.ts` (as peças que o comando e o service dividem, em unidade), `apps/api/src/ia/registro-de-comandos.test.ts` | novo |
| `apps/api/src/tutor/tutor.service.ts`, `apps/api/src/tutor/tutor.module.ts`, `apps/api/src/tutor/tutor.repository.ts`, `apps/api/src/ia/execucao.scheduler.ts`, `apps/api/src/ia/registro-de-comandos.ts`, `apps/api/src/ia/ia.int.test.ts`, `apps/api/src/tutor/tutor.int.test.ts`, `apps/api/src/tutor/tutor-modelo.int.test.ts`, `docs/guia-do-desenvolvedor.md`, `packages/core/src/ia/README.md`, `eslint-suppressions.json` (as supressões do `tutor.service.ts` caem de 4 para 2: o que ficou grande foi para o comando, em funções menores) e `tools/guardas/catraca.test.ts` (o `TETO` de `complexity`, 236 → 234, que a catraca exige no mesmo commit) | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| toda tarefa tem comando | U | o registro tem um comando por `TarefaDeIa`, salvo `relatorio_da_correcao`. Mutação: tirar um registro | `apps/api/src/ia/registro-de-comandos.test.ts` › "toda tarefa do catálogo que alguém chama tem o comando que um módulo registra, e só a que ninguém chama fica sem" (lê o que os `*.module.ts` registram) e `apps/api/src/ia/ia.int.test.ts` › "a API sobe com o comando de toda tarefa do catálogo que alguém chama, cada um registrado pelo módulo dono" |
| trava, alvo some | U | registro vazio, ou a lista de tarefas vazia: vermelho | `apps/api/src/ia/registro-de-comandos.test.ts` › "o alvo que some reprova em vez de passar em branco: registro vazio, catálogo vazio e pasta sem módulo" |
| trava, quem contorna | U | comando com tarefa fora de `TarefaDeIa`; nome registrado duas vezes | `apps/api/src/ia/registro-de-comandos.test.ts` › "quem contorna reprova: comando de tarefa fora do catálogo, e a mesma tarefa registrada duas vezes" |
| a exceção | U | `relatorio_da_correcao` com chamador reprova | `apps/api/src/ia/registro-de-comandos.test.ts` › "a exceção é uma só, e fica de fora porque ninguém a chama: nenhum arquivo da API usa o `relatorio_da_correcao`" |
| `ExecucaoRequest` sem closure | U | `aoConcluir` ou `entrada` no pedido não compila (`@ts-expect-error`) | `apps/api/src/ia/registro-de-comandos.test.ts` › "o pedido de IA não leva closure de entrada nem de conclusão: só a chave, a entrada gravada e o que grava junto do pendente" (o `tsc` do portão confere os dois `@ts-expect-error`) |
| turno pelo comando | I | resposta, uma troca, consumo sem texto, com o aluno e a turma que o comando passa ao modelo | `apps/api/src/tutor/tutor.int.test.ts` › "grava a pergunta com a execução, responde por pergunta com a página citada, e o texto do aluno fica só na conversa dele" (o `consumo_ia` com o `aluno_id` do aluno, pelo `TurnoDoTutorCommand` real) e "a mesma chave de envio devolve a mesma execução, com uma pergunta, uma resposta e uma troca contada" (a troca contada na conversa do aluno, o freio do dia e o pacote da turma). O caso de `apps/api/src/ia/ia.int.test.ts` › "o turno do Tutor grava consumo com o aluno e com entrada e saída nulas, e o aluno lê a resposta pela rota" roda com o comando de teste do `ia.int.test.ts` (o executor, e não o comando do Tutor): prova o executor, e não o que o comando passa |
| D36 com a execução encerrada | I | mensagem fixa e sinal ficam. Mutação: o sinal dentro da conclusão condicional | `apps/api/src/tutor/tutor-modelo.int.test.ts` › "o modelo classificou assunto delicado e a execução já foi encerrada (a varredura, o prazo): a mensagem fixa e o sinal sem referência ficam, e a execução segue como estava" |
| D36 repetida | I | o `concluir` duas vezes, **ao mesmo tempo** (`Promise.all`): um sinal só | `apps/api/src/tutor/tutor-modelo.int.test.ts` › "o `concluir` duas vezes (a reentrega da execução): uma mensagem e um sinal só, e a mesma mensagem nas duas" |
| "quero sumir" sem modelo | I | mensagem e sinal na requisição, sem o adaptador. Mutação: a conferência no comando | `apps/api/src/tutor/tutor.int.test.ts` › "recebe a mensagem fixa na hora, e o professor recebe o sinal sem referência e sem conteúdo" (a rota, sem execução de modelo: consumo `regra_fixa`); `apps/api/src/tutor/tutor-modelo.int.test.ts` › "o turno de assunto delicado nunca vai ao modelo, nem no turno seguinte" (o adaptador não recebe pedido) |
| S12 entre o `POST` e o `preparar` | I | sem resposta, sem troca | `apps/api/src/tutor/tutor.int.test.ts` › "abre entre o 202 e a execução: a execução falha com o código da pausa, sem trecho, sem modelo, sem resposta, sem sinal e sem troca…" e "dois alunos parados ao entrar em `rodando` quando a prova abre…"; `apps/api/src/tutor/tutor-modelo.int.test.ts` › "abre entre o 202 e a execução: o modelo nem chega a ser chamado" |
| S12 entre o `preparar` e o `concluir` | I | sem resposta, sem troca; o `assunto_delicado` ainda grava | `apps/api/src/tutor/tutor-modelo.int.test.ts` › "abre entre a execução e a conclusão: o modelo respondeu e a resposta é descartada, sem mensagem, sem sinal (nem resposta pronta) e sem troca; o consumo da chamada fica" e "abre antes da conclusão e o modelo classificou assunto delicado: a mensagem fixa e o sinal sem referência ficam, e a troca conta" (o adaptador falso fica seguro numa barreira, `WriteBlockTrigger` no insert do `consumo_ia`) |
| avaliação de outra turma abre no meio | I | o turno conclui, com troca contada | `apps/api/src/tutor/tutor.int.test.ts` › "a avaliação de outra turma da escola abre no meio: o turno conclui, com resposta e troca contada" |
| contexto no `preparar` | I | transferido, vínculo encerrado, eliminado, virada do ano, função suspensa: `NAO_ENCONTRADO` (ou `FUNCAO_SUSPENSA`), sem modelo nem `consumo_ia` | `apps/api/src/tutor/tutor.int.test.ts` › "transferido para uma turma em prova entre o 202 e a execução: a execução falha como inexistente, e não como pausa" e "o aluno transferido depois do 202 e antes de a execução rodar…" (transferido); "o comando relê o contexto ao rodar: o vínculo encerrado, a pergunta eliminada, o material que saiu do alcance e a função suspensa depois do 202 falham a execução, sem trecho, sem modelo e sem consumo" (os quatro, com a contagem do `consumo_ia` antes e depois); a virada do ano e a execução sem quem pediu: `apps/api/src/ia/ia.int.test.ts` › "o comando relê a execução pelo id: a da pessoa, no escopo, com a entrada gravada; a de B, a do colega, a de outro ano e a de entrada inválida não são achadas" e "depois do 202, a função suspensa, a execução que saiu do alcance e a linha que virou de outra tarefa não chegam ao `preparar`: nem leitura, nem modelo" (o `paraExecutar` é o mesmo para toda tarefa) |
| isolamento | I | pergunta da B lida pelo comando no contexto da A, e a de 2025 do próprio aluno no ano em curso: nada lido nem gravado | `apps/api/src/tutor/tutor.int.test.ts` › "o comando relê a pergunta pelo id da execução, no escopo do aluno: a de outra escola e a do colega da mesma turma respondem como inexistente, e nenhum trecho é lido" e "o comando relê a pergunta pelo id da execução só no ano em curso: a pergunta de 2025 do próprio aluno responde como inexistente, e no ano dela a mesma leitura a acha" |
| a citação é conferida por quem grava | I | a página que o `preparar` não entregou é `IA_SAIDA_INVALIDA` no `concluir`, mesmo que a tarefa a deixasse passar; nada é gravado. Mutação: tirar o `exigirCitacoesEntregues` | `apps/api/src/tutor/tutor-modelo.int.test.ts` › "a citação que o `concluir` recebe é conferida contra os trechos que o `preparar` entregou, sem depender da tarefa: a página fora deles é IA_SAIDA_INVALIDA e nada é gravado; a entregue, grava" |
| recusa testada | I | as três formas de arrancar a resposta continuam recusadas | `apps/api/src/tutor/tutor.int.test.ts` › "pedido direto, palpite a confirmar e pedido fatiado em dois turnos: a resposta gravada não entrega, e o sinal nasce na questão em andamento"; `apps/api/src/tutor/tutor-modelo.int.test.ts` › "a recusa não depende do modelo" (os quatro casos, o fatiado e o que insiste) |

## Como testar

- D36: `apps/api/src/tutor/tutor.int.test.ts` › "recebe a mensagem fixa na hora, e o professor recebe o sinal sem referência e
  sem conteúdo" (l.310); para o "já encerrada", encerre a execução por SQL antes do `concluir` e chame o comando direto
- S12: › "abre entre o 202 e a execução: a execução falha com o código da pausa…" (l.523) e "a avaliação de outra turma da
  escola abre no meio…" (l.574); o caso entre o `preparar` e o `concluir` segura o adaptador falso numa barreira
- Contexto: › "o aluno transferido depois do 202 e antes de a execução rodar…" (l.932)
- Recusa: › "pedido direto, palpite a confirmar e pedido fatiado em dois turnos…" (l.279)
- Peças: `apps/api/test/escola-tutor.fixture.ts`; `WriteBlockTrigger` e `esperarNaTrava` (`apps/api/test/write-block-trigger.ts`)
- Comando: `npx vitest run --project integracao apps/api/src/tutor/tutor.int.test.ts`

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano. Na 4: o caso da D36 do modelo usa um texto que o `ehAssuntoDelicado` deixa passar.

### Respostas (plano da 2.0)

1. As cláusulas do diff estão na seção "Mutações": cada termo das condições compostas de `turno.command.ts` tem bloco ou motivo, e as cópias do mesmo código que passaram de `tutor.service.ts` (o alcance, o material, a memória, a questão sem gabarito) levam o mesmo tratamento. Cada chamada que confere (`avaliativaAberta` no `preparar` e no `concluir`, `exigirCitacoesEntregues`, `estaSuspensa`) e cada linha do `#encaminhar` (a referência tirada, o sinal) é um bloco.
2. Sem tela: não se aplica.
3. O segundo dado: o colega da mesma turma e o aluno de outra escola com execuções próprias lidas no contexto do aluno A (o `perguntaDaExecucao` não acha); uma execução com a pergunta **e** a resposta com o mesmo id (o filtro `autor = 'aluno'`); dois materiais de Química na escola (a busca filtrada pelo material aberto); a turma com Física **e** Química (a lista de disciplinas do modo livre); avaliação aberta em outra turma da escola (o turno conclui).
4. O caso cria a condição de que depende: a avaliação aberta entre o `202` e o `preparar`, e entre o `preparar` e o `concluir`, pelo `WriteBlockTrigger` que segura o adaptador falso no insert do `consumo_ia`; a execução encerrada por SQL antes do `concluir` do `assunto_delicado`; o `concluir` chamado duas vezes; a página aberta sem trecho, pelo `delete` do trecho; o texto da pergunta trocado no banco por um que o `ehAssuntoDelicado` não reconhece, para só o `tipo` gravado dizer que o turno foi delicado.
5. As asserções olham o que o banco tem e o que o modelo recebeu (o corpo do pedido), e não a forma do código; as de ausência esperam o `executor.ociosa()` ou o estado final da execução antes.
6. Sem guarda nova de lint; o teste estrutural novo é o do registro (`registro-de-comandos.test.ts`): toda tarefa do catálogo que alguém chama tem comando registrado, e o alvo que some reprova.
7. Comentários revistos: os de `execucao.scheduler.ts` (sem `ExecucaoRequest` com closure), do `tutor.service.ts` (o docblock da conferência em duas janelas), do `turno.command.ts`, do guia (item 3) e do `packages/core/src/ia/README.md` (o exemplo do `agendar`).
8. As divergências estão na seção própria e na `techspec.md` §5 ("O Tutor, como a 2.0 o fez"); o `prd.md` não diz o contrário.
9. Reaproveitado: `ExecucaoCommand`, `RegistroDeComandos`, `comRegistro`, `ExecucaoDaSessaoRepository.paraExecutar`, `TutorDoAlunoRepository`, `exigirCitacoesEntregues`, `sinaisDeTrabalhoDoTurno`, `SuspensaoDeFuncao`. O que moveu (o alcance, o contexto, os trechos, a memória, a questão sem gabarito) foi movido, e não copiado: o `TutorService` chama o `AlcanceDoAluno`.
10. A chave de envio duas vezes ao mesmo tempo segue coberta pelos casos de idempotência existentes (`tutor.int.test.ts`, `ia.int.test.ts`); o `concluir` duas vezes (a reentrega) tem o caso próprio da D36 repetida; a conclusão que perde para o prazo, o da D36 com a execução já encerrada.
11. Cada linha da tabela tem o caso na coluna "Caso".
12. Guardiões lidos: `tenancy-guardian` (o `perguntaDaExecucao` no escopo do aluno, `NAO_ENCONTRADO` igual), `conformidade-reviewer` (D36, S12, regra 70 itens 3 e 4: o tutor nunca fica sem supervisão, e o encaminhamento não some), `infra-guardian` (a fila `interativa`, o `runInContext`, nada em memória do processo que outra instância precise), `llm-integrator` (a entrada do modelo montada no `preparar`, o prompt não mudou, a citação conferida).

## Fora do escopo desta tarefa

O job e o worker (5.0); a mensagem fixa acima do "Tentar de novo" na tela (7.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| O alcance, o contexto, os trechos, a memória e a questão sem gabarito saem do `tutor.service.ts` para `turno.command.ts` (`AlcanceDoAluno`, `questaoSemGabarito`, `memoriaDoTrabalho`), e o `TutorService` passa a receber o `AlcanceDoAluno` no lugar de `TrechoSearch`, `SuspensaoDeFuncao` e o medidor | O `POST` e o `preparar` conferem o mesmo alcance, e duas cópias divergiriam: o `AlcanceDoAluno` é a uma só, que o service e o comando usam. O contador de recusas por falta de material da série foi com ele | `techspec.md` §5 "O Tutor, como a 2.0 o fez" |
| `perguntaDaChave(chaveEnvio)` vira `perguntaDaExecucao(execucaoId)` | O `ExecucaoCommand` recebe a execução, e não a chave: ler a pergunta pelo id da execução, no escopo do aluno, é o que o `preparar` pode fazer (a chave de outro aluno ou de outra escola não acha a linha) | `techspec.md` §5 "O Tutor, como a 2.0 o fez" |
| `tarefasSemComando` e `TAREFAS_SEM_CHAMADOR` entram em `registro-de-comandos.ts`; a exceção do `relatorio_da_correcao` é uma só, e o teste prova que nenhum arquivo da API a chama | A tarefa pede "toda `TarefaDeIa` tem comando, salvo o relatório da correção": sem a lista de exceções escrita e testada, a regra seria um comentário | `techspec.md` §5 "O Tutor, como a 2.0 o fez" |
| O `ia.int.test.ts` monta o `ExecucaoScheduler` com um registro de teste (`propor_ferramenta`, `turno_do_tutor`, `gerar_atividade_objetiva`) e o caso "tarefa sem comando roda pela closure" sai | Sem closure no `ExecucaoRequest`, não existe mais tarefa que rode sem comando: o caso testava o caminho que a tarefa remove. Os demais casos do arquivo seguem, com os ganchos do teste registrados pela chave de envio | `techspec.md` §5 "O Tutor, como a 2.0 o fez" |
| `turno.command.test.ts` novo, em unidade, para `questaoSemGabarito` e `memoriaDoTrabalho` | As duas funções passaram do service para o comando e têm cláusulas (o desempate por código, a questão fora da atividade) que o caso de integração não alcança com a mesma precisão | `techspec.md` §5 "O Tutor, como a 2.0 o fez" |

## Mutações

--faltando: 0 linhas (57 blocos, 10 motivos). Cada bloco foi aplicado e rodado antes do pedido (o teste citado, com o `-t` do caso): todos ficaram vermelhos num caso que rodou e falhou, e as asserções negativas (`toEqual([])` de sinal, `.not.toContain`, `rejects`, `toBeUndefined`) levam o `falha:`. Os blocos tiram cada termo das condições compostas, cada chamada que confere (`avaliativaAberta` no `preparar` e no `concluir`, `exigirCitacoesEntregues`, `estaSuspensa`), cada linha do `#encaminhar` e do `perguntaDaExecucao`, as chamadas `conferirOMaterial`, `#exigirMaterialDaSerie` e `#comAPaginaAberta`, o registro do comando no `tutor.module.ts` e as duas cláusulas do `tarefasSemComando`.

```mutacao
arquivo: apps/api/src/ia/registro-de-comandos.ts
teste: apps/api/src/ia/registro-de-comandos.test.ts › o alvo que some reprova
falha: tarefasSemComando(['turno_do_tutor'], [])
-  if (catalogo.length === 0) throw new InvariantException('o catálogo de tarefas de IA está vazio')
   if (registradas.length === 0) throw new InvariantException('nenhum comando registrado')
```

```mutacao
arquivo: apps/api/src/ia/registro-de-comandos.ts
teste: apps/api/src/ia/registro-de-comandos.test.ts › o alvo que some reprova
falha: tarefasSemComando([])
   if (catalogo.length === 0) throw new InvariantException('o catálogo de tarefas de IA está vazio')
-  if (registradas.length === 0) throw new InvariantException('nenhum comando registrado')
```

```mutacao
arquivo: apps/api/src/ia/registro-de-comandos.ts
teste: apps/api/src/ia/registro-de-comandos.test.ts › quem contorna reprova
falha: tarefa_inventada
-  if (registradas.some((tarefa) => !catalogo.includes(tarefa))) throw new InvariantException('comando registrado para tarefa fora do catálogo')
   return catalogo.filter
```

```mutacao
arquivo: apps/api/src/ia/registro-de-comandos.ts
teste: apps/api/src/ia/registro-de-comandos.test.ts › toda tarefa do catálogo que alguém chama
falha: tarefasSemComando(registradas)).toEqual([])
-  return catalogo.filter((tarefa) => !registradas.includes(tarefa) && !TAREFAS_SEM_CHAMADOR.includes(tarefa))
+  return catalogo.filter((tarefa) => !TAREFAS_SEM_CHAMADOR.includes(tarefa))
```

```mutacao
arquivo: apps/api/src/ia/registro-de-comandos.ts
teste: apps/api/src/ia/registro-de-comandos.test.ts › toda tarefa do catálogo que alguém chama
falha: tarefasSemComando(registradas)).toEqual([])
-  return catalogo.filter((tarefa) => !registradas.includes(tarefa) && !TAREFAS_SEM_CHAMADOR.includes(tarefa))
+  return catalogo.filter((tarefa) => !registradas.includes(tarefa))
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/turno.command.test.ts › soma acertos e erros por habilidade
-  return new Map(lido.success ? lido.data.questoes.map((questao) => [questao.habilidade.codigo, questao.habilidade]) : [])
+  return new Map([])
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/turno.command.test.ts › a questão que a atividade não tem
falha: questaoSemGabarito({ tipo: 'plano_de_aula' }, 1)).toBeUndefined()
-  const questao = lido.success ? lido.data.questoes[numero - 1] : undefined
+  const questao = lido.data.questoes[numero - 1]
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/turno.command.test.ts › a questão que a atividade não tem
falha: questaoSemGabarito(conteudo(['EM13CNT101']), 2)).toBeUndefined()
-  if (questao === undefined) return undefined
   return { numero, enunciado: questao.enunciado
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/turno.command.test.ts › o trabalho sem lote aprovado
-    if (trabalho.porHabilidade === null) continue
     const habilidades = habilidadesDaAtividade(trabalho.conteudo)
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/turno.command.test.ts › o trabalho sem lote aprovado
-      if (habilidade === undefined) continue
       const atual = soma.get(item.codigo)
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/turno.command.test.ts › soma acertos e erros por habilidade
-      const atual = soma.get(item.codigo) ?? { habilidade, acertos: 0, erros: 0 }
+      const atual = { habilidade, acertos: 0, erros: 0 }
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/turno.command.test.ts › soma acertos e erros por habilidade
-  return [...soma.values()].sort((a, b) => b.erros - a.erros || a.habilidade.codigo.localeCompare(b.habilidade.codigo)).slice(0, HABILIDADES_NA_MEMORIA_DA_TAREFA)
+  return [...soma.values()].sort((a, b) => a.habilidade.codigo.localeCompare(b.habilidade.codigo)).slice(0, HABILIDADES_NA_MEMORIA_DA_TAREFA)
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/turno.command.test.ts › soma acertos e erros por habilidade
-  return [...soma.values()].sort((a, b) => b.erros - a.erros || a.habilidade.codigo.localeCompare(b.habilidade.codigo)).slice(0, HABILIDADES_NA_MEMORIA_DA_TAREFA)
+  return [...soma.values()].sort((a, b) => b.erros - a.erros).slice(0, HABILIDADES_NA_MEMORIA_DA_TAREFA)
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/tutor.int.test.ts › o comando relê o contexto ao rodar
-    const turma = (await tutor.turmaDoAluno()) ?? naoEncontrado()
+    const turma = (await tutor.turmaDoAluno())!
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/tutor.int.test.ts › o aluno de outra turma e o de outra escola não referenciam a atividade
-    const atividade = pedido.atividadeAplicadaId === undefined ? undefined : ((await tutor.atividadeDaTurma(turma.turmaId, pedido.atividadeAplicadaId.toLowerCase())) ?? naoEncontrado())
+    const atividade = pedido.atividadeAplicadaId === undefined ? undefined : await tutor.atividadeDaTurma(turma.turmaId, pedido.atividadeAplicadaId.toLowerCase())
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/tutor.int.test.ts › grava a pergunta com a execução, responde por pergunta
-    if (atividade !== undefined && pedido.questao !== undefined && questaoSemGabarito(atividade.conteudo, pedido.questao) === undefined) naoEncontrado()
+    if (atividade !== undefined && pedido.questao !== undefined) naoEncontrado()
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/tutor.int.test.ts › grava a pergunta com a execução, responde por pergunta
-    if (atividade !== undefined && pedido.questao !== undefined && questaoSemGabarito(atividade.conteudo, pedido.questao) === undefined) naoEncontrado()
+    if (atividade !== undefined && questaoSemGabarito(atividade.conteudo, pedido.questao) === undefined) naoEncontrado()
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/tutor.int.test.ts › grava a pergunta com a execução, responde por pergunta
-    return { turma, ...(atividade === undefined ? {} : { atividade }) }
+    return { turma }
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/tutor.int.test.ts › o material de outra escola, o excluído e o de disciplina
-    const material = pedido.materialId === undefined ? undefined : ((await tutor.materialDaTurma(turma.turmaId, turma.serieId, this.trechos.hoje(), pedido.materialId.toLowerCase())) ?? naoEncontrado())
+    const material = pedido.materialId === undefined ? undefined : await tutor.materialDaTurma(turma.turmaId, turma.serieId, this.trechos.hoje(), pedido.materialId.toLowerCase())
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/tutor.int.test.ts › grava a pergunta com a execução, responde por pergunta
-    if (atividade !== undefined && material !== undefined && material.disciplinaId !== atividade.disciplinaId) naoEncontrado()
+    if (atividade !== undefined && material !== undefined) naoEncontrado()
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/tutor.int.test.ts › dúvida legítima de conteúdo não gera sinal
-    if (atividade !== undefined && material !== undefined && material.disciplinaId !== atividade.disciplinaId) naoEncontrado()
+    if (atividade !== undefined && material.disciplinaId !== atividade.disciplinaId) naoEncontrado()
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/tutor.int.test.ts › o material de outra escola, o excluído e o de disciplina
-    if (atividade !== undefined && material !== undefined && material.disciplinaId !== atividade.disciplinaId) naoEncontrado()
+    if (material !== undefined && material.disciplinaId !== atividade.disciplinaId) naoEncontrado()
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/tutor.int.test.ts › grava a pergunta com a execução, responde por pergunta
-    if (material !== undefined && pedido.pagina !== undefined && pedido.pagina > (material.paginas ?? 0)) naoEncontrado()
+    if (material !== undefined && pedido.pagina !== undefined) naoEncontrado()
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/tutor.int.test.ts › grava a pergunta com a execução, responde por pergunta
-    if (disciplinaId !== undefined && !(await this.trechos.existeMaterialDaSerie({ serieId: turma.serieId, disciplinaId }))) {
+    if (disciplinaId !== undefined) {
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/tutor-modelo.int.test.ts › sem atividade e sem material, o modelo recebe
-    if (disciplinaId !== undefined && !(await this.trechos.existeMaterialDaSerie({ serieId: turma.serieId, disciplinaId }))) {
+    if (!(await this.trechos.existeMaterialDaSerie({ serieId: turma.serieId, disciplinaId }))) {
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/tutor.int.test.ts › grava a pergunta com a execução, responde por pergunta
-    return { ...base, ...(material === undefined ? {} : { material }) }
+    return { ...base }
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/tutor-modelo.int.test.ts › o material aberto sem atividade
falha: expect(pedido).not.toContain(fisica)
-    let disciplina = alcance.atividade?.disciplina ?? alcance.material?.disciplina
+    let disciplina = alcance.atividade?.disciplina
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/tutor-modelo.int.test.ts › sem atividade e sem material, o modelo recebe
-    if (disciplina === undefined) {
+    if (disciplina === undefined && false as boolean) {
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/tutor-modelo.int.test.ts › sem atividade e sem material, o modelo recebe
-      disciplina = daTurma.length === 0 ? 'estudo' : listaEmPortugues.format(daTurma)
+      disciplina = 'estudo'
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/tutor.int.test.ts › o comando relê o contexto ao rodar
-    if (pergunta === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
     const pedidoGravado
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/tutor.int.test.ts › o comando relê o contexto ao rodar
-    const pedidoGravado = { ...(pergunta.atividadeAplicadaId === null ? {} : { atividadeAplicadaId: pergunta.atividadeAplicadaId }), ...(pergunta.materialId === null ? {} : { materialId: pergunta.materialId }) }
+    const pedidoGravado = { ...(pergunta.atividadeAplicadaId === null ? {} : { atividadeAplicadaId: pergunta.atividadeAplicadaId }) }
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/tutor-modelo.int.test.ts › a questão vai sem gabarito e sem explicação
-    const pedidoGravado = { ...(pergunta.atividadeAplicadaId === null ? {} : { atividadeAplicadaId: pergunta.atividadeAplicadaId }), ...(pergunta.materialId === null ? {} : { materialId: pergunta.materialId }) }
+    const pedidoGravado = { ...(pergunta.materialId === null ? {} : { materialId: pergunta.materialId }) }
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/tutor.int.test.ts › transferido para uma turma em prova entre o 202 e a execução
-    if (agora.turma.turmaId !== pergunta.turmaId) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
     // A avaliação que abriu
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/tutor.int.test.ts › abre entre o 202 e a execução: a execução falha com o código da pausa
falha: buscar.mock.calls.filter(([pedido]) => pedido.texto.includes(marca))).toEqual([])
-    if ((await tutor.avaliativaAberta(agora.turma.turmaId)) !== undefined) throw new DomainException(ErrorCode.TUTOR_PAUSADO_EM_AVALIACAO)
     const questao =
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/tutor-modelo.int.test.ts › a questão vai sem gabarito e sem explicação
-        ...(questao === undefined ? {} : { questao }),
+        ...{},
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/tutor-modelo.int.test.ts › o modelo classificou assunto delicado e a execução já foi encerrada
falha: respostasGravadas(aluno)).toEqual([MENSAGEM_DE_ASSUNTO_DELICADO])
-    if (saida.classificacao === 'assunto_delicado') return { tipo: 'mensagem_do_tutor', mensagemId: await this.#encaminhar(pergunta, saida) }
+    if (saida.classificacao === 'assunto_delicado') { const naConclusao = new TutorDoAlunoRepository(tx, this.relogio); const mensagemId = await naConclusao.gravarResposta(pergunta, { tipo: 'assunto_delicado', texto: saida.resposta }); await naConclusao.tirarReferenciaDaPergunta(pergunta.id); await naConclusao.gravarSinal(pergunta.execucaoId, pergunta.turmaId, { tipo: 'atencao_humana' }); return { tipo: 'mensagem_do_tutor', mensagemId } }
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/tutor-modelo.int.test.ts › o modelo classificou assunto delicado e a execução já foi encerrada
-      await tutor.tirarReferenciaDaPergunta(pergunta.id)
       await tutor.gravarSinal(pergunta.execucaoId, pergunta.turmaId, { tipo: 'atencao_humana' })
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/tutor-modelo.int.test.ts › o modelo classificou assunto delicado e a execução já foi encerrada
       await tutor.tirarReferenciaDaPergunta(pergunta.id)
-      await tutor.gravarSinal(pergunta.execucaoId, pergunta.turmaId, { tipo: 'atencao_humana' })
       return mensagemId
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/tutor-modelo.int.test.ts › abre entre a execução e a conclusão: o modelo respondeu
falha: execucaoLida(execucaoId)).toEqual([pausada])
-    if ((await tutor.avaliativaAberta(pergunta.turmaId)) !== undefined) throw new DomainException(ErrorCode.TUTOR_PAUSADO_EM_AVALIACAO)
     exigirCitacoesEntregues
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/tutor.int.test.ts › com os sinais suspensos, os de aprendizagem param
falha: expect(await sinaisDe(aluno)).toEqual([])
-    if (await this.suspensao.estaSuspensa(FUNCAO_DOS_SINAIS)) return mensagemId
+    if (false as boolean) return mensagemId
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/tutor.int.test.ts › dúvida legítima de conteúdo não gera sinal
falha: filter((sinal) => sinal.tipo === 'resposta_pronta')).toEqual([])
-    if (saida.classificacao === 'pediu_resposta_pronta' && pergunta.atividadeAplicadaId !== null && pergunta.questao !== null) {
+    if (pergunta.atividadeAplicadaId !== null && pergunta.questao !== null) {
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/tutor.int.test.ts › sem questão em andamento o sinal não nasce
falha: expect(await sinaisDe(aluno)).toEqual([])
-    if (saida.classificacao === 'pediu_resposta_pronta' && pergunta.atividadeAplicadaId !== null && pergunta.questao !== null) {
+    if (saida.classificacao === 'pediu_resposta_pronta' && pergunta.atividadeAplicadaId !== null) {
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/tutor-modelo.int.test.ts › o material aberto sem atividade
-    const disciplinaId = alcance.atividade?.disciplinaId ?? alcance.material?.disciplinaId
-    if (disciplinaId === undefined) return []
+    const disciplinaId = alcance.atividade?.disciplinaId
+    if (disciplinaId === undefined) return []
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/tutor-modelo.int.test.ts › sem atividade e sem material, o modelo recebe
-    if (disciplinaId === undefined) return []
     const achados = await this.trechos.buscar({
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/tutor-modelo.int.test.ts › o material aberto sem atividade
-      ...(alcance.material === undefined ? {} : { materialId: alcance.material.id }),
+      ...{},
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/tutor-modelo.int.test.ts › a página aberta sem trecho indexado
-    if (aberta === undefined) return achados
     return [aberta
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/tutor-modelo.int.test.ts › o material aberto sem atividade
-    return [aberta, ...achados.filter((trecho) => !(trecho.materialId === aberta.materialId && trecho.pagina === aberta.pagina))].slice(0, TRECHOS_NO_TURNO)
+    return [aberta, ...achados.filter((trecho) => !(trecho.materialId === aberta.materialId))].slice(0, TRECHOS_NO_TURNO)
```

```mutacao
arquivo: apps/api/src/tutor/tutor.repository.ts
teste: apps/api/src/tutor/tutor.int.test.ts › o comando relê a pergunta pelo id da execução
falha: rejects.toMatchObject
-      .where(and(this.#doAluno(), eq(mensagemTutor.autor, 'aluno'), eq(mensagemTutor.execucaoId, execucaoId)))
+      .where(and(eq(mensagemTutor.autor, 'aluno'), eq(mensagemTutor.execucaoId, execucaoId)))
```

```mutacao
arquivo: apps/api/src/tutor/tutor.repository.ts
teste: apps/api/src/tutor/tutor.int.test.ts › o comando relê a pergunta pelo id da execução
-      .where(and(this.#doAluno(), eq(mensagemTutor.autor, 'aluno'), eq(mensagemTutor.execucaoId, execucaoId)))
+      .where(and(this.#doAluno(), eq(mensagemTutor.execucaoId, execucaoId)))
```

```mutacao
arquivo: apps/api/src/tutor/tutor.repository.ts
teste: apps/api/src/tutor/tutor.int.test.ts › o comando relê a pergunta pelo id da execução
falha: rejects.toMatchObject
-      .where(and(this.#doAluno(), eq(mensagemTutor.autor, 'aluno'), eq(mensagemTutor.execucaoId, execucaoId)))
+      .where(and(this.#doAluno(), eq(mensagemTutor.autor, 'aluno')))
```

```mutacao
arquivo: apps/api/src/tutor/tutor.service.ts
teste: apps/api/test/leitura-por-serie.int.test.ts › o Tutor devolve a execução já aceita quando o material aberto
-    const alcance = jaAceita === undefined ? await this.alcanceDoAluno.doMaterial(daTurma, pedido) : daTurma
+    const alcance = await this.alcanceDoAluno.doMaterial(daTurma, pedido)
```

```mutacao
arquivo: apps/api/src/tutor/tutor.service.ts
teste: apps/api/src/tutor/tutor.int.test.ts › o aluno de outra turma e o de outra escola não referenciam a atividade
-    const alcance = await this.alcanceDoAluno.alcance(atividadeAplicadaId === undefined ? {} : { atividadeAplicadaId })
+    const alcance = await this.alcanceDoAluno.alcance({})
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/test/leitura-por-serie.int.test.ts › o único material da série sai entre o 202 e a conferência
     const disciplinaId = atividade?.disciplinaId ?? material?.disciplinaId
-    await this.#exigirMaterialDaSerie(turma, disciplinaId)
     return { ...base, ...(material === undefined ? {} : { material }) }
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/tutor.int.test.ts › o material de outra escola, o excluído e o de disciplina
-    conferirOMaterial(atividade, material, pedido)
     const disciplinaId = atividade?.disciplinaId ?? material?.disciplinaId
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/tutor-modelo.int.test.ts › o material aberto sem atividade
-    return this.#comAPaginaAberta(pergunta, alcance, disciplinaId, achados)
+    return achados
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/tutor-modelo.int.test.ts › a citação que o `concluir` recebe é conferida contra os trechos que o `preparar` entregou
falha: concluir([{ ...citacao, pagina: 5 }], [entregue])).rejects
     if ((await tutor.avaliativaAberta(pergunta.turmaId)) !== undefined) throw new DomainException(ErrorCode.TUTOR_PAUSADO_EM_AVALIACAO)
-    exigirCitacoesEntregues(saida.citacoes, entregues)
     return { tipo: 'mensagem_do_tutor', mensagemId: await this.#gravarTurno(tutor, pergunta, saida) }
```

```mutacao
arquivo: apps/api/src/tutor/tutor.module.ts
teste: apps/api/src/ia/registro-de-comandos.test.ts › toda tarefa do catálogo que alguém chama
-         useFactory: (banco: Database, alcance: AlcanceDoAluno, trechos: TrechoSearch, suspensao: SuspensaoDeFuncao, registro: RegistroDeComandos) => comRegistro(registro, new TurnoDoTutorCommand(banco, alcance, trechos, suspensao)),
+         useFactory: (banco: Database, alcance: AlcanceDoAluno, trechos: TrechoSearch, suspensao: SuspensaoDeFuncao, registro: RegistroDeComandos) => new TurnoDoTutorCommand(banco, alcance, trechos, suspensao),
```

Termos e linhas sem bloco próprio, com o motivo de cada um (o `--faltando` lista só as duas primeiras colunas de cada linha). Os mutantes equivalentes foram aplicados e ficaram verdes, e é por isso que têm motivo e não bloco.

| Termo ou linha de `turno.command.ts` | Motivo |
|---|---|
| `atividade !== undefined` (na conferência da questão) | O contrato recusa questão sem atividade (`ENTRADA_INVALIDA`, caso "recusa o corpo fora do contrato"): se `pedido.questao` existe, a atividade existe, e o termo seguinte (`pedido.questao !== undefined`) já a implica. O termo `pedido.questao !== undefined` e o `questaoSemGabarito(...) === undefined` têm bloco |
| `material !== undefined` (na conferência da página) | O contrato recusa página sem material: se `pedido.pagina` existe, o material existe. Sem o termo, o resultado é o mesmo em todo pedido que o contrato aceita |
| `pedido.pagina !== undefined` | Sem o termo, a conta é `undefined > paginas`, que é falsa: o resultado é o mesmo. O termo `pedido.pagina > (material.paginas ?? 0)` é o que tem bloco |
| A linha `const disciplinaId = atividade?.disciplinaId ?? material?.disciplinaId` de `doMaterial` (o `??`) | Equivalente: o material que o `materialDaTurma` achou passa na conferência da série do `existeMaterialDaSerie`, que lê o mesmo filtro (série, estado, licença vigente: uma cópia só em `material.repository.ts`). Sem o `?? material?.disciplinaId` o material sem atividade pularia uma conferência que sempre passaria. A cópia da linha em `contexto` e em `#trechosDoTurno` (o mesmo `??`) tem bloco, e o caso do material sem atividade fica vermelho |
| `agora.atividade === undefined` | Equivalente: `pergunta.questao` só existe com atividade (o contrato e a coluna da pergunta), e o termo `pergunta.questao === null` decide antes |
| `pergunta.questao === null` | Equivalente: `questaoSemGabarito(conteudo, null)` lê a posição `-1` das questões e devolve `undefined`, o mesmo que o termo decide |
| `pergunta.atividadeAplicadaId !== null` (no sinal `resposta_pronta`) | Estreitamento de tipo para o compilador, e equivalente: a questão em andamento (`pergunta.questao !== null`) só existe com atividade. Os termos `saida.classificacao === 'pediu_resposta_pronta'` e `pergunta.questao !== null` têm bloco |
| `alcance.material === undefined` (na página aberta) | Estreitamento de tipo para o compilador: página aberta só existe com material (o contrato), então `pergunta.pagina === null` já cobre o caso sem material |
| `pergunta.pagina === null` (na página aberta) | Equivalente: sem o termo, o material sem página aberta procura a página `null` entre as do material, não acha, e devolve os mesmos `achados` |
| `trecho.materialId === aberta.materialId` (na deduplicação) | Equivalente: a busca leva o `materialId` do material aberto, então todo `achados` é do mesmo material da `aberta`, e só a página distingue. O termo `trecho.pagina === aberta.pagina` e a remoção do filtro inteiro (o caso do material aberto sem atividade) têm bloco |

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| infra-guardian (1ª), conformidade-reviewer (1ª), revisor-geral (1ª), llm-integrator (1ª) | A transação própria da D36 abre dentro da transação de conclusão e ocupa duas conexões do pool; separar um passo "antes da conclusão" no `ComandoExecutavel`, fora do `gravar` | Muda o contrato do `ComandoExecutavel` e o desenho do `concluir`. Destino: tarefa 5.0 (a IA vai ao worker, e a reentrega passa a existir; ela já tem o caso "pool" na tabela). Os quatro dizem que o risco é latente |
| infra-guardian (1ª), llm-integrator (1ª) | Cenário de carga do Tutor com uma fração de turnos de `assunto_delicado`; teste de pool pequeno ou linha no runbook | Destino: tarefa 11.0 (a carga da manhã mede a espera por conexão do pool) |
| conformidade-reviewer (1ª) | Conferir na 7.0 que a mensagem fixa aparece acima do "Tentar de novo" | Destino: tarefa 7.0 (é a tela do "Tentar de novo") |
| revisor-geral (1ª) | Mover a `AlcanceDoAluno` para `tutor/alcance-do-aluno.ts` | Arquivo novo fora de "Arquivos previstos", e a Tech Spec §5 registra a peça em `turno.command.ts`. Destino: `TODO.md` |
| revisor-geral (1ª) | `tarefasSemComando` e `TAREFAS_SEM_CHAMADOR` exportados pela produção e usados só pelos testes: a subida confere o registro, ou eles vão para o teste | Muda o contrato registrado na Tech Spec §5 (divergência já resolvida). Destino: `TODO.md` |
| revisor-geral (1ª) | A leitura dos módulos no teste casa `comRegistro(registro, new X(` com expressão regular | Recusada: o próprio revisor diz que o caso de `ia.int.test.ts` sobre a API montada cobre o buraco, e o bloco de `tutor.module.ts` prova que o teste lê o módulo real |
| test-engineer (1ª) | `tarefasRegistradasPelosModulos` instancia cada comando sem argumentos: um comentário no `*.command.ts` sobre esse contrato | O comentário do teste ("Os construtores só guardam o que recebem") já diz o contrato. Destino: `TODO.md`, para quando um construtor passar a validar o que recebe |
| privacy-guardian (1ª) | Teste do aluno eliminado entre o `preparar` e o `concluir` com `assunto_delicado` | Precisa de barreira e eliminação no meio, mais que poucas linhas; hoje a chave estrangeira garante. Destino: tarefa 5.0 (reentrega e job) |
| llm-integrator (1ª) | Teste de transferência para turma que não está em prova, para isolar o `turmaId !== pergunta.turmaId` | O mutante "transferido" já cobre a cláusula, como o próprio revisor diz; opcional. Recusada, com esse motivo |
| tenancy-guardian (2ª), revisor-geral (2ª) | Em `tutor.int.test.ts:1083`, o `rejects` do `comando.preparar` não prova a cláusula do ano (a turma de 2025 já falharia o alcance); dizer no comentário do teste que a prova é a asserção direta das linhas 1082 e 1084, ou trocar a asserção | `TODO.md`: comentário de teste, sem mudar comportamento. A prova do ano está nas linhas 1082 e 1084, que os dois revisores conferiram |
| infra-guardian (2ª), revisor-geral (2ª) | Com o `Promise.all`, o caso da D36 repetida ocupa até quatro conexões do pool da bancada; conferir o tamanho do pool para o teste não ficar instável | Tarefa 5.0 (a transação própria da D36 e o caso "pool"), o mesmo destino da rodada 1 |
| infra-guardian (2ª), llm-integrator (2ª) | Tirar a transação da D36 de dentro da conclusão; cenário de carga com turnos de `assunto_delicado`; reavaliar a corrida sem trava quando o worker separar a reentrega | Tarefas 5.0 e 11.0, já na tabela da rodada 1 |
| conformidade-reviewer (2ª), privacy-guardian (2ª) | Registrar na AIA do Tutor que, com o aluno transferido, o aviso da D36 pode chegar ao professor da turma antiga | `TODO.md`: a AIA do Tutor não é desta tarefa (o docblock do `#encaminhar` já diz) |
| llm-integrator (2ª) | Quando houver adaptador falso que registre o pedido recebido, cobrir o aluno e a turma que o comando passa ao modelo | `TODO.md`, para a tarefa que criar esse adaptador |
| privacy-guardian (2ª) | Confirmar que o `tsconfig` do portão inclui os `*.test.ts` de `apps/api` (os `@ts-expect-error` só o `tsc` vê) | Recusada: o `test-engineer` conferiu na rodada 1 que `apps/api/tsconfig.json` inclui `src`, e o portão de agora passou |
| privacy-guardian (2ª) | Aluno eliminado entre o `preparar` e o `concluir` com `assunto_delicado` | Tarefa 5.0, já na tabela da rodada 1 |
| test-engineer (2ª) | O `Promise.all` roda depois de o turno já ter gravado; falta a corrida das duas primeiras gravações de `assunto_delicado` (o job em dois workers) | Tarefa 5.0 (reentrega e job, D49) |
| test-engineer (2ª) | O bloco de mutação que tira o `anoLetivoId` do `perguntaDaExecucao` poderia citar também o caso novo do ano em `tutor.int.test.ts` | `TODO.md`: ajuste de documento, e o bloco já tem teste que o pega |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-15 18:43:50 | 2026-11-15 18:44:07 | `infra-guardian` | 2 | APROVADO | afaee9c55f05fa4b4 |
| 2026-11-15 18:43:43 | 2026-11-15 18:44:07 | `tenancy-guardian` | 2 | APROVADO | af1dd614bfbb20d78 |
| 2026-11-15 18:43:54 | 2026-11-15 18:44:08 | `llm-integrator` | 2 | APROVADO | ab5e3a6005a86ccc8 |
| 2026-11-15 18:43:46 | 2026-11-15 18:44:09 | `conformidade-reviewer` | 2 | APROVADO | adfaf9e58f42682cb |
| 2026-11-15 18:44:06 | 2026-11-15 18:44:24 | `privacy-guardian` | 2 | APROVADO | ac7cf4d57deebce67 |
| 2026-11-15 18:44:02 | 2026-11-15 18:44:26 | `revisor-geral` | 2 | APROVADO | adb869fd758b60ac8 |
| 2026-11-15 18:43:59 | 2026-11-15 18:45:05 | `test-engineer` | 2 | APROVADO | a41456bfa25bfb04d |
