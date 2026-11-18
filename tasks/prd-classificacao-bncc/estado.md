# Estado da execução — classificacao-bncc

## Agora
- **Espero:** o `RELATÓRIO` do `Implementador` (linha 1) da tarefa 6.0 (porte grande), partida em 18/11, 1ª tentativa. A esteira de `9de64089` (soma com a correção da integração) se lê no encontro da 6.0; o `verificar` segue vermelho pelo `3209137c` até a resposta do Joaquim. E o `RELATÓRIO` do `Arquiteto` (no andar) com a medida local no `RETIDOS.json`: espera o Joaquim subir o llama-server na 8080 (em 18/11 05:05 não há llama-server nem modelo nesta máquina, WSL ou Windows); a da produção fica pendente da D37. E a resposta do Joaquim (A, B ou C) sobre o `3209137c` ("Esperando o Joaquim").
- **Devo ainda:** a 10.0 só parte com a medida do `Arquiteto` registrada; taxa fora do `padrao` é decisão do Joaquim. No fechamento, marcar `[x]` o item "(F4, retro, M3)" do `TODO.md`. Push da `develop` (retro da X6, `46ea2309`) no próximo pouso.
- **Base:** `spec/classificacao-bncc` em `9de64089`

## Concluídas
| Tarefa | Commit | Modelo | Rodadas | Observação |
|---|---|---|---|---|
| correção `2026-11-17-integracao-recusa-workers-de-pe` (M3 da F4, P da retro da X6, L1) | `e1670fbe` | Sonnet | test-engineer na 2ª; os outros cinco na 1ª | módulos novos `tools/testes/workers-de-pe.ts` e o `globalSetup` que recusa; 12 mutações; 2 linhas no `TODO.md`; o item (F4, retro, M3) fica `[ ]` até o fechamento; encontro em `95812d4e` |
| 1.0 | `fb384b1b` | Sonnet | test-engineer na 2ª (e2e do PATCH segurado com troca de disciplina); os outros seis na 1ª | divergência de portão no meio (compose órfão da X6, derrubado); 42 mutações; 8 fotos; recomendações sem aplicar foram ao `TODO.md`; encontro em `c4dddef8`, esteira verde em `95812d4` |
| 2.0 | `9224ee32` | Sonnet | os seis revisores na 2ª | portão com 59 mutações; sem tela; encontro em `ead27b4d` (tipagem e lint da soma passaram) |
| 3.0 | `924c6792` | Sonnet | conformidade-reviewer, test-engineer e revisor-geral na 2ª; os outros cinco na 1ª | máquina reiniciou no meio da correção da 1ª rodada; retomada às 18:33; sem tela; encontro em `f78d58ae` |
| 4.0 | `0adb2983` | Sonnet | test-engineer e revisor-geral na 3ª (escalada na 2ª, diagnóstico do `Arquiteto 2`: faltava afirmar `consumo_ia` em três casos); os outros cinco na 2ª | sem tela; encontro em `75619c5f` (tipagem e lint da soma passaram) |
| correção `2026-11-17-esteira-vermelha-desde-a-3-0` (da 3.0, L1) | `a590dafd` | Sonnet | test-engineer e revisor-geral na 2ª; os outros seis na 1ª | dois e2e com o número 3 escrito passam a ler o catálogo `FUNCOES`; o `fila-de-ia` já viera na 4.0; encontro em `63bbb635` |
| correção `2026-11-17-metricas-com-escola-da-4-0` (da 4.0, L1) | `97baf9f8` | Sonnet | revisor-geral na 2ª; os outros cinco na 1ª | `material.classificacao.espera` fica com `escola_id` (Tech Spec 7c) e entra na lista do teste; encontro em `d89816f5` |
| 5.0 | `792c2e6b` | Sonnet | os seis revisores na 2ª | carga das 300 apostilas rodada (~00:50 a ~04:00, adaptador falso, ~4 execuções por minuto pelo balde do lote); sem tela; encontro em `0b70fde8` (tipagem e lint da soma passaram) |
| correção `2026-11-18-integracao-vermelha-da-5-0` (da 5.0, L1) | `b8fbdeea` | Sonnet | os sete revisores na 1ª; revisor-geral e test-engineer também na 2ª | o `esperarExtracao` do teste deixa de enfileirar a classificação, que o FakeAdapter rodava somando chamada e consumo; encontro em `9de64089` |

## Esperando o Joaquim
## 17/11 08:55 — retro da X6, no terminal do `Arquiteto 2`
Decisão: as propostas de confirmação M1 a M7 e o P (fazer a M3 da F4 antes das tarefas da F4b; a M4 da F4 com a M7). Os avisos 1 a 4 aplicam às 09:25 sem objeção.
Arquivo: `tasks/prd-reengenharia-continuacao/retro.md` (térreo, sem commit). Responde-se "aprovo" ou os números recusados, no terminal do `Arquiteto 2`.
**Respondida em 17/11 09:54: "aprovo".** Retro em `46ea2309`.
## 17/11 — perguntas da Tech Spec da F4b, no terminal do `Arquiteto`
IA no worker, questão sem classificação, componente, horário. O `Arquiteto` avisa o Joaquim.

## 17/11 — revisão da spec da F4b, no terminal do `Arquiteto`
Decisão: o tamanho (uma spec, teto maior, ou F4c) e quem confere o lote de referência.
**Respondida em 17/11: uma spec só, com teto de 2.800 palavras e 13 tarefas; um professor confere o lote retido antes do primeiro aluno real.**

## 17/11 ~22:35 — o commit do lote retido deixa o `verificar` vermelho, no meu terminal
Decisão: como tirar da esteira o `3209137c` (lote retido, meu), que o `conferir-entregas` recusa por levar código de processo sem a linha `Fora do processo:`. Fica vermelho em todo push da spec até o pouso.

## O que falhou
- 17/11 ~21:10 — tarefa 4.0: ESCALADA da Mesa, o test-engineer reprovou na r1 e na r2 (na r2, faltou afirmar `consumo_ia` nos casos paralelos de entrega dupla). Diagnóstico pedido ao `Arquiteto 2` no checkout da L1. A seção "Revisões" do `4_task.md` sumiu (protocolo, item 5).
- 17/11 ~22:30 — a esteira está vermelha desde a 3.0 (integração e e2e) e a 4.0 partiu sem correção antes; e o meu commit do lote (`3209137c`) saiu sem a linha `Fora do processo:`, e o `verificar` o recusa. Correção da esteira partiu na L1; o do `verificar` é pergunta ao Joaquim.
- 17/11 ~23:20 — a esteira da 4.0 (44215554483) trouxe um vermelho novo: infra `metricas.int.test.ts`, 20 séries com `escola_id` contra 17. Correção na L1 antes da 5.0.
- 18/11 ~05:05 — a esteira de `d89816f5` (44225384638) caiu no infra 3/3 (`alertas.int.test.ts`, novo) e no e2e 1/11 (`npm ci` do build do `despachante-2` falhou no runner, antes de qualquer teste: não é código); o `verificar` é o `3209137c`. Correção dos alertas na L1 antes da 6.0.
- 18/11 ~05:35 — a esteira de `0b70fde8` (44262036782, com a 5.0) caiu na integração (19 testes, `chamar` chamado 2 vezes no adaptador), que passara em `d89816f5`. Correção na L1 antes da 6.0.
## O que decidi sem perguntar
- 18/11 05:39: a correção `2026-11-18-alertas-do-ensaio-na-esteira` voltou em FALHA sem commit: não reproduz (local 2/2 verde, a 2ª sob carga) e o infra 3/3 passou na 44262036782; entre `75619c5f` e `d89816f5` nada de runtime de login mudou. Aceitei como intermitência do runner: linha solta (`abandonar 1`), sem mexer na regra; se voltar, reexecutar só o job, e com nova queda pedir a amostragem de numerador e denominador no ensaio.
- 17/11 18:35: a máquina reiniciou com a 3.0 na correção da 1ª rodada. Religuei o time (Validador e os pares 2 e 3 apontavam para andares apagados da X6: `mkdir` da pasta velha, `recruit --replace`, `rmdir`; pares 2 e 3 parados no térreo) e mandei `PEDIDO de retomada` ao Implementador, com o trabalho na árvore da L1.
- 17/11: DIVERGÊNCIA (portão) do Implementador na 1.0: workers de pé em `educa-teste-1` eram órfãos da reengenharia-continuacao (pousada, checkout apagado). Não é defeito de código, então sem `corrigir`: derrubei `educa-teste`, `-1`, `-2` e `-3` e mandei retomar.
- 17/11: a esteira de `c4dddef` (execução 44124266993, depois da 1.0) caiu no e2e 2/11 antes de qualquer teste: o `docker buildx` do runner morreu (`target worker-interativo-2: failed to receive status: rpc error … EOF`). É falha do runner, não do código: sem `corrigir`; o veredito vem da esteira de `ead27b4d`, que cobre a 1.0 e a 2.0, e a 3.0 partiu.
