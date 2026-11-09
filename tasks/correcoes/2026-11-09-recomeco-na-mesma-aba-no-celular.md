# Correção — o Painel e a Governança leem o resumo pela mesma chave, uma consulta simples e uma infinita, e a página da segunda pessoa na mesma aba derruba a tabela

**Origem:** esteira run 42663492173 em `2acd5ad` (`gh run view 42663492173 --log-failed`), só no projeto `celular`: `e2e 8/10`, `e2e/governanca.spec.ts:265` › `Registros › IA: o recomeço pela pessoa seguinte` (`toContainText` 20 s: o `main` mostra "Não foi possível carregar esta parte do Turmma"), e `e2e 6/10`, `e2e/agentes.spec.ts:307` › `recomeço: a coordenação de B entra na aba da de A…` (`locator.tap` 90 s esperando o link "Como cada IA trabalha", que está dentro da Governança).
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `frontend-reviewer`, `test-engineer`, `revisor-geral`, `conformidade-reviewer`, `infra-guardian`
<!-- O PEDIDO do Orquestrador ditou: tenancy-guardian, privacy-guardian, frontend-reviewer, test-engineer, revisor-geral. A Mesa devolveu a rodada: os arquivos são todos de apps/web, que pede os quatro guardiões (guardioes-por-caminho.ts), e acrescentou conformidade-reviewer e infra-guardian. -->

## Sintoma

Nos dois casos a coordenação de B entra na mesma aba em que a de A tinha aberto Registros › IA, vai ao Painel e depois à IA, e a
área cai na fronteira de erro (`AreaErrorBoundary`) com "A página não chegou até aqui". Não é chunk que não chegou: o traço do
Playwright (`traco-do-e2e-8`, `traco-do-e2e-6`) tem o mesmo erro de console nos dois:

```
TypeError: Cannot read properties of undefined (reading 'tipo')
    at Object.celula (tela-coordenacao-Governanca-….js)  ← COLUNAS[0] de Governanca.tsx: NOME_DO_TIPO_DE_ENTREGA[item.tipo]
    at Table → …
```

Ou seja, a tabela recebeu uma linha `undefined`. Só no `celular` e só nesses dois casos, porque dependem de ordem entre a leitura do
Painel e o `resetQueries` da sessão nova, que no runner mais lento do celular cai do lado ruim.

## Fora desta correção

Nada: a árvore estava limpa.

## Causa

**De qual tarefa é:** de nenhuma das duas que a esteira estreou. Nem a 13.0 (a tela da troca da senha provisória) nem a 17.0 (a
leitura do alvo da senha provisória, só API) tocam `Painel.tsx`, `Governanca.tsx` nem `api/governanca.ts`, que não mudam desde
01/11 (tarefa 10.0 da X8). O defeito é antigo, da A5 e da X2, e a esteira só o mostrou agora, quando a ordem dos eventos no runner do
celular o deixou aparecer.

O mecanismo, confirmado no código do TanStack Query desta versão (`query-core/src/query.ts`, `fetch`) e reproduzido com um
`QueryClient` puro: **o Painel e a Governança leem o resumo pela mesma chave** (`['governanca', 'resumo']`), o Painel por uma consulta
simples (`primeiraPaginaDoResumoQueryOptions`, que devolve `{ pages: [página], pageParams: [undefined] }` para a Governança poder
reler) e a Governança por uma infinita (`resumoDaGovernancaQueryOptions`). Na v5 o **tipo da consulta é fixado quando a `Query` da
chave nasce**: a que nasce infinita aplica o comportamento de consulta infinita a **toda** busca da chave, também à do Painel. Quando
a coordenação de A abre a IA, a consulta da chave nasce infinita. Depois do "Sair", o `resetQueries` da sessão de B esvazia a
consulta e refaz as que estão na tela: com o Painel de B ativo, o `queryFn` do Painel é embrulhado como página, e o cache fica
`{ pages: [{ pages: [página], pageParams: [undefined] }], pageParams: [undefined] }`. Essa "página" não tem `itens`, e
`pages.flatMap((pagina) => pagina.itens)` da Governança devolve `[undefined]`: a tabela recebe uma linha `undefined` e o `.tipo` cai.

É a regra que a própria documentação do TanStack dá: consulta simples e infinita não dividem chave. O desenho com a chave dividida
queria evitar que o Painel relesse as N páginas que a Governança já paginou; isso se mantém com **uma chave só do Painel, que lê uma
página**.

## Teste que reproduz

`apps/web/src/areas/coordenacao/governanca/api/governanca.test.ts` › `a primeira página do Painel e a lista da Governança`: o
cliente de consultas real, a rede falsa só na `authedGet`, a Governança lida e largada (a pessoa A), o Painel ativo, o
`resetQueries` da sessão nova e a Governança lida de novo (a pessoa B). Vermelho no HEAD: a lista da Governança tem uma "página"
sem `itens`. Verde com a correção.

## Correção

O Painel passa a ter a **sua** consulta, com a chave `['governanca', 'resumo', 'primeira-pagina']` e o dado como a API o devolve (uma
página, `{ numeros, itens, proxima }`), e lê `resumo.data.numeros`. A chave fica dentro de `['governanca', 'resumo']` só para ficar junto
das outras do resumo, e o comentário avisa que esse prefixo não aceita `setQueriesData`. A Governança não muda. O que o Painel deixava de pedir (as N páginas) continua sem pedir:
a consulta do Painel lê só a primeira, e a da Governança só é lida na Governança.

O custo, dito: ao abrir a IA, a Governança lê o resumo dela, e não reaproveita a página que o Painel acabou de ler (uma leitura a mais,
que a consulta com o frescor padrão de 30 s antes poupava). Painel e Governança nunca guardam dado um do outro, então a pessoa
seguinte não herda a forma nem o conteúdo da anterior por esse caminho.

O caso de `Painel.test.tsx` que fixava o desenho antigo (`o resumo que a Governança paginou, velho: o Painel relê uma página só, a
primeira, e deixa a chave com essa página`) muda de afirmação e de título (`com a lista que a Governança paginou no cache, o Painel lê
uma página só, na consulta dele, e não escreve na lista da Governança`): o Painel lê uma página e **deixa o cache da Governança como
estava**. A espera de cinco minutos que envelhecia o cache saiu, porque com a chave separada ela não prova mais nada.

O que se conferiu, e o que não: o teste de unidade reproduz o mecanismo de forma determinística (vermelho no HEAD, verde agora). Os dois
e2e da esteira (`governanca.spec.ts:265` e `agentes.spec.ts:307`) passam na máquina nos dois projetos com a correção (30 de 30 nos dois
arquivos, 2,0 min), mas já passavam na máquina antes: o que os derrubava era a ordem dos eventos no runner do celular, e a prova de
que a correção os conserta é a esteira do push, que o Orquestrador lê.

## Mutações

--faltando: 0 linhas (3 blocos, 0 motivos)

A chave própria, sozinha (o `queryFn` novo devolve a página, que a infinita embrulharia certo): a consulta que nasce simples, com o Painel
lido primeiro, entrega à Governança a página do Painel no lugar da lista.

```mutacao
arquivo: apps/web/src/areas/coordenacao/governanca/api/governanca.ts
teste: apps/web/src/areas/coordenacao/governanca/api/governanca.test.ts › o Painel lido primeiro e a Governança depois: a Governança lê a lista dela, no formato de lista, e não herda a página do Painel
- queryKey: [...GOVERNANCA_QUERY_KEY, 'resumo', 'primeira-pagina'],
+ queryKey: resumoDaGovernancaQueryOptions.queryKey,
  queryFn: ({ signal }) => lerPaginaDoResumo(undefined, signal),
```

O defeito de origem inteiro (a chave dividida e o dado no formato da infinita): a Governança lida e largada, o Painel ativo e o `resetQueries`
da sessão nova deixam uma "página" sem `itens`.

```mutacao
arquivo: apps/web/src/areas/coordenacao/governanca/api/governanca.ts
teste: apps/web/src/areas/coordenacao/governanca/api/governanca.test.ts › não dividem consulta: o Painel que relê depois do reset da sessão nova não embrulha o dado na lista da Governança
- queryKey: [...GOVERNANCA_QUERY_KEY, 'resumo', 'primeira-pagina'],
- queryFn: ({ signal }) => lerPaginaDoResumo(undefined, signal),
+ queryKey: resumoDaGovernancaQueryOptions.queryKey,
+ queryFn: async ({ signal }) => ({ pages: [await lerPaginaDoResumo(undefined, signal)], pageParams: [undefined] }),
```

O Painel lê os números da página que a consulta dele devolve, e não de um valor de reserva.

```mutacao
arquivo: apps/web/src/areas/coordenacao/painel/Painel.tsx
teste: apps/web/src/areas/coordenacao/painel/Painel.test.tsx › mostra os quatro números da escola e o consumo do mês numa linha, com o caminho até Registros
- const { numeros } = resumo.data
+ const numeros = { geradoPorIa: 0, aprovadoPorPessoa: 0, rejeitado: 0, esperando: 0 }
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| frontend-reviewer (1ª) | O frescor padrão de 30 s deixou de poupar a releitura quando a pessoa vai do Painel à IA; se a medição da N2 mostrar peso na manhã de segunda, vale um `staleTime` próprio na consulta do Painel | Recusada por ora: muda comportamento (quando o Painel relê), e a leitura a mais é o custo já declarado em "Correção"; a coordenação não está no caminho quente (infra-guardian: "Caminho quente tocado: nenhum"). Reabre se a N2 mostrar peso |
| conformidade-reviewer (1ª), revisor-geral (1ª) | Painel e Governança guardam os números em consultas separadas e podem mostrar números diferentes por alguns minutos; uma linha no texto do Painel, ou reler a consulta do Painel ao voltar da Governança | Recusada: muda texto de tela e comportamento da leitura, e o Painel não relê sozinho por desenho. O registro vai na Tech Spec, junto com o ajuste do bloqueante (Arquiteto, via Orquestrador) |
| frontend-reviewer (1ª) | "Aprovado por gente" no Painel e "Aprovado por um professor" nos registros nomeiam a mesma coisa de dois jeitos | Recusada: texto antigo, fora desta correção (que não toca rótulo); o próprio revisor a deu como observação |
| frontend-reviewer (1ª), test-engineer (1ª), revisor-geral (1ª) | Os dois e2e do celular (`governanca.spec.ts:265`, `agentes.spec.ts:307`) só se confirmam na esteira do push | Não é ação do Implementador: o documento já diz que a prova é a esteira, que o Orquestrador lê antes de fechar a correção |
| revisor-geral (2ª) | A 2_task cita `apps/web/src/api/governanca.ts` (linha 38) e `apps/web/src/areas/coordenacao/Painel.test.tsx` no comando de rodar (linha 58), mas os arquivos estão em `…/governanca/api/governanca.ts` e `…/painel/Painel.test.tsx` | Do Arquiteto, na próxima vez que ele mexer na 2_task: o erro não vem desta correção (a 2_task é da spec telas-da-coordenacao) |
| test-engineer (2ª) | Os dois e2e do celular (`governanca.spec.ts:265`, `agentes.spec.ts:307`) seguem confirmados só na esteira do push | Já registrada na rodada 1: o Orquestrador lê a esteira antes de fechar a correção |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-09 17:50:02 | 2026-11-09 17:50:19 | `tenancy-guardian` | 1 | APROVADO | ac204737d5b32ff7d |
| 2026-11-09 17:50:06 | 2026-11-09 17:50:31 | `privacy-guardian` | 1 | APROVADO | af3708e0f9e9d9569 |
| 2026-11-09 17:50:09 | 2026-11-09 17:50:36 | `frontend-reviewer` | 1 | APROVADO | a0b9944d4d5ff90fd |
| 2026-11-09 17:50:22 | 2026-11-09 17:50:50 | `infra-guardian` | 1 | APROVADO | afc626f99fdfdfa4d |
| 2026-11-09 17:50:19 | 2026-11-09 17:50:55 | `conformidade-reviewer` | 1 | APROVADO | a5ffb59fe007e63f7 |
| 2026-11-09 17:50:12 | 2026-11-09 17:51:05 | `test-engineer` | 1 | APROVADO | a263dc2efce381f69 |
| 2026-11-09 17:50:15 | 2026-11-09 17:51:35 | `revisor-geral` | 1 | REPROVADO | a8ea5fc3cfeff8f78 |
| 2026-11-09 18:00:18 | 2026-11-09 18:00:43 | `revisor-geral` | 2 | APROVADO | a3b1f383f08956738 |
| 2026-11-09 18:00:09 | 2026-11-09 18:00:43 | `test-engineer` | 2 | APROVADO | aa98ba43aa7b27c58 |
