# Achados das revisões — `tasks/correcoes/2026-11-13-testes-com-relogio.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-13 21:49:09 · `tasks/correcoes/2026-11-13-testes-com-relogio.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova e nenhuma migration. A tarefa só mexe em helpers de teste que escrevem em `suspensao_de_funcao`, uma tabela que já existe e já tem `escola_id`.

Queries verificadas:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/atividade/atividade.int.test.ts:531`: o `update` continua filtrando por `escola_id = $1`.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/entrega/entrega.int.test.ts:398`: continua filtrando por `escola_id = $1 and retomada_em is null`.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/ia/ia.int.test.ts:339`: continua filtrando por `escola_id = $1 and funcao = $2 and retomada_em is null`.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/ia/ia.int.test.ts:685`: continua filtrando pela escola B, pela função e por `retomada_em is null`.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/governanca/governanca.repository.ts:256-264` (só lida, não alterada): a retomada em produção aplica o escopo com `requireEscolaId()`, que vem da sessão.

Nos quatro helpers a mudança é só a expressão do instante, `greatest(now(), suspensa_em)`, calculada linha a linha. O `where` não mudou, então nenhuma retomada alcança suspensão de outra escola. Não há repository, endpoint, `@Unscoped()`, `escolaId` vindo do cliente ou leitura agregada da camada de rede.

Teste de isolamento: presente e efetivo. O caso "função suspensa em B, ativa em A" em `ia.int.test.ts` continua provando o isolamento. A troca do instante da retomada não enfraquece nenhuma asserção de escopo. Não era exigido teste novo, porque a correção não cria superfície de acesso.

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/governanca/governanca.repository.ts:259` grava `retomadaEm: sql\`now()\`` sem `greatest(now(), suspensa_em)`. O escopo está certo. Se o relógio do servidor recuar, a checagem `suspensao_de_funcao_retomada_depois` recusa a retomada e a coordenação não consegue reativar a função. Isso é robustez de operação, não isolamento. O registro feito na tarefa para o Orquestrador é o encaminhamento certo.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-13 21:49:10 · `tasks/correcoes/2026-11-13-testes-com-relogio.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. As quatro mudanças trocam só o valor de `retomada_em`, de `now()` para `greatest(now(), suspensa_em)`, em helpers de teste que retomam uma função suspensa na tabela `suspensao_de_funcao`. Essa tabela guarda configuração da escola, não dado de aluno. O `retomada_por` continua recebendo o id do usuário da coordenação, como antes.
Fora da tabela de dados do docs/lgpd.md: nenhum campo novo, nem migration, nem mudança de schema.
Autorização por objeto: ok. Nenhuma rota, repository ou DTO mudou. Os updates continuam filtrados por `escola_id` (e por `funcao` nos casos de `ia.int.test.ts`).
Logs: limpos. O diff não acrescenta log, console nem mensagem de erro.
Auditoria: presente. Nenhuma ação que exige auditoria foi alterada; o que mudou é o arranjo de teste, que grava direto no banco.
Envio externo: nenhum.
Seed/fixture: sintético. Não entra dado novo; os helpers usam as escolas e os usuários que os próprios testes criam.
Bloqueantes: nenhum.
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/packages/core/src/db/schema/mvp/mvp-tables.int.test.ts:1352` ainda grava `retomada_em = now()` logo depois de criar a suspensão, então pode falhar do mesmo jeito quando o relógio da máquina recua. Não é assunto de privacidade; fica para o `test-engineer` decidir. A linha 1351 é diferente: ela testa de propósito que o banco recusa a retomada sem autor, e deve ficar como está.
- O aviso da correção sobre `apps/api/src/governanca/governanca.repository.ts:259`, que grava `retomadaEm: now()` em produção, também não toca dado pessoal. Concordo que fique registrado para o Orquestrador.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/atividade/atividade.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/entrega/entrega.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/ia/ia.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/tasks/correcoes/2026-11-13-testes-com-relogio.md`

## infra-guardian · 1ª rodada · APROVADO · 2026-11-13 21:49:12 · `tasks/correcoes/2026-11-13-testes-com-relogio.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum

A correção só mexe nos helpers de retomada de quatro testes de integração. Nenhum código de produção mudou, e nada novo passa a correr por request, fila, gateway de IA, migration ou estado em memória.

- **Checagem do banco:** `suspensao_de_funcao_retomada_depois` continua em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/packages/core/src/db/schema/suspensao-de-funcao.ts:49`.
- **O que os testes provam:** continua igual. A função suspensa não corre, e a retomada a reativa.
- **Os quatro helpers:** usam agora `greatest(now(), suspensa_em)`, como já faziam o tutor, o assistente e o artefato.
- **Linhas 857 e 881 de `ia.int.test.ts`:** ainda usam `now()`, mas gravam os dois instantes numa instrução só, então o valor é o mesmo e o recuo do relógio não as afeta.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/governanca/governanca.repository.ts:259`: em produção, `retomar` grava `retomadaEm: sql\`now()\``. Os dois instantes vêm da hora do mesmo banco e, num servidor sincronizado por NTP, a hora não recua, então não há falha esperada. Mesmo assim, usar `greatest(now(), suspensa_em)` também em produção evitaria uma recusa da checagem, ou seja, um 500 para a coordenação, se a hora do banco recuar (máquina virtual restaurada, ajuste manual do relógio). Fica para o Orquestrador decidir se isso vira tarefa.
- O caso intermitente "aluno transferido" do `tutor.int.test.ts` continua sem explicação. Se voltar a falhar, vale abrir uma correção própria com a mensagem do erro.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-13 21:49:16 · `tasks/correcoes/2026-11-13-testes-com-relogio.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta correção. O diff só troca `retomada_em = now()` por `retomada_em = greatest(now(), suspensa_em)` em quatro helpers de teste que gravam em `suspensao_de_funcao`. Nenhuma linha toca `nota`, `lancadaPor` nem código de produção. Todos com autor humano? sim, porque nenhum caminho foi alterado.

Decisão autônoma sobre aluno: ausente.

Aprovação registrada: ok. O caso de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/entrega/entrega.int.test.ts` perto da linha 398 continua provando que, com a função suspensa, a entrega pendente ainda pode ser aprovada ou rejeitada com justificativa. A mudança fica só no `finally`, que limpa a suspensão depois do teste.

Supervisão do tutor: ok. Os casos que suspendem e retomam `tutor_com_o_aluno` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/ia/ia.int.test.ts` (linhas 339 e 685) provam o mesmo que antes. A retomada continua gravando a coordenação em `retomada_por`.

Autonomia declarada e visível: sim, nada mudou nisso. A suspensão por função, que é o procedimento de suspensão exigido pela AIA (D60), continua com a checagem `suspensao_de_funcao_retomada_depois` no banco. A mudança não afrouxa a checagem. Ela só impede que o teste grave uma retomada com instante anterior ao da suspensão quando o relógio da máquina de desenvolvimento recua.

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/packages/core/src/db/schema/mvp/mvp-tables.int.test.ts:1352` ainda grava `retomada_em = now()` num comando separado do insert da suspensão, e pode quebrar do mesmo jeito com o recuo do relógio. O documento da correção diz que todos os outros `now()` dos testes foram lidos um a um, mas só cobre os de `apps/`, e esta linha fica fora dele. Na próxima correção, aplicar ali o mesmo `greatest(now(), suspensa_em)`. A linha 1351 tem que ficar como está: ela prova a recusa `suspensao_de_funcao_retomada_registrada`.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/governanca/governanca.repository.ts:259` (produção) grava `retomadaEm: sql\`now()\``. Se o NTP atrasar o relógio do servidor alguns segundos, uma coordenadora que retoma a função logo depois de suspendê-la recebe um erro 500 por causa da checagem do banco, e a função suspensa continua bloqueada até ela tentar de novo. Isso não fere a regra 70, porque o erro deixa o sistema mais restritivo, não menos. O documento já registra a questão para o Orquestrador, e eu concordo em levar à decisão dele usar `greatest(now(), suspensa_em)` também na produção.
- A reprodução vermelha e verde da correção foi feita à mão, no Postgres, e não ficou num teste. Isso é aceitável aqui, porque a correção só mexe em teste e o vermelho depende do relógio da máquina. Se a produção mudar, aí vale um caso de integração que crie uma suspensão com `suspensa_em` no futuro e prove que a retomada pela rota ainda passa.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-13 21:49:56 · `tasks/correcoes/2026-11-13-testes-com-relogio.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
Nesta correção só mudam helpers de teste. O que precisa ser provado:
1. Retomar a suspensão grava `retomada_em` que nunca fica antes de `suspensa_em`, mesmo com o relógio de parede recuando.
2. A troca não afrouxa o que os casos provam: a função suspensa não roda, a função retomada volta, e a outra escola segue ativa.
3. A causa foi tirada de todos os pontos que compartilham o par `suspensa_em`/`retomada_em` com a checagem `suspensao_de_funcao_retomada_depois`.

**Cobertos:**
- O cenário 1 está coberto nos quatro pontos do pedido: `apps/api/src/entrega/entrega.int.test.ts:398`, `apps/api/src/ia/ia.int.test.ts:339` e `:685`, e `apps/api/src/atividade/atividade.int.test.ts:531`. A troca é para `greatest(now(), suspensa_em)`, a mesma de tutor, assistente e artefato.
- O cenário 2 está coberto. Uma suspensão está em vigor quando `retomada_em is null`, como em `apps/api/src/ia/suspensao.repository.ts:22` e `apps/api/src/assistente/suspensoes-da-escola.repository.ts:16`. Por isso o `greatest()` não muda o que conta como suspenso nem esconde a regra. As asserções depois da retomada continuam no lugar: em `ia.int.test.ts` a função "volta a ficar ativa", e em `atividade.int.test.ts:532-534` a entrega fica pendente.
- Rodei os três arquivos uma vez: 93 de 93 passaram.
- A reprodução do vermelho, feita com `suspensa_em = now() + 1,2 s`, é aceitável como evidência: o relógio da máquina não se controla num teste, e o código de produção não mudou.
- Não há `.skip`, mock nem chamada a provedor pago.

**Bloqueantes:**
1. `packages/core/src/db/schema/mvp/mvp-tables.int.test.ts:1352` tem exatamente a causa que a correção ataca, e o documento não fala dele.
   - **O que está errado:** a linha 1346 insere a suspensão com o `defaultNow()` em autocommit. A linha 1352 faz `update suspensao_de_funcao set retomada_em = now(), retomada_por = $2 …` em outra transação. Não há `begin` em volta: os blocos de transação do arquivo estão em 1040-1049, 1091-1102 e 1488-1491. Com o recuo de cerca de 1,2 s, esse update esbarra na mesma `suspensao_de_funcao_retomada_depois` e o teste "no máximo uma suspensão vigente…" fica intermitente pelo mesmo motivo.
   - **O documento também está errado:** `tasks/correcoes/2026-11-13-testes-com-relogio.md:31-32` diz que os outros usos de `now()` dos testes "foram lidos um a um: não quebram com o recuo". A leitura parece ter ficado em `apps/` e não chegou a `packages/`.
   - **Correção exigida:** trocar a linha 1352 para `retomada_em = greatest(now(), suspensa_em)`. A linha 1351 fica como está: ela prova `suspensao_de_funcao_retomada_registrada` e não depende da ordem dos instantes. Depois, corrigir a frase das linhas 31-32 do documento, incluir o `packages/core/.../mvp-tables.int.test.ts` em "Arquivos alterados" e na estabilidade, e acrescentar o `privacy-guardian`/`tenancy-guardian` que esse caminho pedir.

**Recomendações:**
- `apps/api/src/governanca/governanca.int.test.ts` passa por `governanca.repository.ts:259`, que é produção e grava `retomadaEm: now()`. Os casos em 302, 313, 320, 392, 412, 431 e 530 podem ficar vermelhos pelo mesmo motivo nesta máquina. O documento já leva o caso ao Orquestrador (linhas 63-64). Vale escrever ali também que esses casos de teste ficam expostos até a decisão sobre produção, para o próximo vermelho não virar outra investigação.
- `apps/api/test/arquivo-do-titular.int.test.ts:409` está seguro: `suspensa_em` e `now() + 1 s` saem do mesmo statement. Vale citá-lo no documento entre os usos lidos.
- O sintoma do "aluno transferido" ficou sem causa. O registro honesto que está lá é suficiente; não peço mudança.

## test-engineer · 2ª rodada · REPROVADO · 2026-11-13 21:58:25 · `tasks/correcoes/2026-11-13-testes-com-relogio.md`

**VEREDITO: REPROVADO**

A correção que pedi foi feita. Mas a linha 1351, que eu mandei manter como estava, tem a mesma causa, e o erro foi meu na rodada anterior.

**Cenários exigidos:** a retomada de suspensão não pode quebrar quando o relógio do Postgres recua cerca de 1,2 s. Isso vale nos quatro helpers do pedido (`entrega` 398, `ia` 339 e 685, `atividade` 531), no `mvp-tables` e em toda asserção cujo resultado dependa da ordem entre `suspensa_em` e `now()`. O que cada caso prova continua o mesmo: a função suspensa não corre, a retomada a reativa, e a checagem `suspensao_de_funcao_retomada_depois` segue no banco.

**Cobertos:**
- `mvp-tables.int.test.ts:1352` agora usa `greatest(now(), suspensa_em)`, como pedido.
- O documento corrige a frase das linhas 31-32 e cita o arquivo de `packages/core` em "Arquivos alterados" e na estabilidade (72 casos × 10).
- `tenancy-guardian` e `privacy-guardian` aparecem com rodada APROVADO na tabela de revisões.
- Conferi com `git grep`: nenhuma outra atribuição `retomada_em = now()` sem `greatest` sobrou em `apps/`, `packages/`, `e2e/`, `infra/` ou `tools/`, fora a 1351.
- A leitura de `arquivo-do-titular.int.test.ts:409` (os dois instantes saem do mesmo statement) e de `e2e/support/governanca.ts:254` (só lê) está certa.

**Bloqueantes:**

1. `packages/core/src/db/schema/mvp/mvp-tables.int.test.ts:1351` fica intermitente pela mesma causa.
   - **O que está errado:** o update `retomada_em = now()` sem `retomada_por` espera a recusa `suspensao_de_funcao_retomada_registrada`. O Postgres confere as restrições CHECK de uma tabela em ordem alfabética de nome e para na primeira que falha. As duas restrições estão em `packages/core/drizzle/0022_mvp_apresentacao.sql:303-304`, e `..._retomada_depois` vem antes de `..._retomada_registrada` ("d" antes de "r"). Com o recuo, o `now()` fica antes de `suspensa_em`, que foi gravado em autocommit na linha 1346. A linha passa a violar as duas, o banco devolve `suspensao_de_funcao_retomada_depois`, e o `toEqual` da 1351 fica vermelho antes de chegar à 1352. Na rodada anterior eu escrevi que a 1351 "não depende da ordem dos instantes", e isso estava errado.
   - **O documento repete o erro:** `tasks/correcoes/2026-11-13-testes-com-relogio.md`, no parágrafo novo da seção "Causa" ("A linha 1351, logo acima, fica como está: … não depende da ordem dos instantes").
   - **Correção exigida:**
     - Trocar a 1351 para `update suspensao_de_funcao set retomada_em = greatest(now(), suspensa_em) where id = $1`. Ela continua violando só `retomada_registrada` (instante preenchido, autor nulo), então continua provando a mesma restrição, agora sem depender do relógio.
     - Corrigir a frase do documento, dizendo por que a linha muda: a ordem alfabética em que o Postgres confere as restrições CHECK.
     - Passar a contagem para seis linhas na seção "Correção" ("Nas cinco linhas" vira seis).

**Recomendações:**
- Na nota "Fora desta correção", vale dizer que um caso de integração que espere a recusa `retomada_registrada` pela rota de produção (`governanca.repository.ts:259`) teria o mesmo problema de ordem alfabética, para quem for mexer no repository.
- Não rodei o teste. Um recuo de relógio não se reproduz dentro de um teste comum, e a evidência que vale aqui é a leitura da ordem das restrições acima, junto com a estabilidade que o documento já registra.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/packages/core/src/db/schema/mvp/mvp-tables.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/tasks/correcoes/2026-11-13-testes-com-relogio.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/packages/core/drizzle/0022_mvp_apresentacao.sql

## test-engineer · 3ª rodada · APROVADO · 2026-11-13 22:15:25 · `tasks/correcoes/2026-11-13-testes-com-relogio.md`

VEREDITO: APROVADO

Cenários exigidos:
- **A correção desta rodada:** a 1351 do `mvp-tables` deve continuar provando a recusa `suspensao_de_funcao_retomada_registrada`, mesmo quando o relógio recua.
- **O texto do documento:** a frase que explica a 1351 precisava ser corrigida, e a contagem de linhas também.
- **O que é novo nesta rodada:** a troca da `suboperador.int.test.ts:581`, a tabela da varredura conferida contra as migrations, e alguma outra gravação de `now()` em outra transação contra coluna com `DEFAULT now()` que tenha ficado fora dos testes.

Cobertos:
- **A correção exigida foi feita.** A `mvp-tables.int.test.ts:1351` agora grava `retomada_em = greatest(now(), suspensa_em)` sem `retomada_por`.
  - A linha passa a violar só `…_retomada_registrada`, porque o `greatest` impede que `…_retomada_depois` falhe.
  - O teste continua provando a regra: sem a checagem `registrada`, o update passaria e o `toEqual` ficaria vermelho.
  - A explicação da seção "Causa" agora fala da ordem alfabética, e há a conferência à parte no Postgres 18.
  - A contagem passou a "sete linhas", com a do `suboperador` somada.
  - Rodei o caso isolado: verde.
- **A troca da `suboperador.int.test.ts:581` está certa.** A linha 579 grava `inicio` pelo default numa transação, e a 581 grava `fim` em outra. O `where chave = $1` só alcança a linha vigente, porque as inserções das linhas 575 e 577 foram recusadas. O que o caso prova continua igual: o índice de chave vigente libera a reinserção depois do fim. Rodei o arquivo inteiro: 17 de 17 verdes.
- **A tabela da varredura bate com as migrations.**
  - Conferi todas as checagens de `packages/core/drizzle/*.sql` que comparam dois instantes da mesma linha: são `suspensao_de_funcao_retomada_depois`, `suboperador_vigencia_ordenada`, `suboperador_escola_vigencia_ordenada`, `tentativa_atividade_envio_depois_do_inicio`, `incidente_conhecido_antes_do_registro`, `arquivo_titular_expira_depois_de_pronto`, e as seis de data ou hora informada.
  - Os gatilhos das migrations 0013, 0022, 0023 e 0032 não comparam instantes.
- **Nenhuma linha de teste ficou de fora.** Procurei atribuições de `now()` às colunas dessas checagens em `apps/`, `packages/`, `e2e/`, `infra/` e `tools/`. O que restou é `expira_em = now() ± intervalo`, sem checagem contra outro instante, e literais dentro de `architecture.test.ts`. Não há `.skip`, mock nem provedor de IA envolvido.

Bloqueantes: nenhum.

Recomendações:
1. **Falta uma quarta rota de produção na lista de rotas expostas.** A `apps/api/src/ops/operacao-privacidade.repository.ts:133` (`encerrarLigacoes`) grava `fim = now()` em `suboperador_escola`. O `inicio` dessas linhas nasce do `defaultNow()` ao cadastrar, em outra transação.
   - Por isso a linha `suboperador_escola_vigencia_ordenada` da tabela, que diz "não", está errada se a coluna conta a exposição pela rota, como as outras linhas da tabela contam.
   - Os casos que cadastram com lista de escolas e depois chamam `encerrar(...)` ficam expostos nesta máquina: `suboperador.int.test.ts` 264, 269, 372, 373, 604 e outros.
   - Um vermelho deles com `suboperador_escola_vigencia_ordenada` é esta mesma causa.
   - Vale acrescentar a rota à lista "Mais duas rotas…", que passaria a ter três, e ajustar a linha da tabela.
2. **"As linhas de teste expostas são sete, em seis arquivos"**, na seção "Causa": são cinco arquivos (`entrega`, `ia`, `atividade`, `mvp-tables` e `suboperador`), como a própria seção "Correção" lista.
3. **Uma checagem que depende do relógio ficou fora da varredura:** `pedido_titular_chegou_em_nao_futura` (`chegou_em <= current_date`, em `0032_pedido_titular.sql:43`). Não compara dois instantes da mesma linha, mas também depende do relógio de parede. Uma nota de uma linha dizendo por que ela não se expõe ao recuo fecharia a varredura.

Arquivos relevantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/tasks/correcoes/2026-11-13-testes-com-relogio.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/packages/core/src/db/schema/mvp/mvp-tables.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/test/suboperador.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/ops/operacao-privacidade.repository.ts`
