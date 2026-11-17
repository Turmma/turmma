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

- [x] 11.1 — `FASE=sala`: a carga da tabela de `onda-3a.md`, latência por perfil (`IA_LATENCIA_FALSA_MS` 6 s,
  `IA_LATENCIA_FALSA_MS_PADRAO` 50 s), o falso informando 3.000 + 250 tokens por turno; thresholds por escola
- [x] 11.2 — O `kill -9` do `worker-ia-1` no meio da fase: os `EXECUCAO_INTERROMPIDA` saem de `respostas_inesperadas` para
  um contador com teto igual aos jobs ativos da réplica, lido antes; os outros falhos seguem em 0
- [x] 11.3 — `infra/carga.env`: o `LLM_TOKENS_POR_MINUTO` na escala do falso, saído do piso do contrato (§7c), para o teto
  morder
- [x] 11.4 — A corrida: `FASE=base` no build anterior e no da árvore, na mesma sessão; `FASE=sala` no da árvore. O relatório
  (seção "Divergências" e `docs/infra.md` §3.2): p95 do turno, espera p95 do Tutor e da ferramenta, número de
  "indisponível", espera por conexão do pool, RSS do `worker-ia` contra a memória da VPS (D82), e o custo de base por
  professor (recomendação do `llm-integrator`, rodada 6)
- [x] 11.5 — `docs/infra.md`: o piso do contrato com as duas premissas (3.000 + 250 e 5.000 + 300) e o que a `FASE=sala`
  mediu de "1 ferramenta por minuto por escola"
- [x] 11.6 — Testes do script

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `infra/k6/justica-entre-escolas.js`, `infra/scripts/carga.ts`, `infra/carga.env`, `infra/test/carga.test.ts`, `infra/compose.yml`, `docs/infra.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| a corrida | C | comando (`npm run carga`), data, os números do RF6 contra os limites, a condição da máquina ("Quando a carga vale como registro") | `npm run carga -- --so=base` no build anterior (`58782107`) e no da árvore, e `npm run carga -- --so=sala`, em 16/11/2026, na mesma sessão: a seção "Divergências resolvidas nesta tarefa", "A corrida", leva comando, números, limites e a máquina |
| o `kill -9` | C | nenhuma resposta perdida: os interrompidos dentro do teto, a próxima pergunta roda, o aluno vê "Tentar de novo" sem gastar a troca | a corrida `--so=sala` (o `kill -9` aos 75 s, os interrompidos contra o teto lido antes, `falhas_fora_do_kill` e `indisponivel` em 0); a leitura do banco: `infra/test/carga-da-manha.int.test.ts` › "as execuções em `rodando` são o teto do kill -9, as falhas saem por erro e só da escola e da janela"; o aluno que vê "Tentar de novo" sem gastar a troca é da 6.0 e da 9.0: `apps/api/src/tutor/sem-resposta.int.test.ts` › "a reentrega interrompida (EXECUCAO_INTERROMPIDA): o worker que morreu no meio deixa a pergunta sem resposta, e ela conta" e `apps/web/src/areas/aluno/Tutor.test.tsx` › "D36 junto: a mensagem fixa com o 188 está na conversa (a execução `falhou EXECUCAO_INTERROMPIDA`) e vem **acima** do "Tentar de novo"" |
| o teto morde | C | a `FASE=sala` registra reservas recusadas no balde, e mesmo assim nenhum "indisponível" | a corrida `--so=sala` (`ia_tokens_uso_do_teto` e `ia_degradacao_total` no relatório, `balde_nao_recusou` em verde); `infra/test/carga.test.ts` › "o `LLM_TOKENS_POR_MINUTO` da carga deixa o balde geral (80 %) um pouco abaixo da carga…", "o balde que não recusou nenhuma reserva reprova…" |
| RSS | C | o RSS do `worker-ia` no pico, contra a memória da VPS (D82) | a corrida `--so=sala` (`docker stats` a cada 10 s, o pico no relatório); `infra/test/carga.test.ts` › "o RSS do `docker stats` vira MiB…" |
| argumentos | U | `argumentosDoK6('sala')` leva a fase e as latências; a `base` segue igual | `infra/test/carga.test.ts` › "as constantes do k6 são as do script, e a fase `sala` é uma fase como as outras", "a latência por perfil e os tokens do falso são os da sala…", "o compose passa a latência do `padrao` e os tokens do falso aos dois `worker-ia`…" |
| o contador | U | os `EXECUCAO_INTERROMPIDA` acima do teto falham a fase; os outros falhos também | `infra/test/carga.test.ts` › "os `EXECUCAO_INTERROMPIDA` acima do teto lido antes do kill falham a fase…", "o kill que não interrompeu nenhuma execução não prova a reentrega…", "qualquer outra falha, e todo "indisponível", falham a fase…", "o resultado da sala separa as falhas do banco…", "o contador das interrompidas só é lido quando é número" |
| nenhum provedor pago | U | `infra/carga.env` tem o adaptador falso, e o script recusa outro | `infra/test/carga.test.ts` › "o ambiente de carga é o do adaptador falso, e o script recusa qualquer outro" |
| a latência por perfil e os tokens | U | o falso espera a latência do perfil (6 s no `rapido`, 50 s no `padrao`) e informa os 3.000 + 250; a configuração os valida contra o prazo do perfil | `packages/core/src/ia/fake-adapter.test.ts` (os cinco casos); `packages/core/src/config/llm-config.test.ts` › "a latência do perfil `padrao` do adaptador falso…", "os tokens que o adaptador falso informa…"; `packages/core/src/ia/llm-gateway.test.ts` › "criarProvedorDeIa: os tokens falsos e a latência do `padrao` da configuração chegam ao adaptador falso…" e "as opções do adaptador falso (latência, latência do `padrao` e tokens), preenchidas junto do provedor, não chegam a ele…" |
| a semente e as medidas | I | a escola da sala tem as seis turmas, os 60 alunos em rodízio, as professoras com vínculo nas seis e o material `pronto`; a espera p95 sai por escola e por fila, só dos jobs da janela | `infra/test/carga-da-manha.int.test.ts` › "seis turmas com os alunos em rodízio…", "a espera p95 de cada fila da escola…", "a outra escola mede só os jobs dela…", "o turno do Tutor é o p95 de `criada_em` a `concluida_em`…", "as execuções em `rodando` são o teto do kill -9…", "o consumo da janela soma chamadas, tokens e custo por função…" |

## Como testar

- Script: `infra/test/carga.test.ts`; a forma da fase nova no banco: `infra/test/carga-da-manha.int.test.ts` (no lugar do `carga-sala.test.ts` que o
  plano citava: o nome da fase é "manhã", e o `carga-sala.test.ts` da A1 é o da reivindicação em sala)
- O falso: `npx vitest run --project unidade packages/core/src/ia/fake-adapter.test.ts packages/core/src/config/llm-config.test.ts`
- A corrida: `flock /tmp/educa-carga.lock npm run carga -- --so=base` (no build anterior e no da árvore) e `npm run carga -- --so=sala`; repita com a máquina calma se a regra do runbook não valer
- Armadilha (F2c, `criar-tasks`): teste do script prova o script; a linha [C] leva a corrida de verdade na coluna "Caso"
- Armadilha (F4, grupo F): pare o compose de teste antes; a carga sobe o próprio

## Autoconferência

As 12 perguntas do modelo, respondidas no plano (11.0). Na 1: cada threshold e o teto do contador são blocos. Na 4: a fase `sala` precisa
morder o teto; confira na corrida que o balde recusou.

1. **Mutação de cada cláusula:** a seção "Mutações" tem 74 blocos, um por cláusula do diff que o teste alcança. No `core`: as duas latências da configuração (`>=` contra o menor prazo, e contra o do
   `padrao`, que não é o menor de todos), o zero que vale ausente (`> 0`), cada termo do `||` dos tokens e o valor de cada campo; no falso, o perfil `padrao`, a cadeia `?? latenciaMs ?? 0`
   e cada `tokens?.… ??`; no gateway, o ramo do provedor e o repasse de cada uma das três opções. No script, cada critério de `julgarSala` (`> teto`, `=== 0` do kill, `> 0` das falhas e do
   "indisponível", o código do k6, os cruzados, `>=` da espera, o mínimo de amostras e o p95 nulo, as reservas recusadas) e o de `julgarSoABase`, o `exigirAdaptadorFalso`, a ordem do
   ambiente (carga.env antes do `.env.example`), cada valor do falso (6 s, 50 s, 3.000, 250 e o das outras fases), as constantes da sala, o RSS em MiB; no k6, cada constante da
   carga e **cada threshold** (os sete); em `infra/carga.env`, o `LLM_TOKENS_POR_MINUTO` para cima e para baixo; no compose, as três variáveis do falso. O `--faltando` dá 0 linhas (ele não lê
   `infra/`, e os blocos de lá são os que a pergunta pede à mão). Aplicados todos antes do portão, com o `conferirMutacoesDoDocumento` e o `rodarCalado` dele: 74 vermelhos. As funções que
   só a corrida usa (`executarASala`, `amostrarASala`, `telemetriaDaSala`) não têm bloco: a corrida de verdade é o teste delas, e o relatório as mostra funcionando.
2. **Texto na tela:** a tarefa não tem tela, e nenhum texto de interface muda. `grep -rln 'IA_LATENCIA_FALSA_MS_PADRAO' e2e/ apps/web/src` não acha nada.
3. **Segundo dado:** o `rapido` e o `padrao` têm latências diferentes (os dois casos de cada lado); o zero e o valor da configuração; só a entrada e só a saída dos tokens; a escola que passa e a que
   reprova no mesmo veredito (`e4` no Tutor e `e7` na ferramenta); o limite exato e um abaixo; o `interrompidas` no teto e um acima; o k6 limpo e o cruzado.
4. **Checagem anterior (o controle):** o veredito que reprova tem o controle limpo ao lado (`julgarSala(salaLimpa())` é `[]`, e cada falha muda uma coisa só). O teto que morde: o `balde_nao_recusou` é
   critério, e a conta do `LLM_TOKENS_POR_MINUTO` é um caso (balde abaixo da carga e acima de 52/60 dela); a corrida de verdade confere que o balde recusou (`ia_tokens_uso_do_teto`, as reservas recusadas
   no relatório). O `kill_sem_efeito` é o controle do `kill -9`: sem interrompidas, a fase não provou a reentrega.
5. **Asserção:** olha o que sai (o critério e o detalhe da reprovação, a variável de ambiente que o compose passa, o código de IA com que a chamada terminou, os tokens da medição); a ausência (`undefined`)
   só vale ao lado do positivo (`latenciaFalsaMs` com valor e sem).
6. **Guarda nova:** nenhuma regra nova. `tools/ci/ambiente.test.ts` já exige variável do compose com `:?` e preenchida no `.env.example` (as três entraram nos dois). O teste de `carga.test.ts` lê o compose e o
   `.env.example` para provar que as três chegam aos dois `worker-ia`.
7. **Comentários:** o docblock do `FakeAdapterOptions`, o de `julgarSala` e o de `executarASala` dizem o que o código faz; o `infra/carga.env` explica a conta do `LLM_TOKENS_POR_MINUTO`; o `.env.example`, `docs/infra.md` e o runbook
   dizem o mesmo (as duas premissas e o que a corrida mediu).
8. **Divergências:** a tabela abaixo. Nenhuma baixa critério; a do nome do arquivo de teste e a do `core` entre os arquivos são de lista.
9. **Peça que já existe:** `FakeAdapter` e `IA_LATENCIA_FALSA_MS`, `sessoesSinteticas` (extraída de `gerarTokens`), o `ops:escola` e o `ops:sessao-sintetica`, `conferirJobRegistro`/`urlDoBancoDoAmbiente`,
   `argumentosDoCompose`, `lerResumoDoK6`, `Reprovacao`/`Veredito`, `TokenLimiter` e as métricas `ia_degradacao_total`, `ia_tokens_uso_do_teto` e `db_pool_em_uso`. Nenhuma peça nova duplicada.
10. **Concorrência e relógio:** o teste do falso usa um sinal de 150 ms e esperas de 5 ms e 5 s, nunca o relógio da máquina para decidir um limite fino; o `kill -9` é aos 75 s, com o k6 já no ritmo, e o teto é lido antes dele.
11. **Isolamento e "Caso":** a carga cria a rede e as dez escolas pelo `ops:escola` e lê o banco sempre com `escola_id in (…)`; o teste de integração mede duas escolas e prova que a espera de uma não entra na da outra (a `e2`
    com 7 s não muda o p95 da `e1`). Seed sintético, nenhuma conversa de pessoa. A coluna "Caso" está preenchida, uma entrada por linha da tabela.
12. **Guardiões e achados:** `infra-guardian` (a carga dentro da regra 80, itens 10 e 11, o `kill -9`, o RSS contra a VPS, o relatório com a máquina), `llm-integrator` (só o adaptador falso, nenhum provedor pago, o piso do contrato com as duas
    premissas, o custo de base por professor). Sem `achados/` ainda.

## Fora do escopo desta tarefa

A avaliação de modelos e o teto real (D37).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| Três arquivos do `core` e o `.env.example` mudam (`llm-config.ts`, `fake-adapter.ts`, `llm-gateway.ts`, e os testes deles), fora da lista de "Arquivos previstos", que só tinha `infra/` e `docs/` | A `IA_LATENCIA_FALSA_MS_PADRAO` "nasce na 47.0, com o seu invariante contra `LLM_TIMEOUT_MS_PADRAO`" (`onda-3c.md`): é o falso que a espera, e a configuração que a valida | `techspec.md` §5 "Como a 11.0 ficou" (1); `onda-3c.md` |
| `IA_TOKENS_FALSOS_ENTRADA` e `IA_TOKENS_FALSOS_SAIDA` são variáveis novas, e o compose as passa aos dois `worker-ia` | O plano diz "o falso informando 3.000 + 250 tokens por turno" e não diz como: o falso estimava pelo texto (4 caracteres por token), e o teto só morde na escala do contrato com tokens informados. Zero é ausente; as outras fases voltam à estimativa (`ambienteDoFalso`) | `techspec.md` §5 "Como a 11.0 ficou" (1) |
| O arquivo do teste de banco é `infra/test/carga-da-manha.int.test.ts`, e não `carga-sala.test.ts` | `carga-sala.test.ts` é o da reivindicação em sala (A1), e a `FASE=sala` é a da manhã; o nome do arquivo segue o `.int.test.ts` que o projeto `infra` do Vitest lê | `techspec.md` §5 "Como a 11.0 ficou" (5) |
| `LLM_TOKENS_POR_MINUTO` de `infra/carga.env` é **1.950.000**, e não "o piso do contrato (§7c) na escala do falso" | O piso (2,5 milhões) é o do contrato de produção, para 1,7 milhão de pico; na escala do falso a carga das dez escolas é 1,625 milhão por minuto, e só um balde **abaixo** dela morde. 1,95 milhão dá 1,56 milhão (80 %): 4 % abaixo, esperas de poucos segundos, dentro dos 8 s do degrau. Com 2 milhões o balde (1,6 milhão) mordeu numa corrida e na outra não | `cenarios.md` §8; `techspec.md` §5 "Como a 11.0 ficou" (3) |
| A espera p95 vem do banco (`job_registro`), e o teto do contador é a contagem de `execucao_agente` em `rodando` das **duas** réplicas | A API não devolve as datas da execução ao cliente, e o k6 só mede o turno de fora; o teto é lido antes do `kill -9`, e a `rodando` da réplica morta não se separa da da outra: é a cota superior (e o `kill_sem_efeito` cobre o lado de baixo) | `techspec.md` §5 "Como a 11.0 ficou" (2) |
| O passo da consulta do k6 é 1 s (o da web), e o limite do turno é 2 s + 6 s + 1 s | Com 0,5 s, uma professora com a ferramenta de 50 s esperando passou do limite geral de 120 pedidos por minuto e levou 429, que a tela real não leva | `docs/runbook.md` "Rodar a carga da manhã" |
| A espera por conexão do pool não está no relatório | Só existe o "em uso" (`db_pool_em_uso`); o relatório diz isso, e a métrica nova vai ao `TODO.md` | `TODO.md` |
| O falso `stalled` das duas filas não está no relatório (o `onda-3a.md`, "Latência e carga (47.0)", o pede) | O relatório traz o `EXECUCAO_INTERROMPIDA` do `kill -9` e as `falhas_fora_do_kill`, que acusam uma reentrega que falhou, mas não o contador de jobs `stalled` do BullMQ: ele não é exposto pelo `worker-ia` hoje. Vai ao `TODO.md` | `techspec.md` §5 "Como a 11.0 ficou" (4); `TODO.md` |
| A recomendação da 6.0 (a `pendente` sem job, encerrada em até 60 s) **não** entra na `FASE=sala` | A execução semeada é uma interrompida a mais que o teto das `rodando` não prevê; vai ao `TODO.md` | "Recomendações sem aplicar" |
| `npm run carga` ganha `--so=base` e `--so=sala` | A comparação com o build anterior roda só a base nos dois builds; a sala roda só no da árvore, que é o único com `worker-ia` | `techspec.md` §5 "Como a 11.0 ficou" (2) |

### A corrida

Comando: `flock /tmp/educa-carga.lock npm run carga -- --so=base` no build anterior (`58782107`, o pai da 5.0, num `git worktree` com o mesmo `carga.ts` e o mesmo k6) e na árvore, na mesma sessão de 16/11/2026
(19h46 às 20h04), e `npm run carga -- --so=sala` na árvore (20h12 às 20h26, `passou`, saída 0). A primeira tentativa da sala (19h29) reprovou por defeito de montagem, e a segunda (19h58) também; as duas causas estão no runbook, e o que cada uma mudou, nas
linhas acima (o passo da consulta, o tema da ferramenta e o `LLM_TOKENS_POR_MINUTO`). Só a última vale como registro.

| O que | Limite (RF6) | Medido |
|---|---|---|
| p95 do turno, base: anterior contra árvore | a árvore até 1 s acima | 335 ms contra 353 ms no banco (+18 ms); 451 contra 453 ms no k6; espera p95 da B 17 ms nos dois |
| espera p95 do Tutor, dez escolas | < 2 s | de 62 a 107 ms |
| espera p95 da ferramenta, dez escolas | < 10 s | de 133 a 237 ms (16 e 17 jobs por escola) |
| turno do Tutor na sala | espera + modelo (6 s) + passo (1 s) = 9 s no k6 | p95 de 6,1 s no banco (de 6,11 a 6,17 s por escola) e 7,15 s no k6 |
| "indisponível" | nenhum | 0 |
| `kill -9` no `worker-ia-1` | os interrompidos até o teto lido antes | 21 `EXECUCAO_INTERROMPIDA` (teto 60), nenhuma outra falha |
| o balde morde | recusou reservas | 93 reservas esperaram, 0 foram ao modelo menor, 0 terminaram indisponíveis (pico do balde 0,77 de 0,80) |
| respostas | nenhuma 429, nenhuma inesperada | 0 e 0; 1.341 turnos, 34 ferramentas e 129 propostas terminados |
| RSS do `worker-ia` no pico | contra a memória da VPS (D82) | 156 MiB (`worker-ia-1`) e 121 MiB (`worker-ia-2`), 0,27 GiB: menos de 7 % de 4 GiB. A VPS e o tamanho dela seguem em aberto (D82) |
| pool do banco | espera por conexão | só o "em uso": pico 11 (o pool é 20 por réplica); 71 conexões no Postgres. A espera não tem métrica |
| custo de base por professor | (recomendação do `llm-integrator`, rodada 6) | uns 9 a 10 mil tokens por minuto de uso no pico (626 mil tokens das 20 professoras, ~3 min), adaptador falso, 0 micros; o custo em reais sai do preço do modelo real, da D37 |

A máquina **não estava calma** (load de 1 minuto de 2,9 a 5,1 antes de cada corrida, e as pilhas `educa-teste`, `-2` e `-3` de outros andares de pé, contra "abaixo de ~2" e "nenhum outro compose de pé" do
runbook): o resultado passou com a folga de duas ordens de grandeza (esperas de 100 ms contra 2 s), e por isso vale como conservador, mas não como o registro das condições do runbook. A repetição com a máquina calma está no `TODO.md`. O hash de senha não
entra neste cenário.

## Mutações

--faltando: 0 linhas (123 blocos, 0 motivos)

Cada bloco tira uma cláusula (ou troca um número) e exige o vermelho de um caso que rodou; todos foram aplicados antes do portão, com o `conferirMutacoesDoDocumento` e o `rodarCalado` do próprio portão. Os que provam uma ausência levam o `falha:`.

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts › a latência simulada cabe no prazo de cada perfil
-  if (valores.IA_LATENCIA_FALSA_MS >= menorPrazo) problema('IA_LATENCIA_FALSA_MS', MOTIVO_LATENCIA_FALSA_MAIOR_QUE_O_PRAZO)
+  if (valores.IA_LATENCIA_FALSA_MS > menorPrazo) problema('IA_LATENCIA_FALSA_MS', MOTIVO_LATENCIA_FALSA_MAIOR_QUE_O_PRAZO)
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts › a latência do perfil `padrao` do adaptador falso
-  if (valores.IA_LATENCIA_FALSA_MS_PADRAO >= valores.LLM_TIMEOUT_MS_PADRAO) problema('IA_LATENCIA_FALSA_MS_PADRAO', MOTIVO_LATENCIA_FALSA_PADRAO_MAIOR_QUE_O_PRAZO)
+  if (valores.IA_LATENCIA_FALSA_MS_PADRAO > valores.LLM_TIMEOUT_MS_PADRAO) problema('IA_LATENCIA_FALSA_MS_PADRAO', MOTIVO_LATENCIA_FALSA_PADRAO_MAIOR_QUE_O_PRAZO)
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts › a latência do perfil `padrao` do adaptador falso
-  if (valores.IA_LATENCIA_FALSA_MS_PADRAO >= valores.LLM_TIMEOUT_MS_PADRAO) problema('IA_LATENCIA_FALSA_MS_PADRAO', MOTIVO_LATENCIA_FALSA_PADRAO_MAIOR_QUE_O_PRAZO)
+  if (valores.IA_LATENCIA_FALSA_MS_PADRAO >= menorPrazo) problema('IA_LATENCIA_FALSA_MS_PADRAO', MOTIVO_LATENCIA_FALSA_PADRAO_MAIOR_QUE_O_PRAZO)
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts › a latência do perfil `padrao` do adaptador falso
falha: expect(loadLLMConfig(LOCAL).latenciaFalsaMs).toBeUndefined()
-    ...(valores.IA_LATENCIA_FALSA_MS > 0 ? { latenciaFalsaMs: valores.IA_LATENCIA_FALSA_MS } : {}),
+    ...(valores.IA_LATENCIA_FALSA_MS >= 0 ? { latenciaFalsaMs: valores.IA_LATENCIA_FALSA_MS } : {}),
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts › a latência do perfil `padrao` do adaptador falso
falha: expect(loadLLMConfig(LOCAL).latenciaFalsaMsPadrao).toBeUndefined()
-    ...(valores.IA_LATENCIA_FALSA_MS_PADRAO > 0 ? { latenciaFalsaMsPadrao: valores.IA_LATENCIA_FALSA_MS_PADRAO } : {}),
+    ...(valores.IA_LATENCIA_FALSA_MS_PADRAO >= 0 ? { latenciaFalsaMsPadrao: valores.IA_LATENCIA_FALSA_MS_PADRAO } : {}),
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts › os tokens que o adaptador falso informa
-    ...(valores.IA_TOKENS_FALSOS_ENTRADA > 0 || valores.IA_TOKENS_FALSOS_SAIDA > 0
+    ...(false || valores.IA_TOKENS_FALSOS_SAIDA > 0
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts › os tokens que o adaptador falso informa
-    ...(valores.IA_TOKENS_FALSOS_ENTRADA > 0 || valores.IA_TOKENS_FALSOS_SAIDA > 0
+    ...(valores.IA_TOKENS_FALSOS_ENTRADA > 0 || false
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts › os tokens que o adaptador falso informa
-      ? { tokensFalsos: { entrada: valores.IA_TOKENS_FALSOS_ENTRADA, saida: valores.IA_TOKENS_FALSOS_SAIDA } }
+      ? { tokensFalsos: { entrada: valores.IA_TOKENS_FALSOS_SAIDA, saida: valores.IA_TOKENS_FALSOS_SAIDA } }
```

```mutacao
arquivo: packages/core/src/ia/fake-adapter.ts
teste: packages/core/src/ia/fake-adapter.test.ts › espera a latência do perfil dele
-    const latenciaMs = (chamada.tarefa.perfil === 'padrao' ? this.opcoes.latenciaMsPadrao : undefined) ?? this.opcoes.latenciaMs ?? 0
+    const latenciaMs = (chamada.tarefa.perfil !== 'padrao' ? this.opcoes.latenciaMsPadrao : undefined) ?? this.opcoes.latenciaMs ?? 0
```

```mutacao
arquivo: packages/core/src/ia/fake-adapter.ts
teste: packages/core/src/ia/fake-adapter.test.ts › não vale para o `rapido`
-    const latenciaMs = (chamada.tarefa.perfil === 'padrao' ? this.opcoes.latenciaMsPadrao : undefined) ?? this.opcoes.latenciaMs ?? 0
+    const latenciaMs = this.opcoes.latenciaMsPadrao ?? this.opcoes.latenciaMs ?? 0
```

```mutacao
arquivo: packages/core/src/ia/fake-adapter.ts
teste: packages/core/src/ia/fake-adapter.test.ts › sem a latência do `padrao`, ele espera
-    const latenciaMs = (chamada.tarefa.perfil === 'padrao' ? this.opcoes.latenciaMsPadrao : undefined) ?? this.opcoes.latenciaMs ?? 0
+    const latenciaMs = (chamada.tarefa.perfil === 'padrao' ? this.opcoes.latenciaMsPadrao : undefined) ?? 0
```

```mutacao
arquivo: packages/core/src/ia/fake-adapter.ts
teste: packages/core/src/ia/fake-adapter.test.ts › sem a latência do `padrao`, ele espera
falha: expect(await terminouCom(chamarFerramenta(semEspera))).toBeUndefined()
-    const latenciaMs = (chamada.tarefa.perfil === 'padrao' ? this.opcoes.latenciaMsPadrao : undefined) ?? this.opcoes.latenciaMs ?? 0
+    const latenciaMs = (chamada.tarefa.perfil === 'padrao' ? this.opcoes.latenciaMsPadrao : undefined) ?? this.opcoes.latenciaMs ?? 1_000_000
```

```mutacao
arquivo: packages/core/src/ia/fake-adapter.ts
teste: packages/core/src/ia/fake-adapter.test.ts › informa os 3.000
-      tokensDeEntrada: this.opcoes.tokens?.entrada ?? estimarTokens(JSON.stringify(chamada.entrada)),
+      tokensDeEntrada: estimarTokens(JSON.stringify(chamada.entrada)),
```

```mutacao
arquivo: packages/core/src/ia/fake-adapter.ts
teste: packages/core/src/ia/fake-adapter.test.ts › informa os 3.000
-      tokensDeSaida: this.opcoes.tokens?.saida ?? estimarTokens(texto),
+      tokensDeSaida: estimarTokens(texto),
```

```mutacao
arquivo: packages/core/src/ia/fake-adapter.ts
teste: packages/core/src/ia/fake-adapter.test.ts › sem eles estima pelo tamanho
-      tokensDeEntrada: this.opcoes.tokens?.entrada ?? estimarTokens(JSON.stringify(chamada.entrada)),
+      tokensDeEntrada: this.opcoes.tokens?.entrada ?? 0,
```

```mutacao
arquivo: packages/core/src/ia/fake-adapter.ts
teste: packages/core/src/ia/fake-adapter.test.ts › sem eles estima pelo tamanho
-      tokensDeSaida: this.opcoes.tokens?.saida ?? estimarTokens(texto),
+      tokensDeSaida: this.opcoes.tokens?.saida ?? 0,
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o prazo é o do perfil da tarefa
-  if (config.modelo !== undefined) return new OpenAICompatAdapter(config.modelo)
+  if (false) return new OpenAICompatAdapter(config.modelo)
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › com latenciaFalsaMs a chamada do adaptador falso espera
-    ...(config.latenciaFalsaMs === undefined ? {} : { latenciaMs: config.latenciaFalsaMs }),
+    ...(config.latenciaFalsaMs === undefined ? {} : { latenciaMs: undefined }),
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › os tokens falsos e a latência do `padrao` da configuração
-    ...(config.latenciaFalsaMsPadrao === undefined ? {} : { latenciaMsPadrao: config.latenciaFalsaMsPadrao }),
+    ...(config.latenciaFalsaMsPadrao === undefined ? {} : { latenciaMsPadrao: undefined }),
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › os tokens falsos e a latência do `padrao` da configuração
-    ...(config.tokensFalsos === undefined ? {} : { tokens: config.tokensFalsos }),
+    ...(config.tokensFalsos === undefined ? {} : { tokens: undefined }),
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › os `EXECUCAO_INTERROMPIDA` acima do teto
-  if (resultado.interrompidas > resultado.tetoDeInterrompidas) {
+  if (resultado.interrompidas >= resultado.tetoDeInterrompidas) {
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o kill que não interrompeu nenhuma execução
-  if (resultado.interrompidas === 0) reprovacoes.push({ criterio: 'kill_sem_efeito'
+  if (false) reprovacoes.push({ criterio: 'kill_sem_efeito'
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › qualquer outra falha, e todo
-  if (resultado.falhasForaDoKill > 0) reprovacoes.push({ criterio: 'falhas_fora_do_kill'
+  if (resultado.falhasForaDoKill > 1) reprovacoes.push({ criterio: 'falhas_fora_do_kill'
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › qualquer outra falha, e todo
-  if (resultado.indisponiveis > 0) reprovacoes.push({ criterio: 'indisponivel'
+  if (resultado.indisponiveis > 1) reprovacoes.push({ criterio: 'indisponivel'
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › threshold do k6 cruzado reprova
-  if (resultado.k6.codigo !== saidaEsperada) reprovacoes.push({ criterio: 'k6_sala'
+  if (false) reprovacoes.push({ criterio: 'k6_sala'
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › threshold do k6 cruzado reprova
-  for (const { metrica, criterio } of resultado.k6.cruzados) reprovacoes.push({ criterio: `sala:${metrica}`
+  for (const { metrica, criterio } of []) reprovacoes.push({ criterio: `sala:${metrica}`
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › a espera p95 de cada escola é julgada
-      else if (p95 >= limite) reprovacoes.push({ criterio: `espera_${fila}`
+      else if (p95 > limite) reprovacoes.push({ criterio: `espera_${fila}`
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › escola sem amostra de uma fila
-      if (amostras < AMOSTRAS_MINIMAS_DA_SALA || p95 === null) reprovacoes.push
+      if (amostras <= AMOSTRAS_MINIMAS_DA_SALA || p95 === null) reprovacoes.push
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › escola sem amostra de uma fila
-      if (amostras < AMOSTRAS_MINIMAS_DA_SALA || p95 === null) reprovacoes.push
+      if (amostras < AMOSTRAS_MINIMAS_DA_SALA) reprovacoes.push
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o balde que não recusou nenhuma reserva
-  if (resultado.reservasRecusadas === 0) reprovacoes.push({ criterio: 'balde_nao_recusou'
+  if (false) reprovacoes.push({ criterio: 'balde_nao_recusou'
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o ambiente de carga é o do adaptador falso
-  if (adaptador !== 'falso') throw new Error(`a carga só roda com IA_ADAPTADOR=falso
+  if (false) throw new Error(`a carga só roda com IA_ADAPTADOR=falso
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o ambiente de carga é o do adaptador falso
-  return { IA_ADAPTADOR: doArquivo['IA_ADAPTADOR'] ?? exemplo['IA_ADAPTADOR'] }
+  return { IA_ADAPTADOR: exemplo['IA_ADAPTADOR'] }
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › a latência por perfil e os tokens do falso
-  if (fase === 'sala') return { IA_LATENCIA_FALSA_MS: '6000', IA_LATENCIA_FALSA_MS_PADRAO: '50000', IA_TOKENS_FALSOS_ENTRADA: '3000', IA_TOKENS_FALSOS_SAIDA: '250' }
+  if (fase === 'sala') return { IA_LATENCIA_FALSA_MS: '5000', IA_LATENCIA_FALSA_MS_PADRAO: '50000', IA_TOKENS_FALSOS_ENTRADA: '3000', IA_TOKENS_FALSOS_SAIDA: '250' }
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › a latência por perfil e os tokens do falso
-  if (fase === 'sala') return { IA_LATENCIA_FALSA_MS: '6000', IA_LATENCIA_FALSA_MS_PADRAO: '50000', IA_TOKENS_FALSOS_ENTRADA: '3000', IA_TOKENS_FALSOS_SAIDA: '250' }
+  if (fase === 'sala') return { IA_LATENCIA_FALSA_MS: '6000', IA_LATENCIA_FALSA_MS_PADRAO: '40000', IA_TOKENS_FALSOS_ENTRADA: '3000', IA_TOKENS_FALSOS_SAIDA: '250' }
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › a latência por perfil e os tokens do falso
-  if (fase === 'sala') return { IA_LATENCIA_FALSA_MS: '6000', IA_LATENCIA_FALSA_MS_PADRAO: '50000', IA_TOKENS_FALSOS_ENTRADA: '3000', IA_TOKENS_FALSOS_SAIDA: '250' }
+  if (fase === 'sala') return { IA_LATENCIA_FALSA_MS: '6000', IA_LATENCIA_FALSA_MS_PADRAO: '50000', IA_TOKENS_FALSOS_ENTRADA: '2000', IA_TOKENS_FALSOS_SAIDA: '250' }
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › a latência por perfil e os tokens do falso
-  if (fase === 'sala') return { IA_LATENCIA_FALSA_MS: '6000', IA_LATENCIA_FALSA_MS_PADRAO: '50000', IA_TOKENS_FALSOS_ENTRADA: '3000', IA_TOKENS_FALSOS_SAIDA: '250' }
+  if (fase === 'sala') return { IA_LATENCIA_FALSA_MS: '6000', IA_LATENCIA_FALSA_MS_PADRAO: '50000', IA_TOKENS_FALSOS_ENTRADA: '3000', IA_TOKENS_FALSOS_SAIDA: '300' }
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › a latência por perfil e os tokens do falso
-  return { IA_LATENCIA_FALSA_MS_PADRAO: '0', IA_TOKENS_FALSOS_ENTRADA: '0', IA_TOKENS_FALSOS_SAIDA: '0' }
+  return { IA_LATENCIA_FALSA_MS_PADRAO: '0', IA_TOKENS_FALSOS_ENTRADA: '3000', IA_TOKENS_FALSOS_SAIDA: '0' }
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › as constantes do k6 são as do script
-export const ESCOLAS_DA_SALA = 10
+export const ESCOLAS_DA_SALA = 11
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › as constantes do k6 são as do script
-export const TURMAS_POR_ESCOLA_DA_SALA = 6
+export const TURMAS_POR_ESCOLA_DA_SALA = 5
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › as constantes do k6 são as do script
-export const ALUNOS_POR_ESCOLA_DA_SALA = 60
+export const ALUNOS_POR_ESCOLA_DA_SALA = 61
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › as constantes do k6 são as do script
-export const PROFESSORAS_POR_ESCOLA_DA_SALA = 2
+export const PROFESSORAS_POR_ESCOLA_DA_SALA = 3
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o k6 tem os thresholds por escola
-export const ESPERA_P95_DO_TUTOR_MS = 2_000
+export const ESPERA_P95_DO_TUTOR_MS = 3_000
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o k6 tem os thresholds por escola
-export const ESPERA_P95_DA_FERRAMENTA_MS = 10_000
+export const ESPERA_P95_DA_FERRAMENTA_MS = 12_000
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › escola sem amostra de uma fila
-export const AMOSTRAS_MINIMAS_DA_SALA = 10
+export const AMOSTRAS_MINIMAS_DA_SALA = 5
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o k6 tem os thresholds por escola
-export const ATRASO_DO_KILL_MS = 75_000
+export const ATRASO_DO_KILL_MS = 150_000
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o RSS do `docker stats` vira MiB
-  const fator = { B: 1 / 1_048_576, KiB: 1 / 1_024, MiB: 1, GiB: 1_024 }[achado[2] as 'B' | 'KiB' | 'MiB' | 'GiB']
+  const fator = { B: 1 / 1_048_576, KiB: 1 / 1_024, MiB: 1, GiB: 1_000 }[achado[2] as 'B' | 'KiB' | 'MiB' | 'GiB']
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o RSS do `docker stats` vira MiB
-  const fator = { B: 1 / 1_048_576, KiB: 1 / 1_024, MiB: 1, GiB: 1_024 }[achado[2] as 'B' | 'KiB' | 'MiB' | 'GiB']
+  const fator = { B: 1 / 1_048_576, KiB: 1, MiB: 1, GiB: 1_024 }[achado[2] as 'B' | 'KiB' | 'MiB' | 'GiB']
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o RSS do `docker stats` vira MiB
-  if (achado === null) return undefined
+  if (achado === null) return 0
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o k6 lê o contador das interrompidas
-  if (base.esperaBP95Ms === undefined) reprovacoes.push({ criterio: 'base:espera_b', detalhe: 'base: sem p95 de espera da escola B' })
+  if (false) reprovacoes.push({ criterio: 'base:espera_b', detalhe: 'base: sem p95 de espera da escola B' })
  return { passou: reprovacoes.length === 0, reprovacoes, reprovadoPelaJustica: false }
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o k6 lê o contador das interrompidas
   const reprovacoes: Reprovacao[] = base.cruzados.map(({ metrica, criterio }) => ({ criterio: `base:${metrica}`, detalhe: `base: ${metrica} ${criterio}` }))
-  const saidaEsperada = base.cruzados.length > 0 ? CODIGO_THRESHOLD_CRUZADO : 0
+  const saidaEsperada = 0
```

```mutacao
arquivo: infra/k6/justica-entre-escolas.js
teste: infra/test/carga.test.ts › as constantes do k6 são as do script
-const ESCOLAS_DA_SALA = 10
+const ESCOLAS_DA_SALA = 9
```

```mutacao
arquivo: infra/k6/justica-entre-escolas.js
teste: infra/test/carga.test.ts › as constantes do k6 são as do script
-const ALUNOS_POR_ESCOLA_DA_SALA = 60
+const ALUNOS_POR_ESCOLA_DA_SALA = 30
```

```mutacao
arquivo: infra/k6/justica-entre-escolas.js
teste: infra/test/carga.test.ts › as constantes do k6 são as do script
-const PROFESSORAS_POR_ESCOLA_DA_SALA = 2
+const PROFESSORAS_POR_ESCOLA_DA_SALA = 1
```

```mutacao
arquivo: infra/k6/justica-entre-escolas.js
teste: infra/test/carga.test.ts › a carga é a da tabela de `onda-3a.md`
-const TURNOS_DA_SALA_POR_MINUTO = 45
+const TURNOS_DA_SALA_POR_MINUTO = 30
```

```mutacao
arquivo: infra/k6/justica-entre-escolas.js
teste: infra/test/carga.test.ts › a carga é a da tabela de `onda-3a.md`
-const FERRAMENTAS_DA_SALA_POR_MINUTO = 1
+const FERRAMENTAS_DA_SALA_POR_MINUTO = 2
```

```mutacao
arquivo: infra/k6/justica-entre-escolas.js
teste: infra/test/carga.test.ts › a carga é a da tabela de `onda-3a.md`
-const PROPOSTAS_DA_SALA_POR_MINUTO = 4
+const PROPOSTAS_DA_SALA_POR_MINUTO = 2
```

```mutacao
arquivo: infra/k6/justica-entre-escolas.js
teste: infra/test/carga.test.ts › o k6 tem os thresholds por escola
-const DURACAO_DA_SALA = '3m'
+const DURACAO_DA_SALA = '2m'
```

```mutacao
arquivo: infra/k6/justica-entre-escolas.js
teste: infra/test/carga.test.ts › a carga é a da tabela de `onda-3a.md`
-const PRAZO_DO_TURNO_DA_SALA_MS = 90_000
+const PRAZO_DO_TURNO_DA_SALA_MS = 60_000
```

```mutacao
arquivo: infra/k6/justica-entre-escolas.js
teste: infra/test/carga.test.ts › a carga é a da tabela de `onda-3a.md`
-const PRAZO_DA_FERRAMENTA_DA_SALA_MS = 170_000
+const PRAZO_DA_FERRAMENTA_DA_SALA_MS = 100_000
```

```mutacao
arquivo: infra/k6/justica-entre-escolas.js
teste: infra/test/carga.test.ts › o k6 tem os thresholds por escola
-const TURNO_P95_DA_SALA_MS = 9_000
+const TURNO_P95_DA_SALA_MS = 10_000
```

```mutacao
arquivo: infra/k6/justica-entre-escolas.js
teste: infra/test/carga.test.ts › o k6 tem os thresholds por escola
-const FERRAMENTA_P95_DA_SALA_MS = 61_000
+const FERRAMENTA_P95_DA_SALA_MS = 71_000
```

```mutacao
arquivo: infra/k6/justica-entre-escolas.js
teste: infra/test/carga.test.ts › o k6 tem os thresholds por escola
-    indisponiveis_sala: ['count==0'],
+    indisponiveis_sala: ['count<=1'],
```

```mutacao
arquivo: infra/k6/justica-entre-escolas.js
teste: infra/test/carga.test.ts › o k6 tem os thresholds por escola
-    thresholds[`respostas_429{grupo:${grupo}}`] = ['count==0']
+    thresholds[`respostas_429{grupo:${grupo}}`] = ['count<=1']
```

```mutacao
arquivo: infra/k6/justica-entre-escolas.js
teste: infra/test/carga.test.ts › o k6 tem os thresholds por escola
-    thresholds[`respostas_inesperadas{grupo:${grupo}}`] = ['count==0']
+    thresholds[`respostas_inesperadas{grupo:${grupo}}`] = ['count<=1']
```

```mutacao
arquivo: infra/k6/justica-entre-escolas.js
teste: infra/test/carga.test.ts › o k6 tem os thresholds por escola
-    thresholds[`turnos_sala_concluidos{escola:${escola}}`] = ['count>0']
+    thresholds[`turnos_sala_concluidos{escola:${escola}}`] = ['count>=0']
```

```mutacao
arquivo: infra/k6/justica-entre-escolas.js
teste: infra/test/carga.test.ts › o k6 tem os thresholds por escola
-    thresholds[`ferramentas_sala_concluidas{escola:${escola}}`] = ['count>0']
+    thresholds[`ferramentas_sala_concluidas{escola:${escola}}`] = ['count>=0']
```

```mutacao
arquivo: infra/k6/justica-entre-escolas.js
teste: infra/test/carga.test.ts › o k6 tem os thresholds por escola
-    thresholds[`turno_sala{escola:${escola}}`] = [`p(95)<${TURNO_P95_DA_SALA_MS}`]
+    thresholds[`turno_sala{escola:${escola}}`] = [`p(95)<${TURNO_P95_DA_SALA_MS * 2}`]
```

```mutacao
arquivo: infra/k6/justica-entre-escolas.js
teste: infra/test/carga.test.ts › o k6 tem os thresholds por escola
-    thresholds[`ferramenta_sala{escola:${escola}}`] = [`p(95)<${FERRAMENTA_P95_DA_SALA_MS}`]
+    thresholds[`ferramenta_sala{escola:${escola}}`] = [`p(95)<${FERRAMENTA_P95_DA_SALA_MS * 2}`]
```

```mutacao
arquivo: infra/k6/justica-entre-escolas.js
teste: infra/test/carga.test.ts › o k6 tem os thresholds por escola
-const PASSO_DA_CONSULTA_DA_SALA_S = 1
+const PASSO_DA_CONSULTA_DA_SALA_S = 0.5
```

```mutacao
arquivo: infra/carga.env
teste: infra/test/carga.test.ts › o `LLM_TOKENS_POR_MINUTO` da carga deixa o balde
-LLM_TOKENS_POR_MINUTO=1950000
+LLM_TOKENS_POR_MINUTO=1500000
```

```mutacao
arquivo: infra/carga.env
teste: infra/test/carga.test.ts › o `LLM_TOKENS_POR_MINUTO` da carga deixa o balde
-LLM_TOKENS_POR_MINUTO=1950000
+LLM_TOKENS_POR_MINUTO=3000000
```

```mutacao
arquivo: infra/compose.yml
teste: infra/test/carga.test.ts › o compose passa a latência do `padrao`
-      IA_TOKENS_FALSOS_ENTRADA: ${IA_TOKENS_FALSOS_ENTRADA:?defina IA_TOKENS_FALSOS_ENTRADA}
+      IA_TOKENS_FALSOS_ENTRADA: 3000
```

```mutacao
arquivo: infra/compose.yml
teste: infra/test/carga.test.ts › o compose passa a latência do `padrao`
-      IA_LATENCIA_FALSA_MS_PADRAO: ${IA_LATENCIA_FALSA_MS_PADRAO:?defina IA_LATENCIA_FALSA_MS_PADRAO}
+      IA_LATENCIA_FALSA_MS_PADRAO: 0
```

```mutacao
arquivo: infra/compose.yml
teste: infra/test/carga.test.ts › o compose passa a latência do `padrao`
-      IA_TOKENS_FALSOS_SAIDA: ${IA_TOKENS_FALSOS_SAIDA:?defina IA_TOKENS_FALSOS_SAIDA}
+      IA_TOKENS_FALSOS_SAIDA: 250
```

### Da rodada 1 (a ordem de correção)

Os blocos das cláusulas que a rodada 1 achou sem prova: o resultado da sala pelo banco, o `k6_base`, o contador do k6, a memória em bytes, a configuração do falso junto do provedor, e o SQL de `MEDIDA_DA_SALA`, de `contarExecucoesRodando`, de `falhasDaSala`, de `consumoDaSala` e do rodízio da semente. `j.iniciado_em is not null` das linhas do p95 não tem bloco: o `percentile_cont` ignora o nulo, e a mutação é equivalente (a contagem da mesma cláusula, que a conta, tem.)

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o resultado da sala separa as falhas do banco
-.filter(([erro]) => erro !== 'EXECUCAO_INTERROMPIDA' && erro !== 'IA_INDISPONIVEL')
+.filter(() => false)
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o resultado da sala separa as falhas do banco
-.filter(([erro]) => erro !== 'EXECUCAO_INTERROMPIDA' && erro !== 'IA_INDISPONIVEL')
+.filter(([erro]) => erro !== 'IA_INDISPONIVEL')
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o resultado da sala separa as falhas do banco
-.filter(([erro]) => erro !== 'EXECUCAO_INTERROMPIDA' && erro !== 'IA_INDISPONIVEL')
+.filter(([erro]) => erro !== 'EXECUCAO_INTERROMPIDA')
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o resultado da sala separa as falhas do banco
-indisponiveis: falhas['IA_INDISPONIVEL'] ?? 0,
+indisponiveis: 0,
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o resultado da sala separa as falhas do banco
-indisponiveis: falhas['IA_INDISPONIVEL'] ?? 0,
+indisponiveis: falhas['IA_INDISPONIVEL'] ?? 1,
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o resultado da sala separa as falhas do banco
-interrompidas: k6.interrompidas ?? 0,
+interrompidas: k6.interrompidas ?? 1,
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o resultado da sala separa as falhas do banco
-interrompidas: k6.interrompidas ?? 0,
+interrompidas: 0,
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o resultado da sala separa as falhas do banco
-tetoDeInterrompidas: teto,
+tetoDeInterrompidas: 0,
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o resultado da sala separa as falhas do banco
    indisponiveis: falhas['IA_INDISPONIVEL'] ?? 0,
-    reservasRecusadas,
+    reservasRecusadas: 1,
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › threshold do k6 cruzado reprova com o nome da fase
-const saidaEsperada = resultado.k6.cruzados.length > 0 ? CODIGO_THRESHOLD_CRUZADO : 0
+const saidaEsperada = 0
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › threshold do k6 cruzado reprova com o nome da fase
-const saidaEsperada = resultado.k6.cruzados.length > 0 ? CODIGO_THRESHOLD_CRUZADO : 0
+const saidaEsperada = CODIGO_THRESHOLD_CRUZADO
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o k6 lê o contador das interrompidas do resumo, e a fase `base` sozinha
-if (base.codigo !== saidaEsperada) reprovacoes.push({ criterio: 'k6_base', detalhe: `base: k6 saiu com ${base.codigo}, e o resumo pedia ${saidaEsperada}` })
+if (false) reprovacoes.push({ criterio: 'k6_base', detalhe: `base: k6 saiu com ${base.codigo}, e o resumo pedia ${saidaEsperada}` })
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o contador das interrompidas só é lido quando é número
-interrompidas: typeof interrompidas === 'number' ? interrompidas : undefined,
+interrompidas: interrompidas as number | undefined,
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o RSS do `docker stats` vira MiB
-return Number.isFinite(valor) ? valor * fator : undefined
+return valor * fator
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o RSS do `docker stats` vira MiB
-const fator = { B: 1 / 1_048_576, KiB: 1 / 1_024, MiB: 1, GiB: 1_024 }[achado[2] as 'B' | 'KiB' | 'MiB' | 'GiB']
+const fator = { B: 1, KiB: 1 / 1_024, MiB: 1, GiB: 1_024 }[achado[2] as 'B' | 'KiB' | 'MiB' | 'GiB']
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › as opções do adaptador falso
-if (config.modelo !== undefined) return new OpenAICompatAdapter(config.modelo)
+if (config.modelo !== undefined && config.tokensFalsos === undefined && config.latenciaFalsaMs === undefined) return new OpenAICompatAdapter(config.modelo)
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga-da-manha.int.test.ts › a espera p95 de cada fila da escola
-(select count(*)::int from job_registro j where j.escola_id = e.id and j.tipo = 'ia.executar' and j.fila = 'interativa' and j.iniciado_em is not null and j.criado_em >= $2) as "amostrasDoTutor",
+(select count(*)::int from job_registro j where j.tipo = 'ia.executar' and j.fila = 'interativa' and j.iniciado_em is not null and j.criado_em >= $2) as "amostrasDoTutor",
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga-da-manha.int.test.ts › a espera p95 de cada fila da escola
-(select count(*)::int from job_registro j where j.escola_id = e.id and j.tipo = 'ia.executar' and j.fila = 'interativa' and j.iniciado_em is not null and j.criado_em >= $2) as "amostrasDoTutor",
+(select count(*)::int from job_registro j where j.escola_id = e.id and j.fila = 'interativa' and j.iniciado_em is not null and j.criado_em >= $2) as "amostrasDoTutor",
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga-da-manha.int.test.ts › a espera p95 de cada fila da escola
-(select count(*)::int from job_registro j where j.escola_id = e.id and j.tipo = 'ia.executar' and j.fila = 'interativa' and j.iniciado_em is not null and j.criado_em >= $2) as "amostrasDoTutor",
+(select count(*)::int from job_registro j where j.escola_id = e.id and j.tipo = 'ia.executar' and j.iniciado_em is not null and j.criado_em >= $2) as "amostrasDoTutor",
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga-da-manha.int.test.ts › a espera p95 de cada fila da escola
-(select count(*)::int from job_registro j where j.escola_id = e.id and j.tipo = 'ia.executar' and j.fila = 'interativa' and j.iniciado_em is not null and j.criado_em >= $2) as "amostrasDoTutor",
+(select count(*)::int from job_registro j where j.escola_id = e.id and j.tipo = 'ia.executar' and j.fila = 'interativa' and j.criado_em >= $2) as "amostrasDoTutor",
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga-da-manha.int.test.ts › a espera p95 de cada fila da escola
-(select count(*)::int from job_registro j where j.escola_id = e.id and j.tipo = 'ia.executar' and j.fila = 'interativa' and j.iniciado_em is not null and j.criado_em >= $2) as "amostrasDoTutor",
+(select count(*)::int from job_registro j where j.escola_id = e.id and j.tipo = 'ia.executar' and j.fila = 'interativa' and j.iniciado_em is not null) as "amostrasDoTutor",
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga-da-manha.int.test.ts › a espera p95 de cada fila da escola
-(select count(*)::int from job_registro j where j.escola_id = e.id and j.tipo = 'ia.executar' and j.fila = 'ferramenta' and j.iniciado_em is not null and j.criado_em >= $2) as "amostrasDaFerramenta",
+(select count(*)::int from job_registro j where j.tipo = 'ia.executar' and j.fila = 'ferramenta' and j.iniciado_em is not null and j.criado_em >= $2) as "amostrasDaFerramenta",
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga-da-manha.int.test.ts › a espera p95 de cada fila da escola
-(select count(*)::int from job_registro j where j.escola_id = e.id and j.tipo = 'ia.executar' and j.fila = 'ferramenta' and j.iniciado_em is not null and j.criado_em >= $2) as "amostrasDaFerramenta",
+(select count(*)::int from job_registro j where j.escola_id = e.id and j.fila = 'ferramenta' and j.iniciado_em is not null and j.criado_em >= $2) as "amostrasDaFerramenta",
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga-da-manha.int.test.ts › a espera p95 de cada fila da escola
-(select count(*)::int from job_registro j where j.escola_id = e.id and j.tipo = 'ia.executar' and j.fila = 'ferramenta' and j.iniciado_em is not null and j.criado_em >= $2) as "amostrasDaFerramenta",
+(select count(*)::int from job_registro j where j.escola_id = e.id and j.tipo = 'ia.executar' and j.iniciado_em is not null and j.criado_em >= $2) as "amostrasDaFerramenta",
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga-da-manha.int.test.ts › a espera p95 de cada fila da escola
-(select count(*)::int from job_registro j where j.escola_id = e.id and j.tipo = 'ia.executar' and j.fila = 'ferramenta' and j.iniciado_em is not null and j.criado_em >= $2) as "amostrasDaFerramenta",
+(select count(*)::int from job_registro j where j.escola_id = e.id and j.tipo = 'ia.executar' and j.fila = 'ferramenta' and j.criado_em >= $2) as "amostrasDaFerramenta",
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga-da-manha.int.test.ts › a espera p95 de cada fila da escola
-(select count(*)::int from job_registro j where j.escola_id = e.id and j.tipo = 'ia.executar' and j.fila = 'ferramenta' and j.iniciado_em is not null and j.criado_em >= $2) as "amostrasDaFerramenta",
+(select count(*)::int from job_registro j where j.escola_id = e.id and j.tipo = 'ia.executar' and j.fila = 'ferramenta' and j.iniciado_em is not null) as "amostrasDaFerramenta",
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga-da-manha.int.test.ts › a espera p95 de cada fila da escola
-where j.escola_id = e.id and j.tipo = 'ia.executar' and j.fila = 'interativa' and j.iniciado_em is not null and j.criado_em >= $2) as "esperaDoTutorP95Ms",
+where j.tipo = 'ia.executar' and j.fila = 'interativa' and j.iniciado_em is not null and j.criado_em >= $2) as "esperaDoTutorP95Ms",
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga-da-manha.int.test.ts › a espera p95 de cada fila da escola
-where j.escola_id = e.id and j.tipo = 'ia.executar' and j.fila = 'interativa' and j.iniciado_em is not null and j.criado_em >= $2) as "esperaDoTutorP95Ms",
+where j.escola_id = e.id and j.fila = 'interativa' and j.iniciado_em is not null and j.criado_em >= $2) as "esperaDoTutorP95Ms",
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga-da-manha.int.test.ts › a espera p95 de cada fila da escola
-where j.escola_id = e.id and j.tipo = 'ia.executar' and j.fila = 'interativa' and j.iniciado_em is not null and j.criado_em >= $2) as "esperaDoTutorP95Ms",
+where j.escola_id = e.id and j.tipo = 'ia.executar' and j.iniciado_em is not null and j.criado_em >= $2) as "esperaDoTutorP95Ms",
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga-da-manha.int.test.ts › a espera p95 de cada fila da escola
-where j.escola_id = e.id and j.tipo = 'ia.executar' and j.fila = 'interativa' and j.iniciado_em is not null and j.criado_em >= $2) as "esperaDoTutorP95Ms",
+where j.escola_id = e.id and j.tipo = 'ia.executar' and j.fila = 'interativa' and j.iniciado_em is not null) as "esperaDoTutorP95Ms",
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga-da-manha.int.test.ts › a espera p95 de cada fila da escola
-where j.escola_id = e.id and j.tipo = 'ia.executar' and j.fila = 'ferramenta' and j.iniciado_em is not null and j.criado_em >= $2) as "esperaDaFerramentaP95Ms",
+where j.tipo = 'ia.executar' and j.fila = 'ferramenta' and j.iniciado_em is not null and j.criado_em >= $2) as "esperaDaFerramentaP95Ms",
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga-da-manha.int.test.ts › a espera p95 de cada fila da escola
-where j.escola_id = e.id and j.tipo = 'ia.executar' and j.fila = 'ferramenta' and j.iniciado_em is not null and j.criado_em >= $2) as "esperaDaFerramentaP95Ms",
+where j.escola_id = e.id and j.fila = 'ferramenta' and j.iniciado_em is not null and j.criado_em >= $2) as "esperaDaFerramentaP95Ms",
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga-da-manha.int.test.ts › a espera p95 de cada fila da escola
-where j.escola_id = e.id and j.tipo = 'ia.executar' and j.fila = 'ferramenta' and j.iniciado_em is not null and j.criado_em >= $2) as "esperaDaFerramentaP95Ms",
+where j.escola_id = e.id and j.tipo = 'ia.executar' and j.iniciado_em is not null and j.criado_em >= $2) as "esperaDaFerramentaP95Ms",
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga-da-manha.int.test.ts › a espera p95 de cada fila da escola
-where j.escola_id = e.id and j.tipo = 'ia.executar' and j.fila = 'ferramenta' and j.iniciado_em is not null and j.criado_em >= $2) as "esperaDaFerramentaP95Ms",
+where j.escola_id = e.id and j.tipo = 'ia.executar' and j.fila = 'ferramenta' and j.iniciado_em is not null) as "esperaDaFerramentaP95Ms",
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga-da-manha.int.test.ts › o turno do Tutor é o p95
-where x.escola_id = e.id and x.funcao = 'tutor_com_o_aluno' and x.estado = 'concluida' and x.criada_em >= $2) as "turnoDoTutorP95Ms"
+where x.funcao = 'tutor_com_o_aluno' and x.estado = 'concluida' and x.criada_em >= $2) as "turnoDoTutorP95Ms"
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga-da-manha.int.test.ts › o turno do Tutor é o p95
-where x.escola_id = e.id and x.funcao = 'tutor_com_o_aluno' and x.estado = 'concluida' and x.criada_em >= $2) as "turnoDoTutorP95Ms"
+where x.escola_id = e.id and x.estado = 'concluida' and x.criada_em >= $2) as "turnoDoTutorP95Ms"
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga-da-manha.int.test.ts › o turno do Tutor é o p95
-where x.escola_id = e.id and x.funcao = 'tutor_com_o_aluno' and x.estado = 'concluida' and x.criada_em >= $2) as "turnoDoTutorP95Ms"
+where x.escola_id = e.id and x.funcao = 'tutor_com_o_aluno' and x.criada_em >= $2) as "turnoDoTutorP95Ms"
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga-da-manha.int.test.ts › o turno do Tutor é o p95
-where x.escola_id = e.id and x.funcao = 'tutor_com_o_aluno' and x.estado = 'concluida' and x.criada_em >= $2) as "turnoDoTutorP95Ms"
+where x.escola_id = e.id and x.funcao = 'tutor_com_o_aluno' and x.estado = 'concluida') as "turnoDoTutorP95Ms"
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga-da-manha.int.test.ts › as execuções em `rodando` são o teto do kill -9
-const { rows } = await banco.query<{ n: number }>("select count(*)::int as n from execucao_agente where escola_id = any($1::uuid[]) and estado = 'rodando'", [escolas])
+const { rows } = await banco.query<{ n: number }>("select count(*)::int as n from execucao_agente where estado = 'rodando'", [escolas])
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga-da-manha.int.test.ts › as execuções em `rodando` são o teto do kill -9
-const { rows } = await banco.query<{ n: number }>("select count(*)::int as n from execucao_agente where escola_id = any($1::uuid[]) and estado = 'rodando'", [escolas])
+const { rows } = await banco.query<{ n: number }>("select count(*)::int as n from execucao_agente where escola_id = any($1::uuid[])", [escolas])
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga-da-manha.int.test.ts › as execuções em `rodando` são o teto do kill -9
-"select erro, count(*)::int as n from execucao_agente where escola_id = any($1::uuid[]) and estado = 'falhou' and criada_em >= $2 group by erro",
+"select erro, count(*)::int as n from execucao_agente where estado = 'falhou' and criada_em >= $2 group by erro",
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga-da-manha.int.test.ts › as execuções em `rodando` são o teto do kill -9
-"select erro, count(*)::int as n from execucao_agente where escola_id = any($1::uuid[]) and estado = 'falhou' and criada_em >= $2 group by erro",
+"select erro, count(*)::int as n from execucao_agente where escola_id = any($1::uuid[]) and criada_em >= $2 group by erro",
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga-da-manha.int.test.ts › as execuções em `rodando` são o teto do kill -9
-"select erro, count(*)::int as n from execucao_agente where escola_id = any($1::uuid[]) and estado = 'falhou' and criada_em >= $2 group by erro",
+"select erro, count(*)::int as n from execucao_agente where escola_id = any($1::uuid[]) and estado = 'falhou' group by erro",
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga-da-manha.int.test.ts › o consumo da janela soma
-from consumo_ia where escola_id = any($1::uuid[]) and em >= $2 group by funcao order by funcao`,
+from consumo_ia where em >= $2 group by funcao order by funcao`,
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga-da-manha.int.test.ts › o consumo da janela soma
-from consumo_ia where escola_id = any($1::uuid[]) and em >= $2 group by funcao order by funcao`,
+from consumo_ia where escola_id = any($1::uuid[]) and em >= $2::timestamptz - interval '2 hours' group by funcao order by funcao`,
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga-da-manha.int.test.ts › o consumo da janela soma
-`select funcao, count(*)::int as chamadas, coalesce(sum(tokens_de_entrada + tokens_de_saida), 0) as tokens, coalesce(sum(custo_micros), 0) as custo
+`select funcao, count(*)::int as chamadas, coalesce(sum(tokens_de_entrada), 0) as tokens, coalesce(sum(custo_micros), 0) as custo
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga-da-manha.int.test.ts › o consumo da janela soma
-`select funcao, count(*)::int as chamadas, coalesce(sum(tokens_de_entrada + tokens_de_saida), 0) as tokens, coalesce(sum(custo_micros), 0) as custo
+`select funcao, count(*)::int as chamadas, coalesce(sum(tokens_de_entrada + tokens_de_saida), 0) as tokens, coalesce(max(custo_micros), 0) as custo
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga-da-manha.int.test.ts › o consumo da janela soma
-`select funcao, count(*)::int as chamadas, coalesce(sum(tokens_de_entrada + tokens_de_saida), 0) as tokens, coalesce(sum(custo_micros), 0) as custo
+`select funcao, count(distinct tarefa)::int as chamadas, coalesce(sum(tokens_de_entrada + tokens_de_saida), 0) as tokens, coalesce(sum(custo_micros), 0) as custo
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga-da-manha.int.test.ts › seis turmas com os alunos em rodízio
-select $1, $2, u.id, ($3::uuid[])[1 + ((row_number() over (order by u.id) - 1) % $5::int)::int], 'aluno', 'confirmado', $4, now()
+select $1, $2, u.id, ($3::uuid[])[1 + ((row_number() over (order by u.id) - 1) % ($5::int - 1))::int], 'aluno', 'confirmado', $4, now()
```

## Recomendações sem aplicar

Herdada da tarefa 6.0 (`6_task.md`, "Recomendações sem aplicar"; o destino lá diz 11.0):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| infra-guardian (1ª da 6.0) | Cenário de carga: quem semear `pendente` sem job vê a varredura encerrá-la em até 60 s | `TODO.md` ("Da tarefa 11.0 da reengenharia-continuacao"): na `FASE=sala` a execução semeada seria uma interrompida a mais que o teto das `rodando` não prevê, e reprovaria a fase por algo que ela não prova; o teste de integração da 6.0 já a prova com o relógio |

Da ordem de correção da rodada 1 (`.processo/ordens/11_task-r1.md`, "Sem aplicar", copiada como está; cada linha com destino `TODO.md` está lá, na seção "Da tarefa 11.0 da reengenharia-continuacao"):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| llm-integrator (1ª) | `docs/infra.md`: linha com o custo em reais por professor por mês | `TODO.md`, linha "Custo em reais por professor" (já existe): depende do preço do modelo real, da D37 |
| llm-integrator (1ª) | A premissa de 1 ferramenta por minuto por escola segue sem fonte | `docs/infra.md` já o diz; a fonte vem da medição em escola real (D37); a linha "Escolher o contratado de produção…" do `TODO.md` já a cobre |
| llm-integrator (1ª), infra-guardian (1ª), revisor-geral (1ª), test-engineer (1ª) | A máquina não estava calma; repetir a corrida (e, do `revisor-geral`, rodar o `npm run carga` completo depois da mudança) | `TODO.md`, linha "Repetir a carga da manhã com a máquina calma" (já existe): o `npm run carga` completo é a mesma repetição, e não cabe num ciclo de correção; o Implementador acrescenta a ele a frase "e rodar o `npm run carga` completo, para ver a fase `carga` com o `LLM_TOKENS_POR_MINUTO` de 1.950.000" |
| llm-integrator (1ª) | `llm-config.ts`: o `superRefine` recusar `IA_TOKENS_FALSOS_*` quando `IA_ADAPTADOR` não for `falso` | `TODO.md` (linha nova): muda a validação de configuração; hoje é inofensivo, porque só o falso as lê e ele é vedado em produção |
| privacy-guardian (1ª) | `tokens.json` da sala em pasta 0777 e arquivo 0644: apagar a pasta no `finally` | `TODO.md` (linha nova): comportamento da carga; o compose é descartável e só roda na máquina de desenvolvimento, como a fase de sempre |
| infra-guardian (1ª) | O teto do `kill -9` soma as `rodando` das duas réplicas; separar por réplica | `TODO.md` (linha nova): a divergência já está na tabela ("é a cota superior (e o `kill_sem_efeito` cobre o lado de baixo)"); a contagem por réplica muda o contrato da leitura do banco |
| infra-guardian (1ª) | O serviço `api` recebe `IA_LATENCIA_FALSA_MS` mas não as três variáveis novas: tirar ou passar as três | `TODO.md` (linha nova): é decisão sobre o que a API monta do gateway, e mexe no compose e no `.env` de produção (o item 1 já está no caminho) |
| infra-guardian (1ª) | Espera por conexão do pool sem métrica | `TODO.md`, linha "Métrica de espera por conexão do pool do banco" (já existe) |
| revisor-geral (1ª) | `balde_nao_recusou` passa quando o Prometheus não responde (`undefined`), e o texto diz que a fase "passa quando o balde recusou" | `TODO.md` (linha nova): escolher entre reprovar o "não lido" ou o documento dizer que o critério fica de fora muda o veredito da fase; a corrida de 16/11 leu o número (93), e o registro vale |
| revisor-geral (1ª) | Julgar o limite das interrompidas pelo maior entre o k6 e o banco | `TODO.md` (linha nova): muda o critério `interrompidas_acima_do_teto`; a leitura do banco aparece no relatório |
| revisor-geral (1ª) | Levar a fase `sala` para um módulo próprio, com a montagem compartilhada | `TODO.md` (linha nova): refatoração de ~500 linhas fora do escopo ("`npm run carga` ganha a `FASE=sala`", `Objetivo` desta tarefa) |
| test-engineer (1ª) | Teste de estrutura para `fecharExecucaoDaSala` e a checagem de alunos e professoras por escola (`justica-entre-escolas.js`) | `TODO.md` (linha nova): o k6 não tem teste de unidade hoje; o lado do banco passa a ser coberto pelo item 2 |
| test-engineer (1ª) | `carga.ts` `--so` e `soABase` sem teste; extrair `faseDoArgumento` | `TODO.md` (linha nova): refatoração do `main` do script, fora desta ordem |

Da rodada 2 (`.processo/ordens/11_task-r2.md`, "Sem aplicar", copiada como está; só documento):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| infra-guardian (2ª) | O deploy pela `main` continua parando na interpolação se o passo do `.env` da VPS for esquecido; o deploy compararia o `.env` com as chaves `:?` do `infra/compose.yml` antes do `up` | `TODO.md` (linha nova): é mudança do deploy (D31), com esteira própria; o runbook e o item do `TODO.md` da ordem 1 já cobrem esta variável |
| infra-guardian (2ª) | O teste de banco `carga-da-manha.int.test.ts` não foi rodado por ele (precisa de banco) | Nada a fazer: o test-engineer o rodou (6 verdes) e o portão da tarefa o roda |
| llm-integrator (2ª) | O `superRefine` de `llm-config.ts` para recusar `IA_TOKENS_FALSOS_*` e `IA_LATENCIA_FALSA_MS_PADRAO` fora do `falso`; a `api` com `IA_LATENCIA_FALSA_MS` sem as outras; a premissa de 1 ferramenta por minuto sem fonte | `TODO.md`: as três já têm linha da rodada 1 |
| privacy-guardian (2ª) | Quando o `superRefine` for feito, a recusa precisa aceitar o `0` (o runbook manda pôr as três em `0` na VPS) ou o runbook muda junto; senão o deploy para outra vez | `TODO.md`: acrescentar esta frase à linha do `superRefine` (a da rodada 1) |
| privacy-guardian (2ª) | `tokens.json` da sala em pasta 0777 e arquivo 0644, antes de a fase rodar em máquina compartilhada | `TODO.md`: já tem linha da rodada 1 |
| conformidade-reviewer (2ª) | `11_task.md`, linha "custo de base por professor" de "A corrida": a mesma frase do `TODO.md` (unidade agregada das 20 professoras sintéticas, nunca indicador por professor) | `TODO.md`: a frase já está na linha "Custo em reais por professor", que é onde o custo em reais entra com a D37; o número da 11.4 sai do relatório de 16/11/2026, que fica como está |
| revisor-geral (2ª) | `TODO.md`: as etiquetas "ordem 1" das linhas novas vêm de itens diferentes (o do `stalled` é o item 11; o do `test-engineer`, o item 2); trocar por "rodada 1, item N" | `TODO.md` (a própria linha): só o texto da etiqueta |
| revisor-geral (2ª), test-engineer (2ª) | `llm-gateway.test.ts`, caso "as opções do adaptador falso … não chegam a ele": o `expect(performance.now() - inicio).toBeLessThan(1_500)` mede o relógio da máquina; o prazo da configuração (`IA_TEMPO_ESGOTADO`) já prova a ausência da espera de 60 s | `TODO.md` (linha nova): é arquivo de teste, e mexer nele caduca o `test-engineer` e o `revisor-geral` já aprovados; a prova real (`origem: 'openai_compat'`, tokens 1.234 e 56) não depende dele |
| revisor-geral (2ª) | `carga-da-manha.int.test.ts`, `inserirJob` e `execucaoDaEscola`: o `clock_timestamp()` é avaliado mais de uma vez na instrução; calcular `criadoEm` uma vez | `TODO.md` (linha nova): o `Math.round` do teste absorve a diferença; é limpeza de teste |
| test-engineer (2ª) | `lerASala` fora da lista das funções que só a corrida usa (`11_task.md:81`, ao lado de `executarASala`, `amostrarASala` e `telemetriaDaSala`): escrever a isenção | `TODO.md` (linha nova): é texto da autoconferência do documento; `lerASala` só liga as peças, e a corrida de 16/11 é a prova dele |
| test-engineer (2ª) | `julgarSoABase` (`carga.ts:712`): a linha do `saidaEsperada` não tem bloco, iguais aos de `julgarSala` | `TODO.md` (linha nova): os casos de 107 e de zero com um cruzado já derrubam as duas mutações; falta só o bloco do documento |
| test-engineer (2ª) | `medirEscolasDaSala`: bloco que troque o `rows.find(...)` por `rows[indice]` (a função não mudou nesta rodada) | `TODO.md` (linha nova): cobertura extra de função que o diff da rodada não alterou |

Da autoconferência:

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| (autoconferência) | Métrica de espera por conexão do pool; repetir a carga com a máquina calma; escolher o contratado de produção entre os dois pisos; o custo em reais por professor | `TODO.md`, as linhas de "Da tarefa 11.0 da reengenharia-continuacao" |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-16 20:47:11 | 2026-11-16 20:47:41 | `llm-integrator` | 1 | APROVADO | abab8bcafcf89a6dc |
| 2026-11-16 20:47:18 | 2026-11-16 20:47:44 | `tenancy-guardian` | 1 | APROVADO | aae491be1af07b61a |
| 2026-11-16 20:47:22 | 2026-11-16 20:48:00 | `conformidade-reviewer` | 1 | APROVADO | aaa615468f92c5b27 |
| 2026-11-16 20:47:20 | 2026-11-16 20:48:07 | `privacy-guardian` | 1 | APROVADO | a87865156aeb0c2cc |
| 2026-11-16 20:47:09 | 2026-11-16 20:48:40 | `infra-guardian` | 1 | REPROVADO | aadf48734b4dd6752 |
| 2026-11-16 20:47:16 | 2026-11-16 20:49:51 | `revisor-geral` | 1 | APROVADO | aae37121fe5d7f51a |
| 2026-11-16 20:47:13 | 2026-11-16 20:50:06 | `test-engineer` | 1 | REPROVADO | aea045bc37d27195b |
| 2026-11-16 21:15:09 | 2026-11-16 21:15:41 | `infra-guardian` | 2 | APROVADO | a008a75491d3d7e31 |
| 2026-11-16 21:15:24 | 2026-11-16 21:15:47 | `llm-integrator` | 2 | APROVADO | abfa740e652c05cc9 |
| 2026-11-16 21:15:35 | 2026-11-16 21:16:00 | `tenancy-guardian` | 2 | APROVADO | a9b0914fee59bda5d |
| 2026-11-16 21:15:40 | 2026-11-16 21:16:08 | `privacy-guardian` | 2 | APROVADO | a70dc8db5e3b77980 |
| 2026-11-16 21:15:45 | 2026-11-16 21:16:12 | `conformidade-reviewer` | 2 | APROVADO | a1f18e21754b73f7b |
| 2026-11-16 21:15:29 | 2026-11-16 21:16:35 | `revisor-geral` | 2 | APROVADO | a598e35e4668f9a09 |
| 2026-11-16 21:15:19 | 2026-11-16 21:17:31 | `test-engineer` | 2 | APROVADO | a7192ffc4c7901bf3 |
