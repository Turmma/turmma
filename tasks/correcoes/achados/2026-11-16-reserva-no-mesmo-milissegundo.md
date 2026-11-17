# Achados das revisões — `tasks/correcoes/2026-11-16-reserva-no-mesmo-milissegundo.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-16 23:30:14 · `tasks/correcoes/2026-11-16-reserva-no-mesmo-milissegundo.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. A correção só altera dois testes de integração do envio de e-mail (convite e link da conta). Nenhum arquivo de `apps/*/src`, `packages/*/src` ou `docs/` mudou. Todos com autor humano? Não se aplica, porque nenhum caminho de escrita em `Nota` foi criado ou alterado.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. Nenhum fluxo com saída de IA foi tocado.
Supervisão do tutor: ok. O tutor não foi tocado.
Autonomia declarada e visível: sim. Nada mudou em governança nem na declaração de agentes.
Bloqueantes: nenhum
Recomendações: nenhuma de regra 70. Uma observação que não bloqueia e cabe ao `test-engineer` julgar: depois da troca, `expect(segunda.reserva.getTime()).toBeGreaterThan(marcaDaPrimeira.getTime())` virou quase óbvia, porque as duas marcas ficam uns 3 min afastadas. O que de fato prova a regra são os `concluir`/`devolver` com a marca velha devolvendo `false`, e a mutação da tarefa mostra que isso continua coberto.

Escopo conferido. Mudaram só:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/worker/test/enviar-email.int.test.ts` (linhas 330 a 340)
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/worker/test/enviar-email-da-conta.int.test.ts` (linhas 297 a 306)

Nos dois, a marca da primeira reserva agora é gravada pelo próprio teste, 3 min antes da reserva real, e é ela que se usa na comparação, em vez de depender do relógio do banco. A tarefa não toca nota, correção, tutor, autonomia de agente, decisão sobre aluno nem indicador de professor. Também não traz fotos da tela.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-16 23:30:31 · `tasks/correcoes/2026-11-16-reserva-no-mesmo-milissegundo.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum. Só mudam dois testes de integração do worker de e-mail, que é fila de lote. Nenhum arquivo de `apps/*/src` nem de `packages/*/src` foi alterado.
Rate limit: não se aplica (sem endpoint novo nem alterado)
Fila e prioridade: ok (fila e repository iguais)
Concorrência: protegida. A posse da reserva continua garantida no banco: `packages/core/src/email/envio.repository.ts:90,100,133,144` exige que a marca bata (`envioReservadoEm = reserva`) em `concluir` e `devolver`. O teste ainda prova a disputa entre dois processos: com a marca do processo morto, `concluir` e `devolver` não gravam nada, e a linha fica com `segunda.reserva`. Agora a marca do processo morto é gravada pelo próprio teste, 3 min antes, e não depende mais do relógio. Rodei aqui os casos "desfecho" dos dois arquivos: 8 passaram, 33 ficaram de fora pelo filtro, nenhuma falha.
Índice e paginação: ok (nenhuma query nova)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (nenhum código novo no caminho quente)
Bloqueantes: nenhum
Recomendações:
- `apps/worker/test/enviar-email.int.test.ts:337` e `apps/worker/test/enviar-email-da-conta.int.test.ts:303`: com 3 min de distância, `toBeGreaterThan(marcaDaPrimeira)` passa sempre e já não prova nada sozinho. Quem prova a regra são as asserções de `concluir`/`devolver` → `false` e a linha com `reservadoEm: segunda.reserva`. Vale um comentário dizendo isso, ou trocar por uma asserção de que a marca gravada na linha é a da retomada. No arquivo do link da conta isso já está feito.

## test-engineer · 1ª rodada · APROVADO · 2026-11-16 23:30:42 · `tasks/correcoes/2026-11-16-reserva-no-mesmo-milissegundo.md`

VEREDITO: APROVADO

**Cenários exigidos.** A correção mexe só em código de teste. O que ela precisa provar:
- **Caminho feliz:** o processo que retomou a reserva conclui com a marca dele, e o resultado é `true` com a linha `enviado`, sem token e sem destino.
- **Borda: reserva retomada por outro processo.** `concluir` e `devolver` com a marca da reserva vencida devolvem `false` e não mexem na linha. Vale para o convite e para o link da conta.
- **Borda: as duas reservas no mesmo milissegundo.** É a causa da falha na esteira. A asserção não pode mais depender do relógio.
- **Borda: o job executado duas vezes** (processo morto e retomada). É esse o cenário do caso.
- **Concorrência:** fica fora desta correção, porque não muda o repository.
- **Permissão e isolamento:** não se aplicam, porque nenhuma consulta nem escopo mudou.

**Cobertos.**
- O caso `o desfecho é da reserva: concluir e devolver com a marca de uma reserva que outro processo já retomou não gravam nada` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/worker/test/enviar-email.int.test.ts:325-345`) e o mesmo caso no link da conta (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/worker/test/enviar-email-da-conta.int.test.ts:294-310`).
- A marca da primeira reserva agora sai de `primeira.reserva`, que vem do `clock_timestamp()` do banco, menos 3 min. Ela é gravada na linha por parâmetro. A coluna é `timestamptz` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/db/schema/convite.ts:58` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/db/schema/link-da-conta.ts:44`), então gravar um `Date` não desloca o fuso. Resultado: o `toBeGreaterThan` tem 3 min de folga garantida e não depende do relógio do Node.
- A simulação ficou mais fiel do que antes. A marca usada em `concluir` e `devolver` agora é exatamente a que a linha guardava antes da retomada. Antes era uma marca que a linha já nem tinha.
- A asserção continua sobre o resultado: `false` nos dois desfechos, a linha seguindo `enviando` com o token, e depois `true` só com `segunda.reserva`.
- Mutações: o diff não toca `apps/*/src` nem `packages/*/src`, então não há cláusula nova a exigir bloco. O bloco declarado tira `eq(convite.envioReservadoEm, reserva)` de `concluir`. Com isso `concluir(marcaDaPrimeira)` passaria a gravar e o caso fica vermelho pelo motivo certo, porque o cenário chega à cláusula.
- Não há `.skip`, teste comentado nem mock. A integração roda contra o Postgres real. Rodei `npx vitest run` nos dois arquivos: 2 arquivos, 41 casos verdes.

**Bloqueantes:** nenhum.

**Recomendações.**
1. No documento `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tasks/correcoes/2026-11-16-reserva-no-mesmo-milissegundo.md:38` está escrito "41 casos em cada". São 41 no total dos dois arquivos. É só texto, para a validação.
2. No caso do convite (`enviar-email.int.test.ts:341`), o `toMatchObject` depois dos dois `false` não confere `reservadoEm: segunda.reserva`, e o caso do link confere. Acrescentar a conferência deixaria explícito que o `devolver` com a marca vencida não apagou a reserva de quem retomou. Hoje isso só se prova de forma indireta, pelo `concluir(segunda.reserva) === true` logo depois.
3. Só a mutação de `concluir` no convite está declarada. Blocos para `devolver` e para `concluirLink`/`devolverLink`, nas linhas 100, 133 e 144 do repository, deixariam provado que cada desfecho depende da marca. Não bloqueia, porque não há código de produção novo.

## test-engineer · 2ª rodada · APROVADO · 2026-11-16 23:37:46 · `tasks/correcoes/2026-11-16-reserva-no-mesmo-milissegundo.md`

VEREDITO: APROVADO

Cenários exigidos: os mesmos da 1ª rodada. A reserva retomada depois de 2 min fica com o desfecho. `concluir` e `devolver` com a marca velha não gravam nada. Só a marca da reserva atual conclui o envio. O caso não depende de as duas reservas caírem no mesmo milissegundo.

Cobertos:
- **Recomendação 2, aplicada.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/worker/test/enviar-email.int.test.ts:341`, a asserção agora confere `reservadoEm: segunda.reserva`. O helper `linha()` (linha 95) lê `envio_reservado_em as "reservadoEm"`, então a comparação é feita com o que está gravado no banco, e não com o valor em memória. Isso reforça a prova: se o `concluir` ou o `devolver` com a marca velha mexesse na marca da reserva, ou a apagasse, o caso ficaria vermelho, coisa que a asserção anterior (só `envio`, `token` e `enviadoEm`) não pegava. Rodei o caso sozinho com `npx vitest run apps/worker/test/enviar-email.int.test.ts -t "o desfecho é da reserva"` e ele passou (1 caso, os outros 24 pulados pelo filtro). A comparação de datas não perdeu precisão.
- **Recomendação 1, aplicada.** O documento agora diz "41 casos no total dos dois arquivos".
- **Recomendação 3, registrada sem aplicar.** Está na tabela "Recomendações sem aplicar" do documento, com motivo e destino: a próxima tarefa que tocar `packages/core/src/email/envio.repository.ts`. É aceitável, porque esta correção não muda cláusula de produção. O bloco de mutação de `concluir` continua no documento e já foi provado pelo portão.
- O diff desta rodada não traz `.skip`, nem teste comentado, nem mock novo.

Bloqueantes: nenhum.

Recomendações:
- A da 1ª rodada que ficou sem aplicar segue para a próxima tarefa em `packages/core/src/email/envio.repository.ts`: blocos de mutação para `devolver` e para `concluirLink`/`devolverLink`. Já está registrada no documento `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tasks/correcoes/2026-11-16-reserva-no-mesmo-milissegundo.md`. Não há nada novo.
