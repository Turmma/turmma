# Achados das revisões — `tasks/prd-ingestao-do-material/5_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-12 22:06:28 · `tasks/prd-ingestao-do-material/5_task.md`

VEREDITO: APROVADO

Tabelas verificadas:
- `licenca_de_material` (0052). Tem `escola_id` NOT NULL e id UUID (`uuidv7()`). Não tem `anoLetivoId`, o que está certo: a licença vale por contrato, não por ano escolar. Tem `unique (escola_id, id)`. A FK `registrada_por` aponta para `usuario(escola_id, id)` e usa `set null ("registrada_por")`. O índice parcial começa pela escola.
- `material.licenca_id`. A FK é composta, `material(escola_id, licenca_id)` para `licenca_de_material(escola_id, id)`, então nenhum material aponta licença de outra escola. O índice parcial começa pela escola.
- O check `auditoria_escola_ou_operacao_global` passou a aceitar `job` sem escola, mas só com `autor_operador`. Ele está igual em `ENTIDADES_DE_AUDITORIA_SEM_ESCOLA`.
- Backfill (0053): agrupa por `(escola_id, licenciante)` e o UPDATE casa `licenca.escola_id = material.escola_id`. Por isso nada cruza escolas, e o `migracao-f4.int.test.ts` prova isso com a escola B.

Queries verificadas:
- `LicencaRepository` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/licenca.repository.ts`). `listar`, `porId`, `travarVigencia` e `alterar` filtram por `requireEscolaId()`. `inserir` grava a escola de `requireEscolaId()` e o autor da sessão. Nenhum método recebe escola, e a subconsulta `quantosMateriais` está qualificada pela escola da licença.
- Controller: os contratos são estritos (`strictObject`), então `escolaId` e `registradaPor` no corpo dão `ENTRADA_INVALIDA`, e o teste cobre os dois. A query string só aceita a paginação, e o id passa pelo `IdPipe`.
- Expurgo `licenca_de_material` (`expurgo-da-escola.repository.ts`): `escola_id = ${escolaId}` aparece no DELETE, na seleção e no `not exists` do material.
- Arquivo do titular: a consulta filtra por `t.escola_id = ${escolaId}` e por `registrada_por`.
- 5.8, `noContextoDoJob`: o job de escola roda no contexto da escola da linha, que vem do banco e não do operador. O job `sistema.*` roda com `rotinaDoSistema`. Nesse caso o `jobScopeInContext` limita a `escola_id is null` e ao prefixo `sistema.`, e por isso um job de escola não consegue ser auditado sem escola.
- Matriz: `licenca` é `unidade` só para a coordenação e `nunca` para professor, aluno e rede.
- Nenhum `@Unscoped()` novo.

Teste de isolamento: presente e efetivo.
- O caso de `GET` e `PATCH` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/licenca.int.test.ts:332` mostra que a lista da A não traz as licenças da B nem conta o material dela. Mostra também que o `PATCH` da A sobre a licença da B devolve a mesma resposta do id inexistente, e que a linha e a auditoria ficam intactas.
- O caso de repository, na l.353, testa `porId`, `travarVigencia` e `alterar` com o id da B no contexto da A. Se a cláusula de escola sair de qualquer um dos quatro `.where`, um desses casos quebra, e as mutações declaradas na tarefa cobrem as quatro.
- Expurgo: a licença da B, com a mesma idade e mais antiga, não é tocada.

Bloqueantes: nenhum

Recomendações:
- `tsconfig.tsbuildinfo` está não rastreado na raiz e não deve entrar no commit da tarefa.
- No `apps/api/test/ops-jobs.int.test.ts`, o comentário "o job de uma não alcança o da outra" promete mais do que o teste confere: ele só olha o `escola_id` da auditoria. Ou o comentário é ajustado, ou entra um caso com um job de escola reprocessado em contexto de rotina do sistema dando `NAO_ENCONTRADO`.
- Professor e aluno recebem `NAO_ENCONTRADO` também na coleção. Está correto pela regra 10, item 6, mas o `cenarios.md` e a tabela da tarefa ainda dizem `PERMISSAO_NEGADA` e precisam ser reconciliados.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-12 22:06:33 · `tasks/prd-ingestao-do-material/5_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. O código novo da licença (controller, service e repository em `apps/api/src/material/`, `packages/shared/src/material/licenca.ts`) e as migrations 0052 e 0053 não tocam `Nota`, `Correcao` nem a porta de IA; uma busca por esses termos nos arquivos novos não achou nada. Os jobs `sistema.*` que a operação passa a poder reprocessar ou descartar são `consolidar-uso`, `expurgar-acesso`, `expurgar-jobs`, `expurgar-dado-pessoal`, `enviar-email-da-conta` e `varrer-temporarios-de-material`, e nenhum deles grava nota. Todos com autor humano? Sim, porque não há escrita em `Nota`.

Decisão autônoma sobre aluno: ausente.

Aprovação registrada: ok. Nenhuma saída de IA nasce nesta tarefa. A operação continua recusando os jobs `ia.*` e `titular.*` (`apps/api/src/ops/jobs-que-falharam.ts:25` e `:63`), então reprocessar não gera de novo uma saída de IA por fora da aprovação. A exceção do tutor (D47) não aparece em nenhum outro agente.

Supervisão do tutor: ok. A retenção da licença (`packages/core/src/retencao/expurgo-da-escola.repository.ts:297`) espera o último material, inclusive o que a conversa do Tutor ainda cita. Nada do registro da conversa sai antes da hora nem fica fora do alcance do professor.

Autonomia declarada e visível: sim, sem mudança. A tarefa não cria nem altera agente.

Auditoria: `licenca.registrada` e `licenca.alterada` (`packages/core/src/auditoria/acoes.ts:617` e `:627`) gravam só a vigência, sem texto livre. A entidade `job` sem escola só passa com `autor_operador` (`packages/core/src/db/schema/auditoria.ts:62`, `packages/core/src/auditoria/auditoria-recorder.ts:23`). Continua possível responder "quem fez e quando", e nenhum registro de IA perdeu autor ou data.

Supervisão e medição do professor: não há métrica nova, inferência sobre o aluno, nem indicador ou ranking de professor. Também não há nota proposta em discursiva ou redação (D55).

Fotos da tela: não vieram. A tela da licença é da tarefa 6.0.

Bloqueantes: nenhum.

Recomendações:
- `docs/regulacao.md:264` diz que "o sistema mostra quando ela vence e quantos materiais ela cobre". Hoje só a API entrega isso (`situacao` e `materiais` em `GET /v1/licencas`); a tela vem na 6.0. Vale escrever "a API entrega e a tela da coordenação mostra (6.0)", ou conferir a frase quando a 6.0 pousar, para o documento que vai ao dossiê não prometer antes da hora.
- Quando a 6.0 fizer a tela, o `conformidade-reviewer` confere duas coisas. A licença vencida não pode bloquear nem esconder material do aluno sem uma pessoa decidir. E a situação "vence em 30 dias" deve aparecer como aviso à coordenação, sem virar notificação fora do horário útil (D59).

Arquivos lidos para esta auditoria:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/5_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/docs/regulacao.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/auditoria/acoes.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/auditoria/auditoria-recorder.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/db/schema/auditoria.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/retencao/expurgo-da-escola.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/retencao/expurgo-de-jobs.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/ops/jobs-que-falharam.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/ops/reprocessar-job.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/ops/descartar-job.ts

## revisor-geral · 1ª rodada · APROVADO · 2026-11-12 22:07:12 · `tasks/prd-ingestao-do-material/5_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

**Escopo.** As subtarefas 5.1 a 5.8 foram feitas, e nada entra na 6.0, na 7.0 ou na 9.0. O envio ainda não grava `licencaId`, a leitura ainda não filtra por licença e a tarefa não tem tela.

**Aderência à Tech Spec.** Todas as divergências de desenho listadas no `5_task.md` já estão na Tech Spec ou no `cenarios.md`:
- `NAO_ENCONTRADO` na coleção e a ausência de `GET /:id`: `techspec.md` §4 e `cenarios.md` "Permissão…".
- `relogioDasLicencas`: `techspec.md` §4.
- `registrada_por` com `set null` só da coluna, o backfill na mesma transação, o check refeito, o `exigirJobDaOperacao` e o `falhou` de `material.extrair-pdf` fora do expurgo: `techspec.md` §11, linha "5.0".

O que fica só no `N_task.md` é ferramenta ou arquivo de teste (`tabelas-do-nucleo.mjs` e os testes fora dos previstos), e isso não muda a arquitetura.

**Recomendações:**
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tsconfig.tsbuildinfo` está fora do controle de versão e não é ignorado pelo git. É artefato de build: não versionar e pôr no `.gitignore`.
2. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/5_task.md` está desatualizado em três pontos:
   - A linha 85 diz que "a Tech Spec e o `cenarios.md` não foram editados (o Orquestrador reconcilia)", mas os dois foram editados nesta tarefa.
   - A tabela de testes (l.59) ainda pede `PERMISSAO_NEGADA` na coleção.
   - A primeira das "Recomendações sem aplicar" já foi aplicada.

   Alinhar o texto para a validação não ler uma contradição.
3. `cenarios.md`, "Permissão…": o item geral continua dizendo `PERMISSAO_NEGADA` na coleção e só um acréscimo abre a exceção da licença. Vale reescrever a frase para a licença em vez de empilhar a ressalva.
4. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/licenca.service.ts:77`: `#paraResposta` lê o relógio e calcula `hoje` uma vez por item da página. Calcular uma vez em `listar` e passar adiante deixa a página inteira no mesmo dia, mesmo na virada da meia-noite.
5. O índice `material_licenca_idx` e o índice parcial `licenca_de_material_vigente_ate_idx` (com `where vigente_ate is not null`) não batem com a lista de índices da `techspec.md` §7c, que só cita `licenca_de_material (escola_id, vigente_ate)` sem filtro. Vale acrescentar os dois na linha "5.0" da §11.
6. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/drizzle/0053_licenca_de_material_backfill.sql`: o laço sai quando um lote atualiza zero linhas. Se o primeiro lote de 5.000 tivesse material sem licença correspondente, o resto ficaria sem `licenca_id` sem nenhum aviso. Isso não acontece hoje, porque o `INSERT` anterior cobre todo par `(escola, licenciante)`. Mesmo assim, um `RAISE` quando sobra material de terceiro com `licenca_id` nulo deixaria a garantia explícita.
7. A prévia do titular (`contagemPorCategoria`) não conta a licença, como o próprio implementador registrou. Isso fica para uma tarefa própria.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-12 22:07:19 · `tasks/prd-ingestao-do-material/5_task.md`

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

**Por que não há bloqueante:**
- **Rate limit:** as rotas novas de `/v1/licencas` passam pelo `RateLimitGuard` global, que limita por usuário e por escola (`apps/api/src/app.module.ts:166`). Nenhum limite novo é só por IP.
- **Request e fila:** nada demorado entra no request. A licença é cadastro curto da coordenação. A 5.8 só mexe nos comandos de operação, e a fila e a prioridade ficam como estavam.
- **Concorrência:**
  - O `PATCH` trava a linha com `for update` antes de ler o "antes" (`licenca.repository.ts:91-98`). Existe teste [P] com mutação ("passam um depois do outro").
  - O expurgo da licença usa `for update of l skip locked`, também com teste.
  - Reprocessar e descartar continuam travando a linha (`travarFalho`).
  - Envio novo que cita a licença contra o expurgo: a FK toma `FOR KEY SHARE`, que conflita com o `FOR UPDATE`, então um dos dois espera ou é pulado. Não há corrida.
- **Índice e paginação:**
  - A lista pagina por cursor `id > pagina`, com `limite + 1`, e o `unique (escola_id, id)` serve essa leitura.
  - A contagem por linha usa `material_licenca_idx (escola_id, licenca_id)`.
  - O expurgo usa `licenca_de_material_vigente_ate_idx (escola_id, vigente_ate)`, e o teste de plano do expurgo já cobre isso (`apps/worker/test/expurgo-da-escola.int.test.ts:1234`).
- **Migration:**
  - `material.licenca_id` entra nula, e a FK composta só é conferida quando a coluna tem valor, então o código anterior continua gravando.
  - O `licenciante` do material fica até a F4b. Não há rename nem `NOT NULL` sem valor padrão.
  - O check de 120 caracteres da licença é o mesmo do `material.licenciante` (0022), então o `INSERT` do backfill não falha com dado existente.
  - O laço do backfill termina: toda linha do lote tem licença criada no `INSERT` anterior.
- **Estado em memória:** o serviço não tem nenhum.
- **Métrica:** o caminho não é quente (é rotina administrativa da coordenação) e não há alerta novo.
- **Teste:** nenhum chama provedor pago.

Recomendações:
1. `packages/core/drizzle/0052_licenca_de_material.sql`, último `ALTER TABLE "auditoria" ADD CONSTRAINT ...`: o check novo só afrouxa o antigo, ao aceitar `job`. Por isso toda linha existente já o satisfaz, e `NOT VALID`, sem `VALIDATE`, dispensa a varredura de `auditoria`, que é a tabela que mais cresce entre as auditadas. Hoje a varredura roda debaixo de `ACCESS EXCLUSIVE`, e como 0052 e 0053 vão numa transação só, essa trava fica segura até o fim do backfill. É aceitável porque o deploy é fora do horário letivo e a 0029 e a 0049 fizeram o mesmo, mas o custo cai a zero sem perder nada.
2. `apps/api/src/material/licenca.service.ts:168` (`POST /v1/licencas`): não há idempotência. Um clique duplo cria duas licenças iguais, e como a licença não tem exclusão, a duplicata só sai encerrando a vigência e esperando o expurgo. Duas saídas, a decidir com o produto: chave de idempotência no `POST`, ou restrição única em `(escola_id, licenciante, referencia)`, com teste [P]. A tela da 6.0 deveria, no mínimo, desabilitar o botão enquanto o envio está em andamento.
3. `packages/core/src/retencao/expurgo-de-jobs.repository.ts:49`: o `falhou` de `material.extrair-pdf` passa a ficar na frente do índice por `concluido_em` e é relido a cada lote, como o de `titular.*`. O limite é o alerta "Job que falhou de vez". Vale conferir no runbook que esse alerta cobre `material.extrair-pdf` com prazo de ação, para essas linhas não se acumularem.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/drizzle/0052_licenca_de_material.sql
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/drizzle/0053_licenca_de_material_backfill.sql
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/licenca.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/licenca.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/retencao/expurgo-da-escola.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/retencao/expurgo-de-jobs.repository.ts

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-12 22:07:39 · `tasks/prd-ingestao-do-material/5_task.md`

VEREDITO: APROVADO

Campos pessoais tocados:
- `licenca_de_material.licenciante`: nome de terceiro, que pode ser uma pessoa.
- `licenca_de_material.registrada_por`: id do coordenador que registrou.
- `cobertura` e `referencia`: texto livre curto escrito pela coordenação.
- `material.licenca_id`: só faz a ligação com a licença.
- Na 5.8, `job_registro`: o `falhou` de `material.extrair-pdf` agora fica até o operador agir. A linha guarda só ids.

Nenhum campo de aluno foi tocado.

Fora da tabela de dados do docs/lgpd.md: nenhum. A licença tem linha própria, com finalidade, base legal, retenção e o tratamento no arquivo do titular. A linha de `job_registro` foi atualizada com a nova exceção e com a auditoria sem escola.

Autorização por objeto: ok.
- Os três métodos do repository escopam por `requireEscolaId()`, inclusive `travarVigencia` com `for update`.
- O `PATCH` da licença da escola B responde o mesmo `NAO_ENCONTRADO` que o id inexistente (`apps/api/test/licenca.int.test.ts:332` e `:353`).
- Professor, aluno e rede estão como `nunca` na matriz e recebem `NAO_ENCONTRADO` também na lista inteira, o que é coerente com a regra 10, item 6 (`:304`).
- O pedido não aceita campos extras, então o cliente não consegue mandar `escolaId` nem o autor.
- A resposta tem formato fechado e nunca devolve `registrada_por`. O `contracts.test` confere todos os formatos de resposta de `@educa/shared` sozinho.

Logs: limpos. Nem o serviço nem o repository logam. O teste com um valor marcador (`licenca.int.test.ts:278`) prova que licenciante, cobertura e referência não aparecem nem na auditoria nem no log.

Auditoria: presente.
- `licenca.registrada` e `licenca.alterada` guardam só ids e a vigência, num formato fechado (`packages/core/src/auditoria/acoes.ts`).
- `job.reprocessado` e `job.descartado` do job `sistema.*` ficam sem escola, sempre com `autor_operador`. O check do banco e `ENTIDADES_DE_AUDITORIA_SEM_ESCOLA` dizem a mesma coisa, e o check está testado em `migracao-f4.int.test.ts`.
- O job de escola continua auditado na escola da própria linha.

Envio externo: nenhum. A tarefa não chama IA nem manda dado para terceiro.

Seed/fixture: sintético ("Editora Exemplo", "Contrato 123/2026", marcadores com `randomUUID`). Nenhum seed foi alterado.

Ciclo de vida:
- A licença não se exclui pela API. Ela sai no expurgo da categoria `material_excluido`, que a escola configura de 12 a 60 meses.
- O prazo conta de `vigente_ate`, e a licença só sai depois que nenhum material a cita, inclusive o excluído. A licença sem fim nunca sai. Há teste para os casos que ficam e para o que sai, incluindo a licença segurada por `mensagem_tutor` (`apps/worker/test/expurgo-da-escola.int.test.ts:1663-1774`).
- Na eliminação do coordenador, `registrada_por` vira nulo e a escola da licença continua preenchida. Isso está provado pelo caminho real, `CicloDeVidaService.eliminar` (`licenca.int.test.ts:292`), e pela migration (`migracao-f4.int.test.ts:273`).
- Arquivo do titular: a licença entra no arquivo de quem a registrou, com `licenciante` e `referencia` de fora. A licença do colega e a de outra escola não entram (`apps/api/test/arquivo-do-titular.int.test.ts:688`).

Pergunta de fechamento: nada do aluno mudou. Do lado do coordenador, o arquivo do titular passa a trazer as licenças que ele registrou.

Bloqueantes: nenhum.

Recomendações:
1. **Contagem por categoria** (`apps/api/src/privacidade/titulares.repository.ts:186`). A categoria `material_excluido` ainda conta só a tabela `material`. O comentário do método diz que conta "as tabelas que `CLASSIFICACAO_DAS_TABELAS` liga a ele", e isso deixou de ser verdade. Hoje não afeta ninguém: o coordenador está como `nunca` em `meus_dados` (`packages/shared/src/permissao/matriz.ts:325`) e não chega à contagem. Mesmo assim, vale contar `licenca_de_material` por `registrada_por` ou corrigir o comentário, para a promessa não ficar falsa quando o coordenador ganhar "Meus dados".
2. **`licenca.alterada`** (`packages/core/src/auditoria/acoes.ts`). Quando só a cobertura ou a referência mudam, o "antes" e o "depois" saem iguais e a auditoria não mostra o que mudou. Dá para guardar só os nomes dos campos alterados, como `campos: ['cobertura']`, sem o texto.
3. **`falhou` de `material.extrair-pdf` sem prazo.** A linha só tem ids e está documentada, mas fica para sempre se o operador nunca agir. Vale registrar no `TODO.md` um teto ou um alerta de envelhecimento.
4. **Spec e cenários.** Trocar `PERMISSAO_NEGADA` por `NAO_ENCONTRADO` na lista inteira (a primeira divergência registrada na tarefa), para a documentação dizer o que o código faz.

Arquivos auditados, principais:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/licenca.controller.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/licenca.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/licenca.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/shared/src/material/licenca.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/drizzle/0052_licenca_de_material.sql
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/drizzle/0053_licenca_de_material_backfill.sql
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/retencao/expurgo-da-escola.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/retencao/expurgo-de-jobs.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/titular/leitura-do-titular.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/ops/jobs-que-falharam.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/docs/lgpd.md

## test-engineer · 1ª rodada · APROVADO · 2026-11-12 22:07:56 · `tasks/prd-ingestao-do-material/5_task.md`

VEREDITO: APROVADO

**Cenários exigidos:** os 19 da tabela "Testes que provam a regra" da `5_task.md`:
- caminho feliz
- as quatro situações, com o relógio falso
- contagem de materiais
- 5.8 reprocessar e descartar `sistema.*`
- 5.8 o `falhou` de `material.extrair-pdf` com 31 dias
- `ENTRADA_INVALIDA`
- [P] dois `PATCH` da mesma licença
- auditoria com sentinela
- retenção: vencida sem material sai
- retenção: com material vivo, sem fim e da escola B ficam
- retenção segurada por `mensagem_tutor`
- eliminação do coordenador
- arquivo do titular
- backfill
- permissão de professor e aluno
- escola sem ano letivo
- isolamento
- `contracts.test`
- `CLASSIFICACAO_DAS_TABELAS`

Os de domínio que se aplicam aqui: virada de ano (a licença atravessa o ano), 23h de São Paulo contra o UTC do servidor, clique duplo e duas alterações ao mesmo tempo.

**Cobertos:** todos os 19. Rodei `npx vitest run --project integracao apps/api/test/licenca.int.test.ts`: 16 de 16 verdes.

- **Caminho feliz:** `licenca.int.test.ts` › "a coordenação registra, lista e altera…". Confere a linha, a resposta sem `registradaPor` e os dois "antes" da auditoria.
- **Situação:** › "uma de cada…", com o relógio injetado. O caso "às 23h de São Paulo do último dia…" prova a borda do fuso e a extensão pelo `PATCH`. Na unidade, `licenca.test.ts` cobre o dia 0, o dia 30, o dia 31 e a virada de mês e de ano.
- **Contagem:** › "`materiais` conta os da licença que não foram excluídos…". Tem material excluído, outra licença e a escola B.
- **5.8, reprocessar e descartar:** `ops-jobs.int.test.ts` › "volta a aguardando, e a auditoria sai sem escola…" e "a linha sai, e a auditoria sai sem escola…". O job de escola continua auditado na escola da linha (mesmo caso, e o da l.374).
- **5.8, PDF que falhou:** `expurgo.int.test.ts` › "o falho de `material.extrair-pdf` fica depois dos 30 dias…". O de outro tipo sai.
- **Entrada inválida:** os dois casos de "entrada inválida" (`POST` e `PATCH`, inclusive o começo depois do fim gravado). Linha e auditoria não mudam.
- **[P] dois `PATCH`:** concorrência real, com `WriteBlockTrigger` e `esperarNaTrava(…, 2)`. Sem o `for update`, o segundo lê o "antes" velho pelo MVCC e o teste fica vermelho, como o bloco declara.
- **Auditoria:** › "a auditoria e o log nunca levam o licenciante…". A sentinela é conferida na auditoria e no log.
- **Retenção:** em `expurgo-da-escola.int.test.ts`, cinco casos:
  - "prazo contado de `vigente_ate`" (um dia antes, no dia, um dia depois, a escola B, a reexecução)
  - "fica a licença com material vivo…"
  - "o passo do material vem antes…"
  - "o material que a conversa do Tutor ainda cita segura a licença…" (termina `concluida`, e depois sai junto com a conversa)
  - o lote com limite e ordem, e o `skip locked` com a trava de outra transação
  
  Além disso, a licença entrou na lista de índices do EXPLAIN (l.1234).
- **Eliminação:** › "apagar o coordenador deixa `registrada_por` nulo…". No banco, `migracao-f4.int.test.ts` › "vira nulo com a eliminação".
- **Arquivo do titular:** `arquivo-do-titular.int.test.ts` › "a licença entra no arquivo de quem a registrou…". Confere as colunas exatas, e que licenciante, referência, a licença do colega e a da outra escola ficam de fora.
- **Backfill:** `migracao-f4.int.test.ts`, em banco à parte migrado até a 0051. Cobre só expandir, uma licença por `(escola, licenciante)`, a B separada, `vigente_desde` no dia de São Paulo, só excluídos com o fim na última exclusão, 5.100 linhas (mais de um lote), as travas do banco e o check da auditoria.
- **Permissão:** › "o professor e o aluno recebem o mesmo `NAO_ENCONTRADO`…". A divergência com a tabela (404 também na coleção) está documentada na tarefa e segue a regra 10, item 6.
- **Escola sem ano letivo:** › "a escola sem ano letivo em curso…". O teste confere que a escola não tem ano letivo.
- **Isolamento:** pela HTTP (lista, contagem, `PATCH` da B igual ao do inexistente, linha e auditoria sem mudança) e pelo repository (`porId`, `travarVigencia` e `alterar` com o id da B no contexto da A).
- **`contracts.test` e `CLASSIFICACAO_DAS_TABELAS`:** os dois testes já existentes descobrem os contratos e as tabelas novas sozinhos (`*ResponseSchema` do `@educa/shared` e a conferência com a migration). `licenca.test.ts` › "recusa quem a registrou, a escola e qualquer campo a mais" reforça o DTO.

Conferi a seção "Mutações" contra o `git diff`. Cada cláusula nova de `apps/*/src` e `packages/*/src` tem bloco, menos os dois índices parciais do `schema/material.ts`, que vêm logo abaixo. Não há `.skip`, teste comentado, mock da regra nem provedor de IA.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **O bloco do `not exists` cita o caso errado.** Ele está em `5_task.md` l.330-334 e cita "fica a licença com material vivo", mas a tabela pede essa mutação na linha "retenção segurada por `mensagem_tutor`". Sem o `not exists`, os dois casos ficam vermelhos pelo mesmo motivo: o `delete` bate na FK sem ação do material e o lote cai. O vermelho é legítimo (o expurgo da escola quebraria toda noite). Mesmo assim, citar o caso do `mensagem_tutor`, que confere `concluida: true`, alinha o bloco ao que a tabela pede.
2. **Os dois índices parciais do `schema/material.ts` não têm prova** (l.413 e l.454). Nenhum teste compara o schema do drizzle com as migrations, então essas linhas podem divergir da `0052` sem nada ficar vermelho. A justificativa da tarefa é razoável. Vale levar à retro uma guarda de "schema igual à migration".
3. **Clique duplo em "registrar"** (`POST /v1/licencas` duas vezes) cria duas licenças iguais. A spec não pede idempotência aqui, mas é o caso de borda da regra 80, item 7. Fica para a tela (6.0) ou para a spec decidir se aceita a duplicata.
4. **O `depois` da auditoria no `PATCH` só de `vigenteDesde` não é conferido.** O caso › "`PATCH` muda cada campo que veio…" não olha a auditoria. Hoje a mutação `antes.vigenteDesde` só fica vermelha pelo 500 do check do banco, e não pela auditoria errada. Conferir `licenca.alterada` nesse caso fecha isso.
5. **Papel errado no teste do arquivo do titular.** `arquivo-do-titular.int.test.ts` monta o arquivo da coordenadora com `papel: 'professor'`. Usar o papel real evita que uma mudança futura por papel mascare o caso.
6. **Prévia do titular e divergência da tabela, as duas já registradas.** A prévia (`contagemPorCategoria`) ainda não conta a licença, e a linha "permissão" e o `cenarios.md` falam em `PERMISSAO_NEGADA` na coleção. Os dois itens estão nas "Recomendações sem aplicar" da tarefa e ficam para o Orquestrador reconciliar.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/5_task.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/licenca.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/shared/src/material/licenca.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/db/migracao-f4.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/worker/test/expurgo-da-escola.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/worker/test/expurgo.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/ops-jobs.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/arquivo-do-titular.int.test.ts`

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-12 22:40:55 · `tasks/prd-ingestao-do-material/5_task.md`

VEREDITO: APROVADO

Esta é a 2ª rodada. Auditei só o diff desde a 1ª (`.processo/ordens/5_task-diff-codigo-r1-r2.patch`, com os documentos em `.processo/ordens/5_task-diff-r1-r2.patch`) e o que ele afeta. A 1ª rodada não exigiu nenhuma correção.

Campos pessoais tocados: nenhum campo novo. O diff só refatora `licenca.service.ts`, acrescenta casos de teste e muda um comentário, uma frase de documento e um padrão do `.gitignore`. As colunas e as migrations da licença não mudaram.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok. O novo caso em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/ops-jobs.int.test.ts:436` prova os dois sentidos: a rotina do sistema não reabre nem descarta o job de escola, e o contexto de uma escola não alcança o job do sistema. O estado `falhou` foi conferido na linha. O `#hoje()` em `licenca.service.ts` não muda o escopo, e o `#lerGravada` continua respondendo `NAO_ENCONTRADO` igual para id inexistente e id de outra escola. A linha da matriz em `5_task.md:139` e o `cenarios.md` agora dizem 404 também na coleção, o que bate com a regra 20, item 6.

Logs: limpos. O diff não acrescenta nenhum log.

Auditoria: presente. O teste novo em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/licenca.int.test.ts:136-141` exige o `antes` e o `depois` exatos de `licenca.alterada`. Eles levam só a vigência, nunca o texto de `referencia` nem de `cobertura`. Isso cobre a minimização que a 1ª rodada deixou sem prova.

Envio externo: nenhum neste diff.

Seed/fixture: sintético. Os testes usam `sentinela(...)` e licenciantes fictícios.

Bloqueantes: nenhum.

Recomendações:
- `5_task.md`, "Recomendações sem aplicar", manda três itens para o `TODO.md`, mas o `TODO.md` não foi alterado neste checkout. Os itens são: guardar os nomes dos campos alterados em `licenca.alterada` (da 1ª rodada deste revisor), o prazo ou alerta do `falhou` de `material.extrair-pdf`, e a idempotência do `POST /v1/licencas`. Eles precisam entrar no `TODO.md` antes do pouso, senão ficam só no documento da tarefa.
- O comentário em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/arquivo-do-titular.int.test.ts:696` explica o `papel: 'professor'` usado para o coordenador. Isso é aceitável enquanto o "Meus dados" da coordenação estiver `nunca`. Até lá, a pergunta de fechamento sobre um coordenador titular só é respondida pelo arquivo montado no teste, não por um pedido real pela API. O registro já está em `techspec.md` §11, linha "5.0".

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-12 22:41:16 · `tasks/prd-ingestao-do-material/5_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. O diff da 1ª para a 2ª rodada e a tarefa 5.0 tratam só da licença de material, dos jobs de operação e da retenção, e não tocam em `Nota`. Todos com autor humano? Sim (não há caminho novo).
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. Nenhuma saída de IA nesta tarefa. A licença é ato humano da coordenação, e a auditoria `licenca.registrada` e `licenca.alterada` grava autor, data e vigência.
Supervisão do tutor: ok. O diff não toca no tutor.
Autonomia declarada e visível: sim. O diff não mexe em agente nem em governança.
Bloqueantes: nenhum
Recomendações: nenhuma nova.

**Conferência da recomendação da 1ª rodada**

Foi feita. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/docs/regulacao.md:126` a frase não promete mais uma tela que ainda não existe. Agora diz que a API entrega a situação e a contagem de materiais, e que a tela da coordenação os mostra na 6.0. Isso confere com `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/6_task.md`, que é a aba Licenças, com situação, contagem de materiais e o aviso `licenca-vencendo` no sino.

**O resto do diff, lido inteiro (`.processo/ordens/5_task-diff-codigo-r1-r2.patch`)**

Nada nele afeta a regra 70.
- **`licenca.service.ts`:** lê o dia uma vez por resposta. Não há IA, nota nem decisão sobre aluno.
- **`licenca.int.test.ts`:** a conferência nova prova que a auditoria `licenca.alterada` grava só a vigência, sem a referência e sem a cobertura. Isso ajuda a responder "quem alterou e quando".
- **`ops-jobs.int.test.ts`:** o caso novo prova que o contexto de rotina do sistema e o de escola não alcançam o job um do outro. É isolamento entre escolas, não regra 70.
- **`arquivo-do-titular.int.test.ts`:** recebeu só um comentário.
- **`.gitignore`:** ganhou só o cache do compilador.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-12 22:41:34 · `tasks/prd-ingestao-do-material/5_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo, sobre o código atual)
Bloqueantes: nenhum

As três recomendações que fiz na 1ª rodada foram atendidas:
- **Relógio lido uma vez por resposta:** `licenca.service.ts` agora lê o dia de São Paulo em `#hoje()`, uma vez por resposta, e passa esse dia para `#paraResposta(lida, hoje)`. A lista inteira fica no mesmo dia. As duas mutações que tocam essas linhas foram reescritas no documento da tarefa para o texto novo.
- **`tsconfig.tsbuildinfo`:** está no `.gitignore`.
- **Documento da tarefa desatualizado:**
  - A linha "permissão: professor, aluno" passou a dizer `NAO_ENCONTRADO` na coleção e no objeto.
  - O `papel: 'professor'` no arquivo do titular da coordenação entrou como divergência resolvida.
  - Essa divergência também está na `techspec.md` (§11, linha 5.0) e no `cenarios.md`.

A reconciliação da `techspec.md` e do `cenarios.md` bate com a árvore:
- A §4 diz que professor e aluno recebem `NAO_ENCONTRADO` também na coleção, e que não há `GET /v1/licencas/:id`.
- A §7c e a linha 5.0 da §11 nomeiam os dois índices parciais da 0052: `material_licenca_idx` e `licenca_de_material_vigente_ate_idx`.
- No `cenarios.md`, a linha de permissão separa as rotas de material, que continuam com `PERMISSAO_NEGADA` na coleção, das três rotas de licença, que dão `NAO_ENCONTRADO`.

O que mudou no código desde a 1ª rodada não abre problema novo:
- **Teste novo em `ops-jobs.int.test.ts`:** testa o isolamento nos dois sentidos. O contexto da rotina do sistema não reabre nem descarta job de escola, e o contexto da escola não alcança job do sistema. Cada um passa no próprio contexto. O comentário do caso de cima agora aponta para ele.
- **Mutação do `not exists` do expurgo da licença:** passou a ser medida pelo caso "o material que a conversa do Tutor ainda cita segura a licença" (`expurgo-da-escola.int.test.ts:1723`). Sem a cláusula, o `DELETE` bate na FK `material_licenca_da_escola_fk` (`ON DELETE no action`) e o teste fica vermelho. O caso existe e o carimbo cobre a mutação.
- **Asserção nova em `licenca.int.test.ts`:** confere o `antes` e o `depois` de `licenca.alterada` só com a vigência, sem o texto da referência nem da cobertura. Prova o que a Tech Spec §6 fixa.

Recomendações:
- O parágrafo de abertura de "Divergências resolvidas" (`tasks/prd-ingestao-do-material/5_task.md`) ainda diz que a frase geral de "Permissão…" do `cenarios.md` "fica para o Orquestrador". Ela já foi reescrita. Atualizar a frase quando o documento for mexido de novo.
- Quatro "Recomendações sem aplicar" têm `TODO.md` como destino:
  - a idempotência do `POST /v1/licencas`;
  - o prazo do `falhou` de `material.extrair-pdf`;
  - os nomes dos campos alterados em `licenca.alterada`;
  - mais uma que só aparece no texto do documento.

  O `TODO.md` não está entre os arquivos alterados. Conferir se o Orquestrador escreve essas entradas no fechamento, para não ficarem só no documento da tarefa.

Arquivos lidos:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/.processo/ordens/5_task-diff-codigo-r1-r2.patch`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/.processo/ordens/5_task-diff-r1-r2.patch`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/worker/test/expurgo-da-escola.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/techspec.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/cenarios.md`

## test-engineer · 2ª rodada · APROVADO · 2026-11-12 22:41:48 · `tasks/prd-ingestao-do-material/5_task.md`

VEREDITO: APROVADO

Cenários exigidos: as três correções da 1ª rodada (o bloco do `not exists` citava o caso errado, a auditoria do `PATCH` só era conferida no começo da vigência, o papel no arquivo do titular), mais o que o diff r1→r2 afeta: o `#hoje()` lido uma vez no `licenca.service.ts`, os dois blocos de mutação reescritos por causa dele e o caso novo do repository de jobs.

Cobertos:
- **Bloco do `not exists` do expurgo da licença** (`tasks/prd-ingestao-do-material/5_task.md`, seção "Mutações"). Agora cita `apps/worker/test/expurgo-da-escola.int.test.ts:1723`, "o material que a conversa do Tutor ainda cita segura a licença". O caso chega à cláusula: o material, excluído além do prazo, fica porque a conversa ainda o cita, e a licença dele também está vencida. Sem o `not exists`, ela sairia e `existe('licenca_de_material', licenca)` (linha 1736) ficaria vermelho. Corrigido.
- **Auditoria do `PATCH`** (`apps/api/test/licenca.int.test.ts:136-141`). O `toEqual` é exato nas duas `licenca.alterada`: na primeira, o começo novo aparece em `depois`; na segunda, só a cobertura mudou e a vigência vai igual em `antes` e `depois`. Como a comparação é exata, ela também prova que nem a referência nem a cobertura vão para a auditoria. Corrigido.
- **Papel no arquivo do titular** (`apps/api/test/arquivo-do-titular.int.test.ts:696`). Ganhou o comentário, e a divergência foi registrada na tarefa e na `techspec.md` §11, linha "5.0". Corrigido.
- **`#hoje()`**. Os dois blocos de mutação foram reescritos para o texto novo, e conferi que batem com as linhas 36 e 53 do `licenca.service.ts`. A mutação do relógio passou para dentro de `#hoje()`, que serve tanto a lista quanto `#lerGravada`, então o caso "às 23h de São Paulo do último dia" continua alcançando a cláusula.
- **Caso novo em `apps/api/test/ops-jobs.int.test.ts:436`**. São duas negações, cada uma com o estado da linha conferido depois: a rotina do sistema não alcança o job de escola, e o contexto da escola não alcança o job do sistema. Também há o positivo de cada lado.
- Rodei `npx vitest run apps/api/test/licenca.int.test.ts` (16 passaram) e `npx vitest run apps/api/test/ops-jobs.int.test.ts` (40 passaram).
- O diff não traz `.skip`, teste comentado, mock da coisa nossa nem chamada de IA. Também não traz cláusula nova sem bloco: a única mudança de produção é a refatoração do `#hoje()`, e os blocos dela foram atualizados.

Bloqueantes: nenhum.

Recomendações:
- O caso novo do `ops-jobs.int.test.ts:436` não distingue o `isNull(jobRegistro.escolaId)` do `like(tipo, 'sistema.%')` em `packages/core/src/queue/job-outbox.repository.ts:264`. O job de escola do caso é `estrutura.gravar-planilha`, que o `like` já barra, então tirar o `isNull` deixaria o caso verde. O check `job_registro_escola_ou_sistema` (`packages/core/src/db/schema/job-registro.ts:63`) aceita um job com escola e tipo `sistema.*`. Com um caso assim, o `isNull` passa a ter prova. A cláusula já existia antes desta tarefa, por isso fica só como recomendação.
- Nada prova que a página inteira da lista usa um único dia, que é o "lido uma vez por resposta" do comentário. Para provar, seria preciso um relógio falso que vira o dia entre dois itens. O ganho é pequeno, então isto fica registrado para a retro e não exige teste agora.
