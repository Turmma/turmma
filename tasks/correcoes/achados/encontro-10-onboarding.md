# Achados das revisões — `tasks/correcoes/encontro-10-onboarding.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-04 10:02:59 · `tasks/correcoes/encontro-10-onboarding.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. O merge mexe só no motor de importação (planilhas de alunos e de grade), na lista, no vínculo, na alocação e na leitura do titular. Nenhum arquivo do merge escreve em `Nota`, `Correcao` ou `lancadaPor`. Todos com autor humano? sim, porque não há nenhum. O que a importação grava (nome na lista, linha `aprovado` da virada, vínculo, aula) tem como autora a coordenação que gravou a planilha, via `requestIdentity()` (`packages/core/src/importacao/importacao.repository.ts:427-432`).

Decisão autônoma sobre aluno: ausente. O desligamento pela planilha só alcança quem a coordenação marcou: `aDesligarAgora = desligamentosDe(classificacao.candidatos, marcas)` em `packages/core/src/importacao/tipos/alunos.ts:539`. Uma marca sem candidato é tratada como diferença e para a gravação antes de qualquer escrita. A volta na virada (`volta`, `inserirAprovados`) acontece porque a coordenação pôs o aluno numa planilha do ano planejado. Não há promoção nem retenção inferida, e não há IA nesse caminho.

Aprovação registrada: ok. O merge não traz nenhuma saída de IA que chegue ao aluno, e nada que estenda a exceção do Tutor (D47) a outro agente.

Supervisão do tutor: ok. O Tutor não foi tocado. `packages/core/src/titular/leitura-do-titular.ts` só acrescenta categorias ao arquivo do titular, que é a pessoa olhando os próprios dados, não acesso da coordenação.

Autonomia declarada e visível: sim, sem mudança. Nenhum agente foi criado nem alterado.

**O que conferi na resolução do merge, contra a seção "Correção" do documento**
- `packages/core/src/importacao/tipo.ts:87`: o `travar` recebe os dois parâmetros, `passo3` e `tx`, e o `planejar` recebe `contas?`.
- `packages/core/src/importacao/motor.ts:282-283`: a chamada passa `{ contas, travarContas }` e `tx`, e o `planejar` recebe `contas`.
- `packages/core/src/importacao/tipos/alunos.ts:500-516` e `:540`: `criarTurmasNovas` foi extraída sem mudar o comportamento. O `aplicar` (`{ tx, ciclo }`) passa a chamá-la e continua com `desligamentosDe`, `desligar`, `voltasDe` e `voltar`. Ela segue gravando a auditoria `turma.criada`.
- `packages/core/src/importacao/importacao.repository.ts:18-19`: os dois `import` estão juntos.
- `packages/core/src/importacao/tipos/grade.test.ts`: `Banco` virou `Dados`, as quatro chamadas de `travar` levam `TX`, e o resto do teste não mudou.
- Não sobrou marcador de conflito em `packages/`, `apps/` nem `docs/`.
- Os itens 7, 8 e 9 da regra 70 (supervisão sem vigilância, sem ranking de professor, recusa sem indicador) não são afetados. Nenhuma métrica de professor, inferência sobre aluno ou indicador de adoção entra pelo merge. A grade só cria vínculo e aula a partir do que a coordenação escreveu na planilha.

Não rodei testes nem a checagem de tipos: isso fica com o portão da tarefa.

Bloqueantes: nenhum.

Recomendações: nenhuma nova da regra 70. As do documento da correção (o `_tx` em `packages/core/src/importacao/tipos/grade.ts:518`, o objeto de opções do `travar`, a variável local `banco` no teste) são de legibilidade, e o destino que o documento deu a elas está bom.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/correcoes/encontro-10-onboarding.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipo.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/motor.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipos/alunos.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/importacao.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipos/grade.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/auditoria/acoes.ts

## revisor-geral · 1ª rodada · APROVADO · 2026-11-04 10:03:01 · `tasks/correcoes/encontro-10-onboarding.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok

Portão local: carimbo válido. O `conferir` responde "portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)".

Bloqueantes: nenhum.

O que conferi:
- Não sobrou marcador de conflito, e o `git ls-files -u` sai vazio.
- **`tipo.ts:87`**: a assinatura é `travar?(repositorio, ano, guardado, marcas, passo3: ContasDoPasso3, tx: DatabaseTransaction)`. O `planejar` ficou com `contas?`, como a 11.0 deixou.
- **`motor.ts:282-283`**: o `travar` recebe o `passo3` e o `tx`, e o `planejar` recebe as `contas`.
- **`tipos/alunos.ts`**:
  - o `travar(…, _passo3, tx)` está na linha 603;
  - `desligamentosDe`, `desligar`, `voltasDe` e `voltar` da 10.0 continuam;
  - o `criarTurmasNovas` da 11.0 é exportado, e o `aplicar({ tx, ciclo })` o chama no lugar do laço.
- **`importacao.repository.ts:18-19`**: os dois `import` estão juntos, o `DisciplinaRepository` e os tipos `AlunoDaVirada` e `RetiradaDeNome`.
- **`grade.test.ts`**:
  - `Banco` virou `Dados`, e `Banco` não aparece mais como símbolo em `packages/core/src/importacao/`;
  - as quatro chamadas de `tipoGrade.travar` passam o `TX` (linhas 350, 367, 370 e 378).
- **Chamadas de `travar`**: só existem a do motor e as do `grade.test.ts`. O `alunos.test.ts` não chama o `travar`, então nenhuma chamada ficou na aridade antiga.
- **Arquivos que juntaram sozinhos**: o `lgpd.md` tem a linha da 10.0 e a linha da `alocacao` da 11.0. O `contratos.ts` tem o `volta` da 10.0 e o `TAMANHO_MAXIMO_DA_SALA_DA_AULA` da 11.0. Em `tasks.md`, a 10.0 e a 11.0 estão marcadas.
- **Fora do que a correção lista**: nada. O `grade.ts` chega como a 11.0 o deixou.

Recomendações (nenhuma bloqueia):
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipo.ts:89` usa dois parâmetros posicionais que cada tipo usa só pela metade (a grade ignora o `tx`, a planilha de alunos ignora o `passo3`). A próxima tarefa que mexer no `travar` vai cair no mesmo conflito. Um objeto de opções `{ passo3, tx }` evita isso. A sugestão já está registrada para a retro, e eu a reforço.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipo.ts:81` tem um comentário de JSDoc numa linha muito longa, que destoa das vizinhas.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-04 10:03:04 · `tasks/correcoes/encontro-10-onboarding.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma nesta correção. A resolução do merge não traz migration nem schema. As tabelas da 11.0 (alocação e vínculo de `origem = grade`) chegam do lado da spec sem alteração.

Queries verificadas: só os pontos de conflito, e cada um junta os dois lados sem cláusula nova.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/importacao.repository.ts`: os dois `import` estão juntos (`DisciplinaRepository`, mais `AlunoDaVirada` e `RetiradaDeNome`). Os métodos dos dois lados (`alunosDaVirada`, `retirarNomes`, `inserirAprovados`, `travarConviteDaEscola`, `disciplinasDaEscola`, `criarDisciplina`, `vinculosDeProfessorDoAno`, `criarVinculosDeProfessorDaGrade`, `aulasDoAno`, `gravarAulas`) continuam com `requireEscolaId()` e com o escopo do contexto. Nenhum deles recebe `escolaId` por parâmetro.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/motor.ts:282`: `tipo.travar?.(…, { contas, travarContas }, tx)` e `tipo.planejar(…, contas)`, como o documento pede.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipo.ts:88`: `travar` recebe `passo3` e `tx`, e `planejar` recebe `contas?`.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipos/alunos.ts`: o `travar(…, _passo3, tx)` mantém o `CicloDeVidaRepository(tx)` da 10.0. O `aplicar` (`{ tx, ciclo }`) chama `criarTurmasNovas` da 11.0 no lugar do laço, e o corpo é idêntico ao laço que saiu. `desligamentosDe`, `desligar`, `voltasDe` e `voltar` estão presentes.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipos/grade.ts:518`: o `travar` da grade não declara o 6º parâmetro, e o TypeScript aceita isso. A grade não usa `tx`, então o escopo não muda.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipos/grade.test.ts`: `Banco` virou `Dados` e não sobrou nenhuma ocorrência do símbolo. As quatro chamadas de `travar` recebem `TX`.

Confirmei que a árvore não tem marcador de conflito em `packages/` nem em `apps/`, e o `tsc --noEmit -p packages/core` passa sem erro. Não rodei nenhum teste.

Teste de isolamento: presente e efetivo. É o das tarefas 10.0 (`apps/worker/test/desligamento-pela-planilha.int.test.ts`) e 11.0 (`apps/worker/test/gravar-planilha-grade.int.test.ts`), que entram sem mudança. A correção não acrescenta nem remove cláusula de escopo, então não existe cláusula nova que um teste novo tivesse de provar.

Bloqueantes: nenhum.

Recomendações: nenhuma além das que o documento já registra em "Recomendações sem aplicar".

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-04 10:03:44 · `tasks/correcoes/encontro-10-onboarding.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo. O merge junta dois campos que já estavam na tabela de dados, um de cada tarefa. Da 10.0 vem a linha "Lista de nomes da turma": a retirada do nome ainda não aprovado, com a auditoria `lista_nome.retirado` guardando só id, turma e estado, e a linha `aprovado` da virada do ano, sem nome nem matrícula. Da 11.0 vem a linha "Aula da grade" (`alocacao`), que agora entra no arquivo do titular pelo `vinculo_id`.

Fora da tabela de dados do docs/lgpd.md: nada. Comparei a árvore com os dois lados. Contra o HEAD, `docs/lgpd.md` só muda na linha da aula da grade; contra o MERGE_HEAD, só na linha da lista de nomes. Os dois textos ficaram, e nada se perdeu na junção.

Autorização por objeto: ok. A resolução não cria rota nem consulta nova. As consultas novas da 10.0 (`alunosDaVirada`, `retirarNomes`, `inserirAprovados`) chegam do lado já revisado e mantêm `requireEscolaId()`.

Logs: limpos. Não há `logger` nem `console` em `motor.ts`, `tipos/alunos.ts` nem `tipos/grade.ts`.

Auditoria: presente.
- `turma.criada` segue gravada dentro de `criarTurmasNovas` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipos/alunos.ts:504`). A função é o mesmo laço que estava no `aplicar`, só extraído, e é usada pela planilha de alunos e pela grade.
- `acoes.ts` da 10.0 ficou na árvore sem mudança.

Envio externo: nenhum.

Seed/fixture: sintético. `grade.test.ts` usa `ana@escola.invalid` e nomes genéricos. A troca de `Banco` por `Dados` e a `TX` falsa só mexem no tipo e no parâmetro.

Conferi a resolução contra o que o documento da correção pede, e bate:
- `tipo.ts`: `travar?(…, passo3: ContasDoPasso3, tx: DatabaseTransaction)`, e `planejar` com `contas?`.
- `motor.ts`: chama `travar` com `{ contas, travarContas }` e com `tx`; `planejar` recebe `contas`. A trava do convite da 11.0 e o `passo1` com `emailsDasContas` ficaram.
- `tipos/alunos.ts`: `travar(…, _passo3, tx)`. Ficaram `desligar` e `voltar` da 10.0, e o `aplicar` (`{ tx, ciclo }`) chama `criarTurmasNovas`.
- `importacao.repository.ts`: os dois `import` estão juntos.
- `classificacao.ts`: `alocacao` com `arquivo: { entra: true, ligacao: ['vinculo_id'] }`, como na 11.0. Com isso a pergunta de fechamento continua respondida para a aula da grade.
- Não há marcador de conflito em `packages`, `apps`, `docs` nem `tools`. `Banco` não aparece mais em `grade.test.ts`.

Verificação que rodei na árvore do merge:
- `npx vitest run` em `tools/renomear/restos.test.ts`, `grade.test.ts`, `alunos.test.ts`, `leitura-do-titular.test.ts` e `packages/shared/src/privacidade`: 7 arquivos, 137 testes, todos verdes.
- `tsc --noEmit -p packages/core`: sem erro.

Não rodei as integrações do worker; o portão da tarefa fica com elas.

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipos/grade.ts:518`: o `travar` da grade não declara o `_tx`. Funciona, porque o TypeScript aceita menos parâmetros, mas fica assimétrico com `alunos.ts`. O documento já registra a recusa disso nesta correção, e eu concordo que pode ficar para uma limpeza própria da 11.0.
- Os parâmetros posicionais `passo3` e `tx` do `travar` poderiam virar um objeto de opções. Já está encaminhado para a retro.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-04 10:04:20 · `tasks/correcoes/encontro-10-onboarding.md`

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
Recomendações: nenhuma além das que o documento da correção já registra

O que conferi:

- **Correções pedidas.** Cada item da seção "Correção" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/correcoes/encontro-10-onboarding.md` está na árvore do merge:
  - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipo.ts:87`: o `travar` recebe `passo3` e também `tx`.
  - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/motor.ts:282`: o motor passa os dois.
  - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipos/alunos.ts:603`: o `travar` dos alunos fica `_passo3, tx`, e o `aplicar` chama `criarTurmasNovas`.
  - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/importacao.repository.ts`: os dois `import` estão juntos.
  - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipos/grade.test.ts`: o tipo `Banco` virou `Dados`, e as quatro chamadas passam `TX`.
- **Estado do merge.** Nenhum marcador de conflito em `apps/` nem em `packages/`, e nenhum arquivo ficou sem juntar no índice.
- **Ordem das travas.** A grade trava, em ordem, o convite da escola, o ano, os usuários, as contas e as turmas. Os alunos travam o ano, os anos dos vínculos de quem vai desligar (pela `tx`), os usuários, as turmas e os pedidos. As duas ordens seguem a ordem global da Tech Spec, seção 5. Os dois jobs também não rodam juntos na mesma escola, porque só pode haver uma importação `na_fila` por escola (o único parcial `escolaId` onde `na_fila`). Por isso não há risco de deadlock entre grade e alunos.
- **Migration.** Nenhum dos dois lados traz migration nova no merge.
- **Execução.** `tsc --noEmit` passou sem erro em `packages/core`, `apps/worker` e `apps/api`. Rodando da raiz, `vitest run packages/core/src/importacao tools/renomear/restos.test.ts` deu 7 arquivos e 137 testes verdes. Não rodei as integrações do worker; essa prova continua com o portão da tarefa.

## test-engineer · 1ª rodada · APROVADO · 2026-11-04 10:07:21 · `tasks/correcoes/encontro-10-onboarding.md`

VEREDITO: APROVADO

Cenários exigidos: esta correção só junta código, e o documento a justifica assim. A 10.0 e a 11.0 escreveram e testaram cada uma os seus cenários, e não há cláusula nova. Por isso cobrei o que uma junção precisa provar:
- a árvore fica sem marcador de conflito e passa na checagem de tipos;
- o `travar` passa a receber os dois parâmetros, o `passo3` da 11.0 e o `tx` da 10.0, cada um na posição certa;
- o `motor.ts` repassa a `tx` de fato ao `travar` da planilha de alunos, para travar os anos dos vínculos de quem vai desligar;
- o `aplicar` de `tipos/alunos.ts` chama `criarTurmasNovas` no lugar do laço e faz a mesma coisa, na mesma ordem;
- os testes dos dois lados continuam verdes;
- a guarda de nomes antigos (`restos.test.ts`) não acha mais o símbolo `Banco` em `grade.test.ts`.

Cobertos:
- **Sem marcador:** `grep` não achou nenhum em `packages/core/src/importacao`, `packages/shared/src`, `docs/lgpd.md`, `apps/worker/test` e `apps/api/test`.
- **Tipos:** `npm run typecheck` passa em `@educa/core` e em `@educa/worker`. A assinatura nova está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipo.ts:87`. Se um parâmetro estivesse no lugar errado, a checagem de tipos falharia.
- **A `tx` chega ao `travar` da planilha de alunos:** a chamada está em `packages/core/src/importacao/motor.ts:282`. Em `packages/core/src/importacao/tipos/alunos.ts:603`, o `travar` usa essa `tx` para travar os anos dos vínculos de quem vai desligar. Se a `tx` chegasse vazia, o `desligamento-pela-planilha.int.test.ts` quebraria, e ele passou.
- **`criarTurmasNovas`:** fiz a comparação com o `git diff --cached HEAD`. O corpo da função é o laço antigo, linha por linha, e continua depois de `desligamentosDe`.
- **Os dois lados juntos:** nos arquivos que os dois lados mexeram (`importacao.repository.ts`, `contratos.ts` e `docs/lgpd.md`) ficaram as mudanças das duas tarefas. Do lado da 10.0, os imports de `AlunoDaVirada` e `RetiradaDeNome`, o `alunosDaVirada`, o resultado `volta` e a linha do mapa de dados sobre a planilha de alunos. Do lado da 11.0, `DisciplinaRepository`, `AlocacaoRepository`, `TAMANHO_MAXIMO_DA_SALA_DA_AULA` e a aula da grade no arquivo do titular.
- **Testes, todos rodados a partir da raiz:**

| O que rodei | Arquivos | Casos | Resultado |
|---|---|---|---|
| `packages/core/src/importacao/` | 6 | 94 | verdes |
| `grade.test.ts`, `alunos.test.ts` e `tools/renomear/restos.test.ts` | 3 | 101 | verdes; o caso "a árvore não tem resto dos mapas aplicados" passou |
| `gravar-planilha-grade.int.test.ts` e `desligamento-pela-planilha.int.test.ts` juntos | 2 | 59 | verdes (era a recomendação do tenancy-guardian) |
| `apps/worker/test/` inteiro, `apps/api/test/importacao.int.test.ts`, `apps/api/test/arquivo-do-titular.int.test.ts` e `packages/core/src/titular/` | 26 | 556 | verdes |

- **A transação falsa:** o `TX` de `grade.test.ts:19` é `{}`. Ele não esconde regra nenhuma, porque o `travar` da grade não usa a `tx`. As asserções sobre a ordem das travas (`usuarios`, depois `contas`, depois `turmas`) e sobre a `ContaDaPlanilhaPerdidaError` continuam iguais.
- **O resto:** não há `.skip`, teste comentado nem chamada a provedor de IA. A concorrência não muda nesta correção: ela não toca a ordem das travas, e as integrações de corrida das duas tarefas passaram.

Bloqueantes: nenhum.

Recomendações:
- Nenhum teste de unidade prova que o `motor` põe a `tx` na 6ª posição do `travar`. Hoje isso fica provado só pela integração de desligamento. Para a retro: um teste de unidade do `planejarSobTrava` com um tipo falso, conferindo que o `travar` recebe o `passo3` e a mesma `tx`, mostraria uma troca de posição sem precisar subir o banco.
- As recomendações que o documento registra como recusadas ou mandadas para a retro continuam valendo e não bloqueiam: o `_tx` no `travar` da grade, o objeto de opções no `travar` e as variáveis locais `banco` em `grade.test.ts`.
