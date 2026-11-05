# Cenários de teste — onboarding-por-convite

Exigidos pela revisão da spec, rodadas 1 a 8 (`revisao-spec.md`); os de e-mail, senha e conta da escola foram, no corte
de 03/11/2026, para `tasks/prd-acesso-e-convites/cenarios.md`. Cada cenário diz o que precisa falhar se a regra sumir, e cai
numa tarefa do `tasks.md`, que diz qual. I = integração com Postgres real e relógio injetado · U = unidade · E = e2e em
`chromebook` e `celular`, com axe · P = chamadas em paralelo · C = cenário de carga.

## Planilha (RF2 a RF10, RF15)

- **RF2.**
  - [I] Gravar direto, sem prévia, com texto errado: `ENTRADA_INVALIDA` e nenhuma linha em `importacao_planilha`.
  - [I] Marca fora dos candidatos: `ENTRADA_INVALIDA`. A marca de candidato com a ação trocada (o id de quem sai da planilha marcado em `transferir`, por exemplo) também.
  - [U] Leitor: `;`, tab, UTF-16, BOM, windows-1252; notação científica no CSV é erro na linha.
  - [U] XLSX real na biblioteca real: `00123` em célula de texto chega `00123`; em célula numérica chega `123` e o
    comportamento está escrito no teste.
  - [I] Consultas da prévia constantes entre 30 e 3.000 linhas (contadas, nunca cronometradas).
  - [I] Matrícula que a escola já tem no ano (na lista ou com credencial): "já existe", sem gravar nada e sem criar a turma que só ela pedia; a de outro ano ou de outra escola não conta.
  - [C] Prévia e gravar com 3.000 linhas: p95 até 2 s com a rajada de login em paralelo.
  - [C] Job de 3.000 linhas com transferências em várias turmas junto com o gerar acesso e a decisão nessas turmas, e o
    de professores junto com o login deles: zero 503 no gerar acesso, na decisão e no login; espera de trava com p95 abaixo de 300 ms; passo (3) do job abaixo de 1 s.
  - Os limites, um cenário por linha, estão na tabela "Limites" no fim.
  - [I] `/v1/importacoes/alunos` com 3.001 linhas ou mais de 512 KB: recusado; 3.000 entram.
- **RF3.**
  - [U] "8ºA", "8º A", "8A", "8a", "8º ano A" na mesma chave; "Turma Azul" e "10A" são erro; duas turmas existentes com a
    mesma chave são erro.
  - [P] Turma "8º A" criada à mão contra "8A" criada pelo job: uma turma; a criação à mão que perde responde `CONFLITO`,
    o job que perde sai `desatualizada`, nunca `falhou`.
  - [I] Turma "8A" renomeada para "9B": a planilha com "8A" não casa com ela (vira turma nova), a com "9B" casa; renomear
    para um nome cuja chave já existe no ano: `CONFLITO`; para "Turma Azul": `chave` nula.
  - [P] "8B" renomeada para "8A" contra o job criando "8A": uma turma; a renomeação que perde responde `CONFLITO`, o job
    que perde sai `desatualizada`, nunca `falhou`.
  - [I] Turma "8A" da escola B não casa com a planilha da A, que sai "turma nova".
  - [P] Turma tocada renomeada de "8A" para "9B" entre o passo (2) e o (3): `desatualizada`; nenhum aluno da linha "8A"
    vai para a "9B".
  - [I] Migration com duas turmas de mesma chave no ano: as duas com `chave` nula, e a prévia dá erro.
  - [I] Turma nova nasce na série certa (6–9 Fundamental, 1–3 Médio), criando a série se faltar.
  - [I] Matrícula repetida na mesma planilha: erro nas duas linhas.
  - [P] Aluno novo de matrícula M na planilha e, com barreira entre o (2) e o (3), nome avulso lançado à mão na mesma
    escola com a matrícula M: `desatualizada`, nunca `falhou`; zero `lista_nome` da planilha gravadas; a avulsa intacta.
  - [P] O mesmo com a matrícula M de um aluno **aprovado** lançado entre o (2) e o (3): o (3) relê a
    `credencial_matricula` sob a trava e a assinatura muda (não há único entre ela e a `lista_nome`): `desatualizada`, nunca `falhou`.
  - Nos [P] de único violado (matrícula, as duas `chave`, vínculo à mão com a mesma tripla) o `desatualizada` sai **na
    mesma execução**: o processor é chamado uma vez (tentativa 1), e o teste não chega ao estado final pelo BullMQ, que
    passaria com "único violado vira nova tentativa".
  - [I] Homônimos na mesma turma, com matrículas diferentes: dois alunos.
- **RF4.**
  - [I] Mesma planilha duas vezes: segunda prévia só "já existe", e o banco não muda.
  - [I] Nome corrigido do aluno **aprovado** atualiza `usuario.nome` (achado pela `credencial_matricula`); do não
    aprovado, a `lista_nome`. Os dois auditam por aluno (`usuario.nome_corrigido`, `lista.nome_corrigido`), sem nome, e
    nenhum esbarra no `lista_nome_aprovado_sem_nome`.
  - [P] Aprovação do mesmo nome confirmada entre o passo (2) e o (3) do job: `desatualizada`, nunca `falhou` pelo check.
  - [P] Aprovação parada depois de travar o pedido, com o job no passo (3), e o inverso: só o estado final é conferido
    (`desatualizada`, ou a aprovação lê o nome já corrigido); nunca o nome antigo com `concluida`; zero `40P01` nos dois
    lados.
  - [P] Pedido criado e aprovado durante o passo (3): os pedidos são relidos sob a trava; o desfecho é `desatualizada` ou
    a reivindicação recusada, nunca o nome antigo com `concluida`.
  - [I] Ausente na planilha segue ativo sem marca; com marca, desliga.
  - [I] Só é candidato a desligar quem é de turma que a planilha cita (linha sem erro, turma única): a turma ambígua ou com erro não oferece ninguém, e quem está na planilha, aprovado ou não, nunca é candidato.
  - [I] A matrícula em outra turma é "muda de turma" mesmo com o nome diferente: o nome não é corrigido junto, e o candidato a transferir traz o nome do banco.
  - [I] `nomes_corrigidos` e `corrigidos` ausentes valem zero: nada de nome corrigido, nada na resposta nem na `planilha.gravada`.
  - [I] A lista da turma (texto, sem coluna de turma) segue as mesmas regras: 202, `turmaId` conferido na escola e no ano, e o corpo grande (3.000 linhas) passa.
  - [I] Matrícula da escola B na planilha da A sai "entra", nunca "nome corrigido" com o nome da B.
- **RF5.**
  - [I] Transferido: alcança a nova, não a antiga; a resposta de atividade continua presa à turma antiga.
  - [I] Transferência de aluno: o vínculo antigo é encerrado por `realocacao` pelo `encerrarDosAlunos`, que faz a mesma escrita do `encerrar`. Não há `acesso_turma` a revogar, porque o aluno não gera acesso.
  - [I] "Sai da grade" (professor) passa pelo `encerrar`: o acesso da turma do último vínculo confirmado é revogado.
  - [I] Desligado não entra por matrícula, e as sessões caem (a conta da escola do aluno é da F2c).
  - [I] Nome não aprovado desligado sai da `lista_nome`, o pedido pendente fica `encerrada`, `lista_nome.retirado` sem nome.
  - [I] Transferido com pedido pendente: pedido `encerrada`, nome livre na turma nova.
  - [I] A turma nova que só a linha "muda de turma" pede nasce só com a marca; sem a marca nada é criado. `transferidos` só aparece no `resumo` quando é maior que zero.
  - [P] Job de transferência contra o professor aprovando o pedido da mesma linha, uma parte parada no meio: nenhum aluno
    aprovado fica na turma antiga.
  - [P] Reivindicação parada no nome da turma antiga contra o passo (3) da transferência ou do desligamento: reivindicação
    recusada ou job `desatualizada`; nunca pedido pendente com o nome em outra turma ou com o nome nulo.
  - [P] Aluno a transferir desativado à mão entre o passo (2) e o (3): `desatualizada`, sem vínculo novo, a `lista_nome` intacta e os outros marcados intactos.
  - [P] Vínculo do aluno a transferir encerrado à mão entre o (2) e o (3): `desatualizada`, sem vínculo novo.
  - [P] Passo (3) corrigindo o nome e desligando X, com barreira, contra a coordenação desativando X e eliminando X: zero
    `40P01` na requisição; o job conclui, tenta de novo ou sai `desatualizada`. O espião no SQL confere a ordem global
    (importação, ano, usuários, contas, turmas, pedidos) no job, no `desativar` e no `eliminar`.
  - [P] Desligamento de não aprovado contra a decisão do mesmo pedido: pedido `encerrada` ou decidido, nunca pendente sem
    nome; o job nunca `falhou` pelo check.
- **Virada de ano.**
  - [I] Aluno aprovado do ano encerrado na planilha do planejado: "volta", vínculo confirmado na turma nova, mesmo login, e a
    linha `aprovado` na lista do planejado; o vínculo do ano encerrado fica intacto; a mesma planilha de novo é "já existe".
  - [I] Aluno desativado na planilha do planejado, sem linha no ano: erro na linha (`aluno_desativado`); no ano em curso, ou
    com linha no ano, a matrícula segue "já existe".
  - [I] Gravar a grade e o calendário do ano planejado não toca as alocações nem os eventos do ano anterior.
  - [I] Vínculo pendente da grade do ano planejado: o professor não o vê nem confirma; com o ano em curso, confirma.
- **RF6.**
  - [I] Mesmo e-mail duas vezes, uma pessoa; conta de outra escola cliente ganha o segundo vínculo no aceite (pelo link
    copiado; a F2c passa a exigir o e-mail verificado nesse aceite e reescreve este caso).
  - [I] Prévia de professores não distingue e-mail com conta na B de e-mail novo.
  - [P] Duas escolas importam o mesmo professor ao mesmo tempo: as duas `concluida`, uma `conta`.
  - [I] 301 linhas: erro de teto; 300 entram.
  - [I] Professor ausente na reimportação segue ativo sem marca; marcado, é desligado pelo `desativar`.
  - [I] Ausente `pendente` (convidado pela planilha anterior) não sai entre os candidatos; marcado: `ENTRADA_INVALIDA`, e
    o convite dele segue aberto. Ausente `aceito` que não entrou é candidato e, marcado, sai `desativado`.
  - [P] Candidato desativado por outro caminho entre o (2) e o (3): o `NAO_ENCONTRADO` do `desativar` deixa a importação
    `desatualizada`, sem escrita.
  - [P] Cadastrar, refazer ou revogar o convite da escola em curso (a trava do convite da escola na mão): o (3) da
    planilha de professores espera, estoura o `lock_timeout` e volta; a nova tentativa conclui.
  - [I] O `desativar` encerra os vínculos da pessoa (professor ou aluno) na escola, por pessoa e sem o ano do contexto, no ano em curso e no planejado, e revoga o convite aberto
    (N1 da A1). O convite aberto em usuário ativo não nasce por rota nenhuma: o caso é defesa, com o estado montado no
    banco e dito no nome do teste.
  - [I] Professor pendente, cadastrado pela rota real (`POST /v1/professores`): o `desativar` responde `NAO_ENCONTRADO`,
    igual ao inexistente, e não toca o convite nem os vínculos; o `convite/revogar` da A1 é que o tira.
  - [I] Professor que aceitou com a conta que já tinha senha e não entrou: o `desativar` responde como ao ativo, os
    vínculos são encerrados, o estado na lista vira `desativado`, e o login com o bilhete não o ativa.
  - [P] `desativar` × aceite com conta sem senha, nas duas ordens: zero `40P01`; quando a desativação vem depois,
    `usado_em < desativado_em` e o bilhete não reativa (o fechamento vem do `clock_timestamp()`).
  - [P] `desativar` × `ativar` do login do à espera: o usuário termina inativo e sem vínculo aberto.
  - [I] Professor desligado pela planilha: o passo (3) trava todas as turmas dos vínculos dele, em qualquer estado (o
    mesmo conjunto do `travarContraOGerarDoProfessor`), antes dos pedidos.
  - [P] Duas escolas desligando pela planilha o mesmo professor ao mesmo tempo: as duas `concluida`, nenhuma `falhou`
    (o `40P01` entre os jobs vira nova tentativa da fila, e a importação não guarda erro).
  - [I] Professor cadastrado pelo job aparece `pendente` na lista; "Copiar link" passa pelo `convite/refazer`.
  - [I] O `resumo` do job e a `planilha.gravada` não distinguem e-mail com conta em outra escola de e-mail novo.
- **RF7 e RF8.**
  - [I] Professor em duas turmas no mesmo horário e turma com duas aulas: aviso, e grava; 9h às 8h: erro.
  - [I] Professor com duas disciplinas na turma: dois vínculos pendentes.
  - [I] Disciplina e professor inexistentes saem "novo" na prévia e nascem ao gravar.
  - [I] Linha da grade sem professor: erro na linha.
  - [I] Professor da grade não alcança a turma antes de confirmar.
  - [I] Vínculo confirmado não muda; vínculo à mão com a mesma tripla é reaproveitado, sem pendente duplicado.
  - [I] Vínculo encerrado com a mesma tripla não é reaberto: nasce um pendente.
  - [I] Reimportar não reabre o contestado.
  - [P] Vínculo que a grade ia reaproveitar encerrado à mão entre o (2) e o (3): `desatualizada`, nenhuma alocação em
    vínculo encerrado.
  - [P] Vínculo à mão com a mesma tripla criado entre o (2) e o (3): `desatualizada`, nunca `falhou`.
  - [P] Professor da grade desativado entre o (2) e o (3): `desatualizada`.
  - [P] Job com as turmas T1 e T2 contra o `desativar` do professor das duas, que as trava em ordem inversa à do vínculo:
    zero `40P01` na requisição (as duas travam por id, num comando). Ao lado do estado final, um espião no SQL confere um
    único `for no key update` com `order by id` sobre todas as turmas, no job e no `desativar`.
- **RF9.**
  - [I] Reimportar mantém o id da alocação por (vínculo, dia, início).
  - [I] Vínculo da grade sem aulas aparece "sai da grade" e só encerra marcado; o à mão sem aula fica e não é candidato.
- **RF10.**
  - [I] Data fora do ano é erro; reimportar substitui só no ano de destino, e a prévia mostra o que entra e o que sai.
- **Job e estados.**
  - [P] Gravar duas vezes: uma `na_fila`, a outra `CONFLITO`.
  - [P] Duas execuções do mesmo job, com barreira que deixa as duas passarem pelo (2) antes do (3): um efeito só nas
    contagens de turma, vínculo e `lista_nome`; a segunda, depois do `for update`, acha a importação fora de `na_fila` e
    sai sem reler nada; estado `concluida`, e a métrica "job por resultado" (§7c) conta uma `concluida` e uma `ignorada`.
  - [I] Assinatura diferente: `desatualizada`; ano encerrado entre gravar e o job: `desatualizada`.
  - [I] `linhas` e `marcas` nulas em `concluida`, `desatualizada` e `falhou`; a linha final sai em 90 dias.
  - [I] Quem gravou já saiu (`criado_por` nulo): o job sai `desatualizada`, sem gravar e sem auditoria.
  - [I] `na_fila` há mais de 1 h: o gravar seguinte a fecha `falhou` (`expirou`); travada por um job rodando, o gravar
    responde `CONFLITO` sem esperar. A rotina que fecha a `na_fila` parada roda à 1h: o dado da planilha pode ficar, na pior hipótese,
    cerca de 25 h, e "1 h" não quer dizer em tempo real.
  - [I] Tentativas esgotadas, e falha definitiva: `falhou` com o código, `linhas` e `marcas` nulas.
  - [I] Sem gravar novo, relógio falso: com 59 min o `retencao.expurgar-escola` mantém a `na_fila`; com 61 min a fecha
    `falhou`, com `linhas` e `marcas` nulas.
  - [I] Falha injetada no segundo lote de uma planilha de 1.200 linhas, em toda tentativa: entre as tentativas, a importação
    segue `na_fila` com zero linhas novas; no fim, zero turmas, vínculos e `lista_nome` novos, e `falhou`. As contas do
    passo (1) podem ficar, sem vínculo, e o `sistema.expurgar-acesso` da madrugada tira o e-mail da conta sem usuário.
  - [P] `encerrar` do ano com o job pausado: o job espera o `FOR SHARE` ou sai `desatualizada`; nunca grava no ano
    encerrado.
  - [P] Expurgo com o job segurando a linha: o expurgo pula (`skip locked`) e não espera.
  - [P] Duas escolas importando os mesmos professores em ordens opostas: as duas `concluida` (contas em transações curtas,
    na ordem do e-mail; trava esgotada vira nova tentativa).
  - [I] A importação final sai em 90 dias pelo `sistema.expurgar-acesso`; com 89, fica.
  - [I] Turma travada por outra transação por mais de 1 s durante o passo (3): nenhuma escrita parcial; a importação segue
    `na_fila` na primeira vez; solta a trava, a nova tentativa conclui; travada em todas, sai `falhou` na última.
  - [P] Expurgo de acesso entre o passo (1) e o (3), limpando a conta recém-criada: o (3) acha a conta sem e-mail, a nova
    tentativa refaz o (1) e conclui; nenhum convite para conta sem e-mail.
  - [P] Passo (3) contra o gerar acesso e contra o `virarSala` na mesma turma, com barreira: um espera o outro, nenhum
    `40P01` nem 503.
  - [I] O job usa a escola da linha mesmo com o payload adulterado.
  - [I] Ano sem curso: `GET /v1/importacoes/:id` segue respondendo, e só a importação da escola.

## Isolamento e ano letivo (RF16)

- [I] Escola A contra B em: prévia e gravar de cada tipo (com `turmaId` da B na lista por turma), `importacoes/:id`, grade e
  calendário (coordenador e professor).
- [I] Escola sem ano em curso: prévia e gravar com o filtro do ano planejado funcionam; sem filtro, `NAO_ENCONTRADO`;
  planilha de professores funciona; grade e calendário do coordenador aceitam o filtro do planejado; a do professor segue
  o ano em curso.
- [I] Filtro com o ano de outra escola (inclusive o planejado da B) ou com ano encerrado: `NAO_ENCONTRADO`.
- [I] Lista por turma com `turmaId` da escola mas de outro ano: `NAO_ENCONTRADO`.
- [I] Professor só com vínculo pendente ou contestado na turma: grade da turma igual à inexistente.
- [I] Professor com vínculo encerrado na turma X e confirmado na Y: grade só da Y.
- [I] Professor desligado na escola A segue entrando e vendo as turmas na B.

## Auditoria e dado (RF17)

- [I] Uma ação, um registro, linha a linha na tabela "Auditoria" no fim; nenhum registro traz nome nem matrícula.
- [I] Eliminar o professor que gravou planilha e tem alocação: a eliminação passa.
- [I] `contracts.test.ts`: grade sem e-mail.

## A1 que muda de regra

- `apps/api/test/lista.int.test.ts`: E4 (matrícula em uso era `CONFLITO`, passa a "muda de turma"); E6 ("já existe com
  outro nome" passa a "nome corrigido"); o teto de 201 linhas e 64 KB passa a 3.001 linhas e 512 KB; a gravação responde
  202. Cada caso reescrito diz a regra nova no nome.

## E2E (RF1, RF18)

- [E] Escola vazia → quatro planilhas (a de alunos suja) → professor aceita o convite copiado e confirma o que a grade
  definiu → um aluno reivindica com matrícula → aprovação. Dividido em casos com seed compartilhado.
- [E] O modelo servido pela tela, preenchido, entra sem erro.
- [E] Prévia com erro e a grade: a 360 px sem rolagem horizontal, alvo de 44 px nas ações principais e de 24 px em todo
  o resto.
- [E] Prévia carregando e falha: estado visível e "Tentar de novo".

## Corridas

| Corrida | Trava |
|---|---|
| Gravar duas vezes | único parcial `(escolaId)` onde `na_fila`: `CONFLITO` |
| Job duas vezes | `for update` da importação e `where estado = 'na_fila'` |
| Job contra o `desativar` e o `eliminar` | ordem global: importação, ano, usuários, contas, turmas por id num comando, pedidos |
| Job contra a decisão do professor | o job trava turmas em `FOR NO KEY UPDATE`, que não barra o `FOR KEY SHARE` da FK do vínculo da decisão; depois os pedidos, relidos |
| Reivindicação contra o passo (3) | escrita na `lista_nome` com `where estado = :lido`; zero linhas: `desatualizada` |
| Mudança entre o passo (2) e o (3) | o (3) relê o que o (2) usou; diferença: `desatualizada` |
| Expurgo da conta entre o passo (1) e o (3) | conta em `FOR SHARE` com e-mail conferido; nulo: nova tentativa |
| Gravar contra o job na `na_fila` antiga | `for update nowait`: `CONFLITO` |
| Turma à mão, ou renomeada, contra turma do job | único parcial de `turma.chave`; o job sai `desatualizada` |
| Nome corrigido contra aprovação do mesmo nome | o passo (3) trava os pedidos pendentes das turmas; aprovada antes: `update … where estado <> 'aprovado'`, zero linhas, `desatualizada` |
| Expurgo contra o job | `skip locked` e `where … = 'na_fila'` |
| Professor em duas escolas ao mesmo tempo | `contaParaConvite` em transação curta, pelo e-mail único, na ordem do e-mail |

## Limites

Cada linha é um cenário [I]; o semáforo, [P].

| Limite | Valor | Ao passar |
|---|---|---|
| Prévia e gravar, da planilha e da lista da turma (`/v1/turmas/:id/lista/previa` e `/lista`) | 20/min por usuário, no mesmo balde | 429 |
| Prévias simultâneas | 2 por escola, no Redis, com o gravar (o da lista da turma também) ocupando vaga e prazo de validade de 30 s | recusada; a outra escola segue; a vaga volta quando o processo morre |
| Importação `na_fila` | 1 por escola | `CONFLITO` |
| Texto da planilha | 512 KB e 3.000 linhas, só nessas rotas | `ENTRADA_INVALIDA` |
| Corpo JSON de outra rota | 100 KB pelo `Content-Length`, fora de `/v1/importacoes` e de `/v1/turmas/:id/lista` e `/lista/previa` (que têm o teto da planilha); o multipart (material) não entra | `ENTRADA_INVALIDA` |

## Auditoria (RF17)

Cada linha é um cenário [I]: a ação gera um registro com autor e data, e o registro não traz nome nem matrícula.

| Ação | Quando | Detalhe |
|---|---|---|
| `planilha.gravada` | o job conclui | tipo e contagens |
| `usuario.nome_corrigido`, `lista.nome_corrigido` | nome corrigido | por aluno |
| `aluno.transferido` | transferência | turmas de origem e destino |
| `lista.transferida` | transferência do nome ainda não aprovado | turmas de origem e destino |
| `lista_nome.retirado` | desligar não aprovado | — |
| `usuario.desativado` | desligar | — |
| `vinculo.criado`, `vinculo.encerrado` | grade e transferência | origem |
| `turma.alunos_lidos` | prévia com nome do banco | `conferencia_de_cadastro` |
| `turma.criada` (nova) | turma nova pela planilha | série |
| `vinculo.criado` | aluno que "volta" na virada | origem |
