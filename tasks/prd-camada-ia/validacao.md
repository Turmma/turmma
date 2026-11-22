# Validação — camada-ia (F5a)

## Rodada 1 — 22/11/2026

**Escopo:** funcionalidade completa (F5a: tarefas 1.0 a 8.0; a 9.0 a 13.0 são a F5b e ficam fora)
**Commit validado:** `5899c8cc`
**Veredito: APROVADA**

Lidos: `docs/visao-produto.md` (§1 e §2), `prd.md`, `techspec.md`, `tasks.md`, `cenarios.md`, o bloco F5a do `ROADMAP.md`,
as regras 00, 10, 20, 30, 40, 50, 60, 70 e 80, os oito `N_task.md` (seções "Revisões" e "Recomendações sem aplicar"),
`revisao-spec.md`, `achados/indice.md` e `estado.md`. Os commits são os oito `(tarefa N.0)` (`a2f4ffd4`, `67ea22b2`,
`57c9182a`, `5d8332d7`, `83292427`, `918f93ac`, `edee568c`, `2dee369e`) e as correções `(correção …)` entre eles. Nenhum
commit levou código sem `(tarefa N.0)` nem `(correção …)`, e não há commit `Fora do processo:` com código da spec
(`git log origin/develop..HEAD -i --grep='^Fora do processo:' -- apps packages infra e2e tools` vazio).

### 1. RF a RF

| RF | Situação | Código | Teste | Observação |
|---|---|---|---|---|
| RF5 | ATENDIDO | `packages/core/src/ia/llm-gateway.ts:552` (`linhasDeConsumo`, uma linha por chamada enviada, com o modelo e o custo de cada uma; `entrada`/`saida` só na última), `:533` (`chamadaFeita`, chave `provedor:modelo`), `:417` (`chamarContando`: a que não saiu não é chamada) | `llm-gateway.test.ts` ("troca para o menor: duas linhas, cada uma com o seu modelo e o seu preço"; "primeira saída inválida e a segunda válida: duas linhas…"; "disjuntor aberto no lote: nenhuma linha…"; "…fora do lote: uma linha da falha…"); `apps/api/src/ia/ia.int.test.ts` (as mesmas duas no banco, e "a linha é da escola de quem gastou"); `governanca.int.test.ts` (execuções por `count(distinct execucao_id)`) | A parte da reserva é da F5b. Sem envio externo (local, falso) o `provedor` fica nulo e a `origem` diz quem atendeu, como a X6 deixou |
| RF6 | ATENDIDO | `packages/core/src/ia/consumo.ts:126` (`PRECO_DOS_MODELOS`, com `vigenteDesde` e `fonte`), `:132` (`precoDoModelo`, a vigência do instante), `:147` (`custoDaChamada`, para cima, em inteiros); `llm-gateway.ts:541` (`chamadaSemUso`: entrada contada e saída no teto, com custo); `llm-gateway.ts:657` e `config/llm-config.ts:233` (a subida sem preço fora de `local`) | `consumo.test.ts` ("3.000 de entrada e 250 de saída… 5.200"; "a fração de micro arredonda para cima"; "cada chamada fica no preço da sua vigência"; "o mesmo modelo em dois provedores tem dois preços"); `llm-gateway.test.ts` ("duas vigências do mesmo modelo… a linha antiga não muda"; "`AMBIENTE=producao`… recusa citando `LLM_MODELO`"; "o preço precisa já estar vigente"); `ia.int.test.ts` ("o prazo esgotado depois do envio: … custo maior que zero"); `orcamento-do-mes.repository.int.test.ts` ("duas vigências de preço no mês: a soma usa o custo gravado") | O custo da execução interrompida segue zero (`consumo.ts:86`): é da F5b pelo PRD §6, decisão do Joaquim de 21/11 |
| RF7 | ATENDIDO | `apps/api/src/operacao/painel/painel.service.ts:246` (`PUT` da escola: transação, `lockConfiguracaoDaEscola` com `insert … on conflict do nothing` e `for update`, audita só quando muda), `:277` e `orcamento-da-rede.repository.ts` (`PUT` da rede, o único `@Unscoped`); `packages/shared/src/governanca/orcamento-de-ia.ts:40` (`orcamentoVigente`, coluna a coluna); `packages/core/src/auditoria/acoes.ts:125,132`; tela `apps/web/src/operacao/components/DialogoDoOrcamento.tsx:79` | `orcamento-de-ia.test.ts` ("escola com teto próprio e sem valor… a precedência é por coluna"); `apps/api/test/painel-escrita.int.test.ts` (bloco "camada-ia 3.0": auditoria com o apelido, o mesmo `PUT` não audita, faixa 0/100,01/99/1001 → `ENTRADA_INVALIDA`, inexistente → `NAO_ENCONTRADO`, isolamento A/B e rede 1/2, 429, as quatro corridas); `DialogoDoOrcamento.test.tsx`; `e2e/operacao-escolas.spec.ts` | Fotos: `operador--escolas-orcamento-a--computador.png` (escola: "Vale hoje", "Usar o valor da rede", Antes/Depois, "Salvar orçamento"), `operador--escolas-orcamento-b--celular.png` (rede, com "Depois: R$ 4,00 por aluno"), `operador--uso-definir-orcamento--{computador,celular}.png`. Sem rolagem lateral a 360 px |
| RF8 | ATENDIDO | `packages/shared/src/governanca/orcamento-de-ia.ts:104` (`orcamentoDoMes`: valor × alunos ativos, porcentagem inteira para baixo), `packages/core/src/ia/orcamento-do-mes.repository.ts:26` (`alunosAtivosDaEscola`, a mesma conta da aba Escolas), `:47` (`faixaDoMes`, mês civil de São Paulo), `:155` (`consultaDoCustoDoMes`, pela escola do contexto) | `orcamento-de-ia.test.ts` ("100 alunos, R$ 5 e R$ 400 gastos: … 80%"; "31/03 às 23h30 (UTC-3) é de março"); `orcamento-do-mes.repository.int.test.ts` (as bordas do mês; os alunos ativos: encerrado, chegou agora, duas turmas, ano anterior, sem ano em curso; o retrato do mês fechado; o isolamento A 20% / B 111%) | Mutação 1 (abaixo) |
| RF9 | ATENDIDO | `orcamento-de-ia.ts:95` (`avisoDaPorcentagem`, `>=`, só no mês corrente); `apps/api/src/governanca/governanca.service.ts:121`; `apps/worker/src/orcamento-gauge.ts:25` (a medida de 5 min); `infra/grafana/alertas/ia-orcamento-do-mes.yaml` (80% e 100%), `ia-orcamento-teto.yaml`; `docs/runbook.md:1609,1631,1650`; tela `apps/web/src/areas/coordenacao/governanca/OrcamentoDoMes.tsx` | `orcamento-de-ia.test.ts` ("79,99% é 79 e sem aviso, 80% é 80…"; "o mês fechado a 120% não traz aviso"); `governanca.int.test.ts` (a 79/80/100, no mês seguinte e no fechado); `apps/worker/test/orcamento-gauge.int.test.ts` ("0,79 → 0,81 → 1,02 para a escola certa"); `infra/test/alertas.test.ts`, `tools/guardas/alerta-tem-runbook.test.ts`; `orcamento-teto.int.test.ts` (acima de 100% a IA responde) | "Uma vez por limiar por mês" é um estado (o limiar já cruzado), não um evento por chamada: nada se repete a cada chamada, e na virada o aviso some. Fotos: `coordenacao--coordenacao-painel--computador.png` ("IA do mês: 86% do previsto." e o aviso de 80% "Nada é cortado."), `coordenacao--coordenacao-governanca--celular-2.png` |
| RF10 | ATENDIDO | `apps/api/src/ia/orcamento.repository.ts:68` (só a fila `lote` confere o teto), `:93` (`#tetoDeSeguranca`: `>` em inteiros, espera = mín(virada, 3.600 s), sem orçamento nunca segura); `llm-gateway.ts:346` (a fila vai à consulta); `apps/api/src/ia/execucao.processor.ts:339` (adia só o `lote` com `IA_ORCAMENTO_ESGOTADO`, motivo `orcamento`) | `apps/api/src/ia/orcamento-teto.int.test.ts` ("teto 200%: no limite exato o lote segue; um micro acima… `JobAdiadoError(orcamento)`… `ia.lote.adiado` +1"; "600 s às 23h50 do último dia"; "na virada do mês o lote adiado roda; e com o teto subido…"; "`sem_orcamento` ou `sem_aluno_ativo`: o lote nunca é adiado"; "acima do teto, uma ferramenta e um turno do Tutor… terminam `concluida`"; "A (20%) segue e B (111%) é adiada"); `orcamento.repository.test.ts` | Mutação 2 (abaixo). O alerta do teto tem runbook e cita "Classificação do material atrasada" |
| RF11 | ATENDIDO | `apps/api/src/operacao/painel/painel.repository.ts:195` (`usoDaPaginaSql`: hoje e mês de São Paulo, `COLUNAS_DO_USO_DE_IA`, alunos ativos, orçamento próprio e da rede), `:160` (ordem `custo`), `:359` (`uso()`, `@Unscoped` com justificativa); `painel.service.ts:88` (`iaDaEscola`), `:170`, `:189` (12 meses pelo `OrcamentoDoMesRepository`, sem `@Unscoped`); `orcamento-do-mes.repository.ts` `usoDosMesesAnteriores`; `painel.controller.ts:68`; telas `apps/web/src/operacao/pages/Uso.tsx:84` (`COLUNAS_DE_IA`), `:106` (`VerMeses`), `components/MesesDeIa.tsx:56` | `apps/api/test/painel-leitura.int.test.ts` (bloco "camada-ia 5.0": A 20%/100 e B 111%/900, a chamada de 23h30 do último dia, ordem por custo, `sem_orcamento`, `sem_aluno_ativo`, `ordem=custo` só no uso, os 12 meses com retrato e consumo só de A, `NAO_ENCONTRADO`; e a linha com `rede` e `orcamento` da 8.0); `apps/api/test/contracts.test.ts` (sem campo de pessoa); `operacao-isolamento.int.test.ts` (sessão de escola: 404 em toda rota `@OperacaoRoute`); `Uso.test.tsx`, `MesesDeIa.test.tsx`; `e2e/operacao-uso.spec.ts` (26 casos, nos dois projetos) | Fotos: `operador--uso-ordem-custo--computador.png` (a página não rola a 1366 × 768; a tabela rola por dentro), `operador--uso-colunas-de-ia--computador.png` (8 chamadas, 14.750 tokens, R$ 8,60, "R$ 4,30 de R$ 5,00", "86% do orçamento", reserva 0, e "sem orçamento definido"/"sem aluno ativo" na linha seguinte), `operador--uso-ver-meses--{computador,celular}.png` (outubro 15%, setembro "sem aluno ativo", agosto "sem retrato (antes da medição)"), `operador--uso-primeiro-cartao--celular.png`, `operador--uso-vazio--{computador,celular}.png` ("Nenhuma escola criada ainda." com "Ir para Escolas"). Conferi os números contra o banco: batem. Ver o menor sobre a largura da tabela a 1366 px |
| RF12 | ATENDIDO | `packages/shared/src/governanca/governanca.ts:107` (`orcamentoDoConsumoSchema`, estrito, só `situacao`/`porcentagem`/`aviso`), `:121` e `:132` (`parte` e `execucoes`, sem token nem custo); `governanca.service.ts:121` (só a `parte` sai; o custo fica no serviço); `apps/web/src/areas/coordenacao/painel/Painel.tsx:161`, `governanca/Governanca.tsx:170`, `governanca/OrcamentoDoMes.tsx` | `packages/shared/src/governanca/governanca.test.ts` (o schema recusa `tokens*` e `custoMicros`); `governanca.int.test.ts` (a `parte`, zero token, sem ano em curso, professor e aluno 404, a auditoria do orçamento fora da leitura da coordenação); `textos-da-governanca.test.ts` (sem "R$", "token" nem "crédito"); `Governanca.test.tsx`, `Painel.test.tsx`; `e2e/governanca.spec.ts`, `e2e/painel-da-coordenacao.spec.ts` | Mutação 3 (abaixo). Fotos: `coordenacao--coordenacao-painel--computador.png`, `coordenacao--coordenacao-governanca--computador.png` e `--celular-2.png` ("Assistente de ensino · 76% do que a IA trabalhou no mês · 5 execuções", "Tutor · 24%", conferido contra o banco: 11.250 e 3.500 de 14.750 tokens), `vazia--coordenacao--coordenacao-painel--celular.png` ("O previsto de IA da escola ainda não foi definido. A equipe Turmma define com vocês."). Nenhuma escreve R$ nem token |

RF1 a RF4 e RF13 a RF16 são da F5b, pelo corte de 21/11/2026, e não foram avaliados.

Provas de mutação (cada uma restaurada com `git checkout -- <arquivo>`; a árvore terminou limpa):

| RF | Cláusula removida | Teste que ficou vermelho |
|---|---|---|
| RF8 (regra 10) | `eq(consumoIa.escolaId, requireEscolaId())` na soma do mês (`packages/core/src/ia/orcamento-do-mes.repository.ts:160`) | `orcamento-do-mes.repository.int.test.ts` › isolamento: 5 de 5 vermelhos ("A gastou R$ 100…": `expected 5909330000 to be 100000000`; variantes 1 e 2; retrato; "sem escola no contexto a leitura falha fechada") |
| RF10 (Tutor e ferramenta nunca param) | `consulta.fila === 'lote'` trocado por `consulta.fila !== undefined` (`apps/api/src/ia/orcamento.repository.ts:68`): o teto passa a valer em toda fila | `orcamento-teto.int.test.ts`: 2 vermelhos ("acima de 100% e do teto, `interativa`, `ferramenta` e `normal` são atendidas…" e "…uma ferramenta e um turno do Tutor, pelo processador e pelo gateway de verdade, terminam `concluida`…") |
| RF12 (a coordenação sem reais) | o `custoMicros` acrescentado ao `orcamento` da resposta de `GET /v1/governanca/consumo` (`apps/api/src/governanca/governanca.service.ts:133,138`) | `governanca.int.test.ts` -t "consumo": 11 vermelhos (o schema estrito recusa a resposta) |

### 2. Regras de negócio, casos de borda e critério de pronto

| Item | Situação | Evidência |
|---|---|---|
| Regra: texto de aluno só em provedor no Brasil (D62) | cumprida, sem mudança | A X6 deixou a soberania na subida e na chamada; a F5a não muda envio (Tech Spec §7). A reserva é da F5b |
| Regra: teto contra defeito e abuso; orçamento é configuração (D41) | cumprida | Valor e teto em `configuracao_operacional_escola` e `rede`, definidos pela Operação; só o padrão de 200% é constante, como o PRD pede |
| Regra: o custo superestima (D14) | cumprida | `llm-gateway.ts:541` e `ia.int.test.ts` ("o prazo esgotado depois do envio… custo maior que zero"). A interrompida sem custo é da F5b (PRD §6) |
| Regra: consumo não forma indicador de professor (D45, D64) | cumprida | Governança por função, sem pessoa (`consumoResponseSchema`); Operação sem pessoa (`contracts.test.ts`). Ver o menor da escola com um professor só (anterior à F5a) |
| Borda: preço sobe no meio do mês | coberta | `consumo.test.ts`, `llm-gateway.test.ts` ("duas vigências…"), `orcamento-do-mes.repository.int.test.ts` ("duas vigências de preço no mês") |
| Borda: escola sem aluno ativo | coberta | `orcamento-de-ia.test.ts`, `painel-leitura.int.test.ts` ("sem ano em curso: `sem_aluno_ativo`… reais à vista"), `orcamento-teto.int.test.ts`, `orcamento-gauge.int.test.ts` (sem série, sem alerta); foto `operador--uso-ver-meses-*` (setembro) |
| Borda: escola sem valor, nem na rede | coberta | `painel-leitura.int.test.ts` ("sem valor nem na rede: `sem_orcamento`…"), `governanca.int.test.ts`, `orcamento-gauge.int.test.ts`; fotos `operador--uso-colunas-de-ia--computador.png` e `vazia--coordenacao--coordenacao-painel--celular.png` |
| Borda: aluno que chega em maio ou sai transferido | coberta | `orcamento-do-mes.repository.int.test.ts` ("o vínculo encerrado não conta, e o aluno que chegou agora conta") |
| Borda: virada do mês | coberta | `governanca.int.test.ts` (aviso nulo no mês seguinte), `orcamento-teto.int.test.ts` ("na virada do mês o lote adiado roda"), `orcamento-gauge.int.test.ts` (21h30 do último dia), `orcamento-de-ia.test.ts` (1º de janeiro) |
| Pronto: custo por chamada (RF5, RF6), e o principal sem preço não sobe fora do local | cumprido | RF5 e RF6 acima |
| Pronto: orçamento na Operação (RF7, RF8, RF11), por rede e por escola, e o uso no dia, no mês e nos 12 meses | cumprido | RF7, RF8 e RF11 acima, com fotos nos dois aparelhos |
| Pronto: porcentagem na coordenação (RF9, RF12), sem reais nem tokens | cumprido | RF9 e RF12 acima, com fotos |
| Pronto: teto de segurança e alertas com runbook (RF10) | cumprido | RF10; `docs/runbook.md:1609,1631,1650` |
| Pronto: roteiro da demonstração conferido na 6.0 | cumprido | `918f93ac` altera `docs/roteiro-da-demonstracao.md` e `e2e/roteiro-da-demonstracao.spec.ts`; o e2e roda na esteira |
| Pronto quando (ROADMAP, F5a) | cumprido | orçamento e custo em reais; só o lote espera acima do teto; a Operação vê o uso; a coordenação vê a porcentagem sem reais nem tokens |

### 3. Portão

Escopo de funcionalidade completa: as suítes inteiras não foram rodadas (D79). Rodei só o que serve de evidência, isolado,
no ambiente de teste 0 (que estava desligado e subi com o e2e do Uso; os workers dele foram parados para a integração).

| Portão | Resultado |
|---|---|
| Unidade de evidência (16 arquivos: `consumo`, `llm-gateway`, `llm-config`, `orcamento-de-ia`, `governanca` e `painel` do `shared`, `orcamento.repository`, `textos-da-governanca`, `Governanca`, `Painel`, `Uso`, `MesesDeIa`, `DialogoDoOrcamento`, `textos` da operação, `infra/test/alertas`, `alerta-tem-runbook`) | ✅ 478 passaram |
| Integração de evidência (8 arquivos: `ia.int`, `orcamento-teto.int`, `orcamento-do-mes.repository.int`, `painel-escrita.int`, `painel-leitura.int`, `governanca.int`, `orcamento-gauge.int`, `operacao-isolamento.int`) | ✅ 207 passaram |
| `apps/api/test/contracts.test.ts` | ✅ 13 passaram |
| `e2e/operacao-uso.spec.ts` (computador e celular) | ✅ 26 passaram |
| `e2e/governanca.spec.ts`, `e2e/painel-da-coordenacao.spec.ts`, `e2e/operacao-escolas.spec.ts` | ✅ 58 passaram, nos dois projetos, sem repetição |
| Mutações (3) | ✅ as três vermelhas, restauradas |
| Esteira do GitHub | conferida no fechamento, pelo Orquestrador (D79): não entra no veredito |
| Revisões com veto registradas e aprovadas | ✅ nas oito tarefas, todo revisor obrigatório tem rodada e a última de cada um é APROVADO |

### 4. Achados

**Críticos**
- Nenhum.

**Maiores**
- Nenhum.

**Menores** (o Orquestrador leva ao `TODO.md` no fechamento)
- `tasks/prd-camada-ia/6_task.md` e `7_task.md`, "Recomendações sem aplicar": 12 recomendações da 6.0 e 13 da 7.0 dizem
  "destino: `TODO.md`", mas os commits `918f93ac` e `edee568c` não tocaram o `TODO.md`, e não há seção "Da camada-ia,
  tarefa 6.0" nem "7.0" lá (as da 1.0, 2.0, 3.0, 4.0, 5.0 e 8.0 estão). Entre elas: a escola com um professor só, cuja
  linha "Assistente de ensino" conta, na prática, o uso daquele professor (D45, anterior à F5a; `conformidade-reviewer`);
  o `::int` da soma de tokens em `governanca.repository.ts:184-185` (anterior à F5a); dois operadores salvando o mesmo
  orçamento sem `If-Match`; o "Cancelar" do diálogo enquanto o `PUT` está no ar (D59); a mutação do `escola_id` de
  `retrato()` que depende da ordem do seq scan. Dono: Orquestrador, copiar as linhas das duas tabelas para o `TODO.md`.
- `apps/web/src/operacao/pages/Uso.tsx:84-180`, aba Uso a 1366 × 768 (o que o `frontend-reviewer` da 8.0 deixou para a
  validação): a página não rola, mas a tabela tem 16 colunas e mostra só uma linha e meia; o grupo "IA" inteiro, que é o
  que o RF11 acrescenta, fica fora da vista até rolar a moldura para a direita (fotos `operador--uso-ordem-custo--computador.png`
  e `operador--uso-colunas-de-ia--computador.png`). Não quebra a regra 50 (a tabela longa rola no próprio contêiner) e é
  tela interna da equipe; sugestão: fixar a coluna da escola e abreviar os cabeçalhos da infra, ou abrir na posição do
  grupo "IA" com a ordem por custo. Dono: `TODO.md`, junto da linha da 8.0 sobre o "Ver meses" no `<th scope="row">`.
- `tasks/prd-camada-ia/1_task.md:410`: a recomendação do `test-engineer` (1ª) de um caso que fixe, pelo `ResilientAdapter`
  com o servidor falso, que o 429 que sobra e a conexão recusada gravam a estimativa tem destino "10.0", que o corte levou
  à F5b; o rascunho `tasks/prd-reserva-e-avaliacao/rascunho-das-tarefas/10_task.md` não a traz. Dono: Arquiteto, ao
  abrir a F5b.
- `docs/mvp-contratos.md:213`: a linha de `consumo_ia` ainda diz `custo_micros` (0) e não lista `provedor` nem
  `pelo_provedor_de_reserva`. É o índice do MVP, que diz "vale o que está no código", mas lido sozinho contradiz a 1.0.
  Sugestão: uma nota "custo pelo preço vigente desde a camada-ia 1.0; ver `docs/modelo-de-dados.md`". Dono: `TODO.md`.
- `infra/grafana/`: não há política de notificação versionada (`repeat_interval`), então o "uma vez por limiar por mês"
  do RF9 vale para o estado do alerta e para o aviso da coordenação, não para quantas vezes o Grafana reenvia a
  notificação à Operação enquanto o alerta segue disparado. Anterior à F5a (vale para todo alerta por escola) e ligado à
  escolha do canal, que já está no `TODO.md` (linha da 4.0, `privacy-guardian`). Só registro.

**Positivos**
- O isolamento foi desenhado para errar: A e B em redes diferentes, com números diferentes, cada leitura conferida nas
  duas (`cenarios.md` §2). A mutação da cláusula de escola derrubou cinco casos de uma vez.
- O teto só no lote é provado pelo processador e pelo gateway de verdade, não só pelo repository: um turno do Tutor e uma
  ferramenta acima do teto terminam `concluida`.
- O contrato da coordenação é estrito e faz o vazamento virar erro, não dado: acrescentar `custoMicros` à resposta
  derrubou onze casos.

### 5. Conclusão

APROVADA. Os oito RF do escopo (RF5 a RF12) estão ATENDIDOS, cada parte do critério com código e teste que fica vermelho
quando a regra sai (três provas de mutação nos de maior risco: isolamento, o Tutor e a ferramenta que nunca param, e a
coordenação sem reais). As quatro telas com RF (o diálogo do orçamento, o Uso com "Ver meses", o Painel e a Governança da
coordenação) foram fotografadas como o papel do RF, no computador e no celular, com dado e vazias, e os números da foto
batem com o banco. Nenhum teste rodado ficou vermelho, todo revisor com veto tem rodada aprovada nas oito tarefas, a
spec passou pela revisão (`revisao-spec.md`, rodada 6, APROVADA) e as divergências da 3.0 e da 8.0 estão registradas na
Tech Spec. Zero crítico e zero maior; os menores da seção 4 não mudam o veredito e vão ao `TODO.md` no fechamento,
o primeiro deles (25 recomendações da 6.0 e da 7.0 que ficaram sem a linha prometida no `TODO.md`) com prioridade,
para não se perder. A esteira do commit validado é conferida pelo Orquestrador no fechamento.

### 6. Pendências herdadas

- Os menores da seção 4, cada um com o dono, vão ao `TODO.md` no fechamento (Orquestrador).
- Do `estado.md`: o RF11 do `cenarios.md` com os campos novos da 8.0 (`rede`, `orcamento`) e o caso da corrida do
  retrato no `2_task.md`, ambos com o Arquiteto antes do pouso; `tools/processo/revisoes-nao-se-perdem.test.ts`, que
  caiu sob carga na L1, para a retro.
- A F5b (`tasks/prd-reserva-e-avaliacao/`): reserva, soberania por chamada, custo da execução interrompida e avaliação
  dos modelos, que esperam as chaves de teste dos finalistas (Joaquim).
- Commits `Fora do processo:` com código da spec: nenhum.
- O ambiente de teste 0 ficou de pé (o último e2e religou os workers), com a vitrine montada; o consumo e os retratos que semeei para
  as fotos estão só na escola cheia da vitrine (`01a20132-b3e0-7742-8b34-3ea8262ac253`), no banco de teste.
