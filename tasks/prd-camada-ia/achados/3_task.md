# Achados das revisões — `tasks/prd-camada-ia/3_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-21 04:53:43 · `tasks/prd-camada-ia/3_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A tarefa não toca `Nota`, correção nem avaliação. As únicas escritas novas são as colunas de orçamento de IA em `configuracao_operacional_escola` e em `rede`. Todos com autor humano? Não se aplica, porque não há escrita em `Nota`.

Decisão autônoma sobre aluno: ausente. O `PUT` grava só o valor por aluno e o teto de segurança. Nada aprova, reprova ou encaminha aluno.

Aprovação registrada: ok. A tarefa não gera saída de IA que chegue ao aluno. As duas mudanças de configuração vão à auditoria. Cada linha leva o autor (`autor_operador` da sessão, `autor_usuario_id` nulo), a data, o `antes` e o `depois`, como mostra `apps/api/test/painel-escrita.int.test.ts:510` e `:571`. O mesmo pedido repetido não grava nem audita (`apps/api/src/operacao/painel/painel.service.ts:198`). A exceção do tutor (D47) não aparece em nenhum outro agente.

Supervisão do tutor: ok. A tarefa não toca o tutor.

Autonomia declarada e visível: sim, sem mudança. Nenhum agente nem nível de autonomia foi alterado.

O que conferi nos itens restantes:
- **Item 6, auditoria:** não muda para saída de IA. As ações novas são só números, sem dado de pessoa (`packages/core/src/auditoria/acoes.ts:97`). O teste `packages/core/src/auditoria/acoes.test.ts:247` prova que campo a mais, como `autor`, é recusado.
- **Item 7, supervisão sem vigilância:** a tarefa não traz inferência emocional nem nada sobre comportamento.
- **Item 8, D55:** não há campo, tela nem prompt de nota em discursiva ou redação.
- **Item 9, D45 e D64:** o orçamento é por escola e por rede, sem métrica de professor, sem ranking e sem leitura de conversa. A auditoria da Operação fica fora do que a coordenação lê, e `apps/api/test/painel-escrita.int.test.ts:690` prova isso.
- **Fotos da tela:** não vieram. A tarefa também não tem tela: `NovaRede.tsx` muda só o tipo, e o diálogo de orçamento fica para a 7.0.

Bloqueantes: nenhum.

Recomendações:
- Na 4.0, quando o teto bloquear chamadas de IA, garantir que o corte do Tutor não deixe o professor sem ver um uso já iniciado (regra 70, item 4). O aviso ao aluno deve ser rotulado como do sistema e não incentivar a voltar a usar (D59).
- Na 7.0, o diálogo "Orçamento de IA" fica só na Operação. O "IA do mês: N% do previsto" da coordenação deve continuar agregado por escola, nunca por professor (D64).

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-21 04:54:01 · `tasks/prd-camada-ia/3_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum dado de titular escolar. As colunas lidas e gravadas são só dinheiro, percentual e contagem: `configuracao_operacional_escola.ia_valor_por_aluno_micros` e `ia_teto_de_seguranca_percentual`, e as mesmas duas em `rede`. O único dado de pessoa é o apelido do operador, da nossa equipe, que entra como `autor_operador` na auditoria.

Fora da tabela de dados do docs/lgpd.md: nada. A linha "Orçamento de IA" (`docs/lgpd.md:115`) já traz as duas ações de auditoria, a finalidade, a retenção e a regra de que a coordenação não as lê. O apelido do operador está na linha 110.

Autorização por objeto: ok.
- As duas rotas novas (`painel.controller.ts:79-97`) usam `@OperacaoRoute` e `IdPipe`, e o corpo passa por `z.strictObject`.
- A escola é gravada pelo contexto (`requireEscolaId()` em `orcamento-do-mes.repository.ts:93-108`). A rede é o único `@Unscoped`, preso ao `rede.id` do caminho, e um teste de arquitetura garante isso.
- Escola inexistente, rede inexistente e id que não é UUID respondem `NAO_ENCONTRADO` com o mesmo corpo da rota inexistente.
- Sessões de coordenador, professor e aluno recebem esse mesmo 404 (`operacao-isolamento.int.test.ts`, as rotas novas estão em `ROTAS_DO_PAINEL`).
- Um teste prova que o `PUT` em A não muda B.
- As respostas usam DTO explícito e estrito (`orcamentoDeIaDoPainelSchema`, `redeDoPainelSchema`, `escolaDoPainelSchema`), sem entidade serializada inteira.

Logs: limpos. Os eventos são `operacao.escola.orcamento_ia_alterado` (só com `escolaId`, por `naEscola`) e `operacao.rede.orcamento_ia_alterado`, sem o valor. Um teste confere que o log não contém o valor gravado (`painel-escrita.int.test.ts:512-514`).

Auditoria: presente.
- `escola.orcamento_ia_alterado` e `rede.orcamento_ia_alterado` (`packages/core/src/auditoria/acoes.ts:125-138`) têm `antes` e `depois` em `strictObject` só com números, gravados na mesma transação e só quando algo mudou.
- O autor é o operador e `autor_usuario_id` fica nulo.
- As três leituras da governança não devolvem a ação (`painel-escrita.int.test.ts:668-687`).
- Nenhuma ação nova toca titular, então o arquivo do titular (D85) não muda.

Envio externo: nenhum. A tarefa não chama provedor de IA.

Seed/fixture: sintético. Os nomes são gerados (`nomeQueVemPrimeiro('Escola do Orçamento')`, slug com `randomUUID`), e os mocks da web levam só orçamento nulo e o teto padrão.

Pergunta de fechamento: a tarefa não grava nem envia nada sobre aluno. O que o sistema responde sobre um aluno continua igual.

Bloqueantes: nenhum.

Recomendações:
1. `packages/core/src/auditoria/auditoria.repository.ts:58`: o `listDaEscola` devolve toda linha com o `escola_id` da escola, e isso agora inclui `escola.orcamento_ia_alterado`, com o valor em reais e o apelido do operador. Hoje ele não tem rota. Quando a auditoria da escola for aberta à coordenação (F3), ela precisa de uma lista de ações excluídas, ou de uma lista das permitidas, que deixe de fora as ações da operação (RF12, D40).
2. `apps/api/test/painel-escrita.int.test.ts:514`: a asserção negativa do log procura só o valor em micros (`'3000000'`). Vale incluir também o valor em centavos do pedido (`300`) e o teto (`150`), e fazer o mesmo no caso da rede.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-21 04:54:10 · `tasks/prd-camada-ia/3_task.md`

VEREDITO: APROVADO

Tabelas verificadas:
- `configuracao_operacional_escola`: tem `escola_id`, que é a chave da linha. O orçamento é mensal e não depende do ano letivo, então a tabela não precisa de `anoLetivoId`.
- `rede`: fica acima do tenant, como a regra 10 permite.
- `auditoria`: a ação da escola grava `escola_id`. A ação da rede grava `escola_id` nulo, o mesmo padrão de `rede.criada`.

Queries verificadas:
- `packages/core/src/ia/orcamento-do-mes.repository.ts`: em `lockConfiguracaoDaEscola` e `saveConfiguracaoDaEscola`, a escola vem de `requireEscolaId()` (o contexto) e nunca de um argumento. Os dois continuam sem `@Unscoped`, e o `architecture.test.ts` confere a lista exata de métodos.
- `apps/api/src/operacao/painel/orcamento-da-rede.repository.ts:22-33`: tem um único `@Unscoped`, justificado como "acima do tenant". O `select … for update` e o `update` filtram pelo `rede.id` do caminho. O `architecture.test.ts` confere que esse é o único método e a única exceção, e que só o `painel.service.ts` usa a classe.
- `apps/api/src/operacao/painel/painel.service.ts:188-234`:
  - O `PUT` da escola roda no contexto da escola `:id`.
  - As duas rotas são `@OperacaoRoute` e passam pelo `IdPipe`.
  - O corpo é um `z.strictObject` só com valor e teto, então não há como mandar `escolaId` no corpo nem na query.
  - Escola ou rede inexistente cai em `NAO_ENCONTRADO`: a da escola pela violação de chave estrangeira (23503), a da rede pelo `select` vazio.
- `apps/api/src/operacao/painel/painel.repository.ts`:
  - `redes()`: a contagem fica presa a `e.rede_id = r.id` e devolve só um número.
  - `escolas()`: o `left join` da configuração é por `cfg.escola_id = e.id`.
  - As duas leituras atendem só o painel do operador.

Teste de isolamento: presente e efetivo
- `apps/api/test/painel-escrita.int.test.ts:631-661` cria as escolas A e B em redes diferentes, cada uma com sua configuração.
  - Se o `where` de `saveConfiguracaoDaEscola` sair, B muda e a linha 651 falha.
  - Se o `where` do `update` da rede sair, a rede 2 muda e a linha 655 falha.
- As duas mutações estão declaradas no documento da tarefa.
- O 404 é o mesmo para rota inexistente, id inexistente e id fora do formato UUID (`'1837'`): linhas 605-628.
- Coordenação, professor e aluno recebem 404 nas duas rotas novas: linhas 668-693 e a varredura C46.
- Nenhuma rota de leitura da escola lista a auditoria. O `AuditoriaRepository` não tem listagem exposta.

Bloqueantes: nenhum

Recomendações:
- Regra 10, item 9: o módulo `operacao/painel` passa a ter quatro `@Unscoped`, três em `painel.repository.ts` e um em `orcamento-da-rede.repository.ts`. Todos são de rotina do operador e estavam previstos na spec, mas o número passa do sinal de alerta que a regra descreve. Vale registrar na retro se o painel deve ter uma fronteira própria, declarada como "acima do tenant", em vez de exceções acumuladas.
- `apps/api/test/painel-escrita.int.test.ts:588`: incluir `{ ...corpo(500, 200), escolaId: <outra> }` entre os corpos recusados. Hoje o `strictObject` já recusa, mas o caso deixaria escrita a regra de que a escola não vem do corpo.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-21 04:54:30 · `tasks/prd-camada-ia/3_task.md`

```
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
- apps/api/src/operacao/painel/orcamento-da-rede.repository.ts:28
- apps/api/src/operacao/painel/painel.repository.ts:166
- packages/core/src/ia/orcamento-do-mes.repository.ts:99
```

**Por que nenhum item reprova:**

- **Rate limit:** as duas rotas `PUT` usam `@OperacaoRoute`, com limite por operador (`rl:op:{sub}`). Há caso de 429 sem gravar. Nada é limitado por IP.
- **Nada demorado no request:** a escrita é uma transação curta em uma linha. Não chama modelo e não põe nada na fila.
- **Concorrência:** a escola faz `insert … on conflict do nothing` e depois trava a linha com `for update`, na mesma transação. A rede trava com `for update` pelo id. O `antes` é lido com a linha já travada, e a auditoria só é gravada se o valor mudou. Os seis testes de corrida forçam a ordem com o `WriteBlockTrigger`.
- **Leituras às 10h:** o rate limit, o despachante e o lote leem a configuração com `select` simples, que a trava não bloqueia. A linha que o `PUT` cria agora para escola que não tinha nenhuma não muda limite, vaga nem janela: cada coluna nula cai no padrão do ambiente, como acontecia sem linha (`resolverLimites`, `resolverVagas`, `resolverJanela`).
- **Estado em memória:** não há. O `AuditoriaRecorder` do módulo não guarda estado.
- **Índice e paginação:** `configuracao_operacional_escola` é lida pela chave primária `escola_id`. A lista de redes tem `limit 200`. Nenhuma tabela que cresce com aluno foi tocada.
- **Migration:** a tarefa não traz nenhuma, as colunas vieram na 2.0.
- **Métrica:** é rota administrativa do operador, fora do caminho quente. Grava log só com id quando o valor muda.
- **Teste:** nenhum chama provedor pago.

**Recomendações (não bloqueiam):**

- **`orcamento-da-rede.repository.ts:28`:** trocar `for('update')` por `for('no key update')`. O `for update` conflita com o `FOR KEY SHARE` que a chave estrangeira `escola.rede_id` pede, então um `POST /escolas` da mesma rede espera o fim do `PUT`. É milissegundo e só afeta o operador. O repositório já usa `no key update` em `turma.repository.ts:227`.
- **`painel.repository.ts:166`:** `escola.rede_id` não tem índice. A contagem `escolasQueUsamOValorDaRede` varre `escola` uma vez para cada uma das até 200 redes. Hoje são poucas escolas, mas convém pôr `escola(rede_id)` no TODO para quando o número de escolas crescer.
- **`orcamento-do-mes.repository.ts:99`:** aqui o `for update` não pesa, porque nenhuma tabela aponta para essa por chave estrangeira. Pode virar `no key update` para seguir o mesmo padrão do repositório.

Não rodei a suíte. O veredito saiu da leitura do diff e dos casos de teste listados na tarefa.

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-21 04:54:44 · `tasks/prd-camada-ia/3_task.md`

**VEREDITO:** REPROVADO
**Escopo:** respeitado
**Aderência à Tech Spec:** divergência em `techspec.md` §4. A mudança que a tarefa fez no texto quebrou a tabela da API.
**Portão local:** carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)").

**Bloqueantes:**

1. `tasks/prd-camada-ia/techspec.md:69-71`. Para registrar as divergências, a tarefa pôs uma linha em branco e um parágrafo ("O corpo do `PUT` é um `z.strictObject`…") no meio da tabela da §4, entre a linha do `PUT …/redes/:id/orcamento-ia` e a do `GET /v1/governanca/consumo`.
   - A tabela termina na linha 68.
   - A linha 71 (`| GET | /v1/governanca/consumo | coordenação | …`) vem logo depois do parágrafo, sem linha em branco. O markdown a junta ao parágrafo como texto corrido.
   - O contrato do `GET /v1/governanca/consumo` sai da tabela da API. É esse contrato que a tarefa seguinte da Governança vai ler: `situacao`, `porcentagem`, `aviso`, `porFuncao`, e a regra "sem tokens e custo".

   **Correção exigida:** devolver a linha do `GET /v1/governanca/consumo` para logo depois da linha 68, dentro da tabela. O parágrafo da tarefa 3.0 vai depois da tabela, com uma linha em branco antes e outra depois, e antes do parágrafo de `situacao`.

**Recomendações:**

- **Tratamento de erro desigual entre os dois `PUT`.** `definirOrcamentoDaRede`, em `painel.service.ts:219-233`, não tem o `try/catch` com `mapPostgresError` que `definirOrcamentoDaEscola` tem. Hoje nenhum erro do Postgres esperado chega ali. Mesmo assim, os dois `PUT` irmãos tratam erro de jeitos diferentes. Vale alinhar, ou dizer no docblock por que não precisa.
- **Captura do 23503 ampla demais.** Em `painel.service.ts:209-211`, o `23503` capturado cobre a transação inteira, auditoria incluída. Hoje só o `insert` da configuração pode disparar essa violação. Vale estreitar pelo nome da constraint, para que uma chave estrangeira futura em outra tabela não vire um `NAO_ENCONTRADO` silencioso.
- **Teste citado errado no `cenarios.md`.** A linha "Id de escola ou rede inexistente" aponta `operacao-isolamento.int.test.ts`. O caso que prova isso está em `painel-escrita.int.test.ts` ("escola e rede inexistentes, e id que não é UUID…"). Vale corrigir a coluna.
- **Nome da contagem.** `escolasQueUsamOValorDaRede` também conta a escola que só herda o teto. O nome vem da Tech Spec e não deve ser trocado nesta tarefa. Fica registrado para a 7.0, que vai escrever o texto do diálogo.

## test-engineer · 1ª rodada · APROVADO · 2026-11-21 04:56:44 · `tasks/prd-camada-ia/3_task.md`

VEREDITO: APROVADO

Cenários exigidos:
- **Caminho feliz:** o `PUT` da escola e o da rede gravam em micros, devolvem o próprio e o vigente, e auditam com `antes`, `depois` e o operador.
- **Só audita quando muda:** o mesmo `PUT` de novo não audita; mudar só o teto, só o valor, ou voltar a nulo audita cada vez.
- **Bordas do domínio:**
  - escola sem linha de configuração e sem ano `em_curso` (montagem ou virada de ano);
  - escola que define só o teto, ou só o valor (a precedência é por coluna);
  - rede que define só o teto, ou só o valor, na contagem `escolasQueUsamOValorDaRede`;
  - uma escola da rede 2 não conta na rede 1;
  - os limites 0, R$ 100,01, 99 e 1001, contra R$ 0,01, R$ 100,00, 100 e 1000;
  - o fator de centavos para micros.
- **Permissão:** coordenação, professor e aluno nas duas rotas novas recebem 404 com o corpo da rota inexistente; a coordenação não lê `*.orcamento_ia_alterado`; o autor desativado no meio do `PUT` (E11); o 429 do `rl:op`.
- **Isolamento:** o `PUT` em A não muda B; o da rede 1 não muda a rede 2; id inexistente e id que não é UUID são `NAO_ENCONTRADO`, sem linha nem auditoria.
- **Concorrência (regra 80):** dois `PUT` ao mesmo tempo, com valores diferentes e com o mesmo valor (o equivalente ao clique duplo), na escola sem linha, na escola com linha e na rede.
- **Arquitetura:** o `OrcamentoDaRedeRepository` tem exatamente um `@Unscoped`, e o `OrcamentoDoMesRepository` nenhum.

Cobertos: todos. Cada uma das 16 linhas da tabela de testes tem o seu caso citado pelo nome, e conferi que cada um existe. Os itens juntados por ponto e vírgula também têm cada um o seu caso. Rodei os testes nesta árvore:
- shared `painel.test.ts`, `orcamento-de-ia.test.ts`, `acoes.test.ts` e `architecture.test.ts`: 146 passaram;
- `painel-escrita.int.test.ts` e `painel-leitura.int.test.ts`: 49 passaram;
- `operacao-isolamento.int.test.ts`: 15 passaram.

Não há `.skip`, `.only` nem `vi.mock` no diff. A tarefa não chama IA.

As corridas são de verdade. O segundo `PUT` sai enquanto o primeiro está parado no `WriteBlockTrigger`. O `esperarNaTrava` (`wait_event_type = 'Lock'`) confirma que o segundo está na fila antes de soltar. Os dois rodam juntos em `Promise.all`, e o teste confere o `antes` e o `depois` de cada auditoria. Nenhum prazo depende da máquina estar folgada: o `nomeQueVemPrimeiro` e a pausa de 5 ms continuam certos sob carga.

Conferi os 84 blocos de mutação contra o `git diff`. Cada cláusula nova de comportamento tem o seu bloco. Os dois `for('update')` saem pelo caso "com a linha já gravada" (escola) e "rede, valores diferentes". A linha sem trava não casa o padrão `%for update%`, e o `antes` da última auditoria também sairia errado. Sobra a mutação "ler o `antes` antes de garantir a linha", do `cenarios.md` §3. Ela não tem bloco, mas o caso da escola sem linha a pega pelo `antes` da segunda auditoria.

Bloqueantes: nenhum.

Recomendações:
1. **`apps/api/test/painel-escrita.int.test.ts`, o caso "o PUT em A não muda a configuração de B…":** a parte "nem o que vale para a escola B" não prova nada. A escola B define valor e teto próprios, então nenhuma mudança na rede 2 alteraria o vigente dela. Hoje quem prende o `where` da rede é só o `configuracaoDaRede(redeB)`. Ponha na rede 2 uma escola sem linha de configuração e confira o vigente dela, como pede o `cenarios.md` §2 ("variante 2").
2. **O mesmo caso:** ele não confere o `antes` da auditoria de A. Um `select … for update` sem o `where` da escola leria a linha de outra escola como `antes`. Isso só é pego por acaso, porque o bloco usa um UUID fixo. Confira `antes` igual a `propria(5_000_000, 200)` na auditoria do segundo `PUT` de A.
3. **Os blocos do `orcamentoProprioDoPainelSchema` e do `orcamentoVigenteDoPainelSchema` (`packages/shared/src/operacao/painel.ts`):** o `--faltando: 0` vale em parte por coincidência de texto. A linha do teto (`.min(100).max(1000).nullable()`) é igual à do pedido, e a do valor (`.int().positive().nullable()`) se repete no vigente. Então a faixa do teto no próprio e o `positive` do valor no vigente não têm mutação própria. Também ficam sem bloco o `orcamento` e o `escolasQueUsamOValorDaRede: nonnegative` do `redeDoPainelSchema` e do `escolaDoPainelSchema`. Nada disso é regra de negócio (os checks do banco valem), mas vale saber que a ferramenta casa por texto.
4. **Mutações sem bloco escrito:** "update sem garantir a linha", ou seja, tirar o `insert` inteiro (citada no `cenarios.md` RF7, a linha "a primeira gravação… cria a linha"), e tirar o `update` da rede. Os dois ficam vermelhos pelos casos que já existem, porque leem a linha do banco. Só falta o bloco que registra isso.
5. **O caso "escola sem ano em curso":** ele depende de o `POST /escolas` não criar ano letivo, e hoje não cria. Uma linha `expect(select … from ano_letivo where escola_id = $1).toEqual([])` impede que o cenário pare de ser coberto sem ninguém ver, se a criação da escola mudar.
6. **O caso da coordenação, professor e aluno (`painel-escrita`):** ele compara só o `codigo`. A igualdade com o corpo inteiro da rota inexistente fica com a varredura de `operacao-isolamento`. Comparar com o `semRequisicao(inexistente)` deixaria o caso valendo sozinho.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-21 05:53:54 · `tasks/prd-camada-ia/3_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

A correção exigida na rodada anterior foi feita. Em `tasks/prd-camada-ia/techspec.md:69`, a linha do `GET /v1/governanca/consumo` voltou para dentro da tabela da §4, logo abaixo do `PUT …/redes/:id/orcamento-ia`. O parágrafo da tarefa 3.0 ficou na linha 71, depois da tabela, com uma linha em branco antes e outra depois, e vem antes do parágrafo de `situacao`.

O diff desta rodada não traz nada novo que bloqueie:
- **`painel.service.ts`:** só o docblock de `definirOrcamentoDaRede` mudou. Ele explica por que a rede não tem o `catch` do `23503` que o `PUT` da escola tem.
- **`cenarios.md:67`:** agora cita `painel-escrita.int.test.ts`, onde o caso está de fato (linha 615).
- **`painel-escrita.int.test.ts`:** os testes cresceram e nenhuma regra mudou:
  - o log não leva o valor nem o teto, na escola e na rede;
  - o campo `escolaId` a mais é recusado;
  - o `antes` da auditoria é o da própria escola;
  - a escola C, sem linha própria, herda o orçamento da rede 2;
  - o corpo do 404 de quem é da escola é comparado inteiro com o da rota inexistente.
- **`3_task.md`:** ganhou dois blocos de mutação e a tabela de destino das recomendações.
- **`TODO.md`:** recebeu os itens adiados, cada um com dono.
- **`orcamento-da-rede.repository.ts`:** o arquivo, ainda fora do controle do git, é idêntico ao da foto `499ec98`.

Recomendações:
- `apps/api/test/painel-escrita.int.test.ts:682`: `semRequisicaoDe` é cópia de `semRequisicao`, definida na linha 619 do mesmo arquivo. Vale subir uma das duas para o escopo do arquivo e usá-la nos dois casos.

## test-engineer · 2ª rodada · APROVADO · 2026-11-21 05:54:16 · `tasks/prd-camada-ia/3_task.md`

VEREDITO: APROVADO

**Cenários exigidos** (os da 1ª rodada, mais o que este diff mexe):
- Caminho feliz: `PUT` da escola e da rede gravam em micros, devolvem o orçamento próprio e o vigente, e auditam com o operador.
- Bordas:
  - escola sem ano letivo `em_curso`;
  - primeira gravação sem linha de configuração;
  - `PUT` repetido não audita;
  - mudar só o teto, só o valor, ou voltar a nulo, audita cada um;
  - escola sem valor herda o da rede, coluna a coluna;
  - limites R$ 0,01 a R$ 100,00 e teto de 100 a 1000.
- Permissão: coordenação, professor e aluno recebem o mesmo corpo da rota inexistente.
- Isolamento:
  - o `PUT` em A não muda B;
  - a rede 1 não muda a rede 2 nem o que vale para a escola da rede 2 sem linha própria;
  - o `antes` da auditoria é o da própria escola;
  - id inexistente responde igual à rota inexistente (regra 10.6);
  - `escolaId` no corpo é recusado (regra 10.3).
- Concorrência: provada na 1ª rodada; este diff não a toca.

**Cobertos:** as cinco recomendações do test-engineer (itens 4 a 8 da ordem `.processo/ordens/3_task-r1.md`) foram aplicadas e cada uma prova o que pedia:
- **Item 4:** a escola C na rede 2, sem linha de configuração, agora tem o vigente conferido (`vigente(2_000_000, 'rede', 300, 'rede')`), em `apps/api/test/painel-escrita.int.test.ts:648-650` e `:675`. Um `where` da rede trocado ou removido deixa o caso vermelho. Como o `find` devolve `undefined` quando a escola falta, o caso também não passa calado.
- **Item 5:** o `antes` do segundo `PUT` de A é conferido como `propria(5_000_000, 200)`, em `:663`. A ordem `order by em, id` não deixa margem de dúvida, porque são duas requisições separadas.
- **Item 6:** uma checagem prova que a escola criada não tem ano letivo, em `:503`. Se a criação da escola passar a abrir um ano, o cenário avisa em vez de deixar de cobrir sem ninguém ver.
- **Item 7:** o corpo inteiro da resposta, menos `requisicaoId`, é comparado com o da rota inexistente pedida com o token da coordenação, em `:682-685` e `:702`.
- **Item 8:** os dois blocos novos em "Mutações" de `3_task.md` estão lá: o `insert` da configuração, citando "a primeira gravação cria a linha da escola", e o `update` da rede, citando "rede.orcamento_ia_alterado com escola nula". Os dois casos leem a linha do banco, então ficam vermelhos com a mutação. O contador passou de 84 para 86 blocos.
- **Item 9 (privacy-guardian):** o log não leva o valor em micros nem os nomes dos campos, e o evento não leva os centavos nem o teto como número. Vale para a escola (`:517-520`) e para a rede (`:580-582`).
- **Item 10 (tenancy-guardian):** o corpo com `escolaId` entrou entre os recusados, nas duas rotas, em `:597`.
- **`cenarios.md`:** a linha de RF7 sobre id inexistente agora cita `painel-escrita.int.test.ts`. O caso existe, em `:615`.
- **Fora do meu escopo:** a mudança em `painel.service.ts` é só o texto do docblock, e a Tech Spec só teve a linha da tabela reposta. Nenhuma das duas muda comportamento a testar.
- **Rodada:** `npx vitest run apps/api/test/painel-escrita.int.test.ts` passou com 36 de 36 casos. Não há `.skip`, teste comentado nem mock novo.

**Bloqueantes:** nenhum.

**Recomendações:**
- A checagem dos centavos e do teto no log (`:520` e `:582`) só pega campo numérico do evento (`:\s*300\b`). Se o valor fosse logado como texto (`"300"`) ou dentro da mensagem, passaria. Também olha só a linha do evento, enquanto a checagem dos micros olha o log inteiro. Juntar as duas sobre o log inteiro e incluir a forma em texto fecharia esse caso. É cobertura extra, não regra sem teste.
- A ajudante que tira o `requisicaoId` do erro existe duas vezes, com nomes diferentes: `semRequisicao` em `:619` e `semRequisicaoDe` em `:682`. Vale subir uma só para o escopo do `describe` de fora.
