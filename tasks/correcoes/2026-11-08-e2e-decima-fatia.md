# Correção — com `e2e/esqueci-a-senha.spec.ts` (38 casos) a suíte do e2e vai a 1800 e cada uma das 9 fatias passa do teto de 197 casos

**Origem:** portão da 6.0 de `acesso-e-convites` (linha 1), no teste `tools/ci/esteira.test.ts › o teto do e2e cobre a suíte que existe`; pedido do Orquestrador em 08/11/2026, com o remédio do `docs/runbook.md`, "Esteira vermelha no e2e", e o precedente de `tasks/correcoes/2026-11-05-nona-fatia-do-e2e-e-restos-da-13.md`.
**Subagentes obrigatórios:** `infra-guardian`, `privacy-guardian`, `revisor-geral`
<!-- `infra-guardian` veio no PEDIDO do Orquestrador (guardiões: infra-guardian, test-engineer, Mesa). `revisor-geral` entra porque a correção toca `.github/` (`ci.yml`) e `tools/processo/` (`esteira.ts`), regra do passo 5 de `corrigir`. `privacy-guardian` entra por caminho: `tools/processo/guardioes-por-caminho.ts` pede `infra-guardian` e `privacy-guardian` para `.github/`, e a Mesa conferiu a linha contra os arquivos. test-engineer é obrigatório em toda correção, marcado ou não. A correção não toca `apps/` nem `packages/`: não há guardião de tenant nem de conformidade por caminho. -->

## Sintoma

Com o spec da 6.0 na árvore, a suíte do Playwright passa de 1762 casos commitados para 1800 (`npx playwright test --list`, dois projetos; `e2e/esqueci-a-senha.spec.ts` tem 38, 19 em cada projeto), e o teste do teto fica vermelho:

```
tools/ci/esteira.test.ts › o teto do e2e cobre a suíte que existe, fatia a fatia e com folga
  a fatia 1 de 9 do e2e tem 200 casos, uns 28 min no runner, e o teto do job é de 45 min: passa de 60% dele ...
  expected 28 to be less than or equal to 27
```

## Fora desta correção

Os arquivos da 6.0 de `acesso-e-convites` ficam na árvore e não entram na revisão nem no commit desta correção:

```
apps/web/src/pages/Entrar.tsx
apps/web/src/paths.ts
apps/web/src/routes.tsx
docs/interface.md
tasks/prd-acesso-e-convites/6_task.md
tasks/prd-acesso-e-convites/tasks.md
apps/web/src/api/senha.ts
apps/web/src/pages/EsqueciASenha.tsx
apps/web/src/pages/RedefinirSenha.tsx
e2e/esqueci-a-senha.spec.ts
```

## Causa

**Da suíte, não de uma tarefa.** O Playwright reparte os casos por contagem e o teste mede, por fatia, `4 min fixos + casos × 7 s` contra 60% do `timeout-minutes` de 45 (27 min; em casos, 197 por fatia, 1773 no total em nove). O HEAD sozinho tem 1762 casos: 196 por fatia, uns 27 min, no limite. A 6.0 soma 38 e passa a 200 por fatia, uns 28 min. O remédio não é subir o `timeout-minutes` nem baixar as constantes de `tools/ci/prazo-do-e2e.ts`, e o runbook já diz isso: é acrescentar a fatia. O total de fatias está escrito em quatro lugares: a matriz, o `name` do job e o `--shard` do passo em `.github/workflows/ci.yml`, e `FATIAS_DO_E2E` em `tools/processo/esteira.ts`, que o censo lê.

## Teste que reproduz

`tools/ci/esteira.test.ts › o teto do e2e cobre a suíte que existe, fatia a fatia e com folga`: vermelho antes (`expected 28 to be less than or equal to 27`, 1 de 21 vermelho, em 08/11/2026, com a árvore da 6.0), verde depois. Nenhum teste novo: é ele a regra, e a correção muda o que ele lê.

## Correção

`.github/workflows/ci.yml`, job `e2e`: a matriz passa de `[1 … 9]` para `[1 … 10]`, e o `/9` do `name` do job e do passo `npm run ci:e2e -- --shard=${{ matrix.fatia }}/9` passa a `/10`. `tools/processo/esteira.ts`: `FATIAS_DO_E2E` ganha o 10. `docs/runbook.md` ("Esteira vermelha no e2e") e `README.md` (a linha do `npm run ci:e2e`) deixam de dizer nove e `<i>/9`: dizem dez e `<i>/10`; o runbook acrescenta a data e a conta da décima (1762 casos no HEAD, 1800 com a 6.0: 200 por fatia em nove, uns 28 min, acima de 27; 180 em dez, uns 25 min) e a margem até a décima primeira (1970 casos no total em dez fatias, uns 170 a mais que os 1800 de hoje). O runbook é lido pela guarda `alerta-tem-runbook`, e por isso conta como código: foi mexido antes do portão. Nada mais muda no job: o teto de cada fatia continua 45 min, o `fail-fast` continua `false`, o artefato do traço continua um por fatia (`traco-do-e2e-<i>`).

O que a décima fatia custa: um job a mais por push (uns 4 min fixos de preparo, compose e navegador).

Avisos para o relatório ao Orquestrador: o push de um commit que altera `.github/workflows/` exige o escopo `workflow` no token do gh (aconteceu com a nona, em 06/11); se a proteção de branch do GitHub exige `e2e N/9` como verificação obrigatória, a lista troca para `1/10` a `10/10` (configuração fora do repositório); e, depois do merge, a última execução verde terá só nove artefatos de censo e o censo responde "incompleto" com a fatia 10 faltando, até a primeira execução verde com dez (passageiro, sem defeito).

## Mutações

--faltando: 0 linhas (4 blocos, 0 motivos)

Cada bloco desfaz um dos quatro lugares em que o total de fatias está escrito.

**Nota sobre o primeiro bloco (a matriz):** o vermelho por `toBeLessThanOrEqual(limite)` depende de `e2e/esqueci-a-senha.spec.ts`, da 6.0, estar na árvore. Com a correção commitada sozinha, o HEAD tem 1762 casos: voltar a matriz para 9 dá 196 por fatia, uns 27 min, no limite e não acima dele, e esse teste não fica vermelho por esse motivo. A cláusula continua protegida nesse estado, porque os testes dos outros três blocos (`tem os jobs verificar, integracao, infra e e2e`, `o e2e roda em fatias que não se cancelam` e `o relatório do censo sobe também na execução verde`) pegam a divergência com o `/10`. Quem refizer a mutação em outro estado da árvore não deve estranhar.

```mutacao
arquivo: .github/workflows/ci.yml
teste: tools/ci/esteira.test.ts › o teto do e2e cobre a suíte que existe
falha: toBeLessThanOrEqual(limite)
-        fatia: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
+        fatia: [1, 2, 3, 4, 5, 6, 7, 8, 9]
```

```mutacao
arquivo: .github/workflows/ci.yml
teste: tools/ci/esteira.test.ts › tem os jobs verificar, integracao, infra e e2e
-      - run: npm run ci:e2e -- --shard=${{ matrix.fatia }}/10
+      - run: npm run ci:e2e -- --shard=${{ matrix.fatia }}/9
```

```mutacao
arquivo: .github/workflows/ci.yml
teste: tools/ci/esteira.test.ts › o e2e roda em fatias que não se cancelam
-    name: e2e ${{ matrix.fatia }}/10 (compose completo e Playwright)
+    name: e2e ${{ matrix.fatia }}/9 (compose completo e Playwright)
```

```mutacao
arquivo: tools/processo/esteira.ts
teste: tools/ci/esteira.test.ts › o relatório do censo sobe também na execução verde
-export const FATIAS_DO_E2E = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const
+export const FATIAS_DO_E2E = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisor-geral (1ª) | `TODO.md:1695`, item (e), ainda fala em oito fatias e teto de uns 1576 casos; "já estava velho antes desta correção" | `TODO.md` não é arquivo desta correção e o texto já era velho antes dela; destino: a próxima passada do Orquestrador no `TODO.md`, como o `estado.md` de `onboarding-por-convite` já anota |
| infra-guardian (1ª) | "Rever a conta das fatias quando a suíte chegar perto de 1970 casos: com a décima, a folga é de uns 170 casos" | Já está escrito: o runbook, em "Esteira vermelha no e2e", diz que 1970 é "o ponto em que a décima primeira fatia passa a ser pedida", e o teste do teto reprova antes. Nada a acrescentar |
| privacy-guardian (1ª) | "Quando o privacy-guardian auditar a 6.0, confirmar que `e2e/esqueci-a-senha.spec.ts` só usa e-mail e nome sintéticos": o spec roda numa fatia cujo traço e cujo censo são públicos quando sobem por PR | A 6.0 de `acesso-e-convites` (`tasks/prd-acesso-e-convites/6_task.md`): o arquivo é dela e está em "Fora desta correção". A Mesa da rodada da 6.0 lê este item daqui para o prompt do `privacy-guardian` |
| infra-guardian, revisor-geral e test-engineer (1ª) | Os três avisos do documento: o push de commit que altera `.github/workflows/` exige o escopo `workflow` no token do gh; a proteção de branch troca `e2e N/9` por `1/10` a `10/10` (fora do repositório); o censo responde "incompleto" até a primeira execução verde com dez fatias | Já estão na seção "Correção" do documento. Vão no relatório do Implementador ao Orquestrador |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-08 15:04:19 | 2026-11-08 15:04:37 | `privacy-guardian` | 1 | APROVADO | a1e65dc2dbf68934e |
| 2026-11-08 15:04:22 | 2026-11-08 15:04:50 | `revisor-geral` | 1 | APROVADO | aa8c3425caee1782f |
| 2026-11-08 15:04:17 | 2026-11-08 15:05:05 | `infra-guardian` | 1 | APROVADO | a004dad9f512f0695 |
| 2026-11-08 15:04:24 | 2026-11-08 15:05:39 | `test-engineer` | 1 | APROVADO | aa9b23558da3595ab |
