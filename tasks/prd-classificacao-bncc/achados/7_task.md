# Achados das revisões — `tasks/prd-classificacao-bncc/7_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-18 11:49:33 · `tasks/prd-classificacao-bncc/7_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: um só, `secao_do_material.corrigida_por`, o id do coordenador que corrigiu a seção. Ele é gravado em `gravarCorrecao` (`apps/api/src/material/secoes.repository.ts`) e não sai em nenhuma resposta. O resto da tarefa é material didático (seções, páginas, título do capítulo, classificado como `SEM_PESSOA`), códigos de uma tabela pública da BNCC, contagens e o número do chamado. A tarefa não lê nem grava nada de aluno.

Fora da tabela de dados do docs/lgpd.md: nada. `corrigida_por` já estava na linha "Material da escola", com finalidade e retenção, e com a regra de que vira nulo na eliminação sem desfazer a correção. A tarefa acrescentou ali as três ações novas de auditoria (`material.classificacao_corrigida`, `material.reclassificado`, `escola.reclassificada`) e o que cada uma guarda. O arquivo do titular já traz a seção pela ligação `corrigida_por` (`packages/core/src/titular/leitura-do-titular.ts:429-433`).

Autorização por objeto: ok.
- `PUT …/secoes/:secaoId/habilidades`: primeiro acha o material no alcance `unidade` (`MaterialRepository.porId`), depois trava a seção com material, escola e id juntos (`travarParaCorrigir`). Se o `secaoId` for de outro material, da escola B, de material excluído ou inexistente, a resposta é a mesma, `NAO_ENCONTRADO`.
- `POST …/reclassificar`: mesmo caminho pelo `porId('unidade')`.
- `GET /v1/habilidades-bncc`: o material é lido no alcance `ler` (o professor só alcança disciplina em que tem vínculo). O artefato só é achado se a pessoa da sessão o criou, tem vínculo confirmado e está no ano em curso (`recorteDoArtefato`).
- Professor e aluno no `PUT` e no reclassificar recebem 404, não 403. A rede recebe `nunca` nas três ações (`matriz.ts`, provado por `matriz.test.ts` e `matriz.expectativa.ts`).
- Fiz o teste de trocar o id na URL em cada rota: cada caso tem teste de integração com a escola B lida no contexto da A.

DTO de saída: explícito e estrito. `secaoDoMaterialResponseSchema` não tem `corrigidaPor`, `corrigidaEm`, `execucaoId`, `falhasSeguidas` nem `classificadaEm`. O `contracts.test.ts` confere a lista exata de campos e recusa esses cinco. Na seção, a resposta mostra só que houve correção (`corrigida`, verdadeiro ou falso), nunca quem corrigiu.

Logs: limpos. `material.service.ts` registra só `{ evento, materialId, secaoId }` e `{ evento, materialId }`; o aviso de teto registra só `{ evento }`. O comando `ops:reclassificar-escola` imprime só contagens e o chamado, e a recusa de argumento repete o nome da opção, nunca o valor (há teste com `'Apostila da Ana'` e `'Nome Com Espaço'`).

Auditoria: presente em tudo que tem autor. A regra 20 não exige auditoria aqui, porque não há leitura de dado de aluno.
- `material.classificacao_corrigida` guarda a seção e os códigos de antes e de depois. Os códigos vêm da lista fechada `z.enum(CODIGOS_DA_BNCC)`, com no máximo 5, então texto livre não entra.
- `material.reclassificado` guarda só contagens.
- `escola.reclassificada` guarda o chamado (número inteiro) e contagens, com o operador como autor.
- O `acoes.test.ts` prova que título, texto e código inventado são recusados.

Envio externo: nenhum novo. O reclassificar só cria execuções e jobs na fila `lote`. A chamada ao modelo continua a da classificação das tarefas 4.0 a 6.0, com texto de material e não de pessoa, registrada em `ExecucaoAgente`.

Seed/fixture: sintético. Os testes usam "Apostila sigilosa", ids aleatórios, `teste-integracao` e UUIDs fixos de mentira.

Bloqueantes: nenhum.

Pergunta de fechamento: o que esta tarefa acrescenta sobre uma pessoa é só sobre o coordenador. A seção corrigida entra no arquivo dele pela ligação `corrigida_por`, e a auditoria guarda o id dele como autor. Nada desta tarefa sai do sistema, então a lista de para onde o dado foi não muda. O código responde.

Recomendações (nenhuma bloqueia):
1. `apps/api/src/material/material.service.ts`, `corrigirSecao`: o `habilidadesDaAuditoriaSchema.parse(antes)` dá erro interno se a seção tiver hoje um código fora de `CODIGOS_DA_BNCC`, e a correção fica impossível. Hoje isso está protegido pelo teste que confere a lista contra `dados-2026.08.json`. Vale lembrar dele quando a tabela da BNCC for atualizada.
2. `recorteDoArtefato` (`apps/api/src/material/secoes.repository.ts`): para o coordenador, `artefatoId` sempre dá `NAO_ENCONTRADO`, porque o filtro exige que ele tenha criado o artefato. Isso é mais restrito que a célula `unidade` da matriz e não vaza nada, mas vale deixar escrito no docblock da matriz para a 8.0 não estranhar.
3. Faltam o teste com duas turmas de séries diferentes e o do operador inativo no comando. A própria tarefa já os lista como recomendação; reforço que ficam registrados.

Arquivos auditados principais:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/material.service.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/secoes.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/ops/reclassificar-escola.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/shared/src/material/material.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/auditoria/acoes.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/docs/lgpd.md`

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-18 11:49:53 · `tasks/prd-classificacao-bncc/7_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A tarefa não grava, não lê e não deriva `Nota`. No diff e nos arquivos novos não aparece nota, `lancadaPor`, aprovação ou reprovação de aluno, nem conceito. Todos com autor humano? Não se aplica, porque não há caminho novo.

Decisão autônoma sobre aluno: ausente. A classificação pela BNCC é um dado sobre o material, não sobre o aluno. A habilidade só chega a uma questão quando o professor confere e aplica a atividade, como diz o `esperaAprovacao` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/shared/src/time/funcoes.ts:65`.

Aprovação registrada: ok.
- A função é de autonomia 1 e nada dela chega ao aluno, então o item 3 da regra 70 não exige aprovação peça por peça. A exceção do tutor (D47) não aparece aqui.
- A correção da coordenação é humana: `gravarCorrecao` grava `corrigidaPor: requestSessao().usuarioId` e `corrigidaEm` (`apps/api/src/material/secoes.repository.ts`). A correção é final: o `concluir` trava a seção `for update` com `execucao_id = :esta and corrigida_em is null`, e o reclassificar filtra `isNull(corrigidaEm)`.
- O registro `material.classificacao_corrigida` guarda o autor, a data, a seção e os códigos de antes (os da IA) e de depois. Os testes P1b e P5 provam que o "antes" é o que a IA tinha gravado.
- O comando `ops:reclassificar-escola` grava `escola.reclassificada` com `autorOperador` e o número do chamado, e recusa antes de abrir o banco quando falta o chamado.

Supervisão do tutor: a tarefa não toca o tutor.

Autonomia declarada e visível: sim. `classificacao_do_material` tem autonomia 1, alto risco e textos `fazSozinha` e `esperaAprovacao` em português comum (`packages/shared/src/time/funcoes.ts:59-66`). O `GET /:id` passa a mostrar `classificacaoSuspensa` à coordenação.

Itens 7 a 9 da regra 70:
- **Item 7:** não há inferência emocional nem nada sobre comportamento.
- **Item 8 (D46 e D55):** nenhum campo de nota, porque a classificação é do material e não do texto do aluno.
- **Item 9 (medir o professor):** o teto por pessoa (300 correções e 100 pedidos de reclassificar por hora) é só limite de taxa, sem indicador exposto, e a spec mede correções por escola, nunca por professor. O `recorteDoArtefato` exige `criadoPor` igual a quem está logado, então a coordenação não alcança o artefato do professor.

`docs/regulacao.md`: não precisa mudar com esta tarefa.

Bloqueantes: nenhum.

Recomendações:
1. **Histórico do que a IA gerou (item 6).** Quando a coordenação reclassifica, as habilidades `origem: 'ia'` da classificação anterior são apagadas pela nova sem ficar registradas. A spec já assume isso como decisão (`techspec.md` §8, "Sem histórico do que foi descartado"). Se o dossiê de conformidade (D61) vier a pedir "o que a IA gerou" em toda versão, isso vira decisão nova. Fica registrado para a validação.
2. **Justificativa opcional.** Hoje a correção não tem campo de motivo. Não é exigido, porque a classificação não chega ao aluno, mas um motivo curto escolhido numa lista fechada (sem texto livre) daria à AIA de diagnóstico por habilidade um sinal de contestação mais rico.
3. **Texto na 8.0.** A tela da 8.0 deve mostrar `origem` (IA ou coordenação) com o rótulo de IA (regra 70, item 4a) e explicar em português comum que a correção é final. A API desta tarefa já entrega o que é preciso para isso.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/material.service.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/secoes.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/material/agendamento-da-classificacao.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/ops/reclassificar-escola.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/auditoria/acoes.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/shared/src/material/material.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/shared/src/permissao/matriz.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/classificacao-da-coordenacao.int.test.ts`

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-18 11:50:01 · `tasks/prd-classificacao-bncc/7_task.md`

VEREDITO: APROVADO

Tabelas verificadas: a tarefa não traz migration nem tabela nova. Conferi as tabelas que as consultas novas usam: `secao_do_material`, `habilidade_da_secao`, `execucao_agente`, `capitulo_do_material`, `material`, `material_serie`, `disciplina`, `artefato`, `turma`, `serie`, `vinculo`, `suspensao_de_funcao` e `auditoria`. Todas têm `escola_id`. `artefato`, `turma` e `vinculo` também são filtradas por `ano_letivo_id`. `habilidade_bncc` é tabela pública e só entra em junção pela `habilidade_da_secao`, que tem escola.

Queries verificadas:
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/secoes.repository.ts`: `doMaterial`, `habilidadesDasSecoes`, `travarParaCorrigir`, `codigosDaSecao`, `gravarCorrecao`, `contarCorrigidas`, `recorteDoMaterial`, `recorteDoArtefato` e o `gravarClassificacao` alterado. Todas tiram a escola de `requireEscolaId()` e o autor de `requestSessao()`.
- `travarParaReclassificar` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/material/agendamento-da-classificacao.repository.ts`: a escola também vem do contexto.
- `estaSuspensa` (`SuspensaoRepository`) e o teto de pedidos por pessoa e por escola, contado na auditoria.
- Nenhum endpoint aceita `escolaId` no corpo ou na query. Os pedidos aceitam só os campos listados e recusam o resto: o `PUT` recebe `{ codigos }`, o `GET /v1/habilidades-bncc` recebe `materialId` ou `artefatoId`, e os ids da URL passam pelo `IdPipe` (UUID).
- O comando `ops:reclassificar-escola` recebe `--escola` pela linha de comando. É rotina da equipe (D76), com operador conferido, chamado obrigatório, contexto da escola dada e auditoria `escola.reclassificada`. Não é caminho do cliente e não precisou de `@Unscoped()`.
- Nenhum `@Unscoped()` novo no diff.
- A rede fica em `nunca` nas três ações novas, e `matriz.test.ts` prova isso.

Teste de isolamento: presente e efetivo. Removi mentalmente a cláusula de escola em cada caminho:
- **`PUT` com material ou seção da B:** a escola é conferida em `porId` e em `travarParaCorrigir`. O teste só quebra se as duas saírem. É defesa em profundidade e o motivo está escrito na tarefa.
- **Reclassificar e `GET /v1/habilidades-bncc?materialId=` da B:** sem a escola no `porId`, o recorte lido no contexto da A volta sem componente. A resposta viraria `CONFLITO`, ou 200 com `semComponente`, em vez do 404 esperado, e o teste quebra.
- **Comando reclassificar-escola:** sem a escola em `travarParaReclassificar`, a seção da outra escola ganharia execução, e o teste (linha 718 e a contagem da linha 720) quebra.

Bloqueantes: nenhum.

Recomendações:
- O caso "`artefatoId` da B" (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/classificacao-da-coordenacao.int.test.ts:559` e `:574`) usa um artefato criado pela coordenação da B. Quem barra é o `criadoPor`, não `eq(artefato.escolaId, escolaId)` nem `eq(artefato.anoLetivoId, requireAnoEmCurso())`. Hoje não há vazamento, porque cada escola tem um usuário próprio e o `criadoPor` já fica preso à escola. Mesmo assim o teste ficaria mais forte com a professora de duas escolas (`sessaoDaMesmaConta`): o artefato dela na B, com vínculo confirmado lá, consultado com o token da A.
- Faltam o teste com duas turmas de séries diferentes e o do artefato de outro ano letivo. A própria tarefa já os registrou como recomendação.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-18 11:50:16 · `tasks/prd-classificacao-bncc/7_task.md`

VEREDITO: APROVADO
Caminho quente tocado: fila
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/auditoria/auditoria.repository.ts:98`: os tetos novos (correção 300/900 e reclassificar 100/300) contam na `auditoria` pelo índice `(escola_id, em)` e filtram `acao` depois. Com isso, cada `PUT` lê toda a auditoria da escola na última hora. Hoje é aceitável, porque a rota é da coordenação e o padrão já é o do `PATCH`. Quando a auditoria crescer, um índice parcial ou `(escola_id, acao, em)` resolve.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/material.service.ts`, `#exigirDentroDoTetoDaAuditoria`: o código lê a contagem e grava depois, sem trava. Pedidos simultâneos podem passar alguns acima do teto. Para a proteção contra laço isso basta. Vale escrever no docblock que esse excesso foi aceito.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/ops/reclassificar-escola.ts:91`: o comando chama `agendar` sem `maximoDeExecucoes` e por isso ignora o limite de execuções por noite da rotina, o freio de custo de mil por escola. Uma escola com mais de 12 mil seções passa desse limite numa noite só. Ou o limite entra no comando, ou o runbook avisa disso.
- `GET /v1/materiais/:id` agora devolve `secoes[]` sem paginação. O tamanho tem limite, porque depende do PDF (blocos de 30 páginas). O índice `(escola_id, material_id, pagina_inicial)` cobre a leitura, e por isso não bloqueia. Se o limite de páginas do upload aumentar, a lista precisa ser revista.

Rodei `npx vitest run --project integracao apps/api/test/classificacao-da-coordenacao.int.test.ts` e os 29 casos passaram, inclusive as corridas P1b, P2, P3, P5 e P9 e os quatro casos do comando.

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-18 11:51:12 · `tasks/prd-classificacao-bncc/7_task.md`

```
VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: divergência na lista fechada CODIGOS_DA_BNCC (§3, §4 e §7 da techspec.md), registrada só no 7_task.md
Portão local: carimbo válido
```

**Bloqueantes**

1. **A lista fechada `CODIGOS_DA_BNCC` só está escrita no `7_task.md`.**
   - **Onde:** `tasks/prd-classificacao-bncc/7_task.md:98`, mais o código que a usa:
     - `packages/shared/src/bncc/codigos-da-bncc.ts:6`
     - `packages/shared/src/material/material.ts:305`
     - `packages/core/src/auditoria/acoes.ts:686-687`
     - `apps/api/src/material/material.service.ts:95` e `:587`
   - **O que está errado:** a linha da tabela de divergências diz que isso já está na `techspec.md` (§4 "PUT" e "Ordem das respostas", §5 "Correção") e no `cenarios.md` (código fora do recorte). Não está: os dois arquivos não foram alterados nesta tarefa, e um `grep` por `CODIGOS_DA_BNCC`, `lista fechada` e `z.enum` neles não acha nada.
   - **Por que pesa:** não é detalhe de implementação. O `packages/shared` passa a ter uma segunda fonte dos códigos da BNCC, ao lado da tabela `habilidade_bncc`. A §3 descreve a carga por versão (`on conflict (codigo) do update`), e com a lista isso deixa de bastar:
     - toda carga nova da BNCC agora exige gerar de novo um arquivo TS do `shared`;
     - o `PUT` da correção passa a recusar o código que a tabela tem e a lista não;
     - `habilidadesDaAuditoriaSchema.parse(antes)` (`material.service.ts:587`) lança e responde 500 na correção de uma seção que a IA classificou com um código fora da lista.
     
     O teste de proteção, `packages/core/src/db/bncc/codigos-da-bncc.test.ts`, lê o arquivo fixo `dados-2026.08.json`. Uma carga em arquivo novo passa por ele sem reprovar, ao contrário do que diz o docblock da lista.
   - **Correção exigida:**
     - Registrar a decisão na `techspec.md`: na §3 (Carga), a lista no `shared`, o teste que a amarra à carga e o que uma carga nova precisa fazer; na §4, o `codigos[]` como enum da lista; na §7, a auditoria com os códigos como enum.
     - Registrar no `cenarios.md`: um código com formato válido que a tabela não tem é `ENTRADA_INVALIDA`.
     - Ou trocar a decisão por outra que já esteja escrita na spec.

**Recomendações**

- **Duas linhas da tabela de divergências apontam para a spec sem que ela as tenha.** São as linhas 100 e 101 do `7_task.md`: `travarParaReclassificar` com `of secao_do_material` e cursor obrigatório, e a conferência da função em todo lote. As duas são compatíveis com o texto da §5 e não bloqueiam. Registre-as em uma linha da §5 ou do `cenarios.md`, ou tire-as da tabela.
- **A ordem das respostas da correção difere da §4.** Em `material.service.ts:579`, disciplina sem componente responde `CONFLITO` antes de olhar os códigos; a §4 põe `ENTRADA_INVALIDA` antes de `CONFLITO`. A escolha é defensável, porque sem componente não há recorte, e o `cenarios.md:121` aceita. Vale uma frase na §4.
- **O comando refaz o tratamento de erro que já existe.** `apps/api/src/ops/reclassificar-escola.ts:131-143` repete o `terminarComErro` de `apps/api/src/ops/jobs-que-falharam.ts:96`, que já cobre os códigos 2 e 1, o `NAO_ENCONTRADO` e o `ERRO_INTERNO`. Use o existente, acrescentando `FUNCAO_SUSPENSA` em `MENSAGEM_DO_OPERADOR` se faltar.
- **A suspensão é conferida de dois jeitos.** Em `material.service.ts:557` é `SuspensaoRepository.estaSuspensa`; em `:612` e em `reclassificar-escola.ts:92` é `AgendamentoDaClassificacaoRepository.funcaoEstaAtiva`. Fique com um só.
- **Rodar o D76 numa escola sem seção a tratar não deixa rastro.** Em `reclassificar-escola.ts:94`, o primeiro lote vazio retorna antes de gravar `escola.reclassificada`, então a ação do operador, com o chamado, não fica na auditoria. Considere gravar o registro com contagem zero.
- **O teste da lista fica preso a um arquivo.** `codigos-da-bncc.test.ts` deveria ler a carga vigente, não `dados-2026.08.json` fixo, ou o docblock de `codigos-da-bncc.ts` deveria dizer o limite.
- **Junções do recorte do artefato:** um teste com duas turmas de séries diferentes, como a própria tarefa já anota.

Arquivos citados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/7_task.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/techspec.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/cenarios.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/shared/src/bncc/codigos-da-bncc.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/material.service.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/ops/reclassificar-escola.ts`

## test-engineer · 1ª rodada · REPROVADO · 2026-11-18 11:51:59 · `tasks/prd-classificacao-bncc/7_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- **Caminho feliz:**
  - `GET /:id` com as seções, a situação e as habilidades.
  - `PUT` da correção, de 0 a 5 códigos, final e auditada.
  - `POST …/reclassificar` com resposta 202.
  - `GET /v1/habilidades-bncc`.
  - O comando `ops:reclassificar-escola` com chamado.
- **Bordas:**
  - Coordenador eliminado (`corrigida_por` nulo).
  - Seção vizinha do mesmo material.
  - Seção esgotada (`falhas_seguidas = 3`) que volta.
  - Material não `pronto`, excluído, ou de disciplina sem componente.
  - Material sem série.
  - Código de outra etapa, com sufixo estadual ou fora da tabela.
  - Ordem das respostas da §4.
  - Função suspensa.
  - Comando em lotes, parado no sinal e rodado de novo.
- **Permissão:**
  - Professor e aluno no `PUT` e no reclassificar.
  - Aluno no material e nas habilidades.
  - Rede.
  - Professor sem vínculo, ou com artefato de colega.
- **Isolamento:** material, seção e artefato da B lidos no contexto da A, e código fora do recorte em material da B.
- **Concorrência:** P1b, P2, P3 (clique duplo no reclassificar), P5 (duas correções), P9 (rotina × reclassificar), o comando rodado duas vezes, e os tetos por pessoa e por escola.

**Cobertos:** todas as linhas da tabela de testes têm caso citado pelo nome, e conferi cada um. Rodei `classificacao-da-coordenacao.int.test.ts` (29 casos) e as seis suítes de unidade da tarefa (99 casos): tudo verde. Não há `.skip`, nenhuma chamada de modelo e nenhum mock de coisa nossa. As asserções olham a resposta e o banco: situação, `execucao_id`, `falhas_seguidas` e auditoria sem título. O P1b e o P5 forçam a ordem com `WriteBlockTrigger` e `esperarNaTrava`. Os tetos do `PUT` estão no limite exato (300º passa, 301º recebe 429; 901º recebe 429, com `Retry-After` e corpo inválido no 301º).

**Bloqueantes:**

1. **A tabela do documento anuncia mutações que a seção "Mutações" não tem.** São cláusulas novas sem bloco nem motivo. O `--faltando` não as lista porque não são linhas com condição, mas são exatamente as cláusulas que cada linha diz provar:
   - **P1b, "tirar o `for update` do `concluir`":** a trava está em `apps/api/src/material/secoes.repository.ts:186`. Exigido: um bloco que tira o `.for('update')`, citando "P1b, a correção × o `concluir`…".
   - **P5, "tirar o `for update`":** a trava está em `apps/api/src/material/secoes.repository.ts:281` (`travarParaCorrigir`). Exigido: um bloco que tira o `.for('update')`, citando "P5, duas correções…".
   - **"zeram `falhas_seguidas`. Mutação: sem zerar":** o `update` está em `packages/core/src/material/agendamento-da-classificacao.repository.ts:200-203`. Exigido: um bloco que tira esse `update`, citando "cria a execução e o job só das seções…". O `#criarExecucao` não zera as falhas, então o caso fica vermelho.
   - **"coordenador eliminado. Mutação: a marca em `corrigida_por`":** a marca está em `apps/api/src/material/secoes.repository.ts:259`. Exigido: um bloco que troca para `corrigida: corrigidaPor !== null`, citando "o coordenador eliminado…".

2. **A trava `for update` do `travarParaReclassificar` não tem bloco, e o P3 não a prova de forma determinística.** A trava está em `packages/core/src/material/agendamento-da-classificacao.repository.ts:187`. O teste P3 (`classificacao-da-coordenacao.int.test.ts:625-636`) só dispara os dois pedidos em `Promise.all`, sem forçar a ordem.
   - Sem a trava, se as duas transações se intercalam, a segunda lê a execução antiga. A condição P9 do `#criarExecucao` então troca 0 seções, a resposta vira `[1, 0]` e o teste fica vermelho.
   - Se as duas rodam em série por acaso, a segunda vê `pendente` e a resposta é `[1, 1]`: o teste fica verde.
   - O mutante só é pego por acaso de tempo, e a divergência 3 do documento justifica essa trava justamente pelo P3.
   - Exigido: forçar a ordem como no P1b e no P5. Parar o primeiro reclassificar com `WriteBlockTrigger` (no `insert` de `execucao_agente` ou no `update` de `secao_do_material`), esperar o segundo em `esperarNaTrava(..., '%"secao_do_material"%for update%')`, soltar e assertar `[1, 1]` e 2 execuções. Depois, um bloco que tira o `.for('update', { of: secaoDoMaterial })`, citando o P3.

3. **O teste promete "o recorte vem antes do estado" e não prova essa ordem.** O caso está em `apps/api/test/classificacao-da-coordenacao.int.test.ts:324-335`. Ele só manda `CODIGO_DO_6O`, que é válido, ao material `processando`.
   - A §4 diz: `ENTRADA_INVALIDA` (código fora do recorte) antes de `CONFLITO` (material não `pronto`).
   - Se alguém subir `if (alvo.estado !== 'pronto')` (`material.service.ts:582`) para antes do `habilidadeEhCandidata` (`:581`), toda a suíte continua verde. O item 4 da autoconferência afirma o que o teste não mostra.
   - Exigido: no mesmo caso, um `PUT` no material `processando` com `CODIGO_DO_9O`, esperando `{ status: 400, codigo: ENTRADA_INVALIDA }`. E um bloco que move a checagem do estado para antes da checagem do recorte, citando esse caso.

**Recomendações:**
- **Suspensão no meio dos lotes:** o comando confere a função em todo lote (`apps/api/src/ops/reclassificar-escola.ts:92`, divergência 4), mas nenhum caso suspende entre dois lotes. Vale um caso que suspende entre o lote 1 e o lote 2 e confere que só o primeiro deixou execução e auditoria.
- **Teto de escola do reclassificar:** no "o 101º pedido de reclassificar…" (`:503-518`), a escola chega a 401 registros, não a 300. O caso passaria com um teto de escola de 400. Vale semear exatamente `RECLASSIFICACOES_POR_ESCOLA_NA_JANELA` e mostrar que o anterior passa.
- **`Retry-After` no 901º `PUT`:** o caso (`:499`) não confere o `Retry-After`.
- **Lote de 500 e `statement_timeout` sem prova:**
  - Nenhum teste confere o padrão `SECOES_POR_LOTE_DO_AGENDAMENTO`: o caso usa lote de 2.
  - Nenhum teste confere o `set_config('statement_timeout')` de `reclassificar-escola.ts:89`. Um `current_setting('statement_timeout')` lido dentro do lote bastaria.
- **Escola inexistente:** em `reclassificarEscola` (`:736`), o caso só olha `toBeInstanceOf(DomainException)`. Melhor assertar `codigo: NAO_ENCONTRADO` ali também; hoje isso só está provado no de ponta a ponta.
- **Professor de outra disciplina nas habilidades:** falta um caso de `GET /v1/habilidades-bncc?materialId=` com professor vinculado só em Física. Hoje só o professor sem nenhum vínculo é testado.
- **Comando rodado duas vezes em paralelo:** há só o caso em série ("rodado de novo"). É improvável na operação, mas fica registrado.
- **Já registradas pelo próprio documento e ainda válidas:** as junções do recorte do artefato (duas turmas de séries diferentes), o artefato de outro ano e o operador inativo no comando.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/7_task.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/classificacao-da-coordenacao.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/secoes.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/material.service.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/material/agendamento-da-classificacao.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/ops/reclassificar-escola.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/ops/reclassificar-escola.test.ts`

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-18 12:27:20 · `tasks/prd-classificacao-bncc/7_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma migration nem tabela nova nesta rodada. Desde a 1ª rodada, o diff não muda nenhum código de repository, controller ou service. Em `material.service.ts` mudou só um docblock, e em `matriz.ts` e `codigos-da-bncc.ts`, só comentário. O que vale para `secao_do_material`, `habilidade_da_secao`, `execucao_agente`, `material`, `disciplina`, `artefato`, `turma`, `serie`, `vinculo`, `suspensao_de_funcao` e `auditoria` é o que a 1ª rodada já conferiu. A árvore de trabalho é a mesma de `54544ca5` nos arquivos auditados.

Queries verificadas:
- `recorteDoArtefato` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/secoes.repository.ts:324-342`): a escola sai de `requireEscolaId()`, o ano de `requireAnoEmCurso()` e o dono de `requestSessao().usuarioId`. As junções de turma, série e disciplina agora têm caso próprio, com duas turmas de séries diferentes e uma disciplina sem componente.
- `travarParaReclassificar`, para a suspensão entre dois lotes do comando D76: o comando confere a escola e a função em todo lote, no contexto da escola dada.
- A nova frase da matriz e da techspec diz que, para a coordenação, o `artefatoId` dá `NAO_ENCONTRADO`. A resposta é igual à do inexistente e não revela nada.
- Nenhum endpoint passou a aceitar `escolaId` no corpo ou na query. Nenhum `@Unscoped()` novo. A rede continua em `nunca`.

Teste de isolamento: presente e efetivo. As duas recomendações da Mesa foram aplicadas:
- **Duas turmas de séries diferentes:** está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/classificacao-da-coordenacao.int.test.ts:604-626`. Sem `turma.id`, `serie.id` ou `disciplina.id` na junção, o recorte volta errado e o teste quebra. Os blocos de mutação dessas três chaves estão no 7_task.md.
- **Professora em duas escolas (`sessaoDaMesmaConta`):** está nas linhas 628-636 do mesmo arquivo. O artefato dela na B, consultado com o token da A, dá `NAO_ENCONTRADO`.

Bloqueantes: nenhum.

Recomendações:
- O caso da professora em duas escolas (`classificacao-da-coordenacao.int.test.ts:636`) não torna observável a cláusula `eq(artefato.escolaId, escolaId)`. O `sessaoDaMesmaConta` cria um usuário novo na B, com id próprio, então quem barra continua sendo o `criadoPor`. Tirar só a cláusula de escola deixa o teste verde. Isso corrige o que eu esperava desse caso na 1ª rodada. Não há vazamento, porque o `criadoPor` é um id de usuário preso à escola do token. Mesmo assim, o 7_task.md deveria listar `eq(artefato.escolaId, escolaId)` e `eq(artefato.anoLetivoId, requireAnoEmCurso())` entre os termos de escopo repetido, com esse motivo, em vez de deixar a impressão de que o caso novo prova a escola.
- O artefato de outro ano letivo continua sem caso. Já está registrado no `TODO.md`.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-18 12:27:28 · `tasks/prd-classificacao-bncc/7_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. Nenhuma das mudanças desde a 1ª rodada grava, lê ou deriva `Nota`. Procurei no diff de `apps/` e `packages/` por nota, `lancadaPor`, conceito, aprovação ou reprovação, tutor, ranking e emoção, e nada apareceu. Todos com autor humano? Não se aplica.

Decisão autônoma sobre aluno: ausente. A classificação continua sendo um dado sobre o material, e só chega a uma questão quando o professor confere e aplica a atividade.

Aprovação registrada: ok. A rodada não mudou o que eu tinha conferido na 1ª: a correção da coordenação é humana, final e auditada, e o "antes" guarda os códigos da IA. Dois testes novos reforçam isso:
- **Comando D76, função suspensa entre dois lotes:** o comando para com `FUNCAO_SUSPENSA`, e só o primeiro lote deixa execução e o registro `escola.reclassificada`. Isso prova que a suspensão pela coordenação vale mesmo no meio da operação (`apps/api/test/classificacao-da-coordenacao.int.test.ts`, caso "a função suspensa entre dois lotes").
- **Corridas P1b e P3:** agora a ordem é forçada, e assim a correção humana nunca é sobrescrita pela gravação da IA.

Supervisão do tutor: a tarefa não toca o tutor.

Autonomia declarada e visível: sim. Nada mudou desde a 1ª rodada: `classificacao_do_material` tem autonomia 1 e textos em português comum, e o `GET /:id` mostra `classificacaoSuspensa`.

Itens 7 a 9 da regra 70:
- **Item 7:** nada de comportamento nem de emoção.
- **Item 8 (D55):** nenhum campo de nota.
- **Item 9 (medir o professor):** o comentário novo da matriz deixa explícito que o `artefatoId` é só do professor dono, e para a coordenação dá `NAO_ENCONTRADO`. É isso que mantém o artefato do professor fora do alcance da coordenação (`packages/shared/src/permissao/matriz.ts:275`), e o caso novo do recorte do artefato prova esse comportamento. O teto por pessoa continua sendo só limite de taxa, sem indicador exposto.

Minhas recomendações da 1ª rodada estão com destino escrito: o histórico vai para o Validador e o dossiê (D61); a justificativa foi recusada e fica para a AIA de diagnóstico por habilidade; o rótulo de IA vai para a tarefa 8.0. O que muda no `docs/runbook.md` (o comando D76 não aplica o freio de custo por noite) é custo e operação, não regra 70.

`docs/regulacao.md`: não precisa mudar com esta tarefa.

Bloqueantes: nenhum.

Recomendações:
1. **Rótulo de IA na 8.0 (repete a 3ª da rodada anterior).** Quando a tela da tarefa 8.0 for revisada, conferir nas fotos se `origem: 'ia'` aparece com o rótulo de IA (regra 70, item 4a). Conferir também se a coordenação não recebe a opção de `artefatoId`, como o docblock da matriz já pede.

Arquivos auditados nesta rodada:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/.processo/ordens/diff-7_task-r2.txt
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/classificacao-da-coordenacao.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/material.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/shared/src/permissao/matriz.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/docs/runbook.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/7_task.md

## revisor-geral · 2ª rodada · APROVADO · 2026-11-18 12:27:31 · `tasks/prd-classificacao-bncc/7_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (`portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)`)
Bloqueantes: nenhum

O bloqueante da 1ª rodada foi corrigido. A lista fechada `CODIGOS_DA_BNCC` agora está escrita na spec:
- **§3 da `techspec.md`:** onde a lista mora, o teste que a amarra à carga e o que uma carga nova precisa fazer.
- **§4 e §7 da `techspec.md`:** o enum no `PUT` e na consulta das candidatas, e os códigos como enum na auditoria.
- **`cenarios.md`, em "Recusas":** código de formato válido que a tabela não tem é `ENTRADA_INVALIDA`.

As quatro recomendações que a Mesa mandou aplicar também foram feitas:
- **Divergências na spec:** as duas linhas da tabela que faltavam (`travarParaReclassificar` com o cursor obrigatório, e a função conferida em todo lote) estão na §5. A falta do limite por noite no comando está na §5 e no `docs/runbook.md`.
- **Ordem das respostas:** a frase "Na correção" foi para a §4, e há um caso que prova a ordem: no material `processando`, `CODIGO_DO_9O` dá 400 e `CODIGO_DO_6O` dá 409.
- **Teste da lista:** `codigos-da-bncc.test.ts` agora lê o `dados-*.json` de versão mais alta da pasta, e o docblock da lista diz isso.
- **Duas turmas de séries diferentes:** o caso novo "é o da turma e da disciplina do próprio artefato…" usa uma turma do 6º e uma do Médio, uma disciplina sem componente e uma professora que dá aula também na escola B.

Todas as linhas da tabela de divergências do `7_task.md` agora apontam para um trecho que existe na `techspec.md` e no `cenarios.md`.

Recomendações:
1. **`techspec.md:42` contradiz o teste.** O texto ainda manda "apontar o teste para o JSON da nova versão", mas o teste já escolhe sozinho o JSON de versão mais alta. Trocar por "acrescentar o `dados-*.json` da nova versão na pasta". O mesmo ajuste vale para a linha 101 e para o item 6 da autoconferência do `7_task.md`, que ainda citam `dados-2026.08.json` como alvo fixo.
2. **`techspec.md:62`, linha do `PUT` na tabela da §4.** A coluna de entrada diz só `codigos[]` (0 a 5, sem repetir). Acrescentar "da lista fechada (§3)", para quem lê só a §4 ver o enum.
3. **`packages/core/src/db/bncc/codigos-da-bncc.test.ts`.** Com a pasta sem nenhum `dados-*.json`, o fallback `vigente ?? 'sem-carga.json'` falha com um ENOENT pouco claro. Um `expect(vigente).toBeDefined()` antes da leitura deixa a falha legível.
4. **Artefato da B ainda é barrado pelo dono, não pela escola.** No caso da professora com conta nas duas escolas (`apps/api/test/classificacao-da-coordenacao.int.test.ts`), cada escola tem um usuário dela com id próprio. Quem recusa o artefato da B com o token da A continua sendo o `criadoPor`, não o `eq(artefato.escolaId, …)`. Não há vazamento; fica registrado para o `tenancy-guardian`.
5. **Ficam da 1ª rodada:**
   - O tratamento de erro do comando repete o `terminarComErro` de `jobs-que-falharam.ts`.
   - A suspensão é conferida de dois jeitos (`estaSuspensa` e `funcaoEstaAtiva`).
   - Rodar o D76 numa escola sem seção a tratar não grava `escola.reclassificada`.

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/7_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/db/bncc/codigos-da-bncc.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/shared/src/bncc/codigos-da-bncc.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/classificacao-da-coordenacao.int.test.ts

## infra-guardian · 2ª rodada · APROVADO · 2026-11-18 12:27:32 · `tasks/prd-classificacao-bncc/7_task.md`

VEREDITO: APROVADO
Caminho quente tocado: fila
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum

Desde a 1ª rodada, o código de produção mudou só em docblocks (`material.service.ts` e `matriz.ts`). O resto da diferença está em testes, no runbook e na spec. As duas correções pedidas pela Mesa foram feitas:
- O docblock de `#exigirDentroDoTetoDaAuditoria`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/material.service.ts:662`, agora diz que pedidos simultâneos podem passar juntos pela contagem e que esse excesso foi aceito, porque o teto não é cota.
- O `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/docs/runbook.md` agora avisa que o `ops:reclassificar-escola` não aplica o `EXECUCOES_POR_NOITE_DA_ESCOLA`. Traz também a query para contar as seções antes de rodar e manda avisar a escola do custo. A §5 da techspec registra o mesmo.

Testes de corrida e de teto em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/classificacao-da-coordenacao.int.test.ts`:
- **P3:** a ordem agora é forçada. O primeiro reclassificar para no `insert` da execução, ainda segurando a trava da seção, e o segundo espera no `for update`. A prova é a contagem de execuções no banco.
- **P1b:** o gatilho passou a ser `before`, e assim só o `for update` da leitura segura a correção.
- **Comando D76:** há um caso novo com a função suspensa entre dois lotes. Só o primeiro lote deixa execução e auditoria.
- **Tetos:** o 300º reclassificar da escola passa e o 301º não; o 429 confere o `Retry-After`.

Rodei `npx vitest run --project integracao apps/api/test/classificacao-da-coordenacao.int.test.ts` e os 31 casos passaram.

Recomendações (seguem da 1ª rodada, nenhuma bloqueia):
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/auditoria/auditoria.repository.ts:98`: os tetos contam pelo índice `(escola_id, em)` e só depois filtram `acao`. Quando a auditoria crescer, um índice `(escola_id, acao, em)` ou parcial resolve.
- `GET /v1/materiais/:id`: o `secoes[]` volta sem paginação. O tamanho tem limite, porque depende do upload. Se o limite de páginas do PDF aumentar, a lista precisa ser revista.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-18 12:27:32 · `tasks/prd-classificacao-bncc/7_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum novo nesta rodada. No código de produção, a única mudança desde a 1ª rodada é o docblock de `#exigirDentroDoTetoDaAuditoria` (`apps/api/src/material/material.service.ts:660`). O único campo pessoal da tarefa continua sendo `secao_do_material.corrigida_por`, e ele não sai em nenhum DTO.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok. O diff acrescenta provas, não muda regra.
- `GET /v1/habilidades-bncc?materialId=` com um professor que só tem vínculo em Física, pedindo material de Química, responde `NAO_ENCONTRADO`.
- O recorte do artefato tem caso novo com duas turmas de séries diferentes e uma disciplina sem componente. Também cobre a professora com conta nas escolas A e B: com o token da A, o artefato dela na B dá `NAO_ENCONTRADO`. Isso confirma que `recorteDoArtefato` (`apps/api/src/material/secoes.repository.ts:324-342`) prende o artefato pela escola da sessão, pelo dono (`criadoPor`) e pelo vínculo confirmado.
- A correção que a Mesa pediu está feita. O docblock da matriz (`packages/shared/src/permissao/matriz.ts:100`) diz que o `artefatoId` dá `NAO_ENCONTRADO` para a coordenação, e a `techspec.md` §4 diz o mesmo. O código faz exatamente isso, pelo filtro `criadoPor` com o vínculo.

Logs: limpos. O diff não acrescenta log. Os que já existiam em `material.service.ts` (594, 627, 666) registram só o `evento` e ids.

Auditoria: presente e sem mudança (`material.classificacao_corrigida`, `material.reclassificado`, `escola.reclassificada`). O caso novo da suspensão entre dois lotes prova que só o primeiro lote deixa `escola.reclassificada`, sem nenhum registro depois da suspensão.

Envio externo: nenhum novo. O runbook (`docs/runbook.md:221`) agora avisa que o comando D76 não aplica o limite de execuções por noite. Esse aviso trata de custo e operação, não de dado de pessoa. Pelo que já vem das tarefas 4.0 a 6.0, o que vai ao modelo continua sendo texto de material, registrado em `ExecucaoAgente`.

Seed/fixture: sintético. `artefatoNovo` cria uma "Atividade sintética" sem questões. A conta da professora em duas escolas usa `professora-<uuid>@exemplo.invalid`, um domínio reservado que não pertence a ninguém.

Bloqueantes: nenhum.

As correções exigidas na 1ª rodada foram feitas:
1. **Docblock da matriz sobre o `artefatoId` do coordenador:** feito em `matriz.ts:100`, e a `techspec.md` §4 traz o mesmo texto.
2. **Lista fechada de códigos na spec:** feita. A `techspec.md` §3 diz que carga nova precisa gerar a lista de novo, e `codigos-da-bncc.test.ts` passou a conferir contra o `dados-*.json` de versão mais alta da pasta. Isso também resolve a minha recomendação 1 da 1ª rodada (o `parse(antes)` dar erro interno com uma carga nova).

Pergunta de fechamento: não muda em relação à 1ª rodada. O que a tarefa guarda sobre uma pessoa é só sobre o coordenador (`corrigida_por`, que o arquivo do titular já alcança, e a autoria na auditoria). Nada desta tarefa sai do sistema. O código responde.

Recomendações (nenhuma bloqueia):
1. O caso de artefato de outro ano letivo e o do operador inativo no comando continuam sem teste. Já estão encaminhados ao `TODO.md` na tabela "Recomendações sem aplicar".
2. A `techspec.md` §3 ainda diz para "apontar o teste para o JSON da nova versão", mas o teste agora acha sozinho o arquivo mais recente. Vale ajustar a frase para ela não descrever um passo manual que não existe mais.

Um aviso sobre o que eu fiz na árvore: por engano, rodei `git add -N .`, que marcou os 9 arquivos não rastreados no índice. Desfiz a marcação na hora com `git reset` só nesses caminhos, e eles voltaram a aparecer como `??`. Nenhum arquivo foi editado. Depois comparei a árvore de trabalho com um índice temporário no scratchpad: ela é idêntica à árvore auditada `54544ca5`.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/.processo/ordens/diff-7_task-r2.txt`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/secoes.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/material.service.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/classificacao-da-coordenacao.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/shared/src/permissao/matriz.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/db/bncc/codigos-da-bncc.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/techspec.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/docs/runbook.md`

## test-engineer · 2ª rodada · APROVADO · 2026-11-18 12:29:12 · `tasks/prd-classificacao-bncc/7_task.md`

VEREDITO: APROVADO

**Cenários exigidos** (os mesmos da 1ª rodada, mais os itens 8 a 13 que a Mesa mandou aplicar):
- **Caminho feliz:** `GET /:id` com as seções, `PUT` da correção, reclassificar com 202, `GET /v1/habilidades-bncc` e o comando D76 com chamado.
- **Bordas:**
  - coordenador eliminado;
  - seção vizinha;
  - seção esgotada que volta;
  - material que não está `pronto`, excluído, ou de disciplina sem componente;
  - material sem série;
  - código de outra etapa, com sufixo estadual ou fora da tabela;
  - ordem das respostas da §4;
  - função suspensa, inclusive entre dois lotes do comando;
  - comando em lotes, parado no sinal e rodado de novo;
  - duas turmas de séries diferentes.
- **Permissão:** professor e aluno no `PUT` e no reclassificar; aluno no material e nas habilidades; rede; professor sem vínculo, professor vinculado só a outra disciplina e artefato de colega.
- **Isolamento:** material, seção e artefato da B lidos no contexto da A; código fora do recorte em material da B; a professora que dá aula nas duas escolas.
- **Concorrência:** P1b, P2, P3, P5, P9 e os tetos exatos por pessoa e por escola.

**Cobertos:** as três correções exigidas foram feitas.

1. **Blocos que faltavam.** A seção "Mutações" agora tem os quatro.
   - P1b tira o `.for('update')` do `gravarClassificacao`, em `secoes.repository.ts:186`.
   - P5 tira o `.for('update')` do `travarParaCorrigir`, em `:281`.
   - Um bloco troca o `set({ falhasSeguidas: 0 })` por um que mantém as falhas, em `agendamento-da-classificacao.repository.ts:202`. O caso "cria a execução…" pega, porque espera `falhas_seguidas` 0 na seção que tinha 3.
   - Um bloco troca `corrigidaEm` por `corrigidaPor`, em `secoes.repository.ts:252`. O caso "o coordenador eliminado" pega, porque espera `corrigida: true` com `corrigida_por` nulo.

   Conferi o P1b com o gatilho `before`. Nesse caso nenhuma linha de habilidade da IA é apagada antes da parada, e o `for key share` da chave estrangeira ainda não veio. Então a única trava que segura a correção é o `for update`, e o bloco fica vermelho pelo motivo certo.

2. **P3 determinístico.** O primeiro reclassificar para no `insert` de `execucao_agente`, e o segundo é esperado em `esperarNaTrava('%"secao_do_material"%for update%')` (`classificacao-da-coordenacao.int.test.ts:684-707`). O teste confere `[1, 1]` e 2 execuções. Há bloco que tira o `.for('update', { of: secaoDoMaterial })`. Sem a trava, o segundo não espera nela e o caso fica vermelho. Com a ordem forçada, o bloco de `pendente` também fica vermelho sempre: dá 3 execuções.

3. **O recorte vem antes do estado.** O teste agora manda `CODIGO_DO_9O` ao material `processando` e espera 400 `ENTRADA_INVALIDA` (`:341`). O bloco que inverte as linhas 581 e 582 do `material.service.ts` deixa esse caso vermelho.

As recomendações 8 a 13 da Mesa também foram feitas:
- **Teto da escola no reclassificar, exato.** Fiz a conta: 100 + 1 + 198 = 299 registros, então o 300º passa e o 301º recebe 429, com `Retry-After` (`:528-537`).
- **`Retry-After` no 901º `PUT`** (`:512`).
- **Suspensão entre dois lotes:** só o primeiro lote deixa execução e auditoria (`:814-834`).
- **`NAO_ENCONTRADO` tipado** para escola inexistente no comando (`:807`).
- **Professor vinculado só a Física** (`:592-593`).
- **Duas turmas de séries diferentes, disciplina sem componente e a professora nas duas escolas** (`:604-638`), com blocos nas três chaves de junção.

Rodei `classificacao-da-coordenacao.int.test.ts` (31 casos) e `codigos-da-bncc.test.ts` (2 casos): tudo verde. Não há `.skip`, `.only` nem teste comentado. Nenhum teste chama provedor de modelo.

**Bloqueantes:** nenhum.

**Recomendações:**
- **Suspensão entre dois lotes sem mutação declarada.** A linha nova da tabela não diz qual mutação a prova. O bloco existente na conferência `funcaoEstaAtiva` (`reclassificar-escola.ts:92`) cita só o caso da suspensão antes do primeiro lote. Um bloco que confere a função só no primeiro lote (por exemplo `lotes === 0 && …`), citando "a função suspensa entre dois lotes", deixaria a divergência 4 provada pelo portão, e não só pelo teste.
- **A professora das duas escolas não isola a cláusula de escola.** No caso de `:629-636`, quem barra é ainda `eq(artefato.criadoPor, …)`: o usuário dela na B tem outro id. `eq(artefato.escolaId, escolaId)` (`secoes.repository.ts:334`) continua sem caso que fique vermelho só por ela. Ela também não está na lista de motivos: só aparece como contexto do bloco do `criadoPor`. Não é vazamento, porque o usuário pertence a uma escola só. Mesmo assim vale registrar o termo entre os motivos do "Escopo repetido", em vez de deixá-lo coberto só pelo contexto de outro bloco.
- **Como P1b, P3 e P5 ficam vermelhos.** Nas três corridas, quando a trava sai, o vermelho vem do tempo esgotado do `esperarNaTrava`, não de uma asserção sobre o resultado. Isso é válido, porque o teste afirma que o pedido espera na trava. Uma mensagem de falha que diga "o segundo não esperou a trava da seção" pouparia tempo a quem ler o vermelho.
- **Ainda sem caso**, já com destino no documento: artefato de outro ano letivo, operador inativo no comando, lote padrão de 500 e `statement_timeout` do lote.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/classificacao-da-coordenacao.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/7_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/secoes.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/material.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/material/agendamento-da-classificacao.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/ops/reclassificar-escola.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/db/bncc/codigos-da-bncc.test.ts
