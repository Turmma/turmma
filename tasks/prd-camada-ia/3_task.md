# Tarefa 3.0 — A Operação define o orçamento de IA da escola e da rede, com auditoria

**Funcionalidade:** camada-ia · **Depende de:** 2.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`
**Porte:** grande

## Objetivo

O operador grava o valor por aluno e o teto de segurança de uma escola ou de uma rede; cada mudança efetiva vai à auditoria.

## Contexto necessário

- `techspec.md` §4 (as duas linhas `PUT` e as `GET` estendidas), §5 ("O `PUT`"), §6, §7 (auditoria), §7c ("Corridas")
- `prd.md` RF7, §8
- `cenarios.md` §1 RF7 (todas), §2 ("`PUT` da escola", "`PUT` da rede", "Operação", "Exceções declaradas"), §3 (as quatro primeiras)

- Código: `apps/api/src/operacao/painel/painel.service.ts` (`naEscola`, `runInContext`), `painel.controller.ts`,
  `apps/api/src/operacao/escola/escola.repository.ts` (o `@Unscoped` da rede), `packages/core/src/auditoria/acoes.ts`,
  `packages/shared/src/operacao/painel.ts`, `apps/api/test/registered-routes.ts` (`ROTAS_DO_PAINEL`)

## Subtarefas

- [x] 3.1 — `PUT /v1/operacao/escolas/:id/orcamento-ia`, no contexto da escola `:id`; `PUT /v1/operacao/redes/:id/orcamento-ia`
  pelo `OrcamentoDaRedeRepository`, com um único `@Unscoped` ("acima do tenant"); entrada em centavos, saída em micros
- [x] 3.2 — Uma transação: `insert … on conflict do nothing`, `select … for update`, `antes`, gravação, auditoria só se `antes ≠ depois`
- [x] 3.3 — `escola.orcamento_ia_alterado` e `rede.orcamento_ia_alterado` em `acoes.ts`, fora da leitura da coordenação
- [x] 3.4 — `redes()` e `escolas()` do `PainelRepository` com o orçamento próprio e o vigente; `escolasQueUsamOValorDaRede` conta valor ou teto vindo da rede
- [x] 3.5 — As rotas em `ROTAS_DO_PAINEL`
- [x] 3.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/src/operacao/painel/painel.controller.ts`, `apps/api/src/operacao/painel/painel.service.ts`, `apps/api/src/operacao/painel/painel.repository.ts` | alterado |
| `apps/api/src/operacao/painel/orcamento-da-rede.repository.ts` | novo |
| `packages/shared/src/operacao/painel.ts`, `packages/shared/src/operacao/painel.test.ts` | alterado |
| `packages/core/src/auditoria/acoes.ts` | alterado |
| `apps/api/test/painel-escrita.int.test.ts`, `apps/api/test/painel-leitura.int.test.ts`, `apps/api/test/registered-routes.ts`, `apps/api/test/architecture.test.ts` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| `PUT` da escola: auditoria com `antes`, `depois` e o operador | I | RF7 | `painel-escrita.int.test.ts` › a primeira gravação cria a linha da escola sem ano em curso, devolve o próprio e o vigente, e audita o antes e o depois com o apelido da sessão |
| o mesmo `PUT` de novo: nenhuma auditoria nova (escola e rede) | I | só se mudou | `painel-escrita.int.test.ts` › o mesmo PUT de novo não grava nem audita; mudar só o teto, só o valor, ou voltar a nulo, audita cada um (escola); › rede.orcamento_ia_alterado com escola nula, o antes, o depois e o operador; o mesmo PUT de novo não audita (rede) |
| `PUT` da rede: auditoria com `escola_id` nulo | I | a ação da rede | `painel-escrita.int.test.ts` › rede.orcamento_ia_alterado com escola nula, o antes, o depois e o operador; o mesmo PUT de novo não audita; e `acoes.test.ts` › rede.orcamento_ia_alterado leva só o valor em micros e o teto em % |
| contagem: valor próprio e teto da rede conta; teto próprio e valor da rede conta; os dois próprios não; escola da rede 2 não conta na 1 | I | `escolasQueUsamOValorDaRede` | `painel-leitura.int.test.ts` › GET /escolas e /redes: o próprio e o vigente de cada escola, a escola sobre a rede coluna a coluna, e a contagem só das escolas da rede que usam o valor ou o teto dela; › a rede que só define o teto conta a escola sem teto próprio, e a que só define o valor conta a escola sem valor próprio; escola com os dois próprios não conta em nenhuma |
| `GET /redes` e `/escolas`: o orçamento próprio e o vigente | I | RF11 | `painel-leitura.int.test.ts` › GET /escolas e /redes: o próprio e o vigente de cada escola…; › GET /redes: as redes vêm por nome, a mais nova do teste primeiro, e não pela ordem em que nasceram; `painel-escrita.int.test.ts` › GET /v1/operacao/redes: a rede criada, só com id, nome, tipo, o orçamento e a contagem, e nunca mais que 200 |
| 0, R$ 100,01, 99, 1001 recusam; R$ 0,01, R$ 100,00, 100, 1000 passam; nulo volta à rede | I, U | os limites | `painel-escrita.int.test.ts` › 0, R$ 100,01, 99 e 1001, e o que não é o contrato, são ENTRADA_INVALIDA, sem gravar nem auditar; R$ 0,01, R$ 100,00, 100 e 1000 passam; `painel.test.ts` (shared) › os limites do valor…; › os limites do teto…; › nulo volta à rede, em cada campo ou nos dois… |
| 500 centavos: 5.000.000 micros | U | o fator | `painel.test.ts` (shared) › 500 centavos são 5.000.000 micros: o fator é de 10.000 micros por centavo |
| escola sem ano `em_curso`: grava, audita e devolve o vigente | I | o contexto sem ano | `painel-escrita.int.test.ts` › a primeira gravação cria a linha da escola sem ano em curso… (a escola vem de `redeEEscola`, sem ano letivo) |
| id de escola e de rede inexistente: `NAO_ENCONTRADO`, com o corpo da rota inexistente | I | regra 10.6 | `painel-escrita.int.test.ts` › escola e rede inexistentes, e id que não é UUID, são NAO_ENCONTRADO com o corpo da rota inexistente, sem linha nem auditoria |
| 429 no `PUT` | I | o limitador | `painel-escrita.int.test.ts` › acima do rl:op do operador, 429 LIMITE_EXCEDIDO com Retry-After, e o orçamento não muda |
| corrida, a escola sem linha: dois `PUT` de valores diferentes, o primeiro segurado; vale o segundo, duas auditorias, o `antes` da segunda é o `depois` da primeira, nenhum 500 | I | `for update` e `on conflict` | `painel-escrita.int.test.ts` › escola sem linha, valores diferentes: vale o segundo, duas auditorias, o antes da segunda é o depois da primeira, e nenhum 500; › escola com a linha já gravada, valores diferentes: o segundo espera o for update e lê como antes o que o primeiro gravou |
| corrida: dois `PUT` da escola com o mesmo valor, uma auditoria | I | `antes` na trava | `painel-escrita.int.test.ts` › escola, o mesmo valor nos dois: uma auditoria só, porque o segundo vê o antes igual ao depois; › escola com a linha já gravada, o mesmo valor nos dois: o segundo espera o for update, vê o antes igual ao depois e não audita |
| corrida: o mesmo para a rede, valores diferentes e iguais | I | a trava da rede | `painel-escrita.int.test.ts` › rede, valores diferentes: vale o segundo, duas auditorias, o antes da segunda é o depois da primeira; › rede, o mesmo valor nos dois: uma auditoria só |
| isolamento: o `PUT` em A não muda B; na rede 1, não muda a rede 2 | I | o `where` | `painel-escrita.int.test.ts` › o PUT em A não muda a configuração de B, e o da rede 1 não muda a rede 2 nem o que vale para a escola B |
| coordenação, professor e aluno nas rotas novas: 404 com o corpo do inexistente | I | `ROTAS_DO_PAINEL` | `painel-escrita.int.test.ts` › com a sessão da própria escola, o PUT responde como a rota inexistente, e nenhuma leitura da governança devolve a auditoria do orçamento; e `operacao-isolamento.int.test.ts` › sessão de coordenador, professor e aluno, desafio, cookie de escola e nenhuma credencial: toda rota @RotaDeOperacao responde igual a rota inexistente (percorre as duas rotas novas, que entraram em `ROTAS_DO_PAINEL`) |
| `OrcamentoDaRedeRepository` com exatamente um `@Unscoped` | arquitetura | a exceção | `architecture.test.ts` › arquitetura: o OrcamentoDaRedeRepository tem uma exceção só, acima do tenant › o único método é `definir`, @Unscoped com a justificativa que cita o tenant |
| a coordenação não lê `escola.orcamento_ia_alterado` | I | RF12 | `painel-escrita.int.test.ts` › com a sessão da própria escola, o PUT responde como a rota inexistente, e nenhuma leitura da governança devolve a auditoria do orçamento (a leitura que existe é a da governança, e o caso confere que nenhuma devolve a ação nem o operador; não há rota que liste a auditoria da escola) |

## Como testar

- Corrida: `apps/api/test/painel-escrita.int.test.ts` › "POST /redes: o segundo espera o primeiro no índice do id…";
  `WriteBlockTrigger` e `esperarNaTrava` (`apps/api/test/write-block-trigger.ts`)
- Inexistente: `painel-escrita.int.test.ts` › "E5: rede inexistente é NAO_ENCONTRADO, sem escola nem auditoria"
- Varredura de 404: `apps/api/test/operacao-isolamento.int.test.ts` › "sessão de coordenador, professor e aluno… toda rota
  @RotaDeOperacao responde igual a rota inexistente"
- Exceção declarada: `apps/api/test/architecture.test.ts` (o I1)
- Fixture: `apps/api/test/painel.fixture.ts`
- `npx vitest run --project integracao apps/api/test/painel-escrita.int.test.ts`

## Fora do escopo desta tarefa

O diálogo (7.0); a leitura do uso (5.0).

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano antes de codar e conferidas no fim.

1. **Mutações:** a seção "Mutações" tem um bloco por cláusula do diff: o `where` do `select … for update` e o do `update` da rede, o `if (linha === undefined)` e o `if (mesmoOrcamentoDefinido…)` do repository da rede, cada termo do `&&` de `mesmoOrcamentoDefinido`, o `insert … on conflict do nothing`, o `for('update')` e o `where` da escola, cada ramo do serviço (`mudou`, o `if` da gravação, da auditoria e dos dois logs, o `23503`, o `?? erro`, o autor conferido, o `runInContext` com a escola), o ternário do centavo para micros, cada linha do SQL de `redes()` (o valor, o teto, o `count`, o `join`, o `where e.rede_id`, cada termo do `or`, o `order by`, o `limit`) e de `escolas()` (as quatro colunas e o `join`), as quatro constantes de limite e o fator, os `.nullable()` do contrato e a fiação do controller (`@OperacaoRoute`, `no-store`, `IdPipe`, o `ZodValidationPipe`). O `--faltando` está em 0 linhas; o único motivo é o `?? randomUUID()` do id de requisição, que nenhum teste distingue.
2. **Texto na tela:** não se aplica, a tarefa não tem tela (o diálogo é da 7.0); a web só ganhou o tipo e os mocks que o contrato novo exige.
3. **Segundo dado:** três redes com valor e teto diferentes; escolas com valor próprio e sem teto, com teto e sem valor, com os dois, e sem linha de configuração; uma escola da rede 2 que usa o valor da rede 2; as duas contagens conferidas. Na escrita, duas redes e duas escolas com configurações diferentes (o `PUT` de A não muda B), e a rede com teto e sem valor ao lado da rede com valor e sem teto, cada uma com a escola que a tira da contagem.
4. **Checagem anterior que responde antes:** o `PUT` da escola cai em `OperacaoRoute` (`OperadorGuard`), no `IdPipe` e no `ZodValidationPipe` antes do serviço; os casos de regra usam sessão de operador com corpo válido, e o de id inexistente chega até a chave estrangeira (escola) e ao `select` vazio (rede), sem pular o caminho. A escola do cenário vem de `redeEEscola`, sem ano `em_curso`.
5. **Asserção no resultado:** os casos comparam o corpo devolvido, a linha de `configuracao_operacional_escola` ou de `rede` lida do banco, as linhas de `auditoria` (ação, `escola_id`, autor, `antes`, `depois`) e os eventos do log; nenhum olha texto de arquivo. A asserção de "não audita" vem depois de o primeiro `PUT` ter auditado (o estado final difere do inicial).
6. **Guarda nova:** o `architecture.test.ts` conta o `OrcamentoDaRedeRepository` entre as classes cercadas (só o `painel.service.ts` o usa), confere que o único método é `definir` e que há exatamente um `@Unscoped`, e a lista exata de métodos do `OrcamentoDoMesRepository` ganhou os dois novos (método sem escopo reprova). Não há regra de lint nova.
7. **Comentários que afirmam o que o código não faz:** reli o docblock do controller, do serviço, dos dois repositories, das constantes e do contrato em `painel.ts` contra o código; as `docs/lgpd.md` (linha do orçamento de IA, tarefa 2.0) já dizem as duas ações de auditoria, o que a coordenação não lê e a retenção, e nenhuma frase nova foi acrescentada.
8. **Divergências:** as quatro abaixo; nenhuma muda regra, e a coluna "Onde está na spec" aponta o trecho que as sustenta (abri a §4, a §5 e a §6 da Tech Spec e a linha RF7 do `cenarios.md`).
9. **Peça que já existe:** `orcamentoVigente` (a conta da escola sobre a rede, coluna a coluna) é a do lote e da Governança, importada de `@educa/shared`, e não copiada; `OrcamentoDoMesRepository` já lia a configuração da escola e a da rede pelo contexto, e ganhou os dois métodos do `PUT` (o `for update` e a gravação), em vez de um repository novo da escola; `AuditoriaRecorder`, `autorDaSessao`, `naEscola`, `mapPostgresError` e `postgresErrorIn` são os do painel. O que não existia: `mesmoOrcamentoDefinido`, no `shared` ao lado de `orcamentoVigente`.
10. **Concorrência:** seis casos com a ordem forçada pelo `WriteBlockTrigger` e `esperarNaTrava`: escola sem linha (o `insert` do segundo bate no conflito e espera) e escola com a linha já gravada (o gatilho `before update` segura o primeiro dentro do `for update`), valores diferentes e iguais, e a rede, valores diferentes e iguais; o autor desativado no meio do `PUT` (E11) tem um caso por rota, e o 429 (E14) um caso com operador novo.
11. **Isolamento:** cada cláusula de escopo tem bloco e caso com A e B: o `where` da leitura travada e o da gravação da escola (a mutação que tira o da gravação deixa B mudado), e o `where` do `select` e o do `update` da rede (duas redes, cada uma com a sua escola); a tabela de testes tem o caso em cada linha.
12. **Guardiões:** `tenancy-guardian`: o escopo da escola vem do contexto (`requireEscolaId()`), a rede é o único `@Unscoped`, com o id do caminho, e o 404 é o mesmo para rede, escola e id que não é UUID; `privacy-guardian`: só dinheiro, percentual e id, nenhuma pessoa na resposta, na auditoria nem no log (o caso confere que o log não leva o valor), o operador é o autor e a coordenação não lê a ação. O `achados/indice.md` da camada-ia foi lido: a recusa de gravar a rede no `EscolaRepository` (tenancy, rodada 3) está em "Recomendações sem aplicar".

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| O `PUT` da escola grava pelo `OrcamentoDoMesRepository` (`packages/core/src/ia/orcamento-do-mes.repository.ts`, dois métodos novos: `lockConfiguracaoDaEscola` e `saveConfiguracaoDaEscola`), arquivo fora de "Arquivos previstos" | Nenhum repository do plano escreve em `configuracao_operacional_escola`, e a guarda `tabela-so-no-repository` não deixa o serviço tocar a tabela; o `OrcamentoDoMesRepository` já lê essa linha pelo contexto da escola, e o `PUT` roda justamente nele. Os nomes seguem o verbo de mercado (D81) | `techspec.md` §5 ("O `PUT`") e §6 ("Os meses e o `PUT` da escola rodam no contexto da escola `:id`"; `OrcamentoDoMesRepository` lê a configuração pela escola do contexto) |
| `mesmoOrcamentoDefinido` entra em `packages/shared/src/governanca/orcamento-de-ia.ts` (com teste), as constantes e os contratos do `PUT` em `shared/src/operacao/painel.ts`, e o `index.ts` os exporta; a escrita ganha também `painel.fixture.ts` (o verbo `PUT`) | A comparação "só audita se mudou" é a mesma da conta do orçamento e precisa estar ao lado de `orcamentoVigente`; o fixture de teste só aceitava `GET` e `POST` | `techspec.md` §5 ("audita só quando `antes ≠ depois`") e §4 (as duas linhas `PUT` e as `GET` estendidas) |
| O código de erro do corpo recusado é `ENTRADA_INVALIDA` (400), e não `VALIDACAO` | `VALIDACAO` não existe em `ErrorCode`; todo corpo estrito recusado do painel responde `ENTRADA_INVALIDA` (é o caso do `POST /redes` e do `POST /escolas`), e o contrato novo é um `z.strictObject` que passa pelo mesmo `ZodValidationPipe` | `cenarios.md` §1 RF7 ("Validação: valor 0, R$ 100,01, teto 99, teto 1001 → `VALIDACAO`"); `techspec.md` §4 (a entrada do `PUT`) |
| A web muda só de tipo e de mock: `NovaRede.tsx` (`aoCriar` recebe `Pick<RedeDoPainel, 'id' \| 'nome' \| 'tipo'>`), o fixture `render-operacao-screen.tsx` e o mock de `api/painel.test.ts` ganham o `orcamento` que o contrato da escola passou a trazer | A lista de redes e a de escolas agora devolvem o orçamento (`redeDoPainelSchema` e `escolaDoPainelSchema`), e o `typecheck` e o teste da página da lista reprovavam sem eles; a tela do diálogo continua sendo da 7.0 | `techspec.md` §4 (`GET /v1/operacao/redes` e `/escolas` estendidas) e §9 (o diálogo é da 7.0) |

## Mutações

`--faltando: 0 linhas (86 blocos, 1 motivos)`

```mutacao
arquivo: apps/api/src/operacao/painel/orcamento-da-rede.repository.ts
teste: apps/api/test/painel-escrita.int.test.ts › rede.orcamento_ia_alterado com escola nula
      .from(rede)
-      .where(eq(rede.id, redeId))
+      .where(eq(rede.nome, redeId))
      .for('update')
```

```mutacao
arquivo: apps/api/src/operacao/painel/orcamento-da-rede.repository.ts
teste: apps/api/test/painel-escrita.int.test.ts › rede, valores diferentes
      .where(eq(rede.id, redeId))
-      .for('update')
    if (linha === undefined) return undefined
```

```mutacao
arquivo: apps/api/src/operacao/painel/orcamento-da-rede.repository.ts
teste: apps/api/test/painel-escrita.int.test.ts › escola e rede inexistentes, e id que não é UUID
-    if (linha === undefined) return undefined
    const antes: OrcamentoDefinido = { valorPorAlunoMicros: linha.valorPorAlunoMicros, tetoPercentual: linha.tetoPercentual }
```

```mutacao
arquivo: apps/api/src/operacao/painel/orcamento-da-rede.repository.ts
teste: apps/api/test/painel-escrita.int.test.ts › rede.orcamento_ia_alterado com escola nula
    const antes: OrcamentoDefinido = { valorPorAlunoMicros: linha.valorPorAlunoMicros, tetoPercentual: linha.tetoPercentual }
-    if (mesmoOrcamentoDefinido(antes, depois)) return { antes, mudou: false }
    await this.banco.update(rede).set({ iaValorPorAlunoMicros: depois.valorPorAlunoMicros, iaTetoDeSegurancaPercentual: depois.tetoPercentual }).where(eq(rede.id, redeId))
```

```mutacao
arquivo: apps/api/src/operacao/painel/orcamento-da-rede.repository.ts
teste: apps/api/test/painel-escrita.int.test.ts › o PUT em A não muda a configuração de B
-    await this.banco.update(rede).set({ iaValorPorAlunoMicros: depois.valorPorAlunoMicros, iaTetoDeSegurancaPercentual: depois.tetoPercentual }).where(eq(rede.id, redeId))
+    await this.banco.update(rede).set({ iaValorPorAlunoMicros: depois.valorPorAlunoMicros, iaTetoDeSegurancaPercentual: depois.tetoPercentual }).where(eq(rede.id, rede.id))
    return { antes, mudou: true }
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.service.ts
teste: apps/api/test/painel-escrita.int.test.ts › o mesmo PUT de novo não grava nem audita
-  return { valorPorAlunoMicros: pedido.valorPorAlunoCentavos === null ? null : centavosParaMicros(pedido.valorPorAlunoCentavos), tetoPercentual: pedido.tetoDeSegurancaPercentual }
+  return { valorPorAlunoMicros: pedido.valorPorAlunoCentavos === null ? 0 : centavosParaMicros(pedido.valorPorAlunoCentavos), tetoPercentual: pedido.tetoDeSegurancaPercentual }
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.service.ts
teste: apps/api/test/painel-escrita.int.test.ts › a primeira gravação cria a linha da escola
-  return { valorPorAlunoMicros: pedido.valorPorAlunoCentavos === null ? null : centavosParaMicros(pedido.valorPorAlunoCentavos), tetoPercentual: pedido.tetoDeSegurancaPercentual }
+  return { valorPorAlunoMicros: pedido.valorPorAlunoCentavos === null ? null : pedido.valorPorAlunoCentavos, tetoPercentual: pedido.tetoDeSegurancaPercentual }
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.service.ts
teste: apps/api/test/painel-escrita.int.test.ts › a primeira gravação cria a linha da escola
-  return { valorPorAlunoMicros: pedido.valorPorAlunoCentavos === null ? null : centavosParaMicros(pedido.valorPorAlunoCentavos), tetoPercentual: pedido.tetoDeSegurancaPercentual }
+  return { valorPorAlunoMicros: pedido.valorPorAlunoCentavos === null ? null : centavosParaMicros(pedido.valorPorAlunoCentavos), tetoPercentual: null }
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.service.ts
teste: apps/api/test/painel-escrita.int.test.ts › a primeira gravação cria a linha da escola
-  return { valorPorAlunoMicros: definido.valorPorAlunoMicros, tetoDeSegurancaPercentual: definido.tetoPercentual }
+  return { valorPorAlunoMicros: definido.valorPorAlunoMicros, tetoDeSegurancaPercentual: null }
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.service.ts
teste: apps/api/test/painel-escrita.int.test.ts › a primeira gravação cria a linha da escola
-      const resultado = await runInContext({ requisicaoId, escolaId }, () =>
+      const resultado = await runInContext({ requisicaoId }, () =>
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.service.ts
teste: apps/api/test/painel-escrita.int.test.ts › escola: com o desativar segurando a linha do operador
-          const autorOperador = await autor(tx)
+          const autorOperador = 'sem-conferir'
          const orcamentos = new OrcamentoDoMesRepository(tx)
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.service.ts
teste: apps/api/test/painel-escrita.int.test.ts › a primeira gravação cria a linha da escola
-          const antes = await orcamentos.lockConfiguracaoDaEscola()
+          const antes = { valorPorAlunoMicros: null, tetoPercentual: null }
          const mudou = !mesmoOrcamentoDefinido(antes, depois)
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.service.ts
teste: apps/api/test/painel-escrita.int.test.ts › o mesmo PUT de novo não grava nem audita
falha: expect(await auditorias()).toHaveLength(1)
          const antes = await orcamentos.lockConfiguracaoDaEscola()
-          const mudou = !mesmoOrcamentoDefinido(antes, depois)
+          const mudou = true
          if (mudou) {
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.service.ts
teste: apps/api/test/painel-escrita.int.test.ts › o mesmo PUT de novo não grava nem audita
falha: expect(await auditorias()).toHaveLength(1)
          const mudou = !mesmoOrcamentoDefinido(antes, depois)
-          if (mudou) {
+          {
            await orcamentos.saveConfiguracaoDaEscola(depois)
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.service.ts
teste: apps/api/test/painel-escrita.int.test.ts › a primeira gravação cria a linha da escola
          if (mudou) {
-            await orcamentos.saveConfiguracaoDaEscola(depois)
            await registro.save(tx, 'escola.orcamento_ia_alterado', { entidadeId: escolaId, antes: auditado(antes), depois: auditado(depois), autorOperador })
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.service.ts
teste: apps/api/test/painel-escrita.int.test.ts › a primeira gravação cria a linha da escola
            await orcamentos.saveConfiguracaoDaEscola(depois)
-            await registro.save(tx, 'escola.orcamento_ia_alterado', { entidadeId: escolaId, antes: auditado(antes), depois: auditado(depois), autorOperador })
          }
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.service.ts
teste: apps/api/test/painel-escrita.int.test.ts › o valor da escola vale sobre o da rede
-          return { mudou, rede: await orcamentos.configuracaoDaRede() }
+          return { mudou, rede: { valorPorAlunoMicros: null, tetoPercentual: null } }
        }),
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.service.ts
teste: apps/api/test/painel-escrita.int.test.ts › o mesmo PUT de novo não grava nem audita
falha: linhasComEvento('operacao.escola.orcamento_ia_alterado')).toHaveLength(4)
-      if (resultado.mudou) naEscola(escolaId, () => this.#logger.log('operacao.escola.orcamento_ia_alterado'))
+      naEscola(escolaId, () => this.#logger.log('operacao.escola.orcamento_ia_alterado'))
      return orcamentoDeIaDoPainelSchema.parse(orcamentoDaEscolaNoPainel(depois, resultado.rede))
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.service.ts
teste: apps/api/test/painel-escrita.int.test.ts › a primeira gravação cria a linha da escola
-      if (resultado.mudou) naEscola(escolaId, () => this.#logger.log('operacao.escola.orcamento_ia_alterado'))
+      if (resultado.mudou) this.#logger.log('operacao.escola.orcamento_ia_alterado')
      return orcamentoDeIaDoPainelSchema.parse(orcamentoDaEscolaNoPainel(depois, resultado.rede))
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.service.ts
teste: apps/api/test/painel-escrita.int.test.ts › o valor da escola vale sobre o da rede
-      return orcamentoDeIaDoPainelSchema.parse(orcamentoDaEscolaNoPainel(depois, resultado.rede))
+      return orcamentoDeIaDoPainelSchema.parse(orcamentoDaEscolaNoPainel(resultado.rede, resultado.rede))
    } catch (erro) {
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.service.ts
teste: apps/api/test/painel-escrita.int.test.ts › escola e rede inexistentes, e id que não é UUID
      // foreign_key_violation: a escola do caminho não existe.
-      if (postgresErrorIn(erro)?.code === '23503') throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      throw mapPostgresError(erro) ?? erro
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.service.ts
teste: apps/api/test/painel-escrita.int.test.ts › escola: com o desativar segurando a linha do operador
      if (postgresErrorIn(erro)?.code === '23503') throw new DomainException(ErrorCode.NAO_ENCONTRADO)
-      throw mapPostgresError(erro) ?? erro
+      throw mapPostgresError(erro)
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.service.ts
teste: apps/api/test/painel-escrita.int.test.ts › rede: o mesmo, sem gravar o orçamento nem auditar
-        const autorOperador = await autor(tx)
+        const autorOperador = 'sem-conferir'
        const definida = await new OrcamentoDaRedeRepository(tx).definir(redeId, depois)
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.service.ts
teste: apps/api/test/painel-escrita.int.test.ts › escola e rede inexistentes, e id que não é UUID
        const definida = await new OrcamentoDaRedeRepository(tx).definir(redeId, depois)
-        if (definida === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
        if (definida.mudou) await registro.save(tx, 'rede.orcamento_ia_alterado', { entidadeId: redeId, antes: auditado(definida.antes), depois: auditado(depois), autorOperador })
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.service.ts
teste: apps/api/test/painel-escrita.int.test.ts › rede.orcamento_ia_alterado com escola nula
-        if (definida.mudou) await registro.save(tx, 'rede.orcamento_ia_alterado', { entidadeId: redeId, antes: auditado(definida.antes), depois: auditado(depois), autorOperador })
+        await registro.save(tx, 'rede.orcamento_ia_alterado', { entidadeId: redeId, antes: auditado(definida.antes), depois: auditado(depois), autorOperador })
        return definida
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.service.ts
teste: apps/api/test/painel-escrita.int.test.ts › rede.orcamento_ia_alterado com escola nula
falha: linhasComEvento('operacao.rede.orcamento_ia_alterado')).toHaveLength(1)
-    if (definida.mudou) this.#logger.log('operacao.rede.orcamento_ia_alterado')
+    this.#logger.log('operacao.rede.orcamento_ia_alterado')
    return orcamentoDeIaDoPainelSchema.parse(orcamentoDaRedeNoPainel(depois))
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.service.ts
teste: apps/api/test/painel-escrita.int.test.ts › rede.orcamento_ia_alterado com escola nula
    if (definida.mudou) this.#logger.log('operacao.rede.orcamento_ia_alterado')
-    return orcamentoDeIaDoPainelSchema.parse(orcamentoDaRedeNoPainel(depois))
+    return orcamentoDeIaDoPainelSchema.parse(orcamentoDaRedeNoPainel({ valorPorAlunoMicros: null, tetoPercentual: null }))
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.service.ts
teste: apps/api/test/painel-leitura.int.test.ts › GET /escolas e /redes: o próprio e o vigente de cada escola
-    return redesDoPainelResponseSchema.parse({ itens: lidas.map(({ orcamento, ...rede }) => ({ ...rede, orcamento: orcamentoDaRedeNoPainel(orcamento) })) })
+    return redesDoPainelResponseSchema.parse({ itens: lidas.map(({ orcamento, ...rede }) => ({ ...rede, orcamento: orcamentoDaRedeNoPainel({ valorPorAlunoMicros: null, tetoPercentual: null }) })) })
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.service.ts
teste: apps/api/test/painel-leitura.int.test.ts › GET /escolas e /redes: o próprio e o vigente de cada escola
-        orcamento: orcamentoDaEscolaNoPainel(orcamento.escola, orcamento.rede),
+        orcamento: orcamentoDaEscolaNoPainel(orcamento.rede, orcamento.rede),
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: apps/api/test/painel-escrita.int.test.ts › o mesmo PUT de novo não grava nem audita
falha: expect(await auditorias()).toHaveLength(1)
-      .where(eq(configuracaoOperacionalEscola.escolaId, escolaId))
+      .where(eq(configuracaoOperacionalEscola.escolaId, '00000000-0000-0000-0000-000000000000'))
      .for('update')
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: apps/api/test/painel-escrita.int.test.ts › escola com a linha já gravada, valores diferentes
      .where(eq(configuracaoOperacionalEscola.escolaId, escolaId))
-      .for('update')
    return { valorPorAlunoMicros: linha?.valorPorAlunoMicros ?? null, tetoPercentual: linha?.tetoPercentual ?? null }
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: apps/api/test/painel-escrita.int.test.ts › o mesmo PUT de novo não grava nem audita
-    await this.banco.insert(configuracaoOperacionalEscola).values({ escolaId }).onConflictDoNothing()
+    await this.banco.insert(configuracaoOperacionalEscola).values({ escolaId })
    const [linha] = await this.banco
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: apps/api/test/painel-escrita.int.test.ts › o PUT em A não muda a configuração de B
      .set({ iaValorPorAlunoMicros: depois.valorPorAlunoMicros, iaTetoDeSegurancaPercentual: depois.tetoPercentual })
-      .where(eq(configuracaoOperacionalEscola.escolaId, requireEscolaId()))
+      .where(eq(configuracaoOperacionalEscola.escolaId, configuracaoOperacionalEscola.escolaId))
  }
```

```mutacao
arquivo: packages/core/src/auditoria/acoes.ts
teste: packages/core/src/auditoria/acoes.test.ts › escola.orcamento_ia_alterado leva só o valor em micros
-  valorPorAlunoMicros: z.number().int().positive().nullable(),
+  valorPorAlunoMicros: z.number().int().nullable(),
  tetoDeSegurancaPercentual: z.number().int().min(100).max(1000).nullable(),
```

```mutacao
arquivo: packages/core/src/auditoria/acoes.ts
teste: packages/core/src/auditoria/acoes.test.ts › escola.orcamento_ia_alterado leva só o valor em micros
  valorPorAlunoMicros: z.number().int().positive().nullable(),
-  tetoDeSegurancaPercentual: z.number().int().min(100).max(1000).nullable(),
+  tetoDeSegurancaPercentual: z.number().int().min(100).nullable(),
```

```mutacao
arquivo: packages/core/src/auditoria/acoes.ts
teste: packages/core/src/auditoria/acoes.test.ts › rede.orcamento_ia_alterado leva só o valor em micros
  valorPorAlunoMicros: z.number().int().positive().nullable(),
-  tetoDeSegurancaPercentual: z.number().int().min(100).max(1000).nullable(),
+  tetoDeSegurancaPercentual: z.number().int().max(1000).nullable(),
```

```mutacao
arquivo: packages/core/src/auditoria/acoes.ts
teste: packages/core/src/auditoria/acoes.test.ts › rede.orcamento_ia_alterado leva só o valor em micros
  'rede.orcamento_ia_alterado': {
-    entidade: 'rede',
+    entidade: 'escola',
    antes: orcamentoDeIaAuditado,
```

```mutacao
arquivo: packages/shared/src/governanca/orcamento-de-ia.ts
teste: packages/shared/src/governanca/orcamento-de-ia.test.ts › mudar só o valor, ou só o teto, ou passar de nulo
 export function mesmoOrcamentoDefinido(a: OrcamentoDefinido, b: OrcamentoDefinido): boolean {
-  return a.valorPorAlunoMicros === b.valorPorAlunoMicros && a.tetoPercentual === b.tetoPercentual
+  return a.tetoPercentual === b.tetoPercentual
 }
```

```mutacao
arquivo: packages/shared/src/governanca/orcamento-de-ia.ts
teste: packages/shared/src/governanca/orcamento-de-ia.test.ts › mudar só o valor, ou só o teto, ou passar de nulo
 export function mesmoOrcamentoDefinido(a: OrcamentoDefinido, b: OrcamentoDefinido): boolean {
-  return a.valorPorAlunoMicros === b.valorPorAlunoMicros && a.tetoPercentual === b.tetoPercentual
+  return a.valorPorAlunoMicros === b.valorPorAlunoMicros
 }
```

```mutacao
arquivo: packages/shared/src/operacao/painel.ts
teste: packages/shared/src/operacao/painel.test.ts › 500 centavos são 5.000.000 micros
-export const MICROS_POR_CENTAVO = 10_000
+export const MICROS_POR_CENTAVO = 1_000
```

```mutacao
arquivo: packages/shared/src/operacao/painel.ts
teste: packages/shared/src/operacao/painel.test.ts › os limites do valor
-export const VALOR_MINIMO_DE_IA_POR_ALUNO_CENTAVOS = 1
+export const VALOR_MINIMO_DE_IA_POR_ALUNO_CENTAVOS = 0
 export const VALOR_MAXIMO_DE_IA_POR_ALUNO_CENTAVOS = 10_000
```

```mutacao
arquivo: packages/shared/src/operacao/painel.ts
teste: packages/shared/src/operacao/painel.test.ts › os limites do valor
 export const VALOR_MINIMO_DE_IA_POR_ALUNO_CENTAVOS = 1
-export const VALOR_MAXIMO_DE_IA_POR_ALUNO_CENTAVOS = 10_000
+export const VALOR_MAXIMO_DE_IA_POR_ALUNO_CENTAVOS = 10_001
```

```mutacao
arquivo: packages/shared/src/operacao/painel.ts
teste: packages/shared/src/operacao/painel.test.ts › os limites do teto
-export const TETO_MINIMO_DE_SEGURANCA_PERCENTUAL = 100
+export const TETO_MINIMO_DE_SEGURANCA_PERCENTUAL = 99
 export const TETO_MAXIMO_DE_SEGURANCA_PERCENTUAL = 1000
```

```mutacao
arquivo: packages/shared/src/operacao/painel.ts
teste: packages/shared/src/operacao/painel.test.ts › os limites do teto
 export const TETO_MINIMO_DE_SEGURANCA_PERCENTUAL = 100
-export const TETO_MAXIMO_DE_SEGURANCA_PERCENTUAL = 1000
+export const TETO_MAXIMO_DE_SEGURANCA_PERCENTUAL = 1001
```

```mutacao
arquivo: packages/shared/src/operacao/painel.ts
teste: packages/shared/src/operacao/painel.test.ts › nulo volta à rede
-  valorPorAlunoCentavos: z.number().int().min(VALOR_MINIMO_DE_IA_POR_ALUNO_CENTAVOS).max(VALOR_MAXIMO_DE_IA_POR_ALUNO_CENTAVOS).nullable(),
+  valorPorAlunoCentavos: z.number().int().min(VALOR_MINIMO_DE_IA_POR_ALUNO_CENTAVOS).max(VALOR_MAXIMO_DE_IA_POR_ALUNO_CENTAVOS),
```

```mutacao
arquivo: packages/shared/src/operacao/painel.ts
teste: packages/shared/src/operacao/painel.test.ts › nulo volta à rede
  valorPorAlunoCentavos: z.number().int().min(VALOR_MINIMO_DE_IA_POR_ALUNO_CENTAVOS).max(VALOR_MAXIMO_DE_IA_POR_ALUNO_CENTAVOS).nullable(),
-  tetoDeSegurancaPercentual: z.number().int().min(TETO_MINIMO_DE_SEGURANCA_PERCENTUAL).max(TETO_MAXIMO_DE_SEGURANCA_PERCENTUAL).nullable(),
+  tetoDeSegurancaPercentual: z.number().int().min(TETO_MINIMO_DE_SEGURANCA_PERCENTUAL).max(TETO_MAXIMO_DE_SEGURANCA_PERCENTUAL),
```

```mutacao
arquivo: packages/shared/src/operacao/painel.ts
teste: packages/shared/src/operacao/painel.test.ts › nulo volta à rede
 export const orcamentoDeIaRequestSchema = z.strictObject({
-  valorPorAlunoCentavos: z.number().int().min(VALOR_MINIMO_DE_IA_POR_ALUNO_CENTAVOS).max(VALOR_MAXIMO_DE_IA_POR_ALUNO_CENTAVOS).nullable(),
+  valorPorAlunoCentavos: z.number().int().min(VALOR_MINIMO_DE_IA_POR_ALUNO_CENTAVOS).max(VALOR_MAXIMO_DE_IA_POR_ALUNO_CENTAVOS).nullable().optional(),
```

```mutacao
arquivo: packages/shared/src/operacao/painel.ts
teste: packages/shared/src/operacao/painel.test.ts › a resposta é estrita
 export const orcamentoProprioDoPainelSchema = z.strictObject({
-  valorPorAlunoMicros: z.number().int().positive().nullable(),
+  valorPorAlunoMicros: z.number().int().nullable(),
```

```mutacao
arquivo: packages/shared/src/operacao/painel.ts
teste: packages/shared/src/operacao/painel.test.ts › a resposta é estrita
-  tetoDeSegurancaPercentual: z.number().int().min(TETO_MINIMO_DE_SEGURANCA_PERCENTUAL).max(TETO_MAXIMO_DE_SEGURANCA_PERCENTUAL),
+  tetoDeSegurancaPercentual: z.number().int().max(TETO_MAXIMO_DE_SEGURANCA_PERCENTUAL),
  origemDoTeto: z.enum(['escola', 'rede', 'padrao']),
```

```mutacao
arquivo: packages/shared/src/operacao/painel.ts
teste: packages/shared/src/operacao/painel.test.ts › a escola sem valor e a rede com R
-  return orcamentoDoPainel(escola, orcamentoVigente(escola, rede))
+  return orcamentoDoPainel(escola, orcamentoVigente(rede, escola))
 }
```

```mutacao
arquivo: packages/shared/src/operacao/painel.ts
teste: packages/shared/src/operacao/painel.test.ts › a escola sem valor e a rede com R
-  return orcamentoDoPainel(rede, orcamentoVigente(SEM_ORCAMENTO_DEFINIDO, rede))
+  return orcamentoDoPainel(rede, orcamentoVigente(rede, SEM_ORCAMENTO_DEFINIDO))
 }
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.service.ts
teste: apps/api/test/painel-escrita.int.test.ts › a primeira gravação cria a linha da escola
-    const depois = definidoPeloPedido(pedido)
+    const depois = { valorPorAlunoMicros: null, tetoPercentual: null }
     const requisicaoId = currentContext()?.requisicaoId ?? randomUUID()
     try {
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.service.ts
teste: apps/api/test/painel-escrita.int.test.ts › rede.orcamento_ia_alterado com escola nula
-    const depois = definidoPeloPedido(pedido)
+    const depois = { valorPorAlunoMicros: null, tetoPercentual: null }
     const requisicaoId = currentContext()?.requisicaoId ?? randomUUID()
     const definida = await runInContext({ requisicaoId }, () =>
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: apps/api/test/painel-escrita.int.test.ts › a primeira gravação cria a linha da escola
    const escolaId = requireEscolaId()
-    await this.banco.insert(configuracaoOperacionalEscola).values({ escolaId }).onConflictDoNothing()
    const [linha] = await this.banco
```

```mutacao
arquivo: apps/api/src/operacao/painel/orcamento-da-rede.repository.ts
teste: apps/api/test/painel-escrita.int.test.ts › rede.orcamento_ia_alterado com escola nula
    if (mesmoOrcamentoDefinido(antes, depois)) return { antes, mudou: false }
-    await this.banco.update(rede).set({ iaValorPorAlunoMicros: depois.valorPorAlunoMicros, iaTetoDeSegurancaPercentual: depois.tetoPercentual }).where(eq(rede.id, redeId))
    return { antes, mudou: true }
```

Motivo (a linha ficou citada como contexto dos dois blocos acima, mas o `?? randomUUID()` em si não tem mutação):

- `currentContext()?.requisicaoId ?? randomUUID()`, nos dois métodos novos: o `??` só cobre a chamada fora de uma requisição HTTP (a rota sempre tem contexto, posto pelo `OperacaoRoute`), e o `randomUUID()` fecha o tipo; o id só entra no contexto do log e da auditoria, e nenhum teste conhece o valor que o contexto escolheu. É o idioma do repositório para quem chama fora de requisição (`operacao/escola/escola.ts` e `sessao/convite/convite.service.ts`), e o `naEscola` deste mesmo serviço faz o mesmo com `currentContext() ?? { requisicaoId: randomUUID() }`.

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › GET /escolas e /redes: o próprio e o vigente de cada escola
-const microsDoDriver = (valor: string | null): number | null => (valor === null ? null : Number(valor))
+const microsDoDriver = (valor: string | null): number | null => Number(valor)
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › GET /escolas e /redes: o próprio e o vigente de cada escola
-      select r.id, r.nome, r.tipo,
+      select r.id, r.nome,
        r.ia_valor_por_aluno_micros::text as "iaValorMicros",
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › GET /escolas e /redes: o próprio e o vigente de cada escola
-        r.ia_valor_por_aluno_micros::text as "iaValorMicros",
+        null::text as "iaValorMicros",
        r.ia_teto_de_seguranca_percentual as "iaTeto",
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › GET /escolas e /redes: o próprio e o vigente de cada escola
-        r.ia_teto_de_seguranca_percentual as "iaTeto",
+        null::int as "iaTeto",
        (select count(*)::int
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › GET /escolas e /redes: o próprio e o vigente de cada escola
-        (select count(*)::int
+        (select count(distinct e.rede_id)::int
          from escola as e left join configuracao_operacional_escola as cfg on cfg.escola_id = e.id
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › GET /escolas e /redes: o próprio e o vigente de cada escola
        (select count(*)::int
-          from escola as e left join configuracao_operacional_escola as cfg on cfg.escola_id = e.id
+          from escola as e join configuracao_operacional_escola as cfg on cfg.escola_id = e.id
          where e.rede_id = r.id
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › GET /escolas e /redes: o próprio e o vigente de cada escola
          from escola as e left join configuracao_operacional_escola as cfg on cfg.escola_id = e.id
-          where e.rede_id = r.id
+          where e.id is not null
            and ((cfg.ia_valor_por_aluno_micros is null and r.ia_valor_por_aluno_micros is not null)
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › a rede que só define o teto conta a escola sem teto próprio
          where e.rede_id = r.id
-            and ((cfg.ia_valor_por_aluno_micros is null and r.ia_valor_por_aluno_micros is not null)
+            and ((cfg.ia_valor_por_aluno_micros is null)
              or (cfg.ia_teto_de_seguranca_percentual is null and r.ia_teto_de_seguranca_percentual is not null))) as "escolasQueUsamOValorDaRede"
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › GET /escolas e /redes: o próprio e o vigente de cada escola
          where e.rede_id = r.id
-            and ((cfg.ia_valor_por_aluno_micros is null and r.ia_valor_por_aluno_micros is not null)
+            and ((r.ia_valor_por_aluno_micros is not null)
              or (cfg.ia_teto_de_seguranca_percentual is null and r.ia_teto_de_seguranca_percentual is not null))) as "escolasQueUsamOValorDaRede"
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › GET /escolas e /redes: o próprio e o vigente de cada escola
            and ((cfg.ia_valor_por_aluno_micros is null and r.ia_valor_por_aluno_micros is not null)
-              or (cfg.ia_teto_de_seguranca_percentual is null and r.ia_teto_de_seguranca_percentual is not null))) as "escolasQueUsamOValorDaRede"
+              or (false))) as "escolasQueUsamOValorDaRede"
      from rede as r
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › a rede que só define o teto conta a escola sem teto próprio
            and ((cfg.ia_valor_por_aluno_micros is null and r.ia_valor_por_aluno_micros is not null)
-              or (cfg.ia_teto_de_seguranca_percentual is null and r.ia_teto_de_seguranca_percentual is not null))) as "escolasQueUsamOValorDaRede"
+              or (cfg.ia_teto_de_seguranca_percentual is null))) as "escolasQueUsamOValorDaRede"
      from rede as r
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › GET /escolas e /redes: o próprio e o vigente de cada escola
-      from rede as r
+      from rede as r where r.id <> r.id
      order by r.nome, r.id
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › GET /redes: as redes vêm por nome
-      order by r.nome, r.id
+      order by r.id
      limit ${MAXIMO_DE_REDES_DO_PAINEL}`)
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-escrita.int.test.ts › GET /v1/operacao/redes: a rede criada
      order by r.nome, r.id
-      limit ${MAXIMO_DE_REDES_DO_PAINEL}`)
+      limit ${MAXIMO_DE_REDES_DO_PAINEL + 1000}`)
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › GET /escolas e /redes: o próprio e o vigente de cada escola
-      orcamento: { valorPorAlunoMicros: microsDoDriver(linha.iaValorMicros), tetoPercentual: linha.iaTeto },
+      orcamento: { valorPorAlunoMicros: microsDoDriver(linha.iaValorMicros), tetoPercentual: null },
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › GET /escolas e /redes: o próprio e o vigente de cada escola
-      escolasQueUsamOValorDaRede: linha.escolasQueUsamOValorDaRede,
+      escolasQueUsamOValorDaRede: 0,
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › GET /escolas e /redes: o próprio e o vigente de cada escola
-          cfg.ia_valor_por_aluno_micros::text as "iaValorMicros",
+          null::text as "iaValorMicros",
          cfg.ia_teto_de_seguranca_percentual as "iaTeto",
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › GET /escolas e /redes: o próprio e o vigente de cada escola
-          cfg.ia_teto_de_seguranca_percentual as "iaTeto",
+          null::int as "iaTeto",
          r.ia_valor_por_aluno_micros::text as "redeIaValorMicros",
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › GET /escolas e /redes: o próprio e o vigente de cada escola
-          r.ia_valor_por_aluno_micros::text as "redeIaValorMicros",
+          null::text as "redeIaValorMicros",
          r.ia_teto_de_seguranca_percentual as "redeIaTeto",
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › GET /escolas e /redes: o próprio e o vigente de cada escola
-          r.ia_teto_de_seguranca_percentual as "redeIaTeto",
+          null::int as "redeIaTeto",
          exists(select 1 from usuario as coordenador
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › GET /escolas e /redes: o próprio e o vigente de cada escola
        join rede as r on r.id = e.rede_id
-        left join configuracao_operacional_escola as cfg on cfg.escola_id = e.id
+        join configuracao_operacional_escola as cfg on cfg.escola_id = e.id
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › GET /escolas e /redes: o próprio e o vigente de cada escola
-            escola: { valorPorAlunoMicros: microsDoDriver(linha.iaValorMicros), tetoPercentual: linha.iaTeto },
+            escola: { valorPorAlunoMicros: microsDoDriver(linha.iaValorMicros), tetoPercentual: linha.redeIaTeto },
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › GET /escolas e /redes: o próprio e o vigente de cada escola
-            rede: { valorPorAlunoMicros: microsDoDriver(linha.redeIaValorMicros), tetoPercentual: linha.redeIaTeto },
+            rede: { valorPorAlunoMicros: microsDoDriver(linha.redeIaValorMicros), tetoPercentual: linha.iaTeto },
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.controller.ts
teste: apps/api/test/architecture.test.ts › toda rota @RotaDeOperacao registrada tem a guarda
  @Put('escolas/:id/orcamento-ia')
-  @OperacaoRoute()
  @Header('Cache-Control', 'no-store')
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.controller.ts
teste: apps/api/test/architecture.test.ts › toda rota @RotaDeOperacao registrada tem a guarda
  @Put('redes/:id/orcamento-ia')
-  @OperacaoRoute()
  @Header('Cache-Control', 'no-store')
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.controller.ts
teste: apps/api/test/painel-escrita.int.test.ts › a primeira gravação cria a linha da escola
  @OperacaoRoute()
-  @Header('Cache-Control', 'no-store')
  definirOrcamentoDaEscola(
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.controller.ts
teste: apps/api/test/painel-escrita.int.test.ts › rede.orcamento_ia_alterado com escola nula
  @OperacaoRoute()
-  @Header('Cache-Control', 'no-store')
  definirOrcamentoDaRede(
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.controller.ts
teste: apps/api/test/painel-escrita.int.test.ts › escola e rede inexistentes, e id que não é UUID
-    @Param('id', IdPipe) escolaId: string,
+    @Param('id') escolaId: string,
    @Body(new ZodValidationPipe(orcamentoDeIaRequestSchema)) pedido: OrcamentoDeIaRequest,
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.controller.ts
teste: apps/api/test/painel-escrita.int.test.ts › escola e rede inexistentes, e id que não é UUID
-    @Param('id', IdPipe) redeId: string,
+    @Param('id') redeId: string,
    @Body(new ZodValidationPipe(orcamentoDeIaRequestSchema)) pedido: OrcamentoDeIaRequest,
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.controller.ts
teste: apps/api/test/painel-escrita.int.test.ts › e o que não é o contrato, são ENTRADA_INVALIDA
-    @Body(new ZodValidationPipe(orcamentoDeIaRequestSchema)) pedido: OrcamentoDeIaRequest,
+    @Body() pedido: OrcamentoDeIaRequest,
  ): Promise<OrcamentoDeIaDoPainel> {
    return this.painel.definirOrcamentoDaEscola(escolaId, pedido)
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.controller.ts
teste: apps/api/test/painel-escrita.int.test.ts › e o que não é o contrato, são ENTRADA_INVALIDA
-    @Body(new ZodValidationPipe(orcamentoDeIaRequestSchema)) pedido: OrcamentoDeIaRequest,
+    @Body() pedido: OrcamentoDeIaRequest,
  ): Promise<OrcamentoDeIaDoPainel> {
    return this.painel.definirOrcamentoDaRede(redeId, pedido)
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| `tenancy-guardian`, rodada 3 | gravar a rede no `EscolaRepository` | recusada: a rede fica no `OrcamentoDaRedeRepository` (Tech Spec §6) |
| `revisor-geral`, 1ª | Estreitar o `23503` de `definirOrcamentoDaEscola` pelo nome da constraint | `TODO.md`: muda o comportamento do serviço (caducaria todos os revisores); hoje só o `insert` da configuração dispara essa violação |
| `revisor-geral`, 1ª | `escolasQueUsamOValorDaRede` também conta a escola que só herda o teto | tarefa 7.0, que escreve o texto do diálogo (o nome vem da Tech Spec) |
| `conformidade-reviewer`, 1ª | Na 4.0, o corte do Tutor pelo teto não deixa o professor sem ver um uso já iniciado; o aviso ao aluno é rotulado como do sistema e não incentiva voltar (regra 70.4, D59) | tarefa 4.0 |
| `conformidade-reviewer`, 1ª | Na 7.0, o "IA do mês: N% do previsto" da coordenação continua agregado por escola, nunca por professor (D64) | tarefa 7.0 |
| `privacy-guardian`, 1ª | `AuditoriaRepository.listDaEscola` (`auditoria.repository.ts:58`) devolveria `escola.orcamento_ia_alterado` quando a auditoria da escola abrir à coordenação: lista de ações excluídas ou permitidas (RF12, D40) | `TODO.md`, para a tarefa que abrir a auditoria da escola à coordenação (F3); hoje não há rota que a liste |
| `tenancy-guardian`, 1ª | O módulo `operacao/painel` chega a quatro `@Unscoped`; avaliar fronteira própria "acima do tenant" | retro da camada-ia |
| `infra-guardian`, 1ª | `for('no key update')` na trava da rede (`orcamento-da-rede.repository.ts:28`) e da escola (`orcamento-do-mes.repository.ts:99`) | `TODO.md`: muda o nível da trava, e o teste de corrida casa o padrão `%for update%` |
| `infra-guardian`, 1ª | Índice `escola(rede_id)` para a contagem de `escolasQueUsamOValorDaRede` | `TODO.md`: é migration, e o número de escolas hoje é pequeno |
| `revisor-geral`, 2ª | `semRequisicaoDe` (`painel-escrita.int.test.ts`) é cópia de `semRequisicao`: subir uma só para o escopo do arquivo | `TODO.md`: mexer no teste depois da aprovação caducaria o `test-engineer` e o `revisor-geral`, e o ganho é só de duplicação em teste |
| `test-engineer`, 2ª | A checagem dos centavos e do teto no log só pega campo numérico da linha do evento: juntar as duas sobre o log inteiro e incluir a forma em texto | `TODO.md`: cobertura extra; a regra 20.9 já tem teste (o log não leva micros nem nome de campo) |
| `test-engineer`, 2ª | O mesmo apontamento de `semRequisicao`/`semRequisicaoDe` duplicados | junto com a linha do `revisor-geral` acima |
| `test-engineer`, 1ª | Os blocos de mutação de `orcamentoProprioDoPainelSchema`, `orcamentoVigenteDoPainelSchema`, `redeDoPainelSchema` e `escolaDoPainelSchema` casam por texto e ficam sem mutação própria | recusada: não é regra de negócio (os checks do banco valem), e o próprio revisor diz que é só para saber da limitação da ferramenta |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-21 04:53:10 | 2026-11-21 04:53:43 | `conformidade-reviewer` | 1 | APROVADO | a4360fd4c60efe668 |
| 2026-11-21 04:53:00 | 2026-11-21 04:54:01 | `privacy-guardian` | 1 | APROVADO | a4eb277a6959e06f4 |
| 2026-11-21 04:52:57 | 2026-11-21 04:54:10 | `tenancy-guardian` | 1 | APROVADO | a0059ceefc78d9d32 |
| 2026-11-21 04:53:13 | 2026-11-21 04:54:30 | `infra-guardian` | 1 | APROVADO | aa66298cc609f1a60 |
| 2026-11-21 04:53:07 | 2026-11-21 04:54:44 | `revisor-geral` | 1 | REPROVADO | a2e5ee8546c2c09f0 |
| 2026-11-21 04:53:03 | 2026-11-21 04:56:44 | `test-engineer` | 1 | APROVADO | ad3e75034033a441b |
| 2026-11-21 05:53:25 | 2026-11-21 05:53:54 | `revisor-geral` | 2 | APROVADO | a743da5e07cc1e8dd |
| 2026-11-21 05:53:17 | 2026-11-21 05:54:16 | `test-engineer` | 2 | APROVADO | a6f6c108144c1dc98 |
