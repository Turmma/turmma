# Correção — o commit de código de processo passa em sessão do Orquestrador, e o censo do e2e lê só execução toda verde

**Origem:** retro da F4b (classificacao-bncc), itens "(F4b, retro, M3)" e "(F4b, retro, M4)" do `TODO.md`, numa correção só. Na F4b, `3209137c` e `080e774f` (commits do Orquestrador com `docs/aia/ouro-retido/`) deixaram o `verificar` vermelho em 14 execuções e o censo cego por três dias.
**Subagentes obrigatórios:** `infra-guardian`, `revisor-geral`, `test-engineer`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`

## Sintoma

1. **M3.** O Orquestrador commitou arquivo de processo (`docs/aia/ouro-retido/`) sem `(tarefa N.0)` nem `(correção <slug>)`, e o hook deixou passar: a `decidirCommit` só conta o código de processo (`ehCodigoParaAEsteira`) em sessão de papel, e o Orquestrador não tem papel. A esteira, que conta em todo commit, recusou depois (`conferir-entregas`), 14 execuções vermelhas seguidas.
2. **M4.** O `esteira.ts --censo` lia a última execução **verde** da branch. Com o `verificar` vermelho por dias, nenhuma execução era verde, e o censo do prazo do e2e respondia "nenhuma execução verde" (ou lia uma de dias antes), embora o e2e de todas estivesse verde.

## Fora desta correção

nada

## Causa

1. `arquivosDeCodigo` (`tools/processo/portao.ts`) decide pelo papel: `ehPapelDoTime(papel) ? ehCodigoParaAEsteira : PASTAS_DE_CODIGO`. O `PreToolUse` dispara em **toda** sessão do Claude Code, e o Orquestrador é uma delas; só o git hook nativo (`hook-git.ts`) e o terminal do Joaquim não passam por ele. A `decidirCommit` não tinha como dizer "esta decisão é a do `PreToolUse`".
2. `ultimaVerde` (`tools/processo/esteira.ts`) filtra `estado === 'verde'`, e o estado é o da execução inteira: um job vermelho fora do e2e (o `verificar`) tira a execução do censo, embora as onze fatias de e2e e os onze relatórios estejam lá.

## Teste que reproduz

M3, `tools/processo/revisoes.test.ts`, no `describe` "RF16: o código de processo exige revisão, em sessão de papel e na do Orquestrador": `pelo PreToolUse: o commit com tools/ é recusado com e sem papel`, `o commit do Orquestrador só com docs/aia/ouro-retido/x.json é recusado; o mesmo com (correção …), revisado, é aceito`, `o Orquestrador conta o mesmo código que a esteira`, `pelo caminho do hook, o papel vem de CLAUDE_CODE_AGENT` e `fora do PreToolUse, sem papel … continua passando`. Contra o `portao.ts` do HEAD ficaram vermelhos 4 casos (os quatro primeiros; o quinto é a metade que não muda).

M4, `tools/processo/esteira.test.ts`, no `describe` "o censo do prazo do e2e (RF9, M4 da retro da F4b)": `a rodando e a cancelada ficam de fora…`, `a execução vermelha só no verificar, com o e2e todo verde, é a lida…`, `o job de e2e pulado ou cancelado não vale pela fatia…`, `a execução com o e2e verde sem o artefato de uma fatia sai 2…`, `sem nenhuma execução com o e2e verde não há o que ler`, e `os jobs do gh vêm com nome e conclusão`. Vermelhos contra o `esteira.ts` do HEAD (6 casos, por falta de `ultimaComE2eVerde` e `jobsDoGh`).

`tools/processo/hook-portao.test.ts`: o "sem papel, passa calado" do desvio do git hook deixa de valer para o caso do `-a`, que leva o `tools/` da cópia e, fora de papel, é recusado como código sem marca (e não como desvio). O caso tem entrada própria na tabela `negados` (`levaOTools`) e resultado exato, sem papel e com `general-purpose`. `tools/ci/esteira.test.ts` ganha `o nome do job de e2e começa pelo prefixo que o censo procura`.

## Correção

`tools/processo/portao.ts`:

- `EntradaDoCommit.sessaoDoClaudeCode?: boolean`: a decisão é a do `PreToolUse`, que só dispara em sessão do Claude Code. O `bloqueioDoCommit` (o `PreToolUse`) a passa `true`; o git hook nativo e os testes de decisão pura não a passam.
- `contaOProcesso(entrada)`: `ehPapelDoTime(papel) || sessaoDoClaudeCode`. `arquivosDeCodigo` a usa no lugar do papel sozinho, pela mesma `ehCodigoParaAEsteira` da esteira: uma lista só.
- `bloqueioDoCommitSemDocumento(entrada)`: em sessão sem papel (o Orquestrador), a mensagem mantém o começo de sempre e acrescenta o caminho: abrir a correção (`/corrigir`; `docs/aia/ouro-retido/` leva o `conformidade-reviewer`) ou pedir ao Joaquim o commit no terminal dele, com `Fora do processo:`. A do papel não muda.
- O commit com `(correção <slug>)` do Orquestrador segue o caminho de sempre (`bloqueioDoDocumento`): os revisores da linha e o carimbo.

`tools/processo/esteira.ts`:

- `ultimaVerde` sai; entra `ultimaComE2eVerde(execucoes, jobsDe)`: a execução terminada mais nova (`terminou`: verde ou vermelha; a rodando e a cancelada ficam de fora) cujos jobs `e2e <fatia>/<total> (…)` de **todas** as fatias de `FATIAS_DO_E2E` terminaram em `success`, com a lista do que não passou fora delas (`foraDoE2e`). `jobsDoGh` lê nome e conclusão de `gh run view --json jobs`; `jobsQueNaoPassaram` passa a usá-lo.
- `fazerOCenso` recebe `jobsDe` como quarto argumento, e `Censo` (`lista`, `incompleto`) leva `foraDoE2e`. `relatorioDoCenso` abre com `censo do e2e de <branch>: leu a execução <id> (<sha>), com o e2e verde; vermelho fora do e2e: <jobs>.` e, sem execução com o e2e verde, diz "nenhuma execução com o e2e verde da esteira para ler" (código 2, como antes).
- O `main` do `--censo` passa `gh run view --json jobs` como `jobsDe`.
- `prefixoDoJobDeE2e(fatia)`, exportado: o começo do nome do job de uma fatia (`e2e <fatia>/<total> `), que `e2eVerde` usa. `tools/ci/esteira.test.ts` confere que o `name` do job `e2e` do `ci.yml`, com a fatia no lugar de `matrix.fatia`, começa por ele: se o nome mudar, o censo não cai em silêncio em "nenhuma execução com o e2e verde".
- A mensagem de recusa fora de papel diz "Fora de papel do time (o Orquestrador, por exemplo)", porque o subagente de fora do time (`general-purpose`) também a recebe.
- Da rodada 1 (`.processo/ordens/2026-11-21-commit-de-processo-fora-de-tarefa-r1.md`): o `peloHook` do teste de paridade do RF14 volta à entrada sem `sessaoDoClaudeCode`, que é a do git hook de verdade; o `semDesvioNegado` do `hook-portao.test.ts` sai, e o caso do `-a` vira entrada própria da tabela `negados` (`levaOTools`), com dois casos de resultado exato (sem papel e `general-purpose`: o desvio não é negado e o commit é recusado como código sem marca), sem ramo; o comentário do `tools/ci/esteira.test.ts` que dizia "o censo só lê a execução verde" foi corrigido.

Docs: `passos/8-validacao-e-pouso.md` (o que o censo lê); `tasks/prd-harness/techspec.md` §5(e) (a sessão do Claude Code) e §5(f) (o censo: as terminadas, sem a rodando e sem a cancelada, com todos os jobs `e2e <fatia>/<total>` em `success`, o `foraDoE2e` no topo e a mensagem "nenhuma execução com o e2e verde"); `tasks/prd-harness/cenarios.md`, a linha RF9 (os quatro casos novos do censo) e o parágrafo RF16 (o Orquestrador pelo `PreToolUse`). O `TODO.md` marca a M3 e a M4. O comentário do `ci.yml` que diz "última execução verde" fica como está: tocar `.github/` exigiria o `privacy-guardian` por um comentário.

**Limite declarado.** O `PreToolUse` não vê o commit feito por `env -u`, script ou `sh -c` do Orquestrador, e o git hook nativo só julga papel; o que cobre esse caso é a esteira (`conferir-entregas`), como já era para o papel.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| infra-guardian (1ª) e test-engineer (1ª) | `ultimaComE2eVerde` faz um `gh run view --json jobs` por execução terminada, até as 30 do `--limit`: pedir os jobs junto no `gh run list`, ou parar depois de N execuções sem e2e verde, e anotar o teto | `TODO.md`, item novo: muda o custo e o contrato do `--censo`, e só pesa com e2e vermelho por muito tempo; não bloqueia |
| conformidade-reviewer (1ª) | gerar a mensagem de recusa do `portao.ts` a partir da tabela de `guardioes-por-caminho.ts`, em vez de escrever à mão que `docs/aia/ouro-retido/` leva o `conformidade-reviewer` | `TODO.md`, item novo: muda o desenho da mensagem e o seu teste; hoje a mensagem e a tabela concordam |
| conformidade-reviewer (1ª) | o commit por `env -u`, script ou `sh -c` não passa pelo `PreToolUse`; só a esteira (`conferir-entregas`) segura o ouro da AIA | `TODO.md`, uma linha de nota para a retro: já valia em sessão de papel, e o documento da correção já declara o limite; não é regressão |
| revisor-geral (1ª) | `tasks/prd-harness/prd.md:55`: o RF9 diz "na última esteira verde da spec"; nota de revisão apontando a M4 da F4b | `TODO.md`, item novo para o Arquiteto: o PRD é documento do Arquiteto, e a nota depende de o Joaquim aceitar a mudança |
| revisor-geral (1ª) | `.github/workflows/ci.yml:186`: o comentário "última execução verde" | `TODO.md`, junto do item acima: o documento já decidiu deixá-lo, porque tocar `.github/` caduca todos os revisores por um comentário (o revisor-geral mandou registrar para não se perder) |
| revisor-geral (2ª) | `tasks/prd-harness/techspec.md:196-197`: a frase "mesmo com outro job vermelho, o `verificar` por exemplo, que o `gh run view --json jobs` diz" ficou truncada; sugestão: "e o que estava vermelho vem do `gh run view --json jobs`" | `TODO.md`, na linha do `ci.yml:186`/PRD: é texto de documento já aprovado, e mexer agora anularia as seis aprovações por uma frase |
| test-engineer (2ª) | a seção de testes do documento da correção (linha 46) descreve os dois casos novos de `hook-portao.test.ts` sem citar o nome deles; citar "sem papel, passa calado: $etiqueta" e "sem papel (%s), o desvio com -a não é negado como desvio…" | `TODO.md`, junto da anterior: é a validação que liga linha a teste, e o RF não depende disso |
| test-engineer (2ª) | o texto "Fora de papel do time (o Orquestrador, por exemplo)" não é conferido por teste; só `/corrigir` e "Fora do processo:" | recusada: é texto, e as asserções de `revisoes.test.ts:2290-2293` já fixam o caminho que a mensagem dá; o revisor disse que não bloqueia |
| infra-guardian (2ª), conformidade-reviewer (2ª), revisor-geral (2ª) | repetem recomendações da 1ª rodada (custo de até 30 `gh run view`; mensagem gerada da tabela; `env -u`/`sh -c`; `ci.yml:186` e `prd.md:55`) | já estão na tabela "Recomendações sem aplicar" e no `TODO.md` |

## Mutações

--faltando: 0 linhas (22 blocos, 0 motivos). Cada bloco foi aplicado e rodado antes do pedido (o `conferirMutacoesDoDocumento` do portão). O `main` do `--censo` (a chamada do `gh run view`) e o comentário de `contaOProcesso` não têm condição nova.

```mutacao
arquivo: tools/processo/portao.ts
teste: tools/processo/revisoes.test.ts › é código: recusado
- return ehPapelDoTime(entrada.papel) || entrada.sessaoDoClaudeCode === true
+ return entrada.sessaoDoClaudeCode === true
```

```mutacao
arquivo: tools/processo/portao.ts
teste: tools/processo/revisoes.test.ts › o Orquestrador conta o mesmo código que a esteira
- return ehPapelDoTime(entrada.papel) || entrada.sessaoDoClaudeCode === true
+ return ehPapelDoTime(entrada.papel)
```

```mutacao
arquivo: tools/processo/portao.ts
teste: tools/processo/revisoes.test.ts › é código: recusado
- arquivos.filter((arquivo) => (contaOProcesso(entrada) ? ehCodigoParaAEsteira(arquivo) : PASTAS_DE_CODIGO.some((pasta) => arquivo.startsWith(pasta))))
+ arquivos.filter((arquivo) => (false ? ehCodigoParaAEsteira(arquivo) : PASTAS_DE_CODIGO.some((pasta) => arquivo.startsWith(pasta))))
```

```mutacao
arquivo: tools/processo/portao.ts
teste: tools/processo/revisoes.test.ts › pelo PreToolUse: o commit com tools/ é recusado com e sem papel
falha: not.toMatch(/Fora do processo/)
- if (ehPapelDoTime(entrada.papel)) return base
  return (
    `${base} Fora de papel do time
```

```mutacao
arquivo: tools/processo/portao.ts
teste: tools/processo/revisoes.test.ts › pelo PreToolUse: o commit com tools/ é recusado com e sem papel
- `${base} Fora de papel do time (o Orquestrador, por exemplo) o caminho é abrir a correção (/corrigir: \`docs/aia/ouro-retido/\` leva o \`conformidade-reviewer\`), ` +
+ `${base} Fora de papel do time (o Orquestrador, por exemplo) o caminho é abrir a correção (\`docs/aia/ouro-retido/\` leva o \`conformidade-reviewer\`), ` +
```

```mutacao
arquivo: tools/processo/portao.ts
teste: tools/processo/revisoes.test.ts › o commit do Orquestrador só com docs/aia/ouro-retido/x.json
- if (!documento) return bloqueioDoCommitSemDocumento(entrada)
+ if (!documento) return null
```

```mutacao
arquivo: tools/processo/portao.ts
teste: tools/processo/revisoes.test.ts › pelo PreToolUse: o commit com tools/ é recusado com e sem papel
    papel,
-   sessaoDoClaudeCode: true,
  }
```

```mutacao
arquivo: tools/processo/esteira.ts
teste: tools/processo/esteira.test.ts › o job pulado não conta como job que caiu
- .filter((job) => job.conclusion !== 'success' && job.conclusion !== 'skipped')
+ .filter((job) => job.conclusion !== 'skipped')
```

```mutacao
arquivo: tools/processo/esteira.ts
teste: tools/processo/esteira.test.ts › o job pulado não conta como job que caiu
- .filter((job) => job.conclusion !== 'success' && job.conclusion !== 'skipped')
+ .filter((job) => job.conclusion !== 'success')
```

```mutacao
arquivo: tools/processo/esteira.ts
teste: tools/processo/esteira.test.ts › a rodando e a cancelada ficam de fora
- return execucao.estado === 'verde' || execucao.estado === 'vermelha'
+ return execucao.estado === 'vermelha'
```

```mutacao
arquivo: tools/processo/esteira.ts
teste: tools/processo/esteira.test.ts › a execução vermelha só no verificar
- return execucao.estado === 'verde' || execucao.estado === 'vermelha'
+ return execucao.estado === 'verde'
```

```mutacao
arquivo: tools/processo/esteira.ts
teste: tools/processo/esteira.test.ts › a rodando e a cancelada ficam de fora
- return execucao.estado === 'verde' || execucao.estado === 'vermelha'
+ return true
```

```mutacao
arquivo: tools/processo/esteira.ts
teste: tools/processo/esteira.test.ts › o job de e2e pulado ou cancelado não vale pela fatia
falha: toBeUndefined()
- return FATIAS_DO_E2E.every((fatia) => jobs.some((job) => job.name.startsWith(prefixoDoJobDeE2e(fatia)) && job.conclusion === 'success'))
+ return FATIAS_DO_E2E.every((fatia) => jobs.some((job) => job.conclusion === 'success'))
```

```mutacao
arquivo: tools/processo/esteira.ts
teste: tools/processo/esteira.test.ts › o job de e2e pulado ou cancelado não vale pela fatia
falha: toBeUndefined()
- return FATIAS_DO_E2E.every((fatia) => jobs.some((job) => job.name.startsWith(prefixoDoJobDeE2e(fatia)) && job.conclusion === 'success'))
+ return FATIAS_DO_E2E.every((fatia) => jobs.some((job) => job.name.startsWith(prefixoDoJobDeE2e(fatia))))
```

```mutacao
arquivo: tools/processo/esteira.ts
teste: tools/processo/esteira.test.ts › a rodando e a cancelada ficam de fora
- if (e2eVerde(jobs)) return { execucao, foraDoE2e: jobsSemPassar(jobs) }
+ if (jobs.length >= 0) return { execucao, foraDoE2e: jobsSemPassar(jobs) }
```

```mutacao
arquivo: tools/processo/esteira.ts
teste: tools/ci/esteira.test.ts › o nome do job de e2e começa pelo prefixo que o censo procura
- return `e2e ${String(fatia)}/${String(FATIAS_DO_E2E.length)} `
+ return `e2e-${String(fatia)}/${String(FATIAS_DO_E2E.length)} `
```

```mutacao
arquivo: tools/processo/esteira.ts
teste: tools/processo/esteira.test.ts › sem nenhuma execução com o e2e verde não há o que ler
  const lida = ultimaComE2eVerde(execucoes, jobsDe)
- if (lida === undefined) return { tipo: 'sem-verde' }
  const { execucao, foraDoE2e } = lida
```

```mutacao
arquivo: tools/processo/esteira.ts
teste: tools/processo/esteira.test.ts › fatia sem artefato sai 2
- if (faltando.length > 0 || expiradas.length > 0) return { tipo: 'incompleto', execucao, foraDoE2e, faltando, expiradas }
+ if (expiradas.length > 0) return { tipo: 'incompleto', execucao, foraDoE2e, faltando, expiradas }
```

```mutacao
arquivo: tools/processo/esteira.ts
teste: tools/processo/esteira.test.ts › artefato expirado sai 2
- if (faltando.length > 0 || expiradas.length > 0) return { tipo: 'incompleto', execucao, foraDoE2e, faltando, expiradas }
+ if (faltando.length > 0) return { tipo: 'incompleto', execucao, foraDoE2e, faltando, expiradas }
```

```mutacao
arquivo: tools/processo/esteira.ts
teste: tools/processo/esteira.test.ts › o caso a 70% do prazo é listado
falha: not.toContain('vermelho fora do e2e')
- const vermelho = censo.foraDoE2e.length > 0 ? `; vermelho fora do e2e: ${censo.foraDoE2e.join('; ')}` : ''
+ const vermelho = true ? `; vermelho fora do e2e: ${censo.foraDoE2e.join('; ')}` : ''
```

```mutacao
arquivo: tools/processo/esteira.ts
teste: tools/processo/esteira.test.ts › sem nenhuma execução com o e2e verde não há o que ler
- if (censo.tipo === 'sem-verde') return `censo do e2e de ${branch}: nenhuma execução com o e2e verde da esteira para ler.`
  const alvo = `execução ${String(censo.execucao.id)} (${curto(censo.execucao.sha)})`
```

```mutacao
arquivo: tools/processo/esteira.ts
teste: tools/processo/esteira.test.ts › a lista vem do caso mais perto do prazo
- if (censo.casos.length === 0) return `${topo}censo do e2e de ${branch}, ${alvo}: nenhum caso acima de dois terços do prazo.`
  const linhas = censo.casos.map(
```

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-21 01:05:11 | 2026-11-21 01:05:21 | `tenancy-guardian` | 1 | APROVADO | aa591d0d3094b6bc4 |
| 2026-11-21 01:05:06 | 2026-11-21 01:05:22 | `infra-guardian` | 1 | APROVADO | a79320338c49f18dd |
| 2026-11-21 01:05:14 | 2026-11-21 01:05:31 | `conformidade-reviewer` | 1 | APROVADO | a65d3de4174a56592 |
| 2026-11-21 01:05:12 | 2026-11-21 01:05:38 | `privacy-guardian` | 1 | APROVADO | a4d215c29babc14d0 |
| 2026-11-21 01:05:08 | 2026-11-21 01:07:14 | `revisor-geral` | 1 | REPROVADO | ab1399d657ed6571e |
| 2026-11-21 01:05:09 | 2026-11-21 01:07:15 | `test-engineer` | 1 | APROVADO | a672b510bfc59d95f |
| 2026-11-21 01:25:52 | 2026-11-21 01:26:06 | `tenancy-guardian` | 2 | APROVADO | a77a4aa7734cf309f |
| 2026-11-21 01:25:56 | 2026-11-21 01:26:14 | `privacy-guardian` | 2 | APROVADO | a98e60074101d079d |
| 2026-11-21 01:25:38 | 2026-11-21 01:26:16 | `revisor-geral` | 2 | APROVADO | add994eea8050659d |
| 2026-11-21 01:25:48 | 2026-11-21 01:26:35 | `infra-guardian` | 2 | APROVADO | ac6ae2213e8d3a152 |
| 2026-11-21 01:26:00 | 2026-11-21 01:27:01 | `conformidade-reviewer` | 2 | APROVADO | a863fc837d9924749 |
| 2026-11-21 01:25:43 | 2026-11-21 01:27:28 | `test-engineer` | 2 | APROVADO | a8e7d7719ee8cb21e |
