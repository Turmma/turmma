# Achados das revisões — `tasks/prd-camada-ia/5_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-21 07:11:13 · `tasks/prd-camada-ia/5_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A tarefa só lê dados. O diff não grava em `Nota`, não tem job, seed de produção, importação nem webhook que grave nela. Os únicos `insert` estão nas fixtures de teste, em `consumo_ia`, `vinculo` e `execucao_agente`. Todos com autor humano? Não se aplica.

Decisão autônoma sobre aluno: ausente. O `GET /v1/operacao/uso` e o `GET /v1/operacao/escolas/:id/uso-ia` devolvem só números de consumo e de orçamento por escola. A ordem `custo` só ordena escolas no painel da Operação e não leva a nenhuma ação sobre aluno.

Aprovação registrada: ok. A tarefa não cria nenhuma saída de IA que chegue ao aluno, e a exceção do tutor (D47) não aparece neste diff.

Supervisão do tutor: ok. O tutor não é tocado. O contrato proíbe `funcao` no item, então nem o uso do tutor separado das outras funções chega à Operação. Isso está provado em `packages/shared/src/operacao/painel.test.ts` (`{ funcao: 'tutor' }` é recusado) e em `apps/api/test/contracts.test.ts`.

Autonomia declarada e visível: sim. Nenhum agente teve nível alterado e nenhuma tela foi criada (a tela é da 8.0).

O que conferi das outras regras:
- **Itens 7, 8 e 9 (D45, D64).** As somas são sempre por escola, nunca por professor, aluno, função ou modelo:
  - `COLUNAS_DO_USO_DE_IA` só tem `count` e `sum`, em `packages/core/src/ia/orcamento-do-mes.repository.ts`.
  - Os schemas `usoDeIaDoPeriodoDoPainelSchema` e `mesDoUsoDeIaDaEscolaSchema` são estritos, em `packages/shared/src/operacao/painel.ts`.
  - O teste de contrato proíbe `alunoId`, `usuarioId`, `nome`, `funcao`, `modelo` e `provedorId`.
  - Não há ranking, lista nominal de adoção nem métrica ligada a professor, e a conversa do professor com o chat não é lida.
- **Quem alcança as rotas.** A rota nova entrou em `ROTAS_DO_PAINEL`, em `apps/api/test/registered-routes.ts`. Por isso a varredura de `apps/api/test/operacao-isolamento.int.test.ts` prova que coordenação, professor e aluno recebem a mesma resposta da rota inexistente. Só a equipe Turmma (D76) lê esses números.
- **Item 2a (D55).** Nenhum campo, prompt ou consulta guarda ou sugere nota de discursiva ou redação.
- **Item 6.** A auditoria de "o que a IA gerou, quem aprovou e quando" não muda. A rota nova só lê, não audita nem loga, e o retorno não tem dado de pessoa.

Bloqueantes: nenhum.

Recomendações:
- Na 8.0, a tela do uso de IA na Operação deve continuar sem detalhar por função ou agente. Assim o painel nunca se torna, mesmo sem querer, uma medida de uso do tutor ou do Assistente numa escola com um professor só.
- Também na 8.0, os textos dessa tela devem chamar os números de "uso de IA da escola", nunca "uso dos professores". Isso evita que a leitura de custo pareça indicador de adoção por professor (D64).

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-21 07:11:14 · `tasks/prd-camada-ia/5_task.md`

```
VEREDITO: APROVADO
Tabelas verificadas: nenhuma tabela nova nesta tarefa. A tarefa lê consumo_ia, orcamento_ia_do_mes, configuracao_operacional_escola, rede, escola, vinculo e uso_infra_diario; as que são de domínio já têm escola_id.
Queries verificadas:
- apps/api/src/operacao/painel/painel.repository.ts:159: chave da ordem `custo`, `custoDaEscolaNoMes(e.id, mês de agora)`.
- apps/api/src/operacao/painel/painel.repository.ts, `usoDaPaginaSql` (cerca de 200-240): laterais `ia_hoje` e `ia_mes` presas a `c.escola_id = e.id`; `alunosAtivosDaEscola(e.id)`; cfg pela escola e rede por `e.rede_id`.
- apps/api/src/operacao/painel/painel.repository.ts:287: a aba Escolas passa a contar os alunos por `alunosAtivosDaEscola(e.id)`.
- apps/api/src/operacao/painel/painel.repository.ts:356: `uso()` continua sendo o terceiro `@Unscoped` do PainelRepository (o I1 segue com 3), com justificativa reescrita, e só devolve id, nome e números.
- packages/core/src/ia/orcamento-do-mes.repository.ts:67: `custoDaEscolaNoMes`, o filtro `escola_id` vem do SQL de quem chama (hoje só `e.id`).
- packages/core/src/ia/orcamento-do-mes.repository.ts:242: `consultaDoUsoDosMeses`, `c.escola_id = requireEscolaId()`.
- packages/core/src/ia/orcamento-do-mes.repository.ts:257: `usoDosMesesAnteriores` lê a existência da escola, o consumo e o retrato, os três pela escola do contexto. Nenhum é `@Unscoped`, e o architecture.test.ts confere isso na lista fechada.
- apps/api/src/operacao/painel/painel.service.ts:185-187: `GET …/escolas/:id/uso-ia` roda em `runInContext` com o `:id` da rota. A rota é `@OperacaoRoute` com `IdPipe` e está em `ROTAS_DO_PAINEL`, então a varredura de operacao-isolamento.int.test.ts responde 404 para coordenação, professor e aluno. Nenhum `escolaId` entra por corpo ou query; o `:id` só existe em rota de operador, no mesmo padrão dos PUT da 3.0.
- packages/shared/src/operacao/painel.ts: os contratos são estritos e só levam número. Não têm alunoId, usuarioId, nome, função, modelo, aviso nem teto, e contracts.test.ts confere isso. O `custo` existe só em `usoDoPainelQuerySchema`; na aba Escolas, `?ordem=custo` responde ENTRADA_INVALIDA.
Teste de isolamento: presente e efetivo. Tirei cada cláusula mentalmente e o teste quebra em todas:
- Sem `c.escola_id = e.id` nas laterais, o caso "A e B da §2" quebra: o mês de A deixaria de ser R$ 100 e B deixaria de dar 111%.
- Sem o filtro de escola em `custoDaEscolaNoMes`, o caso "a ordem por custo…" quebra: o custo empata e o desempate pelo id põe `pouco` na frente.
- Sem a escola na consulta do consumo dos 12 meses, o caso "os 12 meses de A…" quebra: fevereiro de A passaria a somar os R$ 450 de B.
- Sem a escola no retrato, o mesmo caso quebra: fevereiro de A deixaria de ser `sem_retrato` e viria com o retrato de B.
- Sem a checagem de existência, o caso do id inexistente deixa de responder NAO_ENCONTRADO.
Bloqueantes: nenhum
Recomendações:
- packages/core/src/ia/orcamento-do-mes.repository.ts:67: `custoDaEscolaNoMes(escolaId: SQL, …)`, assim como o `alunosAtivosDaEscola` da 2.0, é exportado do core e aceita qualquer SQL como escola. Hoje só o docblock impede passar um valor vindo da requisição. Sugiro uma checagem no architecture.test.ts que restrinja quem importa esses trechos ao PainelRepository e ao OrcamentoDoMesRepository.
- apps/api/test/painel-leitura.int.test.ts:828: o caso HTTP de `…/uso-ia` calcula os meses esperados pelo mês UTC de `new Date()`, mas o serviço usa o mês de São Paulo. Entre 21h e 24h do último dia do mês o teste fica vermelho sem defeito no código. O conserto é calcular os meses esperados pelo `mesDeSaoPaulo`. Não afeta o isolamento.
```

## revisor-geral · 1ª rodada · APROVADO · 2026-11-21 07:11:29 · `tasks/prd-camada-ia/5_task.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. As quatro divergências do `5_task.md` já estão na `techspec.md` (o parágrafo "O uso (tarefa 5.0)" na §4 e a §6 reescrita) e no `cenarios.md` (a linha nova do RF11 sobre `ordem=custo` só no uso). São elas:
- os dois arquivos de `packages/core`;
- os quatro arquivos de apoio;
- o `EXPLAIN` com banco próprio;
- a contagem de alunos unificada e a ordem `custo` só no uso.

Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo).

Bloqueantes: nenhum

Recomendações:
- `apps/api/src/operacao/painel/painel.service.ts`, em `iaDaEscola`, tem o cast `situacao: mes.situacao as UsoDeIaDaEscolaDoPainel['situacao']`. Ele cala o compilador num ponto que o `parse` só confere depois. Um `orcamentoDoMes` do mês corrente com tipo de retorno que exclua `sem_retrato`, ou um guard explícito, dispensaria o cast.
- No mesmo `iaDaEscola`, o serviço passa `true` (o mês corrente) e calcula um `aviso` que o contrato descarta. Funciona, mas quem lê espera ver o aviso usado. Uma linha dizendo que o aviso fica de fora do uso de propósito evitaria a dúvida.
- `apps/api/src/operacao/painel/painel.repository.ts`: `PedidoDePaginaDoPainel.agora` passou a ser obrigatório também para `escolas()`, que só o usaria na ordem `custo`, e essa ordem a lista recusa. Um tipo de pedido próprio para o uso deixaria isso explícito no tipo.
- Pela `techspec.md` §4, o custo por aluno (`ia.mes.custoMicros ÷ ia.alunosAtivos`) quem calcula é a tela. Na 8.0, conferir que a tela trata `alunosAtivos = 0` sem dividir e mostra o mesmo número da `porcentagem` do servidor. Senão a conta do orçamento passa a existir em dois lugares.
- `apps/api/test/painel-uso-ia.plano.int.test.ts`: nos 12 meses, o teste prova que o índice cobre a consulta, não que o planejador o escolhe, porque `enable_seqscan` fica desligado. O `5_task.md` e o comentário do próprio teste já dizem isso. Fica para o `infra-guardian` decidir se um banco com a maior escola menos dominante (abaixo de 91% das linhas) daria uma prova mais forte.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-21 07:11:45 · `tasks/prd-camada-ia/5_task.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum. Só leitura no painel da Operação, por um único operador. A consulta toca `consumo_ia`, tabela que cresce com o uso, mas não fica no caminho do aluno nem do professor.
Rate limit: ok. As duas rotas ficam atrás de `@OperacaoRoute`, com limite `rl:op:{sub}` por operador e nada por IP.
Fila e prioridade: ok. Não se aplica: não há job novo.
Concorrência: protegida. A tarefa só lê. Os 12 meses são duas leituras sem transação, mas o retrato de mês fechado não muda, então não há o padrão "busca, verifica, grava".
Índice e paginação: ok.
- O `uso()` continua paginado (25 escolas). A ordem `custo` soma o mês de todas as escolas antes de cortar a página, sempre pela escola e pela faixa de tempo, no `consumo_ia_mes_idx (escola_id, em) INCLUDE (...)` da migration 0067.
- O `EXPLAIN (ANALYZE, BUFFERS)` em `apps/api/test/painel-uso-ia.plano.int.test.ts` mostra os dois planos (`uso()` por custo e os 12 meses) como `Index Only Scan` no `consumo_ia_mes_idx`, com `Heap Fetches` 0. A carga é de um ano da maior escola, 1,8 milhão de linhas.
- Os 12 meses são no máximo 12 itens, então não precisam de paginação.
Degradação de IA: não se aplica.
Migration: não se aplica. Não há migration nova; o índice usado é o da 0067.
Métrica e alerta: ok. Fora do caminho quente. As rotas entram no `http.server.request.duration` global, e não há alerta novo.
Bloqueantes: nenhum

Recomendações:
- `apps/api/src/operacao/painel/painel.repository.ts:155` e `:219-221`: na ordem `custo`, o custo do mês das 25 escolas da página é somado duas vezes, uma na chave da ordem e outra no lateral `ia_mes`. Com dez escolas não pesa. Quando o painel passar a ter rede com centenas de escolas, vale reaproveitar a soma da chave, ou ordenar pelo retrato e por um agregado diário em vez de ler `consumo_ia` de todas as escolas a cada requisição.
- `apps/api/test/painel-uso-ia.plano.int.test.ts`: a carga leva de 70 a 90 s e o arquivo roda junto com o resto da integração. Vale mandá-lo para um projeto ou etiqueta separada, rodada na esteira e não em todo `vitest run --project integracao`, para não alongar o ciclo local.
- O próprio teste do plano diz que a leitura dos 12 meses da maior escola leva cerca de 0,9 s quando o planejador escolhe varrer a tabela. Está abaixo do `statement_timeout` e da regra 00. Ainda assim, vale registrar no `docs/infra.md` o limite de quando esse caminho passa a pedir agregado mensal, por exemplo gravar o consumo no próprio retrato.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-21 07:11:53 · `tasks/prd-camada-ia/5_task.md`

VEREDITO: APROVADO

**Campos pessoais tocados:** nenhum campo novo e nenhuma migration. As duas rotas leem `consumo_ia` e `orcamento_ia_do_mes` só como soma por escola: execuções, chamadas, tokens, custo e chamadas da reserva. Dos alunos sai só a contagem (`alunosAtivosDaEscola`). A coluna `aluno_id` não entra em nenhuma consulta.

**Fora da tabela de dados do docs/lgpd.md:** nada. O consumo já está na linha 99 e o orçamento com o retrato na linha 115.

**Autorização por objeto:** ok.
- `GET /v1/operacao/escolas/:id/uso-ia` tem `@OperacaoRoute` e entra em `ROTAS_DO_PAINEL`. A varredura de `operacao-isolamento.int.test.ts` e o I3 de `architecture.test.ts` cobrem coordenação, professor, aluno e quem não tem credencial.
- Trocar o id na URL só leva o operador a outra escola, e esse alcance é dele por desenho (D76). Os meses rodam em `runInContext` do `:id`, sem `@Unscoped`, e consumo, retrato e existência da escola partem de `requireEscolaId()`.
- O id inexistente, o que não é UUID e o `'1'` respondem o mesmo `404 NAO_ENCONTRADO` (`painel-leitura.int.test.ts:834`).
- O `uso()` continua no terceiro `@Unscoped`, com a justificativa reescrita. Só `e.id` entra como escopo no SQL.

**DTO de saída:** explícito e estrito (`usoDeIaDoPeriodoDoPainelSchema`, `usoDeIaDaEscolaDoPainelSchema` e `mesDoUsoDeIaDaEscolaSchema`, todos com `strictObject`). O serviço monta cada campo um a um e não devolve o `OrcamentoDoMes` inteiro: não saem aviso nem teto. O `contracts.test.ts` proíbe `alunoId`, `usuarioId`, `nome`, `funcao`, `modelo`, `provedorId`, `aviso`, `teto`, `entrada` e `saida`. As duas rotas têm `no-store`.

**Logs:** limpos. O diff de `src` não acrescenta nenhuma chamada de log.

**Auditoria:** não é exigida. A leitura é de agregado sem pessoa, e `docs/lgpd.md:210` já diz que a contagem não gera auditoria de leitura. A tarefa não tem exportação, nota, permissão nem aprovação de saída de IA.

**Envio externo:** nenhum. A tarefa só lê.

**Retenção:** compatível. O expurgo anula `aluno_id` e mantém a linha com os números da escola (linha 99), e é dessa linha que os 12 meses leem.

**Seed/fixture:** sintético. Os testes usam 'Aluno sintético', `Escola IA …`, `Escola grande/media/pequena` e um banco próprio para o `EXPLAIN`, apagado no fim.

**Pergunta de fechamento:** a tarefa não guarda dado novo do aluno nem cria destino de envio. O arquivo do titular e a lista de compartilhamento não mudam, e a resposta continua vindo do código.

**Bloqueantes:** nenhum.

**Recomendações:**
1. `apps/api/test/painel-leitura.int.test.ts:920-927` e `:976`: o teste I6 das sentinelas não chama `GET …/escolas/:id/uso-ia` nem `GET /uso?ordem=custo`, e o comentário ainda fala em "oito rotas". Hoje o contrato estrito, só com número, já impede o vazamento. Pôr as duas chamadas em `textos` estende a prova de "nenhuma resposta nem log traz sentinela" à rota nova, como `docs/lgpd.md:209` promete.
2. `docs/lgpd.md:206-210`: o parágrafo "O painel da operação não vê pessoa da escola" é o que respondemos à escola sobre o que vemos (D61). Ele lista só o uso de infra. Falta o uso de IA por escola: hoje, o mês, os 12 meses anteriores, custo, tokens, chamadas da reserva, valor e porcentagem. Destino sugerido: a 11.4, que já mexe em `docs/lgpd.md`.
3. `TODO.md:4261` ("`OrcamentoDoMes` traz reais", com dono na 3.0 e na 5.0): a parte da 5.0 está atendida, porque o DTO da Operação mapeia campo a campo, sem aviso e sem teto. Vale anotar isso no item para a revisão da tela da coordenação não procurar de novo.

Arquivos centrais:
- apps/api/src/operacao/painel/painel.service.ts
- apps/api/src/operacao/painel/painel.repository.ts
- packages/core/src/ia/orcamento-do-mes.repository.ts
- packages/shared/src/operacao/painel.ts
- apps/api/test/painel-leitura.int.test.ts
- docs/lgpd.md

## test-engineer · 1ª rodada · REPROVADO · 2026-11-21 07:13:16 · `tasks/prd-camada-ia/5_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- **Caminho feliz:** o grupo `ia` de hoje e do mês por escola, a ordem por custo e os 12 meses lidos pelo retrato.
- **Casos de borda:**
  - chamada às 23h30 do último dia do mês (UTC-3, já o dia seguinte em UTC);
  - vínculo não encerrado do ano anterior;
  - aluno em duas turmas;
  - escola sem ano em curso (`sem_aluno_ativo`);
  - escola sem valor, nem na rede (`sem_orcamento`), e escola sem valor próprio com rede com valor;
  - mês sem retrato;
  - retrato com zero aluno;
  - reserva com execução de uma e de duas linhas;
  - virada do ano na janela dos 12 meses;
  - relógio falso no lugar do `now()` do Postgres.
- **Permissão:** coordenação, professor, aluno e nenhuma credencial em `…/uso-ia` recebem o 404 do inexistente; `ordem=custo` em `/escolas` dá `ENTRADA_INVALIDA`.
- **Isolamento:** soma de A sem o consumo de B (nas laterais e na chave da ordem); retrato de B num mês em que A não tem; id inexistente dá `NAO_ENCONTRADO`.
- **Concorrência:** não se aplica. A tarefa só lê, e o retrato de mês fechado não muda.

**Cobertos:** todas as linhas da tabela "Testes que provam a regra" têm o teste citado pelo nome, e todos existem.
- `painel-leitura.int.test.ts` (24 casos) passou.
- `operacao-isolamento.int.test.ts` (15) passou; a rota nova entra pela `ROTAS_COM_SESSAO_DE_OPERADOR`.
- `painel.test.ts` (shared), `contracts.test.ts`, `architecture.test.ts` e `apps/web/src/operacao/api/painel.test.ts` (120 no total) passaram.
- `painel-uso-ia.plano.int.test.ts` eu não rodei, de propósito: ele carrega 1,8 milhão de linhas, e a regra é não pôr a máquina sob carga. Pela leitura, ele faz o `EXPLAIN` das consultas que o repository executa de fato (`usoDaPaginaSql`, `consultaDoUsoDosMeses`).
- `--faltando` está em 0 linhas.
- Não há `.skip`, mock de coisa nossa nem provedor pago: o teste só grava em `consumo_ia` direto.
- As asserções são `toStrictEqual` sobre o item devolvido.

**Bloqueantes:**

1. **O teste dos 12 meses falha perto da virada de todo mês.** `apps/api/test/painel-leitura.int.test.ts:828-831` calcula os meses esperados pelo mês em UTC (`getUTCFullYear`/`getUTCMonth`) do relógio real. A API, pelo `PainelService`, usa `mesDeSaoPaulo(this.relogio.agora())`. Das 21h às 24h do último dia de cada mês, em São Paulo, o mês em UTC já virou e o de São Paulo não, e o teste fica vermelho. São três horas por mês, horário em que o portão e a esteira rodam.
   - Correção: calcular `esperados` a partir de `mesDeSaoPaulo(new Date())`, de `@educa/shared`. Ou então só conferir o formato e a sequência dos 12 meses a partir de `resposta.corpo.meses[0]`, deixando o conteúdo exato para o caso com relógio falso, que já existe.

2. **Cláusulas novas sem bloco de mutação.** O `--faltando` conta por linha, e cada uma destas linhas tem bloco só no `escola_id`. Os limites de tempo, que são cláusulas novas, ficaram sem bloco:
   - `apps/api/src/operacao/painel/painel.repository.ts:224`: na lateral `ia_hoje`, faltam `c.em >= ${hoje.inicio}` e `c.em < ${hoje.fim}`. O bloco do `faixaDoDia` mexe no `fim` dentro da função, não no uso dele aqui.
   - `apps/api/src/operacao/painel/painel.repository.ts:227`: na lateral `ia_mes`, faltam `c.em >= ${mes.inicio}` e `c.em < ${mes.fim}`.
   - `packages/core/src/ia/orcamento-do-mes.repository.ts:~69` (`custoDaEscolaNoMes`): faltam `c.em >= ${inicio}` e `c.em < ${fim}`. São justamente o que o título do teste da ordem promete provar ("o de março e o de maio não entram").
   - `packages/core/src/ia/orcamento-do-mes.repository.ts:~50-51` (`faixaDoMes`): falta o fuso `at time zone ${FUSO_DO_ORCAMENTO}`, no `inicio` e no `fim`. É a função nova que os três consumidores usam, e o caso de 23h30 existe para ela. Só o `fim` do `faixaDoDia` e o fuso do `to_char` dos 12 meses têm bloco.
   - Correção: um bloco por limite, removendo cada um, e um bloco trocando o fuso por `'UTC'` no `faixaDoMes`. Cada bloco cita o caso que já tem o dado para ficar vermelho:
     - `› A e B da §2`, para as laterais (a chamada de março de R$ 700, a de maio de R$ 5.000, e a de 10/04 fora de hoje);
     - `› a ordem por custo põe a de maior custo do mês primeiro`, para `custoDaEscolaNoMes` (março a R$ 500, maio a R$ 900);
     - `› A e B da §2`, para o fuso (a chamada de 23h59 de 31/03, em São Paulo).
   - O cenário já alcança cada cláusula; falta só o bloco que o prove.

**Recomendações:**
- O `usoPorCusto()` lê só a página 1 (25 escolas) por custo, e o `doItem` exige achar a escola. Isso depende de o banco ter menos de 25 escolas com custo em abril de 2033. Dentro do arquivo são 11 ou 12, e a limpeza do `afterAll` cuida do resto. Mesmo assim, uma execução que morreu antes da limpeza deixa sobras de 2033. Um mês exclusivo por execução, ou um custo-sentinela alto nas escolas do caso, tiraria essa dependência.
- Em `painel.service.ts` (`iaDaEscola`), trocar `ia.mes.custoMicros` por `ia.hoje.custoMicros` deixaria "A e B" vermelho, mas não há bloco. Não bloqueia: o termo é argumento, não condição. Vale um bloco.
- O cast `mes.situacao as UsoDeIaDaEscolaDoPainel['situacao']` em `painel.service.ts` fica protegido pelo `parse` estrito do schema, que recusa `sem_retrato` no mês corrente. Um comentário de uma linha explicaria por que o cast é seguro.
- Na tabela, a linha "contrato estrito" diz "U, I". O `contracts.test.ts` é de unidade, sobre o schema; quem lê a resposta real da rota é o `› GET /escolas/:id/uso-ia` e o `› GET /uso aceita ordem=custo`. Vale citá-los nessa linha.

Arquivos citados:
- apps/api/test/painel-leitura.int.test.ts
- apps/api/src/operacao/painel/painel.repository.ts
- apps/api/src/operacao/painel/painel.service.ts
- packages/core/src/ia/orcamento-do-mes.repository.ts
- tasks/prd-camada-ia/5_task.md

## revisor-geral · 2ª rodada · APROVADO · 2026-11-21 07:34:01 · `tasks/prd-camada-ia/5_task.md`

VEREDITO: APROVADO

Escopo: respeitado. Desde a 1ª rodada só entraram comentários em `painel.service.ts`, testes em `painel-leitura.int.test.ts`, o registro das pendências no `TODO.md` e o documento da tarefa com nove blocos de mutação e a tabela de recomendações. Nada disso puxa trabalho de tarefa futura.

Aderência à Tech Spec: ok. O diff não mexe em arquitetura nem em contrato.

Portão local: carimbo válido para o código atual (typecheck, lint, segredo, dependências, unidade, alvo).

Bloqueantes: nenhum.

- **Comentário do cast** em `apps/api/src/operacao/painel/painel.service.ts:99`. O que ele afirma é verdade: `uso()` passa a resposta por `usoDoPainelResponseSchema.parse` (linha 174), e o schema do mês corrente aceita só `definido`, `sem_orcamento` e `sem_aluno_ativo`, sem `sem_retrato` (`packages/shared/src/operacao/painel.ts:338`). Se um dia aparecer `sem_retrato`, a resposta é recusada, em vez de o valor sair calado.
- **Comentário do aviso descartado** em `painel.service.ts:90`. Bate com o mapeamento campo a campo logo abaixo e com o que o `TODO.md` registra sobre o DTO por papel.
- **Os 12 meses no teste** (`painel-leitura.int.test.ts:830-835`). A conta agora usa o mês de São Paulo. Antes usava o de UTC, que já vira o mês três horas antes no último dia, e o teste podia falhar nesse intervalo.
- **I6** agora também cobre `?ordem=custo`, `GET /escolas/:id/uso-ia` com 200 e o 404 de id inexistente. A resposta e o log dessas rotas entram na busca pelas sentinelas, e o título deixou de dizer "oito rotas", que já não era o número certo.

Recomendações:
- O comentário da linha 90 é longo para uma linha só. Partir em duas linhas ajudaria a leitura, mas é só estilo.
- A conta do ano e do mês no teste (`posicao = ano * 12 + ...`) repete a que o repository faz. Se o `shared` ganhar um auxiliar para o mês anterior, o teste pode usá-lo. Não precisa ser agora.

## test-engineer · 2ª rodada · APROVADO · 2026-11-21 07:34:56 · `tasks/prd-camada-ia/5_task.md`

VEREDITO: APROVADO

Cenários exigidos: os mesmos da 1ª rodada. Nesta rodada conferi as duas correções exigidas e o que o diff `357b5f2a..461b5a4b` alterou: os nove blocos novos de "Mutações", o I6 com as rotas do uso de IA, a linha da tabela, os comentários do serviço e o `TODO.md`.

Cobertos:

- **Correção 1, feita.** `apps/api/test/painel-leitura.int.test.ts:831-835` agora calcula os 12 meses esperados a partir de `mesDeSaoPaulo(new Date())`, com a mesma conta de `mesesAnterioresA`. Isso tira a janela de três horas por mês, das 21h às 24h do último dia em São Paulo. Rodei `npx vitest run apps/api/test/painel-leitura.int.test.ts` e os 24 casos passaram.
- **Correção 2, feita.** Os nove blocos novos batem caractere por caractere com uma única linha do código atual (conferi com `grep -F`). Repeti cada conta contra a fixture, com `AGORA = 2033-05-01T02:45Z`, que é 30/04 às 23h45 em São Paulo. Cada um fica vermelho no caso que cita:
  - **Lateral `ia_hoje` sem `>= hoje.inicio`** (`painel.repository.ts:224`): as chamadas de 10/04 e de 31/03 entram em hoje. O hoje de A dá R$ 800 em vez dos R$ 40 esperados pelo caso `› A e B da §2`.
  - **Lateral `ia_hoje` sem `< hoje.fim`**: a chamada de 01/05 às 00h10, com R$ 5.000, entra em hoje. Fica vermelho em A, e também em B, que espera `ZERO_DE_IA`.
  - **Lateral `ia_mes` sem `>= mes.inicio`** (`:227`): março, com R$ 700, entra no mês. O mês de A dá R$ 800 em vez de R$ 100.
  - **Lateral `ia_mes` sem `< mes.fim`**: maio, com R$ 5.000, entra no mês de A.
  - **`custoDaEscolaNoMes` sem o início** (`orcamento-do-mes.repository.ts:69`): `pouco` soma 510 contra 20 de `muito` e vai para a frente. Fica vermelho em `› a ordem por custo põe a de maior custo do mês primeiro`.
  - **`custoDaEscolaNoMes` sem o fim**: `pouco` soma 910 contra 20 e também vai para a frente. Mesmo caso vermelho.
  - **Fuso `'UTC'` no início de `faixaDoMes`** (`:50`): o mês começa em 01/04 às 00h UTC. A chamada de 31/03 às 23h59 em São Paulo, que é 01/04 às 02h59 UTC, entra no mês, e o mês de A dá R$ 800.
  - **Fuso `'UTC'` no fim de `faixaDoMes`** (`:51`): o mês acaba em 01/05 às 00h UTC. A chamada de 30/04 às 23h30 em São Paulo, que é 01/05 às 02h30 UTC, sai do mês, e o mês de A dá R$ 60.
  - **`ia.hoje.custoMicros` no lugar de `ia.mes.custoMicros`** (`painel.service.ts:91`): a porcentagem de A cai para 8% (o caso espera 20%) e a de B para 0% (o caso espera 111%).
- **I6 ampliado** (`painel-leitura.int.test.ts:927-932`): o caso agora inclui `?ordem=custo` sobre a escola das sentinelas, o 200 de `/escolas/:id/uso-ia` e o 404 do id inexistente. As três respostas entram na verificação de sentinelas e também na do log.
- A tabela de testes, os dois comentários do `painel.service.ts` e as linhas novas do `TODO.md` não alteram o comportamento.

Bloqueantes: nenhum.

Recomendações:

- **`faixaDoDia` não tem bloco que troque o fuso** (`packages/core/src/ia/orcamento-do-mes.repository.ts:58-59`). É uma linha nova de fuso, equivalente às de `faixaDoMes`. Hoje só o fim dela tem bloco (o `+ 2`), e `faixaDoMes` ganhou um bloco de fuso nas duas pontas. O caso `› A e B da §2` já pegaria essa troca: com UTC, a chamada de 30/04 às 23h30 em São Paulo cai fora do hoje de A. Como não pedi isso na 1ª rodada, fica como recomendação.
