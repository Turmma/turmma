# Tech Spec — A equipe e o aluno entram sem depender de ninguém

**PRD:** `tasks/prd-acesso-e-convites/prd.md`
**Status:** do F2, separada em 03/11/2026; revista
**Depende de:** F2: o `travarPendente`, o `fechar('encerrada')`, o cadastro do professor, o `desativar` e os dois expurgos
**Cenários:** `tasks/prd-acesso-e-convites/cenarios.md`

## 1. Resumo da abordagem

O e-mail sai pela porta `EmailSender` (SMTP; D81), em job; a API grava token e endereço cifrados na
linha.

## 2. Módulos afetados

| Módulo | Novo ou alterado | O quê |
|---|---|---|
| `packages/core/src/cripto/` | movido | o `SecretCipher`, de `apps/api/src/credencial/` |
| `packages/core/src/convite/cancelar-envio.ts` | novo | o valor único (`CANCELAR_O_ENVIO_DO_CONVITE`) que a revogação, o refazer (`ConviteRepository`, da API) e a defesa do `desativar` gravam junto de `revogado_em`: o envio `na_fila` ou `enviando` vira `cancelado`, sem cifrados nem reserva; as outras três cópias da regra não existem |
| `packages/core/src/email/` | novo | porta `EmailSender`, adaptadores `SmtpEmailSender` (`nodemailer`, sem `logger` nem `debug`) e `FakeEmailSender`; `EnvioRepository`; fora do ambiente local, `EMAIL_PROVEDOR_ID` e TLS obrigatórios, e o Mailpit recusado (como a `IA_PROVEDOR_ID`) |
| `apps/api/src/professores/`, `sessao/`, `sala/`, `credencial/` | alterado | rotas; seção 5. A provisória mora em `credencial/` |
| `packages/core/src/queue/` | alterado | o job de sistema que nasce de requisição (seção 6) |
| `apps/worker/src/processors/`, `apps/worker/src/job-executor.ts` | alterado | `enviar-email.ts`, os dois expurgos, a saída de adiar (seção 5) |
| `packages/core/src/titular/leitura-do-titular.ts` | alterado | a leitura por alvo da D85 (seção 5, "Arquivo do titular") |
| `apps/api/src/sessao/convite/convite-ticket.ts` | alterado | o bilhete do convite aceito tolera até `TICKET_CLOCK_TOLERANCE_SECONDS` (30 s) de relógio atrasado em quem confere, e o prazo de 30 min segue exato: o `jose` recusa o `iat` no futuro, e o login seguia sem ativar o usuário (achado ao estabilizar os testes de integração da tarefa 1.0, que o recuo do relógio da máquina de desenvolvimento derrubava) |
| `packages/core/src/ciclo-de-vida/` | alterado | o `desativar` anula a provisória; a cláusula de defesa (`revogarConviteAberto`) também cancela o envio |
| `apps/api/src/sessao/convite/convite-de-professor.service.ts`, `convite.repository.ts`; `packages/core/drizzle/` | alterado | o "Corrigir o e-mail" (seção 5) e a migration que recria o `auditoria_por_alvo_idx` com sete ações (tarefa 18.0) |
| `packages/shared/`; `apps/web`, `compose.yaml` | alterado | contratos novos e alterados (seção 4) e os códigos `ENTRA_PELA_CONTA_DA_ESCOLA` e `VERIFICACAO_PENDENTE`; seção 9; `mailpit`, com a interface só em `127.0.0.1` |

## 3. Modelo de dados

```
link_da_conta        id uuidv7, contaId* (on delete cascade), finalidade (redefinir|verificar), tokenHash único, tokenCifrado?,
                     destinoCifrado?, expiraEm, usadoEm?, envio, criadoEm; único parcial (contaId, finalidade) aberto;
                     índice (coalesce(usadoEm, expiraEm))
convite              + canal text not null default 'copiado' (check copiado|email), tokenCifrado?, destinoCifrado?, envio?, envioReservadoEm?,
                     enviadoEm?, criadoEm timestamptz not null default now(); índice parcial (escolaId, criadoEm) onde envio na_fila|enviando
conta                + emailVerificadoEm?
credencial_matricula + provisoriaHash?, provisoriaExpiraEm?, provisoriaGeradaPor? (set null); índice parcial (escolaId, provisoriaExpiraEm)
reivindicacao        + contaExterna jsonb? (provedor, tenant, sujeito); único parcial (escolaId, provedor, tenant, sujeito) onde pendente
auditoria            + índice parcial (escolaId, entidadeId, em) nas ações da lista por alvo (seção 5), como o 0034; a 18.0 o recria com a sétima
                     (`usuario.email_corrigido`): índice novo com as sete, depois o `drop` do de seis, na mesma migration, como a 0046
usuario              sem coluna nova: o `contaId` do professor muda só no "Corrigir o e-mail" (seção 5)
```

`envio`: `na_fila|enviando|enviado|falhou|cancelado`, com `envioReservadoEm`. Cifrados: AES-GCM, chave `EMAIL_TOKEN_KEY`, o
id da linha como dado autenticado, presentes em `na_fila` e `enviando` e nulos fora deles (o check `convite_cifrados_so_no_envio_aberto`, escrito
com `case when`: um `or` com `envio` nulo deixaria o convite `copiado` passar com cifrados). `criadoEm` conta as 24 h do expurgo do envio parado. O check `reivindicacao_segredo_so_pendente` vira
(`not valid` + `validate`): pendente ⇔ chave e marca presentes e exatamente uma de senha ou `contaExterna`; fora do
pendente, as quatro nulas; o `fechar('encerrada')` do F2 passa a anular também a `contaExterna`. Migrations só expandem;
voltar a versão: o runbook encerra, sem decisão, os pedidos de conta pendentes e devolve o nome à lista.

## 4. API

| Método | Rota | Papel | Entrada | Saída |
|---|---|---|---|---|
| POST | `/v1/professores/convites/enviar` | coordenador | `{ usuarioIds? }` | contagem |
| GET | `/v1/usuarios/:usuarioId/senha-provisoria` | coordenador; professor da turma | — | `{ nome, turma, matricula, entraPelaContaDaEscola }` (divergência da 12.0, opção A) |
| POST | `/v1/usuarios/:usuarioId/senha-provisoria` | coordenador; professor da turma | — | `{ senha, expiraEm }` |
| POST | `/v1/sessao/matricula/trocar-senha` | bilhete no `Authorization` | `{ senha }` | sessão |
| GET | `/v1/sessao/matricula/trocas` | bilhete no `Authorization` | — | até 10 provisórias anteriores: data, papel, se usada |
| POST | `/v1/professores/:usuarioId/email` | coordenador (`professor.corrigir_email`, célula nova: `unidade` na coordenação, `nunca` nos outros) | `{ email }` (o `emailConvidadoSchema` do cadastro, estrito) | a do refazer, `{ usuarioId, conviteId, token }`, com `no-store` |
| POST | `/v1/senha/esqueci`, `/redefinir`; `/v1/conta/verificar` | anônimo | `{ email }`; `{ token, senha }`; `{ token }` | 202; 204; 204 |
| GET | `/v1/sessao/externa/:provedor/iniciar?intencao=reivindicar\|ligar` | a rota que existe | — | redirecionamento |

Mudam: login de matrícula (`trocar_senha`), aceite (`VERIFICACAO_PENDENTE`), `GET /v1/professores`
(`envio` e `enviadoEm`, ISO nulável, sempre no corpo e só não nulo com `envio = 'enviado'`: o "Enviado em 12/11 às 14:05" da tela, no fuso da escola; divergência da 4.0), `externa/iniciar` (`intencao`), pedido de nome (conta provada).
"Enviar", "Reenviar" e o "Copiar link" fazem o `convite/refazer` (linha nova). Links com o token no fragmento; provisória (a leitura do alvo e a geração),
troca e `/trocas` com `no-store`.

## 5. Fluxo

**E-mail.** `email.enviar-convite` leva a escola do convite no registro do job e lê o convite por id e escola.
`sistema.enviar-email-da-conta`, de escola nula, lê e grava o `link_da_conta` só no `EnvioRepository`,
`@Unscoped` (conta global, lida pelo id do job). Os dois consomem o `EMAIL_POR_MINUTO` (global, com metade
reservada ao link da conta), atômico no Redis de fila, sem o seguro em memória; estourado ou Redis fora, adia, nunca
envia sem contar. Adiar libera a vaga, volta a `publicado`, não conta tentativa nem uso, e espera o `msBeforeNext` ou o
prazo da reserva (Redis fora: 30 s), mais até 5 s sorteados. Ponto sem envio volta. O teto é `EMAIL_POR_MINUTO` (padrão 60),
em janelas fixas de um minuto de calendário, lidas do `TIME` do Redis; o convite usa até `N − ⌊N/2⌋` por minuto e o resto
fica ao link da conta; o ponto volta só na janela em que foi gasto (`LimiteDeEmailPorMinuto.devolver`). O job gasta o ponto
**antes** de reservar a linha, e o devolve se a reserva é alheia, o envio já terminou, o convite não é da escola, a cifra não
decifra ou o banco falha; a tentativa que falou com o servidor (aceita, recusada ou caída) o gastou. A saída de adiar é do
`JobExecutor` (`JobAdiadoError`; `devolverAoPublicado`, `ativo` → `publicado`), e o uso (`jobs`) passa a ser contado **ao
fim** da tentativa, salvo a adiada, que não fez o trabalho. `devolverAoPublicado` entra em `REPOSITORIES_SEM_ESCOPO` (`tools/guardas/escopo-dos-repositories.ts`) como os irmãos `concluir` e `registrarFalha`. O alerta `educa-email-falhou` entra em `REGRAS_PROVISIONADAS` (`infra/scripts/ensaio-alertas.ts`), e `email.envio` e `email.adiado` têm um gráfico cada no painel `fundacao.json`. Depois reservam a linha numa transação curta (`enviando`, hora,
cifrados); reserva alheia vigente: adia até o prazo. Enviam fora dela (timeout de 10 s) e
gravam `enviado`, cifrados nulos, `where envio = 'enviando' and envioReservadoEm = :minha`. Revogação, link novo (refazer,
"esqueci", verificar) e a defesa do `desativar` gravam `cancelado` na hora: o link que sair não vale. SMTP 5xx: `falhou`; 4xx ou queda: devolve a linha a
`na_fila` (mesma condição) e tenta de novo, depois `falhou`. Morto após enviar: reenvia (D49).

| Estado | Entra | Sai | Prazo e falha |
|---|---|---|---|
| envio `na_fila`, `enviando` | enviar, refazer, esqueci, aceite pendente; a reserva | o job de e-mail | reserva de mais de 2 min volta a ser retomada; mais de 24 h: o expurgo grava `falhou` e anula os cifrados (até ~48 h) |
| `enviado`, `falhou`, `cancelado` | o job; a revogação ou o link novo, na hora | — | o do convite ou do link |

Expurgos (`skip locked`): convite parado e provisória vencida, `retencao.expurgar-escola`; `link_da_conta`, `sistema.expurgar-acesso`.

**Enviar.** A cota de 300/h consome, de uma vez e atômico, um ponto por convite que entra (pendente ou vencido); o lote
recusado e a transação desfeita devolvem os pontos. Limitador novo, no Redis de fila, janela de 1 h; Redis fora: seguro
em memória, 300 ÷ instâncias.

**Posse do e-mail.** O aceite de convite por e-mail grava `emailVerificadoEm`. Conta com senha e sem verificação que
aceita convite copiado de outra escola (o do painel também): `VERIFICACAO_PENDENTE` e link de `verificar` (24 h) no lugar
do aberto, como no "esqueci", com teto de 3 por hora por conta, que rebaixa. Verificada, o aceite segue. Redefinir
também verifica. "De outra escola" é a conta ter usuário, em qualquer estado (o convite o cria inativo), em escola diferente
da do convite; a conta nova, que define a senha no próprio aceite, não cruza nada. O aceite que perde a corrida da senha
para o convite de outra escola da mesma conta relê a posse dentro da transação e, se agora cruza sem ela, desfaz o uso do
convite e responde `VERIFICACAO_PENDENTE`. O pedido do link é do `SenhaService.pedirVerificacao`, fora da transação do
aceite (o 23505 do índice único aborta a transação em que cai), e a resposta é a mesma com link novo ou sem ele. O link de
verificar vale também para a conta cujo único usuário espera um convite válido (o professor que saiu da A com o convite da
B já emitido): enquanto o convite vale a conta não é limpa (`limparContaSemUso`), e o `/v1/conta/verificar` usa o mesmo
critério de "a conta serve", grava a posse e, sem usuário ativo, nenhum `conta.email_verificado` (ver "Auditoria"). Sem
usuário ativo nem convite válido: link inválido.

**Esqueci.** 202 igual, piso de 400 ms, também no perdedor do índice único; conta ativa ganha link (1 h). Redefinir
confere o token antes do argon2, troca a senha com a conta travada, encerra as sessões e verifica o e-mail; o MFA fica.

**Senha provisória.** Oito caracteres de `23456789ABCDEFGHJKMNPQRSTUVWXYZ`, em dois grupos. Gerar trava a linha do usuário do aluno
(a mesma do "ligar"; na aprovação, decide a `conta_externa` única), confere o escopo e a conta ligada, e só então apaga `senha_hash` e a
provisória anterior, encerra as sessões e audita (papel de quem gerou no `depois`); conta da escola ligada:
`ENTRA_PELA_CONTA_DA_ESCOLA` (PRD §7). Provisória não usada de menos de 10 s, de qualquer autor: `CONFLITO` (a hora da geração é `provisoria_expira_em` menos 24 h, pelo relógio do banco; as sessões caem com o motivo `senha_redefinida`). O hash passa pelo semáforo do argon2. O login com a provisória devolve
`{ etapa: 'trocar_senha', bilhete }`: JWT assinado (`jose`, `aud` própria, não o desafio), de 10 min, com a escola, o aluno e a
`provisoriaExpiraEm` (identifica a provisória sem ser segredo); vai no `Authorization`, nunca na URL. `trocar-senha`
e `/trocas` rodam em `naEscolaSemUsuario` com a escola do bilhete, com escopo no repository; qualquer outra falha, inclusive aluno só com conta externa (contra um hash fixo, no mesmo tempo), é a credencial
inválida. `/trocas` lista as 10 provisórias anteriores à que o aluno acabou de usar (a mais recente, a de agora, fica de fora): data, papel de quem
gerou, se usada. A troca é `update … where id = … and provisoria_expira_em = :doBilhete and provisoria_expira_em > clock_timestamp()` (o relógio do banco no instante da gravação, não o da transação) e o aluno ainda ativo, sem desativação nem eliminação agendada (`exists` no próprio `update`, além da conferência anterior);
zero linhas, recusa. A troca e o `desativar` anulam as três colunas. A provisória se digita como a tela a mostra: o login de matrícula tira o hífen e os espaços e põe em maiúsculas antes de comparar, e só quando o hash que confere é o da provisória (a senha comum vai como veio). `trocar-senha` conta no mesmo contador de falhas da conta que o login (chave `escola|matrícula`, `conhecido` ou `outro` pelo cookie do dispositivo): a tentativa conta antes de a senha nova ser aceita, a troca certa zera, e o hash da senha nova só se faz para bilhete que vale. O `senha_provisoria.usada` (autor o aluno, sem `depois`) é gravado na mesma transação da troca. `/trocas` lê a auditoria do aluno (60 registros no máximo) pelo índice da escola até a 11.1 criar o índice parcial por alvo.

**O alvo da provisória** (divergência da 12.0, opção A, escolhida pelo Joaquim em 09/11). A confirmação precisa da matrícula, e nenhuma
leitura a entrega à web: `GET /v1/usuarios/:usuarioId/senha-provisoria` devolve um aluno por vez, `{ nome, turma, matricula, entraPelaContaDaEscola }`.
Mesma célula da matriz (`senha_provisoria.gerar`) e mesmo escopo da geração, pela mesma seleção do repository (`#alunoQueAlcanca`, sem trava): quem não
alcança o aluno, e o aluno sem credencial nem conta da escola ligada, recebe o `NAO_ENCONTRADO` do inexistente. `turma` é o nome da turma do vínculo
`confirmado` do aluno no ano em curso (nula sem ano em curso, só para a coordenação, que alcança sem ele); `matricula` é a da `credencial_matricula`
(nula no aluno só com a conta da escola); `entraPelaContaDaEscola` diz, antes de confirmar, o que a geração responderia com `ENTRA_PELA_CONTA_DA_ESCOLA`.
Nunca hash, provisória, validade, quem gerou nem e-mail. Sai com `no-store`, não gasta cota nem trava linha. A leitura pela coordenação grava
`senha_provisoria.alvo_lido` (entidade `usuario`, `entidadeId` o aluno, sem `antes` nem `depois`, finalidade fixa escrita pelo servidor,
`FINALIDADE_DA_LEITURA_DO_ALVO`; regra 20, item 10), na mesma transação da leitura; a do professor com vínculo na turma do aluno não grava, como a leitura
dos alunos da turma. A `.alvo_lido` é leitura, não ato sobre o titular: fica fora da lista por alvo do arquivo (sem migration) e, como a `.gerada`, fora do arquivo de
quem a assina (o `entidade_id` é o do aluno).

**Arquivo do titular (D85).** A leitura por alvo traz, numa lista fechada, `aluno.transferido`, `lista.transferida`,
`usuario.nome_corrigido`, `lista.nome_corrigido` (o `lista_nome` só com o nome aprovado, pelo `alunoId` da decisão),
`senha_provisoria.gerada` e `.usada`, e `usuario.email_corrigido` (18.0: muda o dado de login do professor): ação, entidade, finalidade, data e o papel de quem fez; nunca o id nem o nome do
autor, o `antes` ou o `depois`, nem as leituras. O papel é fixo por ação nas quatro da F2 e na `usuario.email_corrigido` (coordenação) e vem do `depois` na
`.gerada`; a `.usada` sai uma vez, com o papel `aluno` (ele a assina e é o alvo: as duas leituras a trazem, e a por alvo vence pelo `id`). O papel sai escrito como o aluno o lê: `coordenação`, `professor` ou `aluno`. A leitura do arquivo de quem **assina** (`auditoria`, `autor_usuario_id`) deixa a `senha_provisoria.gerada` de fora: o professor a assina e o `entidade_id` é o do aluno.

**Corrigir o e-mail** (validação, maior 1; opção (b), escolhida pelo Joaquim em 10/11). O e-mail mora na `conta` global, e revogar e
cadastrar de novo criaria outro `usuario`, deixando no revogado os vínculos `pendente` e as aulas que a grade ou a planilha (F2) e o
"Acrescentar turma" deram a ele. Por isso o `usuario` **troca de conta** e fica com o id, os vínculos e as aulas. Numa transação, em
`convite-de-professor.service.ts` (em `sessao/`, o único lugar que chama o `contaDoProfessor`), nesta ordem: (1) a trava do convite da
escola e o estado pelo `professorSobATrava`, como o refazer: inexistente, de outra escola, de outro papel ou sem convite de professor,
`NAO_ENCONTRADO`; fora de `pendente` e `vencido` (a matriz nova `CORRIGIR_EMAIL_DO_PROFESSOR_POR_ESTADO`, igual à do refazer),
`CONFLITO`; (2) **quem já entrou não troca**: algum convite de professor do usuário com `usadoEm` (o professor desligado e chamado de
volta) é `CONFLITO`, porque o usuário dele tem conversa com o chat, registro de aula e auditoria assinada, que passariam à dona do
e-mail novo; (3) só então a conta do e-mail novo, achada ou criada pelo `contaDoProfessor`, que não diz se ela era nova (E11): nada de
conta antes de o escopo e o estado passarem; (4) o `update` condicional do `ConviteRepository` (`trocarContaDoProfessor`), com a escola
do contexto, `papel = 'professor'`, `desativadoEm` não nulo e `contaId` diferente da nova (o mesmo e-mail é `CONFLITO`); zero linhas,
`CONFLITO`; o `usuario_escola_conta_papel_unico` decide o e-mail que já é de outro professor desta escola, em qualquer estado: o 23505
vira `CONFLITO` e a transação volta, levando a conta criada; (5) o `refazerSobATrava` de sempre: o convite antigo é revogado, o envio
dele que não saiu vira `cancelado` (`cancelar-envio.ts`), e nasce um convite `copiado` com token novo e a validade de 7 dias do professor (`convite.refeito`); (6)
`usuario.email_corrigido`. A resposta é a do refazer: o link sai uma vez, e "Enviar por e-mail" é o `convites/enviar` de um só, com
a cota de 300/h. Sem cota própria, como o cadastro e o refazer. **A conta antiga não é tocada**: pode ser de alguém de outra escola, e
mudar `conta.email` a partir de uma escola seria escrita fora do tenant. Sem usuário que a segure, ela cai na limpeza da madrugada que
já existe (`SEM_USO`, do `sistema.expurgar-acesso`). O link que já tinha ido ao endereço errado morre no passo (5), e o e-mail que está
saindo naquele instante (`enviando`) sai com um link que não vale. Nenhum dado novo é guardado, e nada entra em log além de ids.
A grade ou a planilha reimportadas com o e-mail antigo trazem esse professor como "novo" na prévia: o e-mail certo passa a valer
também para elas.

**Auditoria.** `convite.enviado` é gravado no pedido ("Enviar", "Reenviar"), autora a coordenação; o job só muda o `envio`. `senha.redefinida` e `conta.email_verificado` vindos de rota anônima gravam um registro por escola em que
a conta tem usuário ativo, com esse usuário como autor e alvo, na mesma transação, no contexto montado no próprio fluxo pelo `usuariosAtivosDaConta`
da conta do token; sem usuário ativo, nenhum. O aceite
de convite grava só na escola do convite.

**Conta da escola do aluno.** `intencao=reivindicar`, com o `token` do link ou o `codigo` da sala na query (a `intencao` de outro valor, ou o
token ou código sem ela, responde como o inexistente), resolve o acesso pela porta `SALA_PARA_A_CONTA`, que o `sala` implementa sobre o
`AcessoDaSala` (a `TenantResolutionRepository`, na escola do slug e no ano em curso, com o limite de código errado por escola do `salas/abrir`), e
o guarda no cookie OIDC (`acessoDaSalaId`). No retorno, com domínio liberado e conta sem ligação, ninguém é ligado, nem o professor pelo e-mail: grava
`educa_conta_provada` (como o `educa_oidc`, com dado autenticado próprio, mais `Path=/v1/salas` e 15 min; escola, acesso e conta, sem e-mail) e volta
a `/e/:slug/turma?conta=provada`; a conta ligada a usuário ativo entra como sempre, e o domínio não liberado, a conta pessoal e a ligada a desativado
são recusados como sempre. O pedido sem `senha` (o contrato a torna opcional) lê o cookie, confere escola e acesso contra os do acesso vigente (ausente,
vencido, adulterado, de outra escola ou de outro acesso: a mesma `ENTRADA_INVALIDA`, antes de qualquer contador), grava `contaExterna` no lugar do hash
(a invariante do `travarPendente` passa a senha ou conta) sem calcular hash, e responde apagando o cookie, também no reenvio; com `senha`, o cookie não é
lido. O pedido de conta recusado não conta no teto de hashes da turma. Aprovar cria o usuário sem senha e a `conta_externa`, na decisão, com a
auditoria `conta_externa.ligada` de quem aprova; conta já ligada a outro aluno: `CONFLITO` sem nome, a transação desfaz e o pedido segue pendente.
`intencao=ligar` exige sessão de aluno (15.0): o `iniciar` acha o aluno pelo cookie de renovação `educa_sessao` (só o refresh atual de uma sessão de aluno aberta na escola do slug;
sem cookie, vencido, encerrado, de professor, de coordenador ou de outra escola, responde como o inexistente) e o leva no cookie OIDC (`ligarAoAluno`, usuário e sessão), porque o
`educa_sessao` (`SameSite=Strict`) não vai na navegação que volta do Google. O retorno trava a linha do `usuario` (a mesma trava da provisória e da aprovação com conta), confere de novo
que a sessão vale (a provisória gerada antes a encerrou) e deixa os índices únicos de `conta_externa` decidirem: `ligada` (também a mesma conta já ligada a ele), `conflito` (conta de
outro aluno, ou aluno que já tem outra), `recusada` (domínio não liberado, conta pessoal ou sessão que acabou) ou `provedor` (a queda do provedor). Não abre sessão nem grava `login_falho`;
volta a `/aluno/eu?ligacao=<resultado>`, e a tela mostra o resultado e o tira da barra. A auditoria `conta_externa.ligada` tem o aluno por autor. **A conta é a de quem clicou:** o computador
compartilhado deixa a conta do colega aberta no Google ou na Microsoft, e a ligação não passa por professor, como a reivindicação (D4). Por isso, só no `intencao=ligar`, o endereço do
provedor pede a prova de novo, com `max_age=0` e `prompt` (`select_account` no Google, que mostra a lista de contas; `login` na Microsoft, que pede a credencial), e o login comum não leva
nenhum dos dois. Na volta, o `auth_time` do ID token, quando o provedor o traz, precisa ter até 120 s (`IDADE_MAXIMA_DA_AUTENTICACAO_S`); mais velho que isso é `recusada`. Limite conhecido: o
Google só traz `auth_time` com um ajuste do console dele, e nenhum dos dois provedores documenta o `max_age` com certeza; a claim ausente não recusa (o `prompt` do endereço é o que vale),
e exigi-la deixaria a ligação sem funcionar onde ela não vem. O dia em que a escola conferir que o provedor a traz, a claim passa a ser exigida (`TODO.md`).

## 6. Isolamento

Escola vem do contexto; no job, da linha, nunca do payload. Exceção cercada **por arquivo** nas duas guardas
(`ZONAS_DAS_CLASSES_CERCADAS` do `architecture.test.ts` e a regra nova `cerca-envio` de `tools/guardas/camadas.cjs`, com o
`EnvioRepository` no `to` e só `enviar-email.ts` fora; cada uma com fixture que reprova o arquivo vizinho) e no
`docs/modelo-de-dados.md`:
- `link_da_conta`: na API, o `TenantResolutionRepository` (pelo hash e pela conta, como o `codigo_recuperacao`); no
  worker, o `EnvioRepository` (pelo id do job), e o `falhou` de 24 h por um método novo do `ExpurgoDeAcessoRepository`, com `@Unscoped` próprio

O `JobOutboxRepository.inserir` aceita fora de rotina só a lista fechada `SISTEMA_DA_REQUISICAO`
(`sistema.enviar-email-da-conta`), sempre com escola nula, mesmo nascido no aceite; a requisição não ganha `rotinaDoSistema`.

## 7. Dado pessoal

| Item | Resposta |
|---|---|
| Campos | os da seção 3 e o cookie, no `docs/lgpd.md` |
| Log | ids e código; nunca e-mail, token nem resposta do SMTP |
| Auditoria | tabela RF17 do `cenarios.md`; escola e autor na seção 5 |
| Provedor externo | o de e-mail, `suboperador` antes do portão: só dado da equipe |
| Retenção e eliminação | `docs/lgpd.md`, contadores inclusive; autores `set null`; cifrados e `contaExterna` em `COLUNAS_FORA_DO_ARQUIVO`; a lista por alvo na seção 5 |
| DTO | nenhuma saída com cifrado |

## 7b. Conformidade CNE

Sem IA.

## 7c. Carga e falha

| Item | Resposta |
|---|---|
| Caminho quente | login: provisória e conta externa na rajada (`cenarios.md`) |
| Onde roda o [C] | na fase `professores` de `infra/scripts/carga-importacao.ts` (`infra/k6/importacao-7h30.js`), que já tem o job de 300 professores, o login deles e o passo (3): a fase ganha a rajada do F1 ao lado (`iniciarARajada`, como na `previa_e_gravar`, já com a provisória e a conta externa de `carga-login.ts`) e um cenário `redefinir`: o script semeia, pelo banco, um `link_da_conta` (`redefinir`, `hashDoToken`) por professor que já tem conta (o token só sai por e-mail, que a carga não lê) e o k6 usa cada um uma vez, com a senha da carga, para o login deles seguir valendo. O job, o login da equipe e o redefinir ficam dentro da janela da rajada. Critério: zero 503 no login (rajada e equipe) e no redefinir, todo redefinir em 204, passo (3) abaixo de 1 s; `carga-login.ts` e `carga-importacao.ts` com o teste de cada um |
| A sala com a conta da escola (16.0) | o cenário `infra/k6/reivindicacao-em-sala.js` (K1 e K2 da A1) lê os provedores em todo acesso e leva 1 aluno em 20 pela conta da escola (`oidc-falso`, um sujeito por aluno, `redirects: 0`, o cookie `educa_conta_provada` por VU), e a fase `k2_conta` é a escola da D48 (a conta da escola, quando ela existe): cerca de 85% pede pela conta e o aprovado entra pela conta (`iniciar`, `retorno` e `POST /v1/sessao/renovar`). No balde anônimo do IP da escola (`rl:ip`, o login por matrícula é o `rl:ip-login`, fora dele) a sala gasta 3 requisições por aluno pela matrícula e 9 pela conta; previsão do primeiro dia pela conta: cerca de 3.400 por minuto, e por isso `LIMITE_REQ_IP_ANONIMO_MIN` sobe de 3.000 para 6.000. O script de carga lê o pico do `rl:ip` no Redis e reprova acima de 80% do teto; zero 429 em todas as fases (`respostas_429`). `docs/infra.md` 5.1 e `docs/runbook.md` |
| Fila | `normal`: `email.enviar-convite`, `sistema.enviar-email-da-conta` (na vaga `vaga:normal:sistema`) |
| Limites e corridas | tabelas do `cenarios.md`; limite por usuário, escola ou conta, nunca só por IP; o que manda e-mail rebaixa |
| Dependência cai | SMTP: `falhou`, "Reenviar"; Redis: o job fica no Postgres e é retomado, sem `falhou` |
| Métrica e alerta | e-mail por resultado e adiamento; provisórias por escola; alerta com runbook: `falhou` acima de 20% em 1 h; adiamento longo: sem alerta próprio, visto no gráfico `email.adiado` do `fundacao.json` e na idade da fila `normal` (`job_espera_mais_antiga_s`), que o runbook manda ler (o alerta de idade, "Job interativo esperando", cobre só a `interativa`; regra da `normal` fica fora da F2c, Mesa da 2.0) |

## 9. Frontend

Estados e textos: `cenarios.md`, "Telas"; cada tela atualiza o `docs/interface.md` na sua tarefa.
Professores relê o envio a cada 5 s, só com a aba visível e linha `na_fila` ou `enviando`, e para depois de 5 min. O painel do professor `pendente` ou
`vencido` ganha **"Corrigir o e-mail"** (19.0): o diálogo pede o e-mail certo (o de hoje não aparece: a lista não traz e-mail, E8), e com o
`POST …/email` aceito mostra o link uma vez, com "Copiar link" e "Enviar por e-mail", que abre o diálogo do "Reenviar" (o link mostrado deixa
de valer). O `CONFLITO` relê a lista: se o professor saiu de `pendente` e `vencido`, vale o texto do convite que mudou; se não, o diálogo
fica aberto com o texto do e-mail que não serve; o `NAO_ENCONTRADO`, o do convite que mudou. A provisória fica no
menu da linha do aluno aprovado, na aba Alunos da turma. A confirmação lê o alvo (`GET …/senha-provisoria`, seção 5) ao abrir, fora do cache de
consultas, e o descarta ao fechar, com a senha; enquanto lê, "Gerar" fica ocupado, e o alvo que sumiu (404) fecha a confirmação com o aviso. O aluno que
entra pela conta da escola já mostra o aviso na confirmação, sem "Gerar". Na coordenação, a turma aberta (`ListaDaTurma`) ganha a seção **"Alunos
aprovados"**, lida de `GET /v1/turmas/:id/alunos?finalidade=conferencia_de_cadastro` (já auditada com `turma.alunos_lidos`) só no clique em "Mostrar
alunos aprovados", paginada como os pedidos; cada linha tem o menu com "Gerar senha provisória". A contagem de aprovados da lista de nomes (F2, 16.0)
sai. Novas: esqueci (link na entrada da equipe), redefinir,
verificar, trocar a provisória (depois do login), conta da escola na sala e em "Eu". A troca da provisória fica em `/e/:slug/trocar-senha`: o login de matrícula com a provisória devolve o
bilhete, que a web guarda só em memória (`api/sessao.ts`), nunca na URL nem no armazenamento do navegador, e nunca na chave do cache de consultas; a lista de `/trocas` leva na chave o número de ordem do bilhete nesta aba
(`numeroDoUltimoBilhete`, um contador da aba, não dado do aluno), não o bilhete, sai do cache ao fechar a tela e não se refaz ao voltar o foco. O diálogo "Sua sessão expirou" do aluno, que também entra pela matrícula, leva à mesma tela quando recebe `trocar_senha`.
A conta da escola na sala (divergência da 16.0) trata o que a API da 14.0 devolve: o domínio não liberado, a conta pessoal, a ligada a desativado e a
queda do provedor voltam à entrada da escola com o texto dela (seção 5), e a sala nunca os vê; a sala trata `ENTRADA_INVALIDA`, `REIVINDICACAO_RECUSADA`,
o limite, 503 e rede (`cenarios.md`, "Telas"). O token do link sai no `#` e não volta do provedor, e o pedido sem senha ainda exige `token` ou `codigo`: a
tela guarda o caminho no `sessionStorage` da aba antes de sair (slug e hora, 15 min, a validade do `educa_conta_provada`) e o lê e apaga na primeira
renderização da sala, usando-o só com `?conta=provada` no mesmo slug. É o token da sala, que a turma toda recebe, e não o bilhete da troca, que segue fora
de todo armazenamento (`cenarios.md`, "Conta da escola do aluno").

## 10. Testes

`cenarios.md`.

## 11. Conformidade com as regras

| Regra | Desvio e justificativa | Documento |
|---|---|---|
| 10, item 1 | `link_da_conta` é da conta global, como `codigo_recuperacao` | `docs/modelo-de-dados.md` |
| 10, item 9 | sem escopo, cercado (seção 6): `link_da_conta` | esta seção |
| PRD, "E-mail que volta" | "falhou" é a recusa SMTP; a devolução tardia espera o webhook do provedor (`TODO.md`). "Corrigir" é o "Corrigir o e-mail" da seção 5 (18.0 e 19.0), que troca a conta do professor que nunca entrou e mantém o id, os vínculos e as aulas; quem já entrou alguma vez não troca por ali (`CONFLITO`), e a coordenação revoga e cadastra o e-mail certo | seção 5; `docs/interface.md` (Professores) |
| 10, item 3 | o "Corrigir o e-mail" chega à conta global só pelo `contaDoProfessor`, a exceção cercada do cadastro, e só depois do escopo e do estado; a conta antiga não é escrita | seção 5; `docs/modelo-de-dados.md` |

## 12. Premissas não verificadas

- O provedor de e-mail de produção: Joaquim, antes do portão (`docs/decisoes-em-aberto.md`)

## 13. Riscos técnicos

- Quem gera a provisória pode entrar na conta do aluno. Mitigação: o aluno a vê na troca seguinte; auditoria; D81
- `VERIFICACAO_PENDENTE` revela a quem tem o link copiado, inclusive à coordenação da escola que o gerou, que a conta daquele e-mail tem senha, não provou o e-mail e já tem usuário em outra escola; o nome e o id dessa escola não saem. Dado de adulto: aceito
