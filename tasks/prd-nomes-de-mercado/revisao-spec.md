# Revisão de spec — nomes-de-mercado

**Subagentes obrigatórios:** `test-engineer`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `revisor-geral`, `llm-integrator`

O `frontend-reviewer` fica fora: nenhuma tela muda, e o `conferir` compara o texto de tela, a classe de CSS e o `data-testid` (Tech Spec §5 e §9).

## Rodada 1 — 29/10/2026

**Veredito: REPROVADA**

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `tenancy-guardian` | REPROVADO | 2: `regras-tenant.mjs` lê o pacote `@educa/nucleo` (e não `Banco`), e `index.mjs` lê `packages/nucleo/src/db/**`; `escopo-dos-repositories.ts` lê seis nomes (`TIPOS_DO_BANCO`, `PROVAS_DE_ESCOPO`, `SemEscopo`), e a troca parcial cala por método |
| `privacy-guardian` | REPROVADO | 3: a guarda de erro tipado (`NOME_DA_CLASSE_DE_INVARIANTE`, `ESCOPO_DO_ERRO_TIPADO`) fora da §7; `contratos.test.ts` escolhe os schemas pelo prefixo `esquemaResposta` e passaria a varrer uma lista vazia; o `this.name` dos erros sem decisão (`erro.int.test.ts:166`) |
| `conformidade-reviewer` | REPROVADO | 2: as travas da regra 70 que citam nome ou caminho dentro de string ou regex em `.ts` (`porta-unica.test.ts`, `Mensagem.test.tsx`, `avatar-so-nas-duas-pecas.test.ts`, `entrega`, `correcao`, `assistente`) não têm caminho; o passo 5 tocaria `docs/aia/ouro/` e quebraria o selo |
| `infra-guardian` | REPROVADO | 2: `infra/scripts/carga-login.ts`, `carga-sala.ts` e `ensaio-alertas.ts` importam o `dist` por caminho em texto e leem a função por chave, e quebram calados; `ops/migrar.ts` renomeado muda o `command` do compose de produção, ao contrário da §7c |
| `test-engineer` | REPROVADO | 6: travas faltando na §6 e §7; referência por texto dentro de TypeScript sem caminho; `this.name`; o RF3 sem prova (falta o comando de restos); o `conferir` sem especificador comparado, regex e chave de objeto; a guarda testada só em três tipos de declaração |
| `revisor-geral` | REPROVADO | 7: a troca por palavra inteira em comentário e documento estraga a prosa (`com`, `Banco`, `Tela`, `Contador`, `Despachante`), e §2 contradiz §5; a guarda reprova nomes que ficam (`DialogoDeAlocacao`, `CartaoDoAgente`, `ErroDaOperacao`) e pega `tools/`; nada prende o diff da linha aos "Arquivos previstos"; o compose muda (`migrar.ts`); `this.name`; a reaplicação depois do merge é recusada pelo próprio mapa; o PRD com 2.007 palavras |
| `llm-integrator` (sem veto) | AJUSTES NECESSÁRIOS | 1: `adaptador.ts` → `model-adapter.ts` casa com o glob `*-adapter.ts` e isentaria da regra 30 o arquivo da interface |

### Correções exigidas na Tech Spec

- §2 e §5: **referência por texto em qualquer arquivo, também dentro de string, template e regex de TypeScript.** O `aplicar` lista cada ocorrência de cada `de` (símbolo, trecho de caminho, pacote), e o mapa classifica cada uma como `fica` (string de fora) ou `trava` (atualizada à mão, com a prova vermelha). Ocorrência sem classificação deixa o relatório vermelho (test-engineer B2, conformidade B1, privacy B2)
- Novo anexo `travas.md`: cada trava, o que lê pelo nome, a onda e a prova vermelha com o nome novo, com tudo o que os revisores apontaram (tenancy B1 e B2, privacy B1 a B3, conformidade B1, infra B1, test-engineer B1, llm B1)
- §5: comentário e documento só trocam sozinhos o identificador composto ou entre crases; a palavra comum vai para a mão; §2 deixa de contradizer o §5 (revisor-geral 1)
- §5: o `conferir` compara o especificador de módulo depois do mapa, os literais de regex, as chaves de objeto e os nomes exportados, e conta também os casos de `tools/guardas` e `tools/processo` (test-engineer B5)
- §5 e §10: o comando `restos`, que busca cada `de` de todos os mapas no código e nos documentos vivos (test-engineer B4)
- §5: o `aplicar` recebe o escopo de caminhos da tarefa e recusa edição fora dele (revisor-geral 3)
- §5 e §13: o merge da `develop` que traz nome antigo vira correção, com o modo `--reaplicar`, que só pega a ocorrência nova (revisor-geral 6)
- §5 e §7: o `this.name` acompanha a classe, como exceção de grupo do `conferir`, e o `tipo` do log muda; nenhum alerta o lê (privacy B3, test-engineer B3, revisor-geral 5)
- §7c: os arquivos de `apps/api/src/ops/` ficam com o nome, e o compose de produção não muda (infra B2, revisor-geral 4). Toca o inventário aprovado: parada do Joaquim
- §5: a guarda vale só em `apps/`, `packages/` e `e2e/`, com a lista em `tools/guardas/nomes-de-mercado.mjs`, os nomes do kit como nome exato, cada prefixo com os tipos de declaração em que vale, e entra em `REGRAS_DAS_GUARDAS` (revisor-geral 2, test-engineer B6)
- §5: o passo 5 deixa de fora `docs/aia/ouro/` e `docs/aia/ouro-retido/`; as citações de lá vão por correção do Arquiteto depois da 4.0, com o selo regravado (conformidade B2)
- `inventario-core-shared.md`: `adaptador.ts` → `adapter.ts`, e `AdaptadorDeIa` → `LLMAdapterKind`; a Tech Spec dá o valor novo de `PASTA_DOS_ADAPTADORES` (llm B1)
- `prd.md`: abaixo de 2.000 palavras; o RF7 diz "salvo o nome ou caminho renomeado que a trava cita, declarado no mapa", o que toca critério de aceite: parada do Joaquim (revisor-geral 7, test-engineer B3)

### Recomendações

- Uma trava contra filtro vazio: todo glob e caminho das configurações de guarda casa com ao menos um arquivo (privacy)
- Os tipos literais dos três scripts de `infra/scripts/` passam a sair de `typeof import(<fonte>)`, e o typecheck pega o nome que ficou para trás (infra)
- O gerador de migration roda na 3.0 e na 4.0, e o `_journal` não muda; a base é verde antes da 1.0 (test-engineer, revisor-geral)
- O `paths:` das regras passa a `packages/core/**`, provado pelo teste do harness da X7 (infra)
- A régua de duração do e2e cobra casos que só foram renomeados: declarado na §13 (test-engineer)
- Alias de propósito como campo do mapa; o relatório do `aplicar` num arquivo por onda; o motivo de não usar ts-morph nem `naming-convention` (revisor-geral)
- Na guarda, casos de domínio da regra 70 que passam (`CorrecaoService`, `ValidacaoDoLote`) (conformidade)

## Rodada 2 — 29/10/2026

**Veredito: REPROVADA**

Os bloqueantes da rodada 1 estão resolvidos, menos o B4 e o B6 do `test-engineer`, resolvidos em parte.

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `tenancy-guardian` | REPROVADO | 1: a `cerca-resolucao-de-tenant` do `camadas.cjs` e a linha 49 do `arquitetura.test.ts` leem o arquivo e a classe por regex, e calam na 6.0 e na 7.0; a busca por palavra inteira não acha nome dentro de regex |
| `privacy-guardian` | REPROVADO | 1: o `eslint.config.mjs` (`files` de `processadores/` e de `componentes/ui/`) fora da busca e da trava contra filtro vazio |
| `conformidade-reviewer` | APROVADO | — |
| `infra-guardian` | REPROVADO | 1: a raiz (`package.json` com `-w @educa/nucleo`, `knip.json`, `vitest.config.ts`) fora da busca e do `restos`; o caminho do `dist` "conferido à mão" |
| `test-engineer` | REPROVADO | 4: a forma da prova vermelha das travas contradiz o RF7 e a §10; o `restos` fica vermelho para sempre com palavra comum; a gramática da guarda sem caso por tipo e sem caso da mensagem; o `conferir` sem caso de nome exportado e de template |
| `revisor-geral` | REPROVADO | 3: o `restos` e o passo 6 com palavra comum; a gramática recusa uns 40 nomes que não estão no inventário (contra o RF2), e `LinhaDoMaterial` "passa" sem passar; a configuração da raiz sem trava |
| `llm-integrator` (sem veto) | APROVADO | — |

### Correções exigidas na Tech Spec

- §5, passo 6, e `restos`: o escopo inclui `.github/` e a raiz (`package.json`, `knip.json`, `*.config.*`, `tsconfig*.json`). O símbolo é buscado como identificador, e o caminho e o pacote como trecho inteiro, também sem extensão, nunca segmento solto. Em regex e `String.raw`, a busca é na forma sem escape e sem borda depois de `\b`, e pega o prefixo da gramática em `startsWith`/`endsWith` (tenancy, privacy, infra, test-engineer, revisor-geral)
- §5, `restos`: a mesma forma de busca do passo 5 em comentário e documento. Ficam liberados a chave mantida, a troca à mão registrada e, nas linhas, o documento. Na 13.0, roda sem a isenção do ouro (test-engineer, revisor-geral, conformidade)
- §5, trava contra filtro vazio: entram os `files`/`ignores` do `eslint.config.mjs`, os workspaces e entries do `knip.json`, o `paths:` das regras e o `path` em regex do `camadas.cjs`, item a item (privacy, revisor-geral, tenancy, infra)
- §10, "Mutação": toda trava se prova por um bloco de mutação que a devolve ao nome antigo, sobre um caso que já existe e foi renomeado. Nenhum caso entra; trava que nenhum caso alcança é divergência (test-engineer)
- §10: entram os casos novos de `aplicar`, `conferir`, `restos` e do filtro vazio (tenancy, infra, test-engineer, revisor-geral)
- A gramática da guarda passa para o anexo `guarda.md`: cada forma com os tipos de declaração, só a declaração de topo, e um caso recusado e um que passa por linha, mais a mensagem e a árvore inteira verde (test-engineer, revisor-geral)
- `inventario-adenda-2.md`: 94 declarações que a gramática recusa e que nenhum anexo listava, cada uma com o nome novo pela regra do §1. Toca o inventário aprovado (RF2): aprovada pelo Joaquim em 29/10/2026 (revisor-geral)
- `travas.md`: a forma da prova; as linhas novas (`cerca-resolucao-de-tenant`, `ZONAS_DAS_CLASSES_CERCADAS`, `tabelas-do-nucleo.test.ts`, `eslint.config.mjs`, o `package.json` da raiz, `knip.json`/`vitest.config.ts`, `tools/ci/`); e as linhas exatas de `REPOSITORIES_SEM_ESCOPO`, `porta-unica`, `PASTA_DOS_ADAPTADORES`, `correcao` e `guardioes-por-caminho` (todos)

### Recomendações

- Um teste em `infra/test/` que confira que existe a fonte de cada caminho de `dist` do `importarDaApi` (infra)
- O `conferir` conta também `tools/ia/`, `tools/ci/`, `tools/testes/` e `infra/test/` (revisor-geral): entrou na §5
- Custo de IA: zero adicional (llm)

## Rodada 3 — 29/10/2026

**Veredito: REPROVADA**

Os bloqueantes da rodada 2 estão resolvidos, menos o B1 e o B3 do `test-engineer` e o B1 do `revisor-geral`, que estão resolvidos em parte.

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `tenancy-guardian` | APROVADO | — |
| `privacy-guardian` | APROVADO | — |
| `infra-guardian` | APROVADO | — |
| `test-engineer` | REPROVADO | 4: a trava negativa (`not.toContain`) não se prova devolvendo o nome antigo; restrições da gramática sem caso que passa; a trava contra filtro vazio sem caso para `knip.json`, `paths:` e `ignores`, nem mínimo de itens; cláusulas novas do passo 6 e do `restos` sem caso |
| `revisor-geral` | REPROVADO | 3: o passo 6 lista "com" em 6 mil literais, e falta definir "palavra comum"; `CHAVES_DOS_MARCADORES` com o nome errado, na onda errada e sem `NOMES_DOS_MARCADORES`; `esquemaDeCor` recusado pela guarda sem estar no inventário |

### Correções exigidas na Tech Spec

- §5, o mapa e o passo 6: o campo `comum` define a palavra comum, e ela só é listada como literal inteiro ou colada a `(`, `.`, `@`, `/`, `\b`. A regex com alternância que parte o nome é limite declarado. Todo arquivo versionado da raiz entra na busca (revisor-geral; infra e privacy, recomendação)
- §10, "Mutação": três formas de prova, A (devolve o nome antigo), B (trava negativa: o nome novo proibido no código sob teste) e C (`restos`, `tsc`, build ou filtro vazio, onde nenhum caso alcança). `travas.md` ganha a coluna "Forma" (test-engineer; tenancy e infra, recomendação)
- Os casos das ferramentas vão para o anexo `casos.md`, com os que faltavam: `startsWith`/`endsWith`, `'Banco'` e `'@SemEscopo('` listados, "com" em tela não listado; o teste movido com os mesmos casos; a troca à mão, o documento numa linha e o ouro na 13.0; `knip.json`, `paths:`, `ignores`, o mínimo por fonte e a base do `git ls-files` (test-engineer)
- `guarda.md`: casos que passam para cada restrição (declaração dentro de função, `fila/` em `apps/`, `function XEmMemoria`, `interface esquemaX`); `limite/` e `fila/` só em `packages/`; a exceção nominal `esquemaDeCor` (test-engineer, revisor-geral)
- `travas.md`: `CHAVES_DOS_MARCADORES` na 4.0, com `OPERACAO_(?:ROUTE|ENTRY)_KEY` e as fixtures de 653 a 660; linha nova para `NOMES_DOS_MARCADORES` (7.0); a `cerca-resolucao-de-tenant` com a fixture, o `excecoesDoConferir` e o `fica` da 7.0; as linhas de `porta-unica` corrigidas; `REPOSITORIES_SEM_ESCOPO` com todas as entradas (revisor-geral, tenancy)
- §5, `conferir`: roda nas ondas 3.0 a 11.0 e 13.0, e a foto inclui `infra/scripts/` (test-engineer, infra)
- `inventario.md` §1: `lerConfiguracao<X>` → `read<X>Config`, como o anexo back e a adenda 2 (privacy)

### Recomendações

- Um teste em `infra/test/` que confira que existe a fonte de cada caminho de `dist` (infra, de novo)

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-10-29 21:33:07 | 2026-10-29 21:35:31 | `llm-integrator` | 1 | AJUSTES NECESSÁRIOS | afec0cef71b2bf7f2 |
| 2026-10-29 21:32:49 | 2026-10-29 21:35:54 | `tenancy-guardian` | 1 | REPROVADO | a7c24f756090cbdc7 |
| 2026-10-29 21:32:59 | 2026-10-29 21:36:29 | `infra-guardian` | 1 | REPROVADO | a89955fd478d59aa7 |
| 2026-10-29 21:32:52 | 2026-10-29 21:36:37 | `privacy-guardian` | 1 | REPROVADO | a16bb3ef8ee94aebc |
| 2026-10-29 21:32:55 | 2026-10-29 21:37:42 | `conformidade-reviewer` | 1 | REPROVADO | a49666c913785f46c |
| 2026-10-29 21:32:45 | 2026-10-29 21:38:48 | `test-engineer` | 1 | REPROVADO | aa4219059e5bde119 |
| 2026-10-29 21:33:03 | 2026-10-29 21:38:56 | `revisor-geral` | 1 | REPROVADO | a1589db3cbc602630 |
| 2026-10-29 22:17:24 | 2026-10-29 22:19:34 | `llm-integrator` | 2 | APROVADO | a06f07242d71a0802 |
| 2026-10-29 22:17:03 | 2026-10-29 22:20:03 | `tenancy-guardian` | 2 | REPROVADO | adfba557d81e1ff19 |
| 2026-10-29 22:17:14 | 2026-10-29 22:20:09 | `infra-guardian` | 2 | REPROVADO | aa9dae920d4683115 |
| 2026-10-29 22:17:10 | 2026-10-29 22:20:10 | `conformidade-reviewer` | 2 | APROVADO | a314800ddaca5a580 |
| 2026-10-29 22:17:17 | 2026-10-29 22:20:49 | `test-engineer` | 2 | REPROVADO | aeb2cb3a0aeaa7df4 |
| 2026-10-29 22:17:07 | 2026-10-29 22:21:04 | `privacy-guardian` | 2 | REPROVADO | abb19176c70c8008f |
| 2026-10-29 22:17:21 | 2026-10-29 22:21:22 | `revisor-geral` | 2 | REPROVADO | ad80132cbf07e9f88 |
| 2026-10-29 22:54:58 | 2026-10-29 22:58:10 | `infra-guardian` | 3 | APROVADO | a5c7a34cf11de6100 |
| 2026-10-29 22:54:51 | 2026-10-29 22:58:20 | `tenancy-guardian` | 3 | APROVADO | aeec89b55cd0eca67 |
| 2026-10-29 22:54:54 | 2026-10-29 22:58:25 | `privacy-guardian` | 3 | APROVADO | a23063c357ecb51bc |
| 2026-10-29 22:55:01 | 2026-10-29 22:59:04 | `test-engineer` | 3 | REPROVADO | ac0540ccca35597f3 |
| 2026-10-29 22:55:05 | 2026-10-29 22:59:32 | `revisor-geral` | 3 | REPROVADO | adb372b9383e936d3 |
