# Achados das revisões — `tasks/correcoes/2026-11-10-censo-e2e-convite-mfa.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-10 20:28:48 · `tasks/correcoes/2026-11-10-censo-e2e-convite-mfa.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- O passo de entrar pela API se repete em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/convite.spec.ts`, no terceiro caso do W14 (`page.context().request.post('/v1/sessao/email', ...)` com a checagem `etapa === 'pronta'`). O mesmo passo já existe em `e2e/support/casca.ts:603` e em `e2e/support/roteiro.ts:87`. Vale usar o ajudante de `casca.ts`, que já deixa o cookie no contexto da aba. Assim o passo fica num lugar só. Também vale dar um nome à asserção do status HTTP antes do `.json()`: se a entrada falhar, o erro aponta a causa e não só um `etapa` indefinido.
- Os casos novos do W14 entram três vezes por e-mail com contas recém-criadas, cada uma com seu e-mail. Hoje eles não chegam perto do limite de tentativas de entrada por conta. Se o limite por usuário ou por escola um dia ficar mais apertado no ambiente do e2e, confira que contas novas da mesma escola do seed não somam no mesmo balde.

A tarefa mexe só em `e2e/convite.spec.ts` e `e2e/mfa.spec.ts`. Nenhum código de produção, fila, gateway de IA, migration ou caminho quente foi alterado, então não há cenário de carga a atualizar. Os dois specs usam os ajudantes que já existem (`loadUnthrottled` em `e2e/support/profiles.ts:177` e `configurarSegundoFatorPelaApi` em `e2e/support/mfa.ts:69`) e as rotas que `e2e/support/roteiro.ts` já usa. Nenhum teste chama provedor pago.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-10 20:28:50 · `tasks/correcoes/2026-11-10-censo-e2e-convite-mfa.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. A correção mexe só em `e2e/convite.spec.ts` e `e2e/mfa.spec.ts`, e nenhum dos dois cria, aprova ou consulta `Nota`. Todos com autor humano? Não se aplica, porque não há caminho novo nem alterado.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. Não há saída de IA nesta tarefa. Os casos tratam de aceite de convite, entrada com senha e segundo fator.
Supervisão do tutor: ok. A correção não toca o tutor.
Autonomia declarada e visível: sim. A correção não toca governança nem agentes, e `docs/regulacao.md` e a regra 70 não mudaram em relação à `develop`.
Bloqueantes: nenhum
Recomendações: nenhuma pela regra 70.

O que conferi:
- **O que a tarefa muda:**
  - O W14 de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/convite.spec.ts` virou três casos, e as asserções foram repartidas entre eles sem mudar.
  - Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/mfa.spec.ts`, o caso "cinco códigos errados" configura o segundo fator pela API, com `configurarSegundoFatorPelaApi` (`e2e/support/mfa.ts:69`), e não mais pela tela.
  - Os dois arquivos passam a usar `loadUnthrottled` (`e2e/support/profiles.ts:177`) na primeira carga da tela.
  - A senha usada nos testes é inventada (`SENHA_NOVA`, `convite.spec.ts:23`), e nenhum dado real entra.
- **Itens da regra 70 (1 a 9):** nenhum tem superfície aqui. A tarefa não tem nota, correção, devolutiva, tutor, autonomia de agente, indicador de professor nem decisão sobre a trajetória do aluno.
- **Testes que provam a regra 70:** nenhum dos testes citados como checagem nela, como `mvp-tables.int.test.ts`, `entrega.int.test.ts`, `governanca.int.test.ts` e `tutor.int.test.ts`, foi alterado. Os dois specs mexidos não estão entre eles. Nenhuma prova da regra 70 ficou mais fraca.
- **Fluxos de convite e segundo fator:** o isolamento e a proteção do token do convite são assunto da regra 20 e da regra 10, com o `privacy-guardian` e o `tenancy-guardian`. Pela regra 70, não acho nada.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-10 20:28:57 · `tasks/correcoes/2026-11-10-censo-e2e-convite-mfa.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A correção mexe só em `e2e/`, sem migration, DTO, rota, log de aplicação ou código de produção.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok. Nenhuma rota nem repository mudou. Os casos novos chamam `POST /v1/convites/aceitar` e `POST /v1/sessao/email` com o próprio convite e a própria senha do professor sintético, do mesmo jeito que `e2e/support/roteiro.ts:89` e `:101` já fazem.

Logs: limpos. Não há `console.*` nem anotação de teste com dado nos dois specs. As mensagens das asserções ("o aceite pela API", "o professor não tem segundo fator") não carregam dado de pessoa.

Auditoria: não se aplica. Nenhuma ação que a regra 20, item 10, obriga a auditar foi tocada.

Envio externo: nenhum.

Seed/fixture: sintético. `criarConviteDeProfessor` (`e2e/support/seed.ts:770-794`) gera "Professor sintético <uuid>", e-mail `@educa.invalid` e token aleatório. `criarEquipeComSenha` segue o mesmo padrão.

A prova de que o token do convite não vaza continua de pé. As checagens de URL, `localStorage` e `sessionStorage` foram para o fim do caso que leva o token pela aba (`e2e/convite.spec.ts:192-196`). Ali elas cobrem o caminho todo em que o token existe na aba, do `goto('/convite#…')` até a `/entrar` depois do aceite. Nos outros dois casos o aceite é feito pela API e a aba nunca recebe o token, então a mesma checagem ali não provaria nada. Nenhuma asserção de privacidade saiu.

Bloqueantes: nenhum.

Recomendações:
- `e2e/convite.spec.ts:192-196`: antes, a checagem de armazenamento rodava depois da entrada com senha e da ida a Turmas, na mesma aba que tinha visto o token. Agora ela para na `/entrar`. Se a aplicação guardasse o token em memória durante a navegação dentro da página e só o gravasse depois do login, o teste atual não pegaria. Hoje nada indica que isso aconteça, e por isso não bloqueia. Fica registrado para a validação: se um dia o fluxo do convite continuar até a área logada sem recarregar a página, vale um caso que aceite pela tela e cheque o armazenamento já dentro da área logada.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/correcoes/2026-11-10-censo-e2e-convite-mfa.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/convite.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/mfa.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/support/seed.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/support/mfa.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/support/profiles.ts

## test-engineer · 1ª rodada · APROVADO · 2026-11-10 20:29:44 · `tasks/correcoes/2026-11-10-censo-e2e-convite-mfa.md`

VEREDITO: APROVADO

Cenários exigidos:
- Caminho feliz: os três casos W14 e o caso "cinco códigos errados" continuam provando o que provavam, agora abaixo de metade do prazo.
- Cada asserção do W14 original está em exatamente um dos três casos novos, e o assunto de cada caso não muda.
- O token do convite não aparece em URL nem em armazenamento do navegador (regra 20.8 e regra 50.7).
- O professor não tem segundo fator, e a coordenação tem.
- No MFA, o passo do relógio fica igual depois da troca de `setUpMfa` por `configurarSegundoFatorPelaApi`: o código de `PASSO_SEGUINTE_SEGUNDOS` do fim do caso continua válido.
- Isolamento, permissão, concorrência e IA não se aplicam: a correção só toca `e2e/` e não mexe em código de produção.

Cobertos:
- **`mfa.spec.ts:232`:** nenhuma asserção saiu. `configurarSegundoFatorPelaApi` (`e2e/support/mfa.ts:69-84`) ativa com `codigoDoAutenticador(segredo)`, o passo de agora, como o `setUpMfa` fazia na linha 49. Assim a asserção de `PASSO_SEGUINTE_SEGUNDOS` da linha 261 tem o mesmo sentido de antes. Só a entrada sai da rede lenta, com `loadUnthrottled`; as cinco tentativas continuam na rede do perfil.
- **`convite.spec.ts:155`:** o caso cobre a tela do aceite, o foco, o "Mostrar a senha", o aviso, a ausência de "Configurar o segundo fator" e as verificações do token em endereço, `localStorage` e `sessionStorage`. `seguirEnderecos` está ligado antes do `goto`.
- **`convite.spec.ts:199`:** o caso cobre a entrada com a senha e a abertura em Nova conversa, com o nome e a escola na casca. O aceite pela API usa o mesmo formato de `e2e/support/roteiro.ts:101`.
- **`convite.spec.ts:216`:** o caso cobre o toque em "Ir para Turmas" e o texto "A coordenação ainda não alocou você". A ausência de segundo fator agora é afirmada de forma explícita: `etapa === 'pronta'`.
- **Mutações:** a seção "Mutações" está certa. O diff não tem cláusula nova nem código de produção, então RF17 não se aplica.
- **Títulos antigos:** nenhuma tabela de testes de PRD ou de tarefa cita o título antigo do W14. As únicas citações estão em `tools/renomear/mapas/11.relatorio.md`, que é histórico, e no texto corrido de `tasks/prd-apresentacao-escola/cenarios.md:554`, que não cita título de teste.
- **Proibições:** não há `.skip`, `.only`, teste comentado nem mock que esconda a regra. As rotas reais seguem em uso.

Não rodei os testes: são e2e, precisam do ambiente de pé, e as durações são medidas pelo portão da tarefa.

Bloqueantes: nenhum.

Recomendações:
1. **`e2e/convite.spec.ts:192-196`, o token ficou verificado por menos tempo.** Antes, a varredura do token em endereços e armazenamento cobria a aba inteira: aceite, entrada e Turmas. Agora cobre só até `/entrar`. Os casos 2 e 3 abrem abas novas, então não cobrem a entrada feita na mesma aba que ainda pode ter o token na memória do aceite. Um defeito como mandar o token em query na chamada de login deixaria de ser pego. O documento diz que "o token só existe na aba até o aceite", e isso vale para a barra e para o armazenamento, mas não para o estado em memória. Sugestão: corrigir a frase do documento, ou registrar no `TODO.md` um caso unitário ou de componente que prove que a tela de entrada não recebe o token.
2. **`e2e/convite.spec.ts:176-185`, a senha digitada não chega mais até a entrada.** O caminho "digitar, alternar 'Mostrar a senha' duas vezes, enviar e entrar com a senha digitada" já não é provado de ponta a ponta. O caso 2 entra com uma senha definida pela API. Aceite pela tela seguido de entrada continua coberto em `e2e/professor-introducao.spec.ts:66-75`, mas sem a alternância do "Mostrar". Sugestão de baixo custo: no caso `:155`, um `page.waitForRequest` em `/v1/convites/aceitar` com a asserção de que o corpo leva `senha: SENHA_NOVA`. Isso prova que a alternância não altera o valor enviado.
3. **`e2e/convite.spec.ts:199`, o título promete mais do que o caso afirma.** O título diz "sem segundo fator", mas o caso só mostra isso de forma implícita, ao chegar em Nova conversa. Uma asserção curta ajudaria a ler, como a de "Configurar o segundo fator"/"Segundo fator" com `toHaveCount(0)` depois do `activate`, ou o mesmo `etapa === 'pronta'` do caso 3, observado com `waitForResponse`.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/convite.spec.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/mfa.spec.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/support/mfa.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/correcoes/2026-11-10-censo-e2e-convite-mfa.md`

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-10 20:29:51 · `tasks/correcoes/2026-11-10-censo-e2e-convite-mfa.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido

Bloqueantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/prd-acesso-e-convites/cenarios.md:299`: a linha aponta para "os casos de `:211`, `:229` e `:355`" de `e2e/convite.spec.ts`, que são os três casos que passaram a exigir o e-mail verificado. A divisão do W14 empurrou esses casos 25 linhas para baixo, e as referências agora caem em caso errado:
  - `:211` cai dentro do segundo caso novo do W14 ("entra com a senha que criou").
  - `:229` cai dentro do terceiro caso novo ("vai de Nova conversa a Turmas").
  - `:355` cai no meio de "recomeço, mesmo link".

  Os casos certos agora estão em `:236` (conta em outra escola, aceite sem senha nova), `:254` (vai para a entrada sem campo de senha) e `:380` (recomeço, resposta atrasada). Isso é o `cenarios.md` da própria spec, ainda não pousada, que o `/validar` lê. Do jeito que está, quem conferir a regra do e-mail verificado abre o caso errado. A tarefa diz que nada ficou fora da correção, mas foi ela que deixou o documento errado.
  **Correção exigida:** trocar para `:236`, `:254` e `:380` no `cenarios.md:299`, ou citar os casos pelo nome em vez da linha, na mesma tarefa.

Recomendações:
- `e2e/convite.spec.ts:199` e `:216`: os dois casos novos aceitam o convite pela API, pelo contexto `request`. O bilhete do aceite fica fora da aba e o login pela tela sai sem ele. Antes, o W14 fazia o aceite e a entrada na mesma aba, com o bilhete guardado em memória indo no `POST /v1/sessao/email`. Para a conta nova do professor o resultado não muda, porque o aceite já ativa o usuário (`convite.service.ts:141`), e o envio do bilhete tem teste de unidade (`apps/web/src/api/etapas-do-login.test.ts:202`). Mesmo assim, nenhum e2e percorre mais o aceite e a entrada na mesma aba. Vale dizer isso no documento da tarefa em vez de "nenhuma asserção saiu nem mudou", que é verdade só no sentido literal.
- `e2e/convite.spec.ts:155`: a verificação de que o token não aparece em endereço agora vai só até a `/entrar`. Os pedidos da entrada e da navegação até Turmas deixaram de ser observados. O argumento do documento ("o token só existe na aba até o aceite") vale para este fluxo, mas é uma premissa sobre a tela que o teste não prova. Registrar no `TODO.md` para a retro, se for o caso.
- `e2e/convite.spec.ts:217-218` e `:201-202`: o aceite pela API se repete em dois casos. Ou se reusa o ajudante de `support/roteiro.ts:101`, ou se cria um pequeno `aceitarPelaApi` local.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/correcoes/2026-11-10-censo-e2e-convite-mfa.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/convite.spec.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/mfa.spec.ts`

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-10 20:44:51 · `tasks/correcoes/2026-11-10-censo-e2e-convite-mfa.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta rodada. O diff só altera `e2e/`, os ajudantes de `e2e/support/` e documentos. Não há código de produção nem nada que grave nota. Todos com autor humano? sim (nada mudou desde a 1ª rodada).
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. O diff não toca saída de IA, entrega nem artefato.
Supervisão do tutor: ok. O diff não toca o tutor.
Autonomia declarada e visível: sim. O diff não toca a governança nem a declaração dos agentes.
Bloqueantes: nenhum
Recomendações: nenhuma da minha regra.

Conferi o diff de `91295d6c` a `e40a5661`, sem `tasks/correcoes/achados`. A rodada anterior não exigiu nenhuma correção. O que mudou:

- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/convite.spec.ts`
  - Duas asserções novas no W14:
    - O corpo do aceite leva a senha que foi digitada.
    - A entrada do professor volta com `etapa === 'pronta'`, ou seja, sem segundo fator.
  - O aceite pela API agora passa por um ajudante.
  - Nada disso envolve nota, saída de IA, tutor, agente ou indicador de professor.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/support/roteiro.ts` ganhou o ajudante `aceitarConvitePelaApi`.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/support/casca.ts`: `entrarPelaApi` confere o status da resposta antes de ler o corpo.
- Mudanças só de texto:
  - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/prd-acesso-e-convites/cenarios.md:299` passa a apontar as linhas novas do spec.
  - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/TODO.md` registra que nenhum e2e faz mais o aceite e a entrada na mesma aba.
  - O documento da correção ganhou a tabela de recomendações e dois blocos de mutação. As mutações só atacam o aceite do convite e o segundo fator da entrada.

Os itens 1 a 9 da regra 70 não são alcançados por esta rodada. A correção não tem tela, então não havia foto para ler.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-10 20:44:55 · `tasks/correcoes/2026-11-10-censo-e2e-convite-mfa.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo. O diff só mexe em `e2e/`, num ajudante de `e2e/support/` e em documentos. Os dados usados (`convite.email`, `convite.nome`, `convite.escolaNome`, `SENHA_NOVA`) vêm do seed sintético de `e2e/support/seed.ts`, que não mudou.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok. Nenhuma rota nem repository foi alterado. O aceite e a entrada continuam pelos endpoints de antes (`/v1/convites/aceitar` e `/v1/sessao/email`).

Logs: limpos. O erro novo de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/support/casca.ts:611` mostra só o status HTTP. O de `aceitarConvitePelaApi` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/support/roteiro.ts:96-99`) mostra só a mensagem fixa. Nenhum dos dois expõe e-mail, nome, senha ou token.

Auditoria: não se aplica. A correção não cria leitura de dado de aluno, exportação, nota, permissão nem aprovação de saída de IA.

Envio externo: nenhum.

Seed/fixture: sintético.

O que conferi no diff desde a rodada 1:
- A prova de que o token não aparece em endereço, em chamada, em `localStorage` nem em `sessionStorage` continua inteira no fim do caso `:156` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/convite.spec.ts:196-200`). Ela vem depois da nova asserção sobre o corpo do aceite (`:186-189`), e essa asserção não muda o que a prova cobre.
- O caso `:203` ganhou a asserção `etapa === 'pronta'` na resposta real da tela (`:214-219`). O "sem segundo fator" do título agora tem prova, e a mutação em `login-completion.ts` que está no documento da correção quebra esse caso.
- O caso `:224` passou a entrar por `entrarPelaApi`, que agora recusa a resposta não-ok antes de ler o corpo. O caso não perdeu asserção.
- Minha recomendação da rodada 1 foi registrada. Ela está no `TODO.md`, com dono e destino na retro, e está no próprio documento, na seção "O que a divisão tira, dito por inteiro" e na tabela "Recomendações sem aplicar". A limitação está dita com clareza: a prova sobre o token vale até a `/entrar` e não alcança o estado em memória da aplicação nem a navegação até a área do professor.
- A troca de linhas em `tasks/prd-acesso-e-convites/cenarios.md:299` (`:211/:229/:355` para `:241/:259/:385`) só mexe em referências e não toca regra de privacidade.

Pergunta de fechamento: a correção não muda o que o sistema guarda nem para onde envia. A resposta continua sendo a mesma do arquivo do titular, que já estava aprovado.

Bloqueantes: nenhum.

Recomendações: nenhuma nova. A da rodada 1 (um caso que aceite pela tela e prove que o token não chega à tela de entrada nem à área logada) está registrada no `TODO.md` e é da retro.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-10 20:44:56 · `tasks/correcoes/2026-11-10-censo-e2e-convite-mfa.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum

A correção exigida na 1ª rodada foi feita. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/prd-acesso-e-convites/cenarios.md:299` agora aponta para `:241`, `:259` e `:385`. Na árvore de agora, esses números caem nos mesmos três casos que antes estavam em `:211`, `:229` e `:355`:
- `:241`: "o professor que já tem conta em outra escola aceita sem senha nova…"
- `:259`: "quem já tem conta em outra escola vai para a entrada…"
- `:385`: "recomeço, resposta atrasada…"

O diff desde a rodada anterior não traz problema:
- `aceitarConvitePelaApi`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/support/roteiro.ts:96`, é o ajudante único do aceite. Os dois casos novos e `professorAceitaEConfirmaPelaApi` o usam.
- `entrarPelaApi`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/support/casca.ts:611`, passou a afirmar o status antes de ler a resposta. Os 37 casos que o chamam continuam iguais: se a entrada fosse recusada, eles já paravam com erro na conferência da etapa `pronta`. Agora param antes, com a mensagem certa.
- As duas asserções novas no `convite.spec.ts` provam algo de verdade: a senha digitada vai no pedido de aceite, e a entrada do professor volta com a etapa `pronta`. As duas mutações do documento tocam linhas que existem: `apps/web/src/api/convite.ts:56` e `apps/api/src/sessao/completion/login-completion.ts:183`.
- O documento agora diz o que se perdeu com a divisão do W14: nenhum e2e faz mais o aceite pela tela e a entrada na mesma aba. Isso também foi para o `TODO.md`, para a retro.
- O documento sem commit é igual ao de `e40a5661`.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/correcoes/2026-11-10-censo-e2e-convite-mfa.md`, seção "Correção": a frase "Só `e2e/` e uma linha de `cenarios.md`" deixa de fora a linha nova do `TODO.md`. É só texto, nada além disso.

## test-engineer · 2ª rodada · APROVADO · 2026-11-10 20:45:01 · `tasks/correcoes/2026-11-10-censo-e2e-convite-mfa.md`

VEREDITO: APROVADO

**Cenários exigidos:** Esta é a 2ª rodada, então audito só o diff desde a 1ª e o que ele afeta. A correção divide o caso W14 do professor e acelera o caso dos cinco códigos errados, sem mudar a regra de produção. Por isso os cenários são os da 1ª rodada, mais as três recomendações que eu tinha feito:
- a senha digitada é a que vai no aceite, e o botão "Mostrar" não a altera;
- o professor entra sem segundo fator, e isso é afirmado pela resposta da entrada, não só dito no título;
- o que a divisão deixou de provar fica escrito no documento e no `TODO.md`.

**Cobertos:**
- **A senha digitada vai no aceite.** `e2e/convite.spec.ts:187-189` espera o segundo pedido de aceite, o que leva a senha, e afirma que o corpo traz `SENHA_NOVA`. O bloco de mutação em `apps/web/src/api/convite.ts:56` acrescenta um "x" ao fim da senha só quando ela existe. Com isso, o caso `:156` cai na asserção do corpo, e não em outro ponto. A linha mutada existe exatamente como está no bloco, e o `teste:` do bloco é o começo do título em `:156`.
- **Sem segundo fator, pela resposta.** `e2e/convite.spec.ts:215-219` liga a espera da resposta de `/v1/sessao/email` antes do clique em "Entrar" e afirma o status ok e `etapa === 'pronta'`. O bloco de mutação em `apps/api/src/sessao/completion/login-completion.ts:183` passa a exigir o segundo fator também do professor, o que devolve `configurar_mfa` e derruba essa asserção. A mesma mutação também derruba o `:224`, porque `entrarPelaApi` lança erro quando a etapa não é `pronta`.
- **Os dois ajudantes novos.**
  - `aceitarConvitePelaApi` (`e2e/support/roteiro.ts:96-99`) afirma `ok()`.
  - `entrarPelaApi` (`e2e/support/casca.ts:611`) agora afirma o status antes de ler o corpo. O comportamento é o mesmo de antes: uma entrada recusada já falhava, só que agora a mensagem aponta a recusa. Nenhum chamador espera que ela falhe.
  - Faz sentido esses dois não terem bloco de mutação, porque são código de teste e não de produção.
- **As linhas que o `/validar` lê.** `tasks/prd-acesso-e-convites/cenarios.md:299` agora aponta `:241`, `:259` e `:385`. Conferi os três contra o `convite.spec.ts` atual e batem com os títulos dos casos citados.
- **O que a divisão tira.** Nenhum e2e percorre mais, na mesma aba, o aceite pela tela e a entrada com a senha criada. Essa perda está escrita por inteiro no documento e registrada no `TODO.md:3433`, para a retro. A tabela "Recomendações sem aplicar" lista as duas que não foram aplicadas, cada uma com destino ou motivo.

**Bloqueantes:** nenhum. Não há `.skip`, nenhuma asserção do W14 original saiu, e não há mock que esconda a regra. Os dois `waitForRequest`/`waitForResponse` novos são ligados antes do clique, então não perdem o pedido. A árvore de trabalho é igual à `e40a5661` em tudo, exceto o documento da tarefa, que não está no git e por isso não entra na comparação.

**Recomendações:**
- Nos casos `:203` e `:224`, o aceite pela API depende do `request` do fixture, que é um contexto diferente do da aba. Isso está certo hoje, porque o aceite não abre sessão. Se um dia abrir, vale um comentário no ajudante avisando que a aba não herda essa sessão.

Não rodei o e2e: as duas mutações já foram provadas pelo portão da tarefa, e rodar o Playwright aqui exigiria subir o ambiente e carregar a máquina.
