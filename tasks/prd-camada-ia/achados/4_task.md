# Achados das revisões — `tasks/prd-camada-ia/4_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-21 05:07:26 · `tasks/prd-camada-ia/4_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nem migration nesta tarefa. A 4.0 lê `consumo_ia`, `configuracao_operacional_escola` e o vínculo de aluno, e regrava `orcamento_ia_do_mes`. As quatro têm `escolaId`, e o retrato do mês usa a chave `(escola_id, mes)`, que vem da 2.0.

Queries verificadas:
- `apps/api/src/ia/orcamento.repository.ts`: o novo `#tetoDeSeguranca` chama `OrcamentoDoMesRepository.doMes`. O `check` lê `requireEscolaId()` antes do desvio para a fila `lote`, e a consulta não recebe escola por parâmetro.
- `packages/core/src/ia/orcamento-do-mes.repository.ts`: `custoDoMes`, `retratoDeHoje`, `retrato` e `regravarRetrato` tiram a escola de `requireEscolaId()` em todas as cláusulas (linhas 58, 73, 83, 92, 112 e 136). O `on conflict` usa a chave `(escola_id, mes)`.
- `apps/worker/src/orcamento-gauge.ts`: mede pela `EscolaGauge`, que põe cada escola no contexto. O rótulo da série é o `requireEscolaId()` da volta, e não há `@Unscoped`.
- `packages/core/src/ia/llm-gateway.ts`: o campo `fila` chega à consulta pelo pedido montado no servidor, a partir do registro de comandos, e não de entrada do cliente. Nenhum endpoint novo aceita `escolaId`.
- O contador `ia.lote.adiado` tem só o rótulo `motivo`. As duas séries do orçamento têm só `escola_id`, sem valor em reais, alunos ou custo.

Teste de isolamento: presente e efetivo.
- Em `apps/api/src/ia/orcamento-teto.int.test.ts`, o caso "a A (20%, teto de R$ 1.000) segue e a B (111%, teto de R$ 900) é adiada" quebra se a soma deixar de ser por escola: A somaria R$ 1.100, passaria do teto de R$ 1.000 e seria adiada.
- Em `apps/worker/test/orcamento-gauge.int.test.ts`, o caso "a medida publica 0,79 → 0,81 → 1,02 para a escola certa" quebra pelo mesmo motivo: o 0,79 de A viraria cerca de 2,79.

Bloqueantes: nenhum.

Recomendações:
- O caso A/B prova o escopo da soma do custo. O escopo da contagem de alunos ativos e do valor por aluno continua provado só pelos testes da 2.0, em `packages/core/src/ia/orcamento-do-mes.repository.int.test.ts`. Se um caso do teto der a A e a B números de alunos que mudem o veredito quando somados, a 4.0 passa a provar isso sozinha.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-21 05:07:46 · `tasks/prd-camada-ia/4_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A tarefa só lê o que a 2.0 já criou (`orcamento_ia_do_mes`, `consumo_ia.custo_micros`, a contagem de alunos ativos) e não tem migration. O que passa a circular é dinheiro da escola: custo do mês, orçamento e teto. Não é dado de titular.

Fora da tabela de dados do docs/lgpd.md: nada. Não há campo novo. Os dois retornos de orçamento por papel e a auditoria da mudança de teto continuam no `TODO.md`, a cargo da 3.0 e da 5.0. Esta tarefa não os toca.

Autorização por objeto: ok. A tarefa não tem rota nova. A conta do teto parte de `requireEscolaId()` no `OrcamentoDoMesRepository` (`apps/api/src/ia/orcamento.repository.ts:209-221`), e a medida roda no contexto de cada escola pela `EscolaGauge`. O caso das escolas A e B em `orcamento-teto.int.test.ts` e o caso das duas escolas em `orcamento-gauge.int.test.ts` provam que a soma é feita por escola.

Logs: limpos.
- `ia.lote.adiado_pelo_orcamento` (`apps/api/src/ia/execucao.processor.ts:66`) leva só `execucaoId`, `escolaId`, `tipo`, `codigo` e `esperaMs`. Nem o valor nem a porcentagem vão para o log.
- O contador `ia.lote.adiado` tem só o rótulo `motivo` (`apps/api/src/ia/metricas-da-execucao.ts:143-145`).
- As séries `ia.orcamento.uso_do_mes` e `uso_do_teto` levam `escola_id` e uma fração. Os três alertas e os três painéis seguem o mesmo padrão, e `infra/test/alertas.test.ts` confere que a expressão não traz `usuario`, `execucao` nem `aluno`.
- As consultas de "Primeiro olhar" no `docs/runbook.md` devolvem só ids, estados, datas, função e números. Nenhum conteúdo.

Auditoria: não se aplica. A tarefa não lê dado de aluno por coordenação ou rede, não exporta, não altera nota nem permissão e não aprova saída de IA. A alteração do teto, que exige auditoria, é da 3.0.

Envio externo: nenhum envio novo. O campo `fila` entra só na consulta de orçamento (`packages/core/src/ia/llm-gateway.ts:392`) e não vai ao provedor. O lote adiado é recusado antes da chamada, e o caso confere que não há linha em `consumo_ia`. O registro em `ExecucaoAgente` continua igual: a execução volta a `pendente`. Na ferramenta, termina `falhou` e grava só o código do erro.

Seed/fixture: sintético. Os testes usam `'Aluno sintético'` e `'Coordenação sintética'`, e-mail de conta `@educa.invalid` (é a conta do coordenador, não de aluno) e turma `'2ºB'`. Não aparece nenhum dado real.

Pergunta de fechamento: a tarefa não muda a resposta. Não cria dado de aluno nem destino de envio novo.

Bloqueantes: nenhum.

Recomendações:
- A anotação `summary` dos três alertas (`infra/grafana/alertas/ia-orcamento-do-mes.yaml`, `infra/grafana/alertas/ia-orcamento-teto.yaml`) leva `escola_id` ao canal de notificação. É id, então está dentro da regra. Se o canal de alertas for um serviço de terceiro fora do Brasil, vale registrá-lo na lista de suboperadores de `docs/lgpd.md` quando ele for escolhido. Isso já vale para os alertas por escola que existiam antes.

Arquivos principais auditados:
- `apps/api/src/ia/orcamento.repository.ts`
- `apps/api/src/ia/execucao.processor.ts`
- `apps/worker/src/orcamento-gauge.ts`
- `infra/grafana/alertas/ia-orcamento-do-mes.yaml`
- `infra/grafana/alertas/ia-orcamento-teto.yaml`
- `docs/runbook.md`

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-21 05:07:51 · `tasks/prd-camada-ia/4_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A tarefa não cria nem altera escrita em `Nota`. Ela adia o job de lote sem gastar tentativa, publica duas séries de medida e regrava o retrato `orcamento_ia_do_mes` com `on conflict`. Todos com autor humano? Não se aplica, porque não há escrita.

Decisão autônoma sobre aluno: ausente. A tarefa só segura ou solta a fila `lote`. O único comando dessa fila é `classificar_secoes`, e uma lista fechada prova isso em `apps/api/src/ia/orcamento-teto.int.test.ts:309-312`. Se alguém puser um comando novo no lote, o caso fica vermelho e a conta precisa ser refeita. Com isso fecha o item que este revisor deixou no `TODO.md` na 2.0: o teto não alcança a correção de objetiva, que não usa modelo e não vira nota sem aprovação (D33, D56), nem a vista da avaliação.

Aprovação registrada: ok. Nenhuma saída de IA nova chega ao aluno. A exceção do Tutor (D47) não aparece em outro agente.

Supervisão do tutor: ok. O Tutor nunca para pelo teto, porque a fila `interativa` não é conferida contra ele, em `apps/api/src/ia/orcamento.repository.ts:195-196`. Um caso de teste prova isso para `interativa`, `ferramenta` e `normal` acima de 100% e acima do teto. O freio do Tutor (D38) continua como estava.

Autonomia declarada e visível: sim, sem mudança nesta tarefa. A tarefa não cria agente nem muda o nível de nenhum.

Os outros pontos da regra:
- **Auditoria (item 6):** não muda.
- **Supervisão não é vigilância (item 7):** a medida nova é uma fração por escola. Não mede nada sobre aluno nem infere comportamento.
- **Sem nota em discursiva e redação (item 8, D55):** nada novo toca nessas modalidades.
- **Medir o professor não é vigiar (itens 8 e 9, D45, D64):** nenhuma métrica é por professor. O contador `ia.lote.adiado` só leva o motivo no rótulo, e as duas séries só levam `escola_id`. O Assistente de ensino e o chat do professor nunca esperam pelo orçamento.

Bloqueantes: nenhum.

Recomendações:
- Os parágrafos do runbook do teto mandam a Operação avisar a coordenação de que o material novo fica sem habilidade da BNCC até a virada do mês (`docs/runbook.md`). Quando as telas da 7.0 e da 8.0 mostrarem isso, o texto deve deixar claro que é espera por orçamento e não falha da IA, e não pode sugerir que alguma coisa sobre o aluno foi decidida.
- Vale citar a lista fechada do lote (`orcamento-teto.int.test.ts:309-312`) como checagem da regra 70 itens 1 e 3, ao lado das que já estão lá. É ela que impede, no futuro, que um comando ligado a nota passe a esperar pelo teto sem ninguém rever.

## llm-integrator · 1ª rodada · APROVADO · 2026-11-21 05:07:59 · `tasks/prd-camada-ia/4_task.md`

VEREDITO: APROVADO

Perfis usados: nenhum novo. A tarefa não adiciona chamada de modelo. Ela só confere o teto de segurança antes da chamada que a classificação do material (`classificar_secoes`, fila `lote`) já faz, e adia o job quando o custo passa do teto. O perfil dessa tarefa não mudou.

Custo estimado por professor/mês: zero de custo novo. A tarefa só adiciona uma consulta ao banco por chamada do lote e uma soma por escola a cada 5 minutos no worker. Ela existe para limitar o custo: acima de orçamento × teto ÷ 100, em padrão 200% do orçamento, o lote da escola espera até a virada do mês. Chamadas por professor no mês não mudam, porque a classificação é por material da escola e não por professor.

Prompt versionado: não se aplica. Não há prompt novo.

Validação de schema: não se aplica. Não há saída de modelo nova. A saída da classificação segue validada como antes.

Aprovação humana no caminho: não se aplica. A tarefa não gera entrega nem nota. O teto só adia o lote, e a nota de objetiva segue com aprovação humana (D33, D56).

Rodei `npx vitest run --project integracao apps/api/src/ia/orcamento-teto.int.test.ts apps/worker/test/orcamento-gauge.int.test.ts`: 2 arquivos e 18 testes passaram.

O que conferi, sem achado:

- **Provedor só nos adaptadores:** o teto confere antes da chamada, no `exigirOrcamento` do gateway. A recusa não gera linha em `consumo_ia` nem consome tentativa (`llm-gateway.ts:274,342-362`).
- **Só o lote espera:** `OrcamentoRepository.check` só confere o teto quando `consulta.fila === 'lote'` (`orcamento.repository.ts:68`). O Tutor, a ferramenta e o `normal` nunca esperam por orçamento (D38, D40). O processador só adia com `comando.fila === 'lote'` e o código do teto (`execucao.processor.ts:339`), e o caso novo de `ia.int.test.ts` prova que, em outra fila, o mesmo código termina como `falhou`.
- **Escopo por escola:** o escopo vem de `requireEscolaId()` e do `OrcamentoDoMesRepository`. Nenhum `@Unscoped`, nenhuma tabela nova. Os casos A (20%) e B (111%) e as duas séries da medida provam que a soma é por escola.
- **Teto e limites:** `>` exato em BigInt, o `mín` da espera é 3.600 s ou o que falta para a virada em São Paulo, e escola `sem_orcamento` ou `sem_aluno_ativo` nunca é adiada.
- **Adiamento seguro:** a execução volta a `pendente` com `JobAdiadoError('orcamento')`, sem contar tentativa, e a reentrega do job continua idempotente. Há `ia.lote.adiado{motivo}`.
- **Log (regra 20, item 9):** o log `ia.lote.adiado_pelo_orcamento` leva só ids, tarefa, código e espera, e o teste prova que não traz valor. As métricas levam só `escola_id` e um número.
- **Custo e parada por escola:** o limite de custo por escola vem do orçamento do mês, e os três alertas do runbook avisam a Operação a 80%, 100% e no teto. Nada é cortado a 80% ou 100%.
- **Alertas e runbook:** os três alertas têm `for: 1m`, `noDataState: OK` e entrada no runbook, e o do teto cita "Classificação do material atrasada". O ensaio dos alertas está atualizado, e a seção "Voltar o código depois da camada-ia 4.0" cobre a volta do lote adiado.
- **Testes:** usam a bancada com adaptador falso e nenhum chama provedor pago. Os cenários de limite exato, de `sem_orcamento` e de duas réplicas estão cobertos.

Bloqueantes: nenhum

Recomendações:
- `apps/worker/src/orcamento-gauge.ts:56`: a série `uso_do_teto` usa divisão em ponto flutuante, `custoMicros / ((orcamentoMicros * tetoPercentual) / 100)`, e o alerta dispara em `> 1`. O lote decide em BigInt. No limite exato, a série pode divergir por um ulp. É irrelevante na prática e seguro (o alerta avisa, não corta), mas vale um comentário dizendo que o BigInt é quem decide.
- `apps/api/src/ia/orcamento.repository.ts:68`: `check` com `fila === 'lote'` vem antes do teste de `tutor_com_o_aluno`. Hoje o lote só tem `classificar_secoes`, e o teste da lista fechada (`orcamento-teto.int.test.ts:309`) trava comando novo no lote. Mantenha esse teste como guarda quando entrar a correção de objetiva em lote.
- Quando o job do lote espera até a virada do mês, o `esperaMs` vira uma hora por vez. Para o painel da 7.0 e a 8.0, `ia.lote.adiado{motivo="orcamento"}` já dá a contagem.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-21 05:08:20 · `tasks/prd-camada-ia/4_task.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. A tarefa diverge da spec em dois pontos, e os dois já estão escritos na `techspec.md` (linha 98, §5) e no `cenarios.md` (linha 80, RF10). O primeiro: `ia.lote.adiado{motivo}` passa a contar também os adiamentos por `janela` e por `provedor`. O segundo: o código do teto que chega fora da fila de lote termina a execução como `falhou`. Os arquivos alterados fora da lista prevista estão justificados na autoconferência 8. Em `packages/shared` só mudou o comentário de `IA_ORCAMENTO_ESGOTADO`, que o `TODO.md` pedia à 4.0 para conferir. A 4.6 continua valendo.

Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)

Bloqueantes: nenhum

Recomendações:
- **Local do teste da espera no `cenarios.md`.** A linha de RF10 sobre "Às 23h50 do último dia… 600; no meio do mês, 3.600" aponta o teste em `orcamento-de-ia.test.ts`. A função `segundosAteAViradaDoMes` acabou em `apps/api/src/ia/orcamento.repository.ts:32`, e o teste em `apps/api/src/ia/orcamento-teto.int.test.ts:197`. Basta acertar a coluna do arquivo no cenário.
- **As duas séries se separam no desligamento.** Em `apps/worker/src/orcamento-gauge.ts:50-54`, o `medir()` sobrescrito troca o `#doTeto` mesmo quando o `EscolaGauge.medir` encerra no meio da volta. Nesse caso a base não troca a série dela (`escola-gauge.ts:79`, `if (this.#encerrada) return`). Resultado: `uso_do_mes` fica com a volta anterior inteira e `uso_do_teto` fica com a volta parcial. Isso contradiz o docblock, que diz que as séries "nascem juntas e somem juntas". Só acontece no desligamento e não tem efeito prático. Ou o código troca as duas pelo mesmo critério, ou o comentário registra a exceção.
- **Mesma conta de fuso em dois lugares.** `segundosAteAViradaDoMes` monta um segundo `Intl.DateTimeFormat` no fuso do orçamento, ao lado de `diaDeSaoPaulo`. O próprio `TODO.md` já registra a duplicação entre `diaDeSaoPaulo` e `diaDeUso`. Vale juntar esta conta na mesma unificação, para não ficar uma terceira versão da mesma regra de fuso.
- **Runbook aponta para rota que ainda não existe.** Em `docs/runbook.md`, as entradas dos três alertas mandam a Operação subir o valor ou o teto pela `PUT /v1/operacao/escolas/:id/orcamento-ia` (camada-ia 3.0). A 3.0 ainda está aberta no `tasks.md`. Até ela pousar, o passo do runbook não funciona. Convém conferir quando a 3.0 fechar.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-21 05:08:31 · `tasks/prd-camada-ia/4_task.md`

```
VEREDITO: APROVADO
Caminho quente tocado: IA | fila
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: ok
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- apps/worker/src/orcamento-gauge.ts:49-53: quando `encerrar` corta a volta no meio, a classe base devolve sem trocar `uso_do_mes`, e o `override medir()` troca `#doTeto` por um `#daVolta` parcial. No desligamento, as duas séries ficam por um instante com escolas diferentes. Não afeta alerta (há `for: 1m` e o processo está saindo). Para alinhar com a base, só trocar `#doTeto` quando a volta terminar inteira.
- apps/api/src/ia/orcamento.repository.ts:219-229: cada chamada do lote faz 4 consultas (`doMes`: soma pelo `consumo_ia_mes_idx` com `include`, contagem de alunos ativos, configuração da escola e configuração da rede). Hoje cabe, porque são 2 vagas de lote por escola, fora do horário letivo, e a conferência vem antes de `reservarVaga`, então não prende token. Com milhares de seções adiadas que reconferem de hora em hora, vale olhar a duração dessa leitura no staging no primeiro onboarding grande.
- apps/api/src/ia/execucao.processor.ts:268-275: a falta de trava, que deixa as 2 vagas do lote passarem do teto juntas, está aceita na Tech Spec §5. Fica registrado que, se um comando de lote mais caro entrar na lista fechada (`['classificar_secoes']`), o quanto se passa do teto muda e essa aceitação precisa ser revista.
```

Rodei `infra/test/alertas.test.ts`, `tools/guardas/alerta-tem-runbook.test.ts` e `packages/core/src/telemetry/metrics.test.ts`: 37 testes, todos passando. Não rodei os de integração (`orcamento-teto.int.test.ts`, `orcamento-gauge.int.test.ts`, `ia.int.test.ts`), que precisam do banco. O veredito vem da leitura do diff e desses testes.

Pela pergunta das 10h:
- **Interativas não esperam:** a conferência do teto só roda para a fila `lote`, e às 10h a janela letiva adia o lote antes de qualquer conferência. Tutor, ferramenta e `normal` nunca esperam por orçamento.
- **Uma escola não segura outra:** a escola acima do teto ocupa só as próprias 2 vagas de lote enquanto reconfere de hora em hora.
- **Nada de erro cru ao aluno:** em produção, o código de teto esgotado só é devolvido ao lote.
- **Retrato do mês:** as duas réplicas gravam com `on conflict`, e o teste com `esperarNaTrava` prova uma linha só, com o último valor.
- **Alertas:** os três têm runbook e `noDataState: OK`, e o procedimento de rollback está escrito. Os testes usam o modelo falso, nenhum chama provedor pago.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-21 05:09:33 · `tasks/prd-camada-ia/4_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- Caminho feliz: no teto exato o lote segue, e um micro acima ele espera, sem gastar tentativa.
- A espera é o menor valor entre o que falta para a virada de São Paulo e 3.600 s. Bordas: 23h50 do último dia, fevereiro, dezembro, meia-noite exata e 21h30 de 31/03, que já é abril em UTC.
- Virada do mês: o lote adiado roda. Com o teto subido, também.
- Escola `sem_orcamento` ou `sem_aluno_ativo` nunca é adiada e não tem série.
- Só o lote para: Tutor, ferramenta e `normal` são atendidos acima do teto.
- O código do teto em outra fila termina como `falhou`, sem adiar.
- Isolamento: A segue e B é adiada, e na medida a série é por escola.
- A medida publica 0,79 → 0,81 → 1,02. A série some quando a escola perde o orçamento ou falha, e quando a lista de escolas falha.
- Retrato do mês de São Paulo. Duas réplicas regravando ao mesmo tempo deixam uma linha só, com o último valor.
- Alertas com expressão, `for:`, `noDataState` e runbook. Log só com ids. `ia.lote.adiado` por motivo.
- Adaptador falso.

**Cobertos:**
- `apps/api/src/ia/orcamento-teto.int.test.ts` cobre o limite exato e o micro acima, com o estado `pendente`, sem consumo, `falhas_seguidas` 0 e `baseMs` conferidos.
- O mesmo arquivo cobre o `mín` e as contas da virada, a virada e o teto subido, o `sem_orcamento` e o `sem_aluno_ativo`, A e B, os três motivos e o log sem valores.
- O mesmo arquivo fecha a lista do lote em `['classificar_secoes']`.
- `apps/api/src/ia/ia.int.test.ts` cobre o código do teto numa ferramenta, que termina como `falhou`.
- `apps/worker/test/orcamento-gauge.int.test.ts` cobre a série, a ausência de série, a queda da escola e da lista, o retrato de 21h30 e o worker montado.
- `infra/test/alertas.test.ts` e `tools/guardas/alerta-tem-runbook.test.ts` cobrem os alertas.
- Os 29 blocos de mutação batem com o `git diff`. Não há `.skip`, mock que esconda a regra nem chamada a provedor pago.

**Bloqueantes:**

1. **A corrida das duas réplicas não é forçada.** Em `apps/worker/test/orcamento-gauge.int.test.ts:221`, a espera `esperarNaTrava(bancada.pool, '%orcamento_ia_do_mes%')` usa `quantos = 1`, e a primeira réplica sozinha já satisfaz essa condição.
   - **Por quê:** a primeira está parada no `pg_advisory_xact_lock_shared` do `WriteBlockTrigger`. Essa espera aparece em `pg_stat_activity` com `wait_event_type = 'Lock'` (`wait_event = 'advisory'`), e a consulta dela é o próprio `insert into "orcamento_ia_do_mes"`.
   - **Efeito:** a espera retorna na hora e o `soltar()` vem milissegundos depois. Na prática a segunda réplica roda depois que a primeira confirma, em sequência, e não na fila da trava.
   - **O que fica sem prova:** o título ("a segunda espera na trava da primeira"), a autoconferência 10 e o item do `TODO.md` dado como feito não estão provados. A asserção final (uma linha, 15 alunos) ainda pega a troca do `on conflict do update`, mas a concorrência de verdade não acontece.
   - **Correção exigida:** usar `esperarNaTrava(bancada.pool, '%orcamento_ia_do_mes%', 2)`, como em `apps/api/test/ligar-conta.int.test.ts:709` e `apps/api/test/lista.int.test.ts:921`. A alternativa é um padrão que só a segunda casa.

2. **O cenário "acima do teto, o turno do Tutor e a ferramenta são atendidos" (`cenarios.md`, RF9) só é provado no repository, não no caminho do gateway.**
   - **O que o teste faz:** o caso `acima de 100% e do teto, interativa, ferramenta e normal são atendidas…` (`apps/api/src/ia/orcamento-teto.int.test.ts:240`) chama `OrcamentoRepository.check` com a `fila` escrita à mão.
   - **O que escapa:** quem decide qual fila chega à consulta é `packages/core/src/ia/llm-gateway.ts:351`. Os dois blocos desta linha só empurram a mutação para o lado do lote (`...{}` e `fila: 'normal'`).
   - **A mutação que sobrevive:** `...(pedido.fila === undefined ? {} : { fila: 'lote' })` passa em todos os testes. Ela recusaria toda ferramenta e todo turno do Tutor numa escola acima do teto, que é exatamente o "conferir o teto em toda fila" que o cenário diz pegar. Nenhum teste roda uma ferramenta nem um turno do Tutor pelo gateway numa escola com orçamento definido acima do teto, porque as outras bancadas são `sem_orcamento`.
   - **Correção exigida, caso no arquivo:** em `orcamento-teto.int.test.ts`, um caso pela `FilaDeIa` com um comando da fila `ferramenta` (e o turno do Tutor, `interativa`) numa escola acima do teto, que verifique a execução `concluida` e a linha em `consumo_ia`.
   - **Correção exigida, bloco de mutação:** um bloco novo em "Mutações", `{ fila: pedido.fila }` → `{ fila: 'lote' }` em `llm-gateway.ts`, que fique vermelho nesse caso.

**Recomendações:**
- `tasks/prd-camada-ia/cenarios.md`: a linha RF10 "Às 23h50… 600" cita `orcamento-de-ia.test.ts`, mas o teste está em `apps/api/src/ia/orcamento-teto.int.test.ts`. Acertar a coluna.
- `segundosAteAViradaDoMes` é função pura, e a tabela da tarefa marca o caso como tipo U. Movê-lo para um `.test.ts` de unidade poupa a bancada de integração e o põe na unidade inteira do portão.
- O caso do log (`orcamento-teto.int.test.ts:297`) confere a ausência do custo e do orçamento. Poderia conferir também a porcentagem, por exemplo que nenhum campo numérico além de `esperaMs` aparece.
- O caso novo de `ia.int.test.ts` espera até 8 s pelo `falhou`. O estado muda no ato e o prazo é só uma rede de segurança, então pode ficar, mas vale um comentário dizendo que o prazo não é a prova.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-21 05:37:05 · `tasks/prd-camada-ia/4_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (`conferir` dá "portão local válido para o código atual", com typecheck, lint, segredo, dependências, unidade e alvo)
Bloqueantes: nenhum
Recomendações:
- `apps/api/src/ia/orcamento-teto.int.test.ts:151`: o caso que diz que "a espera é o único número da linha" deixa de fora, pelo nome, as chaves `nivel`, `level`, `time`, `tempo` e `pid`. Se o logger um dia ganhar outra chave numérica de envelope, o caso fica vermelho sem motivo de regra. É melhor tirar essas chaves da fonte do envelope do logger (ou da bancada `fila.log`) do que de uma lista solta dentro do caso.
- As recomendações da 1ª rodada que não foram feitas continuam registradas no `TODO.md`, que é o lugar certo:
  - as duas séries trocadas juntas no desligamento;
  - o `Intl.DateTimeFormat` duplicado em `segundosAteAViradaDoMes`;
  - as 4 consultas do `doMes`.

  O passo do runbook que aponta para a rota da 3.0 ficou para a própria 3.0 conferir quando fechar.

O que mudou nesta rodada e conferi:
- **Código de produção.** Só a linha nova de `apps/worker/src/orcamento-gauge.ts:61`. O comentário diz a verdade: a série é uma fração em ponto flutuante, quem decide é o `OrcamentoRepository` em BigInt, e o alerta só avisa, não corta. Nada de comportamento mudou.
- **Correção da Mesa.** A coluna do teste do RF10 em `tasks/prd-camada-ia/cenarios.md:81` foi feita. Ela dizia `orcamento-de-ia.test.ts`, e agora aponta os dois arquivos que existem: `orcamento-teto.int.test.ts` para a espera pelo processador e `orcamento.repository.test.ts` para a conta da virada.
- **4_task.md.** A conta da virada saiu do teste de integração e foi para o teste de unidade `apps/api/src/ia/orcamento.repository.test.ts`. A tabela de cenários, a pergunta 8 (arquivos fora dos previstos), a pergunta 10 (`esperarNaTrava(…, 2)`) e os blocos de mutação acompanharam a mudança, e o bloco novo do `llm-gateway.ts` aponta para o caso novo. A tabela de destino das recomendações bate com o que entrou no `TODO.md`.
- **Testes.** O caso novo da ferramenta e do Tutor acima do teto usa a bancada `usarRegistro`/`registro`, e o `afterEach` devolve o registro do produto. O parâmetro `quantos` de `esperarNaTrava` já existia em `apps/api/test/write-block-trigger.ts:23`. Quem julga esses testes é o `test-engineer`.

## test-engineer · 2ª rodada · APROVADO · 2026-11-21 05:37:25 · `tasks/prd-camada-ia/4_task.md`

VEREDITO: APROVADO

Cenários exigidos: os mesmos da 1ª rodada. Nesta rodada conferi as duas correções exigidas, as quatro recomendações que a Mesa mandou aplicar, e o diff da árvore 84b2bea6 à 9050f47f.

Cobertos:
- **Correção 1, feita.** Em `apps/worker/test/orcamento-gauge.int.test.ts:222` o caso agora chama `esperarNaTrava(bancada.pool, '%orcamento_ia_do_mes%', 2)`, e o comentário explica por que são duas. A primeira réplica sozinha não satisfaz mais a espera, então a corrida é forçada de verdade.
- **Correção 2, feita (o caso).** Há um caso novo em `apps/api/src/ia/orcamento-teto.int.test.ts`: "acima do teto, uma ferramenta e um turno do Tutor, pelo processador e pelo gateway de verdade…".
  - A escola gastou R$ 500 com teto de R$ 100. O registro de teste tem `proporFerramenta` na fila `ferramenta` e `turnoDoTutor` na fila `interativa`.
  - Os dois passam por `fila.entregarDeNovo`, com o processador e o gateway reais e o adaptador falso.
  - O caso confere três resultados: nenhum `JobAdiadoError`, estado `concluida` e uma linha em `consumo_ia`.
  - O `afterEach` devolve o registro do produto.
- **Correção 2, feita (o bloco de mutação).** O bloco novo em `tasks/prd-camada-ia/4_task.md` troca `{ fila: pedido.fila }` por `{ fila: 'lote' }`. O texto bate com `packages/core/src/ia/llm-gateway.ts:351`.
  - Com a mutação, o gateway passa a consultar o teto como `lote` e recebe `IA_ORCAMENTO_ESGOTADO`. A execução da ferramenta termina `falhou` em vez de `concluida`, então o caso fica vermelho pelo motivo certo.
  - O contador do documento passou a 30 blocos.
- **Recomendações aplicadas:**
  - A conta `segundosAteAViradaDoMes` foi para o teste de unidade `apps/api/src/ia/orcamento.repository.test.ts`. Os quatro blocos de mutação dela apontam o arquivo novo.
  - A coluna de teste da linha RF10 em `cenarios.md` foi corrigida.
  - O caso do log agora confere que `esperaMs` é o único número da linha, o que cobre a porcentagem.
  - O prazo de 8 s em `ia.int.test.ts:1098` ganhou o comentário de que é só rede de segurança.
- **Código de produção:** a única mudança é um comentário em `apps/worker/src/orcamento-gauge.ts:60`, sem efeito no comportamento.
- **Testes rodados:** os três arquivos (`orcamento-teto.int.test.ts`, `orcamento.repository.test.ts` e `orcamento-gauge.int.test.ts`) passaram: 3 arquivos, 19 testes, sem `.skip` e sem provedor pago.

Bloqueantes: nenhum.

Recomendações:
- O caso novo cobre `ferramenta` e `interativa` pelo gateway, mas não `normal`. A fila `normal` continua provada só no repository. Um terceiro item no mesmo laço fecharia a linha do RF9 inteira.
- O caso do log deixa passar alguns campos numéricos (`nivel`, `level`, `time`, `tempo`, `pid`). Se um desses nomes um dia carregar dado do orçamento, o caso não vê. Seria mais firme comparar o conjunto de chaves da linha com uma lista fechada.
