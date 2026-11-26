# Tarefa 4.0 — Embaralhamento por aluno, mantido na retomada, corrigido pela ordem original

**Funcionalidade:** avaliacao-e-correcao · **Depende de:** 3.0
**Subagentes obrigatórios:** `tenancy-guardian`, `conformidade-reviewer`, `privacy-guardian`, `infra-guardian`
**Porte:** pequeno

## Objetivo

Com "embaralhar" ligado, cada aluno recebe questões e alternativas numa ordem própria, a mesma na retomada, e a correção,
o relatório e o diagnóstico continuam pela ordem original.

## Contexto necessário

- `techspec.md` §1, §5.3 (o sorteador injetável), §4 (`prova` na ordem dele)
- `prd.md` RF8
- `cenarios.md` §1 RF8, §3 (a)
- `apps/api/src/atividade/minha-atividade/minha-atividade.service.ts` (o `comecar` da 3.0)
- `apps/api/src/atividade/correcao/correcao-de-objetiva.ts`: a correção pelo número da questão e da alternativa

## Subtarefas

- [x] 4.1 — Sorteador injetável (`crypto.randomInt` em produção); `ordem` gravada no `comecar`, só na primeira; nula sem
  embaralhar; só alternativas mantém as questões na ordem original
- [x] 4.2 — `prova` devolve na ordem do aluno, com o número original de questão e alternativa
- [x] 4.3 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/src/atividade/minha-atividade/minha-atividade.service.ts` | alterado |
| `apps/api/src/atividade/minha-atividade/ordem-da-prova.ts` | novo |
| `apps/api/src/atividade/minha-atividade/ordem-da-prova.test.ts` | novo |
| `apps/api/src/atividade/embaralhamento.int.test.ts` | novo |
| `apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts` | alterado (a `ordem` na tentativa, `embaralhar(id)`) |
| `apps/api/src/atividade/atividade.module.ts`, `apps/api/src/app.module.ts` | alterados (o sorteador injetável, só no teste) |
| `packages/shared/src/atividade/prova.ts` | alterado (`ordemDasAlternativas` na questão da prova) |
| `packages/shared/src/atividade/atividade.test.ts`, `apps/api/src/atividade/atividade.int.test.ts`, `apps/web/src/areas/aluno/atividade.test.ts`, `apps/web/src/areas/aluno/Atividade.test.tsx`, `e2e/support/aluno.ts`, `e2e/aluno-atividade.spec.ts` | alterados (a questão da prova ganha o campo; só fixture e chave esperada) |
| `docs/mvp-contratos.md` | alterado (a prova na ordem do aluno) |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| Sorteio fixo, dois alunos | integração | ordens diferentes e conhecidas; a certa, em posição de tela diferente nos dois, acerta nos dois | sequência injetada | `apps/api/src/atividade/embaralhamento.int.test.ts` › sorteio fixo, dois alunos |
| Desempenho por habilidade com a ordem embaralhada | integração | igual ao da ordem original | as duas habilidades do fixture | `apps/api/src/atividade/embaralhamento.int.test.ts` › o desempenho por habilidade e o diagnóstico |
| Só alternativas | integração | questões na ordem original | as alternativas mudam | `apps/api/src/atividade/embaralhamento.int.test.ts` › só alternativas: as questões ficam |
| Só questões | integração | alternativas na ordem original | as questões mudam | `apps/api/src/atividade/embaralhamento.int.test.ts` › só questões: as alternativas ficam |
| Sem embaralhar | integração | `ordem` nula, ordem original | sorteador injetado que embaralharia | `apps/api/src/atividade/embaralhamento.int.test.ts` › sem embaralhar: a `ordem` é nula |
| Retomada | integração | a segunda leitura traz a mesma ordem | sorteador que daria outra | `apps/api/src/atividade/embaralhamento.int.test.ts` › retomada: a segunda leitura |
| Começar × começar com embaralhar | integração | uma `ordem` | a primeira segurada com `WriteBlockTrigger` na tentativa; o sorteador da segunda daria outra ordem | `apps/api/src/atividade/embaralhamento.int.test.ts` › com a primeira segurada: a segunda sorteia outra ordem |
| O alcance vem antes do sorteio; a ordem de um aluno não é a do outro | integração | aluno de outra turma: `NAO_ENCONTRADO`, sem tentativa e sem sorteio | roteiro à espera, que ninguém consome | `apps/api/src/atividade/embaralhamento.int.test.ts` › o alcance vem antes do sorteio |
| O sorteio vem depois da janela e do estado (§5.3) | integração | fora da janela (cedo e tarde) e com a atividade encerrada: `PROVA_FORA_DA_JANELA` e `ATIVIDADE_ENCERRADA`, sem tentativa e sem sorteio | roteiro à espera, que ninguém consome | `apps/api/src/atividade/embaralhamento.int.test.ts` › o sorteio vem depois da janela e do estado |
| Isolamento do repository (`embaralhar`) | integração | outra escola, outro ano e outra turma não leem; cada aplicação diz o que ela liga | duas aplicações da mesma turma com opções diferentes | `apps/api/src/atividade/embaralhamento.int.test.ts` › isolamento: o repository só lê |
| O sorteio e a leitura da ordem | unidade | roteiro, rotação, só um lado, as 24 ordens, ordem corrompida recusada, produção em 0 a n − 1 | sorteador de roteiro que anota as chamadas | `apps/api/src/atividade/minha-atividade/ordem-da-prova.test.ts` › (o arquivo inteiro) |
| O contrato da questão | unidade | `ordemDasAlternativas` é permutação dos quatro índices, e a prova sem embaralhar traz a identidade | repetido, de menos, de mais, fora de 0 a 3, ausente | `packages/shared/src/atividade/atividade.test.ts` › a ordem das alternativas é uma permutação |

## Como testar

- Correção e diagnóstico: `apps/api/test/atividade.fixture.ts` (`GABARITO_DE_TESTE`, `HABILIDADE_DAS_TRES_PRIMEIRAS`,
  `aprovarOLote`); a leitura do desempenho de `apps/api/src/atividade/desempenho/`
- `npx vitest run --project integracao apps/api/src/atividade/embaralhamento.int.test.ts`
- Armadilha: o teste não depende do acaso; o sorteador é injetado com sequência fixa

## Autoconferência

As perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas antes de codar:

1. **Mutação de cada cláusula:** a seção "Mutações", com o `--faltando` no começo dela. Os termos equivalentes têm o motivo escrito.
2. **Texto na tela:** a tarefa não põe texto novo na web. O campo novo da questão (`ordemDasAlternativas`) entra só nas fixtures de `atividade.test.ts`, `Atividade.test.tsx`, `e2e/support/aluno.ts` e `e2e/aluno-atividade.spec.ts`, para o esquema aceitá-las.
3. **O que distingue:** a Bia usa uma ordem de alternativas **diferente por questão** (e questões em outra ordem), para que ler a ordem pela posição da tela, e não pelo número da questão, fique vermelho; a Ana gira tudo uma casa. As duas leem a certa da questão 1 em posições de tela diferentes (3 e 2). O sorteador de roteiro anota o que foi consumido: o `comecar` que não devia sortear deixa o roteiro inteiro.
4. **Checagem anterior que responde antes:** o aluno de outra turma cai em `NAO_ENCONTRADO` de `prova()`, antes do sorteio; o caso confere que o roteiro ficou intacto e que não nasceu tentativa. A leitura de `embaralhar(id)` só roda depois de `prova()` achar a aplicação, e tem o seu próprio caso de isolamento (a chamada direta ao repository com escola, ano e turma trocados).
5. **Asserção sobre o resultado:** a ordem é lida do banco (`select ordem`) e da resposta da API; a correção é lida pelo diagnóstico do aluno e pelo desempenho da turma, e o que fica gravado é o índice original (`resposta_atividade.alternativa` igual ao gabarito).
6. **Guarda nova:** nenhuma.
7. **Comentário que afirma o que o código não faz:** conferido nos docblocks de `ordem-da-prova.ts`, do `comecar`, de `embaralhar` e de `questaoDaProvaSchema`. O de `embaralhar` cita o 1 kB do `pg_stat_activity` (`show track_activity_query_size` no compose de teste: 1kB) e o teste da trava que o motivou.
8. **Divergência:** uma, abaixo (o campo do contrato). A palavra do código está na `techspec.md` §4 e §5.3, no `cenarios.md` (RF8) e em `docs/mvp-contratos.md`.
9. **Peça que já existe:** `Embaralhar` (esquema do aplicar), `ALTERNATIVAS_POR_QUESTAO`, `alternativaSchema` e `InvariantException` vêm de `@educa/shared`; `WriteBlockTrigger` e `esperarNaTrava` do teste da 3.0; o fixture `atividade.fixture.ts` inteiro.
10. **Corrida:** `comecar` × `comecar` com a primeira segurada no `insert`, com a ordem da segunda diferente e já sorteada (o caso confere que o roteiro dela foi consumido); a mutação troca o `on conflict do nothing` pelo `do update` da `ordem`.
11. **Isolamento:** o caso de repository do `embaralhar` e o do alcance antes do sorteio; cada linha da tabela de testes tem o caso na coluna "Caso".
12. **Guardiões (`tenancy-guardian`, `conformidade-reviewer`) e o `achados/indice.md`:** a `ordem` é só posição, número, sem texto nem pessoa, na tentativa do aluno (`trabalho_do_aluno`, já classificada na 1.0); nenhuma saída de IA e nada de nota. O `achados/indice.md` da pasta diz o que as tarefas 1.0 a 3.0 levaram em rodada: nada ali toca o sorteio.

## Fora do escopo desta tarefa

A tela (12.0). **Para a 12.0, atenção:** com o embaralhamento ligado, a prova chega fora da ordem original. A tela de hoje (`Atividade.tsx`) lê `prova.questoes[numero - 1]` e manda como `alternativa` o **índice da posição na tela**; com `ordemDasAlternativas` o que se manda é `questao.ordemDasAlternativas[posicao]`, e a questão se acha por `numero`, não pela posição. O mapa das questões e o diagnóstico (`prova.questoes.find(item => item.numero === …)?.alternativas`, indexado pelo índice original) leem as alternativas na ordem da tela e precisam do mesmo mapeamento. Até a 12.0, uma prova com "embaralhar" ligado seria marcada errada pela tela de hoje; a spec só pousa inteira.

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec |
|---|---|---|
| A questão da prova ganha `ordemDasAlternativas` (o índice original de cada alternativa na ordem da tela; a identidade sem embaralhar) | O contrato (`questaoDaProvaSchema`) só levava `alternativas` e `numero`; a tela precisa do índice original para mandar a resposta, e a subtarefa 4.2 pede "o número original de questão e alternativa". A tela de hoje não o lê (12.0) | `techspec.md` §4 (parágrafo depois da tabela) e §5.3 (a `ordem` guardada) |

## Mutações

--faltando: nenhuma linha nova de produção com condição fica sem bloco (`node tools/processo/mutacoes.ts --faltando` confere): 42 blocos e os motivos abaixo.

Cada bloco aplica a mutação, roda o caso citado e exige vermelho. Os nomes de caso não levam parênteses (o `-t` do vitest é regex). Os casos de integração rodam sobre o banco compartilhado, com o pulso renovado antes de cada um e devolvido ao que era no `afterAll`.

**Sem bloco, com o motivo (cláusula equivalente, coberta por outra peça ou que não se alcança):**

- `embaralhar === undefined` (a guarda que lança `InvariantException` no `comecar`) **não tem caso que a alcance**: `prova(id, true)` acabou de achar a aplicação e a segura em `for share` na mesma transação, e `embaralhar(id)` usa o mesmo alcance; a guarda existe para estreitar o tipo. O bloco dela inverte a condição (a guarda passa a lançar sempre), para provar que é por ali que o `comecar` passa.
- `original === undefined` e `posicoes === undefined` em `naOrdemDoAluno`, **cada um sozinho**: os dois índices saem do mesmo número e a conferência de tamanho de cima os põe em arrays do mesmo tamanho, então os dois são indefinidos juntos e tirar um termo não muda o que a função faz. A guarda **inteira** tem bloco (sem ela o `TypeError` não é o `InvariantException`).
- `.min(1)` e `.int()` da questão na ordem: não há (o esquema usa `z.number()` e a permutação de 1 a n decide). Nenhum termo a mais.
- `COLUNAS_DA_TENTATIVA` e o `select` de `embaralhar`: só carregam coluna; a `ordem` tem bloco (lida por todos os casos de ordem) e o `where` do `embaralhar` tem os seus.

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/ordem-da-prova.ts
teste: apps/api/src/atividade/minha-atividade/ordem-da-prova.test.ts › sem embaralhar nada a ordem é nula
 export function sortearOrdem(total: number, embaralhar: Embaralhar, sortear: Sorteador): OrdemDaProva | null {
-  if (!embaralhar.questoes && !embaralhar.alternativas) return null
   const questoes = (embaralhar.questoes ? permutar(total, sortear) : identidade(total)).map((indice) => indice + 1)
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/ordem-da-prova.ts
teste: apps/api/src/atividade/minha-atividade/ordem-da-prova.test.ts › só questões: as alternativas ficam
-  if (!embaralhar.questoes && !embaralhar.alternativas) return null
+  if (!embaralhar.alternativas) return null
   const questoes = (embaralhar.questoes ? permutar(total, sortear) : identidade(total)).map((indice) => indice + 1)
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/ordem-da-prova.ts
teste: apps/api/src/atividade/minha-atividade/ordem-da-prova.test.ts › só alternativas: as questões ficam
-  if (!embaralhar.questoes && !embaralhar.alternativas) return null
+  if (!embaralhar.questoes) return null
   const questoes = (embaralhar.questoes ? permutar(total, sortear) : identidade(total)).map((indice) => indice + 1)
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/ordem-da-prova.ts
teste: apps/api/src/atividade/minha-atividade/ordem-da-prova.test.ts › com o sorteador que sempre devolve 0
-  const questoes = (embaralhar.questoes ? permutar(total, sortear) : identidade(total)).map((indice) => indice + 1)
+  const questoes = identidade(total).map((indice) => indice + 1)
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/ordem-da-prova.ts
teste: apps/api/src/atividade/minha-atividade/ordem-da-prova.test.ts › só alternativas: as questões ficam
-  const questoes = (embaralhar.questoes ? permutar(total, sortear) : identidade(total)).map((indice) => indice + 1)
+  const questoes = permutar(total, sortear).map((indice) => indice + 1)
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/ordem-da-prova.ts
teste: apps/api/src/atividade/minha-atividade/ordem-da-prova.test.ts › com o sorteador que sempre devolve 0
-  const alternativas = Array.from({ length: total }, () => (embaralhar.alternativas ? permutar(ALTERNATIVAS_POR_QUESTAO, sortear) : identidade(ALTERNATIVAS_POR_QUESTAO)))
+  const alternativas = Array.from({ length: total }, () => identidade(ALTERNATIVAS_POR_QUESTAO))
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/ordem-da-prova.ts
teste: apps/api/src/atividade/minha-atividade/ordem-da-prova.test.ts › só questões: as alternativas ficam
-  const alternativas = Array.from({ length: total }, () => (embaralhar.alternativas ? permutar(ALTERNATIVAS_POR_QUESTAO, sortear) : identidade(ALTERNATIVAS_POR_QUESTAO)))
+  const alternativas = Array.from({ length: total }, () => permutar(ALTERNATIVAS_POR_QUESTAO, sortear))
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/ordem-da-prova.ts
teste: apps/api/src/atividade/minha-atividade/ordem-da-prova.test.ts › o sorteio de produção devolve inteiros
-export const sorteadorDeProducao: Sorteador = (limiteExclusivo) => randomInt(limiteExclusivo)
+export const sorteadorDeProducao: Sorteador = () => 0
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/ordem-da-prova.ts
teste: apps/api/src/atividade/minha-atividade/ordem-da-prova.test.ts › coluna nula
-  if (gravada === null || gravada === undefined) return null
+  if (gravada === undefined) return null
   const lida = ordemDaProvaSchema.safeParse(gravada)
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/ordem-da-prova.ts
teste: apps/api/src/atividade/minha-atividade/ordem-da-prova.test.ts › coluna nula
-  if (gravada === null || gravada === undefined) return null
+  if (gravada === null) return null
   const lida = ordemDaProvaSchema.safeParse(gravada)
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/ordem-da-prova.ts
teste: apps/api/src/atividade/minha-atividade/ordem-da-prova.test.ts › questão repetida é defeito
   const lida = ordemDaProvaSchema.safeParse(gravada)
-  if (!lida.success) throw new InvariantException('ordem da prova inválida')
+  if (false) throw new InvariantException('ordem da prova inválida')
   return lida.data
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/ordem-da-prova.ts
teste: apps/api/src/atividade/minha-atividade/ordem-da-prova.test.ts › sem ordem, a prova é a original
-  if (ordem === null) return [...originais]
+  if (ordem === null) return []
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/ordem-da-prova.ts
teste: apps/api/src/atividade/minha-atividade/ordem-da-prova.test.ts › ordem de outra quantidade de questões
-  if (ordem.questoes.length !== originais.length || ordem.alternativas.length !== originais.length) throw new InvariantException('ordem da prova não bate com a atividade')
+  if (ordem.alternativas.length !== originais.length) throw new InvariantException('ordem da prova não bate com a atividade')
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/ordem-da-prova.ts
teste: apps/api/src/atividade/minha-atividade/ordem-da-prova.test.ts › ordem de outra quantidade de questões
-  if (ordem.questoes.length !== originais.length || ordem.alternativas.length !== originais.length) throw new InvariantException('ordem da prova não bate com a atividade')
+  if (ordem.questoes.length !== originais.length) throw new InvariantException('ordem da prova não bate com a atividade')
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/ordem-da-prova.ts
teste: apps/api/src/atividade/minha-atividade/ordem-da-prova.test.ts › número de questão que a atividade não tem
     const posicoes = ordem.alternativas[numero - 1]
-    if (original === undefined || posicoes === undefined) throw new InvariantException('ordem da prova aponta questão que não existe')
     return {
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/ordem-da-prova.ts
teste: apps/api/src/atividade/minha-atividade/ordem-da-prova.test.ts › as questões saem na ordem do aluno
-      alternativas: posicoes.map((indice) => original.alternativas[indice] as string),
+      alternativas: [...original.alternativas],
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/ordem-da-prova.ts
teste: apps/api/src/atividade/minha-atividade/ordem-da-prova.test.ts › as questões saem na ordem do aluno
-      ordemDasAlternativas: posicoes,
+      ordemDasAlternativas: [0, 1, 2, 3],
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/ordem-da-prova.ts
teste: apps/api/src/atividade/minha-atividade/ordem-da-prova.test.ts › alternativa repetida é defeito
-    alternativas: z.array(z.array(alternativaSchema).length(ALTERNATIVAS_POR_QUESTAO).refine(semRepeticao, { message: 'as alternativas são uma permutação' })),
+    alternativas: z.array(z.array(alternativaSchema).length(ALTERNATIVAS_POR_QUESTAO)),
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/ordem-da-prova.ts
teste: apps/api/src/atividade/minha-atividade/ordem-da-prova.test.ts › só três alternativas é defeito
-    alternativas: z.array(z.array(alternativaSchema).length(ALTERNATIVAS_POR_QUESTAO).refine(semRepeticao, { message: 'as alternativas são uma permutação' })),
+    alternativas: z.array(z.array(alternativaSchema).refine(semRepeticao, { message: 'as alternativas são uma permutação' })),
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/ordem-da-prova.ts
teste: apps/api/src/atividade/minha-atividade/ordem-da-prova.test.ts › alternativa fora de 0 a 3 é defeito
-    alternativas: z.array(z.array(alternativaSchema).length(ALTERNATIVAS_POR_QUESTAO).refine(semRepeticao, { message: 'as alternativas são uma permutação' })),
+    alternativas: z.array(z.array(z.number()).length(ALTERNATIVAS_POR_QUESTAO).refine(semRepeticao, { message: 'as alternativas são uma permutação' })),
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/ordem-da-prova.ts
teste: apps/api/src/atividade/minha-atividade/ordem-da-prova.test.ts › questão fora de 1 a n é defeito
   })
-  .refine(({ questoes }) => [...questoes].sort((a, b) => a - b).every((numero, indice) => numero === indice + 1), { message: 'as questões são uma permutação de 1 a n' })
 export type OrdemDaProva = z.infer<typeof ordemDaProvaSchema>
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/ordem-da-prova.ts
teste: apps/api/src/atividade/minha-atividade/ordem-da-prova.test.ts › campo a mais é defeito
-  .strictObject({
+  .object({
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts
teste: apps/api/src/atividade/embaralhamento.int.test.ts › sorteio fixo, dois alunos
-      .values({ escolaId: requireEscolaId(), anoLetivoId: requireAnoEmCurso(), atividadeAplicadaId, alunoId: requestSessao().usuarioId, limiteBaseEm, ordem })
+      .values({ escolaId: requireEscolaId(), anoLetivoId: requireAnoEmCurso(), atividadeAplicadaId, alunoId: requestSessao().usuarioId, limiteBaseEm })
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts
teste: apps/api/src/atividade/embaralhamento.int.test.ts › retomada: a segunda leitura
   envio: tentativaAtividade.envio,
-  ordem: tentativaAtividade.ordem,
   agora: agoraDoBanco,
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts
teste: apps/api/src/atividade/embaralhamento.int.test.ts › com a primeira segurada: a segunda sorteia outra ordem
-      .onConflictDoNothing({ target: [tentativaAtividade.escolaId, tentativaAtividade.anoLetivoId, tentativaAtividade.atividadeAplicadaId, tentativaAtividade.alunoId] })
+      .onConflictDoUpdate({ target: [tentativaAtividade.escolaId, tentativaAtividade.anoLetivoId, tentativaAtividade.atividadeAplicadaId, tentativaAtividade.alunoId], set: { ordem } })
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts
teste: apps/api/src/atividade/embaralhamento.int.test.ts › isolamento: o repository só lê
falha: ler(soQuestoes, outra.escolaId, outra.anoLetivoId, alunoDaOutra)
       .select({ questoes: atividadeAplicada.embaralharQuestoes, alternativas: atividadeAplicada.embaralharAlternativas })
       .from(atividadeAplicada)
-      .where(and(this.#daMinhaTurma(), eq(atividadeAplicada.id, id)))
+      .where(and(eq(atividadeAplicada.id, id)))
     return linha
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts
teste: apps/api/src/atividade/embaralhamento.int.test.ts › isolamento: o repository só lê
       .select({ questoes: atividadeAplicada.embaralharQuestoes, alternativas: atividadeAplicada.embaralharAlternativas })
       .from(atividadeAplicada)
-      .where(and(this.#daMinhaTurma(), eq(atividadeAplicada.id, id)))
+      .where(and(this.#daMinhaTurma()))
     return linha
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/embaralhamento.int.test.ts › sorteio fixo, dois alunos
-      questoes: naOrdemDoAluno(questoesDaProva(conteudo), readOrdem(tentativa.ordem)),
+      questoes: questoesDaProva(conteudo),
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/embaralhamento.int.test.ts › sorteio fixo, dois alunos
-      questoes: naOrdemDoAluno(questoesDaProva(conteudo), readOrdem(tentativa.ordem)),
+      questoes: naOrdemDoAluno(questoesDaProva(conteudo), null),
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/embaralhamento.int.test.ts › retomada: a segunda leitura
-      questoes: naOrdemDoAluno(questoesDaProva(conteudo), readOrdem(tentativa.ordem)),
+      questoes: naOrdemDoAluno(questoesDaProva(conteudo), sortearOrdem(conteudo.questoes.length, { questoes: true, alternativas: true }, this.sorteador)),
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/embaralhamento.int.test.ts › sorteio fixo, dois alunos
-    return sortearOrdem(totalDeQuestoes, embaralhar, this.sorteador)
+    return sortearOrdem(totalDeQuestoes, { questoes: false, alternativas: false }, this.sorteador)
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/embaralhamento.int.test.ts › sorteio fixo, dois alunos
-    if (embaralhar === undefined) throw new InvariantException('aplicação sem as opções de embaralhar')
+    if (embaralhar !== undefined) throw new InvariantException('aplicação sem as opções de embaralhar')
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/embaralhamento.int.test.ts › sorteio fixo, dois alunos
-        const ordem = await this.#ordemDeQuemComeca(atividades, id, conteudo.questoes.length)
+        const ordem = await this.#ordemDeQuemComeca(atividades, id, conteudo.questoes.length - 1)
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/embaralhamento.int.test.ts › só questões: as alternativas ficam
-    return sortearOrdem(totalDeQuestoes, embaralhar, this.sorteador)
+    return sortearOrdem(totalDeQuestoes, { ...embaralhar, questoes: false }, this.sorteador)
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/embaralhamento.int.test.ts › só alternativas: as questões ficam
-    return sortearOrdem(totalDeQuestoes, embaralhar, this.sorteador)
+    return sortearOrdem(totalDeQuestoes, { ...embaralhar, alternativas: false }, this.sorteador)
```

```mutacao
arquivo: apps/api/src/atividade/atividade.module.ts
teste: apps/api/src/atividade/embaralhamento.int.test.ts › sorteio fixo, dois alunos
-        { provide: SORTEADOR_DA_PROVA, useValue: opcoes.sorteadorDaProva ?? sorteadorDeProducao },
+        { provide: SORTEADOR_DA_PROVA, useValue: sorteadorDeProducao },
```

```mutacao
arquivo: apps/api/src/atividade/atividade.module.ts
teste: apps/api/src/atividade/embaralhamento.int.test.ts › sorteio fixo, dois alunos
-    { provide: MinhaAtividadeService, useFactory: (banco: Database, sorteador: Sorteador) => new MinhaAtividadeService(banco, sorteador), inject: [DB, SORTEADOR_DA_PROVA] },
+    { provide: MinhaAtividadeService, useFactory: (banco: Database, sorteador: Sorteador) => new MinhaAtividadeService(banco, sorteadorDeProducao), inject: [DB, SORTEADOR_DA_PROVA] },
```

```mutacao
arquivo: apps/api/src/app.module.ts
teste: apps/api/src/atividade/embaralhamento.int.test.ts › sorteio fixo, dois alunos
-          ...(opcoes.sorteadorDaProva === undefined ? {} : { sorteadorDaProva: opcoes.sorteadorDaProva }),
+          ...{},
```

```mutacao
arquivo: packages/shared/src/atividade/prova.ts
teste: packages/shared/src/atividade/atividade.test.ts › a ordem das alternativas é uma permutação
     .length(ALTERNATIVAS_POR_QUESTAO)
-    .refine((indices) => new Set(indices).size === ALTERNATIVAS_POR_QUESTAO, { message: 'a ordem das alternativas é uma permutação dos índices originais' }),
+    .refine(() => true, { message: 'a ordem das alternativas é uma permutação dos índices originais' }),
 })
```

```mutacao
arquivo: packages/shared/src/atividade/prova.ts
teste: packages/shared/src/atividade/atividade.test.ts › a ordem das alternativas é uma permutação
     .array(alternativaSchema)
-    .length(ALTERNATIVAS_POR_QUESTAO)
     .refine((indices) => new Set(indices).size === ALTERNATIVAS_POR_QUESTAO, { message: 'a ordem das alternativas é uma permutação dos índices originais' }),
```

```mutacao
arquivo: packages/shared/src/atividade/prova.ts
teste: packages/shared/src/atividade/atividade.test.ts › a ordem das alternativas é uma permutação
   ordemDasAlternativas: z
-    .array(alternativaSchema)
+    .array(z.number())
     .length(ALTERNATIVAS_POR_QUESTAO)
```

```mutacao
arquivo: packages/shared/src/atividade/prova.ts
teste: packages/shared/src/atividade/atividade.test.ts › as questões da prova saem do artefato só com número
     alternativas: [...questao.alternativas],
-    ordemDasAlternativas: questao.alternativas.map((_, original) => original),
+    ordemDasAlternativas: [3, 2, 1, 0],
   }))
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (1ª) e infra-guardian (1ª) | Juntar `embaralhar(id)` e `prova()` numa leitura só quando o teste da trava deixar de depender do texto da query | Retro: o motivo (o 1 kB do `pg_stat_activity` e o teste da trava) está no docblock de `embaralhar`; juntar agora derruba o teste da trava |
| revisor-geral (1ª) | Registrar na retro que a consulta separada existe por causa de como o teste acha a espera | Retro (mesmo destino da linha acima) |
| revisor-geral (1ª) | Um `.refine` em `ordemDaProvaSchema` para `alternativas.length === questoes.length`, e a guarda de tamanho num lugar só | Recusada: `naOrdemDoAluno` compara os dois com `originais.length`, que o esquema não conhece, e cada termo da guarda tem bloco de "Mutações" e caso; mover a igualdade muda onde a falha nasce sem mudar o comportamento |
| revisor-geral (1ª) | Na validação, confirmar que nenhuma linha leva a spec à `develop` antes da 12.0 | Sem ação nesta tarefa: já está em "Fora do escopo" da `4_task.md` ("a spec só pousa inteira"); vai ao Validador pelo item 1 da ordem da rodada 1 |
| privacy-guardian (1ª) | A 12.0 não pode revelar a ordem de um aluno a outro e só usa `ordemDasAlternativas` para mandar o índice original | Tarefa futura: 12.0 (o item 1 da ordem a levou para dentro da `12_task.md`, subtarefa 12.7) |
| infra-guardian (1ª) | `questaoDaProvaSchema` estrito: a aba aberta com o bundle anterior recusa a `prova` com `ordemDasAlternativas`; registrar no runbook do deploy desta spec, ou a web tolerar campo a mais | Tarefa futura: 12.0 (toca `apps/web/src/api/atividades-do-aluno.ts`, já nos arquivos previstos dela) e o pouso da spec (`docs/runbook.md`) |
| test-engineer (1ª) | Nenhum teste prova que, sem injeção, o módulo usa o `sorteadorDeProducao` (o lado `??` de `atividade.module.ts`) | Recusada: o sorteador de produção tem caso de unidade (`o sorteio de produção devolve inteiros`) e bloco de mutação; o `??` é uma linha de ligação sem regra de negócio |
| conformidade-reviewer (2ª) | O Validador confere que a 12.0 entrega o e2e da prova embaralhada antes do pouso | Validador: já está em "Fora do escopo" da `4_task.md` ("a spec só pousa inteira") e na subtarefa 12.7 e no e2e previstos na `12_task.md` |
| infra-guardian (2ª) | Na validação, conferir que o pouso da spec só acontece depois da 12.0, ou que `docs/runbook.md` ganhou a linha do deploy (bundle velho recusa a `prova` com `ordemDasAlternativas`) | Validador e pouso da spec; a web tolerar o campo a mais já está nos arquivos previstos da 12.0 (`atividades-do-aluno.ts`) |
| privacy-guardian (2ª) e revisor-geral (2ª) | O comentário de `Atividade.tsx:193` diz "a tarefa 12.0 manda", mas hoje a tela ainda manda a posição: escrever "até a 12.0, a tela manda a posição; a 12.0 passa a mandar `ordemDasAlternativas[indice]`" | Tarefa futura: 12.0 (12.7, que reescreve esse trecho de `Atividade.tsx`); sem efeito em comportamento |
| revisor-geral (2ª) | A subtarefa 12.7 (quarto item) e a linha de `Atividade.tsx` nos arquivos previstos ainda pedem para trocar o comentário que a 4.0 já trocou: reescrever como "manter o comentário verdadeiro depois do `ordemDasAlternativas[posicao]`" ou tirar | Tarefa futura: 12.0 (é o documento dela; a Mesa não o edita) |
| test-engineer (2ª) | A ordem "janela e estado antes do sorteio" não tem bloco em "Mutações" (subir `#ordemDeQuemComeca` para antes da guarda da janela) | Recusada: nenhuma linha nova de produção com condição ficou sem bloco (`mutacoes.ts --faltando`); a prova da ordem é o caso novo, que fica vermelho se o sorteio subir (o roteiro seria consumido) |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-24 02:44:23 | 2026-11-24 02:44:50 | `tenancy-guardian` | 1 | APROVADO | a49b429dd00d82c7f |
| 2026-11-24 02:44:28 | 2026-11-24 02:45:09 | `privacy-guardian` | 1 | APROVADO | a657ebe507843346f |
| 2026-11-24 02:44:36 | 2026-11-24 02:45:16 | `revisor-geral` | 1 | APROVADO | a10e2300eebb0fc00 |
| 2026-11-24 02:44:25 | 2026-11-24 02:45:17 | `conformidade-reviewer` | 1 | APROVADO | a796af751d9a677b2 |
| 2026-11-24 02:44:31 | 2026-11-24 02:45:46 | `infra-guardian` | 1 | REPROVADO | a002db0d3a2201f58 |
| 2026-11-24 02:44:33 | 2026-11-24 02:46:01 | `test-engineer` | 1 | APROVADO | aba28e54c98f0e38d |
| 2026-11-26 16:01:04 | 2026-11-26 16:01:25 | `tenancy-guardian` | 2 | APROVADO | a36a184e55fa9ef8d |
| 2026-11-26 16:01:12 | 2026-11-26 16:01:40 | `conformidade-reviewer` | 2 | APROVADO | a23185dacbe0b3561 |
| 2026-11-26 16:01:19 | 2026-11-26 16:01:41 | `privacy-guardian` | 2 | APROVADO | a56884090328e3ac0 |
| 2026-11-26 16:01:30 | 2026-11-26 16:01:51 | `infra-guardian` | 2 | APROVADO | a722ed3fda5791370 |
| 2026-11-26 16:01:45 | 2026-11-26 16:02:11 | `revisor-geral` | 2 | APROVADO | a9e193264c3e19ff5 |
| 2026-11-26 16:01:37 | 2026-11-26 16:02:22 | `test-engineer` | 2 | APROVADO | acd299a8f05aad24a |
