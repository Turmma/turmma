# Achados das revisões — `tasks/prd-classificacao-bncc/1_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-17 12:31:43 · `tasks/prd-classificacao-bncc/1_task.md`

VEREDITO: APROVADO

Tabelas verificadas:
- `habilidade_bncc` (`packages/core/src/db/schema/habilidade-bncc.ts`, `packages/core/drizzle/0059_habilidade_bncc.sql`) é pública e não tem `escola_id`. É a exceção que a regra 10, item 1, prevê para a BNCC. Ela está nomeada no item 1 das Regras transversais do `docs/modelo-de-dados.md`, que `apps/api/test/architecture.test.ts` confere. Não varia por período e não guarda dado de pessoa (`classificacao.ts`: `SEM_PESSOA`).
- `disciplina.componente_bncc` é uma coluna nova numa tabela que já tem `escola_id`. A disciplina não varia por ano letivo, então não precisa de `anoLetivoId`.
- O `UPDATE` da migration casa cada linha pelo nome dela. Não lê nem copia nada de uma escola para outra. `habilidade-bncc.int.test.ts` prova isso com a disciplina da B.

Queries verificadas:
- `DisciplinaRepository.travarPorId` (`packages/core/src/estrutura/disciplina.repository.ts`): `escola_id = requireEscolaId()` mais `id`, com `for update`.
- `DisciplinaRepository.definirComponente`: o mesmo escopo, tirado do contexto, na escrita.
- `DisciplinaRepository.criar`: `escolaId` vem de `requireEscolaId()`, e o componente sai do nome.
- `DisciplinaService.renomear` (`apps/api/src/estrutura/disciplina/disciplina.service.ts`): roda numa transação só. Se a trava não acha a linha, responde `NAO_ENCONTRADO`, a mesma resposta do id inexistente.
- O controller usa `IdPipe` (UUID) e `RequirePermissao('disciplina', 'renomear')`. O corpo é estrito (`renomearDisciplinaRequestSchema`): `escolaId` no corpo dá `ENTRADA_INVALIDA`, e o teste cobre esse caso. Nenhuma query string decide escopo.
- `definirComponenteDaDisciplina` (`apps/web/src/api/estrutura.ts`) manda só `componenteBncc`.
- Nenhum `@Unscoped()` novo.
- Esta tarefa não toca a camada de rede nem agregado.

Teste de isolamento: presente e efetivo. Está em `apps/api/test/estrutura.int.test.ts`, no caso "isolamento: a coordenação da A não alcança a disciplina da B…".
- Sem `escola_id` em `travarPorId`, a A leria a linha da B. Com o componente igual ao dela, não haveria o que mudar, e a resposta seria 200 em vez do 404 esperado. O teste quebra.
- Sem `escola_id` em `definirComponente`, a chamada direta ao repository no contexto da A deixaria de devolver `undefined`, e o componente da B no banco mudaria. O teste quebra.
- O corpo do erro é comparado com o do id inexistente e não contém o id da B. Nenhuma das duas escolas ganha registro de auditoria.

Bloqueantes: nenhum

Recomendações:
- `packages/core/src/db/schema/habilidade-bncc.ts`: a chave é `codigo` (texto), não UUID. Para tabela pública de referência isso se justifica, porque o código é oficial e não revela volume de dado de escola. Vale escrever essa justificativa no item 1 do `docs/modelo-de-dados.md`, para a regra 10, item 7, não voltar à discussão.
- `DisciplinaService.renomear` agora também define o componente. Um nome como `alterar` diria melhor o que o método faz.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-17 12:32:04 · `tasks/prd-classificacao-bncc/1_task.md`

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

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/shared/src/estrutura/disciplina.ts`: `disciplinaSchema` é `.strict()` e ganhou `componenteBncc`. Uma aba da coordenação que ainda tenha o bundle antigo carregado vai recusar a resposta de `GET/PATCH /v1/disciplinas` até recarregar a página. O padrão da casa é esse e o deploy fica fora do horário letivo, então isso não bloqueia. Mas convém registrar no `TODO.md` que todo campo novo em resposta estrita depende desse recarregamento.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/drizzle/0059_habilidade_bncc.sql:11-13`: o `SET LOCAL lock_timeout = '5s'` repete o que o `migrate.ts` já põe na conexão (`LOCK_TIMEOUT_MIGRACAO_MS`). Ele não faz mal. O comentário, porém, diz que o valor "vale para as que vierem depois no mesmo deploy" como se isso fosse efeito desta migration, e não é: o valor já vem da conexão. Vale enxugar o texto para ninguém copiar o `SET LOCAL` achando que ele é necessário.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/drizzle/0059_habilidade_bncc.sql:36`: o `ADD CONSTRAINT ... CHECK` sem `NOT VALID` varre `disciplina` com ACCESS EXCLUSIVE. Hoje cabe, porque a tabela tem dezenas de linhas por escola e o comentário justifica a escolha. Na próxima constraint em tabela que cresce com aluno, o caminho é `NOT VALID` seguido de `VALIDATE CONSTRAINT` em passo separado.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-17 12:32:05 · `tasks/prd-classificacao-bncc/1_task.md`

VEREDITO: APROVADO

Tela vista: sim (8 fotos lidas: o painel e o diálogo do componente, no computador a 1366 px e no celular a 360 px, na escola cheia e na vazia). A lista `Rolam a 1366 × 768` veio vazia. Na escola cheia, Física e Química aparecem como "Sem componente" porque a vitrine semeia a disciplina com componente nulo. Por isso nenhuma foto mostra o estado "com componente definido". Esse estado eu conferi só pelo código (`textoDoComponente`) e pelo `Estrutura.test.tsx`.

Estados: ok.
- Com dado e sem dado estão nas fotos. A linha da disciplina diz "Sem componente" ou "Componente da BNCC: X".
- Carregando e erro do painel são os de antes. O diálogo trata o erro ao salvar e fica aberto, com a escolha de pé para tentar de novo.
- O 404 mostra "Esta disciplina já não existe. A lista foi atualizada." e tira a nova tentativa. O texto diz o que aconteceu e o que fazer.
- "Sem componente" é uma opção real da `Select` e apaga o componente. A dica do campo diz o que isso causa ("o material não é classificado"). O vazio convida e não se desculpa.

Acessibilidade:
- O botão "Componente" tem nome acessível que começa pelo texto visível ("Componente da BNCC da disciplina X"), em `AnoEDisciplinas.tsx:87-90`.
- A `Select` tem `label` ligado ao campo e dica. O foco visível aparece nas fotos (anel azul na `Select`).
- O foco volta ao botão da linha ou ao título "Disciplinas" ao fechar.
- A seção anuncia o resultado por região `aria-live`, via `anunciar`.
- O `break-words` novo no `label` de `Select.tsx:51` evita corte do rótulo com nome longo de disciplina. O rótulo de "Componente da BNCC de Física" quebra bem a 360 px.

Chromebook fraco: sem impacto. A tela não traz lista nova, imagem nem dependência pesada. O `Select` é nativo e as 14 opções são constantes de `packages/shared`.

Celular:
- A 360 px não há rolagem horizontal nem texto cortado nas quatro fotos de celular.
- Os botões da linha (Renomear, Componente, Excluir) e "Salvar componente" têm cerca de 44 px de altura.
- A `Select` fica em largura total. Nada depende de hover.
- Em celular o diálogo empilha "Salvar componente" sobre "Cancelar".
- O corte em cerca de 800 px e o pedaço de outra tela ao fundo, nas fotos de celular, são do enquadramento da vitrine e não do componente.

Ação oficial protegida: sim. Definir o componente não é ação oficial: não gera nota nem publicação. Ele passa por diálogo com o alvo à vista (disciplina no rótulo, valor atual pré-selecionado) e botão explícito "Salvar componente". O `PATCH` é só da coordenação, audita antes e depois, e não agenda nada.

Bloqueantes: nenhum.

Recomendações:
1. `apps/web/src/areas/coordenacao/comum/pecas-da-lista.tsx:11-16`, visto em `.processo/vitrine/coordenacao--coordenacao-estrutura--Disciplinas--computador.png`.
   - A linha do painel é `md:flex-row`. Com o terceiro botão, a coluna do nome fica com cerca de 95 px a 1366 px. "Sem componente" já quebra em duas linhas.
   - Com dado, "Componente da BNCC: Língua Portuguesa" tende a quebrar em 3 ou 4 linhas e deixa a linha alta. Esse caso não está em foto. Não corta nem sobrepõe, porque `break-words` o segura.
   - Sugestão: no `Sheet`, empilhar nome e ações (`flex-col`) ou encurtar o detalhe para "Língua Portuguesa" sob um rótulo. Vale conferir com uma disciplina que já tenha componente.
2. A semente da vitrine da escola cheia deveria trazer uma disciplina com componente definido. Assim a próxima foto mostra o estado "com dado" desta tarefa, que hoje só o teste unitário cobre.
3. O título do diálogo ("Componente da BNCC") e o rótulo do campo ("Componente da BNCC de Física") repetem o termo. É aceitável porque o rótulo traz a disciplina. A dica já explica a sigla "BNCC" para quem não é da área, mas "Componente" sozinho no botão exige que a coordenação conheça o termo. Fica registrado como baixa prioridade.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-17 12:32:36 · `tasks/prd-classificacao-bncc/1_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. Esta tarefa não grava, não lê e não altera `Nota`. Ela cria a tabela pública `habilidade_bncc`, a coluna `disciplina.componente_bncc` e o `PATCH /v1/disciplinas/:id`. Todos com autor humano? Não se aplica.

Decisão autônoma sobre aluno: ausente. Nada no diff toca aprovação, reprovação ou encaminhamento de aluno. Quem define o componente é a coordenação, e a escolha automática pelo nome só põe um valor inicial de configuração da disciplina.

Aprovação registrada: ok. Nesta tarefa nenhuma IA produz saída. A auditoria nova, `disciplina.componente_alterado`, registra um ato humano da coordenação, com o valor de antes e o de depois (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/auditoria/acoes.ts:419-428`). O `PATCH` ainda não agenda nada; o job de classificação fica para a 6.0, e é lá que a aprovação da classificação precisa ser auditada.

Supervisão do tutor: ok. A tarefa não toca o tutor.

Autonomia declarada e visível: sim. Nenhum agente foi criado ou alterado, e a governança de agentes segue como estava.

Supervisão não é vigilância, D45 e D55: nada a apontar. Não há campo nem tela sobre aluno ou professor, nem nota ou conceito em discursiva ou redação. Também não há ranking de professor.

Fotos da tela: não há saída de IA, nota ou conceito em nenhuma delas. As fotos são as do painel e as do diálogo "Componente da BNCC", na escola cheia e na vazia, no computador e no celular. A dica "Sem componente, o material não é classificado." aparece só como configuração da coordenação e não induz uso. Cancelar e o X estão visíveis, e sair do diálogo é tão fácil quanto entrar.

Bloqueantes: nenhum.

Recomendações:
- Na escola cheia e na vazia, as fotos mostram "Física" e "Química" com "Sem componente" (`vazia--coordenacao--coordenacao-estrutura--Disciplinas--computador.png` e `coordenacao--coordenacao-estrutura--Disciplinas--computador.png`). A causa é o seed da vitrine, que insere a disciplina por SQL direto, sem o componente e sem passar pelo `criar` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tools/vitrine/escola.ts:230`). Por isso nenhuma foto mostra o estado "Componente da BNCC: Química". Isto é do `frontend-reviewer` e do `domain-researcher`, não da regra 70; fica registrado para a validação.
- Para a 6.0: o job disparado por `disciplina.componente_alterado` vai produzir a classificação por IA do material. A classificação por habilidade aparece na lista de alto risco do item 6a ("diagnóstico por habilidade") e precisa de AIA (D60). A entrega também precisa nascer pendente, com aprovação registrada, como manda o item 3, e o agente precisa ter o nível de autonomia declarado. A 6.0 deve ser auditada contra isso.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-17 12:32:42 · `tasks/prd-classificacao-bncc/1_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A tarefa cria duas coisas:
- a tabela pública `habilidade_bncc`, com código, descrição, etapa, componente, área, anos, versão e página, carregada do texto oficial da BNCC;
- a coluna `disciplina.componente_bncc`, que só aceita os valores de uma lista fechada.

Nenhuma das duas guarda dado de pessoa. As duas tabelas estão marcadas como "sem pessoa" em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/shared/src/privacidade/classificacao.ts:130-134`, e `docs/modelo-de-dados.md` registra a tabela pública sem dono.

Fora da tabela de dados do docs/lgpd.md: nada. Nenhum campo pessoal novo, então a tabela de dados não precisa de linha nova.

Autorização por objeto: ok.
- O `PATCH /v1/disciplinas/:id` filtra pela escola do token na leitura com trava (`travarPorId`) e também na escrita (`definirComponente`), em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/estrutura/disciplina.repository.ts:67-84`.
- Troquei o id na URL, mentalmente e pelo teste: a coordenação da escola A recebe 404 `NAO_ENCONTRADO`, a mesma resposta do id inexistente, com componente igual, componente diferente ou nome. O corpo não traz o id, a escola B não muda e nada vai para a auditoria (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/estrutura.int.test.ts:774-799`).
- O teste também chama o repository direto, então quebraria se alguém tirasse a cláusula de escola.
- Professor e aluno recebem o 404 de rota inexistente (`estrutura.int.test.ts:801-815`).
- A saída é um DTO estrito (`disciplinaSchema` com `.strict()`), validado com `parse` no service.

Logs: limpos. Não há logger nem console no service, no repository nem nas linhas novas do web e do e2e.

Auditoria: presente. A ação `disciplina.componente_alterado` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/auditoria/acoes.ts:419-428`) guarda só o componente antes e depois, num schema estrito, e é gravada na mesma transação, com a linha travada. A regra 20, item 10, não exige auditoria para essa ação, e ela existe mesmo assim. Não há leitura de dado de aluno, exportação, nota nem permissão envolvidas.

Envio externo: nenhum. O teste confirma que nenhuma `execucao_agente` nasce, e nada é agendado.

Seed/fixture: sintético. As fotos mostram "Colégio sintético da vitrine cheia 052e7e0b", "Coordenadora sintética 0b4288ad" e "Professor Sintético Davi 31fe90bf". As fixtures novas usam só nomes de disciplina ("Química", "Física", "Robótica"). O JSON da carga é o texto oficial da BNCC, com fonte e licença (CC BY 4.0) no cabeçalho.

Fotos da tela: o painel e o diálogo, no computador e no celular, na escola cheia e na vazia, mostram só o nome da disciplina e o componente ("Sem componente", "Componente da BNCC de Física"). Não aparece nenhum dado de aluno. Os nomes de professor e de coordenação que aparecem atrás do painel são de telas que já existiam, e são sintéticos.

Pergunta de fechamento: a tarefa não cria dado novo sobre aluno nem envio novo para fora. O que o sistema já responde sobre um aluno continua igual. Rodei os testes de auditoria (`acoes.test.ts`, `porta-unica.test.ts`) e de carga e componentes: 4 arquivos, 63 testes, todos passando.

Bloqueantes: nenhum.

Recomendações:
- Quando a 6.0 criar o job que refaz a classificação do material a partir de `disciplina.componente_alterado`, auditar de novo: aí sim pode haver envio de conteúdo do material ao provedor, e ele tem que ficar registrado em `ExecucaoAgente`.
- O cabeçalho do JSON diz "a confirmar com advogado" sobre a BNCC ser ato oficial (Lei 9.610, art. 8º, IV). Não é assunto de privacidade, mas convém o item continuar no `TODO.md` ou na techspec §12 até ser fechado.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-17 12:33:22 · `tasks/prd-classificacao-bncc/1_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum

**O que conferi.** As subtarefas 1.1 a 1.8 estão feitas e nada adianta a 2.0 nem a 6.0: o `PATCH` não agenda job e diz isso no docblock. As quatro divergências estão na `techspec.md` §3, linhas 45 e 46, e as duas que mudam regra estão também no `cenarios.md`, linhas 16 e 17. As fotos mostram o que o `docs/interface.md` descreve:
- a linha com "Sem componente" embaixo do nome;
- o botão "Componente" entre "Renomear" e "Excluir";
- o diálogo "Componente da BNCC", com a `Select` nomeada pela disciplina, a dica e "Salvar componente".

Não aparece nada fora do pedido.

Recomendações:
1. **Foto da escola cheia sem o estado "com componente".** Nas fotos, a disciplina "Química" aparece com "Sem componente". A causa é a vitrine, que insere direto no banco e pula o `criar`: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tools/vitrine/escola.ts:230`, `insert into disciplina (escola_id, nome)`. Quem olha a foto recebe o contrário do que a spec promete ("nasce com o componente que o nome diz"), e a escola cheia nunca fotografa a linha com componente. Gravar `componente_bncc` no insert da vitrine, ou passar pelo `DisciplinaRepository.criar`, resolve.
2. **Linha do `cenarios.md` para os checks novos.** A divergência dos checks de recorte da etapa, componente e área está na `techspec.md` §3 e tem teste (`habilidade-bncc.int.test.ts` › "a linha precisa ser do Fundamental…"), mas não tem linha própria no `cenarios.md`. Vale uma linha `[I]` ali.
3. **Seção errada na tabela de divergências.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/1_task.md:110` está "§6 item (b)". O item (b), a chave do job com a auditoria do `PATCH`, fica na §5 "Agendar" (`techspec.md:88`).
4. **Nomes que ficaram do tempo em que o `PATCH` só renomeava.** `DisciplinaService.renomear`, em `apps/api/src/estrutura/disciplina/disciplina.service.ts:35`, e `renomearDisciplinaRequestSchema`, em `packages/shared/src/estrutura/disciplina.ts:28`, agora também definem o componente. Um nome como `atualizar` diria o que fazem.
5. **Tipos genéricos com campo de disciplina.** `AlvoDoDialogo` (`apps/web/src/areas/coordenacao/estrutura/AnoEDisciplinas.tsx:42`) é usado também pela turma e ganhou `componenteBncc?`. `AcoesDaLinha` (`AnoEDisciplinas.tsx:77`) ainda recebe `tipo` como se fosse genérica, mas agora sempre mostra "Componente". Hoje só a disciplina a usa, então não há bug, mas o próximo que a reaproveitar para a turma leva o botão junto. Melhor deixar explícito que é da disciplina, ou tornar o botão opcional.
6. **Mudança em componente compartilhado.** O `Select.tsx` ganhou `break-words` no rótulo. É um ajuste de layout no componente compartilhado que a tabela "Arquivos previstos" não lista. É inofensivo, mas convém citá-lo no plano.

Arquivos centrais da revisão:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/estrutura/disciplina/disciplina.service.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/estrutura/disciplina.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/drizzle/0059_habilidade_bncc.sql`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/shared/src/bncc/componentes.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/coordenacao/estrutura/AnoEDisciplinas.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/coordenacao/estrutura/Estrutura.tsx`

## test-engineer · 1ª rodada · REPROVADO · 2026-11-17 12:33:35 · `tasks/prd-classificacao-bncc/1_task.md`

VEREDITO: REPROVADO

Encontrei um bloqueante: um item que a tabela de testes promete não tem teste.

**Cenários exigidos:**
- Caminho feliz: a carga das 913 habilidades (183 do Médio), as candidatas por série e componente, o componente casado pelo nome na migration e no `criar`, e o `PATCH` que define, troca e apaga o componente, com auditoria.
- Bordas do domínio:
  - a mesma disciplina escrita de três jeitos ("Química", "QUIMICA", " química ", "Educação   Física");
  - disciplinas que não casam ("Projeto de Vida", "Robótica");
  - renomear sem mudar o componente, nos dois sentidos;
  - Física, Química e Biologia no Fundamental procurando em Ciências;
  - material do 9º ano com o 1º do Médio;
  - JSON com um código a menos, que não pode apagar código;
  - Computação aceita pelo check e barrada pela carga;
  - a disciplina que outra pessoa excluiu com o diálogo aberto.
- Permissão: professor e aluno no `PATCH`.
- Isolamento: pela rota e no repository sozinho (`travarPorId`, `definirComponente`).
- Concorrência: dois `PATCH` iguais em paralelo e a ordem forçada pela trava da linha. Na tela: a falha com nova tentativa, o `PATCH` segurado e o `PATCH` segurado com troca de disciplina.

**Cobertos:**
- `habilidade-bncc.int.test.ts`: a carga, a idempotência, o `ON CONFLICT` sem apagar, os quatro códigos recusados (um `expect` cada), o check do recorte da etapa, a tabela pública e o casamento pelo nome nas duas escolas, sem desfazer o que a coordenação definiu.
- `carga.test.ts` e `componentes.test.ts`: o hash, as contagens e um caso por linha do `cenarios.md`. Rodei os dois: 17 casos, verdes.
- `estrutura.int.test.ts`:
  - o `criar` com e sem casamento, e renomear sem mudar o componente;
  - o `PATCH` com o antes e o depois na auditoria, o `null` que apaga e o mesmo componente que não audita;
  - as duas disciplinas da mesma escola, `ENTRADA_INVALIDA` e o check do banco;
  - isolamento com 404 igual ao do id inexistente, testando a rota e o repository;
  - professor e aluno recusados, sem nenhuma `execucao_agente`;
  - `Promise.all` de verdade e a ordem forçada com `esperarNaTrava`.
- `Estrutura.test.tsx`: carregando, erro na leitura, com dado, definir, "Sem componente" apaga, erro ao salvar, a disciplina que já não existe, e reabrir a mesma ou a outra.
- `e2e/estrutura.spec.ts`: 1366 × 768 (página que não rola, vocabulário de nota), 360 px (44 px e axe), falha com nova tentativa, `PATCH` segurado com "Salvando…" e o foco de volta, e a segunda pessoa.
- Conferi as mutações declaradas contra o `git diff`: cada cláusula com condição tem bloco, ou o motivo escrito na seção "Sem mutação". Nenhum `.skip`, nenhum mock de código nosso, nenhum provedor de IA.

**Bloqueantes:**

1. **"`PATCH` segurado com troca de disciplina" está na tabela (linha 59 do `1_task.md`) e não tem teste.**
   - O caso de recomeço em `e2e/estrutura.spec.ts:1044` segura o `PATCH` e o solta no mesmo diálogo. Só depois de fechar troca de disciplina, e aí não há mais pedido em andamento. Em `Estrutura.test.tsx` também não há caso assim.
   - A situação é alcançável: o `FormDialog` (`apps/web/src/components/dialogs.tsx:117`) deixa "Cancelar" ativo durante o envio.
   - A cláusula que protege esse caso é `dialogo.fecharSeAinda(aberta)` em `apps/web/src/areas/coordenacao/estrutura/Estrutura.tsx:401`. O diálogo da outra disciplina é do mesmo tipo, `componente_da_disciplina`. Trocar essa linha por `dialogo.fechar()` fecharia o diálogo da outra disciplina quando a resposta segurada chegasse, e nenhum teste ficaria vermelho.
   - **Correção exigida:**
     - O e2e: segurar o `PATCH` da disciplina X com `page.route`, fechar o diálogo com Cancelar, abrir o diálogo da disciplina Y e soltar a resposta. Exigir que o diálogo de Y continue aberto, com o valor de Y, e que a linha de X mostre o componente salvo.
     - O bloco ` ```mutacao ` correspondente (`dialogo.fecharSeAinda(aberta)` → `dialogo.fechar()`), citando esse caso.
     - Se a tela pretende impedir a troca enquanto salva, a linha da tabela precisa dizer isso, e o teste prova o impedimento.

**Recomendações:**
- O cabeçalho de `packages/core/drizzle/0059_habilidade_bncc.sql` diz que é o `componentes.test.ts` que confere o hash do JSON. Quem confere é `packages/core/src/db/bncc/carga.test.ts`.
- No caso do `PATCH` em `estrutura.int.test.ts`, as asserções de ausência de auditoria contam só os registros de `disciplina.componente_alterado`. Uma asserção sobre o total de auditoria da escola pegaria também uma ação escrita com outro nome.
- O `cenarios.md` fala em renomear "Química" para "Robótica". O teste usa "Química Orgânica" e "Robótica" → "Física", que provam o mesmo nos dois sentidos. Vale alinhar o texto do cenário.
- Em `habilidade-bncc.int.test.ts`, " química " é trocado por " física " por causa do índice único. O motivo está no comentário; só registro que o caso literal do cenário fica provado no teste de unidade (`componentes.test.ts`).
- O `Promise.all` de `estrutura.int.test.ts` poderia passar por sorte sem a trava. Ele está bem porque a ordem forçada prova a mesma coisa sem depender de tempo. Manter os dois juntos.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-17 13:13:52 · `tasks/prd-classificacao-bncc/1_task.md`

VEREDITO: APROVADO

Tabelas verificadas: só leitura do que mudou. Nenhuma tabela mudou nesta rodada. `disciplina` continua com `escolaId`. `habilidade_bncc` segue como tabela pública sem dono. A rodada só acrescenta, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/docs/modelo-de-dados.md`, o motivo de a chave ser o `codigo` em texto e não UUID: o código da BNCC é público, igual para todas as escolas, e não revela volume de dado de nenhuma. Isso basta para a regra 10, item 7.

Queries verificadas:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/estrutura/disciplina.repository.ts` não mudou desde a rodada 1. `definirComponente`, `travarPorId` e o restante continuam filtrando por `requireEscolaId()`, que vem do contexto autenticado.
- Os inserts novos dos dados de teste, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tools/vitrine/escola.ts:231` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/e2e/support/governanca.ts:69`, gravam `escola_id` explícito.
- Nenhum endpoint passou a aceitar `escolaId`. O corpo `{ componenteBncc, escolaId }` continua respondendo `ENTRADA_INVALIDA` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/estrutura.int.test.ts:768`).
- Conferi a árvore atual contra `15bcc16b`: não há diferença fora de `achados/` e `.processo/`, então o diff entregue corresponde ao código.

Teste de isolamento: presente e efetivo. O caso da linha 777 de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/estrutura.int.test.ts` ficou mais forte. Antes ele verificava só a ausência da ação `disciplina.componente_alterado`; agora conta todas as linhas de auditoria da escola A e da escola B, de qualquer ação. Se a cláusula `escolaId` sair da trava ou da escrita, o teste quebra em quatro lugares:
- o `PATCH` com o mesmo componente responderia 200 em vez de 404;
- o repository chamado direto devolveria a linha da outra escola;
- o componente da B mudaria no banco;
- a contagem de auditoria da B mudaria.

A resposta para o id da B continua igual, campo a campo, à do id inexistente, e não traz o id da B.

O e2e novo, do `PATCH` segurado com troca de disciplina, testa a tela e não o isolamento. Não alcança escopo.

Bloqueantes: nenhum.

Recomendações: nenhuma nova. As da rodada 1 viraram linhas no `TODO.md` ou estão justificadas na tabela "Recomendações sem aplicar" do `1_task.md`.

## frontend-reviewer · 2ª rodada · APROVADO · 2026-11-17 13:14:10 · `tasks/prd-classificacao-bncc/1_task.md`

VEREDITO: APROVADO
Tela vista: sim (8 fotos lidas, computador e celular, escola cheia e vazia, painel e diálogo do componente).
Estados: ok. Carregando e erro vêm do código e do e2e (`Estrutura.test.tsx` e `e2e/estrutura.spec.ts`), já aprovados na rodada 1. A foto mostra os dois estados com dado: "Componente da BNCC: Química" e "Sem componente". Nas duas escolas há linha, então nenhuma tela ficou em branco.
Acessibilidade: ok. O campo do diálogo tem rótulo ("Componente da BNCC de Física"), com ajuda abaixo e foco visível no select. Esta rodada não mexeu em código de interface. As mudanças foram teste, e2e, documentação e a vitrine.
Chromebook fraco: sem mudança. A lista de disciplinas é curta (dezenas por escola), então virtualizar não se aplica. Não há upload nesta tela.
Celular: ok a 360 px, com o painel e o diálogo sem rolagem lateral. Os botões "Renomear", "Componente" e "Excluir" e as ações do diálogo têm cerca de 44 px de altura e nada depende de hover. A página não rola a 1366 × 768 ("Rolam: nenhuma"). A tela não exige o celular.
Ação oficial protegida: sim. Esta tela não tem ação oficial. O diálogo mostra a disciplina e o componente antes de salvar, e o `PATCH` é auditado só quando o valor muda.

Conferi o diff contra a árvore:
- `Estrutura.tsx` usa `dialogo.fecharSeAinda(aberta)`, e a mutação nova do e2e depende desse ponto (a linha 344 e as vizinhas).
- `Select.tsx:51` tem `break-words`, e a mutação nova do e2e mira essa classe.
- O teste de API passou a contar toda linha de `auditoria` da escola. Ele deixou de comparar só a ação `disciplina.componente_alterado`, então uma ação gravada com outro nome não passaria despercebida.
- A vitrine semeia "Química" com `componente_bncc = 'quimica'` e "Física" sem componente, e as fotos confirmam.

Bloqueantes: nenhum.

Recomendações:
- `AnoEDisciplinas.tsx` (linha da disciplina, foto cheia a 1366 px): com o componente definido, os três botões empilham ao lado do nome, que fica com uns 100 px de largura. Os botões ficam à vista e sem corte, o texto lê, e a linha só cresce. Isso já está no `TODO.md` e na `pecas-da-lista.tsx`, compartilhada com outras listas. Quando for tratado, o melhor é colocar o nome em cima e as ações embaixo, como já acontece no celular.
- Foto do celular com o diálogo: o título "Componente da BNCC" e o rótulo "Componente da BNCC de Física" repetem o termo. Já estava registrado como aceitável.
- Vitrine: `tools/vitrine/foto.ts` reaproveita a sessão da escola antiga depois de `montar`. Já está no `TODO.md`.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-17 13:14:11 · `tasks/prd-classificacao-bncc/1_task.md`

VEREDITO: APROVADO
Caminho quente tocado: migration (só o comentário mudou nesta rodada; o SQL que roda não mudou)
Rate limit: ok (a rodada não tocou nisso)
Fila e prioridade: ok (a rodada não tocou nisso; o job do `PATCH` só entra na 6.0)
Concorrência: protegida (a trava `for update` não mudou; o teste dos dois `PATCH` simultâneos agora também confere que a auditoria da escola cresce exatamente em 1)
Índice e paginação: ok (a rodada não criou query nova)
Degradação de IA: não se aplica
Migration: compatível
Métrica e alerta: ok (a rodada não mexeu no caminho quente)
Bloqueantes: nenhum
Recomendações:
- A recomendação da 1ª rodada de usar `NOT VALID` e depois `VALIDATE` foi recusada, e o motivo serve hoje, porque a tabela tem só dezenas de linhas por escola. Ela continua valendo para a próxima constraint em tabela que cresce com aluno.
- `tools/vitrine/foto.ts` reaproveita a sessão depois de `montar`. Já está no `TODO.md`. Só afeta a ferramenta da vitrine, não o produto.

Conferências feitas nesta rodada:
- O arquivo `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/.processo/ordens/diff-1_task-r2.txt` é igual ao `git diff` entre as árvores `f3b6a232` e `15bcc16b`, tirando `achados/`. A árvore de trabalho também bate com `15bcc16b`. A única diferença é a linha que o hook acrescentou em `1_task.md`.
- O novo comentário de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/drizzle/0059_habilidade_bncc.sql` diz que o limite de espera por trava de 5 s vem da conexão. Está certo: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/db/migrate.ts:54` aplica `lock_timeout: config.lockTimeoutMs ?? LOCK_TIMEOUT_MIGRACAO_MS` no cliente do `migrar`.
- Os dados de exemplo de `tools/vitrine/escola.ts` e `e2e/support/governanca.ts` são sintéticos e gravam `componente_bncc = 'quimica'`, que passa no check `disciplina_componente_bncc_valido`.
- O caso novo do e2e segura o `PATCH` com `page.route` e não chama nenhum provedor.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-17 13:14:55 · `tasks/prd-classificacao-bncc/1_task.md`

VEREDITO: APROVADO

A rodada 1 não exigiu correção. O diff da rodada 2 confere com a árvore. Conferi `totalDeAuditoria` em `apps/api/test/estrutura.int.test.ts:696` e o uso dela nas linhas 767 a 862, `componente_bncc` no seed da vitrine e no do e2e, e o comentário sobre `lock_timeout` na migration 0059. A rodada só mexe em teste, comentário, documento e seed. Nenhum código de produção que trate dado de pessoa mudou.

Campos pessoais tocados: nenhum. Mudaram `componente_bncc` (dado de configuração da disciplina) e as linhas da tabela pública `habilidade_bncc`. Nenhum dos dois é dado de pessoa.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok.
- Os testes de rejeição agora comparam o total de linhas de auditoria da escola antes e depois. Antes procuravam só pela ação `disciplina.componente_alterado`. Os casos cobertos são: a escola A com o id da B (`apps/api/test/estrutura.int.test.ts:783-800`), professor e aluno com 404 igual ao de id inexistente (linhas 812-819), corpo inválido (767-774) e a trava sem gravação (844-862). Assim, uma ação gravada com outro nome também faria esses testes falharem.
- O novo e2e do `PATCH` segurado (`e2e/estrutura.spec.ts:1099`) cuida só do estado da tela.

Logs: limpos. A rodada não adicionou nenhum log.

Auditoria: presente. `disciplina.componente_alterado` é gravada uma vez por troca de fato, e o total da escola sobe exatamente 1 (`apps/api/test/estrutura.int.test.ts:825` e `836`).

Envio externo: nenhum nesta tarefa. A linha nova do `TODO.md` deixa para a 6.0 o registro do job em `ExecucaoAgente` e a AIA.

Seed/fixture: sintético.
- `tools/vitrine/escola.ts:231` e `e2e/support/governanca.ts:69` só põem `'quimica'` na disciplina Química.
- As fotos mostram só nomes sintéticos com sufixo de hash, como "Coordenadora sintética 8f01bf32" e "Professora Sintética Marta 760a5077", e uma escola chamada "Colégio sintético da vitrine".

Fotos: as oito (escola cheia e vazia, computador e celular, painel e diálogo) mostram só a tela da coordenação: ano letivo, séries, disciplinas, o componente e nomes sintéticos de professor e coordenadora. Nenhum aluno, matrícula, nota ou conteúdo aparece, e o diálogo mostra só o nome da disciplina e a lista de componentes.

Bloqueantes: nenhum.

Recomendações:
- A linha do `TODO.md` sobre `tools/vitrine/foto.ts` reaproveitar `sessao-<papel>.json` depois de `montar` merece prioridade. Uma sessão velha tira a foto de outra escola sintética: hoje não vaza dado real, mas confunde a revisão. A sessão deveria ser descartada quando a escola do `vitrine.json` muda.
- Continua valendo a da rodada 1, já registrada no `TODO.md`: a 6.0 registra o envio em `ExecucaoAgente` e manda só o identificador e o trecho do material ao provedor.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-17 13:15:03 · `tasks/prd-classificacao-bncc/1_task.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. Esta rodada não mexe na `techspec.md`. O caso `[I]` novo dos checks do recorte e o caso de renomear agora estão no `cenarios.md`. A linha de divergência do `1_task.md` passou a citar a seção certa (§5 "Agendar", item (b)).

Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)

Bloqueantes: nenhum.

Conferi o diff da r2 contra a árvore e ele bate com o que foi feito:
- O helper `totalDeAuditoria` está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/estrutura.int.test.ts:696`. As afirmações de ausência em `:774`, `:799-800`, `:819` e `:862` agora contam todas as ações de auditoria da escola, e não só `disciplina.componente_alterado`.
- O teste novo do `PATCH` segurado com troca de disciplina usa `gate`, `anuncio`, `dialogo` e `linhaDaDisciplina`, todos já definidos no spec. O contexto da mutação nova em `Estrutura.tsx:416-421` aparece uma vez só e bate.
- `LOCK_TIMEOUT_MIGRACAO_MS` existe em `packages/core/src/db/migrate.ts:17`, então o comentário novo da `0059` diz a verdade. `packages/core/src/db/bncc/carga.test.ts` também existe.
- O `break-words` do `Select.tsx:51` tem a mutação declarada.

Fotos: as da escola cheia mostram a Física com "Sem componente" e a Química com "Componente da BNCC: Química". O diálogo usa os termos do `docs/interface.md` e não traz nada fora da tarefa.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/1_task.md`, seção "Recomendações sem aplicar": a frase "As cinco primeiras viraram linha no `TODO.md`" não bate com a tabela. As que foram para o `TODO.md` são a 1ª, a 3ª, a 5ª, a 6ª e a 7ª; a 2ª e a 4ª foram recusadas. Escrever "as marcadas com `TODO.md`" ou algo parecido.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tools/vitrine/escola.ts:230`: a escola "vazia" agora tem a Química com componente. Assim as fotos dela mostram só o estado "com componente", e "Sem componente" aparece apenas na cheia. Não está errado, mas o comentário poderia dizer que a cheia cobre o outro estado.
- As fotos do celular cortam a 800 px, e o conteúdo da página aparece embaixo do `Sheet`. Parece artefato da captura de página inteira da vitrine, não defeito da tela. Fica para o `frontend-reviewer`, se ele achar que vale.
- Sigo concordando com as linhas que a r1 deixou no `TODO.md`: os três botões empilhados na linha da disciplina e renomear `renomear` para `atualizar`.

## test-engineer · 2ª rodada · APROVADO · 2026-11-17 13:15:11 · `tasks/prd-classificacao-bncc/1_task.md`

VEREDITO: APROVADO

**Cenários exigidos**
- O `PATCH` segurado com troca de disciplina, que era a correção exigida na rodada 1.
- A troca de `fecharSeAinda(aberta)` por `fechar()` tem bloco de mutação.
- O que mudou desde a rodada 1 continua coberto: a ausência de auditoria agora conta todas as ações, os checks do recorte da etapa e o renomear que não troca o componente.

**Cobertos**
- **A correção exigida (linha 59 de `1_task.md`):** o teste novo está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/e2e/estrutura.spec.ts:1099`. É "o `PATCH` segurado de uma disciplina e a troca para outra…", e segue o roteiro pedido:
  - segura o `PATCH` só da X com `page.route` e confere que "Salvando…" está desativado e que um pedido foi segurado;
  - cancela, confirma que o diálogo fechou, abre o da Y, confere que o campo começa vazio e escolhe `arte`;
  - solta a resposta da X e exige três coisas: a linha da X com "Componente da BNCC: História", o aviso da X, e o diálogo da Y aberto com `arte` (a linha da Y continua "Sem componente").
- **Por que a mutação fica vermelha pelo motivo certo:** o `aoSalvar` roda no `onSuccess` do `useSingleSubmit`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/coordenacao/estrutura/AnoEDisciplinas.tsx:428-431`, mesmo depois de o diálogo da X sair da tela.
  - O teste exige o aviso da X, então prova que o `aoSalvar` chegou a rodar.
  - Com `dialogo.fechar()`, o mesmo `aoSalvar` fecha o diálogo da Y, e `expect(doComponente).toBeVisible()` cai.
  - Conferir `campoDaY` com `arte` prova também que recarregar a lista não remontou o diálogo da Y.
- **O bloco ` ```mutacao ` em `1_task.md:434`:**
  - o contexto (`Componente da BNCC de ${disciplina.nome}: …` e o `)`) só existe uma vez, na linha 421 de `Estrutura.tsx`, no `aoSalvar` do `<ComponenteDaDisciplina`, e não na 401 do Renomear;
  - o nome citado é parte do título do teste e serve para o `--grep` do `tools/processo/mutacoes.ts:203`.
- **A mutação nova do `Select.tsx` (`break-words`):** o teste de 360 px (`e2e/estrutura.spec.ts:1020`) usa um nome com `'x'.repeat(40)`, uma palavra que não quebra sozinha. Sem `break-words` o rótulo transborda o diálogo, e `larguraExcedenteDoDialogo` passa de 0. O motivo da cláusula está certo.
- **`estrutura.int.test.ts`:** o novo `totalDeAuditoria` conta todas as linhas de auditoria da escola. A ausência, nos casos de entrada inválida, outra escola, papel sem permissão e trava, não esconde mais uma ação gravada com outro nome. Quem audita uma vez agora exige `antes + 1`. A árvore bate com o diff (14 ocorrências).
- **Os dois itens novos do `cenarios.md`:**
  - Os checks do recorte, do componente e da área estão em `packages/core/src/db/habilidade-bncc.int.test.ts:158`, um caso para cada restrição, e conferem que nada foi gravado.
  - "Química Orgânica" mantém Química, e "Robótica" renomeada para "Física" não ganha o componente de Física: `apps/api/test/estrutura.int.test.ts:709-711`.
- Não há `.skip` nem mock que esconda a regra. Nenhum teste chama provedor.

**Bloqueantes**
Nenhum.

**Recomendações**
- O teste novo não confere que o aviso da Y não aparece e que o campo da Y não muda depois da resposta da X. Hoje isso é coberto de forma indireta, porque o teste exige `campoDaY` com `arte`. Uma asserção que proíba o texto "Componente da BNCC de <Y>" no aviso deixaria o caso explícito.
- O título do teste novo é longo e repete o que a linha 59 já diz. Uma forma mais curta, como "troca de disciplina com o `PATCH` no ar", ficaria mais fácil de citar.

Não rodei os testes. A integração e o e2e precisam do banco e da pilha de pé, e as mutações já foram provadas pelo portão da tarefa. Conferi o diff da ordem contra a árvore, e ele bate.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-17 13:15:14 · `tasks/prd-classificacao-bncc/1_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. A rodada 2 mexe em testes de integração e e2e, documentos, no comentário da migration 0059 e em duas sementes sintéticas (`tools/vitrine/escola.ts:231`, `e2e/support/governanca.ts:69`). As duas sementes gravam só em `disciplina` (`componente_bncc = 'quimica'`) e não tocam em `nota`. Todos com autor humano? Não se aplica.
Decisão autônoma sobre aluno: ausente.
Aprovação registrada: ok. Nenhuma saída de IA nasce nesta tarefa. O componente vem do nome da disciplina, por uma tabela fixa (`COMPONENTE_PELA_CHAVE_DO_NOME`), ou é escolhido pela coordenação no diálogo. O `disciplina.service.ts` não chama gateway, fila nem `ExecucaoAgente`. O teste de integração confirma isso: `execucao_agente` tem a mesma contagem antes e depois do `PATCH`.
Supervisão do tutor: ok, porque a tarefa não toca no tutor.
Autonomia declarada e visível: sim, sem mudança. Nenhum agente novo, e o job da 6.0 ainda não existe.
Bloqueantes: nenhum.

Conferi o diff contra a árvore:
- `dialogo.fecharSeAinda(aberta)` existe em `apps/web/src/areas/coordenacao/estrutura/Estrutura.tsx:344/360/371`.
- `break-words` está no rótulo, em `apps/web/src/components/ui/fields/Select.tsx:51`.
- As duas sementes batem com o que o diff diz.
- A troca de `auditoriaDa(..., 'disciplina.componente_alterado')` por `totalDeAuditoria` (`apps/api/test/estrutura.int.test.ts`) deixa o teste mais rigoroso. Agora ele também pega uma ação gravada com outro nome no 400, no 404 de outra escola, no 404 de professor e aluno e na disputa pela trava. Isso reforça o item 6 da regra 70.

As oito fotos, nas escolas cheia e vazia, no computador e no celular (`.processo/vitrine/coordenacao--coordenacao-estrutura--Ano-letivo-e-disciplinas--*.png`, `...-button-name-Componente-i--*.png` e as `vazia--*`), mostram só:
- o painel "Ano letivo e disciplinas", com "Sem componente" ou "Componente da BNCC: Química";
- o diálogo "Componente da BNCC" com um `select`, "Salvar componente" e "Cancelar".

Nenhuma delas mostra nota, conceito, sugestão de nota, saída de IA sem rótulo ou algo que induza uso. O botão de cancelar tem o mesmo peso do de salvar. Também não aparece indicador de professor nem dado de aluno.

Recomendações:
1. O texto do diálogo diz "Sem componente, o material não é classificado" (`apps/web/src/areas/coordenacao/estrutura/AnoEDisciplinas.tsx` e `docs/interface.md`). Quando a 6.0 chegar, quem classifica é um agente. Vale a tela dizer que a classificação é feita pela IA e passa pela escola antes de valer. Fica para a 6.0, junto com a linha que já está no `TODO.md`.
2. Na revisão do `6_task.md`, conferir que a linha do `TODO.md` sobre a 6.0 foi cumprida. Ela pede `ExecucaoAgente`, AIA (D60), entrega pendente e autonomia declarada para o job disparado por `disciplina.componente_alterado`. Esse é o ponto da spec em que a regra 70 passa a valer de fato.
