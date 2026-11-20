# Achados das revisões — `tasks/prd-classificacao-bncc/13_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-20 08:53:03 · `tasks/prd-classificacao-bncc/13_task.md`

VEREDITO: APROVADO

A tarefa 13.0 não grava, expõe nem envia dado de pessoa. A resposta traz só códigos e textos da BNCC (tabela pública), contagens, o `serieId` e a etapa.

Campos pessoais tocados: nenhum. Não há migration nem coluna nova. O `coberturaResponseSchema` (`packages/shared/src/material/cobertura.ts:105-111`) é um `strictObject` com `serieId`, `etapa`, `materiaisEmUso`, `grupos` (cada um com `chave`, `total`, `semMaterial[{codigo, descricao}]` e `secoesSemClassificacao`) e `classificacaoSuspensa`. Não vai título de material, nome de quem enviou nem dado de aluno ou professor.

Fora da tabela de dados do docs/lgpd.md: nada, porque não entrou campo novo.

Autorização por objeto: ok.
- **Papel:** a rota `GET /v1/materiais/cobertura` exige `material.resumir` (`apps/api/src/material/material.controller.ts:123-127`), só da coordenação.
- **Professor e aluno:** recebem `NAO_ENCONTRADO`, provado em `apps/api/test/cobertura.int.test.ts:420`.
- **Rede:** a matriz dá `nunca` em toda ação de `material`, provado em `packages/shared/src/permissao/matriz.test.ts:172-173`.
- **Troca de id:** a série é buscada com `eq(serie.escolaId, requireEscolaId())` (`apps/api/src/material/cobertura.repository.ts:63`). Uma série de outra escola responde igual à inexistente, com caso próprio (`cobertura.int.test.ts:429`).
- **Material de outra escola:** não cobre habilidade da escola A, porque `materialEmUso` tem `requireEscolaId()` (`cobertura.repository.ts:37`).
- **Escola do token:** a consulta aceita só `serieId` (`z.strictObject`), nunca a escola vinda do cliente.
- **Sem escopo:** a única leitura sem escola é a da BNCC pública, com `@Unscoped` e o motivo (`cobertura.repository.ts:71`).

Logs: limpos. Nenhum log novo na API nem no web.

Auditoria: não se aplica. A tela é leitura de dado agregado e não pessoal (cobertura curricular por série). Não é leitura de dado de aluno, nem exportação, nota, permissão ou aprovação de saída de IA.

Envio externo: nenhum. A rota não chama provedor de IA. Ela só lê se a função `classificar_secoes` está suspensa.

Seed/fixture: sintético. As disciplinas são genéricas ("Língua Portuguesa", "Biologia"), as sessões vêm de `bancada.sessao` e o e2e usa os papéis sintéticos de sempre.

Erro: o 404 sai pelo `DomainException(ErrorCode.NAO_ENCONTRADO)` tipado (`apps/api/src/material/material.service.ts:744`), sem stack nem dado no corpo.

Endereço e sessão: o endereço leva só `?aba=cobertura`, de uma lista fechada (`apps/web/src/paths.ts`). A série escolhida não vai à URL e some na troca de sessão (`apps/web/src/areas/coordenacao/material/Cobertura.tsx:82`). A chave da cobertura fica sob a de Material, que `main.tsx` esvazia ao trocar de pessoa.

Pergunta de fechamento: esta tarefa não muda a resposta, porque não cria dado de titular nem destino de envio. O arquivo do titular continua cobrindo o que já cobria.

Bloqueantes: nenhum.

Recomendações:
- Hoje só a matriz prova que a rede não alcança `/v1/materiais/cobertura`. Um caso em `apps/api/test/cobertura.int.test.ts` com uma sessão de papel `rede` provaria pela rota, como já existe para professor e aluno. É cobertura extra, não falta de regra.
- Se um dia a cobertura listar o material que cobre cada habilidade, o título do material vira campo de exposição novo. Isso precisa reabrir esta auditoria. Por isso convém deixar escrito no docblock de `grupoDaCoberturaSchema` a frase "nenhum título de material" (`packages/shared/src/material/cobertura.ts:93`) como contrato que um teste confere, e não só como comentário.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-20 08:53:06 · `tasks/prd-classificacao-bncc/13_task.md`

VEREDITO: APROVADO

Tela vista: sim (4 fotos lidas, cheia e vazia, em 1366 e 360 px). Todas mostram a aba Cobertura **sem série escolhida**. As duas escolas, a cheia e a vazia, saem iguais, porque o seletor lista as séries da escola. A tela com a série escolhida (grupos, habilidades, aviso de capítulos sem classificação) não saiu na vitrine. Julguei-a por `Cobertura.tsx`, `Cobertura.test.tsx` e `e2e/material-cobertura.spec.ts`. Não rodei teste nenhum, e a tela com a série escolhida não foi vista.

Estados: ok. Fico só com o que o código mostra e com o que o teste diz que ele mostra.
- **Séries:** `Cobertura.tsx:90-96` trata carregando, erro com "Tentar de novo", vazio ("Nenhuma série ainda", que diz o que fazer) e o seletor.
- **Cobertura da série:** `Cobertura.tsx:52-56` trata carregando, erro com "Tentar de novo" (a falha não afirma "sem material"), vazio que convida a enviar material da série, e os grupos.
- **Série não escolhida:** a tela convida a escolher.
- **Testes:** `Cobertura.test.tsx` e o e2e cobrem cada estado.

Acessibilidade: ok.
- O seletor é o `select` nativo, com `label` ligado por `htmlFor`.
- Cada grupo é uma `section` com `aria-label` ("Componente: …" ou "Área: …").
- Os avisos usam `Alert` e `ErrorState`.
- As cores vêm só dos tokens (`text-tinta`, `text-apoio`, `border-borda`).
- O e2e roda o axe no seletor e em um grupo e exige zero violação grave.

Chromebook fraco: sem bloqueio.
- A série não vai ao endereço, e cada série é uma consulta própria (a resposta atrasada de uma não cai sob outra).
- Não há laço de releitura.
- Não há lista virtualizada nem dependência nova.
- Cada grupo pode trazer até 300 habilidades (`MAXIMO_DE_HABILIDADES_NA_LISTA`), todas como `<li>` simples no DOM. É leve, e o e2e confere a página inteira de uma série.
- Não vi teste com throttling de CPU e de rede nesta tarefa (a regra só tem a revisão para garantir isso). Vai como recomendação.

Celular: ok.
- **Fotos a 360 px:** não há rolagem horizontal nem texto cortado. O seletor tem cerca de 48 px de altura. As duas fileiras de abas quebram sem esconder nenhuma.
- **Código:** não há hover nem atalho. As linhas empilham (`flex-col`, `sm:flex-row`) e o texto quebra (`break-words`).
- **e2e:** nos projetos `chromebook` e `celular`, ele checa que 1366 × 768 não rola, que 360 px não tem rolagem lateral, que o alvo tem 44 px no celular e 24 px no computador, e que o botão "Tentar de novo" tem o mesmo tamanho.
- **Fluxo:** nenhum passo exige o celular.

Ação oficial protegida: sim. A tela é só leitura, sem botão de classificar, corrigir ou aprovar, e o teste prova isso. Não há saída de IA nesta tela. A classificação é de IA, mas a tela só mostra códigos, descrições e contagens, e o aviso de função suspensa fica no alto.

Bloqueantes: nenhum.

Recomendações:
- `Cobertura.tsx:20-32`: se um grupo chegar perto das 300 habilidades, considere recolher a lista atrás de "Mostrar todas". Só vale se a medida em Chromebook mostrar custo.
- `docs/interface.md` e o PRD: confirme, na rodada de validação, a medida com throttling de CPU e de rede da tela com a série escolhida. A vitrine não a fotografou, então vale uma foto com `--clicar` e a série escolhida (o select nativo exige o clique no seletor e a escolha da opção).
- `Cobertura.tsx:38`: o `aria-label` da seção ("Componente: Ciências") repete o título `h3`. Poderia ser `aria-labelledby` apontando para o `h3`. Não bloqueia.

Arquivos principais:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/coordenacao/material/Cobertura.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/coordenacao/material/Cobertura.test.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/e2e/material-cobertura.spec.ts`

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-20 08:53:09 · `tasks/prd-classificacao-bncc/13_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nem migration nova. As tabelas que a tarefa lê são `serie`, `material`, `material_serie`, `secao_do_material`, `habilidade_da_secao`, `disciplina`, `execucao_agente`, `licenca_de_material` e `suspensao_de_funcao`. Todas têm `escola_id`. Em `material_serie`, as chaves estrangeiras compostas `(escola_id, material_id)` e `(escola_id, serie_id)` impedem que um material de uma escola seja declarado para a série de outra (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/db/schema/material.ts:140-141`). `habilidade_bncc` é tabela pública e fica sem `escola_id`, como a regra 10, item 1, permite.

Queries verificadas (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/cobertura.repository.ts`):
- `serieDaEscola` (linha 63): filtra `serie.escolaId` por `requireEscolaId()`.
- `materialEmUso` (linha 37): filtra `material.escolaId` por `requireEscolaId()`. `declaradoParaASerie` e `proprioOuComLicencaVigente` também usam a escola do contexto.
- `consultaDasCobertas` (linha 100) e `secoesSemClassificacao` (linha 134): escola do contexto no `where` e escola igualada em cada junção.
- `materiaisEmUso`: passa por `materialEmUso`.
- `SuspensaoRepository.estaSuspensa`: escola do contexto.
- `habilidadesDaSerie` (linha 71): é a única marcada com `@Unscoped`, e a justificativa está escrita (tabela pública, sem dado de escola nem de pessoa).

Nenhum método recebe `escolaId`. O contrato `coberturaQuerySchema` é `strictObject({ serieId: z.uuid() })`, então mandar `escolaId` na query string dá `ENTRADA_INVALIDA`, e há teste para isso. Os ids são UUID. A série de outra escola e a inexistente respondem o mesmo `NAO_ENCONTRADO`. A resposta só leva ids, códigos e descrições da BNCC e contagens, sem título de material, e um teste confere isso. A rede nunca alcança `material.resumir`, o que está provado em `matriz.test.ts`. Professor e aluno recebem `NAO_ENCONTRADO`.

Teste de isolamento: presente e efetivo. O caso "a série da outra escola, e a que não existe, respondem o mesmo `NAO_ENCONTRADO`" quebra se `eq(serie.escolaId, requireEscolaId())` sair: a série da B seria achada e a rota responderia 200 com a lista da BNCC. A tarefa declara essa mutação.

Bloqueantes: nenhum.

Recomendações:
- O caso "o material da B que cobriria a habilidade que falta à A não cobre" (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/cobertura.int.test.ts:448`) não quebra se as cláusulas de escola do material e da seção forem tiradas sozinhas. Quem barra o material da B nesse caso é o `serieId` da A, que já trava `material_serie` pela chave composta. Hoje esse caso prova o resultado, mas não prova o escopo do material. Ou se escreve no caso que a garantia é estrutural, ou se acrescenta um caso que chame o repository num contexto da A com o `serieId` da B (como `material-isolamento` faz com o fragmento da licença), para provar o `eq(material.escolaId, requireEscolaId())` de `materialEmUso`.
- O documento da tarefa (`13_task.md`, seção "Mutações") registra sem bloco quatro cópias do escopo de escola nas junções e no `where`, com o motivo escrito. É defesa em profundidade aceitável, mas convém levar à retro: um escopo que nenhum teste mata depende só da revisão e da guarda `escopo-dos-repositories`.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-20 08:53:13 · `tasks/prd-classificacao-bncc/13_task.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum. É uma leitura da coordenação, `GET /v1/materiais/cobertura`, feita quando ela escolhe a série. A tela não tem laço de releitura.
Rate limit: ok. A rota passa pela `RateLimitGuard` global, que limita pelo `sub` e pelo `esc` do token, com os limites da escola (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/app.module.ts:165-171`). Nada é limitado só por IP.
Fila e prioridade: ok. Não há job novo e nada demorado roda no request: são quatro leituras curtas e não há chamada de modelo.
Concorrência: protegida. A rota só lê. A corrida da tela, em que a resposta de uma série chega quando outra já foi escolhida, está resolvida com uma chave de consulta por série e `key={serieId}`, e tem caso de e2e com a resposta segurada.
Índice e paginação: ok. `secao_do_material_pagina_idx (escola_id, material_id, …)`, `habilidade_da_secao_pk (escola_id, secao_id, codigo)` e `material_serie_serie_idx (escola_id, serie_id, …)` começam todos pela escola. O teste do plano (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/cobertura.int.test.ts:489`) monta 300 apostilas e 7.500 seções e exige que as duas tabelas grandes entrem por índice, com `escola_id` na condição, sem `Seq Scan` e abaixo de 200 ms. A resposta não é paginada, e isso está no fora do escopo: a lista é limitada pela BNCC da série, o maior grupo fica em cerca de 100 habilidades e o schema corta em 300.
Degradação de IA: não se aplica.
Migration: não se aplica.
Métrica e alerta: ok. O middleware global `http.server.request.duration` mede a rota. Não há alerta novo.
Bloqueantes: nenhum.
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/cobertura.repository.ts:136` (`secoesSemClassificacao`) e `:122` (`materiaisEmUso`): o `EXPLAIN` cobre só `consultaDasCobertas`. As outras duas usam o mesmo filtro e os mesmos índices, mas seria bom estender o caso do plano a elas, com o mesmo volume da carga.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/material.service.ts` (o `Promise.all` com as quatro consultas): se `banco` for o pool, cada requisição ocupa até 4 conexões ao mesmo tempo. Com o uso esperado da coordenação isso não pesa, mas vale conferir a espera do pool (`observeDatabasePool`) quando a cobertura entrar num cenário de carga.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-20 08:53:16 · `tasks/prd-classificacao-bncc/13_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A tarefa 13.0 só lê. A rota nova `GET /v1/materiais/cobertura` e `CoberturaRepository` não gravam nada, nem em `Nota` nem em outro lugar. Todos com autor humano? Não se aplica, porque não há escrita.

Decisão autônoma sobre aluno: ausente. A cobertura junta material e habilidades da BNCC por série e componente. Não traz aluno, turma nem resultado.

Aprovação registrada: ok. Nenhuma saída de IA chega ao aluno por este fluxo. A tela usa a classificação dos capítulos, que é de uso interno da coordenação. É só leitura: corrigir e reclassificar continuam no painel do material.

Supervisão do tutor: não se aplica, porque a tarefa não toca o tutor.

Autonomia declarada e visível: sim. A função `classificacao_do_material` já estava declarada antes desta tarefa (`packages/shared/src/governanca/governanca.test.ts:117`). A cobertura respeita a suspensão dessa função: com ela suspensa, só valem as habilidades que a coordenação corrigiu, e a tela avisa no alto.
- O filtro está em `apps/api/src/material/cobertura.repository.ts`, no método `consultaDasCobertas` e em `secoesSemClassificacao`.
- O teste é `apps/api/test/cobertura.int.test.ts:378-416`.
- O aviso na tela vem de `apps/web/src/areas/coordenacao/material/Cobertura.tsx`, na constante `AVISO_DA_SUSPENSAO`.

Demais itens:
- **Auditoria:** a tarefa não cria saída de IA nem aprovação nova, então não há o que registrar.
- **Supervisão não é vigilância:** não há dado de pessoa nem de comportamento. O contrato só leva ids, códigos, descrições da BNCC e contagens, e o teste está em `apps/api/test/cobertura.int.test.ts:476`.
- **D46/D55:** não há nota, conceito nem pontuação. O e2e confere que nenhuma dessas palavras aparece na tela (`e2e/material-cobertura.spec.ts:17-18` e `:113`).
- **Medir o professor (D45, D64):** a cobertura é por série e componente, e o assunto é o material que a coordenação sobe (D75). Não aparece nome de professor nem título de material, e o professor não chega à rota: o teste de permissão está em `apps/api/test/cobertura.int.test.ts:420`, e o caso da rede em `packages/shared/src/permissao/matriz.test.ts:172-173`.
- **Fotos da tela:** o prompt não trouxe fotos, então auditei só pelo código.

Bloqueantes: nenhum.

Recomendações:
1. **A origem da cobertura só aparece com a função suspensa.** Hoje a tela só cita a IA no aviso de suspensão. No uso normal, a lista de habilidades sem material vem também da classificação feita pela IA, e a tela não diz isso. O lugar é o subtítulo de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/coordenacao/material/Cobertura.tsx` ("As habilidades da BNCC da série que nenhum material em uso cobre, por componente."). Uma frase curta resolveria, algo como "os capítulos são classificados pela IA e a coordenação corrige no painel do material". Isso segue a regra 70, item 4a (saída de IA marcada como IA). Se entrar, atualizar também o trecho correspondente em `docs/interface.md`.
2. **O caso da rede está em teste que não é da cobertura.** O teste de que a rede não alcança a cobertura existe só na matriz de permissão (`packages/shared/src/permissao/matriz.test.ts`). Na integração da rota, o teste de `:420` cobre professor e aluno. Pôr a rede no mesmo caso fecharia a regra 10, item 8 no ponto da rota. É cobertura a mais, não falta.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-20 08:53:23 · `tasks/prd-classificacao-bncc/13_task.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. A divergência que muda o contrato (`materiaisEmUso`, `serieId`, `etapa` e `classificacaoSuspensa` na resposta de `GET /v1/materiais/cobertura`) está registrada na `techspec.md` §4, linha 67, e no `cenarios.md`, em "Cobertura (RF19)". As outras três que o `13_task.md` chama de divergência não contrariam a Tech Spec:
- **Todos os componentes da série aparecem:** é a leitura literal de "candidatas da série menos as habilidades das seções" (§5).
- **A série não vai ao endereço:** a §9 e o `cenarios.md` não falam disso, e a regra está no `docs/interface.md`.
- **O caso de e2e da pessoa seguinte saiu:** ele estava só na tabela da tarefa. O `cenarios.md` pede, para a cobertura, apenas o [U], e esse caso existe.

Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")

Bloqueantes: nenhum

Recomendações:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/coordenacao/material/Cobertura.tsx:88`: o subtítulo diz "por componente" mesmo numa série do Médio, onde os grupos são áreas. O `aria-label` do grupo (linha 38) já troca para "Área". O subtítulo poderia acompanhar a etapa, ou dizer "por componente (por área, no Ensino Médio)".
2. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/13_task.md:100-102`: três itens da seção "Divergências" não divergem da Tech Spec. Ficam melhor em "decisões de implementação", para que a validação e a retro não os confundam com divergência que faltou registrar na `techspec.md`.
3. O `TODO.md` marca como feito o item do `EXPLAIN` da 5.0. Mas `infra/scripts/carga-classificacao.ts` (`medirOsPlanos`) continua medindo a forma antiga da consulta, e o cenário da carga não mede a consulta real. Vale um item novo, com dono, para o script ler o `.toSQL()` de `CoberturaRepository.consultaDasCobertas`. Assim o cenário da carga passa a medir a mesma consulta que o teste de integração mede.
4. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/shared/src/material/cobertura.ts:60-61`: há uma linha em branco duplicada.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-20 08:55:41 · `tasks/prd-classificacao-bncc/13_task.md`

VEREDITO: REPROVADO

Cenários exigidos: todas as linhas da tabela "Testes que provam a regra" da 13.0, mais as linhas de `cenarios.md` que a tarefa cita: "Cobertura (RF19)" (167-170), "Permissão e isolamento" (174, 178, 181), o componente apagado em "Seções e agendamento" (53, 59) e "Telas" (251-252). Pelo domínio, entram também o isolamento (série e material da B), a permissão (professor, aluno e rede), a virada de sessão no mesmo computador e a resposta atrasada de uma série. Não há escrita concorrente: a rota só lê.

Cobertos: cada linha da tabela tem o seu caso, citado pelo nome, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/cobertura.int.test.ts` (22 casos, verdes aqui), em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/coordenacao/material/Cobertura.test.tsx` (15 casos, verdes aqui), em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/e2e/material-cobertura.spec.ts` e em `matriz.test.ts` (a rede). As asserções olham o resultado: o código na lista, a contagem do grupo, o `materiaisEmUso` e o mesmo `NAO_ENCONTRADO` para a série da B e para a inexistente. Não há `.skip`, nem teste comentado, nem chamada a provedor. O mock de `aoTrocarDeSessao` só embrulha o real e não esconde a regra.

O motivo dado para as cláusulas de `escola_id` sem bloco se sustenta. Conferi no schema: `material_serie_serie_da_escola_fk` e `material_serie_material_da_escola_fk` são chaves compostas, então o material da B nunca fica declarado para uma série da A. Quem prova o isolamento é o escopo da série, e esse tem bloco.

Bloqueantes:

O `--faltando` só marca linha que tem `if`, `&&`, `||`, `??`, ternário, `.where(` ou regex. Por isso as cláusulas abaixo passaram sem item, sem bloco e sem motivo, e o portão nunca as provou vermelhas. Todas decidem a regra da cobertura, e todas têm teste que as derrubaria, então falta só o bloco.

1. **`apps/api/src/material/cobertura.repository.ts:37-41`**, os termos de `materialEmUso`. É o filtro de "material em uso" das linhas 45 e 47 da tabela e da linha 170 do `cenarios.md`, e vale para as três consultas. Nenhum termo tem bloco. A correção exigida é um bloco por termo, cada um tirando só aquela linha do `and(`:
   - `eq(material.estado, 'pronto')` → `… ainda não pode ou não deve se valer` (`processando`, `falhou`)
   - `isNull(material.excluidoEm)` → `a série sem material lista todas as habilidades dela…` (o excluído volta)
   - `declaradoParaASerie(banco, serieId)` → `` `EF69LP01` num material só do 6º não cobre o 7º ``, ou `` `materiaisEmUso` conta só… ``
   - `proprioOuComLicencaVigente(banco, hoje)` → `… ainda não pode ou não deve se valer` (licença vencida)
   - `eq(material.escolaId, requireEscolaId())` → este não tem como ficar vermelho, pela chave composta. Ele precisa de motivo na seção "Mutações", com o termo exato entre crases.

2. **`apps/api/src/material/material.service.ts:753`**, o `cobertas.filter(({ componente, codigo }) => habilidadeEhCandidata(codigo, componente, [recorte]))`. É a regra de que o código só cobre se for candidato do componente da disciplina do material (Matemática com `EM13LGG101`, Filosofia com `EF69LP01`), e não tem bloco. A correção exigida é um bloco que tire o filtro (`cobertas.filter(...)` → `cobertas`), citando `no Médio a cobertura é por área…` ou `Biologia no Fundamental procura em Ciências…`.

3. **`apps/api/src/material/cobertura.repository.ts:78`**, o `coalesce(${habilidadeBncc.area}, ${habilidadeBncc.componente})`. É a regra "no EM, por área" (linha 48 da tabela). O único bloco perto dela mexe no filtro de etapa e ano, não no agrupamento. A correção exigida é um bloco que inverta a ordem para `coalesce(componente, area)`: o `EM13LP01` cairia em `lingua_portuguesa` e a lista exata de grupos de `no Médio a cobertura é por área…` quebraria.

4. **`apps/web/src/areas/coordenacao/material/Cobertura.tsx:38`**, o ternário `etapa === 'em' ? 'Área' : 'Componente'` dentro do `aria-label`. O `--faltando` não o vê porque o template literal é apagado antes da análise. A correção exigida é um bloco (por exemplo `etapa === 'em'` → `false`), citando `no Médio o grupo é a área…`.

Recomendações:

- **Resposta atrasada no e2e** (`e2e/material-cobertura.spec.ts:173-195`). O `queryFn` repassa o `signal`, então o TanStack Query provavelmente aborta a leitura do 6º quando o componente desmonta. O `.catch(() => undefined)` engole o aborto, e a "resposta atrasada" pode nunca chegar à página. O caso ainda derrubaria uma chave sem a série, mas vale registrar se a leitura do 6º terminou ou foi abortada e afirmar sobre isso.
- **`o material do Fundamental e do Médio juntos… e o do outro não vale`** (`cobertura.int.test.ts:305`). A metade negativa é vazia por construção: `EF07CI01` nem existe no universo do Médio. Convém trocar o nome ou acrescentar uma asserção que distinga.
- **`EXPLAIN`**: só a consulta `consultaDasCobertas` tem o plano conferido. As consultas `secoesSemClassificacao` e a de `materiaisEmUso` também correm sobre `secao_do_material` e `material` da escola, e valeria conferir o plano delas no mesmo volume.
- **"Excluído o único material"**: falta o par, dois materiais cobrindo o mesmo código, um excluído e o código ainda coberto.
- **Linha 55 da tabela**: ela pede "Mutação: tirar `escola_id`", mas a resposta é o motivo da chave composta. Convém escrever isso na própria linha.
- **Texto do documento**: a Autoconferência diz "59 blocos" e a seção "Mutações" diz "63 blocos, 4 motivos". Convém acertar um dos dois.
- **Ordem dos grupos**: o `sort` por nome (`material.service.ts:765`) não tem asserção. Hoje nenhum caso prova a ordem.
- **"Uma ação cheia"**: o `toBeLessThanOrEqual(1)` também passa com zero botões cheios. Convém fixar o número esperado.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-20 09:27:14 · `tasks/prd-classificacao-bncc/13_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nesta rodada. O diff da rodada 2 não muda schema nem migration.

Queries verificadas:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/cobertura.repository.ts` não mudou desde a rodada 1. Os escopos continuam vindo do token: `materialEmUso` na linha 37, a série na linha 63, `consultaDasCobertas` na linha 90 e `secoesSemClassificacao` na linha 134, todos com `requireEscolaId()`.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/material.service.ts:753` e `:765` (o filtro `habilidadeEhCandidata` e a ordem dos grupos) só trabalham sobre o resultado que já veio escopado. Não abrem leitura nova.
- O resto do diff só toca testes, texto da tela, `docs/interface.md`, `TODO.md` e o documento da tarefa. Nenhum endpoint passou a aceitar `escolaId` do cliente.

Teste de isolamento: presente e efetivo. Os casos da série da B (`NAO_ENCONTRADO` igual ao da série inexistente) e do material da B que não cobre a habilidade da A não mudaram. As mudanças em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/cobertura.int.test.ts` só reforçam as asserções: o segundo material, a ordem exata dos grupos e a contagem exata por série. Não enfraquecem nenhuma asserção de isolamento.

Bloqueantes: nenhum.

Recomendações:
- A recomendação da rodada 1 ficou registrada no `TODO.md`: um caso que chame `CoberturaRepository.materialEmUso` no contexto da escola A com o `serieId` da B, para provar sozinho o `eq(material.escolaId, requireEscolaId())`. O documento da tarefa também registra o motivo de esse termo não ter bloco de mutação. Fica para a próxima tarefa que mexer em `cobertura.repository.ts`.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-20 09:27:18 · `tasks/prd-classificacao-bncc/13_task.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum. Esta rodada mudou só testes, o subtítulo de `Cobertura.tsx`, `docs/interface.md`, `TODO.md` e o documento da tarefa. O código de produção da consulta e da rota é o que aprovei na 1ª rodada.
Rate limit: ok (não mudou desde a 1ª rodada)
Fila e prioridade: ok (não se aplica, a leitura é síncrona e curta)
Concorrência: protegida (esta rodada não grava nada)
Índice e paginação: ok. O `EXPLAIN` cobre só `consultaDasCobertas`. Estendê-lo a `secoesSemClassificacao` e `materiaisEmUso` ficou registrado em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/TODO.md`, com dono.
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (não mudou desde a 1ª rodada)
Bloqueantes: nenhum. Nenhuma correção tinha sido exigida na 1ª rodada. A asserção nova da ordem dos grupos em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/cobertura.int.test.ts` bate com o `sort` em `pt-BR` que já está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/material.service.ts:765`. Essa ordenação roda em memória sobre no máximo 9 grupos e não pesa às 10h.
Recomendações:
- `infra/scripts/carga-classificacao.ts` (`medirOsPlanos`) ainda mede a forma antiga da consulta. Até o item do `TODO.md` ser feito, o cenário de carga não mede o que a rota executa. A espera do pool precisa ser medida quando o `Promise.all` das quatro consultas entrar no cenário, porque são quatro conexões por pedido na manhã de segunda. O item já tem dono e não muda o veredito.
- O e2e da resposta atrasada (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/e2e/material-cobertura.spec.ts`) engole o aborto com `.catch(() => undefined)`. Convém afirmar se a leitura do 6º foi abortada ou se terminou. Já está no `TODO.md`.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-20 09:27:29 · `tasks/prd-classificacao-bncc/13_task.md`

VEREDITO: APROVADO

Esta é a segunda rodada. Auditei só o que mudou desde a primeira, que eu tinha aprovado sem exigir correção. Nada nessas mudanças toca dado de pessoa.

Campos pessoais tocados: nenhum. As mudanças são:
- testes mais fortes em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/cobertura.int.test.ts`: dois materiais cobrindo o mesmo código, a ordem dos grupos em `pt-BR`, e o material do Fundamental e do Médio contando só a habilidade do recorte de cada série;
- o subtítulo de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/coordenacao/material/Cobertura.tsx:88` e o teste dele em `Cobertura.test.tsx`;
- o e2e passa a exigir nenhuma ação cheia na tela;
- uma linha em branco a menos em `packages/shared/src/material/cobertura.ts`, mais `docs/interface.md`, `TODO.md` e os blocos de mutação no documento da tarefa.

A resposta de `/v1/materiais/cobertura` traz só o código e a descrição de habilidades da BNCC (tabela pública) e contagens de capítulos. Não traz nada de aluno nem de professor.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok. O diff não mexe na autorização da rota. Os casos que já existiam continuam valendo:
- a série da outra escola e a que não existe respondem o mesmo `NAO_ENCONTRADO`;
- o professor e o aluno são recusados;
- a rede não alcança `material.resumir`.

O termo `eq(material.escolaId, requireEscolaId())` de `materialEmUso` continua no código. Agora está documentado que tirá-lo não deixa nenhum teste vermelho, porque a chave composta de `material_serie` já separa as escolas. O caso que o testaria sozinho foi para o `TODO.md` com dono. Isso é do `tenancy-guardian`, e para a regra 20 não abre caminho: o material de outra escola não chega à série desta, e a resposta não tem dado pessoal.

Logs: limpos. O diff não acrescenta log.

Auditoria: presente onde a regra exige. O diff não cria leitura de dado de aluno, exportação, alteração de nota ou de permissão, nem aprovação de saída de IA. Ler a cobertura é ler habilidades e contagens, que não pedem registro.

Envio externo: nenhum novo. O subtítulo novo só diz que os capítulos são classificados pela IA e que a coordenação corrige em Material. A classificação em si é de tarefas anteriores e não mudou.

Seed/fixture: sintético. A tela foi vista numa escola sintética do ambiente de teste, e os testes usam códigos da BNCC.

Bloqueantes: nenhum.

Recomendações:
- O caso de `materialEmUso` com o `serieId` da escola B, já anotado no `TODO.md`, vale fazer na próxima tarefa que mexer em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/cobertura.repository.ts`. Hoje nenhum teste prova esse termo de escopo sozinho, e o caso protege contra uma mudança futura na chave composta.

Pergunta de fechamento: não muda nesta rodada. A cobertura não guarda nem envia nada sobre aluno, então não acrescenta nada ao que o sistema precisa responder à secretaria.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-20 09:27:30 · `tasks/prd-classificacao-bncc/13_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. O diff da rodada 2 não grava em `Nota` e não cria caminho novo para isso. A Cobertura só lê, e o `cobertura.repository.ts` e o `Cobertura.tsx` não citam nota. Todos com autor humano? Sim, porque não há caminho.

Decisão autônoma sobre aluno: ausente. A tela é da coordenação e mostra, por série, as habilidades que nenhum material cobre. Nada nela trata da trajetória de um aluno.

Aprovação registrada: ok. A tarefa não leva saída de IA ao aluno. A IA só classifica os capítulos do material da escola, a coordenação corrige essa classificação pela tela `ClassificacaoDoMaterial.tsx`, e a correção fica em `corrigidaEm`.

Supervisão do tutor: ok. A tarefa não toca o tutor.

Autonomia declarada e visível: sim. Esta rodada melhora o rótulo de IA (regra 70, item 4a). O subtítulo em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/coordenacao/material/Cobertura.tsx:88` agora diz que "Os capítulos são classificados pela IA, e a coordenação corrige a classificação em Material". O teste em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/coordenacao/material/Cobertura.test.tsx:261` cobre o texto, e o `docs/interface.md` foi atualizado junto. O texto bate com o que o produto faz: a correção existe em `ClassificacaoDoMaterial.tsx`.

O resto do diff não afeta a regra 70:
- O teste de integração ganhou casos novos: a habilidade só volta quando o último de dois materiais é excluído, a ordem dos grupos é conferida, e cada série perde só a habilidade do próprio recorte.
- O e2e agora exige nenhuma ação cheia na tela, e a checagem do vocabulário de nota continua lá.
- O documento da tarefa ganhou 9 mutações novas e um motivo escrito para o `escolaId` do `materialEmUso`, que nenhum teste distingue. Esse motivo vai ao `TODO.md`.
- O `TODO.md` ganhou 5 pendências.

Nenhuma dessas mudanças cria campo, tela ou prompt de nota em discursiva ou redação (D55). Também não cria métrica de professor nem sinal de comportamento.

Bloqueantes: nenhum.

Recomendações:
- A pendência do `TODO.md` para provar sozinho o `eq(material.escolaId, requireEscolaId())` do `materialEmUso` é do `tenancy-guardian`. Fica registrada, sem efeito na regra 70.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-20 09:27:30 · `tasks/prd-classificacao-bncc/13_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. A linha da rota na `techspec.md` agora mostra o contrato inteiro (`serieId`, `etapa`, `materiaisEmUso`, `classificacaoSuspensa`, `grupos[]`). O `cenarios.md` ganhou o cenário de `materiaisEmUso`. O subtítulo novo da tela está no `docs/interface.md`.
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

O que esta rodada mudou não traz problema:
- **Teste dos dois materiais:** excluído um, o outro ainda cobre a habilidade. Excluídos os dois, ela volta.
- **Ordem dos grupos:** o teste agora confere a ordem exata, no Fundamental e no Médio. Isso dá teste ao bloco de mutação do `sort`.
- **Material do Fundamental e do Médio juntos:** o teste exige `total - 1` em cada série. Prova que o código da outra etapa não entra na conta.
- **Ação cheia no e2e:** o teste agora exige `botoesCheios` igual a `[]`. Confere com o código: o "Enviar material" só existe em `MateriaisDaEscola` (`Material.tsx:216` e `Material.tsx:225`), que não aparece na aba Cobertura.
- **Os 9 blocos de mutação novos** citam casos que existem no teste de integração e no `Cobertura.test.tsx`.
- **O motivo novo para o `eq(material.escolaId, requireEscolaId())`** ficar sem bloco está escrito, e o caso que falta foi para o `TODO.md` com dono.

Recomendações:
- `tasks/prd-classificacao-bncc/13_task.md`: a tabela de cenários e "Sem bloco, com o motivo" citam o caso `cobertura.int.test.ts › o plano da consulta no volume do cenário da carga`, mas esse nome não existe. O caso de hoje se chama "a consulta das cobertas entra pelos índices de `secao_do_material` e de `habilidade_da_secao`, pela escola, sem varrer a tabela" (`apps/api/test/cobertura.int.test.ts:501`). Acertar a citação, para a prova ser rastreável.
- `apps/web/src/areas/coordenacao/material/Cobertura.tsx:88`: o subtítulo diz "a coordenação corrige a classificação em Material", e a pessoa já está numa aba de Material. "na aba Materiais, no painel do material" diria onde clicar. É só texto.
- `apps/api/test/cobertura.int.test.ts:191`: o comentário "excluído um, o outro ainda o cobre" repete a asserção da linha de baixo e pode sair.

Arquivos lidos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/.processo/ordens/diff-13_task-r2-codigo.txt
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/.processo/ordens/diff-13_task-r2-doc.txt
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/cobertura.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/coordenacao/material/Cobertura.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/coordenacao/material/Material.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/e2e/material-cobertura.spec.ts

## frontend-reviewer · 2ª rodada · APROVADO · 2026-11-20 09:27:42 · `tasks/prd-classificacao-bncc/13_task.md`

VEREDITO: APROVADO

Tela vista: sim (4 fotos lidas: computador e celular, escola cheia e vazia). As quatro mostram a mesma tela, sem série escolhida. A tela com série escolhida (grupos, habilidades, aviso de capítulos sem classificação) não saiu na vitrine, então a julguei pelo código em `Cobertura.tsx`, por `Cobertura.test.tsx` e por `e2e/material-cobertura.spec.ts`. Não rodei nenhum teste.

Estados: ok. Os quatro estão no código:
- Carregando: `LoadingState` para as séries (`Cobertura.tsx:91`) e para a cobertura (`Cobertura.tsx:52`).
- Erro: `ErrorState` com "Tentar de novo" nas duas leituras (`Cobertura.tsx:93` e `Cobertura.tsx:53`).
- Vazio: "Nenhuma série ainda" e "Nenhum material desta série ainda" convidam a agir e dizem o próximo passo. Sem série escolhida, o convite "Escolha uma série para ver as habilidades que ainda não têm material." aparece nas fotos da escola cheia e da vazia.
- Com dado: um grupo por componente (por área, no Ensino Médio), com a contagem, o aviso de capítulos sem classificação e a lista de habilidades.

Acessibilidade: ok.
- O select tem rótulo "Série" visível.
- Cada grupo é uma `section` com `aria-label`.
- O título segue a hierarquia h2 e h3.
- O texto é pt-BR e não mostra id nem termo técnico.
- O contraste visto nas fotos está legível.

Chromebook fraco: sem bloqueio.
- Não há laço de releitura: a tela lê ao escolher a série e em "Tentar de novo".
- A resposta atrasada de uma série não cai sob outra, porque cada série tem a própria chave de consulta e o `key={serieId}`.
- Cada grupo lista todas as habilidades que faltam, sem virtualização. O `frontend-reviewer` já registrou isso no `TODO.md` como recomendação, com dono na tarefa que medir o Chromebook da F4b.

Celular: ok.
- A 360 px não há rolagem horizontal nem conteúdo cortado.
- As abas quebram em duas linhas, mas continuam legíveis e acionáveis.
- O select tem cerca de 48 px de altura, acima dos 44 px.
- Nada depende de hover, e a tela não exige o celular.
- O e2e mede alvo, rolagem lateral e ausência de ação cheia nos projetos `chromebook` e `celular`. A página não rola a 1366 × 768.
- Nenhum RF do PRD diz que esta tela cabe sem rolar.

Ação oficial protegida: sim. A tela é só de leitura (nenhuma aprovação, publicação, exclusão ou exportação), e o e2e agora afirma zero botões cheios.

Rodada nova: o diff desde a rodada anterior não trouxe correção exigida, só o que ela recomendou. Conferi cada item:
- **Saída de IA rotulada como IA (regra 70, item 4a):** o subtítulo ganhou "Os capítulos são classificados pela IA, e a coordenação corrige a classificação em Material." Aparece nas quatro fotos, no computador e no celular, sem cortar. `Cobertura.test.tsx` e `docs/interface.md` foram atualizados no mesmo ponto.
- **Cobertura com dois materiais no mesmo código, e Fundamental e Médio juntos:** os testes de integração ganharam esses casos e a ordem dos grupos em pt-BR.
- **Zero ação cheia no e2e:** feito.
- **Novas entradas no `TODO.md`:** só recomendações, cada uma com dono.

Bloqueantes: nenhum.

Recomendações:
- Depois de rodar o e2e com a série escolhida, fotografe a tela cheia (por exemplo, com `--clicar`), para a validação ver os grupos e o aviso de capítulos sem classificação em 360 px. Hoje ela só foi vista pelo código.
- O rótulo de IA está só no subtítulo da tela, não em cada grupo ou habilidade. Para o texto da própria tela (descrições da BNCC, contagens), isso basta. Se a tela passar a exibir a classificação por capítulo, o selo de IA deve ir junto.
- Quando o Chromebook da F4b for medido, a lista de habilidades por grupo (`Cobertura.tsx:21`) pode virar "Mostrar todas". Já está no `TODO.md`.

Arquivos relevantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/coordenacao/material/Cobertura.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/coordenacao/material/Cobertura.test.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/e2e/material-cobertura.spec.ts`

## test-engineer · 2ª rodada · APROVADO · 2026-11-20 09:27:54 · `tasks/prd-classificacao-bncc/13_task.md`

VEREDITO: APROVADO

**Cenários exigidos:** os quatro bloqueantes da 1ª rodada.
1. Cada termo de `materialEmUso` precisava de um bloco próprio, e o `escolaId` precisava de motivo escrito.
2. O filtro `habilidadeEhCandidata` do service precisava de bloco.
3. O `coalesce(area, componente)` precisava de bloco.
4. O ternário `Área`/`Componente` do `aria-label` precisava de bloco.

**Cobertos:** os quatro.
- **`eq(material.estado, 'pronto')`:** o bloco cita `o material de que a escola ainda não pode ou não deve se valer`. O caso `processando` cria um material com a seção `concluida` e afirma `toContain(CI_7)` (`apps/api/test/cobertura.int.test.ts:199`, `:207`). O cenário chega ao termo.
- **`isNull(material.excluidoEm)`:** o bloco cita `a série sem material lista todas as habilidades`. Os dois `DELETE` seguidos de `toContain(CI_7)` matam o termo (`cobertura.int.test.ts:191-192`). O segundo material (`:187-189`) prova também que excluir um não descobre o código que o outro ainda cobre.
- **`declaradoParaASerie`:** o bloco cita `` `EF69LP01` num material só do 6º ``. O `toContain(LP_69)` no 7º mata o termo (`cobertura.int.test.ts:298`).
- **`proprioOuComLicencaVigente`:** o caso da licença vencida, o primeiro do laço (`cobertura.int.test.ts:198`), mata o termo.
- **`eq(material.escolaId, requireEscolaId())`:** vai como motivo escrito em "Sem bloco, com o motivo". Conferi no código e o motivo se sustenta. O `material_serie` tem chave composta `(escola_id, …)`, então só o material da própria escola pode ser declarado para a série dela. As outras duas consultas também filtram pela escola no `where` (`habilidadeDaSecao.escolaId` e `secaoDoMaterial.escolaId`). E a série passa antes por `serieDaEscola`. O caso que falta ficou registrado no `TODO.md`.
- **`habilidadeEhCandidata` (`material.service.ts:753`):** o bloco cita `no Médio a cobertura é por área`. A Matemática com `EM13LGG101` e o `toContain('EM13LGG101')` matam o filtro (`cobertura.int.test.ts:334`, `:339`).
- **O `coalesce` invertido:** o bloco cita o mesmo caso do Médio, que agora afirma a lista exata de grupos, já sem o `.sort()` (`cobertura.int.test.ts:328`).
- **O ternário (`Cobertura.tsx:38`):** o bloco cita `no Médio o grupo é a área`, que procura a região `Área: Ciências da Natureza` (`Cobertura.test.tsx:297`).
- **O que veio além do exigido, e está certo:**
  - O `sort` dos grupos ganhou dois blocos, um que tira a ordenação e outro que a inverte. A ordem pt-BR passou a ser afirmada no Fundamental (`cobertura.int.test.ts:178`) e no Médio (`:328`).
  - O caso Fundamental mais Médio agora afirma `total - 1` em cada série (`:319`, `:321`).
  - O e2e afirma `botoesCheios` igual a `[]`.
  - O subtítulo novo é afirmado em `Cobertura.test.tsx:261`.
- **Contagem e testes:** o documento declara 72 blocos e o arquivo tem 72. Rodei o `Cobertura.test.tsx` e os 15 casos passaram. Não há `.skip`, mock que esconda a regra nem chamada a provedor de IA.

**Bloqueantes:** nenhum.

**Recomendações:**
- **O bloco do `coalesce` fica vermelho por outro caminho:** o motivo escrito na pergunta 1 diz que é a lista de grupos que quebraria. Na prática, com a ordem invertida o `EM13LP*` vira `lingua_portuguesa` numa série do Médio. Aí `nomeDoGrupoDaCobertura` (`packages/shared/src/material/cobertura.ts:79`) devolve `undefined` para essa chave, o `localeCompare` do `sort` (`material.service.ts:765`) quebra e a rota responde 500. Quem falha é o `expect(resposta.status).toBe(200)` de `coberturaDe`, e não o `toEqual` dos grupos. O cenário chega à cláusula, então não bloqueia. Mesmo assim:
  - vale corrigir o texto da pergunta 1;
  - ou vale tratar a chave fora do recorte, para que o vermelho venha da asserção dos grupos.
- **A primeira linha do bloco `escolaId` está desatualizada:** a parte da 1ª rodada que acompanha o motivo novo ("as duas cópias do escopo no `where`…", pergunta 1) já não diz "três caminhos que se repetem" do jeito certo, porque o `materialEmUso` deixou de valer por si só para o termo da escola. Vale ajustar ao reler o documento.

O documento auditado é `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/13_task.md`.
