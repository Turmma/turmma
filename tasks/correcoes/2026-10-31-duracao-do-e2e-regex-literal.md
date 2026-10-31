# Correção — a régua de duração do e2e não tira da régua o caso em que só um comentário mudou, quando o spec tem expressão regular literal com aspa ou crase

**Origem:** divergência de portão da 9.0 de `nomes-de-mercado` (L2), depois da correção `2026-10-31-duracao-do-e2e-so-comentario`, que não bastou para `e2e/tokens.spec.ts`.
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`
<!-- Os dois primeiros vieram no PEDIDO do Orquestrador (`revisor-geral` também porque a correção toca `tools/ci/`). Os outros quatro entraram pela DEVOLUÇÃO da Mesa, que conferiu a linha contra os arquivos: `tools/guardas/catraca.test.ts` e `eslint-suppressions.json` pedem os quatro (`tools/processo/guardioes-por-caminho.ts`). -->

## Sintoma

O portão da 9.0 reprova a duração de `e2e/tokens.spec.ts:215` (celular, acima de 15,0 s) mesmo com a correção `duracao-do-e2e-so-comentario` no HEAD. A onda só troca um comentário dentro do caso (linha 221: `Campo` → `FormField`), e a régua ainda o conta como alterado.

## Fora desta correção

Nada. A árvore está limpa (L3, sem a 9.0 em curso).

## Causa

A exceção da correção anterior compara o trecho do caso **sem comentário** (`casosDoSpec`, que chama `semComentarios`) com o do HEAD. Mas `semComentarios` é um leitor feito à mão que não entende expressão regular literal: lê a aspa e a crase de dentro dela como abertura de texto. O spec tem duas: a linha 61 (`/```css\n([\s\S]*?)```/g`, seis crases) e a 80 (`/["']?escuro["']?\s*/`, duas aspas simples soltas). Depois delas o leitor fica com a paridade das aspas trocada, e o comentário da linha 221 cai "dentro de um texto" e fica no trecho. A troca dele muda o trecho, o caso deixa de ser igual ao do HEAD e volta à régua.

O módulo já documentava o limite no topo (`e2e/operacao-convite.spec.ts:152`, `/^otpauth:\/\/totp\//`) e o `TODO.md` o listava: "trocá-lo pelo `ts.createScanner` acabaria com o limite". Aqui ele deixou de ser sem dano.

## Teste que reproduz

Os dois em `tools/ci/duracao-do-e2e.test.ts` (vermelhos antes da correção, verdes depois):
- `semComentarios entende a expressão regular literal: a aspa, a crase e o \/ dentro dela não abrem texto nem comentário` (unidade: crase, aspa opcional, `\/` antes do fecho e uma divisão que não é regex);
- `expressão regular literal com aspa e crase no mesmo spec não desalinha o leitor: só o comentário do caso lento muda e a régua passa` (no repositório temporário: as linhas 61 e 80 de `tokens.spec.ts` no lugar de duas linhas do primeiro caso, a asserção de que o spec commitado as contém, a nota trocada, e a régua passa).

Da rodada 1 do `test-engineer` (o do JSDoc só prende que a troca de leitor não o estragou, e fica verde também com o leitor antigo; o do erro de sintaxe é vermelho com ele): `semComentarios: o comentário JSDoc antes de uma declaração sai como os outros…` e `semComentarios: spec com erro de sintaxe ainda tira os comentários; o que fica dentro de um texto sem fecho continua como está…`. O ajudante `trocarOuFalhar` faz `repositorioComNotaNoSegundo` e `trocarANota` lançarem erro quando uma troca não casa. O docblock de `semComentarios` fala em "texto que o parser deixa fora da árvore"; o que se achou em prática é o comentário dentro de um texto sem fecho (`'abc // c`), que o teste prende; não se achou entrada que deixe um comentário solto fora da árvore.

## Correção

`semComentarios` passa a achar os comentários pelo parser do TypeScript, como `impressaoSemComentarios` (`tools/processo/caducidade.ts`) já faz: só a árvore sabe se uma `/` abre regex ou divide. O texto entre dois tokens é só espaço e comentário (`comentariosDaTrivia`), e as faixas de comentário são cortadas do texto original, de modo que o que o parser deixa fora da árvore num erro de sintaxe fica como está. O `typescript` é carregado na primeira chamada (`createRequire`), porque o `playwright.config.ts` importa este módulo e não precisa dele. A saída é a mesma de antes para o que o leitor à mão acertava (os testes antigos de `semComentarios` seguem verdes, sem mudança). O módulo leva os 674 casos de `e2e/` em 0,8 s.

O `typescript` é resolvido a partir do diretório de trabalho (`createRequire(join(process.cwd(), 'package.json'))`), e não de `import.meta.url`: o Playwright lê este arquivo como CommonJS ao carregar o `playwright.config.ts`, e `import.meta` ali é erro de sintaxe (o portão pegou: `tools/processo/mutacoes.test.ts › playwright, com a configuração que lê a mesma variável`, que carrega a configuração de verdade).

Efeitos pequenos: o comentário do topo e o do `prazosDosCasos` deixam de listar o limite; a supressão de `complexity` de `tools/ci/duracao-do-e2e.ts` em `eslint-suppressions.json` baixa de 3 para 2 (o leitor à mão era uma delas, e o ESLint recusa supressão que não ocorre mais), e o `TETO` de `complexity` em `tools/guardas/catraca.test.ts` baixa de 242 para 241, como a catraca manda; o item (2) do `TODO.md` sobre o limite do `semComentarios` fica como feito.

## Mutações

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › semComentarios entende a expressão regular literal
-    comentarios.push(...comentariosDaTrivia(texto, no.pos, no.getStart(fonte)))
+    comentarios.push(...comentariosDaTrivia(texto, no.pos, no.end))
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › semComentarios entende a expressão regular literal
-      const fim = quebra === -1 ? ate : quebra
+      const fim = ate
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › semComentarios tira o de linha e o de bloco
-      const fim = fechamento === -1 ? ate : fechamento + 2
+      const fim = ate
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › expressão regular literal com aspa e crase no mesmo spec
-    desde = fim
+    desde = inicio
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › semComentarios entende a expressão regular literal
-    if (filhos.length > 0) {
+    if (false) {
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › semComentarios tira o de linha e o de bloco
-    if (texto.startsWith('//', i)) {
+    if (false) {
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › semComentarios tira o de linha e o de bloco
-    } else if (texto.startsWith('/*', i)) {
+    } else if (false) {
```

## Recomendações sem aplicar

Das ordens `.processo/ordens/2026-10-31-duracao-do-e2e-regex-literal-r1.md` e `-r2.md`.

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisor-geral (1ª) | `duracao-do-e2e.ts:240`: tratar o `typescript` que não carrega como "caso alterado" (`try`/`null`, como `caducidade.ts:96-103`), em vez de lançar fora da raiz | `TODO.md`, no registro do item 6: muda comportamento e código de `.ts`, e caducaria os cinco aprovados. Hoje o portão e a esteira rodam na raiz |
| infra-guardian (1ª) | `carregarTypescript`: embrulhar a chamada para o erro dizer de onde o pacote deve ser resolvido | `TODO.md`, no registro do item 6: o mesmo motivo |
| revisor-geral (1ª) | `duracao-do-e2e.ts:243`: declarar o `let typescript` antes da função, como `caducidade.ts` | Recusada: ordem de declaração sem efeito (a função só roda depois que o módulo carrega), em código de `.ts` que caducaria os cinco aprovados |
| infra-guardian (1ª) | `TODO.md:1041`: o item (1) (`INICIO_DE_CASO` casa com o `.test('literal')` de um `RegExp`) segue aberto; pode virar correção própria | Já está no `TODO.md` como item (1) da mesma linha; fora do escopo desta correção |
| test-engineer (2ª) | `duracao-do-e2e.test.ts:525`: no teste do repositório a crase não pesa para o leitor antigo (as seis ficam em pares, dentro do texto que a aspa da linha de cima deixou aberto); o vermelho vem só da aspa. Para a crase contar sozinha, vir na linha de cima ou ter caso próprio com número ímpar de crases | `TODO.md`, na entrada (2) da linha do `duracao-do-e2e.ts`: a regex com crase já é provada no teste de unidade (`semComentarios entende a expressão regular literal`) e a mutação do bloco de unidade; o teste do repositório é o que reproduz o sintoma de `tokens.spec.ts` |
| test-engineer (2ª) | `tasks/correcoes/2026-10-31-duracao-do-e2e-regex-literal.md:17`: a "Causa" diz que a regex com seis crases também troca a paridade das aspas; com seis crases a conta fecha, e quem desalinha o leitor é só a linha 80 | Retro da X8: o texto da "Causa" fica como está no commit; a retro lê `achados/` e registra a correção |
| test-engineer (2ª) | `duracao-do-e2e.test.ts:527`: `commitado` lê a árvore, não o commit; `git show HEAD:e2e/material.spec.ts` prenderia o que o nome promete | Recusada: a leitura vem logo depois do `git commit`, e os dois são iguais; nome sem efeito |
| revisor-geral (2ª) | `duracao-do-e2e.test.ts:494`: `trocarOuFalhar` passa `para` como texto ao `replace`, que entende `$&` e `$1`; usar `texto.replace(de, () => para)` | `TODO.md`, na mesma linha da primeira: nenhuma troca de hoje tem `$` |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-10-31 14:46:00 | 2026-10-31 14:46:14 | `tenancy-guardian` | 1 | APROVADO | ab986edfb0572e962 |
| 2026-10-31 14:46:02 | 2026-10-31 14:46:21 | `privacy-guardian` | 1 | APROVADO | a8fcb437f29717667 |
| 2026-10-31 14:46:04 | 2026-10-31 14:46:25 | `infra-guardian` | 1 | APROVADO | a7ef99c90b7492464 |
| 2026-10-31 14:46:03 | 2026-10-31 14:46:29 | `conformidade-reviewer` | 1 | APROVADO | a9a2f506eb822e079 |
| 2026-10-31 14:45:59 | 2026-10-31 14:46:59 | `revisor-geral` | 1 | APROVADO | a773b77d3675e5f79 |
| 2026-10-31 14:45:57 | 2026-10-31 14:47:30 | `test-engineer` | 1 | REPROVADO | a5641b17f2b8be2df |
| 2026-10-31 14:54:29 | 2026-10-31 14:54:56 | `revisor-geral` | 2 | APROVADO | a9b9c79f87f371aef |
| 2026-10-31 14:54:24 | 2026-10-31 14:55:44 | `test-engineer` | 2 | APROVADO | ad89419f705386329 |
