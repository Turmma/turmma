# Achados das revisões — `tasks/correcoes/2026-11-17-prazo-do-pedido-na-virada-do-dia.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-17 00:38:22 · `tasks/correcoes/2026-11-17-prazo-do-pedido-na-virada-do-dia.md`

VEREDITO: APROVADO
Tabelas verificadas: nenhuma. A tarefa não cria nem altera migration nem schema.
Queries verificadas: nenhuma nova. A semeadura (`criarPedidoDoTitularNoBanco`, `criarPedidosDoTitularNoBanco`, `criarPedidoDeTitularEliminadoNoBanco`) continua recebendo o `escolaId` da coordenadora do próprio cenário, e o diff não mexe nisso. Nenhum repository, endpoint ou `@Unscoped()` foi tocado. A mudança fica em `e2e/` e `tools/ci/`.
Teste de isolamento: não se aplica. A correção mexe só na conta de data das asserções de prazo e não muda escopo de tenant, então não precisa de teste de isolamento novo.
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tasks/correcoes/2026-11-17-prazo-do-pedido-na-virada-do-dia.md`: a seção "Correção" diz que `e2e/support/pedidos-do-titular.ts` reexporta `diaCurto`, mas o diff só remove a função e não a reexporta. Hoje ninguém fora de `e2e/support/prazo-do-pedido.ts` usa `diaCurto`. O melhor é ajustar o texto da tarefa para bater com o código.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-17 00:38:26 · `tasks/correcoes/2026-11-17-prazo-do-pedido-na-virada-do-dia.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A tarefa só mexe em código de teste: duas specs do e2e, um ajudante puro e um teste unitário em `tools/ci/`. Nenhum arquivo de `apps/*/src` nem de `packages/*/src` mudou, e não há migration, DTO, rota ou query nova.
Fora da tabela de dados do docs/lgpd.md: nada.
Autorização por objeto: ok. Nenhuma rota nova ou alterada. As specs continuam abrindo o pedido pelo fluxo da coordenadora da própria escola, como antes.
Logs: limpos. Nem `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/e2e/support/prazo-do-pedido.ts` nem `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/ci/prazo-do-pedido-no-e2e.test.ts` escrevem log. O ajudante só calcula datas e monta texto a partir do dia (`AAAA-MM-DD`) e de um número de dias, sem nada de pessoa.
Auditoria: presente. Nenhuma ação que exige auditoria foi tocada, e as asserções de auditoria do pedido nas specs continuam como estavam.
Envio externo: nenhum.
Seed/fixture: sintético. Os nomes e as matrículas continuam gerados com `marca()` (por exemplo `Vencida ${marca()} Lopes` e `Gabriela ${marca()} Moura`), e as datas do teste unitário são fixas (`2026-11-03`).
Bloqueantes: nenhum.
Recomendações:
- O texto da tarefa não bate com o código. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tasks/correcoes/2026-11-17-prazo-do-pedido-na-virada-do-dia.md` diz que `e2e/support/pedidos-do-titular.ts` reexporta `diaCurto`, mas o diff só o remove de lá, sem reexportar. Hoje ninguém importa `diaCurto` desse arquivo, então nada quebra, mas a seção "Correção" precisa ser corrigida para dizer o que o código faz, ou a reexportação precisa entrar. A falha não tem a ver com privacidade e fica para o `revisor-geral`.

Pergunta de fechamento: a tarefa não mexe no que o sistema guarda sobre o aluno nem para onde o dado é enviado. A resposta que o arquivo do titular já dava não muda.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-17 00:38:34 · `tasks/correcoes/2026-11-17-prazo-do-pedido-na-virada-do-dia.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. A mudança só mexe em código de teste (dois e2e, um ajudante do e2e e uma unidade em `tools/ci`). Nada em `apps/*/src` nem em `packages/*/src` foi alterado, e a semeadura de `Nota` continua como estava. Todos com autor humano? Sim, porque nenhum caminho novo foi criado.
Decisão autônoma sobre aluno: ausente. O assunto é o prazo legal do pedido do titular (LGPD), sem IA e sem nada sobre a trajetória do aluno.
Aprovação registrada: ok. Nenhuma saída de IA passa por aqui.
Supervisão do tutor: ok. O tutor não é tocado.
Autonomia declarada e visível: sim. Nada muda nesta tarefa.

Bloqueantes: nenhum.

Itens 1 a 9 da regra 70, conferidos:
- **Itens 1 e 8:** nenhum campo, tela ou prompt de nota foi criado ou mudado, e nada propõe nota em discursiva ou redação.
- **Item 7:** os testes do prazo mostram ao coordenador o andamento do pedido. Nada novo aparece sobre o comportamento do aluno, e o sistema não infere estado emocional.
- **Item 9:** nenhuma métrica de professor foi tocada.
- **Escopo:** `git diff --stat HEAD` mostra só os três arquivos do e2e alterados, mais os novos `e2e/support/prazo-do-pedido.ts` e `tools/ci/prazo-do-pedido-no-e2e.test.ts`.
- **Teste:** rodei `tools/ci/prazo-do-pedido-no-e2e.test.ts` e passaram 5 de 5. Os casos recusam a combinação da conta antiga, em que o vencimento andava junto com o relógio. Assim o teste confere a regra do prazo, e não só que o texto aparece.

Recomendações:
- A tarefa diz que `e2e/support/pedidos-do-titular.ts` "reexporta" `diaCurto`, mas o diff só tira a função de lá, sem reexportar. Nada mais usa `diaCurto` nem `somarDiasAHoje` (procurei em `e2e/` e `tools/`), então o código está certo. Só a frase do arquivo da tarefa precisa ser ajustada para dizer que a função foi movida para `e2e/support/prazo-do-pedido.ts`.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tasks/correcoes/2026-11-17-prazo-do-pedido-na-virada-do-dia.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/e2e/support/prazo-do-pedido.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/ci/prazo-do-pedido-no-e2e.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/e2e/pedido-do-titular.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/e2e/pedidos-do-titular.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/e2e/support/pedidos-do-titular.ts

## infra-guardian · 1ª rodada · APROVADO · 2026-11-17 00:38:37 · `tasks/correcoes/2026-11-17-prazo-do-pedido-na-virada-do-dia.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok (a tarefa não mexe nisso)
Fila e prioridade: ok (a tarefa não mexe nisso)
Concorrência: protegida (nenhuma operação nova de produção; só código de teste)
Índice e paginação: ok (nenhuma query nova; a semeadura continua em `e2e/support/seed.ts`, sem alteração)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (nenhum código novo no caminho quente; nada em `apps/*/src` nem em `packages/*/src`)
Bloqueantes: nenhum
Recomendações:
- O texto do prazo agora está escrito em dois lugares: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/e2e/support/prazo-do-pedido.ts` copia `textoDoPrazo`, `dias` e `diaCurto` de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/areas/coordenacao/privacidade/textos-do-pedido.ts`. Se a frase mudar na tela, o e2e cai, e isso é o esperado. Mas o 15 de `PRAZO_DA_DECLARACAO_COMPLETA_DIAS` também está repetido no teste. Vale citar a origem desse número no comentário, para quem mudar o prazo na regra saber que precisa mudar aqui também.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/e2e/pedido-do-titular.spec.ts:468` aceita qualquer texto que case `/Faltam 1[45] dias/`, sem conferir a data. Os outros casos usam `prazoNaTela` e conferem o vencimento. Se o caso guardar o dia antes do registro pela tela, dá para usar `prazoNaTela(dia, 0)` aqui também.

O teste novo, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/ci/prazo-do-pedido-no-e2e.test.ts`, passa (5 de 5). A checagem de tipos de `e2e/tsconfig.json` não acusa erro. Nenhum arquivo ainda usa `somarDiasAHoje`, que a tarefa removeu. Não rodei o e2e no Playwright.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-17 00:38:48 · `tasks/correcoes/2026-11-17-prazo-do-pedido-na-virada-do-dia.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. A correção só mexe em código de teste. Nenhum arquivo de `apps/*/src` nem de `packages/*/src` mudou, então não há divergência a registrar na `techspec.md` nem no `cenarios.md`.
Portão local: carimbo válido. O `conferir` disse "portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)".
Bloqueantes: nenhum.

O que conferi:
- Todos os lugares que o documento aponta foram trocados para `prazoNaTela`: as linhas 139, 155 e 466 de `e2e/pedido-do-titular.spec.ts` e as 662, 692, 764 e 767 de `e2e/pedidos-do-titular.spec.ts`. Não sobrou nenhum uso de `somarDiasAHoje`, e não há outro "Faltam" ou "vencido há" escrito fixo em `e2e/`.
- O ajudante `e2e/support/prazo-do-pedido.ts` dá os mesmos textos que a tela, em `apps/web/src/areas/coordenacao/privacidade/textos-do-pedido.ts:96-113`: "vence hoje", "Falta" no singular e "vencido há". Ele também calcula o vencimento como a tela: chegada mais 15 dias.
- O dia de "ontem" da lista (`comoNaTela(somarDias(diaDaSemeadura, -1))`) agora sai do mesmo dia que a semeadura gravou, `(now() at time zone 'America/Sao_Paulo')::date - n` em `e2e/support/seed.ts`. A conta antiga voltava um dia a partir da hora da asserção e tinha o mesmo furo.
- O teste de unidade em `tools/ci/prazo-do-pedido-no-e2e.test.ts` entra na suíte de unidade, porque o `vitest.config.ts` só deixa `e2e/**` de fora. Ele aceita a leitura feita depois da virada e recusa o par que a esteira 44004811034 produziu.

Recomendações:
1. Ainda sobra uma janela pequena. O teste lê `hoje()` antes de semear, em `e2e/pedido-do-titular.spec.ts:127` e `e2e/pedidos-do-titular.spec.ts:645` e `:752`. Se a meia-noite cair entre essa leitura e o `insert`, a chegada fica com o dia seguinte e o regex recusa. São poucos milissegundos e a chance é muito menor que antes. Para fechar de vez, dá para devolver o `chegou_em` gravado pelos ajudantes `criarPedido*NoBanco` e calcular a partir dele, sem precisar do relógio do teste.
2. Em `e2e/support/prazo-do-pedido.ts:11-27` estão de novo a constante de 15 dias, o `diaCurto` e o `textoDoPrazo`, que já existem em `textos-do-pedido.ts`. O e2e espelhar o texto à mão é aceitável e já era assim. Ainda assim, vale escrever no cabeçalho do ajudante que ele espelha `textoDoPrazo` da tela, para quem mudar o texto lá saber que precisa mudar aqui também.
3. `e2e/pedido-do-titular.spec.ts:468` usa `/Faltam 1[45] dias/`, uma conta à mão que não passa pelo ajudante. Funciona. Para ficar como o resto, o vencimento poderia ser conferido com `prazoNaTela(diaDoRegistro, 0)`, guardando o dia antes do registro.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-17 00:39:39 · `tasks/correcoes/2026-11-17-prazo-do-pedido-na-virada-do-dia.md`

VEREDITO: REPROVADO

Cenários exigidos:
- Caminho feliz: semear e ler a tela no mesmo dia mostra o prazo exato.
- Virada da meia-noite em São Paulo depois da semeadura, antes da leitura: o vencimento continua o mesmo e o `Faltam N` desce um.
- Virada entre o momento em que o teste lê `hoje()` e a gravação no banco.
- Bordas da contagem: prazo vencido, o dia do vencimento ("vence hoje") e o singular ("Falta 1 dia").
- Pedido registrado pela tela, que chega no dia de hoje.
- A combinação errada da esteira é recusada: `Faltam 4 dias, até 08/11/2026`, montada com o dia da asserção.
- Permissão e isolamento não se aplicam. A correção só mexe em código de teste, e nenhum arquivo de `apps/*/src` ou `packages/*/src` mudou. Por isso a falta de bloco de mutação está correta.

Cobertos:
- `tools/ci/prazo-do-pedido-no-e2e.test.ts` passa, 5 de 5.
  - O caso `aceita a leitura do mesmo dia e a da virada` cobre a leitura no mesmo dia e no dia seguinte.
  - O caso `recusa a combinação que a conta antiga esperava` recusa `até 08/11` e também `Faltam 5` e `Faltam 2`.
  - O caso do vencido checa que o vencimento não anda com o relógio.
  - O caso do dia do vencimento cobre "vence hoje" e o singular.
- O teste falharia sem a regra. Se o ajudante calculasse o vencimento a partir do dia da leitura, a linha 24 falharia. Se aceitasse só o mesmo dia, a linha 18 falharia.
- Os textos do ajudante batem com `apps/web/src/areas/coordenacao/privacidade/textos-do-pedido.ts:103-113`.
- As 7 asserções de prazo dos dois specs passaram para `prazoNaTela`.
- Não sobrou nenhum uso de `somarDiasAHoje`.
- Não há `.skip` nem mock.

Bloqueantes:
1. **A corrida da meia-noite ficou mais curta, mas não acabou.** O documento diz que "o vencimento sai da semeadura", mas `diaDaSemeadura` vem do relógio do Node (`hoje()`, em `e2e/support/pedidos-do-titular.ts:43`). A `chegou_em` vem do `now()` do Postgres em cada INSERT (`e2e/support/seed.ts:1342`, `:1359`, `:1399`). Se a meia-noite cair entre os dois, o vencimento gravado fica um dia depois do que `prazoNaTela` aceita, e o caso fica vermelho. O teste continua dependendo da hora em que roda, e é esse o defeito que a correção existe para tirar.
   - `e2e/pedidos-do-titular.spec.ts:645`: o caso mais exposto. `hoje()` é lido antes de 50 INSERTs em sequência (`seed.ts:1339-1345`) e mais o pedido do titular eliminado. A linha conferida em `:662` e `:664` é justamente a do último INSERT.
   - `e2e/pedido-do-titular.spec.ts:127`: o mesmo problema, com três semeaduras depois do `hoje()`.
   - `e2e/pedidos-do-titular.spec.ts:752`: o mesmo problema, com duas semeaduras.
   - Correção exigida: tirar o dia da semeadura do mesmo relógio que grava a chegada. Dá para fazer de dois jeitos:
     - a semeadura devolve a `chegou_em` gravada, ou um `select (now() at time zone 'America/Sao_Paulo')::date` na mesma conexão e transação dos INSERTs;
     - o teste lê de volta a `chegou_em` do pedido e soma `chegouHaDias`.
2. **O teste citado no documento não existe.** `tasks/correcoes/2026-11-17-prazo-do-pedido-na-virada-do-dia.md:32` cita o caso `a leitura depois da meia-noite não é a que o teste esperava com o dia de hoje no instante da asserção`. Nenhum caso com esse nome existe em `tools/ci/prazo-do-pedido-no-e2e.test.ts`. O que o documento descreve está repartido entre `aceita a leitura do mesmo dia e a da virada, com o mesmo vencimento` (linha 14) e `recusa a combinação que a conta antiga esperava depois da virada…` (linha 21). Correção exigida: o documento citar esses dois casos pelo nome, ou o teste ganhar um caso com o nome citado.

Recomendações:
- **A tolerância ficou maior do que precisa.** `prazoNaTela` aceita `N` e `N-1` dias sempre, e `e2e/pedido-do-titular.spec.ts:468` aceita `/Faltam 1[45] dias/` sempre. Um erro de um dia a menos na contagem da tela passaria no e2e. Hoje ele é pego só pela unidade em `textos-do-pedido.test.ts`. Sugestão: ler `hoje()` também depois da asserção e aceitar a leitura do dia seguinte só quando o dia de fato mudou.
- **O documento descreve uma reexportação que não existe.** Ele diz que `e2e/support/pedidos-do-titular.ts` reexporta `diaCurto`, mas o diff só remove a função de lá. Nada quebra, porque nenhum arquivo importa `diaCurto` desse módulo. Corrigir o texto do documento.
- **`textoDoPrazo` foi copiado da produção para o ajudante.** A cópia mantém o teste independente da produção, o que é uma escolha válida, mas pode divergir quando o texto da tela mudar. Vale um comentário em `e2e/support/prazo-do-pedido.ts` apontando para `textos-do-pedido.ts:85`.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/e2e/support/prazo-do-pedido.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/ci/prazo-do-pedido-no-e2e.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/e2e/pedido-do-titular.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/e2e/pedidos-do-titular.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/e2e/support/seed.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tasks/correcoes/2026-11-17-prazo-do-pedido-na-virada-do-dia.md

## revisor-geral · 2ª rodada · APROVADO · 2026-11-17 00:59:26 · `tasks/correcoes/2026-11-17-prazo-do-pedido-na-virada-do-dia.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. A correção mexe só em código de teste, como o documento declara; nenhum arquivo de `apps/*/src` nem de `packages/*/src` foi alterado.
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

As três recomendações da 1ª rodada e as duas exigências do test-engineer foram atendidas:
- **Janela da meia-noite.** Nos três casos, o dia vem uma vez de `diaDeHojeNoBanco()` e vai para o INSERT por `coalesce($n::date, …)`. Assim, a `chegou_em` gravada e o dia que `prazoNaTela` usa saem do mesmo valor (`e2e/support/seed.ts:1337-1431`, `e2e/pedido-do-titular.spec.ts:128-131`, `e2e/pedidos-do-titular.spec.ts:646-648` e `750-752`). O `semear` local repassa o campo pelo spread (`e2e/pedido-do-titular.spec.ts:88`).
- **Registro pela tela.** O caso lê a `chegou_em` de volta do banco com `unicoPedidoNoBanco`, que a devolve formatada por `to_char` como `AAAA-MM-DD`, e confere `prazoNaTela(chegouEm, 0)` (`e2e/pedido-do-titular.spec.ts:469-470`). A expressão regular `/1[45]/` saiu.
- **Espelho.** O cabeçalho de `e2e/support/prazo-do-pedido.ts` aponta para `textos-do-pedido.ts`, e a constante dos 15 dias também.
- **Documento.** Ele cita os dois casos que existem pelo nome e corrige a frase da reexportação (`diaCurto` saiu de `pedidos-do-titular.ts`, e o diff confirma a remoção). A tabela "Recomendações sem aplicar" tem a linha correspondente no `TODO.md`.

Recomendações:
- `e2e/support/seed.ts:1428`: se a consulta não trouxer linha, `diaDeHojeNoBanco` devolve `''` sem avisar. Esse texto vazio só falharia mais adiante, no `''::date` do INSERT ou no `Date.parse` de `prazoNaTela`, longe da causa. É melhor lançar o erro ali mesmo, como faz `unicoPedidoNoBanco` (`e2e/pedido-do-titular.spec.ts:109`).
- Fora da correção, só para registro: a tela conta o prazo pelo relógio do navegador, e o dia da semeadura vem do relógio do banco. Hoje os dois rodam na mesma máquina na esteira, e a tolerância de um dia de `prazoNaTela` cobre a diferença. Se o banco for para outro host com o relógio adiantado, essa suposição deixa de valer.

Arquivos conferidos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/e2e/support/seed.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/e2e/support/prazo-do-pedido.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/e2e/pedido-do-titular.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/e2e/pedidos-do-titular.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tasks/correcoes/2026-11-17-prazo-do-pedido-na-virada-do-dia.md

## test-engineer · 2ª rodada · APROVADO · 2026-11-17 00:59:34 · `tasks/correcoes/2026-11-17-prazo-do-pedido-na-virada-do-dia.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- Caminho feliz: a tela é lida no mesmo dia em que o pedido foi semeado.
- Borda: a meia-noite cai entre a semeadura e a leitura da tela.
- Borda: a meia-noite cai entre o relógio do Node e o do Postgres. Esta foi a correção exigida 1.
- Borda: a meia-noite cai entre dois INSERTs do mesmo caso.
- Borda: o pedido registrado pela tela, que parte do dia do formulário.
- Borda: o vencido conta os dias que passaram, o vencimento hoje ainda é prazo, e um dia vai no singular.
- O teste precisa recusar a conta antiga, aquela em que o vencimento anda com o relógio.
- Permissão e isolamento não se aplicam: só muda código de teste, sem rota, repository nem tela.

**Cobertos:**
- **Correção 1, feita.** `diaDeHojeNoBanco()` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/e2e/support/seed.ts:1384`) lê o dia de São Paulo pelo relógio do banco, uma vez por caso. Os três semeadores gravam a chegada a partir desse dia com `coalesce($n::date, ...)`, nas linhas 1342, 1359 e 1401. Os três casos leem o dia antes de semear e passam a todas as semeaduras:
  - `e2e/pedido-do-titular.spec.ts:128-131`
  - `e2e/pedidos-do-titular.spec.ts:646-648`
  - `e2e/pedidos-do-titular.spec.ts:750-752`

  Com isso a data de chegada é a mesma em todos os pedidos do caso, e é a mesma que o teste usa. A única corrida que sobra é entre a semeadura e a leitura da tela, e a tolerância de mesmo dia ou dia seguinte cobre essa.
- **O caso do registro pela tela** (`e2e/pedido-do-titular.spec.ts:469-470`) agora lê de volta a data de chegada que o banco guardou. `pedidosDoTitularNoBanco` devolve essa data com `to_char(..., 'YYYY-MM-DD')` (`seed.ts:1314`), no formato que `prazoNaTela` espera. Antes, o caso aceitava 14 ou 15 escritos à mão.
- **A lista**: a linha de ontem (`somarDias(diaDaSemeadura, -1)`, `pedidos-do-titular.spec.ts:665`) e a mais antiga (`prazoNaTela(diaDaSemeadura, 50)`, linha 691) batem com 1 + 49 = 50 dias.
- **Correção 2, feita.** O documento (linha 32) cita os dois casos pelo nome exato, e os dois existem em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/ci/prazo-do-pedido-no-e2e.test.ts:14` e `:21`. A unidade tem asserções positivas e negativas, inclusive a combinação da esteira 44004811034. Rodei o arquivo: 5 de 5 passaram.
- **Mutações**: o documento traz `--faltando: 0`. A correção só mexe em `e2e/` e `tools/ci/`, nada em `apps/*/src` nem em `packages/*/src`, então não precisa de bloco.
- **A recomendação da rodada anterior**, a tolerância de N e N-1, está registrada na tabela "Sem aplicar" com destino e motivo, e a linha correspondente está no `TODO.md`.
- Não há `.skip`, nem mock que esconda a regra, nem provedor de IA.

**Bloqueantes:** nenhum.

**Recomendações:**
1. Outros pontos dos e2e ainda leem o dia pelo `hoje()` do Node. Eles têm a mesma corrida da meia-noite, mas não são o prazo, que é o que esta correção trata:
   - o dia no diálogo de confirmação (`e2e/pedidos-do-titular.spec.ts:99`);
   - o `max` e o preenchimento do campo de data (`e2e/pedidos-do-titular.spec.ts:154`, `:168`, `:201`);
   - o nome do arquivo baixado (`e2e/pedido-do-titular.spec.ts:694`, `:701`).

   Se algum deles falhar na esteira, a correção vai no mesmo molde. Também vale considerar uma linha no `TODO.md`.
2. `diaDeHojeNoBanco()` devolve `''` se a consulta vier vazia (`seed.ts:1387`). Com isso o `coalesce` cairia sem aviso no `now()` antigo. Lançar um erro ali deixaria a falha mais clara. É só robustez: na prática a consulta sempre devolve uma linha.
