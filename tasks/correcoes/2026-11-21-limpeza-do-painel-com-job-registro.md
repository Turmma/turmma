# Correção — a limpeza do painel do e2e não apagava o `job_registro` da escola e quebrava na chave estrangeira

**Origem:** esteira run 44862658083 (e2e 4/11): `e2e/operacao-escolas.spec.ts:595` cai no `afterEach`, em `e2e/support/painel.ts:194`
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`, `infra-guardian`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`

## Sintoma
O caso "recomeço: reabrir o diálogo sorteia outro id…" passa e cai no `afterEach` (`removerPainel`) com
`violates foreign key constraint "job_registro_escola_id_escola_id_fk"`: `delete from escola` falha porque a escola semeada
já tem linha em `job_registro`.

## Fora desta correção
nada

## Causa
`removerPainel` e `removerEscolaSemConvite` (`e2e/support/painel.ts`) apagam uso, convites, usuários, contas e a escola, mas não o que o
worker do ambiente de teste grava nela. Duas tabelas têm FK para `escola` sem `on delete`:

- `job_registro`: a rotina `sistema.expurgar-dado-pessoal` (1h, `apps/worker/src/job-schedules.ts`) grava um `retencao.expurgar-escola` por
  escola, e a das 19h (`sistema.agendar-classificacao`) grava um `material.agendar-classificacao` por escola. É o erro da esteira
  (`job_registro_escola_id_escola_id_fk`).
- `expurgo_execucao`: o job `retencao.expurgar-escola`, ao rodar, grava uma linha por categoria (`expurgo-da-escola.repository.ts`,
  `registrar`). É o mesmo defeito um passo adiante, achado pelo `test-engineer` na rodada 1.

A trilha da classificação das 19h foi conferida (`agendar-classificacao.ts`, `agendamento-da-classificacao.repository.ts`): o job por escola só
grava `execucao_agente` e `job_registro` quando há seção de material a classificar, e a escola sintética do painel não tem material. Nessas
escolas ela grava só o `job_registro`, já coberto.

Depende de o worker ter passado pela escola antes da limpeza: por isso intermitente, e só na esteira, que roda o worker junto. Defeito da
develop (F3, que criou as tabelas), não de tarefa desta spec.

## Teste que reproduz
`tools/ci/painel-do-e2e.int.test.ts`, dois casos (`removerPainel` e `removerEscolaSemConvite`). Cada um semeia, grava na escola o que o worker
grava (um `job_registro` com `TIPO_EXPURGAR_ESCOLA`, importado de `@educa/shared`, e uma linha de `expurgo_execucao`), confere as duas
pré-condições, limpa e espera que a escola, o job e a linha tenham saído **e que o job e a linha de uma escola de fora do seed continuem lá**
(a limpeza não alcança outra escola). O teste de `tools/ci/` importa `@educa/shared` sem problema: o projeto `integracao` o resolve como o
das APIs.

**Vermelho antes** (HEAD, só o `job_registro` na primeira versão do teste): os dois casos caem com
`update or delete on table "escola" violates foreign key constraint "job_registro_escola_id_escola_id_fk"`, em `painel.ts:194` e `:260`, a
mesma mensagem da esteira. Com a rodada 1, o caso grava também `expurgo_execucao`, e cada `delete` tem o seu bloco de mutação, vermelho
sem ele. **Verde depois:** 2 de 2.

## Correção
Os dois removedores apagam `expurgo_execucao where escola_id = …` e `job_registro where escola_id = …`, nessa ordem, antes de
`delete from escola`. O comentário de `removerPainel` diz o que cada rotina grava. Só `e2e/support/painel.ts` muda; o produto não.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisor-geral (1ª), infra-guardian (1ª), test-engineer (1ª) | Corrida restante: o worker pode gravar um `job_registro` entre o `delete from job_registro` e o `delete from escola`. Saída proposta pelos dois últimos: transação que começa por `select id from escola where id = any($1) for update` | `TODO.md`, seção "Infra e operação": a janela é de milissegundos e fechá-la pede transação nos removedores e um teste de concorrência que não se escreve de forma determinística, o que o bloco de mutação exige. Revisar se a falha voltar na esteira |
| revisor-geral (1ª), infra-guardian (1ª) | Levantamento único dos outros removedores de `escola` em `e2e/support/` (10 arquivos, cada um com o seu `comBanco`, nenhum apaga `job_registro`) | `TODO.md`, seção "Infra e operação": é outra correção, em dez arquivos, e a tarefa em curso corrige o `painel.ts` |
| revisor-geral (1ª) | Conferir se outra tabela com FK para `escola`, sem `on delete`, é gravada pelo worker | Atendida na parte do item 1 (`expurgo_execucao` e a rotina das 19h). O restante do levantamento vai na linha do `TODO.md` acima |
| test-engineer (2ª) | `removerEscolaSemConvite` não apaga `uso_infra_diario` (FK para `escola`, gravada pela rotina das 2h, `consolidar-uso`); a "Causa" não cita essa rotina. Só falha se o e2e atravessar as 2h com a escola viva | `TODO.md`, na linha do levantamento dos outros removedores |
| infra-guardian (2ª) | O comentário de `removerPainel` diz que a rotina das 19h só grava `job_registro` porque a escola sintética não tem material: vale só enquanto o seed do painel não semear material (senão a classificação grava `execucao_agente`, que também aponta para a escola) | `TODO.md`, mesma linha, como condição do levantamento |
| privacy-guardian (2ª) | O `afterAll` do teste apaga a escola de fora do seed em comandos soltos, e o worker pode gravar nela e recusar a FK (dado sintético, só no banco de teste) | `TODO.md`, mesma linha, junto da corrida restante e do ponto único de limpeza |
| revisor-geral (2ª) | O `afterAll` repete à mão a sequência de `delete` dos removedores (três lugares se surgir outra tabela) | `TODO.md`: já é o item "mover a limpeza para um ponto só" da mesma linha |
| revisor-geral (2ª) | `contar` monta o nome da tabela por interpolação (o tipo só leva três valores fixos; só legibilidade) | Recusada: o tipo `'escola' \| 'job_registro' \| 'expurgo_execucao'` fecha os valores, e o revisor diz que não há risco |
| tenancy-guardian (2ª) | Proteger o `afterAll` com `if (foraDoSeed)`: se o `beforeAll` falhar antes de preencher, o erro do `afterAll` esconde a causa | `TODO.md`, mesma linha (limpeza do teste) |
| test-engineer (2ª) | "Nessa ordem" sugere dependência entre `expurgo_execucao` e `job_registro`, que não há FK entre si | Recusada: é só texto, sem efeito no código; a ordem é a das duas rotinas (o job, depois a linha que ele grava) |

## Mutações

--faltando: 0 linhas (0 blocos, 0 motivos)

O `--faltando` não lista nada (`e2e/support` não é código de produção). Cada cláusula acrescentada tem o seu bloco, quatro ao todo: o
`delete from job_registro` e o `delete from expurgo_execucao` de cada removedor. O `delete from expurgo_execucao` vem antes do `job_registro`, e
o bloco tira só ele, deixando a linha irmã.

```mutacao
arquivo: e2e/support/painel.ts
teste: tools/ci/painel-do-e2e.int.test.ts › removerPainel apaga as escolas semeadas
-    await banco.query('delete from job_registro where escola_id = any($1::uuid[])', [escolas])
     await banco.query('delete from escola where id = any($1::uuid[])', [escolas])
```

```mutacao
arquivo: e2e/support/painel.ts
teste: tools/ci/painel-do-e2e.int.test.ts › removerPainel apaga as escolas semeadas
-    await banco.query('delete from expurgo_execucao where escola_id = any($1::uuid[])', [escolas])
     await banco.query('delete from job_registro where escola_id = any($1::uuid[])', [escolas])
```

```mutacao
arquivo: e2e/support/painel.ts
teste: tools/ci/painel-do-e2e.int.test.ts › removerEscolaSemConvite apaga a escola com o job
-    await banco.query('delete from job_registro where escola_id = $1', [escola.id])
     await banco.query('delete from escola where id = $1', [escola.id])
```

```mutacao
arquivo: e2e/support/painel.ts
teste: tools/ci/painel-do-e2e.int.test.ts › removerEscolaSemConvite apaga a escola com o job
-    await banco.query('delete from expurgo_execucao where escola_id = $1', [escola.id])
     await banco.query('delete from job_registro where escola_id = $1', [escola.id])
```

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-21 02:19:32 | 2026-11-21 02:19:49 | `revisor-geral` | 1 | APROVADO | a2a7df9968d81d4e4 |
| 2026-11-21 02:19:36 | 2026-11-21 02:19:50 | `conformidade-reviewer` | 1 | APROVADO | a513d9357c7eaf0e9 |
| 2026-11-21 02:19:34 | 2026-11-21 02:19:51 | `tenancy-guardian` | 1 | APROVADO | a4dd262a2dce4803a |
| 2026-11-21 02:19:35 | 2026-11-21 02:19:52 | `privacy-guardian` | 1 | APROVADO | aafa56445e62d736f |
| 2026-11-21 02:19:33 | 2026-11-21 02:20:01 | `infra-guardian` | 1 | APROVADO | a1b205cfb364a9777 |
| 2026-11-21 02:19:30 | 2026-11-21 02:21:25 | `test-engineer` | 1 | REPROVADO | a2fc3e3b9acb3b01e |
| 2026-11-21 02:35:34 | 2026-11-21 02:35:56 | `revisor-geral` | 2 | APROVADO | a72ad0f6e1ff2636e |
| 2026-11-21 02:35:46 | 2026-11-21 02:36:03 | `tenancy-guardian` | 2 | APROVADO | a155327cd3a8378d8 |
| 2026-11-21 02:35:40 | 2026-11-21 02:36:05 | `infra-guardian` | 2 | APROVADO | ae17280af59802261 |
| 2026-11-21 02:35:51 | 2026-11-21 02:36:12 | `privacy-guardian` | 2 | APROVADO | a510d2f6ea68c85ee |
| 2026-11-21 02:35:56 | 2026-11-21 02:36:16 | `conformidade-reviewer` | 2 | APROVADO | acc2867911c8bc8fd |
| 2026-11-21 02:35:27 | 2026-11-21 02:36:46 | `test-engineer` | 2 | APROVADO | a426ef7b6d7b491ff |
