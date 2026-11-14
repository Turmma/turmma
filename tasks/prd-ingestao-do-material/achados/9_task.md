# Achados das revisões — `tasks/prd-ingestao-do-material/9_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-13 18:54:56 · `tasks/prd-ingestao-do-material/9_task.md`

VEREDITO: APROVADO

Tela vista: sim. Li 8 fotos: tutor e tarefas, no computador e no celular, na escola cheia e na vazia, e as duas de início do celular. Nenhuma tela rola a 1366 × 768. O estado novo "sem material" não aparece na vitrine. Revisei esse estado pelo código e pelo e2e. As fotos mostram as telas ao redor, e nenhuma delas mudou.

Estados: ok. A tarefa só acrescenta o estado `sem_material` ao bloco de pausa que já existia.
- Com dado: lista de atividades. Vazio: "Nenhuma atividade para pedir ajuda agora", que diz o próximo passo.
- O aviso novo vem do 422 `SEM_MATERIAL_DA_SERIE` e usa o `Pausa` de `Tutor.tsx:53-62`. O texto é "Ainda não há material da sua turma aqui. Avise seu professor." (`tutor.ts:75`).
- O aviso não mostra código, ponto de exclamação nem culpa. Não tem avatar nem fala do Tutor, e a recusa vem antes de gravar a pergunta (`tutor.service.ts:288`).
- A mensagem de `messages.ts` ("Peça à coordenação o material desta série.") é endereçada ao professor. O e2e confirma que ela não vaza para a tela do aluno.
- Carregando e erro não foram tocados.

Acessibilidade: ok.
- O bloco usa `role="status"` e o ícone `aria-hidden`, e o texto tem `break-words` e `min-w-0`.
- O e2e novo roda o axe (`seriousViolations`) e mede a rolagem horizontal, nos projetos de computador e de celular (`aluno-tutor.spec.ts:437-443`).
- O contraste usa os mesmos tokens das outras pausas.

Chromebook fraco: sem impacto. Não entrou lista nova nem imagem, e é um bloco de texto com um ícone.

Celular: ok. O aviso reaproveita o bloco das outras pausas, que cabe a 360 px, e o e2e confere `horizontalOverflow === 0` no projeto de celular. Nada depende de hover. A caixa de pergunta continua usável.

Ação oficial protegida: sim. A tarefa não toca ação oficial. O estado não gera nota nem decisão, e a recusa é de leitura.

Bloqueantes: nenhum.

Recomendações:
- "Avise seu professor." é curto demais para quem nunca viu o aviso. Uma frase a mais ajudaria, por exemplo "O material da sua turma ainda não chegou. Avise seu professor." Isso é texto, não bloqueia.
- O aviso só some na próxima pergunta (`recusaVencida` devolve `false`, por decisão registrada em `docs/interface.md`). Se o professor enviar o material enquanto o aluno está na tela, o aviso continua até ele perguntar de novo. Está documentado e coerente com a pausa `suspenso`. Vale reavaliar depois do piloto.
- `FalhaNaConversa` (`Tutor.tsx:112`) mostra "O Tutor não recebeu esta mensagem." acima do aviso. Para `sem_material` a frase é redundante com o aviso, mas é inofensiva.

Arquivos relevantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/aluno/Tutor.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/aluno/tutor.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/aluno/tutor.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/e2e/aluno-tutor.spec.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/docs/interface.md`

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-13 18:55:12 · `tasks/prd-ingestao-do-material/9_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nem migration nesta tarefa. Li `material`, `material_serie`, `licenca_de_material` e `trecho` (só leitura), e `mensagem_tutor`, alterada apenas na fixture de teste.

Queries verificadas:
- `MaterialRepository.buscar`, `paginasDoMaterial`, `existeMaterialDaSerie` e os filtros `declaradoParaASerie` e `proprioOuComLicencaVigente` (`apps/api/src/material/material.repository.ts`). Todos tiram a escola de `requireEscolaId()`, e as duas subconsultas também.
- `TutorDoAlunoRepository.turmaDoAluno` e `materialDaTurma` (`apps/api/src/tutor/tutor.repository.ts`): escola e ano letivo vêm do contexto do aluno, e a série vem da turma dele.
- `TurmaDoProfessorRepository.turmaComDisciplina` (`apps/api/src/assistente/turma-do-professor.repository.ts`): passou a devolver também `serieId`, e o escopo não mudou.
- Na ferramenta, no chat e no Tutor, `SEM_MATERIAL_DA_SERIE` só sai depois de a turma, a atividade ou o material da própria escola terem sido conferidos (`NAO_ENCONTRADO` antes). Por isso o 422 não confirma que existe algo em outra escola.
- O `serieId` da rota `GET /v1/materiais/busca` vem da query string, é validado como UUID e só filtra. A série de outra escola não acha nada, e o teste cobre isso (`leitura-por-serie.int.test.ts:481`).
- Em assunto delicado (D36), o Tutor grava `materialId: null` e não lê o id que o cliente mandou. A resposta não muda conforme o material, então não há oráculo.
- Não há `@Unscoped()` novo. Os scripts de carga (`infra/scripts/carga-ingestao.ts`, `conferir-carga-ingestao.ts`) usam SQL direto filtrado por `escola_id`. São ferramentas de operação, fora da API.
- A camada rede não foi tocada.

Teste de isolamento: presente e efetivo. O teste antigo da rota (`apps/api/test/material-isolamento.int.test.ts:109`, busca sem `serieId` com a disciplina de B) continua quebrando se o escopo `trecho.escolaId` for retirado. O caso novo (`apps/api/test/leitura-por-serie.int.test.ts:470-484`) traz o contraponto de que, na escola dona, o material é achado.

Bloqueantes: nenhum

Recomendações:
- `apps/api/test/leitura-por-serie.int.test.ts:477` e `:480`: no contexto da escola A, a busca e o `existeMaterialDaSerie` usam `a.escola.quimica` com `b.serie9`. Com essa combinação, a disciplina já descarta o material de B, e os dois cortes por escola, `eq(material.escolaId, requireEscolaId())` em `existeMaterialDaSerie` e o `requireEscolaId()` em `declaradoParaASerie`, ficam sem prova. Vale acrescentar o pedido com `b.escola.quimica` e `b.serie9` no contexto de A, e mutações que tirem cada um desses cortes.
- Os cortes por escola dentro de `declaradoParaASerie` e `proprioOuComLicencaVigente` repetem o filtro da tabela principal. Retirar só um deles não quebra nenhum teste, porque o outro segura. É defesa em profundidade e deve ficar, mas convém deixar isso escrito no comentário para que ninguém remova um achando que é sobra.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-13 18:55:19 · `tasks/prd-ingestao-do-material/9_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. Nenhum arquivo do diff grava em `Nota` nem mexe em `lancadaPor`. O e2e (`e2e/support/atividade-db.ts`) só insere em `material_serie` e `trecho`. Todos com autor humano? Sim, porque nenhum caminho novo foi aberto.

Decisão autônoma sobre aluno: ausente. A recusa `SEM_MATERIAL_DA_SERIE` só decide se há material para a turma. Não decide nada sobre o aluno e não deixa marca nele: o contador `tutor.recusa_sem_material` tem só o rótulo `turma_id` (`apps/api/src/tutor/tutor.service.ts:287`).

Aprovação registrada: ok. O fluxo de entrega não mudou. Ferramenta e chat recusam antes do `202`, sem execução, consumo ou chamada ao modelo (`apps/api/src/artefato/ferramentas.service.ts:71`, `apps/api/src/assistente/assistente.service.ts:90`). Nenhuma saída nova de IA passa sem aprovação, e a exceção do tutor (D47) não aparece em outro agente.

Supervisão do tutor: ok.
- A D36 continua antes do filtro de material (`tutor.service.ts:177`). O filtro vem depois, em `#doMaterial` (`:180`, `:276-291`).
- O encaminhamento grava a pergunta, a mensagem fixa e o sinal `atencao_humana` sem depender do material (`:368-412`). Os três casos estão provados em `apps/api/test/leitura-por-serie.int.test.ts:329`.
- Quando a recusa vem antes do `202`, o modelo não roda e nada chega ao aluno vindo da IA, então não sobra uso escondido do professor.
- Quando a conferência depois do `202` falha (`:221`), a pergunta fica em `mensagem_tutor` e o professor continua vendo (`leitura-por-serie.int.test.ts:373` e `:389`).
- As fotos de `/aluno/tutor` e `/aluno/inicio` (`.processo/vitrine/aluno--aluno-tutor--computador.png`, `aluno--aluno-inicio--computador.png` e as versões de celular e da escola vazia) mantêm o aviso "Quem dá a aula acompanha como você usa o Tutor." e o selo "IA" no Tutor.
- O estado novo não aparece como fala do Tutor: não tem avatar (`apps/web/src/areas/aluno/tutor.ts:75` e `apps/web/src/areas/aluno/Tutor.tsx:47,57`), o que está de acordo com a D58. Ele é provado por `e2e/aluno-tutor.spec.ts`, porque a vitrine não chega a produzir esse estado.

Autonomia declarada e visível: sim, sem mudança nesta tarefa.

Os outros itens:
- Vigilância (item 7): nada mede navegação, tempo ou emoção. A contagem é por turma.
- Nota em discursiva e redação (item 8, D55): nada novo.
- Medir o professor (item 9, D45 e D64): nenhuma métrica de professor foi criada, e a conversa do professor com o chat continua fora do alcance da coordenação.
- Fotos de `/aluno/atividades`: "Corrigida" e "A correção foi aprovada" mostram aprovação humana, sem nota nem sugestão de nota.
- Fotos de `/aluno/inicio`: nada que induza uso. Sair continua a um clique.

Bloqueantes: nenhum.

Recomendações:
1. `apps/api/src/tutor/tutor.service.ts:221`: quando o material sai do alcance entre o `202` e a conferência, a execução falha antes de o modelo classificar o texto. Nesse intervalo, um assunto delicado que só o modelo pegaria, e as palavras-gatilho não, fica sem encaminhamento. A pergunta fica visível ao professor e a janela já existia no caso da avaliação aberta (`:225`), por isso não bloqueia. Vale registrar para a AIA do Tutor e para a retro, e talvez rodar `ehAssuntoDelicado` de novo sobre `pergunta.texto` antes de falhar.
2. Hoje quem fica sabendo que uma turma está sem material da série são a nossa operação, pelo painel de Fundação, e o aluno, por "Avise seu professor". Um indicador por turma, sem aluno, na tela do professor ou da coordenação fecharia o ciclo sem depender do aluno. Fica para produto.
3. A mensagem do professor, "Peça à coordenação o material desta série.", não diz qual série. Citar a série da turma ajudaria a coordenação. É só texto.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-13 18:55:59 · `tasks/prd-ingestao-do-material/9_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo. A tarefa só lê `serie.id` (que não é dado pessoal) e o devolve dentro de `TurmaComDisciplina` e `TurmaDoAluno`. O comentário diz que ele nunca vai para a tarefa de IA, e o código confirma. As tabelas `mensagem_tutor`, `consumo_ia` e `execucao_agente` não ganharam coluna. Na recusa `SEM_MATERIAL_DA_SERIE` nada é gravado nelas, e o teste `leitura-por-serie.int.test.ts` prova isso nas quatro contagens.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok.
- Na ferramenta e no chat, `turmaComDisciplina` (com o vínculo confirmado) vem antes da checagem de material. Uma turma de outra pessoa ou de outra escola recebe `NAO_ENCONTRADO` antes do 422, então o 422 não revela a existência de nada (`ferramentas.service.ts:68-71`, `assistente.service.ts:87-90`).
- No Tutor, um material de outra série, uma edição substituída ou uma licença vencida respondem `NAO_ENCONTRADO`, igual a um id que não existe (`tutor.service.ts`, `#doMaterial`).
- O `serieId` em `GET /v1/materiais/busca` só filtra, não libera acesso. A série de outra escola não acha nada (`material.repository.ts:186-193`).

Logs: limpos. Nenhum log novo. O contador `tutor.recusa_sem_material` tem só o rótulo `turma_id`: sem aluno, sem escola e sem texto da pergunta (`tutor.service.ts`, `#doMaterial`). O painel do Grafana agrega por `turma_id`.

Auditoria: nenhuma ação desta tarefa exige registro. Não há leitura de dado de aluno por coordenação ou rede, nem exportação, nota, permissão ou aprovação de saída de IA.

Fotos da tela: as 12 fotos mostram só o nome do próprio aluno, que é sintético ("Aluno Sintético Caio 59d63a49", "Aluno Sintético Téo 7f0ce244"), na área dele. Isso está dentro da matriz: o aluno vê a si mesmo. Não aparece dado de outra pessoa nem código de erro. O estado "sem material" não está nas fotos. Pelo código (`apps/web/src/areas/aluno/tutor.ts:75`) e pelo e2e, ele mostra só texto fixo, sem avatar e sem conteúdo do aluno.

Envio externo: o que vai para o modelo não mudou em forma nem em quantidade. Continuam indo trechos de material, agora também filtrados por série e licença. A ferramenta e o chat recusam antes do 202, sem chamar o adaptador; o `vi.spyOn` do `FakeAdapter` prova isso. A D36 continua vindo antes do filtro e não faz chamada externa (`origem: 'regra_fixa'`, `envioExterno: false`). O registro em `ExecucaoAgente` não mudou.

Seed/fixture: sintético.
- `leitura-por-serie.fixture.ts` usa "Editora sintética", "contrato sintético 9" e texto de estequiometria.
- A carga cria escolas pelo `ops:escola` e sessões pelo `ops:sessao-sintetica`, envia o PDF de demonstração e manda ao Tutor a pergunta fixa "Pergunta sintética de carga…".
- `e2e/support/atividade-db.ts` só insere linhas em `material_serie`.
- No `escola-tutor.fixture.ts`, a mudança no `id` v7 não toca dado de pessoa.

Bloqueantes: nenhum.

Recomendações:
1. `docs/runbook.md`, seção "Turma sem material da série": a consulta de exemplo no `psql` filtra só por `ms.serie_id`, sem `escola_id`. Ela devolve só ids, estado e datas, e o UUID da série já delimita o resultado. Mesmo assim, vale incluir `m.escola_id = '<escolaId>'`, para o procedimento de operação seguir o mesmo hábito de escopo da regra 10.
2. `infra/scripts/carga-ingestao.ts:298`: a pasta temporária fica com permissão `0o777` e guarda os tokens das sessões. Os tokens são sintéticos, de um compose descartável, e a pasta é apagada no `finally`, então não bloqueia. Vale um comentário que proíba reaproveitar esse padrão fora da carga.
3. O rótulo `turma_id` no contador está certo. Fica registrado para a AIA do Tutor que uma turma muito pequena (por exemplo, uma turma de adaptação com um ou dois alunos), cruzada com o horário, poderia apontar quem perguntou. Hoje o contador não guarda conteúdo e a métrica fica na nossa infraestrutura, então o risco é baixo.

Pergunta de fechamento: nada mudou. A tarefa não cria dado novo sobre o aluno. A recusa não grava nada que seja do aluno, e o envio externo continua registrado onde já estava.

Arquivos que conferi:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/material.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/tutor/tutor.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/artefato/ferramentas.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/assistente/assistente.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/infra/scripts/carga-ingestao.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/leitura-por-serie.fixture.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/docs/runbook.md

## infra-guardian · 1ª rodada · APROVADO · 2026-11-13 18:56:01 · `tasks/prd-ingestao-do-material/9_task.md`

VEREDITO: APROVADO

Caminho quente tocado: tutor | IA | fila

Rate limit: ok. O `RateLimitGuard` global conta por `sub` e por `esc` do token antes de chegar ao Postgres. No Tutor, `limite.contar()` vem depois da D36 (mensagem fixa para assunto delicado). Os tetos de envio sobem para 100 por pessoa e 300 por escola por hora, e 300 materiais em processamento por escola, como o §7c da Tech Spec manda. Continuam por usuário e por escola, sob a trava de envios. O pior caso de disco (cerca de 60 GB) já está em `docs/infra.md` §3.5, protegido pelo alerta `pdf-parado`.

Fila e prioridade: ok. A recusa por falta de material vem antes do `202`, sem execução, sem consumo e sem chamar o modelo. A ingestão continua na fila `pdf` com vaga por escola (`VAGAS_ESCOLA_PDF`, 2). O controle negativo da carga reprova sem essa vaga: o PDF da B esperou 179 extrações da A.

Concorrência: protegida.
- A conferência depois do `202` usa o mesmo filtro do `POST` (`tutor.service.ts:221`). Os dois casos `[P]` em `leitura-por-serie.int.test.ts` forçam a ordem com `WriteBlockTrigger`.
- A corrida do teto de processamento foi refeita: 299 materiais semeados e 5 envios simultâneos dão `[201, 429, 429, 429, 429]`, e nenhum objeto fica para trás no storage.

Índice e paginação: ok.
- `existeMaterialDaSerie` usa `material_disciplina_idx` (escola, disciplina, id) com `.limit(1)`.
- O `exists` da série usa a chave primária de `material_serie` (escola, material, série).
- O da licença lê pela chave primária de `licenca_de_material`.
- `buscar` continua começando por `trecho.escola_id, disciplina_id` (o índice GIN), e `paginasDoMaterial` tem `limit`.
- Na carga: pior statement de 108 ms, e o turno do Tutor da B ficou 18 ms acima da base.

Degradação de IA: ok. `SEM_MATERIAL_DA_SERIE` é 422 tipado e vira o estado `sem_material` na tela do aluno pelo `pausaDoErro`, com texto fixo, sem fala do Tutor e sem código. Nenhum erro cru chega ao aluno.

Migration: não se aplica. A tarefa não cria migration.

Métrica e alerta: ok. Contador novo `tutor.recusa_sem_material`, rotulado só por `turma_id`, com gráfico no painel de Fundação e procedimento "Turma sem material da série" no runbook. Não há alerta novo. A latência e o erro da rota já são medidos.

Bloqueantes: nenhum

Recomendações:
1. `apps/api/src/tutor/tutor.service.ts:173-180`: quando o aluno reenvia com a mesma `chaveEnvio` (`jaAceita` definido) e o material saiu do alcance entre os dois envios, `#doMaterial` responde `SEM_MATERIAL_DA_SERIE` ou `NAO_ENCONTRADO` em vez de devolver o `execucaoId` já aceito. A execução, por sua vez, falha na conferência do `entrada`. O resultado é coerente, mas fura a promessa do comentário da linha 172 ("o reenvio com a mesma chave devolve a mesma execução"). O jeito anterior à tarefa já tinha a mesma falha com material excluído. Sugestão: devolver `{ execucaoId: jaAceita.id }` antes de `#doMaterial` quando `jaAceita !== undefined`.
2. A corrida de 13/11 da carga não vale como registro: a carga média de 1 minuto da máquina estava em 8,3 e 5,5, e a condição 1 de "Quando a carga vale como registro" exige a máquina calma. Precisa ser repetida antes da validação.
3. A carga usou um PDF de 14,6 KB. A extração de 20 MB (o teto do contrato) e a projeção das 300 apostilas na janela da noite com esse tamanho não foram medidas, e cabem à validação com uma apostila real.
4. `existeMaterialDaSerie` roda duas vezes por turno do Tutor, no `POST` e no `entrada`. O custo medido é desprezível (+18 ms no p95). Se o cenário de sala das 10h apertar, esse é o primeiro lugar a olhar.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/tutor/tutor.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/material.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/material.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/db/schema/material.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/infra/scripts/conferir-carga-ingestao.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/9_task.md

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-13 18:57:07 · `tasks/prd-ingestao-do-material/9_task.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: divergência em "Leitura de página": a adaptação ficou fora da recusa antes do `202`. Isso só está escrito no `9_task.md`, e com um motivo que o código desmente.
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)

**Bloqueantes:**

1. A divergência 1 está em `tasks/prd-ingestao-do-material/9_task.md:117`, e o motivo dela é falso. A linha diz que "o que a 9.0 pede para 'atividade, plano e adaptação' é a recusa antes do `202`, que o `FerramentasService.gerar` faz para as três ferramentas". O código mostra outra coisa:
   - O `gerar` só atende duas ferramentas: `const TAREFA_DA_FERRAMENTA = { atividade_objetiva: 'gerar_atividade_objetiva', plano_de_aula: 'gerar_plano_de_aula' }`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/artefato/ferramentas.service.ts:32`.
   - A adaptação passa por outro caminho, o `ArtefatoService.adaptar`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/artefato/artefato.service.ts:119`. Esse caminho não chama `existeMaterialDaSerie` e não recebe `SEM_MATERIAL_DA_SERIE`.
   - Resultado: uma turma sem material da série ainda consegue pedir adaptação. A execução é aceita e consome modelo.

   A decisão de deixar a adaptação fora da recusa até pode ser certa, porque ela parte do artefato e não lê material. Mas ela foi tomada em silêncio. O objetivo da tarefa e o `cenarios.md` ("Leitura de página por série", itens 1 e 2: "Atividade, plano e adaptação"; "na ferramenta e no chat, antes do `202`") continuam dizendo o contrário, e a `techspec.md` §5 não diz nada sobre a adaptação.

   **Correção exigida:** escolher um dos dois caminhos.
   - (a) Pôr a recusa no `ArtefatoService.adaptar`, antes do `agendar`, com um caso em `leitura-por-serie.int.test.ts` que prove: sem execução, sem consumo, adaptador não chamado.
   - (b) Escrever na `techspec.md` §5 ("Como ficou na 9.0") e no `cenarios.md` ("Leitura de página por série") que a adaptação não lê material e não é recusada por `SEM_MATERIAL_DA_SERIE`. Nesse caso, corrigir a linha 117 do `9_task.md` com o motivo verdadeiro (a adaptação não passa pelo `gerar`).

**Recomendações:**

- `docs/runbook.md`, seção "Turma sem material da série": o texto diz "a turma pergunta ao Tutor, ou a coordenação gera uma ferramenta". Mas o contador `tutor.recusa_sem_material` só conta o Tutor, e quem gera ferramenta é o professor. Ajustar o texto para o gráfico não ser lido como contagem da ferramenta.
- O mesmo trecho do runbook manda "a coordenação declara a série na edição do material". O `PATCH` de séries é da 12.0 e ainda não existe; vale indicar o caminho que existe hoje.
- `apps/api/src/tutor/tutor.service.ts`: o contador soma também a recusa da conferência depois do `202`. Assim, uma pergunta que já foi aceita pode entrar na conta de recusas. Vale deixar isso escrito no docblock da métrica, ou contar só no `enviar`.
- `apps/api/src/tutor/tutor.service.ts`: a recusa `SEM_MATERIAL_DA_SERIE` e o `existeMaterialDaSerie` rodam antes do `limite.contar()`, então a recusa repetida não gasta o teto de pedidos. São só leituras baratas, mas fica o registro para o `infra-guardian`.
- A corrida da carga registrada em `9_task.md` ("A corrida da carga") não cumpriu a condição 1 de "Quando a carga vale como registro", e o próprio documento admite isso. A repetição com a máquina calma e o PDF de 20 MB precisam ir para a validação ou para o `TODO.md` com dono, não ficar só no texto da tarefa.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-13 18:58:22 · `tasks/prd-ingestao-do-material/9_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
1. **Caminho feliz.** A turma da série que tem material é atendida pela ferramenta (atividade e plano), pelo chat e pelo turno do Tutor, e cita só o material da série dela.
2. **Série errada.** Com material só do 2º ano e a turma no 9º, nada é citado por nenhum chamador: atividade, plano, adaptação, chat, turno, página aberta, `materialDaTurma` e `GET /busca`.
3. **Escola com material das duas séries na mesma disciplina.** A turma do 9º recebe só trechos e citações do material do 9º, nunca do 2º. É o vazamento de RF7 na forma em que ele acontece de verdade.
4. **Licença no dia de São Paulo.** Às 23h do último dia o material de licença ainda vale; às 0h01 do dia seguinte não vale mais. A licença futura fica fora até o dia dela. O `PATCH` que estende a licença traz o material de volta. A licença vigente de outro material não autoriza o de licença vencida.
5. **Sem material válido da série** (o único está vencido, em `processando` ou foi substituído). A resposta é `SEM_MATERIAL_DA_SERIE` antes do `202`, sem execução, sem consumo e sem chamar o adaptador.
6. **D36 antes do filtro**, nos três casos (turma sem material, edição substituída, licença vencida). A pergunta comum é recusada sem deixar nada gravado.
7. **Concorrência com ordem forçada `[P]`.** O material sai entre o `202` e a conferência.
8. **Modo livre** é aceito.
9. **Virada do ano** e o aluno que passou do 8º para o 9º.
10. **Permissão.** A professora de Física e a turma que não é dela recebem a mesma resposta do inexistente. O `serieId` filtra e não autoriza.
11. **Isolamento.** A escola A pedindo com a série da B recebe vazio, e a mesma série na B acha o material (controle positivo).
12. **Contagem das recusas** por turma, sem aluno.
13. **Estado do aluno**, em teste de unidade e em e2e.
14. **Carga [C]**, com o controle negativo.

**Cobertos:**
- Os cenários 2, 4, 5, 6, 7, 8, 9, 10, 11, 12 e 13 têm teste citado pelo nome. Rodei `npx vitest run --project integracao apps/api/test/leitura-por-serie.int.test.ts` uma vez: 25 de 25 verdes.
- As asserções olham o resultado: códigos de resposta, materiais achados, as quatro contagens de gasto, `vi.spyOn` provando que o adaptador e a busca não foram chamados, e `sinal_tutor`.
- Os dois `[P]` usam `WriteBlockTrigger`, ordem forçada de verdade, e não duas chamadas em sequência.
- Não há `.skip` nem teste comentado. A IA entra só pelo `FakeAdapter`, nenhum provedor pago.
- O relógio é injetado, e o material de demonstração é `titularidade: 'escola'`, então os testes não quebram com a mudança de data.

**Bloqueantes:**

1. **O filtro por série nos chamadores só fica vermelho porque o código quebra; o cenário 3 não existe.** Quatro blocos de mutação tiram o `serieId` da chamada:
   - `apps/api/src/artefato/ferramentas.service.ts:119`
   - `apps/api/src/assistente/assistente.service.ts:118`
   - `apps/api/src/tutor/tutor.service.ts:316`
   - `apps/api/src/tutor/tutor.service.ts:322`

   O vermelho de cada um vem de `serieId.toLowerCase()` aplicado a `undefined` em `apps/api/src/material/trecho-search.ts:78` e `:93`. Esse `TypeError` faz a execução da turma do 2º terminar em `falhou`. Não vem de um trecho de outra série chegando à geração. No único cenário do teste (material só do 2º, turma do 9º), a recusa antes do `202` responde primeiro, e a busca dos chamadores nunca filtra nada que importe.

   Exemplo do que passaria: se alguém tornar o `serieId` opcional na porta (`serieId?.toLowerCase()`) e o tirar de um chamador, `leitura-por-serie.int.test.ts` continua verde, e o 9º passa a receber o material do 2º.

   **Correção exigida:** um caso com material de Química do 2º e do 9º na mesma escola, os dois com a palavra procurada. A turma do 9º gera a atividade e o plano, conversa no chat e faz um turno do Tutor (com página aberta do material do 9º). O caso exige que todo `materialId` das citações seja o do 9º. As citações já estão disponíveis: `resultado.mensagem.citacoes` no chat e no Tutor, as fontes do artefato na ferramenta. Os quatro blocos acima devem citar esse caso.

2. **A carga [C] não tem corrida que valha como registro.** `tasks/prd-ingestao-do-material/9_task.md:551-554` admite que o load de 1 minuto estava em 8,3 e 5,5, com outro andar rodando a esteira. Pelo `docs/runbook.md:1395-1403`, a corrida "só entra como registro de tarefa, de correção ou de validação" com a condição 1 cumprida, "nem verde nem vermelha" sem ela.
   - Dizer que a folga é grande não basta. O critério do turno é a diferença entre a janela de ingestão e a janela de base, e o ruído de outra máquina em só uma das duas janelas tanto infla quanto esconde essa diferença.
   - **Correção exigida:** repetir `npm run carga:ingestao` e `npm run carga:ingestao:controle-negativo` com a máquina calma (load abaixo de ~2 e `docker ps` vazio, os dois anotados ao lado dos números) e trocar a tabela da corrida. Eu não rodei a carga, como manda o processo.

**Recomendações:**
- **Texto da divergência da adaptação** (`9_task.md:117`). Ele diz que "o `FerramentasService.gerar` faz [a recusa] para as três ferramentas", mas `TAREFA_DA_FERRAMENTA` (`ferramentas.service.ts:32`) só tem `atividade_objetiva` e `plano_de_aula`. A adaptação passa por `ArtefatoService.adaptar` e não tem recusa antes do `202`. A conclusão continua certa, porque a adaptação não lê trecho e por isso não cita material. Falta corrigir o motivo, ou decidir se ela deve recusar.
- **Tetos de envio.** Os novos valores (100, 300 e 300) não têm teste que os prenda aos números do §7c: os testes importam as constantes, e voltar para 30, 60 e 3 deixaria tudo verde. Um teste que fixe os valores, como `carga-ingestao.test.ts:67` faz com 500, 1.500, 2 e 300, resolve.
- **Mutação do `vigenteDesde`.** O bloco do `lte` troca por `gt` em vez de `lt`, que seria a fronteira. O caso "a licença que só começa amanhã" mataria o `lt` também; vale declarar a mutação de fronteira.
- **Erro no lado da professora.** O `SEM_MATERIAL_DA_SERIE` não tem teste de tela: a mensagem "Peça à coordenação o material desta série." não é conferida em lugar nenhum.
- **E2e do estado.** `e2e/aluno-tutor.spec.ts` usa a API simulada. Isso basta para a tela, porque o servidor está coberto na integração, mas o e2e não prova o `422` real.
- **Intermitente.** O caso "com os sinais suspensos…" de `tutor.int.test.ts`, registrado no documento, precisa de uma correção própria com dono.

Arquivos que li:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/9_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/leitura-por-serie.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/leitura-por-serie.fixture.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/trecho-search.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/tutor/tutor.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/infra/test/carga-ingestao.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/docs/runbook.md

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-13 21:25:37 · `tasks/prd-ingestao-do-material/9_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nem migration nesta tarefa. Conferi de novo, só para leitura, `material`, `material_serie` e `licenca_de_material`, nos filtros de `apps/api/src/material/material.repository.ts:141-170`. O banco não tem RLS, então o escopo vem só das cláusulas do repository.

Queries verificadas:
- O código de produção não mudou desde a rodada 1. No repository, só entraram os docblocks de defesa em profundidade (`material.repository.ts:143-144` e `:158-159`). Em `metrics.ts`, só mudou o docblock.
- `declaradoParaASerie` e `proprioOuComLicencaVigente` continuam tirando a escola de `requireEscolaId()`. O mesmo vale para `existeMaterialDaSerie` (`:447-459`), com `eq(material.escolaId, requireEscolaId())` e mais os dois fragmentos.
- A consulta `psql` do runbook (`docs/runbook.md`, "Turma sem material da série") agora junta as tabelas pela escola e filtra por `m.escola_id`.
- Nos testes, o helper `retomar` de `tutor.int.test.ts`, `artefato.int.test.ts` e `assistente.int.test.ts` continua filtrando por `escola_id`. A fixture `deDemonstracao` grava tudo com o `escolaId` da escola do cenário, e o texto que ela usa é sintético.
- `infra/k6/ingestao.js`, `infra/scripts/carga-ingestao.ts` e `infra/scripts/conferir-carga-ingestao.ts`: só trocaram para o relógio monotônico. O SQL da conferência continua filtrado por escola.
- Nenhum `@Unscoped()` novo. A camada de rede não foi tocada.

Teste de isolamento: presente e efetivo.
- Minhas duas recomendações da rodada 1 foram aplicadas.
- O caso novo em `apps/api/test/leitura-por-serie.int.test.ts:530` monta a consulta sem `eq(material.escolaId, …)` e chama cada fragmento sozinho, no contexto da escola A, sobre um material da B.
  - Sem o corte de dentro de `declaradoParaASerie`, a linha de `material_serie` da B casa e o teste quebra.
  - Sem o corte de `proprioOuComLicencaVigente`, a licença vigente da B satisfaz o `exists`, e o `ne(titularidade)` é falso para material de terceiro, então o teste quebra.
  - O controle positivo na escola B casa nos dois casos.
- O pedido com a disciplina e a série da B no contexto da A (`:522-525`) também está presente.

Bloqueantes: nenhum

Recomendações:
- `apps/api/src/material/material.repository.ts:453`: o `eq(material.escolaId, requireEscolaId())` de `existeMaterialDaSerie` continua sem prova isolada. Se ele for retirado, o corte de dentro de `declaradoParaASerie` segura o resultado. Isso está declarado no `9_task.md` como defesa em profundidade e não bloqueia. Se quiserem um bloco de mutação próprio, um caso que chame a consulta com uma série sem material na A e a disciplina da B não serviria; o caminho é aceitar o cinto e suspensório como está escrito.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-13 21:25:49 · `tasks/prd-ingestao-do-material/9_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

A correção exigida na 1ª rodada foi feita pelo caminho (b), nos três documentos:
- **`techspec.md:122`** ("Como ficou na 9.0"): diz que a adaptação (`POST /v1/artefatos/:id/adaptar`) não passa pelo `gerar`, não lê material e não é recusada por `SEM_MATERIAL_DA_SERIE`. Diz também que só a atividade, o plano e o chat recusam.
- **`cenarios.md:135-136`**: a adaptação saiu da lista dos que recusam, e o texto remete à Tech Spec.
- **`9_task.md:117`**: o motivo agora bate com o código. O `gerar` só atende `atividade_objetiva` e `plano_de_aula` (`TAREFA_DA_FERRAMENTA`). O `ArtefatoService.adaptar` (`artefato.service.ts:119`) parte do artefato e não chama `TrechoSearch.buscar`. A linha 42 da tabela de testes não lista mais a adaptação.

Recomendações:
1. **Os destinos "TODO.md" ainda não foram escritos.** A tabela "Recomendações sem aplicar" (`9_task.md:620` em diante) manda sete itens para o `TODO.md`, e o `TODO.md` não mudou na árvore. O modelo de tarefa (`.claude/skills/criar-tasks/task-template.md:192-194`) pede a linha "já escrita no `TODO.md`, no commit da tarefa, e não promessa". A 8.0 também commitou sem escrever. Não reprovo por isso, mas o Orquestrador precisa escrever essas linhas antes do pouso, ou elas se perdem.
2. **A adaptação continua citando material com licença vencida.** A versão adaptada herda as citações do artefato original. Se a licença venceu, nasce uma entrega nova para o aluno com conteúdo de material que a escola não pode mais usar (D5). A decisão está escrita e não é silenciosa, mas vale levar à retro e à AIA. A pergunta é se "não pode parar porque a licença venceu depois" se sustenta contra a D5.
3. **O helper `retomar` com `now()` ficou igual em mais quatro lugares:** `apps/api/src/entrega/entrega.int.test.ts:398`, `apps/api/src/ia/ia.int.test.ts:339` e `:685`, e `apps/api/src/atividade/atividade.int.test.ts:531`. Têm a mesma intermitência que a tarefa consertou em três arquivos. A correção própria que o documento promete precisa pegar esses quatro.
4. **Texto:** em `9_task.md:42` há um " ; e" com espaço antes do ponto e vírgula.

Arquivos conferidos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/9_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/artefato/artefato.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/.processo/ordens/9_task-diff-r1-r2.patch
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/infra/k6/ingestao.js
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/infra/scripts/carga-ingestao.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/infra/scripts/conferir-carga-ingestao.ts

## frontend-reviewer · 2ª rodada · APROVADO · 2026-11-13 21:25:52 · `tasks/prd-ingestao-do-material/9_task.md`

VEREDITO: APROVADO
Tela vista: sim (4 fotos do Tutor lidas, no computador e no celular, escola cheia e vazia; as de início e atividades não foram abertas porque `apps/web` e `e2e/` não mudaram desde a rodada 1)
Estados: ok. Com dado e vazio estão nas fotos. O estado "sem material", o carregando e o erro não saem na vitrine. Esses vêm da rodada 1, não mudaram desde então e continuam cobertos por `e2e/aluno-tutor.spec.ts` e `apps/web/src/areas/aluno/tutor.test.ts`. O estado vazio convida em vez de se desculpar: "Nenhuma atividade para pedir ajuda agora… Quando houver uma, ela aparece aqui."
Acessibilidade: sem mudança desde a rodada 1. Nas fotos, o aviso "Quem dá a aula acompanha como você usa o Tutor." está à vista (D8), o foco e a navegação são os do shell, e não há rótulo em inglês nem id técnico.
Chromebook fraco: sem mudança na web. A mudança de carga (`infra/k6/ingestao.js`, `infra/scripts/carga-ingestao.ts`, `conferir-carga-ingestao.ts`) troca o relógio de parede pelo monotônico. É medidor, não tela. A corrida refeita, com load de 0,94 e 0,93, passou nos critérios registrados.
Celular: a 360 px não há rolagem horizontal nem conteúdo cortado. O cartão do estado vazio quebra o título em duas linhas sem estourar. A barra inferior tem as três abas à vista. "SAIR" no topo e os cartões de atividade têm altura confortável. A lista `Rolam a 1366 × 768` é "nenhuma".
Ação oficial protegida: sim. Nada oficial mudou. O diff não toca nota, aprovação nem publicação.

Diff da rodada 1 até agora, conferido:
- **Testes e helpers de API:** os três helpers `retomar` usam `greatest(now(), suspensa_em)`. É correção de intermitência de teste, sem efeito em tela.
- **Isolamento por escola:** o novo caso de isolamento chama os dois helpers do filtro sozinhos, no contexto da escola A, sobre o material da B. O caso do material de Química do 2º e do 9º tem uma mutação por chamador.
- **Tetos de envio:** `apps/api/test/material-tetos-de-envio.test.ts` fixa os tetos em 100, 300 e 300.
- **Runbook:** `docs/runbook.md` agora diz que o gráfico conta só o Tutor e que a correção do material sem série é reenviar o arquivo. O texto que o usuário final vê não mudou.
- **Mensagens e interface:** `packages/shared/src/errors/messages.ts` e `docs/interface.md` não entraram no diff desta rodada.

Bloqueantes: nenhum.
Recomendações:
- As recomendações da rodada 1 seguem registradas em `tasks/prd-ingestao-do-material/achados/9_task.md` e na tabela "Recomendações sem aplicar" do `9_task.md`. As que valem para a validação são ampliar o "Avise seu professor." e a mensagem do professor "Peça à coordenação o material desta série.", que não diz a série.
- O estado "sem material" não tem foto. Na validação, conferir a tela uma vez com a pergunta recusada de verdade, a 360 px e a 1366 px.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-13 21:25:56 · `tasks/prd-ingestao-do-material/9_task.md`

VEREDITO: APROVADO

Esta é a 2ª rodada. Auditei o diff r1→r2 (`.processo/ordens/9_task-diff-r1-r2.patch`), os três arquivos da carga que passaram a usar o relógio monotônico e o que a ordem toca na adaptação. A minha 1ª rodada não exigiu nenhuma correção, então não havia correção a conferir.

**Caminhos de escrita em Nota:** nenhum novo. O diff só toca:
- os helpers de teste (`retomar` com `greatest(now(), suspensa_em)`);
- os docblocks de `material.repository.ts`;
- a fixture `deDemonstracao`;
- dois casos novos em `leitura-por-serie.int.test.ts` e o teste dos tetos de envio;
- o runbook, o docblock da métrica e os documentos da tarefa;
- o k6 e os scripts da carga.

Nada grava em `Nota` nem mexe em `lancadaPor`. Todos com autor humano? Sim, porque não há caminho novo.

**Decisão autônoma sobre aluno:** ausente. O caso novo da química do 2º e do 9º só confere qual material cada chamador cita. O docblock de `tutor.recusa_sem_material` (`packages/core/src/telemetry/metrics.ts`) diz que a contagem inclui a recusa depois do `202`, e o único rótulo continua sendo `turma_id`.

**Aprovação registrada:** ok. Conferi o que ficou escrito sobre a adaptação na divergência 1 (`tasks/prd-ingestao-do-material/9_task.md:117`), em `techspec.md` §5 e em `cenarios.md:135`. Deixar a adaptação fora da recusa `SEM_MATERIAL_DA_SERIE` não mexe na aprovação dela:
- A adaptação continua nascendo como entrega `pendente`, na mesma transação da versão (`apps/api/src/artefato/artefato.service.ts:148-150`).
- O PDF sai limpo só com a entrega `aprovada`; a `pendente` sai marcada como rascunho e a rejeitada não sai (`artefato.service.ts:111-112`).
- Os três documentos falam só da recusa por falta de material, não do caminho de aprovação. Nenhum deles cria exceção ao item 3.
- A exceção do tutor (D47) não aparece em outro agente.

**Supervisão do tutor:** ok. O caso novo prova que o Tutor do 9º cita só o material do 9º, com a página aberta e também sem ela. A D36 continua antes do filtro, e nenhum uso do tutor ficou invisível ao professor. O `apps/web` não mudou: as fotos da 1ª rodada continuam valendo, com o aviso "Quem dá a aula acompanha como você usa o Tutor.", o selo IA e nenhuma nota nem sugestão de nota em `/aluno/atividades`.

**Autonomia declarada e visível:** sim. Nada mudou nesta rodada.

**Os outros itens:**
- **Vigilância (item 7):** a carga só mede latência de turno sintético. O relógio monotônico não mede nada do aluno.
- **D55:** nada novo em discursiva ou redação.
- **D45 e D64:** nenhuma métrica de professor foi criada.

**Bloqueantes:** nenhum.

**Recomendações:**
1. `tasks/prd-ingestao-do-material/9_task.md:117` diz que a adaptação "não cita material". Não está exato: a versão adaptada carrega as citações do original, e `exigirAdaptacaoFiel` (`artefato.service.ts:147`) confere que elas são as mesmas. Por isso a adaptação de uma atividade cujo material de terceiro teve a licença vencida pode gerar uma versão nova citando esse material. Isso é questão da D5 (licença), não da regra 70: a versão nasce pendente e passa pela professora. Vale corrigir a frase para "não lê material novo; herda as citações do original" e registrar a questão da licença para o `revisor-geral` ou a validação.
2. Na mesma linha, "a adaptação de necessidade específica" pode ser lida como diagnóstico. A D35 fala em adaptação registrada, nunca em diagnóstico. "Adaptação de acessibilidade" ou "adaptação registrada" evita a leitura errada. É só texto.
3. As recomendações da 1ª rodada foram registradas em "Recomendações sem aplicar" com destino: rodar `ehAssuntoDelicado` de novo antes de falhar a conferência depois do `202` foi para o TODO.md e a AIA do Tutor; o indicador por turma ficou para produto; a mensagem que não diz qual série foi para o TODO.md. Os destinos estão adequados. A primeira delas precisa mesmo entrar na AIA do Tutor antes do piloto.

Arquivos conferidos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/.processo/ordens/9_task-diff-r1-r2.patch
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/artefato/artefato.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/9_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/telemetry/metrics.ts

## infra-guardian · 2ª rodada · APROVADO · 2026-11-13 21:26:06 · `tasks/prd-ingestao-do-material/9_task.md`

VEREDITO: APROVADO
Caminho quente tocado: tutor | IA | fila
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: ok
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum

Nesta rodada li só o diff desde a rodada 1. A 1ª rodada do infra-guardian não exigiu correção, e o diff não toca código do caminho quente. Em `material.repository.ts` e `metrics.ts` mudaram só comentários. O resto são testes, fixture, runbook, spec e o medidor da carga.

**A medição nova da [C] mede o que o critério pede.** O critério do turno é o p95 da B com a ingestão até 500 ms acima da base. Quem decide é `julgarTurnoDaB` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/infra/scripts/conferir-carga-ingestao.ts:120-131`). Ele lê o p95 do banco (`criada_em` a `concluida_em`), em janelas abertas e fechadas por `agoraDoBanco` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/infra/scripts/carga-ingestao.ts:236-259`). A troca de relógio não alcança esse cálculo.
- **No k6** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/infra/k6/ingestao.js:81-110`): `exec.instance.currentTestRunDuration` é monotônico, em milissegundos, e começa no início do teste. A diferença entre dois pontos da mesma iteração dá o turno como o aluno o espera, do `POST` até ler `concluida`. O threshold compara esse turno com o p95 da base medido no banco mais 500 ms. É mais conservador que o critério, porque inclui o polling de 100 ms. Na corrida deu 439,5 ms contra o limite de 826 ms.
- **No driver**: `performance.now()` só controla o prazo de espera das extrações e a duração impressa. A data do relatório continua em `new Date()`, como deve.

**A corrida nova vale como registro.** O load de 1 minuto ficou em 0,94 e 0,93, e o `docker ps` estava vazio nos dois começos. Todos os critérios passaram. O controle negativo reprova pelo motivo certo: o PDF da B esperou 218 extrações da A.

O resto do diff não pede ação de infra:
- O caso "2º e 9º na mesma escola" e o dos helpers com corte por escola usam o `FakeAdapter`, sem chamar provedor pago.
- O teste dos tetos prende 100, 300 e 300 ao §7c.
- A consulta do runbook agora filtra por `escola_id`.
- O `greatest(now(), suspensa_em)` só muda helpers de teste.

Recomendações:
1. O veredito da [C] ainda depende do relógio de parede do banco: `criada_em`, `concluida_em` e as janelas de `agoraDoBanco` vêm de `now()`, em transações separadas. A corrida só ficou limpa porque o `systemd-timesyncd` foi parado. É uma correção na máquina, não no código. Se o relógio voltar a pular, o p95 do banco se desloca sem nenhum sinal. Vale fazer `lerTurnoDaBNaJanela` reprovar a corrida quando algum turno no banco tiver duração negativa, ou acima de `PRAZO_DO_TURNO_MS`, e registrar no runbook ("Quando a carga vale como registro") que o `timesyncd` precisa estar parado no WSL.
2. A deriva de cerca de 3,5% do relógio monotônico do WSL infla o turno medido pelo k6 na mesma proporção, uns 15 ms no p95. É desprezível diante do limite, mas vale uma linha na seção da carga dizendo que a conta de 3,5% é em cima do turno e não da margem.
3. Continuam valendo as recomendações 1, 3 e 4 da rodada 1, já encaminhadas em "Recomendações sem aplicar":
   - o reenvio com a mesma `chaveEnvio`;
   - o PDF de 20 MB na validação;
   - a leitura dupla de `existeMaterialDaSerie` por turno.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-13 21:26:19 · `tasks/prd-ingestao-do-material/9_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. Desde a 1ª rodada não entrou coluna, DTO nem saída nova. No código de produção, a rodada 2 mexeu só em docblocks: `apps/api/src/material/material.repository.ts:143-144` e `:158-159`, e `packages/core/src/telemetry/metrics.ts` (o docblock de `tutor.recusa_sem_material`, que continua com o rótulo `turma_id` e nada mais). O resto do diff é teste, documento e script de carga.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok.
- O caminho de produção não mudou desde a rodada aprovada.
- O caso novo `os dois helpers do filtro carregam o corte por escola` (`apps/api/test/leitura-por-serie.int.test.ts`) passa a provar sozinhos os cortes `requireEscolaId()` de `declaradoParaASerie` e `proprioOuComLicencaVigente`, cada um com uma mutação declarada.
- O caso `com material de Química do 2º e do 9º na mesma escola` prova que a turma do 9º só cita o `materialId` do 9º na atividade, no plano, no chat e no Tutor, com e sem página aberta. Isso fecha o risco de RF7 de um material de outra série chegar ao aluno.

Logs: limpos.
- Não entrou log novo.
- `infra/scripts/carga-ingestao.ts` só escreve contagens, status, p95 e duração (`:240`, `:249`, `:283`). Nenhum token sai nessa saída.
- A troca para o relógio monotônico (`infra/k6/ingestao.js:81-83`, `:96`, `:103`, `:110`; `infra/scripts/carga-ingestao.ts:302-303`, `:319`; `infra/scripts/conferir-carga-ingestao.ts:206`, `:210`) só muda a forma de medir o tempo e não toca dado.

Auditoria: nenhuma ação desta tarefa exige registro. Não há leitura de dado de aluno por coordenação ou rede, nem exportação, nota, permissão ou aprovação de saída de IA.

Envio externo: nada mudou. A forma e a quantidade do que vai ao modelo são as mesmas da rodada 1, agora com prova de que só vai trecho do material da série da turma. Os testes usam só o `FakeAdapter`. O registro em `ExecucaoAgente` também não mudou.

Seed/fixture: sintético.
- A opção nova `deDemonstracao` de `apps/api/test/leitura-por-serie.fixture.ts` grava o texto de `tools/demonstracao/conteudo-estequiometria.ts`. Esse texto foi escrito pela própria equipe e declara no arquivo (`:4-6`, `:59`) que não traz nome de pessoa, escola nem editora.
- O teste novo `apps/api/test/material-tetos-de-envio.test.ts` só confere constantes.
- A carga continua com sessão sintética e a pergunta fixa "Pergunta sintética de carga…".

Fotos da tela: o `apps/web` não mudou. Abri de novo `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/.processo/vitrine/aluno--aluno-tutor--computador.png` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/.processo/vitrine/vazia--aluno--aluno-tutor--celular.png`. Nelas aparecem só o nome do próprio aluno, que é sintético ("Aluno Sintético Caio 59d63a49"), o nome da escola sintética e os títulos de atividades sintéticas. Não aparece dado de outra pessoa nem código de erro.

Conferência das minhas recomendações da 1ª rodada:
1. O `psql` do runbook agora junta as tabelas pela escola e filtra por `m.escola_id = '<escolaId>'` (`docs/runbook.md`, seção "Turma sem material da série"). Feita.
2. O comentário que proíbe reaproveitar a pasta `0o777` entrou em `infra/scripts/carga-ingestao.ts:298`, citando a regra 20, itens 7 e 17. Feita.
3. O risco de uma turma pequena, cruzada com o horário, apontar quem perguntou foi para o `TODO.md` e para a AIA do Tutor, na tabela "Recomendações sem aplicar" do `9_task.md`. Destino aceitável.

Bloqueantes: nenhum.

Recomendações:
- A tabela "Recomendações sem aplicar" do `9_task.md` manda várias recomendações para o `TODO.md`, entre elas o risco da turma pequena para a AIA do Tutor. Não conferi se essas linhas já estão escritas no `TODO.md`. Convém conferir no fechamento da tarefa, para não ficarem só no texto dela.

Pergunta de fechamento: nada mudou. A tarefa não cria dado novo sobre o aluno, a recusa não grava nada que seja dele, e o envio externo continua registrado onde já estava.

Arquivos conferidos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/.processo/ordens/9_task-diff-r1-r2.patch
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/infra/k6/ingestao.js
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/infra/scripts/carga-ingestao.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/infra/scripts/conferir-carga-ingestao.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/leitura-por-serie.fixture.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tools/demonstracao/conteudo-estequiometria.ts

## test-engineer · 2ª rodada · APROVADO · 2026-11-13 21:27:53 · `tasks/prd-ingestao-do-material/9_task.md`

VEREDITO: APROVADO

Cenários exigidos: os 14 da 1ª rodada (caminho feliz por chamador; série errada; material do 2º e do 9º na mesma disciplina; licença no dia de São Paulo; sem material válido antes do `202`; D36 antes do filtro; `[P]` com ordem forçada; modo livre; virada do ano; permissão; isolamento; contagem por turma; estado do aluno; carga [C] com controle negativo). Nesta rodada conferi as duas correções exigidas e o que o diff r1→r2 afeta.

Cobertos:
- **Correção 1 feita.** O caso "com material de Química do 2º e do 9º na mesma escola, a turma do 9º só cita o do 9º: atividade, plano, chat e Tutor" está em `apps/api/test/leitura-por-serie.int.test.ts:184-218`. Ele pede atividade, plano, chat e dois turnos do Tutor (com e sem página aberta) e exige que toda citação seja o `materialId` do 9º, com pelo menos uma. O controle (o chat do 2º cita só o do 2º) prova que o material do 2º casa com a mesma palavra. O caso pegaria o vazamento de verdade, por três motivos:
  - os dois materiais têm o mesmo texto, pois `textoDaPagina` é o que o PDF da demonstração extrai;
  - o desempate da busca é `asc(trecho.materialId)` (`material.repository.ts:412`), e o id é `uuidv7()`. O material do 2º nasce antes e venceria todo empate se a série saísse do filtro;
  - os limites (12 na ferramenta, 6 no chat e no turno) cabem as páginas dos dois.
  
  O bloco de `trecho-search.ts` que tira o `serieId` da porta (9_task.md:294-299) é a forma "honesta" da mutação e cai nesse caso. Os blocos de `ferramentas.service.ts`, `assistente.service.ts` e `tutor.service.ts:316` citam o caso.
- **Correção 2 feita.** A tabela "A corrida da carga" traz a corrida nova com load de 1 minuto de 0,94 e 0,93 e `docker ps` vazio nos dois começos. A corrida passa, e o controle negativo reprova pelo motivo certo: o PDF da B esperou 8.698 ms, atrás de 218 extrações. A troca para relógio monotônico está certa:
  - `exec.instance.currentTestRunDuration` no k6 é tempo decorrido, medido com o relógio monotônico do Go;
  - `performance.now()` no driver e no conferidor.
- **Isolamento dos fragmentos.** O caso "os dois helpers do filtro carregam o corte por escola" (`:530-545`) monta cada fragmento dentro do contexto da A, sem o `eq(material.escolaId…)` de fora, sobre o material da B, com o controle na B. Isso tira o vermelho das duas mutações novas de `requireEscolaId()` dos helpers. Também entrou a busca e o `existeMaterialDaSerie` com a disciplina **e** a série da B lidas na A (`:523-525`).
- **Tetos de envio presos aos números.** `apps/api/test/material-tetos-de-envio.test.ts` prende 100, 300 e 300, com os três blocos de mutação.
- **A rodada local passou.** `leitura-por-serie.int.test.ts` passou 27 de 27 numa rodada, e `material-tetos-de-envio.test.ts` passou 1 de 1. Não há `.skip`, e a IA continua só no `FakeAdapter`.

Bloqueantes: nenhum.

Recomendações:
1. **O bloco de `tutor.service.ts:322` cita um caso que não chega à cláusula.** O bloco está em `9_task.md:404-409` e tira o `serieId` de `doMaterial`. A página aberta só chega ali depois de `materialDaTurma` (`:282`), na mesma requisição e no `entrada`, e esse filtro já exige o material declarado para a série. Por isso nenhum cenário consegue observar a falta desse `serieId`: o vermelho vem só do `TypeError` de `serieId.toLowerCase()` em `trecho-search.ts:93`. A regra (página aberta só da série) está provada pelo `NAO_ENCONTRADO` de `:165`. Esta cláusula é defesa em profundidade e cabe em "Cláusulas sem bloco", com esse motivo, como já foi feito com o corte por escola de `existeMaterialDaSerie`. A culpa é da minha correção da 1ª rodada, que pediu que os quatro blocos citassem o caso novo; não bloqueia.
2. **Escrever no documento por que os outros três blocos ainda ficam vermelhos por `TypeError`.** Os blocos de `ferramentas.service.ts:119`, `assistente.service.ts:118` e `tutor.service.ts:316` continuam vermelhos por `TypeError`, porque a porta exige `serieId`. Hoje quem impede tirar a série do chamador é o typecheck. O caso novo cobre a forma real do vazamento, a série opcional na porta, e quem prova isso é o bloco de `trecho-search.ts:297`. Uma frase em "Mutações" basta.
3. **Prender a premissa do caso novo dentro do próprio caso.** O caso depende de o material do 2º empatar com o do 9º, ou vencê-lo, na relevância. Uma asserção prévia pela rota `GET /v1/materiais/busca` sem `serieId`, com o 2º presente entre os primeiros, impediria que uma mudança no texto de demonstração ou no ranking deixasse o caso verde sem provar nada.
4. **O prazo de `aguardarExtracoesDaA` não tem teste** (`infra/scripts/conferir-carga-ingestao.ts:205`). O prazo agora usa `performance.now()`. É ferramenta de medição, e já não tinha teste antes desta tarefa.

Arquivos que li:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/.processo/ordens/9_task-diff-r1-r2.patch
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/leitura-por-serie.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/leitura-por-serie.fixture.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/tutor/tutor.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/trecho-search.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/material.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/material-tetos-de-envio.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/9_task.md
