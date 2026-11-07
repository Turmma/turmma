# Correção — o encontro das linhas não entrava na fila de carga e o prazo de 3 min da verificação não cabia com outra linha rodando

**Origem:** uso (`tasks/prd-acesso-e-convites/estado.md`, "O que falhou", 07/11 13:35 e 13:47).
**Subagentes obrigatórios:** `revisor-geral`, `infra-guardian`
<!-- Quem dita os guardiões é o Orquestrador, no pedido: revisor-geral, test-engineer, infra-guardian. test-engineer é obrigatório em toda correção, marcado ou não; revisor-geral porque a correção toca tools/processo/. -->

## Sintoma

`node tools/processo/linhas.ts encontro 1` deu `VERIFICAÇÃO RECUSADA` duas vezes em 07/11, sem código quebrado: `npm run typecheck && npm run lint`
passou dos 3 min (`PRAZO_DA_VERIFICACAO_MS`) com o portão da linha 2 rodando (carga média de 27). Passou com
`EDUCA_ENCONTRO_PRAZO_DA_VERIFICACAO_MS=480000` e um `flock /tmp/educa-carga.lock` digitado.

## Fora desta correção

Nada: o pedido veio sem arquivos da tarefa em curso, e a árvore estava limpa.

## Causa

Duas coisas somadas. (1) O encontro roda typecheck e lint do monorepo inteiro, que é carga como a do portão, mas só o
`portao-local.ts` e o `tools/ci/e2e.ts` chamam `garantirFilaDeCarga()`: o encontro corria junto da outra linha. (2) O prazo de 3 min
foi medido com a máquina quieta; com a carga de outra linha a verificação leva mais, e o prazo vira recusa sem defeito nenhum.

## Teste que reproduz

`tools/processo/linhas.test.ts` › "o encontro espera a vez na fila de carga, sem segurar o quadro, e o prazo da verificação só
corre depois dela". Uma "outra linha" segura a fila (trava própria, `EDUCA_FILA_DE_CARGA`); o encontro, rodado como processo,
não pode começar a verificação, nem segurar a trava do quadro, enquanto ela segura; solta a fila, ele termina com a spec
avançada. O prazo injetado (2 s) é menor que a espera (3 s): se o relógio corresse na fila, a verificação já nasceria
vencida. Os testes de prazo (`o prazo da verificação é de 9 min, ou 12 com o npm ci…`, `o prazo da trava é o de 15 min…`) mudam
com as constantes.

Vermelho antes: sem a chamada, o encontro roda a verificação na hora: o caso cai em `jaSaiu()`, em `existsSync(chegou)` ou no `flock -n` do quadro, conforme a velocidade da máquina. O bloco de mutação não leva `falha:` por isso: qualquer uma das três é a razão certa.

## Correção

- `tools/processo/linhas.ts`: o CLI chama `garantirFilaDeCarga()` quando o comando é `encontro`, antes de pegar a trava do quadro e
  antes de o prazo correr. Quem espera a fila não segura o quadro das outras linhas. Só o CLI: a função `encontro()` chamada direto
  (os testes dela) não muda.
- `PRAZO_DA_VERIFICACAO_MS` de 3 para 9 min e o dele com `npm ci` de 6 para 12 min, como a M1 da retro da F2b, aceita pelo Joaquim em 07/11
  (`TODO.md`, `(F2b, retro, M1)`; `tasks/prd-semana-do-professor/retro.md`): com 540 s a verificação passou com carga 25. O item sai do `TODO.md` como feito por esta correção.
  `PRAZO_DA_TRAVA_MS` de 7 para 15 min, para continuar maior que o prazo com `npm ci` mais o SIGKILL. A recusa de quem trava de
  verdade fica: a verificação que não acaba é morta no prazo, a linha volta ao commit de antes do merge.
- `tools/processo/linhas.test.ts`: o helper `rodar` passa `CI=true` (sem fila, como a esteira) para os casos que não são o da fila;
  o caso novo liga `CI=false` e uma trava própria.
- Fora desta correção: o `6-tarefa.md` do `/seguir` não ganha a frase da fila; o orçamento de leitura (24000 B, `seguir.test.ts`) não deixa, e o texto de lá continua verdadeiro.
  A borda que a frase explicaria, o comando que já roda dentro de um `flock` digitado e por isso não espera por um lugar que tem, está
  coberta em `tools/ci/fila-de-carga.test.ts` (o caso "herda o lugar, e não espera por ele").
- `tools/ci/fila-de-carga.ts`: o comentário do topo passa a listar o encontro entre quem chama a fila. `tools/processo/linhas.ts`: o
  comentário da chamada diz que a espera na fila não tem limite, de propósito, e que a ordem fila → quadro não pode inverter.
- `tools/processo/linhas.test.ts`: no caso da fila, prazo injetado de 2 s e espera de 3 s (mais folga sob carga).

## Mutações

--faltando: 0 linhas (0 blocos, 0 motivos)

```mutacao
arquivo: tools/processo/linhas.ts
teste: tools/processo/linhas.test.ts › o encontro espera a vez na fila de carga, sem segurar o quadro, e o prazo da verificação só corre depois dela
-  if (comando === 'encontro') await garantirFilaDeCarga()
+  if (comando === 'encontro') void garantirFilaDeCarga
```

```mutacao
arquivo: tools/processo/linhas.ts
teste: tools/processo/linhas.test.ts › o prazo da verificação é de 9 min, ou 12 com o npm ci, e quem espera a trava espera mais que isso e o SIGKILL
-export const PRAZO_DA_VERIFICACAO_MS = 9 * 60 * 1000
+export const PRAZO_DA_VERIFICACAO_MS = 3 * 60 * 1000
```

```mutacao
arquivo: tools/processo/linhas.ts
teste: tools/processo/linhas.test.ts › o prazo da verificação é de 9 min, ou 12 com o npm ci, e quem espera a trava espera mais que isso e o SIGKILL
-export const PRAZO_DA_VERIFICACAO_COM_NPM_CI_MS = 12 * 60 * 1000
+export const PRAZO_DA_VERIFICACAO_COM_NPM_CI_MS = 6 * 60 * 1000
```

```mutacao
arquivo: tools/processo/linhas.ts
teste: tools/processo/linhas.test.ts › o prazo da trava é o de 15 min, e o ambiente só o troca por um número
-export const PRAZO_DA_TRAVA_MS = 15 * 60 * 1000
+export const PRAZO_DA_TRAVA_MS = 7 * 60 * 1000
```

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-07 14:33:04 | 2026-11-07 14:33:38 | `infra-guardian` | 1 | APROVADO | a1493ffa12a9dc2cd |
| 2026-11-07 14:33:02 | 2026-11-07 14:34:07 | `revisor-geral` | 1 | REPROVADO | ab3dd4007598d401e |
| 2026-11-07 14:33:03 | 2026-11-07 14:34:37 | `test-engineer` | 1 | APROVADO | a0815214488d2c38b |
| 2026-11-07 14:42:35 | 2026-11-07 14:42:50 | `infra-guardian` | 2 | APROVADO | a742cbfaced84f2c5 |
| 2026-11-07 14:42:28 | 2026-11-07 14:42:51 | `revisor-geral` | 2 | APROVADO | a2086fec29f38287e |
| 2026-11-07 14:42:33 | 2026-11-07 14:43:16 | `test-engineer` | 2 | APROVADO | a842266d04f3a16ba |
