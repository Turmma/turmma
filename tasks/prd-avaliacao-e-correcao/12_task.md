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
- `.claude/rules/50`, `70` item 4b; `docs/interface.md` §2
- `apps/web/src/areas/aluno/fila-de-respostas.ts` e `routes.tsx`; `apps/web/src/paths.ts` (`ALUNO_ROUTES`)

## Subtarefas

- [ ] 12.1 — Atividades: "Abre em…", "Fechou"; "Antes de começar" lendo `prova` sem tentativa (duração sem "adicional")
  e "Começar"
- [ ] 12.2 — `/aluno/prova/:id` fora da casca: relógio com o desvio, "Salvando…", "Sair da prova" de um clique; o fim
- [ ] 12.3 — A fila de respostas no app (§9)
- [ ] 12.4 — A fila de saídas (§5.8)
- [ ] 12.5 — Acessibilidade da §4; os textos de erro e o do "Enviar" com 503
- [ ] 12.6 — Roteiro da demonstração e o spec dele; `docs/interface.md` §2
- [ ] 12.7 — A prova embaralhada (aviso da 4.0, RF8): com "embaralhar" ligado a prova chega fora da ordem original, e a tela
  - acha a questão por `numero`, não pela posição em `prova.questoes`;
  - manda como `alternativa` do `PUT` o `questao.ordemDasAlternativas[posicao]` (o índice original), nunca a posição da tela;
  - lê pelo índice original o mapa das questões e o diagnóstico depois do envio (`Atividade.tsx`: `prova.questoes.find(item => item.numero === …)?.alternativas`, hoje indexado
    pela posição): o texto de "sua resposta" e o de "a certa" são os do índice original, e o diagnóstico confere com a prova embaralhada;
  - troca o comentário de `Atividade.tsx` ("O índice é a identidade da alternativa no contrato: a ordem delas não muda"), que a 4.0 tornou falso;
  - só usa `ordemDasAlternativas` para mandar o índice original: a ordem de um aluno não aparece a outro
- [ ] 12.8 — Testes e `e2e/aluno-prova.spec.ts`

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/paths.ts` | alterado |
| `apps/web/src/areas/aluno/routes.tsx` | alterado |
| `apps/web/src/areas/aluno/Atividades.tsx` | alterado |
| `apps/web/src/areas/aluno/Atividade.tsx` | alterado (a questão por `numero`, o `ordemDasAlternativas[posicao]` no `PUT`, o mapa e o diagnóstico pelo índice original; o comentário do `label`) |
| `apps/web/src/areas/aluno/Atividade.test.tsx` | alterado (a prova embaralhada) |
| `apps/web/src/api/atividades-do-aluno.ts` | alterado (a web tolera o campo a mais da `prova`; ver a 4.0, recomendação do `infra-guardian`) |
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
| Relógio do cliente 10 min adiantado | unidade web | o tempo do servidor | `Date.now()` sem desvio fica vermelho | |
| Sem rede; 503 e depois 200 | unidade web | gravam uma vez; a saída volta com a mesma chave; `tempo` mantém o último limite | descartar na queda ou no 5xx | |
| "Enviar" com 503 | unidade web | o item fica; o texto da §4 | | |
| `TEMPO_ESGOTADO`, extensão, `tempo` com o limite novo | unidade web | a fila reenvia e grava | parar no primeiro | |
| "Sair" com 2 pendentes | unidade web | a fila segue; o fim mostra "2 respostas não chegaram"; Atividades, "2 respostas ainda não chegaram" até esvaziar | fila presa à rota | |
| Fila de saídas | unidade web | `visibilitychange`+`blur`: 1; separadas pela volta do foco: 2; A, queda, B, A em série; o 429 não para a de respostas | contar os dois; em paralelo; fila única | |
| Antes de começar | unidade web | os textos da §4; "60" sem "adicional"; "Abre em…", "Fechou" | o colega lê 40 | |
| Acessibilidade | unidade web | relógio fora de região viva; anúncios a 10, 5 e 1 min; o fim ("O tempo acabou…") `assertive` com o foco e a questão sai; "Salvando…" `polite`; o foco ao entrar e ao voltar | a 11 min, nenhum anúncio | |
| Estados e erros | unidade web | "Não foi possível abrir a prova. Tente de novo.", "Aguarde um instante." e os outros da §4; nenhum código | | |
| `aluno-prova.spec.ts` | e2e `chromebook` e `celular` | antes de começar; sem lateral nem Tutor; rede cai ("Sem conexão…"), três respostas, volta: gravadas uma vez, o mesmo relógio; "Sair" e voltar; axe | descartar a fila na queda | |
| Recomeço | e2e | a resposta atrasada da prova anterior não aparece; a fila da primeira pessoa não sai com a sessão da segunda | `page.route` segurando | |
| 360 px e 1366 × 768 | e2e | faixa de uma linha; `paginaNaoRola`; Começar e Sair da prova com 44 px | | |
| Roteiro | e2e | o passo do aluno na prova | | |
| A prova embaralhada: o `PUT` leva o índice original | unidade web | prova com sorteio conhecido, a alternativa certa marcada numa posição de tela diferente da original: o `PUT` leva `ordemDasAlternativas[posicao]`; a questão é achada por `numero`; o mapa e o diagnóstico mostram o texto do índice original em "sua resposta" e "a certa" | mandar a posição da tela (fica vermelho) | |
| Prova embaralhada, de ponta a ponta | e2e `aluno-prova.spec.ts` | uma aplicação com "embaralhar" ligado: o aluno marca pelo texto a alternativa certa, e a resposta gravada é o índice original (o gabarito); o diagnóstico depois do lote aprovado acerta | a tela mandar a posição, e o aluno "errar" a que acertou | |

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
