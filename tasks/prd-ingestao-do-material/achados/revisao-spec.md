# Achados das revisões — `tasks/prd-ingestao-do-material/revisao-spec.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## frontend-reviewer · 1ª rodada · AJUSTES NECESSÁRIOS · 2026-11-11 10:19:30 · `tasks/prd-ingestao-do-material/revisao-spec.md`

VEREDITO: AJUSTES NECESSÁRIOS
Tela vista: não. É revisão de spec, não há tela nova. Só li o código das telas de hoje: `Material.tsx` (quatro estados presentes), `fila-da-coordenacao.ts` e a seção da coordenação em `docs/interface.md`. O que segue vem do desenho.
Estados: faltando. A Tech Spec não nomeia os estados das telas novas (seção 9). `Material.tsx` de hoje já tem carregando, erro, vazio e com dado. Falta dizer o mesmo do resumo, da aba Licenças e das fontes do artefato. A seção 10 não prevê teste de componente para eles.
Acessibilidade: implícita. A seção 9 não fala de teclado, foco, rótulo nem anúncio de progresso dos 20 arquivos.
Chromebook fraco: não garante (bloqueante 2). Imagem para comprimir não se aplica, porque só entra PDF.
Celular: genérico. A seção 9 cita os projetos `chromebook` e `celular`, o que basta como regra. O resumo por disciplina e série e a lista de licenças não dizem como ficam a 360 px. Nenhum fluxo exige o celular.
Ação oficial protegida: sim, com ressalvas. A exclusão tem diálogo hoje. A saída da edição antiga e o encurtar da vigência são efeitos de uma ação e não têm confirmação prevista (recomendações 1 e 2).

Bloqueantes:

1. **Seção 7c, seção 9 e RF14 (limite de envio sem tratamento na tela).**
   - Os limites são 30 envios por pessoa e 120 por escola por hora. O envio é um arquivo por vez, até 20 por diálogo. No segundo lote de 20 a pessoa leva 429 no 11º arquivo.
   - Para 300 apostilas o onboarding leva pelo menos 10 h com uma pessoa só. Isso colide com o cenário de dia 1 do PRD, seção 1.
   - A seção 9 não diz o que o diálogo mostra no 429 com `Retry-After`, nem no 503 de storage. Também não diz se os arquivos restantes ficam na fila para continuar depois.
   - Correção exigida:
     - Definir na seção 9 os textos e o comportamento: "Limite de envios por hora atingido. Você pode continuar às HH:MM", com os pendentes mantidos e um botão de retomar.
     - Reconciliar os 30 por pessoa com o onboarding de 300 PDFs: subir o limite do coordenador, ou dizer que o lote ocupa várias horas.
     - Dar um texto com a ação a fazer para cada erro novo: `EDICAO_EM_ANDAMENTO`, `LICENCA_VENCIDA`, `SEM_MATERIAL_DA_SERIE`, 429 e 503.
     - Cobrir esses textos no e2e.

2. **Seção 4 e seção 9 (lista de materiais sem paginação nem virtualização).**
   - `GET /v1/materiais` devolve `capitulos` em cada item, sem paginação. Com 300 apostilas, a lista inteira e todos os capítulos vão pela rede escolar e para a tela de uma vez.
   - Hoje `Material.tsx` não pagina nem virtualiza (confirmado por busca no arquivo).
   - Correção exigida:
     - `capitulos` só em `GET /:id`.
     - Lista de materiais paginada, ou virtualizada com o contrato dito.
     - Verificação com throttling de rede e de CPU, nos projetos `chromebook` e `celular`, com 300 materiais no seed.

3. **Seção 4, `GET /v1/materiais/resumo`, contra o RF18.** O RF18 pede os envios recusados por licença "por disciplina e série". O contrato traz `recusadosEm30Dias` só por disciplina. Corrigir o contrato (a recusa acontece antes do arquivo, mas o `serieIds` do pedido está na auditoria) ou registrar o desvio no PRD.

4. **Seção 9 (sino e `docs/interface.md`).** `docs/interface.md` diz que o sino da coordenação "lista cinco tipos, e só eles", e `TIPOS_DA_FILA` tem cinco. O `licenca-vencendo` é um sexto. Isso contradiz o `docs/interface.md` até ele mudar.
   - A seção 9 diz que a interface muda "na tarefa de cada tela", mas não dá o texto do item nem o destino.
   - Correção exigida: a tarefa do sino atualiza a seção do sino e a lista de abas Escola › Material.
   - O item leva à aba Licenças, sem número por licenciante nem por professor, e some quando a vigência é atualizada.
   - A leitura de licenças entra no sino sem polling (o sino "não relê por tempo").

Recomendações:
1. **Enviar nova edição.** O diálogo deve dizer que a edição anterior sai da busca quando a nova ficar pronta, e que os artefatos antigos mantêm a citação.
2. **Alterar vigência.** Mostrar quantos materiais saem ou voltam da busca antes de confirmar, usando a contagem `materiais` que já existe.
3. **Estado vazio da lista de licenças no diálogo de envio.** Deve convidar a registrar a primeira licença, com link para a aba Licenças. O mesmo vale para material de terceiro com licença vencida: não deve ser selecionável.
4. **Backfill.** Cada material ganha todas as séries da escola, então o de 6º ano passa a aparecer para o 9º. Um aviso no resumo, "séries atribuídas automaticamente, confirme", faz a coordenação corrigir. Quanto a `semSerie` e `SEM_MATERIAL_DA_SERIE`: a mensagem ao professor deve dizer "peça à coordenação para declarar a série do material". A do Tutor, ao aluno, deve dizer "avise seu professor".
5. **Resumo por disciplina e série.** Tabela larga; dizer que rola dentro do cartão ou vira lista a 360 px, como a grade em `docs/interface.md`.
6. **Progresso dos 20 arquivos.** Região com anúncio (`aria-live`), foco devolvido ao fim e alvo de 44 px no "Enviar". Datas de vigência em dd/mm/aaaa, com rótulo em cada campo.
7. **Licenças.** Item "vencida" com cor e texto, não só cor.

Arquivos lidos:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/prd.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/techspec.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/apps/web/src/areas/coordenacao/material/Material.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/apps/web/src/areas/coordenacao/painel/fila-da-coordenacao.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/docs/interface.md`

## conformidade-reviewer · 1ª rodada · REPROVADO · 2026-11-11 10:20:21 · `tasks/prd-ingestao-do-material/revisao-spec.md`

VEREDITO: REPROVADO

Caminhos de escrita em Nota: nenhum. A spec não toca `Nota`, não cria seed nem importação de nota, e o job novo (`material.extrair-pdf`) só grava material, trechos e capítulos (seções 3 e 5). Todos com autor humano? Não se aplica, porque não há caminho novo.

Decisão autônoma sobre aluno: ausente. Nada desta spec aprova, reprova ou encaminha aluno.

Aprovação registrada: ok.
- Não há saída de IA nova (seções 7b e 8). O artefato continua passando pela aprovação de hoje.
- Antes de aprovar, o professor vê a edição citada. O chip e o PDF saem das `fontes`, e o artefato que cita a edição substituída mostra "edição anterior" (seções 4 e 9).
- As citações ficam no `conteudo` do artefato, que não muda depois de gravado (`packages/core/src/db/schema/artefato.ts`). Apagar os trechos da edição antiga não apaga o que a IA gerou.
- Os comandos da operação recusam job `ia.*` e `titular.*`, como diz a 46.0 (`tasks/prd-reengenharia/onda-3b.md`, T5).

Supervisão do tutor: lacuna em "Fluxo › Busca" (seção 5) e na seção 10, no caminho `SEM_MATERIAL_DA_SERIE` do Tutor. Detalhe nos bloqueantes.

Autonomia declarada e visível: sim. Não há agente novo nem mudança de nível. Ficar preso à série da turma estreita o Tutor, não amplia o que ele faz sozinho.

Itens 6 a 9:
- **Item 6 (auditoria):** ok. Entram `material.edicao_enviada`, `material.substituido`, `licenca.*` e `job.*` com autor (seção 7), e o artefato antigo continua dizendo que edição usou (RF11).
- **Item 7 (vigilância):** ok. O resumo é contagem por disciplina e série, sem pessoa e sem comportamento.
- **Item 8 (D46/D55):** não se aplica. Não há nota nem conceito, e a habilidade ficou na F4b.
- **Item 9 (medir o professor):** ok. Não há métrica por professor, o DTO nunca traz "quem enviou" (seção 7, "DTO de saída"), e a conversa do professor não é tocada.

Bloqueantes:

1. **Seção 5, "Busca", ordem em relação à D36.** A spec manda checar `existeMaterialDaSerie(disciplinaId, serieId)` "antes de chamar o modelo" e devolver ao Tutor "a mensagem fixa, sem execução". Ela não diz em que ponto do `TutorService.enviar` essa checagem entra em relação ao encaminhamento de assunto delicado. Hoje esse encaminhamento vem "antes de tudo o mais" (`apps/api/src/tutor/tutor.service.ts:124-127, 167`).
   - **Risco:** se a nova checagem vier antes, o aluno de uma turma sem material da série que escreve sobre risco à vida recebe "não há material" no lugar do 188. O professor também não recebe o sinal `atencao_humana`. É um uso do Tutor que o professor não vê, e quebra a D36.
   - **Correção exigida:**
     - A seção 5 diz que a checagem roda depois de `ehAssuntoDelicado` e não alcança o `#encaminhar`, nem a saída `assunto_delicado` do modelo.
     - A seção 10 ganha o teste de integração: turma sem material da série, mais texto com gatilho, resulta na mensagem fixa da D36 e no sinal `atencao_humana`.

2. **Seção 5, "Busca", e seção 10: o que fica registrado e o que o professor vê.** "A mensagem fixa, sem execução" deixa em aberto se o aluno recebe uma fala do Tutor na conversa ou uma recusa da tela. Se for fala do Tutor fora de `mensagem_tutor`, o aluno vê uma troca com o Tutor que não aparece nem em `GET /v1/tutor/uso` nem na sala ao vivo. Isso viola a regra 70, item 4.
   - A spec também não define qual `disciplinaId` vale no modo livre, sem atividade e sem material. Hoje esse modo roda sem disciplina e sem trecho (`tutor.service.ts:228-232, 247-249`). Sem isso, não dá para saber se o modo livre passa a ser recusado ou continua como está.
   - **Correção exigida:** escolher e escrever um de dois caminhos.
     - **(a) Recusa antes do aceite:** código de erro, como `TUTOR_PAUSADO_EM_AVALIACAO`. Nada entra na conversa, e a tela do aluno mostra um estado, não uma fala do Tutor (`apps/web/src/areas/aluno/tutor.ts:87-90`).
     - **(b) Turno gravado:** pergunta e mensagem fixa em `mensagem_tutor`, visíveis em uso e na sala ao vivo, como o `#encaminhar` faz.
   - Nos dois casos, a spec também precisa:
     - dizer o que acontece no modo livre;
     - ganhar na seção 10 o teste que prova a escolha: nada na conversa do aluno que não esteja no que o professor vê.

Recomendações:
- **Seção 4, `fontes`:** definir o que o chip mostra quando o expurgo de `material_excluido` já apagou a linha do material (por exemplo "material excluído"). Assim a consulta "o que a IA gerou" nunca fica com uma citação sem título.
- **Seção 7b:** está curta demais para a revisão. Vale listar o que foi conferido: nenhuma saída de IA nova (item 3), Tutor e D36 (item 4), auditoria das ações novas (item 6), resumo sem pessoa (itens 7 e 9).
- **Seção 10:** citar explicitamente o teste da 46.0 em que `ops:reprocessar-job` e `ops:descartar-job` recusam `ia.*` e `titular.*`, e não só "a onda 3b".
- **Supervisão:** mostrar ao professor da turma (contagem, sem conteúdo) ou à coordenação no resumo que alunos estão esbarrando em "sem material da série". Hoje a turma ficaria sem Tutor útil sem que ninguém da escola soubesse.
- **`docs/regulacao.md` seção 5:** "a autorização fica registrada no sistema" pode passar a apontar para `licenca_de_material` como o registro da licença de terceiro.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/prd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/apps/api/src/tutor/tutor.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/docs/regulacao.md

## tenancy-guardian · 1ª rodada · REPROVADO · 2026-11-11 10:20:33 · `tasks/prd-ingestao-do-material/revisao-spec.md`

VEREDITO: REPROVADO

**Item por item, contra a Tech Spec**

1. **`escolaId` e `anoLetivoId`: garantido** (seção 3). As tabelas `licenca_de_material`, `material_serie` e `capitulo_do_material` têm `escola_id`, e as referências usam FK composta com a escola. A ausência de `anoLetivoId` é coerente com a regra de negócio do PRD (seção 6) e com o `material` e a `serie` de hoje. A vigência da licença é por data, não por ano letivo.
2. **Escopo pelo token: garantido** (seções 5 e 6). Na API o escopo vem do contexto. No worker vem de `job_registro.escola_id`, gravado no envio com o contexto da requisição. A `serieId` da busca vem da turma, que os três chamadores já leem com escopo e vínculo (`turmaComDisciplina` e o `#alcance` do Tutor). O trecho da substituição na seção 5 está escrito sem `escola_id` (abaixo, em recomendação).
3. **`escolaId` vindo do cliente: não acontece** (seção 4). Nenhuma rota recebe `escolaId`. `serieIds`, `licencaId` e `:id` da edição são resolvidos no escopo.
4. **Teste de isolamento: presente e efetivo em sete dos oito casos** (seção 6). Em cada um, tirando a cláusula, a resposta deixa de ser 404 ou vazio, por vazamento ou por erro de FK. O caso `serieIds` de B não diz o que se espera (bloqueante abaixo).
5. **Existência revelada: implícito em um ponto.** Licença, edição e `PATCH` de B respondem 404, igual ao inexistente. Para `serieIds` de B a resposta não está definida.
6. **UUID: garantido** pela convenção `uuid().default(uuidv7())` do schema. Só a `licenca_de_material` diz `uuid` explicitamente.
7. **Rede: não se aplica.** As células `licenca.*` e `material.resumo` são só da coordenação (`unidade`, seção 7), e nenhuma rota é da rede.
8. **`@Unscoped`: garantido.** A varredura do órfão (45.0) e a listagem e leitura por id do job (46.0) têm justificativa escrita em `tasks/prd-reengenharia/onda-3b.md`. O `varrerParados` sai.

```
VEREDITO: REPROVADO
Tabelas verificadas: licenca_de_material, material_serie, capitulo_do_material, material (colunas novas: edicao, substitui_id, substituido_por, licenca_id, processado_em, objeto_apagado_em), índice auditoria (escola_id, em) where acao = 'material.recusado'
Queries verificadas: MaterialRepository.buscar com serieId e vigência; existeMaterialDaSerie; lerParaExtrair; transição e substituição no worker; resumo (material e auditoria); licença (listar, ler for share, PATCH); edição sobre :id; fontes do artefato; varredura @Unscoped (45.0); jobs-que-falharam @Unscoped (46.0); backfill da seção 3
Teste de isolamento: presente e efetivo (salvo o caso de serieIds, abaixo)
Bloqueantes:
- techspec.md seção 6 ("`serieIds` de B;") e seção 4 (POST /v1/materiais): o caso de isolamento da série não tem resultado esperado, e a Tech Spec não diz como responde uma série de outra escola no envio. Pela regra 10.6, a resposta precisa ser idêntica à de um id de série inexistente; do jeito que está, o teste não tem asserção que o faça falhar sem o escopo. Correção exigida: escrever na seção 4 o código de erro de `serieIds` não encontrada no escopo (o mesmo para inexistente e para outra escola, conferido no repository com escopo antes da transação, sem depender do erro de FK) e, na seção 6, o teste: "série de B no envio de A responde <código>, igual ao id inexistente, e nada é gravado".
Recomendações:
- Seção 5, Extração: escrever `escola_id = <escola do contexto>` no `update material ... where id = :antiga` e no apagar dos trechos dela, para a tarefa não copiar a consulta sem escopo. A FK composta (escola_id, substitui_id) já impede o alcance a outra escola, mas a regra 10.3 pede o filtro no repository.
- Seção 3, backfill: dizer que a licença nasce por (escola_id, licenciante), e não por licenciante distinto na base inteira, com `vigente_desde` = o `enviado_em` mais antigo dentro da escola. A FK composta faria a migration falhar em vez de vazar, mas o texto atual leva ao agrupamento errado.
- Seção 6: o teste do resumo deve incluir uma recusa por licença na escola B (o `recusadosEm30Dias` sai da auditoria, não do material). Acrescentar `GET /v1/materiais?serieId=<de B>` respondendo igual a série inexistente.
- Seção 6: "os `@Unscoped` ... só com (escola_id, id)" não vale para a listagem da 46.0, que devolve escola, tipo, código e data. Ajustar o texto para "os da 45.0 e 46.0, com as colunas e as justificativas de lá".
- Seção 5, Busca: fora do isolamento, mas é furo de regra. `TrechoSearch.doMaterial` (`apps/api/src/material/trecho-search.ts:72`, usado pelo Tutor em `tutor.service.ts:286`), o `materialId` da busca do Tutor e a rota `GET /v1/materiais/busca` não aparecem na Tech Spec. Sem filtro de série e de licença vigente nesses caminhos, o RF7 e o RF17 ficam furados. Repassar ao `revisor-geral` e ao `privacy-guardian`.
- Seção 3: dizer `uuid` no id de `capitulo_do_material`, e `unique (escola_id, id)` na `licenca_de_material`, que é o alvo da FK composta do material. Fazer `registrada_por` com FK composta e `on delete set null ("registrada_por")`, como o material.
```

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/prd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-reengenharia/onda-3b.md

## privacy-guardian · 1ª rodada · REPROVADO · 2026-11-11 10:20:35 · `tasks/prd-ingestao-do-material/revisao-spec.md`

VEREDITO: REPROVADO

A Tech Spec não deixa vazar dado de aluno e não manda nada a provedor externo. Ela reprova no ciclo de vida: a licença nova não tem caminho de saída, e o desenho da edição trava o expurgo do material excluído.

**Item por item**

| Item | Situação | Onde |
|---|---|---|
| Campo novo na tabela de `docs/lgpd.md`, com finalidade e retenção | A spec atualiza a tabela, mas a retenção da licença não fecha (bloqueante 1) | §7 |
| Campo proibido de aluno | Não se aplica: nenhum campo de aluno | §3 |
| Adaptação em vez de diagnóstico | Não se aplica | — |
| DTO explícito | Garantido. `Licenca` traz o licenciante só à coordenação, e nunca hash, chave de objeto nem quem enviou | §4, §7 |
| Autorização por objeto | Garantida em licença, edição, resumo, busca e `fontes`. Só a resposta para `serieIds` de outra escola ficou sem definição (bloqueante 3) | §6, §7 |
| "Não encontrado" igual a "sem permissão" | Garantido para licença e edição (404). Não está escrito para `serieIds` | §6 |
| Bucket privado e URL assinada | Garantido: `guardarBytes` e `lerBytes` sem URL nem listagem, chave só com ids | §2, §5 (45.0) |
| Convite | Não se aplica | — |
| Exportação auditada | Não se aplica | — |
| Erro sem stack trace | Garantido: os quatro erros novos são tipados | §4 |
| Log sem dado pessoal | Garantido: só ids, código da falha, contagens e duração; nunca título, licenciante nem texto | §7 |
| Auditoria | Presente: `licenca.registrada` e `.alterada`, `material.edicao_enviada`, `material.substituido`, `job.reprocessado` e `.descartado` | §7 |
| IA | Não se aplica: nenhuma chamada nova. Sem material da série, o Tutor responde com a mensagem fixa e não chama o modelo | §5, §8 |
| Exclusão lógica e retenção | Falha (bloqueantes 1 e 2) | §3, §7 |
| Seed | Sintético: os PDFs vêm de `tools/demonstracao` | §10 |
| Pergunta de fechamento | O material não guarda dado de aluno. Para o coordenador, a licença entra no arquivo do titular. Depois dos bloqueantes 1 e 2, a resposta fica completa | §7 |

```
VEREDITO: REPROVADO
Campos pessoais tocados: licenca_de_material.licenciante (pode ser pessoa; muda de material.licenciante),
  licenca_de_material.registrada_por (coordenador); autoria na auditoria das ações novas.
Fora da tabela de dados do docs/lgpd.md: nenhum campo ficou fora. A spec manda atualizar a linha do material,
  a do PDF temporário (45.0) e as ações da auditoria. Mas a retenção que ela declara para a licença não tem
  mecanismo (bloqueante 1).
Autorização por objeto: ok em licença, edição, resumo, busca e fontes; a resposta a serieIds de outra escola
  não está definida (bloqueante 3).
Logs: limpos (§7: ids, código, contagens e duração).
Auditoria: presente.
Envio externo: nenhum (§7, §8).
Seed/fixture: sintético (§10).
```

**Bloqueantes**

1. **A licença não tem retenção, classificação nem saída na eliminação.** (§3, `licenca_de_material`; §7, "Retenção e expurgo")
   - **O que está errado:**
     - A §7 diz "enquanto um material a citar, depois o `material_excluido`", e a §4 diz que "a licença não se exclui". Nenhum módulo da §2 mexe no expurgo (`packages/core/src/retencao/expurgo-da-escola.repository.ts`). Nada define a classe de `licenca_de_material` em `CLASSIFICACAO_DAS_TABELAS` (`packages/shared/src/privacidade/classificacao.ts`).
     - Lida ao pé da letra, a regra apagaria na hora uma licença recém-registrada e ainda sem material. Na prática, a licença vencida e sem uso fica para sempre com o licenciante.
     - `registrada_por uuid null` está sem FK. A eliminação do coordenador deixa o id na linha. O material resolve o mesmo caso com FK composta e `on delete set null ("enviado_por")`, ver `packages/core/src/db/schema/material.ts:57-59`.
   - **Correção exigida:**
     - Escrever quando a licença sai, por exemplo "N meses depois de vencida ou do último material, o que vier depois", na categoria `material_excluido` ou em prazo próprio.
     - Classificá-la em `CLASSIFICACAO_DAS_TABELAS` com a ligação `registrada_por`.
     - Pôr a saída no expurgo da escola, com teste (sai no prazo, fica com material, fica a de outra escola).
     - Declarar a FK `(escola_id, registrada_por)` com `on delete set null (registrada_por)`.

2. **A FK de `substitui_id` sem ação trava o expurgo do material excluído.** (§3, `FK (escola_id, substitui_id) sem ação`; §7, "edição substituída: `material_excluido`, da substituição")
   - **O que está errado:**
     - A edição antiga recebe `excluido_em` na substituição, e o expurgo apaga a linha dela em `expurgo-da-escola.repository.ts:282-288`.
     - O filtro desse `delete` só olha `mensagem_tutor` e `sinal_tutor`. A edição nova continua apontando para a antiga, então a FK aborta o `delete` inteiro.
     - Daí em diante, o material excluído daquela escola nunca mais sai, e a retenção declarada não se cumpre.
     - `substituido_por` não tem FK declarada e pode ficar apontando para um id que já saiu.
   - **Correção exigida:**
     - Usar `on delete set null (substitui_id)`, escrito à mão como na 0022, ou outra saída equivalente.
     - Dizer o que acontece com `substituido_por`.
     - Teste de integração: a edição antiga além do prazo sai, a nova fica com `substitui_id` nulo, e as `fontes` do artefato antigo continuam respondendo ("material da escola").

3. **A resposta para `serieIds` de outra escola não está definida.** (§6, item "`serieIds` de B")
   - **O que está errado:** a regra 20, item 6, tem veto. O teste está listado, mas sem a resposta esperada. Se a FK composta estoura sem tratamento, sai um 500 ou um erro diferente do de série inexistente, o que confirma que o id existe e pode levar o nome da constraint.
   - **Correção exigida:** a série de outra escola e a série inexistente recebem a mesma resposta tipada (404, como a licença e a edição), conferida pelo service antes de gravar. O teste compara as duas respostas.

**Recomendações**

- §7: escrever o conteúdo de `licenca.registrada` como `strictObject`: só os ids e a vigência, sem licenciante, cobertura nem referência, que são texto livre.
- §7: incluir o nome do arquivo enviado na lista do que nunca vai a log. O título nasce dele, e o multipart costuma aparecer no log da requisição.
- §7: a entrada `material` do arquivo do titular (`packages/core/src/titular/leitura-do-titular.ts:385-400`) precisa decidir as colunas novas (`edicao`, `licenca_id`, `substitui_id`, `substituido_por`, `processado_em`, `objeto_apagado_em`): cada uma vai em `colunas` ou em `fora`. A tarefa (4) tira `licenciante` do `fora`.
- §9: o aviso do sino `licenca-vencendo` deve levar só o `licencaId` e a data, não o licenciante.
- §12: trazer de volta a premissa da onda 3b, §4: o bucket de produção não pode ter versionamento, ou o PDF apagado sobrevive como versão antiga.
- §10: a licença da seed e do e2e usa licenciante fictício, e a spec deve dizer isso.

Arquivos de referência:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/techspec.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/packages/core/src/retencao/expurgo-da-escola.repository.ts`
[… 3 linhas cortadas]

## infra-guardian · 1ª rodada · REPROVADO · 2026-11-11 10:23:15 · `tasks/prd-ingestao-do-material/revisao-spec.md`

VEREDITO: REPROVADO
Caminho quente tocado: fila | tutor (a busca) | migration
Rate limit: ok
Fila e prioridade: problema
Concorrência: corrida em techspec §5 "Fluxo", envio de edição
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: bloqueante
Métrica e alerta: faltando

Conferência por item:

- **Rate limit:** a spec garante. Os tetos são por pessoa e por escola, no `MaterialUploadGuard`, e valem para o envio e para a edição. Nada é por IP. Seção 7c.
- **Nada demorado em request:** a spec garante. A extração vai para o worker, e a fila em memória e o `varrerParados` saem.
- **Fila:** a extração vai para a fila `lote`, sem passar pela interativa. A vaga por escola e o alerta têm problema (bloqueante 5).
- **Gateway de IA:** não se aplica, a spec não traz chamada de modelo nova. `SEM_MATERIAL_DA_SERIE` responde antes de chamar o modelo.
- **Estado em memória:** a spec garante. Sai a `ExtractionQueue` em memória e os bytes vão para o storage.
- **Concorrência:** as corridas 1 a 4 da seção 7c estão garantidas. A corrida da edição contra a anterior que termina não está (bloqueante 3).
- **Índice:** a busca filtra por série e licença e todos os índices começam pela escola. A busca continua sendo texto completo pelo GIN `trecho_busca_idx`, e o alerta do pgvector em `docs/infra.md` §3.6 não se aplica. `/v1/licencas` é paginada.
- **Prova online:** não se aplica.
- **Migration:** veja o bloqueante 2.
- **Métrica e alerta:** veja o bloqueante 5.
- **Teste:** os testes das corridas estão declarados. O cenário de carga não tem critério de aprovação (bloqueante 4).

Bloqueantes:

1. **techspec §5 "Envio" e §7c "Quando cada dependência cai": o PDF fica órfão para sempre se o commit falha.**
   - A spec diz que o commit que falha "deixa órfão para a varredura", e isso é falso.
   - A varredura (45.0) só lê linhas de `material` com `objeto_apagado_em is null`, e o armazém não tem listagem. Com o rollback a linha não existe, então o objeto nunca é achado. Isso fura o RF13 ("apagado em todo caminho").
   - A chave do objeto depende do id do material, e hoje esse id é o `uuidv7()` do banco. Então o PUT de 20 MB acontece dentro da transação, segurando a trava de envios da escola (`pg_advisory_xact_lock`) e uma conexão do pool.
   - Correção exigida:
     - gerar o id na aplicação e fazer o PUT antes de abrir a transação, com prazo;
     - se a transação falhar, apagar o objeto no `catch`;
     - para o processo que morre entre o PUT e o commit, uma garantia que não depende da linha: regra de expiração do bucket no prefixo `material-temporario/` (MinIO e S3 aceitam) ou a linha gravada antes do PUT;
     - teste de integração: commit forçado a falhar depois do PUT deixa o objeto apagado, e fica vermelho sem o `catch`.

2. **techspec §3 "Migrations": a migration não é compatível com o código anterior (regra 80, item 9).**
   - O check novo (3), `(titularidade = 'terceiro_com_licenca') = (licenca_id is not null)`, entra junto com o código novo.
   - O código anterior grava material de terceiro só com `licenciante`. Com o check, um rollback quebra todo envio de terceiro. E um material gravado pelo código antigo entre o backfill (2) e o `VALIDATE` derruba o deploy.
   - No sentido oposto, o check atual `material_licenciante_so_de_terceiro` continua exigindo `licenciante` até a etapa (4). A spec tira `licenciante` da entrada da API e não diz que o código novo continua preenchendo a coluna.
   - Correção exigida:
     - o código novo grava `material.licenciante`, copiado da licença, até a etapa (4);
     - o check (3) vai para a tarefa de contração (4), depois de um release com o código novo;
     - a etapa (4) refaz, de forma idempotente, o backfill de licença e de `material_serie` para as linhas gravadas na janela, antes do `VALIDATE`;
     - teste que sobe o código anterior contra o schema novo e envia material de terceiro.

3. **techspec §5 "Fluxo" e §7c "Corridas", edição: o padrão "busca, verifica, grava" sem trava.**
   - O índice `material_uma_edicao_em_andamento` só segura duas edições que processam ao mesmo tempo.
   - Se a edição B (sobre A) termina no momento em que a coordenação envia a edição C ainda apontando para A, o service lê A sem exclusão e grava C com `substitui_id = A`.
   - Quando C termina, a substituição não pega linha, porque A já saiu. C fica pronta ao lado de B, e as duas edições ficam na busca. Isso fura o RF10.
   - Correção exigida:
     - na transação da edição, `select … from material where id = :antiga and excluido_em is null and estado = 'pronto' for update`, que serializa com o `update` da substituição;
     - cenário com `WriteBlockTrigger` segurando a substituição de B, vermelho sem o `for update`.

4. **techspec §7c "Limite por escola" e "Cenário de teste de carga": o RF15 fica sem prova.**
   - Com 30 envios por hora por pessoa e 40 materiais em processamento por escola, uma coordenadora leva 10 horas ou mais só para enviar as 300 apostilas. O "numa noite" do RF15 só passa se o cenário contornar o guard.
   - O cenário não tem critério de aprovação para a outra escola. O `docs/infra.md` §10 exige que "as outras escolas não piorem", e o cenário do expurgo traz o modelo: p95 do turno do Tutor da B até 500 ms acima da base, nenhum statement de 1,5 s ou mais, e controle negativo.
   - Com `naoUrgente: false`, a ingestão roda às 10h. Ela grava centenas de milhares de páginas no mesmo GIN `trecho_busca_idx` que a busca do Tutor de todas as escolas lê.
   - Correção exigida:
     - dimensionar os tetos para que as 300 apostilas caibam (teto por pessoa próprio para o onboarding, ou declarar quantas pessoas enviam e em quantas horas);
     - o cenário envia pela rota real, com o guard;
     - o cenário roda junto com o Tutor no pico, com limites numéricos para a escola B e para o tempo dos statements, e com o controle negativo.

5. **techspec §7c "Fila e prioridade", "Métrica e alerta" e §13: a vaga por escola não existe como está escrita, e o alerta dispara no fluxo normal.**
   - A vaga é por fila e escola (`vaga:{fila}:{escola}`, lote 2 por padrão), não por tipo. A "vaga por escola 1" não tem mecanismo, ou derruba também o expurgo e a eliminação da escola.
   - Com uma vaga por escola, a "réplica `worker-pdf`" do §13 não acelera a escola que está ingerindo.
   - O alerta `pdf-esperando` (10 min, herdado da 45.0) dispara em todo onboarding: o 40º PDF de uma escola espera de propósito 40 extrações. O runbook manda subir uma réplica, o que não resolve nada.
   - Correção exigida:
     - declarar o mecanismo e o número da vaga (configuração do lote da escola ou limite por tipo), e a alavanca real de vazão;
     - definir o alerta por parada real, por exemplo PDF pendente com a vaga da escola livre por N minutos, ou nenhuma extração concluída em X minutos com fila;
     - escrever o parágrafo do runbook coerente com isso.

Recomendações:

- Declarar `prazoMs` e tentativas do `material.extrair-pdf` e da varredura. `sem_texto` e `arquivo_invalido` devem ser falha definitiva, sem cinco retentativas que seguram a vaga.
- O `ops:reprocessar-job` não tem efeito no `material.extrair-pdf`: o objeto já foi apagado na falha final. Recusar o tipo, ou documentar, porque o RF13 promete reprocessar.
- A spec diz "a busca, uma só", mas existe também `paginasDoMaterial` (`trechos.doMaterial`, a página aberta no Tutor). Ela também precisa do filtro de série e de licença vigente.
- Medir a duração da busca no caminho do Tutor (`material.busca`) e contar as extrações por código de resultado.
- Escrever que a transição de estado é a primeira instrução da transação da extração. Assim o job duplicado não esbarra no `unique` dos capítulos antes de a transição decidir.
- Mandar `capitulos` só no `GET /:id`, não na listagem.
[… 8 linhas cortadas]

## test-engineer · 1ª rodada · REPROVADO · 2026-11-11 10:23:39 · `tasks/prd-ingestao-do-material/revisao-spec.md`

VEREDITO: REPROVADO

**Cenários exigidos** (os RF que ficam nesta spec depois do corte: RF3, RF4, RF7 só pela série, RF8, RF10, RF11, RF13, RF14, RF15 só o "prontas", RF16, RF17, RF18, RF20)

- Caminho feliz:
  - envio com séries;
  - extração no worker, com capítulos;
  - busca por série e por licença vigente;
  - edição nova que substitui a anterior;
  - licença registrada, vencida e renovada;
  - resumo da aba Material;
  - comandos da 46.0.
- Casos de borda do PRD que são desta spec:
  - apostila com duas séries;
  - material sem capítulo;
  - apostila em duas colunas;
  - edição nova enviada enquanto a anterior ainda processa;
  - licença que vence com um rascunho citando o material.
- Casos de borda do domínio:
  - virada do ano letivo, com a série da turma de 2027;
  - escola sem ano letivo em curso (onboarding em janeiro);
  - vínculo encerrado com outro aberto;
  - apostila com cabeçalho corrido "Capítulo N" em toda página;
  - página de sumário;
  - marcador de capítulo com título vazio ou longo demais;
  - PDF sem texto.
- Permissão:
  - professor e aluno barrados em edição, licenças e resumo;
  - a Operação Turmma não lê o texto do material.
- Isolamento: todas as rotas novas, o sino, o worker e a varredura.
- Concorrência:
  - duas edições ao mesmo tempo;
  - exclusão × extração;
  - exclusão da edição antiga × substituição;
  - job executado duas vezes;
  - envio × PATCH da licença;
  - arquivo repetido.

**Cobertos**

- **Isolamento (seção 6):** a lista está boa e diz "vermelho sem a cláusula de escopo".
- **Corrida (1), duas edições:** tem `WriteBlockTrigger` e a mutação de tirar o índice.
- **Corrida (2), exclusão da nova:** tem a mutação de tirar `excluido_em is null`.
- **`SEM_MATERIAL_DA_SERIE`:** testado "sem execução".
- **Capítulos:** testes de unidade para marcador, linha e nenhum, e amostra fixa a 100%.
- **Licença:** a virada do dia em São Paulo está prevista.
- **E2E:** edição e artefato antigo.
- **Onda 3b:** o desenho da 45.0 e da 46.0 entra por referência.
- **IA:** não há chamada de modelo nova, então o item 5 (adaptador falso) não se aplica.

**Bloqueantes**

1. **O envio deixa PDF órfão no storage, e nenhum teste pega isso** (seção 5, "Envio"; seção 7c).
   - Os bytes vão ao storage antes da transação.
   - Várias recusas acontecem depois disso e não gravam linha em `material`:
     - `CONFLITO` pelo índice `material_arquivo_na_escola_unico`, que é o arquivo repetido do RF14;
     - `LIMITE_EXCEDIDO`, que vem dos tetos conferidos dentro da transação;
     - `LICENCA_VENCIDA`, já que a licença é lida `for share` na transação;
     - a FK de série de outra escola;
     - `EDICAO_EM_ANDAMENTO`;
     - o commit que falha.
   - A seção 5 diz que esse órfão vai "para a varredura". Mas a varredura da 45.0 parte de linhas de `material` com `objeto_apagado_em is null`, e o armazém não tem listagem. O objeto nunca é encontrado, o que quebra o RF13 ("apagado em todo caminho").
   - Correção exigida:
     - apagar o objeto em toda saída de erro depois do `guardarBytes`, com um teste por caminho que confere o storage falso vazio (mutação: tirar o apagar do `catch`);
     - para a queda do processo entre o envio ao storage e o commit, uma regra de ciclo de vida no prefixo `material-temporario/`, ou a linha gravada antes dos bytes, declarada e com teste.

2. **O RF16 manda recusar "antes de abrir o arquivo", e o fluxo da seção 5 lê a licença depois de guardar os bytes.**
   - Hoje `MaterialService.enviar` recusa antes de ler qualquer byte, grava `material.recusado` e tem teste dessa ordem. A Tech Spec não preserva isso com o `licencaId`.
   - Correção exigida: uma pré-checagem da licença (existe, é da escola e está vigente hoje) antes do hash e do storage, também no `MaterialUploadGuard`. Teste com licença vencida, inexistente e de outra escola: nenhum envio ao storage, nenhum byte lido, `material.recusado` com o motivo. O `for share` continua dentro da transação.

3. **A corrida envio × PATCH da licença não tem cenário** (seção 7c, "Corridas").
   - O `for share` está no desenho e não tem teste que o prove.
   - Correção exigida: o envio parado depois da leitura da licença; um PATCH que encurta a vigência para ontem tem de esperar o envio terminar. A troca que deixa o teste vermelho é tirar o `for share`.

4. **As corridas (2) e (3) não dizem como a ordem é forçada, e a (3) não tem mutação** (seção 7c).
   - Na (2), a extração tem de parar entre `lerParaExtrair` e a transição: por exemplo, um `PdfExtractor` ou `LeitorDeCapitulos` falso que espera uma barreira. A exclusão faz commit nesse intervalo, e só então a extração segue.
   - Na (3), a exclusão da antiga precisa entrar antes do `update … substituido_por`. A asserção é que o `excluido_em` da exclusão continua igual e que não existe a auditoria `material.substituido`. A mutação é tirar o `excluido_em is null` do update da substituição.

5. **O job executado duas vezes, corrida (4), não confere o que é novo nesta spec.**
   - Correção exigida: dois jobs em `Promise.all` sobre uma edição com `substitui_id`. Capítulos gravados uma vez, `material.substituido` uma vez, os dois jobs terminam `concluido`, e nenhum termina `falhou` por violar o `unique (escola_id, material_id, ordem)`.
[… 98 linhas cortadas]

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-11 10:24:05 · `tasks/prd-ingestao-do-material/revisao-spec.md`

VEREDITO: REPROVADO
Escopo: respeitado. Cada RF desta spec tem lugar no desenho. Nada da F4b entrou: sem a tabela BNCC, sem classificação e sem chamada de modelo nova.
Aderência à Tech Spec: há divergência. A consequência do desvio da §11 (processador no `apps/worker`) não chegou à §2, e a §4 diverge do RF18 sem registrar.
Portão local: não se aplica, porque é revisão de spec e ainda não há código. O `conferir` responde "nunca passou nesta árvore", o que é o esperado.

**Bloqueantes:**

1. **§5 "Busca" e §6, RF7, RF8 e RF17: o filtro por série e por licença vigente só cobre a busca por texto.** O desenho põe os dois filtros em `MaterialRepository.buscar`. Dois outros caminhos de leitura ficam sem eles:
   - `TrechoSearch.doMaterial` → `MaterialRepository.paginasDoMaterial` (`apps/api/src/material/material.repository.ts:286`), que o Tutor usa para ler a página aberta (`apps/api/src/tutor/tutor.service.ts:286`);
   - `TutorDoAlunoRepository.materialDaTurma` (`apps/api/src/tutor/tutor.repository.ts:189`), que decide qual material o aluno pode abrir.

   Com isso, o aluno do 9º ano abre material que é só do 6º, e um material de licença vencida continua chegando ao Tutor pela página aberta.

   **Correção exigida:** a §5 lista os três caminhos com os dois filtros, e a §6 e a §10 ganham um caso para cada um.

2. **§5 "Envio" e §4 (`/edicoes`), RF16 e RF18: a licença é conferida tarde demais.** Pelo desenho, os bytes vão ao storage e só depois a transação lê a licença com `for share`. Isso causa três problemas:
   - a licença vencida, ou de outra escola, é recusada depois de o arquivo ter sido lido e guardado, contra o "recusado antes de abrir o arquivo" do RF16;
   - o `LICENCA_VENCIDA` lançado dentro da transação desfaz a auditoria `material.recusado`, e o `recusadosEm30Dias` do RF18 deixa de contar essa recusa;
   - o caminho da edição não diz que confere a licença.

   **Correção exigida:** a licença (vigente, da escola) é lida antes do arquivo, e a recusa grava `material.recusado` fora da transação que é desfeita, como o serviço faz hoje (`material.service.ts:120-133`). A transação reconfere com `for share`. O mesmo vale para a edição.

3. **§5 "Envio" e §7, RF13: o arquivo pode ficar no storage para sempre.** A Tech Spec diz que "commit que falha deixa órfão para a varredura". Só que a varredura da 45.0 (`onda-3b.md`, "A varredura do órfão") encontra o objeto pela linha de `material` com `objeto_apagado_em is null`. Quando o commit falha, não existe linha: o objeto nunca é apagado. Isso acontece em caminhos comuns:
   - `CONFLITO` pelo índice de `sha256`, que é o arquivo repetido do próprio teste do RF14;
   - `LIMITE_EXCEDIDO` dentro da transação;
   - `LICENCA_VENCIDA`.

   **Correção exigida:** apagar o objeto quando a transação falha e ter uma proteção que não dependa da linha. O padrão de mercado (D81) é uma regra de ciclo de vida do bucket no prefixo `material-temporario/`, que o MinIO e o S3 têm. A alternativa é gravar a linha antes dos bytes. A §7c e a tabela de estados passam a dizer qual das duas.

4. **§2: o worker não tem como gravar no banco do material.** A guarda `app-nao-importa-app` (`tools/guardas/camadas.test.ts:115`) proíbe o `apps/worker` de importar o `apps/api`. O processador precisa de várias operações do repository do material:
   - `lerParaExtrair` e as transições de estado com `processado_em`;
   - gravar os trechos e os capítulos, e fazer a substituição da edição;
   - gravar `objeto_apagado_em` e a leitura `@Unscoped` da varredura.

   A §2 só leva para `packages/core/src/material/` o `PdfExtractor`, os capítulos e a `chaveDoTemporario`. A 45.0 não precisava disso porque rodava dentro da API. Do jeito que está, quem implementar ou fura a guarda ou cria um segundo repository do material.

   **Correção exigida:** a §2 diz que o `MaterialRepository`, ou a parte de extração dele, vai para `packages/core/src/material/`, num repository só, usado pela API e pelo worker.

5. **§7c "Limite por escola" e "Cenário de teste de carga", RF15: com os tetos propostos, as 300 apostilas não ficam prontas numa noite.** Os tetos são 30 envios por pessoa por hora e 40 em processamento por escola. Com eles, uma coordenadora leva 10 horas só para enviar as 300. Além disso, o 41º envio é recusado até a extração liberar vaga, então ela teria de ficar reenviando a noite toda. O cenário de carga não diz como as 300 entram pela rota de verdade. O teto de 40 em processamento existia porque os bytes ficavam na memória da API. Agora eles ficam no storage, e quem protege as outras escolas é a vaga por escola na fila.

   **Correção exigida:** escolher tetos que deixem entrar 300 apostilas numa noite, ou registrar com o Joaquim que o RF15 supõe envio espalhado. O cenário de carga passa pelo envio real.

6. **§4 `GET /v1/materiais/resumo`, RF18: divergência não registrada.** O resumo conta `recusadosEm30Dias` só por disciplina, e o RF18 pede por disciplina e série.

   **Correção exigida:** as `serieIds` entram no `depois` da auditoria `material.recusado` e o resumo agrupa por elas, ou a divergência vai para a §11 com a palavra do Joaquim.

7. **§7c, "Corridas de concorrência" (1), caso de borda do PRD "Edição nova enviada enquanto a anterior ainda processa → recusada": a leitura literal não tem desenho.** O índice parcial só cobre duas edições novas sobre o mesmo material. Uma edição sobre um material que ainda está `processando` é aceita.

   **Correção exigida:** a edição só entra sobre material `pronto`, os outros recebem `EDICAO_EM_ANDAMENTO`, e o caso ganha teste. A alternativa é registrar a interpretação escolhida.

**Recomendações:**
- **Tamanho:** pelas minhas contas, a spec dá 14 ou 15 tarefas, acima das 12 do `criar-tasks`. Três cortes que ajudam:
  - a contração (passo 4 da §3, `material.licenciante` sai) vai para uma spec posterior. Ela precisa de um deploy entre a expansão e a contração (regra 80, item 9), e se as duas saírem no mesmo pouso o código anterior quebra;
  - a 46.0 fica pequena e sozinha;
  - o sino vai na tarefa da tela de Licenças.
- **D81:** a interface nova `LeitorDeCapitulos` (§12) deve ter nome em inglês, como `PdfOutlineReader` ou `ChapterReader`.
- **§2:** `apps/api/src/ops/` e `operacao/` já existem. A linha deve dizer "alterado".
- **§4 `/edicoes`:** dizer o que a nova edição herda da anterior (disciplina, séries, titularidade, `licencaId`) e se a coordenação pode trocar as séries.
- **§5 `SEM_MATERIAL_DA_SERIE`:** a ferramenta e o chat rodam depois do `202` (`ferramentas.service.ts:111-117`). Dizer se a recusa vem antes do `202`, sem execução nem orçamento gasto, ou como falha de execução, igual ao `MATERIAL_INSUFICIENTE`.
- **"Hoje em São Paulo" na busca:** deve vir do `Clock`, não do `current_date` da sessão do Postgres. Sem isso, o teste de relógio falso do RF17 não controla a data.
- **§4 envio:** dizer o que acontece com o `licenca` (enum) e o `declaracao` que existem hoje quando há `licencaId`.
- **RF14:** dizer onde o título é editável (no formulário antes de enviar, ou numa rota nova).
- **§9 sino:** dizer qual leitura alimenta o `licenca-vencendo`. O `docs/interface.md` diz que o sino da coordenação tem "cinco tipos, e só eles", e esse passa a ser o sexto.
- **Texto da nota de corte do PRD:** a nota encurtada ("o resto é desta spec") passou a trazer para esta spec a parte de classificação do RF20 e as perguntas da BNCC da seção 10, que a versão anterior mandava para a F4b. Vale devolver a precisão a um PRD já aprovado.
- **§7c "caminho quente":** a edição perdeu "e da ferramenta", mas o professor também espera a busca da ferramenta e do chat.
- **Réplica `worker-pdf`:** a 45.0 colocava o PDF numa réplica própria desde o início, e a §13 só a sobe se a medição passar da meta. O PDF agora divide a fila `lote` do `apps/worker` com os expurgos. É assunto do `infra-guardian`; vale deixar a escolha explícita.

O que já funciona bem:
- **Reaproveitamento:** usa o `JobOutbox`, o `FileStorage` (ganha `guardarBytes` e `lerBytes`), o `MaterialUploadGuard` e o `TrechoSearch`, sem uma segunda busca. O que falha nisso está nos bloqueantes 1 e 4.
- **D81:** o outbox, o índice único parcial para a corrida e o `getOutline` do pdfjs são padrão de mercado.
- **Tamanho dos documentos:** PRD e Tech Spec têm 1.998 palavras cada, abaixo do teto de 2.000.

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/prd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/apps/api/src/material/material.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/apps/api/src/material/trecho-search.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/apps/api/src/material/material.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/apps/api/src/tutor/tutor.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/apps/api/src/tutor/tutor.service.ts
[… 2 linhas cortadas]

## frontend-reviewer · 2ª rodada · AJUSTES NECESSÁRIOS · 2026-11-11 10:32:44 · `tasks/prd-ingestao-do-material/revisao-spec.md`

VEREDITO: AJUSTES NECESSÁRIOS
Tela vista: não. É revisão de spec e ainda não existe tela. Li a Tech Spec (seções 4, 7c e 9), o `cenarios.md` ("Telas") e o diff desde `cd925225`.
Estados: ok em parte. A seção 9 passou a exigir "quatro estados em cada peça nova, em `chromebook` e `celular`". O vazio da lista de licenças no envio e o aviso de séries atribuídas na migração aparecem em "Telas". Falta só o texto do 429 (bloqueante 1).
Acessibilidade: ok. "Telas" traz região `aria-live` no envio, foco devolvido ao fim, alvo de 44 px, situação da licença em texto e cor, e datas com rótulo.
Chromebook fraco: ok. A lista de materiais é paginada com "Mostrar mais", e a carga de 300 materiais sob throttling de rede e de CPU está no [E].
Celular: ok. O resumo vira lista a 360 px e a tabela fica no Chromebook.
Ação oficial protegida: sim. A saída da edição antiga está dita no diálogo de nova edição. O PATCH de licença mostra quantos materiais saem ou voltam da busca.

Itens da rodada 1:
- **429 e 503 na tela: atendido pela metade.**
  - O 503 tem texto: "O envio não foi concluído. Tente de novo em instantes."
  - O 429 tem comportamento (os pendentes ficam e aparece "Continuar às HH:MM" a partir do `Retry-After`), mas não tem o texto da mensagem que o explica.
- **Textos dos erros novos: atendido.** `EDICAO_EM_ANDAMENTO`, `LICENCA_VENCIDA` e `SEM_MATERIAL_DA_SERIE` têm texto com a ação. O do aluno também diz o que fazer.
- **`capitulos` só no `GET /:id`: atendido** (seção 4).
- **Lista de materiais paginada: atendido** (seção 4 e "Telas").
- **Limite de envio: atendido.** O teto subiu para 100 envios por pessoa e 300 por escola por hora (seção 7c). Os 300 PDFs do onboarding cabem em uma hora.
- **Recusados por série: atendido.** O resumo traz `recusados30Dias` por disciplina e série.
- **Sexto tipo do sino no `docs/interface.md`: atendido pela metade.**
  - A seção 9 manda atualizar "os cinco tipos" na tarefa do sino. O `docs/interface.md` ainda não mudou, o que é esperado em revisão de spec.
  - A seção 9 ainda não dá o destino do item (aba Licenças), nem diz que ele não leva número por licenciante ou por professor e que some quando a vigência é atualizada. Também não diz que a leitura de licenças entra sem polling.
  - O cenário do sino cobre só as datas do aviso (dias −31, −30, 0 e +1).

Bloqueantes:
1. **Seção 9 e `cenarios.md` "Telas" (texto do 429).**
   - Está errado: a mensagem que o usuário vê quando o limite de envio estoura não está escrita.
   - Correção exigida: escrever o texto, por exemplo "Muitos envios por agora. Os que faltam ficam aqui e continuam às HH:MM". Incluir esse texto no [U] da tela e no e2e.
2. **Seção 9 (item do sino).**
   - Está errado: falta o texto do item e o destino dele.
   - Correção exigida: dizer que o item leva à aba Licenças, que não traz número por licenciante nem por professor (regra 70, item 9), e que some quando a vigência é atualizada. Dizer também que a leitura de licenças entra no sino sem polling. Acrescentar um cenário [U] de "some depois do PATCH da vigência". Sem isso o sexto tipo contradiz o `docs/interface.md` ("cinco tipos, e só eles") sem uma definição que o substitua.

Recomendações:
- O texto do 429 também pode dizer quantos arquivos já foram enviados ("12 de 20 enviados").
- Dizer como o resumo mostra a série com `semSerie` a 360 px.
- Os cenários de "Telas" não nomeiam o estado de erro da lista de licenças nem o do resumo. Basta uma linha.

Nenhuma correção abriu problema novo que eu veja.

## tenancy-guardian · 2ª rodada · REPROVADO · 2026-11-11 10:33:52 · `tasks/prd-ingestao-do-material/revisao-spec.md`

VEREDITO: REPROVADO

Tabelas verificadas: `licenca_de_material` (com `unique (escola_id, id)` e FK composta de `registrada_por` em `set null`), `material_serie`, `capitulo_do_material`, `material` (colunas novas `edicao`, `substitui_id`, `substituido_por`, `licenca_id`, `processado_em`, `objeto_apagado_em` e o índice parcial `material_uma_edicao_em_andamento`), o índice de `auditoria` para `material.recusado`, e o backfill por `(escola_id, licenciante)`.

Queries verificadas: as conferências de envio e de edição antes de ler o arquivo; a licença `for share`; o alvo da edição `for update` e a leitura que separa `EDICAO_EM_ANDAMENTO` de `NAO_ENCONTRADO`; a transição e a substituição no worker; `lerParaExtrair` no repository do `packages/core`; `buscar`, `paginasDoMaterial`, `materialDaTurma`, `GET /v1/materiais/busca` com `serieId` e `existeMaterialDaSerie`; o resumo (material e auditoria); a lista de licenças e o sino; o `PATCH` de material e o de licença; as `fontes`; a licença no expurgo; os `@Unscoped` da 45.0 e da 46.0.

Teste de isolamento: presente e efetivo, exceto nos dois casos dos bloqueantes abaixo.

**Rodada 1, item a item**

- **Meu bloqueante (série de outra escola no envio): atendido.** A §4 diz que série de outra escola responde `NAO_ENCONTRADO`, igual à inexistente. A §5 (1) confere a série antes de ler o arquivo. Os cenários cobrem nas seções "Envio" e "Isolamento", com a asserção de que nada é gravado.
- **Minhas recomendações: atendidas.** A substituição leva `escola_id = :escola` (§5 Extração). O backfill agrupa por `(escola_id, licenciante)` e tem teste na seção "Migração". O resumo conta recusas da escola B (seção "Isolamento"). `GET /materiais?serieId=<da B>` responde igual à série inexistente. O texto dos `@Unscoped` foi ajustado (§6).

**As correções dos outros revisores e o isolamento**

- **Licença com FK composta: garantido** (§3), com teste de retenção cobrindo "a da escola B fica" e `registrada_por` nulo.
- **Repository da extração no `packages/core`: garantido.** O escopo vem de `job_registro.escola_id` (§6). A guarda `tools/guardas/escopo-dos-repositories.ts` já lê `packages/core`. Há o cenário "`lerParaExtrair` com id da B no contexto A".
- **Leitura por série nos quatro chamadores: garantido** (§5 Leitura de página), com cenário por chamador e "busca e página aberta da A com a série da B, vazias". O `serieId` que o cliente manda na rota de busca só filtra dentro da escola do contexto. Não serve de autorização.
- **Resumo e sino: garantidos** (seção "Isolamento").
- **`for update` da edição: abriu problema novo.** Ver o bloqueante 1.

**Bloqueantes**

1. **Tech Spec §5 "Envio e edição", passos (1) e (3), e `cenarios.md` "Isolamento".**
   - O que está errado:
     - A consulta do alvo está escrita sem escopo: `where id = :alvo and estado = 'pronto' and excluido_em is null for update`. A §6 só obriga o escopo em `update` e `delete`, então esse `select` fica de fora.
     - Duas leituras novas do alvo podem revelar que um material de outra escola existe. Uma é a que separa `EDICAO_EM_ANDAMENTO` de `NAO_ENCONTRADO`. A outra é a do passo (1), que pega a licença herdada para responder `LICENCA_VENCIDA` antes de ler o arquivo.
     - Se qualquer uma rodar sem escopo, um material da B em `processando` responde `EDICAO_EM_ANDAMENTO`, e um da B com licença vencida responde `LICENCA_VENCIDA`. O inexistente responde `NAO_ENCONTRADO`.
     - O cenário "edição sobre material da B" não diz o estado do material da B. Feito com um material `pronto` e com licença vigente, ele passa mesmo com essas duas leituras sem escopo, porque o `for update` com escopo devolve `NAO_ENCONTRADO` antes.
   - Correção exigida:
     - Escrever `escola_id = <escola do contexto>` na leitura do alvo do passo (1), no `select … for update` e na leitura que distingue `processando`.
     - Dizer que o alvo fora do escopo responde `NAO_ENCONTRADO` antes de qualquer outra conferência (licença, estado).
     - Em "Isolamento", acrescentar: "edição da A sobre material da B em `processando` e sobre material da B com licença vencida: `NAO_ENCONTRADO`, igual ao inexistente, nenhum byte lido".

2. **`cenarios.md` "Isolamento" e "Envio" (o `PATCH /v1/materiais/:id` com `serieIds`).**
   - O que está errado:
     - A §4 garante `NAO_ENCONTRADO` para `serieIds` de outra escola em qualquer rota, mas só existe teste no envio.
     - No `PATCH`, uma conferência de série sem escopo deixaria passar a série da B, e a FK composta estouraria com 500. A série inexistente responde `NAO_ENCONTRADO`, e essa diferença revela que a série existe (regra 10.6). Nenhum cenário quebra por isso.
   - Correção exigida: acrescentar em "Isolamento": "`PATCH` de material da A com `serieIds` da B: `NAO_ENCONTRADO`, igual à série inexistente, e as séries do material não mudam".

**Recomendações**

- **§4, rota `GET /v1/materiais/busca`:** dizer que o `serieId` é filtro e que o alcance do professor continua pelas disciplinas do vínculo. Assim a tarefa não o trata como autorização.
- **§6:** trocar "Todo `update` e `delete` leva `escola_id`" por "toda consulta, inclusive `select … for update` e `for share`". Isso fecha o bloqueante 1 também no texto geral.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/prd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/revisao-spec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/achados/revisao-spec.md

## conformidade-reviewer · 2ª rodada · REPROVADO · 2026-11-11 10:34:13 · `tasks/prd-ingestao-do-material/revisao-spec.md`

VEREDITO: REPROVADO

**Os três bloqueantes da rodada 1**

1. **Ordem da checagem nova em relação à D36: atendido.**
   - A seção 5 ("Leitura de página") manda o Tutor conferir `existeMaterialDaSerie` depois do encaminhamento de assunto delicado ("D36, intacto") e antes de aceitar a pergunta.
   - O `cenarios.md` ("Leitura de página por série") traz o teste com gatilho em turma sem material da série. Ele espera a mensagem fixa e o `atencao_humana`, com a mutação que põe a checagem antes.
   - A checagem roda só antes do `202`. Por isso não alcança a saída `assunto_delicado` do modelo.

2. **Nenhuma troca invisível ao professor: atendido, pelo caminho (a).**
   - A seção 5 diz: recusa, nada entra na conversa, e a tela do aluno mostra um estado em vez de uma fala do Tutor.
   - O `cenarios.md` prova isso: nada em `mensagem_tutor`, no uso nem na sala.
   - O texto do estado está em "Telas".

3. **Modo livre: atendido.** A seção 5 diz "O modo livre não muda", e o `cenarios.md` tem o teste dele. É coerente com o código: sem atividade nem material não há disciplina nem trecho (`tutor.service.ts`, `#trechosDoTurno`). Nenhum material de outra série chega ao modelo por esse caminho.

**Problema novo aberto pelas correções**

A correção que leva o filtro de série e de licença para `materialDaTurma` (seção 5, "Leitura de página") reabre a ordem da D36 por outro caminho.

- No `TutorService.enviar`, o `#alcance` roda antes do `ehAssuntoDelicado`. Ele chama `materialDaTurma` e devolve `NAO_ENCONTRADO` se o material não está mais ao alcance.
- Até hoje isso só acontecia quando a coordenação excluía o material. Com esta spec, o material sai do alcance por fluxo normal:
  - toda edição nova que fica pronta exclui a anterior;
  - a licença vence à meia-noite;
  - a coordenação corrige as séries que a migração atribuiu (o risco da seção 13).
- Resultado: o aluno com uma página aberta que escreve sobre risco à vida recebe "não encontrado" no lugar do 188, e o professor não recebe o `atencao_humana`.
- A frase da seção 7b, "a D36 vem antes da checagem nova", vale só para `existeMaterialDaSerie`, não para esse filtro. É o mesmo bloqueante 1 da rodada 1, por outra porta.

**Os outros itens da lista, conferidos no diff**

- **Item 3:** não há saída de IA nova (seção 8). As `fontes` com "material da escola" depois do expurgo (seções 4 e 11, RF11) mantêm a consulta "o que a IA gerou". O artefato continua com o conteúdo gravado.
- **Item 6:** a seção 7 traz as ações novas na auditoria. A `licenca.*` vai sem licenciante e o `material.recusado` ganha as séries.
- **Itens 7 e 9:**
  - O resumo e o `recusados30Dias` são contagem por disciplina e série, sem pessoa.
  - A recusa `SEM_MATERIAL_DA_SERIE` no chat do professor não grava execução nem auditoria nominal, então nada da conversa dele chega à coordenação.
  - A `registrada_por` da licença é de coordenador.
- **Item 8 (D46 e D55):** não se aplica. Não há nota nem conceito, e a habilidade fica na F4b.
- **Comandos da 46.0:** o teste de que recusam `ia.*` e `titular.*` agora está citado com a mutação (`cenarios.md`, "Extração no worker").

---

Caminhos de escrita em Nota: nenhum. O job `material.extrair-pdf` grava só material, trechos, capítulos e a substituição (seções 3 e 5). Todos com autor humano? Não se aplica.

Decisão autônoma sobre aluno: ausente.

Aprovação registrada: ok.

Supervisão do tutor: lacuna em "Leitura de página" (seção 5). O filtro novo em `materialDaTurma` roda antes do encaminhamento da D36, pelo `#alcance`.

Autonomia declarada e visível: sim. Não há agente novo nem mudança de nível.

Bloqueantes:

1. **Seção 5, "Leitura de página", e seção 7b. O filtro de série, de licença e de substituição em `materialDaTurma` passa na frente da D36.**
   - **O que está errado:** a pergunta com `materialId` de um material que saiu do alcance responde `NAO_ENCONTRADO` antes do `ehAssuntoDelicado` (ordem em `apps/api/src/tutor/tutor.service.ts`, `enviar`: `#alcance` primeiro). Toda edição substituída, licença vencida ou série corrigida vira um caminho em que o aluno não recebe o 188 e o professor não recebe o sinal.
   - **Correção exigida na seção 5:** escrever que, no Tutor, material que saiu do alcance por série, licença ou substituição não impede o encaminhamento da D36. Por exemplo: o `ehAssuntoDelicado` roda com o alcance da turma e da atividade, antes do filtro do material, e o `#encaminhar` continua gravando `materialId` nulo, como hoje. A frase da seção 7b passa a cobrir esse filtro.
   - **Correção exigida no `cenarios.md`, "Leitura de página por série":** dois testes.
     - Aluno com a página aberta de uma edição já substituída e, num segundo caso, de material com licença vencida, mandando texto com gatilho: a mensagem fixa da D36 e o `atencao_humana`. A mutação é o filtro do material antes do encaminhamento.
     - O mesmo aluno com texto comum: recusa, nada em `mensagem_tutor`.

Recomendações:
- **Seção 5:** dizer de onde vem a disciplina da checagem do Tutor. Com atividade, é a dela. Com material, o `#alcance` já filtra. Também dizer que a checagem não se repete depois do `202`; se um dia se repetir, a saída `assunto_delicado` do modelo fica de fora, como na pausa de avaliação.
- **PRD, RF8:** o texto diz "o Tutor diz que não há material da turma". A spec escolheu um estado da tela, não uma fala do Tutor, que é a escolha mais segura. Vale alinhar o RF8 para não ser lido como fala da IA.
- **Tela do aluno:** o estado `SEM_MATERIAL_DA_SERIE` aparece sem o avatar do Tutor e entra no mapa de pausas (`apps/web/src/areas/aluno/tutor.ts`, `pausaDoErro`), como as pausas de hoje.
- **Supervisão:** a recusa por falta de material da série não chega a ninguém da escola além do aviso ao aluno. Uma contagem por turma, sem conteúdo nem nome, no resumo da coordenação evitaria uma turma sem Tutor útil sem ninguém saber. Isto vem da rodada 1 e segue em aberto.
- **`docs/regulacao.md`, seção 5:** "a autorização fica registrada no sistema" pode apontar para `licenca_de_material`. Também vem da rodada 1 e segue em aberto.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/prd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/achados/revisao-spec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/apps/api/src/tutor/tutor.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/apps/api/src/tutor/tutor.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/apps/web/src/areas/aluno/tutor.ts

## privacy-guardian · 2ª rodada · REPROVADO · 2026-11-11 10:35:14 · `tasks/prd-ingestao-do-material/revisao-spec.md`

VEREDITO: **REPROVADO**

Os três bloqueantes da rodada 1 foram atendidos. Duas das correções abriram dois furos novos, ambos no ciclo de vida.

**Os bloqueantes da rodada 1, item a item**

| Item | Situação | Onde |
|---|---|---|
| 1. Retenção, classificação e saída da licença | Atendido em parte. Agora há regra de saída, classificação, módulo no expurgo e cenário. Mas a regra, do jeito que está escrita, trava o expurgo (bloqueante novo 1) | §3 "Retenção", §2 `packages/core/src/retencao/`, §7, cenarios.md "Licença" |
| 1. `registrada_por` com set null | Garantido. A FK `(escola_id, registrada_por) on delete set null ("registrada_por")` está escrita, e há cenário "coordenador eliminado deixa `registrada_por` nulo" | §3, cenarios.md "Licença" |
| 1. Arquivo do titular | Garantido. A licença entra no arquivo do coordenador que a registrou, com `licenciante` e `referencia` em `fora`. Para as colunas novas de `material`, "em `colunas` ou `fora`" basta, porque o teste de arquitetura já obriga a dar destino a cada coluna (`apps/api/test/architecture.test.ts:1245` e `:1298`, `packages/core/src/titular/leitura-do-titular.test.ts:75`) | §7 |
| 2. FK de `substitui_id` travando o expurgo | Garantido. `substitui_id` e `substituido_por` levam `on delete set null` só na coluna, e há cenário: a antiga sai, a nova fica com o campo nulo, e as `fontes` dizem "material da escola" | §3, cenarios.md "Edição nova" |
| 3. `serieIds` de outra escola | Garantido. A série de outra escola recebe `NAO_ENCONTRADO`, igual à inexistente, conferida antes de ler o arquivo. O cenário compara as duas respostas, sem nada no storage | §4, §5 "Envio" (1), cenarios.md "Envio" e "Isolamento" |
| PDF temporário com expiração no bucket | O mecanismo está garantido. Mas o prefixo fica implícito (vem da `chaveDoTemporario` da onda 3b), e nenhum cenário prova que a regra existe (bloqueante novo 2) | §2 `infra/`, §5 "Envio" (2) e (4), §7, §11 |

**O resto da lista de verificação**

| Item | Situação | Onde |
|---|---|---|
| Campo de aluno, proibido ou não | Não se aplica: a spec não cria campo de aluno | §3 |
| Adaptação em vez de diagnóstico | Não se aplica | — |
| DTO | Garantido. O licenciante só vai à coordenação; nunca hash, chave de objeto nem quem enviou; há cenário no `contracts.test` | §4, §7, cenarios.md "Permissão" |
| Não encontrado igual a sem permissão | Garantido para licença, edição, `serieIds` e `serieId` no `GET` | §4, cenarios.md "Isolamento" |
| Bucket privado | Garantido, herdado da 45.0: `guardarBytes` e `lerBytes` sem URL nem listagem | §1, §11 |
| Convite e exportação | Não se aplicam | — |
| Erro tipado | Garantido. O 503 tem texto curto; os erros novos têm código | §4, cenarios.md "Telas" |
| Log | Garantido. Entraram nome do arquivo e título na lista do que não vai a log (recomendação da rodada 1) | §7 |
| Auditoria | Garantida. `licenca.*` sem licenciante, cobertura nem referência, com cenário de sentinela (recomendação da rodada 1). `material.atualizado` é novo; `material.recusado` passa a levar só ids | §7, cenarios.md "Licença" |
| IA | Não se aplica: nenhuma chamada nova. Na recusa por falta de material da série, o Tutor não guarda a pergunta em `mensagem_tutor`, nem no uso, nem na sala; isso minimiza dado de aluno | §5 "Leitura de página", §8, cenarios.md "Leitura" |
| Conversa do Tutor fora do alcance da rede | Não muda | — |
| Seed | Sintético (`tools/demonstracao`) | cenarios.md "Extração" |
| Pergunta de fechamento | Responde. A spec não grava dado de aluno novo, e a recusa do Tutor não deixa rastro de conteúdo. A licença entra no arquivo do coordenador | §5, §7 |

```
VEREDITO: REPROVADO
Campos pessoais tocados: licenca_de_material.licenciante (pode ser pessoa; copiado do material no backfill),
  licenca_de_material.registrada_por (coordenador); autor nas ações novas da auditoria. Nenhum campo de aluno.
Fora da tabela de dados do docs/lgpd.md: nenhum. A §7 manda atualizar a licença, o PDF temporário e as ações novas.
Autorização por objeto: ok (licença, edição, PATCH, resumo, fontes, serieIds e serieId da outra escola iguais ao
  inexistente).
Logs: limpos (§7: ids, códigos, contagens, duração; nunca título, nome do arquivo, licenciante nem texto).
Auditoria: presente (licenca.registrada e .alterada sem texto livre, material.edicao_enviada, .substituido,
  .atualizado, .recusado com serieIds, job.*).
Envio externo: nenhum (§7, §8).
Seed/fixture: sintético.
Bloqueantes:
  1. §3 "Retenção" (problema novo): a licença sai "contada do mais tardio entre vigente_ate e a exclusão do último
     material que a cita". Mas a linha do material excluído pode ficar depois do prazo, enquanto uma mensagem ou um
     sinal do Tutor ainda a cita (expurgo-da-escola.repository.ts:282-288; docs/lgpd.md, linha do material). A FK
     (escola_id, licenca_id) do material não tem ação. Escrita como regra de datas, a saída da licença tenta apagar
     uma licença que uma linha de material ainda referencia. A FK aborta a instrução, a categoria material_excluido
     fica `false` toda noite, e o alerta de duas noites dispara. É o mesmo furo do bloqueante 2 da rodada 1, do outro
     lado da FK.
     Correção exigida: escrever que a licença só sai com `not exists (select 1 from material where escola_id = :e
     and licenca_id = l.id)`, contando a linha excluída que o Tutor ainda segura e a `falhou`, além do prazo sobre
     vigente_ate. O passo da licença roda depois do `material` em ALVOS_DO_EXPURGO_DA_ESCOLA.material_excluido.
     Cenário em cenarios.md "Licença": material excluído além do prazo e citado por mensagem_tutor; a licença fica
     e a categoria termina `concluida`. Na noite em que a conversa sai, os dois saem.
  2. §5 "Envio" (4) e §2 `infra/` (problema novo da correção do órfão): a expiração do bucket passou a ser o único
     caminho que apaga o PDF da queda entre o storage e o commit, porque esse PDF não tem linha para a varredura
     achar. Mas a spec não diz o prefixo, e nenhum cenário prova que a regra existe. Além disso, com versionamento
     ligado a expiração só cria um marcador, e o PDF continua no bucket. A spec afirma "sem versionamento" (§7) como
     fato, e a onda 3b diz que isso ainda se confere no staging.
     Correção exigida: nomear a regra na §5, prefixo `material-temporario/` (a chave da 45.0) e 2 dias (a expiração
     de S3 conta em dias). Acrescentar a cenarios.md um teste [I] contra o MinIO do compose: a configuração de ciclo
     de vida tem essa regra, nenhuma outra regra pega outro prefixo, e o versionamento está desligado. O mesmo teste
     roda, ou é citado, no provisionamento de produção.
Recomendações:
  - §3 e docs/lgpd.md: a licença sem `vigente_ate` e sem material nunca sai. As do backfill nascem assim, e o
    licenciante, que antes saía com o material, passa a ficar para sempre. A linha do lgpd.md deve dizer que a
    licença sem fim fica até a coordenação encerrar a vigência. A tela de Licenças deve destacar as "registradas
    antes da F4" para revisão.
  - §9: o aviso `licenca-vencendo` do sino leva só o licencaId e a data, não o licenciante (repetida da rodada 1).
  - cenarios.md "Telas" e "Extração": dizer que a licença da seed e do e2e usa licenciante fictício (repetida da
    rodada 1).
  - O PRD, na tabela de dados, ainda diz "enquanto a licença ou um material dela existir". Vale alinhar ao texto da
    §3 depois do bloqueante 1.
```

Arquivos de referência:
[… 5 linhas cortadas]

## revisor-geral · 2ª rodada · REPROVADO · 2026-11-11 10:35:57 · `tasks/prd-ingestao-do-material/revisao-spec.md`

VEREDITO: REPROVADO
Escopo: respeitado. Nada da F4b entrou: sem tabela BNCC, sem classificação, sem chamada de modelo. A contração foi para a abertura da F4b (`tasks/prd-classificacao-bncc/abertura.md`, item 4).
Aderência à Tech Spec: divergência no prazo do PDF órfão. A Tech Spec diz 48 h e o PRD diz 25 h, e a §11 não registra a diferença.
Portão local: não se aplica, porque é revisão de spec e não há código. O `conferir` responde "nunca passou nesta árvore", o que é o esperado.

**Os meus bloqueantes da rodada 1, item a item**

| # | Item | Situação | Onde |
|---|---|---|---|
| 1 | Filtro de série e licença em todo caminho de leitura de página | Garantido. Os quatro caminhos estão listados: `buscar`, `paginasDoMaterial`, `materialDaTurma` e a rota `GET /v1/materiais/busca` com `serieId`. O "hoje" vem do `Clock`, `vigente_desde` entra no filtro e há um cenário para cada chamador. Conferi no código: são os únicos leitores de página (`trecho-search.ts`, `tutor.repository.ts:189`). | Tech Spec §5 "Leitura de página"; cenarios.md "Leitura de página por série" |
| 2 | Licença conferida antes de ler o arquivo | Garantido no envio e na edição. A recusa grava `material.recusado` fora da transação, e a transação reconfere com `for share`. | Tech Spec §5 "Envio e edição" (1) e (3); cenarios.md "Envio…" e "Edição nova" |
| 3 | PDF órfão no storage | O mecanismo está garantido: id gerado na aplicação, objeto apagado no `catch` e expiração do bucket. Falta registrar o prazo novo (bloqueante abaixo). | Tech Spec §5 (2) e (4) |
| 4 | Repository da extração no `packages/core` | Garantido, usado pela API e pelo worker. | Tech Spec §2 |
| 5 | Tetos e carga | Garantido. Com 100 envios por hora por pessoa e 300 por escola, as 300 apostilas entram em 3 h. A vaga é por fila (`VAGAS_ESCOLA_PDF`) e a carga passa pela rota real, com o guard e o controle negativo. | Tech Spec §7c; cenarios.md "Carga" |
| 6 | `recusados30Dias` por série | Garantido. As `serieIds` entram na auditoria `material.recusado`. | Tech Spec §4 resumo, §7 auditoria |
| 7 | Edição sobre material que não está `pronto` | Garantido. O alvo é lido com `estado = 'pronto' ... for update`, e as duas corridas têm mutação. | Tech Spec §5 (3); cenarios.md "Corridas" |
| rec. | Nota do corte no PRD | Atendida. A classificação do RF20 e as perguntas da BNCC voltaram para a F4b. | PRD, nota do corte |
| rec. | `ChapterReader` | Atendida. | Tech Spec §2, §5 "Capítulos" |

As outras recomendações também foram atendidas: o que a edição herda, `SEM_MATERIAL_DA_SERIE` antes do `202`, o sexto tipo do sino, o `worker-pdf` explícito e `ops` como "alterado".

**Bloqueantes:**

1. **Tech Spec §5 "Envio e edição" (4) e §7, linha "Retenção e expurgo": prazo do órfão de 48 h contra os 25 h do PRD, sem registro.**
   - **O que está errado:**
     - O RF13 diz "queda, em até 25 h". A §8 do PRD diz "até a extração, ou 25 h no órfão", e a `onda-3b.md` (linha 110) leva os mesmos 25 h para o `docs/lgpd.md`.
     - A Tech Spec troca por 48 h no caso em que a linha não chegou a nascer. A linha da 45.0 na §11 só diz "expiração do bucket no lugar de parte da varredura" e não fala do prazo.
     - É divergência de requisito decidida em silêncio. Ela também muda a retenção que vai para o `docs/lgpd.md`.
     - A expiração apaga por idade, sem olhar o estado da linha. Um material ainda `processando` depois de 48 h (`worker-pdf` fora num fim de semana) perde o objeto. Não está escrito o que a extração faz quando o `lerBytes` não acha nada: falha definitiva, com que código, ou cinco tentativas inúteis. Nenhum cenário prova esse caminho.
   - **Correção exigida:**
     - Registrar na §11 o prazo: 25 h pela varredura quando a linha existe, 48 h pela expiração quando a linha não nasceu. Ajustar o RF13 e a §8 do PRD com a palavra do Joaquim, ou escolher um mecanismo que cumpra os 25 h.
     - Dizer na §5 "Extração" que objeto ausente é falha definitiva, com código próprio, e dizer na tabela de estados o que isso causa.
     - Pôr em `cenarios.md` um caso de objeto expirado antes da extração.

**Recomendações:**
- **PATCH de séries e o RF6.** O `PATCH /v1/materiais/:id` com `serieIds` (§4) é a parte "corrige série" do RF6. A nota do corte manda o RF6 inteiro para a F4b, enquanto o PRD da F4b diz que "série" é da F4. Vale uma linha na §11 ou na nota do corte dizendo que a correção de série fica na F4, porque o backfill precisa dela.
- **PATCH durante uma edição.** Dizer o que o `PATCH` faz sobre material substituído, excluído ou com edição `processando`. A nova edição herdou as séries no envio e perde a correção feita na antiga enquanto processa.
- **Trava de envios na Tech Spec.** A mutação da corrida 1 em `cenarios.md` cita a "checagem sob a trava de envios", que a §5 (3) não descreve. Escrever na §5 que a trava `travarEnviosDaEscola` continua e o que se confere sob ela, ou trocar a mutação.
- **Séries não validadas na auditoria.** Em §5 (1), validar as séries antes de gravar `serieIds` em `material.recusado`. Do contrário, a auditoria da escola A pode receber id de série da B, vindo do cliente.
- **Recusa reconferida dentro da transação.** Dizer se o `LICENCA_VENCIDA` reconferido na transação (§5, passo 3) também grava `material.recusado` fora dela. Sem isso, a contagem do RF18 perde essa recusa.
- **Licença sem fim.** Na §3, dizer que a licença sem fim (inclusive as do backfill) só começa a contar o prazo depois que a coordenação põe uma data de fim. Hoje fica implícito, e o licenciante pode ser pessoa.
- **`licenca` e `declaracao`.** Ainda falta dizer o que acontece com os campos `licenca` (enum) e `declaracao` de hoje quando o envio traz `licencaId` (pendente da rodada 1).
- **Linha "Reprocessar" da onda 3b.** Em `cenarios.md`, dizer com qual tipo de job essa linha é testada, já que `ops:reprocessar-job` agora recusa `material.extrair-pdf`.
- **PRD aprovado editado.** O PRD foi encurtado depois da aprovação para caber no teto de palavras. Saiu, por exemplo, "a citação continua pela página" da seção 10. A Tech Spec §1 mantém essa decisão, mas vale registrar no `estado.md` que o texto aprovado mudou só na forma.
- **Chat sem material.** A §5 bloqueia o chat do Assistente sem material da série, enquanto o RF8 fala só de "ferramenta". O caminho é coerente com a D18, mas vale uma linha dizendo que vale para o chat também.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/prd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-classificacao-bncc/prd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-classificacao-bncc/abertura.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-reengenharia/onda-3b.md

## test-engineer · 2ª rodada · REPROVADO · 2026-11-11 10:36:15 · `tasks/prd-ingestao-do-material/revisao-spec.md`

VEREDITO: REPROVADO

**Cenários exigidos:** os mesmos da rodada 1 (caminho feliz, bordas do PRD e do domínio, permissão, isolamento, concorrência). A correção trouxe partes novas, e cada uma pede cenário: a rota `PATCH /v1/materiais/:id`, a fila `pdf` com vaga por escola, a expiração do bucket e os estados e textos das telas.

**Cobertos:** os 18 bloqueantes da rodada 1, um a um. O texto inteiro do meu bloco da rodada 1 foi tirado da transcrição, porque o arquivo `achados/revisao-spec.md` corta 98 linhas dele.

| R1 | Situação | Onde |
|---|---|---|
| 1. PDF órfão | **Em parte.** O `catch` foi feito: cada saída tem teste e mutação. A queda entre o envio ao storage e o commit ficou sem teste e passou a contradizer o RF13 (bloqueante 1 abaixo) | TS §5 Envio (2) e (4); cenarios "Envio" |
| 2. Licença antes de ler o arquivo | atendido, no envio e na edição | TS §5 (1); cenarios "Envio" e "Edição nova" |
| 3. Envio × PATCH da licença | atendido, com a mutação de tirar o `for share` | cenarios "Corridas" |
| 4. Corridas (2) e (3), ordem e mutação | atendido | cenarios "Corridas" |
| 5. Job executado duas vezes | atendido (capítulos, `material.substituido` e os dois `concluido`) | cenarios "Corridas" |
| 6. Edição enquanto a anterior processa, e herança | atendido | TS §5 (3); cenarios "Edição nova" |
| 7. Capítulos | atendido. A amostra fixa usa o pdfjs de verdade, com destino nomeado, cabeçalho corrido e sumário | TS §5 Capítulos; cenarios "Extração" |
| 8. Teste por chamador e `existeMaterialDaSerie` | atendido, e também para `paginasDoMaterial`, `materialDaTurma` e a rota `/busca` | cenarios "Leitura de página" |
| 9. Virada do dia, UTC contra São Paulo | atendido, com o `Clock`, e `vigente_desde` também | TS §5; cenarios "Licença" |
| 10. Rascunho com a licença vencida | atendido | cenarios "Licença" |
| 11. Resumo | atendido | cenarios "Resumo" |
| 12. Backfill | atendido. O `VALIDATE` foi para a F4b, então não se aplica mais | cenarios "Migração" |
| 13. Sem ano letivo, vínculo encerrado, virada do ano | atendido | cenarios "Permissão…" e "Leitura de página" |
| 14. Permissão | atendido, com o código declarado pela regra objeto ou coleção | cenarios "Permissão…" |
| 15. RF14 na tela | atendido | cenarios "Envio" [U] |
| 16. Limites contra o RF15, e critério da carga | atendido: 100 por hora por pessoa, rota real, limites numéricos e controle negativo | TS §7c; cenarios "Carga" |
| 17. Onda 3b linha a linha, e reprocessar o PDF | atendido | cenarios "Extração" |
| 18. `serieIds` repetidas, e duas séries | atendido | cenarios "Envio" |

Também ficaram cobertos os itens dos outros revisores que pedem teste:
- a ordem da D36, com mutação;
- a recusa do Tutor sem troca invisível ao professor;
- a retenção da licença;
- a FK `set null` no expurgo;
- `serieIds` e `licencaId` da escola B respondendo igual ao inexistente.

**Bloqueantes:**

1. **TS §5 Envio (4), §7 "Retenção e expurgo" e §11, contra o RF13 e o PRD §8: a queda entre o envio ao storage e o commit fica sem prova, e o prazo diverge do PRD.**
   - O RF13 diz "queda, em até 25 h", e o PRD §8 diz "25 h no órfão". A Tech Spec diz 48 h, e o §11 registra só "expiração do bucket no lugar de parte da varredura", sem o prazo.
   - Hoje não há regra de expiração em `infra/`, e nenhum cenário prova a nova. Ela é a única defesa desse caminho.
   - Correção exigida:
     - registrar no §11 a troca de 25 h por 48 h, com a palavra do Joaquim, e levá-la ao PRD §8 e ao `docs/lgpd.md`;
     - um teste [U] que liga a regra de expiração declarada (compose e produção) ao prefixo devolvido por `chaveDoTemporario` e ao prazo. Mutação: mudar o prefixo da chave ou o da regra.

2. **TS §4 `PATCH /v1/materiais/:id` (rota nova): `serieIds` sem cenário de isolamento nem de validação.**
   - Nos cenários, o caso da série da escola B só aparece no envio ("Isolamento"). No `PATCH`, uma série da B só pararia na FK composta, e sairia um 500, diferente do inexistente (regra 10.6).
   - `serieIds: []` deixaria o material sem série, contra o RF3. `[S1, S1]` viola a chave primária.
   - Correção exigida: cenários [I] em que o `PATCH` com uma série da B responde `NAO_ENCONTRADO`, igual ao id inexistente, sem nada mudar. Também `[]` e as repetidas respondem `ENTRADA_INVALIDA`.

3. **TS §4 (`/edicoes` "herda… séries") com `PATCH /:id`: a correção de série se perde em silêncio.**
   - A sequência: a edição B nasce com as séries de A, a coordenação corrige as séries de A com um `PATCH`, e B, quando fica pronta, substitui A com as séries antigas.
   - O 6º volta a receber o material do 9º (RF7). Isso é provável logo depois do backfill, que é exatamente quando o §13 espera que a coordenação corrija séries.
   - Correção exigida:
     - escolher uma regra e escrevê-la no §5: ou o `PATCH` de séries sobre material com edição em andamento responde `EDICAO_EM_ANDAMENTO`, ou a substituição copia as séries da antiga na transação dela;
     - um cenário [I] da sequência, que fica vermelho sem a regra.

4. **TS §7c "Fila e prioridade" e "Limite por escola", e PRD §6 ("lote, com limite por escola"): a fila `pdf` é nova e não tem cenário.**
   - O cenário de carga mede só o Tutor da escola B. Duas escolas fazendo onboarding na mesma noite é o caso de janeiro, e nada prova que a B ingere com a A ocupando a fila.
   - Correção exigida:
     - [I] escola A com N PDFs pendentes e vaga 2, e o PDF da B sai antes de a fila da A esvaziar. Mutação: ignorar a vaga da fila `pdf`;
     - [U] na configuração do worker: `VAGAS_ESCOLA_PDF` vale 2 por padrão e é sobreposta por `configuracao_operacional_escola.vagas`, e quem atende `pdf` não sobe sem as variáveis do storage;
     - o check `job_registro_fila_valida` aceita `pdf`.

5. **cenarios "Telas" e TS §9: três dos quatro itens não têm camada, e os quatro estados não têm teste.**
   - Os itens "Material", "Licenças" e "Textos" não levam [U] nem [E], ao contrário da legenda. Assim não são teste, são requisito.
   - Ficam sem prova:
     - os textos de `EDICAO_EM_ANDAMENTO`, `LICENCA_VENCIDA`, `SEM_MATERIAL_DA_SERIE` (ao professor e ao aluno) e do 503;
     - a licença vencida que não se escolhe;
     - a contagem no `PATCH` da vigência;
     - o `aria-live` e o foco.
   - O §9 manda "quatro estados em cada peça nova" (resumo, Licenças, `fontes`, o estado do Tutor), e nenhum cenário os prova.
   - Correção exigida: pôr a camada em cada item, [U] de componente com a API falsa ou [E], e um cenário [U] de carregando, erro, vazio e com dado para cada peça nova.

**Recomendações:**
- **TS §5 (3):** escrever que a transação reconfere os tetos sob a trava de envios, como `material.service.ts:140-143` faz hoje. O cenário do `LIMITE_EXCEDIDO` depois do `guardarBytes` depende disso.
- **cenarios "Envio":** dizer como o teste chega ao `LICENCA_VENCIDA` reconferido na transação, por exemplo um storage falso que encurta a licença dentro do `guardarBytes`. Sem isso, ele fica vermelho pelo motivo errado.
- **cenarios "Corridas":**
  - o "Dois `PATCH` da mesma licença (`for update`)" e a "checagem sob a trava de envios" não estão na Tech Spec, e vale pô-los no §5;
  - declarar a mutação do "Dois jobs da mesma edição", por exemplo pôr a transição depois dos capítulos.
- **Onda 3b, linha "Reprocessar":** dizer sobre qual tipo de job ela roda, já que `material.extrair-pdf` agora é recusado.
- **"Modo livre segue como hoje":** asserir o turno aceito com uma chamada ao adaptador falso, e não `SEM_MATERIAL_DA_SERIE`.
[… 16 linhas cortadas]

## infra-guardian · 2ª rodada · REPROVADO · 2026-11-11 10:36:41 · `tasks/prd-ingestao-do-material/revisao-spec.md`

VEREDITO: REPROVADO
Caminho quente tocado: tutor (leitura de página) | fila | migration | deploy (`worker-pdf`, bucket)
Rate limit: ok
Fila e prioridade: ok
Concorrência: corrida no `PATCH /v1/materiais/:id` (techspec §4 e §5; falta em cenarios.md, "Corridas")
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: compatível
Métrica e alerta: faltando

**Os bloqueantes da rodada 1, um a um**

1. **PDF órfão no storage.** A spec garante o que roda na aplicação. O id nasce na aplicação, o upload (PUT) do PDF acontece fora da transação e com prazo, e o objeto é apagado no `catch` (§5 "Envio e edição", passos 2 a 4). O teste está em cenarios.md, "Envio", com mutação. A garantia para queda do processo entre o upload e o commit depende de uma premissa que não foi verificada (bloqueante 1 abaixo).
2. **Contração na F4b.** A spec garante. A §3 manda o check e a saída de `licenciante` para a F4b, e o código novo continua gravando `licenciante`. O item 4 de `tasks/prd-classificacao-bncc/abertura.md` registra a contração. A migration desta spec só cria tabelas e colunas nulas.
3. **Edição com `for update`.** A spec garante (§5, passo 3). O cenário em "Corridas" prende a substituição de B e tem mutação.
4. **Tetos para 300 apostilas e carga pela rota real.** A spec garante. Os tetos são 100 envios por hora por pessoa, 300 por escola e 300 pendentes (§7c). O cenário "Carga" envia pela rota, com o guard, e tem limites numéricos para a escola B e para os statements.
5. **Vaga por fila.** A spec garante: fila `pdf`, vaga 2 por escola sobreposta pela configuração da escola, e os dois checks ampliados (§7c). O alerta continua com defeito (bloqueante 2).

**O que as correções abriram**

- **Fila `pdf` e réplica `worker-pdf`:** o desenho está certo. Faltam declarações (recomendações).
- **`for share` na licença e `for update` no alvo da edição:** a ordem das travas não forma ciclo com a transação da extração nem com o `PATCH` da licença. O `PATCH` do material ficou sem trava (bloqueante 3).
- **Índices:** começam pela escola. O índice em `auditoria` sem `concurrently` segue a exceção da 0034, que vale enquanto não há staging.
- **Expiração do bucket:** é o bloqueante 1.

Bloqueantes:

1. **techspec §5 "Envio e edição", passo 4; §2 (`infra/`, `compose`); §12: a expiração do bucket é premissa não verificada, sem dono e sem teste. O caminho do objeto expirado também não está definido.**
   - O storage do compose é o SeaweedFS (`chrislusf/seaweedfs:4.46`, `infra/compose.yml`), não MinIO nem S3. O bucket nasce de `-bucket=` e não tem regra nenhuma.
   - Pelo que sei do SeaweedFS (não confirmado aqui), a expiração por prefixo vira TTL gravado no objeto. Ela só valeria para objeto escrito depois de a regra existir.
   - A §12 só lista o `getOutline()`. Nenhum cenário prova que o objeto sob `material-temporario/` expira.
   - Os tetos deixam até 300 pendentes em cada uma das dez escolas, cerca de 3.000 PDFs. A cerca de 120 s por PDF (a meta de 300 em 10 h), uma réplica leva perto de 100 h e passa das 48 h. Quando o job chega ao objeto já expirado, a spec não diz o que acontece. Hoje seriam cinco tentativas presas na vaga.
   - Correção exigida:
     - pôr a premissa na §12 como `⚠️ NÃO VERIFICADO`;
     - dizer quem aplica a regra no compose e na VPS, e que ela vem antes do primeiro envio do código novo;
     - teste de integração contra o storage do compose: objeto gravado sob o prefixo tem a expiração (ou o `GetBucketLifecycleConfiguration` devolve a regra), e fica vermelho sem a regra;
     - objeto ausente no `lerBytes` é falha definitiva, com código próprio, e o material vai a `falhou`;
     - alerta, com runbook, quando o job `pdf` mais antigo passa de 24 h na fila.
   - Se a premissa cair, a alternativa é a da rodada 1: gravar a linha antes do upload, para a varredura achar o objeto.

2. **techspec §7c "Métrica e alerta": o `pdf-parado`, como está escrito, dispara no fluxo normal, e nenhum teste prova que não dispara.**
   - "Job `pdf` pendente e nenhuma extração concluída em 15 min" é verdade no instante do primeiro envio depois de horas sem PDF. É o mesmo defeito da rodada 1, com outro nome.
   - O `prazoMs` do `material.extrair-pdf` não está declarado. Com prazo acima de 15 min, um PDF grande sozinho também dispara.
   - cenarios.md não tem caso do alerta.
   - Correção exigida:
     - condição "job `pdf` mais antigo pendente há mais de 15 min **e** nenhuma extração concluída nos últimos 15 min";
     - `prazoMs` abaixo de 15 min, com o número de tentativas;
     - casos em `infra/test/alertas.int.test.ts`: o primeiro job depois de ociosidade não dispara; 300 pendentes com extrações concluindo não dispara; `worker-pdf` parado com job pendente há 16 min dispara.

3. **techspec §4 `PATCH /v1/materiais/:id` (`serieIds`) e §5: o padrão "busca, verifica, grava" sem trava, num endpoint novo desta rodada.**
   - Dois `PATCH` de séries no clique duplo trocam `material_serie` ao mesmo tempo. Se a troca for apaga e insere, o segundo bate na pk e dá 23505, que vira 500, ou as séries se misturam.
   - A edição, que herda as séries do alvo sob `for update`, corre contra o `PATCH` do mesmo alvo sem trava. A nova edição pode nascer com as séries antigas.
   - Correção exigida:
     - o `PATCH` lê o material com `where escola_id = :ctx and id = :id and excluido_em is null for update` antes de mexer nas séries;
     - cenário [P] em "Corridas" com dois `PATCH` em paralelo, com a ordem forçada: termina com as séries do último e sem 500, e fica vermelho sem o `for update`;
     - cenário [P] com edição e `PATCH` do mesmo alvo.

Recomendações:
- **Declarar a fila `pdf` por inteiro na §7c:**
  - o `WORKER_POOL_PDF` da réplica (a onda 3b lê um PDF por vez);
  - as opções de lock e de stalled da fila em `WORKER_POOL_OPTIONS_BY_QUEUE`;
  - um limite de `cpus` no `worker-pdf` do compose, porque a ingestão roda às 10h na mesma VPS da API.
- **Unificar o prazo do temporário.** A Tech Spec diz 48 h. O PRD §7 e a linha do `docs/lgpd.md` dizem 25 h.
- **§11:** dizer qual parte da varredura da 45.0 sai com a expiração e qual fica.
- **§5 "Leitura de página":** escrever "material próprio, sem licença, **ou** licença vigente". Um join interno com a licença tiraria da busca todo material próprio. Pôr esse caso em cenarios.md, "Leitura de página por série".
- **cenarios.md, "Carga":** o "controle negativo sem a ingestão" é a medida de base. Chamar de base e, se quiser um controle negativo de verdade, usar a vaga desligada (`VAGAS_POR_ESCOLA_DESLIGADAS`), que precisa reprovar.

Arquivos:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/techspec.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/cenarios.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/infra/compose.yml`

## frontend-reviewer · 3ª rodada · APROVADO · 2026-11-11 10:41:36 · `tasks/prd-ingestao-do-material/revisao-spec.md`

VEREDITO: APROVADO
Tela vista: não (revisão de spec, sem tela construída)
Estados: ok. `cenarios.md` "Telas" traz os quatro estados no resumo, na lista de materiais e nas Licenças, e o Tutor do aluno tem o estado `SEM_MATERIAL_DA_SERIE`. Carregando e erro serão conferidos pelo código e pelo e2e na construção.
Acessibilidade: ok. O envio tem região `aria-live`, foco devolvido ao fim e alvo de 44 px. A situação da licença vem em texto e cor, e as datas em dd/mm/aaaa com rótulo. O e2e roda com axe em `chromebook` e `celular`.
Chromebook fraco: ok. O e2e usa 300 materiais no seed, com throttling de rede e de CPU, e a lista tem "Mostrar mais".
Celular: ok. O resumo vira lista a 360 px, e `semSerie` com o aviso "séries atribuídas na migração" está no mesmo item (`cenarios.md` "Telas", item do resumo). O e2e cobre `celular`.
Ação oficial protegida: sim. O `PATCH` de vigência mostra quantos materiais saem ou voltam da busca antes de confirmar. A licença vencida não se escolhe no envio.

Conferência dos pontos da rodada 2:
- **429, resolvido.**
  - O `cenarios.md` "Envio" tem o texto "Muitos envios por agora. Os que faltam ficam aqui e continuam às HH:MM" e o contador "12 de 20 enviados". O texto diz o que fazer e a lista pendente é preservada.
  - O `techspec.md` §7 (linha 139) dá base para o HH:MM: o `MaterialUploadGuard` devolve 429 com `Retry-After`.
- **Sino, resolvido.**
  - O `techspec.md` §9 diz que o `licenca-vencendo` vem de `GET /v1/licencas` sem reler por tempo. Ele leva à aba Licenças, não traz nome nem número por pessoa e some com a vigência atualizada.
  - Os textos estão em `cenarios.md` "Telas". O `[U]` do sino cobre −31, −30, 0 e +1, e "depois do `PATCH` da vigência, o item some" está em "Licença".
  - A §9 ainda manda `docs/interface.md` trocar os "cinco tipos" do sino.
- **Recomendações da rodada 2, atendidas.** O `semSerie` está no resumo a 360 px, os quatro estados da lista de licenças e do resumo estão em "Telas", e cada item de "Telas" leva a camada [U] ou [E].

Bloqueantes: nenhum.

Recomendações, sem bloqueio:
1. `cenarios.md` "Envio", 429: o texto diz "continuam às HH:MM", mas a spec não diz se a retomada é automática ou se há um botão. Se for automática, o teste [U] deve provar que ela dispara com o relógio falso no horário do `Retry-After`. Deve provar também que a aba em segundo plano, ou fechada, não perde a fila sem aviso. Um botão "Continuar agora" depois do HH:MM seria o caminho mais simples.
2. `techspec.md` §9, sino: "sem reler por tempo" faz o aviso "vence em dd/mm" ficar velho se a página passar da meia-noite aberta. O [U] pode cobrar que o `GET /v1/licencas` seja relido ao abrir a página e ao voltar o foco. Isso não é polling e mantém o aviso certo.

## conformidade-reviewer · 3ª rodada · APROVADO · 2026-11-11 10:42:03 · `tasks/prd-ingestao-do-material/revisao-spec.md`

VEREDITO: APROVADO

**O bloqueante da rodada 2 foi corrigido.**

- **TS §5, "Leitura de página".** A nova ordem é: o Tutor resolve turma e atividade, roda a D36 (intacta, com `materialId` nulo) e só depois filtra o material aberto e confere a série. Isso tira o `materialDaTurma` da frente do `ehAssuntoDelicado`. Hoje a ordem é a contrária: o `#alcance` roda na linha 158 de `apps/api/src/tutor/tutor.service.ts`, antes da D36 na linha 168. A spec manda inverter, e `#encaminhar` já grava `materialId: null` (linha 349). Então a D36 não depende do material.
- **TS §7b.** Agora diz "a D36 vem antes de todo filtro novo". A frase passa a cobrir série, licença e substituição.
- **`cenarios.md`, "Leitura de página por série".** São três casos com gatilho: sem material da série, edição substituída e licença vencida. Os três esperam a mensagem fixa e o `atencao_humana`. A mutação é pôr o filtro ou a checagem antes do encaminhamento, que é a mutação certa. Os mesmos três casos com pergunta comum esperam recusa sem nada em `mensagem_tutor`, no uso ou na sala, então nenhuma troca fica invisível ao professor.
- **`cenarios.md`, "Telas".** O estado sai sem o avatar e passa pelo `pausaDoErro`, que atende a recomendação da rodada 2. Uma recusa do sistema não aparece como fala de IA.

**A correção não abriu problema que bloqueie.** Achei um ponto, que fica como recomendação.

- Depois do `202`, a `entrada` chama de novo o `#alcance` com o `materialId` gravado (linha 206 de `tutor.service.ts`). Com esta spec, essa nova conferência também aplica o filtro de série, licença e substituição.
- O efeito acontece se a licença vencer à meia-noite ou se a substituição for confirmada nos segundos entre o `202` e o turno. Nesse caso, a execução falha com `NAO_ENCONTRADO` e a classificação `assunto_delicado` do modelo não roda.
- Não é bloqueante por três motivos:
  - o gatilho por palavra da D36 já rodou no `enviar`;
  - a pergunta fica em `mensagem_tutor`, visível ao professor, então não há uso invisível;
  - a janela é a mesma que já existe na pausa de avaliação, que a casa aceitou.
- Mesmo assim, a spec precisa dizer isso.

**Os outros itens, conferidos no que mudou:**

- **Item 3:** não há saída de IA nova (§8).
- **Item 6:** a auditoria das ações novas segue na §7.
- **Itens 7 e 9:** o resumo é contagem por disciplina e série, sem pessoa.
- **Item 8:** não se aplica.

---

Caminhos de escrita em Nota: nenhum. O job `material.extrair-pdf` grava material, trechos, capítulos e a substituição (§3 e §5). Todos com autor humano? Não se aplica.

Decisão autônoma sobre aluno: ausente.

Aprovação registrada: ok. Não há saída de IA nova. As `fontes` mantêm o "o que a IA gerou" depois da substituição e do expurgo (§4, §11).

Supervisão do tutor: ok. A D36 vem antes de todo filtro novo (§5, §7b). A recusa não deixa troca na conversa. O modo livre não muda.

Autonomia declarada e visível: sim. Não há agente novo nem mudança de nível.

Bloqueantes: nenhum.

Recomendações:
- **TS §5, "Leitura de página":** dizer que a conferência depois do `202` (`entrada`, linha 206 de `tutor.service.ts`) também aplica o filtro novo. Se o material sair do alcance nessa janela, a execução falha, a pergunta fica visível ao professor em `mensagem_tutor` e a classificação `assunto_delicado` do modelo não roda, como na pausa de avaliação. Um teste [P] em `cenarios.md`, com a licença vencendo entre o `202` e a `entrada`, deixaria isso escrito.
- **TS §5:** dizer qual código o `enviar` devolve quando a página aberta é de material que saiu do alcance (substituído ou com licença vencida): `NAO_ENCONTRADO`, como hoje, ou `SEM_MATERIAL_DA_SERIE`. Também dizer se ele entra no `pausaDoErro`. Hoje o cenário só fixa o texto do `SEM_MATERIAL_DA_SERIE`.
- **PRD, RF8 (`prd.md:53`):** ainda diz "o Tutor diz que não há material da turma". A spec escolheu um estado da tela, sem fala do Tutor, e o RF8 deveria dizer o mesmo.
- **Supervisão:** uma contagem por turma das recusas por falta de material da série, sem conteúdo nem nome, no resumo da coordenação. Vem da rodada 1 e segue aberta.
- **`docs/regulacao.md:272`:** "a autorização fica registrada no sistema" pode apontar para `licenca_de_material`. Vem da rodada 1 e segue aberta.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/prd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/achados/revisao-spec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/apps/api/src/tutor/tutor.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/apps/web/src/areas/aluno/tutor.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/docs/regulacao.md

## tenancy-guardian · 3ª rodada · APROVADO · 2026-11-11 10:42:14 · `tasks/prd-ingestao-do-material/revisao-spec.md`

VEREDITO: APROVADO

Tabelas verificadas: `envio_de_material`, nova. Tem `escola_id`, pk `(escola_id, material_id)`, FK da escola, e `material_id` é UUIDv7 da aplicação. Não varia por período, então dispensa `anoLetivoId`. Sem FK para `material` porque o material só existe no commit, e isso está justificado. As tabelas `licenca_de_material`, `material_serie`, `capitulo_do_material` e as colunas novas de `material` não mudaram desde a rodada 2.

Queries verificadas:
- Na edição (TS §5 "Envio e edição", passo 1): o alvo é conferido primeiro, com escopo, e de outra escola ou inexistente responde `NAO_ENCONTRADO` antes de tudo.
- No passo 3: o `for update` do alvo tem `where escola_id = :ctx`. A leitura que separa `EDICAO_EM_ANDAMENTO` de `NAO_ENCONTRADO` só roda sobre um alvo que o passo 1 já confirmou na escola do contexto.
- Na §6: a regra geral cobre `for update` e `for share`.
- O `PATCH` de material com `for update` (§4).
- A gravação e o apagar de `envio_de_material` (§5, passos 2 e 4).
- A varredura nova (§6). É `@Unscoped` e devolve só escola e id, no molde da varredura da 45.0 em `onda-3b.md:95-103`, com o apagar no contexto de cada escola.
- O `serieId` da rota `GET /v1/materiais/busca` "filtra e não autoriza" (§5 "Leitura de página").

Teste de isolamento: presente e efetivo.

**Bloqueantes da rodada 2, conferidos**
1. **Edição sobre material de outra escola: corrigido.** TS §5, passos (1) e (3), e §6 dizem o que eu exigi. Em `cenarios.md` "Isolamento" há a edição sobre material da B `pronto`, `processando` e com licença vencida, com `NAO_ENCONTRADO` igual ao inexistente e nenhum byte lido. Fiz a mutação de tirar o escopo da leitura do alvo no passo 1: o caso da B `processando` responde `EDICAO_EM_ANDAMENTO` e o teste fica vermelho.
2. **`PATCH` com `serieIds` da B: corrigido.** Está em `cenarios.md` "Envio", linhas 28-29 (`NAO_ENCONTRADO` igual à série inexistente, séries inalteradas), e em "Isolamento", linha 153.

**O que a correção afetou**
- `envio_de_material` e a varredura não abriram problema de isolamento. O cenário "a linha de outra escola roda no contexto dela" (linhas 23-25 e 158-159) cobre a troca de contexto.
- `EDICAO_EM_ANDAMENTO` no `PATCH` não revela o estado de material de outra escola. A leitura `for update` com escopo vem primeiro, e a FK composta impede que uma edição da B tenha `substitui_id` de material da A.

Bloqueantes: nenhum.

Recomendações:
- `cenarios.md`, "Isolamento", linha 151: dizer que o material da B no caso `pronto` é próprio, sem licença. Com licença ou séries herdadas da B, as conferências de licença e de série, que têm escopo, também respondem `NAO_ENCONTRADO`. Aí só o caso `processando` prova a cláusula do alvo, e o caso `pronto` não acrescenta nada.
- TS §6: escrever a linha de justificativa do `@Unscoped` novo, no texto da 45.0: "rotina nossa, sem requisição; devolve só a escola e o id, sem título, texto nem pessoa". Dizer também que o apagar do objeto usa a chave do contexto.
- TS §5, passo 1: dizer que a recusa por alvo de outra escola ou inexistente não grava o id do alvo em `material.recusado`, como já vale para a série da B (`cenarios.md`, linha 14).
- TS §4, `PATCH`: dizer, como na edição, que fora da escola responde `NAO_ENCONTRADO` antes de `EDICAO_EM_ANDAMENTO`. Em "Isolamento", acrescentar o `PATCH` sobre material da B em `processando`.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/prd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/achados/revisao-spec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-reengenharia/onda-3b.md

## privacy-guardian · 3ª rodada · REPROVADO · 2026-11-11 10:43:06 · `tasks/prd-ingestao-do-material/revisao-spec.md`

**Rodada 3: privacy-guardian, revisão da spec `ingestao-do-material`**

O bloqueante 1 da rodada 2 foi corrigido. O bloqueante 2 foi corrigido em quase tudo: a expiração do bucket saiu e entrou a tabela `envio_de_material`. Mas a troca abriu um furo novo, que fica como único bloqueante desta rodada.

**Os bloqueantes da rodada 2, item a item**

| Item | Situação | Onde |
|---|---|---|
| 1. A licença travava o expurgo do material | Corrigido. A licença sai em `material_excluido`, contada de `vigente_ate`, e só quando nenhuma linha de `material` a cita, inclusive excluída. O passo roda depois do material. O cenário cobre o material excluído ainda citado por `mensagem_tutor`, com a categoria terminando `concluida`, os dois saindo na mesma noite e a mutação do `not exists`. | techspec.md:53-54; cenarios.md:86-89 |
| 2. O PDF órfão de antes do commit | Corrigido em parte. Não há mais premissa sobre o bucket nem sobre versionamento. A linha é gravada antes do upload, a transação a apaga e a varredura age depois de 1 h. Há cenário de 59/61 min, de duas escolas e de mutação, e o prazo fica abaixo das 25 h do RF13. O que falta está no bloqueante novo abaixo. | techspec.md:45, 78, 82-83, 107, 119; cenarios.md:19-25, 158-159 |
| Recomendações da rodada 2 | Atendidas: seed e e2e com licenciante fictício, e o sino sem licenciante. Continuam abertas: a licença sem fim que nunca sai, e o texto de retenção do PRD. | cenarios.md:6, 170-171 |

**O que a tabela nova afeta**
- **Dado pessoal:** a tabela não tem coluna de pessoa (`escola_id`, `material_id`, `criado_em`), então não entra no arquivo do titular.
- **Classificação:** a §7 não classifica a tabela. O teste de arquitetura obriga a fazer isso na tarefa (apps/api/test/architecture.test.ts:1245), por isso fica como recomendação.
- **Expurgo:** o noturno (`retencao.expurgar-escola`) só apaga linha de `material`, e quem cuida de `envio_de_material` é a varredura de hora em hora. Por isso não há conflito com `ALVOS_DO_EXPURGO_DA_ESCOLA` (packages/core/src/retencao/expurgo-da-escola.repository.ts:45-55).
- **Isolamento:** o acesso sem escopo é uma leitura que devolve só escola e id, e cada exclusão roda no contexto da escola dela, com cenário (techspec.md:107; cenarios.md:158-159).

```
VEREDITO: REPROVADO
Campos pessoais tocados: licenca_de_material.licenciante (pode ser pessoa; vem do material no backfill),
  licenca_de_material.registrada_por (coordenador); autor nas ações novas da auditoria. envio_de_material
  sem pessoa. Nenhum campo de aluno.
Fora da tabela de dados do docs/lgpd.md: nenhum (a §7 manda atualizar a licença, o PDF temporário e as ações novas).
Autorização por objeto: ok (licença, edição, PATCH, resumo, fontes, serieIds e serieId da outra escola com a mesma
  resposta que o inexistente; varredura no contexto de cada escola).
Logs: limpos (§7: ids, códigos, contagens, duração; nunca título, nome do arquivo, licenciante nem texto).
Auditoria: presente (licenca.registrada e .alterada sem texto livre, com cenário de sentinela; material.edicao_enviada,
  .substituido, .atualizado, .recusado com serieIds; job.*).
Envio externo: nenhum (§7, §8).
Seed/fixture: sintético, com licenciante fictício (cenarios.md:6).
Bloqueantes:
  1. techspec.md:83 (§5 "Envio e edição", passo 4) e cenarios.md:26 (problema novo da correção do órfão):
     a spec não diz em que ordem saem o objeto e a linha, e o cenário do storage fora pede "nada gravado".
     Isso não fecha com o desenho: a linha de envio_de_material já foi gravada no passo 2, antes do guardarBytes.
     Se o storage cai durante o PUT, o objeto pode ter ficado gravado do lado do servidor. Com o storage ainda
     fora, o apagar do catch também falha. Se a linha sair mesmo assim, como o cenário pede, o PDF fica no bucket
     para sempre, sem nada que o ache (nem a varredura, nem o expurgo, nem o fim de contrato). A varredura tem o
     mesmo risco se apagar a linha antes do objeto.
     Correção exigida:
     - na §5, escrever que a linha de envio_de_material só sai depois do apagar do objeto dar certo (objeto já
       ausente conta como sucesso) ou no commit da transação; se o apagar falhar, a linha fica para a varredura;
       a varredura segue a mesma ordem;
     - trocar o cenário da cenarios.md:26 por: o storage falso grava e lança no guardarBytes, e continua fora no
       apagar; resposta 503, nada em material, e a linha de envio_de_material fica; com o storage de volta e 61 min
       passados, a varredura apaga o objeto e a linha. Mutação: apagar a linha no catch sem conferir o apagar;
     - na varredura, o mesmo caso com o apagar falhando uma vez: a linha fica e sai na hora seguinte.
Recomendações:
  - §7, "Retenção e expurgo": nomear a classificação de envio_de_material (sem_pessoa, com um comentário que aponte a
    varredura). A esteira já obriga a classificar, mas a spec deve dizer qual é.
  - §3, backfill: o licenciante cujos materiais já estavam todos excluídos antes da F4 ganha uma licença sem fim e
    passa a ficar para sempre, sendo que antes saía com o material. Dar a essa licença vigente_ate igual ao último
    excluido_em, para ela sair junto com o último material. Na tela de Licenças, destacar as "registradas antes da F4"
    para a coordenação encerrar a vigência. No docs/lgpd.md, dizer que a licença sem fim fica até a coordenação
    encerrá-la (repetida da rodada 2, mais precisa).
  - prd.md:92: alinhar a retenção do licenciante ao texto da TS §3 (repetida da rodada 2).
  - Varredura: a leitura de envio_de_material pode entrar no mesmo método sem escopo da varredura da 45.0, para o
    módulo de material não chegar perto do terceiro @Unscoped da regra 10.9 (do tenancy-guardian).
```

Arquivos de referência:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/prd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/packages/core/src/retencao/expurgo-da-escola.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/packages/shared/src/privacidade/classificacao.ts

## infra-guardian · 3ª rodada · REPROVADO · 2026-11-11 10:43:35 · `tasks/prd-ingestao-do-material/revisao-spec.md`

VEREDITO: REPROVADO
Caminho quente tocado: tutor (leitura de página) | fila | migration | deploy (`worker-pdf`)
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: compatível
Métrica e alerta: faltando (o `pdf-esperando` da 45.0 continua valendo por herança, ver bloqueante 2)

**Os três bloqueantes da rodada 2**

1. **Expiração do bucket.** Corrigido: a regra saiu e a garantia agora é a linha gravada antes do upload (TS §3 `envio_de_material`, §5 passos 2 a 4, §11). Objeto ausente vira `ARQUIVO_AUSENTE`, falha definitiva (TS §5 "Extração"; cenarios "Extração", linha 44). Com isso, os 3.000 PDFs pendentes não perdem objeto por idade. A correção deixou a ordem das remoções sem definição (bloqueante 1 abaixo).
2. **`pdf-parado`.** Corrigido: a condição é a exigida, com `prazoMs` de 10 min e 3 tentativas (TS §7c:137 e :143). Os três casos estão em `alertas.int.test.ts` e o alerta entra no ensaio (cenarios:61-63). O defeito sobrevive pelo lado da 45.0 (bloqueante 2 abaixo).
3. **`PATCH` sem trava.** Corrigido: o `PATCH` lê o material com `for update` e responde `EDICAO_EM_ANDAMENTO` (TS §4:71-72). As corridas estão em cenarios:128-130, e a sequência em cenarios:30-32, as duas com mutação. Conferi a ordem das travas entre o `PATCH` (trava A), a edição (trava A e cria B) e a extração (trava B e depois A): não forma ciclo, e um `PATCH` em A que espera a substituição termina sem linha.

**Recomendações da rodada 2:** o `worker-pdf` lendo um PDF por vez, com `cpus` limitado, entrou. A leitura "próprio **ou** licença vigente" entrou (TS §5:98), com cenário (cenarios:18). A carga ganhou base e controle negativo (cenarios:183-186). Com a vaga tomada na publicação (`EscolaConcurrencyLimiter`), ler um PDF por vez não anula a vaga 2 por escola. Continua faltando declarar as opções de lock e de stalled da fila `pdf`.

Bloqueantes:

1. **techspec.md:83 (§5, passo 4) e cenarios.md:19-26: a spec não define a ordem entre apagar o objeto e apagar a linha de `envio_de_material`, e o cenário do 503 exige justamente a ordem errada.**
   - Se o `catch` ou a varredura apagam a linha e o apagar do objeto falha (o storage oscilou), o objeto fica órfão para sempre. A linha era a única pista dele, e o armazém não tem listagem. Isso fura o RF13.
   - O cenário "Storage fora no `guardarBytes`: 503, nada gravado" (cenarios:26) pede que a linha suma mesmo com o storage fora. Mas um PUT cortado pelo prazo pode terminar no storage depois que a aplicação desistiu.
   - Correção exigida:
     - escrever na §5 que a linha só sai **depois** de o objeto ser apagado com sucesso, no `catch` e na varredura; se o apagar falhar, a linha fica para a varredura;
     - o 503 do storage deixa a linha (é "nada em `material`", não "nada gravado");
     - cenário [I] com o storage falso falhando no apagar, uma vez no `catch` e uma na varredura: a linha fica, e na rodada seguinte da varredura os dois saem. Mutação: inverter a ordem.

2. **techspec.md:181 (§11, linha 45.0) com techspec.md:9 (§1, "com os desvios da seção 11"): o alerta `pdf-esperando` da 45.0 continua herdado.**
   - A `onda-3b.md:108-109` manda criar o `pdf-esperando.yaml`, que dispara com 10 min de espera, com runbook "subir a réplica". A §11 lista os desvios da 45.0 e não cita esse alerta, então quem implementar a parte da 45.0 o cria ao lado do `pdf-parado`.
   - Com vaga 2 por escola, ele dispara em todo onboarding. É o bloqueante 5 da rodada 1.
   - Correção exigida: acrescentar ao desvio da 45.0 na §11 "o `pdf-esperando` não é criado; no lugar, o `pdf-parado` da §7c, com o runbook dele".

Recomendações:
- TS §7c:143: definir "extração concluída" como qualquer resultado final (pronto ou falhou). Se contar só o `pronto`, 15 minutos só de PDF inválido com fila disparam o alerta.
- Os cenários "Extração" (cenarios:39) citam a linha "Falha final" da onda 3b, que fala em cinco falhas. Esta spec define 3 tentativas: escrever que o caso usa as tentativas da definição.
- TS §5, passo 3: se o `delete` de `envio_de_material` não pegar linha (a varredura já agiu, num pedido preso por mais de 1 h), desfazer a transação com 503 em vez de gravar um material sem objeto.
- Declarar o `lockDuration` e o stalled da fila `pdf` em `WORKER_POOL_OPTIONS_BY_QUEUE` (vem da rodada 2).
- Cenário de `PATCH` sobre material excluído ou substituído: `NAO_ENCONTRADO`.
- Registrar em `docs/infra.md` o disco do temporário no pior caso: 300 pendentes × 10 escolas × 20 MB, cerca de 60 GB.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-reengenharia/onda-3b.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/packages/core/src/queue/escola-concurrency-limiter.ts

## test-engineer · 3ª rodada · REPROVADO · 2026-11-11 10:43:45 · `tasks/prd-ingestao-do-material/revisao-spec.md`

VEREDITO: REPROVADO

**Cenários exigidos:** os mesmos das rodadas 1 e 2, mais o que o desenho novo trouxe: a tabela `envio_de_material` com a varredura de 1 h, o `ARQUIVO_AUSENTE`, o `PATCH` com `for update` e `EDICAO_EM_ANDAMENTO`, a fila `pdf` e os estados das telas.

**Cobertos:** os 5 bloqueantes da rodada 2, um a um.

| R2 | Situação | Onde |
|---|---|---|
| 1. Queda entre o upload e o commit, e o prazo do RF13 | **Atendido.** A linha é gravada antes do upload e apagada na transação. A varredura apaga depois de 1 h, dentro das 25 h. O cenário 59/61 min tem mutação, e a expiração do bucket saiu. O `catch` abriu um problema novo (bloqueante 1) | TS §5 Envio (2)-(4), §7, §11; cenarios "Envio" |
| 2. `PATCH` com séries: isolamento e validação | Atendido | cenarios "Envio" l.28-29; "Isolamento" l.153 |
| 3. Correção de série perdida pela edição | **Em parte.** A regra está escrita e a sequência tem mutação. Ainda há uma janela antes da transação da edição (bloqueante 2) | TS §4 l.71-72; cenarios "Envio" l.31-32 e "Corridas" l.129-130 |
| 4. Fila `pdf` | Atendido: duas escolas com mutação, os checks, a configuração e o alerta | cenarios "Fila `pdf`" |
| 5. Telas | Atendido: cada item tem [U] ou [E], há textos para os códigos novos e para o 503, e os quatro estados de resumo, lista e Licenças | cenarios "Telas" |

As recomendações da rodada 2 foram atendidas, menos uma: o `for update` do `PATCH` da licença continua só no cenário.

**Bloqueantes:**

1. **TS §5 Envio (4) e cenarios "Envio" l.26: o `catch` pode deixar o PDF órfão para sempre.**
   - O §5 (4) diz só "apaga objeto e linha no `catch`", sem ordem nem condição.
   - O cenário "Storage fora no `guardarBytes`: 503, nada gravado" empurra a implementação a apagar a linha sempre.
   - O caso real é o `guardarBytes` que estoura o prazo depois de o objeto chegar ao storage. O `apagar` do `catch` também falha, porque o `S3FileStorage.apagar` lança `FileStorageUnavailableError`. A linha some, e a varredura nunca mais acha o objeto. É o mesmo furo das rodadas 1 e 2, numa janela menor.
   - Correção exigida:
     - no §5 (4): a linha só sai depois de o objeto ser apagado; se o `apagar` falha, a linha fica para a varredura;
     - um cenário [I]: storage falso que grava o objeto e depois estoura o prazo, e o `apagar` do `catch` falhando. Resultado: 503, a linha de `envio_de_material` continua, e com 61 min a varredura apaga objeto e linha;
     - reescrever o "nada gravado" do cenário do storage fora: nada em `material`, e a linha de envio apagada só quando o `apagar` deu certo;
     - mutação: apagar a linha incondicionalmente no `catch`.

2. **TS §5 (3) e cenarios "Corridas" l.129-130: a edição ainda pode herdar séries velhas.**
   - O §5 (1) lê o alvo antes do upload, e o §5 (3) não diz de onde vêm as "séries" que a transação grava.
   - Entre o passo (1) e a transação da edição ainda não existe edição em `processando`. Por isso o `PATCH` de séries em A passa e confirma.
   - Se as séries herdadas são as lidas no passo (1), a nova edição B nasce com as séries antigas e depois substitui A. É a perda silenciosa da rodada 2, de volta.
   - O [P] "Edição e `PATCH` de séries do mesmo alvo" não diz qual operação fica parada nem onde. A mutação dele (tirar o `for update` do `PATCH`) não chega a esse caminho.
   - Correção exigida:
     - no §5 (3): as séries herdadas são lidas do alvo dentro da transação, depois do `for update`;
     - fixar a ordem do [P]: a edição parada depois do `guardarBytes`, o `PATCH` de séries em A confirma, e a edição continua. Resultado: a nova com as séries do `PATCH`;
     - mutação: herdar as séries lidas no passo (1).

**Recomendações:**
- **TS §5 Extração, contra a linha "Exclusão em `processando`" da `onda-3b.md` §3:** um material excluído entre o `lerParaExtrair` e o `lerBytes` cai em `ARQUIVO_AUSENTE`, que agora é falha definitiva. Isso dá job `falhou`, o `job.falhos` com alerta, e `falhou` gravado num material excluído, onde a onda 3b manda "sai sem gravar". Proposta: objeto ausente de material já excluído conclui sem efeito. Cenário [P] com a exclusão nessa janela.
- **TS §5 (3):** a transação confere que o `delete` da linha de `envio_de_material` apagou uma linha. Se não apagou, a varredura chegou antes, e a transação desfaz. Sem isso, um envio lento depois de 1 h confirma um material sem objeto.
- **Varredura:** cenário [I] de uma linha sem objeto (queda antes do upload), em que a linha sai sem erro. Outro em que a falha numa escola não interrompe as outras.
- **Cenário 59/61 min:** dizer que o `criado_em` e a comparação da varredura usam o mesmo relógio (o `Clock`), senão o relógio injetado não chega lá.
- **TS §2 e cenarios "Fila `pdf`":** o `apps/despachante` também lê as vagas (`lerVagasPadrao`, `apps/despachante/src/config.ts`).
  - Pôr o despachante no §2.
  - Pôr no [U] de configuração o despachante, além do worker.
  - Pôr `VAGAS_ESCOLA_PDF` no compose dos dois. Sem isso, o despachante pode não subir.
- **cenarios "Carga":** com `VAGAS_POR_ESCOLA_DESLIGADAS`, o Tutor da escola B quase não muda (fila interativa, `worker-pdf` em réplica própria). O controle negativo provavelmente não reprova, e precisa ser um que reprovaria de fato: medir a espera do PDF da B, ou rodar o `worker-pdf` sem limite de `cpus`.
- **`PATCH` em material excluído ou substituído:** cenário com `NAO_ENCONTRADO`.
- **`PATCH` da licença:** escrever o `for update` no TS §4 ou §5, porque hoje só o cenário o cita.
- **Chip e PDF do artefato:** pôr o estado de carregando e o de artefato sem `fontes` nos cenários [U].
- **`envio_de_material`:** entra na `CLASSIFICACAO_DAS_TABELAS` e na eliminação da escola, com teste.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/prd.md

## revisor-geral · 3ª rodada · REPROVADO · 2026-11-11 10:44:38 · `tasks/prd-ingestao-do-material/revisao-spec.md`

VEREDITO: REPROVADO
Escopo: respeitado. Nada da F4b entrou. A correção de série no `PATCH` está registrada como parte do RF6 que fica na F4 (TS §11).
Aderência à Tech Spec: divergência no caminho de falha do envio. A TS §5 (4) e o `cenarios.md` "Envio" podem deixar o PDF órfão para sempre, contra o RF13 ("apagado em todo caminho").
Portão local: não se aplica, porque é revisão de spec e não há código. O `conferir` responde "nunca passou nesta árvore", como esperado.

**O meu bloqueante da rodada 2 foi atendido.**
- **Prazo do órfão:** a expiração de 48 h saiu. O órfão antes do commit dura no máximo cerca de 2 h, pela varredura horária com corte de 1 h. Depois do commit continuam as 25 h da 45.0. A TS §7 "Retenção" e o PRD §8 dizem o mesmo, e a §11 registra a varredura nova na linha da 45.0.
- **`ARQUIVO_AUSENTE`:** é falha definitiva (TS §5 "Extração") e tem cenário próprio (`cenarios.md` "Extração", linha 44).

**As outras correções desta rodada** estão coerentes entre TS, cenários e PRD:
- a D36 roda antes do filtro do material (TS §5, §7b; cenários das linhas 99 a 102, com mutação);
- a retenção da licença usa `not exists` (TS §3; cenários das linhas 86 a 89);
- o alerta `pdf-parado` tem as duas condições (TS §7c; cenários das linhas 61 a 63);
- o `PATCH` usa `for update` e recusa com `EDICAO_EM_ANDAMENTO` (TS §4; cenários das linhas 30, 31, 128 e 129);
- a trava de envios está descrita, as séries são conferidas antes de ir à auditoria, e a recusa reconferida também grava `material.recusado` (TS §5 (1) e (3)).

Bloqueantes:
1. **TS §5 "Envio e edição" (4), e `cenarios.md` "Envio", linha 26: a ordem entre apagar o objeto e apagar a linha de `envio_de_material` não está definida, e o cenário pede a ordem que deixa órfão.**
   - **O que está errado.** A linha de `envio_de_material` é a única coisa que leva a varredura até o objeto. A TS diz "apaga objeto e linha no `catch`" e "a varredura apaga os dois", sem dizer em que ordem. Se a linha sai e o apagar do objeto falha, o PDF fica no storage para sempre, sem nada que o ache. O cenário da linha 26 ("Storage fora no `guardarBytes`: 503, nada gravado") obriga a apagar a linha mesmo quando o apagar do objeto falhou. Na linha 13, "nada" inclui `envio_de_material`. O caso real é o `PutObject` que estoura o tempo depois de o servidor gravar. É a falha da rodada 1, de volta pelo mecanismo novo.
   - **Correção exigida.**
     - Na §5 (4), escrever: o objeto sai primeiro, e a linha só sai depois que o objeto saiu. Se o apagar falha, a linha fica para a varredura. A varredura segue a mesma ordem.
     - Trocar a linha 26 por: "503, nada em `material`; a linha de envio sai, ou fica e a varredura apaga em 1 h".
     - Acrescentar um caso com o apagar do `catch` falhando: a linha fica e a varredura das 61 min apaga o objeto. Mutação: apagar a linha antes do objeto.

Recomendações:
- **Corrida entre a varredura e uma transação lenta (TS §5 (4)).** A varredura pode ler uma linha com mais de 1 h enquanto a transação dessa linha ainda espera a trava de envios. Nesse caso ela apaga o objeto de um material que vai ser gravado, e o material termina em `ARQUIVO_AUSENTE`. Duas saídas:
  - a varredura trava a linha com `for update skip locked`;
  - ou a transação exige que o `delete` da linha de envio atinja 1 linha, e aborta com 0.
- **`ARQUIVO_AUSENTE` (TS §4, §5).** As falhas de material são minúsculas, em `FALHAS_DE_MATERIAL` (`packages/shared/src/material/material.ts:42`), e cada uma tem texto para a coordenação. Sugestões:
  - chamar de `arquivo_ausente` e pôr nessa lista;
  - dar o texto a ela na seção "Telas" do `cenarios.md`;
  - tirar da lista de "Erros novos" da §4, porque nenhuma rota responde com esse código.
- **`MaterialUploadGuard` no `PATCH` (TS §7c).** O guard confere o teto de envios. Do jeito que está, a coordenação que chegou a 300 envios na hora não consegue corrigir séries, justamente a correção do risco do backfill (§13). O 429 também diria "Muitos envios". Vale dar ao `PATCH` um limite próprio.
- **Licença sem fim criada pelo backfill (TS §3).** A regra "sem fim, não sai" junta com o backfill de uma licença por licenciante. Se o backfill também cobrir material já excluído, e a contração da F4b exige isso, o licenciante, que pode ser pessoa, passa a ficar para sempre. Hoje ele sai junto com o `material_excluido` (`docs/lgpd.md:101`). Vale dar a essas licenças `vigente_ate` igual à data da última exclusão. A área é do `privacy-guardian`.
- **`PATCH` sobre material excluído ou substituído (TS §4).** Continua sem resposta escrita. O caminho natural é `NAO_ENCONTRADO`, com um cenário.
- **RF8 (TS §11).** Falta uma linha dizendo que a "fala do Tutor" virou um estado da tela, sem fala da IA. É o caminho mais seguro, mas precisa ficar registrado.
- **`pdf-parado` (TS §7c).** Dizer se "extração concluída" conta também a que termina `falhou`.
- **`envio_de_material` na §7.** Pôr a tabela na lista de novos itens e dizer a classificação dela. A `architecture.test` já obriga a classificar, mas a TS não diz qual.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/prd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-reengenharia/onda-3b.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/packages/shared/src/material/material.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/apps/api/src/material/material-upload.ts

## privacy-guardian · 4ª rodada · APROVADO · 2026-11-11 10:47:27 · `tasks/prd-ingestao-do-material/revisao-spec.md`

VEREDITO: APROVADO

O bloqueante da rodada 3 foi corrigido, e a correção não criou nenhum furo novo de dado pessoal.

**O bloqueante da rodada 3, item a item**

| O que exigi | Situação | Onde |
|---|---|---|
| A linha de `envio_de_material` só sai depois de o objeto ser apagado (objeto já ausente conta). Se o apagar falha, a linha fica. A varredura segue a mesma ordem | Corrigido | techspec.md:83-84 (§5, passo 4) |
| Cenário: o storage grava e estoura o prazo, e o `apagar` do `catch` falha. Resultado: 503, nada em `material`, a linha fica, e a varredura apaga objeto e linha em 61 min. Mutação de apagar a linha sem conferir o `apagar` | Corrigido. Há ainda a mutação de inverter a ordem, a linha sem objeto e a falha que fica numa escola só | cenarios.md:26-30 |
| A varredura com o `apagar` falhando uma vez: a linha fica e sai na hora seguinte | Corrigido | cenarios.md:28 |

**O que mais a correção afeta**
- **Transação sem a linha (§5, passo 3).** Se o `delete` não acha a linha, a transação desfaz com 503. O cenário cobre isso, com mutação (cenarios.md:31-32). Depois, o `catch` segue a ordem certa: o objeto que a varredura já apagou conta como ausente.
- **Corrida entre a varredura e o commit.** Na ordem contrária, o material é gravado e a varredura apaga o objeto. A extração então cai em `arquivo_ausente`, que é falha definitiva e aparece na tela (cenarios.md:51-52). Isso é falha visível, não órfão escondido, e não deixa PDF para trás.
- **Recomendações da rodada 3 que entraram:**
  - `envio_de_material` está classificada como `sem_pessoa` (techspec.md:116), e a classe existe em `classificacao.ts:21`.
  - A licença do backfill cujos materiais já estavam todos excluídos ganha fim na última exclusão (techspec.md:50; cenarios.md:146-147). Assim ela sai na mesma noite que o último material: o prazo é o mesmo e o passo roda depois do material. O check `vigente_ate >= vigente_desde` continua valendo.

**Pergunta de fechamento.** Esta spec não toca dado de aluno nem envia nada para fora. O que ela guarda de pessoa é o licenciante e o coordenador que registrou a licença. A §7 põe esse registro no arquivo do titular do coordenador e cuida da retenção. O que a secretaria pedir sobre um aluno continua respondido pelos caminhos que já existem.

```
VEREDITO: APROVADO
Campos pessoais tocados: licenca_de_material.licenciante (pode ser pessoa; vem do material no backfill),
  licenca_de_material.registrada_por (coordenador); autor nas ações novas da auditoria.
  envio_de_material sem pessoa (sem_pessoa, TS §7). Nenhum campo de aluno.
Fora da tabela de dados do docs/lgpd.md: nenhum (a §7 manda atualizar a licença, o PDF temporário e as ações novas
  da auditoria).
Autorização por objeto: ok (licença, edição, PATCH, resumo, fontes, serieIds e licencaId da outra escola com a mesma
  resposta que o inexistente; varredura no contexto de cada escola).
Logs: limpos (§7: ids, códigos, contagens, duração; nunca título, nome do arquivo, licenciante nem texto).
Auditoria: presente (licenca.registrada e .alterada sem texto livre, com sentinela; material.edicao_enviada,
  .substituido, .atualizado, .recusado com serieIds; job.reprocessado, job.descartado).
Envio externo: nenhum (§7, §8).
Seed/fixture: sintético, com licenciante fictício (cenarios.md:6).
Bloqueantes: nenhum.
Recomendações:
  - TS §5, passo 4 (techspec.md:83): quando o guardarBytes não terminou com sucesso (prazo estourado ou conexão
    caída), o catch não deve apagar a linha, mesmo com o objeto "ausente". Ela fica para a varredura de 1 h.
    Motivo: um PUT ainda em andamento no servidor pode gravar o objeto depois do DELETE, e com a linha já apagada
    nada mais acharia esse objeto. Esperar 1 h fecha essa janela sem custo. Não bloqueia porque o PDF é material
    sem pessoa e a janela é estreita.
  - Licenças sem fim de licenciantes que ainda têm material vivo: destacar na tela de Licenças as "registradas
    antes da F4" para a coordenação encerrar. No docs/lgpd.md:101, escrever que a licença sem fim fica até a
    coordenação encerrá-la (vem da rodada 3).
  - prd.md:92: alinhar a retenção do licenciante ao texto da TS §3, "contada de vigente_ate; sem fim, não sai"
    (vem das rodadas 2 e 3).
  - Varredura: pôr a leitura de envio_de_material no mesmo método @Unscoped da varredura da 45.0, para o módulo
    não chegar perto do terceiro @Unscoped da regra 10.9 (vem da rodada 3).
  - cenarios.md:3 cita só as "rodadas 1 e 2": incluir a 3.
```

Arquivos de referência:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/prd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/docs/lgpd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/packages/shared/src/privacidade/classificacao.ts

## infra-guardian · 4ª rodada · REPROVADO · 2026-11-11 10:47:29 · `tasks/prd-ingestao-do-material/revisao-spec.md`

VEREDITO: REPROVADO
Caminho quente tocado: tutor (leitura de página) | fila | migration | deploy (`worker-pdf`)
Rate limit: ok
Fila e prioridade: ok
Concorrência: corrida em techspec.md:83-84 (§5, passo 4: o PUT atrasado cai depois do `catch`)
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: compatível
Métrica e alerta: ok

**Os dois bloqueantes da rodada 3**

1. **Ordem entre apagar o objeto e apagar a linha.** Ficou corrigido em parte.
   - Feito: o objeto sai primeiro e a linha depois, no `catch` e na varredura (TS §5, passo 4).
   - Feito: o `delete` da linha na transação precisa achá-la, ou a transação desfaz com 503 (TS §5, passo 3).
   - Feito: os cenários do `apagar` falhando no `catch` e na varredura, e do envio lento, estão em cenarios.md:26-32, com mutação.
   - Ficou de fora uma parte da correção que exigi: "o 503 do storage deixa a linha". Ver o bloqueante abaixo.
2. **`pdf-esperando` herdado da 45.0.** Corrigido. A TS §11, linha 45.0 (techspec.md:180), diz que ele não nasce e que no lugar fica o `pdf-parado`.

**As recomendações da rodada 3**

- Entraram:
  - "terminada (`pronto` ou `falhou`)" no `pdf-parado` (TS §7c:144), com o caso `falhou` em cenarios.md:72;
  - a Falha final com 3 tentativas (cenarios.md:47);
  - o `delete` conferido no passo 3;
  - o `PATCH` sobre material excluído ou substituído com `NAO_ENCONTRADO` (cenarios.md:37);
  - `apps/despachante` no §2 e no [U] de configuração.
- O limite de 300 por hora por escola do `PATCH` tem também o limite por usuário. Ele vem do guard global, que tem `porUsuarioMin` e `porEscolaMin` (`apps/api/src/rate-limit.module.ts`). Não é limite só por IP.
- Ainda faltam o `lockDuration`/stalled da fila `pdf` e o registro do disco no pior caso.

Bloqueantes:

1. **techspec.md:83-84 (§5, passo 4) e cenarios.md:26-30: depois de uma falha no próprio `guardarBytes`, o `catch` ainda apaga a linha, e o PUT atrasado deixa o objeto órfão.**
   - O que acontece hoje: o `guardarBytes` estoura o prazo e o `catch` chama o `apagar`. Como o PUT ainda está em curso, o objeto não está lá, e "ausente conta" como sucesso. A linha sai. Em seguida o PUT termina no storage.
   - Resultado: o objeto fica sem linha, a varredura não o acha e o armazém não tem listagem. Isso fura o RF13 ("queda, em até 25 h").
   - É o caso que a rodada 3 apontou ("um PUT cortado pelo prazo pode terminar no storage depois que a aplicação desistiu"). A correção exigida era que o 503 do storage deixasse a linha. A spec só a deixa quando o `apagar` também falha.
   - Correção exigida:
     - na §5, passo 4, escrever que, quando a falha é do próprio `guardarBytes` (prazo ou erro), o `catch` tenta apagar o objeto mas **não** apaga a linha, que fica para a varredura de 1 h. Para as falhas depois de o `guardarBytes` confirmar (`CONFLITO`, `LIMITE_EXCEDIDO`, `LICENCA_VENCIDA`, `EDICAO_EM_ANDAMENTO`, commit), a ordem atual continua;
     - cenário [I] com o storage falso que estoura o prazo e grava o objeto **depois** do `apagar` do `catch`: 503, a linha fica, e com 61 min a varredura apaga o objeto e a linha;
     - mutação: apagar a linha no `catch` de falha do `guardarBytes`.

Recomendações:
- TS §5, varredura contra transação lenta: a varredura apaga o objeto antes da linha. Se a transação de um envio com mais de 1 h confirma nesse intervalo, nasce um material sem objeto, que termina `falhou` com `arquivo_ausente`. A falha é visível, não silenciosa. Duas saídas:
  - a varredura toma a linha com `for update skip locked` e só então apaga;
  - ou registrar o caso como aceito, com um cenário que prove o `falhou`.
- Declarar o `lockDuration` e o stalled da fila `pdf` em `WORKER_POOL_OPTIONS_BY_QUEUE` (vem da rodada 2).
- Registrar em `docs/infra.md` o disco do temporário no pior caso: 300 pendentes × 10 escolas × 20 MB, cerca de 60 GB.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/apps/api/src/rate-limit.module.ts

## test-engineer · 4ª rodada · APROVADO · 2026-11-11 10:47:43 · `tasks/prd-ingestao-do-material/revisao-spec.md`

VEREDITO: APROVADO

**Cenários exigidos:** os mesmos das rodadas 1 a 3. Nesta rodada contam também:
- a ordem objeto e depois linha, no `catch` e na varredura;
- a linha de `envio_de_material` que precisa existir na transação;
- as séries herdadas da leitura `for update`;
- as duas corridas da edição com o `PATCH`;
- o `arquivo_ausente` de material excluído.

**Cobertos:** os dois bloqueantes da rodada 3 estão atendidos.

| R3 | Situação | Onde |
|---|---|---|
| 1. O `catch` deixava PDF órfão | **Atendido.** O objeto sai primeiro e o objeto ausente conta. A linha só sai depois, e fica se o apagar falha. A varredura segue a mesma ordem. O cenário traz o storage que grava e estoura o prazo, com o `apagar` falhando no `catch`. Também estão lá a falha uma vez na varredura, a linha sem objeto e a falha numa escola que não para as outras. A mutação dupla é "linha antes do objeto, ou sem conferir o `apagar`": as duas deixam a linha sumir, e o teste fica vermelho. O "nada gravado" virou "nada em `material`". | TS §5 Envio (4), techspec.md:83-84; cenarios.md:26-30 |
| 2. A edição herdava séries velhas | **Atendido.** A transação "herda as séries lidas ali", depois do `for update` do alvo. O [P] tem a ordem fixa: a edição para depois do `guardarBytes`, o `PATCH` confirma e a nova nasce com as séries do `PATCH`. A mutação é "herdar as do passo 1". O segundo [P] põe o `PATCH` contra a transação aberta da edição: ele espera e recebe `EDICAO_EM_ANDAMENTO`. A mutação é tirar o `for update` do `PATCH`; sem a espera, o `PATCH` confirmaria, e o teste fica vermelho. | TS §5 (3), techspec.md:80-82; §4 l.71-72; cenarios.md:139-142 |

As recomendações da rodada 3 também foram feitas:
- o `delete` de `envio_de_material` que precisa achar a linha (TS:82-83, cenarios:31-32, com mutação);
- o `arquivo_ausente` de material excluído, que conclui sem efeito (TS:90-91, cenarios:53-54);
- o despachante no §2 (TS:22) e no [U] de configuração (cenarios:69-70);
- o controle negativo pela espera do PDF da B (cenarios:200-201);
- o `PATCH` sobre excluído ou substituído, e o limite próprio dele (cenarios:37, TS §7c:140);
- o chip com carregando e sem `fontes` (cenarios:185-186);
- a Falha final com 3 tentativas (cenarios:47);
- o mesmo `Clock` (cenarios:24-25);
- o `for update` do `PATCH` da licença, agora no TS §4:71.

A classificação de `envio_de_material` como `sem_pessoa` (TS §7:116) já fica guardada pelo teste que confere a `CLASSIFICACAO_DAS_TABELAS` com as migrations (`apps/api/test/architecture.test.ts:1245`).

**Bloqueantes:** nenhum.

**Recomendações:**
1. **Varredura contra commit, intercalados (TS §5 (4), cenarios.md:31-32).** O cenário só cobre a varredura que termina inteira antes da transação. Pode haver outra ordem:
   - a varredura apaga o objeto;
   - a transação do envio lento apaga a linha e confirma;
   - a varredura apaga a linha e não acha nada.

   O material fica confirmado sem objeto e cai em `arquivo_ausente`, que é falha visível com texto, sem órfão. Só acontece com um envio de mais de 1 h, por isso não bloqueia. Para fechar a janela, a varredura pode segurar a linha (`for update skip locked`) enquanto apaga o objeto: a transação do envio espera e recebe 503. Com isso entra um [P] para essa ordem.
2. **cenarios.md:53-54.** O [P] do material excluído entre `lerParaExtrair` e `lerBytes` não tem mutação, e a regra é nova. A mutação a pôr ali: tratar todo objeto ausente como `falhou`, sem olhar o `excluido_em`.
3. **Compose (TS §2, linha `infra/`, `compose`).** Escrever que `VAGAS_ESCOLA_PDF` entra no compose do worker e do despachante. Hoje só o [U] de configuração cita os dois.
4. **cenarios.md:3.** O cabeçalho diz "rodadas 1 e 2" e deveria dizer 1 a 3.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/achados/revisao-spec.md (o meu bloco da rodada 3)

## revisor-geral · 4ª rodada · REPROVADO · 2026-11-11 10:49:01 · `tasks/prd-ingestao-do-material/revisao-spec.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: divergência em TS §5 "Extração", que contradiz a tabela "3. Falha" da `onda-3b.md` (linha "PDF duplicado") e a D49
Portão local: não se aplica, porque é revisão de spec e não há código. O `conferir` responde "nunca passou nesta árvore", como nas rodadas anteriores.

**O meu bloqueante da rodada 3 foi atendido.**
- TS §5 (4) agora diz: o objeto sai primeiro (ausente conta), a linha só depois, e se o apagar falha a linha fica. A varredura segue a mesma ordem.
- `cenarios.md`, linhas 26 a 30: o `apagar` falha no `catch` e também na varredura, com a mutação "apagar a linha antes do objeto, ou sem conferir o `apagar`".
- O 503 virou "nada em `material`".
- O `delete` conferido na transação tem caso e mutação (linhas 31 e 32).
- A herança das séries lidas no `for update` está no texto e no [P] da linha 139.
- O `pdf-esperando` que não nasce e o RF8 como estado da tela estão na §11.

Bloqueantes:
1. **TS §5 "Extração", linhas 90 e 91: a regra nova de objeto ausente só poupa o material excluído. Na entrega repetida, um material `pronto` pode virar `falhou`.**
   - **O que está errado.** O worker lê os bytes antes da transição (cenários, linha 53: `lerParaExtrair`, depois `lerBytes`, depois a transição). Pela D49, a entrega é ao menos uma vez. Duas sequências quebram a regra:
     - Na reentrega depois do commit e do apagar, mas antes da confirmação do job, o `lerBytes` não acha o objeto.
     - No "PDF duplicado" (`onda-3b.md`, linha 127; cenários, linha 133), o segundo job passa do `lerParaExtrair` enquanto o primeiro dá commit e apaga.

     Nos dois casos o material está `pronto` e não excluído. A frase "objeto ausente de material excluído conclui sem efeito" não cobre isso, e o caso cai em "`arquivo_ausente` é falha definitiva". O job termina `falhou`, com `job.falhos`, alerta e linha na lista da operação, contra os "dois `concluido`" exigidos. E a TS não condiciona a transição para `falhou` com `arquivo_ausente` a `estado = 'processando'`: a regra da onda 3b fala da "falha final", e esta é uma falha numa tentativa só. Sem essa condição, um material pronto vira `falhou` e sai da busca. O defeito nasceu da correção desta rodada.
   - **Correção exigida.**
     - Na §5 "Extração", escrever: objeto ausente em material que já saiu de `processando` (excluído, `pronto` ou `falhou`) faz o job concluir sem efeito. Só o `processando` não excluído termina `falhou` com `arquivo_ausente`, pela transição `where escola_id = :escola and id = :id and estado = 'processando' and excluido_em is null`.
     - Em `cenarios.md`, "Corridas", acrescentar um [P]: dois jobs do mesmo material, o segundo parado entre `lerParaExtrair` e `lerBytes` até o primeiro dar commit e apagar o objeto. O material segue `pronto`, os dois jobs terminam `concluido` e não há `job.falhos`. Mutações: conferir só `excluido_em`; gravar `falhou` sem `estado = 'processando'`.

Recomendações:
- **Check do banco que barra o código novo (TS §3).** `material_falha_valida` (`packages/core/src/db/schema/material.ts:76`, `drizzle/0022`) aceita só `arquivo_invalido`, `sem_texto` e `extracao_falhou`. Gravar `arquivo_ausente` viola o check. A §3 deveria listar a troca, com `NOT VALID` e `VALIDATE` como os checks da fila (§7c).
- **Limite do `PATCH` (TS §7c, linha 140).** "300 por hora por escola" não tem limite por pessoa, e a regra 80, item 1, pede limite por usuário e por escola. A decisão é do `infra-guardian`. Faltam também o texto do 429 do `PATCH` em "Telas", porque "Muitos envios" não serve, e o caso do limite por pessoa no cenário da linha 37.
- **A varredura contra a transação lenta (TS §5 (3) e (4)).** Conferir o `delete` fecha só o caso em que a linha já saiu (cenários, linha 31). Duas sequências continuam abertas:
  - a varredura apaga o objeto e, antes de ela apagar a linha, a transação apaga essa linha e dá commit;
  - a transação já tem a linha travada, e a varredura apaga o objeto e espera a trava.

  Nos dois casos o material termina `arquivo_ausente`, uma falha visível e sem órfão, por isso não bloqueia. Para fechar: a varredura trava a linha com `for update skip locked` antes de apagar o objeto, com um [P] que deixa a linha travada pela transação.
- **Cabeçalho do `cenarios.md`, linha 3:** "rodadas 1 e 2" passa a ser "1 a 3".

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/prd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-reengenharia/onda-3b.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/packages/shared/src/material/material.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/packages/core/src/db/schema/material.ts

## revisor-geral · 5ª rodada · APROVADO · 2026-11-11 10:51:39 · `tasks/prd-ingestao-do-material/revisao-spec.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: não se aplica, porque esta é revisão de spec e não há código. O `conferir` responde "nunca passou nesta árvore. Rode `node tools/processo/portao-local.ts --tarefa`", igual às rodadas anteriores.

**O bloqueante da rodada 4 foi atendido.**
- **Material que já saiu de `processando` não vira mais `falhou`.** Está na TS §5 "Extração", linhas 91 a 93. `arquivo_ausente` vai a `falhou` só pela transição de sempre, que exige `estado = 'processando' and excluido_em is null` (linha 87). O objeto ausente de material `pronto`, `falhou` ou excluído encerra o job sem efeito. Isso fecha a reentrega depois do apagar e o "PDF duplicado" da `onda-3b.md:127`.
- **O check do banco entrou.** `arquivo_ausente` está em `FALHAS_DE_MATERIAL` e no check `material_falha_valida`, com `NOT VALID`/`VALIDATE`. O check existe em `packages/core/src/db/schema/material.ts:76` e a lista em `packages/shared/src/material/material.ts:42`.
- **O cenário pedido entrou.** O [P] dos dois jobs do mesmo material está em `cenarios.md:137-139`, com as duas mutações pedidas. O [P] do material excluído ganhou mutação (`cenarios.md:57-58`).

**As outras correções não abriram contradição** entre a Tech Spec, o `cenarios.md` e o PRD.
- **Falha do `guardarBytes`.** Na TS §5 (4), a linha fica para a varredura. Combina com o cenário de `cenarios.md:26-28` e com as 25 h do RF13 (PRD:58).
- **Varredura com `for update skip locked`.** A TS §5 (4) combina com o `delete` conferido na transação, no passo (3). Mesmo que a transação ainda não tenha travado a linha, a varredura que chega primeiro faz a transação desfazer com 503. Quando a transação já travou, a varredura pula a linha. Nos dois casos não nasce material sem objeto. Os dois lados têm cenário: `cenarios.md:32-35`.
- **Não há risco de deadlock.** A varredura não toma a trava de envios da escola, e a transação do envio só espera a linha.
- **Limite do `PATCH`.** São 100 por hora por pessoa e 300 por escola, fora do teto de envios. A TS §7c:142 bate com `cenarios.md:40-41`, que traz o texto próprio do 429.
- **Cabeçalho do `cenarios.md`.** Diz "rodadas 1 a 4".

Bloqueantes: nenhum

Recomendações:
- **TS §5 "Extração", linha 87.** O texto da transição traz só `estado` e `excluido_em`. A §6 já obriga o escopo, mas a regra 10 fica mais visível com `where escola_id = :escola and id = :id and estado = 'processando' and excluido_em is null` escrito por extenso, como no `update` da substituição na linha 89.
- **TS §5 (4), varredura.** A varredura segura o `for update` durante a chamada ao storage. Nesse tempo, a transação de um envio da mesma escola espera, presa à trava de envios. Convém declarar um prazo curto para o `apagar` dentro da transação da varredura, ou um `idle_in_transaction_session_timeout`, para que um storage lento não segure a trava de envios da escola.
- **`cenarios.md` "Telas", linhas 194-196.** O texto do 429 do `PATCH` só aparece no [I] da linha 41. Convém repeti-lo no [U] de textos, com os outros erros, para que a tarefa da tela o encontre.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/prd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/achados/revisao-spec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-reengenharia/onda-3b.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/packages/core/src/db/schema/material.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/packages/shared/src/material/material.ts

## infra-guardian · 5ª rodada · REPROVADO · 2026-11-11 10:51:59 · `tasks/prd-ingestao-do-material/revisao-spec.md`

VEREDITO: REPROVADO
Caminho quente tocado: tutor (leitura de página) | fila | migration | deploy (`worker-pdf`)
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: bloqueante
Métrica e alerta: ok

**O bloqueante da rodada 4 foi corrigido.**
- TS §5 Envio (4), techspec.md:83-85: quando o próprio `guardarBytes` falha, o `catch` tenta apagar o objeto e deixa a linha ("o PUT atrasado pode gravar"). Nas falhas depois de o `guardarBytes` confirmar, a ordem continua: o objeto sai primeiro, a linha depois.
- cenarios.md:26-28: o cenário [I] do PUT que grava depois do `apagar` do `catch`. Resposta 503, nada em `material`, a linha fica, e com 61 min a varredura apaga as duas coisas. A mutação é a que exigi.
- A recomendação de travar a linha na varredura também entrou: `for update skip locked` em techspec.md:85 e o [P] em cenarios.md:34-35, com a mutação. As duas ordens que ficaram abertas na rodada 4 agora fecham:
  - a varredura trava a linha primeiro: a transação espera, o `delete` não acha nada e responde 503;
  - a transação trava a linha primeiro: a varredura pula a linha.
- O limite do `PATCH` (100 por pessoa e 300 por escola, TS §7c:142, cenarios.md:40-41) e o `VAGAS_ESCOLA_PDF` no compose (TS §2:23) estão certos.

**A correção abriu um problema na migration.**

Bloqueantes:

1. **techspec.md:91-92 (TS §5 Extração) e TS §3 "Migrations" (techspec.md:48-51): o código novo grava `falha = 'arquivo_ausente'`, e o código anterior não consegue ler esse valor.** A volta do código (regra 80, item 9) derruba a lista de materiais.
   - **O que acontece.** A API anterior monta a resposta com `materialResponseSchema.parse` e `listaDeMateriaisResponseSchema.parse` (`apps/api/src/material/material.service.ts:79` e `:242`). Esses schemas validam `falha: z.enum(FALHAS_DE_MATERIAL)` (`packages/shared/src/material/material.ts:102`), e a lista antiga tem só `arquivo_invalido`, `sem_texto` e `extracao_falhou` (`:42`).
   - **O resultado.** Depois da volta, um único material com `arquivo_ausente` faz `GET /v1/materiais` responder 500 para aquela escola. Quebram a tela de Material da coordenação e o título dos materiais no artefato do professor (`apps/web/src/areas/professor/artefatos/api/titulos-dos-materiais.ts:14`).
   - **Por que a migration não resolve.** O `NOT VALID`/`VALIDATE` deixa a própria migration compatível, mas o dado que o código novo grava não é. E a spec já cuida da volta em outro ponto: grava `licenca_id` e também `licenciante` (TS §3:50).
   - **Correção exigida.**
     - Na TS §3, escrever o que o código anterior faz com o dado da F4. No mínimo: antes de voltar, `update material set falha = 'extracao_falhou' where falha = 'arquivo_ausente'`, e o check fica como está (não reverter).
     - Registrar a tarefa que escreve a seção "Voltar o código depois da F4 (rollback)" do `docs/runbook.md`, no molde das seções da 0035, da 0040 e da 0047.
     - Pôr um [I] em cenarios.md, "Migração": uma linha com `arquivo_ausente` passa pelo `listaDeMateriaisResponseSchema` antigo depois do passo do runbook. Mutação: pular o passo.

Recomendações:
- **Mesma seção do runbook.** Dizer o que fica para trás quando o código anterior volta:
  - os jobs da fila `pdf` em `job_registro`;
  - os materiais `processando` que o `varrerParados` antigo vai pegar;
  - as linhas de `envio_de_material` com o objeto no storage, que ninguém mais varre e que passariam das 25 h do RF13.
- **TS §5 (4), varredura com a linha travada.** A varredura segura a trava enquanto chama o `apagar` do storage. Nesse tempo, um envio lento espera dentro da transação que tem a trava de envios da escola, e os outros envios da escola param junto. Dar ao `apagar` da varredura um prazo curto, ou um `lock_timeout` ao `delete` da transação, que responde 503.
- Continuam abertas, desde as rodadas 2 e 3:
  - o `lockDuration` e o stalled da fila `pdf` em `WORKER_POOL_OPTIONS_BY_QUEUE`;
  - o disco do temporário no pior caso em `docs/infra.md` (300 × 10 × 20 MB, cerca de 60 GB).

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/packages/shared/src/material/material.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/apps/api/src/material/material.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/docs/runbook.md

## infra-guardian · 6ª rodada · APROVADO · 2026-11-11 10:54:27 · `tasks/prd-ingestao-do-material/revisao-spec.md`

VEREDITO: APROVADO
Caminho quente tocado: tutor (leitura de página) | fila | migration | deploy (`worker-pdf`)
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: compatível
Métrica e alerta: ok

**O bloqueante da rodada 5 foi corrigido.**
- **TS §5 Extração (techspec.md:93).** O objeto ausente grava `extracao_falhou`, que já está em `FALHAS_DE_MATERIAL` (`packages/shared/src/material/material.ts:42`). O `materialSchema` da versão anterior (`:102`) lê toda linha que a F4 grava. O check `material_falha_valida` não muda. A lista e o título no artefato não quebram na volta.
- **TS §3 Migrations (techspec.md:48-52).** O código grava `licenca_id` **e** `licenciante`, e a seção "Voltar o código depois da F4" do `docs/runbook.md` está registrada, com o que fica (jobs `pdf`, `processando`, `envio_de_material`) e a limpeza.
- **O que mais o código anterior lê, conferido.** Os jobs com fila `pdf` não travam o despachante antigo, porque ele percorre só as filas que conhece (`apps/despachante/src/outbox-relay.ts:135`). As vagas também não, porque se leem por chave (`packages/core/src/settings/operational-settings.ts:38`).
- **cenarios.md:157-158.** O [I] da volta do código está lá.
- **As duas recomendações da rodada 5 entraram.**
  - `lock_timeout` curto no `delete` da linha, com 503 (techspec.md:84). Ele corta a espera do envio, que segura a trava de envios da escola, enquanto a varredura segura a linha.
  - Prazo curto no `apagar` da varredura (techspec.md:86).

  Nenhuma das duas abre caminho novo. No caso normal, ninguém mais trava a linha antes de 1 h, então o `lock_timeout` não dispara.

Bloqueantes: nenhum

Recomendações:
- **cenarios.md:157-158, o [I] da volta do código.**
  - O teste precisa usar uma cópia congelada do schema anterior: as três falhas, e `licenciante` não nulo no material de terceiro. Se importar o `listaDeMateriaisResponseSchema` atual, ele passa mesmo quando alguém põe um valor novo no enum.
  - Falta a mutação. Sugestão: gravar um código novo de falha para o objeto ausente.
  - "Depois do passo do runbook" não diz qual é o passo, porque o dado já sai compatível sem passo nenhum.
- **techspec.md:93 e TS §7c "Métrica e alerta" (techspec.md:147).** No banco, `extracao_falhou` agora junta duas coisas: o objeto ausente e a falha final depois de 3 tentativas. Para o runbook separar perda no storage de falha do leitor de PDF, a métrica `resultado` e o log devem levar um código à parte, `arquivo_ausente`.
- **TS §3, a seção do runbook (techspec.md:51-52).** Dizer a ordem: limpar antes de o código anterior subir. Dizer também o que o `varrerParados` antigo faz com os `processando` da fila `pdf` e que texto a coordenação vê nesse caso.
- **Ainda abertas, desde as rodadas 2 e 3:**
  - o `lockDuration` e o stalled da fila `pdf` em `WORKER_POOL_OPTIONS_BY_QUEUE`;
  - o disco do temporário no pior caso em `docs/infra.md`: 300 × 10 × 20 MB, cerca de 60 GB.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/tasks/prd-ingestao-do-material/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/packages/shared/src/material/material.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material/apps/despachante/src/outbox-relay.ts

## test-engineer · 5ª rodada · SEM VEREDITO · 2026-11-11 11:02:35 · `tasks/prd-ingestao-do-material/revisao-spec.md`

As tabelas de "Testes que provam a regra" das 12 tarefas estão abaixo. Usei as legendas do `cenarios.md` (I, U, E, P, C). "Mutação" diz o que se tira para o caso ficar vermelho. As recomendações da Rodada 6 entraram como linhas, marcadas com **(R6)**. Não escrevi nenhum arquivo.

Pontos que valem para todas as tarefas:
- **Suíte de saídas depois do `guardarBytes`.** Ela nasce na 2.0, e cada tarefa acrescenta o caso da sua cláusula: a 6.0 põe `LICENCA_VENCIDA` reconferida na transação, e a 8.0 põe `EDICAO_EM_ANDAMENTO` e o `CONFLITO` da edição. A 2.0 não pode provar um código de erro que ainda não existe.
- **Ordem da linha [C].** A linha de carga está na 3.0, mas ela mede o p95 do turno do Tutor da escola B, que a 7.0 muda. Ou a 3.0 roda depois da 7.0, ou a 7.0 roda o cenário de novo, com o resultado na coluna "Caso" (aviso 3 da retro da F2c).
- **Mesmo relógio.** "Hoje", 59 e 61 min, 25 h e 29 ou 31 dias vêm sempre do mesmo `Clock` injetado, nunca de `Date.now()`. No e2e, o relógio fica parado com `page.clock` (autoconferência 10).

---

### 1.0 PDF extraído no worker

| Cenário | Tipo | O que prova |
|---|---|---|
| caminho feliz: job `material.extrair-pdf` na fila `pdf` | I | o material fica `pronto`, com os trechos por página, `processado_em` e `objeto_apagado_em` gravados, e o objeto apagado só depois do commit |
| Prazo (onda-3b) | I | com o relógio falso e o extrator que não resolve, dá `TEMPO_ESGOTADO` com a vaga livre; na 3ª tentativa o material fica `falhou` e o objeto é apagado |
| SIGTERM além da graça | I | dá `EXECUCAO_INTERROMPIDA` na última tentativa; com tentativa sobrando, o job fica `ativo` e o objeto fica |
| Falha final: as 3 tentativas da definição | I | o job fica `falhou`, `job.falhos{tipo}` sobe, o material fica `falhou` e o objeto é apagado |
| `sem_texto` e `arquivo_invalido`, um caso cada | I | vai a `falhou` numa tentativa só, com a vaga liberada |
| objeto ausente com o material em `processando` | I | grava `extracao_falhou` numa tentativa, e nenhum valor novo entra em `falha` |
| [P] material excluído entre o `lerParaExtrair` e o `lerBytes`, com o objeto já apagado | P | o job conclui sem efeito, sem `falhou` e sem `job.falhos`. Mutação: tratar todo objeto ausente como `falhou` **(R6)** |
| [P] dois jobs, o segundo parado entre o `lerParaExtrair` e o `lerBytes` até o primeiro dar commit | P | o material fica `pronto` e os dois jobs `concluido`. Mutações: conferir só `excluido_em`; gravar `falhou` sem `estado = 'processando'` |
| concorrência: PDF duplicado, dois jobs em `Promise.all` | P | o material fica `pronto`, os trechos entram uma vez e os dois jobs ficam `concluido` |
| Exclusão em `processando` | I | o objeto deixa de existir, e o job que chega depois sai sem gravar |
| isolamento, repository: contexto A com o id da B no `lerParaExtrair` | I | volta vazio. Mutação: tirar o `escola_id` |
| isolamento, job: job da A com o `materialId` da B | I | nada é lido nem gravado em escola nenhuma, e o estado e o objeto da B ficam intactos |
| Expurgo | I | o expurgo da A apaga os objetos da A e não toca os da B. Mutação: tirar o filtro de escola |
| log novo e métrica da extração | I | a linha leva ids, código, duração e contagem, e nunca título, nome do arquivo, licenciante nem texto; `arquivo_ausente` aparece à parte de `extracao_falhou` na métrica e no log **(R6)** |

Fora da contagem: os testes de hoje do `PdfExtractor` (duas colunas, fórmula quebrada) vão com ele para o `packages/core`. Permissão não se aplica, porque não há rota.

### 2.0 Nenhum PDF fica para trás

| Cenário | Tipo | O que prova |
|---|---|---|
| caminho feliz | I | a linha de `envio_de_material` existe antes do `guardarBytes`, e a transação a apaga; no fim há material e job, e nenhuma linha sobra |
| saída depois do `guardarBytes`: `CONFLITO`, `LIMITE_EXCEDIDO` reconferido sob a trava e commit forçado a falhar, um caso cada | I | o objeto e a linha são apagados. Mutação: tirar o apagar do `catch` |
| falha do próprio `guardarBytes`: o storage estoura o prazo e grava depois do `apagar` | I | dá 503, nada entra em `material` e a linha fica; com 61 min, a varredura apaga o objeto e a linha. Mutação: apagar a linha no `catch` |
| `CONFLITO` com o `apagar` falhando | I | a linha fica, e a varredura apaga os dois. Mutações: apagar a linha antes do objeto; apagar sem conferir o resultado |
| o `apagar` falha uma vez na varredura | I | a linha fica e sai na varredura da hora seguinte |
| queda entre o `guardarBytes` e o commit | I | com 59 min a varredura não apaga; com 61 min apaga, pelo mesmo `Clock`. Mutação: tirar a leitura de `envio_de_material` |
| linha sem objeto: queda antes do upload | I | a linha sai sem erro |
| a varredura apagou a linha de um envio lento | I | a transação não acha a linha, desfaz com 503 (o `delete` roda sob `lock_timeout`) e nada fica em `material`. Mutação: não conferir o `delete` |
| concorrência: [P] envio lento com a linha travada e a varredura das 61 min | P | a varredura pula a linha e não apaga o objeto, e o envio confirma `pronto`. Mutações: tirar o `skip locked`; tirar o travar |
| Órfão pós-commit (onda-3b), um caso por item | I | `pronto` há 25 h sai, há 23 h fica; `falhou` há 25 h, com o `apagar` falhando, sai (mutação: gravar `processado_em` só no sucesso); excluído há 25 h sai; `processando` há 25 h fica; o de antes da migration não entra |
| isolamento: órfão e `envio_de_material` em duas escolas | I | cada `apagar` roda no contexto da sua escola e grava só na sua linha. Mutação: um contexto só para as duas |
| falha numa escola | I | a varredura segue nas outras |
| o `@Unscoped` da varredura | U | o teste de arquitetura acha a justificativa no mesmo método, e a leitura é só de escola e id **(R6)** |
| log novo da varredura | I | a linha leva ids e contagens, e nunca chave do objeto com título, nome do arquivo nem licenciante |

### 3.0 Operação, alerta, fila `pdf` e carga

| Cenário | Tipo | O que prova |
|---|---|---|
| Reprocessar com um tipo que a 46.0 aceita | I | o job conclui, a cópia `failed` sai e a reconciliação não republica |
| concorrência: duas execuções do reprocessar em `Promise.all` | P | só uma reprocessa |
| recusa: `ia.*`, `titular.*` e `material.extrair-pdf`, um caso cada | I | o pedido é recusado, este último com "Tentar de novo é envio novo". Mutação: tirar o tipo da lista |
| Descartar o PDF, e `sistema.*` e `retencao.*`, um caso cada | I | o PDF deixa o material `falhou` e o objeto apagado; os outros dois tipos descartam |
| Descartar um job `aguardando` | I | recusado, com a linha, o material e o objeto intactos. Mutação: tirar o `where estado = 'falhou'` |
| Chamado: `--chamado` 0, negativo ou texto | I | recusado, com a linha e a auditoria intactas |
| Auditoria | I | `job.reprocessado` e `job.descartado` gravam o chamado; uma sentinela em `dados` fica fora da saída, da auditoria e do log |
| isolamento: listar com a escola A | I | não traz job da B. Mutação: tirar o filtro |
| fila `pdf`: escola A com 10 pendentes e vaga 2 | I | o PDF da B, enviado depois, conclui antes de a fila da A esvaziar. Mutação: ignorar a vaga |
| checks da migration | I | `job_registro_fila_valida` aceita `pdf`, e o de `vagas` aceita a chave `pdf` |
| configuração das vagas | U | `VAGAS_ESCOLA_PDF` vale 2 por padrão e cede a `configuracao_operacional_escola.vagas`, no worker e no despachante |
| configuração do `worker-pdf` | U | lê um PDF por vez, declara `lockDuration` e stalled **(R6)** e não sobe sem as variáveis do storage |
| alerta `pdf-parado`, termo a termo (alertas e ensaio) | I | não dispara no 1º job depois de horas sem PDF, nem com 300 pendentes e extrações terminando (inclusive `falhou`); dispara com o `worker-pdf` parado e um job pendente há 16 min; o alerta entra no `ensaio-alertas.ts` |
| [C] carga das 300 apostilas | C | ver os critérios logo abaixo |

Critérios da linha [C]:
- 300 PDFs do maior tamanho do seed passam pela rota real, com o guard, por três coordenadores.
- A escola B usa o Tutor no pico ao mesmo tempo.
- A vazão projeta as 300 entre 19h e 5h com uma réplica.
- O p95 do turno do Tutor da B fica até 500 ms acima da base.
- Nenhum statement passa de 1,5 s.
- O PDF que a B envia no meio espera no máximo duas extrações.
- Controle negativo: com `VAGAS_POR_ESCOLA_DESLIGADAS`, o cenário reprova.

A coluna "Caso" da linha [C] leva a corrida, e não o teste do script: o comando novo (`npm run carga:ingestao` e o `:controle-negativo`), a data, os números e a condição da máquina ("Quando a carga vale como registro").

### 4.0 Capítulos
[… 178 linhas cortadas]
