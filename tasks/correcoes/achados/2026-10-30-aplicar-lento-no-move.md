# Achados das revisões — `tasks/correcoes/2026-10-30-aplicar-lento-no-move.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## revisor-geral · 1ª rodada · APROVADO · 2026-10-30 10:09:16 · `tasks/correcoes/2026-10-30-aplicar-lento-no-move.md`

VEREDITO: APROVADO

Escopo: respeitado. A correção mexe só em `paraRelativo`, que agora guarda a resposta por árvore, e o cálculo antigo foi para `calcularRelativo` sem mudança. O desenho do passo 3 ficou como estava (um serviço por projeto). A ideia de pular o projeto que não alcança o arquivo foi descartada, e o documento explica por quê. O `tools/renomear/mapas/` ficou fora da revisão, como foi pedido.

Aderência à Tech Spec: ok. O passo 3 da §5 de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/techspec.md` (`getEditsForFileRename` e `git mv`) continua igual. É uma correção de desempenho que não muda nenhum resultado. Guardar a resposta é seguro porque ela só depende de `arvore.raiz`, que é `readonly`, e do texto do caminho. O caminho relativo só é calculado quando `isAbsolute` dá verdadeiro, então a pasta de trabalho do processo não interfere.

Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo).

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/projetos.test.ts:86`: o nome do caso diz "a mesma árvore lembra, e outra raiz recalcula", mas o teste só confere o valor devolvido. Ele não usa o contador `pedidos.relative` para provar que a segunda chamada não recalcula. Ou o caso passa a conferir o contador, ou o nome deve dizer só o que o teste prova: o resultado depende da raiz de cada árvore.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/projetos.ts:25-27`: o comentário no código de produção traz números de medição ("85% dos 214 s", "~2700 arquivos"). Esses números vão ficar velhos. Basta deixar o motivo (o serviço pede a versão de todo arquivo a cada `getProgram()`), e a medição já está registrada no documento da correção.
- O contador do teste é um `vi.mock` de `node:path` e só intercepta o `relative` importado pelo nosso código. O `typescript` fica de fora do mock, e é isso que se quer. Só que, se alguém trocar para `posix.relative` em `projetos.ts`, os dois casos de custo passam sem medir nada. Uma linha no comentário do teste avisando dessa dependência evitaria a armadilha.

## test-engineer · 1ª rodada · APROVADO · 2026-10-30 10:09:21 · `tasks/correcoes/2026-10-30-aplicar-lento-no-move.md`

VEREDITO: APROVADO

**Cenários exigidos:** A correção é de desempenho numa ferramenta de linha de comando que roda em um processo só. Não toca escola, permissão nem concorrência, então isolamento, permissão e corrida não se aplicam. Os cenários que provam a regra são cinco:
- Um programa sem mudança, pedido muitas vezes pelo serviço de linguagem, não recalcula o caminho de nenhum arquivo.
- Um move de arquivo com muitos importadores calcula o caminho de cada arquivo uma vez só.
- O move continua certo depois da correção: importadores e re-export acompanham o arquivo.
- Guardar a resposta não muda o resultado do `paraRelativo` em nenhum caso de borda: caminho dentro da raiz, a própria raiz, fora dela e caminho não absoluto.
- A resposta guardada vale para uma árvore só: outra raiz com o mesmo caminho absoluto calcula de novo.

**Cobertos:** os cinco, todos em `tools/renomear/projetos.test.ts`, e o arquivo passa com 4 de 4 verdes em 732 ms.
- **O programa sem mudança** (linhas 49 a 59): 30 rodadas de `getProgram()` em todos os projetos, e a asserção é que o contador de `path.relative` fica vazio. A mutação `if (true) {` cria uma memória nova a cada chamada e acerta este teste.
- **O move de arquivo** (linhas 61 a 72): a asserção é que nenhum `path.relative` se repete. A mutação `if (false) return …` desliga a memória e acerta este teste. O mesmo caso confere o resultado do move (linhas 70 e 71).
- **Os casos de borda** (linhas 76 a 84): os quatro estão lá.
- **A memória por árvore** (linhas 86 a 96): pegaria uma memória global que guardasse só pelo caminho absoluto, porque `arvoreOutro` devolveria `'apps/api/src/i1.ts'` em vez de `undefined`.

As duas mutações cobrem as duas condições novas do diff, que são `lembrados === undefined` e `lembrados.has(absoluto)`. O `calcularRelativo` é o código antigo, só com outro nome. Cada uma das quatro linhas da seção "Teste que reproduz" tem o seu teste, citado pelo nome. Não há `.skip`, nem teste comentado, nem chamada a IA.

O mock de `node:path` não esconde a regra: ele só conta as chamadas e devolve o `relative` de verdade. Também não pega o caminho interno do TypeScript, que não passa pelo grafo de módulos do Vitest, então só conta o que a nossa ferramenta pede. A memória está certa porque a resposta só depende do `raiz` e do texto do caminho, e o `raiz` não muda (`tools/renomear/arvore.ts:43`, `readonly raiz`).

**Bloqueantes:** nenhum.

**Recomendações:**
- `tools/renomear/projetos.test.ts:53`: incluir `expect(projetos.length).toBeGreaterThan(0)`. Sem isso, se `abrirProjetos` passar a devolver uma lista vazia, o teste do programa sem mudança fica verde sem provar nada. Hoje quem garante que há projetos é só o vermelho da mutação no portão.
- `tools/renomear/projetos.test.ts:69-70`: o comentário fala dos "40 importadores", mas o teste só confere o `i7.ts`. Conferir todos com um laço sobre `IMPORTADORES` deixaria o teste do jeito que o comentário descreve.
- `tools/renomear/projetos.test.ts:68`: a asserção "nenhum `path.relative` repetido" vale para toda a ferramenta, não só para o `paraRelativo`. Se o `movimentos.ts` um dia chamar o `relative` duas vezes com os mesmos argumentos por um motivo legítimo, o teste fica vermelho sem regressão de verdade. Filtrar pelos pedidos que saem da raiz da árvore deixaria a intenção mais clara.
- O `Map` de cada árvore cresce sem limite. Para uma ferramenta que roda uma vez por onda, com uns 2.700 arquivos, isso não é problema. Fica só registrado.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/correcoes/2026-10-30-aplicar-lento-no-move.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/projetos.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/projetos.test.ts

## revisor-geral · 2ª rodada · APROVADO · 2026-10-30 10:14:50 · `tasks/correcoes/2026-10-30-aplicar-lento-no-move.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum
Recomendações: nenhuma nova. As da 1ª rodada foram aplicadas, e as duas recusadas estão registradas com motivo na tabela "Recomendações sem aplicar" do documento.

Nesta rodada só olhei o diff 9577c57c → 861b5fd1 e o que ele afeta:

- **`tools/renomear/projetos.test.ts`:**
  - O caso de custo agora exige `projetos.length > 0` (linha 55). Sem isso, se `abrirProjetos` não devolvesse nenhum projeto, o caso passaria sem medir nada.
  - O move agora confere os 40 importadores, e não só o `i7` (linha 73).
  - O caso "vale por árvore" guarda a contagem de `relative` depois dos dois primeiros cálculos e exige que ela não cresça ao repetir os dois (linhas 98–101). Isso cobre o que o título promete: a mesma árvore lembra o cálculo, inclusive a resposta `undefined`.
  - O comentário das linhas 11–13 avisa até onde o contador mede, e o aviso está certo.
- **`tools/renomear/projetos.ts:85-88`:** só muda o comentário. Tirou os números (2700, 85%), que logo ficariam velhos, e o comportamento não mudou. As duas mutações do documento continuam batendo com o código.

Arquivos: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/projetos.test.ts`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/projetos.ts`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/correcoes/2026-10-30-aplicar-lento-no-move.md`.

## test-engineer · 2ª rodada · APROVADO · 2026-10-30 10:14:55 · `tasks/correcoes/2026-10-30-aplicar-lento-no-move.md`

VEREDITO: APROVADO

Cenários exigidos (para uma correção de desempenho numa ferramenta interna; isolamento entre escolas e permissão não se aplicam, porque o código não toca dado de escola nem tem papel de usuário):
- Caminho feliz: o move de um arquivo calcula o caminho de cada arquivo uma única vez e continua correto, com os 40 importadores e o re-export acompanhando o arquivo.
- Programa sem mudança: 30 `getProgram()` por projeto não pedem nenhum `path.relative` novo.
- Borda: caminho dentro da raiz, a própria raiz, fora da raiz e caminho não absoluto.
- Borda: a memória vale por árvore, ou seja, a mesma árvore lembra e outra raiz não herda a resposta, inclusive quando a resposta lembrada é `undefined`.
- Repetição: chamar de novo, nas duas árvores, não recalcula nada.

Cobertos:
- Rodei `tools/renomear/projetos.test.ts`: 4 de 4 verdes.
- `projetos.test.ts:55`: o `expect(projetos.length).toBeGreaterThan(0)` novo fecha o caso em que a lista vazia deixaria o laço sem fazer nada e o teste passaria sem medir.
- `projetos.test.ts:73`: o teste agora confere todos os 40 importadores, e não só o `i7`. É asserção sobre o resultado do move.
- `projetos.test.ts:98-101`: o `antes` com o `toHaveLength(antes)` prova que a memória funciona nas duas árvores, inclusive para o `undefined` da árvore cujo caminho fica fora da raiz (o `lembrados.has` cobre isso, `projetos.ts:43`). O teste falha nas duas mutações do documento: com `if (false)`, a terceira e a quarta chamadas pedem `relative` de novo; com `if (true)`, cada chamada começa com um `Map` novo. Também falharia com uma memória única para todas as árvores, porque a árvore "outra" devolveria o caminho lembrado da primeira e o `toBeUndefined` da linha 97 ficaria vermelho.
- `projetos.test.ts:11-13`: o comentário agora diz o limite do contador (ele só intercepta o `relative` de `node:path`). Era recomendação da 1ª rodada.
- `projetos.ts:25-27`: só mudou o comentário, sem lógica nova, então não precisa de bloco de mutação novo. As duas mutações do documento continuam alcançando as linhas 39 e 43.
- A tabela "Recomendações sem aplicar" do documento registra as duas recomendações recusadas, com motivo. Os motivos são aceitáveis.
- Não há `.skip`, teste comentado nem chamada a provedor de IA. O `vi.mock` de `node:path` só conta as chamadas e devolve o resultado real, então não esconde a regra.

Bloqueantes: nenhum.

Recomendações: nenhuma nova.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/projetos.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/projetos.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/correcoes/2026-10-30-aplicar-lento-no-move.md
