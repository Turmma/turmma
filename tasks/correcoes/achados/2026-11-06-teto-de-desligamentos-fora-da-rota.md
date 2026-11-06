# Achados das revisões — `tasks/correcoes/2026-11-06-teto-de-desligamentos-fora-da-rota.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-06 06:31:15 · `tasks/correcoes/2026-11-06-teto-de-desligamentos-fora-da-rota.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova e nenhuma migration. `importacao_planilha` e `lista_nome` não mudaram de forma. O teste novo lê as duas sempre filtrando por `escola_id`.

Queries verificadas:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/motor.ts:95-113`, método `gravar`. A mudança só valida `pedido.marcas` com `marcasDaPlanilhaSchema` antes de refazer a prévia e grava o resultado da validação. O escopo não mudou: escola e ano vêm do contexto, por `preparar` e `ImportacaoRepository(tx)`. Nenhum parâmetro novo de `escolaId` ou `anoLetivoId` entra pelo pedido. Cada id marcado ainda precisa ser candidato da prévia da escola do contexto (linha 106), então um id de outra escola continua dando `ENTRADA_INVALIDA`, a mesma resposta de id inexistente.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/test/desligamento-pela-planilha.int.test.ts:453-487`. O seed de `lista_nome` grava com `escola_id` e `ano_letivo_id` do cenário. As contagens em `importacao_planilha` e em `lista_nome` filtram por `escola_id`. O motor roda com `runInContext(contextoDe(c.escola))`.

Teste de isolamento: não se aplica a esta correção, porque ela não cria nem altera cláusula de escopo. Os testes de isolamento do módulo que já existem continuam valendo. O caso novo, de 101 marcas, prova o teto no motor. Ele falha se a validação sair, e o bloco de mutação da tarefa registra isso.

Bloqueantes: nenhum.

Recomendações:
- Com o teto de 100, nenhum teste prova mais que `retirarNomes` (`importacao.repository.ts`, `TAMANHO_DO_LOTE`) processa mais de um lote. A tarefa registra isso. Não é questão de isolamento, mas vale um teste direto do repository com mais de 500 nomes, sempre no escopo de uma escola, para o laço não ficar sem prova.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-06 06:31:15 · `tasks/correcoes/2026-11-06-teto-de-desligamentos-fora-da-rota.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo. A correção só muda o momento em que as marcas de `desligar` são validadas, e as marcas são ids (UUID). Não há migration, coluna nem DTO novo.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok. A validação nova pelo schema vem antes de `preparar` e não lê o banco. A conferência de que cada marca é candidata da prévia, que é o que prende o id à escola, continua igual (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/motor.ts:101-104`). As marcas gravadas agora são `lidas.data`. O schema é `strictObject` só com arrays de UUID, então não entra nenhum campo além dos esperados.

Logs: limpos. O diff não acrescenta nenhum log, e a recusa é `DomainException(ErrorCode.ENTRADA_INVALIDA)` sem dado no corpo.

Auditoria: presente. O caso do teto de 100 confere 100 registros `lista_nome.retirado`. O caso de 101 confere que nenhuma importação foi criada, então não há retirada sem rastro.

Envio externo: nenhum.

Seed/fixture: sintético. Os nomes do teste são `'Nome Do Lote ' || g`, com matrícula `lote-<uuid>-g`.

Bloqueantes: nenhum.

Recomendações:
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/correcoes/2026-11-06-teto-de-desligamentos-fora-da-rota.md`, a seção "Mutações" abre com a linha `--faltando: 1 linhas (0 blocos, 1 motivos)`, que parece saída da ferramenta colada no texto. Vale tirar ou explicar.
- A correção diz que a prova de que `retirarNomes` corre em mais de um lote deixa de existir pelo desligamento. A eliminação real dos nomes que saem da lista continua provada até 100 por gravar, então isso não fere a regra 20. Fica para a retro um caso direto no repository que prove o laço com mais de 500, para não depender só dos outros dois laços.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-06 06:31:16 · `tasks/correcoes/2026-11-06-teto-de-desligamentos-fora-da-rota.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. A correção mexe só na importação por planilha (`MotorDePlanilha.gravar` e um teste de desligamento) e não grava nem lê `Nota`. A pergunta "todos com autor humano?" não se aplica aqui.

Decisão autônoma sobre aluno: ausente. Quem decide desligar é a pessoa que marca o candidato na prévia (`pedido.marcas.desligar`), e não há IA nesse caminho. A correção só restringe: com mais de 100 marcas, o motor recusa na hora com `ENTRADA_INVALIDA` (`packages/core/src/importacao/motor.ts:96-99`). Nada é desligado por conta própria, e as marcas gravadas são as que o schema devolveu (`motor.ts:110`).

Aprovação registrada: ok. Nenhuma saída de IA passa por esse fluxo, e a exceção do tutor (D47) não é usada.

Supervisão do tutor: ok. O tutor não é tocado.

Autonomia declarada e visível: sim. Nenhum agente nem nível de autonomia mudou.

Bloqueantes: nenhum.

Recomendações:
- O comentário em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/motor.ts:96` tem uma linha muito longa. Vale quebrá-la, mas é questão de estilo e fica para os outros revisores.
- O arquivo da tarefa reconhece que a prova de que `retirarNomes` corre em mais de um lote deixou de existir pelo caminho do desligamento. Isso não é assunto da regra 70, mas o `test-engineer` deve conferir se a prova continua coberta pelos outros dois casos de 501.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/motor.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/test/desligamento-pela-planilha.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/correcoes/2026-11-06-teto-de-desligamentos-fora-da-rota.md`

`docs/regulacao.md` não foi alterado nesta tarefa.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-06 06:31:41 · `tasks/correcoes/2026-11-06-teto-de-desligamentos-fora-da-rota.md`

VEREDITO: APROVADO
Caminho quente tocado: fila
Rate limit: ok (a correção não mexe em rate limit)
Fila e prioridade: ok. O `gravar` agora passa as marcas pelo mesmo schema que o job usa para relê-las, então mais de 100 `desligar` volta `ENTRADA_INVALIDA` antes de entrar na fila, em vez de enfileirar uma importação que o job fecharia `falhou`. A checagem é síncrona e roda antes de `preparar`, ou seja, antes de refazer a prévia, que é a parte cara: o pedido inválido não custa trabalho no request.
Concorrência: protegida. Nada mudou nesta parte: a transação, o índice único de `na_fila` e a outbox continuam como estavam.
Índice e paginação: ok (nenhuma query nova)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (nenhum caminho novo para medir; é um erro de validação síncrono)
Bloqueantes: nenhum

O arquivo `apps/worker/test/desligamento-pela-planilha.int.test.ts` roda verde aqui com 28 de 28 casos, incluindo os dois novos ("o teto de um gravar (100)" e "um a mais que o teto (101)"). O caso de 101 checa o código de erro e também que nenhuma linha ficou em `importacao_planilha`. A mutação declarada na tarefa confere com o diff.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/importacao.repository.ts:422`: o laço em lotes de `TAMANHO_DO_LOTE` (500) do `retirarNomes` não roda mais por nenhum caminho real, porque o teto de 100 deixa o desligamento sempre num lote só, e ele ficou sem teste de mais de um lote. Há dois caminhos: provar o laço chamando o `ImportacaoRepository.retirarNomes` direto com 501 retiradas, ou trocar o laço por uma asserção de que o tamanho não passa do teto. Hoje é só código sem uso; não é risco de carga.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/motor.ts:96`: o comentário tem uma linha só e é bem longo. Pode ser quebrado para ficar no padrão do arquivo, mas é questão de forma.

## test-engineer · 1ª rodada · APROVADO · 2026-11-06 06:32:51 · `tasks/correcoes/2026-11-06-teto-de-desligamentos-fora-da-rota.md`

VEREDITO: APROVADO

Cenários exigidos:
- **Caminho feliz:** um gravar com exatamente o teto (100 desligamentos), pelo motor e depois pelo job, conclui com `retirados: 100`. Os 100 nomes saem da lista, há 100 registros `lista_nome.retirado` e nenhum `desatualizada`.
- **Borda 1 (o defeito):** um a mais que o teto (101), todos candidatos válidos da prévia, chega ao motor sem passar pela rota. Tem de dar `ENTRADA_INVALIDA` na hora, sem linha em `importacao_planilha`.
- **Borda 2 (o limite exato):** o schema do motor e o `lerMarcas` do job precisam aceitar 100. O caso de 100 prova isso, porque o job conclui.
- **Regressão:** quem já chama o motor (a rota e os testes de alunos, professores, grade, transferência e da importação na API) não pode quebrar com a nova leitura pelo schema.
- **Permissão e isolamento:** a correção não muda nenhum caminho de dado nem de escopo. A validação acontece antes de qualquer leitura no banco. Os casos de isolamento da A e da B que já existiam no arquivo seguem verdes.
- **Concorrência:** não se aplica. Não há escrita nova nem caminho novo que possa correr duas vezes.

Cobertos:
- `apps/worker/test/desligamento-pela-planilha.int.test.ts:460`, "o teto de um gravar (100)…". Afirma o estado `concluida`, o resumo, a contagem na lista e a contagem na auditoria.
- `apps/worker/test/desligamento-pela-planilha.int.test.ts:473`, "um a mais que o teto (101)…".
  - Antes de afirmar, confere que as 101 marcas são todas candidatas. Assim só o teto pode recusá-las, e o cenário de fato chega à cláusula nova.
  - Afirma o código de erro e a tabela de importações vazia. A escola é nova a cada cenário, então a tabela vazia prova alguma coisa.
- **Mutação:** o bloco do documento cobre a única cláusula nova (`motor.ts:97-99`). O motivo dado para o `??` da linha 110 se sustenta, porque a condição não mudou.
- **Vermelho pelo motivo certo, visto por acaso:** rodado a partir de `apps/worker`, sem a config da raiz, o `@educa/core` resolve para o `dist` antigo. Ali o caso de 101 falhou em `expected 'gravou' to be 'ENTRADA_INVALIDA'`, na linha 485. É o mesmo vermelho que a mutação declara e a prova de que o cenário chega à cláusula.
- **Verde:** pela config da raiz, o arquivo inteiro passou (28 de 28). Os outros chamadores do motor também passaram: `gravar-planilha-alunos`, `gravar-planilha-professores`, `gravar-planilha`, `gravar-planilha-grade`, `transferencia-pela-planilha` e `apps/api/test/importacao-alunos.int.test.ts`, 145 de 145.
- **Proibições:** não há `.skip`, teste comentado nem mock que esconda a regra. O enfileirador falso só substitui a fila, e a regra é provada pela resposta e pela tabela.

Bloqueantes: nenhum

Recomendações:
1. **Laço de lotes que ficou sem uso.** Com o teto de 100, nenhum caminho de produção chega ao segundo lote do laço de `ImportacaoRepository.retirarNomes`, em `packages/core/src/importacao/importacao.repository.ts:418-422`. O documento registra a perda da prova com honestidade. Para a validação ou a retro, vale decidir entre dois caminhos:
   - provar o laço direto no repository com 501 retiradas;
   - simplificar o laço para um lote só, com um comentário que amarre isso ao `MAXIMO_DE_DESLIGAMENTOS_POR_GRAVAR`.
   
   Hoje uma mutação que quebre o laço passaria sem ninguém ver.
2. **Mutação mais estreita sem bloco.** A mutação que mantém a leitura pelo schema mas grava `pedido.marcas` em vez de `lidas.data` não tem bloco. Ela só se diferencia quando o schema completa um valor por padrão, porque com entrada já tipada as duas formas são equivalentes. Não bloqueia, mas fica registrada.
3. **Testes rodados de dentro da pasta do worker.** Rodar `npx vitest run` dentro de `apps/worker` usa o `dist` velho do `@educa/core`, e o resultado diz o que o código fazia antes. Vale uma linha no guia do desenvolvedor: teste de integração do worker se roda pela config da raiz.
