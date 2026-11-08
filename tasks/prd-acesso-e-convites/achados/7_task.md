# Achados das revisões — `tasks/prd-acesso-e-convites/7_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-08 05:44:17 · `tasks/prd-acesso-e-convites/7_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. O diff não escreve em `nota` nem na correção, e não passa por `lancadaPor`. A única tabela que muda é `conta`, com a coluna `email_verificado_em`. Todos com autor humano? sim, porque não há caminho novo.

Decisão autônoma sobre aluno: ausente. A tarefa trata da posse do e-mail no aceite de convite e não decide nada sobre a trajetória do aluno.

Aprovação registrada: ok. A tarefa não tem saída de IA. A ação nova `conta.email_verificado` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/auditoria/acoes.ts:175`) é um ato da própria pessoa sobre a conta dela. Ela é gravada por escola e não traz o e-mail, o token nem a outra escola. Não tem relação com a regra 70 itens 3 e 6.

Supervisão do tutor: ok. O tutor não foi tocado. A única linha do diff que cita o tutor é contexto que já existia no `architecture.test.ts`, a coluna `mensagem_tutor.pagina`, que não mudou.

Autonomia declarada e visível: sim, sem alteração. Nenhum agente foi criado ou mudado, e a tarefa não altera governança nem a tela da coordenação.

Itens 7 a 9:
- **Vigilância:** nada de comportamento nem de inferência emocional.
- **Nota em discursiva e redação (D55):** não há campo, tela ou prompt de nota. A tarefa é só API e não tem texto na tela.
- **Indicador de professor:** nenhum, nem ranking. As contas de professor nos testes (`professores.int.test.ts`, `ativacao.fixture.ts`) só passam a nascer com o e-mail verificado.

`docs/regulacao.md` não foi alterado na tarefa e não precisava ser, porque o escopo não toca a regulação educacional.

Bloqueantes: nenhum.

Recomendações:
- O texto do `email_verificado_em` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/titular/leitura-do-titular.ts:108` diz "configuração, não dado do titular". A pergunta sobre esse campo ficar fora do arquivo do titular é da regra 20, não da 70: quem decide é o `privacy-guardian`.

Arquivos lidos:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tasks/prd-acesso-e-convites/7_task.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/senha/conta.controller.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/drizzle/0044_email_verificado.sql`

O resto do diff foi conferido por busca nos termos da regra 70 (nota, `lancadaPor`, tutor, agente, LLM, autonomia, ranking, aprovação), sem leitura arquivo por arquivo.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-08 05:44:53 · `tasks/prd-acesso-e-convites/7_task.md`

VEREDITO: APROVADO

Tabelas verificadas: `conta`, que ganhou a coluna `email_verificado_em` na migration `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/drizzle/0044_email_verificado.sql`. A tabela é global, a exceção já existente da regra 10, itens 1 e 9. Ela não varia por período, então não precisa de `anoLetivoId`. Nenhuma tabela nova. Também conferi `link_da_conta` (finalidade `verificar`), `usuario` (só lida no `exists`), `auditoria` e `job_registro`.

Queries verificadas:
- `TenantResolutionRepository.conviteValidoPorHash`: agora lê também `canal`, `emailVerificadoEm` e `cruzaEscolas`.
- `#cruzaEscolas`: devolve só um sim ou não, sem id nem quantidade da outra escola.
- `posseDaConta`, `marcarEmailVerificado`, `emailDaConta` e `segurarContaParaLink`: os quatro têm `@Unscoped` com justificativa de uma linha e estão na lista fixa de `tenant-resolution.repository.test.ts`.
- `ContaGlobalRepository.limpar`: zera a posse junto com o e-mail.
- `SenhaService.verificar`, `redefinir` e `#auditarPorEscola`: gravam um registro por escola em que a conta tem usuário ativo, cada um no contexto da própria escola.
- O aceite por e-mail grava o registro só na escola do convite.
- `POST /v1/conta/verificar`: recebe só `{ token }` com `.strict()`. Um `escolaId` no corpo dá 400, e a query string é ignorada.
- Nenhum endpoint passou a aceitar `escolaId` do cliente.
- Não há consulta nova da camada de rede.
- Os ids continuam UUID.

Teste de isolamento: presente e efetivo. Está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/test/posse-do-email.int.test.ts`. A remoção mental de cada cláusula quebra um caso:
- Gravar o registro do aceite fora da escola do convite: quebra o caso da linha 175 (o registro sai na B, nada na A).
- Agrupar o registro numa escola só, ou gravar em escola sem usuário ativo: quebram os casos das linhas 475 (A e B, nada na C) e 489 (B desativada).
- Inverter o `<>` do "cruza escolas": quebra o caso da linha 305, e há mutação declarada.
- A resposta 409 e o log não trazem id de escola, de usuário, o token nem o e-mail (linhas 258 e 426).
- Token inválido, vencido ou de outra finalidade responde o mesmo `NAO_ENCONTRADO` (linha 454).

Bloqueantes: nenhum.

Recomendações:
1. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/convite/convite.service.ts:119`, a resposta do aceite muda conforme o estado da conta. Quem tem o link copiado, inclusive a coordenação da escola B que o gerou, recebe `VERIFICACAO_PENDENTE` quando a conta tem usuário em outra escola e não verificou o e-mail, e `entrar` quando não tem. Assim fica sabendo se aquele e-mail tem vínculo em outra escola. É só um sim ou não, quase igual ao que o `entrar` já revelava desde a A1 (a conta existe e tem senha), e é o desenho da Tech Spec §5. Vale registrar o caso na AIA ou no `docs/lgpd.md` como exposição aceita, ou responder igual nos dois casos numa spec futura.
2. O `TenantResolutionRepository` passa de 35 `@Unscoped`. É o repository de resolução, desenhado para isso e guardado por lista fixa, mas a regra 10, item 9, pede para olhar o desenho quando os sem escopo se acumulam. Sugiro levar o assunto à retro: separar o que é da conta global, como posse, links e senha, num repository próprio da conta, nos moldes do `ContaGlobalRepository`.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-08 05:45:21 · `tasks/prd-acesso-e-convites/7_task.md`

VEREDITO: APROVADO

A tarefa 7.0 não tem bloqueante de LGPD nem de vazamento. Restam duas recomendações, que não reprovam.

**Campos pessoais tocados:** só a coluna nova `conta.emailVerificadoEm`, criada por `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/drizzle/0044_email_verificado.sql`. A tarefa também lê `conta.email` para o link de verificar, usa `link_da_conta` com a finalidade `verificar` e o contador `rl:verificar:conta`. A conta é da equipe (professor e coordenação), não do aluno. Nenhum campo proibido para aluno entra.

**Fora da tabela de dados do docs/lgpd.md:** nenhum.
- `docs/lgpd.md:80` traz o campo, com finalidade e retenção.
- `:79` traz o link de verificar.
- `:89` traz o contador de 3 por hora por conta.
- `:78` traz o e-mail ao provedor, já com "verificação de e-mail".
- A limpeza da conta zera o campo (`conta-global.repository.ts:76`), o que cumpre a retenção "o da conta global". Uma mutação prova isso em `ciclo-de-vida.int.test.ts`.

**Autorização por objeto:** ok.
- O token é a credencial, e a busca é pelo hash: `conviteValidoPorHash` e `linkValidoPorHash(..., 'verificar')`. Um token de redefinir não serve para verificar, e há teste disso.
- Token vencido, usado, substituído ou inexistente dá sempre o mesmo `NAO_ENCONTRADO` (teste "o token vencido, o de redefinir e o inexistente").
- A resposta `VERIFICACAO_PENDENTE` só traz o `code`. O teste em `posse-do-email.int.test.ts:258-261` confere que ela não traz o id das escolas A e B, os ids de usuário, o e-mail nem o token, nem na resposta nem no log. O caso paralelo em `:426` confere o mesmo.
- `posseDaConta` e o `#cruzaEscolas` devolvem só dois sim ou não, nunca o id da outra escola.
- O token vem só no corpo (`.strict()`), a query é ignorada e a resposta sai com `no-store` (`conta.controller.ts:18`). O convite segue com uso único, expiração e revogação.

**Logs:** limpos. Só saem `this.#logger.log('conta.email_verificado')` e `'senha.redefinida'`, sem nenhum dado.

**Auditoria:** presente. A ação nova `conta.email_verificado` fica em `packages/core/src/auditoria/acoes.ts:175`, sem e-mail, token nem outra escola.
- No aceite por e-mail, sai um registro só, na escola do convite (`convite.service.ts:87`).
- No verificar e no redefinir, sai um registro por escola em que a conta tem usuário ativo (`senha.service.ts:250-256`).
- Só a passagem de não verificada para verificada é gravada, e há teste para isso.
- O autor e o alvo são o próprio usuário. Por isso o fato entra no arquivo do titular pela leitura da auditoria por autor (`leitura-do-titular.ts:405`).

**Envio externo:** o e-mail com o link de verificar vai para o endereço da própria conta, nunca para o que a pessoa digitou. O endereço e o token ficam cifrados em `link_da_conta` só enquanto `na_fila` ou `enviando`. O envio passa pela fila como job de sistema sem escola, e o link antigo vira `cancelado` com os cifrados nulos. Não há IA e nada vai para `ExecucaoAgente`. O provedor de e-mail continua em `suboperador` antes do portão da primeira escola real (`lgpd.md:78`), como já estava.

**Seed/fixture:** sintético. Os e-mails são `@escola.invalid` com UUID e os nomes são do tipo "Pessoa sintética" e "Coordenação Sintética Convidada". A mudança em `ativacao.fixture.ts` só cria as contas já verificadas.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **Texto do risco aceito.** `tasks/prd-acesso-e-convites/techspec.md:200` diz que `VERIFICACAO_PENDENTE` revela "que o e-mail tem conta". Revela mais. Quem tem o link copiado, inclusive a coordenação da escola B que o gerou, fica sabendo que a conta tem senha, não provou o e-mail e já tem usuário em outra escola. O nome e o id dessa escola não saem. O dado é de adulto e o risco foi aceito na Tech Spec, mas o texto deveria dizer exatamente isso para a aceitação valer pelo que ela é. Destino: o PRD e a Tech Spec, com o Joaquim.
2. **Data da verificação no arquivo do titular.** `leitura-do-titular.ts:111` tira `email_verificado_em` do arquivo como "configuração, não dado do titular", no mesmo critério de `mfa_ativado_em`. Mas `lgpd.md:80` mapeia o campo como dado do professor e da coordenação. O fato e o instante já chegam ao titular pelo registro `conta.email_verificado`. Ficaria mais claro deixar isso escrito no motivo, ou levar a coluna para a versão completa. Destino: a retro ou a revisão do arquivo do titular.

**Pergunta de fechamento:** é sobre o aluno, e o aluno não é tocado. Para a conta de professor ou coordenação, o código responde: o e-mail vem pela linha da conta, e o fato e o instante da verificação vêm pela auditoria `conta.email_verificado`, que entra no arquivo do titular. O envio externo está mapeado em `docs/lgpd.md:78-79`.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-08 05:45:59 · `tasks/prd-acesso-e-convites/7_task.md`

VEREDITO: APROVADO
Caminho quente tocado: login (o aceite de convite e a rota anônima nova `POST /v1/conta/verificar`), fila e migration
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: compatível
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- **Contador do 409.** O caminho `VERIFICACAO_PENDENTE` não tem contador próprio, e o teto de 3/h também não (`apps/api/src/sessao/convite/convite.service.ts:103` e `apps/api/src/sessao/senha/senha.service.ts:135`). Um contador sem escola e sem conta mostraria se o teto está pegando no onboarding, quando a coordenação copia links para quarenta professores de uma vez. Só a métrica HTTP genérica já cobre a rota.
- **Teto de 3/h gasto por terceiro.** Quem tem o convite copiado pode gastar os 3 envios da hora da conta. A pessoa dona da conta ainda tem saída: o "esqueci a senha" também grava a posse (`senha.service.ts:258`). Vale uma linha no runbook ou na tela da 8.0 apontando esse caminho quando o link não chega.

Onde as perguntas do checklist foram respondidas:
- **Rate limit.** A rota de verificar é anônima e por isso cai no limite por IP da rota anônima, como o redefinir e o aceite aprovados na 5.0. Ela não tem argon2 e o token tem entropia alta. O envio do link tem teto por conta, 3 por hora, contado no Redis.
- **Nada demorado em request.** O e-mail sai pela fila `normal` (`sistema.enviar-email-da-conta`) e o 409 sai sem calcular hash nenhum.
- **Concorrência.** O índice único `link_da_conta_aberto_unico` com o 23505 tratado, o `marcarEmailVerificado` com `where email_verificado_em is null`, a ordem de travas conta antes do link (`FOR KEY SHARE` e `FOR UPDATE`), e a nova checagem dentro da transação para a conta convidada por duas escolas. Tudo isso é coberto pelos casos paralelos de `posse-do-email.int.test.ts`.
- **Índice.** O `exists` em `usuario` usa o `usuario_conta_idx`.
- **Migration.** `0044` só adiciona uma coluna anulável sem default, que o código anterior não lê, e o `migrate.ts` aplica `lock_timeout`.
- **Teste.** `npx vitest run --project integracao apps/api/test/posse-do-email.int.test.ts`: 26 de 26 passaram.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/convite/convite.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/senha/senha.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/senha/conta.controller.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/tenant/tenant-resolution.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/drizzle/0044_email_verificado.sql
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/test/posse-do-email.int.test.ts

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-08 05:46:30 · `tasks/prd-acesso-e-convites/7_task.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. A única divergência ("outra escola" conta o usuário em qualquer estado, e o aceite que perde a corrida relê a posse) está na `techspec.md` §5 e no `cenarios.md`.
Portão local: carimbo válido

**Bloqueantes:**

1. **O link de verificar sai mesmo quando nunca vai funcionar, e a pessoa fica presa.**
   - **Onde:** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/senha/senha.service.ts:185-190` (`pedirVerificacao`) junto com `:242-243` (`verificar`).
   - **O que acontece:**
     - O "cruza escolas" agora conta o usuário em qualquer estado (`tenant-resolution.repository.ts:426`). O professor desativado na A cruza escolas por esse usuário, que continua no banco.
     - A conta dele não é limpa enquanto houver um convite válido da B à espera (`conta-global.repository.ts`, "a conta serve enquanto… um usuário que espera um convite ainda válido"). Ela segue com senha e sem a posse provada.
     - Quando ele aceita o convite copiado da B, recebe `VERIFICACAO_PENDENTE`, e `pedirVerificacao` enfileira o e-mail sem olhar se a conta tem usuário ativo.
     - No `/v1/conta/verificar`, `usuariosAtivosDaConta` volta vazio (o da A está desativado, o da B ainda está inativo), e a resposta é "link inválido".
     - A mensagem manda abrir o convite de novo para pedir outro link. Isso fecha um laço: até 3 e-mails por hora, nenhum funciona. O "esqueci" também não serve, porque exige usuário ativo.
   - **Quem é atingido:** quem a regra mais pega, o professor que troca de escola com o convite copiado da nova já emitido antes do desligamento.
   - **Como nasceu:** a divergência desta tarefa ("qualquer estado") encontrou o cenário de `cenarios.md:193` ("sem outro usuário ativo na conta: recusado"). Nenhum dos dois documentos trata o caso de a conta não ter usuário ativo já no pedido do link.
   - **Correção exigida:**
     - Decidir o caminho e escrevê-lo na `techspec.md` §5 e no `cenarios.md`. Opção (a): o `verificar` também aceita a conta que só tem usuário esperando convite válido, que é o mesmo critério de "a conta serve" da limpeza, e grava a posse sem registro, como a §5 "Auditoria" já admite ("sem usuário ativo, nenhum"). Opção (b): o `pedirVerificacao` não envia link a essa conta, e a resposta indica outro caminho, como pedir à coordenação o "Enviar" por e-mail.
     - Implementar o caminho escolhido.
     - Cobrir em `posse-do-email.int.test.ts` o caso "usuário da A desativado, convite copiado da B, conta com senha e sem posse", provando que a pessoa chega ao aceite ou que nenhum link inútil sai.

**Recomendações:**
- `senha.service.ts:239`: o `verificar` chama `travarContaParaRedefinir`, que é a trava do MFA/redefinir e lê `escolasAtivas`, que o `verificar` descarta. Um nome neutro (`travarConta`) ou um método próprio deixaria a ordem de travas legível sem enganar quem lê.
- `convite.service.ts:67`: `exigeVerificacao` é exportada, mas só o próprio arquivo a usa. Se nenhum teste a importa, pode deixar de ser exportada.
- `packages/core/src/titular/leitura-do-titular.ts:108`: a justificativa de deixar `email_verificado_em` fora do arquivo do titular segue o precedente do `mfa_ativado_em`. O `privacy-guardian` deve confirmar a classificação, porque é uma data ligada à pessoa.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-08 05:48:26 · `tasks/prd-acesso-e-convites/7_task.md`

VEREDITO: REPROVADO

O único bloqueante é que a tarefa muda a regra do aceite e não atualiza cinco casos de e2e que dependem da regra antiga. Eles vão ficar vermelhos na esteira. Rodei `apps/api/test/posse-do-email.int.test.ts` e passou (26 de 26). Os e2e eu não rodei; a quebra vem da leitura do seed e do código.

**Cenários exigidos:** os da seção "Posse do e-mail" do `cenarios.md`; os de Auditoria ligados à posse (por escola, A e B, B desativada, aceite por e-mail só na B, usuário desativado entre o link e o verificar); a corrida "Dois aceites com verificação"; o teto "Verificar no aceite 3/h por conta"; o link antigo `enviando` recusado em `/conta/verificar`; e o que muda de regra na A1 e no F2.

**Cobertos:** todas as linhas da tabela da 7_task.md têm caso citado pelo nome em `apps/api/test/posse-do-email.int.test.ts`. Os casos da A1 (`convite.int.test.ts:320`, `:377`, `:447`) passaram a ter contas verificadas, e o 320 foi reescrito para `VERIFICACAO_PENDENTE`. O RF6 de `professores.int.test.ts:900` foi renomeado com a regra no nome. A limpeza da conta está em `ciclo-de-vida.int.test.ts`. As mutações batem com o `git diff`: cada cláusula nova tem bloco, e o que ficou sem bloco está no `--faltando` com motivo aceitável. Não há `.skip`, mock que esconda a regra nem provedor pago. Há paralelos de verdade com `WriteBlockTrigger` (insert do link, link antigo na barreira, usuário desativado dentro da transação).

**Bloqueantes:**
- **Cinco e2e quebram com a regra nova e não foram atualizados.**
  - **Por que quebram:**
    - `e2e/support/seed.ts:105` (`criarEquipeComSenha`) cria a conta com senha e sem `email_verificado_em`.
    - `criarConviteDeProfessor` (`seed.ts:718`) e `criarConviteDeCoordenador` (`seed.ts:313`) gravam o convite com o canal padrão `copiado`, numa escola nova.
    - Com isso, `exigeVerificacao` responde verdadeiro e o aceite devolve 409 `VERIFICACAO_PENDENTE`. A tela nunca chega a `/entrar`.
    - Vale também quando o usuário da outra escola está desativado, porque o cruzamento conta usuário em qualquer estado (`tenant-resolution.repository.ts`, `#cruzaEscolas`).
  - **Os casos afetados:**
    - `e2e/convite.spec.ts:210`: "o professor que já tem conta em outra escola aceita sem senha nova…"
    - `e2e/convite.spec.ts:228`: "quem já tem conta em outra escola vai para a entrada…"
    - `e2e/convite.spec.ts:354`: espera 200 do aceite anterior em `:395`.
    - `e2e/entrar-convite-revogado.spec.ts:19` e `:58`: o usuário desativado ainda faz a conta cruzar escolas.
  - **Por que o portão não pegou:** ele só roda o e2e que a árvore alterou, e nenhum desses mudou. O vermelho só apareceria na esteira, uma tarefa depois.
  - **Correção exigida:**
    1. Dar a posse verificada à conta de `criarEquipeComSenha` (por exemplo `email_verificado_em = now()`, ou uma opção `verificada`, com o comentário da 7.0, como foi feito em `ativacao.fixture.ts`).
    2. Acrescentar esses e2e à seção "A1 e F2 que mudam de regra" do `cenarios.md` e à tabela da tarefa, para que o portão os rode.
    3. Conferir se `tools/vitrine/escola.ts:216` segue o mesmo caminho.

**Recomendações:**
1. **Corrida A e B depende do tempo** (`posse-do-email.int.test.ts:330`, "os dois aceites da conta nova convidada por A e por B"). É um `Promise.all` sem barreira. As mutações do recheck, do `catch` e do `posse_pendente` só ficam vermelhas se os dois aceites lerem o convite antes de o primeiro confirmar. Hoje o argon2 entre a leitura e o commit garante isso quase sempre, mas não sempre. Para ficar determinístico: segurar um aceite com `WriteBlockTrigger` no update do convite dele e soltar depois que o outro definir a senha.
2. **Mesmo problema em "dois verificar com o mesmo token"** (`:546`). A mutação `usado === undefined` só é pega se os dois lerem o link antes do commit, e aqui não há argon2 alargando a janela. Pede a mesma barreira, no update de `link_da_conta`.
3. **Linha "token do verificar: depois do `#`" cita o teste errado.** O caso citado (`:438`) não olha o link do e-mail, embora o nome diga "o link do e-mail leva o token depois do `#`". Quem prova isso é `packages/core/src/email/mensagem-do-link-da-conta.test.ts:9`, da 5.0. Citar esse teste e tirar a afirmação do nome do caso.
4. **Sem caso para o teto com o Redis fora.** A Tech Spec diz que o teto de 3/h "rebaixa" (seguro em memória), mas não há caso com o Redis fora no `pedirVerificacao`.
5. **Vermelho por erro em vez de comportamento.** O bloco de `if (valido === undefined) throw linkInvalido()` fica vermelho por TypeError, que vira 500. Vale, mas um caso que distinga "500" de "404 de outro guarda" deixaria a prova mais clara.

Arquivos principais:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/e2e/support/seed.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/e2e/convite.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/e2e/entrar-convite-revogado.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/test/posse-do-email.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tasks/prd-acesso-e-convites/7_task.md

## revisor-geral · 2ª rodada · APROVADO · 2026-11-08 06:48:34 · `tasks/prd-acesso-e-convites/7_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. A correção ficou com a opção (a) e está escrita na `techspec.md` §5 (fim de "Posse do e-mail", linhas 102-106, junto com a §5 "Auditoria", linha 130), no `cenarios.md` ("Posse do e-mail" e "Auditoria e dado") e na tabela de divergências do `7_task.md`.
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

**A correção exigida na 1ª rodada foi feita:**
- O verificar não recusa mais a conta que só espera convite. O `linkValidoPorHash` com finalidade `verificar` agora aceita a conta cujo usuário desativado espera um convite válido (`tenant-resolution.repository.ts:543`). O mesmo critério é conferido de novo, com a conta travada, em `senha.service.ts:208`. Sem usuário ativo, a posse é gravada sem registro de auditoria, porque `#auditarPorEscola` recebe a lista vazia. É o que a §5 "Auditoria" já admitia.
- O caso pedido está coberto. Em `posse-do-email.int.test.ts`, "o professor desativado na A com o convite copiado da B já emitido" percorre o caminho inteiro: `VERIFICACAO_PENDENTE`, depois o link responde 204, a posse fica gravada, nenhum registro sai na A nem na B, e o aceite responde 200.
- O critério também tem teste direto, cobrindo cada estado do convite (válido, usado, revogado, vencido), a conta sem convite, a conta com usuário ativo e a conta inexistente (`tenant-resolution.repository.int.test.ts:321`).
- Os dois casos de "usuário desativado" passaram a revogar também o convite. Assim eles continuam provando o link inválido.
- A recomendação foi aplicada: `exigeVerificacao` não é mais exportado (`convite.service.ts:68`).

As outras mudanças do diff são da área do `test-engineer`. As corridas agora têm ordem forçada por trava, e há um caso novo do teto de 3 por hora com o Redis fora. As contas de equipe do seed do e2e e da vitrine nascem com o e-mail verificado, e isso está registrado no `cenarios.md` ("A1 e F2 que mudam de regra"). O `leitura-do-titular.ts` ganhou um texto melhor. O risco técnico da §13 foi detalhado. Nada disso invade tarefa futura.

Recomendações:
- **Docblocks no lugar errado** em `apps/api/src/sessao/tenant/tenant-resolution.repository.ts`. O docblock do `#cruzaEscolas` (linhas 393-396) ficou em cima do docblock do `#contaEmUso` (397-401), e o `#cruzaEscolas` (408) ficou sem documentação. Da mesma forma, o docblock do `marcarEmailVerificado` (427-430) ficou em cima do docblock do `contaEmUso` (431-433), e o `marcarEmailVerificado` (441) ficou sem a dele. Quem lê o arquivo encontra "Grava a posse do e-mail uma vez só" logo acima de uma função que só lê. Correção: devolver cada docblock para cima da sua função.
- **O critério de "a conta serve" está escrito duas vezes.** Uma em `packages/core/src/ciclo-de-vida/conta-global.repository.ts:64-71` (`limparContaSemUso`) e outra em `tenant-resolution.repository.ts:402-404` (`#contaEmUso`). A Tech Spec diz que o verificar "usa o mesmo critério", mas hoje são duas cópias que podem divergir. Vale extrair um só predicado no `core`, usado pelos dois.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-08 06:48:51 · `tasks/prd-acesso-e-convites/7_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta rodada. O diff não cria, altera nem chama nenhuma escrita em `Nota` (seed e2e, vitrine, repository e serviço tocam só `conta`, `usuario`, `convite` e `link_da_conta`). Todos com autor humano? sim (não há caminho novo).

Decisão autônoma sobre aluno: ausente. O `contaEmUso` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/tenant/tenant-resolution.repository.ts:101-121`) decide só se o link de verificar da conta de equipe ainda vale. Não decide nada sobre trajetória de aluno nem chega perto disso.

Aprovação registrada: ok. Nenhuma saída de IA nova. O verificar sem usuário ativo grava a posse do e-mail sem registro `conta.email_verificado` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/senha/senha.service.ts:206-208`). Isso é um fato de segurança da conta e não uma aprovação de saída de IA, então o item 6 da regra 70 não se aplica.

Supervisão do tutor: ok. O diff não toca o tutor.

Autonomia declarada e visível: sim. O diff não toca nenhum agente nem a governança.

Bloqueantes: nenhum.

Recomendações: nenhuma da regra 70.

O que conferi nesta 2ª rodada:
- Não havia correção exigida a cobrir, porque a 1ª rodada foi APROVADO sem correções.
- Li o diff inteiro (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/.processo/ordens/diff-7_task-r2.txt`). As mudanças são:
  - o critério "a conta serve" no verificar, que passa a aceitar o usuário que espera um convite válido;
  - os testes de corrida com a ordem forçada;
  - o teto de 3 por hora quando o Redis de fila está fora;
  - o e-mail verificado no seed do e2e e na vitrine;
  - os textos de Tech Spec, cenários e tarefa.
- Nada disso toca nota, correção, discursiva ou redação (D55), tutor, autonomia de agente, decisão sobre aluno ou indicador de professor (D45, D64).
- O `docs/regulacao.md` não mudou.
- O e-mail verificado no seed (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/e2e/support/seed.ts:105-106` e `:858-859`) e na vitrine (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tools/vitrine/escola.ts:216-217`) é dado sintético de conta de equipe e não escreve em `Nota`.
- O prompt não trouxe fotos da tela, e a tarefa é só de API.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-08 06:48:56 · `tasks/prd-acesso-e-convites/7_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova neste diff. Em `#contaEmUso`, a consulta junta `convite` e `usuario` por `convite.escolaId = usuario.escolaId` e `convite.usuarioId = usuario.id`, o que bate com a FK composta `convite_usuario_da_escola_fk` (`packages/core/src/db/schema/convite.ts:64`). `conta` continua global, como foi aprovado na 1ª rodada.

Queries verificadas:
- `TenantResolutionRepository.contaEmUso` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/tenant/tenant-resolution.repository.ts:434-438`): tem `@Unscoped` com justificativa de uma linha. O `contaId` vem do link já validado por hash e com a conta travada, não do cliente. Devolve só um booleano, sem id nem nome de escola. Entrou na lista fixa de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/tenant/tenant-resolution.repository.test.ts`.
- `#contaEmUso` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/tenant/tenant-resolution.repository.ts:402-406`), usado na leitura do link em `:543`: o critério com convite só vale para `finalidade === 'verificar'`. O redefinir continua exigindo usuário ativo.
- `SenhaService.verificar` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/senha/senha.service.ts:208-209`): quando a conta não tem usuário ativo, `#auditarPorEscola` recebe a lista vazia e não grava nada em nenhuma escola. A conta sem uso devolve o mesmo 404 de link inexistente, então a resposta não confirma nada.
- O cliente não manda `escolaId` em nenhum endpoint. O token continua só no corpo.

Teste de isolamento: presente e efetivo.
- O caso novo "o professor desativado na A com o convite copiado da B" confere que não sai `conta.email_verificado` nem na A nem na B.
- `contaEmUso` é testado com o convite em cada estado: válido, usado, revogado, vencido, sem convite, usuário ativo e conta inexistente. Cada termo do convite válido quebra o teste quando é removido.
- Os dois casos de "usuário desativado" agora também revogam o convite pendente, e por isso continuam provando que a resposta é link inválido, sem registro e sem posse gravada.

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/tenant/tenant-resolution.repository.ts:393-401`: o docblock de `#cruzaEscolas` ficou empilhado em cima do docblock novo de `#contaEmUso` e não está mais junto do método que descreve. Ele deve voltar para logo acima de `#cruzaEscolas` (`:408`).
- Mesmo arquivo, `:426-433`: o mesmo problema com o docblock de `marcarEmailVerificado`, que agora fica acima do de `contaEmUso`. Ele deve voltar para logo acima de `marcarEmailVerificado` (`:440-441`).
- No `#contaEmUso`, nenhum teste quebraria se a cláusula `convite.escolaId = usuario.escolaId` fosse removida, porque a FK composta já garante isso. Não vaza nada, já que a saída é um booleano, mas vale um comentário dizendo que é defesa redundante, ou um bloco no `--faltando` com esse motivo.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-08 06:49:07 · `tasks/prd-acesso-e-convites/7_task.md`

VEREDITO: APROVADO

A rodada 1 foi aprovada sem correções exigidas. Nesta rodada auditei o diff `ee857abc..9af02543` (14 arquivos) e o que ele afeta.

Campos pessoais tocados: nenhum campo novo. O diff passa a ler `usuario.desativadoEm` e o estado do `convite` (`usadoEm`, `revogadoEm`, `expiraEm`) para decidir se a conta ainda serve. Também muda o texto da justificativa de `email_verificado_em` no arquivo do titular.

Fora da tabela de dados do docs/lgpd.md: nada. `conta.emailVerificadoEm` continua em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/docs/lgpd.md:80`, com finalidade e retenção. Nenhum campo proibido para aluno; a mudança só alcança contas de equipe, que são de adultos.

Autorização por objeto: ok.
- `contaEmUso` (`apps/api/src/sessao/tenant/tenant-resolution.repository.ts:117-121`) é `@Unscoped`, tem justificativa de uma linha e devolve só um booleano.
- A subconsulta do convite amarra `convite.escolaId = usuario.escolaId` e `convite.usuarioId = usuario.id`.
- A regra mais larga vale só para `finalidade === 'verificar'` (`:543`). O redefinir continua exigindo usuário ativo, então quem foi desativado não recupera a senha pelo "esqueci".
- Só o dono do token chega à rota, e a resposta é 204 ou a mesma de link inválido. Não há oráculo novo.

Logs: limpos. `senha.service.ts:211` registra só `'conta.email_verificado'`. Os testes novos não registram dado pessoal.

Auditoria: presente onde a regra 20 exige. Verificar o e-mail não está na lista obrigatória. O caminho novo (verificar sem usuário ativo) não grava registro, de propósito e documentado: não há escola em que registrar (`techspec.md` §5, `cenarios.md`). O teste em `posse-do-email.int.test.ts:159-172` prova que nada sai na A nem na B.

Envio externo: nenhum envio de IA. O e-mail do link de verificar continua pela fila do 5.0, como já auditado na rodada 1.

Seed/fixture: sintético. `e2e/support/seed.ts:105,858` e `tools/vitrine/escola.ts:216` só acrescentam `email_verificado_em = now()` às contas sintéticas de equipe. Nenhum dado real.

Pergunta de fechamento: o arquivo do titular continua respondendo para o aluno. O diff não toca dado de aluno, nem em `leitura-do-titular` nem no que é enviado para fora.

Bloqueantes: nenhum.

Recomendações:
1. O novo texto em `packages/core/src/titular/leitura-do-titular.ts:110` diz que o fato e o instante da posse do e-mail chegam ao titular pelo registro `conta.email_verificado` da auditoria. No caminho novo (professor desativado na A, convite da B à espera) esse registro não existe, e o arquivo da B não guarda a data da verificação. A classificação "configuração, não dado do titular" vale desde a rodada 1. Há dois jeitos de resolver, e ambos cabem na retro:
   - corrigir o texto para "quando a conta tem usuário ativo";
   - ou gravar o registro na escola do convite à espera.
2. `techspec.md` §13 agora admite que a coordenação da escola que gerou o link copiado sabe, pela resposta `VERIFICACAO_PENDENTE`, que a conta daquele e-mail tem senha, não provou o e-mail e já tem usuário em outra escola. É dado de adulto, a escola não é nomeada, o risco foi aceito e está escrito. Mesmo assim, como ele cruza escolas, o `tenancy-guardian` deveria confirmar que esse risco aceito vale para a regra 10, ou registrá-lo como decisão.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-08 06:49:12 · `tasks/prd-acesso-e-convites/7_task.md`

VEREDITO: APROVADO

Caminho quente tocado: login (o aceite de convite e o `/v1/conta/verificar`; fora do pico das 10h, que é sala, tutor e prova)
Rate limit: ok. O teto de 3 links por hora continua contado por conta. Com o Redis de fila fora, ele cai para o seguro em memória dividido pelas instâncias (3 ÷ 4 = 1), sem resposta 500. Isso agora está provado em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/test/posse-do-email.int.test.ts:224`.
Fila e prioridade: ok. O diff não mexe no envio, que segue pela fila.
Concorrência: protegida.
- Para o verificar aceitar a conta, `contaEmUso` exige um usuário ativo ou um convite válido à espera. Essa leitura acontece dentro da transação, com a conta já travada (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/senha/senha.service.ts:208`).
- Uma revogação do convite que chegue depois dessa leitura e antes do commit só grava a posse numa conta sem uso. Não gera registro de auditoria nem abre acesso.
- Três testes de corrida passaram a ter ordem forçada por trava, no lugar de `Promise.all`: os dois aceites da conta nova convidada por A e B, os dois verificar com o mesmo token, e a desativação somada à revogação dentro da transação.
Índice e paginação: ok. As subconsultas de `#contaEmUso` usam índices que já existem: `usuario_conta_idx` (parcial em `conta_id`) e `convite_escola_usuario_idx` (`escola_id`, `usuario_id`). Cada consulta pega uma conta só e devolve só sim ou não, então não há o que paginar.
Degradação de IA: não se aplica.
Migration: não se aplica. A 0044 não mudou desde a rodada aprovada.
Métrica e alerta: ok. O diff não traz código novo no caminho quente.
Bloqueantes: nenhum.
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/tenant/tenant-resolution.repository.ts:392-407` e `:426-438`: os docblocks novos entraram entre o docblock existente e o método dele. O de `#cruzaEscolas` agora fica sobre `#contaEmUso`, e o de `marcarEmailVerificado` fica sobre `contaEmUso`. Basta mover cada docblock para cima do método a que ele se refere.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/test/posse-do-email.int.test.ts:224`: o caso do Redis fora depende de o Redis ficar travado por 15 s enquanto os três pedidos passam. A asserção `voltou` já acusa máquina lenta, mas na esteira vale observar se o caso falha de forma intermitente.

## test-engineer · 2ª rodada · REPROVADO · 2026-11-08 06:50:18 · `tasks/prd-acesso-e-convites/7_task.md`

VEREDITO: REPROVADO

Uma das três correções exigidas ficou pela metade: os e2e entraram no `cenarios.md`, mas não na tabela da tarefa. Fora isso, o diff desta rodada está correto, e os dois arquivos de integração passaram (41 testes).

Cenários exigidos (esta rodada):
- As três correções exigidas na 1ª rodada.
- As quatro recomendações a aplicar.
- O que a regra nova afeta, o `contaEmUso`: o professor desativado na A com o convite copiado da B já emitido, o convite em cada estado (válido, usado, revogado e vencido) e a guarda do `verificar` com ele.

Cobertos:
- **Correção 1, feita.** As contas criadas por `criarEquipeComSenha` e `criarPessoaNaEscola` em `e2e/support/seed.ts` nascem com `email_verificado_em = now()`, com o comentário da 7.0.
  - `criarConviteDeProfessor` e `criarConviteDeCoordenador` deixam de cair no `VERIFICACAO_PENDENTE`.
  - O caso do usuário desativado em `entrar-convite-revogado.spec.ts` também, porque a conta já tem a posse.
- **Correção 3, feita.** `tools/vitrine/escola.ts:217` nasce verificada.
- **Correção 2, só em parte.**
  - Feito: a seção "A1 e F2 que mudam de regra" do `cenarios.md` lista os cinco e2e, e os dois `.spec.ts` foram alterados, então o portão os roda.
  - Falta: a linha na tabela da tarefa (ver o bloqueante).
- **Recomendações (1) e (2), aplicadas.**
  - "Os dois aceites da conta nova convidada por A e por B": o da B para no uso do convite, e o da A confirma antes. O teste confere o 409 `VERIFICACAO_PENDENTE` da B e que a B não ficou com nada (convite sem uso, usuário inativo).
  - "Dois verificar com o mesmo token": o primeiro para depois de gastar o link, e o segundo espera a conta travada (`esperarNaTrava`). O resultado é `[204, 404]` em ordem fixa, com um registro só. São concorrência de verdade, com a ordem forçada.
- **Recomendação (3), aplicada.** A linha "token do verificar" agora cita `mensagem-do-link-da-conta.test.ts` para o `#`, e o caso da API só afirma o que prova.
- **Recomendação (4), aplicada.** O teto de 3 por hora com o Redis fora roda com 4 instâncias e o Redis travado (`travarRedis`, padrão já usado em sete testes). Espera `[409, 409, 409]` e 1 link só. Se o seguro em memória fosse removido, ou a divisão por instância, haveria 500 ou 3 links. Tem também a guarda contra o Redis voltar antes da hora.
- **`contaEmUso`, com bloco de mutação para cada parte nova:**
  - o `false` do `finalidade === 'verificar'`;
  - o ternário;
  - os três termos do convite válido (o vencido é criado no prazo e vencido depois);
  - a guarda do `verificar` nos dois sentidos.
- **Professor desativado na A com o convite da B:** 409, depois 204 no verificar, a posse gravada, nenhum registro de auditoria na A nem na B, e o aceite com 200.
- **Os dois casos de "usuário desativado" do verificar** agora também revogam o convite pendente, então continuam chegando à cláusula que dizem provar.

Bloqueantes:
1. **`tasks/prd-acesso-e-convites/7_task.md:52-75`**, a tabela "Testes que provam a regra": não tem linha para os cinco e2e que mudam de regra (`e2e/convite.spec.ts:210`, `:228`, `:354` e `e2e/entrar-convite-revogado.spec.ts:19`, `:58`). A correção exigida pedia esses e2e no `cenarios.md` **e** na tabela da tarefa, e só a primeira parte foi feita.
   - **Correção exigida:** uma linha no estilo da `convite.int.test.ts:320, :377, :447`. Ela diz que a conta de equipe do `e2e/support/seed.ts` (e a da vitrine) nasce verificada e que os casos seguem pelo aceite, e cita os cinco casos pelo nome.
   - Na mesma edição, pôr `e2e/support/seed.ts`, os dois `.spec.ts` e `tools/vitrine/escola.ts` na tabela de arquivos (`7_task.md:30-48`), que hoje não os lista.

Recomendações:
1. **Docblocks fora do lugar em `apps/api/src/sessao/tenant/tenant-resolution.repository.ts`.** O de `#cruzaEscolas` (`:393-396`) ficou em cima do de `#contaEmUso` (`:397-401`), e o de `marcarEmailVerificado` (`:427-430`) ficou em cima do de `contaEmUso` (`:431-433`). Ao passar o mouse, o editor mostra o texto errado, e `#cruzaEscolas` e `marcarEmailVerificado` ficam sem doc. Mover cada bloco para cima do próprio método.
2. **A mutação `finalidade === 'verificar'` → `true` em `linkValidoPorHash` (`:542`) sobrevive.** No redefinir, a guarda `usuarios.length === 0` dentro da transação (`senha.service.ts:183`) dá o mesmo 404, então não é bloqueante. O custo é que o argon2 roda antes de recusar. Vale registrar no `--faltando` com esse motivo.

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tasks/prd-acesso-e-convites/7_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/tenant/tenant-resolution.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/senha/senha.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/test/posse-do-email.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/e2e/support/seed.ts

## revisor-geral · 3ª rodada · APROVADO · 2026-11-08 07:15:55 · `tasks/prd-acesso-e-convites/7_task.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok

Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)

Bloqueantes: nenhum

Recomendações:
- Os números de linha dos e2e aparecem nos dois documentos, `tasks/prd-acesso-e-convites/7_task.md:72` e `tasks/prd-acesso-e-convites/cenarios.md:228`. Eles ficaram certos nesta rodada: os testes começam em `convite.spec.ts` 211, 229 e 355 e em `entrar-convite-revogado.spec.ts` 20 e 59. Mas qualquer edição no topo desses arquivos os desalinha de novo. Nos dois documentos, o nome do caso (que a linha do `7_task.md` já traz) basta como referência.

Esta rodada mudou só comentários e documentos. Conferi três pontos:

- **Comentários do repository.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/tenant/tenant-resolution.repository.ts`, cada bloco de comentário agora fica em cima do próprio método (`#cruzaEscolas` e `marcarEmailVerificado`). O comentário de `linkValidoPorHash` bate com o código, que chama `#contaEmUso(conta.id, finalidade === 'verificar')`.
- **Mutação que sobrevive.** O `7_task.md` diz que trocar `finalidade === 'verificar'` por `true` não muda o resultado, e confirmei que é verdade. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/senha/senha.service.ts:183`, quando a conta não tem usuário, o código lança `linkInvalido()` dentro da transação. A resposta continua o mesmo 404, e a transação desfeita devolve o link sem uso. O único custo é o argon2 da linha 173 rodar antes de recusar, como o documento diz.
- **Arquivos previstos.** As duas linhas novas no `7_task.md` cobrem `e2e/support/seed.ts`, `tools/vitrine/escola.ts` e os dois e2e. Esses arquivos já estavam alterados na árvore e agora estão declarados.
