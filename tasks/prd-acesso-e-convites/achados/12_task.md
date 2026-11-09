# Achados das revisões — `tasks/prd-acesso-e-convites/12_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-09 16:19:27 · `tasks/prd-acesso-e-convites/12_task.md`

VEREDITO: APROVADO
Tela vista: sim (22 fotos lidas, escola cheia e escola vazia). Todas as fotos citadas no prompt foram lidas, nos dois tamanhos e em todos os pedaços. A senha na tela só tem foto na escola vazia, e a coordenação usa o mesmo diálogo. A primeira foto da coordenação (`…-Mostrar-alunos-aprovados--computador.png`, e os `celular-1` e `celular-2` dela) é de uma rodada anterior e diz "1 aluno aprovados". As fotos seguintes e o código (`ListaDaTurma.tsx`, `formatQuantity(lidos.length, 'aluno aprovado', 'alunos aprovados')`) dizem "1 aluno aprovado". Vale o código.
Estados: ok.
- Diálogo: lendo ("Carregando…" com "Gerar" ocupado), falha da leitura com "Tentar de novo" e o texto de cada erro (conflito, limite, aluno que saiu, conta da escola). A senha em dois grupos aparece depois da geração (`DialogoDaSenhaProvisoria.tsx`, `senha-provisoria.ts`).
- Seção "Alunos aprovados" da coordenação: texto antes do clique, "Carregando os alunos aprovados…", erro com "Tentar de novo", vazio que convida ("Nenhum aluno aprovado ainda … Os alunos aparecem aqui quando o pedido de nome deles é aprovado") e a lista (`ListaDaTurma.tsx` `CorpoDosAprovados`).
- Aba Alunos do professor: os quatro estados já existiam, e a coluna "Ações" não os alterou.
- Carregando e erro vieram do código e do e2e, não da vitrine.

Acessibilidade:
- Menu pelo componente `Menu` já existente: teclado, foco devolvido ao botão, itens de 44 px.
- Nome acessível "<nome>: Ações".
- Na senha, o leitor de tela ouve "A B C D, 2 3 4 5" e o texto visual fica `aria-hidden`.
- A região viva do aviso fica fora da seção que pode esvaziar.
- O foco vai para o texto, o título da senha ou o da pergunta, conforme a etapa.
- `axe` com violações sérias é afirmado no e2e (`seriousViolations`).

Chromebook fraco:
- Lista do professor paginada em cem, com "Ver mais"; a da coordenação também.
- A leitura dos aprovados só sai no clique, com `gcTime: 0`.
- Não há upload de imagem nesta tarefa.
- A senha e o alvo ficam fora do cache de consultas.

Celular:
- Em 360 px não há rolagem lateral nas fotos.
- As linhas viram cartões, e o menu "Ações" tem cerca de 42 a 44 px.
- No diálogo, "Gerar senha provisória", "Cancelar", "Copiar" e "Fechar" ficam empilhados e com 44 px ou mais.
- O e2e `senha-provisoria.spec.ts` roda em `chromebook` e `celular`: sem rolagem lateral, 44 px nas ações principais e 24 px no resto.
- Nada depende de hover ou atalho.
- Nenhum fluxo exige o celular.

Ação oficial protegida: sim. A confirmação mostra nome, turma e matrícula, e diz que a senha atual deixa de valer e que o aluno sai da conta. "Gerar" só habilita depois da leitura do aluno. Fechar sem copiar pergunta antes. Cancelar não gera nada. A matrícula aparece só nesse diálogo, um aluno por vez.

Rolagem a 1366 × 768: nenhuma tela rola, então não há conflito com RF de "cabe".

Bloqueantes: nenhum.

Recomendações:
1. Na vitrine, o cartão mobile da coordenação (`celular-2`) repete "AÇÕES" como rótulo da linha e como texto do botão. O mesmo vale na aba do professor. A tabela de `ListaDaTurma.tsx` e de `AlunosDaTurma.tsx` poderia omitir o rótulo da coluna "Ações" no cartão.
2. A tela da coordenação antes do clique em "Mostrar alunos aprovados" e a senha gerada na coordenação não têm foto. Vale uma foto na validação, com `--clicar`.
3. As fotos de 15:25 e as de 16:17 convivem na pasta com o mesmo nome base. Convém limpar as antigas para não confundir quem lê depois.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-09 16:19:34 · `tasks/prd-acesso-e-convites/12_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma nova. A tarefa 12.0 só mexe na web e nos docs, e não altera nada em `apps/api` nem em `packages`.

Queries verificadas:
- `GET` e `POST /v1/usuarios/:usuarioId/senha-provisoria`, chamados por `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/api/senha-provisoria/senha-provisoria.ts`. Só o id do aluno vai no caminho; o `POST` não tem corpo e nenhuma das duas chamadas manda `escolaId`.
- `GET /v1/turmas/:id/alunos?finalidade=conferencia_de_cadastro&limite&pagina`, que já existia (`apps/api/src/estrutura/turma/turma.controller.ts:61`) e é chamado por `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/estrutura/api/lista.ts`. A query string traz só finalidade, limite e página; nada nela decide de qual escola se lê.

Teste de isolamento: presente e efetivo, na camada da API (tarefas 9.0 e 17.0), que esta tarefa não altera.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/test/senha-provisoria.int.test.ts:277`: a coordenação e o professor da escola A não alcançam o aluno da escola B.
- O mesmo arquivo, linha 816, para a leitura do alvo: o aluno da escola B, lido pelo contexto da escola A, recebe o mesmo corpo do 404 de um id inexistente, e a leitura não grava nada.
- O mesmo arquivo, linha 854, é o controle positivo: a coordenação da escola B lê o próprio aluno e recebe 200. Sem a cláusula de escopo, a leitura cruzada também daria 200 e o `toEqual(inexistente)` quebraria.
- A lista da turma continua coberta por `apps/api/test/estrutura-isolamento.int.test.ts`.

O 404 se comporta igual nas duas telas: a confirmação fecha e mostra "Este aluno não está mais na turma. A lista foi atualizada.", sem distinguir aluno de outra escola de aluno inexistente. Os itens 6 (UUID), 7 (camada de rede) e 8 (`@Unscoped()`) não se aplicam a esta tarefa: ela não cria tabela, não toca agregado de rede e não abre query sem escopo.

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/estrutura/api/lista.ts`: a chave `['alunos-aprovados-da-turma', turmaId]` não inclui a escola ativa. O `gcTime: 0` reduz o risco, mas incluir a escola, ou limpar essas chaves ao trocar de escola, deixa explícito que a lista de uma escola nunca aparece no contexto de outra.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-09 16:19:51 · `tasks/prd-acesso-e-convites/12_task.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum. A tarefa só mexe na web. Ela usa a leitura e a geração da senha provisória das tarefas 9.0 e 17.0, que ficam fora deste escopo, e a geração de senha por pessoa da escola é uma ação de vez em quando, não de toda manhã.
Rate limit: ok. O limite fica na API das tarefas 9.0 e 17.0. A web trata a resposta de limite excedido e a de senha recém-gerada (`CONFLITO`) com os textos de "Telas", em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/api/senha-provisoria/senha-provisoria.ts:42-47`. Nada aqui bloqueia por IP.
Fila e prioridade: ok. Não há job novo.
Concorrência: protegida. Contra o clique duplo, há uma trava no próprio diálogo, antes do estado de "gerando" (`DialogoDaSenhaProvisoria.tsx:88-101`), e o botão fica desligado durante a geração. Quem garante de verdade é o servidor, que responde `CONFLITO` à segunda geração. Uma resposta atrasada não aparece para outro aluno: cada abertura é uma instância nova (`key={aberta.numero}`) e a leitura é cancelada quando o diálogo fecha (`:65-78`).
Índice e paginação: ok. A seção "Alunos aprovados" da coordenação lê a lista de 100 em 100, com "Ver mais alunos" (`apps/web/src/areas/coordenacao/estrutura/api/lista.ts:594-608`). Ela só lê no clique, não relê sozinha, não volta a ler quando a aba volta ao foco e sai do cache ao fechar a tela. A leitura do aluno na confirmação é de um aluno por vez e não repete sozinha em caso de erro. Não há query nova no servidor nesta tarefa.
Degradação de IA: não se aplica.
Migration: não se aplica.
Métrica e alerta: ok. Não há código novo no caminho quente do servidor e nenhum alerta novo.
Bloqueantes: nenhum.
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.tsx:508`: a ordenação por nome junta todas as páginas já lidas. Ao clicar em "Ver mais alunos", as linhas novas se misturam às que já estavam na tela, em vez de entrarem no fim. Isso é de usabilidade, não de carga, e cabe ao `frontend-reviewer` decidir se a lista deve manter a ordem da API.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.tsx:541`: cada "Atualizar" relê todas as páginas já abertas, e cada leitura fica na auditoria. Numa turma grande, com várias páginas abertas, são várias leituras auditadas por clique. Vale registrar na retro se a auditoria por página é a granularidade pretendida.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-09 16:19:54 · `tasks/prd-acesso-e-convites/12_task.md`

VEREDITO: APROVADO

Esta tarefa (12.0, "Gerar senha provisória") só mexe na tela de acesso do aluno. Nenhuma parte dela grava nota, gera saída de IA, decide algo sobre o aluno ou mexe no tutor. Por isso a regra 70 aparece aqui só de leve. Li o diff dos 16 arquivos e as fotos da tela do professor e da coordenação, no computador e no celular, na escola cheia e na vazia.

Caminhos de escrita em Nota: nenhum nesta tarefa. A única escrita nova é `POST /v1/usuarios/:id/senha-provisoria`, que gera uma credencial e não grava nota. Todos com autor humano? Sim, porque não há caminho novo.
Decisão autônoma sobre aluno: ausente. Gerar a senha é uma ação manual do professor ou da coordenação, e ela só acontece depois de a pessoa conferir nome, turma e matrícula na confirmação.
Aprovação registrada: ok. Nenhuma saída de IA chega ao aluno nesta tarefa.
Supervisão do tutor: ok. O tutor não foi tocado.
Autonomia declarada e visível: sim. Nada mudou aqui; não há agente envolvido.

**Pelas fotos:**
- **Nota:** nenhuma nota, conceito ou sugestão de nota aparece. A coluna "Acertos" (com "3 de 4" e "Sem correção aprovada") já existia. Ela continua mostrando só correção de objetiva aprovada, e nenhum texto novo fala de nota.
- **Ranking:** a aba Alunos do professor continua em ordem de nome. O teste `e2e/professor-turma-alunos.spec.ts:134-140` confirma que o único controle novo na tabela é o menu "Ações", sem ordenação, busca ou filtro, e que nenhuma palavra de nota ou ranking aparece.
- **Coordenação:** a lista nominal só é lida quando a pessoa clica em "Mostrar alunos aprovados". A tela avisa antes: "Cada consulta fica registrada na auditoria, em seu nome."
- **Itens 7 e 9:** nada infere emoção ou comportamento do aluno, e nada mede o professor.
- **Sair (D59):** fechar a confirmação custa um clique, como abrir ("Cancelar" fica ao lado de "Gerar senha provisória"). "Fechar sem copiar" pergunta antes por um motivo real: sem isso a senha se perde.

Bloqueantes: nenhum.

Recomendações:
1. **O nome "Alunos aprovados" pode ser lido como aprovação de ano.** Em escola, "aluno aprovado" costuma significar quem passou de ano, que é justamente a decisão de trajetória do item 2 da regra 70. Aqui quer dizer só "o pedido de nome foi aprovado e o aluno já entra". O texto que aparece antes do clique explica isso, mas depois do clique ficam só "1 aluno aprovado" e "Alunos aprovados". Uma coordenadora ou um jurídico que veja a tela sem contexto pode achar que o sistema marca aprovação de aluno. Isso fica em `apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.tsx:294`, `:296`, `:327` e `:355`, e aparece nas fotos `coordenacao--...-Mostrar-alunos-aprovados--computador.png` e `vazia--coordenacao--...-Mostrar-alunos-aprovados--computador.png`. Uma opção é trocar por "Alunos que já entram" ou "Alunos com acesso". Se mudar, os textos de `docs/interface.md` e dos testes mudam junto. É troca de nome e não bloqueia.
2. Os passos 11 e 12 de `docs/roteiro-da-demonstracao.md` usam a mesma palavra "aprovar" para o pedido de nome. Se o nome da seção mudar, vale alinhar esse texto também.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-09 16:19:55 · `tasks/prd-acesso-e-convites/12_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo no banco, porque a tarefa é só de tela. A web passa a mostrar dados que já existem. O professor e a coordenação veem nome, turma e matrícula do aluno na confirmação, lidos ao abrir o diálogo, um aluno por vez (`GET /v1/usuarios/:id/senha-provisoria`, contrato estrito em `packages/shared/src/sessao/senha-provisoria.ts:66`). A coordenação vê o nome dos aprovados, lido no clique (`alunoDaTurmaSchema`, estrito, só `usuarioId` e `nome`). A senha provisória aparece em claro só na resposta do POST.

Fora da tabela de dados do docs/lgpd.md: nada. A matrícula na confirmação já está em `docs/lgpd.md:45`, com finalidade, regra de acesso e auditoria (divergência da 12.0). A senha provisória está em `docs/lgpd.md:81`.

Autorização por objeto: ok. A web só usa rotas da 9.0 e da 17.0, que já respondem `NAO_ENCONTRADO` igual para aluno inexistente e para aluno fora do alcance. A tela trata o 404 como "aluno que saiu da turma", sem distinguir os dois casos (`apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.tsx:73` e `:98`). O professor não ganha matrícula em nenhuma lista. A matrícula só sai do alvo, um aluno por vez.

Logs: limpos. Não há `console.*` nem telemetria nos arquivos novos. `FailureAlert` e `ErrorState` mostram só o texto tipado.

Auditoria: presente. Quando a coordenação lê os aprovados, a API grava `turma.alunos_lidos` com a finalidade `conferencia_de_cadastro` (`packages/core/src/auditoria/acoes.ts:416`). A leitura do alvo grava `senha_provisoria.alvo_lido` (`acoes.ts:206`), e a geração grava `senha_provisoria.gerada`. A tela só lê no clique em "Mostrar alunos aprovados", com `enabled: mostrando`, `staleTime` infinito, `gcTime: 0` e sem releitura ao voltar à aba (`apps/web/src/areas/coordenacao/estrutura/api/lista.ts:851-864`; `ListaDaTurma.tsx:780`). Assim não sai leitura auditada sem um ato da pessoa. O texto da seção avisa que a consulta fica registrada em nome dela, e isso é verdade.

Envio externo: nenhum. Não há IA nem terceiro na tarefa.

Seed/fixture: sintético. As fotos mostram "Colégio sintético da vitrine", "Aluno Sintético Caio/Téo" e matrículas geradas. O e2e cria os alunos com `randomUUID` (`e2e/senha-provisoria.spec.ts:60-76`).

O que vi nas fotos, por papel:
- Professora, confirmação (`professora--…-Gerar-senha-provisória--computador.png` e `--celular.png`): nome, turma e matrícula de um aluno só, de turma dela, mais a consequência. Vem de `DialogoDaSenhaProvisoria.tsx:116-137`. Na lista "Por aluno" não aparece matrícula. Confere com a regra.
- Professora, senha (`vazia--professora--…-button-name-Gerar-senha-provisória--computador.png`): a senha `QVGG-AZY8` e a validade. A matrícula some nessa etapa e o título traz só o nome (`:201`).
- Coordenação (`coordenacao--…-Mostrar-alunos-aprovados*`): a seção "Alunos aprovados" mostra só o nome e o menu "Ações", sem matrícula. A matrícula só aparece na confirmação (`…-Gerar-senha-provisória--celular-1.png`). A matrícula das linhas "livre" e "pediu" na lista de nomes vem de tarefa anterior e não foi alterada aqui.

Onde a senha e a matrícula ficam no navegador:
- As duas chamadas vão por `authedRequest`, fora do cache de consultas. A requisição usa `cache: 'no-store'` (`apps/web/src/api/client.ts:87`).
- A mutação tem `gcTime: 0` (`DialogoDaSenhaProvisoria.tsx:89`). A leitura é abortada quando o diálogo desmonta, e a troca de sessão fecha o diálogo (`:271`).
- Os testes provam isso:
  - O teste de unidade `DialogoDaSenhaProvisoria.test.tsx:362` confere que nada fica no cache de consultas, no cache de mutações, no armazenamento nem no endereço.
  - O e2e `senha-provisoria.spec.ts:170` confere `localStorage`, `sessionStorage`, endereço, cache de consultas e `document.cookie`, antes e depois de fechar.
  - Também há testes para a resposta atrasada, para a segunda pessoa na mesma aba e para reabrir o diálogo.

Pergunta de fechamento: o código responde. Esta tarefa não cria dado novo. Quem gerou e quem usou a senha provisória entra no arquivo do titular (`senha_provisoria.gerada` e `.usada`, que estão em `ACOES_DO_USUARIO_POR_ALVO`). As leituras da coordenação ficam na auditoria com finalidade.

Bloqueantes: nenhum.

Recomendações:
1. O e2e "a senha fora do navegador" (`e2e/senha-provisoria.spec.ts:177`) não lê o cache de mutações do navegador real. Hoje só o teste de unidade prova isso. Dá para incluir `getMutationCache()` no `queryCache` de `e2e/support/query-cache.ts` ou numa função irmã.
2. Depois de "Copiar", a senha fica na área de transferência do computador. Em máquina de escola compartilhada, uma linha na etapa da senha ("depois de entregar, copie outra coisa por cima") reduz o risco. Isso é texto de produto e não bloqueia.
3. A leitura do alvo pelo professor não vai para a auditoria (`acoes.ts:206`, por desenho da 17.0). A regra 20, item 10 só exige auditoria para coordenação e rede, então está conforme. Registro aqui para a retro, caso o jurídico de alguma rede peça o rastro também do professor.
4. Para o `frontend-reviewer`, fora da minha regra: na foto `coordenacao--…-Mostrar-alunos-aprovados--computador.png` li "1 aluno aprovados", no plural. A foto seguinte e o teste de unidade dizem "1 aluno aprovado". Pode ser uma foto antiga; vale conferir `ListaDaTurma.tsx:734`.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/api/senha-provisoria/senha-provisoria.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/estrutura/api/lista.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/professor/turmas/AlunosDaTurma.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/senha-provisoria.spec.ts

## revisor-geral · 1ª rodada · APROVADO · 2026-11-09 16:20:15 · `tasks/prd-acesso-e-convites/12_task.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok

Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")

Bloqueantes: nenhum

**Escopo.** As cinco subtarefas estão feitas, e nada em `apps/api` ou `packages/` mudou.
- O item "Gerar senha provisória" está no menu da linha nas duas telas.
- A confirmação lê o aluno ao abrir, por chamada direta e fora do cache de consultas.
- A seção "Alunos aprovados" só lê no clique e entrou no lugar da contagem antiga.
- A senha vive só no estado do diálogo, e fechar sem copiar pergunta antes.
- `docs/interface.md` e `docs/roteiro-da-demonstracao.md` foram atualizados.
- Os specs que citavam a contagem antiga mudaram junto: `e2e/pedidos.spec.ts` e `e2e/professor-turma-alunos.spec.ts`.

A mudança em `apps/web/src/components/copy-once.tsx` só acrescenta o parâmetro `pergunta`, com padrão que mantém quem já o usava. É reaproveitamento, não um segundo jeito de fazer a mesma coisa.

**Tech Spec.** A divergência da tarefa (opção A) está registrada em três lugares:
- `techspec.md`, seção 5 ("O alvo da provisória", linhas 123–133) e seção 9 (linhas 200–206);
- `cenarios.md`, "Telas" (linha 289) e "E2E (RF18)" (linhas 261–262);
- `.processo/ordens/divergencia-12.md`.

O código segue esse texto: a leitura `GET /v1/turmas/:id/alunos?finalidade=conferencia_de_cadastro` sai só no clique, é paginada com "Ver mais alunos", a tela avisa que a consulta fica na auditoria, e a contagem de aprovados saiu. Os textos de `CONFLITO`, 429, conta da escola e aluno que sumiu batem com "Telas". O primeiro diz "Esta senha acabou de ser gerada…", uma forma mais completa do texto da spec.

**Regras 40 e 60.** Não achei `.skip`, `.only`, `any`, `TODO` nem `console.log` nos arquivos novos e alterados. O caso de dois alunos de mesmo nome tem e2e, que confere a matrícula e que cancelar não gera nada. O vocabulário segue o glossário: aluno, turma, matrícula.

**Fotos.** As telas mostram o que a tarefa pede, com os nomes do glossário e nada além:
- a confirmação com aluno, turma, matrícula e as duas linhas da consequência;
- a senha em dois grupos, com a validade, "Copiar" e "Fechar";
- o menu "Ações" com o item único;
- a seção "Alunos aprovados" com "Atualizar".

Recomendações:
1. A foto `.processo/vitrine/coordenacao--coordenacao-estrutura--link-name-Lista-de-nomes-da-turma-2ºB-40b75109-Mostrar-alunos-aprovados--computador.png` mostra "1 aluno aprovados". O código atual escreve "1 aluno aprovado" (`apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.tsx`, `ListaDosAprovados`), e o teste "um aluno só: a contagem diz '1 aluno aprovado'" cobre isso. Duas outras fotos, a do menu aberto e a da escola vazia, já mostram o singular. Essa foto parece de uma árvore anterior; vale tirá-la de novo antes da validação.
2. A mesma constante do menu aparece duas vezes: `ITENS_DA_LINHA` em `apps/web/src/areas/professor/turmas/AlunosDaTurma.tsx` e `ITENS_DA_LINHA_DO_APROVADO` em `apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.tsx`. Ela poderia sair de `apps/web/src/components/senha-provisoria/`, junto do diálogo, para as duas telas não divergirem.
3. O callback `aoPerderOAluno` também está repetido igual nas duas telas: põe o aviso, fecha o diálogo com `fecharSeAinda(aberta)` e relê a lista. Um hook pequeno ao lado do diálogo evitaria a repetição.
4. `ListaDaTurma.tsx` ficou maior com `AlunosAprovados`, `CorpoDosAprovados` e `ListaDosAprovados`. A seção poderia ir para um arquivo próprio na mesma pasta.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-09 16:21:22 · `tasks/prd-acesso-e-convites/12_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- Caminho feliz nas duas telas: a confirmação com nome, turma e matrícula, e a senha em dois grupos, com "Copiar" e a validade.
- Dois alunos de mesmo nome na mesma turma.
- O aluno que sumiu da turma (transferido), com 404 na leitura e na geração.
- O aluno que entra pela conta da escola, na leitura e na geração.
- As falhas: CONFLITO, 429 e a leitura que falha.
- Clique duplo em "Gerar".
- Recomeços: reabrir o diálogo, a resposta atrasada que não pode cair em outro aluno, e a segunda pessoa na mesma aba.
- A senha fora do navegador.
- A coordenação só lê os aprovados no clique, e a contagem antiga sai.
- Permissão: o aluno que saiu da turma não tem o menu. O escopo é da API (9.0 e 17.0).
- Telas a 360 px e a 1366 × 768.

**Cobertos:**
- Todas as 15 linhas da tabela têm caso citado pelo nome em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/senha-provisoria.spec.ts`.
- A unidade completa o resto em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.test.tsx`: clique duplo, ENTRA_PELA_CONTA_DA_ESCOLA na geração, leitura que falha, 404 atrasado, troca de sessão e mutação solta ao fechar.
- `ListaDaTurma.test.tsx` cobre a seção da coordenação, e `AlunosDaTurma.test.tsx` o menu da linha e quem saiu da turma.
- Rodei os 4 arquivos de unidade: 107 de 107 passam.
- As 48 mutações batem com as linhas novas com condição do diff. As que conferi ficam vermelhas pelo motivo certo.
- Não há `.skip` nem teste comentado, e nenhum provedor de IA entra.

**Bloqueantes:**
- `e2e/senha-provisoria.spec.ts:334`, caso "recomeço: a resposta atrasada da geração…". A espera `toBeGreaterThanOrEqual(2)` não espera a resposta atrasada, porque o limite já está cumprido antes de `atrasada.abrir()`.
  - As duas entradas de Resource Timing que terminam em `/senha-provisoria` já existem nesse momento: o GET da primeira e o GET da segunda, que a linha 330 já confirmou.
  - O POST segurado só ganha entrada quando termina. As asserções seguintes (`toHaveCount(0)`, `toContainText`) passam na hora, antes de a resposta da primeira chegar.
  - Assim, o caso não falharia se a senha atrasada aparecesse no diálogo do segundo aluno. Esta é a linha da tabela "recomeço: resposta atrasada (`page.route`)", e ela fica sem prova no e2e.
  - Correção exigida: esperar a resposta de verdade antes de afirmar. Por exemplo, `const tardia = page.waitForResponse((r) => r.request().method() === 'POST' && ehOAlvo(cenario.primeira.usuarioId)(new URL(r.url())))` antes de `atrasada.abrir()`, depois `await tardia`, e dar um quadro à tela (`page.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))))`) antes das três asserções. Se ficar a contagem, o limite é `>= 3`.

**Recomendações:**
1. `e2e/senha-provisoria.spec.ts:199-203`: o CONFLITO usa a janela real de 10 s do servidor. Entre a primeira geração e a segunda há copiar, fechar, abrir o menu, um GET e um POST, com CPU 4× e latência de 562–600 ms, e no runner, que leva perto do dobro, a sobra fica curta. A regra do servidor já está provada na integração ([P]). Aqui bastaria `page.route` respondendo 409 `CONFLITO`, como o caso faz com o 429.
2. `DialogoDaSenhaProvisoria.test.tsx:449-452` e `:482-485`: os dois atrasados da geração esvaziam a fila com um só `await Promise.resolve()`. O caminho do `useMutation` é mais longo que o da leitura (o da leitura foi provado por mutação), e as asserções podem rodar antes de a resposta ser processada. Vale um `setTimeout(0)` dentro do `act`, ou um sinal positivo de que a resposta chegou.
3. A pergunta "Fechar sem copiar a senha?" só é testada pelo botão "Fechar". Falta o caso do Esc e do clique fora, que no `Dialog` vão a `pedirParaFechar` mas não têm teste nesta tela.
4. Na coordenação, os alvos de toque não são medidos: "Mostrar alunos aprovados", "Atualizar", o menu "Ações" da linha, e "Voltar à senha" e "Fechar sem copiar" na pergunta. Faltam também 360 px e 44/24 px na seção nova (regra 50, 2a; `cenarios.md` linha 270).
5. `e2e/senha-provisoria.spec.ts:340`: a "segunda pessoa na mesma aba" passa só porque sair navega para `/entrar` e desmonta a tela. O caso não alcança o `aoTrocarDeSessao` do diálogo, que só a unidade prova. Vale dizer isso no nome ou no comentário do caso.
6. `api/lista.ts`: o `refetchOnWindowFocus: false` e o `gcTime: 0` dos aprovados não têm teste. Cada leitura vai à auditoria, então voltar à aba não deveria reler.
7. O objetivo 12.2 diz "fora do log", e nenhum caso confere o console (`page.on('console')` sem a senha nem a matrícula).
8. `cenarios.md` linha 266 diz "cancelar não gera nada (sem auditoria, a senha anterior vale)". O e2e prova que nenhum POST saiu, mas não que a senha anterior ainda entra.

## test-engineer · 2ª rodada · APROVADO · 2026-11-09 17:12:28 · `tasks/prd-acesso-e-convites/12_task.md`

VEREDITO: APROVADO

**Cenários exigidos:** nesta 2ª rodada conferi a correção bloqueante da 1ª e o que o diff afeta:
- a resposta atrasada da geração do primeiro aluno não aparece no diálogo do segundo;
- o Esc e o toque fora da caixa, com a senha na tela e na confirmação;
- as opções da leitura dos aprovados: `gcTime: 0`, sem releitura ao voltar para a aba, `staleTime` infinito e a chave por turma;
- o console da aba sem a senha, a matrícula e o nome;
- a coordenação em 360 px;
- o CONFLITO e o 429 com o aviso que sai na nova tentativa;
- o menu da linha, que agora é um só para as duas telas.

**Cobertos:**
- **Correção exigida, feita.** Em `e2e/senha-provisoria.spec.ts:344-347`, a espera agora é um `waitForResponse` do POST do primeiro aluno, armado antes de `atrasada.abrir()`. Depois vêm `await tardia` e um quadro (`requestAnimationFrame` seguido de `setTimeout 0`), e só então as três asserções.
  - Só a leitura (GET) é abortada no diálogo (`DialogoDaSenhaProvisoria.tsx:67-77`). O POST não é, então a resposta chega à página de verdade.
  - Se a senha atrasada fosse parar no diálogo do segundo aluno, `[data-senha-provisoria]` teria `toHaveCount(0)` vermelho. Se a resposta não chegasse, o caso estouraria o prazo. Ele não passa mais à toa.
- **Esc e toque fora.** Os dois casos novos estão em `DialogoDaSenhaProvisoria.test.tsx:323-356`:
  - com a senha na tela, o `cancel` e o clique fora pedem a pergunta "Fechar sem copiar a senha?" e não chamam `aoFechar`;
  - "Voltar à senha" mantém a senha na tela, e só "Fechar sem copiar" fecha;
  - na confirmação, o Esc fecha na hora.
  - O diálogo não ganhou cláusula nova nesta rodada, então não falta bloco de mutação.
- **Respostas atrasadas na unidade.** As linhas 486 e 519 trocaram `Promise.resolve()` por `setTimeout 0`. Agora a resposta tardia tem uma tarefa inteira para aparecer, e o caso ficou mais forte.
- **Opções da leitura.** `api/lista.test.ts` tem três casos, e cada um tem bloco de mutação no documento (`gcTime`, `refetchOnWindowFocus`, `staleTime`). Os trechos dos blocos batem com `lista.ts:58-61`.
- **Console.** `e2e/senha-provisoria.spec.ts:225-237` junta `console` e `pageerror` e afirma que nenhum deles traz a senha (com e sem hífen), a matrícula ou o nome.
- **CONFLITO e 429.** Os dois passam por `recusarAPrimeiraGeracao` (`e2e/senha-provisoria.spec.ts:209-216`) e provam o aviso, o botão ligado, e que o aviso sai na nova tentativa com a senha gerada. A regra dos 10 s continua provada na integração da API.
- **Coordenação em 360 px.** `e2e/senha-provisoria.spec.ts:472-493` cobre a rolagem de lado, os 44 px de "Mostrar", "Atualizar", "Voltar à senha" e "Fechar sem copiar", os 24 px do menu "Ações", e o diálogo e a senha cabendo na largura.
- **Menu da linha.** `itens-do-menu.ts` só moveu uma constante, sem condição nova. Os testes das duas telas continuam achando o item pelo rótulo.
- Rodei `npx vitest run` sobre `DialogoDaSenhaProvisoria.test.tsx` e `api/lista.test.ts`: os 2 arquivos passaram, 30 casos verdes. O diff não traz `.skip`, teste comentado nem chamada a provedor de IA.

**Bloqueantes:** nenhum.

**Recomendações:**
1. Em `tasks/prd-acesso-e-convites/12_task.md:83`, a linha diz "51 blocos" e, na mesma frase, "os 48 ficaram vermelhos". É preciso atualizar para 51.
2. O título do caso de `e2e/senha-provisoria.spec.ts:472` diz "em 360 px". Se ele roda também no projeto `chromebook`, vale prendê-lo ao projeto `celular` ou tirar a largura do título.
3. Os casos de `api/lista.test.ts` afirmam a configuração (`gcTime`, `staleTime`), não o comportamento: nomes saindo do cache ao desmontar, nenhuma releitura no `focus`. A unidade da tela poderia provar um dos dois com um `QueryClient` de verdade. Não bloqueia, porque as mutações ficam vermelhas.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-09 17:12:29 · `tasks/prd-acesso-e-convites/12_task.md`

VEREDITO: APROVADO

Escopo: respeitado. Desde a 1ª rodada só mudaram três coisas, e nenhuma invade tarefa futura:
- arquivos de teste;
- a lista do menu da linha, que agora fica num arquivo só (`apps/web/src/components/senha-provisoria/itens-do-menu.ts`) e é usada por `AlunosDaTurma.tsx` e `ListaDaTurma.tsx`. Era a minha recomendação, e foi feita sem mudar o rótulo, o ícone nem o id;
- o `12_task.md`.

Aderência à Tech Spec: ok. O diff não muda arquitetura nem contrato. Os dois arquivos novos entraram em "Arquivos previstos", e a divergência da opção A continua registrada na `techspec.md` §5 e §9 e no `cenarios.md`.

Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)").

Bloqueantes: nenhum.

O que conferi nesta rodada:
- **Seção "Revisões" do `12_task.md`:** bate com `tasks/prd-acesso-e-convites/achados/12_task.md` e com o `achados/indice.md`. São sete revisores na 1ª rodada, com os mesmos fins (16:19:27, 16:19:34, 16:19:51, 16:19:54, 16:19:55, 16:20:15, 16:21:22) e os mesmos vereditos (seis APROVADO e o `test-engineer` REPROVADO).
- **"Recomendações sem aplicar":** cada recomendação da 1ª rodada tem destino ou motivo de recusa.
- **Fotos de 17:10–17:11, refeitas nesta rodada:** o menu "Ações" aparece com o único item "Gerar senha provisória" nas duas telas. A confirmação mostra aluno, turma e matrícula, e a senha aparece em dois grupos com "Copiar" e "Fechar". Tudo como na rodada aprovada; a mudança no menu não alterou nada visível.

Recomendações:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/prd-acesso-e-convites/12_task.md:83`: a linha diz "51 blocos" e, logo depois, "os 48 ficaram vermelhos". O texto deveria dizer que os 51 ficaram vermelhos, ou dizer como os três blocos novos de `lista.ts` foram rodados.
2. Os dois casos novos de `DialogoDaSenhaProvisoria.test.tsx` (Esc e toque fora da caixa) não têm bloco de mutação, por exemplo um que faça o `cancel` fechar sem perguntar. Fica como registro; a cobertura é do `test-engineer`.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-09 17:12:54 · `tasks/prd-acesso-e-convites/12_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma. Esta rodada não traz migration nem schema.

Queries verificadas: nenhuma query nova nem alterada no servidor. `apps/web/src/areas/coordenacao/estrutura/api/lista.ts` não mudou desde a 1ª rodada; só ganhou um teste novo das opções da leitura (`gcTime: 0`, `staleTime: Infinity`, `refetchOnWindowFocus: false`, chave com o `turmaId`). A extração para `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/components/senha-provisoria/itens-do-menu.ts` só move a constante do menu. O alvo continua sendo o `usuarioId` da linha que a API devolveu, e nenhum `escolaId` sai do cliente. No e2e, o `page.route` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/senha-provisoria.spec.ts` simula o 409 e o 429 só na tela. Ele não contorna nem enfraquece o escopo do servidor, porque a regra dos 10 s continua provada na integração da API (tarefas 9.0 e 17.0).

Teste de isolamento: presente e efetivo. Ele vem da API das tarefas 9.0 e 17.0, aprovada na 1ª rodada desta tarefa. Nada no diff o altera.

Bloqueantes: nenhum.

Recomendações:
- Continua aberta a recomendação da 1ª rodada, já registrada no `TODO.md`: pôr a escola ativa na chave `['alunos-aprovados-da-turma', turmaId]`. O novo `lista.test.ts` já prova que a chave leva a turma, e esse é o lugar natural para provar também a escola quando a chave mudar.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-09 17:12:57 · `tasks/prd-acesso-e-convites/12_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo nesta rodada. O diff só troca uma constante de lugar e mexe em testes. As telas continuam mostrando o que já mostravam na 1ª rodada: nome do aluno no menu da linha e no diálogo, matrícula e turma na confirmação, e a senha provisória uma vez só.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok. Nada mudou na API. As duas telas só passaram a usar a mesma lista de itens do menu, `ITENS_DA_LINHA_DA_SENHA_PROVISORIA`, que fica em `apps/web/src/components/senha-provisoria/itens-do-menu.ts`. Ela tem um item só, com o mesmo id, rótulo e ícone de antes. O alvo continua sendo o `usuarioId` da linha que a API devolveu.

Logs: limpos. O e2e "a senha fora do navegador" (`e2e/senha-provisoria.spec.ts`, linhas 225-227 e 235-237 do diff) agora também prova que o console e o `pageerror` da aba não levam a senha (com e sem hífen), a matrícula nem o nome do aluno (regra 20, item 9).

Auditoria: presente. Não mudou desde a 1ª rodada. O novo `apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts` prova que a leitura dos aprovados tem `gcTime: 0` (os nomes saem da memória da aba quando a tela fecha), `refetchOnWindowFocus: false` e `staleTime: Infinity`. Assim, nenhuma leitura auditada acontece sem o clique da coordenação. Os três blocos de mutação foram registrados no `12_task.md`.

Envio externo: nenhum. A tarefa não chama IA nem terceiros.

Seed/fixture: sintético. As fotos mostram "Colégio sintético da vitrine cheia/vazia", "Aluno Sintético Caio/Téo" e "Professora Sintética Rosa". As matrículas e as senhas vêm do gerador da vitrine. Os e2e usam o cenário criado pelo próprio teste.

Fotos conferidas:
- `vazia--professora--...-button-name-Gerar-senha-provisória--computador.png`: a senha só aparece dentro do diálogo, junto do nome e da validade, e não aparece na lista.
- `coordenacao--...-Ações-nth-0-Gerar-senha-provisória--computador.png`: a confirmação mostra aluno, turma e matrícula para a coordenação conferir quem é o aluno antes de gerar a senha. A seção tem a leitura auditada pelo clique.
- `professora--...-Ações-nth-0--celular.png` e `coordenacao--...-Mostrar-alunos-aprovados--celular-2.png`: a linha mostra só o nome e as ações. Na coordenação, a matrícula do aprovado não aparece na seção. Os textos de auditoria continuam na tela.

Bloqueantes: nenhum.

Recomendações:
1. O novo caso de e2e em 360 px (linhas 302-323 do diff) gera uma senha real para o primeiro aprovado da coordenação e fecha com "Fechar sem copiar". Está certo para o teste, porque o cenário é criado pelo próprio teste. Fica o registro: em nenhum e2e a geração pode rodar contra o aluno fixo da vitrine. A observação do prompt diz que isso já é evitado nas fotos.
2. As recomendações da 1ª rodada que ficaram para o `TODO.md` e para a retro estão bem encaminhadas no `12_task.md`: a área de transferência em máquina compartilhada, a leitura do alvo pelo professor fora da auditoria e o `getMutationCache()` no e2e.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/.processo/ordens/diff-12_task-r2.txt`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/components/senha-provisoria/itens-do-menu.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/senha-provisoria.spec.ts`

## frontend-reviewer · 2ª rodada · APROVADO · 2026-11-09 17:13:03 · `tasks/prd-acesso-e-convites/12_task.md`

VEREDITO: APROVADO

Tela vista: sim (22 fotos lidas, cheia e vazia: professora e coordenação, computador e celular, cada etapa do fluxo da senha provisória). A foto da coordenação a 1366 px tem a lista cortada no alto porque o miolo rola dentro do contêiner. Não é defeito, e a linha `Rolam` diz que nenhuma tela passa de 768 px de altura.

Estados: ok
- **Com dado e vazio:** vistos nas fotos. Na coordenação, a seção "Alunos aprovados" tem antes do clique o texto que convida a clicar em "Mostrar alunos aprovados". O vazio da lista (`EmptyState` "Nenhum aluno aprovado ainda") diz o próximo passo.
- **Carregando e erro:** conferidos só pelo código, porque a vitrine não os fotografa.
  - Na coordenação, `ListaDaTurma.tsx` tem `LoadingState` e `ErrorState` com "tentar de novo".
  - No diálogo, "Carregando…" e "Gerando…", mais as falhas `CONFLITO` e 429, com texto que diz o que fazer.
- **Ação oficial:** o diálogo tem confirmação e "Cancelar".

Acessibilidade: ok pelo código e pelas fotos.
- O menu leva o nome do aluno ("<nome>: Ações").
- O botão de gerar anuncia "Gerando…" por `role="status"`.
- A senha tem leitura soletrada para leitor de tela.
- O foco volta ao título da seção ao fechar.
- O Esc e o toque fora do diálogo passam pela mesma pergunta de "Fechar sem copiar", agora provado em teste.

Chromebook fraco: sem achado. A lista é paginada com "Ver mais alunos". Não há upload nem imagem nesta tela. O `gcTime: 0` tira os nomes do cache ao fechar, e agora há teste (`lista.test.ts`). Não rodei throttling de rede nem de CPU nesta rodada.

Celular:
- **Largura e rolagem:** sem rolagem horizontal a 360 px em nenhuma foto.
- **Tabela:** a tabela vira cartão.
- **Botões:** os botões "Mostrar", "Atualizar", "Gerar senha provisória" e "Cancelar" têm 44 px ou mais. O menu "Ações" tem cerca de 42 px, acima do mínimo de 24 px.
- **Cobertura:** o novo caso de e2e em 360 px mede os alvos e o transbordamento. Dele só li o diff, não o executei.
- **Dependência do celular:** nada exige o celular.

Ação oficial protegida: sim. A confirmação mostra aluno, turma e matrícula, com a consequência em duas linhas ("A senha atual deixa de valer…", "vale 24 horas, aparece uma vez só…"). A senha só aparece depois do segundo clique. Fechar sem copiar pergunta antes, com os dois botões do mesmo tamanho.

Texto na tela: português do Brasil, data no formato local ("10/11/2026 às 17:11"), sem termo técnico nem id. O diff desde a rodada anterior é só refatoração (`itens-do-menu.ts`, `lista.test.ts` e testes e2e), sem mudança de comportamento. A correção do revisor-geral (menu da linha numa constante só) está feita, e as duas telas usam `ITENS_DA_LINHA_DA_SENHA_PROVISORIA`.

Bloqueantes: nenhum

Recomendações:
1. **"Ações" repetido no cartão do celular.** O rótulo da linha e o texto do botão dizem a mesma coisa nas duas telas. Veja a foto `professora--…--Ações-nth-0--celular.png`. A tarefa já registrou isso no `TODO.md`.
2. **Sem foto do menu aberto no celular.** As fotos "menu Ações aberto" no celular saíram idênticas às anteriores, com o menu fechado. Veja `coordenacao--…-Ações-nth-0--celular-1.png` e a da professora. O menu aberto a 360 px só está coberto pelo e2e, e o validador deve fotografá-lo.
3. **Menu aberto a 1366 px.** Na coordenação, o menu abre além da borda direita da tabela (até cerca de 1082 px, contra 1005 px da tabela). Na foto da professora, ele chega a 1351 px, a 15 px da borda da janela. Cabe na janela, mas vale conferir o encaixe do `Menu` em tela estreita de Chromebook.
4. **Fotos que ficaram para a validação.** A coordenação antes do clique em "Mostrar alunos aprovados" e a senha gerada na coordenação não foram fotografadas.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-09 17:13:21 · `tasks/prd-acesso-e-convites/12_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. O diff desta rodada não grava `Nota` em nenhum caminho. A tarefa só gera a senha provisória do aluno pela web, por POST em `/v1/usuarios/:id/senha-provisoria`. Todos com autor humano? Sim, não há nenhum.

Decisão autônoma sobre aluno: ausente.

Aprovação registrada: ok. Nenhuma saída de IA nasce ou muda nesta tarefa. A geração da senha é ato humano: a pessoa confirma o aluno, a turma e a matrícula antes de gerar. A coluna "Acertos" da aba Alunos continua dizendo "Os acertos são os das correções aprovadas", como já estava.

Supervisão do tutor: ok. O tutor não foi tocado.

Autonomia declarada e visível: sim. Nada mudou na governança.

Bloqueantes: nenhum.

O que conferi nesta rodada (a 2ª):
- **Correções exigidas:** a 1ª rodada não exigiu nenhuma.
- **O diff (7 arquivos):**
  - O item do menu da linha agora está num só lugar, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/components/senha-provisoria/itens-do-menu.ts`, usado por `AlunosDaTurma.tsx` e por `ListaDaTurma.tsx`. O rótulo, o ícone e o id são os mesmos de antes.
  - Entrou `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts`, que testa as opções da leitura dos aprovados: `gcTime` 0, sem releitura ao voltar para a aba, `staleTime` infinito.
  - Entraram casos de Esc e de toque fora da caixa no teste do diálogo.
  - O e2e mudou: o 409 da tela é simulado no navegador, porque a regra dos 10 segundos já é provada na integração da API. Há também um caso novo que confere que o console não leva a senha, a matrícula nem o nome, um caso a 360 px na tela da coordenação e uma espera determinística pela resposta atrasada.
  - Nada disso toca nota, correção, tutor, autonomia, decisão sobre aluno ou indicador de professor. A coordenação não ganha nenhum caminho novo até a conversa do professor nem até métrica nominal de professor.
- **Fotos:** li quatro das fotos listadas, em `.processo/vitrine/`:
  - a aba Alunos da professora com o menu aberto, no computador;
  - a senha gerada no celular, na escola vazia;
  - a seção "Alunos aprovados" da coordenação com o menu aberto, no computador;
  - a confirmação da coordenação no celular.

  Nessas telas não aparece nenhuma saída de IA sem rótulo e nenhuma nota, conceito ou sugestão de nota. Nada induz uso. Fechar é sempre um botão visível, e pergunta antes só quando há senha não copiada na tela. Na confirmação, "Cancelar" está ao lado de "Gerar senha provisória".

Recomendações:
1. O nome "Alunos aprovados" pode ser lido como aprovação de ano, perto demais da regra 70, item 2. Já está registrado na tarefa como pendência de nome de produto para o Arquiteto na retro. Repito para não se perder; não bloqueia.
2. A aba Alunos do professor mostra "Acertos" e "Por habilidade" ao lado do menu "Ações". Hoje o texto de cabeçalho já diz que os acertos vêm de correções aprovadas, e isso basta. Se no futuro a linha ganhar outras ações, convém manter a senha provisória longe de qualquer coisa que pareça ato sobre a trajetória do aluno.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-09 17:13:27 · `tasks/prd-acesso-e-convites/12_task.md`

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
Recomendações: nenhuma nova. As da 1ª rodada continuam valendo e estão registradas em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/prd-acesso-e-convites/12_task.md`:
- a ordenação por nome mistura as linhas novas de "Ver mais alunos" com as que já estavam;
- cada "Atualizar" relê todas as páginas abertas, e cada leitura entra na auditoria.

O que mudou desde a 1ª rodada fica só na web e nos testes:
- **Menu da linha:** a lista de itens saiu das duas telas e foi para um módulo próprio, `itens-do-menu.ts`. A lista é constante e não guarda estado.
- **Opções da leitura dos aprovados:** `lista.test.ts` agora fixa `gcTime: 0`, `staleTime: Infinity` e `refetchOnWindowFocus: false`. Isso garante que a tela não relê a lista sozinha quando a aba volta ao foco, o que geraria leituras extras sob carga.
- **E2E do 409:** a recusa agora é simulada com `page.route`. Nada se perdeu de cobertura: a regra dos 10 s e os dois "gerar" ao mesmo tempo para o mesmo aluno continuam provados no servidor, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/test/senha-provisoria.int.test.ts:533` e `:652`. O caso dos dois cliques simultâneos usa uma barreira entre a checagem e a gravação.
- **Testes novos:** os casos de unidade (Esc, toque fora da caixa) e os de e2e (console sem a senha nem o nome do aluno, a tela a 360 px) nenhum chama provedor pago.

Arquivos auditados nesta rodada:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/components/senha-provisoria/itens-do-menu.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/senha-provisoria.spec.ts`
