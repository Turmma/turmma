# Achados das revisões — `tasks/prd-ingestao-do-material/7_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-13 11:27:30 · `tasks/prd-ingestao-do-material/7_task.md`

VEREDITO: APROVADO

Tabelas verificadas: `material_serie` (0054, `packages/core/src/db/schema/material.ts:415`). Tem `escola_id`. A chave é `(escola_id, material_id, serie_id)`. As duas FKs são compostas e levam a escola, `material_serie_material_da_escola_fk` e `material_serie_serie_da_escola_fk`, então a série e o material de uma linha não podem ser de escolas diferentes. A tabela não varia por período, como o material e a série, e por isso não leva `anoLetivoId`. O backfill (0055) junta a série ao material por `escola_id` e não copia série de outra escola. Ids são `uuid`. A FK de `material.licenca_id`, que já existia, também é composta com a escola.

Queries verificadas:
- `LicencaRepository.paraUso`: escopo `requireEscolaId()` nas duas leituras, com e sem `for share`.
- `MaterialRepository.seriesDaEscola`: escopo `requireEscolaId()`.
- `MaterialRepository.gravarSeries`: `escolaId` vem do contexto.
- `#comASerie`: subconsulta presa a `material.escola_id`, dentro de `listar`, que já filtra por `requireEscolaId()`.
- `dasSeries`: subconsulta presa a `material.escola_id`.
- `listar` com `serieId`: mantém `#noAlcance` do professor.

O contrato `enviarMaterialRequestSchema` é estrito e recusa `escolaId`, com teste em `material.test.ts`. A query não aceita escola. Nenhum `@Unscoped()` foi acrescentado. Nada do diff alcança a camada de rede.

Teste de isolamento: presente e efetivo. Conferi três casos tirando a cláusula de escopo de cabeça.
- **Série da escola B no envio** (`material.int.test.ts:825`): sem o escopo em `seriesDaEscola`, a FK composta derruba a gravação com erro que não é 404, e a recusa auditada passa a levar o id da B. O teste quebra nos dois pontos.
- **Licença da escola B** (`material.int.test.ts:891`): sem o escopo em `paraUso`, a licença da B passa a valer e o envio segue até o arquivo `lixo`, que sai `ENTRADA_INVALIDA`, não 404. A auditoria também deixa de registrar `licenca_inexistente` duas vezes. O teste quebra.
- **Filtro `?serieId` com a série da B** (`material.int.test.ts:847`): só quebra se sair o filtro de escola de `listar`. Isso basta, porque `#comASerie` não abre caminho novo para outra escola.

Série e licença de outra escola respondem o mesmo `NAO_ENCONTRADO` que a inexistente, com o corpo comparado no teste. A auditoria grava o mesmo motivo `licenca_inexistente` para as duas e não grava o id da B.

Bloqueantes: nenhum

Recomendações:
- `apps/api/src/material/material.service.ts:321`: as séries são conferidas fora da transação. Se uma série for apagada entre a conferência e o `gravarSeries`, a FK estoura e a resposta vira erro genérico, não `NAO_ENCONTRADO`. Não vaza nada entre escolas. Vale reconferir as séries dentro da transação, ou traduzir a violação da FK.
- `material.int.test.ts:847`: o teste do filtro por série da B só prova o filtro de escola que já existia. Um caso com uma série da escola A e um material da B ligado a ela não é possível por causa da FK, mas uma linha no teste dizendo que a FK composta é a garantia ajuda quem ler depois.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/licenca.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/material.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/material.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/drizzle/0054_material_serie.sql
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/drizzle/0055_material_serie_backfill.sql
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/material.int.test.ts

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-13 11:27:50 · `tasks/prd-ingestao-do-material/7_task.md`

VEREDITO: APROVADO

**Campos pessoais tocados:** nenhum campo novo de pessoa.
- A tabela nova `material_serie` guarda só ids da escola, do material e da série, sem nenhum dado de pessoa.
- O `licenciante` pode ser nome de pessoa, mas não é campo novo. O que mudou é a origem: o material passa a copiá-lo da licença registrada, e o pedido deixou de trazer nome (`apps/api/src/material/material.service.ts:356`).
- A auditoria `material.recusado` ganhou `serieIds` e dois motivos novos, `licenca_vencida` e `licenca_inexistente`. São só ids e listas fechadas, sem título, licenciante ou id de licença (`packages/core/src/auditoria/acoes.ts:609-613`).

**Fora da tabela de dados do docs/lgpd.md:** nada.
- `material_serie` e as séries na auditoria entraram na linha "Material da escola" de `docs/lgpd.md`.
- A tabela está marcada `SEM_PESSOA` em `packages/shared/src/privacidade/classificacao.ts:145`.
- A retenção segue a do material: as linhas saem em cascata quando o material sai.
- Nenhum campo proibido para aluno foi tocado.

**Autorização por objeto:** ok.
- **Séries do envio:** a conferência filtra pela escola da sessão (`material.repository.ts:188-193`). Série de outra escola e série inexistente recebem o mesmo `NAO_ENCONTRADO` antes de qualquer gravação, e a auditoria nunca recebe o id da outra escola (`material.service.ts:182`; teste em `material.int.test.ts:825`).
- **Licença do envio:** `paraUso` filtra pela escola da sessão (`licenca.repository.ts:79-86`). Licença de outra escola e licença inexistente recebem o mesmo `NAO_ENCONTRADO`, e as duas vão para a auditoria com o mesmo motivo, `licenca_inexistente`. Assim nem a resposta nem a auditoria confirmam que o id existe em outra escola (teste em `material.int.test.ts:891`).
- **Filtro `GET /v1/materiais?serieId`:** o filtro amarra a série ao material da mesma escola, e o professor continua limitado às disciplinas em que tem vínculo. Série de outra escola devolve lista vazia, igual à inexistente (teste em `material.int.test.ts:847`).
- **Rotas de licença:** continuam só da coordenação; professor, aluno e rede ficam com `nunca` (`packages/shared/src/permissao/matriz.ts:252,348,396`).

**DTO:** explícito e validado pelo esquema de resposta. Professor, aluno e rede recebem `licenciante: null` (`material.service.ts:92`; teste em `material.int.test.ts:189`). O contrato ganhou `licencaId` e `serieIds`, que são só ids.

**Logs:** limpos. O log de recusa leva só o id da disciplina e o código do motivo (`material.service.ts:134`); os outros logs levam o id do material e medidas. A tela não usa `console` nem `localStorage`.

**Auditoria:** presente onde a regra exige. Toda recusa do envio fica registrada, inclusive a licença que deixa de valer no meio da transação (`material.service.ts:233-236`). Esta tarefa não faz leitura de dado de aluno, exportação, mudança de nota, de permissão nem aprovação de saída de IA.

**Envio externo:** nenhum. A tarefa não chama IA nem provedor terceiro.

**Seed/fixture:** sintético. O licenciante de teste é "Editora sintética", os 300 materiais se chamam "Material sintético N", e escola e coordenadora da vitrine também são sintéticas.

**Fotos da tela:** as quatro (escola cheia e vazia, computador e celular) mostram só o diálogo vazio. Aparecem nomes sintéticos e o rótulo da série ("2º ano do Ensino Médio"), sem nenhum dado de aluno. A coordenação vê o nome do licenciante na lista de licenças (`PartesDoEnvioDeMaterial.tsx:254`), e a regra já permite isso a esse papel.

**Pergunta de fechamento:** responde. Nada desta tarefa diz respeito a aluno: as séries do material não se ligam a pessoa, e nada sai do sistema.

**Bloqueantes:** nenhum.

**Recomendações:**
1. Em `docs/lgpd.md`, na linha "Material da escola", trocar "a recusa por falta de licença" por um texto que cite também os motivos `licenca_vencida` e `licenca_inexistente`. Hoje o texto descreve menos do que a auditoria grava.
2. Avaliar se o `licencaId` deve sair `null` para professor, aluno e rede, como já sai o `licenciante` (`material.service.ts:92`). É só um id e o professor não alcança a rota de licenças, mas o professor não precisa dele.
3. `material.enviado` não guarda `licencaId` nem `serieIds`, e por isso a auditoria não diz sob qual licença o material entrou. Não é questão de privacidade; é rastreio de direito autoral, a pesar na 8.0, onde a licença do material pode mudar.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-13 11:27:59 · `tasks/prd-ingestao-do-material/7_task.md`

VEREDITO: APROVADO

Esta tarefa não toca a regra 70. Ela trata só do envio de material pela coordenação: séries, licença registrada, lote de até 20 PDFs, o limite de envios (429) e a retomada. Não chama IA, não grava nota, não mexe no tutor nem nos agentes. Procurei no diff chamada ao provedor de IA, `nota`, `correcao`, aprovação de saída e autonomia, e não achei nada. O `material.service.ts` só importa armazenamento, fila de jobs, auditoria e os repositórios de material e de licença. `docs/regulacao.md` não mudou.

- **Caminhos de escrita em Nota:** nenhum novo nesta tarefa (migrations 0054/0055, service, repository e seed não tocam `Nota`). Todos com autor humano? sim, nada mudou.
- **Decisão autônoma sobre aluno:** ausente. A recusa do envio por série, licença ou declaração é regra de entrada sobre o material, não decisão sobre aluno.
- **Aprovação registrada:** ok. O fluxo não tem saída de IA. O material é enviado por uma pessoa, e a recusa fica na auditoria (`material.recusado`) com o motivo e as séries da escola, nunca o id de série de outra escola (`packages/core/src/auditoria/acoes.ts`).
- **Supervisão do tutor:** ok, nada mudou. O texto da tela, "Quem enxerga o material é o professor e o Tutor da série marcada", só diz o alcance do conteúdo. Não abre uso do tutor que o professor não veja.
- **Autonomia declarada e visível:** sim, nada mudou. Nenhum agente foi criado ou alterado.
- **Fotos da tela:** os quatro arquivos (escola cheia e vazia, no computador e no celular) mostram o diálogo "Enviar material" com área de arquivos, disciplina, séries, dono do conteúdo, licença de uso, declaração, Cancelar e Enviar. Não há saída de IA para rotular, nem nota, conceito ou sugestão de nota. Também não há nada que induza uso: "Cancelar" fica ao lado de "Enviar material". Na tela não achei nada da regra 70.
- **Itens 7, 8 e 9 (vigilância, discursiva e redação, medir o professor):** a tarefa não toca nenhum dos três. Não há inferência sobre aluno, campo de nota, métrica de professor nem acesso a conversa.

Bloqueantes: nenhum.

Recomendações: nenhuma da regra 70. Quando a tarefa 9.0 ligar o filtro por série à busca, à ferramenta e ao Tutor, vale auditar ali o efeito do preenchimento automático da migration 0055, que deu a cada material antigo todas as séries da escola, sobre o escopo do Tutor. Esse risco já está aceito na techspec, seção 13.

Arquivos lidos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/7_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/db/schema/material.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/drizzle/0054_material_serie.sql
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/drizzle/0055_material_serie_backfill.sql
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/shared/src/material/material.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/auditoria/acoes.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/material.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/.processo/vitrine/ (as quatro fotos de "Enviar material")

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-13 11:28:11 · `tasks/prd-ingestao-do-material/7_task.md`

VEREDITO: APROVADO

Tela vista: sim (4 fotos lidas: computador e celular, escola cheia e vazia, com o diálogo "Enviar material" aberto). Nenhuma tela passa da janela a 1366 × 768. Não vi o lote no meio, o 429 e o terceiro sem licença, porque a vitrine não os mostra. Confiro esses pelo código e pelo e2e (`e2e/material.spec.ts`, `Material.test.tsx`), mas não rodei nenhum teste.

Estados: ok.
- **Carregando:** séries ("Carregando as séries…") e licenças ("Lendo as licenças registradas…"), em `PartesDoEnvioDeMaterial.tsx`.
- **Erro:** as duas leituras dizem o que houve e têm "Tentar de novo". A falha do envio tem texto próprio por código em `TEXTOS_DA_FALHA_DO_ENVIO`. A hora da retomada do 429 sai em `pt-BR`.
- **Vazio:** sem disciplina o diálogo manda criá-la em Escola › Turmas. Sem série diz o mesmo. Sem licença vigente mostra "Registre a licença primeiro" com o link "Ir para Licenças". A lista de materiais vazia convida a enviar (aparece atrás do diálogo nas fotos, "Nenhum ma…" com "ENVIAR MAT…").
- **Com dado:** a lista do lote mostra nome, tamanho, título editável e a situação de cada arquivo.

Acessibilidade: ok.
- O foco inicial vai ao botão de arquivo.
- O foco vai ao primeiro campo com erro e, no fim do lote, ao resumo.
- Há uma região `aria-live` com a situação de cada arquivo, e `role="alert"` na falha.
- Todo campo tem rótulo; o título de cada arquivo leva `aria-label` com o nome do arquivo.
- O seletor de arquivo nativo funciona pelo teclado, e a área de soltar não é a única porta.
- O `cancel` do `input` é retido para o Esc não fechar o diálogo.

Chromebook fraco: ok.
- O lote tem no máximo 20 arquivos e envia um por vez, então não precisa de virtualização.
- PDF não se comprime, e o teto de 20 MB é conferido na tela antes de enviar.
- O e2e mede o lote de três PDFs e o caso dos 300 materiais sob rede e CPU lentas.
- A lista dos 300 não foi alterada nesta tarefa e traz `AvisoDeListaIncompleta`.

Celular: ok.
- **360 px:** na foto não há rolagem horizontal nem texto cortado. O diálogo mede 328 px e rola por dentro (`max-h-[calc(100svh-2rem)]`). O botão "Enviar material" fica abaixo da dobra, o que é aceitável.
- **Alvos de toque:** os botões têm 44 px (`min-h-11`), os `select` têm 48 px, e as séries têm `min-h-11`. Os dois checkboxes têm 24 px.
- **Hover e atalho:** nada depende de hover ou de atalho, e arrastar é opcional.
- **e2e:** o `material.spec.ts` roda nos dois projetos e confere `horizontalOverflow` e `seriousViolations` no lote.
- Nenhum fluxo exige o celular.

Ação oficial protegida: sim. Enviar material não é decisão oficial. A declaração de que a escola pode usar o material, pela licença indicada, é um checkbox explícito, a licença registrada só aparece vigente, e a API reconfere na transação. Sem licença ou sem declaração o envio é recusado antes de ler o arquivo, e a recusa fica auditada.

Bloqueantes: nenhum.

Recomendações:
1. **Campos obrigatórios sem marca.** `DialogoDeEnvioDeMaterial.tsx:~140-160`: "Disciplina" e "De quem é o material" são obrigatórios, mas só "Séries" e "Licença de uso" levam "(obrigatório)". Passar `obrigatoria` aos dois `Select`.
2. **Erro das séries sem vínculo.** `PartesDoEnvioDeMaterial.tsx` (`CampoDeSeries`): o erro leva o id `erro-das-series-do-material`, mas nada o referencia. Além disso, `aria-invalid` em `fieldset` não é atributo válido para o papel de grupo. Ligar o erro por `aria-describedby` no `fieldset`.
3. **Vazio das séries sem atalho.** `PartesDoEnvioDeMaterial.tsx` (`SeriesLidas`): o texto "A escola ainda não tem séries. Crie as séries em Escola › Turmas…" não traz link, ao contrário do vazio da licença, que leva a Licenças. Acrescentar o link, para o diálogo não ficar num beco.
4. **Foto da escola cheia sem material.** As fotos "cheia" e "vazia" mostram o mesmo vazio na tabela ("Nenhum ma…") atrás do diálogo. A vitrine cheia não prova a tabela com dado. A tabela não mudou nesta tarefa, então não bloqueia, mas vale conferir o seed da vitrine.
5. **Declaração difícil de tocar.** O checkbox da declaração tem 24 px, e o rótulo (que também é alvo de toque) não tem `min-h-11`. Cumpre o mínimo, mas é o passo que a coordenação mais erra no celular. Subir o rótulo a 44 px.

Arquivos relevantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/material/DialogoDeEnvioDeMaterial.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/material/PartesDoEnvioDeMaterial.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/material/use-lote-de-material.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/.processo/vitrine/` (as quatro fotos)

## infra-guardian · 1ª rodada · APROVADO · 2026-11-13 11:28:16 · `tasks/prd-ingestao-do-material/7_task.md`

VEREDITO: APROVADO
Caminho quente tocado: migration
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: compatível
Métrica e alerta: ok
Bloqueantes: nenhum

O que conferi e está certo:
- **Rate limit.** O lote não traz limite novo: manda um PDF por vez à mesma rota, e os tetos por pessoa e por escola continuam valendo para o lote inteiro. A tela respeita o `Retry-After` do 429 e devolve a `pendente` o arquivo em que o lote parou.
- **Concorrência.** O envio trava a licença com `for share` dentro da transação. O `PATCH` da licença só trava a própria linha com `for update`, então as duas operações não se travam uma à outra (sem deadlock). O teste [P] com o gatilho `before insert` distingue essa trava da que a FK já poria. A série repetida é barrada pela PK; o clique duplo, pela trava na tela, com teste. Não existe rota que apague série, então a conferência das séries fora da transação não abre corrida.
- **Índice e paginação.** O filtro `?serieId` usa a PK `(escola_id, material_id, serie_id)` no `exists` correlacionado. O índice `(escola_id, serie_id, material_id)` começa pela escola, e a listagem continua paginada por id.
- **Migration.** A 0054 cria uma tabela nova, e o código anterior continua gravando `material` sem precisar dela. A 0055 grava em lotes de 5.000, com `NOT EXISTS`, pode rodar de novo sem duplicar e tem `lock_timeout`. O `migracao-f4.int.test.ts` prova a escola sem série e o backfill rodado duas vezes.

Recomendações:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/drizzle/0054_material_serie.sql:3` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/drizzle/0055_material_serie_backfill.sql:7`: o comentário diz que nenhuma trava segura escrita de quem usa o sistema, e isso não é exato. O `ADD CONSTRAINT ... FOREIGN KEY` trava `material` e `serie` para escrita (`SHARE ROW EXCLUSIVE`). Como o `migrar` roda tudo numa transação só, essa trava dura até o fim do backfill. Com o tamanho de hoje e o deploy fora do horário letivo o efeito é desprezível, mas o texto deve dizer a verdade. Na mesma linha, o `SET LOCAL lock_timeout` da 0055 vale até o fim da transação inteira, inclusive para as migrations que vierem depois dela no mesmo deploy.
2. Os tetos do código (`ENVIOS_POR_USUARIO_NA_JANELA` 30, `ENVIOS_POR_ESCOLA_NA_JANELA` 60, `MATERIAIS_EM_PROCESSAMENTO_POR_ESCOLA` 3) não batem com a Tech Spec §7c, que diz 100, 300 e 300. Com o lote de 20, o teto de 3 em processamento faz o lote parar a cada três arquivos e esperar 30 s. Funciona, mas o onboarding de 300 apostilas fica lento. A diferença já está anotada com o Arquiteto como dono; a validação da spec precisa fechá-la.
3. Material enviado pelo código anterior entre a 0055 e a subida do código novo fica sem série. Com o deploy fora do horário isso é improvável. Se acontecer, a 0055 pode rodar de novo, porque não duplica; vale uma linha no runbook do deploy dizendo isso.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-13 11:29:31 · `tasks/prd-ingestao-do-material/7_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (`portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)`)
Bloqueantes: nenhum

O que conferi:
- **Escopo.** As subtarefas 7.1 a 7.8 estão no código. Nada da 8.0 (`edicao`, `substitui_id`, `PATCH`) nem da 9.0 (filtro de série na busca e no Tutor) entrou. O `substitui` do diálogo é o "Tentar de novo" que já existia.
- **Divergências.** As três estão registradas na `techspec.md` e no `cenarios.md`, e não só no `7_task.md`:
  - os motivos `licenca_vencida` e `licenca_inexistente`, na §5 (1) e no `[I]` do terceiro sem `licencaId`;
  - `MAXIMO_DE_CAMPOS` igual a 17, na §7c;
  - o e2e dividido em dois casos, no último `[E]` de "Telas".
- **Ordem da §5 (1) e (3).** Disciplina e séries são conferidas primeiro, e a recusa grava só séries já conferidas. A recusa pelo pedido vem antes da licença registrada, que é lida sem trava, e o arquivo só é aberto depois disso. Na transação a licença é relida `for share` e o `licenciante` é copiado dela. O pedido não traz mais `licenciante`, como a §4 pede ("no lugar de `licenciante`").
- **Isolamento.** A licença e a série de outra escola respondem `NAO_ENCONTRADO`, igual à inexistente, e a auditoria não leva o id delas. `material_serie` tem FK composta com a escola nas duas pontas. Nenhum caminho do código apaga série, então a FK sem ação na série não quebra nada.
- **Fotos.** O diálogo nas quatro fotos mostra o que a §9 pede: disciplina, séries, de quem é, licença de uso, declaração e o limite de 20 PDFs, com os termos do glossário. Não aparece nada fora do pedido.

Recomendações:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/docs/interface.md` (bloco novo do "Enviar material"): o texto descreve um resumo diferente do que a tela mostra, e o motivo do excedente também não bate.
   - Resumo: o documento diz "N enviados, N já estavam na escola, N falharam", mas `resumoDoLote` (`material-envio.ts:258`) escreve "12 de 20 enviados", como pede o `cenarios.md`.
   - Excedente: o documento diz que o que passa dos 20 fica de fora "dito pelo nome", mas `textoDoLimiteDoLote` (`material-envio.ts:84`) só diz quantos ficaram de fora.
   - Ajustar o documento ao código.
2. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/material/use-lote-de-material.ts:253`: se `recarregar()` rejeitar, `terminarARodada` não roda e `noAr.current` fica `true`. O botão de enviar fica sem efeito até o diálogo ser reaberto. Hoje é `invalidateQueries`, que não costuma rejeitar. Ainda assim, um `try/finally` ou um `.catch` ali tira essa dependência.
3. Os tetos de envio do código continuam em 30, 60 e 3 em processamento por escola, e a §7c diz 100, 300 e 300. O teto de 3 faz o lote de 20 parar no 4º arquivo. A tarefa registrou isso em "Recomendações sem aplicar", com dono, e não é divergência escondida. Mesmo assim, é o primeiro ponto que a validação da RF14 deve olhar: a coordenação que sobe 20 apostilas vê o lote parar.
4. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/material.service.ts:233`: a licença que some do banco no meio do envio é auditada e respondida como `licenca_vencida`/`LICENCA_VENCIDA`. É o que o `7_task.md` declara, e a licença não se exclui pela API. Vale uma linha na §5 (3) dizendo que esse caso cai em `licenca_vencida`, para quem ler a auditoria depois.
5. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/material/PartesDoEnvioDeMaterial.tsx:248` e `:254`: o `validas?.length` e o `(validas ?? [])` sobram, porque o ramo de cima já tratou o `undefined`. Dá para trocar por `validas.length` e `validas`.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-13 11:30:30 · `tasks/prd-ingestao-do-material/7_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- Envio com duas séries, e o filtro `?serieId` de cada uma.
- Sem série, `[]`, `[S1, S1]` (também em maiúsculas) e oito séries.
- Série inexistente e série da escola B.
- Terceiro sem `licencaId`.
- Licença vencida, futura, inexistente e da escola B.
- Material próprio sem licença.
- Licença vencida ou apagada já dentro da transação.
- [P] o `for share` contra o `PATCH` da licença.
- `?serieId` da B.
- Vínculo encerrado em X e aberto em Y.
- Backfill: todas as séries da escola, escola sem série, mais de um lote, rodar de novo.
- Relógio injetado e último dia da licença.
- `licenciante` copiado da licença.
- Escola sem ano letivo.
- Contrato do professor sem licenciante.
- Envio com o máximo de sete séries.
- Na tela: o 21º arquivo; 20 arquivos com um inválido e um repetido; título; 429 no meio e a retomada; licenças relidas ao abrir e no foco; sem licença vigente; a11y; clique duplo; recomeço; e2e com 300 materiais em 1366 × 768.

**Cobertos:** todas as linhas da tabela "Testes que provam a regra" têm caso com o nome citado, e conferi um a um:
- `material.int.test.ts`, bloco "séries e licença registrada no envio" (l. 764–947), mais os de l. 123, 153 e 189.
- `material-envio-orfao.int.test.ts`: os três casos novos. O [P] é uma corrida de verdade, com o envio e o `PATCH` no ar ao mesmo tempo, e o gatilho `before` impede que a trava da FK esconda o `for share`.
- `migracao-f4.int.test.ts`: seis casos. O repeteco do backfill quebraria na PK se o `NOT EXISTS` saísse.
- `material.test.ts` (shared), `acoes.test.ts`, `envio-em-lote.test.ts`, `use-lote-de-material.test.ts`, `material-envio.test.ts`, `Material.test.tsx` e `e2e/material.spec.ts`.

O isolamento devolve o mesmo `NAO_ENCONTRADO` para série e licença da B. A auditoria não leva o id da B. O "nada lido" é provado com `vi.spyOn(extrair)` e arquivo-lixo.

Não há `.skip`, `.only` nem teste comentado. O `--faltando` lista 8 linhas, todas com motivo aceitável (guarda de tipo ou classe de desenho). Os quatro arquivos de unidade passam (52 testes).

**Bloqueantes:**
1. **`apps/api/src/material/material-upload.ts:12`: o teto de campos do multipart não tem teste que caia sem ele.** A própria seção de divergências diz que, com o limite antigo de 10, o envio de 7 séries sairia `ENTRADA_INVALIDA` no recebimento. Nenhum teste de integração envia 7 séries e espera 201.
   - O caso "com oito" (`material.int.test.ts:811`) dá `ENTRADA_INVALIDA` com 17 campos e também com 10, então não distingue.
   - O teste do shared (`material.test.ts:67`) só exercita o schema, não o recebimento.
   - **Correção:** um `[I]` em `material.int.test.ts` com uma escola de 7 séries e um material de terceiro com `licencaId` (13 campos), esperando 201 e `serieIds` com as 7. Mais um bloco ` ```mutacao ` que volte `MAXIMO_DE_CAMPOS` para `10`.
2. **`apps/web/src/areas/coordenacao/material/use-lote-de-material.ts:87`: o `refetchOnMount: 'always'` (a licença "relida ao abrir" da subtarefa 7.5) não tem teste.**
   - O `createQueryClient` usa `staleTime: 30_000`, então sem o `'always'` a lista guardada no cache volta ao reabrir o diálogo dentro de 30 s, com a licença que já venceu.
   - O único teste de releitura (`Material.test.tsx:1352`) prova o foco, pelo `visibilitychange`, e não a abertura.
   - **Correção:** um caso em `Material.test.tsx`. Abre o diálogo, fecha, troca a resposta de `/v1/licencas` (a vigente vira vencida) e reabre. Espera um novo `GET /v1/licencas` e a licença ausente das opções. Mais um bloco de mutação que tire o `refetchOnMount: 'always'`.

**Recomendações:**
- **`material.int.test.ts:910`:** o nome promete "sem fim, também vale", mas o corpo só testa o último dia. A licença sem fim já é provada pelo l.153, cuja licença de teste não tem `vigenteAte`. Tire a frase do nome ou acrescente o caso.
- **`material.int.test.ts:875`:** o caso "vencida ontem" usa `2020-12-31`, que não é ontem. Renomeie para "vencida".
- **`material.int.test.ts:912`:** o `hoje` vem do relógio do sistema e o servidor também usa o do sistema. Uma corrida na virada da meia-noite de São Paulo falharia. Use o `relogio.fixo`, como no caso de l.920.
- **`Material.test.tsx:1254`:** a retomada pelo 429 roda com relógio real (`Retry-After: 1`, `waitFor` de 6 s), e a hora só é conferida por regex. Com `vi.useFakeTimers` e um `agora` fixo, o teste passa a afirmar a hora exata e deixa de depender da folga da máquina.
- **`material.service.ts:338`:** o `licencaId?.toLowerCase()` não tem caso com a licença em maiúsculas, como a série tem no l.818. Não há efeito, porque o uuid do Postgres não diferencia caixa, mas o caso fecharia a simetria.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-13 13:01:44 · `tasks/prd-ingestao-do-material/7_task.md`

VEREDITO: APROVADO

Tabelas verificadas:
- Nesta rodada não entrou tabela nova. Conferi `material_serie`, criada em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/drizzle/0054_material_serie.sql`, porque o comentário novo em `material.int.test.ts:855` se apoia nela. As duas FKs compostas existem, nas linhas 12 e 13: (`escola_id`, `material_id`) aponta para `material` e (`escola_id`, `serie_id`) aponta para `serie`. O comentário está certo.
- O diff da 0054 e da 0055 só muda comentários. O esquema e o backfill são os mesmos da 1ª rodada.

Queries verificadas:
- O diff entre a 1ª e a 2ª rodada não toca nenhum repository, service nem query.
- Como há um caso novo que cita a licença com o id em maiúsculas, conferi também `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/licenca.repository.ts`. Toda leitura e escrita, nas linhas 60, 70, 83, 93, 114 e 130, filtra por `requireEscolaId()`, que vem do token. Trocar maiúsculas por minúsculas não abre nenhum caminho fora da escola.

Teste de isolamento: presente e efetivo. O caso da série da escola B no filtro `?serieId` (`material.int.test.ts:857`) e o caso da licença da escola B continuam sem mudança. O texto deles foi ajustado, e cada um continua quebrando se a cláusula de escola sair do repository.

Bloqueantes: nenhum.

Recomendações:
- O caso novo da licença em maiúsculas (`material.int.test.ts`, "a licença citada em maiúsculas…") só usa licença da própria escola. Vale acrescentar a licença da escola B citada em maiúsculas, esperando o mesmo `NAO_ENCONTRADO` da licença inexistente. Assim fica provado que a mudança para minúsculas acontece antes do filtro por escola e não cria um caminho de resposta diferente.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-13 13:01:59 · `tasks/prd-ingestao-do-material/7_task.md`

VEREDITO: APROVADO

Esta é a 2ª rodada. Auditei só o diff `d5fc532d..78548ad9` (11 arquivos) e as quatro fotos. A 1ª rodada aprovou sem exigir correção, então não havia correção a conferir.

**Campos pessoais tocados:** nenhum campo novo. As mudanças são de tela e de teste:
- os selos "(obrigatório)" e o alvo de 44 px na declaração;
- o erro das séries passa a ser descrito por `aria-describedby`;
- o link "Ir para Escola" aparece quando a escola não tem série;
- três casos novos em `material.int.test.ts` e um em `Material.test.tsx`;
- comentários sobre trava nas migrations 0054 e 0055.

**Fora da tabela de dados do docs/lgpd.md:** nada. A linha "Material da escola" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/docs/lgpd.md:516` agora lista todos os motivos de `material.recusado` (`sem_licenca`, `sem_declaracao`, `licenca_vencida`, `licenca_inexistente`). Repete que a recusa guarda só os ids das séries pedidas, nunca o título nem série de outra escola. O texto bate com a techspec, que diz que a licença que some do banco entre a entrada e a transação é auditada como `licenca_vencida`.

**Autorização por objeto:** ok. O diff não abre rota nem query nova. O caso do filtro `?serieId` com a série da escola B ganhou um comentário: a FK composta com `escola_id` (`material_serie`) impede a linha cruzada no banco, e o filtro trata a série da B como uma que não existe. O teste continua conferindo esse caso.

**Logs:** limpos. O diff não acrescenta nenhum log.

**Auditoria:** presente. Os motivos de `material.recusado` já estavam auditados e testados na 1ª rodada, e o diff só os documenta.

**Envio externo:** nenhum. Este diff não toca em IA.

**Seed/fixture:** sintético.
- Nas fotos aparecem só "Colégio sintético da vitrine cheia/vazia" e "Coordenadora sintética", com sufixo hexadecimal.
- Os licenciantes dos testes são fictícios ("Editora do último dia", "Editora das maiúsculas", "Editora das sete séries").
- A data fixa no relógio do teste (`2026-11-12T23:30-03:00`) não é dado de pessoa.

**Fotos:** nas duas escolas (cheia e vazia), no computador e no celular, o diálogo "Enviar material" mostra só disciplina, séries, titularidade, licença e declaração. Não aparece dado de aluno, matrícula nem conteúdo. O único nome de pessoa é o da coordenadora logada, sintético, no rodapé da navegação, que não é deste diff.

**Pergunta de fechamento:** o diff não muda a resposta da 1ª rodada. O material não carrega dado de aluno, e as séries são só ids da escola, apagadas junto com o material.

**Bloqueantes:** nenhum.

**Recomendações:**
- Continuam abertas as duas recomendações que fiz na 1ª rodada: decidir se `licencaId` sai `null` para professor, aluno e rede (está com a tarefa 9.0), e fazer `material.enviado` gravar `licencaId` e `serieIds` (está com a tarefa 8.0). O destino de cada uma está anotado em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/7_task.md`, e vale conferir nessas tarefas que elas foram atendidas.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-13 13:02:19 · `tasks/prd-ingestao-do-material/7_task.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum. Esta rodada mexe em testes, rótulos e no layout do diálogo, mais os comentários das migrations 0054 e 0055. Nenhum SQL mudou.
Rate limit: ok. Os limites são os da 1ª rodada, por usuário e por escola, e não mudaram.
Fila e prioridade: ok, sem mudança nesta rodada.
Concorrência: protegida, sem mudança nesta rodada.
Índice e paginação: ok, sem mudança nesta rodada.
Degradação de IA: não se aplica.
Migration: compatível. A 0054 e a 0055 têm o mesmo SQL da 1ª rodada. O comentário novo agora descreve a trava `SHARE ROW EXCLUSIVE` em `material` e `serie`, que dura até o fim da transação do `migrar`, e avisa que o `SET LOCAL lock_timeout` também vale para as migrations seguintes do mesmo deploy.
Métrica e alerta: ok, sem mudança nesta rodada.
Bloqueantes: nenhum.

Correções exigidas na 1ª rodada: nenhuma, então não havia o que conferir.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/drizzle/0054_material_serie.sql:3`: o comentário cita a trava em `material` e `serie`, mas não a de `escola`. A FK `material_serie_escola_id_escola_id_fk` também pede `SHARE ROW EXCLUSIVE` em `escola` até o fim da transação. Ela não segura insert em tabela filha, só escrita na própria `escola`. Vale citar `escola` no comentário, para quem ler o deploy.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/e2e/material.spec.ts:314`: o teste deixou de exigir ordem porque a auditoria ordena só por `em`, e o relógio da máquina de teste volta alguns segundos. Isso mostra que a ordem da consulta de auditoria não é determinística quando dois instantes empatam ou se invertem. Ordenar por `em, id` resolve, já que o id é UUIDv7. Fica para a tarefa dona da consulta de auditoria.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/material/use-lote-de-material.ts:87`: com `refetchOnMount: 'always'`, cada abertura do diálogo faz um `GET /v1/licencas`. O custo é desprezível, porque a ação é da coordenação e a lista é pequena. Se um dia esse diálogo for aberto pelo professor, reavaliar essa leitura.

## frontend-reviewer · 2ª rodada · APROVADO · 2026-11-13 13:02:32 · `tasks/prd-ingestao-do-material/7_task.md`

VEREDITO: APROVADO

Tela vista: sim (4 fotos lidas: diálogo "Enviar material" a 1366 e a 360 px, na escola cheia e na vazia). Nas duas escolas o diálogo é igual, e a lista de séries tem uma série só. Li também o diff da rodada, `Dialog.tsx` e `PartesDoEnvioDeMaterial.tsx`.

Estados: ok.
- Em `PartesDoEnvioDeMaterial.tsx`, as séries e as licenças registradas têm carregando, erro com "Tentar de novo", vazio que manda para Escola ou Licenças, e com dado.
- O estado vazio de séries diz o que fazer e traz um link (`PartesDoEnvioDeMaterial.tsx:~190`).
- Carregando e erro eu conferi só pelo código e pelos testes, como a regra manda.

Acessibilidade: ok.
- A correção da rodada acrescenta o `obrigatoria` nos selects de Disciplina e "De quem é o material" (`DialogoDeEnvioDeMaterial.tsx:145,158`), e o `aria-required` sai pelo `Select`.
- Na foto o "(obrigatório)" aparece nos campos.
- O rótulo da declaração ganhou `min-h-11`, então o toque na frase marca a caixa.
- Séries em `fieldset` com `legend`, erro ligado por `aria-describedby`, foco inicial no botão de arquivo (não no que confirma), alerta com foco ao falhar.

Chromebook fraco: ok.
- O diálogo rola por dentro (`Dialog.tsx:~62`: `max-h-[calc(100svh-2rem)] overflow-y-auto`), então o rodapé "Cancelar / Enviar material" fica alcançável.
- O envio é um arquivo por vez, com teto de 20 por lote.
- Nada nesta rodada mudou o desempenho.

Celular: ok.
- A 360 px não há rolagem horizontal nem texto cortado nas fotos.
- Alvos: o botão de arquivo e as séries têm `min-h-11`, a caixa da declaração tem 24 px com o rótulo de 44 px, e o botão principal tem 44 px.
- Nada depende de hover: o arrastar tem o botão "Escolher arquivos" como alternativa.
- As fotos de 360 px não mostram o rodapé, porque ele está abaixo da dobra, dentro da rolagem do diálogo. Eu o conferi pelo código, não pela foto.

Ação oficial protegida: sim. O envio exige licença de uso e declaração. Sem uma das duas, o envio é recusado antes de ler o arquivo, a recusa vai para a auditoria, e o diálogo mostra o motivo.

Bloqueantes: nenhum.

Recomendações (não bloqueiam):
1. `RequiredMark` em `components/ui/fields/FormField.tsx:55-61` escreve "(obrigatório)" no masculino. Em "Disciplina (obrigatório)" e "Séries do material (obrigatório)" (`PartesDoEnvioDeMaterial.tsx:~164`) o certo seria "(obrigatória)" e "(obrigatórias)". Dá para ter uma variante feminina ou um texto passado por quem usa.
2. `DialogoDeEnvioDeMaterial.tsx:~186`: "Licença de uso (obrigatória)" está escrito à mão no rótulo, enquanto os outros campos usam `RequiredMark` (cinza, `aria-hidden`). O rótulo fica diferente dos vizinhos e o marcador é lido duas vezes por leitor de tela, porque o próprio texto do rótulo já diz "obrigatória". Troque por `rotulo="Licença de uso"` com `obrigatoria`, depois de resolver a recomendação 1.
3. O arquivo `e2e/material.spec.ts` agora compara os motivos das recusas ordenados, por causa do relógio da WSL. Isso esconde a ordem real das recusas. Se a ordem importar para a auditoria, vale um teste próprio com relógio controlado.

Arquivos principais:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/material/DialogoDeEnvioDeMaterial.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/material/PartesDoEnvioDeMaterial.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/components/ui/fields/FormField.tsx`

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-13 13:02:58 · `tasks/prd-ingestao-do-material/7_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta rodada nem na tarefa. O diff mexe só em testes, no diálogo de envio, em comentários das migrations 0054 e 0055 e em documentação. Todos com autor humano? sim (não há caminho novo).

Decisão autônoma sobre aluno: ausente.

Aprovação registrada: ok. Não há saída de IA nova nem fluxo de aprovação alterado. O envio de material é ato humano da coordenação, e a recusa continua auditada em `material.recusado`. Nesta rodada, `docs/lgpd.md` passou a listar também os motivos `licenca_vencida` e `licenca_inexistente`.

Supervisão do tutor: ok. O que a tarefa liga ao Tutor é só a frase "Quem enxerga o material é o professor e o Tutor da série marcada". Ela está no campo de séries de `PartesDoEnvioDeMaterial.tsx`, linha sem mudança nesta rodada, e é transparente: diz em português comum o efeito da escolha e chama o Tutor pela função, não por nome de pessoa (D17 e D58). Nenhuma mudança alcança conversa, registro ou resumo.

Autonomia declarada e visível: sim, sem mudança. A tarefa não cria agente nem altera nível.

Fotos da tela: olhei as quatro (escola cheia e vazia, no computador e no celular, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/.processo/vitrine/`). O diálogo "Enviar material" não mostra saída de IA, nota, conceito nem sugestão de nota. Também não tem nada que induza uso: "Cancelar" está ao lado de "Enviar material", com o mesmo peso de caminho (D59). Não há achado da regra 70 nas fotos.

Bloqueantes: nenhum.

Recomendações:
- Fica de pé a da 1ª rodada, já com destino na `7_task.md`. Na tarefa 9.0 e na validação da spec, auditar o efeito do preenchimento da 0055 (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/drizzle/0055_material_serie_backfill.sql`) sobre o escopo do Tutor. Esse preenchimento dá ao material antigo todas as séries da escola, o que amplia o que o Tutor de cada série enxerga.
- Fora da minha regra, só como registro: o comentário novo da 0055 avisa que o `SET LOCAL lock_timeout` vale até o fim da transação do `migrar`, inclusive para as migrations seguintes. Vale o `infra-guardian` confirmar que nenhuma migration posterior no mesmo deploy depende de trava mais longa.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-13 13:03:22 · `tasks/prd-ingestao-do-material/7_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

Na 1ª rodada eu não exigi correção nenhuma, então nesta só auditei o que mudou desde então, em 11 arquivos.

- Nada do que mudou entra em tarefa futura. O link "Ir para Escola", que aparece quando a escola não tem séries, segue o mesmo padrão do link para Licenças no mesmo arquivo e já está descrito em `docs/interface.md`.
- A `techspec.md` §3 agora registra que a licença que some do banco entre a conferência da entrada e a transação cai em `licenca_vencida` / `LICENCA_VENCIDA`. Leio isso como esclarecimento, não como divergência: a licença não se exclui, e o caso já tinha teste em `material-envio-orfao.int.test.ts` na rodada aprovada.
- No teste do último dia, o caso "sem fim" saiu do nome. A cobertura não se perdeu: os dois testes novos registram a licença sem `vigenteAte`, porque `registrarLicencaDeTeste` só manda o campo quando ele é passado. O último dia agora usa o relógio fixo (`relogio.fixo`), sem depender da data de hoje.
- Nas quatro fotos, cheia e vazia, no computador e no celular, os nomes do diálogo seguem o glossário e a tela não mostra nada fora da tarefa.

Recomendações:
1. `tasks/prd-ingestao-do-material/cenarios.md:21` cita só "`LICENCA_VENCIDA` reconferida na transação" pela vigência encurtada. Vale acrescentar ali a licença que some do banco nesse meio-tempo, que a `techspec.md` §3 agora descreve, para os dois documentos dizerem o mesmo.
2. `apps/web/src/areas/coordenacao/material/Material.test.tsx:1593` confere o link com `toContain(COORDENACAO_ROUTES.estrutura)`, ou seja, só `/estrutura`. Conferir o caminho inteiro (`AREA_PATHS`/`COORDENACAO_PATHS.estrutura`) pegaria um link que caísse fora da área da coordenação.
3. Nas fotos (`.processo/vitrine/coordenacao--coordenacao-material--Enviar-material--computador.png`), "Disciplina", "Séries" e "De quem é o material" mostram "(obrigatório)" em cinza, mas "Licença de uso (obrigatória)" traz o marcador em negrito dentro do próprio rótulo. A linha que produz isso é `DialogoDeEnvioDeMaterial.tsx`, no `Select` da licença de uso. O desenho é com o `frontend-reviewer`; fica registrado para a validação.
4. `packages/core/drizzle/0055_material_serie_backfill.sql:9` avisa que o `SET LOCAL lock_timeout` vale para as migrations seguintes do mesmo deploy. Quem escrever a próxima migration longa precisa saber disso, e vale uma linha no `TODO.md` ou no runbook, junto com a do `infra-guardian` (1ª rodada) que já foi para o `TODO.md`.

Arquivos:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/7_task.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/cenarios.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/material/PartesDoEnvioDeMaterial.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/material/Material.test.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/material.int.test.ts`

## test-engineer · 2ª rodada · APROVADO · 2026-11-13 13:03:42 · `tasks/prd-ingestao-do-material/7_task.md`

VEREDITO: APROVADO

Cenários exigidos (2ª rodada): as duas correções que reprovaram a 1ª rodada e o que o diff `d5fc532d..78548ad9` mexeu. São elas: os 13 campos do pedido com sete séries e licença registrada; a licença lida de novo quando o diálogo reabre; e as mudanças da tela (`obrigatoria` nos dois selects, o alvo de 44 px na declaração, o `aria-describedby` no grupo das séries e o link "Ir para Escola" na escola sem série). Entram também o último dia da licença com relógio fixo e a licença citada em maiúsculas.

Cobertos:
- **Correção 1, o teto de campos:** feita. O caso novo é `apps/api/test/material.int.test.ts` › "as sete séries do teto com uma licença registrada: o recebimento aceita os treze campos do pedido e o material sai com as sete". O pedido leva 6 campos de texto (`titulo`, `disciplinaId`, `titularidade`, `licencaId`, `licenca`, `declaracao`) e 7 `serieIds`, 13 no total, e o teste espera 201 com as sete séries em `serieIds`. Com `MAXIMO_DE_CAMPOS = 10`, o recebimento estoura o limite de `fields` e o de `parts`, e o pedido sai `ENTRADA_INVALIDA`: o vermelho vem da regra certa. Se um `POST /v1/series` falhasse em silêncio, o id `undefined` iria como texto e a resposta seria 400, então o teste não passa por engano. O bloco de mutação está no documento, e a linha da tabela cita o teste pelo nome. Rodei e passou.
- **Correção 2, a releitura ao abrir:** feita. O caso novo é `Material.test.tsx` › "a licença é lida de novo quando o diálogo reabre, dentro do prazo em que a lista ainda estaria fresca…". O `renderScreen` usa `createQueryClient()`, com `staleTime: 30_000`. O hook é montado no `DialogoDeEnvioDeMaterial`, que sai da tela ao fechar, então reabrir monta um observador novo com o cache ainda fresco. Sem o `'always'`, nenhum dos dois `expect` passa: não sai um `GET /v1/licencas` novo, e a vigente continua nas opções. O bloco de mutação está no documento e a linha da tabela está lá. Rodei e passou.
- **Último dia da licença:** agora usa o relógio injetado em 2026-11-12 23:30 de Brasília, que já é 13/11 em UTC. Assim o teste prova também o fuso, e não só a comparação de datas. O dia seguinte segue coberto pelo caso do relógio (`material.int.test.ts:957-961`). A licença sem fim continua aceita, com 201, nos casos "maiúsculas" e "sete séries", que usam a licença padrão da fixture, sem `vigenteAte`.
- **As mudanças da tela:** cada cláusula nova tem o seu bloco de mutação. São os dois `obrigatoria`, o `min-h-11` do rótulo da declaração, o `aria-describedby` do grupo, o id do erro trocado e o link para `COORDENACAO_ROUTES.estrutura`. Os testes conferem o texto: o rótulo "(obrigatório)", a classe `min-h-11`, o grupo sem `aria-invalid` e com `aria-describedby`, o texto do erro e o `href` do link. Os blocos antigos foram ajustados ao código novo: o `aria-invalid` saiu, e o `validas.length` e o `if (ordenadas.length === 0)` foram atualizados. O `--faltando` caiu de 8 para 7 linhas, cada uma com motivo.
- Nenhum `.skip`, nenhum teste comentado, e nenhum mock esconde a regra. O diff não toca IA.

Bloqueantes: nenhum.

Recomendações:
- `e2e/material.spec.ts:531`: a comparação das recusas na auditoria passou a ignorar a ordem, por causa do relógio da WSL. Pode ficar, porque a ordem não é regra. Mas a causa é o relógio da máquina, e isso vale ir para o `TODO.md`, para não virar costume afrouxar a asserção em outros testes.
- `material.int.test.ts` › "a licença citada em maiúsculas…": nenhuma linha de produção mudou nesta rodada, e a tabela a pôs sob "`licenciante` copiado". O assunto real dela é a licença em maiúsculas virar minúsculas, que merece linha própria na tabela, ou ser citada junto com a série em maiúsculas.
- `Material.test.tsx` › releitura ao abrir: a contagem `lidas` é tirada depois que o campo aparece. Se um dia a página também ler `/v1/licencas` antes de o diálogo abrir, um pedido do primeiro diálogo ainda em curso pode inflar a contagem. Hoje isso não muda nada, porque a segunda asserção, a licença ausente das opções, falha sozinha sem o `'always'`.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/material.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/material/Material.test.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/material-upload.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/7_task.md
