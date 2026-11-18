# Tarefa 8.0 — O painel do material mostra a classificação por capítulo, corrige com o seletor e pede a reclassificação

**Funcionalidade:** classificacao-bncc · **Depende de:** 7.0
**Subagentes obrigatórios:** `frontend-reviewer`, `conformidade-reviewer`
**Porte:** grande

## Objetivo

No painel do material, a coordenação vê cada capítulo (ou "Páginas X a Y") com a situação em texto e as habilidades com a
descrição e a origem; corrige escolhendo de 0 a 5 num seletor com filtro; e pede a reclassificação, com a confirmação do
que é refeito. A 11.0 reaproveita o seletor.

## Contexto necessário

- `techspec.md` §4, §9 (painel do material)
- `prd.md` RF6, RF12
- `cenarios.md` "Telas" (painel, seletor, "sem componente")
- `docs/interface.md` §3, "O painel do material"; §6 (em toda tela); §10 (peças)
- `.claude/rules/`: 50, 70
- Código: `apps/web/src/areas/coordenacao/material/PainelDoMaterial.tsx` (`Capitulos`, `CorrecaoDoMaterial`),
  `material-painel.ts` (`textoDoLimiteDeAlteracoes`), `api/material.ts` (429 e `Retry-After`);
  `apps/web/src/components/ui/fields/SearchInput.tsx` (não há combobox com filtro: o seletor é peça nova)

## Subtarefas

- [x] 8.1 — A seção de habilidades no painel: os cinco rótulos, a marca de corrigida, a origem, o código sempre com a descrição, "capítulo" e nunca "trecho" nem "seção"; os dois avisos
- [x] 8.2 — O seletor de habilidades em `apps/web/src/components/habilidades/`
- [x] 8.3 — Corrigir e reclassificar, com os textos do `cenarios.md`
- [x] 8.4 — A Parte A do painel no `docs/interface.md`
- [x] 8.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx`, `apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx`, `apps/web/src/areas/coordenacao/material/classificacao.ts`, `apps/web/src/areas/coordenacao/material/classificacao.test.ts`, `apps/web/src/components/habilidades/SeletorDeHabilidades.tsx`, `apps/web/src/components/habilidades/SeletorDeHabilidades.test.tsx`, `e2e/material-classificacao.spec.ts` | novo |
| `apps/web/src/areas/coordenacao/material/PainelDoMaterial.tsx`, `apps/web/src/areas/coordenacao/material/api/material.ts`, `e2e/support/material.ts`, `docs/interface.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| painel: carregando; erro com "Tentar de novo"; vazio só com a leitura terminada; com dado | U | um caso cada | `ClassificacaoDoMaterial.test.tsx` › "carregando…", "erro: diz o que aconteceu…", "vazio: só com a leitura terminada…", "com dado: uma linha por capítulo…" |
| os cinco rótulos | U | um caso por estado; `classificada` só com as habilidades | `ClassificacaoDoMaterial.test.tsx` › "os cinco rótulos, em texto, um por situação…"; "o capítulo que a coordenação deixou sem habilidade…" |
| `nao_classificada` com a função suspensa | U | só o aviso, sem "Reclassificar" | `ClassificacaoDoMaterial.test.tsx` › "função suspensa: o aviso diz que valem só as corrigidas…" |
| origem; código; nome da seção | U | "Sugerida pela IA" e "Corrigida pela coordenação"; com a descrição; "Capítulo N" ou "Páginas X a Y" | `ClassificacaoDoMaterial.test.tsx` › "o nome é \"Capítulo N · título\"…"; `classificacao.test.ts` › "a IA se declara como tal" |
| seletor: de 0 a 5 | U | o sexto bloqueado | `SeletorDeHabilidades.test.tsx` › "de 0 a 5: com cinco escolhidas, a sexta caixa fica bloqueada…" |
| seletor: filtro por código; por texto | U | um caso cada | `SeletorDeHabilidades.test.tsx` › "acha pelo código…"; "acha pelo texto, sem acento…" |
| seletor: carregando; erro; sem resultado; sem componente; com dado | U | um caso cada, com os textos do `cenarios.md` | `SeletorDeHabilidades.test.tsx` › "carregando…"; "erro: diz que não leu…"; "a lista de candidatas vazia…"; "sem componente…"; "cada linha traz o código…" |
| reclassificar | U | desabilitado durante o pedido; confirmação com N e M | `ClassificacaoDoMaterial.test.tsx` › "mostra quantos capítulos refaz…"; "\"Confirmar\" manda o pedido uma vez, fica desligado…" |
| avisos do componente e da suspensão | U | um caso cada; sem componente, "Corrigir" desabilitado | `ClassificacaoDoMaterial.test.tsx` › "sem componente: o aviso nomeia a disciplina…"; "função suspensa: o aviso diz…" |
| a chave da leitura das candidatas | U | leva o id do material: dois materiais não dividem a lista | `api/material.test.ts` › "a chave leva o id do material: dois materiais não dividem a lista de candidatas" |
| `CONFLITO` do `PUT`; 429 | U | os textos | `ClassificacaoDoMaterial.test.tsx` › "o `CONFLITO` do `PUT`…"; "o 429 do `PUT`…"; "o 429 diz em quantos minutos…" |
| 1366 × 768; uma ação cheia; vocabulário | E | `paginaNaoRola`; `VOCABULARIO_DE_NOTA` | `e2e/material-classificacao.spec.ts` › "cada capítulo com a situação em texto…" |
| 360 px; alvo de 24 px no `chromebook`, 44 px no `celular` | E | sem rolagem lateral, axe; medidos | `e2e/material-classificacao.spec.ts` › o mesmo caso (360 px, axe, alvos medidos) nos projetos `chromebook` e `celular` |
| teclado | E | o seletor abre, filtra e fecha; foco no botão | `e2e/material-classificacao.spec.ts` › "o seletor pelo teclado…" |
| situação | E | em texto, não só em cor | `e2e/material-classificacao.spec.ts` › "cada capítulo com a situação em texto…" (o rótulo é texto) |
| recomeço: coordenação da B na mesma aba | E | não vê o painel da A | `e2e/material-classificacao.spec.ts` › "recomeço: a coordenação de B entra na mesma aba…" |
| recomeço: material X, Y, X | E | seletor fechado e filtro limpo | `e2e/material-classificacao.spec.ts` › "recomeço: o material X, o Y e o X de novo…" |
| recomeço: habilidades de X seguradas e Y aberto | E | as de X não aparecem | `e2e/material-classificacao.spec.ts` › "recomeço: as habilidades de X seguradas com Y aberto…" |
| recomeço: `PUT` falha e a lista recarrega | E | o erro sai e o foco volta | `e2e/material-classificacao.spec.ts` › "recomeço: o `PUT` que falha e a leitura que traz o capítulo já corrigido por outra pessoa…" |

## Como testar

- Estados: `Material.test.tsx` › "erro: a mensagem curta e \"Tentar de novo\", que lê a lista de novo"; `PainelDoMaterial.test.tsx` › "a leitura dos capítulos que cai diz o que aconteceu…"
- 429: `PainelDoMaterial.test.tsx` › "o 429 do `PATCH` diz a hora em que dá para tentar de novo"
- Foco: `PainelDoMaterial.test.tsx` › "marcar outra série manda só as séries, e a mensagem de salvo recebe o foco"
- e2e: `e2e/material-painel.spec.ts` › "corrigir título e séries…"; `criarMaterialNoBanco` e `criarCapitulosNoBanco` (`e2e/support/material.ts`), e uma nova para seções e habilidades
- `npx vitest run --project unidade apps/web/src/areas/coordenacao/material/`; `node tools/ci/e2e.ts --manter-ambiente e2e/material-classificacao.spec.ts`
- Armadilha: asserção de ausência só depois da resposta que traria o que ela nega
- Telas: `coordenacao`, `/coordenacao/material?material=<id>`, a seção de habilidades e o seletor aberto (`--clicar`)

## Autoconferência

As 12 perguntas do modelo, no plano. Na 2: procure os rótulos novos em `e2e/`.

1. **Mutação de cada cláusula:** 113 blocos na seção "Mutações", gerados do diff (um por termo de condição, um por código de erro, um por efeito de foco, a rota nos dois métodos de `api/material.ts`, a fiação de `semComponente` em `Material.tsx`); o `--faltando` dá zero, e cada bloco foi corrido e ficou vermelho (dois deles só ficaram depois de eu mudar o teste: o rótulo da `classificada` e o foco que não entra ao abrir o painel).
2. **O texto já aparece na tela?** `grep -rln` dos textos novos em `e2e/`: só o `material-classificacao.spec.ts` os conta; "Corrigir" aparece em specs do professor (outra tela). Rodados isolados `material-painel`, `material`, `material-resumo`, `material-licencas`, `areas` e `incidentes`, que abrem a tela do painel.
3. **O segundo dado:** capítulos nas cinco situações, um corrigido e um não; dois materiais (X e Y) com habilidades diferentes; duas escolas (A e B); disciplina com e sem componente.
4. **O teste prova pelo efeito:** o clique duplo prova um `PUT` só (as chamadas do `fakeNetwork`), e não a espera; o foco se prova com `document.activeElement`.
5. **Quem mede a tela:** `paginaNaoRola` a 1366 × 768, 360 px sem rolagem lateral, axe, alvo de 24 px (`chromebook`) e 44 px (`celular`), medidos, e `botoesCheios` (uma ação cheia).
6. **Os quatro estados:** carregando, erro com "Tentar de novo", vazio só com a leitura terminada, e com dado: no painel e no seletor.
7. **Recomeço:** B na mesma aba, X-Y-X, habilidades de X seguradas com Y aberto, e `PUT` que falha com a lista relida: quatro casos de e2e.
8. **Ação oficial:** "Reclassificar" mostra quantos refaz e quantos ficam antes de pedir; a correção diz que é final; "Cancelar" não pede nada.
9. **Vocabulário:** `VOCABULARIO_DE_NOTA` e "trecho"/"seção" fora da tela, provados no unitário e no e2e.
10. **Contrato:** os tipos vêm de `@educa/shared` (`materialComCapitulosResponseSchema`, `habilidadesBnccResponseSchema`, `reclassificarResponseSchema`, `corrigirSecaoRequestSchema`); nada redigitado.
11. **Privacidade:** a tela não mostra dado de pessoa; só habilidade e capítulo; nenhum log novo.
12. **IA:** a origem diz "Sugerida pela IA" sempre; com a função suspensa, diz que não vale; a correção da coordenação vale no lugar da IA e não é refeita.

## Fora do escopo desta tarefa

O artefato do professor (11.0); a aba Cobertura (13.0).

## Divergências resolvidas nesta tarefa

- **Capítulo corrigido sem nenhuma habilidade.** O rótulo `sem_habilidade` ("A IA não achou habilidade neste capítulo") seria falso: foi a coordenação que o deixou assim. A tela diz "Sem habilidade neste capítulo, como a coordenação corrigiu". Entrou no `cenarios.md`, "Telas".
- **Origem com a função suspensa.** "Sugerida pela IA" sozinha enganaria: a geração e a cobertura ignoram o que a IA sugeriu. A tela diz "Sugerida pela IA (não vale enquanto a classificação está suspensa)". No `cenarios.md`.
- **"Reclassificar" no capítulo que não terminou.** O cenário põe o botão no rótulo; ele abre a mesma confirmação do botão do alto, que refaz o material inteiro (a API reclassifica o material, não o capítulo). O nome acessível leva "o material" (`sr-only`).
- **Textos dos erros da API.** O cenário só traz o `CONFLITO` do `PUT` e o 429. Os demais códigos (`ENTRADA_INVALIDA`, `NAO_ENCONTRADO`, `FUNCAO_SUSPENSA`, o `CONFLITO` do reclassificar) ganharam texto que diz o que fazer, e a falha que muda o que a tela sabe manda ler o material de novo.
- **Editor com a função suspensa.** Parte só do que a coordenação corrigiu, e não da sugestão da IA.
- **"Corrigir" e "Reclassificar" sem o componente.** O painel recebe `semComponente` de `Material.tsx`, que já lê a lista de disciplinas; `undefined` (lista ainda não lida) desliga os dois sem mostrar o aviso.
- **Todos corrigidos.** "Reclassificar" fica desligado, com "Todos os capítulos já foram corrigidos pela coordenação: não há o que classificar de novo.". A confirmação, depois de o pedido ser aceito, fecha só quando o material é relido.

## Mutações

O termo `aberta` de `editorVale` não tem bloco que o tire e deixe `editando.assinatura === assinatura` como está: sem ele a linha lê `.assinatura` de `undefined` na primeira renderização e lança, e o vermelho seria o do erro, não o do teste. Ele é provado pelos dois blocos que o trocam por `editando?.assinatura` e que tornam `aberta` verdadeira para qualquer capítulo (teste: "o clique duplo em…", dois capítulos de mesma marca).

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/classificacao.ts
teste: apps/web/src/areas/coordenacao/material/classificacao.test.ts › o título sozinho sem número, e "Páginas X a Y" no bloco de páginas
-return secao.capitulo === null ? paginasDoCapitulo(secao) : tituloDoCapitulo(secao.capitulo)
+return secao.capitulo === null ? '' : tituloDoCapitulo(secao.capitulo)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/classificacao.ts
teste: apps/web/src/areas/coordenacao/material/classificacao.test.ts › o título sozinho sem número, e "Páginas X a Y" no bloco de páginas
-return secao.capitulo === null ? undefined : paginasDoCapitulo(secao)
+return secao.capitulo === null ? '' : paginasDoCapitulo(secao)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/classificacao.ts
teste: apps/web/src/areas/coordenacao/material/classificacao.test.ts › a IA se declara como tal
-return origem === 'ia' && suspensa ? TEXTO_DA_IA_QUE_NAO_VALE : TEXTO_DA_ORIGEM[origem]
+return origem === 'ia' ? TEXTO_DA_IA_QUE_NAO_VALE : TEXTO_DA_ORIGEM[origem]
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/classificacao.ts
teste: apps/web/src/areas/coordenacao/material/classificacao.test.ts › a IA se declara como tal
-return origem === 'ia' && suspensa ? TEXTO_DA_IA_QUE_NAO_VALE : TEXTO_DA_ORIGEM[origem]
+return suspensa ? TEXTO_DA_IA_QUE_NAO_VALE : TEXTO_DA_ORIGEM[origem]
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/classificacao.ts
teste: apps/web/src/areas/coordenacao/material/classificacao.test.ts › os cinco, em texto: só a classificada não diz nada
-if (secao.corrigida && secao.situacao === 'sem_habilidade') return { texto: 'Sem habilidade neste capítulo, como a coordenação corrigiu', familia: 'info' }
+if (secao.situacao === 'sem_habilidade') return { texto: 'Sem habilidade neste capítulo, como a coordenação corrigiu', familia: 'info' }
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/classificacao.ts
teste: apps/web/src/areas/coordenacao/material/classificacao.test.ts › o capítulo que a coordenação deixou sem habilidade não diz
-if (secao.corrigida && secao.situacao === 'sem_habilidade') return { texto: 'Sem habilidade neste capítulo, como a coordenação corrigiu', familia: 'info' }
+if (secao.corrigida) return { texto: 'Sem habilidade neste capítulo, como a coordenação corrigiu', familia: 'info' }
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/classificacao.ts
teste: apps/web/src/areas/coordenacao/material/classificacao.test.ts › os cinco, em texto: só a classificada não diz nada
-if (suspensa && secao.situacao === 'nao_classificada') return undefined
+if (secao.situacao === 'nao_classificada') return undefined
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/classificacao.ts
teste: apps/web/src/areas/coordenacao/material/classificacao.test.ts › com a função suspensa, o capítulo que a IA não terminou fica sem rótulo
-if (suspensa && secao.situacao === 'nao_classificada') return undefined
+if (suspensa) return undefined
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/classificacao.ts
teste: apps/web/src/areas/coordenacao/material/classificacao.test.ts › conta o que se refaz
-const primeira = refeitos === 1 ? '1 capítulo será classificado' : `${String(refeitos)} capítulos serão classificados`
+const primeira = `${String(refeitos)} capítulos serão classificados`
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/classificacao.ts
teste: apps/web/src/areas/coordenacao/material/classificacao.test.ts › conta o que se refaz
-const segunda = corrigidos === 1 ? '1 corrigido fica como está' : `${String(corrigidos)} corrigidos ficam como estão`
+const segunda = `${String(corrigidos)} corrigidos ficam como estão`
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/classificacao.ts
teste: apps/web/src/areas/coordenacao/material/classificacao.test.ts › o 429 diz em quantos minutos tentar de novo, arredondando
-if (esperaSegundos === undefined) return 'Muitas alterações seguidas. Tente de novo em instantes.'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/classificacao.ts
teste: apps/web/src/areas/coordenacao/material/classificacao.test.ts › a correção: o 429, o material que ainda não está pronto
 export function textoDaFalhaDaCorrecao(erro: unknown): string {
 if (erro instanceof ApiError) {
-if (erro.codigo === ErrorCode.LIMITE_EXCEDIDO) return textoDoLimiteDaClassificacao(erro.esperaSegundos)
 if (erro.codigo === ErrorCode.CONFLITO) return TEXTO_DO_CONFLITO_DA_CORRECAO
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/classificacao.ts
teste: apps/web/src/areas/coordenacao/material/classificacao.test.ts › a correção: o 429, o material que ainda não está pronto
 if (erro.codigo === ErrorCode.LIMITE_EXCEDIDO) return textoDoLimiteDaClassificacao(erro.esperaSegundos)
-if (erro.codigo === ErrorCode.CONFLITO) return TEXTO_DO_CONFLITO_DA_CORRECAO
 if (erro.codigo === ErrorCode.ENTRADA_INVALIDA) return 'Alguma habilidade não vale mais para este material. A lista foi atualizada: escolha de novo.'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/classificacao.ts
teste: apps/web/src/areas/coordenacao/material/classificacao.test.ts › a correção: o 429, o material que ainda não está pronto
 if (erro.codigo === ErrorCode.CONFLITO) return TEXTO_DO_CONFLITO_DA_CORRECAO
-if (erro.codigo === ErrorCode.ENTRADA_INVALIDA) return 'Alguma habilidade não vale mais para este material. A lista foi atualizada: escolha de novo.'
 if (erro.codigo === ErrorCode.NAO_ENCONTRADO) return 'Este capítulo, ou o material, já não existe. A lista foi atualizada.'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/classificacao.ts
teste: apps/web/src/areas/coordenacao/material/classificacao.test.ts › a correção: o 429, o material que ainda não está pronto
 if (erro.codigo === ErrorCode.ENTRADA_INVALIDA) return 'Alguma habilidade não vale mais para este material. A lista foi atualizada: escolha de novo.'
-if (erro.codigo === ErrorCode.NAO_ENCONTRADO) return 'Este capítulo, ou o material, já não existe. A lista foi atualizada.'
 }
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/classificacao.ts
teste: apps/web/src/areas/coordenacao/material/classificacao.test.ts › o "Reclassificar": o 429
 export function textoDaFalhaDoReclassificar(erro: unknown): string {
 if (erro instanceof ApiError) {
-if (erro.codigo === ErrorCode.LIMITE_EXCEDIDO) return textoDoLimiteDaClassificacao(erro.esperaSegundos)
 if (erro.codigo === ErrorCode.FUNCAO_SUSPENSA) return TEXTO_DA_SUSPENSAO
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/classificacao.ts
teste: apps/web/src/areas/coordenacao/material/classificacao.test.ts › o "Reclassificar": o 429
 if (erro.codigo === ErrorCode.LIMITE_EXCEDIDO) return textoDoLimiteDaClassificacao(erro.esperaSegundos)
-if (erro.codigo === ErrorCode.FUNCAO_SUSPENSA) return TEXTO_DA_SUSPENSAO
 if (erro.codigo === ErrorCode.CONFLITO) return 'Este material não pode ser classificado de novo agora: ele ainda está sendo lido, ou a disciplina ficou sem componente da BNCC.'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/classificacao.ts
teste: apps/web/src/areas/coordenacao/material/classificacao.test.ts › o "Reclassificar": o 429
 if (erro.codigo === ErrorCode.FUNCAO_SUSPENSA) return TEXTO_DA_SUSPENSAO
-if (erro.codigo === ErrorCode.CONFLITO) return 'Este material não pode ser classificado de novo agora: ele ainda está sendo lido, ou a disciplina ficou sem componente da BNCC.'
 if (erro.codigo === ErrorCode.NAO_ENCONTRADO) return 'Este material já não existe. A lista foi atualizada.'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/classificacao.ts
teste: apps/web/src/areas/coordenacao/material/classificacao.test.ts › o "Reclassificar": o 429
 if (erro.codigo === ErrorCode.CONFLITO) return 'Este material não pode ser classificado de novo agora: ele ainda está sendo lido, ou a disciplina ficou sem componente da BNCC.'
-if (erro.codigo === ErrorCode.NAO_ENCONTRADO) return 'Este material já não existe. A lista foi atualizada.'
 }
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/classificacao.ts
teste: apps/web/src/areas/coordenacao/material/classificacao.test.ts › só a falha que muda o que a tela sabe manda ler de novo
 export function falhaMudouAClassificacao(erro: unknown): boolean {
 return (
-erro instanceof ApiError &&
 (erro.codigo === ErrorCode.NAO_ENCONTRADO || erro.codigo === ErrorCode.CONFLITO || erro.codigo === ErrorCode.ENTRADA_INVALIDA || erro.codigo === ErrorCode.FUNCAO_SUSPENSA)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/classificacao.ts
teste: apps/web/src/areas/coordenacao/material/classificacao.test.ts › só a falha que muda o que a tela sabe manda ler de novo
-(erro.codigo === ErrorCode.NAO_ENCONTRADO || erro.codigo === ErrorCode.CONFLITO || erro.codigo === ErrorCode.ENTRADA_INVALIDA || erro.codigo === ErrorCode.FUNCAO_SUSPENSA)
+(erro.codigo === ErrorCode.CONFLITO || erro.codigo === ErrorCode.ENTRADA_INVALIDA || erro.codigo === ErrorCode.FUNCAO_SUSPENSA)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/classificacao.ts
teste: apps/web/src/areas/coordenacao/material/classificacao.test.ts › só a falha que muda o que a tela sabe manda ler de novo
-(erro.codigo === ErrorCode.NAO_ENCONTRADO || erro.codigo === ErrorCode.CONFLITO || erro.codigo === ErrorCode.ENTRADA_INVALIDA || erro.codigo === ErrorCode.FUNCAO_SUSPENSA)
+(erro.codigo === ErrorCode.NAO_ENCONTRADO || erro.codigo === ErrorCode.ENTRADA_INVALIDA || erro.codigo === ErrorCode.FUNCAO_SUSPENSA)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/classificacao.ts
teste: apps/web/src/areas/coordenacao/material/classificacao.test.ts › só a falha que muda o que a tela sabe manda ler de novo
-(erro.codigo === ErrorCode.NAO_ENCONTRADO || erro.codigo === ErrorCode.CONFLITO || erro.codigo === ErrorCode.ENTRADA_INVALIDA || erro.codigo === ErrorCode.FUNCAO_SUSPENSA)
+(erro.codigo === ErrorCode.NAO_ENCONTRADO || erro.codigo === ErrorCode.CONFLITO || erro.codigo === ErrorCode.FUNCAO_SUSPENSA)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/classificacao.ts
teste: apps/web/src/areas/coordenacao/material/classificacao.test.ts › só a falha que muda o que a tela sabe manda ler de novo
-(erro.codigo === ErrorCode.NAO_ENCONTRADO || erro.codigo === ErrorCode.CONFLITO || erro.codigo === ErrorCode.ENTRADA_INVALIDA || erro.codigo === ErrorCode.FUNCAO_SUSPENSA)
+(erro.codigo === ErrorCode.NAO_ENCONTRADO || erro.codigo === ErrorCode.CONFLITO || erro.codigo === ErrorCode.ENTRADA_INVALIDA)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/classificacao.ts
teste: apps/web/src/areas/coordenacao/material/classificacao.test.ts › os que o capítulo tem hoje
-return secao.habilidades.filter((habilidade) => (!suspensa || habilidade.origem === 'coordenacao') && candidatas.has(habilidade.codigo)).map((habilidade) => habilidade.codigo)
+return secao.habilidades.filter((habilidade) => candidatas.has(habilidade.codigo)).map((habilidade) => habilidade.codigo)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/classificacao.ts
teste: apps/web/src/areas/coordenacao/material/classificacao.test.ts › os que o capítulo tem hoje
-return secao.habilidades.filter((habilidade) => (!suspensa || habilidade.origem === 'coordenacao') && candidatas.has(habilidade.codigo)).map((habilidade) => habilidade.codigo)
+return secao.habilidades.filter((habilidade) => (habilidade.origem === 'coordenacao') && candidatas.has(habilidade.codigo)).map((habilidade) => habilidade.codigo)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/classificacao.ts
teste: apps/web/src/areas/coordenacao/material/classificacao.test.ts › os que o capítulo tem hoje
-return secao.habilidades.filter((habilidade) => (!suspensa || habilidade.origem === 'coordenacao') && candidatas.has(habilidade.codigo)).map((habilidade) => habilidade.codigo)
+return secao.habilidades.filter((habilidade) => (!suspensa) && candidatas.has(habilidade.codigo)).map((habilidade) => habilidade.codigo)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/classificacao.ts
teste: apps/web/src/areas/coordenacao/material/classificacao.test.ts › os que o capítulo tem hoje
-return secao.habilidades.filter((habilidade) => (!suspensa || habilidade.origem === 'coordenacao') && candidatas.has(habilidade.codigo)).map((habilidade) => habilidade.codigo)
+return secao.habilidades.filter((habilidade) => (!suspensa || habilidade.origem === 'coordenacao')).map((habilidade) => habilidade.codigo)
```

```mutacao
arquivo: apps/web/src/components/habilidades/SeletorDeHabilidades.tsx
teste: apps/web/src/components/habilidades/SeletorDeHabilidades.test.tsx › acha pelo texto, sem acento e com todas as palavras
-return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
+return texto.normalize('NFD').toLowerCase()
```

```mutacao
arquivo: apps/web/src/components/habilidades/SeletorDeHabilidades.tsx
teste: apps/web/src/components/habilidades/SeletorDeHabilidades.test.tsx › acha pelo texto, sem acento e com todas as palavras
 const palavras = semAcentoNemCaixa(filtro)
-.split(/\s+/)
+.split('')
 .filter((palavra) => palavra !== '')
 if (palavras.length === 0) return [...itens]
```

```mutacao
arquivo: apps/web/src/components/habilidades/SeletorDeHabilidades.tsx
teste: apps/web/src/components/habilidades/SeletorDeHabilidades.test.tsx › o foco entra no filtro quando a peça abre
-;(campo ?? raiz.current)?.focus()
+;campo?.focus()
```

```mutacao
arquivo: apps/web/src/components/habilidades/SeletorDeHabilidades.tsx
teste: apps/web/src/components/habilidades/SeletorDeHabilidades.test.tsx › o Esc fecha a peça e não sobe ao painel
-if (evento.key !== 'Escape' || aoFechar === undefined) return
+if (aoFechar === undefined) return
```

```mutacao
arquivo: apps/web/src/components/habilidades/SeletorDeHabilidades.tsx
teste: apps/web/src/components/habilidades/SeletorDeHabilidades.test.tsx › o Esc fecha a peça e não sobe ao painel
-if (evento.key !== 'Escape' || aoFechar === undefined) return
+if (evento.key !== 'Escape') return
```

```mutacao
arquivo: apps/web/src/components/habilidades/SeletorDeHabilidades.tsx
teste: apps/web/src/components/habilidades/SeletorDeHabilidades.test.tsx › cada linha traz o código junto da descrição
-const lista = itens === undefined ? undefined : linhasDoSeletor({ itens, filtro, selecionados })
+const lista = undefined
```

```mutacao
arquivo: apps/web/src/components/habilidades/SeletorDeHabilidades.tsx
teste: apps/web/src/components/habilidades/SeletorDeHabilidades.test.tsx › de 0 a 5: com cinco escolhidas
-aoMudar(marcada ? [...selecionados, codigo] : selecionados.filter((escolhido) => escolhido !== codigo))
+aoMudar([...selecionados, codigo])
```

```mutacao
arquivo: apps/web/src/components/habilidades/SeletorDeHabilidades.tsx
teste: apps/web/src/components/habilidades/SeletorDeHabilidades.test.tsx › sem componente: diz o que acontece
-{semComponente ? (
+{false ? (
```

```mutacao
arquivo: apps/web/src/components/habilidades/SeletorDeHabilidades.tsx
teste: apps/web/src/components/habilidades/SeletorDeHabilidades.test.tsx › carregando: o filtro está lá
-{carregando ? (
+{false ? (
```

```mutacao
arquivo: apps/web/src/components/habilidades/SeletorDeHabilidades.tsx
teste: apps/web/src/components/habilidades/SeletorDeHabilidades.test.tsx › a leitura que cai com a lista de antes
-) : erro || lista === undefined ? (
+) : lista === undefined ? (
```

```mutacao
arquivo: apps/web/src/components/habilidades/SeletorDeHabilidades.tsx
teste: apps/web/src/components/habilidades/SeletorDeHabilidades.test.tsx › sem lista, sem leitura no ar e sem erro
-) : erro || lista === undefined ? (
+) : erro ? (
```

```mutacao
arquivo: apps/web/src/components/habilidades/SeletorDeHabilidades.tsx
teste: apps/web/src/components/habilidades/SeletorDeHabilidades.test.tsx › de 0 a 5: com cinco escolhidas
-{cheio ? '. Tire uma para escolher outra.' : ''}
+{''}
```

```mutacao
arquivo: apps/web/src/components/habilidades/SeletorDeHabilidades.tsx
teste: apps/web/src/components/habilidades/SeletorDeHabilidades.test.tsx › a lista de candidatas vazia
-{lista.total === 0 ? (
+{false ? (
```

```mutacao
arquivo: apps/web/src/components/habilidades/SeletorDeHabilidades.tsx
teste: apps/web/src/components/habilidades/SeletorDeHabilidades.test.tsx › zero é uma escolha válida
-<input type="checkbox" checked={marcada} disabled={cheio && !marcada} onChange={(evento) => marcar(habilidade.codigo, evento.target.checked)} className="mt-0.5 size-6 shrink-0 accent-tinta" />
+<input type="checkbox" checked={marcada} disabled={!marcada} onChange={(evento) => marcar(habilidade.codigo, evento.target.checked)} className="mt-0.5 size-6 shrink-0 accent-tinta" />
```

```mutacao
arquivo: apps/web/src/components/habilidades/SeletorDeHabilidades.tsx
teste: apps/web/src/components/habilidades/SeletorDeHabilidades.test.tsx › de 0 a 5: com cinco escolhidas
-<input type="checkbox" checked={marcada} disabled={cheio && !marcada} onChange={(evento) => marcar(habilidade.codigo, evento.target.checked)} className="mt-0.5 size-6 shrink-0 accent-tinta" />
+<input type="checkbox" checked={marcada} disabled={cheio} onChange={(evento) => marcar(habilidade.codigo, evento.target.checked)} className="mt-0.5 size-6 shrink-0 accent-tinta" />
```

```mutacao
arquivo: apps/web/src/components/habilidades/SeletorDeHabilidades.tsx
teste: apps/web/src/components/habilidades/SeletorDeHabilidades.test.tsx › cada linha traz o código junto da descrição
-{lista.total > MAXIMO_DE_LINHAS_DO_SELETOR && (
+{(
```

```mutacao
arquivo: apps/web/src/components/habilidades/SeletorDeHabilidades.tsx
teste: apps/web/src/components/habilidades/SeletorDeHabilidades.test.tsx › a lista mostra até 50 linhas
-{lista.total > MAXIMO_DE_LINHAS_DO_SELETOR && (
-<p className="t-apoio text-apoio">
-Mostrando {String(MAXIMO_DE_LINHAS_DO_SELETOR)} de {String(lista.total)}. Escreva o código ou uma palavra do texto para achar as outras.
-</p>
-)}
+{lista.total > MAXIMO_DE_LINHAS_DO_SELETOR && null}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › manda o pedido uma vez, fica desligado
-if (texto !== undefined) aviso.current?.focus()
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › a suspensão que veio depois de a tela abrir
-const classes = falha ? 'border-erro bg-erro-cx text-erro' : 'border-ok bg-ok-cx text-ok'
+const classes = 'border-ok bg-ok-cx text-ok'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › a suspensão que veio depois de a tela abrir
-<p ref={aviso} tabIndex={-1} role={falha ? 'alert' : 'status'} className={`rounded-controle border p-3 break-words empty:hidden ${classes}`}>
+<p ref={aviso} tabIndex={-1} role="status" className={`rounded-controle border p-3 break-words empty:hidden ${classes}`}>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › abre com o que o capítulo já tem
-const escolhidos = escolha ?? (itens === undefined ? [] : codigosIniciaisDaCorrecao(secao, suspensa, new Set(itens.map((item) => item.codigo))))
+const escolhidos = itens === undefined ? [] : codigosIniciaisDaCorrecao(secao, suspensa, new Set(itens.map((item) => item.codigo)))
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › diz em quantos minutos tentar de novo, e o editor continua aberto
-if (!falhaMudouAClassificacao(erro)) return
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › sem mudança nenhuma no capítulo
-if (!mutacao.isPending) mutacao.reset()
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › sem mudança nenhuma no capítulo
-{mutacao.isError && <ErrorAlert texto={textoDaFalhaDaCorrecao(mutacao.error)} />}
+{<ErrorAlert texto={textoDaFalhaDaCorrecao(mutacao.error)} />}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › sem mudança nenhuma no capítulo
-{mutacao.isError && <ErrorAlert texto={textoDaFalhaDaCorrecao(mutacao.error)} />}
+{mutacao.isError && null}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › só liga com as candidatas lidas
-<Button variante="secundario" disabled={itens === undefined || mutacao.isPending} onClick={() => enviar(escolhidos)}>
+<Button variante="secundario" disabled={mutacao.isPending} onClick={() => enviar(escolhidos)}>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › o clique duplo em
-<Button variante="secundario" disabled={itens === undefined || mutacao.isPending} onClick={() => enviar(escolhidos)}>
+<Button variante="secundario" disabled={itens === undefined} onClick={() => enviar(escolhidos)}>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › o clique duplo em
-{mutacao.isPending ? 'Salvando…' : 'Salvar correção'}
+{'Salvar correção'}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › o clique duplo em
-const editorVale = aberta && editando.assinatura === assinatura
+const editorVale = editando?.assinatura === assinatura
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › o clique duplo em
-const aberta = editando?.secaoId === secao.id
+const aberta = editando !== undefined
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › diz que o material ainda não terminou, lê de novo
-const editorVale = aberta && editando.assinatura === assinatura
+const editorVale = aberta
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › com dado: uma linha por capítulo
-if (aberta && !editorVale) {
+if (!editorVale) {
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › abre com o que o capítulo já tem
-if (aberta && !editorVale) {
+if (aberta) {
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › os cinco rótulos, em texto, um por situação
-{rotulo !== undefined && (
+{(
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › os cinco rótulos, em texto, um por situação
-{rotulo !== undefined && (
-<div className="flex min-w-0 flex-wrap items-center gap-2">
-<StatusBadge familia={rotulo.familia}>{rotulo.texto}</StatusBadge>
-{secao.situacao === 'nao_classificada' && (
-<Button variante="secundario" onClick={aoReclassificar} disabled={semComponente !== false || reclassificando}>
-Reclassificar <span className="sr-only">o material</span>
-</Button>
-)}
-</div>
-)}
+{rotulo !== undefined && null}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › os cinco rótulos, em texto, um por situação
-{secao.situacao === 'nao_classificada' && (
+{(
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › do capítulo que não terminou abre a mesma confirmação
-{secao.situacao === 'nao_classificada' && (
-<Button variante="secundario" onClick={aoReclassificar} disabled={semComponente !== false || reclassificando}>
-Reclassificar <span className="sr-only">o material</span>
-</Button>
-)}
+{secao.situacao === 'nao_classificada' && null}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › os cinco rótulos, em texto, um por situação
-{secao.habilidades.length > 0 && (
+{(
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › as habilidades levam código, descrição e origem
-{secao.habilidades.length > 0 && (
-<ul className="flex min-w-0 flex-col gap-2">
-{secao.habilidades.map((habilidade) => (
-<li key={habilidade.codigo} className="flex min-w-0 flex-col gap-1">
-<span className="break-words text-tinta">
-<span className="font-semibold">{habilidade.codigo}</span> {habilidade.descricao}
-</span>
-<span className={`t-selo w-fit max-w-full rounded-selo px-2 py-1 break-words ${habilidade.origem === 'ia' ? 'bg-ia-cx text-ia' : 'bg-ok-cx text-ok'}`}>{textoDaOrigem(habilidade.origem, suspensa)}</span>
-</li>
-))}
-</ul>
-)}
+{secao.habilidades.length > 0 && null}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › abre com o que o capítulo já tem
-{editorVale && <EditorDaSecao materialId={materialId} secao={secao} titulo={titulo} suspensa={suspensa} recarregar={recarregar} aoFechar={fechar} />}
+{<EditorDaSecao materialId={materialId} secao={secao} titulo={titulo} suspensa={suspensa} recarregar={recarregar} aoFechar={fechar} />}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › abre com o que o capítulo já tem
-{editorVale && <EditorDaSecao materialId={materialId} secao={secao} titulo={titulo} suspensa={suspensa} recarregar={recarregar} aoFechar={fechar} />}
+{editorVale && null}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › a suspensão que veio depois de a tela abrir
-if (falhaMudouAClassificacao(erro)) void recarregar()
+void recarregar()
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › mostra quantos capítulos refaz
-if (confirmando) confirmacao.current?.focus()
+if (false) confirmacao.current?.focus()
 else if (devolverFoco.current) {
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › com dado: uma linha por capítulo
 if (confirmando) confirmacao.current?.focus()
-else if (devolverFoco.current) {
+else {
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › vazio: só com a leitura terminada
-if (secoes.length === 0) return <p className="text-apoio">{TEXTO_DO_VAZIO_DA_CLASSIFICACAO}</p>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › sem a suspensão, o aviso dela não aparece
-{suspensa && <Alert tom="atencao">{TEXTO_DA_SUSPENSAO}</Alert>}
+{<Alert tom="atencao">{TEXTO_DA_SUSPENSAO}</Alert>}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › função suspensa: o aviso diz
-{suspensa && <Alert tom="atencao">{TEXTO_DA_SUSPENSAO}</Alert>}
+{suspensa && null}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › com a disciplina ainda não lida
-{semComponente === true && <Alert tom="atencao">{textoDoComponenteQueFalta(disciplina)}</Alert>}
+{<Alert tom="atencao">{textoDoComponenteQueFalta(disciplina)}</Alert>}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › sem componente: o aviso nomeia a disciplina
-{semComponente === true && <Alert tom="atencao">{textoDoComponenteQueFalta(disciplina)}</Alert>}
+{semComponente === true && null}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › função suspensa: o aviso diz
-{!suspensa && <BlocoDoReclassificar reclassificar={reclassificar} semComponente={semComponente} refeitos={refeitos} corrigidos={corrigidos} />}
+{<BlocoDoReclassificar reclassificar={reclassificar} semComponente={semComponente} refeitos={refeitos} corrigidos={corrigidos} />}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › mostra quantos capítulos refaz
-{!suspensa && <BlocoDoReclassificar reclassificar={reclassificar} semComponente={semComponente} refeitos={refeitos} corrigidos={corrigidos} />}
+{!suspensa && null}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › mostra quantos capítulos refaz
-{!suspensa && <BlocoDoReclassificar reclassificar={reclassificar} semComponente={semComponente} refeitos={refeitos} corrigidos={corrigidos} />}
+{!suspensa && <BlocoDoReclassificar reclassificar={reclassificar} semComponente={semComponente} refeitos={0} corrigidos={0} />}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › sem componente: o aviso nomeia a disciplina
-<Button ref={botao} variante="secundario" disabled={semComponente !== false || refeitos === 0 || confirmando} onClick={pedir}>
+<Button ref={botao} variante="secundario" disabled={refeitos === 0 || confirmando} onClick={pedir}>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › com todos os capítulos corrigidos
-<Button ref={botao} variante="secundario" disabled={semComponente !== false || refeitos === 0 || confirmando} onClick={pedir}>
+<Button ref={botao} variante="secundario" disabled={semComponente !== false || confirmando} onClick={pedir}>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › mostra quantos capítulos refaz
-<Button ref={botao} variante="secundario" disabled={semComponente !== false || refeitos === 0 || confirmando} onClick={pedir}>
+<Button ref={botao} variante="secundario" disabled={semComponente !== false || refeitos === 0} onClick={pedir}>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › mostra quantos capítulos refaz
-{refeitos === 0 && <p className="min-w-0 flex-1 basis-48 text-apoio">{TEXTO_DO_RECLASSIFICAR_SEM_O_QUE_REFAZER}</p>}
+{<p className="min-w-0 flex-1 basis-48 text-apoio">{TEXTO_DO_RECLASSIFICAR_SEM_O_QUE_REFAZER}</p>}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › com todos os capítulos corrigidos
-{refeitos === 0 && <p className="min-w-0 flex-1 basis-48 text-apoio">{TEXTO_DO_RECLASSIFICAR_SEM_O_QUE_REFAZER}</p>}
+{refeitos === 0 && null}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › mostra quantos capítulos refaz
-{confirmando && (
+{(
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › mostra quantos capítulos refaz
-{confirmando && (
-<div role="group" aria-label="Confirmar a classificação de novo" className="flex min-w-0 flex-col gap-3 rounded-controle border border-borda p-3">
-<p ref={confirmacao} tabIndex={-1} className="break-words text-tinta">
-{textoDaConfirmacaoDoReclassificar(refeitos, corrigidos)}
-</p>
-<div className="flex flex-wrap items-center gap-3">
-<Button variante="secundario" disabled={mutacao.isPending} onClick={() => enviar(undefined)}>
-{mutacao.isPending ? 'Pedindo…' : 'Confirmar'}
-</Button>
-<Button variante="secundario" disabled={mutacao.isPending} onClick={cancelar}>
-Cancelar
-</Button>
-</div>
-</div>
-)}
+{confirmando && null}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › manda o pedido uma vez, fica desligado
-{mutacao.isPending ? 'Pedindo…' : 'Confirmar'}
+{'Confirmar'}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › manda o pedido uma vez, fica desligado
-<ResultadoDoPedido texto={mutacao.isError ? textoDaFalhaDoReclassificar(mutacao.error) : mutacao.isSuccess ? textoDoReclassificarPedido(mutacao.data) : undefined} falha={mutacao.isError} />
+<ResultadoDoPedido texto={undefined} falha={mutacao.isError} />
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › a suspensão que veio depois de a tela abrir
-<ResultadoDoPedido texto={mutacao.isError ? textoDaFalhaDoReclassificar(mutacao.error) : mutacao.isSuccess ? textoDoReclassificarPedido(mutacao.data) : undefined} falha={mutacao.isError} />
+<ResultadoDoPedido texto={mutacao.isError ? textoDaFalhaDoReclassificar(mutacao.error) : mutacao.isSuccess ? textoDoReclassificarPedido(mutacao.data) : undefined} falha={false} />
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › não pede nada à API e não desenha a seção
-if (material.estado !== 'pronto') return null
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › com dado: uma linha por capítulo
-{consulta.data !== undefined ? (
+{false ? (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › erro: diz o que aconteceu
-) : consulta.isError ? (
+) : false ? (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Material.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx › a lista de disciplinas ainda não lida
-return achada === undefined ? undefined : achada.componenteBncc === null
+return achada?.componenteBncc === null
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Material.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx › a disciplina sem componente: o aviso a nomeia
-return achada === undefined ? undefined : achada.componenteBncc === null
+return achada === undefined ? undefined : false
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/api/material.ts
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › abre com o que o capítulo já tem
-return authedRequest(`${CAMINHO}/${encodeURIComponent(materialId)}/secoes/${encodeURIComponent(secaoId)}/habilidades`, secaoDoMaterialResponseSchema, { metodo: 'PUT', corpo })
+return authedRequest(`${CAMINHO}/${encodeURIComponent(materialId)}/secao/${encodeURIComponent(secaoId)}/habilidades`, secaoDoMaterialResponseSchema, { metodo: 'PUT', corpo })
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/api/material.ts
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › manda o pedido uma vez, fica desligado
-return authedRequest(`${CAMINHO}/${encodeURIComponent(id)}/reclassificar`, reclassificarResponseSchema, { metodo: 'POST' })
+return authedRequest(`${CAMINHO}/${encodeURIComponent(id)}/reclassifica`, reclassificarResponseSchema, { metodo: 'POST' })
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › sem componente: o aviso nomeia a disciplina
-<Button variante="secundario" onClick={aoReclassificar} disabled={semComponente !== false || reclassificando}>
+<Button variante="secundario" onClick={aoReclassificar} disabled={reclassificando}>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › mostra quantos capítulos refaz
-<Button variante="secundario" onClick={aoReclassificar} disabled={semComponente !== false || reclassificando}>
+<Button variante="secundario" onClick={aoReclassificar} disabled={semComponente !== false}>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › mostra quantos capítulos refaz
-reclassificando={reclassificar.confirmando}
+reclassificando={false}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › sem componente: o aviso nomeia a disciplina
-<Button ref={botao} variante="secundario" aria-expanded={editorVale} disabled={semComponente !== false} onClick={() => aoEditar({ secaoId: secao.id, assinatura })}>
+<Button ref={botao} variante="secundario" aria-expanded={editorVale} disabled={false} onClick={() => aoEditar({ secaoId: secao.id, assinatura })}>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › com a disciplina ainda não lida
-<Button ref={botao} variante="secundario" aria-expanded={editorVale} disabled={semComponente !== false} onClick={() => aoEditar({ secaoId: secao.id, assinatura })}>
+<Button ref={botao} variante="secundario" aria-expanded={editorVale} disabled={semComponente === true} onClick={() => aoEditar({ secaoId: secao.id, assinatura })}>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › manda o pedido uma vez, fica desligado
-<Button variante="secundario" disabled={mutacao.isPending} onClick={() => enviar(undefined)}>
+<Button variante="secundario" disabled={false} onClick={() => enviar(undefined)}>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › manda o pedido uma vez, fica desligado
-<Button variante="secundario" disabled={mutacao.isPending} onClick={cancelar}>
+<Button variante="secundario" disabled={false} onClick={cancelar}>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › o clique duplo em
-<Button variante="secundario" disabled={mutacao.isPending} onClick={aoFechar}>
+<Button variante="secundario" disabled={false} onClick={aoFechar}>
```

```mutacao
arquivo: apps/web/src/components/habilidades/SeletorDeHabilidades.tsx
teste: apps/web/src/components/habilidades/SeletorDeHabilidades.test.tsx › de 0 a 5: com cinco escolhidas
-const cheio = selecionados.length >= maximo
+const cheio = selecionados.length > maximo
```

```mutacao
arquivo: apps/web/src/components/habilidades/SeletorDeHabilidades.tsx
teste: apps/web/src/components/habilidades/SeletorDeHabilidades.test.tsx › o que a pessoa escolheu fica à vista no alto
-const escolhidas = itens.filter((item) => selecionados.includes(item.codigo))
+const escolhidas = itens.filter((item) => !selecionados.includes(item.codigo))
```

```mutacao
arquivo: apps/web/src/components/habilidades/SeletorDeHabilidades.tsx
teste: apps/web/src/components/habilidades/SeletorDeHabilidades.test.tsx › o que a pessoa escolheu fica à vista no alto
-const achadas = filtrarHabilidades(itens, filtro).filter((item) => !selecionados.includes(item.codigo))
+const achadas = filtrarHabilidades(itens, filtro).filter((item) => selecionados.includes(item.codigo))
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › não pede nada à API e não desenha a seção
-const consulta = useQuery(materialComCapitulosQueryOptions(material.id, material.estado === 'pronto'))
+const consulta = useQuery(materialComCapitulosQueryOptions(material.id, true))
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/api/material.ts
teste: apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx › abre com o que o capítulo já tem
-queryFn: ({ signal }) => authedGet(`/v1/habilidades-bncc?materialId=${encodeURIComponent(id)}`, habilidadesBnccResponseSchema, signal),
+queryFn: ({ signal }) => authedGet(`/v1/habilidades-bncc`, habilidadesBnccResponseSchema, signal),
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/api/material.ts
teste: apps/web/src/areas/coordenacao/material/api/material.test.ts › a chave leva o id do material
-queryKey: [...MATERIAL_QUERY_KEY, 'habilidades-bncc', id],
+queryKey: [...MATERIAL_QUERY_KEY, 'habilidades-bncc'],
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/classificacao.ts
teste: apps/web/src/areas/coordenacao/material/classificacao.test.ts › o 429 diz em quantos minutos tentar de novo, arredondando
-return `Muitas alterações seguidas. Tente de novo em ${String(minutos)} ${minutos === 1 ? 'minuto' : 'minutos'}.`
+return `Muitas alterações seguidas. Tente de novo em ${String(minutos)} ${'minutos'}.`
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/classificacao.ts
teste: apps/web/src/areas/coordenacao/material/classificacao.test.ts › o 429 diz em quantos minutos tentar de novo, arredondando
-const minutos = Math.max(1, Math.ceil(esperaSegundos / 60))
+const minutos = Math.ceil(esperaSegundos / 60)
```


## Recomendações sem aplicar

Da ordem `.processo/ordens/8_task-r1.md`, seção "Sem aplicar":

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| `frontend-reviewer` (1ª) | O painel mostra os capítulos duas vezes, em "Capítulos" e em "Habilidades da BNCC" (`PainelDoMaterial.tsx:207-208`); em 360 px rola bastante. Também no `revisor-geral` (1ª) | Recusada: a `techspec.md` §9 e o `docs/interface.md` (Parte A, "O painel do material") pedem as duas listas. Se o Joaquim quiser fundi-las, é decisão de produto: `TODO.md` e a retro |
| `frontend-reviewer` (1ª) | O rodapé fixo ocupa mais de um terço do painel em 360 px com o seletor aberto | `TODO.md`: a 11.0 reaproveita o seletor e o painel é o do material; revisar quando o editor de capítulo crescer |
| `frontend-reviewer` (1ª) | «Excluir material» a um toque de «Enviar edição nova» no rodapé do celular | Recusada: já existia antes desta tarefa, abre confirmação de perigo, fora dos arquivos desta tarefa |
| `frontend-reviewer` (1ª), `revisor-geral` (1ª) | O «Reclassificar» fica desligado sem motivo quando o componente ainda não chegou (`semComponente === undefined`) | Recusada: `8_task.md:100` registra a escolha («`undefined` (lista ainda não lida) desliga os dois sem mostrar o aviso») e dura só a leitura. Texto de tela novo seria decisão de produto: `TODO.md` |
| `conformidade-reviewer` (1ª) | Mostrar «Sugerida pela IA» ao lado de cada caixa já marcada dentro do seletor | Destino: a 11.0, que reaproveita o seletor com o professor (`11_task.md`, 11.3); muda a peça compartilhada e o `cenarios.md` |
| `conformidade-reviewer` (1ª) | Distinguir «confirmada» de «alterada» na correção e na auditoria | Destino: retro da funcionalidade e `TODO.md`; pede mudança de contrato e da 7.0 |
| `conformidade-reviewer` (1ª) | Usar o selo de IA padrão em vez do chip feito à mão | Recusada: o `AIBadge` (`components/ui/ai/AgentSignature.tsx`) «não aceita cor, tamanho nem texto» e diz só «IA», e o `cenarios.md` (linhas 219 e 229) exige «Sugerida pela IA» e a variante da suspensão; as cores do chip (`bg-ia-cx text-ia`) já são as do selo |
| `revisor-geral` (1ª) | A habilidade que deixou de ser candidata sai do editor sem aviso, e «Salvar correção» sem mexer a apaga (`classificacao.ts:472-474`) | `TODO.md`: texto de tela novo e regra de produto; a 11.0 (troca no artefato) e a retro conferem se o caso existe fora da sala de teste |
| `privacy-guardian` (1ª) | Pôr a escola na chave de cache `habilidadesDoMaterialQueryOptions` | Recusada: o cache é limpo na troca de sessão e o e2e de recomeço (a coordenação de B na mesma aba) prova que é; a chave não tem a escola em nenhuma consulta da tela, e mudar só esta seria inconsistente |
| `infra-guardian` (1ª) | `staleTime` de uns 30 s e `refetchOnWindowFocus: false` em `habilidadesDoMaterialQueryOptions` | Recusada: ler de novo a cada abertura é de propósito («o recorte pode ter mudado desde a última vez», comentário em `api/material.ts:152-153`); mudar o cache muda o comportamento |
| `infra-guardian` (1ª) | A lista de capítulos não é virtualizada | Destino: 13.0 (a medição no Chromebook com material de muitas seções, regra 50, item 1) |

Da ordem `.processo/ordens/8_task-r2.md`, seção "Sem aplicar" (rodada 2):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| `revisor-geral` (2ª), `test-engineer` (2ª), `infra-guardian` (2ª) | O `corrigirSecaoRequestSchema.parse` em `api/material.ts:165` lança `ZodError` no cliente (não `ApiError`), e nada o prova: trocar por `{ codigos }` não deixa teste vermelho; o texto da falha do `parse` não é coberto | `TODO.md`: um teste com 6 códigos que confira que nenhum `PUT` sai (ou a linha `**Sem mutação:**` com o motivo), e o erro tipado quando a 11.0 reaproveitar o caminho. A tela não chega a esse caso: o seletor trava em 5 e as candidatas vêm da tabela. Dono: a 11.0, que reaproveita o caminho |
| `revisor-geral` (2ª) | Renomear a prop `reclassificando` (recebe `confirmando`, que também cobre a confirmação aberta) para `reclassificarAberto` | Recusada: o JSDoc da prop já explica; é nome, sem efeito |
| `test-engineer` (2ª) | `rota.fallback().catch(() => undefined)` em `e2e/material-classificacao.spec.ts:417` engole qualquer erro | `TODO.md`: aceitar só o erro de rota já tratada ou cancelada. Dono: quem mexer em `material-classificacao.spec.ts` (a 11.0 ou a 13.0) |
| `conformidade-reviewer` (2ª) | «Confirmada» x «alterada» na correção e na auditoria; a habilidade que deixa de ser candidata sai do editor sem aviso | Já no `TODO.md` (rodada 1); convém resolver antes de a 11.0 reaproveitar o seletor com o professor |
| `privacy-guardian` (2ª) | Manter a recusa de pôr a escola na chave de cache; o `corrigirSecaoNoBanco` poderia ter nome que diga que pula a auditoria | Chave de cache: já recusada na rodada 1. Nome do helper: recusada, o comentário já diz que é só do seed do e2e |
| `frontend-reviewer` (2ª) | Os capítulos duas vezes no painel; o rodapé fixo a 360 px; «Reclassificar» e «Corrigir» desligados sem texto durante a leitura das disciplinas | Já no `TODO.md` (rodada 1) |
| `infra-guardian` (2ª) | Virtualizar a lista de capítulos | 13.0 (medição no Chromebook), como na rodada 1 |


## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-18 14:40:40 | 2026-11-18 14:41:20 | `frontend-reviewer` | 1 | APROVADO | a21df69e1ba2ab7b3 |
| 2026-11-18 14:41:05 | 2026-11-18 14:41:27 | `tenancy-guardian` | 1 | APROVADO | a5d81eaeeda616f0f |
| 2026-11-18 14:40:46 | 2026-11-18 14:41:46 | `conformidade-reviewer` | 1 | APROVADO | a973387e32ea7a584 |
| 2026-11-18 14:41:11 | 2026-11-18 14:41:54 | `privacy-guardian` | 1 | APROVADO | af2477ed69f1016b9 |
| 2026-11-18 14:41:17 | 2026-11-18 14:42:01 | `infra-guardian` | 1 | APROVADO | ab8bb4353dd96a57d |
| 2026-11-18 14:40:59 | 2026-11-18 14:42:34 | `revisor-geral` | 1 | REPROVADO | a100a48b023421380 |
| 2026-11-18 14:40:52 | 2026-11-18 14:44:33 | `test-engineer` | 1 | REPROVADO | ab04760c9457ea89b |
| 2026-11-18 15:15:32 | 2026-11-18 15:16:03 | `revisor-geral` | 2 | APROVADO | ae8e7ca8ed39faa71 |
| 2026-11-18 15:15:58 | 2026-11-18 15:16:23 | `frontend-reviewer` | 2 | APROVADO | a84ae230f9dab5453 |
| 2026-11-18 15:16:19 | 2026-11-18 15:16:38 | `tenancy-guardian` | 2 | APROVADO | a95b5a8603cad9112 |
| 2026-11-18 15:16:09 | 2026-11-18 15:16:39 | `conformidade-reviewer` | 2 | APROVADO | a2252a7ec801ecdfd |
| 2026-11-18 15:16:29 | 2026-11-18 15:16:56 | `privacy-guardian` | 2 | APROVADO | ae6334ed3f845cc1d |
| 2026-11-18 15:16:40 | 2026-11-18 15:17:03 | `infra-guardian` | 2 | APROVADO | a0cda3b5791762b28 |
| 2026-11-18 15:15:48 | 2026-11-18 15:17:44 | `test-engineer` | 2 | APROVADO | a1e87837bb8682237 |
