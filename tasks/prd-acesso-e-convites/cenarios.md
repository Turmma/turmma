# Cenários de teste — acesso-e-convites

Exigidos pela revisão da spec do F2, rodadas 1 a 8 (`tasks/prd-onboarding-por-convite/revisao-spec.md`), e separados dele
no corte de 03/11/2026, sem mudar nenhum; a conferência do corte (rodadas 9 e 10) acrescentou o [C] de "Carga", o
aluno desligado pela conta da escola e a seção "A1 e F2 que mudam de regra"; a revisão desta spec (`revisao-spec.md`,
rodada 1) acrescentou os casos marcados (F2c) e as seções "Arquivo do titular" e "Telas". I = integração com Postgres real e relógio injetado · U = unidade · E = e2e em
`chromebook` e `celular`, com axe · P = chamadas em paralelo.

## E-mail, convite e posse (RF11, RF12)

- **RF11.**
  - [I] O corpo capturado pelo falso traz a escola e o link, e nenhum nome da lista; o token vai depois do `#`, nunca na
    query (também no redefinir e no verificar). (F2c)
  - [U] Fora do ambiente local, sem `EMAIL_PROVEDOR_ID`, sem TLS ou com o host do Mailpit: a configuração recusa a
    partida, nos três casos. (F2c)
  - [I] "Enviar" sem seleção exclui quem já aceitou e inclui o vencido. (F2c)
  - [I] "Enviar" com seleção que mistura pendente, vencido, revogado, aceito, ativo e desativado: só pendente e vencido
    entram na fila, a contagem diz quantos, nunca 409 pelo lote. Com 2 pontos restantes na cota, a seleção de 6 (2
    pendentes ou vencidos, 4 aceitos, revogados ou desativados) passa e a cota zera (um "Enviar" de 1 pendente logo depois recebe 429): conta o que entra, não a seleção. (F2c)
  - [I] Cota esgotada, relógio falso: com 59 min, 429; com 61 min, passa (janela de 1 h). (F2c)
  - [I] 40 pendentes com o `FakeEmailSender` (o mesmo da API e do worker) preso numa barreira: 40 na fila, e a resposta
    volta antes de a barreira abrir. (F2c)
  - [I] Lote maior que o que resta da cota de 300/h: 429 inteiro, nada na fila nem na auditoria; lote de 40 com 30
    restantes: 429, e logo depois um de 30 passa (o recusado devolveu os pontos). Transação desfeita depois do consumo:
    a cota volta. (F2c)
  - [P] Dois lotes de 200 ao mesmo tempo com 300 restantes, com barreira depois do filtro: um passa, o outro 429, a soma
    na fila não passa de 300, nunca 500. (F2c)
  - [I] "Copiar link" com o envio do convite `na_fila`: o envio antigo termina `cancelado`, cifrados nulos, zero envios;
    com o envio `enviando` (SMTP falso numa barreira), termina `cancelado` e o link antigo é recusado. (F2c)
  - [I] `convite.enviado` continua um registro só depois de o job rodar. (F2c)
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
  - [I] `EMAIL_POR_MINUTO` estourado, e a reserva alheia vigente: o job é adiado mais vezes que o número de tentativas
    dele, as tentativas não mudam, a linha não vira `falhou` e o envio sai quando a vaga abre. Redis de fila fora:
    adiado, nenhum envio, nada vira `falhou` (o seguro em memória não vale aqui); com o Redis de volta, o job é retomado e
    envia uma vez. (F2c)
  - [P] Mais consumos simultâneos que o teto, de dois workers: o número exato de envios é o teto. (F2c)
  - [I] Escola com limite `normal` = 1 e um `email.enviar-convite` adiado: outro job `normal` da mesma escola roda sem
    esperar a validade da vaga; o mesmo na `vaga:normal:sistema` com o `sistema.enviar-email-da-conta`. (F2c)
  - [I] Job adiado: a linha volta a `publicado`, o contador `jobs` da escola não muda, e a espera fica entre o
    `msBeforeNext` (ou o prazo da reserva) e ele mais 5 s, nunca 1 s fixo. (F2c)
  - [U] Espera do adiamento com o sorteio injetado: no mínimo, o `msBeforeNext`; no máximo, ele mais 5 s; dois sorteios
    diferentes, esperas diferentes; o mesmo com o prazo da reserva e com o Redis fora (30 s). (F2c)
  - [I] Com `EMAIL_POR_MINUTO` = 1, ponto consumido e a linha com reserva alheia, `enviado` ou `cancelado` (também o convite de outra escola, a cifra que não decifra e o banco que falha na reserva): o ponto volta,
    e o envio seguinte sai no mesmo minuto; o mesmo no `sistema.enviar-email-da-conta`, na metade reservada. Ponto
    consumido no segundo 59 e devolvido no minuto seguinte (relógio falso): não volta (só se devolve na mesma janela). A
    tentativa recusada pelo SMTP (4xx, 5xx) ou caída conta como envio: o ponto não volta. (F2c)
  - [I] Cota de 300/h com o Redis de fila fora: vale o seguro em memória, 300 ÷ instâncias (número de instâncias na
    configuração injetada no teste). (F2c)
  - [I] Envio do convite `na_fila` e `enviando`, relógio falso: com 23 h ficam; com mais de 24 h o
    `retencao.expurgar-escola` grava `falhou` e anula os cifrados.
  - [I] Cifrados nulos em `enviado`, `falhou`, `cancelado` e na revogação; nem token nem e-mail no log do worker.
  - [P] Job de e-mail duas vezes depois de `enviado`: um envio só. Duas execuções ao mesmo tempo: um envio (a reserva).
    Reserva de processo morto há mais de 2 min: retomada, um envio.
  - [P] Revogação com o SMTP falso preso numa barreira, linha `enviando`: a revogação responde na hora, a linha termina
    `cancelado` (o `enviado` do job não casa) e o link é recusado no aceite, mesmo que o e-mail tenha saído.
  - [I] Cláusula de defesa do `desativar` (F2): usuário ativo com convite aberto inserido direto no banco, envio `na_fila`
    e `enviando`: o `desativar` grava `cancelado`, anula os cifrados, zero envios. (F2c)
  - [I] Professor pendente com envio `na_fila`: o `desativar` responde `NAO_ENCONTRADO` e o envio não muda. (F2c)
  - [P] Link novo pelo "esqueci" e pelo verificar com o envio do antigo `enviando`: o antigo termina `cancelado`, com os
    cifrados nulos, e o token antigo é recusado em `/redefinir` e em `/conta/verificar`.
  - [P] Dois "Enviar convites" ao mesmo tempo: um convite aberto e um e-mail por professor (o do convite que perdeu sai
    `cancelado`); quem perde o `convite_pendente_unico` recebe a contagem, nunca 500.
  - [I] `email.enviar-convite` leva a escola do convite no `job_registro`; id de convite da B num job da A: nada enviado;
    payload adulterado: vale a escola do registro.
  - [I] `sistema.enviar-email-da-conta` tem escola nula e só lê pelo id do job, nascido no "esqueci" e no aceite com
  `VERIFICACAO_PENDENTE` (que tem escola no contexto).
  - [I] Convites 300/h por escola: 429, e a outra escola segue.
- **Posse do e-mail.**
  - [I] Aceite pelo e-mail grava `emailVerificadoEm`; pelo link copiado, não.
  - [I] Conta não verificada aceitando convite copiado de outra escola: `VERIFICACAO_PENDENTE` e link de verificar;
    depois de verificar, o aceite segue; a senha definida pelo link de uma escola não abre o convite de outra.
  - [I] Quarto aceite na hora: `VERIFICACAO_PENDENTE` e três envios, cada um com link novo que invalida o anterior; o
    envio do link antigo ainda `na_fila` vira `cancelado`, com os cifrados nulos, e não sai.
  - [P] Dois aceites que precisam de verificação ao mesmo tempo: os dois `VERIFICACAO_PENDENTE`, nunca 500, um link
    aberto. A resposta não traz id, nome nem quantidade da outra escola.
  - [I] Conta nova criada pelo próprio convite copiado: aceita sem verificação (não tinha senha). Dois convites copiados da
    mesma conta nova, aceitos ao mesmo tempo: um define a senha, e o que perdeu a corrida desfaz o uso e responde
    `VERIFICACAO_PENDENTE`.
  - [I] Redefinir pelo "esqueci" grava `emailVerificadoEm`.
  - [I] Professor desativado na A, com o convite copiado da B já emitido (a conta tem senha e não provou o e-mail):
    `VERIFICACAO_PENDENTE`, o link de verificar abre em `/v1/conta/verificar` (a conta serve enquanto o convite vale), e o
    aceite segue. Sem o convite válido, o link é inválido.
  - [I] O teto de 3 por hora por conta com o Redis fora: rebaixa para o seguro em memória, nunca 500.
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
- [I] Aluno com pedido pendente: 404; aluno com conta da escola ligada, só com ela ou também com senha: `ENTRA_PELA_CONTA_DA_ESCOLA`
  para quem gera, e a senha dele não muda; o mesmo aluno, para um professor de outra turma: 404.
- [I] A senha anterior e a provisória anterior param de valer; as sessões caem.
- [I] Login com a provisória devolve bilhete, não sessão; o bilhete não abre outra rota; a provisória vence em 24 h.
- [I] Login de matrícula inexistente, de aluno só com conta externa e com senha errada: mesma resposta; o aluno sem
  `senha_hash` passa pelo hash fixo (contado por espião no argon2, nunca cronometrado).
- [U] O bilhete é JWT assinado com escola, aluno e `provisoriaExpiraEm`: não contém hash nem senha; adulterado ou de
  outra chave, recusado. `typ` e `aud` próprios, provados um de cada vez (o `typ` do bilhete com a `aud` do desafio, e o
  inverso); nem desafio de login, nem bilhete de convite valem como bilhete, e o bilhete não vale como nenhum deles nem
  como token de acesso. (F2c)
- [I] Bilhete emitido 5 min antes de a provisória vencer, troca 1 min depois do vencimento (relógio falso): recusada, a
  senha não muda, nenhum `.usada`. (F2c)
- [I] `/trocas` lista as provisórias geradas antes, com data, papel de quem gerou (lido do `depois` da `.gerada`, mesmo
  com o autor eliminado) e se foi usada: a gerada e usada por outra pessoa aparece na troca seguinte do aluno. Não alcança
  outro aluno; bilhete de provisória substituída ou vencida: recusado; bilhete na query: recusado. Com 12 anteriores,
  traz as 10 mais recentes. (F2c)
- [E] Tela de troca: primeira troca mostra a frase "primeira vez", sem tabela vazia; falha da lista mostra aviso com
  "Tentar de novo" e não bloqueia o campo de senha; bilhete vencido: "peça a senha de novo ao professor"; datas em
  português ("Gerada pela coordenação em 12/11/2026 às 14:05").
- [I] `senha_provisoria.gerada` e `.usada` aparecem no arquivo do titular do aluno; `.usada` tem o aluno como autor.
- [I] Trocar-senha conta no contador de falhas da conta.
- [I] Provisória vencida, relógio falso: com 23 h o `retencao.expurgar-escola` a mantém; com 25 h anula hash, validade e
  quem gerou; a auditoria fica. A troca e o `desativar` do aluno também anulam as três colunas.
- [P] Duas trocas com o mesmo bilhete: uma sessão. Bilhete de provisória já substituída: recusado.
- [P] Dois "gerar" para o mesmo aluno, do mesmo autor e de autores diferentes (coordenação e professor): um gera; o
  outro, `CONFLITO`; a senha mostrada é a que entra; um `.gerada`; nunca 500. Depois de 10 s, gerar de novo vale. O
  `CONFLITO` não gasta ponto das cotas de 60/h e 5/dia. Com barreira entre a checagem e a gravação. (F2c)
- [P] Gerar × "ligar" em "Eu" do mesmo aluno, com barreira entre a checagem e a gravação: nunca termina com conta
  ligada e provisória. (F2c)
- [I] Escola sem ano em curso: a coordenação gera; o professor recebe 404; login com a provisória, `/trocas` e
  `trocar-senha` funcionam (a credencial é da escola); `intencao=ligar` liga, como hoje. (F2c)
- [I] Matrícula igual nas escolas A e B: a provisória da A não abre a matrícula da B. (F2c)
- [I] `senha_provisoria.gerada` e `senha_provisoria.usada` na auditoria, sem senha.
- [I] Cotas: 60/h por usuário e 5/dia por aluno, contadas só depois da checagem de escopo.
- [I] O hash da provisória passa pelo semáforo do argon2 (espião no semáforo). (F2c)
- [I] `:usuarioId` de professor ou de coordenador da mesma escola: 404 igual ao inexistente. (F2c)
- [I] A senha provisória não volta por nenhuma leitura: só a resposta da geração a traz, com `no-store`; a troca e
  `/trocas` também saem com `no-store`. (F2c)

## Conta da escola do aluno (RF14)

- [I] Domínio não liberado: recusado; cookie vencido: recusado; cookie da sala da escola A num pedido da B, ou de outro
  acesso: a resposta do cookie inválido.
- [I] O cookie é apagado ao gravar o pedido e não serve a um segundo.
- [I] Com o pedido pendente, o login pela conta da escola é recusado como credencial inválida; aprovar liga a conta e o
  aluno entra por ela; `contaExterna` nula depois de aprovar e de recusar.
- [I] Aprovar com a conta já ligada a outro aluno (ligou em "Eu" enquanto o pedido esperava): `CONFLITO` sem nome,
  nenhum usuário criado, pedido segue pendente. (F2c)
- [I] Aluno com conta ligada tenta ligar outra em "Eu": recusado (uma conta por aluno). (F2c)
- [P] O professor aprova o pedido com a conta C enquanto outro aluno liga C em "Eu": uma liga; a outra recebe
  `CONFLITO` sem nome, nunca 500; se perde a aprovação, nenhum usuário criado e o pedido segue pendente. (F2c)
- [I] Token da sala da B sob o slug da A no `externa/iniciar`: recusado já no início. (F2c)
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
- [I] Os dois alvos novos do `retencao.expurgar-escola` (envio de convite de mais de 24 h, provisória vencida) têm prazo fixo
  em código, e não categoria de retenção da escola (`CATEGORIAS_DO_EXPURGO` tem prazo em meses, ajustável por escola, e o
  `it.each` semeia por ele): cada um tem o bloco próprio em `expurgo-da-escola.int.test.ts`, como a importação parada, e a linha
  da outra escola, com a mesma idade, fica. (F2c)
- [I] Com o contexto da escola A, a credencial e a auditoria do aluno da B: a troca atualiza zero linhas (recusa) e
  `/trocas` lê zero. (F2c)
- [I] Requisição pede outro `sistema.*` ao `JobOutboxRepository.inserir`: recusado; a que enfileira o envio da conta não
  ganha `rotinaDoSistema` nem alcança job de sistema. (F2c)
- [I] Escola sem ano em curso: `convites/enviar` funciona; provisória, login e troca como no RF13.
- [I] Professor cadastrado pela planilha ou pela grade do F2 entra no "Enviar" sem seleção seguinte.

## Auditoria e dado (RF17)

- [I] Uma ação, um registro, linha a linha na tabela "Auditoria" no fim; nenhum registro traz nome nem matrícula.
- [I] Conta com usuário ativo nas escolas A e B redefine pelo "esqueci": um `senha.redefinida` e um
  `conta.email_verificado` em cada escola, autor e alvo o usuário dela; com o usuário da B desativado, só na A. O
  mesmo pelo `/v1/conta/verificar`. O registro da A não traz no `antes`, no `depois` nem na finalidade nada da B. (F2c)
- [I] Conta com usuário na A aceita por e-mail um convite da B: o `conta.email_verificado` sai só na B. (F2c)
- [I] Usuário desativado entre o link e o redefinir, sem outro usuário ativo na conta: recusado como link inválido, sem
  registro, nunca 500. O mesmo no verificar, sem usuário ativo e sem convite válido à espera. Com um convite válido à
  espera (o professor desativado na A com o convite copiado da B): o verificar grava a posse, sem registro, e o aceite
  segue. (F2c)
- [I] As métricas novas (e-mail por resultado, adiamento, provisórias por escola) são lidas como no
  `apps/realtime/test/metrics.int.test.ts`, e o `sistema.enviar-email-da-conta` ocupa a `vaga:normal:sistema`. (F2c)
- [I] Eliminar o professor que gerou provisória: a eliminação passa.
- [I] `contracts.test.ts`: nenhuma saída com cifrado.
- [I] Aluno desligado pela planilha do F2 não entra pela conta da escola ligada.

## Arquivo do titular (D85) (F2c)

- [I] Um caso por ação da lista por alvo (`aluno.transferido`, `lista.transferida`, `usuario.nome_corrigido`,
  `lista.nome_corrigido`, `senha_provisoria.gerada`, `.usada`): aparece no arquivo do alvo, não no de outro aluno, e traz
  o papel de quem fez, sem o id nem o nome dele e sem `antes` nem `depois` (`apps/api/test/arquivo-do-titular.int.test.ts`).
- [I] `lista.nome_corrigido` e `lista.transferida` de nome ainda não aprovado não entram em arquivo nenhum; aprovado,
  entram no do aluno.
- [I] Autor das quatro ações da F2 eliminado: o papel continua (fixo por ação). `.usada` aparece uma vez só. A `.gerada`
  feita por professor mostra "professor", e a feita pela coordenação, "coordenação".
- [I] Linha de auditoria da escola B inserida com o `entidade_id` do aluno da A: não entra no arquivo da A.
- [I] Leitura auditada do dado do aluno (a coordenação abriu) não entra.

## Carga

- [C] Job de professores do F2 com 300 linhas junto da rajada de login (com provisória e conta externa) e do redefinir
  dos mesmos professores: zero 503 no login e no redefinir; passo (3) do job abaixo de 1 s.

## A1 e F2 que mudam de regra

- `apps/api/test/convite.int.test.ts`: os casos em que uma conta de outra escola aceita convite por link copiado (linhas 320,
  377 e 447) passam a exigir o e-mail verificado.
- `e2e/convite.spec.ts` (os casos de `:211`, `:229` e `:355`) e `e2e/entrar-convite-revogado.spec.ts` (`:20` e `:59`): a
  conta de equipe do `e2e/support/seed.ts` (e a da `tools/vitrine/escola.ts`) nasce com o e-mail verificado; os casos
  seguem pelo caminho do aceite, sem passar pelo `VERIFICACAO_PENDENTE`.
- O caso do RF6 do F2 (`tasks/prd-onboarding-por-convite/cenarios.md`, "conta de outra escola cliente ganha o segundo
  vínculo no aceite"), escrito com o link copiado: passa a exigir o e-mail verificado, com a regra nova no nome.

## E2E (RF18)

- [E] Convites pelo Mailpit → professor aceita; esqueci → redefinir; verificar; um aluno reivindica com a conta da escola
  (o `oidc-falso`) → aprovação; provisória → troca; conta da escola em "Eu": a 360 px sem rolagem horizontal, alvo de
  44 px nas ações principais e de 24 px em todo o resto.
- [E] Gerar provisória para aluno com conta da escola: a tela diz que ele entra pela conta.
- [E] O diálogo do "Enviar convites" diz quantos recebem e que os links enviados ou copiados antes deixam de valer;
  "Reenviar" e "Copiar link" dizem o mesmo do link anterior. (F2c)
- [E] Dois alunos de mesmo nome na mesma turma: a confirmação da provisória mostra nome, turma, matrícula e a
  consequência, e as duas diferem pela matrícula; cancelar não gera nada (sem auditoria, a senha anterior vale). Fechar
  sem copiar pergunta antes. (F2c)
- [U] Professores relê o envio a cada 5 s só com a aba visível e alguma linha `na_fila` ou `enviando`: aba oculta ou
  nenhuma linha em envio, zero leituras; depois de 5 min, para (relógio falso e `visibilityState`). (F2c)
- [E] Toda tela nova e alterada (esqueci, redefinir, verificar, trocar a provisória, conta da escola na sala e em "Eu",
  Professores, gerar provisória) a 360 px sem rolagem horizontal, alvos de 44 px nas ações principais e 24 px no resto. (F2c)
- [E] Os estados de carregando e de erro de cada tela da seção "Telas". (F2c)

## Telas (F2c)

Cada linha vira o texto da tela e um [E] para o estado que não aparece na foto. Toda recusa diz o próximo passo, sem
termo técnico.

| Tela | Carregando | Inicial ou vazio | Erro e recusa | Com dado |
|---|---|---|---|---|
| Esqueci | botão ocupado | campo de e-mail; linha "Aluno: peça a senha provisória ao professor" | rede: "Tentar de novo" | "Se houver conta com este e-mail, mandamos um link. Ele vale 1 hora." (igual para todos) |
| Redefinir | botão ocupado | senha nova, com a regra visível, "mostrar senha", `autocomplete="new-password"` | link vencido, usado ou inválido: "Este link não vale mais. Peça outro em Esqueci a senha"; senha recusada: a regra | volta à entrada com "Senha trocada. Entre com a nova" (sem login automático: o MFA fica) |
| Verificar | "Confirmando…" | — | link vencido ou usado: "Peça outro link abrindo o convite de novo" | "E-mail confirmado", com "Continuar" para o convite |
| Aceite com `VERIFICACAO_PENDENTE` | — | — | "Mandamos um link para o seu e-mail. Abra-o e volte a este convite. Pode levar alguns minutos; se não chegar, abra o convite de novo para outro link." | — |
| Trocar a provisória | lista: esqueleto | primeira vez: "É a primeira vez que você troca a senha", sem tabela | lista falhou: aviso com "Tentar de novo", o campo segue; bilhete vencido: "Peça a senha de novo ao professor" | "Gerada pela coordenação em 12/11/2026 às 14:05 · usada" |
| Conta da escola na sala | "Entrando…" | botão "Entrar com a conta da escola" | domínio não liberado: "Esta conta não é da escola. Use a conta da escola ou a matrícula"; cookie vencido: "Comece de novo pelo link da sala"; `CONFLITO`: "Esta conta já está ligada a outro aluno. Fale com o professor"; rede: "Tentar de novo" | "Pedido enviado. Espere o professor aprovar" |
| Conta da escola em "Eu" | botão ocupado | "Ligar a conta da escola" | `CONFLITO`: como na sala; rede: "Tentar de novo" | "Conta da escola ligada" |
| Professores, envio | — | — | `falhou`: "Não chegou. Confira o e-mail e reenvie, ou copie o link" (sem sugerir que o professor errou) | `na_fila` e `enviando`: "Enviando"; `enviado`: "Enviado em 12/11 às 14:05"; `cancelado`: vale o estado do convite. Mudança anunciada em `aria-live="polite"` |
| Gerar provisória | botão ocupado | confirmação: nome, turma, matrícula e "a senha atual deixa de valer, e ela sai da conta em todo lugar" | `ENTRA_PELA_CONTA_DA_ESCOLA`: "Este aluno entra pela conta da escola. Não precisa de senha"; `CONFLITO`: "Acabou de ser gerada. Espere alguns segundos"; 429: "Muitas tentativas. Espere alguns minutos e tente de novo" | a senha em dois grupos, grande como o código da turma, lida grupo a grupo pelo leitor de tela, com "Copiar" e a validade; fora do cache de consultas, da URL, do log e do armazenamento do navegador, e sai da tela ao fechar |

## Corridas

| Corrida | Trava |
|---|---|
| Dois "Enviar convites" | `convite_pendente_unico`, vale o último |
| E-mail duas vezes | reserva `enviando` com prazo; `enviado` só com a minha reserva; reserva alheia vigente: adia |
| Revogação ou link novo durante o envio | grava `cancelado` na hora; o link revogado não vale |
| Dois aceites com verificação | único `(contaId, finalidade)` aberto; quem perde: `VERIFICACAO_PENDENTE` |
| Dois "esqueci" | único parcial `(contaId, finalidade)` aberto |
| Redefinir duas vezes | `usado_em is null` |
| Troca da provisória duas vezes | o `update` condicionado à `provisoriaExpiraEm` do bilhete |
| Gerar a provisória duas vezes | trava da linha do usuário do aluno; em menos de 10 s, de qualquer autor, `CONFLITO` |
| Gerar × ligar | a mesma trava do usuário do aluno |
| Aprovar com a conta já ligada a outro, ou ao mesmo tempo que o ligar | `conta_externa` única; `CONFLITO`, a transação desfaz |
| Dois "Enviar" disputando a cota de 300/h | consumo atômico de N pontos, devolvido no 429 e no rollback |
| Dois workers no `EMAIL_POR_MINUTO` | consumo atômico no Redis de fila |
| Mesma conta em dois pedidos | único parcial `(escolaId, provedor, tenant, sujeito)` onde pendente |
| Ligar a mesma conta duas vezes | `conta_externa` única, `CONFLITO` sem nome |

## Limites

Cada linha é um cenário [I]; o semáforo, [P].

| Limite | Valor | Ao passar |
|---|---|---|
| Convites | 300/h por escola | 429; a outra escola segue |
| Esqueci | balde `rl:ip:senha`, 10 por minuto, pelo HMAC do IP; 3/h pelo HMAC do e-mail | 202 sem envio, nunca 429; o login do mesmo IP segue |
| Verificar no aceite | 3/h por conta | `VERIFICACAO_PENDENTE` sem envio |
| Provisória | 60/h por usuário e 5/dia por aluno, contadas depois do escopo | 429 |
| Trocar-senha | o contador de falhas da conta | o bloqueio do login |
| `EMAIL_POR_MINUTO` | global (padrão 60), abaixo da do provedor, em janelas fixas de um minuto; o convite usa `N − ⌊N/2⌋` e o resto é reservado ao link da conta | o job adia sem gastar tentativa e solta a vaga (o link que vem depois sai no mesmo minuto); com os convites enchendo a metade deles, um link da conta ainda sai no minuto e um convite a mais é adiado |

## Auditoria (RF17)

Cada linha é um cenário [I]: a ação gera um registro com autor e data, e o registro não traz nome nem matrícula.

| Ação | Quando | Detalhe |
|---|---|---|
| `convite.enviado` | pedido ("Enviar", "Reenviar"), autora a coordenação | canal |
| `senha_provisoria.gerada` | gerar | papel de quem gerou no `depois`; aluno como alvo |
| `senha_provisoria.usada` | troca | autor: o aluno |
| `senha.redefinida` | redefinir | um por escola com usuário ativo da conta, autor e alvo esse usuário |
| `conta.email_verificado` | aceite por e-mail (na escola do convite), verificar, redefinir | como o `senha.redefinida` |
| `conta_externa.ligada` | aprovar com conta, ligar em "Eu" | — |
