# Achados das revisões — `tasks/prd-ingestao-do-material/4_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-12 20:37:24 · `tasks/prd-ingestao-do-material/4_task.md`

VEREDITO: APROVADO

Tabelas verificadas: `capitulo_do_material` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/drizzle/0051_capitulo_do_material.sql`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/db/schema/material.ts`)
- Tem `escola_id NOT NULL`, com FK para `escola`.
- A FK composta `(escola_id, material_id)` aponta para `material(escola_id, id)` com `ON DELETE CASCADE`, então o capítulo não consegue apontar para o material de outra escola.
- O índice único é `(escola_id, material_id, ordem)`, começando pela escola.
- Não tem `anoLetivoId`, o que está certo: o material também não varia por ano letivo.
- O id é UUID (`uuidv7()`).
- Foi registrada em `tools/guardas/tabelas-do-nucleo.mjs` e classificada como `SEM_PESSOA`.

Queries verificadas:
- `MaterialRepository.capitulos` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/material.repository.ts`, por volta da linha 202): o filtro de escola vem de `requireEscolaId()`, do contexto, e não de argumento.
- `ExtracaoDoMaterialRepository.gravarCapitulos` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/material/extracao.repository.ts`, por volta da linha 81): a escola também vem de `requireEscolaId()`, e a FK composta recusa gravar capítulo no material de outra escola.
- `MaterialService.ler`: só chama `capitulos(id)` depois que `porId` (escola, disciplina com vínculo, não excluído) acha o material. Se não acha, devolve `NAO_ENCONTRADO`.
- O controller não recebe `escolaId` nem no corpo nem na query.
- O DTO de saída é explícito (`capituloDoMaterialSchema` é `strictObject`), e a resposta passa por `.parse` antes de sair.
- Nenhum `@Unscoped` novo. Os dois que existem em `varredura.repository.ts` são anteriores a esta tarefa, não foram alterados e têm justificativa escrita.
- Nenhuma consulta da camada de rede foi tocada.

Teste de isolamento: presente e efetivo.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/material.int.test.ts`, caso "isolamento: o material da B…": chama `MaterialRepository.capitulos(deB)` direto, no contexto da A, e espera `[]`; no contexto da B, espera 3 capítulos. Sem a cláusula `escolaId`, o contexto da A também receberia 3 e o teste quebra. A tarefa declara essa mutação.
- O mesmo caso confirma que o `GET` da A sobre o material da B dá 404 `NAO_ENCONTRADO`, sem `capitulos` e sem o título no corpo.
- No worker (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/worker/test/extrair-pdf.int.test.ts`), `gravarCapitulos` com o id da B no contexto da A é recusado pela FK composta, e um caso aplica a migration num esquema de teste para provar essa FK.
- O caso de permissão confirma que aluno, professor sem vínculo e professor de outra disciplina recebem o mesmo erro que o id inexistente.

Bloqueantes: nenhum

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/material.repository.ts`, por volta da linha 201: `capitulos(materialId)` filtra só pela escola. Quem garante o recorte por disciplina do professor é a chamada anterior a `porId`, e isso hoje está só no comentário. Se algum chamador futuro pular o `porId`, um professor sem vínculo com a disciplina passa a ler capítulos da mesma escola. Sugestão: tornar o método privado ao fluxo de `ler`, ou fazê-lo receber o resultado de `porId`, para que não dê para chamá-lo sozinho.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-12 20:37:38 · `tasks/prd-ingestao-do-material/4_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A tarefa 4.0 não lê nem grava `Nota`. O único caminho novo de escrita é `gravarCapitulos`, que grava em `capitulo_do_material` a partir do job `material.extrair-pdf`. Todos com autor humano? Não se aplica.

Decisão autônoma sobre aluno: ausente. O leitor de capítulos não usa IA: lê o marcador do PDF pelo `getOutline()` ou uma linha "Capítulo N" por regex. Ele divide o material didático da escola e não toca em aluno nem em trajetória.

Aprovação registrada: ok. Nada aqui é saída de IA. Nenhum dos arquivos alterados chama o gateway ou o `LLMProvider`. O capítulo é um dado técnico do PDF, sem pessoa, e não chega ao aluno como conteúdo gerado.

Supervisão do tutor: ok. O tutor não foi tocado. A busca por "tutor" e "Tutor" no que a tarefa acrescentou não acha nada.

Autonomia declarada e visível: sim, e sem mudança. Não entra agente novo nem muda o nível de nenhum.

Os outros itens também não foram afetados:
- **Auditoria (item 6):** sem saída de IA nova para auditar.
- **Vigilância (item 7):** sem campo sobre comportamento. A tabela está classificada `SEM_PESSOA` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/shared/src/privacidade/classificacao.ts`.
- **Nota em discursiva e redação (item 8, D46/D55):** nenhum campo, prompt ou contrato com nota ou conceito.
- **Medir o professor (item 9, D45):** nenhuma métrica de professor. O log `material.extraido` passa a trazer só `capitulosTotal`, que é uma contagem.
- **`docs/regulacao.md`:** não foi alterado, e nada na tarefa pede que seja.

Bloqueantes: nenhum.

Recomendações:
- Pelo item "Fora do escopo", a F4b vai ligar habilidade a capítulo. Se essa ligação for feita por IA, é saída de IA sobre o material e precisa nascer pendente, com aprovação registrada (regra 70, item 3), e entrar na consulta de auditoria (item 6). Vale escrever isso no PRD da F4b desde já, para a tabela `capitulo_do_material` não virar o lugar de uma habilidade gravada sem aprovação.

Arquivos que conferi:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/material/chapter-reader.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/material/pdf-extractor.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/material/extracao.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/worker/src/processors/extrair-pdf.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/material.service.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/material.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/shared/src/material/material.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/drizzle/0051_capitulo_do_material.sql`

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-12 20:38:05 · `tasks/prd-ingestao-do-material/4_task.md`

VEREDITO: APROVADO

A tarefa só lê metadados do material didático da escola: número, título e páginas de cada capítulo. Não toca em nenhum dado de pessoa. Rodei os testes de unidade (`contracts.test.ts`, `chapter-reader.test.ts` e os de `packages/shared/src/privacidade`): 71 passaram. Os testes de integração (worker e `material.int.test.ts`) eu não rodei.

Campos pessoais tocados: nenhum. A tabela nova `capitulo_do_material` guarda escola, material, ordem, número, título (de 1 a 200 caracteres) e as páginas inicial e final. Ela está classificada como `SEM_PESSOA` em `packages/shared/src/privacidade/classificacao.ts:140`, igual a `trecho`.

Fora da tabela de dados do docs/lgpd.md: nada. A linha do Material em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/docs/lgpd.md:101` agora cita os capítulos: não têm dado de pessoa, ficam com o material e saem em cascata no expurgo. O prazo de guarda é o do material (`material_excluido`, ajustável por escola). Também conferi que o expurgo apaga de fato a linha do material (`packages/core/src/retencao/expurgo-da-escola.repository.ts:283`), então a cascata funciona.

Autorização por objeto: ok.
- `GET /v1/materiais/:id` primeiro confere se o material é alcançável (`porId` com o alcance do papel) e só depois lê os capítulos (`apps/api/src/material/material.service.ts:241-246`).
- A leitura dos capítulos também filtra pela escola do contexto (`apps/api/src/material/material.repository.ts:202-208`).
- Na troca de id, a coordenação da escola A recebe `NAO_ENCONTRADO` para o material da escola B, e o repository chamado com o id da B no contexto da A devolve vazio.
- O aluno, o professor sem vínculo e o de outra disciplina recebem um 404 com o mesmo erro do id que não existe, e sem `capitulos`. Os casos estão em `apps/api/test/material.int.test.ts`.
- No banco, a FK composta `(escola_id, material_id)` impede que um capítulo aponte para material de outra escola.

DTO de saída: explícito. `capituloDoMaterialSchema` é estrito (`packages/shared/src/material/material.ts:408`), a seleção no repository lista as colunas uma a uma, e o contrato é conferido em `apps/api/test/contracts.test.ts` (sem `sha256`, `enviadoPor` nem `texto`). A lista de materiais não traz os capítulos.

Logs: limpos. `material.extraido` passou a levar só `capitulosTotal`, uma contagem (`apps/worker/src/processors/extrair-pdf.ts:137-138`). O `ChapterReader` engole o erro sem registrar nada e devolve zero capítulos, então nenhuma mensagem do pdfjs sai dali.

Auditoria: nenhuma ação desta tarefa a exige. Ler material didático não é ler dado de aluno, e não há exportação, nota, permissão nem saída de IA envolvida.

Envio externo: nenhum. A leitura dos capítulos roda no worker, com pdfjs, sem modelo de IA.

Seed/fixture: sintético. `tools/demonstracao/amostra-de-capitulos.ts` gera PDFs com títulos de química ("Mol e massa molar", "Reações químicas", "Soluções") e não tem nome de pessoa.

Pergunta de fechamento: a resposta não muda. Capítulo não é dado de titular, e o arquivo do titular continua cobrindo o material pela pessoa que o enviou ou excluiu (`packages/core/src/titular/leitura-do-titular.ts:399`).

Bloqueantes: nenhum.

Recomendações:
- O título do capítulo é texto do PDF que a escola enviou. Numa apostila escrita pelo próprio professor, pode trazer um nome ("Capítulo 1 — Prof. Fulano"). Isso não bloqueia, porque o tratamento é o mesmo de `trecho.texto` (classificado como `SEM_PESSOA`, a escola é a titular do material, nada vai ao log nem para fora). Vale uma frase em `docs/lgpd.md` dizendo que o texto e o título do material didático seguem a mesma classificação, para a decisão ficar escrita num lugar só.
- Falta um caso explícito de "material excluído não devolve capítulo". Hoje isso está coberto indiretamente pelo `porId`, que já filtra o excluído. Seria uma linha a mais no `describe` dos capítulos.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-12 20:38:07 · `tasks/prd-ingestao-do-material/4_task.md`

VEREDITO: APROVADO
Caminho quente tocado: fila, migration (só a extração do PDF na fila `pdf` e a leitura do material pela coordenação e pelo professor; nada de login, tutor, sala ou prova)
Rate limit: ok (nenhuma rota nova; o `GET /v1/materiais/:id` só ganhou o campo `capitulos`)
Fila e prioridade: ok (os capítulos são lidos no job `material.extrair-pdf`, no worker, com o PDF que já estava aberto e sem abrir o arquivo de novo; nada disso roda dentro do request)
Concorrência: protegida (os capítulos só são gravados depois de `marcarPronto` achar a linha, na mesma transação, e a restrição única `(escola_id, material_id, ordem)` pega o segundo gravador; há o teste `[P]` com dois jobs em `Promise.all` e a mutação que grava antes da transição)
Índice e paginação: ok (a leitura usa a restrição única, que começa por `escola_id`; a lista sai sem paginação, mas tem teto de 2.000 itens em `MAXIMO_DE_CAPITULOS_POR_MATERIAL`, e a tabela cresce com o material, não com o aluno)
Degradação de IA: não se aplica
Migration: compatível (a 0051 só cria uma tabela nova e vazia, sem `ALTER` em coluna existente; a FK composta aponta para `material_escola_id_unico`, que já existe, e conferir uma tabela vazia é instantâneo)
Métrica e alerta: ok (o histograma e o contador da extração já existiam e continuam valendo; o log `material.extraido` ganhou `capitulosTotal` e leva só ids e contagens; não há alerta novo)
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/material/chapter-reader.ts:498`: o laço `#doMarcador` resolve todos os marcadores de primeiro nível, um `await getPageIndex` de cada vez, e só depois confere o teto de 2.000 (linha 476). Um PDF com dezenas de milhares de marcadores segura a vaga de extração da escola até o prazo de 10 min. Isso termina bem: o abort chama `destroy()`, o erro é capturado e não afeta outra escola. Mesmo assim, conferir `sinal.aborted` dentro do laço, ou parar quando os achados passarem de 2.000 páginas distintas, libera a vaga mais cedo.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/material.service.ts:116`: `porId` e `capitulos` são duas consultas fora de transação. Se o expurgo cair entre as duas, a resposta sai com o material e a lista de capítulos vazia. Não é bug, mas vale um comentário dizendo que isso é aceito.

O teste de unidade `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/material/chapter-reader.test.ts` passou (38 de 38). Não rodei os testes de integração.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-12 20:38:32 · `tasks/prd-ingestao-do-material/4_task.md`

VEREDITO: APROVADO

Escopo: respeitado. As cinco subtarefas foram feitas. Nada entra em tarefa futura: a tela do painel e os campos `serieIds`, `edicao` e `licencaId` da §4 não foram tocados. Os arquivos fora da lista prevista são consequência direta do que a tarefa pediu: `limpar-linha.ts` (a limpeza saiu do `PdfExtractor` para o leitor reaproveitar), as exportações do `index.ts`, a classificação `sem_pessoa`, a linha em `docs/lgpd.md`, `tools/guardas/tabelas-do-nucleo.mjs` e `TODO.md`.

Aderência à Tech Spec: ok. As cinco divergências do `4_task.md` estão escritas na `techspec.md` §5 "Capítulos" e no `cenarios.md`. A que fala do esquema da rota segue a §4, onde só o `GET /:id` ganha `capitulos`. A migration `0051` bate com a §3: FK composta em cascata, `unique (escola_id, material_id, ordem)`, os dois checks e `numero` nulo. A cadeia do snapshot está íntegra (o `prevId` da `0051` é o id da `0050`, e só a tabela nova muda). Os capítulos são gravados depois de `marcarPronto` e na mesma transação, como a §5 pede. A troca de `materialResponseSchema` por `materialComCapitulosResponseSchema` no `GET /:id` não quebra a tela: `apps/web/src/areas/coordenacao/material/api/material.ts:107` usa o esquema antigo só no `POST`.

Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade e alvo).

Bloqueantes: nenhum.

Recomendações:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/material.repository.ts:89`: a interface `CapituloDoMaterialLido` é a terceira cópia da mesma forma. As outras duas são `CapituloLido` no núcleo e `CapituloDoMaterial` no `packages/shared`. Usar o tipo do contrato.
2. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/material/chapter-reader.ts:64-66`: o teto de 2.000 capítulos só é conferido depois de resolver o destino de todos os marcadores. Num PDF com dezenas de milhares de marcadores de primeiro nível, o leitor chama `getPageIndex` uma vez por marcador antes de devolver zero. Se o outline já passa do teto, dá para parar antes do laço (a carga é assunto do `infra-guardian`).
3. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/material/chapter-reader.ts:114-118`: a linha lida é a primeira das duas do topo que casa. Num livro com "Unidade 2" como cabeçalho corrido na primeira linha e "Capítulo 5" na segunda, o número da unidade não muda e os capítulos dentro dela se perdem. O caso não está em `cenarios.md` e vale registrar como limite conhecido.
4. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/material.service.ts:246`: `paraResposta` já valida com `materialResponseSchema`, e a resposta é validada de novo por inteiro. Basta validar só os `capitulos`, ou validar uma vez só.
5. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/tasks.md:27-30`: a 4.0 está marcada `[x]`, mas as subtarefas 4.1 a 4.3 continuam `[ ]` e não são as mesmas do `4_task.md`.
6. A pendência do `TODO.md` sobre o `db:gerar` precisa de dono de verdade antes da próxima migration. Hoje o glob do schema pega um `.test.ts`, e a `0051` foi gerada com uma configuração temporária que não ficou no repositório.

## test-engineer · 1ª rodada · APROVADO · 2026-11-12 20:39:31 · `tasks/prd-ingestao-do-material/4_task.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- **Caminho feliz:** o PDF com marcador termina `pronto` e grava os capítulos, que o `GET /:id` devolve.
- **Bordas do leitor:** marcador de primeiro nível (o de segundo nível não vira capítulo), dois marcadores na mesma página, marcadores fora de ordem, título vazio, título de 300 caracteres, número acima do maior `int`, cabeçalho corrido, sumário com três casamentos (com dois, a página começa capítulo), só as 2 primeiras linhas como topo, mais de 2.000 capítulos e erro do leitor.
- **Premissa da §12:** a amostra fixa com o pdfjs de verdade, em seis PDFs.
- **Domínio:** PDF sem capítulo; material ainda `processando`; material excluído enquanto o PDF é extraído; dois materiais da mesma escola; expurgo em cascata.
- **Concorrência:** dois jobs da mesma extração ao mesmo tempo.
- **Permissão:** aluno, professor sem vínculo e professor de outra disciplina.
- **Isolamento:** pela rota, pelo repository de leitura, pelo repository de gravação e pela FK composta.
- **Contrato:** `capitulos` sem campo proibido.

**Cobertos:** todos. As 17 linhas da tabela de testes têm o seu caso, citado pelo nome, e as citações juntadas por ponto e vírgula também existem (as duas do número acima de `int`, as duas do sumário, as três do isolamento, e o par migration e banco migrado do expurgo).
- **Testes rodados agora, todos verdes:**
  - `chapter-reader.test.ts` e `contracts.test.ts`: 47 casos.
  - `extrair-pdf.int.test.ts`: 47 casos.
  - `material.int.test.ts`: 53 casos.
- **Mutações:** `--faltando` lista só as 21 linhas de `tools/demonstracao/amostra-de-capitulos.ts`, que têm o motivo escrito: é o gerador da amostra, e mutá-lo é mutar o teste. Todas as cláusulas novas em `apps/*/src` e `packages/*/src` têm bloco, inclusive as de `limpar-linha.ts`, a gravação, a leitura, o contrato e as restrições do `.sql`. As restrições são provadas sobre o esquema que a migration cria, então mutar o `.sql` muda o que o teste lê.
- **Motivo dos vermelhos:** conferi cada bloco contra o cenário que ele cita.
  - `arvore === null` removido: o `for…of null` cai no `catch` e o resultado sai vazio, e não com os títulos lidos da linha.
  - `pagina === undefined` removido: o destino inválido entra na lista.
  - Gravar antes da transição: o segundo job bate na `capitulo_do_material_ordem_unica` e o `Promise.all` rejeita.
  - Escopo tirado do `capitulos()`: o repository no contexto da A passa a achar os 3 capítulos da B.
- **Concorrência de verdade:** o caso `[P]` dispara os dois jobs em `Promise.all`, com uma barreira que só deixa os dois lerem o objeto depois que ambos chegaram. Os dois chegam à transição com os capítulos na mão.
- **Sem `.skip`, `.only` nem teste comentado.** Nenhum mock esconde a regra: o leitor tem um `getOutline()` falso para as bordas e o pdfjs de verdade na amostra, e a rota e o worker rodam com Postgres real. Não há IA nesta tarefa.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **Asserção que não prova o que o nome promete:** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/contracts.test.ts:172`. `expect(campos).not.toEqual(expect.arrayContaining(['sha256', 'enviadoPor', 'texto']))` só fica vermelho se os três campos estiverem presentes juntos. O nome do caso diz "nem o texto, nem hash, nem quem enviou". Troque por `for (const proibido of [...]) expect(campos).not.toContain(proibido)`. A regra da linha da tabela continua provada pela lista exata de `capitulos[]` na linha 171 e pelo `strictObject`; por isso não bloqueia.
2. **Isolamento da gravação pega qualquer erro:** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/worker/test/extrair-pdf.int.test.ts:863`. O `rejects.toThrow()` também passaria com um erro alheio à regra, como a falta de escola no contexto. Use `rejects.toMatchObject({ constraint: 'capitulo_do_material_da_escola_fk' })`, ou a causa equivalente que o Drizzle embrulha.
3. **O `[P]` dos capítulos não mostra que um job concluiu sem efeito:** `extrair-pdf.int.test.ts:847`. O caso equivalente dos trechos (linha 425) confere na métrica um `pronto` e um `sem_efeito`. Aqui só o `Promise.all` não rejeitar prova que "os dois jobs concluem". Acrescente o `MedidorDeTeste` com a mesma asserção.
4. **O expurgo é provado por `delete from material` direto:** a cascata está provada no banco, mas não pela rotina de expurgo de verdade. Vale um caso em `apps/worker/test/expurgo.int.test.ts` com um material excluído que tenha capítulos.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-12 21:03:11 · `tasks/prd-ingestao-do-material/4_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nem migration nesta rodada. `capitulo_do_material` não mudou desde a rodada 1: tem `escola_id`, FK composta `capitulo_do_material_da_escola_fk` e id de material UUID. Ela não varia por ano letivo.

Queries verificadas:
- `apps/api/src/material/material.repository.ts:193-199` (`capitulos`). Só mudou o tipo de retorno. O filtro continua `escolaId` vindo de `requireEscolaId()` (contexto do token) e `materialId`, e os campos devolvidos continuam listados um a um.
- `apps/api/src/material/material.service.ts:248-254` (`ler`). Continua chamando `porId` com o alcance antes de chamar `capitulos`. Se o material não existe, responde `NAO_ENCONTRADO`, igual ao inexistente. A resposta é validada pelo `materialComCapitulosResponseSchema`, que é estrito (vem de `z.strictObject`). A disputa com o expurgo descrita no comentário só pode devolver lista vazia a quem já alcançava o material. Não vaza nada.
- Nenhum endpoint passou a aceitar `escolaId` do cliente. Nenhum `@Unscoped()` novo. Nenhuma consulta da camada de rede foi tocada.

Teste de isolamento: presente e efetivo. Nada que já existia foi removido, e esta rodada reforçou dois pontos:
- `apps/worker/test/extrair-pdf.int.test.ts:871` agora exige que a falha venha da constraint `capitulo_do_material_da_escola_fk`, não de qualquer erro.
- `apps/api/test/material.int.test.ts:266` (novo) prova que o material excluído responde com o mesmo erro do id inexistente e sem capítulos, mesmo com os capítulos ainda gravados. Se o service deixasse de passar por `porId`, o teste quebraria.

Correções exigidas na rodada anterior: nenhuma. A recomendação de tornar `capitulos` privado foi recusada com motivo escrito, e continua não bloqueando: a escola do `capitulos` vem do contexto, então ele não alcança outra escola.

Bloqueantes: nenhum.

Recomendações:
- `apps/api/test/material.int.test.ts:115-117`: o teste chama `MaterialRepository.capitulos` direto, fora da rota. Convém um comentário dizendo que só um teste deve fazer isso, para que não vire padrão de uso fora do fluxo de `ler`.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-12 21:03:30 · `tasks/prd-ingestao-do-material/4_task.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. O limite conhecido das duas linhas do topo agora está escrito na `techspec.md` e no `cenarios.md`. Ele descreve o comportamento que o código já tinha, então não há divergência nova nem decisão tomada em silêncio.

Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)

Bloqueantes: nenhum

As recomendações da 1ª rodada foram atendidas, sem mudar comportamento nem contrato:
- **Tipo do contrato:** o `CapituloDoMaterialLido` saiu, e o repository devolve o `CapituloDoMaterial` de `@educa/shared` (`apps/api/src/material/material.repository.ts:193`). Os campos são os mesmos.
- **Resposta validada uma vez:** o `ler` monta a resposta por `daLinhaParaOContrato` e a valida uma vez só, pelo `materialComCapitulosResponseSchema` estrito (`apps/api/src/material/material.service.ts:254`). O `paraResposta` continua igual para as outras rotas.
- **Parada do laço de marcadores:** em `packages/core/src/material/chapter-reader.ts:94-100`, a contagem por `Set` de páginas distintas é a mesma coisa que o tamanho da lista depois de tirar as páginas repetidas, então o corte acima de 2.000 dá o mesmo resultado de antes, só que mais cedo. Acima do teto continua dando zero e não cai para a linha do topo. A checagem do teto em `ler` (linha 71) ficou para a leitura pela linha. Os testes novos em `chapter-reader.test.ts:183-216` provam o corte, o caso que não cai para a linha do topo e a contagem de páginas distintas.
- **Subtarefas, lgpd.md, comentário e TODO:** as subtarefas do `tasks.md` estão marcadas, a frase do título do capítulo está no `docs/lgpd.md`, o comentário da consulta dupla está em `material.service.ts:251-253`, e a 6 (dono do `db:gerar`) está no `TODO.md`.

Além do que foi pedido, o diff fortalece três testes (os testes continuam com o `test-engineer`):
- A asserção de campos proibidos em `apps/api/test/contracts.test.ts:172` era fraca: `not.toEqual(arrayContaining(...))` passava se faltasse só um dos campos. Agora cada campo é conferido.
- `apps/worker/test/extrair-pdf.int.test.ts:858` agora exige a constraint `capitulo_do_material_da_escola_fk` no lugar de qualquer erro.
- O caso de dois jobs em `extrair-pdf.int.test.ts:831` prova pelo medidor que um job termina `pronto` e o outro `sem_efeito`.

O caso novo do material excluído em `apps/api/test/material.int.test.ts:266` não muda código de produção.

Recomendações:
- `apps/api/src/material/material.service.ts:251-253`: o comentário tem três linhas, e a terceira ("validada uma vez só") só repete o que o código mostra. Pode sair.
- O nome `daLinhaParaOContrato` não diz que o resultado ainda não foi validado; isso só aparece no JSDoc. Um nome como `semValidar` ou `formaDoContrato` deixaria isso visível em quem chama.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-12 21:03:44 · `tasks/prd-ingestao-do-material/4_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. O diff desta rodada não grava em `Nota`. A tarefa só lê capítulos do PDF e os devolve no `GET /v1/materiais/:id`. Todos com autor humano? Não se aplica: não há escrita.
Decisão autônoma sobre aluno: ausente.
Aprovação registrada: ok. Nenhuma saída de IA entra nesta tarefa. O leitor de capítulos (`packages/core/src/material/chapter-reader.ts`) é determinístico e não chama a porta de IA. Procurei referências a modelo, provedor, agente, nota e aprovação em `chapter-reader.ts`, `limpar-linha.ts`, `apps/worker/src/processors/extrair-pdf.ts` e `material.service.ts` e não achei nenhuma.
Supervisão do tutor: ok. O diff não toca no tutor.
Autonomia declarada e visível: sim. Nenhum agente novo e nenhuma mudança de autonomia.
Bloqueantes: nenhum.
Recomendações:
- A recomendação da 1ª rodada foi registrada como pedi. Ela está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/TODO.md`, na linha nova "PRD da F4b: a ligação habilidade-capítulo, se feita por IA, nasce pendente", com destino ao Arquiteto. Continua valendo: quando a F4b ligar habilidade a capítulo por IA, a regra 70 itens 3 e 6 entram em jogo.
- Nenhuma recomendação nova.

O que mudou desde a 1ª rodada, todos itens fora da regra 70:
- **Leitor de capítulos:** passou a ter um teto de páginas distintas. Ele para de ler os marcadores do PDF quando o teto estoura e não cai na leitura pela linha do topo. Há testes novos para isso em `packages/core/src/material/chapter-reader.test.ts`.
- **Serviço:** a resposta agora é validada uma vez só, pelo esquema do contrato inteiro (`apps/api/src/material/material.service.ts`).
- **Material excluído:** um teste novo prova que ele responde 404 igual ao de um material que não existe, sem capítulos (`apps/api/test/material.int.test.ts`).
- **Dois jobs ao mesmo tempo:** o teste agora confere que um termina `pronto` e o outro `sem_efeito`. O teste de isolamento passou a exigir que a recusa venha da restrição de escola (`apps/worker/test/extrair-pdf.int.test.ts`).
- **Documentos:** `docs/lgpd.md` ganhou a classificação do título do capítulo. `techspec.md` e `cenarios.md` registram um limite conhecido da leitura pela linha do topo.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-12 21:03:47 · `tasks/prd-ingestao-do-material/4_task.md`

VEREDITO: APROVADO

**Campos pessoais tocados:** nenhum campo novo nesta rodada. Só mudou um texto em `docs/lgpd.md`: o título do capítulo segue a classificação do texto do material (`SEM_PESSOA`) e a retenção de `trecho`. O texto também registra que uma apostila escrita pelo professor pode trazer um nome, e que o sistema não procura nem trata isso à parte.

**Fora da tabela de dados do `docs/lgpd.md`:** nada. `capitulo_do_material` já estava na linha "Material da escola" desde a 1ª rodada, e agora a classificação está escrita ali.

**Autorização por objeto:** ok. O caso novo em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/material.int.test.ts` (linhas 266 a 283) prova que um material excluído, com os capítulos ainda gravados, recebe em `GET /v1/materiais/:id` o mesmo erro de um id que não existe (404 `NAO_ENCONTRADO`). A resposta não traz `capitulos` nem título de capítulo. O caso confere também que a exclusão é lógica: os 3 capítulos continuam na tabela, e o `porId` é o que barra a rota. O caso de permissão (aluno, professor sem vínculo, professor de outra disciplina) não mudou.

**DTO de saída:** continua explícito e estrito.
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/material.service.ts:254`, a resposta de `ler` é validada uma vez só, por `materialComCapitulosResponseSchema`.
- Esse esquema é `materialSchema.extend(...)`, e `materialSchema` é `z.strictObject`. Com o zod 4.6.7 instalado, o `extend` mantém o modo estrito: testei e um campo a mais é recusado com `unrecognized_keys`.
- O capítulo também é estrito (`capituloDoMaterialSchema`), e a consulta escolhe colunas explícitas tanto do material (`colunas`) quanto do capítulo.
- O tipo `CapituloDoMaterialLido`, que era só do repository, foi trocado pelo tipo do contrato, `CapituloDoMaterial`. Isso deixa os dois amarrados.
- `daLinhaParaOContrato` continua anulando `licenciante` fora do alcance `unidade`.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/contracts.test.ts:172` agora barra cada campo proibido (`sha256`, `enviadoPor`, `texto`) um a um. A versão anterior, com `arrayContaining`, só falhava se os três aparecessem juntos.

**Logs:** limpos. O diff não acrescenta nenhum log.

**Auditoria:** nada nesta rodada pede registro novo. A exclusão continua em `material.excluido`, como na 1ª rodada.

**Envio externo:** nenhum. O `ChapterReader` roda no processo, sem IA. A mudança dele (parar de ler marcadores assim que passam do teto de 2.000 páginas distintas, com o sinal `ACIMA_DO_TETO`) protege a fila e não toca em dado de pessoa.

**Seed/fixture:** só dado sintético (as amostras são de `tools/demonstracao` e os títulos são inventados, como "Marcador N" e "Capítulo N").

**Correções exigidas na rodada anterior:** nenhuma era bloqueante. As três recomendações foram aplicadas e conferidas: a frase em `docs/lgpd.md`, o caso do material excluído e a validação única do `GET /:id`.

**Bloqueantes:** nenhum.

**Recomendações:**
- Hoje quem prova que o `extend` mantém o modo estrito é o comportamento do zod, e não um teste do projeto. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/contracts.test.ts`, vale acrescentar um caso que recuse campo a mais no nível do material: por exemplo, `materialComCapitulosResponseSchema.safeParse({ ...valido, sha256: 'x' })` dando `false`. Assim uma troca de versão do zod não abre o contrato sem ninguém ver.
- O caso de expurgo com capítulos já está no `TODO.md` e deve entrar quando alguém mexer no expurgo do material.

**Pergunta de fechamento:** responde. O capítulo não carrega dado de aluno, não sai do sistema e vai embora em cascata junto com o material, cuja retenção já está no mapa.

## test-engineer · 2ª rodada · APROVADO · 2026-11-12 21:04:41 · `tasks/prd-ingestao-do-material/4_task.md`

VEREDITO: APROVADO

Cenários exigidos: as três recomendações da 1ª rodada que o Implementador diz ter aplicado; o caso novo do material excluído no `GET /:id`; o teto de 2.000 capítulos quando eles vêm da linha do topo; a parada do laço de marcadores logo ao passar do teto; as cláusulas novas do `chapter-reader.ts`, cada uma com o seu bloco de mutação; e a 4ª recomendação (expurgo), que deveria estar no TODO.md.

Cobertos:
- **Recomendação 1** (`apps/api/test/contracts.test.ts:172`): feita. O laço com `not.toContain` confere cada campo proibido sozinho. Antes, com `not.toEqual(arrayContaining)`, a asserção passava se faltasse só um dos três. A lista exata dos campos de `capitulos[]` e o esquema estrito continuam.
- **Recomendação 2** (`apps/worker/test/extrair-pdf.int.test.ts:868`): feita. `rejects.toMatchObject({ cause: { constraint: 'capitulo_do_material_da_escola_fk' } })` só passa quando quem recusa é a FK composta. Qualquer outro erro deixa o teste vermelho. Rodei e ficou verde, então o `cause.constraint` existe de fato.
- **Recomendação 3** (`extrair-pdf.int.test.ts:834-859`): feita, e o teste é de concorrência de verdade. São duas chamadas em `Promise.all`, e a barreira fica dentro de `aoLerBytes`. Com isso, os dois jobs passam pelo `lerParaExtrair` (`extrair-pdf.ts:111`) antes de qualquer transição, e o `sem_efeito` só pode vir da transação que não acha o `processando` (`extrair-pdf.ts:126`). A asserção `arrayContaining([{pronto,1},{sem_efeito,1}])` derruba o teste se os dois saírem `pronto`, porque o ponto viraria `{pronto,2}`.
- **Recomendação 4**: está no TODO.md com dono ("a tarefa que mexer no expurgo do material"). Ficou de fora com motivo, o que é aceitável.
- **Material excluído** (`apps/api/test/material.int.test.ts:266-283`): prova a regra. Depois do `DELETE`, o `GET` devolve o mesmo erro do id que não existe (comparado sem o `requisicaoId`). A resposta não traz `capitulos` nem o título "Mol e massa molar". O teste também confere no repository que os 3 capítulos continuam gravados. Isso mostra que quem bloqueia é o `porId`, e não uma lista que por acaso veio vazia. Se o filtro de excluído saísse do `porId`, o teste falharia.
- **Teto pela linha do topo** (`chapter-reader.test.ts:183`): usa o `documentoFalso` com `arvore: null`, então só o caminho da linha é exercido. Com 2.001 capítulos dá `[]`, com 2.000 ficam todos. O bloco de `>=` na linha 189 do 4_task.md cai nesse teste.
- **Parada do laço** (`chapter-reader.test.ts:189-203`): `resolvidos` conta as chamadas a `getPageIndex` e precisa dar exatamente 2.001 num PDF de 10.000 páginas. Os dois blocos novos caem nele: sem o `return ACIMA_DO_TETO`, ou sem o `paginasDistintas.add`, o laço resolveria as 10.000 páginas e o teste falharia.
- **Não cair na linha do topo** (`:205-210`): sem `if (doMarcador === ACIMA_DO_TETO) return []`, o valor devolvido é um `Symbol`, cujo `.length` é `undefined`. O código então cairia no `#daLinha`, acharia o "Capítulo 1" e devolveria 1 capítulo. O teste fica vermelho pelo motivo certo.
- **Páginas distintas** (`:212-216`): com a mutação `achados.length`, o marcador repetido da página 1 leva a conta a 2.001, o código devolve `ACIMA_DO_TETO`, e o `toHaveLength(2000)` falha. O marcador sem destino e o que aponta para fora do PDF são pulados, como o caso pede.
- **Mutação `>=` no marcador**: o bloco cita "no teto, ficam todos". Esse trecho casa também com o título do caso da linha 176, o do caminho por marcador, e é esse caso que derruba a mutação.
- **Bloco antigo "mais de 2000 capítulos"**: ele apaga `if (inicios.length > MAX) return []`. Com o `ACIMA_DO_TETO`, essa linha só é alcançada pelo caminho da linha do topo, e o filtro do bloco casa também com o caso novo (`:183`), que é o que mata a mutação.
- **Refatoração do `material.service.ts`** (`daLinhaParaOContrato`): a resposta passa a ser validada uma vez só, pelo esquema estrito. O corte do `licenciante` ganhou bloco próprio, que cai em "o licenciante é da coordenação".
- **Seção "Mutações"**: confere com o diff. Cada cláusula nova do `chapter-reader.ts` (`ACIMA_DO_TETO` no `ler`, o `add`, o `size >` com as duas variantes) tem bloco, e não há cláusula nova sem bloco.
- **O que não mudou de rodada**: tabela de testes, isolamento, permissão e cascata, todos aprovados na 1ª rodada. Não reauditei.
- **Execução**: `chapter-reader.test.ts` e `contracts.test.ts` rodaram com 51 de 51 verdes. `extrair-pdf.int.test.ts` e `material.int.test.ts` rodaram com 101 de 101 verdes. Não há `.skip`, nem teste comentado, nem mock sobre a regra testada. A tarefa não chama IA.

Bloqueantes: nenhum.

Recomendações:
1. `cenarios.md:81-83` e `techspec.md` agora descrevem um comportamento novo: a linha lida é a primeira das duas do topo que casa, e com "Unidade 2" corrido na linha 1 e "Capítulo 5" na 2 os capítulos se perdem. Nenhum teste prende esse comportamento. O caso de `chapter-reader.test.ts:273` só cobre a linha que fica abaixo das duas primeiras. Vale um caso pequeno que prenda o limite como está documentado, para que mudar esse comportamento seja uma decisão visível, e não um acidente.
2. A tabela "Testes que provam a regra" do 4_task.md não tem linha para "mais de 2.000 capítulos dá zero" nem para "só as 2 primeiras linhas são o topo", que estão no `cenarios.md`. Os testes existem (`:176`, `:183`, `:189`, `:205`, `:212`, `:273`) e os blocos de mutação os citam. Falta só listá-los na tabela, para a validação.
