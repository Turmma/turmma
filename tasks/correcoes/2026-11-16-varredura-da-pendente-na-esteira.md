# Correção — o caso da `pendente` da varredura (6.0) falha na esteira quando outros arquivos deixam mais de 1.000 `pendente` sem job no banco

**Origem:** esteira run 43855665234 (`4741f2c1`), job de integração, `apps/api/src/ia/execucao-interrompida.int.test.ts` › "varredura, `pendente`: com job vivo fica; sem job, com job final, de outro tipo, de outra fila ou de outra execução, é encerrada sem linha" (`execucao-interrompida.int.test.ts:464`): esperava `{ estado: 'falhou', erro: 'EXECUCAO_INTERROMPIDA' }` e recebeu `{ estado: 'pendente', erro: null }`.
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`, `tenancy-guardian`, `infra-guardian`, `privacy-guardian`, `conformidade-reviewer`

## Sintoma

Na esteira, depois da correção `2026-11-16-varredura-do-main-worker` (que tirou a falha da `rodando` de 40 dias), o caso da `pendente` falhou: uma das execuções sem job (a de `comJobConcluido`, `comJobFalhou`, `semJob`, `deOutroTipo`, `deOutraFila` ou `deOutraExecucao`) continuou `pendente` depois de `varrer()`. Os outros 3.534 testes passaram. Rodado sozinho, ou num banco novo, o arquivo passa sempre.

## Fora desta correção

Nada: a árvore estava limpa.

## Causa

A varredura encerra as `pendente` sem job da **mais antiga para a mais nova** (`ExecucaoRepository.encerrarPendentesSemJob`: `order by p.criada_em limit 200`), no máximo 5 passadas de 200 por volta, 1.000 por volta (Tech Spec §7c, "Laços e ritmo": o que passar do teto fica para a volta seguinte). O banco da integração é um só entre os arquivos, e o `apps/worker/test/expurgo-da-escola.int.test.ts` (e outros) deixa milhares de `pendente` sem job, de 2025, que vêm **antes** da execução de cada caso. Cada `varrer()` do arquivo tira 1.000 delas; o caso da `pendente` é o quinto `varrer()` do `describe`, e na esteira, onde o job de integração junta mais arquivos antes deste que a máquina local, as sobras passaram do que as `varrer()` anteriores do arquivo tiram (inferido: o log da esteira não traz a contagem das sobras): a `pendente` do caso (criada na hora) não foi alcançada e seguiu `pendente`. A correção anterior (`varredura-do-main-worker`) já registrava esse risco como "recomendação sem aplicar" e o deixou de fora: aqui ele aconteceu. Falha da 6.0, no teste, e não da varredura: a ordem e o teto são o desenho. Em produção a sobra velha é drenada à razão de 1.000 por minuto e a `pendente` nova a espera, sem erro.

Num banco novo local, com `expurgo-da-escola` antes, o arquivo passa: o banco fica com 2.674 execuções `falhou` depois dele (as 2.672 `pendente` sem job que o expurgo semeia, mais duas), e elas cabem nas varreduras que vêm antes do caso (cada uma tira até 1.000). A falha depende de a sobra passar disso, e a esteira não guarda a contagem. O caso novo reproduz o mecanismo sem depender do relógio nem da ordem dos arquivos: semeia 1.050 `pendente` sem job de 400 dias (uma volta e meia) e confere o estado de cada execução, e não o total que a volta devolve.

## Teste que reproduz

`apps/api/src/ia/execucao-interrompida.int.test.ts` › "a conta do laço, `pendente`: o que passa do teto da volta fica para a volta seguinte, da mais antiga para a mais nova". Semeia 1.050 `pendente` sem job de 400 dias e uma `pendente` nova: depois de um `varrer()` a nova segue `pendente` (o que a esteira viu); depois do `esvaziarAsSobras` ela está encerrada, e a `pendente` seguinte é encerrada na primeira volta. Vermelho: com o laço do `esvaziarAsSobras` sem a varredura (mutação abaixo), cai em `expect(await sobrasParaVarrer()).toBe(0)`; verde com o auxiliar. O caso da esteira em si não reproduz num banco novo local (item acima), e por isso a prova é a do caso novo.

## Correção

Só teste (`apps/api/src/ia/execucao-interrompida.int.test.ts`); nenhum código de produção, migration nem repository. `esvaziarAsSobras(fila)` passa a varredura até o banco não ter mais nada que ela encerraria (`sobrasParaVarrer`: as `pendente` sem job vivo e as `rodando` de mais de 300 s, conferido por SQL, porque `varrer()` devolve 0 também quando falha) e confere que zerou. Roda em `beforeEach` nos três blocos do arquivo que chamam a varredura (`a reentrega e a varredura`, `o adaptador externo` e `Redis de fila fora`): cada caso começa sem sobra, e o resultado dele não depende do que os outros arquivos deixaram nem de quantas `varrer()` vieram antes. Os casos ficam como estavam; o `limpar` de cada bloco segue apagando só o que o bloco semeou.

## Mutações

--faltando: 0 linhas (1 blocos, 0 motivos)

```mutacao
arquivo: apps/api/src/ia/execucao-interrompida.int.test.ts
teste: apps/api/src/ia/execucao-interrompida.int.test.ts › a conta do laço, `pendente`: o que passa do teto da volta fica para a volta seguinte, da mais antiga para a mais nova
-  for (let volta = 0; volta < VOLTAS_PARA_ESVAZIAR && (await sobrasParaVarrer()) > 0; volta += 1) await fila.varredura().varrer()
+  for (let volta = 0; volta < VOLTAS_PARA_ESVAZIAR && (await sobrasParaVarrer()) > 0; volta += 1) await Promise.resolve()
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| test-engineer (1ª) | Fechar a `quase` no fim do caso `a varredura de 60 s` | Recusada: o `expect` do caso novo deixou de contar o total global, e o `beforeEach` com `esvaziarAsSobras` já a encerra quando vence; mexer em outro caso é fora do escopo. |
| test-engineer (1ª) | Os projetos `integracao` e `infra` juntos: o `esvaziarAsSobras` pode encerrar a `pendente` de um arquivo de infra | Risco anterior à correção; a premissa (um arquivo por vez, `fileParallelism: false`) está escrita no comentário do auxiliar. `TODO.md` se a esteira passar a juntar os projetos. |
| revisor-geral (1ª) | Caso novo e "a volta para quando o lote não enche" supõem que nenhum `worker-ia` varra ao mesmo tempo | Risco anterior à correção, sem efeito na esteira (a integração não sobe o `worker-ia`); a saída, parar os processos no `beforeAll`, fica para quando voltar a aparecer. |
| revisor-geral (1ª), privacy-guardian (1ª), infra-guardian (1ª) | Constante ou fonte única para o predicado, em vez de cópia em SQL | `TODO.md`: mexeria em `execucao.repository.ts` (código de produção), fora de uma correção só de teste; o comentário do auxiliar diz de onde a cópia saiu e o caso `varredura, escola` cobre a divergência. |
| infra-guardian (1ª) | `esvaziarAsSobras` registrar no log quantas voltas precisou | Recusada: a mensagem do `expect` final faz o vermelho dizer a causa quando a sobra passar do teto, e log em teste de integração é ruído em toda execução. |
| infra-guardian (1ª) | Cada arquivo apagar o que semeou (`apps/worker/test/expurgo-da-escola.int.test.ts` e outros) | `TODO.md`: a tarefa que tocar esses arquivos; a causa de fundo é deles, e esta correção protege só o `execucao-interrompida`. |
| revisor-geral (2ª) | O `toBeGreaterThanOrEqual(1)` de `varrer()` não diz nada sozinho: tirar o `expect` ou dizer que só confere que a volta encerrou algo | Recusada: o comentário logo acima já diz isso, e a prova é a linha seguinte (estado da execução); é só limpeza. |
| revisor-geral (2ª) | A recusa sobre o `worker-ia` varrendo junto com o teste não está no `TODO.md` | Fica registrada nesta tabela (arquivo versionado); risco anterior à correção e sem efeito na esteira. |
| test-engineer (2ª) | Nenhum teste guarda a premissa `fileParallelism: false` | `TODO.md` (já tem a entrada "`esvaziarAsSobras` e os projetos `integracao` e `infra` no mesmo banco") e retro. |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-16 09:54:05 | 2026-11-16 09:54:21 | `conformidade-reviewer` | 1 | APROVADO | a613b6e5068b5e5f8 |
| 2026-11-16 09:54:02 | 2026-11-16 09:54:25 | `tenancy-guardian` | 1 | APROVADO | a6338a041ddca3f5b |
| 2026-11-16 09:54:04 | 2026-11-16 09:54:28 | `privacy-guardian` | 1 | APROVADO | aae7ca41d233fcd3c |
| 2026-11-16 09:54:03 | 2026-11-16 09:54:56 | `infra-guardian` | 1 | APROVADO | ac578f12bd5158766 |
| 2026-11-16 09:54:01 | 2026-11-16 09:55:27 | `revisor-geral` | 1 | APROVADO | a3c46f04a4ac1c304 |
| 2026-11-16 09:54:00 | 2026-11-16 09:55:58 | `test-engineer` | 1 | REPROVADO | aa9ff6f5adab4c118 |
| 2026-11-16 10:03:58 | 2026-11-16 10:04:22 | `revisor-geral` | 2 | APROVADO | a9b96ad8a111cbb26 |
| 2026-11-16 10:03:54 | 2026-11-16 10:04:35 | `test-engineer` | 2 | APROVADO | a48e7a6908d187c40 |
