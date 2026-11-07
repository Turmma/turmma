# Achados das revisões — `tasks/correcoes/encontro-4-semana.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-06 22:31:50 · `tasks/correcoes/encontro-4-semana.md`

VEREDITO: APROVADO
Tabelas verificadas: nenhuma tabela nova. A correção não traz migration nem schema. A tabela `aula` é da 1.0, e o que a 3.0 e a 4.0 trouxeram já foi auditado na branch de origem de cada uma.
Queries verificadas: nenhuma query nova ou alterada. Comparado com o lado da spec (`git diff MERGE_HEAD`), a correção mexe em quatro arquivos:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/packages/core/src/index.ts`: reúne os exports dos dois lados (`AulaRepository`, `CHAVE_DA_TRAVA_DO_VINCULO_DA_AULA`, `SemanaRepository` e o tipo `ItemDaSemana`). Não sobrou marcador de conflito.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/packages/core/src/semana/index.ts`: o mesmo, juntado sem conflito pelo git.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/apps/api/test/semana-itens.int.test.ts:41`: só troca o nome do parâmetro de tipo de `Linha` para `Tupla`. O tipo e o corpo continuam iguais.
- `TODO.md`: só traz itens da 4.0.

O arquivo `apps/api/src/semana/semana.module.ts`, já unido, liga os dois services com o mesmo `DB`. Nenhum dos dois recebe escopo de fora, e o código das duas tarefas não depende um do outro. Não há `@Unscoped()` em `packages/core/src/semana` nem em `apps/api/src/semana`.
Teste de isolamento: presente e efetivo. A correção não cria escopo novo. Os testes de isolamento da 3.0 (`semana-itens.int.test.ts`) e da 4.0 (`aulas.int.test.ts`) chegaram intactos: o primeiro só teve o parâmetro de tipo renomeado, e nenhuma asserção mudou.
Bloqueantes: nenhum.
Recomendações: nenhuma nova. O item da 3.0 sobre `itensDaSemana` e `consultasDosItens` lerem o `anoLetivoId` do contexto já está no `TODO.md` e continua em aberto.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-06 22:32:00 · `tasks/correcoes/encontro-4-semana.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A correção junta exports no barril e troca o nome de um parâmetro de tipo num teste (`Linha` passou a `Tupla`, sem mudar o tipo nem o corpo). Nenhuma coluna, DTO ou consulta foi criada ou alterada.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok. A correção não muda nenhuma rota. O `GET /v1/semana` com os itens (3.0) e o `PUT /v1/aulas` (4.0) chegam iguais aos lados que já foram aprovados. Conferi assim:
- `git diff MERGE_HEAD` só mostra os arquivos da 4.0, mais o barril, o teste e os documentos.
- `git diff HEAD` só mostra os da 3.0.
- `semana.repository.ts`, `montar-dias.ts`, `aula.repository.ts` e `aulas.service.ts` não divergem dos dois lados.

Logs: limpos. A correção não acrescenta nenhuma chamada de log.

Auditoria: não se aplica. A correção não cria leitura por coordenação ou rede, exportação, nota, permissão nem aprovação de IA.

Envio externo: nenhum.

Seed/fixture: sintético. O único arquivo de teste tocado é `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/apps/api/test/semana-itens.int.test.ts`, e só na linha 41, para renomear o parâmetro de tipo do `sql`. Nenhum dado mudou.

O que conferi:
- **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/packages/core/src/index.ts:358-359`:** une os dois lados sem perder nada. A linha de valores tem `AulaRepository, CHAVE_DA_TRAVA_DO_VINCULO_DA_AULA, SemanaRepository` e a de tipos tem `ItemDaSemana`. Não voltou nenhum export que a 4.0 tinha tirado; `ESPERA_MAXIMA_DA_GRAVACAO_MS` segue fora.
- **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/packages/core/src/semana/index.ts`:** também tem os exports dos dois lados.
- **Arquivos em conflito:** não sobrou nenhum, e não há marcador `<<<<<<<`, `=======` ou `>>>>>>>` na árvore. A busca com `git grep` voltou vazia, e `git diff --cached --diff-filter=U` também.
- **Documentos de `tasks/` e o `TODO.md`:** são a união dos dois lados. Nos trechos que vieram da 4.0, as recomendações dos guardiões da 4.0 (privacy, infra, revisor-geral, test-engineer) estão preservadas.

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/TODO.md:2820-2821`: na resolução faltou a linha em branco entre o último item da seção da 4.0 e o título `## Da semana-do-professor, tarefa 3.0 (os itens do dia), fora dela`. É só formatação: inserir uma linha vazia antes do título.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-06 22:32:01 · `tasks/correcoes/encontro-4-semana.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta correção. O merge junta a 3.0 (a leitura dos itens do dia, que não escreve nada) e a 4.0 (`PUT /v1/aulas`, que grava o texto da aula escrito pela professora, não `Nota`). Todos com autor humano? sim, porque não há escrita em `Nota`.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. Nada novo de IA chega ao aluno. A 3.0 só lê o estado da correção do Assistente (pendente ou aprovada) e não mostra nota, acerto, nome de aluno nem autor (`packages/core/src/semana/semana.repository.ts:63`).
Supervisão do tutor: ok. A correção não toca o tutor.
Autonomia declarada e visível: sim. A correção não muda a governança dos agentes.

O que a correção entrega de fato:
- **Barril do `core`:** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/packages/core/src/index.ts:358-359` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/packages/core/src/semana/index.ts` ficaram com os exports das duas tarefas: valores `AulaRepository`, `CHAVE_DA_TRAVA_DO_VINCULO_DA_AULA` e `SemanaRepository`, mais o tipo `ItemDaSemana`. Não sobrou nenhum marcador de conflito nos três arquivos.
- **Teste da 3.0:** em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/apps/api/test/semana-itens.int.test.ts:41` só o nome do parâmetro de tipo mudou, de `Linha` para `Tupla`. As asserções da 3.0 sobre a regra 70 continuam as mesmas.
- **`TODO.md`:** recebe as pendências da 3.0 e da 4.0 como texto. Entre elas está a da 3.0 para o `conformidade-reviewer`: se outra função de `entrega` (a devolutiva de discursiva, D46) entrar na Semana, o filtro por `entrega.tipo` precisa de teste próprio. Ela continua anotada para a tarefa que trouxer isso.

Nenhum dos nove pontos da regra 70 (nota de discursiva e redação, vigilância, inferência emocional, métrica ou conversa do professor) aparece nos arquivos que divergem.

Bloqueantes: nenhum

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/apps/api/src/semana/semana.module.ts:14`: o comentário ainda diz "os itens do dia entram na 3.0". Depois do merge eles já entraram. Corrigir na próxima tarefa que tocar o módulo.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/TODO.md`: falta uma linha em branco antes do cabeçalho `## Da semana-do-professor, tarefa 3.0 (os itens do dia), fora dela`. O último item da 4.0 termina colado nele.

## test-engineer · 1ª rodada · APROVADO · 2026-11-06 22:33:48 · `tasks/correcoes/encontro-4-semana.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- **O conflito do barril:** a resolução tem que manter os exports dos dois lados, sem tirar nem renomear nenhum, e não pode sobrar marcador no índice.
- **O resto da 3.0:** o `Linha` em `apps/api/test/semana-itens.int.test.ts:41` deixa de acusar no `restos`, e o teste continua provando o mesmo.
- **As duas tarefas juntas:** o código da 3.0 (itens do dia) e o da 4.0 (`PUT /v1/aulas`) têm que passar nos testes de cada uma sobre a árvore que o merge deixou.
- **Mutação:** não se exige nenhuma, porque a correção não escreve cláusula nova.

**Cobertos:**
- **Barril:** em relação à spec (`git diff MERGE_HEAD`), entram só `AulaRepository` e `CHAVE_DA_TRAVA_DO_VINCULO_DA_AULA` em `packages/core/src/index.ts:358` e em `packages/core/src/semana/index.ts:1`. Em relação à linha (`git diff HEAD`), entra só o tipo `ItemDaSemana`. A união está completa e nada saiu. O `git grep` de marcadores no índice não achou nenhum.
- **Resto:** a troca para `Tupla` mexe só no nome do parâmetro de tipo: a declaração e os dois usos, na mesma linha. Tipo e corpo não mudam. Rodei `npx vitest run tools/renomear/restos.test.ts`: 43 de 43 passaram.
- **As duas tarefas juntas:** rodei os dois testes de integração sobre a árvore do merge.
  - `apps/api/test/semana-itens.int.test.ts`: 15 de 15 passaram. O teste da 3.0 segue verde depois da troca do nome.
  - `apps/api/test/aulas.int.test.ts`: 39 de 39 passaram. A gravação da 4.0 funciona junto com o `semana.service.ts` e o `montar-dias.ts` que a 3.0 mudou.
- **Mutação:** a seção "Sem mutação" está correta. O `git diff MERGE_HEAD` confirma que nenhum arquivo de código ganhou condição, filtro ou escopo. O que a correção mudou são duas linhas de export e o nome de um parâmetro de tipo.
- **`.skip` e mocks:** o diff não acrescenta `.skip`, teste comentado nem mock.

Bloqueantes: nenhum

Recomendações (nenhuma bloqueia):
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/TODO.md:2821`: o título "## Da semana-do-professor, tarefa 3.0 (os itens do dia), fora dela" vem colado ao último item da seção da 4.0 (linha 2820), sem linha em branco antes. As outras seções do arquivo têm essa linha.
2. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/tasks/prd-semana-do-professor/achados/indice.md`: as oito linhas da `3_task` (20:42 a 21:19) ficaram depois das da `4_task` (21:12 a 21:56), e a tabela perde a ordem do tempo. Vale intercalar as linhas por data.
3. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/tasks/prd-semana-do-professor/tasks.md`: a 3.0 está marcada `[x]`, mas as subtarefas 3.1 e 3.2 seguem `[ ]`, enquanto as da 4.0 estão marcadas. Isso veio da spec e não desta correção, mas o merge é um bom momento para alinhar.
