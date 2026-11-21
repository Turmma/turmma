# Correção — o portão local não roda o inventário quando o diff toca o inventariado

**Origem:** retro da F4 (`tasks/prd-ingestao-do-material/retro.md`), M2, entrada do `TODO.md` "(F4, retro, M2)".
**Subagentes obrigatórios:** `revisor-geral`, `test-engineer`, `infra-guardian`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`
<!-- O PEDIDO do Orquestrador ditou os três primeiros; os três últimos vêm da conferência da Mesa: `tools/processo/portao.ts` pede os
     quatro guardiões por caminho (`REGRAS_DO_RF16`, em `tools/processo/guardioes-por-caminho.ts`). -->


## Sintoma

Na F4, três vermelhos da esteira vieram de um inventário que o portão da tarefa não rodou, porque o arquivo do inventário não
estava alterado na árvore: a FK do catálogo (duas vezes, na 5.0) quebrou `packages/core/src/db/schema/mvp/mvp-tables.int.test.ts`
com a migration nova, e o `infra/compose.yml` mexido quebrou `tools/ci/compose.int.test.ts`. O portão só roda os testes que o diff
alterou (`alvosDoPortao`, em `tools/processo/portao.ts`).

## Fora desta correção

nada

## Causa

`alvosDoPortao` deriva os alvos só dos arquivos de teste alterados. O elo "este caminho alterado é inventariado por aquele teste"
existia só como texto no `executar-task` ("Quem usa o que mudou"), sem código que o aplicasse.

## Teste que reproduz

`tools/processo/inventarios-do-portao.test.ts` (unidade), cinco casos. Vermelho antes: o módulo `inventarios-do-portao.ts` não existia
e `alvosDoPortao` devolvia `integracao: []` para um diff só com `packages/core/drizzle/0066_catalogo.sql` ou `infra/compose.yml`
(o caso "o inventário entra nos alvos de integração, uma vez…" é o que prova o sintoma); verde depois.

## Correção

`tools/processo/inventarios-do-portao.ts` guarda a tabela "caminho → inventário" num lugar só (`INVENTARIOS_DO_PORTAO`) e
`inventariosDosAlterados` a aplica. `alvosDoPortao` (`tools/processo/portao.ts`) soma o resultado aos arquivos alterados antes de
classificar: o inventário cai em `integracao` como qualquer `*.int.test.ts`, uma vez só. Duas linhas: qualquer arquivo de
`packages/core/drizzle/` (migration, diário e snapshots) puxa `packages/core/src/db/schema/mvp/mvp-tables.int.test.ts`, e
`infra/compose.yml` (não o `compose.carga.yml`) puxa `tools/ci/compose.int.test.ts`. O teste confere que cada inventário da tabela
existe na árvore, para a linha não apodrecer quando o arquivo for renomeado.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| test-engineer (1ª) | `tools/ci/compose.int.test.ts` lê também o `.env.example` (linha 34) e os estágios `FROM … AS` dos Dockerfiles (linha 60); mexer num deles não puxa o inventário | `TODO.md`: linha nova, próxima linha da tabela `INVENTARIOS_DO_PORTAO`. Muda comportamento do portão (alvos novos), fora do que a correção entrega (o item M2 pedia migration e compose). O texto do `executar-task` ("Quem usa o que mudou") só descreve o que continua à mão |
| tenancy-guardian (1ª) | arquivo de `packages/core/src/db/schema/` sem migration não puxa o inventário das tabelas; o teste exige que `schema/mvp/tabela.ts` fique fora | `TODO.md`, junto da linha acima, para decidir na retro: o revisor mesmo pede só que se registre. O teste atual trava o contrário de propósito |
| test-engineer (1ª) | blocos de mutação 2, 4 e 5 sem a linha `falha:` | Recusada: o próprio revisor diz que "não é exigida"; o `--faltando` está em 0 e os cinco blocos provam a cláusula |
| privacy-guardian (1ª) | uma guarda futura de campos proibidos em aluno deve ganhar linha na `INVENTARIOS_DO_PORTAO` | Sem ação agora: depende de uma guarda que não existe. Vale para a tarefa que a criar |
| conformidade-reviewer (1ª) | outros testes da regra 70 (ex.: `assistente.int.test.ts`) podem entrar na tabela depois, pelos mesmos critérios | Sem ação agora: o revisor diz "não exijo nada"; a correção ficou nos dois casos que quebraram na F4 |
| revisor-geral (2ª) | "O item 3 acima", na primeira linha desta tabela, não apontava para nada no documento; trocar pelo texto do `executar-task` | Aplicada ao preparar o commit, com Edit: uma frase na tabela, sem efeito no código nem no processo |

## Mutações

--faltando: 0 linhas (0 blocos, 0 motivos)

```mutacao
arquivo: tools/processo/inventarios-do-portao.ts
teste: tools/processo/inventarios-do-portao.test.ts › infra/compose.yml puxa o inventário dos serviços, e só ele: o compose de carga e outros yml não o puxam
falha: inventariosDosAlterados(['infra/compose.carga.yml'
-  { toca: (arquivo) => arquivo === 'infra/compose.yml', inventario: 'tools/ci/compose.int.test.ts' },
+  { toca: (arquivo) => arquivo.startsWith('infra/compose'), inventario: 'tools/ci/compose.int.test.ts' },
```

```mutacao
arquivo: tools/processo/inventarios-do-portao.ts
teste: tools/processo/inventarios-do-portao.test.ts › migration nova ou mexida em packages/core/drizzle/ puxa o inventário das tabelas, mesmo com ele intacto
-  { toca: (arquivo) => arquivo.startsWith('packages/core/drizzle/'), inventario: 'packages/core/src/db/schema/mvp/mvp-tables.int.test.ts' },
+  { toca: (arquivo) => arquivo.endsWith('.sql'), inventario: 'packages/core/src/db/schema/mvp/mvp-tables.int.test.ts' },
```

```mutacao
arquivo: tools/processo/inventarios-do-portao.ts
teste: tools/processo/inventarios-do-portao.test.ts › quem não toca o inventariado não ganha alvo nenhum
falha: expect(alvosDoPortao(['apps/api/src/x.ts'
-  return INVENTARIOS_DO_PORTAO.filter((linha) => arquivos.some(linha.toca)).map((linha) => linha.inventario)
+  return INVENTARIOS_DO_PORTAO.map((linha) => linha.inventario)
```

```mutacao
arquivo: tools/processo/portao.ts
teste: tools/processo/inventarios-do-portao.test.ts › o inventário entra nos alvos de integração, uma vez, e não se repete quando o próprio teste também mudou
-  const validos = [...new Set([...alterados, ...inventariosDosAlterados(alterados)])].sort()
+  const validos = [...new Set(alterados)].sort()
```

```mutacao
arquivo: tools/processo/portao.ts
teste: tools/processo/inventarios-do-portao.test.ts › o inventário entra nos alvos de integração, uma vez, e não se repete quando o próprio teste também mudou
-  const validos = [...new Set([...alterados, ...inventariosDosAlterados(alterados)])].sort()
+  const validos = [...alterados, ...inventariosDosAlterados(alterados)].sort()
```

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-21 00:30:13 | 2026-11-21 00:30:31 | `privacy-guardian` | 1 | APROVADO | a29c9f8504acc9be6 |
| 2026-11-21 00:30:14 | 2026-11-21 00:30:33 | `conformidade-reviewer` | 1 | APROVADO | aa1d23bc4c5b655e3 |
| 2026-11-21 00:30:12 | 2026-11-21 00:30:33 | `tenancy-guardian` | 1 | APROVADO | a69c5023f24ef1aab |
| 2026-11-21 00:30:08 | 2026-11-21 00:30:36 | `revisor-geral` | 1 | APROVADO | afb142788f6217300 |
| 2026-11-21 00:30:11 | 2026-11-21 00:31:14 | `infra-guardian` | 1 | APROVADO | af80a8559aab2c960 |
| 2026-11-21 00:30:10 | 2026-11-21 00:31:39 | `test-engineer` | 1 | APROVADO | a4ca2c0e337d17435 |
| 2026-11-21 00:39:26 | 2026-11-21 00:39:45 | `revisor-geral` | 2 | APROVADO | a23d14c60fd2e0476 |
