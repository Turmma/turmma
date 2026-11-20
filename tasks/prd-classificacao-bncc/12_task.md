# Tarefa 12.0 — "Sem habilidade" em Turmas, no aluno e no Analista, e o fluxo inteiro passa no e2e

**Funcionalidade:** classificacao-bncc · **Depende de:** 11.0
**Subagentes obrigatórios:** `conformidade-reviewer`, `privacy-guardian`, `frontend-reviewer`
**Porte:** grande

## Objetivo

As leituras de hoje mostram a questão sem habilidade como "Sem habilidade", com a explicação curta, sem inventar código
nem somá-la a outra habilidade; e um e2e percorre o fluxo da funcionalidade: a coordenação corrige, o professor gera, vê a
corrigida, troca e aplica, e Turmas mostra a trocada.

**Três telas numa tarefa, por exceção declarada:** a mudança é a mesma linha de texto nas três, e o e2e as atravessa.

## Contexto necessário

- `techspec.md` §5 "Geração" (`codigo: null`), §9 (a linha "Turmas, aluno, Analista")
- `prd.md` RF7, RF9; o critério de pronto no `tasks.md`
- `cenarios.md` "Telas" (o texto de "Sem habilidade" e o [E] do fluxo)
- `docs/interface.md` §1.7 (Turmas), §2 (aluno), §3 (Analista)
- `.claude/rules/`: 50, 70 (itens 4d e 7)
- Código: `apps/web/src/areas/professor/turmas/alunos-da-turma.ts` (`textoPorHabilidade`), `TurmaHoje.tsx` ("Acerto por
  habilidade"), `apps/web/src/areas/aluno/como-estou-indo.ts` e `ComoEstouIndo.tsx`,
  `apps/web/src/areas/coordenacao/governanca/Analista.tsx`, `apps/api/src/governanca/analista.command.ts` (`porHabilidade`)

## Subtarefas

- [x] 12.1 — "Sem habilidade" com "Esta questão não tem habilidade da BNCC associada." em Turmas (Visão Geral e alunos), no aluno e no Analista; o Analista não junta a linha `null` a nenhuma habilidade nem a usa no alerta
- [x] 12.2 — A Parte A das três telas no `docs/interface.md`
- [x] 12.3 — O e2e do fluxo, nos projetos `chromebook` e `celular`
- [x] 12.4 — O `docs/roteiro-da-demonstracao.md` conferido de novo contra `e2e/roteiro-da-demonstracao.spec.ts`
- [x] 12.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/areas/professor/turmas/alunos-da-turma.ts`, `apps/web/src/areas/professor/turmas/TurmaHoje.tsx`, `apps/web/src/areas/professor/turmas/AlunosDaTurma.test.tsx`, `apps/web/src/areas/professor/turmas/TurmaHoje.test.tsx` | alterado |
| `apps/web/src/areas/aluno/como-estou-indo.ts`, `apps/web/src/areas/aluno/ComoEstouIndo.tsx`, `apps/web/src/areas/aluno/Eu.test.tsx` | alterado |
| `apps/web/src/areas/coordenacao/governanca/Analista.tsx`, `apps/web/src/areas/coordenacao/governanca/Analista.test.tsx`, `apps/api/src/governanca/analista.command.ts`, `apps/api/src/governanca/analista.int.test.ts` | alterado |
| `e2e/classificacao-bncc.spec.ts`, `docs/interface.md`, `docs/roteiro-da-demonstracao.md` | novo e alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| Turmas, `codigo: null` | U | o texto de "Sem habilidade" | `TurmaHoje.test.tsx` › diz a explicação e fala "dessas questões" (e o de zero alunos); `AlunosDaTurma.test.tsx` › a explicação vem uma vez só, abaixo da tabela; `alunos-da-turma.test.ts` › `hasQuestaoSemHabilidade` |
| aluno, `codigo: null` | U | o mesmo texto | `Atividade.test.tsx` › a questão sem habilidade entra no resultado da aluna como "Sem habilidade" (agora com a explicação); `Eu.test.tsx` › a questão sem habilidade conta no "N de M certas" e não vira "Para rever"; a regra é do contrato: `tutor.test.ts` › "a reforçar" é só habilidade com código (`aReforcar: z.array(habilidadeSchema)`, `packages/shared/src/tutor/tutor.ts`) |
| Analista com `codigo: null` | I | não inventa código, não junta, não alerta por ela | `analista.int.test.ts` › a questão sem habilidade, com dado de verdade no banco (`-t "sem habilidade"`): nominal e recorte pelo SQL, sem espião; o alerta pela `conferir`, e `numeros.test.ts` › a medida da questão sem habilidade entra no resumo, mas não vira alerta (10.0), sem banco |
| Analista, tela | U | "Sem habilidade" | `Analista.test.tsx` › a questão sem habilidade entra no recorte como "Sem habilidade"; › o dado nominal da turma mostra a linha sem habilidade (as duas com a explicação) |
| Turmas e aluno | E | `soOPainelDaAbaRola`; `VOCABULARIO_DE_NOTA` | `classificacao-bncc.spec.ts` › Turmas mostra a habilidade trocada…; › a aluna vê o resultado… |
| 360 px | E | 44 px no `celular`, axe | `conferirATela` no fim dos seis casos do `classificacao-bncc.spec.ts` (sem rolar de lado, axe sério, sem vocabulário de nota). Os 44 px: a 12.0 não cria ação nova; as do fluxo ("Trocar", "Deixar sem habilidade") têm a medida em `professor-troca-de-habilidade.spec.ts`, e o spec novo só as toca com `activate`, que não mede |
| uma ação cheia | — | não se aplica: nenhuma ação nova | |
| recomeço: professor A e depois B na mesma aba | E | nada da A | `classificacao-bncc.spec.ts` › recomeço: a professora seguinte entra na mesma aba… (com o controle do cache cheio antes) |
| recomeço: troca de turma com a resposta anterior segurada | E | a anterior não aparece | `professor-turma-alunos.spec.ts` (resposta segurada, da 8.0 de Turmas) já a prova; a 12.0 não muda a troca de turma |
| recomeço: mesma entrada; diálogo | — | não se aplicam: leitura sem link, token nem diálogo | |
| fluxo: a coordenação corrige | E | o painel mostra "Corrigida pela coordenação" | `classificacao-bncc.spec.ts` › a coordenação corrige o capítulo… |
| fluxo: o professor gera | E | a questão traz a corrigida | `classificacao-bncc.spec.ts` › a professora gera a atividade… |
| fluxo: troca e aplica | E | a trocada fica | `classificacao-bncc.spec.ts` › a professora troca a habilidade… e aplica |
| fluxo: Turmas | E | mostra a trocada | `classificacao-bncc.spec.ts` › Turmas mostra a habilidade trocada… |
| fluxo: projetos | E | `chromebook` e `celular`, axe; situação dita em texto | os seis casos do spec rodam nos dois projetos (12 execuções; 36 com `--repeat-each 3`) |
| roteiro | E | conferido passo a passo | `docs/roteiro-da-demonstracao.md` passo 6.4 (as abas Hoje e Alunos) contra `roteiro-da-demonstracao.spec.ts` |

## Como testar

- Turmas: `AlunosDaTurma.test.tsx` › "com dado: os alunos em ordem de nome…" (que hoje lê `QUI.EM.04: 2 de 2`); `TurmaHoje.test.tsx` › "com lote aprovado: uma barra por habilidade…"
- Aluno: `Eu.test.tsx` › "as habilidades a rever vêm como a API mandou: código e descrição, na ordem dela"
- Analista: `analista.int.test.ts` › "o alerta é só o de habilidade com acerto baixo, com o número medido, o limiar e hipótese de lista fechada"; `Analista.test.tsx` › "com dado: assinatura do Analista…"
- Fluxo: `e2e/a3-a4-professor.spec.ts` › "aplica, os alunos respondem, ela encerra…" (o molde do fim); `gerarAtividade` (`e2e/support/professor-flow.ts`)
- Comandos: `npx vitest run --project unidade apps/web/src/areas/professor/turmas/`; `node tools/ci/e2e.ts --manter-ambiente e2e/classificacao-bncc.spec.ts`
- Armadilha: o caso que olha "hoje" ou a semana passa no sábado e às 23h59 de domingo (autoconferência 10)
- Telas: `professora`, Turmas › turma › `text=Visão Geral`; `aluno`, `text=Eu`; `coordenacao`, Governança › `text=Analista`

## Autoconferência

As 12 perguntas do modelo, respondidas no plano.

1. **Mutação de cada cláusula:** a seção "Mutações" tem um bloco por cláusula do diff (`--faltando`: nenhuma linha sem bloco): os dois `detalhe` do Analista e do dado nominal, o `detalhe` do aluno, o `&&` da nota em Alunos, o `hasQuestaoSemHabilidade`, o `alvo` e os dois ramos do `detalheDaHabilidade`, a constante.
2. **O texto novo já aparece em `e2e/`?** `grep -rn "Sem habilidade\|não tem habilidade" e2e/`: só `professor-troca-de-habilidade.spec.ts` (a folha do artefato, que a 12.0 não toca), e o spec novo. Rodado isolado: 12 execuções, 36 com `--repeat-each 3 --workers 2`, o mais lento em 8,4 s.
3. **Segundo dado:** a turma tem três alunas, uma questão com habilidade trocada, uma corrigida e uma sem; a nota só aparece quando alguma linha tem a `null`, e o teste tem as duas situações.
4. **Checagem anterior que responde antes:** o Analista só chega à linha `null` com `recortesComLotes` e `acertosPorRecorte` espiados com as duas linhas; o teste confere as duas linhas separadas e o alerta só da habilidade com código.
5. **A asserção olha o resultado:** contagem da explicação (uma vez) depois de a tela ter lido os dados (`toContainText` do aluno antes), e o controle do cache cheio antes de afirmar a ausência no recomeço.
6. **Guarda nova:** não se aplica, a tarefa não cria regra de lint nem teste estrutural.
7. **Comentário que afirma o que o código não faz:** conferidos o docblock da constante, o do `detalheDaHabilidade` e o do spec; o do spec diz que os casos são em série pelo prazo de 15 s.
8. **Erro e limite novos:** não se aplicam, nenhuma rota nem ação nova.
9. **Estado de servidor e cache:** só leitura de dados que já vinham; nenhum `useState` novo, nenhuma `queryKey` nova.
10. **Tempo (hoje, semana):** o spec não olha "hoje" nem a semana: a Hoje é aberta com lote aprovado e lida pelo texto da região.
11. **Tela:** 360 px, axe e `VOCABULARIO_DE_NOTA` no fim dos seis casos (`conferirATela`); os 44 px são das ações da 11.0, medidos em `professor-troca-de-habilidade.spec.ts`; a explicação é uma frase só, sem cor como único sinal (a barra tem o número no texto).
12. **Documento que a tela cita:** `docs/interface.md` Parte A das quatro telas e o passo 6.4 do roteiro.

## Fora do escopo desta tarefa

A cobertura (13.0).

## Divergências resolvidas nesta tarefa

- **A tela Eu não recebe a questão sem habilidade (D66).** O plano (e a subtarefa 12.1) pedia "Sem habilidade" "no aluno" em `como-estou-indo.ts`/`ComoEstouIndo.tsx`. Na Eu, a lista "Para rever" vem de `habilidadesARever`, que só traz habilidade com código (a memória do Tutor é o trabalho do aluno e só o que tem habilidade vira "Para rever"); a questão sem habilidade conta no "N de M certas" e não ganha linha. O "Sem habilidade" do aluno está no **resultado da atividade** (`Atividade.tsx`), que é onde a API manda `habilidade: null`. `Eu.test.tsx` tem o caso que prova que a Eu não inventa linha nem código. Registrado também na `techspec.md` §9.
- **A explicação mora na web, não em `packages/shared`.** `EXPLICACAO_SEM_HABILIDADE` está em `apps/web/src/components/habilidades/sem-habilidade.ts`; o rótulo `ROTULO_SEM_HABILIDADE` continua em `@educa/shared` (10.0). Mexer em `packages/shared` agora invalidaria o paralelismo com a 13.0, e a frase é só de tela.
- **`apps/api/src/governanca/analista.command.ts` não mudou.** O contrato da 10.0 já devolve `habilidade: null` separado e o alerta já ignora a linha; a 12.0 só ganhou o teste de integração que prova isso.
- **O e2e é em casos em série, com o material no banco.** O caso de e2e tem de caber na metade do prazo (15 s) e o fluxo inteiro não cabe; cada passo é um caso e o material, a escola e as pessoas nascem no banco, como já faz `material.spec.ts`.

## Mutações

```mutacao
arquivo: apps/web/src/areas/aluno/Atividade.tsx
teste: apps/web/src/areas/aluno/Atividade.test.tsx › entra no resultado da aluna como
-                <ProgressBar key={item.habilidade?.codigo ?? 'sem-habilidade'} rotulo={item.habilidade?.descricao ?? ROTULO_SEM_HABILIDADE} valor={item.acertos} maximo={item.total} texto={textoDoAcerto(item.acertos, item.total)} {...(item.habilidade === null ? { detalhe: EXPLICACAO_SEM_HABILIDADE } : {})} />
+                <ProgressBar key={item.habilidade?.codigo ?? 'sem-habilidade'} rotulo={item.habilidade?.descricao ?? ROTULO_SEM_HABILIDADE} valor={item.acertos} maximo={item.total} texto={textoDoAcerto(item.acertos, item.total)} />
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividade.tsx
teste: apps/web/src/areas/aluno/Atividade.test.tsx › entra no resultado da aluna como
-                <ProgressBar key={item.habilidade?.codigo ?? 'sem-habilidade'} rotulo={item.habilidade?.descricao ?? ROTULO_SEM_HABILIDADE} valor={item.acertos} maximo={item.total} texto={textoDoAcerto(item.acertos, item.total)} {...(item.habilidade === null ? { detalhe: EXPLICACAO_SEM_HABILIDADE } : {})} />
+                <ProgressBar key={item.habilidade?.codigo ?? 'sem-habilidade'} rotulo={item.habilidade?.descricao ?? ROTULO_SEM_HABILIDADE} valor={item.acertos} maximo={item.total} texto={textoDoAcerto(item.acertos, item.total)} {...(item.habilidade !== null ? { detalhe: EXPLICACAO_SEM_HABILIDADE } : {})} />
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividade.tsx
teste: apps/web/src/areas/aluno/Atividade.test.tsx › entra no resultado da aluna como
-                <ProgressBar key={item.habilidade?.codigo ?? 'sem-habilidade'} rotulo={item.habilidade?.descricao ?? ROTULO_SEM_HABILIDADE} valor={item.acertos} maximo={item.total} texto={textoDoAcerto(item.acertos, item.total)} {...(item.habilidade === null ? { detalhe: EXPLICACAO_SEM_HABILIDADE } : {})} />
+                <ProgressBar key={item.habilidade?.codigo ?? 'sem-habilidade'} rotulo={item.habilidade?.descricao ?? ''} valor={item.acertos} maximo={item.total} texto={textoDoAcerto(item.acertos, item.total)} {...(item.habilidade === null ? { detalhe: EXPLICACAO_SEM_HABILIDADE } : {})} />
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/governanca/Analista.tsx
teste: apps/web/src/areas/coordenacao/governanca/Analista.test.tsx › entra no recorte como
-                  detalhe={medida.habilidade === null ? EXPLICACAO_SEM_HABILIDADE : medida.habilidade.codigo}
+                  detalhe={medida.habilidade === null ? undefined : medida.habilidade.codigo}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/governanca/Analista.tsx
teste: apps/web/src/areas/coordenacao/governanca/Analista.test.tsx › entra no recorte como
-                  detalhe={medida.habilidade === null ? EXPLICACAO_SEM_HABILIDADE : medida.habilidade.codigo}
+                  detalhe={medida.habilidade === null ? medida.habilidade : EXPLICACAO_SEM_HABILIDADE}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/governanca/DadoNominal.tsx
teste: apps/web/src/areas/coordenacao/governanca/Analista.test.tsx › mostra a linha sem habilidade como
-                    detalhe={medida.habilidade === null ? EXPLICACAO_SEM_HABILIDADE : medida.habilidade.codigo}
+                    detalhe={medida.habilidade === null ? undefined : medida.habilidade.codigo}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/governanca/DadoNominal.tsx
teste: apps/web/src/areas/coordenacao/governanca/Analista.test.tsx › mostra a linha sem habilidade como
-                    detalhe={medida.habilidade === null ? EXPLICACAO_SEM_HABILIDADE : medida.habilidade.codigo}
+                    detalhe={medida.habilidade === null ? medida.habilidade : EXPLICACAO_SEM_HABILIDADE}
```

```mutacao
arquivo: apps/web/src/areas/professor/turmas/AlunosDaTurma.tsx
teste: apps/web/src/areas/professor/turmas/AlunosDaTurma.test.tsx › com dado: os alunos em ordem de nome, e não na de id que a API entrega
-          {hasQuestaoSemHabilidade(linhas) && <p className="t-apoio text-sutil">{NOTA_DA_QUESTAO_SEM_HABILIDADE}</p>}
+          {<p className="t-apoio text-sutil">{NOTA_DA_QUESTAO_SEM_HABILIDADE}</p>}
```

```mutacao
arquivo: apps/web/src/areas/professor/turmas/AlunosDaTurma.tsx
teste: apps/web/src/areas/professor/turmas/AlunosDaTurma.test.tsx › a explicação vem uma vez só, abaixo da tabela, sem código inventado
-          {hasQuestaoSemHabilidade(linhas) && <p className="t-apoio text-sutil">{NOTA_DA_QUESTAO_SEM_HABILIDADE}</p>}
+          {hasQuestaoSemHabilidade(linhas) && ''}
```

```mutacao
arquivo: apps/web/src/areas/professor/turmas/alunos-da-turma.ts
teste: apps/web/src/areas/professor/turmas/AlunosDaTurma.test.tsx › a explicação vem uma vez só, abaixo da tabela, sem código inventado
-export const NOTA_DA_QUESTAO_SEM_HABILIDADE = `${ROTULO_SEM_HABILIDADE}: ${EXPLICACAO_SEM_HABILIDADE}`
+export const NOTA_DA_QUESTAO_SEM_HABILIDADE = `${EXPLICACAO_SEM_HABILIDADE}`
```

```mutacao
arquivo: apps/web/src/areas/professor/turmas/alunos-da-turma.ts
teste: apps/web/src/areas/professor/turmas/alunos-da-turma.test.ts › só vale com alguma linha que tenha a questão sem habilidade
-  return linhas.some((linha) => linha.desempenho?.porHabilidade.some((item) => item.habilidade === null) === true)
+  return linhas.some((linha) => linha.desempenho?.porHabilidade.some((item) => item.habilidade !== null) === true)
```

```mutacao
arquivo: apps/web/src/areas/professor/turmas/alunos-da-turma.ts
teste: apps/web/src/areas/professor/turmas/alunos-da-turma.test.ts › só vale com alguma linha que tenha a questão sem habilidade
-  return linhas.some((linha) => linha.desempenho?.porHabilidade.some((item) => item.habilidade === null) === true)
+  return linhas.some((linha) => linha.desempenho?.porHabilidade.some((item) => item.habilidade === null) !== false)
```

```mutacao
arquivo: apps/web/src/areas/professor/turmas/TurmaHoje.tsx
teste: apps/web/src/areas/professor/turmas/TurmaHoje.test.tsx › diz a explicação e fala "dessas questões"
-  const alvo = item.habilidade === null ? 'dessas questões' : 'das questões desta habilidade'
+  const alvo = 'das questões desta habilidade'
```

```mutacao
arquivo: apps/web/src/areas/professor/turmas/TurmaHoje.tsx
teste: apps/web/src/areas/professor/turmas/TurmaHoje.test.tsx › em que ninguém acertou menos da metade diz a explicação
-      ? `Nenhum aluno acertou menos da metade ${alvo} nas atividades aprovadas.`
+      ? 'Nenhum aluno acertou menos da metade das questões desta habilidade nas atividades aprovadas.'
```

```mutacao
arquivo: apps/web/src/areas/professor/turmas/TurmaHoje.tsx
teste: apps/web/src/areas/professor/turmas/TurmaHoje.test.tsx › diz a explicação e fala "dessas questões"
-  return item.habilidade === null ? `${EXPLICACAO_SEM_HABILIDADE} ${contagem}` : contagem
+  return contagem
```

```mutacao
arquivo: apps/web/src/areas/professor/turmas/TurmaHoje.tsx
teste: apps/web/src/areas/professor/turmas/TurmaHoje.test.tsx › diz a explicação e fala "dessas questões"
-  return item.habilidade === null ? `${EXPLICACAO_SEM_HABILIDADE} ${contagem}` : contagem
+  return item.habilidade === null ? contagem : `${EXPLICACAO_SEM_HABILIDADE} ${contagem}`
```

```mutacao
arquivo: apps/web/src/components/habilidades/sem-habilidade.ts
teste: apps/web/src/areas/aluno/Atividade.test.tsx › entra no resultado da aluna como
-export const EXPLICACAO_SEM_HABILIDADE = 'Esta questão não tem habilidade da BNCC associada.'
+export const EXPLICACAO_SEM_HABILIDADE = 'Esta questão não tem habilidade.'
```

## Telas vistas

Pela vitrine, em computador e celular: Turmas › a turma aberta (Hoje), Eu do aluno e Analista da coordenação. A vitrine não tem questão sem habilidade (as atividades dela são todas classificadas), então as três telas mostram o estado de sempre, sem regressão; o "Sem habilidade" com a explicação nas quatro leituras é provado pelos casos de tela e pelo e2e, que conferem 360 px, axe e vocabulário.

## Recomendações sem aplicar

Da ordem `.processo/ordens/12_task-r1.md`, seção "Sem aplicar", como está:

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| privacy-guardian (1ª) | Matrícula do e2e por `Date.now()`: usar `randomUUID` reduzido | Recusada: a matrícula só precisa ser única dentro da escola, e a escola é a da `professora` criada no `beforeAll` do próprio spec; o índice no fim separa as três alunas. Duas execuções não dividem escola. |
| conformidade-reviewer (1ª), revisor-geral (1ª) | O texto "Esta questão não tem habilidade da BNCC associada." fica no singular sobre barras que somam várias questões (`TurmaHoje.tsx`, a segunda linha) | `TODO.md`, para o Arquiteto: a frase vem do `cenarios.md` "Telas" (RF7/RF9), que o Implementador não muda. O revisor-geral pede uma variante no plural e a entrada dela no `cenarios.md`. |
| conformidade-reviewer (1ª) | Caso de unidade que dê à conferência um alerta com `habilidade: null` e exija a recusa | Já existe: `packages/core/src/ia/tasks/numeros.test.ts` (linhas 760-772), da 10.0, confirmado pelo test-engineer; o item 1 da ordem passa a citá-lo. |
| frontend-reviewer (1ª) | `docs/interface.md` diz que a barra "Sem habilidade" vem "depois das que têm código", e a tela não ordena | 13.0 (cobertura): conferir a ordem que a API entrega. No Analista, `analista.repository.ts` ordena por `habilidade.codigo` (linhas 212 e 299). Em Turmas, a ordem da API não foi conferida. |
| frontend-reviewer (1ª) | Confirmar por execução real que cada mutação de `TurmaHoje.tsx` é pega | Recusada: o portão da tarefa roda cada bloco de "Mutações" (`tools/processo/mutacoes.ts`) e o test-engineer conferiu `--faltando`. |
| frontend-reviewer (1ª) | Em Alunos a 360 px, "Por habilidade" em texto corrido: uma habilidade por linha se ficar longa | `TODO.md`: hoje quebra bem, como nas fotos; não bloqueia. |
| infra-guardian (1ª) | O caso que gera o artefato é o primeiro a conferir contra a metade do prazo (`tools/ci/duracao-do-e2e.ts`) | Já feito: a Autoconferência 2 registra o mais lento em 8,4 s; confira de novo se o item 2 acrescentar `conferirATela`. |
| test-engineer (1ª) | Conferir 360 px e axe do Analista no `celular`, num e2e existente ou neste spec | 13.0 (cobertura): a explicação é a mesma constante das outras telas, já conferida nelas, e o Analista com a linha `null` pede um resumo gerado, fora do fluxo desta tarefa. |

Da ordem `.processo/ordens/12_task-r2.md` (2ª rodada, só "Sem aplicar"):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisor-geral (2ª) | `analista.int.test.ts:394`: trocar `alertaSemHabilidade as never` por `as unknown as (typeof saida.alertas)[number]`, que diz qual tipo se força | Recusada: estilo de teste, sem mudar o que ele prova; recomendação de revisor que aprovou, depois da primeira ordem (`revisar-tarefa` §4). |
| revisor-geral (2ª) | `analista.int.test.ts:376`: o `preparar({ id: randomUUID(), … })` repete a `execucao()` do `describe` (linha 269) | Recusada: mesmo motivo; o caso novo tem escola própria e não divide a `execucao()` do outro bloco. |
| test-engineer (2ª) | Os dois casos da 10.0 que espiam `acertosPorRecorte` e `acertosDaTurma` (`analista.int.test.ts:323` e `:410`) passam a ser lidos como prova da junção: renomear ou apagar | 13.0 (cobertura), que revê os testes da funcionalidade; o caso novo já prova o SQL de ponta a ponta. |
| test-engineer (2ª) | `as never` no alerta inválido: um `safeParse` falhando antes da conferência deixaria explícito que o schema também a recusa | Recusada: aceitável, como o próprio revisor diz; a recusa que importa é a da `conferir`, provada. |
| test-engineer (2ª) | Não rodou `analista.int.test.ts` (o compose `educa-teste-1` estava ocupado); o portão da tarefa precisa ver o caso verde | Não é recomendação de código: o carimbo do portão local é válido para a árvore atual (typecheck, lint, segredo, dependências, unidade, alvo). Conferir no commit que o carimbo cobre o caso de integração. |


## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-20 06:14:49 | 2026-11-20 06:15:22 | `privacy-guardian` | 1 | APROVADO | a351850a0d78ff477 |
| 2026-11-20 06:14:39 | 2026-11-20 06:15:24 | `conformidade-reviewer` | 1 | APROVADO | a065bddd7a874bd4d |
| 2026-11-20 06:14:58 | 2026-11-20 06:15:41 | `frontend-reviewer` | 1 | APROVADO | a8d9dced1f3647e3e |
| 2026-11-20 06:15:27 | 2026-11-20 06:15:47 | `tenancy-guardian` | 1 | APROVADO | a8c9ecdaa25c31dc4 |
| 2026-11-20 06:15:36 | 2026-11-20 06:15:59 | `infra-guardian` | 1 | APROVADO | a561fb41ea4b28254 |
| 2026-11-20 06:15:17 | 2026-11-20 06:16:12 | `revisor-geral` | 1 | APROVADO | a84b73ad4c3d918f5 |
| 2026-11-20 06:15:08 | 2026-11-20 06:18:13 | `test-engineer` | 1 | REPROVADO | a41ca2196fe384e26 |
| 2026-11-20 06:47:18 | 2026-11-20 06:47:44 | `revisor-geral` | 2 | APROVADO | abfe0a912670fc667 |
| 2026-11-20 06:47:11 | 2026-11-20 06:49:11 | `test-engineer` | 2 | APROVADO | ad7da011bbd154aab |
