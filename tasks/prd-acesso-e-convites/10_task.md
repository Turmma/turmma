# Tarefa 10.0 — O aluno entra com a provisória e troca a senha (API)

**Funcionalidade:** acesso-e-convites · **Depende de:** 9.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `test-engineer`
**Porte:** grande

## Objetivo

O login de matrícula com a provisória devolve `{ etapa: 'trocar_senha', bilhete }`; com o bilhete, `/trocas` lista as 10 provisórias anteriores e `trocar-senha` grava a senha do aluno e abre a sessão, uma vez só; falha nenhuma revela se o aluno existe.

## Contexto necessário

- `techspec.md` seções 4, 5 ("Senha provisória", "Auditoria") e 7c; `prd.md` RF13, RF16, RF17; `cenarios.md` RF13, "Corridas", "Limites", "Carga"
- `.claude/rules/20` itens 6 e 9; `.claude/rules/80` itens 1, 6 e 7
- `matricula.service.ts`, `credencial/challenge.ts`, `login-lockout.ts`, `sessao/convite/convite-ticket.ts`

## Subtarefas

- [ ] 10.1 — O bilhete (`jose`, `typ` e `aud` próprios, 10 min, escola, aluno, `provisoriaExpiraEm`), só no `Authorization`
- [ ] 10.2 — A etapa `trocar_senha` no login de matrícula; o aluno sem `senha_hash` contra o hash fixo
- [ ] 10.3 — `trocar-senha` e `/trocas` em `naEscolaSemUsuario` com a escola do bilhete; o `update` condicionado; `.usada`; `no-store`
- [ ] 10.4 — O roteiro de carga com a provisória e a conta externa na rajada (`infra/scripts/carga-login.ts`)
- [ ] 10.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/src/credencial/bilhete-da-troca.ts` | novo |
| `apps/api/src/credencial/bilhete-da-troca.test.ts` | novo |
| `apps/api/src/sessao/login/matricula.service.ts` | alterado |
| `apps/api/src/sessao/login/matricula.controller.ts` | alterado |
| `apps/api/src/credencial/credencial-matricula.repository.ts` | alterado |
| `packages/shared/src/sessao/senha-provisoria.ts` | alterado |
| `packages/core/src/auditoria/acoes.ts` | alterado |
| `infra/scripts/carga-login.ts` | alterado |
| `apps/api/test/troca-da-provisoria.int.test.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| login com a provisória | integração | bilhete, não sessão; o bilhete não abre outra rota; a provisória vence em 24 h | |
| matrícula inexistente, aluno só com conta externa, senha errada | integração | mesma resposta; o sem `senha_hash` passa pelo hash fixo (espião, nunca cronômetro) | |
| [U] o bilhete | unidade | escola, aluno e `provisoriaExpiraEm`, sem hash nem senha; adulterado ou de outra chave, recusado | |
| [U] `typ` e `aud`, um de cada vez | unidade | o `typ` do bilhete com a `aud` do desafio, e o inverso: recusados | |
| [U] desafio de login e bilhete de convite | unidade | não valem como bilhete, e o bilhete não vale como eles nem como token de acesso | |
| bilhete emitido 5 min antes do vencimento, troca 1 min depois (relógio falso) | integração | recusada, senha intacta, nenhum `.usada` | |
| `/trocas` | integração | data, papel (do `depois`, mesmo com o autor eliminado) e se usada; com 12, as 10 mais recentes | |
| `/trocas` de outro aluno, bilhete substituído ou vencido, bilhete na query | integração | recusado | |
| isolamento: contexto da A com a credencial do aluno da B | integração | a troca atualiza zero linhas, `/trocas` lê zero | |
| matrícula igual em A e B | integração | a provisória da A não abre a da B | |
| `senha_provisoria.usada` | integração | autor o aluno, sem senha | |
| trocar-senha com falha; a troca | integração | conta no contador de falhas; a troca anula as três colunas, `no-store` | |
| escola sem ano em curso | integração | login, `/trocas` e troca funcionam | |
| [P] duas trocas com o mesmo bilhete | paralelo | uma sessão; cai sem a condição da `provisoriaExpiraEm` | |
| [C] job de professores com 300 linhas, rajada de login com provisória e conta externa, e redefinir | carga | zero 503 no login e no redefinir; passo (3) abaixo de 1 s | |

## Como testar

- Bilhete: `apps/api/src/sessao/convite/convite-ticket.test.ts:33` › "permissão: o desafio e o token de acesso não servem de bilhete, e o bilhete não serve de desafio nem de token de acesso"
- Login: `apps/api/test/sessao-matricula.int.test.ts` › "privacidade (regra 20, item 6): slug inexistente, slug fora do formato, matrícula inexistente…" e "isolamento (RF7, RF15): a matrícula 1234 existe em A e em B…"
- Relógio: o inline de `apps/api/test/arquivo-do-titular.int.test.ts:71`, ou `Clock` (`packages/core/src/clock.ts`)
- Carga: `infra/test/carga-login.test.ts`
- Comando: `npx vitest run --project integracao apps/api/test/troca-da-provisoria.int.test.ts`; `npx vitest run --project unidade apps/api/src/credencial/bilhete-da-troca.test.ts`

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), no plano. Na 4: troque a escola do contexto, não só o id; a recusa tem de vir do repository.

## Fora do escopo desta tarefa

A tela (13.0); o arquivo do titular (11.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
