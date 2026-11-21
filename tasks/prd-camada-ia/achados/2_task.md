# Achados das revisões — `tasks/prd-camada-ia/2_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-21 03:32:02 · `tasks/prd-camada-ia/2_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A tarefa não grava, não lê e não mexe em `Nota`, em `Correcao` nem em nenhum caminho que chegue a elas. Se todos têm autor humano não se aplica, porque não há caminho.

Decisão autônoma sobre aluno: ausente. O aluno só entra como número: `count(distinct v.usuario_id)` em `alunosAtivosDaEscola` e `alunos_ativos` no retrato do mês. Nada classifica, aprova, reprova ou encaminha aluno.

Aprovação registrada: ok. A tarefa não tem saída de IA que chegue ao aluno. Nenhum fluxo de entrega ou artefato mudou, e a exceção do tutor (D47) não aparece em nenhum outro lugar.

Supervisão do tutor: ok. O tutor não muda. O glossário (`docs/glossario.md`, "Teto de segurança") e o comentário de `IA_ORCAMENTO_ESGOTADO` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/packages/shared/src/errors/error-code.ts:97`) dizem que só a fila de lote espera. O Tutor e a ferramenta com o professor esperando nunca param, e o freio por aluno (D38) segue com código próprio.

Autonomia declarada e visível: sim. Nenhum agente novo e nenhuma mudança de nível nesta tarefa.

Os outros pontos do checklist:
- **Item 6 (auditoria):** nada muda no que a IA gerou nem no que foi aprovado. A auditoria de mudança de valor (`escola.orcamento_ia_alterado` e `rede.orcamento_ia_alterado`) só está descrita em `docs/lgpd.md` e chega na 3.0.
- **Item 7 (supervisão não é vigilância):** não há inferência emocional, tempo ocioso nem navegação. `consumo_ia.pelo_provedor_de_reserva` é só um contador da Operação.
- **Item 8 (D46/D55):** nenhum campo, prompt ou tela sobre discursiva ou redação.
- **Itens 8 e 9 da regra 70 (D45/D64):** o orçamento é só por escola e por rede. `consumo_ia` continua sem usuário (a nota em `docs/modelo-de-dados.md` confirma). Não há métrica por professor, ranking nem indicador de adoção, e a coordenação vê só a porcentagem, sem reais nem tokens (D40).
- `docs/regulacao.md` não foi alterado.

Bloqueantes: nenhum.

Recomendações:
- O comentário de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/packages/core/drizzle/0067_indice_do_consumo_do_mes.sql` (penúltima linha de comentário) diz que o `EXPLAIN` está em `orcamento-do-mes.repository.int.test.ts`. Ele está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/packages/core/src/ia/orcamento-do-mes.plano.int.test.ts:60`. Vale corrigir na próxima vez que alguém mexer nesse arquivo. Não é da regra 70.
- Para a 4.0: quando o teto de segurança segurar a fila de lote, a espera não pode transformar a correção de objetiva em lote numa nota. Ela tem que continuar pendente de aprovação humana (D33, D56). Também não pode adiar a vista da avaliação sem que o professor seja avisado. Vale escrever isso na auditoria da 4.0.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-21 03:32:05 · `tasks/prd-camada-ia/2_task.md`

VEREDITO: APROVADO

Tabelas verificadas:
- `orcamento_ia_do_mes`: tem `escola_id uuid not null`, com FK para `escola` e PK `(escola_id, mes)`. Não tem `anoLetivoId`, e a justificativa está escrita no schema e em `docs/modelo-de-dados.md`: é série no tempo, como `consumo_ia` e `uso_infra_diario`. Aceito.
- `configuracao_operacional_escola`: ganhou duas colunas. A tabela já é por escola.
- `rede`: ganhou duas colunas. É a raiz acima do tenant, sem dado de pessoa.
- `consumo_ia`: ganhou `pelo_provedor_de_reserva`. A tabela já tem escopo, e o índice novo `consumo_ia_mes_idx` começa por `escola_id`.

Queries verificadas (todas em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/packages/core/src/ia/orcamento-do-mes.repository.ts`):
- `consultaDoCustoDoMes` e `custoDoMes`: filtram `eq(consumoIa.escolaId, requireEscolaId())`.
- `alunosAtivos`: passa `requireEscolaId()` para `alunosAtivosDaEscola`, e os joins casam `escola_id` em `usuario` e `ano_letivo`.
- `configuracaoDaEscola`: filtra `eq(configuracaoOperacionalEscola.escolaId, requireEscolaId())`.
- `configuracaoDaRede`: acha a rede pelo `e.rede_id` da escola do contexto. Nenhum id de rede vem de fora.
- `retrato`: filtra por `escola_id` do contexto e pelo mês.
- `regravarRetrato`: o insert e o upsert usam a escola do contexto e o conflito em `(escola_id, mes)`.
- Nenhum endpoint novo e nenhum `@Unscoped`. O `architecture.test.ts` trava a lista exata de métodos e reprova se aparecer exceção.
- A rede só lê configuração dela mesma, então nada da camada rede chega a dado individual.

Teste de isolamento: presente e efetivo. Rodei `orcamento-do-mes.repository.int.test.ts` (18/18 verdes) e a guarda `repositories-com-escopo` junto com `orcamento-de-ia.test.ts` (62/62 verdes). Tirando mentalmente cada cláusula de escopo, o teste quebra:
- **Soma do mês:** A leria R$ 1.100 em vez de R$ 100.
- **Alunos ativos:** a conta passaria a pegar o banco inteiro, e o 100/900 falha.
- **Configuração da escola** (variante 1) e **rede** (variante 2): sem o filtro vem uma linha qualquer, e A e B são conferidas cada uma.
- **Retrato:** A leria o retrato de B, e o `toBeUndefined()` falha.
- **Contexto ausente:** a leitura falha fechada.

Bloqueantes: nenhum

Recomendações:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/packages/core/src/ia/orcamento-do-mes.repository.ts:24`: `alunosAtivosDaEscola(escolaId: SQL)` está exportado no índice do núcleo e recebe a escola por parâmetro. Hoje só é chamado com `requireEscolaId()`. Vale escrever no docblock que o fragmento só pode ser usado com o id do contexto ou dentro de método `@Unscoped` da Operação, nunca com valor vindo de requisição. Isso precisa ser conferido quando a 5.0 passar a usá-lo.
2. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/apps/api/src/operacao/painel/painel.repository.ts:102`: `pessoasComVinculo` continua como cópia própria. Não foi trocado pelo trecho exportado, ao contrário do que diz a autoconferência (item 9) da tarefa. São duas versões da mesma contagem que podem divergir (RF8). Convém unificar na 5.0 ou corrigir o texto da tarefa.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-21 03:32:35 · `tasks/prd-camada-ia/2_task.md`

VEREDITO: APROVADO
Caminho quente tocado: migration
Rate limit: ok (a tarefa não tem rota)
Fila e prioridade: ok (a tarefa não tem job; o teto do lote e a medida ficam para a 4.0)
Concorrência: protegida. `regravarRetrato` faz `insert … on conflict do update` sobre a chave `(escola_id, mes)`. A corrida entre duas medidas cai na mesma chave e é resolvida no banco.
Índice e paginação: ok
- A soma do mês sai só do `consumo_ia_mes_idx`. O teste do plano roda o `EXPLAIN (ANALYZE)` com 1,8 milhão de linhas e mostra `Index Only Scan`, sem leitura na tabela e sem `Seq Scan`.
- A contagem de alunos ativos começa por `escola_id` e cai em `vinculo_usuario_idx`.
- Não há listagem nova.

Degradação de IA: não se aplica
Migration: compatível
- A `0066` só expande: as colunas novas aceitam nulo, e o `default false` da coluna de `consumo_ia` é constante, então a tabela não é reescrita. Os checks novos caem em tabelas pequenas, com uma linha por escola ou por rede.
- A `0067` cria o índice sem `concurrently`, numa migration à parte, com `lock_timeout` de 5 s e deploy fora do horário letivo. É o mesmo arranjo da 0057 e da 0064, previsto na Tech Spec §3.
- O runbook ganhou a seção de volta do código.

Métrica e alerta: ok (não há código novo no caminho quente; a medida é da 4.0)
Bloqueantes: nenhum

Recomendações:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/packages/core/drizzle/0067_indice_do_consumo_do_mes.sql:6-7`: o comentário diz que a criação com volume de produção vai para uma migration fora do `migrar`, com `concurrently`, e cita o `TODO.md`. Só que o `TODO.md` não ganhou essa entrada. Falta pôr a 0067 na lista "Migrations 0025, 0026 e 0027… antes do staging", ao lado da 0057 e da 0064. A entrada deve dizer:
   - que `consumo_ia` é a tabela que mais cresce;
   - que, com volume real, o `statement_timeout` do migrador entra na conta.
2. A trava exclusiva que a `0066` pega em `consumo_ia` (`ADD COLUMN`) dura até o fim da transação do `migrar`, inclusive durante a construção do índice da `0067`. A escrita em `consumo_ia` fica parada até o índice terminar. Hoje isso cabe, porque o deploy é fora do horário letivo, mas vale uma linha no runbook, na seção "Se a `0067` falhar no deploy".
3. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/packages/core/src/ia/orcamento-do-mes.repository.int.test.ts:256`: o caso "regravar não duplica" grava duas vezes em sequência. Um `Promise.all` com duas `regravarRetrato` ao mesmo tempo, conferindo que fica uma linha só, provaria a corrida da medida duplicada que a 4.0 vai disparar.
4. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/apps/api/src/operacao/painel/painel.repository.ts:102` continua com uma cópia própria da contagem de alunos ativos (`pessoasComVinculo`). O `alunosAtivosDaEscola` novo exige `encerrado_em is null`, e a cópia do painel não tem essa linha, então as duas contas podem dar números diferentes. O RF8 pede o mesmo número na tela e no orçamento: a 5.0 deve passar a aba Escolas para o trecho exportado.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-21 03:32:38 · `tasks/prd-camada-ia/2_task.md`

VEREDITO: APROVADO

**Campos pessoais tocados:** nenhum dado de titular escolar novo.
- `configuracao_operacional_escola.ia_valor_por_aluno_micros` e `ia_teto_de_seguranca_percentual`, e as mesmas duas colunas em `rede`, guardam só dinheiro e percentual.
- `orcamento_ia_do_mes` guarda a escola, o mês, os alunos ativos como contagem, o valor, o teto e a origem do valor.
- `consumo_ia.pelo_provedor_de_reserva` é um booleano técnico. Ele fica numa linha que pode ter `aluno_id`, mas não diz nada novo sobre a pessoa: quem recebeu o dado continua em `provedor`.

**Fora da tabela de dados do docs/lgpd.md:** nada bloqueante.
- A linha nova do orçamento de IA traz finalidade, base e retenção.
- `orcamento_ia_do_mes` está como `SEM_PESSOA` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/packages/shared/src/privacidade/classificacao.ts:147`.
- A linha 99, a de `consumo_ia`, ainda não cita `pelo_provedor_de_reserva`. Está na primeira recomendação.

**Autorização por objeto:** ok. A tarefa não cria rota. Todo método do repository lê pela escola do contexto (`requireEscolaId()`), e a rede é lida pelo `escola.rede_id` dessa escola (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/packages/core/src/ia/orcamento-do-mes.repository.ts:87-91`), nunca por id vindo de fora. Nenhum método é `@Unscoped`, e o `architecture.test.ts` confere isso pela lista exata de métodos.

**Logs:** limpos. O repository e a função pura não logam nada. O logger do teste do plano roda no nível `silent`.

**Auditoria:** não se aplica nesta tarefa, porque ela não tem escrita por rota. A linha do `docs/lgpd.md` já promete `escola.orcamento_ia_alterado` e `rede.orcamento_ia_alterado` com antes, depois e o operador. Quem cumpre é a 3.0, e a revisão da 3.0 precisa cobrar.

**Envio externo:** nenhum novo.

**Seed/fixture:** sintético: "Aluno sintético", "Professor sintético", "Coordenação sintética", e-mails `@educa.invalid` e escolas "grande", "media" e "pequena" no teste do plano.

**Pergunta de fechamento:** o código responde.
- O arquivo do titular continua lendo `consumo_ia`, com `provedor` e `envio_externo`, que respondem para onde o dado foi.
- A coluna nova está em `fora` com motivo escrito (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/packages/core/src/titular/leitura-do-titular.ts:738`).
- O retrato não guarda pessoa.

Rodei `orcamento-de-ia.test.ts`, `leitura-do-titular.test.ts`, os testes de `privacidade/` e o `architecture.test.ts`, e todos passaram. Os testes de integração não rodei.

**Bloqueantes:** nenhum.

**Recomendações:**
1. Coloque `pelo_provedor_de_reserva` na linha 99 do `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/docs/lgpd.md` na tarefa que começa a gravar a coluna como verdadeira, a 10.0 (subtarefa 10.4). Hoje isso está marcado para a 11.4, e a regra 20, item 1, pede que a tabela mude na mesma tarefa que grava o campo. Junto, a 10.0 precisa ter um teste provando que, na linha atendida pela reserva, `provedor` guarda o id da reserva. Só esse teste garante que a justificativa de deixar a coluna fora do arquivo do titular se sustenta.
2. O tipo `OrcamentoDoMes` traz reais (`valorPorAlunoMicros`, `orcamentoMicros`, `custoMicros`). Isso não é dado pessoal, mas pela D40 a coordenação vê só a porcentagem. As tarefas 3.0 e 5.0 precisam de DTOs de saída próprios para cada papel, sem devolver esse tipo inteiro na rota da coordenação.
3. Na revisão da 3.0, confira que a auditoria da mudança de valor e de teto existe de fato, já que a linha nova do `docs/lgpd.md` a dá como certa.

## test-engineer · 1ª rodada · APROVADO · 2026-11-21 03:33:17 · `tasks/prd-camada-ia/2_task.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- **Precedência coluna a coluna:**
  - a escola sem valor usa o da rede;
  - o valor da escola vale sobre o da rede;
  - a escola com teto próprio e sem valor fica com o teto dela e o valor da rede;
  - sem nada na escola nem na rede, o teto é o padrão de 200% e a origem é "nenhuma".
- **A conta:** 100 alunos × R$ 5 com R$ 400 gastos dá 80%. A porcentagem arredonda para baixo (79,99% vira 79). O aviso vem a 80% e a 100% exatos. O mês fechado não tem aviso. Os casos `sem_orcamento`, `sem_aluno_ativo` e `sem_retrato` têm teste.
- **Mês e dia de São Paulo:** a chamada de 31/03 às 23h30 (UTC-3) conta em março, e as bordas do mês são exatas. A virada de 31/12 para 1º/01 também está coberta.
- **Custo gravado:** com duas vigências de preço no mês, a soma usa o custo gravado de cada linha, sem recalcular.
- **Alunos ativos:**
  - não contam: o vínculo encerrado (aluno transferido), o vínculo não encerrado do ano anterior (virada do ano letivo), o professor e o usuário desativado;
  - contam: o aluno que chegou agora, e o aluno em duas turmas conta uma vez só;
  - sem ano `em_curso`, o total é zero.
- **Retrato:** regravar não duplica a linha e grava o "agora" passado pelo chamador. Às 21h30 do último dia ele grava o mês que acaba. O mês fechado guarda o último retrato mesmo depois de o valor e os alunos mudarem. Cada mês tem o seu.
- **Isolamento** com A (100 alunos, 20%) e B (900 alunos, 111%) em redes diferentes, cada leitura conferida nas duas escolas: soma, alunos ativos, configuração da escola (variante 1), rede (variante 2) e retrato. Sem escola no contexto, a leitura falha fechada.
- **Exceções declaradas:** nenhum método é `@Unscoped`.
- **O índice:** `EXPLAIN` da soma do mês com 1,8 milhão de linhas.
- **As migrations:** a `0067` tem `lock_timeout` e nenhum `concurrently`, e a `0066` só expande.
- **Os checks:** cada um recusa o valor fora da faixa no banco, e o schema `.ts` declara os mesmos checks que o banco tem.
- **Permissão:** o repository não tem papel. A permissão é das rotas (3.0, 5.0 e 6.0), e aqui ela se reduz à falha fechada sem contexto.

**Cobertos:** todas as linhas da tabela "Testes que provam a regra", cada uma com o caso citado pelo nome. Conferi as linhas compostas item por item, inclusive as separadas por ponto e vírgula. O que rodei:
- `orcamento-de-ia.test.ts` e `migracao-do-orcamento-de-ia.test.ts`: 13 casos verdes;
- `orcamento-do-mes.repository.int.test.ts`: 18 casos verdes;
- `mutacoes.ts --faltando`: nenhuma linha sem bloco.

Conferi os 58 blocos contra o código. Cada um alcança a cláusula pelo cenário certo, por exemplo:
- tirar `pessoa.id = v.usuario_id` faz o aluno desativado contar, e o total sobe de 3 para 4;
- tirar `ano.id = v.ano_letivo_id` faz os 5 vínculos do ano anterior entrarem, e o total vai a 7;
- a conversão `as unknown as number` devolve texto, e o `toEqual` falha;
- `doMes(..., true)` no mês fechado traz o aviso de 80, que o teste espera nulo.

Não há `.skip`, mock de coisa nossa nem chamada a provedor de IA. As asserções comparam o `OrcamentoDoMes` devolvido, o banco e o plano da consulta que o repository executa.

Não rodei `orcamento-do-mes.plano.int.test.ts`: são 1,8 milhão de linhas e cerca de 100 s. Li o código. A carga vai para um banco só dele, com `vacuum analyze` antes, e as asserções não dependem de prazo.

**Bloqueantes:** nenhum.

**Recomendações:**
1. O comentário em `packages/core/drizzle/0067_indice_do_consumo_do_mes.sql:8` diz que o `EXPLAIN` está em `orcamento-do-mes.repository.int.test.ts`. Ele está em `orcamento-do-mes.plano.int.test.ts`. A autoconferência 7 diz que esse comentário foi relido.
2. A corrida do retrato (duas réplicas da medida, `cenarios.md` §3) está atribuída à 4.0, e aqui só há duas gravações em sequência. O `on conflict do update` resolve a corrida no banco, e o caso em sequência já derruba o `insert` sem `on conflict`. Ainda assim, um `Promise.all` de dois `regravarRetrato` na mesma escola custaria pouco neste arquivo. Também vale garantir que a 4.0 entregue o caso com `esperarNaTrava`.
3. O caso "sem escola no contexto falha fechada" (`orcamento-do-mes.repository.int.test.ts:369-372`) cobre só `custoDoMes` e `alunosAtivos`. Vale incluir `configuracaoDaEscola`, `configuracaoDaRede`, `retrato` e `regravarRetrato`.
4. `orcamento-do-mes.repository.int.test.ts:146`: o `expect(ficou).toBeDefined()` sempre passa. Ou se tira, ou se confere que o aluno que ficou é o contado.
5. `orcamento-do-mes.plano.int.test.ts` acrescenta cerca de 100 s de carga ao projeto `integracao` em toda esteira. Vale pensar em levá-lo para o projeto de infra, ou rodá-lo só quando o índice ou a consulta mudarem.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/packages/core/src/ia/orcamento-do-mes.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/packages/core/src/ia/orcamento-do-mes.repository.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/packages/core/src/ia/orcamento-do-mes.plano.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/packages/shared/src/governanca/orcamento-de-ia.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/packages/shared/src/governanca/orcamento-de-ia.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/packages/core/src/db/migracao-do-orcamento-de-ia.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/packages/core/drizzle/0067_indice_do_consumo_do_mes.sql`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/apps/api/test/architecture.test.ts`

## revisor-geral · 1ª rodada · APROVADO · 2026-11-21 03:33:45 · `tasks/prd-camada-ia/2_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

As oito subtarefas foram feitas e a tarefa não entrou em trabalho futuro: não há rota, medida nem teto do lote, que são da 3.0, da 4.0 e da 5.0. O que a `techspec.md` define bate com o código: as colunas da §3 e os checks delas, a `pk (escola_id, mes)` do retrato, a precedência coluna a coluna, o teto padrão de 200%, o `>=` do aviso, o mês fechado sem aviso, os alunos ativos da §5 e a leitura pela escola do contexto, sem `@Unscoped` (§6). As quatro divergências do `2_task.md` não mudam arquitetura nem regra, então não precisavam ir à `techspec.md` nem ao `cenarios.md`.

Recomendações:

1. **Comentário errado na 0067** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/packages/core/drizzle/0067_indice_do_consumo_do_mes.sql`, cabeçalho). Três trechos afirmam o que não acontece:
   - "para o `lock_timeout` e o `rollback` valerem só para ela" é falso. O `migrate.ts` roda todas as migrations numa transação só, e o `SET LOCAL` vale até o fim dela. O próprio runbook diz o contrário: se a 0067 falhar, a 0066 também é desfeita.
   - O comentário cita o `EXPLAIN` em `orcamento-do-mes.repository.int.test.ts`, mas ele está em `orcamento-do-mes.plano.int.test.ts`.
   - Ele remete a um item do `TODO.md` que não existe. Falta pôr a 0067 na lista dos índices sem `concurrently`, junto da 0057 e da 0064 (`TODO.md:262`), contando também o `statement_timeout` de 2 s do migrador. Isso é da área do `infra-guardian`.
2. **A conta dos alunos ativos agora existe em dois lugares.** A tarefa pedia que a contagem de `PainelRepository.escolas()` virasse o trecho comum. Em vez disso, `alunosAtivosDaEscola` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/packages/core/src/ia/orcamento-do-mes.repository.ts:24`) é uma cópia, e `apps/api/src/operacao/painel/painel.repository.ts:103-141` continua com a conta própria. Hoje as duas dão o mesmo número, mas podem se separar, e o RF8 pede que o orçamento e a tela partam do mesmo número. Vale fazer o `escolas()` usar o trecho exportado, nesta tarefa ou na 5.0. A resposta 9 da autoconferência descreve isso como extração, o que não é exato.
3. **O mês e o dia de São Paulo passam a ter duas implementações.** `diaDeSaoPaulo` e `FUSO_DO_ORCAMENTO` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/packages/shared/src/governanca/orcamento-de-ia.ts:14,114-120`) são cópias de `diaDeUso` e `FUSO_DO_USO` (`packages/core/src/usage/usage-day.ts`). Sugestão: deixar uma só no `shared` e fazer o `core` delegar a ela.
4. **Legibilidade no repository** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/packages/core/src/ia/orcamento-do-mes.repository.ts`):
   - Linha 74: `rows.reduce(...)` para ler uma linha só. `rows[0]?.total ?? 0` é mais direto.
   - Linha 142: `const [a, b] = [await x(), await y()]` parece paralelo e não é. Duas linhas `const` sequenciais deixam isso claro.
5. **Comentário que antecipa a 4.0** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/packages/shared/src/errors/error-code.ts:97-100`). O texto novo de `IA_ORCAMENTO_ESGOTADO` diz "só a fila de lote o recebe", mas hoje quem devolve o código é o `InMemoryOrcamento` (`packages/core/src/ia/consumo.ts:223`), pelo limite de tokens e sem olhar a fila. Isso só fica verdade com a 4.0. Ou o texto diz isso, ou a 4.0 confere o comentário ao terminar.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-21 03:49:24 · `tasks/prd-camada-ia/2_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nesta rodada. O diff não mexe em schema nem em migration. A 0067 só teve o comentário trocado: o SQL do índice `consumo_ia_mes_idx` está igual. `orcamento_ia_do_mes` e `consumo_ia` continuam como foram aprovados na 1ª rodada.

Queries verificadas: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/packages/core/src/ia/orcamento-do-mes.repository.ts`
- `retratoDeHoje`: duas chamadas `await` em sequência. O escopo não mudou: `alunosAtivos` e `vigente` continuam partindo de `requireEscolaId()`.
- O docblock de `alunosAtivosDaEscola` agora diz que o trecho só pode receber o id do contexto, ou o `e.id` dentro de um método `@Unscoped` da Operação, e nunca um valor vindo de requisição. Isso atende a recomendação 7.
- Nenhum `@Unscoped` novo. Nenhum endpoint novo, e nenhum `escolaId` vindo do cliente.

Teste de isolamento: presente e efetivo.
- O caso "sem escola no contexto" (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/packages/core/src/ia/orcamento-do-mes.repository.int.test.ts:377-384`) agora cobre os seis métodos. `configuracaoDaEscola` (l.83), `configuracaoDaRede` (l.92), `retrato` (l.112) e `regravarRetrato` (pelo `retratoDeHoje`, e na l.136) chegam todos a `requireEscolaId()`, que lança a `InvariantException` com "sem escola no contexto". Se a chamada fosse trocada por um id vindo de fora, a asserção quebraria.
- O caso novo da corrida, com `Promise.all`, lê `orcamento_ia_do_mes` filtrando pelo `escola_id`. Ele não depende de dado de outra escola.
- A asserção `expect(ficou).toBeDefined()`, que sempre passava, foi retirada. O caso continua provando a contagem: 1 depois do encerramento, 2 depois da chegada.

Correções exigidas na rodada anterior: nenhuma. As 10 recomendações da ordem `2_task-r1.md` constam no diff. Os itens que ficaram sem aplicar estão no `TODO.md` e na tabela "Sem aplicar" do `2_task.md`, cada um com dono.

Bloqueantes: nenhum.

Recomendações:
- Na 5.0, quando `PainelRepository` passar a usar `alunosAtivosDaEscola` (`apps/api/src/operacao/painel/painel.repository.ts:102`, item já no `TODO.md`), conferir que o argumento é `e.id` dentro de um método `@Unscoped` com justificativa escrita, como o docblock exige agora.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-21 03:49:30 · `tasks/prd-camada-ia/2_task.md`

VEREDITO: APROVADO

Esta é a 2ª rodada. Auditei só o diff de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/.processo/ordens/diff-2-r2.patch` e o que ele afeta. A 1ª rodada aprovou sem bloqueante, então não havia correção exigida a conferir. Conferi que as 10 recomendações da ordem `2_task-r1.md` estão na árvore de trabalho e que nenhuma delas toca dado de pessoa.

Campos pessoais tocados: nenhum. O diff mexe em comentário de migration, runbook, `TODO.md`, no texto da tarefa, no docblock e na forma do código de `retratoDeHoje`, no comentário de `IA_ORCAMENTO_ESGOTADO` e em casos de teste. Nada de schema mudou desde a 1ª rodada.
Fora da tabela de dados do docs/lgpd.md: nada novo. As minhas três recomendações da 1ª rodada estão no `TODO.md` com dono: `pelo_provedor_de_reserva` com a 10.0, o DTO de `OrcamentoDoMes` por papel com a 3.0 e a 5.0, e a auditoria de valor e teto com a 3.0.
Autorização por objeto: ok. O docblock de `alunosAtivosDaEscola` (`packages/core/src/ia/orcamento-do-mes.repository.ts:20`) agora diz que o fragmento só aceita o id do contexto ou, num `@Unscoped` da Operação, o `e.id` da consulta, e nunca um valor vindo de requisição. O caso "sem escola no contexto" agora cobre os seis métodos, e todos falham fechados (`orcamento-do-mes.repository.int.test.ts:377-384`).
Logs: limpos. O diff não acrescenta log, e o repository não tem logger nem `console`.
Auditoria: não se aplica a este diff. Nenhuma ação que a regra 20, item 10, exige auditoria foi criada ou mudada.
Envio externo: nenhum.
Seed/fixture: sintético. O caso novo da corrida (`orcamento-do-mes.repository.int.test.ts:297`) usa a escola e os alunos que o próprio teste cria.
Bloqueantes: nenhum.
Recomendações:
- O título do caso em `orcamento-do-mes.repository.int.test.ts:297` diz "a do último valor", mas as duas regravações gravam o mesmo valor, e o caso confere só a contagem e o mês. Ou o título diz só "uma linha só", ou o caso confere o instante gravado. Não toca dado pessoal; fica para o `test-engineer`.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-21 03:49:36 · `tasks/prd-camada-ia/2_task.md`

VEREDITO: APROVADO
Caminho quente tocado: migration, IA (o orçamento que a fila de lote vai ler na 4.0)
Rate limit: ok (a 2.0 não abre rota nem limitador)
Fila e prioridade: ok (a 2.0 não enfileira nada)
Concorrência: protegida. `regravarRetrato` usa `insert … on conflict do update` na chave `(escola_id, mes)`. O caso novo dispara duas regravações ao mesmo tempo com `Promise.all` e confere que fica uma linha só (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/packages/core/src/ia/orcamento-do-mes.repository.int.test.ts:297`).
Índice e paginação: ok. O `EXPLAIN` está em `orcamento-do-mes.plano.int.test.ts`, e agora o comentário da 0067 aponta para ele.
Degradação de IA: não se aplica nesta rodada
Migration: compatível. O cabeçalho da 0067 agora descreve como ela roda de fato: uma transação só, e o `SET LOCAL` vale até o fim dela. O runbook diz que a trava da 0066 em `consumo_ia` dura até o índice terminar. O `TODO.md` põe a 0067 na lista das migrations sem `concurrently`, contando o `statement_timeout` de 2 s.
Métrica e alerta: ok (nada novo no caminho quente)
Bloqueantes: nenhum

Conferi uma a uma as 10 correções da `.processo/ordens/2_task-r1.md` contra o diff, e todas estão feitas:
1. O cabeçalho da 0067 foi corrigido nos três trechos.
2. A entrada da 0067 entrou no `TODO.md:263`.
3. O parágrafo do runbook sobre a trava da 0066 entrou.
4. O caso da corrida com `Promise.all` entrou.
5. O caso "sem escola no contexto" cobre agora os seis métodos.
6. A asserção `expect(ficou).toBeDefined()` saiu.
7. O docblock de `alunosAtivosDaEscola` diz que o id vem só do contexto ou de método `@Unscoped`.
8. `retratoDeHoje` está em duas linhas `const`, sem mudar comportamento, porque já era sequencial.
9. O comentário de `IA_ORCAMENTO_ESGOTADO` diz o que vale hoje e deixa a conferência para a 4.0.
10. A autoconferência 9 diz "cópia". A tabela "Sem aplicar" foi copiada para o `2_task.md` e para o `TODO.md`.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/packages/core/src/ia/orcamento-do-mes.repository.int.test.ts:297`: o título promete "a do último valor", mas as duas regravações gravam o mesmo retrato, então o teste prova "uma linha só" e não qual valor fica. Ajustar o título, ou deixar para o caso com `esperarNaTrava` da 4.0, que já está no `TODO.md`.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-21 03:49:51 · `tasks/prd-camada-ia/2_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

As 10 correções da ordem `.processo/ordens/2_task-r1.md` foram feitas, cada uma no arquivo e no ponto que a ordem indica:

1. **Comentário da 0067:** agora diz que o `migrate` roda as duas migrations numa transação só e que, se a 0067 falhar, a 0066 também é desfeita. O teste que mostra o `EXPLAIN` ficou com o nome certo (`orcamento-do-mes.plano.int.test.ts`), e a remissão ao `TODO.md` passou a existir.
2. **TODO.md:** a 0067 entrou na lista das migrations sem `concurrently`, junto da 0057 e da 0064. A entrada diz que `consumo_ia` é a tabela que mais cresce e conta o `statement_timeout` de 2 s do migrador.
3. **Runbook:** ganhou a frase sobre a trava da 0066, que dura até o fim da transação e para a escrita em `consumo_ia` enquanto o índice é construído.
4. **Corrida do retrato:** caso novo com `Promise.all` e duas `regravarRetrato` ao mesmo tempo. Ele confere que fica uma linha só por `(escola_id, mes)`.
5. **Sem escola no contexto:** o caso agora cobre os seis métodos.
6. **Asserção vazia:** o `expect(ficou).toBeDefined()` saiu.
7. **Docblock de `alunosAtivosDaEscola`:** diz que o trecho só pode ser usado com o id do contexto ou dentro de método `@Unscoped` da Operação, nunca com valor vindo de requisição.
8. **`retratoDeHoje`:** está em duas linhas `const` em sequência.
9. **Comentário de `IA_ORCAMENTO_ESGOTADO`:** diz o que vale hoje e deixa a conferência do texto para a 4.0.
10. **Autoconferência 9:** diz "cópia" e aponta a unificação para a 5.0. As recomendações sem aplicar estão no `2_task.md` e no `TODO.md`, cada uma com dono.

Recomendações:
- O nome do caso novo em `packages/core/src/ia/orcamento-do-mes.repository.int.test.ts:297` diz "a do último valor", mas as duas regravações gravam o mesmo valor. O teste prova a linha única, não qual gravação ficou por último. Ou o nome perde "a do último valor", ou cada chamada usa um `agora` diferente e o teste confere o `atualizado_em`.
- A autoconferência 10 de `tasks/prd-camada-ia/2_task.md` ainda diz que o caso "regravar não duplica" grava duas vezes em sequência. Falta citar o caso novo, que prova a corrida.
- O comentário de `IA_ORCAMENTO_ESGOTADO` (`packages/shared/src/errors/error-code.ts:135`) traz uma instrução do processo ("a 4.0 confere este texto ao terminar"). Isso costuma ser esquecido. Se não houver item no `TODO.md` para a 4.0, vale criar um.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-21 03:49:51 · `tasks/prd-camada-ia/2_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. Nem o diff da 2ª rodada nem o código da 2.0 gravam em `Nota`. O repository grava só `orcamento_ia_do_mes` (o retrato do mês, por `insert … on conflict do update`) e lê `consumo_ia`, a configuração da escola e a da rede. Todos com autor humano? Não se aplica, porque não há escrita em Nota.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. A tarefa não produz saída de IA que chegue ao aluno.
Supervisão do tutor: ok. A tarefa não muda o tutor.
Autonomia declarada e visível: sim. A tarefa não altera a autonomia de nenhum agente.

Esta rodada conferiu só o diff `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/.processo/ordens/diff-2-r2.patch`:
- **Correções exigidas da 1ª rodada:** não havia nenhuma.
- **Minha recomendação da 1ª rodada:** está registrada para a 4.0. Ela diz que o teto que segura o lote não pode transformar a correção de objetiva em nota, que continua pendente de aprovação humana (D33, D56), nem adiar a vista da avaliação sem o professor ser avisado. Está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/TODO.md:4236` e na tabela "Sem aplicar" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/tasks/prd-camada-ia/2_task.md:521`.
- **O resto do diff não toca a regra 70:**
  - comentário da 0067 e nova entrada da 0067 no `TODO.md`;
  - parágrafo do runbook sobre a trava da 0066 até o fim da transação;
  - caso novo da corrida do retrato com `Promise.all`;
  - "sem escola no contexto" estendido aos seis métodos;
  - asserção vazia tirada do teste;
  - docblock de `alunosAtivosDaEscola` pedindo escopo vindo do contexto;
  - `retratoDeHoje` em duas linhas;
  - texto de `IA_ORCAMENTO_ESGOTADO`;
  - item 9 da autoconferência da tarefa.
- **Supervisão do professor:** nenhuma das mudanças cria métrica ou leitura sobre o professor, nem expõe a conversa dele com o chat.
- **Supervisão do aluno:** nenhuma mede comportamento do aluno.

Bloqueantes: nenhum

Recomendações:
- Na 4.0, quando o processador de lote passar a devolver `IA_ORCAMENTO_ESGOTADO` pelo teto (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/packages/shared/src/errors/error-code.ts:134-137`), conferir que o adiamento do lote aparece ao professor que pediu a correção. Isso segue o item já registrado em `TODO.md:4236`.

## test-engineer · 2ª rodada · APROVADO · 2026-11-21 03:50:11 · `tasks/prd-camada-ia/2_task.md`

VEREDITO: APROVADO

Cenários exigidos (2ª rodada): só o diff entre as duas árvores, e as quatro recomendações desta lista que tocam teste (itens 4, 5 e 6 da ordem `2_task-r1.md`, mais a 8, que mexe em código já coberto por blocos).

Cobertos:
- **Item 4, a corrida do retrato.** Está em `packages/core/src/ia/orcamento-do-mes.repository.int.test.ts:297`. As duas `regravarRetrato` rodam de fato ao mesmo tempo, num `Promise.all` de dois `runInContext`. O pool tem até 4 conexões, então cada chamada pega a sua conexão, fora de transação comum. Sem o `on conflict do update`, a segunda gravação bate na PK `(escola_id, mes)` e o `Promise.all` rejeita. O teste falharia, então ele prova a regra 80, item 7. A asserção confere o resultado no banco: uma linha só, mês `2026-03-01`, 10 alunos.
- **Item 5, "sem escola no contexto".** Os seis métodos públicos agora estão no caso (`:377-384`). Em cada um, o `requireEscolaId()` roda antes de qualquer consulta: no `where` de `configuracaoDaEscola` e de `retrato`, no SQL de `configuracaoDaRede`, e no `alunosAtivos` chamado por `regravarRetrato`. A rejeição sai do contexto, e não de outro erro.
- **Item 6.** O `expect(ficou).toBeDefined()`, que sempre passava, saiu. O caso continua provando a regra pela contagem 1 e depois 2.
- **Item 8.** `retratoDeHoje` agora tem duas linhas e o comportamento é o mesmo. Nenhum bloco de "Mutações" citava o trecho trocado: procurei `await this.vigente`, `referência SQL` e `só a fila de lote` no `2_task.md` e não há ocorrência.
- O arquivo roda verde sozinho: 19 de 19 em 5 s. Não há `.skip`, mock nem chamada a provedor de IA.
- Os itens 1, 2, 3, 7, 9 e 10 são texto (a migration 0067, o `TODO.md`, o runbook, docblocks e a autoconferência). Conferi cada um contra a ordem e todos foram feitos como pedido.

Bloqueantes: nenhum.

Recomendações:
1. O nome do caso novo, em `orcamento-do-mes.repository.int.test.ts:297`, promete "a do último valor", mas as duas réplicas gravam o mesmo retrato, e a asserção não distingue um valor do outro. Há duas saídas: tirar "a do último valor" do nome, ou deixar o caso como está e deixar que a 4.0, com `esperarNaTrava`, prove qual valor fica.
2. A autoconferência 10 do `tasks/prd-camada-ia/2_task.md` ainda diz que "o caso 'regravar não duplica' regrava duas vezes em sequência". A tabela "Testes que provam a regra" também não cita o caso novo pelo nome. Já o `TODO.md` diz que a corrida "fica provada na 2.0 com `Promise.all`". Falta pôr a linha na tabela e atualizar o item 10, para o documento dizer o que o teste faz.
3. No caso "sem escola no contexto", `regravarRetrato` falha no `alunosAtivos`, antes de chegar ao `requireEscolaId()` do `insert`. O escopo da gravação continua coberto pelos casos com as escolas A e B, então isto fica só registrado.

Arquivos lidos:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/.processo/ordens/diff-2-r2.patch`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/.processo/ordens/2_task-r1.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/packages/core/src/ia/orcamento-do-mes.repository.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/packages/core/src/ia/orcamento-do-mes.repository.ts`
