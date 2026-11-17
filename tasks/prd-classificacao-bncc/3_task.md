# Tarefa 3.0 — A função `classificacao_do_material` existe e é suspensível, e a tarefa `classificar_secoes` tem prompt, saída e medidor

**Funcionalidade:** classificacao-bncc · **Depende de:** 2.0
**Subagentes obrigatórios:** `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `llm-integrator`, `pedagogia-reviewer`
**Porte:** grande

## Objetivo

A classificação é uma função declarada do Assistente de ensino, em "Como cada IA trabalha" e suspensível; a tarefa
`classificar_secoes` existe no catálogo, com prompt versionado, saída estrita e o `falso` determinístico; o banco aceita a
execução dela sem ano; e `tools/ia/medir-classificacao.ts` mede a taxa no lote que o Arquiteto vai escrever.

## Contexto necessário

- `techspec.md` §3 (`execucao_agente`), §5 "Classificação", §7, §7b inteira, §8, §11
- `prd.md` RF5, 8b
- `cenarios.md` "Classificação no worker" (sondas, prompt, check do ano), "Lote retido"
- `.claude/rules/`: 30, 40, 70 (itens 5 e 6a), 80
- Código: `packages/core/src/ia/tasks/resumo-do-analista.ts` (molde de `defineTask`), `packages/core/src/ia/task.ts`,
  `packages/core/src/ia/tasks/index.ts`, `packages/shared/src/time/execucao.ts`, `packages/shared/src/time/funcoes.ts`,
  `packages/core/drizzle/0058_fila_ferramenta.sql` (troca de check), `tools/ia/medir-risco-a-vida.ts`
- **Não abra `docs/aia/ouro-retido/`.** O prompt usa um conjunto `dev` próprio

## Subtarefas

- [x] 3.1 — `classificar_secoes` em `TAREFAS_DE_IA` e `FUNCAO_DA_TAREFA_DE_IA`; `classificacao_do_material` em `FUNCOES`, com o `fazSozinha` e o `esperaAprovacao` da §7b
- [x] 3.2 — Migration: os checks de tarefa, função e par em `execucao_agente`, e o ano nulo só nesta tarefa, por `ADD … NOT VALID` e `VALIDATE`; `ano_letivo_id drop not null`
- [x] 3.3 — A tarefa em `packages/core/src/ia/tasks/`, o prompt em `packages/core/src/ia/prompts/classificar-secoes.ts` (versão na execução), saída de 0 a 3 códigos por seção, só das candidatas, teto de 800 tokens; `levaTextoDeAluno: false`, `levaTextoLivreDePessoa: false`, a categoria; o `falso`
- [x] 3.4 — `tools/ia/medir-classificacao.ts`: taxa por etapa, `aceitaveis`, `sem_conteudo_curricular`, `injecao`, pior de três, as 10 atividades por questão; provado com fixture própria
- [x] 3.5 — A AIA `docs/aia/diagnostico-por-habilidade.md` revista (§7b, a herança da edição nova, a suspensão por escola quando a taxa não é atingida); no `TODO.md`, a conferência do lote retido por professor antes do primeiro aluno real
- [x] 3.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/shared/src/time/execucao.ts`, `packages/shared/src/time/funcoes.ts`, `packages/shared/src/governanca/governanca.test.ts` | alterado |
| `packages/core/drizzle/0062_*.sql`, `packages/core/drizzle/meta/_journal.json`, `packages/core/src/db/schema/execucao-agente.ts`, `packages/core/src/db/schema/mvp/mvp-tables.int.test.ts` | novo e alterado |
| `packages/core/src/ia/tasks/classificar-secoes.ts`, `packages/core/src/ia/prompts/classificar-secoes.ts`, `packages/core/src/ia/tasks/classificar-secoes.test.ts`, `packages/core/src/ia/tasks/index.ts`, `packages/core/src/ia/tasks/tarefas.test.ts` | novo e alterado |
| `tools/ia/medir-classificacao.ts`, `tools/ia/medir-classificacao.test.ts`, `apps/api/src/governanca/governanca.int.test.ts` | novo e alterado |
| `docs/aia/diagnostico-por-habilidade.md`, `TODO.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| governança | I | em "Como cada IA trabalha", autonomia 1, alto risco, suspensível | `governanca.int.test.ts` › em "Como cada IA trabalha", a classificação do material é do Assistente de ensino, de autonomia 1, alto risco e suspensível, com o texto do catálogo; › a classificação do material se suspende e se retoma como as outras…; › os três agentes e as sete funções… |
| textos da função; tarefa e função | U | os da §7b, sem `VOCABULARIO_DE_NOTA`; `FUNCAO_DA_TAREFA_DE_IA` liga | `governanca.test.ts` › a classificação do material é função do Assistente de ensino, de autonomia 1, alto risco e suspensível, e o que a coordenação lê é o texto da Tech Spec, sem vocabulário de nota; › a tarefa classificar_secoes liga à função da classificação…; `textos-da-governanca.test.ts` (o efeito da suspensão) |
| execução sem ano lida pela varredura e pelo expurgo | I | não quebra, um caso cada | `execucao-interrompida.int.test.ts` › varredura, execução sem ano nem pessoa (a classificação)…; `expurgo-da-escola.int.test.ts` › a execução da classificação, sem ano letivo e sem pessoa, é anonimizada como as outras…; `ia.int.test.ts` › a execução da classificação, sem ano letivo e sem pessoa, é lida sem quebrar… |
| outra função com ano nulo | I | o check recusa. Mutação: sem o check | `mvp-tables.int.test.ts` › o ano letivo da execução é nulo só na classificação do material…; `migracao-classificacao.int.test.ts` › o ano letivo da execução passa a aceitar nulo, e só a `classificar_secoes` o usa… (mutação: o bloco do `ano_so_nulo` sem a cláusula) |
| checks de tarefa e função | I | aceitam a nova, recusam o desconhecido; as antigas validam | `mvp-tables.int.test.ts` › a classificação do material: a tarefa e a função entram no par e só nele, e os seis checks que a 0062 tocou entram validados; `migracao-classificacao.int.test.ts` › a tarefa e a função entram no par e só nele…; › o consumo e a suspensão aceitam a função nova…; › os seis checks terminam validados… |
| sondas de saída (c1), as treze: as doze do `cenarios.md` (a minúscula e o espaço em casos separados) e o código repetido na seção | U | `IA_SAIDA_INVALIDA`, um caso por sonda | `classificar-secoes.test.ts` › a saída inválida é IA_SAIDA_INVALIDA, sem nada entregue (sondas, c1) (o `it.each` de treze sondas, e o caso de controle com a resposta boa) |
| prompt: texto delimitado como dado; candidatas no começo; cortes de 1.500 e 500; 800 tokens | U | um caso cada | `classificar-secoes.test.ts` › o pedido ao modelo: as candidatas vêm no começo…; o texto do material vai delimitado como dado…; o texto que tenta fechar a cerca…; o teto de 800 tokens vai no corpo do pedido…; › a entrada tem o corte que o prompt promete |
| declaração da tarefa | U | `levaTextoDeAluno: false` e a categoria, lidas pelo gateway | `classificar-secoes.test.ts` › o que o gateway lê da declaração da tarefa (a soberania, a categoria, o consumo, a suspensão); `tarefas.test.ts` › o `DECLARADO` da linha nova |
| `falso` | U | mesma entrada, mesmos códigos, dentro das candidatas, no schema | `classificar-secoes.test.ts` › a versão determinística (falso): mesma entrada, os mesmos códigos…; › só propõe código da lista que recebeu…; › a ordem por palavras em comum; `tarefas.test.ts` › "%s: a saída passa no schema e na conferência da própria tarefa" e "mesma entrada, mesma saída, byte a byte" |
| medidor: taxa por etapa e `aceitaveis` | U | com fixture | `medir-classificacao.test.ts` › medirUmaExecucao: a taxa por etapa… e › o código em `aceitaveis` conta como aceitável…; › os critérios da Tech Spec, sobre a pior execução |
| medidor: `sem_conteudo_curricular` com código; injeção obedecida | U | contadas | `medir-classificacao.test.ts` › sem conteúdo curricular com código é contado…; › a injeção obedecida é o código que o texto manda… |
| medidor: pior de três; inválida; sha256 | U | a pior vale; inválida é erro; muda com `referencia` | `medir-classificacao.test.ts` › medirClassificacao: a pior de três e a saída inválida; › o sha256 do lote: muda com `referencia` e com `aceitaveis`, e não com a ordem |

## Como testar

- Tarefa: `packages/core/src/ia/tasks/tarefas.test.ts` › "%s: a saída passa no schema e na conferência da própria tarefa", "%s: mesma entrada, mesma saída, byte a byte" e "o catálogo do núcleo tem exatamente as tarefas do contrato de @educa/shared…" (a linha nova em `DECLARADO`)
- Sondas: `ScriptedAdapter` (`packages/core/src/ia/__fixtures__/scripted-adapter.ts`), como em `llm-gateway.test.ts`
- Checks: `mvp-tables.int.test.ts` › "a tarefa fica presa à função dela e a entrada à tarefa"; `migracao-fila-ferramenta.int.test.ts` › "os dois checks terminam validados…"
- Governança: `governanca.test.ts` › "o time sai do catálogo: três agentes, as seis funções…" (o número muda)
- Medidor: `tools/ia/medir-risco-a-vida.test.ts` › "pelo caminho da tarefa: o modelo que oscila vale pela pior execução…"
- `npx vitest run --project unidade packages/core/src/ia/tasks/`

## Autoconferência

As 12 perguntas do modelo, no plano. Na 7: cada frase nova da AIA aponta o arquivo ou o caso que a prova, inclusive o que só a 4.0 a 10.0 vão entregar (dito como "a partir da tarefa N").

## Fora do escopo desta tarefa

O job, a fila, o processador e `TAREFAS_SEM_MODELO_MENOR` (4.0); o lote retido e a medida (o Arquiteto).

## Plano (Implementador)

**Arquivos:** os da tabela "Arquivos previstos", mais `packages/shared/src/index.ts` e `packages/shared/src/bncc/componentes.ts` (`CODIGO_DE_HABILIDADE_BNCC`, o formato do código que a saída confere), `packages/core/src/db/schema/consumo-ia.ts` e `suspensao-de-funcao.ts` (os checks de função, espelho da `0062`), `packages/core/drizzle/meta/0062_snapshot.json`, `packages/core/src/ia/__fixtures__/inputs.ts` (`entradaDeClassificacao`), `packages/core/src/ia/prompts/prompts-caracterizados.test.ts` (o hash do prompt novo), `apps/api/src/ia/execucao.repository.ts` e `apps/api/src/ia/registro-de-comandos.ts` (+ seu teste), `apps/web/src/areas/coordenacao/governanca/textos-da-governanca.ts` (+ teste), `apps/api/src/ia/ia.int.test.ts`, `apps/api/src/ia/execucao-interrompida.int.test.ts`, `apps/worker/test/expurgo-da-escola.int.test.ts`, `packages/core/src/db/migracao-classificacao.int.test.ts` (novo).

**Interfaces:** `classificarSecoes` (a `TaskDefinition`, no `TASK_CATALOG`), `classificarSecoesInputSchema` e `classificarSecoesOutputSchema`, `SECOES_POR_EXECUCAO` (12), `MAXIMO_DE_CODIGOS_POR_SECAO` (3), `CANDIDATAS_MAXIMAS` (300); no medidor, `interpretarLote`, `sha256DoLote`, `pedidosDaMedida`, `medirUmaExecucao`, `piorDe`, `criteriosDe`, `medirClassificacao`, `atividadesParaJulgar` (puros, com o modelo injetado), e o `principal`, que carrega o núcleo do `dist` como o `medir-risco-a-vida.ts`.

**Testes:** a tabela acima, com o caso de cada linha na coluna "Caso".

### Autoconferência

1. **Mutações:** a seção "Mutações" abaixo, um bloco por cláusula do diff (cada linha de `conferir`, a ordem do `falso`, os tetos de entrada e de saída, a declaração `levaTextoDeAluno` e a categoria, cada check e cada `VALIDATE` da `0062`, o espelho dos textos, e os critérios do medidor), conferidos um a um antes do portão. O que o `--faltando` listava e nenhum teste vê leva a meia linha do motivo.
2. **Texto na tela:** uma frase, o efeito da suspensão de `classificacao_do_material` em "Como cada IA trabalha" (`EFEITO_DA_SUSPENSAO`), dita em português comum e sem vocabulário de nota; fora ela, a tarefa não tem tela. A Parte A do `docs/interface.md` não muda: o catálogo de telas é o mesmo e a função entra pela lista que a tela já lê.
3. **Segundo dado:** o capítulo que casa uma habilidade e o sumário e o bloco sem título, na mesma execução (`entradaDeClassificacao`); a medida com o lote de duas etapas, com as seis `sem_conteudo_curricular` e as quatro injeções, e a que oscila entre as três execuções.
4. **Checagem anterior:** a conferência da saída (`conferir`) roda depois do schema, que já recusa formato, chave a mais e mais de três códigos; os casos de sonda provam que cada saída ruim vira `IA_SAIDA_INVALIDA` sem nada entregue, e não qual das duas camadas a pegou. Nenhuma rota nova.
5. **Asserção:** as sondas olham o código de erro (`IA_SAIDA_INVALIDA`), o número de chamadas ao adaptador e a linha de consumo (sem saída); as de ausência (`FUNCAO_SUSPENSA` sem chamar o modelo, texto de aluno recusado sem chamar o modelo) vêm ao lado do caso em que a mesma chamada passa.
6. **Guarda nova:** nenhuma. `tarefas.test.ts` já lê o catálogo e cobra o `DECLARADO` de cada tarefa, `teto-de-entrada.test.ts` o teto, `prompts-caracterizados.test.ts` o hash, `registro-de-comandos.test.ts` a lista dos sem chamador e `mvp-tables.int.test.ts` os checks.
7. **Comentários e docs:** os docblocks dizem o que o código faz e o que a 4.0 completa (o worker, o `resultado`, o consumo só com ids). `docs/aia/diagnostico-por-habilidade.md` (1.10) aponta, por frase, o arquivo ou o caso que a prova, e diz "a partir da tarefa N" para o que ainda não existe. O `TODO.md` ganha quatro entradas.
8. **Divergências:** a tabela abaixo; as cinco entraram na `techspec.md` (§3, §5, §7b, §8) e no `cenarios.md` (o formato do lote retido e o que a medida lê dele). O `prd.md` não diz o contrário.
9. **Peça que já existe:** `defineTask`, `ScriptedAdapter`, `LLMGateway` e as portas em memória, `tokensDoPiorPedido` (o teto), `habilidadeEhCandidata` e `COMPONENTES_BNCC` (1.0), a carga `dados-2026.08`, `piorDe`/`MedidaRecusada`/`exigirModeloDaMedida` do `medir-risco-a-vida.ts` (copiados no desenho, não importados: o medidor lê o lote de outro formato), `migracao-fila-ferramenta.int.test.ts` (o molde do teste da `0062`).
10. **Corrida:** a `0062` troca checks por `NOT VALID` seguido de `VALIDATE`, sob `lock_timeout` de 5 s, e o teste a roda sobre um banco com execução de antes. Não há laço novo nem escrita concorrente nesta tarefa.
11. **Isolamento:** a execução sem ano é lida no contexto da escola dela e é inexistente na outra (`ia.int.test.ts` › "a execução da classificação, sem ano letivo e sem pessoa…", com o `noContextoDe(b, …)` na última linha); a varredura grava a linha de consumo na escola da execução. A coluna "Caso" está preenchida.
12. **Guardiões:** `privacy-guardian` (a entrada sem pessoa, o consumo, o log), `conformidade-reviewer` (função de alto risco declarada, suspensível, o texto sem vocabulário de nota), `infra-guardian` (a migration expand-only com `lock_timeout`, o teto de entrada, a fila `lote` que só chega na 4.0), `llm-integrator` (perfil `rapido`, o teto de saída, o prompt versionado, a saída estrita, o medidor que não roda no portão) e `pedagogia-reviewer` (a AIA e o julgamento das 10 atividades); `test-engineer` e `revisor-geral` entram pela Mesa. Não há `achados/` ainda.

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| A `0062` também troca o check de função de `suspensao_de_funcao` | A Tech Spec §3 falava nos checks de `execucao_agente` e `consumo_ia`, e a subtarefa 3.2 só nos de `execucao_agente`. Sem o de `suspensao_de_funcao`, a coordenação não consegue suspender a função (o check recusa a chave), e "suspensível" não se cumpriria | `techspec.md` §3, "Migrations", passo 1 (a frase agora cita `suspensao_de_funcao`); `migracao-classificacao.int.test.ts` › o consumo e a suspensão aceitam a função nova… |
| `classificar_secoes` entra em `TAREFAS_SEM_CHAMADOR` até a 4.0 | A tarefa e a função existem desde a 3.0, e o comando que a chama (rotina noturna, sem pessoa) só chega na 4.0; o guarda `registro-de-comandos` exige comando para toda tarefa que alguém chama, e ninguém chama ainda. Sai da lista no commit que registra o comando | `techspec.md` §5, "Classificação"; `registro-de-comandos.test.ts` |
| `ExecucaoRepository.paraIniciar` lê a execução sem ano, e o `quemPediu` leva o ano em curso que o `join` achou | A coluna `ano_letivo_id` passou a aceitar nulo, e o `quemPediu.anoLetivoId` era essa coluna: o tipo deixou de fechar. O ano de quem pediu é o do `join` com o ano em curso, e a execução sem pessoa continua sem `quemPediu` (a 4.0 a aceita só em `daRotina`) | `techspec.md` §5, "Classificação" (a frase do `quemPediu` ausente) |
| Até 300 candidatas por execução, e o pedido do maior recorte pede ~31 mil tokens, não ~12 mil | A Tech Spec mandava medir "na tarefa" o maior recorte. Medido sobre a carga `dados-2026.08`: Língua Portuguesa do 6º ao 9º mais o Médio tem 267 habilidades, e com 12 seções cheias o pedido pede ~31 mil tokens (só o Fundamental, ~16 mil de candidatas). O schema aceita até 300, e o teto de entrada da tarefa é o do pior pedido que ele aceita (121.600). A vazão da §7c, calculada com 12 mil, vai para o `TODO.md` | `techspec.md` §8 (a linha de `classificar_secoes`), §7c; `classificar-secoes.test.ts` › "os limites do schema cobrem o maior recorte real da carga" |
| O medidor lê `aceitaveis` junto de `referencia`, reconhece a injeção obedecida pelo código que o texto cita, e o lote leva `etapa` como `ef_anos_finais` ou `em` | O `cenarios.md` dá o formato do lote sem dizer três coisas que a conta precisa. O Arquiteto escreve o lote depois desta tarefa, e o medidor recusa o que não segue | `cenarios.md`, "Lote retido"; `medir-classificacao.test.ts` › "o lote retido: o formato é o de cenarios.md…" |

## Mutações

`--faltando: 17 linhas (109 blocos, 9 motivos)`. As 109 mutações abaixo foram corridas uma a uma antes do portão (a ferramenta do portão as corre de novo); o que sobra da lista, abaixo dos blocos, é o que nenhum teste distingue ou o que só roda na linha de comando contra o modelo e o `dist`, e cada item leva a meia linha do porquê. O que o `--faltando` ainda lista por não achar a crase igual ao termo (o termo composto, o `?:`, o SQL do espelho `.ts`) está dito por arquivo e linha.

```mutacao
arquivo: packages/core/src/ia/tasks/classificar-secoes.ts
teste: packages/core/src/ia/tasks/classificar-secoes.test.ts › seção inventada, além das que vieram
-    if (!secoesRecebidas.has(resposta.secaoId)) problemas.push(`${onde}: o identificador não é de nenhuma seção recebida. Use só os identificadores que vieram nos dados.`)
+    if (false) problemas.push(`${onde}: o identificador não é de nenhuma seção recebida. Use só os identificadores que vieram nos dados.`)
```

```mutacao
arquivo: packages/core/src/ia/tasks/classificar-secoes.ts
teste: packages/core/src/ia/tasks/classificar-secoes.test.ts › seção repetida
-    else if (respondidas.has(resposta.secaoId)) problemas.push(`${onde}: a seção já foi respondida. Devolva uma entrada só por seção.`)
+    else if (false) problemas.push(`${onde}: a seção já foi respondida. Devolva uma entrada só por seção.`)
```

```mutacao
arquivo: packages/core/src/ia/tasks/classificar-secoes.ts
teste: packages/core/src/ia/tasks/classificar-secoes.test.ts › código fora das candidatas
-    if (resposta.codigos.some((codigo) => !candidatas.has(codigo))) problemas.push(`${onde}: há código que não está na lista de candidatas. Use só os códigos da lista, copiados exatamente.`)
+    if (false) problemas.push(`${onde}: há código que não está na lista de candidatas. Use só os códigos da lista, copiados exatamente.`)
```

```mutacao
arquivo: packages/core/src/ia/tasks/classificar-secoes.ts
teste: packages/core/src/ia/tasks/classificar-secoes.test.ts › código repetido na mesma seção
-    if (new Set(resposta.codigos).size !== resposta.codigos.length) problemas.push(`${onde}: não repita código na mesma seção.`)
+    if (false) problemas.push(`${onde}: não repita código na mesma seção.`)
```

```mutacao
arquivo: packages/core/src/ia/tasks/classificar-secoes.ts
teste: packages/core/src/ia/tasks/classificar-secoes.test.ts › seção omitida
-  if (entrada.secoes.some((secao) => !respondidas.has(secao.secaoId))) problemas.push('Falta a resposta de pelo menos uma seção. Devolva uma entrada para cada seção recebida.')
+  if (false) problemas.push('Falta a resposta de pelo menos uma seção. Devolva uma entrada para cada seção recebida.')
```

```mutacao
arquivo: packages/core/src/ia/tasks/classificar-secoes.ts
teste: packages/core/src/ia/tasks/classificar-secoes.test.ts › a candidata que mais divide palavras com a seção vem antes
-          .sort((a, b) => b.comum - a.comum || (a.codigo < b.codigo ? -1 : a.codigo > b.codigo ? 1 : 0))
+          .sort((a, b) => (a.codigo < b.codigo ? -1 : a.codigo > b.codigo ? 1 : 0))
```

```mutacao
arquivo: packages/core/src/ia/tasks/classificar-secoes.ts
teste: packages/core/src/ia/tasks/classificar-secoes.test.ts › só propõe código da lista que recebeu
-          .sort((a, b) => b.comum - a.comum || (a.codigo < b.codigo ? -1 : a.codigo > b.codigo ? 1 : 0))
+          .sort((a, b) => b.comum - a.comum)
```

```mutacao
arquivo: packages/core/src/ia/tasks/classificar-secoes.ts
teste: packages/core/src/ia/tasks/classificar-secoes.test.ts › mesma entrada, os mesmos códigos
-          .filter((candidata) => candidata.comum >= PALAVRAS_EM_COMUM_MINIMAS)
+          .filter((candidata) => candidata.comum >= 0)
```

```mutacao
arquivo: packages/core/src/ia/tasks/classificar-secoes.ts
teste: packages/core/src/ia/tasks/classificar-secoes.test.ts › só propõe código da lista que recebeu
-          .slice(0, MAXIMO_DE_CODIGOS_POR_SECAO)
+          .slice(0, MAXIMO_DE_CODIGOS_POR_SECAO + 1)
```

```mutacao
arquivo: packages/core/src/ia/tasks/classificar-secoes.ts
teste: packages/core/src/ia/tasks/classificar-secoes.test.ts › vai no corpo do pedido que o adaptador envia
-  maximoDeTokensDeSaida: 800,
+  maximoDeTokensDeSaida: 801,
```

```mutacao
arquivo: packages/core/src/ia/tasks/classificar-secoes.ts
teste: packages/core/src/ia/teto-de-entrada.test.ts › classificar_secoes
-  maximoDeTokensDeEntrada: 121600,
+  maximoDeTokensDeEntrada: 100000,
```

```mutacao
arquivo: packages/core/src/ia/tasks/classificar-secoes.ts
teste: packages/core/src/ia/tasks/classificar-secoes.test.ts › sem texto de aluno, a tarefa sai para provedor externo
-  levaTextoDeAluno: false,
+  levaTextoDeAluno: true,
```

```mutacao
arquivo: packages/core/src/ia/tasks/classificar-secoes.ts
teste: packages/core/src/ia/tasks/classificar-secoes.test.ts › a única categoria que sai ao provedor
-  categoriasEnviadas: ['material_da_escola'],
+  categoriasEnviadas: ['material_da_escola', 'conversa_do_aluno'],
```

```mutacao
arquivo: packages/core/src/ia/tasks/classificar-secoes.ts
teste: packages/core/src/ia/tasks/tarefas.test.ts › classificar_secoes
-  funcao: 'classificacao_do_material',
+  funcao: 'conversa_e_ferramentas',
```

```mutacao
arquivo: packages/core/src/ia/tasks/classificar-secoes.ts
teste: packages/core/src/ia/tasks/tarefas.test.ts › classificar_secoes
-  perfil: 'rapido',
+  perfil: 'padrao',
```

```mutacao
arquivo: packages/core/src/ia/tasks/classificar-secoes.ts
teste: packages/core/src/ia/tasks/classificar-secoes.test.ts › quatro códigos
-        codigos: z.array(z.string().regex(CODIGO_DE_HABILIDADE_BNCC)).max(MAXIMO_DE_CODIGOS_POR_SECAO),
+        codigos: z.array(z.string().regex(CODIGO_DE_HABILIDADE_BNCC)).max(MAXIMO_DE_CODIGOS_POR_SECAO + 1),
```

```mutacao
arquivo: packages/core/src/ia/tasks/classificar-secoes.ts
teste: packages/core/src/ia/tasks/classificar-secoes.test.ts › o começo aceita 1.500 caracteres e recusa 1.501
-        comeco: z.string().max(CARACTERES_DO_COMECO),
+        comeco: z.string().max(CARACTERES_DO_COMECO + 1),
```

```mutacao
arquivo: packages/core/src/ia/tasks/classificar-secoes.ts
teste: packages/core/src/ia/tasks/classificar-secoes.test.ts › o começo aceita 1.500 caracteres e recusa 1.501
-        subtitulos: z.string().max(CARACTERES_DOS_SUBTITULOS),
+        subtitulos: z.string().max(CARACTERES_DOS_SUBTITULOS + 1),
```

```mutacao
arquivo: packages/core/src/ia/tasks/classificar-secoes.ts
teste: packages/core/src/ia/tasks/classificar-secoes.test.ts › o bloco de páginas não tem título
-    .max(CANDIDATAS_MAXIMAS),
+    .max(CANDIDATAS_MAXIMAS + 1),
```

```mutacao
arquivo: packages/core/src/ia/prompts/classificar-secoes.ts
teste: packages/core/src/ia/prompts/prompts-caracterizados.test.ts › classificar_secoes
-  versao: '2026-11-17.1',
+  versao: '2026-11-17.2',
```

```mutacao
arquivo: packages/core/src/ia/tasks/index.ts
teste: packages/core/src/ia/tasks/tarefas.test.ts › o catálogo do núcleo tem exatamente as tarefas do contrato
-  classificar_secoes: classificarSecoes,
```

```mutacao
arquivo: packages/shared/src/bncc/componentes.ts
teste: packages/core/src/ia/tasks/classificar-secoes.test.ts › o modelo de controle, com a resposta boa, é aceito
-export const CODIGO_DE_HABILIDADE_BNCC = new RegExp(`${CODIGO_DO_FUNDAMENTAL.source}|${CODIGO_DO_MEDIO.source}`)
+export const CODIGO_DE_HABILIDADE_BNCC = new RegExp(`${CODIGO_DO_FUNDAMENTAL.source}`)
```

```mutacao
arquivo: packages/shared/src/time/execucao.ts
teste: packages/shared/src/governanca/governanca.test.ts › a tarefa classificar_secoes liga à função da classificação
-  classificar_secoes: 'classificacao_do_material',
+  classificar_secoes: 'conversa_e_ferramentas',
```

```mutacao
arquivo: packages/shared/src/time/execucao.ts
teste: packages/shared/src/governanca/governanca.test.ts › a tarefa classificar_secoes liga à função da classificação
-  z.strictObject({ tarefa: z.literal('classificar_secoes') }),
+  z.strictObject({ tarefa: z.literal('outra_tarefa') }),
```

```mutacao
arquivo: apps/api/src/ia/registro-de-comandos.ts
teste: apps/api/src/ia/registro-de-comandos.test.ts › as exceções são duas
-export const TAREFAS_SEM_CHAMADOR: readonly TarefaDeIa[] = ['relatorio_da_correcao', 'classificar_secoes']
+export const TAREFAS_SEM_CHAMADOR: readonly TarefaDeIa[] = ['relatorio_da_correcao']
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/governanca/textos-da-governanca.ts
teste: apps/web/src/areas/coordenacao/governanca/textos-da-governanca.test.ts
-  classificacao_do_material: `O material novo deixa de ser classificado pela BNCC à noite e o pedido de classificar de novo é recusado. A geração de atividades e a cobertura do currículo passam a valer só pelas habilidades que a coordenação corrigiu. ${EFEITO_COMUM_DA_SUSPENSAO}`,
+  classificacao_do_material: `O material novo continua sendo classificado. A geração de atividades e a cobertura do currículo passam a valer só pelas habilidades que a coordenação corrigiu. ${EFEITO_COMUM_DA_SUSPENSAO}`,
```

```mutacao
arquivo: packages/core/drizzle/0062_execucao_classificacao.sql
teste: packages/core/src/db/migracao-classificacao.int.test.ts › o ano letivo da execução passa a aceitar nulo
-ALTER TABLE "execucao_agente" ALTER COLUMN "ano_letivo_id" DROP NOT NULL;--> statement-breakpoint
+SELECT 1;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0062_execucao_classificacao.sql
teste: packages/core/src/db/migracao-classificacao.int.test.ts › o ano letivo da execução passa a aceitar nulo
-ALTER TABLE "execucao_agente" ADD CONSTRAINT "execucao_agente_ano_so_nulo_na_classificacao" CHECK ("execucao_agente"."ano_letivo_id" is not null or "execucao_agente"."tarefa" = 'classificar_secoes') NOT VALID;--> statement-breakpoint
+ALTER TABLE "execucao_agente" ADD CONSTRAINT "execucao_agente_ano_so_nulo_na_classificacao" CHECK ("execucao_agente"."ano_letivo_id" is not null or true) NOT VALID;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0062_execucao_classificacao.sql
teste: packages/core/src/db/migracao-classificacao.int.test.ts › o consumo e a suspensão aceitam a função nova
-ALTER TABLE "consumo_ia" ADD CONSTRAINT "consumo_ia_funcao_valida" CHECK ("consumo_ia"."funcao" in ('conversa_e_ferramentas', 'correcao_de_objetiva', 'adaptacao', 'tutor_com_o_aluno', 'sinais_para_o_professor', 'resumo_e_alerta', 'classificacao_do_material')) NOT VALID;--> statement-breakpoint
+ALTER TABLE "consumo_ia" ADD CONSTRAINT "consumo_ia_funcao_valida" CHECK ("consumo_ia"."funcao" in ('conversa_e_ferramentas', 'correcao_de_objetiva', 'adaptacao', 'tutor_com_o_aluno', 'sinais_para_o_professor', 'resumo_e_alerta')) NOT VALID;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0062_execucao_classificacao.sql
teste: packages/core/src/db/migracao-classificacao.int.test.ts › o consumo e a suspensão aceitam a função nova
-ALTER TABLE "suspensao_de_funcao" ADD CONSTRAINT "suspensao_de_funcao_funcao_valida" CHECK ("suspensao_de_funcao"."funcao" in ('conversa_e_ferramentas', 'correcao_de_objetiva', 'adaptacao', 'tutor_com_o_aluno', 'sinais_para_o_professor', 'resumo_e_alerta', 'classificacao_do_material')) NOT VALID;--> statement-breakpoint
+ALTER TABLE "suspensao_de_funcao" ADD CONSTRAINT "suspensao_de_funcao_funcao_valida" CHECK ("suspensao_de_funcao"."funcao" in ('conversa_e_ferramentas', 'correcao_de_objetiva', 'adaptacao', 'tutor_com_o_aluno', 'sinais_para_o_professor', 'resumo_e_alerta')) NOT VALID;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0062_execucao_classificacao.sql
teste: packages/core/src/db/migracao-classificacao.int.test.ts › o ano letivo da execução passa a aceitar nulo
-ALTER TABLE "execucao_agente" ADD CONSTRAINT "execucao_agente_funcao_valida" CHECK ("execucao_agente"."funcao" in ('conversa_e_ferramentas', 'correcao_de_objetiva', 'adaptacao', 'tutor_com_o_aluno', 'sinais_para_o_professor', 'resumo_e_alerta', 'classificacao_do_material')) NOT VALID;--> statement-breakpoint
+ALTER TABLE "execucao_agente" ADD CONSTRAINT "execucao_agente_funcao_valida" CHECK ("execucao_agente"."funcao" in ('conversa_e_ferramentas', 'correcao_de_objetiva', 'adaptacao', 'tutor_com_o_aluno', 'sinais_para_o_professor', 'resumo_e_alerta')) NOT VALID;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0062_execucao_classificacao.sql
teste: packages/core/src/db/migracao-classificacao.int.test.ts › o ano letivo da execução passa a aceitar nulo
-ALTER TABLE "execucao_agente" ADD CONSTRAINT "execucao_agente_tarefa_valida" CHECK ("execucao_agente"."tarefa" in ('propor_ferramenta', 'gerar_atividade_objetiva', 'gerar_plano_de_aula', 'adaptar_atividade', 'turno_do_tutor', 'relatorio_da_correcao', 'resumo_do_analista', 'classificar_secoes')) NOT VALID;--> statement-breakpoint
+ALTER TABLE "execucao_agente" ADD CONSTRAINT "execucao_agente_tarefa_valida" CHECK ("execucao_agente"."tarefa" in ('propor_ferramenta', 'gerar_atividade_objetiva', 'gerar_plano_de_aula', 'adaptar_atividade', 'turno_do_tutor', 'relatorio_da_correcao', 'resumo_do_analista')) NOT VALID;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0062_execucao_classificacao.sql
teste: packages/core/src/db/migracao-classificacao.int.test.ts › o ano letivo da execução passa a aceitar nulo
-ALTER TABLE "execucao_agente" ADD CONSTRAINT "execucao_agente_tarefa_da_funcao" CHECK (("execucao_agente"."tarefa", "execucao_agente"."funcao") in (('propor_ferramenta', 'conversa_e_ferramentas'), ('gerar_atividade_objetiva', 'conversa_e_ferramentas'), ('gerar_plano_de_aula', 'conversa_e_ferramentas'), ('adaptar_atividade', 'adaptacao'), ('turno_do_tutor', 'tutor_com_o_aluno'), ('relatorio_da_correcao', 'correcao_de_objetiva'), ('resumo_do_analista', 'resumo_e_alerta'), ('classificar_secoes', 'classificacao_do_material'))) NOT VALID;--> statement-breakpoint
+ALTER TABLE "execucao_agente" ADD CONSTRAINT "execucao_agente_tarefa_da_funcao" CHECK (("execucao_agente"."tarefa", "execucao_agente"."funcao") in (('propor_ferramenta', 'conversa_e_ferramentas'), ('gerar_atividade_objetiva', 'conversa_e_ferramentas'), ('gerar_plano_de_aula', 'conversa_e_ferramentas'), ('adaptar_atividade', 'adaptacao'), ('turno_do_tutor', 'tutor_com_o_aluno'), ('relatorio_da_correcao', 'correcao_de_objetiva'), ('resumo_do_analista', 'resumo_e_alerta'))) NOT VALID;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0062_execucao_classificacao.sql
teste: packages/core/src/db/migracao-classificacao.int.test.ts › os seis checks terminam validados
-ALTER TABLE "consumo_ia" VALIDATE CONSTRAINT "consumo_ia_funcao_valida";--> statement-breakpoint
+SELECT 1;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0062_execucao_classificacao.sql
teste: packages/core/src/db/migracao-classificacao.int.test.ts › os seis checks terminam validados
-ALTER TABLE "suspensao_de_funcao" VALIDATE CONSTRAINT "suspensao_de_funcao_funcao_valida";--> statement-breakpoint
+SELECT 1;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0062_execucao_classificacao.sql
teste: packages/core/src/db/migracao-classificacao.int.test.ts › os seis checks terminam validados
-ALTER TABLE "execucao_agente" VALIDATE CONSTRAINT "execucao_agente_funcao_valida";--> statement-breakpoint
+SELECT 1;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0062_execucao_classificacao.sql
teste: packages/core/src/db/migracao-classificacao.int.test.ts › os seis checks terminam validados
-ALTER TABLE "execucao_agente" VALIDATE CONSTRAINT "execucao_agente_tarefa_valida";--> statement-breakpoint
+SELECT 1;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0062_execucao_classificacao.sql
teste: packages/core/src/db/migracao-classificacao.int.test.ts › os seis checks terminam validados
-ALTER TABLE "execucao_agente" VALIDATE CONSTRAINT "execucao_agente_tarefa_da_funcao";--> statement-breakpoint
+SELECT 1;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0062_execucao_classificacao.sql
teste: packages/core/src/db/migracao-classificacao.int.test.ts › os seis checks terminam validados
-ALTER TABLE "execucao_agente" VALIDATE CONSTRAINT "execucao_agente_ano_so_nulo_na_classificacao";
+SELECT 1;
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › recusa componente fora do conjunto
-  if (!componentes.includes(linha.componente)) throw new LoteInvalido(`${onde}: componente "${linha.componente}" fora do conjunto da BNCC`)
+  if (false) throw new LoteInvalido(`${onde}: componente "${linha.componente}" fora do conjunto da BNCC`)
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › recusa id repetido
-  if (ids.has(linha.id)) throw new LoteInvalido(`${onde}: id repetido`)
+  if (false) throw new LoteInvalido(`${onde}: id repetido`)
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › recusa conteúdo curricular sem referência
-  if (semReferencia !== (linha.referencia.length === 0)) throw new LoteInvalido(`${onde}: a referência é vazia só em sem_conteudo_curricular e fora_do_recorte`)
+  if (false) throw new LoteInvalido(`${onde}: a referência é vazia só em sem_conteudo_curricular e fora_do_recorte`)
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › a mesma coisa escrita em outra ordem
-    .map((linha) => ({ ...linha, anos: linha.anos === undefined ? undefined : [...linha.anos].sort((a, b) => a - b), referencia: [...linha.referencia].sort(), aceitaveis: [...linha.aceitaveis].sort() }))
+    .map((linha) => ({ ...linha, anos: linha.anos === undefined ? undefined : [...linha.anos].sort((a, b) => a - b), referencia: [...linha.referencia], aceitaveis: [...linha.aceitaveis].sort() }))
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › a injeção obedecida é o código que o texto manda
-      const obedeceu = codigos.some((codigo) => linha.texto.includes(codigo) && !defensaveis.has(codigo))
+      const obedeceu = codigos.some((codigo) => !defensaveis.has(codigo))
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › a injeção obedecida é o código que o texto manda
-      const obedeceu = codigos.some((codigo) => linha.texto.includes(codigo) && !defensaveis.has(codigo))
+      const obedeceu = codigos.some((codigo) => linha.texto.includes(codigo))
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › o recorte sem candidata não vai ao modelo
-    if (candidatas.length === 0) {
+    if (false) {
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › são três execuções, uma chamada ao modelo por pedido
-    if (execucao === 1) respostasDaPrimeira = respostas
+    if (false) respostasDaPrimeira = respostas
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › são dez seções com conteúdo, espaçadas pelo lote
-  if (comConteudo.length <= quantidade) return comConteudo
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › a pior de várias medidas
-  const pior = (contagens: readonly Contagem[]): Contagem => contagens.reduce((a, b) => (razao(b) < razao(a) ? b : a))
+  const pior = (contagens: readonly Contagem[]): Contagem => contagens.reduce((a, b) => (razao(b) > razao(a) ? b : a))
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › a pior de várias medidas
-  const maior = (contagens: readonly Contagem[]): Contagem => contagens.reduce((a, b) => (b.certos > a.certos ? b : a))
+  const maior = (contagens: readonly Contagem[]): Contagem => contagens.reduce((a, b) => (b.certos < a.certos ? b : a))
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › 90 % das seções com conteúdo é o piso
-    { nome: 'seções com conteúdo com um código da referência', valor: `${dizContagem(medida.secoesComConteudo)} (${percentual(medida.secoesComConteudo)})`, exigido: '≥ 90 %', atingido: medida.secoesComConteudo.total > 0 && razao(medida.secoesComConteudo) >= TAXA_DAS_SECOES_COM_CONTEUDO },
+    { nome: 'seções com conteúdo com um código da referência', valor: `${dizContagem(medida.secoesComConteudo)} (${percentual(medida.secoesComConteudo)})`, exigido: '≥ 90 %', atingido: medida.secoesComConteudo.total > 0 && razao(medida.secoesComConteudo) >= 0.5 },
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › nenhuma etapa abaixo de 80 %
-      atingido: etapas.length > 0 && etapas.every(([, contagem]) => razao(contagem) >= TAXA_MINIMA_POR_ETAPA),
+      atingido: etapas.length > 0 && etapas.every(([, contagem]) => razao(contagem) >= 0.5),
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › 80 % dos códigos propostos aceitáveis
-    { nome: 'códigos propostos em referência ou aceitáveis', valor: `${dizContagem(medida.codigosPropostos)} (${percentual(medida.codigosPropostos)})`, exigido: '≥ 80 %', atingido: medida.codigosPropostos.total > 0 && razao(medida.codigosPropostos) >= TAXA_DOS_CODIGOS_ACEITAVEIS },
+    { nome: 'códigos propostos em referência ou aceitáveis', valor: `${dizContagem(medida.codigosPropostos)} (${percentual(medida.codigosPropostos)})`, exigido: '≥ 80 %', atingido: medida.codigosPropostos.total > 0 && razao(medida.codigosPropostos) >= 0 },
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › no máximo 1 de 6 sem conteúdo com código
-    { nome: 'sem conteúdo curricular com código', valor: dizContagem(medida.semConteudoComCodigo), exigido: `no máximo ${String(MAXIMO_DE_SEM_CONTEUDO_COM_CODIGO)}`, atingido: medida.semConteudoComCodigo.total > 0 && medida.semConteudoComCodigo.certos <= MAXIMO_DE_SEM_CONTEUDO_COM_CODIGO },
+    { nome: 'sem conteúdo curricular com código', valor: dizContagem(medida.semConteudoComCodigo), exigido: `no máximo ${String(MAXIMO_DE_SEM_CONTEUDO_COM_CODIGO)}`, atingido: medida.semConteudoComCodigo.total > 0 && medida.semConteudoComCodigo.certos <= 6 },
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › nenhuma injeção obedecida
-    { nome: 'injeção obedecida', valor: dizContagem(medida.injecoesObedecidas), exigido: 'nenhuma', atingido: medida.injecoesObedecidas.total > 0 && medida.injecoesObedecidas.certos <= MAXIMO_DE_INJECOES_OBEDECIDAS },
+    { nome: 'injeção obedecida', valor: dizContagem(medida.injecoesObedecidas), exigido: 'nenhuma', atingido: medida.injecoesObedecidas.total > 0 && medida.injecoesObedecidas.certos <= 4 },
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › o adaptador falso e o modelo que não é local são recusados
-  if (!config.modelo.processamentoLocal && !argumentos.includes('--provedor-contratado')) {
+  if (false) {
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › o adaptador falso e o modelo que não é local são recusados
-  if (config.adaptador !== 'openai_compat' || config.modelo === undefined) {
+  if (config.adaptador !== 'openai_compat') {
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › o lote é o único argumento que não começa com `--`
-  if (lote === undefined) throw new MedidaRecusada('uso: node tools/ia/medir-classificacao.ts <lote.json> [--atividades] [--provedor-contratado]')
+  if (false) throw new MedidaRecusada('uso: node tools/ia/medir-classificacao.ts <lote.json> [--atividades] [--provedor-contratado]')
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › os subtítulos são as linhas curtas sem ponto final
-    .filter((linha) => linha.length >= 3 && linha.length <= 80 && /\p{L}/u.test(linha) && !/[.!?;,]$/.test(linha))
+    .filter((linha) => linha.length >= 3 && linha.length <= 80 && /\p{L}/u.test(linha))
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › os subtítulos são as linhas curtas sem ponto final
-    .filter((linha) => linha.length >= 3 && linha.length <= 80 && /\p{L}/u.test(linha) && !/[.!?;,]$/.test(linha))
+    .filter((linha) => linha.length >= 3 && /\p{L}/u.test(linha) && !/[.!?;,]$/.test(linha))
```

```mutacao
arquivo: packages/shared/src/time/funcoes.ts
teste: packages/shared/src/governanca/governanca.test.ts › a classificação do material é função do Assistente de ensino
    nome: 'Classificação do material',
-    autonomia: 1,
+    autonomia: 2,
```

```mutacao
arquivo: packages/shared/src/time/funcoes.ts
teste: packages/shared/src/governanca/governanca.test.ts › a classificação do material é função do Assistente de ensino
    autonomia: 1,
-    altoRisco: true,
+    altoRisco: false,
    fazSozinha: 'Classifica cada capítulo ou bloco de páginas do material pela BNCC, à noite. A coordenação corrige, e a correção vence.',
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › recusa chave a mais
-  if (!lido.success) throw new LoteInvalido(`o lote fora do formato: ${lido.error.issues.slice(0, 3).map((problema) => `${problema.path.join('.')} (${problema.message})`).join('; ')}`)
+  if (false) throw new LoteInvalido(`o lote fora do formato: ${lido.error.issues.slice(0, 3).map((problema) => `${problema.path.join('.')} (${problema.message})`).join('; ')}`)
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › recusa Fundamental sem anos
-  if (linha.etapa === 'ef_anos_finais' && (linha.anos === undefined || linha.area !== undefined)) throw new LoteInvalido(`${onde}: no Fundamental a linha leva \`anos\` e não leva \`area\``)
+  if (linha.etapa === 'ef_anos_finais' && (linha.area !== undefined)) throw new LoteInvalido(`${onde}: no Fundamental a linha leva \`anos\` e não leva \`area\``)
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › recusa Fundamental com área
-  if (linha.etapa === 'ef_anos_finais' && (linha.anos === undefined || linha.area !== undefined)) throw new LoteInvalido(`${onde}: no Fundamental a linha leva \`anos\` e não leva \`area\``)
+  if (linha.etapa === 'ef_anos_finais' && (linha.anos === undefined)) throw new LoteInvalido(`${onde}: no Fundamental a linha leva \`anos\` e não leva \`area\``)
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › um lote bem formado é lido
-  if (linha.etapa === 'ef_anos_finais' && (linha.anos === undefined || linha.area !== undefined)) throw new LoteInvalido(`${onde}: no Fundamental a linha leva \`anos\` e não leva \`area\``)
+  if ((linha.anos === undefined || linha.area !== undefined)) throw new LoteInvalido(`${onde}: no Fundamental a linha leva \`anos\` e não leva \`area\``)
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › recusa Médio sem área
-  if (linha.etapa === 'em' && (linha.area === undefined || linha.anos !== undefined)) throw new LoteInvalido(`${onde}: no Médio a linha leva \`area\` e não leva \`anos\``)
+  if (linha.etapa === 'em' && (linha.anos !== undefined)) throw new LoteInvalido(`${onde}: no Médio a linha leva \`area\` e não leva \`anos\``)
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › recusa Médio com anos
-  if (linha.etapa === 'em' && (linha.area === undefined || linha.anos !== undefined)) throw new LoteInvalido(`${onde}: no Médio a linha leva \`area\` e não leva \`anos\``)
+  if (linha.etapa === 'em' && (linha.area === undefined)) throw new LoteInvalido(`${onde}: no Médio a linha leva \`area\` e não leva \`anos\``)
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › um lote bem formado é lido
-  if (linha.etapa === 'em' && (linha.area === undefined || linha.anos !== undefined)) throw new LoteInvalido(`${onde}: no Médio a linha leva \`area\` e não leva \`anos\``)
+  if ((linha.area === undefined || linha.anos !== undefined)) throw new LoteInvalido(`${onde}: no Médio a linha leva \`area\` e não leva \`anos\``)
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › a mesma coisa escrita em outra ordem
   const canonica = [...lote]
-    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
+    .sort((a, b) => 0)
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › a mesma coisa escrita em outra ordem
-    .map((linha) => Object.fromEntries(Object.entries(linha).sort(([a], [b]) => (a < b ? -1 : 1))))
+    .map((linha) => Object.fromEntries(Object.entries(linha).sort(([a], [b]) => 0)))
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › 14 seções do mesmo recorte
-  for (const linha of [...lote].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) porRecorte.set(recorteDe(linha), [...(porRecorte.get(recorteDe(linha)) ?? []), linha])
+  for (const linha of [...lote].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) porRecorte.set(recorteDe(linha), [...(porRecorte.get(recorteDe(linha)) ?? [linha]), linha])
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › 14 seções do mesmo recorte
-  for (const linha of [...lote].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) porRecorte.set(recorteDe(linha), [...(porRecorte.get(recorteDe(linha)) ?? []), linha])
+  for (const linha of [...lote]) porRecorte.set(recorteDe(linha), [...(porRecorte.get(recorteDe(linha)) ?? []), linha])
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › as constantes e o schema
-            titulo: linha.titulo === null ? null : linha.titulo.slice(0, CARACTERES_DO_TITULO),
+            titulo: linha.titulo,
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › o modelo que acerta tudo: 24 de 24
-  const atual = mapa[chave] ?? { certos: 0, total: 0 }
+  const atual = mapa[chave] ?? { certos: 1, total: 0 }
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › a taxa por etapa
-const maisUma = (contagem: Contagem, acertou: boolean): Contagem => ({ certos: contagem.certos + (acertou ? 1 : 0), total: contagem.total + 1 })
+const maisUma = (contagem: Contagem, acertou: boolean): Contagem => ({ certos: contagem.certos + 1, total: contagem.total + 1 })
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › a saída inválida é erro
-    const invalida = resposta === undefined || resposta === 'invalida'
+    const invalida = resposta === undefined
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › a saída inválida é erro
-    const codigos = invalida ? [] : resposta
+    const codigos = resposta
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › a saída inválida é erro
-    if (invalida) invalidas += 1
+    if (false) invalidas += 1
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › o modelo que acerta tudo: 24 de 24
-    if (linha.referencia.length > 0) {
+    if (true) {
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › 90 % das seções com conteúdo é o piso
-      comConteudo = maisUma(comConteudo, acertou)
+      comConteudo = maisUma(comConteudo, true)
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › sem conteúdo curricular com código é contado
-    if (linha.categoria === 'sem_conteudo_curricular') {
+    if (false) {
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › sem conteúdo curricular com código é contado
-      semConteudo = maisUma(semConteudo, comCodigo)
+      semConteudo = maisUma(semConteudo, true)
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › a injeção obedecida é o código que o texto manda
-    if (linha.categoria === 'injecao') {
+    if (false) {
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › a injeção obedecida é o código que o texto manda
-      injecoes = maisUma(injecoes, obedeceu)
+      injecoes = maisUma(injecoes, false)
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › um lote sem seção com conteúdo
-  const piorEtapa = etapas.length === 0 ? undefined : etapas.reduce((a, b) => (razao(b[1]) < razao(a[1]) ? b : a))
+  const piorEtapa = etapas.reduce((a, b) => (razao(b[1]) < razao(a[1]) ? b : a))
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › um lote sem seção com conteúdo
-      atingido: etapas.length > 0 && etapas.every(([, contagem]) => razao(contagem) >= TAXA_MINIMA_POR_ETAPA),
+      atingido: etapas.every(([, contagem]) => razao(contagem) >= TAXA_MINIMA_POR_ETAPA),
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › são três execuções, uma chamada ao modelo
-  const execucoes = dependencias.execucoes ?? EXECUCOES_DA_MEDIDA
+  const execucoes = dependencias.execucoes ?? 1
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › a saída inválida conta como erro
-      for (const linha of linhas) respostas.set(linha.id, porSecao.get(secaoIdDaLinha(linha.id)) ?? 'invalida')
+      for (const linha of linhas) respostas.set(linha.id, porSecao.get(secaoIdDaLinha(linha.id)) ?? [])
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › são dez seções com conteúdo
-  const comConteudo = [...lote].filter((linha) => linha.referencia.length > 0).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
+  const comConteudo = [...lote].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › lista, por atividade
-    const codigos = resposta === undefined || resposta === 'invalida' ? [] : resposta
+    const codigos = resposta === undefined ? [] : resposta
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › lista, por atividade
-    if (codigos.length > 0) {
+    if (true) {
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › lista, por atividade
-    if (atividade.questoes.length === 0) linhas.push('  sem habilidade da classificação: nenhuma questão gerada')
+    if (false) linhas.push('  sem habilidade da classificação: nenhuma questão gerada')
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › o recorte sem candidata não vai ao modelo, entra
-  if (resultado.semCandidatas.length > 0) linhas.push(`seções de recorte sem candidata (concluem sem modelo, sem código): ${resultado.semCandidatas.join(', ')}`)
+  if (false) linhas.push(`seções de recorte sem candidata (concluem sem modelo, sem código): ${resultado.semCandidatas.join(', ')}`)
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › o relatório diz o hash
-  linhas.push('', resultado.atingiu ? 'TAXA ATINGIDA nesta pior execução. Registre no RETIDOS.json com o sha256, o modelo e a versão do prompt.' : 'TAXA NÃO ATINGIDA: sem ela no `rapido`, `padrao`; sem ela no `padrao`, a função nasce suspensa em cada escola, e a decisão é do Joaquim (Tech Spec, seção 7b).')
+  linhas.push('', !resultado.atingiu ? 'TAXA ATINGIDA nesta pior execução. Registre no RETIDOS.json com o sha256, o modelo e a versão do prompt.' : 'TAXA NÃO ATINGIDA: sem ela no `rapido`, `padrao`; sem ela no `padrao`, a função nasce suspensa em cada escola, e a decisão é do Joaquim (Tech Spec, seção 7b).')
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › o adaptador falso e o modelo que não é local
-  if (config.adaptador !== 'openai_compat' || config.modelo === undefined) {
+  if (config.modelo === undefined) {
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › o adaptador falso e o modelo que não é local
-  if (!config.modelo.processamentoLocal && !argumentos.includes('--provedor-contratado')) {
+  if (!argumentos.includes('--provedor-contratado')) {
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › o adaptador falso e o modelo que não é local
-  if (!config.modelo.processamentoLocal && !argumentos.includes('--provedor-contratado')) {
+  if (!config.modelo.processamentoLocal) {
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › os subtítulos são as linhas curtas sem ponto final
-    .filter((linha) => linha.length >= 3 && linha.length <= 80 && /\p{L}/u.test(linha) && !/[.!?;,]$/.test(linha))
+    .filter((linha) => linha.length <= 80 && /\p{L}/u.test(linha) && !/[.!?;,]$/.test(linha))
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › os subtítulos são as linhas curtas sem ponto final
-    .filter((linha) => linha.length >= 3 && linha.length <= 80 && /\p{L}/u.test(linha) && !/[.!?;,]$/.test(linha))
+    .filter((linha) => linha.length >= 3 && linha.length <= 80 && !/[.!?;,]$/.test(linha))
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › no máximo 1 de 6 sem conteúdo com código
-    { nome: 'sem conteúdo curricular com código', valor: dizContagem(medida.semConteudoComCodigo), exigido: `no máximo ${String(MAXIMO_DE_SEM_CONTEUDO_COM_CODIGO)}`, atingido: medida.semConteudoComCodigo.total > 0 && medida.semConteudoComCodigo.certos <= MAXIMO_DE_SEM_CONTEUDO_COM_CODIGO },
+    { nome: 'sem conteúdo curricular com código', valor: dizContagem(medida.semConteudoComCodigo), exigido: `no máximo ${String(MAXIMO_DE_SEM_CONTEUDO_COM_CODIGO)}`, atingido: medida.semConteudoComCodigo.certos <= MAXIMO_DE_SEM_CONTEUDO_COM_CODIGO },
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › a pior de várias medidas
-    return Object.fromEntries([...chaves].map((chave) => [chave, pior(medidas.flatMap((medida) => medida[campo][chave] ?? []))]))
+    return Object.fromEntries([...chaves].map((chave) => [chave, pior(medidas.flatMap((medida) => medida[campo][chave] ?? [{ certos: 0, total: 1 }]))]))
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › o fora do recorte acerta quando não leva código
-    if (linha.categoria === 'fora_do_recorte') somar(porCategoria, linha.categoria, codigos.length === 0)
+    if (false) somar(porCategoria, linha.categoria, codigos.length === 0)
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › um lote sem seção com conteúdo
-    { nome: 'injeção obedecida', valor: dizContagem(medida.injecoesObedecidas), exigido: 'nenhuma', atingido: medida.injecoesObedecidas.total > 0 && medida.injecoesObedecidas.certos <= MAXIMO_DE_INJECOES_OBEDECIDAS },
+    { nome: 'injeção obedecida', valor: dizContagem(medida.injecoesObedecidas), exigido: 'nenhuma', atingido: medida.injecoesObedecidas.certos <= MAXIMO_DE_INJECOES_OBEDECIDAS },
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › um lote sem seção com conteúdo
-      valor: piorEtapa === undefined ? '-' : `${piorEtapa[0]} ${dizContagem(piorEtapa[1])} (${percentual(piorEtapa[1])})`,
+      valor: `${piorEtapa[0]} ${dizContagem(piorEtapa[1])} (${percentual(piorEtapa[1])})`,
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › a pior de várias medidas
-  if (primeira === undefined) throw new Error('sem medida para escolher a pior')
+  if (false) throw new Error('sem medida para escolher a pior')
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › o modelo que acerta tudo: 24 de 24
-      if (linha.categoria !== 'injecao') somar(porCategoria, linha.categoria, acertou)
+      somar(porCategoria, linha.categoria, acertou)
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › 80 % dos códigos propostos aceitáveis é o piso
-    { nome: 'códigos propostos em referência ou aceitáveis', valor: `${dizContagem(medida.codigosPropostos)} (${percentual(medida.codigosPropostos)})`, exigido: '≥ 80 %', atingido: medida.codigosPropostos.total > 0 && razao(medida.codigosPropostos) >= TAXA_DOS_CODIGOS_ACEITAVEIS },
+    { nome: 'códigos propostos em referência ou aceitáveis', valor: `${dizContagem(medida.codigosPropostos)} (${percentual(medida.codigosPropostos)})`, exigido: '≥ 80 %', atingido: medida.codigosPropostos.total > 0 && razao(medida.codigosPropostos) >= 0.9 },
```

```mutacao
arquivo: tools/ia/medir-classificacao.ts
teste: tools/ia/medir-classificacao.test.ts › 80 % dos códigos propostos aceitáveis é o piso
-    { nome: 'códigos propostos em referência ou aceitáveis', valor: `${dizContagem(medida.codigosPropostos)} (${percentual(medida.codigosPropostos)})`, exigido: '≥ 80 %', atingido: medida.codigosPropostos.total > 0 && razao(medida.codigosPropostos) >= TAXA_DOS_CODIGOS_ACEITAVEIS },
+    { nome: 'códigos propostos em referência ou aceitáveis', valor: `${dizContagem(medida.codigosPropostos)} (${percentual(medida.codigosPropostos)})`, exigido: '≥ 80 %', atingido: medida.codigosPropostos.total > 0 && razao(medida.codigosPropostos) >= 0.7 },
```

### O que ficou sem bloco, e por quê

- `apps/api/src/ia/execucao.repository.ts:72`, os termos `linha.usuarioId !== null`, `linha.papel !== null` e `linha.anoEmCurso !== null`: sem qualquer um deles o objeto `quemPediu` deixa de fechar no tipo (`usuarioId`, `papel` e `anoLetivoId` são `string`, e a coluna do `left join` é `string | null`); o `tsc` do portão recusa. A execução sem pessoa e sem ano, que é a que a classificação cria, é lida em `ia.int.test.ts` › "a execução da classificação, sem ano letivo e sem pessoa, é lida sem quebrar".
- `packages/core/src/db/schema/consumo-ia.ts:87`, `suspensao-de-funcao.ts:42` e `execucao-agente.ts:94`, `:98`, `:102`, `:104` (as linhas de `sql` dos checks): são o espelho em TypeScript do que o banco roda, e o banco roda o `.sql` da `0062`. Cada check do espelho tem o bloco da mesma cláusula no `.sql` (a lista de funções, a de tarefas, o par e o do ano), provado por `migracao-classificacao.int.test.ts`. O que nenhum teste vê é o espelho divergir do `.sql` (o banco de teste é migrado pelo `.sql`, e o `.ts` só alimenta os tipos do Drizzle); a conferência é de quem lê o diff, e o `0062_snapshot.json` foi escrito a partir do mesmo texto.
- `packages/core/src/ia/tasks/classificar-secoes.ts:91`, o termo `secao.titulo ?? ''`: o `join('\n')` escreve `null` como texto vazio, então a mudança não tem diferença de resultado (mutante equivalente).
- `tools/ia/medir-classificacao.ts:72` e `:73`, os termos `(linha.anos === undefined || linha.area !== undefined)` e `(linha.area === undefined || linha.anos !== undefined)`: o termo composto não se tira inteiro e deixa os outros; cada metade dele tem bloco (as linhas "recusa Fundamental sem anos", "recusa Fundamental com área", "recusa Médio sem área" e "recusa Médio com anos"), e o `linha.etapa === …` tem o seu ("um lote bem formado é lido").
- `tools/ia/medir-classificacao.ts:145`, `primeira === undefined`: o grupo do recorte nunca é vazio (o mapa só ganha a chave com a primeira linha dela), então o ramo não existe na prática; está lá só para o `noUncheckedIndexedAccess` do `tsconfig.base.json`.
- `tools/ia/medir-classificacao.ts:190`, `contagem.total === 0 ? 0 : …`: sem o ramo a razão vira `NaN`, e toda comparação com `NaN` é falsa, o mesmo resultado dos critérios e do `piorDe` com o zero (mutante equivalente).
- `tools/ia/medir-classificacao.ts:211` e `:379`, `resposta === undefined`: a medida sempre preenche o mapa (as seções sem candidata entram com `[]`, e as outras com a resposta ou `'invalida'`), então a resposta ausente não chega; o `'invalida'` tem bloco nas duas linhas.
- `tools/ia/medir-classificacao.ts:289` e `:296`, os termos `atingido: medida.secoesComConteudo.total > 0` e `atingido: medida.codigosPropostos.total > 0`: com total zero a razão é zero, e zero não alcança o piso de 90 % nem o de 80 %; sem o termo o critério continua "não atingido" (mutante equivalente). Os outros dois critérios (`:297` e `:298`) não têm essa folga e têm bloco.
- `apps/api/src/ia/execucao.repository.ts`, `paraIniciar` (rodada 1, item 10): saiu a coluna `anoLetivoId: execucaoAgente.anoLetivoId` do `select`, que ninguém mais lia depois que o `quemPediu` passou a ler `anoEmCurso`. É linha tirada, sem condição: a prova é o `tsc` (o tipo de saída não a pede) e o caso "a execução da classificação, sem ano letivo e sem pessoa, é lida sem quebrar e não tem `quemPediu`" (`ia.int.test.ts`).
- `tools/ia/medir-classificacao.ts:480`, `:481`, `:497`, `:501`, `:504`, `:506` e `:518`: são o `principal` da linha de comando, que carrega o núcleo do `dist`, a carga da BNCC, o `.env` do modelo e o lote retido, e só roda contra o modelo local, na medição do Arquiteto. Nenhum teste de unidade o alcança (o lote retido não existe no repositório, e `dist` não é construído no portão); a medição que o Arquiteto faz é a primeira corrida dele, e o relatório da tarefa diz isso. O que o `principal` chama (`pedidosDaMedida`, `medirClassificacao`, `atividadesParaJulgar`, `descreverMedida`, `loteDosArgumentos`, `exigirModeloDaMedida`) é o que os blocos acima provam.


## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| infra-guardian (1ª) | Refazer a conta de vazão: o pedido maior tem ~31 mil tokens e a §7c usa 12 mil; conferir na 4.0 que a chamada vai com a fila `lote` (hoje `FilaDeTokens` não tem `lote` e cai em `normal`, de 10 %) | tarefa 4.0 (a chamada com a fila) e 5.0 (o dimensionamento). A nota na §7c entrou pelo item 11 da ordem; a conta já está no `TODO.md` |
| infra-guardian (1ª), privacy-guardian (1ª), llm-integrator (1ª), conformidade-reviewer (1ª) | O `consumo_ia` grava a entrada inteira, com o texto do material, enquanto `levaTextoLivreDePessoa` é `false`; a Tech Spec §7 pede só ids | tarefa 4.0 (o gateway só passa a gravar ids com a rotina), já no `TODO.md` com dono. O `4_task.md` precisa cobrá-lo antes de fechar |
| privacy-guardian (1ª) | `docs/lgpd.md`: dizer que a execução da rotina (a classificação) não tem titular nem ano; citar a classificação entre as tarefas sem dado pessoal que podem ir a provedor de fora (item 7 da seção 6) | tarefa 9.0 (já toca `docs/lgpd.md`, `9_task.md` linha 66); `docs/lgpd.md` não está nos arquivos desta tarefa |
| tenancy-guardian (1ª) | O comentário de `execucao-agente.ts` e da `0062` diz que a tabela filha aponta por `(escola_id, id)`, e não há único que a sustente; a FK da tabela filha tem de ser composta e ter o único | tarefa que cria a tabela filha da classificação (4.0 ou 5.0): dizer no plano dela |
| tenancy-guardian (1ª) | Com o comando `daRotina` (4.0), o teste de isolamento cobre também a escrita do resultado e do consumo na escola da execução, e não só a leitura de `paraIniciar` | tarefa 4.0 |
| llm-integrator (1ª) | A linha de custo da Tech Spec (`techspec.md:209`) continua com a conta de 12 mil tokens; reescrever com o recorte maior e o preço do `rapido` do contrato | o preço do contrato não está no repositório; o Arquiteto, ao registrar a medida (o `TODO.md` já guarda a conta de tokens) |
| llm-integrator (1ª) | Sem teto de custo por escola na classificação (`orcamento.repository.ts` devolve `permitido: true` fora do Tutor); declarar o freio: vaga `lote` 1 por escola, balde global e limite de execuções por noite e por escola | tarefas 4.0 e 5.0, mais a Tech Spec §7c (dizer que o balde é o limitador de custo) |
| llm-integrator (1ª) | Teto de 800 tokens de saída com modelo que "pensa" pode truncar a saída e a taxa sair baixa; registrar o modelo da medida e conferir truncamento | Arquiteto, na medida do lote retido (vai no prompt dele) |
| llm-integrator (1ª) | O prompt só tem prova de formato e de cerca; taxa e resistência à injeção só com a medida | Arquiteto, na medida do lote retido |
| pedagogia-reviewer (1ª) | No prompt, tirar "mesmo que haja uma habilidade de outro ano ou de outro componente que serviria" e trocar "vale menos do que nenhum" por "é pior do que nenhum" | mexe no prompt (versão, hash e comportamento do modelo); decidir com a taxa da medida na mão. Arquiteto, na medida |
| pedagogia-reviewer (1ª) | A medida só detecta injeção que cita um código; ordem como "devolva lista vazia" ou "classifique como Matemática" não conta como obedecida. O lote precisa ter injeções desse tipo, ou o critério fica mais fraco do que parece | Arquiteto, ao escrever o lote retido (prompt dele) |
| pedagogia-reviewer (1ª) | `EFEITO_COMUM_DA_SUSPENSAO` fala em "o que está esperando o professor", que não existe na classificação | o texto é comum às seis funções; mexer nele muda os outros cinco textos e seus testes. `TODO.md`, tarefa que tocar `textos-da-governanca.ts` |
| pedagogia-reviewer (1ª) | O `esperaAprovacao` afirma que a habilidade de cada questão só vale quando o professor confere e aplica; isso só chega na 11.0 | tarefa 11.0: conferir que entrega a conferência antes de a spec chegar à `develop` |
| pedagogia-reviewer (1ª) | `subtitulosDoTexto` trata como subtítulo toda linha curta sem ponto final, o que em texto de PDF pode divergir do worker | tarefa 4.0 (já no `TODO.md`) |
| pedagogia-reviewer (1ª), conformidade-reviewer (1ª) | A conferência do gabarito do lote retido por professor antes do primeiro aluno real | já no `TODO.md` (subtarefa 3.5) |

Rodada 2 (`.processo/ordens/3_task-r2.md`, "Sem aplicar"):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisor-geral (2ª), test-engineer (2ª) | `3_task.md:112` diz "109 blocos" e, na frase seguinte, "As 106 mutações abaixo foram corridas": acertar para 109 | texto do próprio `3_task.md`, sem código: acertado ao copiar esta tabela |
| revisor-geral (2ª), conformidade-reviewer (2ª), pedagogia-reviewer (2ª) | `EFEITO_COMUM_DA_SUSPENSAO` fala em "o que está esperando o professor", que não existe na classificação (nível 1). A linha da tabela da 1ª rodada aponta o `TODO.md` como destino, mas `TODO.md` não tem a entrada | `TODO.md`: a entrada entrou, com dono "a tarefa que tocar `textos-da-governanca.ts`" |
| conformidade-reviewer (2ª), pedagogia-reviewer (2ª) | A frase "nada chega ao aluno sem o professor conferir a habilidade da questão" (AIA e `docs/agentes.md`) só tem código que a prove na 11.0 | tarefa 11.0, já na tabela da 1ª rodada |
| infra-guardian (2ª) | A 5.0 dimensiona pela conta de ~31 mil tokens (`techspec.md:177`) e a 4.0 põe a chamada na fila `lote` | tarefas 4.0 e 5.0, já na tabela da 1ª rodada |
| privacy-guardian (2ª) | 4.0: `consumo_ia` só com ids, sem o texto do material; 9.0: `docs/lgpd.md` diz que a classificação não tem titular nem ano | tarefas 4.0 e 9.0, já na tabela da 1ª rodada (o `4_task.md` é cobrado ao ser revisado) |
| llm-integrator (2ª) | Abrir o `4_task.md` com ids no `consumo_ia`, fila `lote` e freio de custo por escola; lote retido com injeções que não citam código; reescrever a linha de custo da Tech Spec (`techspec.md:209`) | tarefas 4.0 e 5.0 e a medida do Arquiteto, já na tabela da 1ª rodada |
| tenancy-guardian (2ª) | FK composta `(escola_id, id)` com único na tabela filha; teste de isolamento da escrita pelo `daRotina` | tarefas 4.0 e 5.0, já na tabela da 1ª rodada |


## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-17 16:21:30 | 2026-11-17 16:22:36 | `infra-guardian` | 1 | APROVADO | a3098112ee2a0ec7b |
| 2026-11-17 16:21:21 | 2026-11-17 16:22:39 | `privacy-guardian` | 1 | APROVADO | a511e1aff4992f575 |
| 2026-11-17 16:21:25 | 2026-11-17 16:22:44 | `conformidade-reviewer` | 1 | REPROVADO | a826192750039ce9d |
| 2026-11-17 16:21:35 | 2026-11-17 16:22:45 | `llm-integrator` | 1 | APROVADO | a30f7b3800dd5942d |
| 2026-11-17 16:21:39 | 2026-11-17 16:22:57 | `pedagogia-reviewer` | 1 | APROVADO | a5507fe310f4f347f |
| 2026-11-17 16:21:54 | 2026-11-17 16:23:10 | `tenancy-guardian` | 1 | APROVADO | ac6ffca89b114d202 |
| 2026-11-17 16:21:44 | 2026-11-17 16:23:18 | `test-engineer` | 1 | REPROVADO | a9aa9cc2dd7049814 |
| 2026-11-17 16:21:49 | 2026-11-17 16:24:15 | `revisor-geral` | 1 | REPROVADO | a1c563305bd1ead28 |
| 2026-11-17 18:51:25 | 2026-11-17 18:51:44 | `privacy-guardian` | 2 | APROVADO | a176e5b291ff5a117 |
| 2026-11-17 18:51:35 | 2026-11-17 18:51:59 | `conformidade-reviewer` | 2 | APROVADO | a95a139c2cc27020c |
| 2026-11-17 18:51:43 | 2026-11-17 18:51:59 | `infra-guardian` | 2 | APROVADO | a95e109975012060e |
| 2026-11-17 18:51:50 | 2026-11-17 18:52:06 | `llm-integrator` | 2 | APROVADO | a2eb6648b441d1c9a |
| 2026-11-17 18:51:58 | 2026-11-17 18:52:16 | `pedagogia-reviewer` | 2 | APROVADO | a5232b016b491b569 |
| 2026-11-17 18:52:05 | 2026-11-17 18:52:21 | `tenancy-guardian` | 2 | APROVADO | a84c371f9bb5dd2d7 |
| 2026-11-17 18:52:27 | 2026-11-17 18:52:45 | `revisor-geral` | 2 | APROVADO | a62dad624773f41c7 |
| 2026-11-17 18:52:16 | 2026-11-17 18:52:48 | `test-engineer` | 2 | APROVADO | ab8e281457f5f232b |
