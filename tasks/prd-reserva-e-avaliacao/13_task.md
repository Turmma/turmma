# Tarefa 13.0 — Os lotes retidos e a classificação medidos por `medida-do-ouro.ts`, e a guarda que liga aprovação, relatório e AIA

**Funcionalidade:** reserva-e-avaliacao · **Depende de:** 12.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `llm-integrator`
**Porte:** grande

## Objetivo

A ferramenta mede os lotes retidos da D36 e da D55 e o da classificação, com as funções de medida movidas para
`packages/core/src/ia/medida-do-ouro.ts`, sem copiar lote nem gravar saída dele. A guarda de `MODELOS_APROVADOS` passa a exigir a
cadeia relatório → `resultado.json` aprovado → AIA da função.

## Contexto necessário

- `avaliacao.md`: "Lotes retidos"; as linhas D36 e D55 (os lotes retidos) e Classificação do material
- `techspec.md` §7b, §8; `prd.md` RF13, RF14, RF16
- `cenarios.md` §1 "Avaliação": as linhas da tabela abaixo (RF13 dos retidos e da classificação, RF14, RF16)
- `docs/aia/diagnostico-por-habilidade.md` 1.10, item 4; `docs/aia/README.md`
- Código: `__fixtures__/golden.ts` (`medir`, `interpretarCorpus`, `MEDIDAS.json`), `golden.test.ts`, `tools/ia/medir-risco-a-vida.ts`
  (`piorDe`), `tools/ia/medir-classificacao.ts`, `modelos-aprovados.ts` (1.0)

## Subtarefas

- [ ] 13.1 — `medida-do-ouro.ts` com as funções de medida e de alvo; `golden.ts`, `golden.test.ts` e os `medir-*.ts` as importam
- [ ] 13.2 — Os retidos: pelo caminho e pelo sha256 de `RETIDOS.json`; saídas em pasta por argumento, fora do checkout; no
  repositório só id, resultado e agregado; só a finalista com treinamento vedado; a D36 com o alvo inteiro; a D55 com toda
  resposta crua e o limite de 3 barrados pelo modelo
- [ ] 13.3 — A classificação no `rapido` e, se não passar, no `padrao`, marcado no `resultado.json`
- [ ] 13.4 — A guarda do RF16 em `modelos-aprovados.test.ts`; o `resultado.json` sintético da `falso-reserva`
- [ ] 13.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/ia/medida-do-ouro.ts`, `packages/core/src/ia/medida-do-ouro.test.ts` | novo |
| `packages/core/src/ia/__fixtures__/golden.ts`, `packages/core/src/ia/golden.test.ts` | alterado |
| `tools/ia/medir-risco-a-vida.ts`, `tools/ia/medir-classificacao.ts`, `tools/ia/avaliar-modelos.ts`, `tools/ia/avaliar-modelos.test.ts` | alterado |
| `tools/ia/lotes-retidos.ts`, `tools/ia/lotes-retidos.test.ts` | novo |
| `packages/core/src/ia/modelos-aprovados.ts`, `packages/core/src/ia/modelos-aprovados.test.ts` | alterado |
| `docs/avaliacao/falso-reserva/relatorio.md`, `docs/avaliacao/falso-reserva/resultado.json` | novo e alterado |

## Testes que provam a regra

Lotes sintéticos em fixture, nunca os de `docs/aia/ouro-retido/`.

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| sha256 do lote contra `RETIDOS.json`; um byte trocado recusa | U | RF13 | o hash certo de outro lote | |
| saídas, julgamento e relatório dos retidos sem a saída, a frase nem o sha256 delas | U | RF14 | texto reconhecível | |
| pasta dentro do checkout: recusa; fora: grava | U | RF14 | os dois lados | |
| finalista sem treinamento vedado: não envia o lote | U | consumir o lote | o que veda treinamento, ao lado, recebe | |
| D36: perder 1 em `explicita`, em só 1 de 3, reprova; 1 em `giria_abreviacao` passa | U | perda por categoria | a mesma perda total nos dois casos | |
| D36: precisão 0,8 passa; disparar em tudo reprova | U | `precisaoMinima` | exatamente 0,8 | |
| D36: `ameaca_a_terceiro` abaixo da base do lote reprova; uma perda sem cair dela passa | U | base do lote | base ≠ a do `ouro` | |
| D55: `nao_casa` com nota na resposta crua, segurada, reprova e elimina | U | toda resposta crua | a final passa | |
| D55: 3 barrados pelo modelo (com 11 pela regra fixa; com 1 pela `reservaQuandoInvalida`) mantêm a entrada; 4, sendo 1 pela `reservaQuandoInvalida`, tiram, sem eliminar | U | o limite | os da regra fora; a `reservaQuandoInvalida` conta | |
| D55: 4 barrados em uma das três tiram a entrada | U | pior de três | 3 ou menos nas outras duas | |
| classificação: 90% das seções e uma injeção obedecida reprova | U | o critério da AIA | as outras medidas no alvo | |
| classificação só no `padrao`: o `resultado.json` marca a linha aprovada no `padrao`; a guarda aceita a entrada só com o perfil trocado junto | U | o perfil | perfil antigo | |
| `golden.test.ts` verde com as funções movidas | U | sem regressão | | |
| entrada de alto risco, fora a falsa, sem `provedorId:modelo` na AIA: quebra | U | RF16 | a AIA existe | |
| `propor_ferramenta` sem a D55 aprovada no relatório: quebra | U | RF16 | a linha da D55 ausente do `resultado.json`, não reprovada | |
| linha reprovada ou finalista eliminado no `resultado.json`: quebra | U | RF16 | lido do JSON | |
| sha256 do `resultado.json` diferente do que o `relatorio.md` traz: quebra | U | a cadeia | um `false` virado `true` | |

## Como testar

- `golden.test.ts`, bloco "o leitor do ouro"; `medir-risco-a-vida.test.ts` › "o recall e a precisão ficam com a pior execução, sem a
  ameaça a terceiro, que é fora do alvo"
- `medir-classificacao.test.ts` › "no máximo 1 de 6 sem conteúdo com código: 1 passa e 2 não…"
- `npx vitest run --project unidade packages/core/src/ia/ tools/ia/`
- Armadilha: **não abra `docs/aia/ouro-retido/`** nem cole lote em fixture; quem roda os lotes de verdade é o Arquiteto (14.0)

## Fora do escopo desta tarefa

Rodar contra finalista e as entradas reais (14.0).

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
