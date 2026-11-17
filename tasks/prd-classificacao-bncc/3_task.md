# Tarefa 3.0 — A função `classificacao_do_material` existe e é suspensível, e a tarefa `classificar_secoes` tem prompt, saída e medidor

**Funcionalidade:** classificacao-bncc · **Depende de:** 2.0
**Subagentes obrigatórios:** `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `llm-integrator`, `pedagogia-reviewer`
**Porte:** grande

## Objetivo

A classificação é uma função declarada do Assistente de ensino, em "Como cada IA trabalha" e suspensível; a tarefa
`classificar_secoes` existe no catálogo, com prompt versionado, saída estrita e o `falso` determinístico; o banco aceita a
execução dela sem ano; e `tools/ia/medir-classificacao.ts` mede a taxa no lote que o Arquiteto vai escrever.

## Contexto necessário

- `techspec.md` §3 (`execucao_agente`), §5 "Classificação", §7, §7b inteira, §8, §11
- `prd.md` RF5, 8b
- `cenarios.md` "Classificação no worker" (sondas, prompt, check do ano), "Lote retido"
- `.claude/rules/`: 30, 40, 70 (itens 5 e 6a), 80
- Código: `packages/core/src/ia/tasks/resumo-do-analista.ts` (molde de `defineTask`), `packages/core/src/ia/task.ts`,
  `packages/core/src/ia/tasks/index.ts`, `packages/shared/src/time/execucao.ts`, `packages/shared/src/time/funcoes.ts`,
  `packages/core/drizzle/0058_fila_ferramenta.sql` (troca de check), `tools/ia/medir-risco-a-vida.ts`
- **Não abra `docs/aia/ouro-retido/`.** O prompt usa um conjunto `dev` próprio

## Subtarefas

- [ ] 3.1 — `classificar_secoes` em `TAREFAS_DE_IA` e `FUNCAO_DA_TAREFA_DE_IA`; `classificacao_do_material` em `FUNCOES`, com o `fazSozinha` e o `esperaAprovacao` da §7b
- [ ] 3.2 — Migration: os checks de tarefa, função e par em `execucao_agente`, e o ano nulo só nesta tarefa, por `ADD … NOT VALID` e `VALIDATE`; `ano_letivo_id drop not null`
- [ ] 3.3 — A tarefa em `packages/core/src/ia/tasks/`, o prompt em `packages/core/src/ia/prompts/classificar-secoes.ts` (versão na execução), saída de 0 a 3 códigos por seção, só das candidatas, teto de 800 tokens; `levaTextoDeAluno: false`, `levaTextoLivreDePessoa: false`, a categoria; o `falso`
- [ ] 3.4 — `tools/ia/medir-classificacao.ts`: taxa por etapa, `aceitaveis`, `sem_conteudo_curricular`, `injecao`, pior de três, as 10 atividades por questão; provado com fixture própria
- [ ] 3.5 — A AIA `docs/aia/diagnostico-por-habilidade.md` revista (§7b, a herança da edição nova, a suspensão por escola quando a taxa não é atingida); no `TODO.md`, a conferência do lote retido por professor antes do primeiro aluno real
- [ ] 3.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/shared/src/time/execucao.ts`, `packages/shared/src/time/funcoes.ts`, `packages/shared/src/governanca/governanca.test.ts` | alterado |
| `packages/core/drizzle/0062_*.sql`, `packages/core/drizzle/meta/_journal.json`, `packages/core/src/db/schema/execucao-agente.ts`, `packages/core/src/db/schema/mvp/mvp-tables.int.test.ts` | novo e alterado |
| `packages/core/src/ia/tasks/classificar-secoes.ts`, `packages/core/src/ia/prompts/classificar-secoes.ts`, `packages/core/src/ia/tasks/classificar-secoes.test.ts`, `packages/core/src/ia/tasks/index.ts`, `packages/core/src/ia/tasks/tarefas.test.ts` | novo e alterado |
| `tools/ia/medir-classificacao.ts`, `tools/ia/medir-classificacao.test.ts`, `apps/api/src/governanca/governanca.int.test.ts` | novo e alterado |
| `docs/aia/diagnostico-por-habilidade.md`, `TODO.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| governança | I | em "Como cada IA trabalha", autonomia 1, alto risco, suspensível | |
| textos da função; tarefa e função | U | os da §7b, sem `VOCABULARIO_DE_NOTA`; `FUNCAO_DA_TAREFA_DE_IA` liga | |
| execução sem ano lida pela varredura e pelo expurgo | I | não quebra, um caso cada | |
| outra função com ano nulo | I | o check recusa. Mutação: sem o check | |
| checks de tarefa e função | I | aceitam a nova, recusam o desconhecido; as antigas validam | |
| sondas de saída (c1), as onze do `cenarios.md` | U | `IA_SAIDA_INVALIDA`, um caso por sonda | |
| prompt: texto delimitado como dado; candidatas no começo; cortes de 1.500 e 500; 800 tokens | U | um caso cada | |
| declaração da tarefa | U | `levaTextoDeAluno: false` e a categoria, lidas pelo gateway | |
| `falso` | U | mesma entrada, mesmos códigos, dentro das candidatas, no schema | |
| medidor: taxa por etapa e `aceitaveis` | U | com fixture | |
| medidor: `sem_conteudo_curricular` com código; injeção obedecida | U | contadas | |
| medidor: pior de três; inválida; sha256 | U | a pior vale; inválida é erro; muda com `referencia` | |

## Como testar

- Tarefa: `packages/core/src/ia/tasks/tarefas.test.ts` › "%s: a saída passa no schema e na conferência da própria tarefa", "%s: mesma entrada, mesma saída, byte a byte" e "o catálogo do núcleo tem exatamente as tarefas do contrato de @educa/shared…" (a linha nova em `DECLARADO`)
- Sondas: `ScriptedAdapter` (`packages/core/src/ia/__fixtures__/scripted-adapter.ts`), como em `llm-gateway.test.ts`
- Checks: `mvp-tables.int.test.ts` › "a tarefa fica presa à função dela e a entrada à tarefa"; `migracao-fila-ferramenta.int.test.ts` › "os dois checks terminam validados…"
- Governança: `governanca.test.ts` › "o time sai do catálogo: três agentes, as seis funções…" (o número muda)
- Medidor: `tools/ia/medir-risco-a-vida.test.ts` › "pelo caminho da tarefa: o modelo que oscila vale pela pior execução…"
- `npx vitest run --project unidade packages/core/src/ia/tasks/`

## Autoconferência

As 12 perguntas do modelo, no plano. Na 7: cada frase nova da AIA aponta o arquivo ou o caso que a prova, inclusive o que só a 4.0 a 10.0 vão entregar (dito como "a partir da tarefa N").

## Fora do escopo desta tarefa

O job, a fila, o processador e `TAREFAS_SEM_MODELO_MENOR` (4.0); o lote retido e a medida (o Arquiteto).

## Divergências resolvidas nesta tarefa

## Mutações

## Recomendações sem aplicar

