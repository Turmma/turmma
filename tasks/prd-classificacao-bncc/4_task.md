# Tarefa 4.0 — A classificação roda no worker, fora da janela letiva, e grava as habilidades da seção

**Funcionalidade:** classificacao-bncc · **Depende de:** 3.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `llm-integrator`
**Porte:** grande

## Objetivo

A execução `classificar_secoes` `pendente` roda no `main-worker` pela fila `lote`, fora da janela letiva, sem pessoa nem
ano, e grava os códigos `origem: 'ia'` só nas seções vivas, com a degradação do lote.

## Contexto necessário

- `techspec.md` §5 "Classificação" e "Degradação do lote", §6, §7 (`consumo_ia`, log), §7c (fila, vazão, estados)
- `prd.md` RF5, RF15
- `cenarios.md` "Classificação no worker"; corridas P1a, P4, P4b
- `.claude/rules/`: 10, 20, 30, 80
- Código: `apps/api/src/ia/` (`execucao.processor.ts`, `execucao.repository.ts`, `montar-comandos.ts`, `worker-de-ia.ts`),
  `packages/core/src/ia/llm-gateway.ts`, `packages/core/src/queue/janela-letiva.ts`, `packages/core/src/jobs/job-adiado.error.ts`

## Subtarefas

- [ ] 4.1 — `ia.executar-lote` e a fila `lote` em `FILAS_DA_IA` (§5 "Seções", §7c "Fila" e "Limite por escola"); a varredura inclui a `lote`
- [ ] 4.2 — O processador: `quemPediu` ausente só em `daRotina`; a janela e a suspensão antes de `rodando`
- [ ] 4.3 — O comando: `preparar` e `concluir` como a §5 "Classificação", sem o `for update` na seção (vai na 7.0, com P1b)
- [ ] 4.4 — A degradação e `falhas_seguidas` (§5 "Degradação do lote")
- [ ] 4.5 — Consumo, métrica do envio à classificação e log (§7, §7c)
- [ ] 4.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/shared/src/system/job-definitions.ts`, `packages/shared/src/system/job-definitions.test.ts` | alterado |
| `apps/api/src/ia/execucao.processor.ts`, `apps/api/src/ia/execucao.repository.ts`, `apps/api/src/ia/execucao-command.ts`, `apps/api/src/ia/montar-comandos.ts`, `apps/api/src/ia/worker-de-ia.ts`, `apps/api/src/ia/varredura-de-execucoes.ts`, `apps/api/src/worker-config.ts`, `apps/api/src/worker.module.ts` | alterado |
| `apps/api/src/material/classificar-secoes.command.ts`, `apps/api/src/material/secoes.repository.ts`, `apps/api/src/material/material.module.ts`, `apps/api/src/material/classificacao.int.test.ts` | novo e alterado |
| `packages/core/src/ia/llm-gateway.ts`, `packages/core/src/ia/llm-gateway.test.ts`, `.env.example`, `compose.yaml` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| caminho feliz | I | `origem: 'ia'` e `classificada_em` | `classificacao.int.test.ts` › caminho feliz: o worker consome o job da `lote`… |
| consumo | I | a função, sem pessoa, entrada só ids e versão | › caminho feliz: o worker consome o job da `lote`… (a mesma linha de consumo) |
| pacote do Tutor | I | não muda. Mutação: somar ao pacote | › o pacote do Tutor não muda… |
| `quemPediu` ausente fora de `daRotina`; em `daRotina` | I | `NAO_ENCONTRADO`; roda. Mutação: tirar a conferência | › a execução sem pessoa roda no comando da rotina; em comando que não é da rotina, `NAO_ENCONTRADO`… |
| worker real | I | consome a `lote`. Mutação: tirar a `lote` | › caminho feliz: o worker consome o job da `lote`… |
| duas da A e uma da B | I | a segunda da A espera. Mutação: sem limite por escola | › três da A e uma da B: a vaga `lote` é de cada escola… |
| `preparar`: corrigidas; outra execução; excluído; não `pronto` | I | sem modelo nem consumo; um caso e uma mutação por termo | › todas corrigidas…; › seções de outra execução…; › material excluído entre o agendar e o `preparar`…; › material que não está `pronto`… |
| função suspensa | I | sem chamada, `nao_classificada` | › antes de `rodando`: `FUNCAO_SUSPENSA`… |
| degradação: balde cheio, disjuntor, menor, provedor depois da chamada, Tutor da B, soberania | I | as linhas "Balde `lote` cheio…" e "Recusa de soberania" do `cenarios.md`, um caso e a mutação de cada | › balde cheio…; › disjuntor aberto e provedor fora depois da chamada sair…; › a execução que a varredura encerrou durante a chamada não volta a `pendente`…; › a execução adiada roda quando o provedor volta…; › a recusa de soberania é definitiva… |
| janela: 7h05; janela da escola diferente; `pendente` às 10h | I | a linha "Janela" do `cenarios.md`, um caso cada. Mutação: tirar a conferência | › o job que volta às 10h05 de segunda…; › o job que o provedor adiou de madrugada e volta às 7h05…; › a janela é a da escola…; › às 10h, com o job já adiado pela janela e ainda vivo… |
| worker morto | I | `EXECUCAO_INTERROMPIDA` em até 300 s; a reentrega de `rodando` deixa só a linha estimada em `consumo_ia` (`classificacao_do_material`, sem aluno) | › o tempo esgotado e a execução interrompida pela varredura não somam…; › o job reentregue de uma classificação que um worker morto deixou `rodando`… |
| `falhas_seguidas` no worker: inválida soma nas 12; sucesso zera; interrompida e suspensa não somam | I | um caso cada. Mutação: somar em qualquer `falhou` | › a saída inválida soma 1 nas doze seções da execução, e o sucesso seguinte zera; › a execução que a varredura encerrou durante a chamada não soma…; › o tempo esgotado e a execução interrompida pela varredura não somam… |
| duas entregas ao mesmo tempo (D49) | P | uma chamada, `EXECUCAO_INTERROMPIDA`, nenhuma gravação, só a linha estimada em `consumo_ia` (`classificacao_do_material`, sem aluno) | › duas entregas ao mesmo tempo: o modelo é chamado uma vez… |
| duas entregas ao mesmo tempo, saída inválida | P | `falhas_seguidas` em 0, só a linha estimada | › duas entregas ao mesmo tempo e a saída da primeira inválida… |
| entregue de novo depois de concluir (D49) | I | uma chamada, um consumo, uma gravação | › o job entregue de novo depois de concluir… |
| entregue de novo depois de falhar | I | soma 1 | › o job entregue de novo depois de falhar soma uma falha só… |
| P1a | P | não grava. Mutação: tirar `corrigida_em is null` | › P1a: a seção que a coordenação corrige durante a chamada não é sobrescrita… |
| `execucao_id` trocado por SQL antes | P | sem efeito. Mutação: tirar `execucao_id = :esta` | › P9: a seção que passou a outra execução por SQL durante a chamada… |
| P4: edição nova; exclusão | P | sem efeito. Mutação: tirar a releitura | › P4: o material excluído durante a chamada…; › P4: o material que deixa de estar `pronto` durante a chamada… |
| P4b | P | a exclusão espera. Mutação: tirar o `for share` | › P4b: com a gravação aberta, a exclusão do material espera a transação… |
| execução da A com seções da B | I | nada. Mutação: tirar `escola_id` | › o repository, no contexto da A, não lê, não grava e não soma nada da execução da B…; › o job da A com o `execucaoId` da B…; › a execução da A com a seção da B apontando para ela é impossível… |
| log; métrica por escola | U | sem título, texto nem código | › o log da execução leva ids, a tarefa e o código…; › a espera da classificação sai por escola… |

## Como testar

- Vaga: `apps/api/src/ia/fila-de-ia.int.test.ts` › "cinco ferramentas da A juntas: a quinta espera, o Tutor da A responde, e a ferramenta da B segue"
- Duas entregas e morto: `execucao-interrompida.int.test.ts` › "as duas leem `pendente`: uma só vira `rodando`…" e "worker morto: a reentrega encerra com EXECUCAO_INTERROMPIDA…"
- Adiamento: `apps/worker/test/enviar-email-adiamento.int.test.ts` › "estourado, o job é adiado mais vezes que as tentativas…"
- Menor: `llm-gateway.test.ts` › "o turno do Tutor pula o modelo menor…"
- Ordem forçada: `esperarNaTrava` (`apps/api/test/write-block-trigger.ts`)
- Comando: `npx vitest run --project integracao apps/api/src/material/classificacao.int.test.ts`
- Armadilha: o dublê lança `LLMError`, o erro tipado do adaptador, e não `new Error`

## Autoconferência

As 12 perguntas do modelo, no plano. Na 10: o relógio injetado.

## Fora do escopo desta tarefa

Criar execuções (5.0, o teste as semeia); o recorte (6.0); o `for update` do `concluir` (7.0).

## Plano (Implementador)

**Arquivos:** os da tabela "Arquivos previstos", mais: `packages/shared/src/index.ts` e `packages/shared/src/time/execucao.ts` (o resultado novo), `packages/core/src/db/schema/execucao-agente.ts`, `packages/core/drizzle/0063_resultado_da_classificacao.sql` e `meta/` (o check do resultado), `packages/core/src/ia/errors.ts`, `resilient-adapter.ts`, `token-limiter.ts`, `task.ts`, `tasks/classificar-secoes.ts` e `packages/core/src/jobs/job-adiado.error.ts` (a degradação: o motivo do `IA_INDISPONIVEL`, o balde `lote`, o consumo só com ids), `packages/core/src/telemetry/metrics.ts` (+ teste) e `tools/testes/metricas.ts` e `infra/grafana/paineis/fundacao.json` (a métrica do envio e o painel que `infra/test/painel.test.ts` exige para toda métrica), `packages/core/src/material/texto-das-secoes.ts` (+ teste, o texto que a seção leva), `packages/core/src/index.ts`, `tools/guardas/tabelas-do-nucleo.mjs`, `tools/guardas/definicoes-de-job.test.ts`, `packages/core/src/queue/publishing.test.ts`, `packages/core/src/jobs/job-executor.test.ts`, `tools/ci/ambiente.test.ts`, `infra/compose.yml`, `.env.example`, `docs/infra.md`, `apps/api/test/fila-de-ia.fixture.ts` (a bancada: o relógio e a janela injetados, a `lote`), `apps/api/src/ia/execucao-interrompida.int.test.ts` e `soberania-na-subida.int.test.ts`, `apps/api/src/ia/registro-de-comandos.ts` (+ teste), `apps/api/src/ia/metricas-da-execucao.ts`, `apps/api/src/ia/comandos-de-ia.module.ts`.

**Interfaces:** `TIPO_EXECUTAR_LOTE` (`ia.executar-lote`: fila `lote`, `naoUrgente`, executor `api`, escopo escola, uma tentativa, prazo de 150 s); `ComandoExecutavel` ganha `fila: 'lote'`, `daRotina`, `semModelo`, `concluirSemModelo` e `aoFalharDefinitivo`; `ExecucaoRepository.paraExecutarDaRotina`, `voltarAPendente` e `falharPendente`; `LLMError(codigo, tenteDeNovoEmSegundos?, motivo?)` com `MotivoDaIndisponibilidade` (`soberania`, `sem_vaga`, `disjuntor`) e `semEnvio`; `TaskDefinition.entradaParaORegistro`; `SecoesRepository` (`vivasDaExecucao`, `paginasDaSecao`, `recorteDosMateriais`, `candidatas`, `gravarClassificacao`, `limparDaExecucao(execucaoId, soAsSecoes?)`, `somarFalha`) e `ClassificarSecoesCommand`, com `LidoDaClassificacao` levando o `recorteDaSecao` e as `semRecorte`; `textoDaSecao`; o resultado `{ tipo: 'classificacao_do_material', secoes }`; a métrica `material.classificacao.espera`.

**Testes:** a tabela acima, no `classificacao.int.test.ts` (a bancada `FilaDeIa`: o worker real consome a `lote`, e os casos que escolhem o instante entregam o job ao processador com `entregarDeNovo`), mais os da camada de baixo (`llm-gateway.test.ts`, `resilient-adapter.test.ts`, `token-limiter.test.ts`, `texto-das-secoes.test.ts`, `worker-config.test.ts`, `job-definitions.test.ts`).

### Autoconferência

1. **Mutações:** a seção "Mutações" abaixo, um bloco por cláusula do diff (cada termo de `where`, cada `if` e cada linha do SQL do `concluir`), corridos um a um antes do portão. O que o `--faltando` ainda lista e nenhum teste distingue leva a meia linha do porquê, por arquivo e linha.
2. **Texto na tela:** nenhum. A tarefa não tem tela; o que a coordenação lê da função já entrou na 3.0.
3. **Segundo dado:** o material com três seções de uma página, de dois materiais na mesma escola (o `paginasDaSecao` e o `recorteDosMateriais` leem só o pedido), a seção corrigida no meio da chamada, a de outra execução, e a execução sem candidata com a seção que a coordenação corrigiu.
4. **Checagem anterior:** o `concluir` relê o material `for share` e filtra no `update` por `execucao_id` e `corrigida_em`; a conferência da janela e da suspensão vem antes do `rodando`. O que o gateway já recusava (a soberania, o teto de entrada) segue recusando antes de reservar.
5. **Asserção:** os casos de ausência (sem modelo, sem consumo, sem efeito) vêm ao lado do caso em que a mesma chamada passa; o consumo é lido pelo banco, e não pelo retorno.
6. **Guarda nova:** nenhuma. `tabelas-do-nucleo.mjs` ganha `habilidadeBncc` (a tabela pública) e o `candidatas` leva `@Unscoped` com o motivo; as guardas de repository, de log e de nome de mercado cobrem o resto.
7. **Comentários e docs:** os docblocks dizem o que o código faz. `docs/infra.md` diz o pool `lote` do `worker-ia` e a vaga por escola; a Tech Spec §3, §5 e §7c e o `cenarios.md` levam o que a tarefa mudou (a tabela de divergências).
8. **Divergências:** a tabela abaixo; todas entraram na `techspec.md` e no `cenarios.md`. O `prd.md` não diz o contrário.
9. **Peça que já existe:** `FilaDeIa` e `entregarDeNovo` (6.0), `JobAdiadoError`, `estaNaJanela` e `proximaAbertura` (a janela letiva), `OperationalSettings`, `exigirFuncaoAtiva`, `ConsumoRepository`, `VarreduraDeExecucoes`, `defineTask`, `habilidadeEhCandidata` (1.0).
10. **Corrida:** o `concluir` não confia na leitura do `preparar`: relê o material `for share` e o `update` leva `execucao_id` e `corrigida_em` (P1a, P4, P4b, P9, um caso e uma mutação cada); a entrega dupla acha a execução já terminada (D49). Na janela, o relógio é injetado no processador (`ExecucaoProcessorDependencies.relogio`), e o teste o fixa com `fixarHorario`.
11. **Isolamento:** o repository, no contexto da A, não lê, não grava, não limpa nem soma nada da execução da B; o job da A com o `execucaoId` da B é recusado; o consumo e o resultado ficam na escola da execução (a coluna "Caso" está preenchida).
12. **Guardiões:** `tenancy-guardian` (o `escola_id` em toda consulta, a tabela pública), `privacy-guardian` (o consumo só com ids e versão, o log e a métrica sem título, texto nem código), `infra-guardian` (a `lote` fora da janela, o pool de 1, a vaga por escola, a migration com `lock_timeout`), `llm-integrator` (o balde `lote`, a degradação, o `semEnvio`, o prompt que a 3.0 trouxe); `test-engineer` e `revisor-geral` entram pela Mesa.

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| A execução concluída leva um `resultado` novo, `{ tipo: 'classificacao_do_material', secoes }`, e a `0063` o põe no check do banco | A Tech Spec dizia que a execução sem seção viva (ou sem candidata) "conclui sem modelo", mas o check `execucao_agente_resultado_so_na_concluida` exige `resultado` em toda `concluida`, e os cinco tipos de antes são de mensagem, artefato, lote de correção e resumo: a classificação não tinha o que gravar. O resultado só guarda o número de seções gravadas, nunca o código nem o texto | `techspec.md` §3 ("Migrations", passo 1) e §5 ("Classificação"); `0063_resultado_da_classificacao.sql` (`SET LOCAL lock_timeout`, `NOT VALID`, `VALIDATE`); `classificacao.int.test.ts` › caminho feliz |
| A vaga `lote` por escola é a do ambiente, 2, e não 1 | A Tech Spec §7c dizia "vaga `lote` 1 por escola", mas o `VAGAS_ESCOLA_LOTE` do ambiente (`.env.example`, `docs/infra.md`) é 2 desde antes, vale para as três famílias do `lote` (expurgo, eliminação, classificação) e `apps/despachante/test/janela.int.test.ts` conta com "as duas vagas de lote da A". Baixar para 1 o valor de todo o `lote` por esta tarefa quebraria esses testes e atrasaria o expurgo. O pool do `worker-ia` é 1 por réplica, como a spec dizia | `techspec.md` §7c ("Limite por escola"); `cenarios.md` ("Classificação no worker", a linha da vaga: três da A e uma da B); `classificacao.int.test.ts` › três da A e uma da B |
| O gateway distingue o `IA_INDISPONIVEL` pelo `motivo` (`soberania`, `sem_vaga`, `disjuntor`) | A spec manda adiar o `IA_INDISPONIVEL` transitório (balde cheio, disjuntor, provedor fora) e falhar de vez a recusa de soberania, e os três chegam ao processador com o mesmo código. Sem o motivo, a soberania seria adiada para sempre, ou o balde cheio, falhado | `techspec.md` §5 ("Degradação do lote"); `classificacao.int.test.ts` › a recusa de soberania; `llm-gateway.test.ts` › balde `lote` cheio |
| A tabela da BNCC é pública e o `candidatas` a lê sem `escola_id`, com `@Unscoped` e o motivo; `habilidadeBncc` entra em `TABELAS_DO_NUCLEO` | Regra 10, item 1: a tabela pública sem dono é a exceção fixa. A guarda de repository exige `requireEscolaId`, `@Unscoped` ou entrada na lista, e a lista das tabelas do núcleo conferia as exportações sem a `habilidadeBncc` desde que o núcleo a exporta | `techspec.md` §3 ("`habilidade_bncc`", tabela pública); `repositories-com-escopo.test.ts`, `tabelas-do-nucleo.test.ts` |
| O arquivo do texto da seção chama-se `texto-das-secoes.ts` | O mapa de nomes da onda 11 proíbe `secao` como identificador e como parte de nome de arquivo (`restos.test.ts`); o plural não é o nome proibido | `packages/core/src/material/texto-das-secoes.ts` |
| O `concluir` confere cada código contra o recorte da própria seção, a união de recortes não se corta, e a seção sem recorte volta a `nao_agendada` | A spec dizia só "fora das candidatas, `IA_SAIDA_INVALIDA`", e a lista de candidatas da execução é a união dos recortes dos materiais: sem a conferência por seção, uma seção do 8º ano recebia código do Médio (cenário c1: "do EM em seção do EF"), e o `.slice(0, 300)` cortava a união em silêncio. A decisão (a execução é de um recorte e a 5.0 agrupa por ele, mas o comando não confia) entrou na §5 e no `cenarios.md`; não muda contrato nem tabela | `techspec.md` §5 ("A execução é de um recorte"); `cenarios.md` ("Execução com mais de um recorte"); `classificacao.int.test.ts` › "mais de um recorte na mesma execução" |
| Duas entregas ao mesmo tempo encerram a execução `EXECUCAO_INTERROMPIDA` e a gravação da primeira se desfaz | O `cenarios.md` prometia "uma chamada, um consumo, uma gravação" para o job entregue duas vezes, mas esse é o caso da entrega **depois** da conclusão; ao mesmo tempo vale a semântica da 6.0 (a segunda acha `rodando` e encerra). Os dois casos estão agora escritos e provados, o paralelo com a ordem forçada | `techspec.md` §5; `cenarios.md` ("Duas entregas ao mesmo tempo"); `classificacao.int.test.ts` › "a entrega dupla (D49)" |
| A varredura de execuções casa o tipo do job com a fila (`ia.executar` nas três, `ia.executar-lote` na `lote`) | A spec dizia "a varredura inclui a `lote`"; incluir só a fila deixaria o job `ia.executar` da `lote` segurar uma `pendente` que nenhum worker leva. O par tipo e fila é o que o despachante grava | `techspec.md` §7c ("Fila"); `execucao-interrompida.int.test.ts` › varredura, `pendente` |

## Mutações

`--faltando: 39 linhas (117 blocos, 14 motivos)`. As 117 mutações abaixo foram corridas uma a uma antes do portão (a ferramenta do portão as corre de novo); o que sobra da lista, abaixo dos blocos, é o que nenhum teste distingue ou o que só o `tsc` do portão prova.

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › o repository, no contexto da A
-      .where(and(eq(secaoDoMaterial.escolaId, escolaId), eq(secaoDoMaterial.execucaoId, execucaoId), isNull(secaoDoMaterial.corrigidaEm), eq(material.estado, 'pronto'), isNull(material.excluidoEm)))
+      .where(and(eq(secaoDoMaterial.execucaoId, execucaoId), isNull(secaoDoMaterial.corrigidaEm), eq(material.estado, 'pronto'), isNull(material.excluidoEm)))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › seções de outra execução
-      .where(and(eq(secaoDoMaterial.escolaId, escolaId), eq(secaoDoMaterial.execucaoId, execucaoId), isNull(secaoDoMaterial.corrigidaEm), eq(material.estado, 'pronto'), isNull(material.excluidoEm)))
+      .where(and(eq(secaoDoMaterial.escolaId, escolaId), isNull(secaoDoMaterial.corrigidaEm), eq(material.estado, 'pronto'), isNull(material.excluidoEm)))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › todas corrigidas
-      .where(and(eq(secaoDoMaterial.escolaId, escolaId), eq(secaoDoMaterial.execucaoId, execucaoId), isNull(secaoDoMaterial.corrigidaEm), eq(material.estado, 'pronto'), isNull(material.excluidoEm)))
+      .where(and(eq(secaoDoMaterial.escolaId, escolaId), eq(secaoDoMaterial.execucaoId, execucaoId), eq(material.estado, 'pronto'), isNull(material.excluidoEm)))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › material que não está `pronto`
-      .where(and(eq(secaoDoMaterial.escolaId, escolaId), eq(secaoDoMaterial.execucaoId, execucaoId), isNull(secaoDoMaterial.corrigidaEm), eq(material.estado, 'pronto'), isNull(material.excluidoEm)))
+      .where(and(eq(secaoDoMaterial.escolaId, escolaId), eq(secaoDoMaterial.execucaoId, execucaoId), isNull(secaoDoMaterial.corrigidaEm), isNull(material.excluidoEm)))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › material excluído entre o agendar
-      .where(and(eq(secaoDoMaterial.escolaId, escolaId), eq(secaoDoMaterial.execucaoId, execucaoId), isNull(secaoDoMaterial.corrigidaEm), eq(material.estado, 'pronto'), isNull(material.excluidoEm)))
+      .where(and(eq(secaoDoMaterial.escolaId, escolaId), eq(secaoDoMaterial.execucaoId, execucaoId), isNull(secaoDoMaterial.corrigidaEm), eq(material.estado, 'pronto')))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › o repository, no contexto da A
-      .where(and(eq(trecho.escolaId, escolaId), eq(trecho.materialId, materialId), sql`${trecho.pagina} between ${paginaInicial} and ${ate}`))
+      .where(and(eq(trecho.materialId, materialId), sql`${trecho.pagina} between ${paginaInicial} and ${ate}`))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › paginasDaSecao
-      .where(and(eq(trecho.escolaId, escolaId), eq(trecho.materialId, materialId), sql`${trecho.pagina} between ${paginaInicial} and ${ate}`))
+      .where(and(eq(trecho.escolaId, escolaId), sql`${trecho.pagina} between ${paginaInicial} and ${ate}`))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › paginasDaSecao
-      .where(and(eq(trecho.escolaId, escolaId), eq(trecho.materialId, materialId), sql`${trecho.pagina} between ${paginaInicial} and ${ate}`))
+      .where(and(eq(trecho.escolaId, escolaId), eq(trecho.materialId, materialId)))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › recorteDosMateriais
-        .where(and(eq(disciplina.escolaId, escolaId), inArray(disciplina.id, [...disciplinaIds])))
+        .where(and(inArray(disciplina.id, [...disciplinaIds])))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › recorteDosMateriais
-        .where(and(eq(disciplina.escolaId, escolaId), inArray(disciplina.id, [...disciplinaIds])))
+        .where(and(eq(disciplina.escolaId, escolaId)))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › recorteDosMateriais
-        .where(and(eq(materialSerie.escolaId, escolaId), inArray(materialSerie.materialId, [...materialIds])))
+        .where(and(inArray(materialSerie.materialId, [...materialIds])))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › recorteDosMateriais
-        .where(and(eq(materialSerie.escolaId, escolaId), inArray(materialSerie.materialId, [...materialIds])))
+        .where(and(eq(materialSerie.escolaId, escolaId)))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › P4: o material que deixa de estar
-      .where(and(eq(material.escolaId, escolaId), inArray(material.id, [...new Set(secoes.map((secao) => secao.materialId))]), eq(material.estado, 'pronto'), isNull(material.excluidoEm)))
+      .where(and(eq(material.escolaId, escolaId), inArray(material.id, [...new Set(secoes.map((secao) => secao.materialId))]), isNull(material.excluidoEm)))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › P4: o material excluído
-      .where(and(eq(material.escolaId, escolaId), inArray(material.id, [...new Set(secoes.map((secao) => secao.materialId))]), eq(material.estado, 'pronto'), isNull(material.excluidoEm)))
+      .where(and(eq(material.escolaId, escolaId), inArray(material.id, [...new Set(secoes.map((secao) => secao.materialId))]), eq(material.estado, 'pronto')))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › P4b
-      .for('share')
+
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › P4: o material excluído
-      if (secao === undefined || !vivos.has(secao.materialId)) continue
+      if (secao === undefined) continue
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › a saída inválida soma 1
-           set classificada_em = now(), falhas_seguidas = 0
+           set classificada_em = now()
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › P1a
-           and s.id = ${secao.id}
+           and true
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › P9
-           and s.execucao_id = ${execucaoId}
+           and true
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › P1a
-           and s.corrigida_em is null
+           and true
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › P1a
-      if (linha === undefined) continue
+      if (false) continue
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › a gravação troca só as habilidades
-      await this.banco.delete(habilidadeDaSecao).where(and(eq(habilidadeDaSecao.escolaId, escolaId), eq(habilidadeDaSecao.secaoId, secao.id), eq(habilidadeDaSecao.origem, 'ia')))
+      await this.banco.delete(habilidadeDaSecao).where(and(eq(habilidadeDaSecao.escolaId, escolaId), eq(habilidadeDaSecao.origem, 'ia')))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › a gravação troca só as habilidades
-      await this.banco.delete(habilidadeDaSecao).where(and(eq(habilidadeDaSecao.escolaId, escolaId), eq(habilidadeDaSecao.secaoId, secao.id), eq(habilidadeDaSecao.origem, 'ia')))
+      await this.banco.delete(habilidadeDaSecao).where(and(eq(habilidadeDaSecao.escolaId, escolaId), eq(habilidadeDaSecao.secaoId, secao.id)))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › a seção sem código
-      if (resposta.codigos.length > 0) {
+      if (true) {
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › limparDaExecucao
-      .where(and(eq(secaoDoMaterial.escolaId, escolaId), eq(secaoDoMaterial.execucaoId, execucaoId), isNull(secaoDoMaterial.corrigidaEm), soAsSecoes === undefined ? undefined : inArray(secaoDoMaterial.id, [...soAsSecoes])))
+      .where(and(eq(secaoDoMaterial.escolaId, escolaId), isNull(secaoDoMaterial.corrigidaEm), soAsSecoes === undefined ? undefined : inArray(secaoDoMaterial.id, [...soAsSecoes])))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › limparDaExecucao
-      .where(and(eq(secaoDoMaterial.escolaId, escolaId), eq(secaoDoMaterial.execucaoId, execucaoId), isNull(secaoDoMaterial.corrigidaEm), soAsSecoes === undefined ? undefined : inArray(secaoDoMaterial.id, [...soAsSecoes])))
+      .where(and(eq(secaoDoMaterial.escolaId, escolaId), eq(secaoDoMaterial.execucaoId, execucaoId), soAsSecoes === undefined ? undefined : inArray(secaoDoMaterial.id, [...soAsSecoes])))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › limparDaExecucao
-    await this.banco.delete(habilidadeDaSecao).where(and(eq(habilidadeDaSecao.escolaId, escolaId), inArray(habilidadeDaSecao.secaoId, ids), eq(habilidadeDaSecao.origem, 'ia')))
+    await this.banco.delete(habilidadeDaSecao).where(and(eq(habilidadeDaSecao.escolaId, escolaId), eq(habilidadeDaSecao.origem, 'ia')))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › limparDaExecucao
-    await this.banco.delete(habilidadeDaSecao).where(and(eq(habilidadeDaSecao.escolaId, escolaId), inArray(habilidadeDaSecao.secaoId, ids), eq(habilidadeDaSecao.origem, 'ia')))
+    await this.banco.delete(habilidadeDaSecao).where(and(eq(habilidadeDaSecao.escolaId, escolaId), inArray(habilidadeDaSecao.secaoId, ids)))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › o repository, no contexto da A
-      .where(and(eq(secaoDoMaterial.escolaId, requireEscolaId()), eq(secaoDoMaterial.execucaoId, execucaoId)))
+      .where(and(eq(secaoDoMaterial.execucaoId, execucaoId)))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › somarFalha
-      .where(and(eq(secaoDoMaterial.escolaId, requireEscolaId()), eq(secaoDoMaterial.execucaoId, execucaoId)))
+      .where(and(eq(secaoDoMaterial.escolaId, requireEscolaId())))
```

```mutacao
arquivo: apps/api/src/material/classificar-secoes.command.ts
teste: apps/api/src/material/classificacao.int.test.ts › material que não está `pronto`
-    if (vivas.length === 0) return semModelo(false)
+    if (false) return semModelo(false)
```

```mutacao
arquivo: apps/api/src/material/classificar-secoes.command.ts
teste: apps/api/src/material/classificacao.int.test.ts › disciplina sem componente
-    if (candidatas.size === 0) return semModelo(true)
+    if (false) return semModelo(true)
```

```mutacao
arquivo: apps/api/src/material/classificar-secoes.command.ts
teste: apps/api/src/material/classificacao.int.test.ts › disciplina sem componente
-      if (componente === null || componente === undefined || series.length === 0) continue
+      if (componente === undefined || series.length === 0) continue
```

```mutacao
arquivo: apps/api/src/material/classificar-secoes.command.ts
teste: apps/api/src/material/classificacao.int.test.ts › material sem série
-      const series: readonly SerieDoRecorte[] = recorte.series.get(secao.materialId) ?? []
+      const series: readonly SerieDoRecorte[] = recorte.series.get(secao.materialId)
```

```mutacao
arquivo: apps/api/src/material/classificar-secoes.command.ts
teste: apps/api/src/material/classificacao.int.test.ts › material que não está `pronto`
-    if (lido.semCandidatas) await new SecoesRepository(tx).limparDaExecucao(execucaoId)
+    if (true) await new SecoesRepository(tx).limparDaExecucao(execucaoId)
```

```mutacao
arquivo: apps/api/src/material/classificar-secoes.command.ts
teste: apps/api/src/material/classificacao.int.test.ts › o tempo esgotado e a execução interrompida
-    if (codigo === ErrorCode.IA_SAIDA_INVALIDA) await new SecoesRepository(tx).somarFalha(execucaoId)
+    if (true) await new SecoesRepository(tx).somarFalha(execucaoId)
```

```mutacao
arquivo: apps/api/src/ia/execucao-command.ts
teste: apps/api/src/material/classificacao.int.test.ts › a saída inválida soma 1
-    ...(comando.aoFalharDefinitivo === undefined ? {} : { aoFalharDefinitivo: (codigo, tx, execucaoId) => comando.aoFalharDefinitivo?.(codigo, tx, execucaoId) ?? Promise.resolve() }),
+    ...(comando.aoFalharDefinitivo !== undefined ? {} : { aoFalharDefinitivo: (codigo, tx, execucaoId) => comando.aoFalharDefinitivo?.(codigo, tx, execucaoId) ?? Promise.resolve() }),
```

```mutacao
arquivo: apps/api/src/ia/execucao-command.ts
teste: apps/api/src/material/classificacao.int.test.ts › material que não está `pronto`
-      if (semModelo === true) {
+      if (false) {
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/material/classificacao.int.test.ts › antes de `rodando`
-    if (!(await this.#podeComecar(execucoes, execucaoId, escolaId, lida, comando))) return
+    if (false) return
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/material/classificacao.int.test.ts › o job que volta às 10h05
-    if (comando?.fila === 'lote' && (await this.#antesDeRodarOLote(execucoes, execucaoId, escolaId, lida, comando))) return false
+    if (comando?.fila === 'lote' && false) return false
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/material/classificacao.int.test.ts › o job entregue de novo às 10h05
-    if (lida.estado !== 'pendente') return false
+    if (false) return false
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/material/classificacao.int.test.ts › o job que volta às 10h05
-    if (estaNaJanela(janela, agora)) {
+    if (false) {
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › cinco ferramentas da A juntas
-    if (lida.quemPediu === undefined && !comando.daRotina) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
+    if (!comando.daRotina) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/material/classificacao.int.test.ts › a execução sem pessoa roda no comando da rotina
-    if (lida.quemPediu === undefined && !comando.daRotina) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
+    if (lida.quemPediu === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/material/classificacao.int.test.ts › caminho feliz
-      ...(lida.quemPediu === undefined ? {} : { usuarioId: lida.quemPediu.usuarioId, papel: lida.quemPediu.papel, anoLetivoId: lida.quemPediu.anoLetivoId }),
+      ...(lida.quemPediu !== undefined ? {} : { usuarioId: lida.quemPediu.usuarioId, papel: lida.quemPediu.papel, anoLetivoId: lida.quemPediu.anoLetivoId }),
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/material/classificacao.int.test.ts › caminho feliz
-      const paraRodar = comando.daRotina ? await new ExecucaoRepository(this.dependencias.banco).paraExecutarDaRotina(execucaoId) : await new ExecucaoDaSessaoRepository(this.dependencias.banco).paraExecutar(execucaoId)
+      const paraRodar = false ? await new ExecucaoRepository(this.dependencias.banco).paraExecutarDaRotina(execucaoId) : await new ExecucaoDaSessaoRepository(this.dependencias.banco).paraExecutar(execucaoId)
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › o desligamento do worker aborta
-    if (this.#semFalhaParaGravar(erro, { execucaoId, escolaId, tipo, sinalDoJob })) return
+    if (false) return
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/material/classificacao.int.test.ts › a saída inválida soma 1
-    if (erro instanceof LLMError && adiavelNoLote(erro, comando, prazo)) {
+    if (erro instanceof LLMError && true) {
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/material/classificacao.int.test.ts › a execução que a varredura encerrou durante a chamada não soma
-        if (passou) await comando?.aoFalharDefinitivo?.(codigo, tx, execucaoId)
+        if (true) await comando?.aoFalharDefinitivo?.(codigo, tx, execucaoId)
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › o desligamento do worker aborta
-    if (sinalDoJob?.aborted === true) {
+    if (false) {
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › a varredura encerrou a execução enquanto o modelo rodava
-    if (erro instanceof ExecucaoJaEncerrada) {
+    if (false) {
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/material/classificacao.int.test.ts › a execução que a varredura encerrou durante a chamada não volta
-    if (!voltou) return
+    if (false) return
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/material/classificacao.int.test.ts › balde cheio
-    const esperaMs = erro.tenteDeNovoEmSegundos === undefined ? MEIO_ABRE_O_DISJUNTOR_EM_MS : erro.tenteDeNovoEmSegundos * 1_000
+    const esperaMs = erro.tenteDeNovoEmSegundos !== undefined ? MEIO_ABRE_O_DISJUNTOR_EM_MS : erro.tenteDeNovoEmSegundos * 1_000
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/material/classificacao.int.test.ts › o provedor fora que chega depois de o prazo estourar
-  return comando?.fila === 'lote' && !prazo.aborted && erro.codigoDeIa === ErrorCode.IA_INDISPONIVEL && erro.motivo !== 'soberania'
+  return comando?.fila === 'lote' && erro.codigoDeIa === ErrorCode.IA_INDISPONIVEL && erro.motivo !== 'soberania'
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/material/classificacao.int.test.ts › a saída inválida soma 1
-  return comando?.fila === 'lote' && !prazo.aborted && erro.codigoDeIa === ErrorCode.IA_INDISPONIVEL && erro.motivo !== 'soberania'
+  return comando?.fila === 'lote' && !prazo.aborted && erro.motivo !== 'soberania'
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/material/classificacao.int.test.ts › a recusa de soberania
-  return comando?.fila === 'lote' && !prazo.aborted && erro.codigoDeIa === ErrorCode.IA_INDISPONIVEL && erro.motivo !== 'soberania'
+  return comando?.fila === 'lote' && !prazo.aborted && erro.codigoDeIa === ErrorCode.IA_INDISPONIVEL
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/material/classificacao.int.test.ts › o provedor fora que chega depois de o prazo estourar
-  if (prazoEstourou) return ErrorCode.IA_TEMPO_ESGOTADO
+  if (false) return ErrorCode.IA_TEMPO_ESGOTADO
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/material/classificacao.int.test.ts › a saída inválida soma 1
-  return erro instanceof DomainException ? erro.codigo : ErrorCode.ERRO_INTERNO
+  return false ? erro.codigo : ErrorCode.ERRO_INTERNO
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/material/classificacao.int.test.ts › duas entregas ao mesmo tempo: o modelo é chamado uma vez
-        await new ConsumoRepository(tx).registrarEstimada(interrompida, destino)
+        void destino
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › paraExecutarDaRotina
-      .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.id, id), isNull(execucaoAgente.solicitadaPor)))
+      .where(and(eq(execucaoAgente.id, id), isNull(execucaoAgente.solicitadaPor)))
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › paraExecutarDaRotina
-      .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.id, id), isNull(execucaoAgente.solicitadaPor)))
+      .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), isNull(execucaoAgente.solicitadaPor)))
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › paraExecutarDaRotina
-      .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.id, id), isNull(execucaoAgente.solicitadaPor)))
+      .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.id, id)))
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › paraExecutarDaRotina
       .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.id, id), isNull(execucaoAgente.solicitadaPor)))
-    if (linha === undefined) return undefined
+    if (false) return undefined
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › paraExecutarDaRotina
       .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.id, id), isNull(execucaoAgente.solicitadaPor)))
     if (linha === undefined) return undefined
     const entrada = execucaoInputSchema.safeParse(linha.entrada)
-    if (!entrada.success) return undefined
+    if (false) return undefined
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › voltarAPendente
       .set({ estado: 'pendente', iniciadaEm: null })
-      .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.id, id), eq(execucaoAgente.estado, 'rodando')))
+      .where(and(eq(execucaoAgente.id, id), eq(execucaoAgente.estado, 'rodando')))
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › voltarAPendente
       .set({ estado: 'pendente', iniciadaEm: null })
-      .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.id, id), eq(execucaoAgente.estado, 'rodando')))
+      .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.estado, 'rodando')))
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › voltarAPendente
       .set({ estado: 'pendente', iniciadaEm: null })
-      .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.id, id), eq(execucaoAgente.estado, 'rodando')))
+      .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.id, id)))
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › voltarAPendente
       .set({ estado: 'falhou', erro: codigo, concluidaEm: sql`now()` })
-      .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.id, id), eq(execucaoAgente.estado, 'pendente')))
+      .where(and(eq(execucaoAgente.id, id), eq(execucaoAgente.estado, 'pendente')))
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › voltarAPendente
       .set({ estado: 'falhou', erro: codigo, concluidaEm: sql`now()` })
-      .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.id, id), eq(execucaoAgente.estado, 'pendente')))
+      .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.estado, 'pendente')))
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › voltarAPendente
       .set({ estado: 'falhou', erro: codigo, concluidaEm: sql`now()` })
-      .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.id, id), eq(execucaoAgente.estado, 'pendente')))
+      .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.id, id)))
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/execucao-interrompida.int.test.ts › varredura, `pendente`: com job vivo fica
-                and ((j.tipo = 'ia.executar' and j.fila in ('interativa', 'ferramenta', 'normal')) or (j.tipo = 'ia.executar-lote' and j.fila = 'lote'))
+                and ((j.tipo = 'ia.executar' and j.fila in ('interativa', 'ferramenta', 'normal')))
```

```mutacao
arquivo: apps/api/src/ia/execucao.scheduler.ts
teste: apps/api/src/material/classificacao.int.test.ts › o agendador da API recusa
-    if (comando.fila === 'lote') throw new InvariantException('a tarefa do lote não se agenda por requisição')
+    if (false) throw new InvariantException('a tarefa do lote não se agenda por requisição')
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: apps/api/src/material/classificacao.int.test.ts › caminho feliz
-    const entradaDoRegistro: unknown = tarefa.entradaParaORegistro?.(entrada) ?? entrada
+    const entradaDoRegistro: unknown = entrada
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts
-      if (!adiavelSemEnvio) await this.dependencias.registro.registrar(this.consumo(pedido, medicao, { ...conteudo({ entrada: entradaDoRegistro }), estado: 'falhou', codigoDeErro: codigo })).catch(() => undefined)
+      if (true) await this.dependencias.registro.registrar(this.consumo(pedido, medicao, { ...conteudo({ entrada: entradaDoRegistro }), estado: 'falhou', codigoDeErro: codigo })).catch(() => undefined)
```

```mutacao
arquivo: packages/core/src/ia/errors.ts
teste: packages/core/src/ia/llm-gateway.test.ts
-    return this.motivo === 'sem_vaga' || this.motivo === 'disjuntor'
+    return this.motivo === 'disjuntor'
```

```mutacao
arquivo: packages/core/src/ia/errors.ts
teste: packages/core/src/ia/resilient-adapter.test.ts
-    return this.motivo === 'sem_vaga' || this.motivo === 'disjuntor'
+    return this.motivo === 'sem_vaga'
```

```mutacao
arquivo: packages/core/src/ia/resilient-adapter.ts
teste: packages/core/src/ia/resilient-adapter.test.ts
-  if (erro instanceof BrokenCircuitError) return new LLMError('IA_INDISPONIVEL', undefined, 'disjuntor')
+  if (false) return new LLMError('IA_INDISPONIVEL', undefined, 'disjuntor')
```

```mutacao
arquivo: packages/core/src/material/texto-das-secoes.ts
teste: packages/core/src/material/texto-das-secoes.test.ts
-  linha.length >= MINIMO_DA_LINHA_DE_SUBTITULO &&
+  true &&
```

```mutacao
arquivo: packages/core/src/material/texto-das-secoes.ts
teste: packages/core/src/material/texto-das-secoes.test.ts
-  linha.length <= MAXIMO_DA_LINHA_DE_SUBTITULO &&
+  true &&
```

```mutacao
arquivo: packages/core/src/material/texto-das-secoes.ts
teste: packages/core/src/material/texto-das-secoes.test.ts
-  /\p{L}/u.test(linha) &&
+  true &&
```

```mutacao
arquivo: packages/core/src/material/texto-das-secoes.ts
teste: packages/core/src/material/texto-das-secoes.test.ts
-  /^[\p{Lu}\d]/u.test(linha) &&
+  true &&
```

```mutacao
arquivo: packages/core/src/material/texto-das-secoes.ts
teste: packages/core/src/material/texto-das-secoes.test.ts
-  !/[.,;:]$/.test(linha)
+  true
```

```mutacao
arquivo: packages/core/src/material/texto-das-secoes.ts
teste: packages/core/src/material/texto-das-secoes.test.ts
-  const corte = texto.charCodeAt(maximo - 1) >= 0xd800 && texto.charCodeAt(maximo - 1) <= 0xdbff ? maximo - 1 : maximo
+  const corte = texto.charCodeAt(maximo - 1) <= 0xdbff ? maximo - 1 : maximo
```

```mutacao
arquivo: packages/core/src/material/texto-das-secoes.ts
teste: packages/core/src/material/texto-das-secoes.test.ts
-  const corte = texto.charCodeAt(maximo - 1) >= 0xd800 && texto.charCodeAt(maximo - 1) <= 0xdbff ? maximo - 1 : maximo
+  const corte = texto.charCodeAt(maximo - 1) >= 0xd800 ? maximo - 1 : maximo
```

```mutacao
arquivo: packages/core/src/material/texto-das-secoes.ts
teste: packages/core/src/material/texto-das-secoes.test.ts
-const chaveDaLinha = (linha: string): string => linha.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
+const chaveDaLinha = (linha: string): string => linha.normalize('NFD').toLowerCase()
```

```mutacao
arquivo: packages/core/src/material/texto-das-secoes.ts
teste: packages/core/src/material/texto-das-secoes.test.ts
-  const linhas = paginas.flatMap((pagina) => pagina.split(/\r?\n/)).map((linha) => linha.replace(/\s+/g, ' ').trim()).filter((linha) => linha !== '')
+  const linhas = paginas.flatMap((pagina) => pagina.split(/\r?\n/)).map((linha) => linha.trim()).filter((linha) => linha !== '')
```

```mutacao
arquivo: packages/core/src/material/texto-das-secoes.ts
teste: packages/core/src/material/texto-das-secoes.test.ts
-  const doTitulo = titulo === null ? null : chaveDaLinha(titulo.replace(/\s+/g, ' ').trim())
+  const doTitulo = false ? null : chaveDaLinha(titulo.replace(/\s+/g, ' ').trim())
```

```mutacao
arquivo: packages/core/src/material/texto-das-secoes.ts
teste: packages/core/src/material/texto-das-secoes.test.ts
-  const doTitulo = titulo === null ? null : chaveDaLinha(titulo.replace(/\s+/g, ' ').trim())
+  const doTitulo = titulo === null ? null : chaveDaLinha(titulo.trim())
```

```mutacao
arquivo: packages/core/src/material/texto-das-secoes.ts
teste: packages/core/src/material/texto-das-secoes.test.ts
-    if (!ehSubtitulo(linha)) continue
+    if (false) continue
```

```mutacao
arquivo: packages/core/src/material/texto-das-secoes.ts
teste: packages/core/src/material/texto-das-secoes.test.ts
-    if (chave === doTitulo || vistas.has(chave)) continue
+    if (vistas.has(chave)) continue
```

```mutacao
arquivo: packages/core/src/material/texto-das-secoes.ts
teste: packages/core/src/material/texto-das-secoes.test.ts
-    if (chave === doTitulo || vistas.has(chave)) continue
+    if (chave === doTitulo) continue
```

```mutacao
arquivo: packages/core/src/material/texto-das-secoes.ts
teste: packages/core/src/material/texto-das-secoes.test.ts
-    const acrescimo = linha.length + (escolhidas.length === 0 ? 0 : 1)
+    const acrescimo = linha.length + 0
```

```mutacao
arquivo: packages/core/src/material/texto-das-secoes.ts
teste: packages/core/src/material/texto-das-secoes.test.ts
-    if (tamanho + acrescimo > CARACTERES_DOS_SUBTITULOS_DA_SECAO) break
+    if (false) break
```

```mutacao
arquivo: apps/api/src/worker-config.ts
teste: apps/api/src/worker-config.test.ts
-  if (banco === undefined || proprio === undefined || pools === undefined || vagasPadrao === undefined || janelaPadrao === undefined || vagasDesligadas === undefined || telemetria === undefined || ia === undefined) {
+  if (proprio === undefined || pools === undefined || vagasPadrao === undefined || janelaPadrao === undefined || vagasDesligadas === undefined || telemetria === undefined || ia === undefined) {
```

```mutacao
arquivo: apps/api/src/worker-config.ts
teste: apps/api/src/worker-config.test.ts
-  if (banco === undefined || proprio === undefined || pools === undefined || vagasPadrao === undefined || janelaPadrao === undefined || vagasDesligadas === undefined || telemetria === undefined || ia === undefined) {
+  if (banco === undefined || pools === undefined || vagasPadrao === undefined || janelaPadrao === undefined || vagasDesligadas === undefined || telemetria === undefined || ia === undefined) {
```

```mutacao
arquivo: apps/api/src/worker-config.ts
teste: apps/api/src/worker-config.test.ts
-  if (banco === undefined || proprio === undefined || pools === undefined || vagasPadrao === undefined || janelaPadrao === undefined || vagasDesligadas === undefined || telemetria === undefined || ia === undefined) {
+  if (banco === undefined || proprio === undefined || vagasPadrao === undefined || janelaPadrao === undefined || vagasDesligadas === undefined || telemetria === undefined || ia === undefined) {
```

```mutacao
arquivo: apps/api/src/worker-config.ts
teste: apps/api/src/worker-config.test.ts
-  if (banco === undefined || proprio === undefined || pools === undefined || vagasPadrao === undefined || janelaPadrao === undefined || vagasDesligadas === undefined || telemetria === undefined || ia === undefined) {
+  if (banco === undefined || proprio === undefined || pools === undefined || janelaPadrao === undefined || vagasDesligadas === undefined || telemetria === undefined || ia === undefined) {
```

```mutacao
arquivo: apps/api/src/worker-config.ts
teste: apps/api/src/worker-config.test.ts
-  if (banco === undefined || proprio === undefined || pools === undefined || vagasPadrao === undefined || janelaPadrao === undefined || vagasDesligadas === undefined || telemetria === undefined || ia === undefined) {
+  if (banco === undefined || proprio === undefined || pools === undefined || vagasPadrao === undefined || vagasDesligadas === undefined || telemetria === undefined || ia === undefined) {
```

```mutacao
arquivo: apps/api/src/worker-config.ts
teste: apps/api/src/worker-config.test.ts
-  if (banco === undefined || proprio === undefined || pools === undefined || vagasPadrao === undefined || janelaPadrao === undefined || vagasDesligadas === undefined || telemetria === undefined || ia === undefined) {
+  if (banco === undefined || proprio === undefined || pools === undefined || vagasPadrao === undefined || janelaPadrao === undefined || telemetria === undefined || ia === undefined) {
```

```mutacao
arquivo: apps/api/src/worker-config.ts
teste: apps/api/src/worker-config.test.ts
-  if (banco === undefined || proprio === undefined || pools === undefined || vagasPadrao === undefined || janelaPadrao === undefined || vagasDesligadas === undefined || telemetria === undefined || ia === undefined) {
+  if (banco === undefined || proprio === undefined || pools === undefined || vagasPadrao === undefined || janelaPadrao === undefined || vagasDesligadas === undefined || ia === undefined) {
```

```mutacao
arquivo: apps/api/src/worker-config.ts
teste: apps/api/src/worker-config.test.ts
-  if (banco === undefined || proprio === undefined || pools === undefined || vagasPadrao === undefined || janelaPadrao === undefined || vagasDesligadas === undefined || telemetria === undefined || ia === undefined) {
+  if (banco === undefined || proprio === undefined || pools === undefined || vagasPadrao === undefined || janelaPadrao === undefined || vagasDesligadas === undefined || telemetria === undefined) {
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › o provedor indisponível numa ferramenta
-  return comando?.fila === 'lote' && !prazo.aborted && erro.codigoDeIa === ErrorCode.IA_INDISPONIVEL && erro.motivo !== 'soberania'
+  return !prazo.aborted && erro.codigoDeIa === ErrorCode.IA_INDISPONIVEL && erro.motivo !== 'soberania'
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › fora do lote, o balde cheio
-      const adiavelSemEnvio = pedido.fila === 'lote' && erro instanceof LLMError && erro.semEnvio
+      const adiavelSemEnvio = erro instanceof LLMError && erro.semEnvio
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o provedor que falhou depois de a chamada sair
-      const adiavelSemEnvio = pedido.fila === 'lote' && erro instanceof LLMError && erro.semEnvio
+      const adiavelSemEnvio = pedido.fila === 'lote' && erro instanceof LLMError
```

```mutacao
arquivo: apps/api/src/ia/worker-de-ia.ts
teste: apps/api/src/worker-config.test.ts › lê o pool de cada fila da IA
-export const FILAS_DA_IA = ['interativa', 'ferramenta', 'normal', 'lote'] as const satisfies readonly QueueName[]
+export const FILAS_DA_IA = ['interativa', 'ferramenta', 'normal'] as const satisfies readonly QueueName[]
```

```mutacao
arquivo: packages/core/src/material/texto-das-secoes.ts
teste: packages/core/src/material/texto-das-secoes.test.ts
-  if (texto.length <= maximo) return texto
+  if (false) return texto
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › o repository da A grava a resposta da própria seção e ignora
-      if (secao === undefined || !vivos.has(secao.materialId)) continue
+      if (!vivos.has(secao!.materialId)) continue
```

```mutacao
arquivo: apps/api/src/material/classificar-secoes.command.ts
teste: apps/api/src/material/classificacao.int.test.ts › o Médio e o 8º ano vão juntos
-    const ordenadas = [...candidatas.values()].sort((a, b) => (a.codigo < b.codigo ? -1 : a.codigo > b.codigo ? 1 : 0))
+    const ordenadas = [...candidatas.values()]
```

```mutacao
arquivo: apps/api/src/material/classificar-secoes.command.ts
teste: apps/api/src/material/classificacao.int.test.ts › o Médio e o 8º ano vão juntos
-    const ordenadas = [...candidatas.values()].sort((a, b) => (a.codigo < b.codigo ? -1 : a.codigo > b.codigo ? 1 : 0))
+    const ordenadas = [...candidatas.values()].sort((a, b) => (a.codigo < b.codigo ? 1 : a.codigo > b.codigo ? -1 : 0))
```

```mutacao
arquivo: apps/api/src/material/classificar-secoes.command.ts
teste: apps/api/src/material/classificacao.int.test.ts › a união dos recortes acima de 300 candidatas não é cortada
-    const ordenadas = [...candidatas.values()].sort((a, b) => (a.codigo < b.codigo ? -1 : a.codigo > b.codigo ? 1 : 0))
+    const ordenadas = [...candidatas.values()].sort((a, b) => (a.codigo < b.codigo ? -1 : a.codigo > b.codigo ? 1 : 0)).slice(0, 300)
```

```mutacao
arquivo: apps/api/src/material/classificar-secoes.command.ts
teste: apps/api/src/material/classificacao.int.test.ts › o código do Médio numa seção do Fundamental
-      if (recorte === undefined || resposta.codigos.some((codigo) => !habilidadeEhCandidata(codigo, recorte.componente, recorte.series))) throw new LLMError('IA_SAIDA_INVALIDA')
+      if (recorte === undefined || false) throw new LLMError('IA_SAIDA_INVALIDA')
```

```mutacao
arquivo: apps/api/src/material/classificar-secoes.command.ts
teste: apps/api/src/material/classificacao.int.test.ts › o Médio e o 8º ano vão juntos
-      if (recorte === undefined || resposta.codigos.some((codigo) => !habilidadeEhCandidata(codigo, recorte.componente, recorte.series))) throw new LLMError('IA_SAIDA_INVALIDA')
+      if (recorte === undefined || resposta.codigos.some((codigo) => habilidadeEhCandidata(codigo, recorte.componente, recorte.series))) throw new LLMError('IA_SAIDA_INVALIDA')
```

```mutacao
arquivo: apps/api/src/material/classificar-secoes.command.ts
teste: apps/api/src/material/classificacao.int.test.ts › a seção de material sem série não vai ao modelo
-    if (lido.semRecorte.length > 0) await repositorio.limparDaExecucao(execucaoId, lido.semRecorte)
+    if (false) await repositorio.limparDaExecucao(execucaoId, lido.semRecorte)
```

```mutacao
arquivo: apps/api/src/material/classificar-secoes.command.ts
teste: apps/api/src/material/classificacao.int.test.ts › a seção de material sem série não vai ao modelo
-    for (const secao of vivas.filter((viva) => recorteDaSecao.has(viva.secaoId))) {
+    for (const secao of vivas) {
```

```mutacao
arquivo: apps/api/src/material/classificar-secoes.command.ts
teste: apps/api/src/material/classificacao.int.test.ts › a seção de material sem série não vai ao modelo
-    const semRecorte = vivas.filter((viva) => !recorteDaSecao.has(viva.secaoId)).map((viva) => viva.secaoId)
+    const semRecorte: string[] = []
```

```mutacao
arquivo: apps/api/src/material/classificar-secoes.command.ts
teste: apps/api/src/material/classificacao.int.test.ts › o Médio e o 8º ano vão juntos
-      recorteDaSecao.set(secao.secaoId, { componente, series })
+      // removido
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › a seção de material sem série não vai ao modelo
-      .where(and(eq(secaoDoMaterial.escolaId, escolaId), eq(secaoDoMaterial.execucaoId, execucaoId), isNull(secaoDoMaterial.corrigidaEm), soAsSecoes === undefined ? undefined : inArray(secaoDoMaterial.id, [...soAsSecoes])))
+      .where(and(eq(secaoDoMaterial.escolaId, escolaId), eq(secaoDoMaterial.execucaoId, execucaoId), isNull(secaoDoMaterial.corrigidaEm)))
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/material/classificacao.int.test.ts › a execução do Assistente, de uma pessoa
-    if (comando?.fila === 'lote' && (await this.#antesDeRodarOLote(execucoes, execucaoId, escolaId, lida, comando))) return false
+    if ((await this.#antesDeRodarOLote(execucoes, execucaoId, escolaId, lida, comando))) return false
```

### O que ficou sem bloco, e por quê

- `apps/api/src/ia/execucao-command.ts:102`, o `throw` do `concluirSemModelo` ausente: o comando que devolve `semModelo` declara o `concluirSemModelo` no mesmo objeto (o registro e o tipo de `ComandoExecutavel` os pedem juntos), então o ramo é uma rede de segurança que nenhum comando real alcança; tirá-la não muda comportamento observável.
- `apps/api/src/ia/execucao.processor.ts:157` e `:159`, a releitura da suspensão que falha por erro que não é de domínio: o erro sobe e o job falha, e a reentrega decide (o `catch` não grava nada). Só a falha da leitura do banco o alcança, e provocá-la exigiria derrubar a conexão no meio da passagem; a suspensão de verdade (`FUNCAO_SUSPENSA`) tem blocos e caso próprios.
- `apps/api/src/ia/execucao.processor.ts:267`, o termo `erro instanceof LLMError`: é o estreitamento de tipo de `unknown` para `LLMError`, que o `tsc` do portão exige antes de `adiavelNoLote(erro, ...)`; sem ele o código não compila. A mesma razão vale para `packages/core/src/ia/llm-gateway.ts:268`.
- `apps/api/src/material/classificar-secoes.command.ts:93`, os termos `componente === undefined` e `series.length === 0`: o primeiro também é estreitamento de tipo (o `Map.get` devolve `undefined`, e o `tsc` o recusa sem ele); o segundo só poupa a ida ao repository, porque `candidatas(componente, [])` devolve `[]` (caso "`candidatas`: só as do componente e das séries, e nenhuma sem série"), o mesmo efeito.
- `apps/api/src/material/classificar-secoes.command.ts:106`, o termo `recorte === undefined` da validação do `concluir`: só se alcança com uma resposta de seção que não foi ao modelo, e o gateway já recusa a seção inventada (sonda c1) antes de o `concluir` rodar; é o estreitamento de tipo do `Map.get` e, de reserva, falha `IA_SAIDA_INVALIDA`. O outro termo, o código fora do recorte da própria seção, tem os blocos dele.
- `apps/api/src/material/classificar-secoes.command.ts:96`, `recortesJaLidos.has(chave)`: é só a economia de ler o mesmo recorte duas vezes; o `Map` de candidatas é por código, então a segunda leitura sobrescreve com o mesmo valor (mutante equivalente no resultado, e o custo é uma consulta a mais por seção).
- `apps/api/src/material/secoes.repository.ts:66`, `:67` e `:102`, os termos de junção por `escola_id` e por `id` (os de `material`, os do capítulo e os da série): são a chave composta que as FKs compostas do modelo já garantem (a seção só aponta para material, capítulo e série da própria escola), então a junção sem um dos dois termos devolve a mesma linha; o isolamento tem o `where` de `escola_id` da seção (bloco da linha 68) e o caso "o repository, no contexto da A".
- `apps/api/src/material/secoes.repository.ts:90`, `:98` e `:104`: `disciplinaIds.length > 0` e `materialIds.length > 0` são a guarda contra `inArray` com lista vazia, e o `?? []` só abre a lista da primeira série do material; o `preparar` nunca chama com lista vazia (há ao menos uma seção viva), e o segundo material do mesmo recorte é o caso dos dois recortes.
- `apps/api/src/material/secoes.repository.ts:116`, `:132`, `:137` e `:180`, os `if (lista.length === 0) return`: são atalhos que poupam a consulta; sem eles a consulta com lista vazia devolve o mesmo `[]` ou `0` (mutante equivalente no resultado).
- `apps/api/src/material/secoes.repository.ts:120`, `.where(inArray(habilidadeBncc.etapa, etapas))`: filtra por etapa para ler menos linhas, e o `habilidadeEhCandidata` que vem logo depois decide por etapa de novo; sem o `where` o resultado é o mesmo (a medida do Arquiteto diz o custo).
- `apps/api/src/material/secoes.repository.ts:136` e `:141`, os termos de `escola_id` e de `id` das leituras que antecedem o `update`: são pré-filtros, e o `update` da linha 149 em diante repete `s.escola_id`, `s.id`, `s.execucao_id`, `s.corrigida_em` e junta `m.escola_id`/`m.id`, com bloco nas duas cláusulas que mudam o efeito (`execucao_id` e `corrigida_em`, P9 e P1a) e com o caso "o repository, no contexto da A".
- `apps/api/src/material/secoes.repository.ts:149`, `:151`, `:152`, `:156` e `:157`, as linhas do SQL `update ... from material m where s.escola_id ... and m.escola_id ... and m.id ...`: `update` e `from` são a sintaxe do comando (sem elas o SQL não roda); `s.escola_id` e a junção `m.escola_id`/`m.id` repetem o que a PK de `s.id` e as FKs compostas já garantem, e a prova de que a gravação só alcança a escola do contexto é o caso "o repository da A grava a resposta da própria seção e ignora…" e o de isolamento. As cláusulas que mudam o efeito (`s.id`, `s.execucao_id`, `s.corrigida_em`) têm bloco.
- `apps/api/src/material/secoes.repository.ts:161`, `:179`, `:182` e `:186`, os termos da leitura, dos `delete` das habilidades e do `update` do `limparDaExecucao`: a leitura (179) escolhe os ids, e o `delete` (182) e o `update` (186) repetem de propósito os termos de escola, execução e `corrigida_em` (nenhum confia na leitura anterior), então tirar um termo de um deles fica coberto pelos outros; o caso "`limparDaExecucao` limpa só as seções não corrigidas da execução, e só as habilidades `ia` delas" cobra o conjunto.
- `packages/core/src/db/schema/execucao-agente.ts:109`, a linha de `sql` do check do `resultado`: é o espelho em TypeScript do que o banco roda, e o banco roda o `.sql` da `0063`; o caso "caminho feliz" do `classificacao.int.test.ts` grava `classificacao_do_material` por esse check (sem o tipo na lista, o `update` falharia com `23514`).

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| privacy-guardian (1ª) | `docs/lgpd.md`: registrar na linha de `consumo_ia` que para `classificar_secoes` a entrada guarda só ids e versão do prompt (`entradaParaORegistro`) | `TODO.md`: o arquivo não é da 4.0 e o comportamento já está provado em `classificacao.int.test.ts` › caminho feliz |
| privacy-guardian (1ª) | Manter o teste de que o resumo do erro (`summarizeError`) nunca leva a mensagem do erro | Nada a aplicar: pede para manter o que existe |
| tenancy-guardian (1ª) | O escopo de escola repetido em camadas em `gravarClassificacao` e `limparDaExecucao`: nenhuma mutação de uma cláusula só deixa teste vermelho | Recusada: a redundância é intencional, a justificativa está em "Mutações" do documento, e os casos de isolamento provam o efeito do conjunto |
| tenancy-guardian (1ª) | O balde `lote` de tokens é global (5%) e a justiça entre escolas fica só na vaga por escola | Recusada: `infra-guardian` examinou e aprovou; `techspec.md` §7c ("Limite por escola") já declara o balde `lote`, a vaga por escola e, na 5.0, o limite de execuções por noite |
| llm-integrator (1ª) | O adiamento por provedor fora não tem teto de idade nem de adiamentos | Tarefa 5.0 (5.4, o alerta `classificacao-atrasada` e o runbook); a Tech Spec §5 manda adiar sem gastar tentativa |
| llm-integrator (1ª) | Teto de custo por escola explícito na 5.0 e no runbook | Tarefa 5.0 (5.4, o runbook): `techspec.md` §7c já diz que o limite de execuções por noite é da rotina |
| llm-integrator (1ª) | Conferir em `docs/infra.md` a linha da vaga `lote` dividida com expurgo e eliminação | Nada a aplicar: o diff de `docs/infra.md` já a cobre; o Validador confere |
| infra-guardian (1ª) | `0063_resultado_da_classificacao.sql:10-12`: separar o `VALIDATE` em migration própria antes do piloto | `TODO.md` (o precedente é a 0058 e a 0062) |
| infra-guardian (1ª) | Sinal para o lote que nunca termina (contador `ia.execucao.adiada` por motivo e escola, ou alerta de idade da `pendente` do `lote`, com parágrafo no runbook) | Tarefa 5.0 (5.4, o alerta `classificacao-atrasada` e o runbook): é métrica e painel novos, não cabe em poucas linhas |
| infra-guardian (1ª) | Confirmar que as linhas `falhou` de `consumo_ia` da chamada que saiu e falhou não somam ao orçamento da escola (D14) | `TODO.md`: pergunta ao `llm-integrator` na validação; é comportamento do gateway que a tarefa não muda |
| revisor-geral (1ª) | Leitura em laço no `preparar`: uma consulta de páginas por seção, até 12 | Tarefa 5.0 (5.5, a carga das 300 apostilas): "quem confirma é a medida da 5.0" |
| test-engineer (1ª) | P4 com "edição nova" simulado por `estado = 'falhou'` em vez de pelo fluxo de edição nova | Tarefa 12.0 (o fluxo inteiro no e2e, com a edição nova de verdade) |
| infra-guardian (3.0, 1ª e 2ª), llm-integrator (3.0, 1ª e 2ª) | Declarar o freio de custo da classificação: não há teto de custo por escola (`orcamento.repository.ts` devolve `permitido` fora do Tutor), e o limitador é a vaga `lote` por escola, o balde `lote` global (5 %) e o limite de execuções por noite e por escola | a vaga e o balde entraram nesta tarefa e estão na §7c; o limite de execuções por noite e por escola é da rotina (5.0), que cria as execuções |
| infra-guardian (3.0, 1ª) | Dimensionar a vazão pela conta de ~31 mil tokens, e não pela de 12 mil | tarefa 5.0 (a rotina) e `TODO.md`, entrada da 3.0 |
| pedagogia-reviewer (3.0, 1ª) | `subtitulosDoTexto` e o worker tratam como subtítulo toda linha curta sem ponto final; o texto de PDF pode divergir | o `textoDaSecao` desta tarefa é o único que monta o texto da classificação (os casos de `texto-das-secoes.test.ts` o fixam); a medida do Arquiteto (lote retido) é quem diz a taxa |
| llm-integrator (3.0, 1ª), pedagogia-reviewer (3.0, 1ª e 2ª) | Prompt, teto de saída e injeção sem código: só a medida diz | Arquiteto, ao medir o lote retido |
| privacy-guardian (3.0, 1ª e 2ª) | `docs/lgpd.md` dizer que a classificação não tem titular nem ano | tarefa 9.0 (já toca `docs/lgpd.md`) |
| pedagogia-reviewer e conformidade-reviewer (3.0) | A frase "nada chega ao aluno sem o professor conferir a habilidade" só tem código na 11.0 | tarefa 11.0 |
| tenancy-guardian (2ª) | Um teste do comando, pelo worker, que prove a recusa da seção de outra escola na resposta do modelo (nada gravado na A, nada tocado na B); hoje só está provado no repository | `TODO.md`: o `tenancy-guardian` aprovou com o isolamento efetivo; o teste pelo worker fica registrado |
| privacy-guardian (2ª) | A pergunta de fechamento: o diff não muda o que o sistema guarda sobre o aluno | Nada a aplicar |
| llm-integrator (2ª) | Anexar ao relatório a estimativa de custo da classificação (tokens por seção, seções por material, materiais por escola por mês) | Recusada: a estimativa está na `techspec.md` §8 (cerca de 625 chamadas por onboarding, de R$ 4 a R$ 20 por escola), e a conversão por escola/mês é da 5.0, com o limite de execuções por noite |
| llm-integrator (2ª), infra-guardian (2ª), revisor-geral (2ª) | Com a união acima de 300 candidatas a execução falha com `IA_ENTRADA_INVALIDA` e as seções ficam presas a ela; a 5.0 agrupa por recorte, reagenda e prova que nenhum recorte passa de 300 | Tarefa 5.0 (5.3 e 5.6): a `techspec.md` §5 já diz que a execução é de um recorte e que a 5.0 agrupa por ele |
| llm-integrator (2ª) | Confirmar que o caso "o Tutor da outra fila segue o caminho dele" continua coberto em outro teste, depois de sair do título em `llm-gateway.test.ts` | Recusada: o título prometia o que o caso nunca afirmou; o caso agora afirma `IA_INDISPONIVEL` e `modelosPedidos` |
| revisor-geral (2ª) | A seção sem recorte continua presa à execução e soma `falhas_seguidas` quando outra seção da execução falha por `IA_SAIDA_INVALIDA` | Tarefa 5.0 (5.3): a rotina agrupa por recorte e a seção sem recorte não é agendada |
| revisor-geral (2ª) | Comentário curto no `concluir` dizendo que `IA_SAIDA_INVALIDA` é escolhido para cair no `aoFalharDefinitivo` | Recusada: o `cenarios.md` (c1) manda `IA_SAIDA_INVALIDA` para o código fora das candidatas; o código não é escolha do comando |
| conformidade-reviewer (2ª) | A 11.0 prova que habilidade `origem: 'ia'` não chega ao aluno nem orienta o Tutor sem o professor conferir | Tarefa 11.0 |
| revisor-geral (3ª) | Escrever no `cenarios.md` (linhas 107 e 108) que a reentrega de `rodando` e as duas entregas ao mesmo tempo deixam só a linha estimada em `consumo_ia` (função `classificacao_do_material`, sem aluno) | Recusada: o comportamento vem da 6.0 e o `revisor-geral` disse que não diverge da spec; o `4_task.md` e os três casos (`classificacao.int.test.ts`) já o provam |
| revisor-geral (3ª) | Partir em duas linhas o comentário sobre o `ativo` à mão em `classificacao.int.test.ts` | Recusada: cosmético, e mexer no arquivo de teste caducaria a rodada dos dois revisores que acabaram de aprovar |
| test-engineer (3ª) | O caso do `daRotina` (`:865`) não tem bloco de mutação próprio; hoje é coberto pela mesma mutação do caso paralelo | Recusada: a mutação de `registrarEstimada` o deixa vermelho. Abrir bloco próprio se a reentrega ganhar caminho próprio (a 5.0) |
| test-engineer (3ª) | O caso "depois de concluir" (`:777`) poderia afirmar o conteúdo da linha de consumo, e não só a contagem | Recusada: o `test-engineer` a chamou de cobertura extra que não bloqueia |

### O que a rodada 1 mandou aplicar, e o que ficou diferente

- **Item 13 (consumo do "provedor fora depois da chamada" na integração):** a bancada usa o adaptador falso do gateway, que não falha, e o `comModelo` substitui o gateway inteiro (sem consumo): a linha de consumo da chamada que saiu e falhou é afirmada na unidade do gateway (`llm-gateway.test.ts` › "o provedor que falhou depois de a chamada sair não é `semEnvio`"), onde o adaptador é roteirizado. Na integração fica o adiamento sem tentativa.
- **Item 16 (material com série e material sem série na mesma execução):** não era só caso de borda, era defeito, e entrou com o item 1 (a seção sem recorte não vai ao modelo e volta a `nao_agendada`; `llm-integrator` opina na rodada 2).
- **Item 5 (pacote do Tutor):** com a turma sem aluno o pacote é 1 × o limite por aluno; com 1 por mês e nenhuma troca, a turma está a uma troca de esgotar (limite − 1), e o teste afirma `permitido: true` antes e depois e a contagem de `mensagem_tutor` igual.

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-17 21:46:00 | 2026-11-17 21:46:22 | `tenancy-guardian` | 2 | APROVADO | a76850a7c82c97eb1 |
| 2026-11-17 21:46:10 | 2026-11-17 21:46:39 | `privacy-guardian` | 2 | APROVADO | a1c6df6ed57afa0f5 |
| 2026-11-17 21:46:30 | 2026-11-17 21:46:56 | `llm-integrator` | 2 | APROVADO | a625f2e16497bba6c |
| 2026-11-17 21:46:20 | 2026-11-17 21:47:09 | `infra-guardian` | 2 | APROVADO | a3f10fe9a52972d53 |
| 2026-11-17 21:46:40 | 2026-11-17 21:47:18 | `conformidade-reviewer` | 2 | APROVADO | af39b0bdcbabd9fad |
| 2026-11-17 21:46:55 | 2026-11-17 21:48:05 | `revisor-geral` | 2 | APROVADO | aa7c1b7f931ef75e5 |
| 2026-11-17 21:47:13 | 2026-11-17 21:49:47 | `test-engineer` | 2 | REPROVADO | adc18dd5160430bd3 |
| 2026-11-17 22:20:30 | 2026-11-17 22:20:50 | `revisor-geral` | 3 | APROVADO | a78448e74d0df9447 |
| 2026-11-17 22:20:19 | 2026-11-17 22:21:05 | `test-engineer` | 3 | APROVADO | a3bb00a58c4895252 |
