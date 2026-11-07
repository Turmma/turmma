# Estado da execução — acesso-e-convites

## Agora
- **Espero:** o `RELATÓRIO` do `Implementador` (linha 1) da correção `2026-11-07-encontro-na-fila-de-carga` (guardiões `revisor-geral`, `test-engineer`, `infra-guardian`), 1ª tentativa, desde 13:55. A **tarefa 1.0** (linha 2, porte grande, 1ª tentativa, desde 07/11 11:30) está parada na `DIVERGÊNCIA` de portão de 14:07: o `Implementador 2` espera o meu `PEDIDO de retomada`, que sai logo depois do encontro da correção da linha 1. Esteira da spec rodando em `7d10ed9` (execução 42393514943): ler no próximo encontro.
- **Devo ainda:** depois do encontro da linha 1, `PEDIDO de retomada` ao `Implementador 2`: rodar o portão da 1.0 com a linha 1 ociosa (nenhuma tarefa liberada para ela). O provedor de e-mail segue aberto: segura o portão, não as tarefas. Com a lista de tarefas, o aviso das 30 min (passo 7); a construção começa depois do encontro da correção.
- **Base:** `spec/acesso-e-convites` em `7d10ed9a`

## Concluídas
| Tarefa | Commit | Modelo | Rodadas | Observação |
|---|---|---|---|---|

## Esperando o Joaquim
## O que falhou
- 07/11 11:49: `DIVERGÊNCIA` de portão do `Implementador` (linha 1, correção do `restos`): três corridas do portão caíram só por "Test timed out" (10 a 14 casos, conjuntos diferentes), com carga de 23 a 47 em 12 núcleos; isolados, verdes.
- 07/11 12:02: 4ª corrida, com a máquina calma no início (carga 7,3) e o Implementador 2 na fila: 15 casos só por tempo, e a carga subiu a 40 com o próprio vitest. Logs: `/tmp/claude-1000/-home-joaquimdp-Documents-git--maestri-floors-educaia--specacesso-e-convites--l1/614c9b60-445d-4aec-b3a0-4d6c670d1868/scratchpad/portao{,2,3,4}.log`.
- 07/11: a correção `2026-11-07-unidade-independente-da-carga` (`19dcb663`, 2ª rodada de todos os revisores) achou a causa: a suíte de unidade criava a própria carga, com 11 trabalhadores em 12 núcleos; não era a mudança do `restos`. Depois do limite, 3 corridas verdes em 192 s (antes, de 332 a 455 s).
- 07/11 13:35: o 1º encontro da linha 1 deu `VERIFICAÇÃO RECUSADA`: o typecheck passou de 180 s porque rodou junto do portão da linha 2, que segurava a fila de carga; o encontro não entra na fila. Achado do Implementador: `privacidade.test.ts` › "controle: com o foco ligado a mesma consulta relê" (`vi.waitFor` de 1 s) caiu uma vez sob carga, candidato a correção de dependência da carga.

## O que decidi sem perguntar
- 07/11: a correção do `restos` (recomendação da retro da F2b, aprovada pelo Joaquim às 11:01) corre na linha 1 da F2c, e não em andar de correção avulsa, porque o passo 3 diz "uma spec ou uma correção avulsa por vez" e a F2c já estava aberta; ela pousa com a spec.
- 07/11 11:50: na `DIVERGÊNCIA` de portão por carga, não abri correção de teste logo: com a máquina calma (carga ~11, nenhuma suíte), pedi ao `Implementador 2` que pusesse toda suíte fora do portão na fila de carga (`flock /tmp/educa-carga.lock`) e mandei a linha 1 rodar o portão uma vez. Se cair de novo só por tempo, os testes que caírem viram correção que os torna independentes da carga (passo 7, "Máquina não é parada").
- 07/11 12:04: a 4ª corrida mostrou que a carga vem da própria suíte de unidade: correção `unidade-sob-carga` na linha 1, antes de retomar a do `restos` (passo 6, `DIVERGÊNCIA` de portão), com a pista de conferir primeiro se a mudança em `tools/renomear/arvore.ts` é que pesa.
- 07/11 13:36: na `VERIFICAÇÃO RECUSADA` por tempo, sem código quebrado, não abri a correção `encontro-…` que a saída pede: refiz o encontro com `flock /tmp/educa-carga.lock`, para ele esperar o portão da linha 2. Para a retro: o `linhas.ts encontro` devia entrar na fila de carga sozinho, como o portão.
- 07/11 13:47: o 2º encontro, já na fila, deu de novo `VERIFICAÇÃO RECUSADA` por tempo (typecheck e lint do monorepo acima de 180 s com carga média de 27). Refiz com `EDUCA_ENCONTRO_PRAZO_DA_VERIFICACAO_MS=480000` e `flock`. Defeito a corrigir (correção avulsa ou retro): `PRAZO_DA_VERIFICACAO_MS` (3 min, `tools/processo/linhas.ts`) não cabe com outra linha rodando, e o encontro não entra na fila de carga.
- 07/11 13:55: encontro da linha 1 feito (`379aa3d4`, spec em `7d10ed9a`) com o prazo de 480 s; com a linha 1 ociosa e nenhuma tarefa liberada, ela recebeu a correção `2026-11-07-encontro-na-fila-de-carga`, antes do encontro da 1.0, que esbarraria no mesmo prazo.
- 07/11 14:10: `DIVERGÊNCIA` de portão do `Implementador 2` (tarefa 1.0): duas corridas caíram só por tempo, em unidade fora da tarefa, com carga de 30+; isolados, verdes. O portão dele estava sozinho na fila de carga (o da linha 1 esperava a vez): a carga vinha do que fica fora da fila, os testes e revisores da correção da linha 1. Não abri correção: a linha 1 fica ociosa depois do encontro da correção dela, e aí o `Implementador 2` roda o portão com a máquina livre. Se cair de novo só por tempo com a máquina livre, os testes que caírem viram correção na linha 2 (passo 7, "Máquina não é parada").
