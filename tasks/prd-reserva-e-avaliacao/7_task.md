# Tarefa 7.0 — Sem vaga no principal, a chamada vai ao menor e depois à reserva, no balde dela

**Funcionalidade:** reserva-e-avaliacao · **Depende de:** 6.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `llm-integrator`
**Porte:** grande

## Objetivo

Sem vaga no principal (balde cheio ou `limite`, da 3.0), depois da espera e do modelo menor quando a tarefa o tem, a chamada vai à
reserva elegível, no balde `provedor:modelo` dela; sem vaga ali, `IA_INDISPONIVEL`/`sem_vaga`. O Tutor e a classificação vão
direto da espera à reserva, sem o menor. O uso do teto passa a ser por `provedor:modelo`.

## Contexto necessário

- `techspec.md` §5 ("A chamada" (1); "O destino por chamada": `usosDoTeto`), §7c
- `prd.md` RF2, RF3 (o limite), `.claude/rules/80-infra-e-carga.md` item 4
- `cenarios.md` §1: RF2 ("O mesmo com o principal **sem vaga**…"); RF4 (o controle positivo pelo sem vaga; a reserva falsa: as duas
  séries de `ia.tokens.uso_do_teto`); RF3 ("Com modelo menor disponível…", "O 429 que sobra da repetição…" até a reserva, "O mesmo
  no Tutor e na classificação…", "O 4xx rejeitado…" com o menor e a reserva, "Sem vaga no principal: o provedor de reserva usa o
  balde dele…")
- `revisao-spec.md`, rodada 8, "O que vai para as tarefas": o alerta de tokens por `provedor` e `modelo`; `docs/infra.md` 5.4
- Código: `llm-gateway.ts` (`reservarVaga`, `chaveDoBalde`, `anotarUsoDoTeto`, `usosDoTeto`, `descer`), `token-limiter.ts`,
  `infra/grafana/alertas/ia-tokens-acima-do-teto.yaml`

## Subtarefas

- [x] 7.1 — O ramo sem vaga (§5 (1)): espera, menor (se a tarefa o tem), reserva elegível no limitador dela (2.0); a mesma função
  de elegibilidade da queda. **E o ramo da queda (4.0):** a chamada à reserva depois da queda do principal também reserva no balde dela, por fila
  (`vagaDoAlvo` hoje devolve `{}` para a reserva), com acerto pelo uso real e devolução na falha; sem vaga ali, `sem_vaga`. A vaga do modelo menor que cai com `semEnvio` também volta ao balde (`menor.reserva`: `devolverAVaga` da 4.0 só vê a do principal); a vaga é uma só nos dois ramos (`chamarComDegrau` e o `catch` de `chamarAteValer`)
- [x] 7.2 — `usosDoTeto` e `ia.tokens.uso_do_teto` por `provedor:modelo`
- [x] 7.3 — `ia-tokens-acima-do-teto.yaml` agrupado por `provedor` e `modelo`; `docs/infra.md` 5.4 diz se a reserva de mesmo
  provedor divide o contratado
- [x] 7.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/ia/llm-gateway.ts`, `packages/core/src/ia/llm-gateway.test.ts` | alterado |
| `infra/grafana/alertas/ia-tokens-acima-do-teto.yaml`, `infra/test/alertas.test.ts` | alterado |
| `docs/infra.md` | alterado |
| `apps/api/src/ia/prazo-com-tokens.int.test.ts`, `packages/core/src/ia/prazo-da-execucao.ts` (só o comentário) | alterado (o que a 6.0 empurrou para esta: "Recomendações sem aplicar", `6_task.md`) |
| `docs/runbook.md`, `infra/grafana/paineis/fundacao.json` | alterado (o termo `max by (modelo)` do alerta e o título do painel que o runbook cita) |
| `packages/core/src/ia/errors.ts` | alterado (só o comentário do `sem_vaga`) |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| sem vaga, com menor disponível e reserva elegível: vai ao menor, não à reserva | U | regra 80.4 | a reserva elegível presente | llm-gateway.test.ts › sem vaga no principal, com o menor disponível e a reserva elegível: vai ao menor, e não à reserva… |
| sem vaga no principal e no menor: à reserva, no balde dela; o degrau soma | U | o ramo 1 | o balde da reserva vazio, o do principal cheio | llm-gateway.test.ts › sem vaga no principal e no menor: depois dos 8 s vai à reserva, no balde `provedor:modelo` dela e na fila do pedido… |
| o 429 que sobra, com o menor também sem vaga: linhas na ordem, a estimada do principal, a do menor e a da reserva | U | o `limite` até a reserva | a ordem das três | llm-gateway.test.ts › o 429 que sobra, com o menor também sem vaga ou também recusando… |
| Tutor e classificação, com `modelosMenores` do `rapido` configurado: o `limite` vai direto à reserva aprovada | U | D36 | o menor configurado e não chamado | llm-gateway.test.ts › o Tutor e a classificação, com o menor configurado para o `rapido`…; › o 429 do Tutor com o balde da reserva também cheio termina `sem_vaga`… |
| sem vaga também na reserva: `IA_INDISPONIVEL`, `sem_vaga` | U | balde próprio | só o balde da reserva cheio decide: com ele vazio, o mesmo caso atende | llm-gateway.test.ts › sem vaga também na reserva: `IA_INDISPONIVEL` com `sem_vaga` e a espera do balde dela… |
| queda do principal: a reserva reserva no balde dela, por fila; sem vaga ali, `sem_vaga` | U | regra 80.4 no ramo da queda (4.0) | o balde da reserva cheio e o do principal vazio, e o mesmo caso com o da reserva vazio atende | llm-gateway.test.ts › queda do principal: a reserva reserva no balde dela, na fila do pedido… |
| aprovação só da geração, principal sem vaga, sem menor: a geração vai à reserva; o Tutor termina `sem_vaga` sem chamá-la | U | a elegibilidade nos dois ramos | as duas tarefas | llm-gateway.test.ts › aprovação só da geração, principal sem vaga e sem menor… |
| Tutor aprovado no `rapido` da reserva, sem vaga: a reserva atende sem passar pelo menor | U | RF4 positivo | `modelosMenores` configurado para o `rapido` | llm-gateway.test.ts › Tutor aprovado no `rapido` da reserva, sem vaga no principal… |
| reserva falsa com o mesmo modelo do principal falso: `ia.tokens.uso_do_teto` em duas séries | U | por `provedor:modelo` | o mesmo modelo nos dois | llm-gateway.test.ts › o uso do teto sai por `provedor` e `modelo`… |
| o alerta de tokens agrupa por `provedor` e `modelo` | U | a X6 | a `expressao` lida do yaml | infra/test/alertas.test.ts › reserva-e-avaliacao, tarefa 7.0: o alerta de tokens agrupa por `provedor` e `modelo`… (e o caso do teto, com a expressão nova) |
| só o `limite` do provedor desce ao menor: o 5xx vai direto à reserva; o erro com a forma do `limite` e o `limite` de outro código não descem | U | a cláusula de `isLimite` | o 5xx com o menor configurado; o erro fora da camada de IA | llm-gateway.test.ts › o 5xx do principal, com o menor configurado, vai à reserva sem passar pelo menor…; › o erro que não é da camada de IA, com a forma do `limite`…; › o motivo `limite` num código que não é `IA_INDISPONIVEL`… |
| o menor que já era o modelo da chamada e recebe o 429 vai à reserva, sem descer de novo | U | o menor não repete | o menor reservado uma vez só | llm-gateway.test.ts › o menor que já era o modelo da chamada e recebe o 429 vai à reserva… |
| a repetição que fica sem vaga vai à reserva sem a correção do principal | U | o pedido da reserva é limpo | a estimativa sem a resposta anterior | llm-gateway.test.ts › a repetição que fica sem vaga no principal vai à reserva sem a correção dele… |
| o 429 que o menor atende, sem reserva configurada: conta o `modelo_menor` e não o `indisponivel` | U | o degrau só conta quando termina | o menor com vaga e nenhuma reserva | llm-gateway.test.ts › o 429 que o menor atende, sem reserva configurada… |
| a D62 da reserva vale nos três caminhos: sem a conferência dela, o Tutor aprovado não chega à reserva (sem vaga e 429) | U | D62 e regra 20, item 13 | a reserva sem conferência, o principal sem vaga ou com o 429 | llm-gateway.test.ts › a D62 da reserva vale nos três caminhos… |
| a reserva que cai sem sair devolve a vaga que reservou no balde dela | U | subtarefa 7.1, devolução na falha | a reserva com o disjuntor aberto | llm-gateway.test.ts › a reserva que cai sem sair… |
| a repetição da própria reserva sem vaga termina `sem_vaga` | U | borda nova da 7.0: a reserva tem balde | a reserva inválida e o balde dela fechado para a segunda chamada | llm-gateway.test.ts › a repetição da própria reserva sem vaga… |
| o 4xx rejeitado com o menor e a reserva elegível juntos | U | `cenarios.md` §1 RF3 | o menor, a reserva e o balde dela configurados | llm-gateway.test.ts › o 4xx rejeitado com o menor e a reserva elegível juntos… |
| o menor que cai sem sair devolve a vaga dele, e a do principal, que o 429 gastou, fica | U | a vaga é a da chamada que caiu | o acerto no balde do menor, e nenhum no do principal | llm-gateway.test.ts › o menor que cai sem sair (o disjuntor aberto) devolve a vaga dele ao balde… |
| a reserva com o balde dela fechado, no molde do prazo: termina `sem_vaga` aos 20 s, sem esperar e sem chamá-la | I | o prazo com o balde da reserva fechado (a recomendação do `llm-integrator`, 6.0) | o balde do principal aberto e o da reserva que nunca abre | prazo-com-tokens.int.test.ts › a reserva com o balde dela fechado… |
| a quarta chamada na reserva estoura o prazo, com os dois baldes abertos, cada um o seu | I | o balde da reserva aberto no caso da 6.0 (a recomendação do `infra-guardian`, 6.0) | o `limiteDeTokensDaReserva` injetado | prazo-com-tokens.int.test.ts › a quarta chamada, na reserva, estoura o prazo da execução… |

## Como testar

- `llm-gateway.test.ts` › "degrau 2: passados os 8 s sem vaga, vai ao modelo menor do perfil…" e › "degrau 3: sem vaga no principal nem no
  menor, termina IA_INDISPONIVEL aos 8 s…" (o balde falso e o relógio): acrescente o limitador da reserva
- `llm-gateway.test.ts` › "sem modelo menor configurado para o perfil, o degrau é pulado e a métrica dele não muda"
- Balde: `token-limiter.test.ts` › "o balde é de cada provedor:modelo: o menor tem o seu"
- Alerta: `infra/test/alertas.test.ts`, o bloco do `provedorFora` (`expressao`), para o de tokens
- `npx vitest run --project unidade packages/core/src/ia/llm-gateway.test.ts`
- Armadilha: o `usosDoTeto` de hoje é por modelo; os dois falsos têm o mesmo modelo, e é esse o caso que distingue

## Fora do escopo desta tarefa

A carga (9.0).

## Autoconferência

Respondidas no plano antes de codar.

1. **Mutação de cada cláusula:** a seção "Mutações" tem um bloco por termo das linhas novas de `llm-gateway.ts` que o `--faltando` lista (`isLimite`, `reservaParaOErro`, `reservaDoPedido`, `vagaDoAlvo`, `reservarNaReserva`, `semVaga`, o `desceAoMenor`, o `descerPorLimite`, `anotarUsoDoTeto` e o gauge), mais os que ele não vê: as duas chamadas de `devolverAVaga` (sem condição, mas protegem a vaga), o `correcao = undefined` do desvio por falta de vaga, e a escolha do limitador e da identidade na chave do balde da reserva.
2. **Texto na tela:** não toca tela nem texto de `apps/web`; o painel do Grafana (`fundacao.json`) só troca a consulta e o título, e nenhum `e2e/` cita o título (`grep`).
3. **O que distingue está no teste:** o balde da reserva e o do principal são dois `LimiteDeMentira` diferentes, e o caso do menor com a reserva elegível prova que a reserva não é consultada (`pedidos` vazio); o mesmo caso com o balde da reserva aberto e fechado; o Tutor e a geração no mesmo gateway; o 5xx e o `limite` com o menor configurado; os dois falsos com o mesmo modelo e duas séries.
4. **Checagem anterior que responde antes:** a reserva dos casos é elegível de verdade (`reservaElegivel`, com a D62 conferida e a aprovação por tarefa, provedor e modelo); o prazo roda pelo `ResilientAdapter` real e pelo `prazoPorTemporizador`.
5. **Asserção olha o resultado:** saída, erro tipado (`motivo`, `semEnvio`, `tenteDeNovoEmSegundos`), linhas de consumo na ordem, pedidos e acertos por balde, a métrica lida pelo `MedidorDeTeste` e a expressão do yaml; nenhuma sobre texto de arquivo.
6. **Guarda nova:** nenhuma. O teste de alertas ganha o caso do agrupamento (lê a `expressao` do yaml).
7. **Comentário que afirma o que o código não faz:** o de `prazo-da-execucao.ts`, o de `docs/infra.md` ("O balde da reserva") e o de `errors.ts` dizem que a reserva reserva sem esperar e que o `sem_vaga` é o último degrau; os casos do prazo (aos 20 s, sem a espera) e o do balde fechado os provam.
8. **Divergência:** uma, abaixo (a reserva não espera pela vaga).
9. **Peça que já existe:** `LimiteDeMentira`, `ReservaRoteirizada`, `daReserva`, `aprovada`, `principalRoteirizado`, `MedidorDeTeste` (llm-gateway.test.ts) e `LimiteNoRelogio`, `LentoAdapter` (prazo-com-tokens.int.test.ts, estendidos com o limitador da reserva). O `TokenLimiter` não muda: o balde já é por `provedor:modelo` (`token-limiter.test.ts`).
10. **Concorrência:** os casos com relógio falso são de uma execução só; o balde real e as réplicas são do `token-limiter.int.test.ts` e da carga (9.0).
11. **Isolamento entre escolas:** não cria repository, query nem endpoint; o balde da reserva é de todas as escolas, como o do principal, e `docs/infra.md` o diz.
12. **Guardiões:** `llm-integrator` (a reserva só pela porta, com perfil e orçamento, a saída conferida), `infra-guardian` (regra 80, item 4: o limitador, a degradação, o prazo e o alerta por `provedor` e `modelo`), `conformidade-reviewer` (D36: o Tutor e a classificação nunca no menor; só a reserva aprovada), `privacy-guardian` (o log só com ids e modelo), `tenancy-guardian` (sem query nova).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| A reserva **não espera** pela vaga: uma tentativa só no balde dela, nos três caminhos (queda, 429 e falta de vaga) | A spec diz "sem vaga ali, `IA_INDISPONIVEL`, `sem_vaga`", e não diz se a reserva espera os 8 s. O principal já esperou, e na queda não há o que esperar dentro do prazo da execução; esperar de novo somaria até 16 s ao pior caso do Tutor | `techspec.md` §5, "A vaga da reserva (7.0)"; `cenarios.md` §1 RF3 (a linha "Sem vaga no principal: o provedor de reserva usa o balde dele", com "uma tentativa só, sem a espera de 8 s"; e a do 429, a reserva passa a ser da 7.0); `docs/infra.md` 5.4, "O balde da reserva"; `prazo-da-execucao.ts` |

## Mutações

`--faltando: 0 linhas (0 blocos, 0 motivos)`

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o uso do teto é o da última reserva do modelo
-for (const uso of usosDoTeto.values()) observador.observe(agora - uso.em < VALIDADE_DO_USO_DO_TETO_MS ? uso.valor : 0, { provedor: uso.provedor, modelo: uso.modelo })
+for (const uso of usosDoTeto.values()) observador.observe(uso.valor, { provedor: uso.provedor, modelo: uso.modelo })
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o uso do teto sai por
-for (const uso of usosDoTeto.values()) observador.observe(agora - uso.em < VALIDADE_DO_USO_DO_TETO_MS ? uso.valor : 0, { provedor: uso.provedor, modelo: uso.modelo })
+for (const uso of usosDoTeto.values()) observador.observe(agora - uso.em < VALIDADE_DO_USO_DO_TETO_MS ? uso.valor : 0, { modelo: uso.modelo })
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › não é o `limite` do provedor
-return erro instanceof LLMError && erro.codigoDeIa === 'IA_INDISPONIVEL' && erro.motivo === 'limite'
+return erro.codigoDeIa === 'IA_INDISPONIVEL' && erro.motivo === 'limite'
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › não é o `limite` do provedor
-return erro instanceof LLMError && erro.codigoDeIa === 'IA_INDISPONIVEL' && erro.motivo === 'limite'
+return erro instanceof LLMError && erro.motivo === 'limite'
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o 5xx do principal, com o menor configurado, vai à reserva
-return erro instanceof LLMError && erro.codigoDeIa === 'IA_INDISPONIVEL' && erro.motivo === 'limite'
+return erro instanceof LLMError && erro.codigoDeIa === 'IA_INDISPONIVEL'
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › sem vaga no principal e no menor: depois dos 8 s vai à reserva
 const vaga = await this.vagaDoAlvo(pedido, entrada, correcao, alvo)
-if (faltouVaga(vaga)) {
+if (false as boolean) {
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › degrau 3: sem vaga no principal nem no menor
 const reserva = this.reservaDoPedido(pedido, alvo)
-if (reserva === undefined) throw this.semVaga(pedido, alvo, vaga.msAteLiberar)
+if (reserva === undefined) throw new LLMError('IA_INDISPONIVEL')
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › sem vaga no principal e no menor: depois dos 8 s vai à reserva
 if (reserva === undefined) throw this.semVaga(pedido, alvo, vaga.msAteLiberar)
-this.desviarParaAReserva(pedido, reserva)
 return reserva
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › a repetição que fica sem vaga no principal vai à reserva
 alvo = this.reservaOuFimSemVaga(pedido, alvo, vaga)
-correcao = undefined
 continue
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › disjuntor do principal aberto: a saída e a única linha
-return isQueda(erro) || isLimite(erro) ? this.reservaDoPedido(pedido, alvo) : undefined
+return isLimite(erro) ? this.reservaDoPedido(pedido, alvo) : undefined
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o 429 que sobra, com o menor também sem vaga ou também recusando
-return isQueda(erro) || isLimite(erro) ? this.reservaDoPedido(pedido, alvo) : undefined
+return isQueda(erro) ? this.reservaDoPedido(pedido, alvo) : undefined
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › sem reserva configurada a queda do principal termina como na X6
-if (reserva === undefined || alvo.peloProvedorDeReserva || pedido.sinal?.aborted === true) return undefined
+if (alvo.peloProvedorDeReserva || pedido.sinal?.aborted === true) return undefined
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › os dois fora: uma chamada à reserva
-if (reserva === undefined || alvo.peloProvedorDeReserva || pedido.sinal?.aborted === true) return undefined
+if (reserva === undefined || pedido.sinal?.aborted === true) return undefined
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o prazo estourado com o sinal da execução vivo vai à reserva
-if (reserva === undefined || alvo.peloProvedorDeReserva || pedido.sinal?.aborted === true) return undefined
+if (reserva === undefined || alvo.peloProvedorDeReserva) return undefined
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › sem vaga no principal e no menor: depois dos 8 s vai à reserva
-return alvo.peloProvedorDeReserva ? await this.reservarNaReserva(pedido, entrada, correcao, alvo) : await this.reservarVaga(pedido, entrada, correcao)
+return await this.reservarVaga(pedido, entrada, correcao)
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › sem vaga no principal e no menor: depois dos 8 s vai à reserva
-const limite = this.dependencias.limiteDeTokensDaReserva
+const limite = this.dependencias.limiteDeTokens
 if (limite === undefined) return {}
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › disjuntor do principal aberto: a saída e a única linha
 const limite = this.dependencias.limiteDeTokensDaReserva
-if (limite === undefined) return {}
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › sem vaga no principal e no menor: depois dos 8 s vai à reserva
-const resultado = await limite.reservar(this.chaveDoBalde(identidade, modelo), this.estimativaDoPedido(pedido, entrada, correcao), pedido.fila ?? 'normal')
+const resultado = await limite.reservar(this.chaveDoBalde(this.dependencias.adaptador.identidade, modelo), this.estimativaDoPedido(pedido, entrada, correcao), pedido.fila ?? 'normal')
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › sem vaga no principal e no menor: depois dos 8 s vai à reserva
-const resultado = await limite.reservar(this.chaveDoBalde(identidade, modelo), this.estimativaDoPedido(pedido, entrada, correcao), pedido.fila ?? 'normal')
+const resultado = await limite.reservar(this.chaveDoBalde(identidade, modelo), this.estimativaDoPedido(pedido, entrada, correcao), 'normal')
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › sem vaga também na reserva
-return resultado.concedida ? { reserva: resultado.reserva } : { semVaga: true, msAteLiberar: resultado.msAteLiberar }
+return { reserva: resultado.concedida ? resultado.reserva : undefined }
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › sem vaga também na reserva
-this.descer('indisponivel', pedido.tarefa.nome, (alvo.peloProvedorDeReserva ? undefined : this.modeloMenorDaTarefa(pedido)) ?? doDestino)
+this.descer('indisponivel', pedido.tarefa.nome, this.modeloMenorDaTarefa(pedido) ?? doDestino)
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › aprovação só da geração, principal sem vaga e sem menor
-this.descer('indisponivel', pedido.tarefa.nome, (alvo.peloProvedorDeReserva ? undefined : this.modeloMenorDaTarefa(pedido)) ?? doDestino)
+this.descer('indisponivel', pedido.tarefa.nome, (alvo.peloProvedorDeReserva ? undefined : this.modeloMenorDaTarefa(pedido)) ?? undefined)
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › a reserva que recusa por `limite` não desce ao modelo menor
-const desceAoMenor = !alvo.peloProvedorDeReserva && isLimite(erro) && vaga.modelo === undefined
+const desceAoMenor = isLimite(erro) && vaga.modelo === undefined
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o 5xx do principal, com o menor configurado, vai à reserva
-const desceAoMenor = !alvo.peloProvedorDeReserva && isLimite(erro) && vaga.modelo === undefined
+const desceAoMenor = !alvo.peloProvedorDeReserva && vaga.modelo === undefined
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o menor que já era o modelo da chamada e recebe o 429
-const desceAoMenor = !alvo.peloProvedorDeReserva && isLimite(erro) && vaga.modelo === undefined
+const desceAoMenor = !alvo.peloProvedorDeReserva && isLimite(erro)
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o 429 que sobra, com o menor também sem vaga ou também recusando
-const menor = desceAoMenor ? await this.descerPorLimite(pedido, entrada, correcao, this.reservaParaOErro(pedido, erro, alvo) !== undefined) : undefined
+const menor = undefined
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o 429 que sobra, com o menor também sem vaga ou também recusando
-const menor = desceAoMenor ? await this.descerPorLimite(pedido, entrada, correcao, this.reservaParaOErro(pedido, erro, alvo) !== undefined) : undefined
+const menor = desceAoMenor ? await this.descerPorLimite(pedido, entrada, correcao, false) : undefined
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o 429 do Tutor com o balde da reserva também cheio
-if (menor === undefined) {
+if (false as boolean) {
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › queda do principal: a reserva reserva no balde dela
 if (menor === undefined) {
 // A vaga do principal que caiu sem sair volta ao balde; a do 429 (que saiu) fica com a estimativa.
-await this.devolverAVaga(vaga, erro)
 throw erro
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o menor que cai sem sair
-await this.devolverAVaga(menor, erroDoMenor)
+await this.devolverAVaga(vaga, erroDoMenor)
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › degrau 3: sem vaga no principal nem no menor
-return (await this.reservarOMenor(pedido, estimativa, fila, limite)) ?? { semVaga: true, msAteLiberar }
+return (await this.reservarOMenor(pedido, estimativa, fila, limite)) ?? {}
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › sem vaga no principal, com o menor disponível e a reserva elegível
-return (await this.reservarOMenor(pedido, estimativa, fila, limite)) ?? { semVaga: true, msAteLiberar }
+return { semVaga: true, msAteLiberar }
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o 429 que sobra, com o menor também sem vaga ou também recusando
-if (vaga === undefined && !haReserva) this.descer('indisponivel', pedido.tarefa.nome, this.dependencias.adaptador.modeloDoPerfil(pedido.tarefa.perfil))
+if (vaga === undefined) this.descer('indisponivel', pedido.tarefa.nome, this.dependencias.adaptador.modeloDoPerfil(pedido.tarefa.perfil))
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o 429 que o menor atende, sem reserva configurada
-if (vaga === undefined && !haReserva) this.descer('indisponivel', pedido.tarefa.nome, this.dependencias.adaptador.modeloDoPerfil(pedido.tarefa.perfil))
+if (!haReserva) this.descer('indisponivel', pedido.tarefa.nome, this.dependencias.adaptador.modeloDoPerfil(pedido.tarefa.perfil))
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › a recusa que não traz o uso do geral
-if (uso !== undefined) this.usosDoTeto.set(this.chaveDoBalde(provedor, modelo), { valor: uso, em: horaDoProcessoMs(), provedor, modelo })
+this.usosDoTeto.set(this.chaveDoBalde(provedor, modelo), { valor: uso as number, em: horaDoProcessoMs(), provedor, modelo })
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o uso do teto sai por
-if (uso !== undefined) this.usosDoTeto.set(this.chaveDoBalde(provedor, modelo), { valor: uso, em: horaDoProcessoMs(), provedor, modelo })
+if (uso !== undefined) this.usosDoTeto.set(modelo, { valor: uso, em: horaDoProcessoMs(), provedor, modelo })
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › a reserva que cai sem sair
 // A vaga do principal que caiu sem sair volta ao balde; a do 429 (que saiu) fica com a estimativa.
-await this.devolverAVaga(vaga, erro)
+if (!alvo.peloProvedorDeReserva) await this.devolverAVaga(vaga, erro)
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (1ª) | Incluir o balde da reserva no item do `TODO.md` da parte por escola do balde | `TODO.md`, no item da parte por escola do balde de tokens (disponibilidade, não vazamento; só importa com mais de uma escola de carga real). Quem escreve é o Orquestrador na retro: o arquivo não é da tarefa |
| privacy-guardian (1ª) | `ia.geracao.sem_vaga` levar `escolaId` e `execucaoId` | `TODO.md`, camada-ia: muda o campo de `descer` (a assinatura ganharia o pedido) e a revisão disse "Não é falta de privacidade". Hoje o `desviarParaAReserva` já os leva, e o consumo liga o fim à linha |
| infra-guardian (1ª) | `tenteDeNovoEmSegundos` do `sem_vaga` usar o menor dos dois `msAteLiberar` (principal e reserva) | `TODO.md`, camada-ia: muda o valor devolvido ao lote (comportamento); fica para a carga (9.0) provar se o adiamento excessivo aparece |
| infra-guardian (1ª) | A carga (9.0) precisa do cenário do balde do principal cheio às 10h com transbordo, e do caso da reserva no mesmo provedor | Tarefa 9.0 (`9_task.md`): é o escopo dela; o Orquestrador confere ao abrir a 9.0 |
| llm-integrator (1ª) | O custo da reserva por escola/mês ainda não tem número | `docs/avaliacao-de-modelos.md`, na avaliação de provedor (D29, D37): precisa da tabela de preço do contrato, que a tarefa não tem |
| llm-integrator (1ª), test-engineer (1ª) | Enxugar o caso do agrupamento em `infra/test/alertas.test.ts` (as séries à mão não acrescentam prova) | Recusada: os dois revisores dizem que é inofensivo e que a prova é o `agrupaPor` igual a `['provedor','modelo']`, mantido; tirar as séries não muda o que o teste distingue |
| tenancy-guardian (2ª) | Conferir que o balde da reserva entrou no item do `TODO.md` da parte por escola do balde de tokens | `TODO.md`, o item já destinado na tabela da 1ª rodada (a escrita é do Orquestrador na retro) |
| privacy-guardian (2ª) | Uma frase no runbook dizendo que a saída inválida da primeira chamada à reserva, descartada, já saiu para o provedor e aparece no compartilhamento pela linha `falhou` da reserva | `TODO.md`, camada-ia (texto de runbook; o envio já está registrado na linha de consumo, e a pergunta "para onde foi" é respondida por ela) |
| conformidade-reviewer (2ª), infra-guardian (2ª), revisor-geral (2ª), test-engineer (2ª) | O título do caso "a D62 da reserva vale nos três caminhos" promete três e o corpo cobre dois (a queda está no caso da 4.0) | `TODO.md`, camada-ia (título de teste; os dois ramos e a queda estão provados, cada um pelo seu caso) |
| llm-integrator (2ª), revisor-geral (2ª), test-engineer (2ª) | O comentário de `llm-gateway.ts` ("A vaga do principal que caiu sem sair volta ao balde", linha 620) devia dizer "do destino"; trocar junto as linhas de contexto das mutações 37 e a de `7_task.md:318` e `:375` | `TODO.md`, camada-ia (comentário em `.ts`; mexer caducaria o `revisor-geral` e exigiria acertar as linhas de contexto das Mutações, sem mudar comportamento) |
| test-engineer (2ª) | Caso da repetição da reserva sem vaga também na fila `lote`, para provar que a linha da primeira chamada à reserva fica gravada quando o `sem_vaga` adia o job (`gasto.chamadas.length > 0`, `llm-gateway.ts:374`) | `TODO.md`, camada-ia; ou a 9.0 (carga), que roda a fila `lote` |
| llm-integrator (2ª), infra-guardian (2ª) | O que já estava destinado na 1ª rodada (o custo da reserva por escola/mês, o `tenteDeNovoEmSegundos` pelo menor dos dois baldes, `escolaId` e `execucaoId` no log do `sem_vaga`, o cenário de carga do transbordo na 9.0) | Mesmos destinos da tabela da 1ª rodada, já em `7_task.md` e no `TODO.md` |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-22 19:40:19 | 2026-11-22 19:40:41 | `tenancy-guardian` | 1 | APROVADO | ab1696feb42b317c3 |
| 2026-11-22 19:40:21 | 2026-11-22 19:41:00 | `privacy-guardian` | 1 | APROVADO | ae3fd2e96b01ac8fb |
| 2026-11-22 19:40:23 | 2026-11-22 19:41:08 | `conformidade-reviewer` | 1 | APROVADO | a7143d8cca001565d |
| 2026-11-22 19:40:27 | 2026-11-22 19:41:11 | `llm-integrator` | 1 | APROVADO | a4582e67b56f6776f |
| 2026-11-22 19:40:25 | 2026-11-22 19:41:25 | `infra-guardian` | 1 | APROVADO | a9b1669aecf14a865 |
| 2026-11-22 19:40:31 | 2026-11-22 19:42:11 | `revisor-geral` | 1 | APROVADO | a86827bb79a30301c |
| 2026-11-22 19:40:29 | 2026-11-22 19:43:18 | `test-engineer` | 1 | APROVADO | a388b955e094d2e89 |
| 2026-11-22 20:03:39 | 2026-11-22 20:03:59 | `tenancy-guardian` | 2 | APROVADO | ad730244e27344732 |
| 2026-11-22 20:03:59 | 2026-11-22 20:04:27 | `llm-integrator` | 2 | APROVADO | a89b0c791bbde184a |
| 2026-11-22 20:03:44 | 2026-11-22 20:04:30 | `privacy-guardian` | 2 | APROVADO | a7c20702e6265285c |
| 2026-11-22 20:03:49 | 2026-11-22 20:04:30 | `conformidade-reviewer` | 2 | APROVADO | a2087742c023872b6 |
| 2026-11-22 20:03:54 | 2026-11-22 20:04:34 | `infra-guardian` | 2 | APROVADO | ab97a9c4218baf2b6 |
| 2026-11-22 20:04:10 | 2026-11-22 20:04:46 | `revisor-geral` | 2 | APROVADO | a72bf44e327175fb6 |
| 2026-11-22 20:04:05 | 2026-11-22 20:05:40 | `test-engineer` | 2 | APROVADO | ae5461374a1936139 |
