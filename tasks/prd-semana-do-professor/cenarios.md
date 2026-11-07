# Cenários de teste — semana-do-professor

Exigidos pela revisão da spec (`revisao-spec.md`, rodadas 1 a 5). Cada cenário diz o que precisa falhar se a regra sumir e cai
numa tarefa do `tasks.md`. I = integração com Postgres real e relógio injetado · U = unidade · E = e2e em `chromebook` e
`celular` · P = em paralelo, com a ordem forçada quando a ordem é a regra.

## Leitura da semana (RF1 a RF4, RF7, RF9, RF12)

- **S1** [I] Só vínculo `confirmado` gera aula; um encerrado e um aberto da mesma professora: só o aberto aparece. Pendente e contestado também não
- **S2** [I] Sábado e domingo só quando a grade tem aula neles; aulas do dia em ordem de horário
- **S3** [I] Feriado numa terça tira a aula, e o dia traz tipo e descrição; "Conselho de classe" (evento) não tira
- **S4** [I] Recesso que começa na sexta anterior e acaba na segunda depois da semana seguinte esvazia as duas semanas (o filtro é por cruzamento, não pelo início do evento); calendário gravado pela reimportação real do F2
- **S5** [I] Semana que atravessa o fim do ano: só os dias do ano trazem aula; semana inteira fora do ano, nenhuma
- **S6** [I] Escola sem ano em curso (só `planejado` ou `encerrado`): `GET` responde `ano: null` e nenhum dia; `PUT` dá `NAO_ENCONTRADO` e não grava
- **S7** [I] Virada do ano: com o ano novo em curso, o `GET` não traz o registro do ano anterior; o `virarAno` apagou as linhas de `aula` do ano, inclusive a de um vínculo encerrado antes (por desligamento ou realocação), e a `aula` da escola B continua
- **S8** [I] Registro só dos vínculos confirmados: o registro passado de um vínculo encerrado não volta como fora da grade
- **S9** [I] Itens (RF7): atividade aplicada na quarta aparece na quarta da turma e disciplina; a do colega de outra disciplina na mesma turma não; correção nos três estados; o item não traz nota, acerto, nome de aluno nem autor (contrato com as chaves exatas); a aplicada às 22h de domingo em Brasília fica no domingo; a de turma e disciplina de vínculo `pendente` não aparece; quem tem as duas disciplinas confirmadas na turma vê as duas atividades, uma vez cada; no dia, a ordem é aplicada, encerrada e correção, depois o título e, no empate, a atividade [U]; o item de um dia que a semana não traz (fim de semana sem grade, fora do ano) não aparece [U]; a correção criada fora da semana não aparece, e a aprovada depois dela mostra `aprovada`
- **S10** [I] Feriado no dia da prova: a aula sai, e o item da atividade aplicada naquele dia fica
- **S11** [I] Duas disciplinas na mesma turma: o texto de uma não aparece na outra
- **S12** [I] Turma sem professor alocado não aparece na Semana de ninguém
- **S13** [I] Relógio às 22h de Brasília (já o dia seguinte em UTC): `hoje` e `agora` são os de Brasília
- **S14** [U] Montagem dos dias: feriado, recesso, evento, fora do ano, fora da grade passado (aparece), de hoje e futuro (não); "Falta preencher" na aula de hoje e futura sem texto, nenhum selo na passada; "O que vou dar" até o dia, "O que foi dado" depois
- **S16** [I] Aula dupla (duas alocações seguidas do mesmo vínculo no dia): o `GET` traz cada aula com o próprio texto, e o `PUT` numa não altera a outra
- **S15** [U] Rótulos em português dos tipos e estados dos itens, numa tabela só, e as datas no formato local
- **S17** [I] `gradeImportada` e `calendarioImportado` são da escola e do ano em curso, e não da professora: a professora sem aula, numa escola com grade, vê `true` e a semana vazia; a escola sem grade nem calendário, com a B completa, vê `false` nos dois
- [I] `EXPLAIN` da consulta dos itens usa um índice que começa pela escola e pela turma, na atividade aplicada (`atividade_aplicada_escola_ano_turma_id_unico`, que o planejador prefere ao `atividade_aplicada_turma_idx`) e na entrega (`entrega_turma_idx`); a condição do índice cita `turma_id`, e nenhuma das duas tabelas é lida em varredura

## Gravação (RF5, RF10, RF11, RF15)

- **G1** [I] Cada cláusula dá `NAO_ENCONTRADO` e não grava, uma por caso, e cada caso cumpre todas as outras (feriado, recesso e fora do ano caem num dia e início com alocação do vínculo): data em feriado; data em recesso; data fora do ano; início que não é de alocação; dia da semana sem alocação do vínculo; data futura sem alocação; data futura com registro já gravado e feriado novo sobre ele (texto e `atualizadoEm` intactos); registro passado fora da grade (sem alocação) num dia que virou feriado; e, para o qualificador "passado": data futura, dia útil sem evento, sem alocação do vínculo naquele dia e início, com registro gravado direto pelo teste (sem o "passado" no código, vermelho); o mesmo com a data de **hoje** (hoje não é passado: `<` trocado por `≤`, vermelho)
- **G2** [I] O registro passado fora da grade se corrige
- **G3** [I] Texto vazio e texto só de espaços apagam a linha; 500 caracteres grava; 501 dá `ENTRADA_INVALIDA` e não grava
- **G4** [I] Vínculo `confirmado` da mesma professora no ano anterior, com alocação naquele dia e início: a mesma resposta, nada gravado
- **G5** [I] Log capturado no `PUT` não traz o texto; nenhuma linha de auditoria nasce dele
- **G6** [P] Duas gravações da mesma aula: uma linha, com o texto igual a um dos dois
- **G7** [U] O contrato recusa campo a mais e `segunda` que não é segunda

## Isolamento e coordenação (RF9 a RF11)

- **R1** [I] `PUT` com vínculo de outra escola, de colega da mesma escola, `pendente`, `contestado` e id inexistente: a mesma resposta, nada gravado
- **R1b** [P] Trava presa, a ordem "confere, depois trava": (a) uma transação do teste segura `pg_advisory_xact_lock(<classe>, hashtext(escolaA‖vinculoColega))`; o `PUT` de outra professora de A com esse `vinculoId` responde `NAO_ENCONTRADO` na hora, sem esperar o `lock_timeout`, e ninguém fica esperando na trava; (b) o teste segura a chave que o `PUT` de A calcularia para o vínculo de B, `(escolaA‖vinculoB)`: a mesma resposta na hora. Com a trava antes da conferência, (a) fica vermelho
- **R2** [I] Professora de duas escolas, com o token de uma: nenhuma aula, registro ou item da outra
- **R3** [I] Escola B com feriado e evento na mesma semana: o `GET` com o token de A mostra as aulas de A nesse dia e não traz tipo nem descrição de B
- **R4** [I] Substituto e antecessor na mesma turma, disciplina, dia e início, produzidos pela reimportação real da grade (encerra por realocação, cria o pendente, o substituto confirma): o substituto não lê o texto do antecessor; o antecessor não recebe a aula nem o fora da grade; o `PUT` do antecessor dá `NAO_ENCONTRADO`
- **R5** [I] Arquivo do titular de uma professora sem conta ativa, com texto marcado (sentinela): a versão `coordenacao` não traz a tabela nem o texto, e a `completa` traz; a prévia não traz contagem de aulas
- **R7** [I] Token de coordenação e de aluno direto em `GET /v1/semana` e `PUT /v1/aulas`: a recusa da matriz, nada lido nem gravado
- **R6** [U] `naVersao` da `aula`: `completa` sim, `coordenacao` não; `matriz.test.ts`: `aula` é `nunca` para coordenação, rede e aluno

## Reimportação da grade (RF13, RF14)

- **J1** [I] A aula que continua mantém o texto
- **J2** [I] A que muda só o horário, no mesmo vínculo e dia, leva o texto das datas passadas e futuras para o horário novo
- **J3** [I] A que sai sem par: os registros de data ≥ hoje saem, os passados ficam fora da grade
- **J4** [I] Colisão: um registro fora da grade já ocupa o início novo numa data passada; o re-chaveamento daquela data não acontece, e os dois textos continuam (nenhum texto passado se apaga)
- **J5** [I] Aula dupla: o pareamento por ordem leva cada texto à sua aula
- **J6** [I] O passo da escola A não toca registro da escola B de mesmo dia e início
- **J7** [I] A mesma grade reimportada duas vezes mantém todos os textos
- **J8** [I] Relógio às 22h de Brasília: o "data ≥ hoje" do passo usa o dia de Brasília (o relógio do job é injetado, `ExecucaoOptions.relogio`)
- **J9** [I] Resumo, prévia e auditoria da reimportação não trazem contagem nem menção a registro de aula
- **J10** [I] Reimportar o calendário com feriado novo esconde a aula e, retirado, ela volta com o texto
- **J11a** [P] Corrida 2, job primeiro: o job pausa depois de apagar os registros de data ≥ hoje e antes do commit (a pausa solta ao ver o `PUT` esperando em `pg_stat_activity`, nunca com `sleep`, antes dos 2 s do `lock_timeout`); o `PUT` daquela aula futura espera; o job confirma; o `PUT` responde `NAO_ENCONTRADO` e não sobra registro futuro sem alocação. Tirada a trava, vermelho
- **J11b** [P] Corrida 2, gravação primeiro: uma transação do teste toma `pg_advisory_xact_lock(<classe>, hashtext(escolaId‖vinculoId))` e grava na alocação velha, sem confirmar; o job já apagou a alocação e para na trava do vínculo; só depois de ver o job esperando (`esperarNaTrava` casando a classe própria da trava do vínculo e `wait_event = 'advisory'`) o teste confirma, dentro do `lock_timeout` de 1 s do job; o job lê a `aula` depois da trava e apaga o registro futuro. Nenhum registro futuro sem alocação no fim; com a leitura da `aula` antes da trava, vermelho
- **J12** [P] Corrida 3, com a ordem forçada: `PUT` no registro fora da grade enquanto o job re-chaveia o início velho para o novo; no fim, nenhum texto sobrescrito e nenhum registro duplicado; a pausa do job fica depois do re-chaveamento e antes do commit. Tirada a trava, vermelho
- **J13** [I] `lock_timeout`: com a trava do vínculo presa por outra transação, o `PUT` fica na fila da trava (`esperarNaTrava`) e devolve `INDISPONIVEL_TENTE_DE_NOVO` (o código; o limite de tempo do caso é largo, não a prova). O `statement_timeout` da API (2 s) é o mesmo prazo do `lock_timeout`, e sozinho cortaria a espera com `TEMPO_ESGOTADO`: a gravação eleva o da própria transação a 3 s, e o caso fica vermelho sem isso
- **J14** [P] Gravação × virada: o encerramento do ano pausa depois de apagar a `aula` e antes do commit (gatilho de `apps/api/test/write-block-trigger.ts`; o `PUT` sai depois de `esperarNaTrava` no `for share` do ano, como em `acesso-da-turma.int.test.ts`; a pausa solta antes dos 2 s); o `PUT` espera no `for share` do ano; o ano encerra; o `PUT` responde `NAO_ENCONTRADO`, e nenhuma linha de `aula` fica no ano encerrado. Sem a trava do ano, vermelho
- **J16** [P] Gravação × vínculo marcado "sai da grade", no formato do J11b: uma transação do teste toma `pg_advisory_xact_lock(<classe>, hashtext(escolaId‖vinculoId))` desse vínculo e não confirma; o teste espera o job parado na trava consultiva do vínculo (`esperarNaTrava` casando a classe própria da trava do vínculo e `wait_event = 'advisory'`; a do convite da escola também é `pg_advisory_xact_lock`); o insert e o commit vêm logo depois, dentro do `lock_timeout` de 1 s do job (`importacao.repository.ts`), sem `await` lento no meio; só então a transação insere um registro **novo** (data futura, alocação velha: um insert que passa pela FK, não o `on conflict do update`) e confirma. Nenhum `40P01` nem `55P03`, nem na transação do teste nem na **primeira tentativa** do job (o erro de `executarPlanilha` na primeira chamada capturado, ou o motor sem nova tentativa); importação `concluida`, vínculo `encerrado`, nenhum registro futuro do vínculo no fim. Com o passo depois de `encerrarOsMarcados`, o insert espera o `FOR UPDATE` do job e o job a trava consultiva: `40P01` ou `55P03`, vermelho
- **J15** [I] Reimportar a grade do ano `planejado` não toca o texto do ano em curso

## Tela (RF1 a RF9, RF12)

- **T1** [E] Semana com aulas de três turmas; navegação anterior, seguinte e "Hoje" muda a semana e o endereço; Hoje destacado em texto
- **T2** [E] Abrir a aula, escrever, salvar, reabrir e achar o texto; o selo "Falta preencher" some ao salvar; o aviso de não escrever nome de aluno está no painel
- **T3** [E] Falha ao salvar: a frase de erro e o texto guardado; aula que saiu da grade com o painel aberto: a frase diz que a aula saiu e que o texto não foi salvo
- **T4** [E] "Preparar esta aula" abre o Início com a turma marcada, e o número de conversas é o mesmo antes e depois
- **T5** [E] "Ver a semana desta turma", no Hoje, leva à Semana filtrada por turma e disciplina; com duas disciplinas confirmadas na turma, dois links, "Ver a semana desta turma · <disciplina>", cada um leva à Semana com a sua, e o `Select` do filtro mostra a opção dela (techspec §9, divergência da 8.0)
- **T6** [E] Item do dia abre o painel da atividade e a revisão da correção; o `?turma=` corta os itens junto das aulas, e a semana só com item, sem aula, não é vazia [U]
- **T7** [E] Painel aberto com `?aula=` e rascunho digitado, troca de escola: o painel fecha, nenhuma aula e nenhum rascunho da escola anterior ficam; o mesmo na saída da conta; o rascunho nunca está em `localStorage` nem `sessionStorage`
- **T8** [E] O carregando, os vazios ("A coordenação ainda não importou a grade", "Sem aulas nesta semana", "Semana de recesso", "O ano letivo ainda não começou"), o aviso de calendário não importado e o erro com "Tentar de novo"
- **T9** [E] `celular`: um dia por vez, o dia inicial é hoje (ou a segunda, fora da semana de hoje), sem rolagem horizontal a 360 px (asserção na largura de rolagem); alvos de toque da regra 50, item 2a
- **T10** [E] `chromebook` com throttling de rede e CPU, semana com 40 aulas; o RF22 da X3 (`soOPainelDaAbaRola`) a 1366 × 768; axe sem violação
- **T11** [U] "Falta preencher" é selo por aula, sem total nem contador na semana
