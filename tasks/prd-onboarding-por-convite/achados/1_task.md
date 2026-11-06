# Achados das revisões — `tasks/prd-onboarding-por-convite/1_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-03 16:39:25 · `tasks/prd-onboarding-por-convite/1_task.md`

VEREDITO: APROVADO

A tarefa 1.0 só muda código de lugar. Comparei os sete arquivos movidos com o original (`git diff -M HEAD`): mudaram só as linhas de `import`. Nenhuma consulta, filtro, retorno ou registro de auditoria foi alterado. Rodei os testes de unidade de `architecture.test.ts`, `camadas.test.ts` e `ciclo-de-vida.repository.test.ts` (99 casos) e passaram. Não rodei os de integração.

Campos pessoais tocados: o e-mail da conta global, por `contaParaConvite`. A função saiu da `TenantResolutionRepository` e foi para a `ContaGlobalRepository` com o mesmo comportamento. Ela trava a conta que já existe (`FOR NO KEY UPDATE`), não lê nada dela e devolve só o `id` e se a conta é nova (`nova`). O `contaDoProfessor` (`packages/core/src/estrutura/cadastro-de-professor.ts:19-21`) descarta o `nova` e devolve só o `id`. Assim a coordenação continua sem saber se o e-mail já tinha conta em outra escola (E11).

Fora da tabela de dados do docs/lgpd.md: nenhum. A tarefa não cria campo. O e-mail de login da conta global já está em `docs/lgpd.md:65`, com finalidade e retenção, e o nome e e-mail do professor em `docs/lgpd.md:60`.

Autorização por objeto: ok. Os repositories movidos mantêm `requireEscolaId()` e `requireAnoEmCurso()` vindos do contexto. Há um teste novo em `apps/api/test/acesso-da-turma.int.test.ts` que deixa a cópia no core vermelha quando se tira o `escolaId`. Nenhuma rota nova.

Logs: limpos. Não há `logger` nem `console` nos arquivos novos ou movidos, nem em `convite.service.ts` e `convite-de-professor.service.ts`.

Auditoria: presente e igual à de antes.
- **Convite de professor:** grava `professor.cadastrado` sem campo nenhum, e `convite.criado` sem `contaNova` (`convite-de-professor.service.ts:54-55`).
- **Convite de coordenador:** só ele grava `contaNova` (`convite.service.ts:309`), como já era.

Envio externo: nenhum. A tarefa não envolve IA.

Seed/fixture: sintético.
- **Teste novo:** os e-mails são `professor-<uuid>@escola.invalid` (`cadastro-de-professor.int.test.ts:32`).
- **Fixtures das guardas:** não têm dado de pessoa, só importam a classe.

Pergunta de fechamento: continua respondida. O arquivo do titular (`packages/core/src/titular/leitura-do-titular.ts`) só teve um caminho de comentário atualizado, e a leitura do e-mail da conta não mudou.

Bloqueantes: nenhum.

Recomendações:
1. `contaDoProfessor` sai pelo subcaminho `@educa/core/estrutura` (`packages/core/src/estrutura/index.ts:15`). Qualquer módulo que importe esse subcaminho pode achar ou criar uma conta global pelo e-mail e receber o `id`, sem passar pelas cercas. As cercas guardam só a `ContaGlobalRepository`, não esta ponte. O risco hoje é baixo, porque a função não devolve o `nova` e nenhuma rota expõe o `id`. Antes da 4.0 (o worker), vale limitar quem importa `contaDoProfessor` (o `sessao/convite` e o worker da planilha) no `architecture.test.ts` ou no `camadas.cjs`.
2. O texto do `@Unscoped` encurtou para `'a conta é global: acha ou cria pelo e-mail'`. O anterior dizia também "sem ler nada dela, e devolvem só o id e se ela é nova". Vale devolver essa parte, que é a garantia de privacidade, à justificativa, e não só ao docblock.

Arquivos principais:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/ciclo-de-vida/conta-global.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/cadastro-de-professor.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/index.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/src/sessao/convite/convite.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/src/sessao/convite/convite-de-professor.service.ts

## revisor-geral · 1ª rodada · APROVADO · 2026-11-03 16:39:33 · `tasks/prd-onboarding-por-convite/1_task.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. As duas divergências da tarefa já estão registradas na spec. A subida do `exclusao.ts` está na linha de `packages/core/src/estrutura/` da §2 de `techspec.md`. A divisão em `convidar` e `convidarProfessor`, com o cadastro devolvendo só o id, está no parágrafo novo da §6 e em `docs/modelo-de-dados.md`, "Pessoas e vínculos".

Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo).

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/index.ts:15`: o subcaminho `@educa/core/estrutura` exporta o `contaDoProfessor` para qualquer módulo que importe os repositories. Esse "acha ou cria a conta pelo e-mail" não tem escopo. As duas guardas cercam a classe `ContaGlobalRepository`, mas não quem chama a função. Hoje só `sessao/convite/convite.service.ts` a usa, e a 4.0 vai pôr o worker como segundo chamador. Vale cercar também os chamadores do `contaDoProfessor` (`sessao/` e o processor do worker) nas duas guardas, na própria 4.0, ou passar a pergunta ao `tenancy-guardian`.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/index.ts:7`: o `excluirSemReferencia` sai pelo barrel, mas nada fora de `estrutura/` o usa. É export sem uso, que se pode tirar.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/src/sessao/tenant/tenant-resolution.repository.int.test.ts:482-489`: o `try/finally` em volta do expurgo mexe no teste além do caminho do `import`. A subtarefa 1.1 diz que nos testes só o `import` mudaria. Nenhuma asserção mudou, então não bloqueia, mas a frase da tarefa está imprecisa: registre o ajuste no `1_task.md`.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/docs/modelo-de-dados.md:351`: a coluna diz "no convite da coordenação", mas o método agora atende também o cadastro do professor. Ajustar o texto.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/src/sessao/convite/convite.service.ts:202-221`: o `convidarConta` recebe sete parâmetros posicionais, dois deles string seguidos (`contaId` e `nome`) e fáceis de trocar. Passar um objeto `{ contaId, nome }` evita isso.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/src/sessao/convite/convite-de-professor.service.ts:8-9`: a linha do docblock passou da largura das vizinhas; vale quebrá-la.

Conferido sem achado:
- Os sete arquivos movidos mudaram só nos `import` (`git diff -M`).
- Não sobrou referência aos caminhos antigos em `apps/`, `packages/`, `tools/`, `docs/` e `e2e/`.
- Nada entrou de tarefa futura: nem `turma.chave`, nem `fechar('encerrada')`, nem `desativar`.
- O `ContaGlobalRepository` está com os quatro `@Unscoped`, e o `TenantResolutionRepository` perdeu só o `contaParaConvite`.
- A cerca é por arquivo nas duas guardas, com fixture para cada forma de contornar.

## tenancy-guardian · 1ª rodada · REPROVADO · 2026-11-03 16:39:44 · `tasks/prd-onboarding-por-convite/1_task.md`

VEREDITO: REPROVADO

Tabelas verificadas: nenhuma tabela nova nem migration. As tabelas que os arquivos movidos tocam continuam com escopo da mesma forma: `turma`, `serie`, `disciplina`, `lista_nome`, `credencial_matricula`, `vinculo`, `reivindicacao`, `acesso_turma` e `ano_letivo`. A `conta` é global por desenho, e essa exceção já está registrada em `docs/modelo-de-dados.md`.

Queries verificadas:
- Os sete arquivos movidos para `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/` (`turma`, `serie`, `disciplina`, `lista`, `vinculo`, `decisao` e `exclusao`). `git diff -M` mostra que só os `import` mudaram. `requireEscolaId()` e `requireAnoEmCurso()` continuam em todo método, e nenhum método recebe a escola por argumento.
- `ContaGlobalRepository.contaParaConvite`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/ciclo-de-vida/conta-global.repository.ts:305`, com `@Unscoped` e justificativa.
- `contaDoProfessor`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/cadastro-de-professor.ts:18`.
- `convidar` e `convidarProfessor`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/src/sessao/convite/convite.service.ts`.
- Os services da API que passaram a importar de `@educa/core/estrutura`: só o import mudou.

Teste de isolamento: presente e efetivo.
- `acesso-da-turma.int.test.ts › no contexto da escola A, a turma de B não é aberta nem travada, e no contexto de B é` fica vermelho sem o `escolaId` em `aberta`, `travarContraOGerar`, `travarContraExclusao` e `travarAnoEmCurso`. O controle, no contexto de B, mostra que o teste não passa só porque a turma não existe.
- O teste do `anoLetivoId` do vínculo já existia e cobre a cópia movida.
- Rodei as guardas (`architecture.test.ts`, `camadas.test.ts` e `ciclo-de-vida.repository.test.ts`): 99 casos verdes.

Bloqueantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/index.ts:15`, `export { contaDoProfessor } from './cadastro-de-professor.js'`.
  - **O que está errado:** a cerca por arquivo protege a classe, mas não a função que a repassa. `contaDoProfessor` acha ou cria uma `conta` global pelo e-mail, sem escopo, e devolve o id dela. Ela sai pelo mesmo subcaminho `@educa/core/estrutura` que todos os services de `estrutura/`, `sala/` e `material/` da API já importam, e o worker também vai importar.
  - **Por que nenhuma guarda pega:** o `uso` de `ZONAS_DAS_CLASSES_CERCADAS` (`apps/api/test/architecture.test.ts:50`) só procura `ContaGlobalRepository`, `conta-global.repository` e `@educa/core/conta-global`. A regra `cerca-conta-global` (`tools/guardas/camadas.cjs:160`) só olha a aresta direta até `conta-global.repository.ts`. Um `turma.service.ts` que chamasse `contaDoProfessor` deixaria as duas verdes.
  - **O efeito:** antes desta tarefa, o `contaParaConvite` só se alcançava de `apps/api/src/sessao/`, pelo `TenantResolutionRepository`, que é cercado. Agora se alcança do monorepo inteiro. É uma exceção à regra 10, item 9 que ficou sem cerca e sem teste que prove a cerca.
  - **Correção exigida:**
    1. Tirar `contaDoProfessor` do barrel `estrutura/index.ts` e expô-lo num subcaminho próprio, por exemplo `@educa/core/cadastro-de-professor`, no mesmo molde do `@educa/core/conta-global`.
    2. Cercar quem chama esse subcaminho nas duas guardas: uma entrada em `ZONAS_DAS_CLASSES_CERCADAS`, com `uso` que pegue `contaDoProfessor`, `cadastro-de-professor` e o subcaminho, e uma regra no depcruise com `to: cadastro-de-professor.ts`. A zona é `apps/api/src/sessao/`; o processor do worker entra quando a 4.0 ou a 6.0 chegar.
    3. Pôr fixture de vizinho que reprova nas duas guardas, por exemplo `apps/api/src/estrutura/turma/vaza.ts` importando `contaDoProfessor` de `@educa/core/estrutura` ou do subcaminho novo.
    4. Atualizar o docblock de `estrutura/index.ts` e `docs/modelo-de-dados.md` para dizer quem pode chamar o cadastro, e não só quem pode importar a classe.

Recomendações:
- Em `cadastro-de-professor.int.test.ts`, juntar um caso que prova que um e-mail com outra caixa ou com espaço não cria uma segunda conta. Hoje a normalização depende de quem chama (`normalizarEmail` em `convite.service.ts`), e o worker da 4.0 vai chamar sem passar por ela.
- O caso novo de `acesso-da-turma.int.test.ts` monta um contexto que a `SessaoGuard` nunca grava (a escola A com o ano de B). Vale uma linha no docblock do teste dizendo que ele cobre só o repository, e que a prova pela rota continua nos casos da A1.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-03 16:39:51 · `tasks/prd-onboarding-por-convite/1_task.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum (a tarefa só muda código de lugar: estrutura, decisão e cadastro do professor vão para o core, sem mudar comportamento)
Rate limit: ok (a tarefa não mexe em rate limit)
Fila e prioridade: ok (a tarefa não cria job)
Concorrência: protegida. O `contaParaConvite` mudou de lugar sem mudar a lógica: o `insert ... on conflict do nothing` pelo e-mail, a trava `for no key update` e as três tentativas continuam como estavam. As duas corridas contra o expurgo seguem cobertas em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/src/sessao/tenant/tenant-resolution.repository.int.test.ts`. O `travarPendente` (`for update`) e as travas da turma também não mudaram.
Índice e paginação: ok (nenhuma query nova; o `git diff -M` dos sete arquivos movidos mostra só linhas de `import` trocadas)
Degradação de IA: não se aplica
Migration: não se aplica (no schema, só mudaram dois comentários de caminho)
Métrica e alerta: ok (nenhum código novo no caminho quente)
Bloqueantes: nenhum

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/cadastro-de-professor.ts`: quando o worker da 4.0 passar a chamar `contaDoProfessor`, a planilha tem que rodar na fila de lote com limite de concorrência por escola. A transação precisa ser curta, por linha ou por blocos pequenos, para não segurar a trava `travarEscola` e as linhas de `conta` durante o lote inteiro. Uma transação longa travaria o cadastro manual da coordenação e o aceite de convite da mesma escola. O e-mail do convite sai pela fila, respeitando o limite do provedor.
- O `contaDoProfessor` aceita qualquer `DatabaseTransaction`, mas nada exige que a trava da escola (`travarEscola`) tenha sido tomada antes. Vale registrar isso no contrato da 4.0, para o worker seguir a mesma ordem de trava da API (escola primeiro, conta depois) e não abrir chance de deadlock com o aceite.

O que rodei:
- Testes unitários das guardas (`architecture.test.ts`, `camadas.test.ts` e `ciclo-de-vida.repository.test.ts`): 99 de 99 passaram.
- Checagem de tipos da API: sem erro.
- Checagem de tipos do build do core: erros só de `@educa/shared` não encontrado, porque o `dist` do pacote não está gerado nesta máquina. A causa é o ambiente, não a tarefa.
- Os testes de integração não rodei. Para eles conto com a rodada que a tarefa registra.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-03 16:40:56 · `tasks/prd-onboarding-por-convite/1_task.md`

**VEREDITO: REPROVADO**

Há um bloqueante: o subcaminho novo `@educa/core/estrutura` abre uma ponte para a `ContaGlobalRepository` que nenhuma das duas guardas vê. Todo o resto da tabela está coberto, e os testes que rodei estão verdes.

**Cenários exigidos:**
- Caminho feliz: os repositories mudam de lugar sem mudar comportamento, e o `contaParaConvite` responde igual na classe nova, tanto achando a conta quanto criando.
- Bordas: e-mail que já tem conta em outra escola (E11); conta sendo limpa pelo expurgo durante o convite, com as duas corridas.
- Permissão: só o arquivo do cadastro, e nenhum vizinho, alcança a conta global, por qualquer forma de contornar.
- Isolamento: contexto da escola A com o ano de B não abre nem trava a turma de B.
- A guarda não se cala quando o alvo some, e o `exclude` não esconde o arquivo real.

**Cobertos:**
- **Mudança de lugar.** O `git diff -M` dos sete arquivos movidos tem só `import` trocado (similaridade de 95%). As 67 linhas que o `--faltando` ainda lista são todas desses arquivos, e o motivo no documento confere.
- **Isolamento da turma.** O teste novo em `acesso-da-turma.int.test.ts` usa o contexto de A com o ano de B e tem o controle no contexto de B.
- **`contaParaConvite`.** Os quatro casos de `cadastro-de-professor.int.test.ts` olham o resultado: o objeto devolvido, `nova`, `senha_hash` nulo e uma conta só no banco. As duas corridas contra o expurgo seguem em `tenant-resolution.repository.int.test.ts`.
- **A divisão `convidar` / `convidarProfessor`.** Já estava provada por testes que não mudaram: `convite.int.test.ts:258` e `:407` conferem o `contaNova` do convite do coordenador, e o E11 de `professores.int.test.ts:340-366` confere que o do professor não o leva.
- **As cercas.** Cada linha da tabela de testes tem o caso citado pelo nome e ele existe: o vizinho, `export *` e `export { as }`, `import()`, `require`, o subcaminho, o caminho como texto, `cadastro-de-professor-2.ts`, o alvo que some (pela varredura por entrada da zona e pela aresta em `real: todo alvo…`) e o `exclude`.
- **O que rodei:** os 4 arquivos de unidade (101 casos) e 3 de integração (`cadastro-de-professor`, `acesso-da-turma`, `tenant-resolution.repository.int`, 43 casos), todos verdes. Não há `.skip`, mock nem provedor de IA.

**Bloqueantes:**
1. **A ponte pelo `@educa/core/estrutura` não é vigiada.** `packages/core/src/estrutura/index.ts:15` reexporta do arquivo da zona (`export { contaDoProfessor } from './cadastro-de-professor.js'`).
   - **A ponte:** se `cadastro-de-professor.ts` passar a reexportar a classe (`export { ContaGlobalRepository }`) e o barril trocar para `export * from './cadastro-de-professor.js'`, nenhuma guarda acusa. A varredura por texto aceita o arquivo, porque ele está na zona, e o barril não cita o nome. O `cerca-conta-global` também não acusa, porque o barril importa o cadastro e não o `conta-global.repository.ts`. A classe sairia para qualquer código por `@educa/core/estrutura`.
   - **O que já existe:** a conferência em execução feita para esse caso, "o reexport que ela não vê", em `apps/api/test/architecture.test.ts:139-151`, só lista `@educa/core` e `@educa/core/ciclo-de-vida`.
   - **Correção exigida:**
     - Incluir `['@educa/core/estrutura', await import('@educa/core/estrutura')]` na lista de `architecture.test.ts:142-145`, com o controle positivo de que o subcaminho exporta `TurmaRepository` e `contaDoProfessor`.
     - Declarar um bloco de mutação: `export { ContaGlobalRepository } from '../ciclo-de-vida/conta-global.repository.js'` no `index.ts`, com `falha: not.toContain`.

**Recomendações:**
1. **O bloco do `@Unscoped`** (`1_task.md:200-206`) muda o nome do método, e o vermelho vem da lista de nomes, não do decorador. O teste pegaria a retirada do decorador (`ciclo-de-vida.repository.test.ts:424`: justificativa ausente dá 0), mas o bloco não prova isso. Trocar por apagar a linha `@Unscoped('a conta é global: acha ou cria pelo e-mail')`, com `falha: toBeGreaterThanOrEqual`.
2. **Mesmo furo da turma nos repositories irmãos.** `VinculoRepository#escopo`, `ListaRepository` e as cláusulas `escolaId` do `DecisaoRepository` filtram por `escolaId` e por `anoLetivoId`. Pelo mesmo motivo achado na turma (o ano de cada escola já separa), a retirada só do `escolaId` deles provavelmente fica verde. Hoje é furo que já existia. Passa a importar na 4.0, porque o worker monta o contexto a partir do job, e lá o contexto de A com o ano de B deixa de ser impossível. Levar para a 4.0 o mesmo teste de "contexto de A com o ano de B" para vínculo, lista e decisão.
3. **Zona por arquivo com `startsWith`.** `architecture.test.ts:60` e `:73` também aceitariam `cadastro-de-professor.tsx` ou `cadastro-de-professor.ts.bak`. O `camadas.cjs` usa a expressão com `$` no fim. Comparar por igualdade quando a entrada da zona é um arquivo.
4. **Mudança além do `import` em teste.** `tenant-resolution.repository.int.test.ts:256-269` ganhou um `try/finally`, que muda a estrutura do teste e não só o caminho. Nenhuma asserção mudou, mas a 1.1 diz que "só os caminhos de import mudaram". Registrar a exceção no documento.
5. **Corrida de dois convites ao mesmo e-mail novo, em paralelo.** O `onConflictDoNothing` com nova tentativa é anterior a esta tarefa. Se não houver teste com as duas chamadas em paralelo, vale um em `cadastro-de-professor.int.test.ts` antes de o worker da 4.0 cadastrar em lote.

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/index.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/architecture.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/1_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/src/sessao/tenant/tenant-resolution.repository.int.test.ts

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-03 17:00:59 · `tasks/prd-onboarding-por-convite/1_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nesta rodada. O diff não mexe em schema nem em migration.

Queries verificadas: `contaDoProfessor` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/cadastro-de-professor.ts:18`), que chega a `ContaGlobalRepository.contaParaConvite` sem escopo. Hoje só um código de produção o chama: `apps/api/src/sessao/convite/convite.service.ts:242`, pelo subcaminho `@educa/core/cadastro-de-professor`. Fora de `sessao/` ninguém mais o importa ou chama.

Teste de isolamento: presente e efetivo. As quatro correções exigidas na 1ª rodada estão feitas:
1. `contaDoProfessor` saiu do barril `packages/core/src/estrutura/index.ts` e agora tem subcaminho próprio em `packages/core/package.json`.
2. As duas guardas cercam quem o chama. Em `architecture.test.ts:54`, a entrada `contaDoProfessor` pega a função, o arquivo e o subcaminho. Em `tools/guardas/camadas.cjs:163`, a regra `cerca-cadastro-de-professor` aponta para o arquivo do cadastro. As duas deixam só `sessao/` chamá-lo.
3. Há vizinhos que reprovam nas duas guardas: `vaza-cadastro.ts` pelo subcaminho, `cadastro-dinamico.ts` por `import()`, `cadastro-reexporta.ts` por `export *` e o barril da estrutura. O controle `sessao/login/usa-cadastro.ts` passa. Os testes lidos em execução provam que o barril não repassa a função e que o subcaminho só exporta `contaDoProfessor`.
4. O docblock do `index.ts`, o `docs/modelo-de-dados.md` e a `techspec.md` §6 agora dizem quem pode chamar o cadastro.

Tirando a cláusula de cerca, as guardas quebram:
- Devolver o `export` ao barril reprova o teste de execução e a regra `cerca-cadastro-de-professor`.
- Abrir a zona para `apps/api/src/` deixa passar a fixture `vaza-cadastro.ts`, e o teste de arquitetura reprova.

Rodei `tools/guardas/camadas.test.ts` (34 de 34) e `apps/api/test/architecture.test.ts` (65 de 65), os dois verdes.

Bloqueantes: nenhum.

Recomendações:
- O docblock de `packages/core/src/estrutura/cadastro-de-professor.ts:4-10` ainda fala só da cerca da classe (`cerca-conta-global`). Vale citar também a cerca de quem chama a função: a regra `cerca-cadastro-de-professor` e a entrada `contaDoProfessor`.
- Quando a 4.0 ou a 6.0 puser o processor do worker na zona, a mudança precisa entrar nas duas guardas no mesmo commit, cada uma com uma fixture de controle que passa.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-03 17:01:07 · `tasks/prd-onboarding-por-convite/1_task.md`

VEREDITO: APROVADO

Escopo: respeitado. A rodada só fecha o furo apontado pelo `tenancy-guardian` e pelo `test-engineer` na 1ª rodada. O `contaDoProfessor` saiu do barril `@educa/core/estrutura` e ganhou um subcaminho próprio, `@educa/core/cadastro-de-professor`, cercado nas duas guardas. A rodada não adianta a 4.0: a entrada do worker na zona ficou só escrita na techspec, sem código.

Aderência à Tech Spec: ok. A mudança está no §6 da `techspec.md` (parágrafo depois da lista), em `docs/modelo-de-dados.md` ("Pessoas e vínculos" e a tabela dos métodos sem escopo) e na tabela de divergências do `1_task.md`. Hoje, fora dos testes, o único que chama o `contaDoProfessor` é `apps/api/src/sessao/convite/convite.service.ts:2`, que está dentro da zona.

Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo).

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/1_task.md`: a linha nova da tabela de divergências cita a techspec e o modelo de dados, mas não o `cenarios.md`. Como é uma cerca de arquitetura e não um comportamento de negócio, não bloqueio. Mesmo assim, valeria registrar no `cenarios.md`, ou declarar ali que não se aplica, para a regra da seção 2 ficar visivelmente cumprida.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/architecture.test.ts:54`: o regex de uso também casa com o texto `cadastro-de-professor` em qualquer nome de arquivo ou caminho. Hoje só traz falso positivo em teste ou fixture, que a varredura ignora. Na 4.0, quando o processor do worker entrar na zona, confira que o regex não acusa um nome de arquivo do worker que só se pareça com esse.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/docs/modelo-de-dados.md:95`: a linha nova ficou bem mais comprida que as vizinhas, porque o texto foi emendado sem quebra. É só a quebra de linha do parágrafo.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-03 17:01:14 · `tasks/prd-onboarding-por-convite/1_task.md`

VEREDITO: APROVADO

Esta é a 2ª rodada. Auditei só o diff desde a minha 1ª rodada (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/.processo/ordens/1_task-diff-r2.diff`). Naquela rodada não exigi correção nenhuma. O que mudou agora atende ao veto do `tenancy-guardian` e do `test-engineer`: o `contaDoProfessor` acha ou cria a conta global pelo e-mail sem escopo de escola, e antes ficava ao alcance de qualquer módulo que importasse o barril `@educa/core/estrutura`. Agora ele sai só pelo subcaminho próprio `@educa/core/cadastro-de-professor` e só `apps/api/src/sessao/` pode chamá-lo. Para dado pessoal, isso deixa menos lugares capazes de criar ou achar conta por e-mail. Nada nesse diff aumenta o que é coletado ou exposto.

Confirmei no código atual que o único chamador de produção é `apps/api/src/sessao/convite/convite.service.ts:2` e `:242`. O outro é o teste do próprio core, `packages/core/src/estrutura/cadastro-de-professor.int.test.ts`. O barril `packages/core/src/estrutura/index.ts` não reexporta mais o cadastro. Duas guardas cobrem a cerca: `apps/api/test/architecture.test.ts:54`, que confere em execução o que o barril e o subcaminho exportam, e `cerca-cadastro-de-professor` em `tools/guardas/camadas.cjs`. Cada uma tem fixture que deve ser reprovada e um controle que deve passar.

Campos pessoais tocados: nenhum campo novo. O e-mail do professor passa pelo `contaDoProfessor` como já passava na rodada anterior, só por outro caminho de import. Nenhum campo de aluno.
Fora da tabela de dados do docs/lgpd.md: nenhum.
Autorização por objeto: ok. O diff não cria nem muda rota. A função sem escopo agora tem uma zona menor de quem pode chamá-la.
Logs: limpos. Não entrou log nenhum.
Auditoria: presente. Nenhuma ação que exige auditoria foi criada ou alterada, e o `convidar` do coordenador continua levando o `nova` à auditoria, como na 1ª rodada.
Envio externo: nenhum.
Seed/fixture: sintético. As fixtures novas em `tools/guardas/__fixtures__/camadas/` são stubs de import, sem dado de pessoa.
Bloqueantes: nenhum.
Recomendações:
- Quando a 4.0 colocar o processor do worker na zona do `contaDoProfessor`, é preciso ampliar as duas guardas juntas (a entrada em `architecture.test.ts:54` e o `pathNot` de `cerca-cadastro-de-professor`) e conferir que o worker grava só o id da conta, sem levar o e-mail a log ou ao payload do job. O techspec já prevê a ampliação das guardas; o cuidado com log e payload fica registrado para a minha rodada na 4.0.

## test-engineer · 2ª rodada · APROVADO · 2026-11-03 17:01:28 · `tasks/prd-onboarding-por-convite/1_task.md`

VEREDITO: APROVADO

Cenários exigidos: a correção da 1ª rodada. O barril `@educa/core/estrutura` precisava ser lido em execução, e nem ele nem qualquer outra ponte podia expor a `ContaGlobalRepository`, nem pelo nome dela nem por outro. Também precisava de controle positivo e de um bloco de mutação no `index.ts`. Como o próprio `contaDoProfessor` repassa a conta global sem escopo, quem o chama fora de `sessao/` também tem de ser acusado.

Cobertos:
- **O barril e o subcaminho novo são lidos em execução.** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/architecture.test.ts:149-168` agora lê também `@educa/core/estrutura` e `@educa/core/cadastro-de-professor`, conferindo `not.toContain` por nome e por valor. A tarefa mudou o desenho em relação ao que eu tinha exigido: o `contaDoProfessor` saiu do barril e ganhou subcaminho próprio. O controle positivo acompanha essa mudança e é mais forte que o pedido:
  - `estrutura` contém `TurmaRepository`, o que prova que o barril é lido de verdade;
  - `estrutura` não contém `contaDoProfessor`;
  - `Object.keys(cadastro)` é exatamente `['contaDoProfessor']`, o que fecha também a ponte em que o próprio arquivo do cadastro reexportasse a classe.
- **Bloco de mutação no `index.ts` com a `ContaGlobalRepository`.** Usa `falha: not.toContain('ContaGlobalRepository')`, e o trecho existe no teste. Com a mutação, o laço só cai na iteração do barril da estrutura, porque as anteriores ficam verdes. O vermelho vem do motivo certo.
- **Bloco de mutação no `index.ts` com o `contaDoProfessor`.** Usa `falha: not.toContain('contaDoProfessor')` e cai na asserção nova, depois que a de `TurmaRepository` passa.
- **Cerca da função nas duas guardas:**
  - Na varredura por texto, a entrada nova de `contaDoProfessor` em `ZONAS_DAS_CLASSES_CERCADAS` acusa três casos: o barril, um service fora de `sessao/` pelo subcaminho e o caminho como texto no worker. O `convite.service.ts` de `sessao/` serve de controle e passa.
  - No depcruise, a regra `cerca-cadastro-de-professor` acusa quatro fixtures: a importação pelo subcaminho, o `import()`, o `export *` e o barril. O controle `sessao/login/usa-cadastro.ts` passa.
  - O caso `real:` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tools/guardas/camadas.test.ts:238-247` exige que a aresta exista (`length > 0`), de modo que não passa por vazio.
  - As duas mutações das cercas fazem cair o `it.each` das fixtures e a lista de esperados da varredura por texto: a que tira `estrutura/` da regra e a que alarga a zona para `apps/api/src/`.
- **Bloco de `contaParaConvite` reescrito.** Agora tira o `@Unscoped`, e o teste cai no `toBeGreaterThanOrEqual` da justificativa (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.test.ts:18`). O trecho confere.
- **Tabela de testes da tarefa.** A linha nova cita cada teste pelo nome, e todos existem.
- **Resolução do subcaminho.** O `customConditions: ["source"]` do `tsconfig.base.json` resolve o subcaminho, e o teste de arquitetura o importa sem erro.
- **Execução.** Rodei `npx vitest run apps/api/test/architecture.test.ts tools/guardas/camadas.test.ts` e os 99 casos passaram. Não há `.skip`, mock nem chamada de IA no diff.

Bloqueantes: nenhum.

Recomendações:
- Os blocos de mutação de `camadas.cjs` e da zona em `architecture.test.ts` não têm linha `falha:`. Os dois caem no lugar certo hoje, mas a linha deixaria isso garantido pelo portão.
- Quando o worker da 4.0 entrar na zona, as duas cercas e a asserção `startsWith('apps/api/src/sessao/')` do caso `real:` precisam mudar juntas. A techspec já diz isso, mas vale repetir na tarefa 4.0.

## tenancy-guardian · 3ª rodada · APROVADO · 2026-11-03 17:11:41 · `tasks/prd-onboarding-por-convite/1_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nem migration no diff da 3ª rodada. Desde a 2ª rodada, `lista-nome.ts` e `reivindicacao.ts` não mudaram.

Queries verificadas:
- `packages/core/src/ciclo-de-vida/conta-global.repository.ts:135`: em `contaParaConvite`, só o texto do `@Unscoped` mudou e a query continua igual. O texto novo diz que a conta é global e que o método devolve só o id e se a conta é nova. A justificativa escrita continua presente.
- `apps/api/src/sessao/convite/convite.service.ts:202-243`: `convidarConta` passou a receber `{ contaId, nome }` num objeto, em vez de dois parâmetros. O escopo não mudou: escola e autor continuam vindo do contexto.
- `packages/core/src/estrutura/index.ts`: `excluirSemReferencia` saiu do barril. Ninguém fora de `estrutura/` o usava; só `turma.repository.ts` e `disciplina.repository.ts` o importam, direto do arquivo.
- `apps/api/test/architecture.test.ts:70-91`: `dentroDaEntrada` deixa a cerca mais rígida. A zona que nomeia um arquivo agora exige o caminho exato, sem `startsWith`; a que termina em `/` continua valendo para a pasta. As fixtures `cadastro-de-professor.tsx` e `.ts.bak` agora são reprovadas, e o bloco de mutação em `tasks/prd-onboarding-por-convite/1_task.md` mostra que a volta para `startsWith` derruba o teste. A checagem de que cada zona acha a classe continua de pé, e não há rota aberta por essa mudança.

Teste de isolamento: presente e efetivo. Nada mudou desde a 2ª rodada, exceto um comentário em `apps/api/test/acesso-da-turma.int.test.ts:57-58`.

Bloqueantes: nenhum.

Recomendações: nenhuma nova. As que vieram da 2ª rodada, a mudança das duas guardas junto com a asserção `startsWith('apps/api/src/sessao/')` quando o worker entrar na zona, e só o id da conta no log e no payload, estão encaminhadas para a 4.0 em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/1_task.md`.

## test-engineer · 3ª rodada · APROVADO · 2026-11-03 17:12:01 · `tasks/prd-onboarding-por-convite/1_task.md`

VEREDITO: APROVADO

Cenários exigidos (rodada 3, só o diff desde a rodada 2):
- A zona da cerca escrita como arquivo (`cadastro-de-professor.ts`) passa a valer só para aquele arquivo. Antes, um nome parecido também entrava na zona: `cadastro-de-professor.tsx` e `cadastro-de-professor.ts.bak` agora contam como vizinhos e são reprovados.
- A zona escrita como pasta (`apps/api/src/sessao/`) continua valendo para tudo que está dentro dela.
- O `excluirSemReferencia` saiu do barril `@educa/core/estrutura` sem deixar import quebrado.
- O `convidarConta` agora recebe a conta e o nome num objeto só, e o comportamento dos dois chamadores continua igual.
- O texto novo do `@Unscoped` de `contaParaConvite` continua guardado pelo bloco de mutação.

Cobertos:
- Zona por arquivo: duas fixtures novas em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/architecture.test.ts` (linhas 105-107), com as duas acusações esperadas no `toEqual` (linhas 139-140). Há também um bloco de mutação novo em `1_task.md`, que troca a igualdade por `startsWith`. Ele fica vermelho pelo motivo certo: com `startsWith`, o `.tsx` e o `.ts.bak` entrariam na zona e sumiriam da lista de acusações, e o `toEqual([` cai. A conferência "uma a uma" das entradas da zona (linha 90) também usa `dentroDaEntrada`, então uma zona por arquivo que mude de lugar continua derrubando o caso. Rodei `npx vitest run apps/api/test/architecture.test.ts`: 65 de 65 passaram.
- Barril: o `grep` por `excluirSemReferencia` acha só `exclusao.ts` e os dois repositories que o importam pelo caminho relativo (`./exclusao.js`). Ninguém o importava pelo barril.
- `convidarConta`: a função não é exportada e os dois únicos chamadores (`convidar`, `convidarProfessor`) foram atualizados. Os dois continuam passando o mesmo `contaId` e o mesmo `nome`. A suíte de convite da rodada 2 continua cobrindo, e nenhuma asserção mudou.
- `@Unscoped`: o bloco de mutação em `1_task.md` foi atualizado para o texto novo, e a asserção é do `ciclo-de-vida.repository.test.ts`.
- Os dois blocos que já existiam (`cerca-cadastro-de-professor` e a zona de `contaDoProfessor`) ganharam a linha `falha:`. O resto do diff é comentário e documentação (`modelo-de-dados.md`, `techspec.md`, cabeçalhos), sem cláusula nova.
- Mutações: os blocos passam de 17 para 18, e o único código novo com regra, `dentroDaEntrada`, tem o seu.

Bloqueantes: nenhum.

Recomendações: nenhuma nova. As da 1ª e da 2ª rodada estão registradas em "Recomendações sem aplicar", com destino na tarefa 4.0 (concorrência de dois convites ao mesmo e-mail novo, normalização do e-mail no cadastro, mudar as duas guardas e as fixtures de controle quando o worker entrar na zona).

## revisor-geral · 3ª rodada · APROVADO · 2026-11-03 17:12:10 · `tasks/prd-onboarding-por-convite/1_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo, sobre a árvore atual)
Bloqueantes: nenhum

Esta rodada auditou só o diff desde a rodada 2, de 279 linhas. Nada nele exige correção.

- **Zona por arquivo** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/architecture.test.ts:57-60`): a nova `dentroDaEntrada` compara arquivo por igualdade e só usa `startsWith` quando a entrada é pasta. Toda entrada de `ZONAS_DAS_CLASSES_CERCADAS` (linhas 49-54) termina em `/` ou é um arquivo `.ts` exato, então nenhuma zona antiga mudou de sentido. Os dois casos novos, `cadastro-de-professor.tsx` e `.ts.bak`, ficam fora da zona. A mutação que volta para `startsWith` está declarada no `1_task.md` e derruba esse caso.
- **`excluirSemReferencia` fora do barril** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/index.ts`): os dois únicos usos são internos, em `turma.repository.ts:14` e `disciplina.repository.ts:7`, por caminho relativo. Nada fora do core dependia do export.
- **`convidarConta` recebe `{ contaId, nome }`** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/src/sessao/convite/convite.service.ts:202-243`): só agrupa dois parâmetros de texto que podiam ser trocados de posição. As duas chamadas passam os mesmos valores de antes.
- **Justificativa do `@Unscoped`**: o texto novo está igual no repository, na `techspec.md` §6, na subtarefa 1.2 e no bloco de mutação.
- **Exceção na caracterização (1.1)**: o `try/finally` em `tenant-resolution.repository.int.test.ts` está declarado no documento, sem asserção mudada.
- **`cenarios.md`**: a linha de divergência registra que ele não foi editado porque a mudança é cerca de arquitetura, sem comportamento de negócio novo. A divergência está na `techspec.md` §6 e no `docs/modelo-de-dados.md`, então isso é aceitável.
- **Recomendações adiadas**: as que foram para a tarefa 4.0 têm destino e motivo escritos.

Recomendações:
- A seção "Mutações" diz "18 blocos" e ainda "67 linhas". Se o bloco novo de `architecture.test.ts` (código de `test/`) não entra no `--faltando`, a conta está certa. Vale confirmar que o 18 corresponde ao que o `--faltando` imprime de fato.
- O comentário novo em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/cadastro-de-professor.ts` (linhas 10-12) repete o que já está no `docs/modelo-de-dados.md` e na `ZONAS_DAS_CLASSES_CERCADAS`. São três lugares para manter iguais na 4.0, quando o worker entrar na zona.

## privacy-guardian · 3ª rodada · APROVADO · 2026-11-03 17:12:18 · `tasks/prd-onboarding-por-convite/1_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo. As mudanças que passam por dado pessoal mexem só na forma do código. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/src/sessao/convite/convite.service.ts:205`, o `convidarConta` agora recebe `{ contaId, nome }` num objeto só, em vez de dois argumentos. O nome do convidado (professor ou coordenador, que são adultos) continua indo só para `usuarioConvidado`. Não aparece em log nem em resposta, e o retorno segue `{ conviteId, usuarioId }`.

Fora da tabela de dados do docs/lgpd.md: nenhum.

Autorização por objeto: ok. Nenhuma rota nem repository com escopo mudou de comportamento. O que mudou em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/acesso-da-turma.int.test.ts` foi só um comentário: ele agora diz que o caso "contexto de A com ano de B" prova o repository, e que a prova pela rota fica nos casos da A1.

Logs: limpos. Nenhum log novo no diff.

Auditoria: presente. Nada no diff mexe em ação auditável. O `nova` continua indo à auditoria só no convite do coordenador, e o cadastro do professor continua descartando-o. Assim a coordenação não fica sabendo se aquele e-mail já tinha conta em outra escola.

Envio externo: nenhum.

Seed/fixture: sintético. As duas fixtures novas do `architecture.test.ts` (`cadastro-de-professor.tsx` e `.ts.bak`) só têm um `import` de código, sem dado de pessoa.

Bloqueantes: nenhum.

O que conferi no diff desta rodada:
- **Cerca do cadastro do professor mais estreita**, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/architecture.test.ts:71-73`.
  - A zona de um arquivo agora vale só para aquele arquivo exato; antes, valia para qualquer caminho que começasse com o nome dele.
  - Com isso, `cadastro-de-professor.tsx` e `cadastro-de-professor.ts.bak` passam a ser tratados como vizinhos e são reprovados. Um arquivo assim não consegue mais chegar à `ContaGlobalRepository` sem escopo.
  - As fixtures provam isso, e há uma mutação registrada para o caso.
- **Texto do `@Unscoped`**, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/ciclo-de-vida/conta-global.repository.ts:92`. Ficou mais preciso ("sem ler nada dela, e devolve só o id e se ela é nova") e bate com o retorno `{ id, nova }`.
- **`excluirSemReferencia` saiu do barril** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/index.ts`. Só `turma.repository.ts` e `disciplina.repository.ts` o usam, pelo caminho relativo, então não se perde nada. A API exportada pelo pacote fica menor.
- **Mudanças só de documentação** no cabeçalho de `cadastro-de-professor.ts`, em `docs/modelo-de-dados.md`, na `techspec.md` e na `1_task.md`. A tarefa registra o `try/finally` no teste da corrida contra o expurgo, sem asserção mudada. As recomendações das rodadas anteriores foram mandadas para a 4.0; entre elas está conferir que o worker leva só o id da conta a log e a payload.

Correções exigidas na rodada anterior: nenhuma, então não havia nada a conferir.

Pergunta de fechamento: o diff não muda o que o sistema guarda sobre um aluno nem para onde isso é enviado. A resposta continua a da rodada aprovada (`packages/core/src/titular/leitura-do-titular.ts`, sem mudança desde então).

Recomendações:
- Na 4.0, quando o worker da planilha entrar na zona do `contaDoProfessor`, a entrada nova tem que ser o arquivo exato do processor e não a pasta do worker. Assim fica o mesmo critério estreito que esta rodada passou a usar.

## conformidade-reviewer · 3ª rodada · APROVADO · 2026-11-03 17:12:26 · `tasks/prd-onboarding-por-convite/1_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta rodada. O diff não cria nem altera escrita em `Nota`, então segue o que foi aprovado na 2ª rodada. Todos com autor humano? sim
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. Nenhuma saída de IA nova, e a exceção da D47 não aparece em outro agente.
Supervisão do tutor: ok. O diff não toca o tutor.
Autonomia declarada e visível: sim. Não mudou, porque o diff não toca `governanca`.
Bloqueantes: nenhum
Recomendações: nenhuma da regra 70.

Auditei só o diff da 3ª rodada (`.processo/ordens/1_task-diff-r3.diff`, 10 arquivos). A 2ª rodada não deixou correção exigida, então não havia correção a conferir. Nada no diff alcança a regra 70:

- **Convite (`convite.service.ts`, `convite-de-professor.service.ts`):** só reorganiza parâmetros (`{ contaId, nome }`) e quebra linha de comentário. O comportamento não muda.
- **Cercas de arquitetura (`apps/api/test/architecture.test.ts`):** o teste agora confere o nome exato do arquivo liberado, em vez do começo do caminho. Ganhou duas fixtures (`.tsx` e `.ts.bak`) e o bloco de mutação correspondente. Isso é isolamento entre escolas (regra 10), não a minha regra.
- **`conta-global.repository.ts:136`:** a justificativa do `@Unscoped` ficou mais longa. A conta é global e não guarda nota, IA nem dado do aluno.
- **`packages/core/src/estrutura/index.ts`:** `excluirSemReferencia` saiu do barril. Os únicos que a usam (`turma.repository.ts:14` e `disciplina.repository.ts:7`) importam direto de `./exclusao.js`, então nada quebra.
- **Documentos e `1_task.md`:** só texto, mutação e registro de revisões. Nenhum campo, tela ou prompt sugere nota em discursiva ou redação (D55). Nada mede o professor nem infere comportamento do aluno.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/.processo/ordens/1_task-diff-r3.diff
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/src/sessao/convite/convite.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/architecture.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/ciclo-de-vida/conta-global.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/estrutura/index.ts

## infra-guardian · 3ª rodada · APROVADO · 2026-11-03 17:12:32 · `tasks/prd-onboarding-por-convite/1_task.md`

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
Recomendações: nenhuma nova. As da 1ª rodada (o worker da planilha na fila de lote com limite por escola e transação curta; o `contaDoProfessor` sem exigir `travarEscola`, e o worker seguindo a ordem escola e depois conta) estão registradas na tabela de recomendações de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/1_task.md`, com destino na tarefa 4.0 (4.4). Confiro lá.

Nesta rodada não houve correção exigida a conferir. Auditei o diff da 3ª rodada e o que ele afeta, e nenhuma mudança altera o comportamento em produção:

- **`convidarConta`** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/src/sessao/convite/convite.service.ts:201`): agora recebe `{ contaId, nome }` num objeto só, no lugar de dois argumentos. As duas chamadas (`:227` e `:242`) foram atualizadas. A transação e a trava continuam as mesmas, então a concorrência não muda.
- **`excluirSemReferencia`**: saiu do barril `packages/core/src/estrutura/index.ts`. Hoje só `turma.repository.ts` e `disciplina.repository.ts` o usam, e importam direto de `./exclusao.js`. Ninguém importava pelo barril, então nada quebra.
- **`architecture.test.ts`**: a zona que é um arquivo agora é comparada por igualdade, e a que é pasta continua por prefixo. Há fixtures novas para `.tsx` e `.ts.bak` e um bloco de mutação. A cerca ficou mais rígida, e é só código de teste.
- **O resto**: o texto do `@Unscoped` em `conta-global.repository.ts:136` (só o texto mudou, o comportamento é o mesmo), comentários, documentação e o registro da tarefa.
