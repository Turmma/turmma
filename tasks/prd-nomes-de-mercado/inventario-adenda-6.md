# Inventário — adenda 6 (X8)

Anexo do `inventario.md`. **Status:** aprovada pelo Joaquim em 02/11/2026 ~12:15 (opção A), no terminal do Orquestrador
(RF2). **A aprovação veio depois do rename:** a troca já estava feita no `9614bdf8` (02/11 11:55, correção
`2026-11-02-guarda-formas-do-inventario`), sem inventário nem adenda. Esta adenda a registra; nenhum código muda.

**De onde vem.** A correção da guarda pôs `Processador` (nome exato e prefixo) na lista de formas recusadas, e a árvore
tinha uma classe que a lista nova acusaria. A correção a renomeou e a chamou de "colisão que a lista nova achou"; o RF2
pede que peça achada depois da aprovação entre numa adenda aprovada antes do rename, como a adenda 5 fez. A validação
(rodada 2, `validacao.md`, "Críticos") reprovou por isso, e o Joaquim escolheu a opção (a) com o nome que já estava na
árvore.

**Por que não o nome mecânico.** A guarda sugere `ContadoProcessor`, a regra do §1 aplicada palavra a palavra. O inglês
põe o particípio adjetivo no gerúndio (o processador *que conta*), e `CountingProcessor` diz isso. Os dois passam na
guarda; o Joaquim ficou com `CountingProcessor`.

| Nome atual | Nome novo | Tipo | Caminho |
|---|---|---|---|
| `ProcessadorContado` | `CountingProcessor` | classe (local do teste, não exportada; a declaração, 3 usos e 2 menções em comentário) | `apps/despachante/test/slots.int.test.ts:59` |

**Onde entra.** Já entrou, no `9614bdf8`. A guarda não ganha exceção, e a revalidação cobre só o RF2.
