# Tarefa 3.0 — O aluno começa e responde dentro do limite

**Funcionalidade:** avaliacao-e-correcao · **Depende de:** 2.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

O aluno começa só dentro da janela, a tentativa nasce no `comecar`, e resposta além do limite é recusada sem gravar.

## Contexto necessário

- `techspec.md` §4 (`comecar`, `prova`, `tempo`, PUT, `minhas-atividades`), §5.2 a §5.5, §6, §7
- `prd.md` RF1, RF5, RF6, RF7 (a API)
- `cenarios.md` §1 (RF1, RF5, RF6, RF7 da API), §1b (aluno), §3 (a) e (b)
- `apps/api/src/atividade/minha-atividade/`: hoje o `prova` cria a tentativa (U05-15)

## Subtarefas

- [x] 3.1 — Alcance, janela e limite, nessa ordem (§5.2)
- [x] 3.2 — `comecar`, `prova` sem gravar e `tempo` (§4, §5.3)
- [x] 3.3 — PUT e envio no limite (§5.5); `minhas-atividades`; a guarda de pulso nas rotas novas
- [x] 3.4 — `Atividade.tsx` de hoje chama `comecar` antes de `prova`
- [x] 3.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/src/atividade/minha-atividade/minha-atividade.controller.ts` | alterado |
| `apps/api/src/atividade/minha-atividade/minha-atividade.service.ts` | alterado |
| `apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts` | alterado |
| `apps/api/src/atividade/atividade.int.test.ts` | alterado |
| `apps/api/src/atividade/atividade-isolamento.int.test.ts` | alterado |
| `apps/api/src/atividade/prova-online-aluno.int.test.ts` | novo |
| `apps/web/src/areas/aluno/atividade.ts` | alterado |
| `apps/web/src/areas/aluno/Atividade.tsx` | alterado |
| `apps/web/src/areas/aluno/Atividade.test.tsx` | alterado |
| `apps/web/src/api/atividades-do-aluno.ts` | alterado (a tela chama `comecar` antes de ler a prova) |
| `apps/api/src/atividade/correcao/correcao.int.test.ts`, `apps/api/src/atividade/pulso/pulso.int.test.ts`, `apps/api/test/atividade.fixture.ts` | alterados (a prova só começa em `comecar`; `comecar` e `tempo` nas rotas) |
| `apps/api/test/contracts.test.ts` | alterado (o contrato do aluno) |
| `packages/shared/src/atividade/prova.ts`, `limite-da-tentativa.ts` e o teste, `packages/shared/src/index.ts`, `packages/shared/src/atividade/atividade.test.ts` | alterados (o limite base, a duração do aluno, `janela` e `duracaoMin` na lista) |
| `packages/core/src/rate-limit/` (`keys.ts`, `rate-limiter.ts`, `rate-limit.guard.ts`, `comecar-prova-rate-limit.decorator.ts`) e `packages/core/src/index.ts` | alterados e novo (o balde `rl:comecar-prova`) |
| `apps/web/src/areas/aluno/Atividades.test.tsx`, `Inicio.test.tsx`, `atividades.test.ts`, `e2e/support/aluno.ts` | alterados (a lista traz `janela` e `duracaoMin`; a simulação do e2e responde `comecar`) |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| Começar antes de `abre_em` e depois de `fecha_em` | integração | `PROVA_FORA_DA_JANELA`, sem tentativa | dentro da janela começa | `apps/api/src/atividade/prova-online-aluno.int.test.ts` › antes de `abre_em` e depois de `fecha_em` é PROVA_FORA_DA_JANELA |
| Começo a 10 min do `fecha_em` com duração 40 | integração | `limiteEm` = `fecha_em` | começo cedo dá 40 | `apps/api/src/atividade/prova-online-aluno.int.test.ts` › a 10 min do `fecha_em` com duração 40 |
| `prova` sem tentativa | integração | sem questões, sem gravar | depois do `comecar`, com questões | `apps/api/src/atividade/prova-online-aluno.int.test.ts` › `prova` sem tentativa traz o título |
| `duracaoMin` do aluno com +50% | integração | 60 em `prova` e `minhas-atividades`, sem "adicional" nem percentual | o colega lê 40 | `apps/api/src/atividade/prova-online-aluno.int.test.ts` › o tempo adicional do aluno vira só a duração dele |
| PUT e envio depois do limite; vencida sem envio | integração | `TEMPO_ESGOTADO` sem linha; leitura com `envio = 'limite'` | um minuto antes grava; a do aluno diz `aluno`; a não avaliativa grava a qualquer hora | `apps/api/src/atividade/prova-online-aluno.int.test.ts` › um minuto antes do limite grava; o envio dentro do limite diz `aluno` |
| Pulso parado, relógio +31 s | integração | 503 em `comecar` e `tempo`; `minhas-atividades` segue | +29 s aceita | `apps/api/src/atividade/pulso/pulso.int.test.ts` › +29 s e +30 s aceitam `comecar` |
| Corrida (b) PATCH × começar | integração | o `comecar` espera o PATCH segurado e grava o limite da janela nova | sem `for share`, o da antiga | `apps/api/src/atividade/prova-online-aluno.int.test.ts` › (b) mudar a janela × começar |
| Corrida (c) enviar × responder | integração | o PUT que chega com o envio segurado espera o `for update` da tentativa e, solto, é `ATIVIDADE_ENCERRADA`, sem linha nova | sem `for update`, o PUT lê a tentativa ainda aberta | `apps/api/src/atividade/prova-online-aluno.int.test.ts` › (c) enviar × responder |
| PUT com indisponibilidade fechada de 5 min | integração | grava 2 min depois do limite original; `prova` e `tempo` trazem `limiteEm` + 5 | sem indisponibilidade, recusa | `apps/api/src/atividade/prova-online-aluno.int.test.ts` › a indisponibilidade fechada de 5 min |
| Lacuna aberta montada à mão | integração | PUT, `prova` e `tempo` contam os 3 min | limite base 2 min atrás, já passado; sem o pulso parado, `TEMPO_ESGOTADO` | `apps/api/src/atividade/prova-online-aluno.int.test.ts` › a lacuna aberta montada à mão |
| Corrida (a) começar × começar | integração | uma tentativa, um `limite_base_em` | a primeira segurada; a segunda, com outro `now()`, devolve o `limiteEm` da primeira | `apps/api/src/atividade/prova-online-aluno.int.test.ts` › (a) começar × começar: três chamadas ao mesmo tempo… e (a) começar × começar com a primeira segurada |
| Escola sem ano em curso; repository do alcance com escola ou ano errado no contexto | integração | `NAO_ENCONTRADO`; `minhas-atividades` vazia; o repository devolve vazio | com ano em curso, aparece | `apps/api/src/atividade/prova-online-aluno.int.test.ts` › a escola sem ano em curso; no repository, `cada leitura da prova do aluno` |
| Aluno transferido com tentativa em A | integração | em A, as rotas `NAO_ENCONTRADO`; a tentativa fica; `minhas-atividades` só com as de B | o vínculo aberto em B | `apps/api/src/atividade/prova-online-aluno.int.test.ts` › o aluno transferido, com tentativa na turma A |
| Aluno de outra turma e de outra escola, fora da janela | integração | `NAO_ENCONTRADO`, nunca `PROVA_FORA_DA_JANELA` | o da turma recebe `PROVA_FORA_DA_JANELA` | `apps/api/src/atividade/prova-online-aluno.int.test.ts` › o aluno de outra turma e o de outra escola, fora da janela |
| 31ª chamada de `comecar` no minuto | integração | 429; outro aluno no mesmo IP passa | a 30ª passa | `apps/api/src/atividade/prova-online-aluno.int.test.ts` › a 31ª chamada do minuto é 429 |
| Contrato do aluno | unidade | só o `limiteEm` dele; sem `saidas` nem `tempoAdicional` || `apps/api/test/contracts.test.ts` › avaliacao-e-correcao 3.0 |
| Tela de hoje | unidade web | `comecar` antes de `prova` | a ordem das chamadas | `apps/web/src/areas/aluno/Atividade.test.tsx` › a tela chama `comecar` (POST) e só depois lê a prova (GET) |

## Como testar

- Responder: `apps/api/src/atividade/atividade.int.test.ts › a resposta é gravada de forma idempotente…`, com
  `responderProva` (`apps/api/test/atividade.fixture.ts`)
- Isolamento: `atividade-isolamento.int.test.ts › o aluno de outra turma e o de outra escola não listam…`
- Janela e pulso envelhecidos direto no banco
- Contrato do aluno: o mecanismo de `apps/api/test/contracts.test.ts` (perto da linha 319)
- `npx vitest run --project integracao apps/api/src/atividade/prova-online-aluno.int.test.ts`
- Armadilha: `e2e/aluno-atividade.spec.ts` segue verde com a 3.4; rode-o isolado
- `EXPLAIN` (Tech Spec §7c), no banco de teste vazio, com `enable_seqscan = off` e, para ver o índice que serve ao `atividadeAplicadaId`, sem o `extensao_de_tempo_aluno_idx` e o `tempo_adicional_aluno_idx` (`drop index` dentro de uma transação desfeita). Com os dois índices por aluno presentes o plano usa `extensao_de_tempo_aluno_idx` (`escola_id`) e `tempo_adicional_aluno_idx` (`escola_id`, `aluno_id`), com o resto em `Filter`; sem eles:
  - `extensoes` (uma aplicação): `Index Scan using extensao_de_tempo_chave_por_aplicacao`, `Index Cond: (escola_id = … AND atividade_aplicada_id = …)`, `Filter: (aluno_id IS NULL OR aluno_id = …) AND ano_letivo_id = …`
  - `extensoesDas` (várias): o mesmo índice, `Index Cond: (escola_id = … AND atividade_aplicada_id = ANY (…))`
  - subconsulta de `percentual` da lista: `Index Scan using tempo_adicional_um_por_aluno`, `Index Cond: (escola_id = … AND atividade_aplicada_id = … AND aluno_id = …)`, `Filter: ano_letivo_id = …`
  Os três começam pelo escopo (`escola_id`) e acham a aplicação pelas restrições únicas que já existem; nenhum índice novo.

## Autoconferência

As perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas antes de codar e conferidas depois. A 4: o cenário da janela usa um aluno no alcance.

1. **A mutação de cada cláusula** está na seção "Mutações": a janela (os dois lados, o `>=` e os dois `!== null`), o limite da resposta e do envio, o `limiteBaseDaTentativa` (o `min`, o tempo adicional, os dois `null`), a duração do aluno (o `ceil`, o `?? 0`), cada recusa de "sem tentativa", o `percentualDoAluno`, cada termo do `where` do repository (escola, ano, aplicação, aluno ou turma), a lista que conta a vencida (a enviada, a encerrada, a estendida, a de outro aluno), o balde e os dois `@UseGuards`. O que não tem bloco tem o motivo em prosa na mesma seção.
2. **O texto na tela:** `PROVA_FORA_DA_JANELA` já tem mensagem em `packages/shared` (1.0); a tela de hoje a mostra como erro tipado, sem texto novo. O aviso antes de começar e a tela de foco são da 12.0.
3. **O segundo dado de cada cláusula:** a janela de 30 min à frente e a de 30 min atrás ao lado da aberta; a janela que fecha em 10 min ao lado da de 120 min; o aluno com +50% (60) ao lado do colega (40); o limite a 1 min à frente (grava) ao lado do de 1 min atrás (recusa); a indisponibilidade de 5 min ao lado da leitura sem ela (recusa); a extensão do aluno, a da turma e a de outro aluno; a de outra aplicação; a tentativa enviada, a encerrada e a estendida ao lado da vencida na lista; o 30º `comecar` ao lado do 31º, e o segundo aluno ao lado do primeiro.
4. **A checagem anterior que responde antes:** o cenário da janela usa o aluno da turma certa, com a atividade aberta (senão responde `ATIVIDADE_ENCERRADA` antes de a janela); o intruso (de outra turma e de outra escola) é conferido fora da janela, e a resposta tem de ser `NAO_ENCONTRADO`, nunca `PROVA_FORA_DA_JANELA`; o caso do limite renova o pulso (`pulsar`) antes, para a lacuna aberta do banco de teste não somar ao limite; o caso do balde usa alunos próprios, com os limites gerais altos.
5. **A asserção olha o resultado:** o banco é lido depois de cada recusa (`tentativa_atividade`, `resposta_atividade`): `PROVA_FORA_DA_JANELA` e `TEMPO_ESGOTADO` não deixam linha; `prova` sem tentativa não cria; o `limite_base_em` é comparado com o que a resposta diz.
6. **Guarda nova:** nenhuma regra de lint nem teste estrutural novo. As guardas existentes que a tarefa toca ficaram verdes: `contracts.test.ts` (o caso novo do aluno), `repositories-com-escopo` (nenhuma consulta sem escopo), `architecture.test.ts` e a complexidade de teste do lint (o `responderProva` do fixture perdeu o detalhe do erro para caber).
7. **Comentário que afirma o que o código não faz:** o docblock de `comecar` diz que a aplicação fica em `for share` e que o clique duplo lê a gravada (casos (a) e (b)); o de `tempo`, que é leitura sem trava (o caso que segura o `for update`); o de `list`, que vencida sem envio conta como enviada com o limite como hora (o caso da lista); o do repository, que `extensoes` traz a do aluno e a da turma e não a de outro (o caso das extensões).
8. **Divergências:** a tabela diz "`minhas-atividades` vazia" para a escola sem ano em curso; a rota responde `NAO_ENCONTRADO` (como toda rota do aluno sem ano, desde antes), e o repository, com o ano trocado, devolve lista vazia: o caso prova os dois. A linha foi ajustada em `cenarios.md` (a divergência acima). O `TEMPO_ESGOTADO` segue com o status 503 do mapa de erros (`domain.exception.ts`, 1.0), como a Tech Spec quer: a fila de respostas da web já o trata como pendência a reenviar, e a 12.0 faz a fila reler `tempo` (RF6 do `cenarios.md`).
9. **Peça que já existe:** `limiteDaTentativa` e `QuedasDaApiRepository.leituraDesde` (2.0), `WriteBlockTrigger` e `esperarNaTrava` (as duas corridas), o balde de `createLimite` (o molde é a busca de titulares), `responderProva`, `aplicarAtividade` e `encerrarAtividade` do fixture.
10. **A operação em duas chamadas ao mesmo tempo:** (a) começar × começar, com a primeira presa no `insert` da tentativa e a segunda esperando a chave única (uma tentativa, o `limite_base_em` da primeira); (b) mudar a janela × começar, com a mudança presa no `update` e o `comecar` esperando o `for share`; o `tempo` que não espera o `for update` do encerramento.
11. **O isolamento quebra sem a cláusula:** o caso do repository tira escola, ano, aplicação e aluno de cada leitura, uma por vez, e exige vazio (cada `where` do repository tem bloco); o de outra turma e de outra escola sai fora da janela; o transferido e a escola sem ano completam.
12. **Os guardiões:** `tenancy-guardian` (o alcance antes da janela, o repository com escola e ano, o 404 igual), `privacy-guardian` (o tempo adicional só vira a duração, nunca o percentual nem o "adicional"; o contrato do aluno sem `saidas`) e `infra-guardian` (a trava `for share`, a corrida, o `tempo` sem trava, o 503 nas rotas novas, o balde por usuário).

## Fora do escopo desta tarefa

Embaralhamento (4.0); extensões (5.0, a rota do professor: aqui só a **leitura** delas no limite do aluno, com a linha posta por SQL no teste); saídas (8.0); a tela de foco (12.0); a rotina que grava a vencida como enviada (6.0: aqui ela só **conta** como enviada em toda leitura); o convocado da segunda chamada (9.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec |
|---|---|---|
| A linha "`minhas-atividades` vazia" da escola sem ano em curso: a rota responde `NAO_ENCONTRADO`; é o repository, com o ano trocado, que devolve lista vazia | O comportamento da rota é o de antes da tarefa (toda rota do aluno exige o ano em curso), e o caso prova as duas coisas | `cenarios.md` §1b, linha da escola sem ano em curso (já ajustada); a Tech Spec §4 não dizia o status da lista |

## Mutações

Cada bloco aplica a mutação, roda o caso citado e exige vermelho. Os nomes de caso não levam parênteses (o `-t` do vitest é regex). Os casos de integração rodam sobre o banco compartilhado, com o pulso renovado antes e devolvido ao que era no `afterAll`.

**Sem bloco, com o motivo (cláusula equivalente, coberta por outra peça ou que não se alcança):**

- `if (tentativa.limiteBaseEm === null) return null` em `limiteDaTentativaDoAluno`: sem limite base `limiteDaTentativa` também devolve `null` (a primeira linha dele); a guarda só poupa a leitura das extensões e do pulso. O bloco do `limiteBase === null` está na tarefa 2.0.
- `limite !== null &&` em `envioDaTentativa` (`if (limite !== null && venceu(limite, ...))`): `venceu` já devolve `false` para limite nulo; o termo é o estreitamento de tipo.
- `lida.alunoId !== null && lida.iniciadaEm !== null && lida.limiteBaseEm !== null` na lista das candidatas: os três nascem juntos (a tentativa tem os três, a atividade sem tentativa tem os três nulos), e o último termo (`venceu(lida.limiteBaseEm, ...)`) já é falso com o limite base nulo. Cada um sozinho é estreitamento de tipo; os termos que decidem (`enviadaEm === null`, `estado === 'aberta'`) têm bloco. O `&& venceu(lida.limiteBaseEm, lida.agora)` só poupa a conta do limite de quem não pode ter vencido: o resultado final (`limite !== null && venceu(limite, ...)`, com bloco) é o mesmo.
- `abreEm === null || fechaEm === null` em `janelaDaProva`: o check do banco (1.0) põe as duas pontas juntas ou nenhuma; um termo decide sozinho.
- `prova.abreEm !== null` e `prova.fechaEm !== null` na janela de `comecar`, **cada um sozinho**: o check do banco (1.0) põe as duas pontas juntas ou nenhuma, e o outro termo já faz o `&&` sair; tirar um deles não muda o que a função devolve. Os dois juntos têm o caso da atividade sem janela (a não avaliativa começa, em `o envio dentro do limite diz`), que cairia em `null.getTime()` sem eles.
- `inArray(extensaoDeTempo.atividadeAplicadaId, ...)` em `extensoesDas`: sem o termo a consulta traz também as extensões das outras aplicações do aluno, mas o resultado é agrupado por aplicação e cada linha da lista só lê a sua; é a poupança de linhas lidas, e o resultado é o mesmo.
- O `or(isNull(...), eq(...))` de `extensoes` e de `extensoesDas` **inteiro** (sem os dois termos o filtro some): `limiteDaTentativa` repete o filtro por aluno (a primeira linha do `reduce`), então o limite sai o mesmo; o `where` é a defesa em profundidade que mantém a extensão de outro aluno fora da memória da requisição. Cada termo sozinho tem bloco nas duas consultas (sem um deles a linha certa some e o limite, ou a conta da lista, muda).
- `escola_id` e `ano_letivo_id` na subconsulta de `percentual` da lista: o `atividade_aplicada_id` (uuid) já identifica a aplicação, e portanto a escola e o ano; os dois termos ficam para a consulta começar pelo escopo e usar o índice (regra 80, item 8; EXPLAIN em "Como testar"). Sem eles o resultado é o mesmo; o isolamento da lista está no `where` da própria lista (`#daMinhaTurma`), que tem bloco, e no caso de repository com a escola e o ano trocados.
- `(percentual ?? 0)` fica com bloco que troca o `0` por 50 (o `?? 0` sozinho é equivalente no JavaScript, porque `100 + null` é 100).
- `>= prova.fechaEm` contra `>` na janela: o instante exato do `fecha_em` não se reproduz com o `now()` do banco; o bloco do `<=` (que inverte o lado) e o de `fechaEm !== null` provam o termo.
- `if (tentativa === undefined) throw new InvariantException(...)` no fim do `comecar`: não se alcança (o `insert ... on conflict do nothing` deixa a linha, a sua ou a da outra aba).
- `if (atividadeAplicadaIds.length === 0) return porAplicacao` em `extensoesDas`: só se chama com a lista das candidatas, que não é vazia (o service sai antes). É a guarda da própria consulta (`inArray` vazio).
- `if (!anonima && ...)` e `if (token === undefined) throw` no guard do balde: o `comecar` não é rota anônima, e a recusa sem token é a do guard de sessão, que vem antes. É o mesmo molde do balde da busca de titulares.
- `return linha` / `COLUNAS_DA_TENTATIVA`, `agoraDoBanco` e os `select` que só carregam coluna: sem condição; o que elas carregam é lido por todos os casos acima.

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › o envio dentro do limite diz
-      if (tentativa.enviadaEm === null) {
+      if (true) {
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › um minuto antes do limite grava
-  return limite !== null && agora.getTime() > limite.getTime()
+  return limite !== null && agora.getTime() < limite.getTime()
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › o envio dentro do limite diz
-  return limite !== null && agora.getTime() > limite.getTime()
+  return agora.getTime() > limite.getTime()
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › um minuto antes do limite grava
falha: rotas.responder(ana, id, 2, 1)
       if (tentativa.enviadaEm !== null) throw new DomainException(ErrorCode.ATIVIDADE_ENCERRADA)
-      if (venceu(await limiteDaTentativaDoAluno(tx, id, tentativa), tentativa.agora)) throw new DomainException(ErrorCode.TEMPO_ESGOTADO)
       return atividades.responder(id, questao, alternativa, sequencia)
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › um minuto antes do limite grava
falha: rotas.enviar(ana, id)
         if (atividade.estado !== 'aberta') throw new DomainException(ErrorCode.ATIVIDADE_ENCERRADA)
-        if (venceu(await limiteDaTentativaDoAluno(tx, id, tentativa), tentativa.agora)) throw new DomainException(ErrorCode.TEMPO_ESGOTADO)
         await atividades.send(id)
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › o envio dentro do limite diz
-  if (tentativa.enviadaEm !== null) return { enviadaEm: tentativa.enviadaEm, envio: tentativa.envio ?? 'aluno' }
+  if (tentativa.enviadaEm !== null) return { enviadaEm: tentativa.enviadaEm, envio: tentativa.envio ?? 'limite' }
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › a atividade que a professora encerrou antes de o aluno enviar
-  if (estado === 'encerrada') return { enviadaEm: null, envio: 'encerramento' }
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › um minuto antes do limite grava
-  if (limite !== null && venceu(limite, tentativa.agora)) return { enviadaEm: limite, envio: 'limite' }
+  if (limite !== null && venceu(limite, tentativa.agora)) return { enviadaEm: null, envio: 'limite' }
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › `prova` sem tentativa traz o título
-  if (limite !== null && venceu(limite, tentativa.agora)) return { enviadaEm: limite, envio: 'limite' }
+  if (limite !== null) return { enviadaEm: limite, envio: 'limite' }
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › a lista conta como vencida a tentativa
-  if (lida.enviadaEm !== null || venceu) return 'enviada'
+  if (lida.enviadaEm !== null) return 'enviada'
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/atividade.int.test.ts › a lista do aluno acompanha a situação
-  if (lida.enviadaEm !== null || venceu) return 'enviada'
+  if (venceu) return 'enviada'
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › o tempo adicional do aluno vira só a duração dele
-    duracaoMin: lida.duracaoMin === null ? null : duracaoDoAlunoEmMinutos(lida.duracaoMin, lida.percentual),
+    duracaoMin: lida.duracaoMin === null ? null : lida.duracaoMin,
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/atividade.int.test.ts › a lista do aluno acompanha a situação
-    duracaoMin: lida.duracaoMin === null ? null : duracaoDoAlunoEmMinutos(lida.duracaoMin, lida.percentual),
+    duracaoMin: duracaoDoAlunoEmMinutos(lida.duracaoMin, lida.percentual),
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › o tempo adicional do aluno vira só a duração dele
-    janela: janelaDaProva(lida.abreEm, lida.fechaEm),
+    janela: null,
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › a lista conta como vencida a tentativa
-        return paraATela(lida, limite !== undefined, limite ?? lida.enviadaEm)
+        return paraATela(lida, limite !== undefined, lida.enviadaEm)
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › a lista conta como vencida a tentativa
-        return paraATela(lida, limite !== undefined, limite ?? lida.enviadaEm)
+        return paraATela(lida, false, limite ?? lida.enviadaEm)
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › a lista conta como vencida a tentativa
-      lida.alunoId !== null && lida.iniciadaEm !== null && lida.limiteBaseEm !== null && lida.enviadaEm === null && lida.estado === 'aberta' && venceu(lida.limiteBaseEm, lida.agora)
+      lida.alunoId !== null && lida.iniciadaEm !== null && lida.limiteBaseEm !== null && lida.estado === 'aberta' && venceu(lida.limiteBaseEm, lida.agora)
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › a lista conta como vencida a tentativa
-      lida.alunoId !== null && lida.iniciadaEm !== null && lida.limiteBaseEm !== null && lida.enviadaEm === null && lida.estado === 'aberta' && venceu(lida.limiteBaseEm, lida.agora)
+      lida.alunoId !== null && lida.iniciadaEm !== null && lida.limiteBaseEm !== null && lida.enviadaEm === null && venceu(lida.limiteBaseEm, lida.agora)
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/atividade.int.test.ts › a lista do aluno acompanha a situação
-    if (candidatas.length === 0) return vencidas
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › a lista conta como vencida a tentativa
-        const limite = limiteDaTentativa({ alunoId, iniciadaEm, limiteBase, extensoes: extensoes.get(lida.id) ?? [], indisponibilidades, pulso })
+        const limite = limiteDaTentativa({ alunoId, iniciadaEm, limiteBase, extensoes: extensoes.get(lida.id), indisponibilidades, pulso })
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › a lista conta como vencida a tentativa
-        if (limite !== null && venceu(limite, lida.agora)) vencidas.set(lida.id, limite)
+        if (limite !== null) vencidas.set(lida.id, limite)
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › `prova` sem tentativa traz o título
       respostas: respostas.map(({ questao, alternativa, sequencia }) => ({ questao, alternativa, sequencia })),
-      enviadaEm: enviadaEm?.toISOString() ?? null,
+      enviadaEm: enviadaEm?.toISOString(),
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/atividade.int.test.ts › a lista do aluno acompanha a situação
     aplicadaEm: lida.aplicadaEm.toISOString(),
-    enviadaEm: enviadaEm?.toISOString() ?? null,
+    enviadaEm: enviadaEm?.toISOString(),
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › o envio dentro do limite diz
-      return tempoResponseSchema.parse({ limiteEm: limite?.toISOString() ?? null, agora: tentativa.agora.toISOString(), envio: envioDaTentativa(tentativa, atividade.estado, limite).envio })
+      return tempoResponseSchema.parse({ limiteEm: limite?.toISOString(), agora: tentativa.agora.toISOString(), envio: envioDaTentativa(tentativa, atividade.estado, limite).envio })
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › o envio dentro do limite diz
-      tempo: { limiteEm: limite?.toISOString() ?? null, agora: tentativa.agora.toISOString(), envio },
+      tempo: { limiteEm: limite?.toISOString(), agora: tentativa.agora.toISOString(), envio },
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › `prova` sem tentativa traz o título
       const tentativa = await atividades.tentativa(id)
-      if (tentativa === undefined) {
+      if (false) {
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › o tempo adicional do aluno vira só a duração dele
-        const percentual = prova.duracaoMin === null ? null : await atividades.percentualDoAluno(id)
+        const percentual = null
         return provaOnlineResponseSchema.parse({
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › o tempo adicional do aluno vira só a duração dele
-          duracaoMin: prova.duracaoMin === null ? null : duracaoDoAlunoEmMinutos(prova.duracaoMin, percentual),
+          duracaoMin: prova.duracaoMin,
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/atividade.int.test.ts › começar a prova cria a tentativa do aluno
-          duracaoMin: prova.duracaoMin === null ? null : duracaoDoAlunoEmMinutos(prova.duracaoMin, percentual),
+          duracaoMin: duracaoDoAlunoEmMinutos(prova.duracaoMin, percentual),
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › o aluno de outra turma e o de outra escola, fora da janela
       const atividades = new MinhaAtividadeRepository(tx)
       const prova = await atividades.prova(id)
-      if (prova === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › o aluno de outra turma e o de outra escola, fora da janela
       const prova = await atividades.prova(id, true)
-      if (prova === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › começar de novo devolve
       let tentativa = await atividades.tentativa(id)
-      if (tentativa === undefined) {
+      if (true) {
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › antes de `abre_em` e depois de `fecha_em`
-        if (prova.abreEm !== null && prova.fechaEm !== null && (prova.agora.getTime() < prova.abreEm.getTime() || prova.agora.getTime() >= prova.fechaEm.getTime())) {
+        if (prova.abreEm !== null && prova.fechaEm !== null && prova.agora.getTime() >= prova.fechaEm.getTime()) {
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › antes de `abre_em` e depois de `fecha_em`
-        if (prova.abreEm !== null && prova.fechaEm !== null && (prova.agora.getTime() < prova.abreEm.getTime() || prova.agora.getTime() >= prova.fechaEm.getTime())) {
+        if (prova.abreEm !== null && prova.fechaEm !== null && prova.agora.getTime() < prova.abreEm.getTime()) {
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › antes de `abre_em` e depois de `fecha_em`
-        if (prova.abreEm !== null && prova.fechaEm !== null && (prova.agora.getTime() < prova.abreEm.getTime() || prova.agora.getTime() >= prova.fechaEm.getTime())) {
+        if (prova.abreEm !== null && prova.fechaEm !== null && (prova.agora.getTime() > prova.abreEm.getTime() || prova.agora.getTime() >= prova.fechaEm.getTime())) {
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › antes de `abre_em` e depois de `fecha_em`
-        if (prova.abreEm !== null && prova.fechaEm !== null && (prova.agora.getTime() < prova.abreEm.getTime() || prova.agora.getTime() >= prova.fechaEm.getTime())) {
+        if (prova.abreEm !== null && prova.fechaEm !== null && (prova.agora.getTime() < prova.abreEm.getTime() || prova.agora.getTime() <= prova.fechaEm.getTime())) {
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/atividade.int.test.ts › depois de encerrada, a resposta e o envio são recusados
-        if (prova.estado !== 'aberta') throw new DomainException(ErrorCode.ATIVIDADE_ENCERRADA)
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › o tempo adicional do aluno vira só a duração dele
-        const percentual = prova.duracaoMin === null ? null : await atividades.percentualDoAluno(id)
+        const percentual = null
         await atividades.comecar(id, limiteBaseDaTentativa({ agora: prova.agora, fechaEm: prova.fechaEm, duracaoMin: prova.duracaoMin, percentual }))
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › `prova` sem tentativa traz o título
falha: rotas.tempo(ana, id)
       const tentativa = await atividades.tentativa(id)
-      if (tentativa === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › `prova` sem tentativa traz o título
falha: rotas.responder(ana, id, 1, 0)
       const tentativa = await atividades.tentativaTravada(id)
-      if (tentativa === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › `prova` sem tentativa traz o título
falha: rotas.enviar(ana, id)
       let tentativa = await atividades.tentativaTravada(id)
-      if (tentativa === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › o aluno transferido, com tentativa na turma A
       const atividade = await atividades.leitura(id)
-      if (atividade === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › `tempo` é leitura sem trava
-      const atividade = await atividades.leitura(id)
+      const atividade = await atividades.lockParaGravar(id)
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › cada leitura da prova do aluno acha o dado
   async tentativa(atividadeAplicadaId: string): Promise<TentativaLida | undefined> {
-    const [linha] = await this.banco.select(COLUNAS_DA_TENTATIVA).from(tentativaAtividade).where(this.#minha(tentativaAtividade, atividadeAplicadaId))
+    const [linha] = await this.banco.select(COLUNAS_DA_TENTATIVA).from(tentativaAtividade).where(eq(tentativaAtividade.atividadeAplicadaId, atividadeAplicadaId))
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › cada leitura da prova do aluno acha o dado
-    const [linha] = await this.banco.select(COLUNAS_DA_TENTATIVA).from(tentativaAtividade).where(this.#minha(tentativaAtividade, atividadeAplicadaId)).for('update')
+    const [linha] = await this.banco.select(COLUNAS_DA_TENTATIVA).from(tentativaAtividade).where(eq(tentativaAtividade.atividadeAplicadaId, atividadeAplicadaId)).for('update')
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › cada leitura da prova do aluno acha o dado
-    const [linha] = await this.banco.select({ percentual: tempoAdicional.percentual }).from(tempoAdicional).where(this.#minha(tempoAdicional, atividadeAplicadaId))
+    const [linha] = await this.banco.select({ percentual: tempoAdicional.percentual }).from(tempoAdicional).where(eq(tempoAdicional.atividadeAplicadaId, atividadeAplicadaId))
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › cada leitura da prova do aluno acha o dado
-    return (linha?.percentual as PercentualDeTempoAdicional | undefined) ?? null
+    return linha?.percentual as PercentualDeTempoAdicional | undefined
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › cada leitura da prova do aluno acha o dado
-eq(extensaoDeTempo.escolaId, requireEscolaId()),
 eq(extensaoDeTempo.anoLetivoId, requireAnoEmCurso()),
 eq(extensaoDeTempo.atividadeAplicadaId, atividadeAplicadaId),
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › cada leitura da prova do aluno acha o dado
 eq(extensaoDeTempo.escolaId, requireEscolaId()),
-eq(extensaoDeTempo.anoLetivoId, requireAnoEmCurso()),
 eq(extensaoDeTempo.atividadeAplicadaId, atividadeAplicadaId),
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › cada leitura da prova do aluno acha o dado
-eq(extensaoDeTempo.escolaId, requireEscolaId()),
 eq(extensaoDeTempo.anoLetivoId, requireAnoEmCurso()),
 inArray(extensaoDeTempo.atividadeAplicadaId, [...atividadeAplicadaIds]),
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › cada leitura da prova do aluno acha o dado
 eq(extensaoDeTempo.escolaId, requireEscolaId()),
-eq(extensaoDeTempo.anoLetivoId, requireAnoEmCurso()),
 inArray(extensaoDeTempo.atividadeAplicadaId, [...atividadeAplicadaIds]),
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › a extensão do aluno e a da turma somam ao limite
-          eq(extensaoDeTempo.atividadeAplicadaId, atividadeAplicadaId),
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › a extensão do aluno e a da turma somam ao limite
           eq(extensaoDeTempo.atividadeAplicadaId, atividadeAplicadaId),
-          or(isNull(extensaoDeTempo.alunoId), eq(extensaoDeTempo.alunoId, requestSessao().usuarioId)),
+          eq(extensaoDeTempo.alunoId, requestSessao().usuarioId),
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › a extensão do aluno e a da turma somam ao limite
           eq(extensaoDeTempo.atividadeAplicadaId, atividadeAplicadaId),
-          or(isNull(extensaoDeTempo.alunoId), eq(extensaoDeTempo.alunoId, requestSessao().usuarioId)),
+          isNull(extensaoDeTempo.alunoId),
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › a lista conta como vencida a tentativa
-    for (const { atividadeAplicadaId, ...extensao } of linhas) porAplicacao.set(atividadeAplicadaId, [...(porAplicacao.get(atividadeAplicadaId) ?? []), extensao])
+    for (const { atividadeAplicadaId, ...extensao } of linhas) porAplicacao.set(atividadeAplicadaId, [...porAplicacao.get(atividadeAplicadaId), extensao])
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › o envio dentro do limite diz
-      .set({ enviadaEm: sql`now()`, envio: 'aluno' })
+      .set({ enviadaEm: sql`now()` })
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.controller.ts
teste: apps/api/src/atividade/pulso/pulso.int.test.ts › aceitam `comecar`
   @Post('atividades-aplicadas/:id/comecar')
-  @UseGuards(RotasDeProvaGuard)
   @ComecarProvaRateLimit()
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.controller.ts
teste: apps/api/src/atividade/pulso/pulso.int.test.ts › aceitam `comecar`
   @Get('atividades-aplicadas/:id/tempo')
-  @UseGuards(RotasDeProvaGuard)
   @RequirePermissao('minha_atividade', 'ler_tempo')
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.controller.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › a 31ª chamada do minuto é 429
-  @ComecarProvaRateLimit()
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.controller.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › antes de `abre_em` e depois de `fecha_em`
-  @HttpCode(HttpStatus.OK)
   @Header('Cache-Control', 'no-store')
   comecar(@Param('id', IdPipe) atividadeAplicadaId: string, @Body(new ZodValidationPipe(emptyOrMissingBodyRequestSchema)) _corpo: EmptyBodyRequest): Promise<ProvaOnlineResponse> {
```

```mutacao
arquivo: packages/core/src/rate-limit/rate-limit.guard.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › a 31ª chamada do minuto é 429
-    if (!anonima && this.reflector.getAllAndOverride<boolean | undefined>(COMECAR_PROVA_RATE_LIMIT_KEY, alvos) === true) {
+    if (!anonima && this.reflector.getAllAndOverride<boolean | undefined>(COMECAR_PROVA_RATE_LIMIT_KEY, alvos) === false) {
```

```mutacao
arquivo: packages/core/src/rate-limit/rate-limit.guard.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › a 31ª chamada do minuto é 429
-      if (!doComecar.aceita) {
+      if (doComecar.aceita) {
```

```mutacao
arquivo: packages/core/src/rate-limit/rate-limiter.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › a 31ª chamada do minuto é 429
-    return this.#consumeUmaChave(this.#comecarProva, usuarioId)
+    return this.#consumeUmaChave(this.#comecarProva, 'todos')
```

```mutacao
arquivo: packages/shared/src/atividade/prova.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › a 31ª chamada do minuto é 429
-export const LIMITE_DO_COMECAR_POR_MINUTO = 30
+export const LIMITE_DO_COMECAR_POR_MINUTO = 31
```

```mutacao
arquivo: packages/shared/src/atividade/limite-da-tentativa.ts
teste: packages/shared/src/atividade/limite-da-tentativa.test.ts › sem tempo adicional é a da prova
-  return 600 * duracaoMin * (100 + (percentual ?? 0))
+  return 600 * duracaoMin * (100 + (percentual ?? 50))
```

```mutacao
arquivo: packages/shared/src/atividade/limite-da-tentativa.ts
teste: packages/shared/src/atividade/limite-da-tentativa.test.ts › arredonda para cima
-  return Math.ceil(duracaoDoAlunoEmMs(duracaoMin, percentual) / MS_POR_MINUTO)
+  return Math.floor(duracaoDoAlunoEmMs(duracaoMin, percentual) / MS_POR_MINUTO)
```

```mutacao
arquivo: packages/shared/src/atividade/limite-da-tentativa.ts
teste: packages/shared/src/atividade/limite-da-tentativa.test.ts › sem duração o limite é o fim da janela
-  if (fechaEm === null) return null
```

```mutacao
arquivo: packages/shared/src/atividade/limite-da-tentativa.ts
teste: packages/shared/src/atividade/limite-da-tentativa.test.ts › sem duração o limite é o fim da janela
-  if (duracaoMin === null) return fechaEm
```

```mutacao
arquivo: packages/shared/src/atividade/limite-da-tentativa.ts
teste: packages/shared/src/atividade/limite-da-tentativa.test.ts › começando a 10 min do fim
-  return new Date(Math.min(agora.getTime() + duracaoDoAlunoEmMs(duracaoMin, percentual), fechaEm.getTime()))
+  return new Date(Math.max(agora.getTime() + duracaoDoAlunoEmMs(duracaoMin, percentual), fechaEm.getTime()))
```

```mutacao
arquivo: packages/shared/src/atividade/limite-da-tentativa.ts
teste: packages/shared/src/atividade/limite-da-tentativa.test.ts › o tempo adicional soma
-  return new Date(Math.min(agora.getTime() + duracaoDoAlunoEmMs(duracaoMin, percentual), fechaEm.getTime()))
+  return new Date(Math.min(agora.getTime() + duracaoDoAlunoEmMs(duracaoMin, null), fechaEm.getTime()))
```

```mutacao
arquivo: apps/web/src/api/atividades-do-aluno.ts
teste: apps/web/src/areas/aluno/Atividade.test.tsx › a tela chama `comecar`
-      await comecarProva(atividadeAplicadaId)
```

```mutacao
arquivo: apps/web/src/api/atividades-do-aluno.ts
teste: apps/web/src/areas/aluno/Atividade.test.tsx › a leitura que ainda diz que a prova não começou
-      if (!lida.comecou) throw new ApiError(ErrorCode.NAO_ENCONTRADO)
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › enviar × responder: o PUT que chega com o envio segurado
-    const [linha] = await this.banco.select(COLUNAS_DA_TENTATIVA).from(tentativaAtividade).where(this.#minha(tentativaAtividade, atividadeAplicadaId)).for('update')
+    const [linha] = await this.banco.select(COLUNAS_DA_TENTATIVA).from(tentativaAtividade).where(this.#minha(tentativaAtividade, atividadeAplicadaId))
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › começar × começar com a primeira segurada
-      .onConflictDoNothing({ target: [tentativaAtividade.escolaId, tentativaAtividade.anoLetivoId, tentativaAtividade.atividadeAplicadaId, tentativaAtividade.alunoId] })
+      .onConflictDoUpdate({ target: [tentativaAtividade.escolaId, tentativaAtividade.anoLetivoId, tentativaAtividade.atividadeAplicadaId, tentativaAtividade.alunoId], set: { limiteBaseEm: sql`excluded.limite_base_em` } })
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › mudar a janela × começar
-      const prova = await atividades.prova(id, true)
+      const prova = await atividades.prova(id)
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › o tempo adicional do aluno vira só a duração dele
-        percentual: sql<PercentualDeTempoAdicional | null>`(select ${tempoAdicional.percentual} from ${tempoAdicional} where ${tempoAdicional.escolaId} = ${atividadeAplicada.escolaId} and ${tempoAdicional.anoLetivoId} = ${atividadeAplicada.anoLetivoId} and ${tempoAdicional.atividadeAplicadaId} = ${atividadeAplicada.id} and ${tempoAdicional.alunoId} = ${usuarioId})`,
+        percentual: sql<PercentualDeTempoAdicional | null>`(select ${tempoAdicional.percentual} from ${tempoAdicional} where ${tempoAdicional.escolaId} = ${atividadeAplicada.escolaId} and ${tempoAdicional.anoLetivoId} = ${atividadeAplicada.anoLetivoId} and ${tempoAdicional.atividadeAplicadaId} = ${atividadeAplicada.id})`,
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › o tempo adicional do aluno vira só a duração dele
-        percentual: sql<PercentualDeTempoAdicional | null>`(select ${tempoAdicional.percentual} from ${tempoAdicional} where ${tempoAdicional.escolaId} = ${atividadeAplicada.escolaId} and ${tempoAdicional.anoLetivoId} = ${atividadeAplicada.anoLetivoId} and ${tempoAdicional.atividadeAplicadaId} = ${atividadeAplicada.id} and ${tempoAdicional.alunoId} = ${usuarioId})`,
+        percentual: sql<PercentualDeTempoAdicional | null>`(select ${tempoAdicional.percentual} from ${tempoAdicional} where ${tempoAdicional.escolaId} = ${atividadeAplicada.escolaId} and ${tempoAdicional.anoLetivoId} = ${atividadeAplicada.anoLetivoId} and ${tempoAdicional.alunoId} = ${usuarioId})`,
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › a lista conta como vencida a tentativa
           inArray(extensaoDeTempo.atividadeAplicadaId, [...atividadeAplicadaIds]),
-          or(isNull(extensaoDeTempo.alunoId), eq(extensaoDeTempo.alunoId, requestSessao().usuarioId)),
+          eq(extensaoDeTempo.alunoId, requestSessao().usuarioId),
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › a lista conta como vencida a tentativa
           inArray(extensaoDeTempo.atividadeAplicadaId, [...atividadeAplicadaIds]),
-          or(isNull(extensaoDeTempo.alunoId), eq(extensaoDeTempo.alunoId, requestSessao().usuarioId)),
+          isNull(extensaoDeTempo.alunoId),
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisor-geral 1ª | A checagem `estado === 'encerrada'` vem antes da do limite: a tentativa que venceu antes de a professora encerrar sai como `envio: 'encerramento'`, e a §5.5 diz "vencida sem envio conta como enviada em toda leitura". Registrar na Tech Spec ou inverter a ordem | Muda comportamento e a Tech Spec não diz. Destino: tarefa 6.0 (que passa a gravar a vencida e depende do `envio`), com a escolha escrita na Tech Spec pelo Arquiteto antes dela |
| revisor-geral 1ª | Estado sem saída: o aluno que nunca começou uma atividade encerrada vê `ErrorState` com "Tentar de novo" (`Atividade.tsx`), e a simulação do e2e (`e2e/support/aluno.ts`) responde 200 e esconde o caso | Muda tela. Destino: tarefa 12.0 (a tela de foco, que toca `Atividade.tsx`) |
| revisor-geral 1ª | `signal` vai ao GET da prova e não ao `comecarProva` (`atividades-do-aluno.ts`) | Recusada: o `comecar` é idempotente, e o revisor mesmo o diz inofensivo |
| conformidade-reviewer 1ª | Na 6.0, o lote de correção mostrar qual tentativa foi enviada pelo limite, e o registro da validação (D56) guardar isso | Destino: tarefa 6.0 |
| conformidade-reviewer 1ª | A tela de foco (12.0) dizer ao aluno, em português comum, que a prova foi enviada porque o tempo acabou | Destino: tarefa 12.0 (a web hoje descarta `tempo.envio`) |
| privacy-guardian 1ª | Registrar em `docs/lgpd.md` os baldes por usuário do rate limit, entre eles `rl:comecar-prova:{usuarioId}` | Destino: `TODO.md`. O arquivo não é da tarefa e os baldes anteriores (`rl:busca-titular`, `rl:importacao`) também não estão lá; é uma passada só para todos |
| privacy-guardian 1ª | Citar na AIA ou no texto da 12.0 que quem tem tempo adicional pode deduzi-lo comparando a duração com a de um colega | Destino: tarefa 12.0 |
| infra-guardian 1ª | A carga `infra/k6/prova-online.js` precisa medir o PUT com o `tempo` a cada 30 s | Destino: tarefa 6.5 |
| infra-guardian 1ª | `comecar` ao abrir a prova faz o relógio correr desde a abertura, sem o aviso, quando o professor usar janela e duração antes da 12.0 | Destino: validação de produto, e a 12.0 (o aviso antes de começar) |
| test-engineer 1ª | O arquivo preserva as indisponibilidades que já estavam no banco; sobra de execução interrompida deixaria vermelhos os casos de `TEMPO_ESGOTADO` | Recusada: o `afterAll` já apaga as que o arquivo grava (`prova-online-aluno.int.test.ts:85`); o que sobra é de execução interrompida, e o banco de teste é refeito a cada portão |
| tenancy-guardian 2ª, revisor-geral 2ª, test-engineer 2ª | O caso novo de `extensoesDas` com o id de outra escola põe a outra escola também em outro ano letivo: tirar só o `eq(escolaId)` não o deixa vermelho. Falta um caso com o mesmo ano e outra escola, ou um bloco por termo | Destino: tarefa 5.0 (a rota das extensões, que toca `extensoesDas`). O isolamento da tarefa já está provado pelos casos do repository |
| revisor-geral 2ª | O rótulo "(c) enviar × responder" repete a letra do "(c)" de `cenarios.md` (resposta × encerrar e resposta × job). Trocar o rótulo ou acrescentar a linha com letra própria | Destino: `TODO.md` (o `cenarios.md` é documento da spec, do Arquiteto) |
| infra-guardian 2ª | No caso do `tempo` sem trava, o filtro `query ilike '%atividade_aplicada%'` pega também consultas das tabelas que citam `atividade_aplicada_id`; restringir a `'%from "atividade_aplicada"%for%'` ou filtrar pelo id | Destino: `TODO.md` (só falha por motivo errado, nunca passa por engano) |
| infra-guardian 2ª, test-engineer 2ª | A corrida (a) espera 1.100 ms de relógio de parede só para o `now()` mudar; um intervalo menor basta | Destino: retro da funcionalidade (D86): tempo a mais na suíte, não prazo |
| test-engineer 2ª | O bloco que tira o termo da aplicação no `percentual` fica vermelho por erro 500 do banco, e não por valor errado; uma asserção sobre o código do erro deixaria o motivo explícito | Recusada: o bloco já derruba o caso, e a regra (o `percentual` do aluno certo) está provada pelo bloco do termo do aluno |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-24 00:39:41 | 2026-11-24 00:40:35 | `tenancy-guardian` | 1 | APROVADO | a61090c6b158da778 |
| 2026-11-24 00:39:59 | 2026-11-24 00:41:01 | `conformidade-reviewer` | 1 | APROVADO | a8dbb7286c8f76ebd |
| 2026-11-24 00:39:45 | 2026-11-24 00:41:04 | `privacy-guardian` | 1 | APROVADO | a2082934d3def692f |
| 2026-11-24 00:39:48 | 2026-11-24 00:41:46 | `infra-guardian` | 1 | APROVADO | ab66fa8d9cafdb3c2 |
| 2026-11-24 00:39:56 | 2026-11-24 00:42:12 | `revisor-geral` | 1 | APROVADO | a126986cb99540d31 |
| 2026-11-24 00:39:52 | 2026-11-24 00:44:23 | `test-engineer` | 1 | REPROVADO | a5e9f18e3689a10bd |
| 2026-11-24 01:24:07 | 2026-11-24 01:24:27 | `privacy-guardian` | 2 | APROVADO | a5151e87b3441e669 |
| 2026-11-24 01:24:01 | 2026-11-24 01:24:34 | `tenancy-guardian` | 2 | APROVADO | a88951389f71dfb5d |
| 2026-11-24 01:24:13 | 2026-11-24 01:24:36 | `infra-guardian` | 2 | APROVADO | a09560b9e7346984d |
| 2026-11-24 01:24:24 | 2026-11-24 01:24:56 | `conformidade-reviewer` | 2 | APROVADO | a50f5f862881d3400 |
| 2026-11-24 01:24:19 | 2026-11-24 01:24:57 | `revisor-geral` | 2 | APROVADO | ad48880c3c32cf168 |
| 2026-11-24 01:24:38 | 2026-11-24 01:26:34 | `test-engineer` | 2 | APROVADO | a6276b5c3fdec4dc1 |
