# Achados das revisões — `tasks/prd-acesso-e-convites/1_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-07 15:09:28 · `tasks/prd-acesso-e-convites/1_task.md`

VEREDITO: APROVADO

**Tabelas verificadas:** não há tabela nova. O `convite` só ganhou colunas (migration `0042_envio_de_email.sql` e `packages/core/src/db/schema/convite.ts`) e já tinha `escola_id`. Ele não varia por ano letivo, então não precisa de `anoLetivoId`. O id continua UUID. O índice novo `convite_envio_aberto_idx` começa por `escola_id`.

**Queries verificadas:**
- `EnvioRepository.reservar`: o `update ... returning` filtra por `escola_id`. A releitura que acontece quando a reserva não vem também filtra pela escola. O `join escola` usa o `escola_id` da linha reservada.
- `EnvioRepository.concluir` e `EnvioRepository.devolver`: filtram por escola, por id e pela marca da reserva.
- As três revogações, `ConviteRepository.revogar`, `ConviteRepository.revogarParaRefazer` e `CicloDeVidaRepository.revogarConviteAberto`: o `where` com escola é o que já existia. O diff só acrescenta o `CANCELAR_O_ENVIO_DO_CONVITE` no `set`.
- `ExpurgoDaEscolaRepository.fecharEnviosParados`: a seleção com `skip locked` filtra pela escola.

Em todas, a escola vem de `requireEscolaId()`, que lê o contexto do job ou da sessão. O payload do `email.enviar-convite` é `z.strictObject({ conviteId: z.uuid() })`, então um `escolaId` no payload é recusado. Não há endpoint novo. Não há `@Unscoped` novo. Nada toca a camada de rede.

**Teste de isolamento:** presente e efetivo. Conferi tirando a cláusula da escola de cada consulta:
- Sem a escola no `reservar`, o caso `isolamento entre escolas › o id do convite da escola B num job da escola A` envia o e-mail da B e a linha dela muda. O teste quebra.
- Sem a escola no `concluir` ou no `devolver`, o caso `o desfecho de uma escola não alcança o convite de outra` recebe `true` com a mesma marca de reserva. O teste quebra.
- Sem a escola no expurgo, o caso `relógio falso: …` fecha `falhou` a linha da B com 25 h, e a asserção da linha 785 quebra.
- A resposta para o id da outra escola é `inexistente`, a mesma do id que não existe. O caso com reserva vigente na B confirma que o job não repete esperando por ela.

**Bloqueantes:** nenhum.

**Recomendações:**
- `packages/core/src/email/envio.repository.ts:40` e `packages/core/src/retencao/expurgo-da-escola.repository.ts:487` usam SQL cru com o escopo escrito à mão. Vale conferir se `tools/guardas/repositories-com-escopo.test.ts` enxerga o `EnvioRepository` na pasta nova `email/`. Se não enxergar, o teste passa a ser a única proteção até a cerca prevista para a tarefa 5.0.
- No teste de isolamento do processor, a linha da B já é semeada com `envio` e cifrados válidos. Um caso que use o `rodar` pelo `JobExecutor` com o registro da A reforçaria que a escola vem do `job_registro`. Hoje isso está coberto só pelo `job-execution.int.test.ts` geral.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/email/envio.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/retencao/expurgo-da-escola.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/worker/test/enviar-email.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/worker/test/expurgo-da-escola.int.test.ts

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-07 15:09:30 · `tasks/prd-acesso-e-convites/1_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. Nenhum arquivo alterado ou novo escreve em `nota` ou em tabela de correção. O job novo (`email.enviar-convite`), o expurgo de 24 h e as três revogações só escrevem em `convite`. Todos com autor humano? Não se aplica, porque não há escrita em `Nota`.

Decisão autônoma sobre aluno: ausente. O job só reserva, envia e encerra o envio de um convite de professor. Não decide aprovação, reprovação ou encaminhamento de aluno.

Aprovação registrada: ok. A tarefa não tem saída de IA. O texto do e-mail é um modelo fixo, sem modelo de linguagem: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/email/mensagem-do-convite.ts`. Nenhum agente ganhou a exceção da D47.

Supervisão do tutor: ok. O tutor não é tocado. A mudança em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/config/llm-config.ts` só exporta `enderecoDaNossaRede`, que a configuração de e-mail reaproveita. Não muda nada no caminho do modelo.

Autonomia declarada e visível: sim, sem alteração. Nenhum agente foi criado e nenhum nível mudou.

Os demais pontos da regra 70 também ficam fora do alcance desta tarefa:
- **Auditoria (item 6):** não há saída de IA para registrar.
- **Supervisão sem vigilância (item 7):** nenhum dado de comportamento, emoção ou navegação é medido.
- **Discursiva e redação (D55 e D46):** nenhum campo, tela ou prompt de nota.
- **Professor (D45 e D64):** nenhuma métrica, ranking ou indicador. O e-mail não leva nome de pessoa nem dado de uso.

Bloqueantes: nenhum.

Recomendações:
- Quando a tarefa 3.0 ligar a rota "Enviar", vale reauditar a regra 70 se a tela de convites mostrar qualquer coisa além do estado do envio. Exemplos: contagem de convites aceitos por professor, ou "professor que não ativou" virando indicador nominal (D64).

## infra-guardian · 1ª rodada · APROVADO · 2026-11-07 15:10:40 · `tasks/prd-acesso-e-convites/1_task.md`

```
VEREDITO: APROVADO
Caminho quente tocado: fila | migration
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: compatível
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
1. O corte de 10 s não para o envio de verdade.
   Arquivo: /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/email/smtp-email-sender.ts:66
   O `Promise.race` desiste da espera em 10 s, mas o `sendMail` do nodemailer continua rodando. Os três prazos do transporte são de 10 s cada, então a conversa SMTP inteira pode passar disso. Se o envio terminar depois do corte, a linha já voltou a `na_fila` e a nova tentativa manda um segundo e-mail. Isso cabe no "ao menos uma vez" da D49, mas vale fechar o transporte ou alinhar o prazo total com os prazos dele.
   Na linha 63, o ouvinte de `abort` só sai quando dispara. Vale tirá-lo no `finally`.
2. A reserva de outro worker gasta as tentativas do job.
   Arquivo: /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/worker/src/processors/enviar-email.ts:71-74
   Quando outro worker segura a reserva, o job lança `ERRO_INTERNO` e perde uma tentativa. São 5 tentativas com recuo de 2 s, uns 30 s no total, contra 2 min de reserva. Se o worker morrer no meio do envio, o job desiste antes de a reserva vencer, e a linha fica `enviando` com os dados cifrados até o expurgo, de 24 a 48 h depois.
   Hoje isso não acontece em produção, porque nenhuma rota põe o convite na fila antes da 3.0. A tarefa 2.0 precisa entregar a saída de adiar, que não gasta tentativa, com um caso de teste para o worker que morre no meio do envio.
3. O comentário da migration promete o que a transação não entrega.
   Arquivo: /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/drizzle/0042_envio_de_email.sql:3-4
   O comentário diz que o `NOT VALID` seguido do `VALIDATE` evita que a trava espere a varredura. Só que o migrador do Drizzle roda tudo numa transação, e a trava exclusiva tomada no `ADD COLUMN` dura até o commit. Na `convite`, que é pequena e só conta convites, isso não pesa. Vale corrigir o texto para ninguém copiar o padrão confiando nisso numa tabela grande.
4. As métricas e o alerta do e-mail ficaram para a 2.0.
   Esta tarefa só conta com as métricas genéricas de fila (`job.espera_mais_antiga_s`, `job.pendentes`, `job.falhos` por tipo). A métrica de e-mail por resultado e o alerta de `falhou` acima de 20% em 1 h, com o parágrafo do runbook, estão na subtarefa 2.3. Precisam ser cobrados lá.
```

Rodei os testes de unidade do e-mail, da configuração e da composição do worker e da definição dos jobs: 112 passaram. Os de integração, inclusive os dois casos de concorrência `[P]` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/worker/test/enviar-email.int.test.ts`, eu não rodei porque precisam do ambiente Docker. Li esses dois casos e eles usam a barreira do falso, como a tarefa pede.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-07 15:11:15 · `tasks/prd-acesso-e-convites/1_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: `convite.destino_cifrado`, o e-mail de quem recebe, cifrado com AES-256-GCM e o id do convite como dado autenticado. `convite.token_cifrado` é um segredo, não dado pessoal. Os metadados do envio são `canal`, `envio`, `envio_reservado_em`, `enviado_em` e `criado_em`. Os titulares são só professor e coordenador: `TIPOS_DE_CONVITE` é `coordenador | professor`, então nenhum dado de aluno entra. A mensagem (`packages/core/src/email/mensagem-do-convite.ts:19-33`) leva o nome da escola e o link, com o token depois do `#`, e nenhum nome de pessoa.

Fora da tabela de dados do docs/lgpd.md: nada. As linhas 77 (envio do convite, cifrados, as 24 h contadas do `criadoEm`) e 78 (e-mail e texto que vão ao provedor de e-mail, nunca dado de aluno) já cobrem esses campos, com finalidade e retenção.

Autorização por objeto: ok.
- `EnvioRepository.reservar`, `concluir` e `devolver` (`packages/core/src/email/envio.repository.ts:44,58,78,88`) tiram a escola do contexto do job, nunca do payload. O payload é `z.strictObject({ conviteId: z.uuid() })`.
- O id de um convite da escola B num job da A responde `inexistente`, igual a um id que não existe. Há teste para isso.
- No `desativar`, o professor pendente recebe `NAO_ENCONTRADO`, igual ao inexistente, e o teste confere que o envio fica intacto.
- Todo `select` em `convite` usa colunas explícitas. Nenhum caminho devolve os cifrados numa resposta.

Logs: limpos.
- `apps/worker/src/processors/enviar-email.ts:62,72,77,89,93,97` registram só `conviteId`, a tentativa, o tipo e o estado.
- `SmtpEmailSender` liga o transporte sem `logger` e sem `debug` (`smtp-email-sender.ts:56-67`). A falha sobe como `EmailSendError` com mensagem fixa, sem a resposta do servidor (`:100-102`).
- O expurgo loga só a contagem `enviosFechadosTotal`.
- O caso "o que o log guarda" prova que nenhuma linha traz o token, o endereço, o nome da escola nem o nome da pessoa.

Auditoria: presente onde a regra exige. Esta tarefa não tem leitura de dado de aluno, exportação, nota, permissão nem saída de IA. O `convite.enviado` é gravado no pedido de envio, que é da tarefa 3.0 pela Tech Spec §5, fora deste escopo.

Envio externo: o endereço do professor ou coordenador, o nome da escola e o link com o token vão por SMTP ao provedor de e-mail. Não é IA, então `ExecucaoAgente` não se aplica. Fora de `AMBIENTE=local`, o worker não sobe sem três coisas:
- `EMAIL_PROVEDOR_ID`, a chave do suboperador;
- `EMAIL_SMTP_TLS=true`;
- um host fora da nossa rede, o que recusa o Mailpit.

O adaptador falso é proibido em produção (`email-config.ts:52-61`). O registro do provedor como suboperador antes da primeira escola real está escrito em `docs/lgpd.md:78`.

Ciclo de vida: ok.
- Os cifrados existem só em `na_fila` e `enviando`. Um check no banco garante isso nos dois sentidos (`0042_envio_de_email.sql`, `convite_cifrados_so_no_envio_aberto`).
- As três revogações (revogar, refazer e a defesa do `desativar`) anulam os cifrados na hora, pelo `CANCELAR_O_ENVIO_DO_CONVITE`.
- O expurgo de 24 h usa `skip locked` e o escopo da escola (`expurgo-da-escola.repository.ts:487-500`).
- A eliminação do titular apaga o convite junto, como já fazia.
- O prazo de 24 h é fixo e não se ajusta por escola. A divergência está justificada, e o prazo é bem mais curto que qualquer retenção.

Seed/fixture: sintético. Os endereços dos testes são `@convite.invalid`, `@educa.invalid`, `@escola.invalid` e `@expurgo.invalid`, com nomes como "Escola sintética da fila" e "Professora sintética do envio". O Mailpit publica só em `127.0.0.1` e a porta SMTP fica na rede do compose.

Pergunta de fechamento: esta tarefa não acrescenta nada ao que o sistema guarda ou envia sobre um aluno, porque o e-mail só alcança equipe da escola. Para o professor, o estado e a data do envio ficam na linha do convite. O destino aparece pelo registro de suboperador, que a linha 78 do `docs/lgpd.md` exige antes do portão.

Bloqueantes: nenhum.

Recomendações:
1. **Os cifrados fora do arquivo do titular.** A `techspec.md` §7 diz "cifrados e `contaExterna` em `COLUNAS_FORA_DO_ARQUIVO`", mas `convite.token_cifrado` e `convite.destino_cifrado` não estão lá (`packages/shared/src/privacidade/classificacao.ts:149`). O regex `NOME_DE_SEGREDO` (`apps/api/test/architecture.test.ts:1180`) também não pega o sufixo `cifrado`. Hoje nada vaza, porque o `convite` está classificado `entra: false`. Mas nenhuma tarefa da spec assumiu esse item. Sugestão: pôr as duas colunas na lista e `cifrado` no regex já na 5.0, que cria o `link_da_conta` com os mesmos cifrados.
2. **`EMAIL_URL_DA_WEB` aceita `http` em qualquer ambiente** (`email-config.ts:48`). Fora de `local`, exigir `https`: uma página servida em http pode ser interceptada e o fragmento com o token, lido.
3. **O dado autenticado é o mesmo para o token e para o endereço** (`enviar-email.ts:54`, o `conviteId`). Quem tem escrita no banco pode trocar um cifrado pelo outro na mesma linha e ainda decifrar. Não vaza nada, mas um dado autenticado por campo (`<conviteId>:token` e `<conviteId>:destino`) fecha isso.
4. **O texto da mensagem diz "como professor"** (`mensagem-do-convite.ts:25`) mesmo se um dia sair convite de coordenador por e-mail. Tirar o papel do texto, ou montá-lo pelo `tipo`.
5. **`EMAIL_TOKEN_KEY` de desenvolvimento** (`.env.example:247`) sobe em produção sem reclamação, como as outras chaves sintéticas do projeto. Entra no mesmo item do `TODO.md` sobre o que o staging e a produção não herdam do `.env.example`.

Arquivos centrais auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/drizzle/0042_envio_de_email.sql
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/email/envio.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/email/email-config.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/email/smtp-email-sender.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/email/mensagem-do-convite.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/convite/cancelar-envio.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/worker/src/processors/enviar-email.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/retencao/expurgo-da-escola.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/infra/compose.yml

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-07 15:11:30 · `tasks/prd-acesso-e-convites/1_task.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: divergência em §7 ("Retenção e eliminação": cifrados em `COLUNAS_FORA_DO_ARQUIVO`)
Portão local: carimbo válido

**Bloqueantes:**

1. **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/shared/src/privacidade/classificacao.ts:149`.** A tarefa ignorou um item da Tech Spec que já estava lá antes dela.
   - **O que está errado:** a `techspec.md` §7, na linha "Retenção e eliminação", diz "cifrados e `contaExterna` em `COLUNAS_FORA_DO_ARQUIVO`". Esta tarefa criou `convite.token_cifrado` e `convite.destino_cifrado` (migration `0042`) e não os pôs na lista. Nenhuma tarefa seguinte cobre isso: a 14.4 trata só da `contaExterna`, e a 5.0 trata do `link_da_conta`. Também não há registro na tabela "Divergências resolvidas".
   - **Por que a guarda não pegou:** a guarda de `apps/api/test/architecture.test.ts:1180` (`NOME_DE_SEGREDO`) não reconhece `_cifrado` sem `segredo` no nome, então a falta passou calada. Hoje o `convite` não entra no arquivo do titular, então nada vaza. Mas a regra da spec fica sem dono e quebra no dia em que a tabela entrar no arquivo.
   - **Correção exigida:** acrescentar `'convite.token_cifrado'` e `'convite.destino_cifrado'` a `COLUNAS_FORA_DO_ARQUIVO`.

**Recomendações:**

- **AAD igual para os dois cifrados** (`apps/worker/src/processors/enviar-email.ts:52-55`, e quem cifra na 3.0): o token e o endereço usam o mesmo dado autenticado, só o id do convite. Trocar uma coluna pela outra na mesma linha ainda decifra. Vale separar por campo (`${conviteId}:token` / `${conviteId}:destino`) agora, antes de a 3.0 gravar a primeira linha.
- **Guarda que pega cifrado:** estender `NOME_DE_SEGREDO` em `apps/api/test/architecture.test.ts:1180` para casar `cifrad`. Assim o `link_da_conta` da 5.0 também cai na guarda.
- **Variáveis novas obrigatórias em produção** (`infra/compose.yml:397-403`): elas usam `:?`, e fora do ambiente local o worker exige `EMAIL_PROVEDOR_ID` e TLS.
  - Sem o `.env` de produção atualizado, `docker compose up` aborta o projeto inteiro.
  - Com as variáveis, mas sem o provedor, o worker `interativa,normal` recusa a partida, e com ele cai a fila interativa.
  - O portão já prevê o provedor antes do pouso (`tasks.md:170`). Falta uma linha no runbook ou no procedimento de deploy listando as variáveis novas. Isso é com o `infra-guardian`.
- **Fallback que esconde erro de configuração** (`packages/core/src/email/criar-email-sender.ts:8`): com `adaptador === 'smtp'` e `smtp` ausente, ele devolve o falso sem avisar. A configuração impede esse caso hoje, mas lançar `InvariantException` deixaria o erro visível se ela mudar.
- **Texto fixo "como professor"** (`packages/core/src/email/mensagem-do-convite.ts:22`): o `reservar` não filtra por `tipo`. Se um dia o convite de coordenador sair por e-mail, o texto fica errado. Hoje só a rota de professores (3.0) enfileira.

## test-engineer · 1ª rodada · APROVADO · 2026-11-07 15:12:21 · `tasks/prd-acesso-e-convites/1_task.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- **Caminho feliz:** a mensagem leva a escola e o link com o token depois do `#`, e o convite termina `enviado` sem os cifrados.
- **Bordas:** revogação, refazer e defesa do `desativar` entre a fila e o envio; envio já terminado ou `copiado` que a revogação não toca; 5xx; 4xx; sempre 4xx; queda sem natureza; 4xx com revogação entre as tentativas; reserva morta (3 min) e reserva vigente (1 min); token adulterado ou copiado de outro convite; erro que não é de decifração; expurgo com 23 h e com 25 h; `enviado` e `cancelado` com 48 h.
- **Concorrência:** duas execuções com a primeira presa na barreira; revogação com o job preso na barreira; `concluir` e `devolver` com a marca de uma reserva já retomada; desfecho de quem perdeu a reserva; expurgo contra linha travada (`skip locked`).
- **Permissão:** professor pendente com envio `na_fila` recebe `NAO_ENCONTRADO`, igual ao id inexistente, e o envio fica intacto.
- **Isolamento:** convite da B num job da A, também com a reserva vigente; desfecho com o id da B no contexto da A; payload adulterado; expurgo com a linha da B na mesma idade.
- **Banco:** os cinco checks, o `not null`, o índice parcial e o convite gravado como antes entrando `copiado`.
- **Configuração:** falso proibido em produção; fora do local, `EMAIL_PROVEDOR_ID`, TLS e host fora da nossa rede; a réplica `normal` não sobe sem as variáveis de e-mail, e as outras réplicas não leem essas variáveis.
- **Log:** sem token, sem endereço, sem nome da escola ou da pessoa e sem a resposta do SMTP.

**Cobertos:** todas as linhas da tabela "Testes que provam a regra" têm o teste citado pelo nome e existente.
- Conferi item por item, inclusive os que dividem a mesma linha com ponto e vírgula: o refazer, a defesa, os três estados de cifrado nulo e as três exigências de configuração.
- Rodei e ficaram verdes:
  - `apps/worker/test/enviar-email.int.test.ts` (24 casos)
  - `packages/core/src/db/schema/convite-envio.int.test.ts`
  - o bloco novo de `apps/worker/test/expurgo-da-escola.int.test.ts`
  - os dois casos novos de `apps/api/test/ciclo-de-vida.int.test.ts`
  - a unidade de `packages/core/src/email/`, `packages/core/src/cripto/`, `apps/worker/src/config.test.ts`, `apps/worker/src/composition.test.ts` e `packages/shared/src/system/job-definitions.test.ts` (118 casos)
- As asserções olham o resultado: a linha do banco (`envio`, cifrados, `enviado_em`, marca, `revogado_em`), as mensagens que o falso aceitou e o log capturado.
- Não há `.skip`, `.only` nem teste comentado.
- Nenhum provedor real é chamado: o teste usa o `FakeEmailSender` ou um emissor escrito no próprio teste.
- O mock não esconde a regra: reserva, desfecho e revogação rodam contra o Postgres real.
- A seção "Mutações" alcança cada cláusula nova do diff. As quatro linhas sem bloco têm motivo. O `secret-cipher.ts` foi só renomeado: o `git diff -M` mostra apenas nomes de parâmetro e de comentário, e a mensagem do erro trocada.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **Corrida direta na reserva.** Em `apps/worker/test/enviar-email.int.test.ts:291`, o caso `[P] duas execuções` sobrepõe as execuções, mas a reserva da primeira já foi gravada quando a segunda entra. Uma reserva reescrita como "lê e depois grava" passaria nesse caso. Vale somar um caso com `Promise.all` de vários `envios.reservar` sobre o mesmo convite, exigindo exatamente um `reservado`. É o teste que pegaria essa regressão.
2. **Expurgo contra o job em pleno envio.** `fecharEnviosParados` (`packages/core/src/retencao/expurgo-da-escola.repository.ts:487`) fecha como `falhou` também o `enviando` com a reserva ainda vigente. Se o job estiver mandando o e-mail nessa hora, o e-mail sai, o `concluir` não grava e a linha fica `falhou`. A coordenação pode reenviar e o professor recebe dois e-mails. Segue a spec ("na_fila e enviando com mais de 24 h"), mas vale registrar, ou limitar o `enviando` à reserva vencida.
3. **Nome do caso `[P]` do expurgo.** O caso `com o job do envio segurando a linha` (`apps/worker/test/expurgo-da-escola.int.test.ts:796`) prova o `skip locked` com um `for update` de outra conexão. O job real não trava a linha durante o envio, só durante o `update` da reserva. O nome sugere mais do que o caso prova.
4. **Aceite recusado pelo próprio caso.** O `[P] revogado com o job na barreira` (`enviar-email.int.test.ts:189`) e o caso do `revogarParaRefazer` conferem o `revogado_em` e deixam a recusa do link ao teste de aceite que já existe. Pedir o aceite ali mesmo, como o `ciclo-de-vida.int.test.ts` faz na defesa, fecharia o cenário de ponta a ponta.
5. **Nome promete mais que o caso.** Em `packages/core/src/db/schema/convite-envio.int.test.ts:82`, o caso diz "o `update` ou o `insert`", mas só testa o `insert`. Além disso, a tabela do documento fala em "nove casos" e o arquivo tem dez.
6. **Teste instável fora desta tarefa.** Rodando três arquivos juntos, `apps/api/test/ciclo-de-vida.int.test.ts:1278` (`o pendente, o aceito que teve o convite revogado...`) falhou uma vez em `estadoNaLista(...) === 'aceito'`. Sozinho, passou. O caso não foi tocado por esta tarefa, mas a instabilidade vai aparecer na esteira; fica para a retro.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-07 19:44:36 · `tasks/prd-acesso-e-convites/1_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nesta rodada. A `0042_envio_de_email.sql` mudou só no comentário. Os cifrados `convite.token_cifrado` e `convite.destino_cifrado` agora estão em `COLUNAS_FORA_DO_ARQUIVO`, e `classificacao.test.ts` confirma que estão lá.

Queries verificadas:
- `envios.reservar`, no caso novo com `Promise.all` de oito reservas. Roda dentro de `naEscola(escolaId, ...)`, então o escopo vem do contexto e não de parâmetro.
- As duas consultas de auditoria dos testes passaram a ordenar por `xmin` e continuam filtradas por `escola_id`.
- Os dois ajudantes de `relogio-que-recua.ts` são consultas só de teste, filtradas pelo id do usuário.
- `convite-ticket.ts`: o bilhete continua assinado com a nossa chave, com `typ`, `iss` e `aud` conferidos. Agora exige `iat` e faz a conta da idade à mão: no máximo 30 min depois do `iat` e até 30 s antes dele. O `exp` segue conferido pelo `jose`, sem folga. O bilhete tem só `conta_id` e `convite_id`, sem `escolaId`, e a mudança não abre nenhum caminho novo para escolher o escopo.
- Nenhum endpoint passou a aceitar `escolaId` do cliente.

Teste de isolamento: presente e efetivo. O caso A×B de `convite.int.test.ts` (`valeA`/`valeB`) não mudou em substância. `anteciparODesativado` só antecipa o `desativado_em` em um minuto, logo depois de convidar, e não mexe em nenhuma cláusula de escola.

Correções exigidas na 1ª rodada: nenhuma. Os seis itens da Mesa que tocam o meu escopo estão no diff: (1) cifrados fora do arquivo, (2) ouvinte de `abort` removido no `finally`, com teste por `getEventListeners`, (3) comentário da migration, (4) `Promise.all` de `reservar`, (5) nome do caso do `skip locked`, (6) nome do caso em `convite-envio.int.test.ts`.

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/convite/convite-ticket.ts`: o `verificado.payload.iat ?? 0` nunca usa o `0`, porque `requiredClaims` já exige `iat`. Se um dia o `requiredClaims` mudar, `iat = 0` daria idade enorme e o bilhete seria recusado, o que é seguro. Ainda assim, trocar o `?? 0` por uma checagem explícita deixa a intenção mais clara.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/test/relogio-que-recua.ts`: os ajudantes valem só para usuário recém-convidado. Vale uma linha avisando que usar `anteciparODesativado` depois de uma desativação real esconderia o caso "convite antigo não reativa".
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/test/ciclo-de-vida.int.test.ts:524` ainda usa `desativado_em = now()` direto. É anterior a esta tarefa, mas tem a mesma exposição ao relógio que recua que o `desativarDepoisDoUltimoAceite` resolve.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-07 19:45:11 · `tasks/prd-acesso-e-convites/1_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

**A correção exigida na 1ª rodada foi feita.** `'convite.token_cifrado'` e `'convite.destino_cifrado'` entraram em `COLUNAS_FORA_DO_ARQUIVO` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/shared/src/privacidade/classificacao.ts:162-163`). O teste novo prova as duas, e cada uma tem o seu bloco de mutação.

**Os outros cinco itens da ordem da Mesa também foram aplicados:**
- **Ouvinte de `abort`:** sai no `finally`. O teste confere com `getEventListeners`, no envio que dá certo e no que é recusado, e as duas mutações estão no documento.
- **Comentário da migration `0042`:** agora diz a verdade sobre a transação.
- **Corrida da reserva:** caso novo com `Promise.all` de oito `reservar`, exigindo exatamente um `reservado`. A mutação "lê e depois grava" cai nele.
- **Nomes dos casos:** os dois foram corrigidos, e a tabela do documento segue os títulos novos.
- **Contagem no documento:** agora diz "dez casos".

**O que mudou fora da ordem foi conferido no código, não no texto do documento:**
- **`convite-ticket.ts`:** sem o `maxTokenAge`, o `jose` 6.2.12 não confere mais a idade do `iat`, e a conferência passa a ser feita na mão. O bilhete vale até 30 min depois do `iat` e até 30 s antes dele. O `exp` continua exato no `jose`, que não tem folga, e o `iat` passou a ser obrigatório em `requiredClaims`. Os dois testes cobrem os dois lados da folga e o bilhete assinado com `exp` longo, e as duas mutações cobrem um termo cada. Nenhuma tarefa futura altera esse arquivo (a 10.0 só o lê e cria o `bilhete-da-troca.ts`), e a mudança está registrada na `techspec.md` §2 e na tabela de divergências do documento.
- **`relogio-que-recua.ts`:** `anteciparODesativado` só recua o `desativado_em` inicial do recém-convidado. Como a desativação seguinte sobrescreve esse valor, os casos de "desativado depois do aceite" continuam provando a regra: ver `ciclo-de-vida.int.test.ts:1245` e `:1295`, que confere `usado_em < desativado_em`. `desativarDepoisDoUltimoAceite` não enfraquece o caso do convite antigo que não reativa.
- **Ordem da auditoria e folga de 10 s:** ordenar por `xmin` e alargar a folga do convite vencido mexem só no teste, e o que esses casos provam continua o mesmo.

Recomendações:
1. **`challenge.ts` e `operador-challenge.ts`:** os dois usam o mesmo `maxTokenAge` sem folga. O documento menciona isso como "ressalva do relatório", mas não está no `TODO.md`. Precisa ir para lá, ou para uma tarefa, para não se perder.
2. **`cenarios.md`:** a folga de 30 s do bilhete é comportamento novo e testado, mas não aparece nesse documento. Vale um [U] na seção do RF12/convite, para o Validador encontrar.
3. **`10_task.md`, seção "Como testar":** cita `convite-ticket.test.ts:33`, mas o caso "permissão: …" está agora na linha 61. Basta citar pelo nome do caso, sem o número da linha.
4. **`xmin::text::bigint` em `convite.int.test.ts` e `ciclo-de-vida.int.test.ts`:** funciona no banco de teste. Vale uma linha de comentário dizendo que não serve para ordenar em produção (o `xmin` dá a volta e o `vacuum freeze` o congela), para ninguém copiar o padrão para um repository.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-07 19:45:15 · `tasks/prd-acesso-e-convites/1_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo nesta rodada. Os dois cifrados da 0042, `convite.token_cifrado` e `convite.destino_cifrado`, agora estão em `COLUNAS_FORA_DO_ARQUIVO`, e um teste prova isso. O endereço cifrado é de professor ou coordenador, não de aluno.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok. Nenhuma rota nova nem rota alterada. O bilhete do convite ficou um pouco mais tolerante e continua tão difícil de forjar quanto antes:
- A assinatura, o `typ`, o `iss` e o `aud` continuam conferidos.
- O `iat` passou a ser obrigatório (`requiredClaims: ['exp', 'iat']`).
- Um `exp` falso não alonga o prazo. Um bilhete assinado com `exp` de 60 min continua valendo só 30 min a partir do `iat`, e o teste prova isso.
- Conferi no `jose` 6.2.12 (`node_modules/jose/dist/webapi/lib/jwt_claims_set.js:80-91`): sem `maxTokenAge`, o `iat` no futuro não é checado lá, então a checagem manual em `convite-ticket.ts:68-69` é a que vale. Ela aceita até 30 s antes do `iat` e até `TICKET_TTL_SECONDS` depois. O `exp` exato continua com o `jose`, sem folga.
- O que o Implementador escreveu na linha de divergências confere com o código.

Logs: limpos. Nenhum log novo.

Auditoria: presente. Nenhuma ação nova que exija auditoria. Nos dois testes, `auditoriaDoConvite` e `auditoriaDoCiclo` agora ordenam por `xmin`. É só ordenação de teste, e o que se compara (autor, antes, depois, finalidade) não mudou.

Envio externo: sem mudança de escopo. É o e-mail do convite, pelo SMTP configurado e só para o endereço do convidado adulto. O ouvinte de `abort` agora sai no `finally` (`smtp-email-sender.ts:72-75`), e um teste com `getEventListeners` prova isso. Nada vai para IA.

Seed/fixture: sintético. Os testes usam `@escola.invalid` e "Professor Sintético". O `relogio-que-recua.ts` só mexe em `desativado_em` no banco de teste.

Bloqueantes: nenhum.

Conferi os seis itens da ordem da Mesa, um por um:
1. Os dois cifrados estão em `COLUNAS_FORA_DO_ARQUIVO`, com teste em `classificacao.test.ts` e bloco de mutação. Feito.
2. O ouvinte de `abort` sai no `finally`, com teste e duas mutações. Feito.
3. O comentário da migration 0042 agora está correto sobre a trava dentro da transação. Feito.
4. O caso com `Promise.all` de 8 reservas existe e espera 1 `reservado` e 7 `reserva_alheia`. Feito.
5. O caso do `skip locked` foi renomeado. Feito.
6. O nome do caso em `convite-envio.int.test.ts` foi corrigido, e o documento agora diz "dez casos". Feito.

Os três testes unitários alterados (`convite-ticket.test.ts`, `smtp-email-sender.test.ts` e `classificacao.test.ts`) passam: 18 de 18. Os testes de integração não rodei.

Nas mudanças que não vieram da ordem, o `anteciparODesativado` não esconde a regra 18 (fim de vínculo desativa a conta). Conferi em `ciclo-de-vida.repository.ts:282-287`: a desativação real sobrescreve `desativado_em` com `clock_timestamp()`, então os casos que desativam pela API continuam provando a regra de verdade. E o caso "desativado depois de ter entrado não reativa" usa `desativarDepoisDoUltimoAceite`, que mantém `desativado_em` depois de todo `usado_em`.

Recomendações:
- Registrar na retro, ou no `TODO.md`, uma falha que a estabilização revelou e que mexe com a regra 18. A ativação por convite compara duas horas do relógio do banco (`convite.usado_em >= usuario.desativado_em`, em `convite.repository.ts:77` e `ciclo-de-vida.repository.ts:247`). Se o relógio recuar entre o aceite e uma desativação feita logo em seguida, `desativado_em` pode ficar antes de `usado_em`. Aí o bilhete ainda válido (até 30 min) reativaria a pessoa desativada. A janela é de cerca de 1,7 s e só existe com relógio desregulado, então não bloqueia. Mas vale uma linha no runbook exigindo NTP disciplinado na VPS de produção. Melhor ainda seria uma checagem que não dependa do relógio, como um contador de desativações no usuário.
- O `xmin::text::bigint` nas consultas de auditoria dos testes quebra se o contador de transações do Postgres der a volta (wraparound). No banco efêmero de teste isso não acontece. Vale só um comentário dizendo que esse jeito de ordenar não é para código de produção.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/convite/convite-ticket.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/test/relogio-que-recua.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/shared/src/privacidade/classificacao.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/email/smtp-email-sender.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts

## infra-guardian · 2ª rodada · APROVADO · 2026-11-07 19:45:24 · `tasks/prd-acesso-e-convites/1_task.md`

VEREDITO: APROVADO
Caminho quente tocado: login
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: compatível
Métrica e alerta: ok
Bloqueantes: nenhum

Os itens que a Mesa mandou aplicar foram feitos:

- (2) O ouvinte de `abort` agora sai no `finally`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/email/smtp-email-sender.ts:74-75`. Um teste com `getEventListeners` confere os dois caminhos, o de sucesso e o de recusa 550.
- (3) O comentário de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/drizzle/0042_envio_de_email.sql:4-5` agora está certo: o arquivo roda numa transação só, e o `NOT VALID` não encurta a trava. A `convite` é pequena, então não pesa.
- (1) Os dois cifrados estão em `COLUNAS_FORA_DO_ARQUIVO`.
- (4) O caso com `Promise.all` de oito `reservar` simultâneos existe e prova uma reserva só, com as outras sete vendo a reserva alheia.
- (5) e (6) Os nomes dos casos foram trocados.

O que mudou fora da ordem, conferido no código:

- **`convite-ticket.ts:55-70`.** No `jose` 6.2.12, a conferência do `iat` no futuro só acontece com `maxTokenAge` e sem folga. Isso está em `node_modules/jose/dist/webapi/lib/jwt_claims_set.js:86-92`. A troca pela conta de idade feita no próprio código aceita até 30 s de `iat` no futuro e mantém os 30 min exatos. O `exp` continua exato com o `jose`, porque a folga padrão é 0. Não há custo novo no request. A troca deixa o bilhete mais robusto entre duas instâncias da API. Rodei os três arquivos de teste unitário alterados e os 18 casos passaram.
- **`relogio-que-recua.ts`, `convite.int.test.ts` e `ciclo-de-vida.int.test.ts`.** As mudanças estão só nos testes. Ordenar por `xmin` e adiantar o `desativado_em` não muda nenhuma regra do produto.

Recomendações:
- **Desafio do login.** `apps/api/src/credencial/challenge.ts` e `operador-challenge.ts` usam o mesmo `maxTokenAge` sem folga, no caminho quente do login com segundo fator. Se duas instâncias tiverem relógios 1 s fora, o desafio é recusado. Hoje, numa VPS só, o relógio é um só. Registre no `TODO.md` antes de ter mais de um host. O Implementador já deixou isso como ressalva no relatório.
- **Ativação depende do relógio de parede.** A ativação por convite compara `usado_em >= desativado_em`, duas horas tiradas do relógio. Os ajudantes de `relogio-que-recua.ts` tiram o teste desse efeito, mas não o produto. Se o relógio do banco recuar entre convidar e aceitar, o login não ativa ninguém. O risco real é baixo, porque uma pessoa leva bem mais de 2 s entre o convite e o aceite. Mesmo assim, vale registrar no `TODO.md` ou trocar por uma ordem que não dependa do relógio.
- **Borda do convite vencido.** O caso passou de 72 h + 1 s para 72 h + 10 s, e a borda ficou menos fina. Um caso unitário com relógio injetado no `expira_em` cobriria o segundo exato sem depender da máquina.

## test-engineer · 2ª rodada · APROVADO · 2026-11-07 19:45:51 · `tasks/prd-acesso-e-convites/1_task.md`

VEREDITO: APROVADO

**Cenários exigidos** (desta rodada: as seis correções da ordem `.processo/ordens/1_task-r1.md` e as quatro mudanças fora dela):
- (1) os dois cifrados em `COLUNAS_FORA_DO_ARQUIVO`, com teste.
- (2) o ouvinte de `abort` retirado no `finally` de `enviar`, com teste.
- (3) o comentário da migration `0042`.
- (4) concorrência de verdade em `envios.reservar`, com `Promise.all`.
- (5) o nome do caso do `skip locked`.
- (6) o nome do caso de `convite-envio` e a contagem.
- A folga de relógio do bilhete do convite: código de produção novo, com borda inferior, borda superior e o `exp` maior que o prazo.
- Os ajudantes de `relogio-que-recua.ts` não podem esconder nenhuma asserção de "não reativa".
- A ordenação da auditoria por `xmin`.
- A folga do convite vencido passou de 1 s para 10 s.

**Cobertos:**
- **(1)** `packages/shared/src/privacidade/classificacao.test.ts` tem dois casos. Cada linha da lista tem bloco próprio, e o `toContain` cai se qualquer uma for removida.
- **(2)** `smtp-email-sender.test.ts › … não deixa o ouvinte de abort …` confere com `getEventListeners`, depois do envio que deu certo e depois da recusa 5xx. Os dois blocos novos (tirar a remoção e trocar `!==` por `===`) deixam um ouvinte no sinal, e o teste cai. O bloco 98 foi atualizado para a linha nova do `addEventListener`.
- **(3)** O comentário está correto: a trava do `ADD COLUMN` dura até o commit, e o `not valid` não a encurta.
- **(4)** `enviar-email.int.test.ts:307` dispara oito `reservar` em `Promise.all`, sobre um pool de duas conexões, então há paralelismo real. O `reservar` é um `update … returning` só (`envio.repository.ts:41-46`). O caso exige 1 `reservado` e 7 `reserva_alheia`. O bloco que afrouxa o `where` dá várias reservas e o teste cai.
- **(5)** e **(6)** Os nomes foram trocados, e o documento e o bloco de mutação acompanham.
- **Bilhete do convite** (`convite-ticket.ts:57-69`). Conferi no código o que o Implementador afirma. Sem `maxTokenAge`, o `jose` não confere o `iat` no futuro, e a conta da idade passa a fazer isso.
  - `aos(-31)` com resultado `undefined` derruba o bloco que tira a borda inferior.
  - O bilhete com `exp` igual a 2×TTL derruba o bloco que tira a borda superior.
  - `aos(TTL)` e `aos(TTL+29)` com resultado `undefined` provam que nenhum `clockTolerance` foi passado ao `jose`.
  - O `iat ?? 0` está bem justificado como saída do tipo.
  - Rodei os três arquivos de unidade: 18 casos passaram.
- **`relogio-que-recua.ts`.** Conferi cada uso. Nenhum caso de "não reativa" fica mascarado:
  - Em `convite.int.test.ts:492-526`, a asserção do convite antigo (linha 508) vem antes do novo `convidarEm`, e o reconvidar revoga o convite antigo.
  - Em `ciclo-de-vida.int.test.ts:1245` e `:1295`, o `desativar` grava um `desativado_em` posterior ao aceite, e o caso `[P]` confere `usado_em < desativado_em` no banco.
- **`xmin`.** As linhas de auditoria só recebem inserções. O empate na mesma transação continua desempatado por `id`, como já era com o `em`.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **Tabela "Testes que provam a regra" do `1_task.md`.** Os três casos novos aparecem só nos blocos de mutação, não na tabela:
   - a linha 63 (`[P] duas execuções`) deve citar `› [P] oito reservas do mesmo convite ao mesmo tempo …`;
   - a linha 70 deve citar `› … não deixa o ouvinte de abort …`;
   - falta uma linha para `classificacao.test.ts`, os cifrados fora do arquivo do titular.
2. **A mesma fragilidade em `challenge.ts` e `operador-challenge.ts`.** Os dois usam o mesmo `maxTokenAge` sem folga, e o documento os deixa como "ressalva do relatório". Merece entrada no `TODO.md`, ou na tabela de recomendações com um destino, para não se perder.
3. **Folga do convite vencido** (`convite.int.test.ts:352`). Passar de 1 s para 10 s afrouxa a borda do expirado. Vale provar a borda exata sem depender do relógio de parede, gravando o `expira_em` em relação ao `now()` do próprio banco (por exemplo `now() - interval '1 second'`).
4. **O produto depende do relógio de parede.** `relogio-que-recua.ts` documenta um ponto do produto, não só do teste: a regra `usado_em >= desativado_em` depende de o relógio do banco nunca recuar entre o convidar e o aceite. Em produção, um ajuste de NTP para trás faria o aceite não ativar ninguém, em silêncio. Registrar para a retro ou o `TODO.md`, com uma alternativa que não dependa do relógio, como uma marca de estado ou uma ordem por transação.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/convite/convite-ticket.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/convite/convite-ticket.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/test/relogio-que-recua.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/test/convite.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/test/ciclo-de-vida.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/worker/test/enviar-email.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/email/smtp-email-sender.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/email/smtp-email-sender.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/shared/src/privacidade/classificacao.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tasks/prd-acesso-e-convites/1_task.md
