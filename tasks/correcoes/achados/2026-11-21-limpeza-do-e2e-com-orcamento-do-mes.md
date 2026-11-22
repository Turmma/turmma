# Achados das revisões — `tasks/correcoes/2026-11-21-limpeza-do-e2e-com-orcamento-do-mes.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-21 09:31:53 · `tasks/correcoes/2026-11-21-limpeza-do-e2e-com-orcamento-do-mes.md`

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
- `e2e/support/painel.ts:226-233`: o worker do ambiente pode gravar uma linha nova, um `job_registro` ou um `orcamento_ia_do_mes`, entre o fim de `apagarDadosDasEscolas` e o `delete from escola`. Isso já acontecia com a lista escrita à mão. Se o e2e voltar a falhar de vez em quando na FK, a correção é rodar a limpeza e o `delete` da escola numa transação, com `lock` da linha da escola antes de começar, ou repetir a limpeza uma vez quando a FK recusar.
- `e2e/support/painel.ts:193-201` e `tools/ci/painel-do-e2e.int.test.ts:57-63` repetem a mesma consulta ao catálogo. O teste poderia importar uma função única que lista as tabelas com FK para a escola. A cópia independente no teste tem um ganho: um erro na consulta da limpeza não passa despercebido. Mas, se as duas cópias divergirem, a conferência perde o sentido.
- O guarda de ciclo (`throw`) fica sem teste, como a própria tarefa declara. Vale anotar isso na retro, sem mais nada a fazer agora.

Esta tarefa só mexe em apoio de e2e e em teste de CI. A conexão vem sempre de `urlDoBancoDeTeste()`, então a limpeza nunca alcança o banco de produção. Cada `delete` filtra pelos ids das escolas que o próprio teste criou, e o teste confirma que a escola de fora do seed continua com as linhas dela. Nenhum teste chama provedor pago, e o código do produto não mudou.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-21 09:31:55 · `tasks/correcoes/2026-11-21-limpeza-do-e2e-com-orcamento-do-mes.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. Os dois arquivos que mudaram, `e2e/support/painel.ts` e `tools/ci/painel-do-e2e.int.test.ts`, só fazem `insert` em `conta`, `usuario`, `convite`, `rede`, `escola`, `uso_infra_diario`, `job_registro`, `expurgo_execucao`, `orcamento_ia_do_mes` e `sessao`. A nova `apagarDadosDasEscolas` só apaga linhas, e só das escolas sintéticas criadas pelo próprio teste. Todos com autor humano? Não se aplica, porque nada grava em `Nota`.

Decisão autônoma sobre aluno: ausente.

Aprovação registrada: ok. Nenhum fluxo de saída de IA foi criado ou alterado.

Supervisão do tutor: ok. O tutor não foi tocado.

Autonomia declarada e visível: sim, sem mudança. Nenhum agente foi tocado e nenhuma tela mudou.

Bloqueantes: nenhum.

O que conferi:
- **Fica fora do produto.** `e2e/support/painel.ts` só é importado por `e2e/` e pelo teste em `tools/ci/`. Nenhum código de `apps/` ou `packages/` usa esse arquivo, e o que a tarefa diz ("o produto não muda") confere com o diff.
- **Regra 70, itens 1 e 2a:** nenhum `insert` em `nota` nem campo de nota ou conceito para discursiva ou redação.
- **Itens 3 a 9:** a tarefa não chega a nenhum deles. Não há saída de IA, tutor, autonomia, auditoria, supervisão do aluno nem indicador de professor. A `sessao` que o teste cria serve só para provar a ordem das FKs, e o `orcamento_ia_do_mes` que ele insere é um retrato agregado da escola, sem dado de aluno ou de professor.

Recomendações:
1. A limpeza lê o catálogo e apaga toda tabela com FK para a escola. Se a auditoria (ou o registro de validação da D56) tiver FK para a escola, ela também é apagada. Isso não quebra a regra 70, porque são só as escolas sintéticas do teste. Mas, se um dia a auditoria ficar só de acréscimo (com trigger que recusa `delete`), a limpeza vai falhar de forma visível. Vale um comentário em `apagarDadosDasEscolas` dizendo que isso é esperado e se resolve ali, para ninguém relaxar a trava da auditoria só para o e2e passar.
2. O guarda de ciclo (o `throw`) está sem teste, e a tarefa explica por quê. Fica registrado para a retro, não bloqueia.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-21 09:31:57 · `tasks/correcoes/2026-11-21-limpeza-do-e2e-com-orcamento-do-mes.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo. A mudança fica toda em suporte de teste: `e2e/support/painel.ts` e `tools/ci/painel-do-e2e.int.test.ts`. O teste grava três linhas sintéticas: uma em `orcamento_ia_do_mes`, só com contagens e teto, sem dado de pessoa; uma em `sessao`, com `refresh_hash` aleatório e um usuário do seed sintético; e uma em `job_registro`/`expurgo_execucao`, como antes. Não há migration nem mudança de schema, e o produto não muda.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: não se aplica, porque não há rota nem endpoint novo. A exclusão vale só para os ids de escola que o próprio teste semeou (`= any($1::uuid[])`). O teste também confere que a escola de fora do seed continua com suas linhas (`job_registro`, `expurgo_execucao`, `orcamento_ia_do_mes`). Isso prova que a limpeza não passa para outra escola, e a mutação `or true` cobre esse caso.

Logs: limpos. Nenhum log foi adicionado. A mensagem do `throw` em caso de ciclo leva só nomes de tabela.

Auditoria: não se aplica. A limpeza pode apagar linhas de auditoria, mas só de escolas sintéticas, no banco do compose de teste. A conexão sai de `urlDoBancoDeTeste()` (`tools/ci/compose.ts:327`), que aponta para `127.0.0.1` na porta do ambiente de teste. Não é ação do produto e não tem caminho até produção.

Envio externo: nenhum.

Seed/fixture: sintético. Os nomes são "Escola sintética do painel…", "Coordenadora sintética…", e os UUIDs e hashes são aleatórios.

Bloqueantes: nenhum.

Recomendações:
- `apagarDadosDasEscolas` (`e2e/support/painel.ts:193`) apaga tudo de uma escola, em todas as tabelas com FK para ela, auditoria inclusive. Hoje recebe um `Client` qualquer. Vale um comentário dizendo que é só para banco de teste, ou um guarda que recuse um banco cujo nome não seja o do teste, para ninguém reaproveitá-la num script de manutenção contra um banco real. Um script desses passaria por cima da exclusão lógica e auditada (regra 20, item 15).
- A consulta ao catálogo aparece duas vezes, igual, em `painel.ts` e em `tabelasComLinhaDeEscola` no teste. Ter as duas mantém a conferência independente, o que é bom. Mas se a de `painel.ts` um dia mudar de critério, por exemplo passando a incluir FK composta, a do teste precisa mudar junto.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-21 09:31:59 · `tasks/correcoes/2026-11-21-limpeza-do-e2e-com-orcamento-do-mes.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nem migration. A tarefa só lê do catálogo do Postgres (`pg_constraint`) as tabelas com FK para `escola`, que hoje são 52, incluindo `orcamento_ia_do_mes`, `job_registro`, `expurgo_execucao`, `usuario`, `convite`, `sessao` e `uso_infra_diario`.

Queries verificadas:
- `e2e/support/painel.ts`: o `delete` dinâmico em `apagarDadosDasEscolas` (linhas 193 a 224) filtra sempre pela coluna da FK com `= any($1::uuid[])`, e os ids das escolas vêm do seed do próprio teste. A tarefa não cria repository nem endpoint, e nada chega do cliente. O código só é importado por `e2e/*.spec.ts` e `tools/ci/painel-do-e2e.int.test.ts`, conecta só pelo `urlDoBancoDeTeste()` e não entra no código de produção.
- `removerPainel` (linha 229) e `removerEscolaSemConvite` (linha 297) chamam o apagador antes de apagar `conta`, `escola` e `rede`.
- `tools/ci/painel-do-e2e.int.test.ts`: `tabelasComLinhaDeEscola` e `contar` fazem leituras de conferência filtradas pelos ids dados.

Teste de isolamento: presente e efetivo. Se o filtro de escola do `delete` sair (a mutação `or true`), as linhas da escola de fora do seed somem e as asserções `contar(..., [foraDoSeed.escolaId])).toBe(1)` quebram. Se a chamada sair, ou a ordem de dependência se inverter, a FK quebra e `tabelasComLinhaDeEscola` acusa. Os itens 4 a 8 do checklist (UUID, 404 igual a 403, camada de rede só com agregado, `@Unscoped()`) não se aplicam: a tarefa não cria endpoint, id nem consulta da rede, e não há `@Unscoped()`.

Bloqueantes: nenhum.

Recomendações:
- `e2e/support/painel.ts:208`: se uma tabela tiver duas FKs de coluna única para `escola`, o `Map` `colunaDe` guarda só a última coluna. As linhas presas pela outra coluna ficam, e o `delete from escola` falha alto. A limpeza não apaga nada a mais, mas vale registrar o caso no comentário ou agrupar as colunas por tabela.
- `e2e/support/painel.ts:193` e `tools/ci/painel-do-e2e.int.test.ts`: a consulta ao catálogo está duplicada no apagador e no `tabelasComLinhaDeEscola`. A conferência continua independente do apagador, mas as duas mudariam juntas se o filtro do catálogo mudasse. Um comentário dizendo que a duplicação é intencional evita que alguém as una.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-21 09:32:24 · `tasks/correcoes/2026-11-21-limpeza-do-e2e-com-orcamento-do-mes.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. É uma correção de suporte do e2e e não muda arquitetura nem produto. Mudaram só `e2e/support/painel.ts` e `tools/ci/painel-do-e2e.int.test.ts`, como o documento diz.

Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo).

Bloqueantes: nenhum

Fui ao catálogo do banco de teste para ver se o que a correção deixa de fora pode morder hoje:
- Nenhuma tabela tem duas FKs para `escola`, e não há FK composta para `escola`.
- Nenhuma tabela de fora do conjunto aponta para uma de dentro.
- As FKs de uma tabela para ela mesma (`artefato`, `material`) são `no action` ou `set null`, e o `delete` de uma instrução só as resolve.

Recomendações:
1. `e2e/support/painel.ts:201`: `new Map(doEscopo.map(...))` guarda uma coluna só por tabela. Se um dia uma tabela tiver duas FKs para `escola`, as linhas da outra coluna ficam para trás. A limpeza então cai alto no `delete from escola`, sem apagar nada a mais. Vale lançar erro explícito quando a mesma tabela aparecer duas vezes, ou filtrar por todas as colunas.
2. `tools/ci/painel-do-e2e.int.test.ts:57-71`: `tabelasComLinhaDeEscola` repete a mesma consulta ao catálogo da implementação, com o mesmo filtro `cardinality(con.conkey) = 1`. Se esse filtro estiver errado, os dois erram juntos. Contar as FKs para `escola` sem o filtro e conferir o total daria uma conferência independente.
3. O documento da correção (seção Causa) fala em 52 FKs para `escola`; o banco de teste de hoje tem 53. Só o texto.
4. Fora desta tarefa, apareceram durante a revisão dois arquivos que não estão na lista do prompt: `tasks/correcoes/achados/indice.md` (modificado) e `tasks/correcoes/achados/2026-11-21-limpeza-do-e2e-com-orcamento-do-mes.md` (novo). Pelo jeito são de outro agente rodando ao mesmo tempo. Não os auditei. Confira se entram no mesmo commit.

Arquivos auditados:
- e2e/support/painel.ts
- tools/ci/painel-do-e2e.int.test.ts
- tasks/correcoes/2026-11-21-limpeza-do-e2e-com-orcamento-do-mes.md

## test-engineer · 1ª rodada · APROVADO · 2026-11-21 09:33:31 · `tasks/correcoes/2026-11-21-limpeza-do-e2e-com-orcamento-do-mes.md`

VEREDITO: APROVADO

**Cenários exigidos:**
1. **Caminho feliz:** a limpeza apaga a linha de `orcamento_ia_do_mes` que a rotina grava, e a escola sai sem violar a chave estrangeira. O caso testado é o do sintoma do `operacao-uso.spec.ts`.
2. **Tabela nova que ninguém pôs na lista:** depois da limpeza, nenhuma tabela com FK para a escola, lida do catálogo, ainda guarda linha das escolas removidas.
3. **Ordem de dependência:** uma tabela do conjunto aponta para outra do conjunto (`sessao` e `convite` para `usuario`), e a filha precisa sair antes da mãe.
4. **Tabela que aponta para si mesma:** `artefato` e `material` têm FK composta para a própria tabela. Elas não podem travar a ordenação.
5. **Isolamento:** as linhas de uma escola de fora do seed continuam no banco.
6. **Ciclo entre as tabelas:** a limpeza falha alto, em vez de ficar presa num laço sem fim.
7. **Permissão:** não se aplica. É código de apoio do e2e e não tem usuário nem rota.
8. **Concorrência:** o worker do ambiente grava na escola entre a limpeza e o `delete from escola`. A corrida já existia antes; ver recomendações.

**Cobertos:**
- **1:** `tools/ci/painel-do-e2e.int.test.ts`, nos dois casos ("removerPainel apaga as escolas semeadas…" e "removerEscolaSemConvite apaga a escola…"). Cada um conta `orcamento_ia_do_mes` antes da limpeza (2 e 1) e espera 0 depois. Rodei o arquivo aqui e ele passou, 2 de 2.
- **2:** `tabelasComLinhaDeEscola`, nos dois casos, com `toEqual([])`. A conferência percorre as linhas do catálogo uma a uma, e não o `Map` da implementação. Por isso uma tabela com duas FKs para a escola também seria vista.
- **3:** a `sessao` semeada no primeiro caso, mais o `convite` do seed. A mutação que inverte o sentido (`aindaApontam.get(filha)`) cai nessas duas FKs.
- **4:** coberto sem bloco declarado. Conferi nas migrations `0022` e `0023` que `artefato` e `material` têm FK para si mesmos. Se a cláusula `filha.oid <> mae.oid` sair, as duas nunca ficam livres e a função lança o erro de ciclo nos dois casos, mesmo com zero linhas, porque ela percorre o conjunto inteiro.
- **5:** as contagens da escola `foraDoSeed` em `job_registro`, `expurgo_execucao` e `orcamento_ia_do_mes`, que precisam continuar em 1. A mutação `or true` no filtro do `delete` cai aqui.
- **As quatro mutações** chegam à cláusula pelo motivo certo:
  - sem `apagarDadosDasEscolas` em `removerPainel`, o `delete from escola` viola a FK;
  - o mesmo em `removerEscolaSemConvite`;
  - o `or true` apaga as linhas da escola de fora do seed;
  - o sentido invertido derruba a ordem entre `sessao` e `usuario`.
- **Resto da auditoria:**
  - não há `.skip`, teste comentado nem mock: é Postgres real do compose de teste;
  - não há IA no caminho;
  - as asserções são sobre o resultado no banco, e não sobre o código ter rodado.
- **Conferências que fiz nas migrations:**
  - todas as FKs para `escola` são de coluna única, então o filtro `cardinality(con.conkey) = 1` não deixa nada de fora hoje;
  - nenhuma tabela tem duas FKs para a escola;
  - não há gatilho que bloqueie `delete` nas tabelas do conjunto (`auditoria` e `pedido_titular` só têm gatilho de `insert` e `update`);
  - `comBanco` só conecta em `urlDoBancoDeTeste()`.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **O guarda de ciclo não tem bloco** (`e2e/support/painel.ts:216`, o `throw` quando nenhuma tabela está livre). Hoje é aceitável, porque é código de apoio do e2e e o documento justifica. Mas a justificativa ("pediria criar uma FK circular no banco de teste") exagera o custo. Em Postgres, criação de tabela vale dentro de transação: um caso pode abrir `begin`, criar duas tabelas com FK para `escola` e uma para a outra, esperar `apagarDadosDasEscolas` rejeitar com `/ciclo/` e dar `rollback`. Sem o guarda, a função entra em laço infinito, e o e2e acaba por estouro de prazo, não com erro claro. Vale para a retro.
2. **A cláusula `filha.oid <> mae.oid`** (`e2e/support/painel.ts:206`) está provada pelos casos atuais, por causa de `artefato` e `material`. Mas o documento não diz isso. Um bloco ou uma frase na seção "Mutações" deixaria o motivo escrito.
3. **O filtro `cardinality(con.conkey) = 1`** (`e2e/support/painel.ts:198`) é morto no catálogo de hoje: não existe FK composta para `escola`. Isso está declarado e não pede ação, mas `tabelasComLinhaDeEscola` repete o mesmo filtro. Se surgir uma FK composta para a escola, o teste e a implementação ficam cegos juntos, e só o `delete from escola` avisa.
4. **A corrida com o worker continua aberta.** O worker do ambiente pode gravar `job_registro` entre `apagarDadosDasEscolas` e o `delete from escola`, e a janela agora é um pouco maior: duas consultas ao catálogo mais 52 `delete`. Isso já existia e não foi esta correção que trouxe. Para fechar a janela: rodar a limpeza numa transação que comece com `select 1 from escola where id = any($1) for update`. Esse lock barra a gravação concorrente de linha com FK para a escola até o `commit`.
5. **Texto:** o nome do segundo caso ("…com o job e a linha de expurgo do worker, e só ela") e o do `describe` ("o que o worker grava") não falam do orçamento do mês nem da conferência pelo catálogo. Atualizar ajudaria a ler a falha na esteira.

Arquivos auditados:
- `e2e/support/painel.ts`
- `tools/ci/painel-do-e2e.int.test.ts`
- `tasks/correcoes/2026-11-21-limpeza-do-e2e-com-orcamento-do-mes.md`

## revisor-geral · 2ª rodada · APROVADO · 2026-11-21 09:50:22 · `tasks/correcoes/2026-11-21-limpeza-do-e2e-com-orcamento-do-mes.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. A correção não toca o produto: só `e2e/support/painel.ts`, o teste e o documento.

Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo).

Bloqueantes: nenhum.

As quatro recomendações que a Mesa mandou aplicar estão feitas:
- **Comentário de `apagarDadosDasEscolas`** (`e2e/support/painel.ts`, cerca da linha 192). Agora registra quatro coisas: a função é só para o banco de teste, a auditoria também é apagada, `colunaDe` guarda uma coluna por tabela, e a consulta ao catálogo se repete de propósito no teste.
- **52 para 53 no documento.** Contei no banco de teste e são 53 FKs de coluna única para `escola`.
- **Frase sobre `filha.oid <> mae.oid` em "Mutações".** A justificativa se confirma: `artefato` e `material` são as duas únicas tabelas com FK para si mesmas no catálogo (`artefato_origem_da_turma_fk`, `material_substitui_da_escola_fk`, `material_substituido_por_da_escola_fk`). Sem a cláusula, cada uma apontaria para si mesma, nunca ficaria livre e a limpeza cairia no `throw` do ciclo, que os casos atuais já pegam.
- **Nomes do `describe` e dos dois casos** (`tools/ci/painel-do-e2e.int.test.ts:15`, `:73` e `:104`). Os nomes batem com o que os casos conferem: a sessão em `:81-97` e a conferência pelo catálogo em `:98` e `:117`.

A tabela "Recomendações sem aplicar" registra cada recomendação restante da 1ª rodada, com o revisor e o destino ou o motivo da recusa.

Recomendações:
- O `describe` (`painel-do-e2e.int.test.ts:15`) e o nome do segundo caso (`:104`) ficaram longos. No segundo, "e nenhuma tabela com FK para ela guarda linha dela, e só ela" junta duas ideias com dois "e". Fica mais claro assim: "removerEscolaSemConvite apaga a escola e toda linha das tabelas com FK para ela, e só ela". É só texto.
- A contagem "53 no banco hoje" no documento vai envelhecer na próxima tabela com FK para `escola`. Não precisa mudar agora: o documento é retrato da correção.

## test-engineer · 2ª rodada · APROVADO · 2026-11-21 09:50:35 · `tasks/correcoes/2026-11-21-limpeza-do-e2e-com-orcamento-do-mes.md`

VEREDITO: APROVADO

**Cenários exigidos:** os mesmos da 1ª rodada, que não mudaram:
- **Caminho feliz:** `removerPainel` e `removerEscolaSemConvite` apagam a escola semeada e tudo o que o ambiente gravou nela.
- **Casos de borda:** a tabela nova com FK para `escola`, que ninguém lembrou de listar; a ordem entre tabelas com FK sem ação (`sessao` antes de `usuario`); as tabelas com FK para si mesmas (`artefato`, `material`).
- **Isolamento:** as linhas de uma escola de fora do seed continuam lá.
- **Permissão:** não se aplica, porque é código de suporte do e2e e não toca o produto.

**Cobertos:** todos, como na 1ª rodada. Nesta rodada só mudaram os nomes dos testes, o comentário em `e2e/support/painel.ts` e o documento. Conferi o seguinte:
- **Nomes novos dos testes** (`tools/ci/painel-do-e2e.int.test.ts:15`, `:73`, `:104`): cada coisa que o nome promete tem asserção.
  - A sessão do primeiro caso: linhas 89 e 97.
  - A frase "nenhuma tabela com FK para ela guarda linha dela" do segundo caso: linha 117.
  - O orçamento do mês: linhas 96 e 116.
  - A escola de fora do seed intocada: linhas 99–101 e 118–120.
- **Blocos de mutação:** o campo `teste:` de cada um continua sendo o começo do nome novo ("removerPainel apaga as escolas semeadas", "removerEscolaSemConvite apaga a escola"). A troca de nome não deixou nenhum bloco apontando para um caso que não existe.
- **A frase nova da seção "Mutações"** sobre `filha.oid <> mae.oid` confere com o código:
  - a cláusula está em `e2e/support/painel.ts:220`;
  - `artefato` tem FK para si mesma (`packages/core/src/db/schema/artefato.ts:69-72`), e `material` tem duas (`packages/core/src/db/schema/material.ts:84-85`).

  Sem a cláusula, cada uma dessas tabelas ficaria esperando por ela mesma e a limpeza cairia no `throw` do ciclo. O teste de hoje já ficaria vermelho, então o argumento de que não precisa de bloco próprio vale.
- **A tabela "Recomendações sem aplicar"**: cada recomendação da 1ª rodada tem destino ou motivo. A conta "53 tabelas" é só texto e não muda nenhum comportamento.
- **Execução:** rodei `npx vitest run tools/ci/painel-do-e2e.int.test.ts` e os 2 casos passaram.
- **Proibidos e IA:** não há `.skip`, teste comentado nem mock da regra. Não há chamada de IA, nem concorrência nova a provar.

**Bloqueantes:** nenhum.

**Recomendações:**
- O nome do primeiro caso (`tools/ci/painel-do-e2e.int.test.ts:73`) não cita a conferência pelo catálogo, que ele também faz na linha 98. O segundo caso cita. Fica pela simetria, sem bloquear.
- Continuam valendo as recomendações da 1ª rodada que estão em "Recomendações sem aplicar". A que pesa mais para testes é o guarda de ciclo sem teste, já mandada para a retro.

Não alterei nenhum arquivo.
