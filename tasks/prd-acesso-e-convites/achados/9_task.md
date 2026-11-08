# Achados das revisões — `tasks/prd-acesso-e-convites/9_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-08 09:09:36 · `tasks/prd-acesso-e-convites/9_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A tarefa 9.0 não lê nem grava `Nota`, `Correcao` ou `lancadaPor`. As escritas novas vão para `credencial_matricula`, com as três colunas da provisória, para as sessões encerradas e para `auditoria` (`senha_provisoria.gerada`). Todos com autor humano? Sim: quem gera é sempre a coordenação ou o professor, que vêm da sessão (`requestSessao()` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/credencial/senha-provisoria.service.ts`). Nenhum job, seed, importação ou webhook gera a provisória. O expurgo noturno (`retencao.expurgar-escola`) e o `desativar` só anulam as colunas.

Decisão autônoma sobre aluno: ausente. Gerar a senha é um ato pedido por uma pessoa, não uma decisão sobre a trajetória do aluno, e não há IA no caminho.

Aprovação registrada: ok, e não se aplica aqui, porque nenhuma saída de IA entra nesta tarefa. A exceção da D47 também não aparece em lugar nenhum. O ato humano fica na auditoria com autor, data e o papel no `depois`, sem a senha, o hash ou o nome (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/auditoria/acoes.ts`).

Supervisão do tutor: ok. A tarefa não toca o tutor.

Autonomia declarada e visível: sim. Nenhum agente foi criado ou alterado, e a governança ficou intacta.

O que conferi nos itens 7 e 9 (supervisão não é vigilância, medir o professor não é vigiar):
- A métrica `senha_provisoria.gerada` leva só a escola. Não leva aluno, quem gerou nem papel (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/telemetry/metrics.ts`). O painel em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/infra/grafana/paineis/fundacao.json` soma por escola, sem alerta. Com isso não há série por professor, ranking, lista de adoção nem indicador de quem não usa.
- As cotas de 60 por hora por quem gera e 5 por dia por aluno ficam no Redis, com a chave em HMAC. Servem contra abuso e não viram métrica nem tabela (`docs/lgpd.md:89`).
- Nada mede comportamento do aluno nem infere estado emocional.
- A matriz dá `nunca` à rede e ao aluno, e o professor gera só para aluno de turma com vínculo `confirmado` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/shared/src/permissao/matriz.ts`). Não é um caminho novo para a coordenação ler o professor.

Item 8 (D46/D55, discursiva e redação): não se aplica. A tarefa não tem campo, tela nem prompt de nota.

`docs/regulacao.md`: a tarefa não muda nada que ele cubra, e ele não precisa de alteração.

Bloqueantes: nenhum.

Recomendações:
- A tabela de "Arquivos previstos" da `9_task.md` lista `docs/lgpd.md` como alterado, mas ele não está no diff. A linha 81 já descreve a provisória, então parece ter entrado antes. Vale corrigir a tabela da tarefa para não confundir a validação. Isso é com o `privacy-guardian`, não é questão da regra 70.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-08 09:09:39 · `tasks/prd-acesso-e-convites/9_task.md`

VEREDITO: APROVADO

Tabelas verificadas: `credencial_matricula`. A migration `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/drizzle/0045_senha_provisoria.sql` só acrescenta colunas. `escola_id` já existia e a tabela não varia por período, então não precisa de `anoLetivoId`. `provisoria_gerada_por` é `uuid` e tem FK composta `(escola_id, provisoria_gerada_por)` com `set null` só nessa coluna. O índice parcial começa por `escola_id`.

Queries verificadas:
- `travarAlunoParaProvisoria`: a escola vem de `requireEscolaId()`, o professor de `requestSessao()` e o ano de `requireAnoEmCurso()`. O `exists` exige vínculo `confirmado` do aluno e do professor na mesma turma do ano em curso.
- `estadoDaProvisoria` e `gravarProvisoria`: filtram pela escola do contexto e pelo `usuarioId`, nas duas leituras (credencial e conta) e na gravação.
- `CicloDeVidaRepository.encerrarSessoesDoUsuario` e `apagarSenhaDaMatricula`: filtram pela escola do contexto.
- `ExpurgoDaEscolaRepository.anularProvisoriasVencidas`: `escola_id` do contexto no `update` e no `select ... for update skip locked`.
- A leitura do arquivo do titular (`leitura-do-titular.ts`, auditoria do autor) continua presa à escola e ao titular.
- A rota não tem corpo e não lê query string. O `:usuarioId` passa por `IdPipe`, e o id fora do formato UUID responde 404 igual ao inexistente.
- O `alcance` vem do papel da sessão pela matriz, não do cliente.
- A matriz tem `rede` e `aluno` como `nunca`. Não há `@Unscoped()` novo.

Teste de isolamento: presente e efetivo.
- `apps/api/test/senha-provisoria.int.test.ts:271`: a coordenação e o professor da escola A recebem o mesmo 404 do inexistente, comparado byte a byte sem o id da requisição. A credencial de B fica intacta, e o caso de controle mostra que a coordenação de B gera.
- Sem o filtro de escola nas três instruções do repository, a coordenação de A geraria para o aluno de B e o teste quebraria.
- O 404 antes do 409 está coberto pelo caso na linha 427. As cotas contadas só depois do escopo estão cobertas pelo caso na linha 557.
- No expurgo, `apps/worker/test/expurgo-da-escola.int.test.ts`: a linha de B, com a mesma idade, fica, e a mutação que tira `escola_id` está declarada.

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/credencial/credencial-matricula.repository.ts:57`: o `alcance` chega como argumento do service. Hoje ele vem do token pela matriz, mas o repository poderia derivá-lo sozinho com `alcanceDe(requestSessao().papel, ...)`. Assim ele não dependeria de quem chama (regra 10, item 3, "nunca confiado ao service").
- Mesmo arquivo, linha 64: o `eq(usuario.escolaId, escolaId)` da trava fica sem mutação própria, porque as instruções seguintes também filtram a escola. Sem ele, o efeito seria a coordenação de A travar por um instante a linha do usuário de B, sem vazar dado. Vale um teste que prove que a trava não alcança outra escola, por exemplo com `esperarNaTrava` contra o `id` de B.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-08 09:10:14 · `tasks/prd-acesso-e-convites/9_task.md`

VEREDITO: APROVADO

**Campos pessoais tocados:** três colunas novas em `credencial_matricula`: `provisoria_hash`, `provisoria_expira_em` e `provisoria_gerada_por`. Também a nova ação de auditoria `senha_provisoria.gerada`. Nela, o alvo (`entidade_id`) é o aluno e o `depois` guarda só o papel de quem gerou.

**Fora da tabela de dados do docs/lgpd.md:** nada. A linha 81 de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/docs/lgpd.md` já cobre as três colunas, com finalidade, base legal e retenção. Ela entrou na revisão da spec (`d7d14fe9`), por isso o arquivo não aparece no diff, embora estivesse na lista de arquivos previstos. Nenhum campo proibido para aluno.

**Autorização por objeto:** ok em `POST /v1/usuarios/:usuarioId/senha-provisoria`.
- O escopo está dentro da própria query que trava a linha (`travarAlunoParaProvisoria`). A escola vem do contexto. O alvo precisa ser aluno, ativo e sem eliminação agendada.
- O professor só alcança o aluno com quem divide uma turma do ano em curso, os dois com vínculo `confirmado`.
- Trocar o id na URL dá 404 igual ao do aluno que não existe nestes casos: outra escola, outra turma, aluno transferido, vínculo pendente, contestado ou encerrado, ano encerrado, id de professor ou de coordenador, pedido de reivindicação pendente, aluno desativado e id fora do formato de UUID.
- Quem não alcança o aluno nunca vê o 409 da conta da escola ligada (`ENTRA_PELA_CONTA_DA_ESCOLA`), o 409 de `CONFLITO` nem o 429 das cotas. Isso tem teste.

**Exposição:**
- A resposta tem DTO estrito (`senhaProvisoriaResponseSchema`) e sai com `Cache-Control: no-store`.
- A exceção nominal da `senha` está registrada em `contracts.test.ts`.
- O banco guarda só o hash, que passa pelo semáforo do argon2.
- `provisoria_hash` está em `COLUNAS_FORA_DO_ARQUIVO` e no `fora` da leitura do arquivo do titular.
- Um teste confirma que a senha não aparece na lista da turma, em `/v1/eu`, em `/v1/minha-turma`, na credencial nem na auditoria.

**Logs:** limpos. O service não loga. O expurgo loga só a contagem (`provisoriasAnuladasTotal`). A métrica leva só `escola_id`. As chaves das cotas no Redis usam o HMAC do id.

**Auditoria:** presente. `senha_provisoria.gerada` é gravada na mesma transação, com o autor e o papel. O teste prova que ela não guarda senha, hash, nome nem matrícula. Ela fica depois que o expurgo e a eliminação de quem gerou anulam as colunas.

**Envio externo:** nenhum. Não há IA nem terceiro nesta tarefa.

**Seed/fixture:** sintético. Os dados vêm da bancada de teste, sem nada real.

**Ciclo de vida:**
- O `desativar` agora anula a senha e as três colunas, inclusive quando só existe a provisória. Isso tem teste.
- A eliminação de quem gerou anula só `provisoria_gerada_por`, por uma FK escrita à mão com `SET NULL` só nessa coluna.
- A eliminação do aluno leva a credencial em cascata.
- O expurgo da noite anula a provisória vencida. O corte é estrito, por escola, com `skip locked`. O prazo é fixo em código e não configurável por escola, com o motivo escrito no `lgpd.md`.

**Pergunta de fechamento:** sim, com uma ressalva de sequência. Para o aluno, o fato "foi gerada uma senha provisória" só chega ao arquivo do titular na leitura por alvo da tarefa 11.0 (D85), que já está planejada nesta spec e depende da 10.0. Hoje a auditoria guarda o fato com o aluno como alvo, então o dado é encontrável, mas o arquivo gerado por código ainda não o traz.

**Bloqueantes:** nenhum.

**Recomendações:**
1. A spec não deve pousar sem a 11.0. Até lá, o arquivo do titular do aluno não mostra `senha_provisoria.gerada`, e a pergunta de fechamento depende dela.
2. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/titular/leitura-do-titular.ts:413`: a exclusão `t.acao <> 'senha_provisoria.gerada'` tira do arquivo do professor o próprio ato dele, não só o id do aluno. Uma alternativa: manter a linha com `entidade_id` nulo nessa ação, para o direito de acesso do professor (art. 18) ficar completo sem expor o aluno. A divergência está registrada na Tech Spec. Vale levar à validação.
3. `leitura-do-titular.ts:122`: `provisoria_expira_em` fica fora do arquivo do aluno por ser "estado transitório". É dado sobre o estado da credencial dele, e incluir a validade quando ela existir custa pouco. Pode ficar para a 11.0.

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-08 09:10:55 · `tasks/prd-acesso-e-convites/9_task.md`

VEREDITO: REPROVADO
Escopo: invadiu tarefa futura
Aderência à Tech Spec: divergência em `packages/shared/src/sessao/senha-provisoria.ts` (como o login confere a provisória, decidido sem estar na spec)
Portão local: carimbo válido

Bloqueantes:

- **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/shared/src/sessao/senha-provisoria.ts:4-6` e `:31-37`.** A tarefa criou e exportou a `normalizarSenhaProvisoria`, que tira qualquer separador e põe a senha em maiúsculas. O docblock diz que ela serve para o login (tarefa 10.0) e afirma duas coisas:
  - "a senha é conferida sem diferenciar caixa"
  - "abcd-efgh" e "ABCD EFGH" valem a mesma senha

  Isso é o contrato do login com a provisória, que é a 10.0. A 9.0 diz que esse login está fora do escopo dela ("Fora do escopo desta tarefa"). Nenhum documento registra essa regra: nem a `techspec.md` §5 "Senha provisória", nem o `cenarios.md`, nem o `prd.md`. Ela foi decidida em silêncio. O comentário também descreve um comportamento que nenhum código desta árvore tem. Na 9.0 a função só é usada pelos testes (`apps/api/test/senha-provisoria.int.test.ts`, linhas 154, 165, 166, 179, 211, 212, 456, 504, 603, 627).

  **Correção exigida, uma das duas:**
  - (a) Tirar a `normalizarSenhaProvisoria` da 9.0, junto com o export em `packages/shared/src/index.ts:107` e a frase sobre caixa nas linhas 4-6. Nos testes, obter a senha crua com algo local, como `senha.replace('-', '')`. Assim a regra fica para a 10.0, que já prevê alterar esse arquivo.
  - (b) Registrar a regra na `techspec.md` §5 "Senha provisória" e no `cenarios.md` (RF13), e pôr a divergência na tabela "Divergências resolvidas nesta tarefa" do `9_task.md`. A regra a registrar: o login aceita a provisória com qualquer caixa e qualquer separador, e o hash guarda os 8 caracteres sem o hífen.

Recomendações:

- **O hash espera o semáforo com a transação aberta.** Em `apps/api/src/credencial/senha-provisoria.service.ts:83`, o hash espera a vez no semáforo do argon2 com a transação aberta, segurando a trava `no key update` da linha do usuário e uma conexão do pool. Às 7h30 o semáforo enche com os logins, e cada geração prende uma conexão durante a espera. O volume é baixo (60 por hora por usuário), mas vale o `infra-guardian` olhar.
- **O `9_task.md` aponta para o `cenarios.md` sem que ele mude.** A segunda divergência da tabela (a janela de 10 s medida pela validade menos 24 h, e o motivo `senha_redefinida`) cita a seção "Corridas" do `cenarios.md`. O texto só foi para a `techspec.md` §5. É detalhe de implementação, então basta a Tech Spec, mas a referência no `9_task.md` hoje não corresponde ao que está no `cenarios.md`.
- **A janela do painel não é a do PRD.** O PRD (linha 79) pede "senhas provisórias por semana por escola". O painel em `infra/grafana/paineis/fundacao.json` mostra o aumento em 1 h. Considerar `[7d]`, ou um segundo alvo semanal.
- **A ordem do catálogo de mensagens.** Em `packages/shared/src/errors/messages.ts:42`, `ENTRA_PELA_CONTA_DA_ESCOLA` entrou antes de `VERIFICACAO_PENDENTE`, fora da ordem do `error-code.ts`. É detalhe.
- **A regra da coordenação mora num `undefined`.** Em `apps/api/src/credencial/credencial-matricula.repository.ts:89`, o ramo da coordenação depende do `and()` ignorar esse `undefined`. Funciona, mas um nome explícito ou um comentário de uma linha deixaria a regra mais legível.

## infra-guardian · 1ª rodada · REPROVADO · 2026-11-08 09:11:37 · `tasks/prd-acesso-e-convites/9_task.md`

VEREDITO: REPROVADO
Caminho quente tocado: login (o hash da provisória disputa o semáforo do argon2 com a rajada das 7h30) e migration
Rate limit: ok (60/h por quem gera e 5/dia por aluno, no Redis com o seguro em memória, nunca por IP; o semáforo divide a vez por escola)
Fila e prioridade: ok (o expurgo da provisória vencida roda no `retencao.expurgar-escola`, na fila de lote, por escola, com `skip locked`)
Concorrência: protegida. Dois "gerar" passam pela trava `FOR NO KEY UPDATE` na linha do usuário. O `desativar` atualiza o `usuario` antes de apagar a credencial, então espera a geração ou é esperado por ela. O expurgo usa `skip locked` e repete o corte no `update`. Existe o teste [P].
Índice e paginação: ok. O índice parcial `(escola_id, provisoria_expira_em)` serve o expurgo. Não há listagem nova.
Degradação de IA: não se aplica
Migration: compatível. Só expande, com três colunas nulas, FK, check e índice, numa tabela com uma linha por aluno. O índice sem `concurrently` segue o costume da casa (0034).
Métrica e alerta: ok. Há o contador por escola e o painel. Não há alerta novo, então não precisa de runbook.

Bloqueantes:

1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/credencial/senha-provisoria.service.ts:88-97`. A fila do semáforo do argon2 (até 2 s de espera, `ESPERA_MAXIMA_PELO_HASH_MS`) e o próprio hash acontecem dentro do `banco.transaction`. Durante esse tempo o pedido segura uma conexão do pool (`BANCO_POOL_MAXIMO=10` por instância) e a trava da linha do `usuario`. Às 7h30 o semáforo está saturado pela rajada. Professores gerando provisórias ao mesmo tempo prendem conexões por cerca de 2 s cada, e a leitura de sessão do login, que vem do Postgres, espera o pool. Isso estoura o teto de 100 ms de espera do pool (regra 80, item 5, nota R40).

   Há um segundo efeito. As cotas são gastas na linha 95, antes do semáforo, e o `INCR` no Redis não volta com o rollback. Cada 503 `INDISPONIVEL_TENTE_DE_NOVO` da rajada consome um dos 5 pontos diários do aluno. O professor que tenta de novo três vezes às 7h30 deixa o aluno com 2.

   Os precedentes da casa fazem o hash fora da transação: `apps/api/src/sessao/senha/senha.service.ts:173`, `apps/api/src/sala/reivindicacao/reivindicacao.service.ts:113` e `apps/api/src/operacao/convite/convite-operador.service.ts:52`.

   **Correção exigida:**
   - A espera do semáforo e o hash saem de dentro da transação e de baixo da trava.
   - Um caminho possível: conferir escopo, conta ligada, credencial e `recente` sem trava; sortear e fazer o hash pelo semáforo; depois abrir uma transação curta que trava a linha, confere tudo de novo, gasta as cotas e grava.
   - Precisam continuar valendo: quem não alcança o aluno não ocupa o semáforo nem gasta cota, e o `CONFLITO` não gasta cota, inclusive no [P].
   - O 503 do semáforo não pode consumir cota.
   - Exigir também um teste que prove que o 503 do semáforo não gasta a cota do aluno nem a de quem gera.

Recomendações:
- A métrica `senha_provisoria.gerada` só conta sucesso. Um rótulo `resultado` (gerada, conflito, limite, indisponivel), sem aluno nem autor, mostraria no painel a cota queimada na rajada sem depender do histograma HTTP genérico.
- `anularProvisoriasVencidas` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/retencao/expurgo-da-escola.repository.ts`) não tem limite de linhas por noite. Hoje o volume é pequeno (no máximo 5 por aluno por dia), mas um `limit` com o mesmo `lote` dos irmãos mantém o padrão.
- O cenário [C] de carga com provisória na rajada está na 10.0 (10.4). Quando ele entrar, vale incluir também a geração durante a rajada, não só o login com a provisória.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-08 09:11:54 · `tasks/prd-acesso-e-convites/9_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- **Caminho feliz:** a coordenação gera. O professor com vínculo confirmado gera, e também o que tem duas disciplinas na mesma turma.
- **Borda:** aluno transferido, ano letivo encerrado, escola sem ano em curso, pedido de reivindicação pendente, conta da escola ligada (só ela, ou ela e a senha), aluno sem credencial, aluno desativado ou com eliminação agendada, provisória com 23 h e com 25 h, e a borda exata do vencimento.
- **Permissão:** vínculo pendente, contestado ou encerrado. Professor de outra turma. `:usuarioId` de professor ou de coordenador. O aluno, quem não está logado e a id fora do formato.
- **Isolamento:** escola B na geração e no expurgo.
- **Cotas e conflito:** 60/h e 5/dia contadas depois do escopo. O `CONFLITO` não gasta cota.
- **[P]:** dois "gerar" ao mesmo tempo, do mesmo autor e de autores diferentes. Expurgo com `skip locked`.
- **Outros:** semáforo do argon2, auditoria, métrica, `desativar` e eliminar quem gerou, arquivo do titular de quem assina.

**Cobertos:** todas as linhas da tabela têm caso com o nome citado. Rodei `apps/api/test/senha-provisoria.int.test.ts` e os 32 casos passaram. Os dois [P] são paralelos de verdade: há uma barreira com `WriteBlockTrigger` e o segundo pedido espera na trava (`esperarNaTrava`). Os casos do expurgo usam relógio falso. Não há `.skip`, nem mock que esconda a regra, nem IA.

**Bloqueantes:**

1. **`apps/api/src/credencial/credencial-matricula.repository.ts:108`**: a condição `eq(doProfessor.turmaId, doAluno.turmaId)` não tem bloco de mutação nem motivo. É o centro da regra "turma vinculada". Sem ela, um professor confirmado em qualquer turma do ano alcança qualquer aluno confirmado no ano. A seção "Mutações" só dá motivo para os `eq` de escola e de papel do `exists`, e não para os do `innerJoin`.
   - **Correção:** um bloco que tire a condição, apontando para "professor com vínculo pendente, contestado ou encerrado" (o `deOutraTurma` fica vermelho). Para `doProfessor.anoLetivoId` e `doProfessor.escolaId` no join, basta escrever o motivo.

2. **`credencial-matricula.repository.ts:84`**: a condição `eq(usuario.id, usuarioId)` da trava não tem bloco. Sem ela, a trava devolve `true` se a escola tiver qualquer aluno ativo.
   - **Correção:** um bloco apontando para "`:usuarioId` de professor ou de coordenador da mesma escola". Esse caso dá credencial a eles, então fica vermelho.

3. **`credencial-matricula.repository.ts:138`**: no `estadoDaProvisoria`, a condição `eq(credencialMatricula.usuarioId, usuarioId)` não tem bloco. O motivo escrito cobre só o `escolaId` desse `where`. Sem ela, `temCredencial` e `recente` vêm de uma credencial qualquer da escola. Nenhum caso distingue isso com certeza: o "60 por hora" só o pegaria por sorte, dependendo da linha que o `limit(1)` escolhe.
   - **Correção:** no caso "aluno aprovado sem credencial por matrícula" (`apps/api/test/senha-provisoria.int.test.ts:351`), criar outro aluno da mesma escola com credencial. É o "segundo dado" da autoconferência, item 3. Com a cláusula tirada, o espião do semáforo passa a ser chamado. Depois, declarar o bloco.

4. **`apps/api/test/senha-provisoria.int.test.ts:459-462`**: há asserção que sempre passa, o que a regra 40 proíbe.
   - O teste gera a senha, e com isso derruba a sessão do aluno. As leituras de `/v1/eu` e `/v1/minha-turma` com `aluno.token` respondem 401, e o `not.toContain` passa no vazio. O nome do teste diz "nem no que o aluno lê", e isso não está provado.
   - As duas leituras de `/v1/turmas/:id/alunos` também não conferem o status: um 400 ou 404 passaria do mesmo jeito.
   - **Correção:** `expect(status).toBe(200)` em cada leitura. Tirar as duas leituras do aluno (e o trecho do nome do teste), ou fazê-las com uma sessão nova do aluno aberta depois da geração.

5. **`apps/api/src/sessao/sessao.module.ts`, nas linhas `janelaMs: 60 * 60 * 1000` e `janelaMs: 24 * 60 * 60 * 1000`**: a duração das janelas não é provada. Se as duas forem trocadas entre si, ou se o `porDia` virar 1 h, todos os testes continuam verdes. O "Retry-After > 0" passa nos dois casos. Assim, "5 por dia" vira "5 por hora" sem nenhum teste vermelho.
   - **Correção:** no caso "5 por dia" (linha 529), conferir que o `Retry-After` é maior que 3600. No "60 por hora" (linha 549), conferir que ele está entre 1 e 3600. Depois, um bloco de mutação para cada `janelaMs`.

**Recomendações:**
- Pôr na lista "sem bloco" o motivo do `requireEscolaId()` do `where` de `gravarProvisoria` (`credencial-matricula.repository.ts:161`). Hoje o motivo escrito fala só do `estadoDaProvisoria`.
- `tasks/prd-acesso-e-convites/9_task.md:59`: a coluna "O que prova" diz "o alvo no `it.each(CATEGORIAS_DO_EXPURGO)`", e a coluna "Caso" diz que o alvo fica fora do `it.each`. Alinhar o texto.
- Em "o aluno e quem não está logado" (`senha-provisoria.int.test.ts:376`), comparar o 404 do aluno com o do inexistente via `semRequisicao`, como os outros casos fazem, e não só pelo status.
- O `@RequirePermissao` não tem bloco. Hoje o `permissao-boot-check.test.ts` e o `alcanceDaGeracao` já o cobrem, então só vale citar isso entre os motivos.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-08 10:26:04 · `tasks/prd-acesso-e-convites/9_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. O diff da rodada 2 não toca `Nota` nem `lancadaPor`. Todos com autor humano? sim (não há caminho novo).
Decisão autônoma sobre aluno: ausente. A senha provisória é um ato da coordenação ou do professor, sempre pedido por uma pessoa, e não muda aprovação, reprovação nem encaminhamento.
Aprovação registrada: ok. Nesta tarefa não há saída de IA. O único registro é `senha_provisoria.gerada`, com o autor humano e o papel dele. A reestruturação manteve esse registro dentro da transação curta (`apps/api/src/credencial/senha-provisoria.service.ts`, `generate`, depois de `gravarProvisoria`).
Supervisão do tutor: ok. O diff não toca o Tutor.
Autonomia declarada e visível: sim. O diff não toca agentes nem a governança.
Bloqueantes: nenhum.

O que conferi no diff (`.processo/ordens/diff-9_task-r2.txt`, lido inteiro):
- O service e o repository agora trabalham em três tempos: conferência sem trava, depois o hash fora da transação, depois a transação curta que confere tudo de novo e só então gasta as cotas. Isso é uma questão de escopo, cota e pool, que pertencem às regras 10 e 80, não à 70. Nenhuma IA entra nesse fluxo.
- O painel `infra/grafana/paineis/fundacao.json` (painel 45) passou da janela de 1 h para a de 7 dias. O agregado continua só por escola e nunca leva quem gerou nem o papel. Logo não há métrica nominal de professor nem ranking, e o item 8 da regra 70 e a D45 continuam atendidos.
- A função `normalizarSenhaProvisoria` saiu de `packages/shared/src/sessao/senha-provisoria.ts` e de `packages/shared/src/index.ts`. A troca na mensagem de erro em `packages/shared/src/errors/messages.ts` é só de ordem. Os testes mudaram em `apps/api/test/senha-provisoria.int.test.ts`. Nada disso tem efeito sobre a regra 70.
- O diff não traz IA, nota, discursiva ou redação, vigilância, inferência emocional nem conversa do professor com o chat.

Recomendações: nenhuma nova pela regra 70. Esta rodada não acrescentou nenhuma correção exigida a conferir, porque a 1ª rodada já tinha aprovado sem bloqueante.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-08 10:26:08 · `tasks/prd-acesso-e-convites/9_task.md`

VEREDITO: APROVADO
Tabelas verificadas: nenhuma tabela nova nesta rodada. A `credencial_matricula` (com `escola_id` e as três colunas da 0045) não mudou desde a 1ª rodada. A árvore de trabalho é igual à árvore `1f00bc78` nos arquivos da tarefa.
Queries verificadas:
- `CredencialMatriculaRepository.#alunoQueAlcanca`, usada pelas duas conferências, `alcancaAluno` (sem trava) e `travarAlunoParaProvisoria` (`for no key update`). A escola vem de `requireEscolaId()` e o ano de `requireAnoEmCurso()`, os dois do contexto. O professor vem de `requestSessao()`. A troca de `undefined` por `sql\`true\`` no ramo `unidade` não muda o resultado.
- `estadoDaProvisoria` e `gravarProvisoria` não mudaram: as duas filtram por `escolaId` do contexto.
- `SenhaProvisoriaService.#conferir`: o 404 do escopo sai antes do 409 da conta ligada, do `CONFLITO`, do 503 do semáforo e do 429 das cotas, nas duas passagens. Quem não alcança o aluno não aprende nada pela ordem dos erros nem gasta cota. A segunda conferência, dentro da transação, cobre um aluno que sai do escopo entre o hash e a gravação.
- O endpoint não recebe `escolaId` do cliente.
Teste de isolamento: presente e efetivo. `apps/api/test/senha-provisoria.int.test.ts:275` não mudou. As mudanças desta rodada reforçam o teste:
- Um segundo aluno ativo na escola (`:255`) torna observável a mutação que tira `eq(usuario.id, usuarioId)`.
- Outro aluno com credencial (`:357`) torna observável a mutação que tira o filtro por aluno de `estadoDaProvisoria`.
- O pedido feito por um aluno passou a ser comparado com a resposta do id inexistente, e não só com o status 404 (`:383`).

A cláusula de escola é dupla: está na seleção do aluno e também em `estadoDaProvisoria`. Tirar só uma das duas não deixa o teste vermelho, o que o próprio `9_task.md` registra. Esse desenho já estava na 1ª rodada e não mudou.
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/credencial/credencial-matricula.repository.ts:138-143`: o docblock de `estadoDaProvisoria` ainda diz "o aluno que acabou de ser travado" e "Só chamar depois de `travarAlunoParaProvisoria`". Agora ele também é chamado logo depois de `alcancaAluno`, sem trava. Ajustar o texto para "depois de uma das duas conferências de escopo".
- Continua valendo a recomendação da 1ª rodada, já registrada no `TODO.md`: o repository derivar o `alcance` do token em vez de recebê-lo do service.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-08 10:26:08 · `tasks/prd-acesso-e-convites/9_task.md`

VEREDITO: APROVADO

Esta é a 2ª rodada. Auditei só o diff entre `02e9e1f2` e `1f00bc78` (8 arquivos) e o que ele afeta. A 1ª rodada não exigiu nenhuma correção, então não havia correção a conferir.

**Campos pessoais tocados:** nenhum campo novo nesta rodada. Os três de antes (`provisoria_hash`, `provisoria_expira_em`, `provisoria_gerada_por`) e os contadores das cotas continuam iguais. A linha `docs/lgpd.md` saiu da lista de arquivos de `9_task.md` porque o documento não muda nesta tarefa. Ele já registra os dois itens nas linhas 81 e 89 de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/docs/lgpd.md`, com finalidade e retenção.

**Fora da tabela de dados do docs/lgpd.md:** nada.

**Autorização por objeto:** ok.
- A seleção do aluno ficou num lugar só (`#alunoQueAlcanca`), usada pela leitura sem trava e pela trava. A escola vem do contexto e o id é filtrado, e o teste agora prova esse filtro com um segundo aluno ativo na escola.
- Trocar `undefined` por ``sql`true` `` no ramo da coordenação não abre o escopo, porque o `and` já ignorava o `undefined`. Só deixa a intenção escrita.
- A primeira conferência, fora da transação, devolve o mesmo `NAO_ENCONTRADO` de antes, e isso acontece antes do hash e das cotas.
- Por isso a nova ordem não cria um sinal pelo 503 nem pelo tempo de resposta: quem não alcança o aluno recebe 404 rápido, igual ao id inexistente. Só quem alcança o aluno chega ao semáforo.
- O teste do aluno que gera para outro aluno agora compara a resposta inteira com a do id inexistente, e não só o status.

**Logs:** limpos. Nenhum log foi adicionado no service nem no repository. A senha em claro fica só na memória, entre o sorteio e a resposta.

**Auditoria:** presente. `senha_provisoria.gerada` continua dentro da transação curta, com o aluno como alvo e o papel de quem gerou, sem senha e sem nome.

**Envio externo:** nenhum.

**Seed/fixture:** sintético.

**Bloqueantes:** nenhum.

**Recomendações:**
1. Em `apps/api/test/senha-provisoria.int.test.ts`, no teste "a resposta é a única que traz a senha" (perto da linha 453), saíram as leituras de `/v1/eu` e `/v1/minha-turma` feitas pelo aluno. A nova checagem de status 200 nas listas melhorou o teste, mas a cobertura do que o próprio aluno lê diminuiu. Sugiro voltar com as duas leituras com a mesma checagem de 200, ou registrar por que saíram.
2. A troca de `normalizarSenhaProvisoria` pelo `crua` do teste muda o contrato da tarefa 10.0. O hash agora guarda exatamente os 8 caracteres sorteados, e o login vai precisar normalizar o que o aluno digita (hífen, espaço, minúsculas) antes de conferir. Vale avisar a 10.0 para não nascer uma diferença de normalização entre a geração e o login.
3. Continuam valendo as recomendações da 1ª rodada que dependem da 11.0: a leitura por alvo do arquivo do titular e o `provisoria_expira_em` no arquivo do aluno. A pergunta de fechamento só fica respondida por completo para este dado quando a 11.0 pousar.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-08 10:26:37 · `tasks/prd-acesso-e-convites/9_task.md`

VEREDITO: APROVADO
Caminho quente tocado: login
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: compatível
Métrica e alerta: ok
Bloqueantes: nenhum

Conferi a correção exigida na 1ª rodada contra o diff e o código atual. A árvore de trabalho é igual à árvore `1f00bc78` nos arquivos da tarefa.
- **Espera do semáforo e hash fora da transação:** em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/credencial/senha-provisoria.service.ts:91-93`, a primeira conferência (`alcancaAluno`, sem trava, numa query solta), o sorteio e o `semaforo.executar` acontecem antes do `banco.transaction`. A transação curta (linhas 94-104) trava a linha, confere tudo de novo e só depois gasta as cotas e grava. Nenhuma conexão do pool nem trava da linha do `usuario` fica presa durante a espera de até 2 s.
- **Quem não alcança o aluno não ocupa o semáforo nem gasta cota:** o `#conferir` sem trava dá 404 antes do hash. O teste do aluno sem credencial e do inexistente usa `espiao` em `HashBulkhead.executar` com `not.toHaveBeenCalled()`.
- **`CONFLITO` não gasta cota, inclusive no [P]:** a primeira conferência barra o caso em série. Na corrida, quem espera a trava vê a provisória do outro na segunda conferência, antes de `#gastarAsCotas`. O teste em paralelo continua provando as quatro gerações que restam.
- **503 não gasta cota:** as cotas só saem dentro da transação, depois do hash. O teste novo (`o 503 do semáforo não gasta cota`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/test/senha-provisoria.int.test.ts:582-600`) faz seis recusas, depois cinco gerações com 200 e por fim um 429. O mock rejeita com o mesmo `INDISPONIVEL_TENTE_DE_NOVO` que o `HashBulkhead` lança (`hash-bulkhead.ts:314`). A mutação que gasta as cotas antes do sorteio está registrada e cai nesse teste.

Recomendações:
- O teste do 503 prova só a cota do aluno. A de quem gera (60 por hora) só está coberta porque as duas são gastas na mesma chamada, `#gastarAsCotas`. Sugiro conferir no Redis, depois das seis recusas, que o contador de quem gera continua zerado, ou chegar ao 429 da hora depois das recusas. Assim a garantia não depende de as duas cotas continuarem na mesma função.
- Agora o 429 custa um hash de argon2 completo, porque a cota só é conferida depois do semáforo. Isso é aceitável, já que a cota por hora limita o volume. Ainda assim, vale ler as cotas sem gastar antes do hash (um `GET` no contador) e recusar cedo quem já passou do limite. Isso tira do semáforo, às 7h30, o pedido que já se sabe que vai ser recusado.
- A remoção de `normalizarSenhaProvisoria` passa para a tarefa 10.0 a decisão sobre caixa e hífen no login com a provisória. Isso precisa ficar escrito no `10_task.md`, para o login não comparar o texto digitado com o hífen.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-08 10:27:26 · `tasks/prd-acesso-e-convites/9_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

A correção exigida na 1ª rodada foi atendida pela opção (a):
- A `normalizarSenhaProvisoria` saiu de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/shared/src/sessao/senha-provisoria.ts`, e o export saiu de `packages/shared/src/index.ts`.
- A frase sobre caixa saiu do docblock do alfabeto, que agora diz só "Só maiúsculas e algarismos."
- Nenhuma referência a ela sobrou em `apps`, `packages` ou `tools`. Os testes de `apps/api/test/senha-provisoria.int.test.ts` usam a `crua` local, `senha.replace('-', '')`.
- A regra de caixa e separador do login fica para a 10.0.

Também conferi:
- **Árvore igual à da rodada.** A árvore atual é a da rodada `1f00bc78`. A única diferença é a tabela "Revisões" do `9_task.md`, que o hook preenche.
- **Ordem nova do service.** Agora é: conferência sem trava, depois o hash pelo semáforo fora da transação, depois a transação curta, que trava a linha, confere de novo, gasta as cotas e grava. Isso continua dentro da Tech Spec §5 "Senha provisória". A spec pede trava, depois escopo e conta ligada, e só então a gravação; isso acontece dentro da transação. A spec não exige o hash dentro dela.
- **Leituras do aluno no teste da senha.** As leituras de `/v1/eu` e `/v1/minha-turma` saíram do teste. Elas passavam no vazio, porque a geração derruba as sessões do aluno. O nome do caso e a linha 52 da tabela de testes do `9_task.md` já não prometem essa leitura.

Recomendações:
- **`TODO.md` vazio.** "Recomendações sem aplicar", no `9_task.md` (linhas 565, 569 e 570), dá três destinos como `TODO.md`. O `TODO.md` não foi alterado na árvore. Pelo modelo da tarefa (`task-template.md`, "Recomendações sem aplicar"), destino `TODO.md` é linha já escrita no commit da tarefa. Quem fecha o commit precisa escrever essas três linhas, ou mudar o destino.
- **Parâmetro `travar` do `#conferir`.** Em `apps/api/src/credencial/senha-provisoria.service.ts:121`, esse booleano escolhe entre dois métodos do repository. Seria mais legível passar a função de alcance, ou ter dois chamadores explícitos.
- **`ENTRA_PELA_CONTA_DA_ESCOLA` mudou de lugar sem motivo.** Em `packages/shared/src/errors/messages.ts`, a entrada foi movida para depois de `VERIFICACAO_PENDENTE`. Isso só muda a ordem e deixa o diff mais ruidoso.

## test-engineer · 2ª rodada · REPROVADO · 2026-11-08 10:28:04 · `tasks/prd-acesso-e-convites/9_task.md`

VEREDITO: REPROVADO

Cenários exigidos: caminho feliz (a coordenação e o professor com vínculo confirmado geram). Bordas: aluno transferido, professor com duas disciplinas na turma, ano encerrado, escola sem ano em curso, aluno sem credencial, conta da escola ligada, provisória vencida no expurgo. Permissão: vínculo pendente, contestado ou encerrado, professor de outra turma, `:usuarioId` de professor ou coordenador, aluno, quem não está logado. Isolamento: aluno da escola B, e o expurgo da A não toca a B. Concorrência: dois "gerar" em paralelo, e o expurgo com a linha travada. Cotas de 60 por hora e 5 por dia, e o 503 do semáforo que não gasta cota. Nesta rodada, o novo desenho em três tempos: conferência sem trava, hash fora da transação, transação curta.

Cobertos (as cinco correções exigidas foram feitas):
1. **`doProfessor.turmaId`:** o bloco novo aponta para "professor com vínculo pendente…". O `deOutraTurma` (linha 245), já confirmado na `outraTurma`, passaria a gerar e o teste fica vermelho. Os demais `eq` do `innerJoin` têm motivo escrito.
2. **`eq(usuario.id, usuarioId)`:** o bloco existe, e o caso ganhou `novoAluno(s, s.turma)` (linha 255). Sem o filtro, o professor e o coordenador com credencial recebem senha, e o teste fica vermelho.
3. **`estadoDaProvisoria` por aluno:** há o segundo aluno com credencial (linha 360) e o bloco com `falha: not.toHaveBeenCalled()`. Ele é coerente: a resposta continua 404, porque o `gravarProvisoria` por aluno não acha linha, mas o hash é calculado.
4. **Asserção que sempre passava:** as leituras do aluno saíram e o nome do teste mudou. As duas listas conferem 200 e contêm o `usuarioId` do aluno (linhas 468-469). A linha da tabela continua casando com o nome novo.
5. **Duração das janelas:** o `Retry-After` maior que 3600 no caso "5 por dia" e entre 1 e 3600 no "60 por hora" (linhas 540-542 e 590-592). Cada `janelaMs` tem o seu bloco, e as duas trocas ficariam vermelhas.

A corrida continua provada de verdade: duas chamadas em paralelo, com `WriteBlockTrigger` e `esperarNaTrava` na trava do `usuario`. O bloco que tira a trava da conferência na transação aponta para ela. Não há `.skip` nem provedor pago.

Bloqueantes:
1. **`apps/api/src/credencial/senha-provisoria.service.ts:91`**: a chamada `await this.#conferir(new CredencialMatriculaRepository(banco), alunoId, alcance, false)` é nova nesta rodada e não tem bloco de mutação nem motivo.
   - É ela que impede quem não alcança o aluno de ocupar o semáforo do argon2 (regra 80), e também segura o `CONFLITO` antes do hash.
   - Os blocos de hoje só trocam o `alcance` dela ou movem as cotas para antes dela. Nenhum a remove. O `--faltando` não a lista porque a linha não tem condição, mas é uma cláusula nova.
   - **Correção:** um bloco que remova a linha 91, apontando para "o hash passa pelo semáforo do argon2" com `falha: not.toHaveBeenCalled()`. Sem a chamada, o professor de outra turma chega ao `executar` (linhas 488-489).
2. **`apps/api/src/credencial/senha-provisoria.service.ts:93`**: falta teste para o hash fora da transação e com a linha do aluno destravada. Era a correção central desta rodada (infra-guardian e revisor-geral, 1ª rodada), e o docblock das linhas 62-63 e a autoconferência, item 12, a afirmam.
   - A mutação que põe o `semaforo.executar(...)` de volta dentro da transação, logo depois de `#conferir(credenciais, …, true)` e antes de `#gastarAsCotas`, deixa todos os testes verdes. O caso do 503 continua sem gastar cota, a corrida continua 200 e 409, e o espião continua com uma chamada só.
   - **Correção:** um caso que espie o `executar` e, antes de deixá-lo seguir, tente pela `bancada.pool` um `select 1 from usuario where id = $1 for no key update nowait`, numa transação desfeita logo depois. A asserção é que não haja erro `55P03`, ou seja, a linha não está travada enquanto o hash roda.
   - Depois, um bloco de mutação que mova o hash para dentro da transação, apontando para esse caso.

Recomendações:
- O caso novo "o 503 do semáforo não gasta cota" não está citado na tabela "Testes que provam a regra" (linha 54, a das cotas). O caso pedido no bloqueante 2 também precisa entrar nela.
- O caso do 503 simula a saturação com `mockRejectedValue` no `HashBulkhead`. É aceitável, porque prova sem pôr a máquina sob carga, mas vale uma linha no teste dizendo por que não se satura o semáforo de verdade.
- Com a `normalizarSenhaProvisoria` fora, o hash guarda os 8 caracteres crus. A tarefa 10.0 precisa normalizar o que o aluno digita (hífen, espaço, minúsculas) antes de conferir, e isso precisa ficar escrito no `10_task.md`. Já está nos achados de outro revisor.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/credencial/senha-provisoria.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/credencial/credencial-matricula.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/test/senha-provisoria.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tasks/prd-acesso-e-convites/9_task.md

## revisor-geral · 3ª rodada · APROVADO · 2026-11-08 10:56:26 · `tasks/prd-acesso-e-convites/9_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/test/senha-provisoria.int.test.ts:500-527`: a sonda usa `for no key update nowait`. Por isso o teste só prova que nenhuma trava conflitante está presa. Não prova que nenhuma transação está aberta. Hoje isso basta, porque a única trava da transação curta é `for('no key update')` (`credencial-matricula.repository.ts:86`). Mas se um dia a transação abrir antes do hash sem travar a linha, o teste passa. Se quiserem cobrir esse caso, contem as conexões `idle in transaction` em `pg_stat_activity` durante a espera.

O diff desta rodada só mexe em teste e documento:
- **O teste novo prova a regra.** Ele confere se a linha do usuário do aluno está livre enquanto o hash espera o semáforo. Com a mutação registrada (o hash entra na transação depois de `travarAlunoParaProvisoria`), a sonda pegaria `55P03`, porque `for no key update` entra em conflito com outro `for no key update`. O teste chama o `executar` de verdade depois da sonda, então o fluxo continua inteiro.
- **O resto do diff não pede correção.** O comentário no teste do 503 está certo. As linhas da matriz do `9_task.md` estão de acordo com o docblock do serviço e com a ordem real em `senha-provisoria.service.ts:83-95`: conferência sem trava, hash fora da transação, depois a transação com nova conferência, as cotas e a gravação. Os dois blocos de mutação novos miram a linha que cada teste protege.
- **Os arquivos fora do git são os mesmos da rodada.** A árvore atual tem, sem diferença, os mesmos arquivos ainda não versionados da árvore `35635b93`. O diff que recebi cobre tudo o que mudou.
- **Não havia correção exigida a conferir.** As recomendações da 2ª rodada estão anotadas na tabela de recomendações sem aplicar, cada uma com destino e motivo.

## test-engineer · 3ª rodada · APROVADO · 2026-11-08 10:56:51 · `tasks/prd-acesso-e-convites/9_task.md`

VEREDITO: APROVADO

Cenários exigidos (o que esta rodada precisava corrigir):
1. Uma mutação que remova a conferência sem trava (`senha-provisoria.service.ts:91`), apontando para o teste do semáforo.
2. Um teste que prove que o hash roda fora da transação e com a linha do aluno destravada, com uma mutação que leve o hash de volta para dentro da transação.

Cobertos:
1. **Correção 1, feita.** O bloco novo remove a linha 91, e as linhas de contexto dele batem com as linhas 90 e 92 do service. Sem essa conferência, o professor de outra turma chega ao `semaforo.executar` antes de a transação devolver 404. A resposta continua 404, mas `expect(espiao).not.toHaveBeenCalled()` falha em `apps/api/test/senha-provisoria.int.test.ts:489`, que é a linha do `falha:` do bloco.
2. **Correção 2, feita.** O caso "o hash espera o semáforo fora da transação, com a linha do aluno destravada" está em `apps/api/test/senha-provisoria.int.test.ts:500-527`.
   - O espião do `executar` abre outra conexão pela `bancada.pool` e roda `for no key update nowait` na linha do usuário do aluno. Depois desfaz a transação e só então chama o `executar` de verdade.
   - O erro não é lançado de dentro do espião. Ele fica guardado em `travas` e é conferido depois, então a falha não vira um 500 que cairia no `resposta`.
   - Conferi que a sonda pega mesmo a trava: `travarAlunoParaProvisoria` usa `.for('no key update')` (`credencial-matricula.repository.ts:86`), e `FOR NO KEY UPDATE` conflita consigo mesmo. Sob a mutação, a sonda recebe `55P03` e `expect(travas).toEqual([null])` falha na linha 526, que é a do `falha:` do bloco.
   - O contexto do bloco que leva o hash para dentro da transação bate com as linhas 92 a 97 do service.
   - A asserção `toEqual([null])` também exige que o `executar` tenha sido chamado exatamente uma vez. Um espião que nunca fosse chamado não passaria.
3. **Tabela de testes.** As linhas "o hash" e "cotas" do `9_task.md` agora citam os casos novos pelo nome, e os dois existem no arquivo, incluindo "o 503 do semáforo não gasta cota". O comentário que explica por que o 503 é simulado está certo.
4. **Execução.** Rodei `npx vitest run apps/api/test/senha-provisoria.int.test.ts` e os 34 casos passaram. Não há `.skip`, teste comentado nem chamada a provedor de IA.

Bloqueantes: nenhum.

Recomendações:
- O caso novo prova que a linha está livre enquanto o hash roda. Não prova que nenhuma conexão do pool fica presa. Uma mutação que abrisse uma transação sem trava antes do hash passaria. Para cobrir isso, dá para contar no `pg_stat_activity` as conexões da API em `idle in transaction` dentro do espião. Fica para o `TODO.md`.
- O docblock de `estadoDaProvisoria` (`credencial-matricula.repository.ts:138-143`) ainda diz que só pode ser chamado depois da trava. Já está registrado com destino `TODO.md` na tabela de recomendações da 2ª rodada.
