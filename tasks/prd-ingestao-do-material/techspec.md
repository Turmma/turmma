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
| GET | `/v1/artefatos/:id` | professor | — | + `fontes`: título, edição, `substituido`; sem a linha, "material da escola" |

`serieIds` ou `licencaId` de outra escola: `NAO_ENCONTRADO`, como o inexistente. Erros novos: `EDICAO_EM_ANDAMENTO`,
`LICENCA_VENCIDA`, `SEM_MATERIAL_DA_SERIE`. A licença não se exclui. Os `PATCH` leem a linha `for update`; o de material
excluído ou de outra escola dá `NAO_ENCONTRADO`, e o que é ou tem edição em `processando`, `EDICAO_EM_ANDAMENTO`.

## 5. Fluxo

**Envio e edição.** (1) Antes de ler o arquivo: alvo da edição (fora da escola ou inexistente: `NAO_ENCONTRADO`, antes
de tudo), tetos, licença (da escola, vigente) e séries (da escola); a recusa grava `material.recusado`, só com séries
conferidas, fora de transação. (2) Id da aplicação (UUIDv7); linha em `envio_de_material`; bytes ao storage, com prazo.
(3) A transação toma a trava de envios da escola, como hoje, e reconfere tetos e licença (`for share`; a recusa também
grava `material.recusado`); na edição, lê o alvo com `where escola_id = :ctx and id = :alvo and estado = 'pronto' and
excluido_em is null for update` (sem linha: `EDICAO_EM_ANDAMENTO` ou `NAO_ENCONTRADO`) e herda
as séries lidas ali; grava material, séries, auditoria e o job (chave = id), e apaga a linha de `envio_de_material`,
que precisa existir (sob `lock_timeout` curto), ou desfaz com 503. (4) Falha do próprio `guardarBytes`: tenta apagar o objeto e a linha fica
(o PUT atrasado pode gravar). Falha depois: o objeto sai primeiro (ausente conta), a linha só depois; se o
apagar falha, a linha fica. A varredura horária, depois de 1 h, trava a linha (`for update skip locked`), na mesma ordem, com prazo curto no `apagar`.

**Extração** (worker, na escola do job). A transição `where escola_id = :escola and id = :id and estado = 'processando'
and excluido_em is null` abre a
transação; sem linha, o job conclui sem efeito. Seguem trechos, capítulos e, com `substitui_id`, `update material set
excluido_em = now(), substituido_por = :nova where escola_id = :escola and id = :antiga and excluido_em is null`, os
trechos da antiga apagados e `material.substituido`. Depois do commit, o objeto é apagado.
`sem_texto`, `arquivo_invalido` e o objeto ausente (`extracao_falhou`: sem valor novo, pelo rollback) são falha definitiva, pela transição de sempre; objeto ausente de material que já saiu de
`processando` conclui sem efeito.

**Capítulos** (`ChapterReader`). O marcador de primeiro nível, um por página; sem marcador, a linha
`^(cap[ií]tulo|unidade|m[óo]dulo)\s+(\d+)` no topo da página quando o número muda, fora do sumário. Bordas em
`cenarios.md`; erro dá zero capítulos, sem falhar.

**Leitura de página.** Série e "hoje" (`Clock`, São Paulo) entram em `buscar`, `paginasDoMaterial`,
`materialDaTurma` e na rota `GET /v1/materiais/busca` (com `serieId`, que filtra e não autoriza): `pronto`, não
excluído, com a série, e próprio **ou** de licença com `vigente_desde <= hoje` e `vigente_ate` nula ou `>= hoje`; o
mesmo em `existeMaterialDaSerie`. Ferramenta e chat conferem antes do `202` (`SEM_MATERIAL_DA_SERIE`, sem execução nem
orçamento). O Tutor resolve turma e atividade, roda a D36 (intacta, `materialId` nulo) e só **depois**
filtra o material aberto e confere a série: recusa sem nada na conversa; a tela do aluno mostra um estado. O modo
livre não muda.

## 6. Isolamento (obrigatório)

FK composta com a escola em toda referência; escopo do contexto (no worker, `job_registro.escola_id`) em toda
consulta, inclusive `for update` e `for share`. `@Unscoped`: os da 45.0 e da 46.0, e a leitura de `envio_de_material`
pela varredura (só escola e id).

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
| Fila e prioridade | fila `pdf` (checks de fila e `vagas` ampliados com `NOT VALID`/`VALIDATE`); `worker-pdf` com um PDF por vez e `cpus` limitado; `prazoMs` 10 min, 3 tentativas; varredura em `lote`, horária |
| Limite por escola | vaga `pdf` por escola 2 (`VAGAS_ESCOLA_PDF`, sobreposta por `configuracao_operacional_escola.vagas`); 100 envios por hora por pessoa, 300 por escola; 300 pendentes por escola; 20 MB por arquivo |
| Rate limit | `MaterialUploadGuard` (429, `Retry-After`) no envio e na edição; o `PATCH` à parte, 100 por hora por pessoa e 300 por escola |
| Corridas de concorrência | `cenarios.md` |
| Índices novos | `material_serie (escola_id, serie_id, material_id)`; `licenca_de_material (escola_id, vigente_ate)`; `auditoria (escola_id, em) where acao = 'material.recusado'`, sem `concurrently` (exceção da 0034); o parcial da 45.0 |
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
| 3.0 | auditoria do job sem escola | o `job_registro` de `sistema.*` não tem escola, e o check `auditoria_escola_ou_operacao_global` só aceita sem escola `rede` e `suboperador`: a entidade `job` entra nele e em `ENTIDADES_DE_AUDITORIA_SEM_ESCOLA`, só com `autor_operador`, e o job de escola é auditado na escola da linha (nunca sem escola). Como é migration e a 3.0 corre junto da 2.0 e da 4.0, o check vai na migration da 5.0, que corre sozinha; até lá os dois comandos recusam o job sem escola, antes de tocar a linha, e a 5.0 tira a recusa. Na mesma 5.0, o expurgo de jobs deixa o `falhou` de `material.extrair-pdf` como deixa o de `titular.*`, até a ação do operador: sem isso, 30 dias depois a linha sai, o Descartar não acha o job e o material fica `processando` com o PDF para sempre; o prazo da tela de Retenção (`tarefa_em_segundo_plano`) e o `docs/lgpd.md` dizem o mesmo | esta Tech Spec (Arquiteto, divergência da 3.0, 11/11/2026) |
| RF11 | as `fontes` | depois do expurgo da linha, a fonte vira "material da escola" | esta Tech Spec |
| RF6 | `PATCH` de séries | a de série fica na F4 (o backfill precisa); a de habilidade, na F4b | esta Tech Spec |
| RF8 | a recusa | o Tutor sem material vira um estado da tela, sem fala da IA | esta Tech Spec |

## 12. Premissas não verificadas

`⚠️ NÃO VERIFICADO`: o `getOutline()` acha a página de todo marcador; a amostra prova.

## 13. Riscos técnicos

- **Backfill com todas as séries**: o 6º vê material do 9º até a correção; o resumo avisa
