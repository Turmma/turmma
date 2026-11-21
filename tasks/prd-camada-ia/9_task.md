# Tarefa 9.0 — O provedor de reserva é configurado, aprovado por tarefa e modelo, e conferido na subida

**Funcionalidade:** camada-ia · **Depende de:** 2.0
**Subagentes obrigatórios:** `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `llm-integrator`
**Porte:** grande

## Objetivo

O worker sobe com um segundo adaptador, o provedor de reserva, que só é **elegível** para a tarefa com entrada em
`MODELOS_APROVADOS` para o provedor e o modelo dele, e só depois de passar na mesma conferência da D62 do principal.

## Contexto necessário

- `techspec.md` §1, §2, §5 ("A aprovação", "A subida"), §7, §7b, §7c, §11, §13
- `prd.md` RF1, RF2, RF4, §6, §8b
- `cenarios.md` §1 RF1, RF2 (as da `soberania.test.ts`), RF4 (`modelos-aprovados.test.ts`, `llm-config.test.ts`), RF6, RF9 (`conferido`)
- Código: `llm-config.ts` (`MOTIVO_ADAPTADOR_FALSO_EM_PRODUCAO`), `soberania.ts` (`SoberaniaNaSubida`, `motivosDaD62`),
  `llm-gateway.ts` › `destinoDoAdaptador`, `fake-adapter.ts`, `apps/api/src/ia/ia-do-worker.module.ts`

## Subtarefas

- [ ] 9.1 — `LLM_RESERVA_BASE_URL`, `LLM_RESERVA_MODELO[_<PERFIL>]`, `LLM_RESERVA_CHAVE_API`, `IA_RESERVA_PROVEDOR_ID`,
  `LLM_RESERVA_TOKENS_POR_MINUTO`; `.env.example` e `infra/carga.env`
- [ ] 9.2 — As recusas da subida, cada uma citando a variável (a tabela abaixo)
- [ ] 9.3 — `MODELOS_APROVADOS` (injetável no teste) e a guarda do sha256 do `relatorio.md`; a entrada sintética de `falso-reserva`
- [ ] 9.4 — `reservaElegivel(tarefa, ambiente)`: configurada, conferida e com a entrada que bate em provedor e modelo do perfil
- [ ] 9.5 — A conferência: Brasil sempre, treinamento vedado, as categorias das aprovadas; recusada, confere de novo a cada
  5 s, sem bloquear as filas; log `ia.provedor_de_reserva.conferencia_recusada`
- [ ] 9.6 — `ia.provedor_de_reserva.conferido` só com reserva configurada; alerta `ia-provedor-de-reserva.yaml`, com
  runbook: encerrar o suboperador, avisar as escolas, conferir que o contrato permite serviço usado por menor
- [ ] 9.7 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/config/llm-config.ts`, `packages/core/src/config/llm-config.test.ts`, `.env.example`, `infra/carga.env` | alterado |
| `packages/core/src/ia/modelos-aprovados.ts`, `packages/core/src/ia/modelos-aprovados.test.ts`, `docs/avaliacao/falso-reserva/relatorio.md` | novo |
| `packages/core/src/ia/soberania.ts`, `packages/core/src/ia/soberania.test.ts`, `packages/core/src/index.ts` | alterado |
| `packages/core/src/telemetry/metrics.ts` | alterado |
| `apps/api/src/ia/ia-do-worker.module.ts`, `apps/api/src/ia/reserva-na-subida.int.test.ts` | novo e alterado |
| `infra/grafana/alertas/ia-provedor-de-reserva.yaml`, `infra/test/alertas.test.ts`, `docs/runbook.md` | novo e alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| sem suboperador vigente: o worker sobe, o principal passa, `conferido = 0` | I | RF1 | |
| `pais_fora_do_brasil`, `treinamento_nao_vedado`, contrato vencido e no reinício: fora do caminho | I | a conferência inteira | |
| fora do Brasil, só para `relatorio_da_correcao` ou só para `gerar_atividade_objetiva`: não elegível | U | Brasil sempre | |
| cadastro corrigido sem reiniciar: elegível, e `conferido` passa a 1 | I | a reconferência | |
| sem `conversa_do_aluno`, aprovada para o Tutor: `categoria_faltando:conversa_do_aluno`; aprovada só para a geração: conferida | U | as categorias das aprovadas | |
| tarefa fora de `TAREFAS_DE_IA`, campo faltando, relatório ausente, `sha256` errado (também no falso): quebra | U | a guarda | |
| `producao` recusa `falso-reserva` e aceita outro provedor; `local` e `staging` aceitam o falso | U | o falso fora de produção | |
| outro `provedorId` com o mesmo modelo; o mesmo provedor com outro modelo: não elegível | U | provedor e modelo | |
| id da reserva igual ao do principal, também em `local` | U | a subida | |
| reserva falsa em produção; `falso-reserva` sobre `openai_compat` em produção | U | a subida | |
| `LLM_RESERVA_MODELO` e `LLM_RESERVA_MODELO_<PERFIL>` sem preço | U | RF6 | |
| reserva meio configurada: recusa citando a variável que falta | U | a subida | |
| `LLM_RESERVA_CHAVE_API` nunca na mensagem de erro | U | regra 20 | |
| sem reserva configurada, a série não existe e o alerta não dispara | I, U | `noDataState = OK` | |
| reserva configurada e recusada: publica 0, e o alerta dispara depois de 10 min | I, U | sem `absent()` | |

## Como testar

- Subida: `llm-config.test.ts` › "em produção o adaptador falso é recusado…"
- D62: `soberania.test.ts` › "cada campo errado ao mesmo tempo aparece…"; `soberania-na-subida.int.test.ts` › "externo com o
  suboperador que cobre tudo: consome"
- Hash: `tools/ia/medir-classificacao.test.ts` › "mudar a referência de uma linha…"
- Alerta: `infra/test/alertas.test.ts` (`noDataState`)
- `npx vitest run --project unidade packages/core/src/ia/ packages/core/src/config/`

## Fora do escopo desta tarefa

O roteamento (10.0); a interrompida e a carga (11.0); os relatórios reais (13.0).

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
| `infra-guardian`, rodada 5 | recusar `falso-reserva` sobre `openai_compat` em todo ambiente | 9.2: decidir com o `infra-guardian` e registrar em "Divergências" |
