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
ou YAML fora de um `tsconfig` (`vaga.lua`, `ARQUIVO_DO_SANDBOX`). Como o passo 6 não os acha, quem acha é a leitura do anexo do inventário na hora de escrever o mapa da onda, e a revisão da onda; o que se achar ganha linha aqui.

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
| `tools/processo/guardioes-por-caminho.ts` | `'@SemEscopo('`, e a marca por extenso de `tools/processo/harness/guardioes.test.ts` (casos das linhas 128 e 316) | 4.0 | A | Um `@Unscoped(` novo chama o `tenancy-guardian` |
| `.claude/agents/tenancy-guardian.md` (item 8 de "O que verificar") e a gravação `tools/processo/harness/__fixtures__/revisores-antes/tenancy-guardian.verificar.md` (linha 13) | `` `@SemEscopo()` `` → `` `@Unscoped()` ``, o mesmo literal nos dois e nada mais | 4.0 | A | `revisores.test.ts`, "os de hoje são os de antes": verde só com os dois iguais; o agente sozinho com o nome novo, ou a gravação sozinha, fica vermelho. A gravação não é regravada: troca só esse literal, e o comentário do topo do `revisores.test.ts` diz isso em uma frase |
| `guardioes-por-caminho.ts` | as exceções `apps/web/src/componentes/ui/` e `apps/web/src/galeria/` | 6.0 | A | `components/ui/ai/` continua pedindo `privacy-guardian`, `conformidade-reviewer` e `infra-guardian`, os três conferidos |
| `apps/api/test/arquitetura.test.ts` | 15 caminhos de `nucleo/src`; as regex `@educa\/nucleo\/conta-global` (linha 50) e `@educa\/nucleo` (linhas 260 e 271) | 5.0 e 6.0 | A e C | O caminho inexistente falha alto. As regex das linhas 260 e 271: os casos sintéticos de 345 a 348, 427 a 430 e 526 a 529. A metade `conta-global` da linha 50, que nenhum caso alcança: o `restos` |
| `architecture.test.ts`, `ZONAS_DAS_CLASSES_CERCADAS` (linha 49) | `/\bResolucaoDeTenantRepository\b\|resolucao-de-tenant\.repository/` | 6.0 e 7.0 | A e C | Na 7.0, o caso "reprova quem usa a classe por uma ponte de dentro da zona…" (80 a 107), com a regex no nome antigo: a fixture `tools/vaza.ts` deixa de casar. O caso "acha as três classes dentro da zona" (66 a 74) só prova que a regex é necessária, num bloco de controle. Na 6.0, a metade do caminho, que o caso não alcança enquanto a classe tem o nome antigo: o `restos` |
| `tools/guardas/tabelas-do-nucleo.test.ts` | a string `'@educa/nucleo'` numa variável | 5.0 | A | A tabela de fora do core: vermelho, importando `@educa/core` |
| `arquitetura.test.ts`, `CHAVES_DOS_MARCADORES` (linha 553) | `METADADO_(?:ROTA\|ENTRADA)_DE_OPERACAO` → `OPERACAO_(?:ROUTE\|ENTRY)_KEY`, e as strings de fixture das linhas 653, 654 e 660 (em `excecoesDoConferir`) | 4.0, junto com as constantes do core; a regex parte o nome, e o passo 6 não a acha | A | Os casos de 653, 654 e 660, renomeados: a chave citada fora do lugar fica vermelha |
| `architecture.test.ts`, `NOMES_DOS_MARCADORES` (linha 552) | `RotaDeOperacao\|EntradaDeOperacao` → `OperacaoRoute\|OperacaoLoginRoute`, e as strings de fixture das linhas 651, 652 e 657 a 659 | 7.0 | A | As fixtures `fora` 651 e 652, com o nome antigo na regex: o decorator fora de `operacao/` deixa de ser pego. As `inocentes` 657 a 659, uma por bloco, sem a absolvição (pasta, comentário, caminho de teste): o caso fica vermelho |

## Regra 20 — dado pessoal

| Trava | O que lê pelo nome | Onda | Forma | Prova vermelha com o nome novo |
|---|---|---|---|---|
| `tools/guardas/regras-erro.mjs` | `NOME_DA_CLASSE_DE_INVARIANTE = 'ErroDeInvariante'` | 3.0 | A | `new InvariantException(\`${aluno.nome}\`)`: vermelho |
| `tools/guardas/index.mjs` | `ESCOPO_DO_ERRO_TIPADO`, com `packages/nucleo/src/**` | 5.0 | A e C | `throw new Error('x')` em `packages/core/src/x.ts`, um caminho real: vermelho |
| `apps/api/test/contratos.test.ts` | o prefixo `'esquemaResposta'`, a lista de nomes e as chaves de `EXCECOES_NOMINAIS` | 3.0 | A | O filtro passa a ser `endsWith('ResponseSchema')`. O conjunto varrido é o de antes, nome a nome pelo mapa, menos `esquemaRespostaSalva`: ele vira `respostaSalvaSchema` (domínio, a resposta do aluno) e sai do filtro, e os campos dele continuam varridos por dentro de `provaResponseSchema.respostas`. A fixture com `email` na saída continua vermelha |
| `apps/api/test/erro.int.test.ts` (caso "ErroDeInvariante vira ERRO_INTERNO 500…") e o teste da classe de invariante (`erro-de-invariante.test.ts`, que a 3.0 renomeia para `packages/shared/src/errors/invariant.exception.test.ts`) | o `this.name` `'ErroDeInvariante'`, que acompanha a classe (adenda 1) | 3.0 e 4.0 | A e B. A: o `toMatchObject` com `erro: { tipo: '<nome da classe>' }` no `erro.int.test.ts` e o `expect(erro.name).toBe('<nome da classe>')` no teste da classe. B: o `expect(resposta.text).not.toContain('<nome da classe>')` do `erro.int.test.ts`, antes do envelope. Cite a asserção pelo texto, não pela linha: a linha muda a cada edição do arquivo | O filtro de erro que deixa vazar o nome no corpo da resposta deixa vermelho o `not.toContain('<nome da classe>')`, e não o `not.toContain(MOTIVO_DA_INVARIANTE)` logo acima dele. O `'Error'` da lista de proibidos do caso "exceção não tratada vira ERRO_INTERNO 500…" (`not.toContain(proibido)`) fica mais estrito com as classes `…Error`, e o mapa da 3.0 o registra |
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
| `infra/scripts/carga-login.ts`, `carga-sala.ts`, `ensaio-alertas.ts` | o caminho do `dist` (`packages/nucleo/dist/index.js`, `apps/api/dist/sessao/tenant/sessoes-sinteticas.js`, `apps/api/dist/credencial/hash-de-senha.js`) e as chaves dos tipos literais (`criarBanco`, `criarPool`, `HashDeSenha`) | 5.0, 6.0 e 7.0 | C (`tsc` e `restos`) | O `import type` da fonte continua: o nome exportado que ficar para trás deixa o `tsc -p infra/tsconfig.json` vermelho. A chave do tipo literal e o caminho do `dist` são texto: o `restos` dá zero em `infra/scripts/`, buscando o caminho sem extensão, e o `filtros-casam.test.ts` ("dist de infra/scripts…") casa cada caminho do `dist` com a fonte `.ts` em `src/`. Sem `typeof import(<fonte>)`: o lint e a guarda de tabela o proíbem, e nenhum diff de não-nome sobra na spec (Tech Spec §11, divergência da 5.0) |
| `tools/ia/medir-risco-a-vida.ts` (linhas 211 a 213) | o caminho do `dist` em string | 5.0 | C (`restos`) | O relatório o lista e o `restos` dá zero |
| `packages/nucleo/package.json` (`build`) e `vagas-por-escola.ts` (`readFileSync`) | `src/fila/vaga.lua` | 5.0 | C (o build e o `jobs.int.test.ts` quebram alto) | `infra/test/jobs.int.test.ts`, no job `infra` da esteira, que roda a imagem |
| `apps/worker/src/processadores/sintetico.ts`, `ARQUIVO_DO_SANDBOX` | o caminho do `.js` do sandbox | 6.0 | C (o `jobs.int.test.ts` quebra alto) | O mesmo `jobs.int.test.ts` |
| `.claude/rules/*.md`, o `paths:` | `packages/nucleo/**` | 5.0 | C | A trava contra filtro vazio (cada glob do `paths:` casa) e o `restos` |

## Processo e configuração

| Trava | O que lê pelo nome | Onda | Forma | Prova |
|---|---|---|---|---|
| `eslint-suppressions.json` | os caminhos de arquivo | 5.0, 6.0, 9.0 e 10.0 | C (o lint) | O lint verde, sem supressão órfã nem violação reativada |
| `eslint.config.mjs` | `files: ['apps/worker/src/processadores/**/*.ts']` (linha 72, sem afirmação de tipo nos totais do expurgo) e `files: ['apps/web/src/componentes/ui/**/*.{ts,tsx}']` (linha 116, a fronteira do kit); os demais `files`/`ignores` com caminho renomeado | 5.0 e 6.0 | C | A trava contra filtro vazio lê a configuração exportada. O caminho virtual de `guardas.test.ts:159` passa ao nome novo |
| `package.json` da raiz | `-w @educa/nucleo` em cerca de 20 scripts (`build`, `ops:*`, `carga:*`, `ensaio:alertas`) e `db:gerar --config packages/nucleo/drizzle.config.ts` | 5.0 | C | O `restos` dá zero na raiz; a onda roda `npm run build` e `npm run db:gerar` (sem migration nova) |
| `knip.json` e `vitest.config.ts` | o workspace `"packages/nucleo"` e os caminhos do core | 5.0 | C | A trava contra filtro vazio (workspaces e entries do `knip.json`) e o `restos` |
| `tools/ci/dockerfile.test.ts`, `borda.test.ts`, `resolucao-do-shared.test.ts`, `caminhos-da-esteira.ts` | `not.toContain('@educa/nucleo')` (dockerfile, 118), `COPY packages/nucleo/drizzle` (111), as linhas 78 e 95 de `borda` (na 95, o nome `TENTE_DE_NOVO_PADRAO_SEGUNDOS` da regex passa a `DEFAULT_RETRY_AFTER_SECONDS` na 4.0, e o caminho na 5.0), a 23 de `resolucao-do-shared` e a 7 de `caminhos-da-esteira` | 5.0 | A, B e C (118, B; 111, A; `borda` 78 e 95, `resolucao-do-shared` 23 e `caminhos-da-esteira` 7, C) | A asserção passa ao nome novo, e a mutação que põe no Dockerfile o que a 118 proíbe a deixa vermelha |
| `tools/processo/mutacoes.ts` (linhas 681 e 696) | `__fixtures__/` como apoio de teste | 6.0 | A | `e2e/support/` continua classificado como apoio |
| `apps/web/nome-dos-chunks.ts` | o caminho do kit em texto | 6.0, 9.0 e 10.0 | A | O teste dele, com o caminho novo |

## Achadas na 4.0

O relatório do `aplicar` da 4.0 achou estas, que a revisão da spec não listou (Tech Spec §5, passo 6). As linhas acima não mudam de número.

| Trava | O que lê pelo nome | Onda | Forma | Prova vermelha com o nome novo |
|---|---|---|---|---|
| `apps/api/test/arquitetura.test.ts`, o caso "o repository lê a escola do contexto e nenhum método a recebe" | `toContain('exigirEscolaDoContexto()')` sobre o texto de `compartilhamento.repository.ts` → `requireEscolaId()` | 4.0 | A | O `compartilhamento.repository.ts` sem a chamada `requireEscolaId()`: vermelho, como hoje |
| `arquitetura.test.ts`, `USO_DA_ROTINA` | `/\bEscolasDaRotinaRepository\b\|escolas-da-rotina\.repository/` → `CronEscolasRepository` (a metade do caminho é da 5.0) | 4.0 e 5.0 | A | O caso "…lista de escolas da rotina…" (`filter(USO_DA_ROTINA.test)`): uma rota da API que importe `CronEscolasRepository` fica vermelha |
| `tools/ia/medir-risco-a-vida.ts` e `medir-risco-a-vida.test.ts` | os nomes que a medida lê por chave do módulo importado: `ProvedorDeIa`, `AdaptadorRoteirizado`, `ConsumoEmMemoria`, `OrcamentoEmMemoria`, `SuspensoesEmMemoria`, `executarNoContexto`, `lerConfiguracaoDeIa`, `criarProvedorDeIa`. O `as unknown as` esconde a chave que ficar para trás do `tsc` | 4.0 | A | O teste da medida, com a chave antiga num dos nomes: `is not a constructor` |
| `infra/scripts/carga-login.ts`, `carga-sala.ts`, `ensaio-alertas.ts` | as chaves `criarBanco` e `criarPool` do tipo literal passam a `createDatabase` e `createPool`; o caminho do `dist` é da 5.0 e o `HashDeSenha`, da 7.0 (linha 84) | 4.0 | C (`tsc`) | `tsc -p infra/tsconfig.json`: a chave antiga numa chamada `nucleo.createPool(` fica vermelha |

## Achadas na 5.0

O relatório do `aplicar` da 5.0 achou estas, que a revisão da spec não listou (Tech Spec §5, passo 6). As linhas acima não mudam de número. Toda ocorrência delas é do caminho `packages/nucleo` ou do pacote `@educa/nucleo`, e o que a onda faz é trocá-los à mão pelo caminho e pelo nome que a entrada do mapa dá.

| Trava | O que lê pelo nome | Onda | Forma | Prova |
|---|---|---|---|---|
| `infra/docker/servico.Dockerfile` | os `COPY` de `packages/nucleo/{package.json,dist,drizzle}` e o `npm run build -w @educa/nucleo` | 5.0 | B e C (`dockerfile.test.ts` 111 e 118; o `restos`) | O `restos` dá zero no Dockerfile, e o `dockerfile.test.ts` exige `COPY packages/core/drizzle` e proíbe o nome novo onde a 118 proíbe. As imagens são construídas na esteira |
| `infra/compose.yml` (116 e 333) | o caminho do core em dois comentários (`db/migrar.ts`, `instancia/batimento.ts`) | 5.0 | C | `docker compose config` na raiz sai igual ao de antes (o comentário não entra na saída), e o `restos` dá zero |
| `packages/core/drizzle.config.ts` | `./packages/nucleo/src/db/schema/*.ts` e `./packages/nucleo/drizzle` (o `drizzle-kit` roda da raiz) | 5.0 | C | `npm run db:gerar` sem migration nova e sem diff no `_journal`; o `restos` |
| `tools/guardas/index.mjs` (`EXCECOES_DAS_GUARDAS`, linhas 118 e 124), `guardas.test.ts` e `filtros-casam.test.ts` | os caminhos de `packages/nucleo/src/...` das exceções de log e dos casos sintéticos de regra (inclusive o `toEqual` das linhas 658 e 659) | 5.0 | C | O `restos` dá zero nos três; a trava contra filtro vazio recusa a exceção de log com o caminho antigo |
| `tools/processo/{linhas,mutacoes,portao-local,revisoes}.test.ts` e `harness/guardioes.test.ts` | caminhos de exemplo de `packages/nucleo/...` nos casos | 5.0 | C | O `restos` dá zero. Nenhum caso depende do nome da pasta: o exemplo só precisa de um caminho de `packages/*/src` |
| `tools/ia/medir-risco-a-vida.test.ts` e `packages/core/src/ia/golden.test.ts` (437) | o caminho do módulo de IA importado por caminho relativo, e o URL fabricado de `ouro.ts` | 5.0 | C | O `restos` dá zero e o teste da medida continua verde |
| `tools/guardas/__fixtures__/filtros/knip.json` | o workspace `"packages/nucleo"` e a entrada `src/db/migrar.ts` | 5.0 | C | A trava contra filtro vazio lê a fixture com o caminho novo |

## Achadas na 6.0

O relatório do `aplicar` da 6.0 achou estas, que a revisão da spec não listou (Tech Spec §5, passo 6). As linhas acima não mudam de número. Toda ocorrência delas é caminho de arquivo ou de pasta que a onda move, e o que a onda faz é trocá-lo à mão pelo caminho novo da entrada do mapa.

| Trava | O que lê pelo nome | Onda | Forma | Prova |
|---|---|---|---|---|
| `tools/processo/guardioes-por-caminho.ts` e `harness/guardioes.test.ts` | os caminhos de `apps/web` que a regra nomeia: `estilos.css`, `tema.ts`, `nome-dos-chunks.ts`, `rebaixar-cor.ts` e os testes deles (a linha 41 cobre só `componentes/ui/` e `galeria/`) | 6.0 | A | `guardioes.test.ts` com o caminho novo: o `tema.ts` e o `estilos.css` continuam pedindo o `frontend-reviewer`, os mesmos conferidos |
| `tools/processo/{revisoes,mutacoes,linhas,instalacao,receitas}.test.ts` e `harness/caminhos.test.ts` | caminhos de exemplo de `apps/`, `e2e/` e `tools/`, em strings e em regex de mensagem | 6.0 | C | O `restos` dá zero. Nenhum caso depende do nome: o exemplo só precisa de um caminho que a regra reconhece |
| `tools/ci/playwright.test.ts`, `duracao-do-e2e.test.ts`, `e2e-que-cita-literal.test.ts`, `codigo-do-autenticador.test.ts` | `e2e/__fixtures__/perfis.ts`, `ajudante.ts`, `casca.ts`, `sessao.ts` e a pasta `e2e/__fixtures__` | 6.0 | A (`playwright.test.ts`, o import de `perfis`) e C | O caso do `playwright.test.ts` que exige o `test` de `perfis` (agora `profiles`) fica vermelho com o nome antigo; o `restos` dá zero nos outros |
| `tools/guardas/camadas.test.ts`, `camadas.cjs` (linha 139) e a fixture `camadas/apps/api/src/credencial/hash-do-token.ts` | `hash-do-token.ts`, `arquitetura.test.ts`, as mensagens com o caminho | 6.0 | A | `camadas.test.ts`: as violações de `credencial` e do teste de arquitetura, vermelhas com o caminho novo |
| `tools/guardas/{guardas,tamanho-das-pastas,filtros-casam}.test.ts` | caminhos de exemplo (`apps/api/src/sistema/x.ts`, `apps/web/src/paginas/Casca.tsx`, `e2e/__fixtures__/x.ts`) e o `dist` de `hash-de-senha` | 6.0 | C | O `restos` dá zero; o `filtros-casam.test.ts` ("dist de infra/scripts…") casa o caminho novo com a fonte |
| `apps/api/test/architecture.test.ts` (linhas 22, 358, 559, 634, 660, 1330 a 1335, 1393, 1394, 1423, 1439 e 1473) | caminhos de arquivo em listas de varredura e em mensagens | 6.0 | C | O `restos` dá zero; o teste continua com os mesmos casos |
| `apps/web/src/components/{casca-sem-import,perigo-cheio}.test.ts`, `estilos.test.ts` | caminhos do kit lidos como texto (`ui/campos/Segmentado.tsx`, `ui/botao-secundario.ts`, `ui/ia/`) | 6.0, 9.0 e 10.0 | C | O `restos` dá zero e os testes leem o arquivo (arquivo que não existe falha alto) |
| `apps/web/src/areas/*/introducao/textos-da-introducao.test.ts` | a mensagem de falha que cita `e2e/__fixtures__/casca.ts` | 6.0 | C | O `restos` dá zero; a string entra em `excecoesDoConferir` |
| `e2e/estrutura.spec.ts` e `e2e/lista-da-turma.spec.ts` | `e2e/__fixtures__/lista-excel.csv`, que a pasta carrega para `e2e/support/` | 6.0 | C | O e2e abre o arquivo: caminho esquecido falha alto |
| `apps/api/src/operacao/escola/escola.repository.test.ts` | a lista `IMPORTADORES_PERMITIDOS_DO_CASO_DE_USO` (`sessao-de-teste.ts`, `fila-de-teste.ts`) | 6.0 | A | O caso da varredura de importadores: um importador fora da lista, vermelho |
| `infra/test/{carga,expurgo-da-carga}.test.ts` e `infra/compose.yml` (381) | `apps/api/src/assistente/limite-de-pedidos-de-ia.ts` e `apps/worker/src/desligamento.test.ts` em string e em comentário | 6.0 | C | O `restos` dá zero; `docker compose config` igual |
| `knip.json` e `tools/guardas/__fixtures__/filtros/knip.json` | `src/estilos.css` | 6.0 | C | A trava contra filtro vazio (entries do `knip.json`) |
| `.size-limit.json` | o nome do arquivo e da pasta nos rótulos | 6.0 | C | O `restos` dá zero; o chunk que a regra mede não muda de nome |

## Achadas na 7.0

O relatório do `aplicar` da 7.0 achou estas, que a revisão da spec não listou (Tech Spec §5, passo 6). As linhas acima não mudam de número.

| Trava | O que lê pelo nome | Onda | Forma | Prova |
|---|---|---|---|---|
| a descrição de `Symbol('…')` de cada token de DI de `apps/api/src/` (`database.module.ts`, `rate-limit.module.ts`, `usage.module.ts`, `login-redis-client.ts`, `sessao.module.ts`, `operador.guard.ts`, `system/status.service.ts`, `system/notices.controller.ts`) | a descrição acompanha a constante (`inventario-back.md:565`) | 7.0 | C | O `restos` dá zero; a string entra em `excecoesDoConferir`. Nenhum teste lê a descrição |
| o `this.name` de `SegredoNaoDecifra`, `ArgumentoInvalido`, `OperadorRecusado`, `DesativacaoRecusada` e `ProvedorExternoFalhou` | o nome da classe, que o log (`tipo`) e a pilha mostram (adenda 1) | 7.0 | C | O `restos` dá zero; a string entra em `excecoesDoConferir`. Nenhum alerta nem o runbook o lê |
| `apps/api/src/sessao/login/login.service.test.ts`, `NOMES_QUE_SAIRAM` | `OrigemDaRequisicao` → `RequestOrigin`: o nome que não pode voltar a ser exportado pelo `login.service.ts` | 7.0 | B | O `login.service.ts` com `export type { RequestOrigin }`: o caso "nenhuma exportação do arquivo cita um dos sete nomes…" fica vermelho |
| `apps/api/test/architecture.test.ts`, o caso "nem o barrel de credencial/ exporta a ResolucaoDeTenantRepository…" | o controle positivo `toContain('HashDeSenha')` → `PasswordHasher`, e o rótulo `'ResolucaoDeTenantRepository'` (também no caso do barrel de `sessao/`), que dá o nome à mensagem e a `Object.keys` | 7.0 | A (o controle) e C (o rótulo, coberto pelo `Object.values` ao lado) | O controle com `'HashDeSenha'`: o barrel não tem a chave, e o caso fica vermelho |
| `architecture.test.ts`, o caso "operador.repository.ts não declara nem reexporta ConferenciaDoAutor" | `/\bConferenciaDoAutor\b/` → `AuthorCheck` | 7.0 | B | O `operador.repository.ts` com `export type AuthorCheck = unknown`: o caso fica vermelho |
| `tools/guardas/camadas.cjs` (`cerca-resolucao-de-tenant`, linha 147, e o `comment`) e `camadas.test.ts` (a chave, linha 142) | o nome da cerca acompanha a classe `TenantResolutionRepository` (observação do Orquestrador, levada da 6.0) | 7.0 | A | O `camadas.test.ts` com a chave antiga `'cerca-resolucao-de-tenant'`: o caso "toda regra da configuração tem a sua fixture, e nenhuma fixture é de regra que não existe" fica vermelho, porque o `camadas.cjs` não tem mais essa regra |
| `infra/scripts/carga-login.ts`, `carga-sala.ts`, `ensaio-alertas.ts`, as chaves `criarSessoesSinteticas` e `emissorDeTokenSintetico` do tipo literal de `importar<…>` e as chamadas que as usam | `createSyntheticSessions` e `syntheticTokenIssuer`: a chave é o que o `dist` da api exporta, e o `importar<T>` é uma afirmação de tipo, então a chave antiga compilaria e quebraria na execução (a mesma troca da chave `HashDeSenha`, linha 85) | 7.0 | C (`tsc`) | `tsc -p infra/tsconfig.json`: a chave antiga numa chamada dá `TS2339` nas três; o `restos` não olha a chave nem o membro (`7_task.md`, "Mutações") |

## Achadas na 8.0

O relatório do `aplicar` da 8.0 achou estas, que a revisão da spec não listou (Tech Spec §5, passo 6). As linhas acima não mudam de número.

| Trava | O que lê pelo nome | Onda | Forma | Prova |
|---|---|---|---|---|
| a descrição de `Symbol('…')` de cada token de DI de `apps/realtime/src/` (`app.module.ts`: `CLIENTE_REDIS_REALTIME`, `POOL_BANCO_REALTIME`; `system.gateway.ts`: `CONFIGURACAO_IDENTIDADE`, `LEITURA_DE_SESSAO`, `LOGGER_REALTIME`) | a descrição acompanha a constante (`inventario-back.md:565`) | 8.0 | C | O `restos` dá zero; a string entra em `excecoesDoConferir`. Nenhum teste lê a descrição |
| o `this.name` de `FalhaDeJob`, `ErroParaAFila` e `PrazoDaFilaEsgotado`, e o `name: 'FalhaDeJob'` que `expurgo-da-escola.int.test.ts` e `expurgo-de-acesso.int.test.ts` esperam da rejeição | o nome da classe, que o log (`tipo`) e a pilha mostram, e que aparece na pilha que o BullMQ grava no Redis (adenda 1; `inventario-back.md:559`) | 8.0 | A (`FalhaDeJob`, pelos dois testes) e C (os outros dois) | A: o `this.name` de `JobFailureError` no nome antigo deixa vermelhos os dois testes, que esperam `JobFailureError`. C: o `restos` dá zero nos outros dois; a string entra em `excecoesDoConferir`. Nenhum alerta nem o runbook lê o nome (`grep` em `infra/` e `docs/`) |
| `infra/compose.yml` (380), o comentário que cita `GRACA_DO_DESLIGAMENTO_MS` | a constante do worker, na justificativa do `stop_grace_period` | 8.0 | C | O `restos` dá zero; `docker compose config` sai igual (o comentário não entra na saída) |

## Achadas na 9.0

O relatório do `aplicar` da 9.0 achou estas, que a revisão da spec não listou (Tech Spec §5, passo 6). As linhas acima não mudam de número.

| Trava | O que lê pelo nome | Onda | Forma | Prova |
|---|---|---|---|---|
| `tools/processo/harness/guardioes.test.ts` (linhas 32, 33, 104 e 105) | o arquivo de exemplo de `EXCECOES` (`ui/Abas.tsx`, `ui/ai/AssinaturaIA.tsx`) e os exemplos de `pede` (`ui/ai/AvisoFila.tsx`, `ui/overlays/DialogoDeConfirmacao.tsx`) | 9.0 | A | Com o nome antigo, o caso que confere que cada exceção aponta um arquivo que existe (linha 99) fica vermelho |
| `tools/ci/tamanho-web.test.ts` (linha 148) | o chunk `pecas-CaixaPedido.js` do build de mentira | 9.0 | C | O `restos` dá zero. O chunk de mentira só precisa casar `pecas-*.js`, e passa a `pecas-PromptInput.js`, o nome que o build dá depois do move |
| `apps/web/src/components/states/estados.test.tsx` (linhas 168 e 181) | os nomes da lista `PECAS_FORA_DA_ENTRADA` (`ui/Aviso`, `ui/Contador`, `ui/Toque`) | 9.0 | A | Com o nome antigo, a lista de `chunk-names.ts` não tem a peça e o caso "a lista fechada tem as três peças novas" fica vermelho |

## Achadas na 10.0

O relatório do `aplicar` da 10.0 achou estas, que a revisão da spec não listou (Tech Spec §5, passo 6). As linhas acima não mudam de número.

| Trava | O que lê pelo nome | Onda | Forma | Prova |
|---|---|---|---|---|
| `apps/web/src/components/states/estados.test.tsx` (linha 169) | os arquivos `EstadoCarregando.tsx`, `EstadoErro.tsx` e `EstadoVazio.tsx`, que o caso lê do disco para conferir o que cada um importa | 10.0 | A | Com o nome antigo, o `readFileSync` não acha o arquivo e o caso "nenhum importa `Aviso`, `Contador`, `Toque` nem peça de `PECAS_FORA_DA_ENTRADA`" fica vermelho |
| o `this.name` de `ErroDaApi` (`apps/web/src/api/client.ts`) e o `name: 'ErroDaApi'` que `apps/web/src/api/eu.test.ts` (linhas 50 e 52) espera da rejeição | o nome da classe, que acompanha a classe (adenda 1) | 10.0 | A | Com o `this.name` no nome antigo, os dois casos de `eu.test.ts` ficam vermelhos |
| `apps/web/src/components/states/estados.test.tsx` (linha 32), a regex `/INDISPONIVEL\|503\|ErroDaApi/` | o nome da classe, que a tela de erro não pode mostrar (catálogo, sem texto cru) | 10.0 | B | A mutação põe `ApiError` num `<span>` fora do `alert` do `ErrorState` (depois do `</p>`), e só a negativa da linha 32 do caso "o `alert` é só a mensagem do catálogo" fica vermelho. Com o nome antigo na regex, a negativa passaria sem checar nada |
