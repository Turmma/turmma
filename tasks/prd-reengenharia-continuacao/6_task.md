# Tarefa 6.0 — Execução duplicada ou interrompida não chama o modelo de novo, e o consumo estimado fica no rastro (47.0)

**Funcionalidade:** reengenharia-continuacao · **Depende de:** 5.0
**Subagentes obrigatórios:** `privacy-guardian`, `tenancy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

A reentrega em `rodando` encerra a execução com `EXECUCAO_INTERROMPIDA`, sem modelo nem troca; a varredura a cada 60 s
encerra a `rodando` velha e a `pendente` sem job vivo. Toda `rodando` encerrada grava a linha estimada em `consumo_ia`, no
rastro do aluno: o custo a mais, nunca a menos (D14).

## Contexto necessário

- `techspec.md` §5 ("Os estados", linha `rodando`; "A varredura"), §7, §8 (a linha estimada)
- `prd.md` RF3; §8; regras 10 (9), 20 (9, 19), 30 (4), 40, 80
- Código: `execucao.repository.ts` (`falharInterrompidas`); `consumo.repository.ts`;
  `packages/core/src/titular/compartilhamento.repository.ts` (`rastroDoAluno`); `packages/core/src/db/schema/job-registro.ts:44`

## Subtarefas

- [x] 6.1 — No processador: `rodando` na entrega → `EXECUCAO_INTERROMPIDA`, com a linha estimada (§8) na mesma transação
- [x] 6.2 — A varredura da §5, `@Unscoped` com motivo; o `EXPLAIN` pelo `job_registro_pendentes_idx` na seção "Divergências"
- [x] 6.3 — A conta do laço (Tech Spec §7c, "Laços e ritmo"): lote × duração × passadas cabe nos 60 s, e o laço para no sinal
- [x] 6.4 — `docs/lgpd.md`: a linha `job_registro` cita `ia.executar`; a de `consumo_ia` diz que a linha estimada leva o
  provedor sem saber se o envio saiu
- [x] 6.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/src/ia/varredura-de-execucoes.ts`, `apps/api/src/ia/execucao-interrompida.int.test.ts` | novo |
| `apps/api/src/ia/execucao.processor.ts`, `apps/api/src/ia/execucao.repository.ts`, `apps/api/src/ia/consumo.repository.ts`, `apps/api/src/main-worker.ts`, `packages/core/src/ia/consumo.ts`, `apps/api/test/arquivo-do-titular.int.test.ts`, `docs/lgpd.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| duplicada em corrida | P | a 2.ª acha `rodando`, encerra; a conclusão da 1.ª não muda a linha; uma chamada no máximo. Mutação: concluir sem `where estado = 'rodando'` | `execucao-interrompida.int.test.ts` › duplicada em corrida |
| as duas leem `pendente` | P | barreira entre a leitura e o `update`: uma só vira `rodando`, uma chamada | `execucao-interrompida.int.test.ts` › as duas leem `pendente` |
| worker morto | I | reentrega: `EXECUCAO_INTERROMPIDA`, sem modelo nem troca, uma linha estimada | `execucao-interrompida.int.test.ts` › worker morto |
| D36 na reentrega | I | o `assunto_delicado` gravado e o job reentregue: um sinal só | `tutor-modelo.int.test.ts` › D36 na reentrega; e o job em dois workers |
| linha estimada, externo | I | `envio_externo`, `provedor`, os tetos, o resto nulo; no `rastroDoAluno`. Mutação: sem `envio_externo` | `execucao-interrompida.int.test.ts` › linha estimada, externo |
| linha estimada, falso ou local | I | não conta como envio externo | `execucao-interrompida.int.test.ts` › linha estimada, falso ou local (o falso); `packages/core/src/ia/llm-gateway.test.ts` › destinoDoAdaptador: o modelo local (o local) |
| fora do freio | I | a linha não entra no freio do dia. Mutação: gravar com `aluno_id` | `execucao-interrompida.int.test.ts` › fora do freio |
| o original vivo | I | duas linhas, nunca zero | `execucao-interrompida.int.test.ts` › o original vivo também registra |
| a gravação falha | I | o encerramento desfaz. Mutação: fora da transação | `execucao-interrompida.int.test.ts` › a gravação falha; a gravação da linha falha |
| varredura, limiar | I | a `rodando` de 301 s é encerrada, a de 299 s fica. Mutação: limiar fixo antigo | `execucao-interrompida.int.test.ts` › varredura, limiar |
| varredura, `pendente` | I | com job vivo fica, mesmo com Redis fora; sem, encerrada sem linha. Mutação: não ler `job_registro` | `execucao-interrompida.int.test.ts` › varredura, `pendente` (e, com o Redis fora, › Redis de fila fora) |
| varredura, escola | I | job vivo de outra escola com o mesmo `execucaoId` não segura a `pendente`. Mutação: não igualar a escola | `execucao-interrompida.int.test.ts` › varredura, escola |
| varredura, duas réplicas | P | barreira entre o `update … returning` e o `commit`: um encerramento, uma linha. Mutação: tirar a condição de estado | `execucao-interrompida.int.test.ts` › varredura, duas réplicas (e na `pendente`) |
| varredura, duas escolas | I | cada linha na escola da execução | `execucao-interrompida.int.test.ts` › varredura, duas escolas (e, com o adaptador externo, › varredura, duas escolas, externo) |
| isolamento, reentrega | I | job da A com o `execucaoId` da B, já `rodando`: nada muda na B, sem linha | `execucao-interrompida.int.test.ts` › isolamento, reentrega |
| rastro de outro aluno | I | X não vê a de Y, na mesma escola | `execucao-interrompida.int.test.ts` › rastro de outro aluno |
| arquivo do titular | I | `arquivo-do-titular.int.test.ts` continua cobrindo o `consumo_ia` (rode à mão) | `arquivo-do-titular.int.test.ts` › a linha estimada da execução interrompida; rodado à mão com o resto do arquivo |
| log | I | só ids, tarefa, código e contagem | `execucao-interrompida.int.test.ts` › o que a reentrega e a varredura escrevem |

## Como testar

- Corrida: `apps/api/src/ia/ia.int.test.ts` › "a passagem é uma só: a segunda instância que tenta pegar a mesma execução não
  pega…"; barreira com `WriteBlockTrigger` e `esperarNaTrava` (`apps/api/test/write-block-trigger.ts`)
- Varredura: › "execução presa em \"rodando\" ou \"pendente\" vira \"falhou\" com EXECUCAO_INTERROMPIDA quando a API sobe…"; a
  idade pelo banco, recuando `iniciada_em` e `criada_em`
- Consumo: › "grava o provedor de quem recebeu o conteúdo, e nulo onde nada saiu…"
- Bancada: `apps/api/test/fila-de-ia.fixture.ts` (5.0)
- Comando: `npx vitest run --project integracao apps/api/src/ia/execucao-interrompida.int.test.ts`

## Autoconferência

As 12 perguntas do modelo, respondidas no plano (6.0). Na 1: cada termo do `not exists` e do `update` da varredura, dentro da template
string, é um bloco. Na 10: as duas direções da corrida são dois casos.

1. **Mutação de cada cláusula:** a seção "Mutações" tem um bloco por termo do `where` de `encerrarRodando` (escola, id e estado), por linha dos dois `update` em SQL da varredura (o erro gravado, o `select` da `rodando` com o estado, o limiar e o `limit`, o estado do alvo, o `returning` da duração; na `pendente`, o erro, o estado, cada termo do `not exists`, o `limit` e o estado do alvo), pelos dois `if` do processador, pelo `if` da volta em curso, pelo `if` do log, pelos dois termos do laço e pelo `break` dele, pelo `catch` e pelo `finally` da varredura, pelas duas transações (a da reentrega e a da varredura), por `...destino.envio`, pelos tetos de tokens e pelo ternário do adaptador. Sem bloco, com motivo na prosa da seção: o `order by` das duas varreduras e o ternário da latência falsa (linha movida do gateway). O `break` do laço tem bloco (a volta que para quando o lote não enche).
2. **Texto na tela:** a tarefa não toca `apps/web`: nenhum texto novo, e `grep -rln` nos e2e não muda.
3. **Segundo dado:** duas escolas (A e B) em quase todo caso; a mesma escola com outra execução `rodando` que a reentrega não toca; execuções que já terminaram, mais velhas que as varridas, ao lado do lote (as iscas); o job vivo da escola B com o `execucaoId` da A; o aluno X e o aluno Y na mesma escola, e a escola B com o seu aluno no externo.
4. **Checagem anterior (o controle):** "fora do freio" confere antes que a pergunta em andamento **bloqueia** (`LIMITE_DIARIO_DO_TUTOR`) e só depois que a encerrada não conta; "a gravação falha" repete a mesma entrega com a gravação consertada e então encerra; "isolamento, reentrega" chama o repository no contexto da B e encerra; "varredura, escola" tem o controle do job vivo da própria escola, que segura; "varredura, `pendente`" tem o job vivo que fica ao lado das seis que caem; "linha estimada, externo" confere o `rastroDoAluno` vazio antes.
5. **Asserção:** o estado e o erro da execução, as linhas de `consumo_ia` (campo a campo, com `toEqual`) e o rastro, lidos no banco; o log, lido do que o logger escreveu; as chamadas ao modelo, contadas no modelo de teste. Nunca o texto do código.
6. **Guarda nova:** nenhuma. `apps/api/test/architecture.test.ts` e `tools/guardas/repositories-com-escopo.test.ts` já contam as `@Unscoped` do `ExecucaoRepository`: agora são `encerrarRodandasVelhas` e `encerrarPendentesSemJob`, e o teste de `ia.int.test.ts` que as enumera foi atualizado.
7. **Comentários:** os docblocks do processador, do repository, da varredura e do `consumo.ts` dizem o que o código faz agora; `grep -rn "falharInterrompidas" apps packages` não acha nada, e nos docs só acha o que fala da API **anterior** (`docs/runbook.md`, "Voltar o código depois da 5.0") e as tarefas e achados antigos; `docs/arquitetura.md`, `docs/runbook.md` e `docs/lgpd.md` foram atualizados.
8. **Divergências:** a tabela abaixo; a decisão está no `techspec.md` ("Como a 6.0 ficou") e no `cenarios.md`; o `prd.md` não diz o contrário.
9. **Peça que já existe:** `WriteBlockTrigger` e `esperarNaTrava`, `FilaDeIa` (a 5.0), `SessaoFixtures`, `montarEscolaComTurma`, `alunoTrailStatement`, `OrcamentoRepository`, `tools/testes/compose.ts` (o Redis de fila). O `destinoDoAdaptador` sai da mesma conta de `createLLMGateway` (`adaptadorInterno`), e não de uma segunda.
10. **Concorrência:** a reentrega nas duas direções (a 2.ª acha `rodando` com a 1.ª no modelo; as duas leem `pendente` e a barreira fica entre a leitura e o `update`), a conclusão tardia da 1.ª que se desfaz, a varredura nas duas direções (duas réplicas na `rodando` e na `pendente`, a barreira entre o `update` e o `commit`), e a varredura que não se sobrepõe à anterior.
11. **Isolamento e "Caso":** o repository (`encerrarRodando` no contexto da A e no da B), o job da A com a execução da B, o job vivo de outra escola, a escola de cada linha estimada e o rastro de outro aluno têm teste; a coluna "Caso" está preenchida.
12. **Guardiões e achados:** `privacy-guardian` (a linha estimada sem aluno, sem texto, com o provedor sem saber se o envio saiu; o log só com ids; `docs/lgpd.md`), `tenancy-guardian` (as duas `@Unscoped` com motivo; a escola da linha estimada vem do `returning`, não do cliente; o `runInContext` da varredura), `infra-guardian` (o lote, o `statement_timeout`, a conta do laço de 50 s em 60 s, o sinal, o `EXPLAIN`, o Redis fora); as recomendações herdadas estão na tabela de "Recomendações sem aplicar", com o que foi feito.

## Fora do escopo desta tarefa

O corte dos 20 s (7.0); a contagem no uso do Tutor (9.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| A fiação do destino do adaptador fica em `ia-do-worker.module.ts` (`DESTINO_DO_ADAPTADOR`) e `worker.module.ts`; o `main-worker.ts`, previsto, não muda | O `main-worker.ts` só sobe o `WorkerModule`; quem monta o processador e a varredura é o `CicloDoWorkerDeIa` | `techspec.md` §5 "Como a 6.0 ficou" (4); `fila-de-ia.int.test.ts` (a bancada) |
| A varredura da `pendente` não tem piso de idade: é "sem job vivo", e só | A `pendente` nasce com o job vivo no outbox, na mesma transação do `agendar`; com o Redis fora o job segue vivo na linha de `job_registro`, e uma `pendente` sem job é a que perdeu o job (o `sistema.expurgar-jobs` ou o operador). Um piso de idade esconderia o defeito e deixaria a pergunta do aluno à espera | `techspec.md` §5 "Como a 6.0 ficou" (2); `cenarios.md` (varredura, `pendente`) |
| O `EXPLAIN` do `not exists`: `Bitmap Heap Scan on job_registro` sobre `Bitmap Index Scan on job_registro_pendentes_idx`, com `Index Cond: (fila = ANY ('{interativa,ferramenta,normal}')) AND (escola_id = <a escola>)`. O teste cola o plano em 30.000 linhas de `job_registro` e exige o índice, a fila e a escola na condição | O predicado do `not exists` é o do índice parcial (`fila`, `escola_id`, `estado not in ('concluido', 'falhou')`); o `dados ->> 'execucaoId'` e o `tipo` filtram depois, nas poucas linhas vivas da escola | `techspec.md` §5 "Como a 6.0 ficou" (5); `execucao-interrompida.int.test.ts` › o `EXPLAIN` |
| Os tokens da linha estimada vêm do `TASK_CATALOG` (os dois tetos da definição da tarefa), e não do `ComandoExecutavel` | A tarefa `relatorio_da_correcao` está no catálogo e não tem comando; o catálogo tem os dois tetos de toda tarefa, e é o que o gateway já lê | `techspec.md` §5 "Como a 6.0 ficou" (4); `packages/core/src/ia/consumo.ts` |
| `destinoDoAdaptador(config)` é função nova do `core`, extraída de `createLLMGateway` (`adaptadorInterno`) | A linha estimada precisa da origem, do envio e do modelo **sem** montar o gateway; a mesma conta evita que a estimada diga um provedor e a chamada de verdade, outro | `techspec.md` §5 "Como a 6.0 ficou" (4); `llm-gateway.test.ts` › destinoDoAdaptador |
| Quem encerra a reentrega é o `update … where estado = 'rodando'`, e não a leitura de antes; o `lida.estado` só vai ao log | A leitura pode estar velha: nas "duas leem `pendente`" a que perdeu o `update` acha a linha `rodando` da vencedora; a decisão é do banco (regra 80, item 7) | `techspec.md` §5 "Como a 6.0 ficou" (1); `cenarios.md` (as duas leem `pendente`) |
| A mutação "fora do freio: gravar com `aluno_id`" não se aplica como escrita: a linha estimada **nem recebe** o aluno | `InterrompidaEncerrada` leva o id, a escola, a tarefa e a duração; o aluno não passa por ali, e o teste prova o resultado (a coluna fica nula e a consulta do freio, com a pergunta encerrada, deixa passar) | `techspec.md` §5 "Como a 6.0 ficou" (4); `cenarios.md` (fora do freio) |
| O caso "D36 na reentrega" fica em `tutor-modelo.int.test.ts` (onde está a D36), com a corrida herdada da 2.0 | É o arquivo que tem o modelo de teste do Tutor e o `sinaisDe`; a bancada `fila.entregarDeNovo` é a mesma | `cenarios.md` (reentrega do assunto delicado) |

## Mutações

--faltando: 0 linhas (35 blocos, 2 motivos)

Cada bloco tira uma cláusula e exige o vermelho de um caso que rodou. Os que provam uma ausência levam o `falha:`.

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/execucao-interrompida.int.test.ts › a execução que já terminou
-        if (interrompida === undefined) return false
+        if (interrompida === undefined) return true
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/execucao-interrompida.int.test.ts › o que a reentrega e a varredura escrevem
-    if (encerrada) logger.warn({ evento: 'ia.execucao.interrompida', execucaoId, escolaId, tipo, codigo })
+    if (!encerrada) logger.warn({ evento: 'ia.execucao.interrompida', execucaoId, escolaId, tipo, codigo })
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/execucao-interrompida.int.test.ts › a gravação falha: o encerramento se desfaz
-        const interrompida = await new ExecucaoRepository(tx).encerrarRodando(execucaoId)
+        const interrompida = await new ExecucaoRepository(banco).encerrarRodando(execucaoId)
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/execucao-interrompida.int.test.ts › isolamento, reentrega
falha: toBeUndefined()
       .set({ estado: 'falhou', erro: EXECUCAO_INTERROMPIDA, concluidaEm: sql`now()` })
-      .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.id, id), eq(execucaoAgente.estado, 'rodando')))
+      .where(and(eq(execucaoAgente.id, id), eq(execucaoAgente.estado, 'rodando')))
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/execucao-interrompida.int.test.ts › worker morto
       .set({ estado: 'falhou', erro: EXECUCAO_INTERROMPIDA, concluidaEm: sql`now()` })
-      .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.id, id), eq(execucaoAgente.estado, 'rodando')))
+      .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.estado, 'rodando')))
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/execucao-interrompida.int.test.ts › a execução que já terminou
       .set({ estado: 'falhou', erro: EXECUCAO_INTERROMPIDA, concluidaEm: sql`now()` })
-      .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.id, id), eq(execucaoAgente.estado, 'rodando')))
+      .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.id, id)))
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/execucao-interrompida.int.test.ts › duplicada em corrida
       .set({ estado: 'concluida', resultado: referencia, concluidaEm: sql`now()` })
-      .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.id, id), eq(execucaoAgente.estado, 'rodando')))
+      .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.id, id)))
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/execucao-interrompida.int.test.ts › varredura, limiar
-      update execucao_agente x set estado = 'falhou', erro = ${EXECUCAO_INTERROMPIDA}, concluida_em = now()
+      update execucao_agente x set estado = 'falhou', erro = 'IA_INDISPONIVEL', concluida_em = now()
       where x.id in (select r.id from execucao_agente r where r.estado = 'rodando' and r.iniciada_em < now() - make_interval(secs => ${limiteSegundos}::float8) order by r.iniciada_em limit ${lote})
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/execucao-interrompida.int.test.ts › o lote limita o passo
       update execucao_agente x set estado = 'falhou', erro = ${EXECUCAO_INTERROMPIDA}, concluida_em = now()
-      where x.id in (select r.id from execucao_agente r where r.estado = 'rodando' and r.iniciada_em < now() - make_interval(secs => ${limiteSegundos}::float8) order by r.iniciada_em limit ${lote})
+      where x.id in (select r.id from execucao_agente r where r.iniciada_em < now() - make_interval(secs => ${limiteSegundos}::float8) order by r.iniciada_em limit ${lote})
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/execucao-interrompida.int.test.ts › varredura, limiar
       update execucao_agente x set estado = 'falhou', erro = ${EXECUCAO_INTERROMPIDA}, concluida_em = now()
-      where x.id in (select r.id from execucao_agente r where r.estado = 'rodando' and r.iniciada_em < now() - make_interval(secs => ${limiteSegundos}::float8) order by r.iniciada_em limit ${lote})
+      where x.id in (select r.id from execucao_agente r where r.estado = 'rodando' and r.iniciada_em < now() order by r.iniciada_em limit ${lote})
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/execucao-interrompida.int.test.ts › o lote limita o passo
       update execucao_agente x set estado = 'falhou', erro = ${EXECUCAO_INTERROMPIDA}, concluida_em = now()
-      where x.id in (select r.id from execucao_agente r where r.estado = 'rodando' and r.iniciada_em < now() - make_interval(secs => ${limiteSegundos}::float8) order by r.iniciada_em limit ${lote})
+      where x.id in (select r.id from execucao_agente r where r.estado = 'rodando' and r.iniciada_em < now() - make_interval(secs => ${limiteSegundos}::float8) order by r.iniciada_em)
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/execucao-interrompida.int.test.ts › varredura, duas réplicas: o encerramento
       where x.id in (select r.id from execucao_agente r where r.estado = 'rodando' and r.iniciada_em < now() - make_interval(secs => ${limiteSegundos}::float8) order by r.iniciada_em limit ${lote})
-        and x.estado = 'rodando'
       returning x.id, x.escola_id, x.tarefa, (extract(epoch from (now() - x.iniciada_em)) * 1000)::float8 as duracao_ms
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/execucao-interrompida.int.test.ts › varredura, limiar
         and x.estado = 'rodando'
-      returning x.id, x.escola_id, x.tarefa, (extract(epoch from (now() - x.iniciada_em)) * 1000)::float8 as duracao_ms
+      returning x.id, x.escola_id, x.tarefa, 0::float8 as duracao_ms
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/execucao-interrompida.int.test.ts › varredura, `pendente`: com job vivo
-      update execucao_agente x set estado = 'falhou', erro = ${EXECUCAO_INTERROMPIDA}, concluida_em = now()
+      update execucao_agente x set estado = 'falhou', erro = 'IA_INDISPONIVEL', concluida_em = now()
       where x.id in (
           select p.id from execucao_agente p
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/execucao-interrompida.int.test.ts › o lote limita o passo
       where x.id in (
           select p.id from execucao_agente p
-          where p.estado = 'pendente'
+          where true
             and not exists (
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/execucao-interrompida.int.test.ts › varredura, escola
             and not exists (
               select 1 from job_registro j
-              where j.escola_id = p.escola_id
+              where true
                 and j.fila in ('interativa', 'ferramenta', 'normal')
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/execucao-interrompida.int.test.ts › varredura, `pendente`: com job vivo
             and not exists (
               select 1 from job_registro j
-              where j.escola_id = p.escola_id
+              where false and j.escola_id = p.escola_id
                 and j.fila in ('interativa', 'ferramenta', 'normal')
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/execucao-interrompida.int.test.ts › varredura, `pendente`: com job vivo
               select 1 from job_registro j
               where j.escola_id = p.escola_id
-                and j.fila in ('interativa', 'ferramenta', 'normal')
+                and j.fila in ('interativa', 'ferramenta', 'normal', 'lote')
                 and j.tipo = 'ia.executar'
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/execucao-interrompida.int.test.ts › varredura, `pendente`: com job vivo
                 and j.fila in ('interativa', 'ferramenta', 'normal')
-                and j.tipo = 'ia.executar'
+                and true
                 and j.dados ->> 'execucaoId' = p.id::text
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/execucao-interrompida.int.test.ts › varredura, `pendente`: com job vivo
                 and j.tipo = 'ia.executar'
-                and j.dados ->> 'execucaoId' = p.id::text
+                and true
                 and j.estado not in ('concluido', 'falhou')
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/execucao-interrompida.int.test.ts › varredura, `pendente`: com job vivo
                 and j.dados ->> 'execucaoId' = p.id::text
-                and j.estado not in ('concluido', 'falhou')
+                and j.estado not in ('concluido')
             )
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/execucao-interrompida.int.test.ts › varredura, `pendente`: com job vivo
                 and j.dados ->> 'execucaoId' = p.id::text
-                and j.estado not in ('concluido', 'falhou')
+                and j.estado not in ('falhou')
             )
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/execucao-interrompida.int.test.ts › o lote limita o passo
             )
-          order by p.criada_em limit ${lote})
+          order by p.criada_em)
         and x.estado = 'pendente'
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/execucao-interrompida.int.test.ts › varredura, duas réplicas na `pendente`
           order by p.criada_em limit ${lote})
-        and x.estado = 'pendente'
       returning x.id
```

```mutacao
arquivo: apps/api/src/ia/varredura-de-execucoes.ts
teste: apps/api/src/ia/execucao-interrompida.int.test.ts › a volta para quando o lote não enche
-      if (encerradas < LOTE_DA_VARREDURA) break
```

```mutacao
arquivo: apps/api/src/ia/varredura-de-execucoes.ts
teste: apps/api/src/ia/execucao-interrompida.int.test.ts › a varredura que está rodando não é repetida por cima
-    if (this.#emCurso) return 0
     this.#emCurso = true
```

```mutacao
arquivo: apps/api/src/ia/varredura-de-execucoes.ts
teste: apps/api/src/ia/execucao-interrompida.int.test.ts › o que a reentrega e a varredura escrevem
-      if (total > 0) this.logger.warn({ evento: 'ia.execucao.interrompidas_encerradas', total, rodandoTotal, pendentesTotal })
+      if (total >= 0) this.logger.warn({ evento: 'ia.execucao.interrompidas_encerradas', total, rodandoTotal, pendentesTotal })
```

```mutacao
arquivo: apps/api/src/ia/varredura-de-execucoes.ts
teste: apps/api/src/ia/execucao-interrompida.int.test.ts › a conta do laço
-    for (let passada = 0; passada < PASSADAS_MAXIMAS && !this.#parar.signal.aborted; passada += 1) {
+    for (let passada = 0; !this.#parar.signal.aborted; passada += 1) {
```

```mutacao
arquivo: apps/api/src/ia/varredura-de-execucoes.ts
teste: apps/api/src/ia/execucao-interrompida.int.test.ts › a conta do laço
-    for (let passada = 0; passada < PASSADAS_MAXIMAS && !this.#parar.signal.aborted; passada += 1) {
+    for (let passada = 0; passada < PASSADAS_MAXIMAS; passada += 1) {
```

```mutacao
arquivo: apps/api/src/ia/varredura-de-execucoes.ts
teste: apps/api/src/ia/execucao-interrompida.int.test.ts › a gravação da linha falha: o lote da varredura se desfaz
       this.logger.warn({ evento: 'ia.execucao.varredura_falhou', erro: summarizeError(erro) })
-      return 0
+      throw erro
```

```mutacao
arquivo: apps/api/src/ia/varredura-de-execucoes.ts
teste: apps/api/src/ia/execucao-interrompida.int.test.ts › a gravação da linha falha: o lote da varredura se desfaz
-      this.#emCurso = false
```

```mutacao
arquivo: apps/api/src/ia/varredura-de-execucoes.ts
teste: apps/api/src/ia/execucao-interrompida.int.test.ts › a gravação da linha falha: o lote da varredura se desfaz
-      const encerradas = await new ExecucaoRepository(tx).encerrarRodandasVelhas(LIMITE_DA_RODANDO_SEGUNDOS, LOTE_DA_VARREDURA)
+      const encerradas = await new ExecucaoRepository(this.banco).encerrarRodandasVelhas(LIMITE_DA_RODANDO_SEGUNDOS, LOTE_DA_VARREDURA)
```

```mutacao
arquivo: packages/core/src/ia/consumo.ts
teste: apps/api/src/ia/execucao-interrompida.int.test.ts › linha estimada, externo
-    ...destino.envio,
```

```mutacao
arquivo: packages/core/src/ia/consumo.ts
teste: apps/api/src/ia/execucao-interrompida.int.test.ts › worker morto
-    tokensDeEntrada: tarefa.maximoDeTokensDeEntrada,
+    tokensDeEntrada: 0,
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o adaptador falso: origem `falso`
-  return config.modelo === undefined ? new FakeAdapter(config.latenciaFalsaMs === undefined ? {} : { latenciaMs: config.latenciaFalsaMs }) : new OpenAICompatAdapter(config.modelo)
+  return config.modelo !== undefined ? new FakeAdapter(config.latenciaFalsaMs === undefined ? {} : { latenciaMs: config.latenciaFalsaMs }) : new OpenAICompatAdapter(config.modelo)
```

Sem bloco, com o motivo (o resultado da execução não muda sem eles):

- `order by r.iniciada_em` e `order by p.criada_em`: só a ordem em que o lote pega as mais antigas primeiro; o conjunto encerrado ao fim das voltas é o mesmo, e o `limit` (com bloco) é o que limita.
- `config.latenciaFalsaMs === undefined ? {} : { latenciaMs: config.latenciaFalsaMs }`: a linha que veio do `createLLMGateway`, movida sem mudar; a latência do adaptador falso é coberta por `llm-gateway.test.ts` › criarProvedorDeIa: com latenciaFalsaMs, e não entra em `destinoDoAdaptador`.

## Recomendações sem aplicar

Herdada da tarefa 2.0 (copiada da tabela dela antes de a 6.0 começar; lá o destino diz 5.0, e vem para cá porque é a 6.0 que trata da reentrega e da corrida):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| test-engineer (2ª da 2.0) | O `Promise.all` roda depois de o turno já ter gravado; falta a corrida das duas primeiras gravações de `assunto_delicado` (o job em dois workers) | tarefa 6.0 (reentrega e corrida, D49) |

**Resolvida na 6.0:** a recomendação do `test-engineer` (2ª da 2.0) virou o caso "o job em dois workers" de `tutor-modelo.int.test.ts` (a 1.ª entrega parada na gravação do sinal, a 2.ª encerra a execução com `EXECUCAO_INTERROMPIDA` sem chegar a gravar: um sinal e uma mensagem fixa), além do "D36 na reentrega".

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-16 04:29:41 | 2026-11-16 04:30:39 | `tenancy-guardian` | 1 | APROVADO | aaf79340f031433cc |
| 2026-11-16 04:29:53 | 2026-11-16 04:30:52 | `conformidade-reviewer` | 1 | APROVADO | a49d65c9fedff39b3 |
| 2026-11-16 04:29:50 | 2026-11-16 04:31:13 | `revisor-geral` | 1 | APROVADO | a08e2c7684773275f |
| 2026-11-16 04:29:43 | 2026-11-16 04:32:35 | `infra-guardian` | 1 | APROVADO | ae10cd233b08dbc39 |
| 2026-11-16 04:29:38 | 2026-11-16 04:33:02 | `privacy-guardian` | 1 | APROVADO | a969a00310131317f |
| 2026-11-16 04:29:47 | 2026-11-16 04:35:38 | `test-engineer` | 1 | APROVADO | a9c497e59c57b44f8 |

Da ordem de correção da 1ª rodada (`.processo/ordens/6_task-r1.md`), "Sem aplicar":

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| infra-guardian (1ª) | Trocar `j.dados ->> 'execucaoId' = p.id::text` por `j.chave_idempotencia = p.id::text` no `not exists` da `pendente`, para achar o job pelo índice único e não ler todos os jobs vivos da escola | `TODO.md`: muda o SQL, o `EXPLAIN` e os blocos de "Mutações" que citam a linha; só pesa com centenas de `pendente` e o Redis fora, e o passo falha sem estragar nada (`statement_timeout`) |
| infra-guardian (1ª) | Gravar as linhas estimadas da `rodando` num `insert` só, para o passo ter dois comandos e a conta de 50 s valer de fato | `TODO.md`: muda código e o bloco de mutação "a gravação da linha falha"; na prática dá milissegundos e a volta em curso não se sobrepõe |
| infra-guardian (1ª) | Contador `ia.execucao.interrompida` por escola e origem (reentrega ou varredura) | tarefa 7.0 (`7_task.md`: métrica do corte e alerta ao operador, toca `execucao.processor.ts` e `execucao.repository.ts`) |
| infra-guardian (1ª) | Cenário de carga: quem semear `pendente` sem job vê a varredura encerrá-la em até 60 s | tarefa 11.0 (a carga da manhã); o `expurgo-da-carga.ts` já semeia execuções concluídas |
| revisor-geral (1ª) | No desligamento, `#varredura.encerrar()` não espera o passo em curso, e o pool pode fechar no meio dele | `TODO.md`: muda o comportamento do desligamento; o resultado sai certo (a transação se desfaz) e o custo é uma linha de log |
| revisor-geral (1ª) | Avisar, no painel de custo ou na 9.0, que a linha `EXECUCAO_INTERROMPIDA` é estimativa | `TODO.md`: a tarefa não toca `apps/web`, e a 9.0 conta o que a professora vê, não o custo |
| privacy-guardian (1ª) | Frase na tela "Meus dados" e nos pedidos do titular dizendo que um provedor listado pode ser estimativa de execução interrompida | `TODO.md`: texto de tela fora do escopo desta tarefa (sem `apps/web`) |
| test-engineer (1ª) | O `EXPLAIN` roda a consulta de um job avulso, e não o `update … not exists` correlacionado que roda de fato | `TODO.md`: o teste prova o índice, a fila e a escola na condição, que são o que o revisor de infra aprovou |
| test-engineer (1ª) | Caso em paralelo de `encerrarRodando` com `encerrarRodandasVelhas` na mesma `rodando` | Recusada: é o mesmo mecanismo (condição de estado com a trava da linha), provado em "duplicada em corrida" e em "varredura, duas réplicas" |
| test-engineer (1ª) | O `set local statement_timeout = 5000` não tem teste que falhe sem ele, e afrouxa o de 2 s do `.env.example` | Recusada como mudança de código: o 5 s por passo é a conta da Tech Spec §7c (2 tipos × 5 passos × 5 s = 50 s); "a conta do laço" confere só que o pior caso cabe nos 60 s, e o teste que falharia sem o `set local` vai para o `TODO.md` |
| test-engineer (1ª) | Os dois primeiros blocos do arquivo gravam jobs `aguardando` sem parar os processos da fila do compose | `TODO.md`: mesmo padrão de `apps/api/src/ia/fila-de-ia.int.test.ts` (5.0); no portão e na esteira só sobe a infraestrutura |
| tenancy-guardian (1ª) | Confirmar no portão que `apps/api/test/architecture.test.ts` passa com as duas `@Unscoped` novas | Sem ação extra: o portão da tarefa o roda; só o resultado dele vale |
| 2026-11-16 04:52:16 | 2026-11-16 04:52:31 | `tenancy-guardian` | 2 | APROVADO | acee761d32a2a4b85 |
| 2026-11-16 04:52:11 | 2026-11-16 04:52:33 | `privacy-guardian` | 2 | APROVADO | a9a04a596ae5071e6 |
| 2026-11-16 04:52:21 | 2026-11-16 04:52:41 | `infra-guardian` | 2 | APROVADO | a9c510d4011c2e3f1 |
| 2026-11-16 04:52:36 | 2026-11-16 04:52:54 | `conformidade-reviewer` | 2 | APROVADO | a1777ea61276282c6 |
| 2026-11-16 04:52:31 | 2026-11-16 04:53:13 | `revisor-geral` | 2 | APROVADO | ab1b5447187716b4a |
| 2026-11-16 04:52:26 | 2026-11-16 04:53:18 | `test-engineer` | 2 | APROVADO | a5a2aede7858413d5 |

Da 2ª rodada (`.processo/ordens/6_task-r2.md`), "Sem aplicar":

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| test-engineer (2ª) e revisor-geral (2ª) | A recusa do `set local statement_timeout` diz que "a conta do laço" confere os 5 s por passo; com a igualdade retirada, o caso confere só o teto de 60 s, e nenhum teste fica vermelho sem o `set local statement_timeout` | O motivo da linha da 1ª rodada foi reescrito acima; o teste que falharia sem o `set local` vai para o `TODO.md`, na seção da 6.0 |
| infra-guardian (2ª) | Derivar `PIOR_CASO_DA_VARREDURA_MS` do `statement_timeout` por passo no código, para a constante e o prazo não se separarem | `TODO.md`, na mesma linha do teste do `set local statement_timeout` |
| test-engineer (2ª) e revisor-geral (2ª) | "varredura, duas réplicas na `pendente`" não confere mais o número que `varrer()` devolve (o `pendentesTotal` do log); ou se tira "e contada" do nome, ou se confere a soma dos retornos restrita àquela execução | `TODO.md`: mexe só em teste, e aplicar agora caducaria o `test-engineer` e o `revisor-geral` aprovados |
| infra-guardian (2ª) | As sobras `teste_encerramentos_*` (gatilho, função e sequência) ficam no banco de teste se o processo morrer antes do `finally`; apagá-las no preparo da bancada | `TODO.md`: não afeta o resultado (o `when` está preso ao id da execução) |
| conformidade-reviewer (2ª) | O rótulo de "estimativa" na tela de custo deve deixar claro que nada foi gerado para o aluno, só o custo foi presumido (regra 70, item 6) | `TODO.md`: acrescentada à linha existente "Avisar, no painel de custo, que a linha `EXECUCAO_INTERROMPIDA` é estimativa" |
| privacy-guardian (2ª) | Levar a frase "um provedor listado pode ser estimativa" também ao arquivo do titular que a escola exporta (o JSON do pedido de acesso), e não só à tela "Meus dados" | `TODO.md`: acrescentada à linha existente da frase de "Meus dados" |
