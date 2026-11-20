# Correção — três `@Unscoped` sobre `habilidade_bncc` no módulo `material`, contra a Tech Spec §6 e sem registro na §11

**Origem:** `tasks/prd-classificacao-bncc/validacao.md`, seção 4, ressalva maior 1 (validação da classificacao-bncc, APROVADA COM RESSALVAS). O Joaquim mandou corrigir em 20/11/2026.
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `test-engineer`, `revisor-geral`
<!-- O PEDIDO do Orquestrador ditou `tenancy-guardian`, mas a Mesa conferiu a linha contra os arquivos alterados: os de `apps/` e `packages/` pedem os quatro guardiões
     (`tools/processo/guardioes-por-caminho.ts`), e o `test-engineer` é obrigatório em toda correção. A correção passa de 5 arquivos fora de `tasks/` (o repository novo, o índice do core,
     `secoes.repository.ts`, `cobertura.repository.ts`, `material.service.ts`, `classificar-secoes.command.ts`, `artefato.service.ts` e os testes) mas não toca `.github/`, `tools/ci/` nem `tools/processo/`;
     o limite do passo 5 de `corrigir` é de mais de 5 arquivos, e por isso o `revisor-geral` também é marcado. -->

## Sintoma

Três métodos públicos de repository do módulo `material` levam `@Unscoped` para ler a mesma tabela pública, `habilidade_bncc`:
`SecoesRepository.candidatas` (`secoes.repository.ts:145`), `SecoesRepository.descricaoDaHabilidade` (`:268`) e
`CoberturaRepository.habilidadesDaSerie` (`cobertura.repository.ts:71`). A Tech Spec §6 diz "nenhum `@Unscoped` novo", a §11 não registra o
desvio, e a regra 10, item 9, diz que a terceira exceção no mesmo módulo é sinal de desenho errado. **Não é vazamento**: a tabela é pública
(regra 10, item 1) e os três só devolvem código, texto e grupo de habilidade.

## Fora desta correção

Nada: a árvore estava limpa. A ressalva maior 2 da validação (a descrição da habilidade gravada na questão, que vem do modelo) é outra correção e não entra aqui.

## Causa

A 11.0 pôs o primeiro `@Unscoped` (a troca da habilidade lia o texto oficial) e a 13.0 pôs o terceiro (a cobertura lia as habilidades da série), cada uma
resolvendo a sua leitura no repository que já estava aberto, com a justificativa da tabela pública, e sem olhar o conjunto: na 11.0 o `tenancy-guardian`
recusou juntar porque "eram duas", e a 13.0 trouxe a terceira. A leitura da BNCC não tem dono: cada repository com escopo de escola leu a tabela que não tem escola.

## Teste que reproduz

- `apps/api/test/architecture.test.ts` › ``arquitetura: a leitura da tabela pública da BNCC é do BnccRepository, com um único método @Unscoped, e o módulo `material` não tem exceção``: vermelho no HEAD (o módulo `material` tem três métodos marcados e o `BnccRepository` não existe), verde depois.
- `packages/core/src/bncc/bncc.repository.int.test.ts`: o que o repository único devolve, contra a tabela carregada (as candidatas da etapa, as da série, o texto de um código).

## Correção

Um `BnccRepository` em `packages/core/src/bncc/`, com **um** método `@Unscoped`, `habilidades(filtro)` (por etapas, por série ou por código), e os três usos passam por ele. Os dois
repositories do módulo `material` ficam sem `@Unscoped`; o que era regra de negócio (a candidata do recorte e o texto no tamanho do contrato) vai para
`apps/api/src/material/habilidades-do-recorte.ts`, que não toca o banco; o grupo da cobertura é calculado no SQL do `BnccRepository` e a cobertura o lê direto. O tipo da candidata é o
`HabilidadeCandidataBncc` do `@educa/shared`, que o contrato da rota já usa. Registro na Tech Spec §6 e §11.

## Mutações

--faltando: 0 linhas (0 blocos, 0 motivos)

A leitura única da BNCC: cada cláusula do `recorteDe` e o `.where`, no teste de integração do núcleo.

```mutacao
arquivo: packages/core/src/bncc/bncc.repository.ts
teste: packages/core/src/bncc/bncc.repository.int.test.ts › por etapa: só as da etapa pedida, na ordem do código, e o Médio e o Fundamental juntos quando os dois são pedidos
-  if ('etapas' in filtro) return inArray(habilidadeBncc.etapa, [...filtro.etapas])
+  if ('etapas' in filtro) return undefined
```

```mutacao
arquivo: packages/core/src/bncc/bncc.repository.ts
teste: packages/core/src/bncc/bncc.repository.int.test.ts › por código: o texto oficial de uma habilidade, e nada para o código que a tabela não tem
-  if ('codigo' in filtro) return eq(habilidadeBncc.codigo, filtro.codigo)
+  if ('codigo' in filtro) return undefined
```

A série sem a etapa: o Médio pediria `anos @> [ano]` sobre linhas sem ano e, sem o `eq` da etapa, o `em` leria a tabela toda.

```mutacao
arquivo: packages/core/src/bncc/bncc.repository.ts
teste: packages/core/src/bncc/bncc.repository.int.test.ts › por série: no Fundamental só as que listam o ano, e no Médio todas, sem olhar o ano
-  return and(eq(habilidadeBncc.etapa, filtro.etapa), filtro.etapa === 'em' ? undefined : sql`${habilidadeBncc.anos} @> array[${filtro.ano}]::smallint[]`)
+  return and(filtro.etapa === 'em' ? undefined : sql`${habilidadeBncc.anos} @> array[${filtro.ano}]::smallint[]`)
```

O Médio não é seriado: com o filtro de ano nele, a série do Médio não leria habilidade nenhuma.

```mutacao
arquivo: packages/core/src/bncc/bncc.repository.ts
teste: packages/core/src/bncc/bncc.repository.int.test.ts › por série: no Fundamental só as que listam o ano, e no Médio todas, sem olhar o ano
-  return and(eq(habilidadeBncc.etapa, filtro.etapa), filtro.etapa === 'em' ? undefined : sql`${habilidadeBncc.anos} @> array[${filtro.ano}]::smallint[]`)
+  return and(eq(habilidadeBncc.etapa, filtro.etapa), sql`${habilidadeBncc.anos} @> array[${filtro.ano}]::smallint[]`)
```

```mutacao
arquivo: packages/core/src/bncc/bncc.repository.ts
teste: packages/core/src/bncc/bncc.repository.int.test.ts › por etapa: só as da etapa pedida, na ordem do código, e o Médio e o Fundamental juntos quando os dois são pedidos
-      .where(recorteDe(filtro))
```

O texto oficial no tamanho do contrato e a decisão de "código que a tabela não tem":

```mutacao
arquivo: apps/api/src/material/habilidades-do-recorte.ts
teste: apps/api/src/material/habilidades-do-recorte.test.ts › vai cortado no tamanho do contrato da geração, com reticências, quando passa de 300
-  return lida === undefined ? undefined : descricaoParaOModelo(lida.descricao)
+  return lida === undefined ? undefined : lida.descricao
```

```mutacao
arquivo: apps/api/src/material/habilidades-do-recorte.ts
teste: apps/api/src/material/habilidades-do-recorte.test.ts › o código que a tabela não tem devolve `undefined`
-  return lida === undefined ? undefined : descricaoParaOModelo(lida.descricao)
+  return descricaoParaOModelo(lida?.descricao ?? 'sem texto')
```

A troca por nenhuma (`null`) segue sem ler a tabela, e a por um código lê o texto oficial:

```mutacao
arquivo: apps/api/src/artefato/artefato.service.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › muda a habilidade só da questão pedida, com o texto da BNCC, deixa a classificação da base como estava e audita sem título nem texto
-  const descricao = codigo === null ? undefined : await descricaoOficialDaHabilidade(bncc, codigo)
+  const descricao = codigo !== null ? undefined : await descricaoOficialDaHabilidade(bncc, codigo)
```

Sem série, a candidata nem consulta a BNCC (regra 80: o caminho de antes não ia ao banco):

```mutacao
arquivo: apps/api/src/material/habilidades-do-recorte.ts
teste: apps/api/src/material/habilidades-do-recorte.test.ts › sem série não há candidata, e a BNCC nem é consultada
-  if (etapas.length === 0) return []
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| test-engineer (1ª) | "as mutações delas no `material.service.ts` não estão declaradas (o filtro `{ etapa, ano }` e o `candidatasDoRecorte` da lista). Hoje só a esteira, com `cobertura.int.test.ts` e `classificacao-da-coordenacao.int.test.ts`, pegaria uma troca de filtro ali." | Recusada: o próprio revisor diz que não bloqueia, que não há cláusula condicional nova no diff (`--faltando: 0`), e os dois testes de integração que ele nomeia (rodados por ele, verdes) pegam a troca do filtro. Se o item 3 criar a cláusula `etapas.length === 0`, ela ganha o bloco dela (abaixo). |
| conformidade-reviewer (1ª) | "Esta correção não fecha a ressalva maior 2 da validação: a descrição gravada na questão gerada vem do modelo. Pela regra 70 ela é a mais relevante das duas, e precisa ser feita na correção própria." | Correção própria, já prevista na seção "Fora desta correção" do documento e em `tasks/prd-classificacao-bncc/validacao.md` (seção 4, ressalva maior 2). Não entra aqui. |
| tenancy-guardian (2ª), infra-guardian (2ª), test-engineer (2ª) | A guarda nova só pega `.from(habilidadeBncc)`, e não a leitura por `innerJoin`/`leftJoin`, apelido de import (`habilidadeBncc as h`) nem `db.query.habilidadeBncc`; o nome do caso promete "a leitura nova, em outro módulo ou app, entra por ele". Pedem incluir as junções (liberando as que partem de tabela com escopo de escola) ou dizer a limitação no nome ou no comentário. | `TODO.md`: endurecer a guarda da leitura da BNCC além do `.from(`. Os dois joins de hoje (`secoes.repository.ts:151` e `:352`) partem de `habilidadeDaSecao`, que tem escopo de escola, e o `@Unscoped` no módulo `material` segue pego pelo outro caso. O nome do caso ("a leitura nova... entra por ele") fica para a mesma tarefa do `TODO.md`. |
| infra-guardian (2ª) | "Rodar `apps/api/test/architecture.test.ts` de dentro de `apps/api` ainda carrega o `dist` velho do `@educa/core`, de 18/11, onde o `BnccRepository` não existe. ... Vale anotar no guia que esse teste se roda pela raiz, ou reconstruir o `@educa/core` antes." | `TODO.md`: nota no `docs/guia-do-desenvolvedor.md` (rodar pela raiz, `npx vitest run --project unidade`). Não é desta correção: o portão e a esteira rodam pela raiz. |
| test-engineer (2ª) | O bloco 9 estava fora da seção "Mutações", depois da tabela "Revisões". | Atendida com Edit: o bloco e o parágrafo dele estão em "Mutações", e "Revisões" ficou no fim, sem tocar nas linhas do hook. |
| revisor-geral (2ª) | A seção "Teste que reproduz" ainda usava o nome antigo do `describe`. | Atendida com Edit: o nome é o do `describe` de hoje. |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-20 16:54:07 | 2026-11-20 16:54:27 | `conformidade-reviewer` | 1 | APROVADO | a6c78ff8eaff68b2b |
| 2026-11-20 16:54:05 | 2026-11-20 16:54:47 | `privacy-guardian` | 1 | APROVADO | a3b9e27ff4733dc84 |
| 2026-11-20 16:54:03 | 2026-11-20 16:54:48 | `tenancy-guardian` | 1 | APROVADO | a979bf7166936bd96 |
| 2026-11-20 16:54:12 | 2026-11-20 16:55:01 | `revisor-geral` | 1 | APROVADO | a1d8b58f8b37aa7ea |
| 2026-11-20 16:54:08 | 2026-11-20 16:56:04 | `infra-guardian` | 1 | APROVADO | ac8eeae79059ea9b5 |
| 2026-11-20 16:54:10 | 2026-11-20 16:56:49 | `test-engineer` | 1 | APROVADO | a5bd88519c1adf744 |
| 2026-11-20 17:11:34 | 2026-11-20 17:11:56 | `tenancy-guardian` | 2 | APROVADO | a75d0e665d166684e |
| 2026-11-20 17:11:39 | 2026-11-20 17:11:59 | `privacy-guardian` | 2 | APROVADO | ad45fc9e6c7a5cef3 |
| 2026-11-20 17:11:44 | 2026-11-20 17:12:10 | `conformidade-reviewer` | 2 | APROVADO | a5f3e087a108381fd |
| 2026-11-20 17:12:00 | 2026-11-20 17:12:25 | `revisor-geral` | 2 | APROVADO | a281ad018b9492185 |
| 2026-11-20 17:11:49 | 2026-11-20 17:12:48 | `infra-guardian` | 2 | APROVADO | aba93c51930e7a58d |
| 2026-11-20 17:11:55 | 2026-11-20 17:13:08 | `test-engineer` | 2 | APROVADO | a69a30dba65d84e1e |
