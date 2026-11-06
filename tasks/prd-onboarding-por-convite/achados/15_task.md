# Achados das revisões — `tasks/prd-onboarding-por-convite/15_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-06 01:56:26 · `tasks/prd-onboarding-por-convite/15_task.md`

VEREDITO: APROVADO
Tela vista: sim (8 fotos lidas: Professores e o painel "Importar professores", em 1366 e 360 px, escola cheia e vazia). Não vi a prévia com a marca nem a lista com o cadastrado "pendente", porque a vitrine não sobe arquivo. Esses dois passos eu conferi pelo código e pelo e2e.
Estados: ok. O carregando e o erro eu conferi só pelo código e pelo e2e, porque a vitrine não os mostra.
- **Painel sem arquivo:** o vazio diz o próximo passo ("Baixe o modelo, preencha uma linha por professor… e escolha o arquivo para ver a prévia") e oferece "Baixar modelo".
- **Prévia:** o carregando, o erro com "Tentar de novo" e o com dado estão no e2e `e2e/professores.spec.ts` (1347, 1378, 1453).
- **Lista de professores:** não mudou nos quatro estados. No vazio, o botão novo entra abaixo do `EmptyState` (`Professores.tsx`, trecho do `<>` do vazio), e o texto do vazio agora cita a planilha.
Acessibilidade:
- O painel é o `Sheet` já existente, com foco preso, Esc e foco devolvido (`focoDeReserva`).
- Os campos têm rótulo, e o botão de fechar tem `aria-label="Fechar"`.
- O e2e roda o axe nos estados do painel e confere alvos de 24 px (marcas, "Baixar modelo", "Trocar arquivo") e de 44 px (gravar, "Importar professores").
Chromebook fraco: sem peso novo. Reaproveita a `ImportarPlanilha` da 13.0. Em 1366 × 768 nenhuma tela rola (a linha "Rolam" veio vazia), e o e2e chama `paginaNaoRola` no `chromebook`. O teto de 300 linhas está no texto do painel.
Celular:
- A 360 px não há rolagem horizontal nem texto cortado.
- Os botões "Importar professores" e "Cadastrar professor" ficam empilhados, com cerca de 44 px de altura.
- A lista vira cartões e o painel abre como folha de baixo.
- Não há hover nem atalho, e o fluxo não exige celular.
- Na foto de 360 px, a barra de baixo aparece no meio da página. É efeito da captura da página inteira com a barra fixa, e não defeito.
Ação oficial protegida: sim.
- Desligar professor é marca desmarcada por padrão. O "Marcar todos para desligar" também chega desmarcado.
- A marca mostra o nome do professor, e o resumo logo acima de "Gravar professores" diz o efeito ("1 professor será desligado e perde o acesso").
- Quem não aparece na planilha continua na escola.
- A gravação não mostra link. O texto do resultado manda abrir o professor e usar "Refazer convite".
- A tela não mostra e-mail na marca, o que cumpre o E11.
- "Cadastrar professor" segue como a única ação cheia da tela. Importar é secundário, e "Gravar professores" é a única ação cheia dentro do painel.
Bloqueantes: nenhum.
- Nada de termo técnico ou texto em inglês na tela. "CSV" e ".xlsx" são nomes de arquivo que o usuário reconhece.
- A pele segue `docs/interface.md`: usa `SECONDARY_BUTTON_CLASSES`, `Sheet`, `Button` e `EmptyState` existentes. Nenhum componente foi refeito.
Recomendações:
- A vitrine não mostra o botão "Importar professores" no estado vazio (`Professores.tsx`, ramo do `EmptyState`), porque a escola "vazia" da vitrine tem 1 professor. O e2e cobre esse caso. Vale conferir na validação que o botão fica bem alinhado ao lado do "Cadastrar professor" do `EmptyState`. Hoje ele fica numa `<div>` abaixo do estado vazio.
- A instrução do painel é um parágrafo longo (5 linhas a 360 px). Dá para quebrar em dois ou três itens, ou encurtar. Gosto, não defeito.
- O cabeçalho do celular trunca o nome da escola ("Colégio s…"). É da moldura, anterior a esta tarefa.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-06 01:56:47 · `tasks/prd-onboarding-por-convite/15_task.md`

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
- Para ter o link de cada professor cadastrado pela planilha, a coordenação precisa fazer um `convite/refazer` por pessoa. Com 300 professores, são 300 pedidos feitos à mão, um a um. Isso não pesa na carga das 10h, mas vale registrar como insumo para o envio em lote da F2c. A F2c precisa enviar pela fila de lote com limite por escola, e não pela tela.

A tarefa só mexe na interface. Nada muda em `apps/api`, `packages`, `infra`, migration ou worker. Nas partes que pesam na carga, a tarefa usa o que já existia:
- O envio da planilha, a prévia e o gravar usam os caminhos que a 13.0 e a 6.0 já tinham, por `rotasDaPlanilha('professores')`.
- A proteção contra clique duplo no gravar vem do `ImportarPlanilha` da 13.0, sem mudança.
- Depois de gravar, a tela relê a lista uma única vez, pelo `recarregarAEstrutura`. Não há leitura repetida nova.
- O endereço só leva a palavra `?painel=importar`, e nada fica guardado na memória do servidor.
- Nenhum teste chama provedor pago.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/web/src/areas/coordenacao/professores/Professores.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/web/src/areas/coordenacao/professores/PainelDaImportacaoDeProfessores.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/web/src/areas/coordenacao/professores/importar-professores.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/web/src/areas/coordenacao/professores/professores-da-escola.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-06 01:56:55 · `tasks/prd-onboarding-por-convite/15_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A tarefa só mexe na web (a importação de professores, as marcas e o painel) e não toca `Nota`, correção, API nem `core`. Todos com autor humano? Não se aplica.
Decisão autônoma sobre aluno: ausente. A única ação com consequência é desligar professor, e ela é uma escolha humana:
- A marca chega desmarcada, e o "Marcar todos para desligar" também (`apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx`, `MarcasDaPrevia`/`GrupoDeMarca`).
- A tela diz que é "conferência feita a partir da planilha, não um resultado automático".
- Antes de gravar, a tela mostra o que a marca vai fazer ("1 professor será desligado e perde o acesso").
- Gravar sem marca não desliga ninguém. O e2e prova isso: `e2e/professores.spec.ts`, "RF4 e regra 70 (15.0)", nos casos "a marca chega desmarcada…" e "só sai quem a coordenação marcou".

Quem pode ser marcado sai só de quem não aparece na planilha e está `ativo` ou `aceito` (`packages/core/src/importacao/tipos/professores.ts:100`). Nenhuma métrica de professor entra nessa conta, então o item 8 da regra 70 (D45) é respeitado.
Aprovação registrada: não se aplica. A tarefa não tem saída de IA.
Supervisão do tutor: não se aplica, a tarefa não toca o tutor.
Autonomia declarada e visível: não se aplica. Nenhum agente foi tocado.

Fotos lidas: as oito, no computador e no celular, com a escola cheia e a vazia. Nenhuma mostra saída de IA, nota, conceito, sugestão de nota ou indicador de professor. A marca de desligar aparece rotulada só com o nome (`apps/web/src/areas/coordenacao/professores/importar-professores.ts:9-10`, que vem do `rotulo` de `professores.ts:170`). Nada nas fotos induz uso ou dificulta sair: o painel fecha pelo "X", e "Importar professores" é um botão secundário.

Bloqueantes: nenhum.

Recomendações:
- O texto de `DESLIGAR_PROFESSOR` (`apps/web/src/areas/coordenacao/professores/importar-professores.ts:24-29`) poderia dizer que a lista sai só da comparação com a planilha, e não de uso nem de desempenho. Isso deixa explícito na tela o que a regra 70, item 9 (D64) exige, para a coordenação não ler a lista como "quem não usa".
- Fora da minha regra, fica para o `frontend-reviewer`: em `.processo/vitrine/coordenacao--coordenacao-professores--Importar-professores--celular.png`, o painel termina no meio da tela e o cartão de um professor da lista aparece logo abaixo dele.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/web/src/areas/coordenacao/professores/PainelDaImportacaoDeProfessores.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/web/src/areas/coordenacao/professores/importar-professores.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/web/src/areas/coordenacao/professores/Professores.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/e2e/professores.spec.ts`

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-06 01:57:07 · `tasks/prd-onboarding-por-convite/15_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nome e e-mail do professor. Os dois entram pela planilha que a coordenação sobe e só passam pela tela; nenhum é gravado de novo. A marca de desligar mostra só o nome do candidato (o `rotulo` que a API já devolvia). A tarefa só mexe na web: nenhuma migration, repository ou rota da API mudou.

Fora da tabela de dados do docs/lgpd.md: nenhum. Os dados da planilha de professores já estão no mapa desde a 6.0, em `docs/lgpd.md`:
- linha 65: e-mail de login na conta global;
- linha 73: planilha em gravação, `importacao_planilha.linhas` e `marcas`, com finalidade e retenção.

Nada de aluno entra neste fluxo.

Autorização por objeto: ok. Não há rota nova. A tela chama `rotasDaPlanilha('professores')`, que é da 6.0. Ela não manda `anoLetivoId`, `turmaId` nem `escolaId`, então o escopo continua vindo do token. O parâmetro `?painel=importar` só aceita esse valor (`apps/web/src/areas/coordenacao/professores/professores-da-escola.ts:75`). Se o endereço pede a planilha e um professor ao mesmo tempo, abre só a planilha (`Professores.tsx:134`).

Logs: limpos. Não há `console.*` nem `localStorage`/`sessionStorage` nos arquivos da tarefa. O e2e confirma que nome e e-mail não ficam no armazenamento do navegador nem no endereço (`e2e/professores.spec.ts`, caso do caminho feliz). Também confirma que a coordenadora seguinte na mesma aba não vê a prévia nem os nomes da anterior.

Auditoria: presente. A única ação sensível aqui é desligar professor pela marca, que altera permissão. Ela passa pela gravação da 6.0, com a auditoria `planilha.gravada`. Pela tela, a marca chega desmarcada e o "Marcar todos para desligar" também. O e2e prova que gravar sem marca não desliga ninguém. Fora isso, a tarefa não cria nenhuma ação que a regra 20, item 10 mande auditar.

Envio externo: nenhum. Não há IA nem terceiro no fluxo. O arquivo não sai do navegador: só o texto vai para a API da própria escola.

Seed/fixture: sintético. Os nomes levam sufixo de UUID ("Nina Nova <uuid>", "Helena", "Igor"...) e os e-mails são `@educa.invalid` (`e2e/professores.spec.ts:215`). As fotos mostram só "Professor(a) Sintético(a) …" e "Colégio sintético da vitrine".

O que conferi nas fotos:
- Em `coordenacao--coordenacao-professores--computador.png` e `--celular.png`, a lista mostra nome, disciplina, turma e situação, sem e-mail.
- Nas quatro fotos do painel "Importar professores" (escola cheia e vazia), aparecem a instrução, "Escolher arquivo", "Baixar modelo" e o vazio, sem nenhum dado de pessoa.
- Não há foto da prévia com a marca. Quem prova que ela não tem e-mail é o e2e, no caso "a marca chega desmarcada e rotulada só com o nome", que verifica `page.content()` sem o e-mail de nenhum dos quatro professores.

Pergunta de fechamento: a tarefa não muda o que o sistema guarda sobre ninguém nem para onde isso vai, então a resposta da 6.0 continua valendo (arquivo do titular e mapa de dados).

Bloqueantes: nenhum.

Recomendações:
1. O docblock em `apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx:540` ainda diz "cada candidato com o nome e a matrícula que a escola já tem". Desde esta tarefa, a mesma peça mostra o candidato professor só com o nome. Vale dizer "o rótulo que a API devolve: nome e matrícula (aluno) ou só o nome (professor)", para ninguém acrescentar a matrícula ou o e-mail ao professor achando que falta.
2. Na foto `coordenacao--coordenacao-professores--Importar-professores--celular.png`, um cartão da lista ("Professora Sintética Marta") aparece abaixo do painel. Parece efeito da captura da página inteira, e o dado ali é a lista que a coordenação já vê, então não é vazamento. Fica para o `frontend-reviewer` confirmar se é só da foto.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/web/src/areas/coordenacao/professores/PainelDaImportacaoDeProfessores.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/web/src/areas/coordenacao/professores/importar-professores.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/web/src/areas/coordenacao/professores/Professores.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/web/src/areas/coordenacao/professores/professores-da-escola.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/e2e/professores.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/docs/lgpd.md

## revisor-geral · 1ª rodada · APROVADO · 2026-11-06 01:57:29 · `tasks/prd-onboarding-por-convite/15_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

As quatro subtarefas estão feitas, e "Enviar convites" (F2c) não foi tocado. A tarefa tem uma divergência: a marca de desligar mostra só o nome do professor, sem e-mail. Ela já está na `techspec.md` §9 (commit c48b35d1), e nenhum id do `cenarios.md` fala do rótulo da marca. Por isso não é divergência silenciosa.

Os textos da tela batem com o que a API devolve, conferido em `packages/core/src/importacao/tipos/professores.ts`:
- Todo código de erro de linha tem frase com o que fazer.
- O aviso `email_repetido` tem frase própria.
- O resumo usa as chaves `entram`, `ja_existem` e `desligados`.

As fotos mostram o que a tarefa pede: "Importar professores" como botão secundário ao lado de "Cadastrar professor", que segue a única ação cheia da tela. O painel abre ao lado, ou embaixo no celular, com a instrução (até 300 linhas, o link depois) e o vazio com "Baixar modelo". Nada aparece fora do pedido.

Recomendações:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx:540`: o comentário de `MarcasDaPrevia` ainda diz "cada candidato com o nome e a matrícula". Na planilha de professores o rótulo é só o nome. O comentário deveria dizer que o rótulo é o que a API manda: nome e matrícula no aluno, só o nome no professor. A autoconferência (item 7) diz que os comentários foram conferidos, e este escapou.
2. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/web/src/areas/coordenacao/professores/Professores.tsx:201` e `:217`: o botão é um `<button>` cru com `SECONDARY_BUTTON_CLASSES`, ao lado de um `<Button>` na mesma linha. O projeto já faz isso em outras telas (`GradeECalendario`, `Estrutura`), mas o componente `Button` com a variante secundária seria o jeito único. Fica para a retro, se valer padronizar.
3. Na foto da escola vazia no celular (`vazia--coordenacao--coordenacao-professores--celular.png`) aparece um professor ativo, e não o vazio "Nenhum professor ainda". O vazio com "Importar professores" fica provado só pelo teste de unidade (`Professores.test.tsx › o vazio também convida a importar`) e pelo e2e. Vale conferir se a escola vazia da vitrine é vazia mesmo nesta aba. Isso é da ferramenta de foto, não desta tarefa.

## test-engineer · 1ª rodada · APROVADO · 2026-11-06 01:57:57 · `tasks/prd-onboarding-por-convite/15_task.md`

VEREDITO: APROVADO

Cenários exigidos:
- **Caminho feliz:** subir a planilha, ver a prévia, gravar, e o cadastrado aparece `pendente` sem recarregar a página.
- **Bordas:**
  - o mesmo e-mail repetido com caixa diferente;
  - a linha com erro (e-mail inválido, nome vazio);
  - o professor que já está na escola e vem na planilha;
  - os ausentes em quatro estados (ativo, aceito, pendente e o que a planilha traz);
  - a resposta atrasada da prévia;
  - o mesmo arquivo escolhido de novo;
  - a lista que cai depois de gravar;
  - a prévia que falha, com "Tentar de novo".
- **Regra 70:** a marca chega desmarcada; sem marca ninguém sai; só sai quem foi marcado.
- **Privacidade:** o rótulo leva só o nome; nenhum e-mail fica na página, no armazenamento do navegador ou no endereço.
- **Concorrência:** clique duplo no gravar.
- **Permissão e isolamento:** a outra pessoa na mesma aba não vê nada da anterior. O professor que sobe a planilha e a marca de outra escola são da 6.0, porque esta tarefa só toca a web.

Cobertos:
- **Cada linha da tabela de testes tem o seu caso, citado pelo nome.** Os 9 casos e2e novos estão em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/e2e/professores.spec.ts:1197-1540`.
  - O carregando é provado com a prévia segurada por `gate()`.
  - O vazio é provado com "Baixar modelo", conferindo que o arquivo baixado é `modelo-professores.csv`.
  - O erro é provado com "Tentar de novo".
  - Os 360 px, o `paginaNaoRola`, os alvos de 44 e 24 px, o axe e "uma ação cheia" estão todos lá.
- **A rodada do portão passou.** Os 9 casos e2e passaram nos projetos `chromebook` e `celular` (`.processo/e2e-duracao.json`). O mais lento levou 7,7 s, abaixo da metade do prazo de 30 s.
- **Unidade verde.** Rodei agora os testes de `professores/` e `importacao/`: 182 de 182 passaram.
- **Mutações:**
  - Os 19 blocos cobrem cada condição e cada `??` novos, os dois botões, o painel, o `aoConcluir`, o `aoFechar` e o `?painel=importar`.
  - O portão os aplicou (`portao.json`, total 19).
  - O `--faltando` dá 0.
  - O seed de quatro estados torna o filtro de candidatos da API observável: o grupo precisa ter exatamente 2.
- **As asserções são sobre o resultado:** a lista por trás `pendente`, o `convitesDeProfessorEmAberto` no banco, o caminho do `POST .../convite/refazer`, o link copiado igual ao mostrado e as chaves do corpo (sem ano nem turma).
- **Concorrência de verdade:** o clique duplo (`dblclick`) gera um único POST de gravar.
- **Sem `.skip`, sem teste comentado, sem IA. Os mocks são só de rede, de fora:** o `fakeNetwork` nos testes de unidade e o `page.route` no e2e.

Bloqueantes: nenhum.

Recomendações:
1. **A Autoconferência descreve um bloco que não existe.** O item 1 de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/15_task.md` diz que há bloco para "o efeito do foco". O efeito, porém, só ganhou comentário, e o código novo do foco é a prop `focoDeReserva={focarNaLista}` (`Professores.tsx:257`), que não tem bloco. Pelo `Sheet` e pelo efeito preso a `painelAberto`, o caso "pelo endereço, abre já com o painel, e fechado o foco vai ao título da lista" deve ficar vermelho com `focoDeReserva={() => undefined}`. Vale declarar esse bloco e corrigir o texto do item 1.
2. **Dois professores ausentes com o mesmo nome ficam indistinguíveis na marca.** Com o rótulo só com o nome (decisão do Arquiteto, opção b, por E11), a coordenação não tem como saber qual dos dois desliga. Nenhum teste nem texto da tela trata esse caso. Não é desta tarefa, que só toca a web e segue a spec, mas deve ir à validação e ao Arquiteto, por exemplo com um diferenciador que não seja e-mail, como o estado ou a data do convite.
3. **O caso "o erro e o aviso saem em frase…" termina com uma ação sem asserção.** É o `activate(… 'Trocar arquivo')` no fim do caso, perto da linha 1478 do spec. Ou ele ganha a asserção do que deve acontecer (a escolha volta, sem prévia), ou sai.
4. **O teste antigo "chegam todas desmarcadas" foi reordenado.** As asserções foram trocadas de lugar só para que a linha `falha:` do bloco seja a primeira a quebrar. O comportamento provado é o mesmo; fica o registro de que a mudança é só de ordem.

## frontend-reviewer · 2ª rodada · APROVADO · 2026-11-06 02:08:43 · `tasks/prd-onboarding-por-convite/15_task.md`

VEREDITO: APROVADO
Tela vista: sim (8 fotos lidas: lista e painel "Importar professores", no computador e no celular, na escola cheia e na vazia). A prévia com a marca de desligar e a lista com "pendente" não têm foto. Elas só existem no e2e, por isso as li pelo diff e pelo código.
Estados: ok. Os quatro estados não mudaram desde a 1ª rodada. Na foto aparecem o painel sem arquivo, que convida ("Baixe o modelo, preencha uma linha por professor… e escolha o arquivo para ver a prévia") e não se desculpa, a lista com dado e a lista com 1 professor. Carregando e erro vêm do código e do e2e. O e2e ganhou um passo que confere a saída do erro: "Trocar arquivo", planilha certa, "Gravar professores" visível, erro e aviso somem e nada é gravado.
Acessibilidade: ok. Os diálogos têm título, o "Escolher arquivo" é um botão com rótulo e as regiões têm nome ("Linhas com erro (2)"). O e2e passa `seriousViolations` com resultado vazio nos casos de erro e aviso.
Chromebook fraco: sem mudança desde a 1ª rodada. O limite é de 300 linhas e a prévia sai de uma planilha pequena, então não há lista longa que precise de virtualização.
Celular: ok a 360 px. Não vejo rolagem horizontal nem texto cortado, e os botões "Escolher arquivo", "Baixar modelo", "Importar professores" e "Cadastrar professor" ficam com altura de toque confortável. O painel abre como folha de baixo. Na foto cheia, a lista aparece abaixo da folha porque a captura é da página inteira. Isso é artefato da foto: o código fixa a folha, e a foto vazia confirma. Nenhum fluxo exige o celular.
Ação oficial protegida: sim. Desligar professor é opt-in. As marcas chegam desmarcadas e o "Marcar todos para desligar" também. O texto novo diz que a lista vem só da comparação com a planilha, "e não do uso nem do desempenho de ninguém", o que cobre o D64 e o D45. O rótulo mostra só o nome, sem e-mail (E11). O docblock de `MarcasDaPrevia` ficou coerente com isso.
Bloqueantes: nenhum. A correção exigida na 1ª rodada era nenhuma, e o diff desta rodada só mexe em docblock, texto explicativo e um passo a mais no e2e.
Recomendações:
- Se a prévia com a marca ganhar um jeito de ser fotografada (o comando de foto ainda não sobe arquivo), conferir a quebra do texto longo de `DESLIGAR_PROFESSOR` a 360 px. Em `apps/web/src/areas/coordenacao/professores/importar-professores.ts` a explicação ficou com quatro frases e vai ocupar umas 8 linhas no celular. Isso não bloqueia.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-06 02:09:02 · `tasks/prd-onboarding-por-convite/15_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum

Conferi o diff `f7922e4a..ac164200` contra a ordem `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/.processo/ordens/15_task-r1.md`. Os quatro itens foram aplicados:

1. **Comentário de `MarcasDaPrevia`** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx:539-543`): agora diz que o rótulo é o que a API devolve. No aluno são nome e matrícula, no professor só o nome (E11). Também diz que quem usa a peça não deve acrescentar matrícula nem e-mail. Feito.
2. **Texto de `DESLIGAR_PROFESSOR`** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/web/src/areas/coordenacao/professores/importar-professores.ts:27`): ganhou a frase "Esta lista sai só da comparação com a planilha…", que atende à regra 70, item 9 (D64). Nenhum teste em `e2e/` ou `apps/web/src` citava o texto antigo inteiro, então nada quebrou. O texto paralelo do aluno, em `previa-da-planilha.ts:165`, não mudou, o que está certo: a ordem só pedia o do professor.
3. **Autoconferência e bloco de mutação** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/15_task.md`): o item 1 agora cita o `focoDeReserva` do painel. Entrou um bloco novo trocando a prop por `() => undefined`, ligado ao caso "pelo endereço, abre já com o painel, e fechado o foco vai ao título da lista". A contagem passou para 20 blocos. A tabela "Recomendações sem aplicar" é a cópia da tabela "Sem aplicar" da ordem.
4. **Teste e2e que terminava num clique** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/e2e/professores.spec.ts:1438-1445`): o caso não termina mais num clique sem conferência. Agora espera a janela de escolha de arquivo, envia uma planilha certa e confere quatro coisas:
   - o botão "Gravar professores" aparece, e ele não existia enquanto havia erro, então a conferência distingue os dois estados;
   - a região "Linhas com erro (2)" some, e esse nome bate com `ImportarPlanilha.tsx:449`;
   - a região "Linhas com aviso (1)" some, e esse nome bate com `ImportarPlanilha.tsx:450`;
   - `gravacoes` continua vazio.

Não li as fotos da tela nesta rodada. O diff de código só mexe num comentário e numa frase da marca de desligar, e essa frase não aparece em nenhuma das fotos.

Recomendações:
- Para a validação: a frase nova de `DESLIGAR_PROFESSOR` só aparece na prévia com a marca, que nenhuma foto mostra e que só o e2e alcança. Vale conferir na tela a 360 px que o parágrafo, agora com três frases, continua legível.

## test-engineer · 2ª rodada · APROVADO · 2026-11-06 02:09:13 · `tasks/prd-onboarding-por-convite/15_task.md`

VEREDITO: APROVADO

Nesta 2ª rodada auditei o diff `f7922e4a..ac164200` e conferi cada uma das quatro ordens de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/.processo/ordens/15_task-r1.md`. O que não mudou desde a 1ª rodada não foi reauditado.

Cenários exigidos (os quatro itens da ordem da 1ª rodada):
1. O comentário de `MarcasDaPrevia` em `ImportarPlanilha.tsx` não pode mais dizer "nome e matrícula" para todo candidato.
2. A frase do `DESLIGAR_PROFESSOR` precisa dizer que a lista sai só da comparação com a planilha (D64, regra 70 item 9).
3. O `focoDeReserva` do painel precisa de um bloco de mutação, e o item 1 da Autoconferência precisa ser corrigido.
4. O caso de e2e "o erro e o aviso saem em frase…" não pode terminar num clique sem asserção.

Cobertos:
1. Feito. O comentário agora diz que o rótulo é o que a API devolve: nome e matrícula no aluno, só o nome no professor (E11). Nenhum código mudou.
2. Feito, em `importar-professores.ts:27`. O teste que já existia continua valendo para o texto novo: `importar-professores.test.ts:30` confere que a frase não fala de aluno nem de e-mail, e "uso" e "desempenho" não esbarram nisso. Nenhum spec de e2e cita a frase antiga, e o `ImportarPlanilha.test.tsx:612` usa um texto próprio.
3. Feito. O bloco declarado reproduz exatamente a linha `Professores.tsx:257`. O teste citado (`Professores.test.tsx:640`) confere o foco no título com `expect(document.activeElement).toBe(titulo)` depois do clique em "Fechar". Com `() => undefined` o foco não volta ao título, então o vermelho vem pelo motivo certo. O item 1 da Autoconferência agora cita o `focoDeReserva`. O portão provou a mutação, e eu não mexi em arquivo nenhum.
4. Feito, em `e2e/professores.spec.ts:1438-1445`. O caso agora espera o seletor de arquivo abrir, envia uma planilha certa e confere quatro coisas:
   - "Gravar professores" aparece.
   - A região "Linhas com erro (2)" some. Ela foi vista na linha 1423 do mesmo caso, então a asserção não é vazia.
   - A região "Linhas com aviso (1)" some.
   - Nada foi gravado: `gravacoes` continua vazio.

   Se a prévia anterior continuasse na tela, o caso falharia.

Unidade: `npx vitest run apps/web/src/areas/coordenacao/professores apps/web/src/areas/coordenacao/importacao` deu 12 arquivos e 182 testes verdes. O diff não acrescenta `.skip`, teste comentado nem mock que esconda a regra.

Bloqueantes: nenhum.

Recomendações:
- Nenhum teste prova a frase nova do `DESLIGAR_PROFESSOR` ("Esta lista sai só da comparação com a planilha, e não do uso nem do desempenho de ninguém."). Se alguém apagar a frase, nada fica vermelho. Vale uma asserção em `apps/web/src/areas/coordenacao/professores/importar-professores.test.ts`, no caso "a marca de desligar diz professor…", algo como `expect(grupo?.explicacao).toMatch(/comparação com a planilha/)`. Ela guardaria na tela o que a D64 exige. Não bloqueia, porque o texto não tem condição e veio de uma recomendação.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-06 02:09:27 · `tasks/prd-onboarding-por-convite/15_task.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum. A 1ª rodada não deixou correção exigida. O diff de `f7922e4a` a `ac164200` mexe só no frontend: o comentário de documentação de `MarcasDaPrevia`, um texto da interface em `DESLIGAR_PROFESSOR.explicacao` e um e2e. Ele não toca rota, query, job, migration nem chamada de IA, e nenhum teste chama provedor pago. O caso novo do e2e verifica que nada foi gravado (`expect(gravacoes).toHaveLength(0)`) depois do "Trocar arquivo".
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/e2e/professores.spec.ts:1443-1444`: as asserções de que o erro e o aviso sumiram usam o nome com a contagem antiga (`'Linhas com erro (2)'`, `'Linhas com aviso (1)'`). Se ainda sobrasse uma região com outra contagem, o teste passaria assim mesmo. Sugiro trocar por `{ name: /^Linhas com erro/ }` e `{ name: /^Linhas com aviso/ }` com `toHaveCount(0)`.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-06 02:09:28 · `tasks/prd-onboarding-por-convite/15_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo. As mudanças desde a 1ª rodada são texto de tela, um comentário e um teste. O rótulo da marca do professor continua só com o nome: o e-mail não sai da API (E11), e o comentário de `MarcasDaPrevia` agora diz isso. Ele fica em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx:539-543`.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok. Esta rodada não mexeu em rota nem em API; o painel continua usando a importação da 6.0.

Logs: limpos. O diff não tem nenhum log novo.

Auditoria: presente. Esta rodada não cria nenhuma ação que exija auditoria. O texto novo da tela não muda o caminho da gravação.

Envio externo: nenhum.

Seed/fixture: sintético. O caso novo do e2e (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/e2e/professores.spec.ts:1438-1445`) sobe uma planilha `Dara ${marca};${emailSintetico('dara')}`, com domínio `@educa.invalid` (linha 215). O caso termina conferindo `gravacoes` com tamanho 0, ou seja, que nada foi gravado.

Correções exigidas na 1ª rodada: nenhuma, porque não houve bloqueante. As duas recomendações que eram minhas ou tocavam a minha regra foram aplicadas:
- **O comentário do rótulo** passou a dizer "só o nome no professor (o e-mail dele não sai da API, E11)". Também avisa que quem usa a peça não deve acrescentar matrícula nem e-mail.
- **O texto de `DESLIGAR_PROFESSOR`** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/web/src/areas/coordenacao/professores/importar-professores.ts:27`) agora diz que a lista sai só da comparação com a planilha, e não do uso nem do desempenho de ninguém. Isso deixa claro na tela que a lista não é um indicador de "quem não usa" (regra 70, item 9, D64). A frase não traz dado pessoal.

Fotos da tela: as oito fotos de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/.processo/vitrine/`, nas escolas cheia e vazia, no computador e no celular, com e sem o painel aberto.
- **Lista:** mostra só nome, disciplina, turma e situação, e nenhum e-mail de professor.
- **Painel sem arquivo:** mostra instrução e ações, sem nenhum dado de pessoa.
- **Dados das fotos:** todos sintéticos ("Professora Sintética Rosa b23ed87b", "Colégio sintético da vitrine…").
- **Sem foto:** o texto novo de `DESLIGAR_PROFESSOR` só aparece depois de subir um arquivo, então nenhuma foto o mostra; ele só é coberto pelo e2e.

Bloqueantes: nenhum.

Recomendações: nenhuma nova. As da 1ª rodada que não foram aplicadas já têm destino na tabela "Recomendações sem aplicar" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/15_task.md`.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-06 02:09:36 · `tasks/prd-onboarding-por-convite/15_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. A 15.0 importa professores por planilha e não chega a `Nota`, nem o diff desta rodada. Todos com autor humano? Não se aplica, porque nada grava nota.

Decisão autônoma sobre aluno: ausente. A marca de desligar é sobre professor. Cada candidato chega desmarcado, inclusive no "marcar todos", e só a coordenação decide (docblock em `ImportarPlanilha.tsx:539-543`).

Aprovação registrada: ok. Não há saída de IA neste fluxo.

Supervisão do tutor: ok. O tutor não é tocado.

Autonomia declarada e visível: sim. Nenhum agente foi alterado.

**A correção recomendada na 1ª rodada (regra 70, item 9; D64) foi feita.** `DESLIGAR_PROFESSOR.explicacao` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/web/src/areas/coordenacao/professores/importar-professores.ts:27`) agora diz: "Esta lista sai só da comparação com a planilha, e não do uso nem do desempenho de ninguém." A frase fica entre "...encerrados." e "Quem você não marcar continua na escola...". Ela diz à coordenação que a lista de ausentes não é indicador de adoção nem métrica sobre o professor (regra 70, itens 8 e 9).

**O resto do diff:**
- **`ImportarPlanilha.tsx`:** mudou só o comentário. Ele agora diz que o rótulo do professor é só o nome, sem e-mail (E11). Nada muda na tela.
- **`e2e/professores.spec.ts:1438-1445`:** depois de "Trocar arquivo" e de uma planilha certa, o teste confere que nada foi gravado (`gravacoes` com tamanho 0) e que "Gravar professores" aparece. Nada é gravado sem a ação da coordenação.

**Fotos:**
- **Escola cheia e vazia, no computador e no celular:** só lista de professores e o painel "Importar professores" ainda sem arquivo.
- **Pela regra 70, nada a apontar:** não há saída de IA, nota ou conceito. Não há ranking, uso ou métrica de professor; a coluna "Situação" mostra só "Ativo". Fechar o painel (o X) é imediato, sem nada que induza uso (D59).
- **O que não deu para ver:** a prévia com a marca, onde a frase nova aparece, não tem foto. Por isso a conferi no código e não na tela.

Bloqueantes: nenhum.

Recomendações:
- A frase nova não tem teste que a guarde: apagá-la não deixa nada vermelho. Vale acrescentar ao caso "a marca de desligar diz professor..." uma asserção como `expect(grupo?.explicacao).toMatch(/não do uso nem do desempenho/)`, junto da asserção de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/web/src/areas/coordenacao/professores/importar-professores.test.ts:34`. Ela também pode ser citada no e2e que abre a prévia com a marca. Assim o texto que responde à D64 fica protegido.
