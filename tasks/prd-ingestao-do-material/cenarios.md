# Cenários de teste — ingestao-do-material

Exigidos pela revisão da spec (`revisao-spec.md`, rodadas 1 a 4). I = integração com Postgres real e relógio injetado ·
U = unidade, ou componente com a API falsa · E = e2e em `chromebook` e `celular`, com axe · P = chamadas em paralelo,
com a ordem forçada · C = carga, fora da esteira. Toda mutação citada deixa o teste vermelho por um caso que rodou e
falhou. Seed e e2e usam licenciante fictício.

## Envio, séries e licença no envio (RF3, RF14, RF16)

- [I] Envio com duas séries: o material aparece na busca de uma turma de cada série (caso de borda "uma apostila serve
  ao 1º e ao 2º ano")
- [I] Sem série, `serieIds: []` ou com repetição (`[S1, S1]`): `ENTRADA_INVALIDA`, nunca 500
- [I] Série inexistente e série da escola B: a mesma resposta (`NAO_ENCONTRADO`), nenhum byte lido, nada no storage
  falso, em `material` nem em `envio_de_material`, e a auditoria sem o id da série da B
- [I] Terceiro sem `licencaId`: `MATERIAL_SEM_LICENCA`; com licença vencida, inexistente ou da escola B: recusado
  **antes de ler o arquivo** (o storage falso sem objeto, o extrator sem chamada), `material.recusado` gravado com o
  motivo e as séries (o motivo: `sem_licenca` do terceiro sem `licencaId`, `licenca_vencida` da vencida ou que só começa
  depois, `licenca_inexistente` da que não existe e da da escola B, que a API responde igual com `NAO_ENCONTRADO`)
- [I] Material próprio, sem licença: entra e aparece na busca
- [I] O objeto e a linha de `envio_de_material` são apagados em toda saída depois do `guardarBytes`: `CONFLITO` (arquivo
  repetido), `LIMITE_EXCEDIDO` reconferido sob a trava, `LICENCA_VENCIDA` reconferida na transação (o storage falso
  encurta a vigência dentro do `guardarBytes`; a recusa grava `material.recusado`), `EDICAO_EM_ANDAMENTO`, commit
  forçado a falhar. Mutação: tirar o apagar do `catch`
- [I] Queda entre o `guardarBytes` e o commit (a transação nunca roda): com 59 min, a varredura não apaga; com 61 min,
  apaga o objeto e a linha; a linha de outra escola roda no contexto dela. `criado_em` e a varredura usam o mesmo
  `Clock`. Mutação: tirar a leitura de `envio_de_material` da varredura
- [I] Storage que estoura o prazo no `guardarBytes` e grava o objeto **depois** do `apagar` do `catch`: 503, nada em
  `material`, a linha de `envio_de_material` fica; com 61 min, a varredura apaga objeto e linha. Mutação: apagar a linha
  no `catch` de falha do `guardarBytes`
- [I] Falha depois do `guardarBytes` (`CONFLITO`) com o `apagar` falhando: a linha fica; a varredura apaga os dois. O mesmo com o `apagar` falhando uma vez na varredura: a linha fica e sai na hora seguinte. Linha sem objeto
  (queda antes do upload): sai sem erro. Falha numa escola não para as outras. Mutação: apagar a linha antes do objeto,
  ou sem conferir o `apagar`
- [I] A varredura apagou a linha de um envio lento: a transação dele não acha a linha, desfaz com 503 e nada fica em
  `material`. Mutação: não conferir o `delete`
- [I] A varredura segurando a linha do envio (apaga o objeto): o envio espera 1 s (`lock_timeout`), desfaz com 503 e não deixa material nem objeto. Lote: com mais alvos que o lote, a execução trata os mais antigos e o resto sai na hora seguinte, nas duas passadas. Mutação: tirar o `lock_timeout`
- [I] O corte e o storage fora do ar: com o `sinal` já abortado nenhum `apagar` é chamado; com o `sinal` abortado durante um `apagar` mudo o job volta, a transação desfaz (a linha fica livre) e nenhum outro alvo é tentado; com o storage fora do ar (3 `FileStorageUnavailableError` seguidos em duas escolas) a passada para e a do objeto que sobrou nem começa; uma chave que falha sempre numa escola só, mesmo em vários alvos, não para a da outra, e o alvo que passa zera a conta (o erro dos casos é o que o `S3FileStorage` lança de fato). Mutação: tirar a leitura do `sinal`, o limite de falhas seguidas, a regra das duas escolas ou o zerar da conta
- [P] A transação de um envio lento com a linha de `envio_de_material` travada; a varredura das 61 min pula a linha e
  não apaga o objeto; o envio confirma e o material fica pronto. Mutação: tirar o `skip locked` (ou o travar)
- [I] `PATCH` de título e séries: a busca de uma turma da série tirada deixa de achar o material; `material.atualizado`
- [I] `PATCH` com série da escola B: `NAO_ENCONTRADO`, igual à inexistente, e as séries não mudam; `serieIds: []` e
  repetidas: `ENTRADA_INVALIDA`
- [I] `PATCH` de séries sobre material com edição em `processando`, e sobre a própria edição: `EDICAO_EM_ANDAMENTO`;
  sobre material excluído ou substituído: `NAO_ENCONTRADO`; o 101º `PATCH` da pessoa e o 301º da escola na hora: 429,
  com "Muitas alterações por agora. Tente de novo às HH:MM", sem gastar o teto de envios
- [I] Sequência: edição B enviada sobre A; `PATCH` de séries em A recusado; B fica pronta com as séries de A; o `PATCH`
  em B, depois, vale. Mutação: deixar o `PATCH` passar com edição em andamento
- [U] Tela de envio: 21 arquivos, o 21º recusado antes de enviar; 20 com um inválido e um repetido: 18 prontos, uma
  falha, um "já enviado"; o título nasce do nome do arquivo e se edita antes de enviar; 429 no meio: os pendentes ficam,
  com "Muitos envios por agora. Os que faltam ficam aqui e continuam às HH:MM" e "12 de 20 enviados"

## Extração no worker e capítulos (RF4, RF13)

- A tabela "3. Falha" da `onda-3b.md`, linha a linha, com o processador no `apps/worker`: Prazo, SIGTERM, Falha final,
  Reprocessar e Descartar (Falha final com as 3 tentativas da definição; Reprocessar com um tipo que a 46.0 aceita; Descartar do PDF: material `falhou`, objeto
  apagado), Chamado, Auditoria, Outra escola (repository e job), PDF duplicado, dá certo ou falha, Exclusão em
  `processando`, Expurgo, Órfão, Órfão em duas escolas. Os comandos recusam `ia.*`, `titular.*` e
  `material.extrair-pdf` (mutação: tirar o tipo da lista), este com "Tentar de novo é envio novo". Os dois comandos recusam o job sem escola (`sistema.*`) com `JobSemEscolaError`, antes de tocar a linha, a fila e a auditoria, até a 5.0 (`techspec.md` §11, linha "3.0"; `3_task.md`, "Divergências resolvidas"); a 5.8 tira a recusa
- [I] `sem_texto`, `arquivo_invalido` e objeto ausente (`extracao_falhou`): `falhou` numa tentativa só, a vaga
  liberada, com o texto da falha na tela
- [P] Material excluído entre o `lerParaExtrair` e o `lerBytes`, com o objeto já apagado: o job conclui sem efeito, sem
  `falhou` no material nem `job.falhos`. Mutação: tratar todo objeto ausente como `falhou`
- [I] Material que já saiu de `processando`, ou excluído, com o objeto ainda no storage: o job nem lê o objeto (a leitura
  conta zero) e o objeto fica. Mutação: tirar `estado` ou `excluido_em` de `lerParaExtrair`
- [P] Excluído enquanto o PDF é extraído, com texto e sem texto: sem trecho, sem `falhou`, métrica `sem_efeito`. Mutação:
  tirar `excluido_em` de `marcarPronto`, ou o `sem_efeito` do `falhou`
- [I] Repository com ids da B no contexto da A: `marcarPronto`, `marcarFalhou`, `marcarObjetoApagado` e `excluidosComObjeto`
  não alcançam nada; `objeto_apagado_em` guarda o primeiro instante, e o cursor do expurgo segue o id
- [I] Expurgo noturno do objeto do excluído (`excluidosComObjeto`): apaga os da A e não os da B, deixa o `processando` vigente,
  espera a noite, e com o storage recusando o objeto fica sem registro e sai na noite seguinte
- [I] `arquivo_ausente` à parte de `extracao_falhou` no log e na métrica
- [I] O desligamento além da graça, ou o prazo, com o extrator que ignora o sinal: na última tentativa o material fecha em `falhou` e
  o objeto sai; com tentativa sobrando, o material segue `processando` e o objeto fica. Mutação: tirar o `quandoAbortar`
- [I] A réplica da fila `pdf` sobe com um PDF por vez, lock de 60 s e verificação de stalled de 20 s (`WORKER_POOL_OPTIONS_BY_QUEUE`), e o lock vale mais que a verificação. Mutação: voltar o stalled ao padrão do BullMQ (30 s)
- [I] O job que nunca devolve (o processo morto), na última tentativa: o job `falhou/EXECUCAO_INTERROMPIDA`, a vaga sai, o material
  segue `processando` com o objeto, e quem o fecha é o "Descartar" da 3.0 (`3_task.md`, "Descartar o PDF")
- [I] Os `UPDATE` da migration `0049`: o `processando` que a API anterior deixou vira `falhou`/`extracao_falhou` (e pode ser enviado de novo),
  todo material antigo sai da varredura do objeto (`objeto_apagado_em = enviado_em`), e o de outra escola não muda
- [I] PDF sem capítulo termina `pronto`, com zero capítulos
- [U] `ChapterReader`: marcador de primeiro nível; dois marcadores na mesma página (fica o primeiro); fora de ordem
  (ordenado); título vazio ("Capítulo N"); título de 300 caracteres (cortado em 200); número acima de int (nulo); linha
  "Capítulo 3" só quando muda o número (cabeçalho corrido não cria um capítulo por página); página de sumário com três
  casamentos, ignorada (com dois, a página começa capítulo); erro do leitor dá zero capítulos; só as 2 primeiras linhas são o
  topo, e a primeira das duas que casa é a lida (limite conhecido: "Unidade 2" corrido na linha 1 e "Capítulo 5" na 2 não
  muda o número, e os capítulos dentro da unidade se perdem; o marcador do PDF não tem esse limite); mais de 2.000 capítulos dá zero
- [U] Amostra fixa, com o pdfjs de verdade: PDFs sintéticos de `tools/demonstracao` com marcador, com destino nomeado,
  com a linha, com cabeçalho corrido, com sumário e sem nada; 100% das páginas no capítulo certo
- [U] Os testes de hoje do `PdfExtractor` (duas colunas, fórmula quebrada) vão com ele ao `packages/core`

## Fila `pdf` (RF15)

- [I] Escola A com 10 PDFs pendentes e vaga 2; o PDF da escola B, enviado depois, conclui antes de a fila da A esvaziar.
  Mutação: ignorar a vaga da fila `pdf`
- [I] O check `job_registro_fila_valida` aceita `pdf`, e o de `vagas` aceita a chave `pdf`
- [U] Configuração do worker e do despachante: `VAGAS_ESCOLA_PDF` vale 2 por padrão e cede a
  `configuracao_operacional_escola.vagas`; o `worker-pdf` lê um PDF por vez e não sobe sem as variáveis do storage
- [I] `infra/test/alertas.int.test.ts`, `pdf-parado`: o primeiro job depois de horas sem PDF não dispara; 300 pendentes
  com extrações terminando (inclusive `falhou`) não dispara; `worker-pdf` parado com job pendente há 16 min dispara. O alerta entra no
  `infra/scripts/ensaio-alertas.ts`

## Edição nova (RF10, RF11)

- [I] Antes de a nova ficar pronta, a busca devolve a antiga; depois, só a nova; nova com falha, a antiga segue
- [I] Edição sobre material `processando`: `EDICAO_EM_ANDAMENTO`; sobre material excluído ou substituído:
  `NAO_ENCONTRADO`; com a licença vencida: `LICENCA_VENCIDA` antes de ler o arquivo
- [I] Edição sobre material `falhou`: `NAO_ENCONTRADO`, como o excluído e o substituído, e nenhum byte chega ao storage
  (só o envio novo vale para o que não ficou pronto)
- [I] Edição sobre material sem série (o de antes da F4 numa escola sem série): 201, e a nova nasce sem série; com a
  licença vencida, `LICENCA_VENCIDA`, e o `material.recusado` guarda `serieIds` vazio
- [I] A nova herda disciplina, séries, titularidade e licença, e aparece nas mesmas séries
- [I] Arquivo igual ao da edição atual: `CONFLITO`
- [I] As `fontes` do artefato antigo trazem título, edição e `substituido`; geração nova não cita a antiga
- [I] Expurgo: a edição antiga além do prazo sai, a nova fica com `substitui_id` nulo, e as `fontes` do artefato antigo
  dizem "material da escola"

## Licença (RF16, RF17)

- [I] Relógio falso: às 23h de São Paulo do último dia o material volta na busca; às 0h01 do dia seguinte, não; depois
  do `PATCH` que estende, volta sem reenviar, também pela página aberta do Tutor
- [I] Licença com `vigente_desde` no futuro: o material não entra na busca até o dia
- [I] `GET /v1/licencas`: uma de cada `situacao` (`vigente`, `vence_em_30_dias`, `vencida`, `futura`), com a contagem de
  materiais
- [I] Rascunho que cita material cuja licença venceu: as `fontes` seguem com título e edição; geração nova não usa o material
- [U] O sino: dias −31 (sem aviso), −30, 0 e +1 avisam; vencida sem material não avisa; depois do `PATCH` da vigência,
  o item some
- [I] Retenção: licença vencida e sem material sai depois do prazo de `material_excluido`; com material vivo, fica;
  licença sem fim nunca sai; a da escola B fica; o coordenador eliminado deixa `registrada_por` nulo
- [I] Retenção: material excluído além do prazo, ainda citado por `mensagem_tutor`, segura a licença, e a categoria
  termina `concluida`; na noite em que a conversa sai, os dois saem. Mutação: tirar o `not exists` da licença
- [I] `licenca.registrada` e `licenca.alterada` sem licenciante, cobertura nem referência (sentinela fora da auditoria)
- [I] (5.8, o que a 3.0 deixou) `ops:reprocessar-job` e `ops:descartar-job` com um job `sistema.*` sem escola: auditados sem escola, com `autor_operador` (a entidade `job` entra no check `auditoria_escola_ou_operacao_global` e em `ENTIDADES_DE_AUDITORIA_SEM_ESCOLA`); o job de escola segue auditado na escola da linha. Mutação: tirar `job` da lista
- [I] (5.8) O `falhou` de `material.extrair-pdf` com 31 dias fica fora do expurgo de jobs, como o de `titular.*`, até o "Descartar"; o de outro tipo sai. Mutação: tirar a exceção do SQL

## Leitura de página por série (RF7, RF8)

- [I] Para cada chamador, material só do 6º e turma do 9º: nada citado. Atividade, plano e adaptação; chat do
  Assistente; turno do Tutor; página aberta do Tutor (`paginasDoMaterial`); material que o aluno abre
  (`materialDaTurma`); rota `GET /v1/materiais/busca`
- [I] O único material da série com licença vencida, ou `processando`: `SEM_MATERIAL_DA_SERIE`, zero chamadas ao
  adaptador falso, nenhuma linha de execução nem de consumo; na ferramenta e no chat, antes do `202`
- [I] Tutor, texto com gatilho de assunto delicado, em três casos: turma sem material da série; página aberta de uma
  edição já substituída; página aberta de material com licença vencida. Nos três, a mensagem fixa da D36 e o sinal
  `atencao_humana`. Mutação: o filtro do material ou a checagem da série antes do encaminhamento
- [I] Os mesmos três casos com pergunta comum: recusada, nada em `mensagem_tutor`, nada no uso nem na sala
- [I] Modo livre, sem atividade nem material: o turno é aceito e o adaptador falso é chamado, sem `SEM_MATERIAL_DA_SERIE`
- [I] Virada do ano: a turma do 9º de 2027 acha o material declarado do 9º em 2026; o aluno que passou do 8º para o 9º
  só acha o do 9º

## Resumo (RF18)

- [I] Material com duas séries conta nas duas; excluído e substituído não contam; `semSerie` conta
- [I] Recusa de 29 dias conta, de 31 não; `MATERIAL_SEM_LICENCA` e `LICENCA_VENCIDA` contam, outro motivo não; por
  disciplina e série

## Corridas

- [P] Duas edições sobre o mesmo material: a primeira presa por `WriteBlockTrigger` antes do commit; a segunda recebe
  `EDICAO_EM_ANDAMENTO`. Mutação: tirar o índice parcial **e** a checagem sob a trava de envios
- [P] Edição C sobre A enquanto a substituição de B (sobre A) está presa: C espera o `for update` e recebe
  `NAO_ENCONTRADO`. Mutação: tirar o `for update`
- [P] Exclusão da nova com a extração parada entre `lerParaExtrair` e a transição (extrator falso numa barreira): a
  antiga fica na busca, a nova sem trechos. Mutação: tirar `excluido_em is null` da transição
- [P] Exclusão da antiga antes do `update … substituido_por`: o `excluido_em` dela não muda e não há `material.substituido`.
  Mutação: tirar `excluido_em is null` do update da substituição
- [P] Dois jobs do mesmo material, o segundo parado entre `lerParaExtrair` e `lerBytes` até o primeiro dar commit e
  apagar o objeto: o material segue `pronto`, os dois `concluido`, sem `job.falhos`. Mutações: conferir só
  `excluido_em`; gravar `falhou` sem `estado = 'processando'`
- [P] Dois jobs da mesma edição em `Promise.all`: capítulos uma vez, `material.substituido` uma vez, os dois `concluido`.
  Mutação: a transição depois dos capítulos
- [P] Envio de terceiro parado depois da leitura `for share` da licença; um `PATCH` que encurta a vigência para ontem
  espera o envio terminar. Mutação: tirar o `for share`
- [P] Dois `PATCH` da mesma licença: a auditoria tem dois "antes" diferentes. Mutação: tirar o `for update`
- [P] Dois `PATCH` de séries do mesmo material: termina com as séries do último, sem 500. Mutação: tirar o `for update`
- [P] Edição parada depois do `guardarBytes`; o `PATCH` de séries em A confirma; a edição continua e nasce com as séries
  do `PATCH`. Mutação: herdar as séries lidas no passo 1
- [P] Edição com a transação aberta sobre A e `PATCH` de séries em A: o `PATCH` espera e recebe `EDICAO_EM_ANDAMENTO`.
  Mutação: tirar o `for update` do `PATCH`

## Migração

- [I] Sobre linhas de antes da F4: cada material ganha todas as séries da escola; o licenciante só de materiais
  excluídos ganha licença com fim na última exclusão; o mesmo `licenciante` duas vezes na
  escola dá uma licença, e na escola B outra; `vigente_desde` é o `enviado_em` mais antigo; escola sem série deixa o
  material em `semSerie`; o código novo grava `licenciante` copiado da licença
- [I] Volta do código: o bloco 1 do runbook fecha o que está `processando` como `falhou` com `extracao_falhou` e
  `processado_em`; depois dele, as linhas que a F4 gravou passam pelo `listaDeMateriaisResponseSchema` da versão anterior
  (nenhum valor novo de `falha`, nada `processando`), e um bloco 1 com outro código de `falha` é recusado pelo banco. O
  `licenciante` preenchido é gravado pelo código novo e provado pela API ("Edição nova", a herança; o envio da 7.0)
- [I] Roll-forward: depois do bloco 2 do runbook, o material que o código anterior gravou sem série ganha todas as da
  escola, o de terceiro sem `licenca_id` é ligado à licença do mesmo `licenciante` (ou a uma nova, "registrada durante a
  volta do código"), e rodar o bloco de novo não duplica nada

## Permissão, escola sem ano letivo e vínculo encerrado

- [I] Professor: `POST /:id/edicoes`, `PATCH /:id` e `GET /resumo` recusados com `NAO_ENCONTRADO` (rotas de objeto) ou
  `PERMISSAO_NEGADA` (coleção), conforme a matriz; `GET`, `POST` e `PATCH /licencas` recusados com `NAO_ENCONTRADO`
  nas três, coleção inclusive: o `PermissaoGuard` responde 404 a toda célula `nunca` (regra 10, item 6), e não existe
  `GET /v1/licencas/:id` (Tech Spec §4). Aluno: o mesmo, em todas as rotas de material e licença
- [I] Escola sem ano letivo em curso: a coordenação usa envio, edição, `PATCH`, resumo e licenças
- [I] Professor com vínculo encerrado na disciplina X e aberto na Y: `GET /materiais?serieId` e as `fontes` só trazem Y
- [I] `contracts.test`: `GET /materiais/:id` do professor sem hash, chave de objeto, quem enviou e licenciante

## Isolamento

Cada um vermelho sem a cláusula de escopo:
- `licencaId` e `serieIds` da B no envio da A: `NAO_ENCONTRADO`, igual ao inexistente
- edição da A sobre material da B `pronto` (próprio, sem licença), da B em `processando` e da B com licença vencida: `NAO_ENCONTRADO` nos três,
  igual ao inexistente, nenhum byte lido
- `PATCH` sobre material da B, e sobre material da B em `processando`; `PATCH` de material da A com `serieIds` da B
- `GET` e `PATCH` de licença da B; a lista de licenças da A sem as da B e sem contar material da B; o sino da A sem
  licença da B
- o resumo da A sem material nem recusa da B
- `GET /materiais?serieId=<da B>` igual a série inexistente; a busca e a página aberta da A com a série da B, vazias
- `fontes` sem título da B; `lerParaExtrair` com id da B no contexto A; a varredura de `envio_de_material` apaga só no
  contexto de cada escola

## Telas

- [U] Resumo: carregando, erro, vazio e com dado; lista a 360 px, tabela no Chromebook; a série `semSerie` e o aviso
  "séries atribuídas na migração"
- [U] Lista de materiais: os quatro estados; "Mostrar mais"
- [U] Envio: região `aria-live` com a situação de cada arquivo; foco devolvido ao fim; alvo de 44 px; sem licença
  vigente, "Registre a licença primeiro", com link para Licenças; licença vencida não se escolhe
- [U] Licenças: os quatro estados; situação em texto e cor; datas dd/mm/aaaa, com rótulo; o `PATCH` mostra quantos
  materiais saem ou voltam da busca antes de confirmar; o botão de registrar trava durante o envio
- [U] Sino: "Uma licença de material vence em dd/mm" e "Uma licença de material venceu; os materiais dela saíram da
  busca", sem licenciante nem número por pessoa, levando à aba Licenças
- [U] Chip e PDF do artefato: carregando; título e edição pelas `fontes`; "edição anterior"; "material da escola";
  artefato sem `fontes`; erro da leitura
- [U] Textos: `EDICAO_EM_ANDAMENTO` "Espere a edição em processamento terminar"; `LICENCA_VENCIDA` "Atualize a vigência
  em Licenças"; `SEM_MATERIAL_DA_SERIE` ao professor "Peça à coordenação o material desta série"; o 429 do `PATCH` "Muitas alterações por agora. Tente de novo às HH:MM"; 503 "O envio não foi
  concluído. Tente de novo em instantes."
- [U] Tutor do aluno: `SEM_MATERIAL_DA_SERIE` vira o estado "Ainda não há material da sua turma aqui. Avise seu
  professor.", sem o avatar do Tutor, pelo mapa de pausas (`pausaDoErro`)
- [E] Três PDFs com um repetido; registrar licença; nova edição, e o artefato antigo mostrando "edição anterior"; com 300
  materiais no seed, sob throttling de rede e de CPU. O lote é dois casos, pelo teto de 15 s do caso alterado: o lote de
  três PDFs com um repetido (o título de cada um vem do nome e se edita), e o diálogo do lote numa escola com 300 materiais
  em 1366 × 768 (a página não rola, o diálogo rola dentro dele)

## Carga

- [C] 300 PDFs do maior tamanho do seed pela rota real, com o guard, por três coordenadores, enquanto a escola B usa o
  Tutor no pico. Mede a vazão por PDF e projeta as 300 entre 19h e 5h com uma réplica; p95 do turno do Tutor da B até
  500 ms acima da base (a mesma medida sem a ingestão); nenhum statement acima de 1,5 s; o PDF que a escola B envia no
  meio espera no máximo duas extrações. Controle negativo: com `VAGAS_POR_ESCOLA_DESLIGADAS`, a espera do PDF da B
  passa do limite e o cenário reprova
