# Achados das revisões — `tasks/prd-onboarding-por-convite/revisao-spec.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## frontend-reviewer · 1ª rodada · AJUSTES NECESSÁRIOS · 2026-11-03 12:23:23 · `tasks/prd-onboarding-por-convite/revisao-spec.md`

VEREDITO: AJUSTES NECESSÁRIOS
Tela vista: não. É revisão de spec, sem código e sem fotos. Não rodei `vitrine`, porque não há tela a fotografar. As telas serão vistas na validação.

Estados: faltando, em parte. A Tech Spec §9 e §10 não definem carregando, vazio nem erro para nenhuma das telas novas.
- O estado de execução da planilha existe em §5 (`na_fila`, `concluida`, `desatualizada`, `falhou`), mas falta o texto de cada um.
- Falta o estado vazio de "Grade e calendário" numa escola nova, que deve convidar a baixar o modelo (RF1).
- Falta o carregando do envio de convites.

Acessibilidade: implícita (§9 e §10 não mencionam). Teclado, foco visível, contraste e rótulo em campo não aparecem.
- As partes de maior risco são o seletor de arquivo, a tabela de prévia com marcas por linha (checkbox), a grade com rolagem horizontal e o campo de senha provisória.

Chromebook fraco: parcial.
- Pontos bons: XLSX carregado sob demanda (§9), prévia paginada de 100 em 100 (§9), limite de 512 KB e 3.000 linhas (§7c), gravação em fila (§5).
- A leitura do arquivo no navegador roda no cliente. Não há teste com throttling de CPU e rede para a prévia de 3.000 linhas.
- Imagem comprimida não se aplica.

Celular: não garantido pelo teste.
- A rolagem horizontal da grade fica dentro do cartão a 360 px (§9), o que é aceitável.
- O e2e de RF18 e a §10 citam só o projeto `chromebook`. O projeto `celular` não aparece.

Ação oficial protegida: sim, com uma ressalva.
- Transferir e desligar só ocorrem com marca na prévia, e a prévia traz candidatos com id, nome e turma (PRD RF4 e RF5, §5, §7 DTO). Nenhuma reimportação remove, transfere ou desliga sem a marca (PRD §6). Gravar refaz a prévia e compara a assinatura (§5).
- Ressalva: "Gerar senha provisória" apaga a senha atual do aluno e encerra as sessões dele (§5). A spec não exige mostrar nome do aluno e turma antes de confirmar (recomendação 1).

Bloqueantes:
1. Tech Spec §10 (Testes) e PRD RF18 não incluem o projeto Playwright `celular`.
   - Errado: as telas novas são usadas pelo aluno em casa e pelo professor e coordenador fora da escola. São elas: esqueci a senha, redefinir, verificar, trocar a provisória, "Entrar com a conta da escola", "Ligar a conta" em "Eu" e a prévia de planilha. A regra 50 item 2a exige que passem em `celular`. A §10 só cita `chromebook`.
   - Correção exigida: acrescentar na §10 o e2e no projeto `celular` a 360 px. Ele cobre pelo menos esqueci → redefinir, troca da senha provisória, entrada com a conta da escola e a prévia de planilha com erro. Deve verificar que não há rolagem horizontal de página, que o alvo de toque tem 24 px no mínimo e 44 px nas ações principais (Gravar, Enviar convites, Gerar senha), e que nada depende de hover.

Recomendações:
1. §9: a senha provisória invalida a atual e encerra sessões. Exigir confirmação mostrando nome e turma do aluno. Mostrar a senha em fonte grande, com botão "Copiar" e aviso "não será exibida de novo". Dizer na tela a validade de 24 horas.
2. §9: escrever o texto de usuário para os códigos `ENTRADA_INVALIDA`, `CONFLITO`, `SEM_SENHA`, `VERIFICACAO_PENDENTE`, `desatualizada` e `falhou`, cada um com o que fazer. Exemplos: "A escola mudou desde a prévia. Envie a planilha de novo." e "Esta conta já está ligada a outro aluno. Fale com a coordenação." Nenhum código pode aparecer na tela. O "esqueci" deve responder o mesmo texto exista ou não a conta ("Se o e-mail estiver cadastrado, enviamos o link").
3. §9: definir o estado vazio de "Grade e calendário" e das telas de Turmas e Professores sem dado, com o botão "Baixar modelo" como próximo passo.
4. §9: declarar rótulo em todo campo, foco visível, o checkbox de marca com `aria-label` ("Desligar Fulano, matrícula X") e a tabela da grade com cabeçalhos associados. Adicionar verificação de acessibilidade (axe) ao e2e. Não deixar um "marcar todos" para transferir ou desligar sem mostrar a contagem.
5. §10: acrescentar um teste de prévia com 3.000 linhas sob throttling de CPU 4× e rede lenta, com meta de tempo. A tabela de prévia e a grade de 1.800 aulas devem ficar paginadas ou virtualizadas.
6. O PRD §4 diz que o professor vê a grade das turmas dele, e a API `/v1/grade` atende a ele (§4). A §9 não diz onde isso aparece na interface. Definir a tela ou deixá-la explicitamente para a F2b.
7. Para o professor em duas escolas (PRD §7), confirmar na §9 que a grade e o convite seguem o seletor de escola do topo e filtram tudo abaixo.
8. §9: o lote de convites mostra o estado por professor (na fila, enviado, falhou) com a ação "Reenviar" e "Copiar link" sempre visíveis. A tela deve dizer quando o lote terminou, sem depender de o usuário recarregar.

Arquivos lidos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/prd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/techspec.md

## tenancy-guardian · 1ª rodada · REPROVADO · 2026-11-03 12:25:41 · `tasks/prd-onboarding-por-convite/revisao-spec.md`

VEREDITO: REPROVADO

Tabelas verificadas: `importacao_planilha`, `alocacao` e `evento_calendario` têm `escolaId` e `anoLetivoId`. A `alocacao` tem FK composta para `vinculo`. `link_da_conta` é global e foi declarada como exceção na seção 11. As colunas novas em `convite`, `conta`, `credencial_matricula`, `vinculo` e `reivindicacao` não mudam o escopo de nenhuma delas. Conferi no schema que a `conta_externa` é por escola: o único é `(escola_id, provedor, tenant, sujeito)`.

Queries verificadas (pelo desenho; ainda não há código): a prévia e a gravação de planilha por buscas no índice da escola; o job `estrutura.gravar-planilha`; o `email.enviar`; `GET /v1/grade` e `/v1/calendario`; a senha provisória; o esqueci e o redefinir; a verificação de e-mail; a reivindicação e a ligação da conta da escola.

Teste de isolamento: presente e efetivo (seção 6). Se eu tiro a cláusula de escola, quebram: "A não lê nem grava importação, grade, calendário, provisória e envio da B", "8A da B não casa com planilha da A", "marca com id da B" e "provisória fora das turmas confirmadas". Faltam casos, listados em Recomendações.

**Item por item da lista**
1. `escolaId` e `anoLetivoId`: garantido nas tabelas novas. Sobre o ano, ver o bloqueante 3.
2. Escopo a partir do token: garantido na API (seção 6). No worker, ver o bloqueante 1.
3. `escolaId` vindo do cliente: nenhuma rota recebe. As marcas são validadas contra os candidatos da prévia, e o que não estiver entre eles volta `ENTRADA_INVALIDA`.
4. Teste de isolamento: presente e efetivo.
5. Não revelar existência: garantido. O 404 é igual para inexistente e para fora da turma; o esqueci responde 202 igual, com piso de 400 ms; o `CONFLITO` sai sem nome.
6. UUID: implícito, coberto pela convenção `uuidv7()` do `docs/modelo-de-dados.md` (regra transversal 2).
7. Camada de rede: não se aplica. Nenhuma rota nova é para a rede.
8. `@Unscoped()`: a justificativa só aparece para a credencial na API. Ver o bloqueante 1.

Bloqueantes:

1. **Seções 1, 5 ("E-mail"), 6 e 11: o worker lê a conta global e isso não está declarado.**
   - **O problema.** O `email.enviar` em `apps/worker/src/processors/enviar-email.ts` precisa do endereço, e o endereço só existe em `conta.email` (`packages/core/src/db/schema/conta.ts:30`). No esqueci e no verificar, ele lê ainda `link_da_conta` pelo id, e esse job tem `escolaId` nulo, porque roda como rotina do sistema.
   - **Por que bloqueia.** A seção 11 só declara leituras sem escopo "no repository da credencial global", na API. A exceção do `docs/modelo-de-dados.md` (regra transversal 1) e a cerca de `apps/api/test/architecture.test.ts:50` só permitem chegar à `Conta` pelo `apps/api/src/sessao/`, pelo `packages/core/src/ciclo-de-vida/` e pelo expurgo. O desenho abre um terceiro caminho para a identidade global sem escrevê-lo.
   - **Correção exigida.** A Tech Spec diz qual repository, e em que pacote, lê o endereço e o `link_da_conta` para o worker. Escreve a frase do `@Unscoped` de cada método, por exemplo: "pelo id do convite (na escola do contexto) ou do link; devolve só o endereço e o token cifrado". A nova zona entra na exceção do `docs/modelo-de-dados.md` e nas zonas cercadas do `architecture.test.ts`, com `link_da_conta` na lista de tabelas sem escola.

2. **Seção 5 ("Conta da escola do aluno"): o cookie da conta provada não diz de que escola é.**
   - **O problema.** O cookie assinado de 15 min leva "a conta provada", mas o texto não diz que ele leva também a escola e o acesso da turma, nem que a reivindicação confere isso contra a sala do pedido.
   - **O risco.** Uma conta provada no domínio liberado da escola A entra num pedido na sala da escola B e fura a política de domínio da B. É uma credencial de um tenant aceita em outro, e o teste "conta externa da A não entra na B" cobre o login, não esse caminho.
   - **Correção exigida.** O cookie leva `escolaId` e `acessoTurmaId`. A reivindicação recusa o cookie de outra escola ou de outro acesso com a mesma resposta do cookie inválido. Entra na seção 6 o teste "conta provada na sala de A, pedido na sala de B: recusado".

3. **Seções 4 e 6, contra o caso de borda do PRD "Grade subida com o ano `planejado`": não está dito de que ano letivo vem a importação.**
   - **O problema.** O contexto só tem o ano em curso, e nenhuma rota recebe `anoLetivoId`. Mesmo assim, o PRD pede que a grade seja gravada num ano `planejado`. Fica indefinido de onde sai esse `anoLetivoId`, e o caminho óbvio na implementação é colocá-lo no corpo.
   - **Correção exigida.** A Tech Spec diz que o ano de destino é resolvido no servidor, a partir da escola do contexto: o `em_curso` ou o único `planejado` dela, nunca vindo do corpo. Ou então tira o caso do PRD. A `evento_calendario` e a `importacao_planilha` ganham FK composta `(escolaId, anoLetivoId)`, como a `alocacao` já tem.

Recomendações:
- **Seção 5:** escrever que o job abre o contexto pela escola da linha do outbox e lê `importacao_planilha` por `id` + escola do contexto. Só o `anoLetivoId` vem da linha.
- **Seção 6:** incluir testes explícitos para estes casos:
  - `turmaId` da B na prévia e na gravação, com a lista por turma da A1;
  - `usuarioIds` da B em `convites/enviar`;
  - `GET /v1/grade?turmaId=` da B, para coordenador e para professor;
  - `importacoes/:id` da B, respondendo 404 igual.
- **Seção 5, prévia de professores:** dizer que "já existe" se decide só pelo `usuario` da escola, nunca pela `conta` global. Assim a prévia não revela que o e-mail é de professor em outra escola cliente, mantendo o que a A1 já garante. Pede um teste.
- **Seção 7c:** contar o limite de "5/dia por aluno" da provisória só depois da checagem de escopo e turma. Do contrário, uma escola gasta a cota de aluno de outra.
- **Seção 3:** dizer que todo `id` novo é `uuid` com `uuidv7()`.

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/prd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/apps/api/test/architecture.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/docs/modelo-de-dados.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/packages/core/src/db/schema/conta.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/packages/core/src/db/schema/conta-externa.ts

## infra-guardian · 1ª rodada · REPROVADO · 2026-11-03 12:26:40 · `tasks/prd-onboarding-por-convite/revisao-spec.md`

VEREDITO: REPROVADO
Caminho quente tocado: login | fila | migration
Rate limit: ok
Fila e prioridade: ok
Concorrência: corrida na Tech Spec, seção 5 "Planilha" com 7c "Corridas" (job repetido), e na seção 5 "Senha provisória" (bilhete e troca)
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: bloqueante
Métrica e alerta: ok

**Bloqueantes:**

1. **Job de planilha rodando duas vezes ao mesmo tempo (seção 5 "Planilha" e 7c "Corridas").**
   - **O que está errado.** A trava só existe no fim. A seção 5 diz que o job "aplica em lotes de 500 e fecha com `update … where estado = 'na_fila'`", e 7c diz que, rodando duas vezes, "o segundo não aplica". Isso não é verdade. O stalled do BullMQ (`apps/worker/src/composition.ts`) devolve o job enquanto a primeira execução ainda está na transação longa de 3.000 linhas. Assim a segunda execução faz turmas, séries, `lista_nome`, vínculos e alocações antes de chegar ao `update`. Esse `update` não afeta linha nenhuma, mas nada diz que isso desfaz a transação. Há um segundo problema: se a segunda execução bater numa restrição única, ela é refeita, reclassifica, encontra assinatura diferente e grava `desatualizada` por cima de `concluida`. A troca para `desatualizada` e para `falhou` também não tem a condição `where estado = 'na_fila'`.
   - **Correção exigida.** A primeira instrução da transação do job toma a linha com `select … from importacao_planilha where id = $1 for update` e sai sem fazer nada se o estado não for `na_fila`. As trocas de estado para `concluida`, `desatualizada` e `falhou` levam todas `where estado = 'na_fila'`. Em 7c entra um teste com duas execuções em paralelo: um único efeito, nas contagens de turma, vínculo e `lista_nome`, e estado final `concluida`.

2. **Senha provisória usada duas vezes (seção 5 "Senha provisória"; falta em 7c "Corridas").**
   - **O que está errado.** O bilhete é "como o `convite-ticket`", que é um JWT sem estado. O `apps/api/src/sessao/convite/convite-ticket.ts` não tem uso único: quem garante o uso único é o `usadoEm` do convite. A Tech Spec não diz o que impede duas trocas com o mesmo bilhete, um clique duplo ou um bilhete reaproveitado em até 10 min. Também não diz o que acontece com um bilhete emitido para uma provisória que já foi substituída por outra geração. O RF13 ("a provisória não entra duas vezes") fica sem mecanismo e sem teste.
   - **Correção exigida.** O bilhete leva uma referência à provisória que o originou. A troca é um `update credencial_matricula set senha_hash = …, provisoria_hash = null, provisoria_expira_em = null where id = … and provisoria_hash = :hashDoBilhete and provisoria_expira_em > now()`. Se o `update` não afetar linha nenhuma, a troca é recusada e nenhuma sessão é aberta. Em 7c entram dois testes em paralelo: duas trocas com o mesmo bilhete abrem uma sessão só; um bilhete anterior a uma nova geração é recusado.

3. **`convite.canal` obrigatório sem valor padrão (seção 3).**
   - **O que está errado.** A seção 3 escreve `convite + canal (copiado|email)` sem o `?` que a própria seção usa para coluna que aceita nulo, e sem padrão. O `vinculo.origem`, ao contrário, declara "padrão coordenacao". O código da A1 que copia o link insere convite sem `canal`, então quebra durante o deploy e em qualquer volta de versão. A tabela tem dado. Isso é reprovação pelo item 9.
   - **Correção exigida.** `canal text not null default 'copiado'`, com padrão constante (o Postgres só altera o catálogo, sem reescrever a tabela), e o check dos valores.

4. **Prévia e gravação na requisição sem limite de tempo compatível com a regra 00, item 4 (PRD RF15; Tech Spec seções 4, 5 e 7c).**
   - **O que está errado.** A prévia de 3.000 linhas e 512 KB roda dentro da requisição, e o RF15 admite até 10 s. A gravação também "refaz a prévia" na requisição. A regra diz que o que pode passar de 2 s com dado real de escola grande vai para fila. A 7c só limita cada statement a 1,5 s, não a requisição inteira, e nenhum teste prova que ela fica abaixo de 2 s.
   - **Correção exigida.** Há duas saídas:
     - **Manter na requisição.** A 7c fixa p95 de até 2 s para `POST …/previa` e `POST /v1/importacoes/:tipo` com 3.000 linhas, na escola com mais dado. O cenário de carga mede isso, pela `http.server.request.duration` da rota, com a rajada de login em paralelo. O limite de 512 KB vale só nessas rotas, não para a API inteira.
     - **Passar para fila.** A prévia também vira job.

**Recomendações:**
- **Esqueci (7c, "Rate limit").** A rota conta no `rl:ip`, o mesmo balde da página da sala. Um script no IP da escola gasta o limite que a reivindicação dos alunos usa. Use um balde próprio, como o `rl:ip-login` e o `rl:ip:op`, e declare o teto. Declare também que o perdedor da corrida no índice único parcial de `link_da_conta` responde o mesmo 202, no mesmo piso de tempo, para não revelar quais e-mails têm conta. A chave do limite "3/h por e-mail" deve guardar o hash do e-mail no Redis, não o endereço.
- **Redefinir.** Escreva que o token é validado antes do argon2, para que um token inválido não ocupe o semáforo do hash.
- **E-mail (7c).** O `docs/infra.md`, seção 3.5, pede respeitar o limite do provedor de e-mail. O `EscolaConcurrencyLimiter` limita por escola, não o provedor como um todo. Declare uma taxa global de envio e confira que 300 e-mails de uma escola não seguram por minutos a fila `normal` dela.
- **Prévia.** Além das 20 por minuto por usuário, limite as prévias simultâneas por escola. Vários coordenadores da mesma escola podem disparar prévias de 512 KB ao mesmo tempo.
- **Migration da `reivindicacao`.** O check atual `reivindicacao_segredo_so_pendente` exige `senhaHash` e `chaveEnvio` não nulos enquanto o pedido está pendente. A seção 3 precisa dizer que ele é substituído e como: `add constraint … not valid` seguido de `validate constraint`. Registre também que, voltando a versão, o código antigo aprovaria pedido com `contaExterna` criando aluno sem forma de entrar.
- **Índices (seção 3).** Faltam índices em:
  - `evento_calendario`: `(escolaId, anoLetivoId)`.
  - expurgo de `importacao_planilha`: `(estado, criadoEm)` parcial.
  - expurgo de `link_da_conta`: `coalesce(usadoEm, expiraEm)`.

  Nenhuma delas cresce com aluno. Corrija em 7c a frase "todos começando por `escolaId`", que não vale para `link_da_conta`.
- **Corridas que faltam em 7c.**
  - A turma criada à mão como "8º A" enquanto o job cria "8A": o `turma_nome_no_ano_unico` compara `lower(nome)`, não o nome normalizado, e não pega esse caso.
  - O professor importado por duas escolas ao mesmo tempo: o job trata o conflito no e-mail único como "já existe", não como `falhou`.
- **Carga (7c).** Ponha no cenário a troca da provisória e a reivindicação pela conta da escola, com provedor OIDC falso, dentro da rajada das 7h30.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/prd.md

## test-engineer · 1ª rodada · REPROVADO · 2026-11-03 12:26:44 · `tasks/prd-onboarding-por-convite/revisao-spec.md`

VEREDITO: REPROVADO

**Cenários exigidos**

Para cada RF, cada cláusula da linha conta sozinha:

- **Caminho feliz:** as quatro planilhas, convites, aceite, provisória, conta da escola e o e2e do RF18.
- **Bordas do domínio:**
  - mesmo nome na turma;
  - turma escrita de vários jeitos;
  - matrícula repetida em escolas diferentes;
  - matrícula repetida dentro da mesma planilha;
  - transferência com pedido pendente;
  - professor com duas disciplinas na mesma turma;
  - professor em duas escolas;
  - virada de ano com reimportação;
  - grade com o ano `planejado`;
  - e-mail que volta;
  - matrícula que o Excel virou número.
- **Permissão:** professor nas rotas de coordenador, professor com vínculo pendente ou encerrado, aluno não aprovado, `ligar` sem sessão de aluno.
- **Isolamento:** seção 6.
- **Concorrência em paralelo:** gravar duas vezes, job duas vezes, dois envios, clique duplo em aprovar com conta externa, troca da provisória duas vezes, esqueci duas vezes, job contra decisão do professor.
- **Ano letivo:** cada rota na escola sem ano em curso, e com um vínculo encerrado e outro aberto.

**Cobertos**

- Seção 6: isolamento entre escolas. Vale para importação, grade, calendário, provisória e envio; marca com id da B; "8A" da B; conta externa da A na B; token de uma conta contra outra.
- Seção 7c, "Corridas": cinco corridas, cada uma com teste em paralelo. São gravar duas vezes, job duas vezes, dois "enviar", redefinir duas vezes e ligar a mesma conta.
- Seção 10:
  - unidade: normalização de turma, assinatura, alfabeto da provisória, leitor (`;`, tab, UTF-16, notação científica no CSV);
  - integração: prévia desatualizada, job reexecutado, troca obrigatória, posse entre escolas, `desativar`;
  - e2e: RF18 com o `oidc-falso` e o Mailpit, planilha suja, esqueci a senha.
- E-mail por adaptador falso: aceitável, porque o e-mail é dependência externa.
- Sem IA. Nenhum `.skip` a avaliar, porque ainda não há código.

**Bloqueantes**

1. **Seção 10, "Integração: cada RF" não é estratégia de teste.** Várias cláusulas do PRD ficaram sem teste previsto. A Tech Spec precisa listar um teste por cláusula:
   - **RF2:** gravar direto com texto errado, sem passar pela prévia, dá `ENTRADA_INVALIDA` e nada grava em `importacao_planilha`. Sem isso, apagar a nova verificação ao gravar não derruba teste nenhum.
   - **RF5:**
     - o trabalho feito fica na turma antiga, com resposta ou atividade que continua presa a ela;
     - o nome não aprovado que sai deixa a lista;
     - o desligado não entra nem por matrícula nem pela conta externa, e as sessões dele caem.
   - **RF8 e RF9:**
     - o vínculo confirmado não muda na reimportação;
     - o vínculo criado à mão com a mesma turma × disciplina × professor é reaproveitado, sem pendente duplicado;
     - o vínculo criado à mão sem aula não aparece como candidato e fica.
   - **RF11:**
     - o corpo do e-mail capturado pelo falso traz escola e link, e nenhum nome de aluno (regra 20);
     - "sem aceite" exclui quem já aceitou;
     - convite revogado entre a fila e o envio fica `cancelado`, com zero envios;
     - o token anterior é recusado no aceite;
     - o link copiável continua aceito.
   - **RF12:**
     - o link vence em 1 h, com relógio falso;
     - o link não serve duas vezes;
     - redefinir derruba a sessão antiga;
     - o MFA continua exigido;
     - conta desligada recebe 202 sem link;
     - o 4º pedido na hora responde 202 e o falso registra só 3 envios.
   - **RF13:**
     - aluno com pedido pendente dá 404;
     - a senha anterior para de valer na geração, e a provisória anterior também;
     - as sessões caem;
     - o bilhete não abre nenhuma outra rota;
     - a provisória vence em 24 h;
     - depois da troca, a provisória não entra;
     - borda do PRD: aluno só com conta externa. A Tech Spec diz `SEM_SENHA` no login, mas não diz o que acontece ao gerar a provisória.
   - **RF14:**
     - domínio não liberado é recusado;
     - a recusa de "conta ligada a outro" não traz nome nem id no corpo;
     - `contaExterna` fica nula depois de aprovar e depois de rejeitar;
     - cookie de 15 min vencido é recusado;
     - `ligar` com sessão de professor é recusado.
   - **RF17:** "nenhum registro traz nome ou matrícula" é cláusula própria. O "um registro por ação" não a prova.
   - **Rate limits da seção 7c:**
     - prévia 20/min;
     - convites 300/h por escola, com a outra escola sem efeito;
     - provisória 60/h e 5/dia por aluno, com 429.

[… 75 linhas cortadas]

## privacy-guardian · 1ª rodada · REPROVADO · 2026-11-03 12:27:25 · `tasks/prd-onboarding-por-convite/revisao-spec.md`

VEREDITO: **REPROVADO**

O desenho está bem cuidado na maior parte: aluno sem e-mail, e-mail só para a equipe, arquivo que nunca chega ao servidor, `linhas` apagadas no fim do job, prévia auditada como `turma.alunos_lidos` e uma auditoria completa. Reprovo por seis bloqueantes. Os dois mais graves são o `SEM_SENHA`, que confirma se uma matrícula existe, e a senha provisória, que deixa o professor ou a coordenação entrar na conta do aluno sem que ninguém perceba.

## Item a item

**Coleta**
- **Campo novo na tabela de dados.** Implícito em dois pontos. Faltam a retenção da linha de `importacao_planilha` que fica depois do job e o cookie da "conta provada" (B3, B4). O resto da seção 3 está na tabela do `docs/lgpd.md`.
- **Campo proibido para aluno.** Garantido. RF14 e seção 5: só o identificador opaco, sem e-mail nem foto.
- **Adaptação em vez de diagnóstico.** Não se aplica.

**Exposição**
- **DTO explícito.** Implícito: a seção 7 descreve só a prévia (B5).
- **Autorização por objeto.** Garantida para provisória, importação e marcas (seções 6 e 7). Mas a provisória dá ao professor um caminho para entrar na conta do aluno (B2).
- **"Não encontrado" igual a "sem permissão".** Falha no login por matrícula (B1). Fora isso está garantido: provisória responde 404 igual, "esqueci" responde 202 igual com piso de 400 ms.
- **Bucket privado.** Não se aplica: o arquivo não chega ao servidor.
- **Convite.** Garantido (seção 5, "E-mail"): 7 dias, uso único, revogável, reenviar revoga o anterior.
- **Exportação.** Não se aplica.
- **Erro sem detalhe.** Implícito para `importacao_planilha.erro` (B4).

**Log e rastro**
- **Logs.** Garantidos (seção 7, "Log"). O job leva só o id, nunca as linhas.
- **Auditoria.** Garantida (seção 7, "Auditoria"). Falta registrar o uso da provisória (B2).

**IA**
- Não se aplica: não há IA nesta funcionalidade.

**Ciclo de vida**
- **Exclusão lógica e auditada.** Garantida: desligar chama `desativar`, que é auditado.
- **Eliminação apaga de fato.** Implícita: a seção 3 não diz o que acontece com as FKs novas quando a pessoa é eliminada (B4).
- **Retenção configurável por escola.** Garantida: `alocacao` segue `vinculo_encerrado`.
- **Seed e fixture sintéticos.** O texto não fala disso (ver recomendações).

**Pergunta de fechamento: o código responde?** Para o aluno, sim. O aluno não manda nada para fora nesta funcionalidade, e o teste de arquitetura obriga a classificar toda tabela nova em `CLASSIFICACAO_DAS_TABELAS`, o que as leva ao arquivo do titular e à eliminação. Para o professor, a resposta sobre o provedor de e-mail depende do `alcance` com que ele for cadastrado (ver recomendações).

## Formato

```
VEREDITO: REPROVADO
Campos pessoais tocados: nome e matrícula do aluno; nome e e-mail do professor; identificador opaco da conta da
  escola; vínculo (origem); aula da grade; estado do envio do convite; link_da_conta; emailVerificadoEm; senha
  provisória (hash, validade, autor); reivindicacao.contaExterna; importacao_planilha.linhas/marcas
Fora da tabela de dados do docs/lgpd.md: o cookie de 15 min com a conta provada (seção 5, "Conta da escola do aluno");
  a retenção da linha de importacao_planilha depois do job (criadoPor, resumo, erro, assinatura)
Autorização por objeto: falha no login por matrícula (SEM_SENHA confirma a matrícula) e na senha provisória (dá a
  conta do aluno a quem gera)
Logs: limpos (seção 7)
Auditoria: ausente no uso da senha provisória (só a geração é registrada)
Envio externo: endereço e texto do e-mail da equipe (convite, redefinir, verificar), nunca dado de aluno, para o
  provedor de e-mail (Mailpit no compose, falso nos testes; o de produção ainda não foi escolhido) — registrado em
  suboperador antes do portão; sem IA
Seed/fixture: o texto não declara; a carga de 3.000 alunos e os modelos de planilha precisam ser sintéticos
Bloqueantes: B1 a B6, abaixo
Recomendações: abaixo
```

## Bloqueantes

**B1. Seção 5, "Senha provisória": a resposta `SEM_SENHA` revela que a matrícula existe.** O texto diz "Aluno só com conta externa: `SEM_SENHA`". O login por matrícula é anônimo. Qualquer pessoa que digite escola e matrícula fica sabendo que a matrícula existe e que tem conta Google ou Microsoft ligada, enquanto uma matrícula inexistente recebe a credencial inválida (regra 20, item 6).
- **Correção:** o login por matrícula responde igual em todos esses casos. A tela pode lembrar a todos, sem distinção, que quem usa a conta da escola entra por ela. O aviso "este aluno entra pela conta da escola" fica só para quem gera a provisória, que já é autorizado. Entra na seção 6 um teste que compara as respostas para matrícula inexistente, aluno só com conta externa e senha errada.

**B2. Seção 5 ("Senha provisória") e seção 13: a provisória deixa o professor ou a coordenação entrar na conta do aluno sem deixar rastro do uso.** Quem gera vê a senha. Com ela, pode entrar com a matrícula, criar a nova senha e passar a ler o que só o aluno lê: o texto da conversa do Tutor (`docs/lgpd.md`, linha da conversa: "o texto só o próprio aluno lê"; regra 20, item 14) e o arquivo completo em "Meus dados". A auditoria registra só a geração. O aluno não fica sabendo, porque o arquivo dele traz a auditoria em que ele é o autor, não aquela em que ele é o alvo. O mecanismo é padrão de mercado (D81), mas o risco precisa estar escrito e mitigado.
- **Correção:**
  - a troca de senha feita com a provisória vira auditoria (por exemplo `senha_provisoria.usada`, com o id do aluno e o da geração);
  - o aluno vê em "Eu" as últimas gerações, com data e papel de quem gerou;
  - a seção 13 registra o risco e essa mitigação;
  - um teste prova o registro do uso.

**B3. Seção 5 ("Conta da escola do aluno") e `docs/lgpd.md`, seção 2: o cookie da conta provada é só assinado e não está na tabela de dados.** "Assinado" quer dizer legível. O cookie leva provedor, tenant e `sub`, que é o identificador opaco do menor e que o F3 trata como segredo. Ele fica 15 minutos no navegador, e o computador da sala é compartilhado (D43).
- **Correção:**
  - cifrar com AES-GCM, como o `educa_oidc`;
  - `HttpOnly`, `Secure`, `SameSite`, caminho restrito à rota de reivindicação;
  - apagar na resposta que grava o pedido;
  - acrescentar a linha no `docs/lgpd.md`, com finalidade e retenção;
  - um teste prova que, depois de gravado o pedido, o cookie não serve para um segundo pedido.

**B4. Seções 3 e 7, `docs/lgpd.md`: falta o ciclo de vida das tabelas e FKs novas.**
- A linha nova da tabela de dados dá retenção só a `linhas` e `marcas`. A linha que fica, com `criadoPor`, `resumo`, `erro` e `assinatura`, não tem prazo.
- `erro text?` aceita texto livre. A mensagem de restrição do Postgres traz o valor (`Key (matricula)=(…)`).
- A seção 3 não diz o que acontece na eliminação com `alocacao.vinculoId`, `credencial_matricula.provisoriaGeradaPor`, `importacao_planilha.criadoPor` e `link_da_conta.contaId`. Uma FK sem ação trava a eliminação do titular e o expurgo de `vinculo_encerrado`.
[… 36 linhas cortadas]

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-03 12:27:49 · `tasks/prd-onboarding-por-convite/revisao-spec.md`

VEREDITO: REPROVADO
Escopo: incompleto. Fica dentro do F2 recortado no `ROADMAP.md` e não invade a F2b nem o Classroom. Mas acrescenta um fluxo que o PRD não pede (bloqueante 2) e deixa sem desenho um caso de borda e parte do RF5 (bloqueantes 3 e 6).
Aderência à Tech Spec: divergência nas §1/§2 (onde o motor roda), na §5 (posse do e-mail), nas §3/§11 (`alocacao` contra `Aula`) e na §4 (a lista da A1).
Portão local: não se aplica. É revisão de spec e não há código. O `conferir` responde "nunca passou nesta árvore", o que é esperado nesta etapa.

Bloqueantes:

1. **§1 e §2: o worker não alcança o que a §5 manda ele fazer.**
   - **O que está errado:** pela §1, o job `estrutura.gravar-planilha` roda o motor no worker, a partir de `packages/core`. Mas as peças que o job precisa estão todas em `apps/api`, e a guarda `app-nao-importa-app` (`tools/guardas/camadas.test.ts`) impede o worker de importar de lá:
     - `SecretCipher` (`apps/api/src/credencial/secret-cipher.ts`), que o job `email.enviar` usa para decifrar o token;
     - `VinculoService.encerrar`, que revoga o acesso da turma quando cai o último vínculo confirmado (correção `2026-10-03-acesso-sobrevive-ao-vinculo`, regra 20 item 18);
     - a criação de turma, série e disciplina;
     - o cadastro do professor "como o da A1" (`sessao/convite/convite.service.ts`);
     - as leituras da lista (`estrutura/lista/lista.repository.ts`).
   - **Consequência:** a §2 não lista nenhuma dessas mudanças. Sem isso, o implementador reescreve cada peça no core, o que dá um segundo jeito de fazer a mesma coisa. E o encerramento pela grade ("sai da grade") ou pela transferência pode sair sem revogar o acesso da turma, que é regra com veto.
   - **Correção exigida:** a §2 lista o que sobe de `apps/api` para `packages/core`. A §5 diz que encerrar pela grade e pela transferência passa pelo mesmo `encerrar` que já revoga o acesso.

2. **§3, §4, §5 ("Posse do e-mail") e §9: requisito que não está no PRD e muda o aceite da A1.**
   - **O que está errado:** a spec cria `conta.emailVerificadoEm`, `POST /v1/conta/verificar`, a finalidade `verificar` em `link_da_conta`, o erro `VERIFICACAO_PENDENTE` e a tela "verificar". Com isso, um aceite que a A1 aceita hoje passa a ser recusado: conta com senha que aceita convite de outra escola por link copiado.
   - O motivo existe: sem isso, quem definiu a senha de um e-mail que não é dele assume o vínculo dessa pessoa em outra escola. Mas a decisão foi tomada em silêncio. Não está em nenhum RF, nem nos casos de borda do PRD, nem na §11.
   - **Correção exigida:** levar ao PRD como RF ou caso de borda, com a palavra do Joaquim, porque muda um critério de aceite. Depois, registrar na §11. Ou então retirar da spec.

3. **§4 e §6: não há como importar para o ano `planejado`, que o PRD exige.**
   - **O que está errado:** o PRD pede isso no caso de borda "Grade subida com o ano `planejado`: vale quando o ano entrar em curso" e na regra "o ano novo recebe planilhas novas".
   - Na spec, o ano vem só do contexto da sessão, que é o ano em curso: `requireAnoEmCurso` (`packages/core/src/context/ano-em-curso.ts`) responde `NAO_ENCONTRADO` quando a escola não tem ano em curso. Nenhuma rota da §4 recebe outro ano. Uma escola nova, só com ano planejado, ou a escola preparando janeiro, não consegue importar.
   - **Correção exigida:** a §4 e a §6 dizem como a importação mira o ano planejado da escola da sessão. Por exemplo, um parâmetro validado como o filtro de ano encerrado de `packages/shared/src/estrutura/turma.ts`, com o teste de isolamento correspondente. Ou o PRD retira o caso.

4. **§1, §2 e §4: a pergunta 4 do PRD ficou respondida pela metade.**
   - **O que está errado:** a spec diz que "a lista por turma da A1 vira o tipo `alunos` com a turma fixa" e que "`lista/` passa a chamá-lo". Mas a §4 não diz o que acontece com:
     - `POST /v1/turmas/:id/lista/previa` e `POST /v1/turmas/:id/lista`, que hoje são síncronas, com teto de 200 linhas e resposta `{ gravados, jaExistentes }` (`gravacaoDaListaResponseSchema`);
     - o erro `matricula_em_uso`, que no RF4 passa a ser "muda de turma".
   - Além disso, a gravação passou a ser só por job (202).
   - **Correção exigida:** a §4 diz se as rotas antigas saem ou ficam, e com qual contrato em `packages/shared`. Diz também se a lista por turma passa a mostrar "fora da planilha" e "muda de turma".

5. **§3, §5 e §11: `alocacao` substitui o modelo, mas a `Aula` da F2b fica sem onde se prender.**
   - **O que está errado:** a §11 declara que `alocacao` substitui as três tabelas da grade. Só que `docs/modelo-de-dados.md` (seção "Grade horária e calendário") e o glossário definem `Aula → alocacao*`. A §5 apaga e reinsere as alocações do ano a cada reimportação, então a `Aula` da F2b não pode ter chave estrangeira para `alocacao` sem perder ou impedir o que o professor registrou.
   - O glossário também perde o "Tempo de aula" e muda o sentido de "Grade horária".
   - **Correção exigida:** a §3 e a §11 dizem a que a `Aula` se prende e atualizam a linha de `Aula` no modelo e as entradas do glossário. A alternativa é a reimportação manter o id da alocação por (vínculo, dia, início).

6. **§5 ("Gravar alunos"): falta o desligamento do nome ainda não aprovado (RF5).**
   - **O que está errado:** o desligamento está desenhado só como `CicloDeVidaService.desativar`, que exige um usuário. Um nome livre ou reivindicado na `lista_nome` não tem usuário. O RF5 pede: "Nome não aprovado que sai deixa a lista, e o pedido pendente é encerrado". Sem desenho, o nome e a matrícula de quem saiu ficam na lista, contra o mínimo necessário da regra 20.
   - **Correção exigida:** a §5 descreve esse caminho (apagar a linha da `lista_nome`, encerrar o pedido pendente, registrar na auditoria sem nome) e a §7 inclui essa ação na auditoria.

Recomendações:
- **§4, rota externa:** já existe `GET /v1/sessao/externa/:provedor/iniciar` (`apps/api/src/sessao/external/external-login.controller.ts`). Use essa rota com `intencao`, em vez de criar `/v1/externo/...`.
- **§5, reenvio de convite:** já existem `POST /v1/professores/:usuarioId/convite/refazer` e a ação de auditoria `convite.refeito`. O "reenviar" pode reaproveitar esse caminho em vez de criar outro paralelo.
- **§5, chave do token:** `tokenCifrado` deve ter chave própria, não a do MFA, e a §5 deve dizer qual id entra como dado autenticado (AAD). Área do `privacy-guardian`.
- **§4, contratos:** citar os contratos em `packages/shared` (regra 00, item 6). Os cabeçalhos das quatro planilhas como contrato único, do qual saem o leitor e os modelos para baixar do RF1, que hoje não têm desenho nenhum.
- **§4, lista de professores (RF11):** a saída de `GET /v1/professores` com o estado do envio não aparece.
- **§7c, estados:** falta a tabela de estados exigida pela `criar-techspec` §5, tanto para `importacao_planilha.estado` quanto para `envio`: quem entra, quem sai, prazo, e o que acontece quando o processo morre no meio. Hoje uma importação presa em `na_fila` trava a escola até o expurgo de 24 h.
- **Tempo da prévia:** dar um teto de 2 s para a requisição (regra 00, item 4) ou justificar na §11 os 10 s do PRD.
- **§3, chave estrangeira:** a de `alocacao` em `(escolaId, vinculoId)` não garante que o ano letivo é o mesmo do vínculo.
- **Provedor de e-mail de produção (pergunta 1 do PRD):** sem dono nem data. Vai para a §12 ou para `docs/decisoes-em-aberto.md`.
- **§5, senha provisória:** trata só o login (`SEM_SENHA`) do aluno que entra pela conta da escola. Falta dizer o que acontece quando alguém tenta gerar a provisória para esse aluno (caso de borda do PRD).
- **Tamanho:** a Tech Spec tem 1.999 palavras, no limite de 2.000. As correções vão exigir cortar outro trecho.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/prd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/apps/api/src/credencial/secret-cipher.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/apps/api/src/estrutura/vinculo/vinculo.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/apps/api/src/estrutura/lista/lista.controller.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/packages/core/src/context/ano-em-curso.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/docs/modelo-de-dados.md

## frontend-reviewer · 2ª rodada · APROVADO · 2026-11-03 12:34:18 · `tasks/prd-onboarding-por-convite/revisao-spec.md`

VEREDITO: APROVADO
Tela vista: não (revisão de spec, ainda não existe tela nem foto)
Estados: ok no desenho. A §9 cobre vazio ("Baixar modelo"), erro (cada código com a frase do que fazer), com dado (prévia paginada) e o estado do envio/gravação. Carregando só aparece implícito em "estado". Fica como recomendação.
Acessibilidade: ok. A §10 e o `cenarios.md` exigem axe nos dois projetos. A tabela da grade tem cabeçalhos, e a marca tem rótulo de nome e matrícula.
Chromebook fraco: ok. XLSX carregado sob demanda (§9), prévia paginada de 100 e contagem em vez de lista longa, e teste com XLSX real.
Celular: ok. A correção da rodada 1 foi feita.
- A §10 diz que o e2e roda em `chromebook` e `celular`.
- O `cenarios.md` (seção E2E, linha 139) tem o caso de 360 px sem rolagem horizontal e alvo de 44 px nas ações principais.
- A §9 faz a grade rolar dentro do cartão a 360 px.

Ação oficial protegida: sim. A §9 pede confirmação da provisória com nome e turma e validade à vista. Aprovação de aluno e confirmação do professor entram no e2e (RF18).

Bloqueantes: nenhum

Recomendações:
- `prd.md` RF18 diz "e2e em `chromebook`", e a Tech Spec §10 diz `chromebook` e `celular`. Alinhe o RF18 para não confundir quem implementa.
- §9: diga que a prévia e a gravação têm estado de carregando (por exemplo, "Lendo a planilha…" e o progresso do job) e que o erro de rede na leitura oferece "Tentar de novo".
- `cenarios.md:139`: o caso de 360 px cobre só esqueci/redefinir, provisória e prévia com erro. Inclua também a tela de conta da escola na sala e a de verificar, que são telas do aluno no computador da escola e fora dela.
- O alvo de toque mínimo de 24 px para os controles secundários (marcas da prévia, paginação) poderia ser asserção do mesmo caso.

## tenancy-guardian · 2ª rodada · REPROVADO · 2026-11-03 12:36:10 · `tasks/prd-onboarding-por-convite/revisao-spec.md`

VEREDITO: REPROVADO

Tabelas verificadas: `importacao_planilha` (escola obrigatória; ano nulo só no tipo `professores`; FK composta), `alocacao`, `evento_calendario`, `link_da_conta` (global, declarada como exceção na §11 e na §6), as colunas novas de `convite`, `conta`, `credencial_matricula`, `vinculo` e `reivindicacao`, e o cookie `educa_conta_provada`. Fora da spec, conferi também o check `job_registro_escola_ou_sistema` em `packages/core/src/db/schema/job-registro.ts:63` e o `@Unscoped` do `packages/core/src/retencao/expurgo-de-acesso.repository.ts`.

Queries verificadas (pelo desenho): prévia e gravação com o ano resolvido no servidor; o job `estrutura.gravar-planilha` (`for update` por id e escola, toda troca de estado com `where estado = 'na_fila'`); o `email.enviar` pelo `EnvioRepository`; `GET /v1/grade` e `/v1/calendario` com o filtro de ano; a provisória; esqueci, redefinir e verificar; a reivindicação pelo cookie da conta provada; o `ligar`; as novas tarefas do `sistema.expurgar-acesso`.

Teste de isolamento: presente e efetivo. Tirando a cláusula, cada um destes quebra: "A contra B" em cada rota (`cenarios.md:112-114`), "matrícula da B sai entra" (`:26`), "o job usa a escola da linha com o payload adulterado" (`:61`), "cookie da sala de A num pedido da B" (`:102-103`) e "filtro com ano de outra escola" (`:117`).

**Os 3 bloqueantes da rodada 1:**
1. **Worker lendo a conta global: resolvido**, com uma lacuna que vira o bloqueante abaixo. A API grava o endereço cifrado na linha e o worker nunca lê a `conta` (§1, §5 "E-mail"). O `link_da_conta` é lido por um `@Unscoped` justificado no `EnvioRepository` (§5), que entra nas zonas do `architecture.test.ts` e na exceção do modelo de dados (§6, §11). A cifra usa o id da linha como dado autenticado, então o cifrado de uma linha não serve em outra (§3).
2. **Cookie sem escola: resolvido** (§5 "Conta da escola do aluno"; `docs/lgpd.md`; `cenarios.md:102-104`).
3. **Ano de destino da importação: resolvido** (§4, linhas 78-79; §3, linha 34; §5, linhas 92-94; `cenarios.md:58, 115-117`). O `anoLetivoId` virou um filtro que o servidor confere contra a escola da sessão, no padrão do `turma.ts`, e nunca decide a escola.

**Bloqueantes:**
- **`techspec.md:113-115` (§5 "E-mail") e linha 102 (tabela de estados): o tipo e a escola do job que envia o link da conta não estão definidos, e como escrito o banco recusa.**
  - **O que está errado.** O link do esqueci e do verificar sai pelo mesmo `email.enviar`. Mas o `link_da_conta` é global, e o esqueci é anônimo: não há escola para o registro do job. O check do banco (`packages/core/src/db/schema/job-registro.ts:63`) só aceita escola nula em tipo `sistema.%`. O desenho deixa duas saídas a quem implementar, e as duas quebram o isolamento:
    - afrouxar esse check, que é a trava de tenant da fila;
    - inventar uma escola para dado global, como a primeira escola da conta, abrindo contexto de tenant para o que não é de tenant.
  - **Correção exigida.** A §5 separa dois tipos de job:
    - o do link, de tipo `sistema.*` (por exemplo `sistema.enviar-email-da-conta`), com escola nula, lido só pelo método `@Unscoped` do `EnvioRepository`;
    - o do convite, `email.enviar`, com a escola do convite no registro do job, que o worker usa como contexto. O convite é lido por id e por essa escola, nunca pelo payload.

    O `cenarios.md` ganha três casos:
    - o registro do job do link tem escola nula e o do convite tem a escola do convite;
    - um id de convite da B num job da escola A não envia nada e não muda a linha;
    - o payload adulterado no job de e-mail é ignorado, como já está previsto no de planilha.

**Recomendações:**
- **§5 (tabela de estados) e §11: as escritas novas no expurgo não estão declaradas.** O `sistema.expurgar-acesso` passa a fazer, entre escolas, três coisas: passar para `falhou` o envio `na_fila` há 24 h no `convite` e no `link_da_conta`, apagar `linhas` da importação parada e apagar a importação depois de 90 dias. O repository já tem dois `@Unscoped`. Diga se isso entra no `apagarLoteVencido` (alvo novo) ou em método novo, com a frase de justificativa na §11, para não aparecer um terceiro sem desenho (regra 10, item 9). Declare também que a escrita de `enviado`/`falhou` no `link_da_conta` pelo `EnvioRepository` é `@Unscoped`, não só a leitura.
- **`cenarios.md:117`:** o caso "ano de outra escola" precisa usar um ano `planejado` da B. Com um ano em curso da B, a regra "só planejado" recusa sozinha, e o teste não pega a falta da cláusula de escola.
- **`techspec.md:51`:** o índice parcial da `reivindicacao` deve ser `(escolaId, provedor, tenant, sujeito)`, igual ao único da `conta_externa`, e não só `(escolaId, sujeito)`.
- **`cenarios.md:92`:** acrescentar "aluno só com conta externa de outra turma ou escola: 404, nunca `SEM_SENHA`". Assim fica provado que a checagem de escopo vem antes do `SEM_SENHA`.
- **§4 linha 71 contra `cenarios.md:116`:** a §4 aceita `anoLetivoId` na grade e no calendário, e o cenário diz que eles seguem o ano em curso. Escolha um. Se o filtro ficar, o professor só vê o ano em que tem vínculo confirmado.
- **§4:** na lista por turma, o `turmaId` com o `anoLetivoId` informado precisa ser de turma da escola e daquele ano. Ano trocado responde `NAO_ENCONTRADO`.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/packages/core/src/db/schema/job-registro.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/packages/core/src/retencao/expurgo-de-acesso.repository.ts

## test-engineer · 2ª rodada · REPROVADO · 2026-11-03 12:36:36 · `tasks/prd-onboarding-por-convite/revisao-spec.md`

VEREDITO: REPROVADO

**Cenários exigidos:** a lista da rodada 1 continua valendo: caminho feliz das quatro planilhas, convite, aceite, provisória e conta da escola; as bordas do domínio; permissão; isolamento A contra B; ano letivo; e as corridas em paralelo. Como o `cenarios.md` é novo, cada cláusula do PRD e cada cláusula nova da Tech Spec foi conferida contra ele.

**Cobertos:** dos meus 11 bloqueantes da rodada 1, oito foram resolvidos:
- **B2:** matrícula da B sai "entra" (`cenarios.md:26`), e a prévia de professores não distingue e-mail com conta na B (`:41`).
- **B4:** vínculo encerrado e aberto, nas linhas 48, 49, 89, 91 e 118.
- **B5:** virada de ano (`:36-38`), com a regra de "volta" definida na Tech Spec (`techspec.md:108`).
- **B6:** matrícula repetida na planilha (`:21`) e professor com duas disciplinas na turma (`:45`).
- **B8:** XLSX real na biblioteca real (`:13-14`, `techspec.md:196`).
- **B10:** professor desligado na A segue entrando na B (`:119`).
- **B11:** os testes da A1 que mudam de regra (`:129-131`).
- **Correções da §5 ligadas a teste:** login com resposta igual (`:95`), uso da provisória auditado (`:97`), cookie de outra escola (`:102`), ano encerrado entre gravar e o job (`:58`), job com payload adulterado (`:61`).

As recomendações da rodada 1 também entraram: consultas contadas em vez de cronômetro (`:15`), piso do "esqueci" por relógio falso (`:80`), RF18 dividido em casos e rodando em `celular`.

Sem IA. O e-mail usa adaptador falso. Sem código, então não há `.skip` a avaliar.

**Bloqueantes:**

1. **B1, em parte (`techspec.md:176-177`, `:118`).** Limites e taxas da §7c sem cenário. Cada um precisa da sua linha no `cenarios.md`, na seção da rota:
   - prévia 20/min por usuário, 429;
   - 2 prévias simultâneas por escola, com teste [P] que mostra a terceira recusada e a outra escola sem efeito;
   - balde `rl:ip:senha` do "esqueci", separado do login;
   - `EMAIL_POR_MINUTO` adia o job e não o marca `falhou`;
   - trocar-senha conta no contador da conta.

2. **B3, em parte (`cenarios.md:115-116`, `prd.md:87`).**
   - Na escola sem ano em curso faltam duas rotas: `GET /v1/importacoes/:id` e `GET /v1/sessao/externa/:provedor/iniciar`.
   - A borda do PRD "grade subida com o ano `planejado` vale quando o ano entrar em curso" não tem cenário. O cenário exigido: gravar a grade no ano planejado; o professor não vê nem confirma o vínculo; o ano vira; ele confirma e o `GET /v1/grade` mostra a alocação.
   - O escopo de `vinculo.repository.ts:255` usa `requireAnoEmCurso`, então a confirmação só abre depois da virada. A Tech Spec precisa dizer isso, e o teste precisa provar.

3. **B9, em parte: linhas da importação parada (`techspec.md:100`).** A rodada 0 tinha "o expurgo apaga a parada há 24 h", e isso saiu. Agora uma importação `na_fila` só fecha no gravar seguinte. Se a escola não gravar de novo, `linhas`, com nome e matrícula de aluno, ficam sem prazo.
   - **Correção:** o `sistema.expurgar-acesso` fecha como `falhou` a importação `na_fila` com mais de N horas, apagando `linhas` e `marcas`. O cenário [I] usa relógio injetado.

4. **B9, em parte: e-mail que volta (`prd.md:85` contra `techspec.md:118-119`).** O PRD promete "Falhou" para e-mail que volta, e a Tech Spec diz que a devolução posterior não é lida.
   - **Correção:** ou o PRD passa a dizer "recusado pelo servidor", ou a §11 registra o desvio do PRD, como fez com o RF15. Hoje a cláusula do PRD não tem teste possível.

5. **B7, em parte: e-mail duplicado (`cenarios.md:72` contra `techspec.md:116`).** O cenário está marcado [P], mas descreve uma sequência ("depois de `enviado`"). Pelo desenho da §5, o worker lê a linha, envia e só depois grava. Duas execuções simultâneas leem as duas `na_fila` e enviam duas vezes, então o teste paralelo de verdade cairia.
   - **Correção:** escolher um dos dois caminhos.
     - Reivindicar a linha antes de enviar (`update … where envio = 'na_fila' returning`), com o teste [P] mostrando um envio só.
     - Ou declarar que a duplicata simultânea é aceita pela D49, rebaixar o cenário a sequencial e escrever o caso paralelo como aceito.

6. **Corrida da §7c sem cenário: dois "Enviar convites" ao mesmo tempo (`techspec.md:179`).** Não há linha [P] no `cenarios.md`. O resultado esperado: um convite aberto por professor, o link do último vale e o do primeiro é recusado no aceite.

7. **Corrida da §7c sem cenário nem trava: turma "8º A" criada à mão contra "8A" criada pelo job (`techspec.md:179`, §3).** "Já existe no job" é checar e depois inserir. Sem um único `(escolaId, anoLetivoId, chave normalizada)` em `turma`, as duas transações criam turmas duplicadas.
   - **Correção:** a restrição na §3 e um cenário [P] que termina com uma turma só.

8. **RF6 sem desenho nem teste (`prd.md:51`; `techspec.md:110` diz só "o cadastro da A1"; `cenarios.md:39-42`).**
   - "Até 300 linhas" não aparece na Tech Spec, que fala em 3.000 linhas para todas as rotas (`:176`).
   - "Ausente na reimportação só desliga marcado", para professor, não tem fluxo nem cenário.
   - **Correção:** o teto e o desligamento por marca no fluxo, e dois cenários: 301 linhas é erro; o professor ausente segue ativo, e com a marca é desligado pelo `desativar`.

9. **RF7 e a borda "grade com professor não convidado" sem cenário (`prd.md:52`, `:82`).**
   - O `cenarios.md:18-20` cobre só a turma nova.
   - Falta: disciplina e professor inexistentes saem "novo" na prévia e nascem ao gravar; o professor nascido da grade entra no "Enviar convites" seguinte, sem seleção.
   - A linha da grade sem professor também precisa de cenário: é erro na linha (recomendação da rodada 1, e agora a FK de `alocacao.vinculoId` torna a regra obrigatória).

10. **RF10: "com a diferença na prévia" sem cenário (`prd.md:55`; `cenarios.md:54` só tem "substitui").** O cenário exigido: reimportar o calendário com um evento a menos e um a mais, e a prévia mostra os dois antes de gravar.

11. **RF14, duas cláusulas sem cenário (`prd.md:59`; `cenarios.md:100-107`).**
    - "O banco não tem e-mail nem foto do provedor": com o `oidc-falso` devolvendo e-mail e foto, a `reivindicacao.contaExterna` guarda só provedor, tenant e sujeito, e a `conta_externa` também.
    - O caminho feliz de "ligar em Eu": o aluno entra por matrícula, liga a conta e depois entra pela conta. Hoje só existe a corrida (`:107`).

12. **Borda do PRD "homônimos na turma" sem cenário (`prd.md:79`).** Escapou na minha rodada 1. O cenário exigido: dois alunos com o mesmo nome e matrículas diferentes na mesma turma saem dois "entra"; na reimportação, corrigir o nome de um não toca o outro.

13. **Cláusulas novas da Tech Spec sem cenário.**
    - "Redefinir pelo esqueci também verifica" o e-mail (`techspec.md:123`, `:127`): o `cenarios.md:76` só cobre o aceite. Falta o cenário em que redefinir grava `emailVerificadoEm` e o convite copiado de outra escola deixa de pedir verificação.
    - "Envio `na_fila` há 24 h: o expurgo grava `falhou`" (`techspec.md:102`): falta o cenário com relógio injetado, que mostra também os cifrados nulos.

**Recomendações:**
- RF13: um cenário sequencial explícito em que o login com a provisória, depois da troca, recebe a resposta da credencial inválida.
- Cookie `educa_conta_provada`: verificar no `Set-Cookie` os atributos `HttpOnly`, `Secure`, `SameSite=Lax` e `Path=/v1/salas`, e que o valor não traz o sujeito em claro.
- FK composta `(escolaId, anoLetivoId)` nas tabelas novas: provar no teste de schema, não só na revisão.
- A prévia que mostra nome do banco audita `turma.alunos_lidos`, e a que não mostra não audita (regra 20, item 10). Fica como recomendação desde a rodada 1, mas vale virar cenário.
- `cenarios.md:98`: dizer 429 nas cotas da provisória.
- `cenarios.md:42`: a Tech Spec dizer como o job trata a violação do único da `conta`, por exemplo um `on conflict` que relê, para as duas importações saírem `concluida`.
- RF15, "a tela diz quando terminou": um passo no e2e.
- Mutações para a fase de tarefas, como na rodada 1, com dois acréscimos:
  - a condição `provisoria_hash = :doBilhete` na troca;
[… 3 linhas cortadas]

## privacy-guardian · 2ª rodada · REPROVADO · 2026-11-03 12:36:50 · `tasks/prd-onboarding-por-convite/revisao-spec.md`

VEREDITO: REPROVADO

Campos pessoais tocados: nome e matrícula do aluno (prévia e `importacao_planilha.linhas`); nome e e-mail da equipe; identificador opaco da conta da escola (`reivindicacao.contaExterna` e o cookie `educa_conta_provada`); `vinculo.origem`; `alocacao`; `evento_calendario.descricao`; estado do envio e os cifrados de `convite` e `link_da_conta`; `conta.emailVerificadoEm`; a senha provisória (hash, validade e quem gerou).

Fora da tabela de dados do docs/lgpd.md: nenhum. O cookie entrou na seção 2. A linha que sobra de `importacao_planilha` agora tem prazo de 90 dias e autor `set null`.

Autorização por objeto: falha na senha provisória. Quem gera a senha ainda consegue entrar na conta do aluno sem que ele saiba (B2, abaixo). Nas outras rotas está ok: grade, provisória, importação e cookie amarrado a escola e acesso da turma (§5, §6, §7).

Logs: limpos (§7, "Log").

Auditoria: presente, mas com uma brecha no uso da provisória. A ação `senha_provisoria.usada` não diz quem usou. Se for a coordenação, ela lê o dado do aluno sem a auditoria de leitura que a regra 20, item 10 exige.

Envio externo: só endereço e texto de e-mail da equipe (convite, redefinir, verificar), nunca dado de aluno, para o provedor de e-mail. Ele entra em `suboperador` com alcance de professor e coordenador antes do portão. Não há IA.

Seed/fixture: sintético (§7, "Fixture").

**Conferência da rodada 1**
- **B1, `SEM_SENHA` revela a matrícula:** corrigido. A §5 (techspec.md:131-132) responde com a credencial inválida para qualquer falha, inclusive aluno só com conta externa. O `SEM_SENHA` vai só a quem gera. O teste comparativo está em cenarios.md, seção "Senha provisória".
- **B2, provisória sem rastro do uso:** corrigido em parte. Já existem a auditoria do uso (§5, techspec.md:134; §7), o teste (cenarios.md) e o risco escrito na §13 (techspec.md:218-219). Falta o lado do aluno (detalhe em Bloqueantes).
- **B3, cookie da conta provada:** corrigido. A §5 (techspec.md:136-139) pede AES-GCM, `HttpOnly`, `Secure`, `Lax` e `Path=/v1/salas`; a rota real é `POST /v1/salas/reivindicar`, em `apps/api/src/sala/salas/salas.controller.ts:36`. O cookie dura 15 min e é apagado quando o pedido é gravado. A linha está no `docs/lgpd.md`, e o teste do segundo pedido está em cenarios.md, RF14.
- **B4, ciclo de vida das tabelas novas:** corrigido.
  - §3: `erro` virou código de lista fechada, com check. `alocacao` sai em cascata com o vínculo. `criadoPor` e `provisoriaGeradaPor` ficam `set null`. `link_da_conta` sai com a conta.
  - Prazo de 90 dias na tabela de estados da §5 e no `docs/lgpd.md`.
  - O teste de eliminação está em cenarios.md, seção "Auditoria e dado".
- **B5, DTO das saídas novas:** corrigido. A §4 lista os campos da grade (professor só com id e nome), do calendário, da importação e de `envio`/`enviadoEm`. A §7 diz "nunca cifrado", e o `contracts.test.ts` está nos cenários.
- **B6, token reversível guardado:** corrigido. A §3 (techspec.md:54-55) deixa os cifrados nulos em qualquer estado que não `na_fila` e na revogação. O `docs/lgpd.md` foi alinhado, e o teste está em cenarios.md, RF11.

**Sobre a pergunta do B2: a mitigação da §13 não basta.** O aluno "perde a senha e percebe" que ficou sem acesso, mas não percebe que alguém entrou. A próxima provisória quem gera é justamente quem pode ter entrado.

O `docs/lgpd.md:51` promete que o texto da conversa com o Tutor "só o próprio aluno lê". Hoje a coordenação, ou o professor da turma, chega a esse texto e ao arquivo completo de "Meus dados" sem deixar rastro de quem leu. D81 explica o mecanismo, mas não cobre a falta de rastro.

Bloqueantes:
- **techspec.md:129-134 (§5, "Senha provisória") e :218-219 (§13).** O que está errado: o uso da provisória é auditado, mas sem dizer quem usou, e o aluno nunca fica sabendo que alguém usou. Isso quebra a promessa do `docs/lgpd.md:51` e deixa a leitura feita pela coordenação sem a auditoria da regra 20, item 10. Correção exigida, uma das duas:
  - **(a) Sai barato e não muda o PRD.** A tela "trocar a provisória", que já é tela nova na §9, mostra a quem troca a data da troca por provisória anterior e o papel de quem gerou cada uma. Exemplo: "sua senha anterior foi criada em 02/11, às 10h03, com uma provisória gerada por um professor". Assim o aluno verdadeiro descobre na próxima troca. Além disso, `senha_provisoria.gerada` e `.usada`, em que ele é o alvo, entram no arquivo do titular em "Meus dados". Cada coisa com seu cenário em cenarios.md.
  - **(b) Parada do Joaquim.** Ele aceita o risco residual por escrito, com data, na §13, e a linha da conversa no `docs/lgpd.md:51` passa a dizer a verdade à controladora: quem gera a provisória pode entrar na conta.

Recomendações:
- §5: escrever que o login por matrícula calcula um hash só por tentativa e usa o hash fixo quando `senha_hash` está nulo (aluno só com conta externa, ou depois de gerar a provisória). Assim o B1 também vale pelo tempo de resposta, como no `matricula.service.ts:53-55`.
- §5: o bilhete não deve levar o hash da provisória de forma legível. Melhor uma referência com HMAC ou o bilhete cifrado, e nunca no armazenamento do navegador.
- `docs/lgpd.md`, linha da senha provisória: citar também a auditoria `senha_provisoria.usada`.
- cenarios.md, RF16: trocar "vínculo aberto na Y" por "confirmado", como na §4.
- `importacao_planilha.resumo`: só contagens, com esquema estrito em `packages/shared`.
- PRD §8: retirar o "id no provedor", que a Tech Spec não guarda.
- §13: registrar que um link copiado que vazou revela, pelo `VERIFICACAO_PENDENTE`, que aquele e-mail tem conta em outra escola cliente (risco baixo).

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/prd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/docs/lgpd.md

## infra-guardian · 2ª rodada · REPROVADO · 2026-11-03 12:37:26 · `tasks/prd-onboarding-por-convite/revisao-spec.md`

VEREDITO: REPROVADO
Caminho quente tocado: login | sala | fila | migration
Rate limit: por IP (só no e-mail de verificação do aceite; o resto está ok)
Fila e prioridade: problema
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: compatível
Métrica e alerta: ok

**Os quatro bloqueantes da rodada 1 foram corrigidos:**
- **Job rodando duas vezes:** a §5 "O job" (techspec.md:92-96) põe o `select … for update` como primeira instrução e sai se a linha não estiver `na_fila`. Toda troca de estado leva `where estado = 'na_fila'`, e o cenário [P] está em cenarios.md:57.
- **Provisória usada duas vezes:** a §5 "Senha provisória" (techspec.md:131-134) leva o hash no bilhete e troca com `update` condicionado, auditando `senha_provisoria.usada`. O risco está na §13 e o cenário [P] em cenarios.md:96.
- **`convite.canal` sem padrão:** a §3 (techspec.md:47) agora tem `not null default 'copiado'`, com o check, e a troca do check `reivindicacao_segredo_so_pendente` em `not valid` + `validate`.
- **Tempo da prévia na requisição:** a §7c "Tempo" (techspec.md:178) fixa p95 de até 2 s em 3.000 linhas, com a rajada em paralelo. O cenário [C] está em cenarios.md:16 e o desvio do RF15 está na §11.

**Bloqueantes:**

1. **techspec.md:98-101 (§5, tabela de estados, linha `na_fila`). A correção deixou um estado sem saída.**
   - **O problema:** quando o job de planilha esgota as tentativas ou dá erro definitivo, o `job-executor` marca só o `job_registro` como `falhou` (apps/worker/src/job-executor.ts:425-433). Nenhum processador usa `ultimaTentativa`. Na tabela, a única saída de `na_fila` além do job é "o gravar seguinte, depois de 1 h". Se a coordenadora não grava de novo, três coisas acontecem:
     - a linha fica `na_fila` para sempre, com `linhas` guardando nome e matrícula de menores;
     - o expurgo de 90 dias não pega a linha, porque só vale para estados finais;
     - a tela consulta o estado sem fim, e o alerta de 30 min dispara sem parar.
   - **Correção exigida:**
     - Na falha definitiva (`JobFailureError` definitiva ou última tentativa), o processador grava `falhou` com o código de lista fechada, `where estado = 'na_fila'`, e apaga `linhas` e `marcas`.
     - O `sistema.expurgar-acesso` fecha como `falhou` (`expirada`) toda `na_fila` com mais de 1 h, sem esperar um gravar novo.
     - A linha entra na tabela de estados, com dois cenários [I] em cenarios.md: tentativas esgotadas viram `falhou` com dado nulo; `na_fila` antiga sem gravar novo é fechada pelo expurgo.

2. **techspec.md:121-123 (§5, "Posse do e-mail") e techspec.md:177 (§7c, "Rate limit"). Um caminho que manda e-mail tem só limite por IP.**
   - **O problema:** cada aceite de convite copiado por conta sem verificação cria um `link_da_conta` de `verificar` e manda um e-mail, substituindo o anterior. Hoje o `/v1/convites/aceitar` só tem o limite por IP da rota anônima (apps/api/src/sessao/convite/convite.controller.ts:15-17). Quem tem o token do convite pode repetir o aceite e encher a caixa de e-mail do dono da conta. Cada e-mail também gasta a `EMAIL_POR_MINUTO`, que é global, e atrasa os convites e o "esqueci" das outras escolas.
   - **Correção exigida:**
     - Limite por conta para o e-mail de verificação (por exemplo 3/h, como o "esqueci"), rebaixando: responde `VERIFICACAO_PENDENTE` sem novo envio.
     - Com link de verificar aberto e recente, reaproveitar esse link em vez de substituir.
     - Linha na §7c "Rate limit" e cenário [I] em cenarios.md: o quarto aceite na hora dá `VERIFICACAO_PENDENTE` e três envios.

**Recomendações:**
- **§5 "Planilha" (gravar que fecha a `na_fila` de mais de 1 h):** usar `for update nowait` ou `lock_timeout` com resposta `CONFLITO`. Sem isso, o request fica esperando a transação de um job que está rodando nessa linha.
- **§5 "O job":** travar o ano de destino em `FOR SHARE` durante toda a transação, como o `lista.service` faz. Conferir só no início não impede o `encerrar` do ano no meio do job.
- **§13 "A transação do job segura turmas":**
  - Pôr o "medir no cenário" em cenarios.md como [C]: job com transferências em várias turmas rodando junto com o gerar acesso e a decisão nessas turmas, medindo a espera de trava e o p95.
  - O `encerrar` trava a turma em `FOR NO KEY UPDATE`, então quem espera é o gerar acesso das 7h30.
  - Declarar a ordem das travas entre pedido e turma, para não abrir deadlock com `travarPendente`.
- **§5 "E-mail":** o `enviado` também com `where envio = 'na_fila'`. Hoje uma revogação entre a leitura e a gravação vira `enviado` na tela.
- **§7c "Limite por escola":** dizer que as 2 prévias simultâneas por escola ficam no Redis (regra 80, item 5). O gravar, que refaz a classificação, deve contar no mesmo balde de 20/min e no mesmo semáforo.
- **§3 `alocacao`:** índice `(escolaId, anoLetivoId)` para a grade da escola inteira, para o `delete` do que saiu na reimportação e para a FK composta.
- **§7c "Rate limit", `rl:ip:senha`:** dizer o teto do balde de IP e deixar claro que ele rebaixa, não responde 429. A escola inteira sai por um IP.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/prd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/apps/worker/src/job-executor.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/apps/api/src/sessao/convite/convite.controller.ts

## revisor-geral · 2ª rodada · REPROVADO · 2026-11-03 12:37:58 · `tasks/prd-onboarding-por-convite/revisao-spec.md`

VEREDITO: REPROVADO
Escopo: incompleto. O desenho continua dentro do F2 recortado: a N1 da A1 é do F2 (`tasks/prd-apresentacao-escola/validacao.md:133`) e a posse do e-mail agora está no PRD. Mas a correção 1 da rodada 1 ficou pela metade, e falta desenho para o nome corrigido de aluno aprovado.
Aderência à Tech Spec: divergência no §1 e no §2 (o worker alcança a conta global) e no §5 (onde está o nome do aluno aprovado)
Portão local: não se aplica a revisão de spec. O `conferir` responde "nunca passou nesta árvore", o que é esperado sem código.

**Como ficaram os 6 bloqueantes da rodada 1**
1. O que sobe para o core (`techspec.md` §2, linhas 22–23, e §5): **feito pela metade**. A cifra, o `encerrar` e os repositories de estrutura estão listados, e a transferência e o "sai da grade" passam pelo `encerrar`. O que falta está no bloqueante 1 abaixo.
2. Posse do e-mail: **resolvido**. Está no PRD §7 como caso de borda e no §5 da Tech Spec. Por isso deixou de ser divergência e não precisa entrar no §11.
3. Ano planejado: **resolvido**. O §4 (linhas 78–79) usa um filtro validado no servidor, que aceita só o ano planejado da escola da sessão. O job sai `desatualizada` se o ano mudou (§5), e os cenários de isolamento e de ano letivo cobrem o caso.
4. Rotas da lista da A1: **resolvido**. Elas ficam no mesmo endereço, com o contrato da importação e resposta 202 (§4, linhas 80–81). O `cenarios.md:127` diz quais casos do `lista.int.test.ts` mudam.
5. Onde a `Aula` da F2b se prende: **resolvido**. A reimportação mantém o id da alocação por (vínculo, dia, início), e a `Aula` aponta para a alocação (§3, linhas 60–62, e §11).
6. Desligamento do nome não aprovado: **resolvido**. O §5 (linha 107) apaga a linha da lista e encerra o pedido, e o §7 audita `lista_nome.retirado`.

Bloqueantes:

1. **O worker alcança a conta global, e a spec diz que não alcança.** Os trechos são `techspec.md:15` ("o worker nunca lê a `conta`"), `techspec.md:22` ("sobe de `professores/` o cadastro do professor") e o §6 e o §11.
   - **O cadastro do professor não está em `professores/`.** Está em `apps/api/src/sessao/convite/convite.service.ts:208`, que chama `TenantResolutionRepository.contaParaConvite`. Esse método acha ou cria a `conta` global pelo e-mail.
   - **Essa classe é cercada.** Só pode aparecer dentro de `apps/api/src/sessao/` (`apps/api/test/architecture.test.ts:49`).
   - **O job precisa desse cadastro.** O job da planilha de professores e o da grade, quando o professor ainda não existe, rodam no worker e cadastram professor. Logo, o worker lê e cria `conta`, e esse caminho não está declarado no §6, no §11, na exceção do `docs/modelo-de-dados.md` nem nas zonas do `architecture.test.ts`.
   - **O fechamento do pedido de nome também não sobe.** Ele está em `apps/api/src/sala/decisao/decisao.repository.ts`: a trava `travarPendente` (linha 106) e o `fechar` (linha 139), que apaga hash, chave e marca de matrícula errada. A transferência e o desligamento que o job faz precisam dos dois, e o cenário [P] "job contra o professor aprovando" exige a mesma trava da decisão. Do jeito que está, o implementador escreve no core um segundo jeito de fechar pedido.
   - **Correção exigida:**
     - O §2 diz que `contaParaConvite` (ou o cadastro inteiro, que hoje está em `sessao/convite`) sobe para o core.
     - O §6 e o §11 declaram esse acesso à conta global como exceção, com a frase do `@Unscoped`.
     - A nova zona entra no `architecture.test.ts` e no `docs/modelo-de-dados.md`.
     - O §1 deixa de afirmar que o worker nunca lê a `conta`.
     - O §2 lista também a trava e o fechamento do pedido de nome, que passam a viver num lugar só.

2. **O nome corrigido de aluno aprovado vai para a tabela errada** (`techspec.md:105` e `cenarios.md:24`).
   - O cenário diz "Nome corrigido atualiza `lista_nome`". Só que, no aluno aprovado, a linha da `lista_nome` não tem nome nem matrícula (check `lista_nome_aprovado_sem_nome`, `docs/lgpd.md`). O nome está em `usuario.nome` e a matrícula em `credencial_matricula`, que é onde a A1 já procura (`apps/api/src/estrutura/lista/lista.repository.ts:51`).
   - Na reimportação, quase todos os alunos já estão aprovados. Seguindo o cenário, o RF4 ("nome corrigido atualiza") falha justamente para eles, ou a gravação esbarra no check.
   - **Correção exigida:**
     - O §5 diz que, para o aluno aprovado, a classificação lê a matrícula em `credencial_matricula` e o nome em `usuario`, e que o nome corrigido atualiza `usuario.nome`, com a mesma auditoria sem nome.
     - O `cenarios.md:24` ganha esse caso.

Recomendações:
- **PRD RF16 (`prd.md:61`):** diz "só o ano em curso", e isso contradiz o caso de borda do ano planejado. Alinhe o texto.
- **PRD RF18 (`prd.md:63`):** diz só `chromebook`. Inclua `celular`, como o §10 já faz.
- **Posse do e-mail e testes da A1:** a regra muda os casos 320, 377 e 447 de `apps/api/test/convite.int.test.ts`, em que uma conta de outra escola aceita convite por link copiado. O `cenarios.md:127` não os lista. Diga também se o `VERIFICACAO_PENDENTE` vale para o convite de coordenador feito pelo painel da operação, que o PRD deixou fora do escopo (A0b).
- **A palavra do Joaquim sobre a posse:** registre a data no PRD (que ainda diz "aprovado 03/11" sem citar a revisão) ou no `estado.md`.
- **Documentação:** a atualização do `docs/modelo-de-dados.md` e do glossário (§3, linha 62) precisa de uma tarefa dona no `tasks.md`.
- **Link do convite criado pelo job:** o professor que o job cadastra não devolve token para a coordenação copiar. Diga que o "Copiar link" desses professores passa pelo `convite/refazer`.
- **Índice de pedido pendente:** o índice único parcial `(escolaId, sujeito)` em `reivindicacao` não inclui provedor nem tenant.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/prd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/apps/api/src/sessao/convite/convite.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/apps/api/test/architecture.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/apps/api/src/sala/decisao/decisao.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/apps/api/src/estrutura/lista/lista.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/apps/api/test/convite.int.test.ts

## frontend-reviewer · 3ª rodada · APROVADO · 2026-11-03 12:47:21 · `tasks/prd-onboarding-por-convite/revisao-spec.md`

VEREDITO: APROVADO

Tela vista: não. É revisão de Tech Spec e não existe tela nem foto. Li o diff acumulado e o `cenarios.md` (seções "Senha provisória" e "E2E").

Estados: ok no desenho da prévia. Em §9, vazio tem "Baixar modelo", falha tem "Tentar de novo", e o `cenarios.md` cobre carregando e falha. Falta o mesmo para a lista de trocas da tela "trocar a provisória". Está nas recomendações 1 e 2.

Acessibilidade: ok. O e2e passa a rodar com axe em `chromebook` e `celular`. §9 manda tabela com cabeçalhos e a grade com rolagem dentro do cartão. A lista de trocas ainda não diz se é lista ou tabela com cabeçalhos, nem como o leitor de tela a anuncia.

Chromebook fraco: sem alteração. A lista de trocas vem de um `GET` leve, só com data e papel.

Celular: ok. O RF18 agora roda em `celular`. O `cenarios.md` fixa 360 px sem rolagem horizontal, alvo de 44 px nas ações principais e 24 px no resto, e esses e2e cobrem a tela de troca. Nenhum fluxo exige o celular.

Ação oficial protegida: sim. A senha provisória confirma nome e turma antes de gerar (§9), é mostrada uma vez, e geração e uso vão para a auditoria. A tela de troca mostra ao aluno quem gerou as provisórias anteriores. Isso reduz o risco de §13: o gerador pode entrar na conta do aluno.

Bloqueantes: nenhum.

Recomendações:
1. §9 e §5 "Senha provisória" não definem o carregando, o vazio e a falha da lista de trocas.
   - **Vazio:** é o caso da primeira troca de todo aluno. A lista deve sumir ou dizer uma frase positiva, como "Esta é a primeira vez que você troca por uma senha provisória". Não deve mostrar uma tabela vazia.
   - **Falha:** se o `GET .../trocas` falhar, o formulário de nova senha não pode ficar bloqueado nem mostrar erro técnico. Mostre um aviso curto com "Tentar de novo" e deixe a troca seguir.
   - **Carregando:** não bloqueie o campo de senha enquanto a lista carrega.
   - Acrescente um `[E]` ou `[I]` no `cenarios.md` para esses estados, como já existe para a prévia.
2. §13 diz que o aluno "vê, na troca seguinte, a provisória que não usou", mas §4 e §5 só falam em "trocas anteriores por provisória". Defina se a lista inclui geração sem uso, com estado "não usada". Se incluir, o `cenarios.md` precisa de um teste para isso. Se não incluir, corrija §13 e `docs/lgpd.md`.
3. §9 deve pedir texto em português comum: "Gerada pela coordenação em 12/11/2026 às 14:05", e não o enum de papel nem data ISO. O formato local de data é o item 7 da lista de verificação.
4. A lista de trocas deve ter nome acessível ("Trocas anteriores por senha provisória") e não ser a única forma de transmitir a informação, pois o aluno está em computador de escola ou celular.
5. A lista aparece só depois do login com a provisória, e o bilhete vale 10 minutos. Vale o `cenarios.md` cobrir o bilhete expirado na tela: mensagem com "volte a pedir a senha ao professor", e não um erro genérico.

## tenancy-guardian · 3ª rodada · REPROVADO · 2026-11-03 12:48:08 · `tasks/prd-onboarding-por-convite/revisao-spec.md`

VEREDITO: REPROVADO

Tabelas verificadas: `importacao_planilha` (tem `escolaId`; `anoLetivoId` só pode ser nulo no tipo `professores`; FK composta), `alocacao`, `evento_calendario` (`escolaId`, `anoLetivoId`, FK composta, índice `(escolaId, anoLetivoId)`), `link_da_conta` (é da conta global, e o desvio está declarado na §11, regra 10 item 1), `convite`, `conta`, `credencial_matricula`, `turma.chave` (o único parcial `(escolaId, anoLetivoId, chave)` inclui a escola, então "8A" da B não colide com a A), `vinculo.origem`, `reivindicacao.contaExterna` (o único parcial agora inclui `escolaId`). Todo id é `uuid` com `uuidv7()`.

Queries verificadas:
- Prévia e gravar de cada tipo, escola tirada do contexto. O `anoLetivoId` é filtro validado no servidor: aceita só o planejado da escola da sessão, e outro valor dá `NAO_ENCONTRADO`. O `turmaId` é conferido na escola e no ano.
- Job `estrutura.gravar-planilha`: a escola vem do outbox e da linha, nunca do payload.
- `email.enviar-convite`: escola do convite no `job_registro`, convite lido por id e escola.
- `sistema.enviar-email-da-conta`: escola nula (garantida pelo check `job_registro_escola_ou_sistema`, que já existe), `@Unscoped` justificado no `EnvioRepository`.
- Expurgo: escopo da escola no laço que já existe; `link_da_conta` com `@Unscoped`.
- Grade e calendário: coordenador com filtro do planejado; professor só com vínculo confirmado no ano em curso.
- Senha provisória: o escopo é conferido antes do `SEM_SENHA`.
- `/v1/sessao/matricula/trocas`: aluno tirado do bilhete cifrado.
- `convites/enviar`: `usuarioIds` da outra escola são tratados como inexistentes.
- `ContaGlobalRepository.contaParaConvite` saindo de `packages/core/src/estrutura/`.

Nenhuma rota aceita `escolaId` do cliente.

Teste de isolamento: presente e efetivo. O `cenarios.md`, seção "Isolamento e ano letivo", põe A contra B em cada rota e nos dois jobs de e-mail. Também cobre payload adulterado, convite da B num job da A e matrícula da B na planilha da A. Sem a cláusula de escopo, cada um desses cenários quebra.

Bloqueante da rodada 2: resolvido. A §5 "E-mail" e a §7c têm os dois jobs separados, e os cenários RF11 cobrem os dois. As recomendações da rodada 2 também foram feitas:
- escritas do expurgo declaradas na §5;
- índice da reivindicação com a escola na §3;
- 404 antes de `SEM_SENHA` na §5 e nos cenários RF13;
- filtro do planejado na grade e no calendário (§4 e cenários);
- `turmaId` da lista conferido no ano (§4 e cenários).

Bloqueantes:
- **§6 (e §2, §11). A cerca da `ContaGlobalRepository` vira uma pasta inteira de repositories com escopo.**
  - **O que está errado:** a §6 diz que a zona da classe "ganha `packages/core/src/estrutura/`". Essa pasta vai receber os repositories de turma, série, disciplina, lista e vínculo, e a gravação do job. A cerca abre para eles a classe toda, não só o `contaParaConvite`: entram junto `encerrarSessoesDaConta`, `travarConta` e `limparContaSemUso`, que escrevem na conta global sem escopo.
  - **Por que é bloqueante:** a §1 afirma que, no worker, "só o cadastro do professor alcança a conta global". Com a zona na pasta inteira, nenhum teste prova isso. Se o repository de turma importasse a classe, nem o `architecture.test.ts` nem a guarda de camadas reprovaria.
  - **A guarda esquecida:** a spec não cita a segunda cerca que existe hoje, `tools/guardas/camadas.cjs`, regra `cerca-conta-global` (fixtures em `tools/guardas/camadas.test.ts`).
  - **Correção exigida:** a zona é o **arquivo** do cadastro do professor em `packages/core/src/estrutura/`, como já se faz com o `PainelRepository` (zona por arquivo). Isso vale nas duas guardas: `ZONAS_DAS_CLASSES_CERCADAS` em `apps/api/test/architecture.test.ts` e `pathNot` da `cerca-conta-global` em `tools/guardas/camadas.cjs`. Cada uma ganha uma fixture que reprova outro arquivo da mesma pasta importando a classe. A §6 nomeia o arquivo e as duas guardas.

Recomendações:
- §11, linha da regra 10 item 9: o `contaParaConvite` vira o quarto `@Unscoped` da `ContaGlobalRepository`. O comentário da classe (`packages/core/src/ciclo-de-vida/conta-global.repository.ts`) diz que já está no limite da regra e que qualquer outro é mudança de spec. Na conta do sistema não muda nada, porque o método só troca de classe, mas registre isso na §11 e atualize o comentário da classe, a justificativa do `@Unscoped` (que hoje cita "o comando ou o painel") e o `tenant-resolution.repository.test.ts`, que lista o método.
- Cenários RF6: o `resumo` do job de professores e a auditoria `planilha.gravada` não podem distinguir e-mail com conta em outra escola de e-mail novo. O `nova` que o `contaParaConvite` devolve não chega à contagem. Falta um cenário igual ao da prévia, aplicado à saída do job.
- §6: nomear a zona do `EnvioRepository`, que mistura métodos com escopo (convite) e `@Unscoped` (`link_da_conta`): o processor `enviar-email.ts` e o expurgo, com a mesma cerca por arquivo nas duas guardas.

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/apps/api/test/architecture.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tools/guardas/camadas.cjs
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/packages/core/src/ciclo-de-vida/conta-global.repository.ts

## privacy-guardian · 3ª rodada · REPROVADO · 2026-11-03 12:49:15 · `tasks/prd-onboarding-por-convite/revisao-spec.md`

VEREDITO: REPROVADO

O B2 da rodada 2 foi resolvido para quase todos os alunos, mas sobra um grupo: o aluno que tem a conta da escola ligada e também uma senha. Para ele, a correção (a) não funciona. É o único bloqueante. As outras mudanças desta rodada não abriram problema novo.

**Conferência do B2 e das recomendações da rodada 2**
- **B2, a provisória sem rastro:** resolvido em parte. Estão na spec:
  - a rota `GET /v1/sessao/matricula/trocas`, pelo bilhete (§4);
  - a tela de troca listando as trocas anteriores por provisória, com a data e o papel de quem gerou (§5);
  - a `.usada` com o aluno como autor, e as duas ações (`.gerada` e `.usada`) no arquivo do titular (§5);
  - o risco escrito na §13 e a linha da provisória no `docs/lgpd.md`;
  - os cenários em "Senha provisória".
  
  Falta o caso do bloqueante abaixo.
- **Hash fixo para o aluno sem senha e bilhete cifrado (§5):** feitos. O cenário usa um espião no argon2, sem cronômetro. O texto do bilhete não traz o hash.
- **`resumo` só com contagens e esquema estrito (§2, §3):** feito.
- **"id no provedor" no PRD §8:** retirado.
- **Risco do `VERIFICACAO_PENDENTE` (§13):** escrito.
- **Isolamento com vínculo pendente e contestado:** está no `cenarios.md`, seção RF16.

**Mudanças novas desta rodada**
- **`usuario.nome` corrigido pela planilha (§5 "Gravar"):** ok. O aluno é achado pela `credencial_matricula` com o escopo da escola. A auditoria não leva o nome. Há cenário para matrícula da escola B.
- **Cadastro do professor no worker (§6):** ok. O `contaParaConvite` acha ou cria a conta e devolve só o id. A prévia não distingue o e-mail que já tem conta em outra escola (RF6). A lista de professores ganha só `envio` e `enviadoEm`.
- **`turma.chave` (§3):** não é dado pessoal.

---

Campos pessoais tocados: nome e matrícula do aluno (prévia, `importacao_planilha.linhas` e `usuario.nome` corrigido); nome e e-mail da equipe; identificador opaco da conta da escola (`reivindicacao.contaExterna`, cookie `educa_conta_provada`); `alocacao`; `evento_calendario.descricao`; estado do envio e os cifrados de `convite` e `link_da_conta`; `conta.emailVerificadoEm`; senha provisória (hash, validade, quem gerou) e as trocas mostradas ao aluno.

Fora da tabela de dados do docs/lgpd.md: nenhum.

Autorização por objeto: falha na senha provisória, para o aluno com conta da escola ligada e senha (bloqueante). As outras rotas estão ok: grade, importação, cookie preso a escola e acesso da turma, e a rota de trocas presa ao aluno do bilhete, com cenário de outro aluno.

Logs: limpos (§7, "Log", sem resposta do SMTP; `nodemailer` sem `logger` nem `debug`).

Auditoria: presente (§7). O furo é de alcance, não de registro: este aluno não vê o registro sem abrir "Meus dados".

Envio externo: o provedor de e-mail recebe só endereço e texto da equipe (convite, redefinir, verificar), nunca dado de aluno. Ele entra em `suboperador` antes do portão. Não há IA.

Seed/fixture: sintético (§7, "Fixture").

Bloqueantes:
- **Tech Spec §5, "Senha provisória" ("aluno só com conta externa: `SEM_SENHA`"), e §13.**
  - **O que está errado:** pelo RF14, o aluno que entrou por matrícula pode ligar a conta da escola em "Eu". Ele fica com as duas formas de entrar. Para esse aluno, gerar a provisória funciona: a senha dele é apagada e as sessões caem.
    1. Quem gerou entra com a provisória, cria uma senha e lê o que só o aluno lê. Isso inclui o texto do Tutor, que o `docs/lgpd.md` promete que "só o próprio aluno lê".
    2. O aluno volta a entrar pela conta da escola sem perceber nada. Ele nunca passa pela tela de troca, então a lista de trocas nunca aparece para ele.
    3. A mitigação da §13 ("na troca seguinte, vê a provisória que não usou") não chega a ele. O rastro fica só no arquivo de "Meus dados", que ele quase nunca abre.
    
    A spec também diverge do PRD §7: "Aluno com conta da escola pede senha provisória → a tela diz que ele entra pela conta". O PRD fala de qualquer aluno com conta ligada, não só do que não tem senha.
  - **Correção exigida, uma das duas:**
    - **(a)** Gerar responde `SEM_SENHA` ("ele entra pela conta da escola") para todo aluno com `conta_externa` ligada, como diz o PRD §7. Sempre depois da checagem de escopo, para o 404 continuar igual. Entra o cenário "aluno com conta ligada e senha: `SEM_SENHA` para quem gera; 404 para professor de outra turma".
    - **(b)** O login pela conta da escola também mostra as trocas por provisória que o aluno ainda não viu, com cenário próprio.

Recomendações:
- **§2: o módulo `packages/core/src/titular/` não está listado.** Hoje o arquivo do titular lê a auditoria só por `autor_usuario_id = titular` (`packages/core/src/titular/leitura-do-titular.ts:383`). A `.gerada`, em que o aluno é o alvo, precisa de uma consulta nova por alvo, sem o id de quem gerou (critério 2 do mesmo arquivo).
- **§5: a `.gerada` deve guardar o papel de quem gerou no `depois`, numa lista fechada.** A tela de troca mostra esse papel, e ele não pode depender do usuário atual. Esse usuário pode ter trocado de papel ou ter sido eliminado, e aí o autor vira nulo.
- **§4: a rota `/trocas` deve conferir o bilhete como a troca confere.** Isto é, hash da provisória ainda igual e provisória vigente. O bilhete de uma provisória já substituída não deve ler a lista.
- **§5: dizer qual chave cifra o bilhete,** separada da `EMAIL_TOKEN_KEY` e da chave do MFA.
- **`docs/lgpd.md`, linha da planilha em gravação: o prazo não bate com a spec.** A linha diz que o expurgo fecha a importação parada "de 24 h". A Tech Spec diz 1 h. Além disso, o `sistema.expurgar-acesso` roda uma vez por dia, às 04:30 (`apps/worker/src/job-schedules.ts:37`). Na prática, nome e matrícula parados ficam até cerca de 27 h, e os cifrados do envio até cerca de 48 h. Escrever o prazo real nos dois documentos.
- **`docs/lgpd.md`, linha da aula da grade:** diz "reimportar a grade apaga as do ano", mas a §3 agora mantém o id da alocação por (vínculo, dia, início).
- **`docs/lgpd.md`, linha da senha provisória:** dizer se `provisoriaGeradaPor` sai junto com o hash.
- **`cenarios.md`, seção RF16:** "vínculo aberto na Y" deveria ser "confirmado", como na §4. A recomendação já veio da rodada 2.
- **`evento_calendario.descricao` (120 caracteres de texto livre):** a tela deve avisar para não escrever nome de aluno, ou a coluna deve ganhar uma linha no `docs/lgpd.md`.

Pergunta de fechamento: o código responde. O que se guarda do aluno nesta funcionalidade aparece no arquivo do titular, que passa a incluir as duas ações da provisória. A `contaExterna` e os cifrados ficam fora do arquivo, como já é a política. Nenhum dado de aluno sai para terceiro.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/prd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/docs/lgpd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/packages/core/src/titular/leitura-do-titular.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/apps/worker/src/job-schedules.ts

## test-engineer · 3ª rodada · REPROVADO · 2026-11-03 12:49:34 · `tasks/prd-onboarding-por-convite/revisao-spec.md`

VEREDITO: REPROVADO

Cenários exigidos: os 13 bloqueantes da rodada 2, mais o que as mudanças desta rodada abriram. As mudanças são três: o nome corrigido do aprovado vai para o `usuario.nome`, a tela de troca lista as trocas anteriores e a verificação de e-mail ganhou teto por conta.

Cobertos (os 13 da rodada 2, conferidos um a um):
- **Limites:** prévia 21, com o gravar no mesmo balde, e a terceira prévia simultânea (cenarios.md:19-20); `rl:ip:senha` (cenarios.md:114); `EMAIL_POR_MINUTO` (cenarios.md:91); trocar-senha (cenarios.md:134); verificar 3/h (cenarios.md:106); convites 300/h (cenarios.md:100); cotas da provisória (cenarios.md:137).
- **Ano sem curso:** em `importacoes/:id` (cenarios.md:81) e em `externa/iniciar` (cenarios.md:148).
- **Grade do ano planejado:** só se confirma com o ano em curso (cenarios.md:47).
- **Importação parada:** fechada pela falha definitiva (cenarios.md:77) e pelo expurgo (cenarios.md:78). O prazo do expurgo é o bloqueante 1.
- **"E-mail que volta":** está na §11 e no cenarios.md:90.
- **E-mail duplicado e dois "Enviar":** `skip locked` (cenarios.md:94-95) e os dois "Enviar" (cenarios.md:96).
- **`turma.chave`:** corrida e migration (cenarios.md:24-25).
- **RF6, RF7 e RF10:** RF6 em cenarios.md:52-53; RF7 em cenarios.md:58-60; RF10 em cenarios.md:69.
- **RF14:** banco sem e-mail nem foto (cenarios.md:146) e ligar em "Eu" (cenarios.md:147).
- **Homônimos, redefinir e envio parado:** homônimos (cenarios.md:28); redefinir que verifica (cenarios.md:109); envio parado há 24 h (cenarios.md:92).
- **Mudanças desta rodada:** nome do aprovado no `usuario.nome` (cenarios.md:31-32); tela de troca (cenarios.md:131); arquivo do titular (cenarios.md:133); teto da verificação (cenarios.md:106).
- **Casos de borda do domínio:** transferido, duas disciplinas, grade sem professor, turma escrita de vários jeitos, matrícula de outra escola e virada de ano. Todos têm cenário.
- **Sem IA nesta funcionalidade:** não há teste de provedor a conferir.

Bloqueantes:

1. **O prazo do expurgo da importação parada está escrito de dois jeitos.**
   - **Onde:** techspec.md §5, tabela de estados, linha `na_fila` ("1 h: o gravar seguinte ou o expurgo fecha `falhou`"), contra a linha "Planilha em gravação" do `docs/lgpd.md`, editada nesta rodada ("a de 24 h, pelo `sistema.expurgar-acesso`").
   - **Por que bloqueia:** a correção da rodada 2 foi feita na Tech Spec e não no mapa de dados. A coluna `linhas` guarda nome e matrícula de aluno, então a retenção declarada difere da implementada. O cenarios.md:78 diz só "`na_fila` antiga", e um teste com 2 h passa nas duas versões.
   - **Correção:** alinhar o `docs/lgpd.md` a 1 h, e reescrever o cenarios.md:78 com a fronteira: com relógio falso, 59 min continua `na_fila` e 61 min sai `falhou` com `linhas` e `marcas` nulas.

2. **A frase de que o job roda numa transação só saiu do texto, e nenhum cenário prova que a falha não deixa nada pela metade.**
   - **Onde:** techspec.md §5, parágrafo "O job". O diff tirou "O job, numa transação, refaz a classificação". Ficaram "aplica em lotes de 500" e "Falha definitiva …: `falhou`, em transação própria", o que deixa em aberto se cada lote é uma transação.
   - **Por que bloqueia:** o cenarios.md:77 confere só o estado e as colunas nulas. Ele passa com o lote 1 gravado e o lote 2 perdido.
   - **Correção:** escrever na §5 que o trabalho do job (travas, nova classificação, todos os lotes e `concluida`) é uma transação só. No cenarios.md:77, acrescentar: falha injetada no segundo lote de uma planilha de 1.200 linhas deixa zero turmas, vínculos e `lista_nome` novos, e a importação sai `falhou`.

3. **A corrida entre o nome corrigido e a aprovação do mesmo nome não tem cenário nem trava.** É um problema aberto pela correção desta rodada.
   - **Onde:** techspec.md §5, "Gravar", "nome corrigido no `usuario.nome` do aprovado ou na `lista_nome`"; cenarios.md:31-32 e 41; tabela "Corridas", linha "Job contra a decisão do professor".
   - **Por que bloqueia:** a tabela de destino agora depende de o aluno estar aprovado ou não. O job trava ano, turmas e os pedidos que existem quando ele trava, mas não trava a linha da `lista_nome`. Um pedido criado e aprovado depois dessa trava e antes da escrita produz um de dois desfechos:
     - o job grava nome numa `lista_nome` já aprovada, esbarra no `lista_nome_aprovado_sem_nome`, repete e termina `falhou`;
     - ou a correção se perde, porque o nome já mora no `usuario`.

     O único [P] da linha 41 cobre a transferência, não esse caminho.
   - **Correção:**
     - na §5, o job trava, também por id, as linhas da `lista_nome` que vai corrigir. Outra saída: o `update` da `lista_nome` leva `where estado <> 'aprovado'`, e zero linhas vira `desatualizada`;
     - no cenarios.md, um [P] com o job pausado entre a nova classificação e a escrita, enquanto o professor aprova o mesmo nome. O resultado é `usuario.nome` com o nome corrigido ou a importação `desatualizada`, nunca `falhou` pelo check;
     - uma linha nova na tabela "Corridas".

Recomendações:
- **Expurgo contra o job.** Falta a linha "Expurgo contra o job" na tabela "Corridas": o expurgo fecha `na_fila` e envio parado com `where estado/envio = 'na_fila'` e `skip locked`, para não esperar o job que segura a linha. Falta também o [P] correspondente.
- **Corrida da turma (cenarios.md:24).** Dizer o que acontece com quem perde: o job sai `desatualizada`, nunca `falhou` depois das tentativas; a criação à mão responde `CONFLITO`.
- **Dois "Enviar" (cenarios.md:96).** Afirmar também um e-mail por professor (o envio do convite revogado sai `cancelado`) e a resposta de quem perde o `convite_pendente_unico`, nunca 500.
- **Revogação durante o envio (cenarios.md:95).** Exigir no adaptador falso uma barreira que segura o SMTP. Escrever na §5 se a trava da linha dura enquanto o SMTP responde (até 10 s): se dura, a revogação e o `desativar` esperam por ela.
- **Encerrar do ano no meio do job (cenarios.md:79).** Está como [I], mas é corrida: marcar [P] com o job pausado.
- **Semáforo das prévias (cenarios.md:20).** Acrescentar o gravar ocupando uma vaga e a vaga liberada quando o processo morre (TTL).
- **Tetos de 512 KB e 3.001 linhas.** Hoje só aparecem nos casos reescritos da A1 da lista por turma. Pôr cenário próprio na rota `/v1/importacoes/alunos`.
- **`GET /v1/sessao/matricula/trocas` (§4).** Dizer por onde vai o bilhete, num cabeçalho e nunca na URL, e acrescentar o cenário "bilhete na query recusado". O cenarios.md:127 ("o bilhete não abre outra rota") passa a nomear as duas rotas que ele abre.
- **Mitigação da §13.** Ela fala em ver "a provisória que não usou", e o cenário lista as trocas. Escolher uma das duas e escrever no cenarios.md:131 o caso de quem invadiu: a provisória gerada e usada por outra pessoa aparece na troca seguinte do aluno.
- **RF17 (cenarios.md:168).** Enumerar as 13 ações da §7 numa tabela testada linha a linha. Hoje `planilha.gravada` com contagens, `aluno.transferido`, `vinculo.criado`/`encerrado` pela grade, `convite.enviado`, `senha.redefinida`, `conta.email_verificado` e `conta_externa.ligada` não têm linha própria.
- **E2E do aluno com conta da escola.** Caso de borda do PRD §7: a tela de quem gera a provisória mostra a frase "entra pela conta".

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/docs/lgpd.md

## revisor-geral · 3ª rodada · REPROVADO · 2026-11-03 12:49:55 · `tasks/prd-onboarding-por-convite/revisao-spec.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: divergência em §2 e §5, no `fechar` com `encerrada`, que contradiz o `docs/lgpd.md`
Portão local: não se aplica, porque é revisão de spec e ainda não há código. O `conferir` responde "nunca passou nesta árvore", o que é esperado nesta etapa.

**Os 2 bloqueantes da rodada 2**

1. **Worker e conta global: resolvido.** §1 não diz mais que o worker nunca lê a conta. §2 sobe para o core o cadastro do professor, o `travarPendente` e o `fechar`, e passa o `contaParaConvite` do `TenantResolutionRepository` para o `ContaGlobalRepository`. §6 e §11 declaram a exceção, e §6 põe `packages/core/src/estrutura/` na zona.
2. **Nome corrigido do aluno aprovado: resolvido.** §5 "Planilha" acha o aprovado pela `credencial_matricula` e pelo `usuario`. §5 "Gravar" grava no `usuario.nome`. O cenário RF4 cobre os dois casos e o check `lista_nome_aprovado_sem_nome`.

As recomendações da rodada 2 foram todas feitas. As linhas 320, 377 e 447 do `convite.int.test.ts` existem e são de fato os casos que mudam.

**Bloqueantes**

- **§2 e §5 "Gravar", o `fechar` aceitando `encerrada`.** A correção 1 abriu este problema.
  - **No worker ele falha.** O `fechar` de hoje (`apps/api/src/sala/decisao/decisao.repository.ts`, em `fechar`) grava `decididaEm`, `decididaComo` e `decididaPor: requestSessao().usuarioId`. Dentro do job não há sessão, e `requestSessao()` lança `NAO_AUTENTICADO`.
  - **Na API ele contradiz o `docs/lgpd.md`.** Ali, `encerrada` é o fechamento sem decisão, com a retenção contada da solicitação (índice `coalesce(decididaEm, solicitadaEm)`). Já o `virarSala` da A1 encerra sem gravar nada de `decidida*`.
  - **A `contaExterna` fica sem caminho de limpeza.** §3 diz só que o check "passa a aceitar senha ou conta". Não diz que a `contaExterna` também só vale no pendente, nem quem a anula no encerramento. O `virarSala` (`apps/api/src/estrutura/ano-letivo/ano-letivo.repository.ts`) não é citado. Um pedido de conta pendente na virada do ano fica com o identificador da conta, ou quebra o check, conforme o texto que a migration escolher.
  - **Correção exigida, em três partes:**
    - §5: `fechar('encerrada')` grava só o estado e anula senha, chave, marca de matrícula errada e `contaExterna`, sem `decididaEm`, `decididaPor` nem `decididaComo`. O `virarSala` passa pelo mesmo caminho, para haver um jeito só.
    - §3: o check escrito por extenso, com `estado = 'pendente'` exatamente quando há senha ou conta (uma das duas), e a `contaExterna` nula fora do pendente.
    - `cenarios.md`: pedido de conta pendente encerrado pela transferência no job e pela virada do ano, com `contaExterna` nula e sem `decididaPor`.

**Recomendações**

- **§5 "Gravar", professores do job.** Escrever que o job roda o `convidar` da A1: conta, usuário e um convite `pendente` de 7 dias, com o token sorteado e descartado. Sem o convite, `estadoDoProfessor` devolve `desativado` e `dadosDoProfessor` devolve `undefined`. Aí o `convite/refazer` de §4 responde `NAO_ENCONTRADO`, e o "Enviar" sem seleção confunde esse professor com um desligado. O cenário RF6 ("não tem convite com token") fica ambíguo. Melhor trocar por "aparece `pendente`; o Copiar link passa pelo refazer".
- **§6, segunda cerca.** Além do `architecture.test.ts`, a regra do dependency-cruiser `cerca-conta-global` (`tools/guardas/camadas.test.ts` e a configuração) recusa import de `packages/core/src/estrutura/`. Nomear as duas cercas, para a tarefa não ter de alargar uma delas sem a spec dizer.
- **§11, regra 10 item 9.** O `ContaGlobalRepository` passa a ter quatro `@Unscoped`, e o JSDoc dele diz que "qualquer outra aqui é mudança de spec". Dizer que é uma mudança de lugar (o total do sistema não muda) e que esta spec é a mudança discutida.
- **§1, texto do worker.** "No worker, só o cadastro do professor alcança a conta global" não bate com §5 e §11: o `sistema.enviar-email-da-conta` e o expurgo também leem e gravam `link_da_conta`, que §11 chama de conta global. Ajustar a frase.
- **§5 "O job", professores.** Chamar o `contaParaConvite` em ordem de e-mail normalizado. Duas escolas importando os mesmos professores em ordens diferentes travam a conta (`FOR NO KEY UPDATE`) e o índice único em ciclo. O deadlock precisa sair como falha transitória, nunca como `falhou`.
- **§5 "Conta da escola do aluno", invariante.** O `travarPendente` subido lança `InvariantException` quando `senhaHash` é nulo, e o pedido de conta tem `senhaHash` nulo. Dizer que a invariante passa a ser senha ou conta.
- **§7, nome da auditoria.** `lista.nome_corrigido` audita também a correção no `usuario.nome` do aprovado. Usar um nome que diga o objeto, por exemplo `usuario.nome_corrigido` para o aprovado.
- **Teto de palavras.** A Tech Spec está com 2.699 palavras para um teto de 2.700. Qualquer correção acima precisa tirar texto em outro lugar.

Arquivos lidos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/prd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/apps/api/src/sala/decisao/decisao.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/apps/api/src/estrutura/ano-letivo/ano-letivo.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/packages/core/src/ciclo-de-vida/conta-global.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tools/guardas/camadas.test.ts

## infra-guardian · 3ª rodada · REPROVADO · 2026-11-03 12:50:01 · `tasks/prd-onboarding-por-convite/revisao-spec.md`

VEREDITO: REPROVADO
Caminho quente tocado: login | fila | migration
Rate limit: ok
Fila e prioridade: ok
Concorrência: corrida em §3 / §5 "Gravar" (`turma.chave` não acompanha a renomeação)
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: compatível
Métrica e alerta: ok

**Bloqueantes da rodada 2**
- **1. `na_fila` sem saída: resolvido.** A falha definitiva e a `ultimaTentativa` gravam `falhou` em transação própria. O gravar fecha a importação de mais de 1 h com `for update nowait` e devolve `CONFLITO` se ela estiver travada. A tabela de estados e os cenários de "Job e estados" cobrem os dois caminhos.
- **2. Verificação só com limite por IP: resolvido quanto ao limite.** Agora há teto por conta, que rebaixa (§5 "Posse do e-mail", §7c). Mas o desenho do reaproveitamento se contradiz; vai como bloqueante 2 abaixo.

Bloqueantes:
1. **§3 (`turma + chave`) e §5 "Gravar".** A §3 diz que a `chave` "nasce na criação (à mão ou pelo job)". Só que a turma pode ser renomeada: existe `PATCH /v1/turmas/:id` (`apps/api/src/estrutura/turma/turma.controller.ts:48`). Se "8A" vira "9B", a `chave` fica `8a`.
   - A planilha seguinte põe os alunos de "8A" na turma que agora se chama "9B".
   - Uma linha "9B" cria uma segunda turma "9B".
   - O único parcial de `turma.chave` deixa de decidir a corrida entre a renomeação e a turma criada pelo job.

   **Correção exigida:**
   - A renomeação recalcula a `chave` no mesmo `update`: nome fora do padrão vira `chave` nula, e a violação do único vira `CONFLITO`.
   - A criação à mão que bate no único também responde `CONFLITO`, nunca 500.
   - No `cenarios.md`, RF3: "turma renomeada: a planilha com o nome antigo não casa, e a com o nome novo casa com ela".
   - Na seção "Corridas": "renomear contra a turma criada pelo job", travada pelo único parcial.
2. **§5 "Posse do e-mail" contra o `cenarios.md` "Posse do e-mail".** A §5 diz que o link é "reaproveitado se aberto há menos de 1 h, com teto de 3 envios por hora por conta". O cenário espera "Quarto aceite na hora: `VERIFICACAO_PENDENTE` e três envios". As duas leituras da §5 quebram alguma coisa:
   - **Reaproveitar sem reenviar:** sai no máximo um envio por hora. O teto nunca dispara e o cenário não passa.
   - **Reenviar o mesmo link:** o token cifrado precisa ficar na linha depois do envio. Isso contradiz a §3 ("nulos fora de `na_fila`") e a linha `link_da_conta` do `docs/lgpd.md`.

   **Correção exigida:** escolher uma regra e alinhar a §5 e o cenário a ela. Há dois caminhos:
   - Fazer como no "esqueci": um link novo no lugar do aberto, com 3 por hora por conta, que rebaixa. É o que o cenário já descreve.
   - Manter o reaproveitamento sem envio novo e reescrever o cenário: quarto aceite, um envio só.

Recomendações:
- **§5, parágrafo do expurgo.** O texto diz "com escopo da escola, no laço que já faz". Mas o `sistema.expurgar-acesso` é rotina do sistema, sem laço por escola (`apps/worker/src/processors/expurgar-acesso.ts`). O laço por escola é o `retencao.expurgar-escola`. Dizer qual job fecha a importação e o envio parados. Alinhar também o prazo: a tabela de estados diz que o expurgo fecha em 1 h, o `docs/lgpd.md` diz 24 h.
- **§5 "E-mail".** O `for update skip locked` só faz a segunda execução sair se a trava ficar presa durante o envio. Então a transação fica aberta durante a chamada SMTP, até 10 s, e a revogação, o `desativar` e o `convite/refazer` esperam por ela. Melhor reservar a linha com uma coluna de prazo em vez da trava, ou declarar essa espera e pôr `idle_in_transaction_session_timeout` no worker.
- **§5 "E-mail".** "`EMAIL_POR_MINUTO` adia sem falhar": dizer que o adiamento não consome tentativa e solta a vaga da escola enquanto espera.
- **§5 "O job".** Turma criada à mão entre a prévia e o job: dizer que a violação do único de `chave` leva a `desatualizada`, e não a novas tentativas até `falhou`.
- **§7c.** O contador de prévias simultâneas no Redis precisa ter prazo de validade, para não perder a vaga se o processo morrer no meio da prévia.
- **§5 "Planilha".** A classificação calcula a chave pelo nome das turmas do ano quando a coluna está nula (turma duplicada na migration, ou criada pelo código antigo depois de voltar a versão). A coluna serve só para a corrida.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/techspec.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/cenarios.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/apps/api/src/estrutura/turma/turma.controller.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/apps/worker/src/processors/expurgar-acesso.ts`

## test-engineer · 4ª rodada · REPROVADO · 2026-11-03 12:57:12 · `tasks/prd-onboarding-por-convite/revisao-spec.md`

VEREDITO: REPROVADO

**Cenários exigidos:** os três bloqueantes da rodada 3 (prazo da importação parada, transação única do job, nome corrigido contra aprovação) e o que as mudanças desta rodada trazem: `turma.chave` recalculada na renomeação, link de verificar novo a cada envio, `SEM_SENHA` para todo aluno com conta da escola ligada, e `fechar('encerrada')` sem `decidida*` com o check novo. Entram também as recomendações da rodada 3 e os casos de borda do domínio: transferido, duas disciplinas, turma sem professor, turma escrita de três jeitos, homônimos, matrícula repetida entre escolas, virada de ano, nome alterado, clique duplo, job executado duas vezes, mesmo IP e escola barulhenta.

**Cobertos:**
- **Bloqueante 1 (prazo):** resolvido. A §5 (tabela de estados e parágrafo do expurgo) diz 1 h pelo gravar ou o expurgo da 1h, com pior caso de cerca de 25 h. O `docs/lgpd.md` diz o mesmo. A fronteira 59/61 min com relógio falso está em cenarios.md:86-87.
- **Bloqueante 2 (transação):** resolvido. A §5 "O job" diz que tudo até `concluida` é uma transação. O cenário da falha no segundo lote de 1.200 linhas está em cenarios.md:88-89.
- **Bloqueante 3 (nome corrigido):** resolvido na direção pedida. A cláusula está na §5, o [P] em cenarios.md:37-38 e a linha em "Corridas" (cenarios.md:229). Mas a outra ordem da mesma corrida ficou aberta: é o bloqueante 1 abaixo.
- **Mudanças desta rodada:**
  - Renomeação: cenarios.md:26-27.
  - Link novo a cada envio: cenarios.md:123.
  - `SEM_SENHA`: cenarios.md:140-141.
  - `encerrada` sem `decidida*` e o check: cenarios.md:169-170. Confere com o que a virada da A1 já faz hoje (`ano-letivo.repository.ts:68-87`).
- **Recomendações da rodada 3, todas atendidas:**
  - expurgo contra o job: :92 e :230;
  - perdedor da corrida da turma: :24-25;
  - dois "Enviar": :112-113;
  - encerrar do ano: :90;
  - semáforo das prévias: :240;
  - tetos da rota `/v1/importacoes/alunos`: :20;
  - bilhete na query: :149;
  - provisória usada por outro: :148;
  - tabela de auditoria: :250-268;
  - e2e do aluno com conta da escola: :205.
- **Casos de borda do domínio:** todos presentes.

**Bloqueantes:**

1. **A aprovação ainda perde o nome corrigido, na ordem inversa da corrida** (techspec.md §5 "O job"; cenarios.md:37-38 e :229).
   - O que acontece: a decisão da A1 lê o nome sem travar a linha (`nomeDoPedido`, `apps/api/src/sala/decisao/decisao.repository.ts:160-167`). Ela só trava o ano e o pedido (`decisao.service.ts:130-137`). Se a aprovação lê o nome antigo e o job corrige a `lista_nome` em seguida, o `where estado <> 'aprovado'` ainda casa, porque o pedido segue pendente. O job sai `concluida` e audita `lista.nome_corrigido`. Quando o job confirma, o `aprovarNome` grava, e o usuário nasce com o nome antigo, sem erro nenhum.
   - O segundo problema: a §5 não diz se "os pedidos" que o job trava incluem o pedido pendente da linha cujo nome ele corrige, nem se a classificação vem antes ou depois dessa trava. Se o job trava esse pedido antes de classificar, a cláusula de zero linhas nunca é alcançada. Nesse caso o [P] de :37-38 trava ou fica vermelho pelo motivo errado, porque a aprovação espera no `travarPendente` e nenhum dos dois desfechos listados acontece.
   - Correção exigida:
     - A §5 diz que o job trava, na ordem dos pedidos, o pedido pendente de toda linha cujo nome ele corrige (ou a decisão trava a `lista_nome` com `for update` antes de ler o nome).
     - A §5 diz em que ponto a classificação acontece em relação a essa trava.
     - Um [P] novo cobre a ordem inversa: aprovação parada depois de ler o nome, job corrige. O desfecho exigido é o `usuario.nome` com o nome corrigido, ou o job `desatualizada`; nunca o nome antigo com `concluida`.
     - O [P] de :37-38 é reescrito com os desfechos que o desenho escolhido realmente produz.

2. **Revogação com barreira: o cenário contradiz a tabela de estados** (cenarios.md:110-111 contra a techspec.md §5, tabela de estados e parágrafo "E-mail").
   - O que está escrito: o cenário espera que a linha "termine `cancelado` depois de `enviado`". Na §5, `enviado`, `falhou` e `cancelado` são finais ("Sai: —"), e toda troca de envio é condicionada a `envio = 'na_fila'`. Então a revogação que espera o envio encontra `enviado` e não muda nada.
   - Consequência: o teste fica vermelho pelo motivo errado, ou o código ganha uma transição que a spec não declara. Essa transição mostraria "cancelado" à coordenação para um e-mail que saiu de fato.
   - Correção exigida: escolher um desfecho e escrevê-lo nos dois documentos. Sugestão: o envio fica `enviado`, o convite fica revogado e o link do e-mail é recusado no aceite. O cenário deve afirmar exatamente isso.

3. **A linha "Turma à mão, ou renomeada, contra turma do job" não tem teste para a renomeação** (cenarios.md:228; o [P] em :24-25 só cobre a criação à mão).
   - Por que conta: a renomeação é um caminho novo desta rodada, um `update` com o seu próprio mapeamento para `CONFLITO`. Um item juntado a outro conta sozinho.
   - Correção exigida: um [P] com "8B" renomeada para "8A" contra o job criando "8A". O resultado esperado é uma turma só; a renomeação que perde responde `CONFLITO`, e o job que perde sai `desatualizada`, nunca `falhou`.

**Recomendações:**
- **Cenário do lote (cenarios.md:88):** dizer que a falha é injetada em toda tentativa. Afirmar também, depois da primeira tentativa e antes da nova, que a importação segue `na_fila` com zero linhas novas. Sem isso, uma injeção de uma vez só faz a nova tentativa passar, e o cenário não prova a transação.
- **Check novo da `reivindicacao` (§3):** o cenário de :170 só prova "senha e conta juntas". Faltam:
  - pendente sem senha nem conta, recusado;
  - pedido decidido ou encerrado com `contaExterna` preenchida, recusado pelo próprio check.

  O teste de comportamento de :164 não cai se o check sumir, porque o `fechar` já anula os segredos.
- **Link aberto substituído (§5 "Posse" e "Esqueci"):** declarar o que acontece com o envio do link antigo ainda `na_fila`. Sugestão: `cancelado`, com os cifrados nulos e nenhum e-mail enviado com link morto. Pôr um cenário para isso.
- **Expurgo de 90 dias (§5, tabela de estados):** a linha final da importação sai pelo `sistema.expurgar-acesso`, que não tem escopo, mas é tabela de escola. A recomendação da rodada 3 (importação pelo `retencao.expurgar-escola`) foi seguida só para a parada. Alinhar, e dizer o job no cenário de :82.
- **Onde vai o bilhete:** a §4 põe `{ bilhete, senha }` no corpo do trocar-senha, e a §5 diz "no cabeçalho". Uniformizar, e testar a recusa onde ele não pode estar.
- **Auditoria:** confirmar se `turma.criada` e a "volta" na virada de ano (vínculo confirmado) entram na tabela RF17 ou já são cobertas por ação da A1.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/apps/api/src/sala/decisao/decisao.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/apps/api/src/sala/decisao/decisao.service.ts

## tenancy-guardian · 4ª rodada · APROVADO · 2026-11-03 12:57:12 · `tasks/prd-onboarding-por-convite/revisao-spec.md`

VEREDITO: APROVADO

Tabelas verificadas: `importacao_planilha`, `alocacao`, `evento_calendario`, `link_da_conta`, `convite` (os campos novos), `conta.emailVerificadoEm`, `credencial_matricula` (a provisória), `turma.chave`, `vinculo.origem`, `reivindicacao.contaExterna` (§3).

Queries verificadas: as leituras da prévia e da classificação; o job `estrutura.gravar-planilha`, que tira a escola da linha e as travas; `email.enviar-convite`, que lê por id e escola; `sistema.enviar-email-da-conta` com o `EnvioRepository`; `ContaGlobalRepository.contaParaConvite`, que vem do `TenantResolutionRepository`; o fechamento do que fica parado, que passou ao `retencao.expurgar-escola` (por escola, sem `@Unscoped`); o `link_da_conta` no `sistema.expurgar-acesso`; o recálculo de `turma.chave`, cujo único começa por `escolaId`; o `fechar('encerrada')` e o `virarSala`; o filtro `anoLetivoId`, validado só contra o planejado da escola da sessão (§4, §5, §6, §11).

Teste de isolamento: presente e efetivo. Conferi tirando a cláusula de escopo de cada ponto:
- Sem a escola na leitura do convite pelo job de e-mail, o cenário "id de convite da B num job da A" quebra.
- Se o job confiar no payload, o cenário do payload adulterado quebra.
- Se a classificação procurar o professor pela conta, os cenários do RF6 sobre a prévia e o `resumo` quebram.
- As duas guardas da cerca ganham fixture que reprova o arquivo vizinho.

Bloqueantes: nenhum. O bloqueante da rodada 3 foi resolvido. A §6 cerca o `ContaGlobalRepository` pelo arquivo `packages/core/src/estrutura/cadastro-de-professor.ts`, nas duas guardas, cada uma com fixture do vizinho. Isso cabe nas duas guardas como elas estão hoje: o `pathNot` por arquivo do `cerca-conta-global` em `tools/guardas/camadas.cjs` e a zona por arquivo em `ZONAS_DAS_CLASSES_CERCADAS`, como a do `PainelRepository` já faz. A §11 registra os quatro `@Unscoped` como mudança de lugar, e o total não muda. O cenário do RF6 sobre o `resumo` e a `planilha.gravada` está em `cenarios.md`.

Recomendações:
1. **§6, zona do `link_da_conta`.** A zona lista só o worker: `apps/worker/src/processors/enviar-email.ts` e "o expurgo de acesso". Mas a §5 lê e grava o link pelo hash e pela conta na API: no esqueci, no redefinir, no verificar e no aceite com `VERIFICACAO_PENDENTE`. A spec deveria dizer que classe faz isso na API. O precedente é o `codigo_recuperacao`, que fica no `TenantResolutionRepository`, já cercado em `apps/api/src/sessao/`, com um `@Unscoped` por método. Também convém trocar "o expurgo de acesso" pelo caminho do arquivo (`packages/core/src/retencao/expurgo-de-acesso.repository.ts` ou o processador).
2. **§6, justificativa do `contaParaConvite`.** O texto do `@Unscoped` diz "devolve só o id". Hoje o método devolve `{ id, nova }`, e o `convidar` de `apps/api/src/sessao/convite/convite.service.ts` leva o `contaNova` à auditoria do convite de coordenador. Duas saídas: a justificativa descreve o retorno de verdade, e o cadastro do professor descarta o `nova` (que é o que o cenário do RF6 prova); ou o operador perde o campo na auditoria, e isso vai escrito.
3. **§5, tabela de estados.** O fechamento da importação parada passou ao `retencao.expurgar-escola`, mas a remoção em 90 dias de `concluida`, `desatualizada` e `falhou` continua no `sistema.expurgar-acesso`, que apaga de todas as escolas. Duas saídas: passar a remoção também para o expurgo por escola, ou registrar na §11 que a tabela entra na lista que o `@Unscoped` do expurgo de acesso já cobre, como o convite.
4. **§5, bilhete da provisória.** O bilhete deveria levar também o `escolaId`, e `/trocas` e `trocar-senha` abririam o contexto por ele, como o `convite-ticket` faz. Assim a leitura da auditoria por alvo filtra a escola sem precisar de uma busca da escola pelo aluno sem escopo.
5. **`cenarios.md`, isolamento.** Falta tornar explícito o caso que estava na §6 antiga e saiu: a turma "8A" da escola B não casa com a planilha da A, que sai "nova".

Arquivos lidos:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/techspec.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/cenarios.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/apps/api/test/architecture.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tools/guardas/camadas.cjs`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/packages/core/src/ciclo-de-vida/conta-global.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/apps/api/src/sessao/tenant/tenant-resolution.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/apps/api/src/sessao/convite/convite.service.ts`

## privacy-guardian · 4ª rodada · REPROVADO · 2026-11-03 12:57:17 · `tasks/prd-onboarding-por-convite/revisao-spec.md`

**VEREDITO: REPROVADO**

O bloqueante da rodada 3 está resolvido. Sobra um bloqueante, aberto pelas correções desta rodada: o `docs/lgpd.md` promete uma limpeza da senha provisória vencida que a Tech Spec não constrói nem testa.

**Campos pessoais tocados:**
- nome e matrícula do aluno: na `importacao_planilha.linhas` até o job terminar, e no `usuario` e na `lista_nome`
- nome e e-mail da equipe
- da senha provisória: `credencial_matricula.provisoriaHash`, `provisoriaExpiraEm` e `provisoriaGeradaPor`
- `reivindicacao.contaExterna`, o cookie `educa_conta_provada` e o `conta.emailVerificadoEm`
- `alocacao`, `evento_calendario` (descrição em texto livre) e `link_da_conta` (token e endereço cifrados)
- o papel de quem gerou a provisória, no `depois` da `senha_provisoria.gerada`

**Fora da tabela de dados do docs/lgpd.md:** nenhum. As linhas novas e as revistas estão lá: planilha parada (cerca de 25 h), envio parado (cerca de 48 h), a grade que mantém a aula que continua, o evento do calendário, o cookie, e a provisória com quem gerou e quem usou.

**Autorização por objeto:** ok.
- Gerar a provisória confere o escopo antes do `SEM_SENHA`. O cenário prova o 404 para professor de outra turma e prova que a senha do aluno com conta da escola não muda.
- `/trocas` confere o bilhete do mesmo jeito que a troca. Não alcança outro aluno. Bilhete substituído, vencido ou na query é recusado.
- O cookie da conta provada confere escola e acesso da turma. O `anoLetivoId` é validado no servidor.

**Logs:** limpos (§7: ids, contagens e código; nunca linha, e-mail, token nem resposta do SMTP).

**Auditoria:** presente. A tabela "Auditoria" do `cenarios.md` cobre o que a regra exige, uma linha por cenário:
- leitura de nome do banco: `turma.alunos_lidos`
- transferência, desligamento, vínculos e conta ligada
- geração e uso da provisória, com o papel de quem gerou no `depois`

`.gerada` e `.usada` entram no arquivo do titular por alvo, sem o id de quem gerou, como o critério 2 da `leitura-do-titular.ts` exige.

**Envio externo:** só e-mail (convite, redefinição e verificação) ao provedor de e-mail, com endereço e texto da equipe e nunca dado de aluno. O provedor entra em `suboperador` antes do portão. O estado do envio fica registrado em `convite.envio` e `link_da_conta.envio`. Não há IA nesta funcionalidade.

**Seed/fixture:** sintético. O e2e usa seed compartilhado, `oidc-falso` e Mailpit.

### Conferência do bloqueante da rodada 3

Resolvido. A §5 "Senha provisória" responde `SEM_SENHA` para todo aluno com conta da escola ligada, com ou sem senha, depois do escopo. O cenário "Senha provisória" prova três coisas: o `SEM_SENHA` para quem gera, que a senha do aluno não muda, e o 404 para professor de outra turma. O e2e "a tela diz que ele entra pela conta" também está lá.

As recomendações da rodada 3 foram todas feitas:
- leitura do titular por alvo
- papel de quem gerou no `depois` da `.gerada`
- `/trocas` conferindo o bilhete
- chave própria `BILHETE_KEY`
- as linhas do `docs/lgpd.md`
- RF16 com o ano planejado

O `fechar('encerrada')` anula os quatro segredos, inclusive `contaExterna`, e o check fica por extenso. O cenário de RF14 prova a `contaExterna` nula sem `decidida*` e a recusa de pedido pendente com senha e conta juntas.

### Bloqueantes

1. **§5 "Senha provisória" contra a linha "Senha provisória do aluno" do `docs/lgpd.md`.**
   - **O que está errado:** a linha revista nesta rodada diz que hash, validade e quem gerou saem "no vencimento (o login seguinte ou o expurgo de acesso)". A Tech Spec não constrói nenhum dos dois caminhos. A §5 só barra a troca com `provisoria_expira_em > now()`. A tabela de estados e o parágrafo dos expurgos da §5 declaram o que cada expurgo grava (importação, convite, link), mas não a provisória. O `cenarios.md` não tem cenário de limpeza. Hoje a `CLASSIFICACAO_DAS_TABELAS` só limpa `credencial_matricula` na desativação e na eliminação.
   - **Efeito:** o hash vencido e o `provisoriaGeradaPor` (dado do professor) ficam além do prazo declarado. O mapa de dados, que é o documento mostrado à escola e à ANPD, descreve uma rotina que não existe (regra 20, item 16, sem teste que a prove).
   - **Correção exigida, uma das duas:**
     - (a) declarar na §5 a escrita: um expurgo que anula `provisoriaHash`, `provisoriaExpiraEm` e `provisoriaGeradaPor` onde `provisoria_expira_em < now()`, com `skip locked`. O `sistema.expurgar-acesso` já apaga `convite` e `sessao` assim; ou o `retencao.expurgar-escola`, com escopo. Junto, um cenário [I] com relógio falso: 23 h mantém, 25 h anula, e a auditoria fica.
     - (b) corrigir a linha do `docs/lgpd.md` para a retenção real: até o uso, a próxima geração ou a desativação.

### Recomendações (não bloqueiam)

- **Ordem do gerar (§5).** O texto diz "apaga `senha_hash`… e audita; aluno com conta da escola ligada: `SEM_SENHA`", o que se lê como apagar antes de recusar. Melhor escrever "depois do escopo e antes de apagar". O cenário já prende o certo.
- **Onde vai o bilhete (§4 contra §5).** A tabela da §4 põe o bilhete no corpo (`{ bilhete, senha }`) e a §5 diz "no cabeçalho". Vale alinhar: cabeçalho nas duas rotas, ou deixar claro que o cabeçalho vale para o `GET /trocas`. Corpo não é URL, então não vaza.
- **Linha do "Link da conta" no `docs/lgpd.md`.** Falta o envio parado (24 h, até cerca de 48 h) que a §5 aplica também ao link, e falta um cenário [I] para o link, como o do convite.
- **"Evento do calendário".** A retenção diz "o ano letivo", mas nenhuma rotina apaga o evento do ano encerrado. Ou classificar como `sem_pessoa`, coerente com o titular "nenhum, por desenho", ou nomear quem apaga. A descrição em texto livre fica mitigada só pela orientação na tela.
- **Classificação das quatro tabelas novas (§7).** `importacao_planilha`, `alocacao` (vai no arquivo do professor pelo vínculo?), `evento_calendario` e `link_da_conta` precisam entrar na `CLASSIFICACAO_DAS_TABELAS`. O teste de arquitetura obriga, mas a decisão é desta spec. `provisoria_gerada_por` vai na lista do que não entra no arquivo, como id de outra pessoa.
- **Leitura por alvo.** Só `.gerada` e `.usada` entram por alvo. Vale estudar a leitura por alvo também para as outras ações sobre o aluno (`usuario.nome_corrigido`, `aluno.transferido`, `usuario.desativado`), sem autor nem `antes`/`depois`. Isso responde melhor à pergunta de fechamento sobre quem agiu sobre o aluno.

### Pergunta de fechamento

Responde. O arquivo do titular passa a trazer a provisória pelo alvo. Os segredos e a `contaExterna` ficam fora do arquivo, e as tabelas novas são forçadas à classificação. Nenhum envio externo leva dado de aluno. A planilha em gravação guarda nome e matrícula fora do arquivo por no máximo cerca de 25 h, e isso está declarado.

Arquivos relevantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/techspec.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/cenarios.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/docs/lgpd.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/packages/shared/src/privacidade/classificacao.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/packages/core/src/titular/leitura-do-titular.ts`

```
VEREDITO: REPROVADO
Campos pessoais tocados: nome e matrícula do aluno (planilha até o fim do job, usuario, lista_nome); nome e e-mail da equipe; credencial_matricula.provisoriaHash, provisoriaExpiraEm, provisoriaGeradaPor; reivindicacao.contaExterna; cookie educa_conta_provada; conta.emailVerificadoEm; alocacao; evento_calendario (descrição livre); link_da_conta (token e endereço cifrados); papel de quem gerou no depois da senha_provisoria.gerada
Fora da tabela de dados do docs/lgpd.md: nenhum
Autorização por objeto: ok
[… 7 linhas cortadas]

## infra-guardian · 4ª rodada · REPROVADO · 2026-11-03 12:57:45 · `tasks/prd-onboarding-por-convite/revisao-spec.md`

VEREDITO: REPROVADO
Caminho quente tocado: login | fila | migration
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida contra efeito duplo. Duas travas, porém, duram mais que o `statement_timeout` de 2 s (`BANCO_TIMEOUT_CONSULTA_MS`, que vale para API e worker e inclui a espera de trava): Tech Spec §5 "E-mail" e §5 "O job"
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: compatível
Métrica e alerta: ok

**Bloqueantes da rodada 3:** os dois foram resolvidos.
- `turma.chave` acompanha a renomeação. Está na §3 (recalculada no mesmo `update`; nula fora do padrão; `CONFLITO` no único; a classificação calcula pelo nome quando a coluna é nula) e na §5 "O job" (`desatualizada`). Os cenários estão no RF3 e na linha de "Corridas".
- A verificação do e-mail não se contradiz mais. A §5 "Posse do e-mail" gera um link novo no lugar do aberto, com teto de 3/h por conta que rebaixa. O cenário "quarto aceite" e a linha "Verificar no aceite" da tabela "Limites" batem com isso.

**Bloqueantes novos, abertos pelas correções desta rodada:**

1. **§5 "E-mail" e cenário [P] do RF11 ("a revogação espera o envio").** O job de e-mail segura a linha do convite ou do `link_da_conta` durante o envio SMTP, por até 10 s. Quem precisa da mesma linha espera, e o `statement_timeout` de 2 s corta essa espera antes. São eles:
   - a revogação e o refazer;
   - o `desativar`, inclusive dentro do job de planilha;
   - o "esqueci" e o verificar, quando trocam o link aberto por um novo.

   Com SMTP lento, o efeito é este:
   - a coordenação recebe 503 `TEMPO_ESGOTADO`;
   - o job de planilha que desliga um professor falha e queima tentativa;
   - o "esqueci" de um e-mail que tem conta com link em envio responde 503 em vez do 202 igual, o que revela que a conta existe.

   A recomendação da rodada 3 ("a trava dura o envio") foi minha e não fechou com esse prazo.

   **Correção exigida:** não segurar a linha durante o SMTP. O padrão de mercado é uma reserva com prazo:
   - uma transação curta grava `envio = 'enviando'` e a hora da reserva, e lê os cifrados;
   - envia fora da transação;
   - grava `enviado` com `where envio = 'enviando'`;
   - a reentrega só retoma a reserva vencida (`skip locked`);
   - a revogação, o `desativar` e a troca de link gravam na hora, sem esperar, e o link revogado já não vale mesmo que o e-mail saia (D49).

   Se a Tech Spec mantiver a trava, cada um desses caminhos precisa de `nowait` ou `skip locked` com resposta definida (o "esqueci" e o verificar, a resposta igual), e o tempo limite do SMTP tem de caber no `statement_timeout`. Reescreva o cenário [P] da revogação e acrescente: "esqueci com o link em envio: 202, igual ao e-mail sem conta".

2. **§5 "O job", §13 e cenário [C] do RF2 ("espera de trava e p95 medidos").** O job agora é uma transação só, de até 3.000 linhas. Ela segura até o fim:
   - as turmas, travadas em `FOR NO KEY UPDATE` pelo `encerrar` da transferência;
   - os pedidos;
   - a conta criada ou achada pelo `contaParaConvite`.

   Às 7h30, quem precisa dessas linhas espera mais que os 2 s e recebe 503:
   - o gerar acesso (`FOR SHARE` na turma, `acesso-da-turma.service.ts`);
   - a decisão do professor (`FOR UPDATE` no pedido);
   - o job de outra escola que insere o mesmo e-mail. Ele espera o fim da transação da primeira, e o cenário "duas escolas em ordens opostas: as duas `concluida`" pode acabar em `falhou`.

   O cenário [C] mede a espera, mas não tem critério de aprovação, então não prova nada. E a saída da §13, "quebrar por turma", contradiz a atomicidade que a §5 e o cenário "falha no segundo lote: zero turmas" exigem.

   **Correção exigida:**
   - declarar quais turmas o job trava e em que modo;
   - deixar a classificação, as leituras e os inserts que não conflitam no começo, e as travas de turma, pedido e conta numa fase final curta;
   - dar ao cenário [C] critério de aprovação: zero 503 no gerar acesso e na decisão durante um job de 3.000 linhas com transferências, espera de trava com p95 abaixo de um valor fixado e duração da fase com trava abaixo do `statement_timeout`;
   - trocar a saída da §13 por uma compatível com a transação única;
   - no cenário das duas escolas, fixar que a espera pelo único do e-mail cabe no prazo ou que o tempo esgotado vira nova tentativa sem gastar `ultimaTentativa`.

**Recomendações:**
- A tabela de estados da §5 manda a importação concluída sair em 90 dias pelo `sistema.expurgar-acesso`, sem escopo. Isso contradiz a linha logo abaixo dela, que põe a importação no `retencao.expurgar-escola`, e não está nas exceções da §6. Alinhar, e conferir com o `tenancy-guardian`.
- Voltar à versão anterior deixa a `turma.chave` desatualizada quando o código antigo renomeia uma turma. O runbook do retorno deve recalcular ou anular a chave onde ela difere do nome normalizado.
- Dois aceites que precisam de verificação ao mesmo tempo: quem perde o único `(contaId, finalidade)` deve responder `VERIFICACAO_PENDENTE`, nunca 500. Pôr uma linha em "Corridas".
- Conferir o `EMAIL_POR_MINUTO` antes de pegar a linha, para o adiamento não segurar trava.
- A nova tentativa por deadlock do `contaParaConvite` não deve gastar `ultimaTentativa`.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/.env.example (`BANCO_TIMEOUT_CONSULTA_MS=2000`, que vale para API e worker)
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/apps/api/src/sala/acesso-da-turma/acesso-da-turma.service.ts (gerar acesso trava a turma em `FOR SHARE`)

## revisor-geral · 4ª rodada · APROVADO · 2026-11-03 12:57:52 · `tasks/prd-onboarding-por-convite/revisao-spec.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: não se aplica. É revisão de spec e ainda não há código. O `conferir` responde "nunca passou nesta árvore", e isso volta a valer na primeira tarefa.
Bloqueantes: nenhum

**Bloqueante da rodada 3: resolvido.**
- §5 "Gravar": o `fechar('encerrada')` grava só o estado e anula os quatro segredos, sem `decidida*`, e o `virarSala` passa por ele.
- §3: o check `reivindicacao_segredo_so_pendente` está escrito por extenso. Pendente quer dizer chave e marca presentes e exatamente uma de senha ou `contaExterna`; fora do pendente, as quatro são nulas. Isso combina com o check atual em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/packages/core/src/db/schema/reivindicacao.ts`, que hoje tem três segredos e passa a ter quatro.
- `cenarios.md`, "Conta da escola do aluno": o pedido encerrado pela transferência e pela virada fica sem `decidida*` e com `contaExterna` nula, e o check recusa senha e conta juntas.

**Recomendações da rodada 3: todas feitas.** São elas: o `convidar` no job (§5), a cerca por arquivo (§6), os quatro `@Unscoped` (§11, conferi: o `ContaGlobalRepository` tem três hoje), o `contaParaConvite` na ordem do e-mail, a invariante do `travarPendente` e o `usuario.nome_corrigido`. O `SEM_SENHA` (§5) bate com o PRD §7.

Recomendações:
- **§1, a frase sobre a conta global continua imprecisa.** A frase "No worker, a conta global só é alcançada pelas exceções da seção 6" não fecha. O job desliga pelo `desativar` (§2, `ciclo-de-vida/`), que chega à conta global pelos `@Unscoped` do `ContaGlobalRepository` (travar e limpar a conta). Esse caminho já existe e não está na §6. Sugestão: acrescentar "e pelo ciclo de vida que já existe".
- **§6, falta dizer por onde a API chega ao `link_da_conta`.** A cerca cita só o `enviar-email.ts` e o expurgo de acesso. Mas a própria seção diz "só pelo hash do token, pela conta", e esses são caminhos da API: o "esqueci", o redefinir e o verificar no aceite. Vale dizer qual classe da API lê e grava essa tabela e em que zona ela fica (provavelmente `apps/api/src/sessao/`, como o `codigo_recuperacao`). Sem isso, o implementador escolhe sozinho entre furar a cerca do `EnvioRepository` e criar um segundo repository para a mesma tabela.
- **§5, `fechar('encerrada')` e `virarSala`.** O `fechar` de hoje trabalha por id, sobre o pedido que o `travarPendente` travou. O `virarSala` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/apps/api/src/estrutura/ano-letivo/ano-letivo.repository.ts`) é um `update` único sobre todos os pendentes do ano. "Passa por ele" deixa em aberto se ele vira um laço com trava pedido a pedido ou se as duas escritas compartilham só o conjunto de colunas. Sugestão: a §5 dizer qual dos dois.
- **§4, faltam os códigos de erro novos.** `SEM_SENHA`, `VERIFICACAO_PENDENTE` e o `expirada` da importação ainda não existem em `packages/shared` (regra 00, erro tipado com código). Uma linha na §4 dizendo que eles entram no contrato evita que a tarefa os esqueça.
- **§5, tabela de estados, quem apaga a importação concluída.** A importação concluída sai em 90 dias pelo `sistema.expurgar-acesso`, que não tem escopo. Isso segue o precedente do `convite` e do `acesso_turma` nesse expurgo e não acrescenta nenhum `@Unscoped`. Mesmo assim, a §6 e a §11 deviam citar a `importacao_planilha` como alvo novo dele, ao lado do `link_da_conta`.

## privacy-guardian · 5ª rodada · REPROVADO · 2026-11-03 13:04:12 · `tasks/prd-onboarding-por-convite/revisao-spec.md`

VEREDITO: REPROVADO

Campos pessoais tocados: nome e matrícula do aluno (prévia, `importacao_planilha.linhas`, `lista_nome`, `usuario.nome`), nome e e-mail do professor (planilha, `conta`, convite), token e endereço cifrados (`convite`, `link_da_conta`), `conta.emailVerificadoEm`, senha provisória (`credencial_matricula.provisoria*`), conta da escola do aluno (`reivindicacao.contaExterna`, cookie `educa_conta_provada`), alocação, evento do calendário.

Fora da tabela de dados do docs/lgpd.md: nenhum campo novo ficou de fora. Três linhas, porém, descrevem uma retenção diferente da que a §5 constrói (bloqueante abaixo).

Autorização por objeto: ok. A provisória confere o escopo e a conta ligada antes de apagar e responde 404 igual fora da turma. Grade e calendário só com vínculo confirmado. O `anoLetivoId` é validado no servidor. Os dois jobs de e-mail leem pela escola do registro ou só pelo id. O bilhete é recusado na query.

Logs: limpos no desenho (§7: nunca linha, e-mail, token nem resposta do SMTP; `nodemailer` sem `logger` nem `debug`). A falha de job já sai limpa para o Redis, porque o `JobFailureError` usa o código como mensagem (`apps/worker/src/job-failure.error.ts`).

Auditoria: presente. A tabela RF17 do `cenarios.md` tem uma linha por ação, inclusive `turma.alunos_lidos` quando a prévia mostra nome do banco, e `senha_provisoria.gerada` e `.usada` entram no arquivo do titular.

Envio externo: só o provedor de e-mail. Recebe endereço e texto de professor ou coordenador, nunca dado de aluno, e precisa estar em `suboperador` antes do portão. Fica registrado no estado do envio e em `convite.enviado`. Sem IA.

Seed/fixture: sintético (`oidc-falso`, Mailpit local, seed compartilhado do e2e).

**Bloqueante da rodada 4:** resolvido na Tech Spec e no cenário. A provisória vencida é anulada pelo `retencao.expurgar-escola`, por escola e com escopo (§5, parágrafo depois da tabela de estados), e o cenário [I] usa relógio falso: com 23 h mantém, com 25 h anula, e a auditoria fica. As quatro recomendações também foram feitas: gerar confere antes de apagar, bilhete nunca na URL, envio parado do `link_da_conta` com cenário, evento do calendário classificado `sem_pessoa`.

Bloqueantes:
1. **O `docs/lgpd.md` (linhas "Envio do convite por e-mail", "Link da conta" e "Senha provisória") e o `cenarios.md` não acompanham a retenção que a §5 constrói.** São dois furos, e o primeiro nasceu desta rodada.
   - (a) **Estado `enviando` sem prazo.** O estado novo guarda token e endereço cifrados. A tabela de estados da §5 manda o expurgo gravar `falhou` e anular os cifrados em `na_fila` **e** em `enviando` com mais de 24 h. O `docs/lgpd.md` diz "cifrados enquanto `na_fila`" na descrição e põe o prazo de 24 h só para `na_fila`. Para quem para em `enviando` (processo morto na última tentativa, job que o BullMQ dá como travado e não roda de novo), a retenção fica sem fim. Os cenários RF11 ("Envio `na_fila` há 24 h") e RF12 ("parado há mais de 24 h") só provam `na_fila`. Uma implementação com `where envio = 'na_fila'` passa em todos os testes e deixa o e-mail do professor guardado para sempre.
   - (b) **Rotina errada na linha da provisória.** O `docs/lgpd.md` ainda diz que a provisória vencida sai "no login seguinte ou no expurgo de acesso", e expurgo de acesso é o `sistema.expurgar-acesso`. A Tech Spec não constrói a anulação no login e põe a limpeza no `retencao.expurgar-escola`. Seguir o texto do `docs/lgpd.md` levaria a uma escrita sem escopo em `credencial_matricula`, que é tabela da escola (regra 10, item 9).
   - **Correção exigida:**
     - Nas linhas do convite e do link: "cifrados enquanto `na_fila` ou `enviando`", e "o envio `na_fila` ou `enviando` há mais de 24 h vira `falhou` e perde os cifrados (convite: `retencao.expurgar-escola`; link: `sistema.expurgar-acesso`; na pior hipótese, cerca de 48 h)".
     - Na linha da provisória: "no vencimento, pelo `retencao.expurgar-escola` da noite (na pior hipótese, cerca de 25 h)". Tirar "o login seguinte", ou então construir essa anulação na §5.
     - No `cenarios.md`: [I] envio de convite e envio de link parados em `enviando` há mais de 24 h, relógio falso, viram `falhou` com os cifrados nulos; com 23 h, ficam.

Recomendações:
- Transformar "cifrados nulos fora de `na_fila` e `enviando`" (§3) em check no banco, e testá-lo direto, como o check da reivindicação. Assim a promessa vira estrutura e não depende de cada caminho que grava `cancelado`.
- **Conta criada no passo (1) por job que falhou.** O `SEM_USO` do `sistema.expurgar-acesso` (`packages/core/src/retencao/expurgo-de-acesso.repository.ts`) limpa essa conta, como a §5 diz. Falta:
  - escrever o caso na linha "E-mail de login na conta global" do `docs/lgpd.md`;
  - um cenário [I] que prove que a conta sem usuário perde o e-mail na madrugada.
- **Janela entre o passo (1) e o (3) do job.** O expurgo noturno pode limpar o e-mail de uma conta recém-criada, que ainda não tem usuário nem convite. O passo (3) precisa então achar ou criar a conta de novo pelo e-mail, e não usar o id guardado do passo (1). É assunto do `infra-guardian`, com um cenário [P].

Arquivos lidos: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/techspec.md`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/cenarios.md`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/docs/lgpd.md`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/revisao-spec.md`.

## test-engineer · 5ª rodada · REPROVADO · 2026-11-03 13:05:01 · `tasks/prd-onboarding-por-convite/revisao-spec.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- **Os três bloqueantes da rodada 4:**
  - a ordem inversa da corrida entre o nome corrigido e a aprovação;
  - a revogação durante o envio;
  - a renomeação de turma contra o job.
- **O que esta rodada mudou:**
  - as contas dos professores em transações curtas, no passo (1);
  - a fase final curta com `lock_timeout`;
  - a reserva `enviando`;
  - a provisória vencida anulada pelo expurgo;
  - o "esqueci" com link em envio;
  - os dois aceites com verificação.
- **As recomendações da rodada 4:** falha injetada em toda tentativa, o check testado direto no banco, o envio do link antigo, o expurgo de 90 dias, o bilhete fora da URL, e `turma.criada` e a "volta" na tabela de auditoria.

**Cobertos:**
- **Bloqueante 1 da rodada 4: resolvido.** A Tech Spec §5 trata do job em `techspec.md:90-96` e a tabela Corridas em `cenarios.md:247`. Os dois [P] estão em `cenarios.md:40-43`.
- **Bloqueante 2: resolvido.** A §5 "E-mail" está em `techspec.md:122-125`. O [P] com o SMTP preso numa barreira está em `cenarios.md:118-119`. O teste de cifrados nulos está em `cenarios.md:115`.
- **Bloqueante 3: resolvido.** O cenário está em `cenarios.md:28-29`.
- **Recomendações da rodada 4:** todas entraram.
  - falha injetada em toda tentativa: `cenarios.md:93-95`
  - check testado direto no banco: `cenarios.md:185-186`
  - link antigo vira `cancelado`: `cenarios.md:131-132`
  - expurgo de 90 dias: `cenarios.md:87` e `:101`
  - bilhete na query: `cenarios.md:161`
  - auditoria: `cenarios.md:287-288`
- **Mudanças desta rodada:**
  - provisória com 23 h e 25 h: `cenarios.md:167-168`
  - dois aceites com verificação: `cenarios.md:133` e `:240`
  - duas escolas em ordens opostas: `cenarios.md:99-100`
  - "esqueci" com link em envio: `cenarios.md:141`
- **Tabela Corridas:** todas as linhas têm o seu [P], menos a da linha 239 (bloqueante 5).

**Bloqueantes:**

1. **`techspec.md:91-96`: o passo (3) não reconfere o que o passo (2) leu sem trava.** A divisão em três passos abriu uma janela entre (2) e (3), e só duas mudanças nela estão tratadas: o único de `chave` e a `lista_nome` aprovada. Três casos ficam de fora:
   - **Renomeação de turma.** A turma tocada é renomeada de "8A" para "9B" entre (2) e (3). O (3) trava a turma pelo id e grava os alunos da linha "8A" na "9B", com `concluida`. O [P] de `cenarios.md:28` só cobre o caso inverso, uma turma nova com a mesma chave.
   - **Desativação manual.** Um aluno a transferir, ou que "volta", é desativado à mão entre (2) e (3). O job dá a ele um vínculo confirmado.
   - **Pedido novo.** Se "os pedidos pendentes delas, por id" quer dizer a lista lida no (2), um pedido criado entre (2) e (3) e aprovado durante o (3) não fica travado. A aprovação copia o nome antigo, e o job sai `concluida`. É justamente o que `cenarios.md:43` diz que nunca acontece.
   - Além disso, não está dito o que fazer quando o único da matrícula é violado no (3).
   - **Correção exigida:**
     - Depois de travar, o (3) reconfere a `chave` das turmas travadas e o estado dos usuários marcados.
     - O (3) relê os pedidos pendentes das turmas, e não a lista do (2). "Por id" passa a ser só a ordem das travas.
     - Qualquer divergência, ou único violado (`chave` ou matrícula), faz a importação sair `desatualizada`.
     - Dois [P] novos: a renomeação entre (2) e (3), e o pedido criado e aprovado durante o (3).

2. **`techspec.md:91`: a conta criada no passo (1) pode ser limpa antes do passo (3).** A conta que o passo (1) cria ainda não tem usuário nem convite. É exatamente o critério de "conta sem uso" do `sistema.expurgar-acesso` (`packages/core/src/retencao/expurgo-de-acesso.repository.ts:147-191`), que apaga o e-mail da conta.
   - Até agora, o `contaParaConvite` e o convite ficavam na mesma transação, e o comentário em `:170` desse arquivo conta com isso.
   - Com os passos separados, o expurgo pode limpar a conta entre o (1) e o (3), inclusive entre duas tentativas depois de um `lock_timeout`. O (3) então convida uma conta sem e-mail.
   - **Correção exigida:** o (3) trava as contas (`FOR SHARE`) e confere que o e-mail não é nulo; se for, nova tentativa, e o (1) recria a conta. Um [P] com o expurgo rodando entre o (1) e o (3).

3. **`techspec.md:96`: a cláusula nova "Trava esgotada ou deadlock: nova tentativa" não tem cenário.** O `lock_timeout` de 1 s é desta rodada. `cenarios.md:99-100` só cita a nova tentativa entre parênteses, e trata das contas do passo (1).
   - **Correção exigida:** um [I] ou [P] em que uma turma fica travada por outra transação por mais de 1 s durante o (3). Ele precisa provar que:
     - não há escrita parcial;
     - a importação segue `na_fila`, e não `falhou`, na primeira vez;
     - solta a trava, a nova tentativa conclui;
     - na última tentativa, a importação sai `falhou`.

4. **`techspec.md:124-125` e `cenarios.md:112`: falha transitória com a linha em `enviando` não está definida.** Depois de um 4xx ou de uma queda, a Tech Spec não diz se a linha volta a `na_fila`. Uma nova tentativa antes de 2 min encontra a reserva viva e pode pular o envio. A linha fica então `enviando` até o expurgo de 24 h gravar `falhou`. O cenário da linha 112 diz só "nova tentativa", sem asserção sobre o resultado.
   - **Correção exigida:** escolher um dos dois caminhos e escrever na §5:
     - o 4xx ou a queda devolve a linha a `na_fila` (`where envio = 'enviando'`) antes de relançar;
     - ou a reserva pertence à tentativa.
   - No cenário, asserir:
     - o segundo envio chega ao falso;
     - a linha termina `enviado`;
     - com uma revogação entre as tentativas, termina `cancelado` e sem segundo envio.

5. **`cenarios.md:239` (Corridas), contra `techspec.md:124`: dois dos três atores ficam sem teste.** A §5 diz que três atores gravam `cancelado` durante o envio: a revogação, o `desativar` e o link novo. A linha da tabela também junta "revogação ou link novo". Só a revogação tem [P] com a linha em `enviando` (`cenarios.md:118`).
   - `cenarios.md:141` só verifica o 202.
   - `cenarios.md:126` só cobre o envio ainda `na_fila`.
   - **Correção exigida:** dois [P] com o SMTP preso numa barreira.
     - Link novo, pelo "esqueci" e pelo "verificar": a linha antiga termina `cancelado`, com os cifrados nulos, e o token antigo é recusado em `/redefinir` e em `/conta/verificar`.
     - `desativar`: o envio termina `cancelado`, e o link do convite é recusado no aceite.

**Recomendações:**
- **`cenarios.md:41-43`:** a aprovação parada depende do `lock_timeout` de 1 s. Assirta só o estado final, que é `desatualizada` pelos dois caminhos (espera ou nova tentativa), para o teste não depender da máquina.
- **`cenarios.md:141`:** "no mesmo tempo" deve ser provado pelo piso com relógio falso, como na linha 137, nunca por cronômetro.
- **`cenarios.md:114`:** incluir também o envio parado em `enviando` há 24 h, não só em `na_fila`.
- **`docs/lgpd.md` contra a Tech Spec:**
[… 11 linhas cortadas]

## infra-guardian · 5ª rodada · REPROVADO · 2026-11-03 13:05:45 · `tasks/prd-onboarding-por-convite/revisao-spec.md`

VEREDITO: REPROVADO
Caminho quente tocado: login | sala | fila | migration
Rate limit: ok
Fila e prioridade: ok
Concorrência: corrida na §5 "O job", passo (3): impasse com a decisão e corrida com a reivindicação
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: compatível
Métrica e alerta: ok

Os dois bloqueantes da rodada 4 foram resolvidos. O e-mail agora reserva a linha numa transação curta, envia fora dela, grava `enviado where envio = 'enviando'` e cancela na hora. O job tem três passos, com `lock_timeout` e o cenário [C] com critério. Todas as recomendações da rodada 4 entraram. Os dois bloqueantes abaixo estão no passo (3), que é novo.

Bloqueantes:

1. **§5 "O job", passo (3), e a linha "Job contra a decisão do professor" das Corridas do `cenarios.md`.**
   - **O que está errado:** a spec não diz com que modo o passo (3) trava as turmas. Também afirma "a decisão da A1 trava ano e pedido: sem ciclo", e isso não é verdade. A aprovação, depois de travar o pedido, grava o `vinculo`. A FK composta `(escola_id, ano_letivo_id, turma_id)` pede `FOR KEY SHARE` na turma (veja `apps/api/src/sala/decisao/decisao.service.ts`, `#decidirUm`, e `criarAlunoConfirmado`).
   - **Consequência:** se o job travar as turmas em `FOR UPDATE`, a decisão segura o pedido e espera a turma, enquanto o job segura a turma e espera o pedido. Isso é um impasse (deadlock). O Postgres derruba um dos dois depois do `deadlock_timeout`. Quando a vítima é a decisão, o professor recebe erro, e o critério do [C] ("zero 503 na decisão") cai.
   - O cenário [P] "Aprovação parada depois de travar o pedido" pode passar mesmo assim, porque a vítima costuma ser o job, que tenta de novo. Ou seja, o cenário não prova que o impasse não existe.
   - O mesmo `FOR UPDATE` também barra o `insert` de toda reivindicação nessas turmas, que pede `FOR KEY SHARE` pela FK, às 7h30.
   - **Correção exigida:**
     - travar as turmas em `FOR NO KEY UPDATE`, o padrão do `travarContraOGerar` em `apps/api/src/estrutura/turma/turma.repository.ts`, que barra o gerar acesso e deixa passar o `FOR KEY SHARE` das FKs;
     - justificar o "sem ciclo" contando com a FK do vínculo;
     - no [P], afirmar zero `40P01` nos dois lados, com o job concluindo sem precisar de nova tentativa.

2. **§5 "O job", passo (3), e "Gravar": transferência e desligamento de quem ainda não foi aprovado.**
   - **O que está errado:** o passo (3) trava só os pedidos pendentes que existem no momento da trava. Uma reivindicação do aluno pode ser confirmada no banco entre essa trava e o `update`/`delete` da `lista_nome` (`reivindicacao.service.ts`: grava o pedido e depois o `update` condicional da `lista_nome`). Ela cria um pedido pendente que o job não vê, e a condição `estado <> 'aprovado'` deixa passar o nome `reivindicado`.
   - **Consequências:**
     - Na transferência, o nome vai para a turma nova e o pedido fica pendente na antiga. Se o professor da turma antiga aprova, o aluno nasce nela, o que viola o RF5: "nenhum aluno aprovado fica na turma antiga".
     - No desligamento, a `lista_nome` é apagada e a FK `on delete set null` deixa o pedido pendente sem nome. A decisão então lança `InvariantException`, e o professor recebe 500.
   - **Correção exigida:**
     - toda escrita em `lista_nome` no passo (3) fica condicionada ao estado lido no passo (2) (`where id = … and estado = :lido`), e não só a `<> 'aprovado'`;
     - zero linhas: a transação volta e a importação sai `desatualizada`;
     - linha nova nas Corridas, mais um cenário [P] no RF5: reivindicação parada no nome da turma antiga contra o passo (3). O resultado aceito é a reivindicação recusada ou o job `desatualizada`. Nunca um pedido pendente com o nome em outra turma ou com o nome nulo.

Recomendações:
- **§5 "E-mail":** se o BullMQ reentrega o job em menos de 2 min (o processo morreu depois de reservar), o job encontra a reserva ainda vigente. Ele deve adiar até o prazo da reserva sem gastar tentativa, em vez de sair. Se sair, a linha fica `enviando` até o expurgo de 24 h e vira `falhou` sem ninguém retomar. Grave também `enviado where envio = 'enviando' and envioReservadoEm = :daMinhaReserva`.
- **`EMAIL_POR_MINUTO` global:** uma escola enviando 300 convites gasta a cota e atrasa o "esqueci" das outras. Sugestões: uma fatia reservada para `sistema.enviar-email-da-conta`, ou um teto por escola por minuto.
- **Passo (3) em produção:**
  - medir a duração do passo e a espera de trava (histograma por escola), com alerta e parágrafo no runbook, porque o critério do [C] só vale enquanto ninguém mede em produção;
  - se o Postgres for 17, `SET LOCAL transaction_timeout` impõe o teto também em produção.
- **"Trava esgotada ou deadlock: nova tentativa":** use espera crescente entre as tentativas, ou adie sem gastar tentativa, como na taxa de e-mail. Senão a rajada das 7h30 esgota as tentativas e a importação sai `falhou`.
- **Expurgo da provisória pelo `retencao.expurgar-escola`:** índice parcial `(escolaId, provisoriaExpiraEm) where provisoriaHash is not null` na `credencial_matricula`.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/apps/api/src/sala/decisao/decisao.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/apps/api/src/sala/reivindicacao/reivindicacao.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/apps/api/src/estrutura/turma/turma.repository.ts

## privacy-guardian · 6ª rodada · REPROVADO · 2026-11-03 13:09:56 · `tasks/prd-onboarding-por-convite/revisao-spec.md`

VEREDITO: REPROVADO

Campos pessoais tocados: nome e matrícula do aluno; nome e e-mail do professor; token e endereço cifrados do convite e do `link_da_conta`; hash, validade e autor da senha provisória; identificador opaco da conta da escola (`reivindicacao.contaExterna` e o cookie `educa_conta_provada`); e-mail da conta global, que o passo (3) agora trava em `FOR SHARE` e confere.

Fora da tabela de dados do docs/lgpd.md: nenhum. Todo campo novo da §3, e o cookie, tem linha com finalidade e retenção.

Autorização por objeto: ok. Esta rodada não muda nada aqui: provisória e grade continuam presas ao vínculo confirmado, com 404 igual (§4, §6 e os cenários de RF13 e RF16).

Logs: limpos. A §7 proíbe linha, e-mail, token e resposta do SMTP no log, e há cenário que confere token e e-mail fora do log do worker.

Auditoria: presente. A tabela RF17 do `cenarios.md` tem uma linha por ação, e `senha_provisoria.gerada` e `.usada` entram no arquivo do titular.

Envio externo: endereço e texto da equipe (escola e link, nunca dado de aluno) vão ao provedor de e-mail. O provedor entra em `suboperador` antes do portão. Cada envio fica registrado em `envio` e em `convite.enviado`. Não há IA.

Seed/fixture: sintético. A spec não prevê dado real, e o e2e usa Mailpit e o `oidc-falso`.

**Como ficou o bloqueante da rodada 5**
- **(a) Convite e link da conta: resolvido.** As linhas "Envio do convite por e-mail" e "Link da conta" do `docs/lgpd.md` agora dizem que os cifrados só existem em `na_fila` ou `enviando`. Envio parado há mais de 24 h vira `falhou`: o do convite pelo `retencao.expurgar-escola`, o do link pelo `sistema.expurgar-acesso`, com pior hipótese de cerca de 48 h. Isso bate com a tabela de estados da §5 (24 h mais até 24 h até a próxima rodada noturna). Os cenários [I] com relógio falso (23 h ficam, mais de 24 h viram `falhou`) estão em RF11 e em RF12.
- **(b) Senha provisória: resolvido em parte.** O "login seguinte" saiu e o mecanismo agora é o expurgo noturno. Mas o número da pior hipótese ficou errado (é o bloqueante abaixo).
- **Recomendação da conta sem usuário: resolvida.** O cenário está em "Job e estados". Conferi no código existente: o filtro `SEM_USO` de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/packages/core/src/retencao/expurgo-de-acesso.repository.ts` já pega a conta sem nenhum `usuario`. A linha "E-mail de login na conta global" cobre o caso.
- **4xx de volta a `na_fila` e `FOR SHARE` nas contas do passo (3): nenhum problema novo de dado pessoal.** Os cifrados continuam presos a `na_fila` e `enviando`, e o prazo de 24 h continua cortando.

Bloqueantes:
1. **`docs/lgpd.md`, linha "Senha provisória do aluno", e a provisória na §5.** O texto diz "no vencimento, pelo `retencao.expurgar-escola` da noite (na pior hipótese, cerca de 25 h)". A conta não fecha:
   - A provisória vale 24 h (PRD, RF13) e o expurgo roda uma vez por noite, à 1h.
   - Gerada às 1h30, ela vence às 1h30 do dia seguinte e só é apagada às 1h do outro dia. São cerca de 48 h desde a geração, ou cerca de 24 h depois do vencimento.
   - "Cerca de 25 h" não serve para nenhuma das duas contagens. O próprio documento faz a conta certa nas outras linhas: importação, 1 h + 24 h = ~25 h; envio, 24 h + 24 h = ~48 h. Aqui ele usou o prazo da importação.
   - É o mesmo defeito da rodada 5: o mapa de dados promete à escola um prazo que o desenho não cumpre, e para menos do que o real.

   **Correção exigida:** trocar para "na pior hipótese, cerca de 48 h depois de gerada (até ~24 h depois do vencimento)". O cenário de 23 h e 25 h pode ficar como está, porque prova a regra e não o pior caso.

Recomendações:
- **§5 e as duas linhas de envio do `docs/lgpd.md`:** dizer de que coluna contam as 24 h. Deve ser o `criadoEm` da linha, nunca o `envioReservadoEm`, que é reescrito a cada reserva e a cada volta a `na_fila`.
- **`link_da_conta`:** o token cifrado do link de redefinir continua guardado até 24 h, mesmo depois de o link vencer em 1 h. Anular os cifrados no vencimento do link, ou na limpeza da conta (o `SEM_USO`), encurta o tempo em que o e-mail cifrado sobrevive à conta já limpa.
- **§6 e §11:** dizer em que método e em que zona cercada fica a releitura das contas em `FOR SHARE` no passo (3), por exemplo no `cadastro-de-professor.ts`, junto do `contaParaConvite`. Assim a contagem de `@Unscoped` do `ContaGlobalRepository` continua certa.

## test-engineer · 6ª rodada · REPROVADO · 2026-11-03 13:10:58 · `tasks/prd-onboarding-por-convite/revisao-spec.md`

VEREDITO: REPROVADO

**Cenários exigidos:** os cinco bloqueantes da rodada 5, as recomendações da rodada 5 e o que as correções abriram no passo (3) do job e no envio de e-mail.

**Cobertos:**
- **Bloqueante 1, em parte.** A §5 "O job" (techspec.md:95-98) agora relê sob a trava e põe `where estado = :lido` na `lista_nome`. Há cenário [P] para a renomeação (cenarios.md:31), o pedido criado e aprovado durante o (3) (:46) e a desativação (:60). Falta o que está no bloqueante 1 abaixo.
- **Bloqueante 2, resolvido.** As contas ficam em `FOR SHARE` e e-mail nulo vira nova tentativa (techspec.md:94, :98); o [P] está em cenarios.md:111. Conferi no código atual: o expurgo da conta sem usuário já existe, com `SEM_USO` e `skip locked` em `packages/core/src/retencao/expurgo-de-acesso.repository.ts:148-182`. Ele pula a conta travada pelo (3), e depois do (3) a conta tem usuário ativo. O que cenarios.md:102 promete é verdade.
- **Bloqueante 3, resolvido.** Trava esgotada em cenarios.md:109-110: nenhuma escrita parcial, `na_fila` na primeira vez, conclui quando a trava solta, `falhou` na última.
- **Bloqueante 4, resolvido.** O 4xx devolve a linha a `na_fila`, o segundo envio termina `enviado` e a revogação entre as tentativas termina `cancelado` (techspec.md:127; cenarios.md:125-126). A reserva alheia vigente tem [P] em cenarios.md:128.
- **Bloqueante 5, resolvido.** Os dois [P] estão em cenarios.md:137-139.
- **Recomendações da rodada 5, todas atendidas:**
  - os [P] que dependem do `lock_timeout` conferem só o estado final (:43-45);
  - o piso do "esqueci" é provado por relógio falso (:157, :161);
  - o envio parado há 24 h tem cenário no convite e no link (:130, :162);
  - o critério do [C] (:17-18) e a §13 apontam para o mesmo lugar (techspec.md:222);
  - o (3) contra o gerar acesso e o `virarSala` é determinístico, com barreira (:113);
  - o `docs/lgpd.md` está alinhado: 25 h para a planilha, 48 h para os dois envios, provisória pelo `retencao.expurgar-escola`, linhas novas do evento do calendário e do cookie.

**Bloqueantes:**

1. **O (3) não relê o vínculo, e a correção do bloqueante 1 ficou incompleta.** techspec.md:95-98, §5 "O job".
   - **O que está errado.** A lista do que o (3) relê é: chave da turma, estado do usuário, da `lista_nome` e dos pedidos, e-mail da conta. O (2) também decide pelo estado dos vínculos: o vínculo confirmado do aluno a transferir ou desligar, e o vínculo aberto que a grade reaproveita ou encerra. Esse estado não está na lista.
   - **Primeiro caso.** O `encerrar` atual (`apps/api/src/estrutura/vinculo/vinculo.repository.ts:216-222`) só devolve `false` quando o vínculo já está encerrado, e a spec não diz o que fazer com esse `false`. Se a coordenação encerrar à mão o vínculo do aluno entre o (2) e o (3), o job cria o vínculo confirmado na turma nova e termina `concluida`.
   - **Segundo caso.** Se o vínculo que a grade ia reaproveitar for encerrado entre o (2) e o (3), a alocação passa a apontar para um vínculo encerrado. Isso contradiz cenarios.md:83 ("encerrado não é reaberto: nasce um pendente").
   - **Terceiro caso.** A lista "único violado (`chave`, matrícula)" não inclui o `vinculo_ativo_unico`. Um vínculo à mão com a mesma tripla, criado entre o (2) e o (3), cai em erro definitivo e o job sai `falhou`, não `desatualizada`.
   - **Correção exigida na Tech Spec:**
     - pôr na releitura o estado dos vínculos que o (2) usou;
     - `encerrar` que devolve `false`, ou reaproveitamento de vínculo já encerrado, leva a `desatualizada`;
     - pôr o `vinculo_ativo_unico` na lista do único violado.
   - **Cenários exigidos no cenarios.md (depois de :60 e em RF7/RF9):**
     - [P] vínculo do aluno a transferir encerrado à mão entre o (2) e o (3): `desatualizada`, sem vínculo novo;
     - [P] vínculo da grade encerrado à mão entre o (2) e o (3): `desatualizada`, nenhuma alocação apontando para vínculo encerrado;
     - [P] vínculo à mão com a mesma tripla criado entre o (2) e o (3): `desatualizada`, nunca `falhou`.

2. **O 4xx que se repete até o fim não tem cenário.** techspec.md:127 diz "4xx ou queda: … tenta de novo, depois `falhou`", e cenarios.md:125-126 só cobre o 4xx seguido de sucesso e a revogação. Sem o cenário, uma implementação que deixa a linha em `na_fila` com os cifrados até o expurgo de 24 h passa nos testes.
   - **Cenário exigido em RF11:** [I] 4xx em toda tentativa: `falhou` na última, cifrados nulos, "falhou" na lista. O mesmo cenário vale para o link da conta.

3. **A metade da taxa reservada ao link da conta não tem cenário.** techspec.md:123 diz "global, com metade reservada ao link da conta". cenarios.md:129 e a linha do `EMAIL_POR_MINUTO` na tabela "Limites" (:290) só provam o adiamento. Sem a reserva, o "esqueci" de um professor fica atrás de 300 convites.
   - **Cenário exigido:** [I] convites enchem a metade deles no minuto; um link da conta ainda sai nesse minuto, e um convite a mais é adiado.

**Recomendações:**
- **cenarios.md:92.** "Duas execuções do mesmo job" deve usar uma barreira que deixe as duas passarem pelo (2) antes de qualquer uma entrar no (3). A §5 também deve dizer que o (3), depois do `for update` da importação, confere de novo se ela está `na_fila` e sai se não estiver. Hoje só o `where` final diz isso.
- **RF7 e RF9.** Pôr um [P] do professor desativado entre o (2) e o (3) da grade. "Estado do usuário" está na releitura, mas só o lado do aluno tem cenário (:60).
- **§5, passo (3).** Travar as turmas em ordem de id. A ordem hoje só está definida entre categorias, e o `encerrar` à mão trava turma e depois vínculo.
- **[C] (cenarios.md:17-18).** Incluir o login e o redefinir de professores cujas contas estão em `FOR SHARE` durante o (3) da planilha de professores. O redefinir trava a conta.
- **cenarios.md:165.** No "Dois esqueci em paralelo", provar também o piso de 400 ms no perdedor do índice único, que a §5 promete (techspec.md:135).

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/techspec.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/cenarios.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/docs/lgpd.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/apps/api/src/estrutura/vinculo/vinculo.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/packages/core/src/db/schema/vinculo.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/packages/core/src/retencao/expurgo-de-acesso.repository.ts`

## infra-guardian · 6ª rodada · REPROVADO · 2026-11-03 13:12:46 · `tasks/prd-onboarding-por-convite/revisao-spec.md`

VEREDITO: REPROVADO
Caminho quente tocado: login, fila, migration
Rate limit: ok
Fila e prioridade: ok
Concorrência: corrida na §5 "O job", passo (3), contra o `desativar` e o `eliminar` (§2, `packages/core/src/ciclo-de-vida/`)
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: compatível
Métrica e alerta: ok

**Os dois bloqueantes da rodada 5 foram resolvidos.**

- **Ciclo com a decisão.** A decisão trava o ano em `FOR SHARE`, depois o pedido em `FOR UPDATE` (`travarPendente`), e só então pede `FOR KEY SHARE` na turma pela FK do vínculo. O `FOR KEY SHARE` passa pelo `FOR NO KEY UPDATE` do job. O job trava o pedido antes de escrever na `lista_nome`, então nenhum dos dois espera por algo que o outro segura. A reivindicação também não fecha ciclo. A FK dela para a `lista_nome` é `(escolaId, id)`, e o job não muda essa chave, então o job pega a linha em `NO KEY UPDATE`, que convive com o `KEY SHARE` da reivindicação. O `tomar` espera, relê e sai recusado, ou o `where estado = :lido` do job dá zero linhas e o job sai `desatualizada`. O gerar acesso e o `virarSala` também não fecham ciclo: os dois travam o ano primeiro. Os [P] pedidos existem em RF4, RF5 e "Job e estados", com as linhas em "Corridas".
- **Reivindicação entre a trava e a escrita.** Está resolvida pela releitura sob a trava e pelo `where estado = :lido`.

As recomendações da rodada 5 foram todas incorporadas (§5 "E-mail", §8, §3).

Bloqueantes:

1. **§5 "O job", passo (3), contra o ciclo de vida: a ordem das travas está invertida e pode dar `40P01`.**
   - **O job:** trava importação, ano, turmas, contas e pedidos, e só depois escreve no `usuario` (nome corrigido do aprovado, ou `desativar` do marcado). A ordem dele é turma antes de usuário.
   - **O ciclo de vida:** o `desativar` e o `eliminar` começam por `travarUsuario` (`NO KEY UPDATE`) e `travarConta` (`FOR UPDATE`, em `ciclo-de-vida.service.ts`, `#naTransacao`), e só então travam turmas. A ordem deles é usuário, conta, turma. O `eliminar` já faz isso hoje, pelo `travarContraOGerarDoProfessor`. O `desativar` passa a fazer com esta spec, porque a §2 manda encerrar os vínculos pelo `encerrar`, que chama `travarContraOGerar(turma)` vínculo a vínculo e sem ordem de id.
   - **Corrida 1:** a coordenação desliga ou elimina o aluno X enquanto o passo (3) corrige o nome de X ou desliga X. A requisição segura X e espera a turma; o job segura a turma e espera X. A vítima do `40P01` pode ser a requisição da coordenação, que recebe 500.
   - **Corrida 2:** a mesma inversão acontece entre turmas. O job trava várias turmas sem ordem declarada, e o `desativar` de um professor com duas dessas turmas as trava em outra ordem.
   - **Correção exigida:**
     - Escrever na §5 uma ordem global única, seguida pelo job, pelo `desativar` e pelo `eliminar`. Há dois caminhos. (a) O passo (3) trava os usuários que vai escrever, e as contas, por id, antes das turmas, na mesma ordem do ciclo de vida. (b) O `desativar` e o `eliminar` travam as turmas do usuário antes do `travarUsuario`, inclusive para aluno, e reconferem o vínculo depois.
     - Turmas sempre por id, num comando só, como o `travarContraOGerarDoProfessor`.
     - Linha nova em "Corridas".
     - [P] com barreira: passo (3) com nome corrigido e desligamento de X contra a coordenação desativando X e eliminando X.
     - [P]: job com as turmas T1 e T2 contra o `desativar` do professor das duas, em ordem inversa.
     - Critério dos dois [P]: zero `40P01` na requisição; o job pode sair em nova tentativa ou `desatualizada`.

Recomendações:

- **§5 "O job":** definir "turmas tocadas" como destino, origem da transferência e turma de todo marcado (desligar, "sai da grade"). Sem isso, o pedido pendente do não aprovado desligado numa turma ausente da planilha não é relido nem travado. Fixar também a ordem `fechar('encerrada')` antes do `delete` da `lista_nome`: na ordem inversa, o check `reivindicacao_pendente_com_nome` dá 23514 e o job sai `falhou` em vez de `desatualizada`. Somar o [P] desse desligamento contra a decisão do mesmo pedido.
- **Passo (3):** limitar a duração da transação no próprio banco (`SET LOCAL statement_timeout` ou `transaction_timeout`). Assim a trava das turmas nunca passa do que o gerar acesso tolera (2 s), sem depender só do cenário [C].
- **`cenarios.md`, tabela "Limites":** a linha do `EMAIL_POR_MINUTO` não registra a metade reservada ao link da conta. Somar um [I]: o lote de 300 convites não atrasa o link do "esqueci".
- **§3:** índice para o expurgo de 90 dias da `importacao_planilha` final e para o expurgo de 24 h do envio do `link_da_conta`. As duas tabelas são pequenas, então a prioridade é baixa.

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/packages/core/src/ciclo-de-vida/ciclo-de-vida.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/apps/api/src/estrutura/vinculo/vinculo.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/apps/api/src/sala/decisao/decisao.service.ts

## privacy-guardian · 7ª rodada · APROVADO · 2026-11-03 13:15:50 · `tasks/prd-onboarding-por-convite/revisao-spec.md`

VEREDITO: APROVADO

Campos pessoais tocados: nome e matrícula do aluno (`importacao_planilha.linhas`, `lista_nome`, `usuario.nome`); nome e e-mail do professor; token e endereço cifrados do envio (`convite`, `link_da_conta`); `credencial_matricula.provisoriaHash`, `provisoriaExpiraEm` e `provisoriaGeradaPor`; `reivindicacao.contaExterna` e o cookie `educa_conta_provada`, os dois só com identificador opaco; `conta.emailVerificadoEm`; `alocacao`; `evento_calendario` (`sem_pessoa`). Nesta rodada não entrou campo novo.

Fora da tabela de dados do docs/lgpd.md: nenhum.

**O bloqueante da rodada 6 foi resolvido.** A linha "Senha provisória do aluno" agora tem a pior hipótese certa. A conta fecha: a provisória vale 24 h (PRD, RF13) e o `retencao.expurgar-escola` roda à 1h. Uma provisória gerada logo depois da 1h vence logo depois da 1h do dia seguinte, escapa daquela rodada e só sai na outra. São cerca de 48 h depois de gerada, ou cerca de 24 h depois do vencimento.
- A linha também diz agora que "quem gerou" sai junto com hash e validade. Isso bate com a §5 da Tech Spec ("as três colunas nulas") e com o cenário de 23 h e 25 h do `cenarios.md` ("anula hash, validade e quem gerou").
- A base das 24 h do envio também ficou certa. As duas linhas de envio contam do `criadoEm` da linha, com pior hipótese de cerca de 48 h. Conferi que o `sistema.expurgar-acesso` também roda uma vez por noite (4h30, `docs/runbook.md`), então as 48 h valem também para o link da conta.
- A §4 diz que "Enviar", "Reenviar" e "Copiar link" fazem o `convite/refazer` (linha nova). Com isso o `criadoEm` é sempre o do envio, e a linha anterior sai revogada, com os cifrados nulos.

**As outras mudanças da rodada não abrem problema de dado pessoal.**
- A ordem global de travas no passo (3) e o `desativar` e o `eliminar` seguindo essa ordem só mudam a sequência das travas. O `eliminar` continua apagando de fato, e nada passa a ser guardado ou exposto.
- A releitura de toda linha em que o passo (2) se baseou só leva à `desatualizada` ou a nova tentativa. As `linhas` com nome e matrícula continuam apagadas em toda troca de estado e no prazo de cerca de 25 h.

Autorização por objeto: ok. Nesta rodada não mudou nada. Continuam valendo o 404 igual na provisória e na grade, o filtro de ano validado no servidor, e o `usuarioIds` da escola B tratado como inexistente.

Logs: limpos. A §7 diz: ids, contagens e código; nunca linha, e-mail, token nem resposta do SMTP.

Auditoria: presente em todas as ações da tabela RF17 do `cenarios.md`. `senha_provisoria.gerada` e `.usada` entram no arquivo do titular do aluno.

Envio externo: só o endereço e o texto do convite e do link da conta, para o provedor de e-mail, nunca dado de aluno. Entra em `suboperador` antes do portão da primeira escola real (§7). Nada vai para IA.

Seed/fixture: sintético. Não muda nesta rodada.

**Pergunta de fechamento:** o código responde. O arquivo do titular traz `.gerada` e `.usada` por alvo, o aluno nunca vai ao provedor de e-mail, e a `contaExterna` pendente vira `conta_externa` na aprovação.

Bloqueantes: nenhum.

Recomendações:
1. `docs/lgpd.md`, linha "Acesso da turma": ainda diz que "a desativação do professor ainda **não** revoga: ela não termina vínculo, `TODO.md`, F2". Esta spec muda isso (§2: `desativar` encerra os vínculos e revoga). Atualizar na tarefa do `desativar`.
2. `cenarios.md`, Senha provisória: falta cenário de que o uso e a desativação também anulam `provisoriaGeradaPor`. Hoje só o vencimento prova as três colunas. "Duas trocas com o mesmo bilhete" prova só o hash.
3. `cenarios.md`, RF11: falta cenário de que o "Reenviar" de um convite com mais de 24 h nasce com `criadoEm` novo, e o expurgo da noite não o derruba.
4. Continua da rodada 6: anular os cifrados do `link_da_conta` no vencimento. O de redefinir vale 1 h, mas o endereço cifrado parado pode ficar até cerca de 48 h. O risco é baixo e está documentado.

Arquivos lidos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/docs/lgpd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/revisao-spec.md

## test-engineer · 7ª rodada · REPROVADO · 2026-11-03 13:16:29 · `tasks/prd-onboarding-por-convite/revisao-spec.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- O passo (3) relê o vínculo e trata o `encerrar` que devolve `false` e cada único violado (`chave`, matrícula, `vinculo_ativo_unico`) como `desatualizada`.
- 4xx até a última tentativa, no convite e no link da conta.
- Metade da `EMAIL_POR_MINUTO` reservada ao link da conta.
- Ordem global de travas, seguida pelo job, pelo `desativar` e pelo `eliminar`.
- Barreira no job duplicado e reconferência de `na_fila` depois do `for update`.
- Professor desativado entre o (2) e o (3).
- [C] com o login e o redefinir de professores.
- Piso do perdedor do "esqueci".
- "Enviar", "Reenviar" e "Copiar link" fazem o `convite/refazer` numa linha nova.

**Cobertos:**
- Bloqueante 1 da rodada 6: resolvido. A §5 "O job" (techspec.md:96-99) relê turma, usuário, vínculo, `lista_nome`, pedido e conta. Os testes estão no cenarios.md: :61 (vínculo do aluno encerrado), :90 (vínculo da grade encerrado, zero linhas no `encerrar`), :92 (vínculo à mão com a mesma tripla, que viola o `vinculo_ativo_unico`), :24 e :28 (`chave`), :60 e :93 (usuário desativado), :46 (pedido), :124 (conta sem e-mail).
- Bloqueante 2: resolvido em cenarios.md:142.
- Bloqueante 3: resolvido em cenarios.md:306. Pela regra de :293, a linha é um cenário [I], e o critério dela se pode verificar.
- Recomendações da rodada 6, todas atendidas:
  - barreira no job duplicado: :103-105;
  - turmas por id num comando: techspec.md:94 e cenarios.md:94-95;
  - professor desativado: :93;
  - [C] com login e redefinir: :17-18;
  - piso do perdedor: techspec.md:136 e cenarios.md:179.
- Ordem global contra o `desativar` e o `eliminar`: :62-63 e :94-95.
- `docs/lgpd.md`: as 24 h do envio contam do `criadoEm`, e o pior caso de cerca de 48 h está escrito na linha do convite, na do link e na da provisória.

**Bloqueantes:**

1. **O "Enviar" e o "Reenviar" que fazem `convite/refazer` (linha nova) não têm cenário que caia sem a regra** (techspec.md:78).
   - **Por que a regra importa:** é ela que sustenta a promessa do `docs/lgpd.md`, na linha "Envio do convite", de contar as 24 h do `criadoEm`.
   - **A mutação que passa:** o "Enviar" reaproveita a linha do convite já aberto e só grava `canal = 'email'` e `envio = 'na_fila'`. Nenhum teste cai:
     - :77-78 só prova o "Copiar link";
     - :137 prova o refazer, não o "Enviar";
     - :154-155 continua com "um convite aberto e um e-mail" por causa da reserva.
   - **E o cenarios.md:137 contradiz a spec:** diz que "o link copiado continua aceito". Com o "Enviar" refazendo, o link copiado antes morre, inclusive no "Enviar" sem seleção, que inclui todo pendente.
   - **Correção exigida:**
     - Um [I]: professor com convite copiado e aberto, criado há 2 dias (relógio falso). "Enviar" cria convite de id novo. O token copiado antigo é recusado no aceite. O `retencao.expurgar-escola` rodando logo depois não grava `falhou` no envio novo, e com mais de 24 h do novo `criadoEm` grava. O mesmo vale para o "Reenviar".
     - Reescrever o :137 para dizer qual link continua aceito, ou seja, o último gerado.

2. **Único violado por matrícula entre o (2) e o (3) sem cenário** (techspec.md:98-99, "único violado (`chave`, matrícula, `vinculo_ativo_unico`)").
   - **Onde estão as outras:** a `chave` tem [P] em cenarios.md:24 e :28, e o `vinculo_ativo_unico` em :92. A matrícula não tem nenhum: :35 é a repetição dentro da mesma planilha, e :49 é outra escola.
   - **A mutação que passa:** tratar só `chave` e `vinculo_ativo_unico` como `desatualizada`. A violação de matrícula vira nova tentativa até `falhou`, e nenhum teste cai.
   - **Correção exigida:** um [P] com barreira entre o (2) e o (3). A planilha traz um aluno novo de matrícula M, e a coordenação lança à mão, na mesma escola, um nome avulso com a matrícula M. Resultado esperado: importação `desatualizada`, nunca `falhou`, zero `lista_nome` da planilha gravadas e a linha avulsa intacta.

**Recomendações:**
- **cenarios.md:103-105, saída da segunda execução:** dizer como se observa que a segunda execução "sai" depois do `for update`, por exemplo pelo resultado do job na métrica da §7c ("job por resultado"). Hoje, sem essa reconferência, a releitura do (3) e o `where estado = 'na_fila'` levam ao mesmo estado final `concluida`. O cenário passaria com a cláusula removida.
- **cenarios.md:94-95 e :62-63, determinismo:** dizer como o [P] fica determinístico. Com a mutação, que trava turma por turma na ordem do vínculo, o deadlock só aparece se o teste parar o `desativar` entre as duas travas. Alternativa: um espião no SQL que confira um único `for no key update` com `order by id` sobre todas as turmas, ao lado do [P] de estado final.
- **cenarios.md:142:** "'falhou' na lista" vale para o convite. O link da conta não aparece em lista nenhuma, então diga o que se confere nele: `envio = 'falhou'` e os cifrados nulos.
- **PRD RF11 contra o techspec.md:78, para o `revisor-geral`:** o PRD diz que o "Enviar" manda "com o token da A1" e que "o link copiável continua". Com o refazer no primeiro "Enviar", o link já compartilhado por WhatsApp morre sem aviso. Vale uma frase na tela ("os links copiados antes deixam de valer") e o registro do comportamento no PRD.
- **cenarios.md:306, "solta a vaga":** a cláusula não tem asserção própria. Cabe no mesmo [I]: o convite adiado não ocupa a vaga, e o link que vem depois sai.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/tasks/prd-onboarding-por-convite/prd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/docs/lgpd.md

## infra-guardian · 7ª rodada · APROVADO · 2026-11-03 13:17:50 · `tasks/prd-onboarding-por-convite/revisao-spec.md`

VEREDITO: APROVADO
Caminho quente tocado: fila | login | migration
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: compatível
Métrica e alerta: ok

Bloqueantes: nenhum.

O bloqueante da rodada 6 está resolvido.
- **A ordem das travas bate com o ciclo de vida.** No §5 "O job", a ordem ficou: importação, ano, usuários em `FOR NO KEY UPDATE`, contas em `FOR SHARE`, turmas num comando só, pedidos. É a mesma sequência que o código já usa no `desativar` e no `eliminar`: `travarUsuario`, depois `travarConta`, depois `travarContraOGerarDoProfessor` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite/packages/core/src/ciclo-de-vida/ciclo-de-vida.service.ts`).
- **As travas de quem disputa as turmas não se cruzam.** A decisão trava o ano em `FOR SHARE` e depois o pedido em `FOR UPDATE`, numa única tabela. Na turma ela só pega o `FOR KEY SHARE` da FK, que o `FOR NO KEY UPDATE` do job deixa passar. A reivindicação pega o ano e depois a `lista_nome`, e o job a apanha pelo `where estado = :lido`. Com o job travando tudo antes de escrever, não fecha ciclo com ninguém.
- **O que foi pedido está na spec.** "Turmas tocadas" está definido. O `fechar('encerrada')` vem antes de apagar a `lista_nome`. O `statement_timeout` de 1,5 s está no passo (3). Os cenários pedidos existem: em RF5, linhas 62 e 64 do `cenarios.md`; em RF7, linha 94; e em "Corridas", linha 271.

A correção não abriu nenhum bloqueante. Ficam cinco pontos para escrever na spec ou nas tarefas.

Recomendações:
1. **§2 e §5, "turmas por id num comando":** escrever "em ordem de id (`order by id`)". Um comando só não fixa a ordem das travas quando dois planos são diferentes, como o `IN (...)` do job e o `exists` do `desativar`. O código atual já ordena por id, e o [P] de T1 e T2 pega o erro, mas o texto deve dizer isso.
2. **§5, "que o `desativar` e o `eliminar` também seguem":** dizer se esses dois travam o ano ou o pulam. A `eliminar` roda sem ano no contexto (comando do operador). E o `desativar`, que agora encerra vínculos, disputa as linhas de vínculo e de acesso com o encerramento do ano (`virarAno`, `virarSala`). Ou ele trava o ano em `FOR SHARE` primeiro, ou a spec registra por que dispensa.
3. **§5, passo (3), desligamento de professor:** a conta é travada em `FOR SHARE` e, dentro do `desativar`, sobe para `FOR UPDATE`. Duas escolas desligando ao mesmo tempo o mesmo professor dão `40P01` entre os dois jobs. A nova tentativa resolve, e nenhuma requisição entra no ciclo, mas vale escrever o caso e cobrir com um [P]. Ou então travar direto em `FOR UPDATE` as contas que o job vai desativar.
4. **§5 e §7c, duração do passo (3):** o `statement_timeout` de 1,5 s vale por comando. Com 3.000 linhas em lotes de 500, a transação pode segurar as turmas por mais tempo contra o gerar acesso das 7h30. Hoje só o [C] e o alerta de mais de 1 s cobrem isso. Sugiro um teto da transação inteira, com `transaction_timeout` (Postgres 17) ou corte por tempo decorrido, que vire nova tentativa.
5. **§5, "turma de todo marcado" na planilha de professores:** dizer que, para o professor desligado, entram todas as turmas dos vínculos dele, em qualquer estado. É o mesmo conjunto que o `travarContraOGerarDoProfessor` trava. Assim o `desativar` chamado dentro do job não trava uma turma nova depois dos pedidos.
