# Tech Spec — Ingestão do material (F4)

**PRD:** `prd.md` (RF da nota do corte)
**Cenários de teste:** `cenarios.md`
**Status:** rascunho

## 1. Resumo da abordagem

A extração vira o job `material.extrair-pdf`, na fila `pdf` do `apps/worker`, e o PDF fica no storage só até ela (45.0
e 46.0 da `onda-3b.md`, desvios na seção 11). O material ganha séries, capítulos, edição e licença; a leitura filtra
por série e licença. O trecho é a página.

## 2. Módulos afetados

| Módulo | Novo ou alterado | O quê |
|---|---|---|
| `packages/core/src/material/` | novo | `PdfExtractor`, `ChapterReader`, o repository da extração |
| `apps/worker/src/processors/` | novo | extração e varredura |
| `apps/api/src/material/` | alterado | envio, séries, edição, licença, resumo |
| `apps/api/src/ops/`, `operacao/` | alterado | a 46.0 |
| `apps/api/src/{artefato,assistente,tutor}` | alterado | leitura, `fontes` |
| `packages/shared`, `core/retencao`, `apps/despachante` | alterado | contratos, fila, jobs, vagas, matriz, classificação, expurgo |
| `infra/`, `compose` | alterado | `worker-pdf`; `VAGAS_ESCOLA_PDF` no worker e no despachante |

## 3. Modelo de dados

Com `escola_id`, sem ano letivo.

```
licenca_de_material  id, escola_id, licenciante text(1-120), cobertura text(1-300), referencia text(1-200),
                     vigente_desde date, vigente_ate date null, registrada_por uuid null, registrada_em, alterada_em
                     unique (escola_id, id); check vigente_ate >= vigente_desde
                     FK (escola_id, registrada_por) on delete set null ("registrada_por")
material_serie       escola_id, material_id, serie_id; pk (escola_id, material_id, serie_id)
                     FK (escola_id, material_id) on delete cascade; FK (escola_id, serie_id)
capitulo_do_material id, escola_id, material_id, ordem smallint, numero int null, titulo text(1-200),
                     pagina_inicial int, pagina_final int; unique (escola_id, material_id, ordem)
                     FK (escola_id, material_id) on delete cascade; check pagina_final >= pagina_inicial
material             + edicao text(1-60) null, + substitui_id, + substituido_por, + licenca_id,
                     + processado_em, + objeto_apagado_em (45.0)
                     FK (escola_id, licenca_id); FK (escola_id, substitui_id) e (escola_id, substituido_por)
                       on delete set null (só a coluna, à mão, como na 0022)
                     unique parcial material_uma_edicao_em_andamento (escola_id, substitui_id)
                       where estado = 'processando' and excluido_em is null
envio_de_material    escola_id, material_id, criado_em; pk (escola_id, material_id); FK da escola, não do material
```

**Migrations** (regra 80, item 9): (1) colunas e tabelas nulas; (2) backfill em lotes, com `lock_timeout`: todas as
séries da escola em cada material; uma licença por `(escola_id, licenciante)`, `vigente_desde` no `enviado_em`
mais antigo, sem fim (ou fim na última exclusão, se todos estão excluídos), `referencia` "registrada antes da F4". O código grava `licenca_id` **e** `licenciante`. A contração é da F4b
(item 4 da abertura de lá). O `docs/runbook.md` ganha "Voltar o código depois da F4": o que fica (jobs `pdf`,
`processando`, `envio_de_material`) e como limpar.

**Retenção.** A licença sai no expurgo, em `material_excluido`, contada de `vigente_ate` (sem fim, não sai), só sem
linha de `material` que a cite, inclusive excluída; o passo vem depois do material.

## 4. API

| Método | Rota | Papel | Entrada | Saída |
|---|---|---|---|---|
| POST | `/v1/materiais` | coordenação | + `serieIds[]` (1 a 7, sem repetir), + `edicao?`, + `licencaId` (só terceiro, no lugar de `licenciante`) | `Material` |
| PATCH | `/v1/materiais/:id` | coordenação | `titulo?`, `serieIds?` (como no envio) | `Material` |
| POST | `/v1/materiais/:id/edicoes` | coordenação | `arquivo`, `edicao?`, `titulo?`; herda disciplina, séries, titularidade e licença | a nova |
| GET | `/v1/materiais` | coordenação, professor | + `serieId` | + `serieIds`, `edicao`, `licencaId`, `substitui` |
| GET | `/v1/materiais/:id` | coordenação, professor | — | o de cima + `capitulos` |
| GET | `/v1/materiais/resumo` | coordenação | — | por disciplina e série: `pronto`, `processando`, `falhou`, `recusados30Dias`; `semSerie` |
| GET, POST | `/v1/licencas` | coordenação | licenciante, cobertura, referência, vigência | página, com `materiais` e `situacao` (`vigente`, `vence_em_30_dias`, `vencida`, `futura`) |
| PATCH | `/v1/licencas/:id` | coordenação | vigência, cobertura, referência | `Licenca` |
| GET | `/v1/artefatos/:id` | professor | — | + `fontes` (`materialId`, `titulo`, `edicao`, `substituido`), uma por material citado; sem a linha, `titulo` "material da escola" |

`serieIds` ou `licencaId` de outra escola: `NAO_ENCONTRADO`, como o inexistente. Erros novos: `EDICAO_EM_ANDAMENTO`,
`LICENCA_VENCIDA`, `SEM_MATERIAL_DA_SERIE`. A licença não se exclui, e **não há `GET /v1/licencas/:id`** (5.0): a leitura é a página, e o objeto de outra escola só se prova no `PATCH` e no repository. Professor e aluno recebem `NAO_ENCONTRADO` **também na coleção**: o `PermissaoGuard` responde 404 a toda célula `nunca` da matriz (regra 10, item 6), e `PERMISSAO_NEGADA` na coleção confirmaria que ela existe. A situação sai do dia de São Paulo (`diaDeUso`) com o `Clock` injetado (`relogioDasLicencas`, em `AppModule` e em `MaterialModule.forRoot`, como `relogioDosConvites`). Os `PATCH` leem a linha `for update`; o de material
excluído ou de outra escola dá `NAO_ENCONTRADO`, e o que é ou tem edição em `processando`, `EDICAO_EM_ANDAMENTO`.

## 5. Fluxo

**Envio e edição.** (1) Antes de ler o arquivo: alvo da edição (fora da escola ou inexistente: `NAO_ENCONTRADO`, antes
de tudo), tetos, licença (da escola, vigente) e séries (da escola); a recusa grava `material.recusado`, só com séries
conferidas, fora de transação, com o motivo: `sem_licenca` e `sem_declaracao` (o pedido), e, com a licença registrada,
`licenca_vencida` (a data não vale hoje: `LICENCA_VENCIDA`) e `licenca_inexistente` (a que não existe e a da escola B, que
a auditoria não distingue e a API responde com o mesmo `NAO_ENCONTRADO`); os dois ficam em
`MOTIVOS_DA_RECUSA_PELA_LICENCA_REGISTRADA` (`packages/shared`). (2) Id da aplicação (UUIDv7); linha em `envio_de_material`; bytes ao storage, com prazo.
(3) A transação toma a trava de envios da escola, como hoje, e reconfere tetos e licença (`for share`; a recusa também
grava `material.recusado`; a licença que deixou de valer entre a entrada e a transação, ou que sumiu do banco nesse meio-tempo, cai nos dois casos em `licenca_vencida` e em `LICENCA_VENCIDA`, para quem lê a auditoria depois); na edição, lê o alvo com `where escola_id = :ctx and id = :alvo and estado = 'pronto' and
excluido_em is null for update` (sem linha: `EDICAO_EM_ANDAMENTO` ou `NAO_ENCONTRADO`) e herda
as séries lidas ali; grava material, séries, auditoria e o job (chave = id), e apaga a linha de `envio_de_material`,
que precisa existir (sob `lock_timeout` de 1 s, `ESPERA_MAXIMA_PELA_LINHA_DO_ENVIO_MS`; o `55P03` também é 503), ou desfaz com 503. (4) Falha do próprio `guardarBytes`: tenta apagar o objeto e a linha fica
(o PUT atrasado pode gravar). Falha depois: o objeto sai primeiro (ausente conta), a linha só depois; se o
apagar falha, a linha fica. A varredura horária, depois de 1 h, trava a linha (`for update skip locked`), na mesma ordem, com prazo curto no `apagar` (10 s), **dentro** da transação que segura a linha, de propósito: é a linha travada que impede o envio lento de entrar no meio, e tirar o `apagar` da transação reabre a corrida (regra 80, item 7). Passada à parte: o objeto de `pronto`, `falhou` ou excluído há mais de 25 h, com `objeto_apagado_em` nulo, sai e ganha a marca.

**Extração** (worker, na escola do job). A transição `where escola_id = :escola and id = :id and estado = 'processando'
and excluido_em is null` abre a
transação; sem linha, o job conclui sem efeito. Seguem trechos, capítulos e, com `substitui_id`, `update material set
excluido_em = now(), substituido_por = :nova where escola_id = :escola and id = :antiga and excluido_em is null`, os
trechos da antiga apagados e `material.substituido`. Depois do commit, o objeto é apagado.
`sem_texto`, `arquivo_invalido` e o objeto ausente (`extracao_falhou`: sem valor novo, pelo rollback) são falha definitiva, pela transição de sempre; objeto ausente de material que já saiu de
`processando` conclui sem efeito.

**Capítulos** (`ChapterReader`). O marcador de primeiro nível, um por página; sem marcador, a linha
`^(cap[ií]tulo|unidade|m[óo]dulo)\s+(\d+)` no topo da página quando o número muda, fora do sumário. Bordas em
`cenarios.md`; erro dá zero capítulos, sem falhar. O que o código fixa (4.0): o "topo" são as **2 primeiras linhas**
da página, lidas **antes** de `tirarLinhasRepetidas` (o cabeçalho corrido é o dado da linha); o sumário é a página com
**3 casamentos ou mais em qualquer linha**; o marcador sem destino de página, ou fora do PDF, é pulado, e se nenhum
resolve o leitor cai na linha; a linha lida é a **primeira das duas do topo que casa**: num livro com "Unidade 2" como cabeçalho corrido na primeira linha e "Capítulo 5" na segunda, o número da unidade não muda e os capítulos dentro dela se perdem (limite conhecido; o marcador do PDF não tem essa limitação); o `numero` é o do começo do título (a mesma regex), nulo se não há ou passa de `int`; o
título vazio vira `Capítulo <ordem>`; o capítulo vai até a página antes do seguinte, e o último até o fim; **mais de
2.000 capítulos** (um marcador por página) é zero capítulos. Os capítulos são gravados com `insert` simples, sem
`on conflict`, depois da transição e na mesma transação: o segundo job do mesmo material não chega ao insert.

**Leitura de página.** Série e "hoje" (`Clock`, São Paulo) entram em `buscar`, `paginasDoMaterial`,
`materialDaTurma` e na rota `GET /v1/materiais/busca` (com `serieId`, que filtra e não autoriza): `pronto`, não
excluído, com a série, e próprio **ou** de licença com `vigente_desde <= hoje` e `vigente_ate` nula ou `>= hoje`; o
mesmo em `existeMaterialDaSerie`. Ferramenta e chat conferem antes do `202` (`SEM_MATERIAL_DA_SERIE`, sem execução nem
orçamento). O Tutor resolve turma e atividade, roda a D36 (intacta, `materialId` nulo) e só **depois**
filtra o material aberto e confere a série: recusa sem nada na conversa; a tela do aluno mostra um estado. O modo
livre não muda.

**Como ficou na 9.0.** O filtro é uma cópia só, em `material.repository.ts` (`declaradoParaASerie` e `proprioOuComLicencaVigente`), que as quatro
leituras usam. "Próprio" é `titularidade <> 'terceiro_com_licenca'`: o material da escola não pede licença, e o de terceiro só vale pela licença
vigente. A página aberta (`materialId` e `pagina`) fora do alcance da turma (outro material, outra série, edição substituída, licença vencida)
responde `NAO_ENCONTRADO`, a resposta do inexistente (regra 10, item 6), e a conferência depois do `202` repete o mesmo filtro: a execução falha com o
código da recusa, sem trecho, sem consumo e sem resposta. A recusa por falta de material (`SEM_MATERIAL_DA_SERIE`, 422) conta em
`tutor.recusa_sem_material`, com um rótulo só, `turma_id`: nem aluno nem escola. A adaptação (`POST /v1/artefatos/:id/adaptar`) não passa pelo `gerar` e não lê material: ela transforma o artefato que a professora já tem, e por isso não é recusada por `SEM_MATERIAL_DA_SERIE`; recusam só a atividade, o plano e o chat. A ferramenta e o chat conferem pela turma do professor
(`turmaComDisciplina` devolve `serieId`), e `serieId` na rota de busca só filtra. A contagem tem gráfico no painel de Fundação (`tutor_recusa_sem_material_total`, por turma) e a seção "Turma sem material da série" do runbook diz o que olhar; não é alerta.

## 6. Isolamento (obrigatório)

FK composta com a escola em toda referência; escopo do contexto (no worker, `job_registro.escola_id`) em toda
consulta, inclusive `for update` e `for share`. `@Unscoped`: os da 45.0 e da 46.0, e as duas leituras da varredura da 2.0, a de `envio_de_material`
e a de `material` (só escola e id, em `VarreduraDoMaterialRepository`).

## 7. Dado pessoal (obrigatório)

| Item | Resposta |
|---|---|
| Campos pessoais tocados | `licenciante` (pode ser pessoa), na licença; `registrada_por` |
| Novos campos (atualizar `docs/lgpd.md`) | licença, PDF temporário, ações da auditoria; `envio_de_material` `sem_pessoa` |
| O que vai para log | ids, códigos, contagens, duração; nunca título, arquivo, licenciante, texto |
| O que entra em auditoria | `licenca.registrada`, `.alterada` (ids e vigência, sem texto livre), `material.edicao_enviada`, `.substituido`, `.atualizado`, `job.reprocessado`, `job.descartado`; `material.recusado` ganha `serieIds` |
| O que é enviado a provedor externo | nada |
| Retenção e expurgo | licença: seção 3; edição substituída: `material_excluido`; PDF: até a extração, ou 25 h no órfão, e, no `processando` cujo job falhou de vez, até o Descartar (3.0), com o `job_registro` falho de `material.extrair-pdf` fora do expurgo de 30 dias até lá (5.0, §11) |
| Arquivo do titular | a licença, no do coordenador que registrou (`licenciante`, `referencia` em `fora`) |
| Autorização por objeto | licença, `PATCH` e resumo só da coordenação; `fontes` só do artefato alcançado |
| DTO de saída | licenciante só à coordenação; nunca hash, chave nem quem enviou |

Bucket sem versionamento (onda 3b).

## 7b. Conformidade CNE

Sem saída de IA nova (item 3); D36 antes de todo filtro novo, sem troca invisível (item 4); auditoria (item 6); resumo
sem pessoa (itens 7 e 9).

## 7c. Carga e falha (obrigatório)

| Item | Resposta |
|---|---|
| Está no caminho quente? | a leitura de página |
| Carga na manhã de segunda | dois joins, por índice da escola |
| Fila e prioridade | fila `pdf` (checks de fila e `vagas` ampliados com `NOT VALID`/`VALIDATE`); `worker-pdf` com um PDF por vez e `cpus` limitado; `prazoMs` 10 min, 3 tentativas; varredura em `lote`, horária (minuto 10, urgente, lote de 500 alvos por passada); o lote vezes o prazo de cada `apagar` não cabe nos 10 min do job, e o que garante o corte é o `sinal` do executor (o laço para entre um alvo e outro, e o `apagar` em curso rejeita e a transação desfaz) e o storage fora do ar (3 falhas de storage seguidas, sem alvo que passou no meio, em duas escolas ou mais: as duas passadas param), com o resto na próxima tentativa ou na hora seguinte; uma chave que falha sempre, ou um `apagar` que passa sempre dos 10 s, é falha de uma escola só e não para as outras (o `S3FileStorage` transforma toda falha do `DeleteObject` em `FileStorageUnavailableError`, então só a sequência em mais de uma escola distingue o storage fora de uma chave com defeito); a linha trava com a transação aberta durante o `apagar`, por isso o pool de lote não pode ficar preso: cada `apagar` tem prazo de 10 s e o corte solta a conexão |
| Limite por escola | vaga `pdf` por escola 2 (`VAGAS_ESCOLA_PDF`, sobreposta por `configuracao_operacional_escola.vagas`); 100 envios por hora por pessoa, 300 por escola; 300 pendentes por escola; 20 MB por arquivo; o recebimento do multipart aceita 1 arquivo e até 17 campos (os 6 do pedido, as 7 séries repetidas de `serieIds` e uma folga de 4: `MAXIMO_DE_CAMPOS`, `material-upload.ts`) |
| Rate limit | `MaterialUploadGuard` (429, `Retry-After`) no envio e na edição; o `PATCH` à parte, 100 por hora por pessoa e 300 por escola |
| Corridas de concorrência | `cenarios.md` |
| Índices novos | `material_serie (escola_id, serie_id, material_id)`; `licenca_de_material_vigente_ate_idx (escola_id, vigente_ate) where vigente_ate is not null` e `material_licenca_idx (escola_id, licenca_id) where licenca_id is not null` (0052, 5.0); `auditoria (escola_id, em) where acao = 'material.recusado'`, sem `concurrently` (exceção da 0034); o parcial da 45.0 |
| Quando cada dependência cai | storage: 503; Redis: outbox; `worker-pdf`: alerta |
| Métrica e alerta | extração (duração, resultado); idade do job `pdf`. Alerta `pdf-parado`: o job `pdf` mais antigo pendente há mais de 15 min **e** nenhuma extração terminada (`pronto` ou `falhou`) nos últimos 15, com runbook |
| Cenário de teste de carga | `cenarios.md` |

**Estados.** `processando` (envio, edição) vai a `pronto` (extração) ou `falhou` (extração, prazo na última tentativa,
descarte); queda: stalled refaz. `pronto` sai por exclusão ou substituição; `falhou`, só por envio novo.

## 8. Uso de IA

Nenhuma chamada nova.

## 9. Frontend

| Tela | Mostra ou faz | De onde vem (§4) |
|---|---|---|
| Material | resumo; lista paginada | `GET /resumo`; `GET /v1/materiais` |
| Envio (até 20, um por vez) | disciplina, séries, licença vigente; enviar | `/v1/disciplinas`, `/v1/series`, `GET /v1/licencas` (`situacao`); `POST /v1/materiais` |
| Painel do material | capítulos; séries e título; edição nova (a anterior sai da busca) | `GET /:id` (`capitulos`); `PATCH /:id`; `POST /:id/edicoes` |
| Licenças (aba de Material) | situação, materiais; registrar; vigência | `GET`, `POST`, `PATCH /v1/licencas` (`materiais`: o que sai ou volta) |
| Sino | `licenca-vencendo` (30 dias antes, ou vencida com material), leva a Licenças, sem nome nem número por pessoa | `GET /v1/licencas`, sem reler por tempo |
| Chip e PDF do artefato | título, edição, "edição anterior" | `fontes` do artefato |
| Tutor do aluno | estado sem material | `SEM_MATERIAL_DA_SERIE` |

Textos e estados: `cenarios.md`, "Telas" (D51). `docs/interface.md` muda na tarefa de cada tela, inclusive os "cinco
tipos" do sino.

## 10. Testes

Em `cenarios.md`.

## 11. Conformidade com as regras

| Regra | Como é atendida | Desvio e justificativa | Documento que registra o desvio |
|---|---|---|---|
| 00, 10, 20, 70, 80 | seções 5 a 7c | — | — |
| 45.0 | onda 3b | fila `pdf` no `apps/worker`, não no `main-worker.ts` da 47.0; a varredura também acha o envio sem commit; sem o `substitui` da 41.0; o `pdf-esperando` não nasce, e no lugar fica o `pdf-parado` | esta Tech Spec (Joaquim, 11/11/2026) |
| 1.0 | extração no worker (a 45.0 inteira) | o id do material nasce na aplicação (`uuidV7`) e o objeto vai ao storage **antes** da transação, em `material-temporario/<escola>/<id>` (`chaveDoTemporario`), sem a linha de `envio_de_material`, que é da 2.0; a varredura de `processando` parado deixa a API aqui, e o `processando` sem job é fechado de outro jeito (abaixo): a varredura da 2.0 é só do objeto de `pronto`, `falhou` e excluído; o expurgo noturno apaga o objeto do excluído (`excluidosComObjeto`, lotes de 100, só dentro da janela) e a exclusão de `processando` o apaga na hora; o objeto ausente de `processando` é `arquivo_ausente` no log e na métrica, e `extracao_falhou` em `falha`; a extração tem 3 tentativas e a guarda `definicoes-de-job` a admite; o prazo e o desligamento além da graça abortam o `sinal` e o processador recupera o controle (`quandoAbortar`): na última tentativa o material fecha em `falhou` e o objeto sai com o processo vivo, e se o processo morre antes o job termina `falhou/EXECUCAO_INTERROMPIDA`, o alerta de job falhou de vez dispara e o "Descartar" da 3.0 fecha o material e apaga o objeto (§7c "Estados": descarte); o `processando` que a API anterior deixou, sem job nem objeto, a migration `0049` fecha em `falhou`/`extracao_falhou`; `processado_em` e `objeto_apagado_em` entram em `fora` do arquivo do titular; a `pdf` tem lock de 60 s e verificação de stalled de 20 s (`WORKER_POOL_OPTIONS_BY_QUEUE`), de modo que o job que perde o lock volta à fila em até 80 s; o job sintético não entra na `pdf` (`FILAS_DO_SINTETICO`) | esta Tech Spec (Implementador, 11/11/2026) |
| 2.0 | `envio_de_material`, objeto antes da linha, varredura horária | o job `sistema.varrer-temporarios-de-material` é **urgente** (`naoUrgente: false`), de hora em hora no minuto 10 (`10 * * * *`): rotina leve, e a janela letiva não pode segurar o PDF no storage de 7h às 18h (RF13); a falha de qualquer alvo não segura os outros, mas faz o job falhar no fim (a fila repete), salvo o storage fora do ar (3 `FileStorageUnavailableError` seguidos em duas escolas ou mais), que a para, e o `sinal` do executor, que a corta; cada passada trata até 500 alvos, e o `apagar` tem prazo de 10 s, sem caber no prazo do job no pior caso (o corte é o `sinal`); a espera pela linha do envio é de 1 s (`lock_timeout`), e o `55P03` é 503; `criado_em` é o relógio do banco, e a varredura lê o `Clock` do job; duas leituras `@Unscoped` (a de `envio_de_material` e a do órfão pós-commit), só escola e id; o repository da linha saiu como `envio-de-material.repository.ts` (o `EnvioRepository` de e-mail já cerca o nome `envio.repository`) e as leituras entre escolas, em `varredura.repository.ts` | esta Tech Spec |
| 3.0 | auditoria do job sem escola | o `job_registro` de `sistema.*` não tem escola, e o check `auditoria_escola_ou_operacao_global` só aceita sem escola `rede` e `suboperador`: a entidade `job` entra nele e em `ENTIDADES_DE_AUDITORIA_SEM_ESCOLA`, só com `autor_operador`, e o job de escola é auditado na escola da linha (nunca sem escola). Como é migration e a 3.0 corre junto da 2.0 e da 4.0, o check vai na migration da 5.0, que corre sozinha; até lá os dois comandos recusam o job sem escola, antes de tocar a linha, e a 5.0 tira a recusa. Na mesma 5.0, o expurgo de jobs deixa o `falhou` de `material.extrair-pdf` como deixa o de `titular.*`, até a ação do operador: sem isso, 30 dias depois a linha sai, o Descartar não acha o job e o material fica `processando` com o PDF para sempre; o prazo da tela de Retenção (`tarefa_em_segundo_plano`) e o `docs/lgpd.md` dizem o mesmo | esta Tech Spec (Arquiteto, divergência da 3.0, 11/11/2026) |
| 5.0 | a licença e a 5.8 | `registrada_por` é `on delete set null ("registrada_por")`, escrito à mão como na 0022 (o `set null` que o drizzle-kit gera anularia `escola_id`); o backfill (0053) roda na mesma transação da 0052, pelo `migrar`, em lotes de 5.000 e sob `lock_timeout` de 5 s: os lotes limitam o tamanho de cada instrução e o que uma falha desfaz, e não o tempo em que as linhas ficam travadas; o check `auditoria_escola_ou_operacao_global` é refeito na 0052 (`DROP` e `ADD`, como a 0029) para aceitar `job`; `exigirJobDeEscola` vira `exigirJobDaOperacao` (devolve a escola ou `null`), com `noContextoDoJob` (o `sistema.*` roda no contexto da rotina do sistema) e sem `JobSemEscolaError`; o expurgo da licença é o alvo `licenca_de_material` da categoria `material_excluido`, depois do `material`, só sem `material` que a cite, e a sem fim não sai; o `falhou` de `material.extrair-pdf` fica fora do expurgo de jobs, como o de `titular.*`; a 0052 cria os índices parciais `material_licenca_idx` (`material (escola_id, licenca_id) where licenca_id is not null`, o `not exists` do expurgo da licença e a contagem de `materiais`) e `licenca_de_material_vigente_ate_idx` (`(escola_id, vigente_ate) where vigente_ate is not null`, o expurgo pela data de fim), §7c; o teste do arquivo do titular monta o do coordenador com `papel: 'professor'`, como os casos da D85 no mesmo arquivo: `PapelDoTitular` só admite `aluno` e `professor`, porque o pedido do titular (F3) não atende coordenador, e o `papel` só decide o uso real do professor na versão completa, que não toca a licença; abrir o coordenador como titular é da tarefa futura do "Meus dados" dele | esta Tech Spec (Implementador, 12/11/2026; Arquiteto, ordem da 5.0 r1, 12/11/2026) |
| 8.0 | a edição e a substituição | `material.substituido` é gravado pelo job de extração, sem usuário: o autor é `rotina` (`autor_operador`), e o check `auditoria_rotina_so_nas_acoes` da 0056 passa a aceitá-lo (`DROP`, `ADD ... NOT VALID` e `VALIDATE`, como a 0029); `material.recusado` aceita de zero a sete séries, porque a edição recusada por licença vencida sobre um alvo de escola sem série não tem série a registrar; o alvo `falhou` responde `NAO_ENCONTRADO` (não há edição de material que não ficou pronto), e o `processando`, `EDICAO_EM_ANDAMENTO`; `material` ganha `edicao` e `substitui` no contrato de saída; `substituido_por` é a única coluna `_por` que não é de pessoa, e o catálogo do `mvp-tables.int.test.ts` a exclui pelo nome; `docs/runbook.md` traz o SQL que fecha os `processando` antes da volta do código e o do roll-forward, lidos pelo teste `volta-da-f4.int.test.ts` | esta Tech Spec |
| RF11 | as `fontes` | depois do expurgo da linha, a fonte vira "material da escola" | esta Tech Spec |
| 10.0 | as `fontes` e o chip | a `fontes` leva também o `materialId` (a tela liga a citação à fonte por ele), na ordem da primeira citação e sem repetir; `substituido` é `substituido_por is not null`, e a licença vencida **não** o muda (a citação segue); `titulosDosMateriais` do repository vira `fontesDosMateriais`, com o escopo da escola e sem o `excluido_em`; o texto "Título (edição, edição anterior)" é `rotuloDaFonte`, em `packages/shared`, o mesmo na tela e no rodapé do PDF; o artefato aberto e o resultado da ferramenta leem as `fontes` da resposta, e o `titulos-dos-materiais.ts` fica só para a conversa e a Turma hoje; **o chip não tem estado "carregando" nem "erro" próprio**: as `fontes` vêm na resposta do artefato, e esses dois estados são os da tela do artefato (`Carregando o artefato…`, `ErrorState`), em que nenhum chip existe; `ExportarPdf.tsx` não muda (o PDF é gerado na API, com as mesmas `fontes`); **o e2e "nova edição, e o artefato antigo com 'edição anterior'" grava a troca no banco** (`substituirMaterialNoBanco`) e abre o artefato pela API de verdade, porque a extração do PDF novo passa de 15 s: o caminho completo, com o worker, é o caso "a troca de edição" de `apps/api/src/artefato/artefato.int.test.ts`, e a tela de edição, com a coordenação, é a 12.0 | esta Tech Spec |
| 11.0 | o resumo | a permissão é `material.resumir` (coordenação `unidade`; professor, aluno e rede `nunca`, que a guarda responde `NAO_ENCONTRADO`); o resumo conta as recusas pelo `AuditoriaRepository.recusasDeMaterialDesde` (a tabela `auditoria` não sai de `@educa/core`, e a única porta de leitura dela é esse repository), as ações `material.recusado` com motivo `sem_licenca`, `sem_declaracao` ou `licenca_vencida` (os dois códigos `MATERIAL_SEM_LICENCA` e `LICENCA_VENCIDA` do cenário; `licenca_inexistente` não conta), a janela de 30 dias pelo `Clock` injetado, e cada recusa cai nas séries que ela conferiu (`depois.serieIds`, de zero a sete; a de zero série vira a linha `serieId: null` da disciplina); o material conta por série (o de duas séries conta nas duas), sem o excluído e sem o substituído, e o material sem série é a linha de `serieId` nulo da disciplina (a tela a chama "Sem série", por último) e entra também no `semSerie`, o total que dispara o aviso; o índice parcial `auditoria_material_recusado_idx` (`(escola_id, em) where acao = 'material.recusado'`, 0057) é criado sem `concurrently`, como a exceção da 0034 (tabela que cresce devagar nessa ação, e a migration roda fora do horário letivo, regra 80 item 9), e é só expansão (**gatilho da exceção:** a exceção do `concurrently` vale enquanto não há staging nem piloto (`docs/infra.md`); a partir da homologação ou do piloto, índice novo em `auditoria` vai em arquivo próprio, fora da transação, com `create index concurrently`); a consulta prende `entidade = 'disciplina'` (a que a ação grava) e, sem motivo a contar, responde vazio sem consultar; **"Mostrar mais" é da tela**, de 25 em 25 sobre a lista que a aba já leu inteira (`lerPaginas`, a mesma fila do Painel), e não uma paginação nova da API; a API não ordena as linhas (só conhece ids): a ordem, pelo nome da disciplina, pela posição da série e com "Sem série" por último, é da tela (`linhasDoResumo`); o resumo é uma região própria **fora** da região "Materiais da escola", para a contagem das linhas da lista continuar a dela; o aviso "Séries atribuídas na migração" aparece com `semSerie > 0` ou quando um material tem todas as séries da escola (escola com mais de uma); **o resumo não tem laço próprio** (regra 80, itens 1 e 10): ele só se relê quando a lista que a aba já lê muda de estado (a assinatura `id:estado` de todos os materiais mudou: um terminou, entrou ou saiu), ou quando o resumo na tela ainda conta `processando` e a lista, mais nova, já não tem nenhum; envio, exclusão e recusa o relêem pelo mesmo caminho. **A conta de pedidos por minuto da aba**, com a lista e o resumo juntos, contra `LIMITE_REQ_USUARIO_MIN` = 120 (`.env.example`): a lista se relê a cada 1,5 s enquanto há `processando` (`INTERVALO_DA_LEITURA_DO_MATERIAL_MS`), 40 leituras por minuto de `lerPaginas` de 100 em 100, ou seja 40, 80 e 120 pedidos por minuto para até 100, até 200 e até 300 materiais; o resumo soma **1 por mudança de estado** (o comum: um material termina a cada alguns segundos ou dezenas de segundos, no passo da extração) e, no pior caso (um material termina a cada leitura da lista), até 40 por minuto, que é o que o laço de 1,5 s da primeira versão somava sempre: 80, 120 e 160 por minuto, e os 160 passavam do limite. Sem laço, a escola de 300 materiais com um `processando` fica nos 120 da lista, mais o resumo só quando um estado muda; a lista já está nesse teto antes desta tarefa (`TODO.md`, "Da ingestao-do-material, tarefa 11.0"); o e2e do resumo está em `e2e/material-resumo.spec.ts`, porque `e2e/material.spec.ts` tem 776 linhas e os casos novos passariam do teto de 800 | esta Tech Spec |
| 12.0 | o painel e o `PATCH` | o `PATCH` reusa a permissão `material.enviar` (professor, aluno e rede `nunca`, que a guarda responde `NAO_ENCONTRADO`); o teto (100 por hora por pessoa, 300 por escola, `LIMITE_EXCEDIDO` com `Retry-After` da janela inteira) é contado na auditoria `material.atualizado` (`contarDaEscolaEDaPessoaDesde`), à parte do teto de envios; a auditoria leva as séries antes e depois e só `tituloAlterado`, nunca o título; o `PATCH` recusa só a edição `processando` e o material com edição `processando` sobre ele (`EDICAO_EM_ANDAMENTO`, depois do `NAO_ENCONTRADO`); o painel só lê os capítulos do material `pronto`, só oferece "Enviar edição nova" a ele e sem edição em leitura, desabilita título e séries enquanto há edição em andamento, e fecha depois de enviar a edição; os e2e do painel são `e2e/material-painel.spec.ts` | esta Tech Spec (Implementador, 14/11/2026) |
| RF6 | `PATCH` de séries | a de série fica na F4 (o backfill precisa); a de habilidade, na F4b | esta Tech Spec |
| RF8 | a recusa | o Tutor sem material vira um estado da tela, sem fala da IA | esta Tech Spec |

## 12. Premissas não verificadas

~~`⚠️ NÃO VERIFICADO`~~ Verificado na 4.0: o `getOutline()` acha a página de todo marcador, com destino direto e nomeado; a amostra fixa (`tools/demonstracao/amostra-de-capitulos.ts`, seis PDFs, lida com o pdfjs de verdade em `chapter-reader.test.ts`) tem 100% das páginas no capítulo certo.

## 13. Riscos técnicos

- **Backfill com todas as séries**: o 6º vê material do 9º até a correção; o resumo avisa
