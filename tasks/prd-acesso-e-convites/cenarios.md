# Cenários de teste — acesso-e-convites

Exigidos pela revisão da spec do F2, rodadas 1 a 8 (`tasks/prd-onboarding-por-convite/revisao-spec.md`), e separados dele
no corte de 03/11/2026, sem mudar nenhum; a conferência do corte (rodadas 9 e 10) acrescentou o [C] de "Carga", o
aluno desligado pela conta da escola e a seção "A1 e F2 que mudam de regra". I = integração com Postgres real e relógio injetado · U = unidade · E = e2e em
`chromebook` e `celular`, com axe · P = chamadas em paralelo.

## E-mail, convite e posse (RF11, RF12)

- **RF11.**
  - [I] O corpo capturado pelo falso traz a escola e o link, e nenhum nome da lista.
  - [I] "Enviar" sem seleção exclui quem já aceitou.
  - [I] Revogado entre a fila e o envio: `cancelado`, zero envios.
  - [I] Refazer invalida o link anterior no aceite; só o último link gerado é aceito.
  - [I] Convite copiado e aberto, criado há 2 dias (relógio falso): "Enviar" cria convite de id novo, o token copiado é
    recusado no aceite, o `retencao.expurgar-escola` logo depois não grava `falhou` no envio novo, e com mais de 24 h do
    novo `criadoEm` grava. O mesmo com "Reenviar".
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
  - [I] `desativar` cancela o envio na fila (a revogação do convite é do F2).
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

- [I] Escola A contra B em: `convites/enviar` com `usuarioIds` da B (igual a inexistente, nada na fila), provisória,
  ligação de conta, os dois jobs de e-mail.
- [I] Escola sem ano em curso: `convites/enviar` funciona; provisória e login seguem o ano em curso.
- [I] Professor cadastrado pela planilha ou pela grade do F2 entra no "Enviar" sem seleção seguinte.

## Auditoria e dado (RF17)

- [I] Uma ação, um registro, linha a linha na tabela "Auditoria" no fim; nenhum registro traz nome nem matrícula.
- [I] Eliminar o professor que gerou provisória: a eliminação passa.
- [I] `contracts.test.ts`: nenhuma saída com cifrado.
- [I] Aluno desligado pela planilha do F2 não entra pela conta da escola ligada.

## Carga

- [C] Job de professores do F2 com 300 linhas junto da rajada de login (com provisória e conta externa) e do redefinir
  dos mesmos professores: zero 503 no login e no redefinir; passo (3) do job abaixo de 1 s.

## A1 e F2 que mudam de regra

- `apps/api/test/convite.int.test.ts`: os casos em que uma conta de outra escola aceita convite por link copiado (linhas 320,
  377 e 447) passam a exigir o e-mail verificado.
- O caso do RF6 do F2 (`tasks/prd-onboarding-por-convite/cenarios.md`, "conta de outra escola cliente ganha o segundo
  vínculo no aceite"), escrito com o link copiado: passa a exigir o e-mail verificado, com a regra nova no nome.

## E2E (RF18)

- [E] Convites pelo Mailpit → professor aceita; esqueci → redefinir; verificar; um aluno reivindica com a conta da escola
  (o `oidc-falso`) → aprovação; provisória → troca; conta da escola em "Eu": a 360 px sem rolagem horizontal, alvo de
  44 px nas ações principais e de 24 px em todo o resto.
- [E] Gerar provisória para aluno com conta da escola: a tela diz que ele entra pela conta.
- [E] O diálogo do "Enviar convites" diz que os links enviados ou copiados antes deixam de valer.

## Corridas

| Corrida | Trava |
|---|---|
| Dois "Enviar convites" | `convite_pendente_unico`, vale o último |
| E-mail duas vezes | reserva `enviando` com prazo; `enviado` só com a minha reserva; reserva alheia vigente: adia |
| Revogação ou link novo durante o envio | grava `cancelado` na hora; o link revogado não vale |
| Dois aceites com verificação | único `(contaId, finalidade)` aberto; quem perde: `VERIFICACAO_PENDENTE` |
| Dois "esqueci" | único parcial `(contaId, finalidade)` aberto |
| Redefinir duas vezes | `usado_em is null` |
| Troca da provisória duas vezes | o `update` condicionado ao hash do bilhete |
| Mesma conta em dois pedidos | único parcial `(escolaId, provedor, tenant, sujeito)` onde pendente |
| Ligar a mesma conta duas vezes | `conta_externa` única, `CONFLITO` sem nome |

## Limites

Cada linha é um cenário [I]; o semáforo, [P].

| Limite | Valor | Ao passar |
|---|---|---|
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
| `convite.enviado` | job de e-mail | canal |
| `senha_provisoria.gerada` | gerar | papel de quem gerou no `depois`; aluno como alvo |
| `senha_provisoria.usada` | troca | autor: o aluno |
| `senha.redefinida` | redefinir | — |
| `conta.email_verificado` | aceite por e-mail, verificar, redefinir | — |
| `conta_externa.ligada` | aprovar com conta, ligar em "Eu" | — |
