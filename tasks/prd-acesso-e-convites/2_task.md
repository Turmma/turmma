# Tarefa 2.0 — O envio adia sem prender a fila: `EMAIL_POR_MINUTO` e a saída de adiar

**Funcionalidade:** acesso-e-convites · **Depende de:** 1.0
**Subagentes obrigatórios:** `infra-guardian`, `tenancy-guardian`, `test-engineer`
**Porte:** grande

## Objetivo

O job de e-mail consome o `EMAIL_POR_MINUTO` (global, atômico no Redis de fila) e, sem vaga, reserva alheia ou Redis, adia: libera a vaga da escola, volta a `publicado`, não gasta tentativa nem uso, e espera o `msBeforeNext` mais até 5 s sorteados; mede resultado e adiamento, com alerta.

## Contexto necessário

- `techspec.md` seções 2, 5 ("E-mail") e 7c; `cenarios.md` RF11 (o `EMAIL_POR_MINUTO` e o adiamento) e "Limites"
- `.claude/rules/80` itens 2, 3, 5 e 10
- `apps/worker/src/job-executor.ts:394-401` (`esperarVaga`): o modelo; aqui o job já tomou a vaga
- `packages/core/src/queue/escola-concurrency-limiter.ts:43` (`vaga:normal:sistema`)

## Subtarefas

- [x] 2.1 — O limitador do `EMAIL_POR_MINUTO` no Redis de fila, com a metade reservada ao link da conta, sem seguro em memória; o ponto sem envio volta só na mesma janela
- [x] 2.2 — A saída de adiar no `job-executor`: para a renovação, libera a vaga, linha a `publicado`, sem `uso.marcar('jobs')`, espera com o sorteio injetado
- [x] 2.3 — Métricas de e-mail por resultado e de adiamento; alerta `falhou` acima de 20% em 1 h, com o parágrafo do `docs/runbook.md`
- [x] 2.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/email/limite-por-minuto.ts` | novo |
| `packages/core/src/email/index.ts` | alterado |
| `apps/worker/src/job-executor.ts` | alterado |
| `apps/worker/src/processors/enviar-email.ts` | alterado |
| `packages/core/src/telemetry/metrics.ts` | alterado |
| `infra/grafana/alertas/email-falhou.yaml` | novo |
| `docs/runbook.md` | alterado |
| `apps/worker/src/job-executor.test.ts` | alterado |
| `apps/worker/test/enviar-email-adiamento.int.test.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| `EMAIL_POR_MINUTO` estourado, adiado mais vezes que as tentativas | integração | tentativas intactas, nunca `falhou`, envia quando a vaga abre | `apps/worker/test/enviar-email-adiamento.int.test.ts › o teto do minuto › estourado, o job é adiado mais vezes que as tentativas: …` |
| Redis de fila fora | integração | adia, nenhum envio, nada `falhou`, sem seguro em memória | `› o Redis de fila fora › o job adia por 30 s, sem enviar nada e sem `falhou`, …` e `› o limite de verdade não tem seguro em memória: …` |
| Redis de fila de volta | integração | retomado, envia uma vez | `› o Redis de fila fora › o job adia por 30 s, … com o Redis de volta, retoma e envia uma vez` |
| escola com limite `normal` = 1 e um convite adiado | integração | outro job `normal` da escola roda sem esperar a validade da vaga | `› o teto do minuto › o job adiado solta a vaga: …` |
| job adiado | integração | linha em `publicado`, contador `jobs` intacto | `› o teto do minuto › estourado, …` (a linha `publicado`, `marcacoes` vazio até o envio) e `› o job devolvido à fila › devolverAoPublicado só alcança o job `ativo` da escola do contexto: …` |
| espera do job adiado | integração | entre o `msBeforeNext` e ele mais 5 s, nunca 1 s fixo | `› o teto do minuto › a espera do job adiado fica entre o `msBeforeNext` e ele mais 5 s: nunca 1 s fixo` |
| [U] sorteio injetado: limites | unidade | mínimo `msBeforeNext`, máximo + 5 s; o mesmo com o prazo da reserva e com o Redis fora (30 s) | `apps/worker/src/job-executor.test.ts › o processador adia o job › [U] a espera é a pedida (limite, reserva_alheia, redis) mais o sorteio: …` |
| [U] dois sorteios diferentes | unidade | esperas diferentes | `apps/worker/src/job-executor.test.ts › o processador adia o job › [U] dois sorteios diferentes dão esperas diferentes, …` |
| `EMAIL_POR_MINUTO` = 1, ponto consumido e linha com reserva alheia, `enviado` ou `cancelado` | integração | o ponto volta, o envio seguinte sai no minuto | `apps/worker/test/enviar-email-adiamento.int.test.ts › o ponto que não foi gasto volta › com o teto em 1 e o ponto gasto por %s, ele volta, …` (a reserva alheia, o `enviado`, o `cancelado` e o convite de outra escola) |
| ponto consumido no segundo 59, devolvido no minuto seguinte | integração | não volta | `› o ponto que não foi gasto volta › o ponto gasto no segundo 59 e devolvido no minuto seguinte não volta: …` |
| tentativa recusada pelo SMTP ou caída | integração | o ponto não volta | `› a tentativa recusada pelo SMTP (permanente, transitoria) gastou o ponto: …` e `› a queda que não é uma recusa do servidor também gastou o ponto` |
| [P] reentrega com a reserva alheia presa na barreira | paralelo | adia até o prazo (relógio falso), sem tentativa, depois envia; cai ignorando o prazo | `› a reserva de outro processo › [P] a reentrega com a reserva alheia presa na barreira adia até o prazo da reserva, …` e `› depois do prazo da reserva, o job adiado retoma a linha e envia` |
| [P] mais consumos que o teto, de dois workers | paralelo | envios = teto exato (o script é uma chamada só e a atomicidade é a do Redis: o caso prova o resultado, e não que um ler-e-gravar do cliente cairia) | `› o consumo atômico › [P] mais consumos que o teto, de dois workers: os envios são o teto, exatamente` e `› metade do teto é reservada ao link da conta: …` |
| métricas | integração | resultado e adiamento lidos como no `metrics.int.test.ts` | `› as métricas › o resultado e o adiamento são lidos como no metrics.int.test.ts, …`, `› o 4xx conta só `nova_tentativa`: …` e `› o ponto, quando o job não envia › [P] a revogação com o job na barreira conta `reserva_perdida`, …` |
| alerta novo | unidade | tem a entrada no runbook (`alerta-tem-runbook.test.ts`) | `tools/guardas/alerta-tem-runbook.test.ts › no repositório, cada arquivo de `infra/grafana/alertas/` tem entrada correspondente em `docs/runbook.md`, completa` (a lista agora tem `email-falhou.yaml`) |

## Como testar

- Métrica: `apps/realtime/test/metrics.int.test.ts` › "realtime.conexoes acompanha os clientes abertos nesta instância, sem rótulo de escola, sala ou usuário"; apoio `MedidorDeTeste` (`tools/testes/metricas.ts`)
- Alerta: `tools/guardas/alerta-tem-runbook.test.ts` › "reprova: regra nova sem entrada no runbook"
- Vaga e despachante: `QueueFixtures.reservar(escolaId, fila, limite)` e `despachante(log, opcoes)` (`apps/worker/test/queue.fixture.ts`)
- Teto entre instâncias: `apps/api/test/rate-limit.int.test.ts` › "o limite gasto numa instância vale na outra: o 21º pedido, na API 2, recebe 429"
- Sorteio: injete a fonte como o relógio (`Clock`, `packages/core/src/clock.ts`)
- Comando: `npx vitest run --project integracao apps/worker/test/enviar-email-adiamento.int.test.ts`

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), no plano. Na 4: com a vaga ocupada pelo adiado, o outro job tem de esperar se a liberação sumir; prove pelo efeito, não pela espera.

### Plano

**Interfaces.** `LimiteDeEmailPorMinuto(redis, porMinuto, { prefixo?, relogio? })` com `consumir(classe: 'convite' | 'conta')` (devolve `concedido` com o `ponto` `{ classe, janela }`, ou `sem_vaga` com o `msBeforeNext`) e
`devolver(ponto)` (só na janela em que o ponto foi gasto), em `packages/core/src/email/limite-por-minuto.ts`; o porte `LimiteDeEmail` é o que o processador recebe. Um script Lua só (`consumir` e `devolver`, atômicos), com dois
contadores por minuto (o total e o do convite) e a janela lida do `TIME` do Redis (só o teste injeta o `Clock`). `JobAdiadoError(baseMs, motivo)` em `apps/worker/src/job-adiado.error.js`; o `JobExecutor` ganha a saída de adiar
(`aoNaoConcluir` → `adiar`): solta a vaga, `JobOutboxRepository.devolverAoPublicado` (`ativo` → `publicado`), `moveToDelayed(baseMs + sorteio de até 5 s)`, e o uso (`jobs`) passa a ser contado ao fim da tentativa, salvo adiada.
`EMAIL_POR_MINUTO` (padrão 60) entra no `loadEmailConfig` (`porMinuto`). Métricas `email.envio{resultado}` e `email.adiado{motivo}`; alerta `email-falhou.yaml` e a entrada do runbook.

**Ordem.** (2.1) o limite e a configuração; (2.2) o executor, o repository e o processador (consumir antes de reservar, devolver o ponto de quem não enviou, adiar nos três casos); (2.3) as métricas, o alerta e o runbook;
(2.4) os testes, um por linha da tabela, e as mutações.

**O desenho.** O job gasta o ponto **antes** de reservar a linha: sem ponto, ou sem Redis, adia sem tocar nela (sem seguro em memória, que mandaria sem contar). O ponto volta se a reserva é alheia, o envio já terminou, o convite
não é desta escola, a cifra não decifra ou o banco falhou; a tentativa que falou com o servidor (aceita, recusada ou caída) o gastou. Reserva alheia vigente: adia até o prazo dela (`ate` menos agora), no lugar do `ERRO_INTERNO` da 1.0.
O convite usa até `ceil(N/2)` do teto, e o resto é do link da conta (que chega na 5.0).

### As 12 perguntas

1. **Mutação de cada cláusula:** na seção "Mutações", um bloco por cláusula do diff: o limite (a validação do teto, a janela, o `devolver` na mesma janela, a metade do convite, o `NOSCRIPT`, o prefixo), o executor (cada ramo do
   `aoNaoConcluir`, a marca do uso, a vaga, a linha, a espera e o sorteio), o repository (o escopo e o estado), o processador (cada ramo, o ponto que volta, a espera até o prazo) e a configuração. Cada bloco foi aplicado e rodado antes do pedido.
2. **Texto na tela:** a tarefa não tem tela nem texto novo para o usuário.
3. **Segundo dado que torna a cláusula observável:** o ponto que volta tem o `enviado`, o `cancelado`, a reserva alheia e o convite da outra escola ao lado; o teto tem o segundo worker e a metade do convite; o `devolverAoPublicado` tem o job
   da outra escola e o que já não está `ativo`; a janela tem o ponto gasto no segundo 59 e o relógio que anda.
4. **Checagem anterior que responde antes:** com a vaga ocupada pelo adiado, o outro job `normal` da escola (limite 1) só roda na hora se a liberação existe; o caso prova pelo efeito (o `sintetico` concluído na mesma passada, sem `DelayedError`),
   e o bloco que tira `liberarVaga` fica vermelho nele.
5. **Asserção olha o resultado:** a linha do banco (`envio`, `estado` do job), as mensagens que o falso aceitou, o que o limite concede ou recusa, o que o `moveToDelayed` recebeu e as marcações de uso; nenhum caso olha texto de arquivo.
6. **Guarda nova:** nenhuma regra de lint nem teste estrutural nasce aqui; o alerta novo entra na lista da `alerta-tem-runbook.test.ts`.
7. **Comentário que afirma o que o código não faz:** o docblock do processador foi reescrito para o que ele faz agora (adia, em vez de repetir com `ERRO_INTERNO`); o do `JobExecutor` diz que o uso conta ao fim da tentativa, salvo adiada.
8. **Divergência com regra nova:** a tabela abaixo (o índice do core e o momento de contar o uso); nenhuma cria trava, rota ou gravação sem sessão.
9. **Peça que já existe:** o `moveToDelayed` e o `DelayedError` do `esperarVaga`; o `liberarVaga` e o aviso ao despachante; o `createQueueRedisClient` das vagas (sem fila offline) para o limite; `QueueFixtures`, `FakeEmailSender` e `MedidorDeTeste`.
10. **Operação simultânea:** o `[P]` de dois workers disputando o teto (duas conexões, 60 consumos, exatamente o teto) e o `[P]` da reentrega com a reserva alheia presa na barreira.
11. **Isolamento e coluna "Caso":** o `devolverAoPublicado` sem o escopo muda o job da outra escola (caso `só alcança o job`); o convite da escola B num job da A devolve o ponto e não envia; cada linha da tabela de testes tem o caso na coluna "Caso".
12. **"O que verificar" dos guardiões:** `infra-guardian` (adiar sem prender a vaga, sem seguro em memória, atômico no Redis de fila, métrica e alerta com runbook, `EMAIL_POR_MINUTO` no compose e no `.env.example`), `tenancy-guardian` (o `devolverAoPublicado` com o escopo do
    contexto; o convite da outra escola é `inexistente`), `test-engineer` (um caso por linha, `[P]` com barreira, relógio injetado, nenhum teste compara relógio de parede com folga zero).

## Fora do escopo desta tarefa

A cota de 300/h do "Enviar" (3.0); o job da conta e a metade reservada vista pelo lado dele (5.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| O índice do módulo de e-mail é `packages/core/src/index.ts` (onde `EnvioRepository` e os outros já são exportados); o `packages/core/src/email/index.ts` da tabela "Arquivos previstos" não existe e não é criado | o `core` exporta tudo de um índice só, e o `email/` nunca teve um próprio | `techspec.md` §2 não nomeia o índice |
| O uso (`jobs`) da escola passa a ser contado **ao fim da tentativa** (o `terminarTentativa` do `JobExecutor`), e não ao começo, salvo a tentativa adiada | a 2.2 pede "sem `uso.marcar('jobs')`" para o job adiado, mas o adiamento só se sabe depois de o processador rodar (a reserva alheia só aparece depois de ler a linha); marcar antes e desmarcar não existe no `UsageMeter` (só soma). Cada tentativa que roda continua contando, também a que falha | `techspec.md` §5 ("E-mail": "o uso (`jobs`) passa a ser contado ao fim da tentativa, salvo a adiada"); `cenarios.md` RF11 ("o contador `jobs` da escola não muda") |
| O `EMAIL_POR_MINUTO` é uma variável do ambiente (`EMAIL_POR_MINUTO`, padrão 60, no `.env.example` e no compose do worker), lida pelo `loadEmailConfig` (`porMinuto`); o convite usa `N − ⌊N/2⌋` por minuto e o link da conta fica com o resto; a janela é fixa, de um minuto de calendário | a spec diz "global, abaixo da do provedor, com metade reservada ao link da conta", sem o nome da variável, o arredondamento (com `N` = 1 o convite ainda sai) nem a forma da janela; "o ponto consumido no segundo 59, devolvido no minuto seguinte, não volta" só tem sentido em janela fixa | `techspec.md` §5 ("E-mail": "O teto é `EMAIL_POR_MINUTO` (padrão 60), em janelas fixas…"); `cenarios.md` RF11 e "Limites" |
| O ponto também volta quando a cifra não decifra e quando o banco falha na reserva (além da reserva alheia, do envio já terminado e do convite que não é da escola) | nesses dois casos nada foi enviado; deixar o ponto gasto pagaria, do teto do provedor, um e-mail que não saiu | `techspec.md` §5 ("E-mail": "o devolve se a reserva é alheia, … a cifra não decifra ou o banco falha") |
| A saída de adiar não ganha ordem própria no `JobOutboxRepository`: o método é `devolverAoPublicado` (`ativo` → `publicado`, com o escopo da escola do contexto) | o nome não estava na spec; o estado de destino é o que o `esperarVaga` já deixa | `techspec.md` §5 ("E-mail": `devolverAoPublicado`) |
| `devolverAoPublicado` entra na lista de `REPOSITORIES_SEM_ESCOPO` do `job-outbox.repository.ts`, ao lado de `concluir` e `registrarFalha` (a lista "só encolhe", e esta é a exceção de um método novo) | a guarda só conta a prova do escopo quando `jobScopeInContext` é importado, e ele mora no próprio arquivo; o método usa o mesmo `jobScopeInContext()` dos irmãos, e o `where` dele tem teste de isolamento (`› o job devolvido à fila`) | `techspec.md` §5 ("E-mail"), `tools/guardas/escopo-dos-repositories.ts` |
| O alerta e as métricas de e-mail trazem o que a infra do repositório exige junto: a regra `educa-email-falhou` em `REGRAS_PROVISIONADAS` (`infra/scripts/ensaio-alertas.ts`) e dois gráficos no painel `fundacao.json` ("E-mails de convite enviados, por resultado" e "... adiados, por motivo") | `infra/test/alertas.test.ts` e `infra/test/painel.test.ts` reprovam alerta provisionado fora da lista e métrica exportada sem painel (regra 80, item 10) | `techspec.md` §5 ("E-mail"), `docs/runbook.md` ("E-mail com falha acima de 20% em 1 h") |

## Mutações

--faltando: 1 linha (67 blocos, 1 motivo). Cada bloco foi aplicado e rodado antes do pedido (executor local sobre o mesmo `comandoDoTeste` do portão): todos ficaram vermelhos, cada um num caso que rodou e falhou. A conferência achou um (o 50, a espera de 30 s com o Redis fora) verde, porque o teste comparava `baseMs` com a própria constante exportada, que a mutação também muda; o teste passou a comparar com o literal `30_000`.

Motivo da linha sem bloco:

- `packages/core/src/email/limite-por-minuto.ts:132` (`!Array.isArray(resposta) || resposta.length !== 3`): o script Lua do `consumir` devolve sempre uma tabela de três números (`{0|1, janela, ms}`), e a ioredis a entrega como array; o ramo só existe para o tipo `unknown` do `evalsha`, e não há caminho que o produza sem trocar o script. O script Lua dentro da template string o `--faltando` não enxerga, e por isso cada cláusula dele foi conferida à mão (rodada 1, `test-engineer`): o total, o teto do convite, a janela, o `devolver` na mesma janela e o `NOSCRIPT` têm bloco desde a entrega; o relógio do Redis (`if agora < 0` e a conta em ms do `TIME`), o `INCR chaveConvite` só do convite e as duas guardas `> 0` do `devolver` ganharam bloco e caso na rodada 1. Sem bloco, com motivo: o `redis.error_reply('operacao do limite de e-mail desconhecida')` do fim do script, porque as duas operações são fixas na classe (`consumir` e `devolver`) e nenhuma chamada pública manda outra.

```mutacao
arquivo: packages/core/src/email/limite-por-minuto.ts
teste: apps/worker/test/enviar-email-adiamento.int.test.ts › o teto de um é o do convite inteiro
falha: new LimiteDeEmailPorMinuto(bancada.redis, 1.5)
-if (!Number.isInteger(porMinuto) || porMinuto < 1) throw new InvariantException('EMAIL_POR_MINUTO precisa ser um inteiro positivo')
+if (porMinuto < 1) throw new InvariantException('EMAIL_POR_MINUTO precisa ser um inteiro positivo')
```

```mutacao
arquivo: packages/core/src/email/limite-por-minuto.ts
teste: apps/worker/test/enviar-email-adiamento.int.test.ts › o teto de um é o do convite inteiro
falha: new LimiteDeEmailPorMinuto(bancada.redis, 0)
-if (!Number.isInteger(porMinuto) || porMinuto < 1) throw new InvariantException('EMAIL_POR_MINUTO precisa ser um inteiro positivo')
+if (!Number.isInteger(porMinuto) || porMinuto < 0) throw new InvariantException('EMAIL_POR_MINUTO precisa ser um inteiro positivo')
```

```mutacao
arquivo: packages/core/src/email/limite-por-minuto.ts
teste: apps/worker/test/enviar-email-adiamento.int.test.ts › o teto de um é o do convite inteiro
falha: [1, 1, 2, 30]
-return porMinuto - Math.floor(porMinuto / 2)
+return Math.floor(porMinuto / 2)
```

```mutacao
arquivo: packages/core/src/email/limite-por-minuto.ts
teste: apps/worker/test/enviar-email-adiamento.int.test.ts › o ponto gasto no segundo 59
falha: toBe(false)
-this.#agora = relogio === undefined ? () => -1 : () => relogio.agora().getTime()
+this.#agora = () => -1
```

```mutacao
arquivo: packages/core/src/email/limite-por-minuto.ts
teste: apps/worker/test/enviar-email-adiamento.int.test.ts › estourado, o job é adiado
-return concedido === 1 ? { resultado: 'concedido', ponto: { classe, janela } } : { resultado: 'sem_vaga', msBeforeNext }
+return concedido === 0 ? { resultado: 'concedido', ponto: { classe, janela } } : { resultado: 'sem_vaga', msBeforeNext }
```

```mutacao
arquivo: packages/core/src/email/limite-por-minuto.ts
teste: apps/worker/test/enviar-email-adiamento.int.test.ts › o ponto gasto no segundo 59
falha: toBe(false)
-return concedido === 1 ? { resultado: 'concedido', ponto: { classe, janela } } : { resultado: 'sem_vaga', msBeforeNext }
+return concedido === 1 ? { resultado: 'concedido', ponto: { classe, janela: janela + 1 } } : { resultado: 'sem_vaga', msBeforeNext }
```

```mutacao
arquivo: packages/core/src/email/limite-por-minuto.ts
teste: apps/worker/test/enviar-email-adiamento.int.test.ts › o Redis que reiniciou sem o cache
-if (!(erro instanceof Error) || !erro.message.startsWith('NOSCRIPT')) throw erro
+if (!(erro instanceof Error) || true) throw erro
```

```mutacao
arquivo: packages/core/src/email/limite-por-minuto.ts
teste: apps/worker/test/enviar-email-adiamento.int.test.ts › dois prefixos são duas contagens
-this.#chave = `${opcoes.prefixo === undefined ? '' : `${opcoes.prefixo}:`}email:minuto`
+this.#chave = `email:minuto`
```

```mutacao
arquivo: packages/core/src/email/limite-por-minuto.ts
teste: apps/worker/test/enviar-email-adiamento.int.test.ts › mais consumos que o teto
falha: toHaveLength(10)
-if total >= porMinuto or (classe == 'convite' and convite >= tetoDoConvite) then
+if total > porMinuto or (classe == 'convite' and convite >= tetoDoConvite) then
```

```mutacao
arquivo: packages/core/src/email/limite-por-minuto.ts
teste: apps/worker/test/enviar-email-adiamento.int.test.ts › metade do teto é reservada
falha: toHaveLength(tetoDoConvite(10))
-if total >= porMinuto or (classe == 'convite' and convite >= tetoDoConvite) then
+if total >= porMinuto or (classe == 'convite' and convite > tetoDoConvite) then
```

```mutacao
arquivo: packages/core/src/email/limite-por-minuto.ts
teste: apps/worker/test/enviar-email-adiamento.int.test.ts › metade do teto é reservada
falha: toHaveLength(5)
-if total >= porMinuto or (classe == 'convite' and convite >= tetoDoConvite) then
+if total >= porMinuto or (convite >= tetoDoConvite) then
```

```mutacao
arquivo: packages/core/src/email/limite-por-minuto.ts
teste: apps/worker/test/enviar-email-adiamento.int.test.ts › o ponto gasto no segundo 59
falha: toBe(false)
-if janela ~= janelaAtual then
+if false then
```

```mutacao
arquivo: packages/core/src/email/limite-por-minuto.ts
teste: apps/worker/test/enviar-email-adiamento.int.test.ts › o ponto do link da conta que volta
falha: resultado: 'sem_vaga'
-if classe == 'convite' and tonumber(redis.call('GET', chaveConvite) or '0') > 0 then
+if tonumber(redis.call('GET', chaveConvite) or '0') > 0 then
```

```mutacao
arquivo: apps/worker/src/job-executor.ts
teste: apps/worker/src/job-executor.test.ts › dois sorteios diferentes
falha: toBeGreaterThan(1)
-this.#sortear = dependencias.sortear ?? Math.random
+this.#sortear = dependencias.sortear ?? (() => 0)
```

```mutacao
arquivo: apps/worker/src/job-executor.ts
teste: apps/worker/src/job-executor.test.ts › o processador que escuta o sinal e rejeita ao abortar
-if (emAndamento.interrompida) throw new QueueFacingError(JobFailureCode.EXECUCAO_INTERROMPIDA)
```

```mutacao
arquivo: apps/worker/src/job-executor.ts
teste: apps/worker/src/job-executor.test.ts › volta à espera da fila sem gastar tentativa
-if (erro instanceof JobAdiadoError) {
+if (false) {
```

```mutacao
arquivo: apps/worker/src/job-executor.ts
teste: apps/worker/src/job-executor.test.ts › estouro com tentativa sobrando
-if (falha instanceof UnrecoverableError || erro instanceof JobTimeoutError) {
+if (falha instanceof UnrecoverableError) {
```

```mutacao
arquivo: apps/worker/src/job-executor.ts
teste: apps/worker/src/job-executor.test.ts › falha definitiva com renovação em andamento
-if (falha instanceof UnrecoverableError || erro instanceof JobTimeoutError) {
+if (erro instanceof JobTimeoutError) {
```

```mutacao
arquivo: apps/worker/src/job-executor.ts
teste: apps/worker/src/job-executor.test.ts › a tentativa adiada pelo processador não conta
falha: toEqual([])
-if (contar) this.dependencias.uso.marcar('jobs')
+if (true) this.dependencias.uso.marcar('jobs')
```

```mutacao
arquivo: apps/worker/src/job-executor.ts
teste: apps/worker/src/job-executor.test.ts › cada tentativa que roda conta
-if (contar) this.dependencias.uso.marcar('jobs')
+if (false) this.dependencias.uso.marcar('jobs')
```

```mutacao
arquivo: apps/worker/src/job-executor.ts
teste: apps/worker/src/job-executor.test.ts › a tentativa adiada pelo processador não conta
falha: toEqual([])
-this.terminarTentativa(emAndamento, !(erro instanceof JobAdiadoError))
+this.terminarTentativa(emAndamento, true)
```

```mutacao
arquivo: apps/worker/src/job-executor.ts
teste: apps/worker/src/job-executor.test.ts › job sem token do BullMQ não pode ser adiado
-if (token === undefined) throw new InvariantException('job sem token do BullMQ não pode ser adiado')
```

```mutacao
arquivo: apps/worker/src/job-executor.ts
teste: apps/worker/src/job-executor.test.ts › volta à espera da fila sem gastar tentativa
 if (token === undefined) throw new InvariantException('job sem token do BullMQ não pode ser adiado')
-await this.liberarVaga(vaga)
```

```mutacao
arquivo: apps/worker/src/job-executor.ts
teste: apps/worker/test/enviar-email-adiamento.int.test.ts › o job adiado solta a vaga
 if (token === undefined) throw new InvariantException('job sem token do BullMQ não pode ser adiado')
-await this.liberarVaga(vaga)
```

```mutacao
arquivo: apps/worker/src/job-executor.ts
teste: apps/worker/src/job-executor.test.ts › volta à espera da fila sem gastar tentativa
-await this.dependencias.repositorio.devolverAoPublicado(vaga.jobId)
```

```mutacao
arquivo: apps/worker/src/job-executor.ts
teste: apps/worker/src/job-executor.test.ts › a espera é a pedida
-const esperaMs = baseMs + Math.floor(this.#sortear() * SORTEIO_DO_ADIAMENTO_MS)
+const esperaMs = ESPERA_POR_VAGA_MS + Math.floor(this.#sortear() * SORTEIO_DO_ADIAMENTO_MS)
```

```mutacao
arquivo: apps/worker/src/job-executor.ts
teste: apps/worker/src/job-executor.test.ts › a espera é a pedida
falha: toBeLessThan(baseMs + SORTEIO_DO_ADIAMENTO_MS)
-const esperaMs = baseMs + Math.floor(this.#sortear() * SORTEIO_DO_ADIAMENTO_MS)
+const esperaMs = baseMs + Math.floor(this.#sortear() * SORTEIO_DO_ADIAMENTO_MS * 2)
```

```mutacao
arquivo: packages/core/src/queue/job-outbox.repository.ts
teste: apps/worker/test/enviar-email-adiamento.int.test.ts › só alcança o job
 .set({ estado: 'publicado' })
-.where(and(eq(jobRegistro.id, id), jobScopeInContext(), eq(jobRegistro.estado, 'ativo')))
+.where(and(eq(jobRegistro.id, id), eq(jobRegistro.estado, 'ativo')))
```

```mutacao
arquivo: packages/core/src/queue/job-outbox.repository.ts
teste: apps/worker/test/enviar-email-adiamento.int.test.ts › só alcança o job
 .set({ estado: 'publicado' })
-.where(and(eq(jobRegistro.id, id), jobScopeInContext(), eq(jobRegistro.estado, 'ativo')))
+.where(and(eq(jobRegistro.id, id), jobScopeInContext()))
```

```mutacao
arquivo: packages/core/src/queue/job-outbox.repository.ts
teste: apps/worker/test/enviar-email-adiamento.int.test.ts › só alcança o job
-.set({ estado: 'publicado' })
+.set({ estado: 'reservado' })
```

```mutacao
arquivo: apps/worker/src/processors/enviar-email.ts
teste: apps/worker/test/enviar-email-adiamento.int.test.ts › conta `reserva_perdida`
-const resultadoGravado = (gravou: boolean, resultado: 'enviado' | 'falhou'): 'enviado' | 'falhou' | 'reserva_perdida' => (gravou ? resultado : 'reserva_perdida')
+const resultadoGravado = (gravou: boolean, resultado: 'enviado' | 'falhou'): 'enviado' | 'falhou' | 'reserva_perdida' => (gravou ? resultado : resultado)
```

```mutacao
arquivo: apps/worker/src/processors/enviar-email.ts
teste: apps/worker/test/enviar-email.int.test.ts › o 5xx de quem perdeu a reserva
-logger.warn({ evento: 'email.convite_falhou', conviteId, tentativa, tipo, estado: gravou ? 'gravado' : 'reserva_perdida' })
+logger.warn({ evento: 'email.convite_falhou', conviteId, tentativa, tipo, estado: 'gravado' })
```

```mutacao
arquivo: apps/worker/src/processors/enviar-email.ts
teste: apps/worker/test/enviar-email.int.test.ts › revogado com o job na barreira
-logger.info({ evento: 'email.convite_enviado', conviteId, tentativa, estado: gravou ? 'gravado' : 'reserva_perdida' })
+logger.info({ evento: 'email.convite_enviado', conviteId, tentativa, estado: 'gravado' })
```

```mutacao
arquivo: apps/worker/src/processors/enviar-email.ts
teste: apps/worker/test/enviar-email.int.test.ts › a queda que não é uma recusa do servidor
-const tipo = erro instanceof EmailSendError ? erro.natureza : 'transitoria'
+const tipo = erro instanceof EmailSendError ? erro.natureza : 'permanente'
```

```mutacao
arquivo: apps/worker/src/processors/enviar-email.ts
teste: apps/worker/test/enviar-email.int.test.ts › 5xx: o convite termina
-if (tipo === 'permanente' || tentativa >= TENTATIVAS_DO_ENVIO_DE_EMAIL) return gravarFalhaDoEnvio(pecas, envio, tipo)
+if (tentativa >= TENTATIVAS_DO_ENVIO_DE_EMAIL) return gravarFalhaDoEnvio(pecas, envio, tipo)
```

```mutacao
arquivo: apps/worker/src/processors/enviar-email.ts
teste: apps/worker/test/enviar-email.int.test.ts › sempre 4xx
-if (tipo === 'permanente' || tentativa >= TENTATIVAS_DO_ENVIO_DE_EMAIL) return gravarFalhaDoEnvio(pecas, envio, tipo)
+if (tipo === 'permanente' || false) return gravarFalhaDoEnvio(pecas, envio, tipo)
```

```mutacao
arquivo: apps/worker/src/processors/enviar-email.ts
teste: apps/worker/test/enviar-email-adiamento.int.test.ts › o job adia por 30 s
-if (consumo === undefined) adiar(conviteId, tentativa, ESPERA_COM_REDIS_FORA_MS, 'redis')
+if (false) adiar(conviteId, tentativa, ESPERA_COM_REDIS_FORA_MS, 'redis')
```

```mutacao
arquivo: apps/worker/src/processors/enviar-email.ts
teste: apps/worker/test/enviar-email-adiamento.int.test.ts › estourado, o job é adiado
-if (consumo.resultado === 'sem_vaga') adiar(conviteId, tentativa, consumo.msBeforeNext, 'limite')
+if (false) adiar(conviteId, tentativa, consumo.msBeforeNext, 'limite')
```

```mutacao
arquivo: apps/worker/src/processors/enviar-email.ts
teste: apps/worker/test/enviar-email-adiamento.int.test.ts › o job adia por 30 s
-const consumo = await limite.consumir('convite').catch(() => undefined)
+const consumo = await limite.consumir('convite')
```

```mutacao
arquivo: apps/worker/src/processors/enviar-email.ts
teste: apps/worker/test/enviar-email-adiamento.int.test.ts › a tentativa recusada pelo SMTP
-if (reservado.resultado === 'reservado') return reservado
+if (false) return reservado
```

```mutacao
arquivo: apps/worker/src/processors/enviar-email.ts
teste: apps/worker/test/enviar-email-adiamento.int.test.ts › com o teto em 1 e o ponto gasto por
 if (reservado.resultado === 'reservado') return reservado
-await devolverPonto(ponto)
```

```mutacao
arquivo: apps/worker/src/processors/enviar-email.ts
teste: apps/worker/test/enviar-email-adiamento.int.test.ts › a reentrega com a reserva alheia
-if (reservado.resultado === 'reserva_alheia') adiar(conviteId, tentativa, Math.max(0, reservado.ate.getTime() - relogio.agora().getTime()), 'reserva_alheia')
+if (false) adiar(conviteId, tentativa, Math.max(0, reservado.ate.getTime() - relogio.agora().getTime()), 'reserva_alheia')
```

```mutacao
arquivo: apps/worker/src/processors/enviar-email.ts
teste: apps/worker/test/enviar-email-adiamento.int.test.ts › a reentrega com a reserva alheia
falha: baseMs: 40_000
-if (reservado.resultado === 'reserva_alheia') adiar(conviteId, tentativa, Math.max(0, reservado.ate.getTime() - relogio.agora().getTime()), 'reserva_alheia')
+if (reservado.resultado === 'reserva_alheia') adiar(conviteId, tentativa, 0, 'reserva_alheia')
```

```mutacao
arquivo: apps/worker/src/processors/enviar-email.ts
teste: apps/worker/test/enviar-email-adiamento.int.test.ts › o resultado e o adiamento são lidos
-porResultado?.add(1, { resultado: 'ignorado' })
```

```mutacao
arquivo: apps/worker/src/processors/enviar-email.ts
teste: apps/worker/test/enviar-email-adiamento.int.test.ts › com o teto em 1 e o ponto gasto por
-if (reservado.resultado !== 'reservado') return
+if (false) return
```

```mutacao
arquivo: apps/worker/src/processors/enviar-email.ts
teste: apps/worker/test/enviar-email-adiamento.int.test.ts › a cifra que não decifra termina
-if (mensagem === undefined) {
+if (false) {
```

```mutacao
arquivo: apps/worker/src/processors/enviar-email.ts
teste: apps/worker/test/enviar-email-adiamento.int.test.ts › a cifra que não decifra termina
 if (mensagem === undefined) {
-await devolverPonto(ponto)
```

```mutacao
arquivo: apps/worker/src/processors/enviar-email.ts
teste: apps/worker/test/enviar-email-adiamento.int.test.ts › o banco que falha na reserva
 } catch (erro) {
-await devolverPonto(ponto)
 throw erro
```

```mutacao
arquivo: apps/worker/src/processors/enviar-email.ts
teste: apps/worker/test/enviar-email-adiamento.int.test.ts › o Redis que falha ao devolver o ponto
-await limite.devolver(ponto).catch(() => false)
+await limite.devolver(ponto)
```

```mutacao
arquivo: apps/worker/src/processors/enviar-email.ts
teste: apps/worker/test/enviar-email-adiamento.int.test.ts › o job adia por 30 s
-export const ESPERA_COM_REDIS_FORA_MS = 30_000
+export const ESPERA_COM_REDIS_FORA_MS = 1_000
```

```mutacao
arquivo: apps/worker/src/processors/enviar-email.ts
teste: apps/worker/test/enviar-email-adiamento.int.test.ts › o resultado e o adiamento são lidos
-adiados?.add(1, { motivo: tipo })
```

```mutacao
arquivo: apps/worker/src/processors/enviar-email.ts
teste: apps/worker/test/enviar-email-adiamento.int.test.ts › o 4xx conta só
-porResultado?.add(1, { resultado: 'nova_tentativa' })
```

```mutacao
arquivo: packages/core/src/email/email-config.ts
teste: packages/core/src/email/email-config.test.ts › o teto de mensagens por minuto
-EMAIL_POR_MINUTO: opcional(z.coerce.number().int().min(1).max(100_000).default(60)),
+EMAIL_POR_MINUTO: opcional(z.coerce.number().int().min(0).max(100_000).default(60)),
```

```mutacao
arquivo: packages/core/src/email/email-config.ts
teste: packages/core/src/email/email-config.test.ts › o teto de mensagens por minuto
-EMAIL_POR_MINUTO: opcional(z.coerce.number().int().min(1).max(100_000).default(60)),
+EMAIL_POR_MINUTO: opcional(z.coerce.number().int().min(1).max(1_000_000).default(60)),
```

```mutacao
arquivo: packages/core/src/email/email-config.ts
teste: packages/core/src/email/email-config.test.ts › o teto de mensagens por minuto
-EMAIL_POR_MINUTO: opcional(z.coerce.number().int().min(1).max(100_000).default(60)),
+EMAIL_POR_MINUTO: opcional(z.coerce.number().int().min(1).max(100_000).default(30)),
```

```mutacao
arquivo: packages/core/src/email/email-config.ts
teste: packages/core/src/email/email-config.test.ts › o teto de mensagens por minuto
-porMinuto: valores.EMAIL_POR_MINUTO,
+porMinuto: 60,
```

```mutacao
arquivo: apps/worker/src/composition.ts
teste: apps/worker/src/composition.test.ts › as peças do e-mail só existem
-if (email === undefined || banco === undefined || fila === undefined) return undefined
+if (banco === undefined || fila === undefined) return undefined
```

```mutacao
arquivo: apps/worker/src/composition.ts
teste: apps/worker/src/composition.test.ts › as peças do e-mail só existem
-if (email === undefined || banco === undefined || fila === undefined) return undefined
+if (email === undefined || fila === undefined) return undefined
```

```mutacao
arquivo: apps/worker/src/composition.ts
teste: apps/worker/src/composition.test.ts › as peças do e-mail só existem
-if (email === undefined || banco === undefined || fila === undefined) return undefined
+if (email === undefined || banco === undefined) return undefined
```

```mutacao
arquivo: apps/worker/src/composition.ts
teste: apps/worker/src/composition.test.ts › a réplica sem a configuração do e-mail
-...(email === undefined ? {} : { [TIPO_ENVIAR_CONVITE]: criarEnvioDoConvite({ ...email, logger, medidor }) }),
+...(false ? {} : { [TIPO_ENVIAR_CONVITE]: criarEnvioDoConvite({ ...email, logger, medidor }) }),
```

```mutacao
arquivo: packages/core/src/email/limite-por-minuto.ts
teste: apps/worker/test/enviar-email-adiamento.int.test.ts › sem relógio injetado, a janela e o `msBeforeNext` vêm do `TIME` do Redis
-if agora < 0 then
+if false then
```

```mutacao
arquivo: packages/core/src/email/limite-por-minuto.ts
teste: apps/worker/test/enviar-email-adiamento.int.test.ts › sem relógio injetado, a janela e o `msBeforeNext` vêm do `TIME` do Redis
-agora = tonumber(tempo[1]) * 1000 + math.floor(tonumber(tempo[2]) / 1000)
+agora = tonumber(tempo[1]) + math.floor(tonumber(tempo[2]) / 1000)
```

```mutacao
arquivo: packages/core/src/email/limite-por-minuto.ts
teste: apps/worker/test/enviar-email-adiamento.int.test.ts › o link da conta não enche o contador do convite
-if classe == 'convite' then
+if true then
```

```mutacao
arquivo: packages/core/src/email/limite-por-minuto.ts
teste: apps/worker/test/enviar-email-adiamento.int.test.ts › o mesmo ponto devolvido duas vezes não abre mais do que gastou
-if tonumber(redis.call('GET', chaveTotal) or '0') > 0 then
+if tonumber(redis.call('GET', chaveTotal) or '0') >= 0 then
```

```mutacao
arquivo: packages/core/src/email/limite-por-minuto.ts
teste: apps/worker/test/enviar-email-adiamento.int.test.ts › o mesmo ponto devolvido duas vezes não abre mais do que gastou
-if classe == 'convite' and tonumber(redis.call('GET', chaveConvite) or '0') > 0 then
+if classe == 'convite' and tonumber(redis.call('GET', chaveConvite) or '0') >= 0 then
```

```mutacao
arquivo: apps/worker/src/processors/enviar-email.ts
teste: apps/worker/test/enviar-email-adiamento.int.test.ts › o resultado e o adiamento são lidos
falha: falhou: 2
 await envios.concluir(conviteId, reservado.reserva, 'falhou')
-porResultado?.add(1, { resultado: 'falhou' })
```

```mutacao
arquivo: apps/worker/src/job-executor.ts
teste: apps/worker/src/job-executor.test.ts › adiado com a renovação do intervalo em andamento
 if (erro instanceof JobAdiadoError) {
-await renovacao.parar()
 return this.adiar(job, vaga, token, erro)
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (1ª) | `job-executor.ts:446`: o retorno `false` de `devolverAoPublicado` é ignorado; um aviso no log (`job.adiado_sem_linha`, só com ids) mostraria uma linha fora de `ativo` | `TODO.md`: cria evento de log novo, que pede teste e bloco próprios, e não muda o isolamento (nenhum dado vaza) |
| conformidade-reviewer (1ª) | O texto do runbook ("o professor não recebe o convite") está bem; se virar lista ou painel com o nome do destinatário, vale lembrar o item 8 da regra 70 | Recusada, com o motivo: o aviso é para o futuro e nada muda hoje; as métricas não levam usuário, convite nem escola |
| privacy-guardian (1ª) | Pôr no `docs/lgpd.md` uma linha sobre o contador global `EMAIL_POR_MINUTO`, ao lado dos "Contadores do acesso" | `TODO.md`: `docs/lgpd.md` não é arquivo desta tarefa e o contador não é campo pessoal (regra 20, item 1 não se aplica) |
| revisor-geral (1ª) e infra-guardian (1ª) | Falta alerta para adiamento longo na fila normal: a Tech Spec §7c diz "adiamento longo: o alerta de idade da fila", e ele só existe para a `interativa` (`job-interativo-esperando.yaml`); o runbook já manda olhar `job_espera_mais_antiga_s` à mão | `TODO.md`, e a Mesa leva ao Orquestrador no relatório: o Arquiteto corrige o texto da §7c ou abre a regra de `job_espera_mais_antiga_s{fila="normal"}` numa tarefa de infra. Nenhum dos dois reprovou |
| revisor-geral (1ª) | `enviar-email.ts:141-142`: o `concluir(..., 'falhou')` da cifra ignora o booleano e conta sempre `falhou`; usar `resultadoGravado` | `TODO.md`: muda o rótulo de uma métrica que o alerta lê (comportamento), e só aparece com a revogação vencendo o envio justo na cifra que não decifra |
| revisor-geral (1ª) | `enviar-email.ts:183-187`: se o `concluir` de `montarMensagem` lançar erro do banco, o ponto não volta | `TODO.md`: muda comportamento (um ponto perdido até o fim do minuto) e pede caso e bloco novos |
| infra-guardian (1ª) | O teto é global e não divide a vez entre escolas; dez escolas no teto pedem 3000/h e o convite só tem 1800/h | Tarefa 3.0 (a cota de 300/h do "Enviar"), e o modelo de carga em `docs/infra.md`, seção 3 |
| infra-guardian (1ª) | O job adiado solta a vaga e o despachante publica o resto da fila de e-mail da escola, que disputa a vaga `normal` a cada minuto | `docs/infra.md`, seção 3 (modelo de carga), antes de crescer além de dez escolas |
| infra-guardian (1ª) | O script Lua monta as chaves fora de `KEYS`: quebra em Redis gerenciado em modo cluster | `TODO.md`, para a migração da D26/D42: passar as chaves por `KEYS` com hash tag |
| infra-guardian (1ª) | O uso (`jobs`) é contado ao fim da tentativa: a que morre com o processo não entra; anotar na D14 | `TODO.md`: a diferença é pequena e a nota é da decisão, não da tarefa |
| revisor-geral (2ª) | As sete linhas que a tabela "Recomendações sem aplicar" manda para o `TODO.md` ainda não existem lá (`job.adiado_sem_linha`; a linha do `lgpd.md` sobre o contador; o alerta de idade da fila `normal`, §7c; o `resultadoGravado` da cifra; o ponto que se perde quando o `concluir` falha; as chaves do Lua fora de `KEYS`; a nota da D14) | **Antes do commit:** o Implementador escreve as sete linhas no `TODO.md`, uma por destino da rodada 1 (escrever no `TODO.md` não derruba o carimbo, segundo o revisor, `caducidade.ts:249`). O `task-template.md` pede a linha já escrita no commit da tarefa |
| revisor-geral (2ª) | A asserção `new Set(esperas).size > 1` saiu do teste de integração; o sorteio varia só na unidade (`job-executor.test.ts › dois sorteios diferentes`) | **Antes do commit:** o Implementador anota isso no `2_task.md`, para ninguém procurar a prova no teste de integração (documento da tarefa não caduca o carimbo) |
| test-engineer (2ª), infra-guardian (2ª) e revisor-geral (2ª) | O caso "o limite com o relógio do Redis" espera até ~10 s do relógio de verdade quando cai perto da virada do minuto; aceitar a janela seguinte nas asserções, ou aumentar o prazo | `TODO.md`, só se pesar na esteira: o caso cabe no prazo de 60 s e pesa uma rodada em seis; mudá-lo caduca todos os revisores |
| test-engineer (2ª) | O caso do relógio do Redis confere a janela e o `msBeforeNext` por faixa, não por igualdade; ler o `TIME` dentro de um `MULTI` junto do consumo | Recusada: o revisor diz que já derruba as duas mutações e que isso só melhora o teste |
| tenancy-guardian (2ª) e privacy-guardian (2ª) | O comentário do teste de log (`enviar-email-adiamento.int.test.ts:57-62`, `:199`) fala em "nunca o endereço nem o token", e a asserção só cobre o endereço; incluir o token decifrado na checagem, ou deixar o comentário falar só do endereço | `TODO.md`: o ajuste mexe no arquivo de teste e caducaria o `test-engineer` e o `revisor-geral` de uma tarefa já aprovada; o código não loga o token |
| conformidade-reviewer (2ª) | Se a falha de convite virar lista ou painel com o nome do destinatário, revisar contra o item 8 da regra 70 | Recusada, com o motivo: aviso para o futuro; hoje as métricas não levam usuário, convite nem escola |
| infra-guardian (2ª) | Continuam valendo as recomendações de infra da rodada 1 (teto global sem divisão entre escolas, chaves do Lua fora de `KEYS`, alerta de idade da fila `normal`) | Já na tabela da rodada 1, com destino (tarefa 3.0, `docs/infra.md` seção 3, `TODO.md`) |

**Sorteio da espera.** A espera do job adiado ser sorteada (e não fixa) não tem prova no teste de integração: a asserção `new Set(esperas).size > 1` saiu na rodada 1, por ser decorativa. O sorteio varia e é provado na unidade, em `apps/worker/src/job-executor.test.ts › [U] dois sorteios diferentes dão esperas diferentes, e o sorteio padrão não é um valor fixo` e `› [U] a espera é a pedida … mais o sorteio`. O teste de integração só prova que a espera fica entre o `msBeforeNext` e ele mais 5 s.

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-07 21:15:49 | 2026-11-07 21:16:20 | `tenancy-guardian` | 1 | APROVADO | a4f3ce131e4c165a8 |
| 2026-11-07 21:16:00 | 2026-11-07 21:16:28 | `conformidade-reviewer` | 1 | APROVADO | aee322b5f6d182f05 |
| 2026-11-07 21:15:59 | 2026-11-07 21:16:52 | `privacy-guardian` | 1 | APROVADO | a5147ac6b9e9dc267 |
| 2026-11-07 21:15:56 | 2026-11-07 21:17:22 | `revisor-geral` | 1 | APROVADO | a5a829ab47c724a45 |
| 2026-11-07 21:15:46 | 2026-11-07 21:18:51 | `infra-guardian` | 1 | APROVADO | aa6868984ecd34942 |
| 2026-11-07 21:15:53 | 2026-11-07 21:19:21 | `test-engineer` | 1 | REPROVADO | ab223f83115e760b1 |
| 2026-11-07 21:39:41 | 2026-11-07 21:40:02 | `infra-guardian` | 2 | APROVADO | a8f12aded8ae959be |
| 2026-11-07 21:39:48 | 2026-11-07 21:40:16 | `tenancy-guardian` | 2 | APROVADO | a5a26ffe85ab47b0f |
| 2026-11-07 21:40:00 | 2026-11-07 21:40:19 | `conformidade-reviewer` | 2 | APROVADO | a834cd94fbfdc5542 |
| 2026-11-07 21:39:54 | 2026-11-07 21:40:19 | `privacy-guardian` | 2 | APROVADO | a355083b4765f77c3 |
| 2026-11-07 21:39:31 | 2026-11-07 21:40:33 | `test-engineer` | 2 | APROVADO | a3651b13da4162762 |
| 2026-11-07 21:39:38 | 2026-11-07 21:40:43 | `revisor-geral` | 2 | APROVADO | ac6b62081920026d1 |
