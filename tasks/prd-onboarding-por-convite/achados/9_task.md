# Achados das revisões — `tasks/prd-onboarding-por-convite/9_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-04 02:27:48 · `tasks/prd-onboarding-por-convite/9_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A tarefa 9.0 não grava, não lê e não altera `Nota`, correção nem `lancadaPor`. Procurei no diff de `apps/` e `packages/` e não há nenhuma ocorrência. Todos com autor humano? Sim, porque não há caminho novo.

Decisão autônoma sobre aluno: ausente.
- A transferência de turma é uma ação administrativa da coordenação, e só acontece quando ela marca o aluno. Ela não é aprovação, reprovação nem encaminhamento pedagógico, e não passa por IA.
- O gravar confere cada marca contra os candidatos da prévia, considerando também a ação de cada um (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/motor.ts:98-101`). Sem a marca, a linha "muda de turma" não grava nada, e isso tem teste: `transferencia-pela-planilha.int.test.ts › sem a marca, "muda de turma" não muda nada`, com mutação declarada.
- O `fechar(…, 'encerrada')` não registra decisão: deixa `decidida_em`, `decidida_por` e `decidida_como` nulos (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/decisao.repository.ts:523-536`). O teste `o pedido encerrado pela transferência fica sem decididaEm…` prova isso. A virada do ano passa pela mesma função (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/src/estrutura/ano-letivo/ano-letivo.repository.ts:86`), e o teste em `virada-do-ano.int.test.ts` confere a chamada.
- O pedido recusado antes mantém a decisão humana que tinha.

Aprovação registrada: ok. Não há saída de IA nesta tarefa. As escritas humanas têm autor na auditoria: o job roda pelo `comAutora` com a coordenação que gravou a planilha (`motor.ts:256`), e quando essa pessoa já não existe a importação sai `desatualizada` (`motor.ts:252`). O teste de auditoria confere `autor_usuario_id = coordenadorId` em `aluno.transferido`, `lista.transferida`, `vinculo.encerrado` e `vinculo.criado`, sem nome nem matrícula em nenhum registro.

Supervisão do tutor: ok. A tarefa não toca o tutor. O trabalho do aluno fica na turma antiga, e há teste disso (`a resposta de atividade do transferido continua presa à turma antiga`). Não aparece nenhum caminho novo de uso que o professor não veja.

Autonomia declarada e visível: sim, e não mudou. Nenhum agente, nível ou tela de governança foi tocado.

Os itens 7 e 9 também ficam sem mudança: a tarefa não traz inferência emocional, medição de navegação nem métrica ou ranking de professor. O item 8 (nota sugerida em discursiva ou redação) não se aplica, porque não há devolutiva nem campo de nota.

Bloqueantes: nenhum.

Recomendações:
- O item do `TODO.md` que vem da conformidade (candidatos a `transferir` chegam à tela desmarcados, sem "marcar todos" já marcado) continua aberto. O teste do motor desta tarefa cobre o lado do servidor; falta conferir a tela quando a 13.0 a entregar.
- Na 10.0 ou na 13.0, provar que uma sessão de tutor aberta na turma antiga deixa de ser alcançável pelo aluno transferido, e que o registro e o resumo dela continuam visíveis ao professor da turma antiga. Isso fecha o item 4 da regra 70 também na borda da transferência; hoje vale porque o vínculo fica encerrado, mas não há caso de teste que o mostre.

`docs/regulacao.md` não mudou nesta tarefa e nada no diff contradiz o que ele diz.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-04 02:27:58 · `tasks/prd-onboarding-por-convite/9_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nem migration nova. As escritas novas caem em `vinculo`, `lista_nome`, `reivindicacao` e `auditoria`. Todas têm `escolaId` e `anoLetivoId`. `vinculo` e `lista_nome` têm a FK composta `(escola_id, ano_letivo_id, turma_id)` para `turma`, então o banco não aceita mover um vínculo ou um nome para a turma de outra escola ou de outro ano. Os ids continuam UUID, e as marcas que chegam no corpo são `z.uuid()`.

Queries verificadas:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/vinculo.repository.ts`: `encerrarDosAlunos` e `criarAlunosDaLista` usam `requireEscolaId()` e tiram o autor de `requestIdentity()`.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/lista.repository.ts`: `transferirNomes` e `transferirAprovados` filtram por `escola_id` do contexto e por `ano_letivo_id`.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/decisao.repository.ts`: as duas formas de `fechar(…, 'encerrada')` filtram por `escolaId` do contexto e por `estado = 'pendente'`.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/importacao.repository.ts`: as funções que dividem em lotes chamam `requireEscolaId()`.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/src/estrutura/ano-letivo/ano-letivo.repository.ts`: `virarSala` passa a usar `fechar({ anoLetivoId })`, com o ano já conferido na escola.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/motor.ts:97-99`: as marcas são conferidas contra os candidatos da prévia da escola do contexto, pelo par `acao:id`.

Nenhum endpoint aceita `escolaId`; o `strictObject` recusa, como já provava `contratos.test.ts:93`. Os ids e o ano que esses métodos recebem saem de leituras feitas no escopo da escola, nunca do cliente. Nenhum `@Unscoped()` novo. Nada novo na camada de rede.

Teste de isolamento: presente e efetivo. Está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/test/transferencia-pela-planilha.int.test.ts`.
- `:532` marca alunos da escola B na planilha da A e espera `ENTRADA_INVALIDA`, sem `importacao_planilha` gravada e com a B intacta. Sem a conferência das marcas no motor, a importação seria criada e o teste quebraria. As mutações das linhas `:99` e `:279` do `9_task.md` provam isso.
- `:555` mostra que uma matrícula da B na planilha da A vira "entra", e a B fica como estava.
- Marca de outra escola e marca com a ação trocada recebem o mesmo `ENTRADA_INVALIDA`, então o erro não revela que o id existe.

Bloqueantes: nenhum.

Recomendações:
1. Hoje nenhum teste quebra se a cláusula `escolaId` sair dos métodos novos (`transferirNomes`, `transferirAprovados`, `encerrarDosAlunos`, `fechar` em lote). O próprio documento da tarefa admite isso no motivo (2) das mutações. Não há como explorar, porque os ids vêm de leituras já filtradas e a FK composta segura a turma. Mesmo assim, um teste de repository que chame esses métodos no contexto da escola A com ids da B deixaria essa segunda barreira provada.
2. O `fechar({ listaNomeIds }, 'encerrada')` (`decisao.repository.ts:509`) não filtra por `anoLetivoId`. Somar `eq(reivindicacao.anoLetivoId, …)` daria a mesma defesa que a forma por ano já tem.
3. Os métodos novos recebem `anoLetivoId` como parâmetro, não do contexto. A justificativa (a planilha pode gravar no ano planejado) está escrita e o valor vem do `anoDeDestino`. Vale manter no comentário de cada método que ele só aceita ano já conferido, como já está no `fechar`.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-04 02:28:02 · `tasks/prd-onboarding-por-convite/9_task.md`

VEREDITO: APROVADO

**Campos pessoais tocados:** nenhum campo novo e nenhuma migration. A tarefa move linhas que já existem: `vinculo` (estado, `motivo_encerramento = realocacao`, `origem = lista`, `criado_por`, `decidido_em`), `lista_nome.turma_id` e `estado`, e `reivindicacao.estado`. Os segredos do pedido (`senha_hash`, `chave_envio`, `teve_matricula_errada`) são anulados no `fechar('encerrada')`, como manda a linha "Reivindicação" do `docs/lgpd.md`. Há duas ações de auditoria novas, `aluno.transferido` e `lista.transferida`. As duas guardam só ids e as turmas de origem e destino, num `strictObject`.

**Fora da tabela de dados do docs/lgpd.md:** nada. As duas auditorias novas cabem na linha "Auditoria (só ids, estados e datas)" e o vínculo cabe na linha "Vínculo". O valor `lista` já existia em `ORIGENS_DE_VINCULO`.

**Autorização por objeto:** ok.
- O gravar confere cada marca no formato `acao:id` contra os candidatos da prévia, que é da escola e do ano do contexto (`packages/core/src/importacao/motor.ts:97-100`).
- Marcar um aluno da escola B, ou trocar a ação da marca, dá `ENTRADA_INVALIDA`. A resposta é a mesma para id inexistente e para id de outra escola, então não confirma que o registro existe.
- Os repositories novos (`encerrarDosAlunos`, `criarAlunosDaLista`, `transferirNomes`, `transferirAprovados`, `fechar` por ano ou por nomes) filtram por `requireEscolaId()`. O ano vem do motor, nunca do cliente.
- Testes que provam: `transferencia-pela-planilha.int.test.ts › a marca de um aluno de outra escola…` e `› a transferência da A não alcança a B…`.
- O caso de isolamento pela rota continua pendente e está registrado no `TODO.md`.

**Logs:** limpos. Nenhum log novo. O `DiferencaNaPlanilhaError` leva só o código `diferenca_na_planilha`.

**Auditoria:** presente.
- `aluno.transferido` e `lista.transferida` levam origem e destino. `vinculo.encerrado` e `vinculo.criado` levam a `origem`. O autor é a coordenação que gravou a planilha.
- O teste `› a auditoria da transferência…` confere que nenhum nome nem matrícula aparece no que é gravado.
- `aluno.transferido` entrou na lista fechada das ações sobre `usuario` assinadas pela coordenação (`apps/api/test/architecture.test.ts:1422`). Com isso, o id de outra pessoa não vai parar no arquivo de quem é só autor.

**Envio externo:** nenhum. A tarefa não envolve IA.

**Seed/fixture:** sintético. Os nomes são do tipo "Aluno Aprovado" e "Nome Reivindicado", o e-mail é `@escola.invalid` e o hash é `'hash-sintetico'`.

**Pergunta de fechamento:** responde. O arquivo do titular lê `vinculo` com `origem`, `motivo_encerramento`, `decidido_em` e `encerrado_em` (`packages/core/src/titular/leitura-do-titular.ts:128-131`). A transferência aparece ali como o vínculo antigo encerrado por `realocacao` e o novo com origem `lista`, e a auditoria `aluno.transferido` guarda as duas turmas. Não há envio externo novo a rastrear.

**Bloqueantes:** nenhum.

**Recomendações:**
1. `docs/lgpd.md`, linha "Lista de nomes da turma": acrescentar que a planilha pode mudar o nome não aprovado de turma, que ele volta `livre` e que o pedido pendente é encerrado sem decisão, com `lista.transferida`. Hoje essa regra só está no código e na techspec.
2. `lista.transferida` tem `entidade: 'lista_nome'`. Se o nome for aprovado depois, essa auditoria não entra no arquivo do titular do novo usuário. A `lista.nome_corrigido` já funciona assim, então não é furo novo. Vale levar para a retro a pergunta se o arquivo do aluno aprovado deve trazer a auditoria da linha que virou ele.
3. O professor da turma antiga continua vendo o trabalho que o aluno transferido fez lá. É o que o RF5 pede. Vale escrever isso no `docs/lgpd.md` ou no PRD como finalidade declarada, para responder quando uma família perguntar.
4. O caso de isolamento pela rota `/v1/importacoes/alunos/previa` com token da escola A continua aberto no `TODO.md`. Ele deve ser feito antes do pouso da spec.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipos/alunos.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/motor.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/decisao.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/vinculo.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/lista.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/importacao.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/auditoria/acoes.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/src/estrutura/ano-letivo/ano-letivo.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/test/transferencia-pela-planilha.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/virada-do-ano.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/architecture.test.ts`

## infra-guardian · 1ª rodada · APROVADO · 2026-11-04 02:28:43 · `tasks/prd-onboarding-por-convite/9_task.md`

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
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipos/alunos.ts:374-385`: a auditoria grava uma linha por vez, até três por aluno aprovado transferido mais uma por nome. Isso roda dentro do passo (3), enquanto as turmas de origem e destino e os pedidos pendentes delas estão travados. Com 500 transferidos são cerca de 1.500 inserts em sequência, e nesse tempo o gerar acesso e a decisão em sala das turmas travadas ficam esperando. O padrão é o mesmo da 8.0 (`corrigirNomes`). A medida fica para a 16.0 (`importacao-7h30.js`, critério de passo (3) abaixo de 1 s); se passar disso, gravar a auditoria em lote.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/vinculo.repository.ts:342`: o `or()` com até 500 pares (aluno, turma) depende do planner escolher `vinculo_usuario_idx`. Anexar o `EXPLAIN` com um lote cheio no cenário de carga da 16.0.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/test/transferencia-pela-planilha.int.test.ts:385`: o caso dos 501 transferidos prova a soma por lote, mas não mede quanto dura o passo (3). O número que vale sai da 16.0.

O que foi conferido:
- **Travas e corridas:** a ordem das travas segue a ordem global (usuários, turmas tocadas com as de origem, pedidos, depois o vínculo com `FOR UPDATE` em ordem de id), a mesma do `desativar`. As escritas são condicionais ao que a planilha leu (`estado` e turma), e qualquer diferença fecha a importação `desatualizada`. O `vinculo_ativo_unico` também fecha `desatualizada`, e o job repetido sai sem efeito porque a importação deixa de estar `na_fila`.
- **Testes de concorrência:** os casos [P] cobrem professor aprovando, reivindicação parada, usuário preso, linha movida à mão e vínculo encerrado à mão.
- **Execução:** `transferencia-pela-planilha.int.test.ts` e `virada-do-ano.int.test.ts` rodaram aqui, 35 de 35 passando.
- **Sem migration e sem rota nova:** o job continua na fila `normal`, com a vaga por escola, `lock_timeout` e `statement_timeout`, e as métricas e alertas do passo (3) que já existiam.
- **Índices:** os filtros novos começam por `escola_id` e `ano_letivo_id` (`reivindicacao_pendente_por_nome`, `lista_nome_turma_idx`, `vinculo_usuario_idx`).
- **Cenário de carga:** ele ainda não tem transferências, mas isso já está planejado para a 16.0 (`infra/k6/importacao-7h30.js`), que é a tarefa que leva o [C] "job com transferências contra o gerar acesso e a decisão".

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-04 02:29:01 · `tasks/prd-onboarding-por-convite/9_task.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: divergência em `cenarios.md` RF5. A troca do `encerrar` por `encerrarDosAlunos` foi registrada na `techspec.md` §5 "Gravar", mas o cenário não foi atualizado.
Portão local: carimbo válido

Bloqueantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/cenarios.md:65`
  - **O que diz o cenário:** "Transferência e 'sai da grade' passam pelo `encerrar`: o acesso da turma do último vínculo confirmado é revogado."
  - **O que a 9.0 fez:** a transferência não passa pelo `encerrar`, passa pelo `VinculoRepository.encerrarDosAlunos`. A tarefa também diz que não há acesso a revogar, porque o aluno não gera `acesso_turma`. Conferi isso no código: `CicloDeVidaRepository.revogarDeQuemSaiu` só conta vínculo de `papel = 'professor'`.
  - **Por que bloqueia:** a linha de divergência do `9_task.md:78` aponta "`cenarios.md` RF5" como o lugar onde a divergência está escrita, e o arquivo continua dizendo o contrário. O caso `a transferência passa pelo encerramento` só confere o vínculo `encerrado` por `realocacao`. Ele não prova revogação nenhuma, e por isso não cobre o cenário como está escrito. A divergência ficou só no `N_task.md` e na `techspec.md`.
  - **Correção exigida:** reescrever a linha 65 separando os dois casos.
    - Transferência de aluno: o vínculo antigo é encerrado por `realocacao` pelo `encerrarDosAlunos`, que faz a mesma escrita do `encerrar`. Não há `acesso_turma` a revogar, porque o aluno não gera acesso.
    - "Sai da grade" (professor): continua passando pelo `encerrar`, com o acesso revogado.

Recomendações:
- **Marca pela ação** (`motor.ts:97-100`): o gravar agora confere `acao:id`, e a divergência do `9_task.md:81` cita `techspec.md` §4 e `cenarios.md` RF4 como o lugar onde isso está. Nenhum dos dois foi alterado. Vale escrever em `cenarios.md:12` que a marca de candidato com a ação trocada também é `ENTRADA_INVALIDA`.
- **Turma nova da transferência:** a turma que só a linha "muda de turma" pede nasce só com a marca, e `transferidos` só aparece no resumo quando é maior que zero. A `techspec.md` §5 só deixa isso implícito, e o cenário não existe em `cenarios.md` RF5, embora o teste exista. Vale escrever as duas coisas de forma explícita.
- **Segundo jeito de fazer o mesmo:** `VinculoRepository.encerrarDosAlunos` repete o padrão de `CicloDeVidaRepository.encerrarVinculosDaPessoa` (`FOR UPDATE` em ordem de id, devolvendo `estadoAntes`). Vale avaliar se um dos dois pode servir aos dois casos.
- **Sobrecarga do `fechar`** (`decisao.repository.ts:184-211`): a forma com `return undefined` e o retorno `Promise<string[] | void>` junta duas semânticas, decidir e encerrar sem decisão, num método só. Dois métodos com nomes próprios seriam mais legíveis. A spec só exige que o `virarSala` e a planilha usem a mesma escrita.
- **Comentário que perdeu palavras** (`decisao.repository.ts:174`): "a marca de matrícula errada" virou "a marca de matrícula". Parece edição acidental.
- **`?? ''`** (`alunos.ts:382`, na auditoria do `vinculo.criado`): esconde uma invariante, já que o destino sempre existe. Se faltasse, o erro sairia como falha de schema da auditoria e não como erro explícito.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-04 02:31:20 · `tasks/prd-onboarding-por-convite/9_task.md`

VEREDITO: REPROVADO

**Cenários exigidos** (da tabela da 9.0 e do `cenarios.md`, RF5, RF4 nas marcas, RF17 e Corridas):
- caminho feliz da transferência
- o trabalho do aluno fica na turma antiga
- a transferência passa pelo encerramento (`realocacao`), e o vínculo novo nasce confirmado com origem `lista`
- transferido com pedido pendente: o pedido fica `encerrada` e o nome volta livre na turma nova
- `fechar('encerrada')` não grava `decidida*`, e o `virarSala` passa por ele
- sem a marca, nada muda
- a transferência contra o professor aprovando o mesmo pedido: nenhum aluno aprovado fica na turma antiga
- reivindicação parada contra o passo (3)
- aluno a transferir desativado à mão entre o (2) e o (3) (`cenarios.md:73`)
- vínculo encerrado à mão entre o (2) e o (3)
- marca de aluno de outra escola, ou com a ação trocada
- isolamento entre A e B
- auditoria `aluno.transferido`, `lista.transferida`, `vinculo.criado` e `vinculo.encerrado`
- bordas: lote acima de 500, turma nova criada só com a marca, vínculo já aberto no destino

**Cobertos:** todos acima, menos o desativado à mão e a direção "o job vai primeiro" da corrida com a aprovação. Rodei `npx vitest run --project integracao apps/worker/test/transferencia-pela-planilha.int.test.ts apps/api/test/virada-do-ano.int.test.ts`: 35 de 35 verdes. As asserções olham o estado final no banco: o vínculo, a `lista_nome`, o pedido e a auditoria com `toEqual` exato. Não há `.skip`, não há IA, e as marcas, a escrita condicional e o lote têm bloco de mutação.

**Bloqueantes:**

1. **A corrida "nenhum aluno aprovado fica na turma antiga" (`cenarios.md:69-70`) está sem teste na direção que o cenário pede.**
   - O que está errado: a linha está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/9_task.md:50`. O risco que originou o cenário, `achados/revisao-spec.md:1441`, é este: o job leva o nome à turma nova e o professor da turma antiga aprova depois.
     - O teste de `transferencia-pela-planilha.int.test.ts:409` prova a direção contrária: a aprovação vai primeiro, e o aprovado fica de propósito na 8A. Além disso, a aprovação ali é SQL escrito à mão, sem o `travarAnoEmCurso` nem o `travarPendente` do `DecisaoService` (`apps/api/src/sala/decisao/decisao.service.ts:126-152`).
     - O teste de `:442` não tem aprovação nenhuma.
   - Correção exigida: um [P] novo.
     - Pare o job no passo (3) com o `WriteBlockTrigger`, depois do `fechar('encerrada')`, por exemplo no insert da auditoria `lista.transferida`.
     - Com ele parado, chame a decisão de verdade (a rota `decidir` ou o `DecisaoService`) para o pedido pendente e solte a barreira.
     - Confira: a importação `concluida`; a decisão `ja_decidida` (ou `nao_encontrada`); nenhum usuário ou vínculo criado na 8A; o nome `livre` na 8B; o pedido `encerrada` sem `decidida*`; zero `40P01` nos dois lados.
     - Cite o teste na linha 50.

2. **O cenário "[P] Aluno a transferir desativado à mão entre o passo (2) e o (3): `desatualizada`, sem vínculo novo" (`cenarios.md:73`) não tem teste nem linha em tarefa nenhuma.**
   - O que está errado: a `10_task.md:47` trata só do aluno "a desligar".
   - Correção exigida: com o `entreOs2e3` e o `desativar` de verdade, desativar o aluno marcado e conferir: `desatualizada`, nenhum vínculo novo, a `lista_nome` intacta, os outros marcados intactos. Acrescentar a linha à tabela da 9.0.

3. **O motivo (1) da seção "Mutações" é falso.**
   - O que está errado: o motivo diz que nenhum teste alcança a conferência `!== alunos.length` do `transferirAprovados` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipos/alunos.ts:384`). O caso `[P] o aluno aprovado levado à 8C à mão com o job parado na escrita` (`transferencia-pela-planilha.int.test.ts:479-501`) alcança. A escrita parada muda a `turma_id`, o `update … and l.turma_id = v.turma_lida_id` muda zero linhas, e só essa conferência fecha a importação `desatualizada`. Sem ela, o job conclui com o vínculo na 8B e a lista na 8C.
   - Correção exigida: um bloco de mutação nessa linha, citando esse caso, e tirar o motivo (1).

4. **Cláusulas de escola novas sem bloco (regra 10, item 5). O motivo (2) não se sustenta para todas.**
   - O que está errado:
     - O `eq(reivindicacao.escolaId, requireEscolaId())` do `fechar('encerrada')` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/decisao.repository.ts:181`) saiu do `virarSala` e veio para cá. Ele já é alcançado por `virada-do-ano.int.test.ts:490` (`isolamento: num contexto de A, virarSala com o ano de B…`): sem a cláusula, `pedidosEncerrados` daria 1 e o teste quebraria.
     - Os filtros de escola do `encerrarDosAlunos` (`vinculo.repository.ts:240`), do `transferirNomes` e do `transferirAprovados` (`lista.repository.ts:182` e `:198`) não têm teste que quebre sem eles. O caso `a transferência da A não alcança a B` nunca passa ids da B ao repository.
   - Correção exigida:
     - Um bloco para a cláusula da `decisao.repository.ts:181`, citando o teste de isolamento da virada.
     - Para os outros três, um teste no padrão de `virada-do-ano.int.test.ts:490` e `:676`: no contexto de A, chamar cada método com o ano e os ids da B e conferir que a B não mudou, mais o controle com o contexto da B. Um bloco por cláusula.

5. **Citação errada na tabela.**
   - O que está errado: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/9_task.md:48` cita `virada-do-ano.int.test.ts › caminho feliz …`. O espião no `fechar` e a asserção sem `decidida*` estão no caso `V1: o acesso fica revogado…` (`virada-do-ano.int.test.ts:341`, `:368-397`).
   - Correção exigida: citar o caso pelo nome certo.

**Recomendações:**
- No [P] em que a aprovação vai primeiro (`:409`), usar o `DecisaoService` real em vez do SQL à mão. Assim a ordem de travas é a de produção (ano em `FOR SHARE`, depois o pedido).
- O bloco "a origem de cada marcado deixa de ser travada" fica vermelho pelo tempo esgotado do `esperarNaTrava`, não pelo estado final. Fica registrado, porque a escrita condicional dá o mesmo desfecho sem a trava.
- Pôr `rollback` no `finally` do `entreOs2e3`, do `escritaParadaContraOJob` e do segurador de `:413`. Hoje o caminho de falha devolve ao pool uma conexão com a transação aberta.
- `fechar.mockRestore()` (`virada-do-ano.int.test.ts:371`) depois do `expect`: se a asserção falhar, o espião fica preso. Use `try/finally` ou `restoreAllMocks`.
- Testar duas tentativas do mesmo job de transferência em paralelo (D49), conferindo um `aluno.transferido` e um vínculo novo só.
- O texto da linha 50 diz "nenhum aprovado fica na turma antiga", e o nome do teste citado diz "o aluno aprovado fica inteiro na turma antiga". Alinhar depois do bloqueante 1.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-04 02:44:11 · `tasks/prd-onboarding-por-convite/9_task.md`

**VEREDITO: APROVADO**

**Escopo:** respeitado.

**Aderência à Tech Spec:** ok.
- A correção da rodada anterior foi feita. Em `cenarios.md`, as linhas 65 e 66 agora tratam os dois casos em separado. Na transferência de aluno, o vínculo antigo é encerrado por `realocacao` pelo `encerrarDosAlunos`, e não há `acesso_turma` a revogar. No "sai da grade" (professor), o caminho continua sendo o `encerrar`, com o acesso revogado.
- O texto bate com a divergência registrada no `9_task.md` e com a `techspec.md:116`.
- As duas linhas novas do `cenarios.md` (linha 12, ação trocada na marca; linha 69, turma nova só com a marca e `transferidos` só acima de zero) também já aparecem na tabela de divergências do `9_task.md`.

**Portão local:** carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)").

**Bloqueantes:** nenhum.

**Recomendações:**
1. Três trechos do `9_task.md` ainda dizem que a transferência passa pelo `encerrar` e revoga o acesso, o que contradiz a divergência que o próprio documento registra:
   - `tasks/prd-onboarding-por-convite/9_task.md:9`: o Objetivo diz "encerrado pelo `encerrar` (que revoga o acesso da turma)".
   - `9_task.md:23` e `9_task.md:25`: as subtarefas 9.1 e 9.3 citam o `encerrar` e o "`encerrar` que devolve `false`".
   - `9_task.md:45`: a linha da tabela de testes diz "A transferência passa pelo `encerrar`: o acesso da turma antiga é revogado". O caso que ela cita (`transferencia-pela-planilha.int.test.ts:320`) prova outra coisa: o vínculo encerrado por `realocacao` e o novo confirmado.

   Convém alinhar o texto ao que o caso prova.
2. `tasks/prd-onboarding-por-convite/techspec.md:99` ainda fala em "o `encerrar` que devolve `false`". No caminho da transferência, a diferença vem da contagem do `encerrarDosAlunos`, menos vínculos que pares. Convém ajustar o texto à função usada.
3. `apps/worker/test/transferencia-pela-planilha.int.test.ts:38`: o teste do worker importa código de produção da api (`../../api/src/sala/decisao/decisao.service.js`). Hoje funciona, mas acopla os dois apps. Se o `DecisaoService` também subir para `packages/core`, como a 8.0 fez com os repositories, o import deve ir junto.
4. `transferencia-pela-planilha.int.test.ts:246` e `:266`: o `rollback` dentro do `finally` roda depois de um `commit` que já deu certo. Ele é inofensivo por causa do `.catch`, mas o Postgres registra um aviso a cada execução. Uma flag de "já confirmou" deixaria a intenção mais clara.

## test-engineer · 2ª rodada · APROVADO · 2026-11-04 02:45:22 · `tasks/prd-onboarding-por-convite/9_task.md`

VEREDITO: APROVADO

Cenários exigidos (2ª rodada): as cinco correções da 1ª rodada.
1. A corrida na outra direção: o job encerra o pedido e o professor aprova depois, pelo `DecisaoService` de verdade.
2. O aluno desativado de verdade entre o passo (2) e o (3).
3. O bloco de mutação da conferência `!== alunos.length`, com o motivo (1) tirado.
4. Isolamento das cláusulas de escola de `fechar('encerrada')`, `encerrarDosAlunos`, `transferirNomes` e `transferirAprovados`.
5. A citação certa na linha da `virarSala`.

Cobertos:
1. `apps/worker/test/transferencia-pela-planilha.int.test.ts:448`, o caso `[P] o professor aprovando pelo DecisaoService com o job parado depois de encerrar o pedido`.
   - O job fica parado no insert da auditoria `lista.transferida`, depois de `fechar('encerrada')`. A decisão passa pelo `DecisaoService` real e espera na trava do pedido (`esperarNaTrava '%reivindicacao%for update%'`). Depois a barreira é solta.
   - O teste confere: importação `concluida`, decisão `ja_decidida`, pedido `encerrada` com os `decidida*` e o `senha_hash` nulos, nome `livre` na 8B com nome e matrícula, e nenhum usuário nem credencial criados.
   - Os dois lados ficam no `Promise.all`, então um `40P01` deixaria o teste vermelho.
   - Se o `fechar` sair do passo (3), a decisão aprova e o teste quebra.
   - O caso da direção contrária (`:419`) também passou a usar o `DecisaoService` real, parado por `WriteBlockTrigger` na escrita da `lista_nome`. O SQL escrito à mão saiu.
   - Os dois estão citados em linhas separadas da tabela (`9_task.md`, linhas 50 a 52).
2. `:552`, o caso `[P] o aluno a transferir desativado de verdade`. Usa o `entreOs2e3` com o `CicloDeVidaService.desativar` real.
   - Confere: `desatualizada`, os mesmos ids de vínculo (nenhum novo), `lista_nome` igual à de antes, os outros vínculos `confirmado`, o pedido `pendente` e o nome livre na 8A.
   - A linha entrou na tabela, e o `cenarios.md` foi atualizado.
3. Correção feita: o bloco que tira a conferência `!== alunos.length` de `alunos.ts` cita `o aluno aprovado levado à 8C à mão`, e o motivo (1) antigo saiu.
4. Isolamento:
   - Foram acrescentados um bloco para `decisao.repository.ts`, citando `virada-do-ano.int.test.ts › isolamento: num contexto de A` (o nome confere com `:494`), e um teste novo, `:582`, o caso `isolamento dos métodos da transferência`.
   - No contexto da A, o teste chama os quatro métodos com o ano e os ids da B. Espera `{ pedidos: [], nomes: 0, aprovados: 0, vinculos: 0 }` e a B sem mudança. No controle, com o contexto da B, os mesmos argumentos mudam a B.
   - Há um bloco por cláusula: `vinculo.repository.ts` (`doPar`), as duas de `lista.repository.ts` e a de `decisao.repository.ts` por `listaNomeIds`.
   - Conferi cada mutação contra o teste. As duas de `lista.repository.ts` e a de `decisao.repository.ts` mudariam a B, e o teste quebra.
   - A de `doPar` quebra pela contagem: o `update` ainda filtra a escola, então a B não muda, mas o método devolve 1, e o teste espera 0. É defeito real: a auditoria `vinculo.encerrado` da A sairia com ids da B.
   - O `--faltando` lista 18 linhas, e os 4 motivos cobrem todas.
5. Correção feita: a linha cita agora `V1: o acesso fica revogado, o pendente vira encerrada sem segredo …`, e esse nome confere com `virada-do-ano.int.test.ts:341`. Esse caso também passou a restaurar o espião num `finally`.

Rodei `npx vitest run apps/worker/test/transferencia-pela-planilha.int.test.ts`: os 21 casos passaram. Não há `.skip`, não há mock que esconda a regra (só o contador de login, que fala com o Redis, é falso), e nenhum teste chama provedor de IA.

Bloqueantes: nenhum.

Recomendações:
- `transferencia-pela-planilha.int.test.ts:448`: deixar explícito o que hoje só se deduz. Uma asserção de que a 8A não tem vínculo novo (pelo `retrato` ou pelo `vinculosDe`). Um comentário dizendo que o `Promise.all` é o que garante "zero `40P01`".
- `transferencia-pela-planilha.int.test.ts:582`: a mutação do `doPar` só é pega pela contagem devolvida, porque o filtro de escola do `update` (`vinculo.repository.ts:251`) segura a B. Vale uma linha no teste dizendo isso, para ninguém tirar a asserção `vinculos: 0` achando que o `retrato` basta.
- A mesma cláusula, `decisao.repository.ts` `eq(reivindicacao.escolaId, …)`, tem dois blocos, um por teste (por ano e por `listaNomeIds`). Está correto, mas o texto dos dois blocos poderia dizer que é a mesma linha vista pelos dois caminhos.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/test/transferencia-pela-planilha.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/virada-do-ano.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/9_task.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/cenarios.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/vinculo.repository.ts`
