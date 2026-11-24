# Achados das revisões — `tasks/prd-avaliacao-e-correcao/2_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-23 21:37:32 · `tasks/prd-avaliacao-e-correcao/2_task.md`

VEREDITO: APROVADO

Tabelas verificadas:
- **`pulso_da_api` e `indisponibilidade`** (`packages/core/src/db/schema/prova-online.ts:130-150`, criadas na 1.0). As duas guardam só instantes (`ultimo_em`, `inicio`, `fim`) e não têm escola nem pessoa. A exceção ao item 1 da regra 10 está escrita na Tech Spec §11 e no item 1 de `docs/modelo-de-dados.md`, que esta tarefa atualizou com a retenção de 13 meses. Elas não precisam de `anoLetivoId` porque não mudam por período.
- **Ids:** as duas usam UUID (`uuidv7()`). Nenhuma tabela nova nesta tarefa.

Queries verificadas:
- **`PulsoRepository.pulsar`** (`apps/api/src/atividade/pulso/pulso.repository.ts:73`) é uma instrução global. Não recebe parâmetro do cliente, só o limiar, que é constante. Tem `@Unscoped` com justificativa.
- **`QuedasDaApiRepository.leituraDesde`** (`pulso.repository.ts:106`) devolve só `ultimoEm`, `agora` e intervalos `{inicio, fim}`. Não traz id de aluno nem de escola, então nada de escola atravessa essa leitura. Tem `@Unscoped` com justificativa.
- **`ExpurgoDeAcessoRepository`, alvo `indisponibilidade`** (`packages/core/src/retencao/expurgo-de-acesso.repository.ts:193-202`): apaga em lote com `for update skip locked` e não devolve linha. A justificativa do `@Unscoped`, que já existia, foi estendida para o alvo novo.
- **`RotasDeProvaGuard`** (`apps/api/src/atividade/pulso/rotas-de-prova.guard.ts:137`): roda depois das guardas globais (sessão e permissão) e antes de qualquer leitura. O 503 `INDISPONIVEL_TENTE_DE_NOVO` não depende do id do caminho, então é o mesmo para id inexistente, id de outra escola e id próprio, e não confirma que o registro existe. Nenhum endpoint passou a aceitar `escolaId` do corpo ou da query.
- **Métrica `api.pulso.idade_s`:** sem rótulo, sem escola, sem dado individual.
- **`@Unscoped` no módulo `atividade`:** são dois, abaixo do limite de três da regra 10, item 9.
- **Camada de rede:** esta tarefa não toca nela.

Teste de isolamento: não se aplica. As duas tabelas são globais e o resultado não carrega escola nem pessoa, então não há cláusula de escopo a remover e testar. O escopo da tentativa continua com quem chama `leituraDesde` (3.0 e 6.0), e o teste de isolamento cabe a essas tarefas.

Bloqueantes: nenhum.

Recomendações:
1. **503 igual para todos sem teste que o prove.** Em `apps/api/src/atividade/pulso/pulso.int.test.ts:318`, acrescentar ao caso do `+31 s` uma chamada com id de aplicação de outra escola e outra com id inexistente, as duas esperando o mesmo `{503, INDISPONIVEL_TENTE_DE_NOVO}`. Hoje isso só é verdade pela ordem guarda-antes-do-service, e nenhum teste fixa essa ordem.
2. **Docblock cita rotas que ainda não existem.** O docblock de `rotas-de-prova.guard.ts:124` lista `comecar`, `tempo` e `saidas-da-aba` como protegidas pela guarda, mas essas rotas só chegam na 3.0 e na 8.0. Deixar explícito que são futuras, ou colocá-las quando entrarem, para o comentário não afirmar o que o código ainda não faz.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-23 21:37:38 · `tasks/prd-avaliacao-e-correcao/2_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A tarefa só grava em `pulso_da_api`, `indisponibilidade` e no expurgo dela. A guarda de 503 roda antes do serviço, e o teste confirma que nada é gravado em `tentativa_atividade` nem em `resposta_atividade`. Como nenhum caminho novo escreve em Nota, a pergunta do autor humano não se aplica.

Decisão autônoma sobre aluno: ausente. `limiteDaTentativa` só devolve ao aluno o tempo em que a API ficou fora durante a prova, a favor dele. O 503 é igual para todos e não leva a nenhuma consequência sobre aprovação, reprovação ou encaminhamento. Encerrar a prova vencida é trabalho da 6.0, fora desta tarefa.

Aprovação registrada: ok. Nenhuma saída de IA nasce nesta tarefa, e não há agente envolvido.

Supervisão do tutor: ok. O tutor não é tocado. O 503 vale só para as rotas de prova, e o tutor continua funcionando. Isso está no docblock de `apps/api/src/atividade/pulso/rotas-de-prova.guard.ts` e o caso do 503 prova o mesmo com `minhas-atividades`.

Autonomia declarada e visível: sim. Nenhum agente novo e nenhum agente mudado, então não há autonomia nova a declarar.

Supervisão não é vigilância (item 7): ok. O pulso mede a API, não o aluno. As duas tabelas não têm escola nem pessoa. `limiteDaTentativa` recebe o `alunoId` só para separar as extensões do professor. Não há tempo ocioso, navegação nem inferência de nenhum tipo. O log `pulso.falhou` leva só o resumo do erro.

D55 (discursiva e redação): nada a ver com esta tarefa. Não há campo, tela ou prompt de nota.

Medir o professor (D45, D64): nada a ver com esta tarefa. A métrica nova `api.pulso.idade_s` é da instância, não tem rótulo e não identifica ninguém.

Bloqueantes: nenhum.

Recomendações:
1. Para o `infra-guardian` e a regra 80, não para a regra 70: a recusa é decidida em cada instância, mas a lacuna só é gravada a partir do pulso global no banco. Se a api-1 estiver presa enquanto a api-2 pulsa, o aluno que bate na api-1 recebe 503 e esse tempo não volta para ele. O runbook trata isso como risco aceito porque a outra instância atende, mas a Tech Spec deveria registrar isso como decisão consciente.
2. O docblock de `apps/api/src/atividade/pulso/rotas-de-prova.guard.ts:7` cita `comecar`, `tempo` e `saidas-da-aba` como rotas de prova, mas elas ainda não existem: chegam na 3.0 e na 8.0. Melhor escrever "as de hoje e as que a 3.0 e a 8.0 trazem", para o comentário não afirmar o que o código ainda não faz.
3. Para a 6.0: a rotina que encerra a prova vencida usa este limite. A auditoria dela precisa confirmar que encerrar não cria Nota nem aplica sozinha uma consequência sobre o aluno.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-23 21:37:46 · `tasks/prd-avaliacao-e-correcao/2_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. As duas tabelas da tarefa, `pulso_da_api` (uma linha só, com `ultimo_em`) e `indisponibilidade` (`id`, `inicio`, `fim`), não guardam escola, pessoa, aluno nem conteúdo. Elas guardam só um instante e um intervalo de tempo. `limiteDaTentativa` recebe `alunoId` apenas como identificador, para filtrar a extensão de tempo, e não grava nem mostra nada.

Fora da tabela de dados do docs/lgpd.md: nada pessoal ficou de fora. A `indisponibilidade` é um registro técnico da API e não precisa estar no mapa de dados pessoais. A retenção de 13 meses está em `docs/modelo-de-dados.md:885`.

Autorização por objeto: ok.
- A `RotasDeProvaGuard` (`apps/api/src/atividade/pulso/rotas-de-prova.guard.ts:20-23`) roda depois das guardas globais de sessão e permissão.
- Quando recusa, devolve o mesmo 503 `INDISPONIVEL_TENTE_DE_NOVO` para qualquer `:id`, exista ele ou não, seja do aluno ou de outro. Trocar o id na URL não revela se o registro existe.
- A checagem por objeto que já existia em `MinhaAtividadeService` não mudou.
- O corpo do erro sai curto e tipado pelo `all-exceptions.filter`, sem stack trace.

Logs: limpos.
- `pulso.service.ts:70` registra `{ evento: 'pulso.falhou', erro: summarizeError(erro) }`. Isso leva só o tipo, o `sqlstate` e a `constraint`, e nunca a mensagem do erro nem a instrução SQL. O caso `avisa só com o resumo do erro` e a mutação correspondente provam isso.
- `expurgar-acesso.ts` acrescenta só a contagem `indisponibilidadesTotal`.
- O runbook pede para registrar a instância pelo nome do serviço, sem id de escola.

Auditoria: não se aplica. Não há leitura de dado de aluno por coordenação ou rede, exportação, alteração de nota, alteração de permissão nem aprovação de saída de IA.

Envio externo: nenhum. A métrica `api.pulso.idade_s` não tem rótulo e leva só um número de segundos. A tarefa não chama IA.

Seed/fixture: sintético. `pulso.int.test.ts:302` usa "Aluna Sintética Ana" e "Aluna Sintética Bia", criadas pela `SessaoFixtures`.

Ciclo de vida: a `indisponibilidade` é apagada em lote aos 13 meses, com `skip locked`. O teste cobre os dois lados do prazo. Ela não é dado de titular, então não precisa de retenção configurável por escola. A linha do pulso é única e não identifica ninguém.

Pergunta de fechamento: a tarefa não acrescenta nada ao que o sistema guarda sobre um aluno, nem a lugar algum para onde isso é enviado. A resposta de hoje, pelo arquivo do titular, continua completa.

Bloqueantes: nenhum.

Recomendações:
- `packages/core/src/retencao/expurgo-de-acesso.repository.ts:38`: o comentário de `RETENCAO_INDISPONIBILIDADE_MESES` cita `docs/lgpd.md` como fonte do prazo, mas `docs/lgpd.md` não menciona `indisponibilidade` nem `pulso`. Há dois caminhos:
  - tirar a citação e deixar só `docs/modelo-de-dados.md`;
  - ou acrescentar ao `docs/lgpd.md` uma linha dizendo que a tabela é técnica, sem pessoa, com retenção de 13 meses. A segunda opção ajuda quando o jurídico de uma prefeitura perguntar o que é cada tabela.
- Quando a 3.0 e a 8.0 levarem a guarda às rotas novas de prova (`comecar`, `tempo`, `saidas-da-aba`), vale um caso que mostre que o 503 sai igual para id inexistente e para id de outro aluno. Hoje isso vale pela construção do código, e esse caso deixaria a garantia provada por teste.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-23 21:38:46 · `tasks/prd-avaliacao-e-correcao/2_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

Fiz as seis subtarefas e não encontrei invasão de escopo. A `limiteDaTentativa` e o `QuedasDaApiRepository.leituraDesde` ficaram prontos, e só a 3.0 vai ligá-los às rotas. A guarda está só em `prova`, no PUT e no envio. As rotas novas ficam para a 3.0 e a 8.0. Os arquivos que não estavam na lista prevista (expurgo, métrica, painel e as três listas fechadas do alerta) estão na tabela da tarefa, com o motivo no item 8.

O pulso segue a Tech Spec §5.7: uma instrução só, com `for update`, `update` e `insert` juntos, o `now()` do banco e uma conexão retida que reconecta. O primeiro pulso vem antes do `listen`, e o tique e o relógio podem ser injetados. O 503 respeita a §13 e o `cenarios.md`: só as rotas de prova recusam, `minhas-atividades` segue funcionando, 30 s exatos ainda aceitam e 31 s recusam. O alerta é por instância e não usa `absent()`. O expurgo apaga em lote com `skip locked` aos 13 meses. As duas tabelas são globais e o desvio da regra 10 está escrito na §11 da Tech Spec.

A "prontidão ligada ao pulso", recomendada na rodada 3, ficou fora da lista da rodada 4. O runbook e o alerta dizem com todas as letras que a prontidão não depende do pulso, então não é desvio feito em silêncio.

Recomendações:
1. **Texto da Tech Spec, §5.7** (`tasks/prd-avaliacao-e-correcao/techspec.md:103`): ainda diz "recusa as rotas do aluno (503)". A rodada 4 do `revisao-spec.md` mandou trocar por "rotas de prova", como já está na §13 e no `cenarios.md`. O código segue a forma certa. Falta corrigir o texto para a 3.0 não ler a versão antiga.
2. **Indisponibilidades somem da leitura com a tabela do pulso vazia** (`apps/api/src/atividade/pulso/pulso.repository.ts:107-110`): a consulta parte de `pulso_da_api` com `leftJoin`. Se essa tabela está vazia, as indisponibilidades fechadas também não aparecem, e o limite de quem está em prova encolhe. Dura no máximo um tique, até o pulso recriar a linha. Vale registrar no docblock ou partir de uma subconsulta que não dependa da linha do pulso.
3. **Desligamento com um pulso em andamento** (`apps/api/src/atividade/pulso/pulso.service.ts:216-220`): `beforeApplicationShutdown` devolve a conexão ao pool sem esperar o pulso que está rodando. O resultado é só um `pulso.falhou` falso no log ou uma conexão ocupada voltando ao pool. Esperar o pulso em curso antes do `encerrar()` resolve.
4. **Docblock da conexão do pulso** (`apps/api/src/atividade/pulso/pulso.repository.ts:33-35`): "A requisição que esgota o pool não pode impedir o pulso" só vale enquanto a conexão continua retida. Para reconectar, o pulso entra na fila do pool compartilhado, o que a causa 3 do runbook já admite. Ajustar a frase, ou dar ao pulso uma conexão fora do pool, fica para o `infra-guardian` decidir.
5. **Logger padrão repetido**: o `opcoes.logger ?? createLogger({ servico: 'api' })` aparece em `app.module.ts` e em `atividade.module.ts`. O `AppModule` já manda o logger resolvido, então o padrão dentro do `AtividadeModule.forRoot` não serve para nada.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-23 21:38:54 · `tasks/prd-avaliacao-e-correcao/2_task.md`

VEREDITO: APROVADO
Caminho quente tocado: prova | migration (só o expurgo da tabela da 1.0) | deploy (o `main.ts` agora dá o primeiro pulso antes do `listen`)
Rate limit: ok. A guarda vem depois das guardas globais, então o limite por usuário e por escola já contou antes do 503. Não há nenhum limite novo por IP.
Fila e prioridade: ok. O expurgo da `indisponibilidade` entrou como mais um alvo do `sistema.expurgar-acesso`, que já é job de lote. Ele apaga em lotes de 5.000, `order by fim` e `for update skip locked`, e usa o índice `indisponibilidade_fim_idx`.
Concorrência: protegida.
- Dois pulsos ao mesmo tempo: o `for update` trava a linha única dentro de uma instrução só, e a corrida (g) tem teste.
- Duas instâncias recriando a linha: `on conflict do nothing` mais o índice único `pulso_da_api_linha_unica`.
- O mesmo pulso disparado duas vezes na instância: `#emAndamento` impede, e o teste da unidade prova.
Índice e paginação: ok. `leituraDesde` junta a linha única com `fim > desde` pelo índice de `fim`. A tabela é global e pequena, sem escola, e não cresce com aluno.
Degradação de IA: não se aplica.
Migration: não se aplica. A migration é da 1.0; esta tarefa só lê as tabelas e apaga linhas vencidas.
Métrica e alerta: ok.
- `api.pulso.idade_s` é medida por instância e tem painel.
- O alerta `max by (instance) ... >= 120`, com `for: 1m` e `noDataState: OK`, tem runbook com os seis campos e está na lista do ensaio.
- O pulso não fica preso para sempre: o pool já tem `statement_timeout` e `query_timeout`, e o embrulho de `pool.connect` descarta a conexão que falhou.
Bloqueantes: nenhum.

Rodei os testes desta tarefa e todos passaram:
- unidade: `limite-da-tentativa`, `pulso.service`, `metrics`, `alertas` e `alerta-tem-runbook`, 68 casos;
- integração: `pulso.int.test.ts`, 14 casos;
- integração: `expurgo-de-acesso.int.test.ts`, 24 casos.

Recomendações:
1. `apps/api/src/atividade/pulso/rotas-de-prova.guard.ts:21`: o 503 sai sem `Retry-After`. O `hash-bulkhead.ts` e o `challenge.ts` já mandam `Retry-After` com valor sorteado. Com 35 alunos da mesma turma reenviando assim que a rede volta, o reenvio da tela (tarefa 10.0) bate tudo junto na instância parada. Vale passar um `Retry-After` curto e sorteado, entre 2 e 6 s, como já é feito nesses dois arquivos.
2. Hoje a prontidão da instância não depende do pulso, então uma instância parada fica na rotação por cerca de 2,5 min antes do alerta, recusando a prova a quem cair nela. Fica para a Tech Spec ou a retro decidir se a prontidão deve passar a depender do pulso.
3. `apps/api/src/atividade/pulso/pulso.repository.ts:48`: a conexão do pulso fica presa e ocupa uma vaga do pool da API em cada instância. Vale registrar isso na conta do pool em `docs/infra.md` ou no comentário de `BANCO_POOL_MAXIMO` no `infra/compose.yml`, para quem dimensionar o pool na rajada da N2.
4. O cenário de carga não precisa mudar agora: a guarda lê só a memória da instância, e o pulso é uma instrução a cada 10 s por instância. Quando a 3.0 puser `leituraDesde` no PUT da resposta, o cenário de prova online precisa entrar nessa tarefa.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-23 21:40:27 · `tasks/prd-avaliacao-e-correcao/2_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- **Caminho feliz:** queda dentro da prova devolve o tempo; o pulso grava a lacuna; a instância que pulsa aceita a prova.
- **Bordas:** queda antes do começo, atravessando o começo e depois do fim; duas quedas, com ponto fixo; lacuna aberta e lacuna fechada iguais (40 min, sem teto); limiar de 30 s nos dois lados (20/29 s contra 31/40 s; 30 s contra 30 s e 1 ms); extensão do aluno, da turma e de outro aluno; tabela do pulso vazia; falha depois do `update`; conexão derrubada; expurgo na fronteira de 13 meses.
- **Permissão:** só as rotas de prova recusam, e `minhas-atividades` segue; o 503 vem depois das guardas globais.
- **Isolamento:** as tabelas são globais, sem escola nem pessoa, e o 503 é igual para todos.
- **Concorrência:** corrida (g), pulso contra pulso, com duas chamadas em paralelo; expurgo com `skip locked` contra uma transação que segura a linha; um pulso por vez no tique.

**Cobertos:** todas as linhas da tabela têm caso com o nome citado, e todos os nomes existem. Rodei `limite-da-tentativa.test.ts`, `pulso.service.test.ts` e `metrics.test.ts` (40 casos verdes) e `pulso.int.test.ts` (14 casos verdes). `node tools/processo/mutacoes.ts --faltando` não acusa nenhuma linha nova com condição sem bloco. Conferi à mão cada bloco de `limiteDaTentativa`, do repository, do serviço, da guarda, da fiação, da métrica e do expurgo: todos ficam vermelhos no caso citado. As exceções são as listadas abaixo. Não há `.skip`, e nenhum teste chama provedor de IA.

**Bloqueantes:**

1. **O bloco do `for update` fica vermelho pelo motivo errado.**
   - Onde: `apps/api/src/atividade/pulso/pulso.int.test.ts:259`, com o bloco em `tasks/prd-avaliacao-e-correcao/2_task.md:329-334`.
   - O problema: a corrida espera a segunda instância com `esperarNaTrava(bancada.pool, '%from pulso_da_api for update%', 2)`. Esse padrão é justamente o texto que a mutação apaga. Com a mutação, nenhuma consulta casa com o padrão, e o `aguardar` estoura os 15 s (`apps/api/test/write-block-trigger.ts:7-13`) com "não aconteceu a tempo". A asserção da linha 265 ("uma lacuna só") nunca roda. O vermelho prova que o texto sumiu, não que a lacuna foi gravada duas vezes.
   - Correção exigida: usar um padrão que não dependa da cláusula, por exemplo `'%with antes as (select ultimo_em from pulso_da_api%'`. Sem o `for update`, a segunda instância continua esperando em `Lock`, só que no `update`. Ela lê o `ultimo_em` antigo e grava a segunda lacuna. Assim o `toMatchObject([{ inicio: parou }])` fica vermelho pelo motivo certo.

2. **Um item da linha "Relógio injetado +31 s; +29 s" está sem prova.**
   - Onde: `apps/api/src/atividade/pulso/pulso.int.test.ts:318-325`.
   - O problema: o nome do caso e a linha da tabela dizem "+29 s e +30 s aceitam `prova`, PUT e envio". O laço das linhas 322-325 só chama `rotas.prova(bia, ...)`. Que PUT e envio aceitam até 30 s não está provado em lugar nenhum. A linha junta isso a outros itens com ponto e vírgula, e cada item conta sozinho.
   - Correção exigida, uma das duas:
     - (a) Em +29 s e +30 s, chamar também `responder`, e `enviar` com uma terceira aluna, para não consumir o envio da Ana que o +31 s confere. A contagem de `resposta_atividade` passa a comparar antes e depois da recusa, e não com zero.
     - (b) Renomear o caso e corrigir a linha da tabela para dizer que a fronteira de 30 s é provada em `prova` e no `pulso.service.test.ts`, já que a guarda é uma só para as três rotas.

**Recomendações:**
- **Caso "um pulso por vez"** (`pulso.service.test.ts:144-148`): sob a mutação, ele fica vermelho por timeout (impasse), e não por asserção. O `await segundo` vem antes de `soltar()`, e o segundo pulso fica preso no `segurar`. Conferir `repo.pulsos` antes de esperar o segundo dá um vermelho por asserção.
- **`PulsoRepository.encerrar`** (a conexão real devolvida ao pool) não tem caso. O `afterEach` (`pulso.int.test.ts:64-66`) corre o `pool.end()` contra 3 s de propósito e esconde a conexão que não voltou. Um caso que espere `pool.end()` sem a corrida provaria o desligamento limpo.
- **Log do resumo do erro** (`pulso.service.test.ts:131`): o `not.toContain('1234')` é vazio, porque a `message` de um `Error` não é enumerável e o `JSON.stringify` nunca a mostra. Quem prova é o `objectContaining({ sqlstate })`. Vale trocar por uma checagem que falhe com o erro cru, como `not.toHaveProperty('erro.message')`.
- **Bloco "sem `order by`" do expurgo:** depende da ordem física das linhas. Funciona porque as linhas são inseridas fora de ordem, mas não é garantido. Fica registrado.
- **Bloco "sem `skip locked`":** fica vermelho por espera (`statement_timeout` ou timeout do caso). Um `lock_timeout` curto na transação do caso daria um vermelho rápido e explícito.
- **Isolamento:** o 503 é uniforme por construção (a guarda roda antes da autorização por objeto). Um caso com id de outra escola em +31 s, esperando o mesmo 503, deixaria isso registrado em teste.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-23 22:06:20 · `tasks/prd-avaliacao-e-correcao/2_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. A linha 103 da `techspec.md` §5.7 ainda diz "rotas do aluno". Essa correção é do Arquiteto e agora está no `TODO.md`, não neste código.
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

Conferi cada trecho do diff contra o código atual:
- **Comentários:**
  - O docblock de `apps/api/src/atividade/pulso/rotas-de-prova.guard.ts` lista `prova`, o PUT da resposta e o envio. São exatamente as três rotas que têm `@UseGuards(RotasDeProvaGuard)` em `minha-atividade.controller.ts:46,54,66`.
  - Em `RETENCAO_INDISPONIBILIDADE_MESES`, a citação de `docs/lgpd.md` saiu.
  - Os docblocks de `QuedasDaApiRepository` e de `PulsoRepository` agora explicam a tabela vazia e a volta do pulso à fila do pool depois que a conexão cai.
- **Bloco de mutação novo:** o trecho `-    conexao?.release()` alcança só o `encerrar` (`pulso.repository.ts:88`). Ele não se confunde com o `release(true)` de `#descartar` (linha 59).
- **`pulso.int.test.ts`:** a troca da Bia pela Cris e pela Dani na fronteira de +29 s e +30 s dispensou o `delete` de `tentativa_atividade`. Com isso, a conta "Bia sem tentativa" no +31 s passou a valer sem preparo. Os casos com id de outra escola e com id inexistente provam o 503 antes de qualquer leitura.
- **Minhas recomendações 1, 3 e 5 da rodada 1:** estão na tabela "Sem aplicar", com destino. A 1 e a 3 também foram registradas no `TODO.md`. A 5 foi recusada com motivo coerente: o padrão `opcoes.logger ?? createLogger(...)` é o mesmo dos outros módulos.

Recomendações:
- No caso novo "`encerrar` devolve a conexão retida" (`apps/api/src/atividade/pulso/pulso.int.test.ts:164`), o pool criado não entra em `pools`. Se o caso falhar, ou quando a mutação rodar, o pool fica aberto até o fim do processo, porque o `afterEach` não o fecha. Basta registrá-lo em `pools` e deixar o `afterEach` cuidar dele.
- Em `pulso.service.test.ts:161`, `not.toHaveProperty('erro.message')` só cobre a chave `message`. Se o erro cru um dia for parar no log sob outra chave, por exemplo `detail` ou `query` do `pg`, o caso não vê. Uma lista positiva das chaves permitidas em `erro`, como `toEqual({ sqlstate: ... })`, provaria mais.

## test-engineer · 2ª rodada · APROVADO · 2026-11-23 22:07:15 · `tasks/prd-avaliacao-e-correcao/2_task.md`

VEREDITO: APROVADO

**Cenários exigidos:** as duas correções da 1ª rodada e as quatro recomendações que a Mesa mandou aplicar. São elas:
- a corrida (g) ficar vermelha, sob a mutação do `for update`, pelo motivo certo;
- a fronteira de 30 s provada em `prova`, no PUT e no envio;
- um pulso por vez com asserção;
- o log conferido sem `erro.message`;
- `PulsoRepository.encerrar` com caso e bloco de mutação;
- o 503 igual para id de outra escola e para id inexistente.

**Cobertos:**
1. **Correção 1, feita.** Em `apps/api/src/atividade/pulso/pulso.int.test.ts:270`, o padrão agora é `'%with antes as (select ultimo_em from pulso_da_api%'`, e ele casa também com o texto mutado. Sob a mutação, a segunda instância não trava no `with antes` e lê o `ultimo_em` antigo pelo snapshot. Ela espera na trava de linha do `update`, com `wait_event_type = 'Lock'`. Somada à primeira, parada na trava consultiva do gatilho, a contagem chega a 2 e o `esperarNaTrava` sai. Quando a segunda volta a avaliar a linha (EvalPlanQual), o `antes`, que não é trava nem alvo do `update`, continua com a linha lida antes, e o `anterior` fica igual a `parou`. A segunda grava então outra lacuna, com o mesmo `inicio: parou`. As lacunas passam a ser duas, e o `toMatchObject([{ inicio: parou }])` da linha 276 falha pelo tamanho do array. É o vermelho pelo motivo certo. Sem a mutação, o `for update` relê a versão confirmada, e a lacuna é uma só.
2. **Correção 2, feita pela opção (a).** Em `pulso.int.test.ts:340-349`, a Cris (+29 s) e a Dani (+30 s) chamam `prova`, `responder` e `enviar`, cada uma com 200, e a contagem de `resposta_atividade` dá 1. Como as duas alunas são novas, a Ana e a Bia seguem limpas para o +31 s, e as contagens com zero das linhas 362-364 continuam corretas. A linha "Relógio injetado +31 s; +29 s" da tabela (`2_task.md:67`) cita o caso pelo nome, e o nome bate.
3. **Um pulso por vez** (`pulso.service.test.ts:137-156`). A conferência vem depois de um `setImmediate`, com o primeiro pulso ainda parado. Sem o `if (this.#emAndamento) return`, o segundo tique chega ao repositório e `pulsos` vai a 3. Sem o `#emAndamento = false`, o terceiro tique não pulsa e o `toBe(3)` fica vermelho. As duas mutações (`2_task.md:386-396`) ficam vermelhas pela asserção.
4. **Log** (`pulso.service.test.ts:131`). `not.toHaveProperty('erro.message')` pega o `Error` cru, que tem `message` próprio e não enumerável. O `JSON.stringify` antigo passava mesmo com o erro cru, porque esse campo não entra na serialização.
5. **`encerrar`** (`pulso.int.test.ts:164-172`, bloco em `2_task.md:289-293`). Sem o `release()`, o `pool.end()` espera a conexão emprestada, a corrida devolve `'preso'` e o caso falha pela asserção. O texto do bloco não casa com o `release(true)` do `#descartar`.
6. **503 antes da leitura** (`pulso.int.test.ts:356-360`): `prova`, PUT e envio respondem `INDISPONIVEL_TENTE_DE_NOVO` para o id de outra escola e para um `randomUUID()`.

Rodei os dois arquivos uma vez cada: `pulso.service.test.ts` passou nos 10 casos e `pulso.int.test.ts`, nos 15.

**Bloqueantes:** nenhum.

**Recomendações:**
- `pulso.int.test.ts:165`: o pool do caso de `encerrar` não entra em `pools`. Com a mutação aplicada, ninguém o encerra depois do vermelho e a conexão fica pendurada até o worker do vitest cair. Registrá-lo em `pools` não muda o resultado, porque o `afterEach` já limita a espera em 3 s.
- O caso do 503 para id de outra escola e para id inexistente não tem bloco de mutação. Se a guarda fosse para depois da leitura, ele ficaria vermelho (404 no lugar do 503), mas o documento não diz isso. Fica para quando a 3.0 e a 8.0 levarem a guarda às rotas novas, como a tabela "Sem aplicar" já registra.
