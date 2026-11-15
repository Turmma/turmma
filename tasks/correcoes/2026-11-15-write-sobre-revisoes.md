# Correção — o `Write` reescreve documento de `tasks/` que já tem a seção "Revisões" e a apaga

**Origem:** `TODO.md`, "(F2c, retro, M2)": o `Write` não reescreve documento com a seção "Revisões"
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`
<!-- O PEDIDO do Orquestrador trouxe test-engineer e revisor-geral; a Mesa conferiu a linha contra os arquivos alterados: `documento-de-revisao.ts`, `hook-revisoes.ts` e `.claude/settings.json` estão na linha dos quatro guardiões em `guardioes-por-caminho.ts`, e o `revisor-geral` é obrigatório também pelo passo 5 de `corrigir` (toca `tools/processo/`). -->

## Sintoma

A seção "Revisões" de um documento de `tasks/` sumiu quando o Implementador o reescreveu inteiro com `Write`: na 3.0 da F2c (a 1ª
rodada se perdeu de vez), na 5.0, na 12.0, e duas vezes na X1. O hook volta a contar as rodadas do 1 (a contagem se apoia na tabela e,
só para a rodada que exigiu algo, em `achados/`), e a aprovação limpa de antes deixa de existir para o portão do commit.

## Fora desta correção

nada

## Causa

Só havia aviso em texto (`protocolo.md`, item 5: "nem reescrever inteiro (Write)"), e a seção é escrita pelo hook, no fim do arquivo,
sem que quem usa o `Write` a veja ao compor o conteúdo novo. Nenhum gancho olhava o `Write`: o `PreToolUse` de `.claude/settings.json`
só tinha o matcher `Bash`.

## Teste que reproduz

`tools/processo/hook-portao.test.ts`, `describe` "o Write não reescreve documento que já tem a seção "Revisões"", que roda o comando
**lido de `.claude/settings.json`** (como o Claude Code o roda) sobre uma cópia de `tools/processo/`. Sem o modo `escrita` do
`hook-revisoes.ts`, o comando não existe e todos os casos caem; o caso "sem a seção, recusa com saída 2" é o que a TODO descreveu:
o documento reescrito sem a tabela sai 0 antes, e sai 2 com "Edit" depois. Casos: tabela inteira (passa, com e sem papel, texto em
volta mudado), sem a seção, sem uma rodada, rodada alterada, tabela acima do título, caminho absoluto, relativo e com `./`/`..`,
arquivo novo, arquivo sem a seção, fora de `tasks/` (inclusive outra raiz), `Write` sem conteúdo, entrada sem caminho, falha de
leitura, e o hook que não carrega.

## Correção

- `tools/processo/documento-de-revisao.ts`: `linhasDaTabelaDeRevisoes` (as linhas que começam por `|`, do título ao fim do arquivo, onde
  `lerRevisoes` lê), `recusaDeEscritaSobreRevisoes` (toda linha da tabela de antes tem de estar na tabela de depois) e `decidirEscrita`
  (só arquivo que já existe sob `tasks/` da raiz). `EntradaHook.tool_input` ganha `file_path` e `content`.
- `tools/processo/hook-revisoes.ts`: modo `escrita`: a recusa sai em stderr, com saída 2 e "Edit". Falha ao decidir (leitura que
  falha) também recusa: o conserto do hook se faz com Edit, que o gancho não vê.
- `.claude/settings.json`: `PreToolUse` com matcher `Write`. O comando devolve 2 quando é a recusa, e, se o hook não carrega (saída
  que não é 2), escreve a mensagem do conserto e também sai 2, como o do Bash.
- A TODO do item é marcada. O `protocolo.md`, item 5, já manda usar Edit e não ganha texto: o orçamento de leitura do `/seguir`
  (`harness/seguir.test.ts`, RF26) está a menos de 100 B do teto de 24000 B.

Limite declarado: o gancho só vê o `Write`. `Edit` que apaga a seção, e `Bash` com `>`, não passam por ele; o `Edit` só muda o trecho
que se escreve, e o hook do Bash não é alterado aqui.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisor-geral (1ª) | `decidirEscrita` sem teste de unidade direto em `revisoes.test.ts` | Recusada: os 13 casos do `describe` do Write a exercitam pelo comando lido do `settings.json`, que é o que o Claude Code roda; `revisoes.test.ts` não é arquivo desta correção. |
| test-engineer (1ª) | Caminho com link simbólico: `decidirEscrita` compara com `resolve`/`relative`; normalizar com `realpathSync` e acrescentar caso | `TODO.md`, como item de processo (muda comportamento do gancho). |
| test-engineer (1ª) | Arquivo com CRLF: `linhasDaTabelaDeRevisoes` procura `\n## Revisões\n`; aceitar `\r?\n` ou declarar no limite | `TODO.md`, como item de processo (muda comportamento do gancho e o de `lerRevisoes`, que usa o mesmo título). |
| test-engineer (1ª), conformidade-reviewer (1ª), infra-guardian (1ª) | O limite declarado (`Edit` que apaga a seção, `Bash` com `>`) vira item próprio; o infra sugere pôr `recusaDeEscritaSobreRevisoes` no matcher `Edit`, comparando `old_string` e `new_string` | `TODO.md`, como item de processo, para a retro. Só entra se a seção voltar a sumir por esses caminhos. |
| revisor-geral (2ª) | O helper `escrever` aceita `string \| undefined \| ((raiz: string) => string)` como alvo; um sinal de "absoluto" ou a raiz ficaria mais legível | Recusada: funciona e o revisor diz que não bloqueia; já passou pelo test-engineer (2ª); mudar o teste de novo caducaria os dois revisores por legibilidade. |

## Mutações

--faltando: 0 linhas (14 blocos, 0 motivos)

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/hook-portao.test.ts › sem a seção, recusa com saída 2
falha: toContain('não traz 4 de 4 linhas')
-  return secao.split('\n').filter((linha) => linha.startsWith('|'))
+  return secao.split('\n').filter((linha) => /^\| \d{4}-/.test(linha))
```

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/hook-portao.test.ts › com a tabela acima do título da seção
-  const depois = new Set(linhasDaTabelaDeRevisoes(novo))
+  const depois = new Set(novo.split('\n'))
```

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/hook-portao.test.ts › com a tabela inteira, passa calado
-  const faltam = antes.filter((linha) => !depois.has(linha))
+  const faltam = antes.filter((linha) => depois.has(linha))
```

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/hook-portao.test.ts › com a seção sem a primeira rodada
-  if (faltam.length === 0) return null
+  if (faltam.length < 2) return null
```

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/hook-portao.test.ts › entrada sem caminho de arquivo passa
-  if (typeof alvo !== 'string') return null
+  if (alvo === 'nunca') return null
```

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/hook-portao.test.ts › arquivo com a seção fora de tasks
-  if (!relativo.startsWith('tasks/')) return null
+  if (relativo === '') return null
```

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/hook-portao.test.ts › arquivo novo, e arquivo que existe sem a seção, passam
-  if (!existsSync(absoluto)) return null
+  if (absoluto === '') return null
```

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/hook-portao.test.ts › Write sem conteúdo sobre documento
falha: toContain('não traz 4 de 4 linhas')
-  return recusaDeEscritaSobreRevisoes(relativo, readFileSync(absoluto, 'utf8'), typeof conteudo === 'string' ? conteudo : '')
+  return recusaDeEscritaSobreRevisoes(relativo, readFileSync(absoluto, 'utf8'), conteudo as string)
```

```mutacao
arquivo: tools/processo/hook-revisoes.ts
teste: tools/processo/hook-portao.test.ts › sem a seção, recusa com saída 2
-} else if (modo === 'escrita') {
+} else if (modo === 'escrito') {
```

```mutacao
arquivo: tools/processo/hook-revisoes.ts
teste: tools/processo/hook-portao.test.ts › sem a seção, recusa com saída 2
     process.stderr.write(`${motivo}\n`)
-    process.exit(2)
+    process.exit(0)
```

```mutacao
arquivo: tools/processo/hook-revisoes.ts
teste: tools/processo/hook-portao.test.ts › falha ao ler o documento recusa
   } catch (erro) {
-    motivo = `Write bloqueado: o hook de escrita falhou (${(erro as Error).message}). Use Edit e avise o Joaquim.`
+    motivo = (erro as Error).message === '' ? 'x' : null
```

```mutacao
arquivo: .claude/settings.json
teste: tools/processo/hook-portao.test.ts › o gancho do settings.json é do Write
-        "matcher": "Write",
+        "matcher": "Edit",
```

```mutacao
arquivo: .claude/settings.json
teste: tools/processo/hook-portao.test.ts › hook que não carrega recusa o Write
falha: not.toContain('não carregou')
-            "command": "node \"$CLAUDE_PROJECT_DIR/tools/processo/hook-revisoes.ts\" escrita || { [ \"$?\" = 2 ] && exit 2; echo 'hook de escrita não carregou: nenhum Write roda até consertar tools/processo/ (use Edit). Avise o Joaquim.' >&2; exit 2; }"
+            "command": "node \"$CLAUDE_PROJECT_DIR/tools/processo/hook-revisoes.ts\" escrita || { echo 'hook de escrita não carregou: nenhum Write roda até consertar tools/processo/ (use Edit). Avise o Joaquim.' >&2; exit 2; }"
```

```mutacao
arquivo: tools/processo/hook-revisoes.ts
teste: tools/processo/hook-portao.test.ts › sem a seção, recusa com saída 2
-  if (motivo) {
+  if (!motivo) {
     process.stderr.write(`${motivo}\n`)
```


## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-15 12:33:31 | 2026-11-15 12:33:39 | `tenancy-guardian` | 1 | APROVADO | a13386b2e9f7fb397 |
| 2026-11-15 12:33:32 | 2026-11-15 12:33:50 | `privacy-guardian` | 1 | APROVADO | aaa2e29b1a52adc1e |
| 2026-11-15 12:33:33 | 2026-11-15 12:33:51 | `conformidade-reviewer` | 1 | APROVADO | aa85095b88303eb7e |
| 2026-11-15 12:33:30 | 2026-11-15 12:33:56 | `revisor-geral` | 1 | APROVADO | ad1e8221c9b7e07ca |
| 2026-11-15 12:33:34 | 2026-11-15 12:33:57 | `infra-guardian` | 1 | APROVADO | a75a12db7ce77287e |
| 2026-11-15 12:33:28 | 2026-11-15 12:34:40 | `test-engineer` | 1 | APROVADO | a20290cfc4922568f |
| 2026-11-15 12:45:54 | 2026-11-15 12:46:10 | `revisor-geral` | 2 | APROVADO | a68df19ab6e78e3ce |
| 2026-11-15 12:45:43 | 2026-11-15 12:46:23 | `test-engineer` | 2 | APROVADO | a246822213e1d07cc |
