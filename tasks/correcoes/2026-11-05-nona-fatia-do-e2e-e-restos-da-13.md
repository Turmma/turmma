# Correção — o portão de unidade da linha 1 cai em três testes fora da 14.0: restos dos mapas da X8 no código da 13.0, o teto do e2e em oito fatias e a parede do job sintético

**Origem:** portão local da 14.0 de `onboarding-por-convite` (linha 1) e esteira de `b936afe` (execução 42100530906, job `verificar`, no teste dos restos); pedido do Orquestrador em 05/11/2026, com o remédio do `docs/runbook.md`, "Esteira vermelha no e2e", e o precedente de `tasks/correcoes/2026-10-25-oitava-fatia-do-e2e.md`.
**Subagentes obrigatórios:** `infra-guardian`, `revisor-geral`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`
<!-- `infra-guardian` e `revisor-geral` vieram no PEDIDO do Orquestrador (guardiões: infra-guardian, test-engineer, revisor-geral). `revisor-geral` também porque a correção toca `.github/` (`ci.yml`) e `tools/processo/`. `tenancy-guardian`, `privacy-guardian` e `conformidade-reviewer` entram por caminho: a correção altera arquivos de `apps/` (`ler-planilha.ts`, `ImportarPlanilha.tsx`, `synthetic.test.ts`), e `tools/processo/guardioes-por-caminho.ts` pede os quatro guardiões (PADRAO) para eles; a Mesa conferiu a linha contra os arquivos. test-engineer é obrigatório em toda correção, marcado ou não. -->

## Sintoma

Três casos de unidade ficam vermelhos, todos fora dos arquivos da 14.0, e por isso nenhum carimbo do portão `--tarefa` da 14.0 (o terceiro apareceu depois, em 05/11/2026 às 23:10, com a árvore já corrigida nos dois primeiros):

```
tools/renomear/restos.test.ts › restos na árvore › a árvore não tem resto dos mapas aplicados
  apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx:88 Escolha
  apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx:276 Escolha
  apps/web/src/areas/coordenacao/importacao/ler-planilha.ts:46 Linha
  apps/web/src/areas/coordenacao/importacao/ler-planilha.ts:47 Linha
  apps/web/src/areas/coordenacao/importacao/ler-planilha.ts:63 Linha

tools/ci/esteira.test.ts › o teto do e2e cobre a suíte que existe, fatia a fatia e com folga
  a fatia 1 de 8 do e2e tem 198 casos, uns 28 min no runner, e o teto do job é de 45 min: passa de 60% dele ...
  expected 28 to be less than or equal to 27

apps/worker/src/processors/synthetic.test.ts:36 › SandboxDeCpu › queima pelo menos o cpuMs pedido de CPU do processo, e não só espera o relógio
  AssertionError: expected 279.847543 to be greater than or equal to 290
```

## Fora desta correção

Os arquivos da 14.0 (`tasks/prd-onboarding-por-convite/14_task.md`) ficam na árvore e não entram na revisão nem no commit desta correção:

```
apps/web/src/areas/coordenacao/Escola.tsx
apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx
apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx   (só os trechos da 14.0; os renomeios desta correção entram por patch filtrado)
apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts
apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
apps/web/src/areas/coordenacao/molduras.test.tsx
apps/web/src/areas/coordenacao/routes.tsx
apps/web/src/areas/navigation.test.ts
apps/web/src/areas/navigation.ts
apps/web/src/paths.ts
docs/interface.md
e2e/areas.spec.ts
e2e/support/coordenacao.ts
e2e/support/seed.ts
tasks/prd-onboarding-por-convite/14_task.md
apps/web/src/areas/coordenacao/grade/
e2e/grade-e-calendario.spec.ts
```

`e2e/areas.spec.ts` ganhou também, **como trabalho da 14.0** e por causa do portão desta correção, a divisão de um caso: o de `os endereços de hoje do aluno abrem as telas de hoje, e Tutor e Privacidade acendem Início e Eu` (linha 365) passou de 15,2 s, e o portão o media porque o diff da 14.0 tocou a constante `TELAS_DA_COORDENACAO` (linha 392), que fica entre ele e o caso seguinte e conta como dele. Virou dois casos (`o endereço de hoje do Tutor abre a tela de hoje e acende Início`; `os endereços de hoje de Privacidade e das Tarefas abrem as telas de hoje, e Privacidade acende Eu`), cada um com a entrada e as mesmas asserções de antes. A mudança entra no commit e na rodada da Mesa da 14.0, não nesta correção.

## Causa

**1. Restos (da 13.0).** `tools/renomear/mapas/9.json` e `13.json` registram `Linha` (→ `ListItem`) e `Escolha` (→ `ChoicePrompt`) como nomes antigos da X8. A 13.0 (commit `92fea690`) acrescentou duas peças locais com esses mesmos nomes: `interface Escolha` (o arquivo escolhido, em `ImportarPlanilha.tsx`) e `type Linha` (a linha de células que a biblioteca de planilha devolve, em `ler-planilha.ts`). O `restos` lê o **uso** do identificador, e o uso dos dois nomes dentro dos arquivos é resto. A esteira de `b936afe` já caiu nele. É a segunda vez que um nome local novo bate num nome de mapa; a guarda `guardas/nome-de-mercado` não pega, porque o nome é bom, só colide.

**2. Teto do e2e (da suíte, não de uma tarefa).** A suíte tem 1580 casos (`npx playwright test --list`, dois projetos): 1562 no HEAD e mais 18 da 14.0 (9 casos × 2 projetos em `e2e/grade-e-calendario.spec.ts`). Com oito fatias, o Playwright reparte por contagem e a fatia 1 leva 198 casos, uns 28 min estimados no runner (`4 + 198 × 7 s`), contra o limite de 27 min (60% de 45; em casos, 197 por fatia ou 1576 no total em oito). O HEAD, sozinho, já estava a 14 casos do limite (1562 de 1576), e a 14.0 o atravessa. O remédio não é subir o `timeout-minutes` nem baixar as constantes de `tools/ci/prazo-do-e2e.ts`, e o runbook já diz isso: é acrescentar a fatia. O total de fatias está escrito em quatro lugares (a matriz, o `name` do job e o `--shard` do passo em `ci.yml`, e `FATIAS_DO_E2E` em `tools/processo/esteira.ts`, que o censo lê).

**3. Dois relógios no mesmo teste (do job sintético, 15.0 da F1; não depende de tarefa da F2).** `apps/worker/src/processors/synthetic.test.ts` compara a CPU que a thread queimou (a sandbox queima pelo tempo de CPU da thread, `cpuMs`) com o tempo de parede (`performance.now()`): na linha 36, `>= 290` de parede para 300 de CPU; no terceiro caso, `>= 390` para duas threads e quatro pedidos de 200. A razão entre os dois relógios é do ambiente: depende de como o hipervisor calibrou o TSC. Nesta VM (WSL2, `clocksource tsc`, mesmo depois de reiniciar o WSL às 23:06) o tempo de CPU da thread corre uns 9% à frente da parede (python: 1091 ms de `thread_time` para 1000 ms de `monotonic`, três vezes seguidas), e os 300 ms de CPU levam uns 276 de parede (medido: 276, 276, 276, 276; a linha 36 caiu com 279,8). O terceiro caso está no limite também: 408, 395, 396 e 397 ms de parede contra 390, uma margem de uns 6 ms que o ruído da máquina come. O código está certo (a thread espera a queima de verdade, e o pedido a mais espera a vez); o que está errado é a asserção, que trata CPU e parede como o mesmo número.

## Teste que reproduz

Os dois já são os testes que reproduzem; a regra é a que eles afirmam, e a correção muda o que eles leem. Nenhum teste novo.

- `tools/renomear/restos.test.ts › restos na árvore › a árvore não tem resto dos mapas aplicados`: vermelho antes (os 5 restos acima, 1 de 43 vermelho, em 05/11/2026), verde depois.
- `tools/ci/esteira.test.ts › o teto do e2e cobre a suíte que existe, fatia a fatia e com folga`: vermelho antes (`expected 28 to be less than or equal to 27`, 1 de 21 vermelho, em 05/11/2026), verde depois.
- `apps/worker/src/processors/synthetic.test.ts › SandboxDeCpu: o job sintético queima CPU de verdade, fora do event loop › queima pelo menos o cpuMs pedido de CPU do processo, e não só espera o relógio`: vermelho antes (`expected 279.847543 to be greater than or equal to 290`, linha 36, 1 de 14 vermelho, em 05/11/2026 às 23:10), verde depois (três execuções seguidas, 14 de 14). O terceiro caso (`nunca passa de threadsMaximo`) passava, a 6 ms do limite, e é corrigido junto, pela mesma razão. A prova de que a parede continua provando o que prova está nos dois últimos blocos de "Mutações".

## Correção

**Restos.** `apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx`: `interface Escolha` passa a `ArquivoEscolhido`, com os dois usos (o campo `escolha` de `PlanilhaState` e o parâmetro de `falhaDaPreviaDe`); o nome do campo `escolha` e o resto do arquivo não mudam. `ler-planilha.ts`: `type Linha` passa a `CelulasDaLinha`, com os três usos. Os dois novos nomes não estão em nenhum mapa. O `ler-planilha.ts` é todo desta correção; o `ImportarPlanilha.tsx` tem trechos da 14.0 na árvore, e o commit leva só os três trechos de renomeio, por patch filtrado (`git apply --cached`).

**Nona fatia.** `.github/workflows/ci.yml`, job `e2e`: a matriz passa de `[1 … 8]` para `[1 … 9]`, e o `/8` do `name` do job e do passo `npm run ci:e2e -- --shard=${{ matrix.fatia }}/8` passa a `/9`. `tools/processo/esteira.ts`: `FATIAS_DO_E2E` ganha o 9. `docs/runbook.md` ("Esteira vermelha no e2e") e `README.md` (a linha do `npm run ci:e2e`) deixam de dizer oito e `<i>/8`: dizem nove e `<i>/9`; o runbook acrescenta a data e a conta da nona (1562 casos no HEAD, 1580 com a 14.0: 198 por fatia em oito, uns 28 min, acima de 27; 176 em nove, uns 25 min) e a margem até a décima (1773 casos no total em nove fatias, uns 190 a mais que os 1580 de hoje). O runbook é lido pela guarda `alerta-tem-runbook`, e por isso conta como código (caduca carimbo e rodadas): foi mexido antes do portão. Nada mais muda no job: o teto de cada fatia continua 45 min, o `fail-fast` continua `false`, o artefato do traço continua um por fatia (`traco-do-e2e-<i>`).

**Parede do job sintético.** `apps/worker/src/processors/synthetic.test.ts`: a constante `FOLGA_DA_PAREDE = 0.8`, com o comentário que diz por quê (a razão entre CPU e parede é do hipervisor, e 80% do nominal cobre uns 9% de diferença com folga). A linha 36 passa a `toBeGreaterThanOrEqual(300 * FOLGA_DA_PAREDE)` (240) e a do terceiro caso, a `2 * 200 * FOLGA_DA_PAREDE` (320). A asserção de CPU do processo (linha 35, `>= 300`) **não muda**, e o caso do meio continua provando a fila: a parede prova que a fila esperou (cada pedido de 200 vira 100 e a parede cai abaixo dos 320 que o teste exige, no bloco de mutação abaixo), e é o `maximoVisto` que prova o teto de duas threads (com poucos núcleos, até quatro threads passariam de 320 ms: a parede sozinha não o cobre). Nenhuma linha de produção muda.

O que a nona fatia custa: um job a mais por push (uns 4 min fixos de preparo, compose e navegador).

Avisos que valem de novo, para o relatório ao Orquestrador: se a proteção de branch do GitHub exige `e2e N/8` como verificação obrigatória, a lista troca para `1/9` a `9/9` (configuração fora do repositório, que esta correção não alcança); e, depois do merge, a última execução verde terá só oito artefatos de censo e o censo responde "incompleto" com a fatia 9 faltando, até a primeira execução verde com nove (passageiro, sem defeito).

## Mutações

--faltando: 0 linhas (8 blocos, 0 motivos)

(O comando lista 51 linhas, todas da 14.0, que está na mesma árvore e fica fora desta correção: `grade/` (46), as linhas 152 e 435 de `ImportarPlanilha.tsx` e as linhas 103, 221 e 222 de `previa-da-planilha.ts`, que são os trechos dela. Nenhuma é dos arquivos desta correção, que só renomeia tipos e troca números: `ler-planilha.ts`, `ci.yml`, `esteira.ts`.)

Os dois primeiros blocos devolvem um dos nomes antigos, e o teste dos restos tem de ficar vermelho nele; os quatro seguintes desfazem um dos lugares em que o total de fatias está escrito.

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ler-planilha.ts
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
falha: toEqual([])
-  const vazia = (linha: CelulasDaLinha): boolean => linha.every((celula) => celula === null || celula === undefined || celula === '')
+  const vazia = (linha: Linha): boolean => linha.every((celula) => celula === null || celula === undefined || celula === '')
   let fim = linhas.length
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
falha: toEqual([])
 interface PlanilhaState {
-  readonly escolha: ArquivoEscolhido | undefined
+  readonly escolha: Escolha | undefined
```

```mutacao
arquivo: .github/workflows/ci.yml
teste: tools/ci/esteira.test.ts › o teto do e2e cobre a suíte que existe
falha: toBeLessThanOrEqual(limite)
-        fatia: [1, 2, 3, 4, 5, 6, 7, 8, 9]
+        fatia: [1, 2, 3, 4, 5, 6, 7, 8]
```

```mutacao
arquivo: .github/workflows/ci.yml
teste: tools/ci/esteira.test.ts › tem os jobs verificar, integracao, infra e e2e
-      - run: npm run ci:e2e -- --shard=${{ matrix.fatia }}/9
+      - run: npm run ci:e2e -- --shard=${{ matrix.fatia }}/8
```

```mutacao
arquivo: .github/workflows/ci.yml
teste: tools/ci/esteira.test.ts › o e2e roda em fatias que não se cancelam
-    name: e2e ${{ matrix.fatia }}/9 (compose completo e Playwright)
+    name: e2e ${{ matrix.fatia }}/8 (compose completo e Playwright)
```

```mutacao
arquivo: tools/processo/esteira.ts
teste: tools/ci/esteira.test.ts › o relatório do censo sobe também na execução verde
-export const FATIAS_DO_E2E = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const
+export const FATIAS_DO_E2E = [1, 2, 3, 4, 5, 6, 7, 8] as const
```

O quinto bloco tira da thread a metade da queima pedida (as threads seguem limitadas a duas, o teto de 2 se mantém, mas cada pedido de 200 vira 100): o terceiro caso tem de cair na asserção de parede, `Math.max(...terminos)`, porque é só ela que lê quanto tempo a fila levou. O sexto resolve o pedido sem esperar a thread (o `queimar` resolvendo sem aguardar): o primeiro caso cai. **Nota honesta:** nesse caso a asserção de CPU do processo (linha 35) vem antes da de parede (linha 36) e cai primeiro, de modo que nenhuma mutação de produção isola a linha 36 sem derrubar a 35; a linha 36 não ganha bloco `falha:` próprio, e o que a sustenta é o quinto bloco, que prova a mesma coisa (a parede espera a queima de fato) no terceiro caso, onde não há asserção de CPU antes dela.

```mutacao
arquivo: apps/worker/src/processors/synthetic.ts
teste: apps/worker/src/processors/synthetic.test.ts › nunca passa de threadsMaximo
falha: Math.max(...terminos)
-      thread.postMessage({ cpuMs: pedido.cpuMs })
+      thread.postMessage({ cpuMs: pedido.cpuMs / 2 })
```

```mutacao
arquivo: apps/worker/src/processors/synthetic.ts
teste: apps/worker/src/processors/synthetic.test.ts › queima pelo menos o cpuMs pedido
      this.#fila.push(pedido)
-      this.#distribuir()
+      this.#distribuir(); resolver()
```

## Recomendações sem aplicar

Os seis revisores aprovaram na 1ª rodada. As quatro recomendações baratas (runbook 195→196, o comentário de `FOLGA_DA_PAREDE`, o do caso da fila e a nota da asserção de parede do primeiro caso) foram aplicadas (`.processo/ordens/2026-11-05-nona-fatia-do-e2e-e-restos-da-13-r1.md`). Sem aplicar:

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| infra-guardian (1ª), revisor-geral (1ª) | `TODO.md:1657`, item "(X3, validação)" alínea (e): ainda diz "com oito fatias de e2e … o teto é de cerca de 1576 casos", e deveria dizer nove fatias, cerca de 1773, uns 190 de margem | Fica no `TODO.md`, no próprio item: `TODO.md` não é arquivo desta correção e a linha é um registro datado de 26/10/2026, certo na data dele. Quem tocar o item atualiza |
| privacy-guardian (1ª) | Na rodada da 14.0, olhar `e2e/support/seed.ts` e `e2e/grade-e-calendario.spec.ts` (o seed alimenta o traço das nove fatias): só nome e matrícula fictícios | Rodada da 14.0: os dois arquivos são da 14.0 e estão em "Fora desta correção"; o caminho `e2e/` já pede o `privacy-guardian` lá |
| revisor-geral (2ª) | o texto do parágrafo "Parede do job sintético" dizia que em paralelo as quatro queimas acabariam perto de 200 ms, e o comentário novo do teste diz que com poucos núcleos até quatro threads passariam de 320 ms | Aplicado no próprio documento antes do commit (texto, fora dos blocos de "Mutações"): a parede prova a espera da fila e o `maximoVisto`, o teto de duas threads |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-05 23:51:06 | 2026-11-05 23:51:21 | `tenancy-guardian` | 1 | APROVADO | a5b87fefd6135657d |
| 2026-11-05 23:51:08 | 2026-11-05 23:51:31 | `privacy-guardian` | 1 | APROVADO | ab4326cacf105f5b5 |
| 2026-11-05 23:51:10 | 2026-11-05 23:51:33 | `conformidade-reviewer` | 1 | APROVADO | ad16b7075735503b2 |
| 2026-11-05 23:51:04 | 2026-11-05 23:51:35 | `revisor-geral` | 1 | APROVADO | a588c43e2e350a4ba |
| 2026-11-05 23:51:02 | 2026-11-05 23:52:07 | `infra-guardian` | 1 | APROVADO | a96a5287956a05aaf |
| 2026-11-05 23:51:13 | 2026-11-05 23:52:59 | `test-engineer` | 1 | APROVADO | acea383073e511130 |
| 2026-11-06 00:03:36 | 2026-11-06 00:03:42 | `tenancy-guardian` | 2 | APROVADO | a636a85137b41c946 |
| 2026-11-06 00:03:27 | 2026-11-06 00:03:42 | `infra-guardian` | 2 | APROVADO | a3311099deb5454c2 |
| 2026-11-06 00:03:30 | 2026-11-06 00:03:49 | `revisor-geral` | 2 | APROVADO | a14f0a30f0c2d605a |
| 2026-11-06 00:03:40 | 2026-11-06 00:03:51 | `privacy-guardian` | 2 | APROVADO | a27ab9338cfbbed68 |
| 2026-11-06 00:03:43 | 2026-11-06 00:03:57 | `conformidade-reviewer` | 2 | APROVADO | a72567522be9424f3 |
| 2026-11-06 00:03:46 | 2026-11-06 00:04:11 | `test-engineer` | 2 | APROVADO | a71f2010ea62bb96d |
