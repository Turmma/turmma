# Tarefa 10.0 — O chip e o PDF do artefato dizem título, edição e "edição anterior"

**Funcionalidade:** ingestao-do-material · **Depende de:** 9.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `frontend-reviewer`
**Porte:** pequeno

## Objetivo

O artefato gerado antes da troca de edição, ou da licença vencer, continua citando o material que usou, com título,
edição e "edição anterior"; depois do expurgo da linha, a fonte vira "material da escola".

## Contexto necessário

- `techspec.md` §4 (`GET /v1/artefatos/:id` com `fontes`), §7 (autorização por objeto, DTO), §9 (Chip e PDF), §11 (RF11)
- `prd.md` RF11, RF17
- `cenarios.md` "Edição nova" (as `fontes`, o expurgo), "Licença" (o rascunho), "Telas" (Chip e PDF)
- `.claude/rules/`: 10, 20 (item 4), 40, 50
- Código: `apps/api/src/artefato/artefato.repository.ts`, `apps/api/src/artefato/pdf-do-artefato.ts`; `apps/web/src/components/ui/ai/CitationChip.tsx`;
  `apps/web/src/areas/professor/artefatos/Artefato.tsx`, `apps/web/src/areas/professor/artefatos/ExportarPdf.tsx`, `apps/web/src/areas/professor/artefatos/api/titulos-dos-materiais.ts`

## Subtarefas

- [x] 10.1 — `fontes` no `GET /v1/artefatos/:id`: título, edição e `substituido`, só do artefato alcançado; sem a linha, "material da escola"
- [x] 10.2 — O chip e o PDF do artefato leem as `fontes` (o `titulos-dos-materiais.ts` sai ou passa a usá-las)
- [x] 10.3 — `docs/interface.md`: o chip com "edição anterior"
- [x] 10.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/src/artefato/artefato.repository.ts`, `apps/api/src/artefato/artefato.service.ts`, `apps/api/src/artefato/pdf-do-artefato.ts`, `packages/shared/src/assistente/artefato.ts`, `apps/api/src/artefato/artefato.int.test.ts`, `apps/web/src/components/ui/ai/CitationChip.tsx`, `apps/web/src/components/ui/ai/pecas-revestidas.test.tsx`, `apps/web/src/areas/professor/artefatos/Artefato.tsx`, `apps/web/src/areas/professor/artefatos/ExportarPdf.tsx`, `apps/web/src/areas/professor/artefatos/api/titulos-dos-materiais.ts`, `docs/interface.md` | alterado |
| `e2e/artefato-fontes.spec.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| caminho feliz | I | `fontes` com título e edição | `apps/api/src/artefato/artefato.int.test.ts › as fontes do artefato (ingestao-do-material, 10.0; RF11) › caminho feliz` |
| artefato antigo, edição substituída | I | `substituido` verdadeiro, título e edição da antiga | `apps/api/src/artefato/artefato.int.test.ts › as fontes do artefato (ingestao-do-material, 10.0; RF11) › a troca de edição` |
| rascunho com licença vencida | I | as `fontes` seguem; geração nova não usa o material | `apps/api/src/artefato/artefato.int.test.ts › as fontes do artefato (ingestao-do-material, 10.0; RF11) › o rascunho que cita material cuja licença venceu` |
| expurgo da linha | I | "material da escola" | `apps/api/src/artefato/artefato.int.test.ts › as fontes do artefato (ingestao-do-material, 10.0; RF11) › o expurgo da linha` |
| isolamento | I | artefato da B no contexto A: `NAO_ENCONTRADO`; `fontes` sem título da B | `apps/api/src/artefato/artefato.int.test.ts › as fontes do artefato (ingestao-do-material, 10.0; RF11) › isolamento: o artefato de c que cita o material de d…` (o título da `d` é outro; a linha dela existe) e `› o artefato de B no contexto de A…` |
| permissão: outro professor | I | `NAO_ENCONTRADO` | `apps/api/src/artefato/artefato.int.test.ts › as fontes do artefato (ingestao-do-material, 10.0; RF11) › o artefato de B no contexto de A, e quem não é o professor da turma…` (colega de outra turma, professora de Física, coordenação, aluno) |
| dois materiais citados | I | as `fontes` na ordem da primeira citação, sem repetir | `apps/api/src/artefato/artefato.int.test.ts › as fontes do artefato (ingestao-do-material, 10.0; RF11) › dois materiais citados…` |
| vínculo encerrado em X, aberto em Y | I | as `fontes` só de artefato alcançado | `apps/api/src/artefato/artefato.int.test.ts › as fontes do artefato (ingestao-do-material, 10.0; RF11) › a professora de Física, com o vínculo de Química encerrado, perde o artefato de Química e segue com o de Física…` |
| `contracts.test` | U | `fontes` sem hash, chave, quem enviou nem licenciante | `apps/api/test/contracts.test.ts › ingestao-do-material 10.0: GET /v1/artefatos/:id traz as fontes…`; `packages/shared/src/assistente/assistente.test.ts › as fontes do artefato (10.0)…` |
| chip: título e edição; "edição anterior"; "material da escola"; sem `fontes`; carregando e erro (divergência 1: os da tela) | U | um caso cada | `apps/web/src/areas/professor/artefatos/Artefato.test.tsx › as fontes do artefato… › título e edição pelas fontes` · `› "edição anterior"` · `› "material da escola"` · `› artefato sem fontes` · `› carregando e erro…`; o chip: `apps/web/src/components/ui/ai/pecas-revestidas.test.tsx › ChipFonte com as fontes de um artefato` (três casos e o sem fontes); o rótulo: `apps/web/src/components/ui/ai/source-labels.test.ts › os títulos das fontes…`; o resultado da ferramenta: `apps/web/src/areas/professor/ferramentas/ResultadoDaFerramenta.test.tsx` |
| PDF do artefato | U | o rodapé com título, edição e "edição anterior" | `apps/api/src/artefato/pdf-do-artefato.test.ts › o rodapé de cada questão diz o título, a edição e "edição anterior" da fonte…`; pela rota: o texto do PDF em `artefato.int.test.ts` (caminho feliz, troca, expurgo, licença) |
| recomeço: outro artefato na mesma aba; o mesmo de novo; resposta atrasada | E | o chip não mostra a fonte do anterior | `e2e/artefato-fontes.spec.ts › o recomeço: outro artefato na mesma aba e o mesmo de novo…; › a resposta atrasada de um terceiro artefato…` |
| nova edição, e o artefato antigo com "edição anterior" | E | fim a fim | `e2e/artefato-fontes.spec.ts › a troca de edição, de ponta a ponta com a API de verdade…` (a troca gravada no banco: a extração do PDF passa de 15 s; a troca real, com o worker, é a de `artefato.int.test.ts`) |
| cabe em 1366 × 768 | E | `paginaNaoRola` | `e2e/artefato-fontes.spec.ts › o chip diz título e edição e "edição anterior", e o artefato cabe na tela` |

## Como testar

- Rota: `apps/api/src/artefato/artefato.int.test.ts` › "o artefato de A não é lido, renomeado, exportado nem adaptado…" (l.228)
- Chip: `apps/web/src/components/ui/ai/pecas-revestidas.test.tsx` › "ChipFonte"
- `titulos-dos-materiais.ts` não tem teste: o caso nasce aqui
- e2e: `e2e/support/coordenacao.ts` (`irPelaCoordenacao`) para a nova edição, e a rota do professor para o artefato
- Comandos: `npx vitest run --project integracao apps/api/src/artefato/artefato.int.test.ts`; `node tools/ci/e2e.ts --manter-ambiente e2e/artefato-fontes.spec.ts`
- Armadilha: o estado "edição anterior" só depois da resposta do `GET`; a resposta atrasada segurada com `page.route`
- **Telas:** `professora`, `/professor/artefatos/:artefatoId` (o chip com edição, com "edição anterior", com "material da escola"); o PDF exportado

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano. Na 3: o artefato da A
e o da B citando material de escolas diferentes; o teste dá de propósito um título diferente ao da B (`Título confidencial da escola D`), para que o vazamento apareça no texto, em vez de um título igual que escondesse a troca. Na 5: o chip comparado pelo texto que o professor lê.

## Fora do escopo desta tarefa

Página e trecho da citação (já existem).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| O chip não tem estado "carregando" nem "erro" próprio; a linha da tabela de testes e o cenário "Chip e PDF do artefato" que os listavam passam a dizer que são os da tela do artefato | As `fontes` vêm na resposta de `GET /v1/artefatos/:id` (Tech Spec §4), a mesma que traz o conteúdo: não há leitura separada do chip, e onde a resposta ainda não chegou, ou falhou, não existe chip (`Carregando o artefato…`, `ErrorState`). O caso prova isso: nenhum chip nem título de fonte aparece nos dois estados | `techspec.md` §11, linha "10.0"; `cenarios.md` "Telas", item "Chip e PDF do artefato" |
| `fontes` leva também o `materialId`, na ordem da primeira citação, sem repetir | A tela liga cada citação à fonte pelo id; sem ele, o chip teria de adivinhar pelo título (que se repete entre edições) | `techspec.md` §4 (linha `GET /v1/artefatos/:id`) e §11, linha "10.0" |
| `titulosDosMateriais` do `ArtefatoRepository` vira `fontesDosMateriais` (título, edição, `substituido`); o texto "Título (edição, edição anterior)" é `rotuloDaFonte`, em `packages/shared`, o mesmo na tela e no rodapé do PDF | Uma só definição do texto, provada por um caso de unidade; a peça antiga só devolvia o título | `techspec.md` §11, linha "10.0" |
| `titulos-dos-materiais.ts` **não sai** e não passa a usar as `fontes`: o artefato aberto e o resultado da ferramenta deixam de ler dele, e ele fica para a conversa e a Turma hoje | A conversa e a Turma hoje não têm artefato com `fontes`; trocar a fonte delas é de outra tarefa. A subtarefa 10.2 admitia "sai ou passa a usá-las": o arquivo só ganhou o comentário que diz isso | `techspec.md` §11, linha "10.0" |
| `ExportarPdf.tsx` não muda | O PDF é gerado na API, com as mesmas `fontes` (`artefato.service.ts`, `pdf`); o botão só baixa o que ela entrega | `techspec.md` §11, linha "10.0" |
| O e2e "nova edição" grava a troca de edição no banco (`substituirMaterialNoBanco`) e abre o artefato pela API de verdade; a troca com o PDF e o worker é o caso de integração | A extração de um PDF novo passa de 15 s (metade do prazo do caso de e2e), e a tela de edição é a 12.0; o `irPelaCoordenacao` da seção "Como testar" só servia a esse caminho | `cenarios.md` "Testes", o `[E]` do lote e da edição (o e2e da 10.0 grava a troca no banco; o caso fim a fim da troca é o de `artefato.int.test.ts`), e `techspec.md` §11, linha "10.0"; a tela de edição com "edição anterior" é a 12.0 |

## Mutações

--faltando: 4 linhas (0 blocos, 4 motivos)

Cláusulas sem bloco, e por quê:

- `FonteDoArtefato`, `MAXIMO_DE_FONTES_NO_ARTEFATO` e o `.max(...)` de `fontes`: o teto não é alcançado por nenhum conteúdo válido (uma atividade tem até 20 questões e o plano, 8 etapas e 8 citações); é só a guarda do contrato.
- O `if (ids.length === 0) return new Map()` de `fontesDosMateriais`: é só a ida ao banco que se poupa (o `inArray` vazio do drizzle vira `false`, e o resultado é o mesmo com ou sem a guarda), então nenhum teste de comportamento a distingue; o caso `fontesDosMateriais([])` confere o retorno.
- As três linhas de `pdf-do-artefato.ts` que o `--faltando` lista (`etapa.citacao === undefined ? [] : [...]`, o `.replace(/^Fonte: /u, '')` da lista de fontes do plano e o `rascunho ? AVISO_DE_IA_NO_RASCUNHO : AVISO_DE_IA_NO_PDF`) e o `rascunho ? ... : conteudo.titulo` do `artefato.service.ts` são condições do código de antes: a tarefa só trocou o argumento `titulos` por `fontes` na mesma linha. O que ela acrescentou em cada uma (o `Map` de fontes, o `rotuloDaFonte`) tem bloco.
- O `...(edicao === null ? [] : [edicao])` e o `substituido ? [...]` de `rotuloDaFonte`: cada um tem o seu bloco.

```mutacao
arquivo: apps/api/src/artefato/artefato.repository.ts
teste: apps/api/src/artefato/artefato.int.test.ts
       .from(material)
-      .where(and(eq(material.escolaId, requireEscolaId()), inArray(material.id, [...ids])))
+      .where(inArray(material.id, [...ids]))
```

```mutacao
arquivo: apps/api/src/artefato/artefato.repository.ts
teste: apps/api/src/artefato/artefato.int.test.ts
       .from(material)
-      .where(and(eq(material.escolaId, requireEscolaId()), inArray(material.id, [...ids])))
+      .where(eq(material.escolaId, requireEscolaId()))
```

```mutacao
arquivo: apps/api/src/artefato/artefato.repository.ts
teste: apps/api/src/artefato/artefato.int.test.ts
-      .select({ id: material.id, titulo: material.titulo, edicao: material.edicao, substituido: sql<boolean>`${material.substituidoPor} is not null` })
+      .select({ id: material.id, titulo: material.titulo, edicao: material.edicao, substituido: sql<boolean>`false` })
```

```mutacao
arquivo: apps/api/src/artefato/artefato.service.ts
teste: apps/api/src/artefato/artefato.int.test.ts
-  const ids = [...new Set(citacoesDoConteudo(conteudo).map((citacao) => citacao.materialId))]
+  const ids = citacoesDoConteudo(conteudo).map((citacao) => citacao.materialId)
```

```mutacao
arquivo: apps/api/src/artefato/artefato.service.ts
teste: apps/api/src/artefato/artefato.int.test.ts
-  const ids = [...new Set(citacoesDoConteudo(conteudo).map((citacao) => citacao.materialId))]
+  const ids = [...new Set(citacoesDoConteudo(conteudo).map((citacao) => citacao.materialId))].sort()
```

```mutacao
arquivo: apps/api/src/artefato/artefato.service.ts
teste: apps/api/src/artefato/artefato.int.test.ts
-  return ids.map((materialId) => ({ materialId, ...(lidas.get(materialId) ?? { titulo: TITULO_DA_FONTE_SEM_LINHA, edicao: null, substituido: false }) }))
+  return ids.map((materialId) => ({ materialId, ...(lidas.get(materialId) ?? { titulo: 'x', edicao: null, substituido: false }) }))
```

```mutacao
arquivo: apps/api/src/artefato/artefato.service.ts
teste: apps/api/src/artefato/artefato.int.test.ts
-    const fontes = await fontesDoConteudo(new ArtefatoRepository(this.banco), conteudo)
+    const fontes: FonteDoArtefato[] = []
```

```mutacao
arquivo: apps/api/src/artefato/artefato.service.ts
teste: apps/api/src/artefato/artefato.int.test.ts
-    return { nome: nomeDoArquivoDoPdf(rascunho ? `rascunho ${conteudo.titulo}` : conteudo.titulo), bytes: await gerarPdfDoArtefato(conteudo, new Map(fontes.map((fonte) => [fonte.materialId, fonte])), { rascunho }) }
+    return { nome: nomeDoArquivoDoPdf(rascunho ? `rascunho ${conteudo.titulo}` : conteudo.titulo), bytes: await gerarPdfDoArtefato(conteudo, new Map(), { rascunho }) }
```

```mutacao
arquivo: apps/api/src/artefato/artefato.service.ts
teste: apps/api/src/artefato/artefato.int.test.ts
       conteudo,
-      fontes,
+      fontes: [],
```

```mutacao
arquivo: apps/api/src/artefato/pdf-do-artefato.ts
teste: apps/api/src/artefato/pdf-do-artefato.test.ts
-  return `Fonte: ${fonte === undefined ? TITULO_DA_FONTE_SEM_LINHA : rotuloDaFonte(fonte)}, p. ${String(citacao.pagina)}`
+  return `Fonte: ${fonte === undefined ? TITULO_DA_FONTE_SEM_LINHA : fonte.titulo}, p. ${String(citacao.pagina)}`
```

```mutacao
arquivo: apps/api/src/artefato/pdf-do-artefato.ts
teste: apps/api/src/artefato/pdf-do-artefato.test.ts
-  return `Fonte: ${fonte === undefined ? TITULO_DA_FONTE_SEM_LINHA : rotuloDaFonte(fonte)}, p. ${String(citacao.pagina)}`
+  return `Fonte: ${rotuloDaFonte(fonte ?? { titulo: 'x', edicao: null, substituido: false })}, p. ${String(citacao.pagina)}`
```

```mutacao
arquivo: packages/shared/src/assistente/artefato.ts
teste: packages/shared/src/assistente/assistente.test.ts
-  const detalhes = [...(edicao === null ? [] : [edicao]), ...(substituido ? ['edição anterior'] : [])]
+  const detalhes = [...(substituido ? ['edição anterior'] : [])]
```

```mutacao
arquivo: packages/shared/src/assistente/artefato.ts
teste: packages/shared/src/assistente/assistente.test.ts
-  const detalhes = [...(edicao === null ? [] : [edicao]), ...(substituido ? ['edição anterior'] : [])]
+  const detalhes = [...(edicao === null ? [] : [edicao])]
```

```mutacao
arquivo: packages/shared/src/assistente/artefato.ts
teste: packages/shared/src/assistente/assistente.test.ts
-  return detalhes.length === 0 ? titulo : `${titulo} (${detalhes.join(', ')})`
+  return `${titulo} (${detalhes.join(', ')})`
```

```mutacao
arquivo: packages/shared/src/assistente/artefato.ts
teste: packages/shared/src/assistente/assistente.test.ts
-  edicao: z.string().min(1).nullable(),
+  edicao: z.string().nullable(),
```

```mutacao
arquivo: packages/shared/src/assistente/artefato.ts
teste: packages/shared/src/assistente/assistente.test.ts
-    fontes: z.array(fonteDoArtefatoSchema).max(MAXIMO_DE_FONTES_NO_ARTEFATO),
+    fontes: z.array(fonteDoArtefatoSchema).max(MAXIMO_DE_FONTES_NO_ARTEFATO).optional(),
```

```mutacao
arquivo: apps/web/src/components/ui/ai/source-labels.ts
teste: apps/web/src/components/ui/ai/source-labels.test.ts
-  return Object.fromEntries(fontes.map((fonte) => [fonte.materialId, rotuloDaFonte(fonte)]))
+  return Object.fromEntries(fontes.map((fonte) => [fonte.materialId, fonte.titulo]))
```

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/Artefato.tsx
teste: apps/web/src/areas/professor/artefatos/Artefato.test.tsx
-                <ConteudoDoArtefato conteudo={dados.conteudo} materiais={titulosDasFontes(dados.fontes)} comGabarito={comGabarito} />
+                <ConteudoDoArtefato conteudo={dados.conteudo} materiais={{}} comGabarito={comGabarito} />
```

```mutacao
arquivo: apps/web/src/areas/professor/ferramentas/ResultadoDaFerramenta.tsx
teste: apps/web/src/areas/professor/ferramentas/ResultadoDaFerramenta.test.tsx
-        <ConteudoDoArtefato conteudo={data.conteudo} materiais={titulosDasFontes(data.fontes)} resumido />
+        <ConteudoDoArtefato conteudo={data.conteudo} materiais={{}} resumido />
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| privacy-guardian (1ª); revisor-geral (1ª) | Unificar "material da escola" (API) e "Material da escola" (tela) | Muda o texto da tela e o contrato de `fontes`, o que passa dos poucos comandos "baratos"; `TODO.md` (o item 2.4 só registra o porquê num comentário) |
| conformidade-reviewer (1ª); frontend-reviewer (1ª) | A conversa e a Turma hoje (`titulos-dos-materiais.ts`) ficam sem "edição anterior" | `TODO.md`: trocar a fonte delas é de outra tarefa; o `10_task.md` já registra isso na divergência 4 |
| frontend-reviewer (1ª) | A vitrine da escola cheia deveria montar artefato com "edição anterior" e outro com "material da escola" | `TODO.md`: é de `tools/vitrine/`, fora do escopo e dos arquivos previstos da 10.0; o Validador fotografa os dois estados |
| frontend-reviewer (1ª) | O título "Artefato" da tela de não disponível é termo interno | `TODO.md`: já existia e não é desta tarefa |
| test-engineer (1ª) | "Rascunho" no nome do caso da licença: a versão adaptada pendente, que sai em PDF marcado como rascunho, não é provada junto com as `fontes` e a licença vencida | `TODO.md`: um caso novo pela rota, com entrega pendente, passa de poucas linhas; o `cenarios.md` "Licença" e o item 2.6 da ordem ficam como estão |
| test-engineer (1ª) | Quando a tela de edição chegar (12.0), um e2e que passe por ela e confira "edição anterior" | Registrado no `cenarios.md` e na Tech Spec §11 (divergência do e2e "nova edição"); a 12.0 não o confere hoje |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-13 22:33:10 | 2026-11-13 22:33:38 | `tenancy-guardian` | 1 | APROVADO | a2d8d9f3e044a3b55 |
| 2026-11-13 22:33:17 | 2026-11-13 22:33:47 | `infra-guardian` | 1 | APROVADO | a724bc0b16747be49 |
| 2026-11-13 22:33:20 | 2026-11-13 22:33:56 | `conformidade-reviewer` | 1 | APROVADO | a7d29f024d6ff7096 |
| 2026-11-13 22:33:34 | 2026-11-13 22:33:57 | `frontend-reviewer` | 1 | APROVADO | a210d4482e26393b2 |
| 2026-11-13 22:33:14 | 2026-11-13 22:34:01 | `privacy-guardian` | 1 | APROVADO | ad551b404f4b5af2f |
| 2026-11-13 22:33:27 | 2026-11-13 22:34:51 | `revisor-geral` | 1 | REPROVADO | a5bddd60b9c7cbe2d |
| 2026-11-13 22:33:24 | 2026-11-13 22:34:59 | `test-engineer` | 1 | APROVADO | a54949fe2b0075b00 |
| 2026-11-13 22:51:31 | 2026-11-13 22:51:51 | `tenancy-guardian` | 2 | APROVADO | aa9801c8b3e719f5a |
| 2026-11-13 22:51:42 | 2026-11-13 22:51:56 | `infra-guardian` | 2 | APROVADO | ab6cc6aac110a47c0 |
| 2026-11-13 22:51:36 | 2026-11-13 22:51:57 | `privacy-guardian` | 2 | APROVADO | aa94f063cf7f07432 |
| 2026-11-13 22:51:48 | 2026-11-13 22:52:06 | `conformidade-reviewer` | 2 | APROVADO | a91dcc726d3e0d3a3 |
| 2026-11-13 22:52:11 | 2026-11-13 22:52:28 | `frontend-reviewer` | 2 | APROVADO | ad77c92c833cfd67b |
| 2026-11-13 22:51:54 | 2026-11-13 22:52:33 | `test-engineer` | 2 | APROVADO | ad81f5e474a49a085 |
| 2026-11-13 22:52:02 | 2026-11-13 22:52:46 | `revisor-geral` | 2 | APROVADO | aea99f7763fde3cdd |
