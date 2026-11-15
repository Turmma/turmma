# Achados das revisões — `tasks/prd-reengenharia-continuacao/12_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-15 16:20:06 · `tasks/prd-reengenharia-continuacao/12_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A tarefa só mexe no cliente da web: põe prazo nas chamadas à API, cria o `TEMPO_ESGOTADO` e manda para o fim da fila a resposta de prova que estoura o prazo. Não há migration, nem campo novo, nem DTO de saída novo. A fila de respostas segue com a mesma forma: questão, alternativa e `sequencia`. A troca é só de ordem, sem dado novo, e o espelho local continua gravando o que gravava.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok. Nenhuma rota nem consulta nova. O caminho do PDF (`/v1/artefatos/:id/pdf`) e o do envio de material são os mesmos de antes, e a autorização deles continua no servidor. O código `NAO_ENCONTRADO` do PDF ficou igual.

Logs: limpos. O diff não tem `console` nem `logger` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/api/client.ts`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/areas/aluno/fila-de-respostas.ts` nem `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/areas/aluno/respostas.ts`. O `ApiError(TEMPO_ESGOTADO)` leva só o código; a mensagem vem do catálogo `packages/shared/src/errors/messages.ts:14` e é genérica, sem dado nenhum.

Auditoria: não se aplica. A tarefa não cria leitura de dado de aluno por coordenação ou rede, nem exportação, alteração de nota, alteração de permissão ou aprovação de saída de IA.

Envio externo: nenhum. Os dois `fetch` que estavam fora do cliente (`material.ts:115` e `artefatos.ts:115`) agora passam por `comPrazo` e vão para a mesma origem de antes, com o mesmo cabeçalho. O PDF continua com `cache: 'no-store'`, o que impede que o gabarito fique gravado em disco no computador da escola. A nova regra de lint (`no-restricted-globals` e `no-restricted-syntax`) também ajuda a privacidade: barra `fetch` solto, e com ele uma saída de dado que ninguém revisa.

Seed/fixture: sintético. As fixtures em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/guardas/__fixtures__/fetch-fora-do-cliente/` só têm caminhos como `/v1/eu`. Os testes usam ids e títulos de mentira (`'x'`, `'t'`).

Fotos da tela: as quatro (`professora--professor-criados--computador.png`, `professora--professor-criados--celular.png` e as duas `vazia--...`) mostram só a escola, a professora e os artefatos dela, todos com nome sintético e sufixo hex: "Colégio sintético da vitrine cheia 1c8b8b02" e "Professora Sintética Helena 16c1cd54". Não aparece nome, matrícula nem conteúdo de aluno. A linha "Versão adaptada · Fonte ampliada" mostra o tipo de adaptação, não um diagnóstico, como pede o item 3 da regra 20. A tela não mudou nesta tarefa.

Pergunta de fechamento: a tarefa não cria dado guardado nem destino novo, então a resposta à secretaria continua a mesma.

Bloqueantes: nenhum.

Recomendações:
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/areas/aluno/respostas.ts:165` (`paraOFim`), um comentário curto ajudaria. Ele diria que a escolha mandada para o fim não ganha cópia no espelho local: é a mesma entrada, só em outra posição. Assim a próxima revisão do espelho não confunde reordenação com duplicação de resposta de prova.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-15 16:20:10 · `tasks/prd-reengenharia-continuacao/12_task.md`

VEREDITO: APROVADO

Tela vista: sim (4 fotos lidas: `/professor/criados` em 1366 e 360 px, escola cheia e vazia). O estado de erro "Tentar de novo" por `TEMPO_ESGOTADO` não aparece na vitrine. Conferi pelo código e por `Criados.test.tsx:489-560`. A prova do aluno não tem foto, então a revisei só pelo código.

Estados:
- ok. Cheio e vazio estão nas fotos. O vazio convida: mascote com a marca "IA", "Nada gerado ainda" e o botão "Ir para ferramentas".
- Erro: o teste mostra a mensagem do catálogo e o botão "Tentar de novo", e a nova tentativa traz a lista.
- Cancelamento: se quem chamou cancela a leitura, a tela não mostra erro.
- Carregando: não mudou.

Acessibilidade: sem problema nas fotos. O erro sai em `role="alert"` com botão rotulado. A mensagem vem de `MENSAGENS_DE_ERRO`, sem código nem número na tela.

Chromebook fraco:
- O prazo de cada chamada está em `apps/web/src/api/client.ts` (20 s leitura, 30 s PDF, 180 s envio, 10 s prova).
- O código evita `AbortSignal.timeout` e `AbortSignal.any`, que o Chrome 99 do Chromebook de entrada não tem.
- O temporizador é limpo em `finally`.
- A resposta de prova que pendura vai para o fim da fila com a mesma `sequencia` (`respostas.ts` e `fila-de-respostas.ts`). Se há outra esperando, ela sai na hora, o que cumpre a regra 80.6 e o RF11.
- Não rodei nenhum teste de carga, nem throttling de rede e de CPU.
- Os testes de `api/client.test.ts` passaram (24 testes). Os de `respostas.test.ts` e `Criados.test.tsx` não carregaram neste ambiente (não resolveu `@educa/shared`).

Celular: a 360 px não há rolagem horizontal. "Filtrar", o sino e "Sair" têm alvo grande. O botão principal do vazio tem cerca de 44 px de altura. A barra de baixo e o cabeçalho funcionam.

Ação oficial protegida: sim. Nada do que esta tarefa mudou tira a revisão antes de aprovar.

Bloqueantes: nenhum.

Recomendações:
1. `apps/web/src/areas/professor/atividades/Aprovar.tsx:70-71`: o aviso de `TEMPO_ESGOTADO` diz "nada foi aprovado". O `aprovarLote` e o `decidirEntrega` agora estouram sozinhos aos 20 s no cliente (`atividades.ts:82` e `entregas.ts:50`, sem `tipo`). Quando isso acontece, o servidor pode já ter gravado a decisão. A tela relê a correção e pode mostrar "aprovada" logo abaixo de um aviso que diz o contrário. O caso de rede caída (`INDISPONIVEL_TENTE_DE_NOVO`) já tinha o mesmo texto, então não é regressão nova, mas ficou mais provável. Sugestão: trocar para "Não foi possível confirmar a decisão. Confira a situação da correção na tela antes de tentar de novo."
2. `Criados.test.tsx:511-527`: há uma tentativa automática 1 s depois do estouro, então o professor espera cerca de 41 s antes de ver o erro numa rede ruim. Vale reduzir a nova tentativa automática quando o erro é de prazo.
3. Fora do escopo da tarefa: na barra de baixo do celular, "FERRAME…" aparece cortado nas fotos de 360 px. O texto vem de um componente que a tarefa não alterou.
4. O sufixo `16c1cd54` nos nomes de turma e de pessoa é dado sintético da vitrine, não um defeito da tela.

Arquivos principais:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/api/client.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/areas/professor/atividades/Aprovar.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/areas/professor/artefatos/Criados.test.tsx`

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-15 16:20:15 · `tasks/prd-reengenharia-continuacao/12_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. O diff só mexe no cliente HTTP da web (`comPrazo`), nas chamadas de `material.ts` e `artefatos.ts`, na ordem da fila de respostas da prova e no lint. Nada cria, altera ou propõe `Nota`. A fila de respostas grava a alternativa que o aluno marcou (`PUT .../respostas/:questao`), não uma nota. Todos com autor humano? Sim, porque nenhum caminho foi tocado.

Decisão autônoma sobre aluno: ausente. A mudança em `paraOFim` e `haOutraEsperando` (`apps/web/src/areas/aluno/respostas.ts`) só muda a ordem em que as escolhas são enviadas. Ela não corrige nada e não decide nada sobre o aluno. A escolha trocada enquanto a anterior estava travada continua valendo, e a anterior não volta para a fila (`respostas.ts`, `paraOFim`, só move quando questão e `sequencia` são as mesmas). Assim o que vai para o servidor é sempre a última escolha do aluno.

Aprovação registrada: ok. `baixarPdfDoArtefato` (`apps/web/src/areas/professor/artefatos/api/artefatos.ts`) agora tem prazo de 30 s e continua fazendo a mesma coisa. Nenhum fluxo de aprovação, rejeição ou entrega mudou. Nas fotos de `/professor/criados` a versão adaptada aparece como "ESPERANDO VOCÊ", ou seja, nasce pendente, como antes (`professora--professor-criados--computador.png`, `professora--professor-criados--celular.png`).

Supervisão do tutor: ok. A tarefa não toca o tutor.

Autonomia declarada e visível: sim. Nada mudou na governança e nenhum agente teve o nível alterado.

Os outros pontos:
- **Auditoria:** não foi tocada.
- **Vigilância:** nada é medido sobre o aluno. O prazo e a reordenação não registram nada sobre ele, nem tempo ocioso nem comportamento.
- **D55:** nada novo em discursiva ou redação. A única mensagem nova na tela é a do catálogo, `TEMPO_ESGOTADO` (`packages/shared/src/errors/messages.ts:14`).
- **Medir o professor:** a tarefa não toca indicador de professor.
- **Uso excessivo (4b):** nada induz uso. "Tentar de novo" só aparece quando o prazo estoura.

Fotos: a tela de Criados é a mesma de antes, nas versões cheia e vazia, no computador e no celular. Nelas não há nota, conceito nem sugestão de nota. O estado vazio mostra o Assistente de ensino com o selo "IA" (`vazia--professora--professor-criados--computador.png`, `vazia--professora--professor-criados--celular.png`).

Bloqueantes: nenhum.

Recomendações:
1. Na lista de Criados, cada linha (por exemplo "Estequiometria: versão adaptada sintética" e "Estequiometria: lista sintética") não tem selo de saída de IA. Só o estado vazio tem. Isso já era assim antes desta tarefa e o diff não mexe nisso. Fica registrado para uma tarefa de tela futura conferir o item 4a (toda saída de IA rotulada como tal) na listagem, em `apps/web/src/areas/professor/artefatos/Criados.tsx`. Visto em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/.processo/vitrine/professora--professor-criados--computador.png`.
2. A garantia de que a resposta de prova não se perde quando o envio é reenviado e chega atrasado é da regra 80, item 6. Quem audita é o `infra-guardian`, não esta revisão. Da parte da regra 70, os testes de "resposta velha" em `apps/web/src/areas/aluno/respostas.test.ts` mostram que o que fica gravado é a última escolha do aluno, e é isso que importa aqui.

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-15 16:21:10 · `tasks/prd-reengenharia-continuacao/12_task.md`

**VEREDITO: REPROVADO**

Escopo: respeitado. A tarefa não puxou a tela de falha da 13.0 nem o 503 com `Retry-After` da 14.0, e as subtarefas 12.1 a 12.5 estão feitas.

Aderência à Tech Spec: ok. As divergências da tarefa já estão na `techspec.md` §5 ("O prazo do cliente (52.0), como ficou") e no `cenarios.md` §7.

Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo).

**Bloqueantes**

1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/api/client.ts:69`, junto com `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/operacao/textos.ts:76-81`.
   - **O que acontece:** o estouro do prazo no próprio navegador passou a sair com o mesmo código que a web já usava para outra situação. Até aqui, `TEMPO_ESGOTADO` era só o 503 do servidor, quando a consulta passa do `statement_timeout`, e as telas o tratam como recusa garantida, sem nada gravado. O `textos.ts:77` diz isso por escrito ("O 503 da trava (`TEMPO_ESGOTADO`)… são recusas: nada foi gravado"), e o `textos.test.ts:39` confere que `ehResultadoIncerto(TEMPO_ESGOTADO)` dá `false`.
   - **Por que é bug:** quando o navegador desiste do pedido, ele não sabe se o servidor gravou. Um `POST` pode ter sido confirmado no banco aos 20,1 s. É a mesma incerteza da conexão que cai, e essa a função já marca como incerta.
   - **A regressão:** no `POST /v1/operacao/escolas`, que usa o prazo de leitura de 20 s, o estouro deixa de ligar a proteção da tentativa incerta (`NovaEscola.tsx:72`, `TEXTO_DA_TENTATIVA_INCERTA`). Se o operador mudar os dados e tentar de novo, o `CONFLITO` que volta aparece como "Esse endereço já é de outra escola", quando a escola dele pode ter sido criada na tentativa anterior. É justamente o caso do cenário W10 que essa proteção existe para cobrir. Antes desta tarefa, o pedido pendurado acabava no erro de rede (`INDISPONIVEL_TENTE_DE_NOVO`) e caía na proteção.
   - **Correção exigida:**
     - O estouro do cliente tem de ser tratado como resultado incerto em `ehResultadoIncerto`, sem misturar com o 503 do servidor. Pode ser com um código próprio ou com uma marca de origem no `ApiError`.
     - Um teste em `operacao/textos.test.ts` deve provar os dois lados: o estouro do cliente é incerto e o 503 do servidor continua sendo recusa.
     - O jeito escolhido entra na `techspec.md` §5 e no `cenarios.md` §7.
     - Se o caminho escolhido mudar o catálogo em `packages/shared`, pare e reporte ao Arquiteto antes de implementar.

**Recomendações**

- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/areas/professor/atividades/Aprovar.tsx:71`: a mensagem do `TEMPO_ESGOTADO` afirma "nada foi aprovado". Com o prazo do cliente, a aprovação do lote pode ter sido gravada depois que o navegador desistiu. A tela relê o lote e acaba mostrando o estado real, e a mesma imprecisão já existia no `INDISPONIVEL_TENTE_DE_NOVO`. Ainda assim, vale trocar o texto por um que mande conferir a correção, sem afirmar o resultado.
- Como o `shouldRetry` repete uma vez o `TEMPO_ESGOTADO`, a leitura pendurada só mostra "Tentar de novo" por volta dos 41 s (20 s + 1 s + 20 s). Isso está declarado e testado no `Criados.test.tsx`, mas vale registrar no `cenarios.md` §7 que "estoura em 20 s" é o prazo de cada tentativa, e não o tempo até a tela de erro.
- `material.ts` e `artefatos.ts` repetem o mesmo bloco de `try/catch` em volta do `pedir`, que transforma a falha em `INDISPONIVEL_TENTE_DE_NOVO`, com o mesmo comentário. Uma função pequena em `client.ts` evitaria a terceira cópia quando aparecer outra chamada fora do `apiRequest`.

Sobre as fotos de `/professor/criados`, nos quatro arquivos de `.processo/vitrine/` (escola cheia e vazia, computador e celular): não há nada novo na tela nem texto fora do glossário. A tarefa não cria tela.

## test-engineer · 1ª rodada · APROVADO · 2026-11-15 16:21:26 · `tasks/prd-reengenharia-continuacao/12_task.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- **Caminho feliz:** a resposta que chega antes do prazo desliga o temporizador, e nada é abortado depois.
- **Borda, prazo por tipo:** leitura 20 s, PDF 30 s, envio de arquivo 180 s, prova 10 s, cada um conferido um pouco antes do limite e no limite.
- **Borda, corpo pendurado:** o cabeçalho chega e o corpo nunca termina. Vale para o JSON comum, para o PDF (200 e 500) e para o envio de arquivo.
- **Borda, cancelamento:** quem chamou cancela, com o corpo pendurado ou não.
- **Borda da prova:** a resposta pendurada vai para o fim da fila. Também: a mesma questão sai de novo com a mesma `sequencia`; o aluno troca a resposta enquanto a velha pendura; com uma só na fila vale o recuo; a falha que não é estouro também espera o recuo; duas penduradas se revezam.
- **Queda de rede no meio da prova (regra 80, item 6):** a ordem é forçada pelo `servidorDeMentira`.
- **Guarda, quem contorna:** uma fixture por forma. São elas: solto, `globalThis`, `window`, `self`, colchetes, encadeamento opcional, apelido de `window`, desestruturação (inclusive com chave calculada e por atribuição), reexportação, importação e `import()`.
- **Guarda, alvo some:** `api/client.ts` renomeado.
- **Guarda, `eslint-disable`:** não fura a passada das guardas.
- **Guarda, kit visual:** o bloco dele repete os seletores e também barra.
- **Guarda, o real:** o repositório de hoje passa sem violação.
- **Permissão e isolamento entre escolas:** não se aplicam. A tarefa só mexe na web, sem rota nem repository nova.

**Cobertos:** todas as 12 linhas da tabela têm teste com o nome citado, e conferi cada nome no arquivo. Rodei os testes:
- `client.test.ts`, `respostas.test.ts` e `Criados.test.tsx`: 85 passaram.
- `guardas.test.ts -t fetch`: 15 passaram.

Conferi a seção "Mutações" (61 blocos, `--faltando` vazio) contra o `git diff`. Cada cláusula nova tem o seu bloco: em `comPrazo`, em `lerJson` e no relançamento de `chamar`; em `responderQuestao`; em `material.ts` e `artefatos.ts`; em `falharEnvio`, `paraOFim` e `haOutraEsperando`; nos dois termos do `if` de `bombear` e no `return`; em cada seletor, no `files` e `ignores` do bloco do `fetch` e na exceção do cliente. Em cada caso o teste citado chega à cláusula pelo motivo certo.

Os testes afirmam sobre o resultado, não só sobre o código ter rodado: o código do erro, o estado da promessa, o sinal abortado, a ordem da fila, a `sequencia` e o texto do alerta.

Nada de `.skip`, de teste comentado ou de mock que esconda a regra: só o `fetch` global é trocado, e o `comPrazo` roda de verdade. Os prazos são provados com relógio falso. Os testes de tela usam `shouldAdvanceTime` com folga de segundos, então não dependem de a máquina estar folgada.

**Bloqueantes:** nenhum.

**Recomendações:**
1. `apps/web/src/areas/professor/artefatos/Criados.test.tsx`, caso "a leitura que o TanStack Query cancela…": esse caso só prova que o sinal chega ao `fetch`. Pelo que sei do TanStack Query v5, depois do `cancelQueries` ele descarta o que a função da consulta rejeitar. Então, sem o `if (sinal.aborted) throw erro` de `chamar`, a tela continuaria sem erro. Quem segura essa cláusula é o `client.test.ts` › "cancelamento: quem chamou cancela". Vale escrever isso no comentário do caso, para ninguém achar que é ele que protege.
2. `apps/web/src/areas/aluno/fila-de-respostas.ts:96`: com duas ou mais respostas na fila e a rede pendurada de vez, elas se revezam a cada 10 s sem nunca entrar no recuo. O `tentativas` cresce, mas ninguém o lê nesse caminho. O caso "duas penduradas se revezam" mostra esse comportamento sem limite. Fica para o `infra-guardian` decidir se, depois de uma volta inteira na fila, vale aplicar o recuo.
3. Falta um teste que junte as duas pontas: o `responderQuestao` de verdade, com o `fetch` pendurado, dentro de `criarFilaDeRespostas`. Hoje a fila recebe `ApiError(TEMPO_ESGOTADO)` do `servidorDeMentira`, e o prazo de 10 s é provado à parte, no `client.test.ts`.
4. `tools/guardas/guardas.test.ts`, caso "o alvo da exceção existe e ainda chama o `fetch`": a busca por `/\bfetch\(/` também acerta texto de comentário. Seria mais firme conferir pelo ESLint, rodando-o sobre `client.ts` sem a exceção e esperando violação.
5. O limite declarado em `eslint.config.mjs` cita só `Reflect.get(window, 'fetch')`. Vale citar também a chave montada em tempo de execução (`window['fet' + 'ch']`) e o `XMLHttpRequest`, que escapam aos seletores.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tasks/prd-reengenharia-continuacao/12_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/api/client.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/areas/aluno/respostas.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/areas/professor/artefatos/Criados.test.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/guardas/guardas.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/guardas/__fixtures__/fetch-fora-do-cliente/

## infra-guardian · 1ª rodada · REPROVADO · 2026-11-15 16:21:27 · `tasks/prd-reengenharia-continuacao/12_task.md`

VEREDITO: REPROVADO
Caminho quente tocado: prova
Rate limit: não se aplica (a tarefa é só da web; nenhum limite novo)
Fila e prioridade: problema (a fila de respostas da prova, no navegador, deixa de recuar sob carga)
Concorrência: corrida em `apps/web/src/areas/aluno/fila-de-respostas.ts:96` (laço de reenvio sem recuo) e sentido ambíguo do erro em `apps/web/src/operacao/textos.ts:79`
Índice e paginação: não se aplica
Degradação de IA: não se aplica (as chamadas de IA da web devolvem `execucaoAceita` e respondem rápido)
Migration: não se aplica
Métrica e alerta: não se aplica (nenhum código novo de servidor nem alerta novo)

**Bloqueantes:**

1. **`apps/web/src/areas/aluno/fila-de-respostas.ts:96` e `apps/web/src/areas/aluno/respostas.ts:168`: a prova reenvia sem recuo quando o banco está sobrecarregado.**
   - O `TEMPO_ESGOTADO` não vem só do prazo de 10 s do cliente. A API também devolve esse código num 503 rápido quando estoura o `statement_timeout` de 2 s (`packages/core/src/error/map-postgres-error.ts:10`), e no 408/504 (`packages/core/src/error/all-exceptions.filter.ts:18`).
   - Com duas ou mais escolhas na fila, `haOutraEsperando` continua verdadeiro em todo ciclo. A fila manda a escolha seguinte na hora, sem o recuo de 2 a 15 s e sem jitter, e o laço não termina enquanto o banco recusar. O teste "duas penduradas se revezam" (`respostas.test.ts:470`) fixa exatamente esse revezamento sem recuo.
   - Às 10h, com o banco devolvendo 503 em cerca de 2 s, cada aluno no meio da prova manda um `PUT` a cada 2 s, todos no mesmo ritmo. É a martelada que o recuo existe para evitar (regra 80; docblock de `esperaAntesDeTentar`).
   - Correção exigida: diferenciar o estouro do prazo do cliente do `TEMPO_ESGOTADO` que vem da API. Pode ser uma marca no `ApiError` criado em `comPrazo` (`apps/web/src/api/client.ts:69`), por exemplo `origem: 'cliente'`, ou outro código. O envio imediato fica só para o estouro do cliente; o 503/504 da API passa pelo recuo com jitter.
   - Teste exigido: um novo caso em `respostas.test.ts`, com duas escolhas na fila e o servidor recusando com o `TEMPO_ESGOTADO` da API, que prova que o recuo é agendado (`relogio.agendados` não vazio). Mais um bloco de mutação no documento da tarefa.

2. **`apps/web/src/operacao/textos.ts:79-82`: depois do prazo do cliente, a tela trata como recusa algo que pode ter sido gravado.**
   - `ehResultadoIncerto` trata `TEMPO_ESGOTADO` como recusa, em que "nada foi gravado" (o comentário em `textos.ts:77` diz isso). Com o prazo de 20 s do cliente, esse mesmo código passa a sair quando o servidor pode ter gravado.
   - Em `NovaEscola.tsx:72`, a criação de escola que estoura no cliente não entra no caminho "incerto". Se o operador muda os dados e tenta de novo, o `CONFLITO` aparece como "endereço já é de outra escola" (`NovaEscola.tsx:181`), em vez de mandar conferir a lista.
   - Correção exigida: com a mesma marca do item 1, `ehResultadoIncerto` passa a tratar o estouro do cliente como incerto. O comentário de `textos.ts:77` precisa ser atualizado, e um teste deve provar o caso.

**Recomendações:**
- `apps/web/src/areas/professor/atividades/Aprovar.tsx:71`: o texto "nada foi aprovado" no `TEMPO_ESGOTADO` deixa de ser verdade quando o prazo de 20 s do cliente corta um `POST` que o servidor já gravou. Com a marca do item 1, use um texto de resultado incerto ("confira a correção"), já que a tela relê a correção.
- Revezamento de duas escolhas penduradas pelo cliente: cada `PUT` abortado aos 10 s continua ocupando o servidor, e o ciclo segue sem recuo. Vale limitar o envio imediato a uma volta pela fila desde o último sucesso; depois disso, o recuo.
- `POST`s sem chave de idempotência que agora estouram aos 20 s (`/v1/tutor/mensagens`, `/v1/assistente/mensagens`, `/v1/ferramentas/*/gerar`): o "Tentar de novo" pode criar uma execução duplicada se o servidor tiver aceitado a primeira. Isso já podia acontecer antes, mas o prazo novo deixa mais provável. Fica registrado para a 13.0 e a 14.0.

Os dois arquivos de teste da tarefa (`apps/web/src/api/client.test.ts` e `apps/web/src/areas/aluno/respostas.test.ts`) passam: 61 casos. Nenhum deles cobre o 503 `TEMPO_ESGOTADO` que vem da API com duas escolhas na fila.

Arquivos citados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/areas/aluno/fila-de-respostas.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/areas/aluno/respostas.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/areas/aluno/respostas.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/api/client.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/operacao/textos.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/operacao/pages/NovaEscola.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/areas/professor/atividades/Aprovar.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/error/map-postgres-error.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/error/all-exceptions.filter.ts`

## infra-guardian · 2ª rodada · APROVADO · 2026-11-15 16:41:21 · `tasks/prd-reengenharia-continuacao/12_task.md`

VEREDITO: APROVADO
Caminho quente tocado: prova
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok

Bloqueantes: nenhum. As duas correções exigidas na 1ª rodada foram feitas.

1. **Recuo da prova quando o banco está sobrecarregado.** Feito.
   - Só o estouro do prazo no navegador leva a marca `origem: 'cliente'`. Ela é posta em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/api/client.ts:79` e lida por `estourouNoCliente` (`client.ts:26`).
   - O `ApiError` do 503, do 408 e do 504 da API sai de `chamar` (`client.ts:157`) sem a marca.
   - Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/areas/aluno/fila-de-respostas.ts:99`, só o estouro no navegador manda a escolha seguinte na hora. O `TEMPO_ESGOTADO` da API cai em `falha === 'passageira'` e espera o recuo com jitter.
   - O teste novo está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/areas/aluno/respostas.test.ts`, no caso "o TEMPO_ESGOTADO que a API devolve…". Ele põe duas escolhas na fila, faz a API recusar e confere que só houve uma chamada e que o recuo de 2.000 ms ficou agendado.
   - A mutação que tira `estourouNoCliente` está registrada no documento da tarefa. Os testes antigos de revezamento agora usam `estourar()`, que imita o estouro no navegador.
   - O caminho da prova (`responderQuestao` → `authedRequest` → `comPrazo`) mantém a marca: o auxiliar `tempoEsgotado` do `client.test.ts` passou a exigir `origem: 'cliente'` também no caso do `PUT` de 10 s.
2. **Estouro no navegador tratado como resultado incerto.** Feito.
   - Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/operacao/textos.ts:82`, `ehResultadoIncerto` passou a incluir `estourouNoCliente(erro)`. O comentário de `textos.ts:76-79` foi atualizado.
   - `textos.test.ts` prova os dois lados: o estouro no navegador é incerto e o 503 da API continua sendo recusa. Há mutações para cada termo.
   - Fora do que foi exigido, o aviso de `TEMPO_ESGOTADO` em `Aprovar.tsx` deixou de afirmar "nada foi aprovado".

Não rodei os testes. O `vitest` local falhou antes de carregar os casos, porque o pacote `@educa/shared` não está compilado nesta cópia do repositório. A conferência foi feita pela leitura do código, dos testes e das mutações.

Recomendações:
- O aviso de `TEMPO_ESGOTADO` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/areas/professor/atividades/Aprovar.tsx:72` também aparece no 503 da API, que é recusa. Nesse caso o texto "não foi possível confirmar" é mais vago do que precisa, mas é o lado seguro. Se valer a pena, use `estourouNoCliente` para escolher entre os dois textos.
- Não há teste de tela em `NovaEscola.tsx` que leve o estouro no navegador ao aviso de tentativa incerta. Hoje só a função `ehResultadoIncerto` é testada.
- Na rodada seguinte, vale compilar o `@educa/shared` antes, para os testes da web rodarem na revisão.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-15 16:41:35 · `tasks/prd-reengenharia-continuacao/12_task.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok

Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")

Bloqueantes: nenhum

**A correção da 1ª rodada foi feita**

- **Marca de origem.** Quando o prazo estoura no navegador, o `ApiError` criado em `comPrazo` agora leva `origem: 'cliente'` (`apps/web/src/api/client.ts:79`). Quem precisa saber a origem usa `estourouNoCliente` (`client.ts:26`). O catálogo de `packages/shared` não mudou.
- **Resultado incerto.** `ehResultadoIncerto` (`apps/web/src/operacao/textos.ts:82`) marca como incerto só o estouro no navegador. O 503 `TEMPO_ESGOTADO` da API continua sendo recusa. Com isso a proteção da tentativa incerta em `NovaEscola.tsx:72` volta a ligar no estouro.
- **Teste dos dois lados.** O caso novo em `apps/web/src/operacao/textos.test.ts:44-47` prova o estouro como incerto e o 503 da API como recusa.
- **Documentação.** O jeito escolhido está na `techspec.md` §5, item 6, no `cenarios.md` §7 e nas divergências do `12_task.md`.
- **Comentário sobre 408 e 504.** Ele diz que esses status chegam como `TEMPO_ESGOTADO` da API. Conferi que é verdade: `packages/core/src/error/all-exceptions.filter.ts:18` faz esse mapeamento.
- **Fila da prova.** Só o estouro no navegador manda a escolha seguinte na hora (`apps/web/src/areas/aluno/fila-de-respostas.ts:99`). Isso também fecha o risco de martelar o banco sobrecarregado com o 503 rápido da API. Esse caso tem teste próprio em `respostas.test.ts`.
- **Aviso em `Aprovar.tsx:72`.** O texto deixou de dizer "nada foi aprovado" no `TEMPO_ESGOTADO` e passou a mandar conferir a correção. O arquivo estava fora dos previstos, mas a mudança está registrada nas divergências, na techspec e nos cenários.

**Fotos:** as quatro mostram `/professor/criados`, na escola cheia e na vazia. A tela está igual ao que a tarefa descreve, com os nomes do glossário e nada além do pedido.

Recomendações:
- `apps/web/src/areas/aluno/respostas.ts:154`: `falharEnvio` ainda decide quem vai para o fim da fila pelo código, então o 503 `TEMPO_ESGOTADO` da API também manda a escolha para o fim. Já `bombear` decide pela origem do erro. O comportamento é inofensivo, porque o 503 da API ainda espera o recuo, mas os dois critérios ficam diferentes. Ou o comentário das linhas 146-150 explica que ir para o fim vale para os dois casos, ou `falharEnvio` passa a receber o erro e usa `estourouNoCliente`.
- `apps/web/src/areas/professor/atividades/Aprovar.tsx:72`: o 503 `TEMPO_ESGOTADO` da API, que é recusa garantida, agora também mostra "Não foi possível confirmar a decisão". Não é falso, mas é menos preciso que antes. Dá para manter um texto para cada origem.
- `apps/web/src/api/client.ts:62`: a linha do docstring de `comPrazo` passou da largura das outras. Vale quebrar a linha.

## frontend-reviewer · 2ª rodada · APROVADO · 2026-11-15 16:41:35 · `tasks/prd-reengenharia-continuacao/12_task.md`

VEREDITO: APROVADO

Tela vista: sim (4 fotos lidas: `/professor/criados` no computador e no celular, cheia e vazia). O aviso de erro da decisão em `Aprovar.tsx` e o estado "Tentar de novo" não aparecem na vitrine, então os conferi pelo código e pelo diff.

Estados:
- ok para o que a rodada tocou. As fotos mostram Criados com dado (2 documentos, o selo "Esperando você") e vazio.
- O vazio convida a agir: "Nada gerado ainda", o texto diz o que fazer, e há o botão "Ir para Ferramentas". O Assistente de ensino aparece com o selo "IA".
- Carregando e erro não aparecem na vitrine. A parte de erro desta rodada, o aviso da decisão, está em `Aprovar.tsx:72` e `Aprovar.tsx:213-221`.

Acessibilidade:
- O aviso fica em `<p role="status">` (`Aprovar.tsx:325`), então o leitor de tela anuncia a mensagem.
- Nas fotos, o foco e o contraste de Criados seguem o padrão da pele, e a rodada não mexeu neles.

Chromebook fraco: nada novo. O diff não traz lista, imagem nem peso de bundle. A marca `origem` é só um campo a mais no erro.

Celular:
- A 360 px não há rolagem horizontal nem corte nas duas telas. O botão "Filtrar", o "Sair" e a barra inferior têm alvo de pelo menos 44 px, e o botão "Ir para Ferramentas" também.
- Nada depende de hover.
- Não rodei o projeto Playwright `celular`.

Ação oficial protegida: sim.
- No `TEMPO_ESGOTADO` a tela deixou de afirmar "nada foi aprovado" (`Aprovar.tsx:72`). O texto novo é "Não foi possível confirmar a decisão. Confira a situação da correção na tela antes de tentar de novo.", porque o servidor pode ter gravado a decisão.
- O texto diz o que fazer e não traz código nem termo técnico.
- O `onError` relê a correção (`recarregarDepoisDoLote`) antes de fechar o diálogo (`Aprovar.tsx:219-221`). A pessoa vê o estado real e não aprova às cegas de novo.
- As outras mensagens da decisão (conflito, já decidida, destaques por abrir) não mudaram.

Bloqueantes: nenhum.
- A correção da rodada anterior era nenhuma.
- O diff desta rodada mexe na tela em um ponto: o texto do aviso do `TEMPO_ESGOTADO`.
- O resto é a marca `origem: 'cliente'` em `client.ts`, o `estourouNoCliente`, o `ehResultadoIncerto` em `operacao/textos.ts` e a fila de respostas da prova em `fila-de-respostas.ts`. Os testes novos em `client.test.ts`, `respostas.test.ts` e `textos.test.ts` cobrem esses pontos.

Recomendações:
1. `apps/web/src/areas/professor/atividades/Aprovar.test.tsx` não tem teste do aviso da decisão no estouro do prazo. Não achei nenhum caso que cheque o texto do `TEMPO_ESGOTADO` nem o dos outros avisos de `AVISO_DA_DECISAO`. Vale um caso com a mensagem `Não foi possível confirmar a decisão…`, o diálogo fechado e a releitura da correção. Assim o texto não volta sem querer a "nada foi aprovado".
2. Nas fotos do celular, o nome da escola no topo ("Colé…", "Colégio s…") e o rótulo "FERRAME…" da barra inferior aparecem cortados com reticências. É da casca, anterior a esta tarefa, e fica para a validação.
3. O aviso da decisão não tem foto na vitrine. A validação precisa olhá-lo em 360 px pelo e2e. O `<p>` já tem `break-words`.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-15 16:41:49 · `tasks/prd-reengenharia-continuacao/12_task.md`

VEREDITO: APROVADO

Esta é a 2ª rodada. Auditei o diff `.processo/ordens/diff-12-r2.patch` e o que ele afeta. A 1ª rodada não exigiu nenhuma correção.

O diff só mexe no cliente web. O erro que nasce quando o prazo da chamada estoura no navegador agora leva a marca `origem: 'cliente'`, lida pela função `estourouNoCliente`, e isso o separa do `TEMPO_ESGOTADO` que a própria API devolve. A marca muda três comportamentos:
- **Fila de respostas da prova:** só o estouro no navegador libera na hora a próxima resposta da fila. O `TEMPO_ESGOTADO` da API passa pela espera normal antes de tentar de novo.
- **Criação de escola no painel de operação:** só o estouro no navegador conta como resultado incerto (a escola pode ter sido criada mesmo sem resposta).
- **Aviso em `Aprovar.tsx`:** no estouro, o texto deixa de afirmar que nada foi aprovado e manda conferir a correção.

O resto são testes e comentários, além de `cenarios.md` e `techspec.md`.

Campos pessoais tocados: nenhum. A `origem` só pode valer o texto fixo `'cliente'` e não carrega dado. A fila guardada no `sessionStorage` só ganhou um comentário: a resposta mandada para o fim da fila não é copiada.
Fora da tabela de dados do docs/lgpd.md: nenhum.
Autorização por objeto: ok. Nenhuma rota nova e nenhuma mudança na API.
Logs: limpos. Nenhum arquivo alterado tem `console.` nem `logger.`.
Auditoria: presente. O diff não muda nenhuma ação que exige auditoria. A aprovação da correção continua registrada pela API, e só o texto do aviso mudou.
Envio externo: nenhum.
Seed/fixture: sintético. Os testes usam número de questão, alternativa e uma data fixa, sem nome nem matrícula. As fotos mostram "Colégio sintético da vitrine", "Professora Sintética Helena/Rosa" e "Estequiometria: … sintética".

Fotos da tela, `/professor/criados`, nos arquivos `professora--professor-criados--{computador,celular}.png` e `vazia--professora--professor-criados--{computador,celular}.png`:
- A tela mostra só o nome da própria professora e os títulos dos materiais.
- Nenhum nome, matrícula ou resposta de aluno aparece.
- "Fonte ampliada" aparece como adaptação, não como diagnóstico.

Pergunta de fechamento: este diff não muda o que o sistema guarda sobre um aluno nem para onde isso é enviado. O que a 1ª rodada aprovou continua valendo.

Bloqueantes: nenhum.

Recomendações:
- `apps/web/src/areas/professor/atividades/Aprovar.tsx`: o aviso de `TEMPO_ESGOTADO` agora vale também para a recusa rápida da API (o 503), em que nada foi gravado. O texto não promete nada falso, então não é questão de privacidade. Fica para o `conformidade-reviewer` dizer se quer distinguir os dois casos com `estourouNoCliente`.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-15 16:42:12 · `tasks/prd-reengenharia-continuacao/12_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum mudou nesta rodada. O diff mexe só na web (cliente HTTP, fila de respostas da prova, textos de aviso), no lint e na documentação. A aprovação do lote continua passando pela API, e lá nada mudou. Todos com autor humano? sim, sem mudança desde a 1ª rodada.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok
Supervisão do tutor: ok, o diff não toca no tutor
Autonomia declarada e visível: sim, sem mudança desde a 1ª rodada

**O ponto que você pediu para olhar: o aviso de TEMPO_ESGOTADO em `Aprovar.tsx:250`**
- O texto antigo dizia "nada foi aprovado" quando a chamada estourava o prazo no navegador. Isso podia ser falso, porque o servidor pode ter gravado a aprovação e só a resposta não chegou. O texto novo, "Não foi possível confirmar a decisão. Confira a situação da correção na tela antes de tentar de novo.", não afirma resultado nenhum. A troca deixa a tela mais fiel à regra 70: o professor não é levado a crer que nada entrou quando algo pode ter entrado.
- Nenhum caminho novo de aprovação aparece.
  - A tela relê o lote depois do erro (`Aprovar.tsx:219-222`, `recarregarDepoisDoLote`). Assim a professora vê a situação real antes de decidir de novo.
  - Se ela aprovar de novo e o servidor já tiver gravado, a API devolve `ENTREGA_JA_DECIDIDA` sem trocar nada e sem gravar auditoria de novo (`apps/api/src/entrega/entrega.service.ts:33,58`). A aprovação continua sendo um ato humano registrado uma vez, com autor e data.
- A outra correção que toca a rodada (a marca `origem: 'cliente'` em `client.ts:63,72,92`, usada em `fila-de-respostas.ts:119` e em `operacao/textos.ts:303`) separa o prazo estourado no navegador do TEMPO_ESGOTADO que a própria API devolve quando recusa. Não toca em nota, aprovação, tutor nem indicador de professor.

**Fotos da tela (`/professor/criados`)**
- Escola cheia, nas fotos `professora--professor-criados--computador.png` e `professora--professor-criados--celular.png`: o documento gerado pela IA aparece como pendente, com "Esperando você", e o sino diz quanto falta decidir. Não há nota, conceito nem sugestão de nota.
- Escola vazia, nas fotos `vazia--professora--professor-criados--computador.png` e `vazia--professora--professor-criados--celular.png`: o agente aparece como "Assistente de ensino" com o selo "IA". Não há nada que empurre a usar mais, e "Sair" fica visível nas duas larguras.

Bloqueantes: nenhum

Recomendações:
1. **O texto novo não tem teste.** Nem `apps/web/src/areas/professor/atividades/` nem `e2e/` cobrem o aviso de TEMPO_ESGOTADO do `Aprovar.tsx`. Vale um teste de unidade que fixe o texto e prove que, no estouro, ele não diz "nada foi aprovado". Na retro: se alguém voltar ao texto antigo, a tela volta a afirmar algo que pode ser falso.
2. **O 503 rápido da API ganhou o texto vago.** `AVISO_DA_DECISAO` escolhe o texto só pelo código, então esse 503 também leva "Não foi possível confirmar". Ali é uma recusa, e "nada foi aprovado" seria verdade. O texto novo não engana, só é menos preciso. Para separar os dois, dá para usar `estourouNoCliente(erro)` no `onError` (`Aprovar.tsx:213-223`).
3. **O comentário de `AVISO_DA_DECISAO`** (`Aprovar.tsx:62-65`) diz que o estouro é de 20 s. Falta conferir se `aprovarLote` usa mesmo o prazo de leitura, e não o de envio. Se não usar, o número no comentário fica errado.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/areas/professor/atividades/Aprovar.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/api/client.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/areas/aluno/fila-de-respostas.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/operacao/textos.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/entrega/entrega.service.ts

## test-engineer · 2ª rodada · REPROVADO · 2026-11-15 16:42:25 · `tasks/prd-reengenharia-continuacao/12_task.md`

VEREDITO: REPROVADO

**Cenários exigidos** (nesta rodada, pela linha nova de `cenarios.md` §7 e pela linha nova da tabela de divergências do documento):
1. O estouro do prazo no cliente leva a marca `origem: 'cliente'`. O `TEMPO_ESGOTADO` que a API devolve (503, 408, 504) não leva.
2. Só o estouro do cliente conta como resultado incerto (`ehResultadoIncerto`). O 503 `TEMPO_ESGOTADO` da API continua sendo recusa.
3. Na fila de prova, só o estouro do cliente libera a escolha seguinte na hora. O `TEMPO_ESGOTADO` da API, mesmo com duas escolhas na fila, espera o recuo.
4. Com uma escolha só na fila, o estouro do cliente espera o recuo.
5. No estouro, o aviso da decisão da correção (`Aprovar.tsx`) manda conferir a correção e não afirma que nada foi aprovado.

**Cobertos:**
- 1: `apps/web/src/api/client.test.ts` › "o TEMPO_ESGOTADO que a API devolve (503 rápido) não leva a marca do cliente…". O helper `tempoEsgotado` agora exige `origem: 'cliente'` e `estourouNoCliente`, então os casos de prazo já existentes também seguram a marca. O teste confere ainda que um objeto que não é `ApiError` não conta como estouro.
- 2: `apps/web/src/operacao/textos.test.ts` › "o estouro do prazo no navegador deixa incerto se a escola foi criada, e o 503 TEMPO_ESGOTADO da API, que é recusa, não".
- 3: `apps/web/src/areas/aluno/respostas.test.ts` › "o TEMPO_ESGOTADO que a API devolve (o 503 rápido do banco sobrecarregado) passa pelo recuo…". Ele fica vermelho tanto com o código antigo (decidir pelo código) quanto com a remoção do primeiro termo.
- 4: `respostas.test.ts` › "com uma só escolha na fila, o estouro espera o recuo de sempre", agora com `estourar()`.
- As mutações batem com o `git diff`. Os blocos dos trechos que mudaram foram atualizados. Os oito blocos novos cobrem a marca em `comPrazo`, os dois termos de `estourouNoCliente` (a origem e o `instanceof`), o primeiro termo de `bombear` no caso da API e os quatro termos de `ehResultadoIncerto`.
- Rodei `npx vitest run` nos três arquivos, da raiz do repositório: 74 de 74 passaram. Não há `.skip`, nenhum mock esconde a regra e não há provedor de IA no caminho.
- Não há operação nova que possa rodar duas vezes ao mesmo tempo nesta rodada.

**Bloqueantes:**
- `apps/web/src/areas/professor/atividades/Aprovar.tsx:72`: o texto do `TEMPO_ESGOTADO` em `AVISO_DA_DECISAO` passou a ser "Não foi possível confirmar a decisão. Confira a situação da correção na tela antes de tentar de novo." O item 5 entrou como cenário `[U]` em `cenarios.md` §7 e como divergência resolvida no documento da tarefa, mas não tem teste nem bloco de mutação.
  - Nada em `Aprovar.test.tsx`, em `e2e/` ou em outro lugar confere esse texto. Nenhum aviso de `AVISO_DA_DECISAO` é conferido em teste unitário.
  - Se alguém voltar o texto antigo ("…e nada foi aprovado…"), tudo continua verde. A tela voltaria a afirmar à professora que nada foi aprovado num caso em que o servidor pode ter gravado a aprovação. É exatamente o que a regra 70 e a D7 não aceitam.
  - **Correção exigida:**
    - Um caso em `apps/web/src/areas/professor/atividades/Aprovar.test.tsx`, com a rede falsa que o arquivo já tem: a aprovação do lote (e a rejeição, se for o mesmo `onError`) estoura no cliente, com `comPrazo` e relógio falso ou um `ApiError(TEMPO_ESGOTADO, undefined, 'cliente')`.
    - O caso confere que aparece o texto novo, por extenso, que não aparece "nada foi aprovado" e que a correção é lida de novo.
    - No documento da tarefa, um bloco de mutação que volta o texto antigo apontando para esse caso.

**Recomendações:**
- `apps/web/src/areas/aluno/respostas.ts:154`: `falharEnvio` ainda decide pelo código. O 503 `TEMPO_ESGOTADO` da API também manda a escolha para o fim da fila, só que agora com recuo. Não perde resposta e não martela o banco, mas destoa do "só o estouro do cliente" da techspec §5, item 6. Vale passar `estourouNoCliente` também aqui, ou dizer no texto que a reordenação vale para os dois casos.
- `Aprovar.tsx:72`: como a tela decide pelo código, o 503 `TEMPO_ESGOTADO` da API, que é recusa, também mostra "Não foi possível confirmar a decisão". É o lado conservador e aceitável, mas pode ficar registrado na divergência do documento.
- `apps/web/src/areas/professor/artefatos/Criados.test.tsx:538`: o comentário novo, que diz qual teste segura o `if (sinal.aborted)`, está bom. Vale citar o mesmo nome num bloco de mutação, se ainda não houver.

Arquivos citados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/areas/professor/atividades/Aprovar.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/areas/professor/atividades/Aprovar.test.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/areas/aluno/respostas.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tasks/prd-reengenharia-continuacao/cenarios.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tasks/prd-reengenharia-continuacao/12_task.md`

## revisor-geral · 3ª rodada · APROVADO · 2026-11-15 16:59:38 · `tasks/prd-reengenharia-continuacao/12_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

Nesta rodada li o diff da 2ª rodada para cá (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/.processo/ordens/diff-12-r3.patch`) e o diff do `12_task.md`. Nada mais mudou.

- **`Aprovar.test.tsx` (caso novo):** cobre a aprovação e a rejeição do lote quando passam de 20 s. Só a chamada da decisão fica pendurada, e ela para quando o sinal de cancelamento chega. O teste prova que:
  - aos 19,9 s ainda não há aviso;
  - aos 20 s aparece o texto que manda conferir a correção;
  - a tela não diz "nada foi aprovado" e não mostra o código cru `TEMPO_ESGOTADO`;
  - a correção é lida de novo e o diálogo fecha.

  O `fetch` trocado volta ao normal pelo `unstubAllGlobals` do `setupScreen`, e o relógio falso pelo `afterEach` do próprio bloco. As duas mutações novas do `12_task.md` apontam para esses dois casos. O arquivo foi incluído na tabela de arquivos alterados.
- **`respostas.ts:149-152` (comentário de `falharEnvio`):** atende a recomendação da rodada anterior. Confere com o código. Em `respostas.ts:157`, todo `TEMPO_ESGOTADO` manda a escolha para o fim da fila. Em `fila-de-respostas.ts:97-99`, só o estouro do lado do navegador (`estourouNoCliente`) manda a seguinte na hora; o `TEMPO_ESGOTADO` da API espera o intervalo crescente com variação aleatória antes de tentar de novo.
- **Divergência registrada no `12_task.md`:** o 503 `TEMPO_ESGOTADO` da API mostra o mesmo aviso do estouro no navegador, e o texto separado por origem fica para a 13.0. Ela aponta para a `techspec.md` §5 item 6 e para o `cenarios.md` §7, que já trazem a divergência do aviso da decisão desde a rodada aprovada. Nesta rodada só o texto da linha mudou, sem mudar o que foi decidido.

Recomendações:
- `Aprovar.test.tsx:67`: o comentário diz "o diálogo segue aberto" aos 19,9 s, mas nada confere isso. Falta `expect(screen.getByRole('alertdialog')).toBeTruthy()` antes de avançar os últimos 100 ms. Assim o fechamento aos 20 s fica provado como efeito do estouro.

## test-engineer · 3ª rodada · APROVADO · 2026-11-15 16:59:52 · `tasks/prd-reengenharia-continuacao/12_task.md`

VEREDITO: APROVADO

Cenários exigidos (só o que mudou nesta rodada):
- Quando a decisão sobre a correção passa do prazo de 20 s do cliente, a tela não afirma que "nada foi aprovado", manda conferir a correção e lê a correção de novo. Vale para a aprovação do lote e para a rejeição.
- Aos 19,9 s a tela ainda espera.
- O código cru `TEMPO_ESGOTADO` não aparece para a professora.
- Há um bloco de mutação que volta o texto antigo.

Cobertos:
- **O teste novo existe.** Está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/areas/professor/atividades/Aprovar.test.tsx`, no describe "Revisar a correção: a decisão que o prazo do cliente interrompe". É um `it.each` com dois casos:
  - "a aprovação do lote que passa de 20 s…"
  - "a rejeição do lote que passa de 20 s…"
- **O que ele faz.** A chamada da decisão (`/aprovar-lote` ou `/decidir`) fica pendurada e só termina pelo sinal de abortar, e o relógio é falso. Ele confere:
  - aos 19,9 s há um sinal só e nenhum aviso;
  - aos 20 s aparece o texto novo, por extenso;
  - não aparece "nada foi aprovado";
  - não há `role="alert"` (o aviso sai no `role="status"`, `Aprovar.tsx:325`, e o `falha` da linha 258 exclui os códigos que têm aviso);
  - o código `TEMPO_ESGOTADO` não aparece;
  - a leitura `GET …/correcao` acontece de novo;
  - o diálogo fecha.
- **Ele chega à cláusula.** Os dois caminhos passam pelo `onError` (`Aprovar.tsx:213-222`), que lê `AVISO_DA_DECISAO[erro.codigo]` na linha 72. Se o texto antigo voltar, o `findByText(AVISO_DO_PRAZO)` e o `not.toContain('nada foi aprovado')` ficam vermelhos, e é pelo motivo certo.
- **Os blocos de mutação existem.** São dois em `12_task.md:762-778`, um por caso, e cada um volta exatamente o texto antigo da linha 72. A contagem do `--faltando` foi para 71 blocos.
- **Rodei o arquivo e passou.** `npx vitest run src/areas/professor/atividades/Aprovar.test.tsx` deu 23/23.
- **Sem problemas no resto:**
  - nenhum `.skip`;
  - o mock da rede só troca a chamada da decisão, e a regra testada (o texto do aviso e a releitura) não fica escondida;
  - não há IA nem concorrência nesta rodada;
  - o prazo é provado com relógio falso, sem depender da carga da máquina.
- **As três recomendações anteriores foram atendidas:**
  - o comentário de `falharEnvio` em `respostas.ts` agora explica as duas origens do `TEMPO_ESGOTADO`;
  - o documento registra como divergência que o 503 da API mostra o mesmo texto;
  - `Aprovar.test.tsx` entrou na lista de arquivos alterados.

Bloqueantes: nenhum.

Recomendações:
- **Falta uma linha na tabela "Testes que provam a regra"** de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tasks/prd-reengenharia-continuacao/12_task.md` (linhas 43-56) para "o aviso da decisão, no estouro, manda conferir a correção". Deveria citar `Aprovar.test.tsx` › "a aprovação do lote que passa de 20 s…" e "a rejeição do lote que passa de 20 s…". Hoje o cenário de `cenarios.md:183-184` só aparece na divergência e nos blocos de mutação. Vale o mesmo para a marca `origem: 'cliente'`: ela tem caso em `textos.test.ts`, mas também não tem linha na tabela.
- **O 503 `TEMPO_ESGOTADO` da API mostra o mesmo texto do estouro do cliente**, e nenhum teste fixa isso. Se a 13.0 separar o texto por origem, deve entrar um caso com `ApiError(TEMPO_ESGOTADO)` sem `origem: 'cliente'`, para o comportamento conservador não mudar sem ninguém ver.
