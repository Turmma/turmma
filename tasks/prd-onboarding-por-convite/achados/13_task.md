# Achados das revisões — `tasks/prd-onboarding-por-convite/13_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-05 14:19:43 · `tasks/prd-onboarding-por-convite/13_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova e nenhuma migration nesta tarefa. Não há mudança em `apps/api` nem em `packages`. Os auxiliares novos de seed em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/e2e/support/seed.ts` (`criarTurmaComNomeNoBanco` e `aprovarNaListaDaTurma`) gravam em `turma` e em `lista_nome` com `escola_id` e `ano_letivo_id`. O ano e a turma são buscados filtrando pela `escola_id` passada.

Queries verificadas: nenhum repository novo ou alterado. Os clientes da tela estão em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/importacao/api/importacao.ts`:
- `POST /v1/importacoes/alunos/previa` manda no corpo só `{ texto }`.
- `POST /v1/importacoes/alunos` manda no corpo só `{ texto, marcas }`.
- `GET /v1/importacoes/:id` vai com UUID.

Nenhuma dessas chamadas manda `escolaId` ou `anoLetivoId` no corpo ou na query string. A lista da turma passou a usar o mesmo componente, pelas rotas por `turmaId` que já existiam. As rotas de backend que essas telas consomem já têm prova de isolamento:
- `apps/api/test/importacao.int.test.ts`: `escolaId` no corpo dá ENTRADA_INVALIDA, e o id da importação da escola B, pedido na A, responde igual ao de uma inexistente.
- `apps/api/test/importacao-alunos.int.test.ts`: a matrícula e a turma da escola B não casam na planilha da A.
- `apps/api/test/lista.int.test.ts`: a turma da escola B dá NAO_ENCONTRADO, sem importação, sem job e sem leitura auditada.

Teste de isolamento: presente e efetivo. A tarefa não tem backend novo, e as rotas consumidas já estão cobertas pelos testes acima. Do lado da tela, o caso de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/e2e/importar-alunos.spec.ts` sobre a coordenação anterior (linha 259) usa duas coordenadoras de escolas diferentes na mesma aba. Ele verifica que nome de aluno e nome de arquivo da primeira não aparecem para a segunda. Ele quebraria se a prévia ficasse em cache ou em armazenamento do navegador: a prévia usa `gcTime: 0`, e outro caso verifica que nada vai para `localStorage`, `sessionStorage` nem para o endereço.

Bloqueantes: nenhum

Recomendações:
- O TODO.md pede para conferir que `candidatos` e `rotulo` vêm só da escola da sessão. Isso só é garantido no backend: em `lista.int.test.ts` e em `importacao.int.test.ts` (linha 176, marca com id de pessoa de outra escola). Não há caso de backend que monte um candidato a desligar com um aluno da escola B na mesma turma pelo nome e afirme que o rótulo dele não aparece na prévia da A. Vale acrescentar esse caso em `apps/api/test/importacao-alunos.int.test.ts` numa tarefa de backend.
- `?painel=importar` em `turmas-da-escola.ts` só abre o painel, sem levar dado. Não deixe que algum dia leve id de importação ou nome de arquivo no endereço.

## frontend-reviewer · 1ª rodada · AJUSTES NECESSÁRIOS · 2026-11-05 14:20:07 · `tasks/prd-onboarding-por-convite/13_task.md`

VEREDITO: AJUSTES NECESSÁRIOS

Tela vista: sim (4 fotos lidas: painel "Importar alunos" a 1366 px e a 360 px, escola cheia e vazia). Só o estado de abertura tem foto. Prévia, erro, marcas e conclusão eu li pelo código e pelos casos de e2e, e não rodei o e2e. A lista da turma (`ListaDaTurma`) não tem foto nesta rodada. Li só o diff dela e vi uma peça usada, sem texto que vaze.

Estados: ok.
- Vazio: `EmptyState` "Nenhuma planilha escolhida", que convida com "Baixe o modelo, preencha… e escolha o arquivo" (`ImportarPlanilha.tsx:234`).
- Carregando: `LoadingState` "Lendo a planilha…" e "Conferindo a planilha com a escola…" (`:236`).
- Erro: `role="alert"` com o que fazer e "Tentar de novo" na falha da prévia (`:344-359`). Os textos de recusa e de falha da gravação dizem o que fazer (`previa-da-planilha.ts`).
- Com dado: prévia e conclusão. A conclusão diz que nada ficou de fora, ou quantas linhas ficaram.

Acessibilidade: ok pelo código.
- O campo tem `label` (`:319`) e o foco vai para o título da prévia, o alerta ou a conclusão.
- O `Sheet` é um `<dialog>` modal com foco preso, e há teste com axe no e2e.
- Os grupos de marca são `fieldset` com `legend`.
- Não conferi contraste e foco visível na tela.

Chromebook fraco: ok pelo código.
- O leitor de Excel é carregado sob demanda por `import('read-excel-file/browser')` (`ler-planilha.ts:59`).
- A prévia mostra erros, avisos e marcas de 100 em 100, o resto fica em contagem, e o arquivo é limitado a 512 KB e 3.000 linhas.
- Há caso de e2e com as 3.000 linhas.
- Não rodei o throttling.

Celular: ok nas fotos e no código.
- O painel vira folha de baixo a 360 px, sem rolagem lateral.
- "Baixar modelo" e "Choose File" têm mais de 44 px.
- As marcas são rótulos de `min-h-11`, com caixa de 20 px dentro.
- Nada depende de hover.
- A foto de 360 px mostra a página sem escurecer abaixo da folha, por volta de y=800. Isso é efeito da captura de página inteira com `<dialog>` fixo, não defeito do componente. Nenhum fluxo exige celular.

Ação oficial protegida: sim, com uma recomendação abaixo.
- Transferir, desligar e encerrar chegam desmarcados, inclusive o "marcar todos".
- Cada marca mostra nome e matrícula.
- O texto diz que é conferência e que só muda quem a coordenação marca.
- Com erro na prévia, o botão de gravar nem aparece.
- O clique duplo manda um pedido só.

Bloqueantes:
1. `apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx:322-329` (foto `coordenacao--coordenacao-estrutura--Importar-alunos--computador.png` e as três outras)
   - O `<input type="file">` fica à mostra, e a tela exibe "Choose File" e "No file chosen" em inglês, no computador e no celular, cheia e vazia.
   - O texto vem do navegador, não do produto. O produto não deve depender do idioma do navegador do Chromebook da escola.
   - Já existe o jeito certo no repositório. `DialogoDeEnvioDeMaterial.tsx:207` esconde o input (`hidden`, `tabIndex={-1}`) e usa um botão em português, "Escolher arquivo" ou "Trocar arquivo".
   - Correção exigida: fazer o mesmo aqui. Um botão em português com a classe de botão secundário e 44 px, que chama `input.click()`.
   - O `label` "Arquivo da planilha (Excel ou CSV)" tem de continuar acessível, com o nome do botão ou `aria-labelledby`.
   - O nome do arquivo lido já sai no `role="status"` ("Arquivo lido: …", `:330`). Mostre "Nenhum arquivo escolhido" em português quando não houver arquivo.
   - Os casos de e2e que usam `setInputFiles` continuam valendo com o input escondido. Atualize `ImportarPlanilha.test.tsx` e o e2e se algum buscar o campo pelo rótulo.

Recomendações:
- `ImportarPlanilha.tsx:430-445` (`GravarDaPrevia`): "Marcar todos para desligar" marca também os candidatos de páginas que a tela não abriu (`alternarTodos`). Depois disso a tela não diz quantos serão desligados ou transferidos. Ponha perto de "Gravar planilha" uma linha de resumo, por exemplo "Ao gravar: 12 alunos serão desligados e 3 mudarão de turma". É o que a regra 50, item 8, pede para lote. Hoje a decisão está à vista só na lista rolada.
- `ListaDaTurma.tsx:200` e a instrução da lista dizem "no campo acima", mas o campo de colar saiu. Troque por "na seção acima" ou "acima".
- `ListaDaTurma.tsx:314-318`: o comentário JSX e a linha em branco sobrando antes de `</section>` podem sair.

Arquivos de referência: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/material/DialogoDeEnvioDeMaterial.tsx`.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-05 14:20:22 · `tasks/prd-onboarding-por-convite/13_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. A tarefa mexe só na tela da planilha de alunos e da lista da turma. As escritas novas de `e2e/support/seed.ts` vão para `turma`, `serie` e `lista_nome`, não para `Nota`. Todos com autor humano? Sim, porque nenhum caminho chega a `Nota`.

Decisão autônoma sobre aluno: ausente.
- Transferir, desligar e encerrar só acontecem com a marca da coordenação. Cada candidato chega desmarcado, e o "marcar todos" também (`apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx:481-541`, a partir de `SEM_MARCAS` em `previa-da-planilha.ts:140`).
- Gravar sem marca não muda ninguém, e isso tem teste: `e2e/importar-alunos.spec.ts:322-363`, que confere no banco que a 8º A continua com 3 e a 8º B com 0. Há também `ImportarPlanilha.test.tsx:148` e `:167`, e `previa-da-planilha.test.ts:120`.
- O texto diz que a lista é "conferência feita a partir da planilha, não um resultado automático" (`previa-da-planilha.ts:135-136`). Isso é provado em `previa-da-planilha.test.ts:142` e em `e2e/importar-alunos.spec.ts:333`.
- O resto da prévia diz "só muda com a sua marca" / "só sai com a sua marca" (`previa-da-planilha.ts:58-60`).
- "Volta de um ano anterior" vem da linha que a própria coordenação escreveu na planilha, com a turma dela. Não há promoção nem retenção calculada pelo sistema.

Aprovação registrada: ok. Nenhuma saída de IA passa por este fluxo. Quem age é a coordenação, e cada ação tem registro no back da 9.0 e da 10.0 (`packages/core/src/importacao/tipos/alunos.ts:416`, `:427`, `:469`, mais o desligamento pelo `CicloDeVidaService`).

Supervisão do tutor: não se aplica. O tutor não aparece nesta tarefa.

Autonomia declarada e visível: não se aplica. Nenhum agente atua aqui, e a tela de governança não foi alterada.

Fotos da tela: as quatro (computador e celular, escola cheia e vazia) mostram só o painel aberto, "Importar alunos". Não aparece nenhuma saída de IA, nota, conceito ou sugestão de nota. Não há nada que induza uso, e o "×" para fechar está visível. O texto em português diz o que acontece antes de gravar (`apps/web/src/areas/coordenacao/importacao/PainelDaImportacaoDeAlunos.tsx:15`). Não há achado da regra 70 nas fotos.

Bloqueantes: nenhum.

Recomendações:
1. Antes de gravar, mostrar um resumo do que as marcas vão fazer, por exemplo "3 alunos serão desligados e perdem o acesso". Hoje o botão "Gravar planilha" (`ImportarPlanilha.tsx:431-446`) grava direto, e um "marcar todos para desligar" pode atingir centenas de alunos, inclusive os de páginas que a tela ainda não abriu (`previa-da-planilha.ts:160-165`). A decisão é humana, então não bloqueia. Mas a regra 50, item 8 ("ação oficial mostra o que vai acontecer antes de confirmar") sugere esse resumo. Fica para o `frontend-reviewer` e a retro.
2. `TEXTO_DA_CONFERENCIA` (`previa-da-planilha.ts:135`) cita transferir, desligar e tirar da grade, mas não a "volta". O item do TODO.md da 10.0 pedia que "volta" e "desligar" ficassem claros como escolha da coordenação, e foi dado como resolvido. A volta não tem marca, então vale dizer na frase do resto (`previa-da-planilha.ts:55`) que ela vem da turma que a coordenação escreveu na linha. É texto, não bloqueia.
3. O texto promete que "a sua escolha fica registrada". O back registra a transferência e o desligamento, mas nenhum teste desta tarefa liga essa frase à auditoria do que foi marcado. Fica para a 16.0 ou a retro: um caso de integração que leia, pela auditoria, quem marcou cada desligamento e quando.

Não precisei olhar `docs/regulacao.md`: esta tarefa não o altera e não cria nenhum fluxo de IA que ele precise cobrir.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/importacao/PainelDaImportacaoDeAlunos.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/e2e/importar-alunos.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/e2e/support/seed.ts

## infra-guardian · 1ª rodada · APROVADO · 2026-11-05 14:20:26 · `tasks/prd-onboarding-por-convite/13_task.md`

VEREDITO: APROVADO

Caminho quente tocado: fila. A tela grava a planilha pelo job e lê `GET /v1/importacoes/:id` até a importação terminar. A tarefa não muda nada em `apps/api`, `packages/core` nem em migration.

Rate limit: ok. As rotas de importação e as duas da lista da turma ficam no limite de 20 por minuto por usuário e ocupam as vagas da escola, como já provado na 8.0. As leituras repetidas da importação fazem umas 22 chamadas por minuto no pior caso, abaixo das 120 por usuário. No 429 o cliente espera o `Retry-After` ou mais (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/importacao/api/importacao.ts:122`), e há teste para isso.

Fila e prioridade: ok. O gravar responde 202 e o trabalho vai para o job `estrutura.gravar-planilha`. A tela não desiste aos 60 s: avisa que a fila está cheia e continua acompanhando. Sair da tela cancela a leitura pelo sinal.

Concorrência: protegida.
- No cliente, o clique duplo manda um pedido só (`useSingleSubmit`, `ImportarPlanilha.tsx:140`). O e2e com `dblclick` está em `importar-alunos.spec.ts` e em `lista-da-turma.spec.ts`.
- No banco, só cabe uma importação na fila por escola, por índice único parcial (`packages/core/src/db/schema/importacao-planilha.ts:47`). A segunda vira `CONFLITO`, com texto próprio na tela.
- Uma resposta de prévia que chega atrasada é descartada pelo número do arquivo e pelo cancelamento do pedido anterior (`ImportarPlanilha.tsx:168-196`).

Índice e paginação: ok. A tela não traz query nova. Na prévia, erros, avisos e marcas aparecem de 100 em 100 (`ImportarPlanilha.tsx:449`, `:513`). A lista da turma continua paginada de 100 em 100.

Degradação de IA: não se aplica.

Migration: não se aplica.

Métrica e alerta: ok. O código novo é só de tela. O lado do servidor já mede a fila por escola (`importacao.minutos_na_fila`, `packages/core/src/telemetry/metrics.ts:166`).

Bloqueantes: nenhum.

Recomendações:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/importacao/api/importacao.ts:145-155`: a leitura da importação não tem fim. Um job que trava fica na fila por até 1 h, até o próximo gravar ou o expurgo da noite fechá-lo. Nesse tempo, cada aba aberta faz cerca de 1.200 leituras, uma a cada 3 s. Sugestão: passado o prazo do job (300 s), ler bem menos vezes (de 15 em 15 a 30 em 30 s) ou parar e oferecer "verificar de novo". Também vale não ler com a aba escondida (`document.visibilityState`).
2. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/importacao/ler-planilha.ts:15` e `:65`: o teto do XLSX é 8 MB, cerca de 80 vezes o tamanho de uma planilha de 3.000 linhas (uns 100 KB). O arquivo é lido na thread principal do Chromebook. Isso não pesa no servidor, mas um XLSX inchado pode travar a aba da coordenadora. Sugestão: baixar o teto para 1 ou 2 MB, ou fazer a leitura num Web Worker.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-05 14:20:38 · `tasks/prd-onboarding-por-convite/13_task.md`

VEREDITO: **APROVADO**

A tarefa 13.0 é só de frontend: o componente `ImportarPlanilha` novo, o painel "Importar alunos" na aba Turmas e a lista da turma passando a usar o componente. Não há migration, rota nova nem log novo na API.

**Campos pessoais tocados:** nome e matrícula do aluno. Aparecem na tela da coordenação só nas caixas de marcar transferência e desligamento (o `candidato.rotulo`, em `apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx:529`). As listas de erro e de aviso mostram só "Linha N" e a frase do código (`ImportarPlanilha.tsx:462-464`), e o resto da planilha aparece só em contagem (`previa-da-planilha.ts:74-80`). O e2e confere que o nome não aparece no resto. Pela regra 60, item 11, a coordenação vê a escola dela, então mostrar nome e matrícula nas marcas está dentro da matriz.

**Fora da tabela de dados do docs/lgpd.md:** nada. "Planilha em gravação" e "Lista de nomes da turma" já estão em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/docs/lgpd.md:73` e `:84`, com finalidade e retenção. Nenhum campo proibido para aluno foi criado. Se a planilha da escola trouxer uma coluna a mais (CPF, nascimento, e-mail), a API recusa o arquivo inteiro: o cabeçalho precisa ter exatamente as colunas do modelo (`packages/core/src/importacao/leitor.ts:58-64`). Matrícula com forma de CPF ou de data também é recusada (`previa-da-planilha.ts`, `matricula_parece_documento`).

**Autorização por objeto:** ok, nada mudou na API. As rotas que a tela chama (`/v1/importacoes/:tipo/previa`, `/v1/importacoes/:tipo`, `/v1/importacoes/:id`, `/v1/turmas/:id/lista/previa` e `/lista`) já existiam e foram auditadas nas tarefas que as criaram. O id da turma vem da rota e o escopo vem do token, no servidor.

**Logs:** limpos. Não há `console.*`, logger nem envio de erro a serviço externo em `importacao/` nem em `estrutura/`.

**Armazenamento do navegador:** limpo. O texto da planilha fica só na memória da página e no corpo do POST. Não vai para `localStorage`, `sessionStorage` nem endereço, e a prévia tem `gcTime: 0` (`ImportarPlanilha.tsx:165`). O painel `?painel=importar` leva só o nome do painel, nada de pessoa. O e2e `importar-alunos.spec.ts:127-134` confere o armazenamento, o endereço, o IndexedDB e o Cache Storage depois de gravar.

**Auditoria:** presente. O que esta tarefa dispara, gravar a planilha, já registra `planilha.gravada`, `lista.transferida` e `lista_nome.retirado` no job, conforme o mapa de dados. Esta tarefa não cria leitura nova.

**Envio externo:** nenhum. Nada vai para IA nem para terceiro. O arquivo XLSX é lido no navegador e só o texto vai à nossa API. O leitor de XLSX (`read-excel-file`) carrega sob demanda, do nosso próprio servidor.

**Seed/fixture:** sintético. A escola "Colégio sintético", os nomes inventados ("Caio Pires (2026010)", "Ana Souza", "00123"), o XLSX montado pelo próprio teste em `apps/web/src/__fixtures__/xlsx.ts` e as funções novas de `e2e/support/seed.ts` (`criarTurmaComNomeNoBanco`, `aprovarNaListaDaTurma`), que só gravam ids e o nome da turma.

**Fotos da tela:** as quatro mostram o painel aberto antes de escolher arquivo. Só aparecem a escola, a coordenadora, os professores e as turmas sintéticas, que são da própria escola. Não aparece nenhum dado de aluno. A prévia, as marcas e a conclusão não têm foto e foram conferidas pelo código e pelos testes.

**Pergunta de fechamento:** a tarefa não muda a resposta. A tela não guarda nada sobre o aluno além do que a API já guarda, e o que a API guarda está mapeado e entra no arquivo do titular.

**Bloqueantes:** nenhum.

**Recomendações:**
1. `apps/web/src/areas/coordenacao/importacao/ler-planilha.ts:46-53`: o navegador manda todas as colunas da primeira aba. Se a planilha da escola tiver CPF ou nascimento ao lado, esse texto chega ao servidor antes da recusa, mesmo sem ser gravado. Seria melhor cortar as colunas fora do modelo, ou recusar o cabeçalho errado já no navegador. Isso é minimização, não vazamento.
2. `apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx:140-155`: o pedido de gravar guarda o texto da planilha como `variables` da mutação de `useSingleSubmit`. Se essa mutação usa o `gcTime` padrão, o texto fica em memória uns minutos depois que o painel fecha. Vale passar `gcTime: 0`, como já foi feito na prévia.
3. Os testes da tarefa não rodaram neste checkout: 5 arquivos falharam ao carregar, com "Failed to resolve entry for package @educa/shared". Os 101 casos que rodaram passaram. Parece faltar o build do pacote compartilhado aqui; vale confirmar que eles rodam na esteira antes do pouso.

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-05 14:22:30 · `tasks/prd-onboarding-por-convite/13_task.md`

VEREDITO: REPROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. Uma referência do `13_task.md` aponta para um texto que não está na spec (recomendação 2).

Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")

Bloqueantes:

1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx:135-139`: o `AbortController` que acompanha a gravação nasce já cancelado em `StrictMode`. O app inteiro roda em `StrictMode` (`apps/web/src/main.tsx:56`).
   ```ts
   const controle = useRef(new AbortController())
   useEffect(() => {
     const daTela = controle.current
     return () => daTela.abort()
   }, [])
   ```
   - **Por que acontece:** em desenvolvimento, o React monta, desmonta e remonta o componente, e a `ref` se mantém nesse ciclo. A limpeza do efeito cancela o único controlador que existe, e a remontagem pega esse mesmo controlador, já cancelado.
   - **Prova:** montei o componente em `StrictMode` com jsdom e `NODE_ENV=development`. Logo depois de montar, `signal.aborted` dá `true`. O script está em `/tmp/claude-1000/-home-joaquimdp-Documents-git--maestri-floors-educaia--speconboarding-por-convite--l2/527b32f1-ec24-4aed-a82e-783d2220acc6/scratchpad/strict.cjs`.
   - **Efeito:** o `POST` do gravar não leva esse sinal, então a importação entra na fila (202). Logo em seguida o `sinal?.throwIfAborted()` de `acompanharImportacao` (`api/importacao.ts:146`) lança o erro de cancelamento. A coordenação vê o alerta de falha para uma gravação que vai concluir, e o `aoConcluir` não recarrega as turmas. Se ela tentar de novo, recebe `CONFLITO` ou "Nada novo para gravar". Isso acontece em toda gravação no `npm run dev`, nas duas telas que usam a peça: o painel "Importar alunos" e a lista da turma.
   - **Por que os testes não pegaram:** o e2e roda sobre o build do compose, e os testes de unidade não montam em `StrictMode`. O projeto já se protege disso em outras telas (`ConfigurarMfa.tsx`, `ReauthDialog.tsx`, `Aprovar.test.tsx` com `estrito: true`).
   - **Correção exigida:**
     - Criar o controlador dentro do efeito e guardá-lo na ref: `useEffect(() => { const daTela = new AbortController(); controle.current = daTela; return () => daTela.abort() }, [])`, com a ref começando em `undefined`. Assim a gravação usa sempre o controlador da montagem viva.
     - Acrescentar um caso em `ImportarPlanilha.test.tsx` que monte a peça dentro de `<StrictMode>`, grave e veja "Planilha gravada", como o `montar(..., { estrito: true })` do `Aprovar.test.tsx`.

Recomendações:

1. **Falta na spec, para o Arquiteto antes do pouso.** O RF16 diz "ou o planejado que a coordenação escolhe", e a virada de ano da 10.0 só existe na planilha do ano `planejado`. Mas o painel "Importar alunos" não manda `anoLetivoId`, e o botão some sem ano em curso (`Estrutura.tsx:276`). Nenhuma tarefa (13.0 a 16.0) traz a escolha do planejado para a planilha de alunos; a 14.0 só traz para o calendário. Hoje, a volta do aluno na virada não tem caminho pela tela. Não reprovo por isso porque o `13_task.md` não pediu.
2. **Referência errada no `13_task.md`.** A segunda linha de "Divergências resolvidas" aponta para "`techspec.md` §4 (a lista da turma usa a peça única)", mas esse texto não está na §4. A §9 cita o `ImportarPlanilha` só em Turmas, Professores e Grade e calendário. Corrigir a referência, ou pôr a lista da turma na §9.
3. **`ListaDaTurma.tsx`:**
   - linhas 72-73: o comentário ainda fala da tela antiga ("editar o texto a descarta").
   - linhas 316-320: linhas em branco sobrando dentro do JSX e entre as funções.
4. **`docs/roteiro-da-demonstracao.md`:** ainda diz "Lista colada". A 16.4 já confere esse documento, então só deixo registrado.
5. **Fotos (`...--Importar-alunos--computador.png` e `...--celular.png`):** o seletor nativo aparece como "Choose File / No file chosen", porque o navegador da vitrine está em inglês. Na tela real depende do idioma do navegador. A avaliação é do `frontend-reviewer`.
6. **`previa-da-planilha.ts`:** já traz textos de `encerrar` e `sai_da_grade`, que são da 14.0. São só textos sobre o contrato que já existe, sem a tela da grade, então não chega a invadir a tarefa. Vale a 14.0 revisá-los no contexto dela.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-05 14:23:16 · `tasks/prd-onboarding-por-convite/13_task.md`

VEREDITO: REPROVADO

Cenários exigidos:
- **Caminho feliz:** CSV → prévia → gravar → resultado com foco, e a lista da turma pela mesma peça (202).
- **Bordas do domínio:** turma escrita errada ou vazia; matrícula repetida; matrícula com zero à esquerda no XLSX (célula de texto e de número); CSV do Excel em windows-1252, UTF-8 com BOM e UTF-16; dois alunos com o mesmo nome; aluno transferido no meio do ano (marca de transferir); aluno que saiu (marca de desligar); a matrícula que outra pessoa usou entre a prévia e o gravar; a escola que mudou desde a prévia (`desatualizada`); 3.000 linhas.
- **Permissão (regra 70):** nada muda sem a marca da coordenação. Gravar sem marca não mexe em ninguém, e o "marcar todos" chega desmarcado. A rota é só da coordenação; a recusa a outro papel foi provada na API (8.0).
- **Isolamento:** a coordenação seguinte, na mesma aba, não vê a prévia nem o arquivo da anterior. `candidatos` e `rotulo` vêm só da escola da sessão (prova da API, 8.0/10.0).
- **Carga e concorrência:** clique duplo em gravar; outra importação da escola em andamento (`CONFLITO`); fila acima de 60 s; 429 com `Retry-After`; resposta atrasada da prévia anterior; sair da tela no meio do acompanhamento.

Cobertos: caminho feliz, carregando, vazio com "Baixar modelo", falha com "Tentar de novo", erros em frase de cem em cem, nada no armazenamento do navegador, clique duplo (`dblclick` e um POST só, nos dois e2e), marcas desmarcadas com prova no banco, 360 px, `paginaNaoRola`, axe, uma ação cheia, XLSX sob demanda, 3.000 linhas, recomeço (segunda coordenação, mesmo arquivo de novo, resposta atrasada, falha com a prévia aberta), `CONFLITO` e `desatualizada` em textos diferentes, a fila lenta com relógio falso (`importacao.test.ts`), o 429. Não há `.skip`, nenhum teste chama provedor pago, e os 7 arquivos de unidade e de componente rodaram verdes (94 casos).

Bloqueantes:
1. **"Sair da tela aborta a leitura" não tem teste da tela.** `apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx:136-139`: tirando o `return () => daTela.abort()`, todos os testes continuam verdes. O caso `api/importacao.test.ts › sair da tela cancela` só prova que `acompanharImportacao` respeita o sinal, não que a tela o dispara. Na tabela, a linha 77 junta esse item ao do 429 e cita só o caso do 429. **Correção:** um teste de componente que desmonta a peça (ou fecha o painel) com a importação `na_fila` e confere que nenhum `GET /v1/importacoes/:id` sai depois disso; o bloco de mutação dessa linha; a linha 77 citando esse caso.
2. **Condição nova sem bloco de mutação.** Em `ImportarPlanilha.tsx:230`, a condição `(escolha.texto === undefined || previaNoAr)` não tem bloco. Trocada por `true`, o "Conferindo a planilha com a escola…" fica na tela para sempre depois de uma prévia que falha, junto com o alerta, e nenhum teste percebe: `ImportarPlanilha.test.tsx:104` e `e2e/importar-alunos.spec.ts:197` não conferem que o carregando sumiu. **Correção:** no caso da falha da prévia, conferir que o carregando não está na tela quando o alerta aparece, e escrever o bloco dessa condição.
3. **A conclusão afirma uma coisa falsa, e os testes foram afrouxados para aceitá-la.** `previa-da-planilha.ts:189-206` só conta como "de fora" as linhas `muda_de_turma` sem marca. A linha que cai entre a prévia e o gravar não entra nessa conta, e a tela diz "Nenhuma linha ficou de fora.".
   - `ListaDaTurma.test.tsx`, caso "parcial: uma entrou e a outra não": a tela mostra "1 aluno entrou. Nenhuma linha ficou de fora.", e o teste confere só "1 aluno entrou.".
   - `e2e/lista-da-turma.spec.ts:343`: a lista de uma linha cuja matrícula outra pessoa usou depois da prévia termina em "0 alunos entraram. Nenhuma linha ficou de fora.", e o teste confere só "0 alunos entraram".
   - Antes desta tarefa, a tela tinha um texto próprio para esse caso, apagado junto com `CONFLITO_DA_GRAVACAO` em `ListaDaTurma.test.tsx`.

   **Correção:** contar como "de fora" as linhas que gravariam pela prévia menos o que o `resumo` diz que gravou (ou pedir à API essa contagem). Os dois testes passam a conferir a frase inteira, inclusive a parte de quem ficou de fora.
4. **Prazo provado com o relógio de verdade.** `ImportarPlanilha.fila.test.tsx:17` e `:51` reduzem o prazo do aviso a 150 ms de relógio real. A asserção "logo depois do clique ainda não passou o prazo" depende de o clique e o `findByText` levarem menos de uns 150 ms. Uma pausa da máquina sob carga deixa o caso vermelho sem defeito no código, e é o único teste que prova o bloco de `demorando`. **Correção:** no `vi.mock`, injetar um `agora` controlado pelo teste (por exemplo, que avança a cada leitura), como `importacao.test.ts` já faz, em vez do `Date.now`.
5. **Linhas da tabela de testes citam um caso que não prova o item.** Os testes existem, mas a citação aponta para outro, e a validação vai conferir o caso errado:
   - Linha 49 (UTF-16): o e2e citado não tem UTF-16. Citar `ler-arquivo-da-lista.test.ts › o "Texto Unicode" do Excel, em UTF-16 com BOM…`.
   - Linha 50 (célula numérica vira `123`): citar `ler-planilha.test.ts › a matrícula que o Excel guardou como número…`.
   - Linha 75 ("a lista com um acento corrigido grava"): está marcada como e2e, mas não existe e2e para isso. Escrever o e2e ou trocar o tipo para unidade e citar `previa-da-planilha.test.ts › só grava com algo novo…`.
   - Linha 78 ("ao concluir, quantas entraram e quantas ficaram de fora"): citar `previa-da-planilha.test.ts › a conclusão conta quantas entraram…`.

Recomendações:
- `api/importacao.ts:154`: nenhum teste prova o teto de 3 s entre leituras. Tirado o `Math.min`, todos os casos seguem verdes, e o comentário de `importacao.test.ts:44` diz "e tem teto" com esperas que nunca chegam a ele. Vale uma asserção de `Math.max(...esperas) <= 3_000` no caso da fila lenta.
- Condições que nunca mudam o resultado: em `ImportarPlanilha.tsx:227`, as partes `previa === undefined` e `conclusao === undefined`; em `:251` e `:283`, a parte `escolha?.texto === undefined`. Tirar ou justificar.
- `e2e/importar-alunos.spec.ts:246` e `e2e/lista-da-turma.spec.ts:323` esperam 300 ms com `page.waitForTimeout`. A asserção negativa fica verde mesmo se a resposta antiga chegar depois disso. Melhor esperar o fim (ou o cancelamento) do pedido segurado.
- Alvo de 24 px (linha 69 da tabela): só a marca de um aluno é medida. Faltam "Marcar todos", "Ver mais", "Baixar modelo" e "Tentar de novo" no painel de importar.
- Nenhum teste confere que o "Marcar todos" aparece marcado depois de marcar todos. O `todos` da linha 512 só aparece na tela.
- `previa-da-planilha.test.ts:41`: "diz o que fazer" é provado só por `length > 20`. Vale conferir um verbo de ação por código.

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.fila.test.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/importacao/api/importacao.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.test.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/e2e/lista-da-turma.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/e2e/importar-alunos.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/tasks/prd-onboarding-por-convite/13_task.md

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-05 17:02:27 · `tasks/prd-onboarding-por-convite/13_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova e nenhuma migration nesta rodada. O diff entre a 1ª e a 2ª rodada não toca `apps/api`, `packages` nem `e2e/support/seed.ts`.

Queries verificadas: nenhum repository novo ou alterado. Os corpos de `POST /v1/importacoes/alunos/previa` (`{ texto }`) e de `POST /v1/importacoes/alunos` (`{ texto, marcas }`) continuam iguais. A rodada mudou apenas o seguinte, e nada disso passa `escolaId` ou `anoLetivoId` por corpo, query ou endereço:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx`: o seletor de arquivo agora é um botão em português que aciona o campo escondido. O `AbortController` passou a nascer dentro do efeito.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts`: entraram `linhasDeFora` e `resumoDasMarcas`. As duas fazem contas só no navegador, com a prévia e o `resumo` da própria importação.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/importacao/api/importacao.ts`: só mudou o tipo do `sinal`.
- `ListaDaTurma.tsx`: mudaram apenas textos e comentários.

A nova frase "a escola mudou entre a prévia e o gravar (a matrícula passou a ser de outra turma ou de outro aluno)" é uma diferença de contagem entre a prévia e o `resumo` da mesma escola. Ela não revela se um registro de outra escola existe.

Teste de isolamento: presente e efetivo. Esta rodada não tem backend novo. Os testes citados na 1ª rodada continuam cobrindo as rotas que a tela usa: `apps/api/test/importacao.int.test.ts`, `apps/api/test/importacao-alunos.int.test.ts` e `apps/api/test/lista.int.test.ts`. O e2e da coordenação anterior na mesma aba, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/e2e/importar-alunos.spec.ts`, não foi tocado.

Bloqueantes: nenhum

Recomendações:
- Fica a da 1ª rodada, ainda aberta: falta, em `apps/api/test/importacao-alunos.int.test.ts`, um caso com um candidato a desligar de mesmo nome na escola B. O teste deve afirmar que o rótulo dele não aparece na prévia da escola A.
- O item que o `TODO.md` mandou ao Arquiteto (o RF16 e o ano planejado escolhido pela coordenação) diz respeito a esta regra. Se o painel passar a mandar `anoLetivoId`, o backend precisa verificar que o ano é da escola do token e responder igual quando o ano é de outra escola ou não existe. Essa mudança deve voltar para auditoria de isolamento.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-05 17:02:52 · `tasks/prd-onboarding-por-convite/13_task.md`

VEREDITO: APROVADO
Caminho quente tocado: fila (a tela grava pelo job `estrutura.gravar-planilha` e lê `GET /v1/importacoes/:id` até a importação terminar; nada mudou em `apps/api`, `packages/core` nem em migration nesta rodada)
Rate limit: ok (as rotas e o limite por usuário e por escola são os mesmos da 1ª rodada. No 429 o cliente continua esperando o `Retry-After` ou mais)
Fila e prioridade: ok
Concorrência: protegida.
- A correção do `AbortController` em `StrictMode` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx:138-144`) tira o caso de uma gravação que entra na fila (202) e a tela mostra como falha. Esse erro levava a coordenação a tentar de novo e cair em `CONFLITO`.
- Agora há dois casos de teste. `ImportarPlanilha.test.tsx:264` monta a tela em `StrictMode` e espera a gravação concluir. `ImportarPlanilha.fila.test.tsx:93` confere que nenhuma leitura sai depois de desmontar a tela.
- O clique duplo continua mandando um pedido só (`useSingleSubmit`). No banco, a importação na fila continua única por escola.
Índice e paginação: ok (nenhuma query nova; a prévia e a lista seguem de 100 em 100)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (código só de tela; o servidor já mede `importacao.minutos_na_fila` por escola)
Bloqueantes: nenhum
Recomendações:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/importacao/api/importacao.ts:146-158`: a recomendação da 1ª rodada continua aberta. A leitura da importação não tem fim. Agora há teste de que ela chega ao teto de 3 s (`importacao.test.ts:82`). Com o job travado, cada aba aberta faz uma leitura a cada 3 s até a importação ser fechada (até 1 h). Passado o prazo do job (300 s), vale ler menos vezes ou parar e oferecer "verificar de novo". Também vale pausar a leitura com a aba escondida (`document.visibilityState`).
2. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx:148`: `controle.current?.signal` aceita `undefined` em silêncio. Se um dia o gravar for chamado antes do efeito rodar, a leitura fica sem cancelamento e ninguém percebe. Melhor falhar alto quando o controlador não existir do que seguir sem sinal.
3. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/importacao/ler-planilha.ts:15`: a recomendação da 1ª rodada sobre o teto de 8 MB do XLSX, lido no Chromebook, continua aberta.

## frontend-reviewer · 2ª rodada · APROVADO · 2026-11-05 17:03:04 · `tasks/prd-onboarding-por-convite/13_task.md`

VEREDITO: APROVADO
Tela vista: sim (10 fotos lidas: o painel "Importar alunos" e a lista de nomes da turma, cada um a 1366 e a 360 px, na escola cheia e na vazia). A foto celular-2 da escola vazia é uma faixa em branco, só o rodapé da página.
Estados: ok.
- O vazio convida a baixar o modelo e escolher o arquivo.
- "Conferindo a planilha…" some quando a prévia falha, e o e2e e o teste de unidade conferem isso.
- O erro vem com "Tentar de novo".
- A prévia com dado foi vista só pelo código e pelo e2e. As fotos não a mostram, como o prompt avisou.

Acessibilidade: ok.
- O rótulo "Arquivo da planilha (Excel ou CSV)" continua ligado ao campo escondido (`htmlFor`), e o botão o referencia por `aria-describedby`.
- O botão é nativo, então o teclado e o foco funcionam. O campo escondido sai da ordem de tabulação.
- "Trocar arquivo" fica desligado durante a gravação.
- "Marcar todos" passou a aparecer marcado quando todos do grupo estão marcados.

Chromebook fraco: ok.
- O acompanhamento da importação ganhou espera crescente com teto de 3 s, e o teste confere o teto.
- O abort ao sair da tela está coberto por teste.
- O `AbortController` agora nasce no efeito, o que corrige o StrictMode, e há teste com o StrictMode por fora do provider.
- Ficam registradas no TODO, como na rodada anterior, as recomendações de minimização no navegador, o teto de 8 MB do XLSX e a leitura sem fim.

Celular: ok.
- A 360 px não há rolagem horizontal nem texto cortado nas fotos.
- "Escolher arquivo" e "Baixar modelo" são botões de 44 px (`min-h-11`, a classe `SECONDARY_BUTTON_CLASSES`).
- O e2e confere os alvos de "Trocar arquivo", "Baixar modelo", "Marcar todos", "Ver mais" e "Tentar de novo" (24 px) e o "Gravar planilha" (44 px).
- Nada depende de hover.
- Na foto celular-1 da lista da turma, a barra inferior fixa cobre parte do bloco "Nenhuma planilha escolhida". É artefato da foto de página inteira com elemento fixo, não defeito.

Ação oficial protegida: sim.
- Antes de "Gravar planilha", uma frase diz o que as marcas vão fazer, por exemplo "Ao gravar, com as suas marcas: 2 alunos mudarão de turma; 1 aluno será desligado e perde o acesso.". Ela some sem marca.
- Transferir e desligar chegam desmarcados.
- A conclusão não afirma mais "Nenhuma linha ficou de fora" quando a conta não fecha. Agora diz "a escola mudou entre a prévia e o gravar…", em `previa-da-planilha.ts:204-226`.

Bloqueantes: nenhum.
- A correção exigida da 1ª rodada foi feita em `ImportarPlanilha.tsx:456-486`. O `<input type="file">` está escondido (`hidden`, `tabIndex={-1}`). O botão em português diz "Escolher arquivo" e depois "Trocar arquivo", e chama `campo.current?.click()`. "Nenhum arquivo escolhido." aparece em português e some quando há arquivo.
- As fotos mostram "ESCOLHER ARQUIVO" e "Nenhum arquivo escolhido" nas telas cheia e vazia, no computador e no celular. Não há inglês nem texto do navegador.
- Os dois textos de frase também são cobertos por `ImportarPlanilha.test.tsx` (seletor em português) e pelo e2e (`toBeHidden` no campo).
- As três recomendações aplicadas foram confirmadas no diff:
  - O resumo das marcas está perto de "Gravar planilha".
  - A lista vazia diz "na seção acima" (`ListaDaTurma.tsx:203`).
  - As linhas em branco e o comentário sobrando saíram de `ListaDaTurma.tsx`.

Recomendações:
- Na foto da escola cheia a 1366 px, o botão "ANO LETIVO E DIS…" fica cortado atrás do painel lateral. É da tela de baixo, coberta pelo painel, e não é desta tarefa.
- A frase "Ao gravar, com as suas marcas…" está em `font-medium text-tinta`. Se ganhar mais peso visual que o botão, vale testar a hierarquia na validação.
- `docs/roteiro-da-demonstracao.md` ainda diz "Lista colada". O TODO já leva isso à 16.4.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-05 17:03:08 · `tasks/prd-onboarding-por-convite/13_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta rodada. O diff mexe só na tela da planilha (`importacao/`, `ListaDaTurma.tsx`), nos e2e, no `docs/interface.md`, no `TODO.md` e no `13_task.md`. Não muda seed, job nem backend. Todos com autor humano? Sim, porque nenhum caminho chega a `Nota`.

Decisão autônoma sobre aluno: ausente. A rodada até reforça a decisão humana.
- **Resumo antes de gravar.** Era a minha recomendação 1 da 1ª rodada e foi feita. Perto de "Gravar planilha" a tela diz o que as marcas vão fazer, por exemplo "Ao gravar, com as suas marcas: 3 alunos serão desligados e perdem o acesso." Sem marca, a frase não aparece.
  - Código: `previa-da-planilha.ts:235` (`resumoDasMarcas`) e `ImportarPlanilha.tsx:458`.
  - Testes: `ImportarPlanilha.test.tsx` ("perto do 'Gravar planilha' a tela diz o que as marcas vão fazer, e some sem marca"), `previa-da-planilha.test.ts` e `e2e/importar-alunos.spec.ts`, com marcar e desmarcar no e2e.
  - Isso mitiga o "marcar todos", que também pega quem está em página ainda não aberta.
- **Texto da volta.** Era a recomendação 2 e foi feita. A frase da volta diz agora "para a turma que a linha escreve" (`previa-da-planilha.ts:55`), com teste em `previa-da-planilha.test.ts` e mutação registrada. Fica claro que a turma vem da planilha da coordenação, não de promoção ou retenção calculada.
- **"Marcar todos".** Continua desmarcado ao chegar e não marca outro grupo. Há teste novo em `ImportarPlanilha.test.tsx`.
- **Linhas de fora.** `textoDaConclusao` agora separa "sem marca" de "a escola mudou entre a prévia e o gravar". É informação à coordenação e não decide nada.

Aprovação registrada: ok. Nenhuma saída de IA passa por este fluxo.

Supervisão do tutor: não se aplica. O tutor não aparece nesta tarefa.

Autonomia declarada e visível: não se aplica. Nenhum agente atua aqui, e a governança não foi alterada.

Fotos da tela, as dez listadas: o painel "Importar alunos" e a lista da turma, no computador e no celular, na escola cheia e na vazia.
- Não aparece saída de IA, nota, conceito nem sugestão de nota.
- Nada induz uso. O "×" do painel está visível e fecha.
- O seletor em português ("Escolher arquivo", "Nenhum arquivo escolhido.") produz o texto que a pessoa vê (`ImportarPlanilha.tsx`, `SeletorDoArquivo`).
- O vazio da lista diz "na seção acima" (`ListaDaTurma.tsx:203`).
- `vazia--...--celular-2.png` é uma faixa de 360 × 24 sem conteúdo.
- Nenhum achado da regra 70 nas fotos. No celular, a folha do painel termina no meio da tela e a página aparece embaixo dela sem o escurecimento, mas isso é do `frontend-reviewer`.

Bloqueantes: nenhum.

Recomendações:
1. A recomendação 3 da 1ª rodada continua aberta, agora no `TODO.md` para a 16.0. Falta um teste de integração que ligue a frase "a sua escolha fica registrada" (`TEXTO_DA_CONFERENCIA`, `previa-da-planilha.ts:135`) à auditoria de quem marcou cada desligamento e quando. Continua sem bloquear.
2. O parágrafo do resumo das marcas (`ImportarPlanilha.tsx:458`) muda a cada marca, mas não está numa região anunciada. Quem usa leitor de tela pode gravar sem ouvir "3 alunos serão desligados". Isso é acessibilidade, e fica para o `frontend-reviewer` avaliar se cabe um `aria-live="polite"` ou ligar a frase ao botão por `aria-describedby`.

Não precisei olhar `docs/regulacao.md`: o diff não o altera e não cria fluxo de IA.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/e2e/importar-alunos.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/TODO.md

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-05 17:03:16 · `tasks/prd-onboarding-por-convite/13_task.md`

VEREDITO: APROVADO

A 1ª rodada não exigiu correção. Nesta rodada auditei só o diff r1→r2 e o que ele afeta. Todas as mudanças são de tela e de teste: nenhuma rota, migration, repository, log ou envio externo novo.

**Campos pessoais tocados:** nome e matrícula do aluno, os mesmos da 1ª rodada. O que entrou de novo só mostra contagens, nunca nome:
- `resumoDasMarcas` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts:752-760`) diz quantos alunos serão transferidos ou desligados.
- `linhasDeFora` (`:738-746`) e a conclusão nova (`:708-728`) dizem quantas linhas ficaram de fora e por quê.

O pedido de gravar agora guarda `linhas`, as linhas da prévia, em vez de um número. Cada linha traz só o número da linha, o resultado e o código de erro ou aviso, sem nome (`packages/shared/src/importacao/contratos.ts:184`). A mutação continua com `gcTime: 0` (`apps/web/src/components/dialogs.tsx:28`).

**Fora da tabela de dados do docs/lgpd.md:** nada. Nenhum campo novo, e nenhum campo proibido para aluno.

**Autorização por objeto:** ok. A API não mudou. As rotas consumidas são as mesmas da 1ª rodada, com o escopo vindo do token.

**Logs:** limpos. Não há `console.*` nem logger em `importacao/` nem em `ListaDaTurma.tsx`. Também não há `localStorage` nem `sessionStorage`; esses nomes só aparecem em comentário.

**Auditoria:** presente. Gravar continua no job, com `planilha.gravada`, `lista.transferida` e `lista_nome.retirado`. A leitura da lista da turma pela coordenação continua auditada (`turma.lista_lida`).

**Envio externo:** nenhum. O XLSX é lido no navegador e só o texto vai à nossa API. Nada vai para IA nem para terceiro.

**Seed/fixture:** sintético. Os testes novos usam "Caio Pires (2026010)", "Duda Alves (2026011)", "Eva Mota (2026012)" e "Ana" com matrícula "1".

**Fotos da tela:** li as dez.
- **Painel "Importar alunos"** (`coordenacao--coordenacao-estrutura--Turmas-Importar-alunos--computador.png`, `--celular.png` e as duas da escola vazia): nenhum dado de aluno. Aparecem só a escola, a coordenadora, os professores e as turmas sintéticas da própria escola. O seletor agora está em português ("Escolher arquivo", "Nenhum arquivo escolhido."), sem dado novo.
- **Lista da turma, escola cheia** (`coordenacao--coordenacao-estrutura--Turmas-link-name-Lista-de-nomes-da-turma-2ºB--celular-1.png`): mostra nome e matrícula ("Aluna Sintética Bia Vitrine, 90000001" e outros). São nomes sintéticos, de uma turma da própria escola, para a coordenação, numa leitura auditada (`apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.tsx:68-69`). Isso está dentro da matriz; não é achado.
- **Lista da turma, escola vazia** (`vazia--...--Lista-de-nomes-da-turma--celular-1.png`): mostra o texto corrigido, "na seção acima", sem dado de pessoa.
- **`--celular-2.png`, escola cheia:** só professores e pedidos de nome, sem dado de aluno.
- **`--celular-2.png`, escola vazia:** o arquivo tem 171 bytes e não conferi o que mostra.

**Pergunta de fechamento:** a rodada não muda a resposta. A tela não guarda nada além do que a API já guarda e mapeia, e nada sai para terceiro.

**Bloqueantes:** nenhum.

**Recomendações:**
1. Continua aberta a da 1ª rodada sobre minimização no navegador: `ler-planilha.ts:46-53` manda todas as colunas da primeira aba. Ela já está no `TODO.md`. Não é vazamento, porque a API recusa o arquivo com coluna fora do modelo.
2. Errei na recomendação 2 da 1ª rodada (`gcTime: 0` na mutação de gravar): `useSingleSubmit` já passa `gcTime: 0` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/components/dialogs.tsx:28`). Ela pode sair da lista.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-05 17:04:12 · `tasks/prd-onboarding-por-convite/13_task.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok

Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")

Bloqueantes: nenhum

A correção que eu exigi na 1ª rodada foi feita:
- **O controlador:** em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx:135-142`, o `AbortController` agora nasce dentro do efeito e fica guardado na ref, que começa em `undefined`. A gravação lê `controle.current?.signal`, que é sempre o controlador da montagem viva.
- **O teste em `StrictMode`:** o caso novo de `ImportarPlanilha.test.tsx` monta a peça dentro de `<StrictMode>`, grava e confere "Planilha gravada", sem alerta e com `aoConcluir` chamado uma vez.
- **O bloco de mutação:** o `13_task.md` tem um bloco que reproduz o defeito antigo (`controle.current ?? new AbortController()`). O portão roda as mutações do documento e o carimbo vale para a árvore atual, então o teste derruba esse defeito.

O resto do diff atende aos bloqueantes do `frontend-reviewer` e do `test-engineer` e a recomendações deles. Nada disso sai da tela da 13.0 nem diverge da Tech Spec:
- O seletor de arquivo agora é um botão em português, e o campo do navegador fica escondido.
- A conclusão diz quantas linhas ficaram de fora e por quê (`linhasDeFora`).
- Perto de "Gravar planilha" aparece o resumo das marcas.
- O texto da volta ficou mais claro.

O `docs/interface.md` acompanha as mudanças. As recomendações que não foram aplicadas estão no `TODO.md`, cada uma com destino, incluindo a do RF16 com o ano planejado, para o Arquiteto.

Nas fotos, o painel "Importar alunos" e a lista da turma, no computador e no celular, na escola cheia e na vazia, mostram "Escolher arquivo" e "Nenhum arquivo escolhido." em português. O vazio da lista diz "na seção acima". Não aparece nada fora do que a tarefa pede.

Recomendações:
1. **O comentário do teste em StrictMode:** em `ImportarPlanilha.test.tsx`, o comentário diz que "dentro do `QueryClientProvider` (o `renderScreen`) o React não monta, desmonta e monta de novo". Na verdade, o que falta no `renderScreen` é o próprio `StrictMode`, e não um problema do provider. Reescrever para "o `renderScreen` não monta em `StrictMode`".
2. **A frase de quem ficou de fora:** `linhasDeFora` (`previa-da-planilha.ts`) conta em `mudaram` toda linha `entra`, `volta` ou `nome_corrigido` que o `resumo` não registrou. A linha que vira `ja_existe` entre a prévia e o gravar, quando outra pessoa grava o mesmo aluno na mesma turma, também cai aí. Nesse caso a frase "a matrícula passou a ser de outra turma ou de outro aluno" é imprecisa. Para não afirmar uma causa que pode não ser a real, vale algo como "a escola mudou entre a prévia e o gravar. Veja a lista…".
3. **A ordem das importações:** em `ImportarPlanilha.tsx`, `resumoDasMarcas` entrou antes de `previaEnvelheceu` e quebrou a ordem alfabética das importações. É só arrumação.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/tasks/prd-onboarding-por-convite/13_task.md

## test-engineer · 2ª rodada · APROVADO · 2026-11-05 17:05:01 · `tasks/prd-onboarding-por-convite/13_task.md`

VEREDITO: APROVADO

**Cenários exigidos:** os mesmos da 1ª rodada.
- **Caminho feliz:** CSV, depois prévia, depois gravar, e o resultado com o foco. A lista da turma usa a mesma peça.
- **Bordas:** turma escrita errada ou vazia, matrícula repetida, zero à esquerda no XLSX (célula de texto e de número), CSV em windows-1252, UTF-8 com BOM e UTF-16, dois alunos com o mesmo nome, transferência e desligamento por marca, a matrícula que outra pessoa usou entre a prévia e o gravar, `desatualizada` e as 3.000 linhas.
- **Permissão (regra 70):** nada muda sem a marca da coordenação.
- **Isolamento:** a coordenação seguinte, na mesma aba, não vê a prévia da anterior.
- **Carga e concorrência:** clique duplo, `CONFLITO`, fila acima de 60 s, 429, resposta atrasada da prévia e sair da tela no meio do acompanhamento.

**Cobertos:** todos. Rodei os 7 arquivos de unidade e de componente da tarefa: 101 casos verdes. O e2e não rodei, porque precisa da pilha do compose. As cinco correções exigidas foram feitas:

1. **Sair da tela aborta a leitura.** O caso `ImportarPlanilha.fila.test.tsx › sair da tela cancela a leitura` desmonta a peça com a importação `na_fila` e libera a espera depois de desmontar. Ele confere que o número de `GET /v1/importacoes/:id` não cresce.
   - Há dois blocos de mutação: um com `return () => undefined` e outro sem o `sinal`.
   - A linha 77 da tabela cita o caso.
   - A espera de 50 ms reais só serve à asserção negativa: no código quebrado, a leitura sairia antes dela. Não é prazo provado com relógio de verdade.
2. **O carregando some quando a prévia falha.** `ImportarPlanilha.test.tsx` passou a conferir que "Conferindo a planilha com a escola…" não está na tela. O e2e confere o mesmo pelo `role="status"`: o `LoadingState` tem esse papel, então a asserção é efetiva.
   - Há bloco `escolha !== undefined && true` contra "a prévia que falha".
   - Há bloco sem o `previaNoAr` contra "o convite do começo, o carregando".
3. **A conclusão diz quantas linhas ficaram de fora, e por quê.** `linhasDeFora` agora conta duas causas:
   - `semMarca`: as linhas "em outra turma" que a coordenação não marcou;
   - `mudaram`: as linhas `entra`, `volta` e `nome_corrigido` da prévia, menos `entram`, `voltam` e `nomes_corrigidos` do `resumo`.

   Conferi que essas são as chaves do tipo `alunos` (`packages/core/src/importacao/tipos/alunos.ts:345`) e que a lista da turma usa o mesmo tipo. Os dois testes que tinham sido afrouxados agora conferem a frase inteira: `ListaDaTurma.test.tsx` com `getByText(diz)` exato, e `e2e/lista-da-turma.spec.ts:349`. As contas e os textos têm 15 blocos.
4. **O prazo do aviso da fila não depende mais do relógio de verdade.** O `agora` e o `esperar` agora são do teste. O relógio só avança para 61.000 quando o caso manda, e as leituras passam a ser exatamente 3.
5. **Linhas 49, 50, 75, 77 e 78 da tabela.** Agora citam os casos certos, e conferi que cada nome existe. A linha 75 passou a ser de unidade e cita "só grava com algo novo…".

Outras exigências desta rodada também foram atendidas:
- O caso em `StrictMode` (pedido do revisor-geral) existe e tem bloco `controle.current ?? new AbortController()`.
- O seletor em português tem 8 blocos.
- O resumo das marcas tem teste de componente, de unidade e de e2e.
- O teto de 3 s entre leituras agora é provado (`Math.max(...esperas) === 3_000`).
- O `--faltando` lista 6 linhas, todas com motivo.
- Não há `.skip`, nem mock que esconda a regra, nem provedor pago.

**Bloqueantes:** nenhum.

**Recomendações:**
- `e2e/importar-alunos.spec.ts:380` e `:403` conferem a conclusão com `toContainText` de um prefixo. Se `mudaram` saísse diferente de zero por engano, a frase "a escola mudou…" seria acrescentada e esses dois casos continuariam verdes. Os casos de `:127` e de `lista-da-turma.spec.ts:156/174` pegam isso só no caminho sem marca. Vale usar `toHaveText` com a frase inteira nos dois.
- `previa-da-planilha.ts`, `linhasDeFora`: uma transferência marcada que deixa de valer entre a prévia e o gravar (`transferidos` menor que o número de marcas) não entra em nenhuma das duas contas. A tela diz "Nenhuma linha ficou de fora" nesse caso, que é raro. Vale contar `muda_de_turma` marcadas menos `transferidos`.
- O comportamento novo desta rodada não tem linha na tabela "Testes que provam a regra" do `13_task.md`: o seletor em português, o resumo das marcas antes de gravar e a gravação em `StrictMode`. Vale acrescentar as três linhas, para a validação conferir.
- `escolhido={escolha !== undefined}` (`ImportarPlanilha.tsx`) não tem bloco próprio. O `--faltando` não conta `!==` como condição. O caso do seletor pegaria as duas trocas, mas um bloco explícito deixaria isso registrado.
- O comentário do caso em `StrictMode` (`ImportarPlanilha.test.tsx`) diz que, montado dentro do `QueryClientProvider`, o React não monta duas vezes. Isso não está provado, e quem prova o caso é o bloco de mutação. Vale tirar ou corrigir o comentário.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.fila.test.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/e2e/importar-alunos.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/e2e/lista-da-turma.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/tasks/prd-onboarding-por-convite/13_task.md
