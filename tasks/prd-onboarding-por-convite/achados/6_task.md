# Achados das revisões — `tasks/prd-onboarding-por-convite/6_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-03 21:36:07 · `tasks/prd-onboarding-por-convite/6_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A tarefa 6.0 não grava em `Nota` por nenhum caminho. A planilha de professores, o job `gravar-planilha`, o `convidarProfessorDaPlanilha` e o motor de importação não tocam `Nota`, `Correcao` nem resposta de aluno. Todos com autor humano? Não se aplica, porque não há escrita.

Decisão autônoma sobre aluno: ausente. Nada nesta tarefa decide aprovação, reprovação ou encaminhamento de aluno.

Aprovação registrada: ok. A tarefa não tem saída de IA, porque não chama a porta de IA, o gateway nem nenhum agente. A exceção do tutor (D47) não aparece.

Supervisão do tutor: ok. A tarefa não toca o tutor.

Autonomia declarada e visível: sim. Nenhum agente foi criado nem alterado, então a declaração atual continua valendo.

Bloqueantes: nenhum.

O ponto da regra 70 que esta tarefa toca é o item 8/9, que trata de medir o professor e de decidir sobre ele. Conferi o desligamento de professor:
- **Só o professor marcado é desligado, e a marca vem da coordenação.** Quem pode ser marcado é calculado só pela ausência na planilha e pelo estado do convite (`ativo` ou `aceito`). Não entra uso da ferramenta, indicador nem métrica (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/importacao/tipos/professores.ts:99`).
- **O sistema não desliga ninguém sozinho.** Quem é marcado depende do `pedido.marcas.desligar` que a coordenação envia. Se vier uma marca fora da lista de candidatos, o pedido é recusado com `ENTRADA_INVALIDA` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/importacao/motor.ts:83-85`).
- **A gravação é feita em nome da coordenação que importou a planilha, e a auditoria sai na mesma transação.** Se essa pessoa já não existe, o job não grava (`motor.ts:228`, `motor.ts:260`).
- **Não há ranking, lista de quem adotou ou alerta de "professor que não usa".** Ficar de fora da planilha não desliga ninguém: a pessoa segue ativa até alguém marcá-la.

`docs/regulacao.md` não mudou nesta tarefa.

Recomendações:
- O comentário de `classificar` (`professores.ts:35-36`) poderia dizer em uma linha que quem pode ser marcado não depende de uso nem de indicador (D64). Isso evita que uma tarefa futura acrescente esse critério ali sem que a revisão perceba.

## tenancy-guardian · 1ª rodada · REPROVADO · 2026-11-03 21:37:54 · `tasks/prd-onboarding-por-convite/6_task.md`

VEREDITO: REPROVADO

Tabelas verificadas: `importacao_planilha` (tem `escolaId`; `anoLetivoId` pode ser nulo só no tipo `professores`, pelo check `importacao_planilha_ano_ou_professores`, que já existia). Também `usuario`, `convite`, `vinculo`, `turma`, `ano_letivo` e `conta` (global, sem `escolaId`). A tarefa não traz migration nem tabela nova. Os ids continuam UUID.

Queries verificadas: `ImportacaoRepository.professoresDaEscola`, `travarUsuarios`, `travarContas` e `criar` (agora com `requestIdentity()`). `CicloDeVidaRepository.travarContraOGerarDosProfessores` e `travarAnosDosVinculos`. `ConviteDaEscolaRepository.usuarioConvidado`, `criarConvite` e `travarEscola`. `convidarProfessorDaPlanilha`. `MotorDePlanilha.preparar` e `gravar`: as marcas precisam estar entre os candidatos, e `anoLetivoId` no corpo do tipo sem ano responde `NAO_ENCONTRADO`. Passos (1) a (3) do `executarPlanilha`. Os schemas do corpo são strict e não aceitam `escolaId`. A cerca do `contaDoProfessor` foi alterada em `camadas.cjs` e em `architecture.test.ts` e cobre só o arquivo, não a pasta.

Teste de isolamento: presente e efetivo. Conferi tirando as cláusulas mentalmente. Sem `eq(usuario.escolaId, …)` em `professoresDaEscola`, dois casos quebram. Em "RF6, isolamento: a prévia não distingue…", o e-mail do professor pendente da B passaria a sair `ja_existe`. Em "RF16, isolamento: a marca de um professor da escola B…", a ativa da B apareceria entre os candidatos de A. O caso do worker "o `resumo` e a `planilha.gravada` de e-mail com conta em outra escola cliente…" compara o resumo e a auditoria das duas escolas. Uma rota de coordenação chamada pelo professor responde 404, igual a recurso inexistente.

Bloqueantes:
- `packages/core/src/importacao/importacao.repository.ts:285-296` (`travarContas`). Faz `select … from conta where id in (…) for share` na tabela global `conta`, sem escopo de escola e sem `@Unscoped`. O `requireEscolaId()` da linha 286 é chamado e descartado: não entra no `where`. Ele só existe para passar pela guarda `escopo-dos-repositories.ts`, que declara essa brecha como limite conhecido. O método também abre um caminho novo até a conta global, fora das zonas cercadas (`sessao/`, `ciclo-de-vida/` e `cadastro-de-professor.ts`). Isso contraria a Tech Spec §1 ("No worker, a conta global só se alcança pela exceção da seção 6 e pelo ciclo de vida") e o docblock do `ContaGlobalRepository` ("qualquer outra aqui é mudança de spec, discutida antes"). Viola a regra 10, item 9.
  **Correção exigida:** tirar o acesso a `conta` do `ImportacaoRepository`. Há dois caminhos aceitos:
  - (a) Pôr o `FOR SHARE` com a conferência do e-mail num método do `ContaGlobalRepository`, com `@Unscoped('<motivo de pelo menos 30 caracteres>')`. O motor recebe a função por injeção, como já recebe o `acharConta` (por exemplo, `opcoes.travarContas`), e o worker a passa a partir do arquivo cercado.
  - (b) Se a escolha for manter a consulta onde está, marcá-la com `@Unscoped` e justificativa, tirar o `requireEscolaId()` descartado e registrar a exceção nova na Tech Spec §6 e em `docs/modelo-de-dados.md`, com cerca nas duas guardas.

  Nos dois casos, `importacao/` deixa de importar `db/schema/conta.js` para leitura sem escopo. O único acesso que continua permitido é o `leftJoin` por `usuario.conta_id` filtrado pela escola, em `professoresDaEscola`.

Recomendações:
- `tasks/prd-onboarding-por-convite/6_task.md`, em "Sem bloco (motivo)", item (4). O texto diz que os ids do `travarUsuarios` vêm só do `professoresDaEscola`, mas eles vêm também de `marcas.desligar`, lidas da linha guardada. Corrigir o motivo, ou cobrir o `usuario.escolaId` do `travarUsuarios` com um caso no worker: uma importação de A com uma marca de professor da B gravada direto no banco termina `desatualizada`, e o professor da B continua ativo e sem trava.
- Pelo mesmo caminho (marca da B injetada na linha da importação), um caso no worker provaria que o `desativar` dentro do passo (3) não alcança outra escola. Hoje só a API prova isso, recusando a marca antes de gravar.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-03 21:38:33 · `tasks/prd-onboarding-por-convite/6_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nome e e-mail do **professor**, que é adulto. Eles aparecem em quatro lugares:
- `importacao_planilha.linhas` (o que o motor guarda da planilha);
- `conta.email`, achado ou criado no passo (1) pelo `contaDoProfessor`;
- `usuario.nome`;
- `rotulo` do candidato a desligar, que é o nome, mostrado só à coordenação da própria escola.

Nenhum dado de aluno foi tocado e nenhum campo novo foi criado.

Fora da tabela de dados do docs/lgpd.md: nada. Tudo já está coberto:
- Linha "Nome, e-mail | professor": vigência + 5 anos.
- Linha "E-mail de login na conta global": a conta criada no (1) para um job que termina `desatualizada` fica sem usuário. A rotina `sistema.expurgar-acesso` limpa essa conta à noite; o critério `SEM_USO` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/retencao/expurgo-de-acesso.repository.ts:148` alcança conta com zero usuários.
- Linha "Planilha em gravação", que já cita nome e e-mail do professor e a retenção até o fim do job (cerca de 25 h no pior caso).

Autorização por objeto: ok.
- A marca de desligar precisa estar entre os candidatos, e os candidatos vêm só do `usuario` da escola do contexto (`motor.ts`, `gravar`). Marca de professor da escola B e id inexistente recebem a mesma resposta, `ENTRADA_INVALIDA` (caso "RF16, isolamento").
- O professor que tenta subir a planilha recebe `NAO_ENCONTRADO` e nada é gravado.
- No passo (3), o `desativar` roda no escopo da escola e trata o `NAO_ENCONTRADO` como `desatualizada`.
- Não distinguir quem já tem conta em outra escola (E11) está garantido em três pontos, cada um com teste: a prévia não tem campo de e-mail nem de conta, o `resumo` e a auditoria `planilha.gravada` saem iguais para e-mail novo e e-mail com conta na escola B, e o `convite.criado` tem as mesmas chaves nos dois casos.

Logs: limpos.
- O processor registra só `importacaoId`, `estado`, `tentativa`, `codigo` e o `summarizeError`, que descarta a mensagem e o `detail` do Postgres.
- Os dois erros novos em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/importacao/erros.ts` têm mensagem fixa, sem dado da linha.
- Nenhum `logger` foi acrescentado no código novo do core.

Auditoria: presente, com a coordenação que gravou como autora (`comAutora`).
- Cadastro: `professor.cadastrado` e `convite.criado`, só com ids, tipo e expiração. O teste confere que o registro não traz nome nem e-mail.
- Desligamento, que é alteração de permissão: `usuario.desativado`, `vinculo.encerrado`, `acesso_turma.revogado` e `convite.revogado`, todos pelo `desativar`.
- A gravação: `planilha.gravada` com as contagens.

Envio externo: nenhum. A tarefa não chama IA e não envia nada para fora.

Seed/fixture: sintético. Os e-mails dos testes usam o domínio `@professores.invalid` com prefixo aleatório, e os nomes são inventados.

Outros pontos conferidos:
- **Saída da API:** a prévia passa por `previaDaPlanilhaResponseSchema.parse`, e o `guardado`, que tem os e-mails, nunca sai na resposta.
- **Convite:** o token é sorteado e descartado, com 7 dias de validade e uso único pelo índice `convite_pendente_unico`. O link só nasce pelo `convite/refazer`, e há teste mostrando que a lista não traz e-mail nem link.
- **Dado da planilha:** `linhas` e `marcas` ficam nulos em `concluida` e `desatualizada`, com teste nas linhas 175, 366, 387 e 560 do teste do worker.
- **Cerca do `contaDoProfessor`:** a exceção que libera chamar o `contaDoProfessor` (regra 10, item 9) foi aberta para o **arquivo** do processor, e não para a pasta, nas duas guardas, com fixtures de controle e de vizinho.
- **Testes rodados:** guardas, `architecture.test.ts`, `contracts.test.ts` e unidade de `importacao/`, com 612 de 612 passando.

Pergunta de fechamento: sim. O professor cadastrado pela planilha fica nas mesmas tabelas do cadastro avulso (`usuario`, `conta`, `convite`, `vinculo`, `auditoria`), que o arquivo do titular já cobre. O dado da planilha guardado durante o job é temporário e tem prazo na tabela. A tarefa não envia nada para fora.

Bloqueantes: nenhum.

Recomendações:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/importacao/tipos/professores.ts:124`: o `desativar` chamado pelo job passa `{}` como autoria. Na auditoria, `usuario.desativado` fica igual ao desligamento manual, e só o `requisicaoId` em comum com `planilha.gravada` mostra que veio da planilha. Vale considerar uma marca de origem quando a `AutoriaDoCicloDeVida` aceitar uma, para a resposta "por que este professor saiu" não depender de cruzar ids.
2. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/docs/lgpd.md`, linha "E-mail de login na conta global": vale escrever que uma conta pode nascer sem usuário quando o job da planilha termina `desatualizada`, e que o expurgo noturno a limpa. Hoje isso só aparece no comentário do `expurgo-de-acesso.repository.ts`.

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-03 21:38:34 · `tasks/prd-onboarding-por-convite/6_task.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: divergência em §6 (Isolamento): a tarefa abriu um acesso novo e sem escopo à `conta` global e não o declarou em lugar nenhum.
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)

**Bloqueantes:**

1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/importacao/importacao.repository.ts:285-296` (`travarContas`).
   - **O que está errado.** O método lê e trava em `FOR SHARE` linhas da tabela global `conta`, só pelo id e sem passar pelo `usuario` da escola. A conta nova do passo (1) nem tem usuário na escola. Não há `@Unscoped` nem justificativa.
   - **Como passa na guarda.** A linha 286 chama `requireEscolaId()` e joga fora o resultado. A própria guarda documenta esse limite (`tools/guardas/escopo-dos-repositories.ts:21`: "`requireEscolaId()` chamada e jogada fora passa").
   - **Onde a regra diz o contrário.** O `techspec.md` §6 lista uma única exceção para alcançar a conta sem escopo, cercada por arquivo, que é `contaParaConvite` na `ContaGlobalRepository`. O `docs/modelo-de-dados.md` (linhas 107-110) diz que "qualquer outra ali é mudança de spec, discutida antes, e não acréscimo de tarefa", e registra cada leitura nova da `conta`. O `travarContas` cria um segundo ponto do `core` que importa o schema `conta` fora da `ContaGlobalRepository`. Isso não aparece na tabela de divergências da tarefa, nem no §6, nem no `modelo-de-dados.md`. A regra 10, item 9, e a divergência em silêncio pesam juntas aqui.
   - **Correção exigida.** Parar e reportar ao Arquiteto, para que a trava das contas no passo (3) ganhe lugar na spec. Depois:
     - levar a trava para a `ContaGlobalRepository` com `@Unscoped('<motivo>')`, ou para uma função injetada pelo processor, como já se faz com o `acharConta`;
     - incluir quem a chama na zona das duas cercas (`architecture.test.ts` e `cerca-conta-global` do `camadas.cjs`), com fixture do vizinho reprovado;
     - registrar a exceção no `techspec.md` §6 e no `docs/modelo-de-dados.md`, e a divergência no `6_task.md`;
     - tirar o `requireEscolaId()` descartado da linha 286.
   - **Junto com isso.** O `professoresDaEscola` (linha 250) também passou a ler `conta.email`. Ele junta pelo `usuario.conta_id` da escola, o mesmo desenho do `LeituraDoTitular`, e o próprio `modelo-de-dados.md` registra aquele caso. Este precisa entrar no documento da mesma forma.

**Recomendações:**

1. **O convite do professor agora tem dois corpos.** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/convite/convidar-professor-da-planilha.ts:26-42` repete o que `apps/api/src/sessao/convite/convite-de-professor.service.ts:47-57` (o `cadastrarProfessor`) e `convite.service.ts:201-213` (o `convidarConta`) já fazem: `usuarioConvidado`, depois `criarConvite`, a validade de 7 dias (`expiraEmDo` já existe na API) e o par de auditorias `professor.cadastrado` + `convite.criado`. Só os repositórios foram movidos; o corpo do caso de uso ficou copiado, e a autoconferência (item 9) diz "sem cópia". A spec diz "o `convidar` da A1" e "sobe para o core". A sugestão é deixar um corpo só no `core`, recebendo o hash do token e a validade e devolvendo ids ou `false`. O `cadastrarProfessor` passaria a chamá-lo e traduziria `false` em `CONFLITO`. Assim o que a auditoria grava sobre a conta (E11, nada que diga se ela já existia em outra escola) fica num lugar só.
2. **Contagem e linhas não batem.** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/importacao/tipos/professores.ts:103,166`: a linha de e-mail repetido sai `ja_existe`, mas `contagens.ja_existem` não a conta (`professores.test.ts:69` espera `ja_existem: 0` ao lado de uma linha `ja_existe`). A 15.0 vai mostrar uma contagem que não bate com as linhas. Vale contar a repetida, ou dar a ela um resultado próprio.
3. **`anoLetivoId` no corpo da planilha de professores.** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/importacao/motor.ts:105` responde `NAO_ENCONTRADO`. É uma escolha razoável, mas não está escrita no `techspec.md` §4. Vale uma frase lá, antes que a 15.0 mande o ano planejado selecionado na tela.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-03 21:38:37 · `tasks/prd-onboarding-por-convite/6_task.md`

VEREDITO: APROVADO

Caminho quente tocado: fila

Rate limit: ok. A rota `importacoes/:tipo` continua atrás do limite global por usuário e por escola (`porUsuarioMin` e `porEscolaMin` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/api/src/rate-limit.module.ts`). O texto tem teto de 512 KB e a planilha tem teto de 300 linhas.

Fila e prioridade: ok. O tipo novo usa o job `estrutura.gravar-planilha` da 4.0, na fila `normal`, com o limite por escola do despachante. O passo (1) faz até 300 transações curtas fora do passo (3), na ordem do e-mail.

Concorrência: protegida.
- O plano é refeito sob trava no passo (3), com a assinatura conferida de novo.
- O `convidar` usa `on conflict` e o índice `convite_pendente_unico`.
- A conta fica em `FOR SHARE` com o e-mail conferido.
- A trava do convite da escola tem `lock_timeout` de 1 s.
- `40P01` e `55P03` viram nova tentativa.
- Há casos [P] para duas escolas com o mesmo professor, ordens opostas, desligamento duplo, expurgo entre o (1) e o (3) e trava do convite na mão de outra operação.
- `apps/worker/test/gravar-planilha-professores.int.test.ts` roda verde: 25 de 25.

Índice e paginação: ok. `professoresDaEscola` faz duas consultas, que não crescem com o número de linhas da planilha. Elas usam `usuario_escola_id_unico` e `convite_escola_usuario_idx`, os dois começando por `escola_id`. O resultado é limitado ao número de professores da escola.

Degradação de IA: não se aplica.

Migration: não se aplica.

Métrica e alerta: ok para esta tarefa. O histograma do passo (3) e o contador por resultado vêm da 4.0 e cobrem o tipo novo. Os três alertas com runbook ficaram com a 5.0, e o cenário de carga `importacao-7h30.js`, que inclui o job de professores contra o login, ficou com a 16.0.

Bloqueantes: nenhum.

Recomendações:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/importacao/tipos/professores.ts:116-121`: o `aplicar` grava um professor por vez. São 4 comandos por professor (usuário, convite e duas auditorias), cerca de 1.200 idas ao banco na transação do passo (3) com 300 linhas. Durante esse tempo ficam presas a trava do convite da escola (que segura o aceite e o login com bilhete) e as turmas dos desligados. A meta do passo (3) é 1 s, e nenhum teste mede a planilha cheia. Sugestão: gravar em lotes, como a Tech Spec §5 descreve ("lotes de 500"), ou pelo menos acrescentar um caso de 300 linhas que leia `importacao.passo3.duracao` antes de a 16.0 medir sob carga.
2. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/importacao/motor.ts:234`: dentro do `desativar` chamado pelo job, a conta do desligado é travada em `FOR UPDATE` depois das turmas. Isso foge da ordem global (ano, usuário, conta, turma) que o comentário do `CicloDeVidaService` declara. Não achei ciclo possível, porque o aceite pega antes a trava da própria escola e o `40P01` é repetido. Mesmo assim, vale travar as contas dos marcados junto com as do passo (1), ou registrar a exceção no comentário da ordem global.
3. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/importacao/tipos/professores.ts:183`: os anos são travados em `FOR SHARE` um desligado por vez, e por isso a ordem de id entre desligados diferentes não é garantida. Hoje não há conflito, porque são travas compartilhadas, mas um comando só, em ordem de id, igual ao das turmas, deixa o padrão uniforme.
4. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/importacao/motor.ts:188`: quando falta o `acharConta`, o motor lança `InvariantException`. O processor trata isso como erro que pode ser repetido e gasta todas as tentativas antes de marcar `falhou`. Por ser erro de configuração, deveria ser falha definitiva logo na primeira.
5. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/importacao/tipos/professores.ts:184,191`: o `travar` e o `planejar` leem `professoresDaEscola()` cada um, ou seja, duas vezes na mesma transação. A lista lida no `planejar` poderia ser reaproveitada no `travar`.

## test-engineer · 1ª rodada · APROVADO · 2026-11-03 21:39:41 · `tasks/prd-onboarding-por-convite/6_task.md`

VEREDITO: APROVADO

Cenários exigidos:
- **Caminho feliz:** o job cadastra cada professor como `pendente`, com convite de 7 dias sem token, auditoria sem nome nem e-mail e o `resumo` certo. O cadastrado aparece na lista, e o "Copiar link" passa pelo `convite/refazer`.
- **Bordas:**
  - o mesmo e-mail duas vezes, em qualquer caixa;
  - 301 linhas contra 300;
  - e-mail inválido, nome vazio, linha incompleta, nome longo, caractere de controle;
  - conta com e-mail em maiúsculas;
  - o último convite decide o estado;
  - ausente sem marca;
  - ausente marcado, com vínculo confirmado, pendente e encerrado;
  - ausente `pendente` marcado;
  - ausente `aceito` que não entrou;
  - convite revogado chamado de volta;
  - professor ativo e convite em aberto contam como "já existe";
  - escola sem ano em curso;
  - linhas ou marcas guardadas sem a forma do tipo, e motor sem o achar-ou-criar conta.
- **Permissão:** o professor não sobe a planilha nem a prévia.
- **Isolamento:**
  - a prévia não distingue o e-mail com conta na B;
  - o `resumo`, a `planilha.gravada` e o `convite.criado` também não distinguem;
  - a marca de um professor da B é recusada;
  - a prévia de A não traz candidato da B.
- **Concorrência:**
  - duas escolas importam o mesmo professor;
  - duas escolas importam os mesmos professores em ordens opostas;
  - duas escolas desligam o mesmo professor;
  - candidato desativado entre o passo (2) e o (3);
  - expurgo da conta entre o (1) e o (3);
  - a limpeza espera o `FOR SHARE`;
  - a trava do convite da escola na mão de outra operação.

Cobertos:
- As 25 linhas da tabela "Testes que provam a regra" têm cada uma o seu caso, citado pelo nome, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/worker/test/gravar-planilha-professores.int.test.ts`, no `describe` novo de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/api/test/professores.int.test.ts` e em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/importacao/tipos/professores.test.ts`. As linhas juntadas por ponto e vírgula têm um caso para cada item.
- As asserções leem o resultado no banco: `usuario`, `convite`, `conta`, `vinculo`, `auditoria` e `importacao_planilha`.
- O espião de SQL confere a ordem das travas: importação, trava do convite da escola, ano, usuários, contas, turmas, depois vínculos. Confere também que a trava de turma leva os ids dos dois desligados num comando só, e o `order by` de cada trava.
- Os casos marcados [P] usam `Promise.all` de verdade, ou ordem forçada com trava segura pelo teste.
- O `--faltando` dá as mesmas 17 linhas que o documento declara, e cada uma tem o seu motivo escrito.
- Não há `.skip`, `.only`, teste comentado nem chamada a provedor de IA. O teste de unidade passa: 16 casos.

Bloqueantes: nenhum

Recomendações:
1. **Asserção de erro genérica:** `gravar-planilha-professores.int.test.ts:626` (trava do convite) e `:486` (expurgo) usam `rejects.toThrow()`, que aceita qualquer erro. O primeiro deveria conferir a falha de trava (`ehFalhaDeTrava` ou `55P03`); o segundo, `ContaDaPlanilhaPerdidaError`. Do jeito que está, um erro sem relação também passa na primeira metade do caso.
2. **Autoconferência imprecisa (item 1):**
   - Ela diz que a zona do `architecture.test.ts` tem bloco, mas a seção "Mutações" não traz nenhum.
   - Ela diz que os dois termos de cada condição composta têm bloco. Não é verdade para `convidar-professor-da-planilha.ts:36`: sem o `erro.codigo === CONFLITO`, todo erro de domínio vira `false`, e nenhum caso pega.
   - O mesmo vale para o `doPostgres.constraint === 'convite_pendente_unico'` de `convite-da-escola.repository.ts`, que só tem o bloco que tira a linha inteira.
   - Na prática é quase uma mutação equivalente, mas o texto precisa dizer isso, ou ganhar o bloco.
3. **Texto do cenário sem asserção:** a linha "nenhuma requisição no ciclo" da corrida "duas escolas desligam" (`cenarios.md:105-106`) não vira asserção nenhuma, e nem pode virar, porque os dois lados são jobs. Reescrever o cenário, ou conferir quantas tentativas cada job levou e que nenhuma importação saiu `falhou`.
4. **Bordas sem caso:**
   - dois professores com o mesmo nome e e-mails diferentes;
   - professor `desativado` chamado de volta pela planilha. Só o `revogado` tem integração. O desativado cuja conta já foi limpa (e-mail nulo) vira um usuário novo, e esse efeito não está escrito em teste.
5. **Job duas vezes ao mesmo tempo (D49) no tipo professores:** não há caso próprio. Hoje a cobertura é indireta: a corrida genérica da 4.0, com calendário, mais a das duas escolas no passo (1). Um caso com uma `concluida`, uma `ignorada` e um único convite fecharia isso.
6. **Ano em curso só pelo motor:** todo caso do `describe` da API roda em escola sem ano, porque o `bancada.escola()` não cria ano. A planilha de professores numa escola com ano em curso só passa pelo motor, em `W`, e não pela rota HTTP. Vale um caso de API com ano.
7. **Mock do próprio código:** o teste de unidade faz mock de `convidarProfessorDaPlanilha`, que é código nosso. Aceitável, porque `W` prova a função real, mas fica registrado.
8. **Janela de 1 s do `lock_timeout`:** os casos de `W` em `:352-364`, `:472-484` e `:504-517` dependem de o teste soltar a trava em menos de 1 s depois de o job parar. É o mesmo molde da 4.0, com folga de cerca de dez vezes. Vigiar na esteira.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-03 22:07:26 · `tasks/prd-onboarding-por-convite/6_task.md`

VEREDITO: APROVADO
Caminho quente tocado: fila
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/importacao/motor.ts:194`: o motor sem `travarContas` agora lança `InvariantException`, e a fila repete esse erro até esgotar as tentativas. É o mesmo comportamento que já foi registrado para o `acharConta` (`TODO.md`, infra-guardian, 1ª rodada). Quando o processor da 4.0 passar a tratar esse erro, os dois casos devem sair juntos para terminal, sem nova tentativa.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/ciclo-de-vida/conta-global.repository.ts:22`: o comentário da classe ainda diz que "qualquer outra aqui é mudança de spec", e a classe já tem a quinta exceção (`travarEConferir`). Ele deveria citar a 6.0 como a mudança de spec que pôs essa exceção ali, como o `docs/modelo-de-dados.md` já faz.

O que mudou nesta rodada, olhando para a manhã de segunda: o `FOR SHARE` das contas saiu do `ImportacaoRepository` e foi para o `ContaGlobalRepository.travarEConferir`, que o processor passa ao motor por `opcoes.travarContas`. A trava continua na mesma transação do passo (3), porque `(daVez) => travarContas(tx, daVez)` recebe o `tx` do passo e corre sob o `lock_timeout` do `limitesDoPasso3`. A posição na ordem global também não mudou (escola, anos, usuários, contas, turmas), e a consulta continua sendo uma só, em ordem de id. Por isso não aparece trava nova nem ciclo novo entre jobs de escolas diferentes.

O caso novo de isolamento mostra que o job da escola A não espera a linha travada de um professor da B e termina `desatualizada`. As outras asserções novas também conferem o tipo do erro, e não só que houve erro: `ContaDaPlanilhaPerdidaError`, `ehFalhaDeTrava` e `erro` nulo nas duas escolas que concluíram. Nenhum teste chama provedor pago.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-03 22:07:31 · `tasks/prd-onboarding-por-convite/6_task.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. A trava das contas do passo (3) agora tem lugar na spec. O `techspec.md` §6 passou de uma exceção para "duas exceções, no mesmo arquivo, cercadas por arquivo", com a justificativa do `@Unscoped` escrita. O `docs/modelo-de-dados.md` registra a quinta exceção e a leitura do `professoresDaEscola` como o mesmo desenho do `LeituraDoTitular`. O `6_task.md` traz a divergência na tabela.

Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)

Bloqueantes: nenhum. A correção exigida na 1ª rodada foi feita item por item:
- **Trava fora do `importacao/`.** O `travarContas` saiu do `ImportacaoRepository`, junto com o `requireEscolaId()` descartado. Ele agora é `ContaGlobalRepository.travarEConferir`, com `@Unscoped` e justificativa (`packages/core/src/ciclo-de-vida/conta-global.repository.ts:94`).
- **Mesmo caminho do `acharConta`.** A trava sai pelo arquivo cercado como `travarContasDoProfessor` (`packages/core/src/estrutura/cadastro-de-professor.ts:24`). O processor injeta a função no motor (`opcoes.travarContas`), e o motor falha se ela não vier (`motor.ts`, passo (1) e `planejarSobTrava`).
- **Cercas.** As duas cercas pegam o caminho do arquivo `cadastro-de-professor`, não o nome da função. A função nova fica coberta sem regra própria, e o processor continua sendo o único chamador no worker. O `architecture.test.ts:180` confere que o subcaminho entrega só as duas funções. O `ciclo-de-vida.repository.test.ts` confere os cinco métodos da `ContaGlobalRepository` e a justificativa de cada um.
- **Nenhum outro import do schema `conta`.** No `ImportacaoRepository`, o único uso do schema que sobra é o `leftJoin` de `usuario.conta_id` filtrado pela escola e pelo papel, em `professoresDaEscola` (`importacao.repository.ts:250`). Esse uso está documentado no `modelo-de-dados.md`.
- **Mutações.** Os blocos da trava apontam para o arquivo novo. Entraram os blocos do `|| travar === undefined` e do escopo do `travarUsuarios`, este com caso de isolamento novo (a marca de B gravada na importação de A).

Recomendações:
- O comentário de cabeçalho em `packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.test.ts:8-11` ainda diz "a conta global continua com as mesmas três exceções". Logo abaixo, o teste afirma cinco métodos. Atualizar o texto.
- No `docs/modelo-de-dados.md:111`, a frase sobre "as quatro primeiras" e "a quinta" ficou longa e emendada ("está no mesmo arquivo cercado; já estão no ponto..."). Vale partir em duas frases.
- Em `motor.ts`, `planejarSobTrava`, a guarda de `travarContas === undefined` repete a do passo (1). O documento já a declara como guarda de tipo. Passar a função já estreitada do passo (1) ao (3) evitaria a segunda checagem.

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/ciclo-de-vida/conta-global.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/estrutura/cadastro-de-professor.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/importacao/importacao.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/importacao/motor.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/api/test/architecture.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/docs/modelo-de-dados.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/tasks/prd-onboarding-por-convite/techspec.md

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-03 22:07:37 · `tasks/prd-onboarding-por-convite/6_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A rodada 2 não toca em `Nota`, `Correcao` nem `lancadaPor`. O diff só mexe na conta global, na trava do passo (3) e nas cercas, e nada passa por IA. Todos com autor humano? sim, porque não há nenhum caminho.

Decisão autônoma sobre aluno: ausente. A tarefa trata da planilha de professores. O desligamento continua sendo uma marca que a coordenação faz à mão; o job só a aplica, com a coordenação que gravou como autora (`passo3` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/importacao/motor.ts`). O job não decide nada sozinho.

Aprovação registrada: ok. Nenhuma saída de IA entra nesta tarefa.

Supervisão do tutor: ok. O tutor não é tocado.

Autonomia declarada e visível: sim. Nada mudou nesta tarefa: nenhum agente foi criado ou alterado.

Itens 7 e 9 da regra 70 (supervisão e medir o professor): a única linha nova com efeito nessas regras é o comentário em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/importacao/tipos/professores.ts:36-37`. Ele diz que quem pode ser marcado para desligar não depende de uso nem de indicador (D64). Conferi no código, na linha 100: entra quem é professor da escola, não está na planilha e está `ativo` ou `aceito`. Nenhum critério de uso, de adoção ou de indicador do professor entra nessa escolha, e nada da conversa do professor com o chat chega à coordenação.

Correções exigidas na rodada 1: nenhuma. Não havia o que conferir.

Bloqueantes: nenhum.

Recomendações:
- Para fixar a garantia da D64, um teste unitário pode afirmar que a lista de quem pode ser desligado sai só de `ESTADOS_QUE_SAEM` e da ausência na planilha. Hoje a garantia está só no comentário de `professores.ts:36-37`, e o código não lê nenhuma métrica. Não bloqueia.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-03 22:07:40 · `tasks/prd-onboarding-por-convite/6_task.md`

VEREDITO: APROVADO

**Tabelas verificadas:** a tarefa não cria tabela nova nem migration. Revi o acesso a `conta`, que é global, e a `usuario`, `convite` e `importacao_planilha`, que têm `escolaId`.

**Queries verificadas:**
- **`ContaGlobalRepository.travarEConferir`** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/ciclo-de-vida/conta-global.repository.ts:91-102`). Tem `@Unscoped` com justificativa escrita. Lê só os ids que o passo (1) do próprio job devolveu, nunca um valor do cliente, e devolve apenas um booleano.
- **`travarContasDoProfessor`** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/estrutura/cadastro-de-professor.ts:24-26`). Sai pelo arquivo cercado e chega ao motor por injeção (`opcoes.travarContas`). O motor e `importacao/` não importam `ContaGlobalRepository` nem `cadastro-de-professor`.
- **`ImportacaoRepository`** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/importacao/importacao.repository.ts`). O `travarContas` sem escopo saiu. O único uso que sobra de `conta` é o `leftJoin` por `usuario.conta_id`, filtrado por `usuario.escolaId` e papel `professor`, em `professoresDaEscola` (linhas 245-251). `travarUsuarios` (linha 274) continua com escopo de escola.
- **Os dois registros pedidos estão feitos.** A Tech Spec §6 registra a segunda exceção, e `docs/modelo-de-dados.md` registra a quinta exceção e a leitura de `professoresDaEscola`.

**Correção exigida na 1ª rodada:** foi feita pelo caminho (a).

**Guardas:** rodei quatro e todas passaram, com 152 testes verdes:
- `ciclo-de-vida.repository.test.ts`: cinco métodos, cada um com justificativa.
- `repositories-com-escopo.test.ts`
- `camadas.test.ts`
- `architecture.test.ts`: o subcaminho do cadastro expõe só `contaDoProfessor` e `travarContasDoProfessor`, e o barril `estrutura` não expõe nenhum dos dois.

**Teste de isolamento:** presente e efetivo. Não consegui rodar `gravar-planilha-professores.int.test.ts` neste ambiente, porque o `@educa/core` não resolve sem build. Verifiquei de cabeça:
- **Teste novo** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/worker/test/gravar-planilha-professores.int.test.ts:122-147`). Grava à mão na importação da escola A a marca de um professor da B, com a linha dele presa em `FOR UPDATE`. Se `eq(usuario.escolaId, …)` sair de `travarUsuarios`, o professor da B entra nos ids, porque `usuariosDoPassoTres` inclui `marcas.desligar`. O passo (3) então estoura o `lock_timeout` e não termina `desatualizada`, e o teste quebra. As asserções também provam que o professor da B continua ativo e que o vínculo dele continua `confirmado`.
- **Mutações de `travarEConferir`.** As três (o filtro por id, a conferência do e-mail e a caixa) apontam para o arquivo novo e têm caso.

**Bloqueantes:** nenhum.

**Recomendações:**
- `ContaGlobalRepository` está agora com cinco exceções `@Unscoped`. A regra 10, item 9 chama isso de sinal de desenho errado já a partir da terceira, e o próprio docblock admite. Vale registrar no `TODO.md`, ou para a retro, a revisão do desenho da conta global (por exemplo, um repository de conta por finalidade) antes que entre uma sexta.
- O docblock da classe (`conta-global.repository.ts:12-24`) ainda lista como importadores só `sessao`, `ciclo-de-vida` e `cadastro-de-professor.ts`. Vale acrescentar que o processor da planilha alcança a classe indiretamente, por `travarContasDoProfessor`, para quem audita pela classe.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-03 22:08:28 · `tasks/prd-onboarding-por-convite/6_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: o e-mail de login em `conta` (professor) e o nome em `usuario` (professor). Nesta rodada nenhum campo é novo. O que mudou foi o lugar da leitura: a trava `FOR SHARE` saiu do `ImportacaoRepository` e foi para `ContaGlobalRepository.travarEConferir`. A linha do e-mail em `docs/lgpd.md` ganhou o prazo de retenção da conta que fica sem usuário.

Fora da tabela de dados do docs/lgpd.md: nada. O texto novo sobre a conta sem usuário confere com o código: o critério do expurgo noturno (`packages/core/src/retencao/expurgo-de-acesso.repository.ts`) é "não existe usuário ativo nem convite válido", e uma conta sem nenhum usuário entra nele.

Autorização por objeto: ok.
- O `travarEConferir` (`packages/core/src/ciclo-de-vida/conta-global.repository.ts:94`) só lê as contas pelos ids que o passo (1) do próprio job devolveu. Esses ids não vêm do cliente nem do payload, e a função devolve só `true` ou `false`.
- Ele sai pelo arquivo cercado `cadastro-de-professor.ts` (`travarContasDoProfessor`). A guarda está em `apps/api/test/architecture.test.ts`, que agora exige exatamente as duas funções no subcaminho.
- O teste novo de isolamento (`apps/worker/test/gravar-planilha-professores.int.test.ts:645`) troca o id mentalmente e prova: a marca de um professor da escola B gravada à mão na importação de A termina `desatualizada`, B continua ativo, o vínculo segue `confirmado`, e o job não espera a trava da linha de B.

Logs: limpos. O processor continua logando só `importacaoId`, estado, tentativa e o resumo do erro (tipo e pilha filtrada). O `ContaDaPlanilhaPerdidaError` e o `DiferencaNaPlanilhaError` (`packages/core/src/importacao/erros.ts`) levam só uma mensagem fixa, sem nome nem e-mail.

Auditoria: presente. Nada mudou nesta rodada: o `desativar` e o `convidar` continuam auditando com a coordenação que gravou como autora.

Envio externo: nenhum. A tarefa não chama IA nem serviço de terceiro.

Seed/fixture: sintético. Os nomes são genéricos ("Maria da Silva", "Professor Da B", "Nome Antigo") e os e-mails usam `@escola.invalid`.

Pergunta de fechamento: a tarefa não grava dado de aluno. O que ela grava do professor (`usuario`, `conta`, `convite`) já é alcançado pelo arquivo do titular, pela leitura já existente do e-mail da `conta`.

Bloqueantes: nenhum.

Recomendações:
1. A frase nova de `docs/lgpd.md:65` promete que a conta criada pelo passo (1) e deixada sem usuário é limpa na madrugada seguinte, e nenhum teste prova isso. Os casos de `apps/worker/test/expurgo-de-acesso.int.test.ts:732` e `:783` sempre semeiam a conta com um usuário desativado. Uma mutação no `SEM_USO` que exigisse "existe usuário desativado" passaria verde e deixaria e-mail órfão para sempre. Sugiro um caso com uma `conta` sem nenhum `usuario`, limpa pelo `limparLoteDeContasSemUso`.
2. A mesma frase cita só o job que terminou `desatualizada`. O job que termina `falhou` depois do passo (1) também deixa a conta sem usuário. Vale escrever "`desatualizada` ou `falhou`".
3. O `6_task.md` diz que várias recomendações da 1ª rodada vão para o `TODO.md`, entre elas a minha (marca de origem na autoria do `desativar` do job). Mas o `TODO.md` não foi alterado nesta árvore, e a entrada não está lá. Vale registrar antes do commit, ou corrigir o destino na tabela.
4. Para o `tenancy-guardian`: a `ContaGlobalRepository` passa a ter cinco métodos `@Unscoped`. O `docs/modelo-de-dados.md` assume isso, mas é o ponto que a regra 10, item 9 chama de sinal de desenho errado.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/ciclo-de-vida/conta-global.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/estrutura/cadastro-de-professor.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/importacao/motor.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/worker/test/gravar-planilha-professores.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/worker/test/expurgo-de-acesso.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/docs/lgpd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/TODO.md

## test-engineer · 2ª rodada · APROVADO · 2026-11-03 22:09:00 · `tasks/prd-onboarding-por-convite/6_task.md`

VEREDITO: APROVADO

Cenários exigidos:
- **Caminho feliz:** o job cadastra cada professor `pendente`, e ele aparece na lista com o "Copiar link" pelo `convite/refazer`.
- **Bordas:**
  - o mesmo e-mail duas vezes, em qualquer caixa;
  - o e-mail em maiúsculas na conta;
  - 301 linhas;
  - e-mail inválido ou nome vazio;
  - o ausente sem marca;
  - o ausente marcado;
  - o `aceito` que não entrou;
  - o último convite decide o estado;
  - a escola sem ano em curso;
  - dois professores com o mesmo nome (novo nesta rodada);
  - o `desativado` com e-mail e o `desativado` com a conta já limpa (novos).
- **Permissão:** o professor não sobe a planilha.
- **Isolamento:**
  - a prévia, o `resumo` e a `planilha.gravada` não distinguem a conta na escola B;
  - a marca da B recebe `ENTRADA_INVALIDA` pela API;
  - a marca da B gravada à mão não trava nem alcança a B (novo).
- **Concorrência [P]:**
  - duas escolas com o mesmo professor, também em ordens opostas;
  - duas escolas desligando o mesmo professor;
  - o candidato desativado entre o (2) e o (3);
  - o expurgo da conta entre o (1) e o (3);
  - a trava do convite da escola na mão de outra operação.

Cobertos: todos. A tabela "Testes que provam a regra" não mudou, e cada linha continua citando o seu caso. Conferi as mudanças desde a 1ª rodada no diff e no código de agora:

- **A trava das contas foi para o `ContaGlobalRepository.travarEConferir`.** Ela tem `@Unscoped` e justificativa, sai por `travarContasDoProfessor` no arquivo cercado, e o motor a recebe por injeção (`opcoes.travarContas`). Os quatro blocos que apontavam para `importacao.repository.ts` agora apontam para `conta-global.repository.ts`, com o mesmo trecho: `where` pelos ids, `FOR SHARE` com a ordem, conferência do e-mail e `toLowerCase`. O bloco do `travarContas(contas)` em `professores.ts` foi reescrito para a função injetada.
- **Cláusula nova `|| travar === undefined` (`motor.ts`):** tem bloco. O caso `rodar({ acharConta: () => Promise.reject(...) })` espera `'trava das contas'`. Com a mutação, o motor chama o `acharConta`, que rejeita com outra mensagem, e o caso fica vermelho pelo motivo certo.
- **`travarContas === undefined` dentro do `planejarSobTrava`:** está no motivo (5). É a guarda de tipo de um valor que o passo (1) já recusou, e aceito o motivo.
- **`eq(usuario.escolaId, requireEscolaId())` do `travarUsuarios`:** antes ficava no motivo (4), e agora tem bloco. O caso novo de isolamento chega à cláusula. O professor da B entra no `usuariosDoPassoTres` por `marcas.desligar`, e a linha dele está presa em `FOR UPDATE` por outra transação. Sem o filtro, o `FOR NO KEY UPDATE` estoura o `lock_timeout` e o `tentar` rejeita. Com o filtro, a importação termina `desatualizada` (o `desativar` responde `NAO_ENCONTRADO`), e a B segue ativa, com o vínculo `confirmado`.
- **O processor passa o `travarContasDoProfessor`:** todos os casos de `W` passam pelo `criarGravacaoDaPlanilha`. Se o processor deixar de passar a função, o invariante do passo (1) deixa a suíte vermelha.
- **Asserções mais firmes:**
  - `rejects.toBeInstanceOf(ContaDaPlanilhaPerdidaError)` no lugar de `toThrow()`;
  - `rejects.toSatisfy(ehFalhaDeTrava)` na trava do convite;
  - `erro` nulo nas duas importações da corrida de desligamento, como o `cenarios.md` revisto exige.
- **Contagem do documento:** a seção "Mutações" declara 89 blocos e 11 motivos, e a autoconferência diz o mesmo.
- **`ciclo-de-vida.repository.test.ts`:** fixa os cinco métodos e a justificativa de cada um. Se o `@Unscoped` do `travarEConferir` sair, ou a justificativa encolher, o teste fica vermelho.
- **`architecture.test.ts`:** fixa que o subcaminho do cadastro entrega exatamente `contaDoProfessor` e `travarContasDoProfessor`, e que o barril de `estrutura/` não repassa nenhum dos dois.
- **Sem `.skip` nem `.only`.** Não há provedor de IA na tarefa, e nenhum mock esconde a regra.
- **Concorrência:** os casos [P] continuam com `Promise.all` ou com a ordem forçada por trava real, não com chamadas em sequência.

Rodei estes testes, e passaram: `apps/worker/test/gravar-planilha-professores.int.test.ts` (29 casos), `packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.test.ts` e `apps/api/test/architecture.test.ts` (67 casos nos dois).

Bloqueantes: nenhum.

Recomendações:
1. **Comentário sem asserção** (`apps/worker/test/gravar-planilha-professores.int.test.ts`, caso "o motor sem o achar-ou-criar conta do worker"). O comentário diz "e nenhuma conta nasce", mas o caso só confere o `estado`. Hoje o `acharConta` falso rejeita, então a contagem de contas daria zero de qualquer jeito. Ou se acrescenta a contagem, ou se tira a frase do comentário.
2. **Os três casos novos ficaram fora do documento.** São o "mesmo nome", o "`desativado` com e-mail volta pelo mesmo usuário" e o "`desativado` com a conta limpa". Eles provam bordas reais, mas nenhuma linha da tabela nem nenhum bloco de mutação os cita. Vale uma linha na tabela, ou citar o caso do `desativado` como segundo teste do bloco do `ESTADOS_QUE_ENTRAM`, para a validação vê-los.
3. **O nome do caso de isolamento promete mais do que o caso prova.** "O job não espera a trava dele" só vale para a linha do `usuario` da B. O `travarAnosDosVinculos` e o `travarContraOGerarDosProfessores`, chamados com o id da B, têm o escopo da escola desde antes desta rodada, e esse escopo não é provado por esse caso. O `segurador` poderia travar também uma turma da B, para cobrir as duas travas no mesmo cenário.

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/tasks/prd-onboarding-por-convite/6_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/worker/test/gravar-planilha-professores.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/ciclo-de-vida/conta-global.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/importacao/motor.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/importacao/tipos/professores.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/api/test/architecture.test.ts
