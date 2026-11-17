# Revisão de spec — classificacao-bncc

**Subagentes obrigatórios:** `test-engineer`, `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `conformidade-reviewer`, `llm-integrator`, `frontend-reviewer`, `pedagogia-reviewer`, `revisor-geral`

## Rodada 1 — 17/11/2026

**Veredito: REPROVADA**

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `test-engineer` | REPROVADO | 7 (B1 a B7) |
| `tenancy-guardian` | REPROVADO | 4 |
| `privacy-guardian` | REPROVADO | 2 |
| `infra-guardian` | REPROVADO | 6 |
| `conformidade-reviewer` | REPROVADO | 3 |
| `revisor-geral` | REPROVADO | 4 |
| `llm-integrator` | AJUSTES NECESSÁRIOS | 1 |
| `frontend-reviewer` | AJUSTES NECESSÁRIOS | 2 |
| `pedagogia-reviewer` | AJUSTES NECESSÁRIOS | 2 |

### Correções exigidas na Tech Spec
- §10 e cabeçalho: escrever `cenarios.md` (todos): testes por RF, isolamento efetivo, corridas com ordem forçada e mutação, textos e quatro estados por tela, 360 px, teclado e foco, rótulos em português de `situacao` e `origem` (marca de IA), mensagem de cada `CONFLITO`, testes de privacidade (contrato, arquivo do titular, eliminação, catálogo da auditoria, log)
- §3, §5: `execucao_agente.ano_letivo_id` é `not null`; dizer de onde vem ou torná-lo nulo só para `classificar_secoes`, com expansão, e o que acontece sem ano em curso e na virada (tenancy, infra, revisor-geral)
- §3, §5, §7c: a marca da correção é `corrigida_em` (ou `origem`), não `corrigida_por`, que a eliminação do titular anula; teste do coordenador eliminado (tenancy, privacy, revisor-geral)
- §3: `secao_do_material.id uuid default uuidv7()`; `unique (escola_id, id)` em `capitulo_do_material` (tenancy, revisor-geral)
- §4, §6: `GET /v1/habilidades-bncc` com autorização por objeto e teste de isolamento; a entrada fixa o componente (`artefatoId`, ou `turmaId` com `disciplinaId`) (tenancy, test-engineer B5)
- §7c: tabela de estados completa: seção sem execução (estado próprio, saída), prazos, entradas em falha; o que o componente gravado depois faz (revisor-geral, test-engineer B1)
- §5: a edição nova herda a correção pelo capítulo, ou pergunta ao Joaquim (revisor-geral)
- §5, §7b: o que a suspensão faz com as habilidades `origem: 'ia'` já gravadas, com reclassificar, D76 e extração (conformidade)
- §5: o Tutor não recebe as habilidades da seção; teste (conformidade)
- §5, §7c: degradação própria do lote (balde cheio ou provedor fora devolvem o job com recuo, sem gastar tentativa, até o fim da janela); conta de vazão do pool contra o balde; alerta de classificação atrasada com runbook; carga reprova com seção não classificada às 5h (infra)
- §4, §7c: troca de habilidade com `for update` no artefato, que aplicar e adaptar também tomam; corridas troca × troca, × aplicar, × adaptar (infra, test-engineer B6)
- §3: checks de `execucao_agente` e `consumo_ia` com `NOT VALID` e `VALIDATE` (infra)
- §3: contração da F4 em três deploys; o `DROP COLUMN` depois desta spec (infra)
- §5: o `concluir` relê o material sob trava (`pronto`, não excluído) (test-engineer B2)
- §5: o `preparar` lê só as seções vivas e, sem nenhuma, conclui sem modelo; reclassificar é idempotente com execução `pendente` (test-engineer B3, infra)
- §5: recorte que muda depois (séries, componente, etapa mista): ler pelo recorte atual e reagendar (test-engineer B4)
- §7b: lote retido com categorias, piso de `sem_conteudo_curricular` e `injecao`, "aceitável" definido, quem mede e quando, desvio da regra 40, item 4 no §11; medir também a habilidade por questão; seções no tamanho real; medida antes da tarefa que troca o catálogo; validação do lote por professor (test-engineer B7, pedagogia)
- §4, §9: busca no seletor de habilidades e paginação da cobertura (frontend)

### Recomendações
- `preparar`/`concluir`: teto de saída, versão do prompt na execução, sem SDK fora do adaptador (llm)
- `levaTextoDeAluno: false` e `categoriasEnviadas` na tarefa; `consumo_ia.entrada` sem o texto do material (privacy)
- Habilidade fora da seção: anular em vez de recusar (infra); questão que cita duas seções (pedagogia, test-engineer)
- Métricas do PRD §9 nomeadas, por escola, nunca por professor (conformidade, test-engineer)
- Cobertura com "N seções ainda sem classificação" (pedagogia); confirmação do reclassificar com o que é refeito (frontend)
- Glossário: "seção" na interface vira "capítulo" ou "páginas X a Y" (revisor-geral)
- Computação fora: `TODO.md` para a D65 (conformidade); a rede não alcança classificação nem cobertura (tenancy)
- Contagem de tarefas na Tech Spec; passou de 12, a pergunta do corte ao Joaquim (revisor-geral)

## Rodada 2 — 17/11/2026

**Veredito: REPROVADA**

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `frontend-reviewer` | APROVADO | 0 |
| `pedagogia-reviewer` | APROVADO | 0 |
| `privacy-guardian` | APROVADO | 0 |
| `conformidade-reviewer` | APROVADO | 0 |
| `llm-integrator` | AJUSTES NECESSÁRIOS | 1 |
| `tenancy-guardian` | REPROVADO | 1 |
| `revisor-geral` | REPROVADO | 1 |
| `infra-guardian` | REPROVADO | 3 |
| `test-engineer` | REPROVADO | 6 |

### Correções exigidas
- §5 "Agendar": "sem execução viva" reagenda a seção classificada toda noite. Separar os gatilhos: a rotina das 19h pega só seção sem execução ou com execução `falhou`; a mudança de recorte (`PATCH` do componente ou de séries) refaz também a classificada, como o reclassificar; o `PATCH` só enfileira o job, que agenda em lotes; estados nomeados (llm, revisor-geral, test-engineer 1)
- §5: agendar duas vezes ao mesmo tempo (rotina repetida, rotina × `PATCH`) dá uma execução por seção; P9 (test-engineer 2)
- §5: o job adiado não respeita a janela (o recuo é do BullMQ); o processador confere a janela da escola antes do modelo e adia até ela fechar; sai o "5h" (infra 1)
- §8: `classificar_secoes` em `TAREFAS_SEM_MODELO_MENOR`, para o excedente adiar e não descer a um modelo sem medida; vazão do pool escrita contra o balde (infra 2)
- §3: o check novo do ano nulo também com `NOT VALID` e `VALIDATE` (infra 3)
- `cenarios.md`: `serieId` da B na cobertura (tenancy); P4b com o `for share` e o material excluído no `preparar`; limite por escola e `FILAS_DA_IA` com a `lote`; alerta, teto da troca, suspensão na cobertura e no D76, plano, check do ano, laço, provedor fora (test-engineer 3 a 5)
- §4 e `cenarios.md`: disciplina sem componente no seletor e na troca; quatro estados do artefato, da Estrutura e do seletor; mensagem do `CONFLITO` do `PUT` (test-engineer 6)

### Recomendações
- Edição nova herda a correção sem `corrigida_por`, com `material.classificacao_herdada` na auditoria (privacy, conformidade)
- Reclassificar da coordenação grava `solicitada_por` nulo, como a rotina (privacy, tenancy); `levaTextoLivreDePessoa: false` (privacy)
- "A função nasce suspensa": suspensão gravada por escola, com autor e motivo (conformidade)
- Textos: "capítulos" no lugar de "trechos"; "à noite" sem "hoje"; vazio do painel com o próximo passo; seletor sem resultado; 429 (frontend, pedagogia)
- `IA_SAIDA_INVALIDA` com teto de noites; motivo do adiamento novo; recusa de soberania não adia para sempre (test-engineer, infra)
- Rota `/materiais/cobertura` antes de `:id`; §11 com o ano nulo como desvio da regra 10, item 2 (tenancy, revisor-geral)

## Rodada 3 — 17/11/2026

**Veredito: REPROVADA** (só os cinco que não aprovaram na rodada 2)

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `tenancy-guardian` | APROVADO | 0 |
| `llm-integrator` | AJUSTES NECESSÁRIOS | 1 |
| `revisor-geral` | REPROVADO | 1 |
| `infra-guardian` | REPROVADO | 1 |
| `test-engineer` | REPROVADO | 1 |

### Correções exigidas
- §3, §5, §7c: o teto de três noites não tem onde ser contado. Coluna `falhas_seguidas` na seção: só `IA_SAIDA_INVALIDA` soma (interrupção e suspensão não); `concluir`, reclassificar, D76 e mudança de recorte zeram; a rotina pega `falhas_seguidas < 3`; cenário com a mutação "sem o teto" (llm, revisor-geral, infra)
- §5 "Agendar": componente apagado. O job não cria execução, tira o `execucao_id` e as habilidades `origem: 'ia'` das seções não corrigidas (`nao_agendada`); a cobertura deixa de contá-las; cenário (test-engineer)

### Recomendações
- Reclassificar com comando `daRotina` (tenancy); cenário da rotina com seção da B (tenancy)
- Chave do job de agendar com a versão do recorte; job `naoUrgente`; motivo `janela` no adiamento; alerta sem o excedente planejado de uma noite (infra)
- Candidatas lidas no `preparar`, e cenário do `PATCH` com seção `pendente` (test-engineer, revisor-geral)
- P4b: a exclusão é lógica, não apaga em cascata; P9 com reclassificar × rotina; "corrigir" desabilitado sem componente; "trecho" no rótulo de `sem_habilidade`; separar a recusa antes da chamada do erro depois dela (test-engineer)

## Rodada 4 — 17/11/2026

**Veredito: REPROVADA** (só os quatro que não aprovaram na rodada 3)

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `llm-integrator` | APROVADO | 0 |
| `infra-guardian` | APROVADO | 0 |
| `revisor-geral` | APROVADO | 0 |
| `test-engineer` | REPROVADO | 1 |

### Correções exigidas
- §5 "Agendar", "Classificação": o componente apagado sem efeito definido em três caminhos. (a) Com a função suspensa, o job limpa e só não agenda; (b) o `preparar` sem candidatas conclui sem modelo e as seções voltam a `nao_agendada`; (c) a limpeza toma a seção `for update`, troca o `execucao_id` condicionado e só então apaga os códigos `origem: 'ia'`; corrida P10 com o `concluir` (test-engineer)

### Recomendações
- `falhas_seguidas not null`; soma na mesma transação da passagem a `falhou` (infra, revisor-geral)
- Seção com falha vai sozinha à execução seguinte, para não levar as vizinhas ao teto (llm, revisor-geral)
- O job decide pelo componente e séries atuais, não pelo conteúdo do `PATCH`; o (b) também exige componente (infra, revisor-geral)
- Runbook: recusa de soberania repete toda noite; `EXECUCAO_INTERROMPIDA` recorrente sai por suspensão ou D76 (infra, test-engineer, llm)

## Rodada 5 — 17/11/2026

**Veredito: REPROVADA** (só o `test-engineer`, REPROVADO, 2 bloqueantes)

### Correções exigidas
- P10a: a mutação "sem a troca ter acertado" não tem ordem que a mate; o `:lido` da limpeza é lido sob o `for update`, e a mutação sai
- §5 "Agendar": "seção com falha vai sozinha" sem definição nem mutação; "com falha" é `falhas_seguidas > 0`, cada uma vai numa execução só dela; cenário e mutação "agrupar seção com falha"

### Recomendações
- O `preparar` sem candidatas escreve como a "Limpar", condicionado a `execucao_id = :esta` (P11); o cenário fixa o job do `PATCH` ainda na fila

## Rodada 6 — 17/11/2026

**Veredito: APROVADA.** O `test-engineer` aprovou, e os outros oito já tinham aprovado nas rodadas 2 a 4.

### Recomendações para as tarefas
- O runbook de `classificacao-atrasada` cobre a falha em massa (troca de prompt): cada seção com falha vai sozinha, e
  uma escola de 300 apostilas pode passar de ~625 para ~7.500 execuções numa noite, contidas pelo balde, pelo
  adiamento e pelo teto de 3; a recusa de soberania repete toda noite; a interrupção recorrente sai por suspensão ou
  D76 (test-engineer, infra, llm)
- A tarefa do lote cria no `TODO.md` a conferência pelo professor, ligada ao primeiro aluno real; se o professor muda
  `referencia` ou `aceitaveis`, a medida se refaz (pedagogia)
- A AIA trata a herança da correção na edição nova (`material.classificacao_herdada`) e a suspensão por escola quando
  a taxa não é atingida (conformidade)
- Glossário: "seção do material" e "componente curricular" (revisor-geral)

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-17 08:57:12 | 2026-11-17 08:57:38 | `frontend-reviewer` | 1 | AJUSTES NECESSÁRIOS | a7cb77f8f2b569551 |
| 2026-11-17 08:57:09 | 2026-11-17 08:57:53 | `llm-integrator` | 1 | AJUSTES NECESSÁRIOS | a51180fd3dd241e01 |
| 2026-11-17 08:57:15 | 2026-11-17 08:58:19 | `pedagogia-reviewer` | 1 | AJUSTES NECESSÁRIOS | abbc135404069d1ba |
| 2026-11-17 08:56:59 | 2026-11-17 08:58:51 | `tenancy-guardian` | 1 | REPROVADO | a421e935cda13e845 |
| 2026-11-17 08:57:02 | 2026-11-17 08:59:28 | `privacy-guardian` | 1 | REPROVADO | a2a1a2fcb8d090ff0 |
| 2026-11-17 08:57:18 | 2026-11-17 09:01:00 | `revisor-geral` | 1 | REPROVADO | ae83e368e1a938ac3 |
| 2026-11-17 08:57:07 | 2026-11-17 09:01:01 | `conformidade-reviewer` | 1 | REPROVADO | a212444ae7958cf58 |
| 2026-11-17 08:57:04 | 2026-11-17 09:02:34 | `infra-guardian` | 1 | REPROVADO | a3f1579b4154b8984 |
| 2026-11-17 08:56:56 | 2026-11-17 09:03:12 | `test-engineer` | 1 | REPROVADO | a63cfd05ba57dc175 |
| 2026-11-17 09:58:30 | 2026-11-17 09:58:46 | `frontend-reviewer` | 2 | APROVADO | a7218a01470e531ff |
| 2026-11-17 09:58:33 | 2026-11-17 09:59:11 | `pedagogia-reviewer` | 2 | APROVADO | a1b24f27710031b34 |
| 2026-11-17 09:58:15 | 2026-11-17 09:59:20 | `privacy-guardian` | 2 | APROVADO | a5e440d2758350627 |
| 2026-11-17 09:58:21 | 2026-11-17 09:59:45 | `conformidade-reviewer` | 2 | APROVADO | afc5513a96cd7379a |
| 2026-11-17 09:58:27 | 2026-11-17 09:59:48 | `llm-integrator` | 2 | AJUSTES NECESSÁRIOS | adf59d99ecfd94519 |
| 2026-11-17 09:58:12 | 2026-11-17 09:59:51 | `tenancy-guardian` | 2 | REPROVADO | a6b51690198085351 |
| 2026-11-17 09:58:24 | 2026-11-17 10:00:20 | `revisor-geral` | 2 | REPROVADO | af3fe3b8c65626c48 |
| 2026-11-17 09:58:18 | 2026-11-17 10:01:36 | `infra-guardian` | 2 | REPROVADO | af2e8e520c967b90c |
| 2026-11-17 09:58:09 | 2026-11-17 10:02:22 | `test-engineer` | 2 | REPROVADO | aee280a78c8bc6176 |
| 2026-11-17 10:05:02 | 2026-11-17 10:05:30 | `llm-integrator` | 3 | AJUSTES NECESSÁRIOS | aac7f50a90323d9e5 |
| 2026-11-17 10:04:59 | 2026-11-17 10:05:55 | `tenancy-guardian` | 3 | APROVADO | ad7af7d9ab7d779e7 |
| 2026-11-17 10:04:56 | 2026-11-17 10:06:13 | `revisor-geral` | 3 | REPROVADO | a21f98dee1a8ec05b |
| 2026-11-17 10:04:53 | 2026-11-17 10:07:14 | `infra-guardian` | 3 | REPROVADO | a0e4b4eb05757d66c |
| 2026-11-17 10:04:49 | 2026-11-17 10:07:34 | `test-engineer` | 3 | REPROVADO | a394ab741f064d33c |
| 2026-11-17 10:08:51 | 2026-11-17 10:09:17 | `llm-integrator` | 4 | APROVADO | a12c43cb582bf37f6 |
| 2026-11-17 10:08:46 | 2026-11-17 10:10:02 | `infra-guardian` | 4 | APROVADO | a55eaa8751cd994e1 |
| 2026-11-17 10:08:49 | 2026-11-17 10:10:10 | `revisor-geral` | 4 | APROVADO | a40f73a0c0afe856a |
| 2026-11-17 10:08:43 | 2026-11-17 10:10:23 | `test-engineer` | 4 | REPROVADO | ab0b1dd4bbafe588e |
| 2026-11-17 10:11:24 | 2026-11-17 10:14:17 | `test-engineer` | 5 | REPROVADO | a47e634e46e1cbce2 |
| 2026-11-17 10:14:52 | 2026-11-17 10:16:38 | `test-engineer` | 6 | APROVADO | ad4b8f61bff50ed55 |
