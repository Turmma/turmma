# Achados das revisões — `tasks/correcoes/2026-11-21-e2e-operacao-aviso-da-sessao-no-celular.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-21 19:17:58 · `tasks/correcoes/2026-11-21-e2e-operacao-aviso-da-sessao-no-celular.md`

VEREDITO: APROVADO
Tabelas verificadas: nenhuma. A tarefa não cria nem altera migration nem schema.
Queries verificadas: nenhuma. A tarefa não mexe em repository, query nem endpoint. A mudança é só no e2e: `e2e/operacao.spec.ts` ganha uma linha que chama a função nova, e `e2e/support/operacao-screen.ts` ganha a função `esperarAListaDeEscolas`, que só espera o texto "Carregando as escolas…" sumir da tela.
Teste de isolamento: não exigido. A correção não traz módulo novo nem escopo novo, e não toca em teste de isolamento que já existe.
Bloqueantes: nenhum.
Recomendações:
- `esperarAListaDeEscolas` (`e2e/support/operacao-screen.ts:40`) usa `toHaveCount(0)`, que também passa se o "Carregando as escolas…" ainda não tiver aparecido na tela. Isso não afeta o isolamento. Fica para o `test-engineer` decidir se vale também esperar a lista ou o estado vazio aparecerem.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-21 19:18:02 · `tasks/correcoes/2026-11-21-e2e-operacao-aviso-da-sessao-no-celular.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A mudança vale só para o e2e. Há uma função nova de espera, `esperarAListaDeEscolas`, e uma chamada a ela no E3. O teste só lê um rótulo de estado de carga ("Carregando as escolas…"). Nenhum campo de pessoa foi criado, lido ou exibido.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok. Nenhuma rota, repository nem DTO mudou. O E3 continua com a mesma sessão de operador de antes.

Logs: limpos. Não entrou log, nem no teste nem no produto.

Auditoria: não se aplica. A tarefa não toca leitura de dado de aluno, exportação, nota, permissão nem aprovação de saída de IA.

Envio externo: nenhum. Não houve envio externo, nem passagem pela porta de IA.

Seed/fixture: sintético. O operador vem de `criarOperadorComSegundoFator`, como antes, e é da equipe Turmma, não titular aluno. Nenhum seed foi alterado.

Bloqueantes: nenhum.

Recomendações:
- `e2e/support/operacao-screen.ts:41`: `toHaveCount(0)` também passa se o "Carregando as escolas…" nunca tiver aparecido, ou se o rótulo mudar em `apps/web/src/operacao/pages/Escolas.tsx:245`. Esperar um sinal positivo de que a lista assentou é mais robusto: o estado vazio, a tabela, ou o `waitForResponse` do `GET /v1/operacao/escolas`. Isso não bloqueia: é robustez do teste, não privacidade, e fica com o `test-engineer`.

Pergunta de fechamento: a resposta à secretaria, sobre tudo o que o sistema guarda de um aluno e para onde já foi, não muda com esta tarefa. Nenhum dado, nenhum destino e nenhum caminho de arquivo do titular foram tocados.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-21 19:18:10 · `tasks/correcoes/2026-11-21-e2e-operacao-aviso-da-sessao-no-celular.md`

VEREDITO: APROVADO

A mudança mexe só em teste de ponta a ponta: um ajudante novo que espera a lista de Escolas terminar de carregar, chamado no caso E3 antes de o relógio falso saltar. Nenhum código de produção mudou, e a área do operador não grava nota, não decide nada sobre aluno e não toca tutor nem agente.

Caminhos de escrita em Nota: nenhum nesta tarefa — todos com autor humano? sim (nada foi alterado)
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok (nenhum fluxo de saída de IA tocado)
Supervisão do tutor: ok (não tocado)
Autonomia declarada e visível: sim (não tocada)
Bloqueantes: nenhum
Recomendações:
- `e2e/support/operacao-screen.ts:40`: o `toHaveCount(0)` passa na hora se o "Carregando as escolas…" ainda não tiver aparecido. Isso só é seguro se, quando o banner aparece, a tela de Escolas já está montada com a busca pendente, e é isso que a tarefa afirma. Pela regra 70 nada muda, mas o `test-engineer` pode querer que o caso espere a lista chegar (a resposta do `GET /escolas`, ou um item da lista) em vez de esperar o carregando sumir.
- Ainda pela regra 70: o E3 continua provando que "Continuar na sessão" e "Sair" têm a mesma altura (`e2e/operacao.spec.ts:368-370`), ou seja, sair não ficou mais difícil que continuar (D59). A mudança não mexe nisso.

Conferi:
- `e2e/operacao.spec.ts`
- `e2e/support/operacao-screen.ts`
- `apps/web/src/operacao/pages/Escolas.tsx:245`: o texto que o ajudante espera vem do `LoadingState` desta linha.
- `apps/web/src/components/states/LoadingState.tsx:15`: o `LoadingState` tem de fato `role="status"`.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-21 19:18:11 · `tasks/correcoes/2026-11-21-e2e-operacao-aviso-da-sessao-no-celular.md`

VEREDITO: APROVADO

Caminho quente tocado: nenhum. A mudança é só de teste e2e, em `e2e/operacao.spec.ts` e `e2e/support/operacao-screen.ts`. O código de produção não muda.

Rate limit: ok (não foi tocado)

Fila e prioridade: ok (não foi tocada)

Concorrência: protegida (não foi tocada). A corrida corrigida está no teste: o relógio falso salta com o `GET /escolas` ainda no ar. No produto não há corrida. Uma requisição aceita conta como uso pelo RF5, então o aviso sair depois dela é o comportamento esperado.

Índice e paginação: ok (não foram tocados)

Degradação de IA: não se aplica

Migration: não se aplica

Métrica e alerta: ok (não foram tocados)

Bloqueantes: nenhum

Recomendações:
- `e2e/support/operacao-screen.ts:41`: hoje o ajudante só confere que não há nada na tela, com `toHaveCount(0)`. Se a tela de Escolas ainda não tiver montado o `LoadingState` quando o ajudante rodar, a conferência passa sem ter esperado nada. Hoje isso não acontece, porque `Escolas` é importada direto em `apps/web/src/operacao/routes.tsx:23` e monta junto com a casca. Mesmo assim, o ajudante ficaria mais firme se também conferisse que a lista terminou de carregar: a lista com dado, o estado vazio ou o botão "Nova rede". Assim ele não dependeria de quando a tela monta.
- O ajudante foi usado só no E3. Se a esteira falhar do mesmo jeito em `operacao-escolas.spec.ts:657` ou em `operacao.spec.ts:302`, ele já existe e pode ser chamado nesses casos.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-21 19:18:13 · `tasks/correcoes/2026-11-21-e2e-operacao-aviso-da-sessao-no-celular.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok (a correção mexe só no teste, nenhum código de produção mudou)
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum

O que conferi:
- **A espera tem o que esperar.** O texto "Carregando as escolas…" vem do `LoadingState` (`role="status"`), em `apps/web/src/operacao/pages/Escolas.tsx:245`. A tela de Escolas não é carregada à parte: ela monta dentro de `ComSessao`, junto com a casca (`apps/web/src/operacao/routes.tsx:113`). Então, quando o banner aparece, o estado de carregamento já pode estar na tela.
- **A espera está no lugar certo.** `esperarAListaDeEscolas` é chamada antes do primeiro `fastForward` (`e2e/operacao.spec.ts:355`). O produto não mudou, e o prazo do teste também não.
- **O seletor já era usado.** Os outros testes da operação procuram o mesmo texto do mesmo jeito (`e2e/operacao-escolas.spec.ts:145`, `:241`, `:651`).

Recomendações:
- `e2e/support/operacao-screen.ts:41`: a espera só confere que o "Carregando…" não está na tela. Ela também passa se o carregamento ainda não tiver aparecido. Hoje isso não acontece, porque a tela monta junto com a casca. Mas, se a tela de Escolas passar a ser carregada à parte ou a montar depois, a espera passa sem esperar nada, e a corrida volta sem aviso. Uma versão mais firme espera algo que só existe com a lista pronta, como a lista ou o estado vazio, ou ainda a resposta `GET /v1/operacao/escolas` com `ok()`.
- O comentário em `e2e/operacao.spec.ts:354` repete em uma linha o que o JSDoc do ajudante (`e2e/support/operacao-screen.ts:34-39`) já explica. Basta um dos dois.

## test-engineer · 1ª rodada · APROVADO · 2026-11-21 19:18:40 · `tasks/correcoes/2026-11-21-e2e-operacao-aviso-da-sessao-no-celular.md`

VEREDITO: APROVADO

Cenários exigidos:
- Caminho feliz: o E3 segue provando, no `celular` e no `chromebook`, quatro coisas. Nada aparece aos 26 min e meio. O aviso aparece aos 27 min, com o texto, os botões do mesmo tamanho e o alvo de 44 px. "Continuar" gera um `GET /v1/operacao/eu` aceito e o aviso sai. Parada até o fim, a aba vai à entrada com a mensagem.
- Borda 1: a lista de Escolas ainda no ar quando o relógio salta (a corrida da esteira).
- Borda 2: a repetição da consulta renova o token vencido no relógio falso e conta como uso. É comportamento certo do produto (RF5), e o teste não pode depender dele não acontecer.
- Permissão e isolamento: não se aplicam. A correção é só de e2e, não toca código de produção nem dado de escola.

Cobertos:
- Borda 1: `esperarAListaDeEscolas(page)` (`e2e/support/operacao-screen.ts:40-42`) é chamada em `e2e/operacao.spec.ts:355`, antes do primeiro `fastForward`. Conferi que a espera não passa à toa:
  - Em `apps/web/src/operacao/routes.tsx:110-115`, `<Escolas />` é filho de `ComSessao`, importado sem `lazy`. A tela monta na mesma árvore da casca, então o `useQuery` dela já está pendente antes de o banner mostrar o nome, que vem do `/eu`. Quando `esperarCasca` retorna, o "Carregando as escolas…" já existiu ou ainda está na tela.
  - `LoadingState` renderiza `<p role="status">` (`apps/web/src/components/states/LoadingState.tsx:15`). É o mesmo seletor que `e2e/operacao-escolas.spec.ts:241` usa com `toBeVisible`, o que prova que ele acha o elemento.
  - Durante as repetições do TanStack a consulta continua `isPending`, então a espera só termina quando a lista assenta, com sucesso ou com o erro final.
- Borda 2: o conserto está no teste, sem afrouxar o produto nem o prazo. As asserções do E3 continuam sobre o resultado: o aviso fica oculto e depois visível, o `/eu` responde ok, a URL é `/operacao/entrar` e a mensagem final aparece. Não há `.skip`, `page.route` deixado no arquivo nem mock que esconda o relógio de inatividade.
- Mutações: o `--faltando` dá 0 linhas, não há código em `apps/*/src` nem `packages/*/src`, e o RF17 não se aplica. A chamada nova não tem bloco de mutação, porque o vermelho dela só existe com a lista lenta. A prova veio pela corrida forçada à mão, descrita em "Teste que reproduz": ela deu a mesma assinatura da esteira sem o conserto e passou com ele. Para estabilizar um teste sem mexer em produção, isso basta.

Bloqueantes: nenhum.

Recomendações:
1. `e2e/operacao.spec.ts:302` (E2) e `e2e/operacao-escolas.spec.ts:657` também saltam o relógio logo depois de entrar. O documento explica por que não precisam do ajudante. Se a esteira cair num deles com a mesma assinatura, vale aplicar `esperarAListaDeEscolas` de uma vez a todo caso que chama `fastForward` depois de `entrarNaOperacao`, em vez de corrigir um por um.
2. A corrida só se prova à mão. Fica registrado para a retro que um teste de unidade do `useOperatorIdleTimeout` (qualquer requisição aceita reagenda o aviso) documentaria o mecanismo sem os 3 s de atraso no e2e. O E3 já cobre o "Continuar" como uso.
3. Não rodei o e2e: ele precisa da pilha no ar, e o portão da tarefa roda o caso alterado e mede o prazo dele (metade de 30 s). Os 22 s do documento são da corrida forçada, com 7 s de atraso injetado, e não valem como medida do caso normal. Vale olhar a duração que o portão registrar.

Arquivos auditados:
- e2e/operacao.spec.ts
- e2e/support/operacao-screen.ts
- tasks/correcoes/2026-11-21-e2e-operacao-aviso-da-sessao-no-celular.md
- apps/web/src/operacao/routes.tsx (consultado)
- apps/web/src/operacao/pages/Escolas.tsx (consultado)
- apps/web/src/components/states/LoadingState.tsx (consultado)

## revisor-geral · 2ª rodada · APROVADO · 2026-11-21 20:10:07 · `tasks/correcoes/2026-11-21-e2e-operacao-aviso-da-sessao-no-celular.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. É uma correção só de e2e: o produto e o prazo do teste não mudaram. O documento descreve a 2ª versão e o motivo da troca.

Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")

Bloqueantes: nenhum

O que conferi neste diff:
- **A recomendação da 1ª rodada foi aplicada.** `esperarAListaDeEscolas` (`e2e/support/operacao-screen.ts:42`) agora espera a lista ou o estado vazio aparecer, e não mais o "Carregando as escolas…" sumir. A versão antiga passava sem esperar nada se a tela ainda não tivesse montado.
- **Os dois sinais existem na tela de verdade.** A região "Lista de escolas" vem de `apps/web/src/operacao/pages/Escolas.tsx:255`, uma `section` com `aria-label`, e por isso tem papel de região. O texto "Nenhuma escola ainda." vem de `Escolas.tsx:250`.
- **O `.or` não tropeça no modo estrito do Playwright.** Os dois sinais nunca aparecem juntos, porque saem de ramos diferentes do ternário em `Escolas.tsx:244-259`.
- **O comentário que repetia o JSDoc saiu** de `e2e/operacao.spec.ts:354`.
- **As recomendações sem aplicar têm destino registrado.** A que foi recusada, com o motivo, está na seção "Recomendações sem aplicar" do documento. O teste de unidade de `useOperatorIdleTimeout` está no `TODO.md`.

Recomendações:
- **O caso de erro e o caso fora da última página travam o ajudante.** Se a lista vier com erro sem dado anterior (`Escolas.tsx:246`) ou cair no vazio de uma página além da última (`Escolas.tsx:252`), nenhum dos dois sinais aparece. O ajudante então espera até o `SIGN_IN_TIMEOUT_MS` e falha com uma mensagem que não aponta a causa. Hoje o E3 não passa por esses estados, mas vale citar isso no JSDoc para quem reusar o ajudante em outro caso.
- **O texto do estado vazio está escrito à mão no e2e.** `'Nenhuma escola ainda.'` está em `operacao-screen.ts` e também em `TEXTO_DA_LISTA_VAZIA` (`apps/web/src/operacao/textos.ts:156`). Se o texto mudar, o ajudante quebra em silêncio e só falha por timeout. Fica como recomendação, salvo se o projeto já tiver convenção de não importar `apps/web` nos e2e.

## test-engineer · 2ª rodada · APROVADO · 2026-11-21 20:10:16 · `tasks/correcoes/2026-11-21-e2e-operacao-aviso-da-sessao-no-celular.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- **Caminho feliz:** o E3 da operação. O aviso aparece aos 27 min, o toque no "Continuar" conta como uso e o aviso sai. Parada até o fim, a aba vai à entrada.
- **Borda 1:** a lista de Escolas ainda está carregando quando o relógio salta. A chamada estoura o prazo, a repetição é aceita e apaga o aviso.
- **Borda 2:** banco de teste vazio, como a esteira tem em cada job. A lista não tem região e mostra o estado vazio.
- **Borda 3:** banco cheio de escolas de outras execuções. A lista mostra a região com dado.
- **Permissão e isolamento:** não se aplicam. A correção é só de teste e não toca dado de escola.

**Cobertos:**
- **Correção da 1ª rodada:** a única pendência era trocar a espera pela ausência do "Carregando as escolas…" (`toHaveCount(0)`) por um sinal de que a lista chegou. Foi feita em `e2e/support/operacao-screen.ts:44-49`: espera a região "Lista de escolas" ou o texto "Nenhuma escola ainda.".
  - Conferi contra `apps/web/src/operacao/pages/Escolas.tsx:244-283`. Os dois sinais só são montados depois que `escolas.isPending` fica falso. A região é a `ScrollableList` (`rotulo="Lista de escolas"`, linha 255) e o texto é o título do estado vazio (`TEXTO_DA_LISTA_VAZIA.titulo`, `apps/web/src/operacao/textos.ts:156`). Nenhum dos dois aparece durante o carregamento, então a espera não passa antes de a consulta terminar, como passava a 1ª versão se a tela ainda não tivesse montado.
  - Os dois nunca aparecem juntos, então o `.or` não cai no modo estrito do Playwright.
  - O `.or` cobre os dois estados de banco: vazio na esteira e cheio na máquina.
  - Se a lista der erro (`ErroDaOperacao`), a espera estoura e o teste cai com a causa à vista. É o comportamento certo, e não esconde nada.
- **Chamada no teste:** o E3 chama o ajudante logo depois de `entrarNaOperacao` e antes do primeiro `fastForward` (`e2e/operacao.spec.ts:354`). O comentário duplicado saiu, e o JSDoc do ajudante explica o porquê.
- **Mutações:** nenhum código de produção mudou, e o `--faltando` dá 0. A falta de bloco para a chamada do ajudante está justificada no documento: o vermelho só existe com a lista lenta. A corrida forçada à mão, com a mesma assinatura da esteira, está registrada em "Teste que reproduz".
- **TODO.md:** a linha nova dá destino à recomendação da 1ª rodada (teste de unidade de `useOperatorIdleTimeout`). As três recomendações da 1ª rodada estão na seção "Recomendações sem aplicar", cada uma com destino ou motivo.
- **Proibidos:** o diff não tem `.skip`, teste comentado, mock que esconda a regra, provedor pago nem prazo que dependa de a máquina estar folgada. O relógio é falso (`page.clock`).
- **O que não rodei:** não rodei o e2e. O portão da tarefa roda esse caso e cobra a metade do prazo dele.

**Bloqueantes:** nenhum.

**Recomendações:** nenhuma nova. As da 1ª rodada já têm destino no documento.

Arquivos conferidos:
- e2e/support/operacao-screen.ts
- e2e/operacao.spec.ts
- apps/web/src/operacao/pages/Escolas.tsx
- apps/web/src/operacao/textos.ts
- tasks/correcoes/2026-11-21-e2e-operacao-aviso-da-sessao-no-celular.md
