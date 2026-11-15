# Tarefa 11.0 — A carga da manhã prova o Tutor dentro da meta com a IA no worker (47.0)

**Funcionalidade:** reengenharia-continuacao · **Depende de:** 10.0
**Subagentes obrigatórios:** `infra-guardian`, `llm-integrator`
**Porte:** grande

## Objetivo

`npm run carga` ganha a `FASE=sala` em `justica-entre-escolas.js`: 10 escolas, seis turmas por escola no Tutor e as
ferramentas da professora ao mesmo tempo, com o adaptador falso e um `kill -9` num `worker-ia`. A corrida de base e a da
árvore, na mesma sessão, mostram o p95 do turno piorando no máximo 1 s, a espera p95 do Tutor abaixo de 2 s e a da
ferramenta abaixo de 10 s, e nenhum aluno vendo "indisponível". É relatório, não portão.

## Contexto necessário

- `techspec.md` §7c (linha "Carga"; o piso do contrato), §12
- `prd.md` RF6; §9; §10 (as premissas)
- `tasks/prd-reengenharia/onda-3a.md` "Latência e carga (47.0)" (thresholds, latência por perfil, o contador do `kill -9`)
- `docs/infra.md` §3.2; `docs/runbook.md` "Quando a carga vale como registro"
- `.claude/rules/` 30 (item 3), 40, 80 (itens 10, 11)
- Código: `infra/scripts/carga.ts` (`argumentosDoK6`, l.193; `FASE`), `infra/k6/justica-entre-escolas.js` (l.281,
  `respostas_inesperadas`), `infra/carga.env`, `infra/test/carga.test.ts`

## Subtarefas

- [ ] 11.1 — `FASE=sala`: a carga da tabela de `onda-3a.md`, latência por perfil (`IA_LATENCIA_FALSA_MS` 6 s,
  `IA_LATENCIA_FALSA_MS_PADRAO` 50 s), o falso informando 3.000 + 250 tokens por turno; thresholds por escola
- [ ] 11.2 — O `kill -9` do `worker-ia-1` no meio da fase: os `EXECUCAO_INTERROMPIDA` saem de `respostas_inesperadas` para
  um contador com teto igual aos jobs ativos da réplica, lido antes; os outros falhos seguem em 0
- [ ] 11.3 — `infra/carga.env`: o `LLM_TOKENS_POR_MINUTO` na escala do falso, saído do piso do contrato (§7c), para o teto
  morder
- [ ] 11.4 — A corrida: `FASE=base` no build anterior e no da árvore, na mesma sessão; `FASE=sala` no da árvore. O relatório
  (seção "Divergências" e `docs/infra.md` §3.2): p95 do turno, espera p95 do Tutor e da ferramenta, número de
  "indisponível", espera por conexão do pool, RSS do `worker-ia` contra a memória da VPS (D82), e o custo de base por
  professor (recomendação do `llm-integrator`, rodada 6)
- [ ] 11.5 — `docs/infra.md`: o piso do contrato com as duas premissas (3.000 + 250 e 5.000 + 300) e o que a `FASE=sala`
  mediu de "1 ferramenta por minuto por escola"
- [ ] 11.6 — Testes do script

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `infra/k6/justica-entre-escolas.js`, `infra/scripts/carga.ts`, `infra/carga.env`, `infra/test/carga.test.ts`, `infra/compose.yml`, `docs/infra.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| a corrida | C | comando (`npm run carga`), data, os números do RF6 contra os limites, a condição da máquina ("Quando a carga vale como registro") | |
| o `kill -9` | C | nenhuma resposta perdida: os interrompidos dentro do teto, a próxima pergunta roda, o aluno vê "Tentar de novo" sem gastar a troca | |
| o teto morde | C | a `FASE=sala` registra reservas recusadas no balde, e mesmo assim nenhum "indisponível" | |
| RSS | C | o RSS do `worker-ia` no pico, contra a memória da VPS (D82) | |
| argumentos | U | `argumentosDoK6('sala')` leva a fase e as latências; a `base` segue igual | |
| o contador | U | os `EXECUCAO_INTERROMPIDA` acima do teto falham a fase; os outros falhos também | |
| nenhum provedor pago | U | `infra/carga.env` tem o adaptador falso, e o script recusa outro | |

## Como testar

- Script: `infra/test/carga.test.ts`; a forma da fase nova: `infra/test/carga-sala.test.ts` (a carga da sala ao vivo)
- A corrida: `npm run carga`; repita com a máquina calma se a regra do runbook não valer
- Armadilha (F2c, `criar-tasks`): teste do script prova o script; a linha [C] leva a corrida de verdade na coluna "Caso"
- Armadilha (F4, grupo F): pare o compose de teste antes; a carga sobe o próprio

## Autoconferência

As 12 perguntas do modelo, no plano. Na 1: cada threshold e o teto do contador são blocos. Na 4: a fase `sala` precisa
morder o teto; confira na corrida que o balde recusou.

## Fora do escopo desta tarefa

A avaliação de modelos e o teto real (D37).

## Divergências resolvidas nesta tarefa

## Mutações

## Recomendações sem aplicar
