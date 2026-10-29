# Travas — Nomes de mercado (X8)

Anexo da Tech Spec (§6, §7 e §7b). Uma trava é um teste, uma guarda ou uma configuração que **lê nome ou caminho de
peça como texto**: em string, regex, glob ou chave de JSON. Se o nome mudar e a trava não, ela fica verde sem checar
nada. Por isso a onda que muda o nome muda a trava no mesmo commit, declara a troca em `excecoesDoConferir`
(Tech Spec §5) e prova, com o nome novo, o caso que deixa a trava vermelha.

A lista vem da revisão da spec, rodadas 1 e 2. Ela é o piso: a ocorrência que o relatório do `aplicar` achar e que
não estiver aqui entra no mapa da onda como `fica`, com o motivo, ou como `trava`, e nesse caso ganha também uma linha
neste anexo.

**A forma da prova.** Toda prova é um bloco de mutação da onda (Tech Spec §10). A mutação devolve a trava ao nome
antigo, e um caso que já existe, renomeado na onda, fica vermelho; ou fica vermelha a trava contra filtro vazio.
Nenhum caso de teste entra (RF7). Onde a coluna da prova diz "X: vermelho", X é um caso que já existe hoje com o nome
antigo. Trava que nenhum caso alcança é divergência, e é parada do Joaquim.

Os nomes novos são os dos anexos do inventário. A coluna "Onda" usa a numeração da Tech Spec §5.

## Regra 10 — isolamento

| Trava | O que lê pelo nome | Onda | Prova vermelha com o nome novo |
|---|---|---|---|
| `tools/guardas/escopo-dos-repositories.ts` | `TIPOS_DO_BANCO` (`Banco`, `TransacaoBanco`, `ExecutorDeAuditoria` → `Database`, `DatabaseTransaction`, `DatabaseExecutor`); `PROVAS_DE_ESCOPO` (`exigirEscolaDoContexto`, `identidadeDaRequisicao`, `escopoDoJobNoContexto` → `requireEscolaId`, `requestIdentity`, `jobScopeInContext`); o export `SemEscopo` → `Unscoped` | 4.0 | As fixtures de `tools/guardas/__fixtures__/repositories/` que já reprovam (`sem-prova`, com `Banco`; `banco-por-parametro` e `funcao-exportada`, com `TransacaoBanco`; `executor-de-auditoria`) passam aos tipos novos. A mutação "`TIPOS_DO_BANCO` com o nome antigo" as deixa verdes e o teste (`repositories-com-escopo.test.ts`, de 155 a 176) vermelho. O import das fixtures passa a `@educa/core` só na 5.0. Nenhum nome antigo sobra na guarda nem nas fixtures |
| `escopo-dos-repositories.ts`, `REPOSITORIES_SEM_ESCOPO` | as seis entradas de `packages/nucleo/src/` e o método `inserirAuditoria` | 4.0 e 5.0 | A própria guarda reprova entrada inexistente (`lista-arquivo-inexistente`, `lista-metodo-inexistente`, linha 55) |
| `tools/guardas/regras-tenant.mjs` | `PACOTE = '@educa/nucleo'` | 5.0 | `import { escola } from '@educa/core'` em `apps/api/src/x/x.service.ts`: vermelho. O mesmo import em `packages/core/src/db/schema/x.ts`: passa. Nenhum caso de `guardas.test.ts` fica com `@educa/nucleo` |
| `tools/guardas/index.mjs` | a exceção `packages/nucleo/src/db/**` | 5.0 | O mesmo par de casos acima |
| `tools/guardas/camadas.cjs` | `packages/nucleo`, `ciclo-de-vida`, `conta-global` | 5.0 | Uma violação por regra que cita o core: `cerca-conta-global`, o repository que importa service (fora a exceção `expurgo-da-escola`), `shared-nao-importa-nucleo-nem-app`, `web-nao-importa-nucleo-nem-backend` e `nucleo-nao-importa-app`. A árvore `__fixtures__/camadas/packages/nucleo/` muda de caminho junto |
| `camadas.cjs`, `cerca-resolucao-de-tenant` | o `to.path` `resolucao-de-tenant\.repository\.ts` (vira `tenant-resolution.repository.ts`) | 6.0 | Import de `apps/api/src/sessao/tenant/tenant-resolution.repository.ts` vindo de fora de `sessao/`: vermelho. O `path` em regex entra na trava contra filtro vazio |
| `tools/processo/guardioes-por-caminho.ts` | `'@SemEscopo('` | 4.0 | Um `@Unscoped(` novo chama o `tenancy-guardian` |
| `guardioes-por-caminho.ts` | as exceções `apps/web/src/componentes/ui/` e `apps/web/src/galeria/` | 6.0 | `components/ui/ai/` continua pedindo `privacy-guardian`, `conformidade-reviewer` e `infra-guardian`, os três conferidos |
| `apps/api/test/arquitetura.test.ts` | 15 caminhos de `nucleo/src`; as regex `@educa\/nucleo\/conta-global` (linha 50) e `@educa\/nucleo` (linhas 260 e 271) | 5.0 e 6.0 | O caminho inexistente falha. `import * as x from '@educa/core/conta-global'` fora do lugar: vermelho |
| `arquitetura.test.ts`, `ZONAS_DAS_CLASSES_CERCADAS` (linha 49) | `/\bResolucaoDeTenantRepository\b\|resolucao-de-tenant\.repository/` | 6.0 e 7.0 | `TenantResolutionRepository` importado fora da zona: vermelho; a varredura acha a classe dentro da zona |
| `tools/guardas/tabelas-do-nucleo.test.ts` | a string `'@educa/nucleo'` numa variável | 5.0 | A tabela de fora do core: vermelho, importando `@educa/core` |
| `arquitetura.test.ts`, `CHAVES_DOS_MARCADORES` (linha 553) | `METADADO_(ROTA\|ENTRADA)_DE_OPERACAO` → `OPERACAO_(ROUTE\|LOGIN_ROUTE)_KEY` | 7.0 | Uma rota de operação sem o marcador: vermelha. A varredura acha ao menos um marcador |

## Regra 20 — dado pessoal

| Trava | O que lê pelo nome | Onda | Prova vermelha com o nome novo |
|---|---|---|---|
| `tools/guardas/regras-erro.mjs` | `NOME_DA_CLASSE_DE_INVARIANTE = 'ErroDeInvariante'` | 3.0 | `new InvariantException(\`${aluno.nome}\`)`: vermelho |
| `tools/guardas/index.mjs` | `ESCOPO_DO_ERRO_TIPADO`, com `packages/nucleo/src/**` | 5.0 | `throw new Error('x')` em `packages/core/src/x.ts`, um caminho real: vermelho |
| `apps/api/test/contratos.test.ts` | o prefixo `'esquemaResposta'`, a lista de nomes e as chaves de `EXCECOES_NOMINAIS` | 3.0 | O filtro passa a ser `endsWith('ResponseSchema')`. O conjunto varrido é o de antes, nome a nome pelo mapa e com a mesma contagem. A fixture com `email` na saída continua vermelha |
| `apps/api/test/erro.int.test.ts` (linhas 166 e 169) e `erro-de-invariante.test.ts` (linha 10) | o `this.name` `'ErroDeInvariante'`, que acompanha a classe (adenda 1) | 3.0 e 4.0 | O filtro de erro que deixa vazar o nome no corpo da resposta deixa a 166 vermelha. O `not.toContain('Error')` da linha 150 fica mais estrito com as classes `…Error`, e o mapa da 3.0 o registra |
| `tools/guardas/regras-log.mjs` e `index.mjs` | `resumirErro` → `summarizeError`; `LoggerDoNest` → `NestLogger` | 4.0 | `{ erro: summarizeError(e) }` passa, e `{ erro: e.message }` continua vermelho |
| `packages/nucleo/src/auditoria/porta-unica.test.ts` | `not.toContain('inserirAuditoria')` → `insertAuditoria`; os caminhos das linhas 11, 12 e 38 (`LEITURA`); a regex `IMPORTA_O_MODULO_DE_INSERCAO` (linha 50, `insercao-de-auditoria`) e as fontes de exemplo das linhas 104 a 117 | 4.0 e 5.0 | O índice do core exportando `insertAuditoria`: vermelho; o import do módulo de inserção fora da porta: vermelho (linha 73) |

## Regra 30 — camada de IA

| Trava | O que lê pelo nome | Onda | Prova vermelha com o nome novo |
|---|---|---|---|
| `tools/guardas/regras-ia.mjs`, `PASTA_DOS_ADAPTADORES` | `packages/nucleo/src/ia/adaptador-*.ts` → `packages/core/src/ia/*-adapter.ts`; em `guardas.test.ts`, as linhas 242, 322 e 651 (o `toEqual` das exceções); o cabeçalho de `__fixtures__/sdk-de-ia.ts` | 5.0 | `packages/core/src/ia/adapter.ts` (a interface) importando o SDK: vermelho, como hoje. O mesmo vale para `llm-gateway.ts`. Os três adaptadores passam. Os isentos são os de hoje menos os dois `.test.ts` (`adaptador-openai-compat.test.ts`, `adaptador-resiliente.test.ts`), que o glob novo não casa: aperto, e nenhum dos dois importa SDK |
| `tools/processo/harness/caminhos.test.ts` | a guarda, a regra 30 e o `llm-integrator.md` citam a mesma pasta | 5.0 | O teste fica verde com a pasta nova e vermelho se uma das três citações ficar para trás |

## Regra 70 — conformidade

| Trava | O que lê pelo nome | Onda | Prova vermelha com o nome novo |
|---|---|---|---|
| `apps/api/src/entrega/entrega.int.test.ts` | a varredura de `packages/nucleo/src` | 5.0 | Chamar `decidir` fora da rota, em `packages/core/src`: vermelho |
| `apps/api/src/atividade/correcao/correcao.int.test.ts` | os caminhos da varredura de `.aprovar(` e `.aprovarLote(` (`correcao/correcao.service.ts`, `correcao/lote.controller.ts`) | 6.0 | `fica` se a 6.0 não renomear esses arquivos (são de domínio); se renomear, a chamada fora do service e da rota: vermelha |
| `apps/api/src/assistente/assistente.int.test.ts` | a lista exata de caminhos que tocam `mensagemAgente` | 6.0 | Um repository novo que toca `mensagemAgente`: vermelho |
| `apps/web/src/componentes/ui/ia/Mensagem.test.tsx` | `/from '\.\/AvatarAgente'/` → `AgentAvatar` | 9.0 | A mensagem importando `AgentAvatar` sem a assinatura: vermelho (D58) |
| `apps/web/src/componentes/ui/ia/avatar-so-nas-duas-pecas.test.ts` | `'galeria/'`, `ui/ia/`, `MensagemIA` | 6.0 e 9.0 | Um arquivo em `gallery/` importando o avatar direto: vermelho |

**O ouro.** `docs/aia/ouro/README.md`, `docs/aia/ouro-retido/README.md` e `RETIDOS.json` citam caminhos de
`ia/__fixtures__/` e `ouro.test.ts`. Nenhuma onda os toca: mudar o README quebra o `SELO.json`, e só o Arquiteto
altera o ouro (X7, RF16). Depois da 5.0, uma correção do Arquiteto troca as citações e regrava o selo, com o
`conformidade-reviewer`.

## Regra 80 — infra

| Trava | O que lê pelo nome | Onda | Prova vermelha com o nome novo |
|---|---|---|---|
| `infra/scripts/carga-login.ts`, `carga-sala.ts`, `ensaio-alertas.ts` | o caminho do `dist` (`packages/nucleo/dist/index.js`, `apps/api/dist/sessao/tenant/sessoes-sinteticas.js`, `apps/api/dist/credencial/hash-de-senha.js`) e as chaves dos tipos literais (`criarBanco`, `criarPool`, `HashDeSenha`) | 5.0, 6.0 e 7.0 | O tipo passa a sair de `typeof import(<fonte>)`, e a chave que ficar para trás deixa o `tsc -p infra/tsconfig.json` vermelho. O caminho do `dist`: o `restos` dá zero em `infra/scripts/`, buscando o trecho sem extensão. É o único diff de não-nome da spec (Tech Spec §11) |
| `tools/ia/medir-risco-a-vida.ts` (linhas 211 a 213) | o caminho do `dist` em string | 5.0 | O relatório o lista e o `restos` dá zero |
| `packages/nucleo/package.json` (`build`) e `vagas-por-escola.ts` (`readFileSync`) | `src/fila/vaga.lua` | 5.0 | `infra/test/jobs.int.test.ts`, no job `infra` da esteira, que roda a imagem |
| `apps/worker/src/processadores/sintetico.ts`, `ARQUIVO_DO_SANDBOX` | o caminho do `.js` do sandbox | 6.0 | O mesmo `jobs.int.test.ts` |
| `.claude/rules/*.md`, o `paths:` | `packages/nucleo/**` | 5.0 | A trava contra filtro vazio (cada glob do `paths:` casa) e o `restos` |

## Processo e configuração

| Trava | O que lê pelo nome | Onda | Prova |
|---|---|---|---|
| `eslint-suppressions.json` | os caminhos de arquivo | 5.0 e 6.0 | O lint verde, sem supressão órfã nem violação reativada |
| `eslint.config.mjs` | `files: ['apps/worker/src/processadores/**/*.ts']` (linha 72, sem afirmação de tipo nos totais do expurgo) e `files: ['apps/web/src/componentes/ui/**/*.{ts,tsx}']` (linha 116, a fronteira do kit); os demais `files`/`ignores` com caminho renomeado | 5.0 e 6.0 | A trava contra filtro vazio lê a configuração exportada. O caminho virtual de `guardas.test.ts:159` passa ao nome novo |
| `package.json` da raiz | `-w @educa/nucleo` em cerca de 20 scripts (`build`, `ops:*`, `carga:*`, `ensaio:alertas`) e `db:gerar --config packages/nucleo/drizzle.config.ts` | 5.0 | O `restos` dá zero na raiz; a onda roda `npm run build` e `npm run db:gerar` (sem migration nova) |
| `knip.json` e `vitest.config.ts` | o workspace `"packages/nucleo"` e os caminhos do core | 5.0 | A trava contra filtro vazio (workspaces e entries do `knip.json`) e o `restos` |
| `tools/ci/dockerfile.test.ts`, `borda.test.ts`, `resolucao-do-shared.test.ts`, `caminhos-da-esteira.ts` | `not.toContain('@educa/nucleo')` (dockerfile, 118), `COPY packages/nucleo/drizzle` (111), as linhas 78 e 95 de `borda`, a 23 de `resolucao-do-shared` e a 7 de `caminhos-da-esteira` | 5.0 | A asserção passa ao nome novo, e a mutação que põe no Dockerfile o que a 118 proíbe a deixa vermelha |
| `tools/processo/mutacoes.ts` (linhas 681 e 696) | `__fixtures__/` como apoio de teste | 6.0 | `e2e/support/` continua classificado como apoio |
| `apps/web/nome-dos-chunks.ts` | o caminho do kit em texto | 6.0 | O teste dele, com o caminho novo |
