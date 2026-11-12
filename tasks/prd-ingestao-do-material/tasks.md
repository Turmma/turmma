# Tarefas — ingestao-do-material (F4)

**PRD:** `prd.md` · **Tech Spec:** `techspec.md` · **Cenários:** `cenarios.md`
<!-- Quantas estão concluídas não se escreve aqui: `node tools/processo/estado.ts` conta pela lista. -->

## Lista

- [x] **1.0 — O PDF é extraído no worker, na fila `pdf`, e o objeto sai do storage em todo caminho da 45.0**
  - [x] 1.1 `PdfExtractor` e o repository da extração em `packages/core/src/material/`; `guardarBytes` e `lerBytes`
  - [x] 1.2 Migration: `processado_em`, `objeto_apagado_em`; os checks de fila e de `vagas` aceitam `pdf`
  - [x] 1.3 Fila `pdf` (vaga 2 por escola, `lockDuration`, stalled), job `material.extrair-pdf`, réplica `worker-pdf`
  - [x] 1.4 Processador: transição com escopo, falhas definitivas, objeto apagado depois do commit
  - [x] 1.5 O envio enfileira; exclusão e expurgo apagam o objeto; métrica, log e documentos
  - [x] 1.6 Testes: a tabela "3. Falha" da onda 3b, as corridas de dois jobs, a vaga, isolamento

- [ ] **2.0 — Nenhum PDF fica para trás: `envio_de_material`, objeto antes da linha, varredura horária**
  - [ ] 2.1 Migration de `envio_de_material`
  - [ ] 2.2 A linha antes do `guardarBytes`, apagada na transação; o `catch` na ordem da §5 (4)
  - [ ] 2.3 Varredura horária do envio sem commit e do órfão pós-commit (25 h)
  - [ ] 2.4 Testes: toda saída depois do `guardarBytes`, a varredura contra o envio lento, duas escolas

- [x] **3.0 — A operação lista, reprocessa e descarta job (46.0), e o alerta `pdf-parado` avisa**
  - [ ] 3.1 `ops:jobs` listar, reprocessar e descartar, com chamado e auditoria
  - [ ] 3.2 Alerta `pdf-parado`, no ensaio; runbook e disco do temporário em `docs/infra.md`
  - [ ] 3.3 Testes: os comandos, as recusas, o alerta termo a termo

- [ ] **4.0 — Os capítulos lidos do PDF chegam no `GET /v1/materiais/:id`**
  - [ ] 4.1 Migration de `capitulo_do_material`
  - [ ] 4.2 `ChapterReader` e a gravação na transação da extração
  - [ ] 4.3 `capitulos` no contrato
  - [ ] 4.4 Testes: as bordas do leitor, a amostra com o pdfjs, dois jobs

- [ ] **5.0 — A licença é registrada uma vez, com vigência, retenção e arquivo do titular**
  - [ ] 5.1 Migration de `licenca_de_material` e `material.licenca_id`, com o backfill
  - [ ] 5.2 `GET`, `POST`, `PATCH /v1/licencas`, com auditoria e `situacao`
  - [ ] 5.3 Retenção, classificação, arquivo do titular; documentos
  - [ ] 5.4 Testes: situação, isolamento, dois `PATCH`, a retenção segurada
  - [ ] 5.5 O job sem escola na auditoria (check e `ENTIDADES_DE_AUDITORIA_SEM_ESCOLA`), sem a recusa da 3.0; o `falhou` de `material.extrair-pdf` fora do expurgo até o Descartar

- [ ] **6.0 — A aba Licenças e o aviso `licenca-vencendo` no sino**
  - [ ] 6.1 Aba Licenças: lista, registrar, vigência
  - [ ] 6.2 O sexto tipo do sino
  - [ ] 6.3 Testes: os quatro estados, as datas, os dias do sino

- [ ] **7.0 — A coordenação envia até 20 PDFs de uma vez, com séries e licença**
  - [ ] 7.1 Migration de `material_serie`, com o backfill
  - [ ] 7.2 `serieIds` e `licencaId` no envio, conferidos antes de ler e de novo na transação; `serieId` na lista
  - [ ] 7.3 Diálogo de envio em lote, com o 429 e a retomada
  - [ ] 7.4 Testes: validação, isolamento, o `for share`, o lote, o fim a fim

- [ ] **8.0 — A edição nova substitui a anterior só quando fica pronta**
  - [ ] 8.1 Migration de `edicao`, `substitui_id`, `substituido_por` e do índice parcial
  - [ ] 8.2 `POST /v1/materiais/:id/edicoes`, com a herança lida sob `for update`
  - [ ] 8.3 A substituição na transação da extração
  - [ ] 8.4 "Voltar o código depois da F4" no runbook, com o teste do schema congelado
  - [ ] 8.5 Testes: os momentos do RF10 e as corridas

- [ ] **9.0 — Toda leitura de página filtra por série e licença vigente; sem material, ninguém gera**
  - [ ] 9.1 Série e "hoje" nas quatro leituras e na rota de busca
  - [ ] 9.2 `SEM_MATERIAL_DA_SERIE` antes do `202`; no Tutor, depois da D36
  - [ ] 9.3 O estado do aluno sem material
  - [ ] 9.4 Carga das 300 apostilas
  - [ ] 9.5 Testes: um caso por chamador, a vigência no relógio, a D36 antes, a carga

- [ ] **10.0 — O chip e o PDF do artefato dizem título, edição e "edição anterior"**
  - [ ] 10.1 `fontes` no `GET /v1/artefatos/:id`
  - [ ] 10.2 Chip e PDF do artefato
  - [ ] 10.3 Testes: substituído, licença vencida, expurgo, os estados do chip

- [ ] **11.0 — O resumo no topo da aba Material**
  - [ ] 11.1 `GET /v1/materiais/resumo`, com o índice da auditoria
  - [ ] 11.2 O resumo na tela
  - [ ] 11.3 Testes: as contagens, os estados

- [ ] **12.0 — O painel do material mostra os capítulos, corrige séries e título e recebe a edição nova**
  - [ ] 12.1 `PATCH /v1/materiais/:id`, com o teto próprio
  - [ ] 12.2 Painel: capítulos, séries e título, edição nova
  - [ ] 12.3 Testes: as corridas do `PATCH` com a edição, os textos, o fim a fim

## Dependências e paralelismo

Migration, schema e `packages/shared` não correm juntas: 1.0, 2.0, 4.0, 5.0, 7.0, 8.0, 9.0, 10.0, 11.0 e 12.0 vão uma
de cada vez, nesta ordem. A 3.0 não tem migration nem mexe em `packages/shared` (com a 5.0, divide `auditoria/acoes.ts`); a 6.0 só mexe em `apps/web`.

| Tarefa | Depende de | Pode correr em paralelo com |
|---|---|---|
| 1.0 | — | — |
| 2.0 | 1.0 | 3.0 |
| 3.0 | 1.0 | 2.0, 4.0, 6.0 |
| 4.0 | 1.0 | 3.0, 6.0 |
| 5.0 | 1.0, 3.0 | — |
| 6.0 | 5.0 | 3.0, 4.0 |
| 7.0 | 2.0, 6.0 | — |
| 8.0 | 7.0 | — |
| 9.0 | 8.0 | — |
| 10.0 | 9.0 | — |
| 11.0 | 7.0 | — |
| 12.0 | 4.0, 8.0, 11.0 | — |

A carga das 300 apostilas fica na 9.0: o envio já tem séries e licença, e a leitura do Tutor que ela mede já mudou
(aviso do `test-engineer` na revisão da spec). O envio muda de contrato e de tela na mesma tarefa (7.0), para a tela de
hoje não quebrar no meio; o `PATCH` vai com o painel (12.0), porque a recusa dele depende da edição (8.0).

## Subagentes por tarefa

`test-engineer` e `revisor-geral` em todas.

| Tarefa | Subagentes obrigatórios | Porte |
|---|---|---|
| 1.0 | `tenancy-guardian`, `privacy-guardian`, `infra-guardian` | grande |
| 2.0 | `tenancy-guardian`, `privacy-guardian`, `infra-guardian` | grande |
| 3.0 | `tenancy-guardian`, `privacy-guardian`, `infra-guardian` | grande |
| 4.0 | `tenancy-guardian` | pequeno |
| 5.0 | `tenancy-guardian`, `privacy-guardian`, `infra-guardian` | grande |
| 6.0 | `privacy-guardian`, `frontend-reviewer` | pequeno |
| 7.0 | `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `frontend-reviewer` | grande |
| 8.0 | `tenancy-guardian`, `privacy-guardian`, `infra-guardian` | grande |
| 9.0 | `tenancy-guardian`, `conformidade-reviewer`, `infra-guardian`, `frontend-reviewer` | grande |
| 10.0 | `tenancy-guardian`, `privacy-guardian`, `frontend-reviewer` | pequeno |
| 11.0 | `tenancy-guardian`, `frontend-reviewer` | pequeno |
| 12.0 | `tenancy-guardian`, `infra-guardian`, `frontend-reviewer` | grande |

## Critério de pronto da funcionalidade

Do `ROADMAP.md`, F4, com o corte de 11/11/2026 (a classificação pela BNCC é da F4b):

- O PDF é lido no worker e apagado do storage em todo caminho: sucesso, falha, exclusão, e a queda em até 25 h (RF13);
  a operação lista, reprocessa e descarta job (46.0)
- Cada material tem séries, capítulos, edição e licença; a coordenação corrige séries e título (RF3, RF4, RF6, RF10, RF16)
- Toda leitura de página (ferramentas, chat, Tutor, página aberta, material do aluno, busca) só alcança material
  `pronto` da série da turma, próprio ou de licença vigente hoje; sem ele, nada é gerado, e no Tutor a D36 vem antes
  (RF7, RF8, RF17)
- A edição nova só tira a anterior da busca quando fica pronta, e o artefato antigo continua citando a que usou (RF10, RF11)
- Até 20 PDFs por envio; 300 apostilas prontas numa noite sem atrasar o Tutor, com a corrida da carga registrada
  (RF14, RF15)
- O resumo no topo da aba Material, a aba Licenças e o aviso no sino (RF16, RF18)
- Nada de uma escola aparece para outra, com teste de isolamento por endpoint e repository (RF20)
- `docs/lgpd.md`, `docs/modelo-de-dados.md`, `docs/runbook.md`, `docs/infra.md`, `docs/interface.md` e
  `docs/regulacao.md` atualizados nas tarefas que os mudam
- O passo 1 do `docs/roteiro-da-demonstracao.md` (o material com licença) conferido contra
  `e2e/roteiro-da-demonstracao.spec.ts` na 7.0, que muda a tela
