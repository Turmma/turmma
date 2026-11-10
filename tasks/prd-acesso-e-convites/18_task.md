# Tarefa 18.0 — A coordenação corrige o e-mail do professor que não entrou (API)

**Funcionalidade:** acesso-e-convites · **Depende de:** 3.0, 11.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `test-engineer`
**Porte:** grande

## Objetivo

`POST /v1/professores/:usuarioId/email` liga o professor `pendente` ou `vencido` que nunca entrou à conta do e-mail certo, com o mesmo id,
vínculos e aulas, e refaz o convite (maior 1 da validação).

## Contexto necessário

- `techspec.md` §5 "Corrigir o e-mail" (a ordem dos seis passos é a regra) e "Arquivo do titular"; §3 (`auditoria`); §11
- `prd.md` §7 "E-mail que volta"; RF16, RF17. `cenarios.md`, "Corrigir o e-mail" ([I] e [P]), "Corridas", "Auditoria (RF17)"
- Regras 10 (itens 3, 5, 6), 20 (itens 4, 9, 10), 80 (itens 7, 9)
- Molde: `refazerConviteDeProfessor` e `professorSobATrava` (`convite-de-professor.service.ts`); `convidarProfessor` e `refazerSobATrava` (`convite.service.ts`); a cerca do `contaDoProfessor` (`packages/core/src/estrutura/cadastro-de-professor.ts`); onde entra ação nova (comentário de `acoes-por-alvo.ts`)

## Subtarefas

- [ ] 18.1 — `corrigirEmailDoProfessorRequestSchema` (`{ email }`, o `emailConvidadoSchema`, estrito), a matriz `CORRIGIR_EMAIL_DO_PROFESSOR_POR_ESTADO` e a célula `professor.corrigir_email` (`unidade` na coordenação, `nunca` no resto)
- [ ] 18.2 — `trocarContaDoProfessor` no `ConviteRepository` (as quatro condições do §5, passo 4), a consulta do convite usado, e o caso de uso na ordem do §5; o 23505 vira `CONFLITO`
- [ ] 18.3 — A rota, `no-store`, `IdPipe`
- [ ] 18.4 — `usuario.email_corrigido` (entidade `usuario`, sem `antes`, `depois` nem finalidade) em `acoes.ts`; em `ACOES_DO_USUARIO_POR_ALVO` com o papel fixo "coordenação"; `0048_auditoria_por_alvo_email.sql` (índice novo com as sete, `drop` do antigo); `auditoria-por-alvo.int.test.ts` lendo a migration nova
- [ ] 18.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/shared/src/professores/professores.ts`, `packages/shared/src/permissao/matriz.ts`, `matriz.test.ts`, `packages/shared/src/index.ts` | alterado |
| `apps/api/src/sessao/convite/convite-de-professor.service.ts`, `convite.repository.ts`; `apps/api/src/professores/professores.controller.ts`, `professores.service.ts` | alterado |
| `packages/core/src/auditoria/acoes.ts`, `acoes-por-alvo.ts`; `packages/core/src/db/schema/auditoria.ts`, `auditoria-por-alvo.int.test.ts`; `packages/core/src/titular/leitura-do-titular.ts`, `leitura-do-titular.test.ts` | alterado |
| `packages/core/drizzle/0048_auditoria_por_alvo_email.sql`, `packages/core/drizzle/meta/`; `apps/api/test/professores-corrigir-email.int.test.ts` | novo |
| `apps/api/test/arquivo-do-titular.int.test.ts` | alterado |

## Testes que provam a regra

Detalhe de cada linha: `cenarios.md`, "Corrigir o e-mail".

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| caminho feliz | integração | mesmo id; vínculo e aula da grade ficam; conta nova | |
| token | integração | antigo recusado; novo aceito | |
| envio antigo | integração | `na_fila` e `enviando` terminam `cancelado` | |
| "Enviar" depois | integração | destino decifrado é o e-mail novo | |
| conta antiga | integração | intacta; sem usuário, limpa de madrugada; com usuário na B, não | |
| `vencido` | integração | corrige; 72 h do relógio falso | |
| estados fora | integração | quatro estados, `CONFLITO`, nada gravado | |
| quem já entrou | integração | convite usado antes: `CONFLITO` | |
| e-mail de outro professor | integração | três estados: `CONFLITO`, conta desfeita | |
| mesmo e-mail | integração | outra caixa: `CONFLITO` | |
| E11 | integração | conta só na B: resposta igual | |
| permissão | integração | professor e aluno recusados | |
| isolamento | integração | ids da B, de aluno, de coordenador, inexistente: `NAO_ENCONTRADO`, nada criado | |
| entrada | integração | campo a mais, e-mail inválido | |
| auditoria | integração | `usuario.email_corrigido` e `convite.refeito`, sem e-mail nem conta | |
| arquivo do professor | integração | papel "coordenação", sem autor | |
| índice | integração | plano usa o índice novo, com sete | |
| matriz | unidade | só a coordenação | |
| correção × aceite | integração | `emOrdemNaTrava`, duas direções | |
| duas correções | integração | um convite aberto, nunca 500 | |
| correção × "Enviar" | integração | nunca dois `na_fila` | |
| log novo | integração | sem e-mail | |

## Como testar

- Molde: `apps/api/test/professores.int.test.ts` › "E8, vencido e aceito…"; corridas › "cadastrar × refazer do mesmo professor…", com `emOrdemNaTrava` (`apps/api/test/escola-lock.ts`)
- Cifra e envio cancelado: `destinoDoEnvio`, `tokenDoEnvio` e os casos do "Copiar link" de `apps/api/test/convites-enviar.int.test.ts`
- Grade: `apps/api/test/grade.int.test.ts` › "reimportar mantém o id da aula…". Arquivo: bloco "D85" de `arquivo-do-titular.int.test.ts` (o `ATOS()` é do aluno)
- Isolado: `npx vitest run --project integracao apps/api/test/professores-corrigir-email.int.test.ts`
- Armadilhas: decifre e confira o destino (3.0, `test-engineer` 1ª); não edite a 0046 e recrie o banco (`EDUCA_BANCO_NOVO=1`); o 23505 aborta a transação

## Autoconferência

As 12 perguntas do `task-template.md`, no plano; pesam a 1 (cada termo do `update`), a 3 (o convite usado antes) e a 4.

## Fora do escopo desta tarefa

A tela (19.0); trocar o e-mail de quem já entrou; mudar `conta.email`.

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
