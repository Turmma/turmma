# Tarefa 12.0 — Toda chamada da web à API tem prazo, e a resposta de prova pendurada não trava as outras (52.0)

**Funcionalidade:** reengenharia-continuacao · **Depende de:** nenhuma
**Subagentes obrigatórios:** `infra-guardian`, `frontend-reviewer`
**Porte:** pequeno

## Objetivo

O `apiRequest` liga um `AbortController` próprio ao sinal de quem chamou, com prazo por tipo (leitura 20 s, PDF 30 s,
envio de arquivo 180 s, resposta de prova 10 s): estourado, vira `ApiError(TEMPO_ESGOTADO)` e a tela mostra "Tentar de
novo"; cancelado por quem chamou, relança o `AbortError` e não aparece erro. Os dois `fetch` de fora do cliente passam pelo
mesmo prazo, e o lint barra `fetch` novo fora dele. O `PUT` de resposta estourado vai para o fim da fila de respostas.

## Contexto necessário

- `techspec.md` §5 "A web (52.0, 56.0)" (a parte do prazo)
- `prd.md` RF11; §7 ("A rede da escola trava no meio da prova")
- `tasks/prd-reengenharia/onda-3c.md` "T13 — a prova (51.0 e 53.0) e o prazo do cliente (52.0)"
- `.claude/rules/` 40, 50, 80 (item 6)
- Código: `apps/web/src/api/client.ts` (`apiRequest` l.81, o `signal` l.94); `apps/web/src/areas/coordenacao/material/api/material.ts:115`;
  `apps/web/src/areas/professor/artefatos/api/artefatos.ts:115`; `apps/web/src/areas/aluno/fila-de-respostas.ts`
  (`criarFilaDeRespostas`, l.55); `eslint.config.mjs`; `tools/guardas/index.mjs`

## Subtarefas

- [x] 12.1 — `comPrazo` em `client.ts`; o tipo de chamada escolhe o prazo; `TEMPO_ESGOTADO` no catálogo de erros da web
  (se faltar em `shared`, a tarefa diz por que não toca o tronco)
- [x] 12.2 — `material.ts` e `artefatos.ts` com `comPrazo`
- [x] 12.3 — `no-restricted-globals` (e o seletor para `globalThis.fetch`, `window.fetch`, `self.fetch`) em `apps/web/src`, com
  exceção só para `api/client.ts`; registrada em `tools/guardas/index.mjs`
- [x] 12.4 — O `PUT` estourado volta ao fim da fila, com a mesma sequência; a questão seguinte sai
- [x] 12.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `tools/guardas/__fixtures__/fetch-fora-do-cliente/` | novo |
| `apps/web/src/api/client.ts`, `apps/web/src/api/client.test.ts`, `apps/web/src/areas/coordenacao/material/api/material.ts`, `apps/web/src/areas/professor/artefatos/api/artefatos.ts`, `apps/web/src/areas/aluno/fila-de-respostas.ts`, `apps/web/src/areas/aluno/respostas.ts`, `apps/web/src/areas/aluno/respostas.test.ts`, `apps/web/src/api/atividades-do-aluno.ts`, `apps/web/src/areas/professor/artefatos/Criados.test.tsx`, `eslint.config.mjs`, `eslint-suppressions.json`, `tools/guardas/index.mjs`, `tools/guardas/guardas.test.ts`, `tools/guardas/catraca.test.ts`, `tools/guardas/filtros-casam.test.ts`, `apps/web/src/operacao/textos.ts`, `apps/web/src/operacao/textos.test.ts`, `apps/web/src/areas/professor/atividades/Aprovar.tsx`, `apps/web/src/areas/professor/atividades/Aprovar.test.tsx` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| leitura estoura | U | relógio falso: aos 20 s, `TEMPO_ESGOTADO`; aos 19,9 s, não | `client.test.ts` › leitura: aos 19,9 s ainda espera, e aos 20 s vira TEMPO_ESGOTADO |
| PDF, envio, prova | U | 30 s, 180 s, 10 s: um caso cada | `client.test.ts` › PDF: o prazo é 30 s…; envio de arquivo: o prazo é 180 s…; resposta de prova: a gravação da questão é o PUT de 10 s…; o PDF e o envio de arquivo também contam a leitura do corpo… |
| cancelamento | U | quem chamou cancela: `AbortError` relançado, nenhum `ErrorState` | `client.test.ts` › cancelamento: quem chamou cancela…; cancelamento com o corpo pendurado…; `Criados.test.tsx` › a leitura que o TanStack Query cancela não vira erro na tela |
| o prazo libera | U | resposta antes do prazo: o temporizador sai, nenhum abort depois | `client.test.ts` › o prazo libera: a resposta que chega antes tira o temporizador… |
| a tela | U | `TEMPO_ESGOTADO` mostra "Tentar de novo", e a nova tentativa chega | `Criados.test.tsx` › a leitura que passa de 20 s mostra a mensagem do catálogo e "Tentar de novo"… |
| fora do cliente | U | `material.ts` e `artefatos.ts` estouram no prazo deles | `client.test.ts` › envio de arquivo: o prazo é 180 s… (`material.ts`); PDF: o prazo é 30 s… (`artefatos.ts`) |
| guarda, quem contorna | U | uma fixture por forma: `fetch`, `globalThis.fetch`, `window.fetch`, `self.fetch`, desestruturação (`const { fetch } = window`), reexportação e `import()` de um módulo que chama `fetch` | `guardas.test.ts` › o fetch só no cliente da API › reprova (uma por fixture de `fetch-fora-do-cliente/`: solto, do global, desestruturado, reexportado, por `import()`) |
| guarda, alvo some | U | `api/client.ts` renomeado: a exceção não acoberta o arquivo novo, e a guarda acusa | `guardas.test.ts` › a exceção é o cliente, e só ele…; o alvo da exceção existe e ainda chama o `fetch`… |
| guarda, o real | U | o repositório passa sem nenhuma ocorrência fora de `client.ts` | `guardas.test.ts` › o repositório de hoje não tem violação: nenhum arquivo de apps/web/src chama o `fetch` fora do cliente… |
| prova pendurada | U | o `PUT` estoura, vai para o fim, a questão seguinte sai. Mutação: devolver ao início | `respostas.test.ts` › a gravação que estoura o prazo vai para o fim da fila…; com duas na fila, a que pendurou espera a vez…; duas penduradas se revezam… |
| prova, resposta velha | U | o `PUT` estourado chega atrasado depois de o aluno mudar a mesma questão: a nova vale | `respostas.test.ts` › resposta velha: a escolha trocada enquanto a anterior pendurava é a que vale…; o estouro de uma gravação que já tinha sido trocada não move a escolha nova… |
| prova, recomeço | U | depois do estouro, a mesma questão sai de novo com a mesma sequência | `respostas.test.ts` › com duas na fila, a que pendurou espera a vez… (a questão 1 sai de novo, `sequencia` 1) |

## Como testar

- Cliente: `apps/web/src/api/client.test.ts` › "busca cancelada pelo TanStack Query sai como cancelamento, e não vira erro de
  indisponível na tela" e "sem rede, é indisponível…"; relógio com `vi.useFakeTimers`
- Fila: `apps/web/src/areas/aluno/respostas.test.ts` › "a gravação que falha NÃO tira a escolha da fila, e a escolha que sai
  de novo leva a mesma sequência" e "quem troca de alternativa enquanto a anterior é salva continua com a nova na fila"
- Guarda: `tools/guardas/guardas.test.ts`, com as fixtures das outras regras de `tools/guardas/__fixtures__/`
- Comando: `npx vitest run --project unidade apps/web/src/api/client.test.ts apps/web/src/areas/aluno/respostas.test.ts`
- Armadilha: "nenhum `ErrorState`" só vale depois de a promessa terminar (autoconferência 5)

## Autoconferência

As 12 perguntas do modelo, no plano. Na 6: uma fixture e um vermelho por forma de chamar `fetch`. Na 10: a resposta
velha com a ordem forçada.

### Respostas da autoconferência (plano)

1. **Mutação de cada cláusula:** um bloco por cláusula na seção "Mutações" (o `--faltando` vazio); o que ele não vê entra à mão
   (o ternário de `falharEnvio`, o `&&` de `paraOFim`, os seletores e as listas das guardas).
2. **Texto na tela:** a tarefa não põe texto novo (a mensagem é a do catálogo, `TEMPO_ESGOTADO`; o botão é o do `ErrorState`).
   `grep -rln 'demorou mais que o esperado' e2e/` fica vazio.
3. **Segundo dado:** o estouro da questão trocada tem a fila com três questões e a mesma `sequencia` em duas delas (`respostas.test.ts` ›
   o estouro de uma gravação que já tinha sido trocada…): sem o termo da questão ou o da sequência, a ordem sai diferente.
4. **Checagem anterior que responde antes:** o relógio falso só começa depois de a sessão abrir (`beforeAll` com o relógio real) e
   de a conferência do envio responder; o dublê do `fetch` aborta com `DOMException('AbortError')`, como o navegador.
5. **Asserção de ausência:** "nenhum `ErrorState`" só vale depois de o sinal ter abortado e de passarem 60 s (`Criados.test.tsx` ›
   a leitura que o TanStack Query cancela…); o controle positivo é o caso ao lado, que mostra o alerta aos 20 s.
6. **Guarda nova:** uma fixture por forma (`tools/guardas/__fixtures__/fetch-fora-do-cliente/`), o caso do alvo que some
   (`api/client.ts` renomeado) e o `eslint-disable` que não fura; limite declarado no `eslint.config.mjs` (`Reflect.get(window, 'fetch')`).
7. **Comentários:** o docblock do `apiRequest`, o do `comPrazo` e o da `falharEnvio` dizem o que o código faz; o prazo cobre o corpo, e a
   leitura do erro do PDF também.
8. **Divergências:** quatro linhas abaixo, cada uma com a palavra do código na `techspec.md` §5 ("O prazo do cliente (52.0), como ficou") e no
   `cenarios.md` §7. O `prd.md` (RF11) não diz o contrário.
9. **Peça que já existe:** `lerJson` (exportado de `client.ts` para o envio de `material.ts`), `ErrorState` e `shouldRetry` (que já repete
   `TEMPO_ESGOTADO`), `fakeNetwork`. Nada copiado.
10. **Concorrência:** a resposta velha tem a ordem forçada (`servidorDeMentira`: a velha estoura depois de a nova entrar na fila); o
    estouro com a conferência do envio em andamento usa o relógio falso, sem espera real.
11. **Linha → caso:** coluna "Caso" da tabela preenchida; o isolamento entre escolas não se aplica (a tarefa é só da web e não toca
    repository nem rota).
12. **O que verificar dos guardiões:** `infra-guardian` (regra 80, item 6: a resposta de prova nunca se perde, com o estouro voltando à
    fila e a `sequencia` mantida; nada de espera ativa, o recuo de 2 s a 15 s com jitter continua) e `frontend-reviewer` (os quatro estados:
    "Tentar de novo" no estouro; sem tela nova, sem texto novo). O `achados/indice.md` não tem linha sobre o cliente da API.

## Fora do escopo desta tarefa

A tela de falha (13.0); o 503 com `Retry-After` (14.0). Os `POST`s sem chave de idempotência que agora estouram aos 20 s (`/v1/tutor/mensagens`, `/v1/assistente/mensagens`, `/v1/ferramentas/*/gerar`): "Tentar de novo" pode duplicar a execução, o que já podia acontecer antes do prazo; a chave de idempotência é da 13.0 e da 14.0.

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| `comPrazo(tipo, sinalDeFora, executar)` recebe `pedir` (o `fetch` ligado ao sinal), e não é `comPrazo(sinal, limiteMs)` | A exceção da guarda é só `api/client.ts`: `material.ts` e `artefatos.ts` não podem citar `fetch`, e então o `fetch` sai por `pedir` | `techspec.md` §5, "O prazo do cliente (52.0), como ficou", item 1; `cenarios.md` §7 |
| O prazo cobre o pedido **e a leitura do corpo** (`lerJson`, o `blob()` e o erro do PDF) | Cabeçalho que chega e corpo que pendura prendia a tela do mesmo jeito; o `TEMPO_ESGOTADO` só do cabeçalho deixaria o furo | `techspec.md` §5, item 2; `cenarios.md` §7 |
| Arquivo fora dos previstos: `api/atividades-do-aluno.ts` (`responderQuestao` pede `tipo: 'prova'`) | O PUT da prova é o único que leva os 10 s, e a escolha do prazo é do chamador; sem a linha, ele ficaria com os 20 s da leitura | `techspec.md` §5, item 3; `cenarios.md` §7 |
| O estouro, havendo outra escolha esperando, manda a seguinte na hora, sem o recuo; com uma só, ou na falha que não é estouro, vale o recuo | Sem isso a pendurada seguraria as outras por 2 s a 15 s depois dos 10 s; com uma só, mandá-la logo martelaria a API (regra 80) | `techspec.md` §5, item 4; `cenarios.md` §7 |
| O lint tem seletores do `no-restricted-syntax` (`x.fetch`, `x['fetch']`, desestruturação, `import {fetch}`, `export {fetch}`) além do `no-restricted-globals`, e o bloco do kit os repete | A desestruturação cria uma variável local `fetch` que o `no-restricted-globals` não vê; o `no-restricted-syntax` do kit sobrescreve o do `fetch` nos arquivos dele | `techspec.md` §5, item 5 |
| Arquivos de teste fora dos previstos: `catraca.test.ts` (o TETO de `complexity` desce de 237 para 236) e `filtros-casam.test.ts` (o mínimo dos `files` do `eslint.config.mjs` sobe de 25 para 30) | O `client.ts` ficou com uma função a menos acima do limite (a base de supressões só encolhe), e o bloco novo do `fetch` traz mais itens de `files` na configuração; os dois testes gravam o número de hoje | `techspec.md` §5, item 5 |
| A marca `origem: 'cliente'` no `ApiError` criado em `comPrazo` (`estourouNoCliente`), e não outro código: só o estouro do cliente libera a seguinte da fila de prova na hora, entra em `ehResultadoIncerto` (`operacao/textos.ts`, fora dos previstos) e o `TEMPO_ESGOTADO` da API continua recusa com recuo | O mesmo código saía de duas situações: o 503 rápido da API (que a fila martelaria sem recuo) e o prazo estourado (em que o servidor pode ter gravado: a proteção da tentativa incerta de `NovaEscola` ficaria desligada); o catálogo de `packages/shared` não muda | `techspec.md` §5, item 6; `cenarios.md` §7 |
| O aviso do `TEMPO_ESGOTADO` na decisão da correção (`Aprovar.tsx`, fora dos previstos) não diz "nada foi aprovado": manda conferir a correção. Como a tela decide pelo código, o 503 `TEMPO_ESGOTADO` da API, que é recusa, mostra o mesmo texto: é o lado conservador, e o texto por origem fica para a 13.0 | `aprovarLote` e `decidirEntrega` agora estouram aos 20 s no cliente (valem os 20 s da leitura, sem `tipo`), e o servidor pode ter gravado a decisão | `techspec.md` §5, item 6; `cenarios.md` §7 |
| Arquivos de teste fora dos previstos: `Criados.test.tsx` (a tela: "Tentar de novo" e o cancelamento) | A linha "a tela" da tabela precisa de uma tela real, e `Criados` é a que tem os quatro estados e a rede falsa | `cenarios.md` §7 |

## Mutações

--faltando: 0 linhas (71 blocos, 0 motivos)

**`comPrazo`: o sinal de quem chamou, já abortado, aborta a chamada**

```mutacao
arquivo: apps/web/src/api/client.ts
teste: apps/web/src/api/client.test.ts › busca cancelada pelo TanStack Query
falha: not.toBeInstanceOf(ApiError)
  const cancelar = (): void => controle.abort()
-  if (sinalDeFora?.aborted === true) cancelar()
  sinalDeFora?.addEventListener('abort', cancelar, { once: true })
```

**`comPrazo`: o cancelamento de quem chamou, durante a espera, aborta a chamada**

```mutacao
arquivo: apps/web/src/api/client.ts
teste: apps/web/src/api/client.test.ts › cancelamento: quem chamou cancela
  if (sinalDeFora?.aborted === true) cancelar()
-  sinalDeFora?.addEventListener('abort', cancelar, { once: true })
  let estourou = false
```

**`comPrazo`: o temporizador marca que foi o prazo**

```mutacao
arquivo: apps/web/src/api/client.ts
teste: apps/web/src/api/client.test.ts › leitura: aos 19,9 s ainda espera
  const relogio = setTimeout(() => {
-    estourou = true
    controle.abort()
```

**`comPrazo`: o temporizador aborta a chamada**

```mutacao
arquivo: apps/web/src/api/client.ts
teste: apps/web/src/api/client.test.ts › leitura: aos 19,9 s ainda espera
    estourou = true
-    controle.abort()
  }, PRAZOS_DA_CHAMADA_MS[tipo])
```

**`comPrazo`: o estouro vira `TEMPO_ESGOTADO`**

```mutacao
arquivo: apps/web/src/api/client.ts
teste: apps/web/src/api/client.test.ts › leitura: aos 19,9 s ainda espera
  } catch (erro) {
-    if (estourou) throw new ApiError(ErrorCode.TEMPO_ESGOTADO, undefined, 'cliente')
    throw erro
```

**`comPrazo`: o estouro vira `TEMPO_ESGOTADO`, na tela (a mensagem do catálogo, e não a do erro interno)**

```mutacao
arquivo: apps/web/src/api/client.ts
teste: apps/web/src/areas/professor/artefatos/Criados.test.tsx › a leitura que passa de 20 s mostra a mensagem do catálogo
  } catch (erro) {
-    if (estourou) throw new ApiError(ErrorCode.TEMPO_ESGOTADO, undefined, 'cliente')
    throw erro
```

**`comPrazo`: o erro que não é do prazo sobe como está**

```mutacao
arquivo: apps/web/src/api/client.ts
teste: apps/web/src/api/client.test.ts › o erro que não é abort sobe
    if (estourou) throw new ApiError(ErrorCode.TEMPO_ESGOTADO, undefined, 'cliente')
-    throw erro
+    throw new ApiError(ErrorCode.ERRO_INTERNO)
  } finally {
```

**`comPrazo`: o `pedir` liga o `fetch` ao sinal do prazo, e não ao de quem chamou**

```mutacao
arquivo: apps/web/src/api/client.ts
teste: apps/web/src/api/client.test.ts › leitura: aos 19,9 s ainda espera
-    return await executar((caminho, opcoes) => fetch(caminho, { ...opcoes, signal: controle.signal }), controle.signal)
+    return await executar((caminho, opcoes) => fetch(caminho, { ...opcoes, signal: sinalDeFora }), controle.signal)
```

**`comPrazo`: o temporizador sai quando a chamada termina**

```mutacao
arquivo: apps/web/src/api/client.ts
teste: apps/web/src/api/client.test.ts › o prazo libera: a resposta que chega antes
  } finally {
-    clearTimeout(relogio)
    sinalDeFora?.removeEventListener('abort', cancelar)
```

**`comPrazo`: o ouvinte do sinal de quem chamou sai quando a chamada termina**

```mutacao
arquivo: apps/web/src/api/client.ts
teste: apps/web/src/api/client.test.ts › o prazo libera: a resposta que chega antes
falha: expect(sinais[0]?.aborted).toBe(false)
    clearTimeout(relogio)
-    sinalDeFora?.removeEventListener('abort', cancelar)
  }
```

**`PRAZOS_DA_CHAMADA_MS.leitura`: o valor do RF11, para mais**

```mutacao
arquivo: apps/web/src/api/client.ts
teste: apps/web/src/api/client.test.ts › leitura: aos 19,9 s ainda espera
-export const PRAZOS_DA_CHAMADA_MS = { leitura: 20_000, pdf: 30_000, envio: 180_000, prova: 10_000 } as const
+export const PRAZOS_DA_CHAMADA_MS = { leitura: 21_000, pdf: 30_000, envio: 180_000, prova: 10_000 } as const
```

**`PRAZOS_DA_CHAMADA_MS.pdf`: o valor do RF11, para mais**

```mutacao
arquivo: apps/web/src/api/client.ts
teste: apps/web/src/api/client.test.ts › PDF: o prazo é 30 s
-export const PRAZOS_DA_CHAMADA_MS = { leitura: 20_000, pdf: 30_000, envio: 180_000, prova: 10_000 } as const
+export const PRAZOS_DA_CHAMADA_MS = { leitura: 20_000, pdf: 31_000, envio: 180_000, prova: 10_000 } as const
```

**`PRAZOS_DA_CHAMADA_MS.envio`: o valor do RF11, para mais**

```mutacao
arquivo: apps/web/src/api/client.ts
teste: apps/web/src/api/client.test.ts › envio de arquivo: o prazo é 180 s
-export const PRAZOS_DA_CHAMADA_MS = { leitura: 20_000, pdf: 30_000, envio: 180_000, prova: 10_000 } as const
+export const PRAZOS_DA_CHAMADA_MS = { leitura: 20_000, pdf: 30_000, envio: 181_000, prova: 10_000 } as const
```

**`PRAZOS_DA_CHAMADA_MS.prova`: o valor do RF11, para mais**

```mutacao
arquivo: apps/web/src/api/client.ts
teste: apps/web/src/api/client.test.ts › resposta de prova: a gravação da questão é o PUT de 10 s
-export const PRAZOS_DA_CHAMADA_MS = { leitura: 20_000, pdf: 30_000, envio: 180_000, prova: 10_000 } as const
+export const PRAZOS_DA_CHAMADA_MS = { leitura: 20_000, pdf: 30_000, envio: 180_000, prova: 11_000 } as const
```

**`PRAZOS_DA_CHAMADA_MS.leitura`: o valor do RF11, para menos**

```mutacao
arquivo: apps/web/src/api/client.ts
teste: apps/web/src/api/client.test.ts › leitura: aos 19,9 s ainda espera
-export const PRAZOS_DA_CHAMADA_MS = { leitura: 20_000, pdf: 30_000, envio: 180_000, prova: 10_000 } as const
+export const PRAZOS_DA_CHAMADA_MS = { leitura: 19_000, pdf: 30_000, envio: 180_000, prova: 10_000 } as const
```

**`lerJson`: a leitura abortada por quem chamou sobe como `AbortError`**

```mutacao
arquivo: apps/web/src/api/client.ts
teste: apps/web/src/api/client.test.ts › cancelamento com o corpo pendurado
falha: not.toBeInstanceOf(ApiError)
  } catch (erro) {
-    if (sinal.aborted) throw erro
    return undefined
```

**`lerJson`: a leitura abortada pelo prazo sobe, e o envio de arquivo estoura (a leitura do corpo conta)**

```mutacao
arquivo: apps/web/src/api/client.ts
teste: apps/web/src/api/client.test.ts › o PDF e o envio de arquivo também contam a leitura do corpo
  } catch (erro) {
-    if (sinal.aborted) throw erro
    return undefined
```

**`apiRequest`: o tipo da chamada escolhe o prazo, e o que não diz é leitura**

```mutacao
arquivo: apps/web/src/api/client.ts
teste: apps/web/src/api/client.test.ts › leitura: aos 19,9 s ainda espera
-  return comPrazo(opcoes.tipo ?? 'leitura', opcoes.sinal, (pedir, sinal) => chamar(pedir, sinal, caminho, esquema, opcoes))
+  return comPrazo(opcoes.tipo ?? 'prova', opcoes.sinal, (pedir, sinal) => chamar(pedir, sinal, caminho, esquema, opcoes))
```

**`apiRequest`: o tipo da chamada escolhe o prazo, e não fica sempre na leitura**

```mutacao
arquivo: apps/web/src/api/client.ts
teste: apps/web/src/api/client.test.ts › resposta de prova: a gravação da questão é o PUT de 10 s
-  return comPrazo(opcoes.tipo ?? 'leitura', opcoes.sinal, (pedir, sinal) => chamar(pedir, sinal, caminho, esquema, opcoes))
+  return comPrazo('leitura', opcoes.sinal, (pedir, sinal) => chamar(pedir, sinal, caminho, esquema, opcoes))
```

**`apiRequest`: o sinal de quem chamou é o que o `comPrazo` liga**

```mutacao
arquivo: apps/web/src/api/client.ts
teste: apps/web/src/api/client.test.ts › cancelamento: quem chamou cancela
-  return comPrazo(opcoes.tipo ?? 'leitura', opcoes.sinal, (pedir, sinal) => chamar(pedir, sinal, caminho, esquema, opcoes))
+  return comPrazo(opcoes.tipo ?? 'leitura', undefined, (pedir, sinal) => chamar(pedir, sinal, caminho, esquema, opcoes))
```

**`chamar`: o cancelamento de quem chamou relança o `AbortError`, e não vira erro de indisponível**

```mutacao
arquivo: apps/web/src/api/client.ts
teste: apps/web/src/api/client.test.ts › cancelamento: quem chamou cancela
falha: not.toBeInstanceOf(ApiError)
  } catch (erro) {
-    if (sinal.aborted) throw erro
    throw new ApiError(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
```

**`responderQuestao`: a gravação da prova leva o prazo de 10 s**

```mutacao
arquivo: apps/web/src/api/atividades-do-aluno.ts
teste: apps/web/src/api/client.test.ts › resposta de prova: a gravação da questão é o PUT de 10 s
-  return authedRequest(`${caminhoDaAtividade(atividadeAplicadaId)}/respostas/${String(questao)}`, questaoSalvaResponseSchema, { metodo: 'PUT', corpo: { alternativa, sequencia }, tipo: 'prova' })
+  return authedRequest(`${caminhoDaAtividade(atividadeAplicadaId)}/respostas/${String(questao)}`, questaoSalvaResponseSchema, { metodo: 'PUT', corpo: { alternativa, sequencia } })
```

**`enviarMultipart`: o envio de arquivo leva o prazo de 180 s**

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/api/material.ts
teste: apps/web/src/api/client.test.ts › envio de arquivo: o prazo é 180 s
-  const { resposta, corpo } = await comPrazo('envio', undefined, async (pedir, sinal) => {
+  const { resposta, corpo } = await comPrazo('pdf', undefined, async (pedir, sinal) => {
```

**`enviarMultipart`: a leitura do corpo da resposta está sob o prazo (o sinal do prazo vai ao `lerJson`)**

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/api/material.ts
teste: apps/web/src/api/client.test.ts › o PDF e o envio de arquivo também contam a leitura do corpo
-    return { resposta: enviada, corpo: await lerJson(enviada, sinal) }
+    return { resposta: enviada, corpo: await lerJson(enviada, new AbortController().signal) }
```

**`erroDoPdf`: a leitura do erro abortada pelo prazo sobe, e o PDF estoura**

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/api/artefatos.ts
teste: apps/web/src/api/client.test.ts › o PDF e o envio de arquivo também contam a leitura do corpo
  } catch (erro) {
    // A leitura abortada (o prazo) não é "sem envelope": o erro sobe, e vira `TEMPO_ESGOTADO`.
-    if (sinal.aborted) throw erro
```

**`pedirPdf`: o PDF leva o prazo de 30 s**

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/api/artefatos.ts
teste: apps/web/src/api/client.test.ts › PDF: o prazo é 30 s
-  return comPrazo('pdf', undefined, async (pedir, sinal) => {
+  return comPrazo('leitura', undefined, async (pedir, sinal) => {
```

**`pedirPdf`: o token da sessão vai no cabeçalho, quando há**

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/api/artefatos.ts
teste: apps/web/src/areas/professor/assistente/api/assistente-e-entregas.test.ts › vai com o token no cabeçalho
-      resposta = await pedir(caminho, { cache: 'no-store', headers: { Accept: 'application/pdf', ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }) } })
+      resposta = await pedir(caminho, { cache: 'no-store', headers: { Accept: 'application/pdf' } })
```

**`pedirPdf`: a resposta que não é 2xx traz o erro, e não o arquivo**

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/api/artefatos.ts
teste: apps/web/src/areas/professor/assistente/api/assistente-e-entregas.test.ts › a falha sai com o código do catálogo
-    if (!resposta.ok) return { status: resposta.status, nome: undefined, resultado: await erroDoPdf(resposta, sinal) }
+    if (resposta.ok) return { status: resposta.status, nome: undefined, resultado: await erroDoPdf(resposta, sinal) }
```

**`baixarPdfDoArtefato`: o 401 renova a sessão e pede de novo**

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/api/artefatos.ts
teste: apps/web/src/areas/professor/assistente/api/assistente-e-entregas.test.ts › com o token recusado, renova a sessão uma vez
-  if (pedido.status === 401) {
+  if (pedido.status === 0) {
```

**`baixarPdfDoArtefato`: o erro do PDF sobe, e não vira arquivo**

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/api/artefatos.ts
teste: apps/web/src/areas/professor/assistente/api/assistente-e-entregas.test.ts › a falha sai com o código do catálogo
-  if (pedido.resultado instanceof ApiError) throw pedido.resultado
  return { arquivo: pedido.resultado, nome: pedido.nome ?? nomeDoArquivoPdf(titulo) }
```

**`baixarPdfDoArtefato`: o nome do cabeçalho vale, e, sem ele, o do título**

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/api/artefatos.ts
teste: apps/web/src/areas/professor/assistente/api/assistente-e-entregas.test.ts › com o token recusado, renova a sessão uma vez
-  return { arquivo: pedido.resultado, nome: pedido.nome ?? nomeDoArquivoPdf(titulo) }
+  return { arquivo: pedido.resultado, nome: pedido.nome ?? 'artefato.pdf' }
```

**`falharEnvio`: sem gravação no ar, a falha não muda nada**

```mutacao
arquivo: apps/web/src/areas/aluno/respostas.ts
teste: apps/web/src/areas/aluno/respostas.test.ts › só o estouro muda a ordem
  const { noAr } = estado
-  if (noAr === undefined) return estado
  const pendentes = codigo === ErrorCode.TEMPO_ESGOTADO ? paraOFim(estado.pendentes, noAr) : estado.pendentes
```

**`falharEnvio`: o estouro leva a escolha ao fim da fila**

```mutacao
arquivo: apps/web/src/areas/aluno/respostas.ts
teste: apps/web/src/areas/aluno/respostas.test.ts › a gravação que estoura o prazo vai para o fim da fila
-  const pendentes = codigo === ErrorCode.TEMPO_ESGOTADO ? paraOFim(estado.pendentes, noAr) : estado.pendentes
+  const pendentes = estado.pendentes
```

**`falharEnvio`: só o estouro leva a escolha ao fim (a falha de outro jeito continua na frente)**

```mutacao
arquivo: apps/web/src/areas/aluno/respostas.ts
teste: apps/web/src/areas/aluno/respostas.test.ts › só o estouro muda a ordem
-  const pendentes = codigo === ErrorCode.TEMPO_ESGOTADO ? paraOFim(estado.pendentes, noAr) : estado.pendentes
+  const pendentes = paraOFim(estado.pendentes, noAr)
```

**`paraOFim`: o fim da fila, e não o começo**

```mutacao
arquivo: apps/web/src/areas/aluno/respostas.ts
teste: apps/web/src/areas/aluno/respostas.test.ts › a gravação que estoura o prazo vai para o fim da fila
-  return dela === undefined ? pendentes : [...pendentes.filter((pendente) => pendente !== dela), dela]
+  return dela === undefined ? pendentes : [dela, ...pendentes.filter((pendente) => pendente !== dela)]
```

**`paraOFim`: a escolha que já foi trocada não volta à fila**

```mutacao
arquivo: apps/web/src/areas/aluno/respostas.ts
teste: apps/web/src/areas/aluno/respostas.test.ts › resposta velha: a escolha trocada enquanto a anterior pendurava
-  return dela === undefined ? pendentes : [...pendentes.filter((pendente) => pendente !== dela), dela]
+  return [...pendentes.filter((pendente) => pendente !== dela), noAr]
```

**`paraOFim`, primeiro termo: a questão é a mesma**

```mutacao
arquivo: apps/web/src/areas/aluno/respostas.ts
teste: apps/web/src/areas/aluno/respostas.test.ts › o estouro de uma gravação que já tinha sido trocada
-  const dela = pendentes.find((pendente) => pendente.questao === noAr.questao && pendente.sequencia === noAr.sequencia)
+  const dela = pendentes.find((pendente) => pendente.sequencia === noAr.sequencia)
```

**`paraOFim`, segundo termo: a `sequencia` é a mesma**

```mutacao
arquivo: apps/web/src/areas/aluno/respostas.ts
teste: apps/web/src/areas/aluno/respostas.test.ts › o estouro de uma gravação que já tinha sido trocada
-  const dela = pendentes.find((pendente) => pendente.questao === noAr.questao && pendente.sequencia === noAr.sequencia)
+  const dela = pendentes.find((pendente) => pendente.questao === noAr.questao)
```

**`haOutraEsperando`: mais de uma na fila (limite de baixo)**

```mutacao
arquivo: apps/web/src/areas/aluno/respostas.ts
teste: apps/web/src/areas/aluno/respostas.test.ts › com uma só escolha na fila, o estouro espera o recuo
-  return estado.pendentes.length > 1
+  return estado.pendentes.length > 0
```

**`haOutraEsperando`: mais de uma na fila (limite de cima)**

```mutacao
arquivo: apps/web/src/areas/aluno/respostas.ts
teste: apps/web/src/areas/aluno/respostas.test.ts › com duas na fila, a que pendurou espera a vez
-  return estado.pendentes.length > 1
+  return estado.pendentes.length > 2
```

**`bombear`, primeiro termo: só o estouro manda a seguinte na hora**

```mutacao
arquivo: apps/web/src/areas/aluno/fila-de-respostas.ts
teste: apps/web/src/areas/aluno/respostas.test.ts › a falha que não é estouro, com outra escolha esperando
-        if (estourouNoCliente(erro) && haOutraEsperando(estado)) return bombear()
+        if (haOutraEsperando(estado)) return bombear()
```

**`bombear`, segundo termo: com uma só na fila, vale o recuo**

```mutacao
arquivo: apps/web/src/areas/aluno/fila-de-respostas.ts
teste: apps/web/src/areas/aluno/respostas.test.ts › com uma só escolha na fila, o estouro espera o recuo
-        if (estourouNoCliente(erro) && haOutraEsperando(estado)) return bombear()
+        if (estourouNoCliente(erro)) return bombear()
```

**`bombear`: a que mandou a seguinte na hora não agenda o recuo**

```mutacao
arquivo: apps/web/src/areas/aluno/fila-de-respostas.ts
teste: apps/web/src/areas/aluno/respostas.test.ts › com duas na fila, a que pendurou espera a vez
falha: toEqual([])
-        if (estourouNoCliente(erro) && haOutraEsperando(estado)) return bombear()
+        if (estourouNoCliente(erro) && haOutraEsperando(estado)) bombear()
```

**seletor `MemberExpression[computed=false][property.name='fetch']`**

```mutacao
arquivo: eslint.config.mjs
teste: tools/guardas/guardas.test.ts › reprova `globalThis.fetch`
-  { selector: "MemberExpression[computed=false][property.name='fetch']", message: MENSAGEM_DO_FETCH },
```

**seletor `MemberExpression[computed=true][property.value='fetch']`**

```mutacao
arquivo: eslint.config.mjs
teste: tools/guardas/guardas.test.ts › reprova `globalThis.fetch`
-  { selector: "MemberExpression[computed=true][property.value='fetch']", message: MENSAGEM_DO_FETCH },
```

**seletor `ObjectPattern > Property[computed=false][key.name='fetch']`**

```mutacao
arquivo: eslint.config.mjs
teste: tools/guardas/guardas.test.ts › reprova a desestruturação
-  { selector: "ObjectPattern > Property[computed=false][key.name='fetch']", message: MENSAGEM_DO_FETCH },
```

**seletor `ObjectPattern > Property[computed=true][key.value='fetch']`**

```mutacao
arquivo: eslint.config.mjs
teste: tools/guardas/guardas.test.ts › reprova a desestruturação
-  { selector: "ObjectPattern > Property[computed=true][key.value='fetch']", message: MENSAGEM_DO_FETCH },
```

**seletor `ImportSpecifier[imported.name='fetch']`**

```mutacao
arquivo: eslint.config.mjs
teste: tools/guardas/guardas.test.ts › reprova a reexportação
-  { selector: "ImportSpecifier[imported.name='fetch']", message: MENSAGEM_DO_FETCH },
```

**seletor `ExportSpecifier[local.name='fetch']`**

```mutacao
arquivo: eslint.config.mjs
teste: tools/guardas/guardas.test.ts › reprova a reexportação
-  { selector: "ExportSpecifier[local.name='fetch']", message: MENSAGEM_DO_FETCH },
```

**o seletor do `import()` que usa o `fetch` do módulo: a `MemberExpression` vale também para `(await import(…)).fetch`**

```mutacao
arquivo: eslint.config.mjs
teste: tools/guardas/guardas.test.ts › reprova o `import
-  { selector: "MemberExpression[computed=false][property.name='fetch']", message: MENSAGEM_DO_FETCH },
```

**o bloco do `fetch`: vale em `apps/web/src`**

```mutacao
arquivo: eslint.config.mjs
teste: tools/guardas/guardas.test.ts › reprova `globalThis.fetch`
-    files: ESCOPO_DO_FETCH,
+    files: ['apps/web/src/api/**/*.ts'],
    ignores: [...ARQUIVOS_DE_TESTE, '**/__fixtures__/**'],
```

**o bloco do `fetch`: o teste da web fica de fora**

```mutacao
arquivo: eslint.config.mjs
teste: tools/guardas/guardas.test.ts › o teste e o __fixtures__ da web
    files: ESCOPO_DO_FETCH,
-    ignores: [...ARQUIVOS_DE_TESTE, '**/__fixtures__/**'],
+    ignores: ['**/__fixtures__/**'],
```

**o bloco do `fetch`: o `__fixtures__` da web fica de fora**

```mutacao
arquivo: eslint.config.mjs
teste: tools/guardas/guardas.test.ts › o teste e o __fixtures__ da web
    files: ESCOPO_DO_FETCH,
-    ignores: [...ARQUIVOS_DE_TESTE, '**/__fixtures__/**'],
+    ignores: [...ARQUIVOS_DE_TESTE],
```

**o bloco do kit repete os seletores do `fetch`**

```mutacao
arquivo: eslint.config.mjs
teste: tools/guardas/guardas.test.ts › o kit visual também é barrado
-        ...SELETORES_DO_FETCH,
        {
          // O `/` do caminho entra
```

**`no-restricted-globals`: o `fetch` do escopo global**

```mutacao
arquivo: tools/guardas/index.mjs
teste: tools/guardas/guardas.test.ts › reprova o `fetch` solto
-      'no-restricted-globals': ['error', { name: 'fetch', message: 'A chamada à API sai por `apiRequest` ou `comPrazo`, em `api/client.ts`: sem o prazo dele, a resposta pendurada trava a tela e a fila da prova (RF11).' }],
```

**`ESCOPO_DO_FETCH`: tudo em `apps/web/src`**

```mutacao
arquivo: tools/guardas/index.mjs
teste: tools/guardas/guardas.test.ts › reprova o `fetch` solto
-export const ESCOPO_DO_FETCH = ['apps/web/src/**/*.{ts,tsx}']
+export const ESCOPO_DO_FETCH = ['apps/web/src/api/**/*.{ts,tsx}']
```

**`ARQUIVO_DO_CLIENTE`: o cliente é o `api/client.ts`**

```mutacao
arquivo: tools/guardas/index.mjs
teste: tools/guardas/guardas.test.ts › a exceção é o cliente, e só ele
-export const ARQUIVO_DO_CLIENTE = 'apps/web/src/api/client.ts'
+export const ARQUIVO_DO_CLIENTE = 'apps/web/src/api/**'
```

**a exceção do `fetch`: o cliente**

```mutacao
arquivo: tools/guardas/index.mjs
teste: tools/guardas/guardas.test.ts › a exceção é o cliente, e só ele
-    files: [ARQUIVO_DO_CLIENTE, ...ARQUIVOS_DE_TESTE, '**/__fixtures__/**'],
+    files: [...ARQUIVOS_DE_TESTE, '**/__fixtures__/**'],
```

**a exceção do `fetch`: o teste**

```mutacao
arquivo: tools/guardas/index.mjs
teste: tools/guardas/guardas.test.ts › o teste e o __fixtures__ da web
-    files: [ARQUIVO_DO_CLIENTE, ...ARQUIVOS_DE_TESTE, '**/__fixtures__/**'],
+    files: [ARQUIVO_DO_CLIENTE, '**/__fixtures__/**'],
```

**a exceção do `fetch`: o `__fixtures__`**

```mutacao
arquivo: tools/guardas/index.mjs
teste: tools/guardas/guardas.test.ts › o teste e o __fixtures__ da web
-    files: [ARQUIVO_DO_CLIENTE, ...ARQUIVOS_DE_TESTE, '**/__fixtures__/**'],
+    files: [ARQUIVO_DO_CLIENTE, ...ARQUIVOS_DE_TESTE],
```

**o `no-restricted-globals` entra na passada sem comentários**

```mutacao
arquivo: tools/guardas/index.mjs
teste: tools/guardas/guardas.test.ts › fica entre as que a passada sem comentários roda
-  ...REGRAS_DO_FETCH,
  ...REGRAS_DE_TAMANHO,
```

**`comPrazo`: a marca de origem do estouro do cliente**

```mutacao
arquivo: apps/web/src/api/client.ts
teste: apps/web/src/api/client.test.ts › leitura: aos 19,9 s ainda espera
  } catch (erro) {
-    if (estourou) throw new ApiError(ErrorCode.TEMPO_ESGOTADO, undefined, 'cliente')
+    if (estourou) throw new ApiError(ErrorCode.TEMPO_ESGOTADO)
    throw erro
```

**`estourouNoCliente`: só a marca de origem, e não o código, separa o estouro do cliente do `TEMPO_ESGOTADO` da API**

```mutacao
arquivo: apps/web/src/api/client.ts
teste: apps/web/src/api/client.test.ts › o TEMPO_ESGOTADO que a API devolve
-  return erro instanceof ApiError && erro.origem === 'cliente'
+  return erro instanceof ApiError && erro.codigo === ErrorCode.TEMPO_ESGOTADO
```

**`bombear`, primeiro termo, no teste da API: o `TEMPO_ESGOTADO` da API passa pelo recuo**

```mutacao
arquivo: apps/web/src/areas/aluno/fila-de-respostas.ts
teste: apps/web/src/areas/aluno/respostas.test.ts › o TEMPO_ESGOTADO que a API devolve
-        if (estourouNoCliente(erro) && haOutraEsperando(estado)) return bombear()
+        if (haOutraEsperando(estado)) return bombear()
```

**`ehResultadoIncerto`: o estouro do cliente é incerto**

```mutacao
arquivo: apps/web/src/operacao/textos.ts
teste: apps/web/src/operacao/textos.test.ts › o estouro do prazo no navegador deixa incerto
-  return codigo === ErrorCode.INDISPONIVEL_TENTE_DE_NOVO || codigo === ErrorCode.ERRO_INTERNO || estourouNoCliente(erro)
+  return codigo === ErrorCode.INDISPONIVEL_TENTE_DE_NOVO || codigo === ErrorCode.ERRO_INTERNO
```

**`ehResultadoIncerto`: o `TEMPO_ESGOTADO` da API continua recusa**

```mutacao
arquivo: apps/web/src/operacao/textos.ts
teste: apps/web/src/operacao/textos.test.ts › o estouro do prazo no navegador deixa incerto
-  return codigo === ErrorCode.INDISPONIVEL_TENTE_DE_NOVO || codigo === ErrorCode.ERRO_INTERNO || estourouNoCliente(erro)
+  return codigo === ErrorCode.INDISPONIVEL_TENTE_DE_NOVO || codigo === ErrorCode.ERRO_INTERNO || codigo === ErrorCode.TEMPO_ESGOTADO
```

**`estourouNoCliente`: só o `ApiError` conta**

```mutacao
arquivo: apps/web/src/api/client.ts
teste: apps/web/src/api/client.test.ts › o TEMPO_ESGOTADO que a API devolve
-  return erro instanceof ApiError && erro.origem === 'cliente'
+  return erro.origem === 'cliente'
```

**`ehResultadoIncerto`: a conexão que caiu continua incerta**

```mutacao
arquivo: apps/web/src/operacao/textos.ts
teste: apps/web/src/operacao/textos.test.ts › só a conexão que caiu e a resposta fora do contrato
-  return codigo === ErrorCode.INDISPONIVEL_TENTE_DE_NOVO || codigo === ErrorCode.ERRO_INTERNO || estourouNoCliente(erro)
+  return codigo === ErrorCode.ERRO_INTERNO || estourouNoCliente(erro)
```

**`ehResultadoIncerto`: a resposta fora do contrato continua incerta**

```mutacao
arquivo: apps/web/src/operacao/textos.ts
teste: apps/web/src/operacao/textos.test.ts › só a conexão que caiu e a resposta fora do contrato
-  return codigo === ErrorCode.INDISPONIVEL_TENTE_DE_NOVO || codigo === ErrorCode.ERRO_INTERNO || estourouNoCliente(erro)
+  return codigo === ErrorCode.INDISPONIVEL_TENTE_DE_NOVO || estourouNoCliente(erro)
```

**`AVISO_DA_DECISAO`: o aviso do estouro não afirma que nada foi aprovado (a aprovação)**

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Aprovar.tsx
teste: apps/web/src/areas/professor/atividades/Aprovar.test.tsx › a aprovação do lote que passa de 20 s
-  [ErrorCode.TEMPO_ESGOTADO]: 'Não foi possível confirmar a decisão. Confira a situação da correção na tela antes de tentar de novo.',
+  [ErrorCode.TEMPO_ESGOTADO]: 'Não foi possível registrar a decisão agora, e nada foi aprovado. Confira a correção e tente de novo em instantes.',
```

**`AVISO_DA_DECISAO`: o aviso do estouro não afirma que nada foi aprovado (a rejeição)**

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Aprovar.tsx
teste: apps/web/src/areas/professor/atividades/Aprovar.test.tsx › a rejeição do lote que passa de 20 s
-  [ErrorCode.TEMPO_ESGOTADO]: 'Não foi possível confirmar a decisão. Confira a situação da correção na tela antes de tentar de novo.',
+  [ErrorCode.TEMPO_ESGOTADO]: 'Não foi possível registrar a decisão agora, e nada foi aprovado. Confira a correção e tente de novo em instantes.',
```

## Recomendações sem aplicar

Da ordem `.processo/ordens/12_task-r1.md`:

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| infra-guardian (1ª) | Revezamento de duas escolhas penduradas pelo cliente: "limitar o envio imediato a uma volta pela fila desde o último sucesso; depois disso, o recuo" (test-engineer 1ª, rec. 2, diz o mesmo e deixa a decisão ao `infra-guardian`) | Muda comportamento da fila, e o item 1 já restringe o envio imediato ao estouro do cliente. `TODO.md`, para a 13.0 (tela de falha) decidir com a rede pendurada de vez |
| infra-guardian (1ª) | `POST`s sem chave de idempotência que agora estouram aos 20 s (`/v1/tutor/mensagens`, `/v1/assistente/mensagens`, `/v1/ferramentas/*/gerar`): "Tentar de novo" pode duplicar a execução | Já podia acontecer antes; o próprio revisor a manda para a 13.0 e a 14.0. Registrar na seção "Fora do escopo" e no `TODO.md` |
| revisor-geral (1ª) | `material.ts` e `artefatos.ts` repetem o `try/catch` em volta do `pedir`; uma função em `client.ts` evitaria a terceira cópia | Só há duas cópias; refatoração sem comportamento novo. `TODO.md`: extrair quando aparecer a terceira chamada fora do `apiRequest` |
| frontend-reviewer (1ª) | Reduzir a nova tentativa automática quando o erro é de prazo (o professor espera cerca de 41 s) | Muda o `shouldRetry`, que é contrato da leitura; o item 6 registra o tempo. `TODO.md`, para a 13.0 (tela de falha) |
| frontend-reviewer (1ª) | "FERRAME…" cortado na barra de baixo do celular a 360 px | Componente que a tarefa não altera. `TODO.md` |
| conformidade-reviewer (1ª) | Linhas de Criados sem selo de saída de IA (regra 70, item 4a); "já era assim antes desta tarefa" | Fora do diff. `TODO.md`, para tarefa de tela do professor que toque `Criados.tsx` |
| conformidade-reviewer (1ª) | A garantia de que a resposta de prova não se perde é da regra 80 | Do `infra-guardian`; nada a aplicar |
| test-engineer (1ª) | Teste que junte `responderQuestao` de verdade, com o `fetch` pendurado, dentro de `criarFilaDeRespostas` | Os dois lados já têm teste (`client.test.ts` prova os 10 s; `respostas.test.ts`, a fila). `TODO.md` |
| test-engineer (1ª) | `guardas.test.ts`, caso "o alvo da exceção existe e ainda chama o `fetch`": a busca por `/\bfetch\(/` acerta comentário; conferir pelo ESLint | Reescreve uma guarda que passa. `TODO.md` |
| frontend-reviewer (1ª) | O sufixo `16c1cd54` nos nomes da vitrine | Dado sintético da vitrine, não é defeito |

Da ordem `.processo/ordens/12_task-r2.md`:

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| infra-guardian (2ª) | Usar `estourouNoCliente` em `Aprovar.tsx` para dar um texto por origem (também revisor-geral, conformidade-reviewer, test-engineer, privacy-guardian na 2ª) | Os cinco chamam o texto único de lado seguro e aceitável; separar muda a tela e pede texto novo. Registrado no item 3. `TODO.md`, se a 13.0 (tela de falha) quiser um texto por origem |
| infra-guardian (2ª) | Teste de tela em `NovaEscola.tsx` que leve o estouro do navegador ao aviso de tentativa incerta | Hoje só `ehResultadoIncerto` é testado, e o aviso da tela já era coberto por `NovaEscola`. `TODO.md` |
| infra-guardian (2ª) | Compilar o `@educa/shared` antes da rodada, para os testes da web rodarem na revisão | O `test-engineer` rodou os três arquivos da raiz e passaram (74 de 74); é do ambiente do revisor, não da tarefa. Nota ao Orquestrador |
| revisor-geral (2ª) | A linha do docstring de `comPrazo` (`client.ts`) passou da largura das outras | Estilo, sem regra que a barre. Recusada |
| frontend-reviewer (2ª) | Nome da escola e "FERRAME…" cortados a 360 px | Da casca, anterior à tarefa. `TODO.md` (a rodada 1 já o registrou) |
| frontend-reviewer (2ª) | O aviso da decisão não tem foto na vitrine; a validação precisa olhá-lo a 360 px | É do Validador no fim da spec (e2e); nada a aplicar aqui |
| conformidade-reviewer (2ª) | Conferir se `aprovarLote` usa o prazo de leitura (20 s) e não o de envio, por causa do comentário de `AVISO_DA_DECISAO` | Conferido: `aprovarLote` (`atividades.ts:82`) e `decidirEntrega` (`entregas.ts:50`) não pedem `tipo`, valem os 20 s da leitura. Nada a mudar |
| as da rodada 1 sem aplicar | (ver `.processo/ordens/12_task-r1.md`, "Sem aplicar") | Continuam como estão em "Recomendações sem aplicar" do documento; esta ordem não as muda |

Da ordem `.processo/ordens/12_task-r3.md`:

Ninguém reprovou na rodada 3, e as recomendações já entraram em ordem uma vez (`12_task-r1.md` e `12_task-r2.md`): as de agora vão direto para cá, com destino.

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisor-geral (3ª) | `Aprovar.test.tsx:67`: o comentário diz "o diálogo segue aberto" aos 19,9 s, mas nada confere isso; falta `expect(screen.getByRole('alertdialog')).toBeTruthy()` antes de avançar os últimos 100 ms | Reforço de um caso que já passa pelo motivo certo (o `findByText` do aviso e o `not.toContain('nada foi aprovado')` ficam vermelhos com o texto antigo). `TODO.md`, na próxima tarefa que tocar `Aprovar.test.tsx` |
| test-engineer (3ª) | Falta a linha, na tabela "Testes que provam a regra" do documento, para o aviso da decisão no estouro (`Aprovar.test.tsx` › "a aprovação do lote que passa de 20 s…" e "a rejeição do lote que passa de 20 s…") e para a marca `origem: 'cliente'` (`textos.test.ts`) | A prova existe e está nos blocos de mutação e na divergência; é só a tabela do documento. Fica para o Validador cruzar a tabela com o código no fim da spec. `TODO.md` |
| test-engineer (3ª) | O 503 `TEMPO_ESGOTADO` da API mostra o mesmo texto do estouro do cliente, e nenhum teste o fixa | Se a 13.0 (tela de falha) separar o texto por origem, o caso com `ApiError(TEMPO_ESGOTADO)` sem `origem` entra lá. Registrado na divergência do documento. `TODO.md` |
| as da rodada 2 (infra-guardian, revisor-geral, frontend-reviewer, conformidade-reviewer, privacy-guardian) | Texto por origem em `Aprovar.tsx`; teste de tela em `NovaEscola.tsx`; compilar `@educa/shared` antes da rodada; largura do docstring de `comPrazo`; nome da escola e "FERRAME…" cortados a 360 px; foto do aviso da decisão a 360 px | Continuam como em "Sem aplicar" de `.processo/ordens/12_task-r2.md` |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-15 16:19:26 | 2026-11-15 16:19:40 | `tenancy-guardian` | 1 | APROVADO | a14952d0c5b1f82b7 |
| 2026-11-15 16:19:31 | 2026-11-15 16:20:06 | `privacy-guardian` | 1 | APROVADO | a3aebf43db4b81246 |
| 2026-11-15 16:19:13 | 2026-11-15 16:20:10 | `frontend-reviewer` | 1 | APROVADO | a8852bcb9d3c853f3 |
| 2026-11-15 16:19:35 | 2026-11-15 16:20:15 | `conformidade-reviewer` | 1 | APROVADO | a15d8bd2b75d13d4d |
| 2026-11-15 16:19:21 | 2026-11-15 16:21:10 | `revisor-geral` | 1 | REPROVADO | a4afe6466f7d5cee9 |
| 2026-11-15 16:19:17 | 2026-11-15 16:21:26 | `test-engineer` | 1 | APROVADO | a5b17c82a31261590 |
| 2026-11-15 16:19:08 | 2026-11-15 16:21:27 | `infra-guardian` | 1 | REPROVADO | ad42bbe0dea10beef |
| 2026-11-15 16:40:44 | 2026-11-15 16:41:21 | `infra-guardian` | 2 | APROVADO | a6091d0bdb5f3d1fc |
| 2026-11-15 16:41:20 | 2026-11-15 16:41:33 | `tenancy-guardian` | 2 | APROVADO | ae3ec2db60b10ea24 |
| 2026-11-15 16:40:56 | 2026-11-15 16:41:35 | `revisor-geral` | 2 | APROVADO | a891e4c95069740a0 |
| 2026-11-15 16:41:04 | 2026-11-15 16:41:35 | `frontend-reviewer` | 2 | APROVADO | ac69548b6abce1cd0 |
| 2026-11-15 16:41:27 | 2026-11-15 16:41:49 | `privacy-guardian` | 2 | APROVADO | ac95548ef71ba04bb |
| 2026-11-15 16:41:35 | 2026-11-15 16:42:12 | `conformidade-reviewer` | 2 | APROVADO | af9bf27eb1839c92f |
| 2026-11-15 16:41:13 | 2026-11-15 16:42:25 | `test-engineer` | 2 | REPROVADO | a4ccb16254543a6af |
| 2026-11-15 16:59:13 | 2026-11-15 16:59:38 | `revisor-geral` | 3 | APROVADO | a066944cdcd666981 |
| 2026-11-15 16:59:06 | 2026-11-15 16:59:52 | `test-engineer` | 3 | APROVADO | a0204a9c816fe52b1 |
