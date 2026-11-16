# Tarefa 10.0 — Toda chamada de modelo passa pelo limite de tokens por minuto, com degradação (49.0)

**Funcionalidade:** reengenharia-continuacao · **Depende de:** 9.0
**Subagentes obrigatórios:** `infra-guardian`, `conformidade-reviewer`, `llm-integrator`
**Porte:** grande

## Objetivo

O `LLMGateway` reserva tokens antes de cada chamada, num limite somado entre as réplicas; sem vaga, espera até 8 s, vai ao
modelo menor (nunca no `turno_do_tutor`) e termina `IA_INDISPONIVEL`, sem troca nem erro cru, dentro do prazo único.

## Contexto necessário

- `techspec.md` §2 (linhas `packages/core/src/ia/` e `llm-config.ts`), §5 "Os tokens (49.0)", §7c, §11, §12
- `prd.md` RF7, RF8; §8b
- `onda-3c.md` "T10" (as métricas; o limitador de lá dá lugar ao `RateLimiterRedis`, D81); regras 30, 40, 70, 80
- Código: `packages/core/src/ia/llm-gateway.ts`, `resilient-adapter.ts`, `consumo.ts`; `packages/core/src/rate-limit/rate-limiter.ts`
  (`insuranceLimiter`, l.138)

## Subtarefas

- [x] 10.1 — `TokenLimiter.reservar(modelo, estimativa, fila)` com os baldes da §5
- [x] 10.2 — No gateway, depois da D62 e do teto: a espera (`msBeforeNext`, `pedido.sinal`), o modelo menor e o fim
- [x] 10.3 — Configuração; métricas; alertas "Provedor de IA fora" e "Tokens acima de 80 %" com runbook; a AIA (limitação)
- [x] 10.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/ia/token-limiter.ts`, `packages/core/src/ia/token-limiter.test.ts`, `packages/core/src/ia/token-limiter.int.test.ts`, `apps/api/src/ia/prazo-com-tokens.int.test.ts`, `infra/grafana/alertas/ia-provedor-fora.yaml`, `infra/grafana/alertas/ia-tokens-acima-do-teto.yaml` | novo |
| `packages/core/src/ia/llm-gateway.ts`, `packages/core/src/ia/llm-gateway.test.ts`, `packages/core/src/ia/consumo.ts`, `packages/core/src/ia/perfis.ts`, `packages/core/src/config/llm-config.ts`, `packages/core/src/config/llm-config.test.ts`, `packages/core/src/index.ts`, `apps/api/src/main-worker.ts`, `.env.example`, `infra/test/alertas.test.ts`, `docs/runbook.md`, `docs/aia/tutor.md`, `docs/infra.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| um degrau por teste | U | com vaga roda; sem vaga espera 8 s; o menor; `IA_INDISPONIVEL`; cada um com a sua métrica | `packages/core/src/ia/llm-gateway.test.ts` › "com vaga, a chamada roda no modelo do perfil…", "degrau 1…", "degrau 2…", "degrau 3…" |
| Tutor pula o menor | U | `turno_do_tutor` sem vaga termina `IA_INDISPONIVEL`. Mutação: permitir o degrau no Tutor | `packages/core/src/ia/llm-gateway.test.ts` › "o turno do Tutor pula o modelo menor (D36, regra 30, item 11)…" |
| sem modelo menor | U | o degrau é pulado, e a métrica do degrau não muda | `packages/core/src/ia/llm-gateway.test.ts` › "sem modelo menor configurado para o perfil…" |
| menor sem preço | U | a subida falha | `packages/core/src/ia/llm-gateway.test.ts` › "modelo menor sem preço em PRECO_DOS_MODELOS: a subida falha…" |
| menor e a D55 | U | `propor_ferramenta` com nota na saída do menor é recusada | `packages/core/src/ia/llm-gateway.test.ts` › "a saída do modelo menor passa pela mesma conferência…" (unidade: a regra fixa da D55 é do gateway, e o menor é o `ScriptedAdapter`) |
| `consumo_ia` | U | grava o modelo que respondeu | `packages/core/src/ia/llm-gateway.test.ts` › "degrau 2…" (o registro do menor); `apps/api/src/ia/prazo-com-tokens.int.test.ts` › "o menor de 100 s…" (o consumo grava o menor) |
| a ordem | U | a D62 e o teto recusam antes do `reservar`: nada reservado. Mutação: reservar antes | `packages/core/src/ia/llm-gateway.test.ts` › "a ordem: a D62 e o teto…", "o orçamento recusa antes do reservar…" |
| prazo, espera dentro | I | vaga aos 7 s, o principal pendura: 140 s, não 147 s; Tutor aos 60 s. "Espera fora do prazo" não tem bloco (é implementação alternativa, e não cláusula do diff): o caso a pegaria, porque a execução acabaria aos 147 s | `apps/api/src/ia/prazo-com-tokens.int.test.ts` › "espera dentro do prazo…", "o Tutor, com a vaga aos 7 s…" |
| prazo e o menor | I | 8 s sem vaga e o menor pendurado: aos 140 s com chamada de 600 s ("espera fora": 148 s); aos 108 s com chamada de 100 s ("só o que sobra": 140 s). Os dois são implementações alternativas, sem bloco de mutação: os casos as pegariam pelo instante em que a execução termina | `apps/api/src/ia/prazo-com-tokens.int.test.ts` › "o menor pendurado…", "o menor de 100 s…" |
| prazo na 2.ª reserva | I | 1.ª inválida aos 135 s, sem vaga para a 2.ª: termina aos 140 s, não 143 s. Mutação: a espera ignora o `pedido.sinal` | `apps/api/src/ia/prazo-com-tokens.int.test.ts` › "a 2.ª reserva…"; `packages/core/src/ia/llm-gateway.test.ts` › "o prazo que vence durante a espera a encerra na hora…" |
| baldes | I | a `ferramenta` no teto dela não consome o geral, e o Tutor roda. Sem bloco de mutação para "consumir o geral antes": é uma implementação alternativa, e não uma cláusula do diff; o caso a pegaria pela construção (o geral gastaria o que a fila recusou) | `packages/core/src/ia/token-limiter.int.test.ts` › "a `ferramenta` no teto dela não consome o balde geral…" |
| tetos das filas | I | a `ferramenta` (15 %) e a `normal` (10 %) no teto esperam enquanto o Tutor da mesma escola roda | `packages/core/src/ia/token-limiter.int.test.ts` › "a `ferramenta` (15 %) e a `normal` (10 %) no teto esperam enquanto o Tutor roda" |
| réplicas | P | duas réplicas reservando em paralelo somam no mesmo balde | `packages/core/src/ia/token-limiter.int.test.ts` › "duas réplicas reservando em paralelo somam no mesmo balde…", "com as reservas abertas juntas pelas duas réplicas…", "duas réplicas reservando juntas na `ferramenta` somam no balde da fila (15 %)…" |
| Redis fora | I | cada réplica segura o teto ÷ `IA_REPLICAS` | `packages/core/src/ia/token-limiter.int.test.ts` › "com o Redis fora, cada réplica segura o teto ÷ IA_REPLICAS…"; `packages/core/src/ia/token-limiter.test.ts` › "com duas réplicas, o seguro de cada uma tem metade do balde geral" |
| configuração | U | `LLM_TOKENS_POR_MINUTO` ausente fora do `AMBIENTE=local`: não sobe. Busca pelas variáveis que saíram | `packages/core/src/config/llm-config.test.ts` › "LLM_TOKENS_POR_MINUTO é obrigatória fora de local e opcional no local (49.0)"; `packages/core/src/config/llm-config.test.ts` › "as variáveis que a 5.0 tirou (IA_EXECUCOES_POR_ESCOLA, …)" (a busca pelas variáveis que saíram); `apps/api/src/ia/fila-de-ia.int.test.ts` › "o `main-worker` monta o limite de tokens quando há `LLM_TOKENS_POR_MINUTO`…" (a fiação); `apps/api/src/config.test.ts` (a API também recusa a produção sem a variável) |
| métricas | U | nenhuma leva usuário nem escola | `packages/core/src/ia/llm-gateway.test.ts` › "as métricas do gateway nunca levam usuário nem escola…", "a duração e os erros da chamada ao provedor…", "o uso do teto é o da última reserva do modelo…" |
| uso do teto cheio | U | o contratado que não é redondo, com o balde lotado, e a recusa com sobra menor que o pedido valem os dois `>= 0,8`; o modelo que o consumo grava é o que recebeu o pedido | `packages/core/src/ia/token-limiter.test.ts` › "o contratado que não é redondo…", "a saturação de verdade…"; `packages/core/src/ia/llm-gateway.test.ts` › "o modelo menor que falha…" |
| alertas | U | "Tokens acima de 80 %" dispara com ≥ 0,8 do contratado, o aviso aos 70 %; "Provedor de IA fora"; `alerta-tem-runbook`. Mutação: trocar um limiar | `infra/test/alertas.test.ts` › "são as das Tech Specs, com o `for:` e o limiar declarados…"; `tools/guardas/alerta-tem-runbook.test.ts` |
| log | U | o degrau só com tarefa, modelo e código | `packages/core/src/ia/llm-gateway.test.ts` › "o log de cada degrau leva só o evento, a tarefa, o id do modelo e o código…" |

## Como testar

- Prazo e espera: `packages/core/src/ia/resilient-adapter.test.ts` › "o prazo que acaba durante a espera da repetição a
  cancela: nenhum pedido sai depois dele" e "o prazo cobre a chamada e a repetição…"
- Seguro com o Redis fora: `packages/core/src/rate-limit/school-semaphore.test.ts` › "o cliente que não está pronto nem é
  consultado: quem conta é o seguro…"
- Relógio único: o prazo e o `prazoMs` no mesmo relógio falso (`cenarios.md` §4)
- Comando: `npx vitest run --project unidade packages/core/src/ia/token-limiter.test.ts`

## Autoconferência

As 12 perguntas do modelo, respondidas no plano (10.0). Na 1: o `reward`, o pulo do Tutor e cada percentual são blocos. Na 10: o caso das
réplicas com as reservas abertas juntas.

1. **Mutação de cada cláusula:** a seção "Mutações" tem 81 blocos, um por cláusula do diff que o teste alcança: cada percentual dos baldes (80, 15 e 10 %), o pulo do Tutor
   (`interativa` sem balde de fila), o balde da fila consumido antes do geral, a recusa da fila sem consultar o geral, o `reward` do balde da fila quando o geral recusa, o
   `reward` da reserva recusada (tirado na chamada e dentro de `#devolverARecusada`), o acerto pelo uso real nos dois baldes, a janela do acerto (`venceEm`), o `penalty` do uso
   maior, o teto da estimativa pelo tamanho do balde, o mínimo de 1 token, o seguro `÷ IA_REPLICAS`, o uso do teto; no gateway, a ordem (reservar antes da D62, do teto e do
   orçamento), a regra fixa sem reserva, a espera cortada pelo `pedido.sinal` e a espera sem corte, o menor (`TAREFAS_SEM_MODELO_MENOR`, o modelo menor ausente, a chamada
   no menor, o preço do menor na subida), o log de cada degrau, a métrica de cada degrau, o uso do teto (validade de um minuto, a recusa sem uso), a repetição que leva a
   correção ao modelo e ao disjuntor por modelo; na configuração, as duas variáveis (a obrigatória fora do `local`, os menores por perfil); na fiação, o limitador do módulo
   do worker e a `fila` do comando; nos alertas, cada limiar e cada `for:`. O `--faltando` dá 0 linhas. Aplicados todos antes do portão, com o `conferirMutacoes` e o `rodarCalado`
   dele: 81 vermelhos. Dois deles (as duas linhas de `saidaDeReserva`, e a que relança erro que não é do `rate-limiter-flexible`) entram como contexto de um bloco vizinho, porque
   a linha sozinha não tem mutação observável: `validar` de um valor que não existe já devolve "não ok", e o limitador com seguro só devolve `RateLimiterRes`.
2. **Texto na tela:** a tarefa não tem tela. O texto novo de operador (`docs/runbook.md`, os dois alertas) não é lido por nenhum e2e; `grep -rln 'Tokens acima de' e2e/ apps/web/src` não acha nada.
3. **Segundo dado:** o balde é de cada `provedor:modelo`, e o caso do menor reserva em um e o outro segue com vaga; a `ferramenta` e a `normal` têm tetos diferentes (15 e 10 %); o Tutor é a
   fila sem balde; o Redis fora e o Redis de pé são dois casos; o uso real maior e menor que a estimativa; a repetição por saída inválida reserva de novo, com a correção na estimativa.
4. **Checagem anterior (o controle):** cada caso que prova uma ausência traz o positivo ao lado: "o geral que recusa devolve o balde da fila" mostra a fila vazia depois; "a reserva recusada não
   enche o balde" mostra que o que sobrava ainda cabe; "o menor sem vaga" só termina `IA_INDISPONIVEL` depois de a espera ter acontecido (a métrica de espera conta). O dublê (`LimiteDeMentira`)
   devolve o `msAteLiberar` que o balde devolveria, e o limitador dos casos de integração é o `RateLimiterRedis` de verdade, no Redis de teste.
5. **Asserção:** olha o que sai (o modelo que respondeu, o código do erro, o instante do fim contra o relógio falso, o consumo gravado, o balde que ainda cabe), e não o texto do código. A ausência
   (nenhuma reserva, nenhum envio, nenhuma métrica) só vale depois de a chamada ter terminado, e leva o positivo ao lado.
6. **Guarda nova:** nenhuma regra de lint nova. A fiação do limite tem um caso em `fila-de-ia.int.test.ts` (o módulo monta o `TokenLimiter` e o gateway o lê, e sem a variável não há limite), e
   `alerta-tem-runbook.test.ts` ganhou as duas âncoras novas. O `.env.example` e o compose seguem a guarda de `tools/ci/ambiente.test.ts` (variável obrigatória e preenchida).
7. **Comentários:** o docblock de `TokenLimiter` e o de `reservarVaga` dizem o que o código faz (o geral é 80 %, a `ferramenta` 15 %, a `normal` 10 %, o Tutor só no geral, a estimativa grande
   é reservada pelo tamanho do balde); o de `PRECO_DOS_MODELOS` diz que o menor real só entra com a D37; o `.env.example`, a AIA do Tutor (item 17), `docs/infra.md` e o runbook dizem o mesmo.
8. **Divergências:** a tabela abaixo. Nenhuma cria regra; a que mexe no desenho (as métricas) é de nome, e o código manda.
9. **Peça que já existe:** `RateLimiterRedis` com o `insuranceLimiter` e `insuranceLimit` (`rate-limit/keys.ts`), `createQueueRedisClient`, `estimarTokens`/`tokensDoPedido` (`teto-de-entrada.ts`),
   `ResilientAdapter` (o disjuntor), `prazoPorTemporizador` e `PRAZO_DA_EXECUCAO_MS`, `FilaDeIa` (a bancada do worker), `lerAmbienteDeTeste`, `NOMES_NO_PROMETHEUS`. Nenhuma peça nova duplicada.
10. **Concorrência e relógio:** o `token-limiter.int.test.ts` abre as reservas das duas réplicas juntas (`Promise.all`, dois `TokenLimiter` no mesmo Redis) e prova que só cabem as que somam o balde; os
    casos de prazo usam o mesmo relógio falso do `prazoPorTemporizador` e do gateway (`vi.useFakeTimers`), sem depender da máquina; o acerto só vale dentro do minuto da reserva (relógio injetado).
11. **Isolamento e "Caso":** a tarefa não lê nem grava tabela de escola. O balde é por `provedor:modelo`, nenhuma chave leva escola, aluno nem execução (`PREFIXO_DO_BALDE_*`), e o caso do log e o das métricas
    provam que nenhum identificador de pessoa ou de escola sai. A coluna "Caso" está preenchida, uma entrada por linha da tabela.
12. **Guardiões e achados:** `infra-guardian` (o limite somado entre réplicas, o seguro por réplica, a espera dentro do prazo, o alerta com runbook), `conformidade-reviewer` (o Tutor nunca cai no menor; o
    fim é `IA_INDISPONIVEL`, sem nota nem mensagem à família), `llm-integrator` (toda chamada pelo gateway, perfil e orçamento antes, preço do menor, D55 também na saída do menor). Sem `achados/` ainda.

## Fora do escopo desta tarefa

O provedor de reserva (F5); o teto real e os modelos menores (D37); a carga (11.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| As métricas seguem o nome do código: `ia.chamada.duracao` (unidade `s`, no Prometheus `ia_chamada_duracao_seconds`), `ia.chamada.erros`, `ia.degradacao{degrau}`, `ia.tokens.uso_do_teto{modelo}` e `ia.disjuntor.aberto{provedor,modelo,perfil}`, e não os `duracao_s` do `onda-3c.md` "T10" | O `onda-3c.md` (`tasks/prd-reengenharia/`) escreve `ia.chamada.duracao_s`; o `METRICS` do `core` nomeia a unidade pelo campo `unit` (`s`), e o Prometheus a converte em sufixo (`_seconds`): escrever `_s` no nome daria `_s_seconds`. Nenhum alerta ou painel depende do nome antigo | `techspec.md` §5 "Os tokens (49.0)", "Como a 10.0 ficou"; `onda-3c.md` T10 (que a tarefa 10.0 substitui) |
| O uso do teto é a fração do **contratado** que o balde geral consumiu (de 0 a 0,8), e o alerta é `>= 0,8` (balde cheio) com aviso aos 0,7 | O balde geral tem 80 % do contratado (a regra 80, item 4, pede folga); o uso do teto é a **ocupação do balde** vezes `PARTE_DO_BALDE_GERAL` (e não `consumidos / contratado`, que dava 0,7999995 com o contratado de 1 234 567 e ficava abaixo de 0,8 com o balde lotado), e a reserva que o geral recusa já vale 0,8 (o balde cheio **para aquele pedido**: na saturação de verdade ele para logo abaixo do topo). O balde cheio vale exatamente 0,8 e nunca passa dele, e por isso o alerta é `>=` | `techspec.md` §5; `cenarios.md` §4 (alertas) |
| `LLM_MODELO_MENOR_<PERFIL>` existe na configuração e no `.env.example`, mas o `infra/compose.yml` só passa `LLM_TOKENS_POR_MINUTO` (ao `api` e ao `worker-ia`) | A guarda `tools/ci/ambiente.test.ts` exige toda variável do compose com `:?` e preenchida; o menor não tem valor padrão (D37: o preço e o modelo reais). O falso tem menor próprio e o teste o usa. Sem a variável no compose, ninguém sobe com um menor sem preço por engano | `techspec.md` §7c; D37 |
| O menor real só sobe com preço em `PRECO_DOS_MODELOS` (`consumo.ts`); o falso e o `MODELO_FALSO_MENOR` custam zero | O degrau do menor gastaria sem a conta da D14; a tarefa pede "menor sem preço: a subida falha", e a tabela é o jeito de dizer que há preço. O preço do modelo real entra com a D37 | `techspec.md` §5; este documento, "Testes que provam a regra" |
| O `ModelCall` ganha `modelo?` e o `GenerationRequest` ganha `fila?`; o `ResilientAdapter` mede o disjuntor por modelo (`ia.disjuntor.aberto`) | O degrau troca o modelo da chamada sem criar outro adaptador, e o disjuntor do principal aberto não pode fechar o do menor. A `fila` do comando chega ao gateway para ele escolher o balde (`execucao-command.ts`) | `techspec.md` §5 e §7c |
| `esperaMaximaMs` saiu das dependências do gateway; a espera de 8 s é a constante `ESPERA_MAXIMA_DA_VAGA_MS` | A espera é regra do RF7, e não configuração; quem precisa de outro valor (o teste) usa o relógio falso | `prd.md` RF7 |
| Arquivos fora da lista prevista: `apps/api/src/ia/execucao-command.ts`, `apps/api/src/ia/ia-do-worker.module.ts`, `apps/api/src/worker.module.ts`, `apps/api/src/ia/fila-de-ia.int.test.ts`, `apps/api/test/fila-de-ia.fixture.ts`, `packages/core/src/ia/{adapter,port,resilient-adapter,openai-compat-adapter,fake-adapter,teto-de-entrada}.ts` (e os testes deles), `packages/core/src/telemetry/metrics.ts`, `tools/testes/metricas.ts`, `tools/guardas/alerta-tem-runbook.test.ts`, `infra/compose.yml`, `infra/scripts/ensaio-alertas.ts`, `infra/grafana/paineis/fundacao.json` | Cada um é a fiação ou o teste de algo que a lista previa: o módulo do worker monta o `TokenLimiter` (no lugar do `main-worker.ts`, que só liga módulos e não mudou); o inventário de métricas, o ensaio e o painel acompanham os dois alertas novos; o compose passa a variável obrigatória | `techspec.md` §2 |
| `packages/core/src/ia/perfis.ts` e `apps/api/src/main-worker.ts`, previstos, não mudaram | O perfil já tem prazo, e o menor é configuração (`modelosMenores`), não perfil; a fiação do limite está em `ia-do-worker.module.ts`, que o `main-worker` já importa | `techspec.md` §2 |
| O caso "menor e a D55" e o "`consumo_ia`" são de unidade, e não de integração | A regra fixa da D55 e o registro de consumo moram no gateway, que o `ScriptedAdapter` exercita inteiro; a integração do prazo (`prazo-com-tokens.int.test.ts`) também grava o consumo do menor | este documento |

## Mutações

--faltando: 0 linhas (81 blocos, 0 motivos)

Cada bloco tira uma cláusula (ou troca um número) e exige o vermelho de um caso que rodou; todos foram aplicados antes do portão, com `conferirMutacoes` e o `rodarCalado` do próprio portão, e os 81 ficaram vermelhos.

```mutacao
arquivo: packages/core/src/ia/token-limiter.ts
teste: packages/core/src/ia/token-limiter.test.ts › o balde geral tem 80 %
-export const PARTE_DO_BALDE_GERAL = 0.8
+export const PARTE_DO_BALDE_GERAL = 0.9
```

```mutacao
arquivo: packages/core/src/ia/token-limiter.ts
teste: packages/core/src/ia/token-limiter.test.ts › a `ferramenta` tem o balde de 15 %
-export const PARTE_DO_BALDE_DA_FERRAMENTA = 0.15
+export const PARTE_DO_BALDE_DA_FERRAMENTA = 0.2
```

```mutacao
arquivo: packages/core/src/ia/token-limiter.ts
teste: packages/core/src/ia/token-limiter.test.ts › a `ferramenta` tem o balde de 15 %
-export const PARTE_DO_BALDE_DA_NORMAL = 0.1
+export const PARTE_DO_BALDE_DA_NORMAL = 0.2
```

```mutacao
arquivo: packages/core/src/ia/token-limiter.ts
teste: packages/core/src/ia/token-limiter.test.ts › a `ferramenta` tem o balde de 15 %
-const baldeDaFila = fila === 'interativa' ? undefined : this.#filas[fila]
+const baldeDaFila = this.#filas[fila === 'interativa' ? 'normal' : fila]
```

```mutacao
arquivo: packages/core/src/ia/token-limiter.ts
teste: packages/core/src/ia/token-limiter.test.ts › a `ferramenta` tem o balde de 15 %
-const naFila = baldeDaFila === undefined ? undefined : await this.#consumir(baldeDaFila, modelo, pedido)
+const naFila = undefined
```

```mutacao
arquivo: packages/core/src/ia/token-limiter.ts
teste: packages/core/src/ia/token-limiter.test.ts › o balde da `ferramenta` cheio recusa
-if (naFila !== undefined && !naFila.aceita) return { concedida: false, msAteLiberar: naFila.msAteLiberar }
+if (false && !naFila.aceita) return { concedida: false, msAteLiberar: naFila.msAteLiberar }
```

```mutacao
arquivo: packages/core/src/ia/token-limiter.ts
teste: packages/core/src/ia/token-limiter.test.ts › o balde da `ferramenta` cheio recusa
-if (naFila !== undefined && !naFila.aceita) return { concedida: false, msAteLiberar: naFila.msAteLiberar }
+if (naFila !== undefined && false) return { concedida: false, msAteLiberar: naFila.msAteLiberar }
```

```mutacao
arquivo: packages/core/src/ia/token-limiter.ts
teste: packages/core/src/ia/token-limiter.test.ts › o balde geral tem 80 %
-if (!noGeral.aceita) {
+if (false) {
```

```mutacao
arquivo: packages/core/src/ia/token-limiter.ts
teste: packages/core/src/ia/token-limiter.test.ts › o geral recusa: o que o balde da fila reservou volta
-if (baldeDaFila !== undefined && naFila !== undefined) await this.#ajustar(baldeDaFila, modelo, -naFila.pontos, naFila.venceEm)
```

```mutacao
arquivo: packages/core/src/ia/token-limiter.ts
teste: packages/core/src/ia/token-limiter.test.ts › o geral recusa: o que o balde da fila reservou volta
-if (baldeDaFila !== undefined && naFila !== undefined) await this.#ajustar(baldeDaFila, modelo, -naFila.pontos, naFila.venceEm)
+if (false && naFila !== undefined) await this.#ajustar(baldeDaFila, modelo, -naFila.pontos, naFila.venceEm)
```

```mutacao
arquivo: packages/core/src/ia/token-limiter.ts
teste: packages/core/src/ia/token-limiter.test.ts › o geral recusa: o que o balde da fila reservou volta
-if (baldeDaFila !== undefined && naFila !== undefined) await this.#ajustar(baldeDaFila, modelo, -naFila.pontos, naFila.venceEm)
+if (baldeDaFila !== undefined && false) await this.#ajustar(baldeDaFila, modelo, -naFila.pontos, naFila.venceEm)
```

```mutacao
arquivo: packages/core/src/ia/token-limiter.ts
teste: packages/core/src/ia/token-limiter.test.ts › o acerto vale também para o balde da fila
-if (baldeDaFila !== undefined && naFila !== undefined) await this.#ajustar(baldeDaFila, modelo, real - naFila.pontos, naFila.venceEm)
+if (false && naFila !== undefined) await this.#ajustar(baldeDaFila, modelo, real - naFila.pontos, naFila.venceEm)
```

```mutacao
arquivo: packages/core/src/ia/token-limiter.ts
teste: packages/core/src/ia/token-limiter.test.ts › o acerto vale também para o balde da fila
-if (baldeDaFila !== undefined && naFila !== undefined) await this.#ajustar(baldeDaFila, modelo, real - naFila.pontos, naFila.venceEm)
+if (baldeDaFila !== undefined && false) await this.#ajustar(baldeDaFila, modelo, real - naFila.pontos, naFila.venceEm)
```

```mutacao
arquivo: packages/core/src/ia/token-limiter.ts
teste: packages/core/src/ia/token-limiter.test.ts › o uso menor que a estimativa devolve
-await this.#ajustar(this.#geral, modelo, real - noGeral.pontos, noGeral.venceEm)
+await this.#ajustar(this.#geral, modelo, real, noGeral.venceEm)
```

```mutacao
arquivo: packages/core/src/ia/token-limiter.ts
teste: packages/core/src/ia/token-limiter.test.ts › o acerto vale também para o balde da fila
-if (baldeDaFila !== undefined && naFila !== undefined) await this.#ajustar(baldeDaFila, modelo, real - naFila.pontos, naFila.venceEm)
+if (baldeDaFila !== undefined && naFila !== undefined) await this.#ajustar(baldeDaFila, modelo, real, naFila.venceEm)
```

```mutacao
arquivo: packages/core/src/ia/token-limiter.ts
teste: packages/core/src/ia/token-limiter.test.ts › o uso menor que a estimativa devolve
-if (diferenca === 0 || this.#relogioMs() >= venceEm) return
+if (true || this.#relogioMs() >= venceEm) return
```

```mutacao
arquivo: packages/core/src/ia/token-limiter.ts
teste: packages/core/src/ia/token-limiter.test.ts › depois do minuto da reserva
-if (diferenca === 0 || this.#relogioMs() >= venceEm) return
+if (diferenca === 0 || false) return
```

```mutacao
arquivo: packages/core/src/ia/token-limiter.ts
teste: packages/core/src/ia/token-limiter.test.ts › o uso maior que a estimativa soma a diferença
-if (diferenca > 0) await balde.limitador.penalty(modelo, diferenca)
+if (diferenca > 0) await Promise.resolve()(modelo, diferenca)
```

```mutacao
arquivo: packages/core/src/ia/token-limiter.ts
teste: packages/core/src/ia/token-limiter.test.ts › depois do minuto da reserva
-this.#relogioMs = opcoes.relogioMs ?? Date.now
+this.#relogioMs = Date.now
```

```mutacao
arquivo: packages/core/src/ia/token-limiter.ts
teste: packages/core/src/ia/token-limiter.test.ts › a estimativa maior que o balde
-const pontos = Math.min(pedido, balde.pontos)
+const pontos = pedido
```

```mutacao
arquivo: packages/core/src/ia/token-limiter.ts
teste: packages/core/src/ia/token-limiter.test.ts › estimativa zero ou fracionária
-const pedido = Math.max(1, Math.ceil(estimativa))
+const pedido = estimativa
```

```mutacao
arquivo: packages/core/src/ia/token-limiter.ts
teste: packages/core/src/ia/token-limiter.test.ts › o uso do teto é a fração
-return (ocupado / this.#geral.pontos) * PARTE_DO_BALDE_GERAL
+return ocupado / this.#geral.pontos
```

```mutacao
arquivo: packages/core/src/ia/token-limiter.ts
teste: packages/core/src/ia/token-limiter.test.ts › com duas réplicas, o seguro
-const seguro = new RateLimiterMemory({ keyPrefix: prefixo, points: insuranceLimit(pontos, replicas), duration: JANELA_LIMITE_SEGUNDOS })
+const seguro = new RateLimiterMemory({ keyPrefix: prefixo, points: pontos, duration: JANELA_LIMITE_SEGUNDOS })
```

```mutacao
arquivo: packages/core/src/ia/token-limiter.ts
teste: packages/core/src/ia/token-limiter.test.ts › a saturação de verdade
-return { aceita: false, pontos, msAteLiberar: Math.max(1, recusa.msBeforeNext), consumidos: balde.pontos, venceEm: agora + recusa.msBeforeNext }
+return { aceita: false, pontos, msAteLiberar: Math.max(1, recusa.msBeforeNext), consumidos: Math.max(0, recusa.consumedPoints - pontos), venceEm: agora + recusa.msBeforeNext }
```

```mutacao
arquivo: packages/core/src/ia/token-limiter.ts
teste: packages/core/src/ia/token-limiter.test.ts › a reserva recusada não enche o balde
-await balde.limitador.reward(modelo, pontos)
```

```mutacao
arquivo: packages/core/src/ia/token-limiter.ts
teste: packages/core/src/ia/token-limiter.test.ts › a reserva recusada não enche o balde
 if (!(recusa instanceof RateLimiterRes)) throw recusa
 // O `rate-limiter-flexible` soma os pontos mesmo ao recusar: sem devolvê-los, cada tentativa de quem espera encheria o balde que ele espera liberar.
-await this.#devolverARecusada(balde, modelo, pontos)
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o sinal já abortado quando a espera começa
-if (sinal?.aborted === true) {
+if (false) {
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › a repetição por saída inválida reserva de novo
-return { ...base, ...(correcao === undefined ? {} : { correcao }), ...(modelo === undefined ? {} : { modelo }) }
+return { ...base, ...{}, ...(modelo === undefined ? {} : { modelo }) }
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › degrau 2
-return { ...base, ...(correcao === undefined ? {} : { correcao }), ...(modelo === undefined ? {} : { modelo }) }
+return { ...base, ...(correcao === undefined ? {} : { correcao }), ...{} }
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts
-if (medidor === undefined) return {}
+if (false) return {}
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o uso do teto é o da última reserva do modelo
-for (const [modelo, uso] of usosDoTeto) observador.observe(agora - uso.em < VALIDADE_DO_USO_DO_TETO_MS ? uso.valor : 0, { modelo })
+for (const [modelo, uso] of usosDoTeto) observador.observe(uso.valor, { modelo })
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts
-const reserva = this.saidaDeReserva(pedido, entrada, gasto.tentativas, reprovadaNaConferencia ? problemasDaUltima : undefined)
+const reserva = this.saidaDeReserva(pedido, entrada, gasto.tentativas, problemasDaUltima)
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts
-if (reserva !== undefined) return reserva
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts
-const reserva = problemas === undefined ? undefined : tarefa.reservaQuandoInvalida?.(entrada, problemas)
+const reserva = tarefa.reservaQuandoInvalida?.(entrada, problemas ?? [])
 if (reserva === undefined) return undefined
 const validada = validar(tarefa, entrada, reserva)
 if (!validada.ok) return undefined
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › a duração e os erros da chamada ao provedor
-const atributos = { provedor: adaptador.envio.provedorId ?? adaptador.origem, perfil: pedido.tarefa.perfil }
+const atributos = { provedor: adaptador.origem, perfil: pedido.tarefa.perfil }
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › a duração e os erros da chamada ao provedor
-this.errosDaChamada?.add(1, { ...atributos, codigo: erro instanceof LLMError ? erro.codigoDeIa : 'IA_INDISPONIVEL' })
+this.errosDaChamada?.add(1, { ...atributos, codigo: 'IA_INDISPONIVEL' })
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › sem limitador
-if (limite === undefined) return {}
+if (false) return {}
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › sem fila no pedido
-const fila = pedido.fila ?? 'normal'
+const fila = pedido.fila ?? 'interativa'
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › com vaga, a chamada roda no modelo do perfil
-if (resultado.concedida) return { reserva: resultado.reserva }
+if (false) return { reserva: resultado.reserva }
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › degrau 2
-if (restante <= 0) break
+if (restante <= 1_000) break
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › degrau 1
-if (!esperou) {
+if (true) {
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o turno do Tutor pula o modelo menor
-const menor = TAREFAS_SEM_MODELO_MENOR.has(tarefa.nome) ? undefined : this.dependencias.modelosMenores?.[tarefa.perfil]
+const menor = false ? undefined : this.dependencias.modelosMenores?.[tarefa.perfil]
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › sem modelo menor configurado para o perfil
-if (menor !== undefined) {
+if (true) {
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › degrau 2
-if (resultado.concedida) {
+if (false) {
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o log de cada degrau leva
-const modelo = menor ?? this.dependencias.adaptador.modeloDoPerfil(tarefa.perfil)
+const modelo = this.dependencias.adaptador.modeloDoPerfil(tarefa.perfil)
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › a recusa que não traz o uso do geral
-if (uso !== undefined) this.usosDoTeto.set(modelo, { valor: uso, em: horaDoProcessoMs() })
+if (true) this.usosDoTeto.set(modelo, { valor: uso, em: horaDoProcessoMs() })
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o log de cada degrau leva
-if (degrau === 'indisponivel') this.dependencias.logger?.warn({ evento: 'ia.geracao.sem_vaga', tipo, modeloId, codigo: 'IA_INDISPONIVEL' })
+if (false) this.dependencias.logger?.warn({ evento: 'ia.geracao.sem_vaga', tipo, modeloId, codigo: 'IA_INDISPONIVEL' })
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o log do degrau do modelo menor
-else this.dependencias.logger?.info({ evento: degrau === 'espera' ? 'ia.geracao.espera_de_vaga' : 'ia.geracao.modelo_menor', tipo, modeloId })
+else this.dependencias.logger?.info({ evento: degrau === 'espera' ? 'ia.geracao.modelo_menor' : 'ia.geracao.espera_de_vaga', tipo, modeloId })
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o medidor das portas chega ao decorador
-...(portas.medidor === undefined ? {} : { medidor: portas.medidor }),
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o menor do adaptador falso responde
-return new LLMGateway({ adaptador, ...portas, ...(config.modelosMenores === undefined ? {} : { modelosMenores: config.modelosMenores }) })
+return new LLMGateway({ adaptador, ...portas, ...{} })
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › modelo menor sem preço em PRECO_DOS_MODELOS
-const semPreco = Object.entries(config.modelosMenores ?? {}).filter(([, modelo]) => precoDoModelo(modelo) === undefined)
+const semPreco = Object.entries({}).filter(([, modelo]) => precoDoModelo(modelo) === undefined)
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › modelo menor sem preço em PRECO_DOS_MODELOS
-if (semPreco.length > 0) throw new InvalidConfigError(semPreco.map(([perfil]) => `LLM_MODELO_MENOR_${perfil.toUpperCase()}`).sort(), [MOTIVO_MODELO_MENOR_SEM_PRECO])
+if (false) throw new InvalidConfigError(semPreco.map(([perfil]) => `LLM_MODELO_MENOR_${perfil.toUpperCase()}`).sort(), [MOTIVO_MODELO_MENOR_SEM_PRECO])
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › a ordem: a D62 e o teto
-this.exigirSoberania(pedido, inicio)
+await this.dependencias.limiteDeTokens?.reservar('antes', 1, 'normal')
+this.exigirSoberania(pedido, inicio)
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › a ordem: a D62 e o teto
-this.exigirPedidoDentroDoTeto(pedido, entrada, inicio)
+await this.dependencias.limiteDeTokens?.reservar('antes', 1, 'normal')
+this.exigirPedidoDentroDoTeto(pedido, entrada, inicio)
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o orçamento recusa antes do reservar
-await this.exigirOrcamento(pedido, inicio)
+await this.dependencias.limiteDeTokens?.reservar('antes', 1, 'normal')
+await this.exigirOrcamento(pedido, inicio)
```

```mutacao
arquivo: packages/core/src/ia/fake-adapter.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o menor do adaptador falso responde
-modelo: chamada.modelo ?? MODELO_FALSO,
+modelo: MODELO_FALSO,
```

```mutacao
arquivo: packages/core/src/ia/openai-compat-adapter.ts
teste: packages/core/src/ia/openai-compat-adapter.test.ts › o modelo que a chamada pede
-const modelo = chamada.modelo ?? this.modeloDoPerfil(chamada.tarefa.perfil)
+const modelo = this.modeloDoPerfil(chamada.tarefa.perfil)
```

```mutacao
arquivo: packages/core/src/ia/resilient-adapter.ts
teste: packages/core/src/ia/resilient-adapter.test.ts › `ia.disjuntor.aberto{provedor,modelo,perfil}`
-const provedor = interno.envio.provedorId ?? interno.origem
+const provedor = interno.origem
```

```mutacao
arquivo: packages/core/src/ia/resilient-adapter.ts
teste: packages/core/src/ia/resilient-adapter.test.ts › o modelo que a chamada pede
-const { resposta } = await this.resiliencia(perfil, chamada.modelo ?? this.interno.modeloDoPerfil(perfil)).execute((contexto) => this.tentar(chamada, contexto.signal), chamada.sinal)
+const { resposta } = await this.resiliencia(perfil, this.interno.modeloDoPerfil(perfil)).execute((contexto) => this.tentar(chamada, contexto.signal), chamada.sinal)
```

```mutacao
arquivo: packages/core/src/ia/resilient-adapter.ts
teste: packages/core/src/ia/resilient-adapter.test.ts › `ia.disjuntor.aberto{provedor,modelo,perfil}`
-estado.aberto = novo === CircuitState.Closed ? 0 : 1
+estado.aberto = novo === CircuitState.Closed ? 1 : 0
```

```mutacao
arquivo: packages/core/src/ia/teto-de-entrada.ts
teste: packages/core/src/ia/teto-de-entrada.test.ts › a repetição leva a resposta anterior
-return montarMensagens({ tarefa, entrada, ...(correcao === undefined ? {} : { correcao }) }).reduce((soma, mensagem) => soma + estimarTokens(mensagem.content), 0)
+return montarMensagens({ tarefa, entrada, ...{} }).reduce((soma, mensagem) => soma + estimarTokens(mensagem.content), 0)
```

```mutacao
arquivo: packages/core/src/ia/consumo.ts
teste: packages/core/src/ia/consumo.test.ts › o nome que existe em todo objeto
-return Object.hasOwn(PRECO_DOS_MODELOS, modelo) ? PRECO_DOS_MODELOS[modelo] : undefined
+return PRECO_DOS_MODELOS[modelo]
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts › LLM_TOKENS_POR_MINUTO é obrigatória
-if (valores.AMBIENTE !== 'local' && valores.LLM_TOKENS_POR_MINUTO === undefined) problema('LLM_TOKENS_POR_MINUTO', MOTIVO_SEM_TOKENS_POR_MINUTO)
+if (false && valores.LLM_TOKENS_POR_MINUTO === undefined) problema('LLM_TOKENS_POR_MINUTO', MOTIVO_SEM_TOKENS_POR_MINUTO)
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts › LLM_TOKENS_POR_MINUTO é obrigatória
-if (valores.AMBIENTE !== 'local' && valores.LLM_TOKENS_POR_MINUTO === undefined) problema('LLM_TOKENS_POR_MINUTO', MOTIVO_SEM_TOKENS_POR_MINUTO)
+if (valores.AMBIENTE !== 'local' && false) problema('LLM_TOKENS_POR_MINUTO', MOTIVO_SEM_TOKENS_POR_MINUTO)
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts
-return menor === undefined ? [] : [[perfil, menor] as const]
+return [[perfil, menor] as const]
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts
-const menores = menoresPresentes.length === 0 ? undefined : (Object.fromEntries(menoresPresentes) as Partial<Record<Perfil, string>>)
+const menores = (Object.fromEntries(menoresPresentes) as Partial<Record<Perfil, string>>)
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts
-...(valores.LLM_TOKENS_POR_MINUTO === undefined ? {} : { tokensPorMinuto: valores.LLM_TOKENS_POR_MINUTO }),
+...{ tokensPorMinuto: valores.LLM_TOKENS_POR_MINUTO },
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts
-...(menores === undefined ? {} : { modelosMenores: menores }),
+...{ modelosMenores: menores },
```

```mutacao
arquivo: apps/api/src/ia/ia-do-worker.module.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › o `main-worker` monta o limite de tokens
-useFactory: (): Redis | null => (config.tokensPorMinuto === undefined ? null : createQueueRedisClient(redisFilaUrl, 'worker-ia-tokens', throttledWarn(() => logger.warn({ evento: 'worker_ia.redis_dos_tokens_indisponivel' })))),
+useFactory: (): Redis | null => (true ? null : createQueueRedisClient(redisFilaUrl, 'worker-ia-tokens', throttledWarn(() => logger.warn({ evento: 'worker_ia.redis_dos_tokens_indisponivel' })))),
```

```mutacao
arquivo: apps/api/src/ia/ia-do-worker.module.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › o `main-worker` monta o limite de tokens
-useFactory: (redis: Redis | null): LimiteDeTokens | null => (redis === null || config.tokensPorMinuto === undefined ? null : new TokenLimiter(redis, { tokensPorMinuto: config.tokensPorMinuto, replicas: config.replicas })),
+useFactory: (redis: Redis | null): LimiteDeTokens | null => (true || config.tokensPorMinuto === undefined ? null : new TokenLimiter(redis, { tokensPorMinuto: config.tokensPorMinuto, replicas: config.replicas })),
```

```mutacao
arquivo: apps/api/src/ia/ia-do-worker.module.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › o `main-worker` monta o limite de tokens
-useFactory: (redis: Redis | null): LimiteDeTokens | null => (redis === null || config.tokensPorMinuto === undefined ? null : new TokenLimiter(redis, { tokensPorMinuto: config.tokensPorMinuto, replicas: config.replicas })),
+useFactory: (redis: Redis | null): LimiteDeTokens | null => (redis === null || true ? null : new TokenLimiter(redis, { tokensPorMinuto: config.tokensPorMinuto, replicas: config.replicas })),
```

```mutacao
arquivo: apps/api/src/ia/ia-do-worker.module.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › o `main-worker` monta o limite de tokens
-createLLMGateway(config, { registro: new ConsumoRepository(banco), orcamento, suspensao, soberania, logger, medidor: medidor ?? globalMeter(), ...(limiteDeTokens === null ? {} : { limiteDeTokens }) }),
+createLLMGateway(config, { registro: new ConsumoRepository(banco), orcamento, suspensao, soberania, logger, medidor: medidor ?? globalMeter(), ...{} }),
```

```mutacao
arquivo: apps/api/src/ia/execucao-command.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › o pedido ao modelo leva a fila do comando
 sinal,
-fila: comando.fila,
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o prazo que vence durante a espera
-await esperar(Math.min(Math.max(resultado.msAteLiberar, ESPERA_MINIMA_ENTRE_RESERVAS_MS), restante), pedido.sinal)
+await esperar(Math.min(Math.max(resultado.msAteLiberar, ESPERA_MINIMA_ENTRE_RESERVAS_MS), restante), undefined)
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: apps/api/src/ia/prazo-com-tokens.int.test.ts › a 2.ª reserva
-await esperar(Math.min(Math.max(resultado.msAteLiberar, ESPERA_MINIMA_ENTRE_RESERVAS_MS), restante), pedido.sinal)
+await esperar(Math.min(Math.max(resultado.msAteLiberar, ESPERA_MINIMA_ENTRE_RESERVAS_MS), restante), AbortSignal.timeout(10 * 60_000))
```

```mutacao
arquivo: infra/grafana/alertas/ia-tokens-acima-do-teto.yaml
teste: infra/test/alertas.test.ts › são as das Tech Specs, com o `for:` e o limiar declarados
-expr: 'max by (modelo) (ia_tokens_uso_do_teto) >= 0.7'
+expr: 'max by (modelo) (ia_tokens_uso_do_teto) >= 0.75'
```

```mutacao
arquivo: infra/grafana/alertas/ia-tokens-acima-do-teto.yaml
teste: infra/test/alertas.test.ts › são as das Tech Specs, com o `for:` e o limiar declarados
-expr: 'max by (modelo) (ia_tokens_uso_do_teto) >= 0.8'
+expr: 'max by (modelo) (ia_tokens_uso_do_teto) > 0.8'
```

```mutacao
arquivo: infra/grafana/alertas/ia-provedor-fora.yaml
teste: infra/test/alertas.test.ts › são as das Tech Specs, com o `for:` e o limiar declarados
-for: 2m
+for: 5m
```

```mutacao
arquivo: infra/grafana/alertas/ia-provedor-fora.yaml
teste: infra/test/alertas.test.ts › são as das Tech Specs, com o `for:` e o limiar declarados
-expr: 'max by (provedor, modelo, perfil) (ia_disjuntor_aberto)'
+expr: 'max (ia_disjuntor_aberto)'
```





```mutacao
arquivo: packages/core/src/ia/token-limiter.ts
teste: packages/core/src/ia/token-limiter.test.ts › o contratado que não é redondo
 const ocupado = Math.min(noGeral.consumidos, this.#geral.pontos)
-return (ocupado / this.#geral.pontos) * PARTE_DO_BALDE_GERAL
+return ocupado / Math.ceil(this.#geral.pontos / PARTE_DO_BALDE_GERAL)
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o modelo menor que falha
 // O modelo que vai receber o pedido: se a chamada falhar, o consumo de `falhou` grava este (regra 70, item 6), e não o do perfil.
-gasto.modelo = vaga.modelo ?? this.dependencias.adaptador.modeloDoPerfil(tarefa.perfil)
```

## Recomendações sem aplicar

Da 1ª rodada (a ordem `.processo/ordens/10_task-r1.md`):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (1ª) | Balde geral dividido entre escolas: avaliar uma parte por escola | `TODO.md` (item 14); o registro de que é global de propósito está em `docs/infra.md` e no runbook |
| conformidade-reviewer (1ª) | Lista de exclusão do modelo menor trocada por lista de permissão | `TODO.md` (item 14): muda o contrato do `defineTask` |
| conformidade-reviewer (1ª) | AIAs de correção, sinais e adaptação não falam do modelo menor | `TODO.md` (item 14): só vale quando a D37 puser o modelo real, que hoje não sobe sem preço |
| conformidade-reviewer (1ª) | Teste de integração que prove que o comando do Tutor chega com `fila: 'interativa'` | Não aplicar: o test-engineer conferiu a fiação da fila do comando ao gateway (os dois casos novos de `fila-de-ia.int.test.ts`); o que falta é tornar a `fila` obrigatória, que está no `TODO.md` (item 14) |
| conformidade-reviewer (1ª) | Mostrar na auditoria qual modelo produziu a entrega | `TODO.md` (item 14), para a D37; o revisor disse que não é exigência da regra 70 |
| revisor-geral (1ª) | Tornar `fila` obrigatória no comando | `TODO.md` (item 14): muda contrato |
| infra-guardian (1ª) | Devolver a saída de reserva na 2ª tentativa sem vaga | `TODO.md` (item 14): muda comportamento |
| infra-guardian (1ª) | A virada do minuto repete todo mundo junto; rodar a carga com o limite baixo e medir `ia_degradacao_total{degrau="indisponivel"}` e o p95 do Tutor | Tarefa 11.0 (carga da manhã), a que roda a carga |
| infra-guardian (1ª) | Conferir no ensaio que "Tokens acima de 80%" segura 5 min seguidos sob saturação contínua | Tarefa 11.0 (ensaio); o item 1 da ordem mudou a conta do uso do teto |
| infra-guardian (1ª) | Caso em `alerta-tem-runbook.test.ts` para as variáveis citadas nos alertas novos | `TODO.md` (item 14): a ordem corrige os nomes agora, e a guarda é opcional |
| test-engineer (1ª) | Caso do Redis que cai com o cliente ainda `ready` (o comando falha), além do cliente não pronto | `TODO.md` (item 14) |
| test-engineer (1ª) | Repetição que muda de modelo mistura o custo | `TODO.md` (item 14), para a D37; o `custo_micros` por chamada ainda não existe |

Da 2ª rodada (`.processo/ordens/10_task-r2.md`; ninguém reprovou):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| infra-guardian (2ª) | Pedido grande recusado pelo geral leva o uso do teto a 0,8 com o balde ainda com espaço; registrar no runbook, junto de "O painel superestima", e conferir no ensaio | Tarefa 11.0 (ensaio de 5 min): a conferência; o texto do runbook entra quando a 11.0 tocar o runbook |
| infra-guardian (2ª) | Guarda que confere variável do runbook contra o `.env.example` | Já no `TODO.md`; opcional |
| revisor-geral (2ª) | Pedido do tamanho do balde inteiro é sempre recusado e vale 0,8; uma linha no comentário de `#usoDoTeto` ou no ensaio | Tarefa 11.0 (ensaio); com as estimativas de hoje não acontece |
| revisor-geral (2ª) | Com o Redis fora, o uso concedido fica abaixo de 0,8 mesmo com o seguro lotado; registrar no runbook | Tarefa 11.0, junto da recomendação acima |
| revisor-geral (2ª) | Quatro linhas em branco na seção "Mutações" | Recusada: só aparência, em documento que o hook não audita |
| revisor-geral (2ª) | Renomear `horaDoProcessoMs` | Recusada: o comentário do `llm-gateway.ts` justifica o nome, e renomear caducaria sete aprovações |
| test-engineer (2ª) | Caso para o comportamento de 0,8 com o geral pela metade | Tarefa 11.0 (ensaio) |
| test-engineer (2ª) | `Math.min(noGeral.consumidos, this.#geral.pontos)` não tem mutação observável | Recusada: o revisor aceita ficar como defesa |
| test-engineer (2ª) | A linha "réplicas" da tabela do `10_task.md` não cita o caso novo da `ferramenta` | O Implementador acrescenta o nome do caso na célula, no commit (`tasks/` não caduca) |
| test-engineer (2ª) | Caso em que a 1ª tentativa vai ao menor e a 2ª volta ao principal | `TODO.md`, no item da D37 sobre o custo misturado, que já existe |
| privacy-guardian (2ª) | Conferir `envioExterno: true` e `provedorId` no caso "o modelo menor que falha" | `TODO.md` (teste de consumo da D37): hoje o provedor já está provado nos casos de envio |
| privacy-guardian (2ª) | Caso com `turnoDoTutor` e `fila: 'interativa'` sem vaga, conferindo `envioExterno: false` | `TODO.md`: o caminho de código é o do degrau 3, já provado com a ferramenta |
| conformidade-reviewer (2ª) | Gravar o modelo de cada tentativa quando a D37 puser o `custo_micros` | Já no `TODO.md` |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-16 18:27:18 | 2026-11-16 18:28:00 | `infra-guardian` | 2 | APROVADO | a39b17524e21dcf04 |
| 2026-11-16 18:27:36 | 2026-11-16 18:28:06 | `conformidade-reviewer` | 2 | APROVADO | a11a11c6fe7f65948 |
| 2026-11-16 18:27:43 | 2026-11-16 18:28:10 | `llm-integrator` | 2 | APROVADO | ab0cb954ba28da80f |
| 2026-11-16 18:27:58 | 2026-11-16 18:28:13 | `tenancy-guardian` | 2 | APROVADO | a9e62ad230fae58fb |
| 2026-11-16 18:27:29 | 2026-11-16 18:28:21 | `revisor-geral` | 2 | APROVADO | a67254391891d8877 |
| 2026-11-16 18:28:06 | 2026-11-16 18:28:49 | `privacy-guardian` | 2 | APROVADO | ab6ce4ebd5fd25886 |
| 2026-11-16 18:27:51 | 2026-11-16 18:28:57 | `test-engineer` | 2 | APROVADO | a13dff90c0385905a |
