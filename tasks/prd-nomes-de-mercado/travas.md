# Travas — Nomes de mercado (X8)

Anexo da Tech Spec (§6, §7 e §7b). Uma trava é um teste, uma guarda ou uma configuração que **lê nome ou caminho de
peça como texto**: em string, regex, glob ou chave de JSON. Se o nome mudar e a trava não, ela fica verde sem checar
nada. Por isso a onda que muda o nome muda a trava no mesmo commit, declara a troca em `excecoesDoConferir`
(Tech Spec §5) e prova, com o nome novo, o caso que deixa a trava vermelha.

A lista vem da revisão da spec, rodadas 1 a 4. Ela é o piso: a ocorrência que o relatório do `aplicar` achar e que
não estiver aqui entra no mapa da onda como `fica`, com o motivo, ou como `trava`, e nesse caso ganha também uma linha
neste anexo.

**A forma da prova.** Toda prova é um bloco de mutação da onda, numa das três formas da Tech Spec §10, e a coluna
"Forma" diz qual:

- **A.** A mutação devolve a trava ao nome antigo, e um caso que já existe, renomeado, fica vermelho.
- **B.** Na trava negativa (`not.toContain`, `not.toMatch`), a mutação põe o nome novo proibido no código sob teste, e
  o caso existente fica vermelho.
- **C.** Onde nenhum caso alcança, ficam vermelhos o `restos`, o `tsc`, o build ou a trava contra filtro vazio.

Nenhum caso de teste entra (RF7). Onde a coluna da prova diz "X: vermelho", X é um caso que já existe hoje com o nome
antigo. Trava que não cabe em nenhuma das três é divergência, e é parada do Joaquim.

**Os limites da busca** (Tech Spec §5, passo 6) ficam cobertos por este anexo: a regex com alternância que parte o
nome (`CHAVES_DOS_MARCADORES`) e o nome solto de arquivo ou pasta, inclusive num `require` relativo de `.mjs`, `.cjs`
ou YAML fora de um `tsconfig` (`vaga.lua`, `ARQUIVO_DO_SANDBOX`). O que o relatório achar dessa forma ganha linha aqui.

Os nomes novos são os dos anexos do inventário. A coluna "Onda" usa a numeração da Tech Spec §5.

## Regra 10 — isolamento

| Trava | O que lê pelo nome | Onda | Forma | Prova vermelha com o nome novo |
|---|---|---|---|---|
| `tools/guardas/escopo-dos-repositories.ts` | `TIPOS_DO_BANCO` (`Banco`, `TransacaoBanco`, `ExecutorDeAuditoria` → `Database`, `DatabaseTransaction`, `DatabaseExecutor`); `PROVAS_DE_ESCOPO` (`exigirEscolaDoContexto`, `identidadeDaRequisicao`, `escopoDoJobNoContexto` → `requireEscolaId`, `requestIdentity`, `jobScopeInContext`); o export `SemEscopo` → `Unscoped` | 4.0 | A | As fixtures de `tools/guardas/__fixtures__/repositories/` que já reprovam (`sem-prova`, com `Banco`; `banco-por-parametro` e `funcao-exportada`, com `TransacaoBanco`; `executor-de-auditoria`) passam aos tipos novos. A mutação "`TIPOS_DO_BANCO` com o nome antigo" as deixa verdes e o teste (`repositories-com-escopo.test.ts`, de 155 a 176) vermelho. O import das fixtures passa a `@educa/core` só na 5.0. Nenhum nome antigo sobra na guarda nem nas fixtures |
| `escopo-dos-repositories.ts`, `REPOSITORIES_SEM_ESCOPO` | todas as entradas (as de `packages/nucleo/src/` e as de `apps/api/src/`) e o método `inserirAuditoria` | 4.0 e 5.0 | C (a própria guarda) | A própria guarda reprova entrada inexistente (`lista-arquivo-inexistente`, `lista-metodo-inexistente`, linha 55) |
| `tools/guardas/regras-tenant.mjs` | `PACOTE = '@educa/nucleo'` | 5.0 | A | `import { escola } from '@educa/core'` em `apps/api/src/x/x.service.ts`: vermelho. O mesmo import em `packages/core/src/db/schema/x.ts`: passa. Nenhum caso de `guardas.test.ts` fica com `@educa/nucleo` |
| `tools/guardas/index.mjs` | a exceção `packages/nucleo/src/db/**` | 5.0 | A | O mesmo par de casos acima |
| `tools/guardas/camadas.cjs` | `packages/nucleo`, `ciclo-de-vida`, `conta-global` | 5.0 | A | Uma violação por regra que cita o core: `cerca-conta-global`, o repository que importa service (fora a exceção `expurgo-da-escola`), `shared-nao-importa-nucleo-nem-app`, `web-nao-importa-nucleo-nem-backend` e `nucleo-nao-importa-app`. A árvore `__fixtures__/camadas/packages/nucleo/` muda de caminho junto |
| `camadas.cjs`, `cerca-resolucao-de-tenant` | o `to.path` `resolucao-de-tenant\.repository\.ts` (vira `tenant-resolution.repository.ts`) | 6.0 | A e C | O caso de `camadas.test.ts` (142 a 146 e 221) que importa o repository de fora de `sessao/`: vermelho. A fixture `__fixtures__/camadas/apps/api/src/sessao/tenant/resolucao-de-tenant.repository.ts` e os imports das irmãs mudam de caminho junto, e as strings esperadas entram em `excecoesDoConferir`. Na 7.0, o `ResolucaoDeTenantRepository` dentro dessas fixtures é `fica`: a cerca lê o caminho. O `path` em regex entra na trava contra filtro vazio |
| `tools/processo/guardioes-por-caminho.ts` | `'@SemEscopo('` | 4.0 | A | Um `@Unscoped(` novo chama o `tenancy-guardian` |
| `guardioes-por-caminho.ts` | as exceções `apps/web/src/componentes/ui/` e `apps/web/src/galeria/` | 6.0 | A | `components/ui/ai/` continua pedindo `privacy-guardian`, `conformidade-reviewer` e `infra-guardian`, os três conferidos |
| `apps/api/test/arquitetura.test.ts` | 15 caminhos de `nucleo/src`; as regex `@educa\/nucleo\/conta-global` (linha 50) e `@educa\/nucleo` (linhas 260 e 271) | 5.0 e 6.0 | A e C | O caminho inexistente falha alto. As regex das linhas 260 e 271: os casos sintéticos de 345 a 348, 427 a 430 e 526 a 529. A metade `conta-global` da linha 50, que nenhum caso alcança: o `restos` |
| `arquitetura.test.ts`, `ZONAS_DAS_CLASSES_CERCADAS` (linha 49) | `/\bResolucaoDeTenantRepository\b\|resolucao-de-tenant\.repository/` | 6.0 e 7.0 | A e C | Na 7.0, o caso "a varredura acha as três classes dentro da zona" (66 a 74), com `TenantResolutionRepository`. Na 6.0, a metade do caminho, que o caso não alcança enquanto a classe tem o nome antigo: o `restos` |
| `tools/guardas/tabelas-do-nucleo.test.ts` | a string `'@educa/nucleo'` numa variável | 5.0 | A | A tabela de fora do core: vermelho, importando `@educa/core` |
| `arquitetura.test.ts`, `CHAVES_DOS_MARCADORES` (linha 553) | `METADADO_(?:ROTA\|ENTRADA)_DE_OPERACAO` → `OPERACAO_(?:ROUTE\|ENTRY)_KEY`, e as strings de fixture das linhas 653, 654 e 660 (em `excecoesDoConferir`) | 4.0, junto com as constantes do core; a regex parte o nome, e o passo 6 não a acha | A | Os casos de 653, 654 e 660, renomeados: a chave citada fora do lugar fica vermelha |
| `arquitetura.test.ts`, `NOMES_DOS_MARCADORES` (linha 552) | `RotaDeOperacao\|EntradaDeOperacao` → `OperacaoRoute\|OperacaoLoginRoute`, e as strings de fixture das linhas 651, 652 e 657 a 659 | 7.0 | A | Os casos de 651, 652 e 657 a 659, renomeados: o decorator fora de `operacao/` fica vermelho |

## Regra 20 — dado pessoal

| Trava | O que lê pelo nome | Onda | Forma | Prova vermelha com o nome novo |
|---|---|---|---|---|
| `tools/guardas/regras-erro.mjs` | `NOME_DA_CLASSE_DE_INVARIANTE = 'ErroDeInvariante'` | 3.0 | A | `new InvariantException(\`${aluno.nome}\`)`: vermelho |
| `tools/guardas/index.mjs` | `ESCOPO_DO_ERRO_TIPADO`, com `packages/nucleo/src/**` | 5.0 | A e C | `throw new Error('x')` em `packages/core/src/x.ts`, um caminho real: vermelho |
| `apps/api/test/contratos.test.ts` | o prefixo `'esquemaResposta'`, a lista de nomes e as chaves de `EXCECOES_NOMINAIS` | 3.0 | A | O filtro passa a ser `endsWith('ResponseSchema')`. O conjunto varrido é o de antes, nome a nome pelo mapa e com a mesma contagem. A fixture com `email` na saída continua vermelha |
| `apps/api/test/erro.int.test.ts` (linhas 166 e 169) e `erro-de-invariante.test.ts` (linha 10) | o `this.name` `'ErroDeInvariante'`, que acompanha a classe (adenda 1) | 3.0 e 4.0 | A e B (169 e `erro-de-invariante.test.ts:10`, A; 166, B) | O filtro de erro que deixa vazar o nome no corpo da resposta deixa a 166 vermelha. O `not.toContain('Error')` da linha 150 fica mais estrito com as classes `…Error`, e o mapa da 3.0 o registra |
| `tools/guardas/regras-log.mjs` e `index.mjs` | `resumirErro` → `summarizeError`; `LoggerDoNest` → `NestLogger` | 4.0 | A | `{ erro: summarizeError(e) }` passa, e `{ erro: e.message }` continua vermelho |
| `packages/nucleo/src/auditoria/porta-unica.test.ts` | `not.toContain('inserirAuditoria')` → `insertAuditoria`; os caminhos das linhas 11, 12 e 38 (`LEITURA`); a regex `IMPORTA_O_MODULO_DE_INSERCAO` (linha 49, `insercao-de-auditoria`) e as fontes de exemplo das linhas 104 a 117 | 4.0 e 5.0 | A, B e C (74, B; o `toEqual` da 83, a regex da 49 e os caminhos das linhas 11 e 12, A; `LEITURA`, C) | O índice do core exportando `insertAuditoria`: a linha 74 vermelha; o import do módulo de inserção fora da porta: vermelho |

## Regra 30 — camada de IA

| Trava | O que lê pelo nome | Onda | Forma | Prova vermelha com o nome novo |
|---|---|---|---|---|
| `tools/guardas/regras-ia.mjs`, `PASTA_DOS_ADAPTADORES` | `packages/nucleo/src/ia/adaptador-*.ts` → `packages/core/src/ia/*-adapter.ts`; em `guardas.test.ts`, as linhas 242, 322 e 651 (o `toEqual` das exceções); o cabeçalho de `__fixtures__/sdk-de-ia.ts` | 5.0 | A | `packages/core/src/ia/adapter.ts` (a interface) importando o SDK: vermelho, como hoje. O mesmo vale para `llm-gateway.ts`. Os três adaptadores passam. Os isentos são os de hoje menos os dois `.test.ts` (`adaptador-openai-compat.test.ts`, `adaptador-resiliente.test.ts`), que o glob novo não casa: aperto, e nenhum dos dois importa SDK |
| `tools/processo/harness/caminhos.test.ts` | a guarda, a regra 30 e o `llm-integrator.md` citam a mesma pasta | 5.0 | A | O teste fica verde com a pasta nova e vermelho se uma das três citações ficar para trás |

## Regra 70 — conformidade

| Trava | O que lê pelo nome | Onda | Forma | Prova vermelha com o nome novo |
|---|---|---|---|---|
| `apps/api/src/entrega/entrega.int.test.ts` | a varredura de `packages/nucleo/src` | 5.0 | A | Chamar `decidir` fora da rota, em `packages/core/src`: vermelho |
| `apps/api/src/atividade/correcao/correcao.int.test.ts` | os caminhos da varredura de `.aprovar(` e `.aprovarLote(` (`correcao/correcao.service.ts`, `correcao/lote.controller.ts`) | 6.0 | A | `fica` se a 6.0 não renomear esses arquivos (são de domínio); se renomear, a chamada fora do service e da rota: vermelha |
| `apps/api/src/assistente/assistente.int.test.ts` | a lista exata de caminhos que tocam `mensagemAgente` | 6.0 | A | Um repository novo que toca `mensagemAgente`: vermelho |
| `apps/web/src/componentes/ui/ia/Mensagem.test.tsx` | `/from '\.\/AvatarAgente'/` → `AgentAvatar` | 9.0 | B | A mensagem importando `AgentAvatar` sem a assinatura: vermelho (D58) |
| `apps/web/src/componentes/ui/ia/avatar-so-nas-duas-pecas.test.ts` | `'galeria/'`, `ui/ia/`, `MensagemIA` | 6.0 e 9.0 | A e B | Um arquivo em `gallery/` importando o avatar direto: vermelho |

**O ouro.** `docs/aia/ouro/README.md`, `docs/aia/ouro-retido/README.md` e `RETIDOS.json` citam caminhos de
`ia/__fixtures__/` e `ouro.test.ts`. Nenhuma onda os toca: mudar o README quebra o `SELO.json`, e só o Arquiteto
altera o ouro (X7, RF16). Depois da 5.0, uma correção do Arquiteto troca as citações e regrava o selo, com o
`conformidade-reviewer`.

## Regra 80 — infra

| Trava | O que lê pelo nome | Onda | Forma | Prova vermelha com o nome novo |
|---|---|---|---|---|
| `infra/scripts/carga-login.ts`, `carga-sala.ts`, `ensaio-alertas.ts` | o caminho do `dist` (`packages/nucleo/dist/index.js`, `apps/api/dist/sessao/tenant/sessoes-sinteticas.js`, `apps/api/dist/credencial/hash-de-senha.js`) e as chaves dos tipos literais (`criarBanco`, `criarPool`, `HashDeSenha`) | 5.0, 6.0 e 7.0 | C (`tsc` e `restos`) | O tipo passa a sair de `typeof import(<fonte>)`, e a chave que ficar para trás deixa o `tsc -p infra/tsconfig.json` vermelho. O caminho do `dist`: o `restos` dá zero em `infra/scripts/`, buscando o trecho sem extensão. É o único diff de não-nome da spec (Tech Spec §11) |
| `tools/ia/medir-risco-a-vida.ts` (linhas 211 a 213) | o caminho do `dist` em string | 5.0 | C (`restos`) | O relatório o lista e o `restos` dá zero |
| `packages/nucleo/package.json` (`build`) e `vagas-por-escola.ts` (`readFileSync`) | `src/fila/vaga.lua` | 5.0 | C (o build e o `jobs.int.test.ts` quebram alto) | `infra/test/jobs.int.test.ts`, no job `infra` da esteira, que roda a imagem |
| `apps/worker/src/processadores/sintetico.ts`, `ARQUIVO_DO_SANDBOX` | o caminho do `.js` do sandbox | 6.0 | C (o `jobs.int.test.ts` quebra alto) | O mesmo `jobs.int.test.ts` |
| `.claude/rules/*.md`, o `paths:` | `packages/nucleo/**` | 5.0 | C | A trava contra filtro vazio (cada glob do `paths:` casa) e o `restos` |

## Processo e configuração

| Trava | O que lê pelo nome | Onda | Forma | Prova |
|---|---|---|---|---|
| `eslint-suppressions.json` | os caminhos de arquivo | 5.0 e 6.0 | C (o lint) | O lint verde, sem supressão órfã nem violação reativada |
| `eslint.config.mjs` | `files: ['apps/worker/src/processadores/**/*.ts']` (linha 72, sem afirmação de tipo nos totais do expurgo) e `files: ['apps/web/src/componentes/ui/**/*.{ts,tsx}']` (linha 116, a fronteira do kit); os demais `files`/`ignores` com caminho renomeado | 5.0 e 6.0 | C | A trava contra filtro vazio lê a configuração exportada. O caminho virtual de `guardas.test.ts:159` passa ao nome novo |
| `package.json` da raiz | `-w @educa/nucleo` em cerca de 20 scripts (`build`, `ops:*`, `carga:*`, `ensaio:alertas`) e `db:gerar --config packages/nucleo/drizzle.config.ts` | 5.0 | C | O `restos` dá zero na raiz; a onda roda `npm run build` e `npm run db:gerar` (sem migration nova) |
| `knip.json` e `vitest.config.ts` | o workspace `"packages/nucleo"` e os caminhos do core | 5.0 | C | A trava contra filtro vazio (workspaces e entries do `knip.json`) e o `restos` |
| `tools/ci/dockerfile.test.ts`, `borda.test.ts`, `resolucao-do-shared.test.ts`, `caminhos-da-esteira.ts` | `not.toContain('@educa/nucleo')` (dockerfile, 118), `COPY packages/nucleo/drizzle` (111), as linhas 78 e 95 de `borda`, a 23 de `resolucao-do-shared` e a 7 de `caminhos-da-esteira` | 5.0 | A, B e C (118, B; 111, A; `borda` 78 e 95, `resolucao-do-shared` 23 e `caminhos-da-esteira` 7, C) | A asserção passa ao nome novo, e a mutação que põe no Dockerfile o que a 118 proíbe a deixa vermelha |
| `tools/processo/mutacoes.ts` (linhas 681 e 696) | `__fixtures__/` como apoio de teste | 6.0 | A | `e2e/support/` continua classificado como apoio |
| `apps/web/nome-dos-chunks.ts` | o caminho do kit em texto | 6.0 | A | O teste dele, com o caminho novo |
