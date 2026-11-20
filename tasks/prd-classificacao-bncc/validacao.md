# Validação — classificacao-bncc (F4b)

## Rodada 2 — 20/11/2026

**Escopo:** funcionalidade completa (tarefas 1.0 a 13.0, mais as correções `bncc-repository-unico`, `merge-da-develop-leitura-de-null` e `descricao-oficial-da-habilidade`)
**Commit validado:** `b65d4ab0`
**Veredito: APROVADA**

Revalidação depois das duas ressalvas maiores da rodada 1. Entre `4538566c` e `b65d4ab0` entraram, com código: `e2e3213c` (correção da
`develop`, leitura de `habilidade: null`, trazida pelo merge), `54f6cd09` (ressalva 1), `133f1e2a` (resolução do merge da `develop` na L2) e
`4d08de34` (ressalva 2). Li por completo os arquivos de produção que eles tocam: `packages/core/src/bncc/bncc.repository.ts`,
`apps/api/src/material/habilidades-do-recorte.ts`, `secoes.repository.ts`, `cobertura.repository.ts`, `apps/api/src/artefato/conferencia.ts`,
`artefato.service.ts` (`trocarHabilidade`), `desempenho.repository.ts`, `analista.repository.ts`, `correcao-de-objetiva.ts`,
`minha-atividade.service.ts`, `relatorio-da-correcao.ts`, `pdf-do-artefato.ts` e `ConteudoDoArtefato.tsx`. Os RF que a rodada 1 deu por
atendidos e que esses commits não tocam ficam com a evidência dela (abaixo, na rodada 1).

### 1. RF a RF

| RF | Situação | Código | Teste | Observação |
|---|---|---|---|---|
| RF1 | ATENDIDO | sem mudança desde a rodada 1 | rodada 1 | — |
| RF2 | ATENDIDO | `133f1e2a`: a leitura de `habilidade: null` e `codigo: null` fica a da spec; o plano vazio ganha o rótulo "Sem habilidade" (`ConteudoDoArtefato.tsx:149`, `pdf-do-artefato.ts:238`) | `e2e/classificacao-bncc.spec.ts` (rodado nesta rodada: 12 de 12 verdes, `chromebook` e `celular`, 39,9 s), com "Sem habilidade" em Turmas e no resultado da aluna; `Artefato.test.tsx` e `pdf-do-artefato.test.ts` (o rótulo do plano) | A descrição exibida em Turmas, no Analista e no resultado da aluna é agora a da BNCC (ver RF7). A tela "Sem habilidade" da questão: V `professora--professor-artefatos-01a1f8fa-…--celular-2.png`, relida nesta rodada. O plano sem habilidade não foi fotografado (menor 2) |
| RF5 | ATENDIDO | `classificar-secoes.command.ts` lê as candidatas por `candidatasDoRecorte(new BnccRepository(tx), …)` (`habilidades-do-recorte.ts`), sem `@Unscoped` no módulo | `classificacao.int.test.ts` (ajustado na `54f6cd09`); `habilidades-do-recorte.test.ts` (o filtro por etapas e a regra `habilidadeEhCandidata` fora do banco); `bncc.repository.int.test.ts` | A taxa no modelo da produção segue pendente (seção 6, herdada da rodada 1) |
| RF6 | ATENDIDO | sem mudança desde a rodada 1 | rodada 1 (mutação M1 da rodada 1) | — |
| RF7 | ATENDIDO | `apps/api/src/artefato/conferencia.ts:12-32`: a habilidade que fica na questão e no plano é gravada com a descrição do trecho entregue (`habilidade_bncc` cortada em 300, `secoes.repository.ts:147,192`), nunca com a do modelo. Todos os caminhos de gravação conferidos: geração (`ferramentas.command.ts:54`), troca (`artefato.service.ts:207`, relê a tabela) e adaptação (`exigirAdaptacaoFiel` compara código **e** descrição, `conferencia.ts:41`) | `conferencia.test.ts` (questão e plano com a descrição do modelo saem com a da tabela, sem contar como anulada); `geracao-pela-secao.int.test.ts` ("a descrição que o modelo escreve para a habilidade certa não é gravada", na atividade e no plano; rodado, 24 de 24 com o `bncc.repository.int.test.ts`); e2e `classificacao-bncc.spec.ts:249-251` (a aluna vê a descrição oficial da corrigida e da trocada, e não a da sugerida) | **Ressalva maior 2 da rodada 1 fechada.** Mutação R2-M1 vermelha. Fotos: V `professora--professor-artefatos-01a1f8fa-…--{computador,celular-2}.png`, relidas: o componente da questão não mudou nesta rodada, só a origem do texto, e o e2e confere o texto oficial na tela |
| RF9 | ATENDIDO | `artefato.service.ts:207`: `descricaoDaHabilidadeDoRecorte(new BnccRepository(tx), …)` no lugar do `@Unscoped` de `secoes.repository.ts` | `troca-de-habilidade.int.test.ts` (rodada 1); `habilidades-do-recorte.test.ts` ("o texto oficial de uma habilidade") | — |
| RF12 | ATENDIDO | sem mudança desde a rodada 1 | rodada 1 | — |
| RF15 | ATENDIDO | sem mudança desde a rodada 1 | carga da 5.0 (rodada 1) | — |
| RF19 | ATENDIDO | `material.service.ts` lê as habilidades da série por `BnccRepository.habilidades({ etapa, ano })`; o grupo (`coalesce(area, componente)`) passou ao SQL do `BnccRepository` | `cobertura.int.test.ts` (rodada 1, mutação M3); `bncc.repository.int.test.ts` (Fundamental pelo ano, Médio inteiro, grupo por área no EM) | — |
| RF20 | ATENDIDO | nenhum `@Unscoped` no módulo `material`; o único da leitura da BNCC é `BnccRepository.habilidades` (`packages/core/src/bncc/bncc.repository.ts:40`), sobre a tabela pública; os dois `innerJoin(habilidadeBncc)` de `secoes.repository.ts:151,352` partem de `habilidade_da_secao` com `escola_id` do contexto. A descrição do código do antigo catálogo (`QUI.EM.*`) no diagnóstico sai do conteúdo da própria escola | `apps/api/test/architecture.test.ts` (o método único, o módulo sem `@Unscoped`, só o `BnccRepository` faz `.from(habilidadeBncc)`); `analista.int.test.ts` ("o texto gravado do código que a tabela não tem é o da própria escola") | **Ressalva maior 1 da rodada 1 fechada**, com o registro na Tech Spec §6 e §11. Mutação R2-M3 vermelha |

Diagnóstico (Turmas e Analista), parte do RF2 e do RF7: `descricoesDoDiagnostico` (`habilidades-do-recorte.ts:29`) relê a descrição de
`habilidade_bncc` pelo código, nos dois `descricoesDasHabilidades` (`desempenho.repository.ts:109`, `analista.repository.ts:231`); o comentário
"o catálogo é nosso" saiu. Teste: `analista.int.test.ts` › "a descrição da habilidade no diagnóstico" (rodado, 2 de 2): o artefato gravado com a
paráfrase do modelo sai com o texto oficial no Analista, na leitura da turma, na rota do desempenho e no dado nominal. Mutação R2-M2 vermelha.
O resultado do aluno, a memória do Tutor, o relatório e o PDF continuam lendo o texto gravado: seguro porque toda gravação agora é oficial,
registrado na Tech Spec §5 e no `TODO.md` (dono: a próxima tarefa que mexer nesses leitores).

Provas de mutação (cada uma restaurada com `git checkout -- <arquivo>`; a árvore terminou limpa):

| RF | Cláusula removida | Teste que ficou vermelho |
|---|---|---|
| RF7 | a troca pela descrição oficial em `anularHabilidadesForaDaSecao` (`if (oficial !== undefined) return questao`, `apps/api/src/artefato/conferencia.ts:20`) | `apps/api/src/artefato/conferencia.test.ts` › "a questão com o código certo e a descrição do modelo sai com a descrição da tabela…" e "…descrição em branco ou de outra habilidade…" (2 vermelhos, "expected [ Array(2) ] to deeply equal [ Array(2) ]") |
| RF2/RF7 (diagnóstico) | o laço que põe a descrição oficial em `descricoesDoDiagnostico` (`apps/api/src/material/habilidades-do-recorte.ts:33`) | `apps/api/src/governanca/analista.int.test.ts` › "é a de `habilidade_bncc`, pelo código, mesmo que o artefato gravado traga a do modelo…" ("expected 'Calcular quantidades em reações quími…' to be 'Realizar previsões, avaliar intervenç…'") |
| RF20 | `@Unscoped(` de volta num arquivo do módulo `material` (`apps/api/src/material/cobertura.repository.ts`) | `apps/api/test/architecture.test.ts` › "nenhum arquivo do módulo `material` da API, em qualquer subpasta, usa @Unscoped" ("expected [ Array(1) ] to deeply equal []") |

### 2. Regras de negócio, casos de borda e critério de pronto

Sem mudança de situação desde a rodada 1 (todas cumpridas, cobertas ou justificadas). O que muda:

| Item | Situação | Evidência |
|---|---|---|
| Pronto: habilidade da seção ou nenhuma; troca antes de aplicar; Tutor sem a habilidade (RF7, RF9) | cumprido, agora sem a ressalva da descrição | RF7 acima, R2-M1, R2-M2 |
| Pronto: nada de uma escola aparece para outra (RF20) | cumprido | RF20 acima; o texto do `QUI.EM.*` lido só da própria escola |
| Pronto do ROADMAP (F4b) | cumprido | o código **e** o texto da habilidade usados na geração e no diagnóstico são os da BNCC |
| Regra 70, item 6 ("o que a IA gerou, quem aprovou e quando") | cumprida | a descrição do modelo deixou de ser gravada como se fosse da BNCC; a auditoria da correção e da troca segue como na rodada 1 |
| Regra 70 nos commits desta rodada que tocam correção (`correcao-de-objetiva.ts`, `relatorio-da-correcao.ts`) | cumprida | só comentário e texto do relatório ("revisão rápida do conteúdo desta questão"); nenhuma escrita de nota nem de `lancadaPor` |

### 3. Portão

Escopo de funcionalidade completa: não rodei suíte inteira (D79). Rodei só os testes que servem de evidência, isolados, no ambiente de teste
deste andar (`educa-teste`). `node_modules` em dia com o `package-lock.json`: sem `npm ci`.

| Portão | Resultado |
|---|---|
| `npm run typecheck` | não rodado: esteira |
| `npm run lint` | não rodado: esteira |
| Unidade: `conferencia.test.ts`, `habilidades-do-recorte.test.ts`, `architecture.test.ts` | ✅ 105 passaram; R2-M1 e R2-M3 ficaram ❌ com a mutação e voltaram ao verde |
| Integração: `analista.int.test.ts` › "a descrição da habilidade no diagnóstico" | ✅ 2 passaram; R2-M2 ficou ❌ e voltou ao verde |
| Integração: `geracao-pela-secao.int.test.ts`, `bncc.repository.int.test.ts` | ✅ 24 passaram |
| `node tools/ci/e2e.ts --manter-ambiente e2e/classificacao-bncc.spec.ts` | ✅ 12 passaram (39,9 s), `chromebook` e `celular`. Depois parei os workers e o despachante do `educa-teste`, para não deixar a integração do andar recusar por job de pé |
| Esteira do GitHub | esteira: conferida no fechamento (D79), não entra no veredito |
| Revisões com veto registradas e aprovadas | ✅ nas três correções a última rodada de cada revisor é APROVADO: `bncc-repository-unico` (6 revisores, 2ª), `merge-da-develop-leitura-de-null` (8, test-engineer e revisor-geral na 2ª), `descricao-oficial-da-habilidade` (7, test-engineer e revisor-geral na 2ª). As tarefas 1.0 a 13.0, como na rodada 1 |

Processo:
- Todo commit com código desta rodada leva `(correção …)`; o `d7edaae1` é o merge da spec na L2, sem código próprio. Nenhum commit `Fora do processo:` (`git log origin/develop..HEAD -i --grep='^Fora do processo:' -- apps packages infra e2e tools` vazio).
- As três correções declaram blocos `mutacao`.
- Divergências registradas: a §6 e a §11 (o `@Unscoped` único no núcleo) e a §5 (os quatro leitores que ainda leem o texto gravado).

### 4. Achados

**Críticos**
- Nenhum.

**Maiores**
- Nenhum. As duas da rodada 1 estão fechadas (RF20 e RF7 acima).

**Menores** (a lista com dono e arquivo está na seção 6)
1. `tasks/correcoes/2026-11-20-bncc-repository-unico.md:123-124`: duas recomendações dos revisores dizem "destino: `TODO.md`" e não estão lá: endurecer a guarda da leitura da BNCC além de `.from(habilidadeBncc)` (o `innerJoin`, o apelido de import, `db.query`) e o nome do caso que promete mais que prova (tenancy, infra e test-engineer, 2ª); e a nota de que `architecture.test.ts` se roda pela raiz, porque de `apps/api` carrega o `dist` velho do `@educa/core` (infra, 2ª). No mesmo assunto, a Tech Spec §6 (`techspec.md:148`) diz "a leitura da tabela pública `habilidade_bncc` é um repository só", e `secoes.repository.ts:151,352` ainda a junta, com escopo de escola. Não é vazamento; é texto que promete mais que o código. Correção: levar os dois itens ao `TODO.md` e dizer na §6 "a leitura sem escola".
2. O rótulo "Sem habilidade" do **plano** sem habilidade (`ConteudoDoArtefato.tsx:149`, do merge) não foi fotografado por esta validação: a vitrine não tem plano de aula, e semear um à mão no banco de teste não cabia nesta rodada. Tem teste de componente (`Artefato.test.tsx`) e passou pelo `frontend-reviewer` na correção do merge.
3. Os menores da rodada 1 seguem pendentes do fechamento (`openAnoLetivo`, subitens do `tasks.md`, status da Tech Spec, vitrine sem material classificado, botões das disciplinas): seção 6.

**Positivos**
- A correção da descrição fechou todos os caminhos de gravação, e não só o achado: geração, plano, troca e adaptação (esta compara a descrição também), com um teste por caminho e a prova de isolamento do único texto que ainda sai do conteúdo da escola (`QUI.EM.*`).
- A guarda de arquitetura transforma a regra 10, item 9, em teste para o módulo inteiro: o quarto `@Unscoped` não entra mais sem alguém ver.

### 5. Conclusão

APROVADA. Os 10 RF estão ATENDIDOS, com código, teste lido e, nos que têm tela, foto lida e e2e verde. As duas ressalvas maiores da rodada 1
foram corrigidas pela skill `corrigir`, com revisores aprovados, registro na Tech Spec e teste efetivo: as três mutações desta rodada ficaram
vermelhas. O critério de pronto e o "Pronto quando" do ROADMAP estão cumpridos. Não há crítico, maior nem teste vermelho entre os que rodei. Os
menores não mudam o veredito e vão ao `TODO.md` no fechamento.

### 6. Pendências herdadas

| Pendência | Dono | Arquivo | Destino |
|---|---|---|---|
| Guarda da leitura da BNCC além do `.from(` e nome do caso; `architecture.test.ts` pela raiz | Orquestrador | `apps/api/test/architecture.test.ts:1620`, `docs/guia-do-desenvolvedor.md` | `TODO.md` (prometido em `tasks/correcoes/2026-11-20-bncc-repository-unico.md:123-124`) |
| Texto da §6: "a leitura sem escola da `habilidade_bncc` é um repository só" | Arquiteto | `tasks/prd-classificacao-bncc/techspec.md:148` | no fechamento |
| Os quatro leitores que leem a descrição gravada (resultado do aluno, memória do Tutor, relatório, PDF) | próxima tarefa que mexer neles | `TODO.md` (já está) | `TODO.md` |
| Foto do plano sem habilidade | Arquiteto | `tools/vitrine/` | `TODO.md`, junto com a vitrine sem material classificado |
| Taxa da classificação no modelo da produção (90 % geral, 80 % EM, injeção 0) antes da primeira escola real | Joaquim (D37) | `docs/aia/ouro-retido/RETIDOS.json`, `ROADMAP.md` | `TODO.md` (já está) e ROADMAP (herdada da rodada 1) |
| Conferência da classificação por professor de cada área, no lote retido | Joaquim | `docs/aia/ouro-retido/` | `TODO.md` (já está) |
| Tempo de RF15 com o modelo real | Arquiteto | `tasks/prd-classificacao-bncc/5_task.md` | junto com a medida da produção |
| `openAnoLetivo` → `abrirAnoLetivo` | Implementador | `apps/web/src/api/estrutura.ts:113` | `TODO.md` (ainda não está) |
| Marcar os subitens do `tasks.md` (14 ainda `[ ]`) | Orquestrador | `tasks/prd-classificacao-bncc/tasks.md` | no fechamento |
| Tech Spec de "rascunho" para o status final | Arquiteto | `tasks/prd-classificacao-bncc/techspec.md:4` | no fechamento |
| O `domain-researcher` contado pelo hook como rodada | Arquiteto | `.claude/skills/seguir/time.md` e o hook | retro |
| Vitrine com material classificado e artefato com habilidade; foto escolher `<select>`; nome da foto com a query | Arquiteto | `tools/vitrine/` | `TODO.md` |
| Botões das disciplinas quebrando de jeito diferente por linha | Implementador | `apps/web/src/areas/coordenacao/estrutura/` | `TODO.md` |
| Histórico das habilidades `origem: 'ia'` descartadas (Tech Spec §8) | Arquiteto | `docs/conformidade-mec.md` | próxima spec que mexer no dossiê |
| Commits `Fora do processo:` com código | — | — | nenhum nesta spec |


## Rodada 1 — 20/11/2026

**Escopo:** funcionalidade completa (tarefas 1.0 a 13.0)
**Commit validado:** `4538566c`
**Veredito: APROVADA COM RESSALVAS**

Os RF são os do PRD da F4 (`tasks/prd-ingestao-do-material/prd.md`) que o corte de 11/11 trouxe para esta spec: RF1, RF2,
RF5, RF6, RF7 (a habilidade), RF9, RF12, RF15 (a parte "classificadas"), RF19 e RF20.

### 1. RF a RF

As fotos ficam em `.processo/vitrine/` (V) ou no scratchpad desta sessão (S:
`/tmp/claude-1000/-home-joaquimdp-Documents-git--maestri-floors-educaia--specclassificacao-bncc/30dfa3ad-b903-41bb-a3fc-09d30f15c2eb/scratchpad/`).
A escola cheia da vitrine não tinha material nem artefato com seção. Para fotografar, semeei **só no banco de teste**,
com as peças do e2e (`e2e/support/material.ts`), um material de Química do 2º EM com cinco seções, uma em cada estado
(classificada pela IA, corrigida pela coordenação, sem habilidade, não classificada, ainda não agendada), e um artefato
da professora com uma questão com habilidade e outra sem. Apaguei os dois depois das fotos. O componente `quimica` da
disciplina Química da vitrine ficou definido.

| RF | Situação | Código | Teste | Observação |
|---|---|---|---|---|
| RF1 | ATENDIDO | `packages/core/drizzle/0059_habilidade_bncc.sql` (check `habilidade_bncc_recorte_da_etapa`); `packages/shared/src/bncc/componentes.ts`; carga em `packages/core/src/bncc/` | `packages/core/src/db/habilidade-bncc.int.test.ts` (carga de 913 códigos, 183 do EM; o check recusa `EF03CI03B`; recorte da etapa); `packages/shared/src/bncc/componentes.test.ts` (`EF69LP01` do 6º ao 9º, `EM13CNT301` em Química e Física, sufixo recusado); `carga.test.ts` (hash do PDF); `codigos-da-bncc.test.ts` | As três partes do critério têm caso próprio. Fonte por registro: release `dados-2026.08` do `bncc-dados`, com o hash do PDF homologado. A exceção do `EF07MA33` está registrada. Tela (componente da disciplina): V `coordenacao--coordenacao-estrutura--Ano-letivo-e-disciplinas--{computador,celular}.png`, com "Componente da BNCC: Química" e "Sem componente" lidos |
| RF2 | ATENDIDO | `packages/shared` sem `habilidades.ts`; nenhum `QUI.EM` em código de produção (grep: só em teste, como dado legado) | `apps/api/test/geracao-pela-secao.int.test.ts` ("código do antigo catálogo sai anulado", "seed: todo código existe em habilidade_bncc", "a leitura aceita QUI.EM.05 e null"); `packages/core/src/ia/tasks/conteudo.test.ts:383` | "Sem habilidade" na tela da professora: V `professora--professor-artefatos-…--celular-2.png` ("Sem habilidade · Capítulo 3 · Leitura complementar"). Em Turmas, no resultado do aluno e no Analista, a prova é o e2e `e2e/classificacao-bncc.spec.ts` (rodado, verde). A turma da vitrine em Turmas: V `professora--professor-turmas-01a1f8f6-…--{computador,celular}.png`. Ver o achado maior 2 (descrição da habilidade) |
| RF5 | ATENDIDO | `apps/api/src/material/classificar-secoes.command.ts` (`preparar` lê só as seções vivas; `concluir` recusa com `IA_SAIDA_INVALIDA` o código fora dos candidatos do recorte da própria seção); `packages/core/src/material/agendamento-da-classificacao.repository.ts`; `packages/core/src/ia/tasks/classificar-secoes.ts` | `apps/api/src/material/classificacao.int.test.ts` (worker real, caminho feliz, vaga por escola, janela letiva, degradação, entrega dupla, P1a, P4, P4b, isolamento, log); `agendamento.int.test.ts` (rotina das 19h, teto de 3 noites, laço, limite da noite, P9); `recorte.int.test.ts` (o PATCH de recorte limpa a classificação da IA e mantém a corrigida, P10, P11) | Amostra fixa existe (`docs/aia/ouro-retido/RETIDOS.json`), a taxa mínima está declarada e o código fora do recorte é recusado. A taxa **não foi atingida** no modelo local (qwen3.6-35b-a3b): 86,8 % para alvo de 90 %, EM 72,2 % para alvo de 80 %, injeção obedecida em 2 de 4. A taxa que decide é a do modelo da produção, antes da primeira escola real, por decisão do Joaquim registrada na Tech Spec §7b e no `TODO.md`. A função segue ligada e suspensível. Ver a seção 6 |
| RF6 | ATENDIDO | `apps/api/src/material/secoes.repository.ts:301` (`saveClassificacao` grava só com `isNull(corrigidaEm)` e trava a linha com `for update`); `saveCorrecao` (origem `coordenacao`, `corrigida_em`); `habilidadesDasPaginas` (a corrigida vale na geração) | `apps/api/test/classificacao-da-coordenacao.int.test.ts` (PUT; recusas; coordenador eliminado; "a correção é final"; P1b, P2, P3, P5, P9; D76); `apps/api/test/geracao-pela-secao.int.test.ts:144` ("a correção vale na geração seguinte"); auditoria com autor em `packages/core/src/auditoria/acoes.ts` | Mutação M1 vermelha. Tela: V `coordenacao--coordenacao-material--Materiais-Química-2-apostila-da-vitrine--{computador,celular}.png`; S `painel-cap1..5-computador.png` (os cinco estados: "Sugerida pela IA", "Corrigida pela coordenação", "A IA não achou habilidade neste capítulo", "A classificação não terminou." com "Reclassificar", "Ainda não classificado"); S `painel-seletor-computador.png` (seletor com filtro, "2 de 5 escolhidas" e o aviso "A correção vale no lugar da IA e não é refeita ao reclassificar") |
| RF7 | ATENDIDO | `apps/api/src/artefato/conferencia.ts:11` (`anularHabilidadesForaDaSecao`); `apps/api/src/artefato/ferramentas.command.ts:54`; `exigirAdaptacaoFiel` (a adaptação mantém a habilidade) | `apps/api/test/geracao-pela-secao.int.test.ts` (a habilidade de outra seção sai anulada na gravação; o plano leva a união das seções citadas; recorte atual; virada do ano; isolamento); `apps/api/src/tutor/tutor-modelo.int.test.ts:240` e `packages/core/src/ia/tasks/turno-do-tutor.test.ts:1092` (o Tutor não recebe a habilidade da seção) | Mutação M2 vermelha. Tela: V `professora--professor-artefatos-…--{computador,celular-1,celular-2}.png`: questão 1 com "Habilidade EM13CNT203 … Capítulo 2 · Estequiometria (Páginas 9 a 16)" e a questão 2 com "Sem habilidade". O **código** é conferido, a **descrição** não: achado maior 2 |
| RF9 | ATENDIDO | `apps/api/src/artefato/artefato.service.ts:202` (`trocarHabilidade`, com a descrição relida de `habilidade_bncc`); `PATCH /v1/artefatos/:id/questoes/:indice/habilidade` | `apps/api/test/troca-de-habilidade.int.test.ts` (a troca; o diagnóstico usa a trocada; a base fica intacta; recusas; CONFLITO; P6a, P6b, P7; adaptação; tetos) | As duas partes do critério ("o diagnóstico usa a trocada" e "a base fica intacta") têm caso próprio. Tela: V `professora--professor-artefatos-…--Trocar--{computador,celular-1..7}.png`, com o seletor aberto ("Filtrar por código ou texto", "0 de 1 escolhidas", lista da área CNT) |
| RF12 | ATENDIDO | `POST /v1/materiais/:id/reclassificar` e o comando D76 `reclassificar-escola`, pelo agendamento (sem storage) | `apps/api/test/classificacao-da-coordenacao.int.test.ts` ("reclassificar sem storage" preserva a corrigida; tetos de 100 por pessoa e 300 por escola; D76) | "Conclui sem arquivo e preserva a correção": os dois têm caso próprio. Tela: o botão "Reclassificar" do painel e da seção que não terminou (S `painel-habilidades-computador.png`, `painel-cap4-computador.png`) |
| RF15 | ATENDIDO | rotina das 19h e job por escola no `worker-lote` | Carga rodada em 18/11 e registrada em `5_task.md`: 7.500 seções em 630 execuções, nenhuma sem classificação, 4,4 execuções/min (2,4 h da noite); Tutor da escola B com +35 ms; retomada depois de 10 min com o `worker-ia` parado | Rodou com adaptador falso e com o Tutor da B a 30 turnos/min, não a 90. A divergência está registrada na tarefa. O tempo do modelo real fica junto com a medida da produção (seção 6) |
| RF19 | ATENDIDO | `apps/api/src/material/cobertura.repository.ts` (`serieDaEscola:63` com escopo; `habilidadesDaSerie`; `materialEmUso`; `secoesSemClassificacao`) | `apps/api/test/cobertura.int.test.ts` (o material excluído faz a habilidade voltar; licença vencida e `processando` não cobrem; `EF69LP01` por ano; EM por área; suspensão; isolamento; `EXPLAIN`) | Mutação M3 vermelha. Tela com dado: S `cobertura-computador.png`, com o 2º EM, "Ciências da Natureza · 23 de 26 habilidades sem material" (as 3 do material semeado saíram), "2 capítulos ainda sem classificação" e o aviso. A página não rola a 1366 × 768 (altura medida de 768): só a lista rola. Sem série: V `coordenacao--coordenacao-material--computador.png`. Escola vazia: V `vazia--coordenacao--coordenacao-material--Cobertura--{computador,celular}.png`. A cobertura com série no celular não foi fotografada (o seletor `<select>` não é alcançável pela vitrine), e o e2e `material-cobertura.spec.ts` a cobre no projeto `celular` |
| RF20 | ATENDIDO | escopo `requireEscolaId()` em todo repository do módulo; os três `@Unscoped` só leem a tabela pública da BNCC | casos de isolamento em `classificacao.int.test.ts`, `classificacao-da-coordenacao.int.test.ts`, `geracao-pela-secao.int.test.ts`, `troca-de-habilidade.int.test.ts`, `cobertura.int.test.ts`, `recorte.int.test.ts` e `material-edicao.int.test.ts` (herança da edição: a anterior da B nunca é lida) | Mutação M3 provou que um deles é efetivo. 404 igual para o id inexistente e para o id da outra escola |

Provas de mutação (cada uma restaurada com `git checkout -- <arquivo>`; a árvore terminou limpa):

| RF | Cláusula removida | Teste que ficou vermelho |
|---|---|---|
| RF6 | `isNull(secaoDoMaterial.corrigidaEm)` no `where` de `saveClassificacao` (`apps/api/src/material/secoes.repository.ts:301`) | `apps/api/src/material/classificacao.int.test.ts` › P1a ("AssertionError: expected {…} to deeply equal {…}"): a IA sobrescreveu a correção |
| RF7 | a anulação em `anularHabilidadesForaDaSecao` (`if (true \|\| …) return questao`, `apps/api/src/artefato/conferencia.ts:17`) | `apps/api/test/geracao-pela-secao.int.test.ts` › "…anulada na gravação…" ("expected { codigo: 'EM13CNT102' } to be null") |
| RF19/RF20 | `eq(serie.escolaId, requireEscolaId())` em `serieDaEscola` (`apps/api/src/material/cobertura.repository.ts:63`) | `apps/api/test/cobertura.int.test.ts` › "a série da outra escola…" ("expected { status: 200 } to deeply equal { status: 404 }") |

### 2. Regras de negócio, casos de borda e critério de pronto

| Item | Situação | Evidência |
|---|---|---|
| Regra: material e classificação não variam por ano letivo | cumprida | `secao_do_material` sem `ano_letivo_id`; "virada do ano" em `geracao-pela-secao.int.test.ts` |
| Regra: a correção humana vence a da IA, sempre | cumprida | M1; P1a e P1b; "reclassificar a mantém"; herança na edição nova (`material-edicao.int.test.ts:968-1009`, `extrair-pdf.int.test.ts:1256`) |
| Regra: toda saída cita material, edição e página | cumprida | `exigirCitacoesEntregues` em `ferramentas.command.ts`; citação na tela do artefato (fotos do RF7) |
| Regra: a classificação só chega ao aluno pela atividade aprovada | cumprida | o Tutor não recebe a habilidade da seção (`tutor-modelo.int.test.ts:240`, `turno-do-tutor.test.ts:1092`); o aluno não tem rota de classificação |
| Regra: ingestão e classificação em lote, com limite por escola | cumprida | fila `lote`, vaga por escola, janela, tetos de reclassificar (`classificacao.int.test.ts`, `classificacao-da-coordenacao.int.test.ts`) |
| Borda: apostila do 1º e do 2º ano | coberta | `material_serie` (F4); a cobertura conta por série em `cobertura.int.test.ts` |
| Borda: `EF69LP` vale do 6º ao 9º | coberta | `componentes.test.ts`; "`EF69LP01` por ano" em `cobertura.int.test.ts` |
| Borda: Química no EM usa `EM13CNT` | coberta | `componentes.test.ts` (`EM13CNT301` em Química e Física); a foto da cobertura mostra a área CNT no 2º EM |
| Borda: material sem capítulo | coberta | `extrair-pdf.int.test.ts:1013`; `packages/core/src/material/secoes.test.ts:20` (25 páginas em 1–10, 11–20, 21–25); a foto mostra "Páginas 21 a 30" |
| Borda: duas colunas, fórmula quebrada | justificada | é da extração da F4; esta spec não a muda |
| Borda: edição nova enquanto a anterior processa | coberta (F4) | `material-edicao.int.test.ts`; P4 e P4b para o `concluir` da classificação |
| Borda: licença vence com rascunho citando o material | coberta | licença vencida em `cobertura.int.test.ts` e na busca da geração (F4) |
| Borda: coordenação corrige enquanto a reclassificação roda | coberta | P1a com a mutação M1 |
| Pronto: tabela BNCC carregada e conferida; catálogo próprio fora (RF1, RF2) | cumprido | RF1 e RF2 acima |
| Pronto: classificação à noite no worker, teto de 3, degradação, alerta `classificacao-atrasada` com runbook, 300 apostilas numa noite (RF5, RF15) | cumprido | `agendamento.int.test.ts`; `docs/runbook.md:988`; carga da 5.0 |
| Pronto: mudança de recorte limpa a IA e agenda; a corrigida fica | cumprido | `recorte.int.test.ts` |
| Pronto: a correção vence, inclusive na edição nova; reclassificar e D76 não a tocam (RF6, RF12) | cumprido | M1; `material-edicao.int.test.ts:968-1009`; `classificacao-da-coordenacao.int.test.ts` |
| Pronto: habilidade da seção ou nenhuma; troca antes de aplicar; Tutor sem a habilidade (RF7, RF9) | cumprido | RF7 e RF9 acima. A descrição sem conferência é o achado maior 2 |
| Pronto: cobertura por série e componente (área no EM) com o filtro da F4 (RF19) | cumprido | RF19 acima |
| Pronto: `classificacao_do_material` em "Como cada IA trabalha", suspensível, AIA revista, taxa medida no lote retido antes da 10.0 | cumprido | `packages/shared/src/time/funcoes.ts:59`; `packages/shared/src/governanca/governanca.test.ts:105-119`; `RETIDOS.json` com `medidaLocal`. A taxa foi medida, mas não atingida localmente (ver RF5) |
| Pronto: nada de uma escola aparece para outra (RF20) | cumprido | RF20 e M3 |
| Pronto: contração da F4 (9.0) com o `DROP COLUMN` de `material.licenciante` no `TODO.md` | cumprido | `packages/core/src/db/contracao-da-f4.int.test.ts`; entrada no `TODO.md` |
| Pronto: modelo de dados, LGPD, runbook, interface e AIA atualizados | cumprido | `docs/lgpd.md:101` (`corrigida_por` e as ações), `docs/runbook.md:988`, `docs/interface.md` (Parte A) |
| Pronto: passo 1 do roteiro da demonstração conferido contra o e2e | cumprido | `docs/roteiro-da-demonstracao.md:186-190` e `e2e/roteiro-da-demonstracao.spec.ts:368-378` ("4b. A habilidade do capítulo 7, corrigida no painel") |
| Pronto do ROADMAP (F4b) | cumprido | classificado por BNCC e usado na geração; a correção vence; a cobertura mostra a série sem material |

### 3. Portão

Escopo de funcionalidade completa: não rodei suíte inteira (D79). Rodei só os testes que servem de evidência, isolados.

| Portão | Resultado |
|---|---|
| `npm run typecheck` | não rodado: esteira |
| `npm run lint` | não rodado: esteira |
| Integração, três casos de evidência (P1a; habilidade anulada na gravação; série da outra escola), isolados | ✅ 3 passaram antes das mutações; cada um ficou ❌ com a sua mutação e voltou ao verde com a restauração |
| `node tools/ci/e2e.ts --manter-ambiente e2e/classificacao-bncc.spec.ts` | ✅ 12 passaram (46,4 s), nos projetos `chromebook` e `celular`, com axe, sem rolagem horizontal e sem vocabulário de nota |
| Sonda da descrição (script no scratchpad, `descricao.ts`, chamando `problemasDasQuestoes` e `anularHabilidadesForaDaSecao`) | mostra o achado maior 2: `[]` problemas, 0 anuladas, a descrição inventada gravada |
| Esteira do GitHub | esteira: conferida no fechamento (D79), não entra no veredito |
| Revisões com veto registradas e aprovadas | ✅ nas 13 tarefas a última rodada de cada revisor com veto é APROVADO. A 4.0 e a 5.0 mostram só as rodadas 2 e 3 (a seção da 4.0 se perdeu, registrado no `estado.md`) |

Processo:
- Revisão da spec: `revisao-spec.md`, rodada 6, APROVADA.
- Nenhum commit com código sem `(tarefa N.0)` ou `(correção …)`. O `3209137c` (lote retido) só traz docs.
- Nenhum commit `Fora do processo:` na spec (`git log origin/develop..HEAD -i --grep='^Fora do processo:' -- apps packages infra e2e tools` vazio).
- Divergências da Tech Spec registradas na §11, menos a do `@Unscoped` (achado maior 1).
- As recomendações dos revisores têm destino: o `TODO.md` (102 entradas da spec) ou o documento da tarefa (`achados/indice.md`).

### 4. Achados

**Críticos**
- Nenhum.

**Maiores**
1. **Três `@Unscoped` novos no mesmo módulo, contra a Tech Spec e sem registro.** `apps/api/src/material/secoes.repository.ts:145` (`candidatas`), `:268` (`descricaoDaHabilidade`) e `apps/api/src/material/cobertura.repository.ts:71` (`habilidadesDaSerie`). A Tech Spec §6 diz "nenhum `@Unscoped` novo", e a §11 não registra o desvio. É o terceiro no mesmo módulo, o sinal de desenho que a regra 10, item 9, aponta ("se aparecer uma terceira dessas no mesmo módulo, tem algo errado no desenho"). Na 11.0 o tenancy-guardian recusou juntar porque "são duas", e a 13.0 trouxe a terceira. **Não é vazamento**: os três só leem `habilidade_bncc`, que é pública (regra 10, item 1). Correção: um repository único de leitura da BNCC (no `packages/core/src/bncc/`, declarado como tabela pública, sem `@Unscoped`, ou com um só), usado pelos dois repositories, e o registro na Tech Spec §6 e §11.
2. **A descrição da habilidade gravada na questão é a que o modelo escreveu, sem conferência contra a BNCC.** `problemasDasQuestoes` (`packages/core/src/ia/tasks/gerar-atividade-objetiva.ts:49`) e `anularHabilidadesForaDaSecao` (`apps/api/src/artefato/conferencia.ts:17`) comparam só o `codigo`. A sonda mostrou: questão com `EM13CNT203` e descrição "Calcular quantidades em reações químicas (texto inventado pelo modelo)" passa pela conferência (`[]`), não é anulada e é gravada assim. Essa descrição aparece na tela do artefato ("Habilidade EM13CNT203: …"), e o diagnóstico a usa como texto da habilidade: `apps/api/src/atividade/desempenho/desempenho.repository.ts:94-107` lê `questao -> 'habilidade' ->> 'descricao'` do conteúdo, e o comentário da linha 94 ainda diz "o catálogo é nosso, em código". Em Turmas, no resultado do aluno e no Analista, a escola veria uma paráfrase da IA rotulada como habilidade da BNCC, que é o que o PRD (§1) quer acabar. O código, que é o que o diagnóstico conta, está certo; por isso não rebaixa o RF7. A troca (RF9) já faz o certo: relê a descrição de `habilidade_bncc`. Correção: na gravação (`anularHabilidadesForaDaSecao`), trocar a descrição pela do trecho entregue (a da tabela, cortada em 300), e o diagnóstico ler a descrição de `habilidade_bncc` pelo código; teste que grava descrição divergente e confere a oficial no artefato e no diagnóstico.

**Menores** (a lista com dono e arquivo está na seção 6)
- `apps/web/src/api/estrutura.ts:113`: `openAnoLetivo` (rota `/abrir`, da correção `metodos-de-mercado`) é ato de domínio, como `renomearDisciplina`, `definirComponenteDaDisciplina` e `alocarProfessor`, e pela regra 60, item 1, deveria ser `abrirAnoLetivo`. O Orquestrador deixou a decisão para a validação, e a decisão é renomear.
- `tasks/prd-classificacao-bncc/tasks.md`: os subitens 7.x, 12.x e 13.x estão `[ ]`, com as tarefas `[x]`.
- `tasks/prd-classificacao-bncc/techspec.md:4`: a Tech Spec segue com "Status: rascunho".
- O `domain-researcher`, obrigatório na 1.0, não tem rodada na seção "Revisões": o hook não o conta como revisor. A pesquisa ficou como a conferência 1.2, com hash. Fica como registro de processo.
- A vitrine não tem material, seção nem artefato classificado: as telas desta spec não se fotografam sem semear dado à mão (foi o que fiz aqui). A ferramenta de foto também não escolhe opção de `<select>`, e o nome da foto ignora a query da URL (`?aba=cobertura` sobrescreve a de `/coordenacao/material`).
- Painel "Ano letivo e disciplinas" a 1366 px (V `coordenacao--coordenacao-estrutura--Ano-letivo-e-disciplinas--computador.png`): os três botões de cada disciplina quebram de jeito diferente em cada linha (Física 2 + 1, Química 1 + 1 + 1). Não é defeito da lista bloqueante; é acabamento.
- Registro (decisão da Tech Spec §8): não há histórico das habilidades `origem: 'ia'` descartadas na correção ou na reclassificação. A conformidade deixou o ponto para a validação e o dossiê. A auditoria guarda o "antes" da correção, o que basta para "o que a IA gerou, quem corrigiu e quando" (regra 70, item 6). Fica para o dossiê.

**Positivos**
- Os cenários de concorrência numerados (P1 a P11), cada um com a mutação que o derruba escrita no `cenarios.md`: as três mutações desta validação caíram em teste já existente, com a mensagem certa.
- A tela distingue os cinco estados da seção em linguagem de escola ("A IA não achou habilidade neste capítulo", "A classificação não terminou.") e põe o aviso da correção ("não é refeita ao reclassificar") dentro do seletor, onde a decisão acontece.

### 5. Conclusão

APROVADA COM RESSALVAS. Todos os 10 RF estão ATENDIDOS, com código, teste lido e, nos que têm tela, foto lida. O critério de
pronto da funcionalidade e o "Pronto quando" do ROADMAP estão cumpridos. As três mutações nos RF de maior risco
(correção × IA, habilidade fora da seção, isolamento da cobertura) ficaram vermelhas, e o e2e do fluxo inteiro passou.
Não há crítico nem teste vermelho.

As duas ressalvas são maiores e pontuais, e nenhuma bloqueia a próxima funcionalidade:
1. os três `@Unscoped` sobre a tabela pública, sem registro na Tech Spec (desenho, não vazamento);
2. a descrição da habilidade, que vem do modelo e não da tabela (texto exibido; o código está certo).

Para chegar a APROVADA: corrigir a 2 (anular ou normalizar a descrição na gravação, e o diagnóstico ler da tabela) e a 1
(repository único da BNCC, ou o registro do desvio na Tech Spec §6 e §11), as duas pela skill `corrigir`, com revalidação.

### 6. Pendências herdadas

| Pendência | Dono | Arquivo | Destino |
|---|---|---|---|
| Taxa da classificação no modelo da produção (90 % geral, 80 % EM, injeção 0), antes da primeira escola real; local não atingida. Incluir no "Portão da primeira escola real" do ROADMAP, além do `TODO.md` | Joaquim (D37) | `docs/aia/ouro-retido/RETIDOS.json`, `ROADMAP.md` | `TODO.md` (já está) e ROADMAP |
| Conferência da classificação por professor de cada área, no lote retido | Joaquim | `docs/aia/ouro-retido/` | `TODO.md` (já está) |
| Tempo de RF15 com o modelo real (a carga usou adaptador falso e Tutor a 30 turnos/min) | Arquiteto | `tasks/prd-classificacao-bncc/5_task.md` | junto com a medida da produção |
| `openAnoLetivo` → `abrirAnoLetivo` | Implementador | `apps/web/src/api/estrutura.ts:113` | `TODO.md` |
| Marcar os subitens 7.x, 12.x e 13.x | Orquestrador | `tasks/prd-classificacao-bncc/tasks.md` | no fechamento |
| Tech Spec de "rascunho" para o status final | Arquiteto | `tasks/prd-classificacao-bncc/techspec.md:4` | no fechamento |
| O `domain-researcher` contado pelo hook como rodada | Arquiteto | `.claude/skills/seguir/time.md` e o hook de commit | retro |
| Vitrine com material classificado e artefato com habilidade; a foto escolher opção de `<select>`; o nome da foto levar a query | Arquiteto | `tools/vitrine/` | `TODO.md` |
| Botões das disciplinas no painel "Ano letivo e disciplinas" quebrando de jeito diferente por linha | Implementador | `apps/web/src/areas/coordenacao/estrutura/` | `TODO.md` |
| Histórico das habilidades `origem: 'ia'` descartadas (Tech Spec §8) | Arquiteto | `docs/conformidade-mec.md` (dossiê) | próxima spec que mexer no dossiê |
| Commits `Fora do processo:` com código | — | — | nenhum nesta spec |
