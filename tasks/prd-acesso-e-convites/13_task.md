# Tarefa 13.0 — A tela "Trocar a senha provisória"

**Funcionalidade:** acesso-e-convites · **Depende de:** 10.0
**Subagentes obrigatórios:** `frontend-reviewer`, `privacy-guardian`, `test-engineer`
**Porte:** pequeno

## Objetivo

Depois do login com a provisória, o aluno vê as provisórias geradas antes (quem gerou, quando, se usada) e define a senha dele, entrando em seguida; a lista que falha não bloqueia a troca.

## Contexto necessário

- `techspec.md` seção 9; `cenarios.md` "Telas" (Trocar a provisória) e RF13 ([E] da tela)
- `prd.md` RF13, RF18
- `.claude/rules/50`
- `apps/web/src/pages/EntrarNaEscola.tsx` (onde chega a etapa `trocar_senha`)

## Subtarefas

- [ ] 13.1 — A tela, com o bilhete só em memória
- [ ] 13.2 — A lista: esqueleto, "primeira vez", "Tentar de novo"
- [ ] 13.3 — `docs/interface.md`
- [ ] 13.4 — O `docs/roteiro-da-demonstracao.md` (seção 2, passo 12) conferido contra `e2e/roteiro-da-demonstracao.spec.ts`
- [ ] 13.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/pages/TrocarSenhaProvisoria.tsx` | novo |
| `apps/web/src/pages/EntrarNaEscola.tsx` | alterado |
| `apps/web/src/api/troca-da-provisoria.ts` | novo |
| `docs/interface.md` | alterado |
| `e2e/troca-da-provisoria.spec.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| provisória → troca → entra | e2e | a sessão do aluno | |
| primeira troca | e2e | "É a primeira vez…", sem tabela vazia | |
| lista falhou | e2e | aviso com "Tentar de novo", o campo segue | |
| bilhete vencido | e2e | "Peça a senha de novo ao professor" | |
| datas | e2e | "Gerada pela coordenação em 12/11/2026 às 14:05 · usada" | |
| carregando | e2e | esqueleto | |
| o bilhete | e2e | fora da URL e do armazenamento | |
| recomeço: o colega no mesmo computador | e2e | nada do anterior | |
| recomeço: resposta atrasada | e2e | não troca a lista | |
| recomeço: erro | e2e | o aviso sai na nova tentativa | |
| 360 px | e2e | sem rolagem horizontal; 44 e 24 px | |

## Como testar

- Precedente: `e2e/entrar-na-escola.spec.ts` › "caminho feliz só com teclado…" e "clique repetido em "Entrar" não manda dois logins…"; `e2e/aluno-eu.spec.ts` › "o aluno seguinte no mesmo computador vê o Eu dele…"
- Apoio: `criarAlunoComMatricula` (`e2e/support/seed.ts`); a provisória gerada pela API como na 10.0
- Comando: `node tools/ci/e2e.ts --manter-ambiente e2e/troca-da-provisoria.spec.ts`
- Telas: `aluno`, `/e/:slug` › login com a provisória › troca

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), no plano. Na 2: "Tentar de novo" já aparece em `e2e/`?

## Fora do escopo desta tarefa

A API (10.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
