# Tarefa 4.0 — O motor da planilha grava o calendário: prévia, gravar e job em três passos

**Funcionalidade:** onboarding-por-convite · **Depende de:** 2.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

A planilha de calendário entra pela API: a prévia classifica, gravar responde 202 e enfileira, e o job
`estrutura.gravar-planilha` refaz a classificação e grava em três passos. É o motor das outras três planilhas.

## Contexto necessário

- `techspec.md` §4 (as três rotas de importação; o filtro `anoLetivoId`), §5 "Planilha", "O job" e a tabela de estados,
  "Gravar" (só "Calendário: substitui no ano"), §6, §7c
- `prd.md` RF2, RF10, RF15, RF16, RF17
- `cenarios.md` RF2, RF10, "Job e estados"
- Regra 00 item 4; regra 80 itens 2, 3 e 7; D49
- Código: `packages/core/src/queue/`; `packages/shared/src/system/job-definitions.ts` e o teste dele; `apps/worker/src/composition.ts`, `job-executor.ts`, `composition.test.ts`; `apps/api/src/estrutura/lista/`

## Subtarefas

- [x] 4.1 — `packages/core/src/importacao/`: o motor (classificação em lote, assinatura, três passos, escrita condicional, resultados) e o tipo calendário
- [x] 4.2 — `ImportacaoRepository` com escopo; o gravar refaz a prévia, fecha `falhou` a `na_fila` de mais de 1 h (`for update nowait`; travada: `CONFLITO`) e enfileira
- [x] 4.3 — Rotas `POST /v1/importacoes/:tipo/previa` e `POST /v1/importacoes/:tipo` (coordenador), com o filtro `anoLetivoId` validado no servidor
- [x] 4.4 — `estrutura.gravar-planilha` em `packages/shared/src/system/job-definitions.ts` (constante `TIPO_GRAVAR_PLANILHA`, fila `normal`, escopo `escola`, executor `worker`, dados estritos só com o id da importação), vinda da 2.2; `apps/worker/src/processors/gravar-planilha.ts`: escola da linha; os tempos do passo (3); nova tentativa com espera crescente; métricas por resultado e do passo (3)
- [x] 4.5 — Auditoria `planilha.gravada` (tipo e contagens)
- [x] 4.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/importacao/motor.ts`, `importacao.repository.ts`, `tipos/calendario.ts`, `index.ts` | novo |
| `apps/api/src/estrutura/importacao/importacao.controller.ts`, `importacao.service.ts` | novo |
| `apps/api/src/estrutura/estrutura.module.ts` | alterado |
| `apps/worker/src/processors/gravar-planilha.ts` | novo |
| `apps/worker/src/composition.ts` | alterado |
| `packages/shared/src/system/job-definitions.ts`, `job-definitions.test.ts` | alterado |
| `apps/api/test/importacao.int.test.ts`, `apps/worker/test/gravar-planilha.int.test.ts` | novo |

## Testes que provam a regra

`A` é `apps/api/test/importacao.int.test.ts`; `W` é `apps/worker/test/gravar-planilha.int.test.ts`. Os de unidade do motor (`leitor.test.ts`, `tipos/calendario.test.ts`, `motor.test.ts`, em `packages/core/src/importacao/`) provam a leitura e o calendário linha a linha.

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| Calendário: a prévia classifica, gravar responde 202 e o job conclui | integração | caminho feliz |  A › caminho feliz; W › o job conclui |
| Gravar sem prévia, com texto errado: `ENTRADA_INVALIDA`, nenhuma importação | integração | RF2 |  A › gravar sem prévia, com texto errado |
| Marca fora dos candidatos: `ENTRADA_INVALIDA` | integração | RF2 |  A › marca fora dos candidatos (o id inexistente e o de outra escola, nas três marcas) |
| Data fora do ano letivo: erro na linha | integração | RF10 |  A › a prévia aponta o erro de cada linha |
| Evento de um dia entra; fim antes do início é erro | integração | borda (feriado de um dia) |  A › borda: o evento de um dia entra |
| Reimportar substitui só no ano de destino | integração | RF10 |  A › reimportar substitui só no ano de destino |
| A prévia mostra o que entra e o que sai | integração | RF10 |  A › a prévia mostra o que entra, o que já existe e o que sai |
| [P] Gravar duas vezes: uma `na_fila`, a outra `CONFLITO` | [P] | único parcial |  A › [P] gravar duas vezes ao mesmo tempo |
| `na_fila` há mais de 1 h: o gravar seguinte a fecha `falhou` (`expirada`) | integração | |  A › `na_fila` há mais de 1 h (o código gravado é `expirou`); A › o fechamento da expirada só trava a `na_fila` velha desta escola |
| `na_fila` travada por um job rodando: `CONFLITO` sem esperar | integração | `nowait` |  A › `na_fila` velha travada por um job que roda |
| Assinatura diferente: `desatualizada` | integração | |  A › assinatura diferente; W › assinatura diferente antes do job; W › assinatura que muda entre o passo (2) e o (3) |
| Ano encerrado entre o gravar e o job: `desatualizada` | integração | |  A › ano encerrado entre o gravar e o job; W › ano encerrado antes do job |
| [P] `encerrar` do ano com o job pausado: espera ou `desatualizada`; nunca grava no ano encerrado | [P] | `FOR SHARE` do ano |  A › [P] `encerrar` do ano com o job parado depois de ler o ano (espera); A › [P] `encerrar` do ano em andamento, o job vê o ano já encerrado (`desatualizada`) |
| [P] Duas execuções, barreira depois do (2): um conjunto de eventos; métrica com uma `concluida` e uma `ignorada` | [P] | `for update` |  W › [P] duas execuções do mesmo job |
| Falha no segundo lote de 1.200 eventos, sempre: `na_fila` e zero eventos entre tentativas; no fim, `falhou` | integração | uma transação |  W › falha no segundo lote de 1.200 eventos, sempre; W › único violado no passo (3) |
| Ano travado mais de 1 s no (3): nada parcial; solto, conclui; sempre travado, `falhou` | integração | `lock_timeout` |  W › ano travado por mais de 1 s no passo (3) (solto, conclui); W › ano sempre travado (`falhou`, `trava_esgotada`) |
| `linhas` e `marcas` nulas em `concluida`, `desatualizada` e `falhou` | integração | |  W › o job conclui (`concluida`); W › assinatura diferente antes do job (`desatualizada`); W › falha no segundo lote (`falhou`) |
| Tentativas esgotadas e falha definitiva: `falhou` com o código | integração | |  W › falha no segundo lote (esgotadas, `erro_interno`); W › ano sempre travado (`trava_esgotada`); W › falha definitiva (a importação guardada não tem a forma do tipo); W › falha definitiva também quando o tipo não é um que o motor grava |
| Com o payload adulterado, o job usa a escola da linha | integração | isolamento |  W › com o payload adulterado; W › o repository: as trocas de estado (a leitura, a troca de estado e o calendário, escola A contra B) |
| Prévia e gravar com `turmaId` ou marca da B: igual a inexistente | integração | isolamento |  A › isolamento: o `turmaId` de outra escola numa planilha que não usa turma; A › marca fora dos candidatos |
| Sem ano em curso: prévia e gravar com o filtro do planejado funcionam; sem filtro, `NAO_ENCONTRADO` | integração | ano |  A › sem ano em curso |
| Filtro com ano de outra escola ou encerrado: `NAO_ENCONTRADO` | integração | ano |  A › filtro com o ano de outra escola (inclusive o planejado dela), o encerrado, o em curso ou o inexistente |
| Professor na prévia e no gravar: recusado | integração | permissão |  A › o professor, o aluno e o tipo que não existe |
| Auditoria `planilha.gravada` com tipo e contagens, sem nome | integração | RF17 |  A › auditoria: `planilha.gravada` leva o tipo e as contagens; A › quem gravou já saiu |
| Log do job: ids, contagens e código, nunca a linha | integração | regra 20, item 9 |  W › o log do job traz só ids, contagem de tentativa, estado e código |

## Como testar

- API: `apps/api/test/lista.int.test.ts › a prévia aponta cada linha ruim com o código, entre as boas; …` (`escolaComTurmas()`); isolamento: `apps/api/test/estrutura-isolamento.int.test.ts › a turma de B, no contexto de A, …`
- Worker com relógio: `apps/worker/test/expurgo-de-acesso.int.test.ts` (`relogioEm`, o processor criado com repositório e relógio)
- Barreira e trava: `WriteBlockTrigger`, `esperarNaTrava` (`apps/api/test/write-block-trigger.ts`); auditoria: `auditoriaDa(bancada, escolaId, acao)` (`apps/api/test/material.fixture.ts`)
- Comandos: `npx vitest run --project integracao apps/api/test/importacao.int.test.ts apps/worker/test/gravar-planilha.int.test.ts`
- Registro de jobs: `apps/worker/src/composition.test.ts` exige processador para todo tipo do worker na réplica de cada fila dele, e o 3º caso lista os tipos da `normal` (passa a incluir o novo); `job-definitions.test.ts` conta os tipos e fixa os prazos: o novo entra na lista e no `prazoMs`
- Armadilhas: o desfecho de uma execução se prova chamando o processor (tentativa 1); nos [P] do `lock_timeout`, só o estado final

## Autoconferência

As 12 perguntas do modelo, no plano. Na 4, o gravar com erro precisa chegar ao `refaz a prévia`, não parar no limite de tamanho.

1. **Mutação de cada cláusula:** 75 blocos na seção "Mutações" (cada um rodado antes, com a saída vermelha de um caso que rodou), e 16 linhas (14 motivos) com o motivo escrito (guarda de tipo, `?? ''` do índice, atalho equivalente, cláusula que a FK composta ou o `for update` da mesma transação já garante). As cópias da mesma regra em outro arquivo (o escopo do `anoPorId`, do `eventosDoAno` e do `apagarEventos`) têm bloco ou motivo cada uma.
2. **O texto na tela:** a tarefa não tem tela; não se aplica.
3. **O segundo dado:** o fechamento da expirada tem a `na_fila` velha de outra escola e a já concluída, as duas travadas por outra transação; a cópia a mais de um evento (feita à mão) tem dois iguais no banco; o `apagarEventos` tem o evento de outro ano da mesma escola e o de outra escola; a assinatura tem o evento posto à mão antes do job e entre o (2) e o (3).
4. **Checagem anterior que responde antes:** o gravar com texto errado usa uma planilha de poucas linhas, abaixo dos 512 KB, para chegar à prévia refeita e não parar no limite de tamanho (o caso de 300 KB prova que o corpo grande, que o Express recusaria, chega). O `:tipo` que não existe responde pelo pipe e pelo motor, igual. O ano do filtro de outra escola chega ao `anoDeDestino` (e não cai em `requireAnoEmCurso`) porque o filtro vem no corpo.
5. **Resultado, não forma do código:** as asserções leem `evento_calendario`, `importacao_planilha`, `auditoria`, `job_registro` e a métrica; o log é lido por chave e por texto (a descrição do evento e o erro do banco nunca aparecem).
6. **Guarda nova:** nenhuma regra de lint nem teste estrutural novo; a tarefa passa pelas existentes (`repositories-com-escopo`, `tabela-so-no-repository`, camadas, nome de mercado, `painel.test`). Não se aplica.
7. **Comentários:** relidos contra o código. Corrigidos: o do `criar` (o `CONFLITO` vem do filtro global e não do motor) e o do `leitor.ts` (o marcador do Excel sai com o `trim`).
8. **A divergência cria regra?** Duas: "quem gravou já saiu: `desatualizada`" e "corpo JSON de até 1 MB". As duas entraram em `techspec.md` §4 e §5 e em `cenarios.md` ("Job e estados") antes dos revisores; a primeira tem caso (`quem gravou já saiu`) e a resposta do `privacy-guardian` está no motivo: a rotina não assina a ação (`auditoria_rotina_so_nas_acoes`). O `grep` de `criado_por` e `planilha.gravada` na spec mostra só essas linhas.
9. **Peça que já existe:** `JobOutbox`/`JobOutboxRepository`, `AuditoriaRecorder`, `postgresErrorIn`, `requireEscolaId`/`requireAnoEmCurso`, `ZodValidationPipe`, `RequirePermissao`, `WriteBlockTrigger`/`esperarNaTrava`, `QueueFixtures`, `MedidorDeTeste`; a leitura de tabela e o calendário são novos (nenhum leitor de CSV existia).
10. **Corrida:** `Promise.all` no gravar duas vezes (efeito no banco: um 202 e um 409, um job); as outras quatro têm a ordem forçada (`WriteBlockTrigger` e `esperarNaTrava` para o `FOR SHARE` do ano, para as duas execuções do job e para a assinatura entre o (2) e o (3)).
11. **Isolamento e coluna "Caso":** cada linha da tabela tem o caso. O isolamento tem o `turmaId` e a marca de B, a importação de A no job de B, o repository de A contra o ano e o calendário de B, e cada um tem bloco que o deixa vermelho sem a cláusula.
12. **O que verificar dos guardiões:** `tenancy-guardian` (escopo no repository, 404 igual, importação e ano de outra escola, a escola vem da linha do job), `privacy-guardian` (log sem linha, `linhas`/`marcas` apagadas em toda troca de estado, auditoria sem nome, autor humano), `infra-guardian` (tempos do passo 3, `nowait`, ordem de trava, retentativa, métricas e painel). O `achados/indice.md` só tem rodadas da spec e das tarefas 1.0 a 3.0, sem linha que toque o motor da planilha.

## Fora do escopo desta tarefa

Limites, expurgos e leituras (5.0); os outros tipos (6.0, 7.0, 11.0); telas (13.0, 14.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| A importação de quem já saiu (`criado_por` nulo) sai `desatualizada`, sem gravar | A auditoria `planilha.gravada` precisa de autor humano e a rotina não assina a ação (`auditoria_rotina_so_nas_acoes`, 3.0 do F3); a spec não dizia o que o job faz quando `criado_por` é nulo | `techspec.md` §5 "O job"; `cenarios.md` "Job e estados" (linha nova, [I]); a seção 11 não muda |
| A API lê corpo JSON de até 1 MB (`LIMITE_DO_CORPO_JSON`, em `configure-app.ts`) | O padrão do Express é 100 KB; a planilha de 512 KB escapada em JSON passa de 600 KB e sairia `ERRO_INTERNO` | `techspec.md` §4, parágrafo do `anoLetivoId`; a seção 11 não muda |
| Arquivos além dos "previstos": `leitor.ts`, `tipo.ts` (o contrato do tipo, fora do `motor.ts` para não fazer ciclo com `tipos/calendario.ts`), `packages/shared/src/permissao/matriz.ts`, `matriz.expectativa.ts` e `matriz.test.ts` (recurso `importacao_planilha`), `packages/core/src/auditoria/acoes.ts` (`planilha.gravada`), `packages/core/src/telemetry/metrics.ts` e `tools/testes/metricas.ts` (as duas métricas do job), `packages/core/src/index.ts`, `packages/shared/src/index.ts`, `apps/worker/src/composition.test.ts` e `job-executor.test.ts`, `apps/api/test/sessao.fixture.ts` (a limpeza apaga `importacao_planilha` e `evento_calendario` antes do ano), `infra/grafana/paineis/fundacao.json` (dois painéis; `infra/test/painel.test.ts` exige painel para toda métrica), `docs/arquitetura.md` (o job da planilha) e os testes de unidade `leitor.test.ts`, `tipos/calendario.test.ts`, `motor.test.ts` | Cada um é o ponto onde o código novo precisa existir para o portão passar (permissão, auditoria, métrica, painel, exportação) ou onde o contrato do tipo precisa ficar fora do motor | `techspec.md` §2 e §7c (métricas e permissão já descritas); regra 80 item 10; a seção 11 não muda |
| O contrato `CHAVES_DO_RESUMO_DA_IMPORTACAO` (2.0) ganha `eventos_removidos`; a auditoria grava `corrigidos` no lugar de `nomes_corrigidos` | O resumo do calendário conta o que a reimportação tira do ano; o nome de campo com "nome" é recusado pelo mapa de auditoria (lista de nomes proibidos) | `techspec.md` §5 "Gravar" (calendário substitui no ano); `cenarios.md` "Calendário" (a prévia mostra o que sai); regra 20 item 9 |
| O código gravado na `na_fila` fechada pelo gravar é `expirou`, e não `expirada` | O check `importacao_planilha_erro_valido` da 2.0 só aceita `expirou`; a linha da tabela de testes escreveu `expirada` | `cenarios.md` "Job e estados" (a linha do `na_fila` há mais de 1 h passou de `expirada` para `expirou`); check do banco em `importacao-planilha.ts` |

## Mutações

--faltando: 16 linhas (75 blocos, 14 motivos)

**Sem bloco (motivo):** (1) `importacao.controller.ts:23`, o `throw` do pipe do `:tipo`: sem ele o pipe devolve `undefined`, e `tipoDoMotor(undefined)` responde o mesmo `NAO_ENCONTRADO` (o caso do tipo que não existe, com `constructor` e `toString`, passa igual); a linha é a primeira camada, equivalente à do motor. (2) `composition.ts:293`, o `medidor === undefined ? {} : { medidor }`: só repassa o medidor que a composição recebe, a mesma expressão das rotinas; a métrica por resultado e a do passo (3) são lidas no processor em `gravar-planilha.int.test.ts` (o caso `o job conclui`). (3) `acoes.ts:80`, o `nomes_corrigidos` → `corrigidos`: sem ele o mapa de auditoria tem chave com "nome" e o módulo não carrega (erro de carga, não um caso vermelho); a 7.0, que conta `nomes_corrigidos`, traz o caso. (4) `:114`, `if (velhas.length === 0) return`: atalho que poupa o `update` vazio; sem ele o `inArray` com lista vazia vira `false` e nada muda. (5) `:118`, o `update` da expirada: os ids vêm do `select … for update nowait` da mesma transação, que já filtra por escola e `na_fila` (os blocos do `select` têm caso); as três cláusulas do `update` ficam como segunda camada. (6) `:139`, `if (criada === undefined) throw`: o `insert … returning` sempre devolve a linha; é guarda de tipo. (7) `:195`, o `?? null` do resumo e do erro: o `update` com `undefined` omite a coluna, que nasce nula e nunca foi escrita; `null` e omitido são o mesmo. (8) `motor.ts:182`, `plano === undefined` no passo (3): ele relê o `linhas` que o (2) acabou de validar, sob o `for update` da importação, que só o job escreve; nenhum caso chega ali. (9) `:185`, `concluir` devolver `false`: a importação está travada e `na_fila` desde a linha 176; guarda de invariante. (10) `:192`, `'desatualizada' : 'ignorada'`: o `false` do repository (que tem caso: `o repository: as trocas de estado`) só chega ali se outra execução fecha a importação entre a leitura e o (2), e o banco de teste não tem ponto de parada nesse intervalo. (11) `:202`, `corrigidos === undefined`: a chave `nomes_corrigidos` só existe nas planilhas de alunos (7.0); o calendário não a conta, e a 7.0 acrescenta o bloco e o caso. (12) `:203`, `contexto?.requisicaoId ?? randomUUID()`: o job sempre abre o contexto com `requisicaoId`; o `??` só cobre o uso fora do job. (13) `calendario.ts:37`, o `undefined` das três partes da data: rede de tipo (`noUncheckedIndexedAccess`); sem ela o `Number(undefined)` dá `NaN` e a linha 40 devolve `null` do mesmo jeito (a data que não existe tem bloco). (14) `:48`, `:49` e `:68`, os `?? ''` de `campos[...]`: o `campos` vem de `lerTabela` com todas as colunas do cabeçalho; o `?? ''` é só o tipo do índice.

A réplica da `normal` sem o processador da planilha.

```mutacao
arquivo: apps/worker/src/composition.ts
teste: apps/worker/src/composition.test.ts › o arquivo do titular e a planilha só na
-processadores: { [TIPO_JOB_SINTETICO]: createSyntheticProcessor(pecas.cpu, pecas.efeitos), ...rotinas?.processadores, ...(config.pools.normal === undefined ? {} : processadoresDaNormal(pecas)) },
+processadores: { [TIPO_JOB_SINTETICO]: createSyntheticProcessor(pecas.cpu, pecas.efeitos), ...rotinas?.processadores, ...{} },
```

O arquivo do titular sai da `normal` quando há armazém.

```mutacao
arquivo: apps/worker/src/composition.ts
teste: apps/worker/src/composition.test.ts › o arquivo do titular e a planilha só na
-...(armazem === undefined ? {} : { [TIPO_MONTAR_ARQUIVO]: criarMontagemDoArquivo({ banco, armazem, relogio, logger }) }),
+...{},
```

A falha definitiva repete como se fosse trava: o job do tipo ilegível volta à fila.

```mutacao
arquivo: apps/worker/src/processors/gravar-planilha.ts
teste: apps/worker/test/gravar-planilha.int.test.ts › guardada não tem a forma do tipo
-if (!definitiva && !ultimaTentativa) {
+if (!ultimaTentativa) {
```

A última tentativa repete: a importação nunca sai `falhou`.

```mutacao
arquivo: apps/worker/src/processors/gravar-planilha.ts
teste: apps/worker/test/gravar-planilha.int.test.ts › falha no segundo lote
-if (!definitiva && !ultimaTentativa) {
+if (!definitiva) {
```

O código da trava esgotada some: toda falha sai `erro_interno`.

```mutacao
arquivo: apps/worker/src/processors/gravar-planilha.ts
teste: apps/worker/test/gravar-planilha.int.test.ts › ano sempre travado
-const codigo = ehFalhaDeTrava(erro) ? 'trava_esgotada' : 'erro_interno'
+const codigo = 'erro_interno'
```

O log diz sempre `ja_fechada`.

```mutacao
arquivo: apps/worker/src/processors/gravar-planilha.ts
teste: apps/worker/test/gravar-planilha.int.test.ts › o log do job
-logger.error({ evento: 'importacao.job_falhou', importacaoId, tentativa: execucao.tentativa, codigo, estado: fechada ? 'falhou' : 'ja_fechada' })
+logger.error({ evento: 'importacao.job_falhou', importacaoId, tentativa: execucao.tentativa, codigo, estado: 'ja_fechada' })
```

A falha definitiva não vira `JobFailureError`: o executor a repetiria.

```mutacao
arquivo: apps/worker/src/processors/gravar-planilha.ts
teste: apps/worker/test/gravar-planilha.int.test.ts › guardada não tem a forma do tipo
-if (definitiva) throw new JobFailureError(JobFailureCode.DADOS_INVALIDOS, true)
```

O filtro `anoLetivoId` aceita qualquer ano da escola, não só o planejado.

```mutacao
arquivo: packages/core/src/importacao/importacao.repository.ts
teste: apps/api/test/importacao.int.test.ts › filtro com o ano de outra escola
-const doDestino = anoLetivoId === undefined ? and(eq(anoLetivo.id, requireAnoEmCurso()), eq(anoLetivo.situacao, 'em_curso')) : and(eq(anoLetivo.id, anoLetivoId), eq(anoLetivo.situacao, 'planejado'))
+const doDestino = anoLetivoId === undefined ? and(eq(anoLetivo.id, requireAnoEmCurso()), eq(anoLetivo.situacao, 'em_curso')) : eq(anoLetivo.id, anoLetivoId)
```

O ano de destino sem o escopo da escola: o ano planejado de B é achado no contexto de A.

```mutacao
arquivo: packages/core/src/importacao/importacao.repository.ts
teste: apps/api/test/importacao.int.test.ts › filtro com o ano de outra escola
-.where(and(eq(anoLetivo.escolaId, requireEscolaId()), doDestino))
+.where(doDestino)
```

O `FOR SHARE` do ano some: o `encerrar` não espera o passo (3).

```mutacao
arquivo: packages/core/src/importacao/importacao.repository.ts
teste: apps/api/test/importacao.int.test.ts › job parado depois de ler o ano
-const [ano] = await (travar ? consulta.for('share') : consulta)
+const [ano] = await consulta
```

A expirada fecha também a `na_fila` de menos de 1 h.

```mutacao
arquivo: packages/core/src/importacao/importacao.repository.ts
teste: apps/api/test/importacao.int.test.ts › há mais de 1 h
-.where(and(eq(importacaoPlanilha.escolaId, escolaId), eq(importacaoPlanilha.estado, 'na_fila'), lt(importacaoPlanilha.criadoEm, sql`now() - ${PRAZO_DA_FILA}`)))
+.where(and(eq(importacaoPlanilha.escolaId, escolaId), eq(importacaoPlanilha.estado, 'na_fila')))
```

A expirada fecha a de outra escola.

```mutacao
arquivo: packages/core/src/importacao/importacao.repository.ts
teste: apps/api/test/importacao.int.test.ts › só trava a `na_fila` velha desta escola
-.where(and(eq(importacaoPlanilha.escolaId, escolaId), eq(importacaoPlanilha.estado, 'na_fila'), lt(importacaoPlanilha.criadoEm, sql`now() - ${PRAZO_DA_FILA}`)))
+.where(and(eq(importacaoPlanilha.estado, 'na_fila'), lt(importacaoPlanilha.criadoEm, sql`now() - ${PRAZO_DA_FILA}`)))
```

A expirada fecha também a importação já concluída.

```mutacao
arquivo: packages/core/src/importacao/importacao.repository.ts
teste: apps/api/test/importacao.int.test.ts › só trava a `na_fila` velha desta escola
-.where(and(eq(importacaoPlanilha.escolaId, escolaId), eq(importacaoPlanilha.estado, 'na_fila'), lt(importacaoPlanilha.criadoEm, sql`now() - ${PRAZO_DA_FILA}`)))
+.where(and(eq(importacaoPlanilha.escolaId, escolaId), lt(importacaoPlanilha.criadoEm, sql`now() - ${PRAZO_DA_FILA}`)))
```

A trava não esperada (`nowait`) deixa de virar `CONFLITO`.

```mutacao
arquivo: packages/core/src/importacao/importacao.repository.ts
teste: apps/api/test/importacao.int.test.ts › velha travada por um job que roda
-if (postgresErrorIn(erro)?.code === SQLSTATE_TRAVA_NAO_DISPONIVEL) throw new DomainException(ErrorCode.CONFLITO)
```

A leitura da importação sem o escopo da escola: o job de B lê a importação de A.

```mutacao
arquivo: packages/core/src/importacao/importacao.repository.ts
teste: apps/worker/test/gravar-planilha.int.test.ts › o repository: as trocas de estado
-.where(and(eq(importacaoPlanilha.escolaId, requireEscolaId()), eq(importacaoPlanilha.id, id)))
+.where(eq(importacaoPlanilha.id, id))
```

O `for update` da importação some: duas execuções ao mesmo tempo não se esperam.

```mutacao
arquivo: packages/core/src/importacao/importacao.repository.ts
teste: apps/worker/test/gravar-planilha.int.test.ts › duas execuções do mesmo job
-const [linha] = await (travar ? consulta.for('update') : consulta)
+const [linha] = await consulta
```

A troca de estado sem o escopo da escola.

```mutacao
arquivo: packages/core/src/importacao/importacao.repository.ts
teste: apps/worker/test/gravar-planilha.int.test.ts › o repository: as trocas de estado
-.where(and(eq(importacaoPlanilha.escolaId, requireEscolaId()), eq(importacaoPlanilha.id, id), eq(importacaoPlanilha.estado, 'na_fila')))
+.where(and(eq(importacaoPlanilha.id, id), eq(importacaoPlanilha.estado, 'na_fila')))
```

A troca de estado sem a condição `na_fila`: a fechada é reescrita.

```mutacao
arquivo: packages/core/src/importacao/importacao.repository.ts
teste: apps/worker/test/gravar-planilha.int.test.ts › o repository: as trocas de estado
-.where(and(eq(importacaoPlanilha.escolaId, requireEscolaId()), eq(importacaoPlanilha.id, id), eq(importacaoPlanilha.estado, 'na_fila')))
+.where(and(eq(importacaoPlanilha.escolaId, requireEscolaId()), eq(importacaoPlanilha.id, id)))
```

Os eventos do ano lidos sem o escopo da escola.

```mutacao
arquivo: packages/core/src/importacao/importacao.repository.ts
teste: apps/worker/test/gravar-planilha.int.test.ts › o repository: as trocas de estado
-.where(and(eq(eventoCalendario.escolaId, requireEscolaId()), eq(eventoCalendario.anoLetivoId, anoLetivoId)))
+.where(eq(eventoCalendario.anoLetivoId, anoLetivoId))
```

Os eventos apagados sem o escopo da escola.

```mutacao
arquivo: packages/core/src/importacao/importacao.repository.ts
teste: apps/worker/test/gravar-planilha.int.test.ts › o repository: as trocas de estado
-.where(and(eq(eventoCalendario.escolaId, escolaId), eq(eventoCalendario.anoLetivoId, anoLetivoId), inArray(eventoCalendario.id, ids.slice(inicio, inicio + TAMANHO_DO_LOTE))))
+(and(eq(eventoCalendario.anoLetivoId, anoLetivoId), inArray(eventoCalendario.id, ids.slice(inicio, inicio + TAMANHO_DO_LOTE))))
```

Os eventos apagados sem o ano: o evento de outro ano da escola sai.

```mutacao
arquivo: packages/core/src/importacao/importacao.repository.ts
teste: apps/worker/test/gravar-planilha.int.test.ts › o repository: as trocas de estado
-.where(and(eq(eventoCalendario.escolaId, escolaId), eq(eventoCalendario.anoLetivoId, anoLetivoId), inArray(eventoCalendario.id, ids.slice(inicio, inicio + TAMANHO_DO_LOTE))))
+.where(and(eq(eventoCalendario.escolaId, escolaId), inArray(eventoCalendario.id, ids.slice(inicio, inicio + TAMANHO_DO_LOTE))))
```

O acento não sai do cabeçalho.

```mutacao
arquivo: packages/core/src/importacao/leitor.ts
teste: packages/core/src/importacao/leitor.test.ts › aceita o cabeçalho em outra ordem
-return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
+return texto.normalize('NFD').toLowerCase().replace(/\s+/g, ' ').trim()
```

O campo entre aspas deixa de agrupar.

```mutacao
arquivo: packages/core/src/importacao/leitor.ts
teste: packages/core/src/importacao/leitor.test.ts › o campo entre aspas guarda
-if (entreAspas) {
+if (false) {
```

Dentro das aspas, a aspa fecha o campo mesmo sem fechar.

```mutacao
arquivo: packages/core/src/importacao/leitor.ts
teste: packages/core/src/importacao/leitor.test.ts › o campo entre aspas guarda
-if (caractere !== ASPAS) atual += caractere
+if (caractere === ASPAS) atual += caractere
```

A aspa dobrada deixa de valer como uma aspa.

```mutacao
arquivo: packages/core/src/importacao/leitor.ts
teste: packages/core/src/importacao/leitor.test.ts › o campo entre aspas guarda
-else if (linha[posicao + 1] === ASPAS) {
+else if (false) {
```

A aspa no meio do campo abre aspas.

```mutacao
arquivo: packages/core/src/importacao/leitor.ts
teste: packages/core/src/importacao/leitor.test.ts › a aspa no meio do campo é letra
-} else if (caractere === ASPAS && atual.trim() === '') {
+} else if (caractere === ASPAS) {
```

Só o ponto e vírgula separa.

```mutacao
arquivo: packages/core/src/importacao/leitor.ts
teste: packages/core/src/importacao/leitor.test.ts › lê pelo separador do cabeçalho
-} else if (caractere === separador) {
+} else if (caractere === ';') {
```

O cabeçalho com coluna a mais passa.

```mutacao
arquivo: packages/core/src/importacao/leitor.ts
teste: packages/core/src/importacao/leitor.test.ts › texto vazio, só o cabeçalho
-if (colunas.length === esperadas.length && esperadas.every((coluna) => colunas.includes(coluna))) return { separador, colunas }
+if (esperadas.every((coluna) => colunas.includes(coluna))) return { separador, colunas }
```

O cabeçalho de outra planilha com o mesmo número de colunas passa.

```mutacao
arquivo: packages/core/src/importacao/leitor.ts
teste: packages/core/src/importacao/leitor.test.ts › texto vazio, só o cabeçalho
-if (colunas.length === esperadas.length && esperadas.every((coluna) => colunas.includes(coluna))) return { separador, colunas }
+if (colunas.length === esperadas.length) return { separador, colunas }
```

O texto vazio chega ao cabeçalho sem linha.

```mutacao
arquivo: packages/core/src/importacao/leitor.ts
teste: packages/core/src/importacao/leitor.test.ts › texto vazio, só o cabeçalho
-const lido = cabecalhoDe(linhas[primeira] ?? '', cabecalho.map(normalizarTexto))
+const lido = cabecalhoDe(linhas[primeira], cabecalho.map(normalizarTexto))
```

A quebra de linha do Windows deixa de separar linhas.

```mutacao
arquivo: packages/core/src/importacao/leitor.ts
teste: packages/core/src/importacao/leitor.test.ts › a quebra de linha do Windows
-const linhas = texto.split(/\r\n|\r|\n/)
+const linhas = texto.split(/\n/)
```

O cabeçalho que não é o do modelo não é recusado.

```mutacao
arquivo: packages/core/src/importacao/leitor.ts
teste: packages/core/src/importacao/leitor.test.ts › texto vazio, só o cabeçalho
-if (lido === undefined) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
```

O cabeçalho conta como linha de dados.

```mutacao
arquivo: packages/core/src/importacao/leitor.ts
teste: packages/core/src/importacao/leitor.test.ts › lê pelo separador do cabeçalho
-if (posicao <= primeira || linha.trim() === '') return
+if (linha.trim() === '') return
```

A linha em branco conta como linha de dados.

```mutacao
arquivo: packages/core/src/importacao/leitor.ts
teste: packages/core/src/importacao/leitor.test.ts › linha em branco é ignorada
-if (posicao <= primeira || linha.trim() === '') return
+if (posicao <= primeira) return
```

A linha com campos a mais ou a menos é lida como se estivesse inteira.

```mutacao
arquivo: packages/core/src/importacao/leitor.ts
teste: packages/core/src/importacao/leitor.test.ts › linha em branco é ignorada
-dados.push({ linha: posicao + 1, campos: campos.length === lido.colunas.length ? Object.fromEntries(lido.colunas.map((coluna, indice) => [coluna, campos[indice] ?? ''])) : null })
+dados.push({ linha: posicao + 1, campos: true ? Object.fromEntries(lido.colunas.map((coluna, indice) => [coluna, campos[indice] ?? ''])) : null })
```

A planilha só com o cabeçalho passa.

```mutacao
arquivo: packages/core/src/importacao/leitor.ts
teste: packages/core/src/importacao/leitor.test.ts › texto vazio, só o cabeçalho
-if (dados.length === 0) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
```

O formato `AAAA-MM-DD` sem âncora aceita data com lixo.

```mutacao
arquivo: packages/core/src/importacao/tipos/calendario.ts
teste: packages/core/src/importacao/tipos/calendario.test.ts › aponta o primeiro erro de cada linha
-const FORMATO_ISO = /^(\d{4})-(\d{2})-(\d{2})$/
+const FORMATO_ISO = /(\d{4})-(\d{2})-(\d{2})/
```

O formato `DD/MM/AAAA` sem âncora aceita ano de cinco dígitos.

```mutacao
arquivo: packages/core/src/importacao/tipos/calendario.ts
teste: packages/core/src/importacao/tipos/calendario.test.ts › aponta o primeiro erro de cada linha
-const FORMATO_BRASILEIRO = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
+const FORMATO_BRASILEIRO = /(\d{1,2})\/(\d{1,2})\/(\d{4})/
```

Só a data em `AAAA-MM-DD` é lida.

```mutacao
arquivo: packages/core/src/importacao/tipos/calendario.ts
teste: packages/core/src/importacao/tipos/calendario.test.ts › lê a data em
-const [ano, mes, dia] = iso !== null ? [iso[1], iso[2], iso[3]] : brasileiro !== null ? [brasileiro[3], brasileiro[2], brasileiro[1]] : []
+const [ano, mes, dia] = iso !== null ? [iso[1], iso[2], iso[3]] : []
```

O dia que não existe passa (a data rola para março).

```mutacao
arquivo: packages/core/src/importacao/tipos/calendario.ts
teste: packages/core/src/importacao/tipos/calendario.test.ts › aponta o primeiro erro de cada linha
-if (data.getUTCFullYear() !== a || data.getUTCMonth() !== m - 1 || data.getUTCDate() !== d) return null
```

Data ilegível não é apontada.

```mutacao
arquivo: packages/core/src/importacao/tipos/calendario.ts
teste: packages/core/src/importacao/tipos/calendario.test.ts › aponta o primeiro erro de cada linha
-if (inicio === null || fim === null) return 'data_invalida'
```

O fim antes do início passa.

```mutacao
arquivo: packages/core/src/importacao/tipos/calendario.ts
teste: packages/core/src/importacao/tipos/calendario.test.ts › aponta o primeiro erro de cada linha
-if (fim < inicio) return 'fim_antes_do_inicio'
```

O início antes do ano passa.

```mutacao
arquivo: packages/core/src/importacao/tipos/calendario.ts
teste: packages/core/src/importacao/tipos/calendario.test.ts › aponta o primeiro erro de cada linha
-return inicio < ano.inicio || fim > ano.fim ? 'fora_do_ano' : { inicio, fim }
+return fim > ano.fim ? 'fora_do_ano' : { inicio, fim }
```

O fim depois do ano passa.

```mutacao
arquivo: packages/core/src/importacao/tipos/calendario.ts
teste: packages/core/src/importacao/tipos/calendario.test.ts › aponta o primeiro erro de cada linha
-return inicio < ano.inicio || fim > ano.fim ? 'fora_do_ano' : { inicio, fim }
+return inicio < ano.inicio ? 'fora_do_ano' : { inicio, fim }
```

A descrição não perde o espaço a mais de dentro.

```mutacao
arquivo: packages/core/src/importacao/tipos/calendario.ts
teste: packages/core/src/importacao/tipos/calendario.test.ts › lê a data em
-const descricao = texto.replace(/\s+/g, ' ').trim()
+const descricao = texto.trim()
```

A descrição vazia passa.

```mutacao
arquivo: packages/core/src/importacao/tipos/calendario.ts
teste: packages/core/src/importacao/tipos/calendario.test.ts › aponta o primeiro erro de cada linha
-if (descricao === '') return { erro: 'descricao_vazia' }
```

A descrição de mais de 120 caracteres passa.

```mutacao
arquivo: packages/core/src/importacao/tipos/calendario.ts
teste: packages/core/src/importacao/tipos/calendario.test.ts › aponta o primeiro erro de cada linha
-return descricao.length > TAMANHO_MAXIMO_DA_DESCRICAO_DO_EVENTO ? { erro: 'descricao_longa' } : { descricao }
+return { descricao }
```

O erro do período segue para o tipo e a descrição.

```mutacao
arquivo: packages/core/src/importacao/tipos/calendario.ts
teste: packages/core/src/importacao/tipos/calendario.test.ts › aponta o primeiro erro de cada linha
-if (typeof periodo === 'string') return periodo
```

O tipo só vale em minúsculas e sem espaço.

```mutacao
arquivo: packages/core/src/importacao/tipos/calendario.ts
teste: packages/core/src/importacao/tipos/calendario.test.ts › lê a data em
-const tipo = TIPOS_DE_EVENTO_DO_CALENDARIO.find((candidato) => candidato === normalizarTexto(campos['tipo'] ?? ''))
+const tipo = TIPOS_DE_EVENTO_DO_CALENDARIO.find((candidato) => candidato === (campos['tipo'] ?? ''))
```

O tipo fora da lista passa.

```mutacao
arquivo: packages/core/src/importacao/tipos/calendario.ts
teste: packages/core/src/importacao/tipos/calendario.test.ts › aponta o primeiro erro de cada linha
-if (tipo === undefined) return 'tipo_invalido'
```

O erro da descrição é lido como se fosse a descrição.

```mutacao
arquivo: packages/core/src/importacao/tipos/calendario.ts
teste: packages/core/src/importacao/tipos/calendario.test.ts › aponta o primeiro erro de cada linha
-return 'erro' in descricao ? descricao.erro : { tipo, ...periodo, descricao: descricao.descricao }
+return { tipo, ...periodo, descricao: descricao.descricao }
```

A cópia a mais de um evento só guarda o último id.

```mutacao
arquivo: packages/core/src/importacao/tipos/calendario.ts
teste: packages/core/src/importacao/tipos/calendario.test.ts › a cópia a mais de um evento
-for (const existente of existentes) noBanco.set(chaveDoEvento(existente), [...(noBanco.get(chaveDoEvento(existente)) ?? []), existente.id])
+for (const existente of existentes) noBanco.set(chaveDoEvento(existente), [existente.id])
```

O evento que já existe e a planilha traz também sai.

```mutacao
arquivo: packages/core/src/importacao/tipos/calendario.ts
teste: packages/core/src/importacao/tipos/calendario.test.ts › compara com o ano
-for (const [chave, ids] of noBanco) saem.push(...(daPlanilha.has(chave) ? ids.slice(1) : ids))
+for (const [chave, ids] of noBanco) saem.push(...ids)
```

A linha incompleta é lida como se tivesse os campos.

```mutacao
arquivo: packages/core/src/importacao/tipos/calendario.ts
teste: packages/core/src/importacao/tipos/calendario.test.ts › aponta o primeiro erro de cada linha
-const lido = campos === null ? 'linha_incompleta' : lerLinha(campos, ano)
+const lido = lerLinha(campos ?? {}, ano)
```

O erro de linha é tratado como evento.

```mutacao
arquivo: packages/core/src/importacao/tipos/calendario.ts
teste: packages/core/src/importacao/tipos/calendario.test.ts › aponta o primeiro erro de cada linha
-if (typeof lido === 'string') {
+if (false) {
```

A linha repetida entra duas vezes.

```mutacao
arquivo: packages/core/src/importacao/tipos/calendario.ts
teste: packages/core/src/importacao/tipos/calendario.test.ts › o evento repetido na planilha
-} else if (vistos.has(chaveDoEvento(lido))) {
+} else if (false) {
```

Todo evento é `entra`, mesmo o que já existe.

```mutacao
arquivo: packages/core/src/importacao/tipos/calendario.ts
teste: packages/core/src/importacao/tipos/calendario.test.ts › compara com o ano
-linhas.push({ linha, resultado: noBanco.has(chaveDoEvento(lido)) ? 'ja_existe' : 'entra' })
+linhas.push({ linha, resultado: 'entra' })
```

O guardado fora da forma tem plano.

```mutacao
arquivo: packages/core/src/importacao/tipos/calendario.ts
teste: packages/core/src/importacao/tipos/calendario.test.ts › o que foi guardado fora da forma
-return lido.success ? planejarContra(ano, lido.data, await repositorio.eventosDoAno(ano.id)) : undefined
+return planejarContra(ano, guardado as EventoLido[], await repositorio.eventosDoAno(ano.id))
```

Todo erro do banco é falha de trava.

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: packages/core/src/importacao/motor.test.ts › a trava que não veio no prazo
-return codigo !== undefined && SQLSTATE_DE_TRAVA.has(codigo)
+return codigo !== undefined
```

O tipo que o motor não grava não é recusado.

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/api/test/importacao.int.test.ts › o professor, o aluno e o tipo
-if (achado === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

O gravar não recusa a planilha com erro de linha.

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/api/test/importacao.int.test.ts › gravar sem prévia
-if (previa.linhas.some((linha) => linha.resultado === 'erro')) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
```

O gravar não recusa a marca fora dos candidatos.

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/api/test/importacao.int.test.ts › marca fora dos candidatos
-if (marcadas.some((id) => !candidatos.has(id))) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
```

O `turmaId` num tipo que não usa turma é aceito.

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/api/test/importacao.int.test.ts › numa planilha que não usa turma
-if (pedido.turmaId !== undefined && !doTipo.usaTurma) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

Sem ano de destino, a prévia segue com `undefined`.

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/api/test/importacao.int.test.ts › filtro com o ano de outra escola
-if (ano === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

O único violado no passo (3) vira erro, e não `desatualizada`.

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/worker/test/gravar-planilha.int.test.ts › único violado no passo
-if (postgresErrorIn(erro)?.code === SQLSTATE_UNICO_VIOLADO) return desatualizar(repositorio, importacaoId)
```

A importação fechada é executada de novo.

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/api/test/importacao.int.test.ts › há mais de 1 h
-if (lida?.estado !== 'na_fila') return 'ignorada'
```

O passo (2) não existe: a assinatura e o ano encerrado só são vistos sob a trava.

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/worker/test/gravar-planilha.int.test.ts › assinatura diferente antes do job
-if (!(await passo2(repositorio, alvo, lida.linhas))) return desatualizar(repositorio, importacaoId)
```

O tipo que o motor não grava (ou sem ano) não falha de vez.

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/worker/test/gravar-planilha.int.test.ts › falha definitiva também quando o tipo
-if (doTipo === undefined || anoLetivoId === null) throw new ImportacaoIlegivelError()
```

O ano encerrado não é visto no passo (2).

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/worker/test/gravar-planilha.int.test.ts › ano encerrado antes do job
-if (ano === undefined || ano.situacao === 'encerrado') return false
+if (ano === undefined) return false
```

A importação guardada sem a forma do tipo não falha de vez.

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/worker/test/gravar-planilha.int.test.ts › guardada não tem a forma do tipo
-if (vista === undefined) throw new ImportacaoIlegivelError()
```

A segunda execução, depois da trava, não vê a importação já fechada.

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/worker/test/gravar-planilha.int.test.ts › duas execuções do mesmo job
-if (travada?.estado !== 'na_fila') return 'ignorada'
```

A importação de quem já saiu é gravada.

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/api/test/importacao.int.test.ts › quem gravou já saiu
-if (travada.criadoPor === null) return desatualizar(gravacao, importacaoId)
```

O ano encerrado depois do passo (2) é gravado.

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/api/test/importacao.int.test.ts › o job vê o ano já encerrado
-if (ano === undefined || ano.situacao === 'encerrado') return desatualizar(gravacao, importacaoId)
```

A assinatura relida no passo (3) não é conferida.

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/worker/test/gravar-planilha.int.test.ts › assinatura que muda entre o passo
-if (plano.assinatura !== assinatura) return desatualizar(gravacao, importacaoId)
```

O ano pelo id sem o escopo da escola: o job de A lê o ano de B.

```mutacao
arquivo: packages/core/src/importacao/importacao.repository.ts
teste: apps/worker/test/gravar-planilha.int.test.ts › o repository: as trocas de estado
-.where(and(eq(anoLetivo.escolaId, requireEscolaId()), eq(anoLetivo.id, id)))
+.where(eq(anoLetivo.id, id))
```


## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| privacy-guardian (1ª), 3; revisor-geral (1ª), 5; infra-guardian (1ª), 1 | O parser de 1 MB (`LIMITE_DO_CORPO_JSON`, `configure-app.ts`) vale para todas as rotas, inclusive login e reivindicação; registrá-lo só em `/v1/importacoes`, com caso que prove que corpo acima de 100 KB em outra rota continua recusado | Tarefa 5.1 ("512 KB e 3.000 linhas só nessas rotas", `5_task.md`). Não se aplica aqui: muda o contrato de todas as rotas, e a Tech Spec §4 decide 1 MB para a API |
| infra-guardian (1ª), 2 | Limite próprio da prévia e do gravar (20/min por usuário, duas prévias por escola), teto de 3.000 linhas, três alertas com parágrafo do runbook, expurgo da `na_fila` parada, `GET /v1/importacoes/:id`; cenário k6 `importacao-7h30.js` | Já são da 5.0 e da 16.0 |
| infra-guardian (1ª), 3 | A métrica `importacao.job` não separa por escola; conferir no painel a fila `normal` por escola | Tarefa 5.0 (alertas e painel) |
| privacy-guardian (1ª), 2 | Na 6.0 e na 7.0, `candidatos` e `linhas` da prévia levam nome e matrícula: manter o DTO estrito e decidir se a prévia de alunos precisa de auditoria de leitura (regra 20, item 10) | Tarefas 6.0 e 7.0, que criam a prévia de alunos e de professores |
| conformidade-reviewer (1ª), 2 | Quando a 6.0, a 7.0 e a 11.0 entrarem no `TIPOS_DO_MOTOR`, conferir de novo que nenhum tipo de planilha escreve em `Nota` ou em resultado de avaliação | Tarefas 6.0, 7.0 e 11.0 (revisão delas) |
| revisor-geral (1ª), 4 | A forma da resposta é conferida em dois lugares (a prévia no motor, o gravar no service); escolher um | `TODO.md`. Mover desloca as linhas que os blocos de mutação e os motivos citam, para um ganho de estilo |
| test-engineer (1ª) | A janela de 1 s nas corridas (`importacao.int.test.ts` › `encerrar … parado` e `… já encerrado`; `gravar-planilha.int.test.ts` › `duas execuções` e `assinatura que muda entre o (2) e o (3)`) | Recusada: a margem é de umas 20 vezes; se a esteira ficar intermitente, vira correção (receber os tempos do passo (3) por `ExecucaoOptions`) |
| test-engineer (1ª) | Bloco de mutação próprio para o `set_config('lock_timeout', '1000', true)` do `limitesDoPasso3` | Recusada: o caso "ano sempre travado" o pega por tabela, porque sem ele o erro vira `57014` e o código sai `erro_interno` |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-03 20:18:08 | 2026-11-03 20:18:43 | `conformidade-reviewer` | 1 | APROVADO | a5711dc7dd063af4d |
| 2026-11-03 20:17:53 | 2026-11-03 20:18:56 | `tenancy-guardian` | 1 | APROVADO | ac26f56b9f5ac9d99 |
| 2026-11-03 20:17:56 | 2026-11-03 20:19:12 | `privacy-guardian` | 1 | APROVADO | a5c888b3d477b4a68 |
| 2026-11-03 20:18:05 | 2026-11-03 20:19:46 | `revisor-geral` | 1 | REPROVADO | ab9f8afa9d956ee2a |
| 2026-11-03 20:17:59 | 2026-11-03 20:19:55 | `infra-guardian` | 1 | APROVADO | a36de2196cd3c537c |
| 2026-11-03 20:18:02 | 2026-11-03 20:21:07 | `test-engineer` | 1 | REPROVADO | ad94b82a0e0568ecf |
| 2026-11-03 20:32:54 | 2026-11-03 20:33:19 | `revisor-geral` | 2 | APROVADO | a1f755ab7c2a7d32b |
| 2026-11-03 20:32:42 | 2026-11-03 20:33:47 | `test-engineer` | 2 | APROVADO | a2bea3df2b303c6ac |
