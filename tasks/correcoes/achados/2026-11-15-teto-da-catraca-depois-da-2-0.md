# Achados das revisões — `tasks/correcoes/2026-11-15-teto-da-catraca-depois-da-2-0.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-15 19:13:38 · `tasks/correcoes/2026-11-15-teto-da-catraca-depois-da-2-0.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- O conflito no merge `7fcbb591` foi resolvido para o lado da 2.0. Por isso o `TETO` passou a contar uma supressão que a 12.0 já tinha cortado. No merge entre linhas, convém recalcular o `TETO` pela soma de `eslint-suppressions.json` em vez de pegar um dos lados. Isso é processo e fica para a retro.

A mudança está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/tools/guardas/catraca.test.ts:14` e só troca `TETO.complexity` de 234 para 233. Não mexe em código de produção, request, fila, gateway de IA, estado em memória, query ou migration. Somei `eslint-suppressions.json` e deu `complexity: 233`, `max-lines-per-function: 59`, `max-depth: 12` e `max-lines: 8`, os mesmos números do novo `TETO`. Rodei os dois casos de "linha de base do repositório" e eles passam (2 passed).

## test-engineer · 1ª rodada · APROVADO · 2026-11-15 19:14:51 · `tasks/correcoes/2026-11-15-teto-da-catraca-depois-da-2-0.md`

VEREDITO: APROVADO

Cenários exigidos: esta correção só mexe na ferramenta e não toca dado de escola, permissão nem código de produção. Por isso os casos de borda do domínio escolar, o de permissão e o de isolamento não se aplicam. O cenário que precisa ser provado é um só: o `TETO` da catraca tem de ser igual à soma por regra de `eslint-suppressions.json` depois do merge da linha 1 (12.0) com a linha 3 (2.0). A soma atual de `complexity` é 233.

Cobertos:
- `tools/guardas/catraca.test.ts` › `cita só as quatro regras de tamanho, e a soma por regra é o TETO` compara `somaPorRegra(atual)` com `TETO` por `toEqual`. Com o `TETO` em 234, o estado anterior, ele cai, e é exatamente o vermelho da esteira 43758821119. Com 233 ele passa. O teste falharia sem a correção, e a asserção é sobre o resultado.
- `› nenhum arquivo ganhou supressão desde o HEAD` passa, de modo que a baixa não esconde a troca de uma supressão por outra.
- `› npm run lint está verde com a linha de base` passa, de modo que nenhuma supressão ficou sem uso depois de o merge baixar `apps/web/src/api/client.ts`.
- Rodei `npx vitest run --project unidade tools/guardas/catraca.test.ts`: 18 de 18 casos verdes.
- O `git diff` tem uma linha só (`TETO.complexity` de 234 para 233, `tools/guardas/catraca.test.ts:14`) e nenhuma condição nova. A seção "Mutações" do documento justifica bem a ausência de bloco: não há cláusula nova, e nenhum arquivo de `apps/*/src` ou `packages/*/src` foi alterado, então a exigência de mutação da regra 40 não se aplica.
- Não há `.skip`, teste comentado nem mock. Nenhum teste de IA ou de concorrência é afetado.

Bloqueantes: nenhum.

Recomendações:
- A causa é estrutural. Quando as linhas se juntam, um conflito no `TETO` resolvido para um dos lados deixa a soma e o `TETO` diferentes, e isso só aparece na esteira da spec. Vale levar à retro a ideia de `tools/processo/linhas.ts` rodar `catraca.test.ts` (a parte da linha de base, que é rápida) logo depois do merge de cada linha, antes do push da spec. O `TETO` também poderia ser calculado no merge em vez de escolhido na resolução do conflito. Não bloqueia esta correção.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/tasks/correcoes/2026-11-15-teto-da-catraca-depois-da-2-0.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/tools/guardas/catraca.test.ts
