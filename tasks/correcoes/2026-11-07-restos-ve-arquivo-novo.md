# Correção — O `restos` não vê o arquivo que a tarefa cria e ainda não adicionou ao git

**Origem:** retro da F2 (M1) e da F2b: `TODO.md`, item "(F2, retro, M1)" e "(F2b, retro)"; esteira da F2 (4 dos 7 vermelhos: 2.0, 9.0, 11.0, 13.0 e 16.0)
**Subagentes obrigatórios:** `revisor-geral`, `test-engineer`, `privacy-guardian`, `infra-guardian`
<!-- Quem dita os guardiões é o Orquestrador, no pedido. -->

## Sintoma

O arquivo que a tarefa cria não está no índice quando o portão roda. O `restos` (e o teste `restos na árvore`) só enxerga os
versionados, então o nome antigo do mapa da X8 que a tarefa deixa num arquivo novo só cai no portão seguinte ou na esteira.

## Fora desta correção

nada

## Causa

`tools/renomear/arvore.ts`, `listarVersionados`, chama só `git ls-files -z --cached`. `Arvore.carregar` não tem como pedir também o que
está na pasta e fora do índice. O `restos` carrega a árvore por ela e herda a lacuna.

## Teste que reproduz

`tools/renomear/restos.test.ts › restos: arquivo ainda não adicionado` (quatro casos: o resto num arquivo criado e não adicionado aparece; o ignorado pelo
`.gitignore` não conta; a pasta não adicionada que é outro repositório e o link para pasta não derrubam o comando; `Arvore.carregar` sem a opção segue só com
os versionados, que é o que o `aplicar` e o `reaplicar` usam). E, em `restos: a linha de comando`, o mesmo arquivo novo deixa o comando com código 1 e o
arquivo e a linha na saída.

## Correção

`Arvore.carregar(raiz, { incluirNaoVersionados: true })` soma `git ls-files --others --exclude-standard` à lista. Só o `restos` passa a opção;
o `aplicar` e o `reaplicar` (que gravam com `git mv`) seguem com os versionados. O `conferir` não passa por `Arvore.carregar`: o `lerDaArvore` dele já lista os não adicionados.

O que não é arquivo fica fora da carga: a pasta não adicionada que é outro repositório (`git ls-files --others` a lista como `pasta/`) e o link para pasta fariam o
`readFileSync` lançar `EISDIR` e o `restos` sair com código 2. `ehArquivo` (`statSync(...).isFile()`) os pula, como já pulava o arquivo apagado.

O `describe` `restos: a linha de comando` ganha `{ timeout: 60_000 }` (cada caso sobe o `restos.ts` num repositório de teste e passava dos 5 s do padrão com a
máquina carregada), e o par entra em `QUEM_SOBE_PROCESSO` de `tools/ci/unidade-sob-carga.test.ts`, que o guarda: é o que a correção
`2026-11-07-unidade-independente-da-carga` deixou para esta (`19dcb663`). Os guardiões `privacy-guardian` e `infra-guardian` entram na linha porque
a árvore passa a tocar `tools/ci/` e o caminho de `tools/renomear/`, como o `portao-local.ts revisores` lista.

## Mutações

--faltando: 0 linhas (4 blocos, 0 motivos)

Sem a soma do `--others`, o arquivo criado e não adicionado some da varredura:

```mutacao
arquivo: tools/renomear/arvore.ts
teste: tools/renomear/restos.test.ts › o nome antigo num arquivo criado e não adicionado deixa o comando vermelho
  if (opcoes.incluirNaoVersionados !== true) return versionados
- return [...new Set([...versionados, ...listar('--others', '--exclude-standard')])]
+ return versionados
```

Sem o `--exclude-standard`, o que o `.gitignore` exclui (`node_modules/`) entra na varredura:

```mutacao
arquivo: tools/renomear/arvore.ts
teste: tools/renomear/restos.test.ts › o arquivo que o .gitignore exclui não conta
falha: expect(sobras(repo)).toEqual([])
  if (opcoes.incluirNaoVersionados !== true) return versionados
- return [...new Set([...versionados, ...listar('--others', '--exclude-standard')])]
+ return [...new Set([...versionados, ...listar('--others')])]
```

Sem pular o que não é arquivo, a pasta não adicionada e o link para pasta derrubam a carga com `EISDIR`:

```mutacao
arquivo: tools/renomear/arvore.ts
teste: tools/renomear/restos.test.ts › a pasta não adicionada que é outro repositório, e o link para pasta, não derrubam o comando
      // link para pasta como o link): não é arquivo da árvore.
-      if (!ehArquivo(absoluto)) continue
```

Sem a opção, a carga padrão (a do `aplicar` e do `reaplicar`) passa a ler o que não foi adicionado:

```mutacao
arquivo: tools/renomear/arvore.ts
teste: tools/renomear/restos.test.ts › a carga padrão da árvore segue só com os versionados: o aplicar e o reaplicar não leem o que não foi adicionado
falha: .existe('apps/api/src/novo.ts')).toBe(false)
  const versionados = listar('--cached')
- if (opcoes.incluirNaoVersionados !== true) return versionados
  return [...new Set([...versionados, ...listar('--others', '--exclude-standard')])]
```

## Recomendações sem aplicar
| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisor-geral (1ª) | A frase da Tech Spec da X8 (`tasks/prd-nomes-de-mercado/techspec.md:208`) diz "rodado depois do `git add` (a `Arvore` lê o índice)", e agora o `restos` lê também o que não está no índice | `TODO.md`: a Tech Spec é de spec já pousada e esta correção não toca o arquivo; atualizar o parêntese na próxima mudança de `tasks/prd-nomes-de-mercado/` |
| infra-guardian (1ª) | `tools/renomear/aplicar.test.ts:470` também roda processo sem prazo próprio (a convenção ainda não é universal) | `TODO.md`: o arquivo não é desta correção; entra junto com a próxima que tocar `aplicar.test.ts` |
| revisor-geral (2ª), test-engineer (2ª) | O título do caso de `restos.test.ts:305` ainda diz "deixa o comando vermelho", mas o caso só confere `sobras`; trocar por "aparece", como o documento já descreve, e pôr o mesmo nome no bloco de mutação 1 (hoje ele casa os casos de `:305` e `:360` por substring: funciona, mas é ambíguo) | `TODO.md`: título de teste e de bloco de mutação, sem mudar comportamento |
| infra-guardian (2ª), test-engineer (2ª) | O título do caso de `restos.test.ts:320` diz "não derrubam o comando", mas o caso confere a função e não o processo; algo como "não derrubam a carga" | `TODO.md`, junto com o item acima |
| revisor-geral (2ª) | A primeira e a terceira mutação do documento não têm a linha `falha:`, e as outras duas têm | `TODO.md`: o campo é opcional e os dois blocos já ficam vermelhos por asserção |
| revisor-geral (2ª) | `ehArquivo` também muda o que `aplicar` e `reaplicar` fazem com um link versionado que aponta para uma pasta (antes a carga parava com `EISDIR`, agora o link fica fora da árvore e não acompanha um `git mv`); uma frase no documento | `TODO.md`: sem efeito nesta árvore, que não tem link versionado para pasta |
| privacy-guardian (2ª), test-engineer (2ª) | `arvore.ts:50`: `statSync` segue o link, e um link não adicionado para um arquivo fora do repositório passa a ser lido pelo `restos`; `lstatSync(...).isFile()` não o seguiria e resolve também o link para pasta. Nenhum caso pega a diferença | `TODO.md`: muda o que o `restos` lê (comportamento), e o efeito é local, com saída só do termo, como o privacy-guardian registra |
| test-engineer (2ª) | `restos.test.ts:324`: o link aponta para `apps`, que não tem nome antigo; o caso não prova que o conteúdo atrás do link não é lido | `TODO.md`, junto com o item do `lstatSync` |
| privacy-guardian (2ª) | O comentário de `restos.test.ts:376-377` deveria lembrar que o rascunho solto nunca deve ser um dump ou export real (regra 20, item 17) | `TODO.md`: só comentário |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-07 13:03:17 | 2026-11-07 13:03:41 | `privacy-guardian` | 1 | APROVADO | a90eb46839b685e63 |
| 2026-11-07 13:03:15 | 2026-11-07 13:04:26 | `revisor-geral` | 1 | REPROVADO | a9ddd760f2b8ecc23 |
| 2026-11-07 13:03:18 | 2026-11-07 13:04:53 | `infra-guardian` | 1 | APROVADO | ae0d005a0216938f0 |
| 2026-11-07 13:03:16 | 2026-11-07 13:05:08 | `test-engineer` | 1 | REPROVADO | a2896f712d1e83b19 |
| 2026-11-07 13:30:15 | 2026-11-07 13:30:43 | `revisor-geral` | 2 | APROVADO | a40b9430ad7619f79 |
| 2026-11-07 13:30:27 | 2026-11-07 13:30:43 | `privacy-guardian` | 2 | APROVADO | ab55d318e7cbddd03 |
| 2026-11-07 13:30:32 | 2026-11-07 13:30:53 | `infra-guardian` | 2 | APROVADO | a689684ca89f9f20e |
| 2026-11-07 13:30:22 | 2026-11-07 13:32:24 | `test-engineer` | 2 | APROVADO | addc9742cc20fbd5c |
