# Achados das revisões — `tasks/prd-ingestao-do-material/12_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-14 04:16:09 · `tasks/prd-ingestao-do-material/12_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova e nenhuma migration nesta tarefa. Escrevem em tabelas que já existem: `material` (título), `material_serie` (séries, com a FK `(escola_id, serie_id)` segurando a série de outra escola) e `auditoria` (a nova ação `material.atualizado`, só com ids e o booleano `tituloAlterado`). Nenhuma das três varia por período, e o teste "escola sem ano letivo em curso" confirma que o `PATCH` não depende de `anoLetivoId`.

Queries verificadas:
- `apps/api/src/material/material.repository.ts`: `travarParaAtualizar` (`escolaId` do contexto, `excluidoEm is null` e `for update`), `renomear` e `substituirSeries` (o `delete` e o `insert` têm `escolaId` do contexto). As que o `PATCH` já usava também são escopadas: `seriesDaEscola`, `edicaoEmAndamentoSobre`, `seriesDoMaterial` e `porId`.
- `packages/core/src/auditoria/auditoria.repository.ts`, `contarDaEscolaEDaPessoaDesde`: a escola vem de `requireEscolaId()` e a pessoa de `currentContext()`, nunca de argumento.
- `packages/shared/src/material/material.ts`, `atualizarMaterialRequestSchema`: é `strictObject` e não aceita `escolaId` nem campo fora do contrato. O teste com `disciplinaId` no corpo prova que esse campo é recusado.
- O `GET /v1/materiais/:id` que o painel chama para ler os capítulos não mudou: vai por `porId` e por `capitulos`, as duas escopadas.
- Sem `@Unscoped()` novo. Nada na camada rede: a permissão é `material.enviar`, que a rede tem como `nunca`.
- Id: o `IdPipe` aceita só UUID, e o material usa UUIDv7.

Teste de isolamento: presente e efetivo (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/material-patch.int.test.ts`, de 223 a 301).
- O material da B nos três estados (`pronto`, com edição `processando`, e a própria edição `processando`) responde `NAO_ENCONTRADO`, com o mesmo corpo de erro do id inexistente, e não muda nada na B. Isso prova que `NAO_ENCONTRADO` vem antes de `EDICAO_EM_ANDAMENTO` (regra 10, item 6).
- `serieIds` da B, sozinha ou junto com uma da A, responde igual à série inexistente, e a auditoria não leva o id dela.
- O teste direto no repository, no contexto da A, falharia se o `escolaId` saísse de `travarParaAtualizar`, `renomear` ou do `delete` de `substituirSeries`. As mutações declaradas na tarefa cobrem essas três cláusulas.
- No teto, os registros da escola B não contam para a A, e uma escola no teto não segura a outra.
- Professor e aluno recebem `NAO_ENCONTRADO`, igual ao id inexistente.
- O guard do teto roda antes da leitura do material. Por isso o 429 sai igual para qualquer id e não revela se o material existe.

Bloqueantes: nenhum

Recomendações:
- `apps/api/src/material/material.service.ts:935`: a checagem de que as séries são da escola (`seriesDaEscola`) roda fora da transação e sem trava. Isso não vaza dado entre escolas: a FK por escola segura a série de outra. Mas uma série excluída entre essa checagem e o `insert` vira erro de FK, e não `NAO_ENCONTRADO`. Vale o `infra-guardian` conferir se esse caso dá 500.
- `apps/api/src/material/material.repository.ts:853-864`: `renomear` e `substituirSeries` não filtram `excluidoEm` e confiam que quem chama já travou a linha. Um comentário dizendo que só se chamam depois de `travarParaAtualizar`, ou um nome que deixe isso claro, evita reuso sem a trava.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-14 04:16:14 · `tasks/prd-ingestao-do-material/12_task.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum. O `PATCH` de título e séries é usado pela coordenação fora da sala. O que ele muda é lido pela busca do Assistente e do Tutor, mas a busca não mudou nesta tarefa.
Rate limit: ok. O teto é de 100 alterações por hora por pessoa e 300 por escola, separado do teto de envios e conferido antes de ler o corpo. Acima dele, a API responde 429 com `Retry-After`. Nada é limitado por IP. A contagem lê a auditoria pelo índice `auditoria_escola_em_idx` (`escola_id`, `em`), numa janela de uma hora.
Fila e prioridade: ok. O `PATCH` só faz gravações curtas numa transação, e a edição nova continua indo para a fila de lote que já existia.
Concorrência: protegida. `travarParaAtualizar` trava a linha do material (`for update`) com o mesmo lock que o envio da edição usa (`travarAlvoDaEdicao`). Há três testes de corrida em `apps/api/test/material-patch.int.test.ts:367-460`:
- dois `PATCH` no mesmo material;
- edição enviada com um `PATCH` confirmado no meio;
- `PATCH` esperando a transação de uma edição.
Índice e paginação: ok. As consultas novas começam pela escola, e a de capítulos já existia e lê um material só.
Degradação de IA: não se aplica.
Migration: não se aplica.
Métrica e alerta: ok, porque não é caminho quente. A latência e o erro vêm da métrica HTTP comum. O log `material.teto_de_atualizacoes` leva só o tipo do teto, e não há alerta novo.
Bloqueantes: nenhum.
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/material.service.ts:384`: o `Retry-After` manda esperar a janela inteira (3600 s), mesmo quando o registro mais antigo sai da janela antes. A tela então mostra "Tente de novo às HH:MM" até uma hora à frente, mais do que o necessário. Dá para calcular a espera a partir do `em` mais antigo da janela.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/material.service.ts:373-385`: o teto conta só as alterações que deram certo (`material.atualizado`). Um cliente em laço que só recebe `NAO_ENCONTRADO` ou `EDICAO_EM_ANDAMENTO` nunca chega ao teto. Cada pedido desses custa pouco (uma leitura de série e uma tentativa de travar a linha), mas vale registrar que o teto protege das gravações, não da quantidade de pedidos.
- A contagem do teto lê sem trava, então algumas alterações feitas ao mesmo tempo podem passar um pouco dos 100 ou dos 300. Isso está documentado e é o mesmo comportamento do teto de envios. Só registro para a retro.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-14 04:16:32 · `tasks/prd-ingestao-do-material/12_task.md`

VEREDITO: APROVADO
Tela vista: sim (17 fotos lidas, cheia e vazia, computador e celular, mais a rota que o professor não alcança)
Estados: ok. Os capítulos têm os quatro estados em `PainelDoMaterial.tsx:58-93`.
- Carregando: "Carregando os capítulos…", com `role=status`.
- Erro: "Não foi possível ler os capítulos." e o botão "Tentar de novo".
- Vazio: o texto "sem capítulo" explica e diz que a busca continua achando o material pelas páginas. Está na foto `mesa12-semcapitulo-computador.png`.
- Com dado: a lista de capítulos em ordem, com número e páginas.

O material ainda em leitura diz "Os capítulos aparecem quando a leitura terminar". A tela vazia da escola nova convida a enviar o primeiro PDF (`mesa12-vazia-computador.png` e `mesa12-vazia-celular.png`).

Acessibilidade: ok.
- O resultado do salvamento fica numa região `status` ou `alert` que recebe o foco (`PainelDoMaterial.tsx:96-107`).
- Campos têm rótulo, o erro vem junto do campo, e o fieldset desabilitado cobre título e séries.
- O botão de escolher o PDF traz `aria-describedby` para o erro do arquivo.
- O e2e roda `seriousViolations` e `horizontalOverflow`.
- Não li o e2e com os projetos `chromebook` e `celular` em execução. Vi só o código dos testes.

Chromebook fraco: ok.
- `Rolam a 1366 × 768: nenhuma`. Antes das fotos procurei `1366` no `prd.md`: só aparece na linha 22, que não é RF de tela.
- A tarefa pede `paginaNaoRola` em 1366 × 768, e o e2e chama `paginaNaoRola` (`e2e/material-painel.spec.ts:116,124`).
- A lista de capítulos fica dentro do painel, que rola por dentro. Não há imagem a comprimir, só PDF, conferido na tela até 20 MB.

Celular: ok.
- A 360 px não há rolagem horizontal nem texto cortado (`mesa12-*-celular-*.png`).
- O painel abre como folha de baixo. A ação principal tem cerca de 46 px, e o botão de escolher o PDF tem `min-h-11` (`DialogoDeEdicaoNova.tsx:78`).
- O diálogo "Enviar edição nova" cabe inteiro a 360 px, com os botões empilhados.
- Nada depende de hover. Nenhum fluxo exige o celular.

Ação oficial protegida: sim.
- "Enviar edição nova" mostra, antes de enviar, o material de origem e o que a edição herda (disciplina, séries, de quem é, licença). Diz também que "A edição anterior sai da busca quando a nova ficar pronta. Até lá, ela continua valendo." (`mesa12-edicaonova-computador.png`, `DialogoDeEdicaoNova.tsx:73-76`).
- Excluir segue pelo diálogo de perigo que já existia.
- Salvar título e séries é uma correção reversível. O botão só liga quando algo mudou, trava durante o pedido e manda só o que mudou.
- Sem saída de IA nesta tela.

Pele e `docs/interface.md`: nada fora do padrão. Usa `Sheet`, `FormDialog`, `FormField`, `Button` e `StatusBadge`, que já existiam, e os tokens da casa. Não há termo técnico nem texto em inglês. A seção do painel foi escrita em `docs/interface.md` e bate com o código.

O professor chega a "Página não encontrada" no endereço `/coordenacao/material?material=<id>` (`mesa12-professora-computador.png`). Aparece o link para a página inicial, e o e2e cobre o caso.

Bloqueantes: nenhum.

Recomendações:
1. `PainelDoMaterial.tsx:154`: com a edição em leitura, o formulário aparece desabilitado e o porquê ("Espere a edição em processamento terminar.") fica abaixo dos campos. No celular, em `mesa12-emleitura-celular-1.png`, a pessoa vê campos cinzas sem motivo até rolar. Vale pôr o aviso logo abaixo da legenda "Corrigir título e séries", antes do título.
2. Na foto, as caixas de série medem 24 px, o mínimo. A linha inteira do rótulo é clicável? Confira em `CampoDeSeries`, em `PartesDoEnvioDeMaterial.tsx:175`. Não foi alterado nesta tarefa. Se a linha não for clicável, vale uma área de 44 px.
3. A foto do celular mostra o foco azul da região de rolagem do `Sheet` como um quadro em volta do conteúdo, mesmo sem teclado. É do componente existente, não desta tarefa. Fica para a retro.
4. Carregando e erro do `PATCH` e da edição nova (429, 503, edição em andamento) foram conferidos só pelo código e pelos textos (`material-painel.ts:172-217`). Não aparecem na vitrine.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-14 04:16:47 · `tasks/prd-ingestao-do-material/12_task.md`

VEREDITO: APROVADO

A tarefa 12.0 não alcança nada da regra 70. Ela mexe em metadados do material da escola (título, séries, capítulos e edição nova), e nenhum desses caminhos passa por nota, por saída de IA, pelo tutor ou por aluno.

Caminhos de escrita em Nota: nenhum. O diff não grava em `Nota`, não usa `lancadaPor` e não toca em correção. Todos com autor humano? Não se aplica, porque não há escrita.

Decisão autônoma sobre aluno: ausente.

Aprovação registrada: ok. Nenhuma saída de IA entra neste fluxo:
- Os capítulos vêm de leitura determinística do PDF. `packages/core/src/material/chapter-reader.ts` e `pdf-extractor.ts` não chamam `LLMProvider` nem o gateway.
- O título e as séries são digitados pela coordenação.
- O `PATCH` grava `material.atualizado` na auditoria pela porta única (`registro.gravar`), na mesma transação. O registro leva autor e data, e guarda só os ids das séries e se o título mudou, nunca o título (`packages/core/src/auditoria/acoes.ts:648`).

Supervisão do tutor: ok, nada mudou. O efeito no Tutor é indireto: as séries que a coordenação corrige mudam o que a busca do material entrega. É uma decisão humana, registrada e auditada.

Autonomia declarada e visível: sim, sem mudança. Nenhum agente novo e nenhum nível alterado.

Bloqueantes: nenhum.

O que conferi nas fotos:
- `mesa12-capitulos-computador.png`, `mesa12-emleitura-computador.png` e `mesa12-edicaonova-computador.png`: nenhuma saída de IA, nota, conceito ou sugestão de nota. Os agentes aparecem só pelo nome da função ("o professor e o Tutor da série marcada"; "A busca do Assistente e do Tutor já usa as séries novas"). Essas frases vêm de `apps/web/src/areas/coordenacao/material/material-painel.ts:530` e `:580`.
- O diálogo de edição nova avisa o efeito antes de enviar ("A edição anterior sai da busca quando a nova ficar pronta"), e "Cancelar" está ao lado de "Enviar edição nova". Sair não é mais difícil que entrar (regra 4b).
- `mesa12-professora-computador.png`: a professora recebe "Página não encontrada". Ela não alcança o painel.
- Nada de ranking, métrica de professor ou vigilância. O resumo no topo é só contagem por disciplina e série.
- Não abri `mesa12-lista-celular-1.png`, `mesa12-lista-celular-2.png`, `mesa12-vazia-computador.png` nem `mesa12-vazia-celular.png`.

Recomendações:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/.processo/vitrine/mesa12-capitulos-celular-2.png` e `mesa12-semcapitulo-celular-2.png` parecem iguais. As duas mostram o fim da lista, não o painel. Também não abri as fotos `-celular-1` desses dois estados, então não confirmei como o painel chega no celular. Vale o `frontend-reviewer` conferir se a vitrine capturou o estado certo. Para a regra 70 não muda nada.
2. O texto "A busca do Assistente e do Tutor já usa as séries novas" (`material-painel.ts:580`) diz à coordenação que a mudança vale na hora para os dois agentes. Convém um teste de integração que prove isso também do lado do Tutor, e não só na busca do material, para a frase não ficar sem prova se o escopo do Tutor mudar. Não bloqueia: o efeito está em `material.service.ts` e a regra 4c não muda.
3. `docs/regulacao.md` não precisava mudar nesta tarefa, e não mudou.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-14 04:16:59 · `tasks/prd-ingestao-do-material/12_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo. O `PATCH` só reescreve `material.titulo` e `material_serie`, que já existiam. O título é texto livre da coordenação e as séries são só ids. A ação nova é a auditoria `material.atualizado`, que guarda `entidadeId`, as séries de antes e de depois e o booleano `tituloAlterado`. O título nunca entra nela: o `strictObject` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/auditoria/acoes.ts:648` recusa o campo, e `acoes.test.ts:144` testa a recusa com um título que leva nome de pessoa. O teto do `PATCH` conta as linhas dessa mesma auditoria, então não nasce nenhum contador ou tabela nova.

Fora da tabela de dados do docs/lgpd.md: nada. `material.atualizado` entrou na linha "Material da escola" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/docs/lgpd.md:101`, com o que a ação guarda e com a menção "nunca o título". Os capítulos (`capitulo_do_material`) e o rótulo da edição já estavam na tabela desde as tarefas 4.0 e 8.0.

Autorização por objeto: ok.
- **Material da escola B pela escola A:** `travarParaAtualizar` filtra por `requireEscolaId()`, pelo id e por `excluidoEm` nulo (`material.repository.ts:117-124`). `renomear` e `substituirSeries` repetem o filtro de escola.
- **Séries da escola B:** `seriesDaEscola` responde `NAO_ENCONTRADO` igual à série que não existe, e a auditoria não leva o id da B.
- **Ordem das respostas:** `NAO_ENCONTRADO` vem antes de `EDICAO_EM_ANDAMENTO` (`material.service.ts:213-215`), então quem não alcança o material não descobre que ele tem uma edição em andamento.
- **Professor:** a guarda global de `material.enviar` responde `NAO_ENCONTRADO` antes do teto. A foto `mesa12-professora-computador.png` mostra "Página não encontrada".
- **Teto antes de tudo:** o 429 sai também para material que não existe, o que não confirma se o id existe.
- **Testes:** `material-patch.int.test.ts:224-301` cobre os casos acima, e as mutações que tiram a cláusula de escopo quebram esses testes.

Logs: limpos.
- `material.service.ts:225` loga só `{ evento, materialId }`.
- `material.service.ts:181` loga só o `tipo` do teto.
- `material-patch.int.test.ts:541` confere com uma sentinela que o título e a série não chegam ao log.

Auditoria: presente. `material.atualizado` é gravado na mesma transação da alteração, com autor tirado do contexto. A regra 20, item 10 não exige auditoria de leitura aqui: o leitor é a coordenação, mas o dado é material didático, não dado de aluno.

Envio externo: nenhum. A tarefa não chama provedor de IA.

Seed/fixture: sintético. Os helpers novos de `e2e/support/material.ts` só gravam títulos de apostila, capítulos e séries. As fotos mostram "Colégio sintético da vitrine", "Coordenadora sintética" e "Professora Sintética Helena".

DTO: explícito. A resposta do `PATCH` passa por `paraResposta(lido, 'unidade')`, que valida no `materialResponseSchema`. Os capítulos chegam por `materialComCapitulosResponseSchema`, só com ordem, número, título e páginas. Nas fotos de computador que abri, o painel não mostra quem enviou nem o hash do arquivo, só título, situação, capítulos, disciplina, titularidade, licença, páginas e o formulário.

Pergunta de fechamento: o sistema responde. O `PATCH` não cria dado de aluno. O autor da alteração fica na auditoria com id, e o fim dessa autoria na eliminação do coordenador já está descrito na linha da tabela. Nada vai para fora do sistema.

Bloqueantes: nenhum.

Recomendações:
- **Título não aparece na linha da tabela:** a linha "Material da escola" de `docs/lgpd.md:101` ainda não cita o `titulo` como texto livre da coordenação. Agora que ele é editável, valeria uma frase dizendo que ele pode conter nome, como já está escrito para o título do capítulo, e que a troca não guarda o título anterior. Não guardar o anterior é bom para a minimização e convém deixar registrado.
- **Teste no `contracts.test.ts`:** acrescentar o `PATCH /v1/materiais/:id` à checagem de que nenhuma resposta traz `enviadoPor` nem `sha256`. Hoje isso está garantido pelo schema, mas não por um teste de contrato desta rota.

Li só 5 das 20 fotos, as de computador: com capítulos, edição em leitura, diálogo da edição nova, lista e professora. Não abri as de celular, as de "sem capítulo" nem as da escola vazia.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-14 04:17:25 · `tasks/prd-ingestao-do-material/12_task.md`

```
VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido
Bloqueantes: nenhum
Recomendações:
```

**Escopo e aderência.** As seis subtarefas foram feitas: `PATCH` com a linha travada, `NAO_ENCONTRADO` antes de `EDICAO_EM_ANDAMENTO`, teto próprio, painel, textos, `docs/interface.md` e testes. A habilidade por capítulo (F4b) não aparece. As sete divergências do `12_task.md` estão na linha "12.0" do §11 da `techspec.md`. As da tela e a da permissão também estão no `cenarios.md`: a linha do painel em "Telas" e a linha 199 em "Isolamento".

**Fotos.** As fotos mostram o que o RF4, o RF6 e o RF10 pedem, com o vocabulário da tela:
- capítulos com número e páginas;
- o aviso "O PDF não tem capítulos…";
- o formulário "Corrigir título e séries";
- "Enviar edição nova" só no material pronto, e ausente no que tem edição em leitura;
- o diálogo dizendo que a anterior sai da busca quando a nova ficar pronta.

Nada além do pedido aparece.

**Recomendações:**

1. **O teto do `PATCH` só conta alteração que deu certo.** Fica em `apps/api/src/material/material.service.ts:378` e é contado pela auditoria `material.atualizado`. Um laço de pedidos recusados (`EDICAO_EM_ANDAMENTO`, `NAO_ENCONTRADO`, `ENTRADA_INVALIDA`) não gasta esse teto, e só o limitador global por pessoa o segura. Cada pedido desses ainda abre uma transação com `for update`. A escolha está declarada na Tech Spec. Vale deixar isso dito na própria linha "12.0" ou no `TODO.md`, para o `infra-guardian` e a retro.
2. **Série conferida fora da transação.** Está em `material.service.ts:453`. Se uma série sair entre essa conferência e o `insert` em `substituirSeries`, o erro vem da FK, e não `NAO_ENCONTRADO`. A janela é pequena. Mover a conferência para dentro da transação, depois do `travarParaAtualizar`, fecha esse caso.
3. **Arquivo com nome que já não descreve o conteúdo.** O `MaterialAtualizarGuard` ficou em `apps/api/src/material/material-upload.ts:61`, mas não tem nada de upload. Um arquivo próprio para os tetos, ou um nome mais amplo, ajuda quem procurar o guarda do `PATCH`.
4. **O formulário não acompanha mudança feita por outra pessoa.** O rascunho de `CorrecaoDoMaterial` (`apps/web/src/areas/coordenacao/material/PainelDoMaterial.tsx:115`) nasce uma vez do material. Se outra pessoa da coordenação corrigir o mesmo material com o painel aberto, a lista relida traz as séries novas, mas o formulário segue com as antigas. Aí "Salvar alterações" liga sozinho e pode desfazer a correção da outra pessoa. É raro e a API não erra, mas vale ao menos registrar.
5. **Fotos do celular que não mostram o painel.** `mesa12-capitulos-celular-2.png` e `mesa12-emleitura-celular-2.png` mostram a lista, não o painel rolado. Com isso, o aviso "Espere a edição em processamento terminar." não aparece em nenhuma foto. Isso é da vitrine e do `frontend-reviewer`; fica registrado.

## test-engineer · 1ª rodada · APROVADO · 2026-11-14 04:18:13 · `tasks/prd-ingestao-do-material/12_task.md`

VEREDITO: APROVADO

**Cenários exigidos** (a tabela "Testes que provam a regra" da 12.0, mais o que este papel exige):
- **Caminho feliz:** `PATCH` de título e séries, só do título e só das séries.
- **Casos de borda:** escola sem ano letivo; material excluído e material substituído; envio inicial ainda `processando`; edição que falhou; a sequência edição B sobre A; séries repetidas, `[]`, pedido vazio e campo fora do contrato.
- **Permissão:** professor (e aluno).
- **Isolamento:** séries da B; material da B `pronto`, com edição em andamento e a própria edição da B, sempre `NAO_ENCONTRADO` antes de `EDICAO_EM_ANDAMENTO`; o repository chamado no contexto da A.
- **Carga e concorrência:** 101º `PATCH` da pessoa e 301º da escola; dois `PATCH` em paralelo; edição parada depois do `guardarBytes`; edição com a transação aberta; clique duplo em salvar e em enviar a edição.
- **Tela (U):** capítulos e "sem capítulo"; os textos dos quatro erros.
- **e2e:** recomeço do painel; professor; editar séries e enviar a edição nova; cabe em 1366 × 768.

**Cobertos:** todas as linhas da tabela têm teste que eu localizei pelo nome.
- **Integração, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/material-patch.int.test.ts`:**
  - "título e séries: a resposta traz…": cobre a lista e a busca da série tirada e da série nova, e a auditoria sem o título.
  - O `it.each` de "o pedido inválido".
  - "`serieIds` da escola B…".
  - O `it.each` "%s: `NAO_ENCONTRADO` igual ao inexistente, antes de `EDICAO_EM_ANDAMENTO` (R6)", nos casos pronto, edição em andamento e a própria edição.
  - "o repository, no contexto da escola A…".
  - "o material excluído e o substituído".
  - "o material com edição `processando` e a própria edição…".
  - "a sequência…".
  - Os três casos [P]. Os dois que pedem corrida soltam as duas chamadas ao mesmo tempo, com `WriteBlockTrigger` e `esperarNaTrava`. O terceiro segura o `guardarBytes` real e confirma o `PATCH` nesse meio.
  - "permissão" (professor e aluno).
  - "escola sem ano letivo".
  - "a pessoa no teto recebe 429…": cobre o `Retry-After`, a outra pessoa da escola e o envio que segue livre.
  - "a escola no teto segura…".
  - "o 429 é antes de tudo…".
- **Unidade:**
  - Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/material/PainelDoMaterial.test.tsx`: os capítulos, "o PDF sem capítulo…", "o clique duplo em 'Salvar alterações'…", os três erros do envio da edição e os erros do `PATCH`.
  - Em `material-painel.test.ts`: "os quatro erros do que a tela envia…" e "o limite sem `Retry-After`…".
  - O contrato em `packages/shared/src/material/material.test.ts`.
  - A ação de auditoria em `acoes.test.ts`.
- **e2e, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/e2e/material-painel.spec.ts`:** os capítulos com `paginaNaoRola` a 1366 × 768, corrigir título e séries, editar e enviar a edição nova, a edição em leitura, o recomeço e o professor.
- **Mutações:** o `--faltando` lista 8 linhas. Conferi as 8 contra o motivo escrito no documento, e todas são guardas de tipo, classe de cor ou código só movido. As 84 cláusulas novas restantes têm bloco, e os testes citados chegam à cláusula.
- **Rodadas:** os testes de unidade (52 casos) e o de integração (29 casos) passaram aqui. Não há `.skip`, `.only` nem teste comentado. O único mock é o `spyOn` do armazém, que envolve o `guardarBytes` real só para pausá-lo. Não há IA na tarefa.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **Bloco a mais para o terceiro [P].** A linha "[P] edição com a transação aberta; `PATCH` em A" pede a mutação "tirar o `for update` do `PATCH`". O único bloco dessa mutação cita só "dois PATCH do mesmo material" (`material-patch.int.test.ts:367`). Pelo meu raciocínio o caso da l.432 também fica vermelho sem a trava (o `esperarNaTrava` não acha a espera e a resposta deixa de ser 409), mas o portão não provou isso. Um segundo bloco com a mesma mutação, citando o caso da l.432, fecha a linha da tabela.
2. **Busca pela turma.** O `cenarios.md` fala em "busca de uma turma da série tirada", e o teste usa `/v1/materiais/busca?serieId=` da coordenação. É o mesmo `MaterialRepository.buscar` com o filtro de série que o `TrechoSearch` usa, então a regra está provada. Mesmo assim, um caso pelo caminho do professor ou Tutor de uma turma daquela série deixaria a linha literal.
3. **Asserção vazia no e2e.** Em `e2e/material-painel.spec.ts:271`, `painelB.locator(':focus')).not.toContainText(...)` passa quando nada no painel tem foco. Quem prova o recomeço é o `toHaveCount(0)` da l.270. Melhor afirmar onde o foco está, ou tirar a linha.
4. **Nome de caso.** Em `PainelDoMaterial.test.tsx:168`, o nome diz "e o que falhou não tem a seção", mas o corpo só testa o `processando`. A parte do `falhou` está no caso da l.177. Vale corrigir o nome.
5. **Série apagada no meio do `PATCH`.** As séries são conferidas fora da transação (`material.service.ts`, `seriesDaEscola` antes do `banco.transaction`). Se uma série for apagada entre a conferência e o `insert`, a FK recusa e a resposta é 500, não `NAO_ENCONTRADO`. É raro e não está nos cenários. Fica para a validação decidir se pede a conferência dentro da transação ou o mapeamento do erro de FK.
6. **"Sem gastar o teto de envios".** O caso do teto prova que quem está no teto do `PATCH` ainda envia, e que quem está no teto de envios ainda altera. Não prova que um `PATCH` deixa de contar como envio: com só 1 a 3 `PATCH` reais, o teste não chegaria perto de 100 envios. Hoje os dois contadores são separados por construção, então fica só como registro.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-14 04:39:33 · `tasks/prd-ingestao-do-material/12_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma nova nesta rodada. O diff da rodada 1 para a 2 não altera nenhuma migration nem nenhum schema. `material` e `material_serie` já foram verificadas na 1ª rodada e não mudaram.

Queries verificadas:
- `TrechoSearch.buscar`, que o teste novo `idsDaPortaDeLeitura` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/material-patch.int.test.ts:77-82`) passou a usar. O teste a chama dentro de `runInContext` com a `escolaId` da coordenação, e a busca delega a `MaterialRepository.buscar`, que pega a escola do contexto. Nenhuma escola é passada por parâmetro.
- Os blocos de mutação novos em `12_task.md` (`for update` em `travarParaAtualizar`, `delete` de `substituirSeries`) só documentam cláusulas que já existiam e continuam com `requireEscolaId()`.
- Nada mudou em `apps/api/src` nem em `packages/` desde a rodada aprovada.

Teste de isolamento: presente e efetivo. O caso entre escolas A e B (`material-patch.int.test.ts`, a partir da linha 284) não mudou. As asserções novas do caso "título e séries" fazem uma segunda checagem, dentro da mesma escola: depois do PATCH, a série tirada deixa de achar o material pela porta do Assistente e do Tutor, e a série nova passa a achá-lo. Se o `delete` de `substituirSeries` sair, essas asserções quebram.

Bloqueantes: nenhum.

Recomendações:
- Os itens da 1ª rodada que foram para o `TODO.md` seguem em aberto. O principal é `seriesDaEscola` rodar fora da transação: uma série excluída entre a conferência e o `insert` dá erro de FK em vez de `NAO_ENCONTRADO`. Isso não vaza dado e não bloqueia.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-14 04:39:44 · `tasks/prd-ingestao-do-material/12_task.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum (o diff da rodada 2 muda testes, a posição de um aviso na tela, `docs/lgpd.md` e a tarefa; nada mudou em `apps/api/src` nem em `packages/`)
Rate limit: ok (sem mudança desde a 1ª rodada)
Fila e prioridade: ok (sem mudança)
Concorrência: protegida. O novo bloco de mutação sobre o `.for('update')` do caso "a edição com a transação aberta sobre A" amarra a trava ao teste de concorrência.
Índice e paginação: ok (sem mudança)
Degradação de IA: não se aplica. O `idsDaPortaDeLeitura` chama `TrechoSearch.buscar`, que busca no banco dentro do contexto da escola. Não chama provedor, nem pago nem local.
Migration: não se aplica
Métrica e alerta: ok (sem mudança)
Bloqueantes: nenhum. A 1ª rodada não exigiu correção.
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/e2e/material-painel.spec.ts:270`: com a asserção `:focus` retirada, o e2e não confere mais que o foco do pedido de A fica fora do painel de B. Se essa garantia importa, ela precisa de um caso de unidade em `PainelDoMaterial.test.tsx`. Se o teste de unidade já cobre, basta registrar na tarefa onde está a cobertura.
- As recomendações da 1ª rodada que ficaram sem aplicar, com destino `TODO.md` ou retro, seguem como estão na tabela de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/12_task.md`. Destaco duas: o `Retry-After` calculado pelo registro mais antigo, e o teto do `PATCH`, que só conta alteração gravada com sucesso.

## frontend-reviewer · 2ª rodada · APROVADO · 2026-11-14 04:40:05 · `tasks/prd-ingestao-do-material/12_task.md`

VEREDITO: APROVADO
Tela vista: sim (15 fotos lidas, de 7 telas: computador e celular, escola cheia e vazia). Li também o diff da rodada e `PainelDoMaterial.tsx:148-155`. A foto bate com o código da árvore.

Estados: ok. O painel e o resumo têm com dado e vazio (foto `mesa12b-vazia-*`: "Nenhum material ainda", que convida e traz o botão Enviar material). Carregando e erro conferi pelo código e pelos testes, como na rodada 1, e a diferença desta rodada não os toca.

Acessibilidade: ok. O aviso da edição em leitura agora fica dentro do `fieldset`, logo depois da legenda e antes do campo Título (`PainelDoMaterial.tsx:151`). Isso fecha a recomendação 1 da rodada anterior. Em `mesa12b-emleitura-computador.png` e `mesa12b-emleitura-celular-1.png`, "Espere a edição em processamento terminar." aparece logo abaixo de "Corrigir título e séries" e acima de Título, sem rolar. O caso de unidade prova a ordem com `compareDocumentPosition`. O foco visível (quadro azul na região de rolagem) já estava registrado como recomendação do componente `Sheet`.

Chromebook fraco: sem mudança nesta rodada (só texto, ordem de um `<p>`, teste e doc). Nenhuma tela rola a 1366 × 768 (a lista `Rolam` veio vazia).

Celular: ok. Nas fotos de 360 px não há rolagem horizontal nem texto cortado. Os botões "Enviar edição nova", "Excluir material", "Enviar material" e "Cancelar" têm altura de 44 px ou mais. O diálogo de edição nova cabe na largura. A barra de baixo que aparece no meio de `mesa12b-lista-celular-1.png` é a navegação fixa captada na costura da captura em pedaços, não é defeito. As fotos `-celular-2` são a mesma imagem e não trazem informação. Nenhum fluxo exige o celular.

Ação oficial protegida: sim. Excluir material e enviar edição nova mostram o material afetado: o diálogo cita "Química 2 — com capítulos" e diz o que acontece com a edição anterior. Nada oficial muda sem revisão. A rota não existe para o professor ("Página não encontrada", `mesa12b-professora-computador.png`).

Bloqueantes: nenhum.

Fora do painel, o diff traz o seguinte:
- **`apps/api/test/material-patch.int.test.ts`:** o teste de integração passa a provar que a troca de série muda o que o Assistente e o Tutor leem pela porta `TrechoSearch`. A série tirada deixa de achar o material e a nova passa a achar.
- **`docs/lgpd.md`:** a linha do material diz que o `titulo` é texto livre, pode conter um nome, e que a troca não guarda o título anterior.
- **`tasks/prd-ingestao-do-material/12_task.md`:** ganhou três blocos de mutação, a tabela de recomendações sem aplicar e a seção Revisões.
- **Servidor:** nada mudou em `apps/api/src`, nem em `packages/`.

Recomendações (não bloqueiam):
- Foco azul da região de rolagem do `Sheet` aparece como quadro no celular. É do componente existente e já está na tabela de recomendações da tarefa.
- As caixas de série medem 24 px, o mínimo. Convém conferir em `PartesDoEnvioDeMaterial.tsx` se a linha inteira do rótulo é clicável, para alvo de toque maior. Já está registrado para o `TODO.md`.
- Carregando e erro do `PATCH` e da edição nova (429, 503) não aparecem na vitrine. Continuam cobertos só por teste de unidade.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-14 04:40:37 · `tasks/prd-ingestao-do-material/12_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo nesta rodada. Nada mudou em `apps/api/src`, `packages/` nem no servidor. Só a linha "Material da escola" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/docs/lgpd.md` foi alterada, e o texto novo cobre o `titulo`: é texto livre e pode conter um nome, segue a classificação e a retenção do capítulo, e a troca não guarda o título anterior (`material.atualizado` registra só as séries e o `tituloAlterado`). Isso cumpre a recomendação 1 da rodada anterior.

Fora da tabela de dados do docs/lgpd.md: nenhum.

Autorização por objeto: ok, sem mudança nesta rodada. A foto `mesa12b-professora-computador.png` mostra que a professora que abre `/coordenacao/material?material=<id>` recebe "Página não encontrada" e não vê nada do material.

Logs: limpos. O diff não acrescenta nenhum log.

Auditoria: presente, sem mudança desde a 1ª rodada.

Envio externo: nenhum novo. O `idsDaPortaDeLeitura` de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/material-patch.int.test.ts` chama `TrechoSearch.buscar` dentro do contexto da escola, sem chamar provedor. As duas asserções novas mostram que, quando a série é tirada do material, a porta de leitura do Assistente e do Tutor deixa de achá-lo, e que a série nova passa a achá-lo. Com isso, a correção de séries não deixa material visível para série sem direito.

Seed/fixture: sintético. O texto da busca é "reagente limitante". As fotos mostram "Colégio sintético da vitrine cheia 01c9452d", "Coordenadora sintética 72176067", "Professora Sintética Helena 5a7a25f4" e títulos como "Química 2 — com capítulos".

Fotos da tela, conferidas pela regra 20:
- Nas fotos de computador e celular com o painel aberto (`mesa12b-capitulos-*`, `mesa12b-semcapitulo-*`, `mesa12b-emleitura-*`, `mesa12b-edicaonova-*`), o painel mostra só o estado, os capítulos, a disciplina, de quem é o material, a licença, as páginas, o título e as séries. Não aparece quem enviou, `sha256` nem dado de aluno.
- Na lista e no resumo (`mesa12b-lista-*`, `mesa12b-vazia-*`), os números são só agregados por disciplina e série.
- O aviso "Espere a edição em processamento terminar." agora aparece logo abaixo da legenda "Corrigir título e séries", em `mesa12b-emleitura-computador.png` e `mesa12b-emleitura-celular-1.png`. Não leva dado de pessoa.

Bloqueantes: nenhum.

Recomendações:
- Continua aberta a recomendação 2 da 1ª rodada: incluir o `PATCH /v1/materiais/:id` em `apps/api/test/contracts.test.ts`. Ela já está registrada em "Recomendações sem aplicar" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/12_task.md`, com destino `TODO.md`. O destino está correto e não há nada mais a fazer nesta tarefa.

## test-engineer · 2ª rodada · APROVADO · 2026-11-14 04:40:43 · `tasks/prd-ingestao-do-material/12_task.md`

VEREDITO: APROVADO

Cenários exigidos (os mesmos da 1ª rodada, aprovada) e, nesta rodada, as cinco mudanças do diff `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/.processo/ordens/12_task-diff-r1-r2.patch`:
- Trocar título e séries também muda o que o Assistente e o Tutor acham, porque os dois leem pela mesma porta (`TrechoSearch`).
- O aviso de edição em leitura aparece antes dos campos desligados.
- Há bloco de mutação para o `for update` do caso da transação aberta, para o `delete` de `substituirSeries` e para o aviso movido.
- Saiu a asserção `:focus` vazia do e2e.
- A linha "Material da escola" do `docs/lgpd.md` foi revista.

Cobertos:
- **Porta do Assistente e do Tutor** (`apps/api/test/material-patch.int.test.ts:76-82`, `:125`, `:138-140`). Antes do PATCH, o teste confirma que a busca acha o material (`toEqual([id])`). Isso prova que o texto da busca casa com o PDF, então o resultado vazio depois do PATCH não passa por acaso. Conferi que `TrechoSearch` é mesmo a porta usada por `assistente.service.ts`, `tutor.repository.ts`, `tutor.service.ts` e `ferramentas.service.ts`.
- **Bloco do `delete` de `substituirSeries`**: sem o `delete`, a série antiga continua gravada. Aí `idsDaLista` e `idsDaBusca` (e agora `idsDaPortaDeLeitura`) para `escola.serieId` deixam de dar `[]`, e o teste fica vermelho pelo motivo certo.
- **Bloco do `for update` com `isNull(excluidoEm)`** (caso `:445`): a linha de contexto separa este bloco do outro `for update` (o do "dois PATCH"). Sem a trava, o teste fica vermelho de dois jeitos, e os dois são o motivo certo:
  - o `esperarNaTrava` não acha a consulta com `for update` presa na espera;
  - ou o PATCH atravessa a linha antes de a edição confirmar, e então as asserções de 409 `EDICAO_EM_ANDAMENTO` e `seriesDe == [escola.serieId]` falham.
- **Bloco do aviso movido**: o `compareDocumentPosition(... Título) & DOCUMENT_POSITION_FOLLOWING` (`PainelDoMaterial.test.tsx:254-257`) falha se o `<p>` volta para depois do campo Título. O bloco antigo, que remove o aviso, continua valendo.
- **Fotos**: `mesa12b-emleitura-celular-1.png` mostra o aviso "Espere a edição em processamento terminar." logo abaixo da legenda e antes do campo Título.
- **Testes rodados**:
  - `npx vitest run apps/web/src/areas/coordenacao/material/PainelDoMaterial.test.tsx`: 24/24 verdes.
  - `npx vitest run apps/api/test/material-patch.int.test.ts`: 29/29 verdes.
- **Nada a apontar**: não há `.skip`, teste comentado nem provedor pago (a busca é por texto no banco, sem modelo). Nada mudou em `apps/api/src` nem em `packages/`, então a auditoria de servidor da 1ª rodada continua valendo.

Bloqueantes: nenhum.

Recomendações:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/e2e/material-painel.spec.ts:266`: o comentário "O aviso e o foco do pedido de A não aparecem no painel de B" ainda fala do foco, mas a asserção sobre o foco saiu. Agora só o aviso é conferido. O comentário deve dizer só "o aviso", ou o caso deve ganhar uma asserção de foco que realmente pegue o erro (por exemplo, `expect(page.locator(':focus')).not.toHaveText(TEXTO_SALVO)` depois de esperar o painel B).
2. O caso "título e séries" (`material-patch.int.test.ts`) já junta lista, busca, porta de leitura, auditoria e título. Separar a parte da porta de leitura num caso com nome próprio ("a série tirada deixa de chegar ao Assistente e ao Tutor") ajuda a citá-lo pelo nome na tabela de testes e nos blocos de mutação. Não bloqueia.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-14 04:40:52 · `tasks/prd-ingestao-do-material/12_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. Esta rodada só mexe na ingestão do material (painel, um teste de integração, `docs/lgpd.md`, a tarefa). Nada escreve em `Nota`, então não há o que conferir quanto a autor humano.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. A rodada não traz saída de IA nova que chegue ao aluno. O `PATCH` só muda o título e as séries do material, por ação da coordenação, e fica registrado na auditoria como `material.atualizado`.
Supervisão do tutor: ok. A rodada não mexe no Tutor. A asserção nova de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/material-patch.int.test.ts` (`idsDaPortaDeLeitura`) prova que a porta de leitura do Assistente e do Tutor respeita as séries corrigidas: a série tirada deixa de achar o material e a nova passa a achar. Era a minha recomendação 2 da 1ª rodada, e foi aplicada.
Autonomia declarada e visível: sim. A rodada não toca nesse ponto e o que foi aprovado na 1ª rodada continua igual.
Bloqueantes: nenhum

O que conferi nesta rodada:
- **O diff de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/.processo/ordens/12_task-diff-r1-r2.patch`.** Ele não muda nada em `apps/api/src` nem em `packages/`. `PainelDoMaterial.tsx:151` agora põe o aviso "Espere a edição em processamento terminar." logo depois da legenda (linha 150), antes do campo Título. O teste `PainelDoMaterial.test.tsx` prova essa ordem com `compareDocumentPosition`, e há um bloco de mutação para ela na `12_task.md`.
- **A linha nova de `docs/lgpd.md`.** Ela reforça a minimização: a troca de título não guarda o título anterior, e a auditoria leva só o fato `tituloAlterado`. Não muda nada no que a regra 70 exige.
- **A asserção `:focus` removida de `e2e/material-painel.spec.ts`.** Não toca a regra 70.
- **As fotos.** Em `mesa12b-emleitura-computador.png` e `mesa12b-emleitura-celular-1.png` o aviso aparece abaixo de "Corrigir título e séries" e antes do Título; no celular dá para lê-lo sem rolar. Também olhei `mesa12b-capitulos-computador.png`, `mesa12b-edicaonova-computador.png`, `mesa12b-edicaonova-celular-1.png`, `mesa12b-vazia-celular.png` e `mesa12b-professora-computador.png` (que mostra "Página não encontrada"). Nenhuma traz nota, conceito ou sugestão de nota, nada induz uso e nada esconde a saída. O texto da tela vazia descreve o Assistente e o Tutor como quem tira do PDF "citando a página", sem se passar por pessoa.
- **`docs/regulacao.md`.** Não precisava mudar nesta rodada e não mudou.

Recomendações: nenhuma nova. As da 1ª rodada estão resolvidas: a 1 foi conferida pela Mesa e o aviso agora aparece nas fotos `emleitura`; a 2 foi aplicada no teste de integração.

## revisor-geral · 2ª rodada · REPROVADO · 2026-11-14 04:41:05 · `tasks/prd-ingestao-do-material/12_task.md`

VEREDITO: REPROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. O diff desta rodada só mexe em teste, documento e uma linha de tela. A recusa do `Retry-After` se apoia na linha "12.0" da tabela de divergências em `techspec.md:207`.

Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")

Bloqueantes:
- `tasks/prd-ingestao-do-material/12_task.md:170-182`, tabela "Recomendações sem aplicar". Sete recomendações dizem ter ido para o `TODO.md`, mas nenhuma está lá. O `TODO.md` não foi alterado (ele não aparece no `git status`) e não existe a seção "Da ingestao-do-material, tarefa 12.0, fora dela". As tarefas 10.0 e 11.0 gravaram a seção delas no mesmo commit (`TODO.md:3550` e `:3570`), e o `11_task.md:797` registra onde as linhas estão. Do jeito que está, o documento diz que essas recomendações têm destino quando não têm, e elas se perdem no commit. Uma delas é risco real: o rascunho de `CorrecaoDoMaterial` pode desfazer a correção de outra pessoa.
  - As sete são: o `Retry-After` calculado pelo registro mais antigo; o teto do `PATCH` que conta só a alteração que deu certo; o `seriesDaEscola` fora da transação, que dá erro de FK em vez de `NAO_ENCONTRADO`; o alvo de 24 px em `CampoDeSeries`; o caso do `PATCH` no `contracts.test.ts`; renomear ou mover `MaterialAtualizarGuard`; o rascunho do painel que nasce uma vez só.
  - Correção exigida: criar no `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/TODO.md` a seção "Da ingestao-do-material, tarefa 12.0, fora dela", com uma linha por item, no formato das seções 10.0 e 11.0 (tarefa, revisor, rodada, `arquivo:linha` e o que fazer).
  - Correção exigida: no `12_task.md`, acima da tabela, apontar essa seção, como faz o `11_task.md:797`.

Os outros destinos se sustentam:
- O comentário "Quem chama já travou a linha" está de fato em `material.repository.ts:331` e `:339`.
- As linhas que vão para a retro (contagem do teto sem trava, foco do `Sheet`) e as "sem ação" têm motivo escrito e não pedem arquivo.
- O item das fotos foi atendido. Em `mesa12b-emleitura-computador.png` e `mesa12b-emleitura-celular-1.png`, "Espere a edição em processamento terminar." aparece logo abaixo da legenda "Corrigir título e séries" e antes do campo Título, como `PainelDoMaterial.tsx:151` produz.

As outras mudanças do diff estão certas:
- A troca do aviso de lugar tem bloco de mutação, e o teste com `compareDocumentPosition` a pega.
- O `idsDaPortaDeLeitura` prova que a troca de série passa pelo `TrechoSearch`.
- Tirar o `delete` de `substituirSeries` derruba o caso "título e séries": a série antiga continuaria achando o material.
- A linha do `docs/lgpd.md` sobre o `titulo` está de acordo com a auditoria, que guarda só `tituloAlterado`.

Recomendações:
- `apps/api/test/material-patch.int.test.ts`: `idsDaPortaDeLeitura` busca com o texto fixo `'reagente limitante'`. Se o PDF da fixture mudar, a asserção de `[]` passa à toa. Vale conferir também `.not.toEqual([])` antes do PATCH; hoje a asserção `toEqual([id])` da linha 125 do diff já cobre isso, então fica só como cuidado.

## revisor-geral · 3ª rodada · APROVADO · 2026-11-14 04:57:49 · `tasks/prd-ingestao-do-material/12_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum

As duas correções da rodada 2 estão feitas. O código não mudou desde a rodada 2, então só conferi o diff, que mexe em dois arquivos.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/TODO.md:3593` tem agora a seção "Da ingestao-do-material, tarefa 12.0, fora dela". São oito linhas: as sete recomendações da rodada 1 e o comentário do e2e da rodada 2. Cada linha traz a tarefa, o revisor, `arquivo:linha` e o que fazer, no formato das seções da 10.0 e da 11.0. A linha do rascunho de `CorrecaoDoMaterial`, que pode desfazer a correção de outra pessoa, diz "Risco real, raro" e manda o conserto para a retro da F4.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/12_task.md:724` e `:743` apontam essa seção acima de cada tabela, como faz o `11_task.md:797`.

Recomendações:
- **"3ª" e "4ª" no lugar da rodada.** Em `TODO.md`, nas linhas de `MaterialAtualizarGuard` e do rascunho de `CorrecaoDoMaterial`, "revisor-geral, 3ª" e "revisor-geral, 4ª" são o número da recomendação na lista do revisor, e não a rodada. As duas vieram da 1ª rodada. O mesmo vale para `12_task.md:731`, `:739` e `:740`, onde aparecem "revisor-geral (2ª)", "test-engineer (5ª)", "(3ª)" e "(4ª)". Não bloqueia, por três motivos:
  - Cada linha já traz `arquivo:linha` e a ação, então dá para seguir o que fazer mesmo com o número errado.
  - A seção da 11.0 usa o mesmo número ambíguo ("test-engineer 3ª e 4ª", `TODO.md:3589`), então não é um costume novo desta tarefa.
  - O erro está no rótulo e não muda o que precisa ser feito.

  Trocar por "1ª" quando alguém mexer nessas linhas. Na retro, vale fixar no protocolo da Mesa se a coluna guarda a rodada ou o número da recomendação.
- **Número de linha diferente nos dois arquivos.** `12_task.md:747` cita `e2e/material-painel.spec.ts:266`, mas o comentário está na `:269`. O `TODO.md` já traz a `:269`, que é a certa. Alinhar o `12_task.md`.
