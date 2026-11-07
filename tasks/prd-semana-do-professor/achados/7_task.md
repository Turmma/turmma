# Achados das revisões — `tasks/prd-semana-do-professor/7_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-07 00:31:53 · `tasks/prd-semana-do-professor/7_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. Ela grava só o texto da aula, escrito pela professora, pelo `PUT /v1/aulas` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/apps/web/src/areas/professor/turmas/api/aulas.ts:9`. Esse texto não é nota, e nada da IA passa por ele. Todos com autor humano? sim, porque não há caminho.

Decisão autônoma sobre aluno: ausente.

Aprovação registrada: ok. A tarefa não tem saída de IA. O painel (`PainelDaAula.tsx`) só guarda o que a professora escreve. "Preparar esta aula" (`PainelDaAula.tsx:71-74`) faz duas coisas: guarda a turma e a disciplina em `CONTEXTO_ESCOLHIDO` e abre o Início. Não chama a API, não cria conversa e não leva o texto da aula ao Assistente. Isso fica provado por dois testes de e2e: "Preparar" não manda o texto a requisição nenhuma, e o número de conversas é o mesmo antes e depois (T4). Tudo que a IA gerar depois sai do fluxo normal do Assistente, que esta tarefa não altera.

Supervisão do tutor: ok. A tarefa não toca no Tutor.

Autonomia declarada e visível: sim, sem mudança. Nenhum agente foi criado ou alterado.

Os demais pontos da lista:
- **Auditoria (6):** não se aplica, porque a tarefa não tem saída de IA.
- **Supervisão sem vigilância (7):** nada sobre o comportamento do aluno. O campo avisa "Não escreva o nome de nenhum aluno" (`semana.ts`, `DICA_DO_TEXTO_DA_AULA`).
- **D46 e D55 (8):** nenhum campo, tela ou prompt sugere nota em discursiva ou redação.
- **D45 e regra 70, item 8 (9):** sem ranking de professor e sem métrica nova. O texto da aula fica só na memória do painel, e a conversa com o chat continua fora do alcance da coordenação.

Bloqueantes: nenhum.

Recomendações:
- As fotos da tela não estavam disponíveis, porque a escola sintética da vitrine não tem grade importada. Por isso não conferi na tela como a regra 70 chega à professora, só no código. Quando a vitrine tiver grade, convém tirar as fotos de `/professor/turmas?ver=semana&aula=<…>` e conferir que o painel não mostra rótulo de IA nem nada que pareça vir dela.
- Quem auditar a tarefa 4.0 (o backend do `PUT /v1/aulas`) deve confirmar que o texto da aula não chega à coordenação de forma nominal nem entra em indicador de professor. Isso cai no item 8 da regra 70 e não está no diff desta tarefa.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-07 00:31:57 · `tasks/prd-semana-do-professor/7_task.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok. A tarefa não cria rota nova. O `PUT /v1/aulas` é da 4.0 e passa pela guarda global por usuário e por escola.
Fila e prioridade: ok. Não há fila nem job, e "Preparar esta aula" não faz nenhuma chamada.
Concorrência: protegida. O clique duplo é barrado no cliente por uma trava síncrona de `useRef`, e a mutação não repete sozinha porque o `retry` do `createQueryClient` vale só para leitura. No servidor, duas gravações da mesma aula ao mesmo tempo deixam uma linha só, e isso é provado pelo teste G6 em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/apps/api/test/aulas.int.test.ts:349`. O caso da resposta atrasada (gravação de A no ar, B aberta) também tem teste: o `key` do painel muda por aula, e há o e2e de recomeço.
Índice e paginação: ok. Não há query nova. Depois de salvar, o texto vai direto para o cache da semana, sem buscá-la de novo. A semana só é relida inteira no caso `NAO_ENCONTRADO`, ao fechar o painel.
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok. Não há código novo no servidor nem alerta novo.
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/apps/web/src/areas/professor/turmas/semana/Semana.tsx`, `fechar` de `useAulaAberta`: o `invalidateQueries({ queryKey: SEMANA_QUERY_KEY })` invalida todas as semanas em cache. Hoje só a semana na tela é relida e o caso é raro, então não pesa na carga. Mesmo assim, se o projeto tiver uma função que monta a chave de uma semana (`['semana', segunda]`), vale usar só a da semana aberta, para deixar a intenção explícita.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-07 00:32:03 · `tasks/prd-semana-do-professor/7_task.md`

VEREDITO: APROVADO

A tarefa 7.0 está conforme a regra 20 e o `docs/lgpd.md`, sem bloqueante. Ela não cria campo novo, não loga nada e não envia nada para fora. O texto da aula fica só em memória, e "Preparar esta aula" leva à tela de nova conversa só a turma e a disciplina. Não rodei os testes: li o diff, os arquivos novos e o serviço do `PUT` no backend.

Campos pessoais tocados: o texto livre da aula, `aula.conteudo`, com até 500 caracteres e escrito pela professora. Pode acabar citando aluno. A tela também mostra turma, disciplina e sala da grade, que já existiam. Nenhum campo novo foi criado.

Fora da tabela de dados do docs/lgpd.md: nada. O registro da aula está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/docs/lgpd.md:75`, com finalidade e retenção (apagado na virada do ano). A mesma linha diz que só a professora lê o texto e que ele não vai a log, auditoria nem IA, e a tarefa cumpre isso.

Autorização por objeto: ok.
- **No navegador:** `?aula=` só abre o painel se a aula estiver na semana que a API devolveu para a sessão (`semana.ts:696`, `Semana.tsx:511-527`). Qualquer outro valor some do endereço sem aviso, e a tela não diz se a aula existe. O valor precisa ter forma de UUID, data e hora válidas (`semana.ts:672-678`). Há e2e para aula de outra escola e para aula que não existe.
- **No servidor:** o `PUT` responde `NAO_ENCONTRADO`, sem gravar nada, tanto para o vínculo que não é dela quanto para a aula que não existe (`apps/api/src/semana/aulas.service.ts:27-31`). Esse serviço é da tarefa 4.0.
- **Mensagem de erro:** a tela mostra só duas frases fixas, sem código e sem stack (`semana.ts:725-726`).

Logs: limpos. Nem `apps/web/src/areas/professor/turmas/semana/` nem `api/aulas.ts` escrevem log ou `console`.

Auditoria: nada a exigir. A tarefa não tem leitura de aluno pela coordenação ou pela rede, exportação, nota, permissão nem aprovação de saída de IA. Pelo `lgpd.md:75`, o texto da aula não vai à auditoria.

Envio externo: nenhum. "Preparar esta aula" (`PainelDaAula.tsx:82-85`) guarda só `turmaId:disciplinaId` em `CONTEXTO_ESCOLHIDO`, que fica em memória (`apps/web/src/api/tab-store.ts:26`), e abre a nova conversa. Não chama a API, não cria conversa e não leva o texto. Dois e2e provam isso: um usa um texto sentinela e confere que ele não sai em requisição nenhuma, sem `PUT` e sem linha gravada no banco; o outro conta as conversas no banco antes e depois. Não há envio para IA, então não há o que registrar em `ExecucaoAgente`.

Rascunho e armazenamento: o rascunho fica só no estado do painel (`PainelDaAula.tsx:57`). Nunca vai a `localStorage`, `sessionStorage` nem ao endereço, e há prova em unidade e em e2e. Também há e2e para a sessão que vence com o painel aberto e entra outra pessoa, e para a troca de escola: nada da sessão anterior fica na tela. O aviso "Não escreva o nome de nenhum aluno" está no campo (`semana.ts:729`) e é conferido em unidade e em e2e. O `data-aula` do cartão leva só ids e hora (`CartaoDaAula.tsx:446`).

Seed/fixture: sintético. As cenas vêm de `e2e/support/professor/semana.ts`, o texto do e2e é um sentinela, e o "Maria" do teste de unidade é texto inventado.

Pergunta de fechamento: o código responde. O texto da aula entra no arquivo do titular, só na versão completa, pelo `vinculo_id`. A retenção é a virada do ano, e nada sai para terceiro.

Bloqueantes: nenhum.

Recomendações:
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/apps/web/src/areas/professor/turmas/semana/PainelDaAula.tsx:82`, falta um teste de unidade que prove que `preparar()` não chama `gravarAula` nem lê o campo. Hoje só o e2e cobre isso, e ele roda depois.
- Quando a F11 reabrir a ligação da aula com a IA (`lgpd.md:75`), o "Preparar" vai ser o primeiro lugar tentado a levar o texto ao Assistente. Vale anotar isso no comentário de `PainelDaAula.tsx:51-52` como algo que exige revisão de privacidade antes de mudar.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-07 00:32:03 · `tasks/prd-semana-do-professor/7_task.md`

VEREDITO: APROVADO

Tela vista: não. A prompt traz "Fotos da tela: indisponíveis". A vitrine não tem grade importada, então não há cartão para clicar e abrir o painel. Revisei pelo código e pelo e2e, sem rodar o e2e. A tela, aberta e com erro, fica para a validação. As medidas dependem do e2e `celular`: Salvar e Preparar com 44 px, Fechar com 24 px ou mais, folha de baixo a 360 px, axe. O portão é quem as prova.

Estados: ok.
- Painel com dado: aula do cartão, rótulo "O que vou dar" ou "O que foi dado", contador, aviso e botões.
- Gravando: "Salvando…" com o botão desligado e trava síncrona contra clique duplo (`PainelDaAula.tsx:66-68, 86-88`).
- Erro: `role="alert"` com a frase "Não foi possível salvar. Tente de novo em instantes.", e o texto continua no campo. Para `NAO_ENCONTRADO` a frase é "Esta aula saiu da grade e o texto não foi salvo…" (`:114-118`).
- Carregando e vazio: ficam com a Semana, que já os tem (`Semana.tsx:171-175`). O painel só abre quando a aula está na semana lida, então ele não tem carregamento nem vazio próprios.

Acessibilidade:
- O `Sheet` é um `<dialog>` modal, com foco no miolo, Esc fechando e foco devolvido ao cartão. Se o cartão saiu da página, o foco vai ao `data-aula` ou ao título (`Semana.tsx:293`).
- O campo tem rótulo visível.
- O contador é `aria-live="polite"` e entra no `aria-describedby`; o `Textarea.tsx:72` o liga só a quem pede (`contadorAnunciado`).
- O alerta de erro usa os tokens `erro` e `erro-cx`, os mesmos de `PainelDaContestacao.tsx:88`.
- O axe com o painel aberto está no e2e.

Chromebook fraco:
- Sem lista nova e sem imagem.
- A gravação sai de uma vez só e põe o texto no cache da semana (`setQueriesData`), sem leitura nova.
- O painel não anima largura nem altura.

Celular:
- Folha de baixo com 88% da altura, rodapé com `flex-wrap`, `min-w-0` e `break-words` no conteúdo.
- Nada depende de hover ou atalho.
- Salvar e Preparar são botões `principal` de 44 px, e o Fechar do `Sheet` é `icone` de 44 px.
- O e2e cobre largura, rolagem de lado e alvos nos projetos `chromebook` e `celular`. Não o rodei.

Ação oficial protegida: sim. Não há ação oficial nesta tarefa.
- O texto da aula é da professora e não é nota nem saída de IA.
- "Preparar esta aula" não manda o texto a requisição nenhuma e não cria conversa (`:71-74`; e2e "Preparar não manda o texto…").
- O `?aula=` leva só ids, data e hora (`semana.ts` `aulaDoEndereco`).
- O rascunho só existe em `useState`.
- Aula que não é dela sai do endereço sem dizer se existe (regra 10, item 6).

Bloqueantes: nenhum.

Recomendações, nenhuma bloqueia:
1. `PainelDaAula.tsx:71-74` e `semana.ts` `DICA_DO_TEXTO_DA_AULA`: "Preparar esta aula" também descarta o rascunho não salvo, porque o painel desmonta ao navegar. A dica só fala de "Fechar sem salvar". O botão fica ao lado de "Salvar" e perde o texto sem aviso. Vale incluir "Preparar" na dica, ou salvar antes de navegar quando há rascunho. A segunda opção pede decisão de produto, porque a Tech Spec diz que Preparar não grava.
2. `PainelDaAula.tsx:79`: Esc ou "Fechar" durante o "Salvando…" fecha o painel. Se o PUT falhar depois, o erro some com o painel e o rascunho se perde calado. A Tech Spec escolheu esse comportamento, então fica registrado para a retro.
3. `Semana.tsx:133-136`: se a semana for relida e a aula tiver saído, o painel fecha sozinho com o rascunho dentro, sem frase. O caso mais provável é o refetch ao voltar à janela. O fluxo de `NAO_ENCONTRADO` cobre só o salvar. Considere manter o painel aberto, com a frase da aula que saiu, quando já havia rascunho.
4. `PainelDaAula.tsx:86`: o "Salvar" desligado durante a gravação pode deixar o foco no botão desligado. O e2e do foco só cobre o fechar. Vale conferir com leitor de tela na validação.

Arquivos lidos:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/apps/web/src/areas/professor/turmas/semana/PainelDaAula.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/apps/web/src/areas/professor/turmas/semana/Semana.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/apps/web/src/areas/professor/turmas/semana/semana.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/apps/web/src/components/ui/fields/Textarea.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/e2e/professor-semana-painel.spec.ts`

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-07 00:32:07 · `tasks/prd-semana-do-professor/7_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma nova. A tarefa 7.0 muda só o frontend. A tabela `aula` e o `PUT /v1/aulas` vieram da 4.0 e eu não os auditei de novo.

Queries verificadas:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/apps/web/src/areas/professor/turmas/api/aulas.ts` (`PUT /v1/aulas`): o corpo leva só `vinculoId` (UUID), `data`, `inicio` e `texto`. O schema `gravarAulaRequestSchema` é `z.strictObject` e recusa `escolaId`, e `packages/shared/src/semana/semana.test.ts:19` prova isso. A escola, o ano e a professora saem do token. O lado do servidor tem teste próprio em `apps/api/test/aulas.int.test.ts`: o vínculo de outra escola responde o mesmo que o id inexistente, e nada é gravado (casos R1 e "o vínculo da própria professora na escola B, com o token de A").
- O `?aula=` só abre o painel se `acharAula` encontrar a aula na semana que o servidor já devolveu com escopo (`semana.ts`, `Semana.tsx`, `useAulaAberta`). Quando não encontra, o parâmetro sai do endereço sem nenhuma mensagem. A tela não confirma que a aula existe, o que atende a regra 10, item 6.
- `setQueriesData` sobre `SEMANA_QUERY_KEY` (`PainelDaAula.tsx`, `onSuccess`): `comTextoGravado` só altera a aula com o mesmo `vinculoId`, a mesma data e o mesmo início. Se a gravação da escola A responder depois da troca para B, o `vinculoId` de A não existe na semana de B e o cache fica igual.
- A troca de escola e de sessão esvazia o cache pelo `resetQueries` em `apps/web/src/main.tsx:36`. A chave `['semana', segunda]` não leva a escola e depende disso, o que está documentado em `Semana.tsx:47`.
- "Preparar esta aula" grava só `turmaId` e `disciplinaId` em `CONTEXTO_ESCOLHIDO`. Não chama a API e não leva o texto da aula.

Teste de isolamento: presente e efetivo.
- O e2e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/e2e/professor-semana-painel.spec.ts:260` passa por `?aula=` um vínculo de outra escola e um UUID inexistente, e espera que nenhum diálogo abra, que nenhum alerta apareça, que o parâmetro saia do endereço e que o nome da turma da outra escola não apareça. Se o painel abrisse direto pelo endereço, sem conferir a aula na semana lida, o teste quebraria.
- Os testes T7 (linhas 331 e 347) cobrem a troca de escola e a entrada de outra pessoa com o painel aberto e um rascunho digitado.
- No servidor, `apps/api/test/aulas.int.test.ts:499` e `:529` cobrem o mesmo caso na rota.

Bloqueantes: nenhum.

Recomendações:
- A garantia de que a resposta atrasada de um `PUT` da escola A não entra na semana da escola B depende só de o `vinculoId` não se repetir entre escolas. Isso vale hoje porque o id é UUID por escola. Um comentário em `comTextoGravado` registraria essa premissa, e um caso de unidade com a semana de outra escola e o mesmo dia e horário a deixaria provada.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-07 00:32:48 · `tasks/prd-semana-do-professor/7_task.md`

VEREDITO: APROVADO

Escopo: respeitado. As quatro subtarefas foram feitas. Os itens do dia, que são da 8.0, não foram mexidos. Três arquivos fora dos "Arquivos previstos" foram alterados, e os três servem à própria tarefa:
- `Textarea.tsx` ganhou a opção `contadorAnunciado`, que liga o `aria-live` do contador pedido na seção 9.
- `CartaoDaAula.tsx` ganhou o `data-aula`, para o foco voltar ao cartão ao fechar.
- `semana.ts` ganhou as funções do endereço e do cache.

Aderência à Tech Spec: ok. O painel segue a seção 9 e o `docs/interface.md` 1.8:
- abre pelo `Sheet` em `?aula=<vinculoId>.<data>.<HHMM>`;
- o contador vai até 500 com `aria-live="polite"`, e o painel avisa para não escrever nome de aluno;
- as duas frases de erro saem como na spec, e o texto fica no campo;
- o clique duplo manda uma gravação só;
- "Preparar esta aula" guarda a turma em `CONTEXTO_ESCOLHIDO` e abre o Início, sem chamar a API;
- o rascunho fica só em memória, e o foco volta ao cartão.

O descarte do rascunho ao fechar era um comportamento que a tarefa deixou para a implementação decidir, e a dica do campo avisa a professora. O `?aula=` de aula que não é dela sai do endereço sem dizer se existe (regra 10, item 6). A tabela de divergências está vazia e não encontrei nenhuma divergência feita em silêncio.

Portão local: carimbo válido. O `conferir` passou com typecheck, lint, segredo, dependências, unidade e alvo.

Bloqueantes: nenhum.

Recomendações:
1. Aula fora da grade apagada pelo painel: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/apps/web/src/areas/professor/turmas/semana/PainelDaAula.tsx:55` com `semana.ts:224`. Quando a professora salva vazio numa aula fora da grade, o `onSuccess` do `useMutation` tira a aula do cache. O painel é desmontado antes de o `aoFechar(false)` do `mutate` rodar, e quem tira o `?aula=` do endereço é o efeito `semDono`. Isso funciona. Mas o cartão deixou de existir, então o `focoDeReserva` não acha o `[data-aula]` e o foco provavelmente cai no `body`, sem ir ao título. Vale confirmar e cobrir com um caso.
2. A mesma chave escrita duas vezes: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/apps/web/src/areas/professor/turmas/semana/semana.ts:167` monta a chave à mão, e `chaveDaAula` (`semana.ts:195`) monta a mesma. `enderecoDaAula` deveria usar `chaveDaAula`, para as duas não divergirem.
3. `Textarea` é peça do catálogo e ganhou uma opção nova (`contadorAnunciado`). Vale conferir se a galeria e a linha da 10.2 do `docs/interface.md` precisam citá-la.
4. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/tasks/prd-semana-do-professor/7_task.md:93`: a linha `--faltando: 1 linhas (0 blocos, 1 motivos)` parece saída de `relatorioDoFaltando`, de `tools/processo/mutacoes.ts`. O mesmo texto aparece em documentos de outras specs, então pode ser convenção. Se não for, apague a linha.

## test-engineer · 1ª rodada · APROVADO · 2026-11-07 00:33:29 · `tasks/prd-semana-do-professor/7_task.md`

VEREDITO: APROVADO

Cenários exigidos:
- **Caminho feliz:** escrever, salvar e reabrir (T2). O cartão mostra o texto sem uma leitura nova e o selo "Falta preencher" some. "Preparar esta aula" abre o Início com a turma marcada e não cria conversa (T4).
- **Casos de borda:**
  - aula dupla: os dois horários da mesma turma não se confundem;
  - professora com duas disciplinas no mesmo horário: a outra aula não recebe o texto;
  - aula que saiu da grade com o painel aberto (`NAO_ENCONTRADO`);
  - aula fora da grade que fica sem texto some, e a que ganha texto fica;
  - falha ao salvar guarda o texto no campo;
  - `?aula=` mal formado: data ou hora que não existem, vínculo que não é UUID, pedaço a mais;
  - semana fora do ano com `?aula=`;
  - fechar sem salvar descarta o rascunho;
  - o mesmo `?aula=` colado de novo com o painel aberto;
  - o limite de 500 caracteres.
- **Permissão:** `?aula=` de aula que não é dela não abre o painel, não diz se a aula existe e sai do endereço (RF9, regra 10 item 6).
- **Isolamento:**
  - `?aula=` de outra escola;
  - troca de escola e outra pessoa entrando na mesma aba: nada da anterior fica (T7);
  - o rascunho nunca vai a `localStorage`, `sessionStorage` nem ao endereço;
  - "Preparar" não manda o texto em requisição nenhuma.
- **Concorrência:**
  - clique duplo em "Salvar" (RF15), com os dois cliques na mesma tarefa;
  - gravação de A segurada no ar com B aberta: nada de A chega em B.

Cobertos: todos.
- **Tabela de testes:** as 22 linhas têm o caso citado pelo nome, e conferi cada um contra `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/e2e/professor-semana-painel.spec.ts`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/apps/web/src/areas/professor/turmas/semana/PainelDaAula.test.tsx`, `semana.test.ts` (mesma pasta) e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/apps/web/src/components/ui/fields/Textarea.test.tsx`. As linhas que juntam dois testes com ponto e vírgula têm os dois.
- **Mutações contra o diff:** `mutacoes.ts --faltando` lista uma linha só, `PainelDaAula.tsx:55` (o `lida === undefined`), e o documento traz o motivo dela. As demais condições novas de `PainelDaAula.tsx`, `Semana.tsx`, `semana.ts` e `Textarea.tsx` têm bloco, e cada bloco aponta um teste cujas asserções alcançam a cláusula.
- **Concorrência de verdade:** no e2e os dois `click()` correm na mesma tarefa, antes de a tela se redesenhar, então é a trava do `useRef` que segura o segundo, e o bloco de mutação dela prova isso. A resposta atrasada usa uma rota segurada, com a ordem forçada.
- **Sem `.skip`, sem teste comentado, sem provedor de IA.** Os dois `page.route` que forçam 500 e 404 não escondem a regra: o painel é do frontend, e o `NAO_ENCONTRADO` do servidor está provado em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/apps/api/test/aulas.int.test.ts` (G1, R4 e J14).
- **Unidade:** rodei as 4 suítes da tarefa e passaram 68 casos. O e2e não rodei, porque precisa do ambiente.

Bloqueantes: nenhum

Recomendações:
1. `e2e/professor-semana-painel.spec.ts:138`: o comentário diz que "o segundo cai no botão que a tela já desligou". Não é o que acontece: o segundo clique chega antes de a tela se redesenhar, e quem o segura é a trava. Corrigir o texto.
2. `e2e/professor-semana-painel.spec.ts:231`: o nome do caso promete reabrir "com o texto gravado", mas não há texto gravado. O caso só prova que o rascunho some no recarregar. Gravar antes com `registrarAulaNoBanco` e conferir que esse texto volta, ou trocar o nome.
3. `e2e/professor-semana-painel.spec.ts:165`: o T3 de `NAO_ENCONTRADO` finge a resposta com `page.route`. Tirar a aula da grade no banco com o painel aberto provaria a ligação de ponta a ponta, e também que o cartão some ao fechar. Esse sumiço hoje só está provado na unidade, pela leitura nova da semana.
4. Falta um caso de queda de rede no `PainelDaAula.test.tsx`: o `fetch` rejeitado, sem resposta HTTP, e o `INDISPONIVEL_TENTE_DE_NOVO` (J13) devem mostrar a frase genérica e guardar o texto. Hoje só o 500 está coberto.
5. Ninguém confere que, depois de uma falha que não é `NAO_ENCONTRADO`, fechar não lê a semana de novo. Contar as leituras do `/v1/semana` no caso "fechar com Fechar sem salvar…" fecharia isso.
6. `e2e/professor-semana-painel.spec.ts:359` e `:361`: a mesma asserção (`toContainText(emB.escolaNome)`) aparece duas vezes. Tirar uma.
7. `tasks/prd-semana-do-professor/7_task.md:93`: a linha solta "--faltando: 1 linhas (0 blocos, 1 motivos)" parece sobra da saída da ferramenta. Tirar do documento.
8. Na tabela, linha 41, a coluna Cenário ainda diz "contados com `page.route`", mas o teste conta com `page.on('request')`, como a coluna Caso já registra. Alinhar o texto.

## frontend-reviewer · 2ª rodada · APROVADO · 2026-11-07 00:54:05 · `tasks/prd-semana-do-professor/7_task.md`

VEREDITO: APROVADO
Tela vista: não. O prompt traz `Fotos da tela: indisponíveis`, porque a escola sintética da vitrine não tem grade importada e, sem ela, não há cartão de aula para abrir o painel. Revisei pelo código e pelo e2e. A tela será vista na validação, e a recomendação 1 abaixo diz o que fotografar.
Estados: ok. Nada mudou nesta rodada. A 2ª rodada acrescenta o teste dos dois erros de rede, o 503 `INDISPONIVEL_TENTE_DE_NOVO` e o `fetch` que rejeita (`PainelDaAula.test.tsx`, `it.each` novo). Os dois mostram a frase genérica, mantêm o texto no campo e religam o "Salvar".
Acessibilidade: sem alteração no diff. O diff mexeu em comentário, teste e e2e, e o único trecho de código de produção que mudou foi `semana.ts:167`, sem efeito sobre foco, rótulo ou contraste. A 1ª rodada aprovou esses pontos.
Chromebook fraco: sem alteração. O teste novo confirma que fechar o painel depois de uma falha comum não relê `/v1/semana`.
Celular: sem alteração no diff. O e2e do painel roda nos projetos que a 1ª rodada aprovou, e as fotos a 360 px ficam para a validação.
Ação oficial protegida: sim. O painel grava só o texto livre da aula, não é nota nem publicação. O texto da aula não sai do painel: o teste novo de "Preparar" confirma que ele não aparece em nenhum `fetch`, em `CONTEXTO_ESCOLHIDO` nem em `localStorage`/`sessionStorage`.

Conferi o diff desde a 1ª rodada:
- `semana.ts:167` agora usa `chaveDaAula(...)`, que já existia em `semana.ts:195` e produz o mesmo formato (`${vinculoId}.${data}.${inicio sem ":"}`). O endereço do `?aula=` não muda, e é a mesma função que `CartaoDaAula.tsx:35` e `Semana.tsx:142` já usam.
- O comentário novo sobre isolamento em `comTextoGravado` descreve a premissa certa: o `vinculoId` é UUID e não se repete entre escolas. O caso novo de `semana.test.ts` prova que o mesmo dia e horário com outro vínculo não é alterado.
- O e2e de `?aula=` agora grava antes "Gravado antes" e espera esse valor ao abrir e ao recarregar. O teste anterior esperava `''` depois de recarregar, o que não provava a leitura do texto gravado.
- Rodei `vitest` em `apps/web/src/areas/professor/turmas/semana`: 3 arquivos e 69 testes passando.

Bloqueantes: nenhum.

Recomendações (a tabela "Recomendações sem aplicar" do documento já as registra):
1. Na validação, fotografar `/professor/turmas?ver=semana&aula=<…>` num ambiente com grade importada, a 1366 e a 360 px, e conferir que o painel não mostra rótulo de IA, que o botão "Salvar" tem 44 px e que o texto não corta.
2. Conferir com leitor de tela o foco depois do "Salvar" desligado durante a gravação, e para onde o foco vai quando o cartão de uma aula fora da grade some. As duas são recomendações já registradas.
3. Decisão de produto para a retro, já registrada: "Preparar esta aula" descarta o rascunho não salvo, e a dica só fala de "Fechar sem salvar".

Arquivos revisados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/apps/web/src/areas/professor/turmas/semana/semana.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/apps/web/src/areas/professor/turmas/semana/PainelDaAula.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/apps/web/src/areas/professor/turmas/semana/PainelDaAula.test.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/apps/web/src/areas/professor/turmas/semana/semana.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/e2e/professor-semana-painel.spec.ts

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-07 00:54:15 · `tasks/prd-semana-do-professor/7_task.md`

VEREDITO: APROVADO

A segunda rodada não traz bloqueante. As mudanças são comentários, uma refatoração de uma linha e testes novos. Nenhum campo, rota, log ou envio novo entrou. As fotos não estavam disponíveis, então não houve conferência visual.

Campos pessoais tocados: nenhum novo. Continua só o texto da aula (`aula.conteudo`), que é do professor e já foi auditado na 1ª rodada.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok. Nenhuma rota mudou. O comentário novo em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/apps/web/src/areas/professor/turmas/semana/semana.ts` (em `comTextoGravado`) registra que o isolamento no cliente depende de o `vinculoId` ser UUID. O caso novo em `semana.test.ts` prova isso: uma gravação com outro vínculo, no mesmo dia e horário, não muda a semana lida. Na `semana.ts:167`, a montagem da chave em `enderecoDaSemana` passou a usar a mesma `chaveDaAula` que o cartão e o `Semana.tsx:142` já usavam. O comportamento não muda.

Logs: limpos. O diff não acrescenta nenhum log.

Auditoria: não se aplica. Não há leitura por coordenação ou rede, exportação, nota, permissão nem saída de IA.

Envio externo: nenhum. Em `PainelDaAula.test.tsx` ("Preparar esta aula"), três asserções novas confirmam que o texto do campo não vai a nenhum `fetch`, nem ao `CONTEXTO_ESCOLHIDO`, nem ao `localStorage` ou `sessionStorage`. O comentário em `PainelDaAula.tsx`, antes de `CONTEXTO_ESCOLHIDO.guardar(...)`, avisa que levar o texto da aula ao Assistente na F11 exige antes revisão de privacidade, mapa de dados e AIA. Isso atende a regra 20, itens 1 e 12.

Seed/fixture: sintético. O `e2e/professor-semana-painel.spec.ts` grava "Gravado antes" com `registrarAulaNoBanco` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/e2e/support/professor/semana.ts:82`). O insert é restrito por `escola_id` e `vinculo_id` da cena de teste e não usa dado real.

Erro: o `it.each` novo (503 `INDISPONIVEL_TENTE_DE_NOVO` e queda de rede com `TypeError`) prova que a falha mostra a frase genérica, sem detalhe técnico, e que o texto continua só no campo, em memória.

Correções exigidas da 1ª rodada: não havia nenhuma. As recomendações foram aplicadas ou estão em "Recomendações sem aplicar" do `7_task.md`, com destino registrado.

Pergunta de fechamento: nada mudou desde a 1ª rodada. O texto da aula continua no servidor, com o escopo de escola e vínculo, e não sai para lugar nenhum.

Bloqueantes: nenhum.

Recomendações:
- Em `PainelDaAula.test.tsx`, a asserção `JSON.stringify({ ...localStorage, ...sessionStorage })` depende de o jsdom expor as chaves do Storage como propriedades próprias. Também perde uma entrada se as duas áreas tiverem a mesma chave. Uma alternativa mais robusta é percorrer `Object.keys` com `getItem` em cada área, separadamente. Isso não bloqueia.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-07 00:54:39 · `tasks/prd-semana-do-professor/7_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. Nesta rodada só mudaram comentários, a montagem do endereço da aula e testes. Nenhum caminho novo grava em `Nota`. Todos com autor humano? sim, porque não há nenhum.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. A tela grava o texto que a professora escreveu, e esse texto não vem de IA. Nada no diff produz saída de IA que chegue ao aluno.
Supervisão do tutor: ok. O tutor não é tocado nesta tarefa.
Autonomia declarada e visível: sim. Nenhum agente foi criado ou mudou de nível.

Bloqueantes: nenhum

O que conferi no diff desta rodada:
- **`PainelDaAula.tsx:72-75`:** só entrou comentário. "Preparar esta aula" continua mandando ao Assistente apenas a turma e a disciplina. O texto da aula não chega à IA, e nenhum rótulo, nota ou sugestão de IA aparece no painel.
- **`semana.ts:167`:** `enderecoDaAula` agora usa `chaveDaAula`. O formato do endereço continua o mesmo, como prova `semana.test.ts:258`. Nada disso toca a regra 70.
- **`PainelDaAula.test.tsx`:** as três asserções novas no "Preparar" reforçam que o texto da aula não vai à IA nem fica no navegador. Elas olham os pedidos de rede, a caixa de pedido do Início e o `localStorage`/`sessionStorage`.
- **`e2e/professor-semana-painel.spec.ts` e `semana.test.ts`:** os testes novos tratam de isolamento entre escolas, recarga da página e clique duplo. Nenhum mexe em nota, avaliação do professor, inferência sobre comportamento ou ranking.
- **Minhas 2 recomendações da 1ª rodada:** estão registradas em "Recomendações sem aplicar", com o Validador como destino. Uma é fotografar o painel quando a vitrine tiver grade. A outra é conferir, no backend da 4.0, que o texto da aula não chega à coordenação pelo nome do professor nem entra em indicador de professor (regra 70, item 8). O destino é adequado.

Recomendações:
- Continua valendo a da 1ª rodada. Quando a escola sintética da vitrine tiver grade importada, o Validador deve fotografar `/professor/turmas?ver=semana&aula=<…>` no computador e no celular. A foto confirma que o painel e o "Preparar esta aula" não mostram rótulo de IA nem nada que pareça nota. Desta vez não houve fotos da tela, então a auditoria se apoiou só no código.

Arquivos vistos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/.processo/ordens/diff-7-r2.txt
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/apps/web/src/areas/professor/turmas/semana/PainelDaAula.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/apps/web/src/areas/professor/turmas/semana/semana.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/apps/web/src/areas/professor/turmas/api/aulas.ts

## infra-guardian · 2ª rodada · APROVADO · 2026-11-07 00:54:43 · `tasks/prd-semana-do-professor/7_task.md`

VEREDITO: APROVADO

Caminho quente tocado: nenhum. O diff desta rodada só muda teste e comentário, mais uma refatoração em `semana.ts` que produz a mesma chave.

Rate limit: ok (o diff não cria rota nem chamada nova)

Fila e prioridade: ok (não se aplica)

Concorrência: protegida. O clique duplo em "Salvar" continua coberto pela trava do painel e pelo e2e do RF15; só o comentário mudou.

Índice e paginação: ok (não há query nova)

Degradação de IA: não se aplica. "Preparar esta aula" não chama modelo, e o teste novo prova que o texto da aula não sai em nenhum pedido nem fica gravado no navegador.

Migration: não se aplica

Métrica e alerta: ok (nada novo no caminho quente)

Bloqueantes: nenhum

O que esta rodada confirmou:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/apps/web/src/areas/professor/turmas/semana/semana.ts:167`: `enderecoDaAula` agora chama `chaveDaAula`, definida na linha 195. As duas montam o mesmo texto, `${vinculoId}.${data}.${inicio.replace(':', '')}`, então o `?aula=` e os endereços já compartilhados continuam funcionando.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/apps/web/src/areas/professor/turmas/semana/PainelDaAula.test.tsx`: o teste novo prova que ao fechar o painel depois de uma falha comum (503 ou queda de rede) a tela não pede `/v1/semana` de novo. Isso evita uma onda de leituras quando o servidor falha às 10h. Só o `NAO_ENCONTRADO` lê a semana de novo.

Recomendações:
- Minha recomendação da 1ª rodada não está no `TODO.md`. O destino dela é o `TODO.md` (`Semana.tsx`, `fechar`: invalidar só a chave da semana aberta em vez de `SEMANA_QUERY_KEY` inteira). Hoje a chamada está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/apps/web/src/areas/professor/turmas/semana/Semana.tsx:140`. A tabela "Recomendações sem aplicar" registra o destino, mas a linha precisa entrar no `TODO.md` antes do pouso da spec, senão a recomendação se perde.

## test-engineer · 2ª rodada · APROVADO · 2026-11-07 00:54:43 · `tasks/prd-semana-do-professor/7_task.md`

VEREDITO: APROVADO

**Cenários exigidos** (é a 2ª rodada, então auditei só o diff de 847168f4 a 13535953 e o código que ele afeta):
- isolamento: uma gravação atrasada de uma escola não pode entrar na semana de outra
- falha comum ao salvar: servidor indisponível (503) e queda de rede
- fechar depois de uma falha comum não lê a semana de novo
- reabrir pelo `?aula=` com um texto já gravado
- "Preparar esta aula" não leva o texto para lugar nenhum
- clique duplo em "Salvar"

**Cobertos:**
- **Isolamento.** O caso novo em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/apps/web/src/areas/professor/turmas/semana/semana.test.ts:298` falharia se a regra saísse. A aula da escola B tem o mesmo dia e horário (`inicio` padrão 07:30) e outro `vinculoId`. Sem a comparação de `vinculoId` em `semana.ts:227`, o texto "gravado na escola A" entraria e o `toEqual(lida)` ficaria vermelho.
- **Servidor indisponível e queda de rede.** O `it.each` em `PainelDaAula.test.tsx:213` cobre os dois. A rede falsa é um `vi.fn(async …)`, então o `throw new TypeError` vira um `fetch` que falha de verdade. As três asserções olham o resultado: a frase de `FRASE_DA_FALHA_AO_SALVAR`, o texto que ficou no campo e o "Salvar" ligado de novo.
- **Fechar depois de uma falha comum.** As leituras de `/v1/semana` são contadas antes e depois de fechar (`PainelDaAula.test.tsx:261-265`). Isso separa este caso do `NAO_ENCONTRADO`, que pede a semana de novo e já tinha teste (linha 249).
- **Reabrir com texto gravado.** O e2e `?aula=` (`e2e/professor-semana-painel.spec.ts:233-244`) agora grava "Gravado antes" no banco e espera esse valor ao abrir e depois de recarregar. Com isso prova duas coisas: que o texto gravado vem do servidor e que o rascunho não sobrevive à recarga. Antes ele esperava `''` e não provava nenhuma das duas.
- **Preparar.** Três asserções novas (linhas 357-359): o texto não aparece em nenhuma chamada de `fetch`, nem no corpo nem no endereço, e não fica no `localStorage` nem no `sessionStorage`.
- **Clique duplo.** O comentário do e2e foi corrigido. O comportamento não mudou e o teste da unidade do RF15 continua.

**O que mais conferi:**
- **`semana.ts:167`.** A troca por `chaveDaAula` é só uma reorganização. A função produz exatamente o formato antigo (`semana.ts:195-197`), e nenhuma condição nova ficou sem bloco de mutação.
- **Documento da tarefa.** A linha 41 da tabela de testes agora diz `page.on('request')`, que é o que o teste usa. O destino da recomendação 3 (o `NAO_ENCONTRADO` no e2e sem `page.route`) está registrado com o motivo.
- **Proibidos.** Não há `.skip`, nem teste comentado, nem mock que esconda a regra, nem chamada a provedor de IA.
- **Execução.** `npx vitest run src/areas/professor/turmas/semana/`: 3 arquivos, 69 testes, todos passando.

**Correções exigidas na 1ª rodada:** nenhuma, porque ela foi aprovada sem bloqueantes. Das recomendações, conferi no diff a 1, a 2, a 4, a 5, a 6 e a 8, e todas foram feitas. A 3 foi para o `TODO.md` com motivo aceitável. A 7 foi recusada com motivo aceitável.

**Bloqueantes:** nenhum.

**Recomendações:**
1. `PainelDaAula.test.tsx:358`: o `expect(CONTEXTO_ESCOLHIDO.ler()).not.toContain('Fra')` nunca falha. A linha 352 já exige que o valor seja exatamente `valorDoContexto(TURMA.id, MATEMATICA.id)`. Pode ser apagado, ou ficar só como documentação.
2. `PainelDaAula.test.tsx:359`: espalhar `localStorage` e `sessionStorage` com `{ ...localStorage, ...sessionStorage }` funciona no jsdom, mas lê de forma indireta. Ler as chaves com `Object.keys` em cada armazenamento deixa a intenção mais clara. É só legibilidade.
3. O caso de isolamento de `comTextoGravado` foi escrito, mas não há bloco ` ```mutacao ` que remova a comparação de `vinculoId` em `semana.ts:227`. Não bloqueia, porque a cláusula não é nova nesta rodada. Um bloco desses deixaria a premissa escrita no comentário novo (o `vinculoId` é UUID e não se repete entre escolas) provada também pelo portão, e não só por esta revisão.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-07 00:54:49 · `tasks/prd-semana-do-professor/7_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum

**O que conferi nesta rodada**

- **Recomendação 2, aplicada.** A chave do `?aula=` agora é montada num lugar só, `chaveDaAula` (`semana.ts:195`). Os três pontos que a usam passam por ela: `enderecoDaAula` (`semana.ts:167`), `Semana.tsx:142` e `CartaoDaAula.tsx:35`.
- **Recomendações 1 e 3.** Estão em "Recomendações sem aplicar", com destino escrito.
- **Recomendação 4.** Aceito a recusa: a linha `--faltando` é convenção da casa e aparece em outros 30 documentos de tarefa.
- **Caso novo em `semana.test.ts:298`.** O caso pega o defeito que deve pegar. Se `comTextoGravado` comparasse só a data e o horário, sem o `vinculoId`, o texto `'da escola B'` seria trocado e o `toEqual(lida)` falharia.
- **O `?aula=` no recarregar, no e2e.** O teste grava "Gravado antes" no banco, escreve um rascunho e recarrega. Depois espera "Gravado antes" no campo. Isso prova as duas coisas: o rascunho não sobrevive à recarga e o texto gravado volta.
- **O comentário corrigido do clique duplo no e2e.** Agora bate com o código: a trava de `useRef` em `PainelDaAula.tsx:47` e o comentário em `PainelDaAula.tsx:64-65`.
- **As asserções novas do "Preparar".** O texto do campo não aparece no `fetch`, no `CONTEXTO_ESCOLHIDO` nem no armazenamento do navegador. Isso fortalece a prova da regra 20, item 12, e não mexe no comportamento.

**Recomendações**

1. **Itens com destino no `TODO.md`.** Quatro linhas de "Recomendações sem aplicar" mandam o item para o `TODO.md`: infra-guardian, frontend-reviewer 3, revisor-geral (foco) e test-engineer (`NAO_ENCONTRADO`). O `TODO.md` ainda não foi alterado. Na 6.0 esses itens entraram junto com o commit da tarefa. Neste commit, eles precisam entrar numa seção "Da semana-do-professor, tarefa 7.0". Na 1.0 isso não aconteceu: o `estado.md` registra destinos no `TODO.md` que ninguém escreveu.
2. **O comentário de `preparar` (`PainelDaAula.tsx:64-66`) está longo e fala do futuro (F11).** A parte que vale é "o texto da aula não vai". A orientação para quem reabrir a F11 cabe melhor no `docs/lgpd.md` ou no `TODO.md` do que no código.

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/apps/web/src/areas/professor/turmas/semana/semana.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/apps/web/src/areas/professor/turmas/semana/semana.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/apps/web/src/areas/professor/turmas/semana/PainelDaAula.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/e2e/professor-semana-painel.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/tasks/prd-semana-do-professor/7_task.md
