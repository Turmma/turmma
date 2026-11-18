# Tarefa 7.0 — A coordenação lê, corrige e manda reclassificar pela API, e a operação reclassifica uma escola (D76)

**Funcionalidade:** classificacao-bncc · **Depende de:** 6.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

O `GET /v1/materiais/:id` traz as seções com a situação e as habilidades; a coordenação corrige (a correção é final e
vence a IA) e pede a reclassificação; `GET /v1/habilidades-bncc` dá as candidatas; e a operação reclassifica uma escola,
com chamado.

## Contexto necessário

- `techspec.md` §4; §5 "Reclassificar", "Correção", "Suspensão"; §7; §7c "Estados da seção"
- `prd.md` RF6, RF12, RF20
- `cenarios.md` "Correção e reclassificação", "Permissão e isolamento", "Dado pessoal"; P1b, P2, P3, P5, P9
- `.claude/rules/`: 10, 20, 70 (item 6), 80 (item 1)
- Código: `apps/api/src/material/material.controller.ts` e `material.service.ts` (`exigirAtualizacaoDentroDosTetos`),
  `apps/api/src/ops/reprocessar-job.ts` (comando com chamado)

## Subtarefas

- [x] 7.1 — `secoes[]` e `classificacaoSuspensa` no `GET /:id` (§4), com a `situacao` da §7c; DTO sem `corrigida_por` nem `execucao_id`
- [x] 7.2 — `GET /v1/habilidades-bncc` (§4)
- [x] 7.3 — O `PUT` da correção (§5 "Correção", `material.classificacao_corrigida`); o `concluir` da 4.0 ganha o `for update` na seção (P1b)
- [x] 7.4 — `POST …/reclassificar` e o comando `reclassificar-escola` (§5 "Reclassificar", "Suspensão")
- [x] 7.5 — Os tetos (§4) e as ações no catálogo
- [x] 7.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/shared/src/material/material.ts`, `packages/shared/src/index.ts`, `apps/api/src/material/material.controller.ts`, `apps/api/src/material/material.service.ts`, `apps/api/src/material/material.repository.ts`, `apps/api/src/material/secoes.repository.ts`, `apps/api/src/material/classificar-secoes.command.ts`, `apps/api/src/material/material.module.ts`, `packages/core/src/auditoria/acoes.ts`, `packages/shared/src/permissao/matriz.ts`, `apps/api/test/contracts.test.ts`, `package.json` | alterado |
| `packages/shared/src/material/habilidades-bncc.ts`, `apps/api/src/material/habilidades-bncc.controller.ts`, `apps/api/src/ops/reclassificar-escola.ts`, `apps/api/src/ops/reclassificar-escola.test.ts`, `apps/api/test/classificacao-da-coordenacao.int.test.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| `GET`, uma seção em cada estado | I | as cinco `situacao`; `corrigida` vence |  `classificacao-da-coordenacao.int.test.ts` › "uma seção em cada estado…" |
| `GET` suspensa; contrato | I | `classificacaoSuspensa`; sem `corrigida_por` nem `execucao_id` |  `classificacao-da-coordenacao.int.test.ts` › "classificacaoSuspensa acompanha…" e `contracts.test.ts` › o das seções |
| reclassificar; D76 | I | não tocam a correção, um caso cada |  `classificacao-da-coordenacao.int.test.ts` › "a correção é final…" e "cria a execução e o job só das seções…" (a corrigida fica, com as falhas em 2) |
| correção, com 0 a 5 | I | final; `classificacao_corrigida` antes e depois, sem título |  `classificacao-da-coordenacao.int.test.ts` › "de zero a cinco códigos…" e "a correção de uma seção não toca a vizinha…" |
| coordenador eliminado | I | `corrigida` segue `true`; reclassificar mantém. Mutação: a marca em `corrigida_por` |  `classificacao-da-coordenacao.int.test.ts` › "o coordenador eliminado…" |
| `PUT`: 6; repetido; sufixo estadual; fora do recorte | I | `ENTRADA_INVALIDA`, um caso cada |  `classificacao-da-coordenacao.int.test.ts` › "seis códigos, código repetido, formato errado, sufixo estadual e código que a tabela não tem…" (um caso cada) |
| não `pronto`; sem componente; reclassificar suspenso | I | `CONFLITO`; `FUNCAO_SUSPENSA` |  `classificacao-da-coordenacao.int.test.ts` › "material que não está `pronto` e disciplina sem componente…" e "com a função suspensa: `FUNCAO_SUSPENSA`…" |
| `secaoId` de outro material; de material excluído | I | `NAO_ENCONTRADO` |  `classificacao-da-coordenacao.int.test.ts` › "`secaoId` de outro material, de material excluído, da escola B e inexistente…" (um caso cada) |
| `PUT /materiais/A/secoes/<da B>` | I | `NAO_ENCONTRADO`. Mutação: tirar `escola_id` |  `classificacao-da-coordenacao.int.test.ts` › o mesmo caso, na parte da escola B |
| código fora do recorte em material da B | I | `NAO_ENCONTRADO`, não `ENTRADA_INVALIDA` |  `classificacao-da-coordenacao.int.test.ts` › o mesmo caso, na parte do código fora do recorte em material da B |
| 301º e 901º `PUT`; 101º e 301º reclassificar | I | 429 com `Retry-After`; o do colega não conta |  `classificacao-da-coordenacao.int.test.ts` › "o 301º `PUT`…", "o 901º `PUT`…" (com o `Retry-After`) e "o 101º pedido de reclassificar…" (o 300º da escola passa, o 301º não) |
| reclassificar, storage vazio | I | texto dos `trecho`; quantas e preservadas; `material.reclassificado`; `daRotina` |  `classificacao-da-coordenacao.int.test.ts` › "cria a execução e o job só das seções não corrigidas…" (sem storage: o teste não semeia arquivo; o job leva só ids) |
| reclassificar; D76 | I | zeram `falhas_seguidas`. Mutação: sem zerar |  `classificacao-da-coordenacao.int.test.ts` › "cria a execução e o job só das seções…" e "reclassifica só a escola dada…" (`falhas_seguidas` 0) |
| D76 | I | sem chamado ou suspensa, recusado; `escola.reclassificada`, só a escola dada, sem texto; lotes de 500 até o sinal |  `classificacao-da-coordenacao.int.test.ts` › "o comando reclassificar-escola (D76)": "reclassifica só a escola dada…", "com a função suspensa na escola recusa…", "o comando de ponta a ponta…", "em lotes…"; `reclassificar-escola.test.ts` › "o comando recusa antes de abrir o banco…" |
| habilidades sem componente | I | `semComponente` |  `classificacao-da-coordenacao.int.test.ts` › "o material: as candidatas do componente e das séries dele…" |
| habilidades: `materialId` da B; sem vínculo; `artefatoId` da B; de colega | I | `NAO_ENCONTRADO` igual ao inexistente, um caso cada |  `classificacao-da-coordenacao.int.test.ts` › "`materialId` da B, material de disciplina sem vínculo, `artefatoId` da B e de colega…" (um caso cada, com o professor vinculado só a Física) |
| professor no `PUT` e no reclassificar; aluno no material e nas habilidades; rede | I | recusados, um caso cada |  `classificacao-da-coordenacao.int.test.ts` › "professor e aluno no `PUT` e no reclassificar…", "o professor da disciplina lê as seções…" e a matriz (`matriz.test.ts`) para a rede |
| `GET` e reclassificar, material da B | I | `NAO_ENCONTRADO`. Mutação: tirar `escola_id` |  `classificacao-da-coordenacao.int.test.ts` › "material da escola B e inexistente…" e a parte da B de "`secaoId` de outro material…" |
| P1b | P | a correção espera; o "antes" são os da IA. Mutação: tirar o `for update` do `concluir` |  `classificacao-da-coordenacao.int.test.ts` › "P1b, a correção × o `concluir`…" (gatilho `before` no `insert` da habilidade: só o `for update` da leitura segura a correção) |
| P2 | P | fica X. Mutação: tirar `execucao_id = :esta` |  `classificacao-da-coordenacao.int.test.ts` › "P2, o reclassificar troca o `execucao_id`…" |
| P3 | P | não cria para a `aguardando`. Mutação: tirar o filtro de `pendente` |  `classificacao-da-coordenacao.int.test.ts` › "P3, dois reclassificar com a ordem forçada…" (o primeiro para no `insert` da execução, o segundo espera a trava da seção) |
| P5 | P | duas auditorias em cadeia. Mutação: tirar o `for update` |  `classificacao-da-coordenacao.int.test.ts` › "P5, duas correções…" |
| P9, rotina × reclassificar | P | uma execução |  `classificacao-da-coordenacao.int.test.ts` › "P9, a rotina × o reclassificar…" |
| ordem das respostas: `ENTRADA_INVALIDA` antes de `CONFLITO` | I | no material `processando`, o código fora do recorte é 400 e o de dentro é 409. Mutação: o estado antes do recorte | `classificacao-da-coordenacao.int.test.ts` › "material que não está `pronto`…" |
| comando D76, a função suspensa entre dois lotes | I | `FUNCAO_SUSPENSA`; só o primeiro lote deixa execução e auditoria | `classificacao-da-coordenacao.int.test.ts` › "a função suspensa entre dois lotes…" |
| habilidades do artefato: duas turmas de séries diferentes, disciplina sem componente, professora em duas escolas | I | o recorte é o da turma e da disciplina do artefato; o artefato dela na B é `NAO_ENCONTRADO` com o token da A | `classificacao-da-coordenacao.int.test.ts` › "é o da turma e da disciplina do próprio artefato…" |
| catálogo: as três ações | U | sem título nem texto |  `packages/core/src/auditoria/acoes.test.ts` › o das três ações |

## Como testar

- `GET`: `apps/api/test/material.int.test.ts` › "o PDF com marcador termina `pronto` e devolve os capítulos em `GET /:id`…"
- Tetos: `material-patch.int.test.ts` › "a pessoa no teto recebe 429 com `Retry-After`…" e "a escola no teto segura quem ainda não passou do próprio…"
- Contrato: `contracts.test.ts` › "ingestao-do-material 4.0…"
- D76: `apps/api/src/ops/jobs-que-falharam.test.ts` › "%s: InvalidArgumentError citando só a opção"; `apps/api/test/ops-jobs.int.test.ts` › "um tipo aceito: a cópia failed sai…"
- `npx vitest run --project integracao apps/api/test/classificacao-da-coordenacao.int.test.ts`

## Autoconferência

1. **Mutação de cada cláusula.** Seção "Mutações": 80 blocos, cada um corrido antes do portão e vermelho em caso que rodou; o resto são termos de escopo repetido, com o motivo escrito e a remoção tentada contra as 89 provas de integração. O `--faltando` está em 0.
2. **Texto na tela.** A tarefa não tem tela (a 8.0 é a tela); o único texto de `apps/web/src` que muda é o mock do `PainelDoMaterial.test.tsx`, por causa do contrato novo (`secoes`, `classificacaoSuspensa`), sem texto de interface.
3. **Segundo dado que torna a cláusula observável.** `materialNovo(escola, { secoes: 2 })` na correção (a vizinha do mesmo material), na reclassificação (um segundo material da escola com seção não corrigida), e em `classificacao.int.test.ts` (a vizinha da mesma escola fora da execução); duas turmas de séries diferentes e uma disciplina sem componente no recorte do artefato. Duas escolas em toda a prova de isolamento.
4. **Checagem anterior que responde antes da regra.** Um caso chega a cada degrau da ordem da §4: objeto fora do alcance (`secaoId` de outro material, da B, inexistente, `materialId`/`artefatoId` da B e de colega) é `NAO_ENCONTRADO`; código fora do recorte é `ENTRADA_INVALIDA` (seis códigos, repetido, formato, sufixo estadual); material não `pronto` e disciplina sem componente são `CONFLITO`, e no material `processando` o código fora do recorte ainda é `ENTRADA_INVALIDA` (caso próprio: o recorte vem antes do estado); função suspensa é `FUNCAO_SUSPENSA`; e só depois os tetos de `LIMITE_EXCEDIDO` (301º e 901º `PUT`, 101º e 301º reclassificar, conferidos por guard antes do corpo, em caso próprio). O professor e o aluno recebem `NAO_ENCONTRADO` já na permissão (404, não 403).
5. **Asserção sobre resultado.** Todas olham o que a API devolve e o que o banco guarda (situação, habilidades, `execucao_id`, `falhas_seguidas`, auditoria sem título); nenhuma lê texto de arquivo. A ausência de execução é conferida por contagem no banco, depois de a resposta chegar.
6. **Guarda nova.** Não há guarda nova. O teste da lista fechada `CODIGOS_DA_BNCC` confere os 913 códigos contra `dados-2026.08.json` nos dois sentidos.
7. **Comentário que afirma o que o código não faz.** Os docblocks do `travarParaReclassificar`, do `gravarClassificacao` e do comando foram relidos contra o código final; o `docs/runbook.md` e o `docs/lgpd.md` citam só o comando, as ações e as variáveis que o `grep` achou na árvore.
8. **Divergência que cria regra.** As divergências desta tarefa estão na tabela abaixo, com o lugar da spec; nenhuma cria trava nova além das que a §5 já pedia (o `for update` na seção do `concluir` é o P1b da própria spec).
9. **Peça que já existe.** `AgendamentoDaClassificacaoRepository.agendar` (5.0) agenda; `autorDoComando` e `FORMATO_DO_CHAMADO` (`jobs-que-falharam.ts`) vêm do comando de operação existente; `AcessoDaEscolaRepository.nome()` confere a escola; `habilidadeEhCandidata` (3.0) decide a candidata; `situacaoDaSecao` mora no `shared` e os dois lados a usam.
10. **Corrida.** P1b (gatilho `before`, para a trava ser só a do `for update`), P2, P3 (o primeiro para no `insert` da execução), P5 e P9 com a ordem forçada por `WriteBlockTrigger` e `esperarNaTrava`, mais a suspensão entre dois lotes do comando; o P10b da 6.0 teve o padrão de espera atualizado para o `update` novo.
11. **Isolamento e coluna "Caso".** Todo id recebido nos casos de isolamento é da B, lido no contexto da A; cada linha da tabela de testes tem o caso na coluna (um para cada coisa que a linha diz).
12. **"O que verificar" dos guardiões.** `tenancy-guardian` (escopo no repository, `NAO_ENCONTRADO` igual, comando só na escola dada), `privacy-guardian` (auditoria só com id, enum e número; o DTO sem `corrigida_por` nem `execucao_id`; log só com `evento` e ids), `conformidade-reviewer` (a coordenação corrige e a IA nunca decide: a correção é final e auditada), `infra-guardian` (tetos contados na auditoria, lotes de 500 em transação, `statement_timeout`, `AbortSignal`) e `llm-integrator` (nenhuma chamada de modelo nova). O `achados/indice.md` foi lido: as linhas que tocam a trava da seção (P1b) e o padrão de espera (P10b) estão atendidas nos casos acima.

## Fora do escopo desta tarefa

A tela (8.0); a troca (11.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| Os códigos da BNCC viram uma lista fechada, `CODIGOS_DA_BNCC` (913 códigos, `packages/shared/src/bncc/codigos-da-bncc.ts`), e o pedido da correção e a consulta das candidatas usam `z.enum` e união estrita no lugar de regex | A auditoria só aceita id, enum, booleano, número ou data: um código como texto livre não entra no `depois`. O teste do `core` confere a lista contra `dados-2026.08.json` nos dois sentidos | `techspec.md` §3 ("Carga": a lista fechada e o que carga nova precisa), §4 ("PUT"), §7 (auditoria com os códigos como enum); `cenarios.md` ("Recusas": código de formato válido que a tabela não tem) |
| `gravarClassificacao` (4.0) passa a ler o material `for share`, travar as seções `for update` com `execucao_id = :esta and corrigida_em is null` e só então gravar; o padrão de espera da P10b em `recorte.int.test.ts` acompanha o `update` novo | É o P1b: a correção da coordenação espera a trava da seção e a gravação da IA não a sobrescreve; sem a trava, o "antes" da auditoria seria lido durante a gravação | `techspec.md` §5 ("Correção", P1b); `cenarios.md` (P1b, P1a) |
| `travarParaReclassificar` lê as seções com `for update ... of secao_do_material` e a execução delas em um segundo comando; `depoisDe` é obrigatório (`ANTES_DA_PRIMEIRA_SECAO`) | Trava só a seção (`of secao_do_material`) e lê a execução depois, em outro comando: com a execução na mesma consulta, a releitura do Postgres depois de esperar a trava da seção poderia devolver o estado antigo dela, e o comando decidiria `aguardando` ou não por um estado que já mudou. O cursor obrigatório evita o laço sem fim do comando por lote | `techspec.md` §5 ("Reclassificar", "Suspensão"); `cenarios.md` (P3, D76 em lotes) |
| O comando confere a escola e a função ativa em **todo** lote, não só no primeiro | A suspensão pode acontecer entre dois lotes de 500; o comando para com `FUNCAO_SUSPENSA` (exit 1) sem deixar execução criada depois dela | `techspec.md` §5 ("Suspensão"); `cenarios.md` (D76 com a função suspensa) |
| `corrigida` é `corrigida_em`, não `corrigida_por` | O coordenador eliminado deixa `corrigida_por` nulo, e a correção continua final; a marca é a data | `techspec.md` §4 (`situacao`); `cenarios.md` (coordenador eliminado) |
| Na correção (`PUT`), a disciplina sem componente responde `CONFLITO` antes de olhar os códigos; só com o componente se compara o código ao recorte, e então `ENTRADA_INVALIDA` vem antes do `CONFLITO` do material não `pronto` | Sem componente não há recorte para comparar; o resto da ordem é a da §4 | `techspec.md` §4 ("Ordem das respostas", a frase "Na correção"); `cenarios.md` ("Recusas") |
| O comando D76 não aplica o limite de execuções por noite da rotina (`EXECUCOES_POR_NOITE_DA_ESCOLA`); o runbook avisa e manda conferir o número de seções antes | É pedido da operação, por chamado, de uma escola; o freio de custo da rotina é de uma noite sem ninguém pedindo | `techspec.md` §5 ("Reclassificar"); `docs/runbook.md` ("Reprocessar ou descartar um job que falhou") |
| O mock do `PainelDoMaterial.test.tsx` ganha `SEM_CLASSIFICACAO` | O contrato do `GET /:id` ganhou `secoes` e `classificacaoSuspensa`; a tela que os usa é a 8.0 | `techspec.md` §4 (`GET /:id`); `7_task.md` (fora do escopo: a tela é a 8.0) |

## Mutações

`--faltando: 0 linhas (80 blocos, 31 motivos)`. Os blocos foram escritos a partir do código desta árvore e cada um foi corrido antes do portão (o vermelho vem de um caso que rodou, em teste que a tarefa criou ou alterou). O que fica sem bloco são termos que não mudam resultado nenhum, e para cada um a remoção foi tentada contra as suítes de integração da tarefa (`classificacao-da-coordenacao` e `classificacao`, 89 casos) e todas continuaram verdes; por isso são motivo, não bloco.

**Escopo repetido.** O repository aplica o `escolaId` do contexto em toda cláusula (regra 10, defesa em profundidade), mas a linha já foi achada e travada no escopo da escola um passo antes (`travarParaCorrigir`, `doMaterial`, a trava `for update` da seção) e o id é UUID único: retirar o termo não muda o que volta nem o que se grava, só o plano da consulta. O isolamento entre A e B é provado pelas cláusulas de leitura que antecedem estas (os casos de `NAO_ENCONTRADO` da escola B). Termos: `eq(secaoDoMaterial.escolaId, escolaId)`, `eq(habilidadeDaSecao.escolaId, escolaId)`, `eq(capituloDoMaterial.escolaId, secaoDoMaterial.escolaId)`, `eq(execucaoAgente.escolaId, secaoDoMaterial.escolaId)`, `eq(secaoDoMaterial.escolaId, requireEscolaId())`, `eq(habilidadeDaSecao.escolaId, requireEscolaId())`, `eq(secaoDoMaterial.escolaId, requireEscolaId())`, `eq(habilidadeDaSecao.escolaId, requireEscolaId())`, `eq(habilidadeDaSecao.escolaId, escolaId)`, `eq(secaoDoMaterial.escolaId, escolaId)`, `eq(secaoDoMaterial.escolaId, requireEscolaId())`, `eq(disciplina.escolaId, artefato.escolaId)`, `eq(material.escolaId, secaoDoMaterial.escolaId)`, `eq(disciplina.escolaId, material.escolaId)`, `eq(secaoDoMaterial.escolaId, escolaId)`, `eq(execucaoAgente.escolaId, escolaId)`, `eq(secaoDoMaterial.escolaId, escolaId)`, `eq(secaoDoMaterial.escolaId, escolaId)`.

**Id que só estreita.** A lista de ids já vem das seções travadas ou lidas no escopo, e a resposta é montada por mapa de `secaoId`; o termo repete o que a trava garante. Termos: `inArray(secaoDoMaterial.id, aGravar.map((resposta) => resposta.secaoId))`, `inArray(habilidadeDaSecao.secaoId, [...secaoIds])`, `inArray(secaoDoMaterial.id, ids)`, `inArray(execucaoAgente.id, this.tx.select({ id: secaoDoMaterial.execucaoId }).from(secaoDoMaterial).where(and(eq(secaoDoMaterial.escolaId, escolaId), inArray(secaoDoMaterial.id, ids))))`, `inArray(secaoDoMaterial.id, ids)`.

**Material no `doMaterial`.** A seção pedida já foi validada contra o material em `travarParaCorrigir` (caso de `secaoId` de outro material), então a linha `eq(secaoDoMaterial.materialId, materialId)` da leitura é a segunda conferência do mesmo fato: `eq(secaoDoMaterial.materialId, materialId)`.

**Junções do recorte do artefato.** As chaves da junção (`turma.id`, `serie.id`, `disciplina.id`) têm bloco: o caso tem duas turmas de séries diferentes e uma disciplina sem componente. O que sobra repete o `escolaId` e o ano do artefato, que a cláusula do dono (`criadoPor`) e o vínculo já prendem à escola (a chave estrangeira composta de `artefato` não deixa um artefato de uma escola apontar para turma ou disciplina de outra). Termos: `eq(turma.escolaId, artefato.escolaId)`, `eq(turma.anoLetivoId, artefato.anoLetivoId)`, `eq(serie.escolaId, turma.escolaId)`.

**Comando `ops:reclassificar-escola`.** `erro instanceof OperadorRejectedError` é a recusa do `autorDoComando` para um `OPERADOR` que tem formato válido mas não é operador ativo cadastrado; o teste do comando não cadastra operador inativo e o ramo é o mesmo `exit 2` dos outros dois, então o motivo é o mesmo da recusa de formato já provada. `erro instanceof DomainException` é só o estreitamento de tipo que o TypeScript exige para ler `erro.codigo`; os dois códigos (`NAO_ENCONTRADO` e `FUNCAO_SUSPENSA`) têm bloco. A guarda de entrada do arquivo (`process.argv[1] !== undefined`, `import.meta.url === pathToFileURL(process.argv[1]).href`) só decide se o módulo roda como programa ou é importado pelo teste: o teste importa, o `npm run` executa. Termos: `erro instanceof OperadorRejectedError`, `erro instanceof DomainException`, `process.argv[1] !== undefined`, `import.meta.url === pathToFileURL(process.argv[1]).href`.

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › a seção de capítulo traz
-capitulo: secao.capituloTitulo === null ? null : { numero: secao.capituloNumero, titulo: secao.capituloTitulo },
+capitulo: null,
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › de outro material, de material excluído
 const alvo = await new MaterialRepository(tx).porId(materialId, 'unidade')
-if (alvo === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
 const secoes = new SecoesRepository(tx)
 if ((await secoes.travarParaCorrigir(alvo.id, secaoId)) === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › de outro material, de material excluído
-if ((await secoes.travarParaCorrigir(alvo.id, secaoId)) === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › material que não está
-if (recorte.componente === null) throw new DomainException(ErrorCode.CONFLITO)
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › seis códigos, código repetido
-if (pedido.codigos.some((codigo) => !habilidadeEhCandidata(codigo, componente, recorte.series))) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
+if (pedido.codigos.some((codigo) => false)) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › material que não está
-if (alvo.estado !== 'pronto') throw new DomainException(ErrorCode.CONFLITO)
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › de zero a cinco códigos
 if (lida === undefined) throw new InvariantException('seção corrigida não lida')
-return paraSecaoResposta(lida, await secoes.habilidadesDasSecoes([secaoId]))
+return paraSecaoResposta(lida, [])
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › material da escola B e inexistente
 const alvo = await new MaterialRepository(tx).porId(materialId, 'unidade')
-if (alvo === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
 const secoes = new SecoesRepository(tx)
 const recorte = await secoes.recorteDoMaterial(alvo.id, alvo.disciplinaId)
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › material que não está
-if (alvo.estado !== 'pronto' || recorte.componente === null) throw new DomainException(ErrorCode.CONFLITO)
+if (recorte.componente === null) throw new DomainException(ErrorCode.CONFLITO)
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › material que não está
-if (alvo.estado !== 'pronto' || recorte.componente === null) throw new DomainException(ErrorCode.CONFLITO)
+if (alvo.estado !== 'pronto') throw new DomainException(ErrorCode.CONFLITO)
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › e nenhuma execução nasce
-if (!(await agendamento.funcaoEstaAtiva())) throw new DomainException(ErrorCode.FUNCAO_SUSPENSA)
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › cria a execução e o job só das seções
-if (lote.ultima === undefined) break
+break
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › o material: as candidatas
-if ('materialId' in consulta) {
+if ('artefatoId' in consulta) {
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › `materialId` da B
-if (lido === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
 recorte = await secoes.recorteDoMaterial(lido.id, lido.disciplinaId)
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › `materialId` da B
-if (recorte === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › o material: as candidatas
-if (recorte.componente === null) return habilidadesBnccResponseSchema.parse({ itens: [], semComponente: true })
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › o 301º
-if (feitas.doUsuario >= porUsuario || feitas.daEscola >= porEscola) {
+if (feitas.daEscola >= porEscola) {
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › o 901º
-if (feitas.doUsuario >= porUsuario || feitas.daEscola >= porEscola) {
+if (feitas.doUsuario >= porUsuario) {
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › o repository da A grava a resposta da própria seção e ignora
-return secao !== undefined && vivos.has(secao.materialId)
+return vivos.has(secao.materialId)
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › P4: o material excluído durante a chamada
-return secao !== undefined && vivos.has(secao.materialId)
+return secao !== undefined
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › P9: a seção que passou a outra execução
-.where(and(eq(secaoDoMaterial.escolaId, escolaId), inArray(secaoDoMaterial.id, aGravar.map((resposta) => resposta.secaoId)), eq(secaoDoMaterial.execucaoId, execucaoId), isNull(secaoDoMaterial.corrigidaEm)))
+.where(and(eq(secaoDoMaterial.escolaId, escolaId), inArray(secaoDoMaterial.id, aGravar.map((resposta) => resposta.secaoId)), isNull(secaoDoMaterial.corrigidaEm)))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › P1a: a seção que a coordenação corrige durante a chamada
-.where(and(eq(secaoDoMaterial.escolaId, escolaId), inArray(secaoDoMaterial.id, aGravar.map((resposta) => resposta.secaoId)), eq(secaoDoMaterial.execucaoId, execucaoId), isNull(secaoDoMaterial.corrigidaEm)))
+.where(and(eq(secaoDoMaterial.escolaId, escolaId), inArray(secaoDoMaterial.id, aGravar.map((resposta) => resposta.secaoId)), eq(secaoDoMaterial.execucaoId, execucaoId)))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › P1a: a seção que a coordenação corrige durante a chamada
-if (!minhas.has(resposta.secaoId)) continue
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › a gravação troca só as habilidades
-await this.banco.delete(habilidadeDaSecao).where(and(eq(habilidadeDaSecao.escolaId, escolaId), eq(habilidadeDaSecao.secaoId, resposta.secaoId), eq(habilidadeDaSecao.origem, 'ia')))
+await this.banco.delete(habilidadeDaSecao).where(and(eq(habilidadeDaSecao.escolaId, escolaId), eq(habilidadeDaSecao.origem, 'ia')))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › a gravação troca só as habilidades
-await this.banco.delete(habilidadeDaSecao).where(and(eq(habilidadeDaSecao.escolaId, escolaId), eq(habilidadeDaSecao.secaoId, resposta.secaoId), eq(habilidadeDaSecao.origem, 'ia')))
+await this.banco.delete(habilidadeDaSecao).where(and(eq(habilidadeDaSecao.escolaId, escolaId), eq(habilidadeDaSecao.secaoId, resposta.secaoId)))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › a seção sem código
-if (resposta.codigos.length > 0) {
+if (true) {
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › grava a resposta da própria seção
-and s.id = ${resposta.secaoId}
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › a seção de capítulo traz
-.leftJoin(capituloDoMaterial, and(eq(capituloDoMaterial.escolaId, secaoDoMaterial.escolaId), eq(capituloDoMaterial.id, secaoDoMaterial.capituloId)))
+.leftJoin(capituloDoMaterial, and(eq(capituloDoMaterial.escolaId, secaoDoMaterial.escolaId)))
 .leftJoin(execucaoAgente, and(eq(execucaoAgente.escolaId, secaoDoMaterial.escolaId), eq(execucaoAgente.id, secaoDoMaterial.execucaoId)))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › uma seção em cada estado
-.leftJoin(execucaoAgente, and(eq(execucaoAgente.escolaId, secaoDoMaterial.escolaId), eq(execucaoAgente.id, secaoDoMaterial.execucaoId)))
+.leftJoin(execucaoAgente, and(eq(execucaoAgente.escolaId, secaoDoMaterial.escolaId)))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › a correção de uma seção não toca a vizinha
-.where(and(eq(secaoDoMaterial.escolaId, requireEscolaId()), eq(secaoDoMaterial.materialId, materialId), secaoId === undefined ? undefined : eq(secaoDoMaterial.id, secaoId)))
+.where(and(eq(secaoDoMaterial.escolaId, requireEscolaId()), eq(secaoDoMaterial.materialId, materialId), undefined))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › de outro material, de material excluído
-.where(and(eq(secaoDoMaterial.escolaId, requireEscolaId()), eq(secaoDoMaterial.materialId, materialId), eq(secaoDoMaterial.id, secaoId)))
+.where(and(eq(secaoDoMaterial.escolaId, requireEscolaId()), eq(secaoDoMaterial.id, secaoId)))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › de outro material, de material excluído
-.where(and(eq(secaoDoMaterial.escolaId, requireEscolaId()), eq(secaoDoMaterial.materialId, materialId), eq(secaoDoMaterial.id, secaoId)))
+.where(and(eq(secaoDoMaterial.escolaId, requireEscolaId()), eq(secaoDoMaterial.materialId, materialId)))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › a correção de uma seção não toca a vizinha
-.where(and(eq(habilidadeDaSecao.escolaId, requireEscolaId()), eq(habilidadeDaSecao.secaoId, secaoId)))
+.where(and(eq(habilidadeDaSecao.escolaId, requireEscolaId())))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › a correção de uma seção não toca a vizinha
-await this.banco.delete(habilidadeDaSecao).where(and(eq(habilidadeDaSecao.escolaId, escolaId), eq(habilidadeDaSecao.secaoId, secaoId)))
+await this.banco.delete(habilidadeDaSecao).where(and(eq(habilidadeDaSecao.escolaId, escolaId)))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › de zero a cinco códigos
-if (codigos.length > 0) await this.banco.insert(habilidadeDaSecao).values(codigos.map((codigo) => ({ escolaId, secaoId, codigo, origem: 'coordenacao' as const })))
+if (true) await this.banco.insert(habilidadeDaSecao).values(codigos.map((codigo) => ({ escolaId, secaoId, codigo, origem: 'coordenacao' as const })))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › a correção de uma seção não toca a vizinha
-.where(and(eq(secaoDoMaterial.escolaId, escolaId), eq(secaoDoMaterial.id, secaoId)))
+.where(and(eq(secaoDoMaterial.escolaId, escolaId)))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › cria a execução e o job só das seções
-return this.banco.$count(secaoDoMaterial, and(eq(secaoDoMaterial.escolaId, requireEscolaId()), eq(secaoDoMaterial.materialId, materialId), isNotNull(secaoDoMaterial.corrigidaEm)))
+return this.banco.$count(secaoDoMaterial, and(eq(secaoDoMaterial.escolaId, requireEscolaId()), isNotNull(secaoDoMaterial.corrigidaEm)))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › cria a execução e o job só das seções
-return this.banco.$count(secaoDoMaterial, and(eq(secaoDoMaterial.escolaId, requireEscolaId()), eq(secaoDoMaterial.materialId, materialId), isNotNull(secaoDoMaterial.corrigidaEm)))
+return this.banco.$count(secaoDoMaterial, and(eq(secaoDoMaterial.escolaId, requireEscolaId()), eq(secaoDoMaterial.materialId, materialId)))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › o material: as candidatas
-return { componente: componentes.get(disciplinaId) ?? null, series: series.get(materialId) ?? [] }
+return { componente: componentes.get(disciplinaId) ?? null, series: series.get(materialId) }
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › `materialId` da B
 .where(
 and(
 eq(artefato.escolaId, escolaId),
 eq(artefato.anoLetivoId, requireAnoEmCurso()),
 eq(artefato.id, artefatoId),
-eq(artefato.criadoPor, requestSessao().usuarioId),
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › `materialId` da B
-comVinculoConfirmadoDoProfessor(this.banco, { escolaId: artefato.escolaId, anoLetivoId: artefato.anoLetivoId, turmaId: artefato.turmaId }, artefato.disciplinaId),
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › `materialId` da B
-return linha === undefined ? undefined : { componente: linha.componente, series: [{ etapa: linha.etapa, ano: linha.ano }] }
+return { componente: linha.componente, series: [{ etapa: linha.etapa, ano: linha.ano }] }
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › reclassifica só a escola dada
 .select({ id: secaoDoMaterial.id, materialId: secaoDoMaterial.materialId, componente: disciplina.componenteBncc })
 .from(secaoDoMaterial)
-.innerJoin(material, and(eq(material.escolaId, secaoDoMaterial.escolaId), eq(material.id, secaoDoMaterial.materialId)))
+.innerJoin(material, and(eq(material.escolaId, secaoDoMaterial.escolaId)))
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › reclassifica só a escola dada
 .select({ id: secaoDoMaterial.id, materialId: secaoDoMaterial.materialId, componente: disciplina.componenteBncc })
 .from(secaoDoMaterial)
 .innerJoin(material, and(eq(material.escolaId, secaoDoMaterial.escolaId), eq(material.id, secaoDoMaterial.materialId)))
-.innerJoin(disciplina, and(eq(disciplina.escolaId, material.escolaId), eq(disciplina.id, material.disciplinaId)))
+.innerJoin(disciplina, and(eq(disciplina.escolaId, material.escolaId)))
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › cria a execução e o job só das seções
 .where(
 and(
 eq(secaoDoMaterial.escolaId, escolaId),
-isNull(secaoDoMaterial.corrigidaEm),
 eq(material.estado, 'pronto'),
 isNull(material.excluidoEm),
 alvo.materialId === undefined ? undefined : eq(secaoDoMaterial.materialId, alvo.materialId),
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › reclassifica só a escola dada
 .where(
 and(
 eq(secaoDoMaterial.escolaId, escolaId),
 isNull(secaoDoMaterial.corrigidaEm),
-eq(material.estado, 'pronto'),
 isNull(material.excluidoEm),
 alvo.materialId === undefined ? undefined : eq(secaoDoMaterial.materialId, alvo.materialId),
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › cria a execução e o job só das seções
-alvo.materialId === undefined ? undefined : eq(secaoDoMaterial.materialId, alvo.materialId),
+undefined,
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › reclassifica só a escola dada
-alvo.materialId === undefined ? undefined : eq(secaoDoMaterial.materialId, alvo.materialId),
+eq(secaoDoMaterial.materialId, alvo.materialId),
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › P3, dois reclassificar
-if (lida?.estado === 'pendente') aguardando += 1
+if (false) aguardando += 1
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › reclassifica só a escola dada
-else if (travada.componente !== null) aReclassificar.push({ secaoId: travada.id, materialId: travada.materialId, execucaoLida: lida?.execucaoId ?? null, falhasSeguidas: 0, componente: travada.componente })
+else aReclassificar.push({ secaoId: travada.id, materialId: travada.materialId, execucaoLida: lida?.execucaoId ?? null, falhasSeguidas: 0, componente: travada.componente })
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › cria a execução e o job só das seções
-else if (travada.componente !== null) aReclassificar.push({ secaoId: travada.id, materialId: travada.materialId, execucaoLida: lida?.execucaoId ?? null, falhasSeguidas: 0, componente: travada.componente })
+else if (travada.componente !== null) aReclassificar.push({ secaoId: travada.id, materialId: travada.materialId, execucaoLida: lida?.execucaoId ?? 'sem-execucao', falhasSeguidas: 0, componente: travada.componente })
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › cria a execução e o job só das seções
-.where(and(eq(secaoDoMaterial.escolaId, escolaId), inArray(secaoDoMaterial.id, aReclassificar.map((agendada) => agendada.secaoId))))
+.where(and(eq(secaoDoMaterial.escolaId, escolaId), inArray(secaoDoMaterial.escolaId, [escolaId])))
```

```mutacao
arquivo: packages/shared/src/material/material.ts
teste: packages/shared/src/material/situacao-da-secao.test.ts › execução `concluida`
-const classificada = dela.habilidades > 0 ? 'classificada' : 'sem_habilidade'
+const classificada = 'classificada'
```

```mutacao
arquivo: packages/shared/src/material/material.ts
teste: packages/shared/src/material/situacao-da-secao.test.ts › a correção vence
-if (dela.corrigida) return classificada
```

```mutacao
arquivo: packages/shared/src/material/material.ts
teste: packages/shared/src/material/situacao-da-secao.test.ts › sem execução
-if (dela.estadoDaExecucao === null) return 'nao_agendada'
```

```mutacao
arquivo: packages/shared/src/material/material.ts
teste: packages/shared/src/material/situacao-da-secao.test.ts › execução `pendente` ou `rodando`
-if (dela.estadoDaExecucao === 'pendente' || dela.estadoDaExecucao === 'rodando') return 'aguardando'
+if (dela.estadoDaExecucao === 'rodando') return 'aguardando'
```

```mutacao
arquivo: packages/shared/src/material/material.ts
teste: packages/shared/src/material/situacao-da-secao.test.ts › execução `pendente` ou `rodando`
-if (dela.estadoDaExecucao === 'pendente' || dela.estadoDaExecucao === 'rodando') return 'aguardando'
+if (dela.estadoDaExecucao === 'pendente') return 'aguardando'
```

```mutacao
arquivo: packages/shared/src/material/material.ts
teste: packages/shared/src/material/situacao-da-secao.test.ts › execução `falhou`
-if (dela.estadoDaExecucao === 'falhou') return 'nao_classificada'
```

```mutacao
arquivo: apps/api/src/ops/jobs-que-falharam.ts
teste: apps/api/src/ops/reclassificar-escola.test.ts › InvalidArgumentError citando só a opção
-export const FORMATO_DO_CHAMADO = /^[1-9]\d{0,8}$/
+export const FORMATO_DO_CHAMADO = /^\d{0,9}$/
```

```mutacao
arquivo: apps/api/src/ops/reclassificar-escola.ts
teste: apps/api/src/ops/reclassificar-escola.test.ts › InvalidArgumentError citando só a opção
-if (!escola.success) throw new InvalidArgumentError('--escola')
```

```mutacao
arquivo: apps/api/src/ops/reclassificar-escola.ts
teste: apps/api/src/ops/reclassificar-escola.test.ts › InvalidArgumentError citando só a opção
-if (!FORMATO_DO_CHAMADO.test(String(valores.chamado))) throw new InvalidArgumentError('--chamado')
```

```mutacao
arquivo: apps/api/src/ops/reclassificar-escola.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › em lotes
-if (sinal.aborted) return { estado: 'sinal', lotes, execucoes, secoes }
```

```mutacao
arquivo: apps/api/src/ops/reclassificar-escola.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › o comando de ponta a ponta
-if ((await new AcessoDaEscolaRepository(tx).nome()) === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

```mutacao
arquivo: apps/api/src/ops/reclassificar-escola.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › com a função suspensa na escola recusa
-if (!(await agendamento.funcaoEstaAtiva())) throw new DomainException(ErrorCode.FUNCAO_SUSPENSA)
```

```mutacao
arquivo: apps/api/src/ops/reclassificar-escola.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › o comando de ponta a ponta
-if (travadas.ultima === undefined) return undefined
+if (travadas.ultima === undefined) throw new DomainException(ErrorCode.ERRO_INTERNO)
```

```mutacao
arquivo: apps/api/src/ops/reclassificar-escola.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › o comando de ponta a ponta
-if (feito === undefined) return { estado: 'fim', lotes, execucoes, secoes }
+if (feito === undefined) return { estado: 'sinal', lotes, execucoes, secoes }
```

```mutacao
arquivo: apps/api/src/ops/reclassificar-escola.ts
teste: apps/api/src/ops/reclassificar-escola.test.ts › o comando recusa antes de abrir o banco
-if (erro instanceof InvalidArgumentError || erro instanceof InvalidConfigError || erro instanceof OperadorRejectedError) {
+if (erro instanceof InvalidConfigError || erro instanceof OperadorRejectedError) {
```

```mutacao
arquivo: apps/api/src/ops/reclassificar-escola.ts
teste: apps/api/src/ops/reclassificar-escola.test.ts › o comando recusa antes de abrir o banco
-if (erro instanceof InvalidArgumentError || erro instanceof InvalidConfigError || erro instanceof OperadorRejectedError) {
+if (erro instanceof InvalidArgumentError || erro instanceof OperadorRejectedError) {
```

```mutacao
arquivo: apps/api/src/ops/reclassificar-escola.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › o comando de ponta a ponta
-if (erro instanceof DomainException && (erro.codigo === ErrorCode.NAO_ENCONTRADO || erro.codigo === ErrorCode.FUNCAO_SUSPENSA)) {
+if (erro instanceof DomainException && (erro.codigo === ErrorCode.FUNCAO_SUSPENSA)) {
```

```mutacao
arquivo: apps/api/src/ops/reclassificar-escola.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › o comando de ponta a ponta
-if (erro instanceof DomainException && (erro.codigo === ErrorCode.NAO_ENCONTRADO || erro.codigo === ErrorCode.FUNCAO_SUSPENSA)) {
+if (erro instanceof DomainException && (erro.codigo === ErrorCode.NAO_ENCONTRADO)) {
```

```mutacao
arquivo: apps/api/src/ops/reclassificar-escola.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › o comando de ponta a ponta
-if (erro instanceof DomainException && (erro.codigo === ErrorCode.NAO_ENCONTRADO || erro.codigo === ErrorCode.FUNCAO_SUSPENSA)) {
+if (erro instanceof DomainException && false) {
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › P1b
 .orderBy(asc(secaoDoMaterial.id))
-.for('update')
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › P5
 .where(and(eq(secaoDoMaterial.escolaId, requireEscolaId()), eq(secaoDoMaterial.materialId, materialId), eq(secaoDoMaterial.id, secaoId)))
-.for('update')
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › cria a execução e o job só das seções
 .update(secaoDoMaterial)
-.set({ falhasSeguidas: 0 })
+.set({ falhasSeguidas: secaoDoMaterial.falhasSeguidas })
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › o coordenador eliminado
 estadoDaExecucao: execucaoAgente.estado,
-corrigidaEm: secaoDoMaterial.corrigidaEm,
+corrigidaEm: secaoDoMaterial.corrigidaPor,
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › P3, dois reclassificar
 gt(secaoDoMaterial.id, depoisDe),
 ),
 )
 .orderBy(asc(secaoDoMaterial.id))
 .limit(limite)
-.for('update', { of: secaoDoMaterial })
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › material que não está `pronto`
 const { componente } = recorte
-if (pedido.codigos.some((codigo) => !habilidadeEhCandidata(codigo, componente, recorte.series))) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
-if (alvo.estado !== 'pronto') throw new DomainException(ErrorCode.CONFLITO)
+if (alvo.estado !== 'pronto') throw new DomainException(ErrorCode.CONFLITO)
+if (pedido.codigos.some((codigo) => !habilidadeEhCandidata(codigo, componente, recorte.series))) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › é o da turma e da disciplina do próprio artefato
-.innerJoin(turma, and(eq(turma.escolaId, artefato.escolaId), eq(turma.anoLetivoId, artefato.anoLetivoId), eq(turma.id, artefato.turmaId)))
+.innerJoin(turma, and(eq(turma.escolaId, artefato.escolaId), eq(turma.anoLetivoId, artefato.anoLetivoId)))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › é o da turma e da disciplina do próprio artefato
-.innerJoin(serie, and(eq(serie.escolaId, turma.escolaId), eq(serie.id, turma.serieId)))
+.innerJoin(serie, and(eq(serie.escolaId, turma.escolaId)))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/test/classificacao-da-coordenacao.int.test.ts › é o da turma e da disciplina do próprio artefato
-.innerJoin(disciplina, and(eq(disciplina.escolaId, artefato.escolaId), eq(disciplina.id, artefato.disciplinaId)))
+.innerJoin(disciplina, and(eq(disciplina.escolaId, artefato.escolaId)))
```


## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisor-geral (1ª) | O comando refaz o tratamento de erro que já existe (`terminarComErro`) | `TODO.md`: trocar pelo `terminarComErro` pode mudar a mensagem que o operador lê (`FUNCAO_SUSPENSA` não está em `MENSAGEM_DO_OPERADOR`), e o contrato do comando já está provado pelos testes |
| revisor-geral (1ª) | A suspensão é conferida de dois jeitos (`estaSuspensa` no `GET`, `funcaoEstaAtiva` no reclassificar e no comando) | `TODO.md`: o `GET` lê pelo banco e o reclassificar dentro da transação com a trava; juntar os dois muda a camada de uma das leituras |
| revisor-geral (1ª) | Rodar o D76 numa escola sem seção a tratar não deixa rastro na auditoria | `TODO.md`: gravar `escola.reclassificada` com contagem zero muda o comportamento e o contrato da ação no catálogo (`docs/lgpd.md`); decisão do Arquiteto |
| test-engineer (1ª) | Lote de 500 (`SECOES_POR_LOTE_DO_AGENDAMENTO`) e `set_config('statement_timeout')` sem prova | `TODO.md`: o lote de 2 já prova o laço; ler o `statement_timeout` dentro do lote pede um gancho no comando |
| test-engineer (1ª) | Comando rodado duas vezes em paralelo | Recusada: o comando é da operação, por chamado, e o P9 já prova uma só execução entre a rotina e o reclassificar |
| test-engineer (1ª), tenancy-guardian (1ª), privacy-guardian (1ª) | Artefato de outro ano letivo; operador inativo no comando | `TODO.md` (já constam no documento como recomendação) |
| infra-guardian (1ª) | Índice `(escola_id, acao, em)` ou parcial para o teto contado na auditoria | `TODO.md`: o padrão é o do `PATCH`; revisar quando a auditoria crescer |
| infra-guardian (1ª) | `GET /v1/materiais/:id` devolve `secoes[]` sem paginação | `TODO.md`: o tamanho tem limite pelo PDF (blocos de 30 páginas); revisar se o limite de páginas do upload aumentar |
| conformidade-reviewer (1ª) | As habilidades `origem: 'ia'` da classificação anterior somem na reclassificação, sem histórico | A decisão já está na `techspec.md` §8 ("Sem histórico do que foi descartado"); fica para o Validador e para o dossiê (D61) |
| conformidade-reviewer (1ª) | Justificativa opcional na correção, em lista fechada | Recusada: não é exigida (a classificação não chega ao aluno), muda o contrato do `PUT` e a AIA; fica para a AIA de diagnóstico por habilidade |
| conformidade-reviewer (1ª) | A tela deve mostrar `origem` com o rótulo de IA e explicar que a correção é final | Tarefa 8.0 (a tela) |
| privacy-guardian (1ª) | O `parse(antes)` da correção dá erro interno se a seção tiver código fora da lista | Atendida pelo item 1: a spec passa a dizer o que a carga nova precisa fazer |
| revisor-geral (2ª) | A frase da spec sobre carga nova ("apontar o teste para o JSON da nova versão") e o `codigos[]` do `PUT` da §4 sem "da lista fechada (§3)" | `TODO.md`: texto de spec, sem mudar código |
| revisor-geral (2ª) | `expect(vigente).toBeDefined()` em `codigos-da-bncc.test.ts` | `TODO.md`: só importa com a pasta sem `dados-*.json`, o que a tabela pública não permite |
| revisor-geral, tenancy-guardian e test-engineer (2ª) | O termo `eq(artefato.escolaId, …)` não é isolado pelo caso da professora com conta nas duas escolas (quem barra é o `criadoPor`) | `TODO.md`: listá-lo entre os motivos do "Escopo repetido" |
| test-engineer (2ª) | Mutação que prove a conferência da função em todo lote do comando | `TODO.md`: o caso da suspensão entre dois lotes prova o efeito |
| test-engineer (2ª) | P1b, P3 e P5: mensagem legível quando o `esperarNaTrava` estoura | `TODO.md`: diagnóstico do teste, não cobertura |
| conformidade-reviewer (2ª) | Na 8.0, conferir nas fotos o rótulo de IA e que a coordenação não recebe a opção de `artefatoId` | Tarefa 8.0 (a tela) |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-18 12:26:38 | 2026-11-18 12:27:20 | `tenancy-guardian` | 2 | APROVADO | aa3bdda8d5682c418 |
| 2026-11-18 12:27:03 | 2026-11-18 12:27:28 | `conformidade-reviewer` | 2 | APROVADO | acb85803e2e461821 |
| 2026-11-18 12:26:18 | 2026-11-18 12:27:31 | `revisor-geral` | 2 | APROVADO | a527f9f417ec53d19 |
| 2026-11-18 12:26:55 | 2026-11-18 12:27:32 | `infra-guardian` | 2 | APROVADO | a673b9d48f4789e85 |
| 2026-11-18 12:26:46 | 2026-11-18 12:27:32 | `privacy-guardian` | 2 | APROVADO | a1f8f8e268d80ebe4 |
| 2026-11-18 12:26:29 | 2026-11-18 12:29:12 | `test-engineer` | 2 | APROVADO | ab04f9674ac367c5b |
