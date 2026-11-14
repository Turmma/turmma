# Tarefa 12.0 — O painel do material mostra os capítulos, corrige séries e título e recebe a edição nova

**Funcionalidade:** ingestao-do-material · **Depende de:** 4.0, 8.0, 11.0
**Subagentes obrigatórios:** `tenancy-guardian`, `infra-guardian`, `frontend-reviewer`
**Porte:** grande

## Objetivo

No painel, a coordenação vê os capítulos, corrige séries e título pelo `PATCH`, que espera a edição em andamento, e
envia a edição nova.

## Contexto necessário

- `techspec.md` §4 (`PATCH`), §7c, §9 (Painel), §11 (RF6)
- `prd.md` RF4, RF6 (série), RF10
- `cenarios.md`: as linhas do `PATCH` em "Envio…" e "Corridas"; "Telas"; "Isolamento"
- `.claude/rules/` 10, 40, 50, 80
- Código: `apps/web/src/areas/coordenacao/material/PainelDoMaterial.tsx` e `MATERIAL_PARAM` (`apps/web/src/paths.ts:112`); `apps/api/src/material/material-upload.ts:44` (molde do teto)

## Subtarefas

- [x] 12.1 — `PATCH /v1/materiais/:id` (`titulo?`, `serieIds?`): a linha `for update`; fora da escola ou excluído, `NAO_ENCONTRADO` antes de `EDICAO_EM_ANDAMENTO` (R6); edição em `processando`, ou a própria, `EDICAO_EM_ANDAMENTO`; `material.atualizado`
- [x] 12.2 — O teto do `PATCH`: 100 por hora por pessoa e 300 por escola, à parte do envio; 429 com `Retry-After`
- [x] 12.3 — Painel: capítulos (ou "sem capítulo"); séries e título editáveis, salvar trava durante o envio; "Enviar edição nova", com "a anterior sai da busca quando a nova ficar pronta"
- [x] 12.4 — Textos: `EDICAO_EM_ANDAMENTO` "Espere a edição em processamento terminar"; `LICENCA_VENCIDA` "Atualize a vigência em Licenças"; 429 do `PATCH` "Muitas alterações por agora. Tente de novo às HH:MM" (R6); 503 "O envio não foi concluído. Tente de novo em instantes."
- [x] 12.5 — `docs/interface.md`: o painel
- [x] 12.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/shared/src/material/material.ts`, `packages/core/src/auditoria/acoes.ts`, `apps/api/src/material/material.controller.ts`, `apps/api/src/material/material.service.ts`, `apps/api/src/material/material.repository.ts`, `apps/api/src/material/material-upload.ts`, `apps/web/src/areas/coordenacao/material/PainelDoMaterial.tsx`, `apps/web/src/areas/coordenacao/material/Material.test.tsx`, `apps/web/src/areas/coordenacao/material/api/material.ts`, `e2e/material.spec.ts`, `docs/interface.md` | alterado |
| `apps/api/test/material-patch.int.test.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| `PATCH` de título e séries | I | a lista com `serieId` da série tirada deixa de achar; `material.atualizado` | |
| a busca da turma da série tirada | I | deixa de achar | |
| `serieIds` da B | I | `NAO_ENCONTRADO` igual à inexistente; séries intactas | |
| `[]`; repetidas | I | `ENTRADA_INVALIDA` (um caso cada) | |
| material da B `pronto`; da B `processando` | I | `NAO_ENCONTRADO` nos dois, antes de `EDICAO_EM_ANDAMENTO` (R6) | |
| material excluído; substituído | I | `NAO_ENCONTRADO` | |
| com edição em `processando`; a própria edição | I | `EDICAO_EM_ANDAMENTO` | |
| 101º da pessoa; 301º da escola | I | 429 com `Retry-After`, sem gastar o teto de envios | |
| sequência: edição B sobre A, `PATCH` em A recusado, B pronta com as séries de A, `PATCH` em B vale | I | a ordem. Mutação: deixar o `PATCH` passar com edição em andamento | |
| [P] dois `PATCH` do mesmo material | P | termina com as séries do último, sem 500. Mutação: tirar o `for update` | |
| [P] edição parada depois do `guardarBytes`; `PATCH` em A confirma | P | a edição nasce com as séries do `PATCH` | |
| [P] edição com a transação aberta; `PATCH` em A | P | o `PATCH` espera e recebe `EDICAO_EM_ANDAMENTO`. Mutação: tirar o `for update` do `PATCH` | |
| permissão: professor | I | `NAO_ENCONTRADO` | |
| escola sem ano letivo | I | o `PATCH` funciona | |
| painel: capítulos; sem capítulo | U | um caso cada | |
| textos dos quatro erros | U | um caso cada | |
| clique duplo em salvar | U | um `PATCH` só | |
| recomeço: outro material no mesmo painel; o mesmo de novo; resposta atrasada; falha com o painel aberto | E | nada do anterior sobra; o foco e o aviso saem | |
| professor | E | não vê editar nem edição nova | |
| editar séries e enviar edição nova | E | fim a fim | |
| cabe em 1366 × 768 | E | `paginaNaoRola` | |

## Como testar

- Trava: `WriteBlockTrigger` e `esperarNaTrava` (`apps/api/test/write-block-trigger.ts`)
- Teto: `apps/api/test/rate-limit.int.test.ts` › "um usuário acima do próprio limite recebe 429…" (l.228); `apps/api/test/material.int.test.ts` › "a pessoa no teto recebe `LIMITE_EXCEDIDO`…"
- Painel: `apps/web/src/areas/coordenacao/material/Material.test.tsx`, o `montar('/material?material=<id>')`
- e2e: `e2e/material.spec.ts`; `fecharPainel` e `paginaNaoRola` de `e2e/support/coordenacao.ts`
- Comandos: `npx vitest run --project integracao apps/api/test/material-patch.int.test.ts`; `node tools/ci/e2e.ts --manter-ambiente e2e/material.spec.ts`
- **Telas:** `coordenacao`, `/coordenacao/material?material=<id>` (painel com capítulos, sem capítulo, editando séries, `EDICAO_EM_ANDAMENTO`, edição nova enviada)

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano. Na 4: a B em `processando` prova
que `NAO_ENCONTRADO` vem antes (`material-patch.int.test.ts`, "o PATCH só toca no material pedido" e os casos de outra escola).

## Fora do escopo desta tarefa

Habilidade por capítulo (F4b).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| O `PATCH` reusa a permissão `material.enviar` (coordenação `unidade`; professor, aluno e rede `nunca`, que a guarda responde `NAO_ENCONTRADO`); não há célula nova | Quem corrige título e séries é quem envia, e o `nunca` já responde igual ao da rota que não existe (regra 10, item 6): uma célula nova só repetiria a linha | `techspec.md` §11, linha "12.0"; `cenarios.md` "Isolamento", linha do professor |
| O teto do `PATCH` (100 por hora por pessoa, 300 por escola) é contado na própria auditoria `material.atualizado` (`contarDaEscolaEDaPessoaDesde`, janela de 60 min), e não num contador à parte; acima dele, `LIMITE_EXCEDIDO` com `Retry-After` da janela inteira | A auditoria já grava cada alteração, com pessoa e escola, na mesma transação: um contador novo (Redis ou tabela) seria um segundo registro do mesmo fato. O teto é à parte do envio, que conta `envio_de_material` | `techspec.md` §7c, linha "Rate limit", e §11, linha "12.0"; `cenarios.md` "Envio, edição…", linha do 101º `PATCH` |
| A auditoria `material.atualizado` leva as séries antes e depois e só `tituloAlterado` (booleano), nunca o título | O título é texto digitado e pode conter nome (regra 20, item 9): a auditoria é por ids | `techspec.md` §11, linha "12.0"; `docs/lgpd.md` (lista de ações) |
| O `PATCH` só recusa a edição `processando` (a própria edição) e o material com edição `processando` sobre ele; a edição `falhou` ou `pronta` não bloqueia | É o que o cenário diz ("com edição em `processando`, e sobre a própria edição") e o que a tela precisa: `falhou` deixa o material como estava | `cenarios.md` "Envio, edição…", linha do `EDICAO_EM_ANDAMENTO`; `techspec.md` §11, linha "12.0" |
| O painel só oferece "Enviar edição nova" ao material `pronto` e sem edição em leitura; o `falhou` tem "Tentar de novo". Com edição em andamento, o formulário de título e séries fica desabilitado e diz por quê | A API recusaria os dois com `EDICAO_EM_ANDAMENTO`: a tela não oferece o que sabe que falha, e a API segue sendo quem decide (a corrida está nos casos `[P]`) | `techspec.md` §9 e §11, linha "12.0"; `cenarios.md` "Telas" |
| Os capítulos só são lidos (`GET /v1/materiais/:id`) no material `pronto`; `processando` mostra "aparecem quando a leitura terminar" e `falhou` não mostra a região | Antes do `pronto` não há capítulo para ler, e a leitura gastaria um pedido para devolver lista vazia | `techspec.md` §9 e §11, linha "12.0"; `cenarios.md` "Telas" |
| Depois de enviar a edição nova o painel fecha e a tela anuncia que a edição foi enviada e está sendo lida | O painel do material anterior deixa de ser o que a coordenação quer ver: a edição é outra linha, na lista, com a própria situação | `techspec.md` §11, linha "12.0"; `cenarios.md` "Telas" |
| Os e2e do painel estão em `e2e/material-painel.spec.ts`, e `e2e/material.spec.ts` só ganhou a lista de botões do painel | O `material.spec.ts` está perto do teto de 800 linhas (`max-lines`); o padrão (um arquivo por assunto) é o de `material-licencas.spec.ts` e `material-resumo.spec.ts` | `techspec.md` §11, linha "12.0" |

## Mutações

--faltando: 8 linhas (87 blocos, 8 motivos)

Cláusulas sem bloco, e por quê (o `--faltando` as lista; cada uma tem o motivo):

- `material.service.ts`, `if (lido === undefined) throw NAO_ENCONTRADO` depois da transação do `PATCH`: só dispara se o material for excluído entre o commit e a releitura, e nenhum teste de integração deixa a corrida entre dois pedidos nessa janela de microssegundos. A resposta já seria `NAO_ENCONTRADO`, igual à de antes da transação.
- `auditoria.repository.ts`, o `usuarioId ?? null` e os dois `?? 0` de `contarDaEscolaEDaPessoaDesde`: a sessão de quem chega ao `PATCH` sempre tem pessoa (o guard de permissão vem antes), e o `count(*)` sempre devolve uma linha. São guardas de tipo; o resultado é o mesmo com ou sem elas.
- `material-painel.ts`, os dois `if (erro instanceof ApiError)` de `textoDaFalhaDoPatch` e `textoDaFalhaDaEdicao`: sem a guarda, `erro.codigo` é `undefined` num erro que não é da API, nenhum `if` seguinte casa, e o texto do catálogo sai igual. É guarda de tipo.
- `DialogoDeEdicaoNova.tsx`, o `erroDoRotulo !== undefined` do envio: o campo tem `maxLength` igual ao teto, então a tela não deixa escrever o rótulo longo; a regra do rótulo (`erroDoRotuloDaEdicao`) tem bloco e teste em `material-painel.test.ts`, e a cláusula do envio só a repete.
- `DialogoDeEdicaoNova.tsx`, o `if (primeiro === null || primeiro === undefined) return` e o `disabled={mutacao.isPending}` do botão do arquivo, o `aria-describedby` do botão: o primeiro é guarda de tipo (o evento sem arquivo não existe com o `type="file"` escolhido); o `disabled` só desliga o botão, e o clique duplo é do `useSingleSubmit`, provado pelo caso do clique duplo; o `aria-describedby` é atributo de acessibilidade, que o axe confere no e2e.
- `PainelDoMaterial.tsx`, `classes` do resultado (`border-ok` e `border-erro`): classe de cor; o `role` e o texto, que são o que o teste vê, têm bloco. A cor vê-se nas fotos da tela e no `axe` do e2e.
- `Material.tsx`, `lista !== undefined &&` da prop `edicaoEmAndamento` e `alvo !== undefined &&` do diálogo da edição: guardas de tipo (o painel só abre com a lista lida, e o diálogo só abre com o material do painel); a cláusula que decide (`temEdicaoEmAndamento(...)` e `'edicao'`) tem bloco.
- `api/material.ts`, `if (token === undefined) throw NAO_AUTENTICADO` de `enviarMultipart`: o código foi movido, sem mudança, de `enviarMaterial` (que tinha o mesmo `if`); o caso de sessão sem token do envio é do cliente da sessão.

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-patch.int.test.ts › da escola B: `NAO_ENCONTRADO`
-if (serieIds !== undefined && (await new MaterialRepository(banco).seriesDaEscola(serieIds)).length !== serieIds.length) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
+if (serieIds !== undefined && (await new MaterialRepository(banco).seriesDaEscola(serieIds)).length > serieIds.length) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-patch.int.test.ts › o material excluído e o substituído
 const alvo = await materiais.travarParaAtualizar(id)
-if (alvo === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-patch.int.test.ts › o material do envio inicial ainda
-if (alvo.estado === 'processando' && alvo.substitui !== null) throw new DomainException(ErrorCode.EDICAO_EM_ANDAMENTO)
+if (alvo.estado === 'processando') throw new DomainException(ErrorCode.EDICAO_EM_ANDAMENTO)
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-patch.int.test.ts › o material com edição
-if (alvo.estado === 'processando' && alvo.substitui !== null) throw new DomainException(ErrorCode.EDICAO_EM_ANDAMENTO)
+if (alvo.estado === 'processando' && false) throw new DomainException(ErrorCode.EDICAO_EM_ANDAMENTO)
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-patch.int.test.ts › o material com edição
 if (alvo.estado === 'processando' && alvo.substitui !== null) throw new DomainException(ErrorCode.EDICAO_EM_ANDAMENTO)
-if (await materiais.edicaoEmAndamentoSobre(alvo.id)) throw new DomainException(ErrorCode.EDICAO_EM_ANDAMENTO)
+if (false) throw new DomainException(ErrorCode.EDICAO_EM_ANDAMENTO)
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-patch.int.test.ts › título e séries: a resposta traz o material alterado
-if (pedido.titulo !== undefined) await materiais.renomear(alvo.id, pedido.titulo)
+if (pedido.titulo === undefined) await materiais.renomear(alvo.id, pedido.titulo)
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-patch.int.test.ts › só as séries, em qualquer ordem
-if (serieIds !== undefined) await materiais.substituirSeries(alvo.id, serieIds)
+if (serieIds === undefined) await materiais.substituirSeries(alvo.id, serieIds)
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-patch.int.test.ts › só o título: as séries seguem
-depois: { serieIds: serieIds?.toSorted() ?? antes, tituloAlterado: pedido.titulo !== undefined },
+depois: { serieIds: serieIds?.toSorted() ?? [], tituloAlterado: pedido.titulo !== undefined },
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-patch.int.test.ts › só as séries, em qualquer ordem
-depois: { serieIds: serieIds?.toSorted() ?? antes, tituloAlterado: pedido.titulo !== undefined },
+depois: { serieIds: serieIds?.toSorted() ?? antes, tituloAlterado: true },
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-patch.int.test.ts › a pessoa no teto recebe 429
-const feitas = await new AuditoriaRepository(this.dependencias.banco).contarDaEscolaEDaPessoaDesde('material.atualizado', new Date(Date.now() - JANELA_DAS_ATUALIZACOES_MS))
+const feitas = await new AuditoriaRepository(this.dependencias.banco).contarDaEscolaEDaPessoaDesde('material.atualizado', new Date(Date.now() - JANELA_DAS_ATUALIZACOES_MS * 1_000))
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-patch.int.test.ts › a pessoa no teto recebe 429
-if (feitas.doUsuario >= ATUALIZACOES_POR_USUARIO_NA_JANELA || feitas.daEscola >= ATUALIZACOES_POR_ESCOLA_NA_JANELA) {
+if (feitas.doUsuario > ATUALIZACOES_POR_USUARIO_NA_JANELA || feitas.daEscola >= ATUALIZACOES_POR_ESCOLA_NA_JANELA) {
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-patch.int.test.ts › a escola no teto segura
-if (feitas.doUsuario >= ATUALIZACOES_POR_USUARIO_NA_JANELA || feitas.daEscola >= ATUALIZACOES_POR_ESCOLA_NA_JANELA) {
+if (feitas.doUsuario >= ATUALIZACOES_POR_USUARIO_NA_JANELA || feitas.daEscola > ATUALIZACOES_POR_ESCOLA_NA_JANELA) {
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-patch.int.test.ts › o 429 é antes de tudo
-const tipo = feitas.daEscola >= ATUALIZACOES_POR_ESCOLA_NA_JANELA ? 'escola' : 'usuario'
+const tipo = feitas.daEscola >= ATUALIZACOES_POR_ESCOLA_NA_JANELA ? 'usuario' : 'escola'
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-patch.int.test.ts › a pessoa no teto recebe 429
-throw new DomainException(ErrorCode.LIMITE_EXCEDIDO, undefined, JANELA_DAS_ATUALIZACOES_MS / 1_000)
+throw new DomainException(ErrorCode.LIMITE_EXCEDIDO, undefined, JANELA_DAS_ATUALIZACOES_MS / 2_000)
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/material-patch.int.test.ts › o repository, no contexto da escola A
 .select({ id: material.id, estado: material.estado, substitui: material.substituiId })
 .from(material)
-.where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id), isNull(material.excluidoEm)))
+.where(and(eq(material.id, id), isNull(material.excluidoEm)))
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/material-patch.int.test.ts › o material excluído e o substituído
 .select({ id: material.id, estado: material.estado, substitui: material.substituiId })
 .from(material)
-.where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id), isNull(material.excluidoEm)))
+.where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id)))
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/material-patch.int.test.ts › dois PATCH do mesmo material
 .where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id), isNull(material.excluidoEm)))
-.for('update')
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/material-patch.int.test.ts › a edição com a transação aberta sobre A
 .where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id), isNull(material.excluidoEm)))
-.for('update')
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/material-patch.int.test.ts › título e séries
 async substituirSeries(materialId: string, serieIds: readonly string[]): Promise<void> {
-await this.banco.delete(materialSerie).where(and(eq(materialSerie.escolaId, requireEscolaId()), eq(materialSerie.materialId, materialId)))
 await this.gravarSeries(materialId, serieIds)
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/material-patch.int.test.ts › o repository, no contexto da escola A
-.where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id)))
+.where(and(eq(material.id, id)))
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/material-patch.int.test.ts › o PATCH só toca no material pedido
-.where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id)))
+.where(and(eq(material.escolaId, requireEscolaId())))
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/material-patch.int.test.ts › o repository, no contexto da escola A
-await this.banco.delete(materialSerie).where(and(eq(materialSerie.escolaId, requireEscolaId()), eq(materialSerie.materialId, materialId)))
+await this.banco.delete(materialSerie).where(and(eq(materialSerie.materialId, materialId)))
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/material-patch.int.test.ts › o PATCH só toca no material pedido
-await this.banco.delete(materialSerie).where(and(eq(materialSerie.escolaId, requireEscolaId()), eq(materialSerie.materialId, materialId)))
+await this.banco.delete(materialSerie).where(and(eq(materialSerie.escolaId, requireEscolaId())))
```

```mutacao
arquivo: apps/api/src/material/material.controller.ts
teste: apps/api/test/material-patch.int.test.ts › a pessoa no teto recebe 429
-@UseGuards(MaterialAtualizarGuard)
```

```mutacao
arquivo: packages/core/src/auditoria/auditoria.repository.ts
teste: apps/api/test/material-patch.int.test.ts › a pessoa no teto recebe 429
-where escola_id = ${escolaId} and acao = ${acao} and em >= ${desde.toISOString()}::timestamptz`)
+where acao = ${acao} and em >= ${desde.toISOString()}::timestamptz`)
```

```mutacao
arquivo: packages/core/src/auditoria/auditoria.repository.ts
teste: apps/api/test/material-patch.int.test.ts › a pessoa no teto recebe 429
-where escola_id = ${escolaId} and acao = ${acao} and em >= ${desde.toISOString()}::timestamptz`)
+where escola_id = ${escolaId} and em >= ${desde.toISOString()}::timestamptz`)
```

```mutacao
arquivo: packages/core/src/auditoria/auditoria.repository.ts
teste: apps/api/test/material-patch.int.test.ts › a pessoa no teto recebe 429
-where escola_id = ${escolaId} and acao = ${acao} and em >= ${desde.toISOString()}::timestamptz`)
+where escola_id = ${escolaId} and acao = ${acao}`)
```

```mutacao
arquivo: packages/core/src/auditoria/auditoria.repository.ts
teste: apps/api/test/material-patch.int.test.ts › a pessoa no teto recebe 429
-select count(*)::int as da_escola, (count(*) filter (where autor_usuario_id = ${usuarioId ?? null}))::int as do_usuario
+select count(*)::int as da_escola, count(*)::int as do_usuario
```

```mutacao
arquivo: packages/shared/src/material/material.ts
teste: packages/shared/src/material/material.test.ts › o título é aparado
-.refine((pedido) => pedido.titulo !== undefined || pedido.serieIds !== undefined, { message: 'nada a alterar' })
+.refine((pedido) => pedido.titulo !== undefined && pedido.serieIds !== undefined, { message: 'nada a alterar' })
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-painel.ts
teste: apps/web/src/areas/coordenacao/material/material-painel.test.ts › com erro no formulário
-return { ...(titulo === undefined ? {} : { titulo }), ...(rascunho.serieIds.length === 0 ? { serieIds: ERRO_DAS_SERIES } : {}) }
+return { ...(titulo === undefined ? {} : { titulo }), ...(rascunho.serieIds.length === 99 ? { serieIds: ERRO_DAS_SERIES } : {}) }
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-painel.ts
teste: apps/web/src/areas/coordenacao/material/material-painel.test.ts › com erro no formulário
-return { ...(titulo === undefined ? {} : { titulo }), ...(rascunho.serieIds.length === 0 ? { serieIds: ERRO_DAS_SERIES } : {}) }
+return { ...(titulo === undefined ? { titulo: 'erro' } : { titulo }), ...(rascunho.serieIds.length === 0 ? { serieIds: ERRO_DAS_SERIES } : {}) }
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-painel.ts
teste: apps/web/src/areas/coordenacao/material/material-painel.test.ts › leva só o que mudou
-return a.length === b.length && a.every((serieId) => b.includes(serieId))
+return a.every((serieId) => b.includes(serieId))
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-painel.ts
teste: apps/web/src/areas/coordenacao/material/material-painel.test.ts › com erro no formulário
-if (erros.titulo !== undefined || erros.serieIds !== undefined) return undefined
+if (erros.titulo !== undefined && erros.serieIds !== undefined) return undefined
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-painel.ts
teste: apps/web/src/areas/coordenacao/material/material-painel.test.ts › leva só o que mudou
-if (!tituloMudou && !seriesMudaram) return undefined
+if (!tituloMudou || !seriesMudaram) return undefined
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-painel.ts
teste: apps/web/src/areas/coordenacao/material/material-painel.test.ts › leva só o que mudou
-return { ...(tituloMudou ? { titulo } : {}), ...(seriesMudaram ? { serieIds: [...rascunho.serieIds] } : {}) }
+return { ...({ titulo }), ...(seriesMudaram ? { serieIds: [...rascunho.serieIds] } : {}) }
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-painel.ts
teste: apps/web/src/areas/coordenacao/material/material-painel.test.ts › leva só o que mudou
-return { ...(tituloMudou ? { titulo } : {}), ...(seriesMudaram ? { serieIds: [...rascunho.serieIds] } : {}) }
+return { ...(tituloMudou ? { titulo } : {}), ...({ serieIds: [...rascunho.serieIds] }) }
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-painel.ts
teste: apps/web/src/areas/coordenacao/material/material-painel.test.ts › leva só o que mudou
-return rascunho.titulo.trim() !== material.titulo || !mesmasSeries(rascunho.serieIds, material.serieIds)
+return rascunho.titulo.trim() !== material.titulo && !mesmasSeries(rascunho.serieIds, material.serieIds)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-painel.ts
teste: apps/web/src/areas/coordenacao/material/material-painel.test.ts › a edição que já ficou pronta ou que falhou
-if (material.estado === 'processando' && material.substitui !== null) return true
+if (material.estado === 'processando') return true
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-painel.ts
teste: apps/web/src/areas/coordenacao/material/material-painel.test.ts › a edição que já ficou pronta ou que falhou
-return lista.some((outro) => outro.estado === 'processando' && outro.substitui === material.id)
+return lista.some((outro) => outro.estado === 'processando' && true)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-painel.ts
teste: apps/web/src/areas/coordenacao/material/material-painel.test.ts › a edição que já ficou pronta ou que falhou
-return lista.some((outro) => outro.estado === 'processando' && outro.substitui === material.id)
+return lista.some((outro) =>  outro.substitui === material.id)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-painel.ts
teste: apps/web/src/areas/coordenacao/material/material-painel.test.ts › o título leva o número
-return capitulo.paginaInicial === capitulo.paginaFinal ? `Página ${String(capitulo.paginaInicial)}` : `Páginas ${String(capitulo.paginaInicial)} a ${String(capitulo.paginaFinal)}`
+return capitulo.paginaInicial !== capitulo.paginaFinal ? `Página ${String(capitulo.paginaInicial)}` : `Páginas ${String(capitulo.paginaInicial)} a ${String(capitulo.paginaFinal)}`
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-painel.ts
teste: apps/web/src/areas/coordenacao/material/material-painel.test.ts › o título leva o número
-return capitulo.numero === null ? capitulo.titulo : `Capítulo ${String(capitulo.numero)} · ${capitulo.titulo}`
+return !capitulo.numero ? capitulo.titulo : `Capítulo ${String(capitulo.numero)} · ${capitulo.titulo}`
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-painel.ts
teste: apps/web/src/areas/coordenacao/material/material-painel.test.ts › o limite sem
-return esperaSegundos === undefined ? 'Muitas alterações por agora. Tente de novo em instantes.' : `Muitas alterações por agora. Tente de novo às ${horaDaEspera(esperaSegundos, agora)}.`
+return esperaSegundos !== undefined ? 'Muitas alterações por agora. Tente de novo em instantes.' : `Muitas alterações por agora. Tente de novo às ${horaDaEspera(esperaSegundos, agora)}.`
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-painel.ts
teste: apps/web/src/areas/coordenacao/material/material-painel.test.ts › os quatro erros do que a tela envia
-if (erro.codigo === ErrorCode.LIMITE_EXCEDIDO) return textoDoLimiteDeAlteracoes(erro.esperaSegundos, agora)
+if (erro.codigo === ErrorCode.CONFLITO) return textoDoLimiteDeAlteracoes(erro.esperaSegundos, agora)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-painel.ts
teste: apps/web/src/areas/coordenacao/material/material-painel.test.ts › o material que sumiu diz que a lista
-if (erro.codigo === ErrorCode.NAO_ENCONTRADO) return 'Este material, ou uma das séries, já não existe. A lista foi atualizada.'
+if (erro.codigo === ErrorCode.CONFLITO) return 'Este material, ou uma das séries, já não existe. A lista foi atualizada.'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-painel.ts
teste: apps/web/src/areas/coordenacao/material/material-painel.test.ts › os quatro erros do que a tela envia
-if (erro.codigo === ErrorCode.INDISPONIVEL_TENTE_DE_NOVO) return 'As alterações não foram salvas. Tente de novo em instantes.'
+if (erro.codigo === ErrorCode.CONFLITO) return 'As alterações não foram salvas. Tente de novo em instantes.'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-painel.ts
teste: apps/web/src/areas/coordenacao/material/material-painel.test.ts › o material que sumiu diz que a lista
-if (erro.codigo === ErrorCode.NAO_ENCONTRADO) return 'Este material já não aceita edição nova. A lista foi atualizada.'
+if (erro.codigo === ErrorCode.CONFLITO) return 'Este material já não aceita edição nova. A lista foi atualizada.'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-painel.ts
teste: apps/web/src/areas/coordenacao/material/material-painel.test.ts › os quatro erros do que a tela envia
-if (erro.codigo === ErrorCode.LIMITE_EXCEDIDO) return erro.esperaSegundos === undefined ? 'Muitos envios por agora. Tente de novo em instantes.' : `Muitos envios por agora. Tente de novo às ${horaDaEspera(erro.esperaSegundos, agora)}.`
+if (erro.codigo === ErrorCode.CONFLITO) return erro.esperaSegundos === undefined ? 'Muitos envios por agora. Tente de novo em instantes.' : `Muitos envios por agora. Tente de novo às ${horaDaEspera(erro.esperaSegundos, agora)}.`
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-painel.ts
teste: apps/web/src/areas/coordenacao/material/material-painel.test.ts › o limite sem
-if (erro.codigo === ErrorCode.LIMITE_EXCEDIDO) return erro.esperaSegundos === undefined ? 'Muitos envios por agora. Tente de novo em instantes.' : `Muitos envios por agora. Tente de novo às ${horaDaEspera(erro.esperaSegundos, agora)}.`
+if (erro.codigo === ErrorCode.LIMITE_EXCEDIDO) return erro.esperaSegundos !== undefined ? 'Muitos envios por agora. Tente de novo em instantes.' : `Muitos envios por agora. Tente de novo às ${horaDaEspera(erro.esperaSegundos, agora)}.`
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-painel.ts
teste: apps/web/src/areas/coordenacao/material/material-painel.test.ts › os quatro erros do que a tela envia
-if (texto !== undefined) return texto
+if (false) return texto
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-painel.ts
teste: apps/web/src/areas/coordenacao/material/material-painel.test.ts › só o material que sumiu
-return erro instanceof ApiError && (erro.codigo === ErrorCode.NAO_ENCONTRADO || erro.codigo === ErrorCode.EDICAO_EM_ANDAMENTO)
+return erro instanceof ApiError && (erro.codigo === ErrorCode.NAO_ENCONTRADO && erro.codigo === ErrorCode.EDICAO_EM_ANDAMENTO)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-painel.ts
teste: apps/web/src/areas/coordenacao/material/material-painel.test.ts › o nome da edição tem no máximo
-return rotulo.trim().length > MAXIMO_DO_ROTULO_DA_EDICAO ? `O nome da edição tem no máximo ${String(MAXIMO_DO_ROTULO_DA_EDICAO)} caracteres.` : undefined
+return rotulo.trim().length > MAXIMO_DO_ROTULO_DA_EDICAO * 2 ? `O nome da edição tem no máximo ${String(MAXIMO_DO_ROTULO_DA_EDICAO)} caracteres.` : undefined
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PainelDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/PainelDoMaterial.test.tsx › o material que falhou não tem a seção
-if (material.estado === 'falhou') return null
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PainelDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/PainelDoMaterial.test.tsx › o material ainda sendo lido não pede
-{material.estado === 'processando' ? (
+{material.estado === 'zzz' ? (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PainelDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/PainelDoMaterial.test.tsx › enquanto os capítulos são lidos
-) : capitulos.isPending ? (
+) : false ? (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PainelDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/PainelDoMaterial.test.tsx › a leitura dos capítulos que cai
-) : capitulos.isError ? (
+) : false ? (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PainelDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/PainelDoMaterial.test.tsx › o PDF sem capítulo diz isso
-) : capitulos.data.capitulos.length === 0 ? (
+) : capitulos.data.capitulos.length === 99 ? (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PainelDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/PainelDoMaterial.test.tsx › marcar outra série manda só as séries
-if (salvou || falha !== undefined) aviso.current?.focus()
+if (falha !== undefined) aviso.current?.focus()
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PainelDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/PainelDoMaterial.test.tsx › o 429 do
-<p ref={aviso} tabIndex={-1} role={falha === undefined ? 'status' : 'alert'} className={`rounded-controle border p-3 break-words empty:hidden ${classes}`}>
+<p ref={aviso} tabIndex={-1} role="status" className={`rounded-controle border p-3 break-words empty:hidden ${classes}`}>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PainelDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/PainelDoMaterial.test.tsx › só liga com alguma mudança
-{falha ?? (salvou ? TEXTO_DO_PATCH_SALVO : '')}
+{falha ?? ''}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PainelDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/PainelDoMaterial.test.tsx › diz o texto da tela e relê a lista
-if (falhaMudouOMaterial(erro)) void recarregar()
+if (false) void recarregar()
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PainelDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/PainelDoMaterial.test.tsx › o 503 do
-const falha = mutacao.isError ? textoDaFalhaDoPatch(mutacao.error) : undefined
+const falha = undefined
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PainelDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/PainelDoMaterial.test.tsx › sem nenhuma série ou com o título vazio
-const erros = tentou ? errosDoPainel(rascunho) : {}
+const erros = errosDoPainel(rascunho)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PainelDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/PainelDoMaterial.test.tsx › o 503 do
-if (!mutacao.isPending) mutacao.reset()
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PainelDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/PainelDoMaterial.test.tsx › só liga com alguma mudança
-if (pedido !== undefined) enviar(pedido)
+if (pedido === undefined) enviar(pedido)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PainelDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/PainelDoMaterial.test.tsx › o material com edição em leitura não se corrige
 <legend className="t-selo mb-2 text-sutil">Corrigir título e séries</legend>
-{edicaoEmAndamento && <p className="break-words text-apoio">{TEXTO_DA_EDICAO_EM_ANDAMENTO}</p>}
 <FormField rotulo="Título" value={rascunho.titulo} maxLength={TAMANHO_MAXIMO_TITULO_DO_MATERIAL} onChange={(evento) => mudar({ titulo: evento.target.value })} erro={erros.titulo} autoComplete="off" />
+{edicaoEmAndamento && <p className="break-words text-apoio">{TEXTO_DA_EDICAO_EM_ANDAMENTO}</p>}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PainelDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/PainelDoMaterial.test.tsx › o material com edição em leitura não se corrige
-{edicaoEmAndamento && <p className="break-words text-apoio">{TEXTO_DA_EDICAO_EM_ANDAMENTO}</p>}
+{!edicaoEmAndamento && <p className="break-words text-apoio">{TEXTO_DA_EDICAO_EM_ANDAMENTO}</p>}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PainelDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/PainelDoMaterial.test.tsx › diz o texto da tela e relê a lista
-<Button type="submit" variante="secundario" disabled={edicaoEmAndamento || mutacao.isPending || !mudou}>
+<Button type="submit" variante="secundario" disabled={mutacao.isPending || !mudou}>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PainelDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/PainelDoMaterial.test.tsx › o clique duplo em "Salvar
-<Button type="submit" variante="secundario" disabled={edicaoEmAndamento || mutacao.isPending || !mudou}>
+<Button type="submit" variante="secundario" disabled={edicaoEmAndamento || !mudou}>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PainelDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/PainelDoMaterial.test.tsx › só liga com alguma mudança
-<Button type="submit" variante="secundario" disabled={edicaoEmAndamento || mutacao.isPending || !mudou}>
+<Button type="submit" variante="secundario" disabled={edicaoEmAndamento || mutacao.isPending}>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PainelDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/PainelDoMaterial.test.tsx › o clique duplo em "Salvar
-{mutacao.isPending ? 'Salvando…' : 'Salvar alterações'}
+{false ? 'Salvando…' : 'Salvar alterações'}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PainelDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/PainelDoMaterial.test.tsx › só o material pronto oferece
-{material.estado === 'pronto' && !edicaoEmAndamento && (
+{!edicaoEmAndamento && (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PainelDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/PainelDoMaterial.test.tsx › o material com edição em leitura não se corrige
-{material.estado === 'pronto' && !edicaoEmAndamento && (
+{material.estado === 'pronto' && (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeEdicaoNova.tsx
teste: apps/web/src/areas/coordenacao/material/PainelDoMaterial.test.tsx › o envio leva o PDF e o nome da edição
-mutationFn: ({ arquivoEscolhido, nome }: { readonly arquivoEscolhido: File; readonly nome: string }) => enviarEdicao(alvo.id, nome === '' ? {} : { edicao: nome }, arquivoEscolhido),
+mutationFn: ({ arquivoEscolhido, nome }: { readonly arquivoEscolhido: File; readonly nome: string }) => enviarEdicao(alvo.id, {}, arquivoEscolhido),
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeEdicaoNova.tsx
teste: apps/web/src/areas/coordenacao/material/PainelDoMaterial.test.tsx › a edição recusada por
-if (falhaMudouOMaterial(erro)) void recarregar()
+if (false) void recarregar()
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeEdicaoNova.tsx
teste: apps/web/src/areas/coordenacao/material/PainelDoMaterial.test.tsx › sem o PDF o diálogo diz
-const erroDoArquivo = arquivo === undefined ? (tentou ? 'Escolha o PDF da edição nova.' : undefined) : arquivo.problema
+const erroDoArquivo = arquivo === undefined ? undefined : arquivo.problema
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeEdicaoNova.tsx
teste: apps/web/src/areas/coordenacao/material/PainelDoMaterial.test.tsx › a edição recusada por
-const mudou = mutacao.isError && falhaMudouOMaterial(mutacao.error)
+const mudou = false
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeEdicaoNova.tsx
teste: apps/web/src/areas/coordenacao/material/PainelDoMaterial.test.tsx › sem o PDF o diálogo diz
-if (arquivo === undefined || arquivo.problema !== undefined || erroDoRotulo !== undefined) {
+if (arquivo === undefined || erroDoRotulo !== undefined) {
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeEdicaoNova.tsx
teste: apps/web/src/areas/coordenacao/material/PainelDoMaterial.test.tsx › sem o PDF o diálogo diz
-if (arquivo === undefined || arquivo.problema !== undefined) botaoDoArquivo.current?.focus()
+if (arquivo === undefined || arquivo.problema !== undefined) null
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeEdicaoNova.tsx
teste: apps/web/src/areas/coordenacao/material/PainelDoMaterial.test.tsx › do envio da edição diz o texto
-falha={mutacao.isError ? textoDaFalhaDaEdicao(mutacao.error) : undefined}
+falha={undefined}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeEdicaoNova.tsx
teste: apps/web/src/areas/coordenacao/material/PainelDoMaterial.test.tsx › o envio leva o PDF e o nome da edição
-{arquivo === undefined ? 'Escolher o PDF' : 'Trocar o PDF'}
+{true ? 'Escolher o PDF' : 'Trocar o PDF'}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeEdicaoNova.tsx
teste: apps/web/src/areas/coordenacao/material/PainelDoMaterial.test.tsx › sem o PDF o diálogo diz
-{arquivo !== undefined && arquivo.problema === undefined && <p className="break-words text-apoio">PDF escolhido, com {tamanhoPorExtenso(arquivo.arquivo.size)}.</p>}
+{arquivo !== undefined && <p className="break-words text-apoio">PDF escolhido, com {tamanhoPorExtenso(arquivo.arquivo.size)}.</p>}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeEdicaoNova.tsx
teste: apps/web/src/areas/coordenacao/material/PainelDoMaterial.test.tsx › sem o PDF o diálogo diz
-{erroDoArquivo !== undefined && <FieldError id={ID_DO_ERRO_DO_ARQUIVO}>{erroDoArquivo}</FieldError>}
+{false && <FieldError id={ID_DO_ERRO_DO_ARQUIVO}>{erroDoArquivo}</FieldError>}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Material.tsx
teste: apps/web/src/areas/coordenacao/material/PainelDoMaterial.test.tsx › o material com edição em leitura não se corrige
-edicaoEmAndamento={lista !== undefined && temEdicaoEmAndamento(doPainel, lista.itens)}
+edicaoEmAndamento={false}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Material.tsx
teste: apps/web/src/areas/coordenacao/material/PainelDoMaterial.test.tsx › o diálogo diz o que a edição herda
-{aberta?.tipo === 'edicao' && alvo !== undefined && (
+{aberta?.tipo === 'zzz' && alvo !== undefined && (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/api/material.ts
teste: apps/web/src/areas/coordenacao/material/PainelDoMaterial.test.tsx › o envio leva o PDF e o nome da edição
-if (campos.edicao !== undefined) formulario.append('edicao', campos.edicao)
+if (campos.edicao === undefined) formulario.append('edicao', campos.edicao)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/api/material.ts
teste: apps/web/src/areas/coordenacao/material/PainelDoMaterial.test.tsx › o envio leva o PDF e o nome da edição
-return enviarMultipart(`${CAMINHO}/${encodeURIComponent(alvoId)}/edicoes`, formulario)
+return enviarMultipart(`${CAMINHO}/${encodeURIComponent(alvoId)}/edicao`, formulario)
```

## Recomendações sem aplicar

Rodada 1 (Mesa; as linhas de destino `TODO.md` estão no `TODO.md`, seção "Da ingestao-do-material, tarefa 12.0, fora dela"):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| infra-guardian (1ª) | O `Retry-After` manda esperar a janela inteira (3600 s), mesmo quando o registro mais antigo sai antes; calcular pelo `em` mais antigo | Recusada: está escrita na divergência 2 desta tarefa ("`LIMITE_EXCEDIDO` com `Retry-After` da janela inteira", `techspec.md` §7c e §11, linha "12.0") e mudá-la muda o contrato do 429. Cálculo pelo registro mais antigo: `TODO.md` |
| infra-guardian (1ª), revisor-geral (1ª) | O teto do `PATCH` conta só alteração que deu certo (`material.atualizado`); laço de pedidos recusados não o gasta | `TODO.md`: a escolha está declarada na divergência 2 e na Tech Spec; fica o registro de que o teto protege das gravações, e não da quantidade de pedidos (o limitador global por pessoa segura o resto) |
| infra-guardian (1ª) | A contagem do teto lê sem trava e pode passar um pouco dos 100 ou dos 300 | Retro: é o comportamento documentado do teto de envios; sem ação |
| tenancy-guardian (1ª), revisor-geral (2ª), test-engineer (5ª) | `seriesDaEscola` roda fora da transação: série excluída entre a conferência e o `insert` vira erro de FK, e não `NAO_ENCONTRADO` | `TODO.md`: mover a conferência para depois do `travarParaAtualizar` muda a ordem das respostas (série da B com edição em andamento passaria a dar `EDICAO_EM_ANDAMENTO`) e os casos de `serieIds` da B; é janela estreita e não vaza dado |
| tenancy-guardian (1ª) | `renomear` e `substituirSeries` não filtram `excluidoEm`; um comentário diz que só se chamam depois de `travarParaAtualizar` | Já atendida: os dois métodos têm o comentário ("Quem chama já travou a linha (`travarParaAtualizar`)", `material.repository.ts:331` e `:339`) |
| frontend-reviewer (1ª) | As caixas de série medem 24 px; conferir se a linha inteira do rótulo é clicável em `CampoDeSeries` | `TODO.md`: o arquivo (`PartesDoEnvioDeMaterial.tsx`) não é desta tarefa |
| frontend-reviewer (1ª) | O foco azul da região de rolagem do `Sheet` aparece como quadro no celular | Retro: é do componente `Sheet` existente |
| frontend-reviewer (1ª) | Carregando e erro do `PATCH` e da edição nova (429, 503, edição em andamento) só foram conferidos pelo código | Sem ação: têm caso de unidade (`material-painel.test.ts`, `PainelDoMaterial.test.tsx`); a vitrine não semeia 429 nem 503 |
| conformidade-reviewer (1ª), revisor-geral (5ª) | As fotos `-celular-2` parecem iguais e o aviso "Espere a edição…" não aparece em foto nenhuma | Conferido pela Mesa: as quatro `-celular-2` são a mesma imagem (limite da captura), e as `-celular-1`, que mostram o painel, são distintas. O aviso passa a aparecer na foto depois do item 1 |
| conformidade-reviewer (1ª) | `docs/regulacao.md` não precisava mudar | Sem ação |
| privacy-guardian (1ª) | Acrescentar o `PATCH /v1/materiais/:id` ao `contracts.test.ts` (nenhuma resposta traz `enviadoPor` nem `sha256`) | `TODO.md`: `apps/api/test/contracts.test.ts` não é arquivo desta tarefa; o `materialResponseSchema` já garante |
| revisor-geral (3ª) | `MaterialAtualizarGuard` está em `material-upload.ts`, mas não tem nada de upload | `TODO.md`: renomear ou mover toca módulo, controller e imports |
| revisor-geral (4ª) | O rascunho de `CorrecaoDoMaterial` nasce uma vez: se outra pessoa corrigir o mesmo material com o painel aberto, "Salvar alterações" pode desfazer a correção dela | `TODO.md`: muda o comportamento do painel (reler o rascunho a cada leitura) e é raro; a API não erra |
| test-engineer (6ª) | "Sem gastar o teto de envios": o caso não prova que o `PATCH` deixa de contar como envio | Sem ação: os dois contadores são separados por construção (`atualizado` na auditoria, `envio_de_material` no envio) |

Rodada 2 (Mesa; a linha de destino `TODO.md` também está na seção "Da ingestao-do-material, tarefa 12.0, fora dela"):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| test-engineer (2ª), infra-guardian (2ª) | O comentário de `e2e/material-painel.spec.ts:266` ("O aviso e o foco do pedido de A não aparecem no painel de B") ainda fala do foco, e a asserção `:focus` saiu; nenhum caso confere que o foco do pedido de A fica fora do painel de B | `TODO.md`: ajustar o comentário, ou provar o foco por um caso de unidade em `PainelDoMaterial.test.tsx` |
| test-engineer (2ª) | Separar a parte da porta de leitura do caso "título e séries" num caso com nome próprio | Sem ação: o caso já a nomeia pelo `idsDaPortaDeLeitura`, e o bloco de mutação cita o caso inteiro |
| revisor-geral (2ª) | `idsDaPortaDeLeitura` busca com texto fixo; se o PDF da fixture mudar, a asserção de `[]` passa à toa | Sem ação, como o próprio revisor diz: a asserção `toEqual([id])` antes do `PATCH` já cobre |
| tenancy-guardian (2ª), infra-guardian (2ª), frontend-reviewer (2ª), privacy-guardian (2ª) | Repetem as recomendações da rodada 1, que já estão na tabela da rodada 1 | Sem ação nova |

Rodada 3 (Mesa; nada a corrigir, só texto):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisor-geral (3ª rodada) | Na coluna "Revisor e rodada" da tabela da rodada 1 de "Recomendações sem aplicar" e em duas linhas do `TODO.md` ("revisor-geral, 3ª" e "revisor-geral, 4ª"), "(2ª)", "(3ª)", "(4ª)" e "(5ª)" são o número da recomendação na lista do revisor, e não a rodada (todas vieram da 1ª) | Trocar por "1ª" quando alguém mexer nessas linhas; a linha já traz `arquivo:linha` e a ação. Retro: fixar no protocolo da Mesa se a coluna guarda a rodada ou o número da recomendação |
| revisor-geral (3ª rodada) | `12_task.md:747` cita `e2e/material-painel.spec.ts:266`, e o comentário está na `:269` | Sem ação: o `TODO.md` já traz a `:269`, que é a que vale |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-14 04:15:23 | 2026-11-14 04:16:09 | `tenancy-guardian` | 1 | APROVADO | aa3d6d5f5c801ec5c |
| 2026-11-14 04:15:29 | 2026-11-14 04:16:14 | `infra-guardian` | 1 | APROVADO | a38d33fdbd3fae5f2 |
| 2026-11-14 04:15:36 | 2026-11-14 04:16:32 | `frontend-reviewer` | 1 | APROVADO | ae561dde7e9342de1 |
| 2026-11-14 04:16:02 | 2026-11-14 04:16:47 | `conformidade-reviewer` | 1 | APROVADO | ad45ce969a9ff4fbf |
| 2026-11-14 04:15:55 | 2026-11-14 04:16:59 | `privacy-guardian` | 1 | APROVADO | a1b2e482ded395994 |
| 2026-11-14 04:15:49 | 2026-11-14 04:17:25 | `revisor-geral` | 1 | APROVADO | a18b9957a368905af |
| 2026-11-14 04:15:42 | 2026-11-14 04:18:13 | `test-engineer` | 1 | APROVADO | aa36f5626fe654dcd |
| 2026-11-14 04:39:20 | 2026-11-14 04:39:33 | `tenancy-guardian` | 2 | APROVADO | ae4b2bac4b1eead33 |
| 2026-11-14 04:39:30 | 2026-11-14 04:39:44 | `infra-guardian` | 2 | APROVADO | a06c68953f84c2d6c |
| 2026-11-14 04:39:41 | 2026-11-14 04:40:05 | `frontend-reviewer` | 2 | APROVADO | a9e6f7b1a787f7113 |
| 2026-11-14 04:40:15 | 2026-11-14 04:40:37 | `privacy-guardian` | 2 | APROVADO | a183f8347f26e734b |
| 2026-11-14 04:39:52 | 2026-11-14 04:40:43 | `test-engineer` | 2 | APROVADO | a3edd21c0428e3627 |
| 2026-11-14 04:40:26 | 2026-11-14 04:40:52 | `conformidade-reviewer` | 2 | APROVADO | a21e1615af4467d21 |
| 2026-11-14 04:40:04 | 2026-11-14 04:41:05 | `revisor-geral` | 2 | REPROVADO | a57f742e1500bb878 |
| 2026-11-14 04:57:32 | 2026-11-14 04:57:49 | `revisor-geral` | 3 | APROVADO | a916a2a0544b07e70 |
