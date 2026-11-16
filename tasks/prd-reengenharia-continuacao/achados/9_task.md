# Achados das revisões — `tasks/prd-reengenharia-continuacao/9_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-16 16:20:31 · `tasks/prd-reengenharia-continuacao/9_task.md`

VEREDITO: APROVADO
Tela vista: sim (4 fotos lidas: painel "O que o Tutor viu" a 1366 e a 360 px, na escola cheia e na vazia). Não fotografei a tela rolada até a linha do Caio no celular.
Estados: ok. Só o corpo do painel foi conferido.
- Com dado: a linha do aluno traz "2 perguntas que o Tutor não respondeu hoje" abaixo do "1 de 60" (foto cheia, computador). Na linha da Lia, que tem zero, não aparece frase nenhuma.
- Vazio: convida, com "Nenhum aluno desta turma usou o Tutor ainda. Quando um aluno conversar com o Tutor, ele aparece aqui…". Está nas duas larguras.
- Carregando e erro: o código desta tarefa não mexeu neles, e eles não aparecem na vitrine.

Acessibilidade: ok.
- A tabela rolável é uma região com `tabIndex` e rótulo (`Table.tsx:85`).
- O aviso é um `span` de texto, sem cor como única informação. Usa `text-sutil`, o token de texto de apoio que a tela já usa.
- O botão Fechar tem 44 px, e o e2e confere isso (`e2e/support/professor/tutor.ts`).

Chromebook fraco: sem impacto.
- A lista já tem teto de 200 alunos (`MAXIMO_DE_ALUNOS_NO_USO`).
- A contagem nova é uma consulta agrupada por turma e por dia, e `supervisao.service.ts` a chama uma vez por leitura, sem consulta por aluno.

Celular:
- Em 360 px não há rolagem horizontal. A tabela vira cartões, e `Table.tsx:74` renderiza `coluna.celula(linha)`, então o `ReactNode` novo segue no cartão.
- O e2e `conferirAPerguntaSemResposta` roda nos dois projetos. Ele confere largura excedente zero e o botão Fechar com 44 px.
- A linha do Caio no celular foi a única que a foto não mostrou, porque o cartão está cortado pela rolagem interna do painel. O código e o e2e a cobrem.

Ação oficial protegida: sim. A tela só informa e não tem ação oficial. Não aparece texto da pergunta nem o código do erro (`supervisao.repository.ts`, consulta de contagem), e nenhum link leva à conversa do aluno. O aviso fala do Tutor, não do aluno, e não entra no freio do dia.

Bloqueantes: nenhum.
- Rolam a 1366 × 768: nenhuma.
- Português do Brasil, com singular e plural (`sinais.ts`, `perguntasSemResposta`). Sem termo técnico, id ou inglês na tela.
- `docs/interface.md` foi atualizado junto com a tela.

Recomendações:
- A 1366 px o painel tem uns 450 px de largura e a tabela de 4 colunas rola na horizontal, cortando "Em que estava". Já era assim antes da tarefa. A frase nova quebra em cinco linhas na célula estreita ("2 perguntas / que o Tutor / não / respondeu / hoje") e deixa a linha do Caio alta (foto cheia, computador, `TurmaHoje.tsx:315-319`). Vale reduzir as colunas, ou deixar a frase com largura mínima, na próxima passada de tela.
- O teste da rodada seguinte pode sem custo fotografar o celular rolado até o cartão do Caio, para a vitrine registrar a linha nova também em 360 px.
- `sinais.test.ts`: o `import` de `perguntasSemResposta` está fora da ordem alfabética dos outros. É só cosmético.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-16 16:20:33 · `tasks/prd-reengenharia-continuacao/9_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova e nenhuma migration. A tarefa só lê tabelas que já existiam: `mensagem_tutor`, `execucao_agente` (inclusive pelo alias `resposta_fixa_do_turno`), `vinculo`, `usuario`, `atividade_aplicada`, `artefato` e `material`. Todas têm `escolaId`. `mensagem_tutor` e `vinculo` têm também `anoLetivoId`.

Queries verificadas:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/tutor/supervisao.repository.ts`
  - `semRespostaDeHoje` (334-352): filtra `escolaId` e `anoLetivoId` pelo `#escopo()`, que vem do contexto autenticado (`requireEscolaId`, `requireAnoEmCurso`), e também por `turmaId`, `alunoId` e `autor`. Aplica ainda o recorte do professor.
  - `#semResposta` (221-231): as duas subconsultas se amarram a `mensagemTutor.escolaId` e `execucaoId` da própria linha, e a linha já está presa à escola do contexto.
  - `#recorteDoProfessor` (238-242): o vínculo é procurado na escola, no ano e na turma da linha, com o `usuarioId` da sessão.
  - `ultimasTrocas` (254-295): mantém o escopo de escola e ano nas duas partes da consulta.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/tutor/supervisao.service.ts:132-151`: a turma passa por `#turmaDoProfessor` antes de qualquer leitura. A lista de alunos sai do repository, não do cliente.
- A rota `GET /v1/tutor/uso` só aceita `turmaId`. Nada chega por `escolaId` no corpo nem na query.
- `@Unscoped()`: não aparece.
- Ids: todos UUID.
- Camada de rede: não lê nada disso. A permissão `uso_do_tutor` não mudou e só o professor da turma lê.
- O DTO devolve só o número `semRespostaHoje`, sem texto da pergunta, código de erro ou execução. O schema é estrito e os testes de contrato e o `contracts.test.ts` cobrem isso.

Teste de isolamento: presente e efetivo. Está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/tutor/sem-resposta.int.test.ts:737-759`.
- Contra o mesmo endpoint, a turma da escola B e um id inexistente devolvem a mesma resposta: o mesmo 404 `NAO_ENCONTRADO` e o mesmo corpo, tirando o `requisicaoId`.
- O caso `contagem({ ...b, escolaId: a.escolaId }, b.professora)` usa o ano da B e a professora da B, e só a escola do contexto é a da A. Tirando mentalmente `eq(mensagemTutor.escolaId, escolaId)` de `semRespostaDeHoje`, a leitura acharia a pergunta da B: o vínculo da professora B na escola da linha casa, e o ano e a turma também. O tamanho do resultado iria a 1 e o teste quebraria.
- O teste positivo `daB.get(...) === 1` prova que o caso é real.
- As linhas 721-733 cobrem o ano anterior e as linhas 667-719 cobrem disciplina e transferência.

Bloqueantes: nenhum.

Recomendações:
- `sem-resposta.int.test.ts:737`: dá para mostrar também que a cortada da B não traz o aluno da B para `ultimasTrocas`. Basta conferir que `linhaDe(await usoPara(a.professora, a.turma), deB)` vem `undefined`. Hoje esse caminho só está coberto pelo 404 da rota e pelo escopo que já existia.
- `supervisao.repository.ts:225` e `:229`: as subconsultas se amarram à escola da linha (`mensagemTutor.escolaId`), e não ao `escolaId` do contexto. Está correto porque a consulta de fora já filtra pela escola. Vale um comentário de uma linha dizendo que `#semResposta()` só pode ser usado dentro de uma consulta já escopada, para ninguém reaproveitá-lo solto.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-16 16:20:52 · `tasks/prd-reengenharia-continuacao/9_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo no banco. O `GET /v1/tutor/uso` ganha `semRespostaHoje`: um inteiro por aluno, lido de `mensagem_tutor` e da `execucao_agente` dela. Ele não traz o texto da pergunta, o código do erro nem o id da execução (`packages/shared/src/tutor/uso.ts`, `strictObject` com `.int().nonnegative()`). Além disso, `ultimasTrocas` agora inclui a pergunta cortada. Com isso, o aluno cuja única pergunta ficou sem resposta aparece com nome, hora e referência (atividade e questão, ou material e página). São os mesmos campos que já saíam para a troca respondida, e a professora vinculada à turma já tinha acesso a eles (D34).

Fora da tabela de dados do docs/lgpd.md: nada. A linha "Uso do Tutor por aluno" (`docs/lgpd.md:52`) foi atualizada na própria tarefa. Ela diz que a leitura vem da conversa e da execução, que sai só o número, sem texto nem código, e que a retenção segue os 12 meses da conversa.

Autorização por objeto: ok. A rota não mudou: continua com `@RequirePermissao('uso_do_tutor', 'ler')` (`apps/api/src/tutor/tutor.controller.ts:54`) e com a turma do professor conferida em `#turmaDoProfessor` antes de qualquer leitura. `semRespostaDeHoje` (`apps/api/src/tutor/supervisao.repository.ts:97-117`) aplica escola e ano do contexto, mais turma, alunos e `#recorteDoProfessor`. O teste de isolamento (`apps/api/src/tutor/sem-resposta.int.test.ts:411-433`) faz o seguinte:
- usa ids todos da escola B no contexto da A;
- testa também o contexto com a escola da A e o ano e a professora da B;
- confirma que o `GET` da turma de B devolve 404 com corpo igual ao do id inexistente.

A coordenação e o aluno continuam recebendo a resposta do inexistente, pelo caso que já existia em `tutor.int.test.ts` (l.887). A rede não alcança o dado: a matriz não mudou e a rota é só do professor.

Logs: limpos. O diff não acrescenta nenhuma chamada de log.

Auditoria: não se aplica. É leitura do professor da própria turma, e a regra 20, item 10 exige auditoria na leitura por coordenação ou rede, não nesta.

Envio externo: nenhum novo. A tarefa só lê o resultado de execuções que já existiam, e nada vai a provedor.

Seed/fixture: sintético. Os nomes são "Ana Sintética Com Corte", "Aluno Sintético …" e as perguntas, "não entendi o que é reagente limitante" e "Pergunta sintética sem resposta" (`e2e/support/db-assertions.ts:499-517`). As fotos são do banco de teste sintético, com a semeadura que a própria Mesa fez.

Fotos da tela:
- `professora--…--computador.png`: a linha do Caio diz "2 perguntas que o Tutor não respondeu hoje", abaixo do "1 de 60". Não aparece texto de pergunta nem motivo do corte, e a Lia, com zero, não mostra nada. O nome aparece só no painel `?ver=tutor` da professora da turma, como a D34 permite. A linha vem de `apps/web/src/areas/professor/turmas/TurmaHoje.tsx:294-302` e `sinais.ts:359-363`.
- `professora--…--celular.png`: a foto corta no cartão do Caio, então a linha não aparece. Não há dado a mais visível. O enquadramento é assunto do `frontend-reviewer`.
- `vazia--…` (computador e celular): mostra o vazio "Nenhum aluno desta turma usou o Tutor ainda", sem dado de pessoa.

Pergunta de fechamento: o código responde. O número é derivado de `mensagem_tutor` e `execucao_agente`, que já estão no mapa de dados e no arquivo do titular. Não há dado novo guardado nem envio novo a terceiro.

Bloqueantes: nenhum.

Recomendações:
- `docs/interface.md:428` e a N21 em `docs/aia/tutor.md` citam "X6 9.0" no texto que descreve o comportamento. A autoconferência (item 7) promete não escrever "é a tarefa 9.0"; vale tirar a referência à tarefa para o texto não envelhecer.
- O teste de papel (coordenação e aluno recebem o inexistente) ficou só em `tutor.int.test.ts` (l.887). Um caso curto em `sem-resposta.int.test.ts` com a coordenação deixaria a prova do campo novo junto do resto. Não bloqueia, porque a rota é a mesma e já está coberta.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-16 16:21:12 · `tasks/prd-reengenharia-continuacao/9_task.md`

VEREDITO: APROVADO
Caminho quente tocado: tutor (somente leitura, no `GET /v1/tutor/uso`, aberto pela professora no painel `?ver=tutor`, sem atualização periódica)
Rate limit: ok (a tarefa não muda nenhum limite; a rota já exige permissão por usuário)
Fila e prioridade: ok (não se aplica: nenhum job novo)
Concorrência: protegida (é uma consulta de leitura, sem nenhuma gravação)
Índice e paginação: ok
- `semRespostaDeHoje` filtra por escola, turma, `autor = 'aluno'`, data de criação e aluno. Esse filtro casa com o índice `mensagem_tutor_trocas_idx`, que já existe e cobre escola, turma, data e aluno só nas mensagens de aluno (`packages/core/src/db/schema/mensagem-tutor.ts:89`).
- As duas subconsultas também usam índices que já existem: a da execução busca pela chave primária de `execucao_agente`, e a da mensagem fixa usa o índice único `mensagem_tutor_uma_por_execucao`, que cobre escola, execução e autor.
- A lista continua limitada a `MAXIMO_DE_ALUNOS_NO_USO` (200), e a contagem só lê os alunos dessa lista.
Degradação de IA: não se aplica. A tarefa só conta as perguntas que já degradaram, e nenhum teste chama provedor pago: o dublê lança `LLMError` (`apps/api/src/tutor/sem-resposta.int.test.ts:86`).
Migration: não se aplica
Métrica e alerta: ok. A rota já existia e entra na métrica HTTP geral (`packages/core/src/telemetry/metrics.ts`). Nenhum alerta novo, e o runbook foi atualizado para dizer que a professora vê o contador.
Bloqueantes: nenhum
Recomendações:
- Rodar o `EXPLAIN` de `ultimasTrocas` com volume perto do da seção 3.6 de `docs/infra.md`. A condição passou a ser "não falhou, ou ficou sem resposta" (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/tutor/supervisao.repository.ts:272`). Com isso, a busca da última pergunta de cada aluno, que percorre o índice de trás para frente, roda duas subconsultas a mais em cada linha que falhou. Hoje isso é barato, mas convém medir no cenário em que o `worker-ia` fica parado a manhã toda e as perguntas que falharam se acumulam.
- O `uso` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/tutor/supervisao.service.ts:539-544` agora faz quatro consultas, uma depois da outra. Se a medida do pool de conexões apertar, juntar a contagem de hoje com a de trocas numa consulta só, com `count(*) filter (...)`, tira uma ida ao banco.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-16 16:22:04 · `tasks/prd-reengenharia-continuacao/9_task.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. O que a §5 "A pergunta sem resposta (RF5)" pede está feito, e o `cenarios.md` §1 também:
- conta as perguntas de hoje no `FUSO_DO_USO` que terminaram num código de `PASSAGEIROS`;
- a lista `PASSAGEIROS` é importada, não copiada;
- tira a pergunta que recebeu a mensagem fixa da D36;
- aplica o mesmo recorte de `ultimasTrocas`;
- `ultimasTrocas` passa a incluir as perguntas sem resposta;
- `trocasHoje` e o freio não mudaram;
- a linha na tela é neutra, fica separada do "X de Y" e não aparece com zero.

As quatro divergências da tabela não contradizem a Tech Spec nem o `cenarios.md`. A troca do e2e mexe só no plano de teste da própria tarefa, porque o `cenarios.md` só pede [U] para a linha na tela. As outras três são detalhe de implementação dentro do que a §2 e a §5 já dizem.

Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)

Bloqueantes: nenhum

Recomendações:
1. **O título da coluna diz "troca", mas a coluna pode mostrar uma pergunta sem resposta.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/areas/professor/turmas/TurmaHoje.tsx:407`, a coluna "Última troca" e a "Em que estava" agora podem mostrar a pergunta que o Tutor não respondeu. O docblock novo de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/shared/src/tutor/uso.ts` define troca como a pergunta "que o Tutor respondeu", e o `docs/mvp-contratos.md` já diz "última pergunta, respondida ou não". A foto `professora--…--computador.png` mostra o Caio com "Última troca 16/11, 16h18", e essa hora pode ser a de uma pergunta cortada. Vale alinhar o rótulo, por exemplo "Última pergunta", ou o texto do glossário e da `docs/interface.md:330`, numa tarefa de texto.
2. **Dois nomes iguais, só com a maiúscula diferente.** O componente `TrocasDeHoje` (`TurmaHoje.tsx:294`) e a função `trocasDeHoje` (`sinais.ts`) aparecem juntos no mesmo arquivo. Algo como `CelulaDasTrocasDeHoje` evita a confusão na leitura.
3. **A frase está repetida.** `perguntasSemResposta` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/areas/professor/turmas/sinais.ts:362` escreve a frase inteira duas vezes, uma no singular e outra no plural. Variar só "pergunta" ou "perguntas" deixa o texto num lugar só.
4. **A tabela de divergências cita um lugar da spec que não tem a decisão.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tasks/prd-reengenharia-continuacao/9_task.md:94`, a coluna "Onde está na spec" da troca do e2e aponta a `techspec.md` §5, que não diz nada sobre e2e. Uma nota "Como a 9.0 ficou" na §5, como as tarefas 5.0 a 8.0 deixaram, guardaria o motivo: o caso novo ficava acima da régua de 15 s, e a medida a 1366 não se aplica dentro do painel.
5. **A linha do Caio não aparece na foto do celular.** Em `professora--…--celular.png` o painel termina no cabeçalho dele, então a frase a 360 px só está provada pelo e2e (`conferirAPerguntaSemResposta` no `a3-a4`), não pela foto. A rolagem dentro do painel é do `frontend-reviewer`; fica só o registro.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-16 16:22:31 · `tasks/prd-reengenharia-continuacao/9_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A tarefa só lê `mensagem_tutor` e `execucao_agente` e não grava nada. Todos com autor humano? sim, porque nenhum caminho foi criado ou alterado.

Decisão autônoma sobre aluno: ausente. A contagem não vira alerta nem sinal, não ordena a lista e não tem consequência automática.

Aprovação registrada: ok. Nada mudou no fluxo de aprovação. A resposta do Tutor segue sendo supervisionada (D47), e a exceção não se estendeu a outro agente.

Supervisão do tutor: ok, e ficou melhor. Antes, a pergunta cortada sumia das três leituras do professor, e o aluno que só teve perguntas sem resposta ficava invisível. Isso era o uso invisível que a regra 70, item 4, proíbe, e a própria AIA (itens 15 e 16) o registrava como lacuna. Agora:
- `ultimasTrocas` inclui a pergunta sem resposta (`supervisao.repository.ts:486`), então esse aluno aparece na lista.
- `semRespostaDeHoje` conta as perguntas sem resposta de hoje, dentro do recorte de escola, ano, turma e disciplina do professor.

A supervisão continua sem vigiar (item 7):
- A professora recebe só um número inteiro: sem o texto da pergunta, sem o código do erro e sem a execução. O schema estrito recusa qualquer campo a mais (`packages/shared/src/tutor/uso.ts`, testado em `apps/api/test/contracts.test.ts` e em `packages/shared/src/tutor/tutor.test.ts`).
- A conta é só do dia, no fuso do freio.
- A frase fala do Tutor e não do aluno ("que o Tutor não respondeu"). O texto passa pela varredura anti-emoção de `sinais.test.ts`, e o teste da tela confere que não há palavra de alarme nem de nota.
- A lista continua em ordem de nome, sem ranking.

Nas fotos:
- Escola cheia, computador: a linha do Caio mostra "1 de 60" e, abaixo e separado, "2 perguntas que o Tutor não respondeu hoje" em texto sutil. A da Lia não mostra nada. Não há cor de alerta, nota nem conceito.
- Escola vazia: o estado vazio continua igual.
- O selo "IA" e o "O que o Tutor faz sozinho" continuam na aba.

Autonomia declarada e visível: sim. Não mudou nesta tarefa, e o acordeão "O que o Tutor faz sozinho, e o que você vê aqui" aparece nas fotos.

D46/D55 (nota em discursiva e redação): nada nesta tarefa toca nota, conceito ou devolutiva.

D45/D64 (medir o professor): nada nesta tarefa toca indicador de professor. A coordenação continua sem ler o uso nominal.

Bloqueantes: nenhum.

Recomendações:
1. `apps/web/src/areas/professor/turmas/TurmaHoje.tsx:407`: a coluna se chama "Última troca", mas agora pode mostrar a hora de uma pergunta que ficou sem resposta. O docblock de `packages/shared/src/tutor/uso.ts:37` e o `docs/mvp-contratos.md` passaram a dizer que "troca" é a pergunta respondida e que a última é "a última pergunta". Sugiro renomear a coluna para "Última pergunta", ou registrar a divergência. O mesmo vale para o estado vazio na l.399 ("com as trocas de hoje e em que estava").
2. Nos testes de integração deu erro de ambiente. Rodei `apps/api/src/tutor/sem-resposta.int.test.ts` três vezes e falharam 12, 16 e 17 casos, quase todos com `422 SEM_MATERIAL_DA_SERIE` no `POST` do turno. O `apps/api/src/tutor/tutor.int.test.ts`, que já existia e não foi tocado, também falha aqui do mesmo jeito (39 de 52). Como o diff não mexe no `turno.command.ts`, atribuo a falha ao ambiente (o estado do banco de teste ou outra execução usando o mesmo banco), e não à tarefa. Mesmo assim, o portão precisa ver esse arquivo verde antes do pouso. Os testes de unidade de `sinais.test.ts` e de `tutor.test.ts` (shared) passaram.
3. No celular da escola cheia, o cartão do Caio fica cortado na borda do painel. É assunto do `frontend-reviewer`; deixo registrado só porque é justamente o cartão que leva a frase nova.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/tutor/supervisao.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/tutor/supervisao.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/tutor/sem-resposta.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/shared/src/tutor/uso.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/areas/professor/turmas/TurmaHoje.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/areas/professor/turmas/sinais.ts

## test-engineer · 1ª rodada · REPROVADO · 2026-11-16 16:24:29 · `tasks/prd-reengenharia-continuacao/9_task.md`

**VEREDITO: REPROVADO** (um bloqueante, e a correção é barata)

**Cenários exigidos:**
- **Caminho feliz:** duas perguntas cortadas e uma respondida.
- **Códigos que contam:** os passageiros, um a um e a lista importada inteira, com `ERRO_INTERNO` e `IA_ENTRADA_INVALIDA`.
- **Código e situações que não contam:** a avaliação aberta depois do 202 (S12), a função suspensa (`FUNCAO_SUSPENSA`), o vínculo encerrado (`NAO_ENCONTRADO`), a pergunta que recebeu a mensagem fixa (D36) e qualquer outro código.
- **Corte do dia no fuso de Brasília:** às 10h, e no domingo às 23h59, que em UTC já é segunda.
- **Recorte:** outra disciplina, pela atividade e pelo material; o professor que dá duas disciplinas na mesma turma, e uma terceira disciplina que não aparece.
- **Ano anterior** (virada de ano).
- **Aluno transferido hoje.**
- **Pergunta cortada e reenviada pelo "Tentar de novo".**
- **Worker de IA parado:** a pergunta cortada pelo `GET` da execução.
- **Permissão e isolamento:** o `GET` da turma da escola B responde como o inexistente, e o repository lê com ids da B no contexto da A, inclusive o contexto que só a cláusula de escola separa.
- **Contrato:** só o número no DTO, sem texto, código nem execução.
- **Tela:** plural, singular, zero sem nada, à parte do "X de Y", a 1366 e a 360 px.
- **Concorrência:** não se aplica, a leitura é uma consulta só, sem escrita.

**Cobertos:** todos os cenários acima. Cada linha da tabela "Testes que provam a regra" tem o seu caso citado pelo nome, e nenhum item juntado por ponto e vírgula ficou sem teste. Não há `.skip` nem teste comentado. A IA é sempre o modelo da bancada (`fila.comModelo` com `LLMError`) ou o adaptador falso, nunca provedor pago. Cada ausência tem o caso positivo ao lado: a B vê a própria pergunta cortada, o ano de 2025 acha a dele, a Física vê a sua. A divergência do e2e (o caso fica no `a3-a4` e não há `soOPainelDaAbaRola`) está justificada no documento, e o caso ainda confere a largura do diálogo, o botão Fechar de 44 px, o axe e a rolagem horizontal (`e2e/a3-a4-professor.spec.ts:170-176`).

Rodei os quatro testes de unidade (`sinais.test.ts`, `TurmaHoje.test.tsx`, `tutor.test.ts` do shared, `contracts.test.ts`): 73 de 73 verdes. Não consegui ver verde o `sem-resposta.int.test.ts` aqui:
- **Resultado:** 17 de 31 casos vermelhos, nas três vezes que rodei.
- **Causa provável:** a máquina, e não a tarefa. Todos os vermelhos passam pelo worker de IA, e o caso que já existia (`tutor.int.test.ts` › "a professora vê quem usou…") falha do mesmo jeito, com `422 SEM_MATERIAL_DA_SERIE`.
- **Hipótese:** o material da série não fica pronto no banco de teste desta máquina. Os casos sem atividade terminam `concluida` em vez de `falhou`, o que bate com o Tutor recusar sem chamar o modelo; não confirmei a causa.

Por isso o veredito sobre esse arquivo vem da leitura do código e das mutações que o portão já provou. Convém conferir no portão ou na esteira.

**Bloqueantes:**
1. `apps/api/src/tutor/supervisao.repository.ts:347`: o termo `this.#semResposta(),` do `where` de `semRespostaDeHoje` é a cláusula que separa a pergunta sem resposta da respondida, e não tem bloco de mutação nem motivo na seção "Mutações".
   - **O que já existe:** blocos para as cláusulas de escola, ano, turma, aluno e dia, e para o recorte dessa consulta. Os blocos de dentro de `#semResposta` mexem no critério, não tiram a chamada dessa consulta. O `--faltando` não vê a linha porque ela não tem operador, e a autoconferência (item 1) também a deixou de fora da lista.
   - **Correção exigida:** um bloco que tire essa linha, citando `sem-resposta.int.test.ts › duas cortadas e uma respondida` ou `› nenhum outro código de erro conta`. Sem a cláusula, a contagem vira 3, ou o tamanho dos outros códigos mais um, e o caso fica vermelho.

**Recomendações:**
- `apps/api/src/tutor/sem-resposta.int.test.ts:435`: o nome do caso diz "a leitura não vai ao banco", mas o caso só confere que o mapa vem vazio, e a própria seção de motivos admite que tirar o `if` deixa o caso verde. Renomear para o que ele prova, por exemplo "sem aluno nenhum a ler, devolve vazio".
- `apps/api/src/tutor/sem-resposta.int.test.ts:168-170`: o comentário diz "O freio do dia não vê a cortada", mas a asserção conta as 3 mensagens do aluno no banco, o que não prova o freio. Quem prova é o `trocasHoje: 1` da linha 161. Reescrever o comentário ou tirar a asserção.
- `e2e/support/professor/tutor.ts:470`: o "1 de 60" está fixo. Se o freio da escola semeada mudar, o caso quebra pelo motivo errado. O `a3-a4` usava `/1 de \d+/`; dá para ler o limite ou usar a mesma regex.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-16 16:49:15 · `tasks/prd-reengenharia-continuacao/9_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma nova. A rodada 2 não traz migration. `mensagem_tutor` e `execucao` continuam como estavam na 1ª rodada, com `escola_id`, e a leitura é presa a ano e turma pelo `#recorteDoProfessor`.

Queries verificadas:
- `SupervisaoDoTutorRepository.#semResposta()`: a única mudança é o docblock (`apps/api/src/tutor/supervisao.repository.ts:220`). Ele agora diz que a função só vale dentro de uma consulta já escopada por escola, ano e turma do contexto. Isso atende a recomendação 2 da 1ª rodada. A lógica não mudou.
- `ultimasTrocas` e `semRespostaDeHoje`: sem mudança desde a rodada aprovada.
- `TurmaHoje.tsx` e `sinais.ts`: só mudaram nome de componente e montagem da frase. Não há efeito no escopo.

Teste de isolamento: presente e efetivo.
- Atende a recomendação 1 da 1ª rodada. Em `apps/api/src/tutor/sem-resposta.int.test.ts:424`, a lista da turma da escola A, lida pela professora da A, não traz o aluno da B que teve pergunta cortada.
- Essa asserção nova, sozinha, não quebraria se a cláusula de escola sumisse, porque o filtro de turma já tira o aluno da B. A cláusula de escola segue provada pela chamada ao repository com o contexto `{ ...b, escolaId: a.escolaId }` (linhas 429–430). Ali ano e professora são da B e só a escola é da A, então sem a cláusula de escola o resultado viria com tamanho 1.
- O caso "sem aluno nenhum a ler" mudou só de nome: deixou de afirmar que a leitura não vai ao banco. Não muda a cobertura.

Fotos:
- A escola vazia mostra o estado vazio e nada da escola cheia.
- Na escola cheia aparece só o contador "2 perguntas que o Tutor não respondeu hoje", sem o texto da pergunta e sem o código do erro.

Bloqueantes: nenhum.

Recomendações:
- `apps/api/src/tutor/sem-resposta.int.test.ts:424`: o comentário deixa a entender que essa linha prova o isolamento. Quem prova é a chamada ao repository com escola trocada, logo abaixo. Vale escrever no comentário que essa linha é só a prova pela rota, no caminho que o cliente vê.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-16 16:49:39 · `tasks/prd-reengenharia-continuacao/9_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo nesta rodada. O diff desde a 1ª rodada só muda texto e testes. O `semRespostaHoje` continua um inteiro por aluno, sem o texto da pergunta e sem o código do erro, e a linha dele em `docs/lgpd.md` foi conferida na 1ª rodada.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok.
- `semRespostaDeHoje` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/tutor/supervisao.repository.ts:334-354`) segue escopada pelo contexto: escola, ano, turma, alunos, dia, `#semResposta()` e `#recorteDoProfessor()`.
- O docblock novo (l.220) diz que `#semResposta` só vale dentro de consulta já escopada. As duas chamadas, l.273 e l.348, estão dentro de uma.
- O caso de isolamento de `sem-resposta.int.test.ts` ganhou uma asserção: o aluno da B não entra na lista da turma da A (l.423-424).

Logs: limpos. O diff não toca em log.

Auditoria: presente. A leitura é do professor da própria turma, e a regra não pede auditoria nesse caso. Nada mudou nesta rodada.

Envio externo: nenhum novo. O contador vem do banco e não vai a provedor.

Seed/fixture: sintético. A semeadura da Mesa por SQL foi no banco de teste da vitrine, com "Aluno Sintético Caio" e "Aluna Sintética Lia". O e2e usa `semearPerguntaSemRespostaNoBanco`.

Fotos da tela (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/.processo/vitrine/`):
- **Escola cheia, computador:** a professora vê nome, "1 de 60", "2 perguntas que o Tutor não respondeu hoje", a hora e em que o aluno estava. Não aparece texto de pergunta, código de erro nem motivo. Isso bate com o DTO e com a regra 70, item 7.
- **Clique em "Aluno Sintético Caio":** a foto sai igual à de antes do clique. O nome não abre nada, o que confirma que nenhuma linha leva à conversa (`docs/interface.md`).
- **Escola vazia:** mostra só o estado vazio, sem dado.
- **Celular:** o cartão do Caio continua cortado pela rolagem do painel. A linha a 360 px só tem prova no e2e, como a nota da Mesa avisa. Não é bloqueante para a regra 20.

As recomendações da 1ª rodada:
- A citação "X6 9.0" / "tarefa 9.0" saiu de `docs/interface.md:334` e de `docs/aia/tutor.md:289, 421 e 433`. Feito.
- O caso de coordenação e aluno em `sem-resposta.int.test.ts` foi recusado, com motivo escrito na tarefa. Conferi o motivo e ele se sustenta: `tutor.int.test.ts` já cobre a rota, e o campo novo não muda quem lê.

A pergunta de fechamento continua respondida. A pergunta cortada fica em `mensagem_tutor`, entra no arquivo do titular como antes e não foi a lugar nenhum fora do provedor que a execução registra.

O arquivo `apps/api/src/tutor/sem-resposta.int.test.ts` ainda não está no git, mas é idêntico ao da árvore auditada (`68d9282d`).

Bloqueantes: nenhum.

Recomendações:
- A Mesa ainda não tirou a foto do celular rolada até o cartão do Caio, que tinha prometido para esta rodada. Fica para a próxima vitrine, e o e2e cobre enquanto isso.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-16 16:49:44 · `tasks/prd-reengenharia-continuacao/9_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum novo nesta rodada. O diff não toca `Nota`, correção nem lançamento. Todos com autor humano? sim, sem mudança desde a 1ª rodada.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. A rodada não traz saída de IA nova que chegue ao aluno. O contador de perguntas sem resposta é uso do Tutor, que é supervisionado e não aprovado resposta a resposta (D47).
Supervisão do tutor: ok. A pergunta cortada aparece ao professor como número: "2 perguntas que o Tutor não respondeu hoje" na linha do Caio, à parte do "1 de 60". Não aparecem o texto nem o motivo. O aluno que só tem pergunta cortada também entra na lista. A linha nova no teste de isolamento (`apps/api/src/tutor/sem-resposta.int.test.ts:424`) prova que uma pergunta cortada na escola B não põe o aluno da B na lista da turma da A.
Autonomia declarada e visível: sim. "Tutor IA" e "O que o Tutor faz sozinho, e o que você vê aqui" aparecem na tela da turma, nas fotos das duas escolas.
Bloqueantes: nenhum

**O que esta rodada mudou** (`.processo/ordens/diff-9-r2-codigo.patch` e o diff de `tasks/prd-reengenharia-continuacao/9_task.md`)
- Mudaram nomes e organização do texto, sem efeito no comportamento:
  - `TrocasDeHoje` passou a se chamar `CelulaDasTrocasDeHoje`.
  - `perguntasSemResposta` monta a frase de outro jeito, e o texto na tela continua o mesmo.
  - Os imports estão em outra ordem.
  - Um comentário novo no docblock de `#semResposta` (`supervisao.repository.ts:220`) diz que a função só vale dentro de uma consulta já escopada.
- O e2e agora acha o freio pelo padrão "1 de N", porque antes confundia com o "1 de 600" do mês.
- Entrou um bloco de mutação novo para a chamada `this.#semResposta()`.
- Saíram dos docs as menções "X6 9.0" e "tarefa 9.0".
- As quatro recomendações da 1ª rodada foram para o `TODO.md` com destino escrito.

Nada disso mexe em nota, discursiva ou redação (D46/D55), em métrica de professor (D45) nem em inferência sobre comportamento.

**Fotos da tela**
- `professora--…--Aluno-Sintético-Caio--computador.png` (e a mesma tela antes do clique): o painel não tem vocabulário de nota nem conceito. A frase é neutra e fala do Tutor, não do aluno. Diz que "O que foi dito ao Tutor não aparece, e nada abre a conversa de um aluno". Os nomes estão em ordem alfabética. A frase vem de `apps/web/src/areas/professor/turmas/sinais.ts:128`, e a célula é montada em `TurmaHoje.tsx:312`/`TurmaHoje.tsx:405`.
- `vazia--…--computador.png` e `vazia--…--celular.png`: o vazio é neutro ("O conteúdo da conversa não aparece"), sem chamada que puxe o uso.
- `professora--…--Aluno-Sintético-Caio--celular.png`: o cartão do Caio aparece só pela metade, porque o painel rola por dentro e a captura é da página. A linha a 360 px está provada só pelo e2e, como a Mesa avisou.

Recomendações:
- "Última troca" pode mostrar a hora de uma pergunta que não teve resposta. Na foto, o Caio tem "16/11, 16h48" com duas cortadas. Já está no `TODO.md` como decisão de produto, e eu mantenho: renomear para "Última pergunta" ou alinhar o glossário.
- Na próxima vitrine, fotografar o celular com o painel rolado até o cartão do Caio, para que a linha a 360 px se veja na tela e não só no e2e.

## frontend-reviewer · 2ª rodada · APROVADO · 2026-11-16 16:49:52 · `tasks/prd-reengenharia-continuacao/9_task.md`

VEREDITO: APROVADO

Tela vista: sim (6 fotos lidas: painel "O que o Tutor viu" a 1366 e a 360 px, na escola cheia, na cheia depois do clique no nome do Caio e na vazia). Duas ressalvas:
- A captura a 360 px é da página inteira e o painel rola por dentro. O cartão do Caio segue cortado, e o "aqui" que aparece sob ele é a página de trás. É limite da captura, não defeito. A linha do Caio a 360 px só está provada pelo e2e `conferirAPerguntaSemResposta`, nos dois projetos.
- Carregando e erro não aparecem na vitrine. Nesta rodada nada neles mudou.

Estados: ok.
- Com dado: a 1366 px o Caio mostra "1 de 60" e, abaixo, em cinza, "2 perguntas que o Tutor não respondeu hoje". A frase é neutra e fica à parte do freio. A Lia aparece sem a linha.
- Vazio: na escola vazia o painel convida ("Nenhum aluno desta turma usou o Tutor ainda… Quando um aluno conversar com o Tutor, ele aparece aqui…"), com o próximo passo dito e sem se desculpar.

Acessibilidade: sem mudança nesta rodada. O foco aparece na borda azul do painel e o botão de fechar está visível. Na tabela a frase continua em texto simples, sem depender de cor, e o painel tem rótulo de região.

Chromebook fraco: sem mudança. O diff desta rodada não toca consulta de dado nem renderização, só nome de componente, comentário e texto de teste.

Celular: ok a 360 px. O painel cabe na largura e vira cartões por aluno, sem rolagem horizontal. Os rótulos "TROCAS HOJE", "ÚLTIMA TROCA" e "EM QUE ESTAVA" estão legíveis. O botão de fechar tem 44 px, conforme o e2e. Nenhum fluxo exige o celular.

Ação oficial protegida: sim. A tela só lê. Não há nota, publicação nem link para a conversa de um aluno, e o painel diz que "nada abre a conversa de um aluno".

Diff desde a rodada aprovada, conferido:
- `TurmaHoje.tsx:312` e `:405`: `TrocasDeHoje` virou `CelulaDasTrocasDeHoje`. Não sobrou referência ao nome antigo, e o componente não colide mais com `trocasDeHoje` de `sinais.ts`.
- `sinais.ts:128`: a frase foi reescrita, mas o texto na tela é o mesmo. `sinais.test.ts:52-54` prova "2 perguntas…", "1 pergunta…" e `null` com zero. A linha 58 do mesmo teste prova que a frase não fala de tempo parado nem de emoção (regra 70, item 7).
- `sinais.test.ts`: o import ficou em ordem alfabética (a recomendação da rodada anterior foi atendida).
- `e2e/support/professor/tutor.ts:34`: o freio é buscado por `/^1 de \d+$/`, no último elemento. O primeiro é o do mês da turma ("1 de 600"), então a busca não depende mais do limite 60 da escola.
- `sem-resposta.int.test.ts`: acrescentou a prova de que a cortada da escola B não traz o aluno da B para a lista da turma da A. Os outros ajustes nesse arquivo e em `supervisao.repository.ts` são só comentário e nome de teste.
- Os docs tiraram "X6 9.0" e "tarefa 9.0" do texto. `docs/interface.md` e `docs/aia/tutor.md` seguem coerentes com a tela.

Bloqueantes: nenhum.

Recomendações (todas já registradas no `TODO.md`, nada novo):
- A 1366 px a tabela de quatro colunas rola na horizontal. A coluna "Em que estava" fica cortada e a frase nova quebra em cinco linhas na célula estreita (foto `…--Aluno-Sintético-Caio--computador.png`). Já era assim antes da tarefa.
- A coluna "Última troca" pode mostrar uma pergunta sem resposta, e o texto do vazio diz "as trocas de hoje". Alinhar o texto é decisão de produto.
- O cinza de `text-sutil` na linha do Caio está claro na foto. Conferir o contraste na próxima passada de tela do painel.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-16 16:50:15 · `tasks/prd-reengenharia-continuacao/9_task.md`

VEREDITO: APROVADO
Caminho quente tocado: tutor (só a leitura do uso pelo professor; nenhuma mudança de comportamento nesta rodada)
Rate limit: ok (a rota não mudou)
Fila e prioridade: ok (não mudou)
Concorrência: protegida (a rodada só mexe em leitura, nenhuma escrita nova)
Índice e paginação: ok (as consultas são as mesmas da 1ª rodada; o `EXPLAIN` com volume está registrado no `TODO.md`)
Degradação de IA: não se aplica (nada mudou no gateway; a cortada continua aparecendo para o professor só como contagem)
Migration: não se aplica
Métrica e alerta: ok (sem código novo no caminho quente)
Bloqueantes: nenhum
Recomendações:
- As duas recomendações de infra da 1ª rodada estão no `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/TODO.md` com destino e condição. São o `EXPLAIN` de `ultimasTrocas` e de `semRespostaDeHoje` com volume (no k6 do RF6) e a contagem única com `count(*) filter` (se a medida do pool de conexões apertar). Não havia correção exigida a conferir.
- O diff da rodada não muda nenhuma consulta. O que entrou:
  - um docblock em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/tutor/supervisao.repository.ts:220`, que diz que `#semResposta` só vale dentro de uma consulta já escopada;
  - a troca de nome `TrocasDeHoje` para `CelulaDasTrocasDeHoje`;
  - a frase de `sinais.ts` montada sem repetir o texto;
  - uma asserção de isolamento a mais em `sem-resposta.int.test.ts:424`;
  - um bloco de mutação novo, sobre a chamada a `#semResposta()`;
  - o seletor do e2e em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/e2e/support/professor/tutor.ts:165` (`/^1 de \d+$/` com `.last()`), que deixou de ter "60" fixo e passou a seguir o limite do dia da escola;
  - texto de documentação.
- O docblock de `#semResposta` deixa a garantia de escopo por conta de quem chama. Se outra consulta passar a usá-la, convém que a revisão confira que o `where` dela já traz escola, ano e turma do contexto.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-16 16:50:23 · `tasks/prd-reengenharia-continuacao/9_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum
Recomendações:
- **Seletor do freio no e2e** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/e2e/support/professor/tutor.ts:36`): o freio é achado com `getByText(/^1 de \d+$/).last()`. Isso só funciona porque, no `a3-a4-professor.spec.ts`, só um aluno usa o Tutor. Se outro aluno fizer uma troca no cenário, a conferência de "abaixo do freio" passa a medir contra a linha errada. É mais firme procurar a frase e o freio dentro da linha do aluno semeado, pelo nome dele.
- **Pendências que a rodada já mandou ao `TODO.md`** e que as fotos confirmam:
  - Na foto do computador da escola cheia, a frase do Caio quebra em cinco linhas na coluna "Trocas hoje".
  - A coluna "Última troca" mostra 16h48, que pode ser a hora de uma pergunta cortada.
  - Na foto do celular, o cartão do Caio continua cortado pela rolagem do painel.

As três recomendações da 1ª rodada que a Mesa mandou aplicar foram feitas:
- **Nome do componente:** `TrocasDeHoje` virou `CelulaDasTrocasDeHoje` (`TurmaHoje.tsx:312` e `:405`). O bloco de mutação foi atualizado junto.
- **Frase num lugar só:** `perguntasSemResposta` agora escreve "que o Tutor não respondeu hoje" uma vez só (`sinais.ts:128`). O bloco de mutação foi atualizado junto.
- **Nota na Tech Spec:** a §5 ganhou "Como a 9.0 ficou". A linha de Divergências do `9_task.md` passou a apontar para o item 3 dessa nota.

O resto do diff está coerente com o que a tarefa declara:
- **Mutações:** entrou um bloco para a chamada `this.#semResposta()` do `where`, que cai em "duas cortadas e uma respondida". O caso "sem aluno nenhum a ler" mudou de nome e a tabela de cenários acompanhou.
- **Isolamento:** o caso ganhou a conferência de que o aluno da escola B não entra na lista da turma da escola A. A seção de motivos explica por que ela não acrescenta cláusula.
- **Docs:** `docs/aia/tutor.md` e `docs/interface.md` perderam a referência à tarefa.
- **Destino das recomendações:** as da 1ª rodada estão registradas no `TODO.md` ou recusadas com motivo.

Nas fotos, a tela mostra "2 perguntas que o Tutor não respondeu hoje" em linha separada do "1 de 60", sem o texto da pergunta. A escola vazia mostra o estado vazio. O que aparece bate com o RF5 e com a §5 da Tech Spec.

## test-engineer · 2ª rodada · APROVADO · 2026-11-16 16:50:49 · `tasks/prd-reengenharia-continuacao/9_task.md`

VEREDITO: APROVADO

Cenários exigidos (2ª rodada: o diff de a2cd0b23 para 68d9282d e a correção exigida na 1ª):
- A correção exigida: um bloco de mutação que tire `this.#semResposta(),` do `where` de `semRespostaDeHoje` e caia num caso que rodou.
- O que o diff toca: a frase de `perguntasSemResposta` reescrita, a célula renomeada para `CelulaDasTrocasDeHoje`, a asserção nova de isolamento, o caso renomeado e o seletor do freio no e2e.

Cobertos:
- **A correção exigida foi feita.** O bloco novo está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tasks/prd-reengenharia-continuacao/9_task.md:367-373`. Ele tira `this.#semResposta(),` e cita `sem-resposta.int.test.ts › duas cortadas e uma respondida`. As linhas de contexto (`gte(...)` acima, `this.#recorteDoProfessor(),` abaixo) batem com `supervisao.repository.ts:347-349`. O vermelho vem pelo motivo certo: sem o termo, a conta passa a incluir a pergunta respondida (3 em vez de 2), e o caso fixa `semRespostaHoje: 2`. A contagem do cabeçalho subiu para 35 blocos. O item 1 da seção de perguntas do modelo agora cita a chamada `#semResposta()` e a `#recorteDoProfessor()` do mesmo `where`, e a segunda já tinha bloco (l.268-277).
- **Blocos atualizados junto com o código.** Os blocos de `sinais.ts` (l.323-328) e de `TurmaHoje.tsx` (l.344-349) acompanham a frase reescrita e o nome `CelulaDasTrocasDeHoje`, então as mutações continuam encontrando a linha. `sinais.test.ts` e `TurmaHoje.test.tsx` rodaram aqui: 47 de 47 verdes.
- **A asserção nova de isolamento** (`sem-resposta.int.test.ts:423-424`) usa os auxiliares `usoPara` e `linhaDe` (l.59-60). Ela não acrescenta cláusula, e a seção "Mutações" diz isso, com o motivo.
- **As três recomendações da 1ª rodada foram aplicadas.**
  - O caso foi renomeado para `sem aluno nenhum a ler, devolve vazio`, e a tabela de testes e o bloco usam o nome novo.
  - O comentário das l.168-170 foi reescrito e agora aponta o `trocasHoje: 1` como a prova.
  - O "1 de 60" fixo do e2e virou regex com `.last()`.
- Não há `.skip` nem teste comentado no diff, e nenhum mock esconde a regra.

Bloqueantes: nenhum.

Recomendações:
1. **A suíte de integração não pode rodar ao lado da vitrine.** Rodei `npx vitest run --project integracao apps/api/src/tutor/sem-resposta.int.test.ts` e deu 14 de 31 vermelhos: `422 SEM_MATERIAL_DA_SERIE` e execuções `concluida` onde o teste espera `falhou`. A causa é o ambiente: a vitrine sobe workers no mesmo compose `educa-teste-1` (`worker-ia-1`, `worker-ia-2`, `worker-lote`, `worker-pdf`), e eles consomem as filas da bancada. Não é defeito da tarefa: o portão roda em ambiente limpo e diz verde. Vale registrar no processo que a Mesa precisa parar os workers da vitrine, ou usar outro compose, antes de qualquer revisor rodar a integração. Na 1ª rodada a falha foi a mesma.
2. **O seletor do freio no e2e pode apontar para a linha errada.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/e2e/support/professor/tutor.ts:36`, `uso.getByText(/^1 de \d+$/).last()` pega o último "1 de N" da lista, não o da linha do aluno semeado. Se outro aluno com "1 de N" vier depois dele, a comparação "abaixo do freio" mede a linha errada. Isso dá vermelho falso, não verde falso. Prender o freio à mesma linha da tabela que tem a frase (`getByRole('row').filter({ hasText: '1 pergunta que o Tutor não respondeu hoje' })`) deixaria a medida exata.
