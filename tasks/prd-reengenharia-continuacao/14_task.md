# Tarefa 14.0 — Com o Redis fora, o segundo fator e a escolha de escola pedem para tentar de novo, sem gastar tentativa (54.0)

**Funcionalidade:** reengenharia-continuacao · **Depende de:** nenhuma
**Subagentes obrigatórios:** `infra-guardian`, `tenancy-guardian`, `frontend-reviewer`
**Porte:** grande

## Objetivo

Com o Redis de fila fora, o desafio da escola responde `503 INDISPONIVEL_TENTE_DE_NOVO` com `Retry-After` (hoje, `401
NAO_AUTENTICADO`), e nenhuma tentativa é gasta: `conferirLivre` vem antes de qualquer reserva. A web espera o `Retry-After`
uma vez, até 10 s, com o botão desabilitado e um aviso em `role="status"`; acima disso, ou num segundo `503`, mostra o
`ErrorState`. O seletor mantém a escola escolhida.

## Contexto necessário

- `techspec.md` §4 (última frase), §5 "O Redis fora (54.0)"
- `prd.md` RF13; §7 ("O Redis cai às 7h30…")
- `tasks/prd-reengenharia/onda-3c.md` "RF22 — N3 (54.0)"
- `.claude/rules/` 10 (item 6), 40, 50, 80 (itens 1, 5)
- Código: `apps/api/src/credencial/challenge.ts` (`conferirLivre` l.168, `consumir`, `#semRedis` l.195); o igual do
  operador, `apps/api/src/operacao/operador-challenge.ts` (l.119 e `#semRedis` l.144, com `DEFAULT_RETRY_AFTER_SECONDS`);
  os chamadores `apps/api/src/sessao/mfa/mfa.service.ts` e `apps/api/src/sessao/troca-de-escola/troca-de-escola.service.ts`;
  na web, `ApiError.esperaSegundos` (`apps/web/src/api/client.ts:13`, já lido), `apps/web/src/pages/Mfa.tsx`,
  `apps/web/src/pages/EscolherEscola.tsx`, `apps/web/src/components/SeletorDeEscola.tsx`

## Subtarefas

- [x] 14.1 — `#semRedis` devolve `INDISPONIVEL_TENTE_DE_NOVO` com `Retry-After`, como o do operador; nos dois serviços,
  `conferirLivre` antes de qualquer reserva do `LoginLockout`
- [x] 14.2 — Na web, uma espera única pelo `Retry-After` (até 10 s) no segundo fator, na escolha de escola da entrada e no
  seletor: botão desabilitado, "Tentando de novo em instantes" em `role="status"` (a contagem `aria-hidden`); segundo `503`
  ou `Retry-After` acima de 10 s: `ErrorState`, sem nova espera
- [x] 14.3 — `docs/interface.md`: o aviso na entrada e no seletor (o `docs/runbook.md` não cita o 401 do desafio; se a busca achar, é divergência)
- [x] 14.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/pages/espera-do-indisponivel.ts`, `apps/web/src/pages/espera-do-indisponivel.test.ts` | novo |
| `apps/api/src/credencial/challenge.ts`, `apps/api/src/sessao/mfa/mfa.service.ts`, `apps/api/src/sessao/troca-de-escola/troca-de-escola.service.ts`, `apps/api/test/mfa.int.test.ts`, `apps/api/test/troca-de-escola.int.test.ts`, `apps/api/test/password-attack.int.test.ts`, `apps/web/src/pages/Mfa.tsx`, `apps/web/src/pages/EscolherEscola.tsx`, `apps/web/src/components/SeletorDeEscola.tsx`, `apps/web/src/components/SeletorDeEscola.test.tsx`, `e2e/entrar-na-escola.spec.ts`, `docs/interface.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| segundo fator, Redis fora | I | `503 INDISPONIVEL_TENTE_DE_NOVO` com `Retry-After`; o contador do `insuranceLimiter` do `LoginLockout` sem tentativa gasta. Mutação: reservar antes de `conferirLivre` | `mfa.int.test.ts` › falha (54.0): com o Redis de fila fora, o segundo fator dá 503 (seis códigos errados e o certo, todos 503, nunca `CONTA_SEGURADA`; `proporcaoDoSeguro` do `LoginLockout` em 0; o passo não andou) |
| escolha de escola, Redis fora | I | o mesmo, na troca de escola | `troca-de-escola.int.test.ts` › falha (54.0): com o Redis de fila fora, escolher dá 503 (a própria escola, a de outra conta e o inexistente; nenhuma sessão gravada) |
| Redis de volta | I | a tentativa seguinte entra de fato (sessão emitida, escola escolhida) | os dois acima, na última parte: o mesmo desafio entra com o Redis de volta (`etapa: pronta`, e `sessaoUnica` na escolha) |
| Redis que recusa o comando | I | conectado e recusando: o mesmo 503 | `mfa.int.test.ts` › falha (54.0): com o Redis de fila conectado e recusando o comando (`ReplyError` do `ioredis` em `exists`); `challenge.int.test.ts` e `password-attack.int.test.ts` › falha (15.5) (travado, conectado): 503 |
| Redis que cai depois do código certo | I | `503 TEMPO_ESGOTADO` (não o que manda repetir), o código gasto, nenhuma sessão; o código seguinte entra; o código de recuperação usado não volta; o desafio já marcado segue 401 | `mfa.int.test.ts` › falha (54.0): o Redis de fila recusa o `consumir` depois do código certo…; › o mesmo com o código de recuperação…; › o desafio já marcado como usado depois do código certo continua 401…; `messages.test.ts` › 54.0: o código possivelmente gasto… (o texto não afirma que o código estava certo) |
| o prazo estourado no navegador | U | o `TEMPO_ESGOTADO` de `origem: 'cliente'` (a resposta não chegou) mostra o texto geral, e não o do código gasto; a web não sabe se o código foi conferido | `espera-do-indisponivel.test.ts` › o prazo estourado no navegador, sem resposta da API… (o `fetch` fica no ar até o prazo da chamada abortar) |
| desafio forjado, Redis fora | I | continua 401: o 503 só vale para o desafio que valia | `mfa.int.test.ts` e `troca-de-escola.int.test.ts` › falha (54.0): com o Redis de fila fora… (o desafio com a assinatura trocada) |
| recusa do comando na escolha | I | conectado e recusando (`ReplyError` em `exists`): o mesmo 503, sem sessão, e a escolha seguinte entra | `troca-de-escola.int.test.ts` › falha (54.0): com o Redis de fila conectado e recusando o comando… |
| erro da repetição | U | a resposta atrasada da repetição, com erro e com a tela fora, não apaga o desafio de quem entrou depois; a chamada trocada não para a contagem da nova | `espera-do-indisponivel.test.ts` › recomeço: a resposta atrasada da repetição, com erro…; › a chamada que outra já trocou… |
| a falha é de quem trocou | U | com a pessoa (ou o desafio) da aba outra, o `ErrorState` some, e "Tentar de novo" não manda a escolha de quem saiu | `SeletorDeEscola.test.tsx` › a falha é de quem trocou…; `espera-do-indisponivel.test.ts` › recomeço: com o ErrorState na tela, o desafio da aba… (dois casos) |
| isolamento | I | o desafio de outra escola, com o Redis fora: a mesma resposta do inexistente, sem confirmar que existe | `troca-de-escola.int.test.ts` › falha (54.0) (o corpo do usuário de outra conta é igual ao do inexistente, e igual ao da própria escola) |
| espera única | U | `Retry-After: 3`: botão desabilitado, `role="status"` com "Tentando de novo em instantes", uma nova tentativa | `apps/web/src/pages/espera-do-indisponivel.test.ts` › Retry-After: 3 desabilita o botão…; › espera o Retry-After uma vez, com os botões desabilitados…; `SeletorDeEscola.test.tsx` › espera o Retry-After uma vez com a lista aberta |
| segundo 503 | U | `ErrorState`, sem nova espera | `apps/web/src/pages/espera-do-indisponivel.test.ts` › o segundo 503 vai ao ErrorState, sem nova espera (Mfa e escolha); `SeletorDeEscola.test.tsx` › o segundo 503 vai ao ErrorState: a lista segue aberta |
| o limite de 10 s | U | `Retry-After: 10` espera; `Retry-After: 11` vai direto ao `ErrorState` | `apps/web/src/pages/espera-do-indisponivel.test.ts` › o limite: Retry-After de 10 s espera…; › Retry-After de 11 s vai direto ao ErrorState…; › o Retry-After até 10 s vale; `SeletorDeEscola.test.tsx` › o limite de 10 s |
| o seletor | U | a escola escolhida continua marcada durante a espera e depois | `SeletorDeEscola.test.tsx` › espera o Retry-After uma vez com a lista aberta (a linha escolhida em "Abrindo …", `aria-current` na de agora) e › o segundo 503 vai ao ErrorState: a lista segue aberta |
| recomeço | U | a segunda pessoa na mesma aba não herda o aviso; a mesma entrada de novo começa sem espera; a resposta atrasada da tentativa anterior não muda a tela; a falha tira o aviso e o foco volta ao botão | `apps/web/src/pages/espera-do-indisponivel.test.ts` › recomeço: a segunda pessoa na mesma aba…; › depois do segundo 503, "Tentar de novo" sai na hora…; › a resposta atrasada da tentativa anterior…; › a resposta atrasada da repetição…; › o segundo 503 vai ao ErrorState… (aviso fora, foco no botão); e os de desafio trocado e de tela que sai |
| 1366 × 768 e 360 px | E | `/entrar` e o seletor com o aviso: `paginaNaoRola`; sem rolagem horizontal, 44 px, axe. O 503 vem de `page.route` | `e2e/entrar-na-escola.spec.ts` › com o Redis de fila fora: o segundo fator, a escolha de escola e o seletor esperam uma vez (três casos, nos dois projetos) |
| log | I | o aviso do Redis fora sai uma vez, sem matrícula, e-mail nem desafio | `mfa.int.test.ts` › falha (54.0): com o Redis de fila fora… (sete recusas, uma linha `login.desafio_sem_redis`); o log sem segredo é o caso de privacidade do fim do arquivo; `challenge.int.test.ts` › falha (15.5) (uma chamada só) |

## Como testar

- API: `apps/api/src/operacao/operador-challenge.test.ts` › "Redis desconectado e Redis que recusa o comando: 503 com
  Retry-After, e o aviso `operacao.desafio_sem_redis` sai uma vez só…"; o caso que muda: `apps/api/test/mfa.int.test.ts` ›
  "falha: com o Redis de fila fora, o desafio de mfa é recusado com NAO_AUTENTICADO…" (l.754); o seguro:
  `apps/api/test/password-attack.int.test.ts` (l.575)
- Web: a espera do operador em `apps/web/src/operacao/api/sessao.ts` (l.46 e l.375) e `apps/web/src/pages/retry-with-backoff.ts`
  (`esperaDoReenvio`)
- Comandos: `npx vitest run --project integracao apps/api/test/mfa.int.test.ts`; `node tools/ci/e2e.ts --manter-ambiente e2e/entrar-na-escola.spec.ts`
- **Telas:** sem papel, `/entrar` no segundo fator e na escolha de escola com o 503; `coordenacao`, o seletor de escola aberto

## Autoconferência

As 12 perguntas do modelo, no plano. Na 4: o caso do Redis fora para o Redis de fato, e o dublê lança o erro do `ioredis`.
Na 2: `grep -rln 'Tentando de novo' e2e/`.

**Respostas do plano (as 12 perguntas):**

1. As cláusulas do diff e a mutação de cada uma estão na seção "Mutações" (36 blocos, `--faltando` zerado). A chamada que confere antes (`conferirLivre`) tem o bloco nos dois serviços.
2. `grep -rn 'Tentando de novo' e2e/` acha `components-states`, `esqueci-a-senha`, `turma-publica` e `casca` (o "Tentando de novo…" do `ErrorState` e da fila da sala), todos em telas que a tarefa não toca e com o texto exato com reticências; "Tentando de novo em instantes" é texto novo, e só o `entrar-na-escola.spec.ts` o conta (rodado isolado). O `ErrorState` não mudou.
3. O segundo dado: no isolamento, o usuário de outra conta e o inexistente, com o Redis fora; no seletor, duas escolas (a de agora e a escolhida); no segundo fator, o desafio da pessoa A e o da B na mesma aba.
4. O caso do Redis fora usa o Redis de verdade parado (`composeOuFalha('stop', 'redis-fila')`) no segundo fator e na escolha; o do comando recusado usa o `ReplyError` que o `ioredis` lança, em `exists` do cliente real, conectado. Nenhum caminho anterior responde antes: o desafio vale, o código é certo e o `conferirLivre` é a primeira chamada.
5. As asserções olham a resposta (503, `Retry-After`, `proporcaoDoSeguro`, o passo no banco, as sessões, o corpo igual) e a tela (botão desabilitado, texto do `status`, `ErrorState`, foco, número de pedidos depois de esperar o relógio falso), e a asserção de ausência (nenhum pedido a mais) espera o relógio passar do `Retry-After` antes.
6. Nenhuma guarda nova.
7. Os comentários de `challenge.ts`, `mfa.service.ts` e `troca-de-escola.service.ts` dizem o 503; o do `docs/runbook.md` foi corrigido (divergência 1).
8. A divergência do runbook ganhou a linha na `techspec.md` §5 e no `cenarios.md` §7; o `prd.md` (RF13, §7) não diz o contrário.
9. `OperadorChallengeConsumer` e `DEFAULT_RETRY_AFTER_SECONDS` do `core` são a peça do operador, reaproveitada pelo nome; a espera da web reaproveita o piso `ESPERA_MINIMA_NO_503_MS` e `ErrorState`. `esperaDoReenvio` (a reivindicação) tem outra regra (três reenvios com variação) e não serve.
10. A corrida: o desafio que muda durante a espera, a tela que sai durante a espera, a resposta atrasada da primeira tentativa e da repetição, cada uma com a resposta segurada (`rede.segurar()`) e o relógio falso. Na API, o desafio que não se gasta na queda é provado pelo mesmo desafio entrando depois.
11. O isolamento da escolha não depende de cláusula de repository (a conferência é a primeira chamada); sem `conferirLivre` o usuário de outra conta dá 404 e a própria escolha dá 503 só no `consumir` (bloco 4). Cada linha da tabela tem o caso na coluna "Caso".
12. O e2e do portão mede os casos alterados contra 15 s: os de segundo fator e de escolha usam login falso, e o do seletor entra pela API (`entrarPelaApiSemMedirAPrimeiraCarga`), com `Retry-After` de 2 s.

## Fora do escopo desta tarefa

O prazo das chamadas (12.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| `docs/runbook.md` ("Seguro de limite ativo", causa 4) cita o 401 do desafio sem Redis e o "volta ao login": a subtarefa 14.3 diz que achar isso é divergência. Passa a dizer 503 com `Retry-After` e a espera única da tela (três trechos) | O texto contradiria o código no mesmo commit; o runbook conta como código e caduca o carimbo (`DOCUMENTO_QUE_UMA_SUITE_LE`), e a edição vem antes dos revisores | `techspec.md` §5 "O Redis fora (54.0)"; `cenarios.md` §7 (o [I] do Redis fora); documento da seção 11: `docs/runbook.md` |
| Arquivos de teste e de apoio fora dos "Arquivos previstos", que o 503 faz quebrar: `apps/api/src/credencial/challenge.int.test.ts` (três casos esperavam o `NAO_AUTENTICADO` do Redis fora) e `e2e/support/casca.ts` (`ativarOSegundoFator` e `digitarOCodigoDaEntrada` repetem a recusa do desafio, que agora pode vir como o aviso do 503) | "Lista fechada" e "Quem usa o que mudou" do `executar-task`: o teste que enumera o comportamento antigo se atualiza na tarefa que o muda | `cenarios.md` §7 (o [I] do Redis fora) |
| A região de status, `AvisoDaEspera`, mora em `espera-do-indisponivel.ts` (com `createElement`), e a falha de cada tela é uma peça pequena do próprio arquivo (`FalhaDoSegundoFator`, `FalhaDaEscolha`, `FalhaDaTroca`) | O lint limita a complexidade a 10 e as três telas escrevem o aviso igual; um `.tsx` novo seria peça nova do catálogo (`docs/interface.md` 10.2) sem o PRD pedir | `techspec.md` §5 "O Redis fora (54.0)" |
| Os três casos de e2e entram em `e2e/entrar-na-escola.spec.ts`, como o documento prevê, mas o do segundo fator e o da escolha vêm de um login falso (`page.route` em `POST /v1/sessao/email`), sem usuário no banco; o do seletor usa uma professora de verdade em duas escolas | O 503 é de `page.route` pela própria linha da tarefa; entrar pela tela como coordenação passaria de metade do prazo do caso (hash, segundo fator, CPU ×4) | `cenarios.md` §7 (o [E] do 54.0) |
| O 503 que vem **depois** do código certo (o `consumir` do `MfaService` falha com o Redis) sai como `TEMPO_ESGOTADO`, e não como `INDISPONIVEL_TENTE_DE_NOVO`; a tela do segundo fator da entrada ganha o texto próprio dele, `AVISO_DO_CODIGO_GASTO_SEM_ENTRAR` (`packages/shared`), que manda digitar o código seguinte **sem afirmar que o código estava certo** (o mesmo `TEMPO_ESGOTADO` da API vem também do `statement_timeout`, antes da conferência; o conselho vale nos dois casos). O estouro do prazo no navegador (`estourouNoCliente`) fica com o texto geral. A ativação e a operação seguem com o texto geral do mesmo código | Nesse ponto o passo (ou o código de recuperação) já foi gasto: o 503 que manda repetir faria a web repetir o mesmo código, e a resposta seria "código incorreto" (ordem 1 da rodada 1, infra-guardian). `TEMPO_ESGOTADO` a web não repete sozinha, e já era o código do 503 da trava da escola no mesmo ponto | `techspec.md` §5 "O Redis fora (54.0)"; `cenarios.md` §7 (o [I] do Redis fora) |
| Quando o `consumir` do `MfaService` falha depois do código certo, o convite do desafio já pode ter sido ativado (`ativar` vem antes): a ativação fica, e o código seguinte entra por ela | A linha que a Mesa deixou ao Arquiteto (`privacy-guardian`, 2ª rodada): é o comportamento do código, dito na Tech Spec, sem mudar nada | `techspec.md` §5 "O Redis fora (54.0)" (ajustada pelo Arquiteto em `diagnostico-14.md`; vai neste commit) |
| Os arquivos `packages/shared/src/errors/messages.ts` e `messages.test.ts` entram na tarefa (o texto novo do segundo fator) | O catálogo da tela é do `shared` (regra 00, item 6) | `cenarios.md` §7 |
| A espera única só vale para o `Retry-After` de 0 a 10 s, com o piso de 1 s da entrada (`ESPERA_MINIMA_NO_503_MS`) | O `Retry-After: 0` faria a escola inteira martelar a rota; o piso é o mesmo do `comFilaDoSemaforo` | `techspec.md` §5 "O Redis fora (54.0)" (o limite de 10 s) |

## Mutações

--faltando: 0 linhas (45 blocos, 2 motivos). Cada bloco tira uma cláusula do diff (ou a chamada que confere antes) e aponta o caso que cai com ela.
O `#semRedis` com o `DEFAULT_RETRY_AFTER_SECONDS` de terceiro argumento não tem bloco: o `AllExceptionsFilter` põe o mesmo padrão de 5 s quando o
`DomainException` não o traz (`tenteDeNovoEmSegundos ?? DEFAULT_RETRY_AFTER_SECONDS`), e sem o argumento a resposta sai igual; ele fica por clareza e
pelo molde do `operador-challenge.ts`. As mudanças de `mfa.service.ts` e `troca-de-escola.service.ts` no diff são comentários: a ordem
`conferirLivre` → reserva já era a do código, e os blocos dos dois tiram a chamada que a garante. Em `mensagemDaFalhaDoCodigo` de `Mfa.tsx`, o termo `falha instanceof ApiError` do `if` só estreita o `unknown` para ler `falha.codigo`: o cliente só relança um erro que não é `ApiError` quando a chamada foi cancelada de fora (`sinal.aborted`), e a tela do segundo fator não cancela nada; o código `falha.codigo === ErrorCode.TEMPO_ESGOTADO` tem o bloco, e o termo `!estourouNoCliente(falha)` (o `TEMPO_ESGOTADO` do navegador, `origem: 'cliente'`, não é o código gasto) tem o bloco "o estouro do prazo no navegador mostra o texto geral". No `catch` do `consumir` de `MfaService`, o termo `erro instanceof DomainException` só protege o acesso a `erro.codigo`: sem ele, um erro que não é de domínio (um `TypeError`) subiria igual, e o `Error` sem `codigo` também. O que o teste pode provar é o código (bloco acima). O `useEffect` de `EscolherEscola` não tem
condição (o `focus()` do botão desabilitado e o da abertura, sem escola escolhida, não fazem nada), e o `esperarMs` e o intervalo da contagem
não têm cláusula: a contagem de segundos é `aria-hidden` e vale pelo teste que lê o `3 s` do começo.

**`#semRedis` do desafio devolve o 401 de antes, e não o 503 com `Retry-After`**

```mutacao
arquivo: apps/api/src/credencial/challenge.ts
teste: apps/api/test/mfa.int.test.ts › falha \(54\.0\): com o Redis de fila fora, o segundo fator dá 503
-    return new DomainException(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO, undefined, DEFAULT_RETRY_AFTER_SECONDS)
+    return new DomainException(ErrorCode.NAO_AUTENTICADO)
```

**Segundo fator: `#desafioLivre` sem `conferirLivre` deixa a reserva do contador vir antes (com o Redis fora, o quinto código já seria `CONTA_SEGURADA`)**

```mutacao
arquivo: apps/api/src/sessao/mfa/mfa.service.ts
teste: apps/api/test/mfa.int.test.ts › falha \(54\.0\): com o Redis de fila fora, o segundo fator dá 503
     const verificado = await verifyChallenge(desafio, this.dependencias.chaveAssinatura, [etapa])
-    await this.dependencias.consumo.conferirLivre(verificado)
     return verificado
```

**Escolha de escola: `escolher` sem `conferirLivre` deixa o usuário de outra conta dar 404 com o Redis fora, e o da própria escolha cair só no `consumir`**

```mutacao
arquivo: apps/api/src/sessao/troca-de-escola/troca-de-escola.service.ts
teste: apps/api/test/troca-de-escola.int.test.ts › falha \(54\.0\): com o Redis de fila fora, escolher dá 503
     const verificado = await verifyChallenge(desafio, this.dependencias.chaveAssinatura, ['escolher'])
-    await consumo.conferirLivre(verificado)
     const destino = await this.#destinoDaConta(verificado.contaId, pedido.usuarioId)
```

**`esperaDoIndisponivel`: sem a conferência do código, outro erro com `Retry-After` também espera**

```mutacao
arquivo: apps/web/src/pages/espera-do-indisponivel.ts
teste: apps/web/src/pages/espera-do-indisponivel.test.ts › o Retry-After até 10 s vale
-  if (!ehIndisponivel(erro)) return undefined
```

**`esperaDoIndisponivel`: sem o termo "sem `Retry-After`", o 503 sem cabeçalho espera NaN**

```mutacao
arquivo: apps/web/src/pages/espera-do-indisponivel.ts
teste: apps/web/src/pages/espera-do-indisponivel.test.ts › o Retry-After até 10 s vale
-  if (segundos === undefined || segundos > LIMITE_DA_ESPERA_DO_INDISPONIVEL_S) return undefined
+  if (segundos > LIMITE_DA_ESPERA_DO_INDISPONIVEL_S) return undefined
```

**`esperaDoIndisponivel`: sem o limite de 10 s, o `Retry-After` de 11 s espera**

```mutacao
arquivo: apps/web/src/pages/espera-do-indisponivel.ts
teste: apps/web/src/pages/espera-do-indisponivel.test.ts › o Retry-After até 10 s vale
-  if (segundos === undefined || segundos > LIMITE_DA_ESPERA_DO_INDISPONIVEL_S) return undefined
+  if (segundos === undefined) return undefined
```

**`ehIndisponivel`: sem `instanceof ApiError`, o erro que não é `ApiError` (a tela sem falha) lança ao ler `.codigo`**

```mutacao
arquivo: apps/web/src/pages/espera-do-indisponivel.ts
teste: apps/web/src/pages/espera-do-indisponivel.test.ts › Retry-After: 3 desabilita o botão
-  return erro instanceof ApiError && erro.codigo === ErrorCode.INDISPONIVEL_TENTE_DE_NOVO
+  return erro.codigo === ErrorCode.INDISPONIVEL_TENTE_DE_NOVO
```

**`ehIndisponivel`: sem o código, qualquer `ApiError` com `Retry-After` espera**

```mutacao
arquivo: apps/web/src/pages/espera-do-indisponivel.ts
teste: apps/web/src/pages/espera-do-indisponivel.test.ts › o Retry-After até 10 s vale
-  return erro instanceof ApiError && erro.codigo === ErrorCode.INDISPONIVEL_TENTE_DE_NOVO
+  return erro instanceof ApiError
```

**`AvisoDaEspera`: a região visível fora da espera (sem o `sr-only` de repouso)**

```mutacao
arquivo: apps/web/src/pages/espera-do-indisponivel.ts
teste: apps/web/src/pages/espera-do-indisponivel.test.ts › Retry-After: 3 desabilita o botão
-    { role: 'status', className: restante === undefined ? 'sr-only' : classe },
+    { role: 'status', className: classe },
```

**`AvisoDaEspera`: a região escondida também durante a espera**

```mutacao
arquivo: apps/web/src/pages/espera-do-indisponivel.ts
teste: apps/web/src/pages/espera-do-indisponivel.test.ts › Retry-After: 3 desabilita o botão
falha: not.toContain('sr-only')
-    { role: 'status', className: restante === undefined ? 'sr-only' : classe },
+    { role: 'status', className: 'sr-only' },
```

**`AvisoDaEspera`: o texto da espera nunca aparece, só o de repouso**

```mutacao
arquivo: apps/web/src/pages/espera-do-indisponivel.ts
teste: apps/web/src/pages/espera-do-indisponivel.test.ts › Retry-After: 3 desabilita o botão
-    restante === undefined ? repouso : AVISO_DA_ESPERA_DO_INDISPONIVEL,
+    repouso,
```

**`AvisoDaEspera`: a contagem escondida também fora da espera**

```mutacao
arquivo: apps/web/src/pages/espera-do-indisponivel.ts
teste: apps/web/src/pages/espera-do-indisponivel.test.ts › o segundo 503 vai ao ErrorState, sem nova espera, e o foco
-    restante !== undefined && createElement('span', { 'aria-hidden': 'true' }, ` (${String(restante)} s)`),
+    createElement('span', { 'aria-hidden': 'true' }, ` (${String(restante)} s)`),
```

**`AvisoDaEspera`: sem a contagem escondida, a espera não mostra os segundos**

```mutacao
arquivo: apps/web/src/pages/espera-do-indisponivel.ts
teste: apps/web/src/pages/espera-do-indisponivel.test.ts › Retry-After: 3 desabilita o botão
-    restante !== undefined && createElement('span', { 'aria-hidden': 'true' }, ` (${String(restante)} s)`),
+    restante !== undefined && null,
```

**`executar`: a resposta atrasada de quem já saiu navega mesmo assim**

```mutacao
arquivo: apps/web/src/pages/espera-do-indisponivel.ts
teste: apps/web/src/pages/espera-do-indisponivel.test.ts › recomeço: a resposta atrasada da tentativa anterior
-      if (!valendo()) return DESCARTADA
       if ('valor' in primeira) return primeira.valor
```

**`executar`: sem devolver o valor, o sucesso cai no ramo do erro**

```mutacao
arquivo: apps/web/src/pages/espera-do-indisponivel.ts
teste: apps/web/src/pages/espera-do-indisponivel.test.ts › sem 503, a região de status fica escondida e vazia
-      if ('valor' in primeira) return primeira.valor
```

**`executar`: o erro que não é 503 espera mesmo assim (o `Retry-After` de 11 s e o 503 sem cabeçalho)**

```mutacao
arquivo: apps/web/src/pages/espera-do-indisponivel.ts
teste: apps/web/src/pages/espera-do-indisponivel.test.ts › o limite: Retry-After de 10 s espera
-      if (segundos === undefined) throw primeira.erro
```

**`executar`: a tela que saiu durante a espera repete o pedido**

```mutacao
arquivo: apps/web/src/pages/espera-do-indisponivel.ts
teste: apps/web/src/pages/espera-do-indisponivel.test.ts › recomeço: a tela que sai durante a espera, com o mesmo desafio
-      if (!valendo() || !aindaVale()) return DESCARTADA
+      if (!aindaVale()) return DESCARTADA
```

**`executar`: a repetição leva o desafio de quem entrou depois**

```mutacao
arquivo: apps/web/src/pages/espera-do-indisponivel.ts
teste: apps/web/src/pages/espera-do-indisponivel.test.ts › recomeço: se o desafio da aba muda durante a espera, com a mesma tela montada, a repetição não sai
-      if (!valendo() || !aindaVale()) return DESCARTADA
+      if (!valendo()) return DESCARTADA
```

**`executar`: a resposta atrasada da repetição, com sucesso ou com erro, muda a tela depois de ela sair (navega, ou apaga o desafio de quem entrou depois)**

```mutacao
arquivo: apps/web/src/pages/espera-do-indisponivel.ts
teste: apps/web/src/pages/espera-do-indisponivel.test.ts › recomeço: a resposta atrasada da repetição, com
       const segunda = await tentar(acao)
-      if (!valendo()) return DESCARTADA
       if ('valor' in segunda) return segunda.valor
```

**`executar`: o sucesso da repetição some (cai no ramo do erro)**

```mutacao
arquivo: apps/web/src/pages/espera-do-indisponivel.ts
teste: apps/web/src/pages/espera-do-indisponivel.test.ts › Retry-After: 3 desabilita o botão
-      if ('valor' in segunda) return segunda.valor
```

**`executar`: a chamada que outra já trocou para a contagem da nova**

```mutacao
arquivo: apps/web/src/pages/espera-do-indisponivel.ts
teste: apps/web/src/pages/espera-do-indisponivel.test.ts › a chamada que outra já trocou, ao acabar de esperar, não para a contagem da nova
-        if (valendo()) pararContagem()
+        pararContagem()
```

**`FalhaDoSegundoFator`: o 503 de queda mostra a mensagem do campo, e não o `ErrorState`**

```mutacao
arquivo: apps/web/src/pages/Mfa.tsx
teste: apps/web/src/pages/espera-do-indisponivel.test.ts › o segundo 503 vai ao ErrorState, sem nova espera, e o foco
-  if (ehIndisponivel(falha)) return <ErrorState erro={falha} aoTentarDeNovo={aoTentarDeNovo} tentando={entrando} />
```

**`FalhaDoSegundoFator`: sem falha, o alerta aparece sempre**

```mutacao
arquivo: apps/web/src/pages/Mfa.tsx
teste: apps/web/src/pages/espera-do-indisponivel.test.ts › Retry-After: 3 desabilita o botão
-  if (falha === undefined) return null
```

**`FalhaDoSegundoFator`: todo erro mostra a mensagem do erro interno**

```mutacao
arquivo: apps/web/src/pages/Mfa.tsx
teste: apps/web/src/pages/espera-do-indisponivel.test.ts › outro erro não espera
-  return falha instanceof ApiError ? mensagemDoSegundoFator(falha.codigo, falha.esperaSegundos) : mensagemDoSegundoFator(ErrorCode.ERRO_INTERNO)
+  return mensagemDoSegundoFator(ErrorCode.ERRO_INTERNO)
```

**`Mfa`: o foco vai ao botão na abertura da tela, sem falha**

```mutacao
arquivo: apps/web/src/pages/Mfa.tsx
teste: apps/web/src/pages/espera-do-indisponivel.test.ts › Retry-After: 3 desabilita o botão
-    if (falha !== undefined && document.activeElement === document.body) botao.current?.focus()
+    if (document.activeElement === document.body) botao.current?.focus()
```

**`Mfa`: o foco sai do campo para o botão a cada falha**

```mutacao
arquivo: apps/web/src/pages/Mfa.tsx
teste: apps/web/src/pages/espera-do-indisponivel.test.ts › outro erro não espera
-    if (falha !== undefined && document.activeElement === document.body) botao.current?.focus()
+    if (falha !== undefined) botao.current?.focus()
```

**`Mfa`: a tentativa descartada navega e mostra falha**

```mutacao
arquivo: apps/web/src/pages/Mfa.tsx
teste: apps/web/src/pages/espera-do-indisponivel.test.ts › recomeço: se o desafio da aba muda durante a espera, com a mesma tela montada, a repetição não sai
-      if (resposta === DESCARTADA) return
```

**`Mfa`: o repouso da região de status diz "Entrando…" fora do envio**

```mutacao
arquivo: apps/web/src/pages/Mfa.tsx
teste: apps/web/src/pages/espera-do-indisponivel.test.ts › Retry-After: 3 desabilita o botão
-        <AvisoDaEspera restante={espera.restante} repouso={entrando ? 'Entrando…' : ''} classe="t-apoio text-center" />
+        <AvisoDaEspera restante={espera.restante} repouso="Entrando…" classe="t-apoio text-center" />
```

**`Mfa`: o repouso da região de status nunca diz "Entrando…"**

```mutacao
arquivo: apps/web/src/pages/Mfa.tsx
teste: apps/web/src/pages/espera-do-indisponivel.test.ts › enquanto o pedido está no ar, sem 503
-        <AvisoDaEspera restante={espera.restante} repouso={entrando ? 'Entrando…' : ''} classe="t-apoio text-center" />
+        <AvisoDaEspera restante={espera.restante} repouso="" classe="t-apoio text-center" />
```

**`FalhaDaEscolha`: o 503 de queda mostra a mensagem do catálogo, e não o `ErrorState`**

```mutacao
arquivo: apps/web/src/pages/EscolherEscola.tsx
teste: apps/web/src/pages/espera-do-indisponivel.test.ts › o segundo 503 vai ao ErrorState, sem nova espera; o foco volta à escola escolhida
-  if (ehIndisponivel(falha)) return <ErrorState erro={falha} aoTentarDeNovo={aoTentarDeNovo} tentando={ocupado} />
```

**`FalhaDaEscolha`: sem falha, o alerta aparece sempre**

```mutacao
arquivo: apps/web/src/pages/EscolherEscola.tsx
teste: apps/web/src/pages/espera-do-indisponivel.test.ts › espera o Retry-After uma vez, com os botões desabilitados
-  if (falha === undefined) return null
```

**`EscolherEscola`: a tentativa descartada navega e mostra falha**

```mutacao
arquivo: apps/web/src/pages/EscolherEscola.tsx
teste: apps/web/src/pages/espera-do-indisponivel.test.ts › se o desafio da aba muda durante a espera, com a mesma tela montada, a repetição não sai e o aviso some
-      if (resposta === DESCARTADA) return
```

**`EscolherEscola`: o repouso da região de status diz "Entrando…" sem escolha no ar**

```mutacao
arquivo: apps/web/src/pages/EscolherEscola.tsx
teste: apps/web/src/pages/espera-do-indisponivel.test.ts › sem 503, a região de status fica escondida e vazia
-      <AvisoDaEspera restante={espera.restante} repouso={entrando === undefined ? '' : 'Entrando…'} classe="t-apoio" />
+      <AvisoDaEspera restante={espera.restante} repouso="Entrando…" classe="t-apoio" />
```

**`EscolherEscola`: o repouso da região de status nunca diz "Entrando…"**

```mutacao
arquivo: apps/web/src/pages/EscolherEscola.tsx
teste: apps/web/src/pages/espera-do-indisponivel.test.ts › sem 503, a região de status fica escondida e vazia
-      <AvisoDaEspera restante={espera.restante} repouso={entrando === undefined ? '' : 'Entrando…'} classe="t-apoio" />
+      <AvisoDaEspera restante={espera.restante} repouso="" classe="t-apoio" />
```

**`FalhaDaTroca`: o 503 de queda mostra a mensagem da troca, e não o `ErrorState`**

```mutacao
arquivo: apps/web/src/components/SeletorDeEscola.tsx
teste: apps/web/src/components/SeletorDeEscola.test.tsx › o segundo 503 vai ao ErrorState: a lista segue aberta
-  if (ehIndisponivel(falha)) return <ErrorState erro={falha} aoTentarDeNovo={aoTentarDeNovo} tentando={ocupado} />
```

**`FalhaDaTroca`: sem falha, o alerta aparece sempre**

```mutacao
arquivo: apps/web/src/components/SeletorDeEscola.tsx
teste: apps/web/src/components/SeletorDeEscola.test.tsx › espera o Retry-After uma vez com a lista aberta
-  if (falha === undefined) return null
```

**`SeletorDeEscola`: a troca descartada navega e mostra falha**

```mutacao
arquivo: apps/web/src/components/SeletorDeEscola.tsx
teste: apps/web/src/components/SeletorDeEscola.test.tsx › recomeço: se a pessoa da aba muda durante a espera
-      if (resposta === DESCARTADA) return
```

**`SeletorDeEscola`: "Tentar de novo" não repete a troca**

```mutacao
arquivo: apps/web/src/components/SeletorDeEscola.tsx
teste: apps/web/src/components/SeletorDeEscola.test.tsx › o segundo 503 vai ao ErrorState: a lista segue aberta
-          if (ultimaTroca !== undefined) void escolher(ultimaTroca.acesso)
+          if (ultimaTroca === undefined) return
```

**`SeletorDeEscola`: a falha da pessoa anterior segue na tela de quem entrou depois**

```mutacao
arquivo: apps/web/src/components/SeletorDeEscola.tsx
teste: apps/web/src/components/SeletorDeEscola.test.tsx › a falha é de quem trocou
-        falha={daPessoaDeAgora ? falha : undefined}
+        falha={falha}
```

**`EscolherEscola`: a falha da pessoa anterior segue na tela quando o desafio da aba muda e a tela desenha de novo**

```mutacao
arquivo: apps/web/src/pages/EscolherEscola.tsx
teste: apps/web/src/pages/espera-do-indisponivel.test.ts › recomeço: com o ErrorState na tela, o desafio da aba passa a ser de outra pessoa e a tela desenha de novo
-      <FalhaDaEscolha falha={daPessoaDeAgora() ? falha : undefined} ocupado={entrando !== undefined} aoTentarDeNovo={tentarDeNovo} />
+      <FalhaDaEscolha falha={falha} ocupado={entrando !== undefined} aoTentarDeNovo={tentarDeNovo} />
```

**`EscolherEscola`: "Tentar de novo" manda a escolha de quem saiu com o desafio de quem chegou (conferido no clique, e não só no desenho)**

```mutacao
arquivo: apps/web/src/pages/EscolherEscola.tsx
teste: apps/web/src/pages/espera-do-indisponivel.test.ts › recomeço: com o ErrorState na tela, o desafio da aba passa a ser de outra pessoa: "Tentar de novo"
-    if (daPessoaDeAgora()) void entrar(ultima.usuarioId)
+    if (true) void entrar(ultima.usuarioId)
```

**`Mfa`: o `TEMPO_ESGOTADO` depois do código certo mostra o texto geral, e não o do código gasto**

```mutacao
arquivo: apps/web/src/pages/Mfa.tsx
teste: apps/web/src/pages/espera-do-indisponivel.test.ts › o TEMPO_ESGOTADO depois do código certo mostra o aviso do código gasto
-  if (falha instanceof ApiError && falha.codigo === ErrorCode.TEMPO_ESGOTADO && !estourouNoCliente(falha)) return AVISO_DO_CODIGO_GASTO_SEM_ENTRAR
```

**`Mfa`: o estouro do prazo no navegador mostra o texto do código gasto, e não o geral do `TEMPO_ESGOTADO` (a resposta não chegou)**

```mutacao
arquivo: apps/web/src/pages/Mfa.tsx
teste: apps/web/src/pages/espera-do-indisponivel.test.ts › o prazo estourado no navegador
falha: toBe(MENSAGENS_DE_ERRO.TEMPO_ESGOTADO)
-  if (falha instanceof ApiError && falha.codigo === ErrorCode.TEMPO_ESGOTADO && !estourouNoCliente(falha)) return AVISO_DO_CODIGO_GASTO_SEM_ENTRAR
+  if (falha instanceof ApiError && falha.codigo === ErrorCode.TEMPO_ESGOTADO) return AVISO_DO_CODIGO_GASTO_SEM_ENTRAR
```

**`MfaService`: o 503 depois do código certo segue como o que manda repetir o mesmo pedido**

```mutacao
arquivo: apps/api/src/sessao/mfa/mfa.service.ts
teste: apps/api/test/mfa.int.test.ts › falha \(54\.0\): o Redis de fila recusa o
-    await consumo.consumir(verificado).catch((erro: unknown) => {
-      if (erro instanceof DomainException && erro.codigo === ErrorCode.INDISPONIVEL_TENTE_DE_NOVO) {
-        throw new DomainException(ErrorCode.TEMPO_ESGOTADO, undefined, DEFAULT_RETRY_AFTER_SECONDS)
-      }
-      throw erro
-    })
+    await consumo.consumir(verificado)
```

**`MfaService`: todo erro do `consumir` depois do código certo vira o `TEMPO_ESGOTADO` (o desafio já marcado deixa de ser 401)**

```mutacao
arquivo: apps/api/src/sessao/mfa/mfa.service.ts
teste: apps/api/test/mfa.int.test.ts › falha \(54\.0\): o desafio já marcado como usado depois do código certo
-      if (erro instanceof DomainException && erro.codigo === ErrorCode.INDISPONIVEL_TENTE_DE_NOVO) {
+      if (erro instanceof DomainException) {
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| infra-guardian (1ª) | O `Retry-After` do desafio é sempre 5 s (`DEFAULT_RETRY_AFTER_SECONDS`): sortear como o `hash-bulkhead.ts` (2 a 6 s) para espalhar a repetição | `TODO.md`. Muda o valor que a API devolve (contrato), e a Tech Spec §5 pede o molde do operador, com o mesmo padrão |
| frontend-reviewer (1ª) | Conferir a 360 px se o `ErrorState` e "Tentar de novo" ficam apertados na lateral de 256 px do seletor | Validador, que fotografa cada requisito com tela. Não há o que mudar no código agora |
| frontend-reviewer (1ª) | Olhar `/entrar` no segundo fator e na escolha com o aviso, a 360 px e a 1366 px | Validador. As fotos não saíram: a vitrine não força o 503 |
| frontend-reviewer (1ª) | Migrar `AvisoDaEspera` para `.tsx` se ganhar um quarto uso | Recusada: o frontend-reviewer a condiciona a um uso que não existe; a justificativa do `.ts` está em "Divergências resolvidas nesta tarefa" |
| revisor-geral (1ª) | `SeletorDeEscola.tsx` importa de `../pages/espera-do-indisponivel`: mover para um lugar neutro | `TODO.md`. Mover o arquivo e os imports de 3 telas e 2 testes não é barato, e o catálogo de peças (`docs/interface.md` 10.2) pede decisão |
| test-engineer (1ª) | A resposta atrasada ainda grava o token de quem saiu (`guardarEtapa`, `apps/web/src/api/sessao.ts`, antes de o `executar` devolver `DESCARTADA`); já existia antes da tarefa | `TODO.md`, com a nota ao `privacy-guardian` na próxima tarefa que toque `sessao.ts`. Muda o contrato do cliente de sessão, fora dos "Arquivos previstos" |
| revisor-geral (2ª) | `SeletorDeEscola.tsx`: a `falha` da pessoa A continua no estado depois que B entra; limpar quando `usuarioAtual` muda | Recusada: o `privacy-guardian` e o `frontend-reviewer` (2ª) deram a falha presa à pessoa de quando a troca saiu (`ultimaTroca.usuario === usuarioAtual`) como a correção da recomendação da 1ª rodada, com testes (`SeletorDeEscola.test.tsx`), e o revisor-geral diz que não é furo |
| infra-guardian (2ª) | Conferir, no caso novo de `mfa.int.test.ts`, que o contador do `LoginLockout` não mudou depois do `TEMPO_ESGOTADO` | Recusada: o desfazer do `catch` tem prova em `apps/api/test/ativacao-under-lock.int.test.ts` (bloco e), como o próprio revisor diz; recomendação de quem aprovou, fora da regra de uma vez por documento |
| infra-guardian (2ª) | O `TEMPO_ESGOTADO` do `concluir`, ou do `set` que gravou a marca e estourou: o próximo código dá 401 e a tela diz "código incorreto"; mandar à entrada quando o mesmo desafio volta 401 | `TODO.md` |
| infra-guardian (2ª) | O runbook, causa 4, citar o `TEMPO_ESGOTADO` no log do Redis instável | `TODO.md` (o runbook conta como código e caducaria as aprovações desta rodada, por uma linha) |
| infra-guardian (2ª) | Sortear o `Retry-After` do desafio | Já no `TODO.md` (1ª rodada) |
| privacy-guardian (2ª) | A resposta atrasada ainda grava o token (`guardarEtapa`, `apps/web/src/api/sessao.ts`); passar a geração ou o desafio de origem a `enviarEtapa`, com teste de recomeço | Já no `TODO.md` (1ª rodada): a próxima tarefa que tocar `sessao.ts` |
| privacy-guardian (2ª) | Uma linha na Tech Spec §5: no `TEMPO_ESGOTADO`, o convite já pode ter sido ativado antes do `consumir` que falhou | Aplicada pelo Arquiteto na `techspec.md` §5 (`diagnostico-14.md`); vai neste commit, e a linha está em "Divergências resolvidas nesta tarefa" |
| frontend-reviewer (2ª) | `Mfa.tsx` trata todo `TEMPO_ESGOTADO` como "código gasto"; um código de erro próprio quando houver terceira causa | Aplicada no diagnóstico (`diagnostico-14.md`, ponto 4): o texto deixou de afirmar que o código estava certo, e o estouro do navegador segue com o texto geral (item 1 da ordem). Um código de erro próprio fica para quando houver terceira causa com conselho diferente |
| frontend-reviewer (2ª) | Conferir na validação se `docs/interface.md` 10.2 diz onde mora o `AvisoDaEspera`; o trecho "Nenhuma peça nova" ficou colado ao parágrafo seguinte | Validador |
| test-engineer (2ª) | O aviso do código gasto pode dizer algo falso quando o `statement_timeout` (`57014`, `TEMPO_ESGOTADO`) vem antes da conferência do código (`mfaDaConta`, `avancarPassoDoMfa`); reescrever o texto sem afirmar que o código estava certo, ou um código próprio, e um teste | Aplicada no diagnóstico (`diagnostico-14.md`, ponto 4): `AVISO_DO_CODIGO_GASTO_SEM_ENTRAR` diz "esse código pode já ter sido usado", com o teste `not.toMatch(/estava certo/)` em `messages.test.ts` |
| test-engineer (2ª) | O axe do `medir` roda com o relógio solto, e a repetição pode sair durante ele; registrar no comentário ou medir só a região do aviso | Recusada: o próprio test-engineer diz que o caso não fica vermelho e que o desvio está comentado no spec (`ESPERA_S` subiu para 10 por isso) |
| test-engineer (2ª) | Blocos de mutação iguais no `14_task.md` | Aplicada (item 2 da ordem): um bloco só para a repetição atrasada |
| revisor-geral (3ª) | `cenarios.md` §7 (l.203-204) sem o [U] do prazo estourado no navegador na tela do segundo fator e do texto da tela no `TEMPO_ESGOTADO` da API | Arquiteto: `cenarios.md` é documento dele; o Validador acha o caso no `espera-do-indisponivel.test.ts` e na tabela "Testes que provam a regra" do `14_task.md` |
| revisor-geral (3ª) e infra-guardian (3ª) | Depois do estouro no navegador, o texto geral ("Tente de novo em instantes") pode levar a repetir o mesmo código, e a API responde "código incorreto" | `TODO.md`, junto da linha já escrita (infra-guardian, 2ª: mandar à entrada quando o mesmo desafio volta 401 depois de um `TEMPO_ESGOTADO`); a tarefa que pegar esse item cobre as duas origens |
| frontend-reviewer (3ª) | O texto "pode já ter sido usado" cobre dois casos; um texto só para o 503 antes da conferência, se a validação mostrar confusão | Validador, na leitura da tela; sem ação agora |
| frontend-reviewer (3ª) | Conferir que o `afterEach` desfaz o `vi.stubGlobal('fetch')` | Conferido pela Mesa: `apps/web/src/__fixtures__/render-screen.tsx` (l.101 e l.105) chama `vi.unstubAllGlobals()`; nada a fazer |
| privacy-guardian (3ª) | A resposta atrasada ainda grava o token (`guardarEtapa`, `apps/web/src/api/sessao.ts`) | Já no `TODO.md` (1ª rodada): a próxima tarefa que tocar `sessao.ts` |
| test-engineer (3ª) | Um bloco só de mutação para os dois testes da repetição atrasada; um bloco por teste quando dois cobrem a mesma linha | Retro (o `revisor-geral` pediu o bloco único na 2ª rodada; os dois pedidos se contradizem em teoria, e a 2ª rodada já provou cada teste em separado) |
| test-engineer (3ª) | `packages/shared/dist/errors/messages.d.ts` com o texto antigo | Nada a fazer: `packages/shared/dist` é ignorado pelo git (`git check-ignore`), a próxima build o regenera |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-15 21:26:22 | 2026-11-15 21:26:55 | `tenancy-guardian` | 1 | APROVADO | aad148a217b537374 |
| 2026-11-15 21:26:25 | 2026-11-15 21:26:55 | `frontend-reviewer` | 1 | APROVADO | a86ca268857923c13 |
| 2026-11-15 21:26:38 | 2026-11-15 21:26:59 | `conformidade-reviewer` | 1 | APROVADO | af756d7f4911d3533 |
| 2026-11-15 21:26:35 | 2026-11-15 21:27:24 | `privacy-guardian` | 1 | APROVADO | a4d631893d366cb01 |
| 2026-11-15 21:26:19 | 2026-11-15 21:27:46 | `infra-guardian` | 1 | REPROVADO | a2850d3a58762fd3c |
| 2026-11-15 21:26:32 | 2026-11-15 21:28:03 | `revisor-geral` | 1 | REPROVADO | a15fdd9f5bd775853 |
| 2026-11-15 21:26:28 | 2026-11-15 21:29:31 | `test-engineer` | 1 | REPROVADO | a5080798c9abecbfc |
| 2026-11-15 22:29:36 | 2026-11-15 22:30:00 | `tenancy-guardian` | 2 | APROVADO | a0c4c1a2cc252fcdd |
| 2026-11-15 22:29:42 | 2026-11-15 22:30:07 | `frontend-reviewer` | 2 | APROVADO | a3dc40d9942f71511 |
| 2026-11-15 22:29:54 | 2026-11-15 22:30:22 | `conformidade-reviewer` | 2 | APROVADO | aaf8713ad485fbb9e |
| 2026-11-15 22:29:23 | 2026-11-15 22:30:42 | `revisor-geral` | 2 | REPROVADO | a503c08609c8d79ab |
| 2026-11-15 22:29:49 | 2026-11-15 22:30:51 | `privacy-guardian` | 2 | APROVADO | a534b1e0bf259c8fa |
| 2026-11-15 22:29:15 | 2026-11-15 22:31:12 | `infra-guardian` | 2 | APROVADO | ae12a12146101faec |
| 2026-11-15 22:29:30 | 2026-11-15 22:31:49 | `test-engineer` | 2 | APROVADO | a5e830bec0638fd55 |
| 2026-11-15 22:51:47 | 2026-11-15 22:51:59 | `frontend-reviewer` | 3 | APROVADO | ad3fe89365e0687b7 |
| 2026-11-15 22:52:01 | 2026-11-15 22:52:19 | `infra-guardian` | 3 | APROVADO | a7688f99583d75cf0 |
| 2026-11-15 22:52:06 | 2026-11-15 22:52:20 | `tenancy-guardian` | 3 | APROVADO | a153bf1494aa9c943 |
| 2026-11-15 22:51:39 | 2026-11-15 22:52:26 | `revisor-geral` | 3 | APROVADO | a921834e85662eff7 |
| 2026-11-15 22:52:12 | 2026-11-15 22:52:33 | `privacy-guardian` | 3 | APROVADO | aea756ea4e344ed4f |
| 2026-11-15 22:52:18 | 2026-11-15 22:52:34 | `conformidade-reviewer` | 3 | APROVADO | abbc977a18b361ede |
| 2026-11-15 22:51:54 | 2026-11-15 22:52:35 | `test-engineer` | 3 | APROVADO | a0081f93fb992716c |
