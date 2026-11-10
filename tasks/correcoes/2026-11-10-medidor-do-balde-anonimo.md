# Correção — o medidor do balde anônimo da carga da sala não tem caso unitário e cala o erro de leitura

**Origem:** `TODO.md`, seção "Da tarefa 16.0 da acesso-e-convites", itens do `infra-guardian` (4ª rodada) e do `infra-guardian` e `test-engineer` (4ª): o laço do cursor do `SCAN` e o `medirOBaldeAnonimo` (`infra/scripts/carga-sala.ts`) entraram na 16.0 sem caso unitário, e o pico de 3.579 foi medido antes de o `SCAN` seguir o cursor.
**Subagentes obrigatórios:** `infra-guardian`, `privacy-guardian`, `test-engineer`, `revisor-geral`
<!-- Os guardiões vieram no PEDIDO do Orquestrador. `revisor-geral` também está na linha do pedido. -->

## Sintoma

`valoresDoBaldeAnonimo` e `medirOBaldeAnonimo` eram funções internas de `infra/scripts/carga-sala.ts`, presas ao `ioredis`: nenhum teste
provava que o `SCAN` segue o cursor até `'0'`, que o laço guarda o maior valor, nem que a leitura que falha é contada. O
`cliente.on('error', () => undefined)` calava o erro de conexão, e a linha "o balde anônimo por IP não foi lido nenhuma vez" não dizia se
foi o Redis que falhou ou a chave que não apareceu. O pico de 3.579 por minuto (`16_task.md`, `docs/runbook.md`, `docs/infra.md` 5.1) tinha
sido medido com o medidor de uma página só, antes de a 3ª rodada da 16.0 trocar o `SCAN` por um laço de cursor.

## Fora desta correção

Duas coisas de documento ficam com o Arquiteto, na próxima triagem (`TODO.md`, "Alinhar o texto da spec ao medidor novo"): o `rl:ip:senha:` na descrição do balde de `16_task.md`, e o `cenarios.md` dizer que pico 0 reprova no `k2_conta`. Os arquivos da tarefa em curso: nenhum (a árvore estava limpa).

## Causa

Falha de cobertura da **tarefa 16.0** (linha 1): o medidor foi escrito como função interna que recebe o cliente `ioredis`, então só uma
carga de verdade o exercitava. O contador de erros não existia porque o único destino do erro era `() => undefined`.

## Teste que reproduz

`infra/test/carga-sala.test.ts` › "o medidor do balde anônimo" (cinco casos): o cursor de duas páginas, o filtro das chaves e o valor que
expirou ou não é número, a página única, o laço (maior valor, erro de leitura e de cliente contados) e a linha "não foi lido" com a contagem.
Vermelho antes (contra o `carga-sala.ts` do HEAD: `valoresDoBaldeAnonimo is not a function` e `acompanharOBalde is not a function`, 5
casos), verde depois (44 de 44, três execuções seguidas).

## Correção

Em `infra/scripts/carga-sala.ts`: `valoresDoBaldeAnonimo` passa a receber um `LeitorDoBalde` (`scan` de uma página e `get`), e o laço
de leitura sai de `medirOBaldeAnonimo` para `acompanharOBalde`, que conta as leituras que lançam e o erro que o cliente emite. O
`medirOBaldeAnonimo` fica só com a ligação ao `ioredis`. A carga imprime `descreverBaldeNaoLido(fase, erros)`: "não foi lido nenhuma vez
(N erros do Redis)". Do erro sai só a contagem: a chave, que leva o IP, e a mensagem do erro não se imprimem (regra 20).

## Carga real com o medidor novo

`npm run carga:sala -- --fases k2_conta`, com o medidor novo (cursor seguido até `'0'`), em 10/11: **passou**. Pico do `rl:ip` de **3.678 por minuto
de 6.000 (61%)**, contra os 3.579 (60%) do medidor de uma página; 0 resposta 429, 0 erro 5xx, 1.782 contas provadas e 1.782 entradas pela conta,
`decidir` p95 de 1.700 ms (era 1.593 ms; o texto de `16_task.md` e o do `TODO.md` dizem as duas medições), 2.100 aprovados, nenhum nome com dois pedidos. O pico mudou, então o número foi trocado em
`tasks/prd-acesso-e-convites/16_task.md` (linhas 92, 102 e 104), `docs/runbook.md` e `docs/infra.md` 5.1. O registro histórico da 4ª rodada
(`16_task.md`, tabela de recomendações) e `achados/` guardam o 3.579 como foi dito na época.

## Mutações

--faltando: 0 linhas (7 blocos, 0 motivos)

```mutacao
arquivo: infra/scripts/carga-sala.ts
teste: infra/test/carga-sala.test.ts › segue o cursor até voltar a `0`
     }
-  } while (cursor !== '0')
+  } while (false)
```

```mutacao
arquivo: infra/scripts/carga-sala.ts
teste: infra/test/carga-sala.test.ts › lê só as chaves do balde anônimo
-    for (const chave of chavesDoBaldeAnonimo(chaves)) {
+    for (const chave of chaves) {
```

```mutacao
arquivo: infra/scripts/carga-sala.ts
teste: infra/test/carga-sala.test.ts › lê só as chaves do balde anônimo
-      if (valor !== null && Number.isFinite(Number(valor))) valores.push(Number(valor))
+      if (Number.isFinite(Number(valor))) valores.push(Number(valor))
```

```mutacao
arquivo: infra/scripts/carga-sala.ts
teste: infra/test/carga-sala.test.ts › lê só as chaves do balde anônimo
-      if (valor !== null && Number.isFinite(Number(valor))) valores.push(Number(valor))
+      if (valor !== null) valores.push(Number(valor))
```

```mutacao
arquivo: infra/scripts/carga-sala.ts
teste: infra/test/carga-sala.test.ts › o laço guarda o maior valor visto
       } catch {
-        erros += 1
+        // erro de leitura não conta
       }
```

```mutacao
arquivo: infra/scripts/carga-sala.ts
teste: infra/test/carga-sala.test.ts › o laço guarda o maior valor visto
     registrarErro: () => {
-      erros += 1
+      // erro do cliente não conta
     },
```

```mutacao
arquivo: infra/scripts/carga-sala.ts
teste: infra/test/carga-sala.test.ts › sem nenhuma leitura que deu certo
-  return `  ${fase}: o balde anônimo por IP não foi lido nenhuma vez (${String(erros)} ${erros === 1 ? 'erro do Redis' : 'erros do Redis'})`
+  return `  ${fase}: o balde anônimo por IP não foi lido nenhuma vez (${String(erros)} erros do Redis)`
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| privacy-guardian (1ª) | Caso de teste que injete um erro com `rl:ip:10.0.0.1` na mensagem e confira que a saída não contém `rl:ip:` | Recusada: `registrarErro` não recebe argumento e `descreverBaldeNaoLido` só recebe fase e número, então a chave e a mensagem não têm por onde chegar à linha. O caso passaria por construção e não teria cláusula para mutar, e cada caso novo precisa de um bloco em "Mutações" |
| privacy-guardian (1ª) | `carga-sala.ts:659` imprime `erro.message` quando o cenário inteiro falha, e a mensagem do `ioredis` pode trazer a chave se o medidor passar a relançar o erro | `TODO.md`, para a tarefa futura que mudar o medidor ou o tratamento de erro da carga: a linha é anterior a esta correção e hoje o erro do medidor não chega até ela |
| test-engineer (1ª) | A ligação `cliente.on('error', medidor.registrarErro)` não é provada: voltar a `() => undefined` não derruba caso nenhum (exigiria `medirOBaldeAnonimo` receber o cliente ou uma fábrica) | `TODO.md`, para a tarefa futura que tocar `medirOBaldeAnonimo`: muda a assinatura da função, e o próprio test-engineer diz que não bloqueia, porque com o Redis fora do ar o `scan` também rejeita e o `catch` já provado deixa `erros > 0` |
| test-engineer (1ª) | `descreverBaldeNaoLido(fase, erros)` em `executar` (`carga-sala.ts:632`) não tem caso | Recusada: é a cola dentro da função que só a carga real roda, e a carga real imprime essa linha; o próprio test-engineer escreve "dá para aceitar como cola" |
| infra-guardian (2ª) | A asserção `expect(erros).toBe(tentativas)` dá sempre o mesmo resultado: o `ler` falso rejeita na hora e `parar()` espera o laço terminar | Recusada: é o que a ordem r1 pediu (o caso passava até com `erros = 0`), e o revisor-geral e o test-engineer conferiram que a igualdade vale sempre porque `parar()` espera o laço (`await laco`). Não é defeito |
| infra-guardian (2ª) | O item novo do `TODO.md` cita "perto da linha 659", número que envelhece: citar a função ou a frase `o cenário não terminou` | Recusada: o item já diz "perto da linha" e a tarefa futura que o pegar procura `erro.message` no arquivo; a edição seria só de texto de `TODO.md`, sem efeito em código |
| privacy-guardian (2ª) | Os dois itens novos do `TODO.md` (o `erro.message` da linha 659 e a ligação do `on('error')` sem caso) devem ser tratados na mesma tarefa, se alguém tocar a assinatura de `medirOBaldeAnonimo` ou o tratamento de erro da carga | `TODO.md`: os dois itens já estão lado a lado e com o mesmo gatilho (a tarefa que tocar `medirOBaldeAnonimo` ou o erro da carga); nenhuma ação agora |
| test-engineer (2ª) | A linha 254 confere o texto com o valor fixo 3, e não com o `erros` medido: só a chamada em `executar` (`carga-sala.ts:632`) liga o contador ao texto | Recusada: é a mesma cola de `executar` que a 1ª rodada recusou, e que a carga real exercita; o próprio test-engineer diz que "está certa como prova do texto" |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.
| 2026-11-10 09:54:07 | 2026-11-10 09:54:34 | `revisor-geral` | 1 | APROVADO | af68347419351ed22 |
| 2026-11-10 09:54:04 | 2026-11-10 09:54:40 | `privacy-guardian` | 1 | APROVADO | a0651a0e855679b76 |
| 2026-11-10 09:54:05 | 2026-11-10 09:54:46 | `infra-guardian` | 1 | APROVADO | a133becf5c19064e5 |
| 2026-11-10 09:54:06 | 2026-11-10 09:55:15 | `test-engineer` | 1 | APROVADO | a237acbe79fbb22b5 |
| 2026-11-10 10:12:34 | 2026-11-10 10:13:02 | `infra-guardian` | 2 | APROVADO | ab04d03b1c22fa6ba |
| 2026-11-10 10:12:43 | 2026-11-10 10:13:06 | `privacy-guardian` | 2 | APROVADO | aa3cc4a7513d28185 |
| 2026-11-10 10:13:00 | 2026-11-10 10:13:24 | `revisor-geral` | 2 | APROVADO | a17a96f6da0bd646f |
| 2026-11-10 10:12:52 | 2026-11-10 10:13:25 | `test-engineer` | 2 | APROVADO | a00f4f7743e3895f9 |
