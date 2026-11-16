# Correção — o teste do prazo do job procura o `4242` no log inteiro, e o `4242` aparece dentro de um UUID sorteado

**Origem:** esteira run 43818883538 em 785f7d3 (execução do push da correção `2026-11-16-limite-do-ip-no-consultar-convite`); `apps/worker/test/job-timeout.int.test.ts`, caso `job que não termina, na última tentativa…`, `expected log not to contain '4242'`. O `4242` estava no `jobId` sorteado (`…-594242a7b87a`), não no dado do job.
**Subagentes obrigatórios:** `privacy-guardian`, `infra-guardian`, `test-engineer`, `revisor-geral`, `tenancy-guardian`, `conformidade-reviewer`

## Sintoma

```
AssertionError: expected '{"…"jobId":"…-594242a7b87a"…}' not to contain '4242'
 ❯ apps/worker/test/job-timeout.int.test.ts:73
```

O caso passa quase sempre e cai de vez em quando, com o mesmo código, sem relação com a carga da máquina.

## Fora desta correção

nada

## Causa

É o teste, não o worker. O caso prova que o log não vaza o conteúdo do job escolhendo um valor que só o `dados` do job tem
(`cpuMs: 4_242`) e procurando a sequência `4242` no log inteiro (`log.linhas.join('\n')`). Só que o log leva ids sorteados
(`jobId`, `escolaId`, `requisicaoId`, todos UUID v4), e o UUID é feito de dígitos hexadecimais: a sequência `4242` cabe dentro de um
deles. Com três UUIDs por linha e perto de 28 janelas de 4 caracteres em cada, a chance de uma rodada cair é de uns 0,1%, o que na
esteira aparece como "intermitente". O valor não vazou: o falso positivo é da busca por texto solto.

Não dá para fugir do UUID escolhendo outro número: o `cpuMs` é um inteiro de no máximo `CPU_MS_MAXIMO_SINTETICO`, e qualquer
sequência de dígitos curta cabe num segmento hexadecimal. O que separa o dado de um id é que o id é um UUID inteiro, e a busca tem de
ignorá-lo.

## Teste que reproduz

`apps/worker/test/in-memory-log.test.ts › o log em memória: ids sorteados não contam como valor vazado`: monta uma linha de log do jeito
do worker, com o `jobId` `…-594242a7b87a` do pedido e nenhum `4242` em campo de dado. Determinístico (o id é escrito no teste, não
sorteado). Vermelho antes, porque a busca era a do texto solto.

## Correção

Só código de teste muda; nenhum arquivo de `apps/*/src` nem de `packages/*/src`:

- `apps/worker/test/queue.fixture.ts`: o `InMemoryLog` ganha `contemValor(valor)`, que tira do texto do log todo UUID inteiro
  (`UUID_NO_TEXTO`) antes de procurar o valor. O valor que vaza como campo (`"prazoMs":4242`) continua achado; o que está dentro de um id
  não conta;
- `apps/worker/test/job-timeout.int.test.ts`: a linha `not.toContain(String(CPU_QUE_SO_O_JOB_TEM))` virou
  `expect(log.contemValor(String(CPU_QUE_SO_O_JOB_TEM))).toBe(false)`. O valor, o log e o que o caso prova são os mesmos;
- `apps/worker/test/in-memory-log.test.ts` (novo): o contrato da busca, com o `jobId` `…-594242a7b87a` escrito no teste.

Não se trocou o `4242` por outro número: o `cpuMs` é limitado pelo schema do job sintético, e qualquer sequência curta de dígitos cabe num
UUID. Os outros casos que procuram valor em `log.linhas` (`job-execution.int.test.ts`, `expurgo-da-escola.int.test.ts`,
`montar-arquivo.int.test.ts`) procuram texto com letras ou o próprio UUID de um pedido, que o `contemValor` não serviria; ficam como estão.

Prova da estabilidade: o `job-timeout.int.test.ts` rodado sozinho **dez vezes seguidas, 10 verdes** (4 casos em cada). O contrato novo
é determinístico: vermelho antes (`expected true to be false`, na busca no texto solto), verde depois.

## Mutações

--faltando: 0 linhas (1 blocos, 0 motivos)

```mutacao
arquivo: apps/worker/test/queue.fixture.ts
teste: apps/worker/test/in-memory-log.test.ts › o `4242` dentro de um UUID não é o `4242` do dado do job
falha: toBe(false)
-    return this.linhas.join('\n').replace(UUID_NO_TEXTO, '').includes(valor)
+    return this.linhas.join('\n').includes(valor)
```

## Recomendações sem aplicar

Da 1ª rodada da Mesa (ordem `.processo/ordens/2026-11-16-uuid-no-log-do-job-timeout-r1.md`):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| infra-guardian (1ª) | Terceiro caso em `in-memory-log.test.ts`: `4242` em campo e dentro de UUID na mesma linha, esperando `true` | Recusada: o 2º caso já é esse. Usa o mesmo `jobId` `…-594242a7b87a` com `prazoMs: 4_242` e espera `true` |
| privacy-guardian (1ª) | Somar ao `job-timeout.int.test.ts:73` uma checagem estrutural (nenhum registro de `log.registros()` com a chave `dados` ou `cpuMs`) | Recusada: acrescenta uma prova nova ao caso, que a correção de um falso positivo não pede; a busca por valor já prova o que o caso provava. Vai para o `TODO.md` se o Joaquim quiser a prova estrutural |
| test-engineer (1ª) | Renomear `contemValor` para `contemForaDeId` | Recusada: o nome já está no documento, nos três arquivos e na mutação; o comentário do item 1 passa a dizer o limite |
| test-engineer (1ª), conformidade-reviewer (1ª) | Se um dos outros casos que procuram valor em `log.linhas` passar a procurar só dígitos, usar `contemValor`; uma linha no guia do desenvolvedor | Retro da funcionalidade (`docs/guia-do-desenvolvedor.md`); nenhum deles procura só dígitos hoje |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-16 05:00:29 | 2026-11-16 05:00:40 | `tenancy-guardian` | 1 | APROVADO | a564c0f3ba55acca7 |
| 2026-11-16 05:00:25 | 2026-11-16 05:00:44 | `revisor-geral` | 1 | APROVADO | aeb61c3ba897eebaa |
| 2026-11-16 05:00:27 | 2026-11-16 05:00:45 | `infra-guardian` | 1 | APROVADO | afcd56addd08f29b3 |
| 2026-11-16 05:00:30 | 2026-11-16 05:00:54 | `conformidade-reviewer` | 1 | APROVADO | a5ac7a7157000b57b |
| 2026-11-16 05:00:26 | 2026-11-16 05:00:56 | `privacy-guardian` | 1 | APROVADO | af3695c1c88246618 |
| 2026-11-16 05:00:24 | 2026-11-16 05:01:31 | `test-engineer` | 1 | APROVADO | a2d4a8bda2aafaece |
| 2026-11-16 05:08:09 | 2026-11-16 05:08:18 | `revisor-geral` | 2 | APROVADO | a31722248db19db1d |
