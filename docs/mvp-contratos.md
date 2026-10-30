# MVP de apresentação: contratos e dados (pacote S)

> A referência dos pacotes M, P, W, A, T e G. Vale o que está no código: `packages/shared/src/` (schemas zod, todos
> `strictObject`), `packages/nucleo/src/db/schema/` (o docblock de cada tabela explica cada restrição) e a migration
> `packages/nucleo/drizzle/0022_mvp_apresentacao.sql`. Este arquivo é o índice. **Nenhum pacote muda tabela, schema nem
> `MATRIZ`**: o que faltar volta para o pacote S. A migration `0023_mvp_restricoes.sql` traz o que a revisão da fase 1
> pediu de banco (seção 4).

## 1. Antes de usar

- As tabelas saem de `@educa/nucleo` (`packages/nucleo/src/db/schema/mvp/tabelas.ts`, ligado ao `index.ts` e ao `schema`
  do drizzle na integração da fase 1), e os contratos, de `@educa/shared`.
- `npm run db:gerar` lê `@educa/shared` pelo `dist`: rode `npm run build -w @educa/shared` antes. Só o pacote S gera migration.
- Os testes das restrições estão em `packages/nucleo/src/db/schema/mvp/tabelas-do-mvp.int.test.ts`, e os dos schemas, ao
  lado de cada um em `packages/shared/src/`.

## 2. Convenções que valem em toda rota

| O quê | Como é |
|---|---|
| Escopo | Escola, ano letivo e pessoa vêm da sessão. Nenhum schema de entrada tem `escolaId`, `anoLetivoId`, `usuarioId` ou `professorId`: mandar é `ENTRADA_INVALIDA` |
| Objeto de outra escola, ou fora do alcance | `NAO_ENCONTRADO`, igual ao inexistente |
| `POST` que dispara IA | Leva `chaveEnvio` (UUID que a tela sorteia a cada envio) e responde **202** `execucaoAceitaResponseSchema`. A mesma chave devolve a mesma execução |
| Execução | A tela consulta `GET /v1/execucoes/:id` a cada `INTERVALO_DA_CONSULTA_DE_EXECUCAO_MS` até `concluida` ou `falhou` |
| Função suspensa | Antes de gravar a execução: `FUNCAO_SUSPENSA`. A função de cada tarefa é `FUNCAO_DA_TAREFA_DE_IA`. **Suspender recusa execução nova e não apaga o que foi produzido**: a entrega pendente de função suspensa continua podendo ser aprovada ou rejeitada pelo professor |
| `questao` | O **número** da questão, a partir de 1 (posição em `conteudo.questoes` mais um), na rota, no banco e no sinal |
| `alternativa`, `gabarito` | O **índice** da alternativa, de 0 a 3 |
| Custo | `custoMicros`: milionésimos de real, inteiro |
| Acertos | Contagem de questões. Não existe nota, conceito nem pontuação em campo nenhum (D46, D55) |
| Erro | `ErrorCode` com mensagem em `MENSAGENS_DE_ERRO`. O erro da execução também é um `ErrorCode` |
| Listagem | Paginada: `?pagina=<id>&limite=` (`paginationQuerySchema`); as conversas, `?antes=<id>&limite=` |

Códigos de erro novos (`packages/shared/src/errors/`, com status em `packages/nucleo/src/erro/erro-de-dominio.ts`):
`MATERIAL_SEM_LICENCA` 422 · `FUNCAO_SUSPENSA` 409 · `LIMITE_DIARIO_DO_TUTOR` 429 · `PACOTE_DO_TUTOR_ESGOTADO` 429 ·
`TUTOR_PAUSADO_EM_AVALIACAO` 409 · `DESTAQUES_NAO_ABERTOS` 409 · `ENTREGA_JA_DECIDIDA` 409 ·
`VERSAO_ADAPTADA_NAO_APROVADA` 409 · `ATIVIDADE_ENCERRADA` 409 · `MATERIAL_INSUFICIENTE` 422 · `IA_INDISPONIVEL` 503 ·
`IA_TEMPO_ESGOTADO` 503 · `IA_SAIDA_INVALIDA` 502 · `IA_ORCAMENTO_ESGOTADO` 429 · `IA_ENTRADA_INVALIDA` 500 ·
`EXECUCAO_INTERROMPIDA` 503.

## 3. Rotas (todas sob `/v1`)

Célula é `recurso.acao` da `MATRIZ`. Alcance: C coordenação, P professor, A aluno; `un` unidade, `tv` turma vinculada,
`pr` próprio, `ag` agregado, `na` nominal auditado. Quem não aparece é `nunca`, e a rede é `nunca` em todas.

### Material (M) — `material/material.ts`

| Rota | Entrada | Saída | Célula | Erros próprios | Auditoria |
|---|---|---|---|---|---|
| `POST /materiais` (multipart, `arquivo` até `MAXIMO_DE_BYTES_DO_MATERIAL`) | `enviarMaterialRequestSchema` | 201 `materialResponseSchema` | `material.enviar` C `un` | `MATERIAL_SEM_LICENCA`, `CONFLITO` (mesmo arquivo) | `material.enviado`, ou `material.recusado` |
| `GET /materiais` | `materiaisQuerySchema` | `listaDeMateriaisResponseSchema` | `material.listar` C `un`, P `tv` | | |
| `GET /materiais/:id` | | `materialResponseSchema` | `material.ler` C `un`, P `tv` | | |
| `DELETE /materiais/:id` | | 204 | `material.excluir` C `un` | | `material.excluido` |
| `GET /materiais/busca` | `buscaDeMaterialQuerySchema` | `buscaDeMaterialResponseSchema` | `material.buscar` C `un`, P `tv` | | |

A recusa usa `motivoDaRecusaDoMaterial(pedido)` **antes de abrir o arquivo**, não grava `material` e grava
`material.recusado` (entidade `disciplina`). Para o professor, `tv` em material quer dizer: disciplina em que ele tem
vínculo confirmado. A busca é `busca @@ websearch_to_tsquery('portuguese', q)`, sempre com `escola_id` do contexto, só em
material `pronto` e não excluído.

### Time, Assistente, ferramentas e artefato (P, W) — `time/`, `assistente/`

| Rota | Entrada | Saída | Célula | Erros próprios | Auditoria |
|---|---|---|---|---|---|
| `GET /time` | | `timeResponseSchema` (`montarTime(suspensas)`) | `time.ler` C `un`, P `un` | | |
| `GET /assistente/conversa` | `conversaDoAssistenteQuerySchema` | `conversaDoAssistenteResponseSchema` | `assistente.ler_conversa` P `pr` | | |
| `POST /assistente/mensagens` | `mensagemAoAssistenteRequestSchema` (`texto`, `turmaId`, `disciplinaId`, `chaveEnvio` e, opcional, `resposta: 'so_conversar'`) | 202 | `assistente.enviar_mensagem` P `pr` | `FUNCAO_SUSPENSA`, `LIMITE_EXCEDIDO` | |
| `GET /execucoes/:id` | | `execucaoResponseSchema` | `execucao.ler` C, P, A `pr` | | |
| `POST /ferramentas/:ferramenta/gerar` | `parametroFerramentaSchema`, `gerarComFerramentaRequestSchema` | 202 | `ferramenta.gerar` P `tv` | `FUNCAO_SUSPENSA`; na execução, `MATERIAL_INSUFICIENTE` | |
| `GET /artefatos` | `artefatosQuerySchema` | `listaDeArtefatosResponseSchema` | `artefato.listar` P `tv` | | |
| `GET /artefatos/:id` | | `artefatoResponseSchema` | `artefato.ler` P `tv` | | |
| `PATCH /artefatos/:id` | `renomearArtefatoRequestSchema` | `artefatoResponseSchema` | `artefato.renomear` P `tv` | `CONFLITO` (versão adaptada com a entrega já decidida) | |
| `GET /artefatos/:id/pdf` | | binário, `Content-Disposition: attachment` | `artefato.exportar` P `tv` | `VERSAO_ADAPTADA_NAO_APROVADA` (versão adaptada rejeitada); pendente sai como rascunho marcado, `rascunho-….pdf` | nenhuma (ver abaixo) |
| `POST /artefatos/:id/adaptar` | `adaptarArtefatoRequestSchema` | 202 | `artefato.adaptar` P `tv` | `FUNCAO_SUSPENSA`, `CONFLITO` (não é atividade, ou já é versão adaptada) | |
| `GET /entregas` | `entregasQuerySchema` | `listaDeEntregasResponseSchema` | `entrega.listar` P `tv` | | |
| `POST /entregas/:id/decidir` | `decidirEntregaRequestSchema` | `entregaResponseSchema` | `entrega.decidir` P `tv` | `ENTREGA_JA_DECIDIDA`; `ENTRADA_INVALIDA` ao aprovar lote por aqui | `entrega.decidida` |

O conteúdo do artefato é `conteudoDoArtefatoSchema` (`assistente/conteudo.ts`): toda questão e todo plano citam material
e página. O catálogo de habilidades é `habilidadesDaDisciplina(nome, etapa)` (`assistente/habilidades.ts`): códigos nossos,
não da BNCC. A resposta do Assistente é `conteudoDaMensagemDoAgenteSchema`: texto com citações, ou a **proposta de
ferramenta** (a pergunta da D18).

**As duas opções da pergunta têm rota.** "Abrir a ferramenta" é `POST /ferramentas/:ferramenta/gerar`, com os parâmetros
da proposta. "Só conversar" é o `POST /assistente/mensagens` seguinte com `resposta: 'so_conversar'` (`RESPOSTAS_A_PROPOSTA`,
lista fechada; o `texto` é a fala que a tela mostra): o Assistente responde **sempre em texto**, sobre o último pedido do
professor, com a página citada quando usa o material, e não propõe ferramenta de novo. A marca fica em
`execucao_agente.entrada` (`{ tarefa: 'propor_ferramenta', resposta }`), nunca o texto; na tarefa `propor_ferramenta` ela
é `semProposta`. Sem a marca, nada muda.

**O PDF do artefato não gera auditoria**, e isso é decisão, não esquecimento. A regra 20, item 10, pede auditoria de
exportação porque exportação costuma levar dado de pessoa para fora do sistema. Este PDF não leva: tem as questões, o
gabarito e as páginas citadas do material da escola, sem aluno, sem lista de turma e sem resultado. Quem exporta é o
professor dono do artefato (D63). E registrar cada exportação criaria, na auditoria que a coordenação consulta, uma
trilha nominal de quanto cada professor usa a ferramenta, que a D64 proíbe. Se um dia o artefato exportado levar dado de
aluno (a prova com nome, o diagnóstico), a exportação ganha ação de auditoria antes de existir.

### Atividade e correção (A, W) — `atividade/`

| Rota | Entrada | Saída | Célula | Erros próprios | Auditoria |
|---|---|---|---|---|---|
| `POST /atividades-aplicadas` | `aplicarAtividadeRequestSchema` | 201 `atividadeAplicadaResponseSchema` | `atividade_aplicada.aplicar` P `tv` | `VERSAO_ADAPTADA_NAO_APROVADA`, `CONFLITO` (já aberta) | `atividade.aplicada` |
| `GET /atividades-aplicadas` | `atividadesAplicadasQuerySchema` | `listaDeAtividadesAplicadasResponseSchema` | `atividade_aplicada.listar` P `tv` | | |
| `POST /atividades-aplicadas/:id/encerrar` | `emptyBodyRequestSchema` | `atividadeEncerradaResponseSchema` | `atividade_aplicada.encerrar` P `tv` | | |
| `GET /minhas-atividades` | `minhasAtividadesQuerySchema` | `minhasAtividadesResponseSchema` | `minha_atividade.listar` A `pr` | | |
| `GET /atividades-aplicadas/:id/prova` | | `provaResponseSchema` (`questoesDaProva`) | `minha_atividade.ler_prova` A `pr` | | |
| `PUT /atividades-aplicadas/:id/respostas/:questao` | `numeroDaQuestaoSchema`, `responderQuestaoRequestSchema` | `questaoSalvaResponseSchema` | `minha_atividade.responder` A `pr` | `ATIVIDADE_ENCERRADA` | |
| `POST /atividades-aplicadas/:id/enviar` | `emptyBodyRequestSchema` | `atividadeEnviadaResponseSchema` | `minha_atividade.enviar` A `pr` | | |
| `GET /atividades-aplicadas/:id/meu-diagnostico` | | `meuDiagnosticoResponseSchema` | `minha_atividade.ler_diagnostico` A `pr` | `NAO_ENCONTRADO` até o lote ser aprovado | |
| `GET /atividades-aplicadas/:id/correcao` | | `correcaoDoLoteResponseSchema` | `correcao.ler` P `tv` | | |
| `POST /atividades-aplicadas/:id/correcao/destaques/:alunoId/abrir` | `emptyBodyRequestSchema` | `destaqueAbertoResponseSchema` | `correcao.abrir_destaque` P `tv` | | `correcao.destaque_aberto` |
| `POST /entregas/:id/aprovar-lote` | `emptyBodyRequestSchema` | `loteAprovadoResponseSchema` | `entrega.aprovar_lote` P `tv` | `DESTAQUES_NAO_ABERTOS`, `ENTREGA_JA_DECIDIDA` | `lote.aprovado` |
| `GET /turmas/:id/desempenho` | `desempenhoDaTurmaQuerySchema` | `desempenhoDaTurmaResponseSchema` | `desempenho_da_turma.ler` P `tv`, C `na` | `ENTRADA_INVALIDA` (coordenação sem `finalidade`) | `turma.desempenho_lido` (só a coordenação) |

A prova do aluno é montada por `questoesDaProva(conteudo)`: copia número, enunciado e alternativas, e nada mais.

### Tutor e sinais (T, W) — `tutor/`

| Rota | Entrada | Saída | Célula | Erros próprios | Auditoria |
|---|---|---|---|---|---|
| `POST /tutor/mensagens` | `mensagemAoTutorRequestSchema` | 202 | `tutor.enviar_mensagem` A `pr` | `TUTOR_PAUSADO_EM_AVALIACAO`, `LIMITE_DIARIO_DO_TUTOR`, `PACOTE_DO_TUTOR_ESGOTADO`, `FUNCAO_SUSPENSA` | |
| `GET /tutor/conversa` | `conversaDoTutorQuerySchema` | `conversaDoTutorResponseSchema` | `tutor.ler_conversa` A `pr` | | |
| `GET /tutor/memoria` | | `memoriaDoTutorResponseSchema` | `tutor.ler_memoria` A `pr` | | |
| `GET /sinais` | `sinaisQuerySchema` | `sinaisResponseSchema` | `sinal.ler` P `tv` | | |
| `GET /tutor/uso` | `usoDoTutorQuerySchema` | `usoDoTutorResponseSchema` | `uso_do_tutor.ler` P `tv` | | |

**`GET /tutor/uso?turmaId=` é o que faz não existir uso do Tutor invisível ao professor** (D8, D47; regra 70, item 4). O
sinal só nasce em quatro situações; o aluno com turnos todos comuns não gera sinal, e aparece aqui. Por aluno que já
trocou com o Tutor no ano letivo, em ordem de nome: `trocasHoje`, `ultimaTrocaEm` e `ultimaReferencia` (a atividade
aplicada e a questão, ou o material e a página, da última troca), mais o freio do dia e a soma da turma no mês contra o
pacote. **Sem conteúdo de conversa, sem tempo ocioso, sem histórico de navegação e sem lista de quem não usou** (regra 70,
item 7): o schema é estrito e recusa esses campos. Troca é a mensagem do aluno em `mensagem_tutor`; o índice
`mensagem_tutor_trocas_idx` serve a consulta. A coordenação e o aluno não leem (`nunca`). Para a referência existir, o
`POST /tutor/mensagens` aceita `questao` (só com `atividadeAplicadaId`) e `pagina` (só com `materialId`), que a tela do
aluno manda quando sabe. Nesta fatia o professor não lê o texto da conversa: nenhuma rota o entrega.

**A ordem das conferências do `POST /tutor/mensagens`**, todas no servidor: (1) o aluno alcança a atividade e o material
que referencia, senão `NAO_ENCONTRADO`; (2) **assunto pessoal delicado** (D36); (3) atividade avaliativa aberta na turma,
`TUTOR_PAUSADO_EM_AVALIACAO`; (4) o freio do dia e o pacote do mês; (5) função suspensa. As recusas de 3, 4 e 5 não
gravam mensagem nem contam troca. **O assunto delicado passa na frente de tudo: da avaliação aberta, do freio, do pacote
e da suspensão.** O aluno em prova, o aluno no limite do dia, a turma com o pacote esgotado e a escola com o Tutor ou os
sinais suspensos ainda recebem `202`, a mensagem fixa (`tipo: 'assunto_delicado'`, com o 188 em risco à vida) e o sinal
`atencao_humana` para os professores da turma, sem referência e sem conteúdo. A trava da avaliação existe para o Tutor
não ajudar na prova, e a mensagem fixa não ajuda em prova nenhuma. Esse turno não chama modelo, a execução já volta
`concluida`, e a pergunta fica na conversa sem a questão, o material e a página. Por isso a tela nos estados `avaliacao`
e `limite` não trava a caixa de texto.

**Sinais e uso são por turma e por disciplina**, e o recorte sai do vínculo de quem pergunta (a consulta só tem
`turmaId`). O sinal e a troca que nasceram de uma atividade são da disciplina do artefato dela; os de material, da
disciplina do material; e só o professor com vínculo confirmado **naquela disciplina, naquela turma**, os lê: a professora
de Física do 2ºB não vê o que nasceu numa atividade de Química do 2ºB. O que não tem disciplina chega a **todo professor
com vínculo confirmado na turma**: o sinal `atencao_humana`, que não tem referência nenhuma, e a troca feita fora de
atividade e de material (senão ela seria uso invisível a todos). Em `GET /tutor/uso`, a lista de alunos, `ultimaTrocaEm`
e `ultimaReferencia` são da disciplina de quem pergunta; **`trocasHoje`, `limiteDoDia`, `trocasDaTurmaNoMes` e
`pacoteDaTurmaNoMes` são os do freio**, somando todas as disciplinas, para a tela nunca mostrar um número diferente do
que o freio conta.

**Os limiares dos sinais de trabalho** (`apps/api/src/tutor/sinais-do-turno.ts`; decisão de produto em aberto, ponto de
partida da fatia). A regra só lê onde o aluno pediu ajuda (a questão da atividade, ou a página do material) e o dia de
uso: sem texto, sem relógio e sem navegação. Sessão é o trecho de turnos seguidos na mesma referência, no mesmo dia.
`travou`: `TROCAS_SEGUIDAS_PARA_TRAVOU` = 4 trocas seguidas na mesma questão ou página; nasce uma vez, na quarta.
`duvida_repetida`: o turno abre uma sessão nova numa questão ou página em que o aluno já tinha pedido ajuda (saiu e
voltou, ou voltou em outro dia), olhando os últimos `TURNOS_QUE_A_REGRA_OLHA` = 200 turnos que o Tutor respondeu. Turno
sem questão e sem página não gera nenhum dos dois. `resposta_pronta` não tem limiar: é a classificação da regra da
tarefa, e só com questão em andamento.

### Governança e Analista (G) — `governanca/`

| Rota | Entrada | Saída | Célula | Erros próprios | Auditoria |
|---|---|---|---|---|---|
| `GET /governanca/resumo` | `resumoDaGovernancaQuerySchema` | `resumoDaGovernancaResponseSchema` | `governanca.ler_resumo` C `ag` | | |
| `GET /governanca/funcoes` | | `funcoesDaGovernancaResponseSchema` | `governanca.ler_funcoes` C `un` | | |
| `POST /governanca/funcoes/:chave/suspender` | `chaveDeFuncaoSchema`, `suspenderFuncaoRequestSchema` | `funcaoDaGovernancaResponseSchema` | `governanca.suspender_funcao` C `un` | | `funcao.suspensa` |
| `POST /governanca/funcoes/:chave/retomar` | `chaveDeFuncaoSchema`, `emptyBodyRequestSchema` | `funcaoDaGovernancaResponseSchema` | `governanca.retomar_funcao` C `un` | `NAO_ENCONTRADO` (sem suspensão vigente) | `funcao.retomada` |
| `GET /governanca/consumo` | `consumoQuerySchema` | `consumoResponseSchema` | `governanca.ler_consumo` C `ag` | | |
| `GET /analista/resumo` | | `resumoDoAnalistaResponseSchema` | `analista.ler_resumo` C `ag` | | |
| `POST /analista/gerar` | `gerarResumoDoAnalistaRequestSchema` | 202 | `analista.gerar` C `un` | `FUNCAO_SUSPENSA` | |
| `GET /analista/nominal` | `analistaNominalQuerySchema` | `analistaNominalResponseSchema` | `analista.ler_nominal` C `na` | `ENTRADA_INVALIDA` (sem `finalidade`) | `analista.nominal_lido` |

## 4. Tabelas (migrations 0022 e 0023)

Todas têm `id uuid` com `uuidv7()` e `escola_id` com FK. "FK da turma" é `(escola_id, ano_letivo_id, turma_id)`; "FK com a
escola" é `(escola_id, x_id)`. **Toda FK que não é a da própria escola é composta e começa por `escola_id`**, e leva
`ano_letivo_id` quando as duas pontas têm ano: nada aponta para objeto de outra escola nem de outro ano letivo, e o teste
de catálogo confere as 44 FKs, uma a uma.

"Gatilho de autor" confere a pessoa na gravação e **não é FK**, então o id fica depois da eliminação dela. Em
`decidida_por`, `aplicada_por`, `confirmada_por` e `destaque_aberto_por` é a função `exigir_equipe_da_escola` (0023):
**professor ou coordenação da escola**, nunca aluno. Em `suspensa_por` e `retomada_por` é a `exigir_usuario_da_escola` da
0013: usuário da escola. Quem pode de fato é a `MATRIZ` que diz; o banco só impede o id de fora e o de aluno.

O que a 0023 mudou, sem tirar nem renomear coluna:

- **Turma.** A entrega, a mensagem e o sinal do Tutor apontam para a atividade aplicada **com a turma**
  (`(escola_id, ano_letivo_id, turma_id, atividade_aplicada_id)`), e a entrega da versão adaptada, para o artefato com a
  turma: uma entrega da turma X não aponta para a aplicação da turma Y. A versão adaptada é da turma do original.
- **Ano letivo.** As FKs para `artefato` e para `execucao_agente` levam o ano: versão adaptada, aplicação, entrega,
  mensagem, sinal e resumo não cruzam de ano na mesma escola. Só `consumo_ia`, que não tem ano, aponta para a execução
  pela escola.
- **Validação contra as correções** (D56): gatilho na `validacao_do_lote` (abaixo).
- **Papel do autor**: os quatro gatilhos de autoria passaram a exigir professor ou coordenação.
- **`consumo_ia`**: `entrada` e `saida` nulas também na tarefa `propor_ferramenta`.
- **`mensagem_tutor`**: colunas `questao` e `pagina`.
- O gatilho do lote aprovado relê a entrega pela escola e pelo id.

| Tabela | Colunas | Restrições que importam |
|---|---|---|
| `material` | `disciplina_id`, `titulo`, `titularidade`, `licenciante?`, `licenca`, `declaracao`, `sha256`, `tamanho_bytes`, `paginas?`, `estado` (`processando`), `falha?`, `enviado_por?`, `enviado_em`, `excluido_por?`, `excluido_em?` | Check `declaracao` verdadeira e `licenca` nas quatro: não existe material sem licença. `licenciante` só, e sempre, em `terceiro_com_licenca`. Único parcial `(escola_id, sha256)` entre não excluídos e não falhos. Sem `ano_letivo_id`. Exclusão lógica; quem exclui apaga os `trecho` na mesma transação |
| `trecho` | `disciplina_id`, `material_id`, `pagina`, `texto`, `busca` (gerada, `to_tsvector('portuguese', texto)`) | Um por página: único `(escola_id, material_id, pagina)`. GIN `(escola_id, disciplina_id, busca)`. FK `(escola_id, disciplina_id, material_id)`, `cascade` |
| `execucao_agente` | `ano_letivo_id`, `funcao`, `tarefa`, `solicitada_por?`, `chave_envio`, `estado` (`pendente`), `entrada`, `resultado?`, `erro?`, `criada_em`, `iniciada_em?`, `concluida_em?` | Único `(escola_id, chave_envio)`. `unique (escola_id, ano_letivo_id, id)` é o alvo do que ela produz. Check prende `tarefa` à `funcao`. `resultado` só na `concluida` e é só referência (`resultadoGravadoSchema`); `erro` só na `falhou`, em formato de código; `concluida_em` nas duas. `rodando` exige `iniciada_em`. Índice parcial das abertas `(escola_id, estado, criada_em)` |
| `consumo_ia` | `aluno_id?`, `execucao_id?`, `tarefa`, `funcao`, `perfil`, `origem`, `modelo`, `prompt_versao`, `tokens_de_entrada`, `tokens_de_saida`, `custo_micros` (0), `duracao_ms`, `envio_externo`, `tentativas`, `estado`, `codigo_de_erro?`, `entrada?`, `saida?`, `em` | **Sem coluna de usuário** (D64). `aluno_id` só nas funções do Tutor. `entrada` e `saida` **nulas** nas funções do Tutor e na tarefa `propor_ferramenta` (check `consumo_ia_sem_conversa_de_pessoa`): conversa de aluno e de professor não se copia. Índices `(escola_id, funcao, em)` e parcial `(escola_id, aluno_id, em)`. Sem `ano_letivo_id` |
| `thread_agente` | `ano_letivo_id`, `usuario_id`, `agente`, `criada_em` | Única por `(escola_id, ano_letivo_id, usuario_id, agente)`. Dono `cascade` |
| `mensagem_agente` | `ano_letivo_id`, `thread_id`, `execucao_id`, `autor`, `conteudo`, `turma_id?`, `disciplina_id?`, `criada_em` | Única por `(escola_id, execucao_id, autor)`. `turma_id` e `disciplina_id` só, e sempre, na mensagem do `usuario`. Só o `agente` propõe ferramenta |
| `artefato` | `ano_letivo_id`, `turma_id`, `disciplina_id`, `tipo`, `titulo`, `conteudo`, `origem_id?`, `execucao_id?`, `criado_por?`, `criado_em`, `atualizado_em` | Versão adaptada é a que tem `origem_id`, na **mesma turma e no mesmo ano** do original (FK). Check: `conteudo.adaptacao` só nela, com `tipos` de lista fechada e sem outra chave. Único parcial `(escola_id, execucao_id)`. `conteudo` não muda depois de gravado |
| `entrega` | `ano_letivo_id`, `turma_id`, `funcao`, `tipo`, `artefato_id?`, `atividade_aplicada_id?`, `execucao_id?`, `estado` (`pendente`), `decidida_por?`, `decidida_em?`, `justificativa?`, `criada_em` | Aprovada ou rejeitada ⇔ `decidida_por` e `decidida_em`. Rejeitada ⇔ `justificativa` (8 a 500). `versao_adaptada` ⇔ `artefato_id`; `lote_de_correcao` ⇔ `atividade_aplicada_id`. Uma por versão adaptada; um lote não rejeitado por aplicação. **Lote só fica `aprovada` com `validacao_do_lote`** (gatilho adiado para o commit). **`turma_id` é a do artefato ou da aplicação** (FK com a turma). Gatilho de autor em `decidida_por`. Suspender a função não mexe na entrega |
| `atividade_aplicada` | `ano_letivo_id`, `turma_id`, `artefato_id`, `avaliativa`, `estado` (`aberta`), `aplicada_por`, `aplicada_em`, `encerrada_em?` | Gatilho: só `atividade_objetiva`, e versão adaptada **só com entrega `aprovada`**. Única aberta por `(escola_id, turma_id, artefato_id)`. O artefato é do mesmo ano, e pode ser de outra turma. Gatilho de autor em `aplicada_por` |
| `tentativa_atividade` | `ano_letivo_id`, `atividade_aplicada_id`, `aluno_id`, `iniciada_em`, `enviada_em?` | Única por `(escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id)`. Aluno `cascade` |
| `resposta_atividade` | `ano_letivo_id`, `atividade_aplicada_id`, `aluno_id`, `questao`, `alternativa`, `respondida_em` | Única por tentativa e `questao`: é o alvo do `on conflict do update`. FK para a tentativa, `cascade`. Em branco não tem linha |
| `correcao` | `ano_letivo_id`, `entrega_id`, `atividade_aplicada_id`, `aluno_id`, `acertos`, `total`, `em_branco`, `por_habilidade`, `destaques` (`text[]`), `destaque_aberto_em?`, `destaque_aberto_por?`, `corrigida_em` | Única por `(escola_id, entrega_id, aluno_id)`. Só de entrega que é lote. `destaques` de lista fechada; só destaque se abre. Gatilho de autor em `destaque_aberto_por`. Some com a tentativa |
| `validacao_do_lote` | `ano_letivo_id`, `entrega_id`, `atividade_aplicada_id`, `apresentado`, `aberto`, `confirmada_por`, `confirmada_em` | Uma por lote. Check: todo destaque de `apresentado` está em `aberto`. **Gatilho (0023): toda `correcao` do lote com destaque está aberta (`destaque_aberto_em`) e consta de `apresentado.destaques`**; sem isso, 23514 (`validacao_do_lote_destaques_do_lote_abertos` ou `…_apresentados`). Gatilho de autor em `confirmada_por`. É cópia: fica depois da eliminação do aluno |
| `mensagem_tutor` | `ano_letivo_id`, `turma_id`, `aluno_id`, `execucao_id`, `atividade_aplicada_id?`, `questao?`, `material_id?`, `pagina?`, `autor`, `tipo` (`texto`), `texto`, `citacoes?`, `criada_em` | Única por `(escola_id, execucao_id, autor)`. `assunto_delicado` e `citacoes` só do `tutor`. `questao` só com a atividade, `pagina` só com o material, e as duas só na mensagem do aluno. A atividade é da turma da mensagem (FK). Aluno `cascade`. Índices `(escola_id, aluno_id, id)` e parcial `(escola_id, turma_id, criada_em, aluno_id)` das do aluno |
| `sinal_tutor` | `ano_letivo_id`, `turma_id`, `aluno_id`, `execucao_id?`, `tipo`, `atividade_aplicada_id?`, `questao?`, `material_id?`, `pagina?`, `criado_em` | **Sem coluna de texto.** `atencao_humana` com qualquer referência é recusado. A atividade é da turma do sinal (FK). Único parcial `(escola_id, execucao_id, tipo)`. Aluno `cascade` |
| `suspensao_de_funcao` | `funcao`, `motivo?`, `suspensa_por`, `suspensa_em`, `retomada_por?`, `retomada_em?` | Único parcial `(escola_id, funcao)` entre as vigentes (`retomada_em is null`): é a consulta "está suspensa agora?". Sem `ano_letivo_id` |
| `resumo_do_analista` | `ano_letivo_id`, `execucao_id?`, `conteudo`, `gerado_em` | `conteudo` é `conteudoDoResumoDoAnalistaSchema`: agregado, sem pessoa e sem texto livre. Um por execução |

`configuracao_operacional_escola` ganhou `tutor_trocas_por_dia` e `tutor_trocas_por_mes`, nulas: nulo vale
`TROCAS_POR_DIA_PADRAO_DO_TUTOR` (60) e `TROCAS_POR_MES_PADRAO_DO_TUTOR` (300).

O que o `jsonb` de cada coluna guarda: `artefato.conteudo` → `conteudoDoArtefatoSchema` · `mensagem_agente.conteudo` →
`conteudoDaMensagemDoUsuarioSchema` ou `conteudoDaMensagemDoAgenteSchema` · `execucao_agente.entrada` →
`execucaoInputSchema` · `execucao_agente.resultado` → `resultadoGravadoSchema` · `correcao.por_habilidade` →
`diagnosticoGravadoSchema` · `validacao_do_lote.apresentado` → `loteApresentadoSchema` · `validacao_do_lote.aberto` →
`destaquesAbertosSchema` · `mensagem_tutor.citacoes` → `Citacao[]` · `resumo_do_analista.conteudo` →
`conteudoDoResumoDoAnalistaSchema`. Valide na gravação e na leitura.

## 5. Decisões de modelagem

1. **A chave de idempotência se chama `chaveEnvio`** (`chave_envio`), como na reivindicação da A1. É a `chave` da `ExecucaoAgendada` da camada de IA.
2. **A execução guarda referência, não texto.** `resultado` tem só ids; a mensagem do Assistente e a do Tutor ficam nas tabelas delas, e cada linha produzida aponta para a execução por `execucao_id`, com índice único: reexecutar não duplica (D49).
3. **`tarefa` usa os nomes do catálogo da camada de IA** (`TAREFAS_DE_IA`), na execução e no consumo. O banco prende a tarefa à função, e é pela função que a suspensão vale.
4. **O erro da execução é um `ErrorCode`.** Os da camada de IA entraram no catálogo; a tela mostra `MENSAGENS_DE_ERRO[erro]`.
5. **`consumo_ia` não tem usuário** (D64). O aluno entra só nas funções do Tutor. `entrada` e `saida` ficam nulas onde a chamada leva conversa de pessoa: no Tutor (o texto fica só em `mensagem_tutor`) e em `propor_ferramenta` (a mensagem do professor fica só em `mensagem_agente`). Nas outras tarefas vai o tema, que é texto livre do professor: o schema estrito barra campo, não o que está escrito.
6. **O freio do dia conta `consumo_ia` do aluno; o pacote do mês e o uso por turma contam `mensagem_tutor`.** Uma linha por troca nos dois. Os limites são configuração da escola (D38, D41).
7. **Aprovar o lote exige a validação, no banco, e a validação exige os destaques do lote abertos.** Gatilho adiado na `entrega`; na `validacao_do_lote`, o check do registro e o gatilho que confere as `correcao` do lote. A regra não depende de o serviço lembrar (D56).
8. **A versão adaptada só chega à turma aprovada, no banco.** Gatilho na `atividade_aplicada` (regra 70, item 3).
9. **Aplicar é a aprovação registrada da atividade original.** `aplicada_por` é obrigatório e auditado.
10. **Quem aprovou, aplicou, validou, abriu e suspendeu não é FK.** O id fica depois da eliminação da pessoa, como na auditoria. Nos quatro primeiros, o gatilho exige professor ou coordenação. O que é do aluno (tentativa, resposta, correção, conversa, sinal) sai com ele, por `cascade`.
11. **A correção pendura na tentativa.** Quem nunca abriu a atividade não tem correção nem destaque: faltar não é ficar em branco.
12. **O destaque é por aluno** (a rota é `/destaques/:alunoId/abrir`). O erro concentrado numa questão aparece em `resumo.porQuestao`, com a contagem por alternativa.
13. **O desempenho da turma, para a coordenação, é `nominal_auditado`**, com `finalidade`. Ver a seção 7.
14. **O resumo do Analista não tem texto livre.** Alerta é tipo, número, referência e hipótese de lista fechada (`HIPOTESES_DO_ANALISTA`); a tela monta a frase. Recorte com menos de dois professores é recusado pelo schema e aparece só em `recortesNominais`, sem número.
15. **A governança não mostra turma nem quem decidiu.** O item tem função, tipo, estado, datas e a série.
16. **O motivo da suspensão é opcional e de lista fechada.** O mockup não tem campo de motivo; texto livre ali guardaria nome.
17. **O catálogo de habilidades tem códigos nossos** (`QUI.EM.05`), sem afirmar correspondência com a BNCC.
18. **Material não tem ano letivo**, e a recusa por licença não grava `material` (decisão do orquestrador).
19. **`btree_gin`** entrou para o índice de busca começar pela escola (regra 80, item 8).
20. **O uso do Tutor por turma é rota própria** (`GET /tutor/uso`), e não um quinto tipo de sinal: o sinal é fato pontual; o uso é a lista de quem usou. Vem de `mensagem_tutor`, sem tabela nova.
21. **A entrega, a mensagem e o sinal do Tutor são da turma do que apontam**, e nada cruza de ano letivo na mesma escola: FK com a turma e com o ano (0023).
22. **Suspender uma função não mexe no que ela produziu.** A entrega pendente continua decidível; só execução nova é recusada.
23. **O nominal do Analista não mostra entregas por turma nem `atencao_humana`.** Entrega por turma ao lado do professor nomeado é adoção nominal (D64); atenção humana por turma aponta poucos alunos (D36).
24. **O PDF do artefato não tem ação de auditoria** (seção 3): não leva dado de pessoa, e auditá-lo criaria trilha nominal de uso por professor.

## 6. O que o schema não segura, e cada pacote precisa garantir com teste

- **M**: conferir a disciplina antes da recusa; nunca logar título, licenciante nem nome de arquivo; apagar os `trecho` ao excluir.
- **P**: gravar a execução e a mensagem do professor na mesma transação; relê-la pela chave no 23505 e conferir que é de quem pede; conferir a suspensão antes de gravar; versão adaptada nasce com a `entrega` na mesma transação do artefato; o `PATCH` atualiza a coluna `titulo` e o `conteudo.titulo` juntos; no `decidir`, `update … where estado = 'pendente'`.
- **A**: a prova sai de `questoesDaProva`; `meu-diagnostico` junta a entrega com `estado = 'aprovada'` e responde como inexistente sem ela; `PUT` de resposta recusa depois do envio e do encerramento; `aprovar-lote` grava a validação e a aprovação na mesma transação, com o `apresentado` **igual ao que a rota de correção mostrou** (o banco confere que os destaques do lote estão abertos e apresentados, não que o resumo é o da tela); quem decide, aplica, valida e abre destaque é **professor com vínculo confirmado na turma** (o banco só recusa aluno e gente de outra escola); desempenho só de lote aprovado.
- **T**: o Tutor **não usa nem diz** o resultado de correção ainda não aprovada (memória só de lote aprovado e de sinais); `atencao_humana` sem referência; nunca copiar texto do aluno para sinal, execução ou consumo; `pg_advisory_xact_lock` do aluno antes de contar o freio; avaliativa aberta trava no servidor; gravar `questao` e `pagina` na mensagem do aluno; `GET /tutor/uso` só para o professor com vínculo confirmado na turma, em ordem de nome, com teste de que o aluno sem sinal aparece e de que nenhum texto de conversa sai.
- **G**: nenhuma consulta agrupa, filtra ou ordena por professor; `nominal` e desempenho gravam auditoria a cada leitura; recorte com um professor só vai para `recortesNominais`; o resumo é validado pelo schema antes de gravar.
- **Camada de IA**: o registro de consumo precisa mandar `entrada` e `saida` nulas quando a tarefa leva texto livre de pessoa (o turno do Tutor e `propor_ferramenta`); a varredura das interrompidas precisa preencher `concluida_em`; a suspensão é conferida antes de qualquer execução, e não toca entrega já criada.

## 7. Onde este contrato se afasta do plano, e por quê

- **`GET /turmas/:id/desempenho` para a coordenação.** O plano (`docs/mvp-rapido.md`, seção 7) diz "coordenação em agregado". O contrato pede `finalidade` e grava auditoria (`nominal_auditado`): a resposta nomeia alunos (D34), e o desempenho de uma turma numa disciplina é o de um professor só, que a D45 revista trata como nominal. O agregado sem pessoa é o do resumo do Analista.
- **`POST` com `chaveEnvio` no corpo.** O plano lista os corpos sem a chave; a seção 4, item 1, pede idempotência por chave, e ela precisa vir da tela.
- **`licenciante` no envio de material.** O plano lista titularidade, licença e declaração; o material de terceiro precisa dizer de quem é a licença (`docs/modelo-de-dados.md`, "Conteúdo").
- **`GET /tutor/uso`** não está na seção 7 do plano: entrou pela revisão da fase 1, porque a regra 70, item 4, e a D47 dizem que não existe uso do Tutor invisível ao professor, e os quatro sinais não cobrem o aluno com turnos comuns. Com ela, `POST /tutor/mensagens` ganhou `questao` e `pagina`, opcionais.
- **`GET /analista/nominal`** saiu sem as entregas por turma e sem `atencao_humana`, pelos motivos da decisão 23.
- **Glossário.** Atividade aplicada, tentativa, destaque, validação do lote, suspensão de função, trecho e uso do Tutor ficaram sem verbete novo: `docs/glossario.md` não era arquivo do pacote S.
