# Tarefa 12.0 — A tela "Gerar senha provisória"

**Funcionalidade:** acesso-e-convites · **Depende de:** 9.0, 17.0
**Subagentes obrigatórios:** `frontend-reviewer`, `privacy-guardian`, `test-engineer`
**Porte:** pequeno

## Objetivo

No menu da linha do aluno aprovado, na aba Alunos da turma do professor e na seção nova "Alunos aprovados" da turma aberta da coordenação, a confirmação lê o alvo (17.0) e mostra nome, turma, matrícula e a consequência; a senha aparece em dois grupos, grande, com "Copiar" e a validade, e some ao fechar sem ficar em lugar nenhum do navegador.

## Contexto necessário

- `techspec.md` seções 5 ("O alvo da provisória") e 9; `cenarios.md` "Telas" (Gerar provisória) e "E2E (RF18)" (a opção A da divergência da 12.0)
- `prd.md` RF13, RF18
- `.claude/rules/50`; `.claude/rules/20` item 4
- `apps/web/src/areas/professor/turmas/AlunosDaTurma.tsx` e `apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.tsx`

## Subtarefas

- [ ] 12.1 — O item no menu da linha e o diálogo de confirmação, que lê o alvo ao abrir (fora do cache de consultas) e o descarta ao fechar; a seção "Alunos aprovados" da coordenação, lida no clique, no lugar da contagem
- [ ] 12.2 — A senha fora do cache de consultas, da URL, do log e do armazenamento; "fechar sem copiar" pergunta antes
- [ ] 12.3 — `docs/interface.md`
- [ ] 12.4 — O `docs/roteiro-da-demonstracao.md` (seção 2, passos 9 e 11) conferido contra `e2e/roteiro-da-demonstracao.spec.ts`
- [ ] 12.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/components/DialogoDaSenhaProvisoria.tsx` | novo |
| `apps/web/src/api/senha-provisoria.ts` | novo |
| `apps/web/src/areas/professor/turmas/AlunosDaTurma.tsx` | alterado |
| `apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.tsx` (a contagem de aprovados sai) e a seção "Alunos aprovados" | alterado |
| `docs/interface.md` | alterado |
| `e2e/senha-provisoria.spec.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| gerar e mostrar | e2e | dois grupos, lidos grupo a grupo, "Copiar" e a validade | |
| dois alunos de mesmo nome | e2e | a confirmação difere pela matrícula; cancelar não gera nada | |
| fechar sem copiar | e2e | pergunta antes | |
| a senha fora do navegador | e2e | nada em `localStorage`, `sessionStorage`, endereço nem cache; sai ao fechar | |
| `ENTRA_PELA_CONTA_DA_ESCOLA` | e2e | "Este aluno entra pela conta da escola…" já na confirmação, sem "Gerar" | |
| `CONFLITO` e 429 | e2e | os textos de "Telas" | |
| carregando | e2e | confirmação: "Carregando…" com "Gerar" ocupado (`page.route` segura o GET); geração: botão ocupado | |
| alvo que sumiu | e2e | 404 na leitura ou na geração: o aviso de "Telas", a confirmação fecha | |
| coordenação, aprovados | e2e | "Mostrar alunos aprovados" só lê no clique; a linha tem o menu; a contagem antiga não aparece | |
| recomeço: 2ª pessoa na mesma aba | e2e | nada da senha anterior | |
| recomeço: reabrir o diálogo | e2e | confirmação de novo, sem a senha velha | |
| recomeço: resposta atrasada (`page.route`) | e2e | não aparece em outro aluno | |
| recomeço: erro | e2e | o aviso sai na nova tentativa | |
| 360 px | e2e | sem rolagem horizontal; 44 e 24 px | |
| 1366 × 768 | e2e | `paginaNaoRola` | |

## Como testar

- Precedente: `e2e/professor-turma-alunos.spec.ts` › "a lista não fica na memória da aba: sai o nome ao deixar a aba…" (a senha fora do navegador) e "resposta atrasada: a lista da primeira turma…"
- Apoio: `criarAlunoComMatricula` (`e2e/support/seed.ts`), `entrarComoProfessora` (`e2e/support/casca.ts`), `paginaNaoRola` (`e2e/support/coordenacao.ts:97`)
- Comando: `node tools/ci/e2e.ts --manter-ambiente e2e/senha-provisoria.spec.ts`
- Telas: `professora`, `/turmas/:turmaId` › aba Alunos › menu da linha; `coordenacao`, `/estrutura/turmas/:turmaId` › "Mostrar alunos aprovados" › o mesmo menu
- Seção da coordenação: a leitura no clique dos pedidos de nome, na mesma tela (`ListaDaTurma.tsx`, "Atualizar"), e os specs que contam a contagem "Aprovados nesta turma" em `e2e/` mudam junto

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), no plano. Na 2: "Copiar" já aparece em `e2e/`? Os specs que contam botões na aba Alunos.

## Fora do escopo desta tarefa

A API (9.0 e 17.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
