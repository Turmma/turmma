# Estado da execução — classificacao-bncc

## Agora
- **Espero:** a palavra do Joaquim para o pouso (pedida em 20/11 ~23:xx). Validação r2 APROVADA sobre `b65d4ab0`; esteira 44831599999: tudo verde menos o `verificar` (os commits do lote retido, decisão de 18/11); censo: 9 casos, todos dívida da `develop`, nenhum acima de 90%; linhas fechadas; fechamento commitado.
- **Devo ainda:** antes do pouso, rodar `npm run ci:verificar` e `npm run guarda:segredo` no andar (verdes em `b65d4ab0`, 20/11 ~22:46; 1.446 commits). No pedido de pouso: nenhum commit `Fora do processo:` com código; a esteira da spec segue vermelha no `verificar` pelos `3209137c`/`080e774f` (decisão de 18/11). Depois do pouso: apagar os andares L1 e L2, retro (`Arquiteto 2`) ao lado da próxima spec.
- **Correção `metodos-de-mercado` na spec (19/11 ~18:20, com a palavra do Joaquim):** merge `8e5c8b32` com push; L1 e L2 avançadas para ele (fast-forward, push; o lock não mudou); andar da correção apagado. Para o `Validador`: `openAnoLetivo` (antes `abrirAnoLetivo`) talvez seja ato de domínio (no documento da correção); o `TODO.md` ganhou 6 entradas.
- **Base:** `spec/classificacao-bncc` em `c53c062c`

## Concluídas
- correção `2026-11-20-descricao-oficial-da-habilidade` (L2, ressalva 2): `4d08de34`, encontro em `c53c062c` (20/11 ~22:0x); 7 revisores APROVADO, `test-engineer` e `revisor-geral` na 2ª. Fora (Tech Spec §5, `TODO.md`): resultado do aluno, Tutor, relatório e PDF. Esteira de `09d4e4f` (44823845900): `verificar` pelo `3209137c`/`080e774f` (conhecido) e e2e 3/11 por tempo esgotado no ghcr.io (rede do runner, não código); a de `c53c062c` decide.
- correção `2026-11-20-merge-da-develop-leitura-de-null` (L2): `133f1e2a`, encontro em `09d4e4fd` (20/11 ~18:45); 6 revisores APROVADO na 1ª, `test-engineer` e `revisor-geral` na 2ª. Fora do commit: duas linhas "Destino: TODO.md" da ordem r1 (renomear `habilidadesDaAtividade`; caminho absoluto em `achados/`), a levar no fechamento; o `Validador` confere os dois rótulos do PDF. Esteira de `ea37c69` (44811513915): só o `verificar`, pelo `3209137c` e o `080e774f` (conhecido, até o pouso).
- 13.0: `a2285bfe`, encontro em `8be34721` (20/11); 7 revisores APROVADO na 2ª. 13 de 13.
- 12.0: `c5a0afe5`, encontro em `e28ce2ee` (20/11); 5 revisores APROVADO na 1ª, `revisor-geral` e `test-engineer` na 2ª. A vitrine não tem questão sem habilidade: o estado novo é provado por teste e e2e.
- 11.0: `35fce4cb`, encontro em `2ec4b202` (20/11 ~05:5x); 7 revisores APROVADO na 2ª. Para o `Validador`: o seletor do Trocar aberto não sai nas fotos (a vitrine não tem artefato com Trocar ativo).
- 10.0: `b87be5a4`, encontro em `eefbace7` (20/11 ~02:40); r1 com divergência de ordem (triagem do `Arquiteto`, caminho a), r2 com escalada do `revisor-geral` (diagnóstico de documento), r3 aprovada. Esteira vermelha só pelo `conferir-entregas` já conhecido.
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
| 6.0 | `c148527c` | Sonnet | test-engineer na 2ª; tenancy, privacy, conformidade, infra e revisor-geral na 1ª | sem tela; portão verde com 39 mutações vermelhas; recomendações no documento e no `TODO.md`; encontro em `c80b431e` (tipagem e lint da soma passaram) |
| 7.0 | `5cd7e988` | Sonnet | test-engineer e revisor-geral na 2ª; tenancy, privacy, conformidade e infra na 1ª | sem tela; portão com 78 mutações; 14 linhas novas no `TODO.md`, e o resto sem aplicar em `.processo/ordens/7_task-r2.md`; encontro em `1a5aa033` (tipagem e lint da soma passaram). Esteira de `c80b431e`: só o `verificar` caiu (o `3209137c`), o resto foi cancelado; a reexecução da 44272795124 deixou o infra 3/3 verde |
| 9.0 (L2) | `ce645ba6` | Sonnet | test-engineer na 2ª; os outros cinco na 1ª | contração da F4 (licença no banco; o código deixa `material.licenciante`); a migration é a `0065` (e não a `0063`), e a volta para antes da F4 pede um passo no runbook, como diz a Tech Spec (divergências no `9_task.md`). O corpo do commit diz "sem o passo do runbook" por engano: vale a Tech Spec, "a menos de um passo". Recomendações sem aplicar no `TODO.md` e no documento. Encontro em `e0ed1252` (tipagem e lint da soma passaram) |
| 8.0 (L1) | `6daa198b` | Sonnet | revisor-geral e test-engineer na 2ª; frontend, conformidade, tenancy, privacy e infra na 1ª e na 2ª | tela: o painel do material mostra a classificação por capítulo, corrige com o seletor e pede a reclassificação; fotos pelo Implementador (6) e pela Mesa (10). Encontro em `ff4b3728` (tipagem e lint da soma passaram) |

## Esperando o Joaquim
## 20/11 ~23:xx — pouso da F4b, no meu terminal
Decisão: pousar a `spec/classificacao-bncc` na `develop`, com push.
Contexto: validação r2 APROVADA, 10 de 10 RF; esteira toda verde menos o `verificar` (lote retido, conhecido); nenhum commit `Fora do processo:` com código. A correção da leitura de `null` já está na `develop` (`e2e3213c`), como o §7c pedia.
Opções: pousar agora | esperar. Recomendo: pousar.

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
**Respondida em 18/11 ~13:05, no meu terminal: "faça o melhor".** Decisão em "O que decidi sem perguntar" (18/11 ~13:10).

## 18/11 15:35 — F4b, a medida local antes da 10.0, no terminal do `Arquiteto`
Decisão: subir o llama-server em 127.0.0.1:8080 com o qwen3.6-35b-a3b e responder "carregado" ao `Arquiteto`. Só a mão do Joaquim: nesta máquina não há o binário nem o modelo (procurado no WSL e no Windows às 15:34).
Contexto: a 10.0 é a única tarefa liberada e parte só com a medida no `docs/aia/ouro-retido/RETIDOS.json`; 11.0 a 13.0 esperam a 10.0. As duas linhas estão ociosas, e a vigia foi desligada.
Opções: carregar o modelo na 8080 | apontar outro servidor ou modelo para a medida (decisão de produto, com o `Arquiteto`)
Recomendo: carregar o qwen3.6-35b-a3b, que é o que a Tech Spec mede.

## 20/11 ~02:50 — pouso da correção `2026-11-20-leitura-de-habilidade-nula`, no meu terminal
Decisão: pousar na `develop` (com push) a correção que ensina a versão de hoje a ler `habilidade: null`, `habilidades: []` e `codigo: null`. Precisa chegar à `main` ANTES da classificacao-bncc (§7c, `TODO.md`).
Contexto: `e2e3213c`, conferida; 7 revisores APROVADO na 2ª; esteira da branch VERDE em 44683309238 (~03:20). A develop local leva junto a retro da X6 (`46ea2309`), sem push até aqui.
Opções: pousar agora | esperar a spec. Recomendo: pousar com a esteira verde.
**Respondida em 20/11 ~16:30: "pode pousar a correção".** Pousada em `e2e3213c`, push da `develop` (com a retro da X6), esteira 44802878978 VERDE.

## 20/11 ~10:00 — ressalvas maiores da validação da F4b, no meu terminal
Decisão: corrigir agora e revalidar, ou aceitar, cada uma. (1) três `@Unscoped` novos sobre `habilidade_bncc` no módulo material, contra a §6 e sem registro na §11 (regra 10, item 9; não é vazamento); (2) a descrição da habilidade gravada na questão é a do modelo, sem conferência, e aparece no artefato e no diagnóstico como texto da BNCC.
Arquivo: `tasks/prd-classificacao-bncc/validacao.md`, seção 4.
Recomendo: corrigir as duas agora (`corrigir`, uma por achado, em L1 e L2) e revalidar.
**Respondida em 20/11 ~16:30: "corrige as duas".**

## 20/11 ~16:35 — conflito no merge da `develop` na spec, no meu terminal
Decisão: como resolver o conflito (~30 arquivos de leitura de `habilidade`/`codigo` na API, na web e no core) entre a correção pousada e a spec.
Opções: correção na L2 (o `Implementador 2` faz o merge, fica com o comportamento da spec, mantém os testes dos três formatos da correção, portão e Mesa) | outra.
Recomendo: correção na L2; depois dela, a ressalva 2 na mesma linha.
**Respondida em 20/11: "resolve o conflito na L2".**

## O que falhou
- 20/11 ~18:17: a máquina reiniciou de novo, com o portão do merge da L2 em curso; as sessões voltaram limpas. Retomada enviada ao `Implementador 2` às 18:19 (compose órfão derrubado, integração dos dois testes rodando).
- 20/11: o `recruit --replace` do par 2 falhou ("WSL working directory does not exist"): os terminais apontavam para o andar da correção já pousado. Conserto conhecido (pasta velha vazia, replace, rmdir). O pedido caiu antes na sessão velha, que começou o `git merge develop` na L2; a sessão nova continua dele.
- 20/11: esteira de `eefbace7` (depois da 10.0) VERMELHA também na integração: `atividade.int.test.ts` › "encerrar corrige" (o portão da tarefa roda só os alvos alterados). Correção na L1 antes da 12.0.
- 20/11: `tools/processo/revisoes.test.ts` › "o índice compartilhado não perde linha com rodadas terminando ao mesmo tempo" caiu uma vez sob carga no 2º portão da correção (código de saída 1 em vez de 0) e passou isolado duas vezes e no portão seguinte. Instável; se repetir, correção que o torne independente da carga.
- 17/11 ~21:10 — tarefa 4.0: ESCALADA da Mesa, o test-engineer reprovou na r1 e na r2 (na r2, faltou afirmar `consumo_ia` nos casos paralelos de entrega dupla). Diagnóstico pedido ao `Arquiteto 2` no checkout da L1. A seção "Revisões" do `4_task.md` sumiu (protocolo, item 5).
- 17/11 ~22:30 — a esteira está vermelha desde a 3.0 (integração e e2e) e a 4.0 partiu sem correção antes; e o meu commit do lote (`3209137c`) saiu sem a linha `Fora do processo:`, e o `verificar` o recusa. Correção da esteira partiu na L1; o do `verificar` é pergunta ao Joaquim.
- 17/11 ~23:20 — a esteira da 4.0 (44215554483) trouxe um vermelho novo: infra `metricas.int.test.ts`, 20 séries com `escola_id` contra 17. Correção na L1 antes da 5.0.
- 18/11 ~05:05 — a esteira de `d89816f5` (44225384638) caiu no infra 3/3 (`alertas.int.test.ts`, novo) e no e2e 1/11 (`npm ci` do build do `despachante-2` falhou no runner, antes de qualquer teste: não é código); o `verificar` é o `3209137c`. Correção dos alertas na L1 antes da 6.0.
- 18/11 ~05:35 — a esteira de `0b70fde8` (44262036782, com a 5.0) caiu na integração (19 testes, `chamar` chamado 2 vezes no adaptador), que passara em `d89816f5`. Correção na L1 antes da 6.0.
## O que decidi sem perguntar
- 20/11 ~23:xx: o `esteira.ts --censo` leu a execução de 17/11 (`ead27b4`), a última toda verde, porque o `verificar` cai desde o lote retido. Rodei `fazerOCenso` à mão sobre a 44831599999 (`b65d4ab`), cujas 11 fatias de e2e estão verdes: 9 casos, nenhum em arquivo da spec, nenhum acima de 90%. Uma linha no `TODO.md` para a dívida e outra para o Arquiteto ensinar o censo a ler a execução com o e2e verde.
- 20/11 ~00:30: correção da leitura de `null` aberta como avulsa na `develop` (decisão do `Arquiteto`, §7c), com o par da L2, que não tem tarefa liberada até a 10.0 se encontrar. O portão das duas entra na fila do `flock`.
- 18/11 ~13:10 (delegada pelo Joaquim, "faça o melhor"): o `3209137c` fica como está, e o `verificar` vermelho até o pouso. Reescrever a mensagem pede reescrever a `spec/classificacao-bncc` com push forçado e rebasear a L1 e a L2 no meio da 8.0 e da 9.0; mudar o `conferir-entregas` para isentar um hash é furar a barreira; e um commit depois não conserta o de antes. O pouso não confere as entregas, e depois do merge o commit está na `origin/develop` e sai do intervalo. O custo é a esteira pular o `ci:verificar` (tipos, lint, guardas, segredo, dependências), e ele se compensa rodando-o no andar em cada encontro e antes do pouso. Em `1a5aa033`, 18/11 13:12: verde. Na esteira 44336978062, todos os outros jobs passaram.
- 18/11 ~09:45: a esteira de `9de64089` (44272795124) caiu de novo no infra 3/3, no mesmo `alertas.int.test.ts` (prazo de 540 s do ensaio). Como combinado às 05:39, reexecutei só o job (134693328349) e parti a 7.0. Se cair de novo, na reexecução ou na esteira de `c80b431e`: correção na L1 pedindo a amostragem de numerador e denominador no ensaio.
- 18/11 05:39: a correção `2026-11-18-alertas-do-ensaio-na-esteira` voltou em FALHA sem commit: não reproduz (local 2/2 verde, a 2ª sob carga) e o infra 3/3 passou na 44262036782; entre `75619c5f` e `d89816f5` nada de runtime de login mudou. Aceitei como intermitência do runner: linha solta (`abandonar 1`), sem mexer na regra; se voltar, reexecutar só o job, e com nova queda pedir a amostragem de numerador e denominador no ensaio.
- 17/11 18:35: a máquina reiniciou com a 3.0 na correção da 1ª rodada. Religuei o time (Validador e os pares 2 e 3 apontavam para andares apagados da X6: `mkdir` da pasta velha, `recruit --replace`, `rmdir`; pares 2 e 3 parados no térreo) e mandei `PEDIDO de retomada` ao Implementador, com o trabalho na árvore da L1.
- 17/11: DIVERGÊNCIA (portão) do Implementador na 1.0: workers de pé em `educa-teste-1` eram órfãos da reengenharia-continuacao (pousada, checkout apagado). Não é defeito de código, então sem `corrigir`: derrubei `educa-teste`, `-1`, `-2` e `-3` e mandei retomar.
- 17/11: a esteira de `c4dddef` (execução 44124266993, depois da 1.0) caiu no e2e 2/11 antes de qualquer teste: o `docker buildx` do runner morreu (`target worker-interativo-2: failed to receive status: rpc error … EOF`). É falha do runner, não do código: sem `corrigir`; o veredito vem da esteira de `ead27b4d`, que cobre a 1.0 e a 2.0, e a 3.0 partiu.
