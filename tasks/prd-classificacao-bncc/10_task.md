# Tarefa 10.0 — A geração usa a BNCC da seção citada, e o catálogo próprio sai

**Funcionalidade:** classificacao-bncc · **Depende de:** 8.0, 9.0 e a medida do Arquiteto no lote retido
**Subagentes obrigatórios:** `tenancy-guardian`, `conformidade-reviewer`, `infra-guardian`, `llm-integrator`, `pedagogia-reviewer`
**Porte:** grande

## Objetivo

A busca da ferramenta e do chat devolve, com cada trecho, as habilidades da seção da página (pelo recorte atual da turma);
a questão leva uma delas, ou nenhuma, e a de fora é anulada na gravação; o Tutor não recebe as habilidades da seção; o
catálogo `QUI.EM.*` sai do código e do seed; e o diagnóstico conta a questão sem habilidade com `codigo: null`.

## Contexto necessário

- `techspec.md` §5 "Geração" e "Suspensão", §7c, §7b
- `prd.md` RF2, RF7
- `cenarios.md` "Geração e Tutor", "Permissão e isolamento" (busca), "Carga" (`EXPLAIN`)
- A medida do lote retido já está registrada: o Orquestrador confere antes de pedir a tarefa. Não abra `docs/aia/ouro-retido/`
- `.claude/rules/`: 10, 30, 70, 80
- Código: os arquivos da tabela abaixo; `habilidadesParaOTema` (`conferencia.ts`), `habilidadeMaisProxima`
  (`gerar-atividade-objetiva.ts`), `habilidadeSchema` (`conteudo.ts`)

## Subtarefas

- [x] 10.1 — A busca junta `habilidade_da_secao` pela seção da página (`escola_id` no join), filtrada pelo recorte atual da turma; com a função suspensa, só `origem: 'coordenacao'`
- [x] 10.2 — Atividade, plano, adaptação e chat: a questão escolhe uma das da página citada, ou `null`; o plano, a união das seções citadas; fora da seção, anulada na gravação, com `ia.habilidade_anulada`
- [x] 10.3 — O Tutor segue com `materialId`, `pagina` e `texto`; saem `habilidades.ts`, `habilidadesParaOTema` e o seed `QUI.EM.*`; `por_habilidade` com `codigo: null`; a leitura aceita `null` e código antigo (conferir a produção, D82)
- [x] 10.4 — O passo 1 do `docs/roteiro-da-demonstracao.md` ganha a correção do capítulo 7 no painel (8.0); o `e2e/roteiro-da-demonstracao.spec.ts` acompanha
- [x] 10.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/test/geracao-pela-secao.int.test.ts` | novo |
| `packages/shared/src/assistente/habilidades.ts` | sai |
| `apps/api/src/material/trecho-search.ts`, `apps/api/src/artefato/conferencia.ts`, `apps/api/src/artefato/ferramentas.command.ts`, `apps/api/src/artefato/adaptacao.command.ts`, `apps/api/src/assistente/proposta.command.ts`, `packages/core/src/ia/tasks/gerar-atividade-objetiva.ts`, `packages/core/src/ia/tasks/gerar-plano-de-aula.ts`, `packages/core/src/ia/tasks/adaptar-atividade.ts`, `packages/core/src/ia/tasks/conteudo.test.ts`, `packages/core/src/ia/__fixtures__/inputs.ts`, `packages/shared/src/assistente/conteudo.ts`, `packages/shared/src/atividade/desempenho.ts`, `packages/shared/src/index.ts`, `packages/shared/src/assistente/assistente.test.ts`, `apps/api/src/atividade/correcao/correcao-de-objetiva.ts`, `apps/api/src/atividade/desempenho/desempenho.service.ts`, `apps/api/src/tutor/turno.command.ts`, `apps/api/src/artefato/artefato.int.test.ts`, `apps/api/src/tutor/tutor-modelo.int.test.ts`, `e2e/support/seed.ts`, `docs/roteiro-da-demonstracao.md`, `e2e/roteiro-da-demonstracao.spec.ts` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| questão do capítulo 7; com habilidade do 3 | I | a do 7; gravada `null`, `ia.habilidade_anulada` soma. Mutação: tirar a conferência | `geracao-pela-secao.int.test.ts` › a habilidade que o modelo escolhe de outra seção…; › cada questão leva a habilidade da seção da página que cita…; `conferencia.test.ts` › a questão que cita o capítulo 7 com a habilidade do 3 sai sem habilidade… |
| seção `aguardando`; `sem_habilidade`; páginas antes do capítulo 1 | I | `null`, um caso cada | `geracao-pela-secao.int.test.ts` › a seção ainda `aguardando` ou `sem_habilidade`…; › devolve com cada trecho as habilidades da seção da página, e nenhuma para a página de antes do primeiro capítulo; `conteudo.test.ts` › a página de uma seção sem habilidade… |
| questão `null` | I | no `por_habilidade` com `codigo: null` | `correcao.int.test.ts` › a questão sem habilidade (classificacao-bncc, 10.0) entra no diagnóstico com `codigo: null`; `correcao-de-objetiva.test.ts`; `lote.test.ts`; `analista.int.test.ts` › a questão sem habilidade da BNCC… (recorte e dado nominal) |
| função suspensa | I | só `origem: 'ia'` dá `null`. Mutação: ler `origem: 'ia'` | `geracao-pela-secao.int.test.ts` › a correção da coordenação vale na geração seguinte, e com a função suspensa só a da coordenação chega ao modelo |
| a correção da coordenação | I | vale na geração seguinte | o mesmo caso |
| plano com os capítulos 3 e 7 | I | a união das seções que o plano cita (a questão cita uma página só: o caso dela é o da linha da atividade) | `geracao-pela-secao.int.test.ts` › o plano de aula leva a união…; `conteudo.test.ts` › o plano cobre a união das seções que cita…; `conferencia.test.ts` › o plano guarda só a união das seções que cita |
| material passado do 6º ao 9º | I | a turma do 9º não recebe `EF06…` | `geracao-pela-secao.int.test.ts` › material de seção com habilidades do 6º e do 9º ano… |
| virada do ano | I | a turma do ano novo usa a classificação de antes | `geracao-pela-secao.int.test.ts` › virada do ano… |
| `QUI.EM.05` do `ScriptedAdapter`: atividade; plano; adaptação; chat | U | recusado ou anulado, um caso cada | `conteudo.test.ts` › `QUI.EM.05` na boca do modelo é recusado na atividade e no plano…; › a adaptação mantém a habilidade `null`…; › o chat não leva habilidade…; e, na gravação, `geracao-pela-secao.int.test.ts` › o código do antigo catálogo (`QUI.EM.05`) que chegasse à gravação… |
| entrada do Tutor (o Tutor não produz habilidade; o `QUI.EM.05` da memória de atividade antiga é aceito, ver Divergências) | I, U | sem habilidade da seção. Mutação: passar as habilidades | `tutor-modelo.int.test.ts` › o Tutor não recebe as habilidades da seção…; `turno-do-tutor.test.ts` › o trecho do Tutor é o `{ materialId, pagina, texto }` estrito… |
| seed | I | todo código existe em `habilidade_bncc` | `geracao-pela-secao.int.test.ts` › todo código de habilidade que os seeds gravam existe em `habilidade_bncc` |
| atividade antiga com `QUI.EM.05`; questão `null` | I | a leitura aceita | `geracao-pela-secao.int.test.ts` › a atividade de antes, com o código `QUI.EM.05`, e a que tem questão sem habilidade (`null`), abrem para a professora; `Artefato.test.tsx`, `Atividade.test.tsx`, `Aprovar.test.tsx`, `TurmaHoje.test.tsx` (a tela abre com `null`) |
| busca da A | I | sem a `habilidade_da_secao` da B. Mutação: tirar `escola_id` do join | `geracao-pela-secao.int.test.ts` › a busca de A não alcança a seção de B…; › a geração de A nunca leva a habilidade de B… |
| `EXPLAIN` do join | I | a consulta do repository (`.toSQL()`), com as 12 páginas da busca e 5.000 seções, usa o índice da §7c, pela escola e pelo material. Mutação: tirar o `or(...)` | `geracao-pela-secao.int.test.ts` › o join da busca usa o índice `(escola_id, material_id, pagina_inicial)` da seção |
| roteiro | E | o passo 1 com a correção, conferido passo a passo | `roteiro-da-demonstracao.spec.ts` › do painel da operação à governança… (passo 4b: a coordenação corrige o capítulo 7 no painel, e a geração do passo seguinte usa a correção) |

## Como testar

- Geração: `apps/api/src/artefato/artefato.int.test.ts` › "a professora pede no chat, aceita a proposta, gera a atividade com a página citada…" e "o plano de aula sai com a duração padrão da aula…"
- Tutor: `apps/api/src/tutor/tutor-modelo.int.test.ts` › "a questão vai sem gabarito e sem explicação, a memória só com lote aprovado, e nenhum nome de pessoa"
- Saída do modelo: `packages/core/src/ia/tasks/conteudo.test.ts` › "citar página que não veio nos trechos é saída inválida, mesmo com o material certo"
- Roteiro: `e2e/roteiro-da-demonstracao.spec.ts` › "a turma mostra o acerto por habilidade, e a aluna vê o diagnóstico…"
- `npx vitest run --project integracao apps/api/test/geracao-pela-secao.int.test.ts`
- Armadilha: os testes que citam `QUI.EM` (`grep -rln "QUI\.EM" apps packages e2e`), cada um trocado ou justificado no plano

## Autoconferência

As 12 perguntas do modelo, no plano. Na 8: `habilidade` vira `null` em contratos de leitura; procure quem a lê com `.codigo`.

## Fora do escopo desta tarefa

"Sem habilidade" nas telas (12.0); a troca (11.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| A proposta do chat não leva habilidade, e a geração que o chat pede passa pela busca da ferramenta (`TrechoSearch.findComHabilidades`), que é a que traz as habilidades | A tarefa `propor_ferramenta` só escolhe a ferramenta e os parâmetros e tem campos fechados: não há onde a habilidade morar, e o `conteudo.test.ts` prova que ela recusa o campo. A atividade que o chat pede nasce depois, pela ferramenta, com a busca da seção. O texto do plano dizia "a busca da ferramenta e do chat" | `techspec.md` §5 "Geração" (ajustada nesta tarefa); `cenarios.md` "Geração e Tutor" (o caso do chat) |
| A descrição acima de 300 caracteres (162 habilidades da BNCC passam disso, até 1.500) vai ao modelo cortada em palavra, com reticências (`descricaoParaOModelo`); o texto inteiro segue em `habilidade_bncc` | O teto de 300 do `habilidadeSchema` é o que os tetos de entrada medidos (Tutor, relatório e Analista, `teto-de-entrada.test.ts`) pressupõem; subir para 1.500 estoura o pior caso válido de cada uma | `techspec.md` §5 "Geração" (o corte, escrito nesta tarefa) |
| "Questão que cita dois" capítulos: a questão tem uma `citacao` só (`citacaoSchema`); quem cita vários é o plano, e o caso da união é o do plano | A forma do contrato é a da F3 e não muda aqui; a questão com a habilidade da seção de *uma* página já está nos casos da atividade | `cenarios.md` "Geração e Tutor" (a linha do plano) |
| A conferência da seção (`anularHabilidadesForaDaSecao`) roda na gravação (`saveArtefato`), e a saída do modelo é conferida a mais na tarefa (`conferir`: código fora da união dos trechos é recusado) | Com `fila.comModelo` o `ModeloDeTeste` não passa pelo `conferir` do gateway; a regra da tarefa (recusar) se prova nos testes de unidade com o `ScriptedAdapter`, e a anulação, nos de integração, pela gravação. As duas conferências coexistem: a da tarefa barra o código que não veio em trecho nenhum, e a da gravação anula o que veio de outra seção | `techspec.md` §5 "Geração" |
| Os testes que citam `QUI.EM` ficam em seis grupos, cada um justificado: (a) **a leitura do legado** (D82: a produção guarda atividades com `QUI.EM.*`): `geracao-pela-secao.int.test.ts`, `conferencia.test.ts`, `Artefato.test.tsx`, `pdf-do-artefato.test.ts`, `atividade-isolamento.int.test.ts`; (b) **o código recusado pela FK** a `habilidade_bncc`: `migracao-f4b.int.test.ts`, `extrair-pdf.int.test.ts`; (c) **exemplo de contrato** em schemas e telas, em que o código é só texto que passa (`packages/shared/**/*.test.ts`, `mvp-tables.int.test.ts`, `atividade.int.test.ts`, `textos-da-governanca.test.ts`, as telas `Aprovar`, `TurmaHoje`, `AlunosDaTurma`, `Atividade`, `SinoDoProfessor`, `ResultadoDaFerramenta`); (d) `QUI.EM` como **proibido na saída do aluno** (`atividade.int.test.ts` linha 147); (e) o **comentário** de `alunos-da-turma.ts` e (f) o texto do `docs/mvp-contratos.md`, que agora diz que o catálogo saiu. O que usava o catálogo para *gerar* ou para *semear* foi trocado por código da BNCC que existe em `habilidade_bncc` (`EM13CNT101` a `104`), e o caso "todo código do seed existe" o prova | `techspec.md` §5; a armadilha do "Como testar" |
| O "`QUI.EM.05` na boca do modelo" do Tutor não tem caso de recusa: o Tutor não produz habilidade (a saída dele é a resposta, sem campo de habilidade), e o `QUI.EM.05` que a memória de uma atividade antiga traz é aceito (D82). O que a linha do Tutor prova é outra coisa: o trecho dele é `{ materialId, pagina, texto }` estrito (`turno-do-tutor.test.ts`) e a entrada dele não recebe as habilidades da seção (`tutor-modelo.int.test.ts`, com o bloco de mutação que passa os dois) | O Tutor só consome a habilidade da atividade aplicada; recusar `QUI.EM.05` na saída dele não tem o que recusar | `cenarios.md` "Geração e Tutor" (a linha "Cada saída recusa `QUI.EM.05`…", que lista o Tutor pela memória); o caso do Tutor é o da linha "entrada do Tutor" |
| A volta da versão (rollback) depois da 10.0 é por **expandir antes de gravar**: a leitura de `habilidade: null`, `habilidades: []` e `codigo: null` pousa numa correção própria na `develop` e na `main`, antes da classificacao-bncc; não há bloco de SQL de volta | O código de antes exige `habilidade` na questão e `.min(1)` no `codigo` do diagnóstico, e nenhum SQL os torna legíveis sem inventar habilidade; a triagem do Arquiteto (item 2 da ordem da 1ª rodada) escolheu o caminho (a) e tirou o (b) | `techspec.md` §7c, linha "Migration"; `docs/runbook.md`, "Voltar o código depois da classificacao-bncc 10.0"; `TODO.md` (ordem dos pousos) |
| O teto de entrada de `gerar_atividade_objetiva` e de `gerar_plano_de_aula` sobe de 26.100 para 31.300 tokens (+20%), os dois | O schema aceita 12 trechos com até 5 habilidades de 300 caracteres cada, e a união delas chega a 60 (eram, no máximo, 6): o pior pedido medido com `piorEntradaDaTarefa` deu 31.184 tokens na atividade e 31.203 no plano. O gerador do pior pedido repetia o mesmo valor em todo item de lista, a união deduplicava em 5 e o teste passava com 26.036 sem cobrir o campo (a regra 80, itens 4 e 11, e a regra 40, item 1): agora os itens de uma lista saem distintos, sem mudar o comprimento (`teto-de-entrada.ts`), e um caso prova que a união do pior pedido é de 60. O teto é o que o limitador e a reserva de tokens leem: a reserva de cada pedido dessas duas tarefas sobe na mesma proporção, no teto, não no consumo real. Os itens distintos valem para toda tarefa do catálogo, e os tetos das outras continuaram cobrindo o pior pedido sem mudar: é o caso `teto-de-entrada.test.ts` › "%s: o pior pedido cabe no teto, e o teto não sobra mais que a margem", que roda por tarefa do `TASK_CATALOG` | `techspec.md` §5 "Geração" (o teto de entrada); `teto-de-entrada.test.ts` |
| O caso de e2e de `professor-turma-alunos.spec.ts` que lia a lista de alunos e a prova de que ela não é ranking foi dividido em dois | O caso tocado por esta tarefa (o código de habilidade do seed mudou de `QUI.EM.04` para `EM13CNT101`) passava de 15 s, a metade do prazo que o portão cobra (e o segundo, depois da divisão, ainda levou 15,2 s no celular: a varredura de acessibilidade do caso de ranking saiu, porque o caso de 360 px da mesma aba já a faz, e repeti-la custava ~2 s); o `abrirAbaComDesempenho` leva a abertura da aba e o cenário, e cada caso paga a entrada uma vez | o portão da tarefa (`tools/ci/duracao-do-e2e.ts`), sem mudança de spec |
| A "Sem habilidade" nas telas fica do jeito mínimo que o tipo exige (o rótulo `ROTULO_SEM_HABILIDADE`, sem código nem descrição inventados): a Atividade da aluna, o Resumo e a tabela por questão do Aprovar, o Hoje da professora, o Analista, o dado nominal e a folha do artefato | O contrato passou a aceitar `null`, e uma tela que lê `.codigo` de `null` quebra; o desenho de verdade das telas (texto, ordem, explicação) é da 12.0 | o "Fora do escopo" desta tarefa (12.0) |

## Mutações

`--faltando: 4 linhas (68 blocos, 6 motivos)`. As 4 que o comando ainda lista são as de baixo, cada uma com o motivo no fim da seção: três guardas que só estreitam o tipo ou poupam a consulta e a união de `material.ts` (a saída é a mesma sem elas: é mutante equivalente, e nenhum teste pode ficar vermelho). Todo bloco foi rodado à parte com o runner do portão (`conferirMutacoes`) e deixou vermelho um caso que rodou e falhou. O nome do caso em `teste:` vai sem parênteses nem `.` de regex, porque o `-t` do Vitest o lê como expressão regular, e um nome com `(classificacao-bncc, 10.0)` casa com nenhum caso e passa em verde por não ter rodado nada (foi o que pegou 24 blocos na primeira corrida).

```mutacao
arquivo: apps/api/src/artefato/conferencia.ts
teste: apps/api/src/artefato/conferencia.test.ts › a questão que cita o capítulo 7 com a habilidade do 3 sai sem habilidade, e a conta soma
-  const doTrecho = (citacao: Citacao): readonly Habilidade[] => entregues.find((trecho) => trecho.materialId === citacao.materialId && trecho.pagina === citacao.pagina)?.habilidades ?? []
+  const doTrecho = (citacao: Citacao): readonly Habilidade[] => entregues.find((trecho) => trecho.materialId === citacao.materialId)?.habilidades ?? []
```

```mutacao
arquivo: apps/api/src/artefato/conferencia.ts
teste: apps/api/src/artefato/conferencia.test.ts › a página de mesmo número em outro material não vale
-  const doTrecho = (citacao: Citacao): readonly Habilidade[] => entregues.find((trecho) => trecho.materialId === citacao.materialId && trecho.pagina === citacao.pagina)?.habilidades ?? []
+  const doTrecho = (citacao: Citacao): readonly Habilidade[] => entregues.find((trecho) => trecho.pagina === citacao.pagina)?.habilidades ?? []
```

```mutacao
arquivo: apps/api/src/artefato/conferencia.ts
teste: apps/api/src/artefato/conferencia.test.ts › a questão com a habilidade da seção da página que cita fica como está
-  if (conteudo.tipo === 'atividade_objetiva') {
+  if (conteudo.tipo !== 'atividade_objetiva') {
```

```mutacao
arquivo: apps/api/src/artefato/conferencia.ts
teste: apps/api/src/artefato/conferencia.test.ts › a questão sem habilidade não conta como anulada
-      if (habilidade === null || doTrecho(questao.citacao).some((daPagina) => daPagina.codigo === habilidade.codigo)) return questao
+      if (doTrecho(questao.citacao).some((daPagina) => daPagina.codigo === habilidade.codigo)) return questao
```

```mutacao
arquivo: apps/api/src/artefato/conferencia.ts
teste: apps/api/src/artefato/conferencia.test.ts › a questão com a habilidade da seção da página que cita fica como está
-      if (habilidade === null || doTrecho(questao.citacao).some((daPagina) => daPagina.codigo === habilidade.codigo)) return questao
+      if (habilidade === null) return questao
```

```mutacao
arquivo: apps/api/src/artefato/conferencia.ts
teste: apps/api/src/artefato/conferencia.test.ts › a questão perdeu a habilidade
-const mesmaHabilidade = (a: Habilidade | null, b: Habilidade | null): boolean => (a === null || b === null ? a === b : a.codigo === b.codigo && a.descricao === b.descricao)
+const mesmaHabilidade = (a: Habilidade | null, b: Habilidade | null): boolean => (b === null ? a === b : a.codigo === b.codigo && a.descricao === b.descricao)
```

```mutacao
arquivo: apps/api/src/artefato/conferencia.ts
teste: apps/api/src/artefato/conferencia.test.ts › a versão adaptada não dá habilidade à questão que não tinha
-const mesmaHabilidade = (a: Habilidade | null, b: Habilidade | null): boolean => (a === null || b === null ? a === b : a.codigo === b.codigo && a.descricao === b.descricao)
+const mesmaHabilidade = (a: Habilidade | null, b: Habilidade | null): boolean => (a === null || a.codigo === b.codigo && a.descricao === b.descricao)
```

```mutacao
arquivo: apps/api/src/artefato/conferencia.ts
teste: apps/api/src/artefato/conferencia.test.ts › a descrição da habilidade mudou
-const mesmaHabilidade = (a: Habilidade | null, b: Habilidade | null): boolean => (a === null || b === null ? a === b : a.codigo === b.codigo && a.descricao === b.descricao)
+const mesmaHabilidade = (a: Habilidade | null, b: Habilidade | null): boolean => (a === null || b === null ? a === b : a.codigo === b.codigo)
```

```mutacao
arquivo: apps/api/src/artefato/conferencia.ts
teste: apps/api/src/artefato/conferencia.test.ts › a habilidade mudou
-        mesmaHabilidade(questao.habilidade, origem.habilidade) &&
+        true &&
```

```mutacao
arquivo: apps/api/src/artefato/ferramentas.command.ts
teste: apps/api/test/geracao-pela-secao.int.test.ts › a habilidade que o modelo escolhe de outra seção
-  if (anuladas > 0) metricas.habilidadeAnulada(requireEscolaId(), anuladas)
+  if (anuladas > 0) metricas.habilidadeAnulada(requireEscolaId(), 0)
```

```mutacao
arquivo: apps/api/src/artefato/ferramentas.command.ts
teste: apps/api/test/geracao-pela-secao.int.test.ts › cada questão leva a habilidade da seção da página que cita
-      entrada: { tema: lido.parametros.tema, quantidade: lido.parametros.quantidade ?? QUESTOES_PADRAO_POR_ATIVIDADE, contexto: lido.contexto, trechos: trechosDaTarefa(lido) },
+      entrada: { tema: lido.parametros.tema, quantidade: lido.parametros.quantidade ?? QUESTOES_PADRAO_POR_ATIVIDADE, contexto: lido.contexto, trechos: trechosDaTarefa(lido).map((trecho) => ({ ...trecho, habilidades: [] })) },
```

```mutacao
arquivo: apps/api/src/atividade/correcao/correcao-de-objetiva.ts
teste: apps/api/src/atividade/correcao/correcao-de-objetiva.test.ts › conta numa linha à parte
-    const codigo = questao.habilidade?.codigo ?? null
+    const codigo = questao.habilidade?.codigo ?? 'GERAL'
```

```mutacao
arquivo: apps/api/src/atividade/correcao/correcao-de-objetiva.ts
teste: apps/api/src/atividade/correcao/correcao-de-objetiva.test.ts › conta numa linha à parte
-    const habilidade = porHabilidade.get(codigo) ?? { codigo, acertos: 0, total: 0 }
+    const habilidade = { codigo, acertos: 0, total: 0 }
```

```mutacao
arquivo: apps/api/src/atividade/correcao/lote.ts
teste: apps/api/src/atividade/correcao/lote.test.ts › a linha sem habilidade soma as questões de todos os alunos
-    const codigo = questao.habilidade?.codigo ?? null
+    const codigo = questao.habilidade?.codigo ?? ''
```

```mutacao
arquivo: apps/api/src/atividade/correcao/lote.ts
teste: apps/api/src/atividade/correcao/lote.test.ts › a linha sem habilidade soma as questões de todos os alunos
-    if (!habilidades.has(codigo)) habilidades.set(codigo, questao.habilidade)
+    if (codigo !== null && !habilidades.has(codigo)) habilidades.set(codigo, questao.habilidade)
```

```mutacao
arquivo: apps/api/src/atividade/desempenho/desempenho.service.ts
teste: apps/api/src/atividade/correcao/correcao.int.test.ts › entra no diagnóstico com `codigo: null`
-      const habilidade = (codigo: string | null) => (codigo === null ? null : { codigo, descricao: descricoes.get(codigo) ?? codigo })
+      const habilidade = (codigo: string | null) => ({ codigo, descricao: descricoes.get(codigo as string) ?? (codigo as string) })
```

```mutacao
arquivo: apps/api/src/atividade/desempenho/desempenho.service.ts
teste: apps/api/src/atividade/correcao/correcao.int.test.ts › entra no diagnóstico com `codigo: null`
-        const doAluno = porAluno.get(linha.alunoId) ?? new Map<string | null, Soma>()
+        const doAluno = new Map<string | null, Soma>()
```

```mutacao
arquivo: apps/api/src/atividade/desempenho/desempenho.service.ts
teste: apps/api/src/atividade/correcao/correcao.int.test.ts › entra no diagnóstico com `codigo: null`
-      const codigos = [...porHabilidade.keys()].sort((a, b) => (a === b ? 0 : a === null ? 1 : b === null ? -1 : a < b ? -1 : 1)).slice(0, MAXIMO_DE_HABILIDADES_NO_DESEMPENHO)
+      const codigos = [...porHabilidade.keys()].sort((a, b) => (a === b ? 0 : a === null ? -1 : b === null ? 1 : a < b ? -1 : 1)).slice(0, MAXIMO_DE_HABILIDADES_NO_DESEMPENHO)
```

```mutacao
arquivo: apps/api/src/atividade/desempenho/desempenho.service.ts
teste: apps/api/src/atividade/correcao/correcao.int.test.ts › entra no diagnóstico com `codigo: null`
-          const doAluno = porAluno.get(aluno.alunoId) ?? new Map<string | null, Soma>()
+          const doAluno = porAluno.get(aluno.alunoId) as Map<string | null, Soma>
```

```mutacao
arquivo: apps/api/src/governanca/analista.command.ts
teste: apps/api/src/governanca/analista.int.test.ts › entra no recorte numa linha própria
-        porHabilidade: doRecorte.slice(0, MAXIMO_DE_HABILIDADES_POR_RECORTE).map((linha) => ({ habilidade: linha.codigo === null ? null : { codigo: linha.codigo, descricao: descricoes.get(linha.codigo) ?? linha.codigo }, acertos: linha.acertos, total: linha.total })),
+        porHabilidade: doRecorte.slice(0, MAXIMO_DE_HABILIDADES_POR_RECORTE).map((linha) => ({ habilidade: { codigo: linha.codigo as string, descricao: descricoes.get(linha.codigo as string) ?? (linha.codigo as string) }, acertos: linha.acertos, total: linha.total })),
```

```mutacao
arquivo: apps/api/src/governanca/analista.service.ts
teste: apps/api/src/governanca/analista.int.test.ts › o dado nominal da turma também leva a linha `habilidade: null`
-          .map((linha) => ({ habilidade: linha.codigo === null ? null : { codigo: linha.codigo, descricao: descricoes.get(linha.codigo) ?? linha.codigo }, acertos: linha.acertos, total: linha.total })),
+          .map((linha) => ({ habilidade: { codigo: linha.codigo as string, descricao: descricoes.get(linha.codigo as string) ?? (linha.codigo as string) }, acertos: linha.acertos, total: linha.total })),
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/test/geracao-pela-secao.int.test.ts › a busca de A não alcança a seção de B
       .where(
         and(
-          eq(secaoDoMaterial.escolaId, escolaId),
+          undefined,
           or(...paginas.map((pagina) => and(eq(secaoDoMaterial.materialId, pagina.materialId), lte(secaoDoMaterial.paginaInicial, pagina.pagina), gte(secaoDoMaterial.paginaFinal, pagina.pagina)))),
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/test/geracao-pela-secao.int.test.ts › a série do pedido é a da turma
-      .innerJoin(disciplina, and(eq(disciplina.escolaId, serie.escolaId), eq(disciplina.id, recorte.disciplinaId)))
+      .innerJoin(disciplina, eq(disciplina.id, recorte.disciplinaId))
-      .where(and(eq(serie.escolaId, escolaId), eq(serie.id, recorte.serieId)))
+      .where(eq(serie.id, recorte.serieId))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/test/geracao-pela-secao.int.test.ts › o recorte é o atual da turma
-      .where(and(eq(serie.escolaId, escolaId), eq(serie.id, recorte.serieId)))
+      .where(eq(serie.escolaId, escolaId))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/test/geracao-pela-secao.int.test.ts › a série do pedido é a da turma
-    if (turmaDoPedido === undefined || turmaDoPedido.componente === null) return porPagina
+    if (turmaDoPedido.componente === null) return porPagina
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/test/geracao-pela-secao.int.test.ts › a série do pedido é a da turma
-    if (turmaDoPedido === undefined || turmaDoPedido.componente === null) return porPagina
+    if (turmaDoPedido === undefined) return porPagina
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/test/geracao-pela-secao.int.test.ts › a correção da coordenação vale na geração seguinte
-          soDaCoordenacao ? eq(habilidadeDaSecao.origem, 'coordenacao') : undefined,
+          undefined,
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/test/geracao-pela-secao.int.test.ts › material de seção com habilidades do 6º e do 9º ano
-        .filter((linha) => linha.materialId === materialId && linha.paginaInicial <= pagina && pagina <= linha.paginaFinal && habilidadeEhCandidata(linha.codigo, componente, series))
+        .filter((linha) => linha.materialId === materialId && linha.paginaInicial <= pagina && pagina <= linha.paginaFinal && true)
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/test/geracao-pela-secao.int.test.ts › devolve com cada trecho as habilidades da seção da página
-      .innerJoin(habilidadeDaSecao, and(eq(habilidadeDaSecao.escolaId, secaoDoMaterial.escolaId), eq(habilidadeDaSecao.secaoId, secaoDoMaterial.id)))
+      .innerJoin(habilidadeDaSecao, eq(habilidadeDaSecao.escolaId, secaoDoMaterial.escolaId))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/test/geracao-pela-secao.int.test.ts › a série do pedido é a da turma
-      .innerJoin(disciplina, and(eq(disciplina.escolaId, serie.escolaId), eq(disciplina.id, recorte.disciplinaId)))
+      .innerJoin(disciplina, eq(disciplina.escolaId, serie.escolaId))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/test/geracao-pela-secao.int.test.ts › dois materiais na mesma busca
-        .filter((linha) => linha.materialId === materialId && linha.paginaInicial <= pagina && pagina <= linha.paginaFinal && habilidadeEhCandidata(linha.codigo, componente, series))
+        .filter((linha) => linha.paginaInicial <= pagina && pagina <= linha.paginaFinal && habilidadeEhCandidata(linha.codigo, componente, series))
```

```mutacao
arquivo: apps/api/src/material/trecho-search.ts
teste: apps/api/test/geracao-pela-secao.int.test.ts › a série do pedido é a da turma
-    return achados.map((trecho) => ({ ...trecho, habilidades: habilidades.get(`${trecho.materialId}:${String(trecho.pagina)}`) ?? [] }))
+    return achados.map((trecho) => ({ ...trecho, habilidades: habilidades.get(`${trecho.materialId}:${String(trecho.pagina)}`) as Habilidade[] }))
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/turno.command.test.ts › a linha `codigo: null` do diagnóstico conta no lote
-  if (lido.success) for (const { habilidade } of lido.data.questoes) if (habilidade !== null) habilidades.set(habilidade.codigo, habilidade)
+  if (lido.success) for (const { habilidade } of lido.data.questoes) habilidades.set(habilidade!.codigo, habilidade!)
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/turno.command.test.ts › o Tutor recebe a questão com `habilidade: null`
-  return { numero, enunciado: questao.enunciado, alternativas: [...questao.alternativas], habilidade: questao.habilidade === null ? null : { codigo: questao.habilidade.codigo, descricao: questao.habilidade.descricao } }
+  return { numero, enunciado: questao.enunciado, alternativas: [...questao.alternativas], habilidade: { codigo: questao.habilidade!.codigo, descricao: questao.habilidade!.descricao } }
```

```mutacao
arquivo: packages/core/src/ia/material.ts
teste: packages/core/src/ia/tasks/conteudo.test.ts › cada questão leva uma habilidade da própria página
-  return habilidadesDosTrechos(trechos.filter((trecho) => trecho.materialId === citacao.materialId && trecho.pagina === citacao.pagina))
+  return habilidadesDosTrechos(trechos.filter((trecho) => trecho.materialId === citacao.materialId))
```

```mutacao
arquivo: packages/core/src/ia/material.ts
teste: packages/core/src/ia/tasks/conteudo.test.ts › a página de mesmo número em outro material não empresta a habilidade
-  return habilidadesDosTrechos(trechos.filter((trecho) => trecho.materialId === citacao.materialId && trecho.pagina === citacao.pagina))
+  return habilidadesDosTrechos(trechos.filter((trecho) => trecho.pagina === citacao.pagina))
```

```mutacao
arquivo: packages/core/src/ia/material.ts
teste: packages/core/src/ia/tasks/conteudo.test.ts › a página de uma seção sem habilidade
-  if (primeira === undefined) return null
+  if (primeira === undefined) return { codigo: 'GERAL', descricao: 'Geral' }
```

```mutacao
arquivo: packages/core/src/ia/tasks/adaptar-atividade.ts
teste: packages/core/src/ia/tasks/conteudo.test.ts › a adaptação mantém a habilidade `null` da questão original
-      if (adaptada.habilidade?.codigo !== original.habilidade?.codigo) problemas.push(`${onde}: a habilidade é a da questão original, copiada como veio.`)
+      if (false) problemas.push(`${onde}: a habilidade é a da questão original, copiada como veio.`)
```

```mutacao
arquivo: packages/core/src/ia/tasks/gerar-atividade-objetiva.ts
teste: packages/core/src/ia/tasks/conteudo.test.ts › `QUI.EM.05` na boca do modelo é recusado na atividade e no plano, e `null` na questão vale
-    if (questao.habilidade !== null && !codigos.has(questao.habilidade.codigo)) problemas.push(`${onde}: a habilidade precisa ser uma das recebidas, copiada como veio, ou null.`)
+    if (!codigos.has(questao.habilidade.codigo)) problemas.push(`${onde}: a habilidade precisa ser uma das recebidas, copiada como veio, ou null.`)
```

```mutacao
arquivo: packages/core/src/ia/tasks/gerar-atividade-objetiva.ts
teste: packages/core/src/ia/tasks/conteudo.test.ts › `QUI.EM.05` na boca do modelo é recusado na atividade e no plano, e `null` na questão vale
-    if (questao.habilidade !== null && !codigos.has(questao.habilidade.codigo)) problemas.push(`${onde}: a habilidade precisa ser uma das recebidas, copiada como veio, ou null.`)
+    if (questao.habilidade !== null) problemas.push(`${onde}: a habilidade precisa ser uma das recebidas, copiada como veio, ou null.`)
```

```mutacao
arquivo: packages/core/src/ia/tasks/gerar-plano-de-aula.ts
teste: packages/core/src/ia/tasks/conteudo.test.ts › `QUI.EM.05` na boca do modelo é recusado na atividade e no plano, e `null` na questão vale
-    if (saida.habilidades.some((habilidade) => !codigos.has(habilidade.codigo))) problemas.push('As habilidades do plano precisam ser das recebidas, copiadas como vieram, ou a lista vazia.')
+    if (false) problemas.push('As habilidades do plano precisam ser das recebidas, copiadas como vieram, ou a lista vazia.')
```

```mutacao
arquivo: packages/core/src/ia/tasks/gerar-plano-de-aula.ts
teste: packages/core/src/ia/tasks/conteudo.test.ts › o plano cobre a união das seções que cita
-      habilidades: habilidadesDosTrechos(entrada.trechos.filter((trecho) => usados.some((apoio) => apoio.materialId === trecho.materialId && apoio.pagina === trecho.pagina))).slice(0, MAXIMO_DE_HABILIDADES_DO_PLANO),
+      habilidades: habilidadesDosTrechos(entrada.trechos.filter((trecho) => usados.some((apoio) => apoio.materialId === trecho.materialId))).slice(0, MAXIMO_DE_HABILIDADES_DO_PLANO),
```

```mutacao
arquivo: packages/core/src/ia/tasks/gerar-plano-de-aula.ts
teste: packages/core/src/ia/tasks/conteudo.test.ts › o plano cobre a união das seções que cita
-      habilidades: habilidadesDosTrechos(entrada.trechos.filter((trecho) => usados.some((apoio) => apoio.materialId === trecho.materialId && apoio.pagina === trecho.pagina))).slice(0, MAXIMO_DE_HABILIDADES_DO_PLANO),
+      habilidades: habilidadesDosTrechos(entrada.trechos.filter((trecho) => usados.some((apoio) => apoio.pagina === trecho.pagina))).slice(0, MAXIMO_DE_HABILIDADES_DO_PLANO),
```

```mutacao
arquivo: packages/core/src/ia/tasks/relatorio-da-correcao.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › manda retomar o conteúdo da questão
-const assuntoDaQuestao = (questao: QuestaoCorrigida): string => (questao.habilidade === null ? 'o conteúdo desta questão' : `“${questao.habilidade.descricao}”`)
+const assuntoDaQuestao = (questao: QuestaoCorrigida): string => `“${questao.habilidade!.descricao}”`
```

```mutacao
arquivo: packages/core/src/ia/tasks/relatorio-da-correcao.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › manda retomar o conteúdo da questão
-  else if (acertos * 2 < total) partes.push(`Menos da metade acertou: vale retomar ${assuntoDaQuestao(questao)}.`)
+  else if (false) partes.push(`Menos da metade acertou: vale retomar ${assuntoDaQuestao(questao)}.`)
```

```mutacao
arquivo: packages/core/src/ia/tasks/resumo-do-analista.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › entra no resumo
-    const medida = codigoDoAlerta === undefined ? undefined : recorte?.porHabilidade.find((item) => item.habilidade?.codigo === codigoDoAlerta)
+    const medida = recorte?.porHabilidade.find((item) => item.habilidade?.codigo === codigoDoAlerta)
```

```mutacao
arquivo: packages/core/src/ia/tasks/resumo-do-analista.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › entra no resumo
-          medida.habilidade === null
+          false
             ? []
```

```mutacao
arquivo: packages/core/src/ia/tasks/turno-do-tutor.ts
teste: packages/core/src/ia/tasks/turno-do-tutor.test.ts › não derruba o turno
   if (questao === undefined) return ['']
-  return [questao.enunciado, ...questao.alternativas, questao.habilidade?.descricao ?? '']
+  return [questao.enunciado, ...questao.alternativas, questao.habilidade!.descricao]
```

```mutacao
arquivo: packages/core/src/ia/tasks/turno-do-tutor.ts
teste: packages/core/src/ia/tasks/turno-do-tutor.test.ts › sem questão em andamento
-  if (questao === undefined) return ['']
+  if (false) return ['']
```

```mutacao
arquivo: packages/core/src/ia/tasks/turno-do-tutor.ts
teste: packages/core/src/ia/tasks/turno-do-tutor.test.ts › não derruba o turno
-  const codigoDaQuestao = entrada.questao?.habilidade?.codigo
+  const codigoDaQuestao = entrada.questao?.habilidade!.codigo
   const daQuestao = codigoDaQuestao === undefined ? undefined : entrada.memoria.find((item) => item.habilidade.codigo === codigoDaQuestao)
```

```mutacao
arquivo: packages/shared/src/assistente/conteudo.ts
teste: packages/shared/src/assistente/assistente.test.ts › a descrição da BNCC acima do teto do contrato
-  if (descricao.length <= MAXIMO_DE_CARACTERES_DA_HABILIDADE) return descricao
+  if (false) return descricao
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividade.tsx
teste: apps/web/src/areas/aluno/Atividade.test.tsx › entra no resultado da aluna
-                <ProgressBar key={item.habilidade?.codigo ?? 'sem-habilidade'} rotulo={item.habilidade?.descricao ?? ROTULO_SEM_HABILIDADE} valor={item.acertos} maximo={item.total} texto={textoDoAcerto(item.acertos, item.total)} />
+                <ProgressBar key={item.habilidade!.codigo} rotulo={item.habilidade!.descricao} valor={item.acertos} maximo={item.total} texto={textoDoAcerto(item.acertos, item.total)} />
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/governanca/Analista.tsx
teste: apps/web/src/areas/coordenacao/governanca/Analista.test.tsx › entra no recorte
-                  key={medida.habilidade?.codigo ?? 'sem-habilidade'}
+                  key={medida.habilidade!.codigo}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/governanca/Analista.tsx
teste: apps/web/src/areas/coordenacao/governanca/Analista.test.tsx › entra no recorte
-                  rotulo={medida.habilidade?.descricao ?? ROTULO_SEM_HABILIDADE}
+                  rotulo={medida.habilidade!.descricao}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/governanca/Analista.tsx
teste: apps/web/src/areas/coordenacao/governanca/Analista.test.tsx › entra no recorte
-                  {...(medida.habilidade === null ? {} : { detalhe: medida.habilidade.codigo })}
+                  {...{ detalhe: medida.habilidade!.codigo }}
```

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/ConteudoDoArtefato.tsx
teste: apps/web/src/areas/professor/artefatos/Artefato.test.tsx › abre
-                    {questao.habilidade === null ? (
+                    {false ? (
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Aprovar.tsx
teste: apps/web/src/areas/professor/atividades/Aprovar.test.tsx › aparece no Resumo
-                  <ProgressBar key={item.habilidade?.codigo ?? 'sem-habilidade'} rotulo={item.habilidade === null ? ROTULO_SEM_HABILIDADE : `${item.habilidade.codigo} · ${item.habilidade.descricao}`} valor={item.acertos} maximo={item.total} texto={`${String(item.acertos)} de ${String(item.total)}`} />
+                  <ProgressBar key={item.habilidade!.codigo} rotulo={`${item.habilidade!.codigo} · ${item.habilidade!.descricao}`} valor={item.acertos} maximo={item.total} texto={`${String(item.acertos)} de ${String(item.total)}`} />
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Aprovar.tsx
teste: apps/web/src/areas/professor/atividades/Aprovar.test.tsx › aparece no Resumo
-                  { chave: 'habilidade', titulo: 'Habilidade', celula: (questao) => questao.habilidade?.codigo ?? ROTULO_SEM_HABILIDADE },
+                  { chave: 'habilidade', titulo: 'Habilidade', celula: (questao) => questao.habilidade!.codigo },
```

```mutacao
arquivo: apps/web/src/areas/professor/turmas/TurmaHoje.tsx
teste: apps/web/src/areas/professor/turmas/TurmaHoje.test.tsx › é uma barra
-                key={item.habilidade?.codigo ?? 'sem-habilidade'}
+                key={item.habilidade!.codigo}
```

```mutacao
arquivo: apps/web/src/areas/professor/turmas/TurmaHoje.tsx
teste: apps/web/src/areas/professor/turmas/TurmaHoje.test.tsx › é uma barra
-                rotulo={item.habilidade === null ? ROTULO_SEM_HABILIDADE : `${item.habilidade.codigo} · ${item.habilidade.descricao}`}
+                rotulo={`${item.habilidade!.codigo} · ${item.habilidade!.descricao}`}
```

```mutacao
arquivo: apps/api/src/artefato/ferramentas.command.ts
teste: apps/api/test/geracao-pela-secao.int.test.ts › a habilidade que o modelo escolhe de outra seção
-  const { conteudo: gravado, anuladas } = anularHabilidadesForaDaSecao(conteudo.data, entregues)
+  const { conteudo: gravado, anuladas } = { conteudo: conteudo.data, anuladas: 0 }
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/tutor-modelo.int.test.ts › o Tutor não recebe as habilidades da seção
falha: toBe('concluida')
-        trechos: entregues.map(({ materialId, pagina, texto }) => ({ materialId, pagina, texto })),
+        trechos: entregues.map(({ materialId, pagina, texto }) => ({ materialId, pagina, texto, habilidades: [{ codigo: 'EM13CNT101', descricao: 'Habilidade da seção.' }] })),
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/test/geracao-pela-secao.int.test.ts › o join da busca usa o índice
falha: toBeGreaterThan(0)
           eq(secaoDoMaterial.escolaId, escolaId),
-          or(...paginas.map((pagina) => and(eq(secaoDoMaterial.materialId, pagina.materialId), lte(secaoDoMaterial.paginaInicial, pagina.pagina), gte(secaoDoMaterial.paginaFinal, pagina.pagina)))),
+          undefined,
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/governanca/DadoNominal.tsx
teste: apps/web/src/areas/coordenacao/governanca/Analista.test.tsx › mostra a linha sem habilidade como
-                    key={medida.habilidade?.codigo ?? 'sem-habilidade'}
+                    key={medida.habilidade!.codigo}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/governanca/DadoNominal.tsx
teste: apps/web/src/areas/coordenacao/governanca/Analista.test.tsx › mostra a linha sem habilidade como
-                    rotulo={medida.habilidade?.descricao ?? ROTULO_SEM_HABILIDADE}
+                    rotulo={medida.habilidade!.descricao}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/governanca/DadoNominal.tsx
teste: apps/web/src/areas/coordenacao/governanca/Analista.test.tsx › mostra a linha sem habilidade como
-                    {...(medida.habilidade === null ? {} : { detalhe: medida.habilidade.codigo })}
+                    {...{ detalhe: medida.habilidade!.codigo }}
```

```mutacao
arquivo: packages/core/src/ia/teto-de-entrada.ts
teste: packages/core/src/ia/teto-de-entrada.test.ts › o pior pedido da geração tem as habilidades de cada trecho distintas
-  return variacao.length <= tamanho ? variacao + 'a'.repeat(tamanho - variacao.length) : 'a'.repeat(tamanho)
+  return 'a'.repeat(tamanho)
```

```mutacao
arquivo: packages/core/src/ia/teto-de-entrada.ts
teste: packages/core/src/ia/teto-de-entrada.test.ts › o texto curto demais para levar o número do item
-  return variacao.length <= tamanho ? variacao + 'a'.repeat(tamanho - variacao.length) : 'a'.repeat(tamanho)
+  return true ? variacao + 'a'.repeat(tamanho - variacao.length) : 'a'.repeat(tamanho)
```

Linhas novas sem bloco, com o motivo de cada uma:

- `desempenho.repository.ts` e `analista.repository.ts`, o laço que guarda a descrição de cada código (`linha.codigo !== null`, `linha.descricao !== null` e `!descricoes.has(linha.codigo)`): os três só estreitam o tipo e poupam trabalho, e tirar um deles deixa a saída igual (o código `null` não entra no mapa, a descrição `null` cai no `?? codigo` de quem lê, e o código repetido traz a mesma descrição). O que importa, que a linha `null` não ganhe código nem descrição, é a dos blocos de `desempenho.service.ts` e `analista.*`
- `secoes.repository.ts`, o corte por página repetido no SQL e na memória (`eq(secaoDoMaterial.materialId, pagina.materialId)`, `lte(secaoDoMaterial.paginaInicial, pagina.pagina)` e `gte(secaoDoMaterial.paginaFinal, pagina.pagina)` no `or`; `linha.paginaInicial <= pagina` e `pagina <= linha.paginaFinal` no `filter`): o SQL traz as linhas candidatas de todas as páginas de uma vez, e a memória as reparte por página; tirar um dos dois deixa o outro, e a saída é a mesma (o `materialId` da memória tem bloco, porque ali a repetição do número de página entre dois materiais muda a saída). O que o SQL poupa é volume, e quem prova que ele usa o índice é o `EXPLAIN` da §7c, que lê a consulta do repository (`consultaDasHabilidadesDasPaginas`, `.toSQL()`) com as 12 páginas da busca: o bloco que tira o `or(...)` inteiro deixa o caso vermelho
- `secoes.repository.ts`, `eq(habilidadeDaSecao.escolaId, secaoDoMaterial.escolaId)` na junção: a seção já vem presa à escola do contexto pelo `where`, e o `secao_id` é UUID; tirar o termo não muda a saída. É o escopo de tenant escrito no join (regra 10, item 3), e a prova de que a busca da A não alcança a B é o bloco que tira o `where` da seção
- `secoes.repository.ts`, as linhas `if (paginas.length === 0) return porPagina` e, em `trecho-search.ts`, `if (achados.length === 0) return []`: só poupam a consulta quando não há página; sem elas o resultado é o mesmo (lista vazia)
- `turno.command.ts`, `if (item.codigo === null) continue`: a linha seguinte (`habilidades.get(item.codigo)`, que devolve `undefined` para um código que a atividade não tem) já descartaria a linha `null`; o guarda é o estreitamento de tipo, e a memória sem a linha `null` está provada pelo bloco do `turno.command.test.ts` que a ignora
- `material.ts`, o `if (!porCodigo.has(habilidade.codigo))` da união: sem ele o `set` regrava o mesmo código com a mesma descrição, e a união sai igual

## Recomendações sem aplicar

- **Migrar as atividades antigas que guardam `QUI.EM.*`** (D82: a produção as tem): a leitura aceita o código e a tela o mostra como está, então não há quebra, mas o `por_habilidade` delas fica com um código que não existe em `habilidade_bncc`. Quem decide se vale uma migration de dados (e quando) é a 11.0 ou a retro, com a contagem da produção
- **A seção `habilidadesDasPaginas` lê, de uma vez, as seções de todas as páginas da busca** (até 20): com a classificação de um material de centenas de seções, o `EXPLAIN` da §7c já prova o índice; se a busca passar a pedir mais páginas, o `or(...)` do SQL vira o ponto a medir

Da ordem de correção da 1ª rodada (`.processo/ordens/10_task-r1.md`), seção "Sem aplicar":

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| conformidade-reviewer (1ª) | Os seeds do e2e põem código real da BNCC ao lado de descrição inventada (`EM13CNT102` com "Calcular a massa molar de uma substância", em `e2e/support/atividade-db.ts` e `e2e/support/governanca.ts`) | `TODO.md`: é seed de teste, sem dado de pessoa; a 12.0 abre as telas com o seed e confere se o texto aparece na demonstração |
| conformidade-reviewer (1ª) | A anulação muda o que o modelo devolveu e só a métrica `ia.habilidade_anulada` registra; guardar quais questões tiveram a habilidade anulada para a auditoria | Retro da funcionalidade: muda contrato da execução (coluna ou campo novo), fora do que a 10.0 toca; anotado em `TODO.md` |
| conformidade-reviewer (1ª), privacy-guardian (1ª), pedagogia-reviewer (1ª), revisor-geral (1ª) | `DadoNominal.tsx` sem teste de unidade da linha `habilidade: null` | Aplicada: item 5 da ordem (`Analista.test.tsx` › o dado nominal da turma, com os três blocos de mutação) |
| pedagogia-reviewer (1ª) | O plano sem habilidade mostra o título "Habilidades" com a lista vazia (`ConteudoDoArtefato.tsx:136`) | 12.0, que desenha o "Sem habilidade" nas telas (`tasks.md`, 12.1) |
| pedagogia-reviewer (1ª) | A descrição da BNCC acima de 300 caracteres chega à professora e à aluna cortada com "…"; mostrar o texto inteiro na tela do artefato | 12.0, só se a professora estranhar; o corte do modelo é a divergência já registrada na tarefa (teto de entrada) |
| pedagogia-reviewer (1ª) | A aluna vê "Sem habilidade" em "Acertos por habilidade" sem explicação (`Atividade.tsx:322`) | 12.0, que traz a explicação e o desenho |
| pedagogia-reviewer (1ª), privacy-guardian (1ª), infra-guardian (1ª) | Migrar as atividades antigas com `QUI.EM.*` na produção, e conferir a contagem (D82); a rotina muda só o conteúdo do artefato, nunca correção aprovada sem passar pela auditoria de alteração de nota | 11.0 ou a retro, com a contagem da produção: já está em "Recomendações sem aplicar" da tarefa |
| llm-integrator (1ª) | Registrar no relatório a projeção de gerações por professor por mês junto com o delta de tokens | Sem aplicar: a projeção é da 1.0 e o relatório da rodada não é o lugar; o delta de tokens (26.100 → 31.300) está nas Divergências desta tarefa |
| llm-integrator (1ª) | Medir no painel quanto custa em reexecuções a habilidade inventada que repete por `IA_SAIDA_INVALIDA` | 11.0 (a tarefa que mexe no painel e na troca de habilidade) ou a retro; anotado em `TODO.md` |
| infra-guardian (1ª), revisor-geral (1ª), test-engineer (1ª) | `ia.habilidade_anulada` soma dentro da transação do `concluir` (`ferramentas.command.ts:55`) e dobra na reentrega (D49); emitir depois do commit | `TODO.md`: não é barata, porque emitir depois do commit pede um gancho que a Mesa não achou em `apps/api/src/ia` e mexe no contrato da execução; a sobrecontagem na reentrega fica registrada lá |
| infra-guardian (1ª) | Um histograma do passo `preparar` da fila `ferramenta`, que ganhou três leituras | 11.0 ou a retro, se a duração da execução subir |
| revisor-geral (1ª) | A seção em reclassificação fica `aguardando` e mantém as habilidades `origem: 'ia'` antigas; escrever na §5 e na tabela de estados da §7c | Arquiteto, por `DIVERGÊNCIA` no fim da spec: é texto de Tech Spec, que o Implementador não edita |
| revisor-geral (1ª) | Registrar em `tasks.md`, na 12.1, que o rótulo "Sem habilidade" já existe e que a 12.0 acrescenta a explicação e o desenho | Arquiteto: `tasks.md` é do Arquiteto; a divergência já está escrita na tarefa (sexta linha da tabela) |
| test-engineer (1ª) | "Virada do ano" só recua `classificada_em`, sem criar ano letivo novo nem turma nele | `TODO.md`: o cenário pede a turma do ano novo, e o caso de hoje só recua `classificada_em` |
| test-engineer (1ª) | O caso `aguardando`/`sem_habilidade` só representa as duas seções pela falta de linhas em `habilidade_da_secao`; uma execução `pendente` de verdade provaria que a busca não depende do estado | `TODO.md` |
| test-engineer (1ª) | O caso do seed usa uma lista fixa de arquivos; ler por glob | `TODO.md` |

Da ordem de correção da 2ª rodada (`.processo/ordens/10_task-r2.md`), seção "Sem aplicar":

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisor-geral (2ª) | O pouso da classificacao-bncc depende da correção de leitura que ainda não existe; o Orquestrador confere, no pouso, que ela já está na `main` | Orquestrador: já está no `TODO.md` (ordem dos pousos, com ele como dono) |
| revisor-geral (2ª) | `Analista.test.tsx` troca `showModal` e `close` do `dialog` no `beforeEach` e não os restaura | Recusada: o próprio revisor diz que as outras nove telas fazem igual e que é só registro |
| tenancy-guardian (2ª), privacy-guardian (2ª) | `consultaDasHabilidadesDasPaginas` é público e, com `paginas` vazio, o `or()` vira `undefined` e lê todas as seções da escola do contexto; pôr a guarda dentro do método ou deixá-lo privado | `TODO.md`: não vaza entre escolas, e só `habilidadesDasPaginas` o chama, que já devolve vazio antes |
| privacy-guardian (2ª) | Manter `habilidadesDasPaginas` preso à `TrechoSearch.find` (material excluído, licença), com teste ou método privado | `TODO.md`, com a anterior |
| test-engineer (2ª) | A condição do índice não confere `pagina_inicial` (`geracao-pela-secao.int.test.ts:375`) | `TODO.md` |
| test-engineer (2ª), pedagogia-reviewer (2ª) | O nome do caso em `Analista.test.tsx:70` diz "depois da que tem" e nada confere a ordem | `TODO.md` |
| test-engineer (2ª), pedagogia-reviewer (2ª), conformidade-reviewer (2ª) | `e2e/professor-turma-alunos.spec.ts:153`: a varredura de acessibilidade saiu do caso de computador; levá-la para o caso de 1366 × 768 (`:218`) e conferir que o caso de 360 px abre a lista inteira | `TODO.md`, com a 12.0 (a tela de Turmas) |
| infra-guardian (2ª) | A correção de leitura precisa de um deploy de produção só dela, e a ordem dos pousos deve ser trava do pouso, não só item do `TODO.md` | Orquestrador, no `TODO.md` (linha da ordem dos pousos) e no pedido de pouso |
| infra-guardian (2ª) | A reserva de tokens sobe cerca de 20% com o teto: ver no painel se o limitador da escola adia gerações no pico | `TODO.md`, com a 11.0 ou a retro |
| llm-integrator (2ª) | A projeção de gerações por professor por mês com o delta de tokens; o pior pedido tem folga de ~100 tokens | `TODO.md` (a projeção é da 1.0; a folga é o comportamento desejado) |
| pedagogia-reviewer (2ª) | O plano sem habilidade mostra o título vazio; a descrição cortada em 300; "Sem habilidade" sem explicação; seeds com descrição inventada; atividades antigas com `QUI.EM.*` | 12.0 e 11.0 (ou a retro), já registrados no `TODO.md` e em "Recomendações sem aplicar" da tarefa |

Da 3ª rodada (`.processo/ordens/10_task-r3.md`), seção "Sem aplicar":

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisor-geral (3ª) | `10_task.md:85`: a coluna "Onde está na spec" da divergência do Tutor ainda descreve a linha do cenário como "que lista o Tutor pela memória"; atualizar para a redação nova do `cenarios.md:143` | `TODO.md`: o revisor aprovou, e só reprovou nesta rodada quem entra em ordem; é texto de uma célula da tarefa, sem efeito em comportamento nem contrato |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-20 00:08:42 | 2026-11-20 00:09:31 | `tenancy-guardian` | 1 | APROVADO | abbe1f0775c5121cd |
| 2026-11-20 00:08:53 | 2026-11-20 00:09:55 | `conformidade-reviewer` | 1 | APROVADO | a6a7c06dde97842c5 |
| 2026-11-20 00:09:23 | 2026-11-20 00:10:21 | `pedagogia-reviewer` | 1 | APROVADO | a0aa47acd0fdc0ecd |
| 2026-11-20 00:09:53 | 2026-11-20 00:10:37 | `privacy-guardian` | 1 | APROVADO | a67b52fe6f3dd0763 |
| 2026-11-20 00:09:13 | 2026-11-20 00:10:38 | `llm-integrator` | 1 | AJUSTES NECESSÁRIOS | aede84bd48d337010 |
| 2026-11-20 00:09:03 | 2026-11-20 00:11:13 | `infra-guardian` | 1 | REPROVADO | a2df8303bf2deebc1 |
| 2026-11-20 00:09:43 | 2026-11-20 00:11:47 | `revisor-geral` | 1 | REPROVADO | a8fb11d050dc8d228 |
| 2026-11-20 00:09:33 | 2026-11-20 00:13:25 | `test-engineer` | 1 | REPROVADO | afbcfa4e1081f4f46 |
| 2026-11-20 01:51:39 | 2026-11-20 01:52:01 | `tenancy-guardian` | 2 | APROVADO | abd04ed36159bb123 |
| 2026-11-20 01:51:53 | 2026-11-20 01:52:20 | `conformidade-reviewer` | 2 | APROVADO | a07ced6f82171b7d0 |
| 2026-11-20 01:52:28 | 2026-11-20 01:52:53 | `llm-integrator` | 2 | APROVADO | a2a7292c85d0e3bc5 |
| 2026-11-20 01:52:42 | 2026-11-20 01:53:05 | `pedagogia-reviewer` | 2 | APROVADO | adab49f5a334bc593 |
| 2026-11-20 01:52:11 | 2026-11-20 01:53:21 | `infra-guardian` | 2 | APROVADO | ac6bccea8c96233e4 |
| 2026-11-20 01:53:31 | 2026-11-20 01:54:00 | `privacy-guardian` | 2 | APROVADO | acdb661dd2953b1b6 |
| 2026-11-20 01:53:17 | 2026-11-20 01:54:24 | `revisor-geral` | 2 | REPROVADO | ab6f58682b0597a46 |
| 2026-11-20 01:53:01 | 2026-11-20 01:54:31 | `test-engineer` | 2 | APROVADO | a95b4e819fd546d6b |
| 2026-11-20 02:19:24 | 2026-11-20 02:19:42 | `revisor-geral` | 3 | APROVADO | aff48c67d1de7dc79 |
