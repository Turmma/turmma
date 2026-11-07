# Tarefa 8.0 — Os itens do dia na Semana e "Ver a semana desta turma"

**Funcionalidade:** semana-do-professor · **Depende de:** 3.0, 6.0
**Subagentes obrigatórios:** `frontend-reviewer`, `conformidade-reviewer`, `test-engineer`
**Porte:** pequeno

## Objetivo

Cada dia da Semana mostra o que aconteceu em cada turma e disciplina da professora (atividade aplicada, encerrada, correção
com o estado), cada item levando ao lugar dele; o Hoje da turma aberta ganha "Ver a semana desta turma".

## Contexto necessário

- `techspec.md` seção 9 ("Itens") e 7b; `cenarios.md` T5, T6
- `prd.md` RF4 e RF7
- `docs/interface.md` 1.8 (6.0): medidas e textos; não edite
- `.claude/rules/70`, item 7: nada de nota, acerto ou nome de aluno no item
- Os rótulos estão em `packages/shared/src/semana/` (2.0); esta tarefa não toca `packages/shared`
- `apps/web/src/paths.ts:64` (`caminhoDaCorrecaoDoProfessor`) e a aba `?aba=atividades&atividade=<id>` da turma aberta (`Turma.test.tsx:104`)
- `apps/web/src/areas/professor/turmas/TurmaHoje.tsx`

## Subtarefas

- [x] 8.1 — `ItensDoDia` embaixo das aulas do dia, com os rótulos de `packages/shared`, filtrados pelo `?turma=`
- [x] 8.2 — O item da atividade leva ao painel da atividade na turma; o da correção, à revisão (o endereço do sino)
- [x] 8.3 — "Ver a semana desta turma" no `TurmaHoje`, para `?ver=semana&turma=<turmaId>.<disciplinaId>`
- [x] 8.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/areas/professor/turmas/semana/ItensDoDia.tsx`, `apps/web/src/areas/professor/turmas/semana/ItensDoDia.test.tsx` | novo |
| `apps/web/src/areas/professor/turmas/semana/DiaDaSemana.tsx` | alterado |
| `apps/web/src/areas/professor/turmas/TurmaHoje.tsx`, `apps/web/src/areas/professor/turmas/TurmaHoje.test.tsx` | alterado |
| `e2e/professor-semana-itens.spec.ts` | novo |
| `apps/web/src/areas/professor/turmas/semana/semana.ts`, `semana.test.ts`, `Semana.tsx`, `Semana.test.tsx` | alterado: o filtro corta os itens, o vazio os conta, as opções do filtro e os links de Hoje saem de uma função só, e o endereço de cada item |
| `e2e/support/atividade-db.ts` | alterado: `ProfessoraApiClient.encerrar` (só encerra, a correção fica pendente); `encerrarEAprovar` o chama |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| T6: o item da atividade abre o painel da atividade na turma certa | e2e | RF7 | `e2e/professor-semana-itens.spec.ts` › T6: o item da atividade abre o painel dela na turma certa |
| T6: o item da correção abre a revisão | e2e | RF7 | `e2e/professor-semana-itens.spec.ts` › T6: o item da correção abre a revisão da correção |
| T5: "Ver a semana desta turma" leva à Semana só com a turma | e2e | RF4 | `e2e/professor-semana-itens.spec.ts` › T5: o link leva à Semana só com a turma e disciplina |
| turma aberta com duas disciplinas da professora: o link leva a da turma aberta | e2e | disciplina | `e2e/professor-semana-itens.spec.ts` › T5: a turma aberta com duas disciplinas da professora tem um link para cada |
| os rótulos vêm da tabela de `packages/shared`, sem texto local | unidade | uma fonte | `ItensDoDia.test.tsx` › cada tipo e cada estado de correção mostram o rótulo da tabela |
| nenhuma palavra de `VOCABULARIO_DE_NOTA` nem nome de aluno nos itens | e2e | regra 70, item 7 | `e2e/professor-semana-itens.spec.ts` › os três itens têm nome acessível (tipo, estado, título) e alvo de 24 × 24; sem palavra de nota nem nome de aluno |
| com `?turma=`, os itens de outra turma ou disciplina somem (o e2e prova um item de outra turma e disciplina; cada cláusula sozinha, `semana.test.ts`) | e2e | filtro | `e2e/professor-semana-itens.spec.ts` › com `?turma=`, o item de outra turma, que também é de outra disciplina, some junto das aulas |
| item é link com nome acessível (tipo, título, estado) e alvo de 24 × 24 | e2e | acessibilidade | `e2e/professor-semana-itens.spec.ts` › os três itens têm nome acessível (tipo, estado, título) e alvo de 24 × 24 |
| o link do item clicado duas vezes abre o painel uma vez | e2e | mesma entrada | `e2e/professor-semana-itens.spec.ts` › T6: o item da atividade abre o painel dela na turma certa; clicado duas vezes, abre o painel uma vez |
| cabe a 1366 × 768 com itens: `soOPainelDaAbaRola` | e2e | RF22 | `e2e/professor-semana-itens.spec.ts` › a 1366 × 768 só o painel da aba rola, e a 360 px não há rolagem de lado |
| 360 px com itens, sem rolagem horizontal | e2e (`celular`) | D51 | o mesmo caso, no projeto `celular` (`horizontalOverflow` zero, com o item à vista) |

Recomeço: a segunda pessoa, a resposta atrasada e a falha vêm do mesmo `GET` e já estão provadas na 6.0; diga isso em meia
linha no plano.

## Como testar

- Atividade e lote de verdade: `criarAtividadeNoBanco` (`e2e/support/atividade-db.ts:47`)
- O caminho para a correção: `e2e/professor-turma-aberta.spec.ts › com lote aprovado, Atividades mostra a atividade encerrada e o caminho para a correção`
- Vocabulário e altura: `VOCABULARIO_DE_NOTA` e `soOPainelDaAbaRola` (`e2e/support/professor/scenario.ts`)
- Unidade do Hoje: `apps/web/src/areas/professor/turmas/TurmaHoje.test.tsx`
- Comando: `node tools/ci/e2e.ts --manter-ambiente e2e/professor-semana-itens.spec.ts`
- Telas: `professora`, `/professor/turmas?ver=semana` com itens; `/professor/turmas/<id>` (Hoje) com o link

## Autoconferência

As 12 perguntas do modelo, no plano. Na 2: "Ver a semana desta turma" é texto novo; procure os specs do Hoje que contam links.

**Plano e respostas (Implementador).** Recomeço: a segunda pessoa, a resposta atrasada e a falha vêm do mesmo `GET /v1/semana` e já estão
provadas na 6.0; a 8.0 não lê nada novo da semana. Arquivos: `ItensDoDia.tsx` (novo), `DiaDaSemana.tsx`, `semana.ts` (filtro dos itens, vazio, a função única
das turmas e disciplinas, o endereço de cada item), `Semana.tsx` (usa a função única), `TurmaHoje.tsx` (os links) e o spec novo.

1. As mutações estão na seção "Mutações": uma por cláusula (`--faltando` zerado), inclusive as duas do filtro, as três do `?:` e do `&&` de Hoje e o `?? []`.
2. "Ver a semana desta turma" só existe em `TurmaHoje.tsx` e no spec novo (`grep -rln 'Ver a semana desta turma' e2e apps` não acha outro). Os specs do Hoje que contam links
   olham dentro da região "Sinais da turma" ou "Voltar para Turmas", fora da fileira nova; rodei isolados `professor-turma-aberta`, `professor-tutor`, `professor-turmas` e `casca`.
3. O segundo dado: o filtro tem item de outra turma **e** de outra disciplina na mesma turma (cada um corta uma cláusula); Hoje tem vínculo de outra turma, pendente e sem disciplina.
4. Nenhuma checagem anterior responde antes: o e2e abre o Hoje já com os vínculos confirmados, e a unidade responde `meus-vinculos` direto.
5. As asserções olham o que a professora vê: o nome e o endereço do link, a Semana depois do clique, os cartões que ficam e os que somem; nenhuma lê texto de arquivo.
6. Sem guarda nova (regra de lint, teste estrutural).
7. Os comentários novos dizem o que o código faz (a fileira some sem vínculo; o vazio conta os itens).
8. As duas divergências estão na tabela e na `techspec.md` §9, com a palavra do código (`turmasEDisciplinasDosVinculos`, `diasFiltrados`, `vazioDaSemana`) e em `cenarios.md` T5; nenhuma trava, rota ou gravação nova.
9. Reaproveitei `rotuloDoItem` e `ROTULOS_DA_SEMANA` (`packages/shared`), `caminhoDaCorrecaoDoProfessor` (`paths.ts`), `meusVinculosQueryOptions` e `ProfessoraApiClient`/`responderPelaApi`; a regra das opções do filtro saiu do hook para a função única.
10. Nada novo roda em duas vias ao mesmo tempo: o clique duplo do item é um caso (o Voltar volta à Semana, uma entrada só) e a releitura do `GET` é da 6.0.
11. Cada linha da tabela de testes tem o caso na coluna "Caso"; as duas de "painel de uma vez" e "nome e alvo" dividem um caso cada, que afirma as duas coisas.
12. `frontend-reviewer`: tela vista nas fotos da vitrine; `conformidade-reviewer`: item sem nota, acerto nem nome (caso de vocabulário e de aluno), sem contagem de itens (D64). O `achados/indice.md` não tem linha da 8.0.

## Fora do escopo desta tarefa

A leitura dos itens (3.0); o painel da aula (7.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| A turma aberta não tem disciplina e o filtro é `<turmaId>.<disciplinaId>`: o Hoje mostra um link por vínculo confirmado com disciplina na turma (`turmasEDisciplinasDosVinculos`, a mesma regra das opções do filtro), "Ver a semana desta turma" com um e "Ver a semana desta turma · <disciplina>" com dois ou mais; sem vínculo lido, nenhum link | A spec dizia só "Hoje ganha o link" e o endereço exige a disciplina; decisão do Arquiteto, 06/11/2026 (opção a) | `techspec.md` §9, "Itens" (`turmasEDisciplinasDosVinculos`); `cenarios.md` T5 |
| A semana sem aula mas com item não é vazio (`vazioDaSemana` conta `dia.itens`), e o filtro `?turma=` corta também os itens (`diasFiltrados`) | Os itens são de dias que a semana traz, e uma semana só com a atividade de quarta mostraria "Sem aulas nesta semana" escondendo o item; o filtro do RF4 e da 6.0 vale para tudo o que o dia mostra | `techspec.md` §9, "Itens" (`diasFiltrados`, `vazioDaSemana`); `cenarios.md` T6 |

## Mutações

--faltando: 0 linhas (23 blocos, 0 motivos)

O vínculo confirmado e com disciplina vira opção: o ramo que o transforma em valor, turma, disciplina e rótulo.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › só o vínculo confirmado e com disciplina entra
-    ? [{ valor: `${vinculo.turma.id}.${vinculo.disciplina.id}`, turmaId: vinculo.turma.id, disciplina: vinculo.disciplina.nome, rotulo: `${vinculo.turma.nome} · ${vinculo.disciplina.nome}` }]
+    ? []
```

O filtro `?turma=` corta também os itens do dia.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › os itens do dia seguem o mesmo filtro
-  return dias.map((dia) => ({ ...dia, aulas: dia.aulas.filter(doFiltro), itens: dia.itens.filter(doFiltro) }))
+  return dias.map((dia) => ({ ...dia, aulas: dia.aulas.filter(doFiltro), itens: dia.itens }))
```

O item de outra turma, com a mesma disciplina, não passa no filtro.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › os itens do dia seguem o mesmo filtro
-  const doFiltro = (alvo: { readonly turmaId: string; readonly disciplinaId: string }) => alvo.turmaId === filtro.turmaId && alvo.disciplinaId === filtro.disciplinaId
+  const doFiltro = (alvo: { readonly turmaId: string; readonly disciplinaId: string }) => alvo.disciplinaId === filtro.disciplinaId
```

O item de outra disciplina, na mesma turma, não passa no filtro.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › os itens do dia seguem o mesmo filtro
-  const doFiltro = (alvo: { readonly turmaId: string; readonly disciplinaId: string }) => alvo.turmaId === filtro.turmaId && alvo.disciplinaId === filtro.disciplinaId
+  const doFiltro = (alvo: { readonly turmaId: string; readonly disciplinaId: string }) => alvo.turmaId === filtro.turmaId
```

Só o vínculo confirmado dá aula: o pendente não vira opção nem link.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › só o vínculo confirmado e com disciplina entra
-    vinculo.estado === 'confirmado' && vinculo.disciplina !== undefined
+    vinculo.disciplina !== undefined
```

O vínculo sem disciplina não vira opção nem link (sem a guarda, a leitura de `disciplina.id` quebra o caso).

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › só o vínculo confirmado e com disciplina entra
-    vinculo.estado === 'confirmado' && vinculo.disciplina !== undefined
+    vinculo.estado === 'confirmado'
```

O link de Hoje leva à Semana filtrada, e não à Semana inteira.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › o endereço da semana da turma leva só
-  return enderecoDaSemana(PROFESSOR_ROUTES.turmas, '', { turma: valorDoFiltro })
+  return enderecoDaSemana(PROFESSOR_ROUTES.turmas, '', {})
```

A correção abre a revisão, e a atividade abre o painel dela.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › a atividade aplicada e a encerrada abrem o painel
-  if (item.tipo === 'correcao') return caminhoDaCorrecaoDoProfessor(item.atividadeAplicadaId)
+  if (item.tipo === 'aplicada') return caminhoDaCorrecaoDoProfessor(item.atividadeAplicadaId)
```

O painel da atividade abre na aba Atividades.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › a atividade aplicada e a encerrada abrem o painel
-  return `${caminhoDaTurmaDoProfessor(item.turmaId)}?${new URLSearchParams({ aba: 'atividades', atividade: item.atividadeAplicadaId }).toString()}`
+  return `${caminhoDaTurmaDoProfessor(item.turmaId)}?${new URLSearchParams({ atividade: item.atividadeAplicadaId }).toString()}`
```

A semana com item e sem aula não é vazia: sem a cláusula, o vazio esconde o item.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › a semana inteira de recesso diz o recesso
-  if (dias.some((dia) => dia.aulas.length > 0 || dia.eventos.length > 0 || dia.itens.length > 0)) return undefined
+  if (dias.some((dia) => dia.aulas.length > 0 || dia.eventos.length > 0)) return undefined
```

O nome acessível do item vem de `nomeDoItem`, "tipo · estado: título".

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/ItensDoDia.tsx
teste: apps/web/src/areas/professor/turmas/semana/ItensDoDia.test.tsx › cada item é um link com o nome
-            aria-label={nomeDoItem(item)}
+            aria-label={item.titulo}
```

A correção do Assistente diz no nome acessível que é gerada por IA, e só ela (o `aria-label` esconde o selo do leitor de tela).

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › o nome acessível do item do dia
-  return `${rotuloDoItem(item)}${item.tipo === 'correcao' ? ', gerado por inteligência artificial' : ''}: ${item.titulo}`
+  return `${rotuloDoItem(item)}: ${item.titulo}`
```

O rótulo visível vem da tabela de `packages/shared`, e não de texto local.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/ItensDoDia.tsx
teste: apps/web/src/areas/professor/turmas/semana/ItensDoDia.test.tsx › cada tipo e cada estado de correção mostram o rótulo da tabela
-              <span className="t-selo text-apoio">{rotuloDoItem(item)}</span>
+              <span className="t-selo text-apoio">{item.tipo}</span>
```

Cada item leva ao lugar dele.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/ItensDoDia.tsx
teste: apps/web/src/areas/professor/turmas/semana/ItensDoDia.test.tsx › cada item é um link com o nome
-            to={enderecoDoItem(item)}
+            to="/"
```

A correção do Assistente leva o selo "IA", e só ela.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/ItensDoDia.tsx
teste: apps/web/src/areas/professor/turmas/semana/ItensDoDia.test.tsx › só a correção do Assistente leva o selo
-              {item.tipo === 'correcao' && <AIBadge />}
+              {item.tipo !== 'correcao' && <AIBadge />}
```

O dia sem item não ganha lista vazia.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/DiaDaSemana.tsx
teste: apps/web/src/areas/professor/turmas/semana/Semana.test.tsx › os itens ficam no dia deles
-      {dia.itens.length > 0 && <ItensDoDia itens={dia.itens} />}
+      {true && <ItensDoDia itens={dia.itens} />}
```

A leitura dos vínculos que ainda não chegou não derruba o Hoje: sem o `?? []` o `flatMap` quebra o primeiro desenho.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/TurmaHoje.tsx
teste: apps/web/src/areas/professor/turmas/TurmaHoje.test.tsx › sem vínculo confirmado, ou com a leitura em erro
-  const semanasDaTurma = turmasEDisciplinasDosVinculos(vinculos.data?.pages.flatMap((pagina) => pagina.itens) ?? []).filter((opcao) => opcao.turmaId === turmaId)
+  const semanasDaTurma = turmasEDisciplinasDosVinculos(vinculos.data?.pages.flatMap((pagina) => pagina.itens)).filter((opcao) => opcao.turmaId === turmaId)
```

O vínculo de outra turma não vira link do Hoje desta.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/TurmaHoje.tsx
teste: apps/web/src/areas/professor/turmas/TurmaHoje.test.tsx › o vínculo de outra turma, o pendente e o sem disciplina não geram link
-  const semanasDaTurma = turmasEDisciplinasDosVinculos(vinculos.data?.pages.flatMap((pagina) => pagina.itens) ?? []).filter((opcao) => opcao.turmaId === turmaId)
+  const semanasDaTurma = turmasEDisciplinasDosVinculos(vinculos.data?.pages.flatMap((pagina) => pagina.itens) ?? [])
```

Sem link, a fileira não existe (não sobra o espaço vazio entre as seções).

```mutacao
arquivo: apps/web/src/areas/professor/turmas/TurmaHoje.tsx
teste: apps/web/src/areas/professor/turmas/TurmaHoje.test.tsx › sem vínculo confirmado, ou com a leitura em erro
-      {semanasDaTurma.length > 0 && (
+      {true && (
```

Com uma disciplina o texto é "Ver a semana desta turma", sem a disciplina.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/TurmaHoje.tsx
teste: apps/web/src/areas/professor/turmas/TurmaHoje.test.tsx › uma disciplina confirmada nesta turma
-              {semanasDaTurma.length === 1 ? 'Ver a semana desta turma' : `Ver a semana desta turma · ${opcao.disciplina}`}
+              {false ? 'Ver a semana desta turma' : `Ver a semana desta turma · ${opcao.disciplina}`}
```

Com duas disciplinas cada link diz a sua.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/TurmaHoje.tsx
teste: apps/web/src/areas/professor/turmas/TurmaHoje.test.tsx › duas disciplinas confirmadas na turma
-              {semanasDaTurma.length === 1 ? 'Ver a semana desta turma' : `Ver a semana desta turma · ${opcao.disciplina}`}
+              {true ? 'Ver a semana desta turma' : `Ver a semana desta turma · ${opcao.disciplina}`}
```

O destino do link leva a turma e a disciplina dele.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/TurmaHoje.tsx
teste: apps/web/src/areas/professor/turmas/TurmaHoje.test.tsx › uma disciplina confirmada nesta turma
-            <Link key={opcao.valor} to={enderecoDaSemanaDaTurma(opcao.valor)} className={`${SECONDARY_LINK_CLASSES} text-center`}>
+            <Link key={opcao.valor} to="/turmas?ver=semana" className={`${SECONDARY_LINK_CLASSES} text-center`}>
```

A leitura de vínculos que ainda não chegou deixa o filtro só com "Todas as turmas".

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/Semana.tsx
teste: apps/web/src/areas/professor/turmas/semana/Semana.test.tsx › as opções são "Todas as turmas"
-  const confirmados = turmasEDisciplinasDosVinculos(vinculos.data?.pages.flatMap((pagina) => pagina.itens) ?? [])
+  const confirmados = turmasEDisciplinasDosVinculos(vinculos.data?.pages.flatMap((pagina) => pagina.itens))
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| infra-guardian (1ª) | "O que ela acrescenta de carga é um `GET /v1/meus-vinculos` a cada abertura do Hoje da turma… Não pesa às 10h." | Recusada: é constatação, sem mudança pedida; a leitura é a existente, paginada e em cache de 30 s |
| infra-guardian (1ª) | "O Hoje e o filtro da Semana leem só a primeira página de vínculos, sem `fetchNextPage`… Vale registrar no TODO, porque o problema vem da 6.0" | `TODO.md`, na seção de semana-do-professor (origem 6.0, a 8.0 passou a depender) |
| infra-guardian (1ª) | "a espera pela correção ao encerrar continua sendo um laço com `setTimeout(500)` e sem prazo próprio… Um teto explícito daria uma mensagem de falha mais clara." | Recusada: o laço já tem teto, `if (estado === 'falhou' \| tentativa > 60) throw new Error(`a correção não concluiu: ${estado}`)` em `e2e/support/atividade-db.ts:139`, com mensagem própria |
| privacy-guardian (1ª) | "Vale levar à retro a ideia de um aviso no campo de título, igual ao do painel da aula ("não escreva nome de aluno")." | `TODO.md` (a retro lê o TODO); o campo de título é de outra tarefa, fora de `ItensDoDia` |
| privacy-guardian (1ª) | "falta um teste de unidade que quebre na hora: um caso que confira que as chaves do `itemDoDiaSchema` são exatamente as atuais." | Recusada: o schema é de `packages/shared`, que a 8.0 não toca (`8_task.md`, "Contexto necessário"), e o `cenarios.md` S9 já pede o "contrato com as chaves exatas" (3.0); o e2e e a unidade da 8.0 guardam a tela |
| frontend-reviewer (1ª) | "Estados de carregando e erro do Hoje não existem para o link da semana (a fileira some em silêncio). É aceitável para ação secundária" | Recusada: o próprio revisor a aceita, e a decisão está na divergência 1 da tarefa ("sem vínculo lido, nenhum link") e provada pelo caso "sem vínculo confirmado, ou com a leitura em erro" |
| test-engineer (1ª) | "O e2e depende do relógio real… Se o caso cruzar a meia-noite, principalmente de domingo para segunda, a semana muda entre criar a atividade e abrir a Semana… vale registrar para a retro" | `TODO.md` (retro) |
| test-engineer (1ª) | "atividade aplicada num sábado ou domingo sem aula… esse item não aparece em lugar nenhum da Semana." | Recusada: está especificado, `cenarios.md` S9: "o item de um dia que a semana não traz (fim de semana sem grade, fora do ano) não aparece [U]"; é da 3.0, que a 8.0 não toca |
| test-engineer (1ª) | "A chave `${item.tipo}-${item.atividadeAplicadaId}` (`ItensDoDia.tsx:18`) assume uma correção por atividade por dia… Vale confirmar no contrato." | `TODO.md`: confirmar no contrato da 3.0 (`montar-dias.ts`) se o lote refeito no mesmo dia pode mandar duas correções da mesma atividade |
| conformidade-reviewer (2ª) | "O selo visível diz "IA", e o nome acessível diz "inteligência artificial". Pela WCAG 2.5.3 ("label in name"), é um desvio pequeno, e quem decide é o `frontend-reviewer`." | Recusada: o `frontend-reviewer` (2ª) conferiu `nomeDoItem` e aprovou, sem levantar o ponto; o conformidade diz que "a marca de IA chega ao leitor de tela, e isso basta" |
| revisor-geral (2ª) | "`semana.ts:244` diz "Correção do Assistente · …, gerado por inteligência artificial". O certo seria "gerada"… Se o texto foi copiado do selo IA de propósito… vale um comentário dizendo isso." | Recusada: o texto é o que o selo IA dá ao leitor de tela (`apps/web/src/components/ui/ai/AgentSignature.tsx:18`); trocar o gênero é decisão do texto do selo, que a 8.0 não toca |
| revisor-geral (2ª) | "A seção nova, na linha 2824, entra sem linha em branco antes do título. Isso já vinha da linha 2823: o item P30 está cortado desde o `HEAD`" | Apliquei a linha em branco antes do título da seção nova; o corte do item P30 é do `HEAD` e não é da 8.0 |
| test-engineer (2ª) | "`fileirasVazias()` passa sem testar nada se a estrutura mudar… afirmar, antes, que `raiz` contém o `div[aria-live]`" | `TODO.md` (a próxima tarefa que tocar `TurmaHoje.test.tsx`) |
| test-engineer (2ª) | "O e2e de T5 com duas disciplinas… roda nos dois projetos, mas o comentário fala só do celular." | `TODO.md`, junto da linha anterior |
| infra-guardian (2ª) | "a de paginar `GET /v1/meus-vinculos` com `fetchNextPage` em `turmasEDisciplinasDosVinculos` continua em aberto" | Já está no `TODO.md` (1ª ordem, origem 6.0) |
| privacy-guardian (2ª) | "Vale tirá-lo da retro e pôr na fila da tarefa dona do campo" (o aviso "não escreva nome de aluno" no título) | Já está no `TODO.md` (1ª ordem); o dono do campo é do Arquiteto ou do Orquestrador decidir, fora da 8.0 |
| frontend-reviewer (2ª) | "Quando houver grade importada na vitrine, fotografar a Semana com itens" | `TODO.md` (`tools/vitrine/`: a escola cheia não tem grade nem atividade aplicada) |
| frontend-reviewer (2ª) | A chave do item, o relógio real do e2e e a leitura de vínculos sem `fetchNextPage` | Já estão no `TODO.md` (1ª ordem) |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-07 00:12:18 | 2026-11-07 00:12:44 | `infra-guardian` | 1 | APROVADO | aed7b6fb50433c906 |
| 2026-11-07 00:12:13 | 2026-11-07 00:12:44 | `tenancy-guardian` | 1 | APROVADO | ab2fb46a54d405fa0 |
| 2026-11-07 00:12:16 | 2026-11-07 00:12:47 | `privacy-guardian` | 1 | APROVADO | aae4eaf0a675f6c55 |
| 2026-11-07 00:12:04 | 2026-11-07 00:12:48 | `frontend-reviewer` | 1 | APROVADO | a6637dc4b8a69014d |
| 2026-11-07 00:12:06 | 2026-11-07 00:12:58 | `conformidade-reviewer` | 1 | APROVADO | aebef83621e6de90b |
| 2026-11-07 00:12:11 | 2026-11-07 00:13:17 | `revisor-geral` | 1 | APROVADO | a4799da949d8169a0 |
| 2026-11-07 00:12:09 | 2026-11-07 00:13:49 | `test-engineer` | 1 | APROVADO | a6ef679b8c0f4c3db |
| 2026-11-07 00:45:55 | 2026-11-07 00:46:15 | `conformidade-reviewer` | 2 | APROVADO | a411caa2ae48ad54c |
| 2026-11-07 00:46:09 | 2026-11-07 00:46:19 | `tenancy-guardian` | 2 | APROVADO | a834d73429efafc8f |
| 2026-11-07 00:45:51 | 2026-11-07 00:46:20 | `frontend-reviewer` | 2 | APROVADO | a86d674492d2fb000 |
| 2026-11-07 00:46:18 | 2026-11-07 00:46:33 | `infra-guardian` | 2 | APROVADO | a392c6b49b90da4d3 |
| 2026-11-07 00:46:04 | 2026-11-07 00:46:34 | `revisor-geral` | 2 | APROVADO | ad695215de440a374 |
| 2026-11-07 00:46:13 | 2026-11-07 00:46:35 | `privacy-guardian` | 2 | APROVADO | a870e235dadc47984 |
| 2026-11-07 00:46:00 | 2026-11-07 00:46:49 | `test-engineer` | 2 | APROVADO | a4b985380cb3e89d6 |
