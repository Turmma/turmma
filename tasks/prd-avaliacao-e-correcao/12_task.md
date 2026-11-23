# Tarefa 12.0 — Tela do aluno: "Antes de começar" e a prova em foco

**Funcionalidade:** avaliacao-e-correcao · **Depende de:** 3.0, 4.0, 8.0
**Subagentes obrigatórios:** `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `frontend-reviewer`
**Porte:** grande

## Objetivo

O aluno lê o aviso, faz a prova em tela de foco com o relógio do servidor, sem perder resposta na queda, e sai com um clique.

## Contexto necessário

- `techspec.md` §4 (`prova`, `tempo`), §5.8, §9
- `prd.md` RF5, RF6, RF7; §7
- `cenarios.md` §1 (as linhas da tela de RF5, RF6, RF7 e RF9), §4 (aluno), §4b
- `revisao-spec.md` rodada 4: o texto quando "Enviar" recebe 503
- `.claude/rules/50`, `70` item 4b; `docs/interface.md` §2
- `apps/web/src/areas/aluno/fila-de-respostas.ts` e `routes.tsx`; `apps/web/src/paths.ts` (`ALUNO_ROUTES`)

## Subtarefas

- [ ] 12.1 — Atividades: "Abre em…", "Fechou"; "Antes de começar" lendo `prova` sem tentativa (duração sem "adicional")
  e "Começar"
- [ ] 12.2 — `/aluno/prova/:id` fora da casca: relógio com o desvio, "Salvando…", "Sair da prova" de um clique; o fim
- [ ] 12.3 — A fila de respostas no app: rede, 503 e 5xx mantêm o item; relê `tempo` e reenvia depois do "Sair" e do fim
- [ ] 12.4 — A fila de saídas: `visibilitychange` e `blur` contam uma; chave v4; em série; o 429 não para a de respostas
- [ ] 12.5 — Acessibilidade da §4; os textos de erro e o do "Enviar" com 503
- [ ] 12.6 — Roteiro da demonstração e o spec dele; `docs/interface.md` §2
- [ ] 12.7 — Testes e `e2e/aluno-prova.spec.ts`

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/paths.ts` | alterado |
| `apps/web/src/areas/aluno/routes.tsx` | alterado |
| `apps/web/src/areas/aluno/Atividades.tsx` | alterado |
| `apps/web/src/areas/aluno/AntesDeComecar.tsx` | novo |
| `apps/web/src/areas/aluno/ProvaEmFoco.tsx` | novo |
| `apps/web/src/areas/aluno/ProvaEmFoco.test.tsx` | novo |
| `apps/web/src/areas/aluno/fila-de-respostas.ts` | alterado |
| `apps/web/src/areas/aluno/fila-de-saidas.ts` | novo |
| `apps/web/src/areas/aluno/fila-de-saidas.test.ts` | novo |
| `e2e/aluno-prova.spec.ts` | novo |
| `e2e/roteiro-da-demonstracao.spec.ts` | alterado |
| `docs/roteiro-da-demonstracao.md` | alterado |
| `docs/interface.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| Fim do tempo | unidade web | "O tempo acabou…" e a questão sai | | |
| Relógio do cliente 10 min adiantado | unidade web | o tempo do servidor | `Date.now()` sem desvio fica vermelho | |
| 3 respostas sem rede, a rede volta | unidade web | gravam uma vez | | |
| 503 e depois 200 | unidade web | gravam uma vez; a saída volta com a mesma chave; `tempo` mantém o último limite | descartar no 5xx | |
| `TEMPO_ESGOTADO`, extensão, `tempo` com o limite novo | unidade web | a fila reenvia e grava | | |
| "Sair" com 2 pendentes | unidade web | a fila segue; o fim mostra "2 respostas não chegaram" | fila presa à rota | |
| 429 das saídas | unidade web | a de respostas segue | uma fila só | |
| `visibilitychange` e `blur` seguidos | unidade web | 1 | | |
| A, queda, B, A | unidade web | em série | em paralelo | |
| Duração sem "adicional" | unidade web | o texto de Antes de começar | | |
| Acessibilidade | unidade web | relógio fora de região viva; anúncios a 10, 5 e 1 min; o fim `assertive` com o foco; o foco ao entrar e ao voltar | | |
| Estados e erros | unidade web | os textos da `cenarios.md` §4; nenhum código na tela | | |
| `aluno-prova.spec.ts` | e2e `chromebook` e `celular` | antes de começar; sem lateral nem Tutor; rede cai, três respostas, volta: gravadas uma vez, o mesmo relógio; "Sair" e voltar; axe | descartar a fila na queda | |
| Recomeço | e2e | a resposta atrasada da prova anterior não aparece | `page.route` segurando | |
| 360 px e 1366 × 768 | e2e | faixa de uma linha; `paginaNaoRola`; alvos de 44 px | | |
| Roteiro | e2e | o passo do aluno na prova | | |

## Como testar

- Fila: `apps/web/src/areas/aluno/espelho-da-fila.test.ts › cada mudança das pendentes vai para o espelho…`
- Tela: `e2e/aluno-atividade.spec.ts › a resposta que falha ao salvar continua marcada…`; relógio com `page.clock`
- `node tools/ci/e2e.ts --manter-ambiente e2e/aluno-prova.spec.ts`
- **Telas:** aluno · `/aluno/atividades` → a prova → "Antes de começar" → "Começar" → `/aluno/prova/:id`

## Autoconferência

As perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`).

## Fora do escopo desta tarefa

As telas do professor (10.0, 11.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
