# Tarefa 14.0 — Principal e reserva saem da avaliação executada, com preço e aprovação no código

> **Fora da F5b desde 23/11/2026 (Joaquim):** o modelo real fica por último. Este documento é o ponto de partida da F5c
> (`avaliacao-de-modelos`, `ROADMAP.md`), que o refaz contra o código de então; não é tarefa pendente desta spec.

**Funcionalidade:** reserva-e-avaliacao · **Depende de:** 8.0, 9.0, 13.0, e as chaves de teste dos finalistas (Joaquim)
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `llm-integrator`, `pedagogia-reviewer`
**Porte:** grande

## Objetivo

A avaliação roda uma vez por finalista, com o crédito de teste (R$ 150 a 250 por finalista, aceito pelo Joaquim em 22/11/2026). O
principal e a reserva escolhidos entram na D37 revista; os preços reais vão para `PRECO_DOS_MODELOS`, cada aprovação para
`MODELOS_APROVADOS` com o sha256 do seu relatório; as AIAs dizem qual modelo atende cada função.

## Contexto necessário

- `techspec.md` §1, §5 ("A aprovação"), §7b, §8, §11, §13
- `prd.md` RF15, RF16, §6 (a última regra), §10 (as perguntas do Joaquim)
- `avaliacao.md` ("Lotes retidos": quem roda; "Eliminatórias")
- `cenarios.md` §1: as duas linhas RF16 e a de RF4 sobre a guarda de `MODELOS_APROVADOS`
- `docs/avaliacao-de-modelos.md` §4, §5; `docs/infra.md` 5.4; `docs/aia/README.md`; `docs/conformidade-mec.md` §7
- Skill `registrar-decisao`, para a D37 revista
- Código (da 8.0): a varredura e o `ExecucaoProcessor` leem a tabela de preços como parâmetro (`precos`, `PRECO_DOS_MODELOS` por padrão), e o `CicloDoWorkerDeIa` (`apps/api/src/worker.module.ts`) não a passa: quando a 14.3 der ao gateway uma tabela por porta, a mesma tabela precisa chegar a eles, ou a linha estimada da interrompida grava custo zero onde o gateway grava custo

## Subtarefas

- [ ] 14.1 — Com as chaves do Joaquim, fora do repositório: `npm run avaliar-modelos` por finalista, gravando em
  `docs/avaliacao/<finalista>/<data>/`. **A parte dos lotes retidos é do Arquiteto** (RF14): rode a das amostras e peça ao
  Orquestrador que o Arquiteto rode a dos lotes, com a pasta das saídas fora do checkout
- [ ] 14.2 — O julgamento dos subagentes e a confirmação do Joaquim (reprovadas, duvidosas e 10% das aprovadas), registrada no
  relatório
- [ ] 14.3 — `PRECO_DOS_MODELOS` com os preços reais e a `fonte`; `MODELOS_APROVADOS` com uma entrada por tarefa aprovada no relatório
- [ ] 14.4 — A D37 revista (principal, reserva, a data, o relatório), pela skill `registrar-decisao`; o contratado de tokens por
  minuto em `docs/infra.md` 5.4 e em `infra/carga.env`; `docs/avaliacao-de-modelos.md` §4 e §5
- [ ] 14.5 — As AIAs (`tutor.md`, `adaptacao.md`, `correcao-de-objetiva.md`, `diagnostico-por-habilidade.md`, `sinais-e-alertas.md`)
  com principal, reserva, modelo menor e a suspensão do agente na reserva, como `provedorId:modelo`
- [ ] 14.6 — Sem finalista no Brasil que passe no Tutor, ou nenhum que chegue ao alvo do risco à vida: parar e levar ao Joaquim
  (PRD §10), sem aprovar
- [ ] 14.7 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `docs/avaliacao/<finalista>/<data>/saidas.jsonl`, `julgamento.jsonl`, `resultado.json`, `relatorio.md` | novo |
| `packages/core/src/ia/consumo.ts`, `packages/core/src/ia/modelos-aprovados.ts` | alterado |
| `docs/decisoes.md`, `CLAUDE.md`, `docs/infra.md`, `infra/carga.env`, `docs/avaliacao-de-modelos.md` | alterado |
| `docs/aia/tutor.md`, `docs/aia/adaptacao.md`, `docs/aia/correcao-de-objetiva.md`, `docs/aia/diagnostico-por-habilidade.md`, `docs/aia/sinais-e-alertas.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| cada entrada real de `MODELOS_APROVADOS` tem relatório, `resultado.json` aprovado e sha256 que batem | U | a guarda da 1.0 e da 13.0, com os relatórios reais | relatórios reais | |
| a função de alto risco abaixo do limiar no modelo escolhido não tem entrada | U | PRD §6 | a linha reprovada no `resultado.json` | |
| cada entrada aparece como `provedorId:modelo` na AIA da função | U | RF16 | — | |
| o preço de cada modelo aprovado existe, com `fonte` | U | RF6, RF16 | — | |
| a subida em `staging` com a configuração escolhida passa | U | preços e aprovações juntos | — | |
| nenhuma chave no repositório (`gitleaks`) | U | RF14 | — | |
| nenhuma saída de lote retido nem da D55 no repositório | U | RF14 | a guarda dos ids (10.0) verde | |

## Como testar

- A guarda: `packages/core/src/ia/modelos-aprovados.test.ts` (1.0 e 13.0), sem mudar o teste, só as entradas
- Subida: `packages/core/src/config/llm-config.test.ts` › "sem nenhuma variável de IA, sobe com o adaptador falso…" (a forma de montar o ambiente)
- Preço: `consumo.test.ts` › "a constante: toda chave é `provedor:modelo`, cada vigência tem data e fonte…"
- `gitleaks`: `tools/guardas/gitleaks.int.test.ts`
- `npx vitest run --project unidade packages/core/src/ia/modelos-aprovados.test.ts packages/core/src/ia/consumo.test.ts`
- Armadilha: a tarefa não fecha sem as chaves; sem elas, `BLOQUEIO` dizendo o que falta. A chave só por variável de ambiente, nunca
  em arquivo nem no terminal de outro agente

## Fora do escopo desta tarefa

A assinatura do contrato (PRD §3); `complexo` e `visao`.

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
| revisão da spec, rodada 8 | a aprovação do principal sem prova no código (§11) | fica para a validação |
