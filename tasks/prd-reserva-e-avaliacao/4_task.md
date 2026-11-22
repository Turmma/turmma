# Tarefa 4.0 — Com o principal caído, a chamada vai à reserva elegível, e cada chamada leva o seu destino

**Funcionalidade:** reserva-e-avaliacao · **Depende de:** 3.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `llm-integrator`
**Porte:** grande

## Objetivo

No gateway: na queda do principal (disjuntor, 5xx, conexão, prazo com o sinal vivo), a chamada vai à reserva elegível, uma vez.
Cada chamada carrega o seu destino, e a linha de consumo que o gateway entrega ao registro traz provedor, modelo, preço e
`peloProvedorDeReserva` de quem a recebeu. Gravar a coluna no banco e o compartilhamento do aluno são da 5.0.

## Contexto necessário

- `techspec.md` §3 (`pelo_provedor_de_reserva`), §5 ("A chamada" (2) e (4), "O destino por chamada"), §7 (log)
- `prd.md` RF2 a RF5, §7
- `cenarios.md` §1: as linhas RF1 a RF5 da tabela abaixo (o principal **fora**)
- Código: `llm-gateway.ts` (`ChamadaEnviada`, `Gasto`, `medir`, `linhasDeConsumo`, `chamadaFeita`, `descer`, `DEGRAUS`),
  `consumo.ts` (`ConsumoDeIa`, `InMemoryConsumo`), `fake-adapter.ts`, `resilient-adapter.ts` (o rótulo do disjuntor)

## Subtarefas

- [x] 4.1 — O destino em `ChamadaEnviada` e no `Gasto` (origem, envio, identidade, `peloProvedorDeReserva`); preço, rótulo, linha e
  `medicao` leem o da chamada; `ConsumoDeIa.peloProvedorDeReserva` no tipo e no `InMemoryConsumo`
- [x] 4.2 — O ramo da queda, depois da suspensão e da regra fixa da D36, com a elegibilidade da 1.0; a `rejeitada` não é queda; a
  reserva que falha termina como hoje (interativo indisponível, lote `JobAdiadoError(provedor)`); a inválida da reserva repete nela
- [x] 4.3 — `provedor_de_reserva` em `DEGRAUS` (nasce em 0); log `ia.geracao.provedor_de_reserva` só com ids e `provedorId`; o
  disjuntor de cada adaptador no seu `provedor`
- [x] 4.4 — `IA_FALHA_FALSA=<principal|reserva>:<5xx|prazo|conexao|429>` no `FakeAdapter`; a subida em produção a recusa
- [x] 4.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/ia/llm-gateway.ts`, `packages/core/src/ia/llm-gateway.test.ts`, `packages/core/src/ia/tasks/turno-do-tutor.test.ts` | alterado |
| `packages/core/src/ia/consumo.ts` | alterado |
| `packages/core/src/ia/fake-adapter.ts`, `packages/core/src/ia/fake-adapter.test.ts`, `packages/core/src/ia/resilient-adapter.test.ts` | alterado |
| `infra/test/alertas.test.ts` | alterado |
| `packages/core/src/config/llm-config.ts`, `packages/core/src/config/llm-config.test.ts` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| disjuntor aberto: a saída e a única linha são da reserva; degrau +1, nascido em 0 | U | a queda | o principal sem linha | llm-gateway.test.ts › disjuntor do principal aberto: a saída e a única linha são da reserva |
| 5xx, e conexão: à reserva | U | o que é queda | um por causa | llm-gateway.test.ts › o 5xx do servidor: vai à reserva; › a conexão recusada, depois da única repetição do `ResilientAdapter`: vai à reserva |
| prazo com o sinal vivo: à reserva; abortado: não | U | o prazo | só o sinal muda | llm-gateway.test.ts › o prazo estourado com o sinal da execução vivo vai à reserva; com o sinal já abortado, não vai |
| `rejeitada` com reserva elegível: não vai | U | não é queda | reserva elegível | llm-gateway.test.ts › `rejeitada` (o 401 de chave revogada) com reserva elegível: não é queda; › o erro que não é da camada de IA não é queda |
| suspensa e principal fora: nenhuma chamada | U | a suspensão antes | contador nos dois | llm-gateway.test.ts › função suspensa e principal fora |
| aprovação só da geração: a geração vai, o Tutor não, a D36 sai pela regra fixa | U | por tarefa | as duas no mesmo gateway | llm-gateway.test.ts › aprovação só da geração, principal fora; turno-do-tutor.test.ts › com o principal fora e uma reserva aprovada para o Tutor |
| Tutor aprovado no `rapido` da reserva: atende; linha com `aluno_id`, a identidade dela, `true`, conteúdo nulo | U | RF4 positivo | reserva conferida com `conversa_do_aluno`; `aluno_id` não nulo | llm-gateway.test.ts › Tutor aprovado no `rapido` da reserva, principal fora; › a reserva só atende o que a subida conferiu na D62 |
| modelo do `rapido` trocado; o mesmo na classificação; outro `provedorId`: indisponível sem chamar | U | provedor e modelo | um campo por caso | llm-gateway.test.ts › o modelo do `rapido` da reserva trocado depois da aprovação; › o mesmo na classificação do material; › a aprovação é de outro `provedorId`, com o mesmo modelo |
| os dois fora: uma chamada à reserva; o interativo termina indisponível (o lote é da 5.0) | U | sem laço | chamadas contadas nos dois | llm-gateway.test.ts › os dois fora: uma chamada à reserva, sem laço de volta ao principal; › os dois fora por disjuntor, no interativo |
| a reserva falha depois de sair: estimativa, o provedor dela, `true`; o principal `false` | U | a coluna | as duas linhas | llm-gateway.test.ts › a reserva que falha depois de sair |
| a inválida da reserva repete na reserva | U | quem respondeu | o `provedorId` da 2ª | llm-gateway.test.ts › a saída inválida da reserva repete na reserva; › no máximo quatro chamadas |
| prazo no principal, reserva atende: cada linha com o preço, o provedor, o modelo e a coluna dela; `medicao` da reserva | U | RF5 | preços, `provedorId` e modelos diferentes nos dois | llm-gateway.test.ts › o principal fora e a reserva atende, com preço, provedor e modelo diferentes; › o principal falso cai e a reserva envia |
| os dois fora: `ia.disjuntor.aberto` com 1 em duas séries, uma por `provedor` | U | a X6 | dois `provedorId`, cada série lida pelo rótulo | resilient-adapter.test.ts › o principal e a reserva, no mesmo medidor, têm uma série cada |
| os dois fora: o "Provedor de IA fora" (`ia-provedor-fora.yaml`, por `provedor`) dispara para cada um | U | §7c | a `expressao` agrupa por `provedor` | infra/test/alertas.test.ts › reserva-e-avaliacao, tarefa 4.0: com os dois provedores fora, o "Provedor de IA fora" dispara uma vez para cada `provedor` |
| `IA_FALHA_FALSA` só no falso; em produção recusa a subida | U | fora de produção | `openai_compat` sem efeito | llm-config.test.ts › o formato é `<principal|reserva>:<5xx|prazo|conexao|429>`; › com `AMBIENTE=producao` a subida a recusa citando a variável; fake-adapter.test.ts › a falha sob comando; llm-gateway.test.ts › com o `openai_compat` nos dois, `IA_FALHA_FALSA` não tem efeito |
| log novo: `ia.geracao.provedor_de_reserva` | U | só ids e `provedorId` (regra 20.9) | texto reconhecível na entrada e a chave da reserva reconhecível | llm-gateway.test.ts › o log do desvio leva a tarefa, os ids e o `provedorId` |
| o disjuntor do principal aberto devolve a vaga ao balde; a chamada que pode ter saído (5xx) a mantém | U | regra 80.4: o desvio não enche o balde até o `sem_vaga` | um balde de duas vagas e cinco pedidos seguidos; o 5xx, que não é `semEnvio` | llm-gateway.test.ts › o disjuntor do principal aberto devolve a vaga; › a chamada que pode ter saído (o 5xx) mantém a estimativa no balde |
| duas execuções ao mesmo tempo no mesmo gateway, uma desviada e outra não | U | o destino é da chamada, e não da instância | `Promise.all`, com o principal parado até as duas chegarem; `execucaoId` de cada linha | llm-gateway.test.ts › duas execuções ao mesmo tempo no mesmo gateway, uma desviada e outra não |
| a reserva `openai_compat` sai com a resiliência: o 429 sem `Retry-After` é repetido uma vez | U | o disjuntor, a repetição e o prazo da reserva (4.3) | o servidor que responde 429 sempre: dois pedidos, e não um nem três | llm-gateway.test.ts › a reserva `openai_compat` sai com a resiliência do `ResilientAdapter` |

## Como testar

- `llm-gateway.test.ts` › "disjuntor aberto fora do lote: uma linha da falha…", › "disjuntor aberto no lote: nenhuma linha, e o job
  adia", › "o provedor que falhou depois de a chamada sair não é `semEnvio`…" e › "o log de cada degrau leva só o evento…"
- D36: `turno-do-tutor.test.ts`, bloco "assunto pessoal delicado: mensagem fixa, sem modelo (D36)"
- Disjuntor: `resilient-adapter.test.ts` › "`ia.disjuntor.aberto{provedor,modelo,perfil}`: 0 com o disjuntor fechado…"
- Dois adaptadores: `__fixtures__/scripted-adapter.ts` com `provedorId` por instância (1.0)
- `npx vitest run --project unidade packages/core/src/ia/llm-gateway.test.ts`

## Fora do escopo desta tarefa

O banco, a bancada e o compartilhamento (5.0); a repetição e o prazo das quatro (6.0); o sem vaga (7.0).

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano antes de codar.

1. **Mutação de cada cláusula:** os blocos da seção "Mutações" cobrem cada termo de `isQueda`, da guarda de `reservaParaAQueda` (os três termos), da elegibilidade (`soberania`, `aprovados`, o `elegivel ?`), do `desceAoMenor` (os quatro termos), do `semEnvio`, do destino lido pela chamada (`origem`, `envio`, `peloProvedorDeReserva`), da montagem em `createLLMGateway`, da falha por destino em `opcoesDoFalso`, e da config (`regex`, a recusa em produção, o `texto === undefined`). `--faltando` zerado.
2. **Texto na tela:** a tarefa não toca tela nem texto de `apps/web`; não se aplica.
3. **O que distingue está no teste:** preço, `provedorId` e modelo diferentes nos dois (`o principal fora e a reserva atende, com preço, provedor e modelo diferentes`); o `limite` na reserva com o balde do principal contado; a mesma tarefa aprovada e a não aprovada no mesmo gateway; o sinal abortado e o vivo.
4. **Checagem anterior que responde antes:** a suspensão e a regra fixa da D36 vêm antes do ramo da queda, e cada uma tem o caso com os dois provedores contados em zero. A reserva do teste é elegível de verdade (`reservaElegivel` com `soberaniaDaReserva` conferida e aprovação por tarefa, provedor e modelo), e o erro lançado é o que o `ResilientAdapter` lança (`LLMError` com `motivo`, `ProviderError` pelo adaptador real em dois casos).
5. **Asserção olha o resultado:** linhas de consumo, chamadas contadas por adaptador, o degrau e o log lidos do que o gateway entrega; nenhuma asserção sobre texto de arquivo.
6. **Guarda nova:** não há regra de lint nem teste estrutural novo.
7. **Comentário que afirma o que o código não faz:** os docblocks novos (`isQueda`, `reservaParaAQueda`, `desviarParaAReserva`) foram relidos contra o código; o da reserva diz que o limitador e o sem vaga dela são da 7.0, e o código não os faz. O docblock do `descer` agora diz que o desvio leva a escola e a execução e os outros degraus não, e por quê.
8. **Divergência:** quatro, na tabela abaixo: o campo `peloProvedorDeReserva` opcional; a chamada à reserva no ramo da queda sem limitador (a 7.0); a 6.1 e a 6.2 que entraram aqui; e a vaga do principal que só volta quando a chamada não saiu. Cada uma tem a sua linha na `techspec.md`, ou no `6_task.md` e no `7_task.md`, com o termo do código.
9. **Peça que já existe:** `reservaElegivel` e `MODELOS_APROVADOS` (1.0), o rótulo do disjuntor por `identidade` do `ResilientAdapter` (3.0, sem mudança), `ScriptedAdapter` com `provedorId` por instância. Nada copiado.
10. **Concorrência:** o gateway guarda o destino por chamada e não por instância, e só duas execuções ao mesmo tempo prendem isso: `duas execuções ao mesmo tempo no mesmo gateway, uma desviada e outra não` usa `Promise.all`, com o principal parado até as duas chegarem (a ordem não decide o que o teste prova). O balde em memória não é espiado: `LimiteComBalde` enche de verdade.
11. **Isolamento entre escolas:** a tarefa não cria repository, query nem endpoint; o log novo leva `escolaId` do pedido, e a linha de consumo segue com o `escolaId` do contexto (`as portas em memória leem a escola do contexto`).
12. **Guardiões:** `llm-integrator` (a reserva só pela porta, com perfil, orçamento e a D62), `privacy-guardian` (o log só com ids e `provedorId`, a linha do Tutor com `aluno_id` e conteúdo nulo), `conformidade-reviewer` (D36 antes de qualquer provedor, nada de nota), `infra-guardian` (o disjuntor por `provedor`, o alerta agrupa por `provedor`, `IA_FALHA_FALSA` recusada em produção), `tenancy-guardian` (sem query nova). `achados/indice.md` lido nas linhas que tocam o gateway.

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| `DadosDoConsumo.peloProvedorDeReserva` é opcional (a falta vale `false`), e a linha que o gateway entrega sempre o preenche | O `ConsumoDeIa` também é construído fora do gateway (`apps/api/test/ia.int.test.ts`); tornar o campo obrigatório mexeria em arquivo da 5.0. A 5.0 grava a coluna e pode torná-lo obrigatório | `techspec.md` §5, "O destino por chamada" (linhas 87 e 88: "`ConsumoDeIa` ganha `peloProvedorDeReserva`, e o `ConsumoRepository` o grava"); a gravação é da 5.0 (linha 49) |
| A chamada à reserva no ramo da queda **não passa por limitador**: `vagaDoAlvo` devolve `{}` para a reserva (`peloProvedorDeReserva`), e o `limiteDeTokensDaReserva`, que chega ao gateway desde a 2.0, ainda não é lido. A reserva no balde dela, na fila do pedido, e o `sem_vaga` quando ele está cheio, entram na 7.0, com os dois ramos da reserva no mesmo código | A 4.0 declara fora de escopo "o sem vaga e o limitador da reserva"; o balde da reserva é o mesmo da 7.1, e fazê-lo só na queda deixaria o outro ramo com outro código. A regra 80, item 4, fica pendente até a 7.0 e o horário de aula não a cobre antes dela | `techspec.md` §5, "A chamada" (2) e "O destino por chamada" (o balde lê o destino da chamada); `7_task.md` 7.1 e a tabela de testes, com a linha "queda do principal: a reserva reserva no balde dela, por fila; sem vaga ali, `sem_vaga`" |
| A 6.1 e a 6.2 entraram na 4.0: o contador de chamadas por destino (`CHAMADAS_MAXIMAS_POR_DESTINO`, `donoDoAlvo`) e a repetição na reserva, com o pedido original e sem a correção do principal (`correcao = undefined` no desvio); a queda na repetição do principal vai à reserva | A 4.2 exige que a inválida da reserva repita nela e que a reserva atenda uma vez, e isso só se escreve com o contador por destino; os casos `saída inválida do principal não é queda`, `a saída inválida da reserva repete na reserva` e `no máximo quatro chamadas` já provam o que a 6.0 listava | `6_task.md` 6.1 e 6.2, e `tasks.md`: a 6.0 fica com a 6.3 (`reservaQuandoInvalida` com os `problemas` da reserva), a 6.4 (o prazo) e a variante de mesmo `provedorId`; quem atualiza os dois é o Orquestrador, a pedido da Mesa |
| A vaga do principal que caiu **sem sair** (o disjuntor aberto, `semEnvio`) volta ao balde na hora, com `acertar(0)`; a das que podem ter saído (5xx, conexão, prazo) **fica**, com a estimativa | Sem devolver, cada pedido desviado deixa a estimativa no balde por um minuto, e o balde enche até o `sem_vaga`, que não é queda. A que pode ter saído fica porque o provedor pode tê-la contado, e superestimar é o lado seguro (D14); o balde fica abaixo do contratado e a estimativa vence em um minuto | `techspec.md` §5, "A chamada" (2), a frase da vaga devolvida; os casos `o disjuntor do principal aberto devolve a vaga` e `a chamada que pode ter saído (o 5xx) mantém a estimativa no balde` |

## Mutações

`--faltando: 0 linhas (38 blocos, 2 motivos)`

Motivos (termo sem bloco, com o porquê):

- `erro instanceof LLMError` (`llm-gateway.ts`, a guarda do `desceAoMenor` e a do `semEnvio`): só estreita o tipo de `unknown` para ler `motivo` e `semEnvio`; para erro que não é `LLMError` os dois são `undefined`, e o resultado é o mesmo com ou sem o termo. O `erro.motivo === 'limite'`, o `vaga.modelo === undefined` e o `erro.semEnvio` têm bloco.
- `daReserva === undefined` e `config.reserva === undefined` (`createLLMGateway`): `adaptadorDaReserva` devolve `undefined` exatamente quando `config.reserva` é `undefined`, e os dois termos dizem a mesma coisa, um para o tipo de `daReserva` e o outro para o de `config.reserva.ambiente`. Tirar um deles não muda o que o gateway monta; o `...reserva` da linha seguinte tem bloco.

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts › o formato é
-    IA_FALHA_FALSA: opcional(z.string().regex(/^(principal|reserva):(5xx|prazo|conexao|429)$/).optional()),
+    IA_FALHA_FALSA: opcional(z.string().regex(/^(principal|reserva|outro):(5xx|prazo|conexao|429)$/).optional()),
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts › a subida a recusa citando a variável
-    if (valores.AMBIENTE === 'producao' && valores.IA_FALHA_FALSA !== undefined) problema('IA_FALHA_FALSA', MOTIVO_FALHA_FALSA_EM_PRODUCAO)
+    if (valores.AMBIENTE !== 'local' && valores.IA_FALHA_FALSA !== undefined) problema('IA_FALHA_FALSA', MOTIVO_FALHA_FALSA_EM_PRODUCAO)
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts › a subida a recusa citando a variável
-    if (valores.AMBIENTE === 'producao' && valores.IA_FALHA_FALSA !== undefined) problema('IA_FALHA_FALSA', MOTIVO_FALHA_FALSA_EM_PRODUCAO)
+    if (valores.AMBIENTE === 'producao') problema('IA_FALHA_FALSA', MOTIVO_FALHA_FALSA_EM_PRODUCAO)
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts › sem a variável, ou com ela vazia
-  if (texto === undefined) return {}
+  if (texto === undefined) return { falhaFalsa: { destino: 'principal', falha: '5xx' } }
```

```mutacao
arquivo: packages/core/src/ia/fake-adapter.ts
teste: packages/core/src/ia/fake-adapter.test.ts › a falha sob comando
-    if (this.opcoes.falha !== undefined) throw new ProviderError(FALHA_DO_PROVEDOR[this.opcoes.falha])
+    if (this.opcoes.falha !== undefined) void FALHA_DO_PROVEDOR[this.opcoes.falha]
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o erro que não é da camada de IA não é queda
-  if (!(erro instanceof LLMError)) return false
+  if (!(erro instanceof Error)) return false
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o prazo estourado com o sinal da execução vivo vai à reserva
-  if (erro.codigoDeIa === 'IA_TEMPO_ESGOTADO') return true
+  if (erro.codigoDeIa === 'IA_TEMPO_ESGOTADO') return false
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o erro que não é da camada de IA não é queda
-  return erro.codigoDeIa === 'IA_INDISPONIVEL' && (erro.motivo === undefined || erro.motivo === 'disjuntor')
+  return (erro.motivo === undefined || erro.motivo === 'disjuntor')
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › com reserva elegível: não é queda
-  return erro.codigoDeIa === 'IA_INDISPONIVEL' && (erro.motivo === undefined || erro.motivo === 'disjuntor')
+  return erro.codigoDeIa === 'IA_INDISPONIVEL'
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o 5xx do servidor: vai à reserva
-  return erro.codigoDeIa === 'IA_INDISPONIVEL' && (erro.motivo === undefined || erro.motivo === 'disjuntor')
+  return erro.codigoDeIa === 'IA_INDISPONIVEL' && (erro.motivo === 'disjuntor')
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › disjuntor do principal aberto: a saída e a única linha são da reserva
-  return erro.codigoDeIa === 'IA_INDISPONIVEL' && (erro.motivo === undefined || erro.motivo === 'disjuntor')
+  return erro.codigoDeIa === 'IA_INDISPONIVEL' && (erro.motivo === undefined)
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › no máximo quatro chamadas
-  return alvo.peloProvedorDeReserva ? 'reserva' : 'principal'
+  return 'principal'
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › no máximo quatro chamadas
-    while (chamadas[donoDoAlvo(alvo)] < CHAMADAS_MAXIMAS_POR_DESTINO) {
+    while (chamadas[donoDoAlvo(alvo)] < CHAMADAS_MAXIMAS_POR_DESTINO + 1) {
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › a reserva que recusa por
-    return alvo.peloProvedorDeReserva ? {} : await this.reservarVaga(pedido, entrada, correcao)
+    return await this.reservarVaga(pedido, entrada, correcao)
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › no máximo quatro chamadas
-      chamadas[donoDoAlvo(alvo)] += 1
+      chamadas.principal += 1
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › a reserva que falha depois de sair
-      gasto.modelo = vaga.modelo ?? alvo.adaptador.modeloDoPerfil(tarefa.perfil)
+      gasto.modelo = vaga.modelo ?? this.dependencias.adaptador.modeloDoPerfil(tarefa.perfil)
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › com reserva elegível: não é queda
-        if (reserva === undefined) throw erro
+        if (reserva === undefined) throw new LLMError('IA_TEMPO_ESGOTADO')
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › sem reserva configurada a queda do principal termina como na X6
-    if (reserva === undefined || alvo.peloProvedorDeReserva || !isQueda(erro) || pedido.sinal?.aborted === true) return undefined
+    if (alvo.peloProvedorDeReserva || !isQueda(erro) || pedido.sinal?.aborted === true) return undefined
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › os dois fora: uma chamada à reserva, sem laço
-    if (reserva === undefined || alvo.peloProvedorDeReserva || !isQueda(erro) || pedido.sinal?.aborted === true) return undefined
+    if (reserva === undefined || !isQueda(erro) || pedido.sinal?.aborted === true) return undefined
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › com reserva elegível: não é queda
-    if (reserva === undefined || alvo.peloProvedorDeReserva || !isQueda(erro) || pedido.sinal?.aborted === true) return undefined
+    if (reserva === undefined || alvo.peloProvedorDeReserva || pedido.sinal?.aborted === true) return undefined
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o prazo estourado com o sinal da execução vivo vai à reserva
-    if (reserva === undefined || alvo.peloProvedorDeReserva || !isQueda(erro) || pedido.sinal?.aborted === true) return undefined
+    if (reserva === undefined || alvo.peloProvedorDeReserva || !isQueda(erro)) return undefined
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › a reserva atende, e a linha leva o aluno
-      { reserva: reserva.adaptador, ambiente: reserva.ambiente, ...(soberaniaDaReserva === undefined ? {} : { soberania: soberaniaDaReserva }), ...(reserva.aprovados === undefined ? {} : { aprovados: reserva.aprovados }) },
+      { reserva: reserva.adaptador, ambiente: reserva.ambiente, ...{}, ...(reserva.aprovados === undefined ? {} : { aprovados: reserva.aprovados }) },
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › aprovação só da geração
-      { reserva: reserva.adaptador, ambiente: reserva.ambiente, ...(soberaniaDaReserva === undefined ? {} : { soberania: soberaniaDaReserva }), ...(reserva.aprovados === undefined ? {} : { aprovados: reserva.aprovados }) },
+      { reserva: reserva.adaptador, ambiente: reserva.ambiente, ...(soberaniaDaReserva === undefined ? {} : { soberania: soberaniaDaReserva }), ...{} },
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › indisponível, sem chamar a reserva
-    return this.reservaAtende(pedido.tarefa, reserva) ? { adaptador: reserva.adaptador, peloProvedorDeReserva: true } : undefined
+    return { adaptador: reserva.adaptador, peloProvedorDeReserva: true }
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › a reserva que recusa por
-      const desceAoMenor = !alvo.peloProvedorDeReserva && erro instanceof LLMError && erro.motivo === 'limite' && vaga.modelo === undefined
+      const desceAoMenor = erro instanceof LLMError && erro.motivo === 'limite' && vaga.modelo === undefined
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › no principal, com menor disponível: não vai ao menor
-      const desceAoMenor = !alvo.peloProvedorDeReserva && erro instanceof LLMError && erro.motivo === 'limite' && vaga.modelo === undefined
+      const desceAoMenor = !alvo.peloProvedorDeReserva && erro instanceof LLMError && vaga.modelo === undefined
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › que já era o modelo da chamada
-      const desceAoMenor = !alvo.peloProvedorDeReserva && erro instanceof LLMError && erro.motivo === 'limite' && vaga.modelo === undefined
+      const desceAoMenor = !alvo.peloProvedorDeReserva && erro instanceof LLMError && erro.motivo === 'limite'
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › disjuntor aberto no lote: nenhuma linha, e o job adia
-      if (!(erro instanceof LLMError && erro.semEnvio)) gasto.chamadas.push(this.chamadaSemUso(pedido, entrada, correcao, destinoDe(alvo), gasto.modelo, inicioDaChamada, erro instanceof LLMError ? erro.codigoDeIa : 'IA_INDISPONIVEL'))
+      if (!(erro instanceof LLMError && false)) gasto.chamadas.push(this.chamadaSemUso(pedido, entrada, correcao, destinoDe(alvo), gasto.modelo, inicioDaChamada, erro instanceof LLMError ? erro.codigoDeIa : 'IA_INDISPONIVEL'))
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/tasks/turno-do-tutor.test.ts › com o principal fora e uma reserva aprovada
-      origem: regraFixa ? 'regra_fixa' : destino.origem,
+      origem: destino.origem,
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/tasks/turno-do-tutor.test.ts › com o principal fora e uma reserva aprovada
-      ...(gasto.tentativas > 0 ? destino.envio : SEM_ENVIO_EXTERNO),
+      ...(destino.envio),
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › os dois fora por disjuntor, no interativo
-      return [this.consumo(pedido, { ...medicao, tentativas: 0, ...SEM_ENVIO_EXTERNO }, { ...final.conteudo, estado: final.estado, ...(final.codigoDeErro === undefined ? {} : { codigoDeErro: final.codigoDeErro }) }, 0, this.relogio.agora(), false)]
+      return [this.consumo(pedido, { ...medicao, tentativas: 0, ...SEM_ENVIO_EXTERNO }, { ...final.conteudo, estado: final.estado, ...(final.codigoDeErro === undefined ? {} : { codigoDeErro: final.codigoDeErro }) }, 0, this.relogio.agora(), true)]
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › a reserva que falha depois de sair
-      return this.consumo(pedido, medida, { ...(ultima ? final.conteudo : {}), ...resultado }, chamada.custoMicros, chamada.em, chamada.destino.peloProvedorDeReserva)
+      return this.consumo(pedido, medida, { ...(ultima ? final.conteudo : {}), ...resultado }, chamada.custoMicros, chamada.em, false)
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › com a reserva falsa: o principal falha em toda chamada
-  return new LLMGateway({ adaptador, ...portas, ...reserva, ...(config.modelosMenores === undefined ? {} : { modelosMenores: config.modelosMenores }) })
+  return new LLMGateway({ adaptador, ...portas, ...(config.modelosMenores === undefined ? {} : { modelosMenores: config.modelosMenores }) })
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › só derruba a reserva
-  const falha = config.falhaFalsa?.destino === (identidade === undefined ? 'principal' : 'reserva') ? config.falhaFalsa.falha : undefined
+  const falha = config.falhaFalsa?.destino === (identidade === undefined ? 'reserva' : 'principal') ? config.falhaFalsa.falha : undefined
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › com a reserva falsa: o principal falha em toda chamada
-    ...(falha === undefined ? {} : { falha }),
+    ...(false ? {} : {}),
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › a chamada que pode ter saído
-    if (erro instanceof LLMError && erro.semEnvio) await vaga.reserva?.acertar(0)
+    if (erro instanceof LLMError) await vaga.reserva?.acertar(0)
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o disjuntor do principal aberto devolve a vaga
-        await this.devolverAVaga(vaga, erro)
+        void erro
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › sai com a resiliência do
-  const reserva = daReserva === undefined || config.reserva === undefined ? {} : { reserva: { adaptador: new ResilientAdapter(daReserva, politica), ambiente: config.reserva.ambiente, ...(aprovados === undefined ? {} : { aprovados }) } }
+  const reserva = daReserva === undefined || config.reserva === undefined ? {} : { reserva: { adaptador: daReserva, ambiente: config.reserva.ambiente, ...(aprovados === undefined ? {} : { aprovados }) } }
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisão da spec, rodada 2 | `rejeitada` (401) com contador por motivo | `ia.chamada.erros` já tem o código; se faltar, `TODO.md` |
| infra-guardian 1ª; revisor-geral 1ª | O prazo do Tutor pode dobrar (o do `rapido` no principal e outro inteiro na reserva): a 6.0 precisa provar o teto total do turno interativo | `6_task.md`, subtarefa 6.4 ("o prazo"), que já trata do que sobra do prazo da execução |
| infra-guardian 1ª; spec 2ª | Contar `rejeitada` (401) por motivo | Já está na tabela da 4.0: `ia.chamada.erros` tem o código; se faltar, `TODO.md` |
| revisor-geral 1ª | `IA_FALHA_FALSA=reserva:…` sem reserva configurada é ignorada em silêncio; recusar a subida | `TODO.md`: muda o comportamento da subida (`llm-config.ts`), e nenhum RF da tarefa trata disso |
| llm-integrator 1ª | Confirmar com o `infra-guardian` que `IA_FALHA_FALSA` passar em `staging` é intencional | A tarefa diz que só `producao` a recusa, e o falso já é recusado em `producao`; o `infra-guardian` aprovou esse ponto sem reparo |
| llm-integrator 1ª; privacy-guardian 1ª; conformidade-reviewer 1ª | A 5.0 lê as linhas de consumo, nunca a `medicao`, para a lista de compartilhamento; torna `peloProvedorDeReserva` obrigatório; mostra "atendido pelo provedor de reserva" na consulta de auditoria e no dossiê (D61) | `5_task.md` |
| tenancy-guardian 1ª | A 5.0 entrega teste de isolamento da contagem por `pelo_provedor_de_reserva` (a escola A não conta as linhas da B) | `5_task.md` |
| tenancy-guardian 1ª; llm-integrator 1ª | O limitador da reserva (por escola e por usuário, nunca global) e o freio de custo por escola | `7_task.md` (a parte da queda está no item 2 desta ordem) |
| privacy-guardian 1ª | Um teste que fixe que o interativo da API, sem `soberaniaDaReserva`, nunca chama a reserva, na montagem real do módulo | `TODO.md`, ou a tarefa de `apps/api` que monta o gateway |
| conformidade-reviewer 1ª | A AIA do Tutor (D60) e o dossiê registram que a reserva só atende o Tutor com aprovação por tarefa, provedor e modelo e com a D62 conferida | `docs/aia/` e dossiê: tarefa futura da spec que os toca; se nenhuma, `TODO.md` |
| test-engineer 1ª | Confirmar que a 5.0 tem a linha da reserva que falha no lote (`JobAdiadoError(provedor)`) | Conferido: `5_task.md` tem a linha « principal e reserva fora no lote: `JobAdiadoError(provedor)`, uma chamada à reserva » |
| llm-integrator 2ª; infra-guardian 2ª; revisor-geral 2ª | Se o 429 desce ao modelo menor e o menor falha com `semEnvio`, a vaga do menor (`menor.reserva`) não é devolvida, porque `devolverAVaga` só vê `vaga.reserva`; unificar a vaga nos dois ramos (`chamarComDegrau` junto com o catch de `chamarAteValer`) | `7_task.md` 7.1: a 7.0 mexe nesse trecho; caso raro, e o balde erra para o lado seguro (D14) |
| infra-guardian 2ª | A regra 80, item 4, fica pendente no ramo da queda até a 7.0: a 7.0 precisa pousar na mesma spec, antes do merge na `develop` | A 7.0 está em `tasks.md`, antes do pouso; o Validador confere no fechamento |
| revisor-geral 2ª | Atualizar o `6_task.md` (6.1 e 6.2 feitas na 4.0, com os casos na coluna "Caso") e o `tasks.md` antes de a 6.0 começar | Orquestrador, a pedido da Mesa: a linha da divergência já está no `4_task.md`; vai no relatório do Implementador |
| revisor-geral 2ª | O docblock de `descer` é longo; a justificativa de o desvio levar escola e execução caberia melhor no de `desviarParaAReserva` | Recusada: três revisores pediram a justificativa no `descer` na 1ª rodada, e o texto atual atende; é cosmético |
| test-engineer 2ª | Um caso "sem reserva configurada, disjuntor aberto: acertos `[0]`" para prender que `devolverAVaga` roda antes do `throw` | `TODO.md` |
| test-engineer 2ª | No teste do 5xx, expor o `usado` do `LimiteComBalde` e conferir que a estimativa continua no balde, em vez de provar pela ausência de acerto | `TODO.md` |
| tenancy-guardian 2ª | No teste das duas execuções ao mesmo tempo, uma delas com outro `escolaId`, conferindo o `escolaId` de cada linha | `TODO.md` |
| privacy-guardian 2ª | No teste do 429 da reserva `openai_compat`, conferir a linha de consumo da falha (`provedorId: RESERVA`, `envioExterno: true`, `estado: 'falhou'`) | `TODO.md` |
| privacy-guardian 2ª; conformidade-reviewer 2ª | No teste das duas execuções simultâneas, conferir que só o `execucaoId` desviado aparece no evento `ia.geracao.provedor_de_reserva`; teste de que o evento do desvio nunca leva o conteúdo do pedido | O segundo já existe (« o log do desvio leva a tarefa, os ids e o `provedorId` », texto marcado na entrada e a chave da reserva fora do log); o primeiro vai ao `TODO.md` |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-22 17:18:45 | 2026-11-22 17:19:23 | `tenancy-guardian` | 1 | APROVADO | a74a705adb3eaa59b |
| 2026-11-22 17:18:53 | 2026-11-22 17:19:53 | `llm-integrator` | 1 | APROVADO | aef105261bb70f36f |
| 2026-11-22 17:18:49 | 2026-11-22 17:19:58 | `conformidade-reviewer` | 1 | APROVADO | a6f3fb9de9a2a568d |
| 2026-11-22 17:18:47 | 2026-11-22 17:20:28 | `privacy-guardian` | 1 | APROVADO | a29c28a15a705c916 |
| 2026-11-22 17:18:51 | 2026-11-22 17:21:29 | `infra-guardian` | 1 | REPROVADO | ac7d0d0f907f7e62d |
| 2026-11-22 17:18:57 | 2026-11-22 17:21:29 | `revisor-geral` | 1 | REPROVADO | a8a892df07e7578b2 |
| 2026-11-22 17:18:55 | 2026-11-22 17:21:36 | `test-engineer` | 1 | REPROVADO | ae1ae012751836f54 |
| 2026-11-22 17:47:58 | 2026-11-22 17:48:14 | `tenancy-guardian` | 2 | APROVADO | a8c374a13e0c1bc29 |
| 2026-11-22 17:48:04 | 2026-11-22 17:48:30 | `privacy-guardian` | 2 | APROVADO | ab601519d890f6145 |
| 2026-11-22 17:48:10 | 2026-11-22 17:48:30 | `conformidade-reviewer` | 2 | APROVADO | a1e7bfd2b7e68c882 |
| 2026-11-22 17:48:16 | 2026-11-22 17:48:48 | `llm-integrator` | 2 | APROVADO | a5f340d81638e41f0 |
| 2026-11-22 17:48:26 | 2026-11-22 17:49:13 | `infra-guardian` | 2 | APROVADO | af7b5ebcc5a8328ec |
| 2026-11-22 17:48:43 | 2026-11-22 17:49:28 | `revisor-geral` | 2 | APROVADO | af60cbc688811662b |
| 2026-11-22 17:48:34 | 2026-11-22 17:49:34 | `test-engineer` | 2 | APROVADO | ad1f5076205c1ece8 |
