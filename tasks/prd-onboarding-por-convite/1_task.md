# Tarefa 1.0 — A estrutura, a decisão e o cadastro do professor moram no core, sem mudar comportamento

**Funcionalidade:** onboarding-por-convite · **Depende de:** nenhuma
**Subagentes obrigatórios:** `tenancy-guardian`
**Porte:** grande

## Objetivo

Os repositories de turma, série, disciplina, lista e vínculo, o `encerrar`, o `travarPendente` e o `fechar` da decisão e o
cadastro do professor passam a morar em `packages/core/src/estrutura/`, para o worker da 4.0 gravar pelo mesmo caminho da
API. Nada muda de comportamento; o `contaParaConvite` passa do `TenantResolutionRepository` ao `ContaGlobalRepository`,
cercado por arquivo.

## Contexto necessário

- `techspec.md` §2 (linha `packages/core/src/estrutura/`), §6 (a cerca por arquivo), §11 (regra 10, item 9)
- `.claude/rules/10-multitenancy.md` itens 3 e 9; `.claude/rules/00-arquitetura.md` item 3
- Precedente: `tasks/prd-lgpd-e-titular/1_task.md` (o ciclo de vida subiu ao core do mesmo jeito)
- Código: `apps/api/src/estrutura/{turma,serie,disciplina,lista,vinculo}/*.repository.ts`; o `encerrar` em
  `apps/api/src/estrutura/vinculo/vinculo.repository.ts`; `travarPendente` e `fechar` em
  `apps/api/src/sala/decisao/decisao.repository.ts`; `apps/api/src/sessao/convite/convite-de-professor.service.ts` e
  `contaParaConvite` em `apps/api/src/sessao/tenant/tenant-resolution.repository.ts`;
  `packages/core/src/ciclo-de-vida/conta-global.repository.ts`
- Guardas: `ZONAS_DAS_CLASSES_CERCADAS` em `apps/api/test/architecture.test.ts`; `cerca-conta-global` em
  `tools/guardas/camadas.cjs`

## Subtarefas

- [x] 1.1 — Commit de caracterização: mover os repositories, o `encerrar`, o `travarPendente` e o `fechar`, sem mudar teste; a API importa do `@educa/core` por subcaminho (`@educa/core/estrutura`). **Prova:** `git diff -M --numstat HEAD` dos sete arquivos movidos mostra só linhas de `import` trocadas (1 a 13 por arquivo); os dez arquivos de integração do passo 4, rodados com a mudança de lugar e antes do resto (172 casos), passaram sem asserção mudada; nos testes só os caminhos de `import` mudaram, com uma exceção: o caso da corrida do convite contra o expurgo, em `apps/api/src/sessao/tenant/tenant-resolution.repository.int.test.ts`, ganhou um `try { … } finally { liberar() }` em volta de `limparLoteDeContasSemUso`, para a trava não ficar presa se o caso cair; nenhuma asserção mudou. Sem commit à parte: o hook bloqueia o commit de código sem as rodadas da tarefa, e a caracterização vai no commit único da tarefa
- [x] 1.2 — `packages/core/src/estrutura/cadastro-de-professor.ts` com o cadastro; `contaParaConvite` no `ContaGlobalRepository`, `@Unscoped('a conta é global: acha ou cria pelo e-mail, sem ler nada dela, e devolve só o id e se ela é nova')`; o cadastro descarta o `nova`
- [x] 1.3 — A cerca do `ContaGlobalRepository` passa a ser o **arquivo** `cadastro-de-professor.ts` nas duas guardas, com fixture que reprova o vizinho
- [x] 1.4 — Busca pelos caminhos antigos em `apps/`, `packages/`, `tools/` e `docs/` (`grep -rn`), cada ocorrência trocada ou justificada aqui; `docs/arquitetura.md` e `docs/modelo-de-dados.md` (a exceção da conta global)
- [x] 1.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/estrutura/turma.repository.ts`, `serie.repository.ts`, `disciplina.repository.ts`, `lista.repository.ts`, `vinculo.repository.ts`, `decisao.repository.ts`, `cadastro-de-professor.ts`, `index.ts` | novo (mudança de lugar) |
| `packages/core/src/ciclo-de-vida/conta-global.repository.ts` | alterado |
| `apps/api/src/estrutura/{turma,serie,disciplina,lista,vinculo}/*.ts` | alterado |
| `apps/api/src/sala/decisao/decisao.repository.ts`, `decisao.service.ts` | alterado ou removido |
| `apps/api/src/sessao/convite/convite-de-professor.service.ts`, `convite.service.ts` | alterado |
| `apps/api/src/sessao/tenant/tenant-resolution.repository.ts` | alterado |
| `apps/api/test/architecture.test.ts`, `tools/guardas/camadas.cjs`, `tools/guardas/__fixtures__/camadas/` | alterado |
| `docs/arquitetura.md`, `docs/modelo-de-dados.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| Suíte da A1 e do F1 verde, sem nenhum teste mudado | integração | a mudança de lugar não mudou comportamento (commit de caracterização) | os dez arquivos do passo 4 (`acesso-da-turma`, `convite`, `decisao`, `historico`, `operacao-isolamento`, `turma-acesso`, `virada-do-ano`, `vinculo`, `professores` e `tenant-resolution.repository.int`), só com o `import` trocado |
| Tirar o `escolaId` do repository de turma movido deixa vermelho o `acesso-da-turma.int.test.ts` | integração | o isolamento que já existe alcança a cópia no core | `acesso-da-turma.int.test.ts › o TurmaRepository que subiu para o core…: no contexto da escola A, a turma de B não é aberta nem travada, e no contexto de B é` (teste novo: sem ele a mutação ficava verde, porque o ano de cada escola já separa as turmas) |
| Tirar o `anoLetivoId` do repository de vínculo movido deixa vermelho um teste da A1 | integração | o filtro do ano continua valendo | `vinculo.int.test.ts › sem ano letivo em curso, o vínculo falha fechado: criar, listar e meus-vinculos respondem como inexistente` |
| `contaParaConvite` acha a conta que existe | integração | a classe nova responde igual à antiga | `cadastro-de-professor.int.test.ts › a classe acha a conta que já existe e diz que ela não é nova, sem criar outra`; e as duas corridas contra o expurgo, em `tenant-resolution.repository.int.test.ts` |
| `contaParaConvite` cria a conta nova e o cadastro descarta o `nova` | integração | idem | `cadastro-de-professor.int.test.ts › a classe cria a conta do e-mail que não tem, sem senha, e diz que ela é nova` e `› o cadastro cria a conta nova e descarta o nova…` (mais `› o cadastro devolve a conta que existe só com o id`) |
| O `ContaGlobalRepository` tem quatro `@Unscoped`, e o total do repositório não muda | unidade | `repositories-com-escopo` conta pela classe nova | `ciclo-de-vida.repository.test.ts › a ContaGlobalRepository tem só os quatro métodos da conta global…`; o `tenant-resolution.repository.test.ts` perde só o `contaParaConvite`; e o `guardas/repositories-com-escopo` (lint) segue verde sem entrada nova na lista |
| Arquivo vizinho de `cadastro-de-professor.ts` que chama `contaParaConvite`: as duas guardas reprovam | unidade | a cerca é por arquivo, não por pasta | `camadas.test.ts › cerca-conta-global reprova só o que a fixture marca` (`estrutura/vizinho.ts`) e `› real: a cerca é por arquivo…`; `architecture.test.ts › reprova quem usa a classe por uma ponte…` (`estrutura/vizinho.ts` e `cadastro-de-professor-2.ts`) |
| Quem contorna é acusado: reexportação | unidade | guarda | `camadas.test.ts › cerca-conta-global…` (`vizinho-reexporta.ts`, `export *`); `architecture.test.ts › reprova quem usa a classe…` (`vizinho-reexporta.ts`, `export { … as Conta }`) |
| Quem contorna é acusado: `import()` e `require` | unidade | guarda | `camadas.test.ts › cerca-conta-global…` (`vizinho-dinamico.ts` e `vizinho-require.ts`); `architecture.test.ts › reprova quem usa a classe…` (`vizinho-dinamico.ts`, `vizinho-require.ts` e `vizinho-subcaminho.ts`) |
| Quem contorna é acusado: o caminho como texto | unidade | guarda | `architecture.test.ts › reprova quem usa a classe…` (`vizinho-texto.ts`); o depcruise não lê texto, e quem o pega é o teste de arquitetura |
| Quem chama o `contaDoProfessor` fora de `sessao/` é acusado, e o barril `estrutura/index.ts` não o reexporta | unidade | a ponte pela função, e não só pela classe | `camadas.test.ts › cerca-cadastro-de-professor reprova só o que a fixture marca` (`vaza-cadastro.ts` pelo subcaminho, `cadastro-dinamico.ts`, `cadastro-reexporta.ts` e o `estrutura/index.ts`; o controle `sessao/login/usa-cadastro.ts` passa) e `› real: só o módulo sessao importa o cadastro do professor…`; `architecture.test.ts › reprova quem usa a classe…` (`contaDoProfessor`: o barril, o service e o worker) e `› nem o barrel do @educa/nucleo nem os subcaminhos… exportam a ContaGlobalRepository` (o barril da estrutura e o subcaminho do cadastro, lidos em execução) |
| A guarda reprova quando `cadastro-de-professor.ts` some ou muda de lugar | unidade | a cerca não se cala sem o alvo | `architecture.test.ts › a varredura enxerga o código… cada entrada da zona… tem quem use a classe` e `camadas.test.ts › real: todo alvo de regra existe no grafo…` (a aresta do cadastro até a conta global) |
| O `ignore` da configuração não esconde o arquivo real | unidade | guarda | `camadas.test.ts › real: o exclude da configuração não esconde o arquivo do cadastro do professor, e esconde a fixture` |

## Como testar

- Guarda: copie `apps/api/test/architecture.test.ts › reprova quem usa a classe por uma ponte de dentro da zona, em apps, packages, tools e infra, e deixa passar a zona, o teste, a fixture e o comentário`, trocando a zona por arquivo; e `tools/guardas/camadas.test.ts › cerca-conta-global reprova só o que a fixture marca` (fixtures em `tools/guardas/__fixtures__/camadas/`, como `infra/conta-global-import.ts`)
- Caracterização: o 1.1 vai num commit só, com a suíte verde e nenhum teste alterado
- Comandos: `npx vitest run --project unidade apps/api/test/architecture.test.ts tools/guardas/camadas.test.ts`; `npx vitest run --project integracao apps/api/test/acesso-da-turma.int.test.ts apps/api/test/convite.int.test.ts`

## Autoconferência

As 12 perguntas do modelo, no plano. Na 6, uma fixture por forma de contornar; na 9, nada se copia: move.

Respostas do plano:

1. Mutações: a seção "Mutações" (18 blocos e o motivo da mudança de lugar).
2. Texto na tela: não se aplica, a tarefa não tem tela.
3. Segundo dado: o teste de turma usa duas escolas montadas e o contexto de A com o ano de B, o único em que o `escolaId` decide sozinho; o de `contaParaConvite` tem conta existente e e-mail sem conta.
4. Checagem anterior: o ano de cada escola já separa as turmas pela rota, por isso o teste novo é no repository e há o controle no contexto de B (o caso acha a turma).
5. Asserções olham o resultado (`undefined`, `false`, o objeto devolvido, o banco com uma conta só); a guarda por texto de arquivo só existe onde o contorno é texto (`architecture.test.ts`).
6. Uma fixture e um caso por forma de contornar: import, `export *`, `import()`, `require`, subcaminho, caminho como texto, arquivo vizinho e `cadastro-de-professor-2.ts`; o alvo que some cai em `real: todo alvo…` e na varredura por entrada da zona; o `exclude` tem caso próprio.
7. Comentários: o docblock da `ContaGlobalRepository`, o do cadastro e o `modelo-de-dados.md` dizem "arquivo, não pasta" e as quatro exceções, que é o que o código faz.
8. As duas divergências da tabela têm a coluna "Onde está na spec" aberta e conferida (`techspec.md` §2 e §6); o `grep` dos caminhos antigos em `apps/`, `packages/`, `tools/`, `docs/` e `e2e/` ficou sem ocorrência além dos comentários e do guia, trocados, e de `tools/renomear/mapas/` (histórico de renomeação) e dos `.md` de tarefas antigas, que são registro.
9. Nada se copia: `git mv` dos sete arquivos, e o `contaParaConvite` saiu do `TenantResolutionRepository`.
10. Corrida: as duas do `contaParaConvite` contra o expurgo (`tenant-resolution.repository.int.test.ts`) continuam, agora na classe nova; a tarefa não cria operação concorrente.
11. Cada linha da tabela de testes tem o caso na coluna "Caso".
12. `achados/indice.md` só traz as rodadas da revisão da spec; a que toca esta tarefa é a da 3ª rodada do `tenancy-guardian` (a cerca da `ContaGlobalRepository` era uma pasta inteira de repositories com escopo) e a do `revisor-geral` (os quatro `@Unscoped`): atendidas pela cerca por **arquivo** nas duas guardas, com fixture do vizinho, e pelos quatro `@Unscoped` contados no `ciclo-de-vida.repository.test.ts`. "O que verificar" do `tenancy-guardian`: escopo no repository (mutações de turma e vínculo), cerca por arquivo e `@Unscoped` justificado.

## Fora do escopo desta tarefa

A `turma.chave` (2.0); o `fechar('encerrada')` (9.0); o `desativar` que encerra vínculos (3.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| O `exclusao.ts` (a tradução do 23503 da exclusão) sobe junto com os repositories | `turma.repository.ts` e `disciplina.repository.ts` o importam, e o core não importa `apps/api` | `techspec.md` §2, linha de `packages/core/src/estrutura/` |
| O cadastro do professor entrega só o id da conta (`contaDoProfessor`); o `convidar` da A1 continua na API, dividido em `convidar` (coordenador, com o `nova` na auditoria) e `convidarProfessor` (que chama o cadastro) | o `ConviteRepository` e o `hashDoToken` não estão no mapa desta tarefa, e o convite do coordenador precisa do `nova`, que o cadastro descarta; o que o worker da 6.0 precisar do convite sobe nessa tarefa | `techspec.md` §6, parágrafo depois da lista; `docs/modelo-de-dados.md`, "Pessoas e vínculos" |
| O `contaDoProfessor` sai pelo subcaminho próprio `@educa/core/cadastro-de-professor`, fora do barril `@educa/core/estrutura`, e quem o chama também é cercado (só `sessao/`) nas duas guardas | a cerca da classe não alcança a função que a repassa: no barril, qualquer módulo que importasse a estrutura acharia ou criaria a conta global pelo e-mail (`tenancy-guardian` e `test-engineer`, 1ª rodada) | `techspec.md` §6, parágrafo depois da lista; `docs/modelo-de-dados.md`, "Pessoas e vínculos"; `cenarios.md`: não se aplica (é cerca de arquitetura, sem comportamento de negócio novo; o documento é do Arquiteto e não foi editado) |

## Mutações

--faltando: 67 linhas (18 blocos, 1 motivo)

**Mudança de lugar, sem cláusula nova (motivo):** as 67 linhas que o `--faltando` ainda lista em `packages/core/src/estrutura/{decisao,disciplina,exclusao,lista,serie,turma,vinculo}.ts` são as dos arquivos que subiram de `apps/api` sem mudar uma linha de lógica (só os `import` mudaram: `git diff -M --numstat HEAD` dá de 1 a 13 linhas por arquivo). O `--faltando` as lê como novas porque usa `--no-renames`. A prova delas é a suíte da A1 e do F1, rodada sem asserção mudada, e as cinco mutações abaixo, de `turma` e de `vinculo`, que mostram o escopo valendo na cópia.

O `escolaId` da turma, um bloco por método movido:

```mutacao
arquivo: packages/core/src/estrutura/turma.repository.ts
teste: apps/api/test/acesso-da-turma.int.test.ts › no contexto da escola A, a turma de B não é aberta nem travada, e no contexto de B é
falha: toBeUndefined()
      .innerJoin(serie, and(eq(serie.escolaId, turma.escolaId), eq(serie.id, turma.serieId)))
      .where(
        and(
-         eq(turma.escolaId, requireEscolaId()),
          this.#doAnoDaLeitura(anoEncerrado),
```

```mutacao
arquivo: packages/core/src/estrutura/turma.repository.ts
teste: apps/api/test/acesso-da-turma.int.test.ts › no contexto da escola A, a turma de B não é aberta nem travada, e no contexto de B é
falha: toBe(false)
  async travarContraOGerar(id: string, modo: 'update' | 'no key update'): Promise<boolean> {
    const [linha] = await this.banco
      .select({ id: turma.id })
      .from(turma)
-     .where(and(eq(turma.escolaId, requireEscolaId()), eq(turma.anoLetivoId, requireAnoEmCurso()), eq(turma.id, id)))
+     .where(and(eq(turma.anoLetivoId, requireAnoEmCurso()), eq(turma.id, id)))
      .for(modo)
```

```mutacao
arquivo: packages/core/src/estrutura/turma.repository.ts
teste: apps/api/test/acesso-da-turma.int.test.ts › no contexto da escola A, a turma de B não é aberta nem travada, e no contexto de B é
falha: toBe(false)
  async travarContraExclusao(id: string): Promise<boolean> {
    const [linha] = await this.banco
      .select({ id: turma.id })
      .from(turma)
-     .where(and(eq(turma.escolaId, requireEscolaId()), eq(turma.anoLetivoId, requireAnoEmCurso()), eq(turma.id, id)))
+     .where(and(eq(turma.anoLetivoId, requireAnoEmCurso()), eq(turma.id, id)))
      .for('key share')
```

```mutacao
arquivo: packages/core/src/estrutura/turma.repository.ts
teste: apps/api/test/acesso-da-turma.int.test.ts › no contexto da escola A, a turma de B não é aberta nem travada, e no contexto de B é
falha: toBe(false)
      .from(anoLetivo)
-     .where(and(eq(anoLetivo.escolaId, requireEscolaId()), eq(anoLetivo.id, requireAnoEmCurso()), eq(anoLetivo.situacao, 'em_curso')))
+     .where(and(eq(anoLetivo.id, requireAnoEmCurso()), eq(anoLetivo.situacao, 'em_curso')))
      .for('share')
```

O `anoLetivoId` do vínculo movido:

```mutacao
arquivo: packages/core/src/estrutura/vinculo.repository.ts
teste: apps/api/test/vinculo.int.test.ts › sem ano letivo em curso, o vínculo falha fechado: criar, listar e `meus-vinculos` respondem como inexistente
  #escopo(): SQL | undefined {
-   return and(eq(vinculo.escolaId, requireEscolaId()), eq(vinculo.anoLetivoId, requireAnoEmCurso()), eq(vinculo.papel, 'professor'))
+   return and(eq(vinculo.escolaId, requireEscolaId()), eq(vinculo.papel, 'professor'))
  }
```

O `contaParaConvite` na classe nova (as três linhas que o `--faltando` apontava, o `@Unscoped` e o `.for`):

```mutacao
arquivo: packages/core/src/ciclo-de-vida/conta-global.repository.ts
teste: packages/core/src/estrutura/cadastro-de-professor.int.test.ts › a classe cria a conta do e-mail que não tem, sem senha, e diz que ela é nova
falha: toBe(true)
-     if (criada !== undefined) return { id: criada.id, nova: true }
+     if (criada !== undefined) return { id: criada.id, nova: false }
```

```mutacao
arquivo: packages/core/src/ciclo-de-vida/conta-global.repository.ts
teste: packages/core/src/estrutura/cadastro-de-professor.int.test.ts › a classe acha a conta que já existe e diz que ela não é nova, sem criar outra
falha: toEqual({ id: existente, nova: false })
-     if (existente !== undefined) return { id: existente.id, nova: false }
+     if (existente !== undefined) return { id: existente.id, nova: true }
```

```mutacao
arquivo: packages/core/src/ciclo-de-vida/conta-global.repository.ts
teste: packages/core/src/estrutura/cadastro-de-professor.int.test.ts › a classe acha a conta que já existe e diz que ela não é nova, sem criar outra
falha: toEqual({ id: existente, nova: false })
-     const [existente] = await this.banco.select({ id: conta.id }).from(conta).where(eq(conta.email, email)).limit(1).for('no key update')
+     const [existente] = await this.banco.select({ id: conta.id }).from(conta).limit(1).for('no key update')
```

```mutacao
arquivo: packages/core/src/ciclo-de-vida/conta-global.repository.ts
teste: apps/api/src/sessao/tenant/tenant-resolution.repository.int.test.ts › o convite trava a conta primeiro: o lote da madrugada, rodando no meio, pula a conta e não apaga o e-mail
-     const [existente] = await this.banco.select({ id: conta.id }).from(conta).where(eq(conta.email, email)).limit(1).for('no key update')
+     const [existente] = await this.banco.select({ id: conta.id }).from(conta).where(eq(conta.email, email)).limit(1)
```

```mutacao
arquivo: packages/core/src/ciclo-de-vida/conta-global.repository.ts
teste: packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.test.ts › a ContaGlobalRepository tem só os quatro métodos da conta global, cada um com @SemEscopo e a justificativa de que a conta é global
falha: toBeGreaterThanOrEqual
-  @Unscoped('a conta é global: acha ou cria pelo e-mail, sem ler nada dela, e devolve só o id e se ela é nova')
   async contaParaConvite(email: string): Promise<{ id: string; nova: boolean }> {
```

O cadastro descarta o `nova`:

```mutacao
arquivo: packages/core/src/estrutura/cadastro-de-professor.ts
teste: packages/core/src/estrutura/cadastro-de-professor.int.test.ts › o cadastro cria a conta nova e descarta o nova: nada diz que o e-mail não tinha conta
falha: toStrictEqual({ id: criada.id })
-   const { id } = await new ContaGlobalRepository(tx).contaParaConvite(email)
-   return { id }
+   return new ContaGlobalRepository(tx).contaParaConvite(email)
```

A cerca por arquivo, nas duas guardas:

```mutacao
arquivo: tools/guardas/camadas.cjs
teste: tools/guardas/camadas.test.ts › cerca-conta-global reprova só o que a fixture marca
-      from: { path: TODO_O_CODIGO, pathNot: [SESSAO, '^packages/core/src/ciclo-de-vida/', CADASTRO_DE_PROFESSOR, TESTE] },
+      from: { path: TODO_O_CODIGO, pathNot: [SESSAO, '^packages/core/src/ciclo-de-vida/', '^packages/core/src/estrutura/', TESTE] },
```

```mutacao
arquivo: apps/api/test/architecture.test.ts
teste: apps/api/test/architecture.test.ts › nenhum código de produção fora da zona cita a ResolucaoDeTenantRepository, a ContaGlobalRepository nem o PainelRepository
-  { classe: 'ContaGlobalRepository', uso: /\bContaGlobalRepository\b|conta-global\.repository|@educa\/core\/conta-global/, zona: ['apps/api/src/sessao/', 'packages/core/src/ciclo-de-vida/', 'packages/core/src/estrutura/cadastro-de-professor.ts'] },
+  { classe: 'ContaGlobalRepository', uso: /\bContaGlobalRepository\b|conta-global\.repository|@educa\/core\/conta-global/, zona: ['apps/api/src/sessao/', 'packages/core/src/ciclo-de-vida/'] },
```

A cerca do `contaDoProfessor` e o barril da estrutura (a correção da 1ª rodada):

```mutacao
arquivo: packages/core/src/estrutura/index.ts
teste: apps/api/test/architecture.test.ts › nem o barrel do @educa/nucleo nem os subcaminhos do ciclo de vida, da estrutura e do cadastro do professor exportam a ContaGlobalRepository, com o nome dela ou outro
falha: not.toContain('ContaGlobalRepository')
-export { VinculoRepository } from './vinculo.repository.js'
+export { VinculoRepository } from './vinculo.repository.js'
+export { ContaGlobalRepository } from '../ciclo-de-vida/conta-global.repository.js'
```

```mutacao
arquivo: packages/core/src/estrutura/index.ts
teste: apps/api/test/architecture.test.ts › nem o barrel do @educa/nucleo nem os subcaminhos do ciclo de vida, da estrutura e do cadastro do professor exportam a ContaGlobalRepository, com o nome dela ou outro
falha: not.toContain('contaDoProfessor')
-export { VinculoRepository } from './vinculo.repository.js'
+export { VinculoRepository } from './vinculo.repository.js'
+export { contaDoProfessor } from './cadastro-de-professor.js'
```

```mutacao
arquivo: tools/guardas/camadas.cjs
teste: tools/guardas/camadas.test.ts › cerca-cadastro-de-professor reprova só o que a fixture marca
falha: toEqual([...esperadas].sort())
-      from: { path: TODO_O_CODIGO, pathNot: [SESSAO, TESTE] },
+      from: { path: TODO_O_CODIGO, pathNot: [SESSAO, '^packages/core/src/estrutura/', TESTE] },
      to: { path: CADASTRO_DE_PROFESSOR },
```

```mutacao
arquivo: apps/api/test/architecture.test.ts
teste: apps/api/test/architecture.test.ts › reprova quem usa a classe por uma ponte de dentro da zona, em apps, packages, tools e infra, e deixa passar a zona, o teste, a fixture e o comentário
falha: toEqual([
-  { classe: 'contaDoProfessor', uso: /\bcontaDoProfessor\b|cadastro-de-professor|@educa\/core\/cadastro-de-professor/, zona: ['apps/api/src/sessao/', 'packages/core/src/estrutura/cadastro-de-professor.ts'] },
+  { classe: 'contaDoProfessor', uso: /\bcontaDoProfessor\b|cadastro-de-professor|@educa\/core\/cadastro-de-professor/, zona: ['apps/api/src/', 'packages/core/src/estrutura/cadastro-de-professor.ts'] },
```

A zona por arquivo é igualdade, e não `startsWith` (a ordem da rodada 2, item 7):

```mutacao
arquivo: apps/api/test/architecture.test.ts
teste: apps/api/test/architecture.test.ts › reprova quem usa a classe por uma ponte de dentro da zona, em apps, packages, tools e infra, e deixa passar a zona, o teste, a fixture e o comentário
falha: toEqual([
-  return entrada.endsWith('/') ? caminho.startsWith(entrada) : caminho === entrada
+  return caminho.startsWith(entrada)
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (1ª) | Caso em `cadastro-de-professor.int.test.ts` provando que e-mail com outra caixa ou com espaço não cria segunda conta | tarefa 4.0 (`4_task.md`, subtarefa 4.4, o processor): hoje a normalização é de quem chama (`normalizarEmail`), e o teste exigiria que o cadastro passasse a normalizar, o que muda comportamento. Vale quando o worker chamar sem passar por `convite.service.ts` |
| infra-guardian (1ª) | O worker da planilha roda na fila de lote com limite de concorrência por escola, com transação curta (por linha ou bloco pequeno), sem segurar `travarEscola` e as linhas de `conta` durante o lote | tarefa 4.0 (`4_task.md`, 4.4): o worker é dela |
| infra-guardian (1ª) | Registrar no contrato da 4.0 que o `contaDoProfessor` não exige `travarEscola` antes; o worker segue a ordem da API (escola primeiro, conta depois) | tarefa 4.0 (`4_task.md`, 4.4) |
| test-engineer (1ª) | O teste "contexto de A com o ano de B" para vínculo, lista e decisão | tarefa 4.0: só passa a importar quando o worker monta o contexto a partir do job |
| test-engineer (1ª) | Teste de dois convites ao mesmo e-mail novo, em paralelo, em `cadastro-de-professor.int.test.ts` | tarefa 4.0 (`4_task.md`, 4.4), antes de o worker cadastrar em lote; o `onConflictDoNothing` com nova tentativa é anterior a esta tarefa |
| revisor-geral (1ª) | `docs/modelo-de-dados.md`: a coluna de `contaParaConvite` dizia "no convite da coordenação" | já aplicada: o texto da árvore diz "no convite da coordenação e no cadastro do professor" |
| privacy-guardian (1ª), revisor-geral (1ª), test-engineer (1ª) | Cercar quem chama o `contaDoProfessor`; pôr `@educa/core/estrutura` na conferência em execução; bloco de mutação do `@Unscoped` | já atendidas na 2ª rodada (subcaminho próprio, as duas guardas, o bloco reescrito) |
| tenancy-guardian (2ª), privacy-guardian (2ª), test-engineer (2ª) | Quando o processor do worker entrar na zona, mudar as duas guardas e a asserção `startsWith('apps/api/src/sessao/')` do caso `real:` no mesmo commit, cada uma com fixture de controle que passa; conferir que o worker leva só o id da conta a log e a payload | tarefa 4.0 (`4_task.md`, 4.4) |
| revisor-geral (2ª) | O `uso` de `contaDoProfessor` casa `cadastro-de-professor` em qualquer nome de arquivo; conferir na 4.0 que não acusa um arquivo do worker parecido | tarefa 4.0 (`4_task.md`, 4.4) |
| revisor-geral (3ª) | Confirmar que o "18 blocos" e as "67 linhas" da seção "Mutações" batem com o que o `--faltando` imprime | conferido pela Mesa: `node tools/processo/mutacoes.ts --faltando` imprime 67 linhas e 18 blocos, e o `1_task.md` diz o mesmo. Nada a mudar |
| revisor-geral (3ª) | O comentário novo de `packages/core/src/estrutura/cadastro-de-professor.ts` repete o que está em `docs/modelo-de-dados.md` e em `ZONAS_DAS_CLASSES_CERCADAS`: três lugares para manter iguais | tarefa 4.0 (`4_task.md`, 4.4), que mexe na zona quando o worker entrar; a mudança das duas guardas e dos três textos vai no mesmo commit |
| privacy-guardian (3ª) | Na 4.0, a entrada nova da zona do `contaDoProfessor` é o arquivo exato do processor, e não a pasta do worker | tarefa 4.0 (`4_task.md`, 4.4) |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-03 16:38:33 | 2026-11-03 16:39:25 | `privacy-guardian` | 1 | APROVADO | a47ea35eda935facd |
| 2026-11-03 16:38:25 | 2026-11-03 16:39:33 | `revisor-geral` | 1 | APROVADO | aa235fd4c2fca3385 |
| 2026-11-03 16:38:40 | 2026-11-03 16:39:37 | `conformidade-reviewer` | 1 | APROVADO | a6190563fe7b4b8a3 |
| 2026-11-03 16:38:10 | 2026-11-03 16:39:44 | `tenancy-guardian` | 1 | REPROVADO | a092448777d47851d |
| 2026-11-03 16:38:48 | 2026-11-03 16:39:51 | `infra-guardian` | 1 | APROVADO | a5ed44428b95f6533 |
| 2026-11-03 16:38:17 | 2026-11-03 16:40:56 | `test-engineer` | 1 | REPROVADO | a74f4201ea19084b0 |
| 2026-11-03 17:00:23 | 2026-11-03 17:00:59 | `tenancy-guardian` | 2 | APROVADO | afcaf0090664d2baf |
| 2026-11-03 17:00:46 | 2026-11-03 17:01:07 | `revisor-geral` | 2 | APROVADO | a44f6779b2d54c5ce |
| 2026-11-03 17:00:56 | 2026-11-03 17:01:14 | `privacy-guardian` | 2 | APROVADO | a4975146cde43437d |
| 2026-11-03 17:01:07 | 2026-11-03 17:01:21 | `conformidade-reviewer` | 2 | APROVADO | aa02fba6f580f61e0 |
| 2026-11-03 17:00:35 | 2026-11-03 17:01:28 | `test-engineer` | 2 | APROVADO | ab7970de0f76f3cd1 |
| 2026-11-03 17:01:17 | 2026-11-03 17:01:33 | `infra-guardian` | 2 | APROVADO | a6ba3f2e2a8663ec5 |
| 2026-11-03 17:11:26 | 2026-11-03 17:11:41 | `tenancy-guardian` | 3 | APROVADO | a86739856510e76c6 |
| 2026-11-03 17:11:37 | 2026-11-03 17:12:01 | `test-engineer` | 3 | APROVADO | abb5389f9952b54da |
| 2026-11-03 17:11:47 | 2026-11-03 17:12:10 | `revisor-geral` | 3 | APROVADO | ac9f1a9ed79e2399c |
| 2026-11-03 17:11:58 | 2026-11-03 17:12:18 | `privacy-guardian` | 3 | APROVADO | afb1a4a69a18beb20 |
| 2026-11-03 17:12:08 | 2026-11-03 17:12:26 | `conformidade-reviewer` | 3 | APROVADO | a3277704c458bb7b1 |
| 2026-11-03 17:12:19 | 2026-11-03 17:12:32 | `infra-guardian` | 3 | APROVADO | a55e2fd262061443b |
