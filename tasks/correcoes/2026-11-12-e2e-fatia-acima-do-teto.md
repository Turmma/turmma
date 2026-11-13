# Correção — com `e2e/material-licencas.spec.ts` (12 casos) a suíte do e2e vai a 1974 e cada uma das 10 fatias passa do teto de 197 casos

**Origem:** portão da 6.0 de `ingestao-do-material` (linha 1), no teste `tools/ci/esteira.test.ts › o teto do e2e cobre a suíte que existe`; pedido do Orquestrador em 12/11/2026, com o remédio do `docs/runbook.md`, "Esteira vermelha no e2e", e o precedente de `tasks/correcoes/2026-11-08-e2e-decima-fatia.md`.
**Subagentes obrigatórios:** `infra-guardian`, `privacy-guardian`, `revisor-geral`
<!-- `infra-guardian` veio no PEDIDO do Orquestrador. `revisor-geral` entra porque a correção toca `.github/` (`ci.yml`) e `tools/processo/` (`esteira.ts`), regra do passo 5 de `corrigir`. `privacy-guardian` entra por caminho: `tools/processo/guardioes-por-caminho.ts` pede `infra-guardian` e `privacy-guardian` para `.github/`. test-engineer é obrigatório em toda correção, marcado ou não. A correção não toca `apps/` nem `packages/`. -->

## Sintoma

Com o spec da 6.0 na árvore, a suíte do Playwright passa de 1962 casos commitados para 1974 (`npx playwright test --list`, dois projetos; `e2e/material-licencas.spec.ts` tem 12, 6 em cada projeto), e o teste do teto fica vermelho:

```
tools/ci/esteira.test.ts › o teto do e2e cobre a suíte que existe, fatia a fatia e com folga
  a fatia 1 de 10 do e2e tem 198 casos, uns 28 min no runner, e o teto do job é de 45 min: passa de 60% dele ...
  expected 28 to be less than or equal to 27
```

## Fora desta correção

Os arquivos da 6.0 de `ingestao-do-material` ficam na árvore e não entram na revisão nem no commit desta correção:

```
apps/web/src/areas/coordenacao/comum/endereco-da-tela.ts
apps/web/src/areas/coordenacao/material/Material.tsx
apps/web/src/areas/coordenacao/painel/Painel.test.tsx
apps/web/src/areas/coordenacao/painel/Painel.tsx
apps/web/src/areas/coordenacao/painel/SinoDaCoordenacao.test.tsx
apps/web/src/areas/coordenacao/painel/fila-da-coordenacao.test.ts
apps/web/src/areas/coordenacao/painel/fila-da-coordenacao.ts
apps/web/src/components/sino/Sino.test.tsx
apps/web/src/components/sino/Sino.tsx
apps/web/src/components/ui/ListItem.test.tsx
apps/web/src/components/ui/ListItem.tsx
apps/web/src/paths.ts
docs/interface.md
docs/regulacao.md
e2e/support/material.ts
tasks/prd-ingestao-do-material/6_task.md
apps/web/src/areas/coordenacao/material/DialogoDeLicenca.tsx
apps/web/src/areas/coordenacao/material/Licencas.test.tsx
apps/web/src/areas/coordenacao/material/Licencas.tsx
apps/web/src/areas/coordenacao/material/api/licencas.ts
apps/web/src/areas/coordenacao/material/licencas.test.ts
apps/web/src/areas/coordenacao/material/licencas.ts
e2e/material-licencas.spec.ts
```

Nota: o caso da aba Licenças (`material-licencas.spec.ts:91`) levava 16,1 s e 15,6 s no portão, acima da metade do prazo de 30 s, e travava o carimbo desta correção. Por decisão do Orquestrador ele foi dividido em dois, como trabalho da 6.0 (o arquivo continua dela, fora da revisão e do commit): o caminho da pessoa até a aba com o formulário incompleto (9,4 s e 9,7 s) e o registro que entra na lista (6,8 s e 6,6 s). Por isso o spec tem 12 casos, 6 por projeto, e não 10.

## Causa

**Da suíte, não de uma tarefa.** O Playwright reparte os casos por contagem e o teste mede, por fatia, `4 min fixos + casos × 7 s` contra 60% do `timeout-minutes` de 45 (27 min; em casos, 197 por fatia, 1970 no total em dez). O HEAD sozinho tem 1962 casos: 197 na maior fatia, uns 27 min, no limite. A 6.0 soma 12 e a maior passa a 198, uns 28 min. O remédio não é subir o `timeout-minutes` nem baixar as constantes de `tools/ci/prazo-do-e2e.ts`: o runbook diz que é acrescentar a fatia. O total de fatias está escrito em quatro lugares: a matriz, o `name` do job e o `--shard` do passo em `.github/workflows/ci.yml`, e `FATIAS_DO_E2E` em `tools/processo/esteira.ts`, que o censo lê.

## Teste que reproduz

`tools/ci/esteira.test.ts › o teto do e2e cobre a suíte que existe, fatia a fatia e com folga`: vermelho antes (`expected 28 to be less than or equal to 27`, no portão da 6.0 em 12/11/2026, com a árvore dela), verde depois. Nenhum teste novo: é ele a regra, e a correção muda o que ele lê.

## Correção

`.github/workflows/ci.yml`, job `e2e`: a matriz passa de `[1 … 10]` para `[1 … 11]`, e o `/10` do `name` do job e do passo `npm run ci:e2e -- --shard=${{ matrix.fatia }}/10` passa a `/11`. `tools/processo/esteira.ts`: `FATIAS_DO_E2E` ganha o 11. `docs/runbook.md` ("Esteira vermelha no e2e") e `README.md` (a linha do `npm run ci:e2e`) deixam de dizer dez e `<i>/10`: dizem onze e `<i>/11`; o runbook acrescenta a data e a conta da décima primeira (1962 casos no HEAD, 1974 com a 6.0: 198 por fatia em dez, uns 28 min, acima de 27; 180 em onze, uns 25 min) e a margem até a décima segunda (2167 casos no total em onze fatias, uns 190 a mais que os 1974 de hoje). O runbook é lido pela guarda `alerta-tem-runbook`, e por isso conta como código. Nada mais muda no job: o teto de cada fatia continua 45 min, o `fail-fast` continua `false`, o artefato do traço continua um por fatia (`traco-do-e2e-<i>`).

O que a décima primeira fatia custa: um job a mais por push (uns 4 min fixos de preparo, compose e navegador).

Avisos para o relatório ao Orquestrador: o push de um commit que altera `.github/workflows/` exige o escopo `workflow` no token do gh; se a proteção de branch do GitHub exige `e2e N/10` como verificação obrigatória, a lista troca para `1/11` a `11/11` (configuração fora do repositório); e, depois do merge, a última execução verde terá só dez artefatos de censo e o censo responde "incompleto" com a fatia 11 faltando, até a primeira execução verde com onze (passageiro, sem defeito).

## Mutações

--faltando: 0 linhas (4 blocos, 0 motivos)

Cada bloco desfaz um dos quatro lugares em que o total de fatias está escrito.

**Nota sobre o primeiro bloco (a matriz):** o vermelho por `toBeLessThanOrEqual(limite)` depende de `e2e/material-licencas.spec.ts`, da 6.0, estar na árvore. Com a correção commitada sozinha, o HEAD tem 1962 casos: voltar a matriz para 10 dá 197 por fatia, uns 27 min, no limite e não acima dele, e esse teste não fica vermelho por esse motivo. A cláusula continua protegida nesse estado, porque os testes dos outros três blocos pegam a divergência com o `/11`. Quem refizer a mutação em outro estado da árvore não deve estranhar.

```mutacao
arquivo: .github/workflows/ci.yml
teste: tools/ci/esteira.test.ts › o teto do e2e cobre a suíte que existe
falha: toBeLessThanOrEqual(limite)
-        fatia: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
+        fatia: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
```

```mutacao
arquivo: .github/workflows/ci.yml
teste: tools/ci/esteira.test.ts › tem os jobs verificar, integracao, infra e e2e
-      - run: npm run ci:e2e -- --shard=${{ matrix.fatia }}/11
+      - run: npm run ci:e2e -- --shard=${{ matrix.fatia }}/10
```

```mutacao
arquivo: .github/workflows/ci.yml
teste: tools/ci/esteira.test.ts › o e2e roda em fatias que não se cancelam
-    name: e2e ${{ matrix.fatia }}/11 (compose completo e Playwright)
+    name: e2e ${{ matrix.fatia }}/10 (compose completo e Playwright)
```

```mutacao
arquivo: tools/processo/esteira.ts
teste: tools/ci/esteira.test.ts › o relatório do censo sobe também na execução verde
-export const FATIAS_DO_E2E = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const
+export const FATIAS_DO_E2E = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const
```

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-13 00:01:47 | 2026-11-13 00:02:06 | `revisor-geral` | 1 | APROVADO | a93013e7178d9f0df |
| 2026-11-13 00:01:45 | 2026-11-13 00:02:23 | `privacy-guardian` | 1 | APROVADO | affe5a839b15cdb2e |
| 2026-11-13 00:01:43 | 2026-11-13 00:02:25 | `infra-guardian` | 1 | APROVADO | a980a96b603133a16 |
| 2026-11-13 00:01:49 | 2026-11-13 00:02:46 | `test-engineer` | 1 | APROVADO | acd67bce90e234977 |
