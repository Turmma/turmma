# Correção — o teste do limite por IP assume o Redis aquecido, e a primeira requisição depois do boot cai no seguro em memória

**Origem:** esteira run 43814514097 em 346d5d8 (depois da tarefa 5.0 da reengenharia-continuacao); `apps/api/test/input-boundary-sessao.int.test.ts`, caso `/v1/convites/consultar: o corpo inválido gasta o limite do IP…`, linha 41: esperava 429 `LIMITE_EXCEDIDO` na sexta recusa e recebeu 400. Passou em 5878210.
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`, `infra-guardian`, `privacy-guardian`, `tenancy-guardian`, `conformidade-reviewer`

## Sintoma

Na esteira, `input-boundary-sessao.int.test.ts` falhou em um caso de cinco:

```
AssertionError: expected { status: 400, …(1) } to deeply equal { status: 429, …(1) }
 ❯ apps/api/test/input-boundary-sessao.int.test.ts:41:43
```

As cinco primeiras recusas passam (400 `ENTRADA_INVALIDA`), e a sexta, que devia ser 429, volta 400. Localmente, o mesmo arquivo falhou uma vez em três rodadas seguidas (a linha l1 rodava o portão dela na mesma máquina), sempre no primeiro caso do arquivo, e passou em doze rodadas seguidas com a máquina em repouso.

## Fora desta correção

nada

## Causa

Não é o código da 5.0 nem a guarda: é o teste, que assume que toda requisição é contada no Redis.

O cliente do limite (`createApiRedisClient`, `api-limite`) corta o comando em 100 ms (`TIMEOUT_COMANDO_REDIS_API_MS`) e não tem fila offline. Quando a primeira requisição depois do boot chega com a conexão ainda fria, ou com o script de contagem ainda por carregar e a máquina ocupada, o comando passa do corte (ou o cliente ainda não está pronto) e o `RateLimiterRedis` entrega o ponto ao seguro em memória (`insuranceLimiter`), que conta numa chave à parte e com teto `limite ÷ instâncias` (regra 80, item 5: o limite nunca some, e o Redis fora nunca vira erro). É o comportamento projetado e provado em `rate-limit.int.test.ts`.

O teste faz seis chamadas seguidas no mesmo IP e conta com cinco no Redis e a sexta recusada. Com a primeira no seguro, o Redis conta só quatro antes da sexta, que passa. Medido numa cópia do caso com `seguroAtivo` por requisição e a máquina sob carga de CPU (um laço por núcleo): na rodada que falhou, a primeira chamada saiu com `seguro=1` (76 ms) e as cinco seguintes com `seguro=0`. Nas sete rodadas verdes, a primeira chamada levou de 30 a 113 ms com `seguro=0`: a primeira requisição é sempre a mais lenta, e só passa do corte quando a máquina está ocupada, o que a esteira e a linha vizinha fazem.

O diff da 5.0 não toca o limitador, a guarda, o cliente Redis nem o `subirApi` (`git diff 58782107 dd7dde79` em `packages/core/src/rate-limit`, `redis/clients.ts` e `apps/api/test/test-api.ts`: vazio). O que passou em 5878210 e falhou em 346d5d8 é a sorte do instante da primeira chamada: o defeito é do teste, que sempre dependeu de ela caber nos 100 ms.

## Teste que reproduz

Reprodução determinística não existe: o corte de 100 ms depende de a máquina estar ocupada no instante da primeira chamada, e o vermelho não se escolhe. A evidência que substitui o vermelho, em `apps/api/test/input-boundary-sessao.int.test.ts`:

- antes: um vermelho em três rodadas do arquivo (l1 com o portão rodando), um em oito sob carga de CPU, com `seguro=1` na primeira chamada do caso vermelho, e o da esteira;
- depois: o arquivo rodado sozinho vinte vezes seguidas, as vinte sob a mesma carga de CPU: 20 verdes, 0 vermelhas (seção "Correção").

O caso passa a falhar com a causa escrita, e não com o 400 no lugar do 429, se o Redis do limite não aquece (`o Redis do limite não aqueceu`): o seguro deixa de ser silencioso.

## Correção

Só o teste muda; nenhum arquivo de `apps/*/src` nem de `packages/*/src`. Em `apps/api/test/input-boundary-sessao.int.test.ts`:

- o `beforeAll` passa a chamar `aquecerORedisDoLimite()`, que manda uma chamada de um IP descartável a cada uma das cinco rotas do arquivo (as duas de `consultar`, as três de login), num `do … while` que repete, até 30 vezes e com 100 ms entre elas, enquanto o `RateLimiter.seguroAtivo` for 1. Se o limitador não responde pelo Redis, o `expect(seguroAtivo, '<rota>: o Redis do limite não aqueceu').toBe(0)` cai ali, com a causa escrita;
- as cinco rotas moram em duas constantes (`ROTAS_DE_CONSULTA` e `ROTAS_DE_LOGIN`), e o aquecimento e os dois `it.each` leem as mesmas: rota nova entra nos dois ou em nenhum (ordem da 1ª rodada, item 2);
- os casos chamam `postarContado`, que confere `seguroAtivo === 0` depois de cada chamada, com a mesma mensagem. Uma chamada que passe dos 100 ms no meio de um caso, com a máquina ocupada, cai com a causa escrita e não num 400 no lugar do 429: a frase "o seguro deixa de ser silencioso" da seção "Teste que reproduz" vale dentro dos casos também (item 1). A falha continua sendo do ambiente, e o teste só passou a dizer isso;
- o comentário do aquecimento diz que a primeira tentativa carrega o script de contagem mesmo cortada pelo cliente, e que esperar o `ready` não basta (item 4).

Não se mexeu no corte de 100 ms nem no seguro: são o desenho da regra 80, item 5, e `rate-limit.int.test.ts` prova o Redis fora. O IP de cada chamada de aquecimento é sorteado, então nenhum balde que um caso usa leva ponto do aquecimento.

Prova da estabilidade: o arquivo inteiro, vinte rodadas seguidas com um laço de CPU por núcleo (a carga que dava um vermelho em oito antes do ajuste): **20 verdes, 0 vermelhas**, na versão do aquecimento e na final, com a conferência dentro dos casos (as duas medidas, depois da ordem da 1ª rodada).

## Sem aplicar

Da 1ª rodada da Mesa (ordem `.processo/ordens/2026-11-16-limite-do-ip-no-consultar-convite-r1.md`):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| privacy-guardian (1ª) | Sortear o IP do aquecimento numa faixa só dele, como `192.0.2.x` (RFC 5737), para a separação ser garantida e não só provável | Recusada: o sorteio atual tem cerca de 15,6 milhões de valores e a colisão com o IP de um caso é desprezível; uma faixa `192.0.2.x` tem 254 valores, e as até 150 chamadas do aquecimento (5 rotas × 30) passariam a colidir entre si no balde de 5 por minuto |
| infra-guardian (1ª), test-engineer (1ª) | O mesmo aquecimento pode faltar em outros arquivos que contam N chamadas no Redis logo depois do `subirApi` (`rate-limit.int.test.ts`, `password-attack.int.test.ts`, cerca de 18 testes com `LIMITE_REQ_*`); a casa certa seria o `subirApi` de `apps/api/test/test-api.ts` | `TODO.md`, seção "Da correção 2026-11-16-limite-do-ip-no-consultar-convite": a mesma suposição pode ficar intermitente nesses arquivos. Mexer em `test-api.ts` fica fora: toca cerca de 18 testes e pede tarefa própria, e esta correção é só do arquivo que falhou |

Da 2ª rodada (ordem `.processo/ordens/2026-11-16-limite-do-ip-no-consultar-convite-r2.md`, sem item a aplicar):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisor-geral (2ª) | `TODO.md`, fim do arquivo: a linha nova não segue o padrão das vizinhas `(reengenharia-continuacao, <origem>, <revisor>, <rodada>, <data>)`; faltam o nome da spec e a data `16/11/2026` | Recusada: é formato de uma linha de `TODO.md`, não muda comportamento nem contrato, e a linha já traz a correção e os revisores que a pediram; quem a abrir pelo `TODO.md` a acha pelo slug da correção |
| revisor-geral (2ª) | Extrair `conferirRedisAquecido(caminho)`, porque o `expect` que encerra o aquecimento repete a mensagem de `postarContado` (só legibilidade) | Recusada: são duas linhas iguais em dois lugares com papéis diferentes (um fecha o aquecimento por rota, o outro confere depois de cada chamada de um caso), e o ajudante não muda o que o teste prova |
| test-engineer (2ª) | `postarContado` confere só a última consulta ao limitador da requisição: se uma requisição consulta dois limites, o primeiro cai no seguro e o segundo passa pelo Redis, o desvio passa despercebido (o teste ainda cai em `rebaixado`, sem a causa escrita); uma saída é conferir também a `proporcaoDoSeguro` | `TODO.md`: acrescentada à linha sobre o aquecimento no `subirApi` compartilhado (a mesma tarefa pode trazer a conferência por `proporcaoDoSeguro`); só aparece na tentativa válida de login, e o teste cai de qualquer modo |
| test-engineer (2ª) | `as const` em `ROTAS_DE_CONSULTA`, para ficar uniforme com `ROTAS_DE_LOGIN` | Recusada: não muda o `%s` dos nomes dos casos nem o comportamento, só o tipo de uma lista de duas strings |

## Mutações

**Sem mutação:** a correção só altera arquivo de teste (`apps/api/test/input-boundary-sessao.int.test.ts`), e as cláusulas novas, o aquecimento e a conferência do `seguroAtivo` depois de cada chamada (`postarContado`), não têm vermelho determinístico: o corte de 100 ms depende de a máquina estar ocupada no instante da chamada, e tirar o `aquecerORedisDoLimite()` ou a conferência deixa o arquivo verde na máquina em repouso (doze de doze). A evidência que a substitui é a da seção "Teste que reproduz".

`--faltando: 0 linhas (0 blocos, 0 motivos)`

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-16 04:16:06 | 2026-11-16 04:16:16 | `tenancy-guardian` | 1 | APROVADO | af5d5d9af84224abd |
| 2026-11-16 04:16:05 | 2026-11-16 04:16:21 | `privacy-guardian` | 1 | APROVADO | aaa0b96e4b94d5a0d |
| 2026-11-16 04:16:07 | 2026-11-16 04:16:23 | `conformidade-reviewer` | 1 | APROVADO | af83d10c4a2422f2f |
| 2026-11-16 04:16:04 | 2026-11-16 04:16:28 | `infra-guardian` | 1 | APROVADO | a6c784534bf6a3fee |
| 2026-11-16 04:16:03 | 2026-11-16 04:16:31 | `revisor-geral` | 1 | APROVADO | acb0c576abf1dde58 |
| 2026-11-16 04:16:02 | 2026-11-16 04:17:45 | `test-engineer` | 1 | APROVADO | a484c5a30073d6d4c |
| 2026-11-16 04:35:11 | 2026-11-16 04:35:29 | `revisor-geral` | 2 | APROVADO | a9f6985cbbbc8ab24 |
| 2026-11-16 04:35:03 | 2026-11-16 04:35:43 | `test-engineer` | 2 | APROVADO | a8a45f02e5ef235dd |
