# Achados das revisões — `tasks/correcoes/2026-11-15-teto-de-complexity-da-catraca.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-15 18:27:51 · `tasks/correcoes/2026-11-15-teto-de-complexity-da-catraca.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. É uma correção do portão: só uma constante de teste muda, e nenhuma regra da spec é tocada.
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum
Recomendações:
- Na seção Causa de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tasks/correcoes/2026-11-15-teto-de-complexity-da-catraca.md`, o commit da linha da spec que tirou a supressão de `analista.service.ts` está como `1b705e99`. Esse commit não toca o `eslint-suppressions.json`; quem fez o corte foi o `3c4d7c38` (tarefa 1.0). Corrija o hash para que a retro rastreie a origem certa. Isso não muda a causa nem a correção.

Conferi o seguinte:
- O diff em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/guardas/catraca.test.ts:14` só baixa `TETO.complexity` de 236 para 235, que é o que o documento pede.
- A soma atual do `eslint-suppressions.json` dá `complexity: 235`, `max-lines-per-function: 59`, `max-depth: 12`, `max-lines: 8`, igual ao `TETO` novo nas quatro regras.
- O `eslint-suppressions.json` não foi alterado na árvore, como o documento manda.
- O histórico bate com a causa descrita. O `3c4d7c38` mexeu na base e no `TETO` no mesmo commit, e o `58b683bf` passou o `apps/web/src/api/client.ts` de 2 para 1 também com o `TETO`. Cada lado ficou com 236, e o merge `05095808` somou as duas baixas.

## test-engineer · 1ª rodada · APROVADO · 2026-11-15 18:29:15 · `tasks/correcoes/2026-11-15-teto-de-complexity-da-catraca.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- **Caminho feliz:** o `TETO.complexity` é igual à soma da linha de base. Hoje os dois valores são 235.
- **Borda: duas baixas paralelas.** Duas linhas baixaram `complexity` cada uma por um caminho e se juntaram num merge (`05095808`). O `TETO` ficou um acima da soma e precisa ficar vermelho.
- **Borda: troca de supressão com a soma igual.** Um arquivo ganha supressão enquanto outro perde. O caso "nenhum arquivo ganhou supressão desde o HEAD" tem que continuar segurando isso.
- **Permissão, isolamento e concorrência:** não se aplicam. A correção só mexe numa constante de teste de ferramenta e não toca dado de escola, rota nem operação que possa acontecer duas vezes.

**Cobertos:**
- **A comparação é exata.** Em `tools/guardas/catraca.test.ts:42`, `expect(somaPorRegra(atual)).toEqual(TETO)` exige igualdade, não só "até o teto". Com o 236 o teste fica vermelho, como o documento descreve no HEAD. Com o 235 fica verde.
- **A baixa sem ajuste do `TETO` também tem caso sintético.** O caso "uma supressão a menos sem baixar o TETO reprova" (`catraca.test.ts:67`) cobre isso com dado inventado.
- **Rodei `npx vitest run tools/guardas/catraca.test.ts`.** Passaram 18 de 18 testes, incluindo os dois que o documento aponta como vermelhos e o `npm run lint` verde.
- **O `eslint-suppressions.json` não foi alterado.** Ele não aparece no `git status`, então a soma de 235 vem da base que já está commitada, como o documento afirma.
- **O diff é só a constante, de 236 para 235, em `catraca.test.ts:14`.** Não há `.skip`, mock nem asserção afrouxada.
- **A seção "Mutações" está correta.** Não há cláusula nova nem arquivo de `apps/*/src` ou `packages/*/src`, então não cabe bloco de mutação. A prova é a própria igualdade, que reprovou no HEAD.

**Bloqueantes:** nenhum.

**Recomendações:**
- **O defeito vai voltar com as linhas em paralelo.** Os dois lados de um merge podem baixar o mesmo `TETO` a partir de 236, e o git junta as duas mudanças sem conflito, porque a linha é a mesma. Vale registrar na retro que, depois de todo merge entre linhas, `tools/guardas/catraca.test.ts` roda antes do portão da tarefa seguinte. Também vale anotar no comentário de `catraca.test.ts:10-13` que, no merge, o `TETO` é recalculado pela soma e não herdado de um dos lados.

Arquivos relevantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/guardas/catraca.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tasks/correcoes/2026-11-15-teto-de-complexity-da-catraca.md`

## revisor-geral · 2ª rodada · APROVADO · 2026-11-15 18:55:39 · `tasks/correcoes/2026-11-15-teto-de-complexity-da-catraca.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. É uma correção do portão. Nesta rodada só mudaram um comentário de teste e o documento da correção, e o `TETO` continua em 235.
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum
Recomendações:
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/guardas/catraca.test.ts:11`, a linha nova do comentário vai bem além da largura das outras linhas do bloco, que quebram por volta de 130 colunas. O lint passou, mas vale quebrar a linha depois de "pode ter baixado por um caminho." para manter o padrão do bloco.

O que conferi nesta rodada:
- A correção que exigi foi feita. Na seção Causa de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tasks/correcoes/2026-11-15-teto-de-complexity-da-catraca.md`, o hash agora é `3c4d7c38`. Esse é o commit que mexe no `eslint-suppressions.json`; o `1b705e99` não mexe.
- A recomendação do test-engineer sobre o comentário entrou no bloco acima de `const TETO`. A sobre a retro está em "Recomendações sem aplicar", com o destino e o motivo, e as duas batem com o que ele escreveu.
- Neste diff não há código executável alterado. O resto dele são arquivos escritos pelo hook.

## test-engineer · 2ª rodada · APROVADO · 2026-11-15 18:56:51 · `tasks/correcoes/2026-11-15-teto-de-complexity-da-catraca.md`

VEREDITO: APROVADO

**Cenários exigidos:** são os mesmos da 1ª rodada.
- Caminho feliz: o `TETO.complexity` é igual à soma da linha de base, 235.
- Borda: duas baixas paralelas que se juntam num merge e deixam o `TETO` um acima da soma.
- Borda: um arquivo troca de supressão com outro e a soma fica igual.
- Permissão, isolamento e concorrência não se aplicam: a correção só mexe numa constante e num comentário de teste de ferramenta.

**Cobertos:**
- **A correção que pedi foi feita.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/guardas/catraca.test.ts:11-12`, o comentário agora diz que, no merge entre linhas, o `TETO` é recalculado pela soma da base resultante e não herdado de um dos lados.
- **Nenhum código ou valor mudou.** O diff desde a rodada aprovada não mexe em código nem em asserção. O `TETO` continua `{ complexity: 235, 'max-lines-per-function': 59, 'max-depth': 12, 'max-lines': 8 }`, e a igualdade exata de `catraca.test.ts:42` continua sendo a prova.
- **O teste passa.** Rodei `npx vitest run tools/guardas/catraca.test.ts` de novo: 18 de 18 verdes.
- **O documento da correção também foi ajustado.** O hash na Causa passou para `3c4d7c38`, que é a origem certa (era a recomendação do revisor-geral). A seção "Recomendações sem aplicar" registra a minha outra recomendação, com destino na retro.
- **A seção "Mutações" continua correta.** O diff não toca nada em `apps/*/src` nem em `packages/*/src`, e não há cláusula nova.
- O resto do diff é dos arquivos escritos pelo hook (`achados/` e `indice.md`), fora da auditoria.

**Bloqueantes:** nenhum.

**Recomendações:**
- A linha 12 do comentário de `catraca.test.ts` tem perto de 150 caracteres e destoa das vizinhas, que têm perto de 130. O lint não reclama, porque não há `max-len` nem `printWidth` configurados. É só estética: vale quebrar a linha antes de "A comparação com o HEAD vale no", na próxima vez que alguém mexer no arquivo.
