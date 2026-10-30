# Correção — o `aplicar` do mapa 3 sai 0 deixando 40 dos 458 símbolos sem renomear e troca `.js` por `.ts` em 59 imports relativos

**Origem:** tarefa 3.0 (X8 `nomes-de-mercado`), `.processo/aplicar-3.log`, `conferir-3.log`, `restos-3.log` (PEDIDO do Orquestrador).
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`
<!-- Os guardiões vieram no PEDIDO do Orquestrador: nenhum além de test-engineer e revisor-geral. -->

## Sintoma

`node tools/renomear/aplicar.ts` com o mapa 3 (sha1 `c46112f0`) sai 0 ("Onda 3 aplicada: 617 arquivos tocados"), mas:

1. 40 dos 458 símbolos ficam como estavam (`esquemaRespostaArtefato`, `RespostaDecisao`, `esquemaUsoDaEscolaDoPainel`…): o `restos-3.log`
   os lista, e em `painel.ts` o `type UsoDoPainelResponse` foi renomeado e a `const esquemaRespostaUsoDoPainel` que ele cita, não;
2. 59 imports relativos trocam a extensão `.js` por `.ts` (`from './codigo-de-erro.js'` → `from './error-code.ts'`).

A árvore do aplicar foi guardada em `.processo/aplicar-3-defeituoso.diff` e `.processo/aplicar-3-defeituoso.status` e desfeita com
`git reset --hard HEAD`; o mapa e `.processo/` não são versionados.

## Fora desta correção

`?? tools/renomear/mapas/` (o `3.json` e o `3.relatorio.md` da tarefa 3.0). Ficam na árvore, fora da revisão e do commit.

## Causa

Falhas da tarefa 1.0 (`aplicar.ts` e `movimentos.ts`), vistas só quando o mapa 3 trouxe vários símbolos por arquivo e imports `.js`.

**1. Símbolos perdidos (`aplicar.ts`).** `existencias` achava as declarações de todas as entradas **antes** de qualquer rename, e
`aplicarSimbolosEMovimentos` as passava adiante. A posição (`inicio`) da declaração é um deslocamento no texto original. Quando
um rename anterior no mesmo arquivo muda o tamanho do texto antes dela (`esquemaX` → `xSchema` encurta ou alonga), o deslocamento
guardado cai em outro lugar: o `findRenameLocations` não acha o símbolo, o filtro de `aplicarNosArquivos` (o texto na posição tem
de ser o `de`) descarta o que sobra, e a entrada passa sem recusa e sem troca. Medido: com cada declaração achada na hora, os
458 renames em memória terminam completos (só `ErroDeInvariante` e `NAMESPACE_REALTIME_SISTEMA` "falham" na minha conferência, por
terem o nome também numa string que fica, `this.name = 'ErroDeInvariante'`, o que a classificação do mapa cobre).

**2. `.js` → `.ts` (`movimentos.ts`).** `getEditsForFileRename` devolve o especificador novo com a extensão do arquivo (`.ts`),
porque o passo 3 o chama com as preferências vazias (`{}`), sem `importModuleSpecifierEnding`. O repositório importa `.js` (módulo
`nodenext`), e o `aplicar` aceitava o `newText` do serviço sem conferir a extensão.

## Teste que reproduz

`tools/renomear/aplicar.test.ts`:

- `o rename de símbolo (passos 1 e 2) › dois símbolos no mesmo arquivo: o segundo é renomeado mesmo depois de o primeiro mudar o tamanho do texto antes dele`
  (vermelho antes: `esquemaSeguinte` fica; verde depois);
- `o move de arquivo e de pasta (passo 3) › move de pasta: o import que termina em .js continua em .js e o que termina em .ts continua em .ts`
  (move de pasta; vermelho antes: `./y/a.ts`; verde depois);
- `o move de arquivo e de pasta (passo 3) › move de arquivo com import .js: o relativo muda de pasta e conserva o .js` (vermelho antes, verde depois).

Cobertura que a rodada 1 pediu e que passa sem mudar o código (não são vermelhos de antes):

- `o rename de símbolo (passos 1 e 2) › dois símbolos no mesmo arquivo: o segundo é renomeado também quando o primeiro encurta o texto antes dele`
  (o sentido contrário do primeiro caso; com o `aplicar.ts` da mutação 1, os dois ficam vermelhos);
- `o move de arquivo e de pasta (passo 3) › move com .js: o export *, o import() dinâmico e o vi.mock também conservam o .js`.

## Correção

- `aplicar.ts`: `existencias` só confere a existência e devolve as recusas; `aplicarSimbolosEMovimentos` acha as declarações de cada
  entrada **na hora do rename**, na árvore como o anterior a deixou.
- `movimentos.ts`: `conservarExtensao` devolve o especificador do serviço com `.js` quando o import antigo terminava em `.js` e o
  serviço escreveu `.ts`; o import que terminava em `.ts` fica `.ts`. Só o par `.ts`/`.js`, que é o que o repositório usa (2795
  imports `.js`, nenhum em `apps/web`; os 9 `.mjs` apontam para arquivos `.mjs`). O `.tsx` importado como `./C.js` (`jsx: react-jsx`) e o
  import sem extensão não são tratados: nenhuma onda move arquivo do `apps/web` ainda, e a primeira que mover precisa de caso para isso
  (o destino é o `TODO.md`, na tabela abaixo). A ordem da rodada 1 pediu para escolher entre reduzir o mapa e corrigi-lo: ficou reduzido, e o desvio do `tsconfig` saiu
  (o texto do `include` e do `files` termina em `.ts` e nunca em `.js`, então a função já o devolvia como veio).
- **Por que o `aplicar` conserta o resultado e não passa a preferência ao serviço (D81).** O serviço aceita
  `importModuleSpecifierEnding`, mas a preferência vale para o projeto inteiro, e o repositório mistura imports `.js` e `.ts`
  (o caso `move de pasta: o import que termina em .js continua em .js e o que termina em .ts continua em .ts` prova os dois): `js`
  trocaria os `.ts` por `.js`, e `ts` volta ao defeito. Conservar a extensão que o import tinha é a única regra que serve aos dois.

## Mutações

```mutacao
arquivo: tools/renomear/aplicar.ts
teste: tools/renomear/aplicar.test.ts › dois símbolos no mesmo arquivo: o segundo é renomeado mesmo depois de o primeiro mudar o tamanho do texto antes dele
-    recusas.push(...renomearSimbolo(arvore, projetos, entrada, acharDeclaracoes(arvore, entrada)))
+    recusas.push(...renomearSimbolo(arvore, projetos, entrada, acharDeclaracoes(Arvore.carregar(arvore.raiz), entrada)))
```

```mutacao
arquivo: tools/renomear/movimentos.ts
teste: tools/renomear/aplicar.test.ts › move de arquivo com import .js: o relativo muda de pasta e conserva o .js
-  return antigo.endsWith('.js') && novo.endsWith('.ts') ? `${novo.slice(0, -'.ts'.length)}.js` : novo
+  return novo
```

```mutacao
arquivo: tools/renomear/movimentos.ts
teste: tools/renomear/aplicar.test.ts › move de pasta: o import que termina em .js continua em .js e o que termina em .ts continua em .ts
-  return antigo.endsWith('.js') && novo.endsWith('.ts') ? `${novo.slice(0, -'.ts'.length)}.js` : novo
+  return novo.endsWith('.ts') ? `${novo.slice(0, -'.ts'.length)}.js` : novo
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisor-geral (1ª) | `aplicar.ts` (chamada de `renomearSimbolo` em `aplicarSimbolosEMovimentos`): recusa explícita quando `acharDeclaracoes` não acha nada na hora do rename ("declaração de `de` sumiu depois dos renames anteriores") | Não aplicar: muda o comportamento do `aplicar` (nova recusa) numa ferramenta que a tarefa 3.0 está rodando; a conferência inicial (`existencias`) já cobre o caso hoje. Destino: `TODO.md` |
| revisor-geral (1ª) | `conservarExtensao` não trata o import sem extensão (1988 em `apps/web/src`); falta teste de move com `from './x'` | Não aplicar: o mapa 3 não move nada em `apps/web` e o teste só vale quando uma onda mover arquivo do web. Destino: `TODO.md`, para a primeira onda que mover arquivo de `apps/web` |
| test-engineer (1ª) | A linha 38 de `movimentos.ts` aparece no `--faltando` só porque o valor gravado mudou | Nada a fazer: a condição já existia, o próprio revisor diz que não pede bloco |
| revisor-geral (2ª) | As duas linhas "Destino: `TODO.md`" da tabela acima (recusa explícita quando `acharDeclaracoes` não acha nada; teste de move com import sem extensão em `apps/web`) ainda não estão no `TODO.md` | Escritas no `TODO.md`, na seção "Da correção 2026-10-30-aplicar-perde-simbolos-e-troca-js-por-ts, fora dela", no commit desta correção |
| revisor-geral (2ª) | `movimentos.ts` (`conservarExtensao`): `-'.ts'.length` lê melhor como `-3` ou constante `EXTENSAO_TS` | Não aplicar: detalhe de leitura, o próprio revisor diz que não bloqueia; mudar o código agora caducaria as duas aprovações |
| test-engineer (2ª) | A condição `novo.endsWith('.ts')` em `conservarExtensao` não tem bloco que a derrube sozinha; vale um caso com `.tsx` importado como `.js` | Não aplicar: nenhum `.js` em `apps/web` hoje. Destino: o mesmo item do `TODO.md` do import sem extensão, para a primeira onda que mover arquivo de `apps/web` |
| test-engineer (2ª) | Não há caso de move que passe por um `tsconfig` com `include` ou `files` | Não aplicar: `git grep` mostra que nenhum `tsconfig*.json` do repositório tem entrada terminando em `.js`. Destino: mesmo item do `TODO.md` |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
| 2026-10-30 12:20:16 | 2026-10-30 12:21:25 | `revisor-geral` | 1 | APROVADO | a777cf60bc491e511 |
| 2026-10-30 12:20:15 | 2026-10-30 12:21:38 | `test-engineer` | 1 | REPROVADO | aa41ec5b9c9ae31b0 |
| 2026-10-30 12:28:38 | 2026-10-30 12:29:00 | `revisor-geral` | 2 | APROVADO | a74594c230fac8481 |
| 2026-10-30 12:28:29 | 2026-10-30 12:29:26 | `test-engineer` | 2 | APROVADO | a80519bc04cfd5801 |
