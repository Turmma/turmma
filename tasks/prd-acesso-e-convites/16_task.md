# Tarefa 16.0 — A tela "Conta da escola na sala"

**Funcionalidade:** acesso-e-convites · **Depende de:** 14.0
**Subagentes obrigatórios:** `frontend-reviewer`, `privacy-guardian`, `test-engineer`
**Porte:** pequeno

## Objetivo

Na página da sala, o aluno escolhe "Entrar com a conta da escola", prova a conta e envia o pedido do nome sem criar senha; depois da aprovação, entra por ela.

## Contexto necessário

- `techspec.md` seção 9; `cenarios.md` "Telas" (Conta da escola na sala) e "E2E (RF18)"
- `prd.md` RF14, RF18
- `.claude/rules/50`
- `apps/web/src/pages/TurmaPublica.tsx`

## Subtarefas

- [ ] 16.1 — O botão e o retorno do provedor na sala
- [ ] 16.2 — Os estados
- [ ] 16.3 — `docs/interface.md`
- [ ] 16.4 — O `docs/roteiro-da-demonstracao.md` (seção 2, passo 10) conferido contra `e2e/roteiro-da-demonstracao.spec.ts`
- [ ] 16.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/pages/TurmaPublica.tsx` | alterado |
| `apps/web/src/api/sala.ts` | alterado |
| `docs/interface.md` | alterado |
| `e2e/conta-da-escola-na-sala.spec.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| reivindicar com o `oidc-falso` → aprovação → entra pela conta | e2e | RF14 de ponta a ponta | |
| enviado | e2e | "Pedido enviado. Espere o professor aprovar" | |
| cookie vencido (`ENTRADA_INVALIDA`), `REIVINDICACAO_RECUSADA`, rede | e2e | os textos de "Telas" | |
| domínio não liberado, pela sala | e2e | volta à entrada da escola com o texto de `CONTA_EXTERNA_NAO_LIGADA`, nenhum pedido gravado, a sala não é alcançada | |
| o caminho guardado | e2e | o token do link sobrevive à ida ao provedor e o pedido sai sem senha; lido e apagado na primeira renderização (o colega na mesma aba não o herda); vencido (relógio falso, 16 min) ou de outro slug: "Comece de novo pelo link ou pelo código da sala", sem chamada | |
| carregando | e2e | "Entrando…" | |
| nada do provedor na tela | e2e | sem e-mail, nome ou foto | |
| recomeço: o colega no mesmo computador | e2e | nada do anterior | |
| recomeço: voltar do provedor de novo | e2e | parâmetro fora da barra | |
| recomeço: erro | e2e | o aviso sai na nova tentativa | |
| 360 px | e2e | sem rolagem horizontal; 44 e 24 px | |

## Como testar

- Precedente: `e2e/entrar-na-escola.spec.ts` › "aluno sem ligação volta ao endereço da escola orientado a usar a matrícula, e o parâmetro da falha some da barra" (o formulário do `oidc-falso`, linha 53); `e2e/convidar-alunos.spec.ts` (a sala)
- Domínio não liberado: o mesmo caso de `entrar-na-escola.spec.ts` (linha 240), começando pela sala; a sala não trata esse texto (divergência da 16.0, `cenarios.md` "Telas")
- Caminho guardado: `cenarios.md`, "Conta da escola do aluno", o [E] do `sessionStorage`; techspec §9, último parágrafo. O `CONFLITO` não entra na sala
- Comando: `node tools/ci/e2e.ts --manter-ambiente e2e/conta-da-escola-na-sala.spec.ts`
- Telas: `aluno`, `/e/:slug/turma` (`apps/web/src/paths.ts:193`) › "Entrar com a conta da escola"

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), no plano. Na 2: "Entrando…" já aparece em `e2e/`?

## Fora do escopo desta tarefa

A API (14.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
