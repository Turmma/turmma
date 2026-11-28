# Correção — com `e2e/aluno-prova.spec.ts` (20 casos) a suíte do e2e vai a 2176 e cada uma das 11 fatias passa do teto de 197 casos

**Origem:** portão da 12.0 de `avaliacao-e-correcao`, no teste `tools/ci/esteira.test.ts › o teto do e2e cobre a suíte que existe`; pedido do Orquestrador em 28/11/2026, com o remédio do `docs/runbook.md`, "Esteira vermelha no e2e", e o precedente de `tasks/correcoes/2026-11-12-e2e-fatia-acima-do-teto.md`.
**Subagentes obrigatórios:** `infra-guardian`, `privacy-guardian`, `revisor-geral`, `tenancy-guardian`, `conformidade-reviewer`
<!-- `infra-guardian` veio no PEDIDO do Orquestrador. `revisor-geral` entra porque a correção toca `.github/` (`ci.yml`) e `tools/processo/` (`esteira.ts`), regra do passo 5 de `corrigir`. `privacy-guardian` entra por caminho: `tools/processo/guardioes-por-caminho.ts` pede `infra-guardian` e `privacy-guardian` para `.github/`. test-engineer é obrigatório em toda correção, marcado ou não. A correção não toca `apps/` nem `packages/`. `tenancy-guardian` e `conformidade-reviewer` entram porque `portao-local.ts revisores` lê a árvore inteira, com os arquivos da 12.0 de `apps/web` (seção "Fora desta correção"), e não porque esta correção toque tenant ou conformidade: o que há para auditar aqui é só `.github/`, `tools/processo/esteira.ts`, `README.md`, `docs/runbook.md` e este documento. -->

## Sintoma

Com o spec da 12.0 na árvore, a suíte do Playwright passa de 2156 casos commitados para 2176 (`npx playwright test --list`, dois projetos; `e2e/aluno-prova.spec.ts` tem 20, 10 em cada projeto), e o teste do teto fica vermelho:

```
tools/ci/esteira.test.ts › o teto do e2e cobre a suíte que existe, fatia a fatia e com folga
  a fatia 1 de 11 do e2e tem 198 casos, uns 28 min no runner, e o teto do job é de 45 min: passa de 60% dele ...
  expected 28 to be less than or equal to 27
```

## Fora desta correção

Os 33 arquivos da 12.0 de `avaliacao-e-correcao` ficam na árvore e não entram na revisão nem no commit desta correção (lista em `.processo/arquivos-da-12.0-em-curso.txt`, do térreo):

```
apps/web/src/api/atividades-do-aluno.ts
apps/web/src/areas/aluno/Atividade.test.tsx
apps/web/src/areas/aluno/Atividade.tsx
apps/web/src/areas/aluno/Atividades.test.tsx
apps/web/src/areas/aluno/Atividades.tsx
apps/web/src/areas/aluno/atividade.test.ts
apps/web/src/areas/aluno/atividade.ts
apps/web/src/areas/aluno/atividades.test.ts
apps/web/src/areas/aluno/atividades.ts
apps/web/src/areas/aluno/fila-de-respostas.ts
apps/web/src/areas/aluno/respostas.test.ts
apps/web/src/areas/aluno/respostas.ts
apps/web/src/areas/aluno/routes.test.tsx
apps/web/src/areas/aluno/routes.tsx
apps/web/src/paths.test.ts
apps/web/src/paths.ts
docs/interface.md
docs/roteiro-da-demonstracao.md
e2e/roteiro-da-demonstracao.spec.ts
e2e/support/aluno-api.ts
e2e/support/atividade-db.ts
infra/test/carga-prova.test.ts
tasks/prd-avaliacao-e-correcao/12_task.md
tasks/prd-avaliacao-e-correcao/cenarios.md
tasks/prd-avaliacao-e-correcao/techspec.md
apps/web/src/api/atividades-do-aluno.test.ts
apps/web/src/areas/aluno/AntesDeComecar.tsx
apps/web/src/areas/aluno/ProvaEmFoco.test.tsx
apps/web/src/areas/aluno/ProvaEmFoco.tsx
apps/web/src/areas/aluno/fila-de-saidas.test.ts
apps/web/src/areas/aluno/fila-de-saidas.ts
apps/web/src/areas/aluno/use-agora.ts
e2e/aluno-prova.spec.ts
```

## Causa

**Da suíte, não de uma tarefa.** O Playwright reparte os casos por contagem e o teste mede, por fatia, `4 min fixos + casos × 7 s` contra 60% do `timeout-minutes` de 45 (27 min; em casos, 197 por fatia, 2167 no total em onze). O HEAD sozinho tem 2156 casos: 196 na maior fatia, uns 27 min, no limite. A 12.0 soma 20 e a maior passa a 198, uns 28 min. O remédio não é subir o `timeout-minutes` nem baixar as constantes de `tools/ci/prazo-do-e2e.ts`: o runbook diz que é acrescentar a fatia. O total de fatias está escrito em quatro lugares: a matriz, o `name` do job e o `--shard` do passo em `.github/workflows/ci.yml`, e `FATIAS_DO_E2E` em `tools/processo/esteira.ts`, que o censo lê.

## Teste que reproduz

`tools/ci/esteira.test.ts › o teto do e2e cobre a suíte que existe, fatia a fatia e com folga`: vermelho antes (`expected 28 to be less than or equal to 27`, rodado isolado em 28/11/2026 com a árvore da 12.0), verde depois. Nenhum teste novo: é ele a regra, e a correção muda o que ele lê.

## Correção

`.github/workflows/ci.yml`, job `e2e`: a matriz passa de `[1 … 11]` para `[1 … 12]`, e o `/11` do `name` do job e do passo `npm run ci:e2e -- --shard=${{ matrix.fatia }}/11` passa a `/12`. `tools/processo/esteira.ts`: `FATIAS_DO_E2E` ganha o 12. `docs/runbook.md` ("Esteira vermelha no e2e") e `README.md` (a linha do `npm run ci:e2e`) deixam de dizer onze e `<i>/11`: dizem doze e `<i>/12`; o runbook acrescenta a data e a conta da décima segunda (2156 casos no HEAD, 2176 com a 12.0: 198 por fatia em onze, uns 28 min, acima de 27; 182 em doze, uns 26 min) e a margem até a décima terceira (2364 casos no total em doze fatias, 188 a mais que os 2176 de hoje). O runbook é lido pela guarda `alerta-tem-runbook`, e por isso conta como código. Nada mais muda no job: o teto de cada fatia continua 45 min, o `fail-fast` continua `false`, o artefato do traço continua um por fatia (`traco-do-e2e-<i>`).

O que a décima segunda fatia custa: um job a mais por push (uns 4 min fixos de preparo, compose e navegador).

Avisos para o relatório ao Orquestrador: o push de um commit que altera `.github/workflows/` exige o escopo `workflow` no token do gh; se a proteção de branch do GitHub exige `e2e N/11` como verificação obrigatória, a lista troca para `1/12` a `12/12` (configuração fora do repositório); e, depois do merge, a última execução verde terá só onze artefatos de censo e o censo responde "incompleto" com a fatia 12 faltando, até a primeira execução verde com doze (passageiro, sem defeito).

## Mutações

Cada bloco desfaz um dos quatro lugares em que o total de fatias está escrito.

**Nota sobre o primeiro bloco (a matriz):** o vermelho por `toBeLessThanOrEqual(limite)` depende de `e2e/aluno-prova.spec.ts`, da 12.0, estar na árvore. Com a correção commitada sozinha, o HEAD tem 2156 casos: voltar a matriz para 11 dá 196 por fatia, uns 27 min, no limite e não acima dele, e esse teste não fica vermelho por esse motivo. A cláusula continua protegida nesse estado, porque os testes dos outros três blocos pegam a divergência com o `/12`. Quem refizer a mutação em outro estado da árvore não deve estranhar.

```mutacao
arquivo: .github/workflows/ci.yml
teste: tools/ci/esteira.test.ts › o teto do e2e cobre a suíte que existe
falha: toBeLessThanOrEqual(limite)
-        fatia: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
+        fatia: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
```

```mutacao
arquivo: .github/workflows/ci.yml
teste: tools/ci/esteira.test.ts › tem os jobs verificar, unidade, integracao, infra e e2e
-      - run: npm run ci:e2e -- --shard=${{ matrix.fatia }}/12
+      - run: npm run ci:e2e -- --shard=${{ matrix.fatia }}/11
```

```mutacao
arquivo: .github/workflows/ci.yml
teste: tools/ci/esteira.test.ts › o e2e roda em fatias que não se cancelam
-    name: e2e ${{ matrix.fatia }}/12 (compose completo e Playwright)
+    name: e2e ${{ matrix.fatia }}/11 (compose completo e Playwright)
```

```mutacao
arquivo: tools/processo/esteira.ts
teste: tools/ci/esteira.test.ts › o relatório do censo sobe também na execução verde
-export const FATIAS_DO_E2E = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const
+export const FATIAS_DO_E2E = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const
```

## Recomendações sem aplicar

Rodada 1 (nenhum revisor reprovou; os seis aprovaram). Aplicada: a frase do runbook, "10 casos em cada um dos dois projetos". As demais:

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisor-geral (1ª), test-engineer (1ª) | `TODO.md:1866`, item (e), ainda diz "onze fatias", "teto de 2167 casos" e "uns 190 de margem sobre os 1974"; deve dizer doze fatias, 2364 casos e 188 de margem sobre 2176 | O próprio item (e) do `TODO.md`. A correção não toca `TODO.md` e nenhum teste nem guarda lê a linha; o Orquestrador atualiza ao registrar o estado, e o Implementador cita o item no relatório a ele |
| revisor-geral (1ª), test-engineer (1ª) | Tirar o `/N` do `name` e do `--shard` de `strategy.job-total`, para o total ficar em dois lugares em vez de quatro | Retrospectiva (já registrada no estado da F4): muda o desenho do job, fora do escopo desta correção |
| revisor-geral (1ª) | Repetir no relatório que a mutação da matriz só fica vermelha pelo teto com o `e2e/aluno-prova.spec.ts` da 12.0 na árvore | Já está na "Nota sobre o primeiro bloco" do documento; o Implementador a repete no relatório ao Orquestrador |
| infra-guardian (1ª), test-engineer (1ª) | Levar ao Orquestrador os três avisos da seção "Correção" (escopo `workflow` do token do gh, proteção de branch com `e2e 1/12` a `12/12`, censo "incompleto" até a primeira execução verde com doze). test-engineer: pelo registro de 13/11 em `tasks/prd-ingestao-do-material/estado.md:5`, `develop`, `release` e `main` não têm proteção de branch, então o aviso da proteção provavelmente não se aplica | Relatório do Implementador ao Orquestrador, com essa ressalva do test-engineer |
| tenancy-guardian (1ª), privacy-guardian (1ª), conformidade-reviewer (1ª) | Os 33 arquivos da 12.0 não foram auditados aqui: atenção a `e2e/support/atividade-db.ts`, `e2e/support/aluno-api.ts`, `apps/web/src/api/atividades-do-aluno.ts` (escopo e fixture sintética), e à regra 70 item 7 / D70 (contagem de saídas presa àquela avaliação e nunca somada por aluno, aviso ao aluno antes da prova, nenhuma consequência automática) | Revisão da 12.0: entra no prompt dos revisores quando o Implementador pedir a rodada dela |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-28 06:59:07 | 2026-11-28 06:59:20 | `tenancy-guardian` | 1 | APROVADO | ad8e680704aec939e |
| 2026-11-28 06:59:04 | 2026-11-28 06:59:24 | `privacy-guardian` | 1 | APROVADO | afac0e775eebc5e29 |
| 2026-11-28 06:59:09 | 2026-11-28 06:59:28 | `conformidade-reviewer` | 1 | APROVADO | a8edb9e8f94dfa4c9 |
| 2026-11-28 06:59:06 | 2026-11-28 06:59:28 | `revisor-geral` | 1 | APROVADO | a944f9c091d46668d |
| 2026-11-28 06:59:03 | 2026-11-28 06:59:50 | `infra-guardian` | 1 | APROVADO | a745237b9b3c5cfd4 |
| 2026-11-28 06:59:10 | 2026-11-28 07:00:15 | `test-engineer` | 1 | APROVADO | a612c3857d8c4ec75 |
| 2026-11-28 07:23:16 | 2026-11-28 07:23:31 | `infra-guardian` | 2 | APROVADO | aaf7311092e44e2ef |
| 2026-11-28 07:23:19 | 2026-11-28 07:23:33 | `privacy-guardian` | 2 | APROVADO | a461f4409301ef455 |
| 2026-11-28 07:23:22 | 2026-11-28 07:23:34 | `revisor-geral` | 2 | APROVADO | a0139bbd0207b5fc6 |
| 2026-11-28 07:23:25 | 2026-11-28 07:23:37 | `tenancy-guardian` | 2 | APROVADO | ada1f2562f27a6778 |
| 2026-11-28 07:23:28 | 2026-11-28 07:23:42 | `conformidade-reviewer` | 2 | APROVADO | a968ff6b558b56056 |
| 2026-11-28 07:23:31 | 2026-11-28 07:23:48 | `test-engineer` | 2 | APROVADO | a5a1efd068af99177 |
