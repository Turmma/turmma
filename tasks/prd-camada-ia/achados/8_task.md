# Achados das revisões — `tasks/prd-camada-ia/8_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-21 23:17:57 · `tasks/prd-camada-ia/8_task.md`

VEREDITO: APROVADO
Tela vista: não. A vitrine não alcança o papel operador, dono de `/operacao/uso`, e o prompt trouxe `Fotos da tela: indisponíveis`. Revisei pelo código e pelo e2e, e a tela precisa ser vista na validação, no computador, a 360 px, com `?ordem=custo` e com "Ver meses" aberto. Não rodei nenhum teste: o e2e está lido, não executado.

Estados: ok
- A tela do Uso cobre carregando (`Uso.tsx:323`), erro (`Uso.tsx:324`, com "Tentar de novo" e a tela no lugar), vazio (`Uso.tsx:326`, "Nenhuma escola criada ainda." com "Ir para Escolas") e com dado.
- O erro com dado antigo fica sobre a lista (`Uso.tsx:340`).
- A página além da última tem vazio próprio (`Uso.tsx:332`).
- O diálogo "Meses de IA" também tem os quatro (`MesesDeIa.tsx:66-89`):
  - carregando: "Carregando os meses…";
  - vazio: "Ainda não há mês fechado com retrato.";
  - erro: "Não foi possível carregar." com "Tentar de novo";
  - com dado: a lista dos 12 meses.
- A resposta que a web não reconhece diz "Atualize a página", sem "Tentar de novo" (`CascaDaOperacao.tsx:142`, `MesesDeIa.tsx:81-83`). O botão repetiria a mesma resposta, então a escolha está certa.

Acessibilidade: ok
- "Definir orçamento" e "Ver meses" têm nome acessível com a escola (`Uso.tsx:67-68`, `Uso.tsx:109-110`), e usam `SECONDARY_BUTTON_CLASSES` (`min-h-11 min-w-11`, 44 px).
- A ordem usa `aria-pressed`.
- A porcentagem vem sempre em texto ("62% do orçamento", "sem orçamento definido", "sem aluno ativo"), nunca só em cor.
- A tabela tem `caption` e `scope` nos cabeçalhos. Quando passa da largura, a moldura vira região com foco (`Uso.tsx:126`).
- O foco volta à escola depois de salvar o orçamento (`Uso.tsx:295-299`), e o anúncio "Orçamento salvo." é um `role="status"` (`Uso.tsx:318`).
- O e2e confere alvo de 24 px e 44 px (`e2e/operacao-uso.spec.ts:497,518`).

Chromebook fraco: ok
- A lista é paginada, 25 escolas por página.
- Uma estrutura só no documento: tabela a partir de 768 px, cartões abaixo (`useMediaQuery(MEDIA_MD)`).
- "Ver meses" só lê a API quando o diálogo abre, com chave por escola.
- Nenhuma imagem nem upload.

Celular: ok
- A 360 px a tela vira cartões, com as medidas empilhadas e `wrap-anywhere` nos textos longos.
- O diálogo de meses é uma lista de cartões, também sem rolagem horizontal.
- Os números ficam inteiros na linha (`whitespace-nowrap`).
- Nada depende de hover, e nenhum fluxo exige celular.
- Os e2e cobrem 360 e 1366 px nos projetos `celular` e `chromebook`.

Ação oficial protegida: sim, nesta tarefa. "Definir orçamento" só abre o diálogo da 7.0 (`DialogoDoOrcamento`), que tem a confirmação própria, fora do escopo desta tarefa. A tela não calcula porcentagem, só o custo por aluno. A rede e o orçamento da linha vêm da API, e "Ver meses" mostra só número por escola, nunca pessoa.

Bloqueantes: nenhum
- Português do Brasil, R$ com vírgula e mês por extenso ("setembro de 2026"), sem id nem chave de tradução na tela.
- A tela diz que a infra mostra o último dia fechado e a IA mostra hoje, até agora, e o mês.
- O texto de `docs/interface.md` bate com o que o código faz.
- A divergência da spec está registrada na tarefa e no `techspec.md`: a rede e o orçamento passaram para o item do uso.

Recomendações:
- A 1366 px a tabela tem 16 colunas e rola dentro da moldura, o que a regra 2a permite. Olhe na validação se o operador precisa rolar demais para chegar a "Orçamento do mês". Se precisar, fixe a coluna da escola ou abrevie os cabeçalhos longos, como "Custo por aluno no mês, contra o valor".
- "Tokens" e "Chamadas da reserva" são termos técnicos. Estão na tela do operador e vêm do `cenarios.md`, então não bloqueiam. Um tooltip ou uma frase de apoio ajudaria quem entra na operação pela primeira vez.
- O vazio de "Ver meses" ("Ainda não há mês fechado com retrato.") explica, mas não diz o próximo passo. Vale uma frase como "Volte depois do primeiro fechamento de mês".
- Confirme na validação, olhando a tela, o contraste de `text-sutil` sobre `bg-superficie` nos rótulos dos cartões e o `t-selo` dos cabeçalhos da tabela.

Arquivos relevantes:
- `apps/web/src/operacao/pages/Uso.tsx`
- `apps/web/src/operacao/components/MesesDeIa.tsx`
- `apps/web/src/operacao/components/CascaDaOperacao.tsx`
- `apps/web/src/operacao/textos.ts`
- `e2e/operacao-uso.spec.ts`

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-21 23:18:09 · `tasks/prd-camada-ia/8_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova e nenhuma migration. A consulta só lê colunas de tabelas que já existiam: `escola`, `rede`, `configuracao_operacional_escola`, `uso_infra_diario` e `consumo_ia`.

Queries verificadas:
- `usoDaPaginaSql` em `apps/api/src/operacao/painel/painel.repository.ts:196-232`. As únicas colunas novas são `r.id as "redeId"` e `r.nome as "redeNome"`. O `join rede as r on r.id = e.rede_id` já existia, então cada linha carrega a rede da própria escola. As subconsultas de uso continuam presas a `escola_id = e.id`.
- `PainelRepository.uso`, na linha 359 do mesmo arquivo, continua com `@Unscoped` e justificativa escrita. É leitura do operador da equipe Turmma, acima do tenant, e a saída segue sem pessoa: id e nome da rede e números de orçamento.
- `PainelService.uso`, em `apps/api/src/operacao/painel/painel.service.ts:177`. O `orcamento` é montado com o `ia.orcamento` da própria linha, sem nenhuma entrada do cliente.
- Web, em `apps/web/src/operacao/api/painel.ts`. `GET /v1/operacao/uso` só manda `pagina` e `ordem` na query string, e `ordem` é limitada à lista do contrato. `GET /v1/operacao/escolas/:id/uso-ia`, da 5.0, recebe o id no caminho, com `encodeURIComponent`, por rota de operador. Nenhum endpoint passou a aceitar `escolaId` no corpo ou na query.
- O schema `usoDaEscolaDoPainelSchema` é estrito, os ids são `z.uuid()` e o `rede` é reaproveitado de `escolaDoPainelSchema`.

Teste de isolamento: presente e efetivo. O caso novo de `apps/api/test/painel-leitura.int.test.ts:737` compara a rede de cada linha com a rede gravada no banco, escola a escola, e usa duas escolas com orçamentos diferentes. Se a coluna ou o mapeamento for trocado (por exemplo `e.id as "redeId"`, `rede.id = linha.id`, ou a rede no lugar da escola no service), o teste quebra. As mutações 3 a 6 da tarefa mostram isso. A camada de rede não entra aqui, porque o painel é do operador. O teste de contrato em `apps/api/test/contracts.test.ts:185` fixa os campos novos e prova que nenhum é de pessoa.

Bloqueantes: nenhum.

Recomendações:
- O texto do `@Unscoped` de `uso()` em `painel.repository.ts:359` diz "só id, nome e número". Vale incluir "id e nome da rede e o orçamento", para a justificativa continuar dizendo o que o método devolve.
- No teste da linha 737 de `painel-leitura.int.test.ts`, deixar explícito no próprio caso que as escolas `soTeto` e `semNada` estão em redes diferentes, com `expect(redeDe(soTeto.id).id).not.toBe(redeDe(semNada.id).id)`. Assim o teste não depende de como `escolaDeIa` cria a rede.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-21 23:18:15 · `tasks/prd-camada-ia/8_task.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum (só o painel do operador da equipe Turmma, `/operacao/uso`, fora do horário de aula das escolas)
Rate limit: ok (nenhuma rota nova; `GET /v1/operacao/uso` e `GET /v1/operacao/escolas/:id/uso-ia` já existiam desde a 5.0)
Fila e prioridade: ok (nenhum job novo)
Concorrência: protegida (só leitura; o salvar do orçamento é o diálogo da 7.0, que não mudou)
Índice e paginação: ok (`usoDaPaginaSql` continua cortando as 25 escolas antes das subconsultas; o `join rede as r` já existia e só ganhou `r.id` e `r.nome` no `select`, em `apps/api/src/operacao/painel/painel.repository.ts:202`)
Degradação de IA: não se aplica (nenhuma chamada de modelo)
Migration: não se aplica
Métrica e alerta: ok (nenhum código novo no caminho quente e nenhum alerta novo)
Bloqueantes: nenhum
Recomendações:
- A ordem `custo` (`chaveDaOrdem`, `apps/api/src/operacao/painel/painel.repository.ts:161`) roda `custoDaEscolaNoMes` para todas as escolas no `row_number()`, antes de cortar a página. Vem da 5.0 e não desta tarefa. Com dez escolas não pesa; vale um `EXPLAIN` com o volume previsto para a migração (400 escolas, `consumo_ia` de um ano) antes de crescer.
- Quando a API nova sobe antes de o navegador recarregar a web antiga, o `strictObject` da web antiga recusa os campos novos `rede` e `orcamento`, e a aba Uso mostra "Atualize a página" até recarregar. O caso está tratado na tela e com teste (`Uso.test.tsx` › "a API nova com a web antiga"). Como é tela interna, isso é aceitável; mas o mesmo padrão em tela de escola durante o deploy (D31) precisaria de leitura tolerante.

Arquivos auditados:
- `apps/api/src/operacao/painel/painel.repository.ts`
- `apps/api/src/operacao/painel/painel.service.ts`
- `packages/shared/src/operacao/painel.ts`
- `apps/web/src/operacao/api/painel.ts`
- `apps/web/src/operacao/components/MesesDeIa.tsx`
- `apps/web/src/operacao/components/CascaDaOperacao.tsx`
- `e2e/operacao-uso.spec.ts`

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-21 23:18:22 · `tasks/prd-camada-ia/8_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A tarefa não grava `Nota`, não lê `Nota` e não toca job, seed, importação nem webhook ligados a ela. Todos com autor humano? Não se aplica.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. A tarefa não cria saída de IA que chegue ao aluno. O que se grava é o orçamento por escola, e quem grava é o operador, pelo diálogo da 7.0 (`DialogoDoOrcamento`, reaproveitado sem cópia).
Supervisão do tutor: ok. A tarefa não toca o tutor.
Autonomia declarada e visível: sim, e a tarefa não mexe nela. Nenhum agente novo, nenhum nível alterado, nenhuma tela de governança da coordenação modificada.
Bloqueantes: nenhum

O que conferi e por que nada bloqueia:

- **Itens 1, 2 e 8 (nota, trajetória do aluno, D46/D55):** a aba Uso da Operação mostra só consumo e custo por escola: chamadas, tokens, reais, custo por aluno contra o valor, porcentagem e chamadas da reserva. Não há campo, tela nem prompt de nota, conceito ou sugestão de nota. Não há nada sobre aprovação, reprovação ou encaminhamento.
- **Item 7 (supervisão não é vigilância):** o item do uso continua sem pessoa. `packages/shared/src/operacao/painel.ts:379-386` é `z.strictObject`, e o que entrou é `rede {id, nome}` e `orcamento` (números). O teste `packages/shared/src/operacao/painel.test.ts` recusa `alunoId`, `funcao`, `modelo` e `usuarioId` em `hoje`. `apps/api/test/contracts.test.ts` fixa a lista exata de campos de `itens[].rede` e `itens[].orcamento`. O "Ver meses" (`apps/web/src/operacao/components/MesesDeIa.tsx`) também é só número por escola, e o teste da web recusa um `alunoId` a mais na resposta. O consumo não é quebrado por função, por usuário nem por aluno, então nada infere comportamento ou estado emocional.
- **Item 9 (medir o professor, D45 e D64):** nada na tarefa mede professor. Não há ranking, adoção nominal nem conversa do chat. A ordem "Mais custo de IA no mês" ordena escolas para a operação da Turmma, não professores. Ela não chega à coordenação de nenhuma escola e não alimenta decisão sobre ninguém.
- **Item 6 (auditoria):** não muda. Não há aprovação nova de saída de IA a registrar.

Recomendações:
- `apps/web/src/operacao/textos.ts:293-297`: `textoDoCustoPorAluno` divide no cliente (custo do mês ÷ alunos ativos). Isso está de acordo com a `techspec.md` §4, e não é porcentagem. Mas se um dia essa conta chegar a uma tela da coordenação, convém que ela venha pronta da API, como já acontece com a porcentagem. Assim a regra "nenhuma tela calcula" não ganha exceção nova.
- Para a retro: a tela é só do operador, e a coordenação vê "N% do previsto" (6.0, sem reais). Vale manter esse corte escrito em `docs/interface.md` §5a, para ninguém levar a tabela de reais e tokens por escola à Governança da escola sem passar pela D40.

Arquivos lidos:
- tasks/prd-camada-ia/8_task.md
- packages/shared/src/operacao/painel.ts
- apps/api/src/operacao/painel/painel.repository.ts
- apps/api/src/operacao/painel/painel.service.ts
- apps/web/src/operacao/pages/Uso.tsx
- apps/web/src/operacao/components/MesesDeIa.tsx
- apps/web/src/operacao/textos.ts

## revisor-geral · 1ª rodada · APROVADO · 2026-11-21 23:18:40 · `tasks/prd-camada-ia/8_task.md`

**VEREDITO: APROVADO**

**Escopo:** respeitado. As subtarefas 8.1 a 8.5 estão feitas. Duas coisas passam do documento, e as duas estão declaradas no `8_task.md`:
- **A API mudou, embora o documento diga que a API (5.0) está fora do escopo.** O repository e o service ganharam `rede` e `orcamento` no item do uso, e a mudança está registrada como divergência decidida pelo Arquiteto.
- **Arquivos além dos previstos.** `Escolas.tsx`, `NavegacaoDaLista.tsx` e `CascaDaOperacao.tsx` mudaram para a barra receber a lista de ordens e para "Atualize a página" não oferecer "Tentar de novo". O `cenarios.md` §4 e a `techspec.md` §4 já pediam isso.

**Aderência à Tech Spec:** ok.
- A divergência está escrita na `techspec.md` §4 (a linha do `GET /v1/operacao/uso` e o parágrafo "O alvo do 'Definir orçamento' (tarefa 8.0)") e na §9.
- O código bate com o que a spec diz:
  - O join com `rede` já existia na query, e só entraram `r.id` e `r.nome` (`painel.repository.ts:202`).
  - O service usa a mesma conta da aba Escolas, `orcamentoDaEscolaNoPainel` (`painel.service.ts:177`).
  - O esquema reaproveita `escolaDoPainelSchema.shape.rede` e `orcamentoDeIaDoPainelSchema` (`packages/shared/src/operacao/painel.ts:367-368`).
  - A tela não calcula porcentagem. A única conta dela é o custo por aluno, como a spec manda (`textos.ts`, `textoDoCustoPorAluno`).

**Portão local:** carimbo válido para o código atual (typecheck, lint, segredo, dependências, unidade, alvo).

**Bloqueantes:** nenhum.

**Recomendações:**
1. **Leitor de tela na tabela** (`apps/web/src/operacao/pages/Uso.tsx:175-180`): o botão "Ver meses" fica dentro do `<th scope="row">`. Assim, cada célula da linha é anunciada com o cabeçalho "Escola X Ver meses de IA da escola X". Melhor tirar o botão do cabeçalho da linha, ou dar ao `th` um nome acessível só com o nome da escola. Isso é da área do `frontend-reviewer`.
2. **`cenarios.md` sem linha para os campos novos** (`tasks/prd-camada-ia/cenarios.md:57`): a divergência ficou só na `techspec.md`. Uma linha em RF11 apontando para o caso "a linha do uso traz a rede da escola…" de `painel-leitura.int.test.ts` fecharia o rastro. As tarefas 2.0, 3.0 e 5.0 seguiram o mesmo costume, por isso não reprovo.
3. **Assinatura de `ColunaDeIa.celula`** (`Uso.tsx:60`): todas as nove colunas recebem `aoDefinir`, e só a de orçamento usa. Ficaria mais claro a coluna de orçamento capturar o callback ao montar a lista.
4. **Anúncio que não sai** (`Uso.tsx:291` e `357-360`): "Orçamento salvo." continua na tela depois de trocar de página ou de ordem. Vale conferir se a aba Escolas faz igual e alinhar as duas.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-21 23:19:43 · `tasks/prd-camada-ia/8_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- **Caminho feliz:** o grupo "IA (hoje, até agora, e mês)" com as nove medidas na tabela e no cartão; a ordem por custo; "Definir orçamento" abrindo o diálogo da 7.0 com a escola da linha; "Ver meses" com os 12 meses.
- **Bordas:**
  - o mês sem retrato (antes da medição) e o vazio com os 12 sem retrato;
  - sem aluno ativo, sem divisão e sem porcentagem;
  - a virada de ano na lista dos meses (dezembro de 2025 e janeiro de 2026);
  - a porcentagem da API diferente da conta que a tela faria;
  - números grandes a 360 e a 1366 px;
  - a escola que sai da página quando o orçamento é salvo (para onde vai o foco);
  - a web antiga com a API nova ("Atualize a página", sem "Tentar de novo").
- **Permissão:** fora do contrato e campo de pessoa a mais são recusados (`painel.test.ts`, `contracts.test.ts`); sem sessão não há acesso ao Uso (caso que já existia).
- **Isolamento:** a rede e o orçamento de cada linha são os da própria escola, e não os de outra.
- **Concorrência:** nada novo nesta tarefa. O diálogo é modal, o PUT do orçamento é da 7.0 e o `closeSeAinda` vem do `useDialogState`.

**Cobertos:** as 11 linhas da tabela de testes têm caso com o nome citado, conferido um a um, inclusive os itens juntados por ponto e vírgula nas linhas 47 a 56. Os oito arquivos de unidade e contrato passam (140 casos): `Uso.test.tsx`, `MesesDeIa.test.tsx`, `api/painel.test.ts`, `textos.test.ts`, `format.test.ts`, `Escolas.test.tsx`, `packages/shared/.../painel.test.ts` e `contracts.test.ts`.
- **Mutações:** os 53 blocos cobrem toda condição nova que aparece no `git diff` (repository, service, esquema, `painel.ts`, `CascaDaOperacao`, `NavegacaoDaLista`, `format`, `textos`, `Uso`, `MesesDeIa`, `Escolas`). Conferi cada um contra o cenário que o teste citado monta, e cada um falha pela cláusula certa.
- **Isolamento na integração:** cada escola de `escolaDeIa` tem rede própria (`painel-leitura.int.test.ts:604-608`), então trocar `r.id` por `e.id` ou cruzar o orçamento deixa o caso vermelho.
- **Outros pontos:** não há `.skip`, `.only` nem teste comentado. O dublê é só a rede, e o código da tela é o de verdade. Não há chamada a provedor de IA.

**Bloqueantes:**
1. **`e2e/operacao-uso.spec.ts:482-483`: a asserção sempre passa (regra 40, item 5).** O caso "IA: a ordem por custo vai à barra e ao pedido, e a API devolve do maior custo do mês para o menor" semeia com `novoPainel('topo')`, e `e2e/support/painel.ts` não grava nenhum custo de IA. Então todo `custoMicros` da resposta vale 0, e `expect(custos).toEqual([...custos].sort((a, b) => b - a))` passa até com a API ignorando `ordem=custo`. O caso não prova o que o nome diz. **Correção exigida, uma das duas:**
   - semear custo de IA no mês em ao menos duas escolas do painel, com valores diferentes, e conferir a ordem esperada pelos ids;
   - ou tirar a asserção da ordenação e a frase "a API devolve do maior custo do mês para o menor" do nome, deixando o que o caso prova de fato (endereço, `aria-pressed`, pedido e tela na ordem da resposta). A ordem da API já é provada na integração da 5.0.

**Recomendações:**
- **`e2e/operacao-uso.spec.ts`, caso "a página além da última":** ele perdeu o `expect.poll(() => nomesNaTela(page)).not.toEqual([])` que vinha depois de "Ir para a primeira página". Hoje só confere a URL. A autoconferência diz "O W7 não perdeu asserção", e isso não é exato: devolver a asserção ou corrigir a frase.
- **Axe nos diálogos:** o diálogo "Meses de IA" com os 12 meses e o "Orçamento de IA" aberto do Uso não passam pelo axe no e2e. Só o vazio dos meses passa (linha 591). Vale um `seriousViolations` em cada um.
- **`painel-leitura.int.test.ts:123-130`:** a rede esperada sai de uma consulta do próprio teste com o mesmo `join` da produção. Seria mais forte comparar com o `redeId` que o `escolaDeIa` criou (devolvê-lo no `EscolaDeIa`).
- **`Uso.test.tsx`, "no celular, o cartão diz as mesmas nove medidas…":** confere os rótulos e o "sem orçamento definido", mas não os valores do cartão. Hoje ele lê a mesma `COLUNAS_DE_IA` da tabela, então o risco é baixo.
- **`MesesDeIa.tsx:84`:** `disabled={meses.isFetching}` não tem efeito visível. Sem dado, o `refetch` volta ao carregando e o botão some. Pode sair, ou ficar documentado como defesa.

Arquivos citados:
- e2e/operacao-uso.spec.ts
- e2e/support/painel.ts
- apps/api/test/painel-leitura.int.test.ts
- apps/web/src/operacao/pages/Uso.test.tsx
- apps/web/src/operacao/components/MesesDeIa.tsx
- tasks/prd-camada-ia/8_task.md

## frontend-reviewer · 2ª rodada · APROVADO · 2026-11-21 23:40:13 · `tasks/prd-camada-ia/8_task.md`

VEREDITO: APROVADO
Tela vista: não. A vitrine não alcança o papel operador, dono de `/operacao/uso`. Revisei pelo código, pelo diff da rodada e pelos testes. A tela será vista na validação.
Estados: ok. Em `MesesDeIa.tsx` há carregando (`LoadingState`), vazio (`EmptyState`, que diz quando o retrato é gravado), erro com "Tentar de novo" e com dado. A resposta fora do contrato mostra "Atualize a página" sem o botão de tentar de novo.
Acessibilidade: ok no diff. O botão "Tentar de novo" deixou de ter `disabled={meses.isFetching}`, então o foco não se perde durante a releitura. O erro continua em `role="alert"`. A recomendação sobre o botão dentro do `<th scope="row">` (leitor de tela) está registrada no `TODO.md`, para o Validador conferir.
Chromebook fraco: sem mudança nesta rodada. O diff não toca virtualização nem imagem.
Celular: sem mudança de layout no diff. O botão continua o `Button` padrão. A conferência de 360 px fica para a validação, com a foto de `/operacao/uso`.
Ação oficial protegida: sim, não se aplica. Não há ação oficial nesta tela, só leitura de uso e orçamento. O orçamento abre em diálogo próprio, e o diff não o altera.
Bloqueantes: nenhum.
- Os três trechos do diff que tocam a tela estão corretos: o botão sem `disabled` em `apps/web/src/operacao/components/MesesDeIa.tsx:84`, as três linhas de `docs/interface.md` §5a, e o texto do erro, que continua dizendo o que fazer.
- O resto do diff é teste e comentário: `painel-leitura.int.test.ts`, `e2e/operacao-uso.spec.ts` e o `TODO.md`.
- Não encontrei correção exigida pendente, porque a rodada anterior não exigiu nenhuma.

Recomendações (todas já registradas em `TODO.md` e no documento da tarefa):
- Tirar o botão "Ver meses" do cabeçalho de linha, que o leitor de tela anuncia junto com cada célula (`apps/web/src/operacao/pages/Uso.tsx:175-180`).
- Explicar "Tokens" e "Chamadas da reserva", que são termos técnicos na tabela do Uso.
- Conferir na foto, com a tela vista: a tabela de 16 colunas a 1366 px, o contraste de `text-sutil` sobre `bg-superficie` e o `t-selo`.
- Decidir se "Orçamento salvo." deve sair da tela ao trocar de página ou de ordem.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-21 23:40:24 · `tasks/prd-camada-ia/8_task.md`

VEREDITO: APROVADO
Tabelas verificadas: nenhuma tabela nova nem migration no diff da 1ª para a 2ª rodada.
Queries verificadas: só mudou texto em `PainelRepository.uso()` (`apps/api/src/operacao/painel/painel.repository.ts:357-359`), e a query não mudou. O `@Unscoped` continua com justificativa escrita. Ela agora cita o id e o nome da rede e o orçamento da escola, e isso confere com o SQL (`e.rede_id`, `cfg.ia_*`, `r.ia_*`), que traz só id, nome e número, sem pessoa. É a rotina de operador da D76, e o número de `@Unscoped` no módulo não mudou (três no arquivo, cada um de uma leitura do painel). O `escolaId` não vem do corpo nem da query string, porque o diff não toca em endpoint.
Teste de isolamento: presente e efetivo. O `expect` novo em `apps/api/test/painel-leitura.int.test.ts:751-754` confere que as duas escolas estão em redes diferentes, e assim o caso "a rede de cada linha é a da própria escola" passa a valer de fato. Sem esse `expect`, um join trocado podia passar se as duas escolas estivessem na mesma rede. Agora o caso quebra se a linha receber a rede ou o orçamento de outra escola.
Bloqueantes: nenhum.
Recomendações:
- `e2e/operacao-uso.spec.ts:473-485`: o e2e não confere mais a ordem por custo, só que a tela segue a ordem da resposta. Isso só vale enquanto o int da 5.0 provar a ordem. Ao mexer em `chaveDaOrdem`, conferir que esse int continua cobrindo a ordem, e esse caso já está no `TODO.md` por causa do `usoPorCusto()` que lê só a primeira página.

## test-engineer · 2ª rodada · APROVADO · 2026-11-21 23:40:28 · `tasks/prd-camada-ia/8_task.md`

VEREDITO: APROVADO

Cenários exigidos: os da 1ª rodada. Nesta rodada conferi a correção exigida e o que o diff `871649b5…`..`2049effc…` toca: o e2e da ordem por custo, o e2e da página além da última, o `expect` novo no int da rede, o `disabled` tirado de `MesesDeIa.tsx` e o bloco de mutação dele.

Cobertos:
- **Correção 1, feita pela opção (b).** O nome do caso em `e2e/operacao-uso.spec.ts:473` virou "IA: a ordem por custo vai à barra e ao pedido, e a tela fica na ordem da resposta". A asserção que sempre passava saiu. O comentário da linha 484 aponta que a ordem da API é provada na integração da 5.0. Tudo o que o caso afirma agora é real:
  - O pedido leva `ordem=custo`: `respostaDoUso` (linhas 76-81) só aceita a resposta com `pagina=1&ordem=custo` e `ok()`.
  - O endereço e o `aria-pressed` são conferidos.
  - A tela segue a ordem da resposta.

  A linha 56 do `8_task.md` cita o caso pelo início do nome ("› IA: a ordem por custo vai à barra e ao pedido…"), e esse início continua valendo.
- **"A página além da última"** (linhas 372-392) ganhou `umaEscolaNoBanco()` e o `expect.poll(...).not.toEqual([])` no fim. O "Ir para a primeira página" agora prova que a lista volta, e não só que o endereço muda.
- **`painel-leitura.int.test.ts:751-754`**: agora uma pré-condição garante que as duas escolas estão em redes diferentes e que as duas redes existem. Sem ela, o caso "a rede de cada linha é a da própria escola" passaria com as duas escolas na mesma rede. O caso ficou mais forte.
- **`MesesDeIa.tsx:84`**: o `disabled={meses.isFetching}` saiu, como o achado da linha 199 recomendava. Ele não fazia diferença visível, porque o `refetch` sem dado volta ao carregando e o botão some. O bloco de mutação no `8_task.md:476-479` acompanha o código novo. Rodei `npx vitest run src/operacao/components/MesesDeIa.test.tsx` e os 10 casos passam. O caso "erro: … com 'Tentar de novo', que lê outra vez e mostra os meses" continua provando a nova leitura.
- O resto do diff (`TODO.md`, `docs/interface.md` §5a e o texto do `@Unscoped` e do docblock de `uso()`) é só texto e não mexe em teste.

Bloqueantes: nenhum.

Recomendações:
- O caso da ordem por custo em `e2e/operacao-uso.spec.ts:473-486` pode passar mesmo se a web reordenar a lista sozinha, quando todos os custos da página são zero, porque aí qualquer ordem estável coincide com a da resposta. O risco é baixo: a ordem da API está provada na integração, e o nome do caso não promete mais que isso. Se algum dia valer a pena, dá para trocar o corpo de uma resposta (`page.route`) por uma ordem que a web não produziria sozinha.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-21 23:40:30 · `tasks/prd-camada-ia/8_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido. O `conferir` devolveu: "portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)".
Bloqueantes: nenhum.

O diff desta rodada fecha os pontos levantados na 1ª.

- **E2e da ordem por custo** (`e2e/operacao-uso.spec.ts`, por volta da linha 473): saiu a asserção que passava sempre, com todo custo em zero. O caso agora confere o pedido, o endereço, o botão marcado e a tela na ordem da resposta. A ordem que a API devolve fica provada no int da 5.0, e o nome do caso foi trocado para dizer isso.
- **"A página além da última"** (linhas 374 e 391): semeia a própria escola com `umaEscolaNoBanco()`, sem depender de escola deixada por outro caso. Depois de voltar à primeira página, confere que a lista não está vazia.
- **Int da rede** (`apps/api/test/painel-leitura.int.test.ts`, linhas 751 a 754): as duas escolas agora estão em redes diferentes por asserção explícita. O caso não depende mais de como `escolaDeIa` cria a rede.
- **`@Unscoped` e docblock de `uso()`** (`apps/api/src/operacao/painel/painel.repository.ts`, linhas 357 a 359): a justificativa agora diz o que o método devolve (id e nome da rede, orçamento da escola).
- **`docs/interface.md` §5a**: registra que reais e tokens ficam só na Operação e que a coordenação vê só a porcentagem. Está de acordo com a 6.0 e a D40, e não abre tela nova.
- **`TODO.md` e documento da tarefa**: cada recomendação da 1ª tem destino ou motivo. O bloco de mutação do `MesesDeIa.tsx` acompanha o código atual.

Recomendações:
- **"Tentar de novo" do "Meses de IA" ficou diferente do resto da Operação.** Em `apps/web/src/operacao/components/MesesDeIa.tsx:84`, o `disabled={meses.isFetching}` saiu, e nem o documento nem os achados dizem por quê.
  - O `ErroDaOperacao` (`CascaDaOperacao.tsx:141`), usado em Uso e Escolas, desabilita o botão e anuncia "Tentando de novo…" durante a nova leitura. No diálogo, o botão segue clicável enquanto lê e não avisa nada.
  - Não é bug, porque o TanStack cancela a leitura anterior e começa outra.
  - Mesmo assim, vale reaproveitar o `ErroDaOperacao` no diálogo (o texto "Atualize a página" já tem o mesmo tratamento ali) ou registrar o motivo da diferença.
- Ao escrever o `cenarios.md` na retro, o Arquiteto pode apontar o RF11 para o caso da ordem por custo em `painel-leitura.int.test.ts`. Assim fica escrito onde a ordem é provada, já que o e2e deixou de provar.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-21 23:40:35 · `tasks/prd-camada-ia/8_task.md`

VEREDITO: APROVADO

Esta é a 2ª rodada. Auditei só o diff entre as rodadas, `.processo/ordens/diff-8-r1-r2.txt`, e o que ele afeta. A 1ª rodada não exigiu correção, então não havia o que conferir.

Campos pessoais tocados: nenhum. O diff não muda migration, schema nem DTO. O `@Unscoped` e o docblock de `uso()` (`apps/api/src/operacao/painel/painel.repository.ts:357-359`) só passam a descrever o que o item já levava desde a 1ª rodada: id e nome da rede e o orçamento da escola. É dado de instituição, sem pessoa.
Fora da tabela de dados do docs/lgpd.md: nenhum.
Autorização por objeto: ok. Nenhuma rota, query ou guarda mudou. O `@Unscoped` segue sendo rotina do operador, com justificativa e só número por escola.
Logs: limpos. O diff não acrescenta nenhuma chamada de log.
Auditoria: presente. Nenhuma ação nova que a regra 20 obrigue a auditar.
Envio externo: nenhum novo.
Seed/fixture: sintético. O e2e agora chama `umaEscolaNoBanco()` (`e2e/operacao-uso.spec.ts:59-63`), que cria uma escola por `semearEscolaDoConvite('sem_convite')`, sem uso. O `afterEach` (linhas 65-69) a apaga. O `expect` novo em `apps/api/test/painel-leitura.int.test.ts:751-754` confere só ids de rede da fixture.
Bloqueantes: nenhum.
Recomendações: nenhuma nova. Sobre o que mudou nesta rodada:
- A linha nova em `docs/interface.md` §5a ("Só da Operação") reforça a regra 20 e a D40: escreve que reais e tokens por escola ficam só com o operador e que levá-los à coordenação pede decisão nova.
- Tirar o `disabled` de "Tentar de novo" em `apps/web/src/operacao/components/MesesDeIa.tsx:84` não expõe dado.
- As 5 linhas do `TODO.md` não trazem dado pessoal.
- Segue aberta a recomendação da 5.0 sobre o parágrafo "O painel da operação não vê pessoa da escola" em `docs/lgpd.md`, que já está no `TODO.md`, com a 11.4 como dona.

Pergunta de fechamento: o diff não altera o que o sistema guarda sobre um aluno nem para onde isso é enviado. A resposta continua a da 1ª rodada.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-21 23:40:42 · `tasks/prd-camada-ia/8_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum neste diff nem na tarefa. A 8.0 é a aba Uso da Operação, que só lê o consumo de IA e o orçamento de cada escola. Todos com autor humano? sim, porque não há escrita.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. A tarefa não tem saída de IA que chegue ao aluno.
Supervisão do tutor: ok. O diff não toca no tutor.
Autonomia declarada e visível: sim. O diff não toca na governança dos agentes.

Bloqueantes: nenhum

O que vi no diff desde a 1ª rodada (`.processo/ordens/diff-8-r1-r2.txt`):
- **`docs/interface.md` §5a, as linhas 867 a 869:** o corte novo "Só da Operação" reforça a regra 70 e a D40. Reais e tokens ficam com o operador da Turmma. A coordenação vê só "IA do mês: N% do previsto". Levar a tabela, os 12 meses ou o custo por aluno à Governança ou ao Painel da escola exige decisão nova. Isso também resolve o ponto que levantei na 1ª rodada sobre `textoDoCustoPorAluno`.
- **`apps/api/src/operacao/painel/painel.repository.ts:357-359`:** mudou só o texto do docblock e do `@Unscoped`. Ele passa a dizer que a linha leva o id e o nome da rede e o orçamento. Continua sendo só id, nome e número, sem pessoa e sem indicador de professor.
- **`apps/web/src/operacao/components/MesesDeIa.tsx:84`:** o `disabled` saiu do "Tentar de novo". Não tem efeito na regra 70.
- **`e2e/operacao-uso.spec.ts` e `apps/api/test/painel-leitura.int.test.ts:751-754`:** são ajustes de fixture e asserção. A ordem por custo continua provada na integração da 5.0. Não envolvem nota, aluno nem professor.
- **`TODO.md`, as linhas 4296 a 4300, e o documento da tarefa:** as recomendações da 1ª rodada ficaram registradas, com destino. Nenhuma delas é minha matéria.
- **Árvore de trabalho:** confere com a árvore `2049effc…`. A única diferença é a tabela de Revisões de `tasks/prd-camada-ia/8_task.md`, que o hook preenche.

Itens 7 a 9 da regra (supervisão sem vigilância, sem ranking de professor, recusar a ferramenta não gera indicador): nada no diff mede professor ou aluno. A aba lista escolas por consumo de IA. Ordenar escolas por custo para o operador não é ranking de professor nem indicador de adoção nominal.

A rodada anterior não exigiu correções, então não havia nenhuma a conferir.

Recomendações: nenhuma nova.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-21 23:40:45 · `tasks/prd-camada-ia/8_task.md`

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
- `apps/web/src/operacao/components/MesesDeIa.tsx:84`: sem o `disabled={meses.isFetching}`, o "Tentar de novo" pode ser clicado várias vezes seguidas. O `refetch()` do TanStack cancela o pedido que está em curso e manda outro, então não há corrida nem dado errado. A tela é só do operador da Turmma, fora do caminho de aula, e não pesa na carga. Fica registrado para o caso de esse padrão ir para uma tela de escola. Lá, os cliques repetidos durante uma falha de 503 se somam entre as turmas.
- Continua valendo o item do `EXPLAIN` da ordem `custo` com 400 escolas e um ano de `consumo_ia` (`apps/api/src/operacao/painel/painel.repository.ts:161`), que é da 5.0. Ele já está no `TODO.md` e precisa ser feito antes da migração de produção (D42).

Nesta rodada li só o diff `.processo/ordens/diff-8-r1-r2.txt`. Ele não muda nenhuma query, índice, rota, fila, limite, estado em memória ou chamada de IA. Muda texto do `@Unscoped` e do docblock, três asserções no int da rede, a semeadura e as asserções de dois casos do e2e, documentação e o `disabled` do botão. Não havia correção exigida na 1ª rodada.
