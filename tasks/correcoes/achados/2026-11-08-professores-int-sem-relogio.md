# Achados das revisões — `tasks/correcoes/2026-11-08-professores-int-sem-relogio.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-08 08:34:59 · `tasks/correcoes/2026-11-08-professores-int-sem-relogio.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo. A correção altera só um teste. Ela ajusta `usuario.desativado_em` do professor sintético e muda a ordem em que o teste lê a `auditoria`. O schema não muda.
Fora da tabela de dados do docs/lgpd.md: nada.
Autorização por objeto: ok. O E12 continua provando que o professor desativado depois do aceite recebe o mesmo `NAO_ENCONTRADO` que o id inexistente, o que cobre as regras 6 e 10.6. `desativarDepoisDoUltimoAceite` deixa o `desativado_em` depois do último `usado_em` do convite. O usuário continua desativado, agora sem depender do relógio, e a afirmação do caso fica mais firme.
Logs: limpos. A correção não acrescenta nenhum log.
Auditoria: presente. A mudança só lê a auditoria, ordenando por `xmin::text::bigint, id`. Nenhuma ação deixa de ser registrada.
Envio externo: nenhum.
Seed/fixture: sintético. Os nomes são `Professor Sintético <uuid>` e os e-mails usam o domínio `@escola.invalid`.
Bloqueantes: nenhum.
Recomendações:
- `cadastrar` agora chama `anteciparODesativado` em todo cadastro com 201, e isso vale para o arquivo inteiro. Do lado da privacidade não há risco, porque o usuário continua inativo: a função só mexe onde `desativado_em is not null`. Ainda assim, vale o `test-engineer` confirmar que nenhum caso do arquivo afirma algo sobre o valor exato de `desativado_em` logo depois do convidar.

Nada aqui pesa na pergunta de fechamento: a correção não muda o que o sistema guarda sobre a pessoa nem para onde isso vai.

Arquivos em revisão:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/test/professores.int.test.ts`: o import, o `cadastrar`, o `auditoriaDe` e o E12. Ficaram fora do veredito as duas linhas com `enviadoEm: null`, que são da tarefa 4.0.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/correcoes/2026-11-08-professores-int-sem-relogio.md`
- O ajudante `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/test/relogio-que-recua.ts` não mudou. Li só para conferir o que as duas funções chamadas fazem.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-08 08:35:04 · `tasks/correcoes/2026-11-08-professores-int-sem-relogio.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. A correção mexe só no teste e não toca `apps/*/src`, `packages/*/src` nem a Tech Spec.
Portão local: carimbo válido. O `conferir` respondeu "portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)".
Bloqueantes: nenhum

O que conferi e se sustenta:
- **`cadastrar`** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/test/professores.int.test.ts:90-95`): o ajudante só mexe no usuário quando a resposta é 201 e o `desativado_em` não é nulo.
  - O caso das linhas 418-438 (o coordenador que também dá aula) continua intacto: quem volta na resposta é o usuário professor novo, e o de coordenação, ativo, tem `desativado_em` nulo.
  - Nos CONFLITO das linhas 232, 422 e 426 nada é gravado.
  - O UPDATE vai direto ao banco e não grava auditoria, então a afirmação "a mesma auditoria" do E11 (linhas 371-376) segue valendo.
- **E12** (`:589`): `desativarDepoisDoUltimoAceite` deixa o `desativado_em` depois de qualquer `usado_em`, com folga de 1 s. A regra do caso (o desativado depois do aceite recebe o NAO_ENCONTRADO do inexistente) não muda.
- **`auditoriaDe`** (`:136-142`): passou a ordenar por `xmin::text::bigint, id`, a mesma convenção que `convite.int.test.ts:187` e `ciclo-de-vida.int.test.ts:195` já usam. O C7 (`:785`) continua afirmando que o segundo refaz o convite que o primeiro criou.
- As linhas com `enviadoEm: null` (`:172`, `:937`) são da 4.0 e ficaram fora deste veredito, como o pedido indica.

Recomendações:
- O vermelho do C7 não tem reprodução determinística: a prova são a causa e as dez execuções verdes, como o documento admite. Fica para a retro registrar se vale ter um ajudante que force duas transações com o `id` v7 invertido, para os próximos leitores de auditoria ordenada.
- A ordem por `xmin` supõe que a auditoria nunca recebe UPDATE: o `xmin` é a última escrita da linha, não a inserção. Vale para a tabela de hoje. Uma linha no comentário de `:135` dizendo isso evitaria que alguém copiasse a convenção para uma tabela que é atualizada.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-08 08:35:05 · `tasks/correcoes/2026-11-08-professores-int-sem-relogio.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova. A correção só lê e escreve `usuario`, `convite` e `auditoria` dentro do teste, por meio dos ajudantes que já existiam em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/test/relogio-que-recua.ts`.

Queries verificadas:
- `anteciparODesativado`: muda só o `usuario` recém-criado, achado pelo UUID devolvido no 201. O professor continua inativo (`desativado_em is not null`), então nenhum caso de pendente ou de outra escola fica ativo por causa dela.
- `desativarDepoisDoUltimoAceite` no E12: muda só o `desligado`. O caso continua provando que o desativado depois do aceite recebe o mesmo `NAO_ENCONTRADO` do inexistente.
- `auditoriaDe`: o filtro `escola_id = $1 and acao = $2` não mudou. Mudou só a ordenação (`xmin::text::bigint, id`).
- Nenhuma query de `apps/*/src` ou `packages/*/src` foi alterada.

Teste de isolamento: presente e efetivo. Os casos entre escolas do arquivo não perderam força:
- No E12, "pendente de outra escola" e "ativo de outra escola" continuam dando o mesmo `NAO_ENCONTRADO` do inexistente.
- No E10 e no E11, o cruzamento entre escolas segue igual.
- O "pendente de outra escola" continua inativo depois da antecipação, então quem prova a escola na consulta continua sendo o "ativo de outra escola", como diz o comentário do caso.
- Se a cláusula de escola sair do repository, esses casos continuam quebrando.

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/test/professores.int.test.ts:90-95`: o `cadastrar` agora antecipa o `desativado_em` em todo cadastro do arquivo, e nada no nome avisa isso. Um caso futuro que precise do `desativado_em` exato do convidar vai receber o valor alterado. Vale deixar a função crua à disposição desse caso ou dar ao ajudante um nome que diga o que ele faz.
- Se os ajudantes de `relogio-que-recua.ts` passarem a ser usados fora de `apps/api/test`, eles precisam de filtro por `escola_id`. Hoje mexem só por UUID, o que basta em teste.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-08 08:35:16 · `tasks/correcoes/2026-11-08-professores-int-sem-relogio.md`

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
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/test/professores.int.test.ts:90-95`: o `cadastrar` agora grava no banco depois de receber o 201. Nos casos C7 que disparam dois pedidos ao mesmo tempo (linhas 705, 719, 729, 736, 746), essa gravação extra não afeta nada. Só um pedido volta 201 e o outro volta CONFLITO, e a gravação só roda no 201. Se um caso futuro aceitar dois 201 para o mesmo usuário, o `desativado_em` recua dois minutos em vez de um, o que não faz mal. Vale citar esse ponto no comentário do ajudante.
- O vermelho do E11 e do E12 foi reproduzido em rascunhos que não ficaram no repositório. Para o C7 a prova é só a causa e as dez execuções seguidas. É aceitável numa correção que só mexe em teste, mas o C7 continua sem um teste que mostre a falha.

A correção mexe só no teste. Nenhuma linha de `apps/*/src` nem de `packages/*/src` mudou, e as quatro alterações estão de acordo com o documento da correção.
- A ordenação por `xmin::text::bigint, id` em `auditoriaDe` (linha 139) é a mesma de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/test/convite.int.test.ts:187` e de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/test/ciclo-de-vida.int.test.ts:195`. Funciona porque a auditoria só recebe inserções e nunca é atualizada.
- `anteciparODesativado` só mexe no usuário que tem `desativado_em is not null`, e só quando a resposta é 201. Os cadastros que dão CONFLITO (linhas 232, 422, 426) não recebem a gravação, e o E11 recua os dois cadastros (com conta e sem conta) da mesma forma.
- O E12 (linha 589) continua provando a regra: `desativarDepoisDoUltimoAceite` deixa o `desativado_em` depois do último aceite, então o caso cai no `NAO_ENCONTRADO` por estar desativado, e não por causa do relógio.
- Nenhum teste chama provedor pago.

## test-engineer · 1ª rodada · APROVADO · 2026-11-08 08:36:19 · `tasks/correcoes/2026-11-08-professores-int-sem-relogio.md`

VEREDITO: APROVADO

**Cenários exigidos.** Esta correção só mexe no teste. Ela precisa provar três coisas:
1. E11 e E12 deixam de depender de o relógio não recuar entre o convidar e o aceite.
2. O desligado do E12 fica desativado depois do último aceite, por construção.
3. O C7 lê a auditoria na ordem das transações, e não na ordem do id v7.

Junto com isso, nenhum dos três casos pode perder o poder de pegar a regra que já provava.

**Cobertos:**
- **Raiz do E11 e do E12:** o `cadastrar` (`apps/api/test/professores.int.test.ts:90-95`) chama `anteciparODesativado` só quando a resposta é 201. Cadastro recusado (409, 400, 404) não grava nada, então os `retrato` de antes e depois (por exemplo `:232-233`) continuam valendo. O ajudante só mexe em quem tem `desativado_em is not null`, então o coordenador ativo de `:434-438` não muda.
- **A regra `usado_em >= desativado_em` continua provada:** no E12, `desativarDepoisDoUltimoAceite` (`:589`) põe o `desativado_em` depois de `max(usado_em)`. Se essa condição sumir do produto, o desligado sai `aceito` ou alocável, e `:598` e `:610` ficam vermelhos. Os casos que exigem `ativo: false` (`:658`, `:809`) também continuam pegando o erro, porque o ajudante só recua um `desativado_em` que já existe e não o apaga.
- **C7:** `auditoriaDe` ordena por `xmin::text::bigint, id` (`:139`), como já fazem `convite.int.test.ts:187` e `ciclo-de-vida.int.test.ts:195`. No `emOrdemNaTrava` a primeira chamada sai e entra na fila da trava antes da segunda (`escola-lock.ts:47-50`). Por isso o xid dela é menor que o da segunda, mesmo que a transação grave algo antes de pegar a trava. A asserção de `:785` continua provando que o segundo refaz o convite que o primeiro criou.
- **Concorrência:** continua de verdade. No `Promise.all` de `:705` e `:729` e nos `emOrdemNaTrava`, os dois POST seguem em paralelo. O `update` do ajudante só roda depois da resposta 201 e não segura trava nenhuma.
- **Mutações:** "Sem mutação" está certo. O `git diff` da correção não toca `apps/*/src` nem `packages/*/src`.
- **Rodada local:** o arquivo inteiro passou, 35 de 35.
- Não há `.skip`, teste comentado nem mock. Não há IA envolvida.

**Bloqueantes:** nenhum.

**Recomendações:**
1. O `cadastrar` também recua o `desativado_em` quando a coordenação cadastra de novo alguém que já existe (`:209`, `:635`). Hoje isso não faz mal, porque nenhum desses usuários tinha convite aceito. Se um caso futuro cadastrar de novo um professor desligado depois do aceite, recuar um minuto pode fazer um aceite antigo e recente contar como ativação, e o caso passaria sem provar nada. Vale avisar isso no comentário de `:85-89`, ou mandar esse caso desativar com `desativarDepoisDoUltimoAceite`.
2. O C7 não tem reprodução vermelha. A justificativa do documento é razoável: a causa vem da regra 40, existe precedente nos outros dois arquivos e houve dez rodadas verdes. Fica registrado para a validação.

Arquivos revisados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/test/professores.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/test/relogio-que-recua.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/test/escola-lock.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/correcoes/2026-11-08-professores-int-sem-relogio.md`

## revisor-geral · 2ª rodada · APROVADO · 2026-11-08 08:49:12 · `tasks/correcoes/2026-11-08-professores-int-sem-relogio.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok (a correção mexe só em teste e não toca a arquitetura da `techspec.md`)
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade e alvo, para o código atual)
Bloqueantes: nenhum
Recomendações:
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/correcoes/2026-11-08-professores-int-sem-relogio.md`, a seção "Fora desta correção" diz que a 4.0 alterou "as linhas 160 e 925". Os comentários novos empurraram essas linhas, e hoje os dois `enviadoEm: null` estão em `professores.int.test.ts:174` e `:939`. Vale corrigir os números ou citar o trecho em vez da linha, para quem separar o commit não errar o hunk.

Nesta rodada conferi só o que mudou desde a aprovação anterior: dois comentários no teste e duas seções novas no documento. Não havia correção exigida a conferir.

- **Comentário do `cadastrar`** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/test/professores.int.test.ts:85-99`): está certo em relação a `anteciparODesativado`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/test/relogio-que-recua.ts`. O ajudante subtrai um minuto sempre que `desativado_em` não é nulo, então cadastrar de novo um professor pendente ou desligado recua mais um minuto. O risco de um aceite antigo contar como ativação é real, e o comentário aponta o remédio certo (`desativarDepoisDoUltimoAceite`).
- **Comentário do `auditoriaDe`** (`professores.int.test.ts:139-140`): a ressalva sobre o `xmin` está certa. Ele é o da última escrita da linha, então a ordem só vale numa tabela que recebe apenas INSERT.
- **"Recomendações sem aplicar"**: cada item tem destino ou motivo. As recusas se sustentam: renomear o `cadastrar` mexeria em linhas que a 4.0 também altera, e o `relogio-que-recua.ts` não faz parte desta correção. A tabela "Revisões" é escrita pelo hook e não entrou no veredito.
