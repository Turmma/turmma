# Achados das revisões — `tasks/correcoes/2026-11-04-restos-linha-na-9.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-04 03:22:22 · `tasks/correcoes/2026-11-04-restos-linha-na-9.md`

VEREDITO: APROVADO

Escopo: respeitado. A única mudança está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/worker/test/transferencia-pela-planilha.int.test.ts:93`, onde o parâmetro de tipo do ajudante `consulta` passou de `Linha` para `Registro`, nas três ocorrências da linha. Nenhum comportamento mudou e nenhum outro arquivo desta correção foi tocado.

Aderência à Tech Spec: ok. Trocar o nome de um genérico local num teste não afeta a arquitetura.

Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)").

Bloqueantes: nenhum.

Recomendações:
- O documento explica a causa assim: um genérico local "não é o símbolo do mapa, mas o `restos` o lê como resto". Ou seja, o `tools/renomear/restos.test.ts` não distingue um parâmetro de tipo local de um símbolo renomeado. A correção contorna esse falso positivo em vez de resolvê-lo, e o mesmo erro pode voltar a qualquer `<Linha ...>` local. Vale registrar isso no `TODO.md` ou na retro, para o `restos` ignorar parâmetros de tipo.

Conferi também que não sobrou nenhum `Linha` no arquivo. Rodei o `restos.test.ts` uma vez e passou (43 de 43).

## test-engineer · 1ª rodada · APROVADO · 2026-11-04 03:22:32 · `tasks/correcoes/2026-11-04-restos-linha-na-9.md`

VEREDITO: APROVADO

**Cenários exigidos:** esta correção só troca o nome de um parâmetro de tipo. Ela não mexe em regra de negócio, em dado de escola nem em operação que possa rodar duas vezes ao mesmo tempo. Por isso não pede caminho feliz, caso de borda do domínio, permissão, isolamento nem concorrência. Basta o teste que mostrou o problema:
- `tools/renomear/restos.test.ts › restos na árvore › a árvore não tem resto dos mapas aplicados` tem de ficar verde.
- `transferencia-pela-planilha.int.test.ts` não pode mudar de resultado.

**Cobertos:**
- `npx vitest run tools/renomear/restos.test.ts`: 43 de 43 passaram, incluindo o teste "a árvore não tem resto dos mapas aplicados", que falhava antes da correção.
- `npx vitest run apps/worker/test/transferencia-pela-planilha.int.test.ts`: 21 de 21 passaram, com banco, Redis e storage de teste ligados. O ajudante `consulta` continua funcionando e a verificação de tipos não quebrou.
- O `git diff` muda só a linha 93 do teste, de `<Linha extends object>` para `<Registro extends object>`, nas três ocorrências. Nenhuma asserção mudou e nenhum `.skip` entrou.
- Não sobrou nenhum `Linha` no arquivo.
- O documento diz "Sem mutação". A mudança não traz cláusula nova a provar, então a falta de bloco de mutação está certa. O código de produto que aparece na árvore é da correção `e2e-contrato-da-lista-8`, que o documento lista em "Fora desta correção".

**Bloqueantes:** nenhum.

**Recomendações:**
- Para a retro: o `restos.test.ts` acusa nome de genérico local como se fosse símbolo do mapa de nomes. Vale avaliar se ele deve ignorar parâmetros de tipo, ou se o guia do desenvolvedor deve avisar para não usar em código novo nomes que já saíram do mapa (`Linha` e parecidos). Não bloqueia esta correção.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/tasks/correcoes/2026-11-04-restos-linha-na-9.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/worker/test/transferencia-pela-planilha.int.test.ts
