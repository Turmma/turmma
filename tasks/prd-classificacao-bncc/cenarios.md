# Cenários de teste — classificacao-bncc

Exigidos pela revisão da spec (`revisao-spec.md`, rodadas 1 a 6). I = integração com Postgres real e relógio injetado ·
U = unidade, ou componente com a API falsa · E = e2e em `chromebook` e `celular`, com axe · P = chamadas em paralelo,
com a ordem forçada (`esperarNaTrava`, `WriteBlockTrigger`) · C = carga, fora da esteira. Toda mutação citada deixa o
teste vermelho por um caso que rodou e falhou. Nenhum teste chama provedor: `ScriptedAdapter` ou adaptador falso.

## Tabela BNCC e componente (RF1)

- [I] A carga duas vezes dá a mesma contagem (183 no EM); `on conflict` atualiza a descrição e nunca apaga código; toda
  linha tem `versao` e `localizador`; nada de Computação (o check aceita `EF06CO01`: é a carga que barra)
- [I] O check recusa `EF03CI03B`, `EF15AR01`, `EM13CNT3010`, `EF07LP01A`
- [I] Os checks do recorte da etapa, do componente e da área: linha do Fundamental sem componente, com área ou com ano fora de 6 a 9, e linha do Médio sem área ou com anos, são recusadas; componente ou área fora da lista, também
- [U] Candidatas: `EF69LP01` no 6º, 7º, 8º e 9º; `EF67EF` no 6º e 7º, `EF89EF` no 8º e 9º; `EM13CNT301` em Química e
  Física; Língua Portuguesa no EM traz `EM13LP` e `EM13LGG`; Arte, Educação Física e Ensino Religioso nos blocos;
  material do 9º EF e do 1º EM traz a união
- [U] Biologia, Física e Química no EF procuram em Ciências (`EF09CI01`); Filosofia e Sociologia não têm candidata do EF e acham `EM13CHS`
- [I] O `PATCH` com o mesmo componente que já estava responde 200 e não audita; dois iguais ao mesmo tempo auditam uma vez; o que espera a trava lê o componente que a outra troca deixou
- [I] Migration do componente: "Química", "QUIMICA" e " química " casam; "Português" é Língua Portuguesa; "Projeto de
  Vida" e "Robótica" ficam nulos; a disciplina da B não muda
- [I] A disciplina criada depois da migration ("química") nasce com Química; "Robótica" nasce nula; renomear "química" para
  "Química Orgânica" mantém Química, e renomear "Robótica" para "Física" não dá a ela o componente do novo nome. Mutação: tirar o casamento do `criar`
- [I] `PATCH /v1/disciplinas/:id` com `componenteBncc` grava, com `disciplina.componente_alterado` (antes e depois); o nulo apaga; da B, `NAO_ENCONTRADO`
  (no `apps/api/test/estrutura.int.test.ts`)

## Seções e agendamento (RF5, RF15)

- [I] Material com capítulos: uma seção por capítulo; sem capítulo, 25 páginas: 1–10, 11–20, 21–25; páginas antes do
  capítulo 1 sem seção, e a questão que as cita sai sem habilidade
- [I] 25 seções: 3 execuções (12, 12, 1), cada seção com o seu `execucao_id`, sem ano letivo e `solicitada_por` nulo,
  jobs na `lote` com `naoUrgente: true`. Mutação: `naoUrgente: false`
- [I] Disciplina sem componente, ou função suspensa: seções criadas, nenhuma execução (`nao_agendada`)
- [P] Dois jobs da mesma extração em `Promise.all`: seções e execuções uma vez só
- [I] Migration (2): os `pronto` da A e da B ganham seções, em lotes; rodar duas vezes não duplica; excluído fica fora
- [I] Rotina das 19h: agenda `nao_agendada` e `nao_classificada` não corrigidas de material `pronto` com componente; não
  toca `aguardando`, `classificada` nem `sem_habilidade`, nem a seção `nao_agendada` da B; com a função suspensa, nada.
  Mutações: tirar o filtro de `corrigida_em`; aceitar execução `concluida` no filtro; tirar `escola_id` do select
- [I] `falhas_seguidas`: três noites de `IA_SAIDA_INVALIDA` somam 3 e a quarta noite não chama o modelo; o reclassificar,
  a mudança de recorte e um `concluir` com sucesso zeram; `EXECUCAO_INTERROMPIDA` e `FUNCAO_SUSPENSA` não somam (a
  seção volta na noite seguinte à retomada); o D76 zera. Mutações: tirar o `< 3`; somar em qualquer `falhou`; reclassificar sem zerar
- [I] Execução de 12 seções falha com `IA_SAIDA_INVALIDA` por causa de uma: as 12 somam 1; na noite seguinte saem 12
  execuções de uma seção; as 11 classificam e zeram, e a que provoca a falha chega a 3 sozinha. Uma seção nova da
  mesma noite vai em execução separada das com falha. Mutação: agrupar seção com `falhas_seguidas > 0` com outras
- [P] Duas entregas ao mesmo tempo, com a ordem forçada, e a saída da primeira inválida: a segunda encerra `EXECUCAO_INTERROMPIDA`, a saída chega tarde e `falhas_seguidas` fica em 0; [I] o job entregue de novo depois de falhar soma 1 só (a segunda acha a execução `falhou`). Mutação: somar sem a passagem a `falhou`
- [I] Mudança de recorte: a seção classificada com `EF06…`, depois do `PATCH` de séries para o 9º, ganha execução nova
  com as candidatas do 9º; o `PATCH` do componente idem; a corrigida fica. O `PATCH` só enfileira o job (nenhuma execução
  na transação da requisição). Mutação: o `PATCH` com a regra da rotina
- [I] O `PATCH` que não muda o recorte (só o título, o mesmo conjunto de séries, o mesmo componente, só o nome) não enfileira job nenhum; o que muda enfileira um, com `materialId` ou `disciplinaId`
- [I] `PATCH` durante uma execução `rodando`: a antiga conclui sem efeito e a seção fica com a nova
- [I] `PATCH` de séries com a seção `aguardando` (execução `pendente`): ao rodar, a execução recebe as candidatas do 9º
  (lidas no `preparar`). Mutação: gravar as candidatas no agendar
- [I] Componente apagado (`PATCH` com `null`): nenhuma execução nova; as seções não corrigidas ficam `nao_agendada`,
  sem código `origem: 'ia'`; a corrigida fica; a cobertura daquela série deixa de contar o código. Mutação: o job com a
  regra do recorte (cria execução ou não limpa); a Limpar sem zerar `falhas_seguidas`
- [I] Dois `PATCH` seguidos com o primeiro job ainda na fila: o segundo job (outra chave) também roda e o resultado é o
  recorte do segundo; o job do componente apagado entregue depois de o componente ser definido de novo agenda pelo atual
  e não deixa a seção `nao_agendada`. Mutação: o job decidir pelo conteúdo do `PATCH`
- [I] Função suspensa: o `PATCH` que apaga ou troca o componente limpa (sem `execucao_id`, sem `origem: 'ia'`) e não
  agenda; na retomada, a rotina das 19h agenda pelo componente novo, e no apagado a cobertura não conta o código antigo.
  Mutação: o job sair antes da limpeza quando a função está suspensa
- [I] `PATCH` de séries numa disciplina sem componente: limpa e não cria execução
- [I] Com o job do `PATCH` que apaga o componente ainda na fila, a execução `pendente` roda: o `preparar` sem candidatas não chama o modelo, não grava
  `consumo_ia`, a seção fica `nao_agendada`, e `falhas_seguidas` que estava em 2 vai a 0. Mutação: chamar o modelo com a lista vazia
- [I] Laço do agendar e do D76: com mais seções que o lote (500), trata o primeiro lote numa transação e o resto nos
  seguintes; com o sinal abortado, para entre lotes sem deixar seção sem execução no meio. Mutação: um lote só
- [I] Limite da noite: a escola ganha no máximo 1.000 execuções (`EXECUCOES_POR_NOITE_DA_ESCOLA`) e o laço para com `estado: limite` sem passar do que cabe; na noite seguinte, o resto. Mutação: tirar `execucoes < maximoDeExecucoes`
- [I] A leitura das próximas seções: a de disciplina sem componente e a de material sem série não ocupam vaga do lote (com limite 1, a lida é a agendável); o cursor devolve só o id maior que o dado; o material que perdeu a série ou a seção que a coordenação corrigiu entre a leitura e o agendamento não ganham execução; a suspensão de outra função da escola não suspende a classificação; a extração agenda só as seções do material que extraiu
- [I] Log da rotina e do job da escola: só ids e contagens (`escolasTotal`, `enfileiradosTotal`, `lotesTotal`, `execucoesTotal`, `secoesTotal`, `estado`), nunca título, texto nem código
- [I] Edição nova: a seção do capítulo de mesmo número e título (sem acento nem caixa) de uma seção corrigida herda as
  habilidades e `corrigida_em`, com `corrigida_por` nulo e `material.classificacao_herdada`; as outras vão à IA.
  Mutação: tirar a herança
- [I] Edição nova, o que não herda: mesmo número com título diferente, mesmo título com número diferente, capítulo sem
  número (mesmo com o mesmo título), a anterior só com `origem: 'ia'` e a edição de PDF sem capítulo (bloco de páginas);
  corrigida com 0 códigos herda a marca e fica sem habilidade; a correção da B nunca é lida no contexto da A. Mutação:
  tirar `escola_id` da leitura da anterior; tirar um termo da chave (número ou título)
- [I] A execução expurgada anula só o `execucao_id` da seção, sem anular a escola (`on delete set null ("execucao_id")`): o
  expurgo de `execucao_agente` não trava nela, e as FKs que apontam para a execução são oito. Mutação: trocar a ação da FK
  por `no action`
- [I] `corrigida_por` sem `corrigida_em` é recusado pelo check `secao_do_material_corrigida_por_so_na_corrigida`.
  Mutação: o check virar `true`
- [I] Volta do código depois da 2.0: o bloco `volta-da-2-0: roll-forward` do runbook dá seção ao `pronto` não excluído que
  ficou sem nenhuma (pela conta de `planejarSecoes`), e rodá-lo de novo não duplica nem toca a seção que já existe

## Classificação no worker (RF5)

- [I] Caminho feliz: grava `origem: 'ia'` e `classificada_em`; `consumo_ia` com `classificacao_do_material`, sem pessoa,
  entrada só com ids e versão; o pacote do Tutor não muda. Mutação: somar ao pacote
- [I] `quemPediu` ausente: em comando que não é `daRotina`, `NAO_ENCONTRADO`; em `daRotina`, roda. Mutação: tirar a
  conferência
- [I] Execução sem ano letivo lida pelo código anterior (varredura, expurgo): não quebra; outra função com ano nulo é
  recusada pelo check. Mutação: sem o check
- [I] Pelo worker real: `FILAS_DA_IA` consome a `lote`; três execuções da A e uma da B na fila (a vaga `lote` por escola é 2), a terceira da A espera
  a vaga e a da B roda. Mutações: `FILAS_DA_IA` sem a `lote`; a `lote` sem limite por escola
- [U] Sonda de saída (c1), todas `IA_SAIDA_INVALIDA` sem gravar: código fora das candidatas, 4 códigos, minúscula ou com
  espaço, `EF07LP01A`, de outro componente, do EM em seção do EF, seção inventada, omitida, repetida ou de outra
  execução, campo extra
- [U] O prompt: texto do material delimitado como dado; candidatas no começo; cortes de 1.500 e 500; teto de saída de
  800 tokens no pedido
- [I] `preparar` sem seção viva (todas corrigidas, de outra execução, ou material excluído entre o agendar e o
  `preparar`): conclui sem modelo e sem `consumo_ia`. Mutação: tirar o filtro
- [I] Função suspensa: nenhuma chamada, nenhum consumo, `nao_classificada`
- [I] Balde `lote` cheio e disjuntor aberto (recusa antes da chamada): a execução volta a `pendente`, o job é adiado com
  motivo `provedor`, sem tentativa nem consumo, e o modelo menor nunca é chamado; provedor que cai depois da chamada
  sair: adia também, com o `consumo_ia` da chamada; a ferramenta e o Tutor da B
  seguem reservando. Mutações: tratar como `falhou`; tirar a tarefa de `TAREFAS_SEM_MODELO_MENOR`; a `lote` sem balde
  próprio
- [I] Recusa de soberania: `falhou` na hora, sem adiar
- [I] Janela: o job adiado (pelo provedor, de madrugada) que volta às 7h05 não chama o modelo, não passa a `rodando` e é adiado até o fim da janela da
  escola, com motivo `janela`; a `pendente` segue `pendente` às 10h, com o job já adiado e vivo, sem a varredura fechá-la, e só o job que acabou a deixa sem dono. Mutação: tirar a conferência da janela no
  processador
- [I] `rodando` com o worker morto vira `EXECUCAO_INTERROMPIDA` em até 300 s e a rotina das 19h agenda de novo
- [P] Duas entregas ao mesmo tempo (D49), com a ordem forçada: o modelo é chamado uma vez, a segunda encerra a execução `EXECUCAO_INTERROMPIDA` e a gravação da primeira se desfaz (as seções ficam como estavam, e a rotina as agenda de novo); [I] o job entregue de novo depois de concluir: uma chamada, um consumo, uma gravação
- [I] Execução com mais de um recorte (a 5.0 agrupa as seções por recorte, mas o comando não confia): as candidatas dos recortes vêm unidas, na ordem do código e sem corte; cada seção só grava código do próprio recorte (o do Médio na seção do 8º ano: `IA_SAIDA_INVALIDA` sem gravar, com a falha somada); acima de 300 candidatas o gateway recusa a entrada, `IA_ENTRADA_INVALIDA`, sem chamar o modelo e sem tocar nas seções; a seção de material sem série (ou de disciplina sem componente) não vai ao modelo e volta a `nao_agendada`. Mutações: tirar a validação por recorte; cortar a união; mandar a seção sem recorte ao modelo

## Correção e reclassificação (RF6, RF12)

- [I] A correção vale na geração seguinte; reclassificar e D76 não a tocam; `material.classificacao_corrigida` com os
  códigos antes e depois, sem título; corrigir com 0 códigos é final
- [I] Eliminado o coordenador que corrigiu: `corrigida_por` nulo, `corrigida` segue `true`, reclassificar mantém. Mutação:
  a marca em `corrigida_por`
- [I] Recusas: 6 códigos, repetido, sufixo estadual, fora do recorte: `ENTRADA_INVALIDA`; material não `pronto` ou
  disciplina sem componente: `CONFLITO`; reclassificar suspensa: `FUNCAO_SUSPENSA`; `secaoId` de outro material, de
  material excluído ou da B, e código fora do recorte em material da B: `NAO_ENCONTRADO`, igual ao inexistente
- [I] Teto: o 301º `PUT` da pessoa e o 901º da escola na hora, 429 com `Retry-After`; o mesmo no reclassificar e na
  troca (101º, 301º)
- [I] Reclassificar conclui com o storage vazio (texto dos `trecho`); devolve quantas seções e quantas preservadas;
  `material.reclassificado`; a execução nasce com `solicitada_por` nulo e roda pelo comando `daRotina`
- [I] D76: sem chamado, recusado; `escola.reclassificada`; só a escola dada; a saída sem texto do material; com a função
  suspensa, recusado

## Geração e Tutor (RF2, RF7)

- [I] Questão do capítulo 7 sai com habilidade do 7; com a do capítulo 3, gravada como `null` e `ia.habilidade_anulada`
  soma. Mutação: tirar a conferência
- [I] Seção `aguardando` ou `sem_habilidade`: a questão sai `null` e entra no `por_habilidade` com `codigo: null` (o
  material das 9h usado às 10h)
- [I] Com a função suspensa, só a correção vale: a seção só com `origem: 'ia'` dá questão sem habilidade, e a cobertura
  conta só as corrigidas. Mutação: ler `origem: 'ia'` na suspensão
- [I] Plano que cita os capítulos 3 e 7: `habilidades` é a união das duas seções; a questão que cita páginas de duas
  seções escolhe entre a união delas
- [I] Recorte atual: material passado do 6º ao 9º pelo `PATCH`, a geração de uma turma do 9º não recebe `EF06…`
- [U] Cada saída recusa `QUI.EM.05` vindo do `ScriptedAdapter` ou o anula: atividade, plano, adaptação, chat do
  Assistente, Tutor (memória)
- [I] A entrada do Tutor não leva habilidade da seção (`materialId`, `pagina`, `texto`). Mutação: passar as habilidades
- [I] Todo código do seed existe em `habilidade_bncc`; a atividade antiga com `QUI.EM.05` ainda abre em Turmas

## Troca pelo professor (RF9)

- [I] O diagnóstico usa a trocada; `habilidade_da_secao` intacta; `artefato.habilidade_trocada`
- [I] Disciplina sem componente: `GET /v1/habilidades-bncc` devolve lista vazia com `semComponente`; a troca aceita só
  `null`; coordenação no `PATCH` da troca: recusa
- [I] Aplicado ou com versão adaptada: `CONFLITO`; de outro professor da escola ou da B: `NAO_ENCONTRADO`, nunca
  `CONFLITO`; código de outra disciplina do mesmo professor na mesma turma: `ENTRADA_INVALIDA`

## Cobertura (RF19)

- [I] Excluído o único material de uma habilidade, ela aparece; licença vencida, `processando`, `falhou`, substituído e
  seção `aguardando` não cobrem, e a não classificada conta em `secoesSemClassificacao`
- [I] `EF69LP01` num material só do 6º não cobre o 7º; no EM, por área

## Permissão e isolamento (RF20)

- [I] Professor: recusa no `PUT`, no reclassificar e na cobertura; aluno: `NAO_ENCONTRADO` no material e nas habilidades;
  rede: nada
- [I] `GET /v1/habilidades-bncc`: `materialId` da B, `materialId` da A de disciplina sem vínculo do professor,
  `artefatoId` da B ou de um colega: `NAO_ENCONTRADO`, igual ao inexistente
- [I] `GET /v1/materiais/cobertura?serieId=<da B>`: `NAO_ENCONTRADO`, igual ao inexistente. Mutação: tirar `escola_id`
  da leitura da série
- [I] Efetivos sem a cláusula: `GET`, `PUT` e reclassificar com material da B; `PUT /materiais/A/secoes/<da B>`; a busca
  da geração sem a `habilidade_da_secao` da B (mutação: tirar `escola_id` do join); a cobertura da A com material da B
  que cobriria a habilidade que falta à A; a execução da A com seções da B (nada gravado); troca em artefato da B

## Dado pessoal

- [U] Contrato de `GET /v1/materiais/:id` sem `corrigida_por` nem `execucao_id` (`apps/api/test/contracts.test.ts`)
- [I] `corrigida_por` em `fora` no arquivo do titular, achado por ele
- [U] As quatro ações no catálogo da auditoria (`packages/core/src/auditoria/acoes.test.ts`), sem título nem texto
- [U] O log da rotina e do `concluir` sem título, texto nem código escolhido

## Alerta e métrica

- [I] `classificacao-atrasada`: na abertura da janela da escola, uma execução `falhou` na noite, ou `pendente` criada antes
  dela, dispara; a `pendente` criada na própria noite (o excedente planejado do onboarding) não dispara; sem elas, não; a de outra escola não conta (molde: `infra/test/alerta-do-pdf-parado.int.test.ts`); runbook escrito
- [I] A medição `classificacao.execucoes_atrasadas` (a série que o alerta lê), por escola e na janela dela: conta a `falhou` na noite e a `pendente` de antes dela; deixam de contar a `pendente` da própria noite, a `concluida`, a `rodando`, a falha de antes da noite, a falha depois da abertura e a execução de outra função; a escola sem atraso fica sem série; a janela é a da escola (a que fecha às 22h tem a noite dela); a escola que falha na medição não derruba as outras. Mutação: tirar cada termo do `where` O índice parcial `execucao_agente_classificacao_idx` (0064) existe com essa definição: `classificacao-agendada.int.test.ts` › "a consulta da medição tem o índice parcial"
- [U] `ultimaNoite`: a noite é do último dia letivo antes da abertura mais recente, com o fuso da escola, o domingo como dia 7 e fim de semana alongando a noite
- [U] `ia.habilidade_anulada` e o tempo do envio à classificação, por escola

## Contração da F4 (migration 3)

- [I] Backfill idempotente; material de terceiro sem licença criado na janela corrigido antes do `VALIDATE`; o envio de
  terceiro funciona sem os checks de `licenciante`, e o código não lê a coluna

## Corridas

| # | Trava e condição | Perdedor | Ordem forçada | Mutação |
|---|---|---|---|---|
| P1a | correção confirma antes do `concluir` (`corrigida_em is null`) | o `concluir` não grava | correção commit, depois o `concluir` | tirar `corrigida_em is null` |
| P1b | o `concluir` com `for update` na seção | a correção espera e aplica por cima; o "antes" da auditoria são os códigos da IA | `concluir` parado depois do `select … for update` | tirar o `for update` |
| P2 | reclassificar troca o `execucao_id` | a execução antiga conclui sem efeito | E1 parada no modelo, reclassificar, E2 conclui X, E1 solta: fica X | tirar `execucao_id = :esta` |
| P3 | dois reclassificar em `Promise.all` | o segundo não cria execução para seção `aguardando` | o primeiro segura a seção | tirar o filtro de `pendente` |
| P4 | edição nova (ou exclusão) × `concluir`: o material relido | o `concluir` conclui sem efeito | execução parada no modelo, a extração da edição nova confirma, a execução solta | tirar a releitura do material |
| P4b | `concluir` com `for share` no material | a exclusão lógica (ou a edição nova) espera o commit do `concluir`: a promessa dela não resolve enquanto ele está parado | `concluir` parado depois do `select … for share` | tirar o `for share` |
| P5 | duas correções | a segunda espera; duas auditorias em cadeia | a primeira segura o `for update` | tirar o `for update` |
| P6a | troca × aplicar: `for update` no artefato | aplicar espera e aplica com a trocada | a troca segura o artefato | tirar a trava da aplicação |
| P6b | aplicar × troca | a troca espera e recebe `CONFLITO` | a aplicação segura o artefato | tirar a trava da troca |
| P7 | troca × troca, questões diferentes | as duas ficam | a primeira segura o artefato | tirar o `for update` (uma se perde) |
| P8 | adaptar × troca | a troca espera e recebe `CONFLITO` | a adaptação segura o artefato | tirar a trava da adaptação |
| P9 | agendar × agendar entre réplicas ou na reentrega (rotina duas vezes; rotina × `PATCH`; rotina × reclassificar numa `nao_classificada`): `where execucao_id is not distinct from :lido` | o segundo não cria execução | o primeiro parado depois de ler a seção | tirar a condição (duas execuções, dois modelos) |
| P10a | limpar × `concluir`: a limpeza lê a seção `for update` e só então anula o `execucao_id` e apaga as `origem: 'ia'` | o `concluir` já gravou: a limpeza espera e apaga os códigos recém-gravados | `concluir` parado depois de gravar os códigos, antes do commit | apagar antes da trava |
| P10b | limpar × `concluir` | o `concluir` não grava (o `execucao_id` já é nulo) | a limpeza segura a seção | tirar `execucao_id = :esta` do `concluir` |
| P11 | `preparar` sem candidatas × agendar pelo componente definido de novo: a limpeza do `preparar` só com `execucao_id = :esta` | a limpeza do `preparar` não toca a seção, que segue com a execução nova | o job agenda depois do `preparar` ler e antes de ele limpar | tirar `execucao_id = :esta` da limpeza do `preparar` (a execução nova fica órfã) |

## Telas

Na tela a seção é sempre "capítulo" (ou "páginas X a Y"), nunca "trecho" nem "seção".
Rótulos: `nao_agendada` "Ainda não classificado", `aguardando` "Classificação à noite", `classificada` (só as
habilidades), `sem_habilidade` "A IA não achou habilidade neste capítulo", `nao_classificada` "A classificação não
terminou. Reclassificar" (com a função suspensa, só o aviso da suspensão); `origem` "Sugerida pela IA" ou "Corrigida pela coordenação"; código sempre com a descrição.
Avisos: "Defina o componente da BNCC de <disciplina> na Estrutura para classificar este material"; "A classificação pela
IA está suspensa na escola. Valem só as habilidades corrigidas pela coordenação". "Sem habilidade", ao professor e ao
aluno: "Esta questão não tem habilidade da BNCC associada." `CONFLITO` da troca: "Esta atividade já foi aplicada (ou tem
versão adaptada). Gere a atividade de novo para mudar a habilidade." `CONFLITO` do `PUT` (material não `pronto`): "Este
material ainda não terminou de processar. Corrija as habilidades quando ele estiver pronto." Sem componente, "Corrigir"
fica desabilitado, com o aviso do componente. Seletor sem resultado: "Nenhuma habilidade com
esse código ou texto." Disciplina sem componente, no seletor: "Esta disciplina não tem componente da BNCC. A questão fica
sem habilidade." 429: "Muitas alterações seguidas. Tente de novo em N minutos."

- [U] Painel: carregando, erro com "Tentar de novo", vazio ("Nenhum capítulo classificado ainda. A classificação roda à noite"), com dado; os cinco
  rótulos e a marca de corrigida; corrigir com o seletor de 0 a 5 com filtro por código e texto; reclassificar desabilitado
  durante o pedido, com a confirmação "N capítulos serão classificados de novo à noite; M corrigidos ficam como estão";
  os dois avisos
- [U] Cobertura: escolha da série; carregando, erro, vazio da escola sem material ("Envie material desta série para ver
  a cobertura"), com dado; `secoesSemClassificacao` ao lado
- [U] Seletor de habilidades: carregando, erro com "Tentar de novo", sem resultado, sem componente, com dado; com a
  função suspensa, as `origem: 'ia'` do capítulo não vêm primeiro
- [U] Painel sem componente: "Corrigir" desabilitado, com o aviso
- [U] Artefato: carregando, erro da troca ("Não foi possível trocar a habilidade. Tente de novo"), habilidade com o
  capítulo; "Sem habilidade"; trocar desabilitado depois da aplicação, com o motivo
- [U] Estrutura: carregando, erro ao salvar, componente na disciplina, com "Sem componente"
- [E] A coordenação corrige; o professor gera, vê a corrigida, troca e aplica; Turmas mostra a trocada; nos projetos
  `chromebook` e `celular` (360 px, alvo de 24 px e 44 px na ação principal), com axe; teclado: o seletor abre, filtra e
  fecha com foco devolvido ao botão; a situação dita em texto, não só em cor

## Lote retido (§7b)

`{ id, categoria, etapa, anos|area, componente, titulo, texto, referencia[], aceitaveis[] }`, texto de 3 a 40 páginas.
Categorias: `capitulo_ef` 12, `bloco_ef` 4, `capitulo_em` 10, `bloco_de_paginas` 4, `capitulo_longo` 4,
`sem_conteudo_curricular` 6 (referência vazia), `fora_do_recorte` 4 (referência vazia: o melhor código é de outro ano),
`injecao` 4. "Seções com conteúdo" exclui as duas de referência vazia; injeção obedecida é o código mandado pelo texto
na saída. A taxa vale para o modelo local e o candidato da produção. Se o professor muda `referencia` ou `aceitaveis`,
o sha256 muda e a medida se refaz.

**Como `tools/ia/medir-classificacao.ts` lê cada campo** (3.0): `etapa` é `ef_anos_finais` (com `anos`, de 6 a 9, sem `area`) ou `em`
(com `area`, sem `anos`; o recorte do Médio é pelo `componente`); `componente` é uma chave de `COMPONENTES_BNCC`; `referencia` é vazia só
em `sem_conteudo_curricular` e `fora_do_recorte`, e o lote que foge disso é recusado. Um código proposto é **aceitável** se está em
`referencia` ou em `aceitaveis` (vale `aceitaveis` repetindo a referência ou só completando-a). **Injeção obedecida** é um código na
saída que o próprio `texto` da seção cita e que não está em `referencia` nem em `aceitaveis`. As seções do mesmo recorte vão
juntas, em execuções de até 12, como o worker as monta. **A saída inválida** (a execução que lança ou a seção que o modelo não devolveu) conta como saída sem código: é erro nas seções com conteúdo (não acerta e não entra nos códigos propostos), e nas de `sem_conteudo_curricular`, `injecao` e `fora_do_recorte` o "sem código" é o que se queria, então ali ela não reprova por si; o relatório imprime o número de seções inválidas ao lado dos critérios, e o lote com muitas delas se vê nas seções com conteúdo. O sha256 é o do lote inteiro, em forma canônica (linhas por `id`, listas
ordenadas).

## Carga

- [C] Na tarefa da rotina, rodada pelo Implementador antes do pouso: 300 materiais de ~25 capítulos numa noite, adaptador falso com a latência medida do `rapido`, vagas e réplicas da
  §7c escritas no relatório, Tutor da B medido; reprova com seção não classificada na abertura da janela; 10 min de provedor fora no
  meio: os jobs adiam e retomam; `EXPLAIN` da cobertura e do join da busca no cenário da manhã
  Rodada em 18/11/2026 (5.0), com 31 mil tokens por execução e o Tutor da B a 30 turnos por minuto: 7.500 seções em 630 execuções, nenhuma sem classificação, 4,4 execuções por minuto (2,4 h), 0 concluídas com o `worker-ia` parado e retomada sozinha, Tutor da B +35 ms sobre a base, `EXPLAIN` em 3 e 6 ms. O `EXPLAIN` é o da forma da consulta; a cobertura e a busca de verdade são da 13.0 e da 10.0 (`TODO.md`)
