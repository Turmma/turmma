# Tarefa 9.0 — A coordenação transfere o aluno pela planilha, e o pedido pendente se encerra

**Funcionalidade:** onboarding-por-convite · **Depende de:** 8.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

O aluno marcado "muda de turma" tem o vínculo antigo encerrado pelo `encerrar` (que revoga o acesso da turma) e o novo
confirmado no mesmo instante; o trabalho feito fica na turma antiga; o pedido pendente é encerrado pelo
`fechar('encerrada')`, que o `virarSala` passa a usar também.

## Contexto necessário

- `techspec.md` §5 "O job" passo (3) (turmas tocadas: destino, origem e turma de todo marcado; pedidos relidos;
  `fechar('encerrada')` antes de apagar a `lista_nome`), "Gravar" ("transferência")
- `prd.md` RF4 (marca), RF5, RF17; PRD §7 "Transferido com pedido pendente"
- `cenarios.md` RF5 (a transferência); Corridas ("Job contra a decisão do professor", "Reivindicação contra o passo (3)")
- Código: `packages/core/src/estrutura/vinculo.repository.ts` (`encerrar`), `decisao.repository.ts` (`fechar`,
  `travarPendente`); `apps/api/src/estrutura/ano-letivo/ano-letivo.repository.ts` (`virarSala`)

## Subtarefas

- [ ] 9.1 — Marca "muda de turma": `encerrar` (`realocacao`), vínculo confirmado na nova, `lista_nome` na nova turma
- [ ] 9.2 — `fechar('encerrada')`: grava só o estado e anula os segredos, sem `decidida*`; o `virarSala` passa por ele
- [ ] 9.3 — Escrita condicional: `lista_nome` com `where estado = :lido`; zero linhas, `encerrar` que devolve `false` ou `vinculo_ativo_unico` violado: `desatualizada`
- [ ] 9.4 — Auditoria `aluno.transferido` (origem e destino), `vinculo.criado` e `vinculo.encerrado` com a origem
- [ ] 9.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/importacao/tipos/alunos.ts` | alterado |
| `packages/core/src/estrutura/decisao.repository.ts`, `vinculo.repository.ts` | alterado |
| `apps/api/src/estrutura/ano-letivo/ano-letivo.repository.ts` | alterado |
| `apps/worker/test/transferencia-pela-planilha.int.test.ts`, `apps/api/test/virada-do-ano.int.test.ts` | novo; alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| O transferido alcança a turma nova e não a antiga | integração | caminho feliz (RF5) | |
| A resposta de atividade continua presa à turma antiga | integração | RF5 | |
| A transferência passa pelo `encerrar`: o acesso da turma antiga é revogado | integração | RF5 | |
| Transferido com pedido pendente: pedido `encerrada`, nome livre na turma nova | integração | borda do PRD | |
| O pedido encerrado fica sem `decididaEm`, `decididaPor` e `decididaComo` | integração | `fechar('encerrada')` | |
| `virarSala` encerra o pedido pendente sem gravar `decidida*` | integração | a mesma função | |
| Sem marca, "muda de turma" não muda nada | integração | RF4 | |
| [P] Transferência contra o professor aprovando a mesma linha, uma parte parada: nenhum aprovado fica na turma antiga | [P] | | |
| [P] Reivindicação parada no nome da turma antiga contra o (3): recusada ou `desatualizada`; nunca pendente com o nome em outra turma | [P] | `where estado = :lido` | |
| [P] Vínculo do aluno encerrado à mão entre o (2) e o (3): `desatualizada`, sem vínculo novo | [P] | releitura | |
| Marca de um aluno da B: `ENTRADA_INVALIDA` | integração | isolamento | |
| Auditoria `aluno.transferido` com a origem e o destino | integração | RF17 | |
| Auditoria `vinculo.criado` e `vinculo.encerrado` da transferência | integração | RF17 | |

## Como testar

- Reivindicação: `apps/api/test/salas-reivindicar.int.test.ts › pelo código e pelo link: enviado; o pedido pendente guarda o hash argon2id da senha, …`; decisão: `apps/api/test/decisao.int.test.ts › E18: as escritas da aprovação; …`
- Revogação: `apps/api/test/acesso-fim-do-vinculo.int.test.ts › encerrar o último vínculo do professor na turma revoga o acesso que ele gerou, …`
- `virarSala`: `apps/api/test/virada-do-ano.int.test.ts › caminho feliz: confirmado, pendente, contestado e alunos vão a encerrado por fim_do_ano; …`
- Barreira: `WriteBlockTrigger` (`apps/api/test/write-block-trigger.ts`)
- Comando: `npx vitest run --project integracao apps/worker/test/transferencia-pela-planilha.int.test.ts apps/api/test/virada-do-ano.int.test.ts`
- Armadilha: nos [P] com aprovação, só o estado final

## Autoconferência

As 12 perguntas do modelo, no plano. Na 3, o aluno com pedido pendente **e** outro aprovado, nas duas turmas.

## Fora do escopo desta tarefa

Desligamento e virada de ano (10.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
