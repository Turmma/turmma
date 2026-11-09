# Achados das revisões — `tasks/correcoes/2026-11-09-recomeco-na-mesma-aba-no-celular.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-09 17:50:36 · `tasks/correcoes/2026-11-09-recomeco-na-mesma-aba-no-celular.md`

VEREDITO: APROVADO
Tela vista: sim (11 fotos lidas, escola cheia e vazia, Painel e Governança, 1366 e 360 px). Não fotografei outras abas nem diálogos. A tarefa não os toca.
Estados: ok. O Painel mantém os quatro estados nos dois blocos que a correção toca.
- Carregando: `LoadingState`, em `Painel.tsx:130` e `:152`.
- Erro: `ErrorState` com "tentar de novo", em `Painel.tsx:128` e `:150`.
- Vazio: na foto, 0 nos quatro números e "Nenhuma função da IA trabalhou neste mês". Na Governança vazia, os cartões "A IA ainda não gerou nada nesta escola" e "Nenhuma função trabalhou neste mês" dizem quando a lista vai aparecer.
- Com dado: 7, 3, 1 e 0 no Painel e a lista na Governança.

Acessibilidade: sem mudança de marcação. Não vi regressão nas fotos.
Chromebook fraco: a correção mantém o Painel lendo uma página só, sem reler as N páginas da Governança, e o teste cobre isso (uma leitura em `Painel.test.tsx` e `governanca.test.ts`). Custo declarado na correção: ao abrir a IA, a Governança faz uma leitura a mais do resumo. Aceitável, e a regra 80 não é afetada.
Celular: em 360 px, todas as fotos ficam sem rolagem horizontal e sem texto cortado. "Ver em Registros", "Como cada IA trabalha" e as abas têm tamanho de toque confortável. A barra inferior fixa não esconde conteúdo nas fotos. Português, datas (`09/11/2026, 11:54`) e números estão no formato local, sem termo técnico nem texto em inglês. Os registros mostram o selo de decisão humana ("Aprovado por um professor").
Ação oficial protegida: sim. A tarefa não cria ação oficial, só leitura.

Bloqueantes: nenhum.

Verificações que fiz no código:
- `apps/web/src/areas/coordenacao/governanca/api/governanca.ts:85-88`: a chave `['governanca','resumo','primeira-pagina']` não colide com as chaves por estado (`'pendente'`, `'aprovada'`, `'rejeitada'`).
- O prefixo `['governanca','resumo']` continua alcançando as três consultas numa invalidação.
- A busca por `GOVERNANCA_QUERY_KEY` e por `primeiraPaginaDoResumoQueryOptions` mostra um só consumidor do dado novo: `Painel.tsx:125`. Ele lê `resumo.data.numeros` direto, e a Governança continua só na consulta infinita.
- `governanca.test.ts` reproduz a sequência do defeito: Governança lida e largada, Painel ativo, `resetQueries` da sessão nova e Governança de novo. Ele usa o `QueryClient` real. Afirma que cada "página" tem `itens` e que não aparece `undefined` na lista.

Recomendações:
- O frescor padrão de 30 s deixou de poupar a releitura quando a pessoa vai do Painel à IA. Se a medição da N2 mostrar peso na manhã de segunda, vale um `staleTime` próprio na consulta do Painel. Não bloqueia.
- A prova de que os dois e2e do celular (`governanca.spec.ts:265`, `agentes.spec.ts:307`) voltam a passar é a esteira do push. A tarefa já diz isso, e o Orquestrador precisa ler essa esteira.
- Nas fotos, "Aprovado por gente" no Painel e "Aprovado por um professor" nos registros nomeiam a mesma coisa de dois jeitos. É texto antigo, fora desta tarefa, e fica só como observação.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-09 17:50:55 · `tasks/correcoes/2026-11-09-recomeco-na-mesma-aba-no-celular.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. A mudança fica só no cache do `apps/web` (chave da consulta do Painel). Nenhum caminho novo grava Nota, então nenhum deixa de ter autor humano.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. A tarefa não cria nem muda fluxo de aprovação. Os quatro números (gerado, aprovado por gente, esperando o professor, rejeitado) e a lista "O que a IA gerou e quem aprovou" continuam vindo de `/v1/governanca/resumo`. Nas fotos da escola cheia, Painel e Registros mostram os mesmos 7 / 3 / 1 / 0, e cada linha mostra a decisão com a data ("Aprovado por um professor · 09/11, 11h54").
Supervisão do tutor: ok. A tarefa não toca o tutor.
Autonomia declarada e visível: sim. O link "Como cada IA trabalha" continua em Registros › IA, no computador e no celular, nas duas escolas. Era esse o link que o e2e `agentes.spec.ts:307` não achava quando a área caía na fronteira de erro.

Bloqueantes: nenhum.

O que conferi:
- **Auditoria (item 6).** O defeito que a correção resolve era uma regressão contra a regra 70: a tela "o que a IA gerou, quem aprovou e quando" caía na fronteira de erro quando outra pessoa entrava na mesma aba. A coordenação ficava sem a consulta de auditoria. Com a chave própria do Painel (`governanca.ts:86`), Painel e Governança não guardam mais dado um do outro.
- **O teste reproduz o defeito.** O primeiro caso de `governanca.test.ts` usa o `QueryClient` real, a consulta infinita lida e largada, o Painel ativo e o `resetQueries`, e falha no HEAD. As duas mutações do arquivo da tarefa cobrem a chave dividida.
- **Invalidação.** A chave nova `['governanca','resumo','primeira-pagina']` fica sob o prefixo `resumo`. Além disso, nenhum código fora de teste em `apps/web/src` invalida as chaves da governança, então nada que a coordenação vê deixa de ser relido por causa da troca.
- **Fotos.** Em nenhuma das dez aparece nota, conceito ou sugestão de nota. O texto da tela diz que nada chega ao aluno sem um professor aprovar e que o Tutor é acompanhado. O consumo é somado por função, sem professor nem aluno (D64), e a lista não mostra quem decidiu. Não há ranking nem indicador nominal de professor. A escola vazia mostra o convite para agir em vez de uma tela vazia.

Recomendações:
- Como o Painel e a Governança agora têm caches separados, os quatro números podem ficar diferentes por alguns minutos entre as duas telas. O Painel não relê sozinho (`semLeituraSozinha`), e a Governança faz uma leitura própria. Para uma tela que a coordenação mostra em reunião como prova de auditoria, vale uma linha no texto do Painel ("números de quando você abriu o Painel") ou reler a consulta do Painel ao voltar da Governança. Não bloqueia: o dado de cada tela é correto para o momento em que foi lido.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/governanca/api/governanca.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/governanca/api/governanca.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/painel/Painel.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/painel/Painel.test.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/correcoes/2026-11-09-recomeco-na-mesma-aba-no-celular.md

## test-engineer · 1ª rodada · APROVADO · 2026-11-09 17:51:05 · `tasks/correcoes/2026-11-09-recomeco-na-mesma-aba-no-celular.md`

VEREDITO: APROVADO

Cenários exigidos:
- **Caminho feliz:** o Painel lê só a primeira página do resumo na consulta dele e mostra os quatro números da escola.
- **Borda 1:** a pessoa seguinte na mesma aba. A coordenação de A abre a Governança e sai, o Painel de B está na tela durante o `resetQueries` da sessão nova, e depois B abre a Governança. Ela precisa receber uma lista de itens, nunca uma "página" sem `itens`.
- **Borda 2:** a ordem inversa. O Painel lê primeiro e a Governança depois, e a Governança não pode herdar a página do Painel.
- **Borda 3:** a Governança já paginou três páginas e o resumo ficou velho. O Painel lê uma página só e não reescreve a lista da Governança.
- **Permissão:** não se aplica. Nada no diff toca API, papel ou rota; a mudança é só de chave de cache no `apps/web`.
- **Isolamento:** entre pessoas na mesma aba. Depois do reset da sessão, B vê os números de B e não o cache de A.
- **Concorrência:** não há operação que possa rodar duas vezes ao mesmo tempo. A corrida da esteira dependia de ordem entre a leitura do Painel e o reset, e o teste a reproduz em ordem fixa, sem depender do tempo da máquina.

Cobertos:
- **Borda 1:** `governanca.test.ts` › `não dividem consulta: o Painel que relê depois do reset da sessão nova não embrulha o dado na lista da Governança`. Confere `Array.isArray(pagina.itens)`, que nenhuma linha é `undefined`, e que `numeros` são os de B (`DA_ESCOLA`), não os de A (`VAZIO`). Cobre também o isolamento entre pessoas.
- **Borda 2:** `governanca.test.ts` › `o Painel lido primeiro e a Governança depois…`. Confere uma página com `itens: []`, a leitura a mais declarada no documento e o cache do Painel no formato da API.
- **Caminho feliz:** `governanca.test.ts` › `o Painel lê uma página só…` e `Painel.test.tsx` › `mostra os quatro números…`.
- **Borda 3:** `Painel.test.tsx` › `o resumo que a Governança paginou, velho…`, reescrito para afirmar o desenho novo: a lista paginada fica intacta (`toEqual(paginado)`) e a chave do Painel guarda a página dele.
- **Mutações:** os três blocos batem com o `git diff`.
  - O bloco 2 é exatamente o código do HEAD, então ele mesmo prova o vermelho no HEAD do teste que reproduz o defeito.
  - O bloco 1 isola a chave própria do Painel.
  - O bloco 3 isola a leitura de `resumo.data.numeros` no `Painel.tsx`.
  - `--faltando` deu 0 linhas, e nenhuma cláusula nova ficou sem bloco.
- **Testes rodados:** `npx vitest run` nos dois arquivos deu 40 de 40 verdes. Não há `.skip` nem teste comentado. O mock é só a `authedGet`, que é a borda de rede; o `QueryClient` real, as duas consultas e o `resetQueries` são os de verdade, então o mock não esconde a regra. Não há IA envolvida.

Bloqueantes: nenhum.

Recomendações:
1. `apps/web/src/areas/coordenacao/governanca/api/governanca.ts:82-83`: o comentário justifica a chave dentro de `resumo` dizendo que assim "uma invalidação do prefixo [alcança] a lista, o filtro por estado e esta". Mas nenhum código do `apps/web/src` invalida `['governanca', 'resumo']` por prefixo (procurei por `invalidateQueries` e `setQueriesData` com essa chave). A justificativa descreve um uso que não existe e que nenhum teste fixa. Ou o texto diz que é para uma invalidação futura, ou ganha um teste que prove que a invalidação do prefixo alcança as três consultas.
2. O mesmo prefixo é um risco para o futuro. Um `setQueriesData` sobre `['governanca', 'resumo']` aplicaria a mesma função de atualização a dois formatos de dado diferentes: a página do Painel e a lista da Governança. Vale uma linha no comentário avisando que esse prefixo não aceita `setQueriesData`.
3. Os dois e2e da esteira (`e2e/governanca.spec.ts:265` e `e2e/agentes.spec.ts:307`) não mudaram, e o próprio documento diz que já passavam na máquina antes da correção. A prova de que a correção os conserta no celular fica com a esteira do push. O Orquestrador precisa ler esse veredito antes de dar a correção por fechada.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/correcoes/2026-11-09-recomeco-na-mesma-aba-no-celular.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/governanca/api/governanca.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/governanca/api/governanca.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/painel/Painel.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/painel/Painel.test.tsx

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-09 17:51:35 · `tasks/correcoes/2026-11-09-recomeco-na-mesma-aba-no-celular.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: divergência em `tasks/prd-telas-da-coordenacao/techspec.md`, §7c (linha 96) e Registros › IA (linha 125)
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)

Bloqueantes:

- **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/governanca/api/governanca.ts:85-88`: a correção desfaz uma decisão escrita na Tech Spec, e a Tech Spec não foi atualizada.**
  - **O que a Tech Spec diz hoje.** O desenho com o Painel e a Governança na mesma chave foi decidido lá, em três lugares:
    - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/prd-telas-da-coordenacao/techspec.md:96`: "o Painel relê só a primeira página, mesmo com a Governança tendo paginado a mesma chave".
    - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/prd-telas-da-coordenacao/techspec.md:125`: "`consultaResumoDaGovernanca`, a mesma chave de antes, que o Painel também lê".
    - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/prd-telas-da-coordenacao/2_task.md:60`: "use a mesma chave e só a primeira página".
  - **O que a correção fez.** Pôs o Painel numa chave própria, `['governanca','resumo','primeira-pagina']`, e aceitou uma leitura a mais do resumo cada vez que a Governança abre.
  - **Onde ficou registrado.** Só no documento da correção. A Tech Spec continua descrevendo um mecanismo que já não existe.
  - **Por que é bloqueante.** É o caso que `.claude/skills/corrigir/SKILL.md:22-24` manda parar: o defeito mostra que a Tech Spec estava errada. Pelas regras desta revisão, divergência registrada só no documento da tarefa reprova.
  - **Correção exigida.** O código pode ficar como está. Antes do commit, mandar `/seguir DIVERGÊNCIA de Implementador` com `Motivo: desenho`, ou pedir a triagem ao Orquestrador. O Arquiteto alinha a Tech Spec, como foi feito em correções anteriores ("Alinha a Tech Spec §13…"):
    - Linha 96: o Painel lê a primeira página numa chave só dele, e abrir a Governança custa uma leitura a mais do resumo.
    - Linha 125: a consulta sem filtro tem chave só da Governança.
    - Linha 125: acrescentar a regra de que consulta simples e consulta infinita não dividem chave.

Recomendações:

- O caso de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/painel/Painel.test.tsx:820` ainda envelhece o cache em `avancar(CINCO_MINUTOS_E_UM)` e tem "velho" no título. Com a chave separada, essa espera não prova mais nada. Vale tirar a espera ou renomear o caso para o que ele prova agora: o Painel não escreve na lista da Governança.
- O comentário de `governanca.ts:76-84` conta a história da correção. Basta a regra (consulta simples e infinita não dividem chave) e o motivo de a chave ficar sob `resumo`. A história já está no documento da correção.
- Painel e Governança agora guardam os números em consultas separadas, então as duas telas podem mostrar números diferentes por alguns minutos. O `conformidade-reviewer` já recomendou isso; deixar registrado na Tech Spec junto com o ajuste do bloqueante.
- Os dois e2e do celular que falharam só se confirmam na esteira do push. O documento já diz isso, e quem confere é o Orquestrador.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-09 18:00:43 · `tasks/correcoes/2026-11-09-recomeco-na-mesma-aba-no-celular.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. A Tech Spec e a 2_task agora dizem o que o código faz.
- O bloqueante da 1ª rodada foi resolvido no commit 27f0e9f2.
- Linha 96 de `techspec.md`: o Painel lê a primeira página numa chave só dele, `['governanca', 'resumo', 'primeira-pagina']`, e abrir a Governança custa uma leitura a mais do resumo.
- Linha 125 de `techspec.md`: a consulta sem filtro tem chave só da Governança. Entrou a regra "Consulta simples e consulta infinita não dividem chave", com o aviso de que o prefixo não aceita `setQueriesData`.
- `2_task.md:38` e `2_task.md:60` foram alinhados do mesmo jeito.
- A nota de que Painel e Governança podem mostrar números diferentes enquanto a leitura do Painel está dentro dos 5 minutos de frescor ficou na mesma linha 125, com remissão à seção 7c, "Releitura". Os 5 minutos batem com o `staleTime` que a Releitura declara para os blocos do Painel.

Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo).

Bloqueantes: nenhum.

O que conferi no diff desta rodada:
- `governanca.ts:79-82`: mudou só o comentário. Ele agora diz a regra e não conta mais a história da correção.
- `Painel.test.tsx:820`: o título agora diz o que o caso prova, e a espera `avancar(CINCO_MINUTOS_E_UM)`, que não provava mais nada, saiu. A constante continua em uso nos outros casos (linhas 811, 853, 865 e 898), então não ficou nada sem uso.
- O documento da correção explica as duas mudanças. "Recomendações sem aplicar" registra cada recomendação recusada, com o motivo e o destino.
- Fotos de `/coordenacao/painel` e `/coordenacao/governanca` no celular, escola cheia: os quatro números batem entre as duas telas (7, 3, 1, 0). Os nomes são os de antes, e a tela não traz nada novo, como esperado numa rodada que não muda tela.

Recomendações:
- A 2_task cita `apps/web/src/api/governanca.ts` (linha 38) e `apps/web/src/areas/coordenacao/Painel.test.tsx` no comando de rodar (linha 58), mas os arquivos hoje estão em `apps/web/src/areas/coordenacao/governanca/api/governanca.ts` e `apps/web/src/areas/coordenacao/painel/Painel.test.tsx`. Não vem desta correção. Vale o Arquiteto acertar os dois caminhos na próxima vez que mexer no documento.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/governanca/api/governanca.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/painel/Painel.test.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/prd-telas-da-coordenacao/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/prd-telas-da-coordenacao/2_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/correcoes/2026-11-09-recomeco-na-mesma-aba-no-celular.md

## test-engineer · 2ª rodada · APROVADO · 2026-11-09 18:00:43 · `tasks/correcoes/2026-11-09-recomeco-na-mesma-aba-no-celular.md`

VEREDITO: APROVADO

Cenários exigidos (os mesmos da 1ª rodada; esta rodada só confere o que mudou):
- **Caminho feliz:** o Painel mostra os quatro números e o consumo.
- **Borda: a Governança lida primeiro.** Ela paginou três vezes, e depois o Painel abre.
- **Borda: o Painel lido primeiro.** Depois a Governança abre e não pode herdar a página do Painel.
- **Borda: a coordenação seguinte na mesma aba.** O `resetQueries` da sessão nova faz o Painel reler, e o dado dele não pode ir parar dentro da lista da Governança.
- **Carga (regra 80):** o Painel lê uma página só, e nunca as N páginas que a Governança paginou.
- **Permissão e isolamento:** não se aplicam. Não há rota nem repository novos; a mudança é só de chave de cache no cliente.

Cobertos:
- **O que mudou.** No código só mudaram três coisas, e nenhuma condição nova:
  - o comentário de `primeiraPaginaDoResumoQueryOptions`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/governanca/api/governanca.ts:79-82`;
  - o título do caso do Painel;
  - a saída do `avancar(CINCO_MINUTOS_E_UM)`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/painel/Painel.test.tsx:820-844`.
- **Mutações.** Os três blocos `mutacao` do documento continuam iguais, e os arquivos de código que eles alteram não mudaram nesta rodada. Nenhuma cláusula nova ficou sem bloco.
- **A espera de 5 minutos que saiu deixou o caso mais forte.** Agora a lista da Governança está fresca no cache, e mesmo assim o caso exige que o Painel faça uma leitura do resumo, na chave dele. Se a chave voltar a ser a da Governança (o desenho antigo), o caso fica vermelho por dois motivos:
  - com o frescor de 5 minutos, o Painel não leria nada, e `leituras` sairia vazio;
  - `getQueryData(primeiraPaginaDoResumoQueryOptions.queryKey)` sairia `undefined`.

  As asserções olham o resultado: os números de agora na tela (`'7'`), a lista da Governança intacta (`toEqual(paginado)`) e a página do Painel na chave dele.
- **Minha recomendação da 1ª rodada foi atendida.** O comentário não diz mais que alguma invalidação do prefixo alcança as três consultas, e avisa que o prefixo `['governanca', 'resumo']` não aceita `setQueriesData`, com o motivo (dois formatos de dado na mesma família de chaves).
- **Os documentos batem com o código.** A Tech Spec (§7c, carga, e §9, Registros › IA) e a `2_task.md` agora descrevem a chave própria do Painel, sem o "mesma chave da consulta infinita" de antes. O documento da correção registra a troca de título e o motivo de a espera ter saído.
- **Os testes passam.** Rodei `npx vitest run --project unidade` em `Painel.test.tsx` e `governanca.test.ts`: 2 arquivos, 40 testes, todos verdes. Não há `.skip`, teste comentado nem mock que esconda a regra. A rede falsa é a de caminho, já usada na 1.0.

Bloqueantes: nenhum.

Recomendações:
- Os dois e2e do celular (`governanca.spec.ts:265` e `agentes.spec.ts:307`) seguem confirmados só na esteira do push. Isso já está registrado em "Recomendações sem aplicar" como leitura do Orquestrador antes de fechar a correção.
