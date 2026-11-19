# Correção — métodos e funções com verbo técnico em português, num código que já tem a peça técnica em inglês (D81)

**Origem:** uso. Pedido do Joaquim em 19/11/2026: "eu queria pegar os métodos de mercado […] e atualizar, não precisa de spec
mas tem que atualizar as skills […] o pessoal já tá mais acostumado com os métodos assim, com inglês ou inglês misturado com
português"; e, com a F4b parada na medida do modelo local, "poderia fazer agora […] e fazer em uma correção".
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`
<!-- Os quatro guardiões vêm do caminho (`guardioesDoCaminho`: a correção toca `apps/`, `packages/`, `e2e/` e `tools/guardas/`).
     `revisor-geral` porque altera muito mais de 5 arquivos fora de `tasks/` e toca `tools/ci/`. -->

## Sintoma

A X8 (`tasks/prd-nomes-de-mercado/`) deu nome de mercado à peça técnica (`TurmaController`, `XAdapter`, `InMemoryX`) e deixou
o método de fora do escopo. Ficou a base em dois idiomas no mesmo nome: `TurmaRepository.buscarPorId`,
`OrcamentoDeIa.consultar`, `LLMGateway.gerar`, `JobOutboxRepository.inserir`, `isAtivo` ao lado de `ehAtivo`. Quem chega do
Spring Data, do Drizzle ou do TypeORM procura `findById`, `create`, `delete`, `count`; lê `buscarPorId` como mecanismo
próprio. Nada impedia o verbo em português de nascer de novo.

## Fora desta correção

Nada: a árvore estava limpa. A correção sai de `spec/classificacao-bncc` em `8cab2ca5`, com a F4b parada antes da tarefa 10.0.

## Causa

Escopo da X8: o PRD trocou declaração de topo, arquivo e pasta, e deixou método, propriedade e variável local para "quando a
tarefa mexer" (`tasks/prd-nomes-de-mercado/guarda.md`, "Limite declarado"). Sem guarda, o padrão de cada arquivo novo foi o
do vizinho.

## O que muda e o que não muda

**Muda** o nome do método, da função e da propriedade de função cujo verbo é técnico, no `src` de cada app e pacote (o
método e a propriedade privados com `#` também) e nos testes que os chamam. Em `tools/`, `infra/scripts/` e `infra/k6/` mudaram
só os **chamadores** das APIs renomeadas: as declarações próprias de lá (`verificarRepositories`, `lerFontesDeProducao`,
`criarRegra`, `gerarAcesso`) seguem com o verbo em português, porque a guarda não cobre essas pastas e o recorte não as pede
(ficam no `TODO.md`). O verbo vai em inglês e o domínio fica em português:

| Português | Mercado | Português | Mercado |
|---|---|---|---|
| `ler`, `obter` | `read`, `get` | `buscar`, `consultar` | `find` (leitura que pode não achar) |
| `listar`, `contar` | `list`, `count` | `criar`, `inserir` | `create`, `insert` |
| `gravar`, `salvar` | `save` | `atualizar`, `alterar` | `update` |
| `apagar`, `excluir` | `delete` | `travar`, `liberar` | `lock`, `release` |
| `montar`, `gerar` | `build`, `generate` | `formatar`, `ordenar`, `filtrar`, `normalizar` | `format`, `sort`, `filter`, `normalize` |
| `validar`, `verificar` | `validate`, `verify` | `executar`, `iniciar`, `parar` | `run`, `start`, `stop` |
| `tentar`, `esperar` | `try`, `wait` | `enviar`, `publicar`, `consumir` | `send`, `publish`, `consume` |
| `limpar`, `abrir`, `fechar` | `clear`, `open`, `close` | `eh`, `tem`, `pode` | `is`, `has`, `can` |

`ler`/`obter`/`buscar`/`consultar` de repository viram `find` quando o retorno aceita `null` ou `undefined`, e `get`/`read`
quando sempre acha. Casos escolhidos à mão, porque a troca direta colidia ou enganava: `MaterialRepository.excluir` →
`softDelete` (exclusão lógica, regra 20.15); `consultar` do orçamento → `check` (`find` colidia com a leitura do mesmo
objeto); `apagarSenhaDaMatricula`/`apagarMfa` → `clear…`; `tentarDeNovo`/`buscarDeNovo` → `retry`/`refetch`;
`expurgar-acesso` `apagar` → `deleteAlvo` e `espelho-da-fila` `apagar` → `remove` (`delete` é palavra reservada no atalho);
`SessaoReader.lerParaGuarda` → `findParaGuarda`, o mesmo nome do `OperadorRepository`.

**Não muda:** o verbo de domínio (`aprovar`, `lancar`, `corrigir`, `matricular`, `encerrar`, `eliminar`, `esquecer`,
`entregar`, `registrar`, `conferir`, `renomear`); o ajudante de teste (`criarEscolaComProfessor`), que é cenário e não API;
e todo dado: código de permissão da matriz (`'disciplina', 'criar'`), rótulo de rota, nome de evento de log, tipo de job
(`ia.executar`), valor gravado no banco, texto de tela, mensagem de erro. O corpus selado `docs/aia/ouro*` não foi tocado.

## Como foi feito

O rename e a guarda foram feitos pelo Orquestrador, numa sessão fora do processo, a pedido do Joaquim (19/11/2026); a
árvore veio para este andar como patch, e daqui em diante segue o `corrigir`: portão, Mesa, commit e push pelo Implementador.

Pelo serviço de linguagem do TypeScript (`findRenameLocations`, com prefixo e sufixo no atalho de objeto), sobre os 11
projetos do monorepo de uma vez, a partir de um inventário por AST das declarações. Depois, uma passada com o verificador
de tipos para o que o rename não alcança: chave em `Pick<T, 'x'>` e `Omit`, acesso indexado, `vi.spyOn(obj, 'x')`, o
`vi.mock(caminho, () => ({ … }))`, o dublê com `as unknown as T`, e a lista ordenada que um teste compara. O atalho
`{ abrir }` que viraria `{ open }` e cairia no `window.open` global foi desfeito em `{ open: abrir }` pelo prefixo do serviço.

## Teste que reproduz

`tools/guardas/guardas.test.ts` › `guarda de verbo de mercado (correção 2026-11-19-metodos-de-mercado; D81)`, em especial
`o repositório de hoje não tem violação: nenhum método nem função de produção começa por verbo técnico em português`:
vermelho antes (a regra não existia; o inventário por AST achava 1.162 declarações no `src` de apps e pacotes), verde
depois (zero). Os outros casos do bloco provam a regra contra as fixtures `verbo-recusado.ts` (16 marcas: função, `const`
com função e com `function`, método de classe, estático, abstrato, privado `#` e propriedade privada com arrow, propriedade
com arrow e com tipo de função, método e propriedade de interface, método e propriedades de objeto) e `verbo-que-passa.ts` (verbo de mercado, verbo de domínio,
palavra que só começa igual, o que não é função, chave computada, chave entre aspas, atalho, privado `#` com verbo de mercado
e propriedade privada que não é função), que a regra vale só no `src`
e não no teste, no `__fixtures__`, no e2e, em `infra/` e em `tools/`, e que o `eslint-disable` não a desliga.

## Correção

- **O rename**, em 820 arquivos (`git diff --stat`), sem mudar comportamento: `npm run typecheck`, `npm run lint`, a unidade e o
  processo (525 arquivos, 9.934 testes) verdes. A integração inteira (`EDUCA_AMBIENTE_TESTE=0`, 188 arquivos) deu 3.874 de
  3.875: caiu `ia.int.test.ts` › "varredura do main-worker", com a `pendente` que tem job vivo encerrada como `falhou`.
  Não é do rename: a consulta (`ExecucaoRepository.encerrarPendentesSemJob`) não mudou, a varredura só trocou `iniciar`
  por `start` no mesmo chamador, e o caso passa sozinho e com o arquivo inteiro (51 de 51). É a dependência de ordem e do
  banco compartilhado que o `TODO.md` já registra, da correção `2026-11-16-varredura-do-main-worker`.
  No primeiro portão local, o e2e dos specs alterados deu 135 de 136: caiu `entrar-na-escola.spec.ts` › "seletor: a troca de
  escola espera uma vez…", no chromebook, com a nova conversa ainda em "Carregando…" na hora da medida (a mesma asserção da
  correção `2026-10-17-w2-carregando-estoura-o-prazo`). O diff do seletor e da casca é só nome (`fechar`/`abrir` →
  `close`/`open`, `espera.executar` → `espera.run`), e o spec rodado de novo passou inteiro (26 de 26).
  No segundo portão, o e2e passou inteiro (136 de 136) e caiu o de infra `alerta-de-classificacao-atrasada.int.test.ts`, duas
  vezes, com `TimeoutError` em `lerRegrasNoGrafana` (a leitura das regras tem 5 s). Não é do rename: o mesmo teste, rodado na
  base `8cab2ca5` num worktree à parte, cai do mesmo jeito, na mesma linha; na esteira da base ele passa. Medido com um monitor
  ao lado: o Grafana responde em ~5 ms parado e teve um pico de 5,5 s logo depois de subir; quando o pico cai dentro do laço
  de amostragem do teste, ele cai. Rodado de novo, passou. Fica para o `TODO.md` do andar: a leitura do teste não tolera um
  pico do Grafana local.
- **A guarda** `guardas/verbo-de-mercado` (`tools/guardas/regras-metodo.mjs`), registrada em `index.mjs` com escopo
  `apps/*/src/**` e `packages/*/src/**`, na passada sem comentários, com a exceção de teste e `__fixtures__` em
  `EXCECOES_DAS_GUARDAS`. A mensagem sugere o nome trocado (`lerTurma` → `readTurma`).
- **As listas que nomeiam método** acompanharam: `REPOSITORIES_SEM_ESCOPO` (`criar` → `create`, `inserir` → `insert`) e a
  lista exata do teste dela, e as expressões do `architecture.test.ts` que procuram a chamada do comando do operador.
- **Documentação:** o §9 do `docs/guia-do-desenvolvedor.md` ganha a tabela dos verbos, o escopo da trava (só o
  `src` de apps e pacotes, com o `#`) e o exemplo do controller com `create`/`delete` (métodos que o `DisciplinaController`
  tem); a skill `receitas-de-codigo` aponta para ela e para a trava; o exemplo da regra 30 chama `this.ia.generate`. A D81 revista (`docs/decisoes.md`, confirmada pelo Joaquim em 19/11/2026 pela `registrar-decisao`)
  entra no commit desta correção; a linha dela no `CLAUDE.md` não muda.

## Mutações

--faltando: 376 linhas (19 blocos, 0 motivos)

Os 19 blocos provam a guarda nova, cláusula a cláusula: o verbo só casa sozinho ou seguido de maiúscula, a sugestão só sai
para o verbo da lista, cada tipo de declaração que ela lê, a função anônima e a chave computada que ela pula, e a exceção de
teste e `__fixtures__` no `index.mjs`. As 376 linhas que o `--faltando` ainda lista são todas do rename: a condição de cada
uma já existia com o nome antigo e continua provada pelos mesmos testes, que agora chamam o nome novo
(`lockAnoEmCurso`, `hasLoteVigente`, `countAtivos`, `isArquivoRecebido`…). Não há condição nova fora da guarda; a prova
de que o comportamento não mudou é a unidade, o processo e a integração verdes com o diff aplicado.

O bloco que tira o `if (no?.type !== 'Identifier' && no?.type !== 'PrivateIdentifier') return` por inteiro não leva `falha:`: o vermelho dele é um `TypeError` dentro da regra
(`Cannot read properties of null (reading 'name')`, no `Property` da função anônima e da chave computada), lançado pelo
ESLint sem nenhuma linha do arquivo de teste na pilha, e não um `expect` que quebra.

```mutacao
arquivo: tools/guardas/regras-metodo.mjs
teste: tools/guardas/guardas.test.ts › deixa passar o verbo de mercado, o de domínio, a palavra que só começa igual, o que não é função, a função anônima, o computado, o entre aspas e o atalho
falha: lintar(eslintDasGuardas, PASSA, 'apps/api/src/x.ts', regras)).toEqual([])
-const VERBO = new RegExp(`^(${Object.keys(VERBOS_DE_MERCADO).join('|')})(?=$|[A-Z0-9])`)
+const VERBO = new RegExp(`^(${Object.keys(VERBOS_DE_MERCADO).join('|')})`)
```

```mutacao
arquivo: tools/guardas/regras-metodo.mjs
teste: tools/guardas/guardas.test.ts › deixa passar o verbo de mercado, o de domínio, a palavra que só começa igual, o que não é função, a função anônima, o computado, o entre aspas e o atalho
falha: lintar(eslintDasGuardas, PASSA, 'apps/api/src/x.ts', regras)).toEqual([])
   const achado = VERBO.exec(nome)
-  if (achado?.[1] === undefined) return null
+  if (achado?.[1] === undefined) return 'semVerbo'
```

```mutacao
arquivo: tools/guardas/regras-metodo.mjs
teste: tools/guardas/guardas.test.ts › deixa passar o verbo de mercado, o de domínio, a palavra que só começa igual, o que não é função, a função anônima, o computado, o entre aspas e o atalho
falha: lintar(eslintDasGuardas, PASSA, 'apps/api/src/x.ts', regras)).toEqual([])
-const isFuncao = (no) => FUNCOES.has(no?.type)
+const isFuncao = (no) => true
```

```mutacao
arquivo: tools/guardas/regras-metodo.mjs
teste: tools/guardas/guardas.test.ts › deixa passar o verbo de mercado, o de domínio, a palavra que só começa igual, o que não é função, a função anônima, o computado, o entre aspas e o atalho
falha: lintar(eslintDasGuardas, PASSA, 'apps/api/src/x.ts', regras)).toEqual([])
-const isTipoDeFuncao = (anotacao) => anotacao?.typeAnnotation?.type === 'TSFunctionType'
+const isTipoDeFuncao = (anotacao) => true
```

```mutacao
arquivo: tools/guardas/regras-metodo.mjs
teste: tools/guardas/guardas.test.ts › deixa passar o verbo de mercado, o de domínio, a palavra que só começa igual, o que não é função, a função anônima, o computado, o entre aspas e o atalho
falha: lintar(eslintDasGuardas, PASSA, 'apps/api/src/x.ts', regras)).toEqual([])
-const chave = (no) => (no.computed ? null : no.key)
+const chave = (no) => no.key
```

```mutacao
arquivo: tools/guardas/regras-metodo.mjs
teste: tools/guardas/guardas.test.ts › deixa passar o verbo de mercado, o de domínio, a palavra que só começa igual, o que não é função, a função anônima, o computado, o entre aspas e o atalho
     const conferir = (no) => {
-      if (no?.type !== 'Identifier' && no?.type !== 'PrivateIdentifier') return
       const sugestao = verboDeMercado(no.name)
```

```mutacao
arquivo: tools/guardas/regras-metodo.mjs
teste: tools/guardas/guardas.test.ts › recusa função, const com função, método de classe, abstrato, de interface e de objeto, e propriedade de função, no src de cada app e pacote
falha: toEqual(marcasDeViolacao(RECUSADO))
-      if (no?.type !== 'Identifier' && no?.type !== 'PrivateIdentifier') return
+      if (no?.type !== 'Identifier') return
```

```mutacao
arquivo: tools/guardas/regras-metodo.mjs
teste: tools/guardas/guardas.test.ts › recusa função, const com função, método de classe, abstrato, de interface e de objeto, e propriedade de função, no src de cada app e pacote
falha: toEqual(marcasDeViolacao(RECUSADO))
-      if (no?.type !== 'Identifier' && no?.type !== 'PrivateIdentifier') return
+      if (no?.type !== 'PrivateIdentifier') return
```

```mutacao
arquivo: tools/guardas/regras-metodo.mjs
teste: tools/guardas/guardas.test.ts › deixa passar o verbo de mercado, o de domínio, a palavra que só começa igual, o que não é função, a função anônima, o computado, o entre aspas e o atalho
falha: lintar(eslintDasGuardas, PASSA, 'apps/api/src/x.ts', regras)).toEqual([])
-      if (sugestao !== null) context.report({ node: no, messageId: 'verbo', data: { nome: no.name, sugestao } })
+      if (true) context.report({ node: no, messageId: 'verbo', data: { nome: no.name, sugestao } })
```

```mutacao
arquivo: tools/guardas/regras-metodo.mjs
teste: tools/guardas/guardas.test.ts › recusa função, const com função, método de classe, abstrato, de interface e de objeto, e propriedade de função, no src de cada app e pacote
falha: toEqual(marcasDeViolacao(RECUSADO))
-      FunctionDeclaration: (no) => conferir(no.id),
+      FunctionDeclaration: (no) => undefined,
```

```mutacao
arquivo: tools/guardas/regras-metodo.mjs
teste: tools/guardas/guardas.test.ts › recusa função, const com função, método de classe, abstrato, de interface e de objeto, e propriedade de função, no src de cada app e pacote
falha: toEqual(marcasDeViolacao(RECUSADO))
-        if (isFuncao(no.init)) conferir(no.id)
+        if (false) conferir(no.id)
```

```mutacao
arquivo: tools/guardas/regras-metodo.mjs
teste: tools/guardas/guardas.test.ts › recusa função, const com função, método de classe, abstrato, de interface e de objeto, e propriedade de função, no src de cada app e pacote
falha: toEqual(marcasDeViolacao(RECUSADO))
       },
-      MethodDefinition: (no) => conferir(chave(no)),
+      MethodDefinition: (no) => undefined,
       TSAbstractMethodDefinition: (no) => conferir(chave(no)),
```

```mutacao
arquivo: tools/guardas/regras-metodo.mjs
teste: tools/guardas/guardas.test.ts › recusa função, const com função, método de classe, abstrato, de interface e de objeto, e propriedade de função, no src de cada app e pacote
falha: toEqual(marcasDeViolacao(RECUSADO))
-      TSAbstractMethodDefinition: (no) => conferir(chave(no)),
+      TSAbstractMethodDefinition: (no) => undefined,
```

```mutacao
arquivo: tools/guardas/regras-metodo.mjs
teste: tools/guardas/guardas.test.ts › recusa função, const com função, método de classe, abstrato, de interface e de objeto, e propriedade de função, no src de cada app e pacote
falha: toEqual(marcasDeViolacao(RECUSADO))
-      TSMethodSignature: (no) => conferir(chave(no)),
+      TSMethodSignature: (no) => undefined,
```

```mutacao
arquivo: tools/guardas/regras-metodo.mjs
teste: tools/guardas/guardas.test.ts › recusa função, const com função, método de classe, abstrato, de interface e de objeto, e propriedade de função, no src de cada app e pacote
falha: toEqual(marcasDeViolacao(RECUSADO))
-        if (isFuncao(no.value) || isTipoDeFuncao(no.typeAnnotation)) conferir(chave(no))
+        if (isTipoDeFuncao(no.typeAnnotation)) conferir(chave(no))
```

```mutacao
arquivo: tools/guardas/regras-metodo.mjs
teste: tools/guardas/guardas.test.ts › recusa função, const com função, método de classe, abstrato, de interface e de objeto, e propriedade de função, no src de cada app e pacote
falha: toEqual(marcasDeViolacao(RECUSADO))
-        if (isFuncao(no.value) || isTipoDeFuncao(no.typeAnnotation)) conferir(chave(no))
+        if (isFuncao(no.value)) conferir(chave(no))
```

```mutacao
arquivo: tools/guardas/regras-metodo.mjs
teste: tools/guardas/guardas.test.ts › deixa passar o verbo de mercado, o de domínio, a palavra que só começa igual, o que não é função, a função anônima, o computado, o entre aspas e o atalho
falha: lintar(eslintDasGuardas, PASSA, 'apps/api/src/x.ts', regras)).toEqual([])
       TSPropertySignature: (no) => {
-        if (isTipoDeFuncao(no.typeAnnotation)) conferir(chave(no))
+        conferir(chave(no))
```

```mutacao
arquivo: tools/guardas/regras-metodo.mjs
teste: tools/guardas/guardas.test.ts › recusa função, const com função, método de classe, abstrato, de interface e de objeto, e propriedade de função, no src de cada app e pacote
falha: toEqual(marcasDeViolacao(RECUSADO))
       Property: (no) => {
-        if (isFuncao(no.value)) conferir(chave(no))
+        if (false) conferir(chave(no))
```

```mutacao
arquivo: tools/guardas/index.mjs
teste: tools/guardas/guardas.test.ts › fica entre as que a passada sem comentários roda, no src de apps e packages, e fora do teste, do __fixtures__, do e2e, de infra e de tools
falha: expect(await nivelEm(caminho), caminho).toBe(0)
-    files: [...ARQUIVOS_DE_TESTE, '**/__fixtures__/**'],
-    regras: REGRAS_DE_METODO,
+    files: ['**/__nenhum__/**'],
+    regras: REGRAS_DE_METODO,
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisor-geral (1ª) | `readBytes` (`FileStorage`, `S3FileStorage`) devolve `undefined` e `readData`/`readDia`/`readHorario` devolvem `null`: a convenção do guia diria `find` | `TODO.md`: decisão de nome que toca contrato de porta e parsers; a tabela do documento ("`ler`/`obter`/`buscar`/`consultar` de repository viram `find`…") fala de repository, e o parser não está nela |
| revisor-geral (1ª), test-engineer (1ª) | A guarda não lê `TSAbstractPropertyDefinition`, `TSDeclareFunction` nem propriedade com tipo união com função (`lerX?: (() => void) \| undefined`) | `TODO.md`: alarga a guarda e pode exigir renomear código que hoje passa; fica para a correção que fecha esses nós, com fixture e bloco de mutação |
| test-engineer (1ª) | `const x = useCallback(...)`, `useMutation(...)`, `useRef(...)` escapam da guarda | `TODO.md`, na mesma linha da anterior: o documento declara "`const` com função e com `function`", e o gancho do React não está no recorte |
| privacy-guardian (1ª) | `limparSaidaDoModelo` → `clearSaidaDoModelo` engana: `sanitize` ou `clean` diriam mais | Recusada: a tabela do documento ("O que muda") manda `limpar` → `clear`, e o nome diz o que a tabela define |
| privacy-guardian (1ª) | O par `guardarBytes`/`readBytes` fica misturado | Recusada: `guardar` não está na lista de verbos do documento (verbo de domínio fica) |
| revisor-geral (1ª), tenancy-guardian (1ª) | `openAnoLetivo` (antes `abrirAnoLetivo`): abrir o ano letivo pode ser ato de domínio | Sem aplicar: a tabela do documento lista `abrir` como técnico (`limpar`, `abrir`, `fechar` → `clear`, `open`, `close`); se é ato de domínio, é decisão do Validador, que o relatório da correção apontará |
| infra-guardian (1ª) | `gerarAcesso` em `infra/k6/importacao-7h30.js` segue em português | `TODO.md`: `infra/k6/` está fora do escopo declarado e fora do typecheck e da guarda; o `exec` do k6 aponta para o mesmo nome |
| conformidade-reviewer (2ª), revisor-geral (2ª), infra-guardian (2ª) | `#canComecar` em `apps/api/src/ia/execucao.processor.ts` mistura `can` com `Comecar`; "`#canStart` ou `#shouldStart` diria mais" | `TODO.md`: nome de um método privado; a tabela do documento manda `pode` → `can`, e a troca do resto do nome é de leitura, não de contrato |
| revisor-geral (2ª) | `packages/core/src/estrutura/turma.repository.ts:202`: o comentário do `createNoAno` ainda diz "(como o `criar`…" | `TODO.md`, junto com a anterior (sobra de comentário, sem efeito) |
| privacy-guardian (2ª), test-engineer (2ª), infra-guardian (2ª) | `packages/core/src/identidade/sessao.guard.ts:42` (`#liberarAviso = throttledWarn(...)`) escapa da guarda: o valor é chamada que devolve função | `TODO.md`: citado como exemplo na linha "Alargar a guarda", que já trata `useCallback`/`useRef` |
| test-engineer (2ª) | Os títulos dos dois testes das fixtures (`recusa função, const com função, …` e `deixa passar o verbo de mercado, …`) não citam o privado `#` | `TODO.md`: o título é o `it` que o documento e as mutações citam pelo nome; renomear mexe nos blocos de "Mutações" de novo |
| tenancy-guardian (2ª) | Decidir se `openAnoLetivo` (antes `abrirAnoLetivo`) é ato de domínio | Já está na tabela da rodada 1 como "fica para o Validador"; sem linha nova |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-19 15:55:54 | 2026-11-19 15:58:52 | `revisor-geral` | 1 | APROVADO | af106de4ce0c45090 |
| 2026-11-19 15:55:59 | 2026-11-19 15:59:01 | `privacy-guardian` | 1 | APROVADO | a02b331079ddf65dd |
| 2026-11-19 15:55:59 | 2026-11-19 15:59:09 | `tenancy-guardian` | 1 | APROVADO | a8d343ad7146b41d5 |
| 2026-11-19 15:56:00 | 2026-11-19 15:59:31 | `conformidade-reviewer` | 1 | APROVADO | aa0128a9e53c54fb9 |
| 2026-11-19 15:55:52 | 2026-11-19 16:00:40 | `test-engineer` | 1 | REPROVADO | ab2d74a2720c5a26c |
| 2026-11-19 15:56:02 | 2026-11-19 16:01:43 | `infra-guardian` | 1 | APROVADO | ae7316583518e9f4b |
| 2026-11-19 17:55:59 | 2026-11-19 17:56:38 | `conformidade-reviewer` | 2 | APROVADO | a311414fd322bd32f |
| 2026-11-19 17:55:45 | 2026-11-19 17:56:41 | `revisor-geral` | 2 | APROVADO | aa837b8da1f62f81e |
| 2026-11-19 17:55:56 | 2026-11-19 17:56:43 | `privacy-guardian` | 2 | APROVADO | ab99150999fad640d |
| 2026-11-19 17:55:40 | 2026-11-19 17:56:52 | `test-engineer` | 2 | APROVADO | a88e9eacc0c81326d |
| 2026-11-19 17:55:50 | 2026-11-19 17:57:47 | `tenancy-guardian` | 2 | APROVADO | a62fafac160e2921b |
| 2026-11-19 17:56:04 | 2026-11-19 18:00:10 | `infra-guardian` | 2 | APROVADO | a4616ae1dd5d0d4d9 |
