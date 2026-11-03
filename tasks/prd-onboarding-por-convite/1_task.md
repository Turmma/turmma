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

- [ ] 1.1 — Commit de caracterização: mover os repositories, o `encerrar`, o `travarPendente` e o `fechar`, sem mudar teste; a API importa do `@educa/core` por subcaminho
- [ ] 1.2 — `packages/core/src/estrutura/cadastro-de-professor.ts` com o cadastro; `contaParaConvite` no `ContaGlobalRepository`, `@Unscoped('a conta é global: acha ou cria pelo e-mail')`; o cadastro descarta o `nova`
- [ ] 1.3 — A cerca do `ContaGlobalRepository` passa a ser o **arquivo** `cadastro-de-professor.ts` nas duas guardas, com fixture que reprova o vizinho
- [ ] 1.4 — Busca pelos caminhos antigos em `apps/`, `packages/`, `tools/` e `docs/` (`grep -rn`), cada ocorrência trocada ou justificada aqui; `docs/arquitetura.md` e `docs/modelo-de-dados.md` (a exceção da conta global)
- [ ] 1.5 — Testes

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
| Suíte da A1 e do F1 verde, sem nenhum teste mudado | integração | a mudança de lugar não mudou comportamento (commit de caracterização) | |
| Tirar o `escolaId` do repository de turma movido deixa vermelho o `acesso-da-turma.int.test.ts` | integração | o isolamento que já existe alcança a cópia no core | |
| Tirar o `anoLetivoId` do repository de vínculo movido deixa vermelho um teste da A1 | integração | o filtro do ano continua valendo | |
| `contaParaConvite` acha a conta que existe | integração | a classe nova responde igual à antiga | |
| `contaParaConvite` cria a conta nova e o cadastro descarta o `nova` | integração | idem | |
| O `ContaGlobalRepository` tem quatro `@Unscoped`, e o total do repositório não muda | unidade | `repositories-com-escopo` conta pela classe nova | |
| Arquivo vizinho de `cadastro-de-professor.ts` que chama `contaParaConvite`: as duas guardas reprovam | unidade | a cerca é por arquivo, não por pasta | |
| Quem contorna é acusado: reexportação | unidade | guarda | |
| Quem contorna é acusado: `import()` e `require` | unidade | guarda | |
| Quem contorna é acusado: o caminho como texto | unidade | guarda | |
| A guarda reprova quando `cadastro-de-professor.ts` some ou muda de lugar | unidade | a cerca não se cala sem o alvo | |
| O `ignore` da configuração não esconde o arquivo real | unidade | guarda | |

## Como testar

- Guarda: copie `apps/api/test/architecture.test.ts › reprova quem usa a classe por uma ponte de dentro da zona, em apps, packages, tools e infra, e deixa passar a zona, o teste, a fixture e o comentário`, trocando a zona por arquivo; e `tools/guardas/camadas.test.ts › cerca-conta-global reprova só o que a fixture marca` (fixtures em `tools/guardas/__fixtures__/camadas/`, como `infra/conta-global-import.ts`)
- Caracterização: o 1.1 vai num commit só, com a suíte verde e nenhum teste alterado
- Comandos: `npx vitest run --project unidade apps/api/test/architecture.test.ts tools/guardas/camadas.test.ts`; `npx vitest run --project integracao apps/api/test/acesso-da-turma.int.test.ts apps/api/test/convite.int.test.ts`

## Autoconferência

As 12 perguntas do modelo, no plano. Na 6, uma fixture por forma de contornar; na 9, nada se copia: move.

## Fora do escopo desta tarefa

A `turma.chave` (2.0); o `fechar('encerrada')` (9.0); o `desativar` que encerra vínculos (3.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
