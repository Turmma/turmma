# Correção — `TETO.complexity` da catraca é 236 e a linha de base soma 235 desde o merge da spec

**Origem:** portão local da tarefa 4.0 (linha 1), `tools/guardas/catraca.test.ts` vermelha em 2 casos, desde o merge `05095808`.
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`
<!-- Os dois vieram no PEDIDO do Orquestrador. A correção leva 2 arquivos fora de tasks/ ou menos; o `revisor-geral` entra por ordem do pedido. -->

## Sintoma

`tools/guardas/catraca.test.ts` falha em dois casos: `cita só as quatro regras de tamanho, e a soma por regra é o TETO` e
`nenhum arquivo ganhou supressão desde o HEAD`, com `complexity: 235 supressões, o TETO é 236`.

## Fora desta correção

Os arquivos da tarefa 4.0 (linha 1), listados em `/home/joaquimdp/Documents/git/Educa.ia/.processo/ordens/arquivos-da-tarefa-4.0-l1.txt`:
ficam na árvore, fora da revisão e fora do commit desta correção.

## Causa

Dois lados do merge `05095808` baixaram `complexity` por caminhos diferentes, e cada um deixou o `TETO` igual à sua própria soma, 236:
a linha da spec (`3c4d7c38`) tirou a supressão de `apps/api/src/governanca/analista.service.ts` (tarefa 1.0); a linha 1 (`58b683bf`)
tirou uma de `apps/web/src/api/client.ts` (tarefa 12.0, de 2 para 1). Cada lado tinha 236. Juntas, as duas baixas dão 235, e o `TETO`,
que cada lado deixou em 236, ficou um acima da soma. Falha de integração das tarefas 1.0 e 12.0, vista só no merge.

## Teste que reproduz

`tools/guardas/catraca.test.ts` › `a linha de base do repositório (eslint-suppressions.json)`, os dois casos: vermelho no HEAD
(`complexity: 235 supressões, o TETO é 236`), verde com o `TETO` em 235.

## Correção

`TETO.complexity` de `tools/guardas/catraca.test.ts:14` passa de 236 para 235, igual à soma da base (a catraca desenhada na 13.0:
quem corta baixa o número no mesmo commit). `eslint-suppressions.json` não muda.

## Mutações

Nenhuma cláusula nova: o diff só baixa uma constante de teste. A prova é a própria catraca, que fica vermelha com o 236 (é o que ela
fez no HEAD).

**Sem mutação:** a correção só altera `tools/guardas/catraca.test.ts` (um teste), nenhum arquivo de `apps/*/src` ou `packages/*/src`.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| test-engineer (1ª) | "O defeito vai voltar com as linhas em paralelo. [...] Vale registrar na retro que, depois de todo merge entre linhas, `tools/guardas/catraca.test.ts` roda antes do portão da tarefa seguinte." | Retro da spec reengenharia-continuacao (D86): é mudança de processo (`tools/processo/`, passo do `/seguir`), fora do que esta correção toca. A Mesa avisa o Orquestrador no relatório de fechamento. |
| revisor-geral (2ª) | "a linha nova do comentário vai bem além da largura das outras linhas do bloco [...] vale quebrar a linha depois de 'pode ter baixado por um caminho.'" | Só estética, sem `max-len` configurado; as recomendações de quem aprovou não entram em ordem depois da primeira (revisar-tarefa, passo 4). Quebra a linha quem mexer em `tools/guardas/catraca.test.ts` na próxima vez. |
| test-engineer (2ª) | "A linha 12 do comentário [...] perto de 150 caracteres [...] vale quebrar a linha antes de 'A comparação com o HEAD vale no', na próxima vez que alguém mexer no arquivo." | Mesmo achado do revisor-geral: mesmo destino. |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-15 18:27:35 | 2026-11-15 18:27:40 | `tenancy-guardian` | 1 | APROVADO | a689d0deb1c7a0996 |
| 2026-11-15 18:27:36 | 2026-11-15 18:27:47 | `privacy-guardian` | 1 | APROVADO | af6c43abdc9f51724 |
| 2026-11-15 18:27:38 | 2026-11-15 18:27:49 | `conformidade-reviewer` | 1 | APROVADO | ab03503f3fac36f50 |
| 2026-11-15 18:27:33 | 2026-11-15 18:27:51 | `revisor-geral` | 1 | APROVADO | a4f4437d9f9b7bcb2 |
| 2026-11-15 18:27:40 | 2026-11-15 18:29:08 | `infra-guardian` | 1 | APROVADO | a4040ef5314abb9fe |
| 2026-11-15 18:27:31 | 2026-11-15 18:29:15 | `test-engineer` | 1 | APROVADO | af03b72f882f5b2d4 |
| 2026-11-15 18:55:29 | 2026-11-15 18:55:39 | `revisor-geral` | 2 | APROVADO | afe71a3638d7017be |
| 2026-11-15 18:55:24 | 2026-11-15 18:56:51 | `test-engineer` | 2 | APROVADO | a412c3bbda76eb053 |
