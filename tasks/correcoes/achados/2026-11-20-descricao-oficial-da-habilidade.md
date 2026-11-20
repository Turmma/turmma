# Achados das revisões — `tasks/correcoes/2026-11-20-descricao-oficial-da-habilidade.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-20 19:20:18 · `tasks/correcoes/2026-11-20-descricao-oficial-da-habilidade.md`

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
- A correção acrescenta uma query na leitura do diagnóstico, que hoje é feita em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/src/atividade/desempenho/desempenho.repository.ts:109` e em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/src/governanca/analista.repository.ts:231`. É um `habilidade_bncc WHERE codigo IN (...)`. Ela usa a chave primária `codigo` (`packages/core/drizzle/0059_habilidade_bncc.sql:15`), roda numa tabela pública e fixa, que não cresce com aluno, e a lista de códigos tem poucos itens. Não precisa de paginação nem de índice novo. Se o diagnóstico entrar em algum cenário do teste de carga, vale anotar que a leitura agora faz duas idas ao banco em vez de uma.
- A conferência em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/src/artefato/conferencia.ts` continua uma função pura sobre o trecho entregue, sem I/O novo no caminho da geração, e a métrica `ia.habilidade_anulada` continua contando só as habilidades anuladas. Nenhuma ação é necessária aqui.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-20 19:20:18 · `tasks/correcoes/2026-11-20-descricao-oficial-da-habilidade.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A correção só mexe na descrição da habilidade, que é texto público da tabela `habilidade_bncc`. Não cria coluna, migration nem campo de pessoa. O conteúdo do artefato continua com a mesma forma (`{ codigo, descricao }`).

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok.
- As consultas de `descricoesDasHabilidades` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/src/atividade/desempenho/desempenho.repository.ts` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/src/governanca/analista.repository.ts` continuam com o escopo de antes. Só o retorno passa a ser composto por `descricoesDoDiagnostico`.
- A leitura nova (`BnccRepository.habilidades({ codigos })`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/packages/core/src/bncc/bncc.repository.ts:27`) recebe só códigos de habilidade e devolve só código, texto e grupo da tabela pública. Ela não devolve nada que não estivesse antes no mapa da própria escola. Não confirma a existência de registro de outra escola nem leva dado de pessoa.
- O `@Unscoped` continua um só, com a justificativa.

Logs: limpos. A correção não adiciona nenhum log.

Auditoria: presente. A leitura nominal da coordenação continua pela rota auditada de antes, e o teste novo passa por ela (`nominal(c.coordenacao, …)`). A correção não cria exportação, alteração de nota, alteração de permissão nem aprovação nova.

Envio externo: sem mudança. A entrada da geração continua com os trechos e as habilidades da seção, que já iam antes. A mudança é na gravação: a descrição escrita pelo modelo é trocada pela oficial, que já veio no trecho. Nenhum dado de aluno vai para o provedor, e não há envio novo a registrar em `ExecucaoAgente`.

Seed/fixture: sintético.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/test/atividade.fixture.ts` lê a carga pública `dados-2026.08.json` da BNCC.
- O aluno do teste novo é "Aluna Sintética Elis Prado".
- Os textos inventados estão marcados como tais.

Pergunta de fechamento: a correção não altera o arquivo do titular, o registro de envio externo nem a retenção. A resposta continua a de antes. Para a escola, o diagnóstico passa a mostrar o texto oficial da BNCC, e não a paráfrase da IA rotulada como da BNCC. Isso ajuda a explicar o diagnóstico ao aluno, à família ou à secretaria, mas não muda dado pessoal.

Bloqueantes: nenhum.

Recomendações:
- Nos dois repositories, quando o mesmo código antigo (`QUI.EM.*`) foi gravado com descrições diferentes, a que fica depende da ordem das linhas (`!descricoes.has(...)`, sem ordem fixa). Não afeta dado pessoal, só a estabilidade do texto mostrado. Fica para a validação.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-20 19:20:20 · `tasks/correcoes/2026-11-20-descricao-oficial-da-habilidade.md`

VEREDITO: APROVADO

**Tabelas verificadas:** a correção não cria tabela nem migration. `habilidade_bncc` é tabela pública sem dono, uma das exceções da regra 10, item 1, e só é lida pelo `BnccRepository`. `artefato`, `entrega`, `atividade_aplicada` e `correcao` foram só lidas, por consultas que a correção não alterou.

**Queries verificadas:**
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/packages/core/src/bncc/bncc.repository.ts:41`: o novo filtro `codigos` cabe no mesmo e único `@Unscoped`, que já tem justificativa escrita. Nenhum `@Unscoped` novo entrou.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/src/atividade/desempenho/desempenho.repository.ts:96-111`: o escopo continua em `lotesAprovadosDaTurma`, que usa `requireEscolaId()` e `requireAnoEmCurso()` do contexto, e os joins comparam `escolaId` e `anoLetivoId`. Na leitura da `habilidade_bncc`, os códigos vêm do conteúdo já filtrado pela escola e a saída é só o texto público. O texto de código que a tabela não tem (`QUI.EM.*`) também vem dessa consulta com escopo, então só a própria escola o vê.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/src/governanca/analista.repository.ts:218-231`: mesmo caso. O escopo continua em `#lotesAprovados`, sem alteração. O `turmaId` só estreita a busca e não decide a escola.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/src/artefato/conferencia.ts:14-31`: função pura, sem acesso ao banco. A descrição sai dos trechos já entregues, que vêm da tabela pública.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/src/material/habilidades-do-recorte.ts:273-279`: não acessa o banco diretamente. Lê só pelo `BnccRepository`.
- Nenhum endpoint novo e nenhum `escolaId` vindo do corpo ou da query string. A camada de rede não é tocada, e o dado novo exposto é texto público da BNCC, não dado individual. Os ids não mudaram e continuam UUID.

**Teste de isolamento:** dispensado nesta correção. Ela não cria módulo nem consulta com escopo de escola. O escopo das duas leituras do diagnóstico é o mesmo de antes, e os testes de isolamento que já existiam cobrem essas leituras. O teste novo de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/src/governanca/analista.int.test.ts` roda dentro do contexto da pessoa (`comoPessoa`), passando pelo escopo real.

**Bloqueantes:** nenhum

**Recomendações:**
- O único texto que ainda sai do conteúdo da escola é o do código fora da tabela (`QUI.EM.*`). Vale um caso no `analista.int.test.ts` em que uma escola B grava `QUI.EM.05` com outro texto e se confere que a escola A continua lendo o próprio texto. Hoje isso está garantido pelo escopo, que não mudou, mas o teste deixaria registrado que esse caminho não cruza escolas.

## llm-integrator · 1ª rodada · APROVADO · 2026-11-20 19:20:23 · `tasks/correcoes/2026-11-20-descricao-oficial-da-habilidade.md`

VEREDITO: APROVADO

Perfis usados: nenhum. A correção não adiciona nem altera chamada de modelo, prompt ou contrato de tarefa. Ela só confere e normaliza a saída que a tarefa `gerarAtividadeObjetiva` já devolve, e muda a leitura do diagnóstico.

Custo estimado por professor/mês: R$ 0 a mais. Não há chamada nova de modelo. O diagnóstico ganha uma leitura SQL por vez, `habilidade_bncc` filtrada por `codigos`, e ela só roda quando há código gravado (`apps/api/src/material/habilidades-do-recorte.ts`, o `gravadas.size === 0` devolve antes de consultar). A gravação reaproveita o trecho já entregue e não lê o banco.

Prompt versionado: não se aplica. O prompt não foi tocado.

Validação de schema: sim. A saída continua validada pelo schema da tarefa e por `problemasDasQuestoes`. A conferência pós-modelo (`anularHabilidadesForaDaSecao`) agora grava a descrição do trecho, que já está no tamanho do contrato (`descricaoParaOModelo`). Assim, o texto gravado não depende mais do que o modelo escreveu.

Aprovação humana no caminho: não se aplica. A correção não altera o fluxo de entrega nem de aprovação. A entrega continua nascendo `pendente`.

Bloqueantes: nenhum.

Verificações feitas:
- **Regra 30 / 20.12:** nenhum SDK de provedor foi tocado. Nenhum log novo, nem de dado pessoal.
- **Regra 10:** `BnccRepository` é a tabela pública sem dono (exceção da regra 10.1). O filtro `codigos` entra no mesmo repository, que continua com um só `@Unscoped`. Os repositories do diagnóstico continuam lendo o conteúdo com escopo de escola e ano antes de chamar a tabela pública. O vazamento entre escolas não aumenta.
- **Caso vazio:** `descricoesDoDiagnostico` não chama `inArray` com lista vazia.
- **Artefato antigo:** o diagnóstico corrige também o artefato já gravado com descrição do modelo, o que a gravação nova não alcançaria. O código fora da tabela (`QUI.EM.*`) mantém o texto gravado.
- **Mutações:** os 12 blocos de mutação cobrem a gravação (questão e plano), os dois repositories, `descricoesDoDiagnostico` e o filtro `codigos`. Cada bloco aponta o teste que quebraria.

Não consegui confirmar a execução dos testes. `vitest` em `apps/api` falhou por ambiente. `@educa/core` não resolve e `descricaoParaOModelo is not a function` aponta para o `dist` de `packages/shared` desatualizado. Isso falha também em funções que a correção não tocou (`descricaoOficialDaHabilidade`). Não é defeito do diff, mas a execução verde depende de `build` dos pacotes antes, que a esteira ou o `test-engineer` deve confirmar.

Recomendações:
- `packages/core/src/bncc/bncc.repository.ts`: `habilidades({ codigos: [] })` depende do comportamento do Drizzle com `inArray` vazio. Vale um curto-circuito no repository ou um teste dele, para não ficar guardado só pelo chamador.
- `descricoesDoDiagnostico` faz uma consulta com todos os códigos distintos das atividades da turma ou do recorte. O tamanho é limitado pelo catálogo da BNCC, então não é problema agora. Vale reavaliar se o recorte do Analista passar a cobrir a rede inteira.

Arquivos relevantes (absolutos):
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/src/artefato/conferencia.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/src/material/habilidades-do-recorte.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/packages/core/src/bncc/bncc.repository.ts

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-20 19:20:28 · `tasks/correcoes/2026-11-20-descricao-oficial-da-habilidade.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A correção não grava nada em `Nota` nem em `correcao`. Ela muda só a descrição da habilidade no conteúdo do artefato e a forma como o diagnóstico lê esse texto. Os caminhos que já existiam não mudaram, então seguem com autor humano: sim.

Decisão autônoma sobre aluno: ausente. O diagnóstico continua contando pelo código, que já estava certo. A mudança troca só o texto que acompanha o código, e esse texto não decide nada sobre o aluno.

Aprovação registrada: ok. O artefato continua nascendo como rascunho da professora (autonomia 1, sem entrega), em `apps/api/src/artefato/ferramentas.command.ts:56`. A troca da descrição acontece em `apps/api/src/artefato/conferencia.ts:18-20` e `:26-30`, dentro de `saveArtefato`, antes da gravação. Então o que a professora vê antes de aprovar já é o texto da BNCC, e não uma paráfrase do modelo. A aprovação dela passa a valer sobre um rótulo correto, o que deixa o fluxo de aprovação mais fiel. A exceção do tutor (D47) não foi tocada nem estendida a outro agente.

Supervisão do tutor: ok. O tutor não foi tocado.

Autonomia declarada e visível: sim. Nada nesta correção mexe na autonomia declarada ou na tela de governança.

Os outros itens da auditoria:
- **Auditoria (item 6):** sem alteração. O teste novo usa a rota nominal, `apps/api/src/governanca/analista.int.test.ts:182`, que já registra auditoria.
- **Vigilância (item 7):** nada novo. O que entra é texto oficial de habilidade, sem dado de comportamento.
- **Discursiva e redação (D55):** nada novo. A troca vale só para atividade objetiva e plano de aula, e não cria campo de nota nem de conceito.
- **Medir o professor (D45, item 9):** nada novo.

Bloqueantes: nenhum.

Recomendações:
- `apps/api/src/artefato/ferramentas.command.ts:45-47`: o comentário de `saveArtefato` ainda diz só que a habilidade fora da seção é anulada. Vale dizer também que a que fica é gravada com a descrição de `habilidade_bncc`, para quem ler a gravação sem abrir a `conferencia.ts`.
- Para o dossiê de conformidade (D61) e a retro: a troca da paráfrase do modelo pelo texto oficial acontece sem registro. Só a anulação vira métrica, em `ia.habilidade_anulada`. Não é exigência da regra 70, porque não é saída de IA aprovada nem rejeitada, é correção de rótulo. Uma métrica agregada de "descrição corrigida" mostraria quantas vezes o modelo parafraseia a BNCC, o que ajuda na avaliação do provedor (D37).

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/src/artefato/conferencia.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/src/artefato/ferramentas.command.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/src/material/habilidades-do-recorte.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/src/atividade/desempenho/desempenho.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/src/governanca/analista.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/src/governanca/analista.int.test.ts

## test-engineer · 1ª rodada · REPROVADO · 2026-11-20 19:23:42 · `tasks/correcoes/2026-11-20-descricao-oficial-da-habilidade.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- Caminho feliz: a questão e o plano chegam com o código certo e a descrição do modelo, e saem gravados com a descrição de `habilidade_bncc`.
- Borda 1: um artefato gravado antes da correção, com a paráfrase do modelo, aparece com o texto oficial em toda superfície de diagnóstico que o sintoma cita: Turmas, resultado do aluno e Analista.
- Borda 2: um código do catálogo antigo (`QUI.EM.*`), que a tabela não tem, continua com o texto gravado.
- Borda 3: a descrição oficial com mais de 300 caracteres sai cortada, igual ao que a gravação guarda.
- Borda 4: a descrição em branco, ou a de outra habilidade, é trocada sem contar como anulada.
- Permissão: nenhuma rota nova. A leitura nominal continua passando pela finalidade e pela auditoria que já existiam.
- Isolamento: a tabela nova lida (`habilidade_bncc`) é pública, e os códigos vêm da query com escopo. O teste que já existe em `atividade-isolamento.int.test.ts:277` segue valendo, porque o mapa vazio volta vazio sem ler a tabela.
- Concorrência: não se aplica. É uma função pura e uma leitura.

**Cobertos (rodei, todos verdes):**
- `conferencia.test.ts`, `habilidades-do-recorte.test.ts`, `bncc.repository.int.test.ts`.
- `analista.int.test.ts › a descrição da habilidade no diagnóstico`.
- `geracao-pela-secao.int.test.ts › a descrição que o modelo escreve…`, os dois casos, atividade e plano.

Cada linha de "Teste que reproduz" tem o seu caso, e os 12 blocos de mutação alcançam as cláusulas novas do diff. As asserções conferem o resultado: os testes de integração comparam com `select descricao from habilidade_bncc`, e não com o fixture. Nada de `.skip`, e nenhum mock esconde a regra: o `BnccRepository` falso só aparece na unidade, e a integração usa o banco real. Os testes de IA usam o adaptador falso.

**Bloqueantes:**

1. **A correção quebra um e2e que o portão não roda.**
   - `e2e/analista.spec.ts:151` espera o alerta `o acerto em "Identificar o reagente limitante" (EM13CNT103)`.
   - O seed em `e2e/support/governanca.ts:22-23` grava `EM13CNT102` e `EM13CNT103`, códigos reais, com descrição inventada. É o mesmo padrão que esta correção consertou em `apps/api/test/atividade.fixture.ts`.
   - Agora `AnalistaRepository.descricoesDasHabilidades` devolve o texto de `habilidade_bncc`. Para `EM13CNT103` é "Utilizar o conhecimento sobre as radiações e suas origens…", e o banco do e2e tem a tabela carregada pela migration 0059.
   - Esse texto vai para `resumoDoAnalista.falso` (`packages/core/src/ia/tasks/resumo-do-analista.ts:116`, que copia `medida.habilidade`) e chega a `textos-da-governanca.ts:135`. O alerta muda, e o e2e fica vermelho na esteira.
   - Não rodei o e2e. A conclusão vem de ler o caminho no código.
   - Correção exigida: o seed de `e2e/support/governanca.ts` passa a usar o texto oficial da carga `dados-2026.08`, como foi feito em `atividade.fixture.ts`, e a asserção de `e2e/analista.spec.ts:151` passa a esperar esse texto.

2. **O resultado do aluno ainda mostra a paráfrase do artefato gravado antes da correção, e não há teste.**
   - O sintoma cita "no resultado do aluno", e a linha nova da Tech Spec (`tasks/prd-classificacao-bncc/techspec.md:128`) afirma que "o diagnóstico (Turmas, resultado do aluno, Analista) lê a descrição de `habilidade_bncc` pelo código". O documento diz "Fora desta correção: nada".
   - Mas `MinhaAtividadeService.meuDiagnostico` (`apps/api/src/atividade/minha-atividade/minha-atividade.service.ts:143`) monta `porHabilidade` com `habilidadesDaAtividade(questoes)`, que lê a descrição do conteúdo gravado. É a tela "Seu resultado" do aluno.
   - O próprio e2e confirma: `e2e/aluno-fluxo.spec.ts:153-154` passa vendo na tela do aluno "Calcular a massa molar de uma substância", a descrição inventada de `EM13CNT102` que o seed gravou, enquanto Turmas mostra o texto oficial.
   - Correção exigida, uma das duas:
     - (a) `meuDiagnostico` passa a usar `descricoesDoDiagnostico` sobre os códigos gravados, com um caso no estilo de `analista.int.test.ts › a descrição da habilidade no diagnóstico` que leia a rota do diagnóstico do aluno (`rotas.diagnostico`) e tenha bloco de mutação.
     - (b) O resultado do aluno é tirado da Tech Spec e do sintoma, e entra em "Fora desta correção" com o motivo.

**Recomendações:**
- Outros lugares ainda leem a descrição do conteúdo gravado, então o artefato gravado antes da correção continua mostrando a paráfrase. Vale corrigir ou declarar em "Fora desta correção":
  - a memória do Tutor (`apps/api/src/tutor/turno.command.ts:66-69`), cuja frase vai ao aluno. `apps/api/src/tutor/tutor.int.test.ts:679` passa hoje com "você errou 2 questões de “Identificar o reagente limitante de uma reação”", que é a descrição inventada de `EM13CNT104`;
  - o relatório da correção (`packages/core/src/ia/tasks/relatorio-da-correcao.ts:56-59`);
  - a tela e o PDF do artefato (`apps/api/src/artefato/pdf-do-artefato.ts:239`).
- Levar o texto oficial também a `apps/api/test/escola-tutor.fixture.ts:14-16`, que ainda junta código real com descrição inventada. É a mesma dívida que esta correção pagou no outro fixture.
- O primeiro bloco de mutação (`if (false) return questao`) fica vermelho com um `TypeError` (`habilidade.codigo` em `null`), e não por contar anulada a mais. Ele vale, mas uma mutação que contasse a questão nula como anulada provaria melhor a regra.
- Em `geracao-pela-secao.int.test.ts`, o caso do plano poderia também afirmar que `ia.habilidade_anulada` não muda, como o caso da atividade já faz.

Arquivos citados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/e2e/analista.spec.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/e2e/support/governanca.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/src/atividade/minha-atividade/minha-atividade.service.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/tasks/prd-classificacao-bncc/techspec.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/src/tutor/turno.command.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/test/escola-tutor.fixture.ts`

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-20 19:23:50 · `tasks/correcoes/2026-11-20-descricao-oficial-da-habilidade.md`

VEREDITO: REPROVADO
Escopo: incompleto
Aderência à Tech Spec: divergência em `tasks/prd-classificacao-bncc/techspec.md:128`. O texto novo diz que o resultado do aluno lê a descrição de `habilidade_bncc`, e o código não faz isso.
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")

Bloqueantes:

1. **`e2e/analista.spec.ts:151`, com a semente em `e2e/support/governanca.ts:22-23`: o e2e vai falhar na esteira.**
   - **O que está errado:** a semente grava o conteúdo com códigos reais da BNCC (`EM13CNT102`, `EM13CNT103`) e descrições inventadas ("Identificar o reagente limitante"). Com esta correção, `AnalistaRepository.descricoesDasHabilidades` passa a ler o texto da tabela, e a tabela já vem carregada pela migration `0059_habilidade_bncc.sql`. O adaptador falso copia a habilidade do recorte para o alerta (`packages/core/src/ia/tasks/resumo-do-analista.ts`, ramo `habilidade_com_acerto_baixo`). Então o alerta vai mostrar o texto oficial de `EM13CNT103` ("Utilizar o conhecimento sobre as radiações…"), e a asserção da linha 151 espera "Identificar o reagente limitante".
   - **Correção exigida:** fazer em `e2e/support/governanca.ts` o mesmo que foi feito em `apps/api/test/atividade.fixture.ts`. A semente passa a usar o texto oficial, cortado por `descricaoParaOModelo`, e o `analista.spec.ts:151` passa a esperar esse texto. Depois, procurar no `e2e/` outra semente gravada direto no banco, com código real e descrição inventada, que apareça em Turmas ou no Analista pela API real.

2. **`tasks/prd-classificacao-bncc/techspec.md:128` e a seção Correção do documento da tarefa afirmam mais do que o código entrega.**
   - **O que está errado:** a Tech Spec agora diz "o diagnóstico (Turmas, resultado do aluno, Analista) lê a descrição de `habilidade_bncc` pelo código". O documento diz que isso "corrige também o artefato já gravado". Mas o resultado do aluno ("Seu resultado", "Acertos por habilidade") ainda monta a descrição a partir do conteúdo gravado: `apps/api/src/atividade/minha-atividade/minha-atividade.service.ts:143` chama `habilidadesDaAtividade`, em `apps/api/src/atividade/correcao/lote.ts:30`. A memória do Tutor faz o mesmo (`apps/api/src/tutor/turno.command.ts:66-93`) e chega ao aluno na frase "você errou N questões de “…”". Num artefato gravado antes da correção, o aluno continua vendo a paráfrase do modelo com o rótulo de habilidade. A validação (achado maior 2) e o próprio Sintoma da tarefa citam "no resultado do aluno".
   - **Correção exigida, uma das duas:**
     - (a) fazer o resultado do aluno ler a descrição pelo `descricoesDoDiagnostico`, com um teste do artefato antigo nessa rota;
     - (b) corrigir a Tech Spec §5 e o documento da tarefa. Eles devem dizer que só Turmas e o Analista releem a tabela, e que o resultado do aluno e a memória do Tutor dependem da gravação, de modo que o artefato antigo segue com o texto gravado. Registrar também o motivo de ficar assim, por exemplo que antes deste pouso não há artefato com código BNCC fora dos ambientes de teste.

Recomendações:
- `apps/api/src/atividade/desempenho/desempenho.repository.ts:109` e `apps/api/src/governanca/analista.repository.ts:231`: os dois repositories agora juntam dados e importam um helper do módulo `material`. O projeto já resolve isso de outro jeito: o service cria o `BnccRepository` e chama o helper (`apps/api/src/artefato/artefato.service.ts:207`, `apps/api/src/material/material.service.ts:656`). Recomendo mover a chamada para `desempenho.service.ts:48`, `analista.service.ts:60` e `analista.command.ts:61`, para o repository ficar só com a leitura do banco (regra 00).
- `apps/api/test/geracao-pela-secao.int.test.ts:340-358`: as sobrecargas com `saida?: (conteudo: never) => unknown` resolvem a tipagem, mas são difíceis de ler. Dois helpers, `gerarAtividade` e `gerarPlano`, deixariam o código mais claro.
- `apps/api/test/escola-tutor.fixture.ts:16` (`HABILIDADE_LIMITANTE`, `EM13CNT104` com descrição inventada) e `e2e/support/atividade-db.ts:20-24` seguem o padrão antigo: código real com texto inventado. Hoje só a leitura do conteúdo os usa, mas qualquer teste que passe por Turmas ou pelo Analista vai cair no mesmo erro do bloqueante 1. Vale alinhar com a carga `dados-2026.08`.

Observação de processo: rodei por engano `node tools/processo/portao-local.ts` sem o subcomando `conferir`. Ele começou um typecheck, que terminou sozinho. Não alterou arquivos, e o `conferir` seguinte segue válido.

## test-engineer · 2ª rodada · APROVADO · 2026-11-20 19:39:05 · `tasks/correcoes/2026-11-20-descricao-oficial-da-habilidade.md`

VEREDITO: APROVADO

Cenários exigidos:
- Caminho feliz: a habilidade gerada com o código certo e a descrição do modelo é gravada com o texto de `habilidade_bncc`, na atividade e no plano.
- Borda: o artefato gravado antes da correção, com descrição divergente, aparece no diagnóstico da turma e no Analista com o texto oficial.
- Borda: o código que a tabela não tem (`QUI.EM.05`) fica com o texto gravado.
- Borda: a lista vazia de `codigos` no `BnccRepository`.
- Borda: a descrição trocada não conta como habilidade anulada.
- Isolamento: o texto gravado de uma escola não chega à outra.
- e2e: o alerta do Analista com o texto oficial.
- Exigido na rodada 1, item 2: o resultado do aluno lido da tabela, ou tirado do alcance.

Cobertos:
- Item 1 da rodada 1 foi feito.
  - `e2e/support/governanca.ts:28-38` lê a descrição de `dados-2026.08.json` e falha alto se o código faltar ou se o texto passar de 300 caracteres.
  - Troquei `EM13CNT102` por `EM13CNT105` porque a descrição oficial do 102 tem 341 caracteres. Conferi na carga: o 103 tem 238 e o 105 tem 218, então o texto não é cortado.
  - `e2e/analista.spec.ts:151` espera `HABILIDADE_LIMITANTE.descricao` e `.codigo`. Isso bate com a frase que `textos-da-governanca.ts:135` monta.
  - Nenhum outro e2e espera a descrição antiga dessa semente.
- Item 2 da rodada 1 foi feito pela opção (b), e ficou coerente nos três lugares.
  - O Sintoma não cita mais o resultado do aluno.
  - "Fora desta correção" nomeia os quatro leitores (resultado do aluno, memória do Tutor, relatório da correção e PDF do artefato), com o motivo.
  - `techspec.md:128` restringe a leitura pela tabela ao diagnóstico da turma, nos dois repositories.
  - O `TODO.md` registra a pendência e os fixtures que vão trocar junto.
  - `e2e/aluno-fluxo.spec.ts` continua verde de propósito, porque a tela do aluno lê o conteúdo gravado.
- Recomendações da rodada 1 que a Mesa mandou aplicar:
  - O isolamento do `QUI.EM.05` está em `analista.int.test.ts:501`.
    - O teste prova o que diz no lado do Analista. `AnalistaRepository.descricoesDasHabilidades` sem `turmaId` ordena por `1, 2` (`analista.repository.ts:227`). Sem o escopo de escola, a linha `A.` da outra escola viria primeiro, e o `toBe(TEXTO_DA_UMA)` ficaria vermelho.
  - O plano agora afirma `ia.habilidade_anulada` inalterado: `expect(await anuladasDe(a)).toBe(antes)` em `geracao-pela-secao.int.test.ts:252`.
  - A lista vazia está afirmada em `bncc.repository.int.test.ts:60`, com o bloco `return undefined`.
  - A primeira mutação passou a ser `{ anuladas += 1; return questao }`. Fica vermelha pela asserção de contagem, e não por `TypeError`.

Bloqueantes: nenhum.

Recomendações:
- Em `TODO.md`, o item "`QUI.EM.*` gravado com descrições diferentes… sem ordem fixa" está desatualizado. Os dois repositories têm `orderBy(sql\`1\`, sql\`2\`)` (`analista.repository.ts:227`, `desempenho.repository.ts:105`), então a ordem é fixa: vence a menor descrição em ordem alfabética, e não uma linha qualquer. Corrigir o texto.
- No caso de isolamento, a asserção `daTurma` (`analista.int.test.ts:522`) não depende do escopo de escola. `lotesAprovadosDaTurma(turmaId, …)` já separa pela turma, que é diferente entre as duas escolas. Quem prova o escopo é só a asserção `doAnalista`. Vale dizer isso no comentário, ou montar o caso de modo que o `turmaId` não baste.
- Não consegui rodar `analista.int.test.ts` daqui: o `@educa/core` não resolve sem build, e eu não gero build porque ele grava na árvore. Conto com o verde do portão para os casos novos.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/e2e/support/governanca.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/e2e/analista.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/src/governanca/analista.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/test/geracao-pela-secao.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/tasks/correcoes/2026-11-20-descricao-oficial-da-habilidade.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/tasks/prd-classificacao-bncc/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/TODO.md

## revisor-geral · 2ª rodada · APROVADO · 2026-11-20 19:39:34 · `tasks/correcoes/2026-11-20-descricao-oficial-da-habilidade.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

As duas correções da 1ª rodada foram feitas.

**Correção 1 (e2e do Analista): feita.**
- A semente agora lê o texto oficial da carga em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/e2e/support/governanca.ts:24-38`. A migration `0059_habilidade_bncc.sql` traz esse mesmo texto, e um teste já garante isso.
- Os dois códigos têm descrição curta (`EM13CNT103` com 238 caracteres, `EM13CNT105` com 218). Por isso o corte de 300 não muda nada, e o texto que o adaptador falso copia para o alerta é igual ao da semente.
- `e2e/analista.spec.ts:151` agora espera esse texto.
- Procurei no `e2e/` outras sementes com código real e descrição inventada. Elas estão em `atividade-db.ts`, `aluno.ts`, `aluno-eu.spec.ts`, `conta-da-escola-no-eu.spec.ts` e `professor/criados.ts`. Só verificam a descrição em telas que leem o conteúdo gravado (o resultado do aluno e a memória/Eu). Esse caminho ficou fora de propósito pela opção (b). Os testes que olham Turmas (`professor-aprovar`, `professor-turma-alunos`, `professor-turma-aberta`) verificam só o código. Nenhuma outra semente quebra.

**Correção 2 (Tech Spec e documento): feita pela opção (b).**
- A §5 da `techspec.md` (linha 128) agora diz que só os dois repositories do diagnóstico da turma (Turmas e Analista) releem a tabela.
- Ela diz também que o resultado do aluno, a memória do Tutor, o relatório da correção e o PDF leem o que foi gravado, e explica por quê: não há artefato com código BNCC e paráfrase do modelo fora dos ambientes de teste.
- O Sintoma e o "Fora desta correção" do documento dizem o mesmo.
- O trabalho adiado está registrado em `TODO.md`, já com os fixtures que vão trocar junto.

**Recomendações já aplicadas:**
- O caso das duas escolas (`analista.int.test.ts:501-524`) pega o furo de verdade. Os dois repositories ordenam por `1, 2` e ficam com a primeira linha de cada código. Sem o escopo da escola, o texto "A." da outra escola viria antes de "Z." e o teste cairia.
- O caso da lista vazia, a primeira mutação sem `TypeError` e a verificação de `ia.habilidade_anulada` no plano também estão feitos.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/tasks/correcoes/2026-11-20-descricao-oficial-da-habilidade.md:34`: a frase "Isso corrige também o artefato **já gravado**" ficou mais ampla do que o novo "Fora desta correção". Escrever "em Turmas e no Analista" deixa as duas seções iguais.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/e2e/support/governanca.ts:29`: o e2e lê o JSON da carga direto do disco, e essa leitura fica repetida em vários testes (`habilidade-bncc.int.test.ts`, `carga.test.ts`, agora no e2e). Uma função pequena para ler a carga evitaria a repetição na próxima vez que alguém precisar dela.
