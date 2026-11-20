# Achados das revisões — `tasks/prd-classificacao-bncc/12_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-20 06:15:22 · `tasks/prd-classificacao-bncc/12_task.md`

VEREDITO: APROVADO

A tarefa 12.0 só muda texto em quatro leituras que já existiam: Turmas (Hoje e Alunos), o resultado da atividade do aluno, o Analista e o dado nominal. Também traz um teste de integração e um e2e. Não cria rota, campo, migration, log nem envio externo.

Campos pessoais tocados: nenhum novo. As leituras mostram o mesmo de antes: a habilidade e o "N de M" de correção aprovada, e o nome do aluno só na aba Alunos, que é do professor da turma. A única coisa nova é uma frase fixa ("Esta questão não tem habilidade da BNCC associada."), em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/components/habilidades/sem-habilidade.ts`.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok. Nenhuma rota nova nem rota com contrato alterado. `analista.command.ts` não mudou, e o novo caso em `analista.int.test.ts` só prova três coisas: a linha `habilidade: null` fica separada, não se soma a H0 e não gera alerta. O recomeço no e2e (`e2e/classificacao-bncc.spec.ts`, último caso) confere primeiro que o cache da aba guardava a habilidade da turma anterior. Depois da troca de professora, nem o nome da turma nem as habilidades dela aparecem na tela ou no cache.

Logs: limpos. O diff não tem nenhuma chamada de log.

Auditoria: presente onde a regra exige. O dado nominal da turma no Analista continua abrindo com finalidade registrada; o diff só troca o `detalhe` da barra em `DadoNominal.tsx:187` e não mexe no caminho de abertura. Nenhuma ação nova pede auditoria.

Envio externo: nenhum. A geração do e2e roda com o adaptador falso, e o texto do material vem da fixture `PAGINAS_DE_ESTEQUIOMETRIA`, que é conteúdo didático sintético.

Seed/fixture: sintético.
- Alunos "Ana/Bruno/Carla Sintética", com matrícula derivada de `Date.now`.
- Escola, professora e coordenadora criadas pelos helpers de `e2e/support/seed.ts`.
- O campo `textos` adicionado em `e2e/support/material.ts:62` recebe só a fixture sintética.

Fotos da tela: nas 14 fotos (cheia e vazia, computador e celular), cada papel vê só o que a regra 20 permite.
- **Hoje:** só agregado.
- **Alunos:** o nome do aluno da própria turma, sem matrícula nem conteúdo de resposta.
- **Eu:** a turma, a série e a escola do próprio aluno, e as habilidades a rever. Nenhum colega aparece.
- **Analista:** só agregado; o nominal fica atrás do botão com finalidade.

A vitrine não tem questão sem habilidade, então o "Sem habilidade" foi julgado pelo código e pelos testes de tela, como avisado. A Eu não ganhar a linha `null` (D66) está coberta por `Eu.test.tsx`. O caso da aluna no e2e confere que o nome dos colegas não aparece em `/aluno/atividades/:id`.

Pergunta de fechamento: a tarefa não cria dado nem destino novo. O arquivo do titular e o registro em `ExecucaoAgente` continuam respondendo como antes.

Bloqueantes: nenhum.

Recomendações:
- **Matrícula no e2e:** em `e2e/classificacao-bncc.spec.ts`, no `beforeAll`, a matrícula é formada pelos 6 últimos dígitos de `Date.now()` mais o índice. Entre execuções paralelas ou repetidas, duas matrículas iguais seriam possíveis. Não vaza dado, mas um `randomUUID` reduzido seria mais seguro contra flake.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-20 06:15:24 · `tasks/prd-classificacao-bncc/12_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum novo. A tarefa só muda leitura e texto de tela. O e2e passa pelo caminho que já existia: a turma responde pela API e a professora encerra e aprova o lote (`ProfessoraApiClient.encerrarEAprovar`). O seed novo em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/e2e/support/material.ts:81` grava só o texto da página do material (`trecho`), não grava `Nota`. Todos com autor humano? sim.

Decisão autônoma sobre aluno: ausente.

Aprovação registrada: ok. Nenhum fluxo novo de saída de IA. As barras de "Sem habilidade" só aparecem com correção já aprovada (Hoje, Alunos, resultado da aluna, Analista).

Supervisão do tutor: ok. Nada mudou. A tela Eu não ganha linha nova sobre o aluno (D66, regra 70 item 4d). O caso novo em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/aluno/Eu.test.tsx:227` prova que a Eu não inventa linha nem código.

Autonomia declarada e visível: sim, sem mudança. Na foto `coordenacao--coordenacao-governanca--Analista--computador.png`, o cartão do Analista diz em português comum o que ele faz sozinho e traz o selo "IA". Na foto `professora--professor-turmas--Abrir-a-turma--computador.png`, o Tutor tem "O que o Tutor faz sozinho, e o que você vê aqui".

O que conferi item a item:
- **Item 7, supervisão não é vigilância.** O que entra é contagem de acerto em questão sem habilidade, que é dificuldade de aprendizagem. Não há inferência sobre comportamento nem dado novo coletado.
- **Item 8, nota em discursiva e redação (D46, D55).** Nenhum campo, texto ou prompt de nota. O e2e confere `VOCABULARIO_DE_NOTA` em toda tela e `PROIBIDO_NA_AREA_DO_ALUNO` na tela da aluna (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/e2e/classificacao-bncc.spec.ts:41`, `:241`).
- **Item 9, medir o professor.** `DadoNominal.tsx` só ganhou o texto da barra. A abertura com finalidade registrada na auditoria não mudou e aparece na foto do Analista. Não há ranking nem nada nominal novo.
- **Alerta do Analista.** No caminho de produção, a questão sem habilidade não vira alerta. A conferência da saída do modelo recusa alerta com `habilidade: null`, porque `medida` fica `undefined` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/ia/tasks/resumo-do-analista.ts:55-57`, vindo da tarefa 10.0). O teste novo em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/governanca/analista.int.test.ts:347` prova as duas linhas separadas e o alerta só para H0.
- **Fotos.** Nas telas cheia e vazia, no computador e no celular, nada regrediu do ponto de vista da regra 70. A saída de IA está marcada como IA, não há nota nem conceito na área do aluno, e o "Sair" está à vista. Nenhuma foto mostra o "Sem habilidade", como o aviso já dizia, então esse ponto julguei pelo código e pelos testes.

Bloqueantes: nenhum.

Recomendações:
- O texto fica no singular sobre barras que somam várias questões, e em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/professor/turmas/TurmaHoje.tsx:302` ele vira "Esta questão não tem habilidade da BNCC associada. 2 alunos acertaram menos da metade dessas questões…", que mistura singular e plural. Uma forma neutra, como "Questões sem habilidade da BNCC associada.", serviria nas quatro leituras. Isto é texto, fica para o `frontend-reviewer` e a retro.
- O teste de integração do Analista prova o alerta só com o adaptador falso (`resumoDoAnalista.falso`). No caminho real, quem barra o alerta da linha `null` é a conferência de `resumo-do-analista.ts:55-57`. Vale ter um caso de unidade que entregue a essa conferência um alerta com `habilidade: null` e exija a recusa, se ainda não existir na suíte da 10.0.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-20 06:15:41 · `tasks/prd-classificacao-bncc/12_task.md`

VEREDITO: APROVADO

Tela vista: sim (14 fotos lidas, em computador e celular, escola cheia e vazia). Nenhuma foto mostra o "Sem habilidade", como o aviso já dizia. Nas fotos, Turmas (Hoje e Alunos), Eu e Analista não regrediram. Não há rolagem horizontal nem texto cortado a 360 px. Na escola vazia, o vazio tracejado diz o próximo passo ("Nada corrigido ainda", "Nenhum resumo gerado ainda"). A barra de navegação aparece no meio das fotos de página inteira do celular, mas isso vem da captura e não é defeito. A linha `Rolam a 1366 × 768` diz "nenhuma", então não há conflito com nenhum RF de tela que cabe.

O "Sem habilidade" com a explicação eu julguei só pelo código, porque a vitrine não tem questão sem habilidade. Li o diff das quatro leituras e o cabeçalho e os casos do `e2e/classificacao-bncc.spec.ts`. Não rodei o e2e nem os testes de tela.

Estados: ok. A tarefa só lê dado que já vinha e não cria rota nem `queryKey`. Carregando, erro, vazio e com dado continuam os das telas de sempre. Os casos de tela em `Analista.test.tsx`, `TurmaHoje.test.tsx` e `AlunosDaTurma.test.tsx` cobrem o estado com dado, nas duas situações (com e sem a questão sem habilidade). O e2e espera "Carregando" sumir antes de medir (`telaLida`).

Acessibilidade: ok.
- A explicação é texto (`<p>` do `ProgressBar`), e a barra continua `aria-hidden` com o número escrito, então a cor não é o único sinal (`ProgressBar.tsx`).
- O e2e confere axe sério, ausência de rolagem lateral e o vocabulário de nota (`PROIBIDO_NA_AREA_DO_ALUNO`, `VOCABULARIO_DE_NOTA`) em todo caso, por `conferirATela`.
- Os casos de `activate` no projeto `celular` tocam a ação principal.
- Português correto, e o texto é uma frase curta sem jargão: "Esta questão não tem habilidade da BNCC associada."

Chromebook fraco: sem impacto. Não entrou lista nova nem imagem: a mudança é uma linha de texto, e a lista de alunos já era paginada de cem em cem. O e2e roda nos projetos com throttling, com 36 execuções em `--repeat-each 3`, e o mais lento levou 8,4 s.

Celular: ok. As fotos de 360 px não têm overflow nem texto quebrado. O texto novo é `break-words`. A nota abaixo da tabela de alunos é um `<p>` e não acrescenta alvo de toque. O e2e roda em `chromebook` e `celular`. Nenhum fluxo exige o celular.

Ação oficial protegida: sim. A tarefa não cria ação oficial: são só leituras. A troca de habilidade e a trava de aplicar vêm da 11.0 e não mudaram.

Pele e regras:
- Os componentes (`ProgressBar` e o `<p className="t-apoio text-sutil">`) são os que já existiam, sem token novo.
- Nenhuma barra fica vermelha, e não há ranking, nota ou percentual no aluno.
- Na Eu do aluno, a questão sem habilidade conta no "N de M certas" e não ganha linha em "Para rever". Isso preserva a D66, e a divergência está registrada na tarefa e na `techspec.md`.
- O "Sem habilidade" do aluno fica no resultado da atividade (`Atividade.tsx:323`).
- O Analista mostra a linha `null` separada, sem somá-la a uma habilidade e sem alerta por ela. O teste de integração em `apps/api/src/governanca/analista.int.test.ts` prova isso com duas linhas abaixo do limiar e um único alerta, o da habilidade com código.
- A IA continua rotulada: o cabeçalho "Analista de desempenho escolar" traz o selo "IA".
- O `docs/interface.md` e o roteiro da demonstração foram atualizados (o passo 6.4 agora diz as abas Hoje e Alunos).

Bloqueantes: nenhum.

Recomendações:
- O `docs/interface.md` diz que a barra "Sem habilidade" vem "depois das que têm código", no Turmas, no Analista e no dado nominal. A tarefa não implementa essa ordem no front. Ela depende da ordenação da API, e eu não conferi nem o `ORDER BY` nem o repositório. Convém conferir isso na 13.0, ou ordenar na tela, para o documento não prometer o que o código não garante.
- A mutação de `TurmaHoje.tsx` chamada "ramos do detalheDaHabilidade" tem dois blocos. Ambos exigem que o caso nomeado derrube o teste. Seria bom que a 13.0 confirmasse, por execução real, que cada mutação é pega.
- Na tela Alunos a 360 px, a coluna "Por habilidade" mostra "Sem habilidade: 1 de 2" em texto corrido, separado por "·". Se a linha ficar longa, pensar em uma habilidade por linha. Isso não bloqueia: hoje quebra bem, como na foto.

Arquivos relevantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/components/habilidades/sem-habilidade.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/professor/turmas/TurmaHoje.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/professor/turmas/AlunosDaTurma.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/aluno/Atividade.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/coordenacao/governanca/Analista.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/coordenacao/governanca/DadoNominal.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/e2e/classificacao-bncc.spec.ts`

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-20 06:15:47 · `tasks/prd-classificacao-bncc/12_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela, coluna nem migration nova. O teste novo `e2e/support/material.ts` só passa a escrever `texto` em `trecho`, uma tabela que já existe, e grava `escola_id` vindo do `escolaId` da cena.

Queries verificadas: nenhuma query, repository ou endpoint de produção mudou. `apps/api/src/governanca/analista.command.ts` e `AnalistaRepository` estão iguais. O diff de `apps/web` não traz `fetch`, `queryKey` ou `useQuery` novos, nem lê `escolaId`. As leituras direto no banco em `e2e/classificacao-bncc.spec.ts`, nas linhas 93 e 293, filtram por `escola_id` além do id. As chamadas à API no spec, nas linhas 229, 272 e 279, não mandam `escolaId` no corpo nem na query string.

Teste de isolamento: presente e efetivo. Não é exigido aqui, porque a tarefa não cria módulo nem query, e o isolamento das leituras de Turmas e do Analista continua coberto pelos testes de antes. No front, o caso "recomeço" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/e2e/classificacao-bncc.spec.ts:246` serve de prova adicional. A segunda professora vem de `criarEquipeComSenha()`, numa equipe e escola próprias. Antes de sair, o teste confere que o cache da aba guarda a habilidade trocada (linha 254). Depois, confere que a turma, o "Sem habilidade" e o cache da professora anterior não aparecem para a seguinte. Sem a limpeza do cache, o teste quebraria.

Bloqueantes: nenhum

Recomendações:
- O caso novo em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/governanca/analista.int.test.ts:347` substitui `recortesComLotes` e `acertosPorRecorte` por espiões. Por isso ele prova que a linha `null` fica separada da habilidade com código e não gera alerta, mas não prova o escopo de escola dessa linha no SQL de `acertosPorRecorte`. Seria bom um caso de integração com banco real que confirme que a linha `codigo: null` da escola B não entra na conta da escola A. Hoje o escopo dessa query é coberto só pelos testes que já existiam.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-20 06:15:59 · `tasks/prd-classificacao-bncc/12_task.md`

VEREDITO: APROVADO

Caminho quente tocado: nenhum
Rate limit: ok (a tarefa não cria nem altera rota, login ou limitador)
Fila e prioridade: ok (não há job novo nem mudança de fila)
Concorrência: protegida (não há escrita nova; a mudança é texto de leitura na web e testes)
Índice e paginação: ok (não há query nova. A aba Alunos continua lendo de cem em cem, e `hasQuestaoSemHabilidade` percorre só as linhas já carregadas, em `apps/web/src/areas/professor/turmas/alunos-da-turma.ts:88`)
Degradação de IA: não se aplica (não há chamada de modelo nova. O `e2e/classificacao-bncc.spec.ts` usa a API de verdade com o adaptador falso, e nenhum teste chama provedor pago)
Migration: não se aplica
Métrica e alerta: ok (não há código novo no caminho quente nem alerta novo)

Bloqueantes: nenhum

Recomendações:
- O caso novo em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/governanca/analista.int.test.ts:347` simula o `AnalistaRepository`, que é código nosso, com `vi.spyOn`. Assim ele não prova que a query de `acertosPorRecorte` devolve a linha `codigo: null` separada da linha com código. O agrupamento no banco já deve estar coberto pelos testes da 10.0. Se não estiver, vale um caso com o Postgres real e uma questão sem habilidade.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/e2e/classificacao-bncc.spec.ts` grava material, capítulo, seções e alunos direto no banco no `beforeAll` e roda em série. Se a esteira estiver perto do prazo, o caso que gera o artefato é o primeiro a conferir contra a metade do prazo (`tools/ci/duracao-do-e2e.ts`).

## revisor-geral · 1ª rodada · APROVADO · 2026-11-20 06:16:12 · `tasks/prd-classificacao-bncc/12_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido

**Bloqueantes:** nenhum.

**Escopo.** As subtarefas 12.1 a 12.5 foram feitas, e nada entra na cobertura da 13.0.

**Divergências declaradas.** As quatro estão cobertas e nenhuma muda a arquitetura:
- **A tela Eu não ganha linha "Sem habilidade".** Está registrada na `techspec.md` §9. Não diverge do `cenarios.md`, que pede o texto "ao aluno", e o aluno o vê no resultado da atividade.
- **A frase de explicação ficou em `apps/web`, não em `packages/shared`.** A Tech Spec não diz onde ela mora, e é texto de tela, não contrato.
- **O `analista.command.ts` não mudou.** O contrato da 10.0 já devolve a linha `habilidade: null` separada, e a 12.0 só acrescenta o teste que prova isso.
- **O e2e foi dividido em casos em série.** É decisão de como testar, não de arquitetura.

**Fotos.** Mostram as telas de sempre (Turmas Hoje e Alunos, Eu, Analista; computador e celular; escola cheia e vazia), sem regressão. A vitrine não tem questão sem habilidade, então o "Sem habilidade" se julga pelo código, pelos testes de tela e por `e2e/classificacao-bncc.spec.ts`. O e2e passa pelas três telas e pelo resultado da aluna, com 360 px, axe e o vocabulário de nota.

**Recomendações:**
1. **Singular e plural na mesma linha** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/professor/turmas/TurmaHoje.tsx:302`). A barra soma várias questões, mas a segunda linha fica "Esta questão não tem habilidade da BNCC associada. 2 alunos acertaram menos da metade dessas questões…". A frase vem do `cenarios.md`. Se o Arquiteto quiser, uma variante no plural para a barra agregada de Turmas e do Analista ("Estas questões não têm…") resolve, e precisaria entrar no `cenarios.md`.
2. **O teste do alerta exercita o adaptador falso** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/governanca/analista.int.test.ts:35`). Ele chama `resumoDoAnalista.falso(entrada)`, ou seja, prova que o falso não alerta pela linha `null`. Com o modelo de verdade, quem barra esse alerta é a validação em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/ia/tasks/resumo-do-analista.ts:54-57`. Vale citar no documento o teste dessa validação, da 10.0, como a prova de "não usa no alerta". A cobertura é do `test-engineer`.
3. **Quebra de linha no meio da frase** em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/docs/interface.md:389`: "quem saiu da turma (transferido, ou" termina a linha cedo depois do trecho inserido. É só cosmético.
4. **O roteiro menciona o caso sem habilidade que a demonstração não mostra** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/docs/roteiro-da-demonstracao.md:236-239`). O passo 4 descreve um caso que a demonstração nunca exibe, e quem apresenta pode se perder. Uma nota fora do "Diga" seria mais clara.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-20 06:18:13 · `tasks/prd-classificacao-bncc/12_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- **Turmas, Hoje:** a barra "Sem habilidade" leva a explicação e fala "dessas questões"; a barra com código continua com "desta habilidade". Vale também com zero alunos abaixo da metade.
- **Turmas, Alunos:** "Sem habilidade: x de y" na coluna, e a nota aparece uma vez só, abaixo da tabela, e só quando alguma linha tem a questão sem habilidade. Isso inclui o aluno transferido, que fica sem desempenho, e a lista vazia.
- **Aluno:** o resultado da atividade mostra "Sem habilidade" com a explicação. A Eu não inventa linha para ela.
- **Analista, API:** a linha `null` não se soma a uma habilidade com código e não vira alerta.
- **Analista, tela:** o recorte e o dado nominal mostram a explicação uma vez, sem código inventado.
- **e2e do fluxo:** a coordenação corrige, a professora gera e vê a corrigida, troca e aplica, Turmas mostra a trocada, e há o recomeço com outra professora na mesma aba. Tudo em `chromebook` e `celular`, com 360 px, axe e o vocabulário de nota.
- **Permissão e isolamento:** não se aplicam, porque a tarefa não cria rota nova. Concorrência também não, porque não há escrita nova.

**Cobertos:**
- **Testes de tela, verdes:** rodei `npx vitest run --project unidade` em `apps/web/src/areas/professor/turmas/`, `Atividade.test.tsx`, `Eu.test.tsx` e `Analista.test.tsx`: 20 arquivos e 331 testes, todos passando.
- **Testes de tela, conferidos contra as mutações:** cobrem os casos dos testes de Turmas (Hoje e Alunos), aluno e Analista. Cada bloco da seção "Mutações" cai num caso que chega à cláusula. `mutacoes.ts --faltando` respondeu "Nenhuma linha nova de produção com condição fica sem bloco".
- **Proteções do e2e:** o controle de cache cheio antes da ausência no recomeço está certo. Não há `.skip` nem provedor pago.
- **O que vem de tarefas anteriores:** o seletor por teclado, os 44 px de "Trocar" e de "Deixar sem habilidade", o axe com o seletor aberto (`e2e/professor-troca-de-habilidade.spec.ts:55-141`) e o alerta sem habilidade recusado pela conferência (`packages/core/src/ia/tasks/numeros.test.ts:760-772`).
- **O que não rodei:** o e2e e o teste de integração, que precisam do ambiente.

**Bloqueantes:**
1. **O teste de integração do Analista espia a parte que soma.**
   - **Onde:** `apps/api/src/governanca/analista.int.test.ts:351-357`.
   - **O que está errado:** o teste citado na linha "Analista com `codigo: null` | I | não inventa código, não junta, não alerta por ela" espia `AnalistaRepository.prototype.acertosPorRecorte`. É o único lugar que junta linhas: o `jsonb_to_recordset` com `group by habilidade.codigo` e a soma, em `analista.repository.ts:199-212`, e igual em `acertosDaTurma`, em `:290-299`. Se o SQL juntasse a linha `null` a outra habilidade, ou a perdesse, o teste continuaria verde. Isso é um mock de coisa nossa escondendo a regra (regra 40).
   - **O alerta também não está provado:** o teste chama `resumoDoAnalista.falso(entrada)` direto, ou seja, prova o adaptador falso. Na produção quem barra o alerta é o `conferir`, que já tem teste em `numeros.test.ts:770`. O teste novo repete o caso da 10.0 (`:322-345`) e não acrescenta prova nenhuma.
   - **Correção exigida:**
     - **Junção:** um caso com dado de verdade no banco. É uma atividade aprovada da turma `a.turma` com uma questão `habilidade: null`, usando os fixtures `criarAtividade`, `aplicarAtividade`, `responderProva` e `aprovarOLote`. A leitura é por `GET /v1/analista/nominal`, que só precisa de uma turma, ou por `preparar` no recorte de Química, que tem duas professoras: basta aprovar o lote do 2ºC. Sem espiar `acertosPorRecorte` nem `acertosDaTurma`, o caso confere a linha `{ habilidade: null, acertos, total }` com os números dela e as linhas com código sem mudança.
     - **Alerta:** a parte do alerta passa a citar `numeros.test.ts` › "a medida da questão sem habilidade… não vira alerta" na tabela, ou chama `resumoDoAnalista.conferir` em vez do `falso`.

**Recomendações:**
- **Tabela e autoconferência da 12_task.md:** a linha "360 px" e a autoconferência 11 dizem "`conferirATela` em todo caso" e "44 px no `celular`", e isso não confere com o spec.
  - **Casos sem a conferência:** o caso 3 (troca e aplica, `e2e/classificacao-bncc.spec.ts:159-191`) não tem axe nem a conferência de rolar de lado. O caso 1 não confere o vocabulário de nota. O caso 6 não tem nenhuma das três.
  - **Os 44 px:** `activate` só toca na tela e não mede tamanho (`e2e/support/professor-flow.ts:26-28`).
  - **Correção:** pôr `conferirATela` nos casos 1, 3 e 6, ou corrigir o texto citando `professor-troca-de-habilidade.spec.ts` para os 44 px e o teclado.
- **Caso da aluna no e2e** (`e2e/classificacao-bncc.spec.ts:225-244`): o nome promete "com a habilidade trocada", mas não há asserção da descrição dela, nem da ausência da sugerida. Vale acrescentar as duas.
- **Teste do resultado da aluna** (`apps/web/src/areas/aluno/Atividade.test.tsx:384`): o comentário diz "a com habilidade não", mas o dado do caso tem só a linha `null`. Pôr uma linha com código no mesmo caso, para que o `toHaveLength(1)` prove isso.
- **Teste da Eu** (`apps/web/src/areas/aluno/Eu.test.tsx:227-240`): é um teste negativo de algo que o código não faz, e não falharia sem regra nenhuma. Quem garante a regra é o contrato `aReforcar: z.array(habilidadeSchema)` em `packages/shared/src/tutor/tutor.ts:125`. Citar esse contrato na tabela, ou um teste do contrato recusando habilidade nula.
- **Analista sem e2e na tarefa:** a explicação nova, que é mais longa, entrou no `detalhe` da barra do recorte e do dado nominal. Conferir os 360 px e o axe do Analista no `celular`, num e2e existente ou num caso deste spec.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/12_task.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/governanca/analista.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/e2e/classificacao-bncc.spec.ts`

## revisor-geral · 2ª rodada · APROVADO · 2026-11-20 06:47:44 · `tasks/prd-classificacao-bncc/12_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (`portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)`)
Bloqueantes: nenhum

Os sete itens da ordem `.processo/ordens/12_task-r1.md` foram feitos. Desde a rodada anterior, nada mudou em código de produção: só teste e documento.

1. **Analista com a linha `null`.** O caso em `apps/api/src/governanca/analista.int.test.ts:348` agora não usa espião. Ele tem escola própria e dois lotes reais, um no 2ºB e outro no 2ºC, com duas questões sem habilidade.
   - Confere a rota nominal `{ habilidade: null, acertos: 1, total: 2 }`. Confere também o recorte de Química, com a soma das duas turmas e o acerto de 70%.
   - O alerta é provado pela `conferir`, que aceita a saída do adaptador falso e recusa um alerta com `habilidade: null`.
   - A tabela da `12_task.md` cita o caso de `numeros.test.ts:760`, e o caso existe.
2. **`conferirATela` e 44 px.** Os seis casos do `e2e/classificacao-bncc.spec.ts` chamam `conferirATela` (linhas 151, 165, 200, 220/231, 257, 280). A tabela e a autoconferência 11 agora dizem que os 44 px são medidos em `professor-troca-de-habilidade.spec.ts`, em vez de afirmar o que o spec não faz.
3. **Caso da aluna no e2e.** Afirma a descrição da habilidade trocada e da corrigida, e afirma que a sugerida não aparece (linhas 263-265).
4. **`Atividade.test.tsx`.** O caso agora tem duas linhas e confere em qual barra está a explicação.
5. **Eu.** O teste novo do contrato em `packages/shared/src/tutor/tutor.test.ts:126` recusa `null`, `codigo: null` e habilidade sem código em `aReforcar`, e a tabela o cita.
6. **Quebra de linha.** A de `docs/interface.md` foi corrigida.
7. **Roteiro.** O caso sem habilidade saiu do "Diga" e virou nota para quem apresenta, em `docs/roteiro-da-demonstracao.md:241-244`.

As recomendações que não foram aplicadas estão na seção "Recomendações sem aplicar" da `12_task.md`, cada uma com destino ou motivo. As duas que foram para o `TODO.md` estão lá, cada uma com dono.

Recomendações:
- `apps/api/src/governanca/analista.int.test.ts:394`: o `alertaSemHabilidade as never` contorna o tipo para montar o alerta inválido. Um `as unknown as (typeof saida.alertas)[number]` deixaria claro qual tipo está sendo forçado; `never` aceita qualquer coisa e esconde o tipo se o formato do alerta mudar.
- `apps/api/src/governanca/analista.int.test.ts:376`: a chamada `preparar({ id: randomUUID(), tarefa: ..., chaveEnvio: ..., entrada: ... })` repete a `execucao()` que o `describe` já usa na linha 269. Daria para reaproveitá-la.

## test-engineer · 2ª rodada · APROVADO · 2026-11-20 06:49:11 · `tasks/prd-classificacao-bncc/12_task.md`

VEREDITO: APROVADO

Cenários exigidos (rodada 2, só o diff e as correções da 1ª): a questão sem habilidade lida do banco de verdade no Analista, tanto no dado nominal quanto no recorte, sem se juntar a outra habilidade e sem se perder; nenhum alerta nasce da linha `null`, e a conferência recusa esse alerta; as quatro recomendações da 1ª rodada.

Cobertos:
- **Bloqueante 1, a junção: corrigido.** O caso novo está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/governanca/analista.int.test.ts:348-395`.
  - Ele monta uma escola só dele e grava dois lotes aprovados, de duas professoras, com `criarAtividade`, `aplicarAtividade`, `responderProva`, `encerrarAtividade` e `aprovarOLote`, sem espião.
  - As questões 3 e 4 ficam com `habilidade: null`.
  - Conferi as contas à mão com o gabarito 0,1,2,3,0:
    - nominal da turma da professora: 102 com 2/2, 103 com 0/1, `null` com 1/2;
    - recorte de Química, somando as duas turmas: 102 com 4/4, 103 com 1/2, `null` com 2/4, e 70% no total.
  - O teste falha se o SQL perder a linha `null`: some uma linha.
  - Falha também se o SQL juntar a `null` a uma das habilidades: 103 viraria 1/3 ou 102 viraria 3/4.
- **Bloqueante 1, o alerta: corrigido.** O teste chama `resumoDoAnalista.conferir` de verdade.
  - A saída do `falso` passa sem problema nenhum.
  - Um alerta com `habilidade: null` e `valor: 50` é recusado.
  - O valor 50 foi bem escolhido: é o percentual exato da linha `null`. Se a cláusula `codigoDoAlerta === undefined` de `resumo-do-analista.ts:55-57` caísse, o alerta acharia a linha `null`, passaria nas outras checagens (valor igual, abaixo do limiar) e o teste ficaria vermelho. O cenário chega à cláusula.
  - A tabela da tarefa cita também `numeros.test.ts` (linhas 760-772).
- **Recomendações da 1ª rodada: as quatro aplicadas.**
  - `conferirATela` está no fim dos seis casos de `e2e/classificacao-bncc.spec.ts` (linhas 151, 165, 200, 220/231, 257, 280).
  - Os 44 px ficam explicados na tabela e no item 11: as ações vêm da 11.0 e são medidas em `professor-troca-de-habilidade.spec.ts`.
  - O e2e da aluna confere a descrição da habilidade trocada e a da corrigida, e a ausência da sugerida. O corte em 60 caracteres cabe no limite de 300.
  - `Atividade.test.tsx` agora tem uma linha com código e outra sem. A explicação aparece uma vez só, e o teste confirma pelo `div` do `ProgressBar` que ela está na barra da linha `null`.
  - O contrato de `aReforcar` foi testado em `packages/shared/src/tutor/tutor.test.ts:126-132`: aceita `habilidade` e recusa `null`, `codigo: null` e o objeto sem código. A tabela cita o teste.
- `Atividade.test.tsx` e `tutor.test.ts` passaram aqui: 43 de 43.
- Não há `.skip` nem teste comentado. Nenhum teste chama provedor de IA pago: o resumo usa o `falso`.

Bloqueantes: nenhum.

Recomendações:
- Não rodei o `analista.int.test.ts`. O portão de integração se recusou a subir porque os workers e despachantes do compose de teste `educa-teste-1` estão rodando, provavelmente a vitrine ou o e2e de outro andar, e eu não os parei. As contas acima são conferência à mão; o portão da tarefa precisa ver esse caso verde antes do carimbo.
- Os dois casos da 10.0 com espião continuam: `analista.int.test.ts:323` e `:410`, espiando `acertosPorRecorte` e `acertosDaTurma`. O caso novo já prova o SQL de ponta a ponta, então eles provam só a montagem no command. Vale renomeá-los para dizer isso, ou apagá-los na 13.0, para ninguém lê-los como prova da junção.
- Os casos novos usam `alertaSemHabilidade as never`, em `analista.int.test.ts:394` e igual em `numeros.test.ts`, para simular a saída inválida do modelo. É aceitável, mas um `safeParse` falhando antes da conferência deixaria explícito que o schema também a recusaria.
