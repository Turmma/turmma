# Correção — o `tutor-modelo` conta 17 pedidos ao modelo falso onde espera 2: a bancada de IA executa o job que outro arquivo deixou na fila

**Origem:** esteira run 44903191816 (integração 1/3, `spec/camada-ia` em `0e85765`): `apps/api/src/tutor/tutor-modelo.int.test.ts:99`, `expected [ …(17) ] to have a length of 2 but got 17`.
**Subagentes obrigatórios:** `conformidade-reviewer`, `llm-integrator`, `test-engineer`, `revisor-geral`, `privacy-guardian`, `tenancy-guardian`, `infra-guardian`
<!-- Os cinco primeiros vieram no PEDIDO do Orquestrador; `tenancy-guardian` e `infra-guardian` entram por ordem da Mesa (DEVOLUÇÃO): os arquivos alterados são de `apps/`, que pede os quatro guardiões de caminho (`guardioes-por-caminho.ts`). -->


## Sintoma

Na fatia 1/3 da integração, o primeiro caso do `it.each` de `tutor-modelo.int.test.ts` (`pedido direto, e o modelo tenta entregar a letra…`) vê 17 corpos em
`modelo.pedidos` onde espera 2 (a saída devolvida e a segunda). Os outros casos do arquivo passam. A mesma falha se reproduz na máquina com os dez arquivos que
antecedem o `tutor-modelo` na fatia, na ordem da esteira; o `tutor-modelo` sozinho passa. A integração 3/3 do mesmo run caiu em `ops-escola.int.test.ts`, que é outra
falha e não é desta correção.

## Fora desta correção

Nada: a árvore estava limpa. A falha da integração 3/3 (`ops-escola.int.test.ts`) fica para o Orquestrador.

## Causa

Não é nova tentativa do gateway nem outro consumidor do mesmo modelo dentro do arquivo: é **herança de fila entre arquivos**.

Os testes de integração rodam um arquivo por vez (`fileParallelism: false`) contra um só Postgres e um só Redis, e `job_registro` **não é esvaziado entre eles**.
O despachante de uma bancada de IA (`FilaDeIa`, `apps/api/test/fila-de-ia.fixture.ts`) reserva a linha `aguardando` de **qualquer escola**
(`DISPONIVEL_PARA_RESERVA` em `packages/core/src/queue/dispatch.repository.ts`), e o worker dela a executa com o processador e o modelo **dela**.
O arquivo anterior deixou jobs de IA `aguardando`: a extração do PDF (`apps/worker/test/extrair-pdf.int.test.ts`) agenda, na mesma transação, o job `ia.executar-lote` da
classificação das seções, desde a tarefa 4.0 desta spec, e nenhuma bancada do arquivo o consome (nem o apaga: só `classificacao-da-coordenacao` apaga os seus). Quando o
`tutor-modelo` sobe a bancada, o despachante dele publica os 17 jobs do lote e o worker os roda contra o modelo falso dele, que ainda está sendo preparado.
`modelo.responder()` zera `pedidos`, mas as chamadas do lote continuam chegando, e o primeiro caso, o primeiro depois do `beforeAll`, é quem as conta.

Prova: na reprodução, depois da falha o banco tinha 17 `ia.executar-lote` `concluido`, criados no instante da extração do PDF e concluídos pela bancada do `tutor-modelo`.
O `ociosa()` da bancada já só conta o que foi criado depois do início dela (`criado_em >= #inicio`): o autor sabia que a fila herdada existe, e só faltava a bancada não a consumir.
Falha da **tarefa 4.0** (o lote que passou a nascer na extração), vista só agora porque antes a integração estourava o teto e escondia a falha.

## Teste que reproduz

`apps/api/test/fila-de-ia-sem-heranca.int.test.ts › o job que ficou `aguardando` antes da bancada não roda nela, e o que nasce depois roda`. Uma bancada sem consumo grava a mensagem do
Tutor (`ia.executar`) e o job da classificação em lote (`ia.executar-lote`, a execução `classificar_secoes` na fila `lote`, como a extração do PDF e a rotina das 19h o gravam) e é fechada (o arquivo anterior);
a bancada seguinte, com consumo, sobe, e **na volta do `subir`** os dois jobs já não existem em `job_registro` (conferência sem espera: nada depende da velocidade da máquina); um pedido novo é concluído
(o controle de que ela está viva) e as duas execuções órfãs continuam `pendente`, com o modelo falso recebendo só o pedido novo. Vermelho antes da correção: a bancada seguinte executou o órfão
(`expected 'concluida' to be 'pendente'`, na primeira versão do caso, que ainda esperava 2 s).
O segundo caso prova o limite da correção: a segunda bancada de um mesmo arquivo, com a primeira ainda de pé, não apaga o job que a primeira gravou
(`fila-de-ia.int.test.ts` sobe uma réplica no meio de um caso).

## Correção

`FilaDeIa.subir` apaga, antes de ligar o consumo e antes de o teste gravar qualquer job, os jobs `ia.executar` e `ia.executar-lote` ainda não terminados, **só quando não há outra bancada de pé neste
arquivo** (contador `#vivas`, que o `fechar` baixa uma vez): o job de IA que sobrou de outro arquivo é descartado, e o que o arquivo agenda depois é dele. É o mesmo princípio de
`limparRegistro` do worker ("um teste não herda fila nem configuração de outro"), aplicado onde a herança passa a custar: a bancada que liga o consumo. Os testes de integração de produção não mudam,
e `packages/` e `apps/*/src` ficam intactos; o número `2` do `tutor-modelo` não muda.

Conferência local do sintoma que abriu a correção: os dez arquivos que antecedem o `tutor-modelo` na fatia 1/3, na ordem da esteira (com o compose de teste livre), reproduziram a falha antes
(`expected [ …(17) ] to have a length of 2 but got 17`) e passaram com a correção; `extrair-pdf.int.test.ts` e, em seguida, `tutor-modelo.int.test.ts`, em duas execuções seguidas sobre o mesmo banco, também. Depois da rodada 1 da Mesa (teste do órfão `ia.executar-lote`, sem espera fixa), a sequência da fatia 1/3 (`extrair-pdf` e os dez arquivos que antecedem o `tutor-modelo`, mais ele) ficou verde de novo: 12 arquivos, 373 casos. Os sete arquivos
que usam a bancada e que a correção não toca (`fila-de-ia`, `execucao-interrompida`, `corte-da-espera`, `orcamento-teto`, `sem-resposta`, `classificacao`, `assistente`) passaram isolados.

## Mutações

--faltando: 0 linhas (0 blocos, 0 motivos)

```mutacao
arquivo: apps/api/test/fila-de-ia.fixture.ts
teste: apps/api/test/fila-de-ia-sem-heranca.int.test.ts › o job que ficou `aguardando` antes da bancada não roda nela, e o que nasce depois roda
falha: expect(await jobDa(orfao)).toEqual([])
-    if (FilaDeIa.#vivas === 0) await fila.pool.query("delete from job_registro where tipo = any($1::text[]) and estado not in ('concluido', 'falhou')", [TIPOS_DE_JOB_DE_IA])
     FilaDeIa.#vivas += 1
```

```mutacao
arquivo: apps/api/test/fila-de-ia.fixture.ts
teste: apps/api/test/fila-de-ia-sem-heranca.int.test.ts › o job que ficou `aguardando` antes da bancada não roda nela, e o que nasce depois roda
falha: expect(await jobDa(lote)).toEqual([])
-export const TIPOS_DE_JOB_DE_IA = ['ia.executar', 'ia.executar-lote']
+export const TIPOS_DE_JOB_DE_IA = ['ia.executar']
```

```mutacao
arquivo: apps/api/test/fila-de-ia.fixture.ts
teste: apps/api/test/fila-de-ia-sem-heranca.int.test.ts › a segunda bancada do mesmo arquivo não apaga o job que a primeira, ainda de pé, gravou
falha: expect(await jobDa(gravado)).toEqual(['aguardando'])
-    if (FilaDeIa.#vivas === 0) await fila.pool.query("delete from job_registro where tipo = any($1::text[]) and estado not in ('concluido', 'falhou')", [TIPOS_DE_JOB_DE_IA])
+    await fila.pool.query("delete from job_registro where tipo = any($1::text[]) and estado not in ('concluido', 'falhou')", [TIPOS_DE_JOB_DE_IA])
     FilaDeIa.#vivas += 1
```

## Recomendações sem aplicar

Rodada 1 (`.processo/ordens/2026-11-21-tutor-modelo-recebe-pedidos-a-mais-r1.md`):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| test-engineer (1ª) | "Nenhum teste cobre o filtro `estado not in ('concluido', 'falhou')`: a mutação que o tira continuaria verde. O dano é pequeno (apagaria histórico de outro arquivo), mas fica o registro." | Recusada: o próprio revisor a registra sem exigir, e o dano é só histórico de teste de outro arquivo no banco de teste; um caso a mais caduca todos para proteger uma cláusula sem consequência para a regra 40 |
| privacy-guardian (1ª) | "O `delete` da linha 184 apaga jobs de qualquer escola. No banco de teste isso é o que se quer, mas o fixture não confere que está mesmo no banco de teste. Se `configuracaoDoBanco` ainda não recusa um banco que não seja o de teste, vale pôr essa trava no helper" | Já atendida: o `pool` da bancada vem de `configuracaoDoBanco` (`apps/worker/test/queue.fixture.ts:52`), que usa `urlDoBancoDeTeste()`; o fixture não tem caminho para outro banco |
| tenancy-guardian (1ª) | "vale anotar na retro: o processador sempre roda o job no contexto da escola que está na própria linha, e é isso que garante o isolamento nesse caminho." | Retro da spec (Arquiteto); sem mudança de código |
| llm-integrator (1ª) | "A causa de origem fica de fora: `extrair-pdf.int.test.ts` continua deixando `ia.executar-lote` `aguardando`. Se aparecer outro consumidor desse lote, vale limpar também no fim daquele arquivo" | `TODO.md`, item novo, para a tarefa que tocar `apps/worker/test/extrair-pdf.int.test.ts`; arquivo fora desta correção |
| llm-integrator (1ª) | "O mesmo `ia.executar-lote` herdado pode ter aparecido em testes de outros consumidores além de `FilaDeIa`. Vale uma conferência na próxima esteira." | Orquestrador: conferir na fatia 1/3 inteira da próxima esteira |
| infra-guardian (1ª) | "Não rodei a integração… A prova verde fica com a esteira, que deve rodar a fatia 1/3 completa, com o `tutor-modelo` na ordem de sempre." | Orquestrador: a esteira da fatia 1/3 é a prova final; o item 7 da ordem traz a sequência local |
| revisor-geral (1ª), infra-guardian (1ª) | a espera de 2 s trocada por sinal do despachante | Coberta pelo item 5 |

Rodada 2 (`.processo/ordens/2026-11-21-tutor-modelo-recebe-pedidos-a-mais-r2.md`):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisor-geral (2ª) | `apps/api/test/fila-de-ia-sem-heranca.int.test.ts:32`: o comentário cita `classificacao.int.test.ts` sem caminho; o arquivo está em `apps/api/src/material/classificacao.int.test.ts`. Escrever o caminho inteiro | `TODO.md`: comentário, vale na próxima vez que alguém tocar o arquivo novo |
| revisor-geral (2ª) | `apps/api/test/fila-de-ia-sem-heranca.int.test.ts:38`: `rows[0]?.id ?? ''` deixa passar string vazia se o `insert` não devolver linha; lançar erro ali mesmo | `TODO.md`: o `insert … returning id` sempre devolve a linha, e a falha aparece na asserção seguinte |
| revisor-geral (2ª) | `apps/api/test/fila-de-ia.fixture.ts` (perto da linha 188): o comentário do `delete` sem escopo tem três linhas longas, com o aviso de não copiar a linha no meio; enxugar e deixar o aviso numa frase própria | Recusada: estilo de comentário, sem efeito em comportamento nem em regra |
| test-engineer (2ª) | `apps/api/test/fila-de-ia-sem-heranca.int.test.ts:84`: `expect(await estadoDa(lote)).toBe('pendente')` pesa pouco sozinho (o lote talvez não chegasse ao modelo mesmo sem a correção); o comentário poderia dizer que a prova é a linha 77 | `TODO.md`: junto com o comentário do item 1, no mesmo arquivo |
| test-engineer (2ª) | `TODO.md` e `indice.md`: conferir que o achado registrado no índice aponta para este documento de correção | Recusada: não é defeito; o índice é escrito pelo hook, e a Mesa conferiu que aponta para este documento |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-21 10:39:05 | 2026-11-21 10:39:33 | `tenancy-guardian` | 1 | APROVADO | ad0326d86f2ff8dfa |
| 2026-11-21 10:39:00 | 2026-11-21 10:39:35 | `llm-integrator` | 1 | APROVADO | a796689926b07a1f0 |
| 2026-11-21 10:39:04 | 2026-11-21 10:39:35 | `privacy-guardian` | 1 | APROVADO | a2cc3ff896e33d5d1 |
| 2026-11-21 10:38:59 | 2026-11-21 10:39:42 | `conformidade-reviewer` | 1 | APROVADO | ab634a7837d3cc847 |
| 2026-11-21 10:39:02 | 2026-11-21 10:40:05 | `revisor-geral` | 1 | APROVADO | aed9af4c663994fa6 |
| 2026-11-21 10:39:06 | 2026-11-21 10:40:20 | `infra-guardian` | 1 | APROVADO | ae62a60fdf1da6a05 |
| 2026-11-21 10:39:01 | 2026-11-21 10:41:08 | `test-engineer` | 1 | REPROVADO | a912d8bb8073a88f6 |
| 2026-11-21 11:37:17 | 2026-11-21 11:37:54 | `revisor-geral` | 2 | APROVADO | ac177bc52d719fdc2 |
| 2026-11-21 11:37:09 | 2026-11-21 11:38:21 | `test-engineer` | 2 | APROVADO | a1a725c69ea19e9fd |
