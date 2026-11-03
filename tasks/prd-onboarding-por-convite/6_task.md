# Tarefa 6.0 — A planilha de professores cadastra a equipe e desliga só o marcado

**Funcionalidade:** onboarding-por-convite · **Depende de:** 3.0, 4.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

A coordenação sobe a planilha de professores (nome e e-mail, até 300 linhas): o job acha ou cria a conta de cada um no
passo (1), cadastra o professor `pendente` pelo `convidar` da A1, e desliga pelo `desativar` só quem a coordenação marcou.
O professor cadastrado aparece na lista com o convite para copiar.

## Contexto necessário

- `techspec.md` §5 "Planilha" (professor pelo `usuario` da escola, nunca pela `conta`), "O job" passo (1) e (3),
  "Gravar" ("Professores"), §6 (a cerca do `contaParaConvite`), §4 (o "Copiar link" faz o `convite/refazer`)
- `prd.md` RF6, RF4 (marca), RF16
- `cenarios.md` RF6; "Job e estados" (as duas escolas, o expurgo entre o (1) e o (3)); Corridas
- Código: `packages/core/src/estrutura/cadastro-de-professor.ts` (da 1.0); o motor da 4.0; o `desativar` da 3.0;
  `apps/api/src/professores/` (lista e `convite/refazer`)

## Subtarefas

- [ ] 6.1 — Tipo professores: classificação (e-mail repetido, inválido, nome vazio, teto de 300; candidatos a desligar), sem distinguir conta em outra escola
- [ ] 6.2 — Passo (1): contas pelo `contaParaConvite`, uma transação curta cada, na ordem do e-mail; conta em `FOR SHARE` no (3), com o e-mail conferido; nulo: nova tentativa
- [ ] 6.3 — Gravar: `convidar` da A1 com o token descartado; desligar o marcado pelo `desativar`, travando todas as turmas dos vínculos dele (o conjunto do `travarContraOGerarDoProfessor`) antes dos pedidos
- [ ] 6.4 — Lista de Professores: o cadastrado pelo job aparece `pendente`; "Copiar link" pelo `convite/refazer`
- [ ] 6.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/importacao/tipos/professores.ts` | novo |
| `packages/core/src/importacao/motor.ts`, `index.ts` | alterado |
| `apps/api/src/professores/professores.service.ts`, `professores.repository.ts` | alterado |
| `apps/worker/test/gravar-planilha-professores.int.test.ts`, `apps/api/test/professores.int.test.ts` | novo; alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| Mesmo e-mail duas vezes: uma pessoa | integração | caminho feliz (RF6) | |
| Conta de outra escola cliente ganha o segundo vínculo no aceite pelo link copiado | integração | RF6 (a F2c reescreve este caso) | |
| A prévia não distingue e-mail com conta na B de e-mail novo | integração | isolamento | |
| O `resumo` e a `planilha.gravada` também não distinguem | integração | isolamento | |
| [P] Duas escolas importam o mesmo professor: as duas `concluida`, uma `conta` | [P] | | |
| [P] Duas escolas importam os mesmos professores em ordens opostas: as duas `concluida` | [P] | ordem do e-mail | |
| 301 linhas: erro de teto; 300 entram | integração | | |
| E-mail inválido ou nome vazio: erro na linha | integração | borda | |
| Ausente na reimportação, sem marca: segue ativo | integração | RF4 | |
| Ausente marcado: desligado pelo `desativar`, vínculos encerrados | integração | RF6 | |
| Desligado: o (3) trava todas as turmas dos vínculos dele, em qualquer estado, antes dos pedidos (espião) | integração | ordem global | |
| [P] Duas escolas desligam o mesmo professor: as duas `concluida`, nenhuma requisição no ciclo | [P] | | |
| Cadastrado pelo job aparece `pendente` na lista | integração | | |
| "Copiar link" do cadastrado passa pelo `convite/refazer` | integração | | |
| [P] Expurgo de acesso entre o (1) e o (3): a nova tentativa refaz o (1); nenhum convite para conta sem e-mail | [P] | | |
| Escola sem ano em curso: a planilha de professores funciona | integração | ano | |
| Marca de um professor da B: `ENTRADA_INVALIDA` | integração | isolamento | |
| Professor sobe a planilha: recusado | integração | permissão | |

## Como testar

- Duas escolas e a mesma conta: `apps/api/test/convite.int.test.ts › concorrência: a mesma conta nova convidada por A e por B, aceitando os dois ao mesmo tempo com senhas diferentes, …`
- Refazer: `apps/api/test/professores.int.test.ts › E8, vencido e aceito: refazer o vencido vale; …`
- Job: o molde de `apps/worker/test/gravar-planilha.int.test.ts` (da 4.0); barreira entre o (1) e o (3) com `WriteBlockTrigger` (`apps/api/test/write-block-trigger.ts`)
- Espião no SQL: o da 3.0 (`apps/api/test/ciclo-de-vida.int.test.ts`)
- Comando: `npx vitest run --project integracao apps/worker/test/gravar-planilha-professores.int.test.ts`

## Autoconferência

As 12 perguntas do modelo, no plano. Na 3, o professor desligado tem vínculo confirmado, pendente e encerrado.

## Fora do escopo desta tarefa

Convite por e-mail e "Enviar" (F2c); a tela de Professores (15.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
