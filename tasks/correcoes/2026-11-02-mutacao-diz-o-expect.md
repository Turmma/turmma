# Correção — o bloco de mutação não diz qual `expect` tem de cair, e vermelho em outra asserção passa como prova

**Origem:** retrospectiva da X8 (`tasks/prd-nomes-de-mercado/retro.md`, grupo A, proposta M1), item do `TODO.md` "(X8, retro, M1) O bloco de mutação diz qual `expect` tem de cair".
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`, `privacy-guardian`
<!-- Os guardiões vieram no PEDIDO do Orquestrador: nenhum além de test-engineer e revisor-geral. A correção toca `tools/processo/`, e é isso que torna o `revisor-geral` obrigatório (passo 5 de `corrigir`). A Mesa acrescentou o `privacy-guardian` na devolução da rodada 1: `tools/processo/mutacoes.ts` cita a regra 20 (item 17, no comentário de `prepararRelatorio`) e a tabela de `guardioes-por-caminho.ts` soma o guardião dela. -->

## Sintoma

A X8 teve cinco reprovações (3.0 duas vezes, 4.0, 7.0 e 10.0) por bloco `mutacao` cujo teste ficou vermelho pelo motivo errado: o caso tinha
mais de um `expect`, e caiu num anterior à cláusula (em geral uma positiva antes de uma `not.toContain`). O portão aceita qualquer caso que
rodou e falhou (`casoFalhouNoRelatorio`), e a única defesa era o parágrafo "Vermelho não basta" de `executar-task`, que pede para ler a saída
à mão.

## Fora desta correção

Nada: a árvore estava limpa.

## Causa

O bloco só diz o arquivo, o teste e o trecho. A corrida lê do relatório quantos casos falharam, nunca **onde**: `veredictoDaCorrida` devolve
`false` com qualquer caso vermelho, e o bloco não tem como dizer qual asserção ele espera ver cair. A informação existe no relatório (a pilha em
`failureMessages` do Vitest; `errors[].location` do Playwright) e não era lida.

## Teste que reproduz

`tools/processo/mutacoes.test.ts` › `a linha "falha:" diz qual expect tem de cair` (e os casos ao lado dele): vermelhos antes, porque `lerMutacoes`
não aceita a linha `falha:` e `conferirMutacoes` não a confere; verdes depois.

## Correção

`tools/processo/mutacoes.ts`:

- **O bloco ganha a linha `falha: <trecho>`**, opcional (`lerMutacoes` aceita `falha` ao lado de `arquivo`, `teste` e `projeto`). A `Mutacao` ganha o campo
  `falha`, só quando o bloco o declara, e por isso o carimbo (a impressão dos blocos) muda se o trecho muda, e os blocos antigos não mudam de impressão.
- **A corrida mutada recebe a asserção esperada** (`Rodar` ganha o quarto argumento, `FalhaEsperada`: o arquivo de teste e o trecho). Se um caso falhou
  (`casoFalhouNoRelatorio`), `falhaNaLinhaCerta` pega no relatório, para cada caso vermelho, a primeira linha do arquivo de teste em que ele caiu (a primeira
  linha do arquivo de teste na pilha de `failureMessages`, no Vitest; `errors[].location`, no Playwright, e a pilha da mensagem quando o erro foi lançado num
  apoio) e lê essa linha no arquivo de teste. Basta um caso cair numa linha com o trecho. Senão a corrida devolve `{ outra }`, com a linha que caiu e o texto
  dela, e `conferirMutacoes` recusa o bloco com "vermelho em outra asserção".
- **O trecho que não existe no arquivo de teste é recusado antes de qualquer corrida** (`recusaDaFalhaQueNaoExiste`).
- Sem a linha, nada muda: a corrida não recebe trecho e vale o vermelho de qualquer caso.
- Para a `conferirMutacoes` não passar do teto de 80 linhas, o que monta o motivo da recusa da mutada saiu para `motivoDaMutadaRecusada` (o texto das três
  recusas antigas é o mesmo). A leitura do relatório ficou em funções pequenas (`linhasDoVitest`, `resultadosFalhos`, `linhaDoErro`): a linha de base do
  `eslint-suppressions.json` não muda (as duas funções de complexidade que já estavam lá, `lerMutacoes` e `conferirMutacoes`, seguem as duas).

`.claude/skills/executar-task/SKILL.md` (passo 2, "Vermelho não basta") e `.claude/skills/corrigir/SKILL.md` (passo 4) passam a pedir a linha `falha:` em
toda asserção negativa, no lugar de ler a saída à mão. Sem a linha, o `executar-task` ainda manda ler.

O `falhaNaLinhaCerta` e o `veredictoDaCorrida` foram conferidos contra o Vitest e o Playwright de verdade (pilha e `location` na forma que cada um grava
hoje), nos dois casos reais de `mutacoes.test.ts`.

## Mutações

--faltando: 31 linhas (28 blocos, 6 motivos)

As linhas que o `--faltando` aponta e que não ganham bloco, com o motivo:

- `mutacoes.ts` `objeto` (a guarda de forma do JSON, `typeof valor === 'object' && valor !== null && !Array.isArray(valor)`): relatório de forma outra devolve
  `null` e cai no "não achei a linha"; tirar uma das condições dá o mesmo veredito em todo relatório que os dois leitores gravam, e o que se checa dela (que um
  relatório que não é objeto não quebra a leitura) é o que `lista` e os casos `'null'` e `'{}'` já provam.
- `mutacoes.ts` `linhasDoVitest`, o `?? null` do `.find(...)`: normaliza "nenhum frame" para `null`; sem ele o `undefined` passa pelo mesmo caminho do `null` em
  `falhaNaLinhaCerta` (mutação equivalente).
- `mutacoes.ts` `motivoDaMutadaRecusada`, as linhas `'estourou' || mutadaMs > prazo` e `'carga'`: movidas sem mudar de texto de `conferirMutacoes`, e os
  casos que as provam (`a mutada que passa do prazo, com o relógio injetado` e `vermelho por erro de carga`) são os que já valiam e seguem verdes.
- `mutacoes.ts` `veredictoDaCorrida`, o `existsSync(arquivo) ? … : null` e o `if (!casoFalhouNoRelatorio(...)) return 'carga'`: o mesmo, o que era uma linha
  ficou em duas; os casos de `rodarCalado lê o relatório de um teste que caiu` seguem verdes.

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › a linha "falha:" diz qual expect tem de cair
-   const cabecalho = /^(arquivo|teste|projeto|falha):\s*(.+?)\s*$/.exec(linha)
+   const cabecalho = /^(arquivo|teste|projeto):\s*(.+?)\s*$/.exec(linha)
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › a linha "falha:" diz qual expect tem de cair
    else if (cabecalho[1] === 'teste') teste = cabecalho[2] ?? null
-   else if (cabecalho[1] === 'falha') falha = cabecalho[2] ?? null
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › a linha "falha:" diz qual expect tem de cair
-     ...(falha ? { falha } : {}),
      antes,
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › a linha "falha:" diz qual expect tem de cair
falha: 'falha' in (mutacoes[1] ?? {})
-     ...(falha ? { falha } : {}),
+     ...({ falha: falha ?? undefined }),
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o caso que caiu numa asserção anterior é recusado
-   if (typeof corrida === 'object') {
+   if (false) {
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › a corrida mutada recebe o teste e o trecho
-   return mutacao.falha === undefined ? undefined : { teste: mutacao.teste, trecho: mutacao.falha }
+   return undefined
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › trecho que não existe no arquivo de teste é recusado
-   if (mutacao.falha === undefined || readFileSync(join(raiz, mutacao.teste), 'utf8').includes(mutacao.falha)) return null
+   return null
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › trecho que não existe no arquivo de teste é recusado
-     if (semTrecho !== null) {
+     if (false) {
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › o caso que caiu numa asserção anterior é recusado
-     if (motivo !== null) {
+     if (false) {
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › teste que continua verde sem a cláusula reprova
-     } else if (corridaMutada === true) {
+     } else if (false) {
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › vitest: pilha sem frame
-   return Array.isArray(valor) ? valor : []
+   return valor as unknown[]
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › vitest: o frame de outro arquivo
-   const frame = new RegExp(`(?:^|[\\s(/\\\\])${escapar(teste.replaceAll('\\', '/'))}:(\\d+):\\d+`).exec(pilha.replaceAll('\\', '/'))
+   const frame = new RegExp(`${escapar(teste.replaceAll('\\', '/'))}:(\\d+):\\d+`).exec(pilha.replaceAll('\\', '/'))
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › vitest: pilha sem frame
-   return frame ? Number(frame[1]) : null
+   return Number(frame?.[1])
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › vitest: a primeira linha do arquivo de teste na pilha
-       if (dados?.status !== 'failed') continue
+       if (dados?.status === 'failed') continue
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › playwright: o caso que estourou o tempo
-   if (typeof file !== 'string') return false
+   if (false) return false
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › playwright: errors
-   return achado === alvo || achado.endsWith(`/${alvo}`) || alvo.endsWith(`/${achado}`)
+   return achado === alvo || achado.endsWith(`/${alvo}`)
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › playwright: errors
-   return achado === alvo || achado.endsWith(`/${alvo}`) || alvo.endsWith(`/${achado}`)
+   return achado === alvo || alvo.endsWith(`/${achado}`)
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › playwright: errors
-   return achado === alvo || achado.endsWith(`/${alvo}`) || alvo.endsWith(`/${achado}`)
+   return achado.endsWith(`/${alvo}`) || alvo.endsWith(`/${achado}`)
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › playwright: o caso que estourou o tempo
-     .filter((resultado): resultado is Record<string, unknown> => resultado?.status === 'failed' || resultado?.status === 'timedOut')
+     .filter((resultado): resultado is Record<string, unknown> => resultado?.status === 'failed')
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › playwright: o caso que estourou o tempo
-   const erro = objeto(lista(resultado.errors)[0] ?? resultado.error)
+   const erro = objeto(lista(resultado.errors)[0])
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › playwright: errors
-   if (ehOArquivo(local?.file, teste) && typeof local?.line === 'number') return local.line
+   if (false) return local.line
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › playwright: o caso que estourou o tempo
-   return pilha === undefined ? null : linhaNaPilha(pilha, teste)
+   return linhaNaPilha(pilha as string, teste)
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › vitest: pilha sem frame
-     relatorio = JSON.parse(texto ?? '')
+     relatorio = JSON.parse(texto as string)
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › playwright: errors
-   const linhas = leitor === 'vitest' ? linhasDoVitest(relatorio, teste) : linhasDoPlaywright(relatorio, teste)
+   const linhas = linhasDoVitest(relatorio, teste)
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › vitest: caso que caiu numa asserção anterior é recusado
-   if (linhas.some((linha) => linha !== null && (fonte[linha - 1] ?? '').includes(trecho))) return null
+   if (linhas.some((linha) => linha !== null)) return null
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › vitest: pilha sem frame
-   if (primeira === undefined) return `não achei no relatório a linha de ${teste} em que o caso caiu`
+   if (false) return `não achei no relatório a linha de ${teste} em que o caso caiu`
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › vitest, com "falha:"
-   if (!falha) return false
+   if (false) return false
```

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › vitest, com "falha:"
-   return outra === null ? false : { outra }
+   return false
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisor-geral 1ª | `veredictoDaCorrida`: sem relatório, devolver `{ outra: … }` quando há `falha:` | Muda comportamento. `TODO.md`: hoje `comandoDoTeste` só gera comandos de vitest e de playwright, então o caminho não é alcançável; fecha se surgir tipo novo de teste |
| revisor-geral 1ª | Apertar `ehOArquivo` (`alvo.endsWith`) | Muda comportamento. Fica o comentário sobre o limite; apertar, no `TODO.md` |
| test-engineer 1ª | Trecho ambíguo: recusar `falha:` que aparece em mais de uma linha do arquivo de teste | Muda comportamento e contrato do bloco. `TODO.md`, junto de "(X8, retro, M1)", com o exemplo `toContain('x')` / `.not.toContain('x')` |
| test-engineer 1ª | A obrigação de `falha:` em asserção negativa só está no texto das skills; um aviso do `--faltando` ou do portão a cobraria | Ferramenta nova. `TODO.md` |
| test-engineer 1ª | Mutar o próprio arquivo de teste: recusar o `falha:` nesse caso | Muda comportamento. Fica o comentário sobre o limite; a recusa, no `TODO.md` |
| revisor-geral 1ª | `.claude/skills/criar-tasks/task-template.md:156`: a seção "Mutações" do template não fala de `falha:` | Arquivo que a correção não toca. `TODO.md`, ou a próxima tarefa que mexer no template |
| revisor-geral 1ª | `docs/processo-licoes.md:42`: a defesa da X8 ainda é "ler a linha do `expect` que caiu" | Arquivo que a correção não toca. `TODO.md`; o texto é da retrospectiva |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-02 23:11:23 | 2026-11-02 23:11:54 | `privacy-guardian` | 1 | APROVADO | ab0292e4ac39ff56a |
| 2026-11-02 23:11:21 | 2026-11-02 23:13:00 | `revisor-geral` | 1 | APROVADO | a38f4ac50bec34619 |
| 2026-11-02 23:11:20 | 2026-11-02 23:13:46 | `test-engineer` | 1 | APROVADO | a32cf52b97c768e25 |
| 2026-11-02 23:20:02 | 2026-11-02 23:20:38 | `revisor-geral` | 2 | APROVADO | a12cd673d774b7536 |
