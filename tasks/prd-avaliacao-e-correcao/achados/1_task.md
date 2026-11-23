# Achados das revisões — `tasks/prd-avaliacao-e-correcao/1_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-23 16:22:13 · `tasks/prd-avaliacao-e-correcao/1_task.md`

VEREDITO: APROVADO

Tabelas verificadas:
- `saida_da_aba`, `tempo_adicional`, `extensao_de_tempo` e `convocado_da_segunda_chamada` (`packages/core/drizzle/0068_prova_online.sql`, `packages/core/src/db/schema/prova-online.ts`): todas têm `escola_id` e `ano_letivo_id`. A FK que aponta para a aplicação é composta por escola, ano e id. A FK do aluno é composta por escola e aluno, com `on delete cascade`. A `saida_da_aba` tem FK composta para a tentativa.
- `pulso_da_api` e `indisponibilidade`: não têm `escola_id`, mas são fato global sem pessoa e estão nomeadas no item 1 das Regras transversais de `docs/modelo-de-dados.md`, que é o que o `architecture.test.ts` confere.
- Colunas novas em `atividade_aplicada` e `tentativa_atividade`: a FK de `segunda_chamada_de` prende a segunda chamada à mesma escola, ano, turma e artefato da original.
- Toda chave primária é UUID (v7). A da `saida_da_aba` é composta pelo escopo mais uma chave v4, que o banco confere por check.

Queries verificadas:
- `AtividadeAplicadaRepository`: `lockParaMudarAJanela` (passa por `#noAlcance`, que filtra escola, ano em curso e vínculo confirmado do professor), `alunosDaTurmaEntre`, `saveTempoAdicional`, `tempoAdicionalDaAplicacao`, `trocarTempoAdicional`, `existeTentativa`, `saveJanela` e o `create` ampliado. Todas tiram escola e ano de `requireEscolaId()` e `requireAnoEmCurso()`, e a turma vem da aplicação lida do banco.
- A subconsulta `comTempoAdicionalDaAplicacao` está ligada à escola da linha.
- O lote `doAnoEncerradoAlemDoPrazo` do expurgo filtra `escola_id` no `delete` e na subconsulta.
- As quatro leituras novas do arquivo do titular filtram por `escola_id` e `aluno_id`.
- Nenhum contrato novo aceita `escolaId` no corpo ou na query: os schemas são estritos e a chave a mais vira `ENTRADA_INVALIDA`.
- Na matriz, todas as ações novas são `nunca` para rede e coordenação.
- Não há `@Unscoped()` nesta tarefa.
- Mensagens de erro: o aluno de outra turma, de outra escola, inexistente, pendente ou desativado recebe o mesmo `ENTRADA_INVALIDA`, com corpo idêntico, e o teste compara os corpos. A aplicação de fora do alcance responde 404 igual ao do id inexistente. `PROVA_JA_COMECOU` e `ATIVIDADE_ENCERRADA` só aparecem depois de a aplicação ser achada no alcance.

Teste de isolamento: presente e efetivo (`apps/api/src/atividade/prova-online.int.test.ts`, bloco `isolamento`, linhas 344 a 420).
- Linhas 348 a 370: o PATCH usa uma janela de 50 min que não comporta o tempo adicional da aplicação. Se o escopo saísse, quem alcançasse a aplicação receberia 400 em vez de 404, e o teste quebraria.
- Linhas 385 a 419: as leituras e gravações do repository rodam com a escola trocada e com o ano trocado. Tirar a cláusula de escola ou de ano deixa a leitura não vazia, ou deixa a gravação mudar a linha, e o teste quebra.
- O teste do expurgo do worker cobre "nem o de outra escola".

Bloqueantes: nenhum.

Recomendações:
1. `atividade-aplicada.repository.ts`, `saveTempoAdicional` e `trocarTempoAdicional`: o banco só garante que o aluno é da mesma escola. Que ele é da turma depende de o service chamar `#conferirAlunosDaTurma` antes. Vale anotar isso no JSDoc dos dois métodos ou levar a conferência para dentro deles, para que outro chamador futuro (a segunda chamada, por exemplo) não a esqueça.
2. Os contratos já criados para `segunda-chamada` (`alunoIds`), `extensoes` (`alunoId`) e `acompanhamento` ainda não têm rota. As tarefas que as implementarem precisam do mesmo teste de "aluno de outra escola e inexistente respondem igual" e do 404 igual ao do inexistente.
3. `tempo_adicional.concedido_por` e `extensao_de_tempo.concedida_por` não têm FK, só o gatilho, como `aplicada_por`. Fica para o `privacy-guardian` conferir como se comportam na eliminação do professor.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-23 16:22:19 · `tasks/prd-avaliacao-e-correcao/1_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A tarefa não cria nem toca `Nota` (D46: a fatia não tem `Nota`). Os caminhos novos gravam outras coisas: `atividade_aplicada` (aplicar e `PATCH …/janela`), `tempo_adicional`, a auditoria, o expurgo e a leitura do arquivo do titular. Todos com autor humano? Sim, nas escritas que têm autor. `aplicada_por` e `concedido_por` vêm de `requestSessao().usuarioId` (`atividade-aplicada.repository.ts:144` e `:196`, `:231`), e o gatilho `exigir_equipe_da_escola` confere o autor no banco (`0068_prova_online.sql`, os dois `CREATE CONSTRAINT TRIGGER`). O expurgo é rotina de retenção e não precisa de autor humano.

Decisão autônoma sobre aluno: ausente. O envio automático pelo limite (`envio = 'limite' | 'encerramento'`) por enquanto só existe no esquema. Ele cumpre o tempo que o professor definiu e não decide aprovação, reprovação nem encaminhamento. A contagem `saidasDaAba` não tem consequência automática nesta tarefa: não entra em `MOTIVOS_DE_DESTAQUE`, não entra em `podeAprovar` e não entra em `loteApresentadoSchema`, que é estrito (`packages/shared/src/atividade/correcao.ts:76-79`).

Aprovação registrada: ok. Nada aqui passa por IA. Mudar a janela gera a auditoria `atividade.janela_alterada`, com autor pela sessão e com antes e depois (`atividade-aplicada.service.ts:384-388`). Aplicar continua gerando `atividade.aplicada`, agora com a contagem de quem tem tempo adicional.

Supervisão do tutor: ok, porque a tarefa não toca o tutor. A saída da aba segue a D70 no que esta tarefa entrega:
- a tabela `saida_da_aba` não tem `id` nem horário, e um check recusa chave v7;
- a contagem fica presa a cada prova, em `tentativa_atividade.saidas_da_aba`, e nenhum código soma as provas de um aluno;
- na matriz, coordenação, rede e professor estão em `nunca` para `registrar_saida`;
- o único leitor previsto é o professor da turma, pelo contrato da correção (`correcao.ts:112`).

Autonomia declarada e visível: sim, sem mudança. A tarefa não cria agente nem muda a autonomia de nenhum.

Bloqueantes: nenhum.

Recomendações:
1. `packages/shared/src/atividade/correcao.ts:116`: `destaqueSchema` herda `saidasDaAba` de `correcaoDoAlunoSchema`, então a contagem também vai aparecer na linha do destaque. Quando a 5.0 preencher o campo, falta um teste provando que saídas da aba não criam destaque, não mudam `podeAprovar` e não entram em `validacao_do_lote.apresentado`. Hoje isso só é garantido pelo formato do contrato, não por um teste da regra.
2. O aviso antes da prova de que as saídas da aba são contadas (D70) e o aviso fixo de que a tecnologia assistiva também conta (D88) são da 10.0. Vale anotá-los na Autoconferência da 10.0 como itens da regra 70, item 7.
3. O arquivo do titular traz a contagem de saídas por prova (`leitura-do-titular.ts:313-326`). Está certo para o próprio aluno. Vale confirmar com o `privacy-guardian` quem, além do titular, chega a ver esse arquivo no fluxo do pedido do titular, para a contagem não chegar à coordenação por esse caminho.
4. `docs/regulacao.md` não mudou e não precisava: a tarefa não introduz requisito regulatório novo.

O que rodei: os testes de `packages/shared/src/atividade/prova-online.test.ts` e `packages/shared/src/permissao/matriz.test.ts` passaram (40 de 40). Os testes de integração não rodei, porque nenhum dos achados da regra 70 depende deles.

Arquivos que olhei:
- `packages/core/drizzle/0068_prova_online.sql`
- `packages/core/src/db/schema/prova-online.ts`
- `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts`
- `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts`
- `packages/shared/src/atividade/correcao.ts`
- `packages/core/src/auditoria/acoes.ts`
- `packages/core/src/titular/leitura-do-titular.ts`

## infra-guardian · 1ª rodada · APROVADO · 2026-11-23 16:22:39 · `tasks/prd-avaliacao-e-correcao/1_task.md`

VEREDITO: APROVADO
Caminho quente tocado: prova | migration
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: compatível
Métrica e alerta: ok

Bloqueantes: nenhum

**Por item**
- **Rate limit:** não há limite novo nem limite por IP. As duas rotas passam pela `RateLimitGuard` global, que já existia.
- **Nada demorado em request:** aplicar e mudar a janela fazem só algumas leituras e gravações, numa transação curta.
- **Fila e IA:** a tarefa não cria job nem chama modelo.
- **Concorrência:**
  - O `PATCH …/:id/janela` trava a aplicação com `for update`, relê a janela e só depois confere se alguém já começou (`existeTentativa`).
  - O `openTentativa`, que já existe, também trava a aplicação, com `for share` (`minha-atividade.repository.ts:176`), e a chave estrangeira da tentativa cobre o resto. Por isso a corrida "mudar a janela × aluno começa" está fechada.
  - A segunda concessão de tempo adicional ao mesmo aluno é barrada pela restrição única `tempo_adicional_um_por_aluno`. O clique duplo em aplicar continua barrado por `atividade_aplicada_aberta_unica`, recriada com o mesmo nome.
  - As corridas (b) e (k) têm teste com a ordem forçada.
- **Índice e paginação:** as consultas novas usam índices que começam por `escola_id`:
  - em `tempo_adicional`, a restrição `(escola_id, atividade_aplicada_id, aluno_id)`;
  - em `tentativa_atividade`, a restrição `uma_por_aluno`;
  - em `saida_da_aba`, a chave primária.

  O expurgo vai em lotes, com `skip locked`. O índice `(fecha_em)`, que não começa pela escola, é da rotina global e está justificado.
- **Prova online:** o relógio é do servidor (`limite_base_em`, `pulso_da_api`, `indisponibilidade`). A gravação por item é das tarefas seguintes.
- **Migration:** só expande. As colunas novas são nulas ou têm valor padrão constante, o índice novo é criado antes de derrubar o antigo e não há rename de coluna. O código anterior continua funcionando.
- **Testes:** rodei os testes de integração da tarefa (`prova-online.int.test.ts` da API e o do schema) e os 31 passaram. Nenhum chama provedor pago.

Recomendações:
- `packages/core/drizzle/0068_prova_online.sql:4`: o cabeçalho diz que o `VALIDATE` lê a tabela "com trava que não bloqueia a escrita". Não é verdade aqui. O `migrar` roda tudo numa transação só, e o `ADD CONSTRAINT … NOT VALID` já tomou a trava `ACCESS EXCLUSIVE` (no caso da chave estrangeira, `SHARE ROW EXCLUSIVE`), que continua até o fim da transação. Assim, a validação percorre `tentativa_atividade`, que cresce com aluno, com as escritas paradas. Com o volume atual de dados sintéticos isso cabe. Corrigir o texto e, a partir do staging, levar o `VALIDATE` para um arquivo próprio, como pede o `TODO.md` (linhas 231 e 286).
- `packages/core/drizzle/0068_prova_online.sql:5-7` e `:96`: o cabeçalho remete à lista das migrations sem `concurrently` no `TODO.md`, mas a 0068 não foi acrescentada a ela. Ficam de fora três índices em `atividade_aplicada`, a restrição única nova (que monta um índice sob `ACCESS EXCLUSIVE`) e os checks validados na mesma transação. Acrescentar a 0068 junto da 0057, da 0064 e da 0067.
- O cenário do teste de carga da prova (resposta por item, retomada, relógio) não mudou nesta tarefa. Ele precisa ser atualizado na tarefa do `comecar` e da gravação por item.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-23 16:23:17 · `tasks/prd-avaliacao-e-correcao/1_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. As sete divergências da tabela da tarefa estão escritas na `techspec.md` (§3, §4, §5.1 e §7). A 1 (janela opcional até a 10.0) e a 3 (`ENTRADA_INVALIDA` sem o nome do campo) também estão no `cenarios.md`. O `architecture.test.ts` não precisou mudar, apesar de estar nos arquivos previstos: ele lê as exceções do item 1 de `docs/modelo-de-dados.md`, que já cita o `PulsoDaApi` e a `Indisponibilidade`.
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

Recomendações:
1. **PATCH numa atividade sem prova.** Em `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts:105-138`, o `PATCH …/:id/janela` com `{ tempoAdicional: [] }` numa atividade que não é avaliativa passa na `camposInvalidosDaProva` sem achar erro. A rota responde 200, grava nulos em `saveJanela` e registra uma auditoria `atividade.janela_alterada` numa atividade que nem pode ter janela. O efeito é pequeno, só uma auditoria sem sentido, mas o certo é recusar logo no começo com `ENTRADA_INVALIDA` quando `travada.avaliativa` for falso, antes da conferência.
2. **Comentário solto no expurgo.** Em `packages/core/src/retencao/expurgo-da-escola.repository.ts`, a tarefa colocou uma linha em branco entre o comentário de documentação e `const INSTRUCAO_DO_LOTE`. Com isso o editor não liga mais o comentário à constante. Há também duas linhas em branco seguidas depois de `doAnoEncerradoAlemDoPrazo`. Basta tirar as linhas a mais.
3. **`cenarios.md` sem a divergência 2.** A regra "`tempoAdicional` exige `duracaoMin`, e `duracaoMin` exige `janela`" cria uma recusa nova (`ENTRADA_INVALIDA`). Ela está na Tech Spec §5.1, mas nenhuma linha RF3 do `cenarios.md` a cita. Vale uma linha lá, para a 9.0 (segunda chamada) e a 10.0 (tela) a encontrarem.
4. **Afirmação fraca no teste.** Em `apps/api/src/atividade/prova-online.int.test.ts:380`, `expect(aplicar.status).not.toBe(201)` aceita qualquer recusa. Melhor fixar o código que o aplicar devolve hoje sem ano em curso. Isso é do `test-engineer`; fica só registrado.
5. **Comentário confuso no teste.** Em `packages/shared/src/atividade/prova-online.test.ts:33`, o comentário "a lista vazia só pede a duração inteira... que o schema da duração já garante" não diz o que o caso prova: com a lista vazia a conta nem é feita, como diz o comentário de `tempoAdicionalCabeNaJanela`. Reescrever o comentário.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-23 16:23:27 · `tasks/prd-avaliacao-e-correcao/1_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- **Caminho feliz:** aplicar com janela, duração, embaralhar e tempo adicional (+25%, +50%, +100%); mudar no PATCH só a janela, só o tempo adicional, ou os dois juntos.
- **Bordas:**
  - janela que não cabe (50 min) e a que cabe (60 min), no aplicar e no PATCH
  - não avaliativa com janela; duração sem janela; tempo adicional sem duração; motivo no corpo; aluno repetido
  - a avaliativa antiga, sem prova, que ganha janela pelo PATCH; atividade encerrada
  - aluno pendente e aluno com a conta desativada
  - professor com vínculo encerrado na turma X e aberto na Y
  - escola sem ano em curso
- **Permissão:** professor de B, sem vínculo, de outra disciplina, pendente, coordenação, aluno.
- **Isolamento:** o repository chamado direto com a escola trocada e com o ano trocado; aluno de outra escola no tempo adicional.
- **Concorrência:** (b) mudar a janela × começar; (k) mudar a janela × mudar a janela.
- **Ciclo de vida:** expurgo, eliminação do aluno e arquivo do titular.

**Cobertos:** cada linha da tabela de testes tem o caso, citado pelo nome, em `apps/api/src/atividade/prova-online.int.test.ts`, no `expurgo-da-escola.int.test.ts:651`, no `ciclo-de-vida.int.test.ts:447`, no `arquivo-do-titular.int.test.ts:515/560/579`, no `matriz.test.ts:15/160`, no `prova-online.test.ts` do shared (11 casos) e no `prova-online.int.test.ts` do core.
- Os testes leem o resultado no banco: o `retratoDa` antes e depois de cada recusa, e a auditoria lida do banco, sem `alunoId` nem `percentual`.
- Não há `.skip`, mock da regra nem chamada de IA.
- (k) são duas chamadas HTTP de verdade, com a ordem forçada por `WriteBlockTrigger`. Em (b), o começo é simulado por SQL, porque o `comecar` só chega na 3.0, e isso está justificado no documento.
- `mutacoes.ts --faltando` sai limpo. O `prova-online.int.test.ts` da API passou com 17 de 17, e o `architecture.test.ts` está verde.

**Bloqueantes:**
1. **A trava das duas corridas não tem bloco de mutação, e nenhum bloco usa os casos (b) e (k).**
   - **Onde:** `tasks/prd-avaliacao-e-correcao/1_task.md`, seção "Mutações", sobre `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts`, `lockParaMudarAJanela`, a linha `.for('update', { of: atividadeAplicada })`, e sobre `atividade-aplicada.service.ts`, `#lockAntesDoComeco`.
   - **O que está errado:** essa linha é a regra da subtarefa 1.5 e da regra 80, item 7. Como não tem condição, o `--faltando` não a cobra. Mas é a cláusula que faz o PATCH esperar o começo e reler o estado, e nenhum bloco a remove. Também nenhum bloco inverte a ordem "trava, depois `existeTentativa`". O item 1 da Autoconferência afirma um bloco por cláusula de `lockParaMudarAJanela` e de `#lockAntesDoComeco`, e essas duas ficaram de fora. Do jeito que está, nada mostra que (b) e (k) ficam vermelhos sem a trava.
   - **Correção exigida, três blocos:**
     - (a) Tirar o `.for('update', { of: atividadeAplicada })` e citar `› (k) mudar a janela × mudar a janela`. Sem a trava, a segunda mudança lê a janela de 60 min, grava o +50% e passa a esperar no `update`, que não casa com o padrão `%for update%`.
     - (b) O mesmo corte, citando `› (b) mudar a janela × começar`.
     - (c) Em `#lockAntesDoComeco`, chamar `existeTentativa` antes de `lockParaMudarAJanela`, citando `› (b)`. A mudança deixa de ver a tentativa ainda não confirmada e grava com a prova já começada.
   - **Cuidado com o bloco (a) em (b):** a trava ausente pode aparecer só como tempo esgotado do `esperarNaTrava`. Confira que o vermelho é um caso que rodou e falhou, e não erro de carga.

**Recomendações:**
- `prova-online.int.test.ts:380`: `expect(aplicar.status).not.toBe(201)` aceita um 500. Fixe o código esperado, por exemplo `NAO_ENCONTRADO`, como o PATCH faz na linha 377.
- `arquivo-do-titular.int.test.ts:570`: a tabela promete "sem `concedido_por`", mas o caso só confere o `id` e a `chave`. Acrescente `expect(doAluno).not.toContain(professor.id)`.
- O item 7 da Autoconferência diz que a transação do `aplicar` é provada "pelos casos da transação", e esse caso não existe: toda recusa acontece antes do `create`. Corrija o texto, ou acrescente um caso em que algo falha depois do `create` e a aplicação não fica gravada.
- A linha da tabela fala em "os dez casos" do `prova-online.int.test.ts` do core, e o arquivo tem 14. Os "Arquivos previstos" listam o `apps/api/test/architecture.test.ts` como alterado, e ele não mudou. Acerte o documento.
- No PATCH, o aluno de fora é testado só com três ids (outra turma, outra escola, inexistente). O professor, o pendente e o desativado ficam só no aplicar. É a mesma conferência e já tem bloco, mas incluí-los deixaria a linha 49 da tabela igual nos dois lados.

## privacy-guardian · 1ª rodada · REPROVADO · 2026-11-23 16:24:13 · `tasks/prd-avaliacao-e-correcao/1_task.md`

**VEREDITO: REPROVADO**

O bloqueante é um só e é pequeno. O tempo adicional, que é dado sensível, entra na versão do arquivo do titular que a coordenação baixa, e o `docs/lgpd.md` diz que esse dado nunca vai à coordenação. O resto da tarefa está limpo.

**Campos pessoais tocados:**
- `tempo_adicional`: `aluno_id`, `percentual` (25, 50 ou 100, sem motivo), `concedido_por`, `concedido_em`.
- `extensao_de_tempo`: `aluno_id` (nulo é a turma), `minutos`, `concedida_por`, `concedida_em`, `chave`.
- `convocado_da_segunda_chamada`: `aluno_id`.
- `saida_da_aba`: `aluno_id` e `chave` v4. Não tem `id` nem horário, e o check recusa chave v7.
- `tentativa_atividade`: `limite_base_em`, `ordem`, `saidas_da_aba`, `envio`.
- `atividade_aplicada`: janela, duração e embaralhamento, que não são dado de pessoa.

**Fora da tabela de dados do docs/lgpd.md:** nenhum. As quatro tabelas e as colunas novas já estão no mapa, com finalidade, base legal e retenção. Nenhum campo proibido para aluno. O tempo adicional fica só como percentual: o contrato é estrito e recusa o campo `motivo`, e a tabela não tem onde guardar diagnóstico.

**Autorização por objeto:** ok.
- O `PATCH /v1/atividades-aplicadas/:id/janela` trava a linha só dentro do alcance (escola, ano, turma e disciplina do professor). O que está fora responde `NAO_ENCONTRADO`, igual ao inexistente.
- Aluno de outra turma, de outra escola, inexistente, de vínculo pendente ou de conta desativada recebe sempre o mesmo `ENTRADA_INVALIDA`.
- Coordenação, rede e aluno ficam em `nunca` na matriz para as sete ações.
- O erro de validação sai sem o nome do campo e sem o que o cliente mandou.

**Logs:** limpos. O diff não acrescenta nenhum logger nem `console`.

**Auditoria:** presente. `atividade.aplicada` e `atividade.janela_alterada` levam só a contagem `comTempoAdicional`, sem `alunoId` e sem percentual, e o teste prova isso lendo do banco.

**Envio externo:** nenhum.

**Seed/fixture:** sintético. Os nomes são "Prova sintética", "Aluno" e "Colega", e as matrículas são aleatórias. Nenhum seed mudou.

**Ciclo de vida:** o expurgo do `trabalho_do_aluno` segue o prazo configurável por escola e cobre as quatro tabelas. A eliminação apaga as linhas do aluno em cascata. O arquivo do titular as traz pelo `aluno_id`, sem quem concedeu e sem a `chave`. Rodei `architecture`, `contracts`, `matriz`, `prova-online` (unidade), e `prova-online.int`, `arquivo-do-titular.int` e `ciclo-de-vida.int`: 258 testes, todos verdes.

**Bloqueantes:**

1. `packages/core/src/titular/leitura-do-titular.ts:327`
   - **O que está errado:** a leitura `tempo_adicional` não tem `naVersao`, então entra também na versão `coordenacao` do arquivo, que a coordenação baixa. A linha do tempo adicional em `docs/lgpd.md:60` diz que ele nunca sai daquela prova: "não vai ao Tutor, a Turmas nem à coordenação". A lista de exceções da versão da coordenação (`leitura-do-titular.ts:30`, item 5) não fala dele, e nenhum teste diz o que essa versão faz com ele.
   - **Correção exigida:** escolher um dos dois caminhos e provar com teste.
     - (a) Declarar a exceção. É o caminho que recomendo, porque o titular sem conta ativa só recebe o arquivo por essa versão, e o direito de acesso do art. 18 pede o arquivo completo. Mexe em três lugares: na linha de `docs/lgpd.md:60` ("exceto no arquivo do titular sem conta ativa, que a coordenação entrega, com a leitura auditada com finalidade"), no item 5 do docblock de `leitura-do-titular.ts:30`, e num caso em `arquivo-do-titular.int.test.ts` que confira o percentual na versão `coordenacao`.
     - (b) Tirar o dado dessa versão com `naVersao: (versao) => versao === 'completa'` e cobrir com um caso que prove que ele não aparece nela.

**Recomendações:**
- `packages/shared/src/atividade/prova.ts:217`: o `provaAntesDeComecarResponseSchema` reusa `duracaoDaProvaSchema` (máximo 300) para a duração do aluno, que já soma o tempo adicional. Com +100% sobre 300 min dá 600, e o `parse` quebra. Isso cai na 3.0, quando a rota existir; não é vazamento.
- O arquivo do professor não traz as concessões dele (`concedido_por`), e a spec decidiu assim. Pela regra 2 do próprio `leitura-do-titular.ts`, daria para incluir o ato sem o aluno e sem o percentual (id, aplicação e data). Vale registrar a escolha na retro.
- `extensao_de_tempo.chave` não tem o check de v4 que a `saida_da_aba` tem. Hoje isso é inofensivo, porque a tabela já guarda `concedida_em`, mas o check deixaria as duas chaves de cliente iguais.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-23 16:58:50 · `tasks/prd-avaliacao-e-correcao/1_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nesta rodada. Na migration 0068 só mudou o comentário 2, sobre a validação que trava a escrita. Escopo conferido em `tempo_adicional`, `extensao_de_tempo`, `convocado_da_segunda_chamada` e `saida_da_aba`, nas consultas do arquivo do titular (`packages/core/src/titular/leitura-do-titular.ts:316-353`). Todas filtram por `t.escola_id = ${escolaId}` e por `aluno_id = titular`.

Queries verificadas:
- `AtividadeAplicadaRepository.alunosDaTurmaEntre` (`apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts:247-265`). A escola e o ano vêm do contexto (`requireEscolaId()`, `requireAnoEmCurso()`). A consulta também exige papel `aluno`, vínculo `confirmado` e `desativado_em is null`. A turma é a da aplicação lida do banco, nunca a do corpo.
- Os dois caminhos do service chamam `#conferirAlunosDaTurma`: o `aplicar` (`atividade-aplicada.service.ts:84`) e o PATCH da janela, depois da trava (`atividade-aplicada.service.ts:112`). O comentário novo do repository, que diz que quem chama faz essa conferência, corresponde ao código.
- A leitura de `tempo_adicional` passou a entrar na versão da coordenação do arquivo do titular. A consulta segue com escopo de escola, leva o percentual e deixa de fora `concedido_por`.

Teste de isolamento: presente e efetivo.
- Em `apps/api/src/atividade/prova-online.int.test.ts:270`, o PATCH foi testado com seis alunos que não podem receber tempo adicional: de outra turma, de outra escola, inexistente, a professora, com vínculo pendente e desativado. Todos recebem `ENTRADA_INVALIDA` com o mesmo corpo de erro, e o retrato do banco não muda. Sem os filtros de escola, papel, estado ou `desativado_em`, o teste quebra.
- Em `prova-online.int.test.ts:379`, o `aplicar` numa turma de outra escola agora exige `NAO_ENCONTRADO`, quando antes bastava ser diferente de 201. A regra 6 passou a ser provada pelo código da resposta.
- Em `apps/api/test/arquivo-do-titular.int.test.ts:1337`, o teste mostra que a versão da coordenação traz o percentual, não traz quem concedeu e não traz a extensão da turma.

Os demais pontos da checagem:
- Nenhum endpoint passou a aceitar `escolaId` do cliente.
- Nenhum `@Unscoped()` novo.
- Nenhum id novo que não seja UUID.
- A camada de rede não ganhou consulta nova.

Bloqueantes: nenhum.

Recomendações:
- O teste novo da versão da coordenação (`arquivo-do-titular.int.test.ts:1337`) não tem linha de `tempo_adicional` de outra escola para o mesmo titular. Hoje o isolamento dessa tabela no arquivo depende do teste geral "a linha de outra escola não". Uma linha a mais nesse caso deixaria a exceção nova da LGPD provada também quanto à escola.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-23 16:58:55 · `tasks/prd-avaliacao-e-correcao/1_task.md`

VEREDITO: APROVADO
Caminho quente tocado: prova | migration
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: compatível
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- A 1ª rodada não exigiu correção. O que mudou desde então não mexe no comportamento:
  - comentários em `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts` e em `packages/core/src/titular/leitura-do-titular.ts`;
  - linhas em branco removidas em `packages/core/src/retencao/expurgo-da-escola.repository.ts`;
  - testes reforçados (o PATCH agora também recusa professor, aluno de vínculo pendente e aluno desativado com a mesma resposta; o `aplicar` em turma alheia passa a exigir `NAO_ENCONTRADO`);
  - blocos de mutação para a trava das corridas (b) e (k);
  - documentação.
  As corridas continuam protegidas: `for update` em `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts:336`, e a trava vem antes de `existeTentativa` em `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts:142-145`.
- `packages/core/drizzle/0068_prova_online.sql`: o comentário agora admite que o `VALIDATE` percorre `tentativa_atividade` com a escrita parada. Com o volume sintético de hoje isso passa, e o `TODO.md` já registra a 0068 na lista das migrations sem `concurrently`. Garantir que, a partir do staging, os índices sejam criados com `concurrently` e o `VALIDATE` vá para arquivo próprio, antes que `tentativa_atividade` tenha volume real.
- Continuam pendentes as recomendações da 1ª rodada que ficaram para as tarefas 3.0 e 6.5: atualizar o cenário de carga da prova (gravação por item, retomada, relógio no servidor) e a duração do aluno acima de 300 min no `provaAntesDeComecarResponseSchema`.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-23 16:59:04 · `tasks/prd-avaliacao-e-correcao/1_task.md`

**VEREDITO: APROVADO**

A correção que eu exigi na 1ª rodada foi feita pelo caminho (a), a exceção declarada, nos três lugares e com teste. Nenhuma outra mudança do diff toca dado de pessoa de um jeito novo.

**Conferência da correção exigida (`tempo_adicional` na versão `coordenacao`)**
- **`docs/lgpd.md:60`:** a linha do tempo adicional agora declara a exceção. O dado vai no arquivo do titular sem conta ativa, que a coordenação entrega, com a leitura auditada e com finalidade, e cita o art. 18. A promessa de auditoria tem código por trás: `arquivoDaEscola` grava `titular.arquivo_baixado` com versão `coordenacao` e uma finalidade de lista fechada, na mesma transação (`apps/api/src/privacidade/privacidade.service.ts:361`, ação em `packages/core/src/auditoria/acoes.ts:1063`).
- **`packages/core/src/titular/leitura-do-titular.ts:35-37`:** o item 5 do docblock declara que o dado vai nas duas versões e que leva só o percentual, sem quem concedeu. O código bate com isso. A leitura em `:330-335` não tem `naVersao` e seleciona só `id`, `ano_letivo_id`, `atividade_aplicada_id`, `percentual` e `concedido_em`, sem `concedido_por`.
- **`apps/api/test/arquivo-do-titular.int.test.ts:1337`:** o caso novo desativa a conta do aluno e confere quatro coisas na versão `coordenacao`: o percentual está lá, o id do professor não aparece, a extensão da turma não aparece, e as versões `completa` e `coordenacao` trazem a mesma linha de `tempo_adicional`. Ele prova o que a doc promete.

Outras mudanças do diff que conferi:
- O arquivo do aluno passa a ser testado sem o id de quem concedeu (`arquivo-do-titular.int.test.ts:578`).
- O caso do PATCH ganhou alunos inválidos: professora, pendente e desativado. Todos recebem `ENTRADA_INVALIDA` com o mesmo corpo, então a resposta não revela se o id existe.
- O `aplicar` de outra escola agora responde `NAO_ENCONTRADO` explícito.
- O resto são docblocks do repository, o comentário da migration 0068, o `TODO.md` e a própria tarefa. Nada disso expõe dado.

**Formato**
- **Campos pessoais tocados:** `tempo_adicional` (percentual e `concedido_por`), só na leitura do arquivo do titular.
- **Fora da tabela de dados do `docs/lgpd.md`:** nenhum. A linha de `tempo_adicional` foi atualizada com a exceção.
- **Autorização por objeto:** ok. Aluno de outra turma, de outra escola, inexistente, professora, pendente e desativado recebem a mesma resposta (`prova-online.int.test.ts:270`), e o `aplicar` de outra escola recebe 404.
- **Logs:** limpos. O diff não acrescenta log.
- **Auditoria:** presente. O download da versão da escola grava `titular.arquivo_baixado` com finalidade.
- **Envio externo:** nenhum nesta rodada.
- **Seed/fixture:** sintético. Os ids vêm de `randomUUID()` e as pessoas são criadas pelos helpers de teste.
- **Bloqueantes:** nenhum.

**Recomendações**
- O caso novo prova que `concedido_por` não sai na versão `coordenacao`. Na versão `completa` do aluno isso só está provado pelo `not.toContain(professor.id)` de `:578`. Um `expect(Object.keys(linha))` na linha de `tempo_adicional`, nas duas versões, deixaria o contrato da tabela explícito e pegaria uma coluna nova que vazasse.
- A exceção declarada é uma escolha de interpretação do art. 18 sobre dado sensível (art. 11). Ela deve entrar na lista do "a confirmar com advogado" que a própria linha já tem, para a validação humana do Joaquim.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-23 16:59:26 · `tasks/prd-avaliacao-e-correcao/1_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum, nem nesta rodada nem na anterior. O diff da 2ª rodada não toca em `Nota`, `lancadaPor`, correção, agente, Tutor nem na porta de IA. Todos com autor humano? Não se aplica, porque não há escrita.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. Nenhuma saída de IA nova. A exceção da D47 não se estende a outro agente.
Supervisão do tutor: ok (não foi tocada)
Autonomia declarada e visível: sim (não foi tocada)

Bloqueantes: nenhum

**O que mudou desde a rodada aprovada, e o efeito na regra 70**
- **Tempo adicional na versão da coordenação do arquivo do titular.** Fica em `packages/core/src/titular/leitura-do-titular.ts:35` e `:330-335`, com a linha correspondente em `docs/lgpd.md`. A leitura traz só `id`, `ano_letivo_id`, `atividade_aplicada_id`, `percentual` e `concedido_em`. Não traz `concedido_por`, e a tabela não tem campo de motivo. O teste novo em `apps/api/test/arquivo-do-titular.int.test.ts:1337` prova que o id do professor que concedeu não aparece na versão da escola. Isso também protege o item 8, porque nada nesse arquivo mostra à coordenação um ato nominal do professor. O dado é uma adaptação (D35), não uma nota nem uma inferência. A escolha de base legal é assunto do `privacy-guardian`, não meu.
- **Recusa do tempo adicional.** Fica em `apps/api/src/atividade/prova-online.int.test.ts:270`. Agora o professor, o pendente e o desativado também recebem a mesma recusa. Não há efeito na regra 70.
- **Docblocks do repository, comentário da migration 0068, `TODO.md`, mutações da trava e a linha nova do `cenarios.md`.** Nenhum deles toca em nota, IA, Tutor, autonomia ou indicador de professor.
- **Recomendações da minha 1ª rodada.** Estão registradas em `tasks/prd-avaliacao-e-correcao/1_task.md`. O teste de que a saída da aba não cria destaque nem entra em `validacao_do_lote.apresentado` foi para a 8.0. Os avisos D70 e D88 foram para a 10.0. A dúvida sobre quem chega à contagem de saídas da aba no arquivo ficou coberta pelo item 2 da ordem. O destino de cada uma está adequado.

Recomendações:
- Quando a 8.0 passar a preencher `saidasDaAba` na correção, o teste da recomendação da 1ª rodada precisa provar três coisas: não cria destaque, não altera `podeAprovar` e não entra no registro da validação (D56 e D70). Sem isso, a garantia continua sendo só o formato do contrato.
- Na tela da 10.0, conferir pela foto que o aviso de contagem de saídas da aba aparece ao aluno antes da prova, e que o professor vê o aviso fixo da tecnologia assistiva (D88).

## revisor-geral · 2ª rodada · REPROVADO · 2026-11-23 17:00:15 · `tasks/prd-avaliacao-e-correcao/1_task.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: divergência na versão do arquivo do titular que a coordenação baixa (`coordenacao`)
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)

Bloqueantes:

1. **A versão `coordenacao` do arquivo do titular leva o tempo adicional e a contagem de saídas da aba. O PRD e a Tech Spec dizem que a coordenação não vê nenhum dos dois, e nenhuma das duas exceções está registrada na spec.**
   - **Onde está:**
     - `packages/core/src/titular/leitura-do-titular.ts:306` (`tentativa_atividade` com a coluna `saidas_da_aba`), `:316` (`saida_da_aba`) e `:330` (`tempo_adicional`). As três leituras não têm `naVersao`, então entram também na versão `coordenacao` (o filtro está em `:597`).
     - `tasks/prd-avaliacao-e-correcao/1_task.md:1514`.
   - **O que está errado:**
     - O `prd.md:34` diz que a coordenação **não pode** "ver saída da aba ou tempo adicional de um aluno". O `prd.md:80` diz que a saída da aba é "só o professor vê". A `techspec.md:127` diz, sobre esses dados, "a coordenação e a rede, nada disto".
     - **Tempo adicional.** Nesta rodada a exceção passou a ser declarada no `docs/lgpd.md:60` e no docblock (`leitura-do-titular.ts:35-37`), mas não entrou na `techspec.md` (a linha "Retenção e titular", `:125`) nem na tabela "Divergências resolvidas nesta tarefa" do `1_task.md`. É uma regra do PRD mudada sem passar pela spec. A precedente, a conversa do Tutor nessa mesma versão, foi declarada no PRD da feature dela.
     - **Saída da aba.** A contagem chega à coordenação por dois caminhos: `saida_da_aba` agrupada e `tentativa_atividade.saidas_da_aba`. Isso não está declarado em lugar nenhum. O `docs/lgpd.md:58` diz "mostrada só ao professor da turma", e nenhum teste diz o que a versão `coordenacao` faz com ela.
     - O `1_task.md:1514` diz que a recomendação 3 do `conformidade-reviewer`, que era exatamente esta pergunta, foi "Coberto pelo item 2 desta ordem". O item 2 tratou só de `tempo_adicional`, então a afirmação é falsa.
   - **Correção exigida:**
     - (a) Registrar a exceção do tempo adicional na `techspec.md`, na linha "Retenção e titular" (que versão leva o quê, o motivo do art. 18 e sem `concedido_por`), e uma linha na tabela de divergências do `1_task.md`. Como contraria o PRD §4, quem decide é o Arquiteto: a tarefa reporta e não decide sozinha.
     - (b) Para a saída da aba, escolher um caminho e prová-lo com um caso na versão `coordenacao` em `apps/api/test/arquivo-do-titular.int.test.ts`. Um caminho é declarar a exceção do mesmo jeito: `docs/lgpd.md:58`, item 5 do docblock, `techspec.md` e tabela de divergências. O outro é tirá-la dessa versão: `naVersao: (v) => v === 'completa'` em `saida_da_aba` e `saidas_da_aba` fora da `tentativa_atividade` na versão `coordenacao`.
     - (c) Corrigir o texto do `1_task.md:1514`.

Recomendações:
- `tasks/prd-avaliacao-e-correcao/1_task.md:1517`: o destino da minha recomendação da 1ª rodada (PATCH com `{ tempoAdicional: [] }` em atividade não avaliativa) diz "`TODO.md`, para o Arquiteto decidir", mas o `TODO.md` não ganhou essa entrada (a única linha nova é a da 0068). Acrescentar a entrada ou corrigir o destino.
- As correções que pedi na 1ª rodada estão feitas e corretas:
  - linhas em branco do expurgo;
  - linha RF3 nova no `cenarios.md:24`;
  - `NAO_ENCONTRADO` fixado em `prova-online.int.test.ts:379`;
  - comentário de `packages/shared/src/atividade/prova-online.test.ts:31`, que agora corresponde ao último `expect`.
- O docblock novo de `saveTempoAdicional` e `trocarTempoAdicional` (`atividade-aplicada.repository.ts:267-270` e `:296-299`) corresponde ao código: os dois caminhos do service chamam `#conferirAlunosDaTurma`.

Arquivos citados:
- packages/core/src/titular/leitura-do-titular.ts
- tasks/prd-avaliacao-e-correcao/prd.md
- tasks/prd-avaliacao-e-correcao/techspec.md
- tasks/prd-avaliacao-e-correcao/1_task.md
- docs/lgpd.md
- apps/api/test/arquivo-do-titular.int.test.ts

## test-engineer · 2ª rodada · APROVADO · 2026-11-23 17:00:20 · `tasks/prd-avaliacao-e-correcao/1_task.md`

**VEREDITO: APROVADO**

**Cenários exigidos (os da 1ª rodada, conferidos no diff desde ela):**
- caminho feliz de aplicar e mudar a janela
- a janela que não cabe com +25, +50 e +100%
- tempo adicional sem duração, e duração sem janela
- aluno fora da turma: de outra turma, de outra escola, inexistente, o professor, de vínculo pendente e desativado
- permissão: coordenação, aluno, professor de outra disciplina, pendente e trocado
- isolamento entre escolas
- a corrida (b) mudar a janela × começar e a (k) mudar a janela × mudar a janela
- eliminação do aluno e arquivo do titular

**Cobertos:** todos. Conferi cada correção exigida.

1. **Os três blocos da trava estão em `tasks/prd-avaliacao-e-correcao/1_task.md`, na seção "A trava das duas corridas".** O texto de cada bloco bate com o código de `atividade-aplicada.repository.ts:335-337` e de `atividade-aplicada.service.ts:142-146`. Os nomes citados casam com um caso só cada um: `prova-online.int.test.ts:295` para a (b) e `:316` para a (k). O portão rodou as 171 mutações sobre o documento e todas ficaram vermelhas (`.processo/portao.json`).
   - **Por que cada bloco fica vermelho:**
     - **(c)**, `existeTentativa` antes da trava: o PATCH não vê a tentativa ainda não confirmada. Ele espera no `for update`, grava e devolve 200, e o vermelho vem da asserção de negócio da linha 311 (`PROVA_JA_COMECOU`).
     - **(a) e (b)**, sem o `for update`: o PATCH só espera no `update` de `saveJanela`, que não casa com o padrão `%atividade_aplicada%for update%`. Então o `esperarNaTrava` estoura os 15 s (`write-block-trigger.ts:7`) e lança erro dentro do corpo do caso. É um caso que rodou e falhou, e o que ele detecta é justamente a falta da trava.
     - Não é erro de carga nem depende da máquina folgada: com a trava presente, o PATCH fica preso até o teste soltar a transação.
2. `prova-online.int.test.ts:379` agora exige `NAO_ENCONTRADO`.
3. `arquivo-do-titular.int.test.ts:577-578` confere que o arquivo do aluno não traz o id de quem concedeu.
4. O PATCH de `prova-online.int.test.ts:270-272` inclui o professor, o aluno de vínculo pendente e o desativado, com o mesmo corpo de erro nos seis.
5. O item 7 da Autoconferência foi corrigido: só o reler depois da trava é provado por caso, e a atomicidade do `aplicar` é a da transação.
6. Os "quatorze casos" conferem com os 14 `it(` de `packages/core/src/db/schema/prova-online.int.test.ts`. Os Arquivos previstos tiraram o `architecture.test.ts` e citam `tools/guardas/tabelas-do-nucleo.mjs`.
7. O que mais entrou nesta rodada:
   - Um caso novo: a versão da escola traz o tempo adicional, sem quem concedeu e sem a extensão da turma (`arquivo-do-titular.int.test.ts:1337`).
   - A linha nova do `cenarios.md` sobre tempo adicional sem duração está coberta por `prova-online.test.ts:38-49`, na unidade, e por `prova-online.int.test.ts:152`, no aplicar.
   - Não há `.skip`, teste comentado nem mock da regra.

**Bloqueantes:** nenhum.

**Recomendações:**
- O vermelho dos blocos (a) e (b) depende do texto da consulta (`%for update%` no `pg_stat_activity`) e de esperar os 15 s do `aguardar`. Fica mais robusto se o caso (k) conferir o estado final mesmo quando o `esperarNaTrava` falha: a janela continua a de 60 min e entra um `tempo_adicional`. Assim a mutação também quebra uma asserção de negócio, e não só a espera.
- O caso novo da versão da escola (`arquivo-do-titular.int.test.ts:1337`) não está citado na linha "Arquivo do titular" da tabela de testes de `1_task.md`. Vale citá-lo, porque ele é o que prova a exceção nova escrita em `docs/lgpd.md`.
- A linha nova do `cenarios.md` cita também o PATCH, mas não há caso de integração do PATCH com tempo adicional numa prova sem duração. A função é a mesma (`camposInvalidosDaProva`) e a unidade a cobre, então é só cobertura a mais. A segunda chamada fica com a 9.0.

## revisor-geral · 3ª rodada · APROVADO · 2026-11-23 20:12:30 · `tasks/prd-avaliacao-e-correcao/1_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

As três correções exigidas foram feitas, e a spec, o código e os testes agora dizem a mesma coisa.

- **1(a), tempo adicional.** A exceção está registrada em dois lugares da `techspec.md`: na linha "Retenção e titular" (`:125`, com percentual e `concedido_em`, sem `concedido_por`, pelo art. 18) e na linha "DTO" (`:127`). O `1_task.md` ganhou a linha na tabela de divergências, com a decisão do Joaquim de 23/11/2026. O PRD também foi atualizado: §4 (`prd.md:34`), RF9 (`:50`), §6 (`:59-64`) e a linha da saída da aba (`:86`). Assim a regra do PRD deixou de ser mudada sem passar pela spec.
- **1(b), saída da aba, caminho A.** A exceção está declarada em `docs/lgpd.md:58`, no item 5 do docblock (`leitura-do-titular.ts:35-39`), na `techspec.md:125` e no `cenarios.md:100`. O caso novo está em `apps/api/test/arquivo-do-titular.int.test.ts:1356`. Ele confere três coisas na versão `coordenacao`:
  - as colunas exatas da linha (`ano_letivo_id`, `atividade_aplicada_id`, `id`, `saidas`), sem horário;
  - a contagem do aluno, sem a do colega;
  - `tentativa_atividade.saidas_da_aba`, e que nenhuma chave do cliente aparece.

  No código, `saida_da_aba` (`leitura-do-titular.ts:318`), `tempo_adicional` (`:332`) e `tentativa_atividade` (`:308`) não têm `naVersao`. Portanto entram nas duas versões, como a spec agora diz.
- **1(c).** O texto do `1_task.md` sobre a recomendação 3 do `conformidade-reviewer` agora descreve o que foi decidido. Não diz mais "coberto pelo item 2".
- **2.** O `TODO.md` ganhou a entrada do PATCH com `{ tempoAdicional: [] }` numa atividade não avaliativa, com o destino para o Arquiteto e a 10.0. Isso bate com o `1_task.md`.

Recomendações:
- `tasks/prd-avaliacao-e-correcao/cenarios.md:63` (RF9) diz "Coordenação e rede: nenhum dos três de aluno". Isso vale para os contratos da API e continua certo. Mas a linha não cita a exceção do arquivo do titular, como o `prd.md:50` agora cita. Um "(fora o arquivo do titular, §6)" evita que um leitor futuro veja ali uma contradição com o `cenarios.md:100`.

## test-engineer · 3ª rodada · APROVADO · 2026-11-23 20:12:38 · `tasks/prd-avaliacao-e-correcao/1_task.md`

VEREDITO: APROVADO

**Cenários exigidos (nesta rodada):** a mudança desde a rodada 2 é a exceção decidida pelo Joaquim em 23/11. A versão `coordenacao` do arquivo do titular, que é a do titular sem conta ativa, passa a levar duas coisas:
- o tempo adicional, só o percentual e a data, sem `concedido_por`;
- a contagem de saídas da aba por prova, sem horário, sem chave e sem somar entre provas.

Para provar isso, o teste precisa mostrar três coisas: os dois dados aparecem nessa versão, o colega não entra, e nenhuma chave do cliente sai. O resto do diff é texto: PRD §4 e §6, Tech Spec, `docs/lgpd.md`, o comentário de `leitura-do-titular.ts`, a linha de `cenarios.md`, uma entrada nova no `TODO.md` e as tabelas da tarefa.

**Cobertos:**
- **O caso novo** está em `apps/api/test/arquivo-do-titular.int.test.ts:1356` (`a saída da aba vai na versão da escola (a exceção declarada, art. 18)…`). Ele confere quatro coisas:
  - a contagem é a do aluno (2) e não a soma com o colega (5). Isso derruba a mutação que tira `s.aluno_id = t.aluno_id` do join;
  - as colunas da linha são exatamente `['ano_letivo_id', 'atividade_aplicada_id', 'id', 'saidas']`, o que pega coluna nova que vaze;
  - `tentativa_atividade.saidas_da_aba` vem na versão da escola;
  - nenhuma das cinco chaves, nem as do colega, aparece no texto do documento.
- **O caso do tempo adicional** na versão `coordenacao` já existia na rodada 2 (linha 1353). Ele compara essa versão com a `completa`.
- **Rodei o arquivo** com `-t "versão da escola"`: 9 passaram, 61 foram pulados pelo filtro, 1 arquivo verde.
- **Mutações:** o código de leitura não mudou nesta rodada, só o comentário. A inclusão nas duas versões é o padrão, porque a tabela não tem `naVersao` (`leitura-do-titular.ts:599`). Logo não há cláusula nova que precise de bloco. Se alguém pusesse `naVersao: (v) => v === 'completa'` em `saida_da_aba` ou `tempo_adicional`, os dois casos da versão da escola quebrariam.
- **Isolamento:** o colega na mesma prova está no caso novo. Outra escola fica com o caso geral `o aluno: cada tabela que ele tem aparece…`, que não mudou.
- Não há `.skip`, mock nem IA nos casos novos. Não há concorrência nova a provar.

**Bloqueantes:** nenhum.

**Recomendações:**
1. A linha "Arquivo do titular" da tabela de testes da tarefa (`tasks/prd-avaliacao-e-correcao/1_task.md:60`) ainda não cita pelo nome os dois casos da versão `coordenacao`. Isso ficou mais urgente nesta rodada, porque a linha de `cenarios.md` agora tem essa cláusula explícita. Os testes existem e passam, então não bloqueia, mas a validação vai procurar os nomes ali.
2. O comentário do caso novo (`arquivo-do-titular.int.test.ts:1366`) fala em "o id de quem concedeu", e esse id não existe na saída da aba. É texto herdado do caso do tempo adicional e pode sair.
3. As pendências da rodada 2 continuam: o estado final no caso (k) quando o `esperarNaTrava` falha, e o PATCH com tempo adicional numa prova sem duração, na 9.0. As duas já estão na tabela de recomendações da tarefa.
