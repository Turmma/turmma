# Correção — o job `integração` da esteira é cancelado no teto de 30 min, e a integração vira três fatias

**Origem:** esteira run 44887365743 em `21e6186` (branch `spec/camada-ia`): o job "integração (Postgres, Redis, storage)" foi cancelado pelo `timeout-minutes: 30` (`.github/workflows/ci.yml`), sem teste vermelho.
**Subagentes obrigatórios:** `infra-guardian`, `revisor-geral`, `test-engineer`, `privacy-guardian`
<!-- Os três primeiros vieram no PEDIDO do Orquestrador; `revisor-geral` também por tocar `.github/` e `tools/ci/` (passo 5 de `corrigir`). `privacy-guardian` vem do caminho: `.github/` o liga (`tools/processo/guardioes-por-caminho.ts`). -->

## Sintoma

O job começou às 08:59:05 e foi cancelado às 09:29:18 (30 min), no passo `npm run ci:integracao` (iniciado às 09:00:02), sem teste vermelho: 194 dos 206 arquivos `*.int.test.ts` já tinham terminado verdes (o último às 29,1 min).
`tools/processo/esteira.ts` lê a execução cancelada sem push novo como vermelha. Nas verdes anteriores o job levou 22, 28,5 e 28,3 min: o teto de 30 min (que já tinha subido de 20 depois da execução 41775656221) deixou de ter folga.

## Fora desta correção

Nada: a árvore estava limpa.

## Causa

**A suíte de integração cresce a cada tarefa, num job único e sem fatias, e o teto de 30 min passou a ficar a 5 a 25% da duração real.** Ela é a única suíte da esteira que ainda roda inteira num runner só: a unidade (2 fatias),
a infra (3) e o e2e (11) já foram repartidas pelo mesmo motivo (`2026-11-16-teto-do-verificar-na-esteira`, `2026-11-12-job-de-infra-passa-de-45-min`, `2026-10-03-e2e-em-fatias`). O projeto roda um arquivo por vez (`fileParallelism: false`, porque os testes
param e religam serviços), então o tempo é a soma dos arquivos: do log da execução cancelada, 194 arquivos terminados em 29,1 min, 50 s do primeiro após a subida do compose, e os maiores são `rate-limit.int.test.ts` (144 s),
`password-attack.int.test.ts` (93 s) e `job-execution.int.test.ts` (68 s). A soma estimada dos 206 é de uns 31 min.

Subir o `timeout-minutes` só adia, e foi o que se fez de 20 para 30 min; a saída que a esteira já adotou três vezes é repartir.

Repartição medida (hash sha1 do caminho, como o Vitest, com a duração de cada arquivo do log; os 12 que não terminaram entram com a média de 9 s):

| Fatias | Minutos de teste por fatia |
|---|---|
| 2 | 17,0 e 13,9 |
| 3 | 9,4, 11,3 e 10,2 |
| 4 | 6,1, 10,9, 6,1 e 7,8 |

Quatro fatias não baixam a mais longa (o `rate-limit` e o `password-attack` caem juntos), e custam um runner a mais: três é o ponto.

## Teste que reproduz

`tools/ci/esteira.test.ts › a integração roda em fatias que não se cancelam, e cada uma tem teto abaixo dos 30 min do job único: a folga vem de repartir, não do número`, `› tem os jobs verificar, unidade, integracao, infra e e2e, e cada um só chama npm ci e o seu npm run ci:*`
e `tools/ci/scripts.test.ts › ci:integracao leva a fatia da esteira ao Vitest, e fatia malformada reprova antes de subir o compose`.
Rodados contra o `ci.yml`, o `integracao.ts` e o `executar.ts` do HEAD, os três falharam (`expected 1 to be greater than 1`, `expected [ 'npm ci', 'npm run ci:integracao' ] to deeply equal …`,
`expected [ … ] to include 'npm run test:integracao -- --shard=2/3'`); com a correção, os 53 casos dos dois arquivos passam.

## Correção

A integração vira um job em fatias, como a infra, e o teto de cada uma é de 25 min (a de antes era de 30 para a suíte inteira):

- `.github/workflows/ci.yml`: matriz `fatia: [1, 2, 3]` com `fail-fast: false`, `name` com `${{ matrix.fatia }}/3`, passo `npm run ci:integracao -- --shard=${{ matrix.fatia }}/3` e `timeout-minutes: 25` por fatia. Comentário com a medida e a
  regra de acrescentar fatia, e não subir o número. Nenhum teste saiu: a soma dos arquivos das três fatias é a dos 206.
- `tools/ci/integracao.ts`: passa a fatia lida dos argumentos a `executarTestesComInfra` (que já a aceitava, por causa da infra), com a mesma leitura estrita (`fatiaDosArgumentosDoVitest`), e sem fatia roda o projeto inteiro (o `npm run ci:integracao` da máquina).
- `tools/ci/executar.ts`: a leitura da fatia aceita `'integracao'` no nome da suíte (só a mensagem do erro).
- `tools/ci/esteira.test.ts` e `tools/ci/scripts.test.ts`: os testes acima, mais a guarda de que a matriz, o `name` e o `--shard` concordam, e de que o teto de cada fatia fica abaixo dos 30 min do job único.
- `README.md`, `docs/runbook.md` (seção "Esteira vermelha na integração") e o comentário de `compose.ts`.

O portão da tarefa não muda: ele roda `npx vitest run --project integracao <arquivos>` só nos arquivos alterados, e o `ci:integracao` sem fatia é o mesmo comando.
Medido na máquina: a fatia 2/3 (`npm run ci:integracao -- --shard=2/3`, com o compose subindo e descendo) passou inteira, 66 arquivos e 1434 testes verdes, em 9 min 55 s (591 s de Vitest): prova que a fatia roda sozinha, com o banco vazio. Os nomes dos jobs mudaram (`integração 1/3 (Postgres, Redis, storage)` e as outras duas): `tools/processo/esteira.ts` não depende do nome.

## Mutações

--faltando: 0 linhas (0 blocos, 0 motivos)

Nenhuma linha nova de código de `tools/` com condição: `integracao.ts` só chama `fatiaDosArgumentosDoVitest`, que já tem a sua prova na infra e na unidade, e o diff de `executar.ts` é a união de tipo e o comentário.
Os testes acima provam a repartição de fato (sem fatia, sem `--shard`; com fatia, o `--shard=<i>/3` depois do `up` e antes do `down`).

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| infra-guardian (1ª), test-engineer (1ª) | Só a fatia 2/3 foi provada sozinha; ler as três fatias verdes no push antes de dar a correção por fechada | Não é código: o Orquestrador lê a esteira depois do push e, se uma fatia ficar vermelha, a correção é no isolamento do arquivo (runbook) |
| infra-guardian (1ª) | Se a branch protection exigir o check pelo nome antigo, atualizar para `integração 1/3`, `2/3` e `3/3` | Fora do repositório: o Joaquim confere a regra no GitHub; o Orquestrador leva o aviso no pouso |
| revisor-geral (1ª), infra-guardian (1ª), test-engineer (1ª) | O limite de "12 min de teste numa fatia" não tem aviso automático | `TODO.md`, item M7 (X6, retro), que a correção já atualizou para incluir a integração |
| revisor-geral (2ª) | `docs/runbook.md:2037`: tirar o aviso do log público do parêntese e escrevê-lo como frase própria, porque a linha já era longa | Recusada: é forma, não comportamento, e o revisor aprovou sem bloqueante; o `privacy-guardian` (2ª) leu o texto como o aviso que ele recomendou, com a regra 20, item 17. Recomendação de revisor que não reprovou só entra na primeira ordem do documento |
| Implementador | O item "(X6, retro, M7)" do `TODO.md` (o `/N` do nome derivado do tamanho da matriz e o aviso "perto do teto" no resumo dos `ci:*`) fica aberto: ele pede mudança em `tools/ci/` própria, junto da M4 da F4, e a integração entra na lista dos jobs com matriz. | `TODO.md`, item M7 |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-21 08:25:05 | 2026-11-21 08:25:29 | `privacy-guardian` | 1 | APROVADO | a2abb6c2a3a8dc57b |
| 2026-11-21 08:25:02 | 2026-11-21 08:25:39 | `revisor-geral` | 1 | APROVADO | a0e3888916761c6b8 |
| 2026-11-21 08:25:00 | 2026-11-21 08:25:49 | `infra-guardian` | 1 | APROVADO | a3caf6712b8e785f0 |
| 2026-11-21 08:25:03 | 2026-11-21 08:26:04 | `test-engineer` | 1 | APROVADO | a2a99a28ebedc737b |
| 2026-11-21 08:35:44 | 2026-11-21 08:36:00 | `revisor-geral` | 2 | APROVADO | ae0d17c3a3d1909cf |
| 2026-11-21 08:35:36 | 2026-11-21 08:36:13 | `infra-guardian` | 2 | APROVADO | a285a4af2d6a50802 |
| 2026-11-21 08:35:58 | 2026-11-21 08:36:13 | `privacy-guardian` | 2 | APROVADO | ae4bbcb311929c6f8 |
| 2026-11-21 08:35:51 | 2026-11-21 08:36:32 | `test-engineer` | 2 | APROVADO | abe4f15e1b01f12e8 |
