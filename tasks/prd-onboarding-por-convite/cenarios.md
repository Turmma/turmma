# Cenários de teste — onboarding-por-convite

Exigidos pela revisão da spec, rodadas 1 a 6 (`revisao-spec.md`). Cada cenário diz o que precisa falhar se a regra sumir, e cai
numa tarefa do `tasks.md`, que diz qual. I = integração com Postgres real e relógio injetado · U = unidade · E = e2e em
`chromebook` e `celular`, com axe · P = chamadas em paralelo · C = cenário de carga.

## Planilha (RF2 a RF10, RF15)

- **RF2.**
  - [I] Gravar direto, sem prévia, com texto errado: `ENTRADA_INVALIDA` e nenhuma linha em `importacao_planilha`.
  - [I] Marca fora dos candidatos: `ENTRADA_INVALIDA`.
  - [U] Leitor: `;`, tab, UTF-16, BOM, windows-1252; notação científica no CSV é erro na linha.
  - [U] XLSX real na biblioteca real: `00123` em célula de texto chega `00123`; em célula numérica chega `123` e o
    comportamento está escrito no teste.
  - [I] Consultas da prévia constantes entre 30 e 3.000 linhas (contadas, nunca cronometradas).
  - [C] Prévia e gravar com 3.000 linhas: p95 até 2 s com a rajada de login em paralelo.
  - [C] Job de 3.000 linhas com transferências em várias turmas junto com o gerar acesso e a decisão nessas turmas, e o
    de professores junto com o login e o redefinir deles: zero 503 no gerar acesso, na decisão, no login e no redefinir; espera de trava com p95 abaixo de 300 ms; passo (3) do job abaixo de 1 s.
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
  - [I] Matrícula da escola B na planilha da A sai "entra", nunca "nome corrigido" com o nome da B.
- **RF5.**
  - [I] Transferido: alcança a nova, não a antiga; a resposta de atividade continua presa à turma antiga.
  - [I] Transferência e "sai da grade" passam pelo `encerrar`: o acesso da turma do último vínculo confirmado é revogado.
  - [I] Desligado não entra por matrícula nem por conta externa, e as sessões caem.
  - [I] Nome não aprovado desligado sai da `lista_nome`, o pedido pendente fica `encerrada`, `lista_nome.retirado` sem nome.
  - [I] Transferido com pedido pendente: pedido `encerrada`, nome livre na turma nova.
  - [P] Job de transferência contra o professor aprovando o pedido da mesma linha, uma parte parada no meio: nenhum aluno
    aprovado fica na turma antiga.
  - [P] Reivindicação parada no nome da turma antiga contra o passo (3) da transferência ou do desligamento: reivindicação
    recusada ou job `desatualizada`; nunca pedido pendente com o nome em outra turma ou com o nome nulo.
  - [P] Aluno a transferir desativado à mão entre o passo (2) e o (3): `desatualizada`, sem vínculo novo.
  - [P] Vínculo do aluno a transferir encerrado à mão entre o (2) e o (3): `desatualizada`, sem vínculo novo.
  - [P] Passo (3) corrigindo o nome e desligando X, com barreira, contra a coordenação desativando X e eliminando X: zero
    `40P01` na requisição; o job conclui, tenta de novo ou sai `desatualizada`. O espião no SQL confere a ordem global
    (importação, ano, usuários, contas, turmas, pedidos) no job, no `desativar` e no `eliminar`.
  - [P] Desligamento de não aprovado contra a decisão do mesmo pedido: pedido `encerrada` ou decidido, nunca pendente sem
    nome; o job nunca `falhou` pelo check.
- **Virada de ano.**
  - [I] Aluno aprovado do ano encerrado na planilha do planejado: "volta", vínculo confirmado na turma nova, mesmo login.
  - [I] Aluno desativado na planilha: erro na linha.
  - [I] Gravar a grade e o calendário do ano planejado não toca as alocações nem os eventos do ano anterior.
  - [I] Vínculo pendente da grade do ano planejado: o professor não o vê nem confirma; com o ano em curso, confirma.
- **RF6.**
  - [I] Mesmo e-mail duas vezes, uma pessoa; conta de outra escola cliente ganha o segundo vínculo no aceite.
  - [I] Prévia de professores não distingue e-mail com conta na B de e-mail novo.
  - [P] Duas escolas importam o mesmo professor ao mesmo tempo: as duas `concluida`, uma `conta`.
  - [I] 301 linhas: erro de teto; 300 entram.
  - [I] Professor ausente na reimportação segue ativo sem marca; marcado, é desligado pelo `desativar`.
  - [I] Professor desligado pela planilha: o passo (3) trava todas as turmas dos vínculos dele, em qualquer estado (o
    mesmo conjunto do `travarContraOGerarDoProfessor`), antes dos pedidos.
  - [P] Duas escolas desligando pela planilha o mesmo professor ao mesmo tempo: as duas `concluida` (o `40P01` entre os
    jobs vira nova tentativa), nenhuma requisição no ciclo.
  - [I] Professor cadastrado pelo job aparece `pendente` na lista; "Copiar link" passa pelo `convite/refazer`; o "Enviar"
    sem seleção o inclui.
  - [I] O `resumo` do job e a `planilha.gravada` não distinguem e-mail com conta em outra escola de e-mail novo.
- **RF7 e RF8.**
  - [I] Professor em duas turmas no mesmo horário e turma com duas aulas: aviso, e grava; 9h às 8h: erro.
  - [I] Professor com duas disciplinas na turma: dois vínculos pendentes.
  - [I] Disciplina e professor inexistentes saem "novo" na prévia e nascem ao gravar; o professor novo entra no "Enviar"
    seguinte.
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
  - [I] `na_fila` há mais de 1 h: o gravar seguinte a fecha `falhou` (`expirada`); travada por um job rodando, o gravar
    responde `CONFLITO` sem esperar.
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

## E-mail, convite e posse (RF11, RF12)

- **RF11.**
  - [I] O corpo capturado pelo falso traz a escola e o link, e nenhum nome da lista.
  - [I] "Enviar" sem seleção exclui quem já aceitou.
  - [I] Revogado entre a fila e o envio: `cancelado`, zero envios.
  - [I] Refazer invalida o link anterior no aceite; só o último link gerado é aceito.
  - [I] Convite copiado e aberto, criado há 2 dias (relógio falso): "Enviar" cria convite de id novo, o token copiado é
    recusado no aceite, o `retencao.expurgar-escola` logo depois não grava `falhou` no envio novo, e com mais de 24 h do
    novo `criadoEm` grava. O mesmo com "Reenviar". O diálogo do "Enviar" avisa que os links copiados antes deixam de valer.
  - [I] SMTP 5xx: `falhou` sem nova tentativa. 4xx: a linha volta a `na_fila`, o segundo envio chega ao falso e a linha
    termina `enviado`; com revogação entre as tentativas, termina `cancelado`, sem segundo envio. Recusa na entrega
    mostra "falhou" na lista.
  - [P] Reentrega com a reserva de outro processo ainda vigente: adia até o prazo, sem gastar tentativa, e então envia.
  - [I] 4xx em toda tentativa, no convite e no link da conta: `envio = 'falhou'` na última e cifrados nulos nos dois; o
    convite mostra "falhou" na lista (o link da conta não aparece em lista).
  - [I] `EMAIL_POR_MINUTO` estourado: o job é adiado, nenhum `falhou`.
  - [I] Envio do convite `na_fila` e `enviando`, relógio falso: com 23 h ficam; com mais de 24 h o
    `retencao.expurgar-escola` grava `falhou` e anula os cifrados.
  - [I] Cifrados nulos em `enviado`, `falhou`, `cancelado` e na revogação; nem token nem e-mail no log do worker.
  - [P] Job de e-mail duas vezes depois de `enviado`: um envio só. Duas execuções ao mesmo tempo: um envio (a reserva).
    Reserva de processo morto há mais de 2 min: retomada, um envio.
  - [P] Revogação com o SMTP falso preso numa barreira, linha `enviando`: a revogação responde na hora, a linha termina
    `cancelado` (o `enviado` do job não casa) e o link é recusado no aceite, mesmo que o e-mail tenha saído.
  - [P] `desativar` com o envio do convite `enviando`: termina `cancelado`, e o link é recusado no aceite.
  - [P] Link novo pelo "esqueci" e pelo verificar com o envio do antigo `enviando`: o antigo termina `cancelado`, com os
    cifrados nulos, e o token antigo é recusado em `/redefinir` e em `/conta/verificar`.
  - [P] Dois "Enviar convites" ao mesmo tempo: um convite aberto e um e-mail por professor (o do convite que perdeu sai
    `cancelado`); quem perde o `convite_pendente_unico` recebe a contagem, nunca 500.
  - [I] `email.enviar-convite` leva a escola do convite no `job_registro`; id de convite da B num job da A: nada enviado;
    payload adulterado: vale a escola do registro.
  - [I] `sistema.enviar-email-da-conta` tem escola nula e só lê pelo id do job.
  - [I] Convites 300/h por escola: 429, e a outra escola segue.
  - [I] `desativar` revoga o convite aberto e cancela o envio na fila.
- **Posse do e-mail.**
  - [I] Aceite pelo e-mail grava `emailVerificadoEm`; pelo link copiado, não.
  - [I] Conta não verificada aceitando convite copiado de outra escola: `VERIFICACAO_PENDENTE` e link de verificar;
    depois de verificar, o aceite segue; a senha definida pelo link de uma escola não abre o convite de outra.
  - [I] Quarto aceite na hora: `VERIFICACAO_PENDENTE` e três envios, cada um com link novo que invalida o anterior; o
    envio do link antigo ainda `na_fila` vira `cancelado`, com os cifrados nulos, e não sai.
  - [P] Dois aceites que precisam de verificação ao mesmo tempo: os dois `VERIFICACAO_PENDENTE`, nunca 500.
  - [I] Conta nova criada pelo próprio convite copiado: aceita sem verificação (não tinha senha).
  - [I] Redefinir pelo "esqueci" grava `emailVerificadoEm`.
- **RF12.**
  - [I] Resposta igual para e-mail com e sem conta, com o piso provado por relógio falso, nunca cronômetro.
  - [I] O link vence em 1 h e não serve duas vezes; redefinir derruba as sessões; o MFA continua exigido.
  - [I] Conta desligada: 202 sem link; o quarto pedido na hora: 202 e três envios.
  - [I] Balde `rl:ip:senha` cheio: 202 sem envio, nunca 429; o login do mesmo IP segue.
  - [P] Esqueci com o link da conta em envio (`enviando`): 202, com o piso provado por relógio falso, nunca 503.
  - [I] Envio do link da conta `na_fila` e `enviando`, relógio falso: com 23 h ficam; com mais de 24 h o
    `sistema.expurgar-acesso` grava `falhou` e anula os cifrados.
  - [I] Token inválido não ocupa o semáforo do argon2.
  - [P] Dois "esqueci" em paralelo: os dois 202, um link aberto, e o perdedor do índice único respeita o piso (relógio
    falso). Dois "redefinir": um só troca.
  - [I] `link_da_conta` sai 30 dias depois do uso ou do vencimento.

## Senha provisória (RF13)

- [I] Coordenação e professor com vínculo confirmado geram; pendente, contestado, encerrado, aluno de outra turma ou escola:
  404 igual.
- [I] Professor da turma antiga de aluno transferido: 404; o da nova: gera.
- [I] Aluno com pedido pendente: 404; aluno com conta da escola ligada, só com ela ou também com senha: `SEM_SENHA`
  para quem gera, e a senha dele não muda; o mesmo aluno, para um professor de outra turma: 404.
- [I] A senha anterior e a provisória anterior param de valer; as sessões caem.
- [I] Login com a provisória devolve bilhete, não sessão; o bilhete não abre outra rota; a provisória vence em 24 h.
- [I] Login de matrícula inexistente, de aluno só com conta externa e com senha errada: mesma resposta; o aluno sem
  `senha_hash` passa pelo hash fixo (contado por espião no argon2, nunca cronometrado).
- [U] O bilhete é cifrado: o texto dele não contém o hash da provisória; adulterado, recusado.
- [I] `/trocas` lista as provisórias geradas antes, com data, papel de quem gerou (lido do `depois` da `.gerada`, mesmo
  com o autor eliminado) e se foi usada: a gerada e usada por outra pessoa aparece na troca seguinte do aluno. Não alcança
  outro aluno; bilhete de provisória substituída ou vencida: recusado; bilhete na query: recusado.
- [E] Tela de troca: primeira troca mostra a frase "primeira vez", sem tabela vazia; falha da lista mostra aviso com
  "Tentar de novo" e não bloqueia o campo de senha; bilhete vencido: "peça a senha de novo ao professor"; datas em
  português ("Gerada pela coordenação em 12/11/2026 às 14:05").
- [I] `senha_provisoria.gerada` e `.usada` aparecem no arquivo do titular do aluno; `.usada` tem o aluno como autor.
- [I] Trocar-senha conta no contador de falhas da conta.
- [I] Provisória vencida, relógio falso: com 23 h o `retencao.expurgar-escola` a mantém; com 25 h anula hash, validade e
  quem gerou; a auditoria fica. A troca e o `desativar` do aluno também anulam as três colunas.
- [P] Duas trocas com o mesmo bilhete: uma sessão. Bilhete de provisória já substituída: recusado.
- [I] `senha_provisoria.gerada` e `senha_provisoria.usada` na auditoria, sem senha.
- [I] Cotas: 60/h por usuário e 5/dia por aluno, contadas só depois da checagem de escopo.

## Conta da escola do aluno (RF14)

- [I] Domínio não liberado: recusado; cookie vencido: recusado; cookie da sala da escola A num pedido da B, ou de outro
  acesso: a resposta do cookie inválido.
- [I] O cookie é apagado ao gravar o pedido e não serve a um segundo.
- [I] Aprovar liga a conta e o aluno entra por ela; `contaExterna` nula depois de aprovar e de recusar.
- [I] Conta ligada a outro: `CONFLITO` sem nome nem id; `ligar` com sessão de professor: recusado.
- [I] O banco não guarda e-mail nem foto do provedor (`reivindicacao` e `conta_externa` conferidas coluna a coluna).
- [I] Aluno entrou por matrícula, liga a conta em "Eu" e passa a entrar por ela.
- [I] Ano sem curso: `externa/iniciar` responde como hoje, sem abrir pedido.
- [I] Pedido de conta pendente encerrado pela transferência no job e pela virada do ano: `contaExterna` nula, sem
  `decididaEm`, `decididaPor` nem `decididaComo`.
- [I] O check novo, direto no banco: recusa pendente com senha e conta juntas, pendente sem nenhuma das duas, e pedido
  decidido ou encerrado com `contaExterna`.
- [P] Mesma conta em dois pedidos: o segundo é recusado (único por provedor, tenant e sujeito). Clique duplo em aprovar: uma `conta_externa`. Ligar a mesma conta
  duas vezes: uma.

## Isolamento e ano letivo (RF16)

- [I] Escola A contra B em: prévia e gravar de cada tipo (com `turmaId` da B na lista por turma), `importacoes/:id`, grade e
  calendário (coordenador e professor), `convites/enviar` com `usuarioIds` da B (igual a inexistente, nada na fila),
  provisória, ligação de conta, os dois jobs de e-mail.
- [I] Escola sem ano em curso: prévia e gravar com o filtro do ano planejado funcionam; sem filtro, `NAO_ENCONTRADO`;
  planilha de professores e `convites/enviar` funcionam; grade e calendário do coordenador aceitam o filtro do planejado;
  a do professor, provisória e login seguem o ano em curso.
- [I] Filtro com o ano de outra escola (inclusive o planejado da B) ou com ano encerrado: `NAO_ENCONTRADO`.
- [I] Lista por turma com `turmaId` da escola mas de outro ano: `NAO_ENCONTRADO`.
- [I] Professor só com vínculo pendente ou contestado na turma: grade da turma igual à inexistente.
- [I] Professor com vínculo encerrado na turma X e confirmado na Y: grade só da Y.
- [I] Professor desligado na escola A segue entrando e vendo as turmas na B.

## Auditoria e dado (RF17)

- [I] Uma ação, um registro, linha a linha na tabela "Auditoria" no fim; nenhum registro traz nome nem matrícula.
- [I] Eliminar o professor que gerou provisória, gravou planilha e tem alocação: a eliminação passa.
- [I] `contracts.test.ts`: grade sem e-mail; nenhuma saída com cifrado.

## A1 que muda de regra

- `apps/api/test/convite.int.test.ts`: os casos em que uma conta de outra escola aceita convite por link copiado (linhas 320,
  377 e 447) passam a exigir o e-mail verificado.
- `apps/api/test/lista.int.test.ts`: E4 (matrícula em uso era `CONFLITO`, passa a "muda de turma"); E6 ("já existe com
  outro nome" passa a "nome corrigido"); o teto de 201 linhas e 64 KB passa a 3.001 linhas e 512 KB; a gravação responde
  202. Cada caso reescrito diz a regra nova no nome.

## E2E (RF1, RF18)

- [E] Escola vazia → quatro planilhas (a de alunos suja) → convites pelo Mailpit → professor confirma o que a grade definiu
  → um aluno reivindica com a conta da escola (o `oidc-falso`) e outro com matrícula → aprovação. Dividido em casos com
  seed compartilhado.
- [E] O modelo servido pela tela, preenchido, entra sem erro.
- [E] Esqueci → redefinir; provisória → troca; verificar; conta da escola na sala e em "Eu"; prévia com erro: a 360 px
  sem rolagem horizontal, alvo de 44 px nas ações principais e de 24 px em todo o resto.
- [E] Prévia carregando e falha: estado visível e "Tentar de novo".
- [E] Gerar provisória para aluno com conta da escola: a tela diz que ele entra pela conta.

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
| Dois "Enviar convites" | `convite_pendente_unico`, vale o último |
| E-mail duas vezes | reserva `enviando` com prazo; `enviado` só com a minha reserva; reserva alheia vigente: adia |
| Revogação ou link novo durante o envio | grava `cancelado` na hora; o link revogado não vale |
| Dois aceites com verificação | único `(contaId, finalidade)` aberto; quem perde: `VERIFICACAO_PENDENTE` |
| Dois "esqueci" | único parcial `(contaId, finalidade)` aberto |
| Redefinir duas vezes | `usado_em is null` |
| Troca da provisória duas vezes | o `update` condicionado ao hash do bilhete |
| Mesma conta em dois pedidos | único parcial `(escolaId, provedor, tenant, sujeito)` onde pendente |
| Ligar a mesma conta duas vezes | `conta_externa` única, `CONFLITO` sem nome |
| Turma à mão, ou renomeada, contra turma do job | único parcial de `turma.chave`; o job sai `desatualizada` |
| Nome corrigido contra aprovação do mesmo nome | o passo (3) trava os pedidos pendentes das turmas; aprovada antes: `update … where estado <> 'aprovado'`, zero linhas, `desatualizada` |
| Expurgo contra o job | `skip locked` e `where … = 'na_fila'` |
| Professor em duas escolas ao mesmo tempo | `contaParaConvite` em transação curta, pelo e-mail único, na ordem do e-mail |

## Limites

Cada linha é um cenário [I]; o semáforo, [P].

| Limite | Valor | Ao passar |
|---|---|---|
| Prévia e gravar | 20/min por usuário, no mesmo balde | 429 |
| Prévias simultâneas | 2 por escola, no Redis, com o gravar ocupando vaga e prazo de validade | recusada; a outra escola segue; a vaga volta quando o processo morre |
| Importação `na_fila` | 1 por escola | `CONFLITO` |
| Texto da planilha | 512 KB e 3.000 linhas, só nessas rotas | `ENTRADA_INVALIDA` |
| Convites | 300/h por escola | 429; a outra escola segue |
| Esqueci | balde `rl:ip:senha`, 100/h; 3/h pelo hash do e-mail | 202 sem envio, nunca 429; o login do mesmo IP segue |
| Verificar no aceite | 3/h por conta | `VERIFICACAO_PENDENTE` sem envio |
| Provisória | 60/h por usuário e 5/dia por aluno, contadas depois do escopo | 429 |
| Trocar-senha | o contador de falhas da conta | o bloqueio do login |
| `EMAIL_POR_MINUTO` | global, abaixo da do provedor, com metade reservada ao link da conta | o job adia sem gastar tentativa e solta a vaga (o link que vem depois sai no mesmo minuto); com os convites enchendo a metade deles, um link da conta ainda sai no minuto e um convite a mais é adiado |

## Auditoria (RF17)

Cada linha é um cenário [I]: a ação gera um registro com autor e data, e o registro não traz nome nem matrícula.

| Ação | Quando | Detalhe |
|---|---|---|
| `planilha.gravada` | o job conclui | tipo e contagens |
| `usuario.nome_corrigido`, `lista.nome_corrigido` | nome corrigido | por aluno |
| `aluno.transferido` | transferência | turmas de origem e destino |
| `lista_nome.retirado` | desligar não aprovado | — |
| `usuario.desativado` | desligar | — |
| `vinculo.criado`, `vinculo.encerrado` | grade e transferência | origem |
| `convite.enviado` | job de e-mail | canal |
| `senha_provisoria.gerada` | gerar | papel de quem gerou no `depois`; aluno como alvo |
| `senha_provisoria.usada` | troca | autor: o aluno |
| `senha.redefinida` | redefinir | — |
| `conta.email_verificado` | aceite por e-mail, verificar, redefinir | — |
| `conta_externa.ligada` | aprovar com conta, ligar em "Eu" | — |
| `turma.alunos_lidos` | prévia com nome do banco | `conferencia_de_cadastro` |
| `turma.criada` (nova) | turma nova pela planilha | série |
| `vinculo.criado` | aluno que "volta" na virada | origem |
