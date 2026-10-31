# Os lotes retidos do `ouro`

**Gênero:** referência viva · **Quem altera:** só o Arquiteto, com o `conformidade-reviewer`, num commit só de documento.
**Quem escreve padrão não abre esta pasta**, nem para procurar um id: o lote mede
o que o padrão não conhecia (`tasks/prd-reengenharia/onda-0.md` §2.1, "O lote retido").

Cada lote substitui, na medida de generalização, o corpus do `ouro` que alguém leu para escrever o padrão. Tem o mesmo
formato e as mesmas categorias de `docs/aia/ouro/`, com as decisões do README de lá, e o mesmo número de frases por
categoria. É escrito por um subagente em contexto limpo, que não lê o código, os testes, o `ouro` lido nem a tarefa, e
revisado pelo `conformidade-reviewer`. Frase de sonda de quem revisou ou implementou não entra. Nenhuma frase vem de
aluno real.

`RETIDOS.json` guarda, em `lotes`, um registro por lote, com a `politica`: o sha256 do lote, a `base` (o padrão de antes da tarefa dona), a
`medidaIndependente` (a primeira, contra o padrão congelado da tarefa) e o que ficou fora do alvo do `MEDIDAS.json`.
Depois da primeira medida o lote está **consumido**. Medida depois de uma correção vai em `medidasDepois`, marcada como não
independente.

| Lote | Política | Amostras (`casa`) | Base | Medida independente |
|---|---|---|---|---|
| `riscoAVida-retido-1.json` | `riscoAVida` (D36), depois da 2.0 | 128 (82), ids `RT-001` a `RT-128` | `ca32720`: 8/75, precisão 0,615 | `66d8b95`: 23/75, precisão 0,92, **fora do alvo** |
| `riscoAVida-retido-2.json` | `riscoAVida` (D36), depois da 93.0 e da 94.0 | 128 (82), ids `RT-129` a `RT-256` | `66d8b95`: 31/75, precisão 0,969 | `3f100df`: padrão 37/75 (0,974); padrão ou modelo, pior de 3 no modelo local, 51/75 (0,962), piso de `homonimo` quebrado pelo modelo (12/13), **fora do alvo** |
| `saidaQualitativa-retido-1.json` | `saidaQualitativa` (D55), depois da 3.0 | 99 (58), ids `RQ-001` a `RQ-099` | `b5b7d11` (só `atribuiNotaOuConceito`): 0/58, 0 de 41 legítimas barradas | `1f770ea`: 22/58, precisão 0,88, 3 de 41 legítimas barradas, **fora do alvo** |
| `julgamentoDeTextoDeAluno-retido-1.json` | `julgamentoDeTextoDeAluno` (D55), depois da 3.0 | 90 (57), ids `RJ-001` a `RJ-090` | `b5b7d11`: 32/57, precisão 0,711 | `1f770ea`: 33/57, precisão 0,717, `material_do_professor` 10 de 10 barradas, **fora do alvo** |

A 26.0 passa a ler esta pasta no `golden.test.ts` (zod estrito, sha256 do lote contra o `RETIDOS.json`), sem cair da medida
independente nem da base nas `nao_casa` com piso.
