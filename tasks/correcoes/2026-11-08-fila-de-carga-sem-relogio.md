# Correção — "na esteira (CI=true) não há fila" depende de dois processos vivos ao mesmo tempo

**Origem:** teste intermitente (terceira rodada do portão da correção `2026-11-08-segundo-fator-na-casca`; candidata já registrada no `estado.md` de `acesso-e-convites`).
**Subagentes obrigatórios:** `infra-guardian`, `revisor-geral`
<!-- Ditados pelo PEDIDO do Orquestrador. `test-engineer` é de toda correção. A correção toca `tools/ci/`, o que também chama o `revisor-geral` (passo 5 de `corrigir`). -->

## Sintoma

`tools/ci/fila-de-carga.test.ts › na esteira (CI=true) não há fila: cada job tem a máquina inteira` caiu no portão com `AssertionError: expected 1794120479280 to be less than 1794120479056`: `b entrou` ficou 224 ms depois de `a saiu`.

## Fora desta correção

Os arquivos da tarefa 4.0 em curso (os de `apps/api/src/professores/`, `apps/web/src/areas/coordenacao/professores/`, `apps/api/test/convites-enviar.int.test.ts`, `apps/web/src/areas/coordenacao/painel/fila-da-coordenacao.test.ts`, `docs/interface.md`, `docs/roteiro-da-demonstracao.md`, `e2e/professores.spec.ts`, `e2e/professores-envio.spec.ts`, `e2e/support/seed.ts`, `packages/shared/src/professores/`, `tasks/prd-acesso-e-convites/4_task.md`, `cenarios.md` e `techspec.md`) e `apps/api/test/professores.int.test.ts` (que carrega, além das mudanças da 4.0, as da correção `2026-11-08-professores-int-sem-relogio`); mais, das correções desta sessão, `packages/core/`, `apps/api/src/credencial/challenge*`, `apps/api/src/operacao/operador-challenge*`, `TODO.md`, `e2e/support/casca.ts`, `e2e/mfa.spec.ts` e os documentos de `tasks/correcoes/2026-11-08-*` que não são este. Ficam na árvore, fora da revisão e do commit desta correção.

## Causa

O caso sobe dois processos de brinquedo (`usa-a-fila.ts`) que seguram o lugar por 2,5 s cada e afirma que **os dois estiveram vivos ao mesmo tempo**: `a entrou < b saiu` e `b entrou < a saiu`, comparando `Date.now()` de dois processos. Isso exige que o `node` do segundo
suba, carregue o `.ts` e escreva `entrou` antes de o primeiro acabar os 2,5 s dele. Com a máquina disputada por outro portão, o segundo levou 224 ms a mais do que sobrava e o primeiro já tinha saído; o relógio de parede, que nesta máquina recua e anda desigual, também
entra nas comparações. O que o caso prova (na esteira o `flock` não é tomado) não depende de nenhum dos dois.

## Teste que reproduz

`tools/ci/fila-de-carga.test.ts › na esteira (CI=true) não há fila: cada job tem a máquina inteira`, **com o corpo antigo e o segundo processo chegando 3 s depois do primeiro** (o atraso que a carga produz): vermelho com
`expected 1794121088371 to be less than 1794121087885`, a mensagem do portão. A reprodução foi feita à mão, num rascunho do teste antigo com a espera de 3 s, e não fica no repositório; o que fica é o teste novo, que carrega o atraso.

## Correção

- `tools/ci/fixtures/usa-a-fila.ts`: o modo `--espera-por=<outro>`. Em vez de segurar o lugar por um tempo, o processo só sai depois de ver `<outro> entrou` no diário (até 400 voltas de 50 ms, uns 20 s, abaixo dos 30 s do caso, contadas em voltas do temporizador e não no relógio de parede); se não vê, sai com 4. O começo da linha do diário é que se casa, e não um trecho dela. O uso diz que os milissegundos são ignorados nesse modo.
- `tools/ci/fila-de-carga.test.ts`: o caso sobe `a` com `--espera-por=b`, espera 3 s, sobe `b` com `--espera-por=a`, e afirma **a ordem das linhas do diário** (`ordemDoDiario`, o que cada um escreveu depois do outro), e não as horas: os quatro eventos aparecem, `a entrou` antes de `b saiu`
  e `b entrou` antes de `a saiu`. Essas duas ordens valem por construção quando os dois saem com 0; quem prova a regra é o `[0, 0]`, e o comentário do caso diz isso. A sobreposição passa a valer por construção, qualquer que seja o atraso de quem chega.
- Não muda: `tools/ci/fila-de-carga.ts` (a regra), o outro caso que compara horas (`dois portões ao mesmo tempo não se sobrepõem`), que não foi visto cair e está fora do pedido.

**O teste ainda prova a regra:** com a linha `if (process.env['CI'] === 'true') return` de `fila-de-carga.ts:74` trocada por uma que nunca vale, o primeiro processo segura o lugar, o segundo nunca entra e o caso cai com `expected [ 4, 0 ] to deeply equal [ 0, 0 ]`, em 20,4 s (o primeiro espera as 400 voltas, sai com 4 e solta o lugar; o segundo entra e sai com 0). Restaurada em seguida.

## Mutações

**Sem mutação:** a correção altera só um teste e a fixture dele (`tools/ci/`), nenhuma linha de `apps/*/src` nem de `packages/*/src`; o `--faltando` não lista linha da fixture (`fixtures/` está fora). A prova de que o teste ainda pega a regra está na seção "Correção" (a troca da linha 74, feita à mão e restaurada).

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| privacy-guardian (1ª) | `usa-a-fila.ts:28` lê o diário sem conferir antes se ele existe | Sem ação: o próprio processo escreve `<nome> entrou` na linha 17, antes de qualquer espera, então o arquivo existe; o `infra-guardian` e o `revisor-geral` olharam o trecho e não o apontaram |
| infra-guardian (1ª), test-engineer (1ª) | O caso vizinho `dois portões ao mesmo tempo não se sobrepõem` (`fila-de-carga.test.ts:109-116`) ainda compara `Date.now()` de dois processos; candidato a intermitente, a trocar pela ordem das linhas do diário | Candidata a intermitente no `estado.md` (do Orquestrador, que mantém a lista; o Implementador a cita no relatório). O documento declara o caso fora do pedido, e ele não foi visto cair |

## Estabilidade

O caso rodado sozinho dez vezes seguidas (`-t "na esteira"`): 10 de 10 verdes. O arquivo inteiro: 14 de 14.

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-08 10:35:42 | 2026-11-08 10:35:49 | `tenancy-guardian` | 1 | APROVADO | acf70ca736b6b2881 |
| 2026-11-08 10:35:44 | 2026-11-08 10:35:59 | `conformidade-reviewer` | 1 | APROVADO | a92f882573e5a0026 |
| 2026-11-08 10:35:44 | 2026-11-08 10:36:04 | `privacy-guardian` | 1 | APROVADO | a04b787fa0577d5f9 |
| 2026-11-08 10:35:38 | 2026-11-08 10:36:07 | `revisor-geral` | 1 | APROVADO | a5bf82dce29922e2b |
| 2026-11-08 10:35:35 | 2026-11-08 10:36:12 | `infra-guardian` | 1 | APROVADO | a467a0ec892839548 |
| 2026-11-08 10:35:40 | 2026-11-08 10:36:32 | `test-engineer` | 1 | APROVADO | ad410f01f44c47c21 |
| 2026-11-08 11:42:15 | 2026-11-08 11:42:31 | `infra-guardian` | 2 | APROVADO | a7ca781afd9f453a9 |
| 2026-11-08 11:42:28 | 2026-11-08 11:42:42 | `revisor-geral` | 2 | APROVADO | ade434705ba16b0e3 |
| 2026-11-08 11:42:51 | 2026-11-08 11:42:59 | `tenancy-guardian` | 2 | APROVADO | a00d4fbdae7ed1989 |
| 2026-11-08 11:42:40 | 2026-11-08 11:43:13 | `test-engineer` | 2 | APROVADO | afa367e873ac86a50 |
| 2026-11-08 11:43:03 | 2026-11-08 11:43:16 | `privacy-guardian` | 2 | APROVADO | acd53ec100cf986ed |
| 2026-11-08 11:43:14 | 2026-11-08 11:43:27 | `conformidade-reviewer` | 2 | APROVADO | a52452dc0e3c37a37 |
