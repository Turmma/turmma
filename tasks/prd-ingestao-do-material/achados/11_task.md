# Achados das revisões — `tasks/prd-ingestao-do-material/11_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-14 01:28:35 · `tasks/prd-ingestao-do-material/11_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova. A migration `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/drizzle/0057_auditoria_material_recusado.sql` só cria o índice parcial `auditoria (escola_id, em) where acao = 'material.recusado'`, e ele começa pela escola. `auditoria` já tem `escola_id`. O resumo é contagem atual, não dado de período, por isso não precisa de `anoLetivoId`.

Queries verificadas:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/material.repository.ts:355` (`contarPorDisciplinaESerie`): filtra por `requireEscolaId()`, que vem do contexto autenticado. A junção com `material_serie` também amarra a escola.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/auditoria/auditoria.repository.ts:228` (`recusasDeMaterialDesde`): `escola_id` vem de `requireEscolaId()`. Os motivos e a janela são constantes do servidor e passam como parâmetro, sem SQL montado com entrada do cliente.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/material.controller.ts:68` (`GET /v1/materiais/resumo`): não recebe corpo, query nem parâmetro, então não há `escolaId` vindo do cliente.
- O `entidade_id` da recusa é a disciplina, e ela só é gravada depois que `DisciplinaRepository.porId` confirma que a disciplina é da escola (`material.service.ts:196`). Uma disciplina de outra escola responde `NAO_ENCONTRADO` antes da gravação, então o resumo não ecoa id alheio.
- O motivo `licenca_inexistente` fica de fora da contagem. Contá-lo confirmaria que a licença existe em outra escola (regra 10, item 6).
- Matriz: `material.resumir` é `unidade` só para a coordenação. Professor, aluno e rede ficam em `nunca`, que responde o mesmo 404 `NAO_ENCONTRADO` da rota inexistente.
- A rede não alcança o resumo, e a resposta só traz uuids e contagens (contrato `strictObject`).
- Não há `@Unscoped()` novo. `porta-unica.test.ts` confere que `recusasDeMaterialDesde` não tem justificativa de sem-escopo.
- No front, a chave do resumo fica sob a de Material, que a troca de sessão já esvazia. Nenhum `escolaId` sai da tela.

Teste de isolamento: presente e efetivo. É o caso `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/material-resumo.int.test.ts:270`, conferido tirando cada cláusula de escopo de cabeça:
- Sem `material.escolaId`, o resumo da A passa a ter `b.quimica` na lista de disciplinas e `semSerie` deixa de ser 0, e as linhas 281 e 282 quebram.
- Sem `a.escola_id` na auditoria, as recusas de `b.fisica` e `b.quimica` entram na lista de disciplinas da A, e a linha 282 quebra.
- O caso de permissão (linha 291) compara o erro do professor e do aluno com o da rota inexistente.

Bloqueantes: nenhum.

Recomendações:
- `material-resumo.int.test.ts:254`: o `EXPLAIN` roda um SQL escrito à mão, não o que `recusasDeMaterialDesde` gera (lá a janela vai como parâmetro `timestamptz` e há o `left join lateral`). Ele prova que o índice existe e serve a uma consulta parecida, não que serve à consulta real. Vale rodar o `EXPLAIN` sobre o SQL do próprio repository.
- `auditoria.repository.ts:228`: o método supõe que `entidade_id` de `material.recusado` é sempre uma disciplina, e só o comentário diz isso. Filtrar também `a.entidade = 'disciplina'` deixaria essa suposição presa na consulta.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-14 01:28:48 · `tasks/prd-ingestao-do-material/11_task.md`

VEREDITO: APROVADO
Tela vista: sim, 4 fotos lidas (1366 e 360 px, escola cheia e vazia). As quatro mostram só o estado vazio, porque a vitrine não semeia material. Ficaram sem foto o resumo com dado, o aviso de "Séries atribuídas na migração", a linha "Sem série", o erro da releitura e o "Mostrar mais". Conferi esses pelo código (`ResumoDoMaterial.tsx`, `resumo-do-material.ts`, `Material.tsx`, `Table.tsx`) e pelos testes e o e2e (`ResumoDoMaterial.test.tsx`, `e2e/material-resumo.spec.ts`). Não rodei os testes, só li o que eles afirmam.
Estados: ok.
- Carregando: `LoadingState` com "Carregando o resumo…" (`ResumoDoMaterial.tsx:120`).
- Erro: `ErrorState` com "Tentar de novo" (`ResumoDoMaterial.tsx:122`). Se a releitura falha com o resumo já na tela, o erro vem ao lado e o número de antes fica (`:59`).
- Vazio: convida, não se desculpa. Diz o que acontece quando o primeiro PDF chegar, e logo abaixo o `EmptyState` tem o botão "Enviar material". O vazio só aparece depois das três leituras terminarem (resumo, disciplinas e séries) e sem a releitura caída (`:66`).
- Com dado: tabela por disciplina e série.

Acessibilidade: ok.
- A tabela tem `caption`, `th scope` e `th` de linha, e só recebe foco quando rola dentro do próprio contêiner.
- O aviso é `role="note"`, a releitura que falhou é `role="alert"`, e o "Tentando de novo…" é `role="status"`.
- O e2e roda `seriousViolations` (axe) na tela com dado e na lista de 300 materiais.
- O foco volta ao título da lista quando "Mostrar mais" revela o último bloco (`Material.tsx:182`).

Chromebook fraco: ok.
- A lista de materiais mostra 25 por vez, com "Mostrando 25 de N" (`Material.tsx:241-253`). O e2e com 300 materiais confere que a página não rola a 1366 × 768, antes e depois do "Mostrar mais".
- `Table` desenha uma só estrutura por vez (tabela ou lista), não as duas.
- O resumo só se relê enquanto algum material está processando.
- A tabela do resumo não é paginada, mas tem uma linha por disciplina e série, então fica pequena.

Celular: ok.
- Nas fotos de 360 px não há rolagem horizontal nem texto cortado. As duas barras de abas quebram em duas linhas sem esconder nada.
- O "ENVIAR MATERIAL" tem cerca de 46 px de altura, acima dos 44 px exigidos para a ação principal.
- Abaixo de 768 px a tabela vira lista (`Table.tsx`), com o nome de cada número ao lado dele. Não há hover nem atalho.
- O e2e roda nos projetos `chromebook` e `celular` e confere `horizontalOverflow` igual a 0 (`e2e/material-resumo.spec.ts:90`). Nenhum RF do `prd.md` diz que a tela cabe a 1366 px, e a lista `Rolam` veio vazia.

Ação oficial protegida: sim. A tela só lê: o resumo é contagem e o "Mostrar mais" só revela linhas. A exclusão de material continua com `ConfirmDialog` mostrando material, disciplina e situação, e não mudou nesta tarefa. O resumo traz só contagens, sem título, licenciante nem autor. Não há saída de IA nesta tela.

Bloqueantes: nenhum.

Recomendações (não bloqueiam):
1. `resumo-do-material.ts:39-42`: o aviso "Séries atribuídas na migração" abre com "migração", palavra de quem constrói o sistema. É o texto do `cenarios.md:224`, então a spec o pede.
   - O aviso "todas as séries" também aparece para quem escolheu isso de propósito, e não tem como dispensar. Isso vira ruído permanente. O comentário do código admite que a tela não distingue os dois casos.
   - Vale decidir na retro se o aviso ganha um "Dispensar" e uma troca de "migração" por "importação inicial".
2. `ResumoDoMaterial.tsx:122` e `Material.tsx:160`: se as duas leituras falharem juntas, a tela mostra dois `ErrorState` iguais, cada um com um "Tentar de novo" primário. Isso contradiz o comentário de `Material.tsx:221`, que diz que o primário da tela é um só, e o leitor de tela ouve dois botões com o mesmo nome. Usar `variante="secundario"` no do resumo e um nome distinto, como "Tentar de novo o resumo", resolve.
3. Na escola nova, o vazio do resumo ("Ainda não há material para resumir…") e o "Nenhum material ainda" logo abaixo dizem quase a mesma coisa (visto nas fotos). Esconder o bloco do resumo enquanto a lista estiver vazia deixaria só um convite.
4. `resumo-do-material.ts:25,48`: os nomes que sobram quando a disciplina ou a série não está na lista aparecem como "Disciplina" e "Série" soltos. Seria mais claro algo como "Disciplina não encontrada".

Arquivos das fotos (em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/.processo/vitrine/`): `coordenacao--coordenacao-material--computador.png`, `coordenacao--coordenacao-material--celular.png`, `vazia--coordenacao--coordenacao-material--computador.png`, `vazia--coordenacao--coordenacao-material--celular.png`.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-14 01:28:54 · `tasks/prd-ingestao-do-material/11_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A tarefa não grava em `Nota` e não cria caminho novo para isso. Ela traz uma rota só de leitura (`GET /v1/materiais/resumo`), um método de leitura no `AuditoriaRepository` e um índice parcial na `auditoria`. Todos com autor humano? Não se aplica.

Decisão autônoma sobre aluno: ausente. O resumo conta material por disciplina e série. Nenhum dado de aluno entra nele, nem trajetória.

Aprovação registrada: ok. Nenhuma saída de IA é criada ou alterada. As contagens vêm do estado do material e do registro `material.recusado` da auditoria. O registro de recusa já existia e não muda.

Supervisão do tutor: ok. O tutor não foi tocado.

Autonomia declarada e visível: sim. Nenhum agente novo, e a autonomia declarada não mudou.

Bloqueantes: nenhum.

O que conferi na regra 70:
- **Itens 7, 8 e 9 (vigiar aluno, medir o professor):** a resposta traz só ids de disciplina e série e as contagens. O esquema é estrito, em `packages/shared/src/material/material.ts`, no `linhaDoResumoDoMaterialSchema`, e a mutação de "campo a mais" tem teste. Não aparece autor, título nem licenciante. A consulta `recusasDeMaterialDesde` (`packages/core/src/auditoria/auditoria.repository.ts`) agrupa por `entidade_id` (a disciplina) e pela série, e não lê `autor`. Assim, nada no resumo mede, ordena ou expõe professor. Pela D75, quem envia o material é a coordenação.
- **Quem vê:** a permissão `material.resumir` vale só para a coordenação. Professor, aluno e rede ficam em `nunca` (`packages/shared/src/permissao/matriz.ts`), e o teste está em `apps/api/test/material-resumo.int.test.ts`. A rede não chega à rota.
- **Item 8 da auditoria (D46 e D55):** no código e nas fotos não há nota, conceito nem sugestão de nota.
- **Fotos** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/.processo/vitrine/vazia--coordenacao--coordenacao-material--computador.png`, `…--celular.png` e as duas da escola cheia, que mostram o mesmo estado vazio):
  - O resumo mostra "Ainda não há material para resumir…", texto de `apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx:66`. É um texto de sistema e não precisa de selo de IA.
  - Não há nada que induza uso, e "Sair" fica à vista nas duas telas.
  - O texto já existente "É dele que o Assistente e o Tutor tiram…" chama os agentes pelo nome da função (D17 e D58).

Recomendações:
- A vitrine não semeia material (`tools/vitrine/escola.ts:216`). Por isso a tabela do resumo com dado, a linha "Sem série" e o aviso da migração não têm foto. Para a regra 70 isso não pesa, porque o conteúdo são só contagens. Ainda assim, vale semear alguns materiais na escola cheia para a próxima rodada visual do `frontend-reviewer`.
- `docs/regulacao.md` não muda nesta tarefa, e não precisava mudar: ela não toca IA, nota nem tutor.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-14 01:29:13 · `tasks/prd-ingestao-do-material/11_task.md`

VEREDITO: APROVADO

A tarefa 11.0 não cria nem expõe dado de pessoa. O resumo novo só devolve ids de disciplina e de série e contagens, só para a coordenação, sempre na escola que vem do token.

Campos pessoais tocados: nenhum. A migration 0057 só cria um índice parcial em `auditoria (escola_id, em) where acao = 'material.recusado'`. Nenhuma coluna nova, e nenhuma tabela de pessoa foi alterada.

Fora da tabela de dados do docs/lgpd.md: nada. Não há campo pessoal novo, então a tabela não precisava mudar.

Autorização por objeto: ok.
- `GET /v1/materiais/resumo` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/material.controller.ts:68-73`) usa a permissão nova `material.resumir`: coordenação `unidade`; professor, aluno e rede `nunca`.
- A rota não recebe id. As duas leituras pegam a escola do contexto com `requireEscolaId()`: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/material.repository.ts:55-62` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/auditoria/auditoria.repository.ts:210-225`.
- O professor e o aluno recebem o mesmo `NAO_ENCONTRADO` de uma rota que não existe, e o teste compara os dois corpos. `material-resumo.int.test.ts:291-303`.
- O teste de isolamento lê da escola A o que a escola B gravou (material, recusa, material sem série) e confere que nada da B aparece.
- A recusa por licença inexistente fica de fora da contagem de propósito (`MOTIVOS_DA_RECUSA_QUE_O_RESUMO_CONTA`). Contá-la diria à coordenação que a licença da outra escola existe. A decisão está correta.

DTO: explícito e fechado. `linhaDoResumoDoMaterialSchema` e `resumoDoMaterialResponseSchema` usam `z.strictObject`, só com uuids e inteiros não negativos (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/shared/src/material/material.ts:406-431`). O serviço passa a resposta por `parse` antes de devolver. Nenhum título, licenciante ou autor (`autor` da auditoria) sai na resposta.

Logs: limpos. `resumir()` não escreve log, e os logs que já existiam no serviço continuam só com ids e códigos.

Auditoria: presente onde a regra exige; aqui ela não é exigida. A leitura é um agregado de material da escola, sem dado de aluno, sem exportação, sem mudança de nota ou de permissão e sem aprovação de saída de IA. A tabela `auditoria` é lida só pelo `AuditoriaRepository`, sem `@SemEscopo`, e `porta-unica.test.ts` foi atualizado com o método novo.

Envio externo: nenhum. A tarefa não chama provedor de IA, então não há nada a registrar em `ExecucaoAgente`.

Seed/fixture: sintético.
- O teste de integração e o e2e usam disciplinas genéricas e títulos como "Capítulo pronto 1".
- `vincularMaterialAsSeriesNoBanco` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/e2e/support/material.ts:100-105`) só liga material às séries da escola de teste.
- As fotos mostram "Colégio sintético da vitrine" e "Coordenadora sintética".

Fotos da tela: as quatro mostram o mesmo estado vazio, com o texto "Ainda não há material para resumir…". A vitrine não semeia material, então mesmo a escola cheia aparece vazia. No vazio não aparece nenhum dado de pessoa. Pelo código, a tabela com dado (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx:12-19`) mostra só nome da disciplina, nome da série e contagens.

Pergunta de fechamento: a tarefa não muda a resposta. Ela não guarda dado novo de aluno e não envia nada para fora.

Bloqueantes: nenhum.

Recomendações:
- A permissão `rede` em `material.resumir` só é provada pela matriz (`matriz.test.ts`). Um caso de integração com o token da rede, junto do caso de professor e aluno, deixaria a regra 10, item 8 provada também na rota.
- `recusasDeMaterialDesde` lê `depois ->> 'motivo'` e `depois -> 'serieIds'` da auditoria. Se o formato do `depois` de `material.recusado` mudar, a contagem cai a zero sem erro. Vale um teste de contrato que una o formato gravado pelo `AuditoriaRecorder` ao formato que essa leitura espera.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-14 01:29:21 · `tasks/prd-ingestao-do-material/11_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. As oito divergências do `11_task.md` estão na linha "11.0" da seção 11 da `techspec.md`. As que tocam teste também estão no `cenarios.md`: em "Resumo (RF18)" e em "Telas", na linha "Lista de materiais" com "Mostrar mais". A lista paginada da seção 9 virou "Mostrar mais" na tela, e isso está registrado como divergência.
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

Recomendações:
1. **Dois vazios empilhados na tela.** Nas duas fotos da escola vazia, o vazio do resumo ("Ainda não há material para resumir…") aparece logo acima do "Nenhum material ainda", e os dois dizem a mesma coisa (`vazia--coordenacao--coordenacao-material--computador.png` e `--celular.png`; o código está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx:66-68`). Vale esconder o resumo enquanto a lista está vazia e sem recusa, ou deixar um vazio só. A decisão visual é do `frontend-reviewer`.
2. **Aviso da migração cita séries que a escola pode não ter.** O texto fixo fala de "o do 9º ano aparece para o 6º" (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/material/resumo-do-material.ts:72`). Numa escola só de Ensino Médio, essas séries não existem e o texto fica errado. Melhor dizer "aparece para todas as séries" ou usar as séries da própria escola.
3. **Erro na releitura de disciplinas ou séries não aparece.** O erro de releitura vem só do resumo (`ResumoDoMaterial.tsx:111`, `releituraFalhou={resumo.isError}`). Se disciplinas ou séries falharem na releitura, a tela fica sem aviso. O nome na tela continua certo, porque o dado anterior fica, então isso não bloqueia.
4. **"Mostrar mais" não volta para 25 na troca de sessão.** O `visiveis` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/material/Material.tsx:109`) não é zerado no `aoTrocarDeSessao` (linhas 128-135). A pessoa seguinte no mesmo computador herda quantas linhas a anterior abriu. Só a contagem passa de uma para a outra, nenhum dado.
5. **Lista de motivos vazia vira erro de SQL.** `recusasDeMaterialDesde` monta `in ()` quando a lista vem vazia (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/auditoria/auditoria.repository.ts:107-110`), e o banco responde com erro. Hoje só a documentação impede isso: um retorno antecipado com `[]`, ou um tipo de lista não vazia, fecha o caso.
6. **Número errado no motivo de um arquivo de e2e separado.** O `11_task.md:35` e a `techspec.md` dizem que `e2e/material.spec.ts` "já está no teto de 800 linhas", mas o arquivo tem 776. A conclusão vale, porque os casos novos passariam do teto; só o motivo escrito precisa de correção.
7. **`ResumoDoMaterialRow` mistura português e inglês.** O nome em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/shared/src/material/material.ts:456` vai contra a regra 60, item 1. Algo como `LinhaDoResumoDoMaterial` combina com o schema `linhaDoResumoDoMaterialSchema`, exceto se `*Row` já for o padrão do `packages/shared`.

## infra-guardian · 1ª rodada · REPROVADO · 2026-11-14 01:30:19 · `tasks/prd-ingestao-do-material/11_task.md`

VEREDITO: REPROVADO
Caminho quente tocado: migration
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: compatível
Métrica e alerta: ok

Bloqueantes:

1. Arquivo: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/material/api/resumo.ts:15-17` e `:22`.

   **O que está errado.** Enquanto algum material está `processando`, o resumo se relê a cada `INTERVALO_DA_LEITURA_DO_MATERIAL_MS` (1,5 s). A lista da aba já se relê no mesmo ritmo (`api/material.ts:29`), pedindo uma página de 100 itens por vez (`lerPaginas`), e as duas leituras ligam e desligam juntas. Toda rota autenticada gasta do limite por usuário (`RateLimitGuard`, `LIMITE_REQ_USUARIO_MIN=120`). A tabela abaixo mostra quantos pedidos por minuto a aba da coordenação faz sozinha:

   | Materiais na escola | Antes da tarefa | Com o resumo |
   |---|---|---|
   | até 100 | 40/min | 80/min |
   | 101 a 200 | 80/min | 120/min, já no teto |
   | 201 a 300 | 120/min | 160/min, acima do teto |

   O cenário de onboarding de `docs/infra.md` §3.5 é de 300 apostilas, e com uma réplica do `worker-pdf` o estado `processando` dura horas. Nesse tempo a tela gasta o limite da própria coordenadora. O próximo `POST` de envio, a releitura da lista e a do resumo voltam com `LIMITE_EXCEDIDO`.

   **Correção exigida.** O resumo não pode ter laço próprio de 1,5 s. Ele deve ser invalidado só quando a lista lida mostra que um material mudou de estado (o conjunto de `processando` mudou), ou então ganhar um intervalo de pelo menos 30 s. A tarefa precisa de um teste de unidade que prove esse ritmo: o resumo não é relido a cada leitura da lista, só quando um estado muda (ou no intervalo escolhido). Na Tech Spec, linha "11.0" da seção 11, entra a conta de pedidos por minuto da aba, com a lista e o resumo juntos e a escola de 300 materiais, comparada a `LIMITE_REQ_USUARIO_MIN`.

Recomendações:

- **A lista já estava perto do teto antes desta tarefa.** Isso vem de antes, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/material/api/material.ts:29` e `:38`: com mais de 200 materiais, só a releitura da lista já faz 120 pedidos por minuto (3 páginas a cada 1,5 s). Vale uma tarefa de correção que releia só o que está `processando` ou aumente o intervalo, com o cenário de 300 materiais e um processando no e2e ou no teste de carga.
- **O `EXPLAIN` não é da consulta real.** O teste em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/material-resumo.int.test.ts:253-258` roda uma consulta escrita à mão. A do repository tem o `left join lateral jsonb_array_elements_text`, o filtro `depois ->> 'motivo' in (...)` e a escola e a data passadas como parâmetro. Melhor rodar o `EXPLAIN` sobre o SQL que `AuditoriaRepository.recusasDeMaterialDesde` gera (`toSQL()`), para provar que o índice parcial serve à consulta que vai para produção.
- **O índice sem `concurrently` depende de não haver homologação nem piloto.** A migration `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/drizzle/0057_auditoria_material_recusado.sql` cria o índice sem `concurrently` sobre `auditoria`, que recebe escrita de quase toda ação da escola. Isso trava a escrita nessa tabela enquanto o índice é montado. A exceção da 0034 valia "enquanto não há staging nem piloto". Hoje não há nenhum dos dois (`docs/infra.md:415`), então ela vale. Falta registrar no `TODO.md` ou na Tech Spec o gatilho: a partir da homologação ou do piloto, índice em `auditoria` vai em arquivo próprio, fora da transação.

## test-engineer · 1ª rodada · APROVADO · 2026-11-14 01:31:03 · `tasks/prd-ingestao-do-material/11_task.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- **Caminho feliz:** a contagem por disciplina e série; o material com duas séries conta nas duas; cada estado cai na sua coluna.
- **Bordas do domínio:**
  - o material excluído e o substituído pela edição nova não contam;
  - o material sem série que a migração deixou entra na linha "Sem série" e em `semSerie`;
  - a recusa de 29 dias conta e a de 31 não, pelo mesmo `Clock`;
  - contam os motivos `sem_licenca`, `sem_declaracao` e `licenca_vencida`, e `licenca_inexistente` não conta (contá-la revelaria a licença da outra escola);
  - a recusa de uma série cai só nela, e a de duas séries cai em cada uma;
  - a recusa da edição sobre material sem série cai na linha sem série;
  - outra ação de auditoria com o mesmo formato de `depois` não entra;
  - a escola sem ano letivo em curso vê o resumo vazio (o caso de virada de ano);
  - a escola de uma série só não dispara o aviso de "todas as séries".
- **Permissão:** professor e aluno recebem `NAO_ENCONTRADO`; a rede fica `nunca` na matriz; o professor não chega à aba pela tela.
- **Isolamento:** o resumo da escola A não leva material, recusa nem material sem série da escola B.
- **Tela:** os quatro estados, cada uma das três leituras sozinha, a releitura que cai com o número de antes na tela, 360 px e Chromebook, a ordem das linhas, "Mostrar mais" com 25, 30 e 60, e 1366 × 768 com 300 materiais.
- **Concorrência:** não se aplica, porque o resumo é só leitura. A troca de pessoa na mesma aba com a resposta fora de ordem está no e2e "segunda pessoa", com a leitura segurada por `page.route`.

**Cobertos:** cada linha da tabela "Testes que provam a regra" tem o caso citado pelo nome. Conferi as linhas juntadas por ponto e vírgula uma a uma:
- excluído e substituído: um caso cada;
- motivos: os quatro numa disciplina cada;
- por disciplina e série: três casos;
- índice: o teste de integração e o `migracao-f4`;
- DTO: o teste de integração e os cinco casos do contrato;
- aviso: cinco casos, mais o módulo puro, mais dois na aba.

Mutações:
- `mutacoes.ts --faltando` lista 20 linhas sem bloco, e todas estão explicadas em "Cláusulas sem bloco".
- As 16 linhas de `Material.tsx` só mudaram de recuo: `git diff -w` mostra que não mudaram.
- Toda cláusula nova de escopo, ação, janela, motivo, junção, excluído, chave, `semSerie`, `Clock`, permissão, matriz, contrato, índice e JSX tem bloco.
- Não há `.skip`, `.only` nem teste comentado.
- Não há mock de coisa nossa: a rede falsa só existe na unidade da tela, e a integração roda com Postgres de verdade e o worker de extração real (`esperarExtracao`, que é determinístico).

Rodei e passaram:
- `material-resumo.int.test.ts`: 15 de 15;
- os seis arquivos de unidade e tela (`ResumoDoMaterial.test.tsx`, `resumo-do-material.test.ts`, `Material.test.tsx`, `material.test.ts`, `matriz.test.ts`, `porta-unica.test.ts`): 154 de 154.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **O EXPLAIN não roda a consulta do resumo.** O caso `material-resumo.int.test.ts:247` ("o índice parcial serve à consulta do resumo") roda um SQL escrito à mão (`material-resumo.int.test.ts:255`), e não o de `AuditoriaRepository.recusasDeMaterialDesde`. Ele prova que o índice existe e é parcial, mas não que a consulta real o usa. Uma reescrita da consulta que o perca, como `acao like 'material.%'`, passaria verde. Sugestão: fazer o EXPLAIN do SQL do repository, ou corrigir o nome do caso.
2. **"Tentar de novo" só é testado quando o próprio resumo falhou.** O laço que relê as três leituras está em `ResumoDoMaterial.tsx:86-88`. Se ele relesse só o resumo, o caso de `/v1/disciplinas` ou `/v1/series` que falha ficaria preso no erro, e nenhum teste veria. Sugestão: no caso `ResumoDoMaterial.test.tsx:112`, clicar em "Tentar de novo" e conferir que a tabela aparece.
3. **`semSerie` só é testado com um material.** O caso `material-resumo.int.test.ts:144` usa um material só, então `semSerie += 1` no lugar de `+= contado.total` passaria. Sugestão: dois materiais sem série, ou um sem série em dois estados.
4. **A releitura depende do relógio real.** O caso `ResumoDoMaterial.test.tsx:227` espera o `refetchInterval` de 1,5 s com `findBy` de até 4 s. Hoje a folga é boa, mas é prazo pelo relógio de verdade. Sugestão: relógio falso, ou `cliente.refetchQueries`, como o caso seguinte já faz.
5. **A "rota que não existe" é outra rota.** O caso de permissão (`material-resumo.int.test.ts:296`) compara com `/v1/materiais/resumo-que-nao-existe`, que cai na rota `:id` com id inválido, e não numa rota inexistente. A igualdade vale hoje, mas o nome diz outra coisa. Sugestão: comparar com um caminho fora de `/v1/materiais`.

Os arquivos de teste estão em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/`:
- `apps/api/test/material-resumo.int.test.ts`
- `apps/web/src/areas/coordenacao/material/ResumoDoMaterial.test.tsx`
- `apps/web/src/areas/coordenacao/material/resumo-do-material.test.ts`
- `e2e/material-resumo.spec.ts`

## frontend-reviewer · 2ª rodada · APROVADO · 2026-11-14 02:02:06 · `tasks/prd-ingestao-do-material/11_task.md`

VEREDITO: APROVADO
Tela vista: sim (4 fotos lidas, cheia e vazia, computador e celular). A escola "cheia" da vitrine não tem material, então as duas aparecem no estado vazio. Ficaram sem foto, conferidos só por código e testes: o resumo com dado (tabela no computador, lista no celular), o aviso "Séries atribuídas na migração", o erro do resumo, o erro da lista, os dois erros juntos, o carregando e o "Mostrar mais".
Estados: ok.
- Carregando: `LoadingState "Carregando o resumo…"`, só quando alguma das três leituras ainda não chegou (`ResumoDoMaterial.tsx:144`).
- Vazio: convida ("Quando a escola enviar o primeiro PDF, os números aparecem aqui"), com a leitura terminada (`ResumoDoMaterial.tsx:73`). A foto confirma.
- Erro: `ErroDoResumo`, com a mensagem de `errorMessage` e o botão "Tentar de novo o resumo" (`ResumoDoMaterial.tsx:34`). Se a releitura falha com o resumo já na tela, o número de antes fica e o vazio não é dito no lugar do erro (`:66` e `:73`).
- Com dado: `Table`.

Acessibilidade: ok.
- O erro usa `role="alert"` e a lista de status usa `role="status"`.
- O botão do resumo tem nome próprio, distinto do "Tentar de novo" da lista. `Material.test.tsx` prova os dois erros juntos, com um botão cheio e o outro secundário.
- O aviso da migração usa `role="note"`.
- A tabela tem `caption` e `scope`.
- A região rolável recebe foco e nome (`Table.tsx:85`).
- O heading está ligado à seção por `aria-labelledby`.

Chromebook fraco: ok.
- O resumo não tem mais laço próprio de 1,5 s (`api/resumo.ts`, sem `refetchInterval`, e um teste prova isso).
- Ele só se relê quando a assinatura `id:estado` da lista muda, ou quando o resumo ainda conta `processando` e a lista já não tem nenhum (`ResumoDoMaterial.tsx:103-114`).
- "Mostrar mais" revela 25 linhas por vez. A troca de sessão volta às 25 linhas (`Material.tsx`, com teste).
- Não rodei throttling de CPU nem de rede. A relação com o teto de pedidos por minuto está na Tech Spec, e o excesso da lista, que já existia, foi para o `TODO.md`.

Celular:
- A 360 px (fotos vazias) não há rolagem horizontal nem corte.
- Os dois cartões quebram o texto e o botão "Enviar material" tem 44 px.
- No código, a tabela vira lista abaixo da largura (`Table.tsx:62`).
- O botão do resumo usa `Button`, com face de 44 px (`Button.tsx`).
- `ErroDoResumo` quebra linha com `flex-wrap`.
- A barra de abas quebra em duas linhas a 360 px, sem esconder nenhuma aba. Isso é da casca, não desta tarefa.
- Nada depende de hover. O e2e do resumo roda nos projetos `chromebook` e `celular`.

Ação oficial protegida: sim. A tela só lê e não executa nada oficial; "Tentar de novo o resumo" só relê. O resumo mostra contagens, sem título, licenciante nem autor, e é só da coordenação.
Português: ok. Sem termo técnico nem texto em inglês nas fotos. Números pelo `formatNumber`.
Saída de IA: não se aplica, a tela não tem saída de IA.
Pele e `docs/interface.md`: sem contradição. A tela reusa `Button`, `Table` e `LoadingState`. O `ErroDoResumo` próprio se justifica no comentário: o `ErrorState` da casca só tem o botão primário, e a tela só pode ter um primário. A mesma frase foi registrada em `docs/interface.md` 3.
Rolam a 1366 × 768: nenhuma; a lista está vazia, e a tela cabe em 768 px.
Correções da rodada anterior: a recomendação aplicada, o botão secundário "Tentar de novo o resumo" com bloco de erro próprio, foi feita. Cobrem-na `ResumoDoMaterial.test.tsx` e `Material.test.tsx`, que prova os dois erros juntos. Não encontrei defeito novo no diff.

Bloqueantes: nenhum.

Recomendações (já no `TODO.md`, não bloqueiam):
- Os dois vazios empilhados na escola nova ("Ainda não há material para resumir…" e "Nenhum material ainda") dizem quase o mesmo.
- O texto do aviso da migração abre com "migração" e fala de "9º ano" e "6º". Ele não pode ser dispensado.
- "Disciplina" e "Série" soltos quando o id não está na lista lida.
- Semear material na escola cheia da vitrine (`tools/vitrine/escola.ts:216`). Sem isso o Validador só fotografa o vazio. O resumo com dado e o aviso precisam ser fotografados na validação final.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-14 02:02:39 · `tasks/prd-ingestao-do-material/11_task.md`

VEREDITO: APROVADO

A rodada 2 mexeu sobretudo no ritmo de releitura da tela. Do lado do servidor, a consulta das recusas ficou mais restrita. Nenhum campo pessoal entrou e nenhum dado passou a ser exposto. Auditei o código atual da API, do pacote shared e da migration, além do diff r1→r2.

- **Campos pessoais tocados:** nenhum. A resposta do resumo (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/shared/src/material/material.ts`) segue com campos fechados (`z.strictObject`): só `disciplinaId`, `serieId` e as contagens, mais `semSerie`. Não sai título, licenciante, autor nem nada de aluno. A migration 0057 só cria um índice parcial: nenhuma coluna nova.
- **Fora da tabela de dados do docs/lgpd.md:** nada, porque não há campo novo.
- **Autorização por objeto:** ok.
  - `GET /v1/materiais/resumo` exige `material.resumir`. Coordenação vê a própria escola; professor, aluno e rede ficam em `nunca`.
  - Não há id na URL que dê para trocar. A escola vem do contexto autenticado (`requireEscolaId()`), tanto em `MaterialRepository.contarPorDisciplinaESerie` quanto em `AuditoriaRepository.recusasDeMaterialDesde`.
  - Professor e aluno recebem o 404 `NAO_ENCONTRADO`, o mesmo de uma rota que não existe. O teste agora compara com `/v1/rota-que-nao-existe`, fora de `/v1/materiais`, e afirma o status e o código também do lado da rota inexistente. Ficou mais forte que na rodada 1.
  - A recusa por licença inexistente segue fora da contagem, para o resumo não confirmar que uma licença de outra escola existe.
- **Logs:** limpos. `material.service.ts` só registra ids, código e tamanho (`:151`, `:240`, `:279`, `:372`, `:385`). Os arquivos novos da tela não têm `console`.
- **Auditoria:** presente onde a regra pede. O resumo é um agregado de material, não leitura de dado de aluno, então não exige registro. A consulta da auditoria passou a filtrar também `entidade = 'disciplina'` e, sem motivo a contar, devolve vazio sem ir ao banco. As duas coisas restringem a leitura e cada uma tem teste. `AuditoriaRepository` continua só de leitura e sem método fora do escopo da escola (`porta-unica.test.ts`).
- **Envio externo:** nenhum. Não há IA nem provedor nesta tarefa.
- **Seed/fixture:** sintético. O teste novo grava na `auditoria` uma linha com ids aleatórios e `motivo: 'sem_licenca'`. As fotos mostram "Colégio sintético da vitrine…" e "Coordenadora sintética…".
- **Fotos (as quatro de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/.processo/vitrine/`):** computador e celular, escola cheia e vazia, só com o estado vazio do resumo e da lista. Nenhum dado de pessoa aparece na área do material. A vitrine não semeia material, então a tela com dado não foi vista em foto; o DTO fechado compensa, porque a tela não tem como receber nome nem título.
- **Ciclo de sessão:** a troca de sessão já fechava o diálogo e limpava as recusas. Agora também volta o "Mostrar mais" às 25 primeiras linhas, com teste. O cache do resumo fica sob a chave de Material e é limpo junto na troca de sessão ou de escola. Melhoria para a regra 20, item 15.
- **Recomendações da rodada 1:** os dois motivos para não aplicar são aceitáveis.
  - (a) A rede segue provada pela matriz (`matriz.test.ts` e `matriz.expectativa.ts`), já que a fixture de sessão não cria rede.
  - (b) `recusaSemLicenca` grava a recusa pelo envio real e o resumo a conta, o que já liga o formato gravado ao formato lido.

Bloqueantes: nenhum.

Recomendações:
- Semear materiais na escola cheia da vitrine (já está no `TODO.md`) para que a tela do resumo com dado tenha foto antes da validação final da spec.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-14 02:02:44 · `tasks/prd-ingestao-do-material/11_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A tarefa não grava em `Nota`. O diff da 1ª para a 2ª rodada mexe só na releitura do resumo na tela, no filtro `entidade = 'disciplina'` da leitura da auditoria e em textos e testes. Todos com autor humano? Não se aplica.
Decisão autônoma sobre aluno: ausente. O resumo conta materiais e recusas por disciplina e série. Não tem aluno nem trajetória.
Aprovação registrada: ok. Nenhuma saída de IA é criada nem mostrada. As fotos mostram só o resumo e a lista, sem conteúdo gerado por IA.
Supervisão do tutor: ok. O Tutor não foi tocado. O texto do vazio, que diz que o Assistente e o Tutor tiram atividades do PDF citando a página, só descreve o que o material faz. Não fala como IA e não induz uso.
Autonomia declarada e visível: sim, sem mudança. Nenhum agente novo, nenhum nível alterado.
Bloqueantes: nenhum.

O que conferi na regra 70, agora no código atual e não só no diff:
- **Item 8 (medir o professor) e item 9 (recusar não gera indicador).** A resposta `resumoDoMaterialResponseSchema` (`packages/shared/src/material/material.ts:183-201`) é um `strictObject` só com ids de disciplina e série e contagens. `MaterialService.resumir` (`apps/api/src/material/material.service.ts:464-490`) agrupa só por disciplina e série. Não agrupa por `enviadoPor` e não mostra quem enviou nem quem teve o envio recusado. Assim, a contagem de recusas em 30 dias não vira indicador por pessoa.
- **Leitura da auditoria.** `recusasDeMaterialDesde` (`packages/core/src/auditoria/auditoria.repository.ts:99-`) devolve só a disciplina, a série e o total. O filtro novo `entidade = 'disciplina'` e o retorno vazio quando não há motivo a contar reduzem o que é lido. Nenhum autor sai dali.
- **Fotos** (`.processo/vitrine/coordenacao--coordenacao-material--computador.png`, `…--celular.png`, `vazia--coordenacao--coordenacao-material--computador.png`, `vazia--…--celular.png`). As quatro mostram o mesmo vazio, "Ainda não há material para resumir…", mais "Nenhum material ainda" com "Enviar material". Não aparece nota nem conceito, nada de IA sem rótulo, e nada que induza uso ou dificulte sair. A escola cheia também aparece vazia, como já foi avisado, porque a vitrine não semeia material.
- **Rodada anterior.** Não havia correção exigida. A recomendação de semear a vitrine está registrada em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/TODO.md:3581`.

Recomendações:
- Continua aberta a da 1ª rodada (`TODO.md:3581`): semear materiais e uma recusa na escola cheia da vitrine (`tools/vitrine/escola.ts`). Assim a tabela com dado, a linha "Sem série" e o aviso da migração ganham foto antes do fim da spec. Sem isso, só a contagem sem autor dos testes de integração mostra que a tela não leva pessoa nenhuma.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-14 02:02:47 · `tasks/prd-ingestao-do-material/11_task.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. Esta rodada mudou duas coisas além das recomendações:

- **Fim do laço de 1,5 s do resumo**, pedido pelo `infra-guardian`. Já está na `techspec.md` §11, linha "11.0", com a conta de pedidos por minuto e o gatilho do índice sem `concurrently`.
- **O filtro `entidade = 'disciplina'`**, também já na mesma linha.

O botão "Tentar de novo o resumo" está em `docs/interface.md`. O `cenarios.md` só fala dos quatro estados, sem o ritmo da releitura, então não precisava mudar.

Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)

Bloqueantes: nenhum

As três recomendações que a Mesa mandou aplicar foram feitas:

- **Lista vazia de motivos:** `auditoria.repository.ts` devolve `[]` antes de consultar o banco, com caso de integração e mutação.
- **"Mostrar mais" na troca de sessão:** a tabela volta a 25 linhas em `Material.tsx:130`, com caso em `Material.test.tsx`.
- **800 contra 776 linhas:** o número está corrigido no `11_task.md` e na Tech Spec.

O sufixo `Row` foi recusado com o motivo registrado, e os itens destinados ao `TODO.md` estão lá, na seção "Da ingestao-do-material, tarefa 11.0".

As fotos da escola vazia, no computador e no celular, mostram os dois vazios empilhados. Isso já está no `TODO.md` para a retro e não é desta tarefa. Fora isso, a tela entrega o que a interface e a Tech Spec descrevem.

Recomendações:
- **Comentário que contradiz a biblioteca:** `apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx:101` diz que "invalidá-lo não abre outro pedido enquanto ele já está lendo". No TanStack Query v5, `invalidateQueries` usa `cancelRefetch: true` por padrão. A leitura em curso é cancelada e outra começa, e o servidor já contou a primeira. A carga continua limitada a um pedido por mudança de estado, mas o texto está errado. Duas saídas: passar `{ cancelRefetch: false }` em `ResumoDoMaterial.tsx:112`, que torna o comentário verdadeiro, ou corrigir o comentário.
- **Ref que sobrevive à troca de escola:** `useRelerOResumoQuandoUmEstadoMuda` guarda a assinatura anterior num `useRef` que não é zerado em `aoTrocarDeSessao`. Com o componente ainda montado, a primeira lista da escola seguinte é comparada com a da anterior e pede uma releitura a mais. É inofensivo, porque o cache já foi esvaziado, mas zerar o ref junto com o resto da sessão deixa o comportamento previsível.
- **Esperas fixas nos testes:** `ResumoDoMaterial.test.tsx` usa `setTimeout` real de 100 ms e de 1.800 ms para provar que um pedido não aconteceu. Funciona, mas o caso de 1,8 s alonga a suíte. Com relógio falso, a mesma prova fica instantânea e determinística. A decisão é do `test-engineer`.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/material/Material.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/auditoria/auditoria.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/techspec.md

## infra-guardian · 2ª rodada · APROVADO · 2026-11-14 02:03:16 · `tasks/prd-ingestao-do-material/11_task.md`

VEREDITO: APROVADO
Caminho quente tocado: migration (a 0057 não mudou nesta rodada). A aba Material da coordenação não está no caminho quente da aula.
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: compatível
Métrica e alerta: ok
Bloqueantes: nenhum

**A correção exigida na 1ª rodada foi feita.**
- **O resumo não tem mais laço próprio.** O `refetchInterval` saiu de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/material/api/resumo.ts`, e um teste confere isso (`resumoDoMaterialQueryOptions.refetchInterval` indefinido).
- **O resumo se relê em dois casos só.** O primeiro é quando muda a assinatura `id:estado` da lista. O segundo, quando o resumo ainda conta `processando` e a lista não tem nenhum (`useRelerOResumoQuandoUmEstadoMuda`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx:108-118`).
- **Os testes de unidade provam esse ritmo.** A lista relida igual não pede o resumo, nem em outra ordem. Um estado que muda pede uma vez só. Com `processando` e sem mudança na lista, ele não se relê em 1,8 s. A primeira lista que já bate com o resumo também não pede.
- **Não há laço novo.** O efeito só roda quando a referência de `lista?.itens` muda. O TanStack mantém a mesma referência quando o dado é igual. A releitura do resumo não está nas dependências do efeito, então reler o resumo não dispara o efeito de novo. Se o caso "atrasado" durar, ele só age quando a lista é relida, e a lista só se relê sozinha enquanto há `processando`. O teto do resumo é, portanto, o ritmo da lista: 40 por minuto no pior caso.
- **A conta da Tech Spec (linha 11.0) bate com o código.** A lista faz 40, 80 e 120 pedidos por minuto (até 100, 200 e 300 materiais). O resumo soma 1 por mudança de estado, ou até 40 no pior caso. A conta compara tudo com `LIMITE_REQ_USUARIO_MIN=120`, de `.env.example:70`.
- **As recomendações aplicadas na 1ª rodada estão confirmadas.**
  - O EXPLAIN agora roda o SQL que `recusasDeMaterialDesde` gera de verdade.
  - O filtro novo `entidade = 'disciplina'` continua usando o índice parcial (há teste).
  - Sem motivo a contar, a consulta responde vazio sem ir ao banco.
  - O gatilho do `concurrently` está escrito na Tech Spec.

Recomendações:
- **Priorizar no `TODO.md` a releitura da lista antes do piloto.** A escola com 201 a 300 materiais e um `processando` já está nos 120 por minuto só com a lista. Qualquer releitura do resumo nesse período leva a coordenadora ao 429. A tela aguenta: mostra o erro, mantém o número de antes e oferece o "Tentar de novo o resumo". A causa vem de antes desta tarefa (`api/material.ts:29` e `:38`), e a Mesa já a mandou para o `TODO.md`.
- **Corrigir o comentário de `ResumoDoMaterial.tsx:104-105`.** Ele diz que invalidar "não abre outro pedido enquanto ele já está lendo". Mas `invalidateQueries` usa `cancelRefetch: true` por padrão: cancela a leitura em curso e abre outra. Ou se corrige o texto, ou se passa `{ cancelRefetch: false }`. O número de pedidos tem o mesmo teto nos dois casos.
- **Trocar a espera de 1,8 s com relógio de verdade** no caso "o resumo não se relê sozinho" (`ResumoDoMaterial.test.tsx`) por relógio falso. Com relógio falso o teste fica determinístico e mais rápido.

## test-engineer · 2ª rodada · REPROVADO · 2026-11-14 02:04:33 · `tasks/prd-ingestao-do-material/11_task.md`

VEREDITO: REPROVADO

**Cenários exigidos (rodada 2: o diff desde a 1ª e o que ele afeta):**
- O resumo não tem laço próprio.
- O resumo se relê quando a lista mostra que um estado mudou, e não quando a lista volta igual.
- A primeira lista lida não relê o resumo.
- O resumo atrasado se relê: ele ainda conta `processando` e a lista, mais nova, já não tem nenhum. Isso vale nas duas ordens de chegada das respostas.
- A exclusão e a recusa relêem o resumo.
- O "Tentar de novo o resumo" relê as três leituras.
- Com as duas leituras caídas, os dois botões têm nomes diferentes.
- A troca de sessão volta às 25 linhas.
- O `semSerie` soma três materiais em duas linhas.
- O EXPLAIN roda sobre o SQL de produção.
- O resumo só conta registro de `entidade = 'disciplina'`.
- Sem motivo a contar, não há consulta.
- O 404 é igual ao de uma rota fora de `/v1/materiais`.

**Cobertos:**
- Todos os cenários acima, com uma exceção: o resumo atrasado tem teste numa só ordem de chegada.
- Cada recomendação da 1ª que a Mesa mandou aplicar foi aplicada e tem teste citado pelo nome na tabela do documento: o EXPLAIN sobre a consulta capturada no executor, o "Tentar de novo o resumo" que relê as três (`it.each`, com clique e tabela), o `semSerie` 3 contra 2 linhas e a rota `/v1/rota-que-nao-existe`.
- As mutações novas batem com o `git diff`, uma por cláusula nova:
  - `mudou || atrasado`: um bloco para cada lado.
  - `anterior.current !== undefined`.
  - `anterior.current = assinatura`.
  - `.sort()` e o `:estado` da assinatura.
  - os dois lados de `resumoFicouParaTras`.
  - `refetchInterval`.
  - `TENTAR_DE_NOVO_O_RESUMO` e `variante="secundario"`.
  - `definirVisiveis(MATERIAIS_POR_VEZ)`.
  - `entidade = 'disciplina'`.
  - `motivos.length === 0`.
  - `acao like`.
  - `semSerie += 1`.
- Os blocos da regra de 1,5 s que saiu foram removidos junto com ela.
- Rodei a unidade da web: `ResumoDoMaterial.test.tsx`, `resumo-do-material.test.ts` e `Material.test.tsx`, 113 de 113 verdes.
- `apps/api/test/material-resumo.int.test.ts` não pôde rodar: 16 de 17 casos deram 404 na rota. O `dist` de `packages/shared` e de `packages/core` é das 21:00, mais velho que o código. O 404 vem do ambiente, não do código, e não reconstruí o `dist` porque não posso alterar arquivos. Para esse arquivo, fico com as mutações que o portão já provou.

**Bloqueantes:**

1. **O resumo atrasado fica preso quando a lista chega antes dele.** Isso é um bug no código de produção desta rodada, e o caso não tem teste.
   - **Onde:** `apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx:106-113`.
   - **O que está errado:** o `useEffect` calcula `atrasado` com `cliente.getQueryData(RESUMO_DO_MATERIAL_QUERY_KEY)`, mas só reage a `[materiais, cliente]`.
   - **Como acontece:**
     1. A aba abre com um material `processando`.
     2. Ele termina entre a leitura do resumo no banco e a da lista.
     3. A resposta da lista chega primeiro. É a ordem mais provável: o resumo começa antes, porque o componente filho assina antes, e a consulta dele é a mais pesada.
     4. O efeito roda com o resumo ainda `undefined`, então `atrasado` dá `false`, e a assinatura é gravada.
     5. Quando o resumo chega contando `processando: 1`, nada roda de novo. A lista não tem mais `processando`, então ela para de se reler, e o compartilhamento estrutural do TanStack mantém a mesma referência de `materiais`.
   - **Resultado:** o resumo mostra "1 processando" indefinidamente, enquanto a lista mostra "pronto". A Tech Spec (linha 11.0) e o documento ("a releitura") prometem esse caso.
   - **O teste existente cobre só a outra ordem:** `ResumoDoMaterial.test.tsx:303` monta o resumo primeiro e entrega a lista depois.
   - **Correção exigida:**
     - Reavaliar `atrasado` também quando o resumo chega, por exemplo com `resumo.dataUpdatedAt` (ou `resumo.data`) entre as dependências do efeito. Não há risco de laço: lista e resumo leem o mesmo `excluido_em is null` (`material.repository.ts:338` e `:359`).
     - Um caso novo em que a resposta do resumo fica pendente, a lista `[pronto]` chega antes, depois o resumo responde `processando: 1`, e o teste espera a segunda leitura e a célula atualizada.
     - O bloco de mutação dessa dependência.

**Recomendações:**
- **Comentário que contradiz a biblioteca.** `ResumoDoMaterial.tsx:101` diz que invalidar "não abre outro pedido enquanto ele já está lendo". No TanStack v5, `invalidateQueries` usa `cancelRefetch: true` por padrão: aborta a leitura em curso e começa outra, que o servidor atende do mesmo jeito. Passe `{ cancelRefetch: false }` ou corrija o comentário.
- **Bloco de mutação que fica vermelho pelo motivo errado.** O bloco `- if (materiais === undefined) return` (teste "a primeira lista lida…") falha por `TypeError` em `assinaturaDosEstados(undefined)`, e não pela asserção. A mutação `materiais ?? []` falha pela asserção (`doResumo === 1`) e prova a regra de verdade.
- **Esperas pelo relógio de verdade.** Há esperas negativas em `ResumoDoMaterial.test.tsx:283`, `:289`, `:299` (1,8 s) e `:328`. Elas não dão falso vermelho, mas sob carga podem passar à toa. O caso de `:299` tem relógio falso como alternativa, e a ausência de `refetchInterval` já está provada de forma determinística em `resumo-do-material.test.ts` ("a consulta do resumo não tem laço próprio").
- **`dist` velho.** O de `packages/shared` e `packages/core` faz a integração do resumo dar 404 em quem a rodar sem `build`. Vale o portão confirmar que constrói antes de rodar os `.int.test.ts`.

## tenancy-guardian · 3ª rodada · APROVADO · 2026-11-14 02:24:06 · `tasks/prd-ingestao-do-material/11_task.md`

```
VEREDITO: APROVADO
Tabelas verificadas: nenhuma tabela nova nesta rodada. A migration 0057 (auditoria) e o schema estão iguais ao commit 46204d90, sem mudança desde a 2ª rodada aprovada.
Queries verificadas: nesta rodada nenhuma query nova ou alterada no servidor. A query do resumo continua escopada pelo token: apps/api/src/material/material.repository.ts aplica `eq(material.escolaId, requireEscolaId())`, e o join de `materialSerie` também filtra por `escolaId`. Do lado do cliente, /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx (efeito `useRelerOResumoQuandoUmEstadoMuda`, que agora recebe `resumoLido`) chama só `/v1/materiais/resumo`, sem `escolaId` na query nem no corpo. A chave `RESUMO_DO_MATERIAL_QUERY_KEY` segue dentro de `MATERIAL_QUERY_KEY` (/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/material/api/resumo.ts), e esse cache é esvaziado quando a sessão ou a escola trocam.
Teste de isolamento: presente e efetivo. Está em /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/material-resumo.int.test.ts, sem mudança desde a rodada aprovada.
Bloqueantes: nenhum
Recomendações: nenhuma nova. A rodada mexeu só na releitura do resumo no frontend, sem efeito no escopo de escola. As fotos da vitrine mostram só o estado vazio e não exibem dado de outra escola.
```

Conferi que o código atual bate com o commit 46204d90: os arquivos ainda não versionados estão idênticos ao commit, e os já versionados não têm mudança além dele.

## frontend-reviewer · 3ª rodada · APROVADO · 2026-11-14 02:24:18 · `tasks/prd-ingestao-do-material/11_task.md`

VEREDITO: APROVADO

Tela vista: sim (4 fotos lidas: computador e celular, escola cheia e vazia). Como a vitrine não semeia material, as quatro mostram o mesmo estado vazio. Ficaram sem foto, e só conferi pelo código e pelos testes: o resumo com dado (tabela e lista), o aviso "Séries atribuídas na migração", o carregando, os dois erros, o "Mostrar mais" e a releitura. Também não vi a tabela do resumo a 1366 px nem a lista a 360 px com dado.

Estados: ok.
- Carregando: `ResumoDoMaterial.tsx:147`, "Carregando o resumo…".
- Erro: `ErroDoResumo`, em `:34`, com o botão "Tentar de novo o resumo". Se o resumo já está na tela e a releitura falha, o erro vem ao lado e o número de antes fica (`:66`).
- Vazio: convida a agir e diz o que acontece com o primeiro PDF (`:73-75`), sem pedir desculpa. O vazio só aparece com a leitura terminada e sem releitura caída.
- Com dado: `Table`, com os nomes de disciplina e série no lugar dos ids.

Acessibilidade:
- Região com `aria-labelledby`.
- `role="alert"` e `role="status"` nos erros.
- `role="note"` no aviso.
- A tabela tem `caption`, `th scope` e `dt`/`dd` no celular.
- Os dois botões de erro têm nomes diferentes.
- Contraste e foco vêm dos componentes da casa.
- Sem campo novo.

Chromebook fraco:
- A tabela de materiais mostra 25 por vez, com "Mostrar mais". Isso é paginação no cliente, e não virtualização: serve para centenas de linhas, e a lista já é paginada pela API.
- O resumo não tem laço próprio. Ele se relê quando a lista mostra um estado que mudou.
- No efeito corrigido na R3, `resumoLido` entra nas dependências. O TanStack mantém a referência quando a leitura nova é igual, então não há laço (`ResumoDoMaterial.tsx:105-116`).
- A dica da R2 vale: o teste da R3 cobre o resumo que chega depois da lista (`ResumoDoMaterial.test.tsx`, caso novo do diff).
- Não rodei o throttling de CPU e de rede, só li o código.

Celular:
- A 360 px não há rolagem horizontal nem corte nas duas fotos. O botão "Enviar material" mede cerca de 46 px, as sub-abas ficam acima de 24 px, e não há hover nem atalho.
- A `Table` troca para lista abaixo de 768 px, com o rótulo de cada valor em texto.
- O e2e `e2e/material-resumo.spec.ts` roda nos projetos `chromebook` e `celular`.
- Nenhum fluxo exige o celular.
- A linha `Rolam a 1366 × 768` diz "nenhuma", e o `prd.md` não tem RF de "cabe a 1366".

Ação oficial protegida: sim. O resumo só mostra contagens. A exclusão e o envio continuam com os diálogos já existentes. Não há saída de IA nesta tela, então não há marca de IA a exigir.

Bloqueantes: nenhum.

Termos técnicos na tela: não achei id, chave de tradução nem inglês. O texto está em português do Brasil, e `formatNumber` formata os números.

Recomendações (todas já registradas no `TODO.md`):
1. A tela da escola nova mostra dois vazios empilhados: "Ainda não há material para resumir…" e "Nenhum material ainda". Está nas fotos, e é o que o `cenarios.md` pede. Fica para decisão do Arquiteto.
2. O aviso em `resumo-do-material.ts` (`avisoDaMigracao`) abre com "Séries atribuídas na migração". "Migração" é palavra interna, e o texto não pode ser dispensado. Convém reescrever, por exemplo "Confira a série destes materiais".
3. A vitrine precisa semear material (`tools/vitrine/escola.ts:216`). Sem isso, o Validador só consegue fotografar o vazio.
4. A releitura da lista perto do teto de 120 pedidos por minuto (regra 80) deve ser priorizada antes do piloto.
5. O `useRef` da assinatura anterior não é zerado em `aoTrocarDeSessao`. É inofensivo.

Arquivos: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/material/Material.tsx` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/material/resumo-do-material.ts`.

## revisor-geral · 3ª rodada · APROVADO · 2026-11-14 02:24:45 · `tasks/prd-ingestao-do-material/11_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum

Nesta rodada, a correção exigida foi só o comentário de `invalidateQueries`/`cancelRefetch`, e ela está feita. Está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx:103` e descreve certo o que o código faz: a invalidação cancela a leitura em curso e começa outra, que é o padrão do TanStack.

**O efeito de releitura mudou** (`ResumoDoMaterial.tsx:105-115`). Ele agora também roda quando o resumo chega. Antes, o resumo que chegava depois da lista ainda contando `processando` ficava assim para sempre; isso está corrigido. Procurei laço e não achei:
- **A lista** (`Material.tsx:194`) chega como `lista?.itens`, o dado da própria consulta. A referência fica estável entre as renderizações.
- **O resumo** volta com a mesma referência quando a leitura nova é igual, porque o TanStack compartilha a estrutura.
- **No caso que nunca se resolve sozinho** (o resumo conta `processando` e a lista não tem nenhum), sai uma releitura a mais e o efeito para.
- **A Tech Spec** (`techspec.md:206`, "quando o resumo na tela ainda conta `processando` e a lista, mais nova, já não tem nenhum") cobre o resumo que chega antes e o que chega depois. Não há divergência.
- **O caso novo** (`ResumoDoMaterial.test.tsx:321`) cobre esse cenário e tem a mutação declarada em `11_task.md`, que tira `resumoLido` das dependências do efeito.

**Fotos:** as quatro mostram o vazio do resumo ("Ainda não há material para resumir…") acima de "Nenhum material ainda", no computador e no celular. A foto da escola cheia mostra o mesmo vazio, porque a vitrine não semeia material. Os dois casos já estão no `TODO.md`. Os nomes seguem o glossário e a tela não mostra nada além do que a tarefa pede.

Recomendações:
- O `useRef` que guarda a assinatura anterior continua sem ser zerado na troca de sessão. Com a nova dependência `resumoLido`, ele continua inofensivo: na sessão nova, no máximo uma releitura a mais. O item já está no `TODO.md`.
- `ResumoDoMaterial.tsx:100-103`: o comentário do efeito ficou longo, quatro linhas sobre um efeito de oito. Dá para cortar à metade sem perder o motivo (a lista que chega antes, a referência estável que impede o laço).

## conformidade-reviewer · 3ª rodada · APROVADO · 2026-11-14 02:24:49 · `tasks/prd-ingestao-do-material/11_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. Esta rodada não grava em `Nota`, e o resto da tarefa também não. Todos com autor humano? Não se aplica.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. Não há saída de IA nesta tarefa. O resumo só conta materiais (prontos, processando, com falha, recusados em 30 dias e sem série) e não leva título, licenciante nem autor.
Supervisão do tutor: ok. A tarefa não toca no tutor.
Autonomia declarada e visível: sim, e nada nesta tarefa mexe nisso. A tela não mostra agente agindo.

Bloqueantes: nenhum

O que conferi nesta rodada (3ª):
- O diff entre `889c6be` e `46204d9` muda só quatro arquivos: `ResumoDoMaterial.tsx`, o teste dele, `11_task.md` e `TODO.md`.
  - A mudança: o efeito `useRelerOResumoQuandoUmEstadoMuda` passa a depender também de `resumoLido` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx:105-116`).
  - Isso decide só quando a tela relê as contagens. Não entra em nota, decisão sobre aluno, aprovação, tutor, autonomia, auditoria ou indicador de professor.
- O código atual é igual ao commit `46204d9`, tirando as linhas que o hook grava em `11_task.md` e `achados/indice.md`. O servidor não mudou desde a 2ª rodada, que aprovei.
- Procurei `nota`, `lancadaPor`, `llm`, `gateway` e `autonomia` no controller, no service e no repository do material, no `ResumoDoMaterial.tsx`, no `resumo-do-material.ts` e na migration `0057_auditoria_material_recusado.sql`. Nenhum aparece.
- Fotos, escola cheia e vazia, computador e celular (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/.processo/vitrine/coordenacao--coordenacao-material--computador.png`, `...--celular.png`, `vazia--coordenacao--coordenacao-material--computador.png`, `vazia--...--celular.png`):
  - Não há saída de IA sem rótulo, nota, conceito ou sugestão de nota, nem nada que induza uso ou dificulte sair (o "Sair" está visível no computador e no celular).
  - O texto do vazio, "É dele que o Assistente e o Tutor tiram as atividades e as explicações, sempre citando a página", diz o que é IA pelo nome de função (D17 e D58).
  - Como a vitrine não semeia material, as quatro fotos mostram só o estado vazio. A tela com números segue sem foto.

Recomendações:
- Continua no `TODO.md` da 1ª rodada: semear materiais na escola cheia da vitrine (`tools/vitrine/escola.ts:216`), para fotografar o resumo com dado no fim da spec. Hoje a "escola cheia" mostra o mesmo vazio da escola vazia.

## infra-guardian · 3ª rodada · APROVADO · 2026-11-14 02:25:30 · `tasks/prd-ingestao-do-material/11_task.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum

**Pedidos por minuto com `resumoLido` nas dependências** (`apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx:105-116`). Esta rodada só mudou o cliente; o servidor ficou igual.

- **Não há laço.**
  - Quando só o resumo muda, `mudou` dá falso, porque `anterior.current` já guarda a mesma assinatura. Só `atrasado` pode pedir uma releitura.
  - O resumo relido igual mantém a mesma referência. O compartilhamento de estrutura do TanStack é o padrão e não é desligado em `apps/web/src/api/query-client.ts`. Com a mesma referência, o efeito não roda de novo.
  - `materiais` é `lista?.itens` da consulta da lista (`Material.tsx:194`), que também mantém a referência quando a lista volta igual.
- **Releituras por mudança de estado.**
  - O caminho normal faz uma releitura, como na rodada 2.
  - O caminho novo (o resumo chega contando `processando` e a lista não tem nenhum) faz mais uma, e ela termina assim que o resumo volta igual.
  - Só há uma terceira releitura se o banco mudar de novo entre duas leituras. Isso é outra mudança de estado, e o total fica limitado pelo número de mudanças.
- **Rodei os testes.** `ResumoDoMaterial.test.tsx` e `resumo-do-material.test.ts` passaram, 34 de 34. O mutante que tira `resumoLido` das dependências está declarado no `11_task.md`.

Recomendações:
- **Falta um caso que prove o fim do laço.** No novo caso de `ResumoDoMaterial.test.tsx:321`, a segunda leitura volta sem `processando`. Por isso ele não prova que um resumo relido igual, ainda contando `processando`, não pede uma terceira leitura. Hoje isso só está garantido pelo compartilhamento de estrutura do TanStack. Sugestão: um caso em que a segunda leitura repete `processando: 1` com a lista sem `processando`, conferindo `doResumo(rede) === 2` depois que a rede assentar.
- **Escola com mais de 300 materiais.** `lerPaginas` para em 3 páginas e devolve `completa: false` (`apps/web/src/api/estrutura.ts:53-69`). Se um material `processando` estiver fora dessas páginas, `resumoFicouParaTras` dá verdadeiro, e cada mudança na lista faz duas leituras do resumo em vez de uma. A segunda para quando o resumo volta igual. O mesmo material, ao terminar, não faz o resumo se reler. Vale juntar ao item do `TODO.md` que já trata da releitura da lista com mais de 200 materiais.

## test-engineer · 3ª rodada · REPROVADO · 2026-11-14 02:26:11 · `tasks/prd-ingestao-do-material/11_task.md`

VEREDITO: REPROVADO

**Cenários exigidos (nesta rodada):** a correção 1 da 2ª rodada, o resumo que chega depois da lista ainda contando `processando` e se relê. Também: o efeito novo não pode criar laço de releitura, os blocos de mutação novos têm de ficar vermelhos pela asserção, e as duas recomendações da Mesa precisam estar aplicadas.

**Cobertos:**
- **Correção 1, feita.** `ResumoDoMaterial.tsx:105-115` recebe `leitura.resumo.data` e o põe nas dependências do efeito. O caso novo está em `ResumoDoMaterial.test.tsx:321`: o resumo fica pendente, a lista `[pronto]` chega antes, o resumo responde `processando: 1`, e o teste espera a célula com `1, 0` e duas leituras. Com a mutação `[materiais, cliente]`, o efeito não roda quando o resumo chega. O cálculo de atraso ficou com `resumoLido` ainda `undefined`, a célula fica em `0, 1` e o `waitFor` da linha 339 falha pela asserção. O bloco do documento (linhas 693-698) bate com o diff.
- **Mutação de `if (materiais === undefined) return`, vermelha agora pela asserção.** O bloco troca também a assinatura por `assinaturaDosEstados(materiais ?? [])`. `resumoFicouParaTras(…, undefined)` não lança erro, porque o `=== true && …` corta antes de ler `materiais.some`. A assinatura anterior vira `''`, a lista `[pronto]` conta como mudança e o caso "a primeira lista lida… não o relê" fica com 2 leituras em vez de 1. É o motivo certo.
- **O comentário sobre `invalidateQueries`/`cancelRefetch`** foi reescrito (linhas 100-104).
- **Sem laço hoje, pelo código.** `lista?.itens` e `resumo.data` vêm do cache do TanStack, que mantém a mesma referência quando a leitura nova é igual (`structuralSharing` não é desligado em nenhum lugar de `apps/web/src`). Um resumo relido igual não roda o efeito de novo. Uma releitura que falha também não, porque a `data` continua a mesma referência.
- **Testes:** `ResumoDoMaterial.test.tsx`, `resumo-do-material.test.ts` e `Material.test.tsx` passam, 114 casos. O carimbo do portão tem 91 mutações para este documento.

**Bloqueantes:**
1. **Nenhum teste prova que o caminho novo não cria laço** (`ResumoDoMaterial.tsx:112-115`).
   - **O que está errado:** a ausência de laço, que a linha "a releitura" da tabela do documento exige ("o resumo não tem laço próprio") e o comentário das linhas 102-103 afirma, depende de a referência de `resumoLido` ficar estável. Nenhum caso cobre o descompasso persistente: o resumo conta `processando` e a lista não, em toda leitura.
   - **O descompasso é real em dois casos:**
     - **Escola com mais de 1000 materiais.** `lerPaginas` para em 10 páginas (`apps/web/src/api/estrutura.ts:44`) e a lista sai em ordem crescente de id (`apps/api/src/material/material.repository.ts:345`). O envio novo, ainda `processando`, cai fora da lista.
     - **Releitura que falha.** O resumo antigo, com `processando`, fica no cache. É o cenário de `ResumoDoMaterial.test.tsx:250`.
   - **Uma mutação que cria laço passa em todos os casos de hoje.** Duas formas:
     - na linha 128, trocar o argumento por `leitura.resumo.data && { ...leitura.resumo.data }`, que dá uma referência nova a cada render;
     - pôr `resumo.dataUpdatedAt` na dependência. Fui eu que sugeri isso na 2ª rodada, e com esse descompasso ele daria laço. A escolha da referência da `data` foi a certa, mas nada a protege.

     Em qualquer das duas, cada render invalida, a invalidação cancela a leitura em curso e abre outra, e os pedidos vão a 429 em segundos (regra 80, itens 1 e 10).
     - O caso da linha 303 não pega: a releitura dele responde `pronto` e o atraso some.
     - O da linha 293 não pega: a lista tem `processando`.
     - O da linha 250 não pega: o `findByRole('alert')` continua passando com o laço, porque com dado na tela o status fica `error` durante a nova leitura.
   - **Correção exigida:**
     - Um caso em `ResumoDoMaterial.test.tsx › o resumo do material: a releitura`: o resumo responde sempre `linha({ processando: 1 })`, a lista é `[material(1, 'pronto')]`. Esperar `doResumo(rede)` igual a 2 (a releitura do atraso), dar a mesma pausa curta que os outros casos negativos já usam, e conferir que continua 2.
     - Um bloco `mutacao` com a referência nova a cada render na linha 128 (`leitura.resumo.data && { ...leitura.resumo.data }`), citando esse caso.
     - A linha "a releitura" da tabela de testes passa a nomear o caso.

**Recomendações:**
- `resumoFicouParaTras` (`resumo-do-material.ts:83-85`) ignora `completa: false` da lista. Na escola acima do teto, o resumo é relido uma vez a cada leitura nova dele, sem motivo real. Isso vem de antes desta rodada. Pode ir ao `TODO.md`, junto da linha da lista que se relê perto do teto: não comparar quando a lista veio incompleta.
- A dependência `cliente` no efeito é estável e não atrapalha. Nada a fazer.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/material/ResumoDoMaterial.test.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/material/resumo-do-material.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/api/estrutura.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/11_task.md

## revisor-geral · 4ª rodada · APROVADO · 2026-11-14 02:43:28 · `tasks/prd-ingestao-do-material/11_task.md`

**VEREDITO: APROVADO**

- **Escopo:** respeitado.
- **Aderência à Tech Spec:** ok.
- **Portão local:** carimbo válido. A conferência devolveu "portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)".
- **Bloqueantes:** nenhum.

Nesta rodada só mudaram o teste e o documento da tarefa. Comparei a árvore com o commit `8160ffd`: o código de produção e o e2e são idênticos ao de lá, inclusive a migration `0057` e o snapshot dela. Nada novo no código de produção para auditar além do que a 3ª rodada aprovou.

Sobre o caso novo em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/material/ResumoDoMaterial.test.tsx:343`:
- **Prova a regra:** o hook `useRelerOResumoQuandoUmEstadoMuda` relê o resumo quando ele ainda conta `processando` e a lista já não tem nenhum. Quando o servidor devolve o mesmo resumo, a referência do dado não muda e o hook não dispara de novo. O teste prova isso esperando mais 100 ms e cobrando exatamente duas leituras.
- **A mutação pega:** ela troca o argumento por `{ ...leitura.resumo.data }`, uma cópia nova a cada render. Com isso o hook relê sem parar, e o teste falha.
- **Documento em dia:** a linha "a releitura" da tabela de testes em `11_task.md` agora fala em oito casos e cita o novo.

**Recomendações:**
1. O teste depende de o TanStack Query devolver o mesmo objeto quando a resposta vem igual (é o padrão dele, o `structuralSharing`). Se o servidor devolver um resumo diferente e ainda com `processando`, o hook relê a cada resposta. Isso não aparece no código: vale uma linha no comentário do hook (`ResumoDoMaterial.tsx:105`) ou um caso de teste.
2. Seguem as duas recomendações das rodadas anteriores: o comentário longo do efeito e o `useRef` que não zera na troca de sessão (este já está no `TODO.md`).

## test-engineer · 4ª rodada · APROVADO · 2026-11-14 02:43:51 · `tasks/prd-ingestao-do-material/11_task.md`

VEREDITO: APROVADO

**Cenários exigidos.** Esta rodada só confere a correção 1 da 3ª rodada. O resumo pode estar atrasado de forma permanente: ele conta `processando` em toda leitura e a lista não tem nenhum (a escola passa do teto de páginas da lista, ou a releitura cai e deixa o resumo antigo no cache). Nesse caso deve haver uma releitura só, sem laço. O caso precisa falhar com a mutação pedida, e falhar pela asserção, não por tempo esgotado. O bloco do documento precisa bater com o que o portão provou, e a linha da tabela precisa nomear o caso.

**Cobertos.**
- **O caso novo existe e passa no código de hoje.** É `ResumoDoMaterial.test.tsx:343-353`, "o resumo relido que ainda conta `processando`, com a lista sem nenhum, não se relê de novo: uma releitura só, sem laço". O resumo é uma resposta fixa com `processando: 1`. A lista é `[material(1, 'pronto')]`, passada a `renderScreen` em linha, então ela é a mesma referência a vida toda e só a referência do resumo pode rodar o efeito. Rodei `ResumoDoMaterial.test.tsx` e `resumo-do-material.test.ts`: 35 de 35 verdes.
- **O vermelho vem da asserção.** O `waitFor` usa `toBeGreaterThanOrEqual(2)`, então ele não espera um 2 exato que o laço poderia pular. Com a mutação, o caso cai no `expect(doResumo(rede)).toBe(2)` final.
- **A mutação cria o laço que o caso pega.** Com `{ ...leitura.resumo.data }`, cada render entrega uma referência nova, o efeito roda de novo e o resumo atrasado chama `invalidateQueries`. Cada mudança de `isFetching` provoca outro render e outra invalidação, e cada uma faz uma leitura nova na rede. A contagem passa de 2 bem antes dos 100 ms. No código de hoje, o TanStack mantém a referência quando a leitura nova é igual, e a contagem fica em 2.
- **A outra forma citada também cai neste caso.** Pôr `dataUpdatedAt` na dependência muda o valor a cada sucesso e gera o mesmo laço.
- **O bloco bate com o código.** O `-` do bloco `mutacao` (`11_task.md`) é o texto exato da linha 128 de `ResumoDoMaterial.tsx`. O trecho no `teste:` ("o resumo relido que ainda conta") seleciona só esse caso.
- **O portão passou.** `.processo/portao.json` foi gravado às 05:29Z com 92 mutações e a impressão `9d2b826b995d8546`, o que inclui a mutação nova.
- **A linha da tabela está certa.** Ela nomeia o caso e diz "oito casos". O bloco `a releitura` tem de fato oito casos, nas linhas 250, 272, 293, 303, 321, 343, 355 e 366.
- **Nada mais mudou.** O código de produção é o mesmo da 3ª rodada. Não há `.skip`, mock que esconda a regra, nem chamada a provedor de IA.

**Bloqueantes:** nenhum.

**Recomendações.**
- Segue em aberto no `TODO.md`: `resumoFicouParaTras` ignora o `completa: false` da lista. Quando a lista vem truncada, o resumo continua sendo conferido contra ela. Agora é só uma releitura a mais, sem laço, e o caso novo garante isso.
