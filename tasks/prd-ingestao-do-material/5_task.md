# Tarefa 5.0 — A licença é registrada uma vez, com vigência, retenção e arquivo do titular

**Funcionalidade:** ingestao-do-material · **Depende de:** 1.0, 3.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

A coordenação registra, lista e altera a licença, com situação e contagem de materiais; os materiais de antes a ganham
pelo backfill; ela tem retenção e entra no arquivo do titular.

## Contexto necessário

- `techspec.md` §3, §4 (`/v1/licencas`), §6, §7
- `prd.md` RF16, RF17, RF20
- `cenarios.md` "Licença", "Migração", "Permissão…", "Isolamento"
- `.claude/rules/` 10, 20, 40, 80
- Código: `packages/core/src/retencao/expurgo-da-escola.repository.ts`
  (`ALVOS_DO_EXPURGO_DA_ESCOLA`, l.45); `packages/shared/src/privacidade/classificacao.ts`; `packages/core/src/titular/`

## Subtarefas

- [x] 5.1 — Migration (1): `licenca_de_material` e `material.licenca_id`, e o índice; (2) o backfill da §3, em lotes com `lock_timeout`
- [x] 5.2 — `GET /v1/licencas` (página, com `materiais` e `situacao`: `vigente`, `vence_em_30_dias`, `vencida`, `futura`, pelo `Clock` de São Paulo), `POST`, `PATCH /:id` (`for update`); sem exclusão; só coordenação, na matriz
- [x] 5.3 — `licenca.registrada` e `licenca.alterada` com ids e vigência, sem texto livre
- [x] 5.4 — Retenção em `material_excluido`, contada de `vigente_ate`, só sem linha de `material` que a cite (inclusive excluída), depois do passo do material; sem fim, não sai; `registrada_por` nulo na eliminação do coordenador
- [x] 5.5 — Classificação da tabela; arquivo do titular do coordenador que registrou (`licenciante` e `referencia` em `fora`)
- [x] 5.6 — Documentos: `docs/lgpd.md` (a licença, e "sem fim fica até a coordenação encerrar", R6); `docs/modelo-de-dados.md`; `docs/regulacao.md` §5 apontando a licença (R6)
- [x] 5.7 — Testes
- [x] 5.8 — O que a 3.0 deixou (`techspec.md` §11, linha "3.0"): na migration (1), o check `auditoria_escola_ou_operacao_global` aceita sem escola também `entidade = 'job'`, e `ENTIDADES_DE_AUDITORIA_SEM_ESCOLA` ganha `job`; `ops:reprocessar-job` e `ops:descartar-job` perdem a recusa do job sem escola e auditam o `sistema.*` sem escola, com `autor_operador`; o expurgo de jobs (`expurgo-de-jobs.repository.ts`) deixa o `falhou` de `material.extrair-pdf` como deixa o de `titular.*`, e o prazo `tarefa_em_segundo_plano` (`packages/shared/src/privacidade/retencao.ts`) e a linha de `job_registro` do `docs/lgpd.md` dizem isso

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/drizzle/0052_*.sql`, `0053_*.sql`, `packages/core/src/db/schema/material.ts`, `apps/api/src/material/licenca.controller.ts`, `apps/api/src/material/licenca.service.ts`, `apps/api/src/material/licenca.repository.ts`, `apps/api/src/material/material.module.ts`, `packages/shared/src/material/licenca.ts`, `packages/shared/src/index.ts` | novo e alterado |
| `packages/shared/src/permissao/matriz.ts`, `packages/shared/src/privacidade/classificacao.ts`, `packages/core/src/auditoria/acoes.ts`, `packages/core/src/retencao/expurgo-da-escola.repository.ts`, `packages/core/src/titular/`, `docs/lgpd.md`, `docs/modelo-de-dados.md`, `docs/regulacao.md` | alterado |
| `apps/api/test/licenca.int.test.ts`, `packages/core/src/db/migracao-f4.int.test.ts` | novo |
| `packages/core/src/db/schema/auditoria.ts`, `packages/core/src/auditoria/auditoria-recorder.ts`, `packages/core/src/retencao/expurgo-de-jobs.repository.ts`, `packages/shared/src/privacidade/retencao.ts`, `apps/api/src/operacao/jobs-que-falharam.repository.ts`, `apps/api/src/ops/reprocessar-job.ts`, `apps/api/src/ops/descartar-job.ts`, `apps/api/test/ops-jobs.int.test.ts` | alterado (5.8) |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| caminho feliz | I | registrada, listada, alterada | |
| situação, uma de cada | I | `vigente`, `vence_em_30_dias`, `vencida`, `futura`, cada termo com o relógio falso | |
| contagem de materiais | I | `materiais` conta os da licença, não os de outra | |
| (5.8) reprocessar e descartar `sistema.*` | I | auditados sem escola, com `autor_operador`; o de escola segue com a escola da linha. Mutação: tirar `job` de `ENTIDADES_DE_AUDITORIA_SEM_ESCOLA` | |
| (5.8) o `falhou` de `material.extrair-pdf` com 31 dias | I | fica no expurgo; o de outro tipo sai. Mutação: tirar a exceção do SQL | |
| `vigente_ate` antes de `vigente_desde`; textos fora do tamanho | I | `ENTRADA_INVALIDA` | |
| [P] dois `PATCH` da mesma licença | P | a auditoria tem dois "antes" diferentes. Mutação: tirar o `for update` | |
| auditoria | I | sem licenciante, cobertura nem referência (sentinela) | |
| retenção: vencida sem material, além do prazo | I | sai | |
| retenção: com material vivo; sem fim; da escola B | I | fica (um caso cada) | |
| retenção segurada por `mensagem_tutor` | I | material excluído citado segura a licença, a categoria termina `concluida`; quando a conversa sai, os dois saem. Mutação: tirar o `not exists` | |
| eliminação do coordenador | I | `registrada_por` nulo | |
| arquivo do titular | I | a licença no do coordenador que registrou, com `licenciante` e `referencia` em `fora` | |
| backfill | I | mesmo licenciante duas vezes: uma licença; na B, outra; `vigente_desde` no mais antigo; só excluídos: fim na última exclusão | |
| permissão: professor, aluno | I | `NAO_ENCONTRADO` na coleção e no objeto (o `PermissaoGuard` responde 404 a toda célula `nunca`; ver "Divergências resolvidas") | |
| escola sem ano letivo | I | a coordenação usa as três rotas | |
| isolamento | I | `GET` e `PATCH` da licença da B: `NAO_ENCONTRADO`; a lista da A sem as da B e sem contar material da B | |
| `contracts.test` | U | DTO sem campo proibido | |
| `CLASSIFICACAO_DAS_TABELAS` | U | confere com a migration | |

## Como testar

- Rota e permissão: `apps/api/test/material.int.test.ts`, os casos de permissão e de isolamento; `apps/api/test/material-isolamento.int.test.ts`
- Trava: `WriteBlockTrigger` (`apps/api/test/write-block-trigger.ts`), como `apps/api/test/incidente.int.test.ts` › "RF9, concorrência: duas confirmações ao mesmo tempo…"
- Retenção: `apps/worker/test/expurgo-da-escola.int.test.ts` › "%s: um dia antes do prazo a linha fica, um dia depois sai…" (l.591); `packages/core/src/retencao/expurgo-da-escola.test.ts` › "toda categoria tem ao menos um alvo…"
- Titular: `packages/core/src/titular/leitura-do-titular.test.ts` › "cada coluna de ligação…"; arquitetura: `apps/api/test/architecture.test.ts` › "a CLASSIFICACAO_DAS_TABELAS confere…" (l.1245)
- Backfill: `packages/core/src/db/migracao-f2.int.test.ts` › "só expande…" (l.160), com `pastaAteA0039` e `migrate`
- Comando: `npx vitest run --project integracao apps/api/test/licenca.int.test.ts`

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano. Na 1: cada termo da
`situacao` e o `not exists` da retenção são blocos. Na 3: a escola B com o mesmo licenciante é o segundo dado do backfill.

## Fora do escopo desta tarefa

A tela (6.0); o envio com `licencaId` e o filtro da leitura (7.0, 9.0).

## Divergências resolvidas nesta tarefa

Nenhuma contradiz a Tech Spec no desenho da licença; as duas primeiras linhas são diferenças entre o que a tabela de testes e o `cenarios.md` dizem e o que o produto já faz, e todas entraram na `techspec.md` (§4 e a linha "5.0" da §11) e no `cenarios.md` (a linha de permissão da licença) antes dos revisores; a frase geral de "Permissão…" no `cenarios.md` fica para o Orquestrador ("Recomendações sem aplicar"). As outras são detalhes que a §3, a §4 e a §11 deixavam abertos.

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| Professor e aluno recebem `NAO_ENCONTRADO` (404) também **na coleção** (`GET /v1/licencas`), e não `PERMISSAO_NEGADA` | o `PermissaoGuard` responde 404 `NAO_ENCONTRADO` a toda célula `nunca` da matriz (regra 10, item 6: "não encontrado" e "sem permissão" respondem igual); `PERMISSAO_NEGADA` na coleção seria a única rota do produto a confirmar que ela existe. O caso prova o comportamento real, na coleção e no objeto | tabela "Testes que provam a regra" desta tarefa, linha "permissão: professor, aluno"; `cenarios.md`, "Permissão…" |
| Não há `GET /v1/licencas/:id` | a §4 não o lista: só `GET` da página, `POST` e `PATCH /:id`. O isolamento do objeto se prova no `PATCH` (a da B é o mesmo `NAO_ENCONTRADO` do inexistente) e no repository (`porId`, `travarVigencia` e `alterar` com o id da B no contexto da A) | `techspec.md` §4 (tabela de rotas); `cenarios.md`, "Isolamento" |
| `exigirJobDeEscola` vira `exigirJobDaOperacao` (devolve `escolaId: string \| null`), nasce `noContextoDoJob`, e `JobSemEscolaError` sai | a 5.8 manda o job `sistema.*` ser reprocessado e descartado sem a recusa do job sem escola: ele roda no contexto da rotina do sistema, e a auditoria `job.reprocessado` ou `job.descartado` sai sem escola, só com o `autor_operador`. `apps/api/src/ops/jobs-que-falharam.ts` e o teste dele (`jobs-que-falharam.test.ts`) não estavam nos "Arquivos previstos" | `techspec.md` §11, linha "3.0" |
| A opção `relogioDasLicencas` em `AppModule` e em `MaterialModule.forRoot` | o relógio falso da situação (RF17) precisa chegar ao serviço; sem a opção, o teste só provaria a situação com o dia real. É o mesmo desenho de `relogioDosConvites` e de `relogioDaSemana`; `apps/api/src/app.module.ts` não estava nos "Arquivos previstos" | `techspec.md` §4 (`GET /v1/licencas`, "pelo `Clock` de São Paulo") |
| `registrada_por` com `ON DELETE set null ("registrada_por")`, escrito à mão na migration | o `set null` que o drizzle-kit gera anularia também `escola_id`, que é `not null` (a mesma razão da 0022) | `techspec.md` §3 (a tabela `licenca_de_material`); `cenarios.md`, "Licença" |
| O backfill roda numa transação só com a 0052 | o `migrar` aplica as migrations numa transação; os lotes de 5.000 limitam o tamanho de cada instrução e o que uma falha desfaz, não o tempo em que as linhas ficam travadas, e o `lock_timeout` de 5 s derruba a migration que esbarra numa trava, que o `migrar` tenta de novo | `techspec.md` §3, "Migrations", passo 2 (R2) |
| O check `auditoria_escola_ou_operacao_global` é refeito na 0052 (a 5.8), com `DROP` e `ADD` | o `ADD CONSTRAINT` varre `auditoria` debaixo de `ACCESS EXCLUSIVE`, como a 0029 já fez; o deploy roda fora do horário letivo e o `migrar` corre sob `lock_timeout` | `techspec.md` §11, linha "3.0" |
| O arquivo da coordenação que registrou a licença é montado com `papel: 'professor'` (rodada 1, item 5 da ordem) | `PapelDoTitular` só admite `aluno` e `professor` (`packages/shared/src/privacidade/titular.ts`); o papel só decide o uso real do professor na versão completa (`leitura-do-titular.ts`), que não toca a licença, e os casos da D85 já montam assim. O coordenador como titular fica para a tarefa futura do "Meus dados" dele; o caso ganhou um comentário de uma linha. O Arquiteto triou como detalhe que a spec não previu | `techspec.md` §7c (leitura do titular); `cenarios.md`, "Licença" |
| `tools/guardas/tabelas-do-nucleo.mjs` ganha `licencaDeMaterial` | a guarda `tabela-so-no-repository` lê essa lista, e o teste dela exige toda tabela que o núcleo exporta; o arquivo não estava nos previstos (o mesmo da 4.0 com `capituloDoMaterial`) | `techspec.md` §3 (a tabela `licenca_de_material`) |
| Arquivos de teste e de apoio fora dos "Arquivos previstos": `apps/worker/test/expurgo.int.test.ts`, `apps/worker/test/expurgo-da-escola.int.test.ts`, `apps/api/test/arquivo-do-titular.int.test.ts`, `packages/core/src/auditoria/auditoria.int.test.ts`, `packages/core/src/retencao/prazo-declarado-de-jobs.test.ts`, `packages/shared/src/permissao/matriz.expectativa.ts`, `packages/shared/src/material/licenca.test.ts`, `packages/core/src/index.ts`, `packages/shared/src/index.ts` | os testes da retenção, do arquivo do titular e da auditoria vivem nesses arquivos (a tabela "Como testar" os cita), e a matriz tem uma expectativa por célula | `techspec.md` §7 |

## Mutações

--faltando: 2 linhas (57 blocos, 1 motivo)

Um bloco por cláusula da situação (cada comparação e o ternário), da vigência (`vigenciaInvalida`, os dois `refine`, a conferência com a linha travada), do serviço, do repository (o escopo de cada `.where`, o `for update`, cada campo do `PATCH`), do relógio injetado, da retenção da licença (`not exists`, o `coalesce` do "sem fim não sai", o `<`, o prazo, a ordem, o `skip locked`, o alvo), do expurgo de jobs, da 5.8 (a lista de entidades sem escola, o contexto do job, a recusa tipada, o PDF que não fecha material) e das migrations `0052` e `0053`, que o teste de `migracao-f4` aplica num banco à parte. As duas linhas que o `--faltando` ainda lista são os índices parciais do `schema/material.ts`: espelham a `0052`, o teste lê o `.sql`, e os blocos dos índices estão nele (`os dois índices são parciais`).


```mutacao
arquivo: packages/shared/src/material/licenca.ts
teste: packages/shared/src/material/licenca.test.ts › começa amanhã
-if (vigenteDesde > hoje) return 'futura'
+if (vigenteDesde >= hoje) return 'futura'
```

```mutacao
arquivo: packages/shared/src/material/licenca.ts
teste: packages/shared/src/material/licenca.test.ts › começa amanhã
-if (vigenteDesde > hoje) return 'futura'
+if (vigenteDesde > hoje && vigenteAte !== null) return 'futura'
```

```mutacao
arquivo: packages/shared/src/material/licenca.ts
teste: packages/shared/src/material/licenca.test.ts › sem fim nunca vence
-if (vigenteAte === null) return 'vigente'
+if (vigenteAte === null) return 'vencida'
```

```mutacao
arquivo: packages/shared/src/material/licenca.ts
teste: packages/shared/src/material/licenca.test.ts › o fim de ontem já passou
-if (vigenteAte < hoje) return 'vencida'
+if (vigenteAte <= hoje) return 'vencida'
```

```mutacao
arquivo: packages/shared/src/material/licenca.ts
teste: packages/shared/src/material/licenca.test.ts › do dia 0 ao dia 30
-return vigenteAte <= maisDias(hoje, DIAS_DO_AVISO_DE_VENCIMENTO) ? 'vence_em_30_dias' : 'vigente'
+return vigenteAte < maisDias(hoje, DIAS_DO_AVISO_DE_VENCIMENTO) ? 'vence_em_30_dias' : 'vigente'
```

```mutacao
arquivo: packages/shared/src/material/licenca.ts
teste: packages/shared/src/material/licenca.test.ts › do dia 0 ao dia 30
-return vigenteAte <= maisDias(hoje, DIAS_DO_AVISO_DE_VENCIMENTO) ? 'vence_em_30_dias' : 'vigente'
+return vigenteAte <= maisDias(hoje, DIAS_DO_AVISO_DE_VENCIMENTO) ? 'vigente' : 'vence_em_30_dias'
```

```mutacao
arquivo: packages/shared/src/material/licenca.ts
teste: packages/shared/src/material/licenca.test.ts › antes é inválido; no mesmo dia
-return vigenteAte !== null && vigenteAte !== undefined && vigenteAte < vigenteDesde
+return vigenteAte !== null && vigenteAte !== undefined && vigenteAte <= vigenteDesde
```

```mutacao
arquivo: packages/shared/src/material/licenca.ts
teste: packages/shared/src/material/licenca.test.ts › começo e fim juntos
-.refine((pedido) => pedido.vigenteDesde === undefined || !vigenciaInvalida(pedido.vigenteDesde, pedido.vigenteAte), { path: ['vigenteAte'], message: 'o fim da vigência não pode vir antes do começo' })
+.refine((pedido) => pedido.vigenteDesde === undefined || true, { path: ['vigenteAte'], message: 'o fim da vigência não pode vir antes do começo' })
```

```mutacao
arquivo: apps/api/src/material/licenca.service.ts
teste: apps/api/test/licenca.int.test.ts › às 23h de São Paulo do último dia
-return diaDeUso((this.dependencias.relogio ?? systemClock).agora())
+return diaDeUso(systemClock.agora())
```

```mutacao
arquivo: apps/api/src/material/licenca.service.ts
teste: apps/api/test/licenca.int.test.ts › a lista é paginada
-return listaDeLicencasResponseSchema.parse({ itens: itens.map((item) => this.#paraResposta(item, hoje)), ...(proxima === undefined ? {} : { proxima }) })
+return listaDeLicencasResponseSchema.parse({ itens: itens.map((item) => this.#paraResposta(item, hoje)), ...{} })
```

```mutacao
arquivo: apps/api/src/material/licenca.service.ts
teste: apps/api/test/licenca.int.test.ts › a coordenação registra, lista e altera
-await registro.gravar(tx, 'licenca.registrada', { entidadeId: novaId, depois: { vigenteDesde: pedido.vigenteDesde, vigenteAte: pedido.vigenteAte ?? null } })
+await registro.gravar(tx, 'licenca.registrada', { entidadeId: novaId, depois: { vigenteDesde: pedido.vigenteDesde, vigenteAte: pedido.vigenteAte ?? pedido.vigenteDesde } })
```

```mutacao
arquivo: apps/api/src/material/licenca.service.ts
teste: apps/api/test/licenca.int.test.ts › isolamento entre escolas
-if (antes === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
+if (antes === null) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

```mutacao
arquivo: apps/api/src/material/licenca.service.ts
teste: apps/api/test/licenca.int.test.ts › o corpo vazio, o licenciante
-const depois = { vigenteDesde: pedido.vigenteDesde ?? antes.vigenteDesde, vigenteAte: pedido.vigenteAte === undefined ? antes.vigenteAte : pedido.vigenteAte }
+const depois = { vigenteDesde: antes.vigenteDesde, vigenteAte: pedido.vigenteAte === undefined ? antes.vigenteAte : pedido.vigenteAte }
```

```mutacao
arquivo: apps/api/src/material/licenca.service.ts
teste: apps/api/test/licenca.int.test.ts › o corpo vazio, o licenciante
-const depois = { vigenteDesde: pedido.vigenteDesde ?? antes.vigenteDesde, vigenteAte: pedido.vigenteAte === undefined ? antes.vigenteAte : pedido.vigenteAte }
+const depois = { vigenteDesde: pedido.vigenteDesde ?? antes.vigenteDesde, vigenteAte: antes.vigenteAte }
```

```mutacao
arquivo: apps/api/src/material/licenca.service.ts
teste: apps/api/test/licenca.int.test.ts › o corpo vazio, o licenciante
-if (vigenciaInvalida(depois.vigenteDesde, depois.vigenteAte)) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
+if (vigenciaInvalida(depois.vigenteDesde, depois.vigenteAte) && false) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
```

```mutacao
arquivo: apps/api/src/material/licenca.service.ts
teste: apps/api/test/licenca.int.test.ts › a coordenação registra, lista e altera
-if (!(await licencas.alterar(id, pedido))) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
+if ((await licencas.alterar(id, pedido))) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

```mutacao
arquivo: apps/api/src/material/licenca.service.ts
teste: apps/api/test/licenca.int.test.ts › a coordenação registra, lista e altera
-if (lida === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
+if (lida !== undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

```mutacao
arquivo: apps/api/src/material/licenca.repository.ts
teste: apps/api/test/licenca.int.test.ts › a lista da A não traz as licenças da B
-.where(and(eq(licencaDeMaterial.escolaId, requireEscolaId()), pagina === undefined ? undefined : gt(licencaDeMaterial.id, pagina)))
+.where(and(pagina === undefined ? undefined : gt(licencaDeMaterial.id, pagina)))
```

```mutacao
arquivo: apps/api/src/material/licenca.repository.ts
teste: apps/api/test/licenca.int.test.ts › a lista é paginada
-.where(and(eq(licencaDeMaterial.escolaId, requireEscolaId()), pagina === undefined ? undefined : gt(licencaDeMaterial.id, pagina)))
+.where(and(eq(licencaDeMaterial.escolaId, requireEscolaId()), pagina === undefined ? undefined : undefined))
```

```mutacao
arquivo: apps/api/src/material/licenca.repository.ts
teste: apps/api/test/licenca.int.test.ts › o repository com o id da B
 .from(licencaDeMaterial)
-.where(and(eq(licencaDeMaterial.escolaId, requireEscolaId()), eq(licencaDeMaterial.id, id)))
+.where(and(eq(licencaDeMaterial.id, id)))
 return linha
```

```mutacao
arquivo: apps/api/src/material/licenca.repository.ts
teste: apps/api/test/licenca.int.test.ts › o repository com o id da B
 .from(licencaDeMaterial)
-.where(and(eq(licencaDeMaterial.escolaId, requireEscolaId()), eq(licencaDeMaterial.id, id)))
+.where(and(eq(licencaDeMaterial.id, id)))
 .for('update')
```

```mutacao
arquivo: apps/api/src/material/licenca.repository.ts
teste: apps/api/test/licenca.int.test.ts › o repository com o id da B
 alteradaEm: sql`now()`,
 })
-.where(and(eq(licencaDeMaterial.escolaId, requireEscolaId()), eq(licencaDeMaterial.id, id)))
+.where(and(eq(licencaDeMaterial.id, id)))
 .returning({ id: licencaDeMaterial.id })
```

```mutacao
arquivo: apps/api/src/material/licenca.repository.ts
teste: apps/api/test/licenca.int.test.ts › passam um depois do outro
 .where(and(eq(licencaDeMaterial.escolaId, requireEscolaId()), eq(licencaDeMaterial.id, id)))
-.for('update')
```

```mutacao
arquivo: apps/api/src/material/licenca.repository.ts
teste: apps/api/test/licenca.int.test.ts › a coordenação registra, lista e altera
-vigenteAte: pedido.vigenteAte ?? null,
+vigenteAte: pedido.vigenteAte ?? pedido.vigenteDesde,
```

```mutacao
arquivo: apps/api/src/material/licenca.repository.ts
teste: apps/api/test/licenca.int.test.ts › a coordenação registra, lista e altera
-if (gravada === undefined) throw new InvariantException('licença não gravada')
+if (gravada !== undefined) throw new InvariantException('licença não gravada')
```

```mutacao
arquivo: apps/api/src/material/licenca.repository.ts
teste: apps/api/test/licenca.int.test.ts › muda cada campo que veio
-...(alteracao.cobertura === undefined ? {} : { cobertura: alteracao.cobertura }),
+...{},
```

```mutacao
arquivo: apps/api/src/material/licenca.repository.ts
teste: apps/api/test/licenca.int.test.ts › muda cada campo que veio
-...(alteracao.referencia === undefined ? {} : { referencia: alteracao.referencia }),
+...{},
```

```mutacao
arquivo: apps/api/src/material/licenca.repository.ts
teste: apps/api/test/licenca.int.test.ts › muda cada campo que veio
-...(alteracao.vigenteDesde === undefined ? {} : { vigenteDesde: alteracao.vigenteDesde }),
+...{},
```

```mutacao
arquivo: apps/api/src/material/licenca.repository.ts
teste: apps/api/test/licenca.int.test.ts › a coordenação registra, lista e altera
-...(alteracao.vigenteAte === undefined ? {} : { vigenteAte: alteracao.vigenteAte }),
+...{},
```

```mutacao
arquivo: apps/api/src/app.module.ts
teste: apps/api/test/licenca.int.test.ts › às 23h de São Paulo do último dia
-...(opcoes.relogioDasLicencas === undefined ? {} : { relogioDasLicencas: opcoes.relogioDasLicencas }),
+...{},
```

```mutacao
arquivo: apps/api/src/material/material.module.ts
teste: apps/api/test/licenca.int.test.ts › às 23h de São Paulo do último dia
-{ provide: LicencaService, useFactory: (banco: Database) => new LicencaService({ banco, ...(opcoes.relogioDasLicencas === undefined ? {} : { relogio: opcoes.relogioDasLicencas }) }), inject: [DB] },
+{ provide: LicencaService, useFactory: (banco: Database) => new LicencaService({ banco,  }), inject: [DB] },
```

```mutacao
arquivo: packages/core/src/retencao/expurgo-da-escola.repository.ts
teste: apps/worker/test/expurgo-da-escola.int.test.ts › o material que a conversa do Tutor ainda cita segura a licença
-and not exists (select 1 from material m where m.escola_id = ${escolaId} and m.licenca_id = l.id)
```

```mutacao
arquivo: packages/core/src/retencao/expurgo-da-escola.repository.ts
teste: apps/worker/test/expurgo-da-escola.int.test.ts › fica a licença com material vivo
-where l.escola_id = ${escolaId} and l.vigente_ate is not null
+where l.escola_id = ${escolaId}
-and l.vigente_ate + make_interval(months => ${meses}) < (${agora.toISOString()}::timestamptz at time zone ${fuso})::date
+and coalesce(l.vigente_ate, date '1900-01-01') + make_interval(months => ${meses}) < (${agora.toISOString()}::timestamptz at time zone ${fuso})::date
```

```mutacao
arquivo: packages/core/src/retencao/expurgo-da-escola.repository.ts
teste: apps/worker/test/expurgo-da-escola.int.test.ts › prazo contado de
 where l.escola_id = ${escolaId} and l.vigente_ate is not null
-and l.vigente_ate + make_interval(months => ${meses}) < (${agora.toISOString()}::timestamptz at time zone ${fuso})::date
+and l.vigente_ate + make_interval(months => ${meses}) <= (${agora.toISOString()}::timestamptz at time zone ${fuso})::date
```

```mutacao
arquivo: packages/core/src/retencao/expurgo-da-escola.repository.ts
teste: apps/worker/test/expurgo-da-escola.int.test.ts › prazo contado de
 where l.escola_id = ${escolaId} and l.vigente_ate is not null
-and l.vigente_ate + make_interval(months => ${meses}) < (${agora.toISOString()}::timestamptz at time zone ${fuso})::date
+and l.vigente_ate + make_interval(months => 0) < (${agora.toISOString()}::timestamptz at time zone ${fuso})::date
```

```mutacao
arquivo: packages/core/src/retencao/expurgo-da-escola.repository.ts
teste: apps/worker/test/expurgo-da-escola.int.test.ts › a licença de outra escola, mais antiga
-order by l.vigente_ate
+order by l.id
```

```mutacao
arquivo: packages/core/src/retencao/expurgo-da-escola.repository.ts
teste: apps/worker/test/expurgo-da-escola.int.test.ts › a licença que outra transação travou
-for update of l skip locked
+for update of l nowait
```

```mutacao
arquivo: packages/core/src/retencao/expurgo-da-escola.repository.ts
teste: apps/worker/test/expurgo-da-escola.int.test.ts › prazo contado de
-material_excluido: ['material', 'licenca_de_material'],
+material_excluido: ['material'],
```

```mutacao
arquivo: packages/core/src/retencao/expurgo-de-jobs.repository.ts
teste: apps/worker/test/expurgo.int.test.ts › o falho de `material.extrair-pdf` fica depois dos 30 dias
-or (estado = 'falhou' and tipo not like 'titular.%' and tipo <> ${TIPO_EXTRAIR_PDF} and concluido_em < now() - make_interval(days => ${RETENCAO_JOB_REGISTRO_FALHO_DIAS}))
+or (estado = 'falhou' and tipo not like 'titular.%' and concluido_em < now() - make_interval(days => ${RETENCAO_JOB_REGISTRO_FALHO_DIAS}))
```

```mutacao
arquivo: packages/core/src/auditoria/auditoria-recorder.ts
teste: apps/api/test/ops-jobs.int.test.ts › volta a aguardando, e a auditoria sai sem escola
-export const ENTIDADES_DE_AUDITORIA_SEM_ESCOLA: readonly string[] = ['rede', 'suboperador', 'job']
+export const ENTIDADES_DE_AUDITORIA_SEM_ESCOLA: readonly string[] = ['rede', 'suboperador']
```

```mutacao
arquivo: packages/core/src/auditoria/auditoria-recorder.ts
teste: apps/api/test/ops-jobs.int.test.ts › a linha sai, e a auditoria sai sem escola
-export const ENTIDADES_DE_AUDITORIA_SEM_ESCOLA: readonly string[] = ['rede', 'suboperador', 'job']
+export const ENTIDADES_DE_AUDITORIA_SEM_ESCOLA: readonly string[] = ['rede', 'suboperador']
```

```mutacao
arquivo: apps/api/src/ops/jobs-que-falharam.ts
teste: apps/api/test/ops-jobs.int.test.ts › volta a aguardando, e a auditoria sai sem escola
-return runInContext(escolaId === null ? { requisicaoId, rotinaDoSistema: true } : { requisicaoId, escolaId }, funcao)
+return runInContext(escolaId === null ? { requisicaoId } : { requisicaoId, escolaId }, funcao)
```

```mutacao
arquivo: apps/api/src/ops/jobs-que-falharam.ts
teste: apps/api/test/ops-jobs.int.test.ts › recusa material.extrair-pdf com
-if (erro instanceof JobRecusadoError) {
+if (erro instanceof JobRecusadoError && false) {
```

```mutacao
arquivo: apps/api/src/ops/descartar-job.ts
teste: apps/api/test/ops-jobs.int.test.ts › só o job de PDF mexe no material
-if (materialId === null || escolaId === null) return { id: decisao.id, tipo: decisao.tipo, materialFechado: false, objetoApagado: false }
+if (escolaId === null) return { id: decisao.id, tipo: decisao.tipo, materialFechado: false, objetoApagado: false }
```

```mutacao
arquivo: packages/core/drizzle/0052_licenca_de_material.sql
teste: packages/core/src/db/migracao-f4.int.test.ts › o check da auditoria aceita sem escola
-ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_escola_ou_operacao_global" CHECK (escola_id is not null or (autor_operador is not null and entidade in ('rede', 'suboperador', 'job')));
+ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_escola_ou_operacao_global" CHECK (escola_id is not null or (autor_operador is not null and entidade in ('rede', 'suboperador')));
```

```mutacao
arquivo: packages/core/drizzle/0052_licenca_de_material.sql
teste: packages/core/src/db/migracao-f4.int.test.ts › travas do banco
-CONSTRAINT "licenca_de_material_licenciante_preenchido" CHECK (char_length(btrim("licenca_de_material"."licenciante")) between 1 and 120),
+CONSTRAINT "licenca_de_material_licenciante_preenchido" CHECK (char_length(btrim("licenca_de_material"."licenciante")) between 1 and 121),
```

```mutacao
arquivo: packages/core/drizzle/0052_licenca_de_material.sql
teste: packages/core/src/db/migracao-f4.int.test.ts › travas do banco
-CONSTRAINT "licenca_de_material_cobertura_preenchida" CHECK (char_length(btrim("licenca_de_material"."cobertura")) between 1 and 300),
+CONSTRAINT "licenca_de_material_cobertura_preenchida" CHECK (char_length(btrim("licenca_de_material"."cobertura")) between 1 and 301),
```

```mutacao
arquivo: packages/core/drizzle/0052_licenca_de_material.sql
teste: packages/core/src/db/migracao-f4.int.test.ts › travas do banco
-CONSTRAINT "licenca_de_material_referencia_preenchida" CHECK (char_length(btrim("licenca_de_material"."referencia")) between 1 and 200),
+CONSTRAINT "licenca_de_material_referencia_preenchida" CHECK (char_length(btrim("licenca_de_material"."referencia")) between 1 and 201),
```

```mutacao
arquivo: packages/core/drizzle/0052_licenca_de_material.sql
teste: packages/core/src/db/migracao-f4.int.test.ts › travas do banco
-CONSTRAINT "licenca_de_material_vigencia_valida" CHECK ("licenca_de_material"."vigente_ate" is null or "licenca_de_material"."vigente_ate" >= "licenca_de_material"."vigente_desde")
+CONSTRAINT "licenca_de_material_vigencia_valida" CHECK ("licenca_de_material"."vigente_ate" is null or "licenca_de_material"."vigente_ate" > "licenca_de_material"."vigente_desde")
```

```mutacao
arquivo: packages/core/drizzle/0052_licenca_de_material.sql
teste: packages/core/src/db/migracao-f4.int.test.ts › travas do banco
-ALTER TABLE "material" ADD CONSTRAINT "material_licenca_da_escola_fk" FOREIGN KEY ("escola_id","licenca_id") REFERENCES "public"."licenca_de_material"("escola_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
+ALTER TABLE "material" ADD CONSTRAINT "material_licenca_da_escola_fk" FOREIGN KEY ("licenca_id") REFERENCES "public"."licenca_de_material"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0052_licenca_de_material.sql
teste: packages/core/src/db/migracao-f4.int.test.ts › vira nulo com a eliminação
-ALTER TABLE "licenca_de_material" ADD CONSTRAINT "licenca_de_material_registrada_por_da_escola_fk" FOREIGN KEY ("escola_id","registrada_por") REFERENCES "public"."usuario"("escola_id","id") ON DELETE set null ("registrada_por") ON UPDATE no action;--> statement-breakpoint
+ALTER TABLE "licenca_de_material" ADD CONSTRAINT "licenca_de_material_registrada_por_da_escola_fk" FOREIGN KEY ("escola_id","registrada_por") REFERENCES "public"."usuario"("escola_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0052_licenca_de_material.sql
teste: packages/core/src/db/migracao-f4.int.test.ts › os dois índices são parciais
-CREATE INDEX "licenca_de_material_vigente_ate_idx" ON "licenca_de_material" USING btree ("escola_id","vigente_ate") WHERE "licenca_de_material"."vigente_ate" is not null;--> statement-breakpoint
+CREATE INDEX "licenca_de_material_vigente_ate_idx" ON "licenca_de_material" USING btree ("escola_id","vigente_ate");--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0052_licenca_de_material.sql
teste: packages/core/src/db/migracao-f4.int.test.ts › os dois índices são parciais
-CREATE INDEX "material_licenca_idx" ON "material" USING btree ("escola_id","licenca_id") WHERE "material"."licenca_id" is not null;--> statement-breakpoint
+CREATE INDEX "material_licenca_idx" ON "material" USING btree ("escola_id","licenca_id");--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0053_licenca_de_material_backfill.sql
teste: packages/core/src/db/migracao-f4.int.test.ts › `vigente_desde` é o envio mais antigo
-(min("material"."enviado_em") AT TIME ZONE 'America/Sao_Paulo')::date,
+(min("material"."enviado_em") AT TIME ZONE 'UTC')::date,
```

```mutacao
arquivo: packages/core/drizzle/0053_licenca_de_material_backfill.sql
teste: packages/core/src/db/migracao-f4.int.test.ts › `vigente_desde` é o envio mais antigo
-CASE WHEN bool_and("material"."excluido_em" IS NOT NULL) THEN (max("material"."excluido_em") AT TIME ZONE 'America/Sao_Paulo')::date END
+CASE WHEN bool_or("material"."excluido_em" IS NOT NULL) THEN (max("material"."excluido_em") AT TIME ZONE 'America/Sao_Paulo')::date END
```

```mutacao
arquivo: packages/core/drizzle/0053_licenca_de_material_backfill.sql
teste: packages/core/src/db/migracao-f4.int.test.ts › `vigente_desde` é o envio mais antigo
-CASE WHEN bool_and("material"."excluido_em" IS NOT NULL) THEN (max("material"."excluido_em") AT TIME ZONE 'America/Sao_Paulo')::date END
+CASE WHEN bool_and("material"."excluido_em" IS NOT NULL) THEN (min("material"."excluido_em") AT TIME ZONE 'America/Sao_Paulo')::date END
```

```mutacao
arquivo: packages/core/drizzle/0053_licenca_de_material_backfill.sql
teste: packages/core/src/db/migracao-f4.int.test.ts › mais de um lote
-EXIT WHEN linhas = 0;
+EXIT WHEN linhas >= 0;
```

## Recomendações sem aplicar

Da rodada 1 (`.processo/ordens/5_task-r1.md`, "Sem aplicar"):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (1ª), privacy-guardian (1ª), revisor-geral (1ª) | `cenarios.md`, "Permissão…": a frase geral ainda diz `PERMISSAO_NEGADA` na coleção e só um acréscimo abre a exceção da licença; reescrever a frase para a licença | Orquestrador, que reconcilia a Tech Spec e o `cenarios.md`; o Implementador não os edita (as divergências da tarefa dizem que a reconciliação é dele) |
| revisor-geral (1ª) | `techspec.md` §7c: acrescentar `material_licenca_idx` e `licenca_de_material_vigente_ate_idx` (parcial) à linha "5.0" da §11 | Orquestrador, na mesma reconciliação: a Tech Spec não é do Implementador |
| revisor-geral (1ª) | `0053`: `RAISE` quando sobra material de terceiro com `licenca_id` nulo | Recusada: o `INSERT` anterior cobre todo par `(escola, licenciante)`, e o infra-guardian (1ª) conferiu que o laço termina; mexer na migration muda o que o `migracao-f4` já prova |
| infra-guardian (1ª) | `0052`: `NOT VALID` no check refeito de `auditoria`, para não varrer a tabela sob `ACCESS EXCLUSIVE` | Recusada: o próprio revisor a deu por aceitável (deploy fora do horário letivo; a 0029 e a 0049 fizeram igual, `techspec.md` §3, "Migrations", R2); mudar a migration refaz o que o `migracao-f4` já prova, por custo que o deploy fora do horário não paga |
| infra-guardian (1ª), test-engineer (1ª) | `POST /v1/licencas` sem idempotência: o clique duplo cria duas licenças iguais | Tarefa 6.0 (a tela desabilita o botão enquanto o envio está em andamento); a restrição única ou a chave de idempotência é decisão do Arquiteto, e vai a `TODO.md` |
| infra-guardian (1ª), privacy-guardian (1ª) | O `falhou` de `material.extrair-pdf` fica sem prazo: conferir no runbook que o alerta "Job que falhou de vez" o cobre, e/ou um teto de envelhecimento | `TODO.md` |
| privacy-guardian (1ª), revisor-geral (1ª) | `contagemPorCategoria` (`titulares.repository.ts`) não conta `licenca_de_material`; o comentário do método deixou de ser verdade | Tarefa futura do "Meus dados" do coordenador (hoje `nunca` em `meus_dados`); já está nas "Recomendações sem aplicar" da tarefa |
| privacy-guardian (1ª) | `licenca.alterada`: guardar os nomes dos campos alterados (sem o texto) quando só a cobertura ou a referência mudam | Arquiteto: muda o formato da auditoria que a Tech Spec §6 fixa; `TODO.md` |
| conformidade-reviewer (1ª) | Na 6.0: licença vencida não bloqueia nem esconde material do aluno sem uma pessoa decidir, e o aviso dos 30 dias não vira notificação fora do horário útil (D59) | Tarefa 6.0: o `conformidade-reviewer` confere os dois na revisão dela |
| test-engineer (1ª) | Os dois índices parciais do `schema/material.ts` não têm prova contra a migration: guarda de "schema igual à migration" | Retro da funcionalidade; já está nas "Recomendações sem aplicar" da tarefa |

Da rodada 2 (`.processo/ordens/5_task-r2.md`, "Sem aplicar"; soma-se à da rodada 1):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| privacy-guardian (2ª), revisor-geral (2ª) | Os itens com destino `TODO.md` da 1ª rodada (idempotência do `POST /v1/licencas`, prazo ou alerta do `falhou` de `material.extrair-pdf`, nomes dos campos alterados em `licenca.alterada`) ainda não estão no `TODO.md`, que não foi alterado | Orquestrador: escrevê-los no `TODO.md` no fechamento, antes do pouso, para não ficarem só no documento da tarefa |
| revisor-geral (2ª) | O parágrafo de abertura de "Divergências resolvidas nesta tarefa" ainda diz que a frase geral de "Permissão…" do `cenarios.md` fica para o Orquestrador, e ela já foi reescrita | Atualizar quando o documento for mexido de novo (Validador ou o fechamento); não pede rodada |
| test-engineer (2ª) | O caso novo de `ops-jobs.int.test.ts` não distingue o `isNull(jobRegistro.escolaId)` do `like(tipo, 'sistema.%')` em `job-outbox.repository.ts`: o job de escola do caso (`estrutura.gravar-planilha`) já é barrado pelo `like`; um caso com escola e tipo `sistema.*` daria prova ao `isNull` | `TODO.md`: a cláusula existia antes desta tarefa |
| test-engineer (2ª) | Nada prova que a página da lista usa um só dia (precisaria de relógio que vira o dia entre dois itens) | Retro da funcionalidade: ganho pequeno |
| privacy-guardian (2ª) | O comentário do `papel: 'professor'` no arquivo do titular da coordenação é aceitável enquanto "Meus dados" for `nunca` para ela | Sem ação: já registrado em `techspec.md` §11, linha "5.0" |

Do Implementador:

- **A prévia do titular** (`contagemPorCategoria`) não conta `licenca_de_material`: a licença entra no arquivo de quem a registrou, mas a categoria `material_excluido` da prévia ainda lê só o material. Se a coordenação precisa ver "o que o sistema guarda sobre mim" com a licença incluída, a prévia ganha a tabela numa tarefa própria.
- **Mutações que não se medem:** `l.vigente_ate is not null` no expurgo da licença é redundante com a comparação de data (o `null` torna a condição desconhecida, e o planejador a usa como o predicado do índice parcial); a mutação que o tira é equivalente, e a que prova "sem fim, não sai" é a do `coalesce`. Os dois índices parciais do `schema/material.ts` espelham a migration `0052`: o teste lê o `.sql`, e é nele que as mutações dos índices estão (o `--faltando` ainda as lista no `.ts`).
- **`material.licenciante`** continua gravado ao lado de `licenca_id` até a contração da F4b (o código novo grava os dois); a F4b tira a coluna e o `licenciante` da linha de `docs/lgpd.md`.

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-12 22:05:28 | 2026-11-12 22:06:28 | `tenancy-guardian` | 1 | APROVADO | a3bf51398cccdda99 |
| 2026-11-12 22:05:53 | 2026-11-12 22:06:33 | `conformidade-reviewer` | 1 | APROVADO | af53bf44dc7db9085 |
| 2026-11-12 22:05:48 | 2026-11-12 22:07:12 | `revisor-geral` | 1 | APROVADO | a74eb37248d988dbd |
| 2026-11-12 22:05:36 | 2026-11-12 22:07:19 | `infra-guardian` | 1 | APROVADO | a51399d38618f2857 |
| 2026-11-12 22:05:31 | 2026-11-12 22:07:39 | `privacy-guardian` | 1 | APROVADO | a45aa0d02ab755357 |
| 2026-11-12 22:05:42 | 2026-11-12 22:07:56 | `test-engineer` | 1 | APROVADO | a0a071958c2004775 |
| 2026-11-12 22:40:18 | 2026-11-12 22:40:36 | `tenancy-guardian` | 2 | APROVADO | ab78584493c7c5a15 |
| 2026-11-12 22:40:36 | 2026-11-12 22:40:53 | `infra-guardian` | 2 | APROVADO | ae3d88b55480dc51c |
| 2026-11-12 22:40:31 | 2026-11-12 22:40:55 | `privacy-guardian` | 2 | APROVADO | a75b12d0d7194eced |
| 2026-11-12 22:41:00 | 2026-11-12 22:41:16 | `conformidade-reviewer` | 2 | APROVADO | a8e73ab9f1b6904d3 |
| 2026-11-12 22:40:54 | 2026-11-12 22:41:34 | `revisor-geral` | 2 | APROVADO | a66b81f0f4ad36f69 |
| 2026-11-12 22:40:45 | 2026-11-12 22:41:48 | `test-engineer` | 2 | APROVADO | aafdf629d59bb8986 |
