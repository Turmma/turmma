# Tarefa 1.0 — A porta de e-mail e o envio do convite pelo worker

**Funcionalidade:** acesso-e-convites · **Depende de:** nenhuma
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `test-engineer`
**Porte:** grande

## Objetivo

Um convite com envio `na_fila` sai uma vez por e-mail pelo `email.enviar-convite`, ou termina `cancelado` ou `falhou`; os cifrados somem fora de `na_fila` e `enviando`. Sem rota que enfileire (3.0) nem limite por minuto (2.0).

## Contexto necessário

- `techspec.md` seções 2, 3, 5 ("E-mail"), 6 e 7; `prd.md` RF11, RF16; `cenarios.md` RF11
- `.claude/rules/80` itens 3, 7 e 9; `.claude/rules/20` itens 9 e 12
- `secret-cipher.ts`; `revogarConviteAberto` (a defesa); `llm-config.ts` (a trava de configuração)

## Subtarefas

- [x] 1.1 — Migration que só expande `convite` (`canal`, cifrados, `envio`, `envioReservadoEm`, `enviadoEm`) e o check dos cifrados
- [x] 1.2 — `SecretCipher` em `packages/core/src/cripto/`, com cada chamador trocado
- [x] 1.3 — `EmailSender`, `SmtpEmailSender`, `FakeEmailSender` com barreira e a trava de configuração; Mailpit no compose em `127.0.0.1`
- [x] 1.4 — `EnvioRepository` e `enviar-email.ts`: reserva, envio fora da transação (10 s), `enviado` só com a minha reserva, 4xx/5xx
- [x] 1.5 — `cancelado` na revogação, no refazer e na defesa do `desativar`; o expurgo de 24 h
- [x] 1.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/drizzle/0042_envio_de_email.sql` | novo |
| `packages/core/drizzle/meta/_journal.json` | alterado |
| `packages/core/src/db/schema/convite.ts` | alterado |
| `packages/core/src/cripto/secret-cipher.ts` | movido |
| `apps/api/src/credencial/secret-cipher.ts` | removido |
| `packages/core/src/email/` | novo |
| `packages/core/package.json` | alterado |
| `packages/shared/src/system/job-definitions.ts` | alterado |
| `apps/worker/src/processors/enviar-email.ts` | novo |
| `apps/worker/src/composition.ts` | alterado |
| `packages/core/src/convite/convite-da-escola.repository.ts` | alterado |
| `packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts` | alterado |
| `packages/core/src/retencao/expurgo-da-escola.repository.ts` | alterado |
| `infra/compose.yml` | alterado |
| `apps/worker/test/enviar-email.int.test.ts` | novo |
| `apps/api/src/sessao/convite/convite-ticket.ts`, `convite-ticket.test.ts` | alterado |
| `apps/api/test/relogio-que-recua.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| corpo capturado pelo falso | integração | escola e link com o token depois do `#`; nenhum nome da lista | `apps/worker/test/enviar-email.int.test.ts › a mensagem › leva a escola e o link com o token depois do `#`, nenhum nome de usuário da escola, e termina `enviado` sem os cifrados` (escola, link, sem nome, `enviado`, cifrados nulos, log `gravado`); a montagem em `packages/core/src/email/mensagem-do-convite.test.ts › traz a escola e o link com o token depois do #, nunca na consulta` e `› não leva o endereço de quem recebe no texto nem no assunto: a mensagem não tem nome de ninguém` |
| [U] fora do local: sem `EMAIL_PROVEDOR_ID`, sem TLS, com o host do Mailpit | unidade | cada um recusa a partida | `packages/core/src/email/email-config.test.ts › fora do ambiente local, sem EMAIL_PROVEDOR_ID a partida é recusada, também com a variável vazia` (o provedor); `› fora do ambiente local, sem TLS a partida é recusada, com o EMAIL_SMTP_TLS ausente, vazio ou false` (o TLS); `› fora do ambiente local, o host do Mailpit (ou de qualquer endereço da nossa rede) é recusado` (o Mailpit); `› as três exigências valem juntas, e o ambiente local dispensa as três com o Mailpit`; no worker, `apps/worker/src/config.test.ts › o worker da fila normal recusa a partida com o e-mail falso em produção, e a mensagem cita só a variável` |
| revogado ou refeito entre a fila e o envio | integração | `cancelado`, zero envios; só o último link vale | `apps/worker/test/enviar-email.int.test.ts › a revogação vence o envio › revogar: revogado entre a fila e o envio, …`, `› revogarParaRefazer: revogado entre a fila e o envio, …` (o refazer: o link anterior vira `cancelado` e revogado, e só o novo, da 3.0, vale) e `› revogarConviteAberto (a defesa do desativar): revogado entre a fila e o envio, …`; o que a revogação não toca: `› revogar o convite com o envio já terminado (`enviado`, `falhou`, `cancelado`) ou sem envio (`copiado`) não muda o envio nem a hora do envio` |
| SMTP 5xx | integração | `falhou`, sem nova tentativa | `apps/worker/test/enviar-email.int.test.ts › o servidor de e-mail › 5xx: o convite termina `falhou` sem cifrados, e o job termina sem repetir`; a natureza em `packages/core/src/email/smtp-email-sender.test.ts › naturezaDaFalhaSmtp › a resposta 5xx recusa de vez; …` |
| SMTP 4xx; em toda tentativa | integração | volta a `na_fila` e termina `enviado`; sempre 4xx: `falhou` | `› o servidor de e-mail › 4xx: volta a `na_fila` com os cifrados e o job repete; a segunda tentativa envia`; `› sempre 4xx: as quatro primeiras tentativas devolvem, e a quinta grava `falhou``; `› a queda que não é uma recusa do servidor (erro sem natureza) vale como 4xx: …` |
| 4xx com revogação entre as tentativas | integração | `cancelado`, sem 2º envio | `› a revogação vence o envio › 4xx e revogação entre as tentativas: a linha devolvida é cancelada, e a segunda tentativa não manda um segundo e-mail` |
| expurgo com 23 h e com mais de 24 h | integração | ficam; depois `falhou`, cifrados nulos | `apps/worker/test/expurgo-da-escola.int.test.ts › envio de convite parado (acesso-e-convites, tarefa 1.0) › relógio falso: com 23 h o `na_fila` e o `enviando` ficam; com 25 h fecham `falhou` sem os cifrados e sem a reserva; …`; `› o convite já `enviado` ou `cancelado`, com 48 h, não é tocado`; `› a contagem vai ao log como `enviosFechadosTotal`, …`; `› [P] com outra conexão segurando a linha (`for update`), o expurgo pula (`skip locked`) e não espera; …` |
| isolamento: o alvo no `it.each(CATEGORIAS_DO_EXPURGO)` | integração | a linha da B com a mesma idade fica | o mesmo `› relógio falso: …` (a linha da B, com 25 h, fica `na_fila`). O envio parado não é categoria de retenção (prazo fixo, não ajustável por escola), então não entra no `it.each`: divergência registrada abaixo |
| `enviado`, `falhou`, `cancelado` | integração | cifrados nulos | `› a mensagem › leva a escola e o link …` (`enviado`); `› o servidor de e-mail › 5xx: …` (`falhou`); `› a revogação vence o envio › revogar: …` (`cancelado`); no banco, `packages/core/src/db/schema/convite-envio.int.test.ts › os cifrados › o token e o endereço cifrados somem em `enviado`, `falhou` e `cancelado`: o banco recusa qualquer um dos dois ali` e `› em `na_fila` e `enviando` os dois vêm juntos: …` |
| log do worker capturado | integração | sem token, e-mail nem resposta do SMTP | `› o que o log guarda › nenhuma linha traz o token, o endereço, o nome da escola nem o nome da pessoa: só ids, a tentativa e o motivo`; a conversa SMTP não vai ao log: `smtp-email-sender.test.ts › opcoesDoTransporte › não liga logger nem debug: …` e `› SmtpEmailSender › a recusa 5xx sobe como falha permanente, e a 4xx como transitória, sem a mensagem do servidor nem o endereço` |
| reserva morta há mais de 2 min | integração | retomada, um envio | `› a reserva › reserva morta há mais de 2 min: outro processo retoma e envia; vigente há 1 min: não retoma, o job repete e nada sai`; `› o desfecho é da reserva: `concluir` e `devolver` com a marca de uma reserva que outro processo já retomou não gravam nada` |
| [P] duas execuções, a 1ª na barreira do falso | paralelo | um envio; cai sem `envio = 'na_fila'` na reserva | `› a reserva › [P] duas execuções ao mesmo tempo, a primeira na barreira: a segunda não envia, e o e-mail sai uma vez só` e `› [P] oito reservas do mesmo convite ao mesmo tempo: o banco concede uma só, e as outras veem a reserva alheia` |
| [P] revogação com o job na barreira | paralelo | responde na hora, `cancelado`, link recusado; cai sem `envioReservadoEm = :minha` | `› a revogação vence o envio › [P] revogado com o job na barreira: o e-mail já saiu, mas a linha continua `cancelada` e o `enviado` não a sobrescreve` (a revogação responde com o job preso; `revogado_em` gravado, que é o que recusa o link no aceite); a condição do desfecho: `› o desfecho de quem reservou não ressuscita o convite revogado: …` e `› o desfecho é da reserva: …` |
| defesa do `desativar` (convite aberto plantado), `na_fila` e `enviando` | integração | `cancelado`, zero envios | `apps/api/test/ciclo-de-vida.int.test.ts › defesa do desativar com o convite aberto por e-mail em `na_fila` / `enviando`` (o `it.each`, `cancelado`, sem cifrados, aceite 404) e, para zero envios, `enviar-email.int.test.ts › … revogarConviteAberto (a defesa do desativar): …` |
| permissão: professor pendente com envio `na_fila` | integração | `desativar` dá `NAO_ENCONTRADO`, envio intacto | `apps/api/test/ciclo-de-vida.int.test.ts › professor pendente com o envio `na_fila`: o desativar responde NAO_ENCONTRADO, igual ao inexistente, e o envio fica como estava, com os cifrados` |
| isolamento: convite da B num job da A; payload adulterado; job repetido após `enviado` | integração | nada enviado; vale a escola do registro; um envio | `› isolamento entre escolas › o id do convite da escola B num job da escola A: nada é enviado e a linha da B fica intacta`; `› o convite da B com o envio `enviando` e reserva vigente, num job da A, também é `inexistente`: …`; `› o payload adulterado (escola no payload, id que não é UUID) é recusado pelo esquema do tipo`; `› a reserva › o job repetido depois de `enviado` não manda de novo`; `› o desfecho de uma escola não alcança o convite de outra: …` |
| cifra adulterada ou copiada de outro convite | integração | `falhou`, nada enviado; erro que não é de decifração sobe | `› a cifra › o token adulterado, ou copiado da linha de outro convite, não decifra: o envio termina `falhou` e nada sai`; `› o erro que não é de decifração sobe como veio, e a linha não vira `falhou`: a reserva vence e o job repete`; a cifra em si, `packages/core/src/cripto/secret-cipher.test.ts › borda: o segredo cifrado copiado de uma conta para outra não decifra` e `› borda: um byte alterado, a versão trocada ou a chave de outra versão não decifram` |
| a migration (compatível com o código anterior) | integração | colunas e checks novos; o convite gravado como antes entra `copiado` | `packages/core/src/db/schema/convite-envio.int.test.ts` (dez casos: o convite como antes, o canal, o envio, canal × envio, os cifrados em cada estado, o `update` sem anular os cifrados, a marca da reserva e o índice parcial) |
| o adaptador e a configuração de e-mail | unidade | SMTP com prazo de 10 s, TLS, credencial; falso só fora de produção; o adaptador escolhido | `packages/core/src/email/smtp-email-sender.test.ts` (incluindo `o envio que termina sem o sinal disparar não deixa o ouvinte de `abort` no sinal do job, que vive mais que ele`), `email-config.test.ts`, `fake-email-sender.test.ts`, `criar-email-sender.test.ts › o adaptador `smtp` com o servidor configurado é o SMTP; o `falso` é o do teste, que nunca toca a rede`; no worker, `apps/worker/src/config.test.ts › quem atende a fila normal não sobe sem %s: …` e `apps/worker/src/composition.test.ts › o arquivo do titular, a planilha e o e-mail do convite só na `normal`, …` |
| bilhete do convite com o relógio de quem confere atrasado (estabilização) | unidade | o `iat` até 30 s à frente do relógio vale, com 31 s não; o prazo de 30 min segue exato, também para o bilhete com `exp` maior | `apps/api/src/sessao/convite/convite-ticket.test.ts › borda: o relógio que recua depois de emitir não derruba o bilhete, até a folga; o prazo de 30 min segue exato` e `› borda: bilhete assinado com a nossa chave e um `exp` maior que o prazo vale só até 30 min depois do `iat`` |
| os cifrados do convite fora do arquivo do titular | unidade | o token e o endereço cifrados nunca entram no arquivo do titular (D85), e cada coluna aparece uma vez só | `packages/shared/src/privacidade/classificacao.test.ts › COLUNAS_FORA_DO_ARQUIVO › o token e o endereço cifrados do convite que espera o e-mail nunca entram no arquivo do titular` |

## Como testar

- Job: `apps/worker/test/job-execution.int.test.ts` › "job da fila com a escola A, ou sem escola, apontando para a linha da B não roda…"; `QueueFixtures`
- Configuração: `packages/core/src/config/llm-config.test.ts:112` › "fora da nossa rede, o provedor precisa de id…"
- Expurgo: `apps/worker/test/expurgo-da-escola.int.test.ts:589` (`it.each`) e `relogioEm` (linha 68)
- Revogação: `apps/api/test/professores.int.test.ts` › "E8: cadastrar devolve o link uma vez…"; `WriteBlockTrigger`
- Comando: `npx vitest run --project integracao apps/worker/test/enviar-email.int.test.ts`; `npx vitest run --project unidade packages/core/src/email/`

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), no plano. Na 4: o pendente cai no `NAO_ENCONTRADO` antes da defesa; a defesa se prova com o convite aberto num usuário ativo.

### Plano

**Interfaces.** `EmailSender.enviar(mensagem, sinal?)` (porta, em `packages/core/src/email/`); `EmailSendError(natureza: 'permanente' | 'transitoria')` com mensagem fixa;
`SmtpEmailSender` (`nodemailer`, prazo de 10 s por `Promise.race` e `AbortSignal`, sem `logger` nem `debug`); `FakeEmailSender` (`enviadas`, `tentativas`,
`falharProximos`, `segurarNoProximo`); `loadEmailConfig` (a trava: falso proibido em produção; fora do local, `EMAIL_PROVEDOR_ID`, TLS e host que não seja da nossa rede);
`EnvioRepository.reservar / concluir / devolver`; `criarEnvioDoConvite(...)` em `apps/worker/src/processors/enviar-email.ts`; `CANCELAR_O_ENVIO_DO_CONVITE` (um valor só, usado
pelas três revogações); `SecretCipher` em `packages/core/src/cripto/`.

**Ordem.** (1.1) migration `0042` que só expande `convite`, com os checks `not valid` + `validate`; (1.2) `git mv` do `SecretCipher` e troca de cada chamador para `@educa/core`; (1.3) porta,
adaptadores e configuração, e o Mailpit no compose (`127.0.0.1`); (1.4) o repository e o job; (1.5) `cancelado` nas três revogações e o expurgo de 24 h; (1.6) os testes, um por linha da tabela.

**O desenho do envio.** A reserva é um `UPDATE ... WHERE envio = 'na_fila' OR (envio = 'enviando' AND envio_reservado_em <= now() - 2 min) RETURNING`, com a marca em milissegundo (a precisão do
`Date`); o envio ao SMTP fica **fora de transação**; `concluir` (`enviado` ou `falhou`) e `devolver` (volta a `na_fila`) só gravam se `envio = 'enviando'` e a marca é a de quem reservou. 5xx é
`falhou`; 4xx ou queda devolve e o job repete (cinco tentativas, a quinta grava `falhou`). A cifra é AES-256-GCM com o id do convite como dado autenticado.

### As 12 perguntas

1. **Mutação de cada cláusula:** na seção "Mutações", um bloco por cláusula do diff (reserva, janela de 2 min nos dois sentidos, as duas condições do desfecho, o `case` do cancelamento, os cinco checks e o
   índice da migration, o expurgo, cada exigência da configuração, o SMTP, o processor). Cada bloco foi aplicado e rodado antes do pedido. O que não tem bloco leva o motivo ali.
2. **Texto na tela:** a tarefa não tem tela; o texto novo é o do e-mail (`mensagem-do-convite.ts`), que nenhum `e2e/` cita (`grep -rln 'convidou você para o Turmma' e2e/` vazio).
3. **Segundo dado que torna a cláusula observável:** o expurgo tem a linha da B com a mesma idade; a reserva tem o convite `enviando` vigente (1 min) **e** o morto (3 min); o cancelamento tem
   `enviado`, `falhou`, `cancelado` e `copiado` ao lado do `na_fila`; o desfecho tem uma segunda reserva (retomada) com marca diferente.
4. **Checagem anterior que responde antes:** o professor pendente cai no `NAO_ENCONTRADO` do `desativar` antes de chegar à defesa; por isso a defesa se prova com o convite aberto de um usuário
   **ativo** (`ciclo-de-vida.int.test.ts`), e o pendente tem o caso próprio (envio intacto). No job, o `JobExecutor` não entra: o processador é chamado direto no contexto da escola, e o isolamento é provado
   pelo `reservar` (`inexistente` para o id da B), com o `estado` no log.
5. **Asserção olha o resultado:** a linha do banco (`envio`, cifrados, `enviado_em`, marca), as mensagens que o falso aceitou e o log capturado; nenhum caso olha texto de arquivo.
6. **Guarda nova:** nenhuma regra de lint nem teste estrutural nasce aqui. A cerca do `EnvioRepository` (`ZONAS_DAS_CLASSES_CERCADAS` e `cerca-envio`) é da tarefa 5.0, como a spec diz.
7. **Comentário que afirma o que o código não faz:** o docblock do processor diz "reserva alheia ainda vigente: o job repete (a saída de adiar é da 2.0)", que é o que o código faz hoje; o de
   `cancelar-envio.ts` diz que o `enviado` tardio "não casa", e o caso `[P] revogado com o job na barreira` o prova.
8. **Divergência com regra nova:** as quatro da tabela abaixo. Nenhuma cria trava, rota ou gravação sem sessão; a que mexe em regra (o check dos cifrados) está na `techspec.md` §3 e em `docs/modelo-de-dados.md`.
9. **Peça que já existe:** o `SecretCipher` foi movido, e não copiado; a validação de configuração reusa `validateEnvironment` e `enderecoDaNossaRede` (exportada de `llm-config.ts`); os testes reusam
   `QueueFixtures`, `InMemoryLog` e `jobExecution`.
10. **Operação simultânea:** a reserva e a revogação com o job parado têm caso `[P]` com a barreira do falso (sem `Promise.all` solto); o `concluir`/`devolver` com marca alheia tem caso direto no repository.
    O expurgo contra o job segurando a linha tem caso com `for update` em outra conexão.
11. **Isolamento e coluna "Caso":** o `reservar` sem a cláusula da escola envia o e-mail do convite da B (caso `o id do convite da escola B num job da escola A` fica vermelho); o `concluir`/`devolver` sem ela
    gravam na linha da B (caso `o desfecho de uma escola não alcança o convite de outra`); a tabela tem o caso de cada linha, um por comportamento.
12. **"O que verificar" dos guardiões:** `tenancy-guardian` (escopo vindo do contexto, 404 igual para a B), `privacy-guardian` (cifrados nulos fora do envio aberto, expurgo de 24 h, log sem dado, a tabela de
    dados do `docs/lgpd.md` já cita os campos), `infra-guardian` (envio fora de transação, reserva atômica, 10 s, migration só expande, Mailpit só em `127.0.0.1`), `test-engineer` (um caso por linha, `[P]` com a
    barreira). O `achados/indice.md` só tem rodadas da revisão da spec, sem achado para esta tarefa.

## Fora do escopo desta tarefa

O `EMAIL_POR_MINUTO` e a saída de adiar (2.0); a rota "Enviar" (3.0); o link da conta (5.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| O envio de convite parado (24 h) **não** entra no `it.each(CATEGORIAS_DO_EXPURGO)`: tem o bloco próprio `envio de convite parado` no `expurgo-da-escola.int.test.ts`, com a linha da B | `CATEGORIAS_DO_EXPURGO` é prazo em meses, ajustável por escola (`retencao_escola`), e o `it.each` semeia por `CATEGORIAS_DE_RETENCAO[categoria].padrao`; o envio parado tem prazo fixo em código (`HORAS_DO_ENVIO_DE_CONVITE_NA_FILA = 24`), como a importação parada, que já tem bloco próprio. Pô-lo na lista criaria categoria de retenção, linha em `execucao_expurgo` e prazo que a escola ajusta | `cenarios.md` (RF11, a linha "Os dois alvos novos do `retencao.expurgar-escola`", na seção de isolamento), reescrita nesta tarefa; `techspec.md` §5 não nomeia o `it.each`; `docs/lgpd.md` linha 77 (24 h contadas do `criadoEm`) já diz o prazo fixo |
| O `convite` ganha também `criado_em` (`timestamptz not null default now()`) e o índice parcial `convite_envio_aberto_idx (escola_id, criado_em) where envio in ('na_fila','enviando')` | as 24 h do expurgo se contam do `criadoEm` da linha (`cenarios.md` RF11: "com mais de 24 h do novo `criadoEm`"), e o convite não tinha a coluna; o índice atende o `skip locked` do expurgo (regra 80, item 8). Migration só expande: o código anterior grava o convite sem a coluna e o banco preenche `now()` | `techspec.md` §3 (a linha do `convite`, acrescentada nesta tarefa); `docs/lgpd.md` linha 77 (já citava o `criadoEm`); `docs/modelo-de-dados.md` (parágrafo "O envio por e-mail") |
| O check `convite_cifrados_so_no_envio_aberto` exige o token e o endereço cifrados **presentes** em `na_fila` e `enviando` (além de nulos fora deles), escrito com `case when` | a spec só dizia "nulos fora de `na_fila` e `enviando`". A forma com `or` deixava passar, no convite `copiado` (envio nulo), os cifrados preenchidos, porque `NULL` num `check` conta como verdadeiro; o `case` fecha os dois lados e o banco recusa o `na_fila` sem endereço. Mesmo caso do `convite_reserva_so_enviando` (`envio is not null and ...`) | `techspec.md` §3 (parágrafo "`envio`: ..."); `docs/modelo-de-dados.md` (parágrafo "O envio por e-mail") |
| A regra de cancelar o envio mora em `packages/core/src/convite/cancelar-envio.ts` (`CANCELAR_O_ENVIO_DO_CONVITE`), usada pelo `revogar` e pelo `revogarParaRefazer` do `ConviteRepository` (API) e pelo `revogarConviteAberto` do core; o `convite-da-escola.repository.ts` da tabela "Arquivos previstos" não muda | as duas revogações da coordenação ficam em `apps/api/src/sessao/convite/convite.repository.ts`, e não no repository do core; um valor só evita três cópias da regra que divergiriam | `techspec.md` §2 (linha nova de `packages/core/src/convite/cancelar-envio.ts`) |
| O bilhete do convite (`convite-ticket.ts`) passa a tolerar `TICKET_CLOCK_TOLERANCE_SECONDS` (30 s) de relógio atrasado em quem confere, com a idade conferida em segundos (até 30 min depois do `iat`, até 30 s antes dele) no lugar do `maxTokenAge` do `jose`; os testes de integração do convite e do ciclo de vida ganham `relogio-que-recua.ts` (o `desativado_em` do recém-convidado um minuto no passado; o desativar depois do último aceite), a folga do convite vencido passa de 1 s para 10 s e a auditoria dos dois casos é ordenada por `xmin` | o portão da 1.0 caiu em casos de `convite.int.test.ts` e `ciclo-de-vida.int.test.ts` (alvos por causa do import do `SecretCipher`) que nada têm com o envio: o relógio de parede da máquina de desenvolvimento recua de 0,8 a 1,7 s a cada uns 15 s (`timedatectl timesync-status`: offset de -1,75 s). O `jose` só confere o `iat` no futuro com `maxTokenAge`, sem folga, e dois relógios 1 s fora descartavam o bilhete em silêncio (`pronta` no lugar de `escolher`): fragilidade do produto, também entre instâncias da API. O `challenge.ts` e o `operador-challenge.ts` têm o mesmo `maxTokenAge` e ficam fora desta tarefa (ressalva do relatório) | `techspec.md` §2 (`convite-ticket.ts`, `TICKET_CLOCK_TOLERANCE_SECONDS`) |

## Mutações

--faltando: 5 linhas (123 blocos, 5 motivos). Cada bloco foi aplicado e rodado antes do pedido (executor local sobre o mesmo `comandoDoTeste` do portão): todos ficaram vermelhos, cada um num caso que rodou e falhou.

Motivos das cinco linhas sem bloco:

- `packages/core/src/cripto/secret-cipher.ts:54` (`chave === undefined || length <= IV + etiqueta`) e `:70` (`#chave`): o arquivo foi **movido** de `apps/api/src/credencial/` sem mudar a lógica (o `git` o mostra como novo porque a ferramenta lê o diff sem detectar renomeação). Os dois termos de `:54` levam ao mesmo `SecretDecryptionError` que o `try` seguinte lança com a chave ausente ou com o texto curto (tirar um deles não muda o resultado observável), e `:70` é a guarda de uma chave que o construtor já garantiu. A cifra tem o teste dela (`secret-cipher.test.ts`) e o bloco de `:40`.
- `packages/core/src/db/schema/convite.ts:78` (`.where(` do índice parcial): espelho, em Drizzle, do índice que a migration cria; o que o banco tem é o texto da `0042`, e o bloco do índice parcial na migration (`convite_envio_aberto_idx`) é o que cai no `convite-envio.int.test.ts`.
- `packages/core/src/retencao/expurgo-da-escola.repository.ts:500` (`rowCount ?? 0`): o `rowCount` do `pg` é `number | null` só pelo tipo; num `update` ele sempre vem número, e o 0 é a saída do tipo, sem caminho que o produza.
- `apps/api/src/sessao/convite/convite-ticket.ts:68` (`verificado.payload.iat ?? 0`): o `requiredClaims: ['exp', 'iat']` já recusa o bilhete sem `iat` no `jose`, então o `?? 0` é a saída do tipo (`iat` é `number | undefined`); e, se chegasse, o 0 dá uma idade de 56 anos e o bilhete é recusado do mesmo jeito. Os dois termos do `if` da linha de baixo têm bloco.

```mutacao
arquivo: packages/core/src/email/envio.repository.ts
teste: apps/worker/test/enviar-email.int.test.ts › leva a escola e o link com o token depois do
        where escola_id = ${escolaId} and id = ${conviteId}
-          and (envio = 'na_fila' or (envio = 'enviando' and envio_reservado_em <= now() - make_interval(mins => ${MINUTOS_DA_RESERVA_DO_ENVIO})))
+          and (envio = 'enviando' and envio_reservado_em <= now() - make_interval(mins => ${MINUTOS_DA_RESERVA_DO_ENVIO}))
```

```mutacao
arquivo: packages/core/src/email/envio.repository.ts
teste: apps/worker/test/enviar-email.int.test.ts › reserva morta há mais de 2 min
        where escola_id = ${escolaId} and id = ${conviteId}
-          and (envio = 'na_fila' or (envio = 'enviando' and envio_reservado_em <= now() - make_interval(mins => ${MINUTOS_DA_RESERVA_DO_ENVIO})))
+          and (envio = 'na_fila' or envio = 'enviando')
```

```mutacao
arquivo: packages/core/src/email/envio.repository.ts
teste: apps/worker/test/enviar-email.int.test.ts › reserva morta há mais de 2 min
- export const MINUTOS_DA_RESERVA_DO_ENVIO = 2
+ export const MINUTOS_DA_RESERVA_DO_ENVIO = 0
```

```mutacao
arquivo: packages/core/src/email/envio.repository.ts
teste: apps/worker/test/enviar-email.int.test.ts › reserva morta há mais de 2 min
- export const MINUTOS_DA_RESERVA_DO_ENVIO = 2
+ export const MINUTOS_DA_RESERVA_DO_ENVIO = 5
```

```mutacao
arquivo: packages/core/src/email/envio.repository.ts
teste: apps/worker/test/enviar-email.int.test.ts › o id do convite da escola B num job da escola A
        update convite
        set envio = 'enviando', envio_reservado_em = date_trunc('milliseconds', clock_timestamp())
-        where escola_id = ${escolaId} and id = ${conviteId}
+        where id = ${conviteId}
```

```mutacao
arquivo: packages/core/src/email/envio.repository.ts
teste: apps/worker/test/enviar-email.int.test.ts › leva a escola e o link com o token depois do
-    if (reservado !== undefined) return { resultado: 'reservado', ...reservado, reserva: new Date(reservado.reserva) }
+    if (reservado !== undefined) return { resultado: 'reservado', ...reservado }
```

```mutacao
arquivo: packages/core/src/email/envio.repository.ts
teste: apps/worker/test/enviar-email.int.test.ts › leva a escola e o link com o token depois do
-    if (reservado !== undefined) return { resultado: 'reservado', ...reservado, reserva: new Date(reservado.reserva) }
+    if (reservado === undefined) return { resultado: 'reservado', ...reservado, reserva: new Date(reservado.reserva) }
```

```mutacao
arquivo: packages/core/src/email/envio.repository.ts
teste: apps/worker/test/enviar-email.int.test.ts › o id do convite da escola B num job da escola A
      .from(convite)
-      .where(and(eq(convite.escolaId, escolaId), eq(convite.id, conviteId)))
+      .where(eq(convite.id, conviteId))
```

```mutacao
arquivo: packages/core/src/email/envio.repository.ts
teste: apps/worker/test/enviar-email.int.test.ts › o id do convite da escola B num job da escola A
-    if (atual === undefined) return { resultado: 'inexistente' }
+    if (atual === undefined) return { resultado: 'encerrado' }
```

```mutacao
arquivo: packages/core/src/email/envio.repository.ts
teste: apps/worker/test/enviar-email.int.test.ts › reserva morta há mais de 2 min
-    if (atual.envio === 'enviando' && atual.reservadoEm !== null) return { resultado: 'reserva_alheia', ate: new Date(atual.reservadoEm.getTime() + MINUTOS_DA_RESERVA_DO_ENVIO * 60_000) }
+    if (atual.envio === 'na_fila' && atual.reservadoEm !== null) return { resultado: 'reserva_alheia', ate: new Date(atual.reservadoEm.getTime() + MINUTOS_DA_RESERVA_DO_ENVIO * 60_000) }
```

```mutacao
arquivo: packages/core/src/email/envio.repository.ts
teste: apps/worker/test/enviar-email.int.test.ts › reserva morta há mais de 2 min
-    if (atual.envio === 'enviando' && atual.reservadoEm !== null) return { resultado: 'reserva_alheia', ate: new Date(atual.reservadoEm.getTime() + MINUTOS_DA_RESERVA_DO_ENVIO * 60_000) }
+    if (atual.envio === 'enviando' && atual.reservadoEm === null) return { resultado: 'reserva_alheia', ate: new Date(atual.reservadoEm.getTime() + MINUTOS_DA_RESERVA_DO_ENVIO * 60_000) }
```

```mutacao
arquivo: packages/core/src/email/envio.repository.ts
teste: apps/worker/test/enviar-email.int.test.ts › 5xx: o convite termina
-        enviadoEm: desfecho === 'enviado' ? sql`now()` : null,
+        enviadoEm: sql`now()`,
```

```mutacao
arquivo: packages/core/src/email/envio.repository.ts
teste: apps/worker/test/enviar-email.int.test.ts › 5xx: o convite termina
        enviadoEm: desfecho === 'enviado' ? sql`now()` : null,
-        tokenCifrado: null,
+        tokenCifrado: sql`token_cifrado`,
```

```mutacao
arquivo: packages/core/src/email/envio.repository.ts
teste: apps/worker/test/enviar-email.int.test.ts › o desfecho é da reserva
        envioReservadoEm: null,
      })
-      .where(and(eq(convite.escolaId, requireEscolaId()), eq(convite.id, conviteId), eq(convite.envio, 'enviando'), eq(convite.envioReservadoEm, reserva)))
+      .where(and(eq(convite.escolaId, requireEscolaId()), eq(convite.id, conviteId), eq(convite.envio, 'enviando')))
```

```mutacao
arquivo: packages/core/src/email/envio.repository.ts
teste: apps/worker/test/enviar-email.int.test.ts › não ressuscita o convite revogado
        envioReservadoEm: null,
      })
-      .where(and(eq(convite.escolaId, requireEscolaId()), eq(convite.id, conviteId), eq(convite.envio, 'enviando'), eq(convite.envioReservadoEm, reserva)))
+      .where(and(eq(convite.escolaId, requireEscolaId()), eq(convite.id, conviteId)))
```

```mutacao
arquivo: packages/core/src/email/envio.repository.ts
teste: apps/worker/test/enviar-email.int.test.ts › o desfecho de uma escola não alcança o convite de outra
        envioReservadoEm: null,
      })
-      .where(and(eq(convite.escolaId, requireEscolaId()), eq(convite.id, conviteId), eq(convite.envio, 'enviando'), eq(convite.envioReservadoEm, reserva)))
+      .where(and(eq(convite.id, conviteId), eq(convite.envio, 'enviando'), eq(convite.envioReservadoEm, reserva)))
```

```mutacao
arquivo: packages/core/src/email/envio.repository.ts
teste: apps/worker/test/enviar-email.int.test.ts › o desfecho é da reserva
      .set({ envio: 'na_fila', envioReservadoEm: null })
-      .where(and(eq(convite.escolaId, requireEscolaId()), eq(convite.id, conviteId), eq(convite.envio, 'enviando'), eq(convite.envioReservadoEm, reserva)))
+      .where(and(eq(convite.escolaId, requireEscolaId()), eq(convite.id, conviteId), eq(convite.envio, 'enviando')))
```

```mutacao
arquivo: packages/core/src/email/envio.repository.ts
teste: apps/worker/test/enviar-email.int.test.ts › não ressuscita o convite revogado
      .set({ envio: 'na_fila', envioReservadoEm: null })
-      .where(and(eq(convite.escolaId, requireEscolaId()), eq(convite.id, conviteId), eq(convite.envio, 'enviando'), eq(convite.envioReservadoEm, reserva)))
+      .where(and(eq(convite.escolaId, requireEscolaId()), eq(convite.id, conviteId)))
```

```mutacao
arquivo: packages/core/src/email/envio.repository.ts
teste: apps/worker/test/enviar-email.int.test.ts › o desfecho de uma escola não alcança o convite de outra
      .set({ envio: 'na_fila', envioReservadoEm: null })
-      .where(and(eq(convite.escolaId, requireEscolaId()), eq(convite.id, conviteId), eq(convite.envio, 'enviando'), eq(convite.envioReservadoEm, reserva)))
+      .where(and(eq(convite.id, conviteId), eq(convite.envio, 'enviando'), eq(convite.envioReservadoEm, reserva)))
```

```mutacao
arquivo: packages/core/src/email/envio.repository.ts
teste: apps/worker/test/enviar-email.int.test.ts › 4xx: volta a
-      .set({ envio: 'na_fila', envioReservadoEm: null })
+      .set({ envio: 'na_fila' })
```

```mutacao
arquivo: packages/core/src/convite/cancelar-envio.ts
teste: apps/worker/test/enviar-email.int.test.ts › revogado com o job na barreira
-  envio: sql`case when ${convite.envio} in ('na_fila', 'enviando') then 'cancelado' else ${convite.envio} end`,
+  envio: sql`case when ${convite.envio} in ('na_fila') then 'cancelado' else ${convite.envio} end`,
```

```mutacao
arquivo: packages/core/src/convite/cancelar-envio.ts
teste: apps/worker/test/enviar-email.int.test.ts › revogar: revogado entre a fila e o envio
-  envio: sql`case when ${convite.envio} in ('na_fila', 'enviando') then 'cancelado' else ${convite.envio} end`,
+  envio: sql`case when ${convite.envio} in ('enviando') then 'cancelado' else ${convite.envio} end`,
```

```mutacao
arquivo: packages/core/src/convite/cancelar-envio.ts
teste: apps/worker/test/enviar-email.int.test.ts › revogar o convite com o envio já terminado
-  envio: sql`case when ${convite.envio} in ('na_fila', 'enviando') then 'cancelado' else ${convite.envio} end`,
+  envio: sql`case when ${convite.envio} in ('na_fila', 'enviando') then 'cancelado' else 'cancelado' end`,
```

```mutacao
arquivo: packages/core/src/convite/cancelar-envio.ts
teste: apps/worker/test/enviar-email.int.test.ts › revogar: revogado entre a fila e o envio
-  tokenCifrado: sql`null`,
+  tokenCifrado: sql`token_cifrado`,
```

```mutacao
arquivo: packages/core/src/convite/cancelar-envio.ts
teste: apps/worker/test/enviar-email.int.test.ts › revogar: revogado entre a fila e o envio
-  destinoCifrado: sql`null`,
+  destinoCifrado: sql`destino_cifrado`,
```

```mutacao
arquivo: packages/core/src/convite/cancelar-envio.ts
teste: apps/worker/test/enviar-email.int.test.ts › revogado com o job na barreira
-  envioReservadoEm: sql`null`,
+  envioReservadoEm: sql`envio_reservado_em`,
```

```mutacao
arquivo: apps/api/src/sessao/convite/convite.repository.ts
teste: apps/worker/test/enviar-email.int.test.ts › revogarParaRefazer: revogado entre
-      .set({ revogadoEm: sql`now()`, ...CANCELAR_O_ENVIO_DO_CONVITE })
+      .set({ revogadoEm: sql`now()` })
       .where(and(eq(convite.escolaId, requireEscolaId()), eq(convite.id, conviteId), eq(convite.tipo, tipo), isNull(convite.usadoEm), isNull(convite.revogadoEm)))
```

```mutacao
arquivo: apps/api/src/sessao/convite/convite.repository.ts
teste: apps/worker/test/enviar-email.int.test.ts › revogar: revogado entre a fila e o envio
-      .set({ revogadoEm: sql`now()`, ...CANCELAR_O_ENVIO_DO_CONVITE })
+      .set({ revogadoEm: sql`now()` })
       .where(and(eq(convite.escolaId, requireEscolaId()), eq(convite.id, conviteId), eq(convite.tipo, tipo), isNull(convite.revogadoEm)))
```

```mutacao
arquivo: packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts
teste: apps/worker/test/enviar-email.int.test.ts › revogarConviteAberto
-      .set({ revogadoEm: sql`now()`, ...CANCELAR_O_ENVIO_DO_CONVITE })
+      .set({ revogadoEm: sql`now()` })
       .where(and(eq(convite.escolaId, requireEscolaId()), eq(convite.usuarioId, usuarioId), isNull(convite.usadoEm), isNull(convite.revogadoEm)))
```

```mutacao
arquivo: apps/worker/src/processors/enviar-email.ts
teste: apps/worker/test/enviar-email.int.test.ts › o erro que não é de decifração sobe como veio
-      if (!(erro instanceof SecretDecryptionError)) throw erro
+      if (!(erro instanceof SecretDecryptionError)) return undefined
```

```mutacao
arquivo: apps/worker/src/processors/enviar-email.ts
teste: apps/worker/test/enviar-email.int.test.ts › o token adulterado, ou copiado
-      await envios.concluir(conviteId, reservado.reserva, 'falhou')
```

```mutacao
arquivo: apps/worker/src/processors/enviar-email.ts
teste: apps/worker/test/enviar-email.int.test.ts › reserva morta há mais de 2 min
-    if (reservado.resultado === 'reserva_alheia') {
+    if (reservado.resultado === 'inexistente') {
```

```mutacao
arquivo: apps/worker/src/processors/enviar-email.ts
teste: apps/worker/test/enviar-email.int.test.ts › o job repetido depois de
-    if (reservado.resultado !== 'reservado') {
+    if (reservado.resultado === 'inexistente') {
```

```mutacao
arquivo: apps/worker/src/processors/enviar-email.ts
teste: apps/worker/test/enviar-email.int.test.ts › o token adulterado, ou copiado
-    if (mensagem === undefined) return
```

```mutacao
arquivo: apps/worker/src/processors/enviar-email.ts
teste: apps/worker/test/enviar-email.int.test.ts › a queda que não é uma recusa
-      const tipo = erro instanceof EmailSendError ? erro.natureza : 'transitoria'
+      const tipo = erro instanceof EmailSendError ? erro.natureza : 'permanente'
```

```mutacao
arquivo: apps/worker/src/processors/enviar-email.ts
teste: apps/worker/test/enviar-email.int.test.ts › 5xx: o convite termina
-      const tipo = erro instanceof EmailSendError ? erro.natureza : 'transitoria'
+      const tipo = erro instanceof EmailSendError ? 'transitoria' : 'transitoria'
```

```mutacao
arquivo: apps/worker/src/processors/enviar-email.ts
teste: apps/worker/test/enviar-email.int.test.ts › 5xx: o convite termina
-      if (tipo === 'transitoria' && tentativa < TENTATIVAS_DO_ENVIO_DE_EMAIL) {
+      if (tentativa < TENTATIVAS_DO_ENVIO_DE_EMAIL) {
```

```mutacao
arquivo: apps/worker/src/processors/enviar-email.ts
teste: apps/worker/test/enviar-email.int.test.ts › sempre 4xx
-      if (tipo === 'transitoria' && tentativa < TENTATIVAS_DO_ENVIO_DE_EMAIL) {
+      if (tipo === 'transitoria') {
```

```mutacao
arquivo: apps/worker/src/processors/enviar-email.ts
teste: apps/worker/test/enviar-email.int.test.ts › sempre 4xx
-      if (tipo === 'transitoria' && tentativa < TENTATIVAS_DO_ENVIO_DE_EMAIL) {
+      if (tipo === 'transitoria' && tentativa <= TENTATIVAS_DO_ENVIO_DE_EMAIL) {
```

```mutacao
arquivo: apps/worker/src/processors/enviar-email.ts
teste: apps/worker/test/enviar-email.int.test.ts › 4xx: volta a
-        await envios.devolver(conviteId, reserva)
```

```mutacao
arquivo: apps/worker/src/processors/enviar-email.ts
teste: apps/worker/test/enviar-email.int.test.ts › 4xx: volta a
         logger.warn({ evento: 'email.convite_repetira', conviteId, tentativa, tipo })
-        throw new JobFailureError(JobFailureCode.ERRO_INTERNO)
```

```mutacao
arquivo: apps/worker/src/processors/enviar-email.ts
teste: apps/worker/test/enviar-email.int.test.ts › o 5xx de quem perdeu a reserva
-      logger.warn({ evento: 'email.convite_falhou', conviteId, tentativa, tipo, estado: gravou ? 'gravado' : 'reserva_perdida' })
+      logger.warn({ evento: 'email.convite_falhou', conviteId, tentativa, tipo, estado: 'gravado' })
```

```mutacao
arquivo: apps/worker/src/processors/enviar-email.ts
teste: apps/worker/test/enviar-email.int.test.ts › revogado com o job na barreira
-    logger.info({ evento: 'email.convite_enviado', conviteId, tentativa, estado: gravou ? 'gravado' : 'reserva_perdida' })
+    logger.info({ evento: 'email.convite_enviado', conviteId, tentativa, estado: 'gravado' })
```

```mutacao
arquivo: apps/worker/src/processors/enviar-email.ts
teste: apps/worker/test/enviar-email.int.test.ts › 5xx: o convite termina
-      const gravou = await envios.concluir(conviteId, reserva, 'falhou')
+      const gravou = true
```

```mutacao
arquivo: apps/worker/src/processors/enviar-email.ts
teste: apps/worker/test/enviar-email.int.test.ts › leva a escola e o link com o token
-    const gravou = await envios.concluir(conviteId, reserva, 'enviado')
+    const gravou = true
```

```mutacao
arquivo: apps/worker/src/processors/enviar-email.ts
teste: apps/worker/test/enviar-email.int.test.ts › o id do convite da escola B num job
-      const estado = reservado.resultado
+      const estado = 'encerrado'
```

```mutacao
arquivo: packages/core/src/retencao/expurgo-da-escola.repository.ts
teste: apps/worker/test/expurgo-da-escola.int.test.ts › relógio falso: com 23 h
-        where escola_id = ${requireEscolaId()} and envio in ('na_fila', 'enviando')
+        where envio in ('na_fila', 'enviando')
```

```mutacao
arquivo: packages/core/src/retencao/expurgo-da-escola.repository.ts
teste: apps/worker/test/expurgo-da-escola.int.test.ts › relógio falso: com 23 h
-        where escola_id = ${requireEscolaId()} and envio in ('na_fila', 'enviando')
+        where escola_id = ${requireEscolaId()} and envio in ('enviando')
```

```mutacao
arquivo: packages/core/src/retencao/expurgo-da-escola.repository.ts
teste: apps/worker/test/expurgo-da-escola.int.test.ts › relógio falso: com 23 h
-        where escola_id = ${requireEscolaId()} and envio in ('na_fila', 'enviando')
+        where escola_id = ${requireEscolaId()} and envio in ('na_fila')
```

```mutacao
arquivo: packages/core/src/retencao/expurgo-da-escola.repository.ts
teste: apps/worker/test/expurgo-da-escola.int.test.ts › com 48 h, não é tocado
-        where escola_id = ${requireEscolaId()} and envio in ('na_fila', 'enviando')
+        where escola_id = ${requireEscolaId()}
```

```mutacao
arquivo: packages/core/src/retencao/expurgo-da-escola.repository.ts
teste: apps/worker/test/expurgo-da-escola.int.test.ts › relógio falso: com 23 h
-          and criado_em < ${agora.toISOString()}::timestamptz - make_interval(hours => ${HORAS_DO_ENVIO_DE_CONVITE_NA_FILA})
+          and criado_em > ${agora.toISOString()}::timestamptz - make_interval(hours => ${HORAS_DO_ENVIO_DE_CONVITE_NA_FILA})
```

```mutacao
arquivo: packages/core/src/retencao/expurgo-da-escola.repository.ts
teste: apps/worker/test/expurgo-da-escola.int.test.ts › relógio falso: com 23 h
-export const HORAS_DO_ENVIO_DE_CONVITE_NA_FILA = 24
+export const HORAS_DO_ENVIO_DE_CONVITE_NA_FILA = 1
```

```mutacao
arquivo: packages/core/src/retencao/expurgo-da-escola.repository.ts
teste: apps/worker/test/expurgo-da-escola.int.test.ts › relógio falso: com 23 h
-export const HORAS_DO_ENVIO_DE_CONVITE_NA_FILA = 24
+export const HORAS_DO_ENVIO_DE_CONVITE_NA_FILA = 48
```

```mutacao
arquivo: packages/core/src/retencao/expurgo-da-escola.repository.ts
teste: apps/worker/test/expurgo-da-escola.int.test.ts › com outra conexão segurando
           and criado_em < ${agora.toISOString()}::timestamptz - make_interval(hours => ${HORAS_DO_ENVIO_DE_CONVITE_NA_FILA})
         order by criado_em
-        for update skip locked
```

```mutacao
arquivo: packages/core/src/retencao/expurgo-da-escola.repository.ts
teste: apps/worker/test/expurgo-da-escola.int.test.ts › relógio falso: com 23 h
-      set envio = 'falhou', token_cifrado = null, destino_cifrado = null, envio_reservado_em = null
+      set envio = 'falhou', destino_cifrado = null, envio_reservado_em = null
```

```mutacao
arquivo: apps/worker/src/processors/expurgar-escola.ts
teste: apps/worker/test/expurgo-da-escola.int.test.ts › relógio falso: com 23 h
-    const enviosFechadosTotal = await repositorio.fecharEnviosParados(agora)
+    const enviosFechadosTotal = 0
```

```mutacao
arquivo: packages/core/drizzle/0042_envio_de_email.sql
teste: packages/core/src/db/schema/convite-envio.int.test.ts › o canal só é
-ALTER TABLE "convite" ADD CONSTRAINT "convite_canal_valido" CHECK ("convite"."canal" in ('copiado', 'email')) NOT VALID;--> statement-breakpoint
+ALTER TABLE "convite" ADD CONSTRAINT "convite_canal_valido" CHECK ("convite"."canal" in ('copiado', 'email', 'sms')) NOT VALID;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0042_envio_de_email.sql
teste: packages/core/src/db/schema/convite-envio.int.test.ts › o envio só é um dos cinco
-ALTER TABLE "convite" ADD CONSTRAINT "convite_envio_valido" CHECK ("convite"."envio" in ('na_fila', 'enviando', 'enviado', 'falhou', 'cancelado')) NOT VALID;--> statement-breakpoint
+ALTER TABLE "convite" ADD CONSTRAINT "convite_envio_valido" CHECK ("convite"."envio" in ('na_fila', 'enviando', 'enviado', 'falhou', 'cancelado', 'reenviando')) NOT VALID;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0042_envio_de_email.sql
teste: packages/core/src/db/schema/convite-envio.int.test.ts › só o convite de canal `email` tem envio
-ALTER TABLE "convite" ADD CONSTRAINT "convite_envio_so_por_email" CHECK (("convite"."canal" = 'email') = ("convite"."envio" is not null)) NOT VALID;--> statement-breakpoint
+ALTER TABLE "convite" ADD CONSTRAINT "convite_envio_so_por_email" CHECK (("convite"."canal" = 'email') or ("convite"."envio" is not null)) NOT VALID;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0042_envio_de_email.sql
teste: packages/core/src/db/schema/convite-envio.int.test.ts › os dois vêm juntos
-ALTER TABLE "convite" ADD CONSTRAINT "convite_cifrados_so_no_envio_aberto" CHECK (case when "convite"."envio" in ('na_fila', 'enviando') then "convite"."token_cifrado" is not null and "convite"."destino_cifrado" is not null else "convite"."token_cifrado" is null and "convite"."destino_cifrado" is null end) NOT VALID;--> statement-breakpoint
+ALTER TABLE "convite" ADD CONSTRAINT "convite_cifrados_so_no_envio_aberto" CHECK (case when "convite"."envio" in ('na_fila', 'enviando') then "convite"."token_cifrado" is not null or "convite"."destino_cifrado" is not null else "convite"."token_cifrado" is null and "convite"."destino_cifrado" is null end) NOT VALID;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0042_envio_de_email.sql
teste: packages/core/src/db/schema/convite-envio.int.test.ts › o token e o endereço cifrados somem
-ALTER TABLE "convite" ADD CONSTRAINT "convite_cifrados_so_no_envio_aberto" CHECK (case when "convite"."envio" in ('na_fila', 'enviando') then "convite"."token_cifrado" is not null and "convite"."destino_cifrado" is not null else "convite"."token_cifrado" is null and "convite"."destino_cifrado" is null end) NOT VALID;--> statement-breakpoint
+ALTER TABLE "convite" ADD CONSTRAINT "convite_cifrados_so_no_envio_aberto" CHECK (case when "convite"."envio" in ('na_fila', 'enviando') then "convite"."token_cifrado" is not null and "convite"."destino_cifrado" is not null else "convite"."token_cifrado" is null or "convite"."destino_cifrado" is null end) NOT VALID;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0042_envio_de_email.sql
teste: packages/core/src/db/schema/convite-envio.int.test.ts › o token e o endereço cifrados somem
-ALTER TABLE "convite" ADD CONSTRAINT "convite_cifrados_so_no_envio_aberto" CHECK (case when "convite"."envio" in ('na_fila', 'enviando') then "convite"."token_cifrado" is not null and "convite"."destino_cifrado" is not null else "convite"."token_cifrado" is null and "convite"."destino_cifrado" is null end) NOT VALID;--> statement-breakpoint
+ALTER TABLE "convite" ADD CONSTRAINT "convite_cifrados_so_no_envio_aberto" CHECK (case when "convite"."envio" in ('na_fila', 'enviando') then "convite"."token_cifrado" is not null and "convite"."destino_cifrado" is not null else "convite"."token_cifrado" is null and true end) NOT VALID;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0042_envio_de_email.sql
teste: packages/core/src/db/schema/convite-envio.int.test.ts › a marca da reserva só existe
-ALTER TABLE "convite" ADD CONSTRAINT "convite_reserva_so_enviando" CHECK ("convite"."envio_reservado_em" is null or ("convite"."envio" is not null and "convite"."envio" = 'enviando')) NOT VALID;--> statement-breakpoint
+ALTER TABLE "convite" ADD CONSTRAINT "convite_reserva_so_enviando" CHECK ("convite"."envio_reservado_em" is null or "convite"."envio" in ('enviando', 'na_fila')) NOT VALID;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0042_envio_de_email.sql
teste: packages/core/src/db/schema/convite-envio.int.test.ts › a marca da reserva só existe
-ALTER TABLE "convite" ADD CONSTRAINT "convite_reserva_so_enviando" CHECK ("convite"."envio_reservado_em" is null or ("convite"."envio" is not null and "convite"."envio" = 'enviando')) NOT VALID;--> statement-breakpoint
+ALTER TABLE "convite" ADD CONSTRAINT "convite_reserva_so_enviando" CHECK ("convite"."envio_reservado_em" is null or "convite"."envio" = 'enviando') NOT VALID;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0042_envio_de_email.sql
teste: packages/core/src/db/schema/convite-envio.int.test.ts › o índice parcial
-CREATE INDEX "convite_envio_aberto_idx" ON "convite" USING btree ("escola_id","criado_em") WHERE "convite"."envio" in ('na_fila', 'enviando');--> statement-breakpoint
+CREATE INDEX "convite_envio_aberto_idx" ON "convite" USING btree ("escola_id","criado_em") WHERE "convite"."envio" in ('na_fila', 'enviando', 'enviado');--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0042_envio_de_email.sql
teste: packages/core/src/db/schema/convite-envio.int.test.ts › o índice parcial
-CREATE INDEX "convite_envio_aberto_idx" ON "convite" USING btree ("escola_id","criado_em") WHERE "convite"."envio" in ('na_fila', 'enviando');--> statement-breakpoint
+CREATE INDEX "convite_envio_aberto_idx" ON "convite" USING btree ("criado_em","escola_id") WHERE "convite"."envio" in ('na_fila', 'enviando');--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0042_envio_de_email.sql
teste: packages/core/src/db/schema/convite-envio.int.test.ts › o convite gravado como antes
-ALTER TABLE "convite" ADD COLUMN "canal" text DEFAULT 'copiado' NOT NULL;--> statement-breakpoint
+ALTER TABLE "convite" ADD COLUMN "canal" text DEFAULT 'email' NOT NULL;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0042_envio_de_email.sql
teste: packages/core/src/db/schema/convite-envio.int.test.ts › o canal e o `criado_em` não aceitam nulo
-ALTER TABLE "convite" ADD COLUMN "canal" text DEFAULT 'copiado' NOT NULL;--> statement-breakpoint
+ALTER TABLE "convite" ADD COLUMN "canal" text DEFAULT 'copiado';--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0042_envio_de_email.sql
teste: packages/core/src/db/schema/convite-envio.int.test.ts › o convite gravado como antes
-ALTER TABLE "convite" ADD COLUMN "criado_em" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
+ALTER TABLE "convite" ADD COLUMN "criado_em" timestamp with time zone DEFAULT '2000-01-01' NOT NULL;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0042_envio_de_email.sql
teste: packages/core/src/db/schema/convite-envio.int.test.ts › o canal e o `criado_em` não aceitam nulo
-ALTER TABLE "convite" ADD COLUMN "criado_em" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
+ALTER TABLE "convite" ADD COLUMN "criado_em" timestamp with time zone DEFAULT now();--> statement-breakpoint
```

```mutacao
arquivo: packages/core/src/email/email-config.ts
teste: packages/core/src/email/email-config.test.ts › sem EMAIL_PROVEDOR_ID a partida é recusada
-const opcional = <Esquema extends z.ZodType>(esquema: Esquema) => z.preprocess((valor) => (valor === '' ? undefined : valor), esquema)
+const opcional = <Esquema extends z.ZodType>(esquema: Esquema) => z.preprocess((valor) => (valor), esquema)
```

```mutacao
arquivo: packages/core/src/email/email-config.ts
teste: packages/core/src/email/email-config.test.ts › o endereço que não é http
-    EMAIL_URL_DA_WEB: z.url({ protocol: /^https?$/ }),
+    EMAIL_URL_DA_WEB: z.url({ protocol: /^.*$/ }),
```

```mutacao
arquivo: packages/core/src/email/email-config.ts
teste: packages/core/src/email/email-config.test.ts › o adaptador falso é recusado em produção
-    if (valores.AMBIENTE === 'producao' && valores.EMAIL_ADAPTADOR === 'falso') problema('EMAIL_ADAPTADOR', MOTIVO_EMAIL_FALSO_EM_PRODUCAO)
+    if (valores.EMAIL_ADAPTADOR === 'falso') problema('EMAIL_ADAPTADOR', MOTIVO_EMAIL_FALSO_EM_PRODUCAO)
```

```mutacao
arquivo: packages/core/src/email/email-config.ts
teste: packages/core/src/email/email-config.test.ts › o adaptador falso é recusado em produção
-    if (valores.AMBIENTE === 'producao' && valores.EMAIL_ADAPTADOR === 'falso') problema('EMAIL_ADAPTADOR', MOTIVO_EMAIL_FALSO_EM_PRODUCAO)
+    if (valores.AMBIENTE === 'producao') problema('EMAIL_ADAPTADOR', MOTIVO_EMAIL_FALSO_EM_PRODUCAO)
```

```mutacao
arquivo: packages/core/src/email/email-config.ts
teste: packages/core/src/email/email-config.test.ts › só a chave e o endereço da web são obrigatórios
-    if (valores.EMAIL_ADAPTADOR !== 'smtp') return
```

```mutacao
arquivo: packages/core/src/email/email-config.ts
teste: packages/core/src/email/email-config.test.ts › smtp sem EMAIL_SMTP_HOST não sobe
-    if (valores.EMAIL_SMTP_HOST === undefined) {
+    if (valores.EMAIL_SMTP_HOST !== undefined) {
```

```mutacao
arquivo: packages/core/src/email/email-config.ts
teste: packages/core/src/email/email-config.test.ts › o ambiente local dispensa as três
-    if (valores.AMBIENTE === 'local') return
```

```mutacao
arquivo: packages/core/src/email/email-config.ts
teste: packages/core/src/email/email-config.test.ts › sem EMAIL_PROVEDOR_ID a partida é recusada
-    if (valores.EMAIL_PROVEDOR_ID === undefined) problema('EMAIL_PROVEDOR_ID', MOTIVO_EMAIL_SEM_PROVEDOR_ID)
```

```mutacao
arquivo: packages/core/src/email/email-config.ts
teste: packages/core/src/email/email-config.test.ts › sem TLS a partida é recusada
-    if (valores.EMAIL_SMTP_TLS !== 'true') problema('EMAIL_SMTP_TLS', MOTIVO_EMAIL_SEM_TLS)
```

```mutacao
arquivo: packages/core/src/email/email-config.ts
teste: packages/core/src/email/email-config.test.ts › o host do Mailpit
-    if (enderecoDaNossaRede(`smtp://${valores.EMAIL_SMTP_HOST}`)) problema('EMAIL_SMTP_HOST', MOTIVO_EMAIL_NO_MAILPIT)
```

```mutacao
arquivo: packages/core/src/email/email-config.ts
teste: packages/core/src/email/email-config.test.ts › só a chave e o endereço da web são obrigatórios
-    urlDaWeb: valores.EMAIL_URL_DA_WEB.replace(/\/+$/, ''),
+    urlDaWeb: valores.EMAIL_URL_DA_WEB,
```

```mutacao
arquivo: packages/core/src/email/email-config.ts
teste: packages/core/src/email/email-config.test.ts › o adaptador falso é recusado em produção
-    ...(valores.EMAIL_PROVEDOR_ID === undefined ? {} : { provedorId: valores.EMAIL_PROVEDOR_ID }),
+    ...({}),
```

```mutacao
arquivo: packages/core/src/email/email-config.ts
teste: packages/core/src/email/email-config.test.ts › o adaptador falso ignora o servidor SMTP
-  if (valores.EMAIL_ADAPTADOR !== 'smtp' || valores.EMAIL_SMTP_HOST === undefined) return base
+  if (valores.EMAIL_SMTP_HOST === undefined) return base
```

```mutacao
arquivo: packages/core/src/email/email-config.ts
teste: packages/core/src/email/email-config.test.ts › o SMTP do desenvolvimento
-      ...(valores.EMAIL_SMTP_USUARIO === undefined || valores.EMAIL_SMTP_SENHA === undefined ? {} : { usuario: valores.EMAIL_SMTP_USUARIO, senha: valores.EMAIL_SMTP_SENHA }),
+      ...(valores.EMAIL_SMTP_USUARIO === undefined && valores.EMAIL_SMTP_SENHA === undefined ? {} : { usuario: valores.EMAIL_SMTP_USUARIO, senha: valores.EMAIL_SMTP_SENHA }),
```

```mutacao
arquivo: packages/core/src/email/email-config.ts
teste: packages/core/src/email/email-config.test.ts › a chave AES sai do HKDF
-const ROTULO_DA_CHAVE_DO_TOKEN_DE_EMAIL = 'educa.email.token.aes-256-gcm'
+const ROTULO_DA_CHAVE_DO_TOKEN_DE_EMAIL = 'educa.email.token.outro'
```

```mutacao
arquivo: packages/core/src/email/smtp-email-sender.ts
teste: packages/core/src/email/smtp-email-sender.test.ts › com TLS: a porta 465
-    secure: config.tls && config.porta === 465,
+    secure: config.porta === 465,
```

```mutacao
arquivo: packages/core/src/email/smtp-email-sender.ts
teste: packages/core/src/email/smtp-email-sender.test.ts › com TLS: a porta 465
-    secure: config.tls && config.porta === 465,
+    secure: config.tls,
```

```mutacao
arquivo: packages/core/src/email/smtp-email-sender.ts
teste: packages/core/src/email/smtp-email-sender.test.ts › com TLS: a porta 465
-    requireTLS: config.tls,
+    requireTLS: false,
```

```mutacao
arquivo: packages/core/src/email/smtp-email-sender.ts
teste: packages/core/src/email/smtp-email-sender.test.ts › os três prazos do transporte
-    connectionTimeout: PRAZO_DO_ENVIO_SMTP_MS,
+    connectionTimeout: 30_000,
```

```mutacao
arquivo: packages/core/src/email/smtp-email-sender.ts
teste: packages/core/src/email/smtp-email-sender.test.ts › os três prazos do transporte
-    greetingTimeout: PRAZO_DO_ENVIO_SMTP_MS,
+    greetingTimeout: 30_000,
```

```mutacao
arquivo: packages/core/src/email/smtp-email-sender.ts
teste: packages/core/src/email/smtp-email-sender.test.ts › os três prazos do transporte
-    socketTimeout: PRAZO_DO_ENVIO_SMTP_MS,
+    socketTimeout: 30_000,
```

```mutacao
arquivo: packages/core/src/email/smtp-email-sender.ts
teste: packages/core/src/email/smtp-email-sender.test.ts › a credencial vai ao transporte
-    ...(config.usuario === undefined || config.senha === undefined ? {} : { auth: { user: config.usuario, pass: config.senha } }),
+    ...(config.usuario === undefined && config.senha === undefined ? {} : { auth: { user: config.usuario, pass: config.senha } }),
```

```mutacao
arquivo: packages/core/src/email/smtp-email-sender.ts
teste: packages/core/src/email/smtp-email-sender.test.ts › a resposta 5xx recusa de vez
-  const codigo = (erro as { responseCode?: unknown } | null | undefined)?.responseCode
+  const codigo = (erro as { responseCode?: unknown } | null | undefined).responseCode
```

```mutacao
arquivo: packages/core/src/email/smtp-email-sender.ts
teste: packages/core/src/email/smtp-email-sender.test.ts › a resposta 5xx recusa de vez
-  return typeof codigo === 'number' && codigo >= 500 && codigo < 600 ? 'permanente' : 'transitoria'
+  return codigo >= 500 && codigo < 600 ? 'permanente' : 'transitoria'
```

```mutacao
arquivo: packages/core/src/email/smtp-email-sender.ts
teste: packages/core/src/email/smtp-email-sender.test.ts › a resposta 5xx recusa de vez
-  return typeof codigo === 'number' && codigo >= 500 && codigo < 600 ? 'permanente' : 'transitoria'
+  return typeof codigo === 'number' && codigo >= 400 && codigo < 600 ? 'permanente' : 'transitoria'
```

```mutacao
arquivo: packages/core/src/email/smtp-email-sender.ts
teste: packages/core/src/email/smtp-email-sender.test.ts › a resposta 5xx recusa de vez
-  return typeof codigo === 'number' && codigo >= 500 && codigo < 600 ? 'permanente' : 'transitoria'
+  return typeof codigo === 'number' && codigo >= 500 ? 'permanente' : 'transitoria'
```

```mutacao
arquivo: packages/core/src/email/smtp-email-sender.ts
teste: packages/core/src/email/smtp-email-sender.test.ts › o sinal abortado antes ou durante
-    if (sinal?.aborted === true) throw new EmailSendError('transitoria')
```

```mutacao
arquivo: packages/core/src/email/smtp-email-sender.ts
teste: packages/core/src/email/smtp-email-sender.test.ts › o sinal abortado antes ou durante
-      sinal?.addEventListener('abort', aoAbortar, { once: true })
```

```mutacao
arquivo: packages/core/src/email/smtp-email-sender.ts
teste: packages/core/src/email/smtp-email-sender.test.ts › o servidor que não responde em 10 s
-      prazo = setTimeout(() => rejeitar(new EmailSendError('transitoria')), this.prazoMs)
+      prazo = setTimeout(() => rejeitar(new EmailSendError('transitoria')), 60_000)
```

```mutacao
arquivo: packages/core/src/email/smtp-email-sender.ts
teste: packages/core/src/email/smtp-email-sender.test.ts › não deixa o relógio do prazo armado
-      clearTimeout(prazo)
```

```mutacao
arquivo: packages/core/src/email/fake-email-sender.ts
teste: packages/core/src/email/fake-email-sender.test.ts › a falha programada rejeita
-    if (falha !== undefined) throw new EmailSendError(falha)
```

```mutacao
arquivo: packages/core/src/email/fake-email-sender.ts
teste: packages/core/src/email/fake-email-sender.test.ts › a falha programada rejeita
-    const falha = this.#falhas.shift()
+    const falha = this.#falhas.pop()
```

```mutacao
arquivo: packages/core/src/email/fake-email-sender.ts
teste: packages/core/src/email/fake-email-sender.test.ts › guarda o que aceitou, na ordem, e conta as tentativas
-    this.#tentativas += 1
```

```mutacao
arquivo: packages/core/src/email/fake-email-sender.ts
teste: packages/core/src/email/fake-email-sender.test.ts › a barreira prende a próxima chamada antes
-    if (barreira !== undefined) {
+    if (barreira === undefined) {
```

```mutacao
arquivo: packages/core/src/email/fake-email-sender.ts
teste: packages/core/src/email/fake-email-sender.test.ts › a barreira prende a próxima chamada antes
-    this.#barreira = undefined
```

```mutacao
arquivo: packages/core/src/email/fake-email-sender.ts
teste: packages/core/src/email/fake-email-sender.test.ts › o sinal abortado enquanto a chamada está presa
-    if (sinal?.aborted === true) throw new EmailSendError('transitoria')
```

```mutacao
arquivo: packages/core/src/email/mensagem-do-convite.ts
teste: packages/core/src/email/mensagem-do-convite.test.ts › traz a escola e o link com o token depois do #
-  const link = `${urlDaWeb}/convite#${token}`
+  const link = `${urlDaWeb}/convite?token=${token}`
```

```mutacao
arquivo: packages/core/src/email/mensagem-do-convite.ts
teste: packages/core/src/email/mensagem-do-convite.test.ts › traz a escola e o link com o token depois do #
-    assunto: `${escola} convidou você para o Turmma`,
+    assunto: `Turmma convidou você para o Turmma`,
```

```mutacao
arquivo: apps/worker/src/composition.ts
teste: apps/worker/src/composition.test.ts › as peças do e-mail só existem
-  if (email === undefined || banco === undefined) return undefined
+  if (banco === undefined) return undefined
```

```mutacao
arquivo: apps/worker/src/composition.ts
teste: apps/worker/src/composition.test.ts › as peças do e-mail só existem
-  if (email === undefined || banco === undefined) return undefined
+  if (email === undefined) return undefined
```

```mutacao
arquivo: apps/worker/src/composition.ts
teste: apps/worker/src/composition.test.ts › o arquivo do titular, a planilha e o e-mail do convite
-    ...(email === undefined ? {} : { [TIPO_ENVIAR_CONVITE]: criarEnvioDoConvite({ ...email, logger }) }),
+    ...(email !== undefined ? {} : { [TIPO_ENVIAR_CONVITE]: criarEnvioDoConvite({ ...email, logger }) }),
```

```mutacao
arquivo: apps/worker/src/config.ts
teste: apps/worker/src/config.test.ts › quem atende só a interativa ou só o lote sobe sem nenhuma variável
-  const email = atendeEmail ? ler(() => loadEmailConfig(ambiente)) : undefined
+  const email = true ? ler(() => loadEmailConfig(ambiente)) : undefined
```

```mutacao
arquivo: apps/worker/src/config.ts
teste: apps/worker/src/config.test.ts › quem atende a fila normal não sobe sem
-    (atendeEmail && email === undefined) ||
```

```mutacao
arquivo: apps/worker/src/config.ts
teste: apps/worker/src/config.test.ts › quem atende só a interativa ou só o lote sobe sem nenhuma variável
-    ...(email === undefined ? {} : { email }),
+    ...({ email }),
```

```mutacao
arquivo: packages/core/src/email/criar-email-sender.ts
teste: packages/core/src/email/criar-email-sender.test.ts › o adaptador `falso` com um servidor
-  return config.adaptador === 'smtp' && config.smtp !== undefined ? SmtpEmailSender.criar(config.smtp) : new FakeEmailSender()
+  return config.smtp !== undefined ? SmtpEmailSender.criar(config.smtp) : new FakeEmailSender()
```

```mutacao
arquivo: packages/core/src/cripto/secret-cipher.ts
teste: packages/core/src/cripto/secret-cipher.test.ts › não nasce sem a chave da versão atual
-    if (!chaves.has(versaoAtual)) throw new InvariantException('chave de cifra da versão atual ausente')
```

```mutacao
arquivo: packages/shared/src/privacidade/classificacao.ts
teste: packages/shared/src/privacidade/classificacao.test.ts › o token e o endereço cifrados
-  'convite.token_cifrado',
```

```mutacao
arquivo: packages/shared/src/privacidade/classificacao.ts
teste: packages/shared/src/privacidade/classificacao.test.ts › o token e o endereço cifrados
-  'convite.destino_cifrado',
```

```mutacao
arquivo: packages/core/src/email/smtp-email-sender.ts
teste: packages/core/src/email/smtp-email-sender.test.ts › não deixa o ouvinte
-      if (aoAbortar !== undefined) sinal?.removeEventListener('abort', aoAbortar)
```

```mutacao
arquivo: packages/core/src/email/smtp-email-sender.ts
teste: packages/core/src/email/smtp-email-sender.test.ts › não deixa o ouvinte
-      if (aoAbortar !== undefined) sinal?.removeEventListener('abort', aoAbortar)
+      if (aoAbortar === undefined) sinal?.removeEventListener('abort', aoAbortar)
```

```mutacao
arquivo: packages/core/src/email/envio.repository.ts
teste: apps/worker/test/enviar-email.int.test.ts › oito reservas do mesmo convite
-          and (envio = 'na_fila' or (envio = 'enviando' and envio_reservado_em <= now() - make_interval(mins => ${MINUTOS_DA_RESERVA_DO_ENVIO})))
+          and envio in ('na_fila', 'enviando')
```

```mutacao
arquivo: apps/api/src/sessao/convite/convite-ticket.ts
teste: apps/api/src/sessao/convite/convite-ticket.test.ts › borda: o relógio que recua depois de emitir
falha: aos(-TICKET_CLOCK_TOLERANCE_SECONDS - 1)
-      if (idade > TICKET_TTL_SECONDS || idade < -TICKET_CLOCK_TOLERANCE_SECONDS) return undefined
+      if (idade > TICKET_TTL_SECONDS) return undefined
```

```mutacao
arquivo: apps/api/src/sessao/convite/convite-ticket.ts
teste: apps/api/src/sessao/convite/convite-ticket.test.ts › borda: bilhete assinado com a nossa chave e um
falha: aos(TICKET_TTL_SECONDS + 1).verificar(longo)
-      if (idade > TICKET_TTL_SECONDS || idade < -TICKET_CLOCK_TOLERANCE_SECONDS) return undefined
+      if (idade < -TICKET_CLOCK_TOLERANCE_SECONDS) return undefined
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian 1ª | Conferir se `tools/guardas/repositories-com-escopo.test.ts` enxerga o `EnvioRepository` na pasta nova `email/` | Recusada: a guarda já varre `packages/core` (o teste dela espera `packages/core/src/queue/job-outbox.repository.ts`, linhas 65-66) |
| tenancy-guardian 1ª | Caso de isolamento que rode pelo `JobExecutor` com o registro da A | Recusada: o próprio revisor diz que o `job-execution.int.test.ts` geral cobre a escola vinda do `job_registro` |
| conformidade-reviewer 1ª | Reauditar a regra 70 quando a 3.0 ligar a rota "Enviar" (D64: nada de contagem nominal de convites aceitos) | Tarefa 3.0: a Mesa leva ao prompt do `conformidade-reviewer` na rodada dela |
| infra-guardian 1ª | O corte de 10 s não para o `sendMail`; fechar o transporte ou alinhar o prazo total aos três de 10 s | `TODO.md`: o envio repetido cabe no "ao menos uma vez" da D49; a parte do ouvinte está no item 2 |
| infra-guardian 1ª | A reserva de outro worker gasta as tentativas do job; a saída de adiar com caso do worker que morre no meio do envio | Tarefa 2.0 (2.2, a saída de adiar) |
| infra-guardian 1ª | Métrica de e-mail por resultado e alerta de `falhou` acima de 20% em 1 h | Tarefa 2.0 (2.3) |
| privacy-guardian 1ª, revisor-geral 1ª | Estender `NOME_DE_SEGREDO` (`apps/api/test/architecture.test.ts:1180`) para casar `cifrad` | Tarefa 5.0, que cria o `link_da_conta` com os mesmos cifrados (sugestão do `privacy-guardian`) |
| privacy-guardian 1ª | `EMAIL_URL_DA_WEB` exigir `https` fora de `local` | `TODO.md`: muda a validação da configuração (comportamento), fora do que cabe numa recomendação barata |
| privacy-guardian 1ª, revisor-geral 1ª | Dado autenticado por campo (`<conviteId>:token` e `<conviteId>:destino`) em vez do `conviteId` para os dois | Tarefa 3.0, que cifra pela primeira vez; muda o contrato entre quem cifra e o `enviar-email.ts:52-55`, com as fixtures de teste |
| privacy-guardian 1ª, revisor-geral 1ª | O texto da mensagem diz "como professor" mesmo se sair convite de coordenador | `TODO.md`: hoje só a rota de professores (3.0) enfileira; muda o texto do e-mail |
| privacy-guardian 1ª | `EMAIL_TOKEN_KEY` de desenvolvimento sobe em produção sem reclamação | `TODO.md`, no item que já existe: "Valores que o staging e a produção não herdam do `.env.example`" |
| revisor-geral 1ª | Variáveis novas obrigatórias em produção (`infra/compose.yml:397-403`): uma linha no runbook ou no deploy | Tarefa 2.0, que já altera `docs/runbook.md` |
| revisor-geral 1ª | O fallback de `criar-email-sender.ts:8` devolve o falso sem avisar quando `smtp` falta | `TODO.md`: a configuração impede o caso hoje, e lançar `InvariantException` pede teste e bloco de "Mutações" próprios |
| test-engineer 1ª | O expurgo fecha `falhou` também o `enviando` com reserva vigente; limitar à reserva vencida | Recusada: a Tech Spec manda ("mais de 24 h: o expurgo grava `falhou`" para `na_fila` e `enviando`, `techspec.md:79`); a duplicata cabe na D49 |
| test-engineer 1ª | Pedir o aceite dentro do caso da revogação com o job na barreira | Recusada: o aceite recusado já é provado em `apps/api/test/ciclo-de-vida.int.test.ts`, que o revisor cita |
| test-engineer 1ª | `ciclo-de-vida.int.test.ts:1278` falhou uma vez rodando três arquivos juntos | Retro da funcionalidade; o caso não é desta tarefa |
| revisor-geral (2ª), infra-guardian (2ª), test-engineer (2ª) | "`challenge.ts` e `operador-challenge.ts`: os dois usam o mesmo `maxTokenAge` sem folga. O documento menciona isso como "ressalva do relatório", mas não está no `TODO.md`. Precisa ir para lá, ou para uma tarefa, para não se perder." (revisor-geral); "Registre no `TODO.md` antes de ter mais de um host." (infra-guardian); "Merece entrada no `TODO.md`, ou na tabela de recomendações com um destino, para não se perder." (test-engineer) | `TODO.md` (uma linha, dono: Arquiteto): `grep` por `challenge.ts` e `maxTokenAge` no `TODO.md` não acha nada hoje; o Implementador escreve a linha antes do commit. Muda login com segundo fator (outro caminho quente), fora desta tarefa |
| privacy-guardian (2ª), infra-guardian (2ª), test-engineer (2ª) | "A ativação por convite compara duas horas do relógio do banco (`convite.usado_em >= usuario.desativado_em`, em `convite.repository.ts:77` e `ciclo-de-vida.repository.ts:247`). Se o relógio recuar entre o aceite e uma desativação feita logo em seguida, `desativado_em` pode ficar antes de `usado_em`. Aí o bilhete ainda válido (até 30 min) reativaria a pessoa desativada. A janela é de cerca de 1,7 s e só existe com relógio desregulado, então não bloqueia. Mas vale uma linha no runbook exigindo NTP disciplinado na VPS de produção. Melhor ainda seria uma checagem que não dependa do relógio, como um contador de desativações no usuário." (privacy-guardian); "Se o relógio do banco recuar entre convidar e aceitar, o login não ativa ninguém." (infra-guardian); "em produção, um ajuste de NTP para trás faria o aceite não ativar ninguém, em silêncio. Registrar para a retro ou o `TODO.md`, com uma alternativa que não dependa do relógio" (test-engineer) | `TODO.md` (uma linha, dono: Arquiteto, na retro da spec): o privacy-guardian diz que não bloqueia, e a mudança é de comportamento do produto (regra 20, item 18), com teste e bloco de mutação próprios. A linha cita a hipótese de reativação do privacy-guardian e a de "não ativa ninguém" dos outros dois, e a linha de NTP para o runbook |
| infra-guardian (2ª), test-engineer (2ª) | "Borda do convite vencido. O caso passou de 72 h + 1 s para 72 h + 10 s, e a borda ficou menos fina. Um caso unitário com relógio injetado no `expira_em` cobriria o segundo exato sem depender da máquina." / "Vale provar a borda exata sem depender do relógio de parede, gravando o `expira_em` em relação ao `now()` do próprio banco (por exemplo `now() - interval '1 second'`)." | Na mesma linha do relógio no `TODO.md`: é teste novo sobre a regra do convite vencido, que pede decidir como injetar o relógio; fica para quem tratar o item acima |
| tenancy-guardian (2ª), revisor-geral (2ª), privacy-guardian (2ª) | "`apps/api/test/ciclo-de-vida.int.test.ts:524` ainda usa `desativado_em = now()` direto. É anterior a esta tarefa, mas tem a mesma exposição ao relógio que recua" (tenancy-guardian); "`xmin::text::bigint` ... Vale uma linha de comentário dizendo que não serve para ordenar em produção" (revisor-geral, privacy-guardian); "os ajudantes valem só para usuário recém-convidado. Vale uma linha avisando que usar `anteciparODesativado` depois de uma desativação real esconderia o caso "convite antigo não reativa"" (tenancy-guardian) | Na mesma linha do relógio no `TODO.md`: os três pedem só comentário ou o mesmo ajuste em teste que já existia, e cada um custaria um carimbo novo e uma rodada do `revisor-geral` por um texto; o `TODO.md` guarda o aviso do `xmin` e do `anteciparODesativado` |
| tenancy-guardian (2ª) | "`verificado.payload.iat ?? 0` nunca usa o `0`, porque `requiredClaims` já exige `iat`. ... trocar o `?? 0` por uma checagem explícita deixa a intenção mais clara." | Recusada: o próprio revisor diz que o caso é seguro como está (`iat = 0` daria idade enorme e o bilhete seria recusado); mexer em `convite-ticket.ts` é código de produção e pede bloco de mutação novo (RF17) e rodada de todos |
| revisor-geral (2ª) | "`cenarios.md`: a folga de 30 s do bilhete é comportamento novo e testado, mas não aparece nesse documento. Vale um [U] na seção do RF12/convite, para o Validador encontrar." | Recusada por ora: a folga é endurecimento do bilhete, não requisito do PRD; já está na `techspec.md` §2 e na tabela "Divergências resolvidas", e o teste unitário a prova. Se o Validador não a achar, vira ressalva dele |
| revisor-geral (2ª) | "`10_task.md`, seção "Como testar": cita `convite-ticket.test.ts:33`, mas o caso "permissão: …" está agora na linha 61. Basta citar pelo nome do caso, sem o número da linha." | Tarefa 10.0 (é o documento dela, e ela mesma lê o `convite-ticket.test.ts`) |
| test-engineer (2ª) | "Tabela "Testes que provam a regra" do `1_task.md`. Os três casos novos aparecem só nos blocos de mutação, não na tabela: a linha 63 (`[P] duas execuções`) deve citar `› [P] oito reservas do mesmo convite ao mesmo tempo …`; a linha 70 deve citar `› … não deixa o ouvinte de abort …`; falta uma linha para `classificacao.test.ts`, os cifrados fora do arquivo do titular." | Texto desta tabela do documento: o Implementador completa antes do commit (não toca nos blocos de mutação nem em código; se o carimbo deixar de valer por causa dela, ele roda o portão da tarefa de novo) |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-07 15:08:44 | 2026-11-07 15:09:28 | `tenancy-guardian` | 1 | APROVADO | ae285dab417acb742 |
| 2026-11-07 15:09:08 | 2026-11-07 15:09:30 | `conformidade-reviewer` | 1 | APROVADO | aa9c794493e6f0195 |
| 2026-11-07 15:08:54 | 2026-11-07 15:10:40 | `infra-guardian` | 1 | APROVADO | a4926396679f31d89 |
| 2026-11-07 15:08:49 | 2026-11-07 15:11:15 | `privacy-guardian` | 1 | APROVADO | a9fe4e8a18bfc350c |
| 2026-11-07 15:09:03 | 2026-11-07 15:11:30 | `revisor-geral` | 1 | REPROVADO | ad1537ee7887a0b05 |
| 2026-11-07 15:08:58 | 2026-11-07 15:12:21 | `test-engineer` | 1 | APROVADO | afaafa4d69a04d746 |
| 2026-11-07 19:44:00 | 2026-11-07 19:44:36 | `tenancy-guardian` | 2 | APROVADO | ae4707269d2378366 |
| 2026-11-07 19:44:25 | 2026-11-07 19:44:48 | `conformidade-reviewer` | 2 | APROVADO | aa3d815538f4359e8 |
| 2026-11-07 19:43:37 | 2026-11-07 19:45:11 | `revisor-geral` | 2 | APROVADO | a8e9f5bfb5bb55758 |
| 2026-11-07 19:44:13 | 2026-11-07 19:45:15 | `privacy-guardian` | 2 | APROVADO | af819ad2ee71a0392 |
| 2026-11-07 19:44:35 | 2026-11-07 19:45:24 | `infra-guardian` | 2 | APROVADO | a91f5f480f9bd5bab |
| 2026-11-07 19:43:50 | 2026-11-07 19:45:51 | `test-engineer` | 2 | APROVADO | a0a1df1db85f70fc8 |
