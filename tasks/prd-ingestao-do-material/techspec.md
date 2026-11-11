# Tech Spec — Ingestão do material (F4)

**PRD:** `tasks/prd-ingestao-do-material/prd.md` (só os RF desta spec, pelo corte de 11/11/2026)
**Status:** rascunho

## 1. Resumo da abordagem

A extração vira o job `material.extrair-pdf` no `apps/worker`, fila `lote`, com o PDF no storage só até ela (45.0 e
46.0 em `tasks/prd-reengenharia/onda-3b.md`, "T5" e "O PDF no worker", com os nomes de depois da X8 e as mudanças da
seção 11). O worker grava páginas e capítulos numa transação. O material ganha séries, edição, a edição que substitui e
a licença registrada; a busca, uma só (`MaterialRepository.buscar`), filtra por série da turma e licença vigente na
hora da consulta. Sem chamada de modelo nova.

## 2. Módulos afetados

| Módulo | Novo ou alterado | O quê |
|---|---|---|
| `packages/core/src/material/` | novo | `PdfExtractor` (sai de `apps/api/src/material/`), capítulos, `chaveDoTemporario` |
| `packages/core/src/titular/file-storage.ts` | alterado | `guardarBytes`, `lerBytes` |
| `apps/worker/src/processors/` | novo | `extrair-pdf.ts` e a varredura `sistema.varrer-temporarios-de-material` |
| `apps/api/src/material/` | alterado | envio enfileira; séries; edição; licença (`licenca.*`); resumo; `extraction-queue.ts` e `varrerParados` saem |
| `apps/api/src/ops/`, `operacao/` | novo | os comandos da 46.0 |
| `apps/api/src/{artefato,assistente,tutor}` | alterado | busca com `serieId`; `SEM_MATERIAL_DA_SERIE`; `fontes` no artefato |
| `packages/shared` | alterado | contratos, os dois tipos de job, a matriz (`licenca`, `material.resumo`) |
| `apps/web/src/areas/coordenacao/` | alterado | Material, Licenças, o sino |
| `apps/web/src/components/ui/ai/`, `areas/professor/artefatos/` | alterado | chip e PDF pelas `fontes` |

## 3. Modelo de dados

Todas com `escola_id`; nenhuma varia por ano letivo, como o material e a série.

```
licenca_de_material  id uuid, escola_id, licenciante text(1-120), cobertura text(1-300),
                     referencia text(1-200), vigente_desde date, vigente_ate date null,
                     registrada_por uuid null, registrada_em, alterada_em
                     check vigente_ate is null or vigente_ate >= vigente_desde
material_serie       escola_id, material_id, serie_id; pk (escola_id, material_id, serie_id)
                     FK compostas (escola_id, material_id) on delete cascade, (escola_id, serie_id)
capitulo_do_material id, escola_id, material_id, ordem smallint, numero smallint null, titulo text(1-200),
                     pagina_inicial int, pagina_final int; unique (escola_id, material_id, ordem);
                     FK (escola_id, material_id) on delete cascade; check pagina_final >= pagina_inicial
material             + edicao text(1-60) null, + substitui_id uuid null, + substituido_por uuid null,
                     + licenca_id uuid null, + processado_em, + objeto_apagado_em (45.0)
                     check (titularidade = 'terceiro_com_licenca') = (licenca_id is not null)
                     FK (escola_id, licenca_id), (escola_id, substitui_id) sem ação
                     unique parcial material_uma_edicao_em_andamento (escola_id, substitui_id)
                       where estado = 'processando' and excluido_em is null
```

Migrations (regra 80, item 9): (1) colunas e tabelas, nulas; (2) o backfill, em lotes, sob `lock_timeout`:
cada material ganha todas as séries da escola, e cada `licenciante` distinto vira uma licença sem fim (`vigente_desde` =
o `enviado_em` mais antigo, `referencia` "registrada antes da F4"); (3) os checks, com `NOT VALID` e `VALIDATE`; (4) numa
tarefa posterior, `material.licenciante` sai, com os dois checks dele. Escola sem série cadastrada: o material fica sem
série, fora da busca, e o resumo o conta em `semSerie`.

## 4. API

| Método | Rota | Papel | Entrada | Saída |
|---|---|---|---|---|
| POST | `/v1/materiais` | coordenação | + `serieIds[]` (1 a 7), + `edicao?`, + `licencaId` (só terceiro; sai `licenciante`) | `Material` |
| POST | `/v1/materiais/:id/edicoes` | coordenação | multipart: `arquivo`, `edicao?`, `titulo?` | `Material` (a nova) |
| GET | `/v1/materiais`, `/:id` | coordenação, professor | + filtro `serieId` | + `serieIds`, `edicao`, `capitulos` (número, título, páginas), `licencaId`, `substitui` |
| GET | `/v1/materiais/resumo` | coordenação | — | por disciplina e série: `pronto`, `processando`, `falhou`, `semSerie`; por disciplina: `recusadosEm30Dias` |
| GET, POST | `/v1/licencas` | coordenação | licenciante, cobertura, referência, vigência | lista paginada com `materiais` (contagem) e `situacao` (`vigente`, `vence_em_30_dias`, `vencida`) |
| PATCH | `/v1/licencas/:id` | coordenação | vigência, cobertura, referência | `Licenca` |
| GET | `/v1/artefatos/:id` | professor | — | + `fontes`: por `materialId`, título, edição, `substituido` |

Erros novos: `EDICAO_EM_ANDAMENTO`, `LICENCA_VENCIDA`, `SEM_MATERIAL_DA_SERIE`; `MATERIAL_SEM_LICENCA` cobre terceiro sem
`licencaId`. A licença não se exclui: encerra-se pela data.

## 5. Fluxo

**Envio.** Os bytes vão ao storage antes do commit (storage fora: 503, nada gravado; commit que falha deixa órfão para
a varredura); a transação grava `material`, `material_serie`, a auditoria e o job pelo `JobOutbox` (chave = id do
material). Terceiro: a licença é lida com `for share` na transação e precisa estar vigente hoje, em São Paulo.

**Extração** (worker). `lerParaExtrair` com escopo, `lerBytes`, `PdfExtractor`, capítulos, e uma transação com a
transição `where estado = 'processando' and excluido_em is null`, os trechos, os capítulos e, se `substitui_id`, a
substituição: `update material set excluido_em = now(), substituido_por = :nova where id = :antiga and excluido_em is
null`, os trechos dela apagados e a auditoria `material.substituido`. Depois do commit, o objeto é apagado (45.0).

**Capítulos.** `getOutline()` do pdfjs, primeiro nível, com a página de destino; sem marcador, a linha `^(cap[ií]tulo|
unidade|m[óo]dulo)\s+(\d+)` nas três primeiras linhas da página; sem nenhum dos dois, nenhum capítulo ("sem capítulo").
Cada capítulo vai da sua página até a véspera do seguinte; o último, até o fim.

**Busca.** `PedidoDeTrechos` ganha `serieId` obrigatório; a consulta junta `material_serie` e a licença
(`vigente_ate is null or vigente_ate >= hoje`). Os três chamadores já têm a turma. Antes de chamar o modelo, `existeMaterialDaSerie(disciplinaId, serieId)`: sem material, a ferramenta e o chat
respondem `SEM_MATERIAL_DA_SERIE` e o Tutor, a mensagem fixa, sem execução.

## 6. Isolamento (obrigatório)

FK composta com a escola em toda referência: série, licença ou edição de outra escola não cabe na linha. O escopo vem
do contexto; no worker, da `job_registro.escola_id`. Os `@Unscoped` são os da 45.0 e da 46.0, só com `(escola_id, id)`.
Testes, cada um vermelho sem a cláusula de escopo:
`licencaId` da escola B no envio de A (404); `serieIds` de B; edição sobre material de B (404); `PATCH` e `GET` de
licença de B (404); `resumo` de A não conta material de B; busca de A com a série de B devolve vazio; `fontes` de
artefato não traz título de B; `lerParaExtrair` com id de B no contexto A (45.0).

## 7. Dado pessoal (obrigatório)

| Item | Resposta |
|---|---|
| Campos pessoais tocados | `licenciante` (pode ser pessoa) vai para `licenca_de_material`; `registrada_por` |
| Novos campos (atualizar `docs/lgpd.md`) | a linha do material (licença), a do PDF temporário (45.0) e as ações novas da auditoria |
| O que vai para log | ids, código da falha, contagens, duração; nunca título, licenciante nem texto |
| O que entra em auditoria | `licenca.registrada`, `licenca.alterada` (o antes e o depois da vigência, sem licenciante), `material.edicao_enviada`, `material.substituido`, `job.reprocessado`, `job.descartado` |
| O que é enviado a provedor externo | nada |
| Retenção e expurgo | licença: enquanto um material a citar, depois o `material_excluido`; edição substituída: `material_excluido`, da substituição; PDF: até a extração ou 25 h |
| Arquivo do titular | `licenca_de_material` entra no do coordenador que registrou, como `material` (id, cobertura, vigência, registrada_em); `licenciante` e `referencia` na lista `fora`; `material_serie` e `capitulo_do_material` sem pessoa, classificadas como tal |
| Autorização por objeto | células `licenca.*` e `material.resumo` só da coordenação (`unidade`); o professor lê material pelas disciplinas, como hoje; `fontes` só no artefato que ele alcança |
| DTO de saída | os da seção 4; `Licenca` traz o licenciante só à coordenação; nunca hash, chave de objeto nem quem enviou |

## 7b. Conformidade CNE

Sem IA nova. No caminho do aluno, só a busca do Tutor presa à série da turma.

## 7c. Carga e falha (obrigatório)

| Item | Resposta |
|---|---|
| Está no caminho quente? | fila (lote); a busca está no caminho do Tutor e da ferramenta |
| Carga na manhã de segunda | a busca ganha dois joins por índice que começa pela escola |
| Fila e prioridade | `lote`, `naoUrgente: false`, vaga por escola 1; a varredura, de hora em hora |
| Limite por escola | 120 envios por hora por escola e 30 por pessoa; 40 em processamento por escola; 20 MB por arquivo |
| Rate limit | envio e edição pelo `MaterialUploadGuard` de hoje (429 com `Retry-After`); o global (`configure-app.ts`) não muda |
| Corridas de concorrência | (1) duas edições sobre o mesmo material: o índice único parcial decide, `EDICAO_EM_ANDAMENTO` ao segundo; cenário com `WriteBlockTrigger` segurando a primeira, vermelho sem o índice. Arquivo igual ao da edição atual: o service confere o `sha256` antes e responde `CONFLITO`, sem depender da ordem do Postgres. (2) excluir a nova enquanto ela processa: a transição não pega, a antiga fica; vermelho sem `excluido_em is null`. (3) excluir a antiga enquanto a nova processa: a substituição não pega linha e a nova fica pronta sozinha. (4) job duas vezes: a transição só pega `processando` (D49) |
| Índices novos | `material_serie (escola_id, serie_id, material_id)`; `licenca_de_material (escola_id, vigente_ate)`; `auditoria (escola_id, em) where acao = 'material.recusado'` para o resumo; o parcial da 45.0 |
| Migration | expandir e contrair (seção 3) |
| Quando cada dependência cai | storage: envio com 503; Redis: o job espera no outbox; worker fora: `processando`, e o alerta `pdf-esperando` (10 min) |
| Métrica e alerta | duração da extração, idade do job por escola; alerta e runbook da 45.0 |
| Cenário de teste de carga | 300 PDFs do maior tamanho do seed com outra escola no Tutor; meta das 19h às 5h, uma réplica |

**Estados do material:**

| Estado | Entra | Sai | Prazo e queda |
|---|---|---|---|
| `processando` | envio, edição | `pronto` ou `falhou` | `TEMPO_ESGOTADO` na última tentativa: `falhou`; worker morto: stalled refaz, a reconciliação encerra |
| `pronto` | extração | exclusão, ou substituição (`excluido_em`, `substituido_por`) | — |
| `falhou` | extração, prazo, descarte (46.0) | "Tentar de novo" é envio novo | expurgo |

## 8. Uso de IA

Nenhuma chamada nova. A classificação pela BNCC é da F4b.

## 9. Frontend

- **Material** (Escola › Material): o resumo no topo; "Enviar materiais" com até 20 PDFs, disciplina, séries,
  titularidade e licença da lista; envia um por vez, com a situação de cada arquivo; `CONFLITO` vira "já enviado". O
  painel do material ganha séries, edição, capítulos e "Enviar nova edição"
- **Licenças**: aba nova em Escola › Material: situação, registrar, alterar vigência
- **Sino**: `licenca-vencendo` (30 dias antes, ou vencida com material)
- **Chip e PDF do artefato**: o título e a edição vêm das `fontes`; a edição substituída diz "edição anterior"

Nos projetos `chromebook` e `celular` (D51); altura da casca, como hoje. `docs/interface.md` muda na tarefa de cada tela.

## 10. Testes

| Camada | O que será testado |
|---|---|
| Unidade | capítulos (marcador, linha, nenhum); a licença na virada do dia em São Paulo; o sino |
| Integração | envio e recusas; edição antes e depois, falha da nova, corridas; busca por série e vigência; `SEM_MATERIAL_DA_SERIE` sem execução; resumo; `fontes`; a onda 3b |
| E2E | três PDFs com um repetido; registrar licença; nova edição, e o artefato antigo com a edição anterior |
| Isolamento | os da seção 6 |

Amostra fixa de capítulos: PDFs sintéticos de `tools/demonstracao` (marcador, linha, nada), com 100% das páginas no
capítulo certo: é regra, não modelo.

## 11. Conformidade com as regras

| Regra | Como é atendida | Desvio e justificativa | Documento que registra o desvio |
|---|---|---|---|
| 00, 10, 20, 80 | seções 5 a 7c | — | — |
| 45.0 | desenho da onda 3b | processador no `apps/worker`, não no `main-worker.ts` da API (que nasce na 47.0); o `substitui` da 41.0 não entra; `varrerParados` sai junto | esta Tech Spec, decisão do Joaquim em 11/11/2026 |

## 12. Premissas não verificadas

`⚠️ NÃO VERIFICADO`: que o `getOutline()` do `pdfjs-dist` instalado resolve a página de todo marcador (há destino
nomeado). Interface `LeitorDeCapitulos`, pelo pdfjs, com a falsa nos testes do processador.

## 13. Riscos técnicos

- **PDF pesado prende o worker de lote**: o cenário de carga mede; acima da meta, réplica `worker-pdf` (45.0)
- **Apostila sem marcador nem linha**: "sem capítulo"; a F4b classifica por bloco de páginas
- **Grafias diferentes do mesmo licenciante** viram licenças diferentes no backfill; a coordenação as vê em Licenças
