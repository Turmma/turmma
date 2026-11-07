# Achados das revisões — `tasks/correcoes/2026-11-06-e2e-conflito-do-gerar.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-06 22:58:20 · `tasks/correcoes/2026-11-06-e2e-conflito-do-gerar.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok (não se aplica, nada em `apps/` nem em `packages/` mudou)
Fila e prioridade: ok (não se aplica)
Concorrência: protegida (não se aplica ao código de produção; o caso agora controla quando chega a releitura de 15 s, em vez de depender da sorte)
Índice e paginação: ok (não se aplica, nenhuma query nova)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (não se aplica)
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/e2e/acesso-da-turma.spec.ts:1070-1078`: se uma asserção entre o `page.route` e o `leiturasDaTurma.abrir()` falhar, as leituras ficam presas até a página fechar. Hoje isso não faz mal, porque a página morre com o caso. Mesmo assim, um `try/finally` em volta desse trecho evita que o trace da falha mostre requisições penduradas, que não têm relação com o erro.
- O regex `ehUmaLeituraDaTurma` (linha 71) está preso a três sub-rotas: `alunos`, `desempenho` e `reivindicacoes`. Se a tela da turma ganhar outra leitura periódica (a semana do professor pode trazer uma), a mesma corrida volta sem nenhum aviso. Vale um comentário na tarefa ou no `Turma.tsx` apontando para esta lista.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-06 22:58:25 · `tasks/correcoes/2026-11-06-e2e-conflito-do-gerar.md`

VEREDITO: APROVADO
Tela vista: sim (8 fotos lidas, cheia e vazia: Turmas no computador e no celular, a turma aberta no celular e a aba Alunos no celular da escola vazia). A correção só mexe no e2e, então as fotos servem de contexto. A foto da aba Alunos da escola cheia ainda mostra "Carregando a aba…", como o prompt avisou.
Estados: ok. A correção não toca na tela. A escola vazia convida ("Sem acesso ativo", "Nenhum pedido esperando" e o botão "Convidar alunos"). Carregando e erro vêm do código que o caso exercita, e o aviso "Esta turma não está disponível" dentro do diálogo é conferido pelo próprio caso.
Acessibilidade: o caso mantém a conferência do `alert` com foco, do foco no título da seção e do `seriousViolations` (axe). Nada foi afrouxado.
Chromebook fraco: não se aplica, porque não há mudança de código de produção. O caso continua com `test.slow()`. A tarefa reporta 27 s por execução e 10 verdes em 10 com `--repeat-each=10`. Não rodei o e2e.
Celular: nas fotos de 360 px não vi rolagem horizontal, texto cortado nem alvo pequeno (o botão "Convidar alunos" tem altura de ação principal). O caso roda nos projetos com `hasTouch` e usa `tocar`. As telas não rolam a 1366 × 768. A barra inferior sobre o conteúdo nas fotos compridas é efeito da captura de página inteira.
Ação oficial protegida: sim, não se aplica. O caso trata de convite à turma, e não de nota, publicação ou exportação.

**Conferência do diff** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/e2e/acesso-da-turma.spec.ts`):
- `ehUmaLeituraDaTurma` cobre turma, alunos, desempenho e reivindicações, e fica fora do `/acesso`.
- `segurarAsLeituras` passa adiante tudo que não é `GET`.
- `gate()`, `Route`, `principal`, `TEXTO_DA_TURMA_INDISPONIVEL` e `SIGN_IN_TIMEOUT_MS` já existem no arquivo.
- A releitura é forçada no pior momento, com `visibilitychange`. O `expect.poll` espera a requisição chegar ao servidor, e só então o caso confere o aviso no diálogo e o "Fechar".
- O desfecho antes aleatório agora é afirmado de forma determinística. No fim as leituras são soltas, e o caso confere que a página inteira troca pelo aviso e a seção some.
- As leituras seguradas são liberadas no fim do caso, sem requisição pendurada.
- O texto de `rota.fallback().catch(() => undefined)` cobre a página fechando antes da resposta.

Bloqueantes: nenhum.

Recomendações:
- O `catch` silencioso em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/e2e/acesso-da-turma.spec.ts` (`segurarAsLeituras`) é aceitável. Um comentário curto dizendo que ele cobre a página fechada ajudaria quem ler depois.
- Nas fotos, o cartão "2ºB b02077d4" e o título "Turma 2ºB b02077d4" mostram um sufixo de id. É dado sintético da vitrine, então não é achado de produto.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-06 22:58:25 · `tasks/correcoes/2026-11-06-e2e-conflito-do-gerar.md`

VEREDITO: APROVADO

A correção só mexe no teste `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/e2e/acesso-da-turma.spec.ts`, com 24 linhas novas. Nada em `apps/` nem em `packages/` mudou, então nenhuma superfície que trata dado de pessoa foi alterada. O resto do arquivo não mudou e não foi reauditado.

Campos pessoais tocados: nenhum. A mudança só segura e solta requisições `GET` da turma (a turma, os alunos, o desempenho e os pedidos) e confere textos fixos da tela, como o aviso da turma que não existe, "Fechar" e "Esta turma não está disponível". Nenhuma conferência nova lê nome, matrícula, nota ou conteúdo.

Fora da tabela de dados do docs/lgpd.md: nada, porque não há campo novo.

Autorização por objeto: ok, e o teste ficou mais forte. Antes, o caso só dava como certo um dos dois desfechos possíveis, e qual aparecia dependia do momento em que a releitura chegava. Agora os dois são conferidos. O primeiro é a criação do acesso depois do fim do vínculo, que recebe a mesma resposta da turma inexistente e deixa o diálogo só com "Fechar". O segundo é a releitura, que troca a página inteira pelo aviso de turma indisponível. "Não encontrado" e "sem permissão" continuam respondendo igual, porque o teste espera o mesmo texto nos dois casos. Nenhuma conferência anterior foi afrouxada: as linhas que já conferiam o aviso, o "Fechar", a seção, o foco e o axe estão intactas.

Logs: limpos. O diff não acrescenta `console`, log ou anexo de trace com conteúdo.

Auditoria: não se aplica. A mudança não cria leitura por coordenação, exportação, alteração de nota ou de permissão, nem aprovação de saída de IA.

Envio externo: nenhum.

Seed/fixture: sintético. O caso usa os dados já existentes no arquivo: as matrículas são `M<posição>-<uuid>` (`e2e/acesso-da-turma.spec.ts:582`) e o fim do vínculo é feito por `encerrarVinculosNoBanco` com ids gerados no próprio teste.

Bloqueantes: nenhum.

Recomendações:
- O filtro `ehUmaLeituraDaTurma` (`e2e/acesso-da-turma.spec.ts:71`) também segura a leitura da própria turma. Se um dia a turma ganhar outra sub-rota de leitura, ela escapa do filtro e a corrida volta. Vale um comentário junto ao filtro, ou à `agendarRelitura` em `atualizacao-dos-pedidos.ts`, dizendo que a lista do filtro precisa acompanhar as releituras da tela.

Pergunta de fechamento: a correção não muda o que o sistema guarda sobre um aluno nem para onde envia, então a resposta a uma secretaria de educação continua a mesma de antes. Esta rodada não reauditou isso.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-06 22:58:36 · `tasks/correcoes/2026-11-06-e2e-conflito-do-gerar.md`

VEREDITO: APROVADO

Escopo: respeitado. A correção mexe só em `e2e/acesso-da-turma.spec.ts`, nada em `apps/`, como o documento pede. A seção "Fora desta correção" diz "nada", e o diff não passa disso.

Aderência à Tech Spec: ok. A correção não muda comportamento nem contrato, então `techspec.md` e `cenarios.md` ficam como estão.

Portão local: carimbo válido. O conferir respondeu "portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)".

Bloqueantes: nenhum.

O que conferi:
- **Rotas da expressão regular.** `ehUmaLeituraDaTurma` (linha 71) pega exatamente as quatro leituras que o front faz: `/v1/turmas/:id`, `/alunos`, `/desempenho` e `/reivindicacoes`. A query string não entra no `pathname`, e as rotas do acesso ficam de fora. Por isso a recarga da seção depois do "Fechar" continua livre.
- **Disparo da releitura.** O `visibilitychange` disparado aciona o `aoMudarDeVista` de `apps/web/src/components/pedidos/atualizacao-dos-pedidos.ts:44-47`. A aba está visível, então a releitura sai na hora, e o foco do TanStack Query também relê. A corrida descrita na Causa é reproduzida de forma determinística.
- **Nenhuma asserção afrouxou.** Tudo o que o caso conferia continua lá: o aviso no diálogo, só "Fechar", a seção sem botão, o foco no título e o axe. O desfecho que antes dependia do acaso agora tem asserção própria no fim, depois de `leiturasDaTurma.abrir()`: a página troca pelo aviso e a seção sai, com 20 s de espera, acima dos 15 s do relógio.
- **Pedidos segurados.** Um pedido cancelado pelo próprio front enquanto estava segurado não derruba o caso, porque `rota.fallback().catch(() => undefined)` o absorve.

Recomendações:
- `e2e/acesso-da-turma.spec.ts:1086`: `expect.poll(() => leiturasSegurasNoAr).toBeGreaterThan(0)` também passa com uma leitura segurada antes do disparo, por exemplo uma que a resposta 404 do gerar tenha provocado. O caso fica certo do mesmo jeito, porque há leitura pendente nesse momento. Se a intenção é provar que foi o disparo que chegou, guarde a contagem antes do `dispatchEvent` e espere que ela suba.
- `e2e/acesso-da-turma.spec.ts:1078`: o `page.route(ehUmaLeituraDaTurma, …)` nunca é desfeito. Hoje não faz diferença, porque é o último trecho do caso. Se alguém acrescentar um trecho depois, um `page.unroute` logo após o `abrir()` evita surpresa.

## test-engineer · 1ª rodada · APROVADO · 2026-11-06 22:59:22 · `tasks/correcoes/2026-11-06-e2e-conflito-do-gerar.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- Caminho feliz: com o vínculo encerrado e a tela aberta, o gerar devolve o aviso "turma não disponível" dentro do diálogo, com o foco nele e só o botão "Fechar". Ao fechar, a seção mostra o aviso e não oferece o que a API recusa.
- Borda 1, a corrida da esteira: a releitura que encontra a turma perdida chega com o aviso já no diálogo. É o desfecho que ganhava ou perdia conforme o relógio de 15 s.
- Borda 2: essa releitura chega depois, e a página inteira troca pelo aviso. Antes da correção esse desfecho dependia do acaso.
- Permissão: o professor cujo vínculo foi encerrado no meio do caminho (o realocado em março) não gera acesso e não vê mais a turma.
- Isolamento: não se aplica. A correção mexe só no e2e, nada em `apps/`, e não há repositório nem consulta nova.

**Cobertos:**
- Os quatro cenários aplicáveis estão no último trecho do caso "falha com o diálogo aberto: o CONFLITO do gerar…", em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/e2e/acesso-da-turma.spec.ts:1065-1101`. É o caso que o documento cita em "Teste que reproduz".
- Os dois desfechos agora têm ordem fixa:
  - As releituras da turma, dos alunos, do desempenho e dos pedidos (só `GET`, linha 71) ficam presas numa porta antes de a coordenação encerrar o vínculo.
  - O `visibilitychange` força a releitura no pior momento (linha 1086). O `expect.poll` prova que ela chegou e ficou presa (linha 1087).
  - Com isso o diálogo é conferido como antes: o aviso, só "Fechar", o foco no título e o axe.
  - Depois a porta abre, e o caso confere que o título da seção some e que o aviso ocupa a página (linhas 1099-1101).
- A lista do que segura está completa para a aba Alunos. Só três leituras tiram a página: a da turma (`Turma.tsx:68`), a dos alunos (`AlunosDaTurma.tsx:68`) e a dos pedidos (`ListaDePedidos.tsx:94`). As três estão na expressão da linha 71. A leitura do acesso fica de fora, e é ela que recarrega a seção na linha 1092.
- Nenhuma asserção do caso foi afrouxada, e todas conferem o que a tela mostra, não só que o código rodou.
- Não há `.skip`, e a porta não esconde a regra: o outro desfecho continua conferido no fim.
- Não há código de produção na correção, então o RF17 não pede bloco de mutação.
- Tempo: o portão gravou o caso verde em 29,5 s no chromebook e 30,6 s no celular (`.processo/e2e-duracao.json`). Fica abaixo da metade dos 90 s do `test.slow()`, e nada no caso depende de a máquina estar folgada.
- Não rodei o e2e nesta revisão. Ele precisa da stack de teste no ar, e o carimbo do portão (`.processo/portao.json`, alvo `e2e/acesso-da-turma.spec.ts`) já cobre esta árvore.

**Bloqueantes:** nenhum

**Recomendações:**
1. Linha 1087: o `poll` conta qualquer leitura presa. Contar só a de `/reivindicacoes` provaria que foi o `visibilitychange` que disparou a releitura, e não outra leitura que passou por acaso.
2. A expressão da linha 71 não inclui a leitura dos sinais, que também tira a página (aba Hoje, `TurmaHoje.tsx:88`). Hoje não faz diferença, porque o caso abre a aba Alunos e só a aba à vista existe. Vale um comentário dizendo que a porta vale só para a aba Alunos, para não voltar a falhar se o caso mudar de aba.
3. O "vermelho antes" do documento foi feito com uma espera de 1,5 s colocada à mão, numa rodada só. Para a retro, vale registrar que o vermelho nasceu dessa reprodução manual, e não de um bloco de mutação.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-06 23:10:38 · `tasks/correcoes/2026-11-06-e2e-conflito-do-gerar.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok (a correção mexe só no caso do e2e e nos documentos do processo; o código de produto não muda)
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

**O que conferi nesta rodada**
- **Comentário no filtro `ehUmaLeituraDaTurma`** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/e2e/acesso-da-turma.spec.ts:70-75`): feito. O comentário diz que o filtro vale só para a aba Alunos e que a lista precisa acompanhar as releituras da tela.
- **Comentário no `catch` de `segurarAsLeituras`** (`e2e/acesso-da-turma.spec.ts:1081`): feito.
- **O `expect.poll` contar só a leitura dos pedidos** (`e2e/acesso-da-turma.spec.ts:1079` e `:1094`): feito, mas de outro jeito. Eu tinha recomendado guardar a contagem antes do `dispatchEvent` e esperar que ela suba. A tarefa preferiu contar só a leitura de `/reivindicacoes` e explica no comentário por que não compara com a contagem anterior: se o relógio de 15 s já deixou uma leitura segurada, o disparo não abre outra, por causa do `cancelRefetch: false`. Conferi essa premissa em `apps/web/src/components/pedidos/ListaDePedidos.tsx:88`, onde a releitura é `refetch({ cancelRefetch: false })`, e ela se confirma. Comparar com a contagem anterior deixaria o caso instável justamente nessa situação. A asserção prova o que o caso precisa: há uma leitura da lista no ar enquanto o aviso está no diálogo. Aceito.
- **`page.unroute`:** ficou sem aplicar, e o motivo está na seção "Recomendações sem aplicar" do documento. Aceito.

**Recomendações**
- Na tabela "Recomendações sem aplicar" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/tasks/correcoes/2026-11-06-e2e-conflito-do-gerar.md`, registrar numa linha que a recomendação do `expect.poll` (revisor-geral, 1ª rodada) foi aplicada de outro jeito, com o motivo do `cancelRefetch: false`. Hoje esse motivo está só no comentário do teste, e a retro não o encontra.

## test-engineer · 2ª rodada · APROVADO · 2026-11-06 23:10:47 · `tasks/correcoes/2026-11-06-e2e-conflito-do-gerar.md`

VEREDITO: APROVADO

**Cenários exigidos:** esta é uma correção de e2e e não traz regra nova. Ela pede que o caso "a coordenação encerra o vínculo com a tela aberta" chegue ao mesmo desfecho em toda rodada. Para isso há três situações a cobrir.
- **Leituras seguradas:** com as leituras da turma presas no momento do gerar, o diálogo mostra o aviso e só o botão "Fechar". A seção deixa de oferecer o que a API recusa, o foco vai para o título e o axe passa limpo.
- **Releitura no pior momento:** a releitura cai quando o aviso já está no diálogo e não troca a página por baixo dele.
- **Leituras soltas:** a página inteira troca pelo aviso da turma indisponível e a seção sai junto.

O isolamento entre escolas e a permissão já eram provados pelo próprio caso: o gerar com o vínculo encerrado responde como turma inexistente. Esta rodada não mexe nisso.

**Cobertos:** os três, no mesmo caso de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/e2e/acesso-da-turma.spec.ts` (linhas 1069 a 1108). Esta rodada só mexeu em comentários e no contador, e conferi as três correções pedidas.
- **Recomendação 2, comentário no filtro `ehUmaLeituraDaTurma` (linhas 70 a 75):** feita. O comentário diz que o filtro vale só para a aba Alunos, que a aba Hoje relê também os sinais, e que a lista precisa acompanhar as releituras da tela.
- **Recomendação 1, o `expect.poll` contar só a leitura dos pedidos (linhas 1076 e 1094):** feita. O contador conta só caminhos que terminam em `/reivindicacoes`, que o filtro `ehUmaLeituraDaTurma` também pega. Conferi no código o que o comentário afirma. O disparo de `visibilitychange` com a aba à vista relê na hora, pela função `aoMudarDeVista` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/web/src/components/pedidos/atualizacao-dos-pedidos.ts:43-46`. E a releitura usa `cancelRefetch: false`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/web/src/components/pedidos/ListaDePedidos.tsx:88`. Com isso a releitura do disparo não abre uma segunda leitura quando o relógio de 15 s já deixou uma presa, e o comentário novo explica exatamente esse caso.
- **Comentário no `catch` de `segurarAsLeituras` (linha 1078):** feito. Ele explica que a página pode fechar com a leitura ainda presa, e então o `fallback` recusa.

Não afrouxou nenhuma asserção, não tem `.skip` e não tem mock da regra. A rota só segura a requisição e depois deixa passar para o servidor de verdade.

**Bloqueantes:** nenhum.

**Recomendações:**
1. O `poll` ainda não prova que a leitura presa veio do `visibilitychange`. Se o relógio de 15 s já tiver deixado uma leitura dos pedidos presa, o contador passa antes do disparo. O comentário admite isso e, para o que o caso protege, basta que haja uma releitura no ar enquanto o diálogo é conferido. Para provar a origem, seria preciso zerar o contador logo antes do `dispatchEvent` e usar relógio falso no lugar do de 15 s. Fica para a retro, não bloqueia.
2. A recomendação do test-engineer sobre o "vermelho antes" ter nascido de reprodução manual, e não de bloco de mutação, ficou para a retro na tabela "Recomendações sem aplicar". O destino está correto.

Não rodei o e2e, porque o Playwright precisa da pilha de pé e o portão da tarefa já o roda. A mudança desta rodada não afeta o fluxo do caso: são comentários e o filtro de caminho no contador.
