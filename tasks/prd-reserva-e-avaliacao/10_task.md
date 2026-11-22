# Tarefa 10.0 — As amostras da avaliação e as guardas que valem antes do gasto

**Funcionalidade:** reserva-e-avaliacao · **Depende de:** nenhuma
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `pedagogia-reviewer`
**Porte:** grande

## Objetivo

Antes de gastar crédito: os eliminatórios contratuais conferidos na fonte (RF15), as amostras versionadas, uma linha por tarefa
de `TAREFAS_DE_IA`, os critérios de julgamento em arquivo, e os testes e guardas que recusam amostras que não mediriam o que
prometem. A ferramenta é da 11.0.

## Contexto necessário

- `avaliacao.md` inteiro; `techspec.md` §7b, §8, §12; `prd.md` RF13, RF14, RF15
- `cenarios.md` §1 "Avaliação": as linhas da tabela abaixo (a de RF14 só na guarda dos ids e na AIA com `CR-025`)
- `docs/avaliacao-de-modelos.md` §1, §3, §3.1; `docs/aia/ouro-retido/README.md` só até a tabela (**não abra os lotes**)
- Código: `packages/core/src/ia/task.ts` (`semModelo`), `TASK_CATALOG`, `TAREFAS_DE_IA` (`@educa/shared`), `TIPOS_DE_ADAPTACAO`
  (`packages/shared/src/assistente/conteudo.ts`), `tools/ia/medir-classificacao.ts` (o hash do lote)

## Subtarefas

- [ ] 10.1 — `domain-researcher`: a §3.1 na fonte (Maritaca, AWS Bedrock `sa-east-1`, Magalu Cloud, a seção 20(d) do Google); a §1
  de `docs/avaliacao-de-modelos.md` com fonte e data; os ⚠️ da Tech Spec §12 respondidos em "Divergências"; o relatório citado aqui
- [ ] 10.2 — `tools/ia/amostras/avaliacao-1.json` e os critérios de cada linha julgada (`tools/ia/criterios/`), escritos por subagente
  em contexto limpo e revisados pelo `pedagogia-reviewer`; texto de aluno sintético e marcado; os lotes retidos só por referência
  (caminho e sha256 do `RETIDOS.json`); cada linha declara a tarefa (ou "todas") e as execuções
- [ ] 10.3 — `tools/ia/amostras.ts`: o leitor (zod estrito) e o sha256 de cada arquivo; os testes de cobertura
- [ ] 10.4 — A guarda da D55 sobre as amostras; a guarda dos ids retidos (`RT-`, `RQ-`, `RJ-`, `CR-` com texto fora de
  `docs/aia/ouro-retido/`); `CR-025` com texto tirado de `docs/aia/diagnostico-por-habilidade.md`; §3 de
  `docs/avaliacao-de-modelos.md` apontando `avaliacao.md`, e a §3.1 sem "reserva fora do Brasil"
- [ ] 10.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `tools/ia/amostras/avaliacao-1.json`, `tools/ia/amostras/README.md`, `tools/ia/criterios/` | novo |
| `tools/ia/amostras.ts`, `tools/ia/amostras.test.ts` | novo |
| `tools/guardas/amostras-da-d55.ts`, `tools/guardas/amostras-da-d55.test.ts`, `tools/guardas/__fixtures__/amostras-da-d55/` | novo |
| `tools/guardas/ids-retidos-sem-texto.ts`, `tools/guardas/ids-retidos-sem-texto.test.ts`, `tools/guardas/__fixtures__/ids-retidos/` | novo |
| `docs/avaliacao-de-modelos.md`, `docs/aia/diagnostico-por-habilidade.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| cada linha de recusa, escopo, D36 (as com risco), pessoa e D55 tem ≥ 10 amostras que o `semModelo` da tarefa não decide; com 9, quebra | U | o mínimo antes do gasto | linha com amostras que a regra fixa decide; a D36 com 9 de risco e 10 sem | |
| as 20 de adaptação cobrem cada um de `TIPOS_DE_ADAPTACAO`; tirar um quebra | U | a cobertura | lido da constante | |
| a questão e a equidade cobrem do 6º ano ao 3º do EM; tirar uma série quebra | U | a cobertura | uma série por caso | |
| toda tarefa de `TAREFAS_DE_IA` tem linha; linha sem tarefa quebra | U | RF13 | lido da constante | |
| 3 execuções nas linhas de 100%, na parte de 100% das mistas, na equidade, na classificação e nos retidos da D36; uma delas com 1 quebra | U | as execuções | um caso por alvo, a classificação incluída | |
| D55: pedido de nota de discursiva com `esperado: recusa` passa; com outro esperado quebra | U | a guarda | o mesmo texto, o esperado trocado | |
| D55: arquivo sem amostra de recusa da D55 quebra | U | a guarda exige | — | |
| D55: texto de aluno marcado em linha cujo esperado não é recusa quebra | U | o detector e a linha declarada | outra linha | |
| D55, quem contorna: o pedido em outra forma que o detector conhece é acusado | U | sem escape | uma fixture por forma | |
| D55: sem o arquivo de amostras, a guarda reprova e não passa em branco | U | a guarda reprova quando o alvo some | — | |
| ids retidos: `CR-025` com texto num `.md` fora de `ouro-retido/` quebra; o id sozinho passa; o `relatorio.md` é lido | U | RF14 | texto ao lado do id | |
| ids retidos: o lote copiado em `tools/ia/amostras/` quebra | U | sem cópia | — | |
| ids retidos: a pasta `docs/aia/ouro-retido/` some, a guarda reprova | U | a guarda reprova quando o alvo some | — | |
| a árvore de hoje passa nas duas guardas | U | controle | — | |

## Como testar

- Guarda e fixtures: `tools/guardas/executor-so-na-bancada.test.ts` › bloco "quem contorna a bancada" (`it.each` de fixtures) e › "com tudo
  no lugar, nada sumiu; sem a bancada, ou com o token renomeado na fonte, a guarda reprova em vez de passar em branco"
- Lote e hash: `tools/ia/medir-classificacao.test.ts` › "um lote bem formado é lido…" e › "a mesma coisa escrita em outra ordem (linhas,
  listas e chaves) tem o mesmo hash"
- Leitor estrito: `packages/core/src/ia/golden.test.ts` › "toda chave a mais é recusada, em cada objeto do corpus e do MEDIDAS"
- `npx vitest run --project unidade tools/ia/ tools/guardas/`
- Armadilha: **não abra `docs/aia/ouro-retido/`** (o README de lá); a guarda varre por padrão de id, sem ler os lotes

## Fora do escopo desta tarefa

A ferramenta e as medidas (11.0 a 13.0); rodar a avaliação (14.0); `complexo` e `visao` (PRD §3).

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano antes de codar.

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

```mutacao
arquivo:
teste:
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisão da spec, rodada 8 | o rascunho da 12.0 (da F5) trazia a guarda antiga da D55 | esta tarefa segue `avaliacao.md` e o `cenarios.md` |
