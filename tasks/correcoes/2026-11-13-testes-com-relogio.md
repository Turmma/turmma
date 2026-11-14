# Correção — testes de integração que dependem do relógio de parede da máquina

**Origem:** teste intermitente, achado na tarefa 9.0 de `ingestao-do-material`.
**Subagentes obrigatórios:** `test-engineer`, `conformidade-reviewer`, `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
<!-- `test-engineer` e `conformidade-reviewer` vieram no PEDIDO do Orquestrador. Os outros três entram porque os três
     `*.int.test.ts` alterados, de `apps/`, pedem os quatro guardiões do PADRAO (`tools/processo/guardioes-por-caminho.ts`),
     como a Mesa apontou na DEVOLUÇÃO. -->

## Sintoma

Na máquina de desenvolvimento (WSL), a hora de parede recua cerca de 1,2 s a cada 25 s, e o relógio monotônico anda
cerca de 3,5% à frente. Testes de integração que gravam dois instantes seguidos no banco, no mesmo milissegundo de
parede, passam a gravar o segundo **antes** do primeiro, e o banco recusa o par.

## Fora desta correção

Nada: a árvore estava limpa.

## Causa

A tabela `suspensao_de_funcao` tem a checagem `suspensao_de_funcao_retomada_depois` (`retomada_em >= suspensa_em`).
O `suspensa_em` nasce de `defaultNow()` na hora da suspensão, e o helper de retomada gravava `retomada_em = now()` poucos
milissegundos depois, em outra transação. Com a hora de parede da máquina recuando ~1,2 s, o segundo instante cai antes
do primeiro e o banco recusa o `update` (`violates check constraint "suspensao_de_funcao_retomada_depois"`). A checagem
está certa e fica: a causa é o teste supor que a hora de parede só avança.

Já usavam `greatest(now(), suspensa_em)`, desde a 9.0: `tutor.int.test.ts`, `assistente.int.test.ts` e
`artefato.int.test.ts`. Faltavam os quatro helpers do pedido: `entrega.int.test.ts` (linha 398), `ia.int.test.ts` (339 e 685)
e `atividade.int.test.ts` (531).

Uma quinta linha com a mesma causa está em `packages/core`, e a primeira leitura, que ficou em `apps/`, não a viu:
`packages/core/src/db/schema/mvp/mvp-tables.int.test.ts:1352`, no caso "no máximo uma suspensão vigente por escola e função;
retomada, a função pode ser suspensa de novo". A suspensão nasce com o `defaultNow()` em autocommit e a retomada é um
`update … retomada_em = now()` de outra transação, sem `begin` em volta: o mesmo recuo esbarra na mesma checagem. Ela
também passou para `greatest(now(), suspensa_em)`, e a linha 1351, logo acima, também: ela prova a recusa
`suspensao_de_funcao_retomada_registrada` (retomada sem autor), mas o Postgres confere as checagens pela ordem do nome e para
na primeira que falha, e `…_retomada_depois` vem antes de `…_retomada_registrada`. Com o recuo, o `now()` da 1351 viola as
duas e o banco devolve a errada. Com `greatest`, ela viola só a que o caso espera.

Uma sexta linha, a que a leitura por amostragem também não viu: `apps/api/test/suboperador.int.test.ts:581`
(`fim = now()` depois do `inicio` de `defaultNow()`, recusada por `suboperador_vigencia_ordenada`), que passou para
`greatest(now(), inicio)`. A linha 580 (`inserir(valida)`) grava o suboperador sem `inicio`, e ele nasce de `defaultNow()` em
autocommit; a 581 grava `fim` em outra transação.

**A varredura, pela lista das checagens e não por amostragem.** Foram lidas as checagens que comparam dois instantes da mesma
linha, em todas as migrations (`packages/core/drizzle/*.sql`), com a coluna que tem `DEFAULT now()` de cada uma. Só quebra com
o recuo o par em que um instante nasce de `now()` numa transação e o outro de `now()` em outra.

| Checagem | Coluna com `DEFAULT now()` | Exposta nos testes? |
|---|---|---|
| `suspensao_de_funcao_retomada_depois` (`retomada_em >= suspensa_em`) | `suspensa_em` | sim: as seis linhas de teste desta correção (`entrega` 398, `ia` 339 e 685, `atividade` 531, `mvp-tables` 1351 e 1352) e a rota de produção da governança |
| `suboperador_vigencia_ordenada` (`fim >= inicio`) | `inicio` | sim: `suboperador.int.test.ts:581` e a rota de produção `encerrar` |
| `suboperador_escola_vigencia_ordenada` (`fim >= inicio`) | `inicio` | não: todo `fim` dos testes é valor fixo ou sai no mesmo statement que o `inicio` (320, 351, 355, 362, 409, 600) |
| `tentativa_atividade_envio_depois_do_inicio` (`enviada_em >= iniciada_em`) | `iniciada_em` | não: todo `insert` com `enviada_em = now()` grava os dois no mesmo statement; só a rota de produção `enviar` |
| `incidente_conhecido_antes_do_registro` (`conhecido_em <= registrado_em`) | `registrado_em` | não: os dois saem do mesmo `insert`, e os testes dão folga de horas |
| `arquivo_titular_expira_depois_de_pronto` | nenhuma | não: os dois vêm juntos, com dias de diferença |
| `licenca_de_material_vigencia_valida`, `ano_letivo_periodo_valido`, `aula_horario_valido`, `alocacao_horario_valido`, `evento_calendario_periodo_valido`, `configuracao_operacional_horario_valido` | nenhuma | não: data ou hora informada, sem `now()` |

As linhas de teste expostas são sete, em seis arquivos.

Os outros usos de `now()` ou de `retomada_em` nos testes foram lidos um a um, em `apps/`, `packages/`, `e2e/` e `infra/`,
e não quebram com o recuo: `decidido_em` e `encerrado_em` do vínculo e `concluida_em` da execução não têm checagem que compare
dois instantes; `apps/api/test/arquivo-do-titular.int.test.ts:409` está seguro, porque grava `suspensa_em` (`defaultNow()`) e
`retomada_em = now() + interval '1 second'` no mesmo statement, e os dois instantes saem da mesma transação; e
`e2e/support/governanca.ts:254` só lê `retomada_em is not null`.

**A ordem das checagens, conferida** (Postgres 18 do compose de teste, tabela temporária com as duas checagens declaradas na
ordem `…_retomada_registrada`, `…_retomada_depois`, e `a` gravado 1,2 s no futuro): `update s set r = now()` →
`violates check constraint "s_retomada_depois"`; `update s set r = greatest(now(), a)` →
`violates check constraint "s_retomada_registrada"`. O banco confere pela ordem do nome, não pela da declaração.

## Teste que reproduz

Determinístico, no Postgres do compose de teste: uma suspensão com `suspensa_em = now() + 1,2 s` (o instante que o recuo
produz) e o helper antigo.

- `update … set retomada_em = now() …` → `ERROR: new row for relation "suspensao_de_funcao" violates check constraint
  "suspensao_de_funcao_retomada_depois"` (vermelho antes).
- `update … set retomada_em = greatest(now(), suspensa_em) …` → `UPDATE 1` (verde depois).

Não há caso novo: o que muda é o helper dos casos que já existem, e o vermelho deles depende do relógio da máquina, que
um teste não controla. Por isso a evidência é a reprodução acima mais a estabilidade (passo 4 de `corrigir`).

**Estabilidade (10 execuções seguidas, sem falha):** `entrega.int.test.ts`, `ia.int.test.ts` e `atividade.int.test.ts` juntos,
93 casos × 10; `tutor.int.test.ts` inteiro, 47 casos × 10; `packages/core/src/db/schema/mvp/mvp-tables.int.test.ts` inteiro, 72 casos × 10 (de novo, depois da troca da 1351: 10 de 10 verdes);
`apps/api/test/suboperador.int.test.ts` inteiro, 17 casos × 10 (10 de 10 verdes, depois da troca da 581); e os quatro casos "transferido"
do tutor isolados, 4 × 25.

## Correção

Arquivos alterados: `apps/api/src/entrega/entrega.int.test.ts`, `apps/api/src/ia/ia.int.test.ts`,
`apps/api/src/atividade/atividade.int.test.ts`, `packages/core/src/db/schema/mvp/mvp-tables.int.test.ts` e
`apps/api/test/suboperador.int.test.ts`. Nas sete linhas (os quatro helpers do pedido, as duas do `mvp-tables` e a do
`suboperador`), `retomada_em = now()` virou `retomada_em = greatest(now(), suspensa_em)`, o mesmo que os três outros arquivos
já tinham; a do `suboperador` usa `greatest(now(), inicio)`. Não afrouxa nada: a checagem do banco continua, e o que os casos provam (a função suspensa não corre, a
retomada a reativa) não muda; só o instante da retomada deixa de poder ficar antes da suspensão.

**Sem mutação:** nenhum arquivo de `apps/*/src` ou `packages/*/src` fora de teste foi alterado; só arquivos `*.int.test.ts`. A linha do `mvp-tables` também é só de teste, e não muda isto.

**Não reproduzido: "aluno transferido" do `tutor.int.test.ts`.** Os casos "transferido" (linhas 559, 932, 959 e 970) passaram
em 25 de 25 execuções isoladas e em 10 de 10 do arquivo inteiro. Lido o caminho deles: `turmaDoAluno` escolhe o vínculo
`confirmado` (só o novo, depois de `transferir`), e a tabela `vinculo` não tem checagem que compare `decidido_em` com
`encerrado_em`. Não encontrei dependência do relógio de parede que a explique, e não mudei nada ali por palpite: se voltar,
o próximo vermelho traz a mensagem, e a causa se acha com ela.

**Fora desta correção, para o Orquestrador:** `governanca.repository.ts:259` (produção) grava `retomadaEm: now()` do mesmo
modo. Em servidor com relógio sincronizado o recuo não ocorre, e mudar produção não é o que o pedido manda; fica o registro.
Até essa decisão, os casos de `apps/api/src/governanca/governanca.int.test.ts` que passam por essa rota (linhas 302, 313, 320,
392, 412, 431 e 530) ficam **expostos** ao mesmo vermelho nesta máquina: um vermelho deles com
`suspensao_de_funcao_retomada_depois` é esta causa, e não pede outra investigação. A tarefa que mudar o repository leva, junto,
um caso de integração com `suspensa_em` no futuro provando que a retomada pela rota passa.
Um caso de integração que espere a recusa `…_retomada_registrada` pela rota de produção (`governanca.repository.ts:259`) teria o
mesmo problema de ordem de nome, para quem for mexer no repository.

Mais duas rotas de produção com a mesma exposição, também fora desta correção:

- `apps/api/src/ops/operacao-privacidade.repository.ts:100` (`encerrar`, `fim: sql\`now()\``): os casos de
  `suboperador.int.test.ts` que chamam `encerrar(…)` pelo comando ficam expostos nesta máquina, e um vermelho deles com
  `suboperador_vigencia_ordenada` é esta causa;
- `apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts:253` (`enviar`, `enviadaEm: sql\`now()\``, contra o
  `iniciada_em` de `defaultNow()` gravado ao abrir a tentativa): os casos que abrem e enviam a tentativa pela rota
  `POST atividades-aplicadas/:id/enviar` ficam expostos, e um vermelho com `tentativa_atividade_envio_depois_do_inicio` é esta
  causa.

As três rotas são produção, e mudá-las não é o que o pedido manda: fica para a decisão do Orquestrador.

## Recomendações sem aplicar

Copiadas das ordens da Mesa, como estão (`.processo/ordens/2026-11-13-testes-com-relogio-r1.md`, `-r2.md` e `-r3.md`).

**Rodada 1**

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| conformidade-reviewer (1ª), tenancy-guardian (1ª), infra-guardian (1ª), privacy-guardian (1ª), test-engineer (1ª) | `governanca.repository.ts:259` (produção) grava `retomadaEm: sql\`now()\``; usar `greatest(now(), suspensa_em)` também lá | Muda produção, e o pedido da correção é só de teste (documento, "Fora desta correção"). Destino: decisão do Orquestrador, já registrada no documento; a tarefa que mexer nesse repository leva o caso de integração do item seguinte |
| conformidade-reviewer (1ª) | Se a produção mudar, um caso de integração com `suspensa_em` no futuro provando que a retomada pela rota passa | Depende da linha acima; entra na tarefa que mudar o repository |
| infra-guardian (1ª), test-engineer (1ª) | O vermelho de "aluno transferido" do `tutor.int.test.ts` continua sem causa | Já registrado como "Não reproduzido" no documento; se voltar, correção própria com a mensagem do erro. Sem mudança |
| conformidade-reviewer (1ª) | A reprodução vermelha/verde foi feita à mão, não ficou em teste | Aceita pelo próprio revisor: a correção só mexe em teste e o vermelho depende do relógio da máquina |

**Rodada 2**

As recomendações da rodada 1 que ficaram sem aplicar continuam as da ordem `-r1`. Desta rodada não sobrou nenhuma.

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| test-engineer (2ª) | Não rodou o teste: recuo de relógio não se reproduz num teste comum | Observação do revisor, não pede mudança; a evidência é a leitura da ordem das restrições e a estabilidade já registrada |

**Rodada 3**

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| test-engineer (3ª) | Falta uma quarta rota de produção na lista "Mais duas rotas…": `apps/api/src/ops/operacao-privacidade.repository.ts:133` (`encerrarLigacoes`) grava `fim = now()` em `suboperador_escola`, com `inicio` de `defaultNow()` ao cadastrar. A linha `suboperador_escola_vigencia_ordenada` da tabela da varredura diz "não" e, contada pela rota como as outras, é "sim"; os casos de `suboperador.int.test.ts` que cadastram com escolas e chamam `encerrar(...)` (264, 269, 372, 373, 604 e outros) ficam expostos, e um vermelho com `suboperador_escola_vigencia_ordenada` é a mesma causa. | Só texto do documento, e o código que a muda é produção, fora do pedido. Vai para "Recomendações sem aplicar" do documento; o conserto da rota fica com a decisão do Orquestrador, junto das outras rotas de produção da seção "Fora desta correção" |
| test-engineer (3ª) | "As linhas de teste expostas são sete, em seis arquivos": são cinco arquivos (`entrega`, `ia`, `atividade`, `mvp-tables`, `suboperador`), como a seção "Correção" lista. | Erro de contagem em texto, sem efeito em teste nem em regra. Vai para "Recomendações sem aplicar"; o texto se acerta na próxima edição do documento |
| test-engineer (3ª) | A checagem `pedido_titular_chegou_em_nao_futura` (`chegou_em <= current_date`, `0032_pedido_titular.sql:43`) depende do relógio de parede e ficou fora da varredura; uma nota de uma linha diria por que ela não se expõe ao recuo. | Não compara dois instantes da mesma linha, então não é a causa desta correção. Vai para "Recomendações sem aplicar", como nota para quem mexer na varredura |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-13 21:48:53 | 2026-11-13 21:49:09 | `tenancy-guardian` | 1 | APROVADO | ab75377f6d72df035 |
| 2026-11-13 21:48:54 | 2026-11-13 21:49:10 | `privacy-guardian` | 1 | APROVADO | a090c11f40ea4acc9 |
| 2026-11-13 21:48:55 | 2026-11-13 21:49:12 | `infra-guardian` | 1 | APROVADO | a2a99f27ef46a8d1d |
| 2026-11-13 21:48:52 | 2026-11-13 21:49:16 | `conformidade-reviewer` | 1 | APROVADO | a65c3a69474fafd09 |
| 2026-11-13 21:48:51 | 2026-11-13 21:49:56 | `test-engineer` | 1 | REPROVADO | ad7cc6b0d37979f3a |
| 2026-11-13 21:57:49 | 2026-11-13 21:58:25 | `test-engineer` | 2 | REPROVADO | ab2a7442b85db079d |
| 2026-11-13 22:14:05 | 2026-11-13 22:15:25 | `test-engineer` | 3 | APROVADO | a90c2d0ed2fa0d65e |
