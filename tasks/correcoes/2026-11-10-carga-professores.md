# Correção — o [C] da fase `professores` reprovou na 1ª corrida da validação (283 × 503) e nenhuma tarefa o tinha rodado com registro

**Origem:** validacao.md de acesso-e-convites (`tasks/prd-acesso-e-convites/validacao.md`, seção 4, crítico 1).
**Subagentes obrigatórios:** `infra-guardian`, `test-engineer`, `revisor-geral`

## Sintoma

Na validação, `npm run carga:importacao -- --fases professores` reprovou na 1ª corrida (15:11 UTC, load 3,1 a 4,1 em 12 núcleos, com o ambiente de teste do e2e de pé): "283 resposta(s) 5xx da API
nas rotas do cenário" (`/v1/sessao/matricula` 279 e `/v1/sessao/matricula/trocar-senha` 4, todas 503) e `rajada_professores: login_duracao{grupo:rajada} p(95) = 2123` contra o teto `p(95)<1000`. Na 2ª
(15:18 UTC, ambiente de teste parado, load 1,8 a 2,5) passou: rajada p95 168 ms, zero 503. A 10.0 deu esse [C] por coberto pelos testes do script (`10_task.md:70`, "A execução … é manual") e não há
registro de execução.

## Fora desta correção

Nada: a árvore estava limpa. Esta correção **não muda código**: mede e escreve em documento (itens (a), (b) e (c) do crítico 1).

## Causa

**O host não entregou a CPU de referência do hash, e a validação não mediu o hash.** O 503 do login da rajada vem do semáforo do argon2 (`HashBulkhead`) passando do prazo quando o hash custa mais
do que a calibração (~30 ms): é o mesmo mecanismo do K2 da 16.0 (`2026-11-10-k2-calmo`), agora no login das 7h30. Não é o job de professores tomando a vez do hash: com a máquina calma a soma das duas
cargas (rajada, 300 logins e 90 redefinir no mesmo semáforo) deu zero 503. As provas estão na tabela abaixo: quatro rodadas passam com o hash de 29 a 34 ms, e a mesma fase **reprova com a assinatura da validação**
(503 só em `/v1/sessao/matricula` e a rajada acima de 1 s) quando o host é disputado por mais laços do que núcleos e o hash vai a 68 ms.

O que **não** está provado: que a 1ª corrida da validação (15:11 UTC) tenha sido essa mesma disputa. O hash não foi medido nela, e o que a validação anotou (load 3,1 a 4,1, "ambiente de teste do e2e de pé") não discrimina nada, porque o próprio
cenário leva o host a 3,3 a 3,9 de load em todas as rodadas abaixo. A causa da validação é a hipótese que todas as medições sustentam, e a condição de máquina escrita no runbook existe para que o
próximo vermelho se separe do host pela medida do hash, e não por palpite. Duas diferenças de detalhe: a validação teve 4 respostas 503 em `/v1/sessao/matricula/trocar-senha` e a reprodução, 7 só em `/v1/sessao/matricula`; e o throttling
do cgroup **não** é o discriminador desta fase (ficou em 6% a 8% na rodada reprovada).

Da tarefa 10.0: o [C] saiu coberto pelos testes do script e nenhuma execução foi registrada; a 16.0 repetiu o padrão no K2 até a correção acima.

## Teste que reproduz

Não há teste de código: o defeito é uma medição que faltava e uma condição de máquina que ninguém tinha escrito. A evidência que substitui o vermelho é a rodada reprovada da tabela (16 laços, `estresse16`): o cenário
`npm run carga:importacao -- --fases professores` reprova com `rajada_professores: login_duracao{grupo:rajada} p(95)<1000` e "7 resposta(s) 5xx da API nas rotas do cenário", e passa nas quatro rodadas em que o hash está até ~34 ms.

## Correção

Sem código de produção, de teste nem de `infra/`. HEAD `8c07d22d`, 10/11/2026, entre 15:27 e 16:03 UTC. Máquina: 12 núcleos; as três linhas paradas; nenhum container de pé antes de cada rodada (`docker ps -q` vazio); cada rodada
pela fila (`flock /tmp/educa-carga.lock`). O hash é o do comando do runbook (`@node-rs/argon2`, `m=19456, t=12, p=1`, 20 hashes seguidos), medido antes e depois; o throttling é o `cpu.stat` de `educa-carga-api-1-1` e `-2-1`,
amostrado a cada 5 s (a primeira amostra, ~20 s depois de o container nascer, e a última, antes de ele morrer).

| Rodada | Comando | Condição do host | Hash (mediana, antes → depois) | Throttling `api-1` / `api-2` | Resultado |
|---|---|---|---|---|---|
| `prof1` (15:27) | `carga:importacao -- --fases professores` | calma, load 0,41 | 32,9 → 33,0 ms | 10,6% (31 s) / 11,0% (34 s) | **passou**: zero 503 e zero 5xx; redefinir 90 de 90 com status 204 (p95 263 ms); passo (3) 11 de 11 até 1 s (9 até 0,25 s); rajada p95 **187 ms** (máx. 572); login dos professores p95 201 ms |
| `prof2` (15:33) | idem | calma, load 1,28 | 29,2 → 32,0 ms | 9,7% (29 s) / 10,0% (27 s) | **passou**: zero 503; redefinir 90 de 90 com status 204 (p95 318 ms); passo (3) 11 de 11 até 1 s (8 até 0,25 s); rajada p95 **167 ms** (máx. 546) |
| `rajada1` (15:39) | `carga:login -- --fases rajada` (a base roda junto) | calma, load 1,64 | 31,4 → 31,2 ms | 5,8% (17 s) / 5,3% (13 s) | **passou**: 2.070 contas entraram, zero 503, zero 429, zero erro final; rajada p95 **102 ms** (máx. 349); B e C na base em 110 e 109 ms |
| `estresse6` (15:49) | idem à `prof1`, com 6 laços `while :` ocupando o host | load 1,45 antes e até 10,4 durante | 32,2 → 33,7 ms | 12,4% (29 s) / 13,0% (29 s) | **passou**: zero 503; redefinir 90 de 90 com status 204 (p95 313 ms); passo (3) 11 de 11 até 1 s (2 até 0,25 s); rajada p95 **210 ms** |
| `estresse16` (15:55) | idem à `prof1`, com 16 laços (mais do que os 12 núcleos) | load 7,6 antes (os laços já de pé, o anterior ainda esfriando) e até 27 durante | **67,7 → 70,6 ms** (p90 81 e 88 ms) | 6,3% (6 s) / 8,3% (9 s) | **reprovou**: 7 respostas 503, todas em `/v1/sessao/matricula`; rajada p95 **1.415 ms** (teto 1.000); do lado dos professores, zero 503, redefinir 90 de 90 com status 204 (p95 719 ms), passo (3) 10 de 10 até 1 s |

**O hash em cada rodada** (20 hashes seguidos no host, em ms; é daqui que o runbook tira a faixa do p90 e do máximo):

| Rodada | Antes: mediana / p90 / máx. | Depois: mediana / p90 / máx. |
|---|---|---|
| `prof1` | 32,9 / 39,2 / 41,6 | 33,0 / 42,2 / 43,3 |
| `prof2` | 29,2 / 30,2 / 30,3 | 32,0 / 44,2 / 109,3 |
| `rajada1` | 31,4 / 42,0 / 88,4 | 31,2 / 41,5 / 42,7 |
| `estresse6` | 32,2 / 36,2 / 36,9 | 33,7 / 43,8 / 48,3 |
| `estresse16` | 67,7 / 80,8 / 179,0 | 70,6 / 87,5 / 102,2 |

Nas três rodadas calmas o p90 foi de 30,2 a 44,2 ms e o máximo passou de 100 ms uma vez (109,3 ms, `prof2`, depois), por um hash isolado, com a mediana em 32,0: por isso só a mediana entra no critério.

**(a) O [C] com a máquina calma, mais de uma vez:** `prof1` e `prof2` passam, com folga larga no critério que reprovou (rajada a 167 e 187 ms contra o teto de 1.000 ms, zero 503). O critério do PRD/Tech Spec 7c está cumprido nelas.

**(b) A rajada sozinha contra a rajada ao lado da fase `professores`:** com a máquina calma não há 503 em nenhum dos dois casos, então os 503 **não vêm da soma** do argon2 dos 300 logins e dos 90 redefinir no mesmo semáforo. A soma custa, e o custo é medido: a rajada
vai de p95 102 ms (sozinha) a 167 e 187 ms (ao lado da fase), e o throttling das APIs, de 5% a 6% para 10% a 11%. Com mais de 5 vezes de folga no teto de 1.000 ms, a margem não é o problema; o problema é a CPU que o host deixa ao hash.

**(c) A condição de máquina:** `docs/runbook.md`, nova seção "Quando a carga vale como registro" (máquina calma antes, hash até ~35 ms antes e depois, throttling lido e escrito), com o comando dos 20 hashes, o ponteiro a ela no "Se reprovar" da importação e do login, e a regra de que **vermelho com as duas leituras do hash boas se repete uma vez, e só o segundo vermelho é defeito do produto** (origem: recomendação do `infra-guardian`, 1ª rodada: o hash é lido antes e depois da rodada, e uma disputa que só aparece no meio dela passa pelas duas leituras; o primeiro vermelho não se apaga, fica escrito junto do segundo resultado). O que fica para o Joaquim, em
`TODO.md`: a medida do hash `t=12` e das fases `professores` e rajada **na VPS de produção** (D82) antes do piloto. O `10_task.md` ganhou, na linha do [C], a execução que faltava e o resultado.

Limites do que isto prova, ditos sem arredondar: são **duas** rodadas calmas da fase, e o throttling delas (10% a 11%) é o de sempre desta máquina, não zero; os laços de CPU simulam o host disputado, não reproduzem o que estava de pé na validação; e a 1ª corrida da validação não tem o
hash medido, então a causa dela é a melhor hipótese, não um fato.

Arquivos alterados: `tasks/correcoes/2026-11-10-carga-professores.md`, `docs/runbook.md`, `TODO.md`, `tasks/prd-acesso-e-convites/10_task.md`. Nenhum arquivo de `apps/`, `packages/`, `infra/` ou `e2e/`.

## Recomendações sem aplicar

| Origem | Recomendação | Destino ou motivo |
|---|---|---|
| esta correção | Os scripts de carga (`infra/scripts/carga-*.ts`) poderiam medir o hash e o throttling sozinhos antes e depois da rodada e **recusar o registro** (ou marcar "não vale") com o hash acima de ~35 ms; hoje a condição é de quem roda, escrita no runbook | Arquiteto, por decisão do Orquestrador: mexe em `infra/scripts/` e `infra/test/`, fora de uma correção só de documento |
| validação, maior 2 | Exigir, no template da tarefa, que todo [C] tenha a linha do resultado da execução (data, hash, throttling, números) ou a justificativa de não ter rodado, como condição do carimbo | retro de acesso-e-convites (já no parecer do Validador) |
| esta correção | A evidência bruta (`cpu.stat` a cada 5 s e a saída do k6 das cinco rodadas) ficou na área temporária da sessão, fora do git; os números por rodada estão na tabela acima | se o Validador pedir a evidência, o Orquestrador repete as rodadas |
| infra-guardian (2ª) | Ler o `cpu.stat` a cada 5 s na repetição não mostra o custo do hash no meio da rodada; a repetição poderia rodar também o laço dos 20 hashes ao mesmo tempo, ou medir o load a cada 5 s | Arquiteto, junto da recomendação de os scripts de carga medirem o hash e recusarem o registro sozinhos (linha "esta correção" acima). Mexe em `infra/scripts/`, fora de uma correção só de documento |
| infra-guardian (2ª) | O "6% a 8%" de throttling da rodada reprovada aparece na correção e no runbook; citar a correção no runbook para os dois textos não divergirem | `TODO.md`, item de limpeza do runbook (dono: Implementador). Não bloqueia: o número é o mesmo nos dois |
| test-engineer (2ª) | Dizer onde fica registrada a primeira rodada vermelha descartada pela regra de repetir, para que um verde na segunda tentativa não apague o primeiro vermelho | o `test-engineer` olha de novo na próxima rodada. O runbook agora diz que o primeiro vermelho fica escrito junto do segundo resultado (a pedido do item 1 da ordem da 2ª rodada) |

## Mutações

`--faltando: 0 linhas (0 blocos, 0 motivos).` Nenhuma cláusula nova de código.

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-10 13:10:23 | 2026-11-10 13:11:01 | `infra-guardian` | 1 | APROVADO | a7d97479e668f1c38 |
| 2026-11-10 13:10:25 | 2026-11-10 13:11:05 | `test-engineer` | 1 | APROVADO | a0ecf37e6c154d83f |
| 2026-11-10 13:10:26 | 2026-11-10 13:11:11 | `revisor-geral` | 1 | APROVADO | a5f5d8784a9751f70 |
| 2026-11-10 13:17:13 | 2026-11-10 13:17:34 | `infra-guardian` | 2 | APROVADO | a7f8187c08f1f8539 |
| 2026-11-10 13:17:17 | 2026-11-10 13:17:41 | `test-engineer` | 2 | APROVADO | a589f5e66b4baae2e |
| 2026-11-10 13:17:19 | 2026-11-10 13:18:11 | `revisor-geral` | 2 | REPROVADO | a93e69f91aac296fc |
| 2026-11-10 13:23:42 | 2026-11-10 13:24:03 | `revisor-geral` | 3 | APROVADO | a4115982574032107 |
| 2026-11-10 13:23:45 | 2026-11-10 13:24:08 | `infra-guardian` | 3 | APROVADO | acd40d3c06b81b4f4 |
| 2026-11-10 13:23:49 | 2026-11-10 13:24:12 | `test-engineer` | 3 | APROVADO | a04f0714562b06c28 |
