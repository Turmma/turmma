# Tarefa 11.0 — A ferramenta de avaliação roda as amostras, julga cada resposta crua e escreve o relatório

**Funcionalidade:** reserva-e-avaliacao · **Depende de:** 1.0, 10.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `llm-integrator`, `pedagogia-reviewer`
**Porte:** grande

## Objetivo

`tools/ia/avaliar-modelos.ts`, rodado à mão com a chave de um finalista, passa cada amostra de `avaliacao-1.json` pela tarefa
real, no gateway real, envolve o adaptador para julgar **cada resposta crua**, e grava em `docs/avaliacao/<finalista>/<data>/`
`saidas.jsonl`, `julgamento.jsonl`, `resultado.json` e `relatorio.md`. As medidas por linha são da 12.0; os lotes retidos, da 13.0.
Nenhum teste chama a ferramenta contra a rede.

## Contexto necessário

- `avaliacao.md` ("Regras" inteiras); `techspec.md` §8, §7b
- `prd.md` RF13, RF14, RF15 (o que o relatório traz)
- `cenarios.md` §1 "Avaliação": as linhas da tabela abaixo (sem os lotes retidos)
- `.claude/rules/30-camada-ia.md` (item 3)
- Código: `tools/ia/medir-risco-a-vida.ts` (o formato, o "não roda no portão"), `tools/ia/amostras.ts` (10.0), `createLLMGateway`,
  `OpenAICompatAdapter`, `packages/core/src/ia/task.ts` (`semModelo`, `ajustar`, `reservaQuandoInvalida`)

## Subtarefas

- [ ] 11.1 — A ferramenta: recusa sem `AVALIACAO_BASE_URL`, `AVALIACAO_MODELO`, `AVALIACAO_CHAVE_API`; um `OpenAICompatAdapter` só
  dela, os preços do finalista, `soberania: { conferida: true }`; o script `avaliar-modelos`; a guarda do ponto de entrada
  (não importa teste, fixture, `golden.ts`, `db/schema` nem repository; não lê `DATABASE_URL`)
- [ ] 11.2 — As execuções declaradas por linha e a pior de três; as três contagens; o `ajustar` que só reclassifica não muda a
  contagem; as eliminatórias (equidade, as duas da D55, a rubrica sem juízo)
- [ ] 11.3 — O julgamento por `pedagogia-reviewer` e `conformidade-reviewer` com os critérios da 10.0, cego; a lista para o
  Joaquim (reprovadas, duvidosas e 10% das aprovadas, semente no relatório); `resultado.json` e `relatorio.md` (sha256 de cada
  arquivo lido e do `resultado.json`, versão exata do modelo, latência, tokens, custo, tokens por minuto oferecidos, custo por
  professor e por aluno por mês, "aprovação mínima, não taxa estimada"); na D55, só id, forma e resultado
- [ ] 11.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `tools/ia/avaliar-modelos.ts`, `tools/ia/avaliar-modelos.test.ts` | novo |
| `tools/guardas/ponto-de-entrada-da-avaliacao.ts`, `tools/guardas/ponto-de-entrada-da-avaliacao.test.ts`, `tools/guardas/__fixtures__/ponto-de-entrada-da-avaliacao/` | novo |
| `package.json` | alterado |

## Testes que provam a regra

Gateway real e adaptador falso injetado, sem rede.

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| sem `AVALIACAO_*`: recusa sem chamar nada | U | RF14 | uma variável por vez | |
| o relatório traz o sha256 de cada arquivo lido; outro arquivo, outro hash | U | RF13 | dois arquivos | |
| a chave em nenhum arquivo gravado | U | RF14 | valor reconhecível | |
| ponto de entrada: import direto e indireto de fixture, de `db/schema`, de repository, e `DATABASE_URL`: quebram | U | regra 30.3 | uma fixture por cláusula | |
| ponto de entrada: sem a ferramenta, a guarda reprova; nenhum teste a executa contra a rede | U | a guarda não se cala | o caminho do alvo apagado na fixture | |
| linha de 100% com o falso que erra uma em três: reprova | U | pior de três | erro numa só execução | |
| a regra fixa conta em "a regra decidiu", fora da taxa | U | regra e modelo | `origem = 'regra_fixa'` | |
| nota duas vezes em `propor_ferramenta` (sai a recusa da `reservaQuandoInvalida`): "a conferência segurou", D55 reprova, eliminado; o mesmo com a nota só na 1ª | U | a resposta crua | a saída final passa | |
| Tutor com a resposta pronta dada uma vez: "a conferência segurou" | U | a resposta crua | a saída final passa: a repetição recusa | |
| `ajustar`: `risco_a_vida` em amostra disfarçada passa na D36; pedido direto reclassificado, com a recusa do modelo, passa | U | controles | o `ajustar` acionado na amostra, conferido no caso | |
| o que vai a quem julga não tem nome, `provedorId` nem modelo; as pastas trazem o código | U | cego | os três reconhecíveis, procurados em todo arquivo entregue | |
| o relatório traz as três contagens e o `modelo` da resposta | U | RF13 | as três contagens diferentes de zero | |
| D55 das amostras ou rubrica sem juízo abaixo: eliminado, nem principal nem reserva | U | eliminatórias | o resto aprovado | |
| na D55, `saidas.jsonl` e `relatorio.md` só com id, forma e resultado | U | RF14 | saída com texto reconhecível | |
| o sorteio dos 10% com a mesma semente é o mesmo | U | a lista do Joaquim | | |

## Como testar

- Formato e "não roda no portão": `tools/ia/medir-risco-a-vida.test.ts` › "o recall e a precisão ficam com a pior execução…" e › "a chamada que
  falha conta como "não barrou"…"; `medir-classificacao.test.ts` › "o relatório diz o hash, cada critério com o valor e o mínimo…"
- Guarda: `tools/guardas/executor-so-na-bancada.test.ts` (fixtures por forma; "a guarda reprova em vez de passar em branco")
- `npx vitest run --project unidade tools/ia/ tools/guardas/`
- Armadilha: não abra `docs/aia/ouro-retido/`

## Fora do escopo desta tarefa

As medidas por linha (12.0); os retidos, a classificação e a guarda do RF16 (13.0); rodar contra finalista (14.0).

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
