# Tarefa 9.0 — A fase `reserva` da carga prova a queda do principal

**Funcionalidade:** reserva-e-avaliacao · **Depende de:** 7.0
**Subagentes obrigatórios:** `privacy-guardian`, `infra-guardian`, `llm-integrator`
**Porte:** grande

## Objetivo

O cenário de carga ganha a fase `reserva`: no meio da aula, o principal falso cai (5xx, depois prazo) ou fica sem vaga, e a
reserva falsa atende sem deixar aluno sem resposta. A fase roda de verdade, com o controle negativo, e o resultado fica em
`docs/runbook.md`. A fase `sala` segue sem reserva, comparável à X6.

## Contexto necessário

- `techspec.md` §5 ("A identidade": `IA_FALHA_FALSA`, a reserva falsa), §7c ("Carga")
- `prd.md` RF3, §9 (as indisponíveis com o principal fora)
- `cenarios.md` §5 (Carga) inteira
- `revisao-spec.md`, rodada 8, "O que vai para as tarefas": a fase com `IA_FALHA_FALSA=principal:429` no meio da aula
- `.claude/rules/80-infra-e-carga.md` (itens 4 e 11); `docs/runbook.md`, "Rodar o cenário de carga" e "Quando a carga vale como
  registro"; `docs/infra.md` 5.4
- Código: `infra/scripts/carga.ts` (`FaseDoK6`, `SCRIPT_DO_K6`, o veredito da `sala`), `infra/k6/justica-entre-escolas.js`
  (`FASE=sala`), `infra/compose.carga.yml`, `infra/carga.env` (a 1.0 já pôs a reserva falsa)

## Subtarefas

- [ ] 9.1 — `reserva` em `FaseDoK6` e no k6, com três janelas: `IA_FALHA_FALSA=principal:5xx`, `principal:prazo` e
  `principal:429`, mais o balde do principal no limite no pico; o compose passa as variáveis da reserva aos dois `worker-ia`
- [ ] 9.2 — O veredito: 5xx e 429 com zero indisponível e o p95 do turno do Tutor até 1 s acima do da `sala`; prazo com
  indisponível só `IA_TEMPO_ESGOTADO`, contado no relatório; `ia.degradacao{degrau="provedor_de_reserva"}` subindo; o controle
  negativo (`IA_RESERVA_PROVEDOR_ID=falso-sem-aprovacao`) reprova pelo indisponível, não pela subida
- [ ] 9.3 — Rodar a fase e o controle negativo, e registrar em `docs/runbook.md` com a condição da máquina
- [ ] 9.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `infra/scripts/carga.ts`, `infra/test/carga.test.ts` | alterado |
| `infra/k6/justica-entre-escolas.js`, `infra/compose.carga.yml`, `infra/carga.env` | alterado |
| `docs/runbook.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| queda por 5xx: zero indisponível, p95 do Tutor até 1 s acima da `sala`, o degrau da reserva subindo | carga | RF3 | o p95 da `sala` da mesma corrida | |
| queda por prazo: indisponível só com o prazo esgotado, sempre `IA_TEMPO_ESGOTADO`, com o número no relatório | carga | §5 | o código de cada indisponível | |
| 429 no meio da aula (recomendação da revisão da spec, rodada 8): o `limite` vai ao menor e à reserva, sem indisponível | carga | regra 80, caso de borda | o código de cada indisponível no relatório | |
| balde cheio no pico: o transbordo vai à reserva, sem indisponível | carga | §5 (1) | o balde que recusou | |
| controle negativo (`falso-sem-aprovacao`): o worker sobe, a reserva não é elegível, indisponível acima de zero na janela da queda | carga | o critério | reprova pelo indisponível, não pela subida | |
| o veredito: indisponível acima de zero na janela de 5xx reprova com o nome da fase; no 0 passa | U | o script | os dois lados | |
| o veredito: p95 do Tutor 1 s acima da `sala` passa, acima reprova | U | a fronteira | o limite exato | |
| a fase `sala` não liga a reserva | U | comparável à X6 | as variáveis da reserva ausentes nela | |
| o degrau da reserva que não subiu reprova a fase | U | a reserva atendeu | o contador lido do Prometheus | |

As linhas de carga levam na coluna "Caso" a corrida de verdade: o comando, a data, os números do critério e a condição da
máquina (`docs/runbook.md`, "Quando a carga vale como registro").

## Como testar

- Veredito: `infra/test/carga.test.ts` › "qualquer outra falha, e todo "indisponível", falham a fase, mesmo com o k6 limpo" e › "a espera p95
  de cada escola é julgada contra 2 s no Tutor e 10 s na ferramenta, e o limite exato reprova"
- O falso: › "o ambiente de carga é o do adaptador falso, e o script recusa qualquer outro" e › "a latência por perfil e os tokens do falso
  são os da sala, cabem no prazo de cada perfil, e as outras fases ficam como estavam"
- O balde: › "o balde que não recusou nenhuma reserva reprova (o teto não mordeu)…"
- O roteiro: `docs/runbook.md`, "Rodar o cenário de carga"
- `npx vitest run --project infra infra/test/carga.test.ts`
- Armadilha: a carga só se prova rodando; peça a vez ao Orquestrador (o compose é um só na máquina) e rode com a máquina calma

## Fora do escopo desta tarefa

O contratado real de tokens por minuto (14.0).

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
