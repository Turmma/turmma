# Achados das revisões — `tasks/correcoes/2026-11-28-encerrar-provas-explain-banco-acumulado.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-28 10:40:38 · `tasks/correcoes/2026-11-28-encerrar-provas-explain-banco-acumulado.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. A mudança só altera teste: o `beforeAll` grava em `ano_letivo` e o `afterAll` apaga o que gravou. Nada do diff escreve em `nota`, e não há caminho sem autor humano. Todos com autor humano? sim, porque não existe caminho novo.

Decisão autônoma sobre aluno: ausente. A rotina auditada encerra a prova quando o prazo vence, e o diff não mexe nela. Mexe só na conta do `EXPLAIN` dentro do teste.

Aprovação registrada: ok. Nenhuma saída de IA entra ou muda.

Supervisão do tutor: ok. O diff não toca no tutor.

Autonomia declarada e visível: sim. O diff não toca na governança nem na autonomia dos agentes.

Bloqueantes: nenhum.

O que conferi:
- O diff fica só em `apps/worker/test/encerrar-provas.int.test.ts`. Nenhum arquivo de `apps/*/src` ou `packages/*/src` muda, nem `docs/regulacao.md`. Isso bate com o "Sem mutação" da tarefa.
- O que o teste grava a mais são dois anos letivos sintéticos na escola A, um de 2098 e um de 2099. Não há dado de pessoa, nota, correção nem conteúdo de IA. A limpeza apaga pelos ids devolvidos e com `escola_id`, então não alcança outra escola nem dado acumulado de outras suítes.
- O teste não ficou mais fácil de passar. O limite `<= 1` e a exigência do índice da prova aberta continuam iguais. A conta agora só olha a tabela que o caso mede, e a tarefa mostra o teste falhando com a conta antiga, o que prova que ele pega o problema.
- Nenhum item da regra 70 é afetado: nota, discursiva e redação (D55), tutor, autonomia, auditoria e indicador de professor ficam como estavam.

Recomendações:
- A tarefa já registrou o que eu também vi: `apps/despachante/test/janela.int.test.ts:279` e `apps/despachante/test/slots.int.test.ts:554` têm a mesma conta sobre o plano inteiro. Isso não é da regra 70, mas convém confirmar que o item entrou no `TODO.md` como a tarefa diz.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-28 10:40:42 · `tasks/correcoes/2026-11-28-encerrar-provas-explain-banco-acumulado.md`

VEREDITO: APROVADO

A mudança mexe só no teste `apps/worker/test/encerrar-provas.int.test.ts`. Nenhum arquivo de `apps/*/src`, de `packages/*/src` ou de migration mudou. Não li o restante do arquivo de teste, porque o diff não o altera.

Campos pessoais tocados: nenhum. O teste grava só `ano_letivo` (escola, ano, início, fim, situação), e o schema dessa tabela (`packages/core/src/db/schema/ano-letivo.ts:19`) declara "Sem dado de pessoa".
Fora da tabela de dados do docs/lgpd.md: nada, porque não há campo novo.
Autorização por objeto: não se aplica, porque não há rota nem DTO novo. O `insert` usa o `escolaId` da escola A da própria fixture, e a limpeza do `afterAll` apaga filtrando por `escola_id` e pelos ids que o `insert` devolveu. Não alcança linha de outra escola.
Logs: limpos. O diff não acrescenta nenhum `console` nem logger.
Auditoria: não se aplica. Não há leitura de dado de aluno, exportação, mudança de nota ou de permissão, nem aprovação de saída de IA.
Envio externo: nenhum.
Seed/fixture: sintético. São dois anos letivos fictícios, 2099 `planejado` e 2098 `encerrado`, criados e apagados dentro do bloco do teste. Não entra nome, matrícula, resposta nem nota.
Bloqueantes: nenhum.
Recomendações:
- O `beforeAll` grava os anos 2099 e 2098, e a tabela não aceita repetir o mesmo ano na mesma escola (`ano_letivo_escola_ano_unico`). Se uma execução morrer antes do `afterAll`, a seguinte no mesmo banco acumulado falha na chave única. Isso não vaza dado, mas a falha passa a depender do banco de novo, que é justamente o que a correção quer evitar. Há duas saídas simples: apagar esses dois anos da escola A antes de gravar, ou usar `on conflict do nothing` com `returning`. Fica para o `test-engineer` e o `infra-guardian`.
- O autor já aponta que `apps/despachante/test/janela.int.test.ts:279` e `apps/despachante/test/slots.int.test.ts:554` somam as linhas descartadas do plano inteiro, como o teste corrigido aqui fazia. É o mesmo problema, não é questão de privacidade, e o destino proposto é o `TODO.md`.

Pergunta de fechamento: esta tarefa não muda o que o sistema guarda sobre um aluno nem para onde isso é enviado. A resposta à secretaria continua a mesma de antes.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-28 10:40:50 · `tasks/correcoes/2026-11-28-encerrar-provas-explain-banco-acumulado.md`

VEREDITO: APROVADO

Tabelas verificadas: `ano_letivo`. É a única tabela que a mudança toca. Ela tem `escolaId`, id UUID (`uuidv7()`) e `unique (escola_id, ano)`. A escola A é criada nova a cada execução do arquivo (`apps/worker/test/encerrar-provas.int.test.ts:126`), então os anos 2098 e 2099 não batem com a unicidade. Também não batem com o `max(ano) + 1` do caso de `:836`, que roda antes e desfaz o que fez. A mudança não cria tabela, migration nem índice.

Queries verificadas:
- O `insert into ano_letivo` do `beforeAll` usa `escola_id = $1` com o id da escola A. O `planejado` e o `encerrado` não ferem o índice único parcial de `em_curso`.
- O `delete` do `afterAll` filtra por `escola_id = $1 and id = any($2::uuid[])` e só alcança os ids que o próprio `insert` devolveu.
- Nenhum repository de `apps/*/src` ou de `packages/*/src` muda. O escopo de `ProvasVencidasRepository`, `EncerramentoDaProvaRepository` e `QuedasDaApiRepository` continua como estava. A leitura global sem escopo (`escolasComProvaVencida`) segue limitada ao id da escola, e o teste de `:832` confere isso.
- Nenhum endpoint muda, e nenhum passa a aceitar `escolaId` do cliente.

Teste de isolamento: presente e efetivo. A correção não cria nem altera teste de isolamento. Os casos que já existem (escola A e escola B, ano em curso por escola, a prova do ano encerrado que não entra) continuam como estavam. A mudança em `removidasNoFiltro` só deixa de somar o descarte de `ano_letivo`, que não fazia parte da medição. Ela não afrouxa nenhuma checagem de escopo. Cada chamada exige o índice da própria tabela com `toContain` antes de contar, então um nó ausente não passa vazio.

Bloqueantes: nenhum.

Recomendações:
- `apps/despachante/test/janela.int.test.ts:279` e `apps/despachante/test/slots.int.test.ts:554` usam a mesma soma de todos os nós do plano. A própria tarefa já registrou isso para o `TODO.md`, e confirmo que vale fazer.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-28 10:40:55 · `tasks/correcoes/2026-11-28-encerrar-provas-explain-banco-acumulado.md`

VEREDITO: APROVADO

Escopo: respeitado. A correção mexe só em `apps/worker/test/encerrar-provas.int.test.ts`. Nenhum arquivo de `apps/*/src` ou `packages/*/src` mudou, nem migration ou índice, como o documento declara.

Aderência à Tech Spec: ok. A correção é só de teste e não diverge da arquitetura. O limite `<= 1` e o `toContain` do índice ficaram como estavam, então o que o teste exige não ficou mais fraco.

Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo).

Bloqueantes: nenhum.

O que conferi para chegar ao veredito:
- **Os dois anos plantados não batem em restrição.** Na escola A, o `planejado` (2099) e o `encerrado` (2098) não colidem com `ano_letivo_escola_ano_unico`. A escola A nasce no `beforeAll` do arquivo. O caso de `:841`, que soma `max(ano) + 1`, roda antes deste bloco e apaga o que criou. Nenhum dos dois anos é `em_curso`, então `ano_letivo_um_em_curso_por_escola` também não é tocado.
- **A limpeza está no escopo certo.** O `afterAll` apaga pelos ids devolvidos e com `escola_id`. Nada referencia esses anos, então não sobra chave estrangeira presa.
- **Filtrar por tabela não deixa o teste passar sem medir nada.** O nó que tem o índice da prova aberta é `Index Scan` ou `Bitmap Heap Scan` em `atividade_aplicada`, e os dois trazem `Relation Name` igual ao nome real da tabela, não ao apelido da consulta. O `toContain` logo acima exige que esse nó exista. As outras três chamadas (`extensao_de_tempo`, `indisponibilidade` e a consulta da escola) seguem a mesma lógica.

Recomendações:
1. O documento manda as duas somas iguais em `apps/despachante/test/janela.int.test.ts:279` e `apps/despachante/test/slots.int.test.ts:554` para o `TODO.md`, mas o `TODO.md` não mudou nesta árvore. Quem fecha a rodada precisa registrar, senão a recomendação se perde. A correção irmã, `2026-11-28-extensao-explain-banco-acumulado`, deixou o mesmo destino sem gravar.
2. O comentário novo do `beforeAll` (por volta de `encerrar-provas.int.test.ts:950`) e o JSDoc de `removidasNoFiltro` (`:37-40`) repetem quase o mesmo texto. Basta um dos dois explicar por que se filtra por tabela.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-28 10:41:11 · `tasks/correcoes/2026-11-28-encerrar-provas-explain-banco-acumulado.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum (a mudança está só no teste da rotina de prova; nenhum arquivo de `apps/*/src` nem de `packages/*/src` mudou)
Rate limit: não se aplica
Fila e prioridade: não se aplica
Concorrência: protegida. O teste novo grava os anos 2099 `planejado` e 2098 `encerrado` na escola A. Essa escola é criada de novo a cada execução (`encerrar-provas.int.test.ts:126`), então o `unique (escola_id, ano)` e o `ano_letivo_um_em_curso_por_escola` não colidem, nem no banco acumulado. O caso de `:841` roda antes desse bloco, e o `max(ano) + 1` dele não vê esses anos.
Índice e paginação: ok. O `toContain` dos quatro índices continua, e o limite `<= 1` também. A conta agora olha só a tabela que o caso mede. Se o nó da tabela sumisse, a soma daria zero sem acusar nada, mas o `toContain` do índice dessa mesma tabela exige que o nó exista. Rodei o bloco `EXPLAIN` neste andar e os 2 casos passaram.
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: não se aplica
Bloqueantes: nenhum
Recomendações:
- O documento manda para o `TODO.md` a recomendação sobre `apps/despachante/test/janela.int.test.ts:279` e `apps/despachante/test/slots.int.test.ts:554`, que somam `Rows Removed by Filter` de todos os nós, do mesmo jeito que esta correção tirou daqui. A entrada ainda não está no `TODO.md` e precisa ser escrita, senão a recomendação some.
- O `afterAll` apaga os dois anos por id. Se o `insert` do `beforeAll` falhar no meio, nada fica para apagar, e isso não é um problema. Se o arquivo quebrar entre o `insert` e o `afterAll`, os dois anos ficam no banco, mligados a uma escola descartável. Isso não quebra a execução seguinte.

Arquivos:
- `apps/worker/test/encerrar-provas.int.test.ts`
- `tasks/correcoes/2026-11-28-encerrar-provas-explain-banco-acumulado.md`

## test-engineer · 1ª rodada · APROVADO · 2026-11-28 10:41:23 · `tasks/correcoes/2026-11-28-encerrar-provas-explain-banco-acumulado.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- **Caminho feliz:** a consulta global das escolas com prova vencida e a lista de uma escola descem pelo índice `atividade_aplicada_prova_aberta_idx`, e o filtro descarta no máximo 1 linha de `atividade_aplicada`. O mesmo vale para as extensões de tempo e para as quedas, cada uma na sua tabela.
- **Borda do ambiente (regra 40, "o teste precisa passar nos três"):** o banco acumulado tem anos `encerrado` e `planejado`, deixados pelo caso da linha 841 (virada de ano dentro do arquivo) e por outras suítes. O banco novo só tem `em_curso`. O caso tem de dar o mesmo resultado nos dois.
- **Borda da prova:** o filtro por tabela não pode passar vazio. Se o nó da tabela medida não existir, o caso tem de falhar.
- **Isolamento e permissão:** não se aplicam. Só o teste muda. As linhas plantadas são da escola A, criada na execução, e saem pelos ids que o `returning` devolveu.

**Cobertos:**
- **O caso da tabela da tarefa existe com o nome citado** (`encerrar-provas.int.test.ts:971`) e o rodei. O bloco "os índices da rotina" deu 2 de 2 verdes sobre o banco acumulado deste andar.
- **A falha deixou de depender do banco.** O `beforeAll` (`:952-958`) planta na escola A um ano `planejado` (2099) e um `encerrado` (2098) e roda `analyze ano_letivo`. Com isso, voltar à soma antiga, que conta todos os nós do plano, deixa o caso vermelho em qualquer banco. O documento registra esse vermelho em `:976`.
- **A prova não afrouxou.** O limite `<= 1` e o `toContain` do índice ficaram como estavam. `Relation Name` aparece no Index Scan e no Bitmap Heap Scan; o Bitmap Index Scan não tem filtro, então nada se perde. O `toContain` logo acima exige que o nó da tabela medida exista, então o filtro não passa vazio. O `explicar` usa `analyze`, então `Rows Removed by Filter` é real.
- **A limpeza não mexe em nada além do plantado.** O `afterAll` (`:968`) apaga só esses ids, presos pela escola. Nenhum caso depois do bloco lê o ano da escola A.
- **O resto do checklist está limpo:**
  - Nada mudou em `apps/*/src` nem em `packages/*/src`, então a linha "Sem mutação" vale.
  - Não há `.skip`, teste comentado nem mock.
  - Não há IA nem concorrência envolvidas.

Bloqueantes: nenhum.

**Recomendações:**
1. Os anos plantados provam a função auxiliar do teste, não o código de produção. O documento já diz isso. Vale também um comentário curto em `:36-41` explicando por que o filtro por tabela não pode voltar à soma de todos os nós, para quem mexer no arquivo depois.
2. Em plano com Nested Loop, `Rows Removed by Filter` do lado interno é média por iteração. Com várias iterações, a média pode esconder descarte real. Isso já existia antes desta correção e hoje não aparece porque o plano medido não tem esse formato. Se a consulta global ganhar junção que ponha `atividade_aplicada` do lado interno, a conta passa a ser `Rows Removed by Filter * Actual Loops`.
3. `apps/despachante/test/janela.int.test.ts:279` e `apps/despachante/test/slots.int.test.ts:554` são da mesma classe: também somam o descarte de todos os nós do plano. A tarefa já os registra com destino `TODO.md`; confira se a linha entrou lá.

Arquivos auditados:
- `apps/worker/test/encerrar-provas.int.test.ts`
- `tasks/correcoes/2026-11-28-encerrar-provas-explain-banco-acumulado.md`

## revisor-geral · 2ª rodada · APROVADO · 2026-11-28 11:06:53 · `tasks/correcoes/2026-11-28-encerrar-provas-explain-banco-acumulado.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok (a correção só mexe em teste e em registro, e não muda nenhuma arquitetura)
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum
Recomendações:
- As duas recomendações da 1ª rodada foram feitas:
  - **Comentário:** o porquê agora fica só no JSDoc de `removidasNoFiltro`, em `apps/worker/test/encerrar-provas.int.test.ts:36-40`. O `beforeAll`, na linha 951, tem uma linha só, que aponta para o JSDoc.
  - **Entrada no `TODO.md`:** já está gravada, cobre o despachante (`janela.int.test.ts:279` e `slots.int.test.ts:554`) e traz a observação do test-engineer sobre `Rows Removed by Filter * Actual Loops` em Nested Loop.
- Recomendação de texto, que não bloqueia: o JSDoc de `removidasNoFiltro` ficou com três linhas longas e mistura duas coisas. Uma é o que a função faz. A outra é por que o `beforeAll` planta os anos, e essa explica o desenho do teste, não a função. Dá para encurtar a segunda frase para "o `beforeAll` dos índices planta os anos que provam isso no banco novo".
