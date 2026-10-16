# Tarefa 1.0 — A pessoa marca que viu a introdução, e o `/v1/eu` devolve a data

**Funcionalidade:** telas-do-aluno-e-primeiro-acesso · **Depende de:** nenhuma
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
**Porte:** grande
<!-- test-engineer e revisor-geral são obrigatórios em toda tarefa, marcados ou não. -->

## Objetivo

A API guarda e devolve a data em que a pessoa viu a introdução do papel dela. Nenhuma tela muda.

## Contexto necessário

- `techspec.md` seções 3 a 7 e 7c; `prd.md` RF12, RF16, RF18 e seção 8
- Regras 10 (itens 3, 5 e 9), 20 (item 1) e 80 (itens 7 e 9)
- Código: `eu.repository.ts`, `eu.service.ts` e `acessosDaConta`, em `apps/api/src/sessao/`;
  `LEITURAS_DO_ARQUIVO.usuario`; em `docs/lgpd.md`, a linha da eliminação agendada

## Subtarefas

- [x] 1.1 — `introducaoVistaEm` em `usuario`, com a migration do drizzle-kit; a coluna entra em
  `LEITURAS_DO_ARQUIVO.usuario.colunas`
- [x] 1.2 — `esquemaRespostaEu` ganha `introducaoVistaEm`. Um método próprio do repository, ao lado de
  `acessosDaConta`, devolve a data só para o service, com a justificativa do `@SemEscopo` citando a data, o filtro por
  papel e que ela não sai em `acessos`, e com a entrada nova na lista de `resolucao-de-tenant.repository.test.ts`; o service responde
  a mais antiga entre a do usuário e a dos acessos **do mesmo papel** (aluno: só a da própria linha). Se a data é
  emprestada e a linha da sessão está nula, o GET chama o **mesmo método de repository do POST**, que não recebe data:
  `coalesce(introducao_vista_em, now())` por `escola_id` e `id` do contexto, nunca o valor emprestado (techspec seção 3,
  "Primeira saída"). Os acessos da conta com a data vêm de método próprio (`@SemEscopo`, filtro de papel na query,
  devolve só a mais antiga), sem quebrar o `escolher` do login nem o esquema estrito do acesso; teste de que o `escolher`
  não leva a data. Gravação do GET que falha: o GET devolve a data lida, sem gravar; o teste provoca a falha no banco de teste, e não
  com mock do repository, e a falha conta num contador só com ids. O `acessos` da resposta não muda
- [x] 1.3 — `POST /v1/eu/introducao`: corpo vazio e estrito, `@Permite('eu', 'concluir_introducao')` (`proprio` nos
  três papéis, `nunca` na rede, escrito na matriz e em `matriz.expectativa.ts`), `no-store`. Usa
  `identidadeDaRequisicao()`, nunca `sessaoDaRequisicao()` nem `exigirAnoEmCurso()`. Responde a mesma data que o GET.
  Sem linha achada, `NAO_AUTENTICADO`
- [x] 1.4 — `concluirIntroducao()` na web. Todo `insert into usuario` das fixtures e da vitrine grava a data; as
  fábricas de pessoa aceitam `introducao: 'por_ver'`
- [x] 1.5 — `docs/lgpd.md` (linha nova no mapa, base legal "execução de contrato") e `docs/modelo-de-dados.md`. Na
  `0037`, a nota "só expande" da `0035`. A versão `coordenacao` do arquivo do titular não traz a data do professor (D64)
- [x] 1.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/nucleo/src/db/schema/usuario.ts`, `packages/nucleo/src/titular/leitura-do-titular.ts` | alterado |
| `packages/nucleo/drizzle/0037_introducao_vista.sql`, `packages/nucleo/drizzle/meta/`, `apps/api/test/introducao.int.test.ts` | novo |
| `packages/shared/src/sessao/eu.ts`, `packages/shared/src/permissao/matriz.ts`, `packages/shared/src/permissao/matriz.expectativa.ts` | alterado |
| `apps/api/src/sessao/eu.controller.ts`, `apps/api/src/sessao/eu.service.ts`, `apps/api/src/sessao/eu.repository.ts`, `apps/api/src/sessao/eu.repository.int.test.ts`, `apps/api/src/sessao/resolucao-de-tenant.repository.ts` | alterado |
| `apps/api/test/arquivo-do-titular.int.test.ts`, `apps/web/src/api/eu.ts`, `tools/vitrine/escola.ts` | alterado |
| `e2e/__fixtures__/sessao.ts`, `e2e/__fixtures__/governanca.ts`, `e2e/__fixtures__/painel.ts`, `docs/lgpd.md`, `docs/modelo-de-dados.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova |
|---|---|---|
| caminho feliz | integração | antes do POST, o `/v1/eu` devolve nulo; depois, a data, nos três papéis |
| borda: repetida, e virada do ano | integração | o segundo POST devolve a primeira data; o ano novo não a apaga |
| permissão | integração | sem sessão, 401; campo no corpo, `ENTRADA_INVALIDA`; nada gravado |
| isolamento entre escolas | integração | com o contexto de B, o usuário de A não é lido nem alterado |
| só a própria linha | integração | dois alunos da mesma turma e dois professores da mesma escola: um faz o POST, a linha do outro fica nula e o `/v1/eu` dele devolve nulo. **Mutação:** tirar `id = <contexto>` da escrita deixa este teste vermelho |
| escola sem ano em curso | integração | no molde de `sessao-guarda.int.test.ts` (`escola sem ano letivo em curso`): escola sem ano e escola entre anos (um encerrado, um planejado): POST 200 e GET com a data |
| duas escolas | integração | a professora de A e B marca em A: o `/v1/eu` em B devolve a data de A e grava `now()` em B; com datas nas duas, vale a mais antiga, e o POST responde essa. Data antiga pré-gravada em A: a linha de B fica não nula e diferente dela. **Mutação:** gravar o valor emprestado no lugar de `now()` deixa vermelho |
| escrita do GET, só a própria linha | integração | a professora de A e B e um colega da mesma escola B sem data: ela marca em A e lê B; a linha do colega fica nula e o `/v1/eu` dele devolve nulo. **Mutação:** tirar `id = <contexto>` da escrita do GET deixa vermelho |
| vínculo encerrado (RF12) | integração | ordem inteira: marca em A, `/v1/eu` em B, A desativada, `/v1/eu` em B devolve a data. **Mutação:** tirar a gravação do GET deixa vermelho |
| sem GET intermediário | integração | marca em A, A desativada, primeiro `/v1/eu` em B: devolve nulo (a introdução reabre). É o comportamento declarado (ressalva do RF12); o desativado não empresta |
| B sem ano em curso | integração | a professora de A entra em B sem ano em curso: o GET grava e responde, sem `exigirAnoEmCurso()` |
| corrida do GET | integração | `Promise.all` de dois GET em B (e um GET com um POST): a primeira data fica; gravação que falha devolve a data lida |
| dois papéis; outra conta | integração | professora em A e coordenadora em B não herdam; outra conta com a data gravada não empresta; a eliminação agendada não empresta |
| `coalesce` | integração | data antiga conhecida pré-gravada: o POST repetido e os dois em paralelo devolvem exatamente ela. **Mutação:** tirar o `coalesce` deixa vermelho |
| rede | integração | a sessão de rede é recusada no POST |
| concorrência: dois POST com `Promise.all` | integração | os dois respondem 200 com a mesma data |
| arquivo do titular | integração | a data sai no arquivo da própria pessoa, e a versão `coordenacao` não traz a do professor |

## Como testar

- Isolamento: `apps/api/src/sessao/eu.repository.int.test.ts › isolamento: o /v1/eu lê o usuário…`, com a escrita
- Rota: `apps/api/test/escola-sessao.int.test.ts › borda: fora de 5 a 480 minutos…` e `› concorrência: duas
  alterações…` (`subirApi`, `chamar`, `BancadaDeSessoes`)
- Duas escolas: `apps/api/test/troca-de-escola.int.test.ts`
- Rodar: `npx vitest run --project integracao apps/api/test/introducao.int.test.ts`
- Armadilha: teste que monta o corpo do `/v1/eu` ganha o campo

## Fora do escopo desta tarefa

Tela, desvio da primeira entrada (9.0 a 11.0) e log novo.

## Divergências resolvidas nesta tarefa

Preenchida por quem implementa (`/executar-task`, passo 2). Uma linha por decisão que se afasta da
Tech Spec, do `cenarios.md` ou da subtarefa. A coluna "Onde está na spec" é preenchida **antes dos
revisores**: divergência sem ela está só na tarefa, e o `revisor-geral` reprova (foram quatro
reprovações na A1). Sem nenhuma, escreva "nenhuma".

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| A falha da gravação do GET conta em uma métrica nova, `eu.introducao_falha` (contador sem rótulo), com painel em `fundacao.json` e linha em `tools/testes/metricas.ts` | a Tech Spec dizia "a falha conta num contador só com ids" sem nome; o `painel.test.ts` exige painel para toda métrica de `METRICAS`, e o contador não leva escola nem pessoa (regra 20, item 9) | `techspec.md` §7c, linha "Métrica, alerta, teste de carga" (frase acrescentada) |
| "A sessão de rede é recusada no POST" é provada pela matriz (`matriz.test.ts` contra `matriz.expectativa.ts`, com `eu.concluir_introducao` = `nunca` para `rede`), e não por chamada HTTP | a API não tem sessão de rede (no F1 a rede não tem usuário nem token), então não há token para a chamada | `techspec.md` §4 (a célula `rede`: `nunca`) |
| O ramo "sem linha" do POST e do GET tem um teste de unidade com repository de mentira (`eu.service.test.ts`) | a guarda acabou de ler o usuário; o ramo só se alcança se ele sair entre a guarda e o service, o que o HTTP não produz | `techspec.md` §4 ("Sem linha achada, o POST responde `NAO_AUTENTICADO`") |
| A versão `coordenacao` do arquivo do titular traz a `introducao_vista_em` do **aluno** (e não a do professor) | o texto da Tech Spec e da subtarefa 1.5 só falava do professor; a versão `coordenacao` é a que chega ao aluno sem conta ativa, e tirar a data dele do pedido de acesso lhe negaria um dado dele (art. 18, regra 20 item 19) | `techspec.md` §7, linha "Arquivo do titular" |

## Mutações

Linha com `-` sai, com `+` entra, com espaço é contexto. O portão da tarefa aplica cada bloco, roda o teste citado e exige vermelho.

Um bloco por cláusula do diff. A escrita é uma instrução só, usada pelo POST e pelo GET, então o `id = <contexto>` e o
`coalesce` dela são provados pelos testes de cada rota. A falha do GET e a data emprestada usam o banco de teste (um gatilho
que recusa a escrita), e não mock. A cláusula `isNotNull(introducao_vista_em)` não existe: o `min` ignora o nulo.

```mutacao
arquivo: apps/api/src/sessao/eu.repository.ts
teste: apps/api/test/introducao.int.test.ts › só a própria linha
  .set({ introducaoVistaEm: sql`coalesce(${usuario.introducaoVistaEm}, now())` })
-  .where(and(eq(usuario.escolaId, escolaId), eq(usuario.id, usuarioId)))
+  .where(and(eq(usuario.escolaId, escolaId)))
```

```mutacao
arquivo: apps/api/src/sessao/eu.repository.ts
teste: apps/api/test/introducao.int.test.ts › a escrita do GET é só da linha da sessão
  .set({ introducaoVistaEm: sql`coalesce(${usuario.introducaoVistaEm}, now())` })
-  .where(and(eq(usuario.escolaId, escolaId), eq(usuario.id, usuarioId)))
+  .where(and(eq(usuario.escolaId, escolaId)))
```

```mutacao
arquivo: apps/api/src/sessao/eu.repository.ts
teste: apps/api/src/sessao/eu.repository.int.test.ts › isolamento: marcar a introdução grava só a linha do contexto
  .set({ introducaoVistaEm: sql`coalesce(${usuario.introducaoVistaEm}, now())` })
-  .where(and(eq(usuario.escolaId, escolaId), eq(usuario.id, usuarioId)))
+  .where(and(eq(usuario.id, usuarioId)))
```

```mutacao
arquivo: apps/api/src/sessao/eu.repository.ts
teste: apps/api/test/introducao.int.test.ts › coalesce: com uma data antiga já gravada
-  .set({ introducaoVistaEm: sql`coalesce(${usuario.introducaoVistaEm}, now())` })
+  .set({ introducaoVistaEm: sql`now()` })
```

```mutacao
arquivo: apps/api/src/sessao/eu.repository.ts
teste: apps/api/test/introducao.int.test.ts › e grava now
-  .set({ introducaoVistaEm: sql`coalesce(${usuario.introducaoVistaEm}, now())` })
+  .set({ introducaoVistaEm: sql`coalesce(${usuario.introducaoVistaEm}, (select min(u2.introducao_vista_em) from usuario u2 where u2.conta_id = usuario.conta_id and u2.escola_id <> usuario.escola_id), now())` })
```

```mutacao
arquivo: apps/api/src/sessao/eu.service.ts
teste: apps/api/test/introducao.int.test.ts › vínculo encerrado
   let propria = linha.introducaoVistaEm
-  if (propria === null && emprestada !== null) propria = await this.#gravarSemEmprestar()
```

```mutacao
arquivo: apps/api/src/sessao/eu.service.ts
teste: apps/api/test/introducao.int.test.ts › a gravação do GET que falha no banco
   this.#naoGravadas.add(1)
-  return null
+  throw new Error('mutação')
```

```mutacao
arquivo: apps/api/src/sessao/eu.service.ts
teste: apps/api/test/introducao.int.test.ts › a gravação do GET que falha no banco
-  this.#naoGravadas.add(1)
```

```mutacao
arquivo: apps/api/src/sessao/eu.service.ts
teste: apps/api/test/introducao.int.test.ts › e grava now
-  return a.getTime() <= b.getTime() ? a : b
+  return a.getTime() >= b.getTime() ? a : b
```

```mutacao
arquivo: apps/api/src/sessao/eu.service.ts
teste: apps/api/test/introducao.int.test.ts › e grava now
-  const vista = emprestada !== null && emprestada.getTime() < gravada.getTime() ? emprestada : gravada
+  const vista = gravada
```

```mutacao
arquivo: apps/api/src/sessao/eu.service.ts
teste: apps/api/test/introducao.int.test.ts › caminho feliz
-  return linha.contaId === null ? null : this.resolucao.introducaoMaisAntigaDaConta(linha.contaId, linha.papel)
+  return linha.contaId === null ? new Date(0) : this.resolucao.introducaoMaisAntigaDaConta(linha.contaId, linha.papel)
```

```mutacao
arquivo: apps/api/src/sessao/eu.service.ts
teste: apps/api/src/sessao/eu.service.test.ts › o POST sem a linha
   const gravada = await this.eu.marcarIntroducaoVista()
-  if (gravada === undefined) throw new ErroDeDominio(CodigoDeErro.NAO_AUTENTICADO)
```

```mutacao
arquivo: apps/api/src/sessao/resolucao-de-tenant.repository.ts
teste: apps/api/test/introducao.int.test.ts › outra conta com a data gravada não empresta
-      .where(and(eq(usuario.contaId, contaId), eq(usuario.papel, papel), isNull(usuario.desativadoEm), isNull(usuario.eliminacaoAgendadaEm)))
+      .where(and(eq(usuario.papel, papel), isNull(usuario.desativadoEm), isNull(usuario.eliminacaoAgendadaEm)))
```

```mutacao
arquivo: apps/api/src/sessao/resolucao-de-tenant.repository.ts
teste: apps/api/test/introducao.int.test.ts › o mesmo papel é que empresta
-      .where(and(eq(usuario.contaId, contaId), eq(usuario.papel, papel), isNull(usuario.desativadoEm), isNull(usuario.eliminacaoAgendadaEm)))
+      .where(and(eq(usuario.contaId, contaId), isNull(usuario.desativadoEm), isNull(usuario.eliminacaoAgendadaEm)))
```

```mutacao
arquivo: apps/api/src/sessao/resolucao-de-tenant.repository.ts
teste: apps/api/test/introducao.int.test.ts › sem o GET no meio
-      .where(and(eq(usuario.contaId, contaId), eq(usuario.papel, papel), isNull(usuario.desativadoEm), isNull(usuario.eliminacaoAgendadaEm)))
+      .where(and(eq(usuario.contaId, contaId), eq(usuario.papel, papel), isNull(usuario.eliminacaoAgendadaEm)))
```

```mutacao
arquivo: apps/api/src/sessao/resolucao-de-tenant.repository.ts
teste: apps/api/test/introducao.int.test.ts › outra conta com a data gravada não empresta
-      .where(and(eq(usuario.contaId, contaId), eq(usuario.papel, papel), isNull(usuario.desativadoEm), isNull(usuario.eliminacaoAgendadaEm)))
+      .where(and(eq(usuario.contaId, contaId), eq(usuario.papel, papel), isNull(usuario.desativadoEm)))
```

```mutacao
arquivo: apps/api/src/sessao/eu.controller.ts
teste: apps/api/test/introducao.int.test.ts › permissão
-    if (!esquemaConcluirIntroducao.safeParse(corpo ?? {}).success) throw new ErroDeDominio(CodigoDeErro.ENTRADA_INVALIDA)
```

```mutacao
arquivo: packages/shared/src/permissao/matriz.ts
teste: packages/shared/src/permissao/matriz.test.ts › cada célula da matriz está na expectativa
-    eu: { ler: 'nunca', concluir_introducao: 'nunca' },
+    eu: { ler: 'nunca', concluir_introducao: 'proprio' },
```

```mutacao
arquivo: packages/nucleo/src/titular/leitura-do-titular.ts
teste: apps/api/test/arquivo-do-titular.int.test.ts › a data da introdução vista vai no arquivo
-      sql`select ${colunasDoSelect('id', 'papel', 'nome', 'desativado_em')}, ${versao === 'completa' ? sql.raw('t.introducao_vista_em') : sql.raw("case when t.papel = 'aluno' then t.introducao_vista_em end as introducao_vista_em")} from usuario t where t.escola_id = ${escolaId} and t.id = ${titularId}`,
+      sql`select ${colunasDoSelect('id', 'papel', 'nome', 'desativado_em')}, ${sql.raw('t.introducao_vista_em')} from usuario t where t.escola_id = ${escolaId} and t.id = ${titularId}`,
```

```mutacao
arquivo: packages/nucleo/src/titular/leitura-do-titular.ts
teste: apps/api/test/arquivo-do-titular.int.test.ts › a data da introdução vista vai no arquivo
-      sql`select ${colunasDoSelect('id', 'papel', 'nome', 'desativado_em')}, ${versao === 'completa' ? sql.raw('t.introducao_vista_em') : sql.raw("case when t.papel = 'aluno' then t.introducao_vista_em end as introducao_vista_em")} from usuario t where t.escola_id = ${escolaId} and t.id = ${titularId}`,
+      sql`select ${colunasDoSelect('id', 'papel', 'nome', 'desativado_em')}, ${versao === 'completa' ? sql.raw('t.introducao_vista_em') : sql.raw("null as introducao_vista_em")} from usuario t where t.escola_id = ${escolaId} and t.id = ${titularId}`,
```

```mutacao
arquivo: apps/api/src/sessao/eu.service.ts
teste: apps/api/test/introducao.int.test.ts › caminho feliz
-    if (propria === null && emprestada !== null) propria = await this.#gravarSemEmprestar()
+    if (propria === null) propria = await this.#gravarSemEmprestar()
```


## Recomendações sem aplicar

Recomendação de revisor que não foi aplicada, com destino: `TODO.md`, a tarefa que toca o arquivo,
ou recusada com o motivo. "Anularia as aprovações" não é motivo (`/executar-task`, passo 5). Sem
nenhuma, escreva "nenhuma".

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| privacy-guardian (2ª), revisor-geral (2ª) | O `case` só entrega a data quando `papel = 'aluno'`; coordenação como titular fica sem ela (ou trocar para `t.papel <> 'professor'`) | `/validar`: muda comportamento e decisão da Tech Spec §7 |
| tenancy-guardian (2ª), revisor-geral (2ª) | Na versão `coordenacao` a linha do professor passa a trazer `introducao_vista_em: null` (o campo aparece) | `/validar`: trocar o `case` por lista de colunas por papel muda a consulta |
| tenancy-guardian (2ª) | Repository próprio para a leitura entre escolas da mesma conta (`@SemEscopo`) | `/retro` da spec (já na 1ª rodada) |
| infra-guardian (2ª) | Conferir no `/validar` que a mutação `if (propria === null)` fica vermelha por gravação a mais no banco | `/validar` |
| infra-guardian (2ª) | Classe do erro no `catch` de `#gravarSemEmprestar` | `TODO.md` (já escrito) |
| test-engineer (2ª) | Bloco de mutação para as guardas `linha === undefined` (`eu.service.ts:31` e `:50`) | Não aplicada: os testes já pegam a remoção; formalizar no `/validar` se o validador pedir |
| test-engineer (2ª) | `expect(bruta.status).toBe(200)` antes do cabeçalho em `introducao.int.test.ts` | Tarefa futura que toca o arquivo (testes do Início, 9.0 a 11.0) |
| tenancy-guardian (1ª) | Mais um método `@SemEscopo` em `ResolucaoDeTenantRepository`; avaliar repository próprio para a leitura entre escolas da mesma conta | `/retro` da spec (muda desenho, fora da tarefa) |
| tenancy-guardian (1ª) | Frase em `docs/lgpd.md` sobre B saber que a pessoa viu a introdução em outra escola | Não aplicada: a informação só sai no arquivo da própria pessoa; coberta pela linha já escrita. Reavaliar no `/validar` |
| infra-guardian (1ª), revisor-geral (1ª) | `catch` de `#gravarSemEmprestar` sem filtro; registrar a classe do erro | `TODO.md`: muda comportamento e log (ver item 1) |
| infra-guardian (1ª) | Professora em duas escolas no cenário k6 | Tarefa 3.0 (toca `infra/k6/login-7h30.js`) |
| test-engineer (1ª) | Opção `introducao: 'por_ver'` das fábricas ainda sem uso | Tarefas 9.0 a 11.0, que a exercitam |

<!-- A seção "Revisões" é criada pelo hook tools/processo/revisoes.ts: não a escreva à mão nem acrescente seção depois dela. -->

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-10-16 08:36:00 | 2026-10-16 08:36:43 | `tenancy-guardian` | 1 | APROVADO | aa124b52ea02e056d |
| 2026-10-16 08:36:09 | 2026-10-16 08:37:10 | `infra-guardian` | 1 | APROVADO | a68d08f3a8f30e85a |
| 2026-10-16 08:36:04 | 2026-10-16 08:37:21 | `privacy-guardian` | 1 | APROVADO | a1ee4308d06a5dc29 |
| 2026-10-16 08:36:17 | 2026-10-16 08:38:35 | `revisor-geral` | 1 | REPROVADO | ac387c1b9c506cdef |
| 2026-10-16 08:36:13 | 2026-10-16 08:38:45 | `test-engineer` | 1 | REPROVADO | aabd75bef8a90968b |
| 2026-10-16 08:46:27 | 2026-10-16 08:46:53 | `tenancy-guardian` | 2 | APROVADO | a37b87cd959b33435 |
| 2026-10-16 08:46:36 | 2026-10-16 08:47:08 | `infra-guardian` | 2 | APROVADO | ae3b08c720d1c912c |
| 2026-10-16 08:46:32 | 2026-10-16 08:47:14 | `privacy-guardian` | 2 | REPROVADO | a2b28b10f84e2fcc7 |
| 2026-10-16 08:46:49 | 2026-10-16 08:47:35 | `revisor-geral` | 2 | REPROVADO | a7308276d05b7cd85 |
| 2026-10-16 08:46:42 | 2026-10-16 08:48:02 | `test-engineer` | 2 | APROVADO | a541c6acf10a33f1e |
| 2026-10-16 08:53:55 | 2026-10-16 08:54:10 | `privacy-guardian` | 3 | APROVADO | a32b425d94baa5306 |
| 2026-10-16 08:53:59 | 2026-10-16 08:54:16 | `revisor-geral` | 3 | APROVADO | ab2e3dfbcc7a7cbac |
