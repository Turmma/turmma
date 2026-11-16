# Tarefa 7.0 — A pergunta do Tutor que espera mais de 20 s termina com "Tentar de novo", e o operador é avisado (47.0)

**Funcionalidade:** reengenharia-continuacao · **Depende de:** 6.0
**Subagentes obrigatórios:** `infra-guardian`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `frontend-reviewer`
**Porte:** grande

## Objetivo

A `interativa` mais de 20 s `pendente` termina `falhou IA_INDISPONIVEL` sem modelo, cortada por quem chega primeiro (o
processador ou o `GET`). A troca não conta, o aluno vê "Tentar de novo", e o operador recebe alerta. A `ferramenta` não tem corte.

## Contexto necessário

- `techspec.md` §4 (o `GET`), §5 ("Os estados", linha `pendente`), §7b, §7c (métrica e alerta)
- `prd.md` RF5; §7; §8b; regras 10, 40, 50, 70, 80
- Código: `apps/api/src/ia/execucoes.service.ts` (`ler`); `apps/web/src/areas/aluno/Tutor.tsx` (l.108–122)

## Subtarefas

- [x] 7.1 — No processador: o `pendente → rodando` ganha, na `interativa`, `criada_em >= now() - 20 s`; com zero linhas, o
  corte (`where estado = 'pendente' and criada_em < now() - 20 s`)
- [x] 7.2 — No `GET`: depois de ler no escopo de quem pediu, só a `interativa` `pendente` vencida, com as mesmas cláusulas
- [x] 7.3 — `ia.espera_estourada{escola_id}`, só quando o corte devolve a linha; o alerta e o runbook (uma escola: a vaga
  dela; várias: capacidade)
- [x] 7.4 — A mensagem fixa acima do "Tentar de novo" quando chegam juntas; `docs/interface.md`, Parte A da conversa
- [x] 7.5 — `docs/aia/tutor.md`: o turno sem modelo pela espera como limitação, só com a regra da D36
- [x] 7.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `infra/grafana/alertas/ia-espera-estourada-por-escola.yaml`, `apps/api/src/ia/corte-da-espera.int.test.ts` | novo |
| `apps/api/src/ia/execucao.processor.ts`, `apps/api/src/ia/execucao.repository.ts`, `apps/api/src/ia/execucoes.service.ts`, `apps/web/src/areas/aluno/Tutor.tsx`, `apps/web/src/areas/aluno/tutor.test.ts`, `e2e/aluno-tutor.spec.ts`, `infra/test/alertas.test.ts`, `docs/runbook.md`, `docs/aia/tutor.md`, `docs/interface.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| processador corta | I | aos 21 s sem `GET`: `falhou`, métrica +1, sem modelo. Mutação: sem o corte | `apps/api/src/ia/corte-da-espera.int.test.ts` › processador corta (e `o processador aos 15 s roda`, o controle) |
| `GET` corta | I | Redis fora, `GET` aos 21 s: `falhou` antes da volta. Mutação: sem o corte | `apps/api/src/ia/corte-da-espera.int.test.ts` › GET corta; `Redis fora e de volta` (o `GET` corta antes de o Redis voltar) |
| `GET` aos 15 s | I | nenhuma escrita | `apps/api/src/ia/corte-da-espera.int.test.ts` › GET aos 15 s |
| `GET` sobre `concluida`, `rodando` | I | nenhuma escrita nem métrica. Mutação: sem o estado | `apps/api/src/ia/corte-da-espera.int.test.ts` › GET sobre `concluida` e `rodando` com mais de 20 s |
| `ferramenta` com 21 s | I | não corta, e roda. Mutação: sem a fila | `apps/api/src/ia/corte-da-espera.int.test.ts` › ferramenta com 21 s; GET sobre a `pendente` da ferramenta com 21 s |
| corrida, processador primeiro | P | ele corta; o `GET`, com barreira entre leitura e `update`, recebe zero linhas e não soma. Mutações: sem a idade no `pendente → rodando`; sem `estado = 'pendente'` no `GET` | `apps/api/src/ia/corte-da-espera.int.test.ts` › corrida, processador primeiro |
| corrida, `GET` primeiro | P | um corte, métrica +1, sem modelo | `apps/api/src/ia/corte-da-espera.int.test.ts` › corrida, GET primeiro |
| Redis fora e de volta | I | em 15 s roda; em 25 s o `GET` cortou e o job sai sem modelo; a ferramenta roda | `apps/api/src/ia/corte-da-espera.int.test.ts` › Redis fora e de volta |
| a troca | I | a cortada não conta; a reenviada (chave nova) conta | `apps/api/src/ia/corte-da-espera.int.test.ts` › a troca |
| isolamento | I | `GET` de usuário da B, e de outro da mesma escola, sobre `pendente` de 21 s: 404 do inexistente, sem escrita. Mutação: cortar antes da leitura | `apps/api/src/ia/corte-da-espera.int.test.ts` › isolamento: o GET de usuário da B |
| isolamento, job | I | job da A com o `execucaoId` da B, vencida: nada muda na B | `apps/api/src/ia/corte-da-espera.int.test.ts` › isolamento, job |
| métrica | U | só `escola_id`; nenhum usuário | `apps/api/src/ia/corte-da-espera.int.test.ts` › as duas métricas só levam `escola_id` (e `origem`); `infra/test/metricas.int.test.ts` e `packages/core/src/telemetry/metrics.test.ts` (lista fechada); `apps/api/src/ia/corte-da-espera.int.test.ts` › reentrega, varredura, a gravação da linha falha |
| alerta | U | separa uma escola de várias; tem runbook. Mutação: o limiar | `infra/test/alertas.test.ts` › regras de alerta provisionadas; `tools/guardas/alerta-tem-runbook.test.ts`; `infra/test/painel.test.ts` |
| tela, cortada | U | "Tentar de novo", sem erro cru | `apps/web/src/areas/aluno/Tutor.test.tsx` › cortada; `apps/web/src/areas/aluno/tutor.test.ts` › a pergunta que falhou fica na conversa |
| tela, D36 junto | U | a mensagem fixa visível, acima do botão | `apps/web/src/areas/aluno/Tutor.test.tsx` › D36 junto; `apps/web/src/areas/aluno/tutor.test.ts` › a mensagem fixa gravada depois da pergunta, com a execução encerrada pela varredura |
| tela, 1366 e 360 px | E | mensagem fixa e "Tentar de novo": `paginaNaoRola`; 44 px, sem rolagem horizontal, axe; `VOCABULARIO_DE_NOTA`; corte por `page.route` | `e2e/aluno-tutor.spec.ts` › a mensagem fixa do 188 gravada e a execução encerrada pela varredura (D36) |
| log | I | o corte só com ids e código | `apps/api/src/ia/corte-da-espera.int.test.ts` › log: o corte, pelo processador e pelo GET, leva só ids |

## Como testar

- Corrida: `WriteBlockTrigger`, `esperarNaTrava` (`apps/api/test/write-block-trigger.ts`); idade recuando `criada_em`
- Redis fora: `apps/despachante/test/redis-down.int.test.ts` › "parado: 50 POSTs dão 202…"
- `GET` e isolamento: `apps/api/src/ia/ia.int.test.ts` › "de outra pessoa, de outra escola, inexistente… respondem igual"
- Tela: `e2e/aluno-tutor.spec.ts` › "em avaliação: o aviso com o título dela… a mensagem de assunto delicado recebe o
  encaminhamento com o 188"; `e2e/support/coordenacao.ts` (`paginaNaoRola`)
- Comandos: `npx vitest run --project integracao apps/api/src/ia/corte-da-espera.int.test.ts`;
  `node tools/ci/e2e.ts --manter-ambiente e2e/aluno-tutor.spec.ts`
- **Telas:** `aluno`, `/tutor/:atividadeAplicadaId`, pergunta com a execução cortada; e com a mensagem fixa junto

## Autoconferência

As 12 perguntas do modelo, respondidas no plano (7.0). Na 1: cada termo dos três `update` (a passagem `pendente → rodando` com a idade, o corte e a relida) é um bloco. Na 2: `grep -rln 'Tentar de novo' e2e/`.

1. **Mutação de cada cláusula:** a seção "Mutações" tem um bloco por termo novo do `marcarRodando` (a idade, e a comparação dela) e do `cortarEspera` (o estado gravado, o erro, o `concluidaEm`, a escola, o id, o `pendente` e a idade), por linha do processador (a fila da espera, o argumento, o corte, a negação do corte, a métrica, o log e a origem `reentrega`), do `GET` (a fila, a negação, a métrica, o log e a relida), da varredura (a origem, a linha da métrica e a contagem antes da gravação), da `MetricasDaExecucao` (cada rótulo e o valor somado), das métricas (a lista fechada e os dois nomes), do alerta (o `for`, o `noDataState`, cada limiar, o `>= 3` e o `offset`), do runbook (a âncora), do painel, do `ESCOLA` do ensaio, do extrator de PromQL, do `pendenteNoTutor` e da fiação do medidor. O que não tem bloco tem o motivo na prosa de "Mutações".
2. **Texto na tela:** nenhum texto novo: a falha é a de sempre ("O Tutor não conseguiu responder agora. Tente de novo."), e `grep -rln 'Tentar de novo' e2e/` acha os specs que já a exercitam (`e2e/aluno-tutor.spec.ts` é o que importa; os outros são de outras telas e não mudam). Um caso novo entra em `e2e/aluno-tutor.spec.ts` (o da mensagem fixa, que também tem o botão; o corte sem a mensagem fixa é do componente, em `Tutor.test.tsx`, e a falha sem corte já tinha o e2e dela).
3. **Segundo dado:** duas escolas (A e B) nos casos de isolamento e de métrica; dois alunos na mesma escola (o do dono e o `outroAluno`) no `GET`; a execução da ferramenta (a que **não** corta) ao lado da do Tutor; a `concluida` e a `rodando` de mais de 20 s (as iscas do `GET`); uma terceira pergunta de 15 s (a que fica).
4. **Checagem anterior (o controle):** "o processador aos 15 s roda" ao lado de "processador corta"; "isolamento, job" corta no contexto da B depois de provar que no da A não alcança; "isolamento" do `GET` faz a dona cortar a sua antes de os outros receberem 404; "a troca" confere que a pergunta em andamento **bloqueia** o freio antes de provar que a cortada não conta.
5. **Asserção:** o estado, o erro e a hora de fim da execução, as linhas de `consumo_ia`, as chamadas ao modelo (contadas) e as séries do medidor, lidos do banco e do medidor; a resposta do `GET` por `toEqual`. Nunca o texto do código.
6. **Guarda nova:** nenhuma. As duas `@Unscoped` da 6.0 não mudam; `cortarEspera` e `marcarRodando` têm o `escolaId` do contexto (`tools/guardas/repositories-com-escopo.test.ts`). A lista de arquivos e de títulos de `alerta-tem-runbook.test.ts` ganha o arquivo novo, e `infra/test/metricas.int.test.ts` ganha as duas métricas na lista fechada.
7. **Comentários:** os docblocks do processador, do repository, do `ExecucoesService` e de `MetricasDaExecucao` dizem o que o código faz agora; o comentário de `pendenteNoTutor` diz por que a mensagem fixa não esconde a pergunta; a lista de `metricas.test.ts` e o título dela citam a 7.0.
8. **Divergências:** a tabela abaixo; a decisão está no `techspec.md` ("Como a 7.0 ficou") e no `cenarios.md`; o `prd.md` não diz o contrário.
9. **Peça que já existe:** `WriteBlockTrigger` e `esperarNaTrava`, `FilaDeIa` (`entregarDeNovo`, `varredura`, `comModelo`), `SessaoFixtures`, `montarEscolaComTurma`, `OrcamentoRepository`, `tools/testes/compose.ts` (o Redis de fila), `paginaNaoRola` e `VOCABULARIO_DE_NOTA`, `mockAlunoApi`, `setupScreen` e `fakeNetwork`. A métrica reaproveita o `ROTULO_ESCOLA` e o `Meter` do `core`.
10. **Concorrência:** as duas direções da corrida (o processador primeiro, com o `GET` lendo `pendente` e recebendo zero linhas; o `GET` primeiro, com o processador esperando a linha e achando `falhou`), cada uma com a barreira no banco (`WriteBlockTrigger` e `esperarNaTrava`); a métrica soma uma vez nas duas.
11. **Isolamento e "Caso":** o `GET` de usuário da B, de outro da mesma escola e de id inexistente, com a mesma resposta; o job da A com a execução da B; o repository no contexto da A e no da B; a coluna "Caso" está preenchida.
12. **Guardiões e achados:** `infra-guardian` (o corte antes da vaga, o alerta que separa uma escola de várias, o `offset`, o runbook, o Redis fora), `tenancy-guardian` (o `escolaId` do contexto nos dois `update`, o 404 igual antes de qualquer escrita), `conformidade-reviewer` (a D36 acima do botão, o corte sem decidir sobre o aluno, a AIA) e `frontend-reviewer` (a ordem na tela, os 44 px, o 360 px, o axe); as recomendações herdadas estão em "Recomendações sem aplicar".

## Fora do escopo desta tarefa

"N perguntas que o Tutor não respondeu hoje" (9.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| O contador `ia.execucao.interrompida{escola_id, origem}` entra na 7.0, por pedido do Orquestrador (a 6.0 o deixou para cá) | A 7.0 já cria a `MetricasDaExecucao`, o painel e a lista fechada; os dois contadores saem do mesmo ponto (depois do `update` que devolve a linha) | `techspec.md` §5 "Como a 7.0 ficou" (4); `cenarios.md` (`ia.execucao.interrompida`) |
| `Tutor.tsx` não muda: a mudança da tela é em `pendenteNoTutor` (`tutor.ts`) | A falha já é renderizada **depois** da lista, e a mensagem fixa é item dela; o que faltava era a pergunta não se repetir quando a mensagem fixa vem gravada depois dela | `techspec.md` §5 "Como a 7.0 ficou" (6); `Tutor.test.tsx` › D36 junto |
| O alerta separa "uma escola" de "várias" em **duas regras** do mesmo arquivo, com limiar de 3 cortes em 10 min por escola | Um corte isolado é um tropeço, e o aluno já vê "Tentar de novo"; a diferença entre a vaga de uma escola e a capacidade é o que o runbook manda olhar primeiro | `techspec.md` §5 "Como a 7.0 ficou" (5); §7c |
| `docs/runbook.md` conta como código para a caducidade da rodada | As duas entradas do runbook são a resposta do operador ao alerta; a guarda `alerta-tem-runbook` as lê | `techspec.md` §7c (Métrica e alerta) |
| `tools/testes/promql.ts` ganha `offset` entre as palavras do PromQL | O extrator de nomes de métrica lia `offset` como se fosse métrica, e a regra nova usa `offset 10m` | `techspec.md` §5 "Como a 7.0 ficou" (5) |

## Mutações

--faltando: 0 linhas (57 blocos, 5 motivos)

Cada bloco tira uma cláusula e exige o vermelho de um caso que rodou. Os que provam uma ausência levam o `falha:`.

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/corte-da-espera.int.test.ts › processador corta
       .where(
         and(
           eq(execucaoAgente.escolaId, requireEscolaId()),
           eq(execucaoAgente.id, id),
           eq(execucaoAgente.estado, 'pendente'),
-          esperaMaximaSegundos === undefined ? undefined : gte(execucaoAgente.criadaEm, sql`now() - make_interval(secs => ${esperaMaximaSegundos}::float8)`),
+          undefined,
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/corte-da-espera.int.test.ts › o processador aos 15 s roda
-          esperaMaximaSegundos === undefined ? undefined : gte(execucaoAgente.criadaEm, sql`now() - make_interval(secs => ${esperaMaximaSegundos}::float8)`),
+          esperaMaximaSegundos === undefined ? undefined : lt(execucaoAgente.criadaEm, sql`now() - make_interval(secs => ${esperaMaximaSegundos}::float8)`),
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/corte-da-espera.int.test.ts › processador corta
-      .set({ estado: 'falhou', erro: ErrorCode.IA_INDISPONIVEL, concluidaEm: sql`now()` })
+      .set({ estado: 'falhou', erro: ErrorCode.EXECUCAO_INTERROMPIDA, concluidaEm: sql`now()` })
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/corte-da-espera.int.test.ts › processador corta
-      .set({ estado: 'falhou', erro: ErrorCode.IA_INDISPONIVEL, concluidaEm: sql`now()` })
+      .set({ estado: 'concluida', erro: ErrorCode.IA_INDISPONIVEL, concluidaEm: sql`now()` })
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/corte-da-espera.int.test.ts › processador corta
-      .set({ estado: 'falhou', erro: ErrorCode.IA_INDISPONIVEL, concluidaEm: sql`now()` })
+      .set({ estado: 'falhou', erro: ErrorCode.IA_INDISPONIVEL, concluidaEm: undefined })
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/corte-da-espera.int.test.ts › isolamento, job
falha: toBe(false)
       .set({ estado: 'falhou', erro: ErrorCode.IA_INDISPONIVEL, concluidaEm: sql`now()` })
       .where(
         and(
-          eq(execucaoAgente.escolaId, requireEscolaId()),
           eq(execucaoAgente.id, id),
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/corte-da-espera.int.test.ts › GET corta
falha: toMatchObject({ estado: 'pendente', erro: null })
-          eq(execucaoAgente.id, id),
           eq(execucaoAgente.estado, 'pendente'),
           lt(execucaoAgente.criadaEm, sql`now() - make_interval(secs => ${esperaMaximaSegundos}::float8)`),
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/corte-da-espera.int.test.ts › corrida, processador primeiro
-          eq(execucaoAgente.estado, 'pendente'),
           lt(execucaoAgente.criadaEm, sql`now() - make_interval(secs => ${esperaMaximaSegundos}::float8)`),
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/corte-da-espera.int.test.ts › GET aos 15 s
-          lt(execucaoAgente.criadaEm, sql`now() - make_interval(secs => ${esperaMaximaSegundos}::float8)`),
+          gte(execucaoAgente.criadaEm, sql`now() - make_interval(secs => ${esperaMaximaSegundos}::float8)`),
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/corte-da-espera.int.test.ts › ferramenta com 21 s
-    const espera = comando?.fila === 'interativa' ? ESPERA_MAXIMA_DA_INTERATIVA_SEGUNDOS : undefined
+    const espera = ESPERA_MAXIMA_DA_INTERATIVA_SEGUNDOS
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/corte-da-espera.int.test.ts › processador corta
-    const espera = comando?.fila === 'interativa' ? ESPERA_MAXIMA_DA_INTERATIVA_SEGUNDOS : undefined
+    const espera = false ? ESPERA_MAXIMA_DA_INTERATIVA_SEGUNDOS : undefined
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/corte-da-espera.int.test.ts › processador corta
-    if (!(await execucoes.marcarRodando(execucaoId, espera))) {
+    if (!(await execucoes.marcarRodando(execucaoId))) {
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/corte-da-espera.int.test.ts › processador corta
-      if (espera !== undefined && (await this.#cortarEspera(execucoes, execucaoId, escolaId, lida))) return false
+      if (espera !== undefined && false) return false
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/corte-da-espera.int.test.ts › processador corta
-    if (!(await execucoes.cortarEspera(execucaoId, ESPERA_MAXIMA_DA_INTERATIVA_SEGUNDOS))) return false
+    if ((await execucoes.cortarEspera(execucaoId, ESPERA_MAXIMA_DA_INTERATIVA_SEGUNDOS))) return false
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/corte-da-espera.int.test.ts › reentrega: a `rodando` encerrada soma
-    if (encerrada) {
+    if (!encerrada) {
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/corte-da-espera.int.test.ts › processador corta
-    this.#metricas.esperaEstourada(escolaId)
+    void escolaId
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/corte-da-espera.int.test.ts › reentrega: a `rodando` encerrada soma
-      this.#metricas.interrompida(escolaId, 'reentrega')
+      this.#metricas.interrompida(escolaId, 'varredura')
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/corte-da-espera.int.test.ts › log: o corte
-    this.dependencias.logger.warn({ evento: 'ia.execucao.espera_estourada', execucaoId, escolaId, tipo, codigo })
+    this.dependencias.logger.warn({ evento: 'ia.execucao.espera_estourada', execucaoId, escolaId, tipo: execucaoId, codigo })
```

```mutacao
arquivo: apps/api/src/ia/execucoes.service.ts
teste: apps/api/src/ia/corte-da-espera.int.test.ts › GET sobre a `pendente` da ferramenta com 21 s
-    if (execucao.estado === 'pendente' && this.comandos.de(execucao.tarefa).fila === 'interativa') {
+    if (execucao.estado === 'pendente' && this.comandos.de(execucao.tarefa).fila !== 'normal') {
```

```mutacao
arquivo: apps/api/src/ia/execucoes.service.ts
teste: apps/api/src/ia/corte-da-espera.int.test.ts › GET corta
-      if (await new ExecucaoRepository(this.banco).cortarEspera(id, ESPERA_MAXIMA_DA_INTERATIVA_SEGUNDOS)) {
+      if (!(await new ExecucaoRepository(this.banco).cortarEspera(id, ESPERA_MAXIMA_DA_INTERATIVA_SEGUNDOS))) {
```

```mutacao
arquivo: apps/api/src/ia/execucoes.service.ts
teste: apps/api/src/ia/corte-da-espera.int.test.ts › GET corta
-        this.metricas.esperaEstourada(escolaId)
+        void escolaId
```

```mutacao
arquivo: apps/api/src/ia/execucoes.service.ts
teste: apps/api/src/ia/corte-da-espera.int.test.ts › log: o corte
-        this.logger.warn({ evento: 'ia.execucao.espera_estourada', execucaoId: id, escolaId, tipo, codigo })
+        this.logger.warn({ evento: 'ia.execucao.espera_estourada', execucaoId: id, escolaId, tipo: id, codigo })
```

```mutacao
arquivo: apps/api/src/ia/execucoes.service.ts
teste: apps/api/src/ia/corte-da-espera.int.test.ts › GET corta
-      execucao = (await execucoes.deQuemPediu(id)) ?? execucao
+      execucao = execucao
```

```mutacao
arquivo: apps/api/src/ia/varredura-de-execucoes.ts
teste: apps/api/src/ia/corte-da-espera.int.test.ts › varredura: cada `rodando` de 301 s soma
-    for (const encerrada of encerradas) this.#metricas.interrompida(encerrada.escolaId, 'varredura')
+    for (const encerrada of encerradas) this.#metricas.interrompida(encerrada.escolaId, 'reentrega')
```

```mutacao
arquivo: apps/api/src/ia/varredura-de-execucoes.ts
teste: apps/api/src/ia/corte-da-espera.int.test.ts › varredura: cada `rodando` de 301 s soma
-    for (const encerrada of encerradas) this.#metricas.interrompida(encerrada.escolaId, 'varredura')
+    void encerradas
```

```mutacao
arquivo: apps/api/src/ia/metricas-da-execucao.ts
teste: apps/api/src/ia/corte-da-espera.int.test.ts › processador corta
-    this.#esperaEstourada.add(1, { [ROTULO_ESCOLA]: escolaId })
+    this.#esperaEstourada.add(1, {})
```

```mutacao
arquivo: apps/api/src/ia/metricas-da-execucao.ts
teste: apps/api/src/ia/corte-da-espera.int.test.ts › processador corta
-    this.#esperaEstourada.add(1, { [ROTULO_ESCOLA]: escolaId })
+    this.#esperaEstourada.add(2, { [ROTULO_ESCOLA]: escolaId })
```

```mutacao
arquivo: apps/api/src/ia/metricas-da-execucao.ts
teste: apps/api/src/ia/corte-da-espera.int.test.ts › reentrega: a `rodando` encerrada soma
-    this.#interrompida.add(1, { [ROTULO_ESCOLA]: escolaId, origem })
+    this.#interrompida.add(1, { [ROTULO_ESCOLA]: escolaId })
```

```mutacao
arquivo: apps/api/src/ia/metricas-da-execucao.ts
teste: apps/api/src/ia/corte-da-espera.int.test.ts › reentrega: a `rodando` encerrada soma
-    this.#interrompida.add(1, { [ROTULO_ESCOLA]: escolaId, origem })
+    this.#interrompida.add(2, { [ROTULO_ESCOLA]: escolaId, origem })
```

```mutacao
arquivo: packages/core/src/telemetry/metrics.ts
teste: packages/core/src/telemetry/metrics.test.ts › lista fechada
-  METRICS.esperaEstourada,
+  // METRICS.esperaEstourada,
```

```mutacao
arquivo: packages/core/src/telemetry/metrics.ts
teste: packages/core/src/telemetry/metrics.test.ts › lista fechada
-  METRICS.execucaoInterrompida,
+  // METRICS.execucaoInterrompida,
```

```mutacao
arquivo: packages/core/src/telemetry/metrics.ts
teste: apps/api/src/ia/corte-da-espera.int.test.ts › processador corta
-  esperaEstourada: 'ia.espera_estourada',
+  esperaEstourada: 'ia.espera_estourada_x',
```

```mutacao
arquivo: packages/core/src/telemetry/metrics.ts
teste: apps/api/src/ia/corte-da-espera.int.test.ts › reentrega: a `rodando` encerrada soma
-  execucaoInterrompida: 'ia.execucao.interrompida',
+  execucaoInterrompida: 'ia.execucao.interrompida_x',
```

```mutacao
arquivo: infra/grafana/alertas/ia-espera-estourada-por-escola.yaml
teste: infra/test/alertas.test.ts › são as das Tech Specs
         title: Pergunta do Tutor cortada na espera em uma escola
         condition: C
-        for: 0s
+        for: 1m
```

```mutacao
arquivo: infra/grafana/alertas/ia-espera-estourada-por-escola.yaml
teste: infra/test/alertas.test.ts › são as das Tech Specs
         title: Pergunta do Tutor cortada na espera em várias escolas
         condition: C
-        for: 0s
+        for: 1m
```

```mutacao
arquivo: infra/grafana/alertas/ia-espera-estourada-por-escola.yaml
teste: infra/test/alertas.test.ts › são as das Tech Specs
         title: Pergunta do Tutor cortada na espera em uma escola
         condition: C
         for: 0s
-        noDataState: OK
+        noDataState: NoData
```

```mutacao
arquivo: infra/grafana/alertas/ia-espera-estourada-por-escola.yaml
teste: infra/test/alertas.test.ts › são as das Tech Specs
         title: Pergunta do Tutor cortada na espera em várias escolas
         condition: C
         for: 0s
-        noDataState: OK
+        noDataState: NoData
```

```mutacao
arquivo: infra/grafana/alertas/ia-espera-estourada-por-escola.yaml
teste: infra/test/alertas.test.ts › são as das Tech Specs
-              expr: '((sum by (escola_id) (ia_espera_estourada_total) - (sum by (escola_id) (ia_espera_estourada_total offset 10m) or sum by (escola_id) (ia_espera_estourada_total) * 0)) >= 3) and on() (count((sum by (escola_id) (ia_espera_estourada_total) - (sum by (escola_id) (ia_espera_estourada_total offset 10m) or sum by (escola_id) (ia_espera_estourada_total) * 0)) >= 3) == 1)'
+              expr: '((sum by (escola_id) (ia_espera_estourada_total) - (sum by (escola_id) (ia_espera_estourada_total offset 10m) or sum by (escola_id) (ia_espera_estourada_total) * 0)) >= 2) and on() (count((sum by (escola_id) (ia_espera_estourada_total) - (sum by (escola_id) (ia_espera_estourada_total offset 10m) or sum by (escola_id) (ia_espera_estourada_total) * 0)) >= 3) == 1)'
```

```mutacao
arquivo: infra/grafana/alertas/ia-espera-estourada-por-escola.yaml
teste: infra/test/alertas.test.ts › são as das Tech Specs
-              expr: '((sum by (escola_id) (ia_espera_estourada_total) - (sum by (escola_id) (ia_espera_estourada_total offset 10m) or sum by (escola_id) (ia_espera_estourada_total) * 0)) >= 3) and on() (count((sum by (escola_id) (ia_espera_estourada_total) - (sum by (escola_id) (ia_espera_estourada_total offset 10m) or sum by (escola_id) (ia_espera_estourada_total) * 0)) >= 3) == 1)'
+              expr: '((sum by (escola_id) (ia_espera_estourada_total) - (sum by (escola_id) (ia_espera_estourada_total offset 10m) or sum by (escola_id) (ia_espera_estourada_total) * 0)) >= 3) and on() (count((sum by (escola_id) (ia_espera_estourada_total) - (sum by (escola_id) (ia_espera_estourada_total offset 10m) or sum by (escola_id) (ia_espera_estourada_total) * 0)) >= 3) == 2)'
```

```mutacao
arquivo: infra/grafana/alertas/ia-espera-estourada-por-escola.yaml
teste: infra/test/alertas.test.ts › são as das Tech Specs
-              expr: 'count((sum by (escola_id) (ia_espera_estourada_total) - (sum by (escola_id) (ia_espera_estourada_total offset 10m) or sum by (escola_id) (ia_espera_estourada_total) * 0)) >= 3)'
+              expr: 'count((sum by (escola_id) (ia_espera_estourada_total) - (sum by (escola_id) (ia_espera_estourada_total offset 10m) or sum by (escola_id) (ia_espera_estourada_total) * 0)) >= 2)'
```

```mutacao
arquivo: infra/grafana/alertas/ia-espera-estourada-por-escola.yaml
teste: infra/test/alertas.test.ts › são as das Tech Specs
-              expr: 'count((sum by (escola_id) (ia_espera_estourada_total) - (sum by (escola_id) (ia_espera_estourada_total offset 10m) or sum by (escola_id) (ia_espera_estourada_total) * 0)) >= 3)'
+              expr: 'count((sum by (escola_id) (ia_espera_estourada_total) - (sum by (escola_id) (ia_espera_estourada_total offset 5m) or sum by (escola_id) (ia_espera_estourada_total) * 0)) >= 3)'
```

```mutacao
arquivo: infra/grafana/alertas/ia-espera-estourada-por-escola.yaml
teste: infra/test/alertas.test.ts › são as das Tech Specs
-                    params: [1]
+                    params: [2]
```

```mutacao
arquivo: infra/grafana/alertas/ia-espera-estourada-por-escola.yaml
teste: infra/test/alertas.test.ts › são as das Tech Specs
-                    params: [0]
+                    params: [1]
```

```mutacao
arquivo: infra/grafana/alertas/ia-espera-estourada-por-escola.yaml
teste: tools/guardas/alerta-tem-runbook.test.ts › no repositório, cada arquivo
-          runbook_url: https://github.com/Turmma/turmma/blob/main/docs/runbook.md#pergunta-do-tutor-cortada-na-espera-em-várias-escolas
+          runbook_url: https://github.com/Turmma/turmma/blob/main/docs/runbook.md#pergunta-do-tutor-cortada-na-espera-em-varias-escolas
```

```mutacao
arquivo: infra/scripts/ensaio-alertas.ts
teste: infra/test/alertas.test.ts › são as das Tech Specs
-  iaEsperaEstourada: 'educa-ia-espera-estourada-uma-escola',
+  iaEsperaEstourada: 'educa-ia-espera-estourada-x',
```

```mutacao
arquivo: infra/grafana/paineis/fundacao.json
teste: infra/test/painel.test.ts › toda métrica do código tem painel
-          "expr": "sum by (escola_id) (increase(ia_espera_estourada_total[1h]))",
+          "expr": "sum by (escola_id) (increase(ia_pedido_acima_do_teto_total[1h]))",
```

```mutacao
arquivo: infra/grafana/paineis/fundacao.json
teste: infra/test/painel.test.ts › toda métrica do código tem painel
-          "expr": "sum by (escola_id, origem) (increase(ia_execucao_interrompida_total[1h]))",
+          "expr": "sum by (escola_id, origem) (increase(ia_pedido_acima_do_teto_total[1h]))",
```

```mutacao
arquivo: tools/testes/promql.ts
teste: infra/test/alertas.test.ts › toda regra consulta métrica
-  'offset',
+  'offsetx',
```

```mutacao
arquivo: tools/testes/metricas.ts
teste: infra/test/alertas.test.ts › são as das Tech Specs
-  esperaEstourada: ['ia_espera_estourada_total'],
+  esperaEstourada: ['ia_espera_estourada_x'],
```

```mutacao
arquivo: apps/web/src/areas/aluno/tutor.ts
teste: apps/web/src/areas/aluno/tutor.test.ts › a mensagem fixa gravada depois da pergunta, com a execução encerrada pela varredura
-  while (fim > 0 && mensagens[fim - 1]?.autor === 'tutor' && mensagens[fim - 1]?.tipo === 'assunto_delicado') fim -= 1
+  while (fim > 0 && mensagens[fim - 1]?.autor === 'tutor' && mensagens[fim - 1]?.tipo === 'texto') fim -= 1
```

```mutacao
arquivo: apps/web/src/areas/aluno/tutor.ts
teste: apps/web/src/areas/aluno/Tutor.test.tsx › D36 junto
-  const ultima = mensagens[fim - 1]
+  const ultima = mensagens.at(-1)
```

```mutacao
arquivo: apps/web/src/areas/aluno/tutor.ts
teste: apps/web/src/areas/aluno/tutor.test.ts › a mensagem fixa gravada depois da pergunta, com a execução encerrada pela varredura
-  const ultima = mensagens[fim - 1]
+  const ultima = mensagens.at(-1)
```

```mutacao
arquivo: apps/api/src/app.module.ts
teste: apps/api/src/ia/corte-da-espera.int.test.ts › GET corta
-        IaModule.forRoot({ ...(opcoes.medidor === undefined ? {} : { medidor: opcoes.medidor }), ...(opcoes.logger === undefined ? {} : { logger: opcoes.logger }) }),
+        IaModule.forRoot(),
```

```mutacao
arquivo: apps/api/src/ia/ia.module.ts
teste: apps/api/src/ia/corte-da-espera.int.test.ts › GET corta
-            new ExecucoesService(banco, comandos, new MetricasDaExecucao(opcoes.medidor ?? globalMeter()), opcoes.logger ?? createLogger({ servico: 'api' })),
+            new ExecucoesService(banco, comandos, new MetricasDaExecucao(globalMeter()), opcoes.logger ?? createLogger({ servico: 'api' })),
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/corte-da-espera.int.test.ts › o processador aos 15 s roda
-    if (!(await this.#comecar(execucoes, execucaoId, escolaId, lida, comando))) return
+    if (await this.#comecar(execucoes, execucaoId, escolaId, lida, comando)) return
```

```mutacao
arquivo: apps/api/src/ia/execucoes.service.ts
teste: apps/api/src/ia/corte-da-espera.int.test.ts › isolamento: o GET de usuário da B
-    let execucao = await execucoes.deQuemPediu(id)
+    await new ExecucaoRepository(this.banco).cortarEspera(id, ESPERA_MAXIMA_DA_INTERATIVA_SEGUNDOS)
+    let execucao = await execucoes.deQuemPediu(id)
```

```mutacao
arquivo: apps/api/src/ia/varredura-de-execucoes.ts
teste: apps/api/src/ia/corte-da-espera.int.test.ts › a gravação da linha falha
       const consumo = new ConsumoRepository(tx)
+      for (const encerrada of encerradas) this.#metricas.interrompida(encerrada.escolaId, 'varredura')
       for (const encerrada of encerradas) await consumo.registrarEstimada(encerrada, this.destino)
       return encerradas
     })
-    for (const encerrada of encerradas) this.#metricas.interrompida(encerrada.escolaId, 'varredura')
```

**Sem mutação**, cada termo com o motivo (o que a conferência `--faltando` lista, e o que ela não alcança):

- `execucao.estado === 'pendente'` (o `GET`): é uma economia de ida ao banco. Sem ele, o `cortarEspera` roda sobre a `concluida` e a `rodando` e recebe zero linhas pelo `where estado = 'pendente'` do repository, que tem bloco, e o corpo da resposta e a métrica ficam iguais. O caso "GET sobre `concluida` e `rodando`" prova o resultado.
- `espera !== undefined` (o `#comecar` do processador, antes do corte): `espera` só é definida para a `interativa`; na `ferramenta` o `marcarRodando` sem idade só devolve `false` se a execução já não está `pendente`, e então o `cortarEspera` também devolve `false`. Tirar o termo não muda o resultado; a fila tem bloco.
- `if (!(await execucoes.marcarRodando(execucaoId, espera))) {`: a negação do `marcarRodando` é a da 6.0 (a reentrega), coberta pelos blocos de `execucao-interrompida.int.test.ts`; o argumento novo, `espera`, tem bloco.
- `while (fim > 0 && …)`, `mensagens[fim - 1]?.autor === 'tutor'` (o `pendenteNoTutor`): `fim > 0` só evita ler antes do começo (`mensagens[-1]` é `undefined`, e o `?.` já para o laço), e `assunto_delicado` só existe com o autor `tutor`; o `tipo` tem bloco, e a posição da última (`mensagens[fim - 1]`) também.
- `if (!(await execucoes.cortarEspera(…))) return false` (o `#cortarEspera`): tem bloco (a negação); a linha de baixo, a métrica e o log, também.
- A fiação do medidor e do logger no `ia.module.ts` (`opcoes.logger ?? createLogger({ servico: 'api' })`): só escolhe de onde vem o logger do aviso do corte; o medidor tem bloco, e o conteúdo do log, o caso "log".

## Recomendações sem aplicar

Herdada da tarefa 6.0 (a que dizia 7.0), **resolvida aqui**: o contador `ia.execucao.interrompida` por escola e origem (`infra-guardian`, 1ª da 6.0) é `MetricasDaExecucao.interrompida`, contado depois do `update` que devolve a linha (a reentrega e a varredura), com painel, lista fechada e teste (`corte-da-espera.int.test.ts` › a execução interrompida conta por escola e origem).

Da rodada 1 da Mesa (`.processo/ordens/7_task-r1.md`):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian 1ª | `execucao.repository.ts` `cortarEspera` e `marcarRodando`: incluir `anoLetivoId` no `update` | `TODO.md`: muda a cláusula do repository e o contexto do job precisa trazer o ano; hoje não vaza (leitura escopada antes, id UUID) |
| privacy-guardian 1ª | `execucao.repository.ts` `cortarEspera`: variante para o `GET` com `solicitadaPor` e `anoLetivoId` no `where` | `TODO.md`: muda contrato do repository; o único chamador lê antes |
| infra-guardian 1ª | `execucoes.service.ts`: trazer a idade na primeira leitura e só tentar o corte depois de 20 s (tira duas idas ao banco por consulta) | `TODO.md`: muda o comportamento do `GET` e pede o teste de corrida de novo |
| infra-guardian 1ª | Alerta `soma - soma offset 10m` não trata contador que volta a zero (usar `increase` ou `resets()`) | `TODO.md`: muda a regra de alerta, e o runbook já registra a lacuna; avaliar antes do piloto |
| infra-guardian 1ª | `infra/k6/justica-entre-escolas.js:282`: contar o corte da espera num contador próprio na `FASE=sala` | tarefa 11.0 (a que toca esse arquivo) |
| revisor-geral 1ª | `execucoes.service.ts`: `this.comandos.de(tarefa)` lança em tarefa sem comando no `GET` | `TODO.md`: muda comportamento; nenhuma execução dessa tarefa é criada hoje |
| revisor-geral 1ª | Extrair a soma da métrica, o log e o `tipo`/`codigo` duplicados entre o processador e o `ExecucoesService` | `TODO.md`: refatoração que toca dois arquivos de produção e caduca todos os revisores |
| frontend-reviewer 1ª | `docs/interface.md`: citar o `min-h-11` ao lado do "44 px" | recusada: o `Button` padrão e o e2e já provam os 44 px |
| frontend-reviewer 1ª | `7_task.md`: a tabela "Arquivos previstos" lista `Tutor.tsx`, que não mudou | recusada: a divergência "`Tutor.tsx` não muda" já está em "Divergências resolvidas nesta tarefa" |
| frontend-reviewer 1ª | Fotografar o estado cortado em 360 px se a vitrine ganhar uma execução cortada | Validador, no fim da spec (a vitrine não alcança o estado hoje) |
| test-engineer 1ª | Alerta provado por comportamento, com séries sintéticas (uma escola com 3, duas com 3, uma com 2, a série que nasce) | `TODO.md`: caso novo de `infra/test/alertas.int.test.ts`, maior que o ciclo de correção |
| test-engineer 1ª | Lado da corrida em que o processador ganha o `pendente → rodando` e o `GET` recebe zero linhas, sem caso forçado | recusada: a cláusula `estado = 'pendente'` que o protege já tem bloco e caso |

Da rodada 2 da Mesa (`.processo/ordens/7_task-r2.md`):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| conformidade-reviewer 2ª | `docs/aia/tutor.md`: a lista ficou 13, 15, 14 (renumerar ou mover o item 15) | `TODO.md`: texto de documento sem efeito no comportamento; a próxima tarefa que toca a AIA (9.0) renumera |
| conformidade-reviewer 2ª | `docs/aia/tutor.md:410`: "leitura por palavras do item 10" é ambíguo (dois itens 10) | `TODO.md`, junto com a anterior (9.0) |
| conformidade-reviewer 2ª | Na 9.0, conferir que a contagem do professor inclui `falhou IA_INDISPONIVEL` sem o texto da pergunta e sem virar indicador por aluno | tarefa 9.0 |
| tenancy-guardian 2ª | `anoLetivoId` no `where` de `cortarEspera` e `marcarRodando`, antes de outra tarefa usar esses métodos | já em `TODO.md` (1ª rodada) |
| infra-guardian 2ª | Fechar antes do piloto ao menos a idade na primeira leitura do `GET`; as outras duas seguem em `TODO.md` e na 11.0 | já em `TODO.md` (1ª rodada) |
| infra-guardian 2ª | Caso à parte que prove que o tempo em que o Redis ficou fora conta na idade | `TODO.md`: caso novo de integração, maior que o ciclo de correção |
| test-engineer 2ª | Caso do Redis: o `GET` com o Redis fora ainda depende de o `stop` e os três `GET` levarem menos de 15 s (recuar `criada_em` da `aos15` logo depois do `stop`) | `TODO.md`: no pior caso a idade fica em cerca de 16 s e o caso falha de forma visível, sem passar em falso |
| test-engineer 2ª | Item 15 da AIA: citar o caso "processador corta" (zero chamadas ao modelo) como a prova de que a leitura do modelo não roda | `TODO.md`, junto com a renumeração da AIA (9.0) |
| revisor-geral 2ª | `techspec.md:128`: o item (2) tem uma frase longa com três ideias | recusada: só texto, sem efeito no contrato |
| revisor-geral 2ª | `e2e/aluno-tutor.spec.ts:284`: a docstring de `criarColega` explica o custo, e bastaria dizer o que a função faz | recusada: só comentário |
| revisor-geral 2ª | A seção "Revisões" sumiu numa edição do documento | Orquestrador: o hook a recriou na rodada 2 (a linha 1 da seção está perdida; o histórico real está em `achados/7_task.md`) |
| frontend-reviewer 2ª | Fotografar o estado cortado com "Tentar de novo" e o 188 acima, a 360 px | Validador, no fim da spec (a vitrine não alcança o estado) |
| privacy-guardian 2ª | Na 9.0, manter o que a AIA promete: contagem sem o texto da pergunta | tarefa 9.0 |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-16 07:32:22 | 2026-11-16 07:32:55 | `conformidade-reviewer` | 2 | APROVADO | ae8d3aaf9aef79698 |
| 2026-11-16 07:32:47 | 2026-11-16 07:33:08 | `tenancy-guardian` | 2 | APROVADO | a470e49d4294e0a36 |
| 2026-11-16 07:32:54 | 2026-11-16 07:33:17 | `privacy-guardian` | 2 | APROVADO | a54bb5b256a5bd090 |
| 2026-11-16 07:32:40 | 2026-11-16 07:33:19 | `revisor-geral` | 2 | APROVADO | acb81704c24b0b8a8 |
| 2026-11-16 07:33:12 | 2026-11-16 07:33:30 | `frontend-reviewer` | 2 | APROVADO | aa4370bd8289a1e9d |
| 2026-11-16 07:33:01 | 2026-11-16 07:33:32 | `infra-guardian` | 2 | APROVADO | ab9b236966d8b4a94 |
| 2026-11-16 07:32:32 | 2026-11-16 07:34:03 | `test-engineer` | 2 | APROVADO | afbf729a7f8b1459d |
