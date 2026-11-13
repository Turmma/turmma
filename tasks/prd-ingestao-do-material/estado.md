# Estado da execução — ingestao-do-material

## Agora
- **Espero:** o `RELATÓRIO` do `Implementador` (linha 1, `…--l1`), tarefa 5.0, porte grande, 1ª tentativa, pedida às 21:10 de 12/11; e o do `Implementador 2` (linha 2, `…--l2`), correção `2026-11-12-job-de-infra-passa-de-45-min` (o job de infra da esteira cancelado no `timeout-minutes: 45`, execução 43325031136), 1ª tentativa, pedida às 21:10. As duas dividem o compose de teste: os pedidos dizem para não rodar portão ao mesmo tempo.
- **Devo ainda:** levar ao `TODO.md`, no fechamento da spec: dois blocos de mutação do ensaio de alertas (parada do worker-pdf e `for: 1m`) estouram o teto de 600 s do portão e ficaram como motivo escrito no `3_task.md`; e o `db:gerar` quebrado (glob pega `.test.ts`), que a 4.0 já registrou no `TODO.md`. Ler a esteira no próximo encontro: a execução 43334579189 roda sobre `95e8166a` e deve cair no mesmo prazo do job de infra, até a correção se encontrar. Abrir a linha 3 quando o quadro liberar tarefa sem linha.
- **Base:** `spec/ingestao-do-material` em `95e8166a`

## Concluídas
| Tarefa | Commit | Modelo | Rodadas | Observação |
|---|---|---|---|---|
| 1.0 | `a6c3640e` | Sonnet 5.5 | 3 | r1 reprovou revisor-geral e test-engineer; recomendações do r2 no `TODO.md`, do r3 em `.processo/ordens/1_task-r3.md` (linha 1) |
| 3.0 | `c63b6a9c` | Sonnet 5.5 | 2 | divergência de desenho triada pelo `Arquiteto` como detalhe (4 arquivos de spec no commit); `cenarios.md` editado pela r1; recomendações da r1 e r2 em "Recomendações sem aplicar" do `3_task.md` |
| 4.0 | `cc56dfa3` | Sonnet 5.5 | 2 | 69 mutações vermelhas; fora do plano, `tools/guardas/tabelas-do-nucleo.mjs` ganhou `capituloDoMaterial`; `db:gerar` quebrado no `TODO.md`, a 0051 saiu de configuração temporária |
| 2.0 | `2245cca3` | Sonnet 5.5 | 3 | encontro com CONFLITO em `docs/lgpd.md` com a 3.0: correção `encontro-2` na linha 1 (`e2725b05`, privacy e test-engineer APROVADO na 1ª); sem aplicar em `TODO.md` e no `2_task.md` |

## Esperando o Joaquim
## O que falhou
- 12/11 19:48: o encontro 1 (tarefa 2.0, `2245cca3`) deu CONFLITO em `docs/lgpd.md` com a 3.0, que se encontrou antes. Correção `encontro-2` na linha 1, pelo par reiniciado.
- 12/11 21:05: esteira VERMELHA em `03454fa` (execução 43325031136): o job de infra foi cancelado no `timeout-minutes: 45` ainda rodando testes (na 1.0 levava 40m35s; a 3.0 trouxe o ensaio de alertas). Correção `2026-11-12-job-de-infra-passa-de-45-min` na linha 2, antes da partida da 5.0.
## O que decidi sem perguntar
- 11/11 11:56 — o `maestri recruit --replace` do par recusava por procurar o checkout da linha 1 da F2c, apagado no pouso ("WSL working directory does not exist"). Recriei a pasta vazia, reiniciei os dois e a apaguei. Na próxima spec, o mesmo vale para as linhas 2 e 3.
- 11/11 09:06 — próxima spec: F4 (`ingestao-do-material`), pela ordem de construção do piloto (D84), e não a X6, primeira `[ ]` do ROADMAP, que entra por partes ("cada parte entra no momento dela").
