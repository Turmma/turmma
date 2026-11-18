# Achados das revisões — `tasks/correcoes/2026-11-17-esteira-vermelha-desde-a-3-0.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## llm-integrator · 1ª rodada · APROVADO · 2026-11-17 22:58:00 · `tasks/correcoes/2026-11-17-esteira-vermelha-desde-a-3-0.md`

VEREDITO: APROVADO
Perfis usados: nenhum. A correção só altera e2e e não adiciona nem muda chamada de modelo. O catálogo `FUNCOES` e a tarefa `classificar_secoes` não foram tocados.
Custo estimado por professor/mês: não se aplica a esta correção, porque ela não adiciona chamada de modelo. O custo da `classificacao_do_material` e da `classificar_secoes` pertence à tarefa 3.0/4.0 e à estimativa dessa spec.
Prompt versionado: não se aplica
Validação de schema: não se aplica
Aprovação humana no caminho: não se aplica

Bloqueantes: nenhum

Conferi o diff em `e2e/agentes.spec.ts` e `e2e/professor-entregas.spec.ts`. Não rodei os testes.
- Nenhum SDK de provedor, nenhum prompt e nenhum caminho de execução de agente foi tocado.
- Os dois e2e passam a ler `FUNCOES` de `packages/shared/src/time/funcoes.ts`, em vez de contar com o número 3. O campo `agente` existe no catálogo e as quatro funções do Assistente aparecem nele.
- Em `professor-entregas.spec.ts` a comparação é chave a chave, na ordem do catálogo. Uma função de outro agente na lista do Assistente quebra o caso, e isso preserva o escopo que o comentário já afirmava. Em `agentes.spec.ts` a contagem vem do catálogo, por agente.
- Este caminho já tinha teste que o prova: o e2e que a esteira reprovou. O `fila-de-ia.int.test.ts` não foi tocado, e a 4.0 já o atualizou, como a tarefa descreve.
- Um e2e que importa de `packages/shared` não abre a fronteira de provedor de IA. O arquivo importado é só de catálogo de funções, sem SDK.

Recomendações:
- A ordem da comparação em `professor-entregas.spec.ts` depende da ordem das chaves em `FUNCOES` e da ordem de render em `Time.tsx`. Se uma das duas mudar de ordem, o caso quebra sem que haja regressão. Se isso incomodar, ordene os dois lados antes do `toEqual`. Não bloqueia, porque hoje as duas ordens coincidem.
- O título do caso `agentes.spec.ts:186` ("três funções no Assistente") continua dizendo três, e são quatro. A tarefa já registra isso e o mantém de propósito, porque outras correções citam o título por nome. Não bloqueia.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-17 22:58:08 · `tasks/correcoes/2026-11-17-esteira-vermelha-desde-a-3-0.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

**O que conferi**

- **Escopo.** O diff mexe só nos dois e2e que a correção nomeia. Não toca na tela, no catálogo nem em `fila-de-ia.int.test.ts`; a 4.0 já tinha corrigido esse último, como o documento registra.
- **Ordem das funções.** A comparação nova em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/e2e/professor-entregas.spec.ts` exige a mesma ordem do catálogo, e essa ordem bate com a da API. A API monta `funcoes` filtrando `CHAVES_DE_FUNCAO` (`packages/shared/src/time/time.ts:45`), e essa lista sai de `Object.keys(FUNCOES)` (`packages/shared/src/time/funcoes.ts:94`). O teste filtra `Object.entries(FUNCOES)`, então a ordem é a mesma.
- **Importação de `packages/shared`.** O caminho relativo `../packages/shared/src/...ts` já é usado em outros e2e, como `acesso-suspenso.spec.ts` e `alocacao.spec.ts`. Não é um jeito novo de fazer.
- **Tela.** Na foto `professora--professor-time-assistente--O-que-cada-função-faz-sozinha--computador.png` aparecem as quatro funções do Assistente na ordem do catálogo: Conversa e ferramentas, Correção de objetiva, Adaptação, Classificação do material. Os nomes seguem o catálogo e não aparece função de outro agente. Isso confirma que a tela estava certa e o e2e é que estava com o número velho.

**Recomendações**

- O título do caso em `e2e/agentes.spec.ts:186` ainda diz "três funções no Assistente", e agora são quatro. O documento justifica deixá-lo como está, porque duas correções antigas citam esse título pelo nome. A dívida fica registrada para a retro: num próximo ajuste desse caso, renomear e atualizar as duas citações juntas.
- `e2e/agentes.spec.ts` agora lê a quantidade de funções de cada agente, mas não confere quais são. Se aquele caso também passar a comparar as chaves, como `professor-entregas.spec.ts` faz, fica pego o caso em que o número bate mas a função é de outro agente. É cobertura extra.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-17 22:58:09 · `tasks/correcoes/2026-11-17-esteira-vermelha-desde-a-3-0.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma. A correção não traz migration nem schema. Só lê o catálogo estático `FUNCOES` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/shared/src/time/funcoes.ts`), que é constante de código, não tabela, e não tem dado de escola.

Queries verificadas: nenhuma. O diff não mexe em repository, query, endpoint nem `@Unscoped()`. A mudança está só em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/e2e/agentes.spec.ts` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/e2e/professor-entregas.spec.ts`. Nos dois, um número escrito à mão virou leitura do catálogo, pelo campo `agente`. Nenhum endpoint passou a aceitar `escolaId` do cliente, e nenhuma resposta passou a confirmar se um dado de outra escola existe.

Teste de isolamento: não se aplica. Não há módulo, repository nem endpoint novo que exija teste de isolamento. Os e2e alterados conferem quais funções aparecem na tela e não mexem em escopo de escola.

Bloqueantes: nenhum.

Recomendações:
- O diff também altera `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/correcoes/achados/indice.md` (uma linha), que não aparece na lista de arquivos da tarefa. Não afeta o isolamento, mas a lista deveria incluí-lo.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-17 22:58:14 · `tasks/correcoes/2026-11-17-esteira-vermelha-desde-a-3-0.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok (não tocado)
Fila e prioridade: ok (não tocada)
Concorrência: protegida (não tocada; o diff é só de teste e2e)
Índice e paginação: ok (nenhuma query nova)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (nenhum código novo no caminho quente)
Bloqueantes: nenhum
Recomendações:
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/e2e/professor-entregas.spec.ts`, o `toEqual(doAssistente)` exige que as funções apareçam na tela na mesma ordem das chaves de `FUNCOES`. Se a ordem do catálogo ou a de `Time.tsx` mudar, o caso quebra sem regressão real. Comparar sem ordem (os dois lados ordenados) basta para provar que só as funções do Assistente aparecem, e todas elas.
- O título do caso `agentes.spec.ts:186` ainda diz "três funções no Assistente", e o catálogo tem quatro. Ele fica como está, pelo motivo registrado na tarefa. Quando os dois documentos de correção que o citam forem atualizados, vale renomear.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-17 22:58:18 · `tasks/correcoes/2026-11-17-esteira-vermelha-desde-a-3-0.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta correção. O diff só mexe em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/e2e/agentes.spec.ts` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/e2e/professor-entregas.spec.ts`, e nenhum dos dois grava `Nota`. Todos com autor humano? Sim, porque nenhum caminho novo foi criado.
Decisão autônoma sobre aluno: ausente.
Aprovação registrada: ok. A função `classificacao_do_material` (`packages/shared/src/time/funcoes.ts:59-66`, nível 1) não manda nada ao aluno. A habilidade só passa a valer quando o professor confere a atividade e a aplica. A exceção do D47 continua só no Tutor (`tutor_com_o_aluno`, linha 73).
Supervisão do tutor: ok, nada mudou aqui.
Autonomia declarada e visível: sim.
- Na foto `coordenacao--coordenacao-agentes--celular-2.png`, a coordenação vê "Classificação do material" com "FAZ E REGISTRA", "ALTO RISCO: TEM AVALIAÇÃO DE IMPACTO", "FUNCIONANDO", o que a função faz sozinha, o que espera aprovação e o botão "Suspender esta função". A tela que produz isso é `apps/web/src/areas/coordenacao/governanca/Agentes.tsx:205`.
- Na foto `professora--professor-time-assistente--O-que-cada-função-faz-sozinha--computador.png`, a professora vê a mesma função em português comum (`apps/web/src/areas/professor/assistente/Time.tsx:208`).
- As fotos mostram as funções do Assistente marcadas como IA. Nenhuma traz nota, conceito ou sugestão de nota, nem nada que empurre a pessoa a usar mais.

Bloqueantes: nenhum.

Sobre os e2e:
- **`professor-entregas.spec.ts`:** a checagem ficou mais forte. Antes o caso contava 3 funções. Agora compara chave a chave as funções do Assistente no catálogo com os `data-funcao` da tela, na mesma ordem. Isso vale porque `time.ts:45` monta a lista filtrando `CHAVES_DE_FUNCAO` pelo agente. Se uma função do Tutor ou do Analista aparecer na tela do Assistente, o caso quebra. Se uma função do Assistente sumir da tela, também quebra.
- **`agentes.spec.ts`:** a quantidade de funções de cada agente agora sai do catálogo. Nenhuma checagem que a regra 70 usa perdeu força: autonomia, suspensão e auditoria continuam em `governanca.int.test.ts` e `governanca.test.ts`.

Recomendações:
- O título do caso em `e2e/agentes.spec.ts:186` ainda fala em "três funções no Assistente", e agora são quatro. A tarefa já registrou por que deixou como está. Vale renomear quando as correções que citam esse título forem arquivadas.
- A tela do professor não mostra o nível de autonomia de cada função, só o que ela faz sozinha e o que espera dele. A regra 70 item 5 só pede o nível visível ao coordenador, e isso já existia antes desta correção, então não bloqueia. Fica como sugestão de clareza para a retro.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-17 22:58:19 · `tasks/correcoes/2026-11-17-esteira-vermelha-desde-a-3-0.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A mudança mexe só em dois testes e2e. Eles deixam de escrever à mão quantas funções cada agente tem e passam a ler essa contagem do catálogo `FUNCOES` (`packages/shared/src/time/funcoes.ts`), que é público, sem dono e sem dado de pessoa. Não há migration, schema, DTO, repository nem rota nova.

Fora da tabela de dados do docs/lgpd.md: nada, porque não entra campo novo.

Autorização por objeto: ok. A mudança não cria nem altera rota, e os e2e continuam usando a escola de teste montada por `montarEscolaComEntregas` e `criarEquipeComSenha`.

Logs: limpos. Não há log novo. Os testes só leem o atributo `data-funcao`, que traz a chave da função (por exemplo `adaptacao`), e nunca dado de aluno.

Auditoria: presente. Não há ação nova que exija auditoria, e o que `agentes.spec.ts` já verificava com `auditoriasNoBanco` e `suspensoesNoBanco` continua igual.

Envio externo: nenhum. A mudança não cria tarefa de IA nem envio a provedor.

Seed/fixture: sintético. O seed não foi mexido, e as fotos confirmam: "Colégio sintético da vitrine cheia b35595ae", "Professora Sintética Helena 6a5a727e", "Coordenadora sintética bcc7d210", "Estequiometria: versão adaptada sintética · 2ºB 6a5a727e".

Fotos da tela:
- **Professor em `/professor/time/assistente`** (`professora--professor-time-assistente--O-que-cada-função-faz-sozinha--computador.png`): mostra as quatro funções do Assistente, só com o texto do catálogo. Não aparece nome, matrícula nem conteúdo de aluno. A função nova, "Classificação do material", diz que não chega nada ao aluno e que a coordenação corrige a classificação. Isso está de acordo com a regra 20 e com a regra 70, item 3. O único item da faixa "Esperando você" traz o título sintético de uma entrega e a turma, para o próprio professor.
- **Coordenação em `/coordenacao/agentes`** (`coordenacao--coordenacao-agentes--computador.png`): mostra só a autonomia e o estado de cada função, sem nenhum dado de pessoa além do nome de quem está logado.

Pergunta de fechamento: a mudança não afeta a resposta. Ela não acrescenta dado guardado nem destino de envio, e o arquivo do titular continua cobrindo o que já cobria.

Bloqueantes: nenhum.

Recomendações:
- `e2e/agentes.spec.ts:186`: o título do caso ainda diz "três funções no Assistente", e agora são quatro. O implementador já registrou por que mantém o título, e esse ponto não é desta regra.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/e2e/agentes.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/e2e/professor-entregas.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/correcoes/2026-11-17-esteira-vermelha-desde-a-3-0.md

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-17 22:58:24 · `tasks/correcoes/2026-11-17-esteira-vermelha-desde-a-3-0.md`

VEREDITO: APROVADO
Tela vista: sim (14 fotos lidas: professora em `/professor/time/assistente` e coordenação em `/coordenacao/agentes`, no computador e no celular, escola cheia e vazia).
Estados: ok. A correção só mexe em e2e, e os estados não mudaram. As fotos mostram "com dado" e "vazio". O vazio da professora traz o cartão "O que o Assistente de ensino faz por você" com os botões "Pedir ao Assistente" e "Ver as ferramentas", ou seja, convida e não se desculpa. Carregando e erro ficam como estavam, e o caso de e2e alterado ainda os cobre (o título do caso diz "carregando, erro, e sem entrega nenhuma").
Acessibilidade: sem mudança. Os dois casos mantêm `seriousViolations` e `horizontalOverflow` depois da alteração.
Chromebook fraco: sem efeito, pois não há mudança de tela nem de código de produção.
Celular: ok nas fotos a 360 px. Não há rolagem horizontal nem texto cortado. Os botões "Suspender esta função", "Aprovar" e "Pedir ao assistente" têm alvo de toque confortável. Os casos continuam rodando nos projetos `chromebook` e `celular`.
Ação oficial protegida: sim, nada mudou. A tela da professora segue com "Aprovar" e "Rejeitar…" ao lado do que está sendo decidido, e a da coordenação com "Suspender esta função" por função.

Conferência da correção (código contra foto):
- A nova função "Classificação do material" aparece nas quatro telas, com o texto do catálogo (`packages/shared/src/time/funcoes.ts:58-64`). Na coordenação ela leva a marca "Alto risco: tem avaliação de impacto" e o botão de suspender.
- A ordem na tela é a do catálogo: Conversa e ferramentas, Correção de objetiva, Adaptação, Classificação do material. Isso sustenta a comparação chave a chave de `e2e/professor-entregas.spec.ts:43-48`.
- `e2e/agentes.spec.ts:29-35` conta as funções de cada agente pelo catálogo. Os imports `../packages/shared/src/time/funcoes.ts` seguem o padrão dos outros e2e.
- A página `/professor/time/assistente` rola (847 px cheia, 1107 px vazia). A tarefa não a alterou, e não há RF de PRD desta correção que diga que ela cabe. Não é achado desta tarefa.

Bloqueantes: nenhum.

Recomendações:
- O título do caso em `e2e/agentes.spec.ts:186` ainda diz "três funções no Assistente", e agora são quatro. A tarefa já registrou por que não renomeou: duas correções antigas citam o título. Vale renomear e atualizar as citações quando houver outra passagem pelo arquivo.
- No celular, o título da escola no cabeçalho aparece cortado ("Colé…", "Colégio s…"). É anterior a esta tarefa e o botão "Sair" fica à vista, mas dá para ceder espaço ao nome da escola.
- No celular, o texto longo se mistura sob a barra de navegação fixa. É o comportamento esperado de barra fixa, e a última linha da página não fica escondida, como mostram as fotos `celular-2` e `celular-3`.

## test-engineer · 1ª rodada · APROVADO · 2026-11-17 22:58:37 · `tasks/correcoes/2026-11-17-esteira-vermelha-desde-a-3-0.md`

VEREDITO: APROVADO

**Cenários exigidos:** esta correção mexe só nos dois e2e que tinham o número velho. Por isso o que importa é saber se cada um ainda prova a regra que já provava:
- **Tela do professor** (`/professor/time/assistente`): mostra todas as funções do Assistente de ensino e só elas, sem as do Tutor e do Analista. Uma função nova do Assistente aparece sem precisar editar o e2e.
- **Tela da coordenação** (`/coordenacao/agentes`): cada cartão de agente mostra a quantidade de funções que o catálogo dá a ele.
- **O inventário da fila de IA** (D55) tem que listar a tarefa nova `classificar_secoes`.
- Isolamento e permissão: não se aplicam. Nenhum repository, rota ou dado de escola muda.

**Cobertos:**
- **Tela do professor**, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/e2e/professor-entregas.spec.ts:44-48`. O teste lê da tela a lista de chaves das funções e compara com as funções do Assistente no catálogo `FUNCOES`, na ordem. A tela recebe a lista de `montarTime`, o código real de `packages/shared`, ligado à página por `e2e/support/assistente.ts:181`. O teste fica vermelho se:
  - a tela trouxer uma função do Tutor ou do Analista;
  - a tela perder uma função do Assistente;
  - o agrupamento por agente quebrar.

  Ficou mais forte que antes, que só contava.
- **Tela da coordenação**, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/e2e/agentes.spec.ts:29-36` e na asserção da linha 117. A quantidade esperada por agente agora vem do catálogo (4, 2 e 1), e não de números escritos à mão. Se a API puser a função de um agente no cartão de outro, as contagens ficam diferentes e o teste falha.
- **Fila de IA**, em `apps/api/src/ia/fila-de-ia.int.test.ts:241` e `:245`, que já trazem `classificar_secoes` desde a 4.0. Não rodei esse teste: ele precisa do banco, e o documento registra 27 casos verdes. Conferi o conteúdo pela leitura.
- **Mutações:** o diff só toca `e2e/`, então não há código de produção sem bloco. O documento registra `--faltando: 0`.
- **O resto da lista:** não há `.skip`, teste comentado nem mock escondendo a regra, e nenhum provedor de IA é chamado. Concorrência não se aplica. Também procurei em `e2e/` outra contagem de `[data-funcao]` escrita como número e não achei nenhuma.

**Bloqueantes:** nenhum.

**Recomendações:**
1. Em `e2e/agentes.spec.ts:117`, comparar as chaves de cada cartão, como o professor-entregas agora faz, e não só a quantidade. Hoje, se a API trocar uma função do Assistente por outra função do mesmo agente, a contagem continua igual e o teste não percebe.
2. O título do caso em `e2e/agentes.spec.ts:186` ainda diz "três funções no Assistente", e agora são quatro. O documento justifica não renomear para não deixar órfãs as duas correções antigas que citam esse título. Fica para a retro decidir se vale atualizar as três juntas.
3. A comparação em `professor-entregas.spec.ts:48` exige que a tela siga a ordem do catálogo. Hoje segue, porque `montarTime` percorre o catálogo. Vale uma linha de comentário dizendo que a ordem também faz parte do contrato, para ninguém achar que é coincidência.

## test-engineer · 2ª rodada · APROVADO · 2026-11-17 23:11:15 · `tasks/correcoes/2026-11-17-esteira-vermelha-desde-a-3-0.md`

VEREDITO: APROVADO

Cenários exigidos: nesta rodada, os dois ajustes que eu recomendei na 1ª. (a) O cartão de cada IA na governança mostra exatamente as funções que o catálogo dá àquele agente: nenhuma trocada por outra, nenhuma de outro agente. (b) A tela "Seu time" do professor mostra só as funções do Assistente, na ordem do catálogo. Além disso, a nova linha do `TODO.md`.

Cobertos:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/e2e/agentes.spec.ts:29-33` e `:120-122`: `funcoesDoAgente` agora devolve a lista de chaves do catálogo, não só a quantidade. O cartão é comparado com ela por `toEqual`, depois de um `toHaveCount`, que espera a tela carregar antes da leitura. O atributo `data-funcao` traz `funcao.chave` (`apps/web/src/areas/coordenacao/governanca/Agentes.tsx:205`), então a comparação é chave com chave.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/e2e/professor-entregas.spec.ts:43-49`: a mesma comparação, feita sobre `Time.tsx:208`, que também traz a chave.
- A ordem confere de ponta a ponta. As duas telas saem de `montarTime` (`packages/shared/src/time/time.ts:45`), que filtra `CHAVES_DE_FUNCAO`. Essa lista é `Object.keys(FUNCOES)` (`packages/shared/src/time/funcoes.ts:94`), e o teste lê `Object.entries(FUNCOES)`, que dá a mesma ordem. O comentário que diz que a ordem faz parte do contrato está correto.
- O teste falha se a regra for removida: com uma função trocada de agente, uma chave trocada, uma função a mais ou a menos, a lista do teste e a da tela ficam diferentes, e o `toEqual` acusa. Antes, só a primeira dessas mudanças era pega, e só quando mudava a contagem.
- A linha nova do `TODO.md` só registra o que o `frontend-reviewer` viu (nome da escola cortado nos 360 px). Fica fora do escopo desta correção, que não mexe em `apps/web`, e já tem o dono indicado. Está em ordem.
- Não há `.skip`, não há mock nem provedor de IA no diff, e nada nele pede teste de concorrência.

Não rodei o e2e: ele precisa da aplicação inteira de pé, e a lógica das duas comparações se confere lendo o código. O e2e roda na esteira.

Bloqueantes: nenhum.

Recomendações:
- A mesma conta (`Object.entries(FUNCOES)`, filtrar pelo agente, tirar a chave) agora está escrita duas vezes: em `agentes.spec.ts:29-33` e em `professor-entregas.spec.ts:45-47`. Vale levar a função para `e2e/support/` e usar dos dois lados. Não bloqueia.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-17 23:11:19 · `tasks/correcoes/2026-11-17-esteira-vermelha-desde-a-3-0.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo, para o código atual)
Bloqueantes: nenhum

O que conferi nesta rodada:
- **Comparar as chaves de cada cartão (`agentes.spec.ts`):** foi feito. As linhas 29 a 33 e 120 a 122 de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/e2e/agentes.spec.ts` comparam as chaves de verdade. `Agentes.tsx:205` grava a chave da função em `data-funcao`. A lista na tela vem de `GovernancaService.#agentes`, que chama `montarTime` (`packages/shared/src/time/time.ts:45`). Como `montarTime` percorre o catálogo na ordem dele, o `toEqual` com ordem fixa está certo.
- **Comentário de que a ordem é contrato (`professor-entregas.spec.ts`):** foi feito, na linha 44 de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/e2e/professor-entregas.spec.ts`. O que o comentário afirma bate com o código. A recusa de comparar sem ordem, registrada na tabela "Recomendações sem aplicar", tem motivo e está coerente com isso.
- **`TODO.md`:** a linha do nome da escola cortado no celular está no formato da casa e deixa o dono para o Orquestrador decidir. Fica fora de `apps/web`, o que respeita o escopo da correção.

Recomendações:
- Os dois arquivos de e2e repetem o mesmo filtro: as chaves do catálogo de um agente, na ordem do catálogo (`funcoesDoAgente` em `agentes.spec.ts:30` e `doAssistente` em `professor-entregas.spec.ts:45`). Uma função única em `e2e/support/` evitaria ter dois jeitos de fazer a mesma coisa.
- A leitura das chaves pelo `evaluateAll` também se repete igual nos dois arquivos e poderia virar a mesma função de apoio.
- O título do caso em `agentes.spec.ts:186` ainda diz "três funções", e são quatro. Esse item já está na tabela "Recomendações sem aplicar", com destino na retro.
