# Tarefa 15.0 — Ligar a conta da escola em "Eu" (API e tela)

**Funcionalidade:** acesso-e-convites · **Depende de:** 9.0 e 14.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `frontend-reviewer`, `test-engineer`
**Porte:** grande

## Objetivo

O aluno com sessão liga a conta da escola em "Eu" (`intencao=ligar`) e passa a entrar por ela; uma conta por aluno, e o "ligar" disputa com a provisória pela mesma trava.

## Contexto necessário

- `techspec.md` seções 4, 5 ("Senha provisória", a trava; "Conta da escola do aluno") e 9
- `prd.md` RF14, RF18; `cenarios.md` RF14, RF13 (gerar × ligar), "Telas" (Conta da escola em "Eu")
- `.claude/rules/50`
- `apps/api/src/sessao/external/external-login.service.ts`, `conta-externa.repository.ts`; `apps/web/src/areas/aluno/Eu.tsx`

## Subtarefas

- [ ] 15.1 — `intencao=ligar` com sessão de aluno, na trava da linha do usuário
- [ ] 15.2 — O botão e os estados em "Eu"
- [ ] 15.3 — `docs/interface.md`
- [ ] 15.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/src/sessao/external/external-login.service.ts` | alterado |
| `apps/api/src/sessao/external/conta-externa.repository.ts` | alterado |
| `apps/web/src/areas/aluno/Eu.tsx` | alterado |
| `apps/web/src/areas/aluno/ContaDaEscola.tsx` | novo |
| `docs/interface.md` | alterado |
| `apps/api/test/ligar-conta.int.test.ts` | novo |
| `e2e/conta-da-escola-no-eu.spec.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| aluno por matrícula liga em "Eu" | integração | passa a entrar pela conta | |
| aluno com conta ligada liga outra | integração | recusado | |
| `ligar` com sessão de professor | integração | recusado | |
| conta ligada a outro | integração | `CONFLITO` sem nome nem id | |
| escola sem ano em curso | integração | liga, como hoje | |
| `conta_externa.ligada` | integração | um registro | |
| [P] gerar × ligar, barreira entre a checagem e a gravação | paralelo | nunca conta ligada e provisória juntas | |
| [P] aprovar com a conta C × outro aluno liga C | paralelo | uma liga, a outra `CONFLITO`, nunca 500; perdendo a aprovação, nenhum usuário | |
| [P] ligar a mesma conta duas vezes | paralelo | uma | |
| tela: ligada | e2e | "Conta da escola ligada" | |
| tela: `CONFLITO` e rede | e2e | os textos de "Telas" | |
| carregando | e2e | botão ocupado | |
| recomeço: o colega no mesmo computador | e2e | nada do anterior | |
| recomeço: resposta atrasada | e2e | não troca o estado | |
| recomeço: erro | e2e | o aviso sai na nova tentativa | |
| 360 px | e2e | sem rolagem horizontal; 44 e 24 px | |
| 1366 × 768 | e2e | cabe sem a página rolar | |

## Como testar

- API: `apps/api/test/external-login.int.test.ts` › "caminho feliz (RF9): a professora de A entra a primeira vez e fica ligada…"; corrida com `WriteBlockTrigger`
- Tela: `e2e/entrar-na-escola.spec.ts` › "aluno com a conta ligada entra pelo botão, e nada do provedor (e-mail, nome ou foto) aparece na tela" (o `oidc-falso`, linha 53); `e2e/aluno-eu.spec.ts` › "o aluno seguinte no mesmo computador vê o Eu dele…" e "a página com duas tarefas corrigidas… cabe em 1366 × 768 sem rolar"
- Comando: `npx vitest run --project integracao apps/api/test/ligar-conta.int.test.ts`; `node tools/ci/e2e.ts --manter-ambiente e2e/conta-da-escola-no-eu.spec.ts`
- Telas: `aluno`, `/eu` › "Ligar a conta da escola"

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), no plano. Na 2: o [P] gerar × ligar só prova a trava se as duas chamadas lerem antes de gravar.

## Fora do escopo desta tarefa

A reivindicação (14.0, 16.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
