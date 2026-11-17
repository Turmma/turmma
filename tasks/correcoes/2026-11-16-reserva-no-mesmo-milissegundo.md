# Correção — o teste do desfecho da reserva compara a marca da retomada com a da primeira reserva, e as duas caem no mesmo milissegundo

**Origem:** esteira run 43998012800 em 438120f; `apps/worker/test/enviar-email.int.test.ts:333`, caso `o desfecho é da reserva…`, `expected 1794880726638 to be greater than 1794880726638`
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `test-engineer`, `conformidade-reviewer`

## Sintoma

```
AssertionError: expected 1794880726638 to be greater than 1794880726638
 ❯ apps/worker/test/enviar-email.int.test.ts:333
```

O caso passa quase sempre e cai de vez em quando, com o mesmo código. O mesmo trecho existe em `apps/worker/test/enviar-email-da-conta.int.test.ts` (caso do link da conta), que ainda não caiu.

## Fora desta correção

nada

## Causa

É o teste, não o repository. A marca da reserva (`envio_reservado_em`) é `date_trunc('milliseconds', clock_timestamp())` (`packages/core/src/email/envio.repository.ts`), e só vale como prova de posse se a retomada vem 2 minutos depois, que é quando a reserva vence. O caso simula a morte do primeiro processo **só no banco**: `update … set envio_reservado_em = now() - interval '3 minutes'`. A marca que o teste guarda em memória (`primeira.reserva`) continua sendo a original, de uns milissegundos antes, e a retomada, que roda logo em seguida, ganha uma marca do mesmo milissegundo. O `toBeGreaterThan` empata, e em máquina rápida o empate é frequente: dois `clock_timestamp()` seguidos, truncados ao milissegundo, deram o mesmo valor 2000 vezes em 2000 no banco de teste.

Em produção as duas marcas distam pelo menos 2 min, então o repository está certo e não muda. O defeito é a simulação: a marca da "primeira reserva" que o teste usa em `concluir` e `devolver` não é a que a linha guardou depois do `update`.

## Teste que reproduz

Não há vermelho determinístico: o empate depende de duas reservas caírem no mesmo milissegundo, que na máquina local não aconteceu em 40 execuções do caso (0/40), e na esteira aconteceu uma vez. O que substitui o vermelho é (a) a medição do mecanismo, escrita na "Causa" (2000 empates em 2000 pares de `clock_timestamp()` truncados ao milissegundo, no mesmo comando), e (b) a prova da estabilidade abaixo, que não depende mais do relógio: a marca da primeira reserva é escrita pelo teste, 3 min antes, e a comparação é contra ela.

## Correção

Só código de teste muda; nenhum arquivo de `apps/*/src` nem de `packages/*/src`:

- `apps/worker/test/enviar-email.int.test.ts`: o caso calcula `marcaDaPrimeira = primeira.reserva - 3 min`, grava essa marca na linha (em vez de `now() - interval '3 minutes'`) e a usa em `concluir`, `devolver` e na comparação com a marca da retomada. É o que o processo morto de fato guardava, e a asserção deixa de depender do relógio;
- `apps/worker/test/enviar-email-da-conta.int.test.ts`: a mesma troca no caso do link da conta (`marcaDaPrimeira`, `concluirLink`, `devolverLink`).

`enviar-email-adiamento.int.test.ts:420` também recua a marca em 3 min, mas não compara marcas: fica como está.

Prova da estabilidade: os dois arquivos rodados sozinhos **dez vezes seguidas, 10 verdes** (41 casos no total dos dois arquivos), e o caso, antes da correção, 0 falhas em 40 (não reproduzia na máquina). O caso continua provando a regra: a mutação abaixo, que tira a marca da condição de `concluir`, deixa-o vermelho.

## Mutações

--faltando: 0 linhas (1 blocos, 0 motivos)

```mutacao
arquivo: packages/core/src/email/envio.repository.ts
teste: apps/worker/test/enviar-email.int.test.ts › o desfecho é da reserva: `concluir` e `devolver` com a marca de uma reserva que outro processo já retomou não gravam nada
falha: envios.concluir(c.conviteId, marcaDaPrimeira, 'enviado'))).toBe(false)
        envioReservadoEm: null,
      })
-      .where(and(eq(convite.escolaId, requireEscolaId()), eq(convite.id, conviteId), eq(convite.envio, 'enviando'), eq(convite.envioReservadoEm, reserva)))
+      .where(and(eq(convite.escolaId, requireEscolaId()), eq(convite.id, conviteId), eq(convite.envio, 'enviando')))
```

## Recomendações sem aplicar

Da 1ª rodada da Mesa (ordem `.processo/ordens/2026-11-16-reserva-no-mesmo-milissegundo-r1.md`):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| test-engineer (1ª) | Blocos de mutação para `devolver` e para `concluirLink`/`devolverLink` (linhas 100, 133 e 144 de `packages/core/src/email/envio.repository.ts`), além do de `concluir` | Não aplicada: cada bloco novo roda o caso contra produção alterada no portão, e esta correção não muda cláusula de produção (o próprio revisor diz que não bloqueia). Destino: a tarefa futura que tocar `envio.repository.ts`. |
| conformidade-reviewer (1ª) | Observação de que `toBeGreaterThan(marcaDaPrimeira)` ficou quase óbvia | Coberta pelo item 1 (mesmo achado do infra-guardian). |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-16 23:29:57 | 2026-11-16 23:30:08 | `privacy-guardian` | 1 | APROVADO | a27aff1be89930019 |
| 2026-11-16 23:29:56 | 2026-11-16 23:30:09 | `tenancy-guardian` | 1 | APROVADO | a109fd16f615ca4ec |
| 2026-11-16 23:30:00 | 2026-11-16 23:30:14 | `conformidade-reviewer` | 1 | APROVADO | aae0af2b5d01a51a0 |
| 2026-11-16 23:29:58 | 2026-11-16 23:30:31 | `infra-guardian` | 1 | APROVADO | ab2f3e0daa2f033d0 |
| 2026-11-16 23:29:59 | 2026-11-16 23:30:42 | `test-engineer` | 1 | APROVADO | ae5ae81cb6234a4b9 |
| 2026-11-16 23:37:24 | 2026-11-16 23:37:46 | `test-engineer` | 2 | APROVADO | a253b269aa777fcb3 |
