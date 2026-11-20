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

`packages/core` (`bncc/`, `db/schema/`, `ia/`, `material/`: o agendamento da classificação e a medição do alerta, que a extração e o job da escola usam e que nenhum `app` importa de outro); `apps/api/src/` (`ia`, `material`, `ops`, `estrutura`, `artefato`,
`atividade`, `governanca`, `tutor`); `apps/worker` (extração; a rotina das 19h, o job da escola e a medição do alerta, no `worker-lote`); `packages/shared` (sai `habilidades.ts`); `apps/web`.

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
                  on delete cascade; FK (escola_id, execucao_id) on delete set null ("execucao_id") (o expurgo da execução não trava na seção, e ela volta a `nao_agendada`); FK (escola_id, corrigida_por) on delete set null ("corrigida_por"); check: `corrigida_por` só com `corrigida_em`
habilidade_da_secao escola_id, secao_id, codigo (FK habilidade_bncc), origem ('ia' | 'coordenacao')
                  pk (escola_id, secao_id, codigo); FK (escola_id, secao_id) on delete cascade
execucao_agente   ano_letivo_id passa a aceitar nulo, só em `classificar_secoes` (check)
```

**A marca da correção é `corrigida_em`** (a eliminação do titular não a toca); `corrigida_por` é só autoria. O material
não tem ano (PRD F4, §6), nem a execução da classificação; a virada não a afeta.

**Carga:** o JSON da release `dados-2026.08` do `bncc-dados` (CC BY 4.0), reduzido a código, texto, componente, anos
(6 a 9) e área, versionado com a atribuição; `on conflict (codigo) do update`, com a versão. Código nunca sai. **A lista fechada dos códigos** (7.0): `CODIGOS_DA_BNCC` em `packages/shared/src/bncc/codigos-da-bncc.ts` (os 913 da `dados-2026.08`, em ordem), de onde o `PUT` e a consulta das candidatas tiram o `z.enum` e a auditoria tira o tipo do código (ela só aceita id, enum, booleano, número ou data). O teste `packages/core/src/db/bncc/codigos-da-bncc.test.ts` confere a lista contra o JSON da carga nos dois sentidos, e **carga nova precisa**: gerar a lista de novo (o teste reprova a que ficou para trás) e apontar o teste para o JSON da nova versão. Código com formato válido que a tabela não tem é `ENTRADA_INVALIDA`, e a correção de uma seção que a IA classificou com código fora da lista não existe (o `concluir` só grava candidata do recorte, e a candidata sai da tabela). Sem
Computação (a D65 fica no `TODO.md`). **Componentes:** `COMPONENTES_BNCC` em `packages/shared` diz as candidatas (EF:
componente e anos das séries; EM: a área, e Língua Portuguesa com `EM13LP` e `EM13LGG`; série do EF e do EM no mesmo
material: a união; **a BNCC do Fundamental não tem Biologia, Física nem Química, e o conteúdo delas está em Ciências (`CI`): no EF elas procuram em `CI`, e Filosofia e Sociologia não têm candidata do EF**). A tabela leva, além do check do código, o do recorte da etapa (EF com componente e anos de 6 a 9, EM com área e sem anos) e o dos valores de componente e área; o JSON traz no cabeçalho o hash do PDF e o das habilidades, e a única diferença de texto contra o PDF (`EF07MA33`, o π que a camada de texto dele não traz) fica registrada ali, e o PDF vence. A migration preenche o componente pelo nome sem acento nem caixa; o que não casa fica nulo. A disciplina criada depois
casa igual (`DisciplinaRepository.criar`); renomear não o muda. O `PATCH` roda numa transação com a linha da disciplina travada (`for update`) e só audita quando o componente muda: o mesmo componente de novo responde 200 e não grava nada.

**Migrations** (regra 80, item 9, todas com `lock_timeout`): (1) tabelas, coluna, carga, o `unique` do capítulo;
`execucao_agente.ano_letivo_id drop not null` (metadado); o check novo do ano e os de função e tarefa de
`execucao_agente`, `consumo_ia` e `suspensao_de_funcao` (sem o último a coordenação não consegue suspender a função) entram por
`ADD … NOT VALID` e `VALIDATE` (como a `0036`), antes do código que grava a função; o check do `resultado` (`execucao_agente_resultado_so_na_concluida`) ganha o tipo `classificacao_do_material` na mesma forma (a `0063`, da 4.0: a execução que conclui sem modelo precisa de `resultado`); (2) seções dos materiais `pronto` existentes, em lotes de 1.000, sem execução (a rotina das 19h as agenda);
(3) **contração da F4** (abertura, item 4), em três passos: nesta spec, o backfill de séries e licenças de novo
(idempotente), o check `(titularidade = 'terceiro_com_licenca') = (licenca_id is not null)` com `NOT VALID` e `VALIDATE`,
a saída dos dois checks de `licenciante` e o código que não lê nem grava a coluna (fora do schema Drizzle); o
`DROP COLUMN` vai ao `TODO.md`, para o deploy seguinte. **A `0065_contracao_da_f4`** (9.0) faz os quatro passos numa migration só, e o licenciante que a API devolve vem da licença (`licenca_de_material`).
O check novo é `material_terceiro_tem_licenca`. Ele **impede** a volta para **antes da F4**, a menos de um passo a mais: o bloco 1 do `docs/runbook.md` ("Voltar o código depois da F4") solta o check e copia o licenciante da licença para a linha, e o bloco 2 o põe de volta (`NOT VALID` e `VALIDATE`);
a volta para o código da F4 anterior à 9.0, que cumpre o check mas **lê** `material.licenciante` (o código da 9.0 não o grava mais), pede só a cópia do licenciante da licença para a linha, no bloco "volta ao código da F4" do mesmo runbook; depois do `DROP COLUMN` essas voltas deixam de existir.

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
| GET | `/v1/artefatos/:id` | professor | — | + `secoesDasQuestoes[]` (uma posição por questão: o capítulo ou as páginas e as habilidades da seção **de agora**, com a `origem`; `null` sem seção) e `classificacaoSuspensa`, para a tela pôr o capítulo e as da seção primeiro na troca (11.0; sem `corrigida_por` nem `execucao_id`) |

**Ordem das respostas:** primeiro o objeto no alcance (material da F4; `artefatoId` só do dono; série da escola), senão
`NAO_ENCONTRADO`, igual ao inexistente; depois `ENTRADA_INVALIDA` (código fora do recorte atual); depois `CONFLITO`
(material não `pronto`, disciplina sem componente, artefato aplicado ou com versão adaptada) e `FUNCAO_SUSPENSA`
(reclassificar suspenso). **Na correção** (`PUT`), disciplina sem componente responde `CONFLITO` antes de olhar os códigos: sem componente não há recorte para comparar, então o recorte vem primeiro e depois, com ele, `ENTRADA_INVALIDA` (código fora do recorte) vem antes do `CONFLITO` do material não `pronto`. Em `GET /v1/habilidades-bncc`, a coordenação alcança só `materialId`: o `artefatoId` é do professor dono, e para a coordenação dá `NAO_ENCONTRADO`. Sem componente, `GET /v1/habilidades-bncc` devolve lista vazia com `semComponente`, e a
troca só aceita `null`. `/cobertura` vem antes de `:id`. Tetos por pessoa e escola (429, `Retry-After`): `PUT` 300/h e
900/h, reclassificar e troca 100/h e 300/h, contados na auditoria. A rede não alcança nada disto.

## 5. Fluxo

**Seções.** Na transação da extração, depois dos capítulos (só quem fez a transição para `pronto`, então a reentrega
não duplica): uma seção por capítulo, ou por bloco de 10 páginas; páginas antes do primeiro capítulo ficam sem seção.
Com componente e a função ativa, nascem ali as execuções `classificar_secoes` (12 seções cada, sem pessoa nem ano) e os jobs `ia.executar-lote` (fila `lote`, `naoUrgente: true`, executor `api`, chave = execução); cada seção
guarda o `execucao_id`. **Edição nova:** a seção cujo capítulo tem o mesmo número e título (sem acento nem caixa) de uma
seção corrigida da anterior herda as habilidades (com a origem que tinham) e `corrigida_em` (sem `corrigida_por`), com
`material.classificacao_herdada` na auditoria (autor `rotina`, só quando alguma herdou; leva o material de onde veio e a contagem); as outras vão à IA. **Capítulo sem número não casa**, a seção de bloco de páginas não herda, e a anterior só classificada pela IA (sem `corrigida_em`) não conta.

**Agendar** (job `material.agendar-classificacao`, fila `lote`, `naoUrgente`, por escola, lotes de 500 seções, cada um numa transação; seção
com `falhas_seguidas > 0` vai numa execução só dela). O trabalho mora no `core` (`AgendamentoDaClassificacaoRepository`): a extração (fila `pdf`) e o job da escola (`worker-lote`) o chamam na transação deles, e as seções de um mesmo componente e das mesmas séries vão juntas, até 12 por execução. (a) **A rotina das 19h** (`sistema.agendar-classificacao`, em `JOB_SCHEDULES`, `0 19 * * *` de São Paulo) só grava um job por escola, com a data local da noite no fuso dela por chave, e o job da escola faz o laço: cada lote começa depois da última seção do anterior, para quando o sinal aborta, a função está suspensa ou a escola já ganhou **1.000 execuções** na noite (`EXECUCOES_POR_NOITE_DA_ESCOLA`, 12 mil seções: o dobro das 7.500 de 300 apostilas), e o resto sai na noite seguinte. Pega a seção não corrigida de material `pronto` com
componente **sem execução, ou com a última `falhou` e `falhas_seguidas < 3`**; nunca `classificada` nem `sem_habilidade`.
(b) **A mudança de recorte** (`PATCH` do componente, ou de séries quando o conjunto muda) só enfileira o job do material ou da
disciplina (`materialId` ou `disciplinaId` nos dados do mesmo tipo da rotina, que sem dados é a rotina; chave: um UUID novo por `PATCH`, gravado na transação da auditoria, que não devolve o id da linha); ele lê o recorte atual, **limpa** as não corrigidas e, com componente, agenda. **Limpar:** lê a
seção `for update`, anula o `execucao_id`, apaga as `origem: 'ia'` e zera `falhas_seguidas` (P10). Função suspensa: limpa e não agenda. Agendar troca o `execucao_id` com a mesma
condição (P9). As candidatas são lidas no `preparar`; sem candidatas, conclui sem modelo e limpa as seções com
`execucao_id = :esta` (P11).

**Classificação** (`main-worker`, contexto da rotina: a escola do job, sem pessoa nem ano). O `ExecucaoProcessor` aceita
`quemPediu` ausente só em comando `daRotina` (extração, rotina, reclassificar, D76), que lê a execução sem ano (o `ExecucaoRepository.paraIniciar` já a lê: o `anoLetivoId` de quem pediu é o do `join` com o ano em curso, nunca a coluna nula). Até a 4.0 registrar o comando, `classificar_secoes` fica em `TAREFAS_SEM_CHAMADOR` (`registro-de-comandos.ts`). Antes de
`rodando`, confere a janela letiva (dentro dela, adia até o fim, motivo `janela`, com jitter) e a suspensão. O `preparar` lê só as seções
vivas (`execucao_id = :esta`, `corrigida_em` nulo, material `pronto` e não excluído); sem nenhuma, conclui sem modelo e
sem consumo, com o `resultado` `{ tipo: 'classificacao_do_material', secoes }` (o número de seções gravadas, nunca código nem texto). A entrada leva, por seção, título, até 1.500 caracteres do começo e até 500 das linhas de subtítulo,
delimitados como dado, com as candidatas no começo; saída de 0 a 3 códigos por seção, teto de 800 tokens; fora das
candidatas ou do formato, `IA_SAIDA_INVALIDA`. **A execução é de um recorte** (a 5.0 agrupa as seções por componente e séries do material, em execuções de até 12), mas o comando não confia nisso: as candidatas dos recortes que vierem juntos são unidas, na ordem do código e **sem corte** (acima de 300 o gateway recusa a entrada, `IA_ENTRADA_INVALIDA`, sem chamar o modelo e sem somar `falhas_seguidas`), e o `concluir` só grava o código que é candidato do recorte da **própria** seção (`habilidadeEhCandidata` com o componente e as séries do material dela; senão `IA_SAIDA_INVALIDA`, sem gravar, e a falha soma). A seção de material sem série, ou de disciplina sem componente, não vai ao modelo e volta a `nao_agendada` (o mesmo "limpar" de P11). **Duas entregas ao mesmo tempo** do mesmo job: a segunda acha a execução `rodando` e a encerra `EXECUCAO_INTERROMPIDA` (6.0), a gravação da primeira se desfaz e as seções ficam como estavam; a rotina as agenda de novo. O `concluir` relê o material `for share` (`pronto`, não excluído) e grava
cada seção `where execucao_id = :esta and corrigida_em is null`, `for update`, zerando `falhas_seguidas`; senão conclui
sem efeito.

**Degradação do lote.** `classificar_secoes` entra em `TAREFAS_SEM_MODELO_MENOR`: nunca desce a modelo sem medida.
O gateway marca o `IA_INDISPONIVEL` com o motivo (`sem_vaga`, `disjuntor`, `soberania`) e a chamada que não saiu com `semEnvio`; só a soberania é definitiva. Balde `lote` cheio, disjuntor aberto ou provedor fora (`IA_INDISPONIVEL` transitório): a execução volta a `pendente` e o
job é adiado (`JobAdiadoError`, motivo `provedor`, `baseMs` do balde ou do disjuntor, com jitter), sem tentativa; consumo
só se uma chamada saiu. O adiamento que cai na janela letiva é segurado pela conferência acima. Termina `falhou` o erro
definitivo (`IA_SAIDA_INVALIDA`, `EXECUCAO_INTERROMPIDA`, `FUNCAO_SUSPENSA`, recusa de soberania); só `IA_SAIDA_INVALIDA`
soma 1 em `falhas_seguidas` das seções da execução (`execucao_id = :esta`), na transação da passagem a `falhou`. Com 3, a seção espera o reclassificar.

**Reclassificar** (RF12) e o comando D76 (`reclassificar-escola`, com chamado, em lotes de 500): as seções não corrigidas e
sem execução `pendente` ganham execução nova (`solicitada_por` nulo, `falhas_seguidas` zerada); a antiga conclui sem
efeito. O texto vem dos `trecho`. A trava é só a das seções (`for update ... of secao_do_material`, em ordem de `id`, com o `limit` do lote), a execução de cada uma é lida depois dela, em outro comando, e o lote é lido a partir de um cursor (`depoisDe`, obrigatório; o primeiro é `ANTES_DA_PRIMEIRA_SECAO`). O comando D76 confere a escola e a função ativa **em todo lote**, não só no primeiro: a suspensão entre dois lotes para o comando com `FUNCAO_SUSPENSA` e deixa só o que os lotes anteriores fizeram. **O comando não aplica o limite de execuções por noite da rotina** (`EXECUCOES_POR_NOITE_DA_ESCOLA`): é pedido da operação, por chamado, e o runbook manda rodar fora do horário e avisa disso. **Correção** (RF6):
`for update` na seção, troca as habilidades (`origem: 'coordenacao'`) e grava `corrigida_em`; é final.

**Suspensão** de `classificacao_do_material`: a geração, a troca e a cobertura ignoram `origem: 'ia'` (vale só a
correção); reclassificar e D76 recusam; a rotina não agenda; o painel diz por quê. Retomada: a rotina das 19h agenda.

**Geração** (RF7, RF2). A busca da ferramenta devolve, com cada trecho, as habilidades da seção da página,
filtradas pelo recorte atual da turma (a geração que o chat pede passa pela mesma busca; a **proposta** do chat, que só
escolhe a ferramenta e os parâmetros, não tem campo de habilidade e não a recebe). A descrição acima de 300 caracteres (162
habilidades da BNCC passam disso, até 1.500) vai cortada em palavra, com reticências, no contrato da geração: o teto de 300
é o dos tetos de entrada medidos de Tutor, relatório e Analista, e o texto inteiro segue em `habilidade_bncc`. A tarefa escolhe, por questão, uma das da página citada, ou nenhuma; `habilidade`
aceita `null`, e o plano, `habilidades` vazia (a união das seções citadas). Habilidade fora da seção citada é anulada na
gravação, e `ia.habilidade_anulada` soma. **O Tutor não recebe** as habilidades da seção: a entrada dele segue com
`materialId`, `pagina` e `texto`, e a habilidade só chega pela atividade aplicada. O **teto de entrada** das duas tarefas de geração
(`gerar_atividade_objetiva`, `gerar_plano_de_aula`) é o do pior pedido, com os 12 trechos levando 5 habilidades distintas cada
(a união de 60): 31.300 tokens, e não os 26.100 de antes; o gerador de `teto-de-entrada.ts` monta itens distintos nas listas,
e um caso prova a união de 60. Sai o catálogo (`habilidades.ts`,
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
| Auditoria | `material.classificacao_corrigida` (antes e depois: os códigos, que são enum da lista fechada, §3), `material.classificacao_herdada`, `material.reclassificado`, `escola.reclassificada` (chamado), `artefato.habilidade_trocada`, `disciplina.componente_alterado` (a chave do job, §5) |
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
O que a coordenação lê ao suspender (`EFEITO_DA_SUSPENSAO.classificacao_do_material`): o material novo deixa de ser classificado
pela BNCC à noite, o pedido de classificar de novo é recusado, e a geração e a cobertura passam a valer só pelas habilidades que a
coordenação corrigiu.

**Classificação de texto.** (a) **Lote retido** `docs/aia/ouro-retido/classificacao-retido-1.json`, 48 seções
(`cenarios.md`, "Lote retido"), escrito por subagente em contexto limpo, revisto pelo `pedagogia-reviewer` e pelo
`conformidade-reviewer`, conferido por professor antes do primeiro aluno real (`TODO.md`); o prompt é escrito sobre um
conjunto `dev` próprio. (b) Sem padrão de texto. (c) Sondas do `test-engineer` na revisão da tarefa do prompt.

**Taxa mínima**, na pior de três execuções, saída inválida conta como erro: ≥ 90 % das seções com conteúdo com um código
da `referencia`, nenhuma etapa abaixo de 80 %; ≥ 80 % dos códigos propostos em `aceitaveis`; no máximo 1 de 6
`sem_conteudo_curricular` com código; nenhuma `injecao` obedecida. **Por questão:** a ferramenta gera 10 atividades
sobre seções do lote e lista questão e habilidade; o `pedagogia-reviewer` julga, ≥ 80 % coerentes. Mede o Arquiteto,
com o modelo local e o da produção (D37), por `tools/ia/medir-classificacao.ts`, **antes da troca do catálogo**,
registrando no `RETIDOS.json`. **A taxa que decide é a do modelo da produção**, antes da primeira escola real: sem ela
no `rapido`, `padrao`; sem ela no `padrao`, a função nasce suspensa em cada escola (D76, com chamado e motivo) e a decisão
é do Joaquim. A medida no modelo local é referência do ambiente de desenvolvimento e não suspende a função: em 19/11 ela
não atingiu a taxa (`RETIDOS.json`, `medidaLocal`), e o Joaquim decidiu a função ligada até a medida da produção.

## 7c. Carga e falha (obrigatório)

| Item | Resposta |
|---|---|
| Caminho quente | a seção da página, na geração (join por índice); sem classificação no horário letivo |
| Fila | `lote`, `naoUrgente`; o job de agendamento da escola e a rotina das 19h rodam no `worker-lote` (só banco e outbox, sem modelo); a execução, no pool `lote` do `worker-ia`, 1 por réplica; a varredura de execuções inclui a `lote` e casa o tipo do job com a fila (`ia.executar` nas três filas da IA, `ia.executar-lote` na `lote`): incluir só a fila deixaria o job `ia.executar` da `lote` segurar uma `pendente` que nenhum worker leva |
| Vazão | balde `lote` global, 5 % do contratado (125 mil tokens/min), ~12 mil por execução: ~10 execuções/min. **A 3.0 mediu o recorte maior (§8, a linha de `classificar_secoes`): LP do 6º ao 9º com o Médio pede ~31 mil por execução com 12 seções cheias, e a vazão cai para ~4 execuções/min; a 5.0 dimensiona por essa conta, não pela de 12 mil (a conta está no `TODO.md`, entrada da 3.0).** O pool puxa `réplicas × 1 × 60 / latência` (2 réplicas, ~6 s: ~20/min); o excedente adia, e o adiamento é o regulador. Uma escola de 300 apostilas (7.500 seções, **630 execuções**: 15 lotes de 500, 42 cada um) leva **2,4 h** na conta de 31 mil tokens (a carga da 5.0 mediu 4,4 execuções por minuto, com 2 réplicas e o balde de 125 mil), e não os ~65 min da conta de 12 mil; o resto, na noite seguinte |
| Limite por escola | vaga `lote` por escola: a do ambiente, 2 (`VAGAS_ESCOLA_LOTE`), dividida com expurgo e eliminação (o runbook diz); `FILAS_DA_IA` ganha a `lote`. Não há teto de custo por escola na classificação: o limitador de custo é o balde `lote`, a vaga por escola e, na rotina (5.0), o limite de execuções por noite e por escola |
| Corridas | uma linha por trava, ordem forçada e mutação em `cenarios.md`, P1 a P11 |
| Laços | agendar (rotina e `PATCH`) e D76: lotes de 500 seções por transação, `statement_timeout`, até o sinal |
| Índices | `secao_do_material (escola_id, material_id, pagina_inicial)`; `habilidade_da_secao (escola_id, codigo)`; parcial `(escola_id, execucao_id)` |
| Migration | §3; a versão anterior lê execução sem ano (teste). **Questão com `habilidade: null`, plano com `habilidades: []` e diagnóstico com `codigo: null` (10.0): expandir antes de gravar.** O código de hoje recusa os três (`habilidade` obrigatória, `.min(1)` no plano), e nenhum SQL de volta os torna legíveis sem inventar habilidade. Por isso a leitura vai antes, numa correção na `develop` que chega à `main` **antes** da classificacao-bncc: os schemas de `packages/shared` aceitam os três formatos, e todo leitor da API e da web os aceita (abrir e corrigir a prova, o lote, o artefato, o Analista, o dado nominal, com o rótulo `ROTULO_SEM_HABILIDADE`), inclusive a correção do lote, que deriva `codigo: null` da questão sem habilidade. Nada nela grava `null`: a geração continua a da versão de hoje. O teste da correção lê, pelos leitores, o conteúdo com os três formatos. A volta da classificacao-bncc vai a essa versão, sem SQL; o runbook diz que voltar para antes da correção deixa a prova dessas atividades sem abrir. A ordem dos dois pousos está no `TODO.md` (Arquiteto, divergência da 10.0, 20/11/2026) |
| Dependência cai | provedor ou balde: adia (§5); Redis: outbox |
| Métrica | `ia.habilidade_anulada`; envio à classificação (`classificada_em − enviado_em`); correções e trocas pela auditoria, por escola, nunca por professor |
| Alerta | `classificacao-atrasada`: na abertura da janela, execução `classificar_secoes` `falhou` na noite, ou `pendente` criada antes dela; com runbook. A métrica é `classificacao.execucoes_atrasadas{escola_id}`, medida de 5 em 5 minutos pelo `worker-lote` (a `EscolaGauge`) na janela letiva **da escola** (`ultimaNoite`: do fecho do último dia letivo à abertura mais recente), sem série para a escola sem atraso; o alerta dispara acima de 0, por 1 min, e traz só a escola. A consulta tem o índice parcial `execucao_agente_classificacao_idx` (`escola_id, estado, concluida_em`, só da função da classificação; migration 0064): `execucao_agente` cresce com o Tutor, e sem ele a medição lê a tabela da escola a cada 5 minutos (22 ms e 11,8 mil buffers com 400 mil turnos; com o índice, 0,075 ms) |
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
| `classificar_secoes` | `rapido` | até 12 seções + candidatas (~12 mil tokens no recorte comum; o maior, LP do 6º ao 9º com o Médio, 267 habilidades, mede ~31 mil na 3.0 com 12 seções cheias; o schema aceita até 300 candidatas e o teto de entrada é 121.600) | 0 a 3 códigos por seção | schema e candidatas | correção da coordenação; atividade aplicada pelo professor |

Custo: ~625 chamadas por onboarding, R$ 4 a 20 por escola; fora do pacote do Tutor (D38). Prompt em `packages/core/src/ia/prompts/classificar-secoes.ts`, versão
na execução: código só quando o trecho sustenta a habilidade, e "nenhuma" vale.

**Duas consequências da mudança de recorte (6.0).** (1) *Custo de quem troca o componente várias vezes:* o job do `PATCH` (`refazOsRecortes`) não tem o teto de execuções da noite, por decisão registrada (foi a coordenação que pediu). Quem troca o componente de uma disciplina grande várias vezes, depois de as execuções concluírem, paga a classificação inteira de novo a cada troca, até cerca de 630 execuções por troca; a execução cancelada antes de rodar sai sem chamar o modelo (P11). Hoje só o orçamento de IA da escola (D14) segura isso. (2) *Sem histórico do que foi descartado:* a limpeza apaga as habilidades `origem: 'ia'`, e `execucao_agente.resultado` guarda só a referência à classificação, não os códigos. O histórico de uma classificação que a mudança de recorte descartou, sem ninguém ter aprovado, não fica guardado: nada dela chegou a aluno nem virou decisão, e guardar o descartado seria reter inferência sobre o material sem finalidade. Se o dossiê de conformidade (D61) vier a exigir esse histórico, é decisão nova.

## 9. Frontend

| Tela | Mostra ou faz | De onde vem (§4) |
|---|---|---|
| Estrutura, disciplina | componente | `PATCH /v1/disciplinas/:id` |
| Painel do material | por seção: situação, habilidades com descrição, origem; corrigir (seletor com filtro); reclassificar; avisos | `GET /:id`, habilidades, `PUT`, reclassificar |
| Material, cobertura | por série: o que falta por componente; seções sem classificação | `GET /cobertura` |
| Artefato do professor | habilidade da questão, com o capítulo; trocar (seletor com filtro) | artefato, habilidades, `PATCH` |
| Turmas, aluno, Analista | "Sem habilidade", com explicação curta ("Esta questão não tem habilidade da BNCC associada."). No aluno, a leitura é o resultado da atividade; a tela Eu não recebe a linha `null` (só habilidade com código vira "Para rever", D66) e a questão conta só no "N de M certas" | leituras de hoje |

Estados, textos, 360 px, teclado: `cenarios.md`. A lista da troca traz primeiro as do capítulo.

Painel do material (8.0): o "Reclassificar" do capítulo que não terminou e o do alto abrem a mesma confirmação, porque a API
reclassifica o material, não o capítulo. Com a função suspensa, o editor de um capítulo parte só do que a coordenação corrigiu.
`Material.tsx` passa ao painel `semComponente` (da lista de disciplinas já lida), e `undefined` desliga "Corrigir" e
"Reclassificar" sem mostrar o aviso. Os textos novos estão em `cenarios.md`, "Telas".
Quando o `PUT` da correção ou o `POST` do reclassificar volta com `NAO_ENCONTRADO`, `CONFLITO`, `ENTRADA_INVALIDA` ou `FUNCAO_SUSPENSA`, a tela
lê o material de novo (`falhaMudouAClassificacao`): a falha diz que algo mudou por fora, e a lista que ela mostra deixou de valer.

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
