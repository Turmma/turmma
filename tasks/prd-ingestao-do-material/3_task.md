# Tarefa 3.0 — A operação lista, reprocessa e descarta job (46.0), e o alerta `pdf-parado` avisa

**Funcionalidade:** ingestao-do-material · **Depende de:** 1.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

A equipe lista, reprocessa e descarta job que falhou, com chamado e auditoria, sem ver `dados`; o alerta `pdf-parado`
dispara quando a fila `pdf` para.

## Contexto necessário

- `techspec.md` §2, §6, §7 (auditoria), §7c (alerta), §11 (o `pdf-esperando` não nasce)
- `prd.md` RF13, RF15
- `tasks/prd-reengenharia/onda-3b.md` "T5 — listar, reprocessar e descartar (46.0)": é o desenho dos comandos
- `cenarios.md` "Extração no worker" e "Fila `pdf`"
- `.claude/rules/` 10, 20, 40, 80
- Código: `apps/api/src/ops/command.ts`, `apps/api/src/ops/retencao.ts`, `apps/api/src/ops/revogar-acessos-sala.ts`; `infra/grafana/alertas/importacao-parada.yaml`;
  `infra/scripts/ensaio-alertas.ts`

## Subtarefas

- [x] 3.1 — `operacao/jobs-que-falharam.repository.ts`: listar e ler por id com `@Unscoped` e motivo; marcar no contexto da escola da linha
- [x] 3.2 — `ops:jobs-que-falharam`, `ops:reprocessar-job <id> --chamado <n>`, `ops:descartar-job <id> --chamado <n>`, com `where estado = 'falhou'`; reprocessar recusa `ia.*`, `titular.*` e `material.extrair-pdf` ("Tentar de novo é envio novo"); descartar recusa `ia.*` e `titular.*`; o descarte do PDF deixa o material `falhou` e apaga o objeto
- [x] 3.3 — `job.reprocessado` e `job.descartado` em `packages/core/src/auditoria/acoes.ts`, `z.strictObject`, nunca `dados`
- [x] 3.4 — Os comandos no `package.json` e no `docs/runbook.md`
- [x] 3.5 — Alerta `infra/grafana/alertas/pdf-parado.yaml`: o job `pdf` mais antigo pendente há mais de 15 min **e** nenhuma extração terminada (`pronto` ou `falhou`) nos últimos 15; no `ensaio-alertas.ts`; seção no runbook
- [x] 3.6 — `docs/infra.md`: o disco do temporário no pior caso, cerca de 60 GB (R6)
- [x] 3.7 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/src/operacao/jobs-que-falharam.repository.ts`, `apps/api/src/ops/jobs-que-falharam.ts`, `apps/api/src/ops/reprocessar-job.ts`, `apps/api/src/ops/descartar-job.ts`, `apps/api/test/ops-jobs.int.test.ts` | novo |
| `apps/api/src/ops/command.ts`, `packages/core/src/auditoria/acoes.ts`, `package.json`, `docs/runbook.md`, `docs/infra.md` | alterado |
| `infra/grafana/alertas/pdf-parado.yaml`, `infra/test/alerta-do-pdf-parado.int.test.ts` | novo |
| `infra/scripts/ensaio-alertas.ts`, `infra/test/alertas.int.test.ts`, `infra/test/alertas.test.ts`, `tools/guardas/alerta-tem-runbook.test.ts`, `tools/guardas/escopo-dos-repositories.ts`, `tools/guardas/repositories-com-escopo.test.ts`, `tools/testes/promql.ts`, `apps/api/src/ops/armazem-de-operacao.ts`, `apps/api/src/ops/fila-de-jobs.ts`, `packages/core/src/auditoria/acoes.test.ts`, `docs/lgpd.md`, `tasks/prd-ingestao-do-material/cenarios.md` | novo e alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| Reprocessar um tipo aceito | I | o job conclui, a cópia `failed` sai e a reconciliação não republica | `ops-jobs.int.test.ts` › "um tipo aceito: a cópia failed sai, o job conclui, e a reconciliação não o republica nem o dá por falho"; "a chave de idempotência já tomada…"; "a fila ainda tem o job como ativo…" |
| concorrência: dois reprocessar em `Promise.all` | P | só um reprocessa | › "concorrência: dois comandos sobre o mesmo job, em Promise.all, e só um reprocessa" |
| recusa de `ia.*` | I | recusado. Mutação: tirar o tipo da lista | › "recusa %s: o comando não toca a fila, e a linha segue falhou" (`ia.gerar-atividade`, `ia.responder-tutor`); e no descartar "recusa %s: a linha segue falhou" |
| recusa de `titular.*` | I | recusado | › "recusa %s: o pedido do titular foi enfileirado uma vez só…" (`titular.montar-arquivo`, `titular.eliminar`) |
| recusa de `material.extrair-pdf` | I | "Tentar de novo é envio novo" | › "recusa material.extrair-pdf com \"Tentar de novo é envio novo\"…" |
| Descartar o PDF | I | material `falhou`, objeto apagado, no contexto da escola do job | › "o PDF: o material fecha em falhou, o objeto sai do storage…"; "o storage que recusa o apagar…"; "o material que já saiu de processando não é tocado…" |
| Descartar `retencao.*` | I | descarta | › "%s descarta: a linha sai, com a auditoria da escola"; "só o job de PDF mexe no material…" |
| Reprocessar e descartar `sistema.*` (sem escola) | I | recusados antes de tocar a linha, até a 5.0 (`techspec.md` §11, linha "3.0"). Mutação: tirar a recusa | › "job sem escola (sistema.*): recusado antes de tocar a linha, a fila e a auditoria" (reprocessar) e "…recusado, a linha segue falhou" (descartar) |
| Descartar um job `aguardando` | I | recusado; linha, material e objeto intactos. Mutação: tirar `where estado = 'falhou'` | › "job %s: recusado; a linha, o material e o objeto ficam intactos" (`aguardando`, `publicado`, `ativo`); "o repository: a condição do estado e o escopo, cada um por si" |
| `--chamado` 0, negativo, texto | I | recusado antes de tocar a linha (um caso cada) | › "%s: recusado antes de tocar a linha, nos dois comandos" (`0`, `negativo`, `texto`); `jobs-que-falharam.test.ts` › `lerPedidoDeJob` |
| Auditoria | I | `job.reprocessado` e `job.descartado` com o chamado; uma sentinela em `dados` fora da saída, da auditoria e do log | › "uma sentinela em dados fica fora da saída, do erro e da auditoria, nos dois comandos"; `acoes.test.ts` › "%s leva o tipo de lista fechada e o chamado inteiro positivo…" |
| isolamento: o descarte marca só na escola da linha | I | o material da B com o mesmo id de job não muda. Mutação: marcar fora do contexto | › "isolamento: o descarte marca só na escola do job…"; "o repository: a condição do estado e o escopo, cada um por si" |
| a listagem | I | traz id, escola, tipo, código e data, e nunca `dados` | › "traz id, escola, tipo, fila, código e data dos que falharam, de todas as escolas, e nunca o dados" |
| `pdf-parado`: primeiro job depois de horas sem PDF | I | não dispara | `alerta-do-pdf-parado.int.test.ts` › "o primeiro job depois de horas sem PDF espera segundos…" |
| `pdf-parado`: 300 pendentes com extrações terminando, inclusive `falhou` | I | não dispara | › "o termo das extrações: com `falhou` terminando…" e "…com `pronto` terminando…" (o job parado espera há 16 min, e quatro extrações terminam); "o objeto ausente não é extração terminada…" |
| `pdf-parado`: `worker-pdf` parado e job pendente há 16 min | I | dispara | › "o worker-pdf parado e o job pendente há 16 min: a expressão passa do limiar e o Grafana dispara" |
| o alerta no ensaio | I | `ensaio:alertas` leva `pdf-parado` a disparado | `infra/test/alertas.int.test.ts` › "caminho feliz: `ensaio:alertas` leva as regras do ensaio a disparadas…" (o `pdfParado` está em `REGRAS_DO_ENSAIO`); `alertas.test.ts` confere a expressão, o `for`, o limiar e o job do ensaio |
| log novo dos comandos | I | ids, tipo, código e chamado; nunca `dados` | › "uma sentinela em dados fica fora da saída…"; os comandos não gravam log, só o terminal e a auditoria |

## Como testar

- Comando: `apps/api/src/ops/revogar-acessos-sala.test.ts` › "sem OPERADOR, ou fora do formato, sai com 2…", `apps/api/test/ops-revogar-acessos-sala.int.test.ts` › "E29: revoga todos os vigentes de A na hora…"
- Não há reprocessar nem descartar hoje (`docs/runbook.md:86` descreve o manual): o mais próximo é a reconciliação em `packages/core/src/queue/`
- Alerta: `infra/test/alertas.int.test.ts` › "caminho feliz: `ensaio:alertas` leva as regras do ensaio a disparadas…"
- Comandos: `npx vitest run --project integracao apps/api/test/ops-jobs.int.test.ts`; `npx vitest run --project infra infra/test/alertas.int.test.ts`
- Armadilha: o alerta tem dois termos e o "terminada" vale para `pronto` e para `falhou`, cada termo com um caso que o derruba

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano. Na 1: cada tipo da
lista de recusa é um bloco, e o SQL da regra do alerta também.

**Plano.** `JobsQueFalharamRepository` (`@Unscoped`, só leitura: `listar` e `travarFalho`, sem `dados` além do id do material) e, no `JobOutboxRepository`, `reabrirFalho` e `descartarFalho`, que marcam no contexto da escola da linha. Três comandos em `apps/api/src/ops/`, com o leitor de argumentos e a recusa por tipo em `jobs-que-falharam.ts`. O `reprocessar-job` tira a cópia `failed` do BullMQ (`fila-de-jobs.ts`) dentro da transação, com a linha travada, e a linha volta a `aguardando`; o `descartar-job` fecha o material do PDF na transação e, depois do commit, apaga o objeto. `job.reprocessado` e `job.descartado` na auditoria da escola, com o chamado. O alerta `pdf-parado` (yaml, ensaio, runbook) e a nota dos 60 GB em `docs/infra.md`. O job `sistema.*` é recusado até a 5.0, como a divergência resolvida acima diz.

1. **Mutação de cada cláusula.** Na seção "Mutações": o estado e o escopo de `travarFalho`, `reabrirFalho` e `descartarFalho`, cada campo que `reabrirFalho` zera, cada prefixo e cada tipo da recusa, o tipo desconhecido e o job sem escola, o formato do `--chamado` (o começo e o tamanho), cada termo do `terminarComErro` e do `instanceof` do código de saída, o material que só o PDF mexe, o `materialFechado`, o objeto e o `catch` do storage, o prefixo e as duas condições da fila de operação, o `strictObject`, o enum e o `int().positive()` do chamado, e no alerta cada `resultado` do contador, cada termo da expressão, o `or vector(0)`, a janela, o `for` e o limiar.
2. **O texto na tela.** A tarefa não tem tela: não se aplica.
3. **O segundo dado.** O job da escola B existe nos casos de isolamento (o `reabrirFalho` e o `descartarFalho` com a B no contexto; o descarte da A com o `materialId` de um material da B), e a listagem traz os jobs das duas escolas, o `sistema.*` e o pendente que não entra.
4. **Checagem anterior que responde antes.** `travarFalho` e o `UPDATE`/`DELETE` condicionam ao `falhou`, e o `NAO_ENCONTRADO` do comando sai de um ou do outro: o caso do repository chama `reabrirFalho` e `descartarFalho` direto com o job `aguardando`, e o `travarFalho` direto, para cada condição cair sozinha.
5. **Resultado, e não forma.** Os casos olham a linha de `job_registro`, a cópia na fila (`getJob`), o material, o objeto no armazém, a auditoria e a saída do terminal; nenhum compara texto de SQL.
6. **Guarda nova.** Nenhuma regra de lint nem teste estrutural nasce aqui. A guarda `alerta-tem-runbook` e `repositories-com-escopo` pegam o alerta e os dois `@Unscoped` (o terceiro seria o sinal de desenho errado).
7. **Comentários.** Os docblocks dos três comandos e do repository dizem o que o código faz: a recusa por tipo, a ordem (fila, linha, auditoria), o que fica se o storage falha, e o `sistema.*` recusado até a 5.0.
8. **Divergências.** A do `sistema.*`, na tabela acima, com o lugar da spec.
9. **Peça que já existe.** `autorDoComando`, `lerOperador`, `abrirBancoDeOperacao` e o padrão de `ops-revogar-acessos-sala.int.test.ts`; `QueueFixtures` (despachante, worker, `OutboxSweeper`), `InMemoryFileStorage`, `ExtracaoDoMaterialRepository.marcarFalhou` e `marcarObjetoApagado` da 1.0, e `SessaoFixtures` e `recriarDoZero` do teste de infra.
10. **Concorrência.** O caso `Promise.all` de dois `reprocessar` sobre o mesmo job: só um reprocessa, uma auditoria; e a reconciliação roda depois do reprocesso e não republica nem dá o job por falho.
11. **Isolamento e coluna "Caso".** Os casos de isolamento estão no repository (a escola B no contexto) e no descarte do PDF (o material da B com o mesmo id); a coluna "Caso" da tabela de testes acima nomeia o caso de cada linha.
12. **Guardiões.** `tenancy`: dois `@Unscoped` com motivo, escopo no `JobOutboxRepository`, escola do contexto na marcação, `NAO_ENCONTRADO` igual para job inexistente, de outra escola e fora do estado. `privacy`: o `dados` nunca sai (terminal, auditoria, log), o objeto do material sai do storage, o `docs/lgpd.md` diz o que acontece com o objeto de job falho e o que nunca rodou. `infra`: o alerta com dois termos, o disco dos 60 GB, o `ensaio:alertas` e o runbook.

## Fora do escopo desta tarefa

A vaga por escola e o `lockDuration` (1.0); a carga (9.0).

## Divergências resolvidas nesta tarefa

| Divergência | Resolução | Onde está na spec |
|---|---|---|
| O job `sistema.*` não tem escola, e o check `auditoria_escola_ou_operacao_global` só aceita sem escola `rede` e `suboperador` | A 3.0 não tem migration (corre com a 2.0 e a 4.0): `ops:reprocessar-job` e `ops:descartar-job` recusam o job sem escola antes de tocar a linha, com `JobSemEscolaError`. A migration do check e a retirada da recusa são da 5.0 (5.8), junto do expurgo de jobs que deixa o `falhou` de `material.extrair-pdf` até o Descartar | `techspec.md` §7 ("Retenção e expurgo") e §11, linha "3.0" |

## Mutações

--faltando: 7 linhas (66 blocos, 10 motivos)

Um bloco por cláusula: o repository da operação e o do outbox (o estado, o escopo, cada campo que `reabrirFalho` zera), o leitor de argumentos e a recusa por tipo (cada prefixo, o tipo do PDF, o tipo desconhecido, o job sem escola), o `terminarComErro` (cada termo), os dois comandos (o material que só o PDF mexe, o `materialFechado`, o objeto), a fila de operação (o prefixo, a cópia ausente, o estado diferente de `failed`), a auditoria (o `strictObject`, o tipo, o chamado) e a regra do alerta (cada termo e cada `resultado`; o `for` e o limiar). Os blocos da regra rodam o teste de infra, que sobe o compose: são os mais lentos.

```mutacao
arquivo: apps/api/src/operacao/jobs-que-falharam.repository.ts
teste: apps/api/test/ops-jobs.int.test.ts › traz id, escola, tipo, fila, código e data
falha: toEqual([daA, daB, semEscola, semData].sort())
-const linhas = await this.banco.select(CAMPOS).from(jobRegistro).where(eq(jobRegistro.estado, 'falhou')).orderBy(desc(jobRegistro.concluidoEm)).limit(LIMITE_DA_LISTA_DE_JOBS_QUE_FALHARAM)
+const linhas = await this.banco.select(CAMPOS).from(jobRegistro).orderBy(desc(jobRegistro.concluidoEm)).limit(LIMITE_DA_LISTA_DE_JOBS_QUE_FALHARAM)
```

```mutacao
arquivo: apps/api/src/operacao/jobs-que-falharam.repository.ts
teste: apps/api/test/ops-jobs.int.test.ts › travarFalho só acha o job falhou
falha: travarFalho(pendente)
 .from(jobRegistro)
-.where(and(eq(jobRegistro.id, id), eq(jobRegistro.estado, 'falhou')))
+.where(eq(jobRegistro.id, id))
```

```mutacao
arquivo: apps/api/src/operacao/jobs-que-falharam.repository.ts
teste: apps/api/test/ops-jobs.int.test.ts › job que não existe e job que não falhou
falha: job não encontrado entre os que falharam
-if (linha === undefined) return undefined
```

```mutacao
arquivo: apps/api/src/operacao/jobs-que-falharam.repository.ts
teste: apps/api/test/ops-jobs.int.test.ts › o PDF: o material fecha em falhou
falha: materialFechado: true
-const materialId = typeof dados['materialId'] === 'string' ? dados['materialId'] : null
+const materialId = null
```

```mutacao
arquivo: packages/core/src/queue/job-outbox.repository.ts
teste: apps/api/test/ops-jobs.int.test.ts › reabrirFalho e descartarFalho só mudam
falha: outro.reabrirFalho(pendente)
 .set({ estado: 'aguardando', codigoFalha: null, concluidoEm: null, iniciadoEm: null, reservadoAte: null, criadoEm: sql`now()` })
-.where(and(eq(jobRegistro.id, id), jobScopeInContext(), eq(jobRegistro.estado, 'falhou')))
+.where(and(eq(jobRegistro.id, id), jobScopeInContext()))
```

```mutacao
arquivo: packages/core/src/queue/job-outbox.repository.ts
teste: apps/api/test/ops-jobs.int.test.ts › reabrirFalho e descartarFalho só mudam
falha: outro.reabrirFalho(falhoDaA)
 .set({ estado: 'aguardando', codigoFalha: null, concluidoEm: null, iniciadoEm: null, reservadoAte: null, criadoEm: sql`now()` })
-.where(and(eq(jobRegistro.id, id), jobScopeInContext(), eq(jobRegistro.estado, 'falhou')))
+.where(and(eq(jobRegistro.id, id), eq(jobRegistro.estado, 'falhou')))
```

```mutacao
arquivo: packages/core/src/queue/job-outbox.repository.ts
teste: apps/api/test/ops-jobs.int.test.ts › reabrirFalho e descartarFalho só mudam
falha: outro.descartarFalho(pendente)
 .delete(jobRegistro)
-.where(and(eq(jobRegistro.id, id), jobScopeInContext(), eq(jobRegistro.estado, 'falhou')))
+.where(and(eq(jobRegistro.id, id), jobScopeInContext()))
```

```mutacao
arquivo: packages/core/src/queue/job-outbox.repository.ts
teste: apps/api/test/ops-jobs.int.test.ts › reabrirFalho e descartarFalho só mudam
falha: outro.descartarFalho(falhoDaA)
 .delete(jobRegistro)
-.where(and(eq(jobRegistro.id, id), jobScopeInContext(), eq(jobRegistro.estado, 'falhou')))
+.where(and(eq(jobRegistro.id, id), eq(jobRegistro.estado, 'falhou')))
```

```mutacao
arquivo: packages/core/src/queue/job-outbox.repository.ts
teste: apps/api/test/ops-jobs.int.test.ts › reabrirFalho e descartarFalho só mudam
falha: codigo_falha: null
-.set({ estado: 'aguardando', codigoFalha: null, concluidoEm: null, iniciadoEm: null, reservadoAte: null, criadoEm: sql`now()` })
+.set({ estado: 'aguardando', concluidoEm: null, iniciadoEm: null, reservadoAte: null, criadoEm: sql`now()` })
```

```mutacao
arquivo: packages/core/src/queue/job-outbox.repository.ts
teste: apps/api/test/ops-jobs.int.test.ts › reabrirFalho e descartarFalho só mudam
falha: concluido_em: null
-.set({ estado: 'aguardando', codigoFalha: null, concluidoEm: null, iniciadoEm: null, reservadoAte: null, criadoEm: sql`now()` })
+.set({ estado: 'aguardando', codigoFalha: null, iniciadoEm: null, reservadoAte: null, criadoEm: sql`now()` })
```

```mutacao
arquivo: packages/core/src/queue/job-outbox.repository.ts
teste: apps/api/test/ops-jobs.int.test.ts › reabrirFalho e descartarFalho só mudam
falha: iniciado_em: null
-.set({ estado: 'aguardando', codigoFalha: null, concluidoEm: null, iniciadoEm: null, reservadoAte: null, criadoEm: sql`now()` })
+.set({ estado: 'aguardando', codigoFalha: null, concluidoEm: null, reservadoAte: null, criadoEm: sql`now()` })
```

```mutacao
arquivo: packages/core/src/queue/job-outbox.repository.ts
teste: apps/api/test/ops-jobs.int.test.ts › reabrirFalho e descartarFalho só mudam
falha: reservado_ate: null
-.set({ estado: 'aguardando', codigoFalha: null, concluidoEm: null, iniciadoEm: null, reservadoAte: null, criadoEm: sql`now()` })
+.set({ estado: 'aguardando', codigoFalha: null, concluidoEm: null, iniciadoEm: null, criadoEm: sql`now()` })
```

```mutacao
arquivo: packages/core/src/queue/job-outbox.repository.ts
teste: apps/api/test/ops-jobs.int.test.ts › reabrirFalho e descartarFalho só mudam
falha: toBeLessThan(120)
-.set({ estado: 'aguardando', codigoFalha: null, concluidoEm: null, iniciadoEm: null, reservadoAte: null, criadoEm: sql`now()` })
+.set({ estado: 'aguardando', codigoFalha: null, concluidoEm: null, iniciadoEm: null, reservadoAte: null })
```

```mutacao
arquivo: apps/api/src/ops/command.ts
teste: apps/api/src/ops/jobs-que-falharam.test.ts › o REDIS_FILA_URL do container vale
falha: urlDoRedisDeFilaDeOperacao({ REDIS_FILA_URL: 'http://redis-fila:6379' })
-REDIS_FILA_URL: z.string().regex(/^redis:\/\/[^/\s]+(\/\d+)?$/).optional(),
+REDIS_FILA_URL: z.string().optional(),
```

```mutacao
arquivo: apps/api/src/ops/command.ts
teste: apps/api/src/ops/jobs-que-falharam.test.ts › o REDIS_FILA_URL do container vale
falha: toBe('redis://redis-fila:6379')
-if (valores.REDIS_FILA_URL !== undefined) return valores.REDIS_FILA_URL
```

```mutacao
arquivo: apps/api/src/ops/command.ts
teste: apps/api/src/ops/jobs-que-falharam.test.ts › na máquina, a porta do host do compose local
falha: toThrow(new InvalidConfigError(['REDIS_FILA_URL']))
-if (valores.REDIS_FILA_PORTA_HOST === undefined) throw new InvalidConfigError(['REDIS_FILA_URL'])
```

```mutacao
arquivo: apps/api/src/ops/armazem-de-operacao.ts
teste: apps/api/test/ops-jobs.int.test.ts › o armazém de operação, com o ambiente de teste
falha: abrirArmazemDeOperacao(AMBIENTE)
-const comEndereco = ambiente['STORAGE_URL'] === undefined && porta !== undefined ? { ...ambiente, STORAGE_URL: `http://127.0.0.1:${String(porta)}` } : ambiente
+const comEndereco = ambiente
```

```mutacao
arquivo: apps/api/src/ops/descartar-job.ts
teste: apps/api/test/ops-jobs.int.test.ts › recusado; a linha, o material e o objeto ficam intactos
falha: job não encontrado entre os que falharam
-if (linha === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

```mutacao
arquivo: apps/api/src/ops/descartar-job.ts
teste: apps/api/test/ops-jobs.int.test.ts › só o job de PDF mexe no material
falha: materialFechado: false
-const materialId = tipo === TIPO_EXTRAIR_PDF ? linha.materialId : null
+const materialId = linha.materialId
```


```mutacao
arquivo: apps/api/src/ops/descartar-job.ts
teste: apps/api/test/ops-jobs.int.test.ts › o material que já saiu de processando não é tocado
falha: materialFechado: false
-return { id: linha.id, tipo, escolaId, materialId: materialFechado ? materialId : null }
+return { id: linha.id, tipo, escolaId, materialId }
```

```mutacao
arquivo: apps/api/src/ops/descartar-job.ts
teste: apps/api/test/ops-jobs.int.test.ts › descarta: a linha sai
falha: expect(await descartar([id, '--chamado', '5'])).toEqual({
-if (decisao.materialId === null) return { id: decisao.id, tipo: decisao.tipo, materialFechado: false, objetoApagado: false }
```

```mutacao
arquivo: apps/api/src/ops/descartar-job.ts
teste: apps/api/test/ops-jobs.int.test.ts › o storage que recusa o apagar
falha: objetoApagado: false
-return false
+return true
```

```mutacao
arquivo: packages/core/src/material/extracao.repository.ts
teste: apps/api/test/ops-jobs.int.test.ts › isolamento: o descarte marca só na escola do job
falha: materialFechado: false
 .set({ estado: 'falhou', falha, processadoEm: sql`now()` })
-.where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id), eq(material.estado, 'processando'), isNull(material.excluidoEm)))
+.where(and(eq(material.id, id), eq(material.estado, 'processando'), isNull(material.excluidoEm)))
```

```mutacao
arquivo: apps/api/src/ops/descartar-job.ts
teste: apps/api/test/ops-jobs.int.test.ts › o PDF: o material fecha em falhou
falha: objetoApagado: true
-const objetoApagado = await runInContext({ requisicaoId, escolaId }, async () => {
+const objetoApagado = await runInContext({ requisicaoId }, async () => {
```

```mutacao
arquivo: apps/api/src/ops/reprocessar-job.ts
teste: apps/api/test/ops-jobs.int.test.ts › job que não existe e job que não falhou
falha: job não encontrado entre os que falharam
-if (linha === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

```mutacao
arquivo: apps/api/src/ops/fila-de-jobs.ts
teste: apps/api/test/ops-jobs.int.test.ts › um tipo aceito: a cópia failed sai
falha: toBeUndefined()
-const nova = new Queue<QueuedJobData>(nome, { connection: redis, ...(opcoes.prefixo === undefined ? {} : { prefix: opcoes.prefixo }) })
+const nova = new Queue<QueuedJobData>(nome, { connection: redis })
```

```mutacao
arquivo: apps/api/src/ops/fila-de-jobs.ts
teste: apps/api/test/ops-jobs.int.test.ts › concorrência: dois comandos sobre o mesmo job
falha: toEqual([0, 1])
-if (naFila === undefined) return
```

```mutacao
arquivo: apps/api/src/ops/fila-de-jobs.ts
teste: apps/api/test/ops-jobs.int.test.ts › a fila ainda tem o job como ativo
falha: CONFLITO: o job já existe em andamento
-if ((await naFila.getState()) !== 'failed') throw new DomainException(ErrorCode.CONFLITO)
```

```mutacao
arquivo: apps/api/src/ops/jobs-que-falharam.ts
teste: apps/api/src/ops/jobs-que-falharam.test.ts › InvalidArgumentError citando só a opção
-const FORMATO_DO_CHAMADO = /^[1-9]\d{0,8}$/
+const FORMATO_DO_CHAMADO = /^\d{0,8}$/
```

```mutacao
arquivo: apps/api/src/ops/jobs-que-falharam.ts
teste: apps/api/src/ops/jobs-que-falharam.test.ts › InvalidArgumentError citando só a opção
-const FORMATO_DO_CHAMADO = /^[1-9]\d{0,8}$/
+const FORMATO_DO_CHAMADO = /^[1-9]\d*$/
```

```mutacao
arquivo: apps/api/src/ops/jobs-que-falharam.ts
teste: apps/api/src/ops/jobs-que-falharam.test.ts › id que não é UUID
-if (!id.success || sobra.length > 0) throw new InvalidArgumentError('<id do job>')
+if (sobra.length > 0) throw new InvalidArgumentError('<id do job>')
```

```mutacao
arquivo: apps/api/src/ops/jobs-que-falharam.ts
teste: apps/api/src/ops/jobs-que-falharam.test.ts › dois ids
-if (!id.success || sobra.length > 0) throw new InvalidArgumentError('<id do job>')
+if (!id.success) throw new InvalidArgumentError('<id do job>')
```

```mutacao
arquivo: apps/api/src/ops/jobs-que-falharam.ts
teste: apps/api/src/ops/jobs-que-falharam.test.ts › InvalidArgumentError citando só a opção
-if (lido.values.chamado === undefined || !FORMATO_DO_CHAMADO.test(lido.values.chamado)) throw new InvalidArgumentError('--chamado')
+if (lido.values.chamado === undefined) throw new InvalidArgumentError('--chamado')
```

```mutacao
arquivo: apps/api/src/ops/jobs-que-falharam.ts
teste: apps/api/test/ops-jobs.int.test.ts › o comando não toca a fila, e a linha segue falhou
falha: tipo de job que a operação não mexe
-export const PREFIXOS_QUE_A_OPERACAO_NAO_MEXE: readonly string[] = ['ia.', 'titular.']
+export const PREFIXOS_QUE_A_OPERACAO_NAO_MEXE: readonly string[] = ['titular.']
```

```mutacao
arquivo: apps/api/src/ops/jobs-que-falharam.ts
teste: apps/api/test/ops-jobs.int.test.ts › o comando não toca a fila, e a linha segue falhou
falha: tipo de job que a operação não mexe
-if (PREFIXOS_QUE_A_OPERACAO_NAO_MEXE.some((prefixo) => linha.tipo.startsWith(prefixo))) throw new JobRecusadoError('tipo de job que a operação não mexe: IA ou pedido do titular')
```

```mutacao
arquivo: apps/api/src/ops/jobs-que-falharam.ts
teste: apps/api/test/ops-jobs.int.test.ts › o pedido do titular foi enfileirado uma vez só e tem o caminho dele
falha: tipo de job que a operação não mexe
-export const PREFIXOS_QUE_A_OPERACAO_NAO_MEXE: readonly string[] = ['ia.', 'titular.']
+export const PREFIXOS_QUE_A_OPERACAO_NAO_MEXE: readonly string[] = ['ia.']
```

```mutacao
arquivo: apps/api/src/ops/jobs-que-falharam.ts
teste: apps/api/test/ops-jobs.int.test.ts › recusa material.extrair-pdf com
falha: Tentar de novo é envio novo
-if (tiposRecusados.includes(linha.tipo)) throw new JobRecusadoError('Tentar de novo é envio novo')
```

```mutacao
arquivo: apps/api/src/ops/jobs-que-falharam.ts
teste: apps/api/src/ops/jobs-que-falharam.test.ts › tipo que não existe é recusado
falha: tipo de job desconhecido
-if (tipo === undefined) throw new JobRecusadoError('tipo de job desconhecido')
```

```mutacao
arquivo: apps/api/src/ops/jobs-que-falharam.ts
teste: apps/api/test/ops-jobs.int.test.ts › recusado antes de tocar a linha, a fila e a auditoria
falha: o job não tem escola
-if (linha.escolaId === null) throw new JobSemEscolaError()
```

```mutacao
arquivo: apps/api/src/ops/jobs-que-falharam.ts
teste: apps/api/src/ops/jobs-que-falharam.test.ts › argumento, ambiente e operador
falha: new InvalidArgumentError('--chamado')
-if (erro instanceof InvalidArgumentError || erro instanceof InvalidConfigError || erro instanceof OperadorRejectedError) {
+if (erro instanceof InvalidConfigError || erro instanceof OperadorRejectedError) {
```

```mutacao
arquivo: apps/api/src/ops/jobs-que-falharam.ts
teste: apps/api/src/ops/jobs-que-falharam.test.ts › argumento, ambiente e operador
falha: new InvalidConfigError(['REDIS_FILA_URL'])
-if (erro instanceof InvalidArgumentError || erro instanceof InvalidConfigError || erro instanceof OperadorRejectedError) {
+if (erro instanceof InvalidArgumentError || erro instanceof OperadorRejectedError) {
```

```mutacao
arquivo: apps/api/src/ops/jobs-que-falharam.ts
teste: apps/api/src/ops/jobs-que-falharam.test.ts › argumento, ambiente e operador
falha: new OperadorRejectedError()
-if (erro instanceof InvalidArgumentError || erro instanceof InvalidConfigError || erro instanceof OperadorRejectedError) {
+if (erro instanceof InvalidArgumentError || erro instanceof InvalidConfigError) {
```

```mutacao
arquivo: apps/api/src/ops/jobs-que-falharam.ts
teste: apps/api/src/ops/jobs-que-falharam.test.ts › recusa por tipo e job sem escola
falha: new JobRecusadoError('Tentar de novo é envio novo')
-if (erro instanceof JobRecusadoError || erro instanceof JobSemEscolaError) {
+if (erro instanceof JobSemEscolaError) {
```

```mutacao
arquivo: apps/api/src/ops/jobs-que-falharam.ts
teste: apps/api/src/ops/jobs-que-falharam.test.ts › recusa por tipo e job sem escola
falha: new JobSemEscolaError()
-if (erro instanceof JobRecusadoError || erro instanceof JobSemEscolaError) {
+if (erro instanceof JobRecusadoError) {
```

```mutacao
arquivo: apps/api/src/ops/jobs-que-falharam.ts
teste: apps/api/src/ops/jobs-que-falharam.test.ts › NAO_ENCONTRADO e CONFLITO do domínio
falha: new DomainException(ErrorCode.NAO_ENCONTRADO)
-const doDominio = erro instanceof DomainException ? erro : mapPostgresError(erro)
+const doDominio = mapPostgresError(erro)
```

```mutacao
arquivo: apps/api/src/ops/jobs-que-falharam.ts
teste: apps/api/src/ops/jobs-que-falharam.test.ts › NAO_ENCONTRADO e CONFLITO do domínio
falha: terminar(unica)
-const doDominio = erro instanceof DomainException ? erro : mapPostgresError(erro)
+const doDominio = erro instanceof DomainException ? erro : undefined
```

```mutacao
arquivo: apps/api/src/ops/jobs-que-falharam.ts
teste: apps/api/src/ops/jobs-que-falharam.test.ts › o código de domínio sem texto próprio e o erro qualquer
falha: terminarComErro(erro
-if (doDominio !== undefined && MENSAGEM_DO_OPERADOR[doDominio.codigo] !== undefined) {
+if (MENSAGEM_DO_OPERADOR[doDominio!.codigo] !== undefined) {
```

```mutacao
arquivo: apps/api/src/ops/jobs-que-falharam.ts
teste: apps/api/src/ops/jobs-que-falharam.test.ts › o código de domínio sem texto próprio e o erro qualquer
falha: outroCodigo.texto
-if (doDominio !== undefined && MENSAGEM_DO_OPERADOR[doDominio.codigo] !== undefined) {
+if (doDominio !== undefined) {
```

```mutacao
arquivo: apps/api/src/ops/jobs-que-falharam.ts
teste: apps/api/test/ops-jobs.int.test.ts › traz id, escola, tipo, fila, código e data
falha: Object.keys(linha).sort()
-return { id: job.id, escolaId: job.escolaId, tipo: job.tipo, fila: job.fila, codigo: job.codigoFalha, concluidoEm: job.concluidoEm?.toISOString() ?? null }
+return { id: job.id, escolaId: job.escolaId, tipo: job.tipo, fila: job.fila, codigo: job.codigoFalha, concluidoEm: job.concluidoEm?.toISOString() }
```

```mutacao
arquivo: apps/api/src/ops/jobs-que-falharam.ts
teste: apps/api/src/ops/jobs-que-falharam.test.ts › ops:jobs-que-falharam não aceita argumento
falha: ['--escola', ESCOLA]
-if (argumentos.length > 0) throw new InvalidArgumentError('nenhum argumento')
```



```mutacao
arquivo: packages/core/src/auditoria/acoes.ts
teste: packages/core/src/auditoria/acoes.test.ts › leva o tipo de lista fechada e o chamado inteiro positivo
falha: String(chamado)
  'job.reprocessado': {
  entidade: 'job',
  antes: null,
-depois: z.strictObject({ tipo: z.enum(TIPOS_DE_JOB), chamado: z.number().int().positive() }),
+depois: z.strictObject({ tipo: z.enum(TIPOS_DE_JOB), chamado: z.number().positive() }),
```

```mutacao
arquivo: packages/core/src/auditoria/acoes.ts
teste: packages/core/src/auditoria/acoes.test.ts › leva o tipo de lista fechada e o chamado inteiro positivo
falha: String(chamado)
  'job.reprocessado': {
  entidade: 'job',
  antes: null,
-depois: z.strictObject({ tipo: z.enum(TIPOS_DE_JOB), chamado: z.number().int().positive() }),
+depois: z.strictObject({ tipo: z.enum(TIPOS_DE_JOB), chamado: z.number().int() }),
```



```mutacao
arquivo: packages/core/src/auditoria/acoes.ts
teste: packages/core/src/auditoria/acoes.test.ts › leva o tipo de lista fechada e o chamado inteiro positivo
falha: String(chamado)
  'job.descartado': {
  entidade: 'job',
  antes: null,
-depois: z.strictObject({ tipo: z.enum(TIPOS_DE_JOB), chamado: z.number().int().positive() }),
+depois: z.strictObject({ tipo: z.enum(TIPOS_DE_JOB), chamado: z.number().positive() }),
```

```mutacao
arquivo: packages/core/src/auditoria/acoes.ts
teste: packages/core/src/auditoria/acoes.test.ts › leva o tipo de lista fechada e o chamado inteiro positivo
falha: String(chamado)
  'job.descartado': {
  entidade: 'job',
  antes: null,
-depois: z.strictObject({ tipo: z.enum(TIPOS_DE_JOB), chamado: z.number().int().positive() }),
+depois: z.strictObject({ tipo: z.enum(TIPOS_DE_JOB), chamado: z.number().int() }),
```

```mutacao
arquivo: infra/grafana/alertas/pdf-parado.yaml
teste: infra/test/alerta-do-pdf-parado.int.test.ts › o termo das extrações: com `falhou` terminando
falha: toBeUndefined()
-expr: max(job_espera_mais_antiga_s{fila="pdf"}) and on () ((sum(increase(material_extracao_total{job="educa/worker", resultado=~"pronto|falhou"}[15m])) or vector(0)) == 0)
+expr: max(job_espera_mais_antiga_s{fila="pdf"}) and on () ((sum(increase(material_extracao_total{job="educa/worker", resultado="pronto"}[15m])) or vector(0)) == 0)
```

```mutacao
arquivo: infra/grafana/alertas/pdf-parado.yaml
teste: infra/test/alerta-do-pdf-parado.int.test.ts › o termo das extrações: com `pronto` terminando
falha: toBeUndefined()
-expr: max(job_espera_mais_antiga_s{fila="pdf"}) and on () ((sum(increase(material_extracao_total{job="educa/worker", resultado=~"pronto|falhou"}[15m])) or vector(0)) == 0)
+expr: max(job_espera_mais_antiga_s{fila="pdf"}) and on () ((sum(increase(material_extracao_total{job="educa/worker", resultado="falhou"}[15m])) or vector(0)) == 0)
```

```mutacao
arquivo: infra/grafana/alertas/pdf-parado.yaml
teste: infra/test/alerta-do-pdf-parado.int.test.ts › o objeto ausente não é extração terminada
falha: toBeGreaterThan(LIMIAR_DA_ESPERA_S)
-expr: max(job_espera_mais_antiga_s{fila="pdf"}) and on () ((sum(increase(material_extracao_total{job="educa/worker", resultado=~"pronto|falhou"}[15m])) or vector(0)) == 0)
+expr: max(job_espera_mais_antiga_s{fila="pdf"}) and on () ((sum(increase(material_extracao_total{job="educa/worker", resultado=~"pronto|falhou|arquivo_ausente"}[15m])) or vector(0)) == 0)
```

```mutacao
arquivo: infra/grafana/alertas/pdf-parado.yaml
teste: infra/test/alerta-do-pdf-parado.int.test.ts › o termo das extrações: com `falhou` terminando
falha: toBeUndefined()
-expr: max(job_espera_mais_antiga_s{fila="pdf"}) and on () ((sum(increase(material_extracao_total{job="educa/worker", resultado=~"pronto|falhou"}[15m])) or vector(0)) == 0)
+expr: max(job_espera_mais_antiga_s{fila="pdf"})
```

```mutacao
arquivo: infra/grafana/alertas/pdf-parado.yaml
teste: infra/test/alerta-do-pdf-parado.int.test.ts › o worker-pdf parado e o job pendente há 16 min
falha: toBeGreaterThan(LIMIAR_DA_ESPERA_S)
-expr: max(job_espera_mais_antiga_s{fila="pdf"}) and on () ((sum(increase(material_extracao_total{job="educa/worker", resultado=~"pronto|falhou"}[15m])) or vector(0)) == 0)
+expr: (sum(increase(material_extracao_total{job="educa/worker", resultado=~"pronto|falhou"}[15m])) or vector(0)) == 0
```

```mutacao
arquivo: infra/grafana/alertas/pdf-parado.yaml
teste: infra/test/alerta-do-pdf-parado.int.test.ts › o worker-pdf parado e o job pendente há 16 min
falha: toBeGreaterThan(LIMIAR_DA_ESPERA_S)
-expr: max(job_espera_mais_antiga_s{fila="pdf"}) and on () ((sum(increase(material_extracao_total{job="educa/worker", resultado=~"pronto|falhou"}[15m])) or vector(0)) == 0)
+expr: max(job_espera_mais_antiga_s{fila="pdf"}) and on () ((sum(increase(material_extracao_total{job="educa/worker", resultado=~"pronto|falhou"}[15m]))) == 0)
```

```mutacao
arquivo: infra/grafana/alertas/pdf-parado.yaml
teste: infra/test/alerta-do-pdf-parado.int.test.ts › o termo das extrações: com `falhou` terminando
falha: toBeUndefined()
-expr: max(job_espera_mais_antiga_s{fila="pdf"}) and on () ((sum(increase(material_extracao_total{job="educa/worker", resultado=~"pronto|falhou"}[15m])) or vector(0)) == 0)
+expr: max(job_espera_mais_antiga_s{fila="pdf"}) and on () ((sum(increase(material_extracao_total{job="educa/worker", resultado=~"pronto|falhou"}[10s])) or vector(0)) == 0)
```

```mutacao
arquivo: infra/grafana/alertas/pdf-parado.yaml
teste: infra/test/alertas.test.ts › são as das Tech Specs, com o `for:` e o limiar declarados
falha: expect(pdfParado.for)
-for: 1m
+for: 5m
```

```mutacao
arquivo: infra/grafana/alertas/pdf-parado.yaml
teste: infra/test/alertas.test.ts › são as das Tech Specs, com o `for:` e o limiar declarados
falha: limiar(pdfParado)
-params: [900]
+params: [600]
```

```mutacao
arquivo: apps/api/src/ops/descartar-job.ts
teste: apps/api/test/ops-jobs.int.test.ts › descarta: a linha sai, com a auditoria da escola
-await registro.gravar(tx, 'job.descartado', { entidadeId: linha.id, depois: { tipo, chamado: pedido.chamado }, autorOperador })
+await runInContext({ requisicaoId }, () => registro.gravar(tx, 'job.descartado', { entidadeId: linha.id, depois: { tipo, chamado: pedido.chamado }, autorOperador }))
```

```mutacao
arquivo: apps/api/src/ops/reprocessar-job.ts
teste: apps/api/test/ops-jobs.int.test.ts › o job falhou da escola B reprocessa no contexto da B
-await registro.gravar(tx, 'job.reprocessado', { entidadeId: linha.id, depois: { tipo, chamado: pedido.chamado }, autorOperador })
+await runInContext({ requisicaoId }, () => registro.gravar(tx, 'job.reprocessado', { entidadeId: linha.id, depois: { tipo, chamado: pedido.chamado }, autorOperador }))
```

```mutacao
arquivo: infra/scripts/ensaio-alertas.ts
teste: infra/test/alertas.int.test.ts › caminho feliz
-() => subir(opcoes, ['redis-cache', ...WORKERS_INTERATIVOS, 'worker-pdf']),
+() => subir(opcoes, ['redis-cache', ...WORKERS_INTERATIVOS]),
```

**Sem bloco, com o motivo** (as linhas que o `--faltando` ainda lista, e os termos que ele não vê):

- `apps/api/src/operacao/jobs-que-falharam.repository.ts` (o `.for('update')` de `travarFalho`): o segundo comando sobre o mesmo job perde a corrida de qualquer jeito, porque `reabrirFalho` e `descartarFalho` condicionam o `UPDATE` e o `DELETE` ao `estado = 'falhou'` (um bloco para cada); o `for update` só poupa ao segundo o trabalho da fila e do material, e o resultado (um reprocessa, o outro dá `NAO_ENCONTRADO`, uma auditoria) é o mesmo. Os casos "concorrência: dois comandos sobre o mesmo job" e "concorrência: dois descartar sobre o mesmo job de PDF" provam o resultado.
- `apps/api/src/ops/reprocessar-job.ts:35` e `apps/api/src/ops/descartar-job.ts:43` (o `if (!(await …))` depois de `reabrirFalho` e `descartarFalho`): a linha está travada por `for update` desde `travarFalho`, e o `UPDATE` e o `DELETE` repetem `estado = 'falhou'` e o escopo da escola; entre uma chamada e a outra a linha não muda, e o `false` não é alcançável. É a defesa que continua valendo se alguém tirar o `for update`; o `false` das duas condições tem blocos no repository.
- `apps/api/src/ops/armazem-de-operacao.ts` (os termos `ambiente['STORAGE_URL'] === undefined` e `porta !== undefined`): o ambiente do teste não traz `STORAGE_URL`, e sem ele o armazém não abre (bloco da linha inteira); o termo da URL só vale no container, onde a URL do serviço vence a porta do host, e o da porta só quando `STORAGE_PORTA_HOST` falta, que acaba em `InvalidConfigError` do `loadFileStorageConfig`, o mesmo erro que a variável ausente já dá.
- `apps/api/src/ops/descartar-job.ts:42` (`materialId === null ? false : …`): o `marcarFalhou(null)` também não acha linha e devolve `false`, e o resultado é o mesmo; o ramo só evita a consulta. Os casos de `retencao.*` e do material que já saiu de `processando` provam o resultado.
- `packages/core/src/auditoria/acoes.ts` (`z.strictObject` e `z.enum(TIPOS_DE_JOB)` de `job.reprocessado` e `job.descartado`): o mapa é conferido na carga do módulo (`exigirMapaDeAcoesValido`), e objeto não estrito ou `z.string()` livre derrubam o import, sem caso que falhe; a regra tem os casos de `acoes.test.ts` › "o mapa real passa na conferência…" e "objeto que não é estrito é apontado". O `int().positive()` do chamado tem bloco.
- `apps/api/src/ops/jobs-que-falharam.ts:62` (o termo `lido.values.chamado === undefined`): estreita o tipo de `string | undefined`; o `RegExp.test(undefined)` converte para o texto `undefined`, que o formato recusa do mesmo jeito. O termo do formato tem bloco.
- `apps/api/src/ops/fila-de-jobs.ts:39` (`if (existente !== undefined) return existente`): guarda uma `Queue` por nome; sem ela cada chamada abriria uma `Queue` nova sobre o mesmo cliente, e o resultado do comando não muda, só o número de objetos abertos.
- `apps/api/src/ops/descartar-job.ts:96`, `reprocessar-job.ts:76` e `jobs-que-falharam.ts:143` (`process.argv[1] … pathToFileURL`): o ponto de entrada do script, que só roda como processo; o teste importa o módulo e chama `executarOps…`, como os outros comandos `ops:*`.
- `infra/scripts/ensaio-alertas.ts` (o `comandoOuFalha(opcoes, 'stop', 'worker-pdf')`): sem a parada, o `worker-pdf` toma o job, a fila anda e o `pdf-parado` nunca dispara; o ensaio fica esperando o disparo até o prazo dele, e o "vermelho" do caso é o estouro do tempo (mais de 600 s, o teto do portão para a mutação, que a recusa), e não uma asserção. O bloco ao lado (o `subir` com o `worker-pdf` na restauração) cai por asserção, e o caso `alertas.int.test.ts › caminho feliz` passou limpo em 615 s com a parada no lugar.
- `infra/grafana/alertas/pdf-parado.yaml` (o `for: 1m` lido pelo ensaio, `duracaoS`): o ensaio inteiro leva 531 s, e a mutação passa do teto de 600 s antes da asserção de `duracaoS`; o `for` tem o seu bloco em `infra/test/alertas.test.ts` (`for: 5m`), que cai rápido, e o `toEqual` do ensaio confere o mesmo número de ponta a ponta.


## Recomendações sem aplicar

**Rodada 1** (`.processo/ordens/3_task-r1.md`)

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| `infra-guardian` (1ª) | `jobs-que-falharam.repository.ts:38`: índice parcial `(concluido_em) where estado = 'falhou'` para a listagem | Recusada: o próprio revisor diz que "para comando de operação com `limit 200` isso basta"; é migration. Reabrir se a lista de falhos crescer (`TODO.md`) |
| `revisor-geral` (1ª) | `descartar-job.ts:52-59`: separar os dois `try`, ou renomear `objetoApagado`, para o objeto já fora do storage não sair como `false` se o `marcarObjetoApagado` falhar | `TODO.md`: muda o que o terminal responde nesse caso e pede caso e bloco de mutação novos |
| `test-engineer` (1ª) | `jobs-que-falharam.repository.ts:38`: `orderBy(desc(concluidoEm))` põe os `null` primeiro; considerar `nulls last` | `TODO.md`: muda a ordem da listagem e pede bloco de mutação |
| `test-engineer` (1ª) | `alerta-do-pdf-parado.int.test.ts`: o job "parado" fica `reservado`, e não `publicado` com o worker fora; o caso real só fica provado pelo ensaio | Coberta pelo item 1 (o ensaio passa a parar o `worker-pdf`) |
| `privacy-guardian` (1ª) | O material vai para `falhou` pelo descarte sem ação `material.*` na auditoria; só `job.descartado` (entidade `job`) registra | `TODO.md`: ação nova em `acoes.ts`, contrato de auditoria |
| `conformidade-reviewer` (1ª) | Comentário em `job-definitions.ts` dizendo que um tipo `ia.*` novo já fica fora dos comandos de operação | `TODO.md`: o arquivo (`packages/shared/src/system/job-definitions.ts`) não é da tarefa |
| `conformidade-reviewer` (1ª) | Quando entrar job que publique nota ou entrega aprovada, reavaliar o `ops:descartar-job` (descartar apagaria uma aprovação humana registrada) | Tarefa futura: a que criar esse tipo de job; nota no `TODO.md` |
| `tenancy-guardian` (1ª) | `apps/api/src/operacao/` soma 7 `@Unscoped` em três arquivos; olhar na retro | Retro da funcionalidade; nota no `TODO.md` |

**Rodada 2** (`.processo/ordens/3_task-r2.md`)

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| `infra-guardian` (2ª), `test-engineer` (2ª), `revisor-geral` (2ª) | A parada do `worker-pdf` (`ensaio-alertas.ts:591`) só é provada pelo estouro do prazo do ensaio (mutação sem bloco): uma asserção depois do `stop` (pelo `compose ps`, ou o `ResultadoDoEnsaio` devolvendo o estado do `worker-pdf` no disparo) a faria cair em segundos | `TODO.md`: muda o comportamento do ensaio (função nova no script) e a prova só roda no teste de infra de cerca de 10 min; o motivo escrito em "Sem bloco, com o motivo" do documento fica até lá |
| `revisor-geral` (2ª) | `docs/runbook.md:153`: o parágrafo do ensaio ficou numa linha só, fora da quebra do resto do arquivo | `TODO.md`: só formatação |
| `test-engineer` (2ª) | `3_task.md:90`, item 12 da autoconferência, ainda diz "`NAO_ENCONTRADO` igual para job inexistente, de outra escola e fora do estado"; depois do renome o caso prova "inexistente e fora do estado" | Texto do documento da tarefa: `TODO.md` (a retro confere os documentos de tarefa) |
| `test-engineer` (2ª) | A tabela de testes (`3_task.md:46` e `:55`) não cita os dois casos novos: a concorrência do `descartar` e o "job falhou da escola B reprocessa no contexto da B" | Texto do documento da tarefa: `TODO.md` |
| `test-engineer` (2ª) | `ops-jobs.int.test.ts:371`: o nome do caso diz "e o material fecha uma vez" e só olha o estado final do material e o número de auditorias; conferir o `atualizado_em` ou o número de `apagar` no storage, ou tirar "fecha uma vez" do nome | `TODO.md`: o caso passa nos dois sentidos e o nome é de teste; muda o que o caso prova |
| `privacy-guardian` (2ª) | Incluir o histórico de reprocessos da auditoria no arquivo do titular, quando o `dados` do job aponta um pedido do titular ou um material | Tarefa futura: a que toca o arquivo do titular; nota no `TODO.md` (o reprocessar já recusa `titular.*`) |
| `privacy-guardian` (2ª) | Os dois casos deixados para a 5.8 (job `sistema.*` auditado sem escola; `falhou` de `material.extrair-pdf` fora do expurgo) devem continuar bloqueados até a 5.8 | Já cumprida: a recusa com `JobSemEscolaError` segue, e os dois cenários estão no `5_task.md` (5.8) e no `cenarios.md` |
| `conformidade-reviewer` (2ª) | Se aparecer job de mensagem à família, ele entra em `PREFIXOS_QUE_A_OPERACAO_NAO_MEXE`, e não só como aviso no runbook | Tarefa futura: a que criar esse tipo de job; nota no `TODO.md` |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-12 15:55:45 | 2026-11-12 15:56:24 | `conformidade-reviewer` | 1 | APROVADO | a580d028dde4fa116 |
| 2026-11-12 15:55:29 | 2026-11-12 15:56:27 | `tenancy-guardian` | 1 | APROVADO | ad4d15d131fabdf93 |
| 2026-11-12 15:55:30 | 2026-11-12 15:56:53 | `privacy-guardian` | 1 | APROVADO | a4d028eed11504422 |
| 2026-11-12 15:55:33 | 2026-11-12 15:57:46 | `infra-guardian` | 1 | REPROVADO | a406add7de8179c99 |
| 2026-11-12 15:55:41 | 2026-11-12 15:58:11 | `revisor-geral` | 1 | REPROVADO | a1c6b11255ec52c71 |
| 2026-11-12 15:55:37 | 2026-11-12 15:58:52 | `test-engineer` | 1 | REPROVADO | a7cf4fa2a77f9d6d9 |
| 2026-11-12 19:33:53 | 2026-11-12 19:34:14 | `tenancy-guardian` | 2 | APROVADO | ac3440f4c7a6e911f |
| 2026-11-12 19:33:59 | 2026-11-12 19:34:29 | `privacy-guardian` | 2 | APROVADO | a5b2792afff66fbb5 |
| 2026-11-12 19:34:06 | 2026-11-12 19:34:39 | `conformidade-reviewer` | 2 | APROVADO | a9ac7d9cd44305e32 |
| 2026-11-12 19:34:16 | 2026-11-12 19:34:42 | `infra-guardian` | 2 | APROVADO | a1e612acbad6021b2 |
| 2026-11-12 19:34:35 | 2026-11-12 19:35:05 | `revisor-geral` | 2 | APROVADO | a6f5708a12ebb4e75 |
| 2026-11-12 19:34:22 | 2026-11-12 19:35:37 | `test-engineer` | 2 | APROVADO | a4017dcc79783935c |
