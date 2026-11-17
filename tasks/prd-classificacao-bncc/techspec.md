# Tech Spec — Classificação do material pela BNCC (F4b)

**PRD:** `prd.md` · **Cenários:** `cenarios.md`
**Status:** rascunho

Joaquim, 17/11/2026: classificação como rotina no `main-worker`, fila `lote`, sempre à noite; questão de capítulo sem
habilidade sai sem habilidade; componente da BNCC na disciplina.

## 1. Resumo da abordagem

A tabela pública `habilidade_bncc` vem do `bncc-dados`, numa versão fixa. O material ganha **seções** (capítulo, ou bloco
de 10 páginas), cada uma com habilidades. A extração cria as seções e agenda a classificação, que só corre à noite. A
geração usa as habilidades da seção da página citada, e o catálogo próprio sai.

## 2. Módulos afetados

| Módulo | O quê |
|---|---|
| `packages/core` (`bncc/`, `db/schema/`, `ia/`) | tabela BNCC e carga; seções; tarefa `classificar_secoes`; balde `lote` |
| `apps/api/src/ia/`, `material/`, `ops/`, `estrutura/disciplina/` | rotina no `main-worker`; seções, correção, reclassificação, cobertura; comando D76; componente |
| `apps/api/src/{artefato,atividade,governanca,tutor}` | geração pela seção; "sem habilidade"; troca |
| `apps/worker/src/processors/extrair-pdf.ts` | seções e agendamento na extração |
| `packages/shared`, `apps/web` | contratos, `FUNCOES`, job; sai `habilidades.ts`; as telas do §9 |

## 3. Modelo de dados

```
habilidade_bncc   codigo text pk, descricao text, etapa, componente text null (EF), area text null (EM),
                  anos smallint[] null (EF, só 6 a 9), versao text, localizador text   — pública, sem escola (regra 10, item 1)
                  check do formato: EF(06|07|08|09|67|69|89)[A-Z]{2}\d{2}, EM13(LGG|MAT|CNT|CHS)\d{3}, EM13LP\d{2}
disciplina        + componente_bncc text null (check na lista de `COMPONENTES_BNCC`)
secao_do_material id, escola_id, material_id, capitulo_id null, ordem smallint, pagina_inicial, pagina_final,
                  execucao_id uuid null, classificada_em null, corrigida_por uuid null, corrigida_em null
                  unique (escola_id, material_id, ordem); FK (escola_id, material_id) e (escola_id, capitulo_id) on delete cascade;
                  FK (escola_id, execucao_id); FK (escola_id, corrigida_por) on delete set null ("corrigida_por")
habilidade_da_secao escola_id, secao_id, codigo (FK habilidade_bncc), origem ('ia' | 'coordenacao')
                  pk (escola_id, secao_id, codigo); FK (escola_id, secao_id) on delete cascade
```

Sem ano letivo (PRD F4, §6). **Carga:** o JSON da release `dados-2026.08` do `bncc-dados` (CC BY 4.0), reduzido a código,
texto, componente, anos (6 a 9) e área, versionado no repositório com a atribuição; a migration faz `on conflict (codigo)
do update` e grava a versão. Código nunca sai: revisão da BNCC é carga nova. Sem Computação. **Componentes:**
`COMPONENTES_BNCC` em `packages/shared`, com as candidatas (EF: componente e anos das séries; EM: a área, e Língua
Portuguesa com `EM13LP` e `EM13LGG`); a migration preenche `componente_bncc` pelo nome (Química → Ciências da Natureza),
e o que não casa fica nulo.

**Migrations** (regra 80, item 9): (1) tabelas, coluna e carga; (2) seções dos materiais `pronto` existentes, em lotes,
sem execução (o comando da operação as classifica); (3) a **contração da F4** (abertura, item 4): o backfill de séries e
licenças de novo, idempotente; o check `(titularidade = 'terceiro_com_licenca') = (licenca_id is not null)` com
`NOT VALID` e `VALIDATE`; e a saída de `material.licenciante` e dos dois checks dele, depois do código que não o grava.

## 4. API

| Método | Rota | Papel | Entrada | Saída |
|---|---|---|---|---|
| GET | `/v1/materiais/:id` | coordenação, professor | — | + `secoes[]`: capítulo ou páginas, `situacao` (`aguardando`, `classificada`, `sem_habilidade`, `nao_classificada`), `habilidades[]` (`codigo`, `descricao`, `origem`), `corrigida` |
| PUT | `/v1/materiais/:id/secoes/:secaoId/habilidades` | coordenação | `codigos[]` (0 a 5, do recorte do material) | a seção |
| POST | `/v1/materiais/:id/reclassificar` | coordenação | — | `202` |
| GET | `/v1/habilidades-bncc` | coordenação, professor | `materialId` ou `turmaId` | as candidatas do recorte |
| GET | `/v1/materiais/cobertura` | coordenação | — | por série e componente (área, no EM): `semMaterial[]`, `total` |
| PATCH | `/v1/disciplinas/:id` | coordenação | + `componenteBncc` (nulo apaga) | `Disciplina` |
| PATCH | `/v1/artefatos/:id/questoes/:indice/habilidade` | professor | `codigo` | `Artefato` |

Objeto de outra escola: `NAO_ENCONTRADO`, como o inexistente. Código fora do recorte: `ENTRADA_INVALIDA`. Material não
`pronto` ou disciplina sem componente: `CONFLITO`. A troca só no original sem aplicação nem versão adaptada
(`CONFLITO`), com código do recorte da turma (RF9). `PUT`, reclassificar e troca têm o teto do `PATCH` da F4 (100/h por
pessoa, 300/h por escola).

## 5. Fluxo

**Seções.** Na transação da extração, depois dos capítulos: uma seção por capítulo, ou por bloco de 10 páginas; com
componente, nascem ali as execuções `classificar_secoes` (12 seções cada, `solicitada_por` nulo) e os jobs
`ia.executar-lote` (fila `lote`, `naoUrgente: true`, executor `api`, chave = execução), e cada seção guarda o
`execucao_id`. A edição nova não herda a correção da anterior (os capítulos mudam).

**Classificação** (`main-worker`, contexto da rotina: a escola do job, sem pessoa nem ano letivo). O `ExecucaoProcessor`
aceita `quemPediu` ausente só em comando `daRotina`; os outros seguem `NAO_ENCONTRADO`. A suspensão é conferida antes do
modelo. O `preparar` relê as seções com o material `pronto` e não excluído; a entrada leva, por seção, título, até 1.500
caracteres do começo e até 500 das linhas de subtítulo, delimitados como dado, com as candidatas no começo do prompt. A
saída dá de 0 a 3 códigos por seção; fora das candidatas, `IA_SAIDA_INVALIDA`. O `concluir` grava cada seção
`where execucao_id = :esta and corrigida_por is null`, com `for update`: correção e reclassificação mais nova vencem.

**Reclassificar** (RF12) e o comando da operação: cada seção não corrigida ganha execução nova e o `execucao_id` dela; a
antiga conclui sem efeito. O texto vem dos `trecho` gravados. **Correção** (RF6): `for update` na seção, troca as
habilidades (`origem: 'coordenacao'`) e grava `corrigida_por`; a IA não a toca mais.

**Geração** (RF7, RF2). A busca devolve, com cada trecho, as habilidades da seção da página. A tarefa escolhe, por
questão, uma das da página citada, ou nenhuma se não há; `habilidade` aceita `null`, e o plano, `habilidades` vazia. A
conferência de quem grava (como `exigirCitacoesEntregues`) recusa habilidade fora da seção citada. Sai o catálogo
(`habilidades.ts`, `habilidadesParaOTema`). A questão sem habilidade entra no `por_habilidade` com `codigo: null`:
"Sem habilidade" em Turmas, no aluno, no Tutor e no Analista. Seed e fixturas passam à BNCC; o que já está gravado com
código antigo fica (não há dado real).

**Cobertura** (RF19): as candidatas de cada série e componente menos as das seções do material que passa no filtro da F4
(`declaradoParaASerie`, `proprioOuComLicencaVigente`, `pronto`); `EF69LP01` conta em cada ano.

## 6. Isolamento (obrigatório)

FK composta com a escola; escopo do contexto em todo método (no worker, `job_registro.escola_id`). Testes efetivos sem a
cláusula: GET, `PUT` e reclassificar com material da B; cobertura sem o material da B; execução da A com seções da B
(nada gravado); troca em artefato da B; comando da operação só na escola dada.

## 7. Dado pessoal (obrigatório)

| Item | Resposta |
|---|---|
| Campos pessoais, novos (`docs/lgpd.md`) | `corrigida_por` (coordenador); as ações novas da auditoria |
| Log | ids, contagens, códigos de erro; nunca título, texto ou código escolhido |
| Auditoria | `material.classificacao_corrigida` (códigos antes e depois), `material.reclassificado`, `escola.reclassificada` (operação, com chamado), `artefato.habilidade_trocada` |
| Provedor externo | texto do material e lista BNCC, sem pessoa (regra 20, item 13) |
| Retenção | as seções saem com o material |
| Arquivo do titular | `corrigida_por` em `fora`, como `registrada_por` na F4 |
| Autorização, DTO | alcance do material da F4; troca só do dono; sem `corrigida_por` nem `execucao_id` |

## 7b. Conformidade CNE

A classificação alimenta o diagnóstico por habilidade (alto risco, regra 70, item 6a). Função nova
`classificacao_do_material` do Assistente de ensino, autonomia 1 ("classifica cada capítulo pela BNCC; a coordenação
corrige, e a correção vence"), alto risco, suspensível; os checks de `execucao_agente` e `consumo_ia` a recebem. A
aprovação humana segue na atividade: o professor vê e troca a habilidade antes de aplicar. **A AIA
`docs/aia/diagnostico-por-habilidade.md` é revista na tarefa que cria a função**, antes da que troca o catálogo.

Classificação de texto: (a) **lote retido** em `docs/aia/ouro-retido/`, 30 seções sintéticas com as habilidades de
referência, escrito em contexto limpo antes do prompt e nunca lido por quem o escreve; (b) sem padrão de texto: o modelo
decide, preso às candidatas; (c) a sonda de seções novas é do `test-engineer`, na revisão. **Taxa mínima:** ≥ 90 % das seções com um código da referência e ≥ 80 % dos códigos
propostos aceitáveis, na pior de três execuções do modelo local (`tools/ia/medir-classificacao.ts`, fora do portão; o
teste dela usa o `ScriptedAdapter`). Sem isso no `rapido`, vai a `padrao`.

## 7c. Carga e falha (obrigatório)

| Item | Resposta |
|---|---|
| Está no caminho quente? | a leitura da seção da página, na geração |
| Carga na manhã de segunda | sem IA (a `lote` não corre no horário letivo); a geração soma um join por índice |
| Fila e prioridade | `lote`, `naoUrgente`; pool `lote` no `worker-ia` (2 por réplica); a varredura de execuções inclui a `lote` |
| Limite por escola | vaga `lote`; balde de tokens `lote` (5 % do contratado) |
| Rate limit | §4 (429 com `Retry-After`) |
| Corridas de concorrência | correção × execução (trava da seção); reclassificar × execução (`execucao_id`); dois reclassificar; edição nova × execução (conclui sem efeito). Ordens em `cenarios.md` |
| Laços e ritmo | nenhum novo |
| Índices novos | `secao_do_material (escola_id, material_id, pagina_inicial)`; `habilidade_da_secao (escola_id, codigo)`; parcial `(escola_id, execucao_id)` |
| Migration | expandir e contrair; a contração da F4 por último |
| Quando cada dependência cai | provedor: seções "não classificadas", com "Reclassificar"; Redis: outbox |
| Métrica e alerta | as da X6, por tarefa |
| Cenário de teste de carga | 300 materiais de ~25 capítulos numa noite, adaptador falso, Tutor da B medido |

**Estados da seção** (derivados da execução, sem estado gravado a mais). `aguardando` (execução `pendente` ou `rodando`)
vai a `classificada` ou `sem_habilidade` pelo `concluir` dela; execução `falhou` (provedor, prazo, suspensão, varredura)
dá `nao_classificada`, até reclassificar. `corrigida` é final para a IA.

## 8. Uso de IA

| Caso de uso | Perfil | Entrada | Saída | Validação | Aprovação humana |
|---|---|---|---|---|---|
| `classificar_secoes` | `rapido` | até 12 seções + candidatas (~12 mil tokens) | 0 a 3 códigos por seção | schema e candidatas | a correção da coordenação; a atividade aplicada pelo professor |

Custo (`llm-integrator`): onboarding de 300 apostilas, ~7 milhões de tokens, R$ 4 a 20 por escola conforme o modelo;
menos de R$ 0,01 por aluno por mês. Fora do pacote do Tutor (D38), em `consumo_ia` com a função própria. Prompt em
`packages/core/src/ia/prompts/classificar-secoes.ts`.

## 9. Frontend

| Tela | Mostra ou faz | De onde vem (§4) |
|---|---|---|
| Estrutura, disciplina | componente | `PATCH /v1/disciplinas/:id` |
| Painel do material | habilidades e situação por seção; corrigir; reclassificar; "classificação hoje à noite"; aviso sem componente | `GET /:id`, `GET /v1/habilidades-bncc`, `PUT`, `POST /reclassificar` |
| Material, cobertura | o que falta por série e componente | `GET /cobertura` |
| Artefato do professor | habilidade da questão; trocar | `GET /v1/artefatos/:id`, `GET /v1/habilidades-bncc`, `PATCH` |
| Turmas, aluno, Analista | "Sem habilidade" | leituras de hoje |

O professor vê a classificação na questão do artefato, sem tela de material (D73). Textos em `cenarios.md`; peças em
`docs/interface.md`.

## 10. Testes

Em `cenarios.md`.

## 11. Conformidade com as regras

| Regra | Desvio e justificativa |
|---|---|
| 00, 20, 70, 80 | nenhum |
| 10, item 1 | `habilidade_bncc` sem escola: tabela pública sem dono |
| 30, item 8 | consumo por escola e função, sem teto por escola: o contrato não o tem (`OrcamentoRepository`) |

## 12. Premissas não verificadas

- ⚠️ NÃO VERIFICADO: a origem do `bncc-dados` no MEC e a versão do PDF. A tarefa da carga confere 30 habilidades (3 por
  componente do EF, uma por bloco, 4 por área do EM) e as contagens (183 no EM) contra o PDF homologado, com o hash dele.
  O PDF vence.
- ⚠️ NÃO VERIFICADO: os blocos de Arte, Educação Física e Ensino Religioso (o check os aceita); o art. 8º, IV, da Lei
  9.610 e o envio do material ao provedor (advogado, PRD F4, §10).

## 13. Riscos técnicos

- **Classificador fraco:** a taxa do §7b e a correção.
- **Correção perdida na edição nova:** se pesar, herdar pelo capítulo.
