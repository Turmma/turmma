# Revisão de spec — reserva-e-avaliacao

**Subagentes obrigatórios:** `test-engineer`, `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `conformidade-reviewer`, `llm-integrator`, `pedagogia-reviewer`, `revisor-geral`

O desenho foi aprovado na F5 (`tasks/prd-camada-ia/revisao-spec.md`, rodada 6). Esta revisão confere o PRD, a Tech Spec e o
`cenarios.md` desta pasta contra o código que a F5a deixou na `develop` (`abertura.md`, passos 1, 2 e 4).

## Rodada 1 — 22/11/2026

**Veredito: REPROVADA**

Tamanho: PRD 1.330 palavras · Tech Spec 1.149 palavras.

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `tenancy-guardian` | APROVADO | — |
| `privacy-guardian` | REPROVADO | o gateway grava o provedor do gateway, e não o de cada chamada; `pelo_provedor_de_reserva` fora da linha 99 de `docs/lgpd.md`, e na tarefa errada |
| `infra-guardian` | REPROVADO | o 429 que sobra chega ao gateway igual a uma queda; a reserva sobe sem limite de tokens por minuto |
| `conformidade-reviewer` | REPROVADO | a avaliação não mede a recusa da D55, e a guarda das amostras proíbe a amostra que a mediria |
| `llm-integrator` | AJUSTES | o 429 e o 4xx indistinguíveis; a identidade da reserva falsa; o gateway preso a um adaptador |
| `pedagogia-reviewer` | AJUSTES | critério da questão e da rubrica; uma execução só nas linhas de 100%; equidade sem definição; tarefas de alto risco sem linha; lotes retidos expostos pelas saídas brutas |
| `revisor-geral` | REPROVADO | o 429; linha da avaliação sem tarefa e tarefa sem linha; reserva no mesmo provedor contra a recusa do mesmo id |
| `test-engineer` | REPROVADO | 11: o 429 pelo `ResilientAdapter` real; a reserva falsa; preço e envio da linha da reserva; a bancada monta o gateway real com dois adaptadores; RF4 positivo; o disjuntor da reserva; o balde dela; a interrompida com dois destinos (corrida, atomicidade, duas escolas); o caminho das quatro chamadas; as provas da ferramenta; a guarda da D55 com controle positivo |

O que a F5a mudou embaixo do desenho (o código desmente a §1 e a §5): o gateway lê um adaptador só para o envio, a origem,
o preço, o rótulo, o balde e a linha; o `ResilientAdapter` apaga a causa da falha (`traduzir`); o `FakeAdapter` não tem
identidade nem envio; `ConsumoDeIa` não tem `peloProvedorDeReserva`; o `TokenLimiter` tem um contratado só. A estimada da
interrompida segue sem custo (`consumo.ts`, abertura, passo 4): confere.

### Correções exigidas na Tech Spec
- §2, §5: a causa da falha atravessa o `ResilientAdapter` (`motivo` novo no `LLMError`, fora de `semEnvio`); o 429 que sobra é
  "sem vaga", o 5xx, a conexão e o prazo são queda, o 4xx rejeitado não é nenhum dos dois; `errors.ts` e `resilient-adapter.ts`
  na §2 (`infra-guardian`, `llm-integrator`, `revisor-geral`, `test-engineer`)
- §2, §5: cada chamada carrega o seu destino (origem, envio, preço, rótulo, balde, `pelo_provedor_de_reserva`); `ConsumoDeIa` e o
  `ConsumoRepository` ganham o campo; contador de tentativas por provedor; o caminho "inválida e depois queda" definido
  (`privacy-guardian`, `llm-integrator`, `test-engineer`)
- §5: a reserva falsa tem identidade (balde, rótulo, disjuntor, aprovação) separada do envio, que segue nulo; o adaptador da
  reserva escolhido por variável; `IA_FALHA_FALSA` com lugar; `fake-adapter.ts` na §2 (`llm-integrator`, `test-engineer`)
- §5, §7c: a reserva tem `TokenLimiter` próprio e `LLM_RESERVA_TOKENS_POR_MINUTO` obrigatória fora do `local` (`infra-guardian`,
  `test-engineer`)
- §5: reserva no mesmo provedor com outro modelo, como o PRD §10 prevê (`revisor-geral`)
- §3: `registrarEstimada` com a lista de destinos e a tabela de preços por porta; os pontos de ligação na §2 (`tenancy-guardian`,
  `infra-guardian`, `test-engineer`, em recomendação)
- §7: a linha 99 de `docs/lgpd.md` nomeia `pelo_provedor_de_reserva` e a `IA_RESERVA_PROVEDOR_ID`, na tarefa que grava a coluna
  (`privacy-guardian`)
- §8: tabela de cada linha da avaliação para a tarefa real, e das tarefas sem linha (`revisor-geral`, `pedagogia-reviewer`,
  `conformidade-reviewer`)
- §7b, §8: a linha da D55 e a guarda reescrita (`conformidade-reviewer`); três execuções nas linhas de 100%, equidade por pares,
  critérios escritos, os lotes retidos fora das saídas brutas (`pedagogia-reviewer`)
- `cenarios.md`: os cenários e as mutações de todos os bloqueantes acima (`test-engineer`)

As quatro da avaliação (a D55, o rigor das linhas de 100%, as tarefas sem linha e os lotes retidos) mudam o RF13 e o RF14 ou
fixam limiar: são do Joaquim.

### Recomendações
- Variante com duas escolas na estimada da reserva; a linha da reserva sai do mesmo `InterrompidaEncerrada`, sem `@Unscoped` novo
- `alcance_nao_e_todas` nas variantes do RF1; o rótulo "RF9, a reserva" é do RF1; o caminho certo é `apps/api` (`main-worker`)
- `DEGRAUS` com `provedor_de_reserva`; `usosDoTeto` por `provedor:modelo`; os dois disjuntores com `provedor` distinto
- O prazo da execução com quatro chamadas (`prazo-da-execucao.ts`, `docs/infra.md`)
- A suspensão da função com o principal fora não chama a reserva; a saída de reserva da tarefa depois de duas inválidas na reserva
- O glossário separa "provedor de reserva" de "saída de reserva"; `docs/avaliacao-de-modelos.md` §3.1 sem "reserva fora do Brasil"
- O comentário de `consumo.ts` e o de `consumo-ia.ts` com a numeração nova
- Custo da reserva por professor por mês, em um parágrafo da §8
- Na avaliação: rubric versionado e julgamento cego; separar "a regra decidiu" de "o modelo decidiu"; a versão exata do modelo
  no relatório; tom do Tutor; injeção de instrução no trecho de material; a guarda que liga `MODELOS_APROVADOS` à AIA

### Decisões do Joaquim (22/11/2026)
- A linha da D55 entra na avaliação, eliminatória (RF13)
- Três execuções valendo a pior nas linhas de 100%, equidade por pares, critérios escritos
- Uma linha e um limiar para cada tarefa de `TAREFAS_DE_IA`; a classificação com ≥ 90%
- As saídas dos lotes retidos fora do repositório, lidos sem cópia, rodados pelo Arquiteto (RF14)

## Rodada 2 — 22/11/2026

**Veredito: REPROVADA**

Tamanho: PRD 1.892 palavras · Tech Spec 1.995 palavras.

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `pedagogia-reviewer` | APROVADO | — |
| `privacy-guardian` | APROVADO | — |
| `infra-guardian` | APROVADO | — |
| `llm-integrator` | AJUSTES | `pelo_provedor_de_reserva` contado na estimada; contador "por provedor" funde principal e reserva do mesmo provedor |
| `revisor-geral` | REPROVADO | a linha da classificação abaixo da AIA do diagnóstico |
| `test-engineer` | REPROVADO | 6: o 429 passa pelo menor antes da reserva; mesma identidade compara modelos entre perfis e o menor; a contagem da Operação; a equidade por par discordante; três cláusulas da §5 sem cenário; "a regra decidiu" sem teste e sem a D55 |
| `conformidade-reviewer` | REPROVADO | a D55 não elimina o principal; a D36 perdeu "nenhum conselho dado"; a classificação abaixo da AIA |

### Correções exigidas
- PRD: a tabela da avaliação vai para `avaliacao.md` (anexo do RF13), com as regras de execução, de julgamento e dos lotes
  retidos; a D55 e a equidade eliminatórias, nem principal nem reserva; a D36 em duas linhas (as 15 com "nenhum conselho";
  os lotes retidos com o alvo `riscoAVida`); a classificação com o critério inteiro da AIA, pior de três; limiares em contagem;
  a equidade por par discordante, três vezes; §10 com o Tutor que não chega ao alvo do risco à vida (`conformidade-reviewer`,
  `revisor-geral`, `test-engineer`, `pedagogia-reviewer` e `llm-integrator` em recomendação)
- Tech Spec §3: `pelo_provedor_de_reserva` só na chamada que saiu para a reserva; a estimada leva a coluna falsa
  (`llm-integrator`, `test-engineer`)
- Tech Spec §5: o `limite` passa pelo menor antes da reserva; a mesma identidade exige todo modelo diferente, o menor incluído;
  contador por destino (`test-engineer`, `llm-integrator`)
- Tech Spec §8: as regras em `avaliacao.md`; a guarda do ponto de entrada sem `db/schema`, repository nem `DATABASE_URL`;
  o custo refeito, cerca de 2.100 chamadas (`privacy-guardian` e `revisor-geral` em recomendação)
- `cenarios.md`: os casos e as mutações de cada item acima (`test-engineer`, `conformidade-reviewer`)

### Recomendações
- A linha 99 de `docs/lgpd.md` na tarefa que grava a coluna (a 2.0 da F5b), e o comentário de `leitura-do-titular.ts` com
  "enviadas"; o rascunho da 12.0 traz a guarda antiga da D55
- `ia-tokens-acima-do-teto.yaml` agrupado por `provedor` e `modelo`; `docs/infra.md` 5.4 diz se a reserva de mesmo provedor
  divide o contratado; `rejeitada` (401) sem alerta: contador por motivo
- A fase `reserva` da carga com o 429 no meio da aula; o prazo das quatro chamadas com relógio falso; a variante "o original
  vivo também registra" com a reserva

## Rodada 3 — 22/11/2026

**Veredito: REPROVADA**

Tamanho: PRD 1.491 palavras · Tech Spec 1.995 palavras · `avaliacao.md` (anexo do RF13) 904.

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `pedagogia-reviewer` | APROVADO | — |
| `llm-integrator` | APROVADO | — |
| `conformidade-reviewer` | REPROVADO | a conferência da tarefa troca a nota do modelo pela recusa fixa, e o modelo passa na D55 sem ter recusado |
| `revisor-geral` | REPROVADO | a AIA citada por "§4" (é 1.10, item 4); o RF14 e o anexo dizem coisas diferentes do que o repositório guarda |
| `test-engineer` | REPROVADO | 7: a equidade elimina modelo sem viés por acaso; `MODELOS_APROVADOS` aceita tarefa reprovada; a reserva que falhou com a coluna; a guarda do ponto de entrada sem fixtures; a medida dos lotes retidos; o julgamento cego; o prazo das quatro chamadas |

### Correções exigidas
- `avaliacao.md`: a ferramenta julga cada resposta crua do modelo; três contagens, e "a conferência segurou" é falha;
  mínimo de 10 amostras que chegam ao modelo (`conformidade-reviewer`)
- `avaliacao.md`: a equidade conta os pares em que o culto passa e o informal não, em 2 das 3 execuções, no máximo 2, sem
  desconto (`test-engineer`; `pedagogia-reviewer`, `llm-integrator` e `revisor-geral` em recomendação)
- `avaliacao.md`: a AIA em "1.10, item 4", com os seis critérios; a classificação no `rapido` e depois no `padrao`; os pedidos
  legítimos barrados da D55 com limiar, fora da eliminatória; a rubrica sem juízo dentro da eliminatória (`revisor-geral`,
  `conformidade-reviewer`)
- PRD RF14 alinhado ao anexo (`revisor-geral`); Tech Spec §7c: `PRAZO_DA_EXECUCAO_MS` não muda, a reserva usa o que sobra
  (`test-engineer`)
- `cenarios.md`: os casos e as mutações de cada item (`test-engineer`, `conformidade-reviewer`)

### Recomendações
- O tom do Tutor e a instrução plantada no trecho do material nos critérios do Tutor; os tipos de adaptação nomeados
- A ferramenta recusa enviar lote retido a finalista sem contrato que vede treinamento; a fase `reserva` da carga com o 429
- `saidas.jsonl` da D55 com só id e categoria nas reprovadas

## Rodada 4 — 22/11/2026

**Veredito: REPROVADA**

Tamanho: PRD 1.498 palavras · Tech Spec 1.995 palavras · `avaliacao.md` 1.085.

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `pedagogia-reviewer` | APROVADO | — |
| `revisor-geral` | APROVADO | — |
| `conformidade-reviewer` | REPROVADO | "a conferência segurou" pelo caminho do código: o `ajustar` reprova o modelo que acerta, e a nota corrigida na repetição passa |
| `test-engineer` | REPROVADO | 3: a D36 dos lotes retidos sem a precisão e sem `ameaca_a_terceiro`; o limite de 3 barrados sem o lado que passa; o mínimo de 10 pode eliminar todos pelo desenho das amostras |

### Correções exigidas
- `avaliacao.md`: a amostra vale a pior das respostas cruas; "a conferência segurou" é resposta crua que falhou com saída final
  que passou; o `ajustar` que aplica a classificação do próprio modelo não conta; um teste prova o mínimo de 10 por linha antes
  do gasto, e a D36 sobe a 25 amostras (15 com risco) (`conformidade-reviewer`, `test-engineer`)
- `avaliacao.md`: a D36 dos lotes retidos com o alvo inteiro (perda, precisão, `ameaca_a_terceiro`); Tech Spec §8: `medir` e
  `interpretarCorpus` saem de `__fixtures__/golden.ts` para `ia/medida-do-ouro.ts` (`test-engineer`)
- `cenarios.md`: os casos e as mutações de cada item, os controles positivos do `ajustar` e o lado que passa do limite de 3

### Recomendações atendidas nesta volta
`resultado.json` lido pela guarda do RF16; a pasta das saídas retidas por argumento; "as duvidosas"; "das seções com conteúdo";
o perfil da classificação no `padrao`; gabarito a 100%; a D36 com amostras informais; o tom e a instrução plantada no Tutor;
os tipos de adaptação; o prazo no molde de `prazo-com-tokens.int.test.ts`; as fronteiras em contagem; a D55 sem a saída
reprovada em `saidas.jsonl`.

## Rodada 5 — 22/11/2026

**Veredito: REPROVADA**

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `conformidade-reviewer` | APROVADO | — |
| `test-engineer` | REPROVADO | 3: "barrados" sem dizer quem barrou (a regra fixa já barra 11 legítimos); o limite de 2 pares da equidade sem o lado que passa; nenhum teste prova quais linhas rodam três vezes |

### Correções exigidas
- `avaliacao.md`: "barrado" é a saída final que recusa, do modelo ou da `reservaQuandoInvalida`; o que a regra fixa barra fica
  em "a regra decidiu"; cada linha do arquivo de amostras declara a tarefa e as execuções (`test-engineer`)
- `cenarios.md`: 11 pela regra fixa e 3 pelo modelo mantêm a entrada; 2 pares passam; as execuções por linha conferidas
  (`test-engineer`)

### Recomendações atendidas nesta volta
`pediu_resposta_pronta` vem da regra; `risco_a_vida` esperado nas amostras de risco à vida (com o 188); nenhum conselho nas 25;
o `saidas.jsonl` da D55 com só id e forma; os lotes retidos da D36 medidos como em `MEDIDAS.json`, três vezes, com a base de
`ameaca_a_terceiro` do próprio lote; a leitura de `MEDIDAS.json` e a comparação com o alvo também vão para
`ia/medida-do-ouro.ts`; a precisão em 0,8; o sha256 do `resultado.json`; a D58 com 12; a AIA que cita `CR-025` corrigida na
tarefa.

## Rodada 6 — 22/11/2026

**Veredito: REPROVADA**

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `test-engineer` | REPROVADO | 2: a recusa da `reservaQuandoInvalida` como barrado sem teste; a D55 das amostras sem teste do que fica no repositório, e o PRD RF14 deixando as saídas dela entrarem brutas |

### Correções exigidas
- `cenarios.md`: 3 barrados com 1 pela `reservaQuandoInvalida` mantêm a entrada, 4 tiram (mutação "contar só a recusa do
  modelo"); o RF14 dos `.jsonl` estendido às duas linhas da D55 (`test-engineer`)
- PRD RF14: "salvo as dos lotes retidos e as da D55" (`test-engineer`)

### Recomendações atendidas nesta volta
Vale a pior em tudo que roda três vezes; os lotes retidos por referência no arquivo de amostras; o `relatorio.md` traz o sha256
do `resultado.json` (a guarda confere a cadeia); a §8 lista o `resultado.json`; os números do relatório e do resumo comparados
pela máquina; a notação em 40 amostras, pelo `pedagogia-reviewer`; o `piorDe` para `ia/medida-do-ouro.ts`.

## Rodada 7 — 22/11/2026

**Veredito: REPROVADA**

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `test-engineer` | REPROVADO | 1: os números fiéis do relatório da correção e do resumo do Analista sem cenário |

### Correções exigidas
- `cenarios.md`: o percentual trocado no relatório reprova; o número do resumo trocado na primeira resposta e acertado na
  repetição reprova (mutações "comparador que sempre aprova", "julgar a saída final do resumo") (`test-engineer`)

### Recomendações atendidas nesta volta
A D55 com "o id, a forma do pedido e o resultado"; "nem o sha256 das saídas" no RF14; a parte de limiar das linhas mistas na
pior de três; a cobertura de `TIPOS_DE_ADAPTACAO` e das séries antes do gasto; a classificação que só passa no `padrao`.

## Rodada 8 — 22/11/2026

**Veredito: APROVADA**

Tamanho: PRD 1.509 palavras · Tech Spec 1.999 palavras · `avaliacao.md` (anexo do RF13) 1.413.

| Revisor | Rodada em que aprovou |
|---|---|
| `tenancy-guardian` | 1 |
| `privacy-guardian` | 2 |
| `infra-guardian` | 2 |
| `llm-integrator` | 3 |
| `pedagogia-reviewer` | 4 (reconferiu depois das mudanças da avaliação) |
| `revisor-geral` | 4 |
| `conformidade-reviewer` | 5 |
| `test-engineer` | 8 |

Aplicadas depois da aprovação, como recomendação do `test-engineer`: o PRD RF14 com a forma do pedido na D55; os números fiéis
com os dois sentidos (nenhum número a mais, nenhum a menos) e o campo que `problemasDoResumo` confere.

### O que vai para as tarefas (recomendações sem cenário próprio)
- A linha 99 de `docs/lgpd.md` (`pelo_provedor_de_reserva`) na tarefa que grava a coluna verdadeira; os comentários de
  `consumo.ts`, `consumo-ia.ts` e `leitura-do-titular.ts` com "enviadas"; o glossário com "saída de reserva"
- O rascunho da 12.0 traz a guarda antiga da D55: a tarefa segue `avaliacao.md` e o `cenarios.md`
- `ia-tokens-acima-do-teto.yaml` agrupado por `provedor` e `modelo`; `docs/infra.md` 5.4 diz se a reserva de mesmo provedor
  divide o contratado; `rejeitada` (401) com contador por motivo
- A fase `reserva` da carga com `IA_FALHA_FALSA=principal:429` no meio da aula
- `docs/mvp-contratos.md:213` (`TODO.md:4368`); `TODO.md:4260` e `TODO.md:4367` fechados pelas tarefas da reserva
- A avaliação mede aprovação mínima, não taxa estimada (dizer no relatório); a aprovação do principal sem prova no código
  (§11) fica para a validação

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-22 09:53:45 | 2026-11-22 09:54:57 | `pedagogia-reviewer` | 1 | AJUSTES NECESSÁRIOS | a95ef0ae9d874a157 |
| 2026-11-22 09:53:39 | 2026-11-22 09:56:10 | `tenancy-guardian` | 1 | APROVADO | ab63a5fde5ceb8f6e |
| 2026-11-22 09:53:32 | 2026-11-22 09:57:01 | `llm-integrator` | 1 | AJUSTES NECESSÁRIOS | acf4010f5c3f30aee |
| 2026-11-22 09:53:13 | 2026-11-22 09:58:21 | `privacy-guardian` | 1 | REPROVADO | af1702cfdbba92a87 |
| 2026-11-22 09:53:26 | 2026-11-22 09:58:36 | `conformidade-reviewer` | 1 | REPROVADO | a85ebd38a9314a2d2 |
| 2026-11-22 09:53:20 | 2026-11-22 09:59:12 | `infra-guardian` | 1 | REPROVADO | a06bc8044f6e9660a |
| 2026-11-22 09:53:52 | 2026-11-22 10:00:37 | `revisor-geral` | 1 | REPROVADO | a7663d30e488bdb02 |
| 2026-11-22 09:53:06 | 2026-11-22 10:00:39 | `test-engineer` | 1 | REPROVADO | afe2f69aa0ec7515a |
| 2026-11-22 10:19:14 | 2026-11-22 10:20:05 | `pedagogia-reviewer` | 2 | APROVADO | a708a25f368fc70f4 |
| 2026-11-22 10:18:59 | 2026-11-22 10:20:28 | `privacy-guardian` | 2 | APROVADO | ae51bee1024c66d55 |
| 2026-11-22 10:19:11 | 2026-11-22 10:20:46 | `llm-integrator` | 2 | AJUSTES NECESSÁRIOS | aac74c14947ae1264 |
| 2026-11-22 10:19:03 | 2026-11-22 10:21:06 | `infra-guardian` | 2 | APROVADO | a4f6594e9b32e5166 |
| 2026-11-22 10:19:18 | 2026-11-22 10:23:06 | `revisor-geral` | 2 | REPROVADO | ad3e7b0e262853074 |
| 2026-11-22 10:18:56 | 2026-11-22 10:23:33 | `test-engineer` | 2 | REPROVADO | acb6da149d3a81454 |
| 2026-11-22 10:19:06 | 2026-11-22 10:23:57 | `conformidade-reviewer` | 2 | REPROVADO | a893a84eecbfc2296 |
| 2026-11-22 10:26:34 | 2026-11-22 10:27:12 | `pedagogia-reviewer` | 3 | APROVADO | aa1d61d954c23ea37 |
| 2026-11-22 10:26:30 | 2026-11-22 10:27:14 | `llm-integrator` | 3 | APROVADO | a7767677a024e9fff |
| 2026-11-22 10:26:19 | 2026-11-22 10:29:10 | `test-engineer` | 3 | REPROVADO | a90aed72f1518e3e2 |
| 2026-11-22 10:26:26 | 2026-11-22 10:29:16 | `revisor-geral` | 3 | REPROVADO | a6339b9003416d3d0 |
| 2026-11-22 10:26:23 | 2026-11-22 10:29:48 | `conformidade-reviewer` | 3 | REPROVADO | a82ae3c2a894128f1 |
| 2026-11-22 10:31:15 | 2026-11-22 10:31:49 | `pedagogia-reviewer` | 4 | APROVADO | a7e603a4d87b4ae96 |
| 2026-11-22 10:31:11 | 2026-11-22 10:33:47 | `revisor-geral` | 4 | APROVADO | aeda921a813ae5508 |
| 2026-11-22 10:31:07 | 2026-11-22 10:33:52 | `conformidade-reviewer` | 4 | REPROVADO | afa77e5e2d9901799 |
| 2026-11-22 10:31:03 | 2026-11-22 10:34:24 | `test-engineer` | 4 | REPROVADO | a7ad1a8343c783fcf |
| 2026-11-22 10:35:47 | 2026-11-22 10:37:56 | `conformidade-reviewer` | 5 | APROVADO | a9cecd34458d89ef2 |
| 2026-11-22 10:35:51 | 2026-11-22 10:38:56 | `test-engineer` | 5 | REPROVADO | a0cbde17728743b57 |
| 2026-11-22 10:40:02 | 2026-11-22 10:43:20 | `test-engineer` | 6 | REPROVADO | a4630cbbce2de158f |
| 2026-11-22 10:44:00 | 2026-11-22 10:46:35 | `test-engineer` | 7 | REPROVADO | a8f505810c237fc4a |
| 2026-11-22 10:46:56 | 2026-11-22 10:47:59 | `test-engineer` | 8 | APROVADO | a88fdaf1bbaebb7f7 |
