# Achados das revisões — `tasks/correcoes/2026-11-02-restos-no-tipo-do-log.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-02 11:00:16 · `tasks/correcoes/2026-11-02-restos-no-tipo-do-log.md`

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
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/guardas/runbook-tipo-do-log.test.ts`, os casos que usam `tiposRenomeados()` passam sem testar nada se a lista vier vazia. Hoje o caso novo, "um único nome antigo", impede isso. Mesmo assim, um `expect(tiposRenomeados()).toHaveLength(TIPOS_NOVOS.length)` dentro de cada caso deixaria cada um seguro sem depender do outro.
- O filtro `/^[^.]+\.json$/` deixa de fora arquivos como `13.relatorio.json`, se um dia existirem. Vale um comentário curto explicando que ele só pega os mapas aplicados, para ninguém achar que é engano.

A mudança só toca teste: o código de produção, a fila, a IA, as migrations e as métricas não mudaram. Rodei de novo:
- `npx vitest run tools/guardas/runbook-tipo-do-log.test.ts` passou nos 5 casos.
- `node tools/renomear/restos.ts` terminou com "restos: limpo. 11 mapas, nenhum nome antigo sobrou."

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-02 11:00:23 · `tasks/correcoes/2026-11-02-restos-no-tipo-do-log.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A mudança fica só em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/guardas/runbook-tipo-do-log.test.ts`. Antes, o teste guardava os pares "nome antigo, nome novo" das classes de erro escritos à mão. Agora ele guarda só os 20 nomes novos e lê os antigos dos mapas em `tools/renomear/mapas/*.json`. Esses dados são nomes de classe de código, não dado de pessoa. O comentário que citava `ErroDaApi` passou a dizer "o erro do cliente web", sem dado nenhum.
Fora da tabela de dados do docs/lgpd.md: nada; não há campo novo.
Autorização por objeto: não se aplica; não há rota, repository nem endpoint.
Logs: limpos. O teste lê o campo `tipo` do log, que guarda o nome da classe de erro, e não grava log.
Auditoria: não se aplica; a tarefa não faz leitura de dado de aluno, exportação, alteração de nota ou de permissão, nem aprovação de saída de IA.
Envio externo: nenhum.
Seed/fixture: não há seed nem fixture. Os dados do teste são nomes de classe e os mapas de renomeação.

Os dois testes passam no worktree:
- `npx vitest run tools/guardas/runbook-tipo-do-log.test.ts`: 5 de 5, contando o caso novo "cada `tipo` novo tem um único nome antigo nos mapas da renomeação".
- `node tools/renomear/restos.ts`: sai 0, com "restos: limpo. 11 mapas, nenhum nome antigo sobrou."

Pergunta de fechamento: a tarefa não mexe em nada que guarde ou envie dado de aluno, então a resposta a um pedido da secretaria fica como estava antes dela.

Bloqueantes: nenhum.

Recomendações:
- Hoje um mapa com JSON quebrado em `tools/renomear/mapas/` faz o teste parar com uma exceção genérica do `JSON.parse`. Se o erro disser qual arquivo falhou, quem lê a esteira acha o problema mais rápido. Não tem relação com a regra 20.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-02 11:00:26 · `tasks/correcoes/2026-11-02-restos-no-tipo-do-log.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. A mudança só altera `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/guardas/runbook-tipo-do-log.test.ts`, que é teste de ferramenta, e o documento da correção. Nenhum caminho novo grava em `Nota`. Todos com autor humano? Sim, sem mudança.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. Nenhum fluxo de saída de IA foi tocado.
Supervisão do tutor: ok. Nada do tutor foi tocado.
Autonomia declarada e visível: sim, sem mudança. Nada de governança foi tocado.
Bloqueantes: nenhum.

O que conferi:
- **Escopo da mudança.** O diff só troca a lista escrita à mão de pares `[antigo, novo]` por uma lista dos 20 nomes novos. O nome antigo de cada um passa a ser lido das entradas `simbolo` de `tools/renomear/mapas/*.json`. Também muda o comentário do `ErroDaApi`. Nenhum código de produção mudou, então nenhum ponto da regra 70 (itens 1 a 9) é afetado.
- **O teste continua cobrando.** O caso novo, "cada `tipo` novo tem um único nome antigo nos mapas", impede que a derivação dos nomes fique vazia sem ninguém perceber. Sem ele, os casos que usam `tiposRenomeados()` passariam sem testar nada.
- **Rodei os dois.** `vitest run tools/guardas/runbook-tipo-do-log.test.ts` passou nos 5 casos. `node tools/renomear/restos.ts` respondeu "limpo. 11 mapas, nenhum nome antigo sobrou" e saiu com código 0.

Recomendações:
- O filtro `/^[^.]+\.json$/` só lê mapas com nome sem ponto, como `13.json`. Se um dia aparecer um mapa com outro padrão de nome, ele fica fora sem aviso. O caso de "um único antigo por novo" pega isso só se o mapa ignorado for o que tem o par. Vale um comentário de uma linha dizendo por que o filtro existe, que é deixar de fora `13.relatorio.*` e parecidos.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-02 11:00:36 · `tasks/correcoes/2026-11-02-restos-no-tipo-do-log.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. A correção mexe só no teste e no documento dela, sem código de produção, e segue o §5 da Tech Spec da X8: o `restos` cobra o `de` dos mapas em qualquer arquivo fora das pastas isentas.
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/guardas/runbook-tipo-do-log.test.ts:38` e `:41-52`: o teste declara de novo a constante `PASTA_DOS_MAPAS` e lê os mapas por conta própria (`readdirSync`, o mesmo filtro `/^[^.]+\.json$/`, `JSON.parse` com cast sem validar). Isso é um segundo jeito de fazer o que `lerTodosOsMapas(raiz)` e `PASTA_DOS_MAPAS`, de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/renomear/reaplicar.ts:17` e `:36`, já fazem, e é por ali que o próprio `restos` lê. Usar essa função traz a validação do mapa (`validarMapa`), a ordem das ondas e o tipo `Mapa` no lugar do cast manual, e evita que a regra de quais arquivos contam como mapa mude num lugar e fique igual no outro. Hoje o resultado é o mesmo, porque o filtro é idêntico, então isso não bloqueia.
- Se um nome novo não tiver antigo nos mapas, `tiposRenomeados()` simplesmente o deixa fora dos pares, e os três casos que usam esses pares não reclamam. Quem pega isso é só o caso novo ("cada `tipo` novo tem um único nome antigo"), e ele cumpre o papel. Uma linha no JSDoc de `tiposRenomeados` dizendo que ele depende desse caso para não passar em branco deixa a dependência à vista de quem mexer depois.

Conferido nesta rodada: `node tools/renomear/restos.ts` termina com "restos: limpo. 11 mapas, nenhum nome antigo sobrou." e sai com código 0. Isso reproduz o vermelho da esteira e mostra que ele foi resolvido.

## test-engineer · 1ª rodada · APROVADO · 2026-11-02 11:00:44 · `tasks/correcoes/2026-11-02-restos-no-tipo-do-log.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- **Caminho feliz:** a árvore não tem mais nomes antigos. O `restos` passa, e o teste do runbook ainda prova o par antigo e novo de cada `tipo`.
- **Borda 1:** um mapa muda e um nome novo fica sem nome antigo. Sem guarda, o teste passaria em branco, porque `flatMap` sobre um conjunto vazio não gera par.
- **Borda 2:** dois nomes antigos levam ao mesmo nome novo, e a derivação fica ambígua.
- **Borda 3:** o nome antigo que vem do mapa difere do que o runbook mostra.
- **Permissão e isolamento:** não se aplicam. A correção mexe só num teste de processo, sem dado de escola e sem endpoint.
- **Concorrência:** não se aplica.

**Cobertos:**
- **Caminho feliz:** `tools/renomear/restos.test.ts` › "a árvore não tem resto dos mapas aplicados" e `tools/guardas/runbook-tipo-do-log.test.ts` rodam juntos, verdes: 47 de 47. O teste em HEAD trazia os 20 nomes antigos como string e `ErroDaApi` no comentário, e o diff tira todos.
- **Bordas 1 e 2:** o caso novo, "cada `tipo` novo tem um único nome antigo nos mapas da renomeação", exige `size === 1` para cada um dos 20. Ele falha se o conjunto vier vazio ou com mais de um nome, e isso fecha o furo que a derivação abriria.
- **Borda 3:** o caso "o runbook diz, para cada classe de erro renomeada, o `tipo` antigo e o novo, na mesma linha" compara o nome derivado do mapa com o texto do runbook. Se o mapa e o runbook divergirem, ele fica vermelho. Está verde, então a derivação devolve os mesmos 20 pares da lista feita à mão.
- **Mutações:** "Sem mutação" vale. O diff toca só o teste e o documento, sem nenhuma cláusula de produção.
- Não há `.skip` nem mock, e a correção não toca IA.

**Bloqueantes:** nenhum.

**Recomendações:**
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/guardas/runbook-tipo-do-log.test.ts:43-54`: `antigosPorNovo` lê os mapas por conta própria, com `readdirSync`, o mesmo filtro `/^[^.]+\.json$/` e um `JSON.parse` com cast. Já existe `lerTodosOsMapas(raiz)` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/renomear/reaplicar.ts:36`, que o `restos` usa e que também valida o mapa e falha se a pasta estiver vazia. Usá-la garante que o teste lê os mapas do mesmo jeito que o `restos`, e evita que um mapa malformado seja ignorado sem aviso por causa do `entradas ?? []`.
2. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tasks/correcoes/2026-11-02-restos-no-tipo-do-log.md:31`: o documento chama o caso novo de "cada `tipo` novo tem um único nome antigo nos mapas", mas o nome no código termina em "nos mapas da renomeação". Vale alinhar os dois para que a busca pelo nome encontre o teste.
