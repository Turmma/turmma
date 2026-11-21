# Correção — o bloco gravado em `achados/` leva o caminho absoluto do checkout, e o repositório é público

**Origem:** retro da F4b (`tasks/prd-classificacao-bncc/retro.md`), M5, entrada do `TODO.md` "(F4b, retro, M5)".
**Subagentes obrigatórios:** `revisor-geral`, `test-engineer`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`
<!-- O PEDIDO do Orquestrador ditou os dois primeiros; os quatro guardiões vêm de `tools/processo/documento-de-revisao.ts`, que `guardioes-por-caminho.ts` (`REGRAS_DO_RF16`) trata como o código que aplica a lista de veto, a pedido da Mesa. -->

## Sintoma

`achadoDaRodada` (`tools/processo/documento-de-revisao.ts`) grava a mensagem final do revisor como ela veio. Metade dos revisores cita o arquivo pelo
caminho absoluto da máquina (`/home/<usuário>/Documents/git/.maestri/floors/<andar>/apps/api/…:88`), e o bloco entra em `achados/<documento>.md` com esse
prefixo. O resumo do índice (`limpar`, `ATE_A_RAIZ`) só o tirava até a primeira pasta de uma lista curta (`apps`, `packages`, `infra`, `e2e`, `tools`, `tasks`, `docs`, e
`CLAUDE`, `TODO`, `README`, `ROADMAP`), e **o índice vazava também**: sem `.claude`, `.github`, `.processo` nem `package.json` na lista, sem o andar quando depois dele não vinha
pasta do repositório e sem a raiz do hook. O repositório é público: o nome do usuário da máquina e a estrutura de pastas do Maestri
ficam publicados (`grep -rl /home/ tasks/*/achados` acha dezenas de arquivos, e `tasks/correcoes/achados/indice.md` tem 20 linhas com `/home/`).

## Fora desta correção

nada

## Causa

`achadoDaRodada` não passa o texto por nenhuma limpeza de caminho, e a que existe, em `limpar` (a célula do índice), é parcial (`ATE_A_RAIZ`, lista curta de pastas) e não conhece
a raiz do hook. O hook grava os dois arquivos, o bloco e o índice, e os dois são commitados.

## Teste que reproduz

`tools/processo/revisoes.test.ts`, em "achados separados por documento, com índice": o bloco gravado não contém o caminho do checkout (o `raiz` do hook),
nem o de outro andar (`…/.maestri/floors/<outro>/`), nem o do térreo (uma linha por pasta e arquivo da raiz); o caminho do repositório (`apps/api/…:88`, `tasks/…`) fica, e o texto
em volta também; `../packages/…/tasks/x.ts` e `~/…` e a URL ficam como estão. Mais quatro casos, da 1ª rodada: a raiz que é prefixo do nome de outro andar (`a raiz do hook que é prefixo…`,
com o escape de `a+b`); a raiz com barra no fim; a linha nova de `achados/indice.md` sem `/home/` nem `.maestri` nem a raiz (`o índice de achados também não leva…`); e o `resumoDoAchado` sem raiz
(`o resumo do índice tira…`). Vermelho antes: o `test-engineer` e o `revisor-geral` rodaram `.--l1/apps/api/x.ts:3` e `.0/apps/x.ts` no código da 1ª rodada, e o índice com `/home/`.

## Correção

`semCaminhoDaMaquina(texto, raiz)` (`tools/processo/documento-de-revisao.ts`) tira do bloco, antes de gravá-lo em `achados/`: (1) a raiz do checkout do hook
(`raiz`), com ou sem barra no fim (a raiz sozinha vira `.`); (2) o prefixo de outro andar, `…/.maestri/floors/<andar>/`, mesmo sem pasta do repositório depois;
(3) o prefixo de qualquer outro checkout (o térreo) até a primeira pasta do repositório (`apps`, `packages`, `infra`, `e2e`, `tools`, `tasks`, `docs`,
`.claude`, `.github`, `.processo`) ou arquivo da raiz (`CLAUDE.md`, `TODO.md`, `README.md`, `ROADMAP.md`, `package.json`). A raiz do hook sozinha vira `.` só onde o nome acaba
(`(?![\w.-])`): o andar da spec é prefixo do andar da linha (`…--speccamada-ia` e `…--speccamada-ia--l1`), e a troca cega deixaria `.--l1/apps/…` (1ª rodada). A raiz entra na troca
por texto, com os caracteres de regex escapados. A **célula do índice** passa pela mesma limpeza: `registrar` aplica `semCaminhoDaMaquina` à mensagem antes do `resumoDoAchado`, e
`limpar` usa `DO_ANDAR` e `DA_RAIZ_DO_REPOSITORIO` no lugar do `ATE_A_RAIZ`, que saiu (`separar-achados.ts` chama o resumo sem raiz). Há um jeito só de tirar o prefixo. A barra que abre o prefixo
não pode vir depois de letra, ponto, `~`, `-`, `:` ou `/`: o caminho relativo com `tasks/` no meio (`apps/api/src/tasks/x.ts`) e a URL (`https://host/…/apps/x`)
ficam como estão. `achadoDaRodada` recebe a `raiz` e `registrar` a passa. O que fica de fora: o caminho absoluto de fora do repositório (`/tmp/…`, `/usr/…`, `~/…`) que
não termina numa pasta dele; o `.claude/projects/-home-<usuário>-…` (a pasta de memória do Claude, com o usuário no nome, que perde só o prefixo e fica parecendo caminho do
repositório); **a rota HTTP com um segmento igual ao de uma pasta do repositório** (`/api/docs/x`, `/v1/tasks/…`), que `DA_RAIZ_DO_REPOSITORIO` também corta até esse segmento; e o
que já foi gravado (`tasks/*/achados/` das specs anteriores tem milhares de ocorrências; limpar o histórico é outra tarefa, em entrada do `TODO.md`).

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| infra-guardian (1ª) | Teto de tamanho na entrada de `semCaminhoDaMaquina`, "se a função for reaproveitada em código de request" | Recusada: a função só roda no hook local do processo, que o próprio revisor aprovou; não há chamador em request. Quem a reaproveitar lá cria o teto |
| test-engineer (1ª) | A regra de antes da barra em `DO_ANDAR` não tem mutação | Recusada: o revisor a chama "aceitável", porque `.maestri/floors` relativo é raro |
| revisor-geral (1ª) | "ou exigir que a base termine num checkout conhecido" (a alternativa à rota HTTP) | Recusada: a seção "Correção" registra o comportamento; mudar a regra é mudar comportamento, fora desta correção |
| revisor-geral (1ª), privacy-guardian (1ª) | `.claude/projects/…` e `-home-<usuário>-…` ainda levam o usuário no nome da pasta; `/tmp/claude-<uid>/…` e `~/Documents/git/…` ficam inteiros | `TODO.md`, na entrada nova "O histórico e o que o prefixo não alcança" |
| revisor-geral (1ª), test-engineer (1ª), privacy-guardian (1ª) | O histórico já gravado continua público | `TODO.md`, na mesma entrada nova |
| revisor-geral (2ª), test-engineer (2ª) | A raiz sozinha seguida de ponto final (`o cwd é /home/u/Documents/git/Educa-ia.`) não é trocada, por causa do `.` em `(?![\w.-])`; no térreo, onde nada mais a pega, o caminho fica inteiro. Sugestão: `(?![\w-]\|\.\w)` ou `(?![\w-]\|\.[\w-])`, com um caso `semCaminhoDaMaquina('cwd /srv/x/y.', '/srv/x/y')` e bloco de mutação | `TODO.md`, na entrada "O histórico e o que o prefixo não alcança": muda comportamento do código, então não é recomendação barata |
| revisor-geral (2ª) | O comentário "Metade dos revisores cita…" ficou solto antes do comentário do negrito, acima de `limpar` (`documento-de-revisao.ts`); juntar os dois num bloco | Recusada: cosmético, e mexer em comentário de `.ts` caduca a rodada do `revisor-geral` e custa um ciclo inteiro |
| test-engineer (2ª) | Somar à entrada nova do `TODO.md` a rota HTTP com segmento igual ao de uma pasta do repositório (`/api/docs/x`), que hoje só está na seção "Correção" do documento | `TODO.md`, na mesma entrada |
| privacy-guardian (2ª) | O índice ainda guarda os caminhos reais de antes desta tarefa (`tasks/correcoes/achados/indice.md` e os de outras specs); priorizar o script de limpeza e decidir sobre reescrever o histórico do git | Já está no `TODO.md`, na entrada "O histórico e o que o prefixo não alcança"; a decisão sobre reescrever o histórico do git é do Joaquim, e o Orquestrador a leva a ele |
| privacy-guardian (2ª) | Pedir aos revisores que citem caminho relativo; a limpeza não pega `.claude/projects/-home-<usuário>-…`, `/tmp/claude-<uid>/…` nem `~/…` | A Mesa passa a pedir o caminho relativo no prompt dos revisores, a partir da próxima rodada de qualquer documento. O resto fica na mesma entrada do `TODO.md` |

## Mutações

--faltando: 0 linhas (20 blocos, 0 motivos)

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/revisoes.test.ts › o bloco guardado em achados/ não leva o caminho da máquina, só o do repositório
falha: expect(bloco).not.toContain('/home/')
-const DO_ANDAR = /(?<![\w./~:-])\/[^\s`'"()<>|[\]]*?\.maestri\/floors\/[^/\s`'"]+\/?/g
+const DO_ANDAR = /(?<![\w./~:-])\/[^\s`'"()<>|[\]]*?\.nunca\/floors\/[^/\s`'"]+\/?/g
```

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/revisoes.test.ts › o bloco guardado em achados/ não leva o caminho da máquina, só o do repositório
-const DA_RAIZ_DO_REPOSITORIO = new RegExp(`(?<![\\w./~:-])\\/[^\\s\`'"()<>|[\\]]*?\\/(?=${REPOSITORIO})`, 'g')
+const DA_RAIZ_DO_REPOSITORIO = /(?!)/g
```

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/revisoes.test.ts › o bloco guardado em achados/ não leva o caminho da máquina, só o do repositório
-const REPOSITORIO = '(?:apps|packages|infra|e2e|tools|tasks|docs|\\.claude|\\.github|\\.processo)\\/|(?:CLAUDE|TODO|README|ROADMAP)\\.md\\b|package\\.json\\b'
+const REPOSITORIO = '(?:apps|packages|infra|e2e|tasks|docs|\\.claude|\\.github|\\.processo)\\/|(?:CLAUDE|TODO|README|ROADMAP)\\.md\\b|package\\.json\\b'
```

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/revisoes.test.ts › o bloco guardado em achados/ não leva o caminho da máquina, só o do repositório
-const REPOSITORIO = '(?:apps|packages|infra|e2e|tools|tasks|docs|\\.claude|\\.github|\\.processo)\\/|(?:CLAUDE|TODO|README|ROADMAP)\\.md\\b|package\\.json\\b'
+const REPOSITORIO = '(?:apps|packages|infra|e2e|tools|tasks|docs|\\.claude|\\.github|\\.processo)\\/|package\\.json\\b'
```

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/revisoes.test.ts › o bloco guardado em achados/ não leva o caminho da máquina, só o do repositório
-const REPOSITORIO = '(?:apps|packages|infra|e2e|tools|tasks|docs|\\.claude|\\.github|\\.processo)\\/|(?:CLAUDE|TODO|README|ROADMAP)\\.md\\b|package\\.json\\b'
+const REPOSITORIO = '(?:apps|packages|infra|e2e|tools|tasks|docs|\\.claude|\\.github|\\.processo)\\/|(?:CLAUDE|TODO|README|ROADMAP)\\.md\\b'
```

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/revisoes.test.ts › o bloco guardado em achados/ não leva o caminho da máquina, só o do repositório
-const REPOSITORIO = '(?:apps|packages|infra|e2e|tools|tasks|docs|\\.claude|\\.github|\\.processo)\\/|(?:CLAUDE|TODO|README|ROADMAP)\\.md\\b|package\\.json\\b'
+const REPOSITORIO = '(?:apps|packages|infra|e2e|tools|tasks|docs|\\.github|\\.processo)\\/|(?:CLAUDE|TODO|README|ROADMAP)\\.md\\b|package\\.json\\b'
```

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/revisoes.test.ts › o bloco guardado em achados/ não leva o caminho da máquina, só o do repositório
-const REPOSITORIO = '(?:apps|packages|infra|e2e|tools|tasks|docs|\\.claude|\\.github|\\.processo)\\/|(?:CLAUDE|TODO|README|ROADMAP)\\.md\\b|package\\.json\\b'
+const REPOSITORIO = '(?:packages|infra|e2e|tools|tasks|docs|\\.claude|\\.github|\\.processo)\\/|(?:CLAUDE|TODO|README|ROADMAP)\\.md\\b|package\\.json\\b'
```

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/revisoes.test.ts › o bloco guardado em achados/ não leva o caminho da máquina, só o do repositório
-const DA_RAIZ_DO_REPOSITORIO = new RegExp(`(?<![\\w./~:-])\\/[^\\s\`'"()<>|[\\]]*?\\/(?=${REPOSITORIO})`, 'g')
+const DA_RAIZ_DO_REPOSITORIO = new RegExp(`(?<![./~:-])\\/[^\\s\`'"()<>|[\\]]*?\\/(?=${REPOSITORIO})`, 'g')
```

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/revisoes.test.ts › o bloco guardado em achados/ não leva o caminho da máquina, só o do repositório
-const DA_RAIZ_DO_REPOSITORIO = new RegExp(`(?<![\\w./~:-])\\/[^\\s\`'"()<>|[\\]]*?\\/(?=${REPOSITORIO})`, 'g')
+const DA_RAIZ_DO_REPOSITORIO = new RegExp(`(?<![\\w/~:-])\\/[^\\s\`'"()<>|[\\]]*?\\/(?=${REPOSITORIO})`, 'g')
```

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/revisoes.test.ts › o bloco guardado em achados/ não leva o caminho da máquina, só o do repositório
-const DA_RAIZ_DO_REPOSITORIO = new RegExp(`(?<![\\w./~:-])\\/[^\\s\`'"()<>|[\\]]*?\\/(?=${REPOSITORIO})`, 'g')
+const DA_RAIZ_DO_REPOSITORIO = new RegExp(`(?<![\\w./:-])\\/[^\\s\`'"()<>|[\\]]*?\\/(?=${REPOSITORIO})`, 'g')
```

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/revisoes.test.ts › o bloco guardado em achados/ não leva o caminho da máquina, só o do repositório
-const DA_RAIZ_DO_REPOSITORIO = new RegExp(`(?<![\\w./~:-])\\/[^\\s\`'"()<>|[\\]]*?\\/(?=${REPOSITORIO})`, 'g')
+const DA_RAIZ_DO_REPOSITORIO = new RegExp(`(?<![\\w./~-])\\/[^\\s\`'"()<>|[\\]]*?\\/(?=${REPOSITORIO})`, 'g')
```

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/revisoes.test.ts › o bloco guardado em achados/ não leva o caminho da máquina, só o do repositório
-  const semRaiz = base ? texto.replaceAll(`${base}/`, '').replace(new RegExp(`${escaparParaRegex(base)}(?![\\w.-])`, 'g'), '.') : texto
+  const semRaiz = false ? texto.replaceAll(`${base}/`, '').replace(new RegExp(`${escaparParaRegex(base)}(?![\\w.-])`, 'g'), '.') : texto
```

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/revisoes.test.ts › o bloco guardado em achados/ não leva o caminho da máquina, só o do repositório
-  const semRaiz = base ? texto.replaceAll(`${base}/`, '').replace(new RegExp(`${escaparParaRegex(base)}(?![\\w.-])`, 'g'), '.') : texto
+  const semRaiz = base ? texto.replaceAll(`${base}/`, '') : texto
```

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/revisoes.test.ts › a raiz do hook que é prefixo do nome de outro andar não o parte
-  const semRaiz = base ? texto.replaceAll(`${base}/`, '').replace(new RegExp(`${escaparParaRegex(base)}(?![\\w.-])`, 'g'), '.') : texto
+  const semRaiz = base ? texto.replaceAll(`${base}/`, '').replace(new RegExp(`${escaparParaRegex(base)}`, 'g'), '.') : texto
```

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/revisoes.test.ts › a raiz do hook que é prefixo do nome de outro andar não o parte
-const escaparParaRegex = (texto: string): string => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
+const escaparParaRegex = (texto: string): string => texto
```

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/revisoes.test.ts › a raiz do hook com barra no fim sai do mesmo jeito, e sem raiz só sai o que se reconhece
-  const base = raiz?.replace(/\/+$/, '')
+  const base = raiz
```

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/revisoes.test.ts › o bloco guardado em achados/ não leva o caminho da máquina, só o do repositório
-    const achado = revisao ? achadoDaRodada(revisao, mensagemFinal, raiz) : null
+    const achado = revisao ? achadoDaRodada(revisao, mensagemFinal) : null
```

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/revisoes.test.ts › o índice de achados também não leva o caminho da máquina
falha: expect(indice).not.toContain(raiz)
-        writeFileSync(caminhoIndice, acrescentarNoIndice(indice, revisao, relativo, resumoDoAchado(semCaminhoDaMaquina(mensagemFinal, raiz))))
+        writeFileSync(caminhoIndice, acrescentarNoIndice(indice, revisao, relativo, resumoDoAchado(mensagemFinal)))
```

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/revisoes.test.ts › o resumo do índice tira o caminho do andar e das pastas do repositório, sem a raiz do hook
-  return linha.replaceAll('**', '').replace(ITEM, '').replaceAll('|', '\\|').replace(DO_ANDAR, '').replace(DA_RAIZ_DO_REPOSITORIO, '').replace(/\s+/g, ' ').trim()
+  return linha.replaceAll('**', '').replace(ITEM, '').replaceAll('|', '\\|').replace(DO_ANDAR, '').replace(/\s+/g, ' ').trim()
```

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/revisoes.test.ts › o resumo do índice tira o caminho do andar e das pastas do repositório, sem a raiz do hook
-  return linha.replaceAll('**', '').replace(ITEM, '').replaceAll('|', '\\|').replace(DO_ANDAR, '').replace(DA_RAIZ_DO_REPOSITORIO, '').replace(/\s+/g, ' ').trim()
+  return linha.replaceAll('**', '').replace(ITEM, '').replaceAll('|', '\\|').replace(DA_RAIZ_DO_REPOSITORIO, '').replace(/\s+/g, ' ').trim()
```

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-21 03:19:26 | 2026-11-21 03:19:37 | `tenancy-guardian` | 1 | APROVADO | abdefa12b9bfca8cd |
| 2026-11-21 03:19:28 | 2026-11-21 03:19:46 | `conformidade-reviewer` | 1 | APROVADO | a920ce1acb2a43cd5 |
| 2026-11-21 03:19:29 | 2026-11-21 03:19:47 | `infra-guardian` | 1 | APROVADO | a0299018dc0e00747 |
| 2026-11-21 03:19:25 | 2026-11-21 03:20:46 | `test-engineer` | 1 | REPROVADO | aad228e47b15bc4a4 |
| 2026-11-21 03:19:24 | 2026-11-21 03:20:58 | `revisor-geral` | 1 | REPROVADO | a7867cbaa37d6e55f |
| 2026-11-21 03:19:27 | 2026-11-21 03:22:49 | `privacy-guardian` | 1 | APROVADO | a02ee37efa242d354 |
| 2026-11-21 03:38:09 | 2026-11-21 03:38:22 | `tenancy-guardian` | 2 | APROVADO | afc44ff2c8c35f988 |
| 2026-11-21 03:37:56 | 2026-11-21 03:38:27 | `revisor-geral` | 2 | APROVADO | a5d3db58ebce8f33d |
| 2026-11-21 03:38:19 | 2026-11-21 03:38:34 | `conformidade-reviewer` | 2 | APROVADO | a3b595eddefc25808 |
| 2026-11-21 03:38:24 | 2026-11-21 03:38:47 | `infra-guardian` | 2 | APROVADO | a79f42bc3fe102e23 |
| 2026-11-21 03:38:14 | 2026-11-21 03:39:03 | `privacy-guardian` | 2 | APROVADO | aec3dfa9ad60fb461 |
| 2026-11-21 03:38:04 | 2026-11-21 03:39:39 | `test-engineer` | 2 | APROVADO | a53c5fa644aa3fc14 |
