# Achados das revisões — `tasks/correcoes/2026-11-12-e2e-fatia-acima-do-teto.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-13 00:02:06 · `tasks/correcoes/2026-11-12-e2e-fatia-acima-do-teto.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. A correção não tem Tech Spec própria e segue o remédio do `docs/runbook.md`, "Esteira vermelha no e2e", e o precedente `tasks/correcoes/2026-11-08-e2e-decima-fatia.md`.
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/TODO.md:1696`: o item (e) ainda diz "são dez fatias de e2e", com o teto em "cerca de 1970 casos" e "uns 170 de margem sobre os 1800". A correção da décima fatia atualizou essa linha, e esta não. O documento da correção não lista o `TODO.md`, por isso não bloqueia. O Orquestrador pode corrigir a linha no registro da correção: onze fatias, teto de 2167 casos, uns 190 de margem sobre os 1974.
- A conta do runbook está certa: 1962/10 dá 197, 1974/10 dá 198 (uns 28 min, acima de 27), 1974/11 dá 180 (uns 25 min), 197 × 11 = 2167 e sobram 193 casos. O total de fatias aparece igual nos quatro lugares: a matriz, o `name` e o `--shard` do `.github/workflows/ci.yml`, e `FATIAS_DO_E2E` em `tools/processo/esteira.ts`. Não sobrou `/10` do e2e em código nem em doc vivo.
- Os avisos ao Orquestrador continuam valendo: o push precisa do escopo `workflow` no token, a proteção de branch pode exigir `e2e 1/11` a `11/11` em vez de `N/10`, e o censo vai responder "incompleto" até a primeira execução verde com onze fatias.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-13 00:02:23 · `tasks/correcoes/2026-11-12-e2e-fatia-acima-do-teto.md`

VEREDITO: APROVADO

A correção só muda o número de fatias da esteira, de dez para onze. Não toca dado de pessoa, log, storage, exportação nem envio externo.

Campos pessoais tocados: nenhum. O diff tem 14 linhas a mais e 11 a menos, em quatro arquivos: o total de fatias na matriz, no `name` e no `--shard` de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/.github/workflows/ci.yml`, o `FATIAS_DO_E2E` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tools/processo/esteira.ts:161`, e o texto que acompanha em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/README.md` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/docs/runbook.md`.
Fora da tabela de dados do docs/lgpd.md: nada, porque nenhum campo novo entrou.
Autorização por objeto: não se aplica. A correção não tem rota, repository nem query.
Logs: limpos. Nenhuma linha de log nova.
Auditoria: não se aplica. Nenhuma das ações que a regra 20, item 10, manda auditar foi tocada.
Envio externo: nenhum envio novo. Os dois artefatos que sobem por fatia continuam como estavam: `traco-do-e2e-<i>` (`test-results/`, só na falha ou no cancelamento, guardado 7 dias) e `censo-do-e2e-<i>` (só o JSON do repórter, 7 dias). A fatia 11 apenas ganha os seus dois. Os comentários do `ci.yml` que prendem esse upload ao seed sintético (regra 20, item 17), inclusive em PR de repositório público, ficaram intactos.
Seed/fixture: sintético, sem mudança nesta correção. O `e2e/material-licencas.spec.ts` é da 6.0 e ficou fora desta revisão, como o documento declara.
Bloqueantes: nenhum.
Recomendações:
- Quando a 6.0 for revisada, confirmar que `e2e/material-licencas.spec.ts` e `e2e/support/material.ts` usam só dado sintético. Com uma fatia a mais, há mais um artefato de traço e mais um de censo publicados por execução, e isso continua dependendo do item 17.

Rodei `tools/ci/esteira.test.ts` com a árvore atual, já com o spec da 6.0: 22 de 22 passaram. As contas do runbook batem: 1974 casos em onze fatias dão 180 por fatia, e 197 × 11 dá o novo limite de 2167.

Pergunta de fechamento: a correção não muda o que o sistema guarda sobre um aluno nem para onde isso é enviado, então a resposta à secretaria continua a mesma de antes desta correção.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-13 00:02:25 · `tasks/correcoes/2026-11-12-e2e-fatia-acima-do-teto.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum (só a esteira de CI: matriz do e2e, `FATIAS_DO_E2E` e documentação)
Rate limit: ok (não se aplica, nenhum limite foi tocado)
Fila e prioridade: ok (não se aplica)
Concorrência: protegida (não se aplica)
Índice e paginação: ok (não se aplica)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok. O runbook "Esteira vermelha no e2e" foi atualizado para onze fatias e `/11`. O sinal "e2e perto do teto" e a guarda do teto continuam com as mesmas constantes. Não houve aumento de `timeout-minutes` nem mudança em `tools/ci/prazo-do-e2e.ts`.
Bloqueantes: nenhum
Recomendações:
- O total de fatias continua escrito em quatro lugares, que a guarda confere. Vale considerar derivar o `/N` do `name` e do `--shard` a partir de `strategy.job-total`, que o GitHub Actions oferece. Assim a próxima fatia muda só a matriz e `FATIAS_DO_E2E`. Isso fica para a retro, não para esta correção.
- O preparo fixo de cada fatia está em uns 4 min. Com 11 jobs por push, esse custo já pesa tanto quanto os casos. Vale medir antes da décima segunda fatia se o preparo pode cair, por exemplo com cache de navegador e de imagens. Hoje a margem é de uns 193 casos (2167 menos 1974).

Conferências que fiz:
- As contas fecham. 1974 casos em 11 fatias dão no máximo 180 por fatia, uns 25 min (4 + 180 × 7 s), abaixo dos 27 min (60% de 45). O limite de 197 por fatia dá 2167 casos no total.
- Rodei `tools/ci/esteira.test.ts` e `tools/processo/esteira.test.ts` com a árvore da 6.0 presente: 57 de 57 passaram.
- Não sobrou `/10` nem "dez fatias" no README, no runbook, no `ci.yml` nem em `tools/`. O `[11, fatia]` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tools/processo/esteira.test.ts:393` é o id da execução de exemplo, não o total de fatias.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/.github/workflows/ci.yml
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tools/processo/esteira.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/docs/runbook.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/README.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/correcoes/2026-11-12-e2e-fatia-acima-do-teto.md

## test-engineer · 1ª rodada · APROVADO · 2026-11-13 00:02:46 · `tasks/correcoes/2026-11-12-e2e-fatia-acima-do-teto.md`

VEREDITO: APROVADO

**Cenários exigidos**
- Caminho feliz: com o spec da 6.0 na árvore (1974 casos), cada uma das onze fatias fica abaixo de 60% do teto de 45 min.
- Borda: o número de fatias da matriz tem que bater com os outros três lugares onde está escrito (o `--shard=<i>/n`, o `name` do job e `FATIAS_DO_E2E`). Se um ficar para trás, o teste tem que ficar vermelho.
- Borda: a matriz tem que ir de 1 a n, sem buraco nem repetição.
- Borda: a soma das fatias tem que dar a suíte inteira.
- O teto não pode ser contornado subindo o `timeout-minutes`.
- Não se aplicam: permissão, isolamento entre escolas e concorrência. A correção mexe só na configuração da esteira.

**Cobertos** (todos em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tools/ci/esteira.test.ts`; rodei o arquivo e os 22 casos passaram em 21,5 s)
- **O teto da fatia**, em "o teto do e2e cobre a suíte que existe" (:482). Ele lê o tamanho da matriz e pergunta ao próprio Playwright quantos casos caem em cada `--shard=i/n`.
- **O `--shard`**, em "tem os jobs verificar, integracao, infra e e2e" (:346). O teste exige `/${fatiasDoJob(nome).length}` no comando.
- **O `name`**, em "o e2e roda em fatias que não se cancelam" (:365).
- **`FATIAS_DO_E2E`**, em "o relatório do censo sobe também na execução verde" (:466). Ele compara a lista com a matriz.
- **A matriz de 1 a n** é exigida em `fatiasDoJob` (:80).
- **A soma das fatias** é conferida pelo `expect(somados).toBe(total)` (:504).
- **O teto fixo**: `expect(teto).toBe(tetoDoE2e())` (:484) segura o `timeout-minutes` contra a constante de `tools/ci/prazo-do-e2e.ts`.

Conferi as quatro mutações contra o `git diff`:
- Cada uma das quatro linhas alteradas no `ci.yml` e no `esteira.ts` tem o seu bloco, e não há cláusula nova sem bloco.
- Cada bloco falha pelo motivo certo:
  - A matriz de volta a 10, com a 6.0 na árvore, dá 198 casos na maior fatia, uns 28 min contra o limite de 27, e falha no `toBeLessThanOrEqual(limite)`.
  - O `/10` no `--shard` falha no `toEqual` dos comandos.
  - O `/10` no `name` falha no `toContain`.
  - A lista de dez em `FATIAS_DO_E2E` falha no `toEqual` com a matriz.
- As asserções são sobre o resultado (número de casos e minutos por fatia, igualdade das listas), e não só sobre o código ter rodado.
- Não há `.skip`, teste comentado nem mock. Nenhum provedor de IA entra.
- Conferi as contas do runbook: 197 × 11 = 2167. Em onze fatias a maior fica com 180 casos, uns 25 min (4 min + 180 × 7 s). São 193 casos de margem, que o texto arredonda para "cerca de 190".

**Bloqueantes:** nenhum.

**Recomendações**
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/TODO.md:1696` ainda diz "são dez fatias de e2e", com o teto em cerca de 1970 casos e 170 de margem sobre 1800. Ficou desatualizado. Pede a mesma atualização que o runbook recebeu: onze fatias, cerca de 2167 casos, uns 190 de margem sobre 1974, citando esta correção.
2. O primeiro bloco (a matriz) só fica vermelho pelo motivo declarado enquanto `e2e/material-licencas.spec.ts` estiver na árvore. O documento avisa disso. Se o portão desta correção for refeito depois de a 6.0 sair da árvore sem ter sido commitada, esse bloco pode cair por "não ficou vermelho". Vale registrar no diário do Orquestrador que esta correção e a 6.0 entram na mesma ordem em que o carimbo foi provado.
