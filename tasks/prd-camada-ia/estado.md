# Estado da execução — camada-ia

## Agora
- **Espero:** o `RELATÓRIO` das três linhas, retomadas às 19:07 depois da parada pedida pelo Joaquim (16:05; sessões mantidas, o Maestri reabriu às 19:03 e o CLI foi religado ao socket novo): `Implementador 2` (L2) da 6.0 (partida 08:28), 1ª rodada às 19:45 com o `test-engineer` reprovando (2 bloqueantes de teste/e2e), ordem r1 em atendimento; `Implementador 3` (L3) da correção `2026-11-21-e2e-professores-convite-vencido-no-celular`, com a causa confirmada. A 8.0, última da F5a, parte depois da 6.0.
- **Devo ainda:** para a retro, `tools/processo/revisoes-nao-se-perdem.test.ts` caiu sob carga no portão da L1 e passou isolado (3/3). antes do pouso, o `Arquiteto` acrescentar à autoconferência 10 e à tabela de testes do `2_task.md` o caso novo da corrida do retrato (relatório da 2.0). Push da `develop` (a retro `6496c7b5` está sem push) no próximo pouso. A 13.0 depende das chaves de teste dos finalistas, que são do Joaquim (PRD §10).
- **Base:** `spec/camada-ia` em `ac6f1796` (com a correção do e2e da Operação, `bb4395de`); esteira 44961792455 rodando; última verde `1a291ab`; `7d86cae` vermelha só em e2e 10/11 (a Operação, agora corrigida) e `5a90726` em e2e 11/11 (Professores, na L3)

## Concluídas
| Tarefa | Commit | Modelo | Rodadas | Observação |
|---|---|---|---|---|
| correção `2026-11-21-limpeza-do-e2e-com-orcamento-do-mes` (da 2.0, L3) | `39da363b` | Sonnet | `test-engineer` e `revisor-geral` na 2ª; os outros quatro na 1ª | 4 mutações; encontro em `544f6285` |
| correção `2026-11-21-integracao-no-teto-da-esteira` (L1, esteira 44887365743) | `190427bb` | Sonnet | 4 revisores APROVADO na 2ª | integração em três fatias com `--shard`, teto de 25 min cada; encontro em `116d53e3` pelo Orquestrador, depois do desligamento (o relatório não chegou a ser enviado) |
| 7.0 | `edee568c` | Sonnet | 7 revisores APROVADO na 2ª | encontro em `f74f44b0`; DIVERGÊNCIA (ordem) no item 6 da r1, triada pelo `Arquiteto` como mal-entendido; telas vistas pelo Implementador (a vitrine não tem operador); apontou `orcamento_ia_do_mes` fora da limpeza do e2e (correção na L3) e dois e2e intermitentes (E3 celular, W4 chromebook) |
| 5.0 | `83292427` | Sonnet | `test-engineer` e `revisor-geral` na 2ª; os outros quatro na 1ª | encontro em `cc6e316c`; o `5_task.md:43` corrigido para ENTRADA_INVALIDA |
| 3.0 | `57c9182a` | Sonnet | `test-engineer` e `revisor-geral` na 2ª; os outros quatro na 1ª | encontro em `e6e2690c`; 4 divergências registradas em `cenarios.md`/`techspec.md`; o `5_task.md:43` cita VALIDACAO (o código é ENTRADA_INVALIDA), dito à 5.0 |
| 4.0 | `5d8332d7` | Sonnet | `test-engineer` e `revisor-geral` na 2ª; os outros cinco na 1ª | encontro em `47c16e14` |
| 2.0 | `67ea22b2` | Sonnet | 6 revisores APROVADO, na 1ª e na 2ª | encontro em `a545ab9f`; `TODO.md` "Da camada-ia, tarefa 2.0" e a 0067 na lista das migrations sem `concurrently` |
| correção `2026-11-21-achado-com-caminho-relativo` (M5 da F4b, L1) | `628218b6` | Sonnet | 6 revisores APROVADO na 2ª | 20 mutações; encontro em `082d4d99`; o histórico já gravado em `tasks/*/achados/` segue com o caminho da máquina (entrada no `TODO.md`, decisão do Joaquim) |
| correção `2026-11-21-limpeza-do-painel-com-job-registro` (L3, esteira 44862658083) | `185f67f8` | Sonnet | 6 revisores APROVADO na 2ª | `job_registro` e `expurgo_execucao` apagados antes da escola; 4 mutações; encontro em `59ff170b` |
| correção `2026-11-21-divergencia-cobra-cada-arquivo` (M1 da F4b, L1) | `7cb4754b` | Sonnet | 3 revisores APROVADO na 3ª | 40 mutações; encontro em `460d1b3d`; 2 linhas no `TODO.md` |
| 1.0 | `a2f4ffd4` | Sonnet | `revisor-geral` e `test-engineer` na 2ª; os outros cinco na 1ª | encontro em `87fb2505`; 2 recomendações no `TODO.md` ("Da camada-ia, tarefa 1.0"); um preenchimento do `1_task.md` por script, antes de haver "Revisões" |
| correção `2026-11-21-commit-de-processo-fora-de-tarefa` (M3+M4 da F4b, L3) | `7b69f130` | Sonnet | 6 revisores APROVADO na 2ª | 22 mutações; 7 itens no `TODO.md` |
| correção `2026-11-21-inventario-no-portao` (M2 da F4, L1) | `2dcf4891` | Sonnet | `revisor-geral` na 2ª; os outros cinco na 1ª | 5 mutações; `TODO.md`: M2 marcada e uma linha nova |
| correção `2026-11-20-faltando-junta-and-de-varias-linhas` (M4 da X6, L2) | `e2dd889a` | Sonnet | 4 revisores APROVADO na 2ª | 61 mutações; `TODO.md`: M4 marcada e 3 itens na seção da F4b |
| correção `2026-11-20-revisoes-nao-se-perdem-por-script` (M2 da X6, L1) | `bdcef966` | Sonnet | 6 revisores APROVADO na 2ª | 29 casos, 22 mutações; `TODO.md`: M2 marcada e uma linha para a retro |

## Esperando o Joaquim
## 20/11 23:28 — F5 camada-ia, o tamanho da spec, no meu terminal
Decisão: 13 tarefas, uma acima do teto de 12: seguir com uma spec só ou cortar em F5a (1.0 a 8.0, custo e orçamento) e F5b (9.0 a 13.0, reserva e avaliação).
Contexto: `RELATÓRIO` do `Arquiteto`, 23:24; `tasks/prd-camada-ia/tasks.md`. A 13.0 depende das chaves de teste dos finalistas, que são do Joaquim (PRD §10).
Opções: uma spec só, com teto de 13 | F5a e F5b
Recomendo: cortar em F5a e F5b. Numa spec só, o pouso inteiro espera a 13.0, que espera as chaves; cortada, a F5a (custo e orçamento) pousa sem depender delas. Se as chaves chegam logo, uma spec só serve.
Segue sem depender: as correções M2 e M4 da X6 (processo) e a 1.0 em diante, que estão nas duas opções.
**Respondida em 21/11 13:48:** cortar em F5a (1.0 a 8.0, custo e orçamento, pousa neste andar) e F5b (9.0 a 13.0, reserva e avaliação, spec seguinte). Pedido ao `Arquiteto` para aplicar o corte nos documentos.

## O que falhou
- 21/11 ~09:50: esteira de `0e85765` (44903191816), já com a integração em três fatias, dentro do teto: caem dois testes que o estouro escondia. Integração 3/3: `ops-escola.int.test.ts`, as rotas `PUT …/orcamento-ia` da 3.0 fora da lista conferida (correção na L1). Integração 1/3: `tutor-modelo.int.test.ts:99`, o modelo falso recebe 17 pedidos em vez de 2 (correção na L3).
- 21/11 ~08:40: o PC foi desligado com as três linhas trabalhando; às 09:11 o time voltou com sessões novas e o Docker parado (aberto daqui). Na L1, 16 arquivos rastreados ficaram com 0 byte (os que o merge `cc6e316c` tinha escrito): restaurados do commit; `git fsck` limpo, nenhum outro checkout afetado.
- 21/11 ~07:4x: esteira de `21e6186` (44887365743): o job de integração cancelado no `timeout-minutes` de 30; nas verdes anteriores, 22, 28,5 e 28,3 min. Não é intermitência: o job encostou no teto. Correção na L1, antes de qualquer partida.
- 21/11: esteira de `970e37c` (44862658083) vermelha no e2e 4/11: `operacao-escolas.spec.ts:595`, o `afterEach` apaga a escola com `job_registro` dela (FK). A spec só mudou processo até aqui: defeito da develop, correção na L3. O encontro da L3 passou de 10 min (a verificação tem prazo de 540 s) e terminou bem.
- 20/11 21:4x: o `maestri floor delete` do andar L1 da F4b deu "malformed floorLifecycleVerdictResult frame": o andar saiu da lista, mas o checkout e a branch ficaram; removi à mão (contidos na `develop`). Depois, o `recruit --replace` dos dois Arquitetos falhou pela pasta da L1: pasta vazia, replace, rmdir; `Implementador` e `Mesa` reapontados para o térreo.
## O que decidi sem perguntar
- 21/11 19:46: a `Mesa 2` escalou a 6.0 por duas reprovações seguidas do `test-engineer`, mas a 1ª era da revisão das tarefas (20/11 23:21), registrada na mesma seção "Revisões" do documento, e não uma rodada da tarefa. Gravei a linha `destravado … depois da 1ª rodada dele` no `rodadas.md` da L2 e a ordem r1 seguiu como 1ª reprovação, sem diagnóstico. Para a retro: a contagem da Mesa (e do hook) inclui a revisão das tarefas.
- 21/11 15:42: a 6.0 caiu no 3º portão pela duração de `e2e/governanca.spec.ts:63` (20 s, limite 15 s), caso alterado por ela, e o `Implementador 2` repetia o portão esperando a máquina folgar. Mandei parar o 4º e encurtar ou dividir o caso, como o portão pede (passo 7, "Máquina não é parada"); sem reinício, para não perder o contexto.
- 21/11 ~08:1x: DIVERGÊNCIA (ordem) da 7.0, item 6 da ordem r1 (`textoDaFalha` deixa o `restos.test.ts` vermelho). Triagem do `Arquiteto` na L2: mal-entendido, o item não se aplica (homônimo do X8, só nos arquivos do mapa `10.json`); vai a "Recomendações sem aplicar", destino `TODO.md`. `PEDIDO de retomada` ao `Implementador 2`, sem reinício. Entra na observação da 7.0.
- 21/11 ~00:4x: a 1.0 partiu na L2 sem esperar a M2 da F4 (L1). O P da retro da F4b pede antes das tarefas só a M2 e a M4 da X6; a M2 da F4 vem "logo depois". A 1.0 não cria migration, que é o caso que o inventário pega.
