# Correção — a seção "Revisões" se perde quando um script reescreve o documento

**Origem:** `TODO.md`, "(X6, retro, M2)", aceita de novo na retro da F4b (20/11/2026): a 4.0, a 5.0 e a 7.0 da F4b perderam a 1ª rodada
**Subagentes obrigatórios:** `revisor-geral`, `test-engineer`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`
<!-- O PEDIDO do Orquestrador ditou revisor-geral e test-engineer; a Mesa conferiu a linha contra os arquivos alterados: `documento-de-revisao.ts`, `portao.ts` e `hook-revisoes.ts` estão na linha dos quatro guardiões em `guardioes-por-caminho.ts` (REGRAS_DO_RF16), e o `revisor-geral` é obrigatório também pelo passo 5 de `corrigir` (toca `tools/processo/`). -->

## Sintoma

A seção "Revisões" de um documento de `tasks/` sumiu, inteira ou em parte, quando um script reescreveu o arquivo (`python3 … open(p,'w')`
no Bash, na X6: a 2.0, a 7.0 e a 10.0; na F4b: a 4.0, a 5.0 e a 7.0). O gancho do `Write` (correção `write-sobre-revisoes`) só vê o
`Write`: o `Bash` com `>` e o script não passam por ele, e o limite estava declarado lá. O hook volta a contar as rodadas do 1 e a
aprovação limpa de antes deixa de existir para o portão do commit.

## Fora desta correção

nada

## Causa

A tabela só existe num lugar, o documento, e quem o reescreve por um caminho que nenhum gancho vê a leva junto. O arquivo de `achados/`
guarda só a rodada que exigiu algo, então a aprovada limpa não tem segunda cópia.

## Teste que reproduz

`tools/processo/revisoes-nao-se-perdem.test.ts` (29 casos novos, que rodam `registrar`, `portao` e o `hook-revisoes.ts` como processo sobre um
repositório de verdade, inclusive seis processos ao mesmo tempo sobre o documento sem a seção, duas pastas `prd-` com o mesmo `9_task.md`, e a trava do
documento tomada de fora para provar que o portão e o `registrar` a esperam). Vermelho antes: o caso "documento reescrito por script sem a seção" no código de antes dá `test-engineer rodada 1`
com a anterior perdida (reproduzido à mão, com o `registrar` do HEAD, antes de escrever a correção); depois da correção, a 1ª volta e a nova é
a 2ª. O arquivo importa nomes que só existem depois dela, então no HEAD o arquivo inteiro cai por import, e o vermelho de cada cláusula é o
do bloco de mutação dela. O caso de `revisoes.test.ts` que fixava o defeito ("a rodada continua dos achados quando o documento é
reescrito sem a seção") passou a apagar `.processo/` antes da 2ª rodada: ele prova a segunda fonte (os achados), que segue valendo sem a
cópia; com a cópia, a linha perdida volta.

## Correção

- `tools/processo/documento-de-revisao.ts`: a cópia da tabela por documento em `.processo/revisoes/<documento>.txt` (fora de `tasks/`; a pasta
  já é ignorada pelo git), gravada pelo `registrar` a cada linha escrita (`gravarCopiaDasRevisoes`). `devolverRevisoesPerdidas` refaz só o
  trecho da tabela (a cópia na ordem em que foi gravada, depois a rodada que o documento tem e a cópia não; o texto da seção e o que vem
  depois da tabela ficam; sem a seção, ela é recriada no fim) e `restaurarRevisoes` o grava. O `registrar` a chama antes de contar a rodada
  e avisa (`avisoDeRevisoesDevolvidas`, pelo parâmetro `avisar`).
- `tools/processo/hook-revisoes.ts`: o aviso do `registrar` sai em stderr e como `systemMessage` no stdout.
- `tools/processo/portao.ts`: antes do commit, o `PreToolUse` devolve ao disco a linha que sumiu do documento que o commit cita e recusa
  essa vez, mandando preparar o documento de novo (`git add`): o `git add` do comando já levou o documento sem a linha. A segunda tentativa
  segue para o resto do portão. A trava do documento é a do `registrar`. O documento é achado como o `decidirCommit` o acha, com a lista dos
  arquivos alterados (o commit `(tarefa N.0)` não cita a pasta `prd-`, e o `N_task.md` existe em várias), e o comentário da função diz que o
  portão escreve no disco antes de qualquer outra recusa (rodada 1 da Mesa, item 1 e item 7).
- `gravarCopiaDasRevisoes` grava num temporário e renomeia: o processo que cai no meio não deixa a cópia truncada (item 6).
- `TODO.md`: o item (X6, retro, M2) é marcado, e entram duas linhas para a retro com o que a Mesa recomendou e não coube aqui.

Limites declarados: (a) o git hook nativo (`hook-git.ts`) lê o índice e não escreve na árvore, então só o `PreToolUse` devolve a linha; (b) a
cópia é por checkout (`.processo/` é local): documento reescrito num checkout sem rodada registrada nele não tem o que devolver, e aí valem
os achados como segunda fonte da contagem; (c) cabeçalho e separador voltam da cópia, mas texto de seção reescrito por script não; (d) uma
linha da tabela alterada à mão (e não apagada) volta como a original, ao lado da alterada; (e) a cópia é chaveada pelo caminho do documento e não expira:
um documento refeito no mesmo andar, com a tabela zerada de propósito, recebe as rodadas antigas de volta (o aviso mostra isso); (f) o `registrar` grava
a cópia na raiz da sessão (`CLAUDE_PROJECT_DIR`) e o portão a procura na árvore do commit (`arvoreDoCommit`): num commit em outro checkout
(`git -C`), a cópia não é achada e nada é devolvido.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| conformidade-reviewer, 1ª | Comparar o veredito da cópia com o do documento quando data e revisor são os mesmos, para uma REPROVADA trocada à mão por APROVADA não valer (limite (d)) | Muda o comportamento do portão: não é barata. Destino: `TODO.md`, uma linha, para a retro (o revisor disse que já era possível antes e que não é regressão). |
| infra-guardian, 1ª | Centralizar a saída do `systemMessage` no stdout do hook | Hoje só há uma chamada, e centralizar muda o desenho do hook sem defeito a corrigir. Destino: `TODO.md`, junto da linha acima. |
| infra-guardian, 1ª | Teste do `registrar` e do `restaurarRevisoesComTrava` ao mesmo tempo sobre o mesmo documento | Virou bloqueante: aplicado no item 2 da ordem da 1ª rodada. |
| revisor-geral, 1ª | Deixar escrito em `protocolo.md` ou no aviso que a linha editada à mão volta como a original, ao lado da alterada | O limite (d) já está neste documento; `protocolo.md` não é arquivo desta correção. Destino: `TODO.md`, na mesma linha do primeiro item. |
| revisor-geral, 2ª | Apagar o `.tmp` quando o `writeFileSync` do temporário falhar (`try`/`finally`), para não acumular em `.processo/` | `TODO.md`, na linha (X6, retro, M2, resto da correção), junto com a limpeza de `.tmp` antigo que o privacy-guardian e o infra-guardian também citam. O órfão fica em `.processo/`, local e fora do commit, e a cópia segue íntegra. |
| revisor-geral, 2ª / test-engineer, 2ª | Os dois casos da trava esperam 2500 ms e dão o processo por vivo se ele não terminou: numa máquina carregada a mutação "sem trava" pode sobreviver por tempo. Segurar a trava até o `comTrava` desistir (10 s) e afirmar saída diferente de 0 e documento intacto | `TODO.md`, mesma linha: é mudança de desenho do teste, e o portão da correção já provou as 22 mutações vermelhas nesta máquina. |
| test-engineer, 2ª | Comentário no caso em paralelo apontando para os dois casos da trava, que são os que provam a trava | `TODO.md`, mesma linha. |
| test-engineer, 2ª | O caso em paralelo não afirma o que o `portao` fez (devolveu a linha ou não achou nada a devolver) | `TODO.md`, mesma linha. |
| conformidade-reviewer, 2ª | A comparação do veredito da cópia com o do documento (item (a) do `TODO.md`) precisa **recusar** o commit, e não só avisar: REPROVADA trocada à mão por APROVADA anula o veto sem rastro | Já está no `TODO.md`, item (a), e é decisão da retro; o texto do item passou a dizer "recusa". |
| infra-guardian, 2ª / privacy-guardian, 2ª | Citar o `.tmp` órfão e a cópia sem prazo (limite (e)) na mesma linha da retro | `TODO.md`, mesma linha. |

## Mutações

--faltando: 0 linhas (22 blocos, 1 motivos)

Motivo da linha de `copia.length === 0`, em `restaurarRevisoes`: o termo só poupa ler o documento; com a cópia vazia `devolverRevisoesPerdidas` não acha nada a devolver e nada se escreve, então tirá-lo deixa todos os casos verdes. O outro termo (`!existsSync(caminho)`) tem bloco.

- `copia.length === 0`

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/revisoes-nao-se-perdem.test.ts › documento que nunca teve rodada registrada: nada a devolver
-  return existsSync(caminho) ? readFileSync(caminho, 'utf8').split('\n').filter((linha) => linha.startsWith('|')) : []
+  return readFileSync(caminho, 'utf8').split('\n').filter((linha) => linha.startsWith('|'))
```

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/revisoes-nao-se-perdem.test.ts › documento sem tabela: nenhuma cópia é gravada
falha: toBe(false)
-  if (linhas.length === 0) return
+  if (linhas.length === 9) return
```

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/revisoes-nao-se-perdem.test.ts › linha que o documento tem e a cópia não: fica, depois das da cópia
-  if (devolvidas.length === 0) return { conteudo, devolvidas }
+  if (devolvidas.length === 99) return { conteudo, devolvidas }
```

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/revisoes-nao-se-perdem.test.ts › cabeçalho da seção reescrito: não vira linha de rodada, e o da cópia volta uma vez só
-  const tabela = [...copia, ...atuais.filter((linha) => ehRodada(linha) && !daCopia.has(linha))]
+  const tabela = [...copia, ...atuais.filter((linha) => !daCopia.has(linha))]
```

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/revisoes-nao-se-perdem.test.ts › texto da seção e o que vem antes da tabela ficam como estavam
-  const tabela = [...copia, ...atuais.filter((linha) => ehRodada(linha) && !daCopia.has(linha))]
+  const tabela = [...copia, ...atuais.filter((linha) => ehRodada(linha))]
```

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/revisoes-nao-se-perdem.test.ts › documento sem a seção e sem quebra de linha no fim: a seção nasce numa linha só dela
-  const base = conteudo.endsWith('\n') ? conteudo : `${conteudo}\n`
+  const base = conteudo
```

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/revisoes-nao-se-perdem.test.ts › documento sem a seção e sem quebra de linha no fim: a seção nasce numa linha só dela
-  if (inicio === -1) return { conteudo: `${base}${titulo}\n${TEXTO_SECAO}\n\n${tabela.join('\n')}\n`, devolvidas }
+  if (inicio === -2) return { conteudo: `${base}${titulo}\n${TEXTO_SECAO}\n\n${tabela.join('\n')}\n`, devolvidas }
```

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/revisoes-nao-se-perdem.test.ts › seção sem nenhuma linha de tabela: a tabela entra no fim da seção
-  const antes = primeira === -1 ? [...linhas.slice(0, -1), ''] : linhas.slice(0, primeira)
+  const antes = linhas.slice(0, primeira)
```

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/revisoes-nao-se-perdem.test.ts › seção sem nenhuma linha de tabela: a tabela entra no fim da seção
-  const depois = primeira === -1 ? [''] : linhas.slice(marcas.lastIndexOf(true) + 1)
+  const depois = linhas.slice(marcas.lastIndexOf(true) + 1)
```

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/revisoes-nao-se-perdem.test.ts › o aviso conta as linhas no singular e no plural, e diz "a tabela" quando só o cabeçalho sumiu
-  const quantas = rodadas > 0 ? `${String(rodadas)} linha${rodadas === 1 ? '' : 's'} da tabela` : 'a tabela'
+  const quantas = rodadas > 9 ? `${String(rodadas)} linha${rodadas === 1 ? '' : 's'} da tabela` : 'a tabela'
```

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/revisoes-nao-se-perdem.test.ts › o aviso conta as linhas no singular e no plural, e diz "a tabela" quando só o cabeçalho sumiu
-  const quantas = rodadas > 0 ? `${String(rodadas)} linha${rodadas === 1 ? '' : 's'} da tabela` : 'a tabela'
+  const quantas = rodadas > 0 ? `${String(rodadas)} linha${rodadas === 9 ? '' : 's'} da tabela` : 'a tabela'
```

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/revisoes-nao-se-perdem.test.ts › cópia de um documento que já não existe: nada a devolver, e nada é criado
-  if (copia.length === 0 || !existsSync(caminho)) return []
+  if (copia.length === 0) return []
```

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/revisoes-nao-se-perdem.test.ts › sem a seção: devolve ao disco, recusa dizendo o que fez e manda preparar o documento de novo
-  if (devolvidas.length > 0) writeFileSync(caminho, conteudo)
+  if (devolvidas.length < 0) writeFileSync(caminho, conteudo)
```

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/revisoes-nao-se-perdem.test.ts › tabela inteira: o documento não muda e ninguém é avisado
falha: toEqual([])
-  if (devolvidas.length > 0) avisar?.(avisoDeRevisoesDevolvidas(documento, devolvidas))
+  if (devolvidas.length <= 0) avisar?.(avisoDeRevisoesDevolvidas(documento, devolvidas))
```

```mutacao
arquivo: tools/processo/portao.ts
teste: tools/processo/revisoes-nao-se-perdem.test.ts › commit sem marca de tarefa nem de correção: o portão não procura documento
falha: not.toThrow()
-  if (!documento || 'erro' in documento) return null
+  if ('erro' in documento) return null
```

```mutacao
arquivo: tools/processo/portao.ts
teste: tools/processo/revisoes-nao-se-perdem.test.ts › correção que não tem documento: a recusa é a de sempre, e nada é devolvido
falha: not.toThrow()
-  if (!documento || 'erro' in documento) return null
+  if (!documento) return null
```

```mutacao
arquivo: tools/processo/portao.ts
teste: tools/processo/revisoes-nao-se-perdem.test.ts › sem a seção: devolve ao disco, recusa dizendo o que fez e manda preparar o documento de novo
-  if (devolvidas.length === 0) return null
+  if (devolvidas.length > 0) return null
```

```mutacao
arquivo: tools/processo/portao.ts
teste: tools/processo/revisoes-nao-se-perdem.test.ts › sem a seção: devolve ao disco, recusa dizendo o que fez e manda preparar o documento de novo
-  if (perdidas !== null) return perdidas
+  if (perdidas === null) return perdidas
```

```mutacao
arquivo: tools/processo/portao.ts
teste: tools/processo/revisoes-nao-se-perdem.test.ts › duas funcionalidades com o mesmo 9_task.md: o commit da tarefa 9.0 sem o caminho acha a da árvore alterada e a devolve
-  const documento = documentoDaMensagem(mensagem, raiz, alterados)
+  const documento = documentoDaMensagem(mensagem, raiz, [])
```

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/revisoes-nao-se-perdem.test.ts › com a trava do documento tomada, o portão do commit espera: não escreve no documento até ela soltar
falha: not.toContain('## Revisões')
-  return comTrava(join(raiz, documento), () => restaurarRevisoes(raiz, documento))
+  return restaurarRevisoes(raiz, documento)
```

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/revisoes-nao-se-perdem.test.ts › com a trava do documento tomada, o registrar do revisor espera: não devolve a linha até ela soltar
falha: not.toContain('## Revisões')
-  comTrava(caminho, () => {
-    restaurarAvisando(raiz, relativo, avisar)
+  restaurarAvisando(raiz, relativo, avisar)
+  comTrava(caminho, () => {
```

```mutacao
arquivo: tools/processo/documento-de-revisao.ts
teste: tools/processo/revisoes-nao-se-perdem.test.ts › a cópia é gravada por arquivo novo e renomeado, e nenhum temporário fica
falha: not.toBe(antes)
-  const temporario = `${caminho}.${String(process.pid)}.tmp`
-  writeFileSync(temporario, `${linhas.join('\n')}\n`)
-  renameSync(temporario, caminho)
+  writeFileSync(caminho, `${linhas.join('\n')}\n`)
```

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-20 23:41:18 | 2026-11-20 23:41:34 | `tenancy-guardian` | 1 | APROVADO | aa77a58f392e4fb8e |
| 2026-11-20 23:41:20 | 2026-11-20 23:41:46 | `privacy-guardian` | 1 | APROVADO | a6a5d05cb2ec1cb0d |
| 2026-11-20 23:41:21 | 2026-11-20 23:41:46 | `conformidade-reviewer` | 1 | APROVADO | ad0a03702c3dc3695 |
| 2026-11-20 23:41:22 | 2026-11-20 23:42:10 | `infra-guardian` | 1 | APROVADO | a777cf76b7929ad6e |
| 2026-11-20 23:41:16 | 2026-11-20 23:42:31 | `revisor-geral` | 1 | REPROVADO | a23d8f3bc1d8ce1bf |
| 2026-11-20 23:41:17 | 2026-11-20 23:42:42 | `test-engineer` | 1 | REPROVADO | af962531f04bcef41 |
| 2026-11-21 00:10:30 | 2026-11-21 00:10:57 | `revisor-geral` | 2 | APROVADO | abed2fba888d51858 |
| 2026-11-21 00:10:53 | 2026-11-21 00:11:10 | `tenancy-guardian` | 2 | APROVADO | a3797d58ea5849045 |
| 2026-11-21 00:11:03 | 2026-11-21 00:11:19 | `privacy-guardian` | 2 | APROVADO | a9cf686fe9908bc3f |
| 2026-11-21 00:11:13 | 2026-11-21 00:11:29 | `conformidade-reviewer` | 2 | APROVADO | a4c3f3be3deeade34 |
| 2026-11-21 00:11:23 | 2026-11-21 00:11:40 | `infra-guardian` | 2 | APROVADO | abce49c1f08ad3198 |
| 2026-11-21 00:10:43 | 2026-11-21 00:12:21 | `test-engineer` | 2 | APROVADO | a2637926954e1a78a |
