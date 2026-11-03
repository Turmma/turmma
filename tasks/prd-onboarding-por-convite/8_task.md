# Tarefa 8.0 — Reimportar a planilha de alunos atualiza sem duplicar, e a lista da turma segue a mesma regra

**Funcionalidade:** onboarding-por-convite · **Depende de:** 7.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

Reimportar pela matrícula classifica "já existe", "nome corrigido", "muda de turma" e "fora da planilha"; nome corrigido
atualiza (o do aprovado no `usuario.nome`, o do não aprovado na `lista_nome`), e mudar de turma ou sair só acontece com
marca (9.0 e 10.0). A lista por turma da A1 passa a usar o mesmo contrato, e grava com 202.

## Contexto necessário

- `techspec.md` §4 (`/v1/turmas/:id/lista/previa` e `/lista` com o contrato da importação), §5 "Planilha" (aprovado pela
  `credencial_matricula` e pelo `usuario`; não aprovado pela `lista_nome`), "O job" passo (3) (pedidos relidos; `where
  estado <> 'aprovado'`), "Gravar" ("nome corrigido")
- `prd.md` RF4, RF16, RF17; PRD §10, pergunta 2 (a lista da A1 segue o RF4)
- `cenarios.md` RF4; "A1 que muda de regra" (`lista.int.test.ts`); Corridas ("Nome corrigido contra aprovação")
- Código: o tipo alunos da 7.0; `apps/api/src/estrutura/lista/` (controller, service, `lista-reader.ts`);
  `packages/core/src/estrutura/decisao.repository.ts` (da 1.0)

## Subtarefas

- [ ] 8.1 — Classificação de reimportação: já existe, nome corrigido (aprovado e não aprovado), muda de turma e fora da planilha como candidatos à marca
- [ ] 8.2 — Gravar: nome corrigido com `usuario.nome_corrigido` ou `lista.nome_corrigido`, sem nome; pedidos pendentes das turmas relidos sob a trava
- [ ] 8.3 — A lista por turma da A1 com o contrato da importação (202), com o `turmaId` conferido na escola e no ano; auditoria `turma.alunos_lidos` na prévia que lê nome do banco
- [ ] 8.4 — Reescrever em `apps/api/test/lista.int.test.ts` os casos que mudam de regra (E4, E6, o teto, o 202), com a regra nova no nome
- [ ] 8.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/importacao/tipos/alunos.ts` | alterado |
| `apps/api/src/estrutura/lista/lista.controller.ts`, `lista.service.ts`, `lista-reader.ts` | alterado |
| `packages/shared/src/estrutura/lista.ts` | alterado |
| `apps/api/test/lista.int.test.ts`, `apps/worker/test/gravar-planilha-alunos.int.test.ts` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| A mesma planilha duas vezes: tudo "já existe", e o banco não muda | integração | caminho feliz (RF4) | |
| Nome corrigido do aprovado atualiza `usuario.nome` | integração | RF4 | |
| Nome corrigido do não aprovado atualiza a `lista_nome` | integração | RF4 | |
| Nenhum dos dois esbarra no `lista_nome_aprovado_sem_nome` | integração | check | |
| Auditoria `usuario.nome_corrigido` e `lista.nome_corrigido`, sem nome | integração | RF17 | |
| "Muda de turma" e "fora da planilha", sem marca, gravam sem efeito | integração | RF4 | |
| [P] Aprovação do mesmo nome entre o (2) e o (3): `desatualizada`, nunca `falhou` | [P] | | |
| [P] Aprovação parada depois de travar o pedido, com o job no (3), e o inverso: só o estado final; zero `40P01` | [P] | | |
| [P] Pedido criado e aprovado durante o (3): nunca o nome antigo com `concluida` | [P] | pedidos relidos | |
| Lista por turma com `turmaId` da B: igual a inexistente | integração | isolamento | |
| Lista por turma com `turmaId` de outro ano: `NAO_ENCONTRADO` | integração | ano | |
| `lista.int.test.ts` E4: matrícula em uso passa a "muda de turma" | integração | A1 que muda | |
| `lista.int.test.ts` E6: "já existe com outro nome" passa a "nome corrigido" | integração | A1 que muda | |
| `lista.int.test.ts`: o teto passa a 3.001 linhas e 512 KB; a gravação responde 202 | integração | A1 que muda | |
| Auditoria `turma.alunos_lidos` (`conferencia_de_cadastro`) | integração | RF17 | |

## Como testar

- Os casos a reescrever: `apps/api/test/lista.int.test.ts › a prévia aponta cada linha ruim com o código, …, com matrícula em uso é CONFLITO, …` (E4); `› a mesma lista duas vezes não muda a contagem; o que já está na lista da turma sai ja_existe, mesmo com outro nome; …` (E6); `› 201 linhas ou 64 KB + 1 byte na prévia e na gravação: …`
- Corrida com a decisão: `apps/api/test/decisao.int.test.ts` e o `WriteBlockTrigger` (`apps/api/test/write-block-trigger.ts`)
- Comando: `npx vitest run --project integracao apps/api/test/lista.int.test.ts apps/worker/test/gravar-planilha-alunos.int.test.ts`

## Autoconferência

As 12 perguntas do modelo, no plano. Na 3, o mesmo nome corrigido para um aprovado e para um não aprovado na mesma planilha.

## Fora do escopo desta tarefa

Transferência e desligamento com marca (9.0, 10.0); a tela da lista (13.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
