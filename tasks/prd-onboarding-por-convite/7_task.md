# Tarefa 7.0 — A planilha de alunos acha a turma pelo nome sujo e cria a que falta

**Funcionalidade:** onboarding-por-convite · **Depende de:** 4.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

A planilha de alunos casa "8ºA", "8 A" e "8a" com a mesma turma pela `chave`, cria a turma nova na série certa, e grava
a `lista_nome` de quem entra; com erro na linha, nada grava.

## Contexto necessário

- `techspec.md` §3 (`turma.chave`), §5 "Planilha", "O job" passo (3), "Gravar" ("Alunos")
- `prd.md` RF2, RF3, RF15, RF16
- `cenarios.md` RF2 e RF3; Corridas ("Turma à mão, ou renomeada, contra turma do job")
- Regra 60 itens 5 e 6; regra 20 item 2
- Código: o motor da 4.0; `packages/core/src/estrutura/turma.repository.ts`, `serie.repository.ts`, `lista.repository.ts`;
  `packages/shared/src/estrutura/documento-na-matricula.ts`

## Subtarefas

- [x] 7.1 — Tipo alunos, classificação de entrada: turma pela `chave` (ou pelo nome, se nula), turma nova com série, os erros de linha da tabela abaixo
- [x] 7.2 — Gravar: turma e série novas (`turma.criada`, com a série), `lista_nome` nova
- [x] 7.3 — Passo (3): turma relida; único violado (`chave`, matrícula na `lista_nome` ou na `credencial_matricula`): `desatualizada` na mesma execução
- [x] 7.4 — Consultas da prévia em lote, constantes entre 30 e 3.000 linhas
- [x] 7.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/importacao/tipos/alunos.ts` | novo |
| `packages/core/src/importacao/motor.ts`, `index.ts` | alterado |
| `packages/core/src/estrutura/turma.repository.ts`, `serie.repository.ts` | alterado |
| `apps/worker/test/gravar-planilha-alunos.int.test.ts`, `apps/api/test/importacao-alunos.int.test.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| Planilha com a turma escrita de três jeitos casa com uma turma só | integração | caminho feliz (RF3) | `apps/api/test/importacao-alunos.int.test.ts` › `a turma escrita de três jeitos ("8ºA", "8 A" e "8a") é uma turma só`; `packages/core/src/importacao/tipos/alunos.test.ts` › `"8ºA", "8º A", "8A", "8a" e "8º ano A" são a mesma turma` |
| Duas turmas existentes com a mesma chave: erro na linha | integração | RF3 | `apps/api/test/importacao-alunos.int.test.ts` › `duas turmas da escola com a mesma chave`; `packages/core/src/importacao/tipos/alunos.test.ts` › `a turma da escola com a mesma chave` |
| Turmas que a migration deixou com chave nula: a prévia dá erro | integração | RF3 | `apps/api/test/importacao-alunos.int.test.ts` › `duas turmas da escola com a mesma chave (as que a migration deixou com chave nula)`; `packages/core/src/importacao/tipos/alunos.test.ts` › `a turma com a chave nula é achada pelo nome` |
| "8A" renomeada para "9B": a planilha com "8A" vira turma nova | integração | RF3 | `apps/api/test/importacao-alunos.int.test.ts` › `"8A" renomeada para "9B"` |
| "8A" renomeada para "9B": a planilha com "9B" casa | integração | RF3 | `apps/api/test/importacao-alunos.int.test.ts` › `"8A" renomeada para "9B"` |
| "Turma Azul" e "10A": erro na linha | integração | RF3 | `apps/api/test/importacao-alunos.int.test.ts` › `três linhas erradas ("Turma Azul", "10A", aluno sem nome)`; `a turma que o texto escreve mas a escola não pode ter` |
| Turma nova nasce na série certa, e a série é criada se faltar | integração | | `apps/worker/test/gravar-planilha-alunos.int.test.ts` › `o job cria a turma e a série que faltam`; `packages/core/src/importacao/tipos/alunos.test.ts` › `a série vem do dígito`; `apps/worker/test/gravar-planilha-alunos.int.test.ts` › `a série que a escola já tem é reaproveitada` |
| [P] "8º A" à mão contra "8A" do job: uma turma; a criação à mão que perde recebe `CONFLITO` | [P] | | `apps/api/test/importacao-alunos.int.test.ts` › `[P] a criação à mão de "8º A" (direto no banco) parada contra o job`; `apps/worker/test/gravar-planilha-alunos.int.test.ts` › `[P] "8º A" criada à mão (ainda não confirmada)` |
| [P] O mesmo, com o job perdendo: `desatualizada` na mesma execução | [P] | tentativa 1 | `apps/worker/test/gravar-planilha-alunos.int.test.ts` › `[P] "8º A" criada à mão (ainda não confirmada)`; `[P] "8º A" criada à mão e confirmada entre o passo (2) e o (3)` |
| [P] "8B" renomeada para "8A" contra o job criando "8A": uma turma | [P] | | `apps/api/test/importacao-alunos.int.test.ts` › `[P] a renomeação de "8B" para "8A" (direto no banco) parada contra o job`; `apps/worker/test/gravar-planilha-alunos.int.test.ts` › `[P] "8B" renomeada para "8A" (ainda não confirmada)` |
| [P] Turma tocada renomeada entre o (2) e o (3): `desatualizada`; nenhum aluno vai para a "9B" | [P] | releitura | `apps/worker/test/gravar-planilha-alunos.int.test.ts` › `[P] turma tocada renomeada de "8A" para "9B" entre o passo (2) e o (3)` |
| Matrícula repetida na planilha: erro nas duas linhas | integração | | `apps/api/test/importacao-alunos.int.test.ts` › `matrícula repetida na planilha`; `packages/core/src/importacao/tipos/alunos.test.ts` › `o erro da linha vem na ordem turma, nome` |
| Matrícula em notação científica no CSV: erro na linha | integração | RF2 | `apps/api/test/importacao-alunos.int.test.ts` › `matrícula em notação científica no CSV` |
| [P] Nome avulso com a matrícula M lançado entre o (2) e o (3): `desatualizada`, a avulsa intacta, zero `lista_nome` da planilha | [P] | tentativa 1 | `apps/worker/test/gravar-planilha-alunos.int.test.ts` › `[P] nome avulso com a matrícula M lançado entre o passo (2) e o (3)`; `[P] nome avulso com a matrícula M escrito e ainda não confirmado` |
| [P] Aprovado com a matrícula M lançado entre o (2) e o (3): `desatualizada` | [P] | releitura da `credencial_matricula` | `apps/worker/test/gravar-planilha-alunos.int.test.ts` › `[P] aluno aprovado com a matrícula M lançado entre o passo (2) e o (3)` |
| Homônimos com matrículas diferentes: dois alunos | integração | borda | `apps/api/test/importacao-alunos.int.test.ts` › `homônimos com matrículas diferentes são dois alunos`; `apps/worker/test/gravar-planilha-alunos.int.test.ts` › `homônimos com matrículas diferentes são dois alunos` |
| Matrícula da B na planilha da A: "entra" | integração | isolamento | `apps/api/test/importacao-alunos.int.test.ts` › `isolamento: a matrícula da escola B`; `apps/worker/test/gravar-planilha-alunos.int.test.ts` › `isolamento: a matrícula e a turma da escola B` |
| Turma "8A" da B não casa com a planilha da A | integração | isolamento | `apps/api/test/importacao-alunos.int.test.ts` › `isolamento: a matrícula da escola B`; `apps/worker/test/gravar-planilha-alunos.int.test.ts` › `isolamento: a matrícula e a turma da escola B` |
| 3.001 linhas ou mais de 512 KB: recusado; 3.000 entram | integração | RF2 | `apps/api/test/importacao-alunos.int.test.ts` › `3.001 linhas ou mais de 512 KB` |
| Consultas da prévia iguais entre 30 e 3.000 linhas, contadas | integração | RF2 | `apps/api/test/importacao-alunos.int.test.ts` › `as consultas da prévia são as mesmas com 30 e com 3.000 linhas` |
| [P] Duas execuções com barreira: um efeito só nas contagens de turma e `lista_nome` | [P] | job duas vezes | `apps/worker/test/gravar-planilha-alunos.int.test.ts` › `[P] duas execuções do mesmo job` |
| Turma travada por mais de 1 s: nada parcial; a nova tentativa conclui | integração | | `apps/worker/test/gravar-planilha-alunos.int.test.ts` › `turma travada por mais de 1 s` |
| [P] Passo (3) contra o gerar acesso na mesma turma (nas duas ordens) e contra o encerrar do ano (a espera do `FOR SHARE` do ano): zero `40P01` e zero 503; a prova de que a virada da sala apaga a `lista_nome` depois do job fica para a retro | [P] | `FOR NO KEY UPDATE` | `apps/api/test/importacao-alunos.int.test.ts` › `[P] o passo (3) contra o gerar acesso na mesma turma`; `[P] o passo (3) parado depois de gravar a lista contra o encerrar do ano`; `apps/worker/test/gravar-planilha-alunos.int.test.ts` › `o passo (3) trava as turmas que as linhas tocam num único `for no key update`` |
| Auditoria `turma.criada` com a série | integração | RF17 | `apps/worker/test/gravar-planilha-alunos.int.test.ts` › `o job cria a turma e a série que faltam` |
| Escola sem ano em curso: com o filtro do planejado, a turma nova nasce no planejado | integração | ano | `apps/worker/test/gravar-planilha-alunos.int.test.ts` › `escola sem ano em curso`; `apps/api/test/importacao-alunos.int.test.ts` › `escola sem ano em curso` |

## Como testar

- Lista da A1: `apps/api/test/lista.int.test.ts` (`escolaComTurmas()`), `› a prévia aponta cada linha ruim com o código, entre as boas; …`
- Corrida do gerar: `apps/api/test/acesso-fim-do-vinculo.int.test.ts › o gerar parado depois do insert: o encerrar espera a turma e revoga o acesso que acabou de nascer`
- Contagem de consultas: **sem precedente**; o espião no `query` do pool, como na 3.0
- Comando: `npx vitest run --project integracao apps/worker/test/gravar-planilha-alunos.int.test.ts`
- Armadilha (rodada 8): no único violado, chame o processor uma vez e confira `desatualizada` na tentativa 1; pelo BullMQ a mutação passaria

## Autoconferência

As 12 perguntas do modelo, no plano. Na 3, duas turmas de mesma chave em anos diferentes.

1. **Mutação de cada cláusula:** 41 blocos na seção "Mutações" e 7 linhas (12 motivos) com o motivo escrito (atalho de lista vazia, guarda de tipo, cláusula que a FK composta já garante). Os blocos apontam para o caso de unidade (`alunos.test.ts`) onde a regra é pura e para o de integração onde a cláusula é de repository ou de trava.
2. **O texto na tela:** a tarefa não tem tela (a tela é a 13.0); não se aplica.
3. **O segundo dado:** o caso `a turma e a lista de outro ano da mesma escola não contam` tem a "8A" e a matrícula do ano planejado contra a planilha do ano em curso: não casam, e a do planejado casa com elas (o único parcial de `turma.chave` é por escola **e ano**, e o `doAnoComSerie` filtra o ano). As duas turmas de mesma chave têm caso (nula na migration), a escola B tem a matrícula, a credencial e a "8A" que a A não pode ver, e há a escola sem ano em curso.
4. **Checagem anterior que responde antes:** o erro do texto (turma vazia, nome, matrícula, documento) vem antes da turma; a turma antes da matrícula em uso; a matrícula repetida só aparece na linha sem erro anterior. Professor e aluno recebem `NAO_ENCONTRADO` pela permissão, antes de ler a planilha.
5. **Resultado, não forma do código:** as asserções leem `turma`, `serie`, `lista_nome`, `auditoria` e `importacao_planilha`; o espião de SQL confere a ordem das travas (importação, ano, turma `for no key update`, insert) e o número de consultas da prévia.
6. **Guarda nova:** nenhuma. A ação de auditoria `turma.criada` entra na lista fechada de `acoes.ts` (com a série e a origem `planilha`, sem nome de aluno nem matrícula).
7. **Comentários:** relidos contra o código. O docblock de `alunos.ts`, o de `tipo.ts` (o `travar` opcional) e o do passo (3) do `motor.ts` dizem o que o código faz.
8. **A divergência cria regra?** Uma: a matrícula que a escola já tem neste ano vira "já existe" (e não erro), pois a 8.0 é quem decide nome e turma dela. Está em `techspec.md` §5 ("Alunos") e no `cenarios.md` (RF2), sem mudar a seção 11.
9. **Peça que já existe:** o motor e o `tipo.ts` da 4.0, `lerTabela`/`normalizarTexto`, `chaveDaTurma`/`serieDaChave`, `matriculasQueParecemDocumento`, `AuditoriaRecorder`, `WriteBlockTrigger`/`esperarNaTrava`, `QueueFixtures`, `SessaoFixtures`; os repositórios de turma, série e lista ganharam um método cada, sem cópia.
10. **Corrida:** a criação à mão e a renomeação paradas contra o job (a que perde recebe `CONFLITO` ou o job sai `desatualizada`), o gerar acesso nas duas ordens, o encerrar do ano, a matrícula lançada entre o (2) e o (3) e duas execuções do mesmo job.
11. **Isolamento e coluna "Caso":** cada linha da tabela tem o caso. O isolamento tem a credencial e a lista da B, a "8A" da B e a série da B, e cada cláusula de escopo de repository com efeito tem bloco.
12. **O que verificar dos guardiões:** `tenancy-guardian` (a escola pelo contexto em todo método novo, o ano de destino conferido pelo motor), `privacy-guardian` (nome e matrícula só em `lista_nome`, auditoria e logs sem eles, código de erro de lista fechada), `infra-guardian` (consultas constantes, ordem das travas, `lock_timeout` de 1 s e nova tentativa, `FOR NO KEY UPDATE` por id num comando).

## Fora do escopo desta tarefa

"Já existe", nome corrigido e a lista da A1 (8.0); transferência e desligamento (9.0, 10.0); a tela (13.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| A matrícula que a escola já tem no ano (na lista ou com credencial) é "já existe" na planilha de alunos, e a turma que só ela pedia não nasce | O que a matrícula em uso diz de nome e de turma é da 8.0, 9.0 e 10.0; criar turma por uma linha que não grava nada deixaria turma vazia | `techspec.md` §5 "Gravar" ("Alunos (7.0)"); `cenarios.md` RF2 (o cenário da matrícula que a escola já tem); a seção 11 não muda |
| O `TipoDeImportacao` ganha o `travar` opcional, chamado pelo motor no passo (3) depois de conferir o ano | A trava `FOR NO KEY UPDATE` das turmas que as linhas tocam depende do tipo, e o motor não conhece turma | `techspec.md` §5 "Gravar" (o gancho `travar`) e "O job" (as turmas "em ordem de id num comando só") |
| Ação de auditoria nova `turma.criada` (entidade `turma`, `depois` com a série e a origem `planilha`) | A criação da turma pela planilha precisa de registro com a série (RF17) | `techspec.md` §5 "Gravar" (`turma.criada`); `cenarios.md` RF17 (a linha `turma.criada` da tabela); `docs/lgpd.md` não muda (nenhum campo de pessoa) |
| Arquivos além dos "previstos": `tipo.ts`, `importacao.repository.ts`, `lista.repository.ts`, `acoes.ts`, `alunos.test.ts` e `apps/api/test/importacao.int.test.ts` (o caso de tipo que ainda não grava deixa de citar `alunos`) | Cada um é o ponto onde o código novo precisa existir para o tipo, a consulta em lote e a auditoria | `techspec.md` §2 e §5; a seção 11 não muda |

## Mutações

--faltando: 7 linhas (41 blocos, 12 motivos)

**Sem bloco (motivo):** (1) `ListaRepository.emUsoNoAno` (`matriculas.length === 0`) e `TurmaRepository.travarNoAno` (`ids.length === 0`), os atalhos que poupam a consulta vazia: sem eles o `inArray` com lista vazia vira `false` e nada é lido nem travado; o resultado é o mesmo. (2) `TurmaRepository.criarNoAno`, `criada === undefined`: o `insert … returning` sempre devolve a linha; é guarda de tipo, a mesma do `criar`. (3) O `eq(escolaId, …)` dos `where` de `TurmaRepository.doAnoComSerie` e `travarNoAno`: o ano é da escola (FK composta `(escola_id, ano_letivo_id)`), então sem o termo o resultado é o mesmo; ele fica pela regra 10 (item 3). O de `SerieRepository.todas` **não** é equivalente (a tabela não tem filtro de ano, e sem o termo a consulta devolveria as séries de todas as escolas): ele tem bloco, que aponta para o caso de isolamento do worker, e a FK `turma_serie_da_escola_fk` é a segunda camada. (4) `indiceDaTurma` (`alunos.ts`), o `chave ??` do índice: a `chave` gravada é `chaveDaTurma(nome)` (a renomeação a recalcula), então o nome dá a mesma chave; ela só difere quando é nula, e o caso é o dos blocos acima. (5) `errosDoTexto`, o `?? 0` da leitura de `vezes`: só estreita o tipo do `Map.get` (toda matrícula lida foi contada). (6) `assinaturaDe`, o `erro ?? null` e o `nova:${chave}`: o erro é função do texto, que a `linha` e o `resultado` já distinguem (o gravar recusa a linha com erro), e a chave da turma nova sai do mesmo texto; o que a assinatura precisa pegar é o destino que mudou, e o bloco o prova. (7) `idDaTurma`, o `?? ''` e o `if (id === undefined) throw`: a linha que entra sempre tem destino, e a turma nova sempre foi criada antes; é a guarda de tipo que transforma o impossível em erro alto, nunca em turma errada. (8) `tipoAlunos.previa`, os `?? ''` de `campos[…]`: o `campos` vem do `lerTabela` com todas as colunas do cabeçalho (o mesmo do `professores.ts`). (9) `tipoAlunos.travar`, `!lido.success`: o passo (2) já devolveu `undefined` do `planejar` e fechou `falhou` antes de o (3) existir (o caso da falha definitiva); a linha é a guarda de tipo do mesmo valor. `tipoAlunos.planejar`, `lido.success ?`, tem bloco. (10) O `inArray` das matrículas da planilha em `emUsoNoAno` (lista e credencial): só limita a leitura às matrículas pedidas; o resultado é o mesmo, porque a classificação só pergunta `has` das matrículas da planilha, e o teste de consultas conta consultas, não linhas lidas. (11) `ListaRepository.inserirNoAno`, `nomes.length === 0`: o `inserirNomes` do `ImportacaoRepository` reparte em lotes e não chama o `inserirNoAno` com lista vazia (a planilha só de "já existe" não tem lote); o atalho evita o `values([])` de quem chamar de outro lugar. (12) O corte em lotes de `ImportacaoRepository.inserirNomes` (`TAMANHO_DO_LOTE`): sem o corte, 3.000 linhas ainda cabem num comando, então nenhum teste distinguiria a mudança; o corte existe para o tamanho do comando e do plano, não para o resultado.

A notação científica deixa de ser erro.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: packages/core/src/importacao/tipos/alunos.test.ts › o erro da linha vem na ordem turma, nome
-const NOTACAO_CIENTIFICA = /^[+-]?\d+(?:[.,]\d+)?e[+-]?\d+$/i
+const NOTACAO_CIENTIFICA = /^$a/
```

O nome da turma nova guarda o espaço a mais.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: packages/core/src/importacao/tipos/alunos.test.ts › o nome da turma nova perde o espaço a mais
-return texto.replace(/\s+/g, ' ').trim()
+return texto.trim()
```

A turma sem a `chave` deixa de ser achada pelo nome com o padrão.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: packages/core/src/importacao/tipos/alunos.test.ts › a turma com a chave nula é achada pelo nome
-return chave ?? doNome ?? `n:${normalizarTexto(nome)}`
+return chave ?? `n:${normalizarTexto(nome)}`
```

A turma fora do padrão deixa de ser achada pelo nome.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: packages/core/src/importacao/tipos/alunos.test.ts › a turma com a chave nula é achada pelo nome
-return chave ?? doNome ?? `n:${normalizarTexto(nome)}`
+return chave ?? doNome ?? ''
```

O erro `turma_vazia` deixa de existir.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: packages/core/src/importacao/tipos/alunos.test.ts › o erro da linha vem na ordem turma, nome
-if (turma === '') return 'turma_vazia'
```

O erro `sem_nome` deixa de existir.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: packages/core/src/importacao/tipos/alunos.test.ts › o erro da linha vem na ordem turma, nome
-if (nome === '') return 'sem_nome'
```

O erro `nome_invalido` deixa de existir.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: packages/core/src/importacao/tipos/alunos.test.ts › o erro da linha vem na ordem turma, nome
-if (!nomeDigitadoSchema.safeParse(nome).success) return 'nome_invalido'
```

O erro `sem_matricula` deixa de existir.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: packages/core/src/importacao/tipos/alunos.test.ts › o erro da linha vem na ordem turma, nome
-if (matricula === '') return 'sem_matricula'
```

O erro `matricula_invalida` deixa de existir.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: packages/core/src/importacao/tipos/alunos.test.ts › o erro da linha vem na ordem turma, nome
-if (!matriculaDigitadaSchema.safeParse(matricula).success) return 'matricula_invalida'
```

O erro `matricula_notacao_cientifica` deixa de existir.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: packages/core/src/importacao/tipos/alunos.test.ts › o erro da linha vem na ordem turma, nome
-if (NOTACAO_CIENTIFICA.test(matricula)) return 'matricula_notacao_cientifica'
```

A matrícula que parece documento deixa de ser erro.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: packages/core/src/importacao/tipos/alunos.test.ts › o erro da linha vem na ordem turma, nome
-return parecemDocumento[posicao] === true ? 'matricula_parece_documento' : undefined
+return undefined
```

A conta de vezes da matrícula deixa de partir do zero.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: packages/core/src/importacao/tipos/alunos.test.ts › o erro da linha vem na ordem turma, nome
-for (const { matricula } of lidas) vezes.set(matricula, (vezes.get(matricula) ?? 0) + 1)
+for (const { matricula } of lidas) vezes.set(matricula, vezes.get(matricula) + 1)
```

A matrícula repetida deixa de ser erro.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: packages/core/src/importacao/tipos/alunos.test.ts › o erro da linha vem na ordem turma, nome
-return lidas.map(({ matricula }, posicao) => doCampo[posicao] ?? ((vezes.get(matricula) ?? 0) > 1 ? 'matricula_repetida' : undefined))
+return lidas.map((_, posicao) => doCampo[posicao])
```

A matrícula repetida passa à frente do erro do campo.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: packages/core/src/importacao/tipos/alunos.test.ts › o erro da linha vem na ordem turma, nome
-return lidas.map(({ matricula }, posicao) => doCampo[posicao] ?? ((vezes.get(matricula) ?? 0) > 1 ? 'matricula_repetida' : undefined))
+return lidas.map(({ matricula }, posicao) => ((vezes.get(matricula) ?? 0) > 1 ? 'matricula_repetida' : undefined) ?? doCampo[posicao])
```

A turma nova sem nenhuma turma no índice deixa de ter a lista vazia.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: packages/core/src/importacao/tipos/alunos.test.ts › são a mesma turma
-const achadas = porIndice.get(indice) ?? []
+const achadas = porIndice.get(indice)
```

Duas turmas de mesma chave deixam de ser "turma ambígua".

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: packages/core/src/importacao/tipos/alunos.test.ts › a turma da escola com a mesma chave
-if (achadas.length > 1) return 'turma_ambigua'
```

A turma que a escola tem deixa de casar.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: packages/core/src/importacao/tipos/alunos.test.ts › a turma com a chave nula é achada pelo nome
-if (unica !== undefined) return { tipo: 'existente', turmaId: unica.id }
```

O nome sem série deixa de ser "turma inválida".

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: packages/core/src/importacao/tipos/alunos.test.ts › a série vem do dígito
-return serie === null ? 'turma_invalida' : { tipo: 'nova', chave: indice, serie }
+return { tipo: 'nova', chave: indice, serie }
```

As turmas da escola de mesma chave deixam de se somar no índice.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: packages/core/src/importacao/tipos/alunos.test.ts › a turma da escola com a mesma chave
-porIndice.set(indice, [...(porIndice.get(indice) ?? []), turma])
+porIndice.set(indice, [turma])
```

O erro do texto deixa de valer na linha.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: packages/core/src/importacao/tipos/alunos.test.ts › o erro da linha vem na ordem turma, nome
-if (erroDoTexto !== undefined) return { linha, resultado: 'erro', erro: erroDoTexto, nome, matricula }
```

O erro da turma deixa de valer na linha.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: packages/core/src/importacao/tipos/alunos.test.ts › a série vem do dígito
-if (typeof destino === 'string') return { linha, resultado: 'erro', erro: destino, nome, matricula }
```

A matrícula em uso deixa de ser "já existe".

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: packages/core/src/importacao/tipos/alunos.test.ts › a matrícula em uso é
-if (emUso.has(matricula)) return { linha, resultado: 'ja_existe', destino, nome, matricula }
```

A turma nova passa a levar o nome da última grafia.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: packages/core/src/importacao/tipos/alunos.test.ts › são a mesma turma
-if (destino.tipo === 'nova' && !novasPorChave.has(destino.chave)) novasPorChave.set(destino.chave, turmaNova(destino, turma))
+if (destino.tipo === 'nova') novasPorChave.set(destino.chave, turmaNova(destino, turma))
```

A turma que a escola já tem passa a ser criada.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: packages/core/src/importacao/tipos/alunos.test.ts › a turma com a chave nula é achada pelo nome
-if (destino.tipo === 'nova' && !novasPorChave.has(destino.chave)) novasPorChave.set(destino.chave, turmaNova(destino, turma))
+if (!novasPorChave.has(destino.chave)) novasPorChave.set(destino.chave, turmaNova(destino, turma))
```

As turmas novas saem na ordem em que a planilha as pediu, não na da chave.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: packages/core/src/importacao/tipos/alunos.test.ts › a série vem do dígito
-const novas = [...novasPorChave.values()].sort((a, b) => (a.chave < b.chave ? -1 : 1))
+const novas = [...novasPorChave.values()]
```

A assinatura deixa de contar a turma de destino da linha.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: packages/core/src/importacao/tipos/alunos.test.ts › a assinatura muda com o ano
-const destinoDe = (destino: Destino | undefined) => (destino === undefined ? null : destino.tipo === 'existente' ? destino.turmaId : `nova:${destino.chave}`)
+const destinoDe = (_destino: Destino | undefined) => null
```

O nome gravado vai para a turma nova mesmo quando a linha é de turma que a escola já tem.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/gravar-planilha-alunos.int.test.ts › a série que a escola já tem é reaproveitada
-const id = destino?.tipo === 'existente' ? destino.turmaId : novas.get(destino?.chave ?? '')
+const id = novas.get(destino?.chave ?? '')
```

A série que a escola já tem passa a ser criada outra vez.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/gravar-planilha-alunos.int.test.ts › a série que a escola já tem é reaproveitada
-const serieId = series.get(chaveDaSerie) ?? (await gravacao.criarSerie(pedidoDaSerie(nova.serie)))
+const serieId = (await gravacao.criarSerie(pedidoDaSerie(nova.serie)))
```

A série do Médio nasce como a do Fundamental.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/gravar-planilha-alunos.int.test.ts › o job cria a turma e a série que faltam
-return etapa === 'em' ? { etapa: 'em', ano } : { etapa: 'ef_anos_finais', ano }
+return false ? { etapa: 'em', ano } : { etapa: 'ef_anos_finais', ano }
```

A linha sem todas as colunas entra como completa.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/api/test/importacao-alunos.int.test.ts › o erro da linha vem na ordem em que a coordenação
-if (campos !== null) completas.push({ linha, turma: (campos['turma'] ?? '').trim(), nome: (campos['nome'] ?? '').trim(), matricula: (campos['matricula'] ?? '').trim() })
+if (true) completas.push({ linha, turma: (campos['turma'] ?? '').trim(), nome: (campos['nome'] ?? '').trim(), matricula: (campos['matricula'] ?? '').trim() })
```

A linha sem classificação deixa de ser `linha_incompleta`.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/api/test/importacao-alunos.int.test.ts › o erro da linha vem na ordem em que a coordenação
-if (classificada === undefined) return { linha, resultado: 'erro', erro: 'linha_incompleta' }
```

O erro da linha deixa de aparecer na prévia.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/api/test/importacao-alunos.int.test.ts › o erro da linha vem na ordem em que a coordenação
-if (classificada.erro !== undefined) return { linha, resultado: 'erro', erro: classificada.erro }
```

A matrícula que a escola já tem aparece como "entra" na prévia.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/api/test/importacao-alunos.int.test.ts › a matrícula que a escola já tem
-return { linha, resultado: classificada.resultado === 'entra' ? 'entra' : 'ja_existe' }
+return { linha, resultado: 'entra' }
```

A forma errada do que o gravar guardou vira um plano.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/gravar-planilha-alunos.int.test.ts › falha definitiva
-return lido.success ? planoDe(ano.id, await classificarAgora(repositorio, ano.id, lido.data)) : undefined
+return planoDe(ano.id, await classificarAgora(repositorio, ano.id, lido.data))
```

A lista de nomes de outro ano passa a valer neste.

```mutacao
arquivo: packages/core/src/estrutura/lista.repository.ts
teste: apps/api/test/importacao-alunos.int.test.ts › a turma e a lista de outro ano da mesma escola não contam
-.where(and(eq(listaNome.escolaId, escolaId), eq(listaNome.anoLetivoId, anoLetivoId), inArray(matriculaDoIndice, [...matriculas])))
+.where(and(eq(listaNome.escolaId, escolaId), inArray(matriculaDoIndice, [...matriculas])))
```

A credencial de outra escola passa a valer nesta.

```mutacao
arquivo: packages/core/src/estrutura/lista.repository.ts
teste: apps/api/test/importacao-alunos.int.test.ts › isolamento: a matrícula da escola B
-.where(and(eq(credencialMatricula.escolaId, escolaId), inArray(credencialMatricula.matricula, [...matriculas])))
+.where(and(inArray(credencialMatricula.matricula, [...matriculas])))
```

As séries de outra escola passam a valer nesta.

```mutacao
arquivo: packages/core/src/estrutura/serie.repository.ts
teste: apps/worker/test/gravar-planilha-alunos.int.test.ts › isolamento: a matrícula e a turma da escola B
-return this.banco.select(colunas).from(serie).where(eq(serie.escolaId, requireEscolaId())).orderBy(asc(serie.id))
+return this.banco.select(colunas).from(serie).orderBy(asc(serie.id))
```

A turma de outro ano passa a valer neste.

```mutacao
arquivo: packages/core/src/estrutura/turma.repository.ts
teste: apps/api/test/importacao-alunos.int.test.ts › a turma e a lista de outro ano da mesma escola não contam
-.where(and(eq(turma.escolaId, requireEscolaId()), eq(turma.anoLetivoId, anoLetivoId)))
+.where(and(eq(turma.escolaId, requireEscolaId())))
```

O passo (3) trava todas as turmas do ano, não só as que as linhas tocam.

```mutacao
arquivo: packages/core/src/estrutura/turma.repository.ts
teste: apps/worker/test/gravar-planilha-alunos.int.test.ts › trava as turmas que as linhas tocam
-.where(and(eq(turma.escolaId, requireEscolaId()), eq(turma.anoLetivoId, anoLetivoId), inArray(turma.id, [...ids])))
+.where(and(eq(turma.escolaId, requireEscolaId()), eq(turma.anoLetivoId, anoLetivoId)))
```

O passo (3) deixa de chamar a trava do tipo.

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/worker/test/gravar-planilha-alunos.int.test.ts › trava as turmas que as linhas tocam
-await tipo.travar?.(gravacao, ano, linhas)
```

O tipo trava todas as turmas do ano, não só as que as linhas tocam.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/gravar-planilha-alunos.int.test.ts › trava as turmas que as linhas tocam
-const tocadas = (await repositorio.turmasDoAno(ano.id)).filter((turma) => pedidas.has(indiceDaTurma(turma.nome, turma.chave)))
+const tocadas = await repositorio.turmasDoAno(ano.id)
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (1ª) | `ImportacaoRepository.inserirNomes` não chama `requireEscolaId()` antes de delegar, "vale só pela uniformidade" | Recusada: o `inserirNoAno` já exige a escola e o revisor-geral (1ª) pede o oposto (recomendação 4, tirar a chamada repetida). Sem efeito no resultado; não vale mexer em `importacao.repository.ts` para os dois |
| revisor-geral (1ª) | Escopo conferido duas vezes em `importacao.repository.ts:329-363`; trocar as seis chamadas de `requireEscolaId()` por um comentário | Recusada: contradiz a recomendação do tenancy-guardian acima, e a guarda `tools/guardas/repositories-com-escopo.test.ts` pode exigir a chamada em cada método. Sem efeito no resultado |
| revisor-geral (1ª) | Escrever no `8_task.md` que a 8.0 parte do `ja_existe` da 7.0 e o divide | Já está em `techspec.md` §5 "Alunos (7.0)" e em `cenarios.md` RF2; a 8.0 lê os dois (`8_task.md` é de outra tarefa, não toca nesta) |
| infra-guardian (1ª) | `travar` e `planejar` leem `turmasDoAno` cada um dentro da transação travada; reaproveitar a leitura | `TODO.md`: exige passar estado entre `travar` e `gravar`, o que muda o contrato do gancho; medir primeiro (linha seguinte) |
| infra-guardian (1ª) | No staging, medir quanto dura o passo (3) com 3.000 linhas e cerca de 32 turmas novas | `TODO.md` (medição no staging, na primeira esteira com a 7.0) |
| privacy-guardian (1ª) | `codigoDeLinha` do contrato aceita qualquer `[a-z0-9_]`; fechar num enum no `contratos.ts` | `TODO.md`: muda o contrato compartilhado (`packages/shared`), fora desta tarefa; hoje os códigos vêm da união fechada `ErroDaLinhaDeAluno` |
| privacy-guardian (1ª) | Lembrar que a tela da 13.0 avisa a coordenação de que os nomes ficam visíveis a quem tem o link ou o código da turma | Tarefa 13.0 (`13_task.md`), a que toca a tela de gravar; o Orquestrador ou o Arquiteto anota lá |
| test-engineer (1ª) | Manter os passos de `entreOs2e3` e "duas execuções" direto no banco, dentro do `lock_timeout` | Nada a mudar: já é assim; vira regra do item 2 |
| tenancy-guardian (2ª), privacy-guardian (2ª), revisor-geral (2ª), infra-guardian (2ª), test-engineer (2ª) | O caso do encerrar do ano passou a fazer `update ano_letivo` direto: nenhum teste da tarefa passa pela virada da sala depois do job; vale um `POST /v1/anos-letivos/:id/encerrar` fora da janela, ou ajustar a linha 64 do `7_task.md` ao que o caso cobre | Só documento: ajuste a linha 64 do `7_task.md` ao que o caso cobre hoje (a espera do `FOR SHARE` do ano). A prova de que a virada apaga a `lista_nome` fica para a retro; não pede teste novo nesta tarefa |
| test-engineer (2ª) | Linhas 49 e 51 do `7_task.md` citam os nomes antigos dos casos da criação à mão e da renomeação (agora com "(direto no banco)" no meio) | Só documento: atualize as duas citações para o nome atual do caso, para a validação achar o teste |
| test-engineer (2ª) | A ordem (a) do gerar acesso ainda depende da API dentro da janela de 1 s (`importacao-alunos.int.test.ts:460-466`) | Retro (risco menor que o de antes); `TODO.md` se o caso ficar intermitente na esteira |
| revisor-geral (2ª), infra-guardian (2ª) | `turmasDoAno` lido duas vezes no passo (3); medir o passo (3) no staging; `requireEscolaId()` duas vezes; enum fechado de `codigoDeLinha` | Já na tabela da rodada 1 (mesmos destinos) |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-03 23:02:14 | 2026-11-03 23:02:41 | `conformidade-reviewer` | 1 | APROVADO | ad4e8b6e1e2db4040 |
| 2026-11-03 23:02:03 | 2026-11-03 23:03:02 | `tenancy-guardian` | 1 | APROVADO | a8ceffd25554ce51c |
| 2026-11-03 23:02:05 | 2026-11-03 23:03:10 | `privacy-guardian` | 1 | APROVADO | a9bcc5fa0618568a3 |
| 2026-11-03 23:02:12 | 2026-11-03 23:03:53 | `revisor-geral` | 1 | APROVADO | a597110041f67d21c |
| 2026-11-03 23:02:07 | 2026-11-03 23:04:12 | `infra-guardian` | 1 | APROVADO | adfb2d8d8117b7060 |
| 2026-11-03 23:02:09 | 2026-11-03 23:06:00 | `test-engineer` | 1 | REPROVADO | a2d34689c18bb559b |
| 2026-11-03 23:18:43 | 2026-11-03 23:19:01 | `tenancy-guardian` | 2 | APROVADO | a9b5b1ea6772f0358 |
| 2026-11-03 23:18:48 | 2026-11-03 23:19:08 | `privacy-guardian` | 2 | APROVADO | a150c13b56f617ab8 |
| 2026-11-03 23:19:04 | 2026-11-03 23:19:21 | `conformidade-reviewer` | 2 | APROVADO | affc38e3866dae8b9 |
| 2026-11-03 23:18:58 | 2026-11-03 23:19:33 | `revisor-geral` | 2 | APROVADO | a2447cf229ab43500 |
| 2026-11-03 23:18:53 | 2026-11-03 23:19:57 | `infra-guardian` | 2 | APROVADO | a9d660479c914dfe5 |
| 2026-11-03 23:18:38 | 2026-11-03 23:20:40 | `test-engineer` | 2 | APROVADO | a140bf77048510f59 |
