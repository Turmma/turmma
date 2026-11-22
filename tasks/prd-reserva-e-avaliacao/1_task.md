# Tarefa 1.0 — A reserva sobe configurada: identidade, aprovação por tarefa e modelo, e as recusas da subida

**Funcionalidade:** reserva-e-avaliacao · **Depende de:** nenhuma (a F5a já pousou)
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `llm-integrator`
**Porte:** grande

## Objetivo

A configuração monta um segundo adaptador, o provedor de reserva, com `identidade` própria; `MODELOS_APROVADOS` diz para que
tarefa e modelo ele vale; `reservaElegivel` responde se ele pode atender uma tarefa; a subida recusa a reserva mal configurada.
Nenhuma chamada vai à reserva ainda (4.0).

## Contexto necessário

- `techspec.md` §2, §5 ("A aprovação", "A identidade", "A subida"), §7, §11
- `prd.md` RF1, RF2, RF4, RF6, §8b
- `cenarios.md` §1: as linhas RF1, RF2, RF4 e RF6 da tabela abaixo
- Código: `llm-config.ts` (`MOTIVO_ADAPTADOR_FALSO_EM_PRODUCAO`, `exigePreco`), os adaptadores, `soberania.ts` (`motivosDaD62`),
  `llm-gateway.ts` (`chaveDoBalde`, `chamadaFeita`, `exigirPrecoDosModelos`)

## Subtarefas

- [ ] 1.1 — `IA_RESERVA_ADAPTADOR`, `LLM_RESERVA_BASE_URL`, `LLM_RESERVA_MODELO[_<PERFIL>]`, `LLM_RESERVA_CHAVE_API` (na guarda de
  segredo), `IA_RESERVA_PROVEDOR_ID`, `LLM_RESERVA_TOKENS_POR_MINUTO`; `.env.example` e `infra/carga.env` (`falso-reserva`)
- [ ] 1.2 — `identidade` em todo adaptador; cada leitura de `envio.provedorId ?? origem` passa a ela
  (`grep -rn "provedorId ?? " packages/core/src/ia`), sem mudar o que o principal grava
- [ ] 1.3 — `modelos-aprovados.ts`: a constante (injetável), a guarda que recalcula o sha256 do `relatorio.md`, a entrada de
  `falso-reserva` com o relatório sintético em `docs/avaliacao/falso-reserva/`
- [ ] 1.4 — `reservaElegivel(tarefa, ambiente)`: configurada, conferida (por porta; a 2.0 liga) e com a entrada que bate em provedor
  e modelo do perfil; o falso só fora de produção; as categorias exigidas são as das tarefas aprovadas
- [ ] 1.5 — As recusas da subida e o preço da reserva no `exigirPrecoDosModelos`; a chave nunca na mensagem
- [ ] 1.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/config/llm-config.ts`, `packages/core/src/config/llm-config.test.ts`, `.env.example`, `infra/carga.env` | alterado |
| `packages/core/src/ia/adapter.ts`, `packages/core/src/ia/fake-adapter.ts`, `packages/core/src/ia/fake-adapter.test.ts`, `packages/core/src/ia/openai-compat-adapter.ts`, `packages/core/src/ia/__fixtures__/scripted-adapter.ts` | alterado |
| `packages/core/src/ia/resilient-adapter.ts`, `packages/core/src/ia/llm-gateway.ts`, `packages/core/src/ia/llm-gateway.test.ts` | alterado |
| `packages/core/src/ia/modelos-aprovados.ts`, `packages/core/src/ia/modelos-aprovados.test.ts`, `docs/avaliacao/falso-reserva/relatorio.md` | novo |
| `packages/core/src/ia/soberania.ts`, `packages/core/src/ia/soberania.test.ts`, `packages/core/src/index.ts` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| fora do Brasil, aprovada só para `relatorio_da_correcao`, e outra só para a geração: não elegível | U | Brasil sempre | tarefas sem texto de aluno | |
| só `material_da_escola`, aprovada para a geração e o Tutor: `categoria_faltando:conversa_do_aluno` | U | as categorias das aprovadas | o Tutor aprovado | |
| a mesma, aprovada só para a geração: conferida | U | controle positivo | o catálogo exigiria a conversa | |
| tarefa fora de `TAREFAS_DE_IA`, sem `relatorio`, `sha256` ou `aprovadoPor`, relatório ausente, sha256 errado, também no falso: quebra | U | a guarda | um campo por caso | |
| `producao` recusa a entrada de `falso-reserva` e aceita outra; `local` e `staging` aceitam o falso | U | o falso fora de produção | três ambientes | |
| `reservaElegivel`: outro `provedorId` com o mesmo modelo; o mesmo provedor com outro modelo: não elegível | U | provedor e modelo, na função | um campo trocado | |
| `producao` com a reserva falsa, ou `falso-reserva` sobre `openai_compat`: recusa citando a variável | U | a subida | os dois caminhos | |
| mesma identidade, também em `local`: recusa; `openai_compat` nos dois e modelos todos diferentes: sobe; um perfil igual, o `rapido` da reserva igual ao `padrao` do principal, um igual ao menor: recusa | U | "outro modelo da Maritaca" | perfis cruzados e o menor | |
| `LLM_RESERVA_TOKENS_POR_MINUTO` ausente fora do `local`: recusa; no `local`, sobe | U | regra 80.4 | os dois ambientes | |
| `LLM_RESERVA_MODELO` e `LLM_RESERVA_MODELO_<PERFIL>` sem preço: recusa citando cada um | U | RF6 | um perfil com preço, outro sem | |
| reserva meio configurada: recusa citando a que falta | U | a subida | uma variável por vez | |
| `LLM_RESERVA_CHAVE_API` nunca na mensagem | U | regra 20 | valor reconhecível | |
| `falso-reserva`: balde, rótulo, disjuntor e chave do preço dela; na linha, `provedor` nulo, `pelo_provedor_de_reserva = true` e o preço dela | U | a identidade | dois falsos, o mesmo modelo, preços injetados diferentes | |
| sem reserva, as linhas do principal como hoje | U | sem regressão | o caso de envio externo | |

## Como testar

- Subida: `llm-config.test.ts` › "em produção o adaptador falso é recusado…", › "a chave do provedor entra na configuração e nunca na
  mensagem de erro", › "LLM_TOKENS_POR_MINUTO é obrigatória fora de local…" e › "fora de `local`, com `openai_compat`, o preço do modelo é
  exigido na subida…"
- D62: `soberania.test.ts` › "cada campo errado ao mesmo tempo aparece…" e › "o cadastro sem uma categoria que uma tarefa envia não confere…"
- Hash: `tools/ia/medir-classificacao.test.ts` › "mudar a referência de uma linha, ou os aceitáveis dela, muda o hash…"
- Identidade: `llm-gateway.test.ts` › "com envio externo, o id do provedor que atendeu vai junto…"; `token-limiter.test.ts` › "o balde é
  de cada provedor:modelo…"
- `npx vitest run --project unidade packages/core/src/ia/ packages/core/src/config/`

## Fora do escopo desta tarefa

A conferência no worker e o alerta (2.0); o roteamento (4.0 a 7.0); a guarda do RF16 (13.0).

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
| `infra-guardian`, F5, rodada 5 | recusar `falso-reserva` sobre `openai_compat` em todo ambiente | a §5 decidiu: só em produção |
