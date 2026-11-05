# Tech Spec — A escola inteira entra de uma vez

**PRD:** `tasks/prd-onboarding-por-convite/prd.md`
**Status:** aprovada na revisão da spec (rodada 8, 03/11/2026); no corte em duas specs (Joaquim, 03/11/2026), e-mail,
senha e conta da escola foram para `tasks/prd-acesso-e-convites/techspec.md`, sem mudar regra
**Teto:** 2.700 palavras (Joaquim, 03/11/2026)
**Cenários:** `tasks/prd-onboarding-por-convite/cenarios.md`: testes, limites, corridas e auditoria

## 1. Resumo da abordagem

O navegador lê o CSV ou a primeira aba do XLSX
e manda **texto** à API (como na A1); a API classifica na hora (prévia), e gravar vira o job
`estrutura.gravar-planilha`, que refaz a classificação.
No worker, a conta global só se alcança pela exceção da seção 6 e pelo ciclo de vida.

## 2. Módulos afetados

| Módulo | Novo ou alterado | O quê |
|---|---|---|
| `packages/core/src/estrutura/` | novo, por **mudança de lugar** | sobem de `apps/api`, para haver um jeito só: os repositories de turma, série, disciplina, lista e vínculo; o `encerrar`; o `travarPendente` e o `fechar` da decisão; o `exclusao.ts`, que turma e disciplina importam para traduzir o 23503 da exclusão; o cadastro do professor, com o `contaParaConvite` indo do `TenantResolutionRepository` para o `ContaGlobalRepository` |
| `packages/core/src/importacao/` | novo | o motor |
| `apps/api/src/estrutura/importacao/`, `grade/`; `professores/`, `sala/` | novo; alterado | rotas; seção 5 |
| `apps/worker/src/processors/` | alterado | `gravar-planilha.ts`, os dois expurgos (seção 5) |
| `packages/core/src/ciclo-de-vida/` | alterado | `desativar` encerra os vínculos (turmas travadas em ordem de id, num comando, na ordem global) e revoga o convite aberto (N1 da A1). O encerramento é por pessoa (`CicloDeVidaRepository.encerrarVinculosDaPessoa`, por `desligamento`), de professor e de aluno, no ano em curso e no planejado: o `encerrar` do `VinculoRepository` é por id, só do vínculo de professor e só do ano em curso, e não serve; o acesso da turma sai pelo mesmo `revogarDeQuemSaiu` que ele usa. O `desativar` alcança quem o login ainda ativaria: o usuário ativo e o que aceitou o convite com a conta que já tinha senha e não entrou (o `aceito` da A1), com a mesma resposta e o mesmo estado final, `desativado` (E11); o `desativado_em` é `clock_timestamp()`, depois da trava do usuário, e fica posterior a todo aceite confirmado. Qualquer outro inativo, como o pendente com o convite em aberto, responde `NAO_ENCONTRADO` antes de travar a conta (a ordem do aceite é conta → usuário), e o convite dele sai pelo `convite/revogar` da A1. Usuário ativo não tem convite em aberto (o `usuarioConvidado` só cria ou reaproveita inativo, e o `ativarPorConvite` só consome convite usado): a revogação no `desativar` é defesa, sem a trava da escola, e o teste dela monta o estado direto no banco, dito no nome |
| `packages/shared/src/importacao/`; `apps/web` | novo; alterado | cabeçalhos das planilhas e contratos, com `resumo` estrito; seção 9 |

## 3. Modelo de dados

Todo id é `uuid` com `uuidv7()`; toda tabela nova com ano tem FK composta `(escolaId, anoLetivoId)` para `ano_letivo`, salvo a `alocacao`, que prende escola e ano pela FK composta do vínculo (`escolaId, anoLetivoId, vinculoId`), que já leva ao ano.

```
importacao_planilha  escolaId*, anoLetivoId?, tipo, estado (na_fila|concluida|desatualizada|falhou),
                     linhas jsonb?, marcas jsonb?, assinatura, resumo jsonb? (só contagens), erro (lista fechada, check)?,
                     criadoPor? (set null), criadoEm, concluidaEm?; único parcial (escolaId) onde na_fila;
                     índice parcial (criadoEm) onde na_fila. anoLetivoId nulo só no tipo professores
alocacao             escolaId*, anoLetivoId*, vinculoId* (FK composta com o ano, on delete cascade), diaSemana 1–7,
                     inicio, fim, sala?; check inicio < fim; único (vinculoId, diaSemana, inicio); índice (escolaId, anoLetivoId)
evento_calendario    escolaId*, anoLetivoId*, tipo (feriado|recesso|evento), inicio, fim, descricao ≤ 120; índice (escolaId, anoLetivoId)
turma                + chave? (a normalizada); único parcial (escolaId, anoLetivoId, chave) onde não nula
vinculo              + origem not null default 'coordenacao' (coordenacao|grade|lista)
```

A `turma.chave` nasce
na criação e é recalculada na renomeação, no mesmo `update` (fora do padrão: nula; único violado: `CONFLITO`); a
migration a preenche só onde é única no ano, e a classificação calcula pelo nome quando ela é nula. Migrations só expandem; voltar a versão: o runbook recalcula a `chave`.

`alocacao` substitui as três tabelas da grade do `docs/modelo-de-dados.md`; a reimportação **mantém o id** por (vínculo,
dia, início); a `Aula` da F2b aponta para ela. Glossário: "Grade horária" são as alocações do ano.

## 4. API

| Método | Rota | Papel | Entrada | Saída |
|---|---|---|---|---|
| POST | `/v1/importacoes/:tipo/previa` | coordenador | `{ texto, turmaId?, anoLetivoId? }`, até 512 KB | linhas, contagens, candidatos |
| POST | `/v1/importacoes/:tipo` | coordenador | idem + `marcas` | `{ id }`, 202 |
| GET | `/v1/importacoes/:id` | coordenador | — | id, tipo, estado, resumo, erro, datas |
| GET | `/v1/grade?turmaId=`, `/v1/calendario` | coordenador (com `anoLetivoId?`); professor com vínculo confirmado | — | aula (professor só com id e nome); evento |

`anoLetivoId` é filtro validado no servidor (como o de turma): sem ele, o ano em curso;
com ele, só o `planejado` da escola da sessão; outro valor, `NAO_ENCONTRADO`, como o `turmaId` fora da escola ou do ano.
A planilha de professores não é de um ano: ela grava com a escola sem ano em curso, e um `anoLetivoId` no corpo dela é `NAO_ENCONTRADO`, como o `turmaId` num tipo que não usa turma (a 15.0 não o manda para esse tipo).
O corpo de 512 KB de texto, escapado em JSON, passa do limite padrão do servidor (100 KB): a API lê corpo JSON de até 1 MB
(`LIMITE_DO_CORPO_JSON`, em `configure-app.ts`), e cada contrato continua limitando o próprio campo. O leitor é um só: o teto de
512 KB e de 3.000 linhas é do contrato da prévia e do gravar, e, fora de `/v1/importacoes`, um middleware antes do leitor recusa
pelo `Content-Length` o corpo **JSON** (`Content-Type: application/json`) de mais de 100 KB
(`LIMITE_DO_CORPO_FORA_DA_PLANILHA_BYTES`) com `ENTRADA_INVALIDA`. Têm o teto da planilha, e não o de 100 KB, as duas rotas da lista da
turma, `POST /v1/turmas/:id/lista/previa` e `POST /v1/turmas/:id/lista` (`ROTA_DA_LISTA_DA_TURMA`, em `configure-app.ts`, 8.0): elas
recebem o mesmo texto de até 512 KB e 3.000 linhas (perto de 110 KB escapado), com ou sem consulta; o avulso (`/lista/nome`), a
leitura e o id fora do formato seguem no teto de 100 KB. Prova: `configure-app.test.ts › a prévia e a gravação da lista da turma
seguem com o corpo grande`. O corpo que não é JSON não passa por esse teto: o multipart do
envio de material (até 20 MB) tem o limite do próprio `FileInterceptor`. Exceção sabida: o corpo JSON sem `Content-Length` (enviado
em pedaços) passa pelo middleware e fica preso só ao leitor de 1 MB, em qualquer rota.
`GET /v1/calendario` não é paginado: o tamanho é limitado porque a importação do calendário substitui os eventos do ano (até 3.000
linhas). Quem acrescentar escrita incremental de evento precisa paginar a leitura no mesmo passo.
`/v1/turmas/:id/lista/previa` e `/lista` ficam, com o contrato da importação
(202), com o `turmaId` conferido na escola e no ano (outro valor, `NAO_ENCONTRADO`). A API lê o texto (`lerTextoDaLista`, sem cabeçalho
`nome;matricula`) e o entrega ao motor como `DaLista` (`{ turmaId, linhas }`, no `tipo.ts`), que o tipo `alunos` classifica sem coluna de
turma (`previaDaLista`). O nome avulso (`POST /lista/nome`) segue síncrono (201); a gravação do texto é 202 e o job grava
`planilha.gravada`, e não `lista.gravada`, que fica só com o avulso. O "Copiar link" do professor cadastrado pela planilha faz o `convite/refazer` (linha nova).
As duas rotas da lista do texto (`/lista/previa` e `/lista`) têm o limite de `/v1/importacoes` (`@ImportacaoRateLimit`): 20 pedidos por minuto por
usuário, no mesmo balde da prévia e do gravar da planilha, e ocupam as duas vagas da escola (`SchoolSemaphore`); prova em `lista.int.test.ts`
("limites da prévia e do gravar da lista", 8.0).

## 5. Fluxo

**Planilha.** A prévia normaliza (turma: `^(\d)\s*[ºo°ª]?\s*(ano)?\s*([a-z])$`, sem acento nem caixa, 6–9 Fundamental e
1–3 Médio; disciplina sem acento nem caixa) e classifica em lote, com a escola do contexto: aluno aprovado pela
`credencial_matricula` e pelo `usuario`, não aprovado pela `lista_nome`; professor pelo `usuario` da escola, nunca pela
`conta`. Gravar
refaz a prévia (erro ou marca fora dos candidatos: `ENTRADA_INVALIDA`), fecha `falhou` a `na_fila` de mais de 1 h (`for
update nowait`; travada: `CONFLITO`) e enfileira.

**O job** abre o contexto pela escola do outbox e roda em três passos. (1) As contas dos professores, pelo
`contaParaConvite`, cada uma numa transação curta, na ordem do e-mail. (2) Sem trava: lê a importação (fora de
`na_fila`, sai) e refaz a classificação; assinatura diferente: `desatualizada`. (3) Uma transação curta (`lock_timeout` de
1 s, `statement_timeout` de 1,5 s) trava na **ordem global**, que o `desativar` e o `eliminar` também seguem: a importação
(`for update`; fora de `na_fila`, sai), na planilha de professores a trava do convite da escola (`pg_advisory_xact_lock`, a mesma do cadastrar, refazer e revogar da A1, que vêm antes de ler o estado), o ano (`FOR SHARE`; na de professores, o dos vínculos de todo marcado; na de alunos, o dos vínculos de todo aprovado marcado para desligar), os usuários que vai escrever (`FOR NO KEY UPDATE`), as contas
(`FOR SHARE`), as turmas tocadas (destino, origem e turma de todo marcado), em ordem de id num comando só, em `FOR NO KEY UPDATE`
(barra o gerar acesso, não o `FOR KEY SHARE` das FKs da decisão e da reivindicação), e os pedidos pendentes
delas, relidos. Relê o estado de toda linha em que o (2) se baseou (turma, usuário, vínculo, `lista_nome`, pedido, conta)
e aplica em lotes de 500, com escrita condicional (`lista_nome` com `where estado = :lido`; `fechar('encerrada')` antes de
apagar a `lista_nome`). Diferença, zero linhas (inclusive o `encerrar` que devolve `false`) ou único violado (`chave`,
matrícula, `vinculo_ativo_unico`): a transação volta e a importação sai `desatualizada`; conta sem e-mail: nova tentativa,
que refaz o (1). Trava esgotada ou deadlock: nova tentativa com espera crescente. Falha definitiva ou `ultimaTentativa`:
`falhou`. Importação de quem já saiu (`criado_por` nulo, pela eliminação da pessoa): `desatualizada`, sem gravar, porque
a auditoria precisa de autor humano e a rotina não assina `planilha.gravada` (`auditoria_rotina_so_nas_acoes`). Toda troca de estado: `where estado = 'na_fila'`, apagando `linhas` e `marcas`.

| Estado | Entra | Sai | Prazo e falha |
|---|---|---|---|
| `na_fila` | gravar | o job | Redis perdido: o despachante republica (D49); processo morto: o BullMQ reentrega; tentativas esgotadas: `falhou`; mais de 1 h: o gravar seguinte, ou o expurgo da 1h, fecha `falhou` (até ~25 h) |
| `concluida`, `desatualizada`, `falhou` | o job, o gravar, o expurgo | — | sai em 90 dias (`sistema.expurgar-acesso`); a auditoria fica |

Importação parada: o `retencao.expurgar-escola` (1h, por escola, com escopo); a importação final de 90 dias: o
`sistema.expurgar-acesso`. Os dois com `skip locked`.

**Reimportar alunos (8.0).** A matrícula que já existe é classificada pelo que ela é no banco: "já existe" (mesma turma, mesmo nome), "nome corrigido" (mesma turma, nome diferente) ou "muda de turma" (outra turma). *"Muda de turma" vale mais que "nome corrigido"*: a matrícula que a planilha põe em outra turma não corrige o nome junto, e o nome só muda com a marca (9.0). O aprovado só entra se tem linha `lista_nome` aprovada no ano, ativo e com `credencial_matricula`; sem linha ou desativado, é "já existe". *Quem pode ser candidato a desligar ("fora da planilha")*: só o aluno de turma que alguma linha sem erro cita e que o nome da planilha acha em uma turma só; a turma ambígua ou com erro não oferece ninguém. Sem marca, "muda de turma" e "fora da planilha" não gravam nada. *A contagem ausente vale zero*: `nomes_corrigidos` (no `resumo`) e `corrigidos` (em `planilha.gravada`) só aparecem quando são maiores que zero.

**Gravar.** Alunos (7.0): turma (com a `chave`, na série que o nome diz, criada se faltar) e série novas, com a ação `turma.criada` (série e origem `planilha`); `lista_nome` nova de quem tem matrícula que a escola ainda não tem neste ano; a matrícula que já está na lista do ano ou tem credencial na escola é "já existe" e não grava nada, nem cria a turma que só ela pedia (nome e turma dela são da 8.0, 9.0 e 10.0); o tipo trava as turmas que as linhas tocam pelo gancho `travar`, que o motor chama no (3) depois de conferir o ano; nome corrigido no `usuario.nome` do aprovado
(`usuario.nome_corrigido`) ou na `lista_nome` (`lista.nome_corrigido`), sem nome; transferência (9.0) pelo encerramento do vínculo do aluno (`encerrarDosAlunos`, `realocacao`, a mesma escrita do `encerrar`, por aluno e turma), vínculo confirmado na nova,
`lista_nome` na nova turma (`lista.transferida` e `aluno.transferido` na auditoria, só com as duas turmas), pedido pendente encerrado pelo `fechar('encerrada')`, que grava só o estado e anula os
segredos, sem `decidida*` (o `virarSala` usa a mesma função); desligar o aprovado pelo `desativar`; o não
aprovado apaga a `lista_nome` e encerra o pedido (`lista_nome.retirado`, com a turma e o estado que o nome tinha, `livre` ou
`reivindicado`; o pedido pendente é encerrado antes). *Virada de ano (só na planilha do ano planejado):* o aluno que a
credencial da matrícula acha, sem linha `aprovado` nem vínculo aberto no ano de destino, "volta", sem marca: vínculo confirmado na turma da linha
(`vinculo.criado`), a linha `aprovado` da lista do ano e o mesmo login, e o vínculo do ano encerrado não é tocado; o desativado
sem linha no ano é erro de linha (`aluno_desativado`). No ano em curso, e com linha no ano, a matrícula segue "já existe" (8.0). Professores: o `convidar` da A1, token descartado (fica `pendente`). Candidato a desligar é só o ausente que o `desativar`
alcança, `ativo` ou `aceito` pelo `estadoDoProfessor`; o ausente `pendente`, `vencido`, `revogado` ou `desativado` não é
candidato (marcado: `ENTRADA_INVALIDA`), e o convite em aberto sai pelo "Revogar" da lista (`convite/revogar` da A1). O
`NAO_ENCONTRADO` do `desativar` no (3) é diferença: `desatualizada`.
Grade: linha sem professor é erro; reaproveita o vínculo aberto ou cria um pendente (`origem = grade`); encerra só o marcado. O vínculo do ano planejado só se confirma em curso. Calendário: substitui no ano.

## 6. Isolamento

Escola e ano vêm do contexto; no job, da linha, nunca do payload. Duas exceções, no mesmo arquivo, cercadas **por arquivo**
nas duas guardas (`ZONAS_DAS_CLASSES_CERCADAS` do `architecture.test.ts` e `cerca-conta-global` de
`tools/guardas/camadas.cjs`, cada uma com fixture que reprova o arquivo vizinho) e no `docs/modelo-de-dados.md`:
- `ContaGlobalRepository.contaParaConvite`, `@Unscoped('a conta é global: acha ou cria pelo e-mail, sem ler nada dela, e devolve só o id e se ela é nova')`, e o cadastro descarta o `nova`:
  zona `packages/core/src/estrutura/cadastro-de-professor.ts`
- `ContaGlobalRepository.travarEConferir` (6.0), `@Unscoped('a conta é global: o passo (3) da planilha de professores trava em FOR SHARE as contas que o passo (1) do próprio job achou, pelo id, e devolve só se cada uma ainda tem o e-mail da linha')`: o `FOR SHARE` das contas na ordem global do (3), com o e-mail conferido; sai pelo mesmo arquivo (`travarContasDoProfessor`) e o motor o recebe por injeção, como o `acharConta`. O `ImportacaoRepository` não lê a `conta` a não ser pelo `leftJoin` de `usuario.conta_id` da escola, em `professoresDaEscola`.

O cadastro entrega só o id da conta (`contaDoProfessor`). O `convidar` da A1 fica na API com duas entradas, `convidar` (o
coordenador, que leva o `nova` à auditoria) e `convidarProfessor` (que chama o cadastro); o que o worker da 6.0 precisar do
convite sobe para o core nessa tarefa, e o arquivo do cadastro continua o único de `estrutura/` que alcança a classe.
O próprio `contaDoProfessor` (e o `travarContasDoProfessor`) também é cercado, porque repassa a conta sem escopo: sai pelo subcaminho `@educa/core/cadastro-de-professor`
e não pelo barril `@educa/core/estrutura`, e só `apps/api/src/sessao/` o chama (a 6.0 acrescenta o processor do worker à zona,
nas duas guardas). A cerca é a entrada `contaDoProfessor` de `ZONAS_DAS_CLASSES_CERCADAS` e a regra `cerca-cadastro-de-professor`.

O `sistema.expurgar-acesso` ganha o alvo da `importacao_planilha` final, como rotina nossa (regra 10, item 9). Os casos
estão no `cenarios.md`.

## 7. Dado pessoal

| Item | Resposta |
|---|---|
| Campos | os da seção 3, no `docs/lgpd.md` |
| Log | ids, contagens, código; nunca linha, nome, matrícula nem e-mail |
| Auditoria | a tabela RF17 do `cenarios.md`, uma linha por ação |
| Provedor externo | nenhum |
| Retenção e eliminação | `docs/lgpd.md`; `alocacao` em cascata com o vínculo; autores `set null` |
| DTO | seção 4; a prévia sem e-mail de colega, fora do armazenamento do navegador |

## 7b. Conformidade CNE

Sem IA.

## 7c. Carga e falha

| Item | Resposta |
|---|---|
| Caminho quente | o passo (3) do job trava turmas contra o gerar acesso e a decisão em sala |
| Fila | `normal`: `estrutura.gravar-planilha` |
| Limites e corridas | tabelas do `cenarios.md`; limite por usuário, escola ou conta, nunca só por IP. A vaga de planilha por escola vale 30 s se o processo morrer antes de devolvê-la (`VALIDADE_DA_VAGA_DA_PLANILHA_MS`: bem acima do p95 de 2 s, e curto para a escola não ficar presa) |
| Semáforo da planilha | `SchoolSemaphore` (`packages/core/src/rate-limit/`): conjunto no Redis de cache, um script atômico (`TIME`, limpa o vencido, confere, grava), seguro em memória com máximo ÷ instâncias se o Redis cai. Convive com o `EscolaConcurrencyLimiter` (`packages/core/src/queue/`) porque são outra coisa: o da fila limita job em execução, no Redis de fila, com o limite da escola e renovação pelo worker; este limita requisição da API, no Redis de cache, sem renovação e sem nunca recusar por falha do Redis |
| Tempo | prévia e gravar com 3.000 linhas: p95 até 2 s com a rajada em paralelo; nenhum statement acima de 1,5 s |
| Dependência cai | Redis: o job espera no Postgres |
| Métrica e alerta | job por resultado, e o passo (3); alerta com runbook: `falhou` acima de 20% em 1 h, `na_fila` há 30 min, passo (3) acima de 1 s. O alerta da fila lê `importacao.minutos_na_fila`, por `escola_id`: minutos desde o `criado_em` da `na_fila` mais antiga da escola, medida pelo worker de lote a cada 5 min (`ImportacaoGauge`); a escola sem importação na fila não tem série. Com o `for: 1m`, o alerta dispara entre 31 e 36 min |

## 9. Frontend

`ImportarPlanilha` em Turmas, Professores e na aba nova **Grade e calendário** de
`Escola.tsx`; o XLSX carrega sob demanda (`docs/interface.md` 10.4). Prévia: erros, avisos e marcas primeiro, o resto em
contagem, paginado de 100; marca rotulada com nome e matrícula. Vazio com "Baixar
modelo"; falha com "Tentar de novo"; código de erro vira frase com o que fazer. A grade, tabela com cabeçalhos, rola no
cartão a 360 px. Professores mostra o convite para copiar do professor que a planilha cadastrou. Cada tela
atualiza o `docs/interface.md`.

## 10. Testes

Um teste por cláusula, no `cenarios.md`; e2e em `chromebook` e `celular`, com axe; XLSX real na biblioteca real.

## 11. Conformidade com as regras

| Regra | Desvio e justificativa | Documento |
|---|---|---|
| 10, item 9 | sem escopo, cercado (seção 6): o `contaParaConvite`, que só muda de classe (quatro `@Unscoped` no `ContaGlobalRepository`; o total não muda) | esta seção |
| Modelo de dados | `alocacao` plana, com id estável | `docs/modelo-de-dados.md`, glossário |
| PRD, RF15 | o PRD admite 10 s; aqui o teto é 2 s (regra 00, item 4) | esta seção |

## 12. Premissas não verificadas

- ⚠️ NÃO VERIFICADO: `read-excel-file` (MIT) devolve a célula de texto como texto

## 13. Riscos técnicos

- O passo (3) do job trava turmas contra o gerar acesso das 7h30: o critério do cenário [C]; falhando, a spec volta à
  revisão
