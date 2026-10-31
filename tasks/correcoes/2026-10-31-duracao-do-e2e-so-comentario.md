# Correção — a régua de duração do e2e conta como alterado o caso em que só um comentário mudou

**Origem:** divergência de portão da 9.0 de `nomes-de-mercado` (triagem do Arquiteto, 31/10, seção "O caminho", item 1), com a regra na Tech Spec §13 (`e3cc1519`, `spec/nomes-de-mercado`).
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`, `privacy-guardian`, `infra-guardian`
<!-- Os dois primeiros vieram no PEDIDO do Orquestrador (`revisor-geral` também porque a correção toca `tools/ci/`). `infra-guardian` e `privacy-guardian` entraram pela DEVOLUÇÃO da Mesa, que conferiu a linha contra os arquivos: `tools/ci/` pede o primeiro, e a regra 20 citada em `duracao-do-e2e.ts` soma o segundo. -->

## Sintoma

O portão da 9.0 reprovou a duração de `e2e/tokens.spec.ts:215` (celular, 16,3 s, limite 15,0 s). A onda só troca um comentário dentro do caso (`` `Campo` `` → `` `FormField` ``, linha 221): o `restos` cobra o nome entre crases em comentário, e desfazer a troca o deixa vermelho. O caso não cresceu, mas o diff tocou uma linha dele e a régua o contou como alterado.

## Fora desta correção

Nada. A árvore está limpa (L3, sem a 9.0 em curso).

## Causa

`casosAlterados` (`tools/ci/duracao-do-e2e.ts`) decide "alterado" só pelas **linhas** que o `git diff -U0` tocou, e comentário é linha. `motivoDaDuracaoDoE2e` não olha se o corpo do caso, sem comentário, mudou: a troca de um comentário reprova o caso lento que ela não fez crescer. A mesma leitura (`casosDoSpec`, que tira os comentários) já decide, para o prazo herdado, que "só mudar um comentário do corpo conta como corpo idêntico".

## Teste que reproduz

Todos em `tools/ci/duracao-do-e2e.test.ts`, no bloco "no repositório: o diff do git decide qual caso é alterado":
- `só o comentário do caso lento muda: o caso não conta como alterado e a régua passa` (vermelho antes da correção: o portão reprovava o caso com 19,0 s; verde depois);
- `o comentário e uma linha de código do caso lento mudam: reprova`;
- `o comentário muda e o título também: o título novo não acha par no HEAD e reprova`;
- `o caso de primeiro nível, fora de qualquer describe, também sai da régua quando só o comentário muda` (a igualdade exata do título; a rodada 1 do `test-engineer` a pediu);
- `um gancho entre o caso lento e o seguinte muda: …` (o `test.beforeEach` depois do caso toca uma linha do trecho dele, que o `corpo` corta; por isso a comparação é do `trecho`);
- `título de modelo (${}): …`: guarda `daArvore === undefined`. O `casosDoSpec` pula o título de modelo, a árvore não tem par, e sem a guarda `daArvore.titulo` lança erro e o teste cai por exceção; não leva bloco de mutação próprio;
- `dois specs com o mesmo título: o comentário de um não tira da régua o caso do outro, que mudou código`: a guarda "no mesmo arquivo" (`casos.filter((outro) => outro.arquivo === arquivo)`). Sem ela, o `segundo` do `outro.spec.ts` (só comentário) acha `trecho` igual e põe na lista o `segundo` do `material.spec.ts` (código mudado), que sai da régua;
- `título repetido só na árvore: …` e `título repetido só no HEAD: …`: cada um, a sua guarda (`outrosDaArvore`, `outrosDoHead`). O comentário sozinho não tira o caso da régua.

## Correção

Em `motivoDaDuracaoDoE2e`, depois de `casosAlterados`, sai da lista o caso cujo trecho sem comentário (`casosDoSpec`, do arquivo na árvore e de `git show HEAD:<arquivo>`; o trecho vai do título ao próximo `test(`, o mesmo que `casosAlterados` atribui ao caso, com o gancho que vier depois dele) é igual ao do HEAD, no mesmo arquivo e com o mesmo título. Cobra mais, nunca menos: arquivo novo (sem `HEAD:<arquivo>`), título que o HEAD não tem, título de modelo (`${}`, que `casosDoSpec` pula) e título repetido no mesmo arquivo (na árvore ou no HEAD, cada lado com a sua guarda e o seu teste) continuam alterados. O comentário do topo do arquivo ganha a frase da exceção.

## Mutações

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › só o comentário do caso lento muda: o caso não conta como alterado e a régua passa
   const soComentario = casosSoComComentarioAlterado(raiz, tocados)
-  const alterados = tocados.filter((caso) => !soComentario.has(caso))
+  const alterados = tocados
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › o comentário e uma linha de código do caso lento mudam: reprova
-      if (doHead.trecho === daArvore.trecho) iguais.add(medido)
+      iguais.add(medido)
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › um gancho entre o caso lento e o seguinte muda: o trecho do caso mudou, e a régua o mede, com ou sem a troca da nota
-      if (doHead.trecho === daArvore.trecho) iguais.add(medido)
+      if (doHead.corpo === daArvore.corpo) iguais.add(medido)
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › só o comentário do caso lento muda: o caso não conta como alterado e a régua passa
-      const [daArvore, ...outrosDaArvore] = textos.arvore.filter((c) => medido.titulo === c.titulo || medido.titulo.endsWith(` › ${c.titulo}`))
+      const [daArvore, ...outrosDaArvore] = textos.arvore.filter((c) => medido.titulo === c.titulo)
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › o caso de primeiro nível, fora de qualquer describe, também sai da régua quando só o comentário muda
-      const [daArvore, ...outrosDaArvore] = textos.arvore.filter((c) => medido.titulo === c.titulo || medido.titulo.endsWith(` › ${c.titulo}`))
+      const [daArvore, ...outrosDaArvore] = textos.arvore.filter((c) => medido.titulo.endsWith(` › ${c.titulo}`))
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › dois specs com o mesmo título: o comentário de um não tira da régua o caso do outro, que mudou código
-    for (const medido of casos.filter((outro) => outro.arquivo === arquivo)) {
+    for (const medido of casos) {
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › título repetido só na árvore: não dá para dizer qual é o par do HEAD, e o comentário sozinho não tira o caso da régua
-      if (daArvore === undefined || outrosDaArvore.length > 0) continue
+      if (daArvore === undefined) continue
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › título repetido só no HEAD: idem, o caso fica na régua
-      if (doHead === undefined || outrosDoHead.length > 0) continue
+      if (doHead === undefined) continue
```

```mutacao
arquivo: tools/ci/duracao-do-e2e.ts
teste: tools/ci/duracao-do-e2e.test.ts › o comentário muda e o título também: o título novo não acha par no HEAD e reprova
-      const [doHead, ...outrosDoHead] = textos.head.filter((c) => c.titulo === daArvore.titulo)
+      const [doHead, ...outrosDoHead] = textos.head.filter((c) => c.titulo.startsWith('segundo'))
```

## Recomendações sem aplicar

Da ordem `.processo/ordens/2026-10-31-duracao-do-e2e-so-comentario-r1.md`.

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| infra-guardian (1ª) | "quando o `git show` falha, o `catch` esconde o motivo. [...] uma linha no stderr ajudaria a entender um portão reprovado sem motivo aparente." | Recusada: o caso continua na régua e a reprovação já aponta arquivo, linha, projeto e duração; escrever no stderr muda a saída do portão (comportamento), e o privacy-guardian registrou o `stdio` que descarta o stderr como o desenho certo. |
| revisor-geral (1ª) | "Regra 40 sem a exceção nova" (`.claude/rules/40-testes.md:124-126`): acrescentar a frase da exceção do comentário | Retro de `nomes-de-mercado`: o arquivo é regra, não é um que a correção toque; a exceção está no topo do módulo e na Tech Spec §13. |
| test-engineer (1ª) | "O nome `casosSoComComentarioAlterado` promete mais do que a função confere enquanto o bloqueante 1 não for corrigido" | Resolvida pelo item 1: com o trecho inteiro comparado, o nome diz o que a função confere. Sem renomear. |
| test-engineer (3ª) | No teste "dois specs com o mesmo título", `doOutro.replace('// nota antiga', ...)` repete à mão o que o `trocarANota` faz; fazer o `trocarANota` aceitar o caminho do spec deixaria o texto da nota num lugar só | Retro de `nomes-de-mercado`: organização de teste, sem efeito no que ele prova; as recomendações entram em ordem uma vez por documento e esta nasceu depois da primeira ordem. |
| revisor-geral (3ª) | O comentário de `CasoDoSpec` (`tools/ci/duracao-do-e2e.ts:259`) ainda descreve só o `corpo` ("o corpo sem o título"); citar também o `trecho`, que é o que a exceção compara | Retro de `nomes-de-mercado`, ou a próxima tarefa que tocar `casosDoSpec`: o JSDoc do campo `trecho` já diz o que ele é; a linha do tipo é só o resumo. Mesma regra de uma ordem por documento. |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-10-31 11:35:01 | 2026-10-31 11:35:16 | `infra-guardian` | 1 | APROVADO | a398709853dff0b77 |
| 2026-10-31 11:35:00 | 2026-10-31 11:35:17 | `privacy-guardian` | 1 | APROVADO | af1a1919a5e257ab8 |
| 2026-10-31 11:35:00 | 2026-10-31 11:36:07 | `revisor-geral` | 1 | APROVADO | ae3093b1000d83fb7 |
| 2026-10-31 11:34:58 | 2026-10-31 11:36:56 | `test-engineer` | 1 | REPROVADO | a234e5b04d1c88549 |
| 2026-10-31 11:43:54 | 2026-10-31 11:44:08 | `privacy-guardian` | 2 | APROVADO | a2c3ba1c589968b3d |
| 2026-10-31 11:43:59 | 2026-10-31 11:44:14 | `infra-guardian` | 2 | APROVADO | ac571a9a2f9d84a0d |
| 2026-10-31 11:43:50 | 2026-10-31 11:44:52 | `revisor-geral` | 2 | REPROVADO | aa94f02441c0c8f66 |
| 2026-10-31 11:43:44 | 2026-10-31 11:44:56 | `test-engineer` | 2 | REPROVADO | adaaddfef5d587b28 |
| 2026-10-31 11:54:37 | 2026-10-31 11:55:09 | `test-engineer` | 3 | APROVADO | af56c0bea8bf6eb73 |
| 2026-10-31 11:54:43 | 2026-10-31 11:55:09 | `revisor-geral` | 3 | APROVADO | a3d8e2d8584158506 |
