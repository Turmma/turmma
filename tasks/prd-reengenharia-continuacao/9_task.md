# Tarefa 9.0 — A professora vê quantas perguntas o Tutor não respondeu hoje, sem o texto

**Funcionalidade:** reengenharia-continuacao · **Depende de:** 8.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `frontend-reviewer`
**Porte:** grande

## Objetivo

O `GET /v1/tutor/uso` ganha, por aluno, `semRespostaHoje`: as perguntas de hoje terminadas num código de `PASSAGEIROS`,
sem mensagem fixa, no recorte das `ultimasTrocas`, sem texto. Na aba do Tutor da turma, a linha diz "N perguntas que o
Tutor não respondeu hoje", neutra e separada do freio (D8, D47).

## Contexto necessário

- `techspec.md` §2 (linha `supervisao.repository.ts`), §4, §5 "A pergunta sem resposta (RF5)", §7b
- `prd.md` RF5; §8b; regras 10, 20 (4, 14), 40, 50, 70 (4, 7)
- Código: `apps/api/src/tutor/supervisao.repository.ts` (`ultimasTrocas` l.220, `FUSO_DO_USO` l.267);
  `apps/api/src/tutor/supervisao.service.ts`; `packages/shared/src/tutor/uso.ts` (`trocasHoje` l.39);
  `packages/shared/src/tutor/passageiros.ts` (4.0); `apps/web/src/areas/professor/turmas/TurmaHoje.tsx` (o uso com `?ver=tutor`);
  `docs/lgpd.md:52` ("Uso do Tutor por aluno"); `docs/aia/tutor.md` (N21)

## Subtarefas

- [x] 9.1 — `semRespostaHoje` no repository (§5); a última pergunta passa a incluí-las
- [x] 9.2 — `semRespostaHoje` no `usoDoTutorSchema` de `shared`, e no DTO de saída
- [x] 9.3 — A linha do aluno em `TurmaHoje.tsx`; com 0, nada
- [x] 9.4 — `docs/lgpd.md:52` e a N21 da AIA dizem que a professora vê a contagem, sem texto; `docs/interface.md`, a aba do
  Tutor na turma
- [x] 9.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/src/tutor/sem-resposta.int.test.ts` | novo |
| `apps/api/src/tutor/supervisao.repository.ts`, `apps/api/src/tutor/supervisao.service.ts`, `packages/shared/src/tutor/uso.ts`, `apps/web/src/areas/professor/turmas/TurmaHoje.tsx`, `apps/web/src/areas/professor/turmas/TurmaHoje.test.tsx`, `e2e/a3-a4-professor.spec.ts`, `apps/api/test/contracts.test.ts`, `docs/lgpd.md`, `docs/aia/tutor.md`, `docs/interface.md`, `docs/mvp-contratos.md`, `docs/runbook.md`, `apps/web/src/areas/professor/turmas/sinais.ts`, `apps/web/src/areas/professor/turmas/sinais.test.ts`, `packages/shared/src/tutor/tutor.test.ts`, `apps/api/src/tutor/tutor.int.test.ts`, `e2e/professor-tutor.spec.ts` (o mock do uso ganha o campo), `e2e/support/db-assertions.ts`, `e2e/support/professor/tutor.ts` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| contagem | I | duas cortadas e uma respondida: `semRespostaHoje` 2, `trocasHoje` 1, sem texto no DTO; o aluno só com cortada aparece. Mutação: manter o filtro de `falhou` | `apps/api/src/tutor/sem-resposta.int.test.ts` › duas cortadas e uma respondida: semRespostaHoje 2, trocasHoje 1, sem o texto da pergunta nem o código no DTO; o aluno que só teve pergunta cortada aparece |
| os outros passageiros | I | um de cada: `EXECUCAO_INTERROMPIDA`, `IA_TEMPO_ESGOTADO`, `IA_SAIDA_INVALIDA`, `PEDIDO_ACIMA_DO_TETO`, a recusa da D62. Mutações: contar só o corte; só `IA_INDISPONIVEL` | `apps/api/src/tutor/sem-resposta.int.test.ts` › %s no worker: a pergunta conta como sem resposta, e não como troca (um caso por `IA_INDISPONIVEL`, que é a recusa da D62, `IA_TEMPO_ESGOTADO`, `IA_SAIDA_INVALIDA`, `PEDIDO_ACIMA_DO_TETO`); › a reentrega interrompida (EXECUCAO_INTERROMPIDA): …; › o worker de IA parado (a D62 não conferida, ou a fila sem consumidor): … › a pergunta cortada pelo GET da execução (IA_INDISPONIVEL, em PASSAGEIROS) conta |
| a lista inteira | I | parametrizado sobre `PASSAGEIROS` importada, sem filtro: cada código, inclusive `ERRO_INTERNO` e `IA_ENTRADA_INVALIDA`, dá +1. Mutação: lista copiada no repository | `apps/api/src/tutor/sem-resposta.int.test.ts` › %s, sem filtro nenhum: a pergunta conta, e o aluno só com ela aparece; › uma de cada código da lista importada: a soma é o tamanho dela, ERRO_INTERNO e IA_ENTRADA_INVALIDA inclusive |
| o dia | I | "agora" às 10h de Brasília; cortada ontem às 23h50: não conta. Mutações: sem o filtro de dia; o dia em UTC | `apps/api/src/tutor/sem-resposta.int.test.ts` › às 10h de Brasília, a cortada ontem às 23h50 não conta, e as de hoje contam, a da meia-noite e cinco também; › no domingo, às 23h59 de Brasília (já segunda em UTC): vale o dia de Brasília, e a de sábado às 23h50 não conta |
| não contam | I | S12, `FUNCAO_SUSPENSA`, `NAO_ENCONTRADO` e a que recebeu a mensagem fixa. Mutação: contar todo `falhou` | `apps/api/src/tutor/sem-resposta.int.test.ts` › a avaliação que abre depois do 202 (S12): …; › a função suspensa depois do 202 (FUNCAO_SUSPENSA): …; › o vínculo do aluno encerrado depois do 202 (NAO_ENCONTRADO): …; › a pergunta que recebeu a mensagem fixa (D36), com a execução já encerrada pela varredura: …; › nenhum outro código de erro conta: com a pergunta respondida ao lado, o aluno aparece e a contagem fica em zero |
| o recorte | I | outra disciplina, outra turma, ano anterior: não aparece; duas disciplinas na turma: as duas. Mutação: tirar o recorte | `apps/api/src/tutor/sem-resposta.int.test.ts` › na mesma turma, a cortada em Física não aparece para a professora de Química, e a de Química não aparece para a de Física (a de atividade e a de material); › a professora com Química e Física na mesma turma vê as cortadas das duas, e a de uma terceira disciplina não aparece; › o ano anterior: a cortada de uma turma de 2025 não aparece no ano em curso, …; › o aluno transferido hoje (outra turma, a antiga) |
| aluno transferido hoje | I | a pergunta cortada na turma antiga não aparece na nova | `apps/api/src/tutor/sem-resposta.int.test.ts` › o aluno transferido hoje: a cortada na turma antiga não aparece na turma nova, mesmo para a professora das duas |
| reenviada | I | a cortada conta, a reenviada e respondida entra em `trocasHoje` | `apps/api/src/tutor/sem-resposta.int.test.ts` › a cortada e depois reenviada pelo "Tentar de novo" e respondida: a cortada conta, a reenviada entra em trocasHoje |
| isolamento | I | a cortada de um aluno da B, com a professora da A: não aparece; o `GET` da B igual ao inexistente | `apps/api/src/tutor/sem-resposta.int.test.ts` › a cortada de um aluno da escola B, com a professora da A: não aparece, o GET da turma de B responde como o inexistente, e a leitura do repository vem vazia; › sem aluno nenhum a ler, devolve vazio |
| contrato | U | `contracts.test.ts`: o DTO só com os campos declarados | `apps/api/test/contracts.test.ts` › reengenharia-continuacao 9.0: `GET /v1/tutor/uso` entra na varredura e traz, por aluno, só os campos declarados…; `packages/shared/src/tutor/tutor.test.ts` › as perguntas sem resposta de hoje são só um número inteiro…; › por aluno: as trocas do dia… |
| a linha | U | "2 perguntas que o Tutor não respondeu hoje", neutra, separada do "X de Y"; com 0, nada | `apps/web/src/areas/professor/turmas/TurmaHoje.test.tsx` › a linha do aluno diz "2 perguntas que o Tutor não respondeu hoje", neutra e à parte do "12 de 60", e a de quem tem zero não diz nada; › uma pergunta sem resposta fica no singular, e com zero em todos a tabela não tem a frase; `apps/web/src/areas/professor/turmas/sinais.test.ts` › as perguntas sem resposta: o número no plural e no singular, e nada com zero |
| 1366 × 768 e 360 px | E | a aba do Tutor da turma com a linha: `soOPainelDaAbaRola` a 1366; sem rolagem horizontal, 44 px, axe a 360; `VOCABULARIO_DE_NOTA`. O uso vem de `page.route` (no `a3-a4`, da API de verdade) | `e2e/a3-a4-professor.spec.ts` › aplica, os alunos respondem, ela encerra… e o sinal do Tutor no Seu time (roda nos dois projetos, `chromebook` e `celular`; a pergunta sem resposta é semeada no banco e o uso é o da API de verdade, ver Divergências) |

## Como testar

- Uso: `apps/api/src/tutor/tutor.int.test.ts` › "a professora vê quem usou, em ordem de nome, com as trocas do dia e a última
  referência…" (l.786); recorte: › "a professora com Química e Física na mesma turma vê os sinais e o uso das duas…" (l.1033)
  e › "a professora com vínculo confirmado na turma do ano anterior não lê…" (l.1015)
- Isolamento: › "sinais e uso: a professora de outra turma, a de outra escola, a coordenação e o aluno recebem a resposta do
  inexistente" (l.887)
- As falhas se semeiam pelo caminho real (a bancada da 5.0), salvo a lista parametrizada
- Tela: `TurmaHoje.test.tsx` › "sem `?ver=tutor` só a leitura dos sinais é do Tutor…" (l.446); `e2e/support/professor/scenario.ts`
  (`soOPainelDaAbaRola`, `VOCABULARIO_DE_NOTA`)
- Comando: `npx vitest run --project integracao apps/api/src/tutor/sem-resposta.int.test.ts`
- **Telas:** `professora`, a turma com `?ver=tutor`, um aluno com 2 sem resposta e outro com 0

## Autoconferência

As 12 perguntas do modelo, respondidas no plano (9.0). Na 3: aluno com pergunta em cada código e em cada estado. Na 5: o "com 0, nada" espera
a resposta do uso. Na 10: o caso do dia passa às 23h59 e no domingo.

1. **Mutação de cada cláusula:** a seção "Mutações" tem um bloco por termo do `where` da `#semResposta` que o teste alcança (o `id` da execução, a lista `PASSAGEIROS`, a cópia dela, a mensagem fixa pelo `execucaoId` e pelo `tipo`, o `exists` e o `notExists` do `sql`), pelos dois termos de `semDisciplina`, pelos dois ramos do recorte, pelos dois termos do `or` de `ultimasTrocas` e pelo recorte lá e em `semRespostaDeHoje`, pelas cláusulas de escola, de ano, de turma, do aluno e do dia de `semRespostaDeHoje`, e pela chamada `this.#semResposta()` e pela `this.#recorteDoProfessor()` do mesmo `where` (uma por linha e sem operador, que o `--faltando` não vê), pela passagem de `alunos` e pelo `?? 0` do service, pelos dois campos do schema (`.int()` e `.nonnegative()`) e o próprio campo, e, na tela, pelo `if` do zero, o singular, a condição do JSX, o span, a célula e o `block` (esse no e2e). Os termos sem teste que os alcance estão com o motivo escrito na seção (a chave composta da execução já separa as escolas; `estado = 'falhou'` é redundante com o código de erro; o `autor` de `semRespostaDeHoje` repete o que a exclusão da mensagem fixa já faz).
2. **Texto na tela:** "N perguntas que o Tutor não respondeu hoje" é novo: `grep -rln 'não respondeu hoje' e2e/ apps/web/src` acha só o `e2e/a3-a4-professor.spec.ts` e os testes de unidade. Os outros e2e que contam a célula "Trocas hoje" ou o "de 60" são do aluno (`aluno-fluxo`, `aluno-tutor`, `components-gallery`) e não passam por esta tela. Os specs `e2e/professor-tutor.spec.ts` (28 casos) e `e2e/a3-a4-professor.spec.ts` rodaram isolados, nos dois projetos.
3. **Segundo dado:** o aluno com pergunta em cada código de `PASSAGEIROS` (um caso por código, a lista inteira junta e os que não são passageiros) e em cada estado (respondida, cortada, a que recebeu a mensagem fixa, S12, função suspensa, `NAO_ENCONTRADO`); duas disciplinas na mesma turma e uma terceira; o professor com vínculo nas duas turmas do aluno transferido; a turma de 2025 ao lado da de hoje; um aluno de outra escola e um segundo aluno cortado na B (para o `inArray` do aluno ter efeito).
4. **Checagem anterior (o controle):** cada caso que prova uma ausência tem o positivo ao lado: a B vê a própria cortada antes de a A não ver; o Química não vê a de Física, mas a de Química dele aparece; o dia de ontem ao lado dos de hoje; a cortada ao lado da que recebeu a mensagem fixa. O dublê lança `LLMError` com o código, como o gateway; as falhas nascem pelo `POST`, o job e o worker da bancada, e só a lista parametrizada e as linhas de dia e de ano são gravadas por SQL, o que está dito no cabeçalho do arquivo. O caso do worker parado usa a fila sem consumidor e o corte do `GET` da execução, e confere a troca antes do corte e a pergunta sem resposta depois.
5. **Asserção:** o `GET /v1/tutor/uso`, lido pelo schema, e a contagem do repository; na tela, o texto e o elemento (a frase não está dentro do freio, nem o freio dentro dela), e a ausência só depois de a resposta que traz o zero ter chegado (a tabela com o "12 de 60" já na tela). No e2e (a3-a4), a frase fica abaixo do freio, medida em caixa, com o uso e a pergunta cortada da API de verdade e do banco.
6. **Guarda nova:** nenhuma. `contracts.test.ts` já varre o schema; o caso novo fixa os campos do aluno (sem texto, sem código, sem execução).
7. **Comentários:** os docblocks de `#semResposta`, `#recorteDoProfessor`, `ultimasTrocas`, `semRespostaDeHoje`, do service e do schema dizem o que o código faz agora; a AIA (itens 15 e 16), a N21, `lgpd.md`, `interface.md`, `mvp-contratos.md` e o runbook dizem que a professora vê a contagem, e não "é a tarefa 9.0".
8. **Divergências:** a tabela abaixo; nenhuma muda regra.
9. **Peça que já existe:** `PASSAGEIROS` (importada, sem cópia), `#execucaoQueFalhou`, `#comVinculoNaTurma`, `#daDisciplinaDoProfessor`, `#desde` e `diaDeUso`/`FUSO_DO_USO` (o mesmo dia do freio), `FilaDeIa`, `comoPessoa`, `montarAnoAnterior`, `usoDoTutorResponseSchema`, o `Table` e o `text-sutil` da tela. O recorte, que `ultimasTrocas` escrevia inline, virou `#recorteDoProfessor` e as duas leituras o usam.
10. **Concorrência e relógio:** a leitura é uma consulta só, sem escrita. O caso do dia passa o relógio ao repository (às 10h de Brasília, e às 23h59 de domingo, que já é segunda em UTC) e semeia as horas em torno das duas viradas; nenhum caso depende do relógio da máquina. A entrega que muda entre o `202` e o worker usa `segurar`, e a ordem está forçada.
11. **Isolamento e "Caso":** a leitura filtra por escola, ano e turma do contexto, e o caso de isolamento usa ids todos da B no contexto da A, e ainda o contexto com a escola da A e o ano e a professora da B, que só a cláusula de escola separa. A coluna "Caso" está preenchida.
12. **Guardiões e achados:** `tenancy-guardian` (as cláusulas de escola, ano e turma; o 404 igual ao inexistente), `privacy-guardian` (só o número no DTO, sem texto nem código; nada novo no log; `docs/lgpd.md`), `conformidade-reviewer` (supervisão sem vigilância: contagem de hoje, neutra, sem ranking, e a AIA dos itens 15 e 16) e `frontend-reviewer` (a linha neutra, o singular, o zero, 1366 e 360 px).

## Fora do escopo desta tarefa

O freio do dia e o `trocasHoje` (não mudam).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| O caso de e2e da tela é o `a3-a4-professor.spec.ts`, contra a API real, e não um caso novo com o uso por `page.route`; a pergunta sem resposta é semeada no banco (`semearPerguntaSemRespostaNoBanco`); e não há `soOPainelDaAbaRola` a 1366 | Um caso novo em `professor-tutor.spec.ts` (entrada, painel, frase, axe) levou 16 a 19 s e o portão o reprovou pela régua de 15 s: a entrada da professora gasta 11,5 s e não se encurta. O `a3-a4-professor.spec.ts` já abre o painel do Tutor com o uso de verdade, declara o prazo de 420 s no HEAD, e o corte (20 s de fila parada) se faz no banco. O `soOPainelDaAbaRola` mede a aba da turma por trás do painel, e a linha nova mora dentro do painel (o `Sheet`), que não muda a aba: a medida da aba é do `professor-turma-aberta.spec.ts`, e o caso mede a rolagem do documento e do diálogo, o botão de 44 px e o axe, nos dois tamanhos | `techspec.md` §5 "Como a 9.0 ficou" (item 3); o `a3-a4-professor.spec.ts` é o arquivo que a tarefa previa |
| `docs/mvp-contratos.md` e `docs/runbook.md` mudam, e o runbook diz que a professora vê o contador | O contrato do `GET /tutor/uso` está descrito em `mvp-contratos.md` e precisa do campo novo; o runbook "A D62 na subida" passa a dizer que o professor vê o contador, e o caso do `worker-ia` parado entra aqui (observação do pedido, vinda da ordem r2 da 8.0, `conformidade-reviewer`: a pergunta é cortada pelo `GET` da execução, e `IA_INDISPONIVEL` está em `PASSAGEIROS`). O runbook caduca rodada e carimbo, e foi editado antes do portão | `techspec.md` §5 "A pergunta sem resposta (RF5)" e "A D62"; `.processo/ordens/8_task-r2.md`; `docs/runbook.md` "A D62 na subida" |
| O recorte de `ultimasTrocas` virou `#recorteDoProfessor`, usado também por `semRespostaDeHoje`; `semRespostaDeHoje(turmaId, alunos)` recebe os alunos que `ultimasTrocas` devolveu | A spec manda "o recorte de `ultimasTrocas`"; duas cópias da mesma condição divergiriam no primeiro ajuste, e o `alunos` limita a conta à lista que a tela mostra (como `trocasDeHoje`) | `techspec.md` §5 "A pergunta sem resposta (RF5)" ("com o recorte de turma, ano e disciplina de `ultimasTrocas`") |
| Arquivos acrescentados: `sinais.ts`, `sinais.test.ts`, `tutor.test.ts` (shared), `tutor.int.test.ts`, `e2e/professor-tutor.spec.ts` (só o mock), `e2e/support/db-assertions.ts` e `e2e/support/professor/tutor.ts` | `sinais.ts` guarda o texto da linha, como `trocasDeHoje`; os testes e o mock já descreviam o `semRespostaHoje` ausente e quebram sem o campo; `db-assertions.ts` semeia a pergunta sem resposta no e2e, e `tutor.ts` guarda a conferência da frase (a função do caso já está no teto de complexidade, 10) | `techspec.md` §2 (a linha de `supervisao.repository.ts`, `uso.ts` e `professor/turmas/`) |

## Mutações

--faltando: 0 linhas (35 blocos, 3 motivos)

Cada bloco tira uma cláusula e exige o vermelho de um caso que rodou. Os que provam uma ausência levam o `falha:`.

```mutacao
arquivo: apps/api/src/tutor/supervisao.repository.ts
teste: apps/api/src/tutor/sem-resposta.int.test.ts › nenhum outro código de erro conta
-.where(and(eq(execucaoAgente.escolaId, mensagemTutor.escolaId), eq(execucaoAgente.id, mensagemTutor.execucaoId), eq(execucaoAgente.estado, 'falhou'), inArray(execucaoAgente.erro, [...PASSAGEIROS])))
+.where(and(eq(execucaoAgente.escolaId, mensagemTutor.escolaId), eq(execucaoAgente.id, mensagemTutor.execucaoId), eq(execucaoAgente.estado, 'falhou'), sql`${execucaoAgente.erro} is not null`))
```

```mutacao
arquivo: apps/api/src/tutor/supervisao.repository.ts
teste: apps/api/src/tutor/sem-resposta.int.test.ts › IA_TEMPO_ESGOTADO, sem filtro nenhum
-.where(and(eq(execucaoAgente.escolaId, mensagemTutor.escolaId), eq(execucaoAgente.id, mensagemTutor.execucaoId), eq(execucaoAgente.estado, 'falhou'), inArray(execucaoAgente.erro, [...PASSAGEIROS])))
+.where(and(eq(execucaoAgente.escolaId, mensagemTutor.escolaId), eq(execucaoAgente.id, mensagemTutor.execucaoId), eq(execucaoAgente.estado, 'falhou'), inArray(execucaoAgente.erro, ['IA_INDISPONIVEL'])))
```

```mutacao
arquivo: apps/api/src/tutor/supervisao.repository.ts
teste: apps/api/src/tutor/sem-resposta.int.test.ts › duas cortadas e uma respondida
-.where(and(eq(execucaoAgente.escolaId, mensagemTutor.escolaId), eq(execucaoAgente.id, mensagemTutor.execucaoId), eq(execucaoAgente.estado, 'falhou'), inArray(execucaoAgente.erro, [...PASSAGEIROS])))
+.where(and(eq(execucaoAgente.escolaId, mensagemTutor.escolaId), eq(execucaoAgente.estado, 'falhou'), inArray(execucaoAgente.erro, [...PASSAGEIROS])))
```

```mutacao
arquivo: apps/api/src/tutor/supervisao.repository.ts
teste: apps/api/src/tutor/sem-resposta.int.test.ts › a pergunta que recebeu a mensagem fixa
-.where(and(eq(respostaFixaDoTurno.escolaId, mensagemTutor.escolaId), eq(respostaFixaDoTurno.execucaoId, mensagemTutor.execucaoId), eq(respostaFixaDoTurno.tipo, 'assunto_delicado')))
+.where(and(eq(respostaFixaDoTurno.escolaId, mensagemTutor.escolaId), eq(respostaFixaDoTurno.tipo, 'assunto_delicado')))
```

```mutacao
arquivo: apps/api/src/tutor/supervisao.repository.ts
teste: apps/api/src/tutor/sem-resposta.int.test.ts › duas cortadas e uma respondida
-.where(and(eq(respostaFixaDoTurno.escolaId, mensagemTutor.escolaId), eq(respostaFixaDoTurno.execucaoId, mensagemTutor.execucaoId), eq(respostaFixaDoTurno.tipo, 'assunto_delicado')))
+.where(and(eq(respostaFixaDoTurno.escolaId, mensagemTutor.escolaId), eq(respostaFixaDoTurno.execucaoId, mensagemTutor.execucaoId)))
```

```mutacao
arquivo: apps/api/src/tutor/supervisao.repository.ts
teste: apps/api/src/tutor/sem-resposta.int.test.ts › duas cortadas e uma respondida
-return sql`(${exists(cortada)} and ${notExists(comMensagemFixa)})`
+return sql`(${notExists(comMensagemFixa)})`
```

```mutacao
arquivo: apps/api/src/tutor/supervisao.repository.ts
teste: apps/api/src/tutor/sem-resposta.int.test.ts › a pergunta que recebeu a mensagem fixa
-return sql`(${exists(cortada)} and ${notExists(comMensagemFixa)})`
+return sql`(${exists(cortada)})`
```

```mutacao
arquivo: apps/api/src/tutor/supervisao.repository.ts
teste: apps/api/src/tutor/sem-resposta.int.test.ts › na mesma turma, a cortada em Física
-const semDisciplina = and(isNull(mensagemTutor.atividadeAplicadaId), isNull(mensagemTutor.materialId))
+const semDisciplina = and(isNull(mensagemTutor.materialId))
```

```mutacao
arquivo: apps/api/src/tutor/supervisao.repository.ts
teste: apps/api/src/tutor/sem-resposta.int.test.ts › na mesma turma, a cortada em Física
falha: linhaDe(deQuimica, soDeMaterialDeFisica)).toBeUndefined()
-const semDisciplina = and(isNull(mensagemTutor.atividadeAplicadaId), isNull(mensagemTutor.materialId))
+const semDisciplina = and(isNull(mensagemTutor.atividadeAplicadaId))
```

```mutacao
arquivo: apps/api/src/tutor/supervisao.repository.ts
teste: apps/api/src/tutor/sem-resposta.int.test.ts › na mesma turma, a cortada em Física
-return sql`(${or(and(semDisciplina, this.#comVinculoNaTurma(colunas)), this.#daDisciplinaDoProfessor(colunas))})`
+return sql`(${or(and(semDisciplina, this.#comVinculoNaTurma(colunas)))})`
```

```mutacao
arquivo: apps/api/src/tutor/supervisao.repository.ts
teste: apps/api/src/tutor/sem-resposta.int.test.ts › o aluno transferido hoje
-return sql`(${or(and(semDisciplina, this.#comVinculoNaTurma(colunas)), this.#daDisciplinaDoProfessor(colunas))})`
+return sql`(${or(this.#daDisciplinaDoProfessor(colunas))})`
```

```mutacao
arquivo: apps/api/src/tutor/supervisao.repository.ts
teste: apps/api/src/tutor/sem-resposta.int.test.ts › duas cortadas e uma respondida
 eq(mensagemTutor.autor, 'aluno'),
-or(notExists(this.#execucaoQueFalhou()), this.#semResposta()),
+or(notExists(this.#execucaoQueFalhou())),
 this.#recorteDoProfessor(),
```

```mutacao
arquivo: apps/api/src/tutor/supervisao.repository.ts
teste: apps/api/src/tutor/sem-resposta.int.test.ts › nenhum outro código de erro conta
 eq(mensagemTutor.autor, 'aluno'),
-or(notExists(this.#execucaoQueFalhou()), this.#semResposta()),
+or(this.#semResposta()),
 this.#recorteDoProfessor(),
```

```mutacao
arquivo: apps/api/src/tutor/supervisao.repository.ts
teste: apps/api/src/tutor/sem-resposta.int.test.ts › na mesma turma, a cortada em Física
falha: linhaDe(deQuimica, soDeFisica)).toBeUndefined()
 or(notExists(this.#execucaoQueFalhou()), this.#semResposta()),
-this.#recorteDoProfessor(),
 ),
```

```mutacao
arquivo: apps/api/src/tutor/supervisao.repository.ts
teste: apps/api/src/tutor/sem-resposta.int.test.ts › isolamento entre escolas
 .where(
 and(
-eq(mensagemTutor.escolaId, escolaId),
 eq(mensagemTutor.anoLetivoId, anoLetivoId),
 eq(mensagemTutor.turmaId, turmaId),
 inArray(mensagemTutor.alunoId, [...alunos]),
```

```mutacao
arquivo: apps/api/src/tutor/supervisao.repository.ts
teste: apps/api/src/tutor/sem-resposta.int.test.ts › o ano anterior
 eq(mensagemTutor.escolaId, escolaId),
-eq(mensagemTutor.anoLetivoId, anoLetivoId),
 eq(mensagemTutor.turmaId, turmaId),
 inArray(mensagemTutor.alunoId, [...alunos]),
```

```mutacao
arquivo: apps/api/src/tutor/supervisao.repository.ts
teste: apps/api/src/tutor/sem-resposta.int.test.ts › o aluno transferido hoje
 eq(mensagemTutor.anoLetivoId, anoLetivoId),
-eq(mensagemTutor.turmaId, turmaId),
 inArray(mensagemTutor.alunoId, [...alunos]),
```

```mutacao
arquivo: apps/api/src/tutor/supervisao.repository.ts
teste: apps/api/src/tutor/sem-resposta.int.test.ts › isolamento entre escolas
falha: expect(daB.size).toBe(1)
 eq(mensagemTutor.turmaId, turmaId),
-inArray(mensagemTutor.alunoId, [...alunos]),
 eq(mensagemTutor.autor, 'aluno'),
 gte(mensagemTutor.criadaEm, this.#desde(diaDeUso(this.relogio.agora()))),
 this.#semResposta(),
```

```mutacao
arquivo: apps/api/src/tutor/supervisao.repository.ts
teste: apps/api/src/tutor/sem-resposta.int.test.ts › às 10h de Brasília
 eq(mensagemTutor.autor, 'aluno'),
-gte(mensagemTutor.criadaEm, this.#desde(diaDeUso(this.relogio.agora()))),
 this.#semResposta(),
 this.#recorteDoProfessor(),
```

```mutacao
arquivo: apps/api/src/tutor/supervisao.repository.ts
teste: apps/api/src/tutor/sem-resposta.int.test.ts › no domingo, às 23h59
 eq(mensagemTutor.autor, 'aluno'),
-gte(mensagemTutor.criadaEm, this.#desde(diaDeUso(this.relogio.agora()))),
+gte(mensagemTutor.criadaEm, sql`((${this.relogio.agora().toISOString().slice(0, 10)})::date)::timestamp at time zone 'UTC'`),
 this.#semResposta(),
 this.#recorteDoProfessor(),
```

```mutacao
arquivo: apps/api/src/tutor/supervisao.repository.ts
teste: apps/api/src/tutor/sem-resposta.int.test.ts › na mesma turma, a cortada em Física
 gte(mensagemTutor.criadaEm, this.#desde(diaDeUso(this.relogio.agora()))),
 this.#semResposta(),
-this.#recorteDoProfessor(),
 ),
 )
 .groupBy(mensagemTutor.alunoId)
```

```mutacao
arquivo: apps/api/src/tutor/supervisao.service.ts
teste: apps/api/src/tutor/sem-resposta.int.test.ts › nenhum outro código de erro conta
-semRespostaHoje: semRespostaDeHoje.get(ultima.alunoId) ?? 0,
+semRespostaHoje: semRespostaDeHoje.get(ultima.alunoId),
```

```mutacao
arquivo: apps/api/src/tutor/supervisao.service.ts
teste: apps/api/src/tutor/sem-resposta.int.test.ts › duas cortadas e uma respondida
-const semRespostaDeHoje = await repositorio.semRespostaDeHoje(turma, alunos)
+const semRespostaDeHoje = await repositorio.semRespostaDeHoje(turma, [])
```

```mutacao
arquivo: packages/shared/src/tutor/uso.ts
teste: packages/shared/src/tutor/tutor.test.ts › as perguntas sem resposta de hoje são só um número inteiro
falha: semRespostaHoje: valor }).success, JSON.stringify(valor)).toBe(false)
-semRespostaHoje: z.number().int().nonnegative(),
+semRespostaHoje: z.number().nonnegative(),
```

```mutacao
arquivo: packages/shared/src/tutor/uso.ts
teste: packages/shared/src/tutor/tutor.test.ts › as perguntas sem resposta de hoje são só um número inteiro
falha: semRespostaHoje: valor }).success, JSON.stringify(valor)).toBe(false)
-semRespostaHoje: z.number().int().nonnegative(),
+semRespostaHoje: z.number().int(),
```

```mutacao
arquivo: packages/shared/src/tutor/uso.ts
teste: packages/shared/src/tutor/tutor.test.ts › por aluno: as trocas do dia
 trocasHoje: z.number().int().nonnegative(),
-semRespostaHoje: z.number().int().nonnegative(),
 ultimaTrocaEm: z.iso.datetime(),
```

```mutacao
arquivo: apps/web/src/areas/professor/turmas/sinais.ts
teste: apps/web/src/areas/professor/turmas/sinais.test.ts › as perguntas sem resposta: o número no plural
-if (quantas === 0) return null
```

```mutacao
arquivo: apps/web/src/areas/professor/turmas/sinais.ts
teste: apps/web/src/areas/professor/turmas/sinais.test.ts › as perguntas sem resposta: o número no plural
-return `${String(quantas)} ${quantas === 1 ? 'pergunta' : 'perguntas'} que o Tutor não respondeu hoje`
+return `${String(quantas)} perguntas que o Tutor não respondeu hoje`
```

```mutacao
arquivo: apps/web/src/areas/professor/turmas/TurmaHoje.tsx
teste: apps/web/src/areas/professor/turmas/TurmaHoje.test.tsx › a linha do aluno diz
-{semResposta !== null && <span className="block text-sutil">{semResposta}</span>}
+{<span className="block text-sutil">{semResposta}</span>}
```

```mutacao
arquivo: apps/web/src/areas/professor/turmas/TurmaHoje.tsx
teste: apps/web/src/areas/professor/turmas/TurmaHoje.test.tsx › a linha do aluno diz
-{semResposta !== null && <span className="block text-sutil">{semResposta}</span>}
+{semResposta !== null && null}
```

```mutacao
arquivo: apps/web/src/areas/professor/turmas/TurmaHoje.tsx
teste: apps/web/src/areas/professor/turmas/TurmaHoje.test.tsx › a linha do aluno diz
-{ chave: 'hoje', titulo: 'Trocas hoje', celula: (aluno) => <CelulaDasTrocasDeHoje aluno={aluno} limiteDoDia={uso.data.limiteDoDia} /> },
+{ chave: 'hoje', titulo: 'Trocas hoje', celula: (aluno) => trocasDeHoje(aluno, uso.data.limiteDoDia) },
```

```mutacao
arquivo: apps/web/src/areas/professor/turmas/TurmaHoje.tsx
teste: apps/web/src/areas/professor/turmas/TurmaHoje.test.tsx › a linha do aluno diz
-<span>{trocasDeHoje(aluno, limiteDoDia)}</span>
+<span>{trocasDeHoje(aluno, limiteDoDia)}{semResposta}</span>
```

```mutacao
arquivo: apps/web/src/areas/professor/turmas/TurmaHoje.tsx
teste: e2e/a3-a4-professor.spec.ts › aplica, os alunos respondem
falha: conferirAPerguntaSemResposta(page)
-{semResposta !== null && <span className="block text-sutil">{semResposta}</span>}
+{semResposta !== null && <span className="text-sutil">{semResposta}</span>}
```


```mutacao
arquivo: apps/api/src/tutor/supervisao.repository.ts
teste: apps/api/src/tutor/sem-resposta.int.test.ts › duas cortadas e uma respondida
 gte(mensagemTutor.criadaEm, this.#desde(diaDeUso(this.relogio.agora()))),
-this.#semResposta(),
 this.#recorteDoProfessor(),
```

```mutacao
arquivo: apps/api/src/tutor/supervisao.repository.ts
teste: apps/api/src/tutor/sem-resposta.int.test.ts › sem aluno nenhum a ler, devolve vazio
-if (alunos.length === 0) return new Map()
+if (alunos.length === 0) return new Map([['sem-aluno', 1]])
 const { escolaId, anoLetivoId } = this.#escopo()
```

Termos que nenhum caso alcança, com o motivo (a crase é o termo, como o `--faltando` o lê):

- `eq(execucaoAgente.escolaId, mensagemTutor.escolaId)` e `eq(respostaFixaDoTurno.escolaId, mensagemTutor.escolaId)`: a mensagem e a execução se ligam pela chave composta `mensagem_tutor_execucao_do_ano_da_escola_fk` (escola, ano, execução), e `execucao_id` é único na tabela: não existe linha de outra escola com o mesmo `execucaoId`, e nenhum cenário a fabrica. A cláusula repete o escopo da regra 10 dentro da subconsulta, e a que o caso de isolamento prova é a de `semRespostaDeHoje`.
- `eq(execucaoAgente.estado, 'falhou')`: execução só tem `erro` quando termina `falhou` (o processador, o corte e a varredura gravam os dois juntos); com o termo fora, `inArray(execucaoAgente.erro, [...PASSAGEIROS])` sozinho dá o mesmo resultado em todo estado que o código produz. O termo fica para quem lê a consulta (a pergunta sem resposta é a que `falhou`), e o caso que o exige seria semear `erro` em execução `concluida`, estado que o sistema não alcança.
- `alunos.length === 0` (tirar o `if` de `semRespostaDeHoje`; o bloco acima muda o valor devolvido): aplicada a mutação de tirar, o caso "sem aluno nenhum a ler" segue verde, porque o `inArray` com lista vazia do Drizzle 0.45 vira `false` e a consulta devolve zero linhas do mesmo jeito; o `if` só poupa a ida ao banco (como em `trocasDeHoje`), e o caso fixa o resultado, que é o que a tela vê.
- A asserção de isolamento que confere que o aluno da B não aparece em `ultimasTrocas` da turma da A (`linhaDe(…, deB)` indefinido) não acrescenta cláusula: o aluno não é da turma, e a lista já o deixa de fora pelo vínculo de aluno na turma, que existia antes da tarefa; ela guarda que a pergunta cortada da B não o traz para a lista, e a cláusula de escola de `semRespostaDeHoje` é a do bloco acima.
- `eq(mensagemTutor.autor, 'aluno')` de `semRespostaDeHoje`: a única mensagem de execução que terminou `falhou` e não recebeu a mensagem fixa é a do aluno (o Tutor só grava a dele junto da conclusão, e a fixa o `notExists` já exclui); nenhum estado que o código produza tem a mensagem do Tutor numa execução cortada, e o termo repete o que `ultimasTrocas` e `trocasDeHoje` já dizem.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| conformidade-reviewer (1ª), revisor-geral (1ª) | A coluna "Última troca" e o vazio "com as trocas de hoje e em que estava" podem mostrar uma pergunta sem resposta; o docblock de `uso.ts` e o `mvp-contratos.md` já dizem "última pergunta"; renomear para "Última pergunta" ou alinhar o glossário e `docs/interface.md` | `TODO.md`. É texto de tela e passa por `TurmaHoje.tsx`, `sinais.ts`, `docs/interface.md`, `docs/lgpd.md` e o glossário; o texto é decisão de produto, não de quem implementa. O RF5 do PRD trata da pergunta visível ao professor e não do rótulo da coluna. Fica para a próxima tarefa que toque a tabela de uso |
| frontend-reviewer (1ª) | A 1366 px o painel tem uns 450 px, a tabela de 4 colunas rola na horizontal e a frase nova quebra em cinco linhas na célula estreita; reduzir as colunas ou dar largura mínima à frase | `TODO.md` (a próxima passada de tela do painel). A rolagem horizontal já era assim antes da tarefa; a frase em cinco linhas fica dentro do que o RF não mede |
| frontend-reviewer, revisor-geral, privacy-guardian, conformidade-reviewer (1ª) | A foto do celular não mostra a linha do Caio, porque o cartão fica cortado pela rolagem do painel | É da Mesa: na rodada nova ela fotografa o celular rolado até o cartão. Nenhuma mudança de código |
| privacy-guardian (1ª) | Um caso curto em `sem-resposta.int.test.ts` com a coordenação e o aluno recebendo o inexistente | Recusada. A rota e a permissão são as mesmas e o caso já existe em `apps/api/src/tutor/tutor.int.test.ts` › "sinais e uso: a professora de outra turma, a de outra escola, a coordenação e o aluno recebem a resposta do inexistente"; o `semRespostaHoje` não muda quem lê |
| infra-guardian (1ª) | Rodar o `EXPLAIN` de `ultimasTrocas` com volume perto do da seção 3.6 de `docs/infra.md`, no cenário do `worker-ia` parado a manhã toda | `TODO.md`. Medição com volume é trabalho de carga (k6 do RF6, na tarefa dele), não de uma linha nesta |
| infra-guardian (1ª) | Juntar a contagem de hoje com a de trocas numa consulta só (`count(*) filter (...)`) em `supervisao.service.ts` | `TODO.md`, "se a medida do pool de conexões apertar". Muda o contrato de `trocasDeHoje`, que a tarefa declara que não muda |
| tenancy-guardian (2ª) | `sem-resposta.int.test.ts:424`: o comentário deixa a entender que essa asserção prova o isolamento; quem prova é a chamada ao repository com a escola trocada, logo abaixo. Escrever que a linha é a prova pela rota | `TODO.md`. Só comentário em arquivo de teste; aplicar agora caducaria as sete aprovações por uma frase |
| test-engineer (2ª), revisor-geral (2ª) | `e2e/support/professor/tutor.ts:36`: `getByText(/^1 de \d+$/).last()` acha o último "1 de N" da lista, e não o da linha do aluno semeado; prender o freio à linha que tem a frase (`getByRole('row').filter({ hasText: … })`) | `TODO.md`. O revisor diz que o risco é vermelho falso, nunca verde falso, e o `a3-a4` tem um só aluno com uso; entra junto da próxima tarefa que toque o helper |
| privacy-guardian (2ª), conformidade-reviewer (2ª), frontend-reviewer (2ª) | Fotografar o celular rolado até o cartão do Caio | A Mesa tentou nas duas rodadas (inclusive clicando no nome dele): a captura de `tools/vitrine/` é da página inteira e não rola o painel por dentro. `TODO.md`, como melhoria da ferramenta de foto (`tools/vitrine/foto.ts`). A linha a 360 px segue provada pelo e2e `conferirAPerguntaSemResposta`, nos dois projetos |
| conformidade-reviewer (2ª), frontend-reviewer (2ª), revisor-geral (2ª) | A coluna "Última troca" pode mostrar a hora de uma pergunta sem resposta; a frase quebra em cinco linhas a 1366 px; o cinza de `text-sutil` na linha do Caio está claro na foto (conferir o contraste) | Os dois primeiros já estão no `TODO.md` (1ª rodada). O contraste entra na mesma linha do painel, na próxima passada de tela |
| test-engineer (2ª) | A suíte de integração não pode rodar ao lado da vitrine: os workers do compose de teste (`worker-ia-1`, `worker-ia-2`, `worker-lote`, `worker-pdf`) consomem as filas da bancada, e a integração vermelha com `422 SEM_MATERIAL_DA_SERIE` (14 de 31 aqui, 17 de 31 na 1ª rodada). O portão do Implementador roda em ambiente limpo e está verde | Não é defeito da tarefa. É do processo: vai ao Orquestrador, no relatório desta rodada, para a retro (D86); a skill `revisar-tarefa` manda montar a vitrine antes de chamar os revisores, e o `test-engineer` roda a suíte ao mesmo tempo. Não mexo na skill |
| infra-guardian (2ª) | O docblock de `#semResposta` deixa o escopo por conta de quem chama; se outra consulta a usar, a revisão confere o `where` dela | Sem ação: é o que o docblock já diz, e hoje as duas chamadas (`ultimasTrocas`, `semRespostaDeHoje`) estão em consulta escopada |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-16 16:20:05 | 2026-11-16 16:20:31 | `frontend-reviewer` | 1 | APROVADO | ab1cffed00a25cfc3 |
| 2026-11-16 16:19:47 | 2026-11-16 16:20:33 | `tenancy-guardian` | 1 | APROVADO | a07d0ec1cff5fa19c |
| 2026-11-16 16:19:53 | 2026-11-16 16:20:52 | `privacy-guardian` | 1 | APROVADO | a03a5c26c34e2ab46 |
| 2026-11-16 16:20:23 | 2026-11-16 16:21:12 | `infra-guardian` | 1 | APROVADO | a64ed096b6de5db80 |
| 2026-11-16 16:20:17 | 2026-11-16 16:22:04 | `revisor-geral` | 1 | APROVADO | a72f060a683f88de9 |
| 2026-11-16 16:19:59 | 2026-11-16 16:22:31 | `conformidade-reviewer` | 1 | APROVADO | a1074486a3842bef9 |
| 2026-11-16 16:20:11 | 2026-11-16 16:24:29 | `test-engineer` | 1 | REPROVADO | a9064dca5278d884c |
| 2026-11-16 16:48:53 | 2026-11-16 16:49:15 | `tenancy-guardian` | 2 | APROVADO | ab81e85bef0e5c268 |
| 2026-11-16 16:49:04 | 2026-11-16 16:49:39 | `privacy-guardian` | 2 | APROVADO | aedb9d3505edaee4b |
| 2026-11-16 16:49:14 | 2026-11-16 16:49:44 | `conformidade-reviewer` | 2 | APROVADO | a6ba4ed26042d4e66 |
| 2026-11-16 16:49:26 | 2026-11-16 16:49:52 | `frontend-reviewer` | 2 | APROVADO | a087e925b339cfd14 |
| 2026-11-16 16:49:56 | 2026-11-16 16:50:15 | `infra-guardian` | 2 | APROVADO | a660e242f975b5b65 |
| 2026-11-16 16:49:47 | 2026-11-16 16:50:23 | `revisor-geral` | 2 | APROVADO | ae34cea8d076a2429 |
| 2026-11-16 16:49:37 | 2026-11-16 16:50:49 | `test-engineer` | 2 | APROVADO | aa2930baa6ce00d64 |
