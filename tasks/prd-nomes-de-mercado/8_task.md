# Tarefa 8.0 — Onda do worker, do despachante, do realtime e do apoio de teste do back (linha back)

**Funcionalidade:** nomes-de-mercado · **Depende de:** 7.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `test-engineer`, `revisor-geral`
**Porte:** grande

## Objetivo

Os símbolos técnicos do worker (`JobProcessor`, `JobSchedule`, `JobExecutor`), do despachante, do realtime e do apoio de
teste de `apps/api/test/` (`SessaoFixtures` e os outros `Bancada…`) passam ao nome de mercado. O nome de fila, de
métrica e de evento de log, e o texto dos casos, ficam como estão.

## Contexto necessário

- `tasks.md`, "O procedimento de cada onda" (o mapa leva `"linha": true`)
- `techspec.md` §5, §7c (a linha) e §10
- `prd.md` RF3, RF6 e RF7
- `inventario-back.md`: as linhas com caminho em `apps/worker/`, `apps/despachante/`, `apps/realtime/` e
  `apps/api/test/`, mais "Não muda, mas parece". As linhas desses caminhos em `inventario-adenda-2.md`
- `inventario.md` §1 (`Bancada<X>` vira `<X>Fixtures`) e §3 (`@educa/despachante` fica)
- `.claude/rules/80-infra-e-carga.md`: fila, métrica e evento são strings que o painel lê

## Subtarefas

- [x] 8.1 — O mapa `tools/renomear/mapas/8.json`, com `"linha": true`
- [x] 8.2 — O `aplicar` e a classificação. A classe muda, e a string do nome da fila fica
- [x] 8.3 — As travas: o `travas.md` não lista nenhuma desta onda. A ocorrência `trava` que o relatório achar ganha
  linha no `travas.md` e bloco de mutação aqui
- [x] 8.4 — O `conferir` e o `restos`. A busca dos nomes antigos em `apps/` e `e2e/`
- [x] 8.5 — A seção "Mutações"

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/worker/`, `apps/despachante/`, `apps/realtime/` | alterado |
| `apps/api/test/`, `apps/api/src/` | alterado |
| `infra/test/`, `infra/scripts/` | alterado |
| `infra/compose.yml` | alterado (só o comentário da linha 380, que cita `GRACA_DO_DESLIGAMENTO_MS`; `travas.md:170`) |
| `tools/renomear/mapas/8.json`, `tools/renomear/mapas/8.relatorio.md` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| `conferir` | ferramenta | só nome, os mesmos casos (RF7) | |
| `restos` | ferramenta | nada sobra em código | |
| esteira | esteira | verde na esteira da spec, depois do encontro | |
| fila, métrica e evento de log | `conferir` | as strings são as mesmas | |
| `@educa/despachante` e `apps/despachante` | diff | intactos | |
| `Bancada…` e `…-de-teste` | `restos` | zero | |
| texto de `describe`, `it` e `test` | `conferir` | igual (RF6) | |
| `this.name` de `JobFailureError`, A (`travas.md:169`) | mutação | com o nome antigo, ficam vermelhos os dois testes do expurgo, que esperam `name: 'JobFailureError'` da rejeição | `expurgo-da-escola.int.test.ts › permissão: a rotina só roda como rotina do sistema, e o job da escola só no contexto de uma escola` e `expurgo-de-acesso.int.test.ts › permissão: só a rotina do sistema expurga; um job de escola com esse tipo falha sem apagar nada` |
| `this.name` de `QueueFacingError` e `QueueTimeoutError`, C (`travas.md:169`) | mutação | `restos` acusa o nome antigo na string | `restos.test.ts › a árvore não tem resto dos mapas aplicados` |
| `Symbol('…')` dos cinco tokens do realtime, C (`travas.md:168`) | mutação | `restos` acusa a descrição no nome antigo; nenhum teste lê a descrição | `restos.test.ts › a árvore não tem resto dos mapas aplicados` |
| comentário de `infra/compose.yml:380`, C (`travas.md:170`) | mutação | `restos` acusa `GRACA_DO_DESLIGAMENTO_MS` no comentário | `restos.test.ts › a árvore não tem resto dos mapas aplicados` |

## Como testar

- O worker: `npx vitest run --project integracao apps/worker/test/`. O sandbox:
  `npx vitest run --project infra infra/test/jobs.int.test.ts`.
- O apoio de teste é importado por `apps/worker/test/`, `apps/realtime/test/` e `infra/test/`: o `aplicar` os alcança
  pelo `tsconfig` de cada um, e eles estão nos previstos.
- O nome da fila é string (`interativa`, `normal`, `lote`). Se a classe e a fila tiverem o mesmo texto, a fila é `fica`.
- A 7.0 já trouxe, nos três apps: o `AppModule.forRoot(` do `main.ts` e do `configure-app.ts`, e o `esquemaAmbiente` →
  `envSchema` do `config.ts` (triagem da 7.0). Eles não entram no `8.json`: o `aplicar` recusa `de` que não existe. O
  `lerConfiguracao` → `loadConfig` desses três apps é desta onda (`inventario-back.md:329`); a 7.0 o deixou como `fica`.
- Ao fechar, a linha não espera a esteira (Tech Spec §7c).

## Autoconferência

As 12 perguntas do modelo, no plano. Na 1: o relatório achou doze ocorrências `trava`, em três linhas do `travas.md` (168 a 170), e cada uma tem o seu bloco em "Mutações".

## Fora do escopo desta tarefa

A api fora de `apps/api/test/` (7.0, salvo o uso que o rename arrasta), e os documentos (13.0).

## Divergências resolvidas nesta tarefa

- **Resolvida em 31/10/2026 pela triagem do Arquiteto (detalhe não previsto), com a correção `mapa-de-repetido-entre-pacotes`.** A
  Tech Spec §5 passou a deixar o `de` de símbolo se repetir quando os dois `arquivo` caem em pacotes diferentes, e no passo 5
  (comentário e documento) esse `de` vai inteiro para a troca à mão. O `8.json` ganhou a 2ª entrada, `OpcoesDaMontagem` →
  `CreateOutboxRelayOptions` com `arquivo` `apps/despachante/src/composition.ts` (`inventario-back.md:321`), aplicada sobre a árvore
  (o `aplicar` só aceita a entrada que ainda existe: rodou-se um mapa provisório só com ela, e o relatório ganhou a contagem).
  O alias `OpcoesDoDespachante` de `apps/worker/test/queue.fixture.ts` saiu. Em `apps/` o nome antigo não aparece em comentário.
  O texto da divergência como foi enviada, superado pelo que está acima:
  >
  > **Aberta, enviada ao Orquestrador em 31/10/2026 (`Motivo: desenho`).** `OpcoesDaMontagem` é declarado em
  > `apps/worker/src/composition.ts` (→ `CreateWorkerOptions`, `inventario-back.md:316`) e em
  > `apps/despachante/src/composition.ts` (→ `CreateOutboxRelayOptions`, `inventario-back.md:321`). A Tech Spec §5 manda o
  > `aplicar` recusar o mapa se o `de` se repete, e o `validarMapa` (`tools/renomear/mapa.ts`) chaveia só por `de`: com as duas
  > entradas no mapa a recusa é `de-repetido` (conferido); com uma entrada só, sem `arquivo`, o `conferir` daria o mesmo destino
  > aos dois pacotes. O `aplicar` (que acha a declaração por `arquivo`) e o `conferir` (que segue a entrada com `arquivo` só no
  > pacote dele) já separam os dois: só a recusa não separa. O nome exportado não tem exceção no `conferir`, então trocar o do
  > despachante à mão deixaria a onda vermelha. Estado da árvore: a onda aplicada, menos o despachante. Falta trocar
  > `OpcoesDaMontagem` em `apps/despachante/src/composition.ts` (linhas 33 e 85) e o alias `OpcoesDoDespachante` de
  > `apps/worker/test/queue.fixture.ts` (33 e 282, que passa a importar `CreateOutboxRelayOptions` sem alias). As trocas à mão
  > da onda estão em `.processo/8-trocas-a-mao.sh`.
- 2026-10-31, `infra/compose.yml:380`: o comentário cita a constante `GRACA_DO_DESLIGAMENTO_MS`, que vira `SHUTDOWN_GRACE_MS`. O
  arquivo não estava nos previstos (`travas.md` não listava nenhuma trava desta onda). Entra nomeado, pela triagem da 7.0 (Tech
  Spec §5, "o comentário de uma linha só"), com a linha 170 do `travas.md`. O `docker compose config` sai igual.
- 2026-10-31, `inventario-back.md:368` × `:566` e `:574`: a tabela renomeia `publicarComVaga` → `publishWithSlot`, e "Não muda,
  mas parece" e "Examinados e mantidos" o citam como helper que fica. Vale a tabela (a linha é um item do inventário, e o
  critério de pronto manda zerar o nome antigo de todos); as duas listas citam o nome sem ter olhado a linha 368.
- 2026-10-31, homônimos: `LinhaDeAuditoria` local de `lista.int.test.ts` e de `eliminar-titular.int.test.ts` (declaração dentro
  de função, `inventario-adenda-2.md:21`), `LinhaDoMaterial` da web (10.0) e `ConviteDeTeste` de `e2e/support/seed.ts` (11.0) são
  declarações de outro arquivo, de outro tipo, e ficam como `fica`. `LinhaDoAcesso`, `configuracaoDeTeste`, `RotaRegistrada` e
  `lerConfiguracao` entram sem `arquivo`: os homônimos têm o mesmo destino e estão nos previstos.

## Mutações

Um bloco por trava (Tech Spec §10), na forma da coluna do `travas.md`. Nenhum caso entra (RF7). O relatório (`8.relatorio.md`) classifica
12 ocorrências como `trava`, nas três linhas que o `travas.md` lista para esta onda (168, 169 e 170); cada uma tem o bloco abaixo. O resto da
onda é rename de símbolo, sem condição nova: o `--faltando` lista linhas de produção com condição que o rename só reescreveu (`JobFailureError`,
`QueueFacingError` e afins), todas já existentes.

**O `this.name` de `JobFailureError`** (`travas.md:169`, forma A). Com o nome antigo na string, a rejeição do job deixa de ter `name: 'JobFailureError'`,
e os dois testes do expurgo, que esperam esse `name` (`expurgo-da-escola.int.test.ts:1208` e `:1213`, `expurgo-de-acesso.int.test.ts:814`), ficam
vermelhos. Um bloco por teste.

```mutacao
arquivo: apps/worker/src/job-failure.error.ts
teste: apps/worker/test/expurgo-da-escola.int.test.ts › permissão: a rotina só roda como rotina do sistema, e o job da escola só no contexto de uma escola
-    this.name = 'JobFailureError'
+    this.name = 'FalhaDeJob'
```

```mutacao
arquivo: apps/worker/src/job-failure.error.ts
teste: apps/worker/test/expurgo-de-acesso.int.test.ts › permissão: só a rotina do sistema expurga; um job de escola com esse tipo falha sem apagar nada
-    this.name = 'JobFailureError'
+    this.name = 'FalhaDeJob'
```

**O `this.name` de `QueueFacingError` e de `QueueTimeoutError`** (`travas.md:169`, forma C). Nenhum teste lê o nome dessas duas classes; com o nome
antigo na string, o `restos` acusa.

```mutacao
arquivo: apps/worker/src/job-executor.ts
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-  override readonly name = 'QueueFacingError'
+  override readonly name = 'ErroParaAFila'
```

```mutacao
arquivo: apps/despachante/src/job-publisher.ts
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-  override readonly name = 'QueueTimeoutError'
+  override readonly name = 'PrazoDaFilaEsgotado'
```

**A descrição de `Symbol('…')` dos cinco tokens de DI do realtime** (`travas.md:168`, forma C). Nenhum teste lê a descrição; com o nome antigo, o
`restos` acusa. Um bloco por token.

```mutacao
arquivo: apps/realtime/src/app.module.ts
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-export const REALTIME_REDIS_CLIENT = Symbol('REALTIME_REDIS_CLIENT')
+export const REALTIME_REDIS_CLIENT = Symbol('CLIENTE_REDIS_REALTIME')
```

```mutacao
arquivo: apps/realtime/src/app.module.ts
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-export const REALTIME_DB_POOL = Symbol('REALTIME_DB_POOL')
+export const REALTIME_DB_POOL = Symbol('POOL_BANCO_REALTIME')
```

```mutacao
arquivo: apps/realtime/src/system.gateway.ts
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-export const IDENTITY_CONFIG = Symbol('IDENTITY_CONFIG')
+export const IDENTITY_CONFIG = Symbol('CONFIGURACAO_IDENTIDADE')
```

```mutacao
arquivo: apps/realtime/src/system.gateway.ts
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-export const SESSAO_READER = Symbol('SESSAO_READER')
+export const SESSAO_READER = Symbol('LEITURA_DE_SESSAO')
```

```mutacao
arquivo: apps/realtime/src/system.gateway.ts
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-export const REALTIME_LOGGER = Symbol('REALTIME_LOGGER')
+export const REALTIME_LOGGER = Symbol('LOGGER_REALTIME')
```

**O comentário de `infra/compose.yml:380`** (`travas.md:170`, forma C). Com a constante no nome antigo, o `restos` acusa; o `docker compose config` não
muda, porque o comentário não entra na saída.

```mutacao
arquivo: infra/compose.yml
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-    # Acima dos 20 s de graça do worker.close() (`SHUTDOWN_GRACE_MS`, com a folga de `interromper()` e do fim do processo): o
+    # Acima dos 20 s de graça do worker.close() (`GRACA_DO_DESLIGAMENTO_MS`, com a folga de `interromper()` e do fim do processo): o
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| `test-engineer` 1ª | A coluna "Caso" vazia em todas as linhas antigas da tabela de testes | Recusada: a 7.0 a deixa vazia pelo mesmo desenho, e nenhum RF pede o nome do caso nessas linhas. As linhas novas citam o caso |
| `revisor-geral` 1ª | As listas "Não muda, mas parece" (`inventario-back.md:566`) e "Examinados e mantidos" (`:574`) citam `publicarComVaga` como `fica`, e a tabela (`:368`) o renomeia | 13.0 (documentos), ou correção do Arquiteto; a divergência já está resolvida a favor da tabela na seção "Divergências resolvidas" |
| `privacy-guardian` 1ª | `TODO.md:337` ainda cita `FalhaDeJob` | 13.0 (documentos) |
| `infra-guardian` 1ª | `TODO.md:337` e o campo `erro.tipo` do log passou a mostrar `JobFailureError`, `QueueFacingError` e `QueueTimeoutError`: uma linha no runbook | 13.0 (documentos); o efeito é só na busca de log antigo pelo nome antigo, e nenhum alerta ou painel do repositório lê o valor |
| `privacy-guardian` 1ª | Painel de observabilidade fora do repositório que filtre pelos nomes antigos de erro | Operação da VM, fora desta tarefa; entra no runbook da 13.0 junto com a linha acima |
| `conformidade-reviewer` 1ª | O mesmo aviso sobre painel e alerta que filtre pelo `name` do erro | O mesmo destino: 13.0 |
| `privacy-guardian` 1ª | `LinhaDeAuditoria` local de `lista.int.test.ts:136` sobrou com o nome antigo | Sem ação: é `fica` por `inventario-adenda-2.md:21` (declaração dentro de função) |
| `test-engineer` 2ª | O texto da linha 169 do `travas.md` descreve a trava só pelos nomes antigos (`FalhaDeJob`, `ErroParaAFila`, `PrazoDaFilaEsgotado`); citar também o nome novo ajudaria a busca | 13.0 (documentos). Está coerente: descreve o que a trava lê |
| `test-engineer` 2ª | O token `SESSAO_READER` continua com nome meio em português e meio em inglês | Decisão do inventário, não desta tarefa; fica para a retro |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-10-31 14:41:38 | 2026-10-31 14:42:54 | `conformidade-reviewer` | 1 | APROVADO | a676050dccbbd5479 |
| 2026-10-31 14:41:29 | 2026-10-31 14:42:55 | `tenancy-guardian` | 1 | APROVADO | aea37bdd27c275c57 |
| 2026-10-31 14:41:33 | 2026-10-31 14:43:45 | `privacy-guardian` | 1 | APROVADO | a978785cea7733eb0 |
| 2026-10-31 14:41:47 | 2026-10-31 14:45:16 | `test-engineer` | 1 | REPROVADO | ae8af294467212af3 |
| 2026-10-31 14:41:52 | 2026-10-31 14:45:46 | `revisor-geral` | 1 | REPROVADO | a9b96a88ce29e415a |
| 2026-10-31 14:41:42 | 2026-10-31 14:48:26 | `infra-guardian` | 1 | APROVADO | ab903e91a3c955a4c |
| 2026-10-31 15:48:21 | 2026-10-31 15:49:00 | `test-engineer` | 2 | APROVADO | a3d170399ee5ad988 |
| 2026-10-31 15:48:28 | 2026-10-31 15:49:07 | `revisor-geral` | 2 | APROVADO | aaa05f37be1c45268 |
