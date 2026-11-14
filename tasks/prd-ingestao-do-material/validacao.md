# Validação — ingestao-do-material (F4)

## Rodada 1 — 14/11/2026

**Escopo:** funcionalidade completa (com o corte de 11/11/2026: RF1, RF2, RF5, RF9, RF12, RF19, a habilidade no RF7, o
"classificadas" do RF15 e a classificação no RF20 são da F4b)
**Commit validado:** `743fd52f` (o último commit de código é `d69bd821`, tarefa 12.0)
**Veredito: APROVADA COM RESSALVAS**

Ambiente: testes no ambiente de teste 0 (`EDUCA_AMBIENTE_TESTE=0`), árvore limpa no começo e no fim. O `node_modules` é
anterior ao `package-lock.json`, mas a diferença no lock da spec é só o `pdfjs-dist` mudando de workspace e o `bullmq` na
API, com as mesmas versões já instaladas: não rodei `npm ci`.

### 1. RF a RF

| RF | Situação | Código | Teste | Observação |
|---|---|---|---|---|
| RF1, RF2, RF5, RF9, RF12, RF19 | fora do escopo | — | — | F4b (`tasks/prd-classificacao-bncc/prd.md`), pelo corte de 11/11 |
| RF3 | ATENDIDO | `material.service.ts:205-206` (séries da escola antes de tudo, `NAO_ENCONTRADO` igual ao inexistente), `material.repository.ts:278-290` (`seriesDaEscola`, `gravarSeries`); contrato `serieIds` 1 a 7 em `packages/shared/src/material/material.ts` | `apps/api/test/material.int.test.ts:776` ("com duas séries o material aparece no filtro de cada uma…") e `:805` ("sem série, `serieIds` vazio, repetida… `ENTRADA_INVALIDA`, nada lido nem gravado") | Foto do diálogo com "Séries do material (obrigatório)": `envio--computador.png`, `envio--celular-1.png` |
| RF4 | ATENDIDO | `packages/core/src/material/chapter-reader.ts:65` (`ler`), gravado na transação da extração em `apps/worker/src/processors/extrair-pdf.ts:138`; `GET /:id` com `capitulos` em `material.service.ts:486-495` | `packages/core/src/material/chapter-reader.test.ts` (as bordas e a amostra fixa de seis PDFs com o pdfjs de verdade, 100% das páginas no capítulo certo); `apps/worker/test/extrair-pdf.int.test.ts` (PDF sem capítulo fica `pronto`); `e2e/material-painel.spec.ts:105` | Fotos do painel com quatro capítulos, um sem número, e do "O PDF não tem capítulos que a leitura reconheça": `painel-pronto--computador.png`, `painel-pronto--celular-1.png`, `painel-terceiro--computador.png`. Na apostila sintética de 20 MB (abaixo), 25 capítulos de 300 páginas, todos achados |
| RF6 (só séries e título; habilidade é F4b) | ATENDIDO | `material.service.ts:449-474` (`atualizar`: séries da escola, `for update`, `NAO_ENCONTRADO` antes de `EDICAO_EM_ANDAMENTO`, auditoria sem título), `material.repository.ts:322-343`; teto à parte em `:378-385` | `apps/api/test/material-patch.int.test.ts` (série tirada sai da busca, série da B, edição em andamento, corridas, 429); `e2e/material-painel.spec.ts:170` | Fotos do formulário "Corrigir título e séries": `painel-correcao--computador.png`, `painel-correcao--celular-1.png`; no `processando`, `painel-processando--computador.png` |
| RF7 (sem a habilidade) | ATENDIDO | Filtro numa cópia só: `material.repository.ts:161-193` (`declaradoParaASerie`, `proprioOuComLicencaVigente`), usado em `buscar` (`:446-471`), `paginasDoMaterial` (`:477-498`), `existeMaterialDaSerie` (`:504-520`) e `tutor.repository.ts:194-221` (`materialDaTurma`); a série vem da turma em `ferramentas.service.ts:69,122`, `assistente.service.ts:115,123`, `tutor.service.ts:284-324` | `apps/api/test/leitura-por-serie.int.test.ts` ("material só do 2º ano, turma do 9º", 4 casos por chamador; "com material de Química do 2º e do 9º…"; "a virada do ano") | A adaptação não lê material (Tech Spec §5, "Como ficou na 9.0"): ver o achado maior 1. **Mutação 1** vermelha |
| RF8 | ATENDIDO | `SEM_MATERIAL_DA_SERIE` antes do `202` em `ferramentas.service.ts:75` e `assistente.service.ts:93,115`; no Tutor depois da D36, `tutor.service.ts:288-290`; tela do aluno em `apps/web/src/areas/aluno/tutor.ts:75,94` | `leitura-por-serie.int.test.ts` ("sem material da série, ninguém gera": licença vencida, `processando`, substituído, com `vi.spyOn(FakeAdapter.prototype, 'chamar')` sem chamada e as contagens iguais; "o Tutor: a D36 vem antes do filtro…"); `e2e/aluno-tutor.spec.ts:428,439` | Fotos: o aluno, no e2e com captura ligada, "Ainda não há material da sua turma aqui. Avise seu professor." (`pw-saida/…-chromebook/test-finished-1.png`, `…-celular/test-finished-1.png`); o professor, **de verdade contra a API**, gerando atividade de Química sem material da série: "Peça à coordenação o material desta série." (`professor-sem-material--computador.png`, `--celular.png`) |
| RF10 | ATENDIDO | `material.service.ts:265-319` (`enviarEdicao`, `#gravarEdicao` com o alvo `for update` e a herança lida ali); substituição na transação da extração, `extrair-pdf.ts:40-43,139`; índice `material_uma_edicao_em_andamento` | `apps/api/test/material-edicao.int.test.ts:159` ("a busca devolve a anterior antes, e só a nova depois"), `:183` ("a nova com falha… a anterior segue"), as corridas [P]; `e2e/material-painel.spec.ts:170` | Foto do botão "Enviar edição nova" só no `pronto`: `painel-pronto--computador.png` (e ausente no `processando`) |
| RF11 | ATENDIDO | `artefato.service.ts:56-60` (`fontesDoConteudo`), `fontesDosMateriais` no repository do artefato; `rotuloDaFonte` em `packages/shared`; PDF em `pdf-do-artefato.ts:197-199` | `apps/api/src/artefato/artefato.int.test.ts:404` ("a troca de edição: o artefato antigo segue citando a edição que usou, com 'edição anterior', e a geração nova cita só a nova"), `:426` (expurgo: "material da escola"); `e2e/artefato-fontes.spec.ts` | Sem foto minha do chip: o e2e dele passou nas duas larguras (56 casos com `material.spec.ts` e `material-licencas.spec.ts`). Ver o achado maior 1, sobre a adaptação de artefato antigo |
| RF13 | ATENDIDO | `apps/worker/src/processors/extrair-pdf.ts` (transição com escopo, falha definitiva, objeto apagado depois do commit, `quandoAbortar`); `varrer-envios.ts:114`; envio com `envio_de_material` antes do objeto, `material.service.ts:334-363`; `apps/api/src/ops/jobs-que-falharam.ts` (recusa `ia.*`, `titular.*`; o `material.extrair-pdf` não se reprocessa) | `apps/worker/test/extrair-pdf.int.test.ts`, `apps/worker/test/varrer-envios.int.test.ts`, `apps/api/test/material-envio-orfao.int.test.ts`, `apps/api/test/ops-jobs.int.test.ts`, `packages/core/src/db/volta-da-f4.int.test.ts` | O alerta `pdf-parado` (`infra/test/alerta-do-pdf-parado.int.test.ts`) não rodei: recria o compose de teste e é da esteira (job de infra); a evidência dele é o `3_task.md` |
| RF14 | ATENDIDO | Um pedido por arquivo, com os tetos por pessoa e por escola sob a trava da escola (`material.service.ts:388-396`); o lote, o título do nome do arquivo e a retomada depois do 429 em `apps/web/src/areas/coordenacao/material/envio-em-lote.ts` e `use-lote-de-material.ts`; o repetido pelo índice único `(escola_id, sha256)` | `envio-em-lote.test.ts`, `use-lote-de-material.test.ts`, `Material.test.tsx` (21 arquivos, 18 + 1 falha + 1 "já enviado", "12 de 20 enviados"); `e2e/material.spec.ts` (o lote de três com um repetido; o diálogo com 300 materiais a 1366 × 768) | Foto do diálogo, "Arraste até 20 PDFs… Cada um com até 20 MB": `envio--computador.png`, `envio--celular-1.png` |
| RF15 (sem "classificadas") | ATENDIDO | Fila `pdf`, vaga 2 por escola, `worker-pdf` com um PDF por vez e `cpus: 1` (`infra/compose.yml:473-499`) | Corrida de 13/11 registrada no `9_task.md` ("A corrida da carga"): 45 ms por PDF de 14,6 KB, p95 do Tutor da B +14 ms, PDF da B atrás de 1 extração; controle negativo reprova como deve | **Medida desta validação, a extração de 20 MB** (pedida pelo Orquestrador): o `PdfExtractor` do repositório num núcleo só (`taskset`), sobre apostilas sintéticas geradas no scratchpad: 300 páginas em duas colunas com uma imagem por página (18,6 MB): **1,3 s**, pico de memória **474 MB**; o mesmo com fontes TrueType embutidas (18,7 MB): **1,4 s**, 459 MB; 2.500 páginas só de texto, sem compressão (19,2 MB): **4,7 s**, 523 MB, 209 capítulos. 300 apostilas desse tamanho são de 7 a 24 min de extração numa réplica, longe das 10 h. Não é PDF de editora (não usamos material de terceiro), e a medida não inclui o storage nem a gravação dos trechos; ver o menor 2, sobre a memória |
| RF16 | ATENDIDO | Recusa antes de ler o arquivo, `material.service.ts:208-218` e `:165-175`; de novo `for share` na transação, `:322-327`; `apps/api/src/material/licenca.service.ts:49-88`; `situacaoDaLicenca`, `packages/shared/src/material/licenca.ts:36` | `apps/api/test/licenca.int.test.ts`; `material.int.test.ts` (terceiro sem licença, vencida, inexistente e da B: recusado sem byte lido, com `material.recusado`); `Licencas.test.tsx`; `e2e/material-licencas.spec.ts` | Fotos da aba Licenças: `licencas--computador.png`, `licencas--celular.png` |
| RF17 | ATENDIDO | Dia de São Paulo (`diaDeUso`) com `Clock` injetado, `material.repository.ts:176-193`; sino em `apps/web/src/areas/coordenacao/painel/fila-da-coordenacao.ts:133-160`, lendo todas as páginas (`lerPaginas`) | `leitura-por-serie.int.test.ts:248` ("às 23h do último dia… às 0h01 do seguinte não… o PATCH que estende o devolve, também na página aberta do Tutor"), `:276`, `:289`; `artefato.int.test.ts:479` (o rascunho mantém a citação); `SinoDaCoordenacao.test.tsx`, `fila-da-coordenacao.test.ts` (dias −31, −30, 0, +1) | Foto do sino com "Uma licença de material vence em 04/12": `sino--computador.png`. **Mutação 2** vermelha |
| RF18 | ATENDIDO | `material.service.ts:524-550` (`resumir`), `material.repository.ts:389-396`, `AuditoriaRepository.recusasDeMaterialDesde` | `apps/api/test/material-resumo.int.test.ts`; `ResumoDoMaterial.test.tsx`, `resumo-do-material.test.ts`; `e2e/material-resumo.spec.ts` | Fotos com dado (duas linhas, "Sem série" por último e o aviso) e vazia: `lista--computador.png`, `lista--celular-1.png`, `vazia--computador.png`, `vazia--celular.png` |
| RF20 (sem a classificação) | ATENDIDO | Escopo do contexto em todo método do `MaterialRepository`, do `LicencaRepository` e da extração; os dois fragmentos do filtro com o corte da escola repetido (`material.repository.ts:166,185`) | `apps/api/test/material-isolamento.int.test.ts`; os blocos de isolamento de `material-edicao`, `material-patch`, `material-resumo`, `licenca`, `leitura-por-serie` (`:714-735`, os fragmentos chamados sozinhos) e `extrair-pdf` | **Mutação 3** vermelha em 4 casos |

Provas de mutação (aplicadas uma de cada vez, restauradas com `git checkout -- <arquivo>`, árvore limpa no fim):

| RF | Cláusula removida | Teste que ficou vermelho |
|---|---|---|
| RF7 | `serieId === undefined ? undefined : this.#comASerie(serieId)` em `buscar` (`material.repository.ts:464`) | `leitura-por-serie.int.test.ts`: 3 casos ("a porta de trechos e a página aberta só devolvem o material da série pedida", "a rota de busca com serieId…", "com material de Química do 2º e do 9º…") |
| RF17 | `or(isNull(vigenteAte), gte(vigenteAte, hoje))` em `proprioOuComLicencaVigente` (`material.repository.ts:188`) | `leitura-por-serie.int.test.ts`: 2 casos ("às 23h do último dia…", "a licença vigente de outro material da escola não autoriza o de licença vencida") |
| RF20 | `eq(material.escolaId, requireEscolaId())` em `alvoDaEdicao` (`material.repository.ts:300`) | `material-edicao.int.test.ts`: 4 casos ("alvo da outra escola pronto / processando / licenca_vencida: `NAO_ENCONTRADO`… nenhum byte lido", "o repository, no contexto da escola A, não trava nem lê o alvo da B") |

As fotos estão em
`/tmp/claude-1000/-home-joaquimdp-Documents-git--maestri-floors-educaia--specingestao-do-material/9766c953-a486-47cf-83cc-1af9abd16954/scratchpad/fotos/`
(a vitrine grava em `.processo/vitrine/` com o mesmo nome para endereços que só mudam na query; por isso foram tiradas uma a
uma e movidas). Material semeado na escola cheia da vitrine com `e2e/support/material.ts`: um `pronto` com quatro
capítulos, um de terceiro com licença vencendo em 20 dias, um `processando` e um `falhou`. A vitrine terminou com
"Nenhuma tela rola a 1366 × 768" em todas. Lidas como imagem, nenhum defeito da lista do `frontend-reviewer`: estados
com texto que diz o que fazer, sem rolagem lateral a 360 px, alvo das ações principais com altura de botão, o painel rola
dentro da gaveta no computador e no celular. Nas fotos de página inteira do celular, a barra de baixo aparece no meio da
imagem emendada: é a barra fixa na captura em pedaços, não da tela.

### 2. Regras de negócio, casos de borda e critério de pronto

| Item | Situação | Evidência |
|---|---|---|
| Regra: material e classificação não variam por ano letivo | cumprida | `material`, `material_serie`, `licenca_de_material` sem `ano_letivo_id`; `leitura-por-serie.int.test.ts:666` (virada do ano) |
| Regra: correção humana vence a da IA | fora do escopo | F4b (não há classificação pela IA na F4) |
| Regra: toda saída cita material, edição e página (D6) | cumprida | `fontes` do artefato (RF11); `exigirCitacoesEntregues` em `ferramentas.service.ts:134` |
| Regra: a classificação só chega ao aluno pela atividade aprovada | cumprida no que é da F4 | nenhuma saída de IA nova (Tech Spec §7b, §8) |
| Regra: ingestão em lote, com limite por escola | cumprida | vaga `pdf` 2 por escola, tetos de 100/300/300; carga com controle negativo (`9_task.md`) |
| Borda: apostila do 1º e do 2º ano | coberta | `material.int.test.ts:776` |
| Borda: `EF69LP`, Química no EM | fora do escopo | F4b |
| Borda: material sem numeração de capítulo | coberta | `chapter-reader.test.ts`, `extrair-pdf.int.test.ts`, foto `painel-terceiro--computador.png` |
| Borda: duas colunas, fórmula quebrada | coberta | `packages/core/src/material/pdf-extractor.test.ts`; a apostila de 20 MB em duas colunas extraiu as 300 páginas |
| Borda: edição nova com a anterior processando | coberta | `material-edicao.int.test.ts` (`EDICAO_EM_ANDAMENTO`), corridas [P] |
| Borda: licença vence com rascunho citando o material | coberta, com ressalva | `artefato.int.test.ts:479`; a adaptação desse rascunho é o achado maior 1 |
| Borda: coordenação corrige enquanto a reclassificação roda | fora do escopo | F4b |
| Pronto: PDF lido no worker e apagado em todo caminho; listar, reprocessar, descartar (RF13) | cumprido | ver RF13 |
| Pronto: séries, capítulos, edição e licença; correção de séries e título | cumprido | RF3, RF4, RF6, RF10, RF16 |
| Pronto: toda leitura de página só alcança material `pronto`, da série, próprio ou de licença vigente; sem ele nada é gerado; no Tutor a D36 antes | cumprido | RF7, RF8, RF17; mutações 1 e 2 |
| Pronto: a edição nova só tira a anterior quando fica pronta; o artefato antigo cita a que usou | cumprido | RF10, RF11 |
| Pronto: até 20 PDFs por envio; 300 apostilas numa noite sem atrasar o Tutor, com a corrida registrada | cumprido | RF14, RF15, mais a medida de 20 MB desta validação |
| Pronto: resumo, aba Licenças e aviso no sino | cumprido | RF16, RF17, RF18, com fotos |
| Pronto: nada de uma escola para outra, por endpoint e repository | cumprido | RF20, mutação 3 |
| Pronto: `docs/lgpd.md`, `modelo-de-dados.md`, `runbook.md`, `infra.md`, `interface.md`, `regulacao.md` | cumprido | todos no diff da spec (`git diff --stat origin/develop 743fd52f -- docs/`); `docs/lgpd.md:101-102` com a licença, o PDF temporário e as ações novas da auditoria |
| Pronto: passo 1 do roteiro da demonstração conferido contra o e2e na 7.0 | cumprido | `docs/roteiro-da-demonstracao.md` §3 e `e2e/roteiro-da-demonstracao.spec.ts`, os dois no commit da 7.0 (`f2a0d22b`) |
| Roadmap, "Pronto quando" | cumprido | geração e Tutor só da série e disciplina; edição sem perder o gerado; licença vencida fora da busca; 300 numa noite com o PDF apagado; o painel da ingestão |

### 3. Portão

| Portão | Resultado |
|---|---|
| `npm run typecheck`, `npm run lint`, suítes inteiras | não rodados: escopo de funcionalidade completa, a esteira cobre (D79). Esteira: conferida no fechamento |
| Integração, evidência dos RF (14 arquivos: `leitura-por-serie`, `licenca`, `material-edicao`, `material-envio-orfao`, `material-isolamento`, `material-patch`, `material-resumo`, `material`, `ops-jobs`, `extrair-pdf`, `varrer-envios`, `migracao-f4`, `volta-da-f4`, `artefato`) | ✅ 389 passaram |
| Unidade, evidência dos RF (26 arquivos: telas do material, `packages/core/src/material`, `packages/shared/src/material`, sino, tutor do aluno, `contracts`, `material-tetos-de-envio`, `matriz`, `Artefato`, `pdf-do-artefato`, `jobs-que-falharam`) | ✅ 547 passaram |
| e2e, evidência dos RF (`material-painel`, `material-resumo`, `material`, `material-licencas`, `artefato-fontes`, `aluno-tutor` só os casos "sem material da turma") | ✅ 22 + 56 + 2 passaram, nos projetos `chromebook` e `celular` |
| Mutações (3) | ✅ as três vermelhas, árvore restaurada |
| Esteira do GitHub | roda no fechamento, depois desta validação (D78): não entra no veredito |
| Revisões com veto registradas e aprovadas | ✅ nas 12 tarefas, todo revisor obrigatório do `tasks.md` tem rodada, e a última de cada um é APROVADO; `revisao-spec.md` com veredito APROVADA (rodada 6) |

Processo: nenhum commit de código fora de `(tarefa N.0)` ou `(correção <slug>)` entre `origin/develop` e `743fd52f`, e
nenhum `Fora do processo:`. As divergências da Tech Spec estão na própria Tech Spec (§11, uma linha por tarefa, e §5
"Como ficou na 9.0").

### 4. Achados

**Críticos**
- Nenhum.

**Maiores**
- `apps/api/src/artefato/artefato.service.ts:138-180` e `techspec.md` §5 ("Como ficou na 9.0"): **a adaptação herda as
  citações do original, com o trecho do material, mesmo depois que a licença venceu ou a edição foi substituída.** A
  entrada da tarefa é o conteúdo inteiro do original (`{ conteudo: lida.original, adaptacao }`, `:156`), que leva o texto
  da página citada, e `exigirAdaptacaoFiel` (`conferencia.ts:46-58`) obriga a versão nova a repetir `materialId`,
  `pagina` e `trecho`. Então, com a licença vencida, a professora pede a adaptação e o texto do material licenciado vai
  de novo ao provedor e nasce um artefato novo, com entrega, citando material que a escola já não pode usar; e o
  artefato gerado antes da troca de edição gera uma versão nova que cita a edição anterior. O PRD lista a adaptação no
  RF7 entre as gerações, e o caso de borda "Licença vence com atividade em rascunho" diz "geração nova não usa o
  material"; o RF11 diz "geração nova só cita a edição atual". A Tech Spec registrou a decisão contrária na 9.0 (o
  Implementador, triada como detalhe), com o motivo "a adaptação de necessidade específica de uma atividade pronta não
  pode parar porque a licença venceu depois", mas o PRD é do Joaquim, a D5 diz que só entra material com licença que
  permite o uso, e `docs/regulacao.md` §5 tem em aberto se a licença precisa cobrir o envio ao provedor. Nenhum teste fixa
  o comportamento (não há caso de adaptação com licença vencida nem com edição substituída em
  `artefato.int.test.ts`). **Correção:** levar ao Joaquim a escolha (a adaptação de artefato com licença vencida é
  recusada como `LICENCA_VENCIDA`, ou segue e o PRD ganha a exceção) por `registrar-decisao`, alinhar o RF7 e o caso de
  borda do PRD à escolha, e acrescentar o caso de integração que a prova, na tarefa que mexer em `ArtefatoService.adaptar`
  ou numa correção própria.

**Menores**
- `apps/api/src/governanca/governanca.repository.ts:259` (`retomar`), `apps/api/src/ops/operacao-privacidade.repository.ts:100`
  (`encerrar`) e `:133` (`encerrarLigacoes`), `apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts:253`
  (`enviar`): gravam `now()` de uma transação contra um instante que nasceu de `defaultNow()` em outra, com checagem
  `>=` no banco. Com o relógio do servidor do banco recuando (o que o WSL faz; um passo do NTP faz o mesmo), a rota
  responde 500. **Nenhuma das quatro foi tocada pela F4** (são de F1, F3 e X6): não pesam no veredito. A de
  `minha-atividade` é o envio da atividade do aluno (regra 80, item 6). **Correção:** `greatest(now(), <coluna de
  início>)` nas quatro, com um caso de integração cada, numa correção própria. Dono: Orquestrador, ao `TODO.md`
  (origem: `tasks/correcoes/2026-11-13-testes-com-relogio.md`, "Recomendações sem aplicar").
- `infra/compose.yml:473-499`: o `worker-pdf` tem `cpus: 1` e nenhum limite de memória, e a extração de um PDF de 20 MB
  chega a ~0,5 GB de RSS (medida desta validação); `docs/infra.md:267` diz "CPU e memória de um PDF de até 20 MB" sem o
  número. **Correção:** pôr o pico medido em `docs/infra.md` e um `mem_limit` com folga no serviço. Dono: Orquestrador,
  ao `TODO.md`.
- `apps/api/src/material/material.service.ts:379` e `:389`: os tetos do `PATCH` e do envio contam a janela por
  `Date.now()`, enquanto o resto do serviço lê o `Clock` injetado (`#agora`, `:140`). Funciona, mas o teste não consegue
  mover a janela pelo relógio falso. **Correção:** `this.#agora()` nos dois. Dono: Orquestrador, ao `TODO.md`.
- `tasks/prd-ingestao-do-material/techspec.md:5`: o status ainda diz "rascunho", com a spec aprovada em 11/11 e as 12
  tarefas feitas. **Correção:** "aprovada" no fechamento. Dono: Orquestrador.
- A mensagem do professor sem material, "Peça à coordenação o material desta série.", não diz qual série e não tem teste
  de tela (`9_task.md`, recomendações, já no `TODO.md`); vista nesta validação, contra a API de verdade, nas duas
  larguras (`professor-sem-material--*.png`). Sem nova ação.
- O que o `estado.md` ainda lista em "Devo ainda" para o fechamento (a asserção sem ordem de `e2e/material.spec.ts:314`,
  os itens da ordem r1 da 5.0, os textos de `TODO.md:1696`, o preparo fixo do e2e por fatia, a varredura por amostragem
  e a seção "Revisões" do `12_task.md` refeita pelo Implementador a partir dos transcripts): conferir no fechamento.
  Dono: Orquestrador.

**Positivos**
- O filtro de série e licença numa cópia só (`declaradoParaASerie`, `proprioOuComLicencaVigente`), com o corte da escola
  repetido e o teste de isolamento chamando cada fragmento sozinho: as duas mutações de regra caíram em mais de um caso.
- A carga com controle negativo que precisa reprovar, e a reprovou: prova que a vaga por escola é que segura a escola B.
- Os testes de licença com o dia de São Paulo e relógio injetado nas duas bordas (23h do último dia, 0h01 do seguinte).

### 5. Conclusão

Todo RF do escopo da F4 tem código, teste efetivo e, quando tem tela, foto lida; as três provas de mutação nos RF de
maior risco ficaram vermelhas; o critério de pronto do `tasks.md` e o "Pronto quando" do roadmap estão cumpridos, e
nenhum teste que rodei ficou vermelho. A ressalva é o achado maior 1: o comportamento da adaptação com licença vencida ou
edição substituída foi decidido numa tarefa contra o texto do PRD e da D5, sem teste que o fixe. Não bloqueia a próxima
funcionalidade, mas precisa da palavra do Joaquim. O caminho até APROVADA: a decisão registrada, o PRD alinhado a ela e o
caso de integração que a prova.

### 6. Pendências herdadas

| Pendência | Destino |
|---|---|
| Adaptação × licença vencida e edição substituída (maior 1) | Joaquim, por `registrar-decisao`; depois correção com o caso de integração |
| As quatro rotas com `now()` contra `defaultNow()` (governança, suboperador `encerrar` e `encerrarLigacoes`, `minha-atividade` `enviar`) | `TODO.md`, correção própria; Orquestrador |
| Memória do `worker-pdf` (pico ~0,5 GB por PDF de 20 MB) em `docs/infra.md` e `mem_limit` | `TODO.md`; Orquestrador |
| `Clock` injetado nos tetos do envio e do `PATCH` | `TODO.md`; Orquestrador |
| Status da `techspec.md` | fechamento da spec; Orquestrador |
| Itens de "Devo ainda" do `estado.md` | fechamento e retro; Orquestrador |
| Commits `Fora do processo:` com código | nenhum nesta spec |
| O alerta `pdf-parado` (`infra/test/alerta-do-pdf-parado.int.test.ts`) | não rodado aqui; a esteira o roda no job de infra, conferida no fechamento |
