# Achados das revisões — `tasks/correcoes/2026-11-02-guarda-formas-do-inventario.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-02 11:44:33 · `tasks/correcoes/2026-11-02-guarda-formas-do-inventario.md`

VEREDITO: APROVADO

Esta correção só mexe na guarda de lint dos nomes de mercado. Nenhum campo, rota, log, arquivo de storage, envio para IA ou dado de aluno foi tocado, então quase toda a checklist não se aplica.

Campos pessoais tocados: nenhum. A mudança cobre a lista de formas e segmentos da guarda (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/guardas/nomes-de-mercado.mjs`), as fixtures da guarda, o teste dela, a `guarda.md` e a troca de nome de uma classe interna de teste (`ProcessadorContado` passou a `CountingProcessor` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/despachante/test/slots.int.test.ts`).

Fora da tabela de dados do docs/lgpd.md: nada, porque nenhum campo pessoal é novo.

Autorização por objeto: não se aplica, porque a tarefa não cria nem altera rota.

Logs: limpos. Nenhum log foi acrescentado. O `slots.int.test.ts` só conta jobs por um rótulo sintético de escola (`'A'`, `'B'`) e não grava nome nem conteúdo.

Auditoria: não se aplica. A tarefa não faz nenhuma das ações que a regra 20, item 10, manda auditar.

Envio externo: nenhum.

Seed/fixture: sintético. As fixtures novas são só nomes de identificador (`AgendadorX`, `METADADO_ROTA_ANONIMA`, `CHAVE_DA_TURMA`, e outros do mesmo tipo), sem dado de pessoa. O teste do despachante continua com `'sintetico'` e rótulos fixos.

A exceção nominal nova (`CHAVE_CHEIO_NAS_CLASSES`) aponta para uma expressão regular de código em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/web/src/__fixtures__/danger-solid.ts:26`, que não tem dado pessoal.

Pergunta de fechamento: a tarefa não muda o que o sistema guarda sobre um aluno nem para onde isso é enviado, então a resposta continua a mesma de antes dela.

Bloqueantes: nenhum.

Recomendações:
- O segmento novo `*-de-teste` passa a recusar arquivo e pasta de teste com esse nome e sugere `.fixture`. Quando alguém renomear um arquivo assim no futuro, vale conferir que o nome novo não indica que o dado ali é real. Hoje o nome não garante nada sobre o conteúdo, e a regra 20, item 17, continua sendo garantida só pela revisão.
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/despachante/test/slots.int.test.ts:56`, o comentário em prosa ainda diz "Processador que conta". Não tem efeito na privacidade, mas pode ser alinhado ao nome novo da classe por consistência.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-02 11:45:02 · `tasks/correcoes/2026-11-02-guarda-formas-do-inventario.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok (não se aplica, a tarefa não cria rota nem limite)
Fila e prioridade: ok (em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/despachante/test/slots.int.test.ts` só mudou o nome da classe do teste, de `ProcessadorContado` para `CountingProcessor`. As vagas por escola e as filas por prioridade continuam sendo checadas como antes, e não sobrou nenhuma referência ao nome antigo)
Concorrência: protegida (não se aplica, a tarefa não grava nada)
Índice e paginação: ok (não se aplica)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (não se aplica, a mudança fica em `tools/guardas/` e num nome de teste)
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/guardas/nomes-de-mercado.mjs`: a guarda não confere `CHAVE_…` fora de `apps/web`, e há constantes `CHAVE_DA_TRAVA_*` em repository da API e em `packages/core/src/db/migrate.ts`. Hoje elas passam, e é o certo: são chave de trava, não chave de consulta. Como a guarda não vai apontar essas constantes, quem audita a carga confere à mão, em revisão, se cada trava nova tem número próprio, para duas travas não usarem a mesma chave.

Rodei `tools/guardas/guardas.test.ts` e os 308 testes passaram. Procurei na árvore as formas novas que a guarda passa a recusar e não achei nada que reprove: as constantes `CHAVE_` que existem ficam fora de `apps/web`, menos a exceção `CHAVE_CHEIO_NAS_CLASSES` em `apps/web/src/__fixtures__/danger-solid.ts`, e nenhum arquivo ou pasta termina em `-de-teste`.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-02 11:46:16 · `tasks/correcoes/2026-11-02-guarda-formas-do-inventario.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- **Caminho feliz:** `class AgendadorDeX` em `apps/api/src/ia/x.ts` tem de ser recusada, com `XScheduler` na mensagem. O mesmo vale para `ProcessadorX`, `class Processador`, `ExecutorDeX`, `ExecutorX`, `ExecutorDeJobs`, `METADADO_X`, `CHAVE_X` em `apps/web`, e para o arquivo e a pasta `material-de-teste`.
- **Bordas:**
  - A ordem da lista decide a sugestão. `AgendadorDeX` tem de dar `XScheduler`, e não `DeXScheduler`; `ExecutorDeJobs` tem de dar `JobExecutor`, e não `JobsExecutor`.
  - O prefixo só casa com maiúscula logo depois: `Agendadores`, `Processadores`, `Executores` e `METADADOS_X` passam.
  - A forma no tipo de declaração errado passa: `function AgendadorX`, `type ProcessadorX`, `interface ExecutorDeX`.
  - `de-teste.ts` sozinho, `material-de-testes.ts` e `material.fixture.ts` passam.
  - Domínio que colide passa: `Agendamento`, `ConsultaX`, `CHAVE_X` fora de `apps/web`.
  - A árvore de hoje passa inteira.
- **Escopo (o "quem não pode" de uma guarda):** `CHAVE_` só vale em `apps/web/**`, e a exceção `CHAVE_CHEIO_NAS_CLASSES` só vale em `apps/web/src/__fixtures__/danger-solid.ts`.
- **Isolamento entre escolas, IA, concorrência:** não se aplicam. É guarda de lint em `tools/`, mais um rename num teste do despachante.

**Cobertos:** todos os cenários acima têm teste em `tools/guardas/guardas.test.ts`:
- as fixtures `nome-recusado.ts`, `nome-so-na-web.ts` e `nome-que-passa.ts`;
- `CASOS` nas linhas 521–530, com os casos sensíveis à ordem `AgendadorDeExecucao`, `ProcessadorDeX`, `ExecutorDeJobs` e `ExecutorX`;
- a mensagem de `AgendadorDeX` na linha 578. A asserção usa crase, então `` `DeXScheduler` `` não a satisfaria;
- os segmentos nas linhas 634–636, 646 e 671–673;
- a exceção nominal na linha 688;
- a árvore inteira na linha 733.

Cada item do "Teste que reproduz" e da `guarda.md` tem o seu teste. Não há `.skip` nem mock. Rodei `npx vitest run tools/guardas/guardas.test.ts -t "guarda de nome de mercado"`: 104 passaram, incluindo o teste da árvore inteira. Nenhuma referência a `ProcessadorContado` sobrou.

**Bloqueantes:**

1. **Faltam blocos de mutação para 9 das 12 cláusulas novas.** O documento diz que "os blocos cobrem as cláusulas que a correção acrescenta", mas há só três: `Agendador`, `-de-teste` e o `onde` do `CHAVE_`. A 12.0, que montou esta mesma lista, declarou um bloco por linha da `FORMAS`, por segmento e pela exceção nominal. Pelo critério da auditoria, cláusula nova sem bloco é bloqueante por si.

   Pelo meu raciocínio, sem alterar nada, os testes que deveriam ficar vermelhos já existem. Na lista abaixo, "CASOS X" é o caso de `it.each(CASOS)` de nome X. O que falta são os blocos, um por linha:

   | Onde | Cláusula (remover a linha) | Teste a citar |
   |---|---|---|
   | `tools/guardas/nomes-de-mercado.mjs:46` | `AgendadorDe` | CASOS `AgendadorDeExecucao (classe)` (daria `DeExecucaoScheduler`) |
   | `tools/guardas/nomes-de-mercado.mjs:48` | `Processador` exato | "recusa cada forma…" (a classe `Processador` passaria) e CASOS `Processador (classe)` |
   | `tools/guardas/nomes-de-mercado.mjs:49` | `ProcessadorDe` | CASOS `ProcessadorDeX (classe)` |
   | `tools/guardas/nomes-de-mercado.mjs:50` | `Processador` prefixo | "recusa cada forma…" (`ProcessadorX`) |
   | `tools/guardas/nomes-de-mercado.mjs:51` | `ExecutorDeJobs` exato | CASOS `ExecutorDeJobs (classe)` (daria `JobsExecutor`) |
   | `tools/guardas/nomes-de-mercado.mjs:52` | `ExecutorDe` | CASOS `ExecutorDeX (classe)` (daria `DeXExecutor`) |
   | `tools/guardas/nomes-de-mercado.mjs:53` | `Executor` | CASOS `ExecutorX (classe)` |
   | `tools/guardas/nomes-de-mercado.mjs:69` | `METADADO_` | "recusa cada forma…" (`METADADO_ROTA_ANONIMA`) |
   | `tools/guardas/nomes-de-mercado.mjs:104-108` | entrada `CHAVE_CHEIO_NAS_CLASSES` em `EXCECOES_NOMINAIS` | "a exceção nominal `CHAVE_CHEIO_NAS_CLASSES` passa em…" |

   Correção exigida: declarar esses nove blocos no documento da correção e deixar o portão prová-los. Corrigir também a frase "os blocos cobrem as cláusulas que a correção acrescenta", que hoje é falsa.

**Recomendações:**
- O primeiro bloco, `Agendador` → `AgendadorQueNaoExiste`, cita a meta-checagem "cada linha da gramática é exercida…". Esse teste lê a tabela e não roda a guarda. Seria melhor citar "recusa cada forma, no tipo de declaração em que a linha vale", que mostra `AgendadorX` deixando de ser recusada. A 12.0 cita esse teste.
- `Executor<X>` e `Processador<X>` como prefixo vão além do que o `inventario.md` §1 lista, que traz só `Processador` e `ExecutorDeJobs` como nomes exatos. A árvore passa e o motivo é técnico, mas valeria uma linha na `guarda.md` dizendo que o prefixo é extensão deliberada, e não coluna do §1.
- O rename em `apps/despachante/test/slots.int.test.ts` não mudou a frase "Processador que conta…" na linha 56. É cosmético, porque a guarda não lê comentário.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/correcoes/2026-11-02-guarda-formas-do-inventario.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/guardas/nomes-de-mercado.mjs`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/guardas/guardas.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/guarda.md`

## revisor-geral · 1ª rodada · APROVADO · 2026-11-02 11:46:22 · `tasks/correcoes/2026-11-02-guarda-formas-do-inventario.md`

VEREDITO: APROVADO

Escopo: respeitado. A correção acrescenta as seis formas que o documento lista (`Agendador`/`AgendadorDe`, `Processador` exato e prefixo, `ExecutorDeJobs`/`ExecutorDe`/`Executor`, `METADADO_`, `CHAVE_` só em `apps/web/**`, e o segmento `*-de-teste`). Ela também troca `ProcessadorContado` por `CountingProcessor`, que a lista nova recusaria, e registra a exceção nominal `CHAVE_CHEIO_NAS_CLASSES`. Não faz nada além disso.

Aderência à Tech Spec: ok. A `techspec.md` manda a gramática da guarda para a `guarda.md`. A tabela da `guarda.md` e a seção nova "O que fica fora da lista, e por quê" trazem o que entrou e o que ficou de fora, com o motivo: `Pedido`/`Resposta`, `Consulta<X>`, `Agendamento` e `CHAVE_` fora da web. Assim a divergência em relação ao `inventario.md` §1 está registrada no documento da spec, e não só no documento da correção. Na Tech Spec, o RF8 citava `Agendador…` e a guarda não o recusava; agora a guarda o recusa.

O que conferi, sem rodar typecheck, lint e testes de novo:
- **Ordem das linhas.** A regra devolve a primeira linha que casa (`regras-nome.mjs:37-41`). Por isso as formas mais específicas vêm antes das gerais. Os exemplos dão `AgendadorDeX` → `XScheduler`, `ExecutorDeJobs` → `JobExecutor` e `Processador` → `JobProcessor`. O prefixo só casa quando a letra seguinte é maiúscula, e por isso `Agendadores`, `METADADOS_X` e `CHAVES_DA_TURMA` passam.
- **Colisões na árvore.** Os `CHAVE_DA_TRAVA_*`, `CHAVE_V1`, `CHAVE_DO_COOKIE_*` e `CHAVE_DO_C2_*` estão todos fora de `apps/web` e passam. O único `CHAVE_` dentro de `apps/web` é a exceção nominal. Nenhum arquivo rastreado em `apps/`, `packages/` ou `e2e/` tem o segmento `-de-teste`.
- **`restos`.** O fixture `nome-recusado.ts` agora declara `METADADO_ROTA_ANONIMA`, que é nome antigo do `mapas/4.json`. Rodei `node tools/renomear/restos.ts` e o resultado é "limpo. 11 mapas".
- **Mutações.** Os três blocos do documento acertam as cláusulas novas: a linha `Agendador`, o segmento `*-de-teste` e o `onde` do `CHAVE_`. Cada uma aponta para um teste que fica vermelho com a mutação.

Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)").

Bloqueantes: nenhum.

Recomendações:
- `tasks/prd-nomes-de-mercado/inventario.md:20-21`: a frase "A guarda do RF8 usa os prefixos e sufixos da coluna da esquerda" continua sem ressalva. Vale apontar para a seção "O que fica fora da lista" da `guarda.md`, para o próximo leitor não achar de novo o furo do Crítico 1.
- `tasks/prd-nomes-de-mercado/guarda.md:39`: a frase "`Pedido…` e `Resposta…` ficam fora da lista, porque colidem com o domínio" repete a primeira linha da tabela nova (`:53`). Deixe o motivo num lugar só.
- `tools/guardas/guardas.test.ts:564-566`: o teste "cada linha da gramática é exercida" casa prefixo com `startsWith`, sem a exigência da maiúscula. Assim, `AgendadorDeExecucao` sozinho já conta como caso para a linha `Agendador`. Isso é cobertura e cabe ao `test-engineer`; fica só registrado.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/correcoes/2026-11-02-guarda-formas-do-inventario.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/guardas/nomes-de-mercado.mjs
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/guardas/guardas.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/guardas/__fixtures__/nome-recusado.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/guardas/__fixtures__/nome-que-passa.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/guardas/__fixtures__/nome-so-na-web.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/guarda.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/despachante/test/slots.int.test.ts

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-02 11:53:30 · `tasks/correcoes/2026-11-02-guarda-formas-do-inventario.md`

VEREDITO: APROVADO

Nesta 2ª rodada conferi só o que mudou desde a 1ª. Mudaram três coisas: o documento da correção, a `guarda.md` e um comentário do `slots.int.test.ts`. Nenhuma delas mexe em campo de pessoa, rota, log, arquivo guardado, envio para IA ou dado de aluno.

Campos pessoais tocados: nenhum. A mudança é só de texto:
- o documento ganhou nove blocos de mutação, todos sobre a guarda de lint, e uma tabela de recomendações não aplicadas;
- a `guarda.md` ganhou um parágrafo dizendo que os prefixos `Agendador`, `Processador` e `Executor` são extensão deliberada, e perdeu a frase repetida sobre `Pedido…` e `Resposta…`;
- o comentário do teste foi ajustado.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: não se aplica, a tarefa não cria nem altera rota.

Logs: limpos, nenhum log foi acrescentado.

Auditoria: não se aplica, nenhuma das ações que a regra 20, item 10, manda auditar foi tocada.

Envio externo: nenhum.

Seed/fixture: sintético. As fixtures da guarda e o `nomes-de-mercado.mjs` não mudaram desde a 1ª rodada. O teste do despachante continua com rótulos sintéticos.

Como ficaram as duas recomendações da 1ª rodada:
1. **O nome `.fixture` não pode indicar dado real (regra 20, item 17).** Foi registrada na seção "Recomendações sem aplicar" do documento, como conferência que esta revisão faz. É um destino aceitável: o nome do arquivo não garante nada sobre o conteúdo, e esse item continua garantido só pela revisão.
2. **Alinhar o comentário do `slots.int.test.ts`.** Foi feita: a linha 56 de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/despachante/test/slots.int.test.ts` agora diz "`CountingProcessor`: o processador que conta…".

Pergunta de fechamento: a tarefa não muda o que o sistema guarda sobre um aluno nem para onde isso é enviado. A resposta continua a mesma de antes dela.

Bloqueantes: nenhum.

Recomendações: nenhuma nova.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/.processo/ordens/guarda-formas-diff-r2.patch
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/correcoes/2026-11-02-guarda-formas-do-inventario.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/guarda.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/despachante/test/slots.int.test.ts

## infra-guardian · 2ª rodada · APROVADO · 2026-11-02 11:53:31 · `tasks/correcoes/2026-11-02-guarda-formas-do-inventario.md`

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
- Nesta rodada o diff (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/.processo/ordens/guarda-formas-diff-r2.patch`) mudou só três coisas: o comentário de `CountingProcessor` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/despachante/test/slots.int.test.ts:56`, os blocos de mutação e a tabela de recomendações em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/correcoes/2026-11-02-guarda-formas-do-inventario.md`, e o texto em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/guarda.md`. O teste de slots só mudou no comentário: a fila, a concorrência por escola e o limitador continuam como na 1ª rodada.
- A minha recomendação da 1ª rodada foi recusada (conferir que cada `CHAVE_DA_TRAVA_*` fora de `apps/web` tem número próprio). A recusa está registrada com motivo, e eu aceito: é uma conferência que faço na revisão, não código a mudar. Continuo fazendo essa conferência em toda tarefa que criar uma trava nova em `apps/api`, `apps/worker`, `apps/despachante` ou `packages/`.
- A `guarda.md` não diz mais que `Pedido…` e `Resposta…` ficam fora da lista "porque colidem com o domínio" (antiga linha 139). Confira se o motivo ainda aparece na seção "O que fica fora da lista, e por quê". Se não aparece, a exclusão ficou sem justificativa escrita. Não afeta a carga.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-02 11:53:46 · `tasks/correcoes/2026-11-02-guarda-formas-do-inventario.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)"). O carimbo guarda a impressão dos blocos de mutação, então os nove blocos novos já passaram pelo portão: cada um foi aplicado, deixou um caso vermelho e foi desfeito.
Bloqueantes: nenhum
Recomendações:
- Os blocos de `AgendadorDe`, `ExecutorDeJobs` e `Processador` com nome exato não derrubam o caso de recusa. A linha mais curta (`Agendador`, `ExecutorDe`, `Processador` como prefixo) continua recusando o nome. O que derruba o caso é o nome de mercado sair errado na mensagem (`DeExecucaoScheduler`, `JobsExecutor`). Isso vale, mas só enquanto o caso conferir a mensagem inteira. Vale uma frase no documento dizendo isso, para que ninguém afrouxe depois o `toContain` desses casos.
- A observação do prompt diz que a seção "Revisões" se perdeu, mas ela está em `tasks/correcoes/2026-11-02-guarda-formas-do-inventario.md:155`, com as linhas do hook. Antes do commit, confira que o hook continua lendo essa tabela.
- Tirei de novo a recomendação do `inventario.md`. A recusa está registrada, e a `guarda.md` agora explica a divergência em dois lugares: a nota do prefixo, nas linhas 33 a 35, e a seção "O que fica fora da lista, e por quê". Para mim basta. Na próxima tarefa que mexer no `inventario.md`, ponha nele uma linha apontando para a `guarda.md`.

O que conferi das correções da 1ª rodada:
- O motivo de `Pedido…` e `Resposta…` agora fica num lugar só, a tabela em `tasks/prd-nomes-de-mercado/guarda.md:57`. A frase repetida saiu do parágrafo dos limites.
- A extensão do prefixo `Agendador`, `Processador` e `Executor`, que não está no §1 do `inventario.md`, está escrita na `guarda.md:33-35`. A tabela da gramática, na linha 20, já trazia essa linha.
- A mudança em `apps/despachante/test/slots.int.test.ts:56` só mexe num comentário, que acompanha a troca de `ProcessadorContado` para `CountingProcessor`.
- `tools/guardas/nomes-de-mercado.mjs` e `tools/guardas/guardas.test.ts` não mudaram desde a 1ª rodada. Os trechos com `-` dos blocos novos batem com as linhas 46 a 53, 69, 70 e 106 da `nomes-de-mercado.mjs`.

## test-engineer · 2ª rodada · APROVADO · 2026-11-02 11:54:54 · `tasks/correcoes/2026-11-02-guarda-formas-do-inventario.md`

VEREDITO: APROVADO

**Cenários exigidos:** cada linha nova da `FORMAS` precisa ser recusada no tipo de declaração em que vale e dar o nome de mercado certo na mensagem. As linhas são `Agendador`, `AgendadorDe`, `Processador` (exato e prefixo), `ProcessadorDe`, `ExecutorDeJobs`, `ExecutorDe`, `Executor`, `METADADO_` e `CHAVE_` (só em `apps/web`). Também precisam ser recusados o segmento `*-de-teste`, como arquivo e como pasta. Quatro coisas precisam passar: a mesma forma num tipo em que a linha não vale, o plural sem maiúscula depois (`Agendadores`, `Processadores`, `METADADOS_X`), `CHAVE_X` fora da web e `material-de-testes.ts`. A exceção nominal `CHAVE_CHEIO_NAS_CLASSES` precisa passar só no arquivo dela e ter alvo. E a árvore inteira tem de passar sem violação.

**Cobertos:** a correção exigida na 1ª rodada foi feita. São 12 blocos, um por cláusula nova: as 8 linhas de classe, `METADADO_`, o `onde` do `CHAVE_`, o segmento `*-de-teste` e a exceção nominal. A frase sobre o que os blocos cobrem foi reescrita. Conferi cada bloco contra o `nomes-de-mercado.mjs` e o `guardas.test.ts`, sem alterar nada:
- **O trecho existe e é único.** O "-" de cada bloco casa uma linha só, inclusive nas duas linhas `Processador`, que se separam pelo `casa: 'exato'` e pelo `casa: 'prefixo'`.
- **O nome do caso acha o teste certo.** O `-t` é lido como regex, e os parênteses estão escapados (`\(classe\)`). `Processador \(classe\)` não pega `ProcessadorX` nem `ProcessadorDeX`.
- **Cada teste cai pelo motivo certo, num caso que roda e falha, e não por erro de carga:**
  - Sem `AgendadorDe`, a mensagem passa a dar `DeExecucaoScheduler`, e o `toEqual` cai. O mesmo vale para `ProcessadorDe` (dá `DeXProcessor`), `ExecutorDe` (dá `DeXExecutor`) e `ExecutorDeJobs` (dá `JobsExecutor`).
  - Sem o `Processador` exato e sem o `Executor` prefixo, a mensagem não traz nenhuma sugestão, e o teste cai.
  - Sem `Agendador`, sem o `Processador` prefixo e sem `METADADO_`, deixam de ser recusados `AgendadorX`, `ProcessadorX` e `METADADO_ROTA_ANONIMA`, que estão em `nome-recusado.ts`. Então "recusa cada forma" cai.
  - Sem o `onde` do `CHAVE_`, `CHAVE_DA_TURMA` passa a ser recusado fora da web, e o teste da linha 609 cai.
  - Sem a exceção nominal, `danger-solid.ts` passa a ser recusado, e o teste da linha 688 cai. A regra não lança erro quando a exceção fica sem alvo (`regras-nome.mjs` só reporta), então esse vermelho vem de um caso que falhou.
- **A suíte está verde.** Rodei `npx vitest run tools/guardas/guardas.test.ts -t "guarda de nome de mercado"`: 104 passaram e 0 falharam.
- **Nada desligado.** Não há `.skip` nem mock nesta suíte, ela não chama IA e não tem operação concorrente.
- **As três recomendações da 1ª rodada foram aplicadas:**
  - `guarda.md:33-35` diz agora que o prefixo é extensão deliberada.
  - O comentário em `slots.int.test.ts` nomeia o `CountingProcessor`.
  - O primeiro bloco cita "recusa cada forma", que acha o caso pelo começo do nome.
- **Nada se perdeu na `guarda.md`.** A frase de `Pedido…`/`Resposta…` saiu do parágrafo, e a justificativa segue na tabela "O que fica fora da lista" (`guarda.md:57`).

**Bloqueantes:** nenhum.

**Recomendações:**
1. Em `tasks/correcoes/2026-11-02-guarda-formas-do-inventario.md:59`, o parêntese "(menos a que o `consulta…` já cobria na 12.0)" é difícil de entender. O que fica sem bloco próprio é a recusa de `CHAVE_` dentro de `apps/web`: só o `onde` tem bloco, como a 12.0 fez com `consulta`. Essa recusa está provada pelo teste da linha 609 e pelo caso `CHAVE_MEUS_VINCULOS` da tabela. Vale escrever isso por extenso.
2. Recuperar a seção "Revisões" no documento da correção, com o registro da 1ª rodada que hoje está só em `tasks/correcoes/achados/2026-11-02-guarda-formas-do-inventario.md`. Assim a validação lê o histórico num lugar só.
