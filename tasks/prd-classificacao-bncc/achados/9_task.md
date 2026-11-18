# Achados das revisões — `tasks/prd-classificacao-bncc/9_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-18 13:21:33 · `tasks/prd-classificacao-bncc/9_task.md`

VEREDITO: APROVADO

Esta tarefa não toca nenhuma superfície da regra 70. A 9.0 cuida da licença do material didático: a migration `0065_contracao_da_f4`, o check `material_terceiro_tem_licenca`, a saída de `material.licenciante` do schema e da API, e os testes e documentos que acompanham. O diff não inclui nada de `Nota`, correção, tutor, agentes, saída de IA nem indicador de professor. `docs/regulacao.md` não mudou, e a classificação BNCC (`secao_do_material`, que é saída de IA) não entra na migration.

Caminhos de escrita em Nota: nenhum nesta tarefa. A migration escreve só em `material_serie`, `licenca_de_material` e `material.licenca_id`, e o código altera só o envio e a edição de material. Todos com autor humano? Não se aplica, porque nenhum caminho novo ou alterado grava em `Nota`.

Decisão autônoma sobre aluno: ausente.

Aprovação registrada: ok. Nenhum fluxo de saída de IA foi criado ou alterado. A licença criada pela própria migration, com a referência "registrada na contração da F4" e sem `registrada_por`, é dado administrativo de direito autoral, não saída de IA que chega ao aluno. O mesmo padrão já existia na `0053`.

Supervisão do tutor: ok, sem mudança.

Autonomia declarada e visível: sim, sem mudança. A tarefa não mexe em agente nem em governança.

Bloqueantes: nenhum.

Recomendações: nenhuma da regra 70. O que esta tarefa precisa de revisão é do `tenancy-guardian` (a junção por `escola_id` no backfill e as FKs compostas), do `privacy-guardian` (o licenciante pode ser pessoa e continua fora do arquivo do titular enquanto a coluna existir) e do `infra-guardian` (o `lock_timeout`, o `VALIDATE` debaixo de `ACCESS EXCLUSIVE` e a volta para antes da F4 no runbook). São os três subagentes obrigatórios que a tarefa já lista.

Arquivos lidos:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/tasks/prd-classificacao-bncc/9_task.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/packages/core/drizzle/0065_contracao_da_f4.sql`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/packages/core/src/db/schema/material.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/src/material/material.service.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/src/material/material.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/src/material/licenca.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/packages/core/src/db/schema/mvp/mvp-tables.int.test.ts`

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-18 13:21:39 · `tasks/prd-classificacao-bncc/9_task.md`

VEREDITO: APROVADO

**Tabelas verificadas:**
- `material`: perdeu a coluna `licenciante` no schema Drizzle e ganhou o check `material_terceiro_tem_licenca`.
- `licenca_de_material`: recebe as licenças que o backfill cria e entrou no catálogo de `mvp-tables.int.test.ts`.
- `material_serie`: o backfill das séries grava nela.

Nenhuma tabela nova. As três já têm `escola_id`. `material` não varia por ano letivo, então não precisa de `anoLetivoId`. Todos os ids continuam UUID.

**Queries verificadas:**
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/src/material/material.repository.ts:122-144`: a subconsulta nova `doLicenciante` busca a licença por `escola_id = material.escola_id` e por `id = material.licenca_id`. Ela só roda dentro de `select(colunas)` (linhas 369 e 402), que já filtram por `eq(material.escolaId, requireEscolaId())`.
- `inserir` (linha 272): a escola vem de `requireEscolaId()`, nunca do pedido.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/src/material/material.service.ts:287,362`: o licenciante da resposta vem da licença lida dentro da transação, que já é da escola do token. O mascaramento para quem não é coordenação (linha 157) não mudou.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/packages/core/drizzle/0065_contracao_da_f4.sql`:
  - o backfill das séries junta por `serie.escola_id = lote.escola_id`;
  - a criação de licenças agrupa por `(escola_id, licenciante)` e o `NOT EXISTS` compara pela escola;
  - o `UPDATE` só liga o material à licença escolhida da mesma escola.
  
  Se qualquer uma dessas comparações por escola sair, as FKs compostas recusam a linha, ou o `VALIDATE` falha porque a escola B ficaria sem licença. Nos dois casos a migration cai inteira.
- Bloco 1 do runbook (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/docs/runbook.md`): é rotina administrativa nossa, cobre todas as escolas e também junta por `l.escola_id = m.escola_id`.
- O envio continua recusando `escolaId` no corpo com `ENTRADA_INVALIDA`; o caso `comEscola` de `material.int.test.ts` mantém essa prova.
- Nenhum `@Unscoped()` novo. Nada da camada rede foi tocado.

**Teste de isolamento:** presente e efetivo.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/packages/core/src/db/contracao-da-f4.int.test.ts`, caso "não cruza escola": a escola B tem o mesmo licenciante que A já registrou, e o teste exige que B receba uma licença própria. Ele também conta materiais e séries ligados a outra escola e exige zero. Tirar a comparação por escola faz a migration do `beforeAll` cair, e o arquivo inteiro fica vermelho.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/test/material.int.test.ts`: o caso novo renomeia a coluna `licenciante` no banco e confere que o professor continua recebendo `licenciante: null`.

**Bloqueantes:** nenhum.

**Recomendações:**
- Para mexer quando houver tempo: a falha de isolamento no `UPDATE` da `0065` só aparece como migration que não carrega, não como um caso de teste com nome. A tarefa registra isso nas mutações. Um caso em que A e B já tenham cada uma a sua licença do mesmo licenciante, antes da migration, daria um vermelho com nome em vez de erro de carga.
- Opcional: a subconsulta `doLicenciante` repete `escola_id` embora `licenca_id` sozinho já identifique a licença. É defesa em profundidade; vale um comentário dizendo que não é sobra, como já existe para `dasSeries`.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-18 13:22:17 · `tasks/prd-classificacao-bncc/9_task.md`

VEREDITO: APROVADO
Caminho quente tocado: migration
Rate limit: ok (nenhum endpoint, limite ou bloqueio novo)
Fila e prioridade: ok (o envio continua pedindo a extração pela fila `pdf` com `enfileirarUmaVez`, e nada novo roda no request)
Concorrência: protegida. A regra "terceiro tem licença, e só ele" agora fica no banco, no check `material_terceiro_tem_licenca`. A licença continua lida `for share` e o alvo da edição `for update` dentro da transação.
Índice e paginação: ok. O subselect `doLicenciante` em `apps/api/src/material/material.repository.ts:125` busca por `(escola_id, id)`, que está coberto pelo `licenca_de_material_escola_id_unico`. Nenhuma listagem nova foi criada.
Degradação de IA: não se aplica
Migration: compatível
- O código anterior (o da F4, de 5.0 a 8.0) grava `licenca_id` e `licenciante` juntos no material de terceiro, e nenhum dos dois no material próprio. O check novo aceita as duas coisas.
- Os dois checks de `licenciante` saem na mesma migration, então o código novo pode gravar o terceiro sem `licenciante`.
- A coluna fica no banco até o `DROP` do deploy seguinte, que está registrado no `TODO.md`.
- O backfill roda em lotes de 5.000, é idempotente, junta por `escola_id` e roda com `lock_timeout` de 5 s.
- O `ACCESS EXCLUSIVE` com `VALIDATE` na mesma transação é aceitável hoje: `material` tem dezenas de linhas por escola e o deploy roda fora do horário letivo. A própria migration registra quando o `VALIDATE` deve ir para uma migration à parte.
- O snapshot `0065_snapshot.json` não tem mais a coluna e tem o check novo.
- Rodei `contracao-da-f4.int.test.ts` e `volta-da-f4.int.test.ts`: 15 de 15 testes passaram.
Métrica e alerta: ok (nenhum código novo no caminho quente e nenhum alerta novo)
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/docs/runbook.md`, seção "Voltar o código depois da F4": o texto diz que voltar para o código da F4 anterior à 9.0 não exige passo nenhum. Nesse caso nada quebra, mas o código anterior lê `material.licenciante`. Todo material de terceiro enviado depois da 9.0 aparece para a coordenação sem o nome do licenciante até o roll-forward. Vale indicar o `update material ... set licenciante = l.licenciante` do bloco 1 também para essa volta.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/packages/core/drizzle/0065_contracao_da_f4.sql`: o backfill de séries dá todas as séries da escola a qualquer material sem `material_serie`. Isso inclui um material que tenha perdido as séries depois por exclusão de série, se essa exclusão apagar em cascata. Vale confirmar que esse estado não existe por outro caminho. A `0055` tem o mesmo comportamento.
- O `SET LOCAL lock_timeout = '5s'` continua valendo para as migrations seguintes no mesmo `migrar`, o que o comentário já registra. Quando o `VALIDATE` for para uma migration à parte, vale resetar o `lock_timeout` no fim.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-18 13:22:32 · `tasks/prd-classificacao-bncc/9_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: o licenciante. É o nome do dono do direito e pode ser o de uma pessoa. Ele sai da leitura e da gravação de `material.licenciante` e passa a vir só de `licenca_de_material.licenciante`. A `0065` cria novas licenças com o licenciante que estava na linha do material, e `registrada_por` fica nulo nelas. Nenhum dado de aluno é tocado.

Fora da tabela de dados do docs/lgpd.md: nenhum. As duas linhas estão lá, "Material da escola" (atualizada nesta tarefa) e "Licença de material", com finalidade e retenção. Nenhum campo é proibido para aluno.

Autorização por objeto: ok.
- O `doLicenciante` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/src/material/material.repository.ts:125` busca a licença pela escola da própria linha e pelo `licenca_id`. A FK composta garante que é a mesma escola.
- O DTO (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/src/material/material.service.ts:157`) continua zerando o licenciante quando o alcance não é `unidade`. O caso novo de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/test/material.int.test.ts:281` mostra que o professor recebe `null` mesmo com a coluna renomeada.
- O envio e a edição respondem com `'unidade'`, e as duas células são só da coordenação. Isso não mudou.
- A forma da resposta também não mudou: `contracts.test.ts` continua proibindo o licenciante nas `fontes` do artefato.

Logs: limpos. A migration não loga nada e o código não ganhou linha de log nova.

Auditoria: presente. A tarefa não cria ação que a regra 20, item 10 obrigue a auditar. A licença que a migration cria não passa pela API, como já acontecia na `0053`.

Envio externo: nenhum. Nada disto vai a provedor de IA.

Seed/fixture: sintético. São todos nomes de editora fictícios ("Editora X", "Editora Nova", "Editora Morta", "Editora Z", "Editora sintética"), em `contracao-da-f4.int.test.ts`, `material.int.test.ts`, `arquivo-do-titular.int.test.ts`, `e2e/support/material.ts` e nos demais.

Arquivo do titular: o licenciante continua fora dele. O `licenciante` segue no `fora` de `material` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/packages/core/src/titular/leitura-do-titular.ts:390` enquanto a coluna existir. O teste do arquivo do titular confere que nem o valor da coluna nem o da licença entram no arquivo.

Pergunta de fechamento: a tarefa não toca dado de aluno nem envio externo, e a resposta sobre o aluno segue a mesma. Não volta a aparecer dado de terceiro em lugar algum.

Bloqueantes: nenhum.

Recomendações:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/docs/lgpd.md:102`: a linha "Licença de material" só fala da licença criada pela migração com a referência "registrada antes da F4". Agora há mais duas origens: "registrada na contração da F4", da `0065`, e "registrada durante a volta do código", do bloco 2 do runbook. Vale citar as duas na mesma frase, para quem atende a escola saber de onde veio cada licença com `registrada_por` nulo.
2. Até o `DROP COLUMN`, a cópia antiga em `material.licenciante` fica no banco sem uso. Se a coordenação corrigir o licenciante na licença, o nome antigo continua na coluna do material. É temporário e está documentado, mas convém anotar isso na própria linha do `lgpd.md`. Também convém não deixar o `DROP COLUMN` do `TODO.md` passar do deploy seguinte, para a cópia não durar mais que a janela de volta.
3. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/test/material.int.test.ts:274`: o `rename column` mexe no banco de teste compartilhado. Se o processo morrer antes do `afterAll`, a coluna fica renomeada para os arquivos seguintes. Não é questão de LGPD; fica para o `test-engineer` avaliar.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-18 13:22:52 · `tasks/prd-classificacao-bncc/9_task.md`

**VEREDITO: APROVADO**

**Escopo:** respeitado. As subtarefas 9.1 a 9.5 estão feitas e a tarefa não entrou em trabalho futuro. O `DROP COLUMN` ficou no `TODO.md` e nenhuma tela foi alterada.

**Aderência à Tech Spec:** ok.
- O nome `0065_contracao_da_f4`, o check `material_terceiro_tem_licenca` e o passo extra da volta para antes da F4 estão registrados em `techspec.md` §3, item 3, no `cenarios.md` ("Contração da F4") e no `docs/runbook.md`.
- O `licenciante` continua no `fora` de `leitura-do-titular.ts`. Isso diverge só da lista de arquivos da tarefa, não da Tech Spec: a lista declara colunas excluídas e não lê nenhuma.
- O snapshot 0065 encadeia na 0064, não tem a coluna e tem o check novo. O teste "o schema do Drizzle e a migration dizem o mesmo check" amarra os dois.

**Portão local:** carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo).

**Bloqueantes:** nenhum.

**Recomendações:**
1. `docs/runbook.md:1153` (o parágrafo "A `0065` fecha esta volta…") diz que o código da F4 "volta sem passo nenhum". Isso vale para o código que ficou entre a 0056 e a 0064, que é a versão imediatamente anterior a esta tarefa. Esse código ainda lê `material.licenciante` na resposta. Todo material de terceiro enviado depois do deploy da 9.0 tem a coluna nula, então numa volta a coordenação passaria a ver o licenciante vazio nesses materiais até alguém preencher a linha. Nada quebra e nenhum dado se perde, porque o nome continua na licença. Mesmo assim, o runbook deveria mandar rodar também nessa volta o `update material m set licenciante = l.licenciante …` do bloco 1, ou pelo menos avisar do efeito. Essa avaliação é do `infra-guardian` (regra 80, item 9).
2. `tasks/prd-classificacao-bncc/techspec.md:56` diz que o check "fecha a volta para antes da F4 sem um passo a mais" e logo depois descreve justamente o passo a mais. A leitura natural é a oposta da intenção. A frase deveria dizer algo como "o check impede a volta para antes da F4, a menos de um passo a mais".
3. O `doLicenciante` em `apps/api/src/material/material.repository.ts:122-125` é uma subconsulta correlacionada por linha da lista. Hoje ela se apoia na chave `(escola_id, id)` da licença e o custo não preocupa. Se a lista de materiais crescer muito, um `left join` faria o mesmo trabalho de forma mais legível.
4. A tabela de divergências do `9_task.md`, na linha dos arquivos que não mudam, aponta para `techspec.md` §3, mas a Tech Spec não fala de `leitura-do-titular.ts`. Ela deveria apontar para o item do `TODO.md`, que é onde isso está registrado.

Arquivos citados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/docs/runbook.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/tasks/prd-classificacao-bncc/techspec.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/src/material/material.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/tasks/prd-classificacao-bncc/9_task.md`

## test-engineer · 1ª rodada · REPROVADO · 2026-11-18 13:23:35 · `tasks/prd-classificacao-bncc/9_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- Caminho feliz: o envio de material de terceiro funciona sem os checks de `licenciante`, e o licenciante da resposta vem da licença.
- Backfill repetível.
- Material de terceiro sem licença criado na janela é corrigido antes do `VALIDATE`.
- Mais de um lote de 5.000.
- Séries: escola sem série nenhuma, e material que já tinha série.
- Licenciante com mais de uma licença na escola: vale a de começo mais recente.
- Licença só com material excluído: termina no dia da última exclusão.
- Começo da licença no dia de São Paulo.
- Check: os dois lados da igualdade.
- O código não lê a coluna: renomeada, o envio, a lista, a leitura e a edição passam.
- Permissão: o professor recebe `licenciante: null`.
- Isolamento: o mesmo licenciante em duas escolas, e o material da B só com licença da B.
- Compatibilidade com a versão anterior do código (regra 80, item 9), na escrita e na leitura.
- A volta para antes da F4 pelos blocos do runbook.

**Cobertos:** todos, exceto a leitura pela versão anterior do código.
- Os 10 casos de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/packages/core/src/db/contracao-da-f4.int.test.ts` passam. Rodei: 10/10.
- Cada linha da tabela de testes tem o seu caso, citado pelo nome.
- Os 13 blocos de mutação alcançam as cláusulas novas:
  - service (envio e edição);
  - `doLicenciante` (o `limit 1` faz o material próprio receber licenciante, e `lista…proprio…toBeNull()` fica vermelho);
  - os dois lados do check, o `VALIDATE` e os dois `DROP`;
  - `NOT EXISTS`, `DESC`, `bool_and` e `min`;
  - o check do schema.
- Os motivos das linhas sem bloco se sustentam: FK composta, fim do laço, `lock_timeout`.
- Não há `.skip`, mock nem provedor de IA, nem operação concorrente nova a provar.
- `mvp-tables.int.test.ts` acompanha: o check troca de nome e entra a licença no catálogo.
- `volta-da-f4.int.test.ts` prova que o bloco 1 solta o check e copia o licenciante, e que o bloco 2 o devolve validado, recusando os dois lados.
- O arquivo do titular tem o sentinela também na licença.
- Não rodei `apps/api/test/material.int.test.ts`. Ele renomeia `material.licenciante` no banco de teste compartilhado, e quebraria o teste de outro revisor rodando ao mesmo tempo. O portão da tarefa já o rodou.

**Bloqueantes:**

1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/docs/runbook.md:1154` diz que "O código da F4 (o que grava `licenca_id` e `licenciante`) volta sem passo nenhum". Isso é falso para a leitura.
   - O código anterior a esta tarefa lê o licenciante da linha do material (`HEAD:apps/api/src/material/material.repository.ts:130` e `:150`, `licenciante: material.licenciante`, em `colunasDaLinha` e `colunasDoAlvo`).
   - O código da 9.0 deixa de gravar essa coluna. Depois de uma volta para o código da F4, todo material de terceiro enviado ou editado desde o deploy da 9.0 aparece para a coordenação com `licenciante: null`, na lista e na leitura por id.
   - O caso "a versão anterior do código segue escrevendo…" (`contracao-da-f4.int.test.ts:299`) prova só a escrita. A regra 80, item 9, pede compatibilidade com a versão anterior, e a leitura que ela faz do dado do código novo não tem teste.
   - **Correção exigida, uma das duas:**
     - (a) O runbook dá, para a volta ao código da F4, o mesmo passo de cópia do bloco 1 (`update material m set licenciante = l.licenciante from licenca_de_material l where l.escola_id = m.escola_id and l.id = m.licenca_id and m.licenciante is null`), lido do documento como os blocos atuais. Junto, um caso em `contracao-da-f4.int.test.ts` ou `volta-da-f4.int.test.ts`: o material gravado como o código novo grava (de terceiro, sem `licenciante`), depois do passo, lido pela coluna como o código anterior lê, traz o licenciante da licença.
     - (b) O código da 9.0 segue gravando a coluna (grava os dois e lê da licença), e o fim da gravação vai junto do `DROP COLUMN` do `TODO.md`. Isso mexe no que a spec manda e precisa da Tech Spec revista.

**Recomendações:**
- `apps/api/test/material.int.test.ts:194`: se o processo cair entre o `beforeAll` e o `afterAll`, o banco de teste local fica com a coluna renomeada, e a corrida seguinte do arquivo cai no `rename`. Isso dura até um `EDUCA_BANCO_NOVO=1`. Um `rename` idempotente resolve: só renomeia se a coluna original existir, e devolve no início se a renomeada sobrou. Vale também registrar que o caso trava `material` por um instante e quebra quem consulta a coluna direto em outro processo sobre o mesmo banco.
- `material.repository.ts`, `doLicenciante`: o termo `"licenca_de_material"."escola_id" = "material"."escola_id"` não tem prova que o distinga. A FK composta já garante o resultado. Vale uma linha no motivo das mutações, como as da migration.
- `contracao-da-f4.int.test.ts`: faltam dois casos de borda do backfill. Um é a grafia diferente do mesmo licenciante ("EDITORA X" contra "Editora X" vira outra licença, como o `migracao-f4.int.test.ts` prova para a 0053). O outro é a licença de mesmo licenciante com começo depois do envio: o `DESC` a escolhe e o material pode sair da busca.
- `contracao-da-f4.int.test.ts:184`: o `toBeGreaterThan(5)` é pré-condição e não prova nada. Pode sair, ou virar uma contagem do dado de terceiro sem licença antes da migration.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-18 13:49:30 · `tasks/prd-classificacao-bncc/9_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova neste diff. Continuam as de antes: `material` (perde o uso de `licenciante`, ganha o check `material_terceiro_tem_licenca`) e `licenca_de_material`. As duas têm `escola_id`, e a FK entre elas é composta.

Queries verificadas:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/src/material/material.repository.ts:125` (`doLicenciante`): o diff só mexeu no comentário. A subconsulta continua filtrando por `escola_id = material.escola_id` e por `id = material.licenca_id`.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/docs/runbook.md:1157-1160`, o bloco novo "volta ao código da F4": o `update ... from licenca_de_material` liga as duas tabelas por `l.escola_id = m.escola_id and l.id = m.licenca_id`. É rotina de operação, roda com `psql -1` e não cruza escola.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/test/material.int.test.ts:229-248`: só ficou idempotente o DDL de teste que renomeia a coluna. Não muda escopo.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/packages/core/src/db/contracao-da-f4.int.test.ts`: os casos novos (E, com o mesmo licenciante escrito de dois jeitos; F, com licença que começa depois do envio; o bloco do runbook rodado de verdade) só olham a própria escola. A contagem de partida agora é exata (5 + 1 + 5.100 + 2 + 1). O caso "não cruza escola" (B contra A) continua igual.

Teste de isolamento: presente e efetivo. É o caso "não cruza escola" de `contracao-da-f4.int.test.ts`, que não mudou e já tinha passado na 1ª rodada.

Bloqueantes: nenhum. A 1ª rodada não exigiu correção nenhuma.

Recomendações:
- O bloco "volta ao código da F4" só é testado dentro da escola A. A FK composta já impede o cruzamento, então nada vaza. Ainda assim, um caso com duas escolas e o mesmo licenciante daria nome ao vermelho se alguém tirar o `l.escola_id = m.escola_id` do runbook. Isso pode entrar junto do item que a 1ª rodada já deixou no `TODO.md` (Arquiteto, retro da F4b).

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-18 13:49:46 · `tasks/prd-classificacao-bncc/9_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: só `material.licenciante` e `licenca_de_material.licenciante`, o nome de quem detém o direito sobre o material. É dado de terceiro, pode ser uma pessoa e não é de aluno. Não entrou campo novo. O diff desta rodada mexe em quatro coisas:
- o comentário de `doLicenciante`;
- o `beforeAll` e o `afterAll` de `material.int.test.ts`, agora idempotentes;
- três casos novos em `contracao-da-f4.int.test.ts`;
- o bloco "volta ao código da F4" em `docs/runbook.md`, que copia o licenciante da licença para a linha do material, e só onde a linha está nula.

Fora da tabela de dados do docs/lgpd.md: nenhum. A linha "Licença de material" agora diz duas coisas. As licenças criadas por rotina têm `registrada_por` nulo e uma referência que diz de onde vieram. E, enquanto a coluna `material.licenciante` existir, o nome antigo pode continuar nela depois de a coordenação corrigir a licença, então quem atende pedido do titular precisa procurar lá também. O item do `TODO.md` limita isso ao deploy seguinte ao da `0065`.

Autorização por objeto: ok. A subconsulta `doLicenciante` continua filtrando pelo `escola_id` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/src/material/material.repository.ts:124`), e o comentário agora explica por quê. O bloco do runbook liga material e licença por `l.escola_id = m.escola_id and l.id = m.licenca_id`, então não cruza escola. As respostas da API, o DTO e a regra de que o professor não recebe o licenciante não mudaram desde a rodada aprovada.

Logs: limpos. O diff não acrescenta nenhuma chamada de log. O logger do teste está em `silent`.

Auditoria: presente. Não há ação nova que exija auditoria. O bloco do runbook é um procedimento de plantão sobre o banco e não lê dado de aluno.

Envio externo: nenhum.

Seed/fixture: sintético. Os nomes são "Editora X", "EDITORA X" e "Editora Y", e as escolas são `contracao-a` a `contracao-f`.

Bloqueantes: nenhum.

Recomendações:
- Depois do bloco "volta ao código da F4", a linha do material volta a ter uma cópia do licenciante, que pode ser o nome de uma pessoa. Se o código voltar e depois avançar de novo, essa cópia fica até o `DROP COLUMN`. Vale citar esse caminho na mesma frase da linha "Licença de material" do `docs/lgpd.md`, ao lado do bloco 2, para a lista de onde o nome mora ficar completa.
- Quando o `DROP COLUMN material.licenciante` for feito, tirar na mesma tarefa a frase "quem atende um pedido do titular a procura lá também" do `docs/lgpd.md`, junto do que o item do `TODO.md` já pede.

Arquivos relevantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/src/material/material.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/test/material.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/packages/core/src/db/contracao-da-f4.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/docs/runbook.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/docs/lgpd.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/TODO.md`

## infra-guardian · 2ª rodada · APROVADO · 2026-11-18 13:49:46 · `tasks/prd-classificacao-bncc/9_task.md`

VEREDITO: APROVADO
Caminho quente tocado: migration
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: compatível
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/docs/runbook.md:1154-1161`: o bloco "volta ao código da F4" não diz se a API fica de pé enquanto ele roda. Ele não precisa de parada, porque só toca o material de terceiro gravado desde o deploy da 9.0, em poucas linhas e com trava de linha curta, mas uma frase dizendo isso evita que o plantão pare a API às 10h sem necessidade.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/test/material.int.test.ts:229-248`: o `rename` com `ACCESS EXCLUSIVE` em `material` só é seguro porque os arquivos rodam um por vez (`fileParallelism: false`). Se essa configuração mudar, o caso quebra outros testes sem aviso. Vale uma asserção ou um guarda que falhe com mensagem clara se o teste rodar em paralelo.
- A subconsulta `doLicenciante` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/src/material/material.repository.ts:121-125` mudou só no comentário. O índice `(escola_id, id)` de `licenca_de_material` continua cobrindo a subconsulta, e nada muda em carga.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-18 13:49:55 · `tasks/prd-classificacao-bncc/9_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum neste diff. O diff só mexe em material, licença, runbook, testes e documentação da tarefa, e nada nele grava em `Nota`. Todos com autor humano? Sim, nada mudou desde a 1ª rodada.
Decisão autônoma sobre aluno: ausente.
Aprovação registrada: ok. O diff não traz saída de IA nova que chegue ao aluno. A classificação BNCC das seções e a correção dela pela coordenação ficaram como estavam na 1ª rodada.
Supervisão do tutor: ok. O diff não toca o tutor.
Autonomia declarada e visível: sim. O diff não toca governança nem agentes.
Bloqueantes: nenhum.
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/TODO.md`: o item do `DROP COLUMN material.licenciante` agora diz que o prazo não passa do deploy seguinte ao da `0065`. Isso fecha a janela em que o nome antigo do licenciante fica no banco sem uso. Vale manter esse prazo, porque é a parte LGPD da contração (é tema do `privacy-guardian`, não meu).
- Não auditei de novo o que não mudou, como a regra pede para rodada nova. A 1ª rodada não exigiu correção, então não há correção a conferir. O diff mexe em três coisas, e nenhuma está no escopo da regra 70 (nota, tutor, autonomia, decisão sobre aluno ou indicador de professor):
  - **Repository do material:** em `material.repository.ts`, só um comentário mudou.
  - **Scripts de teste:** o renomear da coluna em `material.int.test.ts` passou a funcionar mesmo se rodar duas vezes, e o `contracao-da-f4.int.test.ts` ganhou casos novos.
  - **Runbook:** tem um bloco novo de SQL para voltar ao código anterior à 9.0.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-18 13:50:12 · `tasks/prd-classificacao-bncc/9_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/docs/runbook.md:1154`: o parágrafo junta duas voltas: a de antes da F4 (blocos 1 e 2) e a do código da F4 anterior à 9.0 (bloco novo). Quem está de plantão às 7h precisa achar logo qual bloco é o seu. Sugiro um subtítulo ou uma lista curta ("voltando para antes da F4: blocos 1 e 2; voltando para a F4 anterior à 9.0: só o bloco 'volta ao código da F4'"). O texto "fecha esta volta, a menos do passo extra dos blocos" também não diz o que quer dizer.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/packages/core/src/db/contracao-da-f4.int.test.ts:348`: o caso roda o bloco do runbook em todas as escolas do banco de teste, e não só na A. Hoje nenhum caso seguinte depende disso. Ainda assim, vale um comentário dizendo que o caso fica depois dos casos que leem `licenciante` da janela, para quem acrescentar um caso no fim não tropeçar nisso.
- A mutação do bloco do runbook em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/tasks/prd-classificacao-bncc/9_task.md` (`set licenciante = null`) só prova que a cópia acontece. Não prova a restrição `m.licenciante is null`, que impede sobrescrever o nome que a linha já tem. É cobertura extra, não bloqueia.

Conferi, neste diff desde a 1ª rodada:
- O bloco novo do runbook ("volta ao código da F4") está escrito. O teste lê o bloco do próprio documento e o roda, então o comando que a pessoa copia é o mesmo que o teste prova.
- A divergência está registrada nos três lugares exigidos: `9_task.md`, `techspec.md` §3 e `cenarios.md`.
- Entraram os dois casos novos do backfill (o mesmo licenciante escrito de dois jeitos e a licença que começa depois do envio). A contagem de partida agora usa um número exato em vez de `> 5`.
- A renomeação da coluna em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/test/material.int.test.ts` agora pode rodar de novo sem quebrar, se um processo anterior caiu no meio.
- A linha sem bloco de mutação da subconsulta `doLicenciante` está justificada na tarefa e no comentário da constante.

A correção que levou a esta rodada é a do `test-engineer`. Sua verificação cabe a ele.

## test-engineer · 2ª rodada · APROVADO · 2026-11-18 13:50:55 · `tasks/prd-classificacao-bncc/9_task.md`

VEREDITO: APROVADO

**Cenários exigidos:** a correção da 1ª rodada (a volta ao código da F4 anterior à 9.0, que lê `material.licenciante` da linha), mais os casos que este diff acrescentou: a mesma editora escrita de dois jeitos no backfill, a licença com começo depois do envio, a contagem do dado da janela antes da migration, e o renomear idempotente da coluna em `material.int.test.ts`.

**Cobertos:**
- **Correção 1, opção (a): feita.**
  - O runbook ganhou o bloco `-- volta-da-f4: volta ao código da F4 (anterior à 9.0), antes de subir` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/docs/runbook.md:1154-1161`. É a mesma cópia do bloco 1, sem soltar o check. O texto falso ("volta sem passo nenhum") saiu.
  - O caso "a volta ao código da F4 (anterior à 9.0)…" em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/packages/core/src/db/contracao-da-f4.int.test.ts:348` grava o material como o código novo grava (de terceiro, com `licenca_id` e sem `licenciante`) e confere o nulo antes. Depois roda o bloco lido do documento por `blocoDoRunbook`, que quebra se o bloco sumir. Por fim lê a coluna como o código anterior lê, e as asserções pegam o resultado: `'Editora X'` no material de terceiro, `null` no próprio, e o check ainda validado.
  - O bloco de mutação novo (`set licenciante = null`) cai nesse caso pelo motivo certo.
  - Techspec, `cenarios.md`, `9_task.md` e o `docs/lgpd.md` (a cópia antiga do nome continua na coluna até o `DROP`) estão de acordo com isso.
- **Casos E e F:** as asserções são sobre o resultado. A grafia exata vira duas licenças diferentes, e na F sobra uma licença só, ligada ao material. Se a migration criasse uma licença nova, `toHaveLength(1)` cairia.
- **Contagem antes da migration:** a asserção antiga (`casos.length > 5`) virou a contagem real do dado que a migration precisa corrigir (5 + 1 + 5.100 + 2 + 1). É mais forte.
- **Renomear idempotente** em `material.int.test.ts`: o caso continua provando que nenhuma consulta nomeia a coluna. Agora ele se recupera se um processo cair entre o `beforeAll` e o `afterAll`.
- **Motivo novo sem bloco:** o `escola_id` de `doLicenciante` em `material.repository.ts:125` não tem caso que o distinga, porque a FK composta impede a linha. O motivo procede, e o texto mudado no arquivo é só comentário.
- **Rodados agora:** `contracao-da-f4.int.test.ts` passou (13 de 13) e `material.int.test.ts` passou (69 de 69).
- Não há `.skip`, provedor de IA nem mock que esconda a regra.

**Bloqueantes:** nenhum.

**Recomendações:**
- O filtro `m.licenciante is null` do bloco "volta ao código da F4" não tem caso que o distinga: tirá-lo só regrava o mesmo nome. Um material de terceiro com um licenciante na linha diferente do da licença (o caso da coordenação que corrigiu o nome só na licença) mostraria o que o filtro preserva. Nesse cenário não é óbvio qual nome deveria ficar, e isso vale um registro na retro da F4b.
- O caso da volta (`contracao-da-f4.int.test.ts:348`) insere material na escola A depois dos casos que contam o que a A tem. Hoje isso funciona porque a ordem é sequencial. Se um caso que conte a A for posto depois dele, quebra. Usar uma escola própria tiraria essa dependência de ordem.
