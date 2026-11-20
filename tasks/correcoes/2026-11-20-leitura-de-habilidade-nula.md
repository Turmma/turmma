# Correção — o código da develop não lê questão com `habilidade: null`, plano com `habilidades: []` nem diagnóstico com `codigo: null`

**Origem:** uso (desenho do Arquiteto na divergência da 10.0 da classificacao-bncc, 20/11/2026): `techspec.md` da classificacao-bncc, §7c, linha "Migration" (andar `educaia--specclassificacao-bncc--l1`, só leitura)
**Subagentes obrigatórios:** `conformidade-reviewer`, `tenancy-guardian`, `frontend-reviewer`, `test-engineer`, `revisor-geral`, `privacy-guardian`, `infra-guardian`
<!-- Quem dita os guardiões é o Orquestrador, no pedido. `revisor-geral` entra se a correção passar de 5 arquivos fora de `tasks/`: passa, e o passo 5 de `corrigir` o torna obrigatório. -->

## Sintoma

A classificacao-bncc (tarefa 10.0) passa a gravar três formatos que o código de hoje recusa: a questão com `habilidade: null` (seção da página citada sem habilidade da BNCC), o plano de aula com `habilidades: []` e o diagnóstico da correção com `codigo: null`. Hoje:

- `questaoObjetivaSchema` exige `habilidade` (objeto), `conteudoDePlanoDeAulaSchema` tem `.min(1)` em `habilidades` e `diagnosticoGravadoSchema` tem `codigo: z.string().min(1)`: o conteúdo com qualquer dos três **não passa na leitura**, e a prova da atividade não abre, não se corrige e não se mostra;
- os leitores (`correcao-de-objetiva.ts`, `lote.ts`, desempenho, Analista, dado nominal, Tutor, o PDF e a conferência do artefato, e as telas) leem `.codigo` e `.descricao` de `habilidade` sem considerar `null`.

Voltar o código da classificacao-bncc para antes da 10.0 deixaria a prova dessas atividades sem abrir, e nenhum SQL de volta torna os três formatos legíveis sem inventar habilidade. Por isso a leitura vai antes: **expandir antes de gravar**.

## Fora desta correção

nada

## Causa

Os três contratos (`habilidade` obrigatória na questão, `.min(1)` no plano e `codigo` obrigatório no diagnóstico) foram escritos quando a habilidade vinha sempre do catálogo curto, e todo leitor deriva deles. Nada na versão de hoje produz `null`, então nada exigia que alguém o lesse.

Os leitores que liam `habilidade.codigo` ou `.descricao` sem considerar `null`, achados pelo `tsc` depois de afrouxar os três schemas e, nos SQL de `jsonb` (que o `tsc` não vê), um a um à mão:

- **`packages/shared`**: `questaoObjetivaSchema`, `conteudoDePlanoDeAulaSchema`, `diagnosticoGravadoSchema`, `questaoDoLoteSchema` e `acertoPorHabilidadeSchema` (o desempenho e o Analista derivam dele);
- **`packages/core`**: `adaptar-atividade`, `gerar-atividade-objetiva`, `gerar-plano-de-aula`, `relatorio-da-correcao`, `resumo-do-analista` e `turno-do-tutor`;
- **API**: `correcao-de-objetiva`, `lote`, `desempenho.repository` e `.service`, `analista.repository`, `.service` e `.command` (o SQL de `jsonb_to_recordset` já devolvia `codigo` nulo), `turno.command`, `conferencia` e `pdf-do-artefato`;
- **web**: `Atividade`, `Aprovar`, `TurmaHoje` e `alunos-da-turma`, `ConteudoDoArtefato`, `Analista` e `DadoNominal`.

## Teste que reproduz

Um caso por leitor, com os três formatos (questão sem habilidade, plano sem habilidade, diagnóstico com `codigo: null`) ao lado do formato de hoje: nos schemas (`assistente.test.ts`, `atividade.test.ts`), nas tarefas de IA (`conteudo.test.ts`, `numeros.test.ts`, `turno-do-tutor.test.ts`), na API (`correcao-de-objetiva`, `lote`, `turno.command`, `conferencia` e `pdf-do-artefato`, e dois de integração: `correcao.int.test.ts`, de ponta a ponta com a questão sem habilidade, e `analista.int.test.ts`, com o SQL real) e na web (as seis telas). Todos rodaram **vermelhos com o código de produção desfeito** (29 casos caindo) e verdes com ele.

## Correção

Só a leitura: os cinco schemas aceitam os três formatos (`habilidade: null`, `habilidades: []`, `codigo: null`), e cada leitor trata `null` como uma linha à parte, nunca somada à de um código. A ordem dela depende do leitor: no lote (`resumoDoLote`) e no diagnóstico da aluna (`corrigirTentativa`, que o `minha-atividade` lê como veio) ela segue a ordem da atividade, e um teste de cada com a questão 1 sem habilidade a prova; no desempenho da turma e no Analista ela vem por último (`nulls last` escrito na consulta do Analista, e o bloco que inverte a ordenação do desempenho deixa o caso vermelho). O rótulo é `ROTULO_SEM_HABILIDADE` (`'Sem habilidade'`, em `packages/shared`). A memória do Tutor (D66) ignora a linha `null`, e o Analista a mostra mas não gera alerta. **Nada grava `null`**: a geração de atividade e a de plano continuam recusando `null` e `[]` (`gerar-atividade-objetiva`, `gerar-plano-de-aula`), com teste.

## Mutações

`--faltando: 1 linha (51 blocos, 2 motivos)`. A que o comando ainda lista é a de baixo, com o motivo no fim da seção: um guarda que só estreita o tipo (mutante equivalente, nenhum teste pode ficar vermelho). Todo bloco foi rodado à parte com o runner do portão e deixou vermelho um caso que rodou e falhou.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/TurmaHoje.tsx
teste: apps/web/src/areas/professor/turmas/TurmaHoje.test.tsx › com lote aprovado
-                    ? `Nenhum aluno acertou menos da metade das ${questoesDaHabilidade(item.habilidade)} nas atividades aprovadas.`
+                    ? ''
```

```mutacao
arquivo: apps/api/src/artefato/pdf-do-artefato.ts
teste: apps/api/src/artefato/pdf-do-artefato.test.ts › a questão sem habilidade sai com o rótulo
-    folha.escrever(`${String(indice + 1)}. ${LETRAS[questao.gabarito] ?? '?'} — ${questao.habilidade?.codigo ?? ROTULO_SEM_HABILIDADE}`, doProfessor.corpo)
+    folha.escrever(`${String(indice + 1)}. ${LETRAS[questao.gabarito] ?? '?'} — ${questao.habilidade?.codigo}`, doProfessor.corpo)
```

```mutacao
arquivo: apps/web/src/areas/professor/turmas/alunos-da-turma.ts
teste: apps/web/src/areas/professor/turmas/alunos-da-turma.test.ts › a questão sem habilidade
-  return itens.map((item) => `${item.habilidade?.codigo ?? ROTULO_SEM_HABILIDADE}: ${String(item.acertos)} de ${String(item.total)}`).join(' · ')
+  return itens.map((item) => `${item.habilidade?.codigo}: ${String(item.acertos)} de ${String(item.total)}`).join(' · ')
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/governanca/Analista.tsx
teste: apps/web/src/areas/coordenacao/governanca/Analista.test.tsx › a questão sem habilidade
-                  {...(medida.habilidade === null ? {} : { detalhe: medida.habilidade.codigo })}
+                  {...(false ? {} : { detalhe: medida.habilidade.codigo })}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/governanca/DadoNominal.tsx
teste: apps/web/src/areas/coordenacao/governanca/Analista.test.tsx › o dado nominal da turma
-                    {...(medida.habilidade === null ? {} : { detalhe: medida.habilidade.codigo })}
+                    {...(false ? {} : { detalhe: medida.habilidade.codigo })}
```

```mutacao
arquivo: packages/core/src/ia/tasks/turno-do-tutor.ts
teste: packages/core/src/ia/tasks/turno-do-tutor.test.ts › a questão sem habilidade não derruba o turno
-  const codigoDaQuestao = entrada.questao?.habilidade?.codigo
+  const codigoDaQuestao = entrada.questao?.habilidade.codigo
```

```mutacao
arquivo: packages/core/src/ia/tasks/relatorio-da-correcao.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › manda retomar o conteúdo da questão
-const retomarDaQuestao = (questao: QuestaoCorrigida): string => (questao.habilidade === null ? 'o conteúdo desta questão' : `“${questao.habilidade.descricao}”`)
+const retomarDaQuestao = (questao: QuestaoCorrigida): string => (false ? 'o conteúdo desta questão' : `“${questao.habilidade.descricao}”`)
```

```mutacao
arquivo: packages/core/src/ia/tasks/relatorio-da-correcao.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › manda retomar o conteúdo da questão
-const revisaoDaQuestao = (questao: QuestaoCorrigida): string => (questao.habilidade === null ? 'do conteúdo desta questão' : `de “${questao.habilidade.descricao}”`)
+const revisaoDaQuestao = (questao: QuestaoCorrigida): string => (false ? 'do conteúdo desta questão' : `de “${questao.habilidade.descricao}”`)
```

```mutacao
arquivo: packages/core/src/ia/tasks/relatorio-da-correcao.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › manda retomar o conteúdo da questão
-  else if (acertos * 2 < total) partes.push(`Menos da metade acertou: vale retomar ${retomarDaQuestao(questao)}.`)
+  else if (acertos * 2 < total) partes.push(`Menos da metade acertou: vale retomar “${questao.habilidade?.descricao ?? ''}”.`)
```

```mutacao
arquivo: packages/core/src/ia/tasks/relatorio-da-correcao.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › manda retomar o conteúdo da questão
-  else partes.push(`A maioria acertou; os erros pedem uma revisão rápida ${revisaoDaQuestao(questao)}.`)
+  else partes.push(`A maioria acertou; os erros pedem uma revisão rápida de “${questao.habilidade?.descricao ?? ''}”.`)
```

```mutacao
arquivo: apps/web/src/areas/professor/turmas/TurmaHoje.tsx
teste: apps/web/src/areas/professor/turmas/TurmaHoje.test.tsx › é uma barra com o rótulo
-const questoesDaHabilidade = (habilidade: object | null): string => (habilidade === null ? 'questões sem habilidade' : 'questões desta habilidade')
+const questoesDaHabilidade = (habilidade: object | null): string => (false ? 'questões sem habilidade' : 'questões desta habilidade')
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/turno.command.test.ts › a linha `codigo: null` do diagnóstico
-  if (lido.success) for (const { habilidade } of lido.data.questoes) if (habilidade !== null) habilidades.set(habilidade.codigo, habilidade)
+  if (lido.success) for (const { habilidade } of lido.data.questoes) habilidades.set(habilidade.codigo, habilidade)
```

```mutacao
arquivo: packages/core/src/ia/tasks/resumo-do-analista.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › a medida da questão sem habilidade
           medida.habilidade === null
-            ? []
+            ? [{ tipo: 'habilidade_com_acerto_baixo' as const, serie: recorte.serie, disciplina: recorte.disciplina, habilidade: null as never, valor: acertoPercentual(medida.acertos, medida.total), referencia: limiar, hipoteses: hipotesesDoRecorte(recorte) }]
```

```mutacao
arquivo: apps/api/src/artefato/conferencia.ts
teste: apps/api/src/artefato/conferencia.test.ts › o código e a descrição da habilidade
-const mesmaHabilidade = (a: Habilidade | null, b: Habilidade | null): boolean => a?.codigo === b?.codigo && a?.descricao === b?.descricao
+const mesmaHabilidade = (a: Habilidade | null, b: Habilidade | null): boolean => a?.descricao === b?.descricao
```

```mutacao
arquivo: apps/api/src/artefato/conferencia.ts
teste: apps/api/src/artefato/conferencia.test.ts › o código e a descrição da habilidade
-const mesmaHabilidade = (a: Habilidade | null, b: Habilidade | null): boolean => a?.codigo === b?.codigo && a?.descricao === b?.descricao
+const mesmaHabilidade = (a: Habilidade | null, b: Habilidade | null): boolean => a?.codigo === b?.codigo
```

```mutacao
arquivo: apps/api/src/artefato/conferencia.ts
teste: apps/api/src/artefato/conferencia.test.ts › o código e a descrição da habilidade
-        mesmaHabilidade(questao.habilidade, origem.habilidade) &&
+        questao.habilidade === origem.habilidade &&
```

```mutacao
arquivo: apps/api/src/artefato/pdf-do-artefato.ts
teste: apps/api/src/artefato/pdf-do-artefato.test.ts › a questão sem habilidade sai com o rótulo
-  if (conteudo.habilidades.length === 0) folha.escrever(`• ${ROTULO_SEM_HABILIDADE}`, { ...estilos.item, depois: 14 })
+  if (false) folha.escrever(`• ${ROTULO_SEM_HABILIDADE}`, { ...estilos.item, depois: 14 })
```

```mutacao
arquivo: apps/api/src/atividade/correcao/correcao-de-objetiva.ts
teste: apps/api/src/atividade/correcao/correcao-de-objetiva.test.ts › conta numa linha à parte
-    const codigo = questao.habilidade?.codigo ?? null
+    const codigo = questao.habilidade?.codigo ?? ''
```

```mutacao
arquivo: apps/api/src/atividade/correcao/correcao-de-objetiva.ts
teste: apps/api/src/atividade/correcao/correcao-de-objetiva.test.ts › conta numa linha à parte
-    const habilidade = porHabilidade.get(codigo) ?? { codigo, acertos: 0, total: 0 }
+    const habilidade = { codigo, acertos: 0, total: 0 }
```

```mutacao
arquivo: apps/api/src/atividade/correcao/lote.ts
teste: apps/api/src/atividade/correcao/lote.test.ts › a linha sem habilidade soma
-  for (const { habilidade } of questoes) if (!habilidades.has(habilidade?.codigo ?? null)) habilidades.set(habilidade?.codigo ?? null, habilidade)
+  for (const { habilidade } of questoes) if (habilidade !== null && !habilidades.has(habilidade.codigo)) habilidades.set(habilidade?.codigo ?? null, habilidade)
```

```mutacao
arquivo: apps/api/src/atividade/correcao/lote.ts
teste: apps/api/src/atividade/correcao/lote.test.ts › a linha sem habilidade soma
-      const soma = porHabilidade.get(habilidade?.codigo ?? null)
+      const soma = porHabilidade.get(habilidade?.codigo ?? '')
```

```mutacao
arquivo: apps/api/src/atividade/desempenho/desempenho.service.ts
teste: apps/api/src/atividade/correcao/correcao.int.test.ts › entra no diagnóstico com
-      const habilidade = (codigo: string | null) => (codigo === null ? null : { codigo, descricao: descricoes.get(codigo) ?? codigo })
+      const habilidade = (codigo: string | null) => ({ codigo, descricao: descricoes.get(codigo as string) ?? (codigo as string) })
```

```mutacao
arquivo: apps/api/src/atividade/desempenho/desempenho.service.ts
teste: apps/api/src/atividade/correcao/correcao.int.test.ts › entra no diagnóstico com
-        const doAluno = porAluno.get(linha.alunoId) ?? new Map<string | null, Soma>()
+        const doAluno = new Map<string | null, Soma>()
```

```mutacao
arquivo: apps/api/src/atividade/desempenho/desempenho.service.ts
teste: apps/api/src/atividade/correcao/correcao.int.test.ts › entra no diagnóstico com
-      const codigos = [...porHabilidade.keys()].sort((a, b) => (a === b ? 0 : a === null ? 1 : b === null ? -1 : a < b ? -1 : 1)).slice(0, MAXIMO_DE_HABILIDADES_NO_DESEMPENHO)
+      const codigos = [...porHabilidade.keys()].sort((a, b) => (a === b ? 0 : a === null ? -1 : b === null ? 1 : a < b ? -1 : 1)).slice(0, MAXIMO_DE_HABILIDADES_NO_DESEMPENHO)
```

```mutacao
arquivo: apps/api/src/atividade/desempenho/desempenho.service.ts
teste: apps/api/src/atividade/correcao/correcao.int.test.ts › entra no diagnóstico com
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
teste: apps/api/src/governanca/analista.int.test.ts › o dado nominal da turma também leva a linha
-          .map((linha) => ({ habilidade: linha.codigo === null ? null : { codigo: linha.codigo, descricao: descricoes.get(linha.codigo) ?? linha.codigo }, acertos: linha.acertos, total: linha.total })),
+          .map((linha) => ({ habilidade: { codigo: linha.codigo as string, descricao: descricoes.get(linha.codigo as string) ?? (linha.codigo as string) }, acertos: linha.acertos, total: linha.total })),
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/turno.command.test.ts › o Tutor recebe a questão com
-  return { numero, enunciado: questao.enunciado, alternativas: [...questao.alternativas], habilidade: questao.habilidade === null ? null : { codigo: questao.habilidade.codigo, descricao: questao.habilidade.descricao } }
+  return { numero, enunciado: questao.enunciado, alternativas: [...questao.alternativas], habilidade: { codigo: questao.habilidade?.codigo as string, descricao: questao.habilidade?.descricao as string } }
```

```mutacao
arquivo: packages/core/src/ia/tasks/adaptar-atividade.ts
teste: packages/core/src/ia/tasks/conteudo.test.ts › a conferência recusa gabarito trocado
-      if (adaptada.habilidade?.codigo !== original.habilidade?.codigo) problemas.push(`${onde}: a habilidade é a da questão original, copiada como veio.`)
+      if (adaptada.habilidade?.codigo === original.habilidade?.codigo) problemas.push(`${onde}: a habilidade é a da questão original, copiada como veio.`)
```

```mutacao
arquivo: packages/core/src/ia/tasks/gerar-atividade-objetiva.ts
teste: packages/core/src/ia/tasks/conteudo.test.ts › habilidade fora da entrada
-    if (questao.habilidade === null || !codigos.has(questao.habilidade.codigo)) problemas.push(`${onde}: a habilidade precisa ser uma das recebidas, copiada como veio.`)
+    if (!codigos.has(questao.habilidade.codigo)) problemas.push(`${onde}: a habilidade precisa ser uma das recebidas, copiada como veio.`)
```

```mutacao
arquivo: packages/core/src/ia/tasks/gerar-atividade-objetiva.ts
teste: packages/core/src/ia/tasks/conteudo.test.ts › habilidade fora da entrada
-    if (questao.habilidade === null || !codigos.has(questao.habilidade.codigo)) problemas.push(`${onde}: a habilidade precisa ser uma das recebidas, copiada como veio.`)
+    if (questao.habilidade === null) problemas.push(`${onde}: a habilidade precisa ser uma das recebidas, copiada como veio.`)
```

```mutacao
arquivo: packages/core/src/ia/tasks/gerar-plano-de-aula.ts
teste: packages/core/src/ia/tasks/conteudo.test.ts › a conferência recusa etapa sem citação
-    if (saida.habilidades.length === 0 || saida.habilidades.some((habilidade) => !codigos.has(habilidade.codigo))) problemas.push('As habilidades do plano precisam ser das recebidas, copiadas como vieram.')
+    if (saida.habilidades.some((habilidade) => !codigos.has(habilidade.codigo))) problemas.push('As habilidades do plano precisam ser das recebidas, copiadas como vieram.')
```

```mutacao
arquivo: packages/core/src/ia/tasks/gerar-plano-de-aula.ts
teste: packages/core/src/ia/tasks/conteudo.test.ts › a conferência recusa etapa sem citação
-    if (saida.habilidades.length === 0 || saida.habilidades.some((habilidade) => !codigos.has(habilidade.codigo))) problemas.push('As habilidades do plano precisam ser das recebidas, copiadas como vieram.')
+    if (saida.habilidades.length === 0) problemas.push('As habilidades do plano precisam ser das recebidas, copiadas como vieram.')
```

```mutacao
arquivo: packages/core/src/ia/tasks/resumo-do-analista.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › a medida da questão sem habilidade
-    const medida = codigoDoAlerta === undefined ? undefined : recorte?.porHabilidade.find((item) => item.habilidade?.codigo === codigoDoAlerta)
+    const medida = recorte?.porHabilidade.find((item) => item.habilidade?.codigo === codigoDoAlerta)
```

```mutacao
arquivo: packages/core/src/ia/tasks/turno-do-tutor.ts
teste: packages/core/src/ia/tasks/turno-do-tutor.test.ts › a questão sem habilidade não derruba o turno
-  return [questao.enunciado, ...questao.alternativas, questao.habilidade?.descricao ?? '']
+  return [questao.enunciado, ...questao.alternativas, questao.habilidade!.descricao]
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividade.tsx
teste: apps/web/src/areas/aluno/Atividade.test.tsx › entra no resultado da aluna como
-                <ProgressBar key={item.habilidade?.codigo ?? 'sem-habilidade'} rotulo={item.habilidade?.descricao ?? ROTULO_SEM_HABILIDADE} valor={item.acertos} maximo={item.total} texto={textoDoAcerto(item.acertos, item.total)} />
+                <ProgressBar key={item.habilidade!.codigo} rotulo={item.habilidade?.descricao ?? ROTULO_SEM_HABILIDADE} valor={item.acertos} maximo={item.total} texto={textoDoAcerto(item.acertos, item.total)} />
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/governanca/Analista.tsx
teste: apps/web/src/areas/coordenacao/governanca/Analista.test.tsx › a questão sem habilidade
-                  rotulo={medida.habilidade?.descricao ?? ROTULO_SEM_HABILIDADE}
+                  rotulo={medida.habilidade?.descricao ?? ""}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/governanca/DadoNominal.tsx
teste: apps/web/src/areas/coordenacao/governanca/Analista.test.tsx › o dado nominal da turma
-                    rotulo={medida.habilidade?.descricao ?? ROTULO_SEM_HABILIDADE}
+                    rotulo={medida.habilidade?.descricao ?? ""}
```

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/ConteudoDoArtefato.tsx
teste: apps/web/src/areas/professor/artefatos/Artefato.test.tsx › a questão sem habilidade
-                    {questao.habilidade === null ? (
+                    {false ? (
```

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/ConteudoDoArtefato.tsx
teste: apps/web/src/areas/professor/artefatos/Artefato.test.tsx › o plano sem habilidade
-              {conteudo.habilidades.length === 0 && <li className="break-words">{ROTULO_SEM_HABILIDADE}</li>}
+              {false && <li className="break-words">{ROTULO_SEM_HABILIDADE}</li>}
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Aprovar.tsx
teste: apps/web/src/areas/professor/atividades/Aprovar.test.tsx › aparece no Resumo como
-                  <ProgressBar key={item.habilidade?.codigo ?? 'sem-habilidade'} rotulo={item.habilidade === null ? ROTULO_SEM_HABILIDADE : `${item.habilidade.codigo} · ${item.habilidade.descricao}`} valor={item.acertos} maximo={item.total} texto={`${String(item.acertos)} de ${String(item.total)}`} />
+                  <ProgressBar key={item.habilidade?.codigo ?? 'sem-habilidade'} rotulo={`${item.habilidade.codigo} · ${item.habilidade.descricao}`} valor={item.acertos} maximo={item.total} texto={`${String(item.acertos)} de ${String(item.total)}`} />
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Aprovar.tsx
teste: apps/web/src/areas/professor/atividades/Aprovar.test.tsx › aparece no Resumo como
-                  { chave: 'habilidade', titulo: 'Habilidade', celula: (questao) => questao.habilidade?.codigo ?? ROTULO_SEM_HABILIDADE },
+                  { chave: 'habilidade', titulo: 'Habilidade', celula: (questao) => questao.habilidade!.codigo },
```

```mutacao
arquivo: apps/web/src/areas/professor/turmas/TurmaHoje.tsx
teste: apps/web/src/areas/professor/turmas/TurmaHoje.test.tsx › é uma barra com o rótulo
-                rotulo={item.habilidade === null ? ROTULO_SEM_HABILIDADE : `${item.habilidade.codigo} · ${item.habilidade.descricao}`}
+                rotulo={`${item.habilidade.codigo} · ${item.habilidade.descricao}`}
```

```mutacao
arquivo: packages/core/src/ia/tasks/resumo-do-analista.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › a medida da questão sem habilidade
-          medida.habilidade === null
+          false
```

```mutacao
arquivo: packages/core/src/ia/tasks/turno-do-tutor.ts
teste: packages/core/src/ia/tasks/turno-do-tutor.test.ts › sem questão em andamento
-  if (questao === undefined) return ['']
+  
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividade.tsx
teste: apps/web/src/areas/aluno/Atividade.test.tsx › entra no resultado da aluna como
-                <ProgressBar key={item.habilidade?.codigo ?? 'sem-habilidade'} rotulo={item.habilidade?.descricao ?? ROTULO_SEM_HABILIDADE} valor={item.acertos} maximo={item.total} texto={textoDoAcerto(item.acertos, item.total)} />
+                <ProgressBar key={item.habilidade?.codigo ?? 'sem-habilidade'} rotulo={item.habilidade!.descricao} valor={item.acertos} maximo={item.total} texto={textoDoAcerto(item.acertos, item.total)} />
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/governanca/Analista.tsx
teste: apps/web/src/areas/coordenacao/governanca/Analista.test.tsx › a questão sem habilidade
-                  key={medida.habilidade?.codigo ?? 'sem-habilidade'}
+                  key={medida.habilidade!.codigo}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/governanca/DadoNominal.tsx
teste: apps/web/src/areas/coordenacao/governanca/Analista.test.tsx › o dado nominal da turma
-                    key={medida.habilidade?.codigo ?? 'sem-habilidade'}
+                    key={medida.habilidade!.codigo}
```

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/ConteudoDoArtefato.tsx
teste: apps/web/src/areas/professor/artefatos/Artefato.test.tsx › o plano sem habilidade
-              {conteudo.habilidades.length === 0 && <li className="break-words">{ROTULO_SEM_HABILIDADE}</li>}
+              {conteudo.habilidades.length === 0 && null}
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Aprovar.tsx
teste: apps/web/src/areas/professor/atividades/Aprovar.test.tsx › aparece no Resumo como
-                  <ProgressBar key={item.habilidade?.codigo ?? 'sem-habilidade'} rotulo={item.habilidade === null ? ROTULO_SEM_HABILIDADE : `${item.habilidade.codigo} · ${item.habilidade.descricao}`} valor={item.acertos} maximo={item.total} texto={`${String(item.acertos)} de ${String(item.total)}`} />
+                  <ProgressBar key={item.habilidade!.codigo} rotulo={item.habilidade === null ? ROTULO_SEM_HABILIDADE : `${item.habilidade.codigo} · ${item.habilidade.descricao}`} valor={item.acertos} maximo={item.total} texto={`${String(item.acertos)} de ${String(item.total)}`} />
```

```mutacao
arquivo: apps/web/src/areas/professor/turmas/TurmaHoje.tsx
teste: apps/web/src/areas/professor/turmas/TurmaHoje.test.tsx › é uma barra com o rótulo
-                key={item.habilidade?.codigo ?? 'sem-habilidade'}
+                key={item.habilidade!.codigo}
```

Motivos das linhas que nenhum bloco alcança (mutante equivalente: a saída é a mesma sem a cláusula):

- `desempenho.repository.ts` e `analista.repository.ts`, o laço que guarda a descrição de cada código (`linha.codigo !== null`, `linha.descricao !== null` e `!descricoes.has(linha.codigo)`): os três só estreitam o tipo e poupam trabalho, e tirar um deles deixa a saída igual (o código `null` não entra no mapa, a descrição `null` cai no `?? codigo` de quem lê, e o código repetido traz a mesma descrição). O que importa, que a linha `null` não ganhe código nem descrição, é a dos blocos de `desempenho.service.ts` e `analista.*`
- `turno.command.ts`, `if (item.codigo === null) continue`: a linha seguinte (`habilidades.get(item.codigo)`, que devolve `undefined` para um código que a atividade não tem) já descartaria a linha `null`; o guarda é o estreitamento de tipo, e a memória sem a linha `null` está provada pelo bloco do `turno.command.test.ts` que a ignora

## Recomendações sem aplicar

Da 1ª rodada da Mesa (ordem `.processo/ordens/2026-11-20-leitura-de-habilidade-nula-r1.md`):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| frontend-reviewer (1ª), conformidade-reviewer (1ª), privacy-guardian (1ª), revisor-geral (1ª) | As fotos de `/aluno` mostram "Página não encontrada": o Início do aluno é `/aluno/inicio` | Erro da Mesa ao fotografar, não do código. A Mesa fotografa `/aluno/inicio` na rodada nova |
| frontend-reviewer (1ª) | O rodapé fixo cobre o parágrafo "Dado nominal" na foto do celular, e trunca "FERRAME..." a 360 px | Não é desta correção: `Analista.tsx` e o rodapé já eram assim, e o texto do rodapé não é arquivo da correção. `TODO.md` |
| frontend-reviewer (1ª) | `/aluno` não tem rota e cai em 404 em vez de levar ao Início | Fora do escopo (leitura de habilidade nula). `TODO.md` |
| conformidade-reviewer (1ª), revisor-geral (1ª) | Incluir na vitrine uma questão e um plano sem habilidade quando a classificacao-bncc (10.0) pousar | Depende da 10.0, que é quem passa a gravar `null`. `TODO.md`, ligado à classificacao-bncc |
| privacy-guardian (1ª) | `docs/lgpd.md:49`: acrescentar "sem habilidade" (`codigo: null`) ao diagnóstico | O arquivo não é da correção e o dado não muda de classe. Vai na classificacao-bncc (10.0), que é quem grava `null` |
| privacy-guardian (1ª) | Teste do grupo mínimo na linha "Sem habilidade" por turma, quando houver dado real com `null` | Hoje nada grava `null`; sem dado real o teste não prova nada. Classificacao-bncc, 10.0 ou 12.0 |
| infra-guardian (1ª), revisor-geral (1ª) | O JSON Schema enviado ao modelo passa a aceitar `habilidade: null` e `habilidades: []` nas três tarefas de geração; usar um schema de saída que continue exigindo a habilidade, ou acompanhar a taxa de reparo | Muda o contrato da porta de IA (`openai-compat-adapter.ts`, fora dos arquivos da correção). Destino: classificacao-bncc (10.0), que passa a produzir `null` de propósito, e `TODO.md` para o `llm-integrator` |
| revisor-geral (1ª), test-engineer (1ª) | A linha `null` cai no corte por `MAXIMO_DE_HABILIDADES_*` quando o recorte tem mais habilidades que o limite, e nenhum teste fixa isso | Aceito pelo revisor-geral, que pede só que a 12.0 saiba. Destino: 12.0 da classificacao-bncc, com o teste |
| test-engineer (1ª) | O prompt do Analista não diz que a linha `habilidade: null` não vira alerta | Muda o comportamento do modelo; a conferência já recusa o alerta. `TODO.md`, para o `llm-integrator` |
| test-engineer (1ª) | `analista.int.test.ts` com `-t "habilidade"` falha na linha 208 porque depende do estado de casos anteriores | Já era assim antes desta correção e o arquivo inteiro passa. `TODO.md` |

Da 2ª rodada (ordem `.processo/ordens/2026-11-20-leitura-de-habilidade-nula-r2.md`):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| frontend-reviewer (2ª) | `TurmaHoje.tsx:49`: o nome `questoesDaHabilidade` contradiz o caso nulo ("questões sem habilidade") | Nome de função local, sem efeito em comportamento. `TODO.md` |
| revisor-geral (2ª) | `TurmaHoje.tsx:49`: o parâmetro `habilidade: object \| null` aceita qualquer objeto; usar o tipo da habilidade de `packages/shared` | Tipo de função local. `TODO.md` |
| frontend-reviewer (2ª) | Comentário em `analista.repository.ts:212` e `:299` dizendo por que o Analista põe a linha nula por último e o lote a põe na ordem da atividade | Comentário; a diferença já está escrita na seção "Correção" e provada pelos testes de ordem. Recusada |
| revisor-geral (2ª) | `TurmaHoje.test.tsx`: o caso "Nenhum aluno acertou menos da metade das questões sem habilidade" sem asserção | Coberto por bloco de mutação ligado ao teste "com lote aprovado" (test-engineer, 2ª, ponto 7). Recusada |
| revisor-geral (2ª) | `relatorio-da-correcao.ts:56-59`: `retomarDaQuestao` e `revisaoDaQuestao` repetem o ternário | Duplicação pequena e local, com blocos de mutação próprios. `TODO.md` |
| revisor-geral (2ª), test-engineer (2ª) | O cabeçalho da seção "Mutações" diz "1 motivo", e a lista tem dois | Texto do documento; o Implementador acerta com a saída do comando antes do commit. Só texto, não caduca revisor |
| test-engineer (2ª) | A frase da seção "Correção" poderia dizer que o `nulls last` só deixa a intenção escrita (mutante equivalente) | Texto do documento; junto do item acima, a critério do Implementador. Recusada como exigência |
| test-engineer (2ª) | `TurmaHoje.test.tsx`: `getByText('Sem habilidade').closest('div')` pode pegar só o envoltório do rótulo | Teste da asserção nova; o revisor aprovou com o bloco ligado a ela. `TODO.md` |
| infra-guardian (2ª) | JSON Schema enviado ao modelo ainda não aceita `habilidade: null` nas três tarefas de geração (item já da rodada 1) | Classificacao-bncc (10.0) e `TODO.md`, para a validação conferir que não se perde |
| infra-guardian (2ª) | Teste no `analista.int.test.ts` para recorte com mais de 60 habilidades e uma linha sem habilidade: é ela que sai no corte | 12.0 da classificacao-bncc, com o teste (já registrado na rodada 1) |
| conformidade-reviewer (2ª), frontend-reviewer (2ª) | No celular, a barra inferior fixa cobre o texto "Dado nominal" na foto, e "FERRAMENTAS" aparece como "FERRAME…" | Já registrado na rodada 1: componente fora da correção. `TODO.md` |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-20 02:21:49 | 2026-11-20 02:22:23 | `tenancy-guardian` | 1 | APROVADO | adb4ee2d432756d46 |
| 2026-11-20 02:21:58 | 2026-11-20 02:22:40 | `frontend-reviewer` | 1 | APROVADO | a566ac947d3c5ae16 |
| 2026-11-20 02:21:40 | 2026-11-20 02:23:05 | `conformidade-reviewer` | 1 | APROVADO | a06dfafac6756719e |
| 2026-11-20 02:22:26 | 2026-11-20 02:23:20 | `privacy-guardian` | 1 | APROVADO | a6494bcdad2d246e4 |
| 2026-11-20 02:22:35 | 2026-11-20 02:23:25 | `infra-guardian` | 1 | APROVADO | abb9ff0cba9c22f0e |
| 2026-11-20 02:22:17 | 2026-11-20 02:24:00 | `revisor-geral` | 1 | APROVADO | a892a3533049ca0b4 |
| 2026-11-20 02:22:07 | 2026-11-20 02:25:43 | `test-engineer` | 1 | REPROVADO | a9b624f9ae9cac960 |
| 2026-11-20 02:44:08 | 2026-11-20 02:44:22 | `tenancy-guardian` | 2 | APROVADO | a7f595945a242825c |
| 2026-11-20 02:43:55 | 2026-11-20 02:44:29 | `conformidade-reviewer` | 2 | APROVADO | a6afdf4b91fdd7ab2 |
| 2026-11-20 02:44:22 | 2026-11-20 02:44:56 | `frontend-reviewer` | 2 | APROVADO | ab69f22e55015efb9 |
| 2026-11-20 02:44:52 | 2026-11-20 02:45:15 | `revisor-geral` | 2 | APROVADO | a83538ea3fea8ace9 |
| 2026-11-20 02:45:05 | 2026-11-20 02:45:28 | `privacy-guardian` | 2 | APROVADO | a47aa339c78f2598b |
| 2026-11-20 02:45:19 | 2026-11-20 02:45:39 | `infra-guardian` | 2 | APROVADO | a264bef6042243452 |
| 2026-11-20 02:44:39 | 2026-11-20 02:45:55 | `test-engineer` | 2 | APROVADO | a77efa376eb8995df |
