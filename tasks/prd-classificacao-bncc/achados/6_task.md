# Achados das revisões — `tasks/prd-classificacao-bncc/6_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-18 09:06:40 · `tasks/prd-classificacao-bncc/6_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nem migration. As tabelas tocadas são `secao_do_material`, `habilidade_da_secao`, `material`, `job_registro` e `execucao_agente`, e todas já têm `escola_id`. `secao_do_material` não varia por ano letivo, e é o mesmo modelo da 4.0 e da 5.0.

Queries verificadas:
- **`limparDoRecorte`** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/material/agendamento-da-classificacao.repository.ts:131-149`): o `select ... for update` filtra por `escola_id` do contexto (`requireEscolaId`), e o join com `material` usa a chave composta. O `delete` de `habilidade_da_secao` e o `update` de `secao_do_material` agem só sobre os ids travados e também levam `escola_id`.
- **`proximasSecoes`**: o filtro novo `secaoIds` entra junto com o `eq(secaoDoMaterial.escolaId, escolaId)` que já existia.
- **`SecoesRepository.limparDaExecucao`** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/secoes.repository.ts`): virou um `update ... returning` com `escola_id` e `execucao_id = :esta`. O `delete` tem `escola_id` e só pega os ids que o `update` devolveu.
- **Os dois `PATCH`** (`disciplina.service.ts`, `material.service.ts`): o job só é enfileirado depois de `travarPorId` / `travarParaAtualizar`, que já são escopados. Id de outra escola continua dando `NAO_ENCONTRADO` antes de enfileirar qualquer coisa.
- **Escola do job**: vem do contexto, em `JobOutboxRepository.inserirUmaVez` (`contexto?.escolaId`). Os dados do job levam só `materialId` ou `disciplinaId` (`z.uuid()`, `strictObject`), nunca `escolaId`. Nenhum endpoint passou a aceitar `escolaId` do cliente.
- **Ids**: todos UUID.
- **`@Unscoped()`**: nenhum novo.
- **Camada de rede**: não é tocada.

Teste de isolamento: presente e efetivo. É o caso `recorte.int.test.ts` › "o job da escola A com o id do material (ou da disciplina) da B nem limpa nem trava a seção da B", que roda com `materialId` e com `disciplinaId`. Tirando mentalmente o `eq(secaoDoMaterial.escolaId, escolaId)` da linha 138, o `for update` alcançaria a linha da B, que está travada por outra conexão. O job estouraria o `statement_timeout`, ou então limparia a seção e apagaria a habilidade da B. Nos dois casos o teste quebra. A mutação correspondente também está declarada no `6_task.md`.

Bloqueantes: nenhum

Recomendações:
- Nos casos de `PATCH` da 6.0, conferir de ponta a ponta que um `PATCH` de séries ou de componente com id da escola B, feito por quem é da A, responde `NAO_ENCONTRADO` e deixa a fila sem nenhum `material.agendar-classificacao`, nem na A nem na B. Hoje isso está garantido pela ordem do código e pelos testes de 404 da 1.0 e do F4, mas nenhum teste afirma que nada foi enfileirado.
- Em `limparDoRecorte` e em `limparDaExecucao`, quando a lista de ids vem vazia, o `delete` e o `update` ainda rodam com `inArray(..., [])`. Sair antes, se a lista estiver vazia, poupa duas consultas e não depende de como o Drizzle trata o `IN` vazio.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-18 09:06:45 · `tasks/prd-classificacao-bncc/6_task.md`

VEREDITO: APROVADO

Esta tarefa não toca dado de pessoa. Ela mexe em seção de material, no código BNCC que a IA atribui e no job de agendar a classificação. Nada disso é dado de aluno nem de professor.

Campos pessoais tocados: nenhum. O job criado por esta tarefa leva só o `materialId` ou o `disciplinaId` (`packages/shared/src/system/job-definitions.ts`, `agendamentoDaClassificacaoSchema`). A escola vem da linha do outbox, e o recorte é lido do banco na hora de rodar.

Fora da tabela de dados do docs/lgpd.md: nada. Não há campo novo nem migration.

Autorização por objeto: ok.
- `PATCH /v1/materiais/:id` (`apps/api/src/material/material.service.ts`, `atualizar`): só enfileira o job depois que `travarParaAtualizar` encontra o material dentro da escola da sessão, e enfileira com `alvo.id`, o id lido do banco. Material de outra escola ou inexistente responde `NAO_ENCONTRADO` antes de qualquer outra resposta.
- `PATCH` de disciplina (`apps/api/src/estrutura/disciplina/disciplina.service.ts:44-62`): só enfileira depois de `travarPorId` com escopo, e só quando o componente muda.
- Dentro do job, `limparDoRecorte` filtra por `escolaId` do contexto no `select ... for update`. O `delete` e o `update` agem só sobre os ids que esse `select` devolveu.
- O caso "o job da escola A com o id do material (ou da disciplina) da B" em `apps/api/src/material/recorte.int.test.ts:497` prova o isolamento. A mutação que tira o `escola_id` da limpeza faz o teste falhar.

Logs: limpos.
- `classificacao.recorte_refeito` (`apps/worker/src/processors/agendar-classificacao.ts`, fim de `refazOsRecortes`) leva só `escolaId`, `tipo`, `estado` e contagens.
- `material.atualizado` continua só com `materialId`.
- O teste em `apps/api/src/material/recorte.int.test.ts:472` confere o formato do log.

Auditoria: presente.
- Os dois `PATCH` já gravavam `material.atualizado` e `disciplina.componente_alterado`, sem o título.
- O job nasce na mesma transação da auditoria: ou os dois ficam gravados, ou nenhum fica.
- A limpeza só apaga código com `origem: 'ia'` de seção não corrigida, nunca o que a coordenação corrigiu. Isso não é nota, permissão nem dado de aluno, então nenhuma auditoria da regra 20 item 10 se aplica.

Envio externo: nenhum novo. O `preparar` sem candidatas termina sem chamar o modelo e sem consumo (P11, caso "sem candidatas"). As execuções que o job cria são linhas de `ExecucaoAgente` do tipo `classificar_secoes`, criadas pelo caminho da 5.0, que segue registrado.

Seed/fixture: sintético. São escola, disciplina e material de teste ("Apostila nova", "Química Orgânica"), sem nome de pessoa nem matrícula.

Pergunta de fechamento: não muda nada para o titular. Esta tarefa não cria dado sobre aluno nem envio novo para fora. O que já existe sobre o aluno e o que já foi enviado continua respondido pelo arquivo do titular e por `ExecucaoAgente`.

Bloqueantes: nenhum.

Recomendações:
1. Em `apps/api/src/estrutura/disciplina/disciplina.service.ts:61`, enfileirar com `atual.id` em vez do `id` que veio da URL, como o material já faz com `alvo.id`. Hoje dá no mesmo, porque a linha foi travada com escopo e o Postgres compara uuid sem diferenciar maiúscula. Mas usar o id lido do banco deixa explícito que o job nunca leva valor do cliente que não passou pela leitura com escopo.
2. Registrar no `docs/lgpd.md`, na linha do código BNCC por seção (`habilidade_da_secao`), que a mudança de recorte apaga o código da IA. Assim o mapa de dados descreve esse ciclo de vida. Não bloqueia, porque não é dado pessoal.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/material.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/estrutura/disciplina/disciplina.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/secoes.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/worker/src/processors/agendar-classificacao.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/material/agendamento-da-classificacao.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/shared/src/system/job-definitions.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/recorte.int.test.ts

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-18 09:06:55 · `tasks/prd-classificacao-bncc/6_task.md`

VEREDITO: APROVADO

Esta tarefa não grava nem lê `Nota`, não decide nada sobre aluno e não toca no Tutor. O que muda é o seguinte: os dois `PATCH` (o das séries do material e o do componente da disciplina) passam só a enfileirar um job. Esse job apaga a classificação da BNCC feita pela IA nas seções que a coordenação ainda não corrigiu e agenda uma classificação nova.

Caminhos de escrita em Nota: nenhum nesta tarefa — todos com autor humano? não se aplica (o diff não toca `Nota`)

Decisão autônoma sobre aluno: ausente. A classificação é um índice do material. Pelo PRD, o aluno só recebe a habilidade por meio de uma atividade que o professor aprovou.

Aprovação registrada: ok
- A seção corrigida pela coordenação nunca entra na limpeza. A consulta só pega seções não corrigidas (`isNull(corrigidaEm)` com `for update`), e o `delete` só apaga habilidades `origem: 'ia'`. Ficam em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/material/agendamento-da-classificacao.repository.ts:670-689`.
- Isso está provado em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/recorte.int.test.ts:254` e `:329`: a habilidade `origem: 'coordenacao'` continua lá. Há duas mutações sobre `isNull(corrigidaEm)` e `origem`.
- Os dois `PATCH` enfileiram o job na mesma transação em que gravam a auditoria (`material.atualizado` e `disciplina.componente_alterado`). Então a ação humana que provoca a limpeza fica registrada com autor e data.
- A exceção do Tutor (D47) não aparece em nenhum outro agente.

Supervisão do tutor: ok. A tarefa não toca no Tutor.

Autonomia declarada e visível: sim
- A classificação é a função `classificacao_do_material` do Assistente de ensino, com autonomia 1, alto risco e suspensível. Isso é provado em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/shared/src/governanca/governanca.test.ts:104`.
- O job novo respeita a suspensão: com a função suspensa, ele limpa e não agenda (`apps/worker/src/processors/agendar-classificacao.ts:593`).
- Isso está provado em `recorte.int.test.ts:368`, inclusive com a função retomada. A mutação "sair antes da limpeza" também está coberta.
- Nenhum nível 3 ou 4 foi criado.

Itens 7, 8 e 9 (vigilância, nota em discursiva e redação, medir o professor): fora do alcance do diff. Não há inferência sobre o aluno, nenhum campo de nota ou conceito e nenhuma métrica de professor. O log do job (`agendar-classificacao.ts:604`) só traz ids e contagens.

Bloqueantes: nenhum

Recomendações:
- Hoje não há como saber, depois, que códigos a IA tinha proposto para uma seção limpa. O `limparDoRecorte` apaga as habilidades `origem: 'ia'`, e `execucao_agente.resultado` guarda só uma referência à classificação, não os códigos. Isso segue a techspec aprovada e não causa dano: nada disso foi aprovado nem chegou a aluno. Mas, se o dossiê de conformidade (D61) precisar mostrar o histórico do que a IA classificou, vale registrar na techspec que o histórico de uma classificação descartada sem aprovação não fica guardado, e por quê.
- A correção da seção pela coordenação ainda não existe: os testes gravam `corrigida_em` e `origem: 'coordenacao'` direto por SQL. Quando a tarefa da correção chegar, ela precisa de um caso de corrida entre a correção e o `limparDoRecorte`, para provar que a trava `for update` não deixa a limpeza apagar o código recém-corrigido.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-18 09:07:09 · `tasks/prd-classificacao-bncc/6_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. As quatro divergências do `6_task.md` estão registradas. A chave é UUID novo e não o id da auditoria. O job é do mesmo tipo da rotina, com `materialId` ou `disciplinaId`. O `PATCH` só enfileira quando o recorte muda. O `limparDaExecucao` virou um `update … returning` só. As três primeiras estão escritas na `techspec.md` §5 "Agendar" (b). O `PATCH` que não muda o recorte entrou também no `cenarios.md`. A quarta já cumpre o `execucao_id = :esta` que a §5 e o P11 pediam.
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/material/agendamento-da-classificacao.repository.ts:142`: quando o `select … for update` não devolve nada (`ultima === undefined`), o `delete` e o `update` rodam assim mesmo, com `inArray` vazio. O drizzle 0.45 transforma isso em `false`, então não é bug, mas no último lote de todo job são dois comandos inúteis. Vale sair logo depois do `select` quando `ids.length === 0`.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/worker/src/processors/agendar-classificacao.ts:154`: quando o job do `PATCH` volta para uma nova tentativa (`RETENTATIVA_DE_HOJE`) depois de agendar alguns lotes, ele limpa de novo as seções desses lotes. As execuções `pendente` criadas na primeira tentativa ficam sem seção e concluem sem modelo. Não há custo de modelo nem dado errado, mas sobram execução e job à toa. Vale uma linha no comentário, ou que o `infra-guardian` confirme que isso é aceitável.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/worker/src/processors/agendar-classificacao.ts:91`: o caminho da mudança de recorte não tem o teto de execuções da noite. A justificativa está no comentário e a §5 (b) não exige o teto. Mesmo assim, uma disciplina com muitos materiais cria todas as execuções de uma vez, e a análise da carga é do `infra-guardian`.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/material.service.ts:480`: o texto diz "Série repetida", mas o código compara o conjunto ordenado. A série repetida no pedido já cai em `NAO_ENCONTRADO` antes de chegar aqui. Trocar para "o mesmo conjunto de séries".

## infra-guardian · 1ª rodada · APROVADO · 2026-11-18 09:07:32 · `tasks/prd-classificacao-bncc/6_task.md`

VEREDITO: APROVADO

Caminho quente tocado: fila

Rate limit: ok. A tarefa não cria rota nem limitador. Os dois `PATCH` já existiam, são da coordenação e passam pelo limite por usuário e por escola que já estava lá.

Fila e prioridade: ok. O `PATCH` só grava o job `material.agendar-classificacao` no outbox, dentro da transação da auditoria. Esse job vai para a fila `lote`, como não urgente, com o limite por escola do despachante, por isso fica parado durante o horário letivo. O job trabalha em lotes de 500, cada lote numa transação com `statement_timeout` de 20 s, e para entre dois lotes quando recebe o sinal.

Concorrência: protegida.
- A limpeza trava as seções com `select … for update` em ordem de id, antes de apagar ou alterar qualquer coisa.
- A corrida com a rotina é resolvida pelo `execucao_id is not distinct from :lido` que já existia em `#criarExecucao`.
- `limparDaExecucao` passou a ser um único `update … returning` com `execucao_id = :esta`, o que fecha a janela do P11.
- Há teste para P9, P10a, P10b e P11 em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/recorte.int.test.ts`.

Índice e paginação: ok.
- Pelo material, a busca usa `secao_do_material_pagina_idx (escola_id, material_id, …)`.
- Pela disciplina, usa `material_disciplina_idx (escola_id, disciplina_id, id)` e depois a seção por material.
- O laço anda por cursor de id, com `limit 500`.

Degradação de IA: não se aplica. O job não chama o modelo. Cria execuções na fila `lote`, que seguem pelo caminho da tarefa 4.0, já auditado.

Migration: não se aplica. Não há migration. O esquema dos dados passou de `semDados` para dois campos opcionais, e o job da rotina gravado antes, sem dados, continua válido.

Métrica e alerta: ok. Fora do caminho interativo. O job grava um log só com ids e contagens (`classificacao.recorte_refeito`), e as métricas da fila valem para ele. Nenhum alerta novo.

Bloqueantes: nenhum

Recomendações:
1. **Possível deadlock entre a limpeza e o `concluir`.** `limparDoRecorte`, em `packages/core/src/material/agendamento-da-classificacao.repository.ts:134-141`, trava as seções em ordem de id. Já `gravarClassificacao`, em `apps/api/src/material/secoes.repository.ts` (código da 4.0), atualiza uma seção por vez, na ordem em que o modelo respondeu. Com duas ou mais seções em comum, o Postgres pode detectar um deadlock e abortar uma das duas transações. Não se perde dado: se a limpeza abortar, o job tenta de novo; se o `concluir` abortar, o resultado seria descartado de qualquer forma (P10b). Mas a chamada ao modelo já foi paga. Quando a 7.0 puser o `for update` da seção, vale travar em ordem de id ali também.
2. **Job novo lido por worker antigo.** Durante o deploy, um worker ainda com a versão anterior que pegue um job com `materialId` ou `disciplinaId` lê os dados pelo esquema antigo, `semDados`, que é estrito. O job falha com `DADOS_INVALIDOS`, sem nova tentativa, e a reclassificação daquele `PATCH` se perde. Isso não acontece se a API e o worker sobem juntos e fora do horário letivo, como manda a regra 80, item 9. Vale registrar essa ordem de deploy no runbook.
3. **Custo de quem troca o componente várias vezes.** `refazOsRecortes` não tem o teto de execuções da noite, por decisão registrada. Uma coordenação que troque o componente de uma disciplina grande várias vezes, depois de as execuções concluírem, paga a classificação inteira de novo a cada troca, até cerca de 630 execuções. Execução cancelada antes de rodar sai sem chamar o modelo, por causa do P11. Hoje só o orçamento da escola (D14) segura isso; vale citar na seção 8 da Tech Spec.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-18 09:09:57 · `tasks/prd-classificacao-bncc/6_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- **Caminho feliz:** `PATCH` de séries do 6º para o 9º, e `PATCH` do componente. Nos dois, o `PATCH` só enfileira o job, e o job limpa e agenda pelo recorte que está no banco.
- **Bordas:**
  - seção corrigida pela coordenação
  - seção com falha 2
  - execução `rodando`
  - execução `pendente`
  - componente apagado
  - componente apagado e definido de novo, com o job atrasado
  - dois `PATCH` seguidos
  - disciplina sem componente
  - `preparar` sem candidatas
  - mais seções que o lote
  - sinal abortado
  - os dados com `materialId` e `disciplinaId` juntos
  - um `PATCH` que não muda o recorte
- **Permissão:** quem não pode fazer o `PATCH` não enfileira nada.
- **Isolamento:** o job da escola A com o id da escola B.
- **Concorrência:** P9, P10a, P10b, P11, e o job rodando duas vezes.

**Cobertos:** cada uma das 20 linhas da tabela tem o seu caso, citado pelo nome em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/recorte.int.test.ts`. Os 20 casos passam.
- `mutacoes.ts --faltando` responde "Nenhuma linha nova… fica sem bloco".
- As linhas sem bloco e as mutações da tabela sem bloco têm o motivo escrito no documento: P9 e P10b são código da 4.0 e da 5.0, e "gravar as candidatas no agendar" e "decidir pelo conteúdo do `PATCH`" não têm linha de código a mutar.
- P10a e P10b correm em paralelo de verdade, com a trava e o gatilho de parada. P9 e P11 forçam a ordem, o que basta: a condição do P9 é comparar e trocar na leitura da outra transação.
- Não há `.skip`, e nenhum teste chama provedor: nenhum caso passa pelo modelo.
- O isolamento usa uma trava na linha da escola B para enxergar a leitura que a defesa em profundidade esconderia.
- O sem modelo e sem consumo pela execução real já tem prova na 4.0 (`classificacao.int.test.ts:348`).

**Bloqueantes:**

1. **`recorte.int.test.ts:310-325`, "dois `PATCH` seguidos…": o teste passa mesmo que os jobs não refaçam nada.**
   - A seção nasce classificada pela execução `antiga` (concluída, recorte do 6º). O segundo `PATCH` volta ao 6º, ou seja, ao recorte original.
   - As asserções finais olham só a execução que a seção aponta (`execucaoId` não vazio) e as candidatas dela começarem com `EF06CI`. O `preparar` não confere o estado da execução (`classificar-secoes.command.ts:57-68`) e lê o recorte atual do banco. Assim, com a `antiga` ainda na seção, as candidatas também começam com `EF06CI`.
   - Resultado: um job que não faz nada passa nas duas ordens. Isso inclui tirar a linha `if (alvo !== undefined) return refazOsRecortes(...)`, porque aí o job cai na regra da rotina, que não pega seção com execução concluída. Também passaria um processador que deixasse de rodar o segundo job do mesmo material.
   - Do cenário ("o segundo job também roda e o resultado é o recorte do segundo"), só o `toHaveLength(2)` da fila tem prova.
   - **Correção exigida:** nas duas ordens, conferir que `execucaoId` não é a `antiga`, que a execução está `pendente` e que `habilidadesDa(secao)` está vazio. Ou fazer o segundo `PATCH` ir a um recorte diferente do original (por exemplo `[serie6, serie9]`) e conferir que as candidatas trazem `EF06` e `EF09`.

**Recomendações:**

- **`recorte.int.test.ts:352-366`** (componente apagado e definido de novo): pelo mesmo motivo, um job que não faz nada deixaria o `EF09CI01` antigo com o componente `matematica` e o caso passaria. Ele só pega a mutação de decidir pelo `null`. Acrescentar `expect(execucaoId).not.toBe(antiga)` e `habilidadesDa(...)` vazio.
- **Linhas 300, 307, 323, 365 e 393:** `every(...)` sobre uma lista vazia dá verdadeiro. Acrescentar `length > 0`, como já fazem as linhas 197 e 232.
- **Linha 426:** `consumosDa(pendente) === 0` sempre passa, porque o caso não passa pelo executor. A prova real está na 4.0. Tirar a asserção ou citar aquele teste.
- **Linha 473:** o log só é conferido contra o título. A seção do caso não tem código nem texto, então "sem código nem texto" não chega a ser exercitado.
- **Permissão:** nenhum caso mostra que o `PATCH` recusado não deixa job, nem o do professor nem o de B feito por A, que dá `NAO_ENCONTRADO`. Também falta mostrar que o `PATCH` que falha depois de validar não deixa job. Vale uma linha `jobsDaEscola === []` nos testes da 1.0 e da F4.
- **Concorrência:** falta o caso de dois jobs de recorte do mesmo material em paralelo, possível porque o lote tem 2 vagas por escola e a entrega é ao menos uma vez (D49). O caso conferiria uma execução viva por seção. Falta também o duplo clique no `PATCH` do componente gerando um job só. O "dois `PATCH` seguidos" roda os jobs em sequência.
- **Linhas 497-516** (isolamento): com a mutação, o vermelho vem do `statement_timeout` de 20 s, porque o job espera a trava. Funciona, mas é lento. Um `lock_timeout` curto, ou conferir a rejeição de forma explícita, deixaria o motivo legível.
- **Borda de domínio sem caso:** o `PATCH` de séries num material ainda `processando` ou já excluído. O job limpa, e quem agenda é a extração.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-18 09:39:58 · `tasks/prd-classificacao-bncc/6_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. O diff da 2ª rodada não toca `Nota`, correção nem job que grave nota. Todos com autor humano? sim, porque não há caminho novo.

Decisão autônoma sobre aluno: ausente. A tarefa trata da classificação BNCC de seções do material da escola e não chega a aluno.

Aprovação registrada: ok. Nenhuma saída de IA nova chega ao aluno. A limpeza continua apagando só `origem: 'ia'` e deixa de fora as seções com `corrigidaEm`. Os dois retornos antecipados mantêm isso:
- `packages/core/src/material/agendamento-da-classificacao.repository.ts:144`
- `apps/api/src/material/secoes.repository.ts:184`

O caso "`limparDoRecorte` de um material só com seção corrigida" prova que a seção corrigida pela pessoa não é tocada.

Supervisão do tutor: ok. O diff não toca o tutor.

Autonomia declarada e visível: sim, sem mudança nesta rodada.

Correções da rodada anterior: não havia nenhuma exigida. Conferi as duas recomendações:
- **Histórico da classificação descartada:** feito em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/techspec.md`, §8, no parágrafo "Duas consequências da mudança de recorte (6.0)", item (2). O texto diz que o descartado sem aprovação não fica guardado e por quê: nada chegou a aluno e não há finalidade para guardar inferência. Diz também que exigir esse histórico no dossiê (D61) seria decisão nova. Está de acordo com a regra 70, item 6, porque o que foi aprovado continua auditável.
- **Corrida entre a correção da coordenação e `limparDoRecorte`:** está registrada para a tarefa 7.0 na tabela "Recomendações sem aplicar" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/6_task.md`.

Supervisão e vigilância: o log do recorte não leva código, título nem texto, e há asserção nova para isso em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/recorte.int.test.ts`, no caso "mais seções que o lote". Não há inferência sobre pessoa.

D46/D55: o diff não tem campo, prompt ou tela de nota em discursiva ou redação.

Medir o professor (D45): nada no diff. O `PATCH` recusado ao professor responde `NAO_ENCONTRADO` e não deixa job; isso é controle de papel, não métrica.

Bloqueantes: nenhum

Recomendações:
- **Asserção de consumo retirada:** em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/recorte.int.test.ts`, o caso "sem candidatas" perdeu `consumosDa(pendente) === 0` e passou a provar só `semModelo`. Porém o comentário de `refazOsRecortes` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/worker/src/processors/agendar-classificacao.ts:270`) e a Tech Spec §8 continuam afirmando "sem consumo". O ponto é de orçamento (regra 30), não da regra 70. Vale confirmar que o `llm-integrator` ou o `test-engineer` cobrem o "sem consumo" em outro lugar, ou alinhar o texto.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-18 09:40:11 · `tasks/prd-classificacao-bncc/6_task.md`

VEREDITO: APROVADO

Caminho quente tocado: fila (o job `material.agendar-classificacao`, que vem do `PATCH` da coordenação e roda como lote fora do horário letivo). Login, tutor, sala e prova não foram tocados.

Rate limit: ok (nada mudou nesta rodada)

Fila e prioridade: ok. O job continua sendo só o id do alvo, enfileirado na mesma transação do `PATCH`. A transação da requisição não cria nenhuma execução.

Concorrência: protegida.
- O duplo clique no componente fica resolvido por `travarPorId` com `for update` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/estrutura/disciplina.repository.ts:67-74`). O segundo `PATCH` lê o componente já trocado e não enfileira nada. O caso novo "duplo clique no componente…" em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/recorte.int.test.ts` prova isso: as duas respostas são 200 e fica um job só.
- As saídas antecipadas novas não abrem janela de "busca, verifica, grava":
  - `limparDoRecorte`, quando `ids` vem vazio, devolve `ultima` indefinida e o laço termina.
  - `limparDaExecucao`, quando `limpas` vem vazio, só deixa de fazer o `delete`, e o `update … returning` continua sendo a única decisão.

Índice e paginação: ok. Não há query nova. O laço por lote com cursor e `statement_timeout` continua igual.

Degradação de IA: não se aplica. Nenhuma chamada de modelo nova. O `preparar` sem candidatas conclui sem chamar o modelo.

Migration: não se aplica.

Métrica e alerta: ok. O log `classificacao.recorte_refeito` continua só com ids e contagens, e o caso de 5 seções agora prova que o código BNCC apagado não aparece no log. Não há alerta novo.

Bloqueantes: nenhum.

Recomendações:
- O texto novo de `refazOsRecortes` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/worker/src/processors/agendar-classificacao.ts:270`) admite que um job reentregue limpa de novo os lotes já agendados. Isso deixa execuções `pendente` sem seção, que depois concluem sem modelo. Hoje o custo é só de linhas e jobs, sem gasto com IA. Esse mesmo cenário é o item do test-engineer que foi para o `TODO.md` (dois jobs do mesmo material em paralelo, uma execução viva por seção). Convém que esse caso confira também que nenhuma execução órfã chega a consumir tokens.
- O registro no runbook de que API e worker sobem juntos ficou no `TODO.md`. Ele precisa estar escrito antes do primeiro deploy desta funcionalidade, porque um worker antigo transforma o job com `materialId` ou `disciplinaId` em `DADOS_INVALIDOS` sem nova tentativa.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-18 09:40:19 · `tasks/prd-classificacao-bncc/6_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum
Recomendações:
- As três recomendações que passei para a ordem estão feitas. Faltava a saída antecipada com ids vazios, que agora está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/material/agendamento-da-classificacao.repository.ts:144` e em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/secoes.repository.ts:184`, cada uma com o seu bloco de mutação. O comentário sobre a retentativa está em `apps/worker/src/processors/agendar-classificacao.ts:144` e o texto "o mesmo conjunto de séries" em `material.service.ts:480`. A recomendação do outro revisor também entrou: `atual.id` em `disciplina.service.ts:62`.
- O caso "sem candidatas" em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/recorte.int.test.ts:421` deixou de conferir "sem consumo" e passou a se apoiar só em `preparado.semModelo`. O nome do caso foi trocado junto, então não promete o que não prova. Ainda assim, "sem consumo" é o que a Tech Spec cita no P11 e no texto novo da §8. Se um teste da 4.0 já cobre o consumo zero do `concluirSemModelo`, vale apontar esse teste no documento. Se nenhum cobre, a asserção deve voltar.
- O helper `escritasDe` (`recorte.int.test.ts:218`) intercepta `delete` e `update` por um Proxy sobre a conexão do Drizzle, o que depende da API interna da biblioteca. O resultado de hoje está certo, mas uma troca de versão pode mudar o que o Proxy enxerga e o teste passar sem conferir nada. Ele pode ser trocado por uma contagem no banco antes e depois, ou por um comentário que diga essa dependência.
- O registro em `techspec.md:212` ("Duas consequências da mudança de recorte") fecha a razão de o teto de execuções da noite ter ficado de fora, que eu tinha recomendado na 1ª rodada. Não é divergência: a §5 "Agendar" (b) nunca pediu esse teto.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-18 09:40:21 · `tasks/prd-classificacao-bncc/6_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. Desde a 1ª rodada, o diff mexe só no id do job (`disciplinaId`), em duas saídas antecipadas da limpeza e em testes. Os dados envolvidos são o código BNCC da seção (`habilidade_da_secao`, origem `ia`), o título do material e as execuções. Nenhum deles é dado de pessoa.

Fora da tabela de dados do docs/lgpd.md: nada novo. A nota na linha do código BNCC por seção continua no `TODO.md` como recomendação da 1ª rodada. Não bloqueia.

Autorização por objeto: ok.
- A recomendação da 1ª rodada foi aplicada: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/estrutura/disciplina/disciplina.service.ts:62` agora enfileira `{ disciplinaId: atual.id }`. Esse id vem de `travarPorId`, que é lido com escopo e com a linha travada, e não da URL.
- O caso novo em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/recorte.int.test.ts:177` troca o id na URL de cinco formas: professor no material, professor na disciplina, coordenação da A com o material da B, com a disciplina da B e com a série da B. Todas respondem `404 NAO_ENCONTRADO`, igual ao inexistente, e o caso confere que nenhuma das duas filas ganhou job.

Logs: limpos. O caso do lote, em `recorte.int.test.ts:153` e `:163`, agora semeia o código da IA nas seções e prova que nem esse código nem o título aparecem no log. O comentário de `refazOsRecortes` (`apps/worker/src/processors/agendar-classificacao.ts:270`) continua com "só ids e contagens".

Auditoria: presente. `disciplina.componente_alterado` é gravado na mesma transação do job. O `PATCH` que falha (409 por nome repetido) desfaz tudo, sem deixar job, e isso está provado em `recorte.int.test.ts:195`.

Envio externo: nenhum novo. Com as saídas antecipadas de `limparDoRecorte` (`packages/core/src/material/agendamento-da-classificacao.repository.ts:144`) e `limparDaExecucao` (`apps/api/src/material/secoes.repository.ts:184`), nada é apagado quando não há seção, e as duas têm teste e mutação registrados. A execução cancelada antes de rodar conclui sem modelo (P11). O caso deixou de verificar que não houve consumo, mas o nome dele foi corrigido e não promete mais do que prova.

Seed/fixture: sintético. As escolas são criadas pelo próprio teste, o código BNCC é o `EF06CI01` e o título é "sigilosa".

Bloqueantes: nenhum.

Recomendações:
- Um parágrafo novo da Tech Spec (`techspec.md`, §8) diz que a classificação descartada pela mudança de recorte não guarda histórico, e que isso foi escolha de minimização. Vale levar esse texto à linha de `habilidade_da_secao` em `docs/lgpd.md`, junto do item que já está no `TODO.md`, para o dossiê (D61) ter a mesma justificativa.
- A árvore de trabalho difere da `a2abe45` só em `tasks/prd-classificacao-bncc/6_task.md`, por 2 linhas, que parecem ser a tabela de revisões preenchida pelo hook. Não há código fora do que auditei.

## test-engineer · 2ª rodada · APROVADO · 2026-11-18 09:40:55 · `tasks/prd-classificacao-bncc/6_task.md`

VEREDITO: APROVADO

Cenários exigidos:
- **Correção exigida 1:** "dois `PATCH` seguidos com os dois jobs na fila: vale o recorte do segundo", nas duas ordens. O teste precisa falhar se os jobs não refizerem nada.
- **Recomendações que você mandou cumprir:**
  - o mesmo endurecimento no caso do componente apagado e definido de novo;
  - `length > 0` antes dos `every`;
  - a asserção de consumo da antiga linha 426;
  - o log "sem código nem texto";
  - o `PATCH` recusado não deixa job;
  - duplo clique no componente.
- **Código novo do diff:** os dois retornos antecipados, em `limparDoRecorte` e `limparDaExecucao`, e a troca de `id` por `atual.id`. Cada um precisa de um bloco de mutação com teste.
- **Itens passados ao `TODO.md`:** dois jobs de recorte do mesmo material em paralelo, e o `PATCH` num material `processando` ou excluído.

Cobertos:
- **Correção 1, feita.** O caso está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/recorte.int.test.ts:309-331`. Nas duas ordens, ele confere quatro coisas:
  - `execucaoId` é diferente de `antiga`;
  - a execução está `pendente`;
  - `habilidadesDa(secao)` volta vazio;
  - as candidatas são do 6º.

  Se os jobs não refizerem nada, a execução continua a `antiga` e o código continua na seção, e o teste fica vermelho.
- **Componente apagado e definido de novo:** o caso agora tem `not.toBe(antiga)` e a seção limpa (linhas 358-374).
- **`every` sobre lista vazia:** o novo `soDoRecorte` (linha 59) exige ao menos uma candidata. Ele substituiu os quatro `every`.
- **Asserção de consumo:** saiu, porque não provava nada, e o nome do caso foi trocado. O caso continua conferindo `preparado.semModelo === true` (linha 429).
- **Log:** as cinco seções agora começam com o código da IA (linha 461), e o caso confere que esse código não aparece no log (linha 471).
- **`PATCH` recusado:** os casos estão nas linhas 602-620. Cobrem o professor, a coordenação da escola A com o id da B (material e disciplina) e a série da escola B num material da A. Todos devolvem 404 `NAO_ENCONTRADO`, e a fila das duas escolas fica vazia. Isso cobre o isolamento e a permissão.
- **Duplo clique:** é concorrência de verdade, com dois `PATCH` HTTP disparados por `Promise.all`. Só um job sai, com `{ disciplinaId }` (linhas 632-639). O que garante isso é a trava `travarPorId`, que existe desde a 1.0.
- **Os dois retornos antecipados:** cada um tem bloco de mutação no `6_task.md`, e o teste citado em cada bloco falharia com a linha removida.
  - Sem o retorno de `limparDoRecorte`, a transação faria `delete` e `update`, e o teste espera nenhuma escrita (`[]`).
  - Sem o retorno de `limparDaExecucao`, a lista de escritas viraria `['update','delete']`, e o teste espera só `['update']`.

  O `Proxy` só registra as chamadas e repassa para a conexão real; não esconde a regra.
- **Bloco de `atual.id`:** foi atualizado para a linha nova.
- **Itens do `TODO.md`:** os dois que eu pedi estão registrados, com dono e arquivo.
- **Teste rodado:** `npx vitest run apps/api/src/material/recorte.int.test.ts` passou, 25 de 25. O arquivo no disco é o mesmo da árvore auditada (blob `288823c6`).
- **Tudo mais:** sem `.skip`, sem teste comentado, e nenhum provedor pago.

Bloqueantes: nenhum.

Recomendações:
- **Linhas 622-630, "o `PATCH` de disciplina que falha depois de validar…":** hoje o nome é tratado antes do componente, então o erro 409 acontece antes de chegar ao código que enfileira o job. Por isso "não deixa job" vale mesmo que a transação não desfizesse nada. O caso só prova o desfazer se essa ordem mudar um dia.

  Para que ele prove o desfazer da transação, há dois caminhos: provocar a falha depois do `enfileirarUmaVez`, ou trocar o nome do caso para "o nome repetido é recusado antes do componente". Vai para o `TODO.md`.
- **Linhas 643-669, os casos com `Proxy`:** eles amarram o teste aos nomes dos métodos do Drizzle (`delete` e `update`). Se uma atualização do Drizzle mudar esses nomes, os casos quebram sem que a regra tenha mudado. Só registro; não precisa mudar agora.
