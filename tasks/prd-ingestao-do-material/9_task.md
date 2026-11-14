# Tarefa 9.0 — Toda leitura de página filtra por série e licença vigente; sem material, ninguém gera

**Funcionalidade:** ingestao-do-material · **Depende de:** 8.0
**Subagentes obrigatórios:** `tenancy-guardian`, `conformidade-reviewer`, `infra-guardian`, `frontend-reviewer`
**Porte:** grande

## Objetivo

Toda leitura de página só alcança material `pronto` da série da turma, próprio ou de licença vigente hoje; sem nenhum,
ferramenta e chat recusam antes do `202`, e o Tutor depois da D36, com um estado na tela do aluno.

## Contexto necessário

- `techspec.md` §5 "Leitura de página", §6, §7b, §7c, §9 (Tutor do aluno), §11 (RF8)
- `prd.md` RF7, RF8, RF15, RF17
- `cenarios.md` "Leitura de página por série", "Licença", "Telas", "Carga"
- `.claude/rules/` 10, 30, 40, 70 (itens 3 e 4), 80
- Código: `apps/api/src/material/trecho-search.ts` (`buscar`, l.55); `apps/api/src/material/material.repository.ts`
  (`paginasDoMaterial`, l.286); `apps/api/src/tutor/tutor.service.ts` (l.251, e a conferência depois do `202`, l.206);
  `apps/api/src/tutor/tutor.repository.ts` (`materialDaTurma`, l.189); `apps/web/src/areas/aluno/tutor.ts` (`pausaDoErro`, l.86)

## Subtarefas

- [x] 9.1 — Série e "hoje" (`Clock`, São Paulo) em `buscar`, `paginasDoMaterial`, `materialDaTurma` e `GET /v1/materiais/busca` (`serieId` filtra, não autoriza); `existeMaterialDaSerie` igual
- [x] 9.2 — `SEM_MATERIAL_DA_SERIE` na ferramenta e no chat antes do `202`, sem execução nem orçamento
- [x] 9.3 — Tutor: a D36 intacta (`materialId` nulo) e só depois o filtro e a série; a conferência depois do `202` com o mesmo filtro (R6); página fora do alcance com o código do `enviar` (R6); recusas por turma, sem aluno (R6)
- [x] 9.4 — O estado do aluno do `cenarios.md`, pelo `pausaDoErro`
- [x] 9.5 — Carga: `npm run carga:ingestao` e `:controle-negativo`, com a corrida registrada
- [x] 9.6 — `docs/interface.md`, `docs/runbook.md`; testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/src/material/trecho-search.ts`, `apps/api/src/material/material.repository.ts`, `apps/api/src/material/material.service.ts`, `apps/api/src/material/material.controller.ts`, `apps/api/src/tutor/tutor.service.ts`, `apps/api/src/tutor/tutor.repository.ts`, `apps/api/src/artefato/ferramentas.service.ts`, `apps/api/src/assistente/assistente.service.ts`, `packages/shared/src/material/material.ts`, `apps/web/src/areas/aluno/tutor.ts`, `apps/web/src/areas/aluno/tutor.test.ts`, `apps/web/src/areas/aluno/Tutor.tsx`, `e2e/aluno-tutor.spec.ts`, `apps/api/src/tutor/tutor.int.test.ts`, `package.json`, `docs/interface.md`, `docs/runbook.md` | alterado |
| `infra/scripts/carga-ingestao.ts`, `infra/scripts/conferir-carga-ingestao.ts`, `apps/api/test/leitura-por-serie.int.test.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| só do 6º, turma do 9º, por chamador | I | nada citado: atividade, plano, chat, turno, página aberta, `materialDaTurma`, `GET /busca` | `leitura-por-serie.int.test.ts`: "material só do 2º ano, turma do 9º" (4 casos: ferramenta e chat; porta e página aberta; Tutor e `materialDaTurma`; rota de busca). A adaptação não lê trechos: não há leitura a filtrar (divergência 1) ; e "com material de Química do 2º e do 9º na mesma escola…" (a mesma palavra nos dois: atividade, plano, chat e Tutor do 9º citam só o `materialId` do 9º, o Tutor também sem página aberta; o chat do 2º, só o do 2º) |
| 23h do último dia; 0h01 do seguinte | I | volta; não volta | `leitura-por-serie.int.test.ts`: "às 23h do último dia o material de licença volta em toda leitura; às 0h01 do seguinte não volta…" |
| licença futura | I | fora até o dia | `leitura-por-serie.int.test.ts`: "a licença que só começa amanhã deixa o material fora até o dia" |
| `PATCH` que estende | I | volta, também na página aberta | `leitura-por-serie.int.test.ts`: o mesmo caso das 23h, depois do `PATCH /v1/licencas/:id` com `vigenteAte` 2027-12-31 (`paginaAberta`, `existe`, `achada`, `emUso` e `naTelaDoAluno`) |
| único vencido ou `processando` | I | `SEM_MATERIAL_DA_SERIE`, sem chamar o adaptador, sem execução nem consumo | `leitura-por-serie.int.test.ts`: "sem material da série, ninguém gera" (`it.each`: licença vencida, `processando`, substituído), com `vi.spyOn(FakeAdapter.prototype, 'chamar')`, a busca não chamada e as quatro contagens iguais; mais "a licença vigente de outro material da escola não autoriza o de licença vencida" |
| D36: sem material; edição substituída; licença vencida | I | mensagem fixa e `atencao_humana`. Mutação: filtro antes da D36 | `leitura-por-serie.int.test.ts`: "o Tutor: a D36 vem antes do filtro…" › "assunto delicado com $caso" (3 casos). Mutação: o bloco de `const daTurma = await this.#doMaterial(…)` |
| os três com pergunta comum | I | recusada, nada em `mensagem_tutor`, no uso nem na sala | `leitura-por-serie.int.test.ts`: "a pergunta comum com $caso é recusada, e nada fica em mensagem_tutor, no uso nem na execução" (3 casos; o uso é `GET /v1/tutor/uso`, e a "sala" é o painel de uso da turma) |
| [P] material sai entre o `202` e a conferência | P | recusado (R6) | `leitura-por-serie.int.test.ts`: "[P] a licença vence entre o 202 e a conferência…" e "[P] o único material da série sai entre o 202 e a conferência…" (`WriteBlockTrigger` na transição `rodando`) |
| página fora do alcance | I | o código do `enviar` (R6) | `leitura-por-serie.int.test.ts`: o `404 NAO_ENCONTRADO` do aluno do 9º com o material do 2º, da edição substituída e do material de licença vencida; no segundo e no terceiro, a mesma resposta do `materialId` que não existe |
| recusas por turma | I | contadas sem aluno (R6) | `leitura-por-serie.int.test.ts`: "as recusas por falta de material são contadas por turma, sem aluno nem escola" (`MedidorDeTeste.pontos('tutor.recusa_sem_material')`, o único rótulo é `turma_id`) |
| modo livre | I | aceito | `leitura-por-serie.int.test.ts`: "modo livre, sem atividade nem material: o turno é aceito…" |
| virada do ano | I | o 9º de 2027 acha o do 9º; o que passou do 8º só acha o do 9º | `leitura-por-serie.int.test.ts`: "a turma do 9º de 2027 acha o material declarado do 9º em 2026; o aluno que passou do 8º para o 9º só acha o do 9º" |
| `serieId` de outra turma | I | não abre material | `leitura-por-serie.int.test.ts`: "a rota de busca com serieId devolve só o material da série…": a professora de Física, com a série do material, não o acha, e a coordenação com a série do 9º, também não; "a lista de materiais com serieId…" (`GET /v1/materiais`); "a turma que a professora não alcança responde como inexistente…" (ferramenta e chat, `NAO_ENCONTRADO` sem gasto) |
| isolamento | I | busca e página aberta da A com série da B: vazias | `leitura-por-serie.int.test.ts`: "a busca e a página aberta da escola A com a série da escola B voltam vazias…" (o controle: a mesma série, na B, acha o material) ; "os dois helpers do filtro carregam o corte por escola…" (cada fragmento sozinho, no contexto da A, sobre o material da B; o controle na B casa), e a busca e o `existeMaterialDaSerie` com a disciplina **e** a série da B no contexto da A |
| estado do aluno | U | texto, sem avatar | `apps/web/src/areas/aluno/tutor.test.ts`: "sem material da turma, o estado diz o que fazer…", `pausaDoErro`/`falhaDaPergunta`, `recusaVencida`, e a lista de avisos sem grito |
| estado do aluno | E | a tela; `paginaNaoRola` | `e2e/aluno-tutor.spec.ts`: "sem material da turma: o estado diz "Avise seu professor"…" (chromebook e celular; texto, sem avatar nem código, caixa usável) e "…o estado cabe na tela sem rolar de lado e não tem violação séria de acessibilidade" (`horizontalOverflow` 0; `seriousViolations` vazio) |
| [C] carga | C | abaixo | `npm run carga:ingestao` e `:controle-negativo` (seção "A corrida da carga", abaixo) |

Critérios da [C]: 300 PDFs do maior tamanho pela rota real, com o guard, por três coordenadores, com a B no Tutor no pico;
as 300 projetadas entre 19h e 5h com uma réplica; p95 do turno da B até 500 ms acima da base; nenhum statement acima de
1,5 s; o PDF da B espera até duas extrações; `VAGAS_POR_ESCOLA_DESLIGADAS` reprova. O "Caso" leva a corrida
(`docs/runbook.md`, "Quando a carga vale como registro").

## Como testar

- Chamador: `apps/api/test/material.int.test.ts` › "`BuscaDeTrechos`, a porta do Assistente e do Tutor…" (l.421)
- D36: `apps/api/src/tutor/tutor.int.test.ts` › "recebe a mensagem fixa na hora…"
- Sem modelo: `apps/api/src/assistente/assistente.int.test.ts` › "suspensão por função (D60)", com o `FakeAdapter`
- Relógio: `RelogioDeslocavel` (`apps/api/test/convites-enviar.int.test.ts:44`)
- Aluno: `apps/web/src/areas/aluno/tutor.test.ts` › "a recusa do servidor (409 ou 429) vira o aviso…"
- Carga: `infra/scripts/carga-importacao.ts`
- Comando: `npx vitest run --project integracao apps/api/test/leitura-por-serie.int.test.ts`
- **Telas:** `aluno`, `/aluno` › a atividade da turma sem material (o estado)

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano. Na 1: cada termo do
filtro, nas quatro cópias.

1. **Mutação de cada cláusula.** O filtro é **uma cópia só** (`declaradoParaASerie` e `proprioOuComLicencaVigente`, exportadas de `material.repository.ts`), e as cinco leituras o
   usam: `buscar`, `paginasDoMaterial`, `existeMaterialDaSerie`, `materialDaTurma` do Tutor e a rota. Cada termo tem o bloco dele: os dois de `declaradoParaASerie`, os
   cinco de `proprioOuComLicencaVigente` (o `ne`, o `licencaId`, o `lte`, o `isNull` e o `gte`), a série e a licença em `buscar`, em `paginasDoMaterial`, em `existeMaterialDaSerie` e
   em `materialDaTurma`, o `hoje` de cada chamador, a ordem da D36, a recusa, o contador, a conferência depois do `202`, a checagem antes do `202` na ferramenta e no chat, e as três
   do estado na web. As que não têm bloco estão em "Mutações", com o motivo.
2. **O texto novo já aparece na tela?** "Ainda não há material da sua turma aqui. Avise seu professor." é novo (`grep -rn "Avise seu professor" e2e/ apps/web/src` só acha o caso novo e
   `tutor.ts`). Rodei isolados `aluno-tutor`, `aluno-fluxo`, `casca` e `professor-semana-itens`: 80 verdes.
3. **O segundo dado.** Série: material do 2º e turma do 9º na mesma escola (e o do 9º, que só aparece nos casos de licença e de próprio); licença: a vencida e uma vigente que não é do
   material (o termo `licencaId`); disciplina: Física, sem material em série nenhuma; escola: a B com a série da A.
4. **Checagem anterior que responde antes?** O Tutor: a D36 e o `jaAceita` vêm antes do filtro, e os casos sem material são os da D36 e os da recusa, cada um chegando à linha dele (o `422`
   do 9º, o `404` da página). A ferramenta: `turmaComDisciplina` antes de `existeMaterialDaSerie`; o caso da Física (turma do 2º, disciplina sem vínculo) é `NAO_ENCONTRADO`, antes da recusa.
5. **A asserção olha o resultado?** Os casos comparam o que o usuário obtém: o código da resposta, os materiais achados, as contagens de `execucao_agente`, `consumo_ia`,
   `mensagem_agente` e `mensagem_tutor`, e o adaptador **não chamado** (`vi.spyOn`), depois da resposta que o chamaria.
6. **Guarda nova?** Nenhuma regra de lint, teste estrutural nem trava de pasta.
7. **Comentário que afirma o que o código não faz?** Releitura dos docblocks novos: `declaradoParaASerie` e `proprioOuComLicencaVigente` dizem o que as cinco leituras fazem; o do
   `TrechoSearch` diz que ela **não** confere quem pede (o `materialDaTurma` é que confere o aluno).
8. **Divergência que muda regra?** Quatro, na tabela abaixo; cada uma com o trecho da spec que a diz e o caso da tabela de testes que a prova. O `grep` de "NAO_ENCONTRADO" e de
   "recusa" na spec, antes dos revisores, está na terceira coluna.
9. **Qual peça já existe?** O `diaDeUso` e o `Clock` da licença (`relogioDasLicencas`, da 5.0), o `MedidorDeTeste`, o `WriteBlockTrigger`, `montarEscolaComAssistente`, `aplicarAtividade` e a carga da
   justiça (`semearTutorDaB`, `lerTurnoDaBNaJanela`, `prepararMedicaoDeStatements`, `lerStatements`). Nada copiado: `criarEscolasDoCenario` ganhou `export`.
10. **Operação simultânea e ordem forçada.** O `[P]` é a ordem forçada: `WriteBlockTrigger` na transição `rodando` da execução do aluno, a mudança entre o `202` e a conferência, e a
    soltura; nenhum `Promise.all` solto. O relógio dos casos de licença é o `relogio` injetado, nunca o de parede.
11. **Isolamento e coluna "Caso".** O caso de isolamento usa a série e o material da **B** lidos no contexto da A (`doMaterial`, `buscar`, `existeMaterialDaSerie` e a rota), com o controle
    positivo na B. Cada linha da tabela tem o caso (e as de duas coisas, dois: ferramenta e chat; busca e página).
12. **Guardiões.** `tenancy-guardian` (o escopo da escola nos três repositories, a série de outra escola, o `404` igual); `conformidade-reviewer` (D36 antes do filtro, nada de fala do Tutor no
    estado, contagem por turma sem aluno: D64/D66); `infra-guardian` (o filtro por `escola_id, serie_id, material_id` no índice da 4.0, a carga); `frontend-reviewer` (o estado: texto, ícone, sem
    avatar, `role="status"`, 360 px). `achados/indice.md`: nenhuma linha anterior toca a série na leitura.

## Fora do escopo desta tarefa

Habilidade BNCC na busca (F4b).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| A adaptação não lê material e fica **fora** da recusa antes do `202`: a tabela de testes e o `cenarios.md` a listavam junto de atividade e plano, e a 9.0 não a recusa | A adaptação da atividade (`ArtefatoService.adaptar`, `POST /v1/artefatos/:id/adaptar`) não passa pelo `FerramentasService.gerar`, que só atende `atividade_objetiva` e `plano_de_aula` (`TAREFA_DA_FERRAMENTA`): ela parte do artefato que a professora já tem, não chama `TrechoSearch.buscar` e não cita material, e por isso fica fora da recusa por `SEM_MATERIAL_DA_SERIE` (a adaptação de necessidade específica de uma atividade pronta não pode parar porque a licença venceu depois). Decisão escrita na `techspec.md` §5 ("Como ficou na 9.0") e no `cenarios.md`, que antes listava a adaptação na recusa | `techspec.md` §5 "Leitura de página" e "Como ficou na 9.0"; `cenarios.md` "Leitura de página por série", 1º item |
| A página aberta fora do alcance (outra série, edição substituída, licença vencida) responde `NAO_ENCONTRADO` | A subtarefa 9.3 pede "o código do `enviar`", e o `enviar` responde `NAO_ENCONTRADO` para o material que a turma não alcança (regra 10, item 6): o filtro novo entra em `materialDaTurma`, que já devolvia `undefined` para o inexistente | `techspec.md` §5 "Leitura de página" ("a página aberta fora do alcance responde como o inexistente") e R6; `cenarios.md` "Leitura de página por série", 3º item |
| "Próprio" é `titularidade <> 'terceiro_com_licenca'`, sem exigir licença | A spec diz "próprio **ou** de licença vigente". O material da escola não tem licença registrada; o de terceiro só vale pela licença (D5). O de terceiro sem `licenca_id` (o que o código anterior à F4 gravou depois da volta) não é lido | `techspec.md` §5 "Leitura de página" ("próprio **ou** de licença com `vigente_desde <= hoje`…"); `cenarios.md` "Licença" |
| Os tetos de envio sobem de 30 por pessoa, 60 por escola e 3 em processamento para **100, 300 e 300** (`ENVIOS_POR_USUARIO_NA_JANELA`, `ENVIOS_POR_ESCOLA_NA_JANELA`, `MATERIAIS_EM_PROCESSAMENTO_POR_ESCOLA`) | A spec (§7c) diz 100, 300 e 300 desde a 1ª rodada da 1.0, e o código seguiu em 30, 60 e 3 (`1_task.md` e `7_task.md`: "dar dono aos tetos", sem dono no `tasks.md`). A [C] da 9.0 manda 300 PDFs pela rota real, com o guard, por três coordenadores: na primeira corrida só 14 passaram e 286 voltaram `429`. O teste da corrida do teto de processamento semeia 299 e dispara cinco envios (sobra uma vaga: `[201, 429, 429, 429, 429]`), em vez de cinco contra três | `techspec.md` §7c, linha "Limite por escola" (100 por hora por pessoa, 300 por escola, 300 pendentes por escola); `cenarios.md` "Carga" |
| As recusas por turma são o contador OTel `tutor.recusa_sem_material`, com o rótulo `turma_id` e nenhum outro (fora de `METRICS_WITH_ESCOLA`), e o `TutorModule` passou a dinâmico (`forRoot({ medidor })`) para o teste ler o contador | A spec diz "contadas por turma, sem aluno" sem dizer onde. Métrica por turma é o que o runbook já usa para o resto do Tutor, e a escola não entra no rótulo porque a turma já a identifica; sem `forRoot`, o teste lia a métrica global | `techspec.md` §5 "Leitura de página" ("recusas por turma, sem aluno") e §7c "Métrica e alerta"; `cenarios.md` "Leitura de página por série" |
| O fixture `trocasJaFeitas` (`apps/api/test/escola-tutor.fixture.ts`) grava o `id` das mensagens com `uuidv7(<mesmo deslocamento do criada_em>)`, e o `painel` de Fundação ganhou o gráfico de `tutor_recusa_sem_material_total` com a seção "Turma sem material da série" no runbook | Fora do que a tabela de arquivos previa. O caso "a professora vê quem usou…" do `tutor.int.test.ts` falhou em 2 de 3 rodadas: a consulta da última troca ordena por `id`, e a mensagem de dois dias atrás tinha `id` v7 de agora (0,8 s à frente do relógio no log), então vencia a de hoje. O `id` precisa seguir o `criada_em`, como a regra 40 já avisa. O painel é o `infra/test/painel.test.ts` ("toda métrica do código tem painel"), e o runbook é a regra 80, item 10 | Regra 40 ("o id, que é v7, segue o instante da criação"); regra 80, item 10; Tech Spec §7c |
| **Intermitentes que não são desta tarefa:** `tutor.int.test.ts` › "com os sinais suspensos…" e "assunto pessoal delicado… suspensão" (`suspensao_de_funcao_retomada_depois`), e › "o aluno transferido depois do 202…" (a execução ainda `pendente` quando o teste lê) | O primeiro é o relógio do banco recuando entre a suspensão e a retomada (o helper `retomar` chamava `now()` duas vezes): o helper dos três testes que o portão desta tarefa roda (`tutor`, `artefato` e `assistente`) passou a gravar `greatest(now(), suspensa_em)`, e os outros arquivos com o mesmo helper ficam como estavam. O segundo é o `executor.ociosa()` voltando antes de a execução terminar, com o host em load de 5 a 7 por causa dos outros andares (cerca de 1 rodada em 8 do arquivo inteiro). Nenhum toca arquivo da tarefa; ficam para uma correção própria | `apps/api/src/tutor/tutor.int.test.ts` (os três casos) |

## Mutações

--faltando: ver o fim desta seção (a linha que sobra tem motivo)

Um bloco por cláusula do que a tarefa acrescenta, na ordem dos arquivos: o filtro da série e o da licença (a cópia única e os quatro lugares que a usam), o `hoje` de cada chamador, a ordem da D36 no
Tutor, a recusa, o contador, a conferência depois do `202`, a checagem antes do `202` na ferramenta e no chat, a série da turma devolvida pelos dois repositories, e as três cláusulas do estado
na web.

Cláusulas sem bloco, e por quê:

- `eq(materialSerie.escolaId, requireEscolaId())` de `declaradoParaASerie` e `eq(licencaDeMaterial.escolaId, requireEscolaId())` de `proprioOuComLicencaVigente` **têm bloco**: o caso "os dois helpers do
  filtro carregam o corte por escola" chama cada fragmento sozinho, no contexto da A, sem o escopo da consulta de fora, sobre o material da B (e o controle na B). Os dois cortes repetem o da tabela
  principal de quem chama (defesa em profundidade, dito nos docblocks), e é por isso que o teste os chama fora das consultas dos chamadores.
- `eq(material.escolaId, requireEscolaId())` de `existeMaterialDaSerie`: o `disciplinaId` que chega é da escola do contexto (vem de `turmaComDisciplina`, escopada), e a disciplina de outra escola não
  casa com material desta; a cláusula repete o corte de `declaradoParaASerie` (que tem bloco): tirar só esta, o outro segura, e nenhum teste fica vermelho de um jeito honesto. O caso de isolamento prova o resultado (`existeMaterialDaSerie` da série e da disciplina da B, lida na A, é falso).
- `.limit(1)` de `existeMaterialDaSerie`: custo, não resultado.
- `material?.disciplinaId` de `atividade?.disciplinaId ?? material?.disciplinaId` no `#doMaterial`: quando só há `materialId`, `materialDaTurma` já exigiu o material pronto, declarado para a série e
  vigente, e portanto `existeMaterialDaSerie` da disciplina dele nunca é falso.
- `arquivo`/`return base` do `#doMaterial` quando não há material: o `...(material === undefined ? {} : { material })` tem o seu bloco (`return base`), provado por `tutor.int.test.ts`.
- `ICONE_DA_PAUSA.sem_material` (`Tutor.tsx`): ícone decorativo, `aria-hidden`; o teste do estado prova o texto, o `role` e a ausência de avatar.
- Os três `.where(` de várias linhas (`proprioOuComLicencaVigente`, `existeMaterialDaSerie` e `materialDaTurma`) e o `const onde` e o `const disciplinaId = atividade?.disciplinaId ?? material?.disciplinaId`
  do Tutor: o `--faltando` só vê a linha do `.where(` ou do `const`, e as cláusulas de dentro (cada termo de cada `and(`) têm os blocos delas; o `onde` e os `?? null` são do código de antes, movido
  de lugar pela divisão do `#alcance`, e é o `tutor.int.test.ts` que prova a referência gravada.
- Os blocos da linha `if (daTurma === undefined)` (ferramenta e chat) guardam o `NAO_ENCONTRADO` que já existia, só reescrito para guardar `daTurma`.

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-      .where(and(eq(materialSerie.escolaId, requireEscolaId()), eq(materialSerie.materialId, material.id), eq(materialSerie.serieId, serieId))),
+      .where(and(eq(materialSerie.escolaId, requireEscolaId()), eq(materialSerie.serieId, serieId))),
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-      .where(and(eq(materialSerie.escolaId, requireEscolaId()), eq(materialSerie.materialId, material.id), eq(materialSerie.serieId, serieId))),
+      .where(and(eq(materialSerie.escolaId, requireEscolaId()), eq(materialSerie.materialId, material.id))),
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-    ne(material.titularidade, 'terceiro_com_licenca'),
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-            eq(licencaDeMaterial.id, material.licencaId),
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-            lte(licencaDeMaterial.vigenteDesde, hoje),
+            gt(licencaDeMaterial.vigenteDesde, hoje),
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-            or(isNull(licencaDeMaterial.vigenteAte), gte(licencaDeMaterial.vigenteAte, hoje)),
+gte(licencaDeMaterial.vigenteAte, hoje),
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-            or(isNull(licencaDeMaterial.vigenteAte), gte(licencaDeMaterial.vigenteAte, hoje)),
+            or(isNull(licencaDeMaterial.vigenteAte), gt(licencaDeMaterial.vigenteAte, hoje)),
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-          serieId === undefined ? undefined : this.#comASerie(serieId),
           pagina === undefined ? undefined : gt(material.id, pagina),
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-          serieId === undefined ? undefined : this.#comASerie(serieId),
           proprioOuComLicencaVigente(this.banco, hoje),
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
           serieId === undefined ? undefined : this.#comASerie(serieId),
-          proprioOuComLicencaVigente(this.banco, hoje),
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
           isNull(material.excluidoEm),
-          this.#comASerie(serieId),
           proprioOuComLicencaVigente(this.banco, hoje),
           this.#noAlcance(alcance),
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
           isNull(material.excluidoEm),
           this.#comASerie(serieId),
-          proprioOuComLicencaVigente(this.banco, hoje),
           this.#noAlcance(alcance),
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-          eq(material.disciplinaId, disciplinaId),
           eq(material.estado, 'pronto'),
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
           eq(material.disciplinaId, disciplinaId),
-          eq(material.estado, 'pronto'),
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
           eq(material.disciplinaId, disciplinaId),
           eq(material.estado, 'pronto'),
-          isNull(material.excluidoEm),
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-          this.#comASerie(serieId),
           proprioOuComLicencaVigente(this.banco, hoje),
         ),
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-          proprioOuComLicencaVigente(this.banco, hoje),
         ),
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-    return achado !== undefined
+return true
```

```mutacao
arquivo: apps/api/src/material/trecho-search.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-    return diaDeUso(this.relogio.agora())
+return diaDeUso(new Date())
```

```mutacao
arquivo: apps/api/src/material/trecho-search.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-    return new MaterialRepository(this.banco).existeMaterialDaSerie(serieId.toLowerCase(), disciplinaId.toLowerCase(), this.hoje())
+    return new MaterialRepository(this.banco).existeMaterialDaSerie(serieId.toLowerCase(), disciplinaId.toLowerCase(), '1900-01-01')
```

```mutacao
arquivo: apps/api/src/material/trecho-search.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-      { texto: busca, disciplinaId: disciplinaId.toLowerCase(), serieId: serieId.toLowerCase(), hoje: this.hoje(), materialId: materialId?.toLowerCase(), limite: Math.min(Math.max(1, limite), MAXIMO_DE_TRECHOS_PARA_IA), palavras: 'qualquer' },
+      { texto: busca, disciplinaId: disciplinaId.toLowerCase(), hoje: this.hoje(), materialId: materialId?.toLowerCase(), limite: Math.min(Math.max(1, limite), MAXIMO_DE_TRECHOS_PARA_IA), palavras: 'qualquer' },
```

```mutacao
arquivo: apps/api/src/material/trecho-search.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-      { texto: busca, disciplinaId: disciplinaId.toLowerCase(), serieId: serieId.toLowerCase(), hoje: this.hoje(), materialId: materialId?.toLowerCase(), limite: Math.min(Math.max(1, limite), MAXIMO_DE_TRECHOS_PARA_IA), palavras: 'qualquer' },
+      { texto: busca, disciplinaId: disciplinaId.toLowerCase(), serieId: serieId.toLowerCase(), hoje: '1900-01-01', materialId: materialId?.toLowerCase(), limite: Math.min(Math.max(1, limite), MAXIMO_DE_TRECHOS_PARA_IA), palavras: 'qualquer' },
```

```mutacao
arquivo: apps/api/src/material/trecho-search.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-    const paginas = await new MaterialRepository(this.banco).paginasDoMaterial(materialId.toLowerCase(), disciplinaId.toLowerCase(), serieId.toLowerCase(), this.hoje(), Math.max(1, limite), 'unidade')
+    const paginas = await new MaterialRepository(this.banco).paginasDoMaterial(materialId.toLowerCase(), disciplinaId.toLowerCase(), serieId.toLowerCase(), '1900-01-01', Math.max(1, limite), 'unidade')
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-      { texto: consulta.q, disciplinaId: consulta.disciplinaId?.toLowerCase(), serieId: consulta.serieId?.toLowerCase(), hoje: this.#hoje(), limite: consulta.limite, palavras: 'todas' },
+      { texto: consulta.q, disciplinaId: consulta.disciplinaId?.toLowerCase(), hoje: this.#hoje(), limite: consulta.limite, palavras: 'todas' },
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-      { texto: consulta.q, disciplinaId: consulta.disciplinaId?.toLowerCase(), serieId: consulta.serieId?.toLowerCase(), hoje: this.#hoje(), limite: consulta.limite, palavras: 'todas' },
+      { texto: consulta.q, disciplinaId: consulta.disciplinaId?.toLowerCase(), serieId: consulta.serieId?.toLowerCase(), hoje: '1900-01-01', limite: consulta.limite, palavras: 'todas' },
```

```mutacao
arquivo: apps/api/src/tutor/tutor.service.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-    const daTurma = await this.#alcance(pedido)
+const daTurma = await this.#doMaterial(await this.#alcance(pedido), pedido)
```

```mutacao
arquivo: apps/api/src/tutor/tutor.service.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-    const alcance = await this.#doMaterial(daTurma, pedido)
+const alcance = daTurma
```

```mutacao
arquivo: apps/api/src/tutor/tutor.service.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-    const material = pedido.materialId === undefined ? undefined : ((await tutor.materialDaTurma(turma.turmaId, turma.serieId, this.trechos.hoje(), pedido.materialId.toLowerCase())) ?? naoEncontrado())
+    const material = pedido.materialId === undefined ? undefined : ((await tutor.materialDaTurma(turma.turmaId, turma.turmaId, this.trechos.hoje(), pedido.materialId.toLowerCase())) ?? naoEncontrado())
```

```mutacao
arquivo: apps/api/src/tutor/tutor.service.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-    const material = pedido.materialId === undefined ? undefined : ((await tutor.materialDaTurma(turma.turmaId, turma.serieId, this.trechos.hoje(), pedido.materialId.toLowerCase())) ?? naoEncontrado())
+    const material = pedido.materialId === undefined ? undefined : ((await tutor.materialDaTurma(turma.turmaId, turma.serieId, '1900-01-01', pedido.materialId.toLowerCase())) ?? naoEncontrado())
```

```mutacao
arquivo: apps/api/src/tutor/tutor.service.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-    if (disciplinaId !== undefined && !(await this.trechos.existeMaterialDaSerie({ serieId: turma.serieId, disciplinaId }))) {
+    if (disciplinaId !== undefined && (await this.trechos.existeMaterialDaSerie({ serieId: turma.serieId, disciplinaId }))) {
```

```mutacao
arquivo: apps/api/src/tutor/tutor.service.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-    if (disciplinaId !== undefined && !(await this.trechos.existeMaterialDaSerie({ serieId: turma.serieId, disciplinaId }))) {
+    if (!(await this.trechos.existeMaterialDaSerie({ serieId: turma.serieId, disciplinaId }))) {
```

```mutacao
arquivo: apps/api/src/tutor/tutor.service.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-      this.#recusasSemMaterial.add(1, { turma_id: turma.turmaId })
```

```mutacao
arquivo: apps/api/src/tutor/tutor.service.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-      throw new DomainException(ErrorCode.SEM_MATERIAL_DA_SERIE)
+throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

```mutacao
arquivo: apps/api/src/tutor/tutor.service.ts
teste: apps/api/src/tutor/tutor.int.test.ts
-    return { ...base, ...(material === undefined ? {} : { material }) }
+return base
```

```mutacao
arquivo: apps/api/src/tutor/tutor.service.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-        const agora = await this.#doMaterial(await this.#alcance(pedidoGravado), pedidoGravado)
+const agora = await this.#alcance(pedidoGravado)
```

```mutacao
arquivo: apps/api/src/tutor/tutor.service.ts
teste: apps/api/test/leitura-por-serie.int.test.ts › com material de Química do 2º e do 9º na mesma escola
-      serieId: alcance.turma.serieId,
```

```mutacao
arquivo: apps/api/src/tutor/tutor.service.ts
teste: apps/api/test/leitura-por-serie.int.test.ts › com material de Química do 2º e do 9º na mesma escola
-    const aberta = (await this.trechos.doMaterial(alcance.material.id, disciplinaId, alcance.turma.serieId)).find((trecho) => trecho.pagina === pergunta.pagina)
+    const aberta = (await this.trechos.doMaterial(alcance.material.id, disciplinaId)).find((trecho) => trecho.pagina === pergunta.pagina)
```

```mutacao
arquivo: apps/api/src/tutor/tutor.service.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-    this.#recusasSemMaterial = medidor.createCounter(METRICS.tutorRecusadoSemMaterial, { description: 'Perguntas do Tutor recusadas por falta de material da série, por turma' })
+    this.#recusasSemMaterial = medidor.createCounter('tutor.outro_nome', { description: 'Perguntas do Tutor recusadas por falta de material da série, por turma' })
```

```mutacao
arquivo: apps/api/src/app.module.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-        TutorModule.forRoot(opcoes.medidor === undefined ? {} : { medidor: opcoes.medidor }),
+TutorModule.forRoot({}),
```

```mutacao
arquivo: apps/api/src/tutor/tutor.repository.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-    return linha === undefined ? undefined : { turmaId: linha.turmaId, serieId: linha.serieId, serie: { etapa: linha.etapa, ano: linha.ano } }
+    return linha === undefined ? undefined : { turmaId: linha.turmaId, serieId: linha.turmaId, serie: { etapa: linha.etapa, ano: linha.ano } }
```

```mutacao
arquivo: apps/api/src/tutor/tutor.repository.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-          declaradoParaASerie(this.banco, serieId),
```

```mutacao
arquivo: apps/api/src/tutor/tutor.repository.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-          proprioOuComLicencaVigente(this.banco, hoje),
```

```mutacao
arquivo: apps/api/src/artefato/ferramentas.service.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-    if (!(await this.trechos.existeMaterialDaSerie({ serieId: daTurma.serieId, disciplinaId: parametros.disciplinaId }))) throw new DomainException(ErrorCode.SEM_MATERIAL_DA_SERIE)
```

```mutacao
arquivo: apps/api/src/artefato/ferramentas.service.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-    if (!(await this.trechos.existeMaterialDaSerie({ serieId: daTurma.serieId, disciplinaId: parametros.disciplinaId }))) throw new DomainException(ErrorCode.SEM_MATERIAL_DA_SERIE)
+    if (!(await this.trechos.existeMaterialDaSerie({ serieId: parametros.turmaId, disciplinaId: parametros.disciplinaId }))) throw new DomainException(ErrorCode.SEM_MATERIAL_DA_SERIE)
```

```mutacao
arquivo: apps/api/src/artefato/ferramentas.service.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-    if (daTurma === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

```mutacao
arquivo: apps/api/src/artefato/ferramentas.service.ts
teste: apps/api/test/leitura-por-serie.int.test.ts › com material de Química do 2º e do 9º na mesma escola
-    const achados = await this.trechos.buscar({ texto: parametros.tema, disciplinaId: parametros.disciplinaId, serieId: turma.serieId, limite: TRECHOS_NA_FERRAMENTA })
+    const achados = await this.trechos.buscar({ texto: parametros.tema, disciplinaId: parametros.disciplinaId, limite: TRECHOS_NA_FERRAMENTA })
```

```mutacao
arquivo: apps/api/src/assistente/assistente.service.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-    if (!(await this.trechos.existeMaterialDaSerie({ serieId: daTurma.serieId, disciplinaId }))) throw new DomainException(ErrorCode.SEM_MATERIAL_DA_SERIE)
```

```mutacao
arquivo: apps/api/src/assistente/assistente.service.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-    if (!(await this.trechos.existeMaterialDaSerie({ serieId: daTurma.serieId, disciplinaId }))) throw new DomainException(ErrorCode.SEM_MATERIAL_DA_SERIE)
+    if (!(await this.trechos.existeMaterialDaSerie({ serieId: turmaId, disciplinaId }))) throw new DomainException(ErrorCode.SEM_MATERIAL_DA_SERIE)
```

```mutacao
arquivo: apps/api/src/assistente/assistente.service.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-    if (daTurma === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

```mutacao
arquivo: apps/api/src/assistente/assistente.service.ts
teste: apps/api/test/leitura-por-serie.int.test.ts › com material de Química do 2º e do 9º na mesma escola
-        const entregues = await this.trechos.buscar({ texto: procurado, disciplinaId: pergunta.disciplinaId, serieId: turma.serieId, limite: TRECHOS_NA_CONVERSA })
+        const entregues = await this.trechos.buscar({ texto: procurado, disciplinaId: pergunta.disciplinaId, limite: TRECHOS_NA_CONVERSA })
```

```mutacao
arquivo: apps/api/src/assistente/turma-do-professor.repository.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-    return linha === undefined ? undefined : { serieId: linha.serieId, serie: { etapa: linha.etapa, ano: linha.ano }, disciplina: linha.disciplina }
+    return linha === undefined ? undefined : { serieId: linha.disciplina, serie: { etapa: linha.etapa, ano: linha.ano }, disciplina: linha.disciplina }
```

```mutacao
arquivo: apps/web/src/areas/aluno/tutor.ts
teste: apps/web/src/areas/aluno/tutor.test.ts
-  if (pausa === 'sem_material') return { pausa, titulo: 'Ainda não há material da sua turma aqui.', texto: 'Avise seu professor.' }
```

```mutacao
arquivo: apps/web/src/areas/aluno/tutor.ts
teste: apps/web/src/areas/aluno/tutor.test.ts
-  if (erro === ErrorCode.SEM_MATERIAL_DA_SERIE) return 'sem_material'
```

```mutacao
arquivo: apps/web/src/areas/aluno/tutor.ts
teste: apps/web/src/areas/aluno/tutor.test.ts
-  if (pausaRecusada === undefined || pausaRecusada === 'suspenso' || pausaRecusada === 'sem_material') return false
+  if (pausaRecusada === undefined || pausaRecusada === 'suspenso') return false
```

```mutacao
arquivo: apps/api/src/tutor/tutor.service.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-    if (ehAssuntoDelicado(pedido.texto)) return jaAceita === undefined ? this.#encaminhar(pedido, daTurma) : { execucaoId: jaAceita.id }
+    if (false && ehAssuntoDelicado(pedido.texto)) return jaAceita === undefined ? this.#encaminhar(pedido, daTurma) : { execucaoId: jaAceita.id }
```

```mutacao
arquivo: apps/api/src/tutor/tutor.service.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-        const pedidoGravado = { ...(pergunta.atividadeAplicadaId === null ? {} : { atividadeAplicadaId: pergunta.atividadeAplicadaId }), ...(pergunta.materialId === null ? {} : { materialId: pergunta.materialId }) }
+        const pedidoGravado = { ...(pergunta.atividadeAplicadaId === null ? {} : { atividadeAplicadaId: pergunta.atividadeAplicadaId }),  }
```

```mutacao
arquivo: apps/api/src/tutor/tutor.service.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-    return { turma, ...(atividade === undefined ? {} : { atividade }) }
+return { turma }
```

```mutacao
arquivo: apps/api/src/tutor/tutor.service.ts
teste: apps/api/src/tutor/tutor.int.test.ts
-    if (atividade !== undefined && material !== undefined && material.disciplinaId !== atividade.disciplinaId) naoEncontrado()
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/leitura-por-serie.int.test.ts › os dois helpers do filtro carregam o corte por escola
-      .where(and(eq(materialSerie.escolaId, requireEscolaId()), eq(materialSerie.materialId, material.id), eq(materialSerie.serieId, serieId))),
+      .where(and(eq(materialSerie.materialId, material.id), eq(materialSerie.serieId, serieId))),
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/leitura-por-serie.int.test.ts › os dois helpers do filtro carregam o corte por escola
-            eq(licencaDeMaterial.escolaId, requireEscolaId()),
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/leitura-por-serie.int.test.ts
-            lte(licencaDeMaterial.vigenteDesde, hoje),
+            lt(licencaDeMaterial.vigenteDesde, hoje),
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-tetos-de-envio.test.ts
-export const ENVIOS_POR_USUARIO_NA_JANELA = 100
+export const ENVIOS_POR_USUARIO_NA_JANELA = 30
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-tetos-de-envio.test.ts
-export const ENVIOS_POR_ESCOLA_NA_JANELA = 300
+export const ENVIOS_POR_ESCOLA_NA_JANELA = 60
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-tetos-de-envio.test.ts
-export const MATERIAIS_EM_PROCESSAMENTO_POR_ESCOLA = 300
+export const MATERIAIS_EM_PROCESSAMENTO_POR_ESCOLA = 3
```

## A corrida da carga

Corrida de 13/11/2026, `npm run carga:ingestao` (8 min) e `npm run carga:ingestao:controle-negativo` (8 min), no compose `educa-carga` (uma réplica do `worker-pdf`, `cpus: 1.5`, um PDF por vez),
uma depois da outra, com a janela aberta pelo Orquestrador. **Condição 1 de "Quando a carga vale como registro" cumprida:** load de 1 minuto de **0,94** no começo da corrida e de **0,93** no
do controle negativo (os dois abaixo de 2), e `docker ps` **vazio** nos dois começos (medido antes de cada comando; nenhum outro andar rodou nada).

| Critério | Limite | Corrida | Controle negativo (`VAGAS_POR_ESCOLA_DESLIGADAS=true`) |
|---|---|---|---|
| Envios da A pela rota real, com o guard, por três coordenadores | 300 aceitos (201) | 300 | 300 |
| Extrações da A | 300 prontas, 0 falhas | 300 prontas, 0 falhas, 0 pendentes | 300 prontas, 0 falhas, 0 pendentes |
| Vazão por PDF, uma réplica | as 300 projetadas em até 10 h (36.000 s) | 45 ms por PDF; 14 s para as 300 | 44 ms; 13 s |
| p95 do turno do Tutor da B (banco: `criada_em` a `concluida_em`) | até 500 ms acima da base | 340 ms com a ingestão (38 turnos), 326 ms na base (180): +14 ms | 335 ms (35 turnos), 326 ms (180): +9 ms |
| Pior statement (`pg_stat_statements`) | até 1,5 s | 108 ms (`pg_advisory_xact_lock`) | 99 ms |
| PDF da B enviado quando a A mandou 90% das dela | espera até 2 extrações da A | 152 ms, atrás de 1 extração | **8.698 ms, atrás de 218 extrações: reprova, como o controle negativo exige** |
| k6 (thresholds do Tutor da B: `turno_b` p95 ≤ 826 ms e máximo < 30 s, `respostas_429` e `respostas_inesperadas` = 0, `turnos_b_concluidos` > 0) | nenhum cruzado | nenhum (p95 439,5 ms, máximo 469,6 ms, 271 turnos concluídos) | nenhum (p95 438,6 ms, máximo 470,6 ms, 271 turnos) |

A janela da ingestão é curta de propósito: as 300 extrações terminam em 13 a 14 s, e o p95 do turno com a ingestão sai de 35 a 38 turnos (o piso do driver é 20; com menos ele não diz nada).

**As corridas anteriores não valem, e ficam escritas.** A primeira, antes de alinhar os tetos do envio ao §7c, reprovou: só 14 dos 300 envios foram aceitos (286 × `429`: o código tinha 30 por
pessoa, 60 por escola e 3 em processamento), e o p95 do turno da B ficou sem amostra (19 turnos). A segunda e a terceira, com a máquina calma, reprovaram por defeito do **medidor**, não do
produto: o relógio de parede do WSL andava ±5,5 s a cada ~5,5 s (o `systemd-timesyncd` brigando com a hora do Hyper-V), e o k6 media o turno com `Date.now()`, que saiu negativo (`turno_b` com
mínimo negativo). Dois consertos: o Orquestrador parou o `systemd-timesyncd` da máquina, e o k6 (`infra/k6/ingestao.js`) agora mede com o relógio monotônico do teste
(`exec.instance.currentTestRunDuration`; o k6 2.2.0 não tem `performance` global, a tentativa com ele quebrou todas as iterações), e o driver (`carga-ingestao.ts`,
`conferir-carga-ingestao.ts`) com `performance.now()`. O monotônico do WSL ainda anda ~3,5% à frente do Windows (medido pelo Orquestrador), erro pequeno diante dos limites.

**O PDF do seed é o que há: 14,6 KB** (`quimica-2-cap-7-estequiometria.pdf`, seis páginas); a extração de 20 MB, o teto do contrato, não foi medida aqui e é o que a validação precisa olhar com a
apostila real.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| `frontend-reviewer` 1ª | "Avise seu professor." é curto demais para quem nunca viu o aviso; sugestão de uma frase a mais | TODO.md: texto de tela, a avaliar com a tela vista pelo aluno no piloto |
| `frontend-reviewer` 1ª | O aviso só some na próxima pergunta (`recusaVencida`); reavaliar se o professor enviar o material enquanto o aluno está na tela | TODO.md: reavaliar depois do piloto; já está registrado em `docs/interface.md` e é coerente com a pausa `suspenso` |
| `frontend-reviewer` 1ª | `FalhaNaConversa` mostra "O Tutor não recebeu esta mensagem." acima do aviso, redundante para `sem_material` | TODO.md: inofensiva, e mexer nela muda o texto de outro estado (falha da conversa); fica com a próxima tarefa que toca `Tutor.tsx` |
| `conformidade-reviewer` 1ª | Rodar `ehAssuntoDelicado` de novo sobre `pergunta.texto` antes de falhar a conferência depois do `202`; registrar para a AIA do Tutor e a retro | Não aplicada: muda comportamento do Tutor. Destino: TODO.md e a AIA do Tutor (`docs/aia/`), para a retro da funcionalidade |
| `conformidade-reviewer` 1ª | Indicador por turma, sem aluno, na tela do professor ou da coordenação | Fica para produto: TODO.md |
| `conformidade-reviewer` 1ª; `test-engineer` 1ª | A mensagem do professor, "Peça à coordenação o material desta série.", não diz qual série; e ela não tem teste de tela | Não aplicada: dizer a série muda o contrato da mensagem (`messages.ts` é texto fixo por código); destino: TODO.md, junto com a tela do professor/coordenação |
| `privacy-guardian` 1ª | Turma muito pequena, cruzada com o horário, pode apontar quem perguntou (rótulo `turma_id`) | Registro para a AIA do Tutor (`docs/aia/`): TODO.md; hoje o contador não guarda conteúdo e fica na infraestrutura nossa |
| `infra-guardian` 1ª | Reenvio com a mesma `chaveEnvio` depois que o material saiu do alcance devolve `SEM_MATERIAL_DA_SERIE` ou `NAO_ENCONTRADO` em vez do `execucaoId` já aceito | Não aplicada: muda comportamento do `enviar`; o jeito anterior à tarefa já tinha a mesma falha com material excluído. Destino: correção própria (`tasks/correcoes/`), via Orquestrador |
| `infra-guardian` 1ª; `revisor-geral` 1ª | A extração de 20 MB (o teto do contrato) e as 300 apostilas com esse tamanho não foram medidas | Validação da funcionalidade, com a apostila real: já está escrito no fim de "A corrida da carga" |
| `infra-guardian` 1ª | `existeMaterialDaSerie` roda duas vezes por turno do Tutor (o `POST` e o `entrada`) | Sem ação: custo medido (+14 ms no p95, na corrida de 13/11); fica como primeiro lugar a olhar se o cenário das 10h apertar |
| `revisor-geral` 1ª | A recusa `SEM_MATERIAL_DA_SERIE` e o `existeMaterialDaSerie` rodam antes do `limite.contar()`, então a recusa repetida não gasta o teto | Sem ação: são leituras baratas, e o `infra-guardian` viu o caminho e aprovou |
| `test-engineer` 1ª | O e2e do estado usa a API simulada e não prova o `422` real | Recusada: o servidor está provado em `leitura-por-serie.int.test.ts` (a recusa antes do `202`, nada gravado), e o e2e prova só a tela |
| `test-engineer` 1ª | O intermitente de `tutor.int.test.ts` › "com os sinais suspensos…" precisa de correção própria com dono | Correção própria (`tasks/correcoes/`), via Orquestrador; já registrado na última divergência do documento |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-13 21:25:06 | 2026-11-13 21:25:37 | `tenancy-guardian` | 2 | APROVADO | a799083dd7e86b7e8 |
| 2026-11-13 21:24:44 | 2026-11-13 21:25:49 | `revisor-geral` | 2 | APROVADO | ac3ae38f8c2d9de66 |
| 2026-11-13 21:25:35 | 2026-11-13 21:25:52 | `frontend-reviewer` | 2 | APROVADO | ab0300f58a25bacb4 |
| 2026-11-13 21:25:16 | 2026-11-13 21:25:56 | `conformidade-reviewer` | 2 | APROVADO | ab1d537e971c8880b |
| 2026-11-13 21:25:26 | 2026-11-13 21:26:06 | `infra-guardian` | 2 | APROVADO | a42d30a3f8cd9a6cb |
| 2026-11-13 21:25:45 | 2026-11-13 21:26:19 | `privacy-guardian` | 2 | APROVADO | a223aa96467002fa3 |
| 2026-11-13 21:24:56 | 2026-11-13 21:27:53 | `test-engineer` | 2 | APROVADO | a4e778b429195bd20 |
