# Tarefa 5.0 — A importação tem limites, expira parada, e o calendário se lê

**Funcionalidade:** onboarding-por-convite · **Depende de:** 4.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

A prévia e o gravar respeitam os limites por usuário e por escola; a importação parada fecha sozinha e a final sai em 90
dias; a coordenação acompanha a importação por `GET /v1/importacoes/:id`; e coordenação e professor leem o calendário.

## Contexto necessário

- `techspec.md` §3 (`importacao_planilha`, os índices), §4 (`GET /v1/importacoes/:id`, `GET /v1/calendario`, o filtro
  `anoLetivoId`), §5 (a tabela de estados e o parágrafo dos expurgos), §6 (o alvo novo do `sistema.expurgar-acesso`), §7c
- `prd.md` RF10, RF15, RF16
- `cenarios.md` "Job e estados" (expurgos), "Isolamento e ano letivo", tabela "Limites"
- Regra 80 itens 1, 3 e 10; regra 20 item 16; regra 10 item 9
- Código: `packages/core/src/retencao/expurgo-da-escola.repository.ts`, `expurgo-de-acesso.repository.ts`;
  `apps/worker/src/processors/expurgar-escola.ts`, `expurgar-acesso.ts`; `packages/core/src/rate-limit/`;
  `docs/runbook.md`

## Subtarefas

- [x] 5.1 — Limites: prévia e gravar, 20/min por usuário no mesmo balde; duas prévias simultâneas por escola, no Redis, com o gravar ocupando vaga e prazo de validade; 512 KB e 3.000 linhas só nessas rotas
- [x] 5.2 — `retencao.expurgar-escola` fecha `falhou` a `na_fila` de mais de 1 h; `sistema.expurgar-acesso` tira a importação final de 90 dias (`@Unscoped` com a justificativa); os dois com `skip locked`
- [x] 5.3 — `GET /v1/importacoes/:id` (coordenador, da escola, mesmo sem ano em curso)
- [x] 5.4 — `GET /v1/calendario`: coordenador, com o filtro do planejado; professor com vínculo confirmado, no ano em curso
- [x] 5.5 — Alertas (`falhou` acima de 20% em 1 h; `na_fila` há 30 min; passo (3) acima de 1 s), com o parágrafo do `docs/runbook.md`
- [x] 5.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/retencao/expurgo-da-escola.repository.ts`, `expurgo-de-acesso.repository.ts` | alterado |
| `apps/api/src/estrutura/importacao/importacao.controller.ts`, `importacao.service.ts` | alterado |
| `apps/api/src/estrutura/grade/calendario.controller.ts`, `calendario.service.ts`, `packages/core/src/importacao/calendario.repository.ts` | novo |
| `apps/api/src/rate-limit.module.ts` | alterado |
| `infra/grafana/` (alertas), `docs/runbook.md` | alterado |
| `apps/worker/test/expurgo-da-escola.int.test.ts`, `apps/worker/test/expurgo-de-acesso.int.test.ts`, `apps/api/test/calendario.int.test.ts` | alterado; novo |

## Testes que provam a regra

`A` é `apps/api/test/importacao.int.test.ts`; `C` é `apps/api/test/calendario.int.test.ts`; `WE` e `WA` são `apps/worker/test/expurgo-da-escola.int.test.ts` e `expurgo-de-acesso.int.test.ts`; `G` é `apps/worker/test/importacao-gauge.int.test.ts`; `V` é `packages/core/src/rate-limit/school-semaphore.test.ts`; `CF` é `apps/api/src/configure-app.test.ts`; `CT` é `packages/shared/src/importacao/contratos.test.ts`; `AL` é `infra/test/alertas.test.ts`; `RB` é `tools/guardas/alerta-tem-runbook.test.ts`.

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| Relógio falso: com 59 min o expurgo mantém a `na_fila`; com 61 min fecha `falhou`, `linhas` e `marcas` nulas | integração | expurgo de 1 h | WE › importação de planilha parada › relógio falso: com 59 min a `na_fila` fica; com 61 min fecha `falhou`; WE › borda: com exatamente 60 min |
| [P] Expurgo com o job segurando a linha: pula, sem esperar | [P] | `skip locked` | WE › importação de planilha parada › [P] com o job segurando a linha, o expurgo pula (`skip locked`) e não espera |
| A importação final sai em 90 dias; com 89, fica | integração | `sistema.expurgar-acesso` | WA › importação de planilha: sai 90 dias depois de terminada, com 89 dias e a `na_fila` de qualquer idade ficam; WA › a linha que um job segura não faz o lote esperar (`skip locked`); WA › a linha `na_fila` com data de término nunca sai pelo prazo |
| `GET /v1/importacoes/:id` da B: igual a inexistente | integração | isolamento | A › GET /v1/importacoes/:id › isolamento: o id da importação da B, na A, responde igual ao de uma que não existe |
| Sem ano em curso, `GET /v1/importacoes/:id` responde, só com as da escola | integração | ano | A › GET /v1/importacoes/:id › sem ano em curso a importação da escola responde, e a da outra escola continua igual à que não existe |
| `GET /v1/calendario` da B fica invisível ao coordenador e ao professor | integração | isolamento | C › isolamento: o calendário da B não aparece para a A; C › isolamento: o professor com vínculo confirmado lê só a escola dele |
| O calendário do coordenador aceita o filtro do planejado | integração | ano | C › o filtro `anoLetivoId` do ano planejado traz o calendário dele; C › sem ano em curso: sem filtro responde NAO_ENCONTRADO, e com o do planejado responde |
| Professor só com vínculo encerrado ou pendente: calendário igual a inexistente | integração | vínculo encerrado e aberto | C › professor sem vínculo confirmado (pendente, encerrado, só no ano planejado ou nenhum); C › o vínculo que acaba fecha o calendário do professor na mesma hora |
| Prévia e gravar acima de 20/min, no mesmo balde: 429 | integração | Limites | A › limites da prévia e do gravar › 20 pedidos por minuto por usuário, prévia e gravar no mesmo balde |
| [P] Terceira prévia simultânea na escola: recusada, e a outra escola segue | [P] | Limites | A › limites da prévia e do gravar › [P] três prévias ao mesmo tempo na escola |
| O gravar ocupa vaga de prévia | integração | Limites | A › limites da prévia e do gravar › [P] o gravar ocupa vaga |
| A vaga volta quando o processo morre (prazo de validade) | integração | Limites | A › limites da prévia e do gravar › a vaga volta quando o processo morre; V › a vaga que ninguém devolve vence pelo prazo de validade (o seguro em memória) |
| 512 KB ou 3.000 linhas: `ENTRADA_INVALIDA` só nessas rotas; 3.000 entram | integração | Limites | A › 3.000 linhas entram; 3.001 linhas são ENTRADA_INVALIDA; A › 512 KB exatos entram na prévia; A › o teto de 100 KB vale para as outras rotas; CF › as quatro; CT › 3.000 linhas de dado entram |
| O alerta novo tem parágrafo no runbook | unidade | regra 80, item 10 | RB › no repositório, cada arquivo de `infra/grafana/alertas/` tem entrada correspondente em `docs/runbook.md`, completa; AL › o limite de 1 s do passo 3 da importação é fronteira de balde |

Fora da tabela, a medição da fila é provada por `G` (a série por escola, o escopo, a falha de uma escola, a montagem no worker de lote) e a conta do semáforo sem Redis, por `V`.

## Como testar

- Expurgo com relógio: `apps/worker/test/expurgo-de-acesso.int.test.ts › borda: nos limites de cada prazo, contados do relógio injetado, o vencido de todas as escolas (e sem escola) sai, e o que está no prazo fica`; por escola: `apps/worker/test/expurgo-da-escola.int.test.ts › encurtar o prazo em A tira a linha de A e mantém a de B, …`
- Limite por escola: `apps/api/test/rate-limit.int.test.ts › isolamento: limite de escola esgotado na escola A não gera 429 para a escola B`
- Teto: `apps/api/test/lista.int.test.ts › 201 linhas ou 64 KB + 1 byte na prévia e na gravação: ENTRADA_INVALIDA, …`
- Alerta: `tools/guardas/alerta-tem-runbook.test.ts`
- Comandos: `npx vitest run --project integracao apps/worker/test/expurgo-da-escola.int.test.ts apps/api/test/calendario.int.test.ts`

## Autoconferência

As 12 perguntas do modelo, no plano. Na 3, o expurgo precisa de uma `na_fila` em cada escola e de uma `concluida` com a mesma idade.

1. **Mutação de cada cláusula:** 65 blocos na seção "Mutações" (cada um com o teste que cai), e 4 linhas com o motivo escrito (o `throw` do token que a sessão já garante, a limpeza do `Map` vazio, o `?? 0` do `rowCount`, e o `.where` do vínculo, de que cada cláusula tem bloco). As cópias da mesma regra em outro arquivo têm bloco próprio: o escopo da leitura da importação (`lerPorId`) e o da medição da fila, o do calendário e o do vínculo.
2. **O texto na tela:** a tarefa não tem tela (a do calendário é a 14.0); não se aplica.
3. **O segundo dado:** o expurgo da escola tem uma `na_fila` com 61 min em cada escola e uma `concluida` com a mesma idade em A (a de B e a `concluida` ficam, a de A fecha); o expurgo do acesso tem as importações finais de duas escolas e a `na_fila` com data de término; a medição da fila tem a `concluida` velha e a `na_fila` nova na mesma escola, e a importação de B na série de A; o calendário tem o evento de outro ano da mesma escola e o da B; o limite tem outro usuário da escola com o balde cheio de um.
4. **Checagem anterior que responde antes:** o `ENTRADA_INVALIDA` do contrato vem antes do service e não passa pela vaga; por isso o caso da vaga devolvida usa um erro de dentro do trabalho (o ano de outra escola, `NAO_ENCONTRADO`), e não o corpo inválido. O caso do vínculo tem um colega confirmado na escola, para o professor sem vínculo não sair `NAO_ENCONTRADO` por ela estar vazia.
5. **Resultado, não forma do código:** as asserções leem a resposta (status, código, forma), `importacao_planilha`, o `rl:importacao` e o `sem:importacao` pelo comportamento, e a série da métrica; o log da contagem é lido por chave.
6. **Guarda nova:** nenhuma regra de lint nem teste estrutural novo; a tarefa passa pelas existentes (`repositories-com-escopo`, `tabela-so-no-repository`, camadas, `alerta-tem-runbook`, `painel.test`, `NOMES_NO_PROMETHEUS`). Não se aplica.
7. **Comentários:** relidos contra o código; o do recurso `importacao_planilha` na matriz (antes "entra na 5.0") foi atualizado, e os dos arquivos novos dizem a tarefa e a regra.
8. **A divergência cria regra?** Uma: "o corpo JSON de mais de 100 KB, fora das rotas da planilha, é `ENTRADA_INVALIDA`" (o leitor de JSON é um só, de 1 MB). Entrou em `techspec.md` §4 antes dos revisores, com o caso `CF` e o do `A`.
9. **Peça que já existe:** `RateLimiter` (`criarLimite`, `insuranceLimit`), `RateLimitGuard`, `EscolaGauge`, `ExpurgoDaEscolaRepository`, `ExpurgoDeAcessoRepository`, `ImportacaoRepository.anoDeDestino`, `requireEscolaId`/`requireAnoEmCurso`, `RequirePermissao`, `WriteBlockTrigger`, `QueueFixtures`, `MedidorDeTeste`; o `EscolaConcurrencyLimiter` é o semáforo por escola da fila de jobs (Redis de fila, com renovação pelo worker) e não serve à requisição da API, por isso o `SchoolSemaphore` (Redis de cache, com seguro em memória) convive com ele, como diz a `techspec.md` §7c; o `CalendarioRepository` e a `ImportacaoGauge` são novos.
10. **Corrida:** o semáforo tem a conta no Redis, num script só (`TIME`, limpa o vencido, confere, grava): nenhum "verifica e depois grava"; as corridas dos casos têm a ordem forçada (o `WriteBlockTrigger` segura o gravar no meio; o `for update` da transação segura a linha do expurgo).
11. **Isolamento e coluna "Caso":** cada linha da tabela tem o caso. O isolamento tem a importação e o calendário de B, o ano de B no filtro, a medição da B na série de A e o expurgo de B (o bloco que tira o `escola_id` do `update` e da subconsulta do fechamento); cada um tem bloco que o deixa vermelho sem a cláusula.
12. **O que verificar dos guardiões:** `tenancy-guardian` (escopo no repository, `NAO_ENCONTRADO` igual, professor sem vínculo, ano de outra escola, semáforo por escola), `privacy-guardian` (resposta sem `linhas` nem `marcas`, `linhas` e `marcas` nulas no fechamento, log sem dado, a métrica só com a escola), `infra-guardian` (balde por usuário e vaga por escola, prazo de validade, `skip locked`, o `@Unscoped` do expurgo de acesso, os três alertas com o runbook e o painel). O `achados/indice.md` da spec lista o que os revisores já pediram nas tarefas anteriores.

## Fora do escopo desta tarefa

A tela do calendário (14.0); a grade (11.0 e 12.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| O corpo JSON de mais de 100 KB fora de `/v1/importacoes` é `ENTRADA_INVALIDA` pelo `Content-Length`, num middleware antes do leitor de JSON (o multipart do material não entra) | O leitor de JSON da API é um só e vale 1 MB (4.0); o contrato Zod é por rota, e a rota que não é da planilha ficaria aceitando 1 MB. O tipo do `useBodyParser` não aceita `verify`, e não há `express` direto para dois leitores | `techspec.md` §4 (parágrafo do `anoLetivoId`, o teto de corpo); `cenarios.md` tabela "Limites" (o teto só nessas rotas); a seção 11 não muda |
| Arquivos além dos "previstos": `packages/shared/src/importacao/contratos.ts` (as constantes e o teto de linhas, o `calendarioQuerySchema`), `packages/shared/src/permissao/matriz.ts`, `matriz.expectativa.ts` e `matriz.test.ts` (o `ler` da importação e o recurso `calendario`), `packages/core/src/rate-limit/` (`keys.ts`, `rate-limiter.ts`, `rate-limit.guard.ts`, `importacao-rate-limit.decorator.ts`, `school-semaphore.ts`), `packages/core/src/importacao/importacao.repository.ts`, `packages/core/src/telemetry/metrics.ts`, `tools/testes/metricas.ts` (a métrica da fila), `apps/api/src/configure-app.ts`, `apps/worker/src/importacao-gauge.ts`, `composition.ts` e os dois processors de expurgo, `infra/grafana/` (3 alertas e o painel 42), `infra/scripts/ensaio-alertas.ts`, `infra/test/alertas.test.ts`, `tools/guardas/alerta-tem-runbook.test.ts` | O balde e o semáforo moram no pacote do rate limit; o alerta "na fila há 30 min" precisa de uma métrica por escola, medida pelo worker de lote; o `ler` e o `calendario` são recursos novos da matriz | `techspec.md` §7c (a métrica `importacao.minutos_na_fila`); a seção 11 não muda |
| O prazo da vaga de planilha é de 30 s (`VALIDADE_DA_VAGA_DA_PLANILHA_MS`) | O plano pede "prazo de validade" sem o valor; 30 s é bem acima do p95 de 2 s da prévia e do gravar de 3.000 linhas, e curto para a escola não ficar presa | `techspec.md` §7c; `cenarios.md` tabela "Limites" (a vaga volta pelo prazo) |

## Mutações

--faltando: 4 linhas (65 blocos, 4 motivos)

**Sem bloco (motivo):** (1) `rate-limit.guard.ts:101`, o `throw NAO_AUTENTICADO` do `token === undefined` do balde da planilha: a guarda da sessão roda antes e recusa a requisição sem token; a linha só estreita o tipo (a mesma guarda do balde da busca de titular, logo acima). (2) `school-semaphore.ts:95`, o `if (vagas.size === 0) this.#seguro.delete(escolaId)`: limpeza de memória; o `Map` vazio e a chave ausente contam igual na conta seguinte. (3) `expurgo-da-escola.repository.ts:468`, o `?? 0` do `rowCount`: o tipo do driver admite nulo, e o `UPDATE` sempre devolve o número (o caso do log da contagem prova o valor). (4) `calendario.repository.ts:36`, o `.where(` multilinha do vínculo: cada cláusula tem bloco abaixo (`estado`, `usuarioId`, `anoLetivoId`); o `escolaId` e o `papel` do `.where` são cópias do que o usuário da sessão já é (a FK composta do vínculo e o papel da sessão), e o `escolaId` fica pelo padrão do repository (regra 10, item 3). Também sem bloco sozinho: o `estado = 'na_fila'` do `update` de `fecharImportacoesParadas` é redundante com o da subconsulta por causa do `for update skip locked`; o bloco que o prova tira os dois juntos (o segundo dos dois blocos do fechamento).

O prefixo exato `/v1/importacoes` deixa de ser rota da planilha.

```mutacao
arquivo: apps/api/src/configure-app.ts
teste: apps/api/src/configure-app.test.ts › as rotas da planilha seguem com o corpo grande
-const daPlanilha = caminho === PREFIXO_DAS_PLANILHAS || caminho.startsWith(`${PREFIXO_DAS_PLANILHAS}/`) || caminho.startsWith(`${PREFIXO_DAS_PLANILHAS}?`)
+const daPlanilha = caminho.startsWith(`${PREFIXO_DAS_PLANILHAS}/`) || caminho.startsWith(`${PREFIXO_DAS_PLANILHAS}?`)
```

O que vem depois de `/` deixa de ser rota da planilha: a prévia e o gravar caem no teto de 100 KB.

```mutacao
arquivo: apps/api/src/configure-app.ts
teste: apps/api/src/configure-app.test.ts › as rotas da planilha seguem com o corpo grande
-const daPlanilha = caminho === PREFIXO_DAS_PLANILHAS || caminho.startsWith(`${PREFIXO_DAS_PLANILHAS}/`) || caminho.startsWith(`${PREFIXO_DAS_PLANILHAS}?`)
+const daPlanilha = caminho === PREFIXO_DAS_PLANILHAS || caminho.startsWith(`${PREFIXO_DAS_PLANILHAS}?`)
```

O que vem depois de `?` deixa de ser rota da planilha.

```mutacao
arquivo: apps/api/src/configure-app.ts
teste: apps/api/src/configure-app.test.ts › as rotas da planilha seguem com o corpo grande
-const daPlanilha = caminho === PREFIXO_DAS_PLANILHAS || caminho.startsWith(`${PREFIXO_DAS_PLANILHAS}/`) || caminho.startsWith(`${PREFIXO_DAS_PLANILHAS}?`)
+const daPlanilha = caminho === PREFIXO_DAS_PLANILHAS || caminho.startsWith(`${PREFIXO_DAS_PLANILHAS}/`)
```

O teto de 100 KB vale também para a rota da planilha.

```mutacao
arquivo: apps/api/src/configure-app.ts
teste: apps/api/src/configure-app.test.ts › as rotas da planilha seguem com o corpo grande
-if (ehJson && !daPlanilha && declarado > LIMITE_DO_CORPO_FORA_DA_PLANILHA_BYTES) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
+if (ehJson && declarado > LIMITE_DO_CORPO_FORA_DA_PLANILHA_BYTES) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
```

Os 100 KB exatos passam a ser recusados.

```mutacao
arquivo: apps/api/src/configure-app.ts
teste: apps/api/src/configure-app.test.ts › 100 KB exatos seguem
-if (ehJson && !daPlanilha && declarado > LIMITE_DO_CORPO_FORA_DA_PLANILHA_BYTES) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
+if (ehJson && !daPlanilha && declarado >= LIMITE_DO_CORPO_FORA_DA_PLANILHA_BYTES) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
```

O corpo grande de outra rota deixa de ser recusado.

```mutacao
arquivo: apps/api/src/configure-app.ts
teste: apps/api/src/configure-app.test.ts › qualquer outra rota recusa o corpo declarado
-if (ehJson && !daPlanilha && declarado > LIMITE_DO_CORPO_FORA_DA_PLANILHA_BYTES) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
+if (ehJson && !daPlanilha && declarado > LIMITE_DO_CORPO_FORA_DA_PLANILHA_BYTES) return seguir()
```

A requisição sem caminho passa a valer como rota da planilha.

```mutacao
arquivo: apps/api/src/configure-app.ts
teste: apps/api/src/configure-app.test.ts › requisição sem caminho
-const caminho = requisicao.url ?? ''
+const caminho = requisicao.url ?? '/v1/importacoes'
```

O professor passa pelo ramo da coordenação: o vínculo pendente lê o calendário.

```mutacao
arquivo: apps/api/src/estrutura/grade/calendario.service.ts
teste: apps/api/test/calendario.int.test.ts › professor sem vínculo confirmado
-if (alcance === 'unidade') {
+if (true) {
```

Sem ano de destino, o ramo da coordenação não responde `NAO_ENCONTRADO`.

```mutacao
arquivo: apps/api/src/estrutura/grade/calendario.service.ts
teste: apps/api/test/calendario.int.test.ts › isolamento: o calendário da B não aparece para a A
-if (ano === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

O professor escolhe o ano com o filtro.

```mutacao
arquivo: apps/api/src/estrutura/grade/calendario.service.ts
teste: apps/api/test/calendario.int.test.ts › o professor não escolhe o ano
-if (alcance !== 'turma_vinculada' || consulta.anoLetivoId !== undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
+if (alcance !== 'turma_vinculada') throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

O professor sem vínculo confirmado lê o calendário.

```mutacao
arquivo: apps/api/src/estrutura/grade/calendario.service.ts
teste: apps/api/test/calendario.int.test.ts › professor sem vínculo confirmado
-if (!(await calendario.professorTemVinculoConfirmado())) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

O calendário do ano não tem o escopo da escola: a A lê o ano da B.

```mutacao
arquivo: packages/core/src/importacao/calendario.repository.ts
teste: apps/api/test/calendario.int.test.ts › o repositório do calendário só devolve
-.where(and(eq(eventoCalendario.escolaId, requireEscolaId()), eq(eventoCalendario.anoLetivoId, anoLetivoId)))
+.where(and(eq(eventoCalendario.anoLetivoId, anoLetivoId)))
```

O vínculo `pendente` passa a abrir o calendário.

```mutacao
arquivo: packages/core/src/importacao/calendario.repository.ts
teste: apps/api/test/calendario.int.test.ts › professor sem vínculo confirmado
-eq(vinculo.estado, 'confirmado'),
+eq(vinculo.estado, 'pendente'),
```

O vínculo de outro professor da escola abre o calendário de quem não tem o seu.

```mutacao
arquivo: packages/core/src/importacao/calendario.repository.ts
teste: apps/api/test/calendario.int.test.ts › professor sem vínculo confirmado
-eq(vinculo.usuarioId, requestSessao().usuarioId),
```

O vínculo de outro ano abre o calendário do ano em curso.

```mutacao
arquivo: packages/core/src/importacao/calendario.repository.ts
teste: apps/api/test/calendario.int.test.ts › professor sem vínculo confirmado
-eq(vinculo.anoLetivoId, requireAnoEmCurso()),
```

O worker sem medidor tenta ligar a medição e cai.

```mutacao
arquivo: apps/worker/src/composition.ts
teste: apps/worker/src/composition.test.ts › o arquivo do titular e a planilha só na
-if (medidor === undefined) return () => Promise.resolve()
```

A importação que não existe (ou é de outra escola) deixa de responder `NAO_ENCONTRADO`.

```mutacao
arquivo: apps/api/src/estrutura/importacao/importacao.service.ts
teste: apps/api/test/importacao.int.test.ts › isolamento: o id da importação da B, na A
-if (lida === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

A `concluidaEm` nula sai `undefined`, e o contrato recusa a resposta.

```mutacao
arquivo: apps/api/src/estrutura/importacao/importacao.service.ts
teste: apps/api/test/importacao.int.test.ts › a coordenação acompanha a importação
-return importacaoSchema.parse({ ...lida, criadoEm: lida.criadoEm.toISOString(), concluidaEm: lida.concluidaEm?.toISOString() ?? null })
+return importacaoSchema.parse({ ...lida, criadoEm: lida.criadoEm.toISOString(), concluidaEm: lida.concluidaEm?.toISOString() })
```

A escola cheia deixa de ser recusada.

```mutacao
arquivo: apps/api/src/estrutura/importacao/importacao.service.ts
teste: apps/api/test/importacao.int.test.ts › três prévias ao mesmo tempo na escola
-if (vaga === undefined) throw new DomainException(ErrorCode.LIMITE_EXCEDIDO, undefined, ESPERA_QUANDO_CHEIO_SEGUNDOS)
```

O pedido que falha não devolve a vaga: a escola fica cheia.

```mutacao
arquivo: apps/api/src/estrutura/importacao/importacao.service.ts
teste: apps/api/test/importacao.int.test.ts › o pedido que falha dentro do trabalho
-await vaga.liberar()
```

O gravar deixa de ocupar vaga (só a prévia ocupa).

```mutacao
arquivo: apps/api/src/estrutura/importacao/importacao.service.ts
teste: apps/api/test/importacao.int.test.ts › o gravar ocupa vaga
-return this.comVaga(async () => gravarPlanilhaResponseSchema.parse(await this.motor.gravar(tipo, pedido)))
+return this.motor.gravar(tipo, pedido).then((gravada) => gravarPlanilhaResponseSchema.parse(gravada))
```

A prévia deixa de ocupar vaga.

```mutacao
arquivo: apps/api/src/estrutura/importacao/importacao.service.ts
teste: apps/api/test/importacao.int.test.ts › três prévias ao mesmo tempo na escola
-return this.comVaga(() => this.motor.previa(tipo, pedido))
+return this.motor.previa(tipo, pedido)
```

A leitura da importação não tem o escopo da escola: a A lê a da B.

```mutacao
arquivo: packages/core/src/importacao/importacao.repository.ts
teste: apps/api/test/importacao.int.test.ts › isolamento: o id da importação da B, na A
  concluidaEm: importacaoPlanilha.concluidaEm,
  })
  .from(importacaoPlanilha)
-.where(and(eq(importacaoPlanilha.escolaId, requireEscolaId()), eq(importacaoPlanilha.id, id)))
+.where(and(eq(importacaoPlanilha.id, id)))
```

A medição da fila não tem o escopo da escola: a série da A leva a idade da importação da B.

```mutacao
arquivo: packages/core/src/importacao/importacao.repository.ts
teste: apps/worker/test/importacao-gauge.int.test.ts › a importação de B não aparece
-.where(and(eq(importacaoPlanilha.escolaId, requireEscolaId()), eq(importacaoPlanilha.estado, 'na_fila')))
+.where(and(eq(importacaoPlanilha.estado, 'na_fila')))
```

A medição da fila conta a importação que já terminou.

```mutacao
arquivo: packages/core/src/importacao/importacao.repository.ts
teste: apps/worker/test/importacao-gauge.int.test.ts › a série é a idade da
-.where(and(eq(importacaoPlanilha.escolaId, requireEscolaId()), eq(importacaoPlanilha.estado, 'na_fila')))
+.where(and(eq(importacaoPlanilha.escolaId, requireEscolaId())))
```

A escola sem importação na fila ganha uma série (época zero).

```mutacao
arquivo: packages/core/src/importacao/importacao.repository.ts
teste: apps/worker/test/importacao-gauge.int.test.ts › a série é a idade da
-return valor === null || valor === undefined ? undefined : valor instanceof Date ? valor : new Date(valor)
+return valor === undefined ? undefined : valor instanceof Date ? valor : new Date(valor)
```

A escola sem importação na fila ganha a série zero.

```mutacao
arquivo: apps/worker/src/importacao-gauge.ts
teste: apps/worker/test/importacao-gauge.int.test.ts › a série é a idade da
-return criadaEm === undefined ? undefined : (agora.getTime() - criadaEm.getTime()) / MS_POR_MINUTO
+return criadaEm === undefined ? 0 : (agora.getTime() - criadaEm.getTime()) / MS_POR_MINUTO
```

O worker de lote não liga a medição.

```mutacao
arquivo: apps/worker/src/composition.ts
teste: apps/worker/test/importacao-gauge.int.test.ts › montada no worker de lote
-const medicao = new ImportacaoGauge({ escolas, repositorio: new ImportacaoRepository(banco), relogio, logger, medidor })
-medicao.iniciar()
+const medicao = new ImportacaoGauge({ escolas, repositorio: new ImportacaoRepository(banco), relogio, logger, medidor })
```

Toda rota autenticada gasta o balde da planilha.

```mutacao
arquivo: packages/core/src/rate-limit/rate-limit.guard.ts
teste: apps/api/test/importacao.int.test.ts › 20 pedidos por minuto por usuário
-if (!anonima && this.reflector.getAllAndOverride<boolean | undefined>(IMPORTACAO_RATE_LIMIT_KEY, alvos) === true) {
+if (!anonima) {
```

O balde cheio deixa de recusar.

```mutacao
arquivo: packages/core/src/rate-limit/rate-limit.guard.ts
teste: apps/api/test/importacao.int.test.ts › 20 pedidos por minuto por usuário
-if (!daImportacao.aceita) {
+if (false) {
```

A prévia deixa de contar no balde.

```mutacao
arquivo: apps/api/src/estrutura/importacao/importacao.controller.ts
teste: apps/api/test/importacao.int.test.ts › 20 pedidos por minuto por usuário
  @Post('importacoes/:tipo/previa')
-@ImportacaoRateLimit()
```

O gravar deixa de contar no balde.

```mutacao
arquivo: apps/api/src/estrutura/importacao/importacao.controller.ts
teste: apps/api/test/importacao.int.test.ts › 20 pedidos por minuto por usuário
  @Post('importacoes/:tipo')
-@ImportacaoRateLimit()
```

O balde passa de 20 para 21 por minuto.

```mutacao
arquivo: packages/shared/src/importacao/contratos.ts
teste: apps/api/test/importacao.int.test.ts › 20 pedidos por minuto por usuário
-export const LIMITE_DA_PLANILHA_POR_MINUTO = 20
+export const LIMITE_DA_PLANILHA_POR_MINUTO = 21
```

A escola passa a ter 3 vagas.

```mutacao
arquivo: packages/shared/src/importacao/contratos.ts
teste: apps/api/test/importacao.int.test.ts › três prévias ao mesmo tempo na escola
-export const VAGAS_DA_PLANILHA_POR_ESCOLA = 2
+export const VAGAS_DA_PLANILHA_POR_ESCOLA = 3
```

O teto de linhas passa de 3.000 para 3.001.

```mutacao
arquivo: packages/shared/src/importacao/contratos.ts
teste: packages/shared/src/importacao/contratos.test.ts › 3.000 linhas de dado entram
-export const MAXIMO_DE_LINHAS_DA_PLANILHA = 3000
+export const MAXIMO_DE_LINHAS_DA_PLANILHA = 3001
```

A quebra de linha de Mac antigo (`\r`) deixa de contar.

```mutacao
arquivo: packages/shared/src/importacao/contratos.ts
teste: packages/shared/src/importacao/contratos.test.ts › 3.000 linhas de dado entram
-for (const linha of texto.split(/\r\n|\r|\n/)) {
+for (const linha of texto.split(/\n/)) {
```

A linha vazia passa a contar para o teto.

```mutacao
arquivo: packages/shared/src/importacao/contratos.ts
teste: packages/shared/src/importacao/contratos.test.ts › o cabeçalho e as linhas vazias
-if (linha.trim() !== '') linhas += 1
+linhas += 1
```

Os bytes e as linhas passam a valer um ou o outro.

```mutacao
arquivo: packages/shared/src/importacao/contratos.ts
teste: packages/shared/src/importacao/contratos.test.ts › 512 KB exatos entram
-const textoDaPlanilhaSchema = z.string().refine((texto) => bytesEmUtf8(texto) <= MAXIMO_DE_BYTES_DA_PLANILHA && linhasDeDado(texto) <= MAXIMO_DE_LINHAS_DA_PLANILHA)
+const textoDaPlanilhaSchema = z.string().refine((texto) => bytesEmUtf8(texto) <= MAXIMO_DE_BYTES_DA_PLANILHA || linhasDeDado(texto) <= MAXIMO_DE_LINHAS_DA_PLANILHA)
```

O teto de linhas deixa de valer.

```mutacao
arquivo: packages/shared/src/importacao/contratos.ts
teste: packages/shared/src/importacao/contratos.test.ts › 3.000 linhas de dado entram
-const textoDaPlanilhaSchema = z.string().refine((texto) => bytesEmUtf8(texto) <= MAXIMO_DE_BYTES_DA_PLANILHA && linhasDeDado(texto) <= MAXIMO_DE_LINHAS_DA_PLANILHA)
+const textoDaPlanilhaSchema = z.string().refine((texto) => bytesEmUtf8(texto) <= MAXIMO_DE_BYTES_DA_PLANILHA)
```

Com o Redis fora (cliente não pronto), a vaga ainda vai ao Redis.

```mutacao
arquivo: packages/core/src/rate-limit/school-semaphore.ts
teste: packages/core/src/rate-limit/school-semaphore.test.ts › o cliente que não está pronto nem é consultado
-if (this.cliente.status !== 'ready') return this.#ocuparNoSeguro(escolaId, token)
```

A resposta 0 do Redis (escola cheia) deixa de recusar.

```mutacao
arquivo: packages/core/src/rate-limit/school-semaphore.ts
teste: packages/core/src/rate-limit/school-semaphore.test.ts › o Redis que responde 0 recusa
-return ocupou === 1 ? { liberar: () => this.#liberarNoRedis(chave, token) } : undefined
+return { liberar: () => this.#liberarNoRedis(chave, token) }
```

O seguro esquece as vagas ocupadas a cada chamada.

```mutacao
arquivo: packages/core/src/rate-limit/school-semaphore.ts
teste: packages/core/src/rate-limit/school-semaphore.test.ts › conta sozinha com máximo
-const vagas = this.#seguro.get(escolaId) ?? new Map<string, number>()
+const vagas = new Map<string, number>()
```

A vaga do seguro nunca vence.

```mutacao
arquivo: packages/core/src/rate-limit/school-semaphore.ts
teste: packages/core/src/rate-limit/school-semaphore.test.ts › a vaga que ninguém devolve vence
-if (venceEm <= agora) vagas.delete(outra)
```

A vaga do seguro vence um instante depois.

```mutacao
arquivo: packages/core/src/rate-limit/school-semaphore.ts
teste: packages/core/src/rate-limit/school-semaphore.test.ts › a vaga que ninguém devolve vence
-if (venceEm <= agora) vagas.delete(outra)
+if (venceEm < agora) vagas.delete(outra)
```

O seguro dá uma vaga a mais.

```mutacao
arquivo: packages/core/src/rate-limit/school-semaphore.ts
teste: packages/core/src/rate-limit/school-semaphore.test.ts › conta sozinha com máximo
-if (vagas.size >= this.#maximoDoSeguro) return undefined
+if (vagas.size > this.#maximoDoSeguro) return undefined
```

A vaga vencida no Redis não sai da conta: a escola fica presa.

```mutacao
arquivo: packages/core/src/rate-limit/school-semaphore.ts
teste: apps/api/test/importacao.int.test.ts › a vaga volta quando o processo morre
-redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ms)
```

O Redis deixa de recusar a escola cheia.

```mutacao
arquivo: packages/core/src/rate-limit/school-semaphore.ts
teste: apps/api/test/importacao.int.test.ts › três prévias ao mesmo tempo na escola
-if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[1]) then return 0 end
```

O prazo da `na_fila` passa de 1 h para 2 h.

```mutacao
arquivo: packages/core/src/retencao/expurgo-da-escola.repository.ts
teste: apps/worker/test/expurgo-da-escola.int.test.ts › relógio falso: com 59 min
-export const HORAS_DA_IMPORTACAO_NA_FILA = 1
+export const HORAS_DA_IMPORTACAO_NA_FILA = 2
```

A `na_fila` de exatos 60 min passa a fechar.

```mutacao
arquivo: packages/core/src/retencao/expurgo-da-escola.repository.ts
teste: apps/worker/test/expurgo-da-escola.int.test.ts › borda: com exatamente 60 min
-and criado_em < ${agora.toISOString()}::timestamptz - make_interval(hours => ${HORAS_DA_IMPORTACAO_NA_FILA})
+and criado_em <= ${agora.toISOString()}::timestamptz - make_interval(hours => ${HORAS_DA_IMPORTACAO_NA_FILA})
```

O fechamento espera a linha que o job segura.

```mutacao
arquivo: packages/core/src/retencao/expurgo-da-escola.repository.ts
teste: apps/worker/test/expurgo-da-escola.int.test.ts › com o job segurando a linha
  order by criado_em
-for update skip locked
```

O expurgo da escola deixa de fechar a importação parada.

```mutacao
arquivo: apps/worker/src/processors/expurgar-escola.ts
teste: apps/worker/test/expurgo-da-escola.int.test.ts › relógio falso: com 59 min
-const importacoesFechadasTotal = await repositorio.fecharImportacoesParadas(agora)
+const importacoesFechadasTotal = 0
```

O prazo da importação final passa de 90 para 89 dias.

```mutacao
arquivo: packages/core/src/retencao/expurgo-de-acesso.repository.ts
teste: apps/worker/test/expurgo-de-acesso.int.test.ts › importação de planilha
-export const RETENCAO_IMPORTACAO_DIAS = 90
+export const RETENCAO_IMPORTACAO_DIAS = 89
```

A `na_fila` com data de término também sai pelo prazo.

```mutacao
arquivo: packages/core/src/retencao/expurgo-de-acesso.repository.ts
teste: apps/worker/test/expurgo-de-acesso.int.test.ts › importação de planilha
-where estado <> 'na_fila' and concluida_em < ${agora.toISOString()}::timestamptz - make_interval(days => ${RETENCAO_IMPORTACAO_DIAS})
+where concluida_em < ${agora.toISOString()}::timestamptz - make_interval(days => ${RETENCAO_IMPORTACAO_DIAS})
```

A rotina de acesso deixa de apagar a importação final.

```mutacao
arquivo: apps/worker/src/processors/expurgar-acesso.ts
teste: apps/worker/test/expurgo-de-acesso.int.test.ts › importação de planilha
-importacao_planilha: await apagar('importacao_planilha'),
+importacao_planilha: 0,
```

A coordenação perde a leitura da importação.

```mutacao
arquivo: packages/shared/src/permissao/matriz.ts
teste: apps/api/test/importacao.int.test.ts › a coordenação acompanha a importação
-importacao_planilha: { previa: 'unidade', gravar: 'unidade', ler: 'unidade' },
+importacao_planilha: { previa: 'unidade', gravar: 'unidade', ler: 'nunca' },
```

A coordenação perde a leitura do calendário.

```mutacao
arquivo: packages/shared/src/permissao/matriz.ts
teste: apps/api/test/calendario.int.test.ts › a coordenação lê o calendário
-calendario: { ler: 'unidade' },
+calendario: { ler: 'nunca' },
```

O professor perde a leitura do calendário.

```mutacao
arquivo: packages/shared/src/permissao/matriz.ts
teste: apps/api/test/calendario.int.test.ts › isolamento: o professor com vínculo confirmado lê só
-calendario: { ler: 'turma_vinculada' },
+calendario: { ler: 'nunca' },
```

O teto de 100 KB deixa de ser montado na aplicação.

```mutacao
arquivo: apps/api/src/configure-app.ts
teste: apps/api/test/importacao.int.test.ts › o teto de 100 KB vale para as outras rotas
-app.use(limitarCorpoForaDaPlanilha)
```

O multipart do material passa a cair no teto de 100 KB (o teto deixa de olhar o tipo do conteúdo).

```mutacao
arquivo: apps/api/src/configure-app.ts
teste: apps/api/src/configure-app.test.ts › o corpo que não é JSON segue
-if (ehJson && !daPlanilha && declarado > LIMITE_DO_CORPO_FORA_DA_PLANILHA_BYTES) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
+if (!daPlanilha && declarado > LIMITE_DO_CORPO_FORA_DA_PLANILHA_BYTES) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
```

O envio de material de 20 MB cai no teto de 100 KB, medido pelo `material.int.test.ts` (o caso do tamanho máximo).

```mutacao
arquivo: apps/api/src/configure-app.ts
teste: apps/api/test/material.int.test.ts › exatamente no tamanho máximo
-const ehJson = /^application\/json\b/i.test(requisicao.headers['content-type'] ?? '')
+const ehJson = true
```

A chave do semáforo perde o prazo: a escola sem retorno fica presa para sempre.

```mutacao
arquivo: packages/core/src/rate-limit/school-semaphore.ts
teste: apps/api/test/importacao.int.test.ts › a vaga volta quando o processo morre
-redis.call('PEXPIRE', KEYS[1], ARGV[2])
```

O fechamento da importação parada perde o escopo da escola e o estado: a de B e a `concluida` fecham também.

```mutacao
arquivo: packages/core/src/retencao/expurgo-da-escola.repository.ts
teste: apps/worker/test/expurgo-da-escola.int.test.ts › relógio falso: com 59 min
-where escola_id = ${escolaId} and estado = 'na_fila' and id = any(array(
+where id = any(array(
  select id from importacao_planilha
-where escola_id = ${escolaId} and estado = 'na_fila'
+where true
```

O fechamento fecha também a `concluida` velha (a subconsulta e o `update` perdem o `estado`).

```mutacao
arquivo: packages/core/src/retencao/expurgo-da-escola.repository.ts
teste: apps/worker/test/expurgo-da-escola.int.test.ts › relógio falso: com 59 min
-where escola_id = ${escolaId} and estado = 'na_fila' and id = any(array(
+where escola_id = ${escolaId} and id = any(array(
  select id from importacao_planilha
-where escola_id = ${escolaId} and estado = 'na_fila'
+where escola_id = ${escolaId}
```

O lote do expurgo de acesso leva as mais novas primeiro.

```mutacao
arquivo: packages/core/src/retencao/expurgo-de-acesso.repository.ts
teste: apps/worker/test/expurgo-de-acesso.int.test.ts › importação de planilha
  where estado <> 'na_fila' and concluida_em < ${agora.toISOString()}::timestamptz - make_interval(days => ${RETENCAO_IMPORTACAO_DIAS})
-order by concluida_em
+order by concluida_em desc
```

O lote do expurgo de acesso deixa de ter o limite.

```mutacao
arquivo: packages/core/src/retencao/expurgo-de-acesso.repository.ts
teste: apps/worker/test/expurgo-de-acesso.int.test.ts › importação de planilha
  order by concluida_em
-limit ${limite}
+limit 1000000
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (1ª), revisor-geral (1ª) | `CalendarioRepository` mora em `packages/core/src/importacao/` e o calendário não é importação | Tarefa 11.0 ou 12.0 (a grade traz o repository próprio, e a 14.0 a tela): mover lá, no mesmo passo que passa a tocar o arquivo |
| tenancy-guardian (1ª) | O `@Unscoped` do `ExpurgoDeAcessoRepository` já cobre nove tabelas num método só | Acompanhar na retro da funcionalidade; é uma anotação, dentro do que a regra 10 item 9 permite |
| infra-guardian (1ª) | Índice parcial em `concluida_em where estado <> 'na_fila'` para o `delete` de `importacao_planilha` do `sistema.expurgar-acesso` | `TODO.md`: migration em tabela que hoje é pequena; vale quando o volume crescer |
| privacy-guardian (1ª) | O prazo de 90 dias (`RETENCAO_IMPORTACAO_DIAS`) é fixo para todas as escolas | Recusada: o revisor mesmo diz que bate com `docs/lgpd.md:73` e que é rastro operacional; se uma rede pedir prazo próprio, vira item da regra 20 item 16 |
| privacy-guardian (1ª) | Repetir na tela do calendário o aviso de não escrever nome de pessoa no `descricao` | Tarefa 14.0 (a tela do calendário), que a própria tarefa 5.0 lista como fora do escopo |
| test-engineer (1ª) | Cobrir o seguro em memória do balde `rl:importacao` com o Redis fora, como o `V` faz com o semáforo | `TODO.md` |
| test-engineer (1ª) | Caso no `G` com 30 e 31 minutos para a borda do alerta de importação parada | `TODO.md` |
| tenancy-guardian (2ª), revisor-geral (2ª), infra-guardian (2ª) | A checagem do `Content-Type` em `apps/api/src/configure-app.ts` usa regex própria: não reconhece valor com espaço no início nem `application/vnd.api+json`; e o JSON em pedaços (sem `Content-Length`) segue lido até 1 MB | Recusada nesta tarefa: o revisor-geral conferiu que o leitor de JSON só lê o `application/json` exato, então hoje não há furo, e a §4 da `techspec.md` já registra a exceção do corpo em pedaços. `TODO.md`: se o leitor passar a aceitar `+json`, o teto acompanha, e se aparecer abuso o caminho é contar os bytes no fluxo |
| revisor-geral (2ª), conformidade-reviewer (2ª) | `packages/shared/src/importacao/contratos.ts:14-15`: o comentário `//` novo repete o JSDoc logo acima; juntar os dois num bloco, mantendo a referência à D56 | A próxima tarefa que tocar `contratos.ts` (comentário só, sem comportamento; um ciclo de rodada não se gasta nisso, como na 5.0 do F3) |
| test-engineer (2ª) | No caso "[P] dez pedidos" de `apps/api/test/importacao.int.test.ts`, conferir com `ZCARD` da chave da escola igual a 2 que a conta passou pelo Redis (hoje, com o cliente fora de `ready`, o seguro em memória daria o mesmo resultado) | `TODO.md` |
| test-engineer (2ª) | O `estado = 'na_fila'` do `update` de `fecharImportacoesParadas` só tem bloco junto com o da subconsulta (sozinho é redundante por causa do `for update skip locked`); escrever isso em "Sem bloco (motivo)" | `TODO.md`: uma linha em "Sem bloco (motivo)" do `5_task.md`, para a validação não perguntar de novo |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-03 21:26:21 | 2026-11-03 21:27:20 | `tenancy-guardian` | 1 | APROVADO | a8fc2057ecac8eadd |
| 2026-11-03 21:26:48 | 2026-11-03 21:27:35 | `conformidade-reviewer` | 1 | APROVADO | a72386c990c4a2cab |
| 2026-11-03 21:26:32 | 2026-11-03 21:28:59 | `infra-guardian` | 1 | REPROVADO | ac1f7c03e5e7c4af5 |
| 2026-11-03 21:26:26 | 2026-11-03 21:29:10 | `privacy-guardian` | 1 | APROVADO | a4fef451f0a2776ef |
| 2026-11-03 21:26:43 | 2026-11-03 21:29:11 | `revisor-geral` | 1 | REPROVADO | ac4995d238ccf6fc4 |
| 2026-11-03 21:26:37 | 2026-11-03 21:31:31 | `test-engineer` | 1 | REPROVADO | a68023ecfc8eaa85b |
| 2026-11-03 21:52:02 | 2026-11-03 21:52:44 | `infra-guardian` | 2 | APROVADO | a3bc2367af7dde4cc |
| 2026-11-03 21:52:36 | 2026-11-03 21:53:04 | `tenancy-guardian` | 2 | APROVADO | a0f8f88416ffc8908 |
| 2026-11-03 21:52:29 | 2026-11-03 21:53:06 | `revisor-geral` | 2 | APROVADO | ab2528d708ba724df |
| 2026-11-03 21:52:44 | 2026-11-03 21:53:12 | `privacy-guardian` | 2 | APROVADO | a7d04a88814d4d36f |
| 2026-11-03 21:52:51 | 2026-11-03 21:53:14 | `conformidade-reviewer` | 2 | APROVADO | a1516c1fbf72e3c5e |
| 2026-11-03 21:52:17 | 2026-11-03 21:53:55 | `test-engineer` | 2 | APROVADO | a3dec94fa19600cb7 |
