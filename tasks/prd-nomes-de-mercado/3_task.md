# Tarefa 3.0 — Onda do `shared`: schemas, DTOs, erros e as pastas `erros/` e `sistema/`

**Funcionalidade:** nomes-de-mercado · **Depende de:** 2.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `test-engineer`, `revisor-geral`
**Porte:** grande

## Objetivo

Todas as peças do `packages/shared` passam ao nome de mercado: os schemas zod, os DTOs, os erros e as pastas `erros/` e
`sistema/`. As chaves do JSON e os códigos de erro ficam como estão, e as travas das regras 20 continuam recusando o
que recusavam.

## Contexto necessário

- `tasks.md`, "O procedimento de cada onda"
- `techspec.md` §5 (o mapa e o `conferir`), §7 e §10
- `prd.md` RF3, RF7 e RF11
- `inventario-core-shared.md`: as linhas com "Onde" em `shared/` (§4, nas linhas 158 a 183; §5, §14 e §15), as pastas `erros/` e `sistema/` (§16),
  as linhas `shared/` do §17 e "Não muda, mas parece". As cinco linhas `packages/shared` de `inventario-adenda-2.md`
- `inventario.md` §1, a adenda 1 (o `this.name` acompanha a classe) e a 3
- `travas.md`, as linhas com 3.0 na coluna "Onda"
- `.claude/rules/20-lgpd-menores.md`, itens 4 e 11

## Subtarefas

- [x] 3.1 — O mapa `tools/renomear/mapas/3.json`
- [x] 3.2 — O `aplicar`, e a classificação das ocorrências do relatório
- [x] 3.3 — As travas: `NOME_DA_CLASSE_DE_INVARIANTE`, o filtro `endsWith('ResponseSchema')` e as chaves de
  `EXCECOES_NOMINAIS` em `contratos.test.ts`, e o `this.name` em `erro.int.test.ts` e em `erro-de-invariante.test.ts`.
  O `not.toContain('Error')` da linha 150 fica mais estrito, e isso vai para o mapa
- [x] 3.4 — O `conferir` e o `restos` verdes. A busca de cada nome antigo em `apps/web/src`, `e2e/` e `docs/`, com a
  saída no documento
- [x] 3.5 — Os blocos de mutação

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/` | alterado |
| `apps/` | alterado |
| `e2e/` | alterado |
| `infra/test/` | alterado |
| `infra/scripts/` | alterado |
| `tools/guardas/` | alterado |
| `tools/ci/borda.test.ts` | alterado: só o import e o uso de `CodigoDeErro` e `MENSAGENS_DE_ERRO` (linhas 1, 89 e 90); as linhas 78 e 95 são da 5.0 (`travas.md`) |
| `tools/renomear/mapas/` | novo |
| `CLAUDE.md` | alterado |
| `.claude/` | alterado |
| `docs/` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| `conferir` | ferramenta | nenhuma string, regex, `JsxText` ou chave muda fora das exceções, e os casos são os mesmos (RF7); uma peça renomeada fora do mapa fica vermelha | |
| `restos` | ferramenta | nenhum `de` do mapa sobra (RF3) | |
| esteira | esteira | tipagem, lint, guardas, unidade, integração e e2e verdes | |
| `{ esquemaX }` | `conferir` | a chave do schema fica, e o DTO de saída é o mesmo (regra 20, item 4) | |
| `PedidoDoTitular`, `RespostaSalva` e `RespostaAProposta` | busca na árvore | ficam, porque são domínio (triagem do Arquiteto, `efd23674`) | a busca de "Busca dos nomes antigos (3.4)": os três presentes em `packages/shared/src/privacidade/titular.ts`, `packages/shared/src/atividade/prova.ts` e `packages/shared/src/assistente/conversa.ts` |
| `NOME_DA_CLASSE_DE_INVARIANTE`, forma A | mutação | `new InvariantException(\`${aluno.nome}\`)`: vermelho | |
| `contratos.test.ts`, forma A | mutação | os três pontos trocados (o filtro, a lista de nomes e as duas chaves de `EXCECOES_NOMINAIS`) deixam o caso vermelho; a fixture com `email` na saída continua vermelha com o nome novo. **A igualdade do conjunto varrido (97 do `HEAD` = 96 de agora + `respostaSalvaSchema`, nome a nome) é conferência manual do documento, não mutação** | |
| `erro.int.test.ts`, `toMatchObject` com `erro: { tipo: 'InvariantException' }`, e `invariant.exception.test.ts`, `expect(erro.name).toBe('InvariantException')`, forma A | mutação | vermelho com o nome antigo | |
| `erro.int.test.ts`, `not.toContain('InvariantException')`, forma B | mutação | o filtro que vaza o nome no corpo: vermelho na linha do nome, antes do envelope | |

## Como testar

- O procedimento de cada onda está no `tasks.md`; os comandos, em `tools/renomear/`.
- A guarda de erro: `tools/guardas/guardas.test.ts › guarda de erro tipado`. Com `lintar(eslintDasGuardas, fixture,
  caminhoSimulado)`, a fixture de `__fixtures__/` traz a marca `reprova:` na linha.
- O contrato: `apps/api/test/contratos.test.ts`. Rode `npx vitest run --project unidade apps/api/test/contratos.test.ts`.
- O erro na resposta: `npx vitest run --project integracao apps/api/test/erro.int.test.ts`.
- A forma B põe o nome novo proibido no código sob teste: a mutação é no filtro de erro, e não no teste.

## Autoconferência

As 12 perguntas do modelo, no plano. Na 5, o `contratos.test.ts` varre o mesmo conjunto: compare a lista de nomes
antes e depois, pelo mapa, e não só a contagem.

## Fora do escopo desta tarefa

O core (4.0 e 5.0) e os apps, a não ser o import e o uso que o rename do `shared` arrasta.

## Divergências resolvidas nesta tarefa

- 2026-10-30, Arquiteto: o `aplicar` recusou `tools/ci/borda.test.ts` (fora dos previstos), que importa `CodigoDeErro` de `@educa/shared`. É o import que o rename arrasta ("Fora do escopo"): o arquivo entra nos previstos, restrito ao import e ao uso. Nenhum outro arquivo de `tools/ci/` usa nome da onda.
- 2026-10-30, Implementador: o mapa 3 saiu com 475 entradas e deixou de fora 26 linhas de `inventario-core-shared.md` que têm "Onde" em `shared/`, mas estão no §4 (Fila): `DEFINICOES_DE_JOB` e as outras 11 de `definicoes-de-job.ts` (158 a 169), as 8 de `jobs-sinteticos.ts` (170 a 177) e as 6 de `jobs.ts` (178 a 183: `FILAS`, `Fila`, `EstadoDeJob`…). Nem a 3.0 (que lista §5, §14 e §15) nem a 4.0 (que lista "Onde" em `nucleo/`) as pegava, e o objetivo da 3.0 é todas as peças do `packages/shared`. Entraram no mapa, com a linha do anexo de cada uma (158 a 183): são 501 entradas, e o `aplicar` foi refeito do `HEAD`. As adendas 2 (`esquemaDoPedido` e `esquemaRecusaChaveAMais`, no mesmo `definicoes-de-job.ts`) já estavam. A 4.0 não renomeia mais nada disso, e o `FILAS` que o worker e o compose lêem como variável de ambiente fica (`fica`, "Não muda, mas parece").
- 2026-10-30, Arquiteto (triagem `efd23674`, rodada 1): ratificou as linhas 158 a 183 do §4 na 3.0 (nota na linha 122 do inventário). `RespostaSalva` e `RespostaAProposta` ficam por serem domínio e saíram do mapa (499 entradas); `esquemaRespostaSalva` virou `respostaSalvaSchema`, fora do `endsWith('ResponseSchema')` (96 na varredura); `travas.md:53` atualizada.

## Busca dos nomes antigos (3.4)

`git ls-files apps/web/src e2e docs`, 708 arquivos, com `grep -nwF` dos 482 nomes antigos de símbolo do mapa. Saíram 14
achados, e nenhum é uso do símbolo:

- `Fila` como palavra comum do português (a fila das 7h30, "Fila vazia", "Fila de jobs", a coluna "Fila" da tabela do guia):
  `apps/web/src/api/sessao.ts` (38, 539 e 560), `apps/web/src/operacao/api/sessao.ts` (44), `Painel.tsx` (165),
  `docs/interface.md` (753, 1071 e 1829), `docs/infra.md` (352), `docs/ingestao.md` (54), `docs/guia-do-desenvolvedor.md` (288),
  `docs/processo-licoes.md` (80) e `docs/decisoes.md` (43). Ficam: o relatório os registra na troca à mão.
- `apps/web/src/areas/professor/ferramentas/ferramentas.test.ts` (206): o título do caso diz `ErroDeInvariante`. O título é a
  frase da regra e continua em português (RF6).

`e2e/` não cita nenhum.

`RespostaSalva` e `RespostaAProposta` ficam (domínio, triagem do Arquiteto): saíram do mapa 3, que ficou com 499 entradas (482 símbolos), e a busca na árvore mostra os dois tipos e `PedidoDoTitular` presentes: `packages/shared/src/atividade/prova.ts` (`RespostaSalva`), `packages/shared/src/assistente/conversa.ts` (`RespostaAProposta`) e `packages/shared/src/privacidade/titular.ts` (`PedidoDoTitular`).

A saída da árvore que vai para o commit, depois dos itens 1, 3 e 4 da rodada 1:

```
conferir: verde. 209404 itens na foto de antes, nenhuma diferença que o mapa não explique.
restos: limpo. 1 mapas, nenhum nome antigo sobrou.
```

O `3.relatorio.md` é o do `aplicar` (501 entradas, 484 símbolos); as duas entradas tiradas depois não mudam nenhuma troca que ele lista, e a linha de contagem dele foi corrigida à mão para 499 (482).

## Mutações

Um bloco por trava (Tech Spec §10). Os dois casos de `erro.int.test.ts` contam como uma trava, com um bloco para cada
forma.

A guarda de erro tipado (`travas.md`, regra 20, linha 1). Forma A: `NOME_DA_CLASSE_DE_INVARIANTE` volta ao nome antigo, e a
fixture, que agora usa `new InvariantException(\`${valor}\`)`, deixa de ser reprovada.

```mutacao
arquivo: tools/guardas/regras-erro.mjs
teste: tools/guardas/guardas.test.ts › reprova Error genérico, texto e literal lançados e o motivo do ErroDeInvariante que não é texto fixo
-const NOME_DA_CLASSE_DE_INVARIANTE = 'InvariantException'
+const NOME_DA_CLASSE_DE_INVARIANTE = 'ErroDeInvariante'
```

O `contratos.test.ts` (regra 20, item 4). Forma A, em três pontos: o filtro, a lista de nomes e as chaves de
`EXCECOES_NOMINAIS`. O conjunto varrido é o de antes, nome a nome pelo mapa: o `HEAD` tem 97 `export const esquemaResposta*`
(95 do mapa original, mais `esquemaRespostaEstadoDeJob` e `esquemaRespostaJobAceito`, da divergência em "Divergências resolvidas"), a
árvore tem 96 `export const *ResponseSchema`, e a lista de antes passada pelo mapa é igual à de agora, menos `respostaSalvaSchema` (antes `esquemaRespostaSalva`): a resposta que o aluno já salvou é domínio, o tipo `RespostaSalva` fica, e o schema sai do `endsWith('ResponseSchema')`, com os campos ainda varridos por dentro de `provaResponseSchema.respostas` (triagem do Arquiteto, `efd23674`). Nenhum `*ResponseSchema`
existia antes da onda. A fixture com `email` na saída (`alunosDaTurmaResponseSchema`) continua vermelha com o nome novo.

```mutacao
arquivo: apps/api/test/contratos.test.ts
teste: apps/api/test/contratos.test.ts › a varredura enxerga os contratos exportados, e os campos deles
-  nome.endsWith('ResponseSchema') && valor instanceof z.ZodType ? [[nome, valor] as [string, z.ZodType]] : [],
+  nome.startsWith('esquemaResposta') && valor instanceof z.ZodType ? [[nome, valor] as [string, z.ZodType]] : [],
```

```mutacao
arquivo: apps/api/test/contratos.test.ts
teste: apps/api/test/contratos.test.ts › a varredura enxerga os contratos exportados, e os campos deles
-      expect.arrayContaining(['contextResponseSchema', 'systemStatusResponseSchema', 'avisosResponseSchema', 'jobStateResponseSchema', 'jobAcceptedResponseSchema', 'configurarMfaResponseSchema', 'ativarMfaResponseSchema']),
+      expect.arrayContaining(['esquemaRespostaContexto', 'esquemaRespostaEstado', 'esquemaRespostaAvisos', 'esquemaRespostaEstadoDeJob', 'esquemaRespostaJobAceito', 'esquemaRespostaConfigurarMfa', 'esquemaRespostaAtivarMfa']),
```

```mutacao
arquivo: apps/api/test/contratos.test.ts
teste: apps/api/test/contratos.test.ts › a exceção do segredo vale só no contrato do configurar: o mesmo campo em outro contrato é reprovado
 const EXCECOES_NOMINAIS: Readonly<Record<string, readonly string[]>> = {
-  configurarMfaResponseSchema: ['segredo'],
+  esquemaRespostaConfigurarMfa: ['segredo'],
```

A segunda chave de `EXCECOES_NOMINAIS` (`travas.md:53`, "as chaves"): `configurarSegundoFatorDeOperadorResponseSchema` volta ao nome
antigo, a exceção do segredo deixa de valer para o contrato e a varredura reprova o campo `segredo`.

```mutacao
arquivo: apps/api/test/contratos.test.ts
teste: apps/api/test/contratos.test.ts › nenhum contrato de resposta exportado tem campo proibido
 const EXCECOES_NOMINAIS: Readonly<Record<string, readonly string[]>> = {
   configurarMfaResponseSchema: ['segredo'],
-  configurarSegundoFatorDeOperadorResponseSchema: ['segredo'],
+  esquemaRespostaConfigurarSegundoFatorDeOperador: ['segredo'],
```

O `this.name` acompanha a classe (adenda 1). Forma A em `erro.int.test.ts` (o `toMatchObject` com `erro: { tipo: 'InvariantException' }`) e em
`invariant.exception.test.ts` (o `expect(erro.name).toBe('InvariantException')`): o nome antigo no `this.name`.

```mutacao
arquivo: packages/shared/src/errors/invariant.exception.ts
teste: apps/api/test/erro.int.test.ts › ErroDeInvariante vira ERRO_INTERNO 500 sem o motivo na resposta, e o log leva só o nome da classe
-    this.name = 'InvariantException'
+    this.name = 'ErroDeInvariante'
```

```mutacao
arquivo: packages/shared/src/errors/invariant.exception.ts
teste: packages/shared/src/errors/invariant.exception.test.ts › leva o motivo na message e é um Error com o próprio nome
-    this.name = 'InvariantException'
+    this.name = 'ErroDeInvariante'
```

Forma B em `erro.int.test.ts` (as duas linhas `not.toContain` do caso da invariante, agora antes de
`esperarEnvelopeSemVazamento`, por ordem da rodada 1): o filtro de erro que deixa vazar o nome da classe no corpo da
resposta cai na linha do nome (`not.toContain('InvariantException')`), e não na igualdade estrita da mensagem do envelope. O
`not.toContain('Error')` da linha 150 fica mais estrito com as classes `…Error` das ondas seguintes (`LLMError`,
`JobRequestRejectedError`): nenhuma delas pode aparecer no corpo, e esta onda só o registra.

```mutacao
arquivo: packages/nucleo/src/erro/filtro-global.ts
teste: apps/api/test/erro.int.test.ts › ErroDeInvariante vira ERRO_INTERNO 500 sem o motivo na resposta, e o log leva só o nome da classe
-      erro: { codigo: erro.codigo, mensagem: MENSAGENS_DE_ERRO[erro.codigo], requisicaoId },
+      erro: { codigo: erro.codigo, mensagem: excecao instanceof Error ? excecao.name : MENSAGENS_DE_ERRO[erro.codigo], requisicaoId },
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| infra-guardian (1ª) | Uma linha no `docs/runbook.md` ou na nota do pouso: o `erro.tipo` do log do erro interno passou de `ErroDeInvariante` para `InvariantException`, junto com as classes `…Error` das ondas 4.0 e 5.0 | 13.0 (onda dos documentos, que mexe no runbook e no guia), ou a nota do pouso. Nenhum alerta depende do nome hoje. Não é da 3.0: o `runbook.md` fica fora dos arquivos que ela altera |
| infra-guardian (1ª) | Rodar `infra/test/borda.int.test.ts` na esteira antes do merge | Já coberto: o portão da tarefa roda os testes de infra que a árvore alterou, e `infra/test/borda.int.test.ts` está alterado; a esteira roda `test:infra` no push da spec |
| tenancy-guardian (1ª) | `tools/renomear/mapas/` ainda não está rastreado e precisa entrar no commit | Já previsto em "Arquivos previstos" (`tools/renomear/mapas/`, novo). Entra no commit da tarefa: confira com `git status --short tools/renomear/mapas/` antes do commit |
| conformidade-reviewer (1ª) | `PedidoSemCorpo`, tipo local em `apps/api/src/sala/acesso-da-turma/acesso-da-turma.controller.ts:9`, tem o mesmo nome de um símbolo do mapa (`EmptyBodyRequest`) | 7.0 (onda da api, símbolos), que toca esse arquivo. Não é uso do `shared`; o Arquiteto decide lá se o tipo local acompanha o nome de mercado |
| privacy-guardian (1ª) | `packages/nucleo/src/ia/README.md:50` ainda cita `CodigoDeErro` | 13.0 (onda dos documentos, "os README"). É prosa em README, fora do `conferir` |
| privacy-guardian (1ª) | Títulos de caso ainda dizem `ErroDeInvariante` (`erro.int.test.ts:160`, `invariant.exception.test.ts:4,13`, `acoes.test.ts:14`, `guardas.test.ts:419,430`, `ferramentas.test.ts:206`) | Recusada: o título é a frase da regra e fica em português (RF6, e a seção "Busca dos nomes antigos" do documento). Se a retro quiser o nome do símbolo no título, é onda de texto |
| revisor-geral (1ª) | O Arquiteto ratificar a divergência do §4 (as 26 linhas de Fila, 158 a 183), que passa a valer também para a 4.0 | Vai junto com a `/seguir DIVERGÊNCIA` do item 4, ao Orquestrador, para o Arquiteto ratificar de uma vez. A decisão é do Arquiteto, não da Mesa |
| revisor-geral (1ª) | Na coluna "Nome" do relatório do `restos`, o rótulo `packages/shared/src/sistema/...` engana nas rotas `/v1/sistema/...` e em `sistema.gateway.js` | `TODO.md` (ferramenta `tools/renomear`, fora dos arquivos da 3.0). As classificações `fica` estão certas |
| test-engineer (2ª), revisor-geral (2ª), privacy-guardian (2ª) | O `3.relatorio.md` teve a linha de contagem corrigida à mão para 499 (482), mas o corpo continua o do `aplicar` com 501 entradas; refazer o `aplicar` do mapa atual, ou anotar a edição no próprio relatório | Não aplicar: o `3_task.md` (seção "Busca dos nomes antigos") já registra a edição, e refazer o `aplicar` reescreve o relatório inteiro por uma linha de contagem, com o risco de mexer em 657 arquivos. O relatório da 4.0 nasce do `aplicar` dela. Fica no `TODO.md` se a retro quiser o relatório sempre gerado |
| revisor-geral (2ª) | O comentário de duas linhas de `apps/api/test/erro.int.test.ts:163-164` pode ficar em uma linha | Recusada: é só estilo, e mexer em arquivo de teste caduca de novo o `test-engineer` e o `revisor-geral` sem ganho |
| infra-guardian (2ª) | O `packages/shared/dist/` traz os nomes antigos em `.d.ts` gerado; regerar antes da esteira | Não é do repositório: `dist/` está no `.gitignore` (linha 15), e o portão da tarefa e a esteira reconstroem o pacote |
| test-engineer (3ª) | `3_task.md:30` e `:189` citam o `'Error'` da lista de proibidos pela "linha 150"; trocar pela asserção ("a lista de proibidos do caso 'exceção não tratada vira ERRO_INTERNO 500…'"), como `travas.md:54` faz | Não aplicar: o número está certo hoje (o revisor conferiu), e a recomendação é de quem aprovou, que só entra em ordem na primeira ordem do documento. Mexer no `3_task.md` agora não muda comportamento nem contrato. Fica para a 4.0, que reescreve a linha de `travas.md:54` e lê a trava pelo texto |
| test-engineer (3ª) | `3_task.md:132`: o período do `respostaSalvaSchema` e da triagem `efd23674` continua comprido; dividir em duas frases | Recusada: é só estilo, e a frase já foi encurtada na `:131` por pedido da rodada 2 |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-10-30 16:44:20 | 2026-10-30 16:45:37 | `infra-guardian` | 1 | APROVADO | af96087bba5a33775 |
| 2026-10-30 16:44:15 | 2026-10-30 16:45:51 | `tenancy-guardian` | 1 | APROVADO | aa92a36846434d134 |
| 2026-10-30 16:44:18 | 2026-10-30 16:46:16 | `conformidade-reviewer` | 1 | APROVADO | a9edd5b12b87abc82 |
| 2026-10-30 16:44:17 | 2026-10-30 16:47:36 | `privacy-guardian` | 1 | APROVADO | ac1460a3987c712e8 |
| 2026-10-30 16:44:23 | 2026-10-30 16:47:59 | `revisor-geral` | 1 | REPROVADO | acfa9c2ebcd6ca17d |
| 2026-10-30 16:44:22 | 2026-10-30 16:51:16 | `test-engineer` | 1 | REPROVADO | ac9c764586bd38d5f |
| 2026-10-30 18:05:40 | 2026-10-30 18:05:55 | `tenancy-guardian` | 2 | APROVADO | a837cb3b615415cb1 |
| 2026-10-30 18:05:52 | 2026-10-30 18:06:33 | `privacy-guardian` | 2 | APROVADO | ada9542a242f44b7a |
| 2026-10-30 18:06:05 | 2026-10-30 18:06:36 | `conformidade-reviewer` | 2 | APROVADO | a8b2765e8bf513c8d |
| 2026-10-30 18:06:18 | 2026-10-30 18:07:02 | `infra-guardian` | 2 | APROVADO | a902a84e4c39590c9 |
| 2026-10-30 18:06:47 | 2026-10-30 18:07:32 | `revisor-geral` | 2 | APROVADO | a71f7998bd5b9b022 |
| 2026-10-30 18:06:33 | 2026-10-30 18:08:13 | `test-engineer` | 2 | REPROVADO | adaa3039f30e1a573 |
| 2026-10-30 19:12:09 | 2026-10-30 19:12:56 | `test-engineer` | 3 | APROVADO | a91d01b19cfbc4f4c |
