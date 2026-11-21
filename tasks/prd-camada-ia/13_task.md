# Tarefa 13.0 — Principal e reserva saem da avaliação executada, com preço e aprovação no código

**Funcionalidade:** camada-ia · **Depende de:** 11.0, 12.0, e as chaves de teste dos finalistas (Joaquim)
**Subagentes obrigatórios:** `privacy-guardian`, `conformidade-reviewer`, `llm-integrator`, `pedagogia-reviewer`
**Porte:** grande

## Objetivo

A avaliação roda uma vez por finalista, com o crédito de teste. O principal e a reserva escolhidos entram na D37 revista.
Os preços reais vão para `PRECO_DOS_MODELOS`, cada aprovação vai para `MODELOS_APROVADOS` com o sha256 do seu relatório,
e as AIAs dizem qual modelo atende cada função.

## Contexto necessário

- `techspec.md` §1, §5 ("A aprovação"), §7b, §8, §11, §13
- `prd.md` RF15, RF16, §5 (Avaliação), §6 (a última regra), §10 (as duas perguntas do Joaquim)
- `cenarios.md` §1 RF4 (a guarda de `MODELOS_APROVADOS`)
- `docs/avaliacao-de-modelos.md` §4 e §5; `docs/infra.md` 5.4; `docs/aia/README.md`; `docs/conformidade-mec.md` §7
- Skill `registrar-decisao`, para a D37 revista

## Subtarefas

- [ ] 13.1 — Com as chaves do Joaquim, fora do repositório: rodar `npm run avaliar-modelos` por finalista e gravar em
  `docs/avaliacao/<finalista>/<data>/`
- [ ] 13.2 — O julgamento dos subagentes e a confirmação do Joaquim (reprovadas, duvidosas e 10% das aprovadas), no relatório
- [ ] 13.3 — `PRECO_DOS_MODELOS` com os preços reais e a `fonte`; `MODELOS_APROVADOS` com uma entrada por relatório aprovado,
  com tarefa, provedor e modelo
- [ ] 13.4 — A D37 revista (principal, reserva, a data, o relatório), pela skill `registrar-decisao`; o contratado de tokens
  por minuto em `docs/infra.md` 5.4 e em `infra/carga.env`
- [ ] 13.5 — As AIAs (`docs/aia/tutor.md`, `adaptacao.md`, `correcao-de-objetiva.md`, `diagnostico-por-habilidade.md`,
  `sinais-e-alertas.md`) com principal, reserva, modelo menor e a suspensão do agente na reserva
- [ ] 13.6 — Sem finalista no Brasil que passe no Tutor: parar e levar ao Joaquim (PRD §10), sem aprovar
- [ ] 13.7 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `docs/avaliacao/<finalista>/<data>/saidas.jsonl`, `docs/avaliacao/<finalista>/<data>/julgamento.jsonl`, `docs/avaliacao/<finalista>/<data>/relatorio.md` | novo |
| `packages/core/src/ia/consumo.ts`, `packages/core/src/ia/modelos-aprovados.ts`, `packages/core/src/ia/modelos-aprovados.test.ts` | alterado |
| `docs/decisoes.md`, `CLAUDE.md`, `docs/infra.md`, `infra/carga.env`, `docs/avaliacao-de-modelos.md` | alterado |
| `docs/aia/tutor.md`, `docs/aia/adaptacao.md`, `docs/aia/correcao-de-objetiva.md`, `docs/aia/diagnostico-por-habilidade.md`, `docs/aia/sinais-e-alertas.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| cada entrada real de `MODELOS_APROVADOS` tem relatório que existe e sha256 que bate | U | a guarda da 9.0, com os relatórios reais | |
| a função de alto risco abaixo da taxa mínima no modelo escolhido não tem entrada | U | PRD §6 | |
| o preço de cada modelo aprovado existe, com `fonte` | U | RF6, RF16 | |
| a subida em `staging` com a configuração escolhida passa | U | os preços e as aprovações juntos | |
| nenhuma chave no repositório (`gitleaks`) | U | RF14 | |

## Como testar

- A guarda: `packages/core/src/ia/modelos-aprovados.test.ts` (9.0), sem mudar o teste, só as entradas
- Subida: `packages/core/src/config/llm-config.test.ts` › "sem nenhuma variável de IA, sobe com o adaptador falso…" (a forma de montar o ambiente)
- `gitleaks`: `tools/guardas/gitleaks.int.test.ts`
- `npx vitest run --project unidade packages/core/src/ia/modelos-aprovados.test.ts`
- Armadilha: a tarefa não fecha sem as chaves. Sem elas, o Implementador para com `BLOQUEIO` e diz o que falta

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
