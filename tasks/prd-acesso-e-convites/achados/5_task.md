# Achados das revisões — `tasks/prd-acesso-e-convites/5_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-08 01:25:52 · `tasks/prd-acesso-e-convites/5_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A tarefa 5.0 não grava, não lê e não toca `Nota`. Procurei `nota`, `lancadaPor`, `correcao`, `tutor`, `agente` e `llm` no diff e em todos os arquivos novos, e nenhum aparece. Todos com autor humano? Não se aplica.

Decisão autônoma sobre aluno: ausente. A tarefa só faz o "esqueci a senha", o link da conta e o envio dele por e-mail. Nada nela decide aprovação, reprovação ou encaminhamento.

Aprovação registrada: ok. Nenhuma saída de IA nasce nesta tarefa. Os textos do e-mail estão escritos à mão em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/email/mensagem-do-link-da-conta.ts` e não saem de modelo nenhum. Nem `senha.service.ts` nem `enviar-email.ts` importam porta de IA.

Supervisão do tutor: ok. A tarefa não toca o tutor.

Autonomia declarada e visível: sim. Nenhum agente foi criado ou alterado, então a declaração que já existe fica como estava.

Bloqueantes: nenhum.

Pontos que conferi e que não violam a regra 70:
- **Exceção nova na fila de jobs.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/queue/job-outbox.repository.ts:14`, `SISTEMA_DA_REQUISICAO` deixa uma requisição criar um job do sistema sem ser rotina do sistema. A lista é fechada e tem um tipo só, o e-mail do link da conta (`sistema.enviar-email-da-conta`). Ela não abre caminho para job que grave `Nota` nem que acione agente.
- **Auditoria `senha.redefinida`.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/auditoria/acoes.ts:169`, o registro tem autor e alvo humanos, um por escola. Não registra saída de IA, então o item 6 da regra 70 não muda.
- **Supervisão e indicador de professor.** Nada mede o professor e nada observa o comportamento de aluno.
- **`docs/regulacao.md` e regra 70.** Nenhum dos dois foi alterado nesta tarefa.

Recomendações:
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/queue/job-outbox.repository.ts:10`, o comentário de `SISTEMA_DA_REQUISICAO` já diz que tipo novo ali é mudança de spec. Vale acrescentar que, se um tipo novo vier de IA, de nota ou de decisão sobre aluno, ele passa pelo `conformidade-reviewer` antes de entrar. Hoje a lista fecha a porta por tipo, não por assunto.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-08 01:26:37 · `tasks/prd-acesso-e-convites/5_task.md`

```
VEREDITO: APROVADO
Campos pessoais tocados: link_da_conta (finalidade, token_hash, token_cifrado, destino_cifrado = e-mail da equipe cifrado, expira_em, usado_em, envio, envio_reservado_em, criado_em); contadores rl:ip:senha (HMAC do IP) e rl:senha:email (HMAC do e-mail digitado); conta.senha_hash (troca); sessao.motivo ganha 'senha_redefinida'; auditoria senha.redefinida
Fora da tabela de dados do docs/lgpd.md: nada
Autorização por objeto: ok
Logs: limpos
Auditoria: presente
Envio externo: o e-mail do link da conta (endereço da equipe e link com o token depois do #, sem escola e sem nome), pelo provedor SMTP, que é a linha 78 do docs/lgpd.md (suboperador). Fica registrado em link_da_conta.envio, com log só com linkId. Nenhum dado de aluno e nenhum envio a IA
Seed/fixture: sintético
Bloqueantes: nenhum
Recomendações:
1. apps/api/src/sessao/tenant/tenant-resolution.repository.ts:136-141. O docblock de usuariosAtivosDaConta diz que só a redefinição do MFA usa comSuspensos. Agora o esqueci (senha.service.ts:100) e o redefinir (senha.service.ts:148) também usam. Na prática, quem tem a eliminação agendada numa escola recebe o link, e o senha.redefinida é gravado na escola onde a eliminação está agendada. Isso não vaza nada, porque o registro só tem ids e o login segue bloqueado ali, e bate com "usuário ativo" da Tech Spec. Mesmo assim, atualize o docblock e prove a escolha com um caso de teste.
2. senha.service.ts:86-131. O piso de 400 ms cobre o tempo da resposta, mas não o caso de erro. Só a conta existente chega a #abrirLink, então uma falha de banco ou de cifra ali responde 500, e o e-mail sem conta nunca chega nesse ponto. Avalie engolir a falha depois do piso e devolver 202, com o log só do evento, para o erro não confirmar que a conta existe.
3. O seguro em memória do "esqueci" com o Redis fora (senha.service.ts:108) não tem caso de teste. A própria tarefa já deixou isso para a Mesa decidir.
```

Conferi a regra 20 contra a tarefa e cada item abaixo bate com o código.

- **Mapa de dados:** a tabela nova está na linha 79 do `docs/lgpd.md`, com finalidade e retenção (30 dias, mais o `falhou` com os cifrados nulos em 24 h). Os contadores estão na linha 89 e o `rl:ip:senha` na lista dos baldes por IP (linha 190). As chaves passam pelo HMAC (`window-counter.ts:96`).
- **Classificação:** em `classificacao.ts`, os três campos do token e do endereço ficam fora do arquivo do titular, como no convite. Nenhum campo de aluno entra.
- **Exposição:** não há DTO a vazar, porque o 202 e o 204 saem sem corpo e com `no-store`. O token vai no corpo e no fragmento depois do `#`, nunca na URL. Link vencido, usado, substituído ou de conta desativada responde o mesmo `NAO_ENCONTRADO`. O "esqueci" responde igual exista ou não a conta, no piso, e nunca 429. O token é conferido antes do argon2.
- **Link:** vale 1 h, serve uma vez só (`usado_em is null` no update), um link novo cancela o anterior, e há um aberto por conta.
- **Logs:** a API grava só `senha.link_na_fila` e `senha.redefinida`, sem campos. No worker, os eventos `email.link_da_conta_*` levam só `linkId`, a tentativa e o estado. O teste "o log só com ids" prova isso.
- **Auditoria:** há um `senha.redefinida` por escola, com antes, depois e finalidade nulos, e o teste prova que nada da escola B entra no registro da A.
- **Ciclo de vida:** o link é apagado no expurgo de acesso 30 dias depois do uso ou do vencimento, e junto com a conta (`on delete cascade`). Os cifrados saem de qualquer envio que não está esperando, e o check da migration garante isso.
- **Pergunta de fechamento:** o código responde. A tabela é credencial da conta, não do aluno, está classificada, e o envio está na linha do provedor de e-mail.
- **Testes:** rodei os de unidade da classificação, da mensagem e das ações de auditoria, e passaram (6 arquivos, 63 testes). Não rodei os de integração.

Arquivos principais:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/senha/senha.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/tenant/tenant-resolution.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/worker/src/processors/enviar-email.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/drizzle/0043_link_da_conta.sql
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/shared/src/privacidade/classificacao.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/docs/lgpd.md

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-08 01:26:38 · `tasks/prd-acesso-e-convites/5_task.md`

```
VEREDITO: APROVADO
Tabelas verificadas: link_da_conta (migration 0043, schema link-da-conta.ts); sessao (só o check sessao_motivo_valido ficou mais largo)
Queries verificadas: TenantResolutionRepository (cancelarLinksAbertos, criarLinkDaConta, linkValidoPorHash, usarLinkPorHash, trocarSenha, e usuariosAtivosDaConta usado no redefinir); EnvioRepository (reservarLink, concluirLink, devolverLink; reservar, concluir e devolver do convite seguem presos à escola do contexto); ExpurgoDeAcessoRepository (APAGAR_LOTE.link_da_conta, fecharEnviosDeLinkParados); JobOutboxRepository.inserir (SISTEMA_DA_REQUISICAO, escolaId forçado a nulo em sistema.*); SenhaService.redefinir (senha.redefinida gravado por escola com escolaId e usuarioId lidos do banco)
Teste de isolamento: presente e efetivo
Bloqueantes: nenhum
Recomendações:
- packages/core/src/email/envio.repository.ts:110, :128, :139: três @Unscoped entraram numa classe que até aqui era toda presa à escola (o convite usa requireEscolaId). É o sinal da regra 10, item 9 ("terceira no mesmo módulo"). A Tech Spec previu o desenho e a cerca-envio limita quem importa a classe, por isso não bloqueia. Ainda assim, separar os métodos do link numa classe própria (por exemplo EnvioDoLinkRepository) deixaria o EnvioRepository do convite sem nenhuma exceção. Levar à retro.
- packages/core/src/retencao/expurgo-de-acesso.repository.ts:303: o repositório passa de dois para três @Unscoped. Os três são rotina administrativa nossa e têm justificativa, então fica só o registro do sinal do item 9.
- packages/core/src/queue/job-outbox.repository.ts:14: SISTEMA_DA_REQUISICAO está tipado como `readonly string[]`. Tipar com os tipos de job (tupla `as const` de TIPO_ENVIAR_EMAIL_DA_CONTA) faz o compilador acusar um nome errado ou removido na lista de liberados.
- apps/api/test/senha-esqueci.int.test.ts:428-435: além de olhar escola por escola, contar que a conta tem exatamente dois registros senha.redefinida no total, filtrando a auditoria pelos usuários da conta. Isso pega um registro a mais gravado numa terceira escola.
```

Foi conferido e está certo:
- link_da_conta não tem escolaId e aparece entre as exceções do item 1 de "Regras transversais" em /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/docs/modelo-de-dados.md, como o codigo_recuperacao. Não varia por período, então não precisa de anoLetivoId. O id é uuidv7.
- Os schemas de /v1/senha/esqueci e /v1/senha/redefinir são `.strict()`, e o teste prova 400 quando o corpo traz escolaId.
- O esqueci responde 202 igual em todos os casos. O redefinir responde 404 NAO_ENCONTRADO para todo link inválido, sem 403 em lugar nenhum.
- O registro por escola sai do banco, nunca do cliente. Se a cláusula de escola for tirada, o caso "grava `senha.redefinida` em cada escola…" e o "usuário da conta desativado em B" quebram.
- O job da conta nasce com escola nula e lê o link só pelo id.
- Os testes de convite de outra escola no worker continuam valendo, porque o reservar do convite não mudou.
- A camada de rede não entra nesta tarefa.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-08 01:27:31 · `tasks/prd-acesso-e-convites/5_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

Recomendações:

1. **Escopo, texto do `verificar`.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/email/mensagem-do-link-da-conta.ts:24`, a tarefa já escreveu o e-mail de `verificar`, com assunto e prazo de 24 h. O caso "o link de `verificar` leva o caminho e a validade dele", em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/worker/test/enviar-email-da-conta.int.test.ts:134`, prova esse texto. A finalidade é da 7.0. Não bloqueia, por dois motivos: o `Record` sobre `FinalidadeDoLinkDaConta` obriga a ter um ramo, e a 7.0 não lista esse arquivo nem o worker. Registre na 7.0 que o texto já existe e que é ela quem o confere contra o `cenarios.md`. Senão ninguém audita esse texto no contexto certo.

2. **Nomes do convite usados para os dois e-mails.**
   - `HORAS_DO_ENVIO_DE_CONVITE_NA_FILA` agora vale também para o link da conta (`expurgo-de-acesso.repository.ts:273` e `:363`).
   - `TENTATIVAS_DO_ENVIO_DE_EMAIL` vem da definição do convite e vale para os dois jobs (`enviar-email.ts:32`). Hoje os dois usam `RETENTATIVA_DE_HOJE`. Se divergirem, o job da conta passa a usar o número do convite sem ninguém notar. Leia a tentativa da definição do próprio tipo.
   - A descrição da métrica `emailPorResultado`, em `enviar-email.ts:131`, ainda diz "do convite", e a métrica agora mistura os dois envios.

3. **Import entre services.** `senha.service.ts:12` importa `tokenNovo` de `../convite/convite.service.js`. Gerar token é peça comum: mova para junto do `hashDoToken`, em `credencial/token-hash.js`, em vez de um service depender de outro.

4. **Log do "esqueci".** `senha.service.ts:126` registra `senha.link_na_fila` sem nenhum id. O runbook usa esse evento como sinal. O plano da tarefa prometia log só com `linkId`, e o `linkId` não tem dado pessoal. Inclua-o para correlacionar com o `email.link_da_conta_*` do worker.

5. **Três `@Unscoped` novos no `EnvioRepository`.** `reservarLink`, `concluirLink` e `devolverLink` estão em `envio.repository.ts:393-430`. A Tech Spec, seção 6, autoriza a exceção e a cerca a acompanha, mas a regra 10, item 9, pede atenção à terceira marcação no mesmo módulo. Fica para o `tenancy-guardian` confirmar que a cerca por arquivo responde a isso.

6. **Lacuna para a Mesa.** O ramo do seguro em memória do "esqueci" (`senha.service.ts:108`) ficou sem caso. A própria tarefa declara isso no `--faltando`, e a decisão é do `test-engineer`.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-08 01:27:47 · `tasks/prd-acesso-e-convites/5_task.md`

VEREDITO: APROVADO
Caminho quente tocado: login | fila | migration
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: compatível
Métrica e alerta: ok
Bloqueantes: nenhum

**Por que passa em cada item:**
- **Rate limit:** o "esqueci" conta por IP (`rl:ip:senha`, 10 por minuto) e por e-mail digitado (3 por hora). Acima do limite ele responde o mesmo 202, sem enviar e nunca com 429, e o login do mesmo IP segue normal. Assim a escola atrás de um IP só não fica bloqueada, e o desenho é o que está em `cenarios.md:283`.
- **Request:** o e-mail não sai na requisição, vai para a fila. O piso de 400 ms só segura a resposta, sem conexão de banco aberta. No "redefinir", o token é conferido antes do argon2, e o argon2 roda fora da transação, pelo semáforo do login.
- **Fila:** o job `sistema.enviar-email-da-conta` vai para a fila `normal`, na `vaga:normal:sistema`, e solta a vaga quando é adiado. O limite `EMAIL_POR_MINUTO` guarda metade para o link da conta, e o expurgo roda em lote, com `skip locked`.
- **Concorrência:**
  - Dois "esqueci" ao mesmo tempo: o índice único parcial `link_da_conta_aberto_unico` deixa um link só, e o perdedor responde o mesmo 202.
  - Dois "redefinir" com o mesmo token: a conta é travada (`for update`) e o link é marcado com `update … where usado_em is null`, então só um troca a senha.
  - O job do e-mail só grava o resultado se a reserva ainda é dele, então o cancelamento feito por um "esqueci" novo vence.
- **Migration:** só expande. A tabela é nova e a lista de motivos aceitos na `sessao` fica mais larga, o que o código anterior aguenta.
- **Testes:** `senha-esqueci`, `enviar-email-da-conta` e `expurgo-de-acesso` passam, 56 de 56, rodados aqui. Nenhum chama provedor pago.

Recomendações:
1. `packages/core/drizzle/0043_link_da_conta.sql:36`: o `ADD CONSTRAINT sessao_motivo_valido CHECK` sem `NOT VALID` trava a `sessao` inteira (`ACCESS EXCLUSIVE`) e varre a tabela toda. Hoje é aceitável: as migrations 0013 e 0035 fizeram o mesmo, a `sessao` só guarda 30 dias e o deploy é fora do horário letivo. Na próxima vez que esse check crescer, use `ADD CONSTRAINT … NOT VALID` e depois `VALIDATE CONSTRAINT`, em comandos separados.
2. `apps/worker/src/processors/enviar-email.ts:131-132`: `email_por_resultado` e `email_adiado` não têm o rótulo `classe` (`convite` ou `conta`), e a descrição ainda diz "do convite". O alerta `educa-email-falhou` não separa o link da conta da cota de convites. Basta acrescentar `classe` aos dois contadores.
3. `apps/api/src/sessao/senha/senha.service.ts:130`: quando o "esqueci" é descartado (balde do IP ou do e-mail cheio), não há métrica. O runbook manda deduzir isso de "`senha.link_na_fila` rarefeito" no log. Um contador `senha.esqueci.descartado{motivo: ip|email}` deixaria visível um aluno enchendo o balde do IP da escola e barrando, naquele minuto, o "esqueci" dos professores.
4. `packages/core/src/retencao/expurgo-de-acesso.repository.ts:281-294`: `fecharEnviosDeLinkParados` filtra por `envio` e `criado_em` sem índice. Hoje não pesa, porque a tabela é só da equipe e guarda 30 dias. Vale lembrar disso se a 7.0 aumentar o volume com o link de verificar.

Arquivos auditados: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/senha/senha.service.ts`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/tenant/tenant-resolution.repository.ts`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/email/envio.repository.ts`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/worker/src/processors/enviar-email.ts`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/queue/job-outbox.repository.ts`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/retencao/expurgo-de-acesso.repository.ts`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/drizzle/0043_link_da_conta.sql`.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-08 01:30:10 · `tasks/prd-acesso-e-convites/5_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- **Caminho feliz:** o "esqueci" com conta ativa abre um link de 1 h e põe o job na fila; o "redefinir" troca a senha, derruba as sessões, mantém o MFA e grava `senha.redefinida` por escola.
- **Bordas:**
  - e-mail sem conta, conta desligada, conta em duas escolas, usuário desativado só em B;
  - usuário desativado antes do link e entre a leitura e a transação;
  - link vencido, usado e substituído;
  - envio antigo `enviando`;
  - SMTP 4xx e 5xx, reserva alheia;
  - expurgo com 23 h e com mais de 24 h, e os 30 dias;
  - convites enchendo a metade do `EMAIL_POR_MINUTO`.
- **Permissão:**
  - token inválido não chega ao argon2;
  - outro `sistema.*` não nasce de requisição;
  - a troca de senha só alcança a conta do link;
  - o "esqueci" de uma conta não mexe no link de outra conta;
  - o token de outra finalidade não redefine a senha.
- **Isolamento:** o registro da B não aparece no da A; o usuário desativado em B não gera registro em B.
- **Concorrência:** dois "esqueci" com o primeiro preso no insert, "esqueci" com o envio na barreira, dois "redefinir", dois jobs do mesmo link.

**Cobertos:** as 15 linhas da tabela têm caso pelo nome, e cada caso olha o resultado: linhas de `link_da_conta`, `job_registro`, auditoria por escola, sessões, hash da senha, e o piso por relógio falso. Não há `.skip`, nem teste comentado, nem provedor pago. O e-mail sai pelo `FakeEmailSender`. A cerca tem fixture para o vizinho, o barril, a composição, o `export *` e o `import()`, mais o caso "sem o alvo". Rodei `senha-esqueci.int.test.ts`: 19 de 19 verdes.

**Bloqueantes:**

1. **`apps/api/src/sessao/tenant/tenant-resolution.repository.ts:391`** (`cancelarLinksAbertos`, termo `eq(linkDaConta.contaId, contaId)`): cláusula nova, sem bloco e sem teste. Se esse termo sair, o "esqueci" de qualquer pessoa cancela o link aberto de todas as contas, e nenhum caso fica vermelho.
   - O caso "balde rl:ip:senha cheio" tem 13 contas, mas conta `linksDe(...).length`, e isso inclui os cancelados.
   - O `--faltando` só justifica o `isNull(usado_em)` dessa linha.
   - **Correção:** um caso com duas contas, cada uma com link aberto. O "esqueci" de uma deixa o link da outra `na_fila`, com os cifrados, e o token dela ainda redefine. Mais o bloco que tira o termo.

2. **`tenant-resolution.repository.ts:391`, `:430` e `:448`** (o termo `eq(linkDaConta.finalidade, finalidade)` em `cancelarLinksAbertos`, `linkValidoPorHash` e `usarLinkPorHash`): sem teste, sem bloco e sem motivo no `--faltando`. O motivo dele lista `gt(expira_em)`, `isNotNull(conta.email)` e `exists`, mas não a finalidade. O que fica sem prova:
   - um token de `verificar` redefinindo a senha;
   - o "esqueci" cancelando um link de `verificar` aberto.

   **Correção:** semear um link `verificar` direto no banco, como o teste do worker já faz, e provar duas coisas: `/v1/senha/redefinir` com esse token dá 404 e a senha não muda; o "esqueci" deixa o link `verificar` aberto. Depois, um bloco para o `cancelarLinksAbertos` e, para o par leitura e uso, um bloco ou o motivo de defesa repetida escrito no `--faltando`.

3. **`packages/core/src/queue/job-outbox.repository.ts:89`** (`escolaId: doSistema ? null : (contexto?.escolaId ?? null)`): a condição é desta tarefa, e o `--faltando` diz o contrário ("o resto da linha (… `escolaId` do contexto) é de antes dela"). O teste existe: `senha-esqueci.int.test.ts:535-537` espera `escola_id` nulo com a escola no contexto.
   - **Correção:** um bloco que troque pela forma antiga (`escolaId: contexto?.escolaId ?? null`), com o teste "outro `sistema.*` pedido por requisição", e o motivo falso apagado.

4. **`packages/core/src/email/envio.repository.ts`, `devolverLink`** (o `where` com `eq(envio, 'enviando')` e `eq(envioReservadoEm, reserva)`): método novo, sem bloco e sem caso. O caso que falta é o cancelamento pelo "esqueci" enquanto o job envia e o SMTP responde 4xx. Hoje nada prova que a linha não volta de `cancelado` para `na_fila`. O cenário equivalente do convite está em `cenarios.md:37`.
   - **Correção:** um caso em `enviar-email-da-conta.int.test.ts`: barreira, cancelamento, `falharProximos('transitoria')`, e a linha continua `cancelado`, sem cifrados, e a tentativa seguinte não envia. Mais o bloco que tira a marca da reserva.

5. **SQL novo sem bloco.** A ferramenta `--faltando` não enxerga cláusula dentro do template SQL. Os testes já cobrem cada uma; falta o bloco que prova isso:
   - **`envio.repository.ts`, `reservarLink`:** o `where id = … and (envio = 'na_fila' or (envio = 'enviando' and envio_reservado_em <= now() - …))`. Bloco que tira o ramo da reserva vencida, com o caso "reserva alheia vigente … vencida, é retomada".
   - **`packages/core/src/retencao/expurgo-de-acesso.repository.ts`, `fecharEnviosDeLinkParados`:** o termo `criado_em < … - make_interval(hours => …)`. Só o termo `envio in (…)` tem bloco. Bloco que tira o termo do prazo, com o caso "envio do link da conta parado", que fica vermelho pelos dois de 23 h.
   - **`expurgo-de-acesso.repository.ts`, `APAGAR_LOTE.link_da_conta`:** `coalesce(usado_em, expira_em) < … - make_interval(days => …)`. Bloco que troca o `coalesce` por `expira_em`, com o caso "borda: nos limites de cada prazo…", que cai pelo "usado há 10 dias, vencido há 31".

**Recomendações:**
- **"dois redefinir" (`senha-esqueci.int.test.ts:507`):** usa `Promise.all` solto, e a autoconferência 10 diz "todos com a ordem forçada". O bloco do `usado_em is null` só fica vermelho se as duas leituras do link acontecerem antes do primeiro commit. Forçar a ordem: segurar o primeiro no `hash.gerar` ou na trava da conta, com `esperarNaTrava`.
- **"[P] cancelado com o job na barreira" (`enviar-email-da-conta.int.test.ts:166`):** o cancelamento é uma cópia em SQL do `cancelarLinksAbertos`. Melhor usar o método de verdade (`TenantResolutionRepository`), como o `enviar-email.int.test.ts` já importa o `ConviteRepository`.
- **Piso:** com o relógio parado, `falta` é sempre 400, e um `esperar(PISO)` fixo passaria. Avançar o relógio no meio do pedido (num espião) prova que o piso desconta o trabalho já feito.
- **`{ comSuspensos: true }` (`senha.service.ts:100` e `:148`):** a conta cujo único usuário tem eliminação agendada ganha o link e grava `senha.redefinida`. A spec não fala disso, e nenhum caso o prova. Registrar como divergência e escrever o caso, ou tirar.
- **Títulos que prometem mais do que o caso confere:**
  - "reserva alheia vigente … sem devolver o ponto gasto à toa" roda com o limite alto e não confere o ponto (`cenarios.md:53-54` pede o ponto devolvido também no link da conta);
  - o caso do link na API cita "token só depois do `#`", mas quem prova o `#` é `mensagem-do-link-da-conta.test.ts`, que a coluna "Caso" deveria citar.
- **Seguro em memória do "esqueci" e Redis fora no job do link:** sem caso, com o motivo escrito. Fica para a Mesa decidir, como o próprio documento pede.
- **Expurgo de 30 dias:** a borda do vencido é de um dia (29 dias fica, 31 sai). Um par "30 dias − 1 h / 30 dias + 1 h" também para o `expira_em` deixa a borda tão justa quanto a do `usado_em`.

Arquivos citados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tasks/prd-acesso-e-convites/5_task.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/tenant/tenant-resolution.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/queue/job-outbox.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/email/envio.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/retencao/expurgo-de-acesso.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/test/senha-esqueci.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/worker/test/enviar-email-da-conta.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/worker/test/expurgo-de-acesso.int.test.ts`

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-08 02:42:32 · `tasks/prd-acesso-e-convites/5_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nem migration nova desde a rodada 1. `link_da_conta` não mudou e segue ligada à conta global, sem `escolaId`, como foi aprovado na rodada 1.

Queries verificadas:
- `TenantResolutionRepository.cancelarLinksAbertos` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/tenant/tenant-resolution.repository.ts:383-394`): o código não mudou e continua filtrando por `contaId`, `finalidade` e `usadoEm is null`.
- `usuariosAtivosDaConta(..., { comSuspensos: true })` (`tenant-resolution.repository.ts:136-95` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/senha/senha.service.ts:102,152`): o código é o da rodada 1. O docblock agora documenta o segundo uso. O `@Unscoped` continua com justificativa escrita.
- Registro `senha.redefinida` por escola (`senha.service.ts:158-160`): cada registro é gravado com o `escolaId` daquela escola e leva só ids.
- `JobOutboxRepository.inserir` e `SISTEMA_DA_REQUISICAO` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/queue/job-outbox.repository.ts:16,84`): a lista continua fechada e agora tem o tipo `JobType`. O job `sistema.*` vindo de requisição continua nascendo com escola nula, e há mutação registrada que prova isso.
- `enviar-email.ts`: a única mudança é o número de tentativas por destino, sem efeito no escopo.
- O log `senha.link_na_fila` leva só o `linkId` (UUID). O teste confere que conta, e-mail e token não aparecem no log.

Teste de isolamento: presente e efetivo.
- "o 'esqueci' de uma conta não cancela o link aberto de outra" quebra se a cláusula `contaId` sair de `cancelarLinksAbertos`. A mutação está registrada no documento da tarefa.
- "o token de outra finalidade não serve" quebra se a cláusula `finalidade` sair.
- "Exatamente dois registros da conta no total" agora pega um `senha.redefinida` gravado numa terceira escola.

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/worker/test/enviar-email-da-conta.int.test.ts:17` importa `TenantResolutionRepository` direto de `apps/api/src`. Usar o método real é melhor do que a cópia em SQL que havia antes, mas o teste do worker passa a depender do código da API. Quem cuida das camadas deve conferir se `tools/guardas/camadas.cjs` aceita essa dependência só em teste.
- O caso da eliminação agendada (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/test/senha-esqueci.int.test.ts`, it "a eliminação agendada numa escola...") prova que o registro vai para a escola da eliminação. Ele ganharia uma linha conferindo que o login por e-mail naquela escola continua dando `ACESSO_SUSPENSO` depois da redefinição. Hoje isso só está no comentário.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-08 02:43:04 · `tasks/prd-acesso-e-convites/5_task.md`

VEREDITO: APROVADO

Esta foi a 2ª rodada. Auditei o diff `e0797a11..88e83d9e` e o que ele afeta. A 1ª rodada não exigiu nenhuma correção, então não havia correção a conferir.

Campos pessoais tocados: nenhum campo novo. O diff só mexe em como se usa o `link_da_conta`, que tem conta da equipe, hash do token, token e endereço cifrados. Esse campo já foi aprovado na 1ª rodada e está em `docs/lgpd.md:79` com finalidade e retenção.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok.
- Dois casos novos provam o recorte do link por conta e por finalidade em `apps/api/test/senha-esqueci.int.test.ts`. O "esqueci" de uma conta não cancela o link aberto de outra. O token de `verificar` não redefine a senha, responde 404 e nem chega ao argon2.
- Cada caso tem a sua mutação no `5_task.md`, que tira o `contaId` ou a `finalidade` do `where`.
- O token de outra finalidade recebe o mesmo 404 do token inexistente.

Logs: limpos.
- `apps/api/src/sessao/senha/senha.service.ts:130` agora grava `{ evento: 'senha.link_na_fila', linkId }` pelo logger JSON, só com id.
- O teste confere que o `linkId` aparece no log e que o id da conta, o e-mail (nas duas caixas), o e-mail sem conta e o token não aparecem. Há uma mutação que tira o `linkId`.
- O logger chega por `sessao.module.ts` e `app.module.ts`. Em produção é o mesmo `createLogger` do `main.ts`.

Auditoria: presente.
- O `senha.redefinida` é gravado uma vez por escola da conta. Um caso novo confere que são exatamente dois registros no total, nenhum numa terceira escola.
- A eliminação agendada (`comSuspensos`) já estava no código da 1ª rodada. Agora tem teste: o registro vai também para a escola da eliminação, com `entidade_id` igual ao id do usuário, só com ids. O login continua barrado ali, pelo `ACESSO_SUSPENSO`.

Envio externo: nenhum envio a provedor de IA.
- O e-mail do link continua saindo pelo SMTP de antes, já aprovado.
- `enviar-email.ts:373` passa a ler as tentativas da definição de cada job (`destino.tentativas`). Não muda o que é enviado.
- Um caso novo cobre o link cancelado durante a resposta 4xx. A linha continua `cancelado`, os cifrados ficam nulos e a tentativa seguinte não envia nada, de modo que o endereço não volta para a fila.

Seed/fixture: sintético.
- `linkDeVerificar` grava um token aleatório e `'\x01'` nos cifrados.
- As pessoas e escolas vêm das fixtures sintéticas de sempre.

Ciclo de vida: `expurgo-de-acesso.int.test.ts` ganhou o limite de 30 dias para o link vencido sem uso, com uma hora de folga para cada lado. Há uma mutação que troca o `coalesce(usado_em, expira_em)` por só `expira_em`. A retenção de 30 dias continua provada.

`job-outbox.repository.ts:562`: a lista `SISTEMA_DA_REQUISICAO` agora é tipada com `JobType`, então um nome errado deixa de compilar. A mutação do job nascer com escola mantém o job do link com escola nula.

Pergunta de fechamento: o diff não muda a resposta da 1ª rodada. O link da conta está no mapa de dados, sai pelo expurgo e é gravado em auditoria por escola, só com ids.

Bloqueantes: nenhum.

Recomendações:
1. `apps/api/src/sessao/senha/senha.service.ts:163`: o `senha.redefinida` ainda sai pelo `Logger` do Nest, sem id. Não vaza nada. Passar para o logger JSON, com o `linkId`, deixaria o rastro igual ao do `senha.link_na_fila` e ligaria o pedido à troca da senha.
2. A eliminação agendada agora recebe `senha.redefinida` mesmo depois de agendada. Vale confirmar, na tarefa que mexer na eliminação, que esses registros posteriores ao agendamento são tratados quando a eliminação se cumpre, como pede a D85.
3. A recomendação da 1ª rodada (o piso de 400 ms não cobre a resposta 500 quando a conta existe) foi registrada no `TODO.md` com motivo, e ficou de fora com razão. Continua anotada para a validação.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/senha/senha.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/test/senha-esqueci.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/worker/src/processors/enviar-email.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/worker/test/enviar-email-da-conta.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/queue/job-outbox.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/docs/lgpd.md

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-08 02:43:07 · `tasks/prd-acesso-e-convites/5_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. O diff desta rodada (`e0797a11..88e83d9e`) não toca `Nota`, correção nem schema de avaliação. Os caminhos que mudaram são o "esqueci a senha" e o "redefinir" da equipe, o job `sistema.enviar-email-da-conta` e o expurgo de `link_da_conta`. Todos com autor humano? Não se aplica, porque nenhum deles grava nota.

Decisão autônoma sobre aluno: ausente.

Aprovação registrada: ok. A tarefa não tem saída de IA. A exceção do tutor (D47) não aparece em nenhum outro fluxo.

Supervisão do tutor: ok. O tutor não foi tocado.

Autonomia declarada e visível: sim, sem mudança. Nenhum agente foi criado ou alterado.

**O que conferi nesta rodada**

- **`packages/core/src/queue/job-outbox.repository.ts:13-16`.** A recomendação da 1ª rodada foi atendida. `SISTEMA_DA_REQUISICAO` agora usa o tipo `JobType` (`as const satisfies readonly JobType[]`), e o comentário diz que um tipo novo que lide com IA, nota ou decisão sobre aluno passa por mim antes de entrar na lista. A lista continua fechada num só tipo, `TIPO_ENVIAR_EMAIL_DA_CONTA`. Trocar `includes` por `some` não muda o comportamento, e o bloco de mutação foi refeito para a linha nova.
- **`apps/api/src/sessao/senha/senha.service.ts:121-130`, `apps/api/src/sessao/sessao.module.ts`, `apps/api/src/app.module.ts`.** O evento `senha.link_na_fila` agora leva só o `linkId`, que é o id de um link da conta da equipe e não diz nada de aluno. O teste confirma que o id aparece no log e que conta, e-mail e token não aparecem. Não há inferência de comportamento nem métrica sobre o professor (item 9). É só a correlação técnica de um envio.
- **`tenant-resolution.repository.ts:136-142`.** Só o comentário mudou. O caso novo da eliminação agendada no "esqueci" grava `senha.redefinida` só com ids. Isso é registro de segurança da conta e não toca a regra 70.
- **`enviar-email.ts`.** Agora cada job lê as próprias `tentativas`, e a descrição da métrica foi corrigida. É mudança operacional, sem efeito sobre o aluno.
- **Testes novos** (`senha-esqueci.int.test.ts`, `enviar-email-da-conta.int.test.ts`, `expurgo-de-acesso.int.test.ts`). Cobrem o piso de tempo, a finalidade do link, o seguro com o Redis fora, a corrida entre dois "redefinir" e a borda do expurgo. Nenhum mexe com nota, IA ou trajetória de aluno.

Bloqueantes: nenhum.

Recomendações:
- O comentário de `SISTEMA_DA_REQUISICAO` (`job-outbox.repository.ts:13`) depende de alguém se lembrar de chamar o revisor. Um teste que falhe quando a lista ganhar um segundo tipo transformaria esse aviso em trava. Pode ir para a retro e não bloqueia.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/.processo/ordens/diff-5_task-r2.txt
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/queue/job-outbox.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/senha/senha.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/sessao.module.ts

## revisor-geral · 2ª rodada · APROVADO · 2026-11-08 02:43:24 · `tasks/prd-acesso-e-convites/5_task.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok

Portão local: carimbo válido. O `conferir` respondeu "portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)".

Bloqueantes: nenhum.

A rodada anterior não exigiu correções. O que este diff muda está dentro da 5.0:
- O `senha.link_na_fila` agora sai pelo logger JSON com o `linkId`. O logger é passado como já se faz no `AppModule` para os outros módulos (`opcoes.logger ?? createLogger(...)`), e o `main.ts` já o entrega.
- As `tentativas` do envio passaram a ser lidas da definição de cada job.
- `SISTEMA_DA_REQUISICAO` agora é tipada com `JobType`.
- Entraram casos novos de teste, cada um com um bloco de mutação.
- A recomendação da Mesa sobre o seguro em memória com o Redis fora virou caso de teste e saiu do `--faltando`.

A tabela de cenários e as recomendações não aplicadas ficaram registradas no `5_task.md`, cada uma com destino ou motivo. O teste do worker importa `TenantResolutionRepository` de `apps/api`. O projeto já faz isso em outros testes do worker (`queue.fixture.ts`, `enviar-email.int.test.ts`), então não é um segundo jeito de fazer a mesma coisa.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/senha/senha.service.ts:79` e `:163`: o serviço agora usa dois loggers. O `senha.link_na_fila` vai pelo logger JSON das dependências, e o `senha.redefinida` ainda vai pelo `Logger` do Nest (`#logger`). Vale levar o `senha.redefinida` para o mesmo logger e remover o `#logger`, para o rastro do "esqueci" e do "redefinir" sair no mesmo formato.
- O "esqueci" e o "redefinir" incluem o usuário com eliminação agendada (`comSuspensos: true`), e o `senha.redefinida` é gravado também na escola da eliminação. Esse comportamento já vinha da 1ª rodada; esta rodada só o documentou no docblock de `tenant-resolution.repository.ts:136` e o provou no caso novo. Ele não aparece na `techspec.md` nem no `cenarios.md`. Vale registrá-lo lá, porque é uma decisão sobre dado de pessoa em processo de eliminação. Pode ficar para a validação da funcionalidade.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/test/senha-esqueci.int.test.ts`, caso "o piso desconta o trabalho já feito": o espião em `WindowCounter.prototype.somar` supõe exatamente duas chamadas por pedido (o `PISO_MS - 150`). Se um terceiro contador entrar no "esqueci", o caso quebra por um motivo que não é o piso. Uma saída é fazer o relógio andar num ponto só do pedido.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-08 02:43:53 · `tasks/prd-acesso-e-convites/5_task.md`

VEREDITO: APROVADO
Caminho quente tocado: login (o "esqueci a senha" e o "redefinir" da equipe), fila
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica (a 0043 não mudou nesta rodada)
Métrica e alerta: ok
Bloqueantes: nenhum

Nesta rodada auditei só o diff de `.processo/ordens/diff-5_task-r2.txt` e o que ele afeta. Conferi que os arquivos de código e de teste do diff estão iguais ao snapshot `88e83d9e`, e o `tsc --noEmit` de core, api e worker passa. A rodada anterior não exigiu correção, então não havia correção a conferir.

- **Limite com o Redis fora.** O caso novo "os baldes do 'esqueci' caem para o seguro" sobe 4 instâncias, trava o Redis e mostra que só um pedido por hora abre link. Isso prova que o limite se divide pelas instâncias. A mutação `valor > limite` está listada.
- **Corrida no "redefinir".** O caso de dois "redefinir" agora força a ordem. O primeiro pedido para no argon2 e o segundo troca a senha antes. Fica provado que o `usado_em is null` dentro da transação barra o primeiro, em vez de depender de quem chega primeiro no `Promise.all`.
- **Cancelamento durante um 4xx.** O caso novo usa o `cancelarLinksAbertos` de verdade, não uma cópia em SQL. Ele mostra que o `devolver` com a reserva perdida não põe a linha de volta em `na_fila`.
- **Tentativas do job.** Cada job agora lê as tentativas da própria definição em `JOB_DEFINITIONS`. As do link da conta não dependem mais das do convite.
- **Log.** O `senha.link_na_fila` leva só o `linkId` e o teste prova que nenhum e-mail, token ou id de conta aparece. Isso segue a regra 20, item 9.
- **Lista de jobs de sistema.** `SISTEMA_DA_REQUISICAO` agora é tipada com `JobType`. Um nome errado na lista não compila mais.

Recomendações:
- `apps/api/test/senha-esqueci.int.test.ts:309-335`: o caso do seguro depende de o Redis ficar travado por 4 s enquanto três pedidos passam um depois do outro. Numa esteira lenta, o terceiro pedido pode chegar com o Redis já de volta. Vale prender o fim da trava à conclusão dos três pedidos, ou registrar o risco de o teste falhar de forma intermitente.
- O rótulo `classe` em `email_por_resultado`, para o alerta `educa-email-falhou` separar o link da conta, segue no `TODO.md` junto da 7.0. A descrição nova da métrica só deixa o problema visível, não resolve a separação.
- O contador `senha.esqueci.descartado` também segue no `TODO.md`. Às 10h, o balde cheio por IP numa escola só se percebe pelo log rarefeito.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/senha/senha.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/test/senha-esqueci.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/worker/src/processors/enviar-email.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/worker/test/enviar-email-da-conta.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/queue/job-outbox.repository.ts

## test-engineer · 2ª rodada · REPROVADO · 2026-11-08 02:45:21 · `tasks/prd-acesso-e-convites/5_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:** os da 1ª rodada, mais as cinco correções exigidas:
1. O termo `contaId` do `cancelarLinksAbertos`.
2. A `finalidade` no cancelar, no ler e no usar.
3. A escola nula do job pedido por requisição.
4. O `devolverLink` depois do cancelamento.
5. Os três SQL novos: a retomada da reserva vencida, o `criado_em` do fechamento e o `coalesce(usado_em, expira_em)`.

Também conferi o que o diff acrescentou: o `linkId` no log, o piso que desconta o trabalho, o seguro em memória com o Redis fora, a eliminação agendada, os dois "redefinir" em ordem forçada e as `tentativas` de cada destino.

**Cobertos:**
- **Correção 1, feita.** senha-esqueci › "o \"esqueci\" de uma conta não cancela o link aberto de outra…" tem o bloco que tira o `contaId`. Sem o termo, o link de B vira `cancelado` e o teste falha.
- **Correção 2, feita.** O link `verificar` é semeado no banco, e o caso "o token de outra finalidade não serve…" tem dois blocos:
  - um tira a `finalidade` do `cancelarLinksAbertos`: o link `verificar` sai `usado` e o teste falha;
  - outro a tira do `linkValidoPorHash`: o espião do `hash.gerar` acusa.
  O `usarLinkPorHash` ficou com o motivo de defesa repetida no `--faltando`, que era uma das duas saídas aceitas.
- **Correção 3, feita.** O bloco do `escolaId: contexto?.escolaId` usa o caso que enfileira com `escolaId` no contexto (senha-esqueci.int.test.ts:641) e confere `escola_id: null`. O motivo falso saiu, e o novo item do `--faltando` está correto.
- **Correção 5, feita.** Os três blocos chegam à cláusula:
  - na reserva vencida, a retomada adia e o `rodar(vencida)` rejeita;
  - no `criado_em`, o envio parado há 23 h sai;
  - no `coalesce`, o link "usado há 10 dias, vencido há 31" sai.
- **O que o diff acrescentou está provado:**
  - o `linkId` no log tem bloco e asserção;
  - o piso tem relógio que anda e o bloco da espera cheia;
  - o seguro tem o bloco do `insuranceLimit`;
  - os dois `comSuspensos` têm um bloco cada, mortos pela parte da "única escola agendada" e pelo laço das duas escolas;
  - os dois "redefinir" em ordem forçada são uma corrida de verdade, que o bloco do `usado_em is null` derruba;
  - "exatamente dois `senha.redefinida`" está conferido;
  - a borda de 30 dias do `expira_em` está nos dois lados;
  - os `vi.spyOn` são restaurados no `afterEach` (senha-esqueci.int.test.ts:87).
- **O que só tem motivo está bem justificado.** As `tentativas` de cada destino são uma mutação equivalente (os dois tipos têm 5 tentativas hoje), e o `logger ?? createLogger` é o padrão de produção (o `main.ts` passa o logger).
- **Tabela de testes:** cada linha cita casos que existem, inclusive a do `#` no e-mail.
- **Resto:** não há `.skip`, nenhum mock esconde a regra e não há IA na tarefa.

**Bloqueantes:**

1. **Correção 4 feita só em parte: o termo `eq(linkDaConta.envioReservadoEm, reserva)` do `devolverLink` e do `concluirLink` nunca é alcançado.**
   - Onde está: envio.repository.ts:144 (`devolverLink`) e :133 (`concluirLink`).
   - O que está errado: os blocos em 5_task.md:303-310 e 5_task.md:199-204 tiram os dois termos juntos, o `envio = 'enviando'` e a marca da reserva. Nos dois casos citados ("cancelado enquanto o servidor responde 4xx" e "[P] cancelado com o job na barreira") a linha está `cancelado`. Por isso o vermelho vem do termo `envio`, e o cenário não chega à marca da reserva: é vermelho pelo motivo errado. Tirando só a marca, os dois casos continuam verdes.
   - Por que importa: o termo protege um caso real, a reserva vencida que outro processo retomou. O processo antigo recebe um 4xx e devolve a linha a `na_fila`, apagando a reserva do novo. O `concluirLink` do novo deixa de casar, e a tentativa seguinte manda um segundo e-mail com o token. O convite tem esse caso: enviar-email.int.test.ts:334, "o desfecho é da reserva: `concluir` e `devolver` com a marca de uma reserva que outro processo já retomou não gravam nada". O link da conta não tem o equivalente.
   - Correção exigida:
     - um caso em `enviar-email-da-conta.int.test.ts`, no molde do :334: `reservarLink`, `envio_reservado_em` recuado 3 minutos, nova `reservarLink`, e então `concluirLink` e `devolverLink` com a primeira marca dão `false`, com a linha ainda `enviando` e os cifrados presentes; o `concluirLink` com a segunda marca dá `true`;
     - dois blocos que tiram **só** o `eq(linkDaConta.envioReservadoEm, reserva)`, um no `devolverLink` e outro no `concluirLink`, citando esse caso.
   - O bloco do `concluirLink` já existia na 1ª rodada, e eu não o acusei então. Junto aqui porque o mesmo caso conserta os dois.

**Recomendações:**
- **Folga do teste do seguro.** O caso "os baldes do \"esqueci\" caem para o seguro…" (senha-esqueci.int.test.ts:651) sobe a API com `montagem: {}`, sem o `pisoDoEsqueci`. Assim os três pedidos esperam o piso real de 400 ms, cerca de 1,8 s dentro da pausa de 4 s do Redis. Numa máquina lenta, o terceiro pedido chega com o Redis de volta e o caso fica vermelho à toa. Passar o `pisoDoEsqueci` do relógio falso tira 1,2 s e amplia a folga. O `CLIENT PAUSE ALL` é o mesmo do `password-attack`, então não é risco novo.
- **Asserção exata na "única escola agendada".** No caso da eliminação agendada, use `toEqual([sozinha.usuarioId])` filtrando pelo autor, em vez de `toContain`.

Não alterei nenhum arquivo nem rodei os testes. Os vermelhos dos blocos foram conferidos pelo portão da tarefa, como diz o documento.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/email/envio.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/worker/test/enviar-email-da-conta.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/worker/test/enviar-email.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tasks/prd-acesso-e-convites/5_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/test/senha-esqueci.int.test.ts

## revisor-geral · 3ª rodada · APROVADO · 2026-11-08 03:10:37 · `tasks/prd-acesso-e-convites/5_task.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok

Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")

Bloqueantes: nenhum

Recomendações: nenhuma nova. As da 2ª rodada estão na tabela "Recomendações sem aplicar" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tasks/prd-acesso-e-convites/5_task.md`, cada uma com destino. Uma delas continua aberta e precisa ser resolvida na validação: o `comSuspensos: true` do "esqueci" e do "redefinir" ainda não está na `techspec.md` nem no `cenarios.md`.

Nesta rodada li o diff `.processo/ordens/diff-5_task-r3.txt`, que muda só testes e o documento da tarefa, e conferi três pontos:

- **Os dois blocos de mutação novos:** o texto que eles tiram é igual às linhas de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/email/envio.repository.ts:133` (`concluirLink`) e `:144` (`devolverLink`). O caso novo "o desfecho é da reserva", em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/worker/test/enviar-email-da-conta.int.test.ts`, faz uma segunda reserva retomar a linha e depois tenta concluir e devolver com a marca da primeira. Os dois devem devolver `false` e a linha não pode mudar, então o caso fica vermelho quando a condição `envioReservadoEm = reserva` sai.
- **A equivalência declarada no `--faltando`:** está correta. O check `link_da_conta_reserva_so_enviando` existe na migration `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/drizzle/0043_link_da_conta.sql:29` e no schema `link-da-conta.ts:57`. Com ele, tirar só a condição `envio = 'enviando'` é mutação equivalente.
- **`senha-esqueci.int.test.ts`:**
  - A asserção da eliminação agendada agora exige que exista um único registro `senha.redefinida`, na escola `a`. Antes bastava um `toContain`, que é mais fraco.
  - O caso do seguro passou a receber `pisoDoEsqueci`, como os outros casos do arquivo. Ganhou também o `expect(voltou)`, que acusa a máquina lenta em vez de deixar o caso passar por acaso.

## test-engineer · 3ª rodada · APROVADO · 2026-11-08 03:11:06 · `tasks/prd-acesso-e-convites/5_task.md`

VEREDITO: APROVADO

Cenários exigidos (rodada 3): a correção 1 da 2ª rodada. Um caso em que `concluirLink` e `devolverLink` levam a marca de uma reserva que outro processo já retomou. A linha continua `enviando`, então só o termo `eq(linkDaConta.envioReservadoEm, reserva)` pode recusar a gravação. Além disso, um bloco de mutação que tira só esse termo em cada um dos dois métodos. Também conferi as duas recomendações passadas à Mesa.

Cobertos:
- **Correção 1 feita.** O caso "o desfecho é da reserva: …" está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/worker/test/enviar-email-da-conta.int.test.ts:289-306` e segue o molde pedido:
  - faz a primeira `reservarLink`, recua `envio_reservado_em` 3 minutos e faz uma segunda `reservarLink`;
  - confere que a marca nova é posterior à primeira;
  - `concluirLink` e `devolverLink` com a primeira marca dão `false`, e a linha continua `enviando`, com os cifrados presentes e `reservadoEm` igual à segunda marca;
  - `concluirLink` com a segunda marca dá `true` e apaga os cifrados.
- **A marca pode ser comparada por igualdade.** `reservarLink` grava `date_trunc('milliseconds', clock_timestamp())` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/email/envio.repository.ts:114`), então o `Date` do JS tem a mesma precisão do banco. O `false` vem da marca diferente, e não de perda de precisão.
- **Os dois blocos novos chegam cada um à sua cláusula** (`5_task.md`, logo depois do bloco do "cancelado enquanto o servidor responde 4xx"):
  - Sem a marca em `concluirLink` (`envio.repository.ts:133`), a chamada com a primeira marca grava e devolve `true`. O caso fica vermelho na linha 298.
  - Sem a marca em `devolverLink` (`envio.repository.ts:144`), o `concluirLink` intacto devolve `false`, mas o `devolverLink` grava e devolve `true`. O caso fica vermelho na linha 299.
  - As linhas de contexto (`.set(...)` e `.update(...)`) distinguem os dois `where`, que são idênticos.
- **A mutação equivalente está justificada.** Tirar só o `eq(linkDaConta.envio, 'enviando')` não muda nada, por causa do check `link_da_conta_reserva_so_enviando`. O motivo está escrito, e o par de termos segue provado contra o cancelamento pelos blocos antigos.
- **Recomendação da asserção exata, feita** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/test/senha-esqueci.int.test.ts:533-536`). O teste agora usa `toEqual([{ escola_id: a, entidade_id }])`, filtrando pelo autor. Um registro a mais, ou em outra escola, deixa o caso vermelho.
- **Recomendação do seguro em memória, feita** (`senha-esqueci.int.test.ts:654` e `:663-671`). O caso passa o `pisoDoEsqueci` com o relógio falso, então a folga de cada pedido deixa de ser tempo real. A margem também ficou explícita: três pedidos de cerca de 100 ms dentro de uma trava de 4 s. Se a máquina estiver lenta demais, o caso falha dizendo isso, em vez de passar ou falhar pelo motivo errado.
- **Os dois testes passam:** `enviar-email-da-conta.int.test.ts` com 16 de 16 e `senha-esqueci.int.test.ts` com 24 de 24.
- O diff não traz `.skip`, teste comentado, mock da regra testada nem provedor pago.

Bloqueantes: nenhum.

Recomendações:
- No caso novo, os dois `throw new Error(...)` de guarda (linhas 291 e 295) poderiam virar `expect(primeira.resultado).toBe('reservado')`, com o `if` só para estreitar o tipo, para a falha aparecer como asserção. Hoje funcionam do mesmo jeito.
