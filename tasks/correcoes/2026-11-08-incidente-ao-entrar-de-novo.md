# Correção — o `page.goto` da primeira carga fica parado até o fim do caso (terceira vez), e o caso "entrar de novo" de `incidentes.spec.ts` cai com ele

**Origem:** esteira run `42501386033` (commit `4832c76b`, `spec/acesso-e-convites`), job `e2e 3/9`, `e2e/incidentes.spec.ts:295` (`chromebook`): `sair com o aviso adiado e entrar de novo…` estoura os 150 s em `page.waitForResponse` e `page.goto`; os outros 195 casos do shard passaram (22,9 min). Pedido do Orquestrador em 08/11/2026.
**Subagentes obrigatórios:** `test-engineer`, `infra-guardian`, `revisor-geral`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`
<!-- Os três primeiros vieram no PEDIDO do Orquestrador. `revisor-geral` já é obrigatório em toda correção. Os outros três a Mesa exigiu na devolução: a árvore altera arquivo de `e2e/`, e todo arquivo de `e2e/` pede os quatro guardiões (`tools/processo/guardioes-por-caminho.ts`). -->

## Sintoma

```
Error: page.goto: Test timeout of 150000ms exceeded.
  - navigating to "http://127.0.0.1:28090/entrar", waiting until "load"
> 117 |   await page.goto('/entrar')       (entrar, incidentes.spec.ts)
    302 |     await entrar(page, hasTouch, coordenadora)
Error: page.waitForResponse: Test timeout of 150000ms exceeded.   (a espera do segredo, aberta antes do goto)
```

O caso leva 16 a 28 s no `chromebook` nos vizinhos do mesmo job (`#59`, `#60`, `#62` a `#67`); aqui o primeiro passo ficou parado os 150 s do caso (`test.setTimeout(150_000)`, pelos 30 s do relógio do segundo fator). O `page.waitForResponse` é só a consequência: o `goto` nunca terminou, a página nunca pediu `/v1/conta/mfa/configurar`.

## Fora desta correção

Nada: o pedido veio sem arquivos da tarefa em curso, e a árvore estava limpa. A correção `e2e-decima-fatia` (dez fatias no lugar de nove) não está nesta branch e não é desta.

## Causa

**A trava da primeira carga sob a rede do perfil, pela terceira vez; não é o caso, a tela, a API nem o servidor da web.** O traço da esteira (`traco-do-e2e-3`, `trace.zip`, lido nesta correção) mostra, depois do `goto`:

- o documento `/entrar` respondeu 200 em 583 ms, e quatro `parte-*.js` (`coerce`, `jsx-runtime`, `Button`, `login`) em 0,6 a 0,8 s: o servidor (`vite preview`, `Keep-Alive: timeout=5`) atendeu;
- os outros **13 pedidos** (`index-*.js`, `parte-iso` e mais dez `parte-*.js`, o CSS) foram criados no mesmo instante e **nunca receberam resposta** nos 150 s do caso. Neles o traço não tem `headersSize` nem os cabeçalhos que o navegador manda na rede (`headersSize: -1`, só `Origin`, `Referer` e os `sec-ch-ua` do renderer): não saíram do navegador. O servidor nunca os viu;
- o JavaScript da página nunca chegou a rodar, e o `load` não veio. O `waitForResponse` aberto antes do `goto` esperou um pedido a `/v1/conta/mfa/configurar` que a página nunca fez.

É a **mesma assinatura** das duas travas anteriores (`2026-10-17-casca-carregando-estoura-o-goto`, `2026-10-26-areas-entrar-estoura-o-prazo`), até nos quatro arquivos que passam antes de tudo parar (`coerce`, `jsx-runtime`, `Button`, `login`). A carga normal do mesmo caso nos vizinhos do job é de uns 3 s, e a investigação de 29/10 (1.200 cargas em contextos novos, nas quatro condições de CPU e rede) **não a reproduziu** nem sob a rede do perfil nem sem ela: não há fio de código da web, da API ou do caso para consertar. O caso `incidentes.spec.ts:295` não tem nada de particular: é o primeiro `page.goto('/entrar')` dele, como o de uns 98 outros (248 `page.goto` no e2e), e a diferença desta vez é só o prazo de 150 s que o caso declara (o segundo fator espera a virada do relógio de 30 s), que faz a trava custar 2,5 min de esteira em vez de 30 s.

**O que a terceira ocorrência muda, e a decisão de 29/10 que esta correção reverte.** Cada correção anterior deixou escrito o próximo passo: a de 17/10, "se aparecer em outro caso, a investigação vai para o servidor estático, e não para mais um `carregarSemRedeLenta`"; a de 26/10, "se aparecer uma terceira vez, sobe para o harness (`e2e/support/profiles.ts`), com nova tentativa da primeira navegação, **se confirmado**"; a de 29/10 mediu 1.200 cargas, não reproduziu e **recusou** a nova tentativa: "não há confirmação, e uma nova tentativa no `perfis.ts` esconderia a trava sem a explicar (e esconderia também o que a regra 50.1 manda medir). O `perfis.ts` não ganha nova tentativa", com o primeiro passo da terceira vez sendo "ler o traço".

**Esta correção reverte a recusa de 29/10, e diz isso.** A condição de 26/10 ("se confirmado") **continua sem cumprir**: a causa dentro do Chromium não foi provada, e esta correção não finge o contrário. O que mudou desde 29/10 é o custo e o instrumento:

- O traço foi lido (o primeiro passo de 29/10), e é o mesmo dos dois anteriores, até nos quatro arquivos que passam antes de tudo parar: três ocorrências em 22 dias, o servidor excluído (26/10) e a lentidão excluída (29/10). Sem fio de código para puxar, a investigação não tem para onde ir sem reproduzir, e reproduzir não deu em 1.200 cargas.
- O custo: o caso de hoje parou 150 s e derrubou a esteira da spec inteira. Não consertar é deixar uma trava rara custar um shard por vez.
- A razão da recusa era a trava **ficar escondida**, e é isso que o instrumento desta correção desfaz: cada ocorrência vira a anotação `primeira-carga-travou` do caso **e**, na esteira, uma linha `::warning title=primeira-carga-travou::<spec>:<linha> (<projeto>) <caminho>…` que o GitHub põe na execução, visível também quando o caso passa (o `list` e o `github` não mostram anotação de caso verde, e o censo não a lê; por isso a anotação sozinha não bastava). O caminho vai sem `?` nem `#`: é onde moram o token do convite e o do bilhete.
- O que a regra 50.1 mede continua medido: a primeira carga normal é de 3 a 4 s e a nova tentativa só começa depois de 15 s; carga acima disso não passa em silêncio, aparece como aviso na execução. **O que fica de fora**: a segunda navegação carrega com o cache cheio, então uma regressão que leve a primeira carga a mais de 15 s se mostra só como aviso repetido, e não como caso vermelho. O orçamento do build (`tools/ci/tamanho-web.test.ts`) é quem segura o tamanho do que se baixa, e o comentário de `gotoComNovaTentativa` diz isso a quem copiar o fixture.

O remédio é do harness, no `page` do `profiles.ts` que todo spec de tela usa: o `page.goto` espera o `load` por 15 s; se o prazo passa sem `load` (e o erro é de prazo, não de rede), o fixture registra a ocorrência como acima e passa por `about:blank` (que larga o documento preso e os pedidos dele; sem ela, o `goto` à mesma URL com `#` é navegação dentro do mesmo documento, que o Playwright resolve sem recarregar, com resposta `null`, e a página presa continua presa) e tenta **uma** vez mais, sem prazo próprio. Se a segunda tentativa também não termina, o caso falha como falhava. Quem passa `timeout` ao `goto` decidiu o prazo e não ganha nova tentativa; o comentário diz que caso cuja abertura gasta algo de uso único (convite, bilhete) ou confere a contagem de pedidos ao abrir deve passá-lo. Só o `page` do fixture tem a nova tentativa: as três travas foram nele, e página de `context.newPage()` navega como antes (se a trava aparecer lá, é correção nova).

**O que a correção não prova.** Que uma segunda navegação desfaça a trava de verdade: ela não se reproduz, então só a esteira diz, e o aviso é o instrumento para ler isso. **Tentei refazer a limitação de rede (`Network.emulateNetworkConditions`) antes de tentar de novo, e tirei**: com o documento preso, o CDP não respondeu, e o caso ficou parado até o prazo dele. Era hipótese sem prova e podia piorar a trava.

## Teste que reproduz

**Do sintoma, não da causa** (a trava não se reproduz, ver "Causa"). Cinco casos em `e2e/guardas.spec.ts` (os quatro da trava e, sem `page`, um do aviso padrão), num bloco que encurta o prazo do fixture a 1,5 s (`test.use({ prazoDaNavegacaoMs })`) e prende na rota os scripts de cada navegação que o caso nomeia (o documento chega e o `goto` fica sem `load`, o mesmo sintoma do traço; o tempo é o da rota):

1. `o goto que não termina no prazo é refeito, termina, anota só o caminho e avisa a esteira`: status 200, 2 documentos, uma anotação e uma linha `::warning` entregue ao emissor do guarda (`avisosGuardados`), com o caminho `/` e sem a query nem o fragmento de `/#token-do-convite?convite=a`; um espião de `process.stdout.write` que só guarda, sem repassar, prova que nenhuma linha `primeira-carga-travou` foi ao stdout real.
2. `a segunda tentativa é uma só e não tem prazo próprio…`: a segunda navegação só tem os scripts soltos 2,5 s depois, mais que o prazo da primeira; termina com 200, **2** documentos (nem 3) e uma anotação.
3. `quem passa o próprio prazo não ganha nova tentativa`: `timeout: 1000` rejeita com `Timeout 1000ms`, 1 documento, zero anotações.
4. `erro de rede que não é de prazo não é refeito nem anotado`: a primeira navegação aborta com `connectionrefused`; rejeita, 1 documento, zero anotações.
5. `o aviso padrão escreve a linha na esteira e não escreve nada fora dela` (sem `page`): `avisoDaEsteira({ GITHUB_ACTIONS: 'true' }, saidaFalsa)` deixa a linha de `linhaDoAviso` na saída falsa; com `{}` e com `{ GITHUB_ACTIONS: 'false' }` a saída falsa fica vazia. É um caso só, e não um por sentido, porque cada caso de e2e entra na conta do teto da fatia (7 s, `tools/ci/prazo-do-e2e.ts`) e a fatia 1 estava em 27 min dos 27 de folga: com dois casos (quatro, com os dois projetos) ela passava a 28 e o `tools/ci/esteira.test.ts` ficava vermelho.

Nenhum dos quatro casos do bloco da trava escreve no stdout, com ou sem `GITHUB_ACTIONS`: o guarda troca o emissor por um que guarda (`test.use({ avisoDaEsteira })`).

**Vermelho antes** (fixture do HEAD, `--timeout 12000`, `chromebook` e `celular`): o caso 1 dá `Error: page.goto: Test timeout of 12000ms exceeded.`, o mesmo erro da esteira. Os casos 3 e 4 passam antes e depois (guardam a cláusula nova contra o excesso), e o 2 depende da nova tentativa existir; os blocos de "Mutações" dão o vermelho de cada cláusula. O primeiro desenho do caso prendia o documento, e não os scripts, e deu `ERR_ABORTED` na segunda navegação (20 de 20): não era o sintoma do traço, e foi trocado.

## Correção

Só teste e fixture de e2e mudam; o produto não.

- `e2e/support/profiles.ts`: `gotoComNovaTentativa` e `descricaoDaTrava` (exportadas), a opção `prazoDaNavegacaoMs` (15 s por padrão), a opção `avisoDaEsteira` (o emissor da linha `::warning`; o padrão, `avisoDaEsteira(process.env, process.stdout)`, só escreve com `GITHUB_ACTIONS=true`), `linhaDoAviso` (a linha montada) e o `page` do `test` trocando o `page.goto` pela versão com uma nova tentativa, que anota `primeira-carga-travou` e entrega a linha ao emissor. O `page` não lê `process.env` nem escreve em `process.stdout`: quem os entrega é só a opção padrão, `avisoDaEsteira(process.env, process.stdout)`. O comentário diz o que a nova tentativa esconde e o que ela supõe. `loadUnthrottled` e a limitação de rede e de CPU não mudam.
- `e2e/guardas.spec.ts`: os cinco casos acima. O caso do perfil volta ao código que tinha (uma extração de função que a primeira versão fez foi desfeita, a pedido da Mesa).
- `TODO.md`: a seção "Da correção 2026-11-08-incidente-ao-entrar-de-novo", com as duas recomendações do `infra-guardian` (1ª). Não é código nem processo e não soma guardião.
- `incidentes.spec.ts` não muda: o caso é correto, e a trava é de qualquer `goto`.

## Mutações

--faltando: 0 linhas (0 blocos, 0 motivos)

O `--faltando` não lista nada (`e2e/support` não é código de produção), mas cada cláusula do fixture tem teste que a prova, e cada uma ganha o seu bloco (doze cláusulas, quinze blocos: as oito da primeira rodada e a anotação, a condição da esteira nos dois sentidos, a entrega ao emissor e a ligação do emissor padrão ao `process.env` e ao `process.stdout`; o décimo quinto bloco, o do stdout limpo, não prova cláusula do fixture: guarda o próprio guarda contra a regressão de escrever no stdout real).

Os dois blocos da condição `=== 'true'` e do `if (true)` citam o caso 5 (`o aviso padrão escreve a linha na esteira e não escreve nada fora dela`), e não o caso 1: a condição mudou de lugar, do `page` do fixture para o emissor padrão, e é o caso 5 que a chama nos dois sentidos. O bloco da ligação do padrão também cita o caso 5, que pede a opção padrão do fixture (`avisoDaEsteira: padrao`) com `GITHUB_ACTIONS` ligado e o `stdout` num espião que só guarda.

```mutacao
arquivo: e2e/support/profiles.ts
teste: e2e/guardas.spec.ts › o goto que não termina no prazo é refeito, termina, anota só o caminho e avisa a esteira
-    return await ir(url, { ...opcoes, timeout: prazoMs })
+    return await ir(url, opcoes)
```

```mutacao
arquivo: e2e/support/profiles.ts
teste: e2e/guardas.spec.ts › o goto que não termina no prazo é refeito, termina, anota só o caminho e avisa a esteira
     await ir('about:blank', { timeout: prazoMs })
-    return ir(url, opcoes)
+    throw erro
```

```mutacao
arquivo: e2e/support/profiles.ts
teste: e2e/guardas.spec.ts › quem passa o próprio prazo não ganha nova tentativa
-  if (opcoes?.timeout !== undefined) return ir(url, opcoes)
   try {
```

```mutacao
arquivo: e2e/support/profiles.ts
teste: e2e/guardas.spec.ts › erro de rede que não é de prazo não é refeito nem anotado
-    if (!(erro instanceof errors.TimeoutError)) throw erro
     aoTravar(url)
```

```mutacao
arquivo: e2e/support/profiles.ts
teste: e2e/guardas.spec.ts › o goto que não termina no prazo é refeito, termina, anota só o caminho e avisa a esteira
-    await ir('about:blank', { timeout: prazoMs })
     return ir(url, opcoes)
```

```mutacao
arquivo: e2e/support/profiles.ts
teste: e2e/guardas.spec.ts › a segunda tentativa é uma só e não tem prazo próprio: ela espera o que a rota segurar, além do prazo da primeira
     await ir('about:blank', { timeout: prazoMs })
-    return ir(url, opcoes)
+    return ir(url, { ...opcoes, timeout: prazoMs })
```

```mutacao
arquivo: e2e/support/profiles.ts
teste: e2e/guardas.spec.ts › a segunda tentativa é uma só e não tem prazo próprio: ela espera o que a rota segurar, além do prazo da primeira
     await ir('about:blank', { timeout: prazoMs })
-    return ir(url, opcoes)
+    return gotoComNovaTentativa(ir, url, opcoes, prazoMs, aoTravar)
```

```mutacao
arquivo: e2e/support/profiles.ts
teste: e2e/guardas.spec.ts › o goto que não termina no prazo é refeito, termina, anota só o caminho e avisa a esteira
-  return `${alvo.split(/[?#]/)[0]}: sem load em ${prazoMs} ms; uma nova tentativa`
+  return `${alvo.split('?')[0]}: sem load em ${prazoMs} ms; uma nova tentativa`
```

```mutacao
arquivo: e2e/support/profiles.ts
teste: e2e/guardas.spec.ts › o goto que não termina no prazo é refeito, termina, anota só o caminho e avisa a esteira
-  return `::warning title=primeira-carga-travou::${onde} (${projeto}) ${descricao}\n`
+  return `::notice title=primeira-carga-travou::${onde} (${projeto}) ${descricao}\n`
```

```mutacao
arquivo: e2e/support/profiles.ts
teste: e2e/guardas.spec.ts › o goto que não termina no prazo é refeito, termina, anota só o caminho e avisa a esteira
-        testInfo.annotations.push({ type: 'primeira-carga-travou', description: descricao })
+        testInfo.annotations.push({ type: 'outra-coisa', description: descricao })
```

```mutacao
arquivo: e2e/support/profiles.ts
teste: e2e/guardas.spec.ts › o aviso padrão escreve a linha na esteira e não escreve nada fora dela
-      if (ambiente['GITHUB_ACTIONS'] === 'true') saida.write(linha)
+      if (ambiente['GITHUB_ACTIONS'] === 'false') saida.write(linha)
```

```mutacao
arquivo: e2e/support/profiles.ts
teste: e2e/guardas.spec.ts › o aviso padrão escreve a linha na esteira e não escreve nada fora dela
falha: expect(foraDela.linhas).toEqual([])
-      if (ambiente['GITHUB_ACTIONS'] === 'true') saida.write(linha)
+      if (true) saida.write(linha)
```

```mutacao
arquivo: e2e/support/profiles.ts
teste: e2e/guardas.spec.ts › o aviso padrão escreve a linha na esteira e não escreve nada fora dela
-  avisoDaEsteira: [avisoDaEsteira(process.env, process.stdout), { option: true }],
+  avisoDaEsteira: [avisoDaEsteira({}, process.stdout), { option: true }],
```

```mutacao
arquivo: e2e/support/profiles.ts
teste: e2e/guardas.spec.ts › o goto que não termina no prazo é refeito, termina, anota só o caminho e avisa a esteira
-        avisoDaEsteira.escrever(linhaDoAviso(`${relative(process.cwd(), testInfo.file)}:${testInfo.line}`, testInfo.project.name, descricao))
```

```mutacao
arquivo: e2e/support/profiles.ts
teste: e2e/guardas.spec.ts › o goto que não termina no prazo é refeito, termina, anota só o caminho e avisa a esteira
falha: expect(escritasNoStdout.filter((linha) => linha.includes('primeira-carga-travou'))).toHaveLength(0)
-        avisoDaEsteira.escrever(linhaDoAviso(`${relative(process.cwd(), testInfo.file)}:${testInfo.line}`, testInfo.project.name, descricao))
+        avisoDaEsteira.escrever(linhaDoAviso(`${relative(process.cwd(), testInfo.file)}:${testInfo.line}`, testInfo.project.name, descricao))
+        process.stdout.write(linhaDoAviso(`${relative(process.cwd(), testInfo.file)}:${testInfo.line}`, testInfo.project.name, descricao))
```

## Provas

- **Portão da correção** (`portao-local.ts --tarefa`): tipos, lint, segredo, dependências, unidade inteira, `e2e/guardas.spec.ts` (20 casos nos dois projetos) e as 15 mutações vermelhas; carimbo gravado.
- **Estabilidade:** `guardas.spec.ts` com `--repeat-each 3 --workers 2` sobre o código final: 60 de 60 verdes. (A versão anterior do fixture, sem a passada por `about:blank`, deu 140 de 140 em `--repeat-each 10`; o caso com fragmento só apareceu com a ordem da Mesa.)
- **A linha `::warning`:** a linha montada pelo fixture chega ao emissor (caso 1, `avisosGuardados`); o emissor padrão a escreve só com `GITHUB_ACTIONS=true` (o caso sem `page`); o emissor padrão do fixture, ligado ao `process.env` e ao `process.stdout` reais, leva a linha ao `stdout` (o mesmo caso, que pede a opção padrão e põe um espião que só guarda); e nenhum caso do guarda escreve no stdout real (o espião do caso 1, que só guarda).
- **O fixture em uso real:** `incidentes.spec.ts` (o do pedido) e `professor-ferramentas.spec.ts` (usa `loadUnthrottled`), `--workers 2`: 64 de 64 verdes, sem anotação `primeira-carga-travou`.
- **Conferência na esteira** (o que esta correção não prova): que a segunda navegação desfaça a trava de verdade. O Orquestrador lê o veredito da esteira **e os avisos da execução** (`::warning title=primeira-carga-travou`, na página da execução do GitHub, também com a esteira verde). O guarda não emite aviso: **todo** `::warning title=primeira-carga-travou` na execução é ocorrência real da trava que a nova tentativa resolveu; repetida, é regressão da primeira carga.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| infra-guardian (1ª) | "Também vale um limite de ocorrências por execução antes de o job falhar." | `TODO.md`, seção "Da correção 2026-11-08-incidente-ao-entrar-de-novo". Só tem sentido depois que o aviso `::warning` tornar a ocorrência visível e houver número de ocorrências para fixar o limite. |
| infra-guardian (1ª) | Trocar a conferência `/Timeout 1000ms/` do caso `quem passa o próprio prazo não ganha nova tentativa` por `errors.TimeoutError`. | `TODO.md`, seção "Da correção 2026-11-08-incidente-ao-entrar-de-novo". Recomendação de revisor que aprovou, e a ordem só levava as de quem reprovou. |
| test-engineer (1ª) | "Só o `page` do fixture tem a nova tentativa. Páginas abertas com `context.newPage()` ou `browser.newContext()` nos specs ficam sem ela." | Recusada: a trava foi vista só no `page` do fixture, nos três traços (`casca`, `areas`, `incidentes`). Se aparecer em `newPage`, é correção nova, e o comentário de `gotoComNovaTentativa` aponta o lugar. |
| conformidade-reviewer (1ª) | Ver na esteira se `primeira-carga-travou` aparece em spec de conformidade (aprovação, tutor, governança). | Conferência do Orquestrador na esteira, junto com a "Conferência na esteira" de "Provas"; o aviso `::warning` é o que permite lê-la. |
| revisor-geral (2ª) | "`guardas.spec.ts:167`: `...resto: never[]` com `trecho as string` funciona para tipar, mas não diz nada." | Resolvida pelo ponto 1 do diagnóstico: a troca de `process.stdout.write` que repassa saiu do teste; o espião que sobrou só guarda. |
| test-engineer (2ª) | "O `about:blank` com `{ timeout: prazoMs }` (`profiles.ts:106`) não tem bloco. Não é condição de regra, então fica só registrado." | Registrada pelo próprio revisor como sem bloco; o bloco da passada por `about:blank` já existe (a linha inteira). |
| test-engineer (2ª) | "A duração do caso de `guardas.spec.ts:192` (1,5 s, mais 2,5 s, mais a carga sob Fast 3G e CPU 4x) cabe na metade do prazo na máquina, como o portão conferiu. Na esteira, fica de olho." | Conferência do Orquestrador na esteira, junto com os avisos. |
| revisor-geral (3ª) | "Mesmo nome para duas coisas. Em `e2e/support/profiles.ts:175`, o parâmetro do fixture `avisoDaEsteira` esconde a função exportada de mesmo nome (`:134`)…" | `TODO.md`, seção "Da correção 2026-11-08-incidente-ao-entrar-de-novo": renomear a fábrica ou o parâmetro. O caso 5 usa `avisoDaEsteira: padrao` e não depende disso. |
| revisor-geral (3ª) | "Mutação sem diferença real. O último bloco de mutação repete a linha removida idêntica no lado `+`…" | Recusada: o revisor diz que "funciona como inserção"; o bloco passa no portão e reescrevê-lo muda a forma sem mudar o que ele prova. |
| test-engineer (4ª), revisor-geral (4ª) | "A descrição do caso 5 (item 5 de "Teste que reproduz") lista só as duas primeiras partes (saída falsa, com e sem `GITHUB_ACTIONS`); falta a terceira: a opção padrão com o `process.env` e o `process.stdout` reais." | Recusada: é texto de documento, a terceira parte já está dita em "Mutações" (o bloco da ligação ao padrão) e em "Provas", e nenhum RF depende da frase. |
| test-engineer (4ª) | "A frase de abertura de "Teste que reproduz" pode ser lida como se os cinco casos estivessem "num bloco que encurta o prazo do fixture a 1,5 s". O caso 5 fica num bloco à parte, sem esse `test.use`." | Recusada, mesmo motivo: texto de documento; a diferença é visível no código (`describe` próprio, fora do `test.use`). |
| revisor-geral (4ª) | "Se a fatia 1 ganhar folga, separar a terceira prova num caso próprio deixa o nome do caso descrever o que ele prova." | Recusada agora: a fatia 1 do e2e está no teto (`tools/ci/prazo-do-e2e.ts`; um caso a mais derruba `tools/ci/esteira.test.ts`, como a rodada 3 mostrou). Volta quando a fatia ganhar folga. |
| revisor-geral (4ª), test-engineer (4ª) | O nome `avisoDaEsteira` serve de função exportada (`profiles.ts`) e de parâmetro do fixture. | Já está em `TODO.md`, na seção da correção. O caso 5 o contorna com `avisoDaEsteira: padrao`. |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-08 20:31:01 | 2026-11-08 20:31:14 | `tenancy-guardian` | 1 | APROVADO | a6eb71b62af700f42 |
| 2026-11-08 20:31:02 | 2026-11-08 20:31:20 | `privacy-guardian` | 1 | APROVADO | a16711afce3e2404d |
| 2026-11-08 20:30:59 | 2026-11-08 20:31:24 | `infra-guardian` | 1 | APROVADO | a2a98d5f1c11f2ef5 |
| 2026-11-08 20:31:03 | 2026-11-08 20:31:30 | `conformidade-reviewer` | 1 | APROVADO | af6d76d405c9adcbb |
| 2026-11-08 20:31:00 | 2026-11-08 20:32:37 | `revisor-geral` | 1 | REPROVADO | abf2101da03279c3e |
| 2026-11-08 20:30:58 | 2026-11-08 20:32:37 | `test-engineer` | 1 | REPROVADO | a8ea4e1937a62da0d |
| 2026-11-08 21:14:41 | 2026-11-08 21:15:29 | `revisor-geral` | 2 | REPROVADO | acef07e641496e6d5 |
| 2026-11-08 21:14:31 | 2026-11-08 21:15:59 | `test-engineer` | 2 | REPROVADO | a73987095b29de3fd |
| 2026-11-08 23:13:21 | 2026-11-08 23:14:12 | `revisor-geral` | 3 | APROVADO | a6c7069ee4bafb626 |
| 2026-11-08 23:13:13 | 2026-11-08 23:14:18 | `test-engineer` | 3 | REPROVADO | a0ed97156dbdc23a8 |
| 2026-11-09 11:38:11 | 2026-11-09 11:38:51 | `revisor-geral` | 4 | APROVADO | acc7c9a9d02e84221 |
| 2026-11-09 11:38:06 | 2026-11-09 11:38:53 | `test-engineer` | 4 | APROVADO | ab9e381d3e033afc3 |
