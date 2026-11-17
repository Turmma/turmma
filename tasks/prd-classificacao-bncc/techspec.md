# Tech Spec — Classificação do material pela BNCC (F4b)

**PRD:** `prd.md` · **Cenários:** `cenarios.md`
**Status:** rascunho · **Teto:** 2.800 palavras e 13 tarefas (Joaquim, 17/11/2026: uma spec só)

Joaquim, 17/11/2026: rotina no `main-worker`, fila `lote`, à noite; capítulo sem habilidade dá questão sem habilidade;
componente na disciplina; professor confere o lote retido antes do primeiro aluno real.

## 1. Resumo da abordagem

A tabela pública `habilidade_bncc` vem do `bncc-dados`, numa versão fixa. O material ganha **seções** (capítulo, ou bloco
de 10 páginas; na tela, "Capítulo N" ou "Páginas X a Y"), cada uma com habilidades, classificadas à noite. A geração usa
as da seção da página citada, e o catálogo próprio sai.

## 2. Módulos afetados

`packages/core` (`bncc/`, `db/schema/`, `ia/`); `apps/api/src/` (`ia`, `material`, `ops`, `estrutura`, `artefato`,
`atividade`, `governanca`, `tutor`); `apps/worker` (extração); `packages/shared` (sai `habilidades.ts`); `apps/web`.

## 3. Modelo de dados

```
habilidade_bncc   codigo text pk, descricao, etapa, componente null (EF), area null (EM), anos smallint[] null (6 a 9),
                  versao, localizador                     — pública, sem escola (regra 10, item 1)
                  check: EF(06|07|08|09|67|69|89)[A-Z]{2}\d{2} | EM13(LGG|MAT|CNT|CHS)\d{3} | EM13LP\d{2}
disciplina        + componente_bncc text null (check: `COMPONENTES_BNCC`)
capitulo_do_material + unique (escola_id, id)
secao_do_material id uuid pk default uuidv7(), escola_id, material_id, capitulo_id null, ordem smallint,
                  pagina_inicial, pagina_final, execucao_id null, falhas_seguidas smallint not null default 0, classificada_em null, corrigida_em null,
                  corrigida_por null
                  unique (escola_id, id), (escola_id, material_id, ordem); FK (escola_id, material_id), (escola_id, capitulo_id)
                  on delete cascade; FK (escola_id, execucao_id); FK (escola_id, corrigida_por) on delete set null ("corrigida_por")
habilidade_da_secao escola_id, secao_id, codigo (FK habilidade_bncc), origem ('ia' | 'coordenacao')
                  pk (escola_id, secao_id, codigo); FK (escola_id, secao_id) on delete cascade
execucao_agente   ano_letivo_id passa a aceitar nulo, só em `classificar_secoes` (check)
```

**A marca da correção é `corrigida_em`** (a eliminação do titular não a toca); `corrigida_por` é só autoria. O material
não tem ano (PRD F4, §6), nem a execução da classificação; a virada não a afeta.

**Carga:** o JSON da release `dados-2026.08` do `bncc-dados` (CC BY 4.0), reduzido a código, texto, componente, anos
(6 a 9) e área, versionado com a atribuição; `on conflict (codigo) do update`, com a versão. Código nunca sai. Sem
Computação (a D65 fica no `TODO.md`). **Componentes:** `COMPONENTES_BNCC` em `packages/shared` diz as candidatas (EF:
componente e anos das séries; EM: a área, e Língua Portuguesa com `EM13LP` e `EM13LGG`; série do EF e do EM no mesmo
material: a união). A migration preenche o componente pelo nome sem acento nem caixa; o que não casa fica nulo. A disciplina criada depois
casa igual (`DisciplinaRepository.criar`); renomear não o muda.

**Migrations** (regra 80, item 9, todas com `lock_timeout`): (1) tabelas, coluna, carga, o `unique` do capítulo;
`execucao_agente.ano_letivo_id drop not null` (metadado); o check novo do ano e os de função e tarefa de
`execucao_agente` e `consumo_ia` entram por `ADD … NOT VALID` e `VALIDATE` (como a `0036`), antes do código que grava a
função; (2) seções dos materiais `pronto` existentes, em lotes de 1.000, sem execução (a rotina das 19h as agenda);
(3) **contração da F4** (abertura, item 4), em três passos: nesta spec, o backfill de séries e licenças de novo
(idempotente), o check `(titularidade = 'terceiro_com_licenca') = (licenca_id is not null)` com `NOT VALID` e `VALIDATE`,
a saída dos dois checks de `licenciante` e o código que não lê nem grava a coluna (fora do schema Drizzle); o
`DROP COLUMN` vai ao `TODO.md`, para o deploy seguinte.

## 4. API

| Método | Rota | Papel | Entrada | Saída |
|---|---|---|---|---|
| GET | `/v1/materiais/:id` | coordenação, professor | — | + `secoes[]`: capítulo ou páginas, `situacao`, `habilidades[]` (`codigo`, `descricao`, `origem`), `corrigida`; + `classificacaoSuspensa` |
| PUT | `/v1/materiais/:id/secoes/:secaoId/habilidades` | coordenação | `codigos[]` (0 a 5, sem repetir) | a seção |
| POST | `/v1/materiais/:id/reclassificar` | coordenação | — | `202`, com quantas seções e quantas preservadas |
| GET | `/v1/habilidades-bncc` | coordenação, professor | `materialId` ou `artefatoId` | as candidatas do recorte (até ~200) |
| GET | `/v1/materiais/cobertura` | coordenação | `serieId` | por componente (área, no EM): `semMaterial[]`, `total`, `secoesSemClassificacao` |
| PATCH | `/v1/disciplinas/:id` | coordenação | + `componenteBncc` (nulo apaga) | `Disciplina` |
| PATCH | `/v1/artefatos/:id/questoes/:indice/habilidade` | professor | `codigo` ou `null` | `Artefato` |

**Ordem das respostas:** primeiro o objeto no alcance (material da F4; `artefatoId` só do dono; série da escola), senão
`NAO_ENCONTRADO`, igual ao inexistente; depois `ENTRADA_INVALIDA` (código fora do recorte atual); depois `CONFLITO`
(material não `pronto`, disciplina sem componente, artefato aplicado ou com versão adaptada) e `FUNCAO_SUSPENSA`
(reclassificar suspenso). Sem componente, `GET /v1/habilidades-bncc` devolve lista vazia com `semComponente`, e a
troca só aceita `null`. `/cobertura` vem antes de `:id`. Tetos por pessoa e escola (429, `Retry-After`): `PUT` 300/h e
900/h, reclassificar e troca 100/h e 300/h, contados na auditoria. A rede não alcança nada disto.

## 5. Fluxo

**Seções.** Na transação da extração, depois dos capítulos (só quem fez a transição para `pronto`, então a reentrega
não duplica): uma seção por capítulo, ou por bloco de 10 páginas; páginas antes do primeiro capítulo ficam sem seção.
Com componente e a função ativa, nascem ali as execuções `classificar_secoes` (12 seções cada, sem pessoa nem ano) e os jobs `ia.executar-lote` (fila `lote`, `naoUrgente: true`, executor `api`, chave = execução); cada seção
guarda o `execucao_id`. **Edição nova:** a seção cujo capítulo tem o mesmo número e título (sem acento nem caixa) de uma
seção corrigida da anterior herda as habilidades e `corrigida_em` (sem `corrigida_por`), com
`material.classificacao_herdada` na auditoria; as outras vão à IA.

**Agendar** (job `material.agendar-classificacao`, fila `lote`, `naoUrgente`, por escola, lotes de 500 seções; seção
com `falhas_seguidas > 0` vai numa execução só dela). (a) **A rotina das 19h** pega a seção não corrigida de material `pronto` com
componente **sem execução, ou com a última `falhou` e `falhas_seguidas < 3`**; nunca `classificada` nem `sem_habilidade`.
(b) **A mudança de recorte** (`PATCH` do componente ou de séries) só enfileira o job do material ou disciplina (chave com
a auditoria do `PATCH`); ele lê o recorte atual, **limpa** as não corrigidas e, com componente, agenda. **Limpar:** lê a
seção `for update`, anula o `execucao_id`, apaga as `origem: 'ia'` e zera `falhas_seguidas` (P10). Função suspensa: limpa e não agenda. Agendar troca o `execucao_id` com a mesma
condição (P9). As candidatas são lidas no `preparar`; sem candidatas, conclui sem modelo e limpa as seções com
`execucao_id = :esta` (P11).

**Classificação** (`main-worker`, contexto da rotina: a escola do job, sem pessoa nem ano). O `ExecucaoProcessor` aceita
`quemPediu` ausente só em comando `daRotina` (extração, rotina, reclassificar, D76), que lê a execução sem ano. Antes de
`rodando`, confere a janela letiva (dentro dela, adia até o fim, motivo `janela`, com jitter) e a suspensão. O `preparar` lê só as seções
vivas (`execucao_id = :esta`, `corrigida_em` nulo, material `pronto` e não excluído); sem nenhuma, conclui sem modelo e
sem consumo. A entrada leva, por seção, título, até 1.500 caracteres do começo e até 500 das linhas de subtítulo,
delimitados como dado, com as candidatas no começo; saída de 0 a 3 códigos por seção, teto de 800 tokens; fora das
candidatas ou do formato, `IA_SAIDA_INVALIDA`. O `concluir` relê o material `for share` (`pronto`, não excluído) e grava
cada seção `where execucao_id = :esta and corrigida_em is null`, `for update`, zerando `falhas_seguidas`; senão conclui
sem efeito.

**Degradação do lote.** `classificar_secoes` entra em `TAREFAS_SEM_MODELO_MENOR`: nunca desce a modelo sem medida.
Balde `lote` cheio, disjuntor aberto ou provedor fora (`IA_INDISPONIVEL` transitório): a execução volta a `pendente` e o
job é adiado (`JobAdiadoError`, motivo `provedor`, `baseMs` do balde ou do disjuntor, com jitter), sem tentativa; consumo
só se uma chamada saiu. O adiamento que cai na janela letiva é segurado pela conferência acima. Termina `falhou` o erro
definitivo (`IA_SAIDA_INVALIDA`, `EXECUCAO_INTERROMPIDA`, `FUNCAO_SUSPENSA`, recusa de soberania); só `IA_SAIDA_INVALIDA`
soma 1 em `falhas_seguidas` das seções da execução (`execucao_id = :esta`), na transação da passagem a `falhou`. Com 3, a seção espera o reclassificar.

**Reclassificar** (RF12) e o comando D76 (`reclassificar-escola`, com chamado, em lotes de 500): as seções não corrigidas e
sem execução `pendente` ganham execução nova (`solicitada_por` nulo, `falhas_seguidas` zerada); a antiga conclui sem
efeito. O texto vem dos `trecho`. **Correção** (RF6):
`for update` na seção, troca as habilidades (`origem: 'coordenacao'`) e grava `corrigida_em`; é final.

**Suspensão** de `classificacao_do_material`: a geração, a troca e a cobertura ignoram `origem: 'ia'` (vale só a
correção); reclassificar e D76 recusam; a rotina não agenda; o painel diz por quê. Retomada: a rotina das 19h agenda.

**Geração** (RF7, RF2). A busca da ferramenta e do chat devolve, com cada trecho, as habilidades da seção da página,
filtradas pelo recorte atual da turma. A tarefa escolhe, por questão, uma das da página citada, ou nenhuma; `habilidade`
aceita `null`, e o plano, `habilidades` vazia (a união das seções citadas). Habilidade fora da seção citada é anulada na
gravação, e `ia.habilidade_anulada` soma. **O Tutor não recebe** as habilidades da seção: a entrada dele segue com
`materialId`, `pagina` e `texto`, e a habilidade só chega pela atividade aplicada. Sai o catálogo (`habilidades.ts`,
`habilidadesParaOTema`, `QUI.EM.*` no seed). Questão sem habilidade entra no `por_habilidade` com `codigo: null`. O
schema de leitura aceita `null` e código antigo (a tarefa confere a produção, D82).

**Troca** (RF9): `for update` no artefato, na transação que confere aplicação e versão adaptada e grava a questão;
aplicar e adaptar tomam a mesma trava primeiro. Código do recorte atual (série da turma, componente da disciplina do
artefato).

**Cobertura** (RF19): candidatas da série menos as habilidades das seções de material no filtro da F4
(`declaradoParaASerie`, `proprioOuComLicencaVigente`, `pronto`).

## 6. Isolamento (obrigatório)

FK composta com a escola; escopo do contexto em todo método (no worker, `job_registro.escola_id`); nenhum `@Unscoped`
novo (a rotina das 19h roda por escola, como o expurgo). Testes efetivos sem a cláusula: `cenarios.md`, "Isolamento".

## 7. Dado pessoal (obrigatório)

| Item | Resposta |
|---|---|
| Campos pessoais (`docs/lgpd.md`) | `corrigida_por` e as ações, na linha do material, na tarefa da migration |
| Log | ids, contagens, códigos de erro; nunca título, texto ou código escolhido |
| Auditoria | `material.classificacao_corrigida` (antes e depois), `material.classificacao_herdada`, `material.reclassificado`, `escola.reclassificada` (chamado), `artefato.habilidade_trocada`, `disciplina.componente_alterado` (a chave do job, §5) |
| Provedor externo | texto do material e lista BNCC, sem pessoa; a tarefa declara `levaTextoDeAluno: false`, `levaTextoLivreDePessoa: false` e a categoria (regra 20, item 13) |
| `consumo_ia` | entrada só com ids das seções e versão do prompt; saída, os códigos |
| Retenção | sai com o material |
| Arquivo do titular | `corrigida_por` em `fora`, como `registrada_por` na F4 |
| Autorização, DTO | §4; sem `corrigida_por` nem `execucao_id` |

## 7b. Conformidade CNE

Função `classificacao_do_material` do Assistente de ensino, autonomia 1, alto risco, suspensível. `fazSozinha`:
"Classifica cada capítulo ou bloco de páginas do material pela BNCC, à noite. A coordenação corrige, e a correção
vence." `esperaAprovacao`: "Nada chega ao aluno pela classificação: a habilidade de cada questão só vale quando o
professor confere e aplica a atividade." **A AIA `docs/aia/diagnostico-por-habilidade.md` é revista na tarefa que cria a
função**, antes da que troca o catálogo: a habilidade vem da seção; a granularidade (seção, não questão); a taxa e o
lote como evidência; contestação (correção, troca); a suspensão do §5; a conferência do lote por professor como etapa 2.

**Classificação de texto.** (a) **Lote retido** `docs/aia/ouro-retido/classificacao-retido-1.json`, 48 seções
(`cenarios.md`, "Lote retido"), escrito por subagente em contexto limpo, revisto pelo `pedagogia-reviewer` e pelo
`conformidade-reviewer`, conferido por professor antes do primeiro aluno real (`TODO.md`); o prompt é escrito sobre um
conjunto `dev` próprio. (b) Sem padrão de texto. (c) Sondas do `test-engineer` na revisão da tarefa do prompt.

**Taxa mínima**, na pior de três execuções, saída inválida conta como erro: ≥ 90 % das seções com conteúdo com um código
da `referencia`, nenhuma etapa abaixo de 80 %; ≥ 80 % dos códigos propostos em `aceitaveis`; no máximo 1 de 6
`sem_conteudo_curricular` com código; nenhuma `injecao` obedecida. **Por questão:** a ferramenta gera 10 atividades
sobre seções do lote e lista questão e habilidade; o `pedagogia-reviewer` julga, ≥ 80 % coerentes. Mede o Arquiteto,
com o modelo local e o da produção (D37), por `tools/ia/medir-classificacao.ts`, **antes da troca do catálogo**,
registrando no `RETIDOS.json`. Sem a taxa no `rapido`, `padrao`; sem ela no
`padrao`, a função nasce suspensa em cada escola (D76, com chamado e motivo) e a decisão é do Joaquim.

## 7c. Carga e falha (obrigatório)

| Item | Resposta |
|---|---|
| Caminho quente | a seção da página, na geração (join por índice); sem classificação no horário letivo |
| Fila | `lote`, `naoUrgente`; pool `lote` no `worker-ia`, 1 por réplica; a varredura de execuções inclui a `lote` |
| Vazão | balde `lote` global, 5 % do contratado (125 mil tokens/min), ~12 mil por execução: ~10 execuções/min. O pool puxa `réplicas × 1 × 60 / latência` (2 réplicas, ~6 s: ~20/min); o excedente adia, e o adiamento é o regulador. Uma escola de 300 apostilas (~625 execuções) em ~65 min; o resto, na noite seguinte |
| Limite por escola | vaga `lote` 1 por escola (dividida com expurgo e eliminação: o runbook diz); `FILAS_DA_IA` ganha a `lote` |
| Corridas | uma linha por trava, ordem forçada e mutação em `cenarios.md`, P1 a P11 |
| Laços | agendar (rotina e `PATCH`) e D76: lotes de 500 seções por transação, `statement_timeout`, até o sinal |
| Índices | `secao_do_material (escola_id, material_id, pagina_inicial)`; `habilidade_da_secao (escola_id, codigo)`; parcial `(escola_id, execucao_id)` |
| Migration | §3; a versão anterior lê execução sem ano e questão com `null` (teste) |
| Dependência cai | provedor ou balde: adia (§5); Redis: outbox |
| Métrica | `ia.habilidade_anulada`; envio à classificação (`classificada_em − enviado_em`); correções e trocas pela auditoria, por escola, nunca por professor |
| Alerta | `classificacao-atrasada`: na abertura da janela, execução `classificar_secoes` `falhou` na noite, ou `pendente` criada antes dela; com runbook |
| Carga | `cenarios.md`, "Carga" |

**Estados da seção** (derivados; `corrigida` vence todos):

| Situação | Entra | Sai | Prazo e queda |
|---|---|---|---|
| `nao_agendada` | sem execução (sem componente, suspensa, migration, componente apagado) | agendar, reclassificar | rotina |
| `aguardando` | execução `pendente` ou `rodando` | `concluir`; falha | adiada até a janela; `rodando` morta: reentrega, `EXECUCAO_INTERROMPIDA` |
| `classificada`, `sem_habilidade` | `concluir` da própria execução | reclassificar, mudança de recorte, correção | — |
| `nao_classificada` | execução `falhou` | rotina (`falhas_seguidas < 3`), reclassificar | — |

## 8. Uso de IA

| Caso de uso | Perfil | Entrada | Saída | Validação | Aprovação humana |
|---|---|---|---|---|---|
| `classificar_secoes` | `rapido` | até 12 seções + candidatas (~12 mil tokens; o maior recorte, LP do 6º ao 9º, medido na tarefa) | 0 a 3 códigos por seção | schema e candidatas | correção da coordenação; atividade aplicada pelo professor |

Custo: ~625 chamadas por onboarding, R$ 4 a 20 por escola; fora do pacote do Tutor (D38). Prompt em `packages/core/src/ia/prompts/classificar-secoes.ts`, versão
na execução: código só quando o trecho sustenta a habilidade, e "nenhuma" vale.

## 9. Frontend

| Tela | Mostra ou faz | De onde vem (§4) |
|---|---|---|
| Estrutura, disciplina | componente | `PATCH /v1/disciplinas/:id` |
| Painel do material | por seção: situação, habilidades com descrição, origem; corrigir (seletor com filtro); reclassificar; avisos | `GET /:id`, habilidades, `PUT`, reclassificar |
| Material, cobertura | por série: o que falta por componente; seções sem classificação | `GET /cobertura` |
| Artefato do professor | habilidade da questão, com o capítulo; trocar (seletor com filtro) | artefato, habilidades, `PATCH` |
| Turmas, aluno, Analista | "Sem habilidade", com explicação curta | leituras de hoje |

Estados, textos, 360 px, teclado: `cenarios.md`. A lista da troca traz primeiro as do capítulo.

## 10. Testes

`cenarios.md`. **Tarefas: 13** (`tasks.md`).

## 11. Conformidade com as regras

| Regra | Desvio e justificativa |
|---|---|
| 00, 20, 70, 80 | nenhum |
| 10, item 1 | `habilidade_bncc` sem escola: tabela pública sem dono |
| 10, item 2 | execução de `classificar_secoes` sem ano: classifica o material, que não tem ano (F4, §6) |
| 30, item 8 | consumo por escola e função, sem teto por escola: o contrato não o tem (`OrcamentoRepository`) |
| 40, item 4 | a taxa da classificação fica fora do portão (modelo de verdade): mede o Arquiteto antes da troca do catálogo |
| PRD, papel do professor | "ver a classificação" é na questão do artefato e na troca, sem tela de material (D73) |

## 12. Premissas não verificadas

- ⚠️ NÃO VERIFICADO: a origem do `bncc-dados` no MEC. A tarefa da carga confere 30 habilidades e as contagens (183 no
  EM) contra o PDF homologado, com o hash; o PDF vence.
- ⚠️ NÃO VERIFICADO: os blocos de Arte, Educação Física e Ensino Religioso; o art. 8º, IV, da Lei 9.610 e o envio ao
  provedor (advogado, PRD F4, §10).

## 13. Riscos técnicos

Capítulo longo, lido pelo começo (o lote mede).
