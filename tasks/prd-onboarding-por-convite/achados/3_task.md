# Achados das revisões — `tasks/prd-onboarding-por-convite/3_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-03 17:47:22 · `tasks/prd-onboarding-por-convite/3_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nem migration nesta tarefa. A tarefa lê e altera tabelas que já existem, `vinculo`, `convite`, `ano_letivo`, `turma`, `acesso_turma` e `usuario`, e todas têm `escolaId`. As que variam por período (`vinculo`, `turma`, `acesso_turma`) também têm `anoLetivoId`. Nenhum id novo. Nenhum endpoint novo ou alterado.

Queries verificadas (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts`):
- `travarAnosDosVinculos` (linhas 60-84): usa `eq(anoLetivo.escolaId, requireEscolaId())`, e o `exists` junta `vinculo.escola_id = ano_letivo.escola_id`. O escopo vem do contexto e nenhum ano chega por parâmetro.
- `encerrarVinculosDaPessoa` (linhas 94-112): o `select ... for update` e o `update` filtram por `escolaId` do contexto. Ele passa pelos anos de propósito, porque a regra pede o ano em curso e o planejado. O alcance continua sendo só a escola do contexto.
- `revogarConviteAberto` (linhas 122-129): usa `eq(convite.escolaId, requireEscolaId())` e `usuarioId`.
- `travarContraOGerarDoProfessor` e `revogarDeQuemSaiu` já existiam e foram reaproveitados. Os dois continuam com escopo pelo `requireEscolaId()`.
- No service (`ciclo-de-vida.service.ts`), `#naTransacao` exige `requireEscolaId()` e valida o UUID. O usuário de outra escola, o já desativado e o id inexistente recebem a mesma resposta, `NAO_ENCONTRADO`. Nenhum parâmetro de escola chega do cliente, e não há `@Unscoped()`.

Teste de isolamento: presente e efetivo (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/api/test/ciclo-de-vida.int.test.ts`).
- "isolamento no repository": roda `encerrarVinculosDaPessoa` no contexto da escola A contra uma pessoa da escola B e espera `[]`. Sem o `eq(vinculo.escolaId, …)` da leitura, o retorno traria o vínculo de B e o teste quebraria. Roda também `revogarConviteAberto` no mesmo cenário e espera `undefined`. Sem o `eq(convite.escolaId, …)`, o convite de B seria revogado e o teste quebraria. No contexto de B, as duas chamadas encontram os dados, o que prova que o teste não passa por acaso.
- "a coordenação de B não desativa a pessoa de A": recebe a mesma resposta do id inexistente (`NAO_ENCONTRADO`), e nem o vínculo, nem o convite, nem o acesso da turma mudam.
- "isolamento (RF16)": a pessoa desligada em A continua com o vínculo, a sessão e o acesso da turma em B.

Bloqueantes: nenhum.

Recomendações:
- `ciclo-de-vida.repository.ts:66`: a cláusula `eq(anoLetivo.escolaId, requireEscolaId())` da trava do ano não tem teste próprio. O `exists` ao lado cobre o caso e a query só trava, não devolve dado. Ainda assim, convém registrar a razão na retro como cobertura extra.
- `ciclo-de-vida.repository.ts:110`: o `eq(vinculo.escolaId, …)` do `update` também não tem teste próprio. Hoje a leitura anterior protege, porque o `update` só recebe os ids que ela devolveu. Se essa leitura mudar um dia, o `update` fica sem rede, e um teste que chame o `update` direto fecharia isso.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-03 17:47:29 · `tasks/prd-onboarding-por-convite/3_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. O diff não grava, não apaga e não lê `Nota`. Os caminhos que já existiam ficam como estavam. Todos com autor humano? sim, nada mudou neles.

Decisão autônoma sobre aluno: ausente. O `desativar` encerra o vínculo do aluno por `desligamento` (`packages/core/src/ciclo-de-vida/ciclo-de-vida.service.ts:77-80`), mas isso é ato administrativo e não decide aprovação, reprovação nem encaminhamento. Ele só roda quando uma pessoa da coordenação pede, e não é chamado por nenhum job nem por IA: busquei quem chama `desativar` fora dos testes e não há caller automático. Os dois `eliminar` automáticos já existiam (`packages/core/src/retencao/expurgo-da-escola.repository.ts:434` e `packages/core/src/titular/eliminacao-do-titular.ts:99`). Eles cumprem retenção e pedido do titular, não tratam de trajetória, e o diff só lhes acrescenta a trava dos anos.

Aprovação registrada: ok. Não há saída de IA no escopo. O encerramento de vínculo, a revogação do acesso da turma e a do convite vão à auditoria (`vinculo.encerrado`, `acesso_turma.revogado`, `convite.revogado`) só com ids e com a autoria de quem pediu. Isso está provado em `apps/api/test/ciclo-de-vida.int.test.ts` e `apps/api/test/acesso-fim-do-vinculo.int.test.ts`.

Supervisão do tutor: ok. Tutor fora do escopo e intocado.

Autonomia declarada e visível: sim. Nenhum agente foi tocado e nenhum nível mudou.

Os itens 7 (supervisão sem vigilância), 8 (D46/D55, sem nota em discursiva e redação) e 9 (D45, medir o professor sem vigiar) não são tocados. Não há inferência emocional, campo de nota ou conceito em discursiva, métrica de professor nem acesso da coordenação à conversa do professor com o chat. A tarefa não tem tela, e por isso não houve fotos para conferir.

Bloqueantes: nenhum.

Recomendações:
- `packages/core/src/ciclo-de-vida/ciclo-de-vida.service.ts:66`: o parâmetro `autoria` tem padrão `{}`. Quando a coordenação desativa, o autor vem do contexto, e o teste confirma isso com `autor_usuario_id` preenchido. Mesmo assim, vale um teste de que nenhum caminho de `desativar` grava `vinculo.encerrado` sem `autor_usuario_id` e sem `autor_operador`. Isso deixa a pergunta "quem fez, quando" sempre respondida também para o fim de vínculo de aluno.
- `docs/regulacao.md` não precisa mudar com esta tarefa. Fica registrado para a validação que encerrar o vínculo de aluno por desativação é ato administrativo humano, e não decisão sobre a trajetória (regra 70, item 2).

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/ciclo-de-vida/ciclo-de-vida.service.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/api/test/ciclo-de-vida.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/api/test/acesso-fim-do-vinculo.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/docs/lgpd.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/tasks/prd-onboarding-por-convite/3_task.md`

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-03 17:47:42 · `tasks/prd-onboarding-por-convite/3_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo. A tarefa só muda o estado de linhas que já existem: `vinculo.estado`, `motivo_encerramento` e `encerrado_em`, `convite.revogado_em` e `acesso_turma.revogado_em`, além das travas de leitura em `ano_letivo`, `turma` e `vinculo`.

Fora da tabela de dados do docs/lgpd.md: nada. A linha "Acesso da turma" (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/docs/lgpd.md:86`) agora diz que a desativação revoga o acesso, e a frase antiga "a desativação ainda não revoga" saiu. As linhas "Vínculo" (:72) e "Convite de professor" já cobrem o encerramento por `desligamento` e a revogação, com a retenção atual (60 meses do vínculo encerrado; 30 dias do convite revogado, pelo `sistema.expurgar-acesso`).

Autorização por objeto: ok.
- No service, o escopo vem do contexto (`requireEscolaId()`) em `travarAnosDosVinculos`, `encerrarVinculosDaPessoa` e `revogarConviteAberto`. O id da escola nunca vem por parâmetro.
- Fiz o teste de trocar o id: a coordenação de B desativa a pessoa de A e recebe `NAO_ENCONTRADO`, igual ao id inexistente, e nada de A muda (teste "isolamento: a coordenação de B não desativa a pessoa de A…").
- O repository tem o mesmo teste nas duas escolas, nos dois sentidos ("isolamento no repository…").
- A pessoa com usuário em duas escolas, desligada em A, continua com o vínculo e o acesso em B (RF16).
- A trava do ano roda antes de `travarUsuario`. Com um id de outra escola, o `exists` filtra pela escola e não trava nada, e a resposta segue igual à de um id inexistente.

Logs: limpos. `ciclo-de-vida.service.ts` e `ciclo-de-vida.repository.ts` não têm logger, e há um teste que garante isso. O espião de SQL do teste guarda só o texto da consulta, sem os parâmetros.

Auditoria: presente, e só com ids.
- `vinculo.encerrado`, com o estado de antes e o motivo `desligamento`. O schema rígido de `acoes.ts:303` aceita esse motivo.
- `acesso_turma.revogado`, com o `turmaId`.
- `convite.revogado`, com o `tipo`. O schema rígido de `acoes.ts:170` não tem token, nome nem e-mail.
- O autor é a coordenação, ou o operador na eliminação. Os testes conferem o autor e que nenhum registro tem `@`.

Envio externo: nenhum.

Seed/fixture: sintético. Os nomes são `Pessoa sintética <uuid>`, os e-mails `@escola.invalid`, as matrículas `RA<hex aleatório>` e os tokens são sorteados.

Pergunta de fechamento: o código responde. O que muda nesta tarefa fica em tabelas que o arquivo do titular já lê, e cada mudança tem auditoria com autor e data. A tarefa não cria nenhum envio a terceiro.

Bloqueantes: nenhum.

Recomendações:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/TODO.md:1019`: o item "A desativação do professor … não encerra os vínculos dele nem revoga o acesso da turma" continua aberto, mas esta tarefa resolve a parte principal dele. Vale marcar essa parte como resolvida, citando onboarding-por-convite 3.0, e deixar abertas só as pendências que sobram: a janela da eliminação com vínculo novo e o `40P01` que hoje vira `ERRO_INTERNO`.
2. O comentário de `vinculo.encerrado` em `packages/core/src/auditoria/acoes.ts:302` diz só "A coordenação encerrou o vínculo (9.0…)". Vale citar também a desativação (3.0), para quem consultar a auditoria saber que o registro aparece nos dois caminhos.
3. Com esta tarefa, a desativação do aluno também encerra o vínculo dele por `desligamento`. A linha "Vínculo" do `docs/lgpd.md:72` está certa, mas não diz isso. Uma frase ali ajudaria a escola a responder, quando perguntarem, o que acontece com o aluno desativado.

Não rodei os testes de integração; a avaliação vem da leitura do diff e do código.

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-03 17:49:16 · `tasks/prd-onboarding-por-convite/3_task.md`

VEREDITO: REPROVADO

Escopo: respeitado. As subtarefas 3.1 a 3.5 foram feitas e nada invade a F2c, a 6.0 ou a 10.0.

Aderência à Tech Spec: divergência no caminho do encerramento (subtarefa 3.1), decidida sem registro.

Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)").

Bloqueantes:

1. **O encerramento não passa pelo `encerrar`, e a mudança não foi registrada.**
   - Onde: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts:94-112` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/ciclo-de-vida/ciclo-de-vida.service.ts:78`.
   - O que a tarefa pede: o `3_task.md:27` diz que o `desativar` encerra os vínculos "pelo `encerrar`". O `3_task.md:38` prevê mudança em `packages/core/src/estrutura/vinculo.repository.ts`. A `techspec.md` §2, linha 20, levou o `encerrar` para o core "para haver um jeito só".
   - O que foi feito: um `update vinculo set estado='encerrado', motivo_encerramento, encerrado_em` novo, o `encerrarVinculosDaPessoa`, dentro da `CicloDeVidaRepository`. É a mesma lógica do `VinculoRepository.encerrar` escrita uma segunda vez, e o `vinculo.repository.ts` não mudou.
   - O motivo existe e é bom: o `#escopo()` do `encerrar` só alcança o vínculo de professor do ano em curso, e a desativação precisa também do ano planejado e do aluno. Mas esse motivo está só no comentário do código.
   - O que mostra que a mudança passou sem registro: a tabela "Divergências resolvidas nesta tarefa" (`3_task.md:76-79`) está vazia, a 3.1 está marcada `[x]` como se o caminho tivesse sido seguido, e o teste em `apps/api/test/ciclo-de-vida.int.test.ts:833` se chama "(passa pelo encerrar)" sem passar por ele.
   - Correção exigida, um dos dois caminhos:
     - (a) Levar o encerramento por pessoa para o `VinculoRepository`, no arquivo que a tarefa previu, como variante do `encerrar` (por usuário, sem o ano do contexto e sem o filtro de papel). A `CicloDeVidaRepository` passa a chamá-lo, e fica um jeito só de encerrar vínculo.
     - (b) Registrar a divergência na tabela da tarefa, na linha `packages/core/src/ciclo-de-vida/` da `techspec.md` §2 e no `cenarios.md` (o item do `desativar` em RF6), dizendo por que o `encerrar` não serve.
   - Nos dois casos, corrigir o nome do teste da linha 833.

Recomendações:

- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/TODO.md:1019`: o item "A desativação do professor não encerra os vínculos dele nem revoga o acesso" continua aberto, e esta tarefa o resolve. Marcar a parte resolvida, com a referência à 3.0, e deixar abertas as partes que ainda valem: a janela do `criar` e o `40P01` que sai como `ERRO_INTERNO`.
- A janela do `criar` continua aberta:
  - O `VinculoService.criar` (`apps/api/src/estrutura/vinculo/vinculo.service.ts`) não trava o usuário. A FK só pega `FOR KEY SHARE`, que não conflita com o `FOR NO KEY UPDATE` do `desativar`.
  - Por isso um vínculo `pendente` criado em paralelo pode nascer depois da leitura `FOR UPDATE` e ficar aberto para um usuário já desativado. Ele não dá acesso, mas fica errado.
  - É assunto do `infra-guardian`. Registrar no `TODO.md`, se ele não pedir mais.
- O expurgo trava o usuário antes do ano:
  - O `#eliminarPessoasDesativadas` (`packages/core/src/retencao/expurgo-da-escola.repository.ts:417-434`) trava o usuário antes de chamar o `eliminar`, que agora trava o ano em `FOR SHARE`. Isso põe o usuário antes do ano, contra a ordem global.
  - Hoje não há quem segure o ano de forma exclusiva e espere esse usuário, então não vejo deadlock. Vale anotar a exceção no comentário da ordem global, em `ciclo-de-vida.service.ts:57-61`.
- Os dois [P] (`ciclo-de-vida.int.test.ts:946` e `:972`) usam o mesmo `POST /anos-letivos/:id/encerrar` e só mudam o ponto da barreira. Dizer no nome ou num comentário que o `virarSala` é exercido dentro do encerramento do ano.

## infra-guardian · 1ª rodada · REPROVADO · 2026-11-03 17:49:38 · `tasks/prd-onboarding-por-convite/3_task.md`

VEREDITO: REPROVADO
Caminho quente tocado: nenhum. A desativação é uma ação da coordenação e também roda dentro do passo (3) do job da planilha. O que ela trava (turma em `FOR NO KEY UPDATE`, ano em `FOR SHARE`) cruza com o gerar acesso, o aceite do convite e a virada do ano.
Rate limit: ok (não há rota nova)
Fila e prioridade: ok (não há job novo)
Concorrência: corrida em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/ciclo-de-vida/ciclo-de-vida.service.ts:73` e `:84`, contra `ConviteService.aceitar` e `AtivacaoPorConvite.ativar`
Índice e paginação: ok (com uma recomendação abaixo)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (fora do caminho quente, sem alerta novo)

Bloqueantes:

1. **`ciclo-de-vida.service.ts:73` e `:84`, com `ciclo-de-vida.repository.ts:120-122` e `:231`.** O N1 da A1 continua aberto quando a desativação e o aceite rodam ao mesmo tempo. O padrão é "busca, verifica, grava" sem trava comum.
   - **Como acontece:** a desativação grava `desativado_em = now()`, e no Postgres `now()` é a hora em que a transação começou. Ela não pega a trava do convite da escola (`pg_advisory_xact_lock` de `ConviteRepository.travarEscola`), que o aceite, a ativação, o gerar, o refazer e o revogar usam.
   - **A sequência:**
     1. A desativação começa em T0.
     2. O aceite começa em T1, depois de T0. A conta já tem senha, então o `definirSenhaNoAceite` não casa, não espera nada, e o aceite grava `usado_em = T1` e confirma.
     3. A desativação chega ao `revogarConviteAberto`. O `update` espera a linha, reavalia `usado_em is null`, dá falso e não revoga nada. Ela confirma com `desativado_em = T0`.
     4. O login seguinte com o bilhete passa por `pendenteDoConvite` e `ativarPorConvite`. A condição `usado_em (T1) >= desativado_em (T0)` é verdadeira e reativa quem a escola acabou de desligar.
   - **O comentário erra:** o de `repository.ts:119-120` ("o `desativado_em` posterior a ele já o impede de ativar") é falso sob concorrência.
   - **Há também risco de `40P01`:** quando a conta não tem senha, o aceite segura a linha do convite e quer a da conta. A desativação segura a conta em `FOR UPDATE` e quer a linha do convite.
   - **Correção exigida:**
     - Pôr a desativação na mesma trava do convite da escola que o aceite e a ativação usam, numa posição declarada da ordem global. A Tech Spec §5 precisa dizer onde ela entra em relação à importação, ao ano e aos usuários, inclusive quando o `desativar` roda dentro da transação do job.
     - Fazer com que todo aceite confirmado antes fique com `usado_em < desativado_em`: gravar `desativado_em` com `clock_timestamp()` depois da trava, ou revogar também o convite usado cujo usuário ainda não foi ativado.
     - Corrigir o comentário.
     - Adicionar o teste [P] `desativar × aceitar` com barreira (`WriteBlockTrigger` no `update` do convite), nos dois casos: conta com senha e conta sem senha. Ele precisa provar zero `40P01` e que o login com o bilhete depois da desativação não reativa o usuário.

Recomendações:
- `ciclo-de-vida.repository.ts:102`: o `encerrarVinculosDaPessoa` filtra por `(escola_id, usuario_id)` sem ano, e o `vinculo_usuario_idx` é `(escola_id, ano_letivo_id, usuario_id, estado)`. Só o prefixo da escola serve, e a varredura cresce com os anos que a retenção guarda. Vale restringir aos anos já travados por `travarAnosDosVinculos` (devolvendo os ids) ou anexar o `EXPLAIN` com o volume de uma escola de 900 alunos e cinco anos.
- No teste `[P] desativar contra o virarSala`, o `expect(auditoria acesso_turma.revogado).toEqual([])` depende de quem vence a corrida. Ele está certo pela barreira, mas o comentário deveria dizer que a ordem é garantida pela espera no `FOR SHARE` do ano.
- A tarefa diz que o `virarSala` está protegido pelo ano em `FOR SHARE`. Isso vale só para os anos em que a pessoa tem vínculo aberto, porque o vínculo criado num ano novo durante a desativação não é travado. Vale um caso [I] provando que `POST /v1/vinculos` para usuário desativado na mesma janela sai recusado, ou o registro de que o `estadoDoProfessor` já barra isso.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-03 17:50:30 · `tasks/prd-onboarding-por-convite/3_task.md`

VEREDITO: REPROVADO

Cenários exigidos:
- Caminho feliz: desativar o professor encerra os vínculos dele na escola (RF5; regra 20, item 18).
- Convite aberto revogado e aceite posterior recusado (N1).
- Acesso da turma revogado pela desativação.
- Ano em curso e ano planejado; escola sem ano em curso; aluno desativado.
- Espião no SQL: trava das turmas num comando só, ordem global no `desativar` e no `eliminar`.
- [P] contra `virarAno` e contra `virarSala`; [P] contra o gerar acesso, nos dois sentidos.
- Isolamento: RF16, a coordenação de B, e o repository.
- Log só com ids.
- Do domínio:
  - professor com duas disciplinas ou turmas em dois anos;
  - vínculo já encerrado por realocação;
  - convite já usado ou já revogado;
  - virada de ano no meio da desativação;
  - professor cadastrado e ainda pendente (convite aberto, conta inativa) sendo desligado.

Cobertos: todas as linhas da tabela de testes têm teste citado pelo nome, e rodei os 17 casos do `describe` da 3.0 (17 passaram). Não há `.skip`, teste comentado, mock de coisa nossa nem chamada de IA. As três corridas novas com barreira (`WriteBlockTrigger` e `esperarNaTrava`) rodam de verdade em paralelo e conferem o estado final e o zero `40P01`. A falta está no convite (bloqueante 1).

Bloqueantes:

1. **O teste do N1 monta um estado que não existe no sistema, e o caso real não é revogado.**
   - O que está errado:
     - O teste (`apps/api/test/ciclo-de-vida.int.test.ts:809-831`) cria a pessoa ativa com `pessoa()` (`:93-100`, `desativado_em` nulo) e grava à mão um convite aberto para ela.
     - No fluxo real esse estado não acontece. O `usuarioConvidado` (`apps/api/src/sessao/convite/convite.repository.ts:37-48`) cria o usuário com `desativadoEm: now()` e o deixa inativo até o aceite. Convidar um usuário já ativo dá `CONFLITO`.
     - Quem tem convite aberto é sempre o professor pendente, que está inativo. Para ele, o `desativar` sai em `packages/core/src/ciclo-de-vida/ciclo-de-vida.service.ts:68` (`if (alvo.desativadoEm !== null) throw naoEncontrado()`) antes de chegar ao `revogarConviteAberto`.
     - Resultado: o convite continua aberto e o aceite posterior reativa a pessoa pelo `ativarPorConvite`, porque o `usado_em` fica maior ou igual ao `desativado_em`. É exatamente o que a N1 queria impedir. O teste passa sobre um estado impossível e esconde esse caminho.
   - Correção exigida:
     - Reescrever o cenário com o convite criado pela rota real (cadastro ou convite do professor pela coordenação) e o professor ainda pendente: desativar, depois aceitar, e conferir a recusa e o usuário que segue inativo.
     - Fazer a produção atender esse caso, ou levar ao Arquiteto, como divergência registrada, que o convite do pendente é revogado em outro lugar (6.0/10.0) e que esta revogação é só defesa extra.
     - Se a produção mudar, incluir um [P] de desativar contra o aceite do mesmo convite, com barreira.

2. **Uma cláusula nova sem bloco, com um motivo que está errado.**
   - O que está errado:
     - O motivo (2) do documento diz que o `.where(` do `exists` (`packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts:71`) tem "duas cláusulas" e que as duas têm bloco. Ele tem quatro (`:73-76`).
     - A cláusula `eq(vinculo.anoLetivoId, anoLetivo.id)` (`:74`) é a correlação que define qual ano é travado, e não tem bloco nem motivo. Sem ela, todo ano da escola é travado sempre que a pessoa tem qualquer vínculo aberto.
     - O teste "o ano em que ela só tem vínculo encerrado…" pegaria essa mudança: o planejado entraria na trava do `desativar` e sairia `55P03`.
     - O `eq(vinculo.escolaId, anoLetivo.escolaId)` (`:73`) e o `eq(vinculo.usuarioId, usuarioId)` do `update` (`:110`, redundante por causa do `inArray`) também não têm bloco nem motivo escrito.
   - Correção exigida: um bloco para a `:74`, citando aquele teste, e um motivo escrito para a `:73` e para o `usuarioId` da `:110`.

3. **O `escolaId` da trava do ano não é uma "segunda camada", como diz o motivo (1), e a falta dele vaza a existência entre escolas.**
   - O que está errado:
     - O `usuarioId` vem de quem chama, e o `travarAnosDosVinculos` roda antes do `travarUsuario`, o passo que recusa a pessoa de outra escola.
     - Sem o `eq(anoLetivo.escolaId, requireEscolaId())` (`ciclo-de-vida.repository.ts:66`), a coordenação de A que desativa o id da pessoa de B trava em `FOR SHARE` os anos de B.
     - Se B estiver na virada, A espera ou recebe `55P03`, e não o `NAO_ENCONTRADO` do id inexistente. É uma resposta diferente que confirma que o id existe (regra 10, item 6). O teste de isolamento atual não pegaria isso, porque nenhum ano de A está travado.
   - Correção exigida: tirar a `:66` do "Sem bloco" e escrever o caso com o ano de B travado por outra transação e `lock_timeout` curto (o mesmo `comOAnoTravado`). A coordenação de A desativa a pessoa de B e recebe `NAO_ENCONTRADO`, igual ao id inexistente, sem `55P03`. Esse caso vira o bloco da `:66`.

Recomendações:
- `tasks/prd-onboarding-por-convite/3_task.md:83`: a linha `--faltando: 3 linhas (17 blocos, 3 motivos)` parece saída da ferramenta colada no documento. Tirar.
- O `FOR UPDATE` da leitura dos vínculos (`ciclo-de-vida.repository.ts:104`) não é provado por nenhum teste. A expressão `vinculo` do `ordemDasTravas` também casa com `update "vinculo"`, então a ordem não muda sem ele. Vale um [P] de desativar contra o professor confirmando o vínculo, conferindo o `antes` da auditoria.
- O [P] contra o `virarSala` só prova um sentido: a virada primeiro e o `desativar` esperando. "Um espera o outro" pede também a desativação parada com a virada chegando.
- O caminho feliz prova "não alcança a turma" pelo 401 do `/eu`. Vale conferir também o 404 numa rota da turma com uma sessão nova da mesma conta em outra escola, se for o caso.
- O teste de log (`:562-567`) lê o texto dos arquivos. Está aceitável como guarda, mas não substitui a asserção sobre a auditoria, que só procura `@`. Vale conferir também que o nome não aparece.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/tasks/prd-onboarding-por-convite/3_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/ciclo-de-vida/ciclo-de-vida.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/api/test/ciclo-de-vida.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/api/src/sessao/convite/convite.repository.ts

## revisor-geral · 2ª rodada · APROVADO · 2026-11-03 18:05:28 · `tasks/prd-onboarding-por-convite/3_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

A correção exigida na rodada 1 foi feita pelo caminho (b), nos quatro pontos pedidos:
- **Tabela de divergências da tarefa:** `3_task.md:82` registra por que o `encerrar` não serve. Ele encerra só por id, só o vínculo de professor e só no ano em curso, pelo `#escopo`. Por isso existe o `encerrarVinculosDaPessoa`, por pessoa, que pega professor e aluno no ano em curso e no planejado. O acesso da turma continua saindo pelo mesmo `revogarDeQuemSaiu`.
- **`techspec.md` §2:** a linha `packages/core/src/ciclo-de-vida/` agora diz a mesma coisa.
- **`cenarios.md`, RF6:** o item do `desativar` foi reescrito, por pessoa e sem o ano do contexto.
- **Nome do teste da linha 833:** perdeu o "(passa pelo encerrar)". `apps/api/test/ciclo-de-vida.int.test.ts:836` agora diz "que encerra os vínculos antes".

Há uma segunda divergência nova: o `desativar` só alcança o usuário ativo, e a revogação do convite virou defesa. Ela está registrada nos três lugares: `3_task.md:81`, `techspec.md` §2 e `cenarios.md` RF6, este com um item novo para o professor pendente. Dois testes novos cobrem o que ela muda. O primeiro cria o professor pendente pela rota real (`POST /v1/professores`) e recebe `NAO_ENCONTRADO`, igual ao id inexistente, sem tocar no convite nem no vínculo. O segundo mostra que a coordenação de A, ao desativar a pessoa de B com o ano de B travado, também recebe `NAO_ENCONTRADO`, sem esperar e sem `55P03`.

No código desta rodada só mudaram comentários: o JSDoc do `revogarConviteAberto` e o do service, que agora anota a exceção de ordem de travas no `#eliminarPessoasDesativadas`. O comportamento do `desativar` é o mesmo que os guardiões já aprovaram.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/tasks/prd-onboarding-por-convite/3_task.md:27`: a subtarefa 3.1 ainda diz "pelo `encerrar`". Ela pode remeter à divergência da linha 82, para quem ler a tarefa depois não achar que foi seguido o caminho previsto.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/tasks/prd-onboarding-por-convite/3_task.md:38`: a tabela de arquivos previstos ainda lista o `packages/core/src/estrutura/vinculo.repository.ts`, que não mudou. Convém marcar que ele não foi alterado, por causa da divergência.

## test-engineer · 2ª rodada · REPROVADO · 2026-11-03 18:06:52 · `tasks/prd-onboarding-por-convite/3_task.md`

VEREDITO: REPROVADO

Cenários exigidos: os três da 1ª rodada.
- **N1, professor pendente pela rota real.** Por divergência, o `desativar` passou a valer só para usuário ativo, e o professor pendente sai pelo `convite/revogar` da A1.
- **Bloco para o `eq(vinculo.anoLetivoId, anoLetivo.id)`**, mais o motivo escrito do `eq(vinculo.escolaId, anoLetivo.escolaId)` e das duas cláusulas do `update` (`:110`).
- **Isolamento com o ano de B travado:** a coordenação de A desativa a pessoa de B, recebe `NAO_ENCONTRADO` e não `55P03`. Esse teste é o bloco do `eq(anoLetivo.escolaId, requireEscolaId())`.

Cobertos:
- **Correção 2: feita.** O bloco novo cita "o ano em que ela só tem vínculo encerrado…" (`apps/api/test/ciclo-de-vida.int.test.ts:1047`). Sem a correlação, o vínculo aberto no ano em curso põe o planejado na trava, e o `desativar` dentro do `comOAnoTravado` sai em `55P03`. O teste chega à cláusula. Os motivos da `:73` e da `:110` estão escritos e se sustentam: a FK do vínculo para turma (`vinculo_turma_do_ano_da_escola_fk`) e a da turma para o ano (`turma_ano_letivo_da_escola_fk`) prendem o vínculo à escola do ano, e o `inArray` limita o `update` aos ids já lidos com escola e usuário.
- **Correção 3: feita.** O teste está em `ciclo-de-vida.int.test.ts:1159-1184`. Outra transação segura o ano de B com `FOR NO KEY UPDATE`, que conflita com o `FOR SHARE`, e o `lock_timeout` é de 1s. Sem a `:66`, o `exists` casa o vínculo aberto de B, a trava espera e sai `55P03`. Com ela, o `travarUsuario` no escopo de A devolve `NAO_ENCONTRADO`. O teste também confere que o vínculo de B segue aberto.
- **Correção 1, parte do convite em aberto: feita.** O teste "professor pendente, cadastrado por POST /v1/professores…" (`:1139-1157`) usa a rota real e aloca o vínculo pela rota. Ele confere o `NAO_ENCONTRADO` igual ao do id inexistente, o convite intocado e ainda consultável, o vínculo igual e nenhuma auditoria. Ele falharia sem o `if (alvo.desativadoEm !== null)` (`ciclo-de-vida.service.ts:72`). O teste antigo agora diz no nome que é defesa sobre um estado montado no banco.
- O arquivo inteiro passa: 39 testes verdes.

Bloqueantes:
1. **A divergência registrada promete um caminho que o código não tem para o professor que aceitou o convite e ainda não entrou.** Esse professor fica sem saída nenhuma.
   - **O que o documento diz.** `tasks/prd-onboarding-por-convite/techspec.md:24` afirma que o pendente "com o convite em aberto **ou aceito sem a primeira entrada**" sai pelo `convite/revogar` da A1. A linha de divergência em `tasks/prd-onboarding-por-convite/3_task.md:82` se apoia nisso.
   - **Por que o estado existe.** Quem já tem conta com senha (o professor que já dá aula em outra escola, RF16) aceita o convite sem definir senha. Assim o `ativarPorConvite` não roda no aceite (`apps/api/src/sessao/convite/convite.service.ts:110`), e o usuário segue com `desativado_em` preenchido e o convite usado.
   - **Por que o `desativar` não o alcança.** Ele responde `NAO_ENCONTRADO` para esse usuário (`packages/core/src/ciclo-de-vida/ciclo-de-vida.service.ts:72`).
   - **Por que o `convite/revogar` também não.** O `estadoDoProfessor` classifica esse caso como `aceito` (`packages/core/src/convite/estado-do-professor.ts:45`), e para `aceito` a matriz manda `CONFLITO` (`packages/shared/src/professores/professores.ts:89`). Nada é revogado.
   - **O que acontece depois.** Na primeira entrada, o `login.service.ts:140` (ou o `mfa.service.ts:154`) chama o `ativar`. Como o `usado_em` é maior ou igual ao `desativado_em` e o `revogado_em` é nulo, o usuário é ativado com os vínculos pendentes e pode confirmá-los. A escola tentou tirar esse professor, as duas rotas recusaram, e ele entra mesmo assim. É o mesmo efeito que a N1 queria impedir, e fere a regra 20, item 18. Nenhum teste cobre esse estado.
   - **Correção exigida, uma das duas:**
     - (a) Fazer a produção atender o caso. Ou o `desativar` revoga o convite usado do inativo `aceito` (o `ativarPorConvite` já exige `revogado_em` nulo) e encerra os vínculos, ou a matriz da A1 passa a revogar no estado `aceito` inativo. Nos dois jeitos, sob a trava da escola, com o teste "aceito sem a primeira entrada: desativar (ou revogar) e depois entrar; o usuário segue inativo e sem vínculo aberto", um [P] contra o `ativar` do login com barreira, e um bloco de mutação.
     - (b) Levar ao Arquiteto, com `techspec.md:24` e `3_task.md:82` corrigidos para dizer que esse estado hoje não tem saída, e a tarefa que vai fechá-lo nomeada.

Recomendações:
- **Motivo (1) da seção "Mutações" do `3_task.md`:** o texto diz que "as quatro cláusulas… estão cobertas" e logo depois que a quarta não tem bloco. Basta reescrever como "três cobertas, a quarta sem bloco por…".
- **No mesmo motivo,** "FK composta do vínculo ao ano" não é exato: a garantia vem em cadeia, do vínculo para a turma e da turma para o ano. Vale nomear as duas FKs.
- **No teste de isolamento com o ano travado (`:1159`),** dá para chamar também `desativar(randomUUID())` na mesma condição e comparar as duas respostas, como faz o teste do pendente. Isso deixaria explícito o "igual ao inexistente".

## infra-guardian · 2ª rodada · REPROVADO · 2026-11-03 18:08:59 · `tasks/prd-onboarding-por-convite/3_task.md`

VEREDITO: REPROVADO
Caminho quente tocado: nenhum. É ação da coordenação, mas cruza com o aceite do convite e com a ativação no login.
Rate limit: ok (a tarefa não cria rota nem limite)
Fila e prioridade: ok (não se aplica nesta tarefa)
Concorrência: corrida em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts:236`, contra `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/api/src/sessao/convite/convite.service.ts:107-114`
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok

Bloqueantes:

1. **O N1 da A1 continua alcançável. A corrida passa pela transição, não pelo estado parado.** Arquivos: `ciclo-de-vida.repository.ts:236` (`desativadoEm: sql\`now()\``), com `ciclo-de-vida.service.ts:72` e `:198-200`.
   - **Onde a premissa da divergência acerta:** o usuário ativo não tem convite em aberto, e o pendente é inativo. Isso confere no código: o `usuarioConvidado` tem `setWhere isNotNull`, o único `criarConvite` está atrás dele, e o único ponto que zera o `desativado_em` é o `ativarPorConvite`.
   - **Onde ela não cobre:** quando a conta não tem senha, o aceite ativa o usuário dentro da própria transação (`convite.service.ts:114`).
   - **A sequência:**
     1. A desativação começa em T0 e passa pelo `FOR SHARE` do ano. A espera fica longa se a virada segura o ano.
     2. O aceite começa em T1, depois de T0. Ele grava `usado_em = T1`, define a senha e ativa o usuário.
     3. O `travarUsuario` filtra só por id, então espera a linha do aceite e relê o usuário já ativo. A desativação segue com `desativado_em = now() = T0`.
     4. O `revogarConviteAberto` não pega o convite, que já está usado.
     5. O `limparContaSemUso` não limpa a conta quando ela tem outro convite válido em outra escola. É o professor convidado por duas escolas no começo do ano (RF16).
     6. O login com o bilhete do aceite (30 min) passa pelo `usuarioComConviteAceito` e pelo `ativarPorConvite`. Como `T1 >= T0`, o usuário que a escola acabou de desligar volta a ficar ativo.
   - **O comentário erra:** o de `ciclo-de-vida.repository.ts:124-125` ("o `desativado_em` posterior a ele já o impede de ativar") é falso nessa ordem.
   - **Há também um `40P01` no mesmo cenário.**
     - O aceite trava conta e depois usuário: `definirSenhaNoAceite`, depois `ativarPorConvite`.
     - O `desativar` do pendente trava usuário (`:198`) e depois conta (`:200`), e só então recusa em `:72`.
     - É ordem invertida.
   - **Correção exigida, mais estreita que a da 1ª rodada.** A triagem do Arquiteto dispensa a trava da escola, e eu aceito.
     - (a) Em `repositorio.desativar`, gravar `desativado_em` com `clock_timestamp()`, que corre depois da trava do usuário. Assim todo aceite confirmado antes fica com `usado_em < desativado_em`.
     - (b) No `desativar`, recusar o usuário inativo (`NAO_ENCONTRADO`) logo depois do `travarUsuario`, antes do `travarConta`. Isso desfaz a ordem invertida com o aceite.
     - (c) Corrigir o comentário de `:124-125` e o docblock de `ciclo-de-vida.service.ts`.
     - (d) Adicionar o teste [P] `desativar × aceitar`, com conta sem senha e outro convite válido da mesma conta em outra escola. Barreira no `update` do usuário pelo aceite (`WriteBlockTrigger`), com a desativação já aberta antes. O teste prova três coisas: zero `40P01`, `usado_em < desativado_em`, e que o login com o bilhete depois não reativa ninguém (`pendenteDoConvite` devolve `undefined`).
     - (e) Registrar no `cenarios.md` e na `techspec.md` §2 que o fechamento vem do `clock_timestamp()`, e não só do "pendente é inativo".

Recomendações:
- O impacto real do bloqueante é limitado: o usuário reativado fica sem vínculo, porque o `encerrarVinculosDaPessoa` já rodou, e não alcança turma. Vale dizer isso na AIA ou no `TODO.md` se a correção atrasar. Não muda a exigência.
- O `TODO.md:1019` ainda lista como aberta a parte que esta tarefa resolveu. Marcar como resolvida, e deixar aberto só o `40P01` que sai como `ERRO_INTERNO` em outros caminhos.

Arquivos relevantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/ciclo-de-vida/ciclo-de-vida.service.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/api/src/sessao/convite/convite.service.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/api/src/sessao/tenant/tenant-resolution.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/ciclo-de-vida/conta-global.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/api/test/ciclo-de-vida.int.test.ts`

## revisor-geral · 3ª rodada · APROVADO · 2026-11-03 18:43:02 · `tasks/prd-onboarding-por-convite/3_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

O diff desde a 2ª rodada segue os seis pontos de `.processo/ordens/diagnostico-3.md`:

- **Repository:** o `#conviteAceitoAEspera` reproduz a condição do `ativarPorConvite` (`apps/api/src/sessao/convite/convite.repository.ts:122`), só sem o `conviteId`. O `travarUsuario` passou a devolver `aEsperaDaPrimeiraEntrada`. O `desativar` grava com `clock_timestamp()` e alcança tanto o usuário ativo quanto o que ainda espera a primeira entrada, com o `or(...)`.
- **Service:** a recusa do inativo saiu de dentro da ação do `desativar` e foi para o `#naTransacao`, entre o `travarUsuario` e o `travarConta`. Ela só vale para o `desativar`: o `eliminar` e o `desligarContaExterna` passam `false`, e o `desligarContaExterna` mantém a recusa que já tinha.
- **Docblocks:** o do `revogarConviteAberto` e o da classe foram reescritos como o diagnóstico pediu.
- **Spec:** a linha da `techspec.md` §2, os três itens novos do `cenarios.md` RF6, a divergência no `3_task.md` e a tabela de testes com os casos A a D estão todos registrados. A divergência não ficou só no `N_task.md`.
- **Isolamento (regra 10, item 6):** o caso com o ano de B travado agora também compara a resposta com a de um id inexistente nas mesmas condições.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/api/test/ciclo-de-vida.int.test.ts:83`: o nome do teste cita "o desativado", mas o caso só exercita o pendente e o aceito com convite revogado. O desativado aparece no fim do caso A (linha 80). Tirar "o desativado" do nome ou incluir o caso nele.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts:285`: depois da edição, a linha do docblock do `revogarConviteAberto` ficou bem mais longa que as vizinhas. Quebrar a linha.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/ciclo-de-vida/ciclo-de-vida.service.ts:193`: o parâmetro `recusarInativo: boolean` posicional entre `anos` e `acao` deixa as chamadas pouco legíveis (`'todos', false, ...`). Um objeto de opções (`{ anos, recusarInativo }`) diria o que cada valor faz na própria chamada.
- O caso A regrava o `desativado_em` do usuário que espera a primeira entrada, e com isso o prazo de retenção da rotina `pessoa_desativada` passa a contar da desativação, não do cadastro. Parece o efeito certo, mas vale uma linha no docblock do `desativar` do repository.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-03 18:43:08 · `tasks/prd-onboarding-por-convite/3_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela ou migration nova no diff desde a 1ª rodada. Os campos novos são lidos de tabelas que já existem e têm `escolaId`: `usuario`, `convite`, `vinculo` e `ano_letivo`.

Queries verificadas, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts`:
- `#conviteAceitoAEspera` (:226) tem `eq(convite.escolaId, requireEscolaId())` na :232. O escopo vem do contexto, e a subconsulta se liga ao `usuario` da consulta que a contém.
- `travarUsuario` (:247) mantém `eq(usuario.escolaId, requireEscolaId())` na :256, e o `exists` novo herda esse escopo.
- `desativar` (:268) mantém `eq(usuario.escolaId, requireEscolaId())` na :274. O `or(isNull, exists)` da :276 fica dentro do `and` que já tem a escola, então não abre o escopo.
- `travarAnosDosVinculos` (:65, cláusula da :71) não mudou. Agora o teste de isolamento novo cobre essa cláusula.
- Em `ciclo-de-vida.service.ts`, a recusa do inativo vem depois do `travarUsuario`, que tem escopo. O usuário de outra escola segue dando `undefined`, que vira `NAO_ENCONTRADO`.
- Nenhum endpoint novo. Nenhum `escolaId` vem de corpo ou query. Nenhum `@Unscoped()`. Os ids seguem UUID. A camada de rede não foi tocada.

Teste de isolamento: presente e efetivo.
- Caso novo: `isolamento: a coordenação de A que desativa a pessoa de B, com o ano de B travado pela virada dele…` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/api/test/ciclo-de-vida.int.test.ts`).
- Prova mental: tirei o `eq(anoLetivo.escolaId, …)`. A transação de A pediria `FOR SHARE` no ano de B, que já está em `FOR NO KEY UPDATE`, e receberia `55P03` com o `lock_timeout` de 1s no lugar de `NAO_ENCONTRADO`. O teste quebra.
- O mesmo caso compara a resposta com a de um `randomUUID()` na mesma condição, então também cobre a regra 10, item 6.
- O teste de isolamento da 1ª rodada no repository continua no arquivo.

Resposta igual para inexistente e para outra escola: o professor pendente, o aceito com convite revogado e o já desativado respondem todos `NAO_ENCONTRADO`, igual ao id inexistente. A 3ª e a 4ª prova do caso do pendente comparam isso diretamente. A diferença entre "à espera" e "não ativável" só aparece dentro da própria escola, e não confirma id de outra escola.

Bloqueantes: nenhum.

Recomendações:
- `#conviteAceitoAEspera` é uma cópia manual da condição do `ativarPorConvite` e do `usuarioComConviteAceito` (`apps/api/src/sessao/convite/convite.repository.ts`). Hoje nada impede que as três se afastem. Vale um teste de guarda que compare as três condições, inclusive o `eq(convite.escolaId, …)`.
- O `eq(convite.escolaId, requireEscolaId())` da :232 ficou sem bloco de mutação, com a justificativa de que a FK composta `convite_usuario_da_escola_fk` já garante isso. Isso é aceitável como segunda camada. Se a FK mudar, porém, nenhum teste avisa.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-03 18:43:17 · `tasks/prd-onboarding-por-convite/3_task.md`

VEREDITO: APROVADO

Esta é a 3ª rodada. Auditei o diff de `55c2ee43` a `ecae5b3d` e o que ele afeta. A 1ª rodada não exigiu correção, então não havia nada a conferir.

Campos pessoais tocados: nenhum campo novo e nenhuma migration. O diff muda como o `desativar` escolhe quem ele alcança e como grava o `usuario.desativado_em`, que agora usa `clock_timestamp()`. Também acrescenta a leitura de `convite.usado_em` e `convite.revogado_em` em `#conviteAceitoAEspera`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts:226`. Os vínculos do aluno continuam sendo encerrados por pessoa, sem nenhum campo proibido.

Fora da tabela de dados do docs/lgpd.md: nada. A linha "Vínculo, estado e datas" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/docs/lgpd.md` agora diz que a desativação encerra os vínculos, no ano em curso e no planejado, por `desligamento`, e que o prazo de 60 meses corre a partir daí.

Autorização por objeto: ok.
- **Escola:** o `#conviteAceitoAEspera` e o `update` do `desativar` filtram por `requireEscolaId()` e pelo usuário da própria linha. Nada vem do cliente.
- **Mesma resposta:** "não encontrado" e "sem permissão" respondem igual. O professor pendente e o id inexistente recebem o mesmo `NAO_ENCONTRADO` (`ciclo-de-vida.service.ts:207`, coberto por teste). A coordenação de A que desativa a pessoa de B também recebe o mesmo `NAO_ENCONTRADO` que um id aleatório, inclusive com o ano de B travado, sem esperar e sem `55P03`. Assim o tempo de resposta não revela que o id existe.
- **Troca de id na URL:** testei mentalmente. O convite aceito de outra pessoa da escola não transforma o pendente em "à espera" (há teste e mutação para isso).

Logs: limpos. Não há `logger` nem `console` em `ciclo-de-vida.service.ts` nem em `ciclo-de-vida.repository.ts`, e um teste confere isso. O teste do caminho feliz agora prova que a auditoria não contém o nome do professor, além de não conter `@`.

Auditoria: presente.
- O `usuario.desativado` também é gravado na desativação de quem aceitou o convite e ainda não entrou, com o autor da coordenação (verificado no caso [I]).
- O `convite.revogado` continua no caminho de defesa.
- Quando o `desativar` é recusado, nenhum registro é gravado, e o teste mostra a auditoria inalterada.

Correção de segurança que melhora a regra 20, item 18: com `clock_timestamp()` gravado depois da trava, o `desativado_em` fica posterior a todo aceite confirmado. Com isso, o bilhete do aceite não devolve o acesso que a escola tirou. Os casos B e D provam isso em corrida.

Envio externo: nenhum.

Seed/fixture: sintético. As pessoas usam nomes como "Pessoa sintética …" e "Professor Sintético …", com e-mail `@escola.invalid`.

Pergunta de fechamento: o diff não muda o que o sistema guarda sobre o aluno nem para onde envia. O vínculo encerrado segue com motivo e data, e a auditoria registra a desativação com o autor. A resposta à secretaria continua a mesma da 1ª rodada.

Bloqueantes: nenhum.

Recomendações:
1. A condição "à espera" (usado, não revogado, `usado_em >= desativado_em`) está copiada em três lugares: `ciclo-de-vida.repository.ts:226`, `apps/api/src/sessao/convite/convite.repository.ts:132-134` (`usuarioComConviteAceito`) e o `ativarPorConvite`. Se uma cópia mudar e as outras não, alguém pode voltar a ser ativado. Hoje, os casos A, B e D e as mutações só cobrem o comportamento de ponta a ponta. Vale um teste que compare as cópias ou uma origem única em `packages/core`.
2. Quando o `desativar` recusa o professor pendente, ele fica inativo e com o vínculo `pendente` até a eliminação (a retenção do vínculo pendente já está em `docs/lgpd.md`). Vale confirmar, na tarefa do `convite/revogar` ou do expurgo, que o pendente com convite revogado entra no `#eliminarPessoasDesativadas` dentro do prazo, para não ficar dado de professor sem finalidade.

## infra-guardian · 3ª rodada · APROVADO · 2026-11-03 18:43:38 · `tasks/prd-onboarding-por-convite/3_task.md`

VEREDITO: APROVADO
Caminho quente tocado: login
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum

As cinco correções exigidas na 2ª rodada foram feitas:

- **(a) Feita.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts`, o `desativar` grava ``desativadoEm: sql`clock_timestamp()` ``, depois da trava do usuário. O usuário que o aceite ativou enquanto a desativação esperava agora fica com `usado_em < desativado_em`. Com isso, o `ativarPorConvite` e o `usuarioComConviteAceito` passam a recusar o bilhete, porque os dois exigem `usado_em >= desativado_em`.
- **(b) Feita.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/ciclo-de-vida/ciclo-de-vida.service.ts`, no `#naTransacao`, a recusa do inativo vem logo depois do `travarUsuario` e antes do `travarConta`. A ordem invertida com o aceite (conta e depois usuário) acabou.
  - O que passa a desativar também o "à espera da primeira entrada" é uma ampliação vinda do diagnóstico do Arquiteto. Conferi essa ampliação.
  - Esse usuário já teve o aceite confirmado. Por isso nenhum aceite da mesma conta segura a conta esperando por ele: com a senha já gravada, o `definirSenhaNoAceite` não trava a linha.
  - O login que corre com a desativação (`AtivacaoPorConvite.ativar`) pega só a trava consultiva da escola e depois o usuário. A desativação não pede essa trava, então não há ciclo.
  - Se o convite for revogado entre a trava e o `update`, o `exists` do `update` devolve `undefined`, e a resposta é `NAO_ENCONTRADO`, com rollback.
- **(c) Feita.** O comentário do `revogarConviteAberto` e o docblock do service foram corrigidos e agora conferem com o código.
- **(d) Feita.** O teste "[P] desativar × aceite, a desativação começa antes" em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/api/test/ciclo-de-vida.int.test.ts` é o cenário exigido.
  - Ele monta a conta sem senha e outro convite válido da mesma conta em outra escola. A barreira fica no `update` do usuário pelo aceite, com a desativação já parada no `FOR SHARE` do ano.
  - Ele prova os três pontos: as duas transações terminam (zero `40P01`), `usado_em < desativado_em`, e o login com o bilhete dá 404 sem `usuario.ativado_por_convite`.
  - Vieram também a ordem inversa (caso C, recusa antes da conta, com prazo de 5 s que pega a espera na conta) e o caso de desativar enquanto o login ativa (caso D).
- **(e) Feita.** O `cenarios.md` (RF6) e a `techspec.md` §2 registram que o fechamento vem do `clock_timestamp()`.

Não rodei os testes de integração: os contêineres de teste em uso são compartilhados com outros andares. A auditoria desta rodada foi feita lendo o diff e o código que ele afeta.

Recomendações:
- A condição do "à espera" (`#conviteAceitoAEspera`) agora existe em três lugares: no repository do ciclo, no `ativarPorConvite` e no `usuarioComConviteAceito`. Um teste que compare as três, ou um único construtor da condição no `packages/core` usado pela API, evita que elas se separem sem ninguém notar.
- Na desativação do "à espera", o `desativado_em` antigo (da criação do convite) é sobrescrito pela hora da desativação. É o certo para o login, mas a retenção e o expurgo que contam a partir de `desativado_em` passam a contar dessa nova data. Vale registrar isso na linha do usuário em `docs/lgpd.md`.

## test-engineer · 3ª rodada · APROVADO · 2026-11-03 18:44:57 · `tasks/prd-onboarding-por-convite/3_task.md`

VEREDITO: APROVADO

**A correção exigida na 2ª rodada foi feita, pela opção (a).** Agora o `desativar` alcança o professor que aceitou o convite e ainda não entrou, e há teste para isso.
- **O que mudou no código.** O `desativar` atende quem o login ainda ativaria: o ativo e o à espera da primeira entrada. O à espera é o professor que aceitou com a conta que já tinha senha e ainda não entrou.
  - A condição é a mesma do `ativarPorConvite`: convite usado, não revogado e `usado_em >= desativado_em`. Ela também bate com o `aceito` do `estadoDoProfessor`.
  - O `desativado_em` passa a ser gravado com `clock_timestamp()`, depois da trava do usuário.
  - O inativo que o login não ativaria é recusado antes do `travarConta`.
- **Os documentos foram corrigidos.** `techspec.md:24` e a divergência no `3_task.md` agora descrevem o que o código faz. A divergência remete ao diagnóstico do Arquiteto (`.processo/ordens/diagnostico-3.md`), que aceita deixar a trava da escola fora do `desativar` e pôr o `clock_timestamp()` no lugar dela.
- **Os três itens pedidos existem:**
  - o teste "aceitou e não entrou: desativar e depois entrar; segue inativo e sem vínculo aberto" (caso A);
  - o [P] contra o `ativar` do login, com barreira (caso D);
  - os blocos de mutação.

Rodei os testes novos e não deu: o vitest parou antes de rodar teste nenhum, porque o pacote `@educa/core` não está compilado nesta árvore ("Failed to resolve entry"). Não compilei, porque isso escreveria na árvore que os outros revisores estão lendo. As mutações dependem da prova do portão, uma a uma.

**Cenários exigidos:**
- caminho feliz (ativo desativado, vínculos encerrados);
- à espera da primeira entrada: desativa, a lista diz `desativado` e o bilhete não reativa;
- inativo não ativável (pendente, convite revogado, já desativado) recebe `NAO_ENCONTRADO`;
- convite aceito de outra pessoa da mesma escola não faz do pendente um à espera;
- [P] `desativar` × aceite, nas duas ordens, sem `40P01`;
- [P] `desativar` × `ativar` do login;
- isolamento (outra escola recebe a mesma resposta do id inexistente, com o ano travado);
- permissão (rota da coordenação, sem mudança nesta rodada).

**Cobertos:**
- **Caso A** (à espera): `apps/api/test/ciclo-de-vida.int.test.ts:56`. Encerra os vínculos, a lista diz `desativado`, há auditoria, o login com o bilhete não ativa e um segundo `desativar` recebe `NAO_ENCONTRADO`.
- **Condição do à espera**: `:83` (pendente, convite revogado e convite de outra pessoa).
- **Caso B**: `:106`, com barreiras deterministas (ano travado, gatilho, `esperarNaTrava`). Afirma `usado_em < desativado_em` e que o bilhete não reativa.
- **Caso C**: `:155`.
- **Caso D**: `:189`.
- **Isolamento**: ganhou a comparação com um `randomUUID()` na mesma condição (`:240-242`).
- **Mutações**: cada cláusula nova tem bloco ou motivo escrito na seção nova do `3_task.md`.
  - Os motivos sem bloco são o `isNotNull(usadoEm)`, que o `gte` já cobre, o `escolaId` do `#conviteAceitoAEspera`, que a FK composta garante, e o `false` do `desligarContaExterna`.
  - Nenhum `.skip`, `.only` ou `todo` nos dois arquivos de teste.
  - Não há mock: tudo roda pelas rotas reais e pelo Postgres.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **O `or(...)` inteiro do `update` não tem prova.** Em `packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts`, no `desativar`, a cláusula é `or(isNull(desativadoEm), exists(#conviteAceitoAEspera()))`.
   - Cada lado tem o seu bloco. Mas remover o `or` inteiro sobrevive a todos os testes, porque o service já recusa o inativo não ativável antes de chegar ao `update`.
   - O docblock diz que a cláusula existe para o convite revogado entre a trava e o `update` (pelo `gerar` do operador), e essa corrida não tem teste.
   - O dano de faltar a cláusula é pequeno: desativa alguém que já estava perdendo o acesso.
   - Correção sugerida: um [P] dessa corrida, ou um item em "Sem bloco (motivo)" que diga que, fora dela, a cláusula é segunda camada.
2. **O bloco de mutação do caso D fica vermelho pelo motivo errado.** Ele usa a mesma mutação do caso A. Sem o `exists`, a desativação responde `NAO_ENCONTRADO` e nunca chega ao gatilho, então o cenário não alcança a corrida.
   - Não bloqueia, porque a cláusula já está provada pelo bloco do caso A, e o texto do bloco diz isso.
   - O que o D protege de fato é o `ativarPorConvite` atômico, que é código da A1 (`apps/api/src/sessao/convite/convite.repository.ts:140`). Um bloco que trocasse aquele `update` condicional por "lê e depois grava" mostraria o valor próprio do D.
3. **O caso C usa um prazo de 5 s com relógio de verdade** (`ciclo-de-vida.int.test.ts:175`). O caminho certo termina em milissegundos, então o teste não depende de máquina folgada. Mesmo assim, trocar o `setTimeout` por uma espera determinista seria melhor. Exemplo: `esperarNaTrava` sobre o `FOR NO KEY UPDATE` da conta, disputado com o desfecho da desativação.
4. **O nome do teste da condição promete mais do que o corpo prova.** O nome em `ciclo-de-vida.int.test.ts:83` e a linha da tabela no `3_task.md` dizem "e o desativado", mas o corpo exercita só o pendente e o revogado. Quem prova o já desativado é a última linha do caso A (`:80`). Tirar "o desativado" do nome, ou acrescentar o caso ao corpo.
5. **No caso B, o comentário da linha 112 não tem asserção.** Ele diz que a desativação não limpa a conta, mas nada confere isso, e o 404 da linha 150 não distingue "não reativou" de "conta limpa". A mutação para `now()` já foi provada, então não bloqueia. Uma asserção de que a conta mantém a `senha_hash` deixaria o motivo explícito.
