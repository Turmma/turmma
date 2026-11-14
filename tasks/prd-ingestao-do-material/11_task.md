# Tarefa 11.0 — O resumo no topo da aba Material

**Funcionalidade:** ingestao-do-material · **Depende de:** 7.0
**Subagentes obrigatórios:** `tenancy-guardian`, `frontend-reviewer`
**Porte:** pequeno

## Objetivo

No topo da aba Material, a coordenação vê, por disciplina e série, quantos materiais estão prontos, processando e com
falha, quantos envios foram recusados em 30 dias, e quantos estão sem série.

## Contexto necessário

- `techspec.md` §4 (`GET /v1/materiais/resumo`), §7 (resumo só da coordenação), §7b (resumo sem pessoa), §7c (o índice da auditoria), §9 (Material), §13
- `prd.md` RF18, RF20
- `cenarios.md` "Resumo", "Telas" (Resumo, lista), "Permissão…", "Isolamento"
- `.claude/rules/`: 10, 40, 50, 70 (item 9), 80 (índice sem `concurrently`, exceção da 0034)
- Código: `apps/api/src/material/material.controller.ts`, `apps/api/src/material/material.repository.ts`; `apps/web/src/areas/coordenacao/material/Material.tsx`, `apps/web/src/areas/coordenacao/material/materiais-da-escola.ts`

## Subtarefas

- [x] 11.1 — Migration: índice `auditoria (escola_id, em) where acao = 'material.recusado'`
- [x] 11.2 — `GET /v1/materiais/resumo`: por disciplina e série, `pronto`, `processando`, `falhou`, `recusados30Dias` (`MATERIAL_SEM_LICENCA` e `LICENCA_VENCIDA`), e `semSerie`; excluído e substituído não contam; só coordenação
- [x] 11.3 — O resumo na tela: lista a 360 px, tabela no Chromebook; o aviso "séries atribuídas na migração"; os quatro estados; a lista de materiais com "Mostrar mais"
- [x] 11.4 — `docs/interface.md`: a aba Material com o resumo
- [x] 11.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/drizzle/0057_auditoria_material_recusado.sql`, `packages/core/drizzle/meta/0057_snapshot.json`, `apps/api/test/material-resumo.int.test.ts`, `apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx`, `apps/web/src/areas/coordenacao/material/ResumoDoMaterial.test.tsx`, `apps/web/src/areas/coordenacao/material/api/resumo.ts`, `apps/web/src/areas/coordenacao/material/resumo-do-material.ts`, `apps/web/src/areas/coordenacao/material/resumo-do-material.test.ts`, `e2e/material-resumo.spec.ts` | novo |
| `packages/core/drizzle/meta/_journal.json`, `packages/core/src/db/schema/auditoria.ts`, `packages/core/src/auditoria/auditoria.repository.ts`, `packages/core/src/auditoria/porta-unica.test.ts`, `packages/core/src/db/migracao-f4.int.test.ts`, `packages/core/src/index.ts`, `packages/shared/src/index.ts`, `packages/shared/src/material/material.ts`, `packages/shared/src/material/material.test.ts`, `packages/shared/src/permissao/matriz.ts`, `packages/shared/src/permissao/matriz.expectativa.ts`, `packages/shared/src/permissao/matriz.test.ts`, `apps/api/src/material/material.controller.ts`, `apps/api/src/material/material.service.ts`, `apps/api/src/material/material.repository.ts`, `apps/web/src/areas/coordenacao/material/Material.tsx`, `apps/web/src/areas/coordenacao/material/Material.test.tsx`, `apps/web/src/areas/coordenacao/material/materiais-da-escola.ts`, `e2e/support/material.ts`, `docs/interface.md`, `tasks/prd-ingestao-do-material/techspec.md`, `tasks/prd-ingestao-do-material/cenarios.md` | alterado |

`e2e/material.spec.ts` **não** é alterado: tem 776 linhas e os casos novos o levariam além do teto de 800 (`max-lines`), e o e2e do resumo é arquivo próprio (divergência 6).

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| material com duas séries | I | conta nas duas | `apps/api/test/material-resumo.int.test.ts › resumo do material da escola › os materiais por disciplina e série › o material com duas séries conta nas duas…` |
| cada estado na sua coluna | I | `pronto`, `processando`, `falhou` | `… › os materiais por disciplina e série › cada estado conta na sua coluna…` |
| excluído; substituído | I | não contam (um caso cada) | `… › o material excluído não conta`; `… › o material substituído não conta…` |
| `semSerie` | I | conta, na linha sem série; a soma de três materiais em duas linhas | `… › o material sem série conta em `semSerie`, na linha sem série da disciplina: a soma é a de todos, e não um por linha` |
| recusa de 29 dias; de 31 | I | conta; não conta, pelo mesmo `Clock` | `… › os envios recusados em 30 dias › a recusa de 29 dias atrás conta e a de 31 não…` |
| motivos | I | `MATERIAL_SEM_LICENCA` (sem licença, sem declaração) e `LICENCA_VENCIDA` contam; a licença inexistente (`NAO_ENCONTRADO`) não | `… › os envios recusados em 30 dias › MATERIAL_SEM_LICENCA (sem licença e sem declaração) e LICENCA_VENCIDA contam; a licença inexistente, que responde NAO_ENCONTRADO, não` |
| por disciplina e série | I | a recusa cai na série que ela conferiu; a de edição sem série, na linha sem série; outra ação com o mesmo `depois` não entra | `… › a recusa cai na série que ela conferiu…`; `… › a recusa sem série, da edição de um material…`; `… › só conta o registro material.recusado: outra ação com o mesmo formato de depois não entra` |
| índice parcial | I | o plano usa `auditoria_material_recusado_idx`, e ele é parcial, na escola e no instante, no banco migrado do zero | `… › o índice parcial da recusa serve à consulta que o resumo manda ao banco…` (o `EXPLAIN` roda o SQL que `recusasDeMaterialDesde` gera, capturado no executor); `… › sem nenhum motivo a contar, a resposta é vazia, sem consulta ao banco`; `… › só conta o registro cuja entidade é a disciplina…`; `packages/core/src/db/migracao-f4.int.test.ts › o índice da recusa de material (11.0) › o índice da recusa é parcial na ação…` |
| isolamento | I | o resumo da A sem material nem recusa da B. Mutação: tirar o `escola_id` | `… › isolamento e permissão › o resumo da A não leva material, recusa nem material sem série da B` |
| permissão: professor, aluno | I | recusado, `NAO_ENCONTRADO` igual ao de uma rota que não existe (`/v1/rota-que-nao-existe`, fora de `/v1/materiais`) | `… › o professor e o aluno recebem o 404 de NAO_ENCONTRADO, o mesmo de uma rota que não existe…` |
| escola sem ano letivo | I | a coordenação vê | `… › a coordenação de escola sem ano letivo em curso vê o resumo, vazio` |
| DTO | I, U | só ids e contagens | `… › a resposta só traz ids e contagens…`; `packages/shared/src/material/material.test.ts › o resumo do material (ingestao-do-material, 11.0; RF18)…` (quatro casos: campo a mais, contagem negativa, ids, janela e motivos) |
| permissão na matriz | U | `resumir`: coordenação `unidade`; professor, aluno e rede `nunca` | `packages/shared/src/permissao/matriz.test.ts` (a expectativa à mão, `matriz.expectativa.ts`, e o caso do MVP) |
| estados do resumo | U | carregando, erro, vazio, com dado; o vazio só com a leitura terminada; cada uma das três leituras sozinha | `apps/web/src/areas/coordenacao/material/ResumoDoMaterial.test.tsx › o resumo do material: os quatro estados` (os quatro, mais `carregando enquanto só <caminho> não chegou` e `erro enquanto só <caminho> falhou`, três cada) |
| a chave do resumo | U | fica sob a de Material, e a sessão seguinte esvazia as duas | `apps/web/src/areas/coordenacao/material/resumo-do-material.test.ts › a chave do resumo` |
| a releitura | U | o resumo não tem laço próprio: relê só quando a lista mostra um estado que mudou (ou quando o resumo, lido antes ou depois da lista, ainda conta `processando` e a lista não); o erro ao lado do número de antes, "Tentando de novo…", e o vazio que não se diz com a releitura caída; o "Tentar de novo o resumo" relê as três leituras | `apps/web/src/areas/coordenacao/material/ResumoDoMaterial.test.tsx › o resumo do material: a releitura` (oito casos, entre eles "o resumo relido que ainda conta…", que prova a releitura única, sem laço); `apps/web/src/areas/coordenacao/material/resumo-do-material.test.ts › a releitura do resumo` |
| o erro do resumo e o da lista juntos | U | dois botões com nomes diferentes, e só o da lista é o cheio | `apps/web/src/areas/coordenacao/material/Material.test.tsx › o erro do resumo e o da lista juntos` |
| 360 px e Chromebook | U | lista e tabela | `apps/web/src/areas/coordenacao/material/ResumoDoMaterial.test.tsx › o resumo do material: tabela no computador, lista no celular` |
| aviso da migração | U | aparece com `semSerie` ou com séries do backfill; a aba lê a lista que já leu | `apps/web/src/areas/coordenacao/material/ResumoDoMaterial.test.tsx › o resumo do material: o aviso das séries atribuídas na migração` (cinco casos); `apps/web/src/areas/coordenacao/material/resumo-do-material.test.ts › o aviso da migração`; `apps/web/src/areas/coordenacao/material/Material.test.tsx › o resumo no topo da aba › o aviso das séries atribuídas…` e `› sem material de todas as séries…` |
| ordem das linhas | U | disciplina, série, "Série" não lida, "Sem série" por último | `apps/web/src/areas/coordenacao/material/resumo-do-material.test.ts › as linhas do resumo` (três casos) |
| resumo na aba | U | vem antes da tabela; a exclusão (pela lista que mudou) e a recusa relêem o resumo | `apps/web/src/areas/coordenacao/material/Material.test.tsx › o resumo no topo da aba` (quatro casos) |
| lista: estados e "Mostrar mais" | U | um caso cada; a troca de sessão volta às 25 linhas | `apps/web/src/areas/coordenacao/material/Material.test.tsx › os quatro estados da tela`; `apps/web/src/areas/coordenacao/material/Material.test.tsx › a tabela de materiais com "Mostrar mais"` (≤ 25, 30, 60) |
| professor | E | não vê o resumo | `e2e/material-resumo.spec.ts › O resumo do material › o professor não alcança o resumo…` |
| recomeço: segunda pessoa na aba | E | o resumo da anterior sai | `e2e/material-resumo.spec.ts › O resumo do material › segunda pessoa: a contagem de A não aparece…` |
| com dado, a recusa, o vazio | E | contagem por disciplina e série, aviso, a recusa entra sem recarregar; o vazio | `e2e/material-resumo.spec.ts › O resumo do material › contagem por disciplina e série…`; `… › sem material: o vazio…` |
| cabe em 1366 × 768 | E | `paginaNaoRola`, com "Mostrar mais" | `e2e/material-resumo.spec.ts › O resumo do material › numa escola com 300 materiais a tabela mostra 25…` |

## Como testar

- Tela: `apps/web/src/areas/coordenacao/material/Material.test.tsx`, o `montar('/material')`; `materiais-da-escola.test.ts` › "o envio recusado é falha e vem na frente de tudo…"
- Rota: `apps/api/test/material.int.test.ts`, os casos de permissão; auditoria gravada como em `apps/api/test/importacao-alunos.int.test.ts:330`
- e2e: `e2e/material-resumo.spec.ts` (o caso novo); o padrão veio de `e2e/material.spec.ts` › "a coordenação sobe o PDF de demonstração…"; `paginaNaoRola` e `linhasDaTabela` de `e2e/support/coordenacao.ts`
- Comandos: `npx vitest run --project integracao apps/api/test/material-resumo.int.test.ts`; `node tools/ci/e2e.ts --manter-ambiente e2e/material-resumo.spec.ts e2e/material.spec.ts`
- Armadilha: 29 e 31 dias pelo mesmo `Clock`; o `EXPLAIN` do índice parcial no plano
- **Telas:** `coordenacao`, `/coordenacao/material` (resumo vazio, com dado, com `semSerie`; a 360 px)

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano. Na 1: cada motivo
da lista e cada estado que não conta são blocos. Na 3: a recusa de outro motivo é o segundo dado.

As respostas do plano, em uma linha cada:

1. Cada cláusula do SQL do `AuditoriaRepository` (escola, ação, janela, motivos, junção à esquerda), do repository do material (escola, excluído, junção à esquerda e a junção por material), do serviço (a soma na mesma linha, a chave por disciplina e série, `semSerie`, a janela de 30 dias pelo `Clock`), da rota (a célula da permissão), da matriz (as quatro células e a lista), do contrato zod (estrito, inteiro, não negativo, uuid, nulo só na série), as duas partes do índice da migration, e na tela cada condição do JSX, os três termos de cada leitura, o passo da releitura, a `queryKey` do resumo e as duas invalidações: um bloco cada, ou o motivo escrito em "Mutações".
2. O texto novo ("Resumo do material", "Mostrar mais", "Mostrando 25 de N", "Carregando o resumo…", "Sem série", o aviso da migração) foi procurado em `e2e/` (`grep -rln`): só o spec novo os cita; `e2e/material.spec.ts` conta as linhas pela região "Materiais da escola", e o resumo ficou fora dela de propósito. O `material.spec.ts` inteiro rodou isolado, junto do novo, nos dois projetos.
3. Segundo dado: duas séries no mesmo material; duas disciplinas; a escola B com material, material sem série e recusa; uma disciplina por motivo (a da licença inexistente fica sem linha); 29 e 31 dias; a recusa de uma série e a de duas.
4. Nada responde antes da regra: a escola sem ano letivo tem caso próprio (o resumo não usa o ano), o professor e o aluno caem no `NAO_ENCONTRADO` da guarda antes do serviço (e o caso confere que o corpo não tem `linhas`), e o isolamento lê no contexto da A o que a B gravou.
5. As asserções leem o que a coordenação obtém (a resposta da rota, a tabela e o aviso na tela). A ausência (o professor sem pedido do resumo; a contagem da pessoa anterior) só vale depois de "Página não encontrada" e da resposta do resumo da pessoa seguinte, segurada com `page.route` e solta antes.
6. Não há guarda nova (regra de lint, teste estrutural): não se aplica.
7. Os comentários foram relidos contra o código: o do repository diz que o substituído sai porque a extração marca `excluido_em` na mesma transação (é o que a 8.0 faz); o do resumo diz que a ordem é da tela (a API não ordena).
8. Há divergências, todas na tabela, com a linha "11.0" da seção 11 da Tech Spec e o "Resumo (RF18)" do `cenarios.md`; a palavra do código foi procurada nos dois (`grep -n "recusasDeMaterialDesde\|material.resumir\|material-resumo.spec" techspec.md cenarios.md`).
9. Reaproveitado: `AuditoriaRepository` (a porta de leitura, com um método novo), `Table`, `LoadingState`/`ErrorState`, `INTERVALO_DA_LEITURA_DO_MATERIAL_MS`, `lerPaginas`, `linhasDaTabela` e `paginaNaoRola` do e2e. Nada copiado.
10. O resumo é leitura: não há operação que corra duas vezes. A resposta fora de ordem é a da segunda pessoa na aba, forçada no e2e (a leitura do resumo segurada com `page.route`), e a releitura sozinha contra o "Tentar de novo" é o caso da releitura, com a terceira leitura no ar.
11. O isolamento remove a cláusula de escopo dos dois repositories e fica vermelho (blocos 1 e 15); todo id do caso da B é lido no contexto da A, e a tabela de testes tem o caso de cada linha.
12. `tenancy-guardian` (escopo nos dois repositories e a permissão por papel), `frontend-reviewer` (os quatro estados, 360 px, foco, texto sem termo técnico) e o `achados/indice.md` (a 6.0 reprovou por "termo técnico na tela": o aviso usa o texto do `cenarios.md`, e o vocabulário da escola).

## Fora do escopo desta tarefa

O painel do material (12.0); cobertura por habilidade (F4b).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| A recusa é lida da auditoria por um método novo do `AuditoriaRepository`, `recusasDeMaterialDesde`, e não por consulta no repository do material | A tabela `auditoria` não sai de `@educa/core` (a regra 10 e a `porta-unica.test.ts` restringem quem a importa): a única porta de leitura é o `AuditoriaRepository`, e a lista de métodos dele no teste ganhou o novo. O SQL escreve `acao = 'material.recusado'` no texto, e não como parâmetro, para o índice parcial servir | `techspec.md` §11, linha "11.0"; `cenarios.md` "Resumo (RF18)" |
| A permissão é a célula nova `material.resumir` (coordenação `unidade`; professor, aluno e rede `nunca`), e não `material.listar` | `listar` é do professor (`turma_vinculada`); a rota do resumo é só da coordenação, e o `nunca` já responde `NAO_ENCONTRADO` igual ao da rota que não existe (regra 10, item 6). A matriz passa de 42 para 43 rotas do MVP | `techspec.md` §4 (linha da rota) e §11, linha "11.0"; `cenarios.md` "Resumo (RF18)" |
| Os "motivos que contam" são três (`sem_licenca`, `sem_declaracao`, `licenca_vencida`), que são os dois códigos do cenário (`MATERIAL_SEM_LICENCA` cobre os dois primeiros); `licenca_inexistente` não conta | A API responde `NAO_ENCONTRADO` a ela, igual à da licença de outra escola: contá-la diria à coordenação que a licença da escola B existe | `techspec.md` §11, linha "11.0"; `cenarios.md` "Resumo (RF18)" |
| O material sem série é a linha de `serieId` nulo da disciplina, e entra também em `semSerie` (o total que dispara o aviso); a recusa de uma edição sobre material sem série cai nessa linha | `material.recusado` aceita de zero a sete séries (8.0), e o material que a migração deixou sem série precisa de lugar na tabela, para a coordenação o achar e conferir a série | `techspec.md` §4 (linha da rota) e §11, linha "11.0" |
| "Mostrar mais" é da tela, de 25 em 25, sobre a lista que a aba já leu inteira; não há página nova na API | A lista inteira é lida por `lerPaginas` e é a mesma fila que o Painel usa; paginar no servidor exigiria outra leitura só para a aba. O que pesa no Chromebook é desenhar 300 linhas, e isso o botão limita | `techspec.md` §11, linha "11.0"; `cenarios.md` "Telas", "Lista de materiais" |
| O resumo é uma região própria, **fora** da região "Materiais da escola" | O e2e conta as linhas da lista pela região dela (`linhasDaLista`), e as linhas da tabela do resumo não são linhas de material | `techspec.md` §11, linha "11.0" |
| A API não ordena as linhas do resumo: a ordem é da tela (nome da disciplina, posição da série, "Sem série" por último) | A API só conhece ids; quem lê os nomes é a tela, e uma ordem por id na API seria a ordem que ninguém lê | `techspec.md` §11, linha "11.0" |
| O e2e do resumo é `e2e/material-resumo.spec.ts`, e `e2e/material.spec.ts` não muda | O arquivo já está no teto de 800 linhas (`max-lines`); o padrão (um arquivo por assunto) é o de `material-licencas.spec.ts` | `techspec.md` §11, linha "11.0" |

## Mutações

--faltando: 20 linhas (0 blocos, 10 motivos)

Cláusulas sem bloco, e por quê:

- `auditoria.repository.ts`, o `group by a.entidade_id, s.serie_id` e o `count(*)`: o serviço soma as linhas de mesma disciplina e série (`+=`), então o resultado é o mesmo com ou sem o agrupamento; ele só poupa linhas na volta do banco.
- `material.repository.ts`, `eq(materialSerie.escolaId, material.escolaId)` da junção: o `material_id` é um uuid v7 único, e a linha de `material_serie` que o cita é da mesma escola por chave estrangeira composta (`material_serie_material_da_escola_fk`); sem o termo o resultado é o mesmo. Fica por causa do índice (`material_serie_pk` começa por `escola_id`).
- `material.service.ts`, `linhaDe(...)[contado.estado] += contado.total` e `recusados30Dias += recusada.total`: cada grupo (disciplina, série, estado) chega uma vez por consulta, então `+=` e `=` dão o mesmo resultado; o `+=` é o que ainda soma com a linha criada por outra fonte (a recusa sobre uma linha de material), e o caso "a recusa sem série… conta na linha sem série" prova a soma das duas fontes na mesma linha.
- `material.service.ts`, o `?? ''` da chave da linha: `null` e `''` são chaves diferentes de qualquer id, e o resultado não muda com outro texto.
- `material.service.ts`, `(this.dependencias.relogio ?? systemClock)` sem o relógio injetado em produção: o ramo `systemClock` é o de produção, e o do teste (`relogioDasLicencas`) tem bloco.
- `Material.tsx`, as linhas de JSX e de estado que o `--faltando` lista (os ternários de carregando, erro, vazio, `emLeitura`, `doPainel`, o diálogo, a exclusão, `substituiu`): são condições de antes, só reindentadas pelo `<div>` que embrulha o resumo e a lista; os testes e o e2e de antes as provam, e o diff delas é só de espaço (`git diff -w`).
- `Material.tsx`, `const linhas = lista === undefined ? [] : linhasDosMateriais(lista.itens, recusas)`: a guarda de tipo da lista ainda não lida; `[]` e `linhasDosMateriais([], recusas)` são a mesma coisa, e a tabela só se desenha com a lista lida.
- `resumo-do-material.ts`, `linha.serieId === null ? undefined : serieDe.get(linha.serieId)` (duas vezes): `serieDe.get(null)` também dá `undefined`; a guarda é do tipo.
- `resumo-do-material.ts`, a linha `? 'Séries atribuídas na migração: o material enviado antes…'`: é a continuação do ternário de `comTodas`, que tem o bloco `return comTodas` → `return true`; o texto é provado pelo `toMatch(/vale para todas as séries da escola/)`.
- `resumo-do-material.ts`, `... === true` de `comTodas` e o `?.` de `materiais?.some`: `undefined === true` é falso, e o `?.` só evita o erro de tipo da lista ainda não lida; o caso "sem lista lida, não há aviso" a fixa.
- `packages/core/src/db/schema/auditoria.ts`, o índice: é o espelho da migration `0057` (o drizzle-kit a gerou dele); o que o banco tem é a migration, e os dois blocos dela abaixo provam as duas partes do índice. A guarda "schema igual à migration" está nas recomendações da 5.0 (retro).
- `ResumoDoMaterial.tsx`, os `COLUNAS` (títulos e `formatNumber`): são dados da tabela, provados pelo caso "com dado" (os seis títulos e os números, `1.200` com o ponto).

```mutacao
arquivo: packages/core/src/auditoria/auditoria.repository.ts
teste: apps/api/test/material-resumo.int.test.ts › o resumo da A não leva material, recusa nem material sem série da B
-      where a.escola_id = ${escolaId}
-        and a.acao = 'material.recusado'
+      where a.acao = 'material.recusado'
```

```mutacao
arquivo: packages/core/src/auditoria/auditoria.repository.ts
teste: apps/api/test/material-resumo.int.test.ts › só conta o registro
falha: expect(linhaDe(resumo, escola.quimica, escola.serieId)).toBeUndefined()
-        and a.acao = 'material.recusado'
```

```mutacao
arquivo: packages/core/src/auditoria/auditoria.repository.ts
teste: apps/api/test/material-resumo.int.test.ts › a recusa de 29 dias atrás conta e a de 31 não
falha: expect(linhaDe(depois, escola.quimica, escola.serieId)).toBeUndefined()
-        and a.em >= ${desde.toISOString()}::timestamptz
```

```mutacao
arquivo: packages/core/src/auditoria/auditoria.repository.ts
teste: apps/api/test/material-resumo.int.test.ts › a licença inexistente, que responde
falha: expect(linhaDe(resumo, geografia, escola.serieId)).toBeUndefined()
-        and a.depois ->> 'motivo' in (${sql.join(
-          motivos.map((motivo) => sql`${motivo}`),
-          sql`, `,
-        )})
```

```mutacao
arquivo: packages/core/src/auditoria/auditoria.repository.ts
teste: apps/api/test/material-resumo.int.test.ts › a recusa sem série, da edição de um material
-      left join lateral jsonb_array_elements_text(a.depois -> 'serieIds') as s(serie_id) on true
+      join lateral jsonb_array_elements_text(a.depois -> 'serieIds') as s(serie_id) on true
```

```mutacao
arquivo: packages/core/drizzle/0057_auditoria_material_recusado.sql
teste: packages/core/src/db/migracao-f4.int.test.ts › o índice da recusa é parcial na ação
-CREATE INDEX "auditoria_material_recusado_idx" ON "auditoria" USING btree ("escola_id","em") WHERE "auditoria"."acao" = 'material.recusado';
+CREATE INDEX "auditoria_material_recusado_idx" ON "auditoria" USING btree ("escola_id","em");
```

```mutacao
arquivo: packages/core/drizzle/0057_auditoria_material_recusado.sql
teste: packages/core/src/db/migracao-f4.int.test.ts › o índice da recusa é parcial na ação
-CREATE INDEX "auditoria_material_recusado_idx" ON "auditoria" USING btree ("escola_id","em") WHERE "auditoria"."acao" = 'material.recusado';
+CREATE INDEX "auditoria_material_recusado_idx" ON "auditoria" USING btree ("em") WHERE "auditoria"."acao" = 'material.recusado';
```

```mutacao
arquivo: packages/shared/src/material/material.ts
teste: packages/shared/src/material/material.test.ts › a janela é de 30 dias
-export const DIAS_DAS_RECUSAS_NO_RESUMO = 30
+export const DIAS_DAS_RECUSAS_NO_RESUMO = 29
```

```mutacao
arquivo: packages/shared/src/material/material.ts
teste: packages/shared/src/material/material.test.ts › a janela é de 30 dias
-export const MOTIVOS_DA_RECUSA_QUE_O_RESUMO_CONTA: readonly (MotivoDaRecusaDoMaterial | MotivoDaRecusaPelaLicencaRegistrada)[] = ['sem_licenca', 'sem_declaracao', 'licenca_vencida']
+export const MOTIVOS_DA_RECUSA_QUE_O_RESUMO_CONTA: readonly (MotivoDaRecusaDoMaterial | MotivoDaRecusaPelaLicencaRegistrada)[] = ['sem_licenca', 'licenca_vencida']
```

```mutacao
arquivo: packages/shared/src/material/material.ts
teste: apps/api/test/material-resumo.int.test.ts › a licença inexistente, que responde
-export const MOTIVOS_DA_RECUSA_QUE_O_RESUMO_CONTA: readonly (MotivoDaRecusaDoMaterial | MotivoDaRecusaPelaLicencaRegistrada)[] = ['sem_licenca', 'sem_declaracao', 'licenca_vencida']
+export const MOTIVOS_DA_RECUSA_QUE_O_RESUMO_CONTA: readonly (MotivoDaRecusaDoMaterial | MotivoDaRecusaPelaLicencaRegistrada)[] = ['sem_licenca', 'sem_declaracao']
```

```mutacao
arquivo: packages/shared/src/material/material.ts
teste: packages/shared/src/material/material.test.ts › a contagem negativa ou fracionária não passa
-const contagem = z.number().int().nonnegative()
+const contagem = z.number().int()
```

```mutacao
arquivo: packages/shared/src/material/material.ts
teste: packages/shared/src/material/material.test.ts › a contagem negativa ou fracionária não passa
-const contagem = z.number().int().nonnegative()
+const contagem = z.number().nonnegative()
```

```mutacao
arquivo: packages/shared/src/material/material.ts
teste: packages/shared/src/material/material.test.ts › campo a mais, na linha ou na resposta
-export const linhaDoResumoDoMaterialSchema = z.strictObject({
+export const linhaDoResumoDoMaterialSchema = z.object({
```

```mutacao
arquivo: packages/shared/src/material/material.ts
teste: packages/shared/src/material/material.test.ts › campo a mais, na linha ou na resposta
-export const resumoDoMaterialResponseSchema = z.strictObject({
+export const resumoDoMaterialResponseSchema = z.object({
```

```mutacao
arquivo: packages/shared/src/material/material.ts
teste: packages/shared/src/material/material.test.ts › a disciplina e a série são ids
-  disciplinaId: z.uuid(),
-  serieId: z.uuid().nullable(),
+  disciplinaId: z.string(),
+  serieId: z.uuid().nullable(),
```

```mutacao
arquivo: packages/shared/src/material/material.ts
teste: packages/shared/src/material/material.test.ts › a linha de uma série e a sem série, de serieId nulo, passam, com o total dos sem série
-  serieId: z.uuid().nullable(),
+  serieId: z.uuid(),
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/material-resumo.int.test.ts › o resumo da A não leva material, recusa nem material sem série da B
-      .where(and(eq(material.escolaId, requireEscolaId()), isNull(material.excluidoEm)))
-      .groupBy(material.disciplinaId, materialSerie.serieId, material.estado)
+      .where(isNull(material.excluidoEm))
+      .groupBy(material.disciplinaId, materialSerie.serieId, material.estado)
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/material-resumo.int.test.ts › o material excluído não conta
-      .where(and(eq(material.escolaId, requireEscolaId()), isNull(material.excluidoEm)))
-      .groupBy(material.disciplinaId, materialSerie.serieId, material.estado)
+      .where(eq(material.escolaId, requireEscolaId()))
+      .groupBy(material.disciplinaId, materialSerie.serieId, material.estado)
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/material-resumo.int.test.ts › o material sem série conta em `semSerie`, na linha sem série da disciplina
-      .leftJoin(materialSerie, and(eq(materialSerie.escolaId, material.escolaId), eq(materialSerie.materialId, material.id)))
+      .innerJoin(materialSerie, and(eq(materialSerie.escolaId, material.escolaId), eq(materialSerie.materialId, material.id)))
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/material-resumo.int.test.ts › o material com duas séries conta nas duas
-      .leftJoin(materialSerie, and(eq(materialSerie.escolaId, material.escolaId), eq(materialSerie.materialId, material.id)))
+      .leftJoin(materialSerie, eq(materialSerie.escolaId, material.escolaId))
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-resumo.int.test.ts › cada estado conta na sua coluna
-      if (achada !== undefined) return achada
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-resumo.int.test.ts › o material com duas séries conta nas duas
-      const chave = `${disciplinaId}|${serieId ?? ''}`
+      const chave = disciplinaId
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-resumo.int.test.ts › o material sem série conta em `semSerie`, na linha sem série da disciplina
-      if (contado.serieId === null) semSerie += contado.total
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-resumo.int.test.ts › a recusa de 29 dias atrás conta e a de 31 não
falha: expect(linhaDe(depois, escola.quimica, escola.serieId)).toBeUndefined()
-    return (this.dependencias.relogio ?? systemClock).agora()
+    return systemClock.agora()
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-resumo.int.test.ts › a recusa de 29 dias atrás conta e a de 31 não
falha: expect(linhaDe(depois, escola.quimica, escola.serieId)).toBeUndefined()
-    const desde = new Date(this.#agora().getTime() - DIAS_DAS_RECUSAS_NO_RESUMO * 24 * 60 * 60_000)
+    const desde = new Date(this.#agora().getTime() - DIAS_DAS_RECUSAS_NO_RESUMO * 48 * 60 * 60_000)
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-resumo.int.test.ts › a recusa de 29 dias atrás conta e a de 31 não
-    const desde = new Date(this.#agora().getTime() - DIAS_DAS_RECUSAS_NO_RESUMO * 24 * 60 * 60_000)
+    const desde = new Date(this.#agora().getTime() + DIAS_DAS_RECUSAS_NO_RESUMO * 24 * 60 * 60_000)
```

```mutacao
arquivo: apps/api/src/material/material.controller.ts
teste: apps/api/test/material-resumo.int.test.ts › o professor e o aluno recebem o 404
-  @RequirePermissao('material', 'resumir')
+  @RequirePermissao('material', 'listar')
```

```mutacao
arquivo: packages/shared/src/permissao/matriz.ts
teste: packages/shared/src/permissao/matriz.test.ts
-  material: ['enviar', 'listar', 'ler', 'excluir', 'buscar', 'resumir'],
+  material: ['enviar', 'listar', 'ler', 'excluir', 'buscar'],
```

```mutacao
arquivo: packages/shared/src/permissao/matriz.ts
teste: packages/shared/src/permissao/matriz.test.ts
-    material: { enviar: 'nunca', listar: 'turma_vinculada', ler: 'turma_vinculada', excluir: 'nunca', buscar: 'turma_vinculada', resumir: 'nunca' },
+    material: { enviar: 'nunca', listar: 'turma_vinculada', ler: 'turma_vinculada', excluir: 'nunca', buscar: 'turma_vinculada', resumir: 'turma_vinculada' },
```

```mutacao
arquivo: packages/shared/src/permissao/matriz.ts
teste: packages/shared/src/permissao/matriz.test.ts
-    material: { enviar: 'unidade', listar: 'unidade', ler: 'unidade', excluir: 'unidade', buscar: 'unidade', resumir: 'unidade' },
+    material: { enviar: 'unidade', listar: 'unidade', ler: 'unidade', excluir: 'unidade', buscar: 'unidade', resumir: 'nunca' },
```

```mutacao
arquivo: packages/shared/src/permissao/matriz.ts
teste: packages/shared/src/permissao/matriz.test.ts
     indicador_professor: { ler_agregado: 'agregado', ler_nominal: 'nunca' },
-    material: { enviar: 'nunca', listar: 'nunca', ler: 'nunca', excluir: 'nunca', buscar: 'nunca', resumir: 'nunca' },
+    material: { enviar: 'nunca', listar: 'nunca', ler: 'nunca', excluir: 'nunca', buscar: 'nunca', resumir: 'unidade' },
```

```mutacao
arquivo: packages/shared/src/permissao/matriz.ts
teste: packages/shared/src/permissao/matriz.test.ts
     indicador_professor: { ler_agregado: 'nunca', ler_nominal: 'nunca' },
-    material: { enviar: 'nunca', listar: 'nunca', ler: 'nunca', excluir: 'nunca', buscar: 'nunca', resumir: 'nunca' },
+    material: { enviar: 'nunca', listar: 'nunca', ler: 'nunca', excluir: 'nunca', buscar: 'nunca', resumir: 'unidade' },
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/api/resumo.ts
teste: apps/web/src/areas/coordenacao/material/resumo-do-material.test.ts › a chave do resumo fica sob a de Material
-export const RESUMO_DO_MATERIAL_QUERY_KEY = [...MATERIAL_QUERY_KEY, 'resumo'] as const
+export const RESUMO_DO_MATERIAL_QUERY_KEY = ['resumo-do-material'] as const
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/resumo-do-material.ts
teste: apps/web/src/areas/coordenacao/material/resumo-do-material.test.ts › em ordem de disciplina, depois de série
-    .sort((a, b) => a.disciplina.localeCompare(b.disciplina, 'pt-BR') || a.posicao - b.posicao)
+    .sort((a, b) => a.disciplina.localeCompare(b.disciplina, 'pt-BR'))
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/resumo-do-material.ts
teste: apps/web/src/areas/coordenacao/material/resumo-do-material.test.ts › em ordem de disciplina, depois de série
-    .sort((a, b) => a.disciplina.localeCompare(b.disciplina, 'pt-BR') || a.posicao - b.posicao)
+    .sort((a, b) => a.posicao - b.posicao)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/resumo-do-material.ts
teste: apps/web/src/areas/coordenacao/material/resumo-do-material.test.ts › a série que a escola ainda não leu vem depois
-    return serie === undefined ? 1_000 : POSICAO_DA_ETAPA[serie.etapa] * 100 + serie.ano
+    return serie === undefined ? 0 : POSICAO_DA_ETAPA[serie.etapa] * 100 + serie.ano
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/resumo-do-material.ts
teste: apps/web/src/areas/coordenacao/material/resumo-do-material.test.ts › a série que a escola ainda não leu vem depois
-    .map((linha) => ({ linha, disciplina: nomeDaDisciplina.get(linha.disciplinaId) ?? 'Disciplina', posicao: linha.serieId === null ? 10_000 : posicaoDaSerie(linha) }))
+    .map((linha) => ({ linha, disciplina: nomeDaDisciplina.get(linha.disciplinaId) ?? 'Disciplina', posicao: linha.serieId === null ? 1_000 : posicaoDaSerie(linha) }))
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/resumo-do-material.ts
teste: apps/web/src/areas/coordenacao/material/resumo-do-material.test.ts › a disciplina ou a série que a escola ainda não leu
-    .map((linha) => ({ linha, disciplina: nomeDaDisciplina.get(linha.disciplinaId) ?? 'Disciplina', posicao: linha.serieId === null ? 10_000 : posicaoDaSerie(linha) }))
+    .map((linha) => ({ linha, disciplina: nomeDaDisciplina.get(linha.disciplinaId) ?? 'x', posicao: linha.serieId === null ? 10_000 : posicaoDaSerie(linha) }))
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/resumo-do-material.ts
teste: apps/web/src/areas/coordenacao/material/resumo-do-material.test.ts › em ordem de disciplina, depois de série
-        serie: linha.serieId === null ? NOME_DA_LINHA_SEM_SERIE : serie === undefined ? 'Série' : nomeDaSerie(serie),
+        serie: serie === undefined ? 'Série' : nomeDaSerie(serie),
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/resumo-do-material.ts
teste: apps/web/src/areas/coordenacao/material/resumo-do-material.test.ts › a disciplina ou a série que a escola ainda não leu
-        serie: linha.serieId === null ? NOME_DA_LINHA_SEM_SERIE : serie === undefined ? 'Série' : nomeDaSerie(serie),
+        serie: linha.serieId === null ? NOME_DA_LINHA_SEM_SERIE : serie === undefined ? 'x' : nomeDaSerie(serie),
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/resumo-do-material.ts
teste: apps/web/src/areas/coordenacao/material/resumo-do-material.test.ts › sem material sem série e sem lista lida, não há aviso
falha: toBeUndefined()
-  if (resumo.semSerie > 0) {
+  if (resumo.semSerie >= 0) {
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/resumo-do-material.ts
teste: apps/web/src/areas/coordenacao/material/resumo-do-material.test.ts › o material sem série vence o outro aviso
-    return `Séries atribuídas na migração: ${String(resumo.semSerie)} ${resumo.semSerie === 1 ? 'material está sem série e não aparece' : 'materiais estão sem série e não aparecem'} para nenhuma turma. Confira a série de cada um.`
+    return `Séries atribuídas na migração: ${String(resumo.semSerie)} ${resumo.semSerie === 1 ? 'material está sem série e não aparece' : 'material está sem série e não aparece'} para nenhuma turma. Confira a série de cada um.`
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/resumo-do-material.ts
teste: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.test.tsx › com um só material sem série
-    return `Séries atribuídas na migração: ${String(resumo.semSerie)} ${resumo.semSerie === 1 ? 'material está sem série e não aparece' : 'materiais estão sem série e não aparecem'} para nenhuma turma. Confira a série de cada um.`
+    return `Séries atribuídas na migração: ${String(resumo.semSerie)} ${resumo.semSerie === 1 ? 'materiais estão sem série e não aparecem' : 'materiais estão sem série e não aparecem'} para nenhuma turma. Confira a série de cada um.`
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/resumo-do-material.ts
teste: apps/web/src/areas/coordenacao/material/resumo-do-material.test.ts › material de todas as séries só avisa quando a escola tem mais de uma série
falha: toBeUndefined()
-  const comTodas = series.length > 1 && materiais?.some((material) => material.serieIds.length === series.length) === true
+  const comTodas = materiais?.some((material) => material.serieIds.length === series.length) === true
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/resumo-do-material.ts
teste: apps/web/src/areas/coordenacao/material/resumo-do-material.test.ts › material de todas as séries só avisa quando a escola tem mais de uma série
falha: toBeUndefined()
-  const comTodas = series.length > 1 && materiais?.some((material) => material.serieIds.length === series.length) === true
+  const comTodas = series.length > 1 && materiais?.some((material) => material.serieIds.length >= 1) === true
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/resumo-do-material.ts
teste: apps/web/src/areas/coordenacao/material/resumo-do-material.test.ts › sem material sem série e sem lista lida, não há aviso
falha: toBeUndefined()
-  return comTodas
+  return true
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.test.tsx › a releitura que falha, com o resumo já na tela
-        {tentando ? 'Tentando de novo…' : ''}
+        {''}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.test.tsx › a releitura que falha, com o resumo já na tela
-      {releituraFalhou && <ErroDoResumo erro={erro} tentando={tentando} aoTentarDeNovo={aoTentarDeNovo} />}
+      {false && <ErroDoResumo erro={erro} tentando={tentando} aoTentarDeNovo={aoTentarDeNovo} />}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.test.tsx › com material sem série
-      {aviso !== undefined && (
+      {false && (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.test.tsx › vazio: o convite a enviar o primeiro PDF
falha: expect(screen.queryByRole('note')).toBeNull()
-      {aviso !== undefined && (
+      {true && (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.test.tsx › vazio: o convite a enviar o primeiro PDF
falha: expect(screen.queryByRole('table')).toBeNull()
-      {resumo.linhas.length > 0 && <Table rotulo="Resumo do material por disciplina e série" colunas={COLUNAS} linhas={linhasDoResumo(resumo, disciplinas, series)} chaveDaLinha={(linha) => linha.chave} />}
+      {true && <Table rotulo="Resumo do material por disciplina e série" colunas={COLUNAS} linhas={linhasDoResumo(resumo, disciplinas, series)} chaveDaLinha={(linha) => linha.chave} />}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.test.tsx › com dado: a tabela por disciplina e série
-      {resumo.linhas.length > 0 && <Table rotulo="Resumo do material por disciplina e série" colunas={COLUNAS} linhas={linhasDoResumo(resumo, disciplinas, series)} chaveDaLinha={(linha) => linha.chave} />}
+      {false && <Table rotulo="Resumo do material por disciplina e série" colunas={COLUNAS} linhas={linhasDoResumo(resumo, disciplinas, series)} chaveDaLinha={(linha) => linha.chave} />}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.test.tsx › a releitura que falha com o resumo vazio na tela
falha: expect(screen.queryByText(VAZIO)).toBeNull()
-      {resumo.linhas.length === 0 && !releituraFalhou && (
+      {resumo.linhas.length === 0 && (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.test.tsx › com dado: a tabela por disciplina e série
falha: expect(screen.queryByText(VAZIO)).toBeNull()
-      {resumo.linhas.length === 0 && !releituraFalhou && (
+      {resumo.linhas.length >= 0 && !releituraFalhou && (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.test.tsx › a releitura que falha, com o resumo já na tela
-    tentando: leituras.some((leitura) => leitura.isFetching),
+    tentando: leituras.every((leitura) => leitura.isFetching),
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.test.tsx › carregando enquanto só /v1/series não chegou
-    pendente: leituras.some((leitura) => leitura.isPending),
+    pendente: leituras.every((leitura) => leitura.isPending),
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.test.tsx › erro enquanto só /v1/disciplinas falhou
-    erro: leituras.find((leitura) => leitura.isError)?.error,
+    erro: resumo.error,
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.test.tsx › carregando enquanto só /v1/materiais/resumo não chegou
-      {resumo.data !== undefined && disciplinas.data !== undefined && series.data !== undefined ? (
+      {disciplinas.data !== undefined && series.data !== undefined ? (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.test.tsx › carregando enquanto só /v1/disciplinas não chegou
-      {resumo.data !== undefined && disciplinas.data !== undefined && series.data !== undefined ? (
+      {resumo.data !== undefined && series.data !== undefined ? (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.test.tsx › carregando enquanto só /v1/series não chegou
-      {resumo.data !== undefined && disciplinas.data !== undefined && series.data !== undefined ? (
+      {resumo.data !== undefined && disciplinas.data !== undefined ? (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.test.tsx › carregando: o texto parado
-      ) : leitura.pendente ? (
+      ) : false ? (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Material.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx › com 30: 25 linhas
-              linhas={linhas.slice(0, visiveis)}
+              linhas={linhas}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Material.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx › com 30: 25 linhas
-    const agora = Math.min(visiveis + MATERIAIS_POR_VEZ, linhas.length)
+    const agora = visiveis + MATERIAIS_POR_VEZ
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Material.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx › com 30: 25 linhas
-    if (agora >= linhas.length) focarNaLista()
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Material.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx › com 60: cada clique revela 25 a mais
-    if (agora >= linhas.length) focarNaLista()
+    focarNaLista()
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Material.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx › até 25 materiais, todos à vista e sem o botão
falha: expect(screen.queryByRole('button', { name: 'Mostrar mais' })).toBeNull()
-            {linhas.length > visiveis && (
+            {linhas.length >= visiveis && (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Material.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx › com 30: 25 linhas
falha: expect(screen.queryByRole('button', { name: 'Mostrar mais' })).toBeNull()
-            {linhas.length > visiveis && (
+            {true && (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Material.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx › o envio recusado por licença lê o resumo de novo
-    void cliente.invalidateQueries({ queryKey: RESUMO_DO_MATERIAL_QUERY_KEY })
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Material.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx › o resumo vem antes da tabela de materiais
-      <ResumoDoMaterial materiais={lista?.itens} />
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Material.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx › o aviso das séries atribuídas na migração lê a lista
-      <ResumoDoMaterial materiais={lista?.itens} />
+      <ResumoDoMaterial materiais={undefined} />
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/api/resumo.ts
teste: apps/web/src/areas/coordenacao/material/resumo-do-material.test.ts › a consulta do resumo não tem laço próprio
-  queryKey: RESUMO_DO_MATERIAL_QUERY_KEY,
+  queryKey: RESUMO_DO_MATERIAL_QUERY_KEY,
+  refetchInterval: 1_500,
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/api/resumo.ts
teste: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.test.tsx › o resumo não se relê sozinho
-  queryKey: RESUMO_DO_MATERIAL_QUERY_KEY,
+  queryKey: RESUMO_DO_MATERIAL_QUERY_KEY,
+  refetchInterval: 1_500,
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.test.tsx › o resumo se relê quando a lista mostra que um estado mudou
-    if (mudou || atrasado) void cliente.invalidateQueries({ queryKey: RESUMO_DO_MATERIAL_QUERY_KEY })
+    if (atrasado) void cliente.invalidateQueries({ queryKey: RESUMO_DO_MATERIAL_QUERY_KEY })
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.test.tsx › o material que terminou entre a primeira leitura
-    if (mudou || atrasado) void cliente.invalidateQueries({ queryKey: RESUMO_DO_MATERIAL_QUERY_KEY })
+    if (mudou) void cliente.invalidateQueries({ queryKey: RESUMO_DO_MATERIAL_QUERY_KEY })
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.test.tsx › a primeira lista lida, em dia com o resumo, não o relê
-    const mudou = anterior.current !== undefined && anterior.current !== assinatura
+    const mudou = anterior.current !== assinatura
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.test.tsx › o resumo se relê quando a lista mostra que um estado mudou
-    anterior.current = assinatura
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.test.tsx › a primeira lista lida, em dia com o resumo, não o relê
-    if (materiais === undefined) return
-    const assinatura = assinaturaDosEstados(materiais)
+    const assinatura = assinaturaDosEstados(materiais ?? [])
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.test.tsx › o resumo que chega depois da lista, ainda contando
-  }, [materiais, resumoLido, cliente])
+  }, [materiais, cliente])
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.test.tsx › o resumo relido que ainda conta
falha: expect(doResumo(rede)).toBe(2)
-  useRelerOResumoQuandoUmEstadoMuda(materiais, leitura.resumo.data)
+  useRelerOResumoQuandoUmEstadoMuda(materiais, leitura.resumo.data && { ...leitura.resumo.data })
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/resumo-do-material.ts
teste: apps/web/src/areas/coordenacao/material/resumo-do-material.test.ts › a assinatura muda quando
-    .sort()
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/resumo-do-material.ts
teste: apps/web/src/areas/coordenacao/material/resumo-do-material.test.ts › a assinatura muda quando
-    .map((material) => `${material.id}:${material.estado}`)
+    .map((material) => `${material.id}`)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/resumo-do-material.ts
teste: apps/web/src/areas/coordenacao/material/resumo-do-material.test.ts › o resumo fica para trás quando
-  return resumo?.linhas.some((linha) => linha.processando > 0) === true && !materiais.some((material) => material.estado === 'processando')
+  return resumo?.linhas.some((linha) => linha.processando >= 0) === true && !materiais.some((material) => material.estado === 'processando')
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/resumo-do-material.ts
teste: apps/web/src/areas/coordenacao/material/resumo-do-material.test.ts › o resumo fica para trás quando
-  return resumo?.linhas.some((linha) => linha.processando > 0) === true && !materiais.some((material) => material.estado === 'processando')
+  return resumo?.linhas.some((linha) => linha.processando > 0) === true && materiais.some((material) => material.estado === 'processando')
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx › com as duas leituras caídas, são dois botões com nomes diferentes
-const TENTAR_DE_NOVO_O_RESUMO = 'Tentar de novo o resumo'
+const TENTAR_DE_NOVO_O_RESUMO = 'Tentar de novo'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx › com as duas leituras caídas, são dois botões com nomes diferentes
-      <Button variante="secundario" onClick={aoTentarDeNovo}>
+      <Button onClick={aoTentarDeNovo}>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.test.tsx › erro enquanto só /v1/disciplinas falhou
-      for (const leitura of leituras) void leitura.refetch({ cancelRefetch: false })
+      void resumo.refetch({ cancelRefetch: false })
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Material.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx › a troca de sessão volta às primeiras 25 linhas
-        definirVisiveis(MATERIAIS_POR_VEZ)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Material.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx › excluir um material lê o resumo de novo
-      <ResumoDoMaterial materiais={lista?.itens} />
+      <ResumoDoMaterial materiais={undefined} />
```

```mutacao
arquivo: packages/core/src/auditoria/auditoria.repository.ts
teste: apps/api/test/material-resumo.int.test.ts › só conta o registro cuja entidade é a disciplina
-        and a.entidade = 'disciplina'
```

```mutacao
arquivo: packages/core/src/auditoria/auditoria.repository.ts
teste: apps/api/test/material-resumo.int.test.ts › sem nenhum motivo a contar, a resposta é vazia
-    if (motivos.length === 0) return []
```

```mutacao
arquivo: packages/core/src/auditoria/auditoria.repository.ts
teste: apps/api/test/material-resumo.int.test.ts › o índice parcial da recusa serve à consulta que o resumo manda ao banco
-        and a.acao = 'material.recusado'
+        and a.acao like 'material.%'
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-resumo.int.test.ts › a soma é a de todos, e não um por linha
-      if (contado.serieId === null) semSerie += contado.total
+      if (contado.serieId === null) semSerie += 1
```

## Recomendações sem aplicar

Rodada 1 (Mesa; as linhas de destino `TODO.md` estão no `TODO.md`, seção "Da ingestao-do-material, tarefa 11.0"):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| infra-guardian (1ª) | A lista já se relê perto do teto antes desta tarefa: com mais de 200 materiais, 3 páginas a cada 1,5 s são 120 pedidos por minuto (`api/material.ts:29` e `:38`) | `TODO.md`, como correção própria: reler só o que está `processando` ou aumentar o intervalo, com o cenário de 300 materiais e um processando. Não é desta tarefa: o item 1 só impede que o resumo some ao problema |
| frontend-reviewer (1ª); revisor-geral (1ª) | Dois vazios empilhados na escola nova ("Ainda não há material para resumir…" e "Nenhum material ainda") | `cenarios.md` "Telas" e o teste de unidade da tela pedem o vazio do resumo como estado próprio (`cenarios.md:223`); esconder um deles muda o que a spec pede. `TODO.md`, para o Arquiteto decidir na retro |
| frontend-reviewer (1ª); revisor-geral (1ª) | O aviso das séries da migração (`resumo-do-material.ts:72`) abre com "migração", fala de "9º ano" e "6º", e não pode ser dispensado | O texto é o de `cenarios.md:224`, e o frontend-reviewer o deixa para a retro; é texto de tela, que a Mesa não dita. `TODO.md` (decisão do Arquiteto) |
| frontend-reviewer (1ª) | Os nomes "Disciplina" e "Série" soltos quando o id não está na lista (`resumo-do-material.ts:25` e `:48`) | `TODO.md`: texto de tela, caso raro (a disciplina ou a série lida depois do resumo) |
| revisor-geral (1ª) | O erro da releitura de disciplinas ou séries não aparece (`ResumoDoMaterial.tsx:111`, `releituraFalhou={resumo.isError}`) | `TODO.md`: o próprio revisor diz que o nome na tela continua certo e que não bloqueia; muda comportamento da tela |
| revisor-geral (1ª) | `ResumoDoMaterialRow` mistura português e inglês (`packages/shared/src/material/material.ts:192`) | Recusada: o sufixo `Row` é o padrão do `packages/shared` (`PreviaRow` em `estrutura/lista.ts:90`, `CompartilhamentoRow` em `privacidade/titular.ts:99`, `PreviaDaPlanilhaRow` em `importacao/contratos.ts:193`), e o próprio revisor ressalva "exceto se `*Row` já for o padrão" |
| test-engineer (1ª) | A releitura de `ResumoDoMaterial.test.tsx:227` espera o `refetchInterval` de 1,5 s pelo relógio de verdade | `TODO.md`: o próprio revisor diz que "hoje a folga é boa". O item 1 muda o ritmo desse caso, e é lá que o relógio falso se decide |
| privacy-guardian (1ª) | Um teste de contrato entre o formato gravado em `material.recusado` (`depois`) e o que `recusasDeMaterialDesde` lê | Recusada: `recusaSemLicenca` (`material-resumo.int.test.ts:69`) grava a recusa pelo envio de verdade (`enviarMaterial`, 422 `MATERIAL_SEM_LICENCA`) e o resumo a conta; mudar o formato quebra esses casos. O revisor não viu isso |
| conformidade-reviewer (1ª) | Semear materiais na escola cheia da vitrine, para a tela com dado ter foto | `TODO.md` (`tools/vitrine/escola.ts:216`, fora desta tarefa). O Validador fotografa cada requisito com tela no fim da spec: o Orquestrador precisa saber que, sem isso, só o vazio é fotografável |

Rodada 2 (Mesa; as linhas de destino `TODO.md` estão no `TODO.md`, seção "Da ingestao-do-material, tarefa 11.0"):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| privacy-guardian (1ª); Implementador (2ª), aceito pela Mesa | O caso de integração da rota do resumo com a sessão da rede | `TODO.md`: `apps/api/test/sessao.fixture.ts` só cria coordenador, professor e aluno; a permissão da rede segue provada pela matriz (`matriz.test.ts`). Voltar quando um caso de integração precisar de sessão da rede |
| revisor-geral (2ª) | O `useRef` da assinatura anterior (`useRelerOResumoQuandoUmEstadoMuda`) não é zerado em `aoTrocarDeSessao` | `TODO.md`: o próprio revisor diz que é inofensivo (o cache já foi esvaziado; só uma releitura a mais). Se o item 1 mudar esse efeito de modo que o ref passe a ter efeito, a Mesa volta a ver na rodada seguinte |
| revisor-geral (2ª); infra-guardian (2ª); test-engineer (2ª) | Esperas negativas pelo relógio de verdade em `ResumoDoMaterial.test.tsx` (100 ms, 1,8 s) | `TODO.md`: o test-engineer diz que "não dão falso vermelho", e a ausência do `refetchInterval` já está provada de forma determinística em `resumo-do-material.test.ts` |
| infra-guardian (2ª) | Priorizar no `TODO.md` a releitura da lista antes do piloto (escola com 201 a 300 materiais e um `processando` já está nos 120 por minuto só com a lista) | Já está no `TODO.md` (a linha da rodada 1), agora com "antes do piloto" |
| test-engineer (2ª) | O `dist` de `packages/shared` e `packages/core` mais velho que o código fez o `material-resumo.int.test.ts` dar 404 na rota na máquina dele | `TODO.md` (`tools/processo/`, o portão confirmar a build antes dos `.int.test.ts`; fora desta tarefa). O carimbo do portão desta árvore vale e rodou a integração |

Rodadas 3 e 4 (Mesa; a linha de destino `TODO.md` está no `TODO.md`, seção "Da ingestao-do-material, tarefa 11.0"):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| test-engineer (3ª e 4ª); infra-guardian (3ª); revisor-geral (4ª) | `resumoFicouParaTras` (`resumo-do-material.ts:83-85`) ignora `completa: false` da lista. Na escola acima do teto de `lerPaginas` (10 páginas de 100, `MAXIMO_DE_PAGINAS_DA_ESTRUTURA`, `apps/web/src/api/estrutura.ts:44`), o material `processando` fora das páginas faz cada mudança na lista pedir duas leituras do resumo, e não uma. E, se o servidor devolver um resumo diferente que ainda conta `processando` com a lista sem nenhum, a releitura se repete a cada resposta diferente | `TODO.md`, junto da linha da lista que se relê perto do teto: não comparar quando a lista veio incompleta. Não é laço (o caso "o resumo relido que ainda conta…" prova que um resumo relido igual para em duas leituras), é uma leitura a mais, e a escola com mais de 1000 materiais não é a do recorte |
| revisor-geral (3ª) | O comentário do efeito (`ResumoDoMaterial.tsx:100-104`) ficou longo e podia ser cortado à metade | Recusada: estilo; o texto explica a lista que chega antes e a referência estável, que é o motivo da dependência que o caso novo agora prova |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-14 01:27:57 | 2026-11-14 01:28:35 | `tenancy-guardian` | 1 | APROVADO | a768c1a7ea769bd68 |
| 2026-11-14 01:28:03 | 2026-11-14 01:28:48 | `frontend-reviewer` | 1 | APROVADO | a4b5c0bc911ebe428 |
| 2026-11-14 01:28:23 | 2026-11-14 01:28:54 | `conformidade-reviewer` | 1 | APROVADO | a4ab8f2832bf10819 |
| 2026-11-14 01:28:18 | 2026-11-14 01:29:13 | `privacy-guardian` | 1 | APROVADO | a76c4daafcf2134eb |
| 2026-11-14 01:28:13 | 2026-11-14 01:29:21 | `revisor-geral` | 1 | APROVADO | a4dc5d37390b7f21f |
| 2026-11-14 01:28:28 | 2026-11-14 01:30:19 | `infra-guardian` | 1 | REPROVADO | a260597907f10631e |
| 2026-11-14 01:28:08 | 2026-11-14 01:31:03 | `test-engineer` | 1 | APROVADO | a88fc314426f73ef4 |
| 2026-11-14 02:01:29 | 2026-11-14 02:01:54 | `tenancy-guardian` | 2 | APROVADO | a5c479c5e37bb1576 |
| 2026-11-14 02:01:37 | 2026-11-14 02:02:06 | `frontend-reviewer` | 2 | APROVADO | a2b6dca081b8fb1ab |
| 2026-11-14 02:02:01 | 2026-11-14 02:02:39 | `privacy-guardian` | 2 | APROVADO | a136f093299a4e8ed |
| 2026-11-14 02:02:08 | 2026-11-14 02:02:44 | `conformidade-reviewer` | 2 | APROVADO | acc44cd01c656f5d3 |
| 2026-11-14 02:01:53 | 2026-11-14 02:02:47 | `revisor-geral` | 2 | APROVADO | a8477b16c5c53f53a |
| 2026-11-14 02:02:17 | 2026-11-14 02:03:16 | `infra-guardian` | 2 | APROVADO | a342ac61ea296aed3 |
| 2026-11-14 02:01:46 | 2026-11-14 02:04:33 | `test-engineer` | 2 | REPROVADO | a891cbdddcf7db409 |
| 2026-11-14 02:23:42 | 2026-11-14 02:24:06 | `tenancy-guardian` | 3 | APROVADO | a3505276b00c95a3f |
| 2026-11-14 02:23:49 | 2026-11-14 02:24:18 | `frontend-reviewer` | 3 | APROVADO | ac83d30df0aa0a99c |
| 2026-11-14 02:24:12 | 2026-11-14 02:24:40 | `privacy-guardian` | 3 | APROVADO | a1861d08f3fe15513 |
| 2026-11-14 02:24:05 | 2026-11-14 02:24:45 | `revisor-geral` | 3 | APROVADO | aca1bbd08efa1cce3 |
| 2026-11-14 02:24:19 | 2026-11-14 02:24:49 | `conformidade-reviewer` | 3 | APROVADO | a5c10283932dc00f7 |
| 2026-11-14 02:24:26 | 2026-11-14 02:25:30 | `infra-guardian` | 3 | APROVADO | aea6548d9034de2a3 |
| 2026-11-14 02:23:58 | 2026-11-14 02:26:11 | `test-engineer` | 3 | REPROVADO | aa6ece38ad7bfbd6f |
| 2026-11-14 02:43:08 | 2026-11-14 02:43:28 | `revisor-geral` | 4 | APROVADO | ab5c99d923e1433e9 |
| 2026-11-14 02:43:00 | 2026-11-14 02:43:51 | `test-engineer` | 4 | APROVADO | a1ef28b16b18f5a84 |
