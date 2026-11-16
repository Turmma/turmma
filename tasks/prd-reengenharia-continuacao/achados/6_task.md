# Achados das revisões — `tasks/prd-reengenharia-continuacao/6_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-16 04:30:39 · `tasks/prd-reengenharia-continuacao/6_task.md`

VEREDITO: APROVADO

**Tabelas verificadas:** nenhuma tabela nova e nenhuma migration nesta tarefa.
- `execucao_agente` já tem `escola_id` e `ano_letivo_id`. A alteração em `packages/core/src/db/schema/execucao-agente.ts` mexe só no comentário.
- `consumo_ia` já tem `escola_id` e a FK composta `consumo_ia_execucao_da_escola_fk` sobre `(escola_id, execucao_id)`. Por isso o banco não aceita linha estimada numa escola diferente da escola da execução.
- `job_registro` só é lido, sempre igualando `j.escola_id = p.escola_id`.
- Os ids continuam UUID.

**Queries verificadas:**
- `ExecucaoRepository.encerrarRodando` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/execucao.repository.ts:113`): a escola vem do contexto (`requireEscolaId()`), e o `update` filtra por escola, id e `estado = 'rodando'`. No processador, a escola do contexto é a do job, e antes disso `paraIniciar`, que também filtra pela escola, já recusa a execução de outra escola.
- `ExecucaoRepository.encerrarRodandasVelhas` (`execucao.repository.ts:128`): marcado `@Unscoped` com a justificativa escrita. Devolve só id, escola, tarefa e duração, sem conteúdo nem pessoa.
- `ExecucaoRepository.encerrarPendentesSemJob` (`execucao.repository.ts:145`): marcado `@Unscoped` com a justificativa escrita. O `not exists` iguala a escola do job à escola da execução.
- O módulo `apps/api/src/ia` fica com duas `@Unscoped`, ainda abaixo do limite de três da regra 10, item 9. O teste do `ia.int.test.ts` enumera as duas. Rodei `tools/guardas/repositories-com-escopo.test.ts` e passou (51/51).
- `ConsumoRepository.registrarEstimada` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/consumo.repository.ts:40`): grava na escola que o `returning` do próprio `update` devolveu. A escola vem do banco e nunca do cliente. Não existe endpoint novo, então nenhum `escolaId` entra por corpo ou query string.
- A linha estimada não leva `aluno_id`. Ela chega ao rastro do aluno pela execução que ele pediu, e o `rastroDoAluno` filtra pela escola do contexto. A camada de rede não ganhou consulta.

**Teste de isolamento:** presente e efetivo (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/execucao-interrompida.int.test.ts`).
- "isolamento, reentrega" (l. 367): um job da escola A com o `execucaoId` da escola B falha com `DADOS_INVALIDOS`, não muda nada na B e não grava linha. `encerrarRodando` chamado no contexto da A devolve `undefined`, e no contexto da B encerra a execução, que é o controle. Tirando `escolaId` do `where`, o `toBeUndefined()` quebra, e a tarefa declara essa mutação.
- "varredura, escola" (l. 442): um job vivo da B com o mesmo `execucaoId` não segura a `pendente` da A, e o job vivo da própria A segura. Tirando a igualdade de escola no `not exists`, o teste quebra (mutação declarada).
- "varredura, duas escolas", também com o adaptador externo (l. 493 e 716): cada linha estimada fica na escola da sua execução.
- "rastro de outro aluno" (l. 704) e o caso novo em `apps/api/test/arquivo-do-titular.int.test.ts`: a linha do colega da mesma escola não aparece no rastro nem no arquivo do aluno.

**Bloqueantes:** nenhum.

**Recomendações:**
1. Em `consumo.repository.ts:40`, `registrarEstimada` recebe a escola por argumento (`execucao.escolaId`) e abre um contexto novo com ela. Hoje é seguro: a escola vem do `returning` e a FK composta impede divergência. Mas o formato lembra o que a regra 10, item 3 proíbe. Vale dizer no docblock que o argumento só pode vir de um `InterrompidaEncerrada` devolvido pelo repository. Outra opção: no caminho da reentrega, quando já existe escola no contexto, conferir que ela é igual à escola devolvida.
2. Não rodei `apps/api/test/architecture.test.ts` (é teste de integração). Ele conta `@Unscoped` por módulo, então convém confirmar no portão que passa com as duas marcas novas.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-16 04:30:52 · `tasks/prd-reengenharia-continuacao/6_task.md`

VEREDITO: APROVADO

A tarefa 6.0 mexe só na engrenagem da fila de IA: quando o mesmo job chega de novo e quando a varredura de 60 s encerra execuções presas. Nenhum caminho novo grava nota, decide sobre aluno ou leva saída de IA ao aluno. Não há tela; `docs/regulacao.md` não mudou.

Caminhos de escrita em Nota: nenhum nesta tarefa. Busquei `nota`, `lancadaPor`, `aprova`, `discursiva`, `redação`, `autonomia`, `ranking` e `emoc` no diff: o único trecho que aparece é `docs/lgpd.md`, onde "nota" está na lista do que o `job_registro` nunca leva — todos com autor humano? sim (nada mudou)
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok
- Quando a segunda entrega encerra a execução como interrompida (`apps/api/src/ia/execucao.processor.ts:504-523`), o modelo não é chamado e nada é gravado para o aluno.
- Se a primeira entrega terminar depois, a conclusão continua presa a `where estado = 'rodando'` (`apps/api/src/ia/execucao.repository.ts:87-93`) e se desfaz. O teste "duplicada em corrida" prova isso.
- O fluxo de entrega pendente dos outros agentes não mudou, e a exceção do tutor (D47) não aparece em nenhum outro agente.

Supervisão do tutor: ok
- A pergunta do aluno é gravada no `preparar`, antes do modelo (`apps/api/src/tutor/turno.command.ts:168-177`). Por isso a troca interrompida continua visível ao professor, sem uso escondido.
- Assunto delicado (D36): o encaminhamento tem transação própria (`turno.command.ts:262-269`), então o sinal ao humano fica mesmo com a execução encerrada. Os dois casos novos em `apps/api/src/tutor/tutor-modelo.int.test.ts:834-884` provam que sai um sinal e uma mensagem fixa, nunca zero nem dois.
- A linha estimada em `consumo_ia` não guarda aluno nem texto, e nada nela infere comportamento ou emoção.

Autonomia declarada e visível: sim (nada mudou; a tarefa não toca agente nem a governança)

Itens 6 a 9:
- Auditoria (item 6): sem mudança.
- Supervisão não é vigilância (item 7): nada mede tempo ocioso nem navegação.
- Discursiva e redação (item 8): nenhum campo nem prompt novo.
- Medir o professor (item 9): nenhuma métrica de professor.

Bloqueantes: nenhum

Recomendações:
- `docs/lgpd.md`, linha `job_registro`: o acréscimo diz "a varredura do `worker-ia`", mas `docs/arquitetura.md`, `docs/runbook.md` e o docblock de `apps/api/src/ia/varredura-de-execucoes.ts` dizem `main-worker`. Vale usar o mesmo nome nos três para quem audita o mapa de dados. É questão de texto e cabe melhor ao `privacy-guardian`.

Arquivos lidos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tasks/prd-reengenharia-continuacao/6_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/execucao.processor.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/execucao.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/varredura-de-execucoes.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/consumo.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/ia/consumo.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/tutor/tutor-modelo.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/tutor/turno.command.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/execucao-interrompida.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/docs/lgpd.md

## revisor-geral · 1ª rodada · APROVADO · 2026-11-16 04:31:13 · `tasks/prd-reengenharia-continuacao/6_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. Duas mudanças fogem do que o `6_task.md` previa, e as duas estão registradas no `techspec.md` §5 ("Como a 6.0 ficou") e no `cenarios.md`. A primeira: a fiação foi para `ia-do-worker.module.ts` e `worker.module.ts`, e não para o `main-worker.ts`. A segunda: a `pendente` não tem piso de idade. Nada do corte de 20 s (7.0) nem da contagem de uso (9.0) entrou.
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

Recomendações:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/varredura-de-execucoes.ts:70-71`: `rodandoTotal` e `pendentesTotal` só repetem `rodando` e `pendentes`. Desestruture direto com o nome do log, ou passe as variáveis no lugar.
2. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/worker.module.ts:68-72`: no desligamento, `#varredura.encerrar()` impede o próximo passo, mas não espera o passo que já está rodando, e o pool pode fechar no meio dele. A transação se desfaz e o resultado sai certo, mas o desligamento normal deixa um `ia.execucao.varredura_falhou` no log. Vale guardar a promessa da volta em curso e esperá-la no `encerrar()`.
3. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/db/schema/execucao-agente.ts:40-42`: o docblock diz que a varredura usa o índice parcial das abertas, que é `(escola_id, estado, criada_em)`. Só que a varredura da `rodando` cruza escolas e ordena por `iniciada_em`, e o único `EXPLAIN` da tarefa é o do `not exists` da `pendente`. Faltam o `EXPLAIN` do `select` da `rodando`, ou o comentário dizendo que ali é varredura do índice parcial inteiro. A carga é com o `infra-guardian`; aqui é só a precisão do comentário.
4. A linha estimada leva os dois tetos da tarefa. No Analista, o teto de entrada é de cerca de 642 mil tokens, então uma execução interrompida pesa muito no custo por função que a coordenação vê. A spec quer assim, para superestimar e nunca subestimar (D14). Ainda assim, vale avisar no texto do painel de custo, ou na 9.0, que a linha `EXECUCAO_INTERROMPIDA` é estimativa.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-16 04:32:35 · `tasks/prd-reengenharia-continuacao/6_task.md`

```
VEREDITO: APROVADO
Caminho quente tocado: fila | IA | tutor
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: ok
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
```

Não encontrei bloqueante. Não rodei os testes de integração. O que está abaixo vem da leitura do diff, dos casos em `apps/api/src/ia/execucao-interrompida.int.test.ts` e das mutações declaradas na tarefa.

**Recomendações**

1. **Busca do job vivo escala mal quando a fila acumula.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/execucao.repository.ts:152-157`, o `not exists` acha o job comparando `j.dados ->> 'execucaoId'`. Para isso lê todos os jobs vivos da escola, um por um, para cada `pendente`.
   - Às 10h, com o Redis de fila fora por uns 10 minutos, chegam a ~4.500 `pendente` e ~450 jobs vivos por escola. Esse `update` pode bater nos 5 s de `statement_timeout` a cada volta.
   - Ele falha sem estragar nada (nenhuma execução é encerrada), mas pesa no banco justo no incidente.
   - O `enfileirarUmaVez` já grava o `execucaoId` como `chave_idempotencia`, e o índice único parcial `job_registro_chave_idempotencia_unica (escola_id, tipo, chave_idempotencia)`, só dos jobs vivos, acharia o job numa consulta só. Vale trocar `j.dados ->> 'execucaoId' = p.id::text` por `j.chave_idempotencia = p.id::text` e refazer o `EXPLAIN`.

2. **A conta dos 50 s não é um limite de verdade.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/varredura-de-execucoes.ts:24`, a conta supõe um comando por passo. Na varredura da `rodando` cada passo faz um `update` e até 200 `insert` em sequência (linha 99), e cada `insert` tem os seus próprios 5 s.
   - Na prática dá milissegundos, e a flag de volta em curso evita que uma volta comece por cima da outra.
   - Gravar as linhas estimadas num `insert` só deixaria o passo em dois comandos e faria a conta valer de fato.

3. **Faltam números de execuções interrompidas.** Hoje a reentrega (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/execucao.processor.ts:126`) e a varredura (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/varredura-de-execucoes.ts:72`) só deixam log.
   - Pela decisão da spec, a entrega duplicada encerra a execução mesmo com a primeira ainda viva.
   - Se o Redis de fila reinicia, ou o event loop atrasa e o job trava (lock de 10 s), as respostas do Tutor em andamento se perdem. O aluno recebe `EXECUCAO_INTERROMPIDA` com mensagem e tenta de novo, e o modelo chega a ser pago duas vezes.
   - O painel de jobs travados ("Jobs em stalled") já existe, mas só mostra a causa. Um contador `ia.execucao.interrompida` por escola e origem (reentrega ou varredura) mostraria o efeito e quanto do orçamento as linhas estimadas consomem.

4. **Teste de carga.** O cenário não foi atualizado. Isso se aceita porque a reentrega e a varredura só correm quando algo falha, mas o expurgo da carga (`infra/scripts/expurgo-da-carga.ts`) depende de as execuções semeadas estarem concluídas. Quem semear execução `pendente` sem job daqui para frente vai ver a varredura encerrá-la em até 60 s, já que a `pendente` não tem idade mínima.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-16 04:33:02 · `tasks/prd-reengenharia-continuacao/6_task.md`

VEREDITO: APROVADO

**Campos pessoais tocados:** nenhuma coluna nova. A tarefa grava uma linha a mais em `consumo_ia`, a "linha estimada" da execução que o worker deixou em `rodando` e que acabou encerrada. Ela leva `execucao_id`, tarefa, função, perfil, origem, modelo, versão do prompt, os dois tetos de tokens da tarefa, a duração, `envio_externo` e `provedor`. O `aluno_id` fica nulo, e `entrada` e `saida` também, como o check do banco exige. A varredura também passa a ler `job_registro` (fila, tipo, `dados ->> 'execucaoId'`).

**Fora da tabela de dados do docs/lgpd.md:** nada. A linha de `consumo_ia` agora descreve a estimada: grava o provedor sem saber se o envio saiu, superestima e nunca subestima, e chega ao rastro do aluno pela execução que ele pediu. A linha de `job_registro` ganhou a finalidade nova, ver se a `pendente` ainda tem o `ia.executar` vivo. As duas estão em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/docs/lgpd.md`, nas linhas 99 e 116.

**Autorização por objeto:** ok. A tarefa não cria rota.
- `encerrarRodando` filtra por `requireEscolaId()`, id e estado. O caso "isolamento, reentrega" mostra que um job da escola A com o `execucaoId` da escola B não muda nada na B nem deixa linha.
- As duas `@Unscoped` são rotina nossa e têm motivo escrito. A escola da linha estimada vem do `returning` do `update`, nunca do cliente (`consumo.repository.ts`, `registrarEstimada`).
- No `not exists`, a condição `j.escola_id = p.escola_id` impede que um job vivo de outra escola segure a `pendente`. Há caso de teste com mutação para isso.

**Logs:** limpos.
- `ia.execucao.interrompida`: só `execucaoId`, `escolaId`, `tipo` e `codigo`.
- `ia.execucao.interrupcao_nao_gravada` e `varredura_falhou`: usam `summarizeError`, que entrega sqlstate e constraint ou o tipo do erro e as linhas da pilha, nunca a mensagem.
- `ia.execucao.interrompidas_encerradas`: só contagens.
- O caso "o log", em `execucao-interrompida.int.test.ts:650`, confere a lista de campos permitidos e que a execução varrida não aparece no log.

**Auditoria:** presente onde a regra exige. A tarefa não tem leitura por coordenação ou rede, exportação, alteração de nota ou de permissão, nem aprovação. O rastro da IA é a própria linha de consumo, que é o que a regra 30, item 4 pede.

**Envio externo:** a tarefa não faz envio novo. A reentrega e a varredura não chamam o modelo. O que muda é o registro: a linha estimada leva o `provedor` do adaptador configurado. Ela é montada por `destinoDoAdaptador`, que reaproveita a escolha de adaptador de `createLLMGateway`, então os dois não divergem. No adaptador falso ou local, a linha sai com `envio_externo=false` e `provedor` nulo. A linha aparece em `alunoTrailStatement` pelo ramo `execucao_agente.solicitada_por`, e há teste para isso: "linha estimada, externo", "rastro de outro aluno" e o caso novo em `arquivo-do-titular.int.test.ts:524`.

**Seed/fixture:** sintético ("Aluno", "ColegaDaTurma", `modelo-sintetico`, `provedor-de-teste`).

**Pergunta de fechamento:** o código responde. A linha estimada entra no arquivo do titular e na lista de compartilhamento pela execução que o aluno pediu. Quando o envio não pode ser confirmado, ela informa o provedor a mais, nunca a menos. A retenção não muda:
- a execução do Tutor perde o aluno no prazo de `consumo_por_aluno`, pela função `tutor_com_o_aluno` e não pelo consumo (`expurgo-da-escola.repository.ts:226`). A estimada sem aluno não estica esse prazo;
- a eliminação anula `solicitada_por`, e a foto do compartilhamento é refeita antes disso.

**Bloqueantes:** nenhum.

**Recomendações:**
1. Em `docs/lgpd.md`, linha 116, a nova finalidade de `job_registro` fala em "a varredura do `worker-ia`", enquanto o código e o resto da documentação dizem `main-worker` (`varredura-de-execucoes.ts`, `execucao-agente.ts`). Vale usar o mesmo nome do processo nos dois lugares.
2. Na tela "Meus dados" e nos textos dos pedidos do titular, vale pensar numa frase que diga que um provedor listado pode ser estimativa de execução interrompida e que o envio pode não ter acontecido. A família ou a escola que vir o provedor no arquivo saberia que pode ser superestimativa. Isso não bloqueia: informar a mais é o lado seguro do art. 18, VII.
3. A linha estimada grava `tentativas: 1` como hipótese. Quem ler `consumo_ia` agrupando por `codigo_de_erro = 'EXECUCAO_INTERROMPIDA'` consegue separar essas linhas. Vale citar isso no `docs/runbook.md` para quem for conciliar custo com a fatura do provedor.

## test-engineer · 1ª rodada · APROVADO · 2026-11-16 04:35:38 · `tasks/prd-reengenharia-continuacao/6_task.md`

VEREDITO: APROVADO

Cenários exigidos: as 18 linhas da tabela "Testes que provam a regra" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tasks/prd-reengenharia-continuacao/6_task.md`, mais as subtarefas 6.2 (o `EXPLAIN`) e 6.3 (a conta do laço e a parada no sinal). Também os casos de carga da regra 80 para esta tarefa: job executado duas vezes, as duas réplicas da varredura, a volta da varredura que não se sobrepõe à anterior, e o Redis de fila fora. E o isolamento: a reentrega entre escolas, o job vivo de outra escola, a escola de cada linha estimada e o rastro de outro aluno.

Cobertos: todas as linhas da tabela têm teste com o nome citado em `apps/api/src/ia/execucao-interrompida.int.test.ts`, `apps/api/src/tutor/tutor-modelo.int.test.ts` (o "D36 na reentrega" e o "job em dois workers") e `apps/api/test/arquivo-do-titular.int.test.ts`.
- **Concorrência de verdade:** "as duas leem `pendente`" põe duas entregas em paralelo, com a barreira `WriteBlockTrigger` e `esperarNaTrava`. As duas réplicas, na `rodando` e na `pendente`, têm a barreira entre o `update` e o `commit`. O "job em dois workers" faz a segunda entrega enquanto a primeira está parada na gravação do sinal.
- **Controles positivos:** "fora do freio" primeiro confere que o freio bloqueia; "varredura, escola" tem o job vivo da própria escola, que segura; "isolamento, reentrega" chama o repository no contexto da B; "a gravação falha" repete a entrega com a gravação consertada.
- **Asserções:** sempre sobre o banco (estado, erro, linha de `consumo_ia` comparada com `toEqual`, rastro), sobre o log e sobre o número de chamadas ao modelo.
- **Mutações:** confrontei a seção com o `git diff`. Toda condição nova do processador, do repository (os três termos de `encerrarRodando`, cada termo dos dois `update` e do `not exists`), da varredura (o laço, o `break`, `#emCurso`, o `catch`, o `finally`, as transações) e do `consumo.ts` / `llm-gateway.ts` tem o seu bloco. Os dois itens sem bloco têm o motivo escrito.
- **Sem desligar teste e sem provedor pago:** nenhum `.skip`, `.only` ou teste comentado. A IA roda com adaptador falso ou com o modelo contado. O destino externo é um `DestinoDoAdaptador` de teste, e nenhuma chamada sai.
- **Rodado aqui:** `packages/core/src/ia/llm-gateway.test.ts`, 56 de 56 passando. Não rodei os testes de integração: o terceiro bloco para o `redis-fila` e os processos do compose, e isso derrubaria os outros revisores que usam a mesma árvore.

Bloqueantes: nenhum.

Recomendações:
1. **Duas asserções fracas em "varredura, duas réplicas na `pendente`"** (`execucao-interrompida.int.test.ts:488-490`).
   - A contagem `encerradasNesteTeste` dá sempre 1 depois do `toEqual` da linha 485, porque conta uma linha só pelo id. Ela não conta quantos encerramentos houve, ao contrário do que o nome diz.
   - A asserção que pega a mutação é a soma do que as varreduras devolvem (`contadas`). Essa soma é global: inclui a `rodando` e a `pendente` de qualquer escola. Uma `rodando` deixada por outro arquivo que passe de 300 s na janela soma 2, e isso esbarra na regra 40 ("a lista global se filtra pelo que o teste criou").
   - Correção sugerida: contar os `update` daquela linha com um gatilho por linha (`after update … for each row when (old.id = <id>)`) e exigir 1.
2. **O job vivo só aparece no estado `aguardando`** ("varredura, `pendente`" e "Redis de fila fora"). Na manhã de segunda, ou com o Redis fora, o job vivo real está `reservado`, `publicado` ou `ativo`. Vale repetir o caso nesses três estados, para que uma troca do `not in` por `= 'aguardando'` fique vermelha.
3. **O teste do `EXPLAIN`** (`:609`) analisa a consulta de um job avulso, com valores fixos, e não o `update … not exists` correlacionado que roda de fato, onde o Postgres pode escolher uma junção. Explicar o próprio `update` dentro de uma transação desfeita no fim provaria o plano real.
4. **A reentrega e a varredura juntas na mesma `rodando`** (`encerrarRodando` ao lado de `encerrarRodandasVelhas`) não têm teste em paralelo. O mecanismo é o mesmo, a condição de estado com a trava da linha, mas o par não está provado.
5. **A linha "duplicada em corrida"** declara a mutação "concluir sem `where estado = 'rodando'`", que não tem bloco nesta tarefa. A cláusula é da 5.0, onde foi provada por outro caso. Um bloco ligado a este caso fecharia o que a tabela declara.
6. **A linha "linha estimada, falso ou local"**: o teste de integração cobre só o falso. O modelo local está provado em `packages/core/src/ia/llm-gateway.test.ts` › "o modelo local"; vale citar esse teste na coluna "Caso".
7. **O `set local statement_timeout = 5000`** da varredura não tem teste que falhe sem ele. Além disso, o `.env.example` traz `BANCO_TIMEOUT_CONSULTA_MS=2000`, então o `set local` afrouxa o prazo de 2 s para 5 s em vez de apertar. A conta de 50 s continua valendo como teto. Fica para o `infra-guardian` confirmar a intenção.
8. **A primeira asserção de "a conta do laço"** repete a fórmula da constante e não prova nada. Quem prova o teto são `aindaRodando() > 0` e a volta seguinte, que esvazia.
9. **Os dois primeiros blocos do arquivo** gravam jobs `aguardando` sem parar os processos da fila no compose. Só o terceiro bloco os para, e o próprio comentário dele avisa que eles disputariam os jobs. No portão e na esteira a integração sobe só a infraestrutura, então hoje não quebra; com o compose inteiro de pé na máquina de quem desenvolve, quebra. É o mesmo padrão de `apps/api/src/ia/fila-de-ia.int.test.ts`.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-16 04:52:31 · `tasks/prd-reengenharia-continuacao/6_task.md`

VEREDITO: APROVADO
Tabelas verificadas: nesta rodada, nenhuma migration nem coluna nova. A mudança em `packages/core/src/db/schema/execucao-agente.ts` só reescreve o comentário sobre o índice parcial das execuções abertas e sobre a varredura.
Queries verificadas: o código de produção quase não mudou nesta rodada.
- `apps/api/src/ia/varredura-de-execucoes.ts:62-69`: só renomeia variáveis. A rotina continua em `runInContext` com `rotinaDoSistema: true`, e as duas consultas sem escopo seguem em `apps/api/src/ia/execucao.repository.ts:128` e `:145`, ambas com `@Unscoped` e justificativa escrita.
- `apps/api/src/ia/consumo.repository.ts:45-48`: ganhou um comentário dizendo que a escola usada em `registrarEstimada` só pode vir do `returning` do `update`. Os dois pontos que chamam a função cumprem isso: `varredura-de-execucoes.ts:97` e `execucao.processor.ts:117`.

Teste de isolamento: presente e efetivo. O caso "varredura, escola: o job vivo de outra escola com o mesmo `execucaoId` não segura a `pendente`" não mudou. Em `execucao-interrompida.int.test.ts` entraram jobs nos estados `reservado`, `publicado` e `ativo`, inclusive com o Redis fora. Também mudou a prova das duas réplicas: agora é um gatilho que conta quantas vezes a mesma execução foi encerrada. Com isso, o teste deixa de depender do retorno somado das duas varreduras e de uma contagem que olhava a tabela inteira. Nada disso afrouxa o caso entre escolas.
Bloqueantes: nenhum.
Recomendações: nenhuma nova. A da 1ª rodada (`architecture.test.ts` passando com as duas `@Unscoped`) continua dependendo do resultado do portão.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-16 04:52:33 · `tasks/prd-reengenharia-continuacao/6_task.md`

VEREDITO: APROVADO

**Campos pessoais tocados:** nenhum campo novo nesta rodada. O diff mexe em testes, comentários e docs, e renomeia variáveis locais em `varredura-de-execucoes.ts`. Tudo o que é gravado em `consumo_ia` e em `execucao_agente` continua só com ids, tarefa e números.

**Fora da tabela de dados do `docs/lgpd.md`:** nada. A linha do "Registro do job" passou a dizer `main-worker` onde dizia `worker-ia`, na finalidade da varredura. Isso deixa o mapa de dados certo sobre qual processo lê a `job_registro`. Finalidade e retenção não mudaram.

**Autorização por objeto:** ok. Não há rota nova. O comentário novo em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/consumo.repository.ts:45-48` deixa por escrito de onde vem o `escolaId` da linha estimada: ele só sai do `returning` do `update`, nunca de argumento de quem chama. A FK composta `(escola_id, execucao_id)` recusa outra escola, o que segue a regra 10, item 3.

**Logs:** limpos. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/varredura-de-execucoes.ts:70` registra só o evento e três contagens (`total`, `rodandoTotal`, `pendentesTotal`), e a linha 73 registra o resumo do erro. Nenhum dos dois leva nome, conteúdo ou mesmo id de aluno.

**Auditoria:** nada nesta rodada pede auditoria. A varredura encerra execução, não lê dado de aluno nem aprova saída de IA. O rastro do envio continua em `consumo_ia`, com `codigo_de_erro = 'EXECUCAO_INTERROMPIDA'`, e o runbook agora explica como separar essa linha estimada na hora de conciliar com a fatura do provedor (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/docs/runbook.md:63`).

**Envio externo:** nada novo nesta rodada. Continua valendo o que já foi aprovado: a linha estimada da execução interrompida marca `envio_externo` e `provedor` quando o adaptador é externo, nunca leva aluno nem texto, e entra no `rastroDoAluno`. A tabela de cenários da tarefa agora aponta também o caso do provedor local em `llm-gateway.test.ts`.

**Seed/fixture:** sintético. O teste novo de corrida das duas réplicas cria uma sequência, uma função e um gatilho temporários com nome aleatório, filtrados por um UUID gerado no próprio teste, e apaga tudo no `finally`. Os casos novos de job `reservado`, `publicado` e `ativo` usam a mesma semeadura sintética dos outros.

**Bloqueantes:** nenhum.

**Correções exigidas na 1ª rodada:** nenhuma. A minha recomendação daquela rodada (dizer na tela "Meus dados" e nos pedidos do titular que um provedor listado pode ser estimativa de uma execução interrompida) foi para o `TODO.md` com dono. O destino é aceitável, porque a tarefa não toca `apps/web`.

**Pergunta de fechamento:** a resposta não mudou desde a 1ª rodada. A linha estimada fica no `consumo_ia` da escola da execução, entra no rastro do aluno quando o adaptador é externo e aparece no arquivo do titular. A dúvida "o envio saiu ou não?" é resolvida do lado conservador: a linha conta como envio.

**Recomendações:**
- Quando a frase da tela "Meus dados" for feita, levá-la também ao arquivo do titular que a escola exporta (o JSON do pedido de acesso), e não só à tela. É ali que a secretaria vai ler "para onde já foi enviado".

## infra-guardian · 2ª rodada · APROVADO · 2026-11-16 04:52:41 · `tasks/prd-reengenharia-continuacao/6_task.md`

VEREDITO: APROVADO
Caminho quente tocado: fila | IA
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: ok
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/execucao-interrompida.int.test.ts`, caso "varredura, duas réplicas": o caso cria gatilho, função e sequência com sufixo aleatório e só os apaga no `finally`. Se o processo do teste morrer no meio, essas sobras ficam no banco de teste. Isso não afeta o resultado, porque a condição `when` está presa ao id da execução. Ainda assim, vale apagar as sobras `teste_encerramentos_*` no preparo da bancada, como já se faz com o `WriteBlockTrigger`.
- O caso "a conta do laço" deixou de comparar `PIOR_CASO_DA_VARREDURA_MS` com `2 × PASSADAS_MAXIMAS × 5_000`. Agora confere só que o pior caso fica abaixo de `INTERVALO_DA_VARREDURA_MS`. Isso basta para provar que uma volta não encosta na seguinte. Se alguém aumentar o `statement_timeout` por passo sem recalcular a constante, porém, o teste não pega. Uma saída é derivar a constante do timeout do passo no código, para que as duas não se separem.
- Continuam valendo as recomendações da 1ª rodada que foram para o `TODO.md` e para as tarefas 7.0 e 11.0: achar o job pela `chave_idempotencia`, gravar as linhas estimadas num `insert` só, o contador `ia.execucao.interrompida` por escola e origem, e o cenário de carga da `pendente` sem job.

O diff desta rodada (`.processo/ordens/diff-6-r2.patch`) não traz correção exigida a conferir. Ele mexe em teste, comentário, documentação e numa reorganização de variáveis em `varredura-de-execucoes.ts` que não muda o comportamento. As consultas e a migration não mudaram.

O teste agora cobre o job vivo nos estados `reservado`, `publicado` e `ativo`, inclusive com o Redis fora. Esses estados existem no check de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/db/schema/job-registro.ts:64`, e a consulta da `pendente` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/execucao.repository.ts` filtra `j.estado not in ('concluido', 'falhou')`, que é o que o teste exercita. A prova da corrida entre as duas réplicas agora conta os encerramentos por gatilho no banco, em vez de somar o que cada varredura devolve, e isso é mais forte que antes. Não rodei a suíte de testes nesta rodada.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-16 04:52:54 · `tasks/prd-reengenharia-continuacao/6_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum neste diff. A 2ª rodada não mexe em `Nota`, correção nem aprovação. Na 1ª rodada a resposta foi "sim" e nada mudou desde então.
Decisão autônoma sobre aluno: ausente.
Aprovação registrada: ok. O diff não cria saída de IA que chegue ao aluno. A execução encerrada com `EXECUCAO_INTERROMPIDA` termina em `falhou`, sem resultado. O teste confere isso com `resultado: null`, então nada fica pendente de aprovação nem passa sem ela.
Supervisão do tutor: ok. Nada no diff muda o que o professor vê do tutor. A linha estimada em `consumo_ia` não leva aluno nem texto.
Autonomia declarada e visível: sim, sem alteração nesta rodada.

Bloqueantes: nenhum.

Escopo desta rodada, conforme o patch `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/.processo/ordens/diff-6-r2.patch`. A 1ª rodada não exigiu correções, então não havia o que conferir. O diff só mexe nestes pontos:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/consumo.repository.ts`: só um comentário. Diz que a escola da linha estimada vem do `returning` do `update`, nunca de quem chama, e que a FK composta segura isso.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/varredura-de-execucoes.ts`: troca de nomes de variável. O log continua só com totais, sem id de pessoa nem conteúdo.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/execucao-interrompida.int.test.ts`:
  - Novos casos: a `pendente` com job `reservado`, `publicado` ou `ativo` não é encerrada. Com o Redis fora, o job `ativo` também segura a `pendente`.
  - Na corrida entre duas réplicas, um gatilho conta quantas vezes a execução foi encerrada, e o teste exige que seja uma vez só.
  - Esses casos protegem a execução viva do aluno de ser encerrada por engano. Nenhum aspecto da regra 70 muda com eles.
- `docs/lgpd.md`, `docs/runbook.md`, o comentário do schema `execucao-agente.ts`, `TODO.md` e `6_task.md`: só texto. Inclui um bloco de mutação novo para a condição de estado em "duplicada em corrida" e a tabela de revisões.

Recomendações:
- O item novo do `TODO.md` que avisa no painel de custo que a linha `EXECUCAO_INTERROMPIDA` é estimativa também toca a regra 70, item 6 (auditoria do que a IA gerou). Quando a tela de custo for feita, o rótulo de "estimativa" precisa deixar claro que nada foi gerado para o aluno, só o custo foi presumido.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-16 04:53:13 · `tasks/prd-reengenharia-continuacao/6_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/execucao-interrompida.int.test.ts:480`: o caso "varredura, duas réplicas na `pendente`" não confere mais o número que `varrer()` devolve. Antes ele somava o que as duas varreduras devolviam e exigia 1. Agora conta por gatilho quantas vezes a linha foi encerrada. Isso prova bem o "uma vez só", mas o `pendentesTotal`, que vai para o log `ia.execucao.interrompidas_encerradas`, fica sem conferência. Há duas saídas: manter também a soma dos dois `varrer()` restrita a esta execução, ou tirar o "e contada" do nome, já que o caso agora prova o encerramento e não a contagem que sai no log.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/execucao-interrompida.int.test.ts:556`: "a conta do laço" deixou de fixar `2 × PASSADAS_MAXIMAS × 5 s`. Ainda vale como prova, porque `PIOR_CASO_DA_VARREDURA_MS` sai das constantes que o `statement_timeout` usa (`varredura-de-execucoes.ts:22-24`, `:94`, `:104`). Só que a recusa da recomendação do `test-engineer` no `6_task.md` continua dizendo que este caso "confere" os 5 s por passo. Na verdade ele confere só o teto de 60 s. Vale ajustar a frase da recusa para não prometer mais do que o teste prova.

O diff desta rodada:
- Os três estados de job vivo (`reservado`, `publicado`, `ativo`) entraram no teste da `pendente`, incluindo o caso com o Redis fora.
- Na varredura, o total que vai para o log só mudou de nome.
- O comentário da regra 10 em `consumo.repository.ts` diz de onde vem a escola.
- `docs/lgpd.md` passa de `worker-ia` para `main-worker`, como na Tech Spec.
- O runbook explica como separar a linha estimada na hora de conciliar com a fatura do provedor.
- Entrou o bloco de mutação de `concluirRodando`. Ele acerta a linha de `execucao.repository.ts:92-93` e aponta para um caso que existe. A contagem de 35 blocos bate com o arquivo.
- As referências novas da tabela de cenários aos testes de `llm-gateway.test.ts` (o caso do modelo local) existem.
- As recomendações sem aplicar estão no `TODO.md` com dono, ou foram recusadas com motivo. Nada invade outra tarefa.

## test-engineer · 2ª rodada · APROVADO · 2026-11-16 04:53:18 · `tasks/prd-reengenharia-continuacao/6_task.md`

VEREDITO: APROVADO

Cenários exigidos: os mesmos da 1ª rodada, todos na tabela de testes de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tasks/prd-reengenharia-continuacao/6_task.md`. São eles:
- **Reentrega:** worker morto; duplicada em corrida; as duas leem `pendente`; o original vivo; a gravação falha; a execução já terminada.
- **Varredura:** limiar 301/299 s; `pendente` com e sem job vivo; escola; duas réplicas na `rodando` e na `pendente`; duas escolas; a gravação da linha falha; lote; conta do laço; sem sobreposição; `EXPLAIN`; Redis fora.
- **Linha estimada:** externo; falso ou local; fora do freio.
- **Isolamento, LGPD e log:** isolamento na reentrega; rastro de outro aluno; arquivo do titular; log.
- **Herdados:** D36 na reentrega; o job em dois workers.

Cobertos: todos. Nesta rodada conferi só o diff de `.processo/ordens/diff-6-r2.patch`. A 1ª rodada não exigiu correção, então não havia correção a conferir. O que o diff muda:
- **`pendente` com job em andamento** (`execucao-interrompida.int.test.ts:421-443`): os jobs `reservado`, `publicado` e `ativo` agora seguram a `pendente`, sem gerar linha. No caso do Redis fora (`:771-772`), o job `ativo` também segura. Isso amplia a cobertura do `not exists` a todos os estados que não são finais.
- **Duas réplicas na `pendente`** (`:480-505`): saíram duas asserções. Uma era a soma do retorno das duas `varrer()`. A outra, `count(*) … concluida_em is not null` de um id só, sempre dava 1. No lugar entrou um gatilho por linha, `after update … when old.id = id and new.estado = 'falhou'`, com contador numa sequence. A sequence não volta atrás quando a transação se desfaz, então ela conta toda reescrita. Sem `and x.estado = 'pendente'`, a réplica que perdeu reavalia o `where` depois da trava e reescreve a linha, e o contador chega a 2. O bloco de mutação da linha 308 do documento continua chegando à cláusula. A limpeza do gatilho, da função e da sequence está no `finally`.
- **Bloco de mutação novo** para a condição `estado = 'rodando'` do `concluir`, citando "duplicada em corrida". O teste exige `falhou` e `resultado: null` depois que a primeira entrega termina (`:306`), então sem a condição o `update` gravaria `concluida` e o teste ficaria vermelho. A contagem passou para 35 blocos, coerente com o acréscimo.
- **Conta do laço** (`:557-558`): saiu `PIOR_CASO_DA_VARREDURA_MS === 2 * PASSADAS_MAXIMAS * 5_000`. Era tautológica, porque `varredura-de-execucoes.ts:24` calcula a constante desses mesmos fatores. Fica o `<= INTERVALO_DA_VARREDURA_MS`, que pega quem subir o prazo ou o número de passadas.
- **Linha "falso ou local" da tabela:** agora cita o caso do modelo local, que existe em `packages/core/src/ia/llm-gateway.test.ts:718` ("o modelo local: origem `openai_compat`, sem envio externo").
- **Mudanças sem efeito nos testes:** `varredura-de-execucoes.ts:65-69` só renomeia variáveis, com a mesma soma e o mesmo log. As outras mudanças são comentário e documento: `consumo.repository.ts`, `execucao-agente.ts`, `lgpd.md` e `runbook.md`.

Não há `.skip`, teste comentado nem mock que esconda a regra. Os testes usam o adaptador falso ou o destino configurado, sem provedor pago. A concorrência continua provada com chamadas em paralelo e barreira (`WriteBlockTrigger` com `esperarNaTrava`), e não em sequência. Não rodei a suíte de integração: o portão já provou os blocos, e o caso do Redis fora para o `redis-fila` do compose, o que atrapalharia os revisores que rodam em paralelo na mesma árvore.

Bloqueantes: nenhum.

Recomendações:
- **`6_task.md:432`**: a recusa da recomendação do `statement_timeout` diz que "a conta do laço a confere". Com a igualdade retirada, o teste só confere `PIOR_CASO <= 60 s`. Nenhum teste fica vermelho se o `set local statement_timeout` sair de `varredura-de-execucoes.ts:94` e `:104`. O motivo da recusa precisa ser reescrito, ou a recomendação vai para o `TODO.md`.
- **`execucao-interrompida.int.test.ts:480`**: o nome do caso diz "e contada, uma vez só", mas o retorno de `varrer()`, que vira o `pendentesTotal` do log, deixou de ser verificado ali. Hoje só "a volta para quando o lote não enche" (`:592`) olha o total, e só com `>= 5`. Vale ajustar o nome ou voltar a verificar a soma dos retornos junto com o gatilho.
