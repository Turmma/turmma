# Achados das revisões — `tasks/prd-onboarding-por-convite/10_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-04 08:12:04 · `tasks/prd-onboarding-por-convite/10_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova e nenhuma migration nesta tarefa. A tarefa escreve em tabelas que já existiam: `lista_nome` (tem `escolaId` e `anoLetivoId`), `vinculo` (tem `escolaId` e `anoLetivoId`), e `usuario`, `credencial_matricula` e `sessao` pelo `desativar` da 3.0. Os ids seguem UUID. A camada rede não é tocada. Nenhum `@Unscoped()` foi adicionado.

Queries verificadas:
- `ListaRepository.daVirada` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/lista.repository.ts:378`): a escola vem de `requireEscolaId()` e é aplicada à credencial, ao `exists` do vínculo e ao `notExists` da `lista_nome`. O join do usuário prende a escola da credencial. O `anoLetivoId` vem do `ano` que o motor já conferiu, nunca do cliente.
- `ListaRepository.retirarNomes` (`lista.repository.ts:416`): o delete leva `l.escola_id = requireEscolaId()` e `l.ano_letivo_id`, e só apaga se o estado e a turma forem os que a planilha leu.
- `ListaRepository.inserirAprovados` (`lista.repository.ts:432`): a escola vem do contexto. O `usuarioId` e o `turmaId` saem de leituras que já têm escopo (`daVirada` e as turmas do ano).
- `ImportacaoRepository.alunosDaVirada`, `retirarNomes` e `inserirAprovados` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/importacao.repository.ts:462`, `:478`, `:487`): todos chamam `requireEscolaId()`, e o autor vem de `requestIdentity()`.
- `CicloDeVidaRepository.travarAnosDosVinculos`, chamado pelo novo `travar` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipos/alunos.ts:1017`: tem o escopo `anoLetivo.escolaId = requireEscolaId()`.
- `ciclo.desativar(usuarioId, {}, tx)`: o `travarUsuario` da 3.0 acha só o usuário da escola do contexto.
- As marcas `desligar` são o único id que vem do corpo. Elas são conferidas duas vezes contra candidatos lidos com escopo: no gravar (`motor.ts:99`, que dá `ENTRADA_INVALIDA`) e no job (`desligamentosDe`, que dá `desatualizada`). O id de outra escola recebe a mesma resposta que um id que não é candidato.
- O erro de linha `aluno_desativado` só aparece para matrícula da própria escola. A matrícula de outra escola dá `entra`, então a resposta não revela que ela existe lá.

Teste de isolamento: presente e efetivo. Os casos estão em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/test/desligamento-pela-planilha.int.test.ts`:
- Linha 833: sem `eq(credencialMatricula.escolaId, escolaId)` em `daVirada`, a matrícula da escola B passaria a "voltar" na escola A, e o teste quebra. A mutação declarada nesta tarefa cobre essa cláusula.
- Linha 854: sem `l.escola_id` em `retirarNomes`, a chamada feita no contexto da A apagaria o nome da B, e o teste quebra. O caso tem controle positivo e confere também o ano.
- Linha 872: confirma que a B fica como estava depois do desligamento na A.

Bloqueantes: nenhum.

Recomendações:
1. No teste da linha 404 (ou no da linha 872), incluir em `marcas.desligar` um id de aluno aprovado da escola B e esperar `ENTRADA_INVALIDA`, igual ao do id inexistente. Hoje essa recusa só está provada para ids da própria escola. A conferência das marcas vem da 8.0 e da 9.0, mas é ela que impede o `desativar` de receber id de outra escola.
2. No caso de `daVirada` com a escola trocada (linha 841), incluir também `b.desativado` e `b.jaTem`. Isso prova que o erro `aluno_desativado` e o "já existe" não vazam da B para a planilha da A, e não só o aluno que volta.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-04 08:12:10 · `tasks/prd-onboarding-por-convite/10_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A tarefa 10.0 não grava nem lê `Nota`, `Correcao` ou `lancadaPor`. Procurei por nota, `lancadaPor`, IA, tutor e sugestão no diff inteiro e não há nada. Como não há caminho novo, a pergunta "todos com autor humano?" não se aplica.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. Nenhuma saída de IA entra nesta tarefa.
Supervisão do tutor: ok. A tarefa não toca o tutor.
Autonomia declarada e visível: a tarefa não cria agente nem muda a autonomia de nenhum, então não há o que conferir.
Bloqueantes: nenhum

Por que a trajetória do aluno não é decidida pelo sistema (item 2 da regra 70):

- **Desligamento.** Só acontece com a marca explícita da coordenação.
  - O filtro `marcados.has(id)` fica em `packages/core/src/importacao/tipos/alunos.ts:962`, no `planoDe`, e também no `travar`, em `alunos.ts:1028` (linhas contadas no diff).
  - A marca que não acha mais o candidato é diferença e fecha a importação `desatualizada` (`desligamentosDe`, `alunos.ts:895`).
  - O teste `o ausente sem marca segue ativo…` prova que, sem a marca, nada muda.
- **Virada de ano ("volta").** A turma de destino é a que a planilha da escola diz. O sistema não deduz série, aprovação nem retenção a partir do ano anterior: o aluno retido que a planilha põe de novo no 8A vai para o 8A.
  - A volta não pede marca, mas entra na assinatura que a coordenação viu na prévia (`assinaturaDe`, com o `volta`). Se a assinatura mudar, o job sai `desatualizada` (`packages/core/src/importacao/motor.ts:256`).
  - O aluno desativado não volta sozinho: vira o erro `aluno_desativado`, e a coordenação decide fora da planilha.
- **Autoria humana do job.** O passo (3) roda com quem gravou a planilha como autor (`comAutora(autor, …)`, `motor.ts:257`). Se essa pessoa já foi eliminada, a importação fecha `desatualizada` (`motor.ts:252`). Por isso `usuario.desativado`, `vinculo.encerrado`, `vinculo.criado` e `lista_nome.retirado` sempre têm uma pessoa como autora. Os testes da auditoria em `apps/worker/test/desligamento-pela-planilha.int.test.ts` (linhas 364 e 761) conferem isso.
- **Itens 7 e 9.** Não há inferência de comportamento, contagem de uso nem indicador de professor. A auditoria `lista_nome.retirado` guarda só a turma e o estado (`packages/core/src/auditoria/acoes.ts`), sem nome.

Recomendações:
- **Sobre a virada:** vale um teste curto, unitário em `alunos.test.ts`, que prove que o destino da "volta" sai só da coluna turma da linha e nunca da série do vínculo do ano anterior. Assim a ausência de "promoção automática" fica escrita como regra testada, e não só como efeito do código atual. Não bloqueia: hoje o código não tem nenhum caminho que derive a série.
- **Sobre `docs/regulacao.md`:** não mudou, e não precisava, porque a tarefa não cria superfície regulatória nova. Quando a 13.0 trouxer a tela das marcas, confira se a prévia deixa claro à coordenação que "volta" e "desligar" são escolha dela.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipos/alunos.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/motor.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/lista.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/auditoria/acoes.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/test/desligamento-pela-planilha.int.test.ts

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-04 08:13:05 · `tasks/prd-onboarding-por-convite/10_task.md`

VEREDITO: APROVADO

A tarefa 10.0 passa na regra 20. Não achei nenhum bloqueante e ficam duas recomendações.

**Campos pessoais tocados:** nenhum campo novo. A tarefa só escreve em tabelas que já existem:
- `lista_nome`: apaga o nome não aprovado e grava a linha `aprovado` do aluno que volta. Essa linha leva só o estado e o usuário, sem nome nem matrícula.
- `vinculo`: cria o vínculo da volta.
- `usuario`: muda pelo `desativar` da 3.0, que já existia.

O resumo ganhou `voltam`, `desligados` e `retirados`, que são só contagens.

**Fora da tabela de dados do docs/lgpd.md:** nada. A linha "Lista de nomes da turma" (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/docs/lgpd.md:84`) foi atualizada nesta mesma tarefa. Ela descreve a retirada pela marca da coordenação, com o pedido encerrado antes e a auditoria só com id, turma e estado, e também a linha `aprovado` do ano planejado. A retenção que já valia cobre as duas.

**Autorização por objeto:** ok.
- O que a coordenação marca é conferido contra os candidatos lidos no escopo da escola: `desligamentosDe` em `packages/core/src/importacao/tipos/alunos.ts:892`, e `ENTRADA_INVALIDA` no gravar.
- `daVirada`, `retirarNomes` e `inserirAprovados` (`packages/core/src/estrutura/lista.repository.ts:391`, `:429`, `:445`) tiram a escola do contexto e não recebem `escolaId` como argumento. O `delete` em SQL cru filtra `escola_id`, `ano_letivo_id`, estado e turma lidos.
- Fiz o teste de trocar o id: a matrícula da escola B na planilha da A dá "entra", e os ids da B no contexto da A não apagam nada. Há três testes de isolamento em `apps/worker/test/desligamento-pela-planilha.int.test.ts`, e quebrar o escopo da credencial derruba um deles, conforme o registro de mutações da tarefa.

**Logs:** limpos. A tarefa não adiciona nenhum log.

**Auditoria:** presente.
- `lista_nome.retirado` aceita só `{turmaId, estado}` (`packages/core/src/auditoria/acoes.ts:336`).
- `usuario.desativado`, `vinculo.encerrado` e `vinculo.criado` da volta registram a coordenação como autora.
- Os testes buscam o nome e a matrícula no texto da auditoria e não os acham.

**Envio externo:** nenhum.

**Seed/fixture:** sintético. Os nomes são do tipo "Aluno Que Volta" e "Nome Livre Ausente", com matrícula gerada por prefixo e contador e `hash-sintetico` no lugar da senha.

**Demais itens do checklist:**
- **DTO de saída:** a prévia continua devolvendo `{id, acao, rotulo}` dos candidatos. O erro `aluno_desativado` sai só como código, e um teste garante que a matrícula não aparece na prévia.
- **Sessões e login do desligado:** o desligado tem as sessões derrubadas com o motivo `desativacao` e a senha apagada, e não entra mais por matrícula. Há teste para cada um (regra 20, item 18).
- **Pergunta de fechamento:** o código responde. A eliminação apaga todas as linhas de `lista_nome` do usuário, inclusive a nova do ano planejado (`packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts:378-383`). A leitura do titular lê `lista_nome` por `usuario_id` (`packages/core/src/titular/leitura-do-titular.ts:139`), então também alcança a linha nova. Nada é enviado para fora.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **A volta não olha a eliminação agendada.** O filtro de `daVirada` (`packages/core/src/estrutura/lista.repository.ts:406`) e o de `linhaDeQuemTemConta` (`packages/core/src/importacao/tipos/alunos.ts:788`) só olham `desativadoEm`, e não `eliminacaoAgendadaEm`. Se a família pediu a eliminação de um aluno e o pedido está na carência, a planilha do ano planejado o faz "voltar": ganha vínculo e aparece na turma nova até a eliminação rodar. A eliminação apaga tudo depois, então não sobra nada; a transferência da 9.0 tem a mesma lacuna. Mesmo assim, a escola trataria de novo o dado de quem pediu para sair. Sugiro tratar o suspenso como o desativado: erro de linha, ou `aluno_desativado` com outro código. Pode ser nesta tarefa ou numa futura, registrada no `TODO.md`.
2. **Uma frase confusa na tarefa.** A divergência da linha 78 de `tasks/prd-onboarding-por-convite/10_task.md` diz que a planilha seguinte que traz o desligado "é erro de linha". O código e o `cenarios.md` dizem outra coisa: quando o desligado ainda tem linha no ano, a matrícula segue "já existe". Vale reescrever a frase para a validação e a retro não lerem uma regra que o código não aplica.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-04 08:13:55 · `tasks/prd-onboarding-por-convite/10_task.md`

VEREDITO: APROVADO

Caminho quente tocado: fila (passo (3) do job `estrutura.gravar-planilha`, que trava as turmas contra o gerar acesso e a decisão em sala)

Rate limit: ok (a tarefa não mexe em rota; o semáforo da planilha por escola e o limite de 20 por minuto continuam como estavam)

Fila e prioridade: ok. O job continua na fila `normal` com escopo `escola`, e o limite de concorrência por escola continua valendo. O trabalho novo (desligar, retirar nomes, a volta do aluno) roda no worker, dentro da transação do passo (3), com `lock_timeout` de 1 s e `statement_timeout` de 1,5 s. A prévia, que roda no request, ganhou uma consulta só, e só no ano planejado.

Concorrência: protegida.
- O aluno a desligar e o que volta são travados (`travarUsuarios`) antes do `planejar`. O `planejar` classifica de novo sob a trava e confere a assinatura.
- Os nomes saem da lista por `delete` condicional ao estado e à turma que a planilha leu, e o pedido pendente é encerrado antes de o nome sair.
- O `NAO_ENCONTRADO` do `desativar` vira `desatualizada`.
- Cada corrida tem teste [P] em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/test/desligamento-pela-planilha.int.test.ts`. Rodei o arquivo: 27 de 27 passaram.

Índice e paginação: ok. Rodei `EXPLAIN` da consulta `daVirada` no banco de teste:
- a matrícula é achada pelo índice `(escola_id, matricula)`;
- o vínculo aberto, pelo `vinculo_ativo_unico`;
- a busca de linha `aprovado` na lista, pelo `lista_nome_turma_idx`, por `(escola_id, ano_letivo_id, estado)`.

Todas começam pela escola. As escritas vão em lotes de 500, e há teste com 501 nomes retirados e com 501 alunos que voltam.

Degradação de IA: não se aplica

Migration: não se aplica

Métrica e alerta: ok. O passo (3) e o resultado do job já são medidos pelo motor, com o alerta "passo (3) acima de 1 s" e o runbook dele. A tarefa não cria alerta novo.

Bloqueantes: nenhum

Recomendações:
1. **Desligar muitos alunos de uma vez pode prender as turmas em horário de aula.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipos/alunos.ts:606-615`, o desligamento chama o `desativar` um aluno por vez dentro do passo (3). São uns 12 comandos e várias auditorias por aluno, com as turmas do ano em curso travadas o tempo todo. A lista de marcados não tem teto (`packages/shared/src/importacao/contratos.ts:103`), e o job é urgente, então pode rodar às 10h. Com dezenas de marcados, a transação passa de 1 s: dispara o alerta e segura o gerar acesso e a decisão em sala daquela escola. Proposta: incluir no cenário da 16.0 uma planilha com 100 a 300 marcados para desligar, medindo o passo (3). Se passar de 1 s, pôr um teto nas marcas ou agrupar os comandos.
2. **A virada da escola inteira grava uma auditoria por aluno, em sequência.** Em `alunos.ts:645-647`, cada aluno que volta gera um `vinculo.criado`, um de cada vez. Com 900 alunos voltando, o passo (3) deve passar do alerta de 1 s. O efeito é menor, porque as turmas travadas são as do ano planejado, mas vale medir no mesmo cenário da 16.0.
3. **As travas dos anos podem ir num comando só.** Em `alunos.ts:602`, `travarAnosDosVinculos` roda uma consulta por aluno desligado, e dá para fazer como já se faz com as turmas. O ano de destino também é travado antes dos outros, fora da ordem de id. Contra o `FOR NO KEY UPDATE` da virada do ano isso pode dar `40P01`. O job tenta de novo, mas quem pode receber o erro é a requisição da virada. O risco é baixo, porque a virada acontece uma vez por ano, e o padrão é o mesmo da planilha de professores. Fica registrado para a retro.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-04 08:13:56 · `tasks/prd-onboarding-por-convite/10_task.md`

VEREDITO: REPROVADO

Cenários exigidos:
- Caminho feliz: o aprovado marcado é desligado e o não aprovado marcado sai da lista.
- O ausente sem marca segue ativo.
- O desligado não entra por matrícula, e as sessões dele caem.
- O pedido pendente do nome que sai fica `encerrada`, e o recusado antigo fica como estava.
- A mesma marca duas vezes desliga uma vez só.
- Marca de quem a planilha não deixa ausente é recusada (é o caso de permissão).
- Mais de um lote (501 nomes, 501 voltas).
- Virada de ano: o aluno do ano anterior volta com o mesmo login, e os vínculos dos outros anos não mudam.
- Na virada, o aluno desativado é erro na linha; no ano em curso não existe virada.
- A planilha da virada gravada de novo não muda nada.
- Auditoria sem nome nem matrícula.
- Concorrência com o passo (3) parado: reivindicação, troca de turma à mão, decisão do pedido nas duas ordens, desativação à mão entre o (2) e o (3), coordenação desativando e eliminando ao mesmo tempo, usuário preso por outra transação.
- A ordem global das travas.
- Isolamento: na prévia, na consulta da virada, no `retirarNomes` e no job inteiro.

Cobertos: as 14 linhas da tabela "Testes que provam a regra" têm o teste citado pelo nome em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/test/desligamento-pela-planilha.int.test.ts`. As linhas com dois itens têm os dois testes: 504 e 528, 567 e 595. Os [P] são corridas de verdade, com `WriteBlockTrigger`, `esperarNaTrava` e transação parada, e não chamadas em sequência. Não há `.skip`, teste comentado nem IA. Rodei o arquivo de integração (27 de 27 verdes) e `packages/core/src/importacao/tipos/alunos.test.ts` (29 de 29 verdes). A lista `--faltando` (14 linhas) bate com os motivos do documento, menos o que vai abaixo.

Bloqueantes:
1. **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/lista.repository.ts:186`, `ne(vinculo.estado, 'encerrado')` sem bloco e com motivo falso.**
   - O motivo (3) diz que essa cláusula é equivalente, porque "o vínculo encerrado no ano de destino sem outro aberto só existe no aluno desativado".
   - O próprio teste desmente isso: o `reentra` (linhas 667-668 do teste) é aluno ativo com vínculo `encerrado` no planejado, e precisa voltar.
   - Sem a cláusula, ele vira `comVinculo: true` e sai "já existe". O teste da linha 682 espera `voltam: 2` e ficaria vermelho.
   - A ferramenta não acusou porque a linha 186 já é alcançada pelo bloco do `anoLetivoId`.
   - Correção: tirar o motivo (3) e pôr um bloco que remove `ne(vinculo.estado, 'encerrado')`, citando `o aluno do ano anterior "volta" com o mesmo login`.
2. **`lista.repository.ts:265`, o `where` do `delete` de `retirarNomes` sem nenhum bloco.**
   - As quatro cláusulas são novas: `l.escola_id = ${requireEscolaId()}`, `l.ano_letivo_id = ${anoLetivoId}`, `l.estado = v.estado_lido` e `l.turma_id = v.turma_lida_id`.
   - A primeira é a cláusula de escopo de tenant de um `delete` (regra 10, item 3, e regra 40, item 1). Ela está dentro de um template `sql` que o `--faltando` não lê, e o documento não dá motivo para nenhuma das quatro.
   - Os testes que pegariam cada uma já existem. Correção: um bloco por cláusula:

     | Cláusula removida | Teste citado no bloco |
     |---|---|
     | `l.escola_id` | `isolamento dos métodos do desligamento` (linha 854) |
     | `l.ano_letivo_id` | o mesmo teste, que já confere o ano planejado |
     | `l.estado` | `[P] a reivindicação parada no nome livre ausente` (linha 467) |
     | `l.turma_id` | `[P] o nome livre levado à 8B à mão` (linha 493) |

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipos/alunos.ts:489`, `if (voltas.length === 0) return`: é equivalente, porque `criarVinculosDosAlunos` e `inserirAprovados` não entram no laço com a lista vazia. Mas nenhum motivo cita essa linha. O motivo (5) cita "o `volta !== undefined`", e essa condição tem bloco. Ajustar o texto.
- Os motivos (6), o `NAO_ENCONTRADO` virando `desatualizada` (`alunos.ts:459`), e (7), o `volta` na assinatura (`alunos.ts:265`), dizem "sem bloco". Só que os testes de unidade em `packages/core/src/importacao/tipos/alunos.test.ts:364` e `:312` matam essas mutações. Vale declará-los como blocos em vez de motivo.
- `alunos.ts:602`, a trava dos anos dos vínculos no `travar`: não é condição e a ferramenta não a lista, mas é o coração da ordem global. Pôr um bloco que remove a linha, citando `o passo (3) trava, nesta ordem…` (linha 595 do teste). Sem a linha, a trava dos anos só aparece pelo `desativar`, depois da de usuários, e a asserção de ordem fica vermelha.
- O teste da linha 340 prova o "não entra por matrícula" pelo `CredencialMatriculaRepository.doAlunoAtivo`, e não pela rota de login. Um login de verdade daria a prova completa do RF5.
- O teste da linha 816 prova só que o job espera na trava do usuário (pelo padrão da consulta); o resultado final seria igual sem a trava. A consequência da trava já é coberta pelo teste da linha 801. Fica como está, mas o nome poderia dizer isso.

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-04 08:13:56 · `tasks/prd-onboarding-por-convite/10_task.md`

VEREDITO: REPROVADO

Escopo: respeitado

Aderência à Tech Spec: divergência em `techspec.md` §5, "O job", passo (3) (a ordem global das travas)

Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)

**Bloqueantes:**

1. **A trava nova está só no documento da tarefa, não na Tech Spec.**
   - Onde: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/techspec.md:94`, conferido contra `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipos/alunos.ts:599-602` e contra `10_task.md:80`.
   - O que está errado: na planilha de alunos, o passo (3) agora trava os anos dos vínculos de cada aluno marcado para desligar (`travarAnosDosVinculos`), antes dos usuários. O teste `o passo (3) trava, nesta ordem…` cobra essa trava como uma etapa própria. A Tech Spec ainda diz `o ano (FOR SHARE; na de professores, o dos vínculos de todo marcado)`, ou seja, só a planilha de professores trava esses anos. A tabela de divergências da tarefa (linha do `travar` recebendo a `tx`) diz que isso está em "`techspec.md` §5 'O job' passo (3)", mas esse trecho não foi alterado no diff. A ordem global é o contrato que o `desativar`, o `eliminar` e o `infra-guardian` seguem. Divergência que existe só no `N_task.md` é bloqueante.
   - Correção exigida: no passo (3) da `techspec.md`, trocar o parêntese por `na de professores, o dos vínculos de todo marcado; na de alunos, o dos vínculos de todo aprovado marcado para desligar`. Se o `cenarios.md` descreve a ordem do espião, ajustar lá também.

**Recomendações:**

- `alunos.ts:599-602` e `professores.ts:183-184`: o `travarAnosDosVinculos` roda uma vez por aluno desligado, dentro da transação curta do (3). Numa planilha de fim de ano com centenas de desligados, uma única consulta que trave a união dos anos, em ordem de id, encurta o tempo que as turmas ficam presas. É área do `infra-guardian`; fica como nota.
- `lista.repository.ts`, `retirarNomes`: o nome `retiradas_`, com sublinhado no fim para não colidir com o parâmetro, é pouco legível. Algo como `apagadas` resolve.
- `alunos.ts`, `voltar`: o `turmaDe.get(usuarioId) ?? ''` é um fallback que nunca acontece. Se acontecesse, gravaria `turmaId: ''` e só falharia no zod da auditoria. Melhor lançar `InvariantException` quando o id não estiver no mapa.
- `10_task.md`, "Mutações": os motivos estão fora de ordem, (10), (12), (11). Vale renumerar.
- `10_task.md:78`: a frase "a planilha seguinte que o traz é erro de linha" vale só para a planilha do ano planejado. No ano em curso, o desligado que ainda tem a linha `aprovado` aparece como "já existe" (`paraReimportar` filtra quem está desativado). O `cenarios.md` já diz isso certo; o texto da tarefa deveria dizer o mesmo.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-04 09:34:22 · `tasks/prd-onboarding-por-convite/10_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

Fiz a única correção exigida na 1ª rodada. O passo (3) em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/techspec.md:94` agora traz "na de alunos, o dos vínculos de todo aprovado marcado para desligar", com o texto que eu tinha pedido. O `cenarios.md` não precisou mudar. Ele cita a ordem do espião em três lugares (linha 78, "Desligamento"; linha 132, a corrida do professor; e a tabela "Corridas", linha 211): importação, ano, usuários, contas, turmas, pedidos. Nesse nível, "ano" já inclui os anos dos vínculos, e nenhum dos três diz qual ano trava em cada planilha.

As quatro recomendações da 1ª rodada também foram feitas:
- **Nome da variável:** `retiradas_` virou `apagadas`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/lista.repository.ts:262`.
- **Fallback trocado por erro:** o `?? ''` do `turmaDe.get` deu lugar a um `InvariantException`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipos/alunos.ts:493-494`. O import já existia, e o motivo "Sem bloco" (4) diz por que esse caminho nunca é alcançado.
- **Motivos renumerados:** agora vão de (1) a (9), em ordem. Os motivos que perderam o lugar ganharam bloco de mutação: o `ne(... 'encerrado')`, as quatro cláusulas do `delete` de `retirarNomes`, o `NAO_ENCONTRADO` do `desativar`, o `volta` na assinatura e o `travarAnosDosVinculos`.
- **Frase do `aluno_desativado`:** foi reescrita em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/10_task.md:78`. Agora separa o ano planejado do ano em curso e diz que `alunosParaReimportar` deixa o aluno desativado de fora.

O diff também acrescenta testes dentro do escopo da tarefa. No isolamento, o id de outra escola nas marcas é recusado, e a prévia da escola A não reconhece as matrículas de quem volta, do desativado e de quem já tem linha na B. Há ainda um teste de unidade que mostra que a turma de quem volta vem só da coluna turma da linha.

Recomendações:
- A seção "Revisões" do `10_task.md` se perdeu quando o documento foi reescrito. O histórico continua em `achados/10_task.md`, e o hook vai registrar esta rodada como 1ª. Vale conferir, na validação, se a numeração das rodadas ficou coerente entre os dois arquivos.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-04 09:34:43 · `tasks/prd-onboarding-por-convite/10_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A tarefa 10.0 e o diff desta rodada não gravam nem leem `Nota`, `Correcao` ou `lancadaPor`. Todos com autor humano? Não se aplica, porque não há caminho novo de escrita.

Decisão autônoma sobre aluno: ausente. A turma de quem volta continua vindo só da coluna turma da planilha, e agora há teste que prova isso (detalhe abaixo).

Aprovação registrada: ok. Nenhuma saída de IA entra nesta tarefa.

Supervisão do tutor: ok. A tarefa não toca o tutor.

Autonomia declarada e visível: a tarefa não cria agente nem muda a autonomia de nenhum, então não há o que conferir.

Bloqueantes: nenhum.

**A recomendação da 1ª rodada foi feita.**
- O teste novo está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipos/alunos.test.ts:348`.
- Dois alunos que voltam, um na linha 9A e outro na linha 8A, vão cada um para a turma que a própria linha diz (`t2` e `t1`).
- Rodei o arquivo: 30 de 30 testes verdes.
- A garantia vai além do teste e está no próprio desenho. O que a consulta da virada devolve para cada aluno é `AlunoDaVirada` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/lista.repository.ts:46`). Esse tipo só tem `usuarioId`, `matricula`, `desativado` e `comVinculo`, sem turma nem série do ano anterior. Assim, o `voltar` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipos/alunos.ts:479`) não tem de onde tirar aprovação ou retenção: o destino vem só da linha.

**O resto do diff não afeta a regra 70.**
- `alunos.ts:493-494`: o `?? ''` do `voltar` virou `InvariantException`. A auditoria `vinculo.criado` não pode mais ser gravada com a turma vazia, e a autoria continua sendo de quem gravou a planilha.
- Testes de isolamento a mais (marca de outra escola, matrícula da B na prévia da A), um nome de variável trocado em `retirarNomes` e mudanças em texto e documentação.
- A Tech Spec foi atualizada com a trava dos anos dos vínculos de quem é desligado pela planilha de alunos. Isso é ordem de trava; não muda a trajetória do aluno.

**Os outros itens da regra 70 não mudaram.**
- O desligamento continua exigindo a marca da coordenação.
- O aluno desativado continua sendo erro na linha da virada, sem voltar sozinho.
- A auditoria `lista_nome.retirado` guarda só a turma e o estado.
- Não há inferência de comportamento nem indicador de professor.
- `docs/regulacao.md` não mudou e não precisava.

Recomendações:
- O nome do teste novo fala em "o aluno da mesma turma do ano anterior", mas o teste não monta nenhuma turma anterior, porque o tipo nem a guarda. Vale reescrever para "o destino vem só da coluna turma; a virada não conhece turma nem série do ano anterior", para o nome dizer o que o teste prova.
- Continua valendo a da 1ª rodada para a 13.0: a tela das marcas precisa deixar claro à coordenação que "volta" e "desligar" são escolha dela. Já está na tabela de recomendações sem aplicar da tarefa.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/.processo/ordens/10_task-diff-r2.diff`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipos/alunos.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipos/alunos.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/lista.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/achados/10_task.md`

## infra-guardian · 2ª rodada · APROVADO · 2026-11-04 09:34:56 · `tasks/prd-onboarding-por-convite/10_task.md`

VEREDITO: APROVADO
Caminho quente tocado: fila (passo (3) do job `estrutura.gravar-planilha`; o diff desta rodada não muda nenhuma trava, consulta ou rota)
Rate limit: ok (nenhuma rota tocada)
Fila e prioridade: ok (sem mudança desde a 1ª rodada)
Concorrência: protegida. O `voltar` agora lança `InvariantException` quando falta a turma de um vínculo criado, em vez de gravar `turmaId: ''` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipos/alunos.ts:493-494`). A exceção sai dentro da transação do passo (3), então o passo inteiro é desfeito. Esse caminho não é alcançável.
Índice e paginação: ok (nenhuma consulta nova; o `retirarNomes` só teve a variável renomeada)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (nenhum alerta novo; o passo (3) continua medido pelo motor)
Bloqueantes: nenhum

Rodei os dois arquivos de teste da tarefa e todos passaram:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipos/alunos.test.ts`: 30 de 30. Inclui o teste novo de que a turma de quem volta vem só da coluna da linha.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/test/desligamento-pela-planilha.int.test.ts`: 27 de 27. Inclui as marcas de outra escola recusadas com `ENTRADA_INVALIDA` e as matrículas `desativado` e `jaTem` da B, que dão `entra` na planilha da A.

As correções que o test-engineer e o revisor-geral exigiram estão no diff:
- os quatro blocos do `where` do `retirarNomes`;
- o bloco do `ne(vinculo.estado, 'encerrado')`, com o motivo falso retirado;
- a ordem dos anos na planilha de alunos, no passo (3) da `techspec.md`.

Recomendações:
1. As minhas duas recomendações da 1ª rodada estão em "Recomendações sem aplicar", com destino "Tarefa 16.0" e "TODO.md", mas nenhum dos dois arquivos foi atualizado. Faltam:
   - a medida de 100 a 300 desligamentos e da virada de 900 alunos, que não está no `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/16_task.md` (a linha 49 cobre só transferências);
   - a trava dos anos num comando só e a eliminação agendada na volta, que não estão no `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/TODO.md`.

   Escreva os dois antes do pouso, para a recomendação não ficar registrada só no `10_task.md`.
2. Quando a 16.0 medir a virada da escola inteira, inclua o laço de `vinculo.criado` um por um (`alunos.ts:492-496`) na mesma medida do passo (3).

## test-engineer · 2ª rodada · APROVADO · 2026-11-04 09:34:59 · `tasks/prd-onboarding-por-convite/10_task.md`

VEREDITO: APROVADO

Cenários exigidos: os mesmos da 1ª rodada.
- Caminho feliz: o aprovado marcado é desligado e o nome não aprovado marcado sai da lista.
- O ausente sem marca segue ativo.
- O desligado não entra por matrícula, e as sessões dele caem.
- O pedido pendente fica `encerrada`, e o recusado antigo fica como estava.
- A mesma marca duas vezes desliga uma vez só.
- Caso de permissão: a marca de quem a planilha não deixa ausente é recusada.
- Mais de um lote: 501 nomes retirados e 501 alunos que voltam.
- Virada de ano: o aluno volta com o mesmo login, e os vínculos dos outros anos ficam intactos.
- Na virada, o aluno desativado é erro de linha; no ano em curso não existe virada.
- A mesma planilha gravada de novo não muda nada.
- A auditoria não traz nome nem matrícula.
- As corridas [P] do passo (3) e a ordem global das travas.
- Isolamento na prévia, na consulta da virada, no `retirarNomes` e no job inteiro.

Cobertos: todos. Nesta rodada conferi só o diff desde a 1ª e as duas correções que exigi.

1. **`ne(vinculo.estado, 'encerrado')`, em `lista.repository.ts`: feita.** O motivo (3), que era falso, saiu, e entrou o bloco que remove a cláusula, citando `o aluno do ano anterior "volta" com o mesmo login`. O vermelho vem do motivo certo. O `reentra` (`desligamento-pela-planilha.int.test.ts:671-672`) é aluno ativo cujo único vínculo no planejado está encerrado. Sem a cláusula ele vira "já existe", e as asserções `voltam: 2` e o vínculo confirmado na `t27` (linhas 693-697) falham.
2. **O `where` do `delete` em `retirarNomes`, em `lista.repository.ts:265`: feita, com um bloco por cláusula.**
   - `l.escola_id`: pego pelo `isolamento dos métodos do desligamento`, linha 871, chamada no contexto da A.
   - `l.ano_letivo_id`: pego pelo mesmo teste, linha 874, com o ano planejado da própria B. Ele pega o ano sozinho, e não só por causa do filtro da escola.
   - `l.estado`: pego por `[P] a reivindicação parada…`. Sem a cláusula, o nome reivindicado sai, e o teste exige `desatualizada` e o pedido pendente com o nome na lista.
   - `l.turma_id`: pego por `[P] o nome livre levado à 8B à mão`. Sem a cláusula, o nome sai da 8B e o job conclui.

As recomendações que fiz na 1ª rodada também foram atendidas:
- O texto do `voltas.length === 0` agora está no motivo (4).
- O `NAO_ENCONTRADO` e o `volta` na assinatura viraram blocos, com os testes de unidade de `alunos.test.ts:401` e `:339`.
- O bloco da trava dos anos no `travar` foi posto. Sem a linha, a trava dos anos só aparece pelo `desativar`, depois da trava de usuários, e a asserção de ordem da linha 628 falha.
- O nome do teste da linha 820 agora diz o que ele prova.

Conferi também o que mais mudou:
- **O `--faltando`:** rodei e ele lista 12 linhas. Cada uma tem motivo:
  - `lista.repository.ts:177`, `:260` e `:276`: motivo (1).
  - `alunos.ts:241` e `:355`: motivo (3).
  - `:454`, `:489` e `:494`: motivo (4).
  - `:291`: motivo (5).
  - `:619`: motivo (6).
  - `:335`: motivo (7).
  - `:332`: motivo (8).
- **A invariante nova do `voltar` (`alunos.ts:494`):** é de fato inalcançável, porque `criados` só traz quem está em `voltas`. O motivo (4) a declara.
- **Os casos que o tenancy-guardian pediu:**
  - As marcas `desligar` com ids da outra escola (`outra.ausente.usuarioId` e `outra.livre.id`) recebem `ENTRADA_INVALIDA`, e nada é gravado (linhas 422-424).
  - As matrículas `b.desativado` e `b.jaTem` dão "entra" na planilha da A, e o `daVirada` delas no contexto da A volta vazio (linhas 841-852).
- **Os testes:** rodei os dois arquivos e passaram. `desligamento-pela-planilha.int.test.ts` passou 27 de 27, e `alunos.test.ts` passou 30 de 30. Não há `.skip`, teste comentado, IA nem mock que esconda a regra.

Bloqueantes: nenhum.

Recomendações:
- `packages/core/src/importacao/tipos/alunos.test.ts:348`: o nome do teste diz "o aluno da mesma turma do ano anterior vai para a 9ºA", mas o mapa `daVirada` da fixture não traz a turma nem a série do ano anterior. O teste prova que o destino é a coluna da linha. Ele não prova que esse destino vence a série anterior, porque o classificador nem recebe esse dado. Vale ajustar o nome, ou trocar por uma asserção de forma: a entrada da virada não tem campo de turma.
- A seção "Revisões" do `10_task.md` foi perdida na reescrita, como o prompt já avisa. O histórico continua em `achados/10_task.md`.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/.processo/ordens/10_task-diff-r2.diff
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/test/desligamento-pela-planilha.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipos/alunos.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/10_task.md

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-04 09:35:02 · `tasks/prd-onboarding-por-convite/10_task.md`

VEREDITO: APROVADO

Esta é a 2ª rodada. Auditei só o diff desde a 1ª, que saiu APROVADO, e o que ele afeta.

Campos pessoais tocados: nenhum campo novo. O diff tem quatro mudanças.
- Em `retirarNomes`, a variável `retiradas_` passou a se chamar `apagadas`.
- Em `voltar`, o `?? ''` foi trocado por uma `InvariantException` cuja mensagem não leva dado de pessoa: `'vínculo criado para quem não volta'`.
- Entraram testes.
- Mudaram textos da tarefa e da Tech Spec.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok. O diff reforça a prova de duas formas.
- **Marca com id de outra escola.** No gravar, ela agora é recusada com `ENTRADA_INVALIDA`, a mesma resposta do id que não existe. Vale para o aprovado e para o nome livre da escola B (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/test/desligamento-pela-planilha.int.test.ts:422-423`). Com isso, o `desativar` não recebe id de outra escola e a resposta não confirma que o registro existe.
- **Matrícula da B na planilha da A.** Isso vale para quem volta, para o desativado e para quem já tem linha. Na prévia da A, as três dão `entra`, e `daVirada` devolve vazio (`:841-851`). Nenhuma dá `aluno_desativado` nem "já existe" e, portanto, nada revela que a matrícula existe na outra escola.

Logs: limpos. O diff não adiciona log.

Auditoria: presente. O `vinculo.criado` da volta agora sempre leva o `turmaId` verdadeiro. Antes, `''` só falharia no zod.

Envio externo: nenhum.

Seed/fixture: sintético.

Testes rodados por mim:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipos/alunos.test.ts`: 30 de 30 verdes.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/test/desligamento-pela-planilha.int.test.ts` (projeto `integracao`): 27 de 27 verdes.

O que a 1ª rodada pediu:
- **test-engineer, bloqueante 1** (`ne(vinculo.estado, 'encerrado')`): feito. O motivo falso (3) saiu, e entrou um bloco que cita `o aluno do ano anterior "volta" com o mesmo login`.
- **test-engineer, bloqueante 2** (o `where` do `delete` de `retirarNomes`): feito, com um bloco para cada uma das quatro cláusulas: `escola_id`, `ano_letivo_id`, `estado` e `turma_id`, cada uma com o teste pedido.
- **revisor-geral, bloqueante** (a trava dos anos não estava na Tech Spec): feito. O passo (3) da `techspec.md:94` agora diz "na de alunos, o dos vínculos de todo aprovado marcado para desligar".
- **Minha recomendação 2** (a frase sobre `aluno_desativado`): feito. Agora a linha 78 de `10_task.md` diz o mesmo que o código e o `cenarios.md`: no ano planejado é erro de linha, e no ano em curso a matrícula segue "já existe".
- **Recomendações do tenancy-guardian** (marcas com id da B, e `b.desativado` e `b.jaTem` na consulta da virada): aplicadas.
- **Recomendação do conformidade-reviewer** (a turma de destino sai só da linha da planilha): aplicada, com teste em `alunos.test.ts:348`.

Bloqueantes: nenhum.

Recomendações:
1. **Minha recomendação 1 não foi para o TODO.md, embora a tarefa diga que foi.** A tabela "Recomendações sem aplicar" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/10_task.md` dá o `TODO.md` como destino de duas recomendações:
   - a da volta que não olha `eliminacaoAgendadaEm`;
   - a do `travarAnosDosVinculos` num comando só.

   Mas o `TODO.md` não foi alterado nesta tarefa e não tem nenhuma das duas entradas. A primeira é a que importa para a regra 20: se a família pediu a eliminação e o pedido está na carência, a escola volta a tratar o dado de quem pediu para sair. Isso inclui a transferência da 9.0, que tem a mesma lacuna. Antes do pouso, as duas entradas precisam ser escritas de fato no `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/TODO.md`.
2. Nenhuma outra.
