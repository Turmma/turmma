# Achados das revisões — `tasks/correcoes/2026-11-06-escopo-de-escola-da-grade.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-06 06:09:18 · `tasks/correcoes/2026-11-06-escopo-de-escola-da-grade.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A correção só mexe em teste (4 linhas a mais em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/api/test/grade.int.test.ts:616-621`), e o repository em questão (`packages/core/src/importacao/grade.repository.ts`) só lê as aulas da grade da turma. Ele não toca em `Nota`. Todos com autor humano? Não se aplica, porque o diff não tem caminho de escrita em `Nota`.
Decisão autônoma sobre aluno: ausente.
Aprovação registrada: ok. O diff não tem nenhuma saída de IA.
Supervisão do tutor: ok. O diff não toca no tutor.
Autonomia declarada e visível: sim. O diff não toca em agente nem na governança.
Bloqueantes: nenhum.
Recomendações: nenhuma da regra 70. Para registro: o caso novo lê o ano e a turma da escola B com o contexto da A. É a leitura que deixa só o `escolaId` separando as duas escolas, então a mutação da validação passa a ser apanhada. Isso é coisa da regra 10, e quem confere se o teste é efetivo é o `tenancy-guardian`. Ninguém mexeu em `docs/regulacao.md`, e a tarefa não trouxe fotos da tela.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-06 06:09:22 · `tasks/correcoes/2026-11-06-escopo-de-escola-da-grade.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/api/test/grade.int.test.ts:616-617`: o comentário do porquê fica sobre a asserção de `turmaExiste`, mas a mutação que ele explica é a de `aulasDaTurma`, duas linhas abaixo (`:621`). Você pode juntar as duas asserções com o ano e a turma da B, uma ao lado da outra, logo abaixo do comentário. Fica mais fácil achar o caso que pega a mutação.
- `turmaExiste` já filtrava pela escola. A nova asserção dela (`:618`) também protege essa cláusula, mas o bloco `mutacao` do documento só declara a de `aulasDaTurma`. Se o portão aceitar mais de uma mutação, declare também a de `grade.repository.ts:27`. É cobertura extra, não bloqueia.

O que conferi:
- O diff segue a correção pedida em `tasks/prd-onboarding-por-convite/validacao.md` (crítico 2, linhas 90-96). Ficam no mesmo caso as leituras no contexto da A com o ano e a turma da B: `aulasDaTurma(outra.e.emCurso, outra.t8a)` esperando `[]` e `turmaExiste(...)` esperando `false`. As asserções que já existiam continuam lá.
- Nenhum código de produção mudou. O bloco `mutacao` do documento bate, linha por linha, com `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/importacao/grade.repository.ts:54`.
- A leitura usa `bancoDoJob` dentro de `runInContext` com a escola A. Assim o escopo só vem do `requireEscolaId()` do repository. Sem a cláusula de escola, só os filtros de ano e turma sobram, e com o ano e a turma da B as aulas da B passariam. Então a asserção nova pega a mutação, como a regra 10, item 5, pede.
- O documento mantém fora o crítico 1 e o item menor de `motor.ts`, como o pedido manda. Não há `.skip`, `any` nem `TODO` no diff.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-06 06:09:23 · `tasks/correcoes/2026-11-06-escopo-de-escola-da-grade.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum novo. O diff só acrescenta duas asserções em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/api/test/grade.int.test.ts` (linhas 616-618 e 621). `GradeRepository.aulasDaTurma` continua devolvendo `professor.nome` e `professor.usuarioId`, mas isso já existia e não mudou. O repository não lê e-mail, e a saída é montada campo a campo (`grade.repository.ts:40-56`).

Fora da tabela de dados do docs/lgpd.md: nada. A correção não traz migration nem campo novo.

Autorização por objeto: ok. A correção reforça exatamente esse ponto. A asserção nova, `aulasDaTurma(outra.e.emCurso, outra.t8a)` lida no contexto da escola A, é a única leitura em que só o `escolaId` do contexto separa as duas escolas. Por isso, se a cláusula `eq(alocacao.escolaId, escolaId)` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/importacao/grade.repository.ts:54` for removida, o teste quebra (regra 10, item 5). A mesma checagem foi feita em `turmaExiste`. O resultado para objeto de outra escola é `[]` ou `false`, igual ao de objeto inexistente, então não confirma que o registro existe.

Logs: limpos. O diff não tem log.

Auditoria: não se aplica. O diff não tem leitura por coordenação, exportação, nota, permissão nem saída de IA.

Envio externo: nenhum.

Seed/fixture: sintético. As escolas e a professora (`escolaComGradeImportada`, `ana`) são criadas pelo próprio teste, e o diff não acrescenta dado de pessoa.

Pergunta de fechamento: a correção não muda o que o sistema guarda sobre um aluno nem para onde o envia, então não piora a resposta. Não reavaliei o restante da spec.

Bloqueantes: nenhum.

Recomendações:
- Uma mutação extra para `turmaExiste`. A asserção nova em `grade.int.test.ts:618` também é a única que pega a remoção de `eq(turma.escolaId, requireEscolaId())` em `grade.repository.ts:27`, mas o documento só declara a mutação de `aulasDaTurma`. Um segundo bloco ` ```mutacao ` para a linha 27 faria o portão repetir também essa prova.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-06 06:09:23 · `tasks/correcoes/2026-11-06-escopo-de-escola-da-grade.md`

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
Recomendações:
- A asserção nova de `turmaExiste(outra.e.emCurso, outra.t8a)` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/api/test/grade.int.test.ts:618` também é a única que prova a cláusula `eq(turma.escolaId, requireEscolaId())` de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/importacao/grade.repository.ts:27`. O documento da correção não declara essa mutação. Vale acrescentar um segundo bloco ` ```mutacao ` para que o portão confirme que ela fica vermelha, como já faz com a mutação da `:54`.
- Tirei a conclusão sobre a mutação da `:54` lendo o código: com o contexto da A e o ano e a turma da B, sem a cláusula de escola, os `innerJoin` casam dentro da escola da B e devolvem as aulas. Não rodei o teste nem a mutação. O registro de vermelho com a cláusula tirada e verde com ela no lugar está no documento da correção, e o portão repete essa mutação pelo bloco declarado.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-06 06:09:25 · `tasks/correcoes/2026-11-06-escopo-de-escola-da-grade.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nem migration. As tabelas lidas no caso são `alocacao`, `vinculo`, `usuario` e `turma`, todas com `escolaId` e `anoLetivoId` onde o dado varia por período.

Queries verificadas:
- `GradeRepository.turmaExiste` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/importacao/grade.repository.ts:27`): o escopo vem de `requireEscolaId()`, isto é, do contexto.
- `GradeRepository.aulasDaTurma` (`grade.repository.ts:54`): o escopo vem de `requireEscolaId()`. Os joins casam `vinculo` e `usuario` com a escola da própria `alocacao`.
- O diff não muda código de produção.

Teste de isolamento: presente e efetivo.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/api/test/grade.int.test.ts:621` lê, no contexto da escola A, o ano e a turma da B. Se a cláusula `eq(alocacao.escolaId, escolaId)` de `grade.repository.ts:54` sai, sobram o filtro de ano, o de turma e o de estado. Todos casam com as aulas da 8ºA da B, que a `escolaComGradeImportada` cria com vínculo aberto. Os joins não as cortam. O retorno deixa de ser `[]` e o caso quebra.
- `grade.int.test.ts:618` faz a mesma prova para a cláusula `eq(turma.escolaId, ...)` de `turmaExiste` (`grade.repository.ts:27`).
- O bloco ` ```mutacao ` do documento confere com o código. A linha `-` é idêntica a `grade.repository.ts:54`, e o trecho de `falha:` aparece literalmente na linha 621 do teste.
- Não rodei a mutação. A conclusão acima vem da leitura do código, e o portão vai aplicá-la.

Bloqueantes: nenhum.

Recomendações:
- Declarar uma segunda mutação no documento `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/tasks/correcoes/2026-11-06-escopo-de-escola-da-grade.md`, tirando `eq(turma.escolaId, requireEscolaId())` de `grade.repository.ts:27`, com falha esperada em `grade.int.test.ts:618`. Hoje só a cláusula de `aulasDaTurma` passa pelo portão, embora o caso novo também mate a de `turmaExiste`.
- `professorTemVinculoConfirmadoNaTurma` (`grade.repository.ts:63`) não foi tocado e não faz parte desta correção. Vale conferir se ele tem um caso com o ano e a turma de outra escola no mesmo formato, porque o filtro de ano pode esconder a falta do de escola lá também.

## test-engineer · 1ª rodada · APROVADO · 2026-11-06 06:09:45 · `tasks/correcoes/2026-11-06-escopo-de-escola-da-grade.md`

VEREDITO: APROVADO

**Cenários exigidos:** esta correção trata só do crítico 2 da validação: o escopo de escola de `GradeRepository.aulasDaTurma` (regra 10, item 5). O cenário que prova a regra é ler a turma da escola B, com o ano letivo da B, numa sessão da escola A. Só nessa leitura a cláusula `eq(alocacao.escolaId, escolaId)` é o que separa as duas escolas. Nas outras, o filtro de ano e os `innerJoin` com `vinculo` e `usuario` já escondem a aula da B, porque esses joins casam dentro da escola da própria aula.

**Cobertos:**
- A falha está bem diagnosticada. O caso antigo lia `aulasDaTurma(e.emCurso, outra.t8a)`, com o ano da A. Ali o filtro de ano já escondia a aula da B, e a mutação 1 da validação sobrevivia.
- A linha nova `apps/api/test/grade.int.test.ts:621` lê `aulasDaTurma(outra.e.emCurso, outra.t8a)` e exige `[]`. Conferi contra `packages/core/src/importacao/grade.repository.ts:54`: sem a cláusula de escola, o ano e a turma da B passam no filtro, os joins ficam todos dentro da escola B e voltam as aulas da 8º A da B. O teste falha nessa asserção, e falha pelo motivo certo.
- `bancoDoJob` (linha 77) é um pool direto, que não depende do papel da API nem de outro filtro. Então o escopo vem só do `runInContext` e da cláusula do repository. Nenhum mock esconde a regra.
- O bloco ```` ```mutacao ```` está correto:
  - a linha `-` é igual à linha 54 do repository, inclusive no recuo;
  - o texto em `falha:` aparece só na linha 621 (a 622 lê `e.emCurso`, não `outra.e.emCurso`);
  - nenhum código de produção muda, então `--faltando: 0` está coerente.
- As asserções antigas continuam no caso: ano da A com turma da B, e ano planejado.
- Rodei `npx vitest run apps/api/test/grade.int.test.ts -t "a leitura da grade só alcança"` e o caso passou. Não rodei a mutação: ela fica com o portão, como o documento declara.
- Não há `.skip`, teste comentado, IA nem concorrência envolvidos.

**Bloqueantes:** nenhum.

**Recomendações:**
1. A linha nova `apps/api/test/grade.int.test.ts:618`, `turmaExiste(outra.e.emCurso, outra.t8a)` com `false`, também passa a ser a única prova de `eq(turma.escolaId, requireEscolaId())` em `grade.repository.ts:27`. Essa cláusula tinha o mesmo problema: com o ano da A, o filtro de ano já escondia a turma da B. Vale declarar um segundo bloco ```` ```mutacao ```` no documento, tirando essa cláusula e com `falha:` apontando para a linha 618. Assim o portão também prova esse escopo, e a validação não precisa redescobri-lo.
2. O comentário das linhas 616 e 617 diz "a única leitura em que só o `escolaId` do contexto separa as duas". Isso vale para `aulasDaTurma`. Para `turmaExiste`, o motivo é o mesmo, mas está implícito. Uma frase deixando claro que vale para os dois métodos ajudaria quem ler depois.

Arquivos:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/api/test/grade.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/importacao/grade.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/tasks/correcoes/2026-11-06-escopo-de-escola-da-grade.md`

## revisor-geral · 2ª rodada · APROVADO · 2026-11-06 06:16:25 · `tasks/correcoes/2026-11-06-escopo-de-escola-da-grade.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. A correção só mexe em teste, nenhuma linha de produção muda, e o comportamento de `GradeRepository` continua o que a Tech Spec define (seção 4, leitura por turma, escopo pelo contexto).
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum

Conferência das duas recomendações da 1ª rodada:
- (a) Feita. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/api/test/grade.int.test.ts`, as linhas 619 e 620 juntam `turmaExiste(outra.e.emCurso, outra.t8a)` e `aulasDaTurma(outra.e.emCurso, outra.t8a)` sob o comentário, e o comentário agora cobre os dois métodos. A linha de `aulasDaTurma` saiu de onde estava, sem ficar duplicada. As outras asserções são as mesmas de antes.
- (b) Feita. O bloco `mutacao` novo em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/tasks/correcoes/2026-11-06-escopo-de-escola-da-grade.md` tira `eq(turma.escolaId, requireEscolaId())`. A linha `-` reproduz exatamente o `where` de `packages/core/src/importacao/grade.repository.ts:27`, e o texto de `falha:` existe na linha 619 do teste.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/tasks/correcoes/2026-11-06-escopo-de-escola-da-grade.md`, seção "Teste que reproduz": o texto diz "vermelho em `grade.int.test.ts:621`". Depois da troca de lugar, a asserção de `aulasDaTurma(outra.e.emCurso, outra.t8a)` está na linha 620. A referência deve dizer `:620`, para quem for repetir a mutação.

## test-engineer · 2ª rodada · APROVADO · 2026-11-06 06:16:53 · `tasks/correcoes/2026-11-06-escopo-de-escola-da-grade.md`

VEREDITO: APROVADO

**Cenários exigidos:** esta correção só cobre o isolamento da leitura da grade (regra 10, item 5). Com o contexto da escola A:
- a turma da própria escola, no ano em curso, existe e tem as aulas de segunda e terça (caminho feliz);
- a turma da escola B, lida com o ano da A, não existe e não tem aulas;
- a turma e o ano da escola B, lidos juntos pelo contexto da A, não existem e não têm aulas, em `turmaExiste` e em `aulasDaTurma`. É o único caso em que só o `escolaId` do contexto separa as duas escolas;
- a turma da A num ano planejado, que é outro ano letivo, não existe e não tem aulas.

**Cobertos:** todos, no caso `a leitura da grade só alcança a turma da escola do contexto e do ano pedido…` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/api/test/grade.int.test.ts:608-625`). Rodei esse caso isolado e ele passou.

Conferi as duas mutações do documento contra o `git diff` e contra o repository (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/importacao/grade.repository.ts`). Nenhum arquivo foi alterado.
- **Mutação de `turmaExiste` (linha 27 do repository):** o texto do bloco bate com o arquivo, com o mesmo recuo. As asserções das linhas 614 e 615 continuam verdes com a cláusula tirada, porque na 615 o filtro de ano ainda esconde a turma da B. A primeira a cair é a da linha 619, `turmaExiste(outra.e.emCurso, outra.t8a)`, e o trecho de `falha:` só aparece nessa linha. O teste cai pelo motivo certo.
- **Mutação de `aulasDaTurma` (linha 54 do repository):** com essa mutação, `turmaExiste` está intacto e a linha 619 continua verde. A primeira a cair é a da linha 620, que corresponde ao trecho de `falha:` do bloco. Mudar a ordem das asserções não tirou essa mutação do lugar certo.
- **As recomendações da rodada 1 foram aplicadas:** o comentário (linhas 616-618) agora diz que a leitura vale para os dois métodos, e o documento traz o bloco de `turmaExiste`.
- **O resto:** nenhum código de produção mudou (o diff tem só o teste, o documento e o índice de achados), o caso usa Postgres real, sem mock nem `.skip`, e não há IA nem operação concorrente nesta correção.

**Bloqueantes:** nenhum.

**Recomendações:**
- A seção "Teste que reproduz" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/tasks/correcoes/2026-11-06-escopo-de-escola-da-grade.md` (linha 35) ainda diz "vermelho em `grade.int.test.ts:621`". Com a mudança de ordem, a asserção de `aulasDaTurma(outra.e.emCurso, outra.t8a)` está na linha 620, e a 621 agora é `turmaExiste(e.planejado, t8a)`. Vale corrigir para 620, ou citar o trecho no lugar do número da linha, para a validação não ler a linha errada.
