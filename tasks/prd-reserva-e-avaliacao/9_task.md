# Tarefa 9.0 — A fase `reserva` da carga prova a queda do principal

**Funcionalidade:** reserva-e-avaliacao · **Depende de:** 7.0
**Subagentes obrigatórios:** `privacy-guardian`, `infra-guardian`, `llm-integrator`, `tenancy-guardian` (o portão o pede: a tarefa lê `execucao_agente` e cria escola e sessão sintéticas por escola; sem repository, endpoint ou migration), `conformidade-reviewer` (o portão o pede: o teste da 1.0 em `llm-config.test.ts` tocou a configuração da reserva; a tarefa não toca nota, tutor nem decisão sobre aluno)
**Porte:** grande

## Objetivo

O cenário de carga ganha a fase `reserva`: no meio da aula, o principal falso cai (5xx, depois prazo) ou fica sem vaga, e a
reserva falsa atende sem deixar aluno sem resposta. A fase roda de verdade, com o controle negativo, e o resultado fica em
`docs/runbook.md`. A fase `sala` segue sem reserva, comparável à X6.

## Contexto necessário

- `techspec.md` §5 ("A identidade": `IA_FALHA_FALSA`, a reserva falsa), §7c ("Carga")
- `prd.md` RF3, §9 (as indisponíveis com o principal fora)
- `cenarios.md` §5 (Carga) inteira
- `revisao-spec.md`, rodada 8, "O que vai para as tarefas": a fase com `IA_FALHA_FALSA=principal:429` no meio da aula
- `.claude/rules/80-infra-e-carga.md` (itens 4 e 11); `docs/runbook.md`, "Rodar o cenário de carga" e "Quando a carga vale como
  registro"; `docs/infra.md` 5.4
- Código: `infra/scripts/carga.ts` (`FaseDoK6`, `SCRIPT_DO_K6`, o veredito da `sala`), `infra/k6/justica-entre-escolas.js`
  (`FASE=sala`), `infra/compose.carga.yml`, `infra/carga.env` (a 1.0 já pôs a reserva falsa)

## Subtarefas

- [x] 9.1 — `reserva` em `FaseDoK6` e no k6, com três janelas: `IA_FALHA_FALSA=principal:5xx`, `principal:prazo` e
  `principal:429`, mais o balde do principal no limite no pico; o compose passa as variáveis da reserva aos dois `worker-ia`
- [x] 9.2 — O veredito: 5xx e 429 com zero indisponível e o p95 do turno do Tutor até 1 s acima do da `sala`; prazo com
  indisponível só `IA_TEMPO_ESGOTADO`, contado no relatório; `ia.degradacao{degrau="provedor_de_reserva"}` subindo; o controle
  negativo (`IA_RESERVA_PROVEDOR_ID=falso-sem-aprovacao`) reprova pelo indisponível, não pela subida
- [x] 9.3 — Rodar a fase e o controle negativo, e registrar em `docs/runbook.md` com a condição da máquina
- [x] 9.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `infra/scripts/carga.ts`, `infra/test/carga.test.ts` | alterado |
| `infra/k6/justica-entre-escolas.js`, `infra/compose.carga.yml`, `infra/carga.env` | alterado |
| `docs/runbook.md` | alterado |
| `infra/test/carga-da-manha.int.test.ts`, `package.json` | alterado (as leituras da janela contra o banco, e os dois comandos `carga:reserva`) |
| `techspec.md`, `cenarios.md` | alterado (as divergências abaixo) |
| `packages/core/src/config/llm-config.test.ts` | alterado (o caso da 1.0 que lia `IA_RESERVA_*` do `infra/carga.env` passa a ler `RESERVA_DA_CARGA_*`, a divergência 3: o contrato de que a reserva da carga é a falsa, `falso-reserva`, com o contratado próprio, continua provado) |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| queda por 5xx: zero indisponível, p95 do Tutor até 1 s acima da `sala`, o degrau da reserva subindo | carga | RF3 | o p95 da `sala` da mesma corrida | `npm run carga:reserva`, corrida 5 de "Corridas de carga" abaixo (23:57 de 22/11, máquina calma: load 0,70, `docker ps` vazio): janela `5xx`, 230 turnos, p95 6.202 ms (controle 6.128 ms; limite 7.128 ms), 0 indisponível, a reserva atendeu 260 chamadas |
| queda por prazo: indisponível só com o prazo esgotado, sempre `IA_TEMPO_ESGOTADO`, com o número no relatório | carga | §5 | o código de cada indisponível | `npm run carga:reserva`, corrida 5 (máquina calma): janela `prazo`, 220 turnos, p95 6.145 ms, 0 indisponível, 0 prazo esgotado (a reserva atendeu os 240; o número de `IA_TEMPO_ESGOTADO` sai no relatório da janela, coluna "prazo esgotado"). No controle negativo a mesma janela deu 230 indisponíveis e 10 `IA_TEMPO_ESGOTADO` |
| 429 no meio da aula (recomendação da revisão da spec, rodada 8): o `limite` vai ao menor e à reserva, sem indisponível | carga | regra 80, caso de borda | o código de cada indisponível no relatório | `npm run carga:reserva`, corrida 5 (máquina calma): janela `429`, 230 turnos, p95 6.581 ms (limite 7.128 ms), 0 indisponível, a reserva atendeu 260 chamadas (o falso não tem modelo menor, então o `limite` vai direto à reserva) |
| balde cheio no pico: o transbordo vai à reserva, sem indisponível | carga | §5 (1) | o balde que recusou | `npm run carga:reserva`, corrida 5 (máquina calma): janela `balde` (contratado do principal 1,2 milhão por minuto), 420 turnos, p95 14.086 ms, 0 indisponível, `ia.degradacao{degrau="espera"}` 140 (o balde recusou) e `provedor_de_reserva` 100 (transbordou à reserva). O p95 do balde não tem limite (a espera de 8 s é o desenho) |
| controle negativo (`falso-sem-aprovacao`): o worker sobe, a reserva não é elegível, indisponível acima de zero na janela da queda | carga | o critério | reprova pelo indisponível, não pela subida | `npm run carga:reserva:controle-negativo`, corrida 6 (00:10 de 23/11; `docker ps` vazio, load 2,41 pelo rastro da corrida anterior), saída 0 ("✔ controle negativo"): o worker subiu com a reserva não elegível e a queda deixou aluno sem resposta, o que provam os indisponíveis das janelas `5xx` (260) e `429` (260), mais 230 no `prazo` (e 10 `IA_TEMPO_ESGOTADO`) e 120 no `balde`; `provedor_de_reserva` ficou em 0 em todas |
| o controle negativo: reprova pelo indisponível nas duas janelas de queda, e a fase que não terminou não vale | U | o critério | uma janela só contra as duas; o `undefined` nos dois modos | `infra/test/carga.test.ts` › "o controle negativo exige o indisponível nas duas janelas de queda, e o de uma só não basta", › "a fase que não terminou, porque o compose ou o worker não subiu, sai 1 também no controle negativo: não provou nada", › "reprova pelo indisponível das janelas de queda por servidor e por 429, e não pela subida, pela amostra ou pelo degrau" e › "o worker que nem subiu reprova por outro motivo, e o controle negativo não o aceita como prova" |
| o veredito: indisponível acima de zero na janela de 5xx reprova com o nome da fase; no 0 passa | U | o script | os dois lados | `infra/test/carga.test.ts` › "indisponível acima de zero na janela de 5xx reprova com o nome da janela, e no zero passa" |
| o veredito: p95 do Tutor 1 s acima da `sala` passa, acima reprova | U | a fronteira | o limite exato | `infra/test/carga.test.ts` › "o p95 do turno do Tutor 1 s acima do controle passa, e um milissegundo acima reprova (5xx e 429)" e › "a janela com poucos turnos, ou sem p95, não passa em branco" |
| a fase `sala` não liga a reserva | U | comparável à X6 | as variáveis da reserva ausentes nela | `infra/test/carga.test.ts` › "a `sala` não liga a reserva: as variáveis dela e a falha ficam vazias, mesmo com o shell exportando as do worker" |
| o degrau da reserva que não subiu reprova a fase | U | a reserva atendeu | o contador lido do Prometheus | `infra/test/carga.test.ts` › "o degrau da reserva que não subiu reprova a janela, inclusive o contador que o Prometheus não devolveu"; as leituras do banco por janela: `infra/test/carga-da-manha.int.test.ts` › "a janela da queda do principal (F5b, 9.0) mede o turno e as falhas só do intervalo [de, até)" (comportamento, no banco) e `infra/test/carga.test.ts` › "as consultas da janela levam as escolas e o intervalo [de, até) como parâmetros…" (as cláusulas e a ordem dos parâmetros, que a corrida de mutações alcança) |

As linhas de carga levam na coluna "Caso" a corrida de verdade: o comando, a data, os números do critério e a condição da
máquina (`docs/runbook.md`, "Quando a carga vale como registro").

### Corridas de carga (9.3)

Seis corridas (as quatro de `npm run carga:reserva` e os dois controles negativos), todas dentro da fila (`flock /tmp/educa-carga.lock`), no projeto `educa-carga`, com o adaptador falso (principal e reserva), em 22/11/2026. **Os dois primeiros vermelhos não se apagam**; cada um achou um defeito da carga, não do produto:

1. **21:05, vermelha (375 respostas inesperadas: 326 do Tutor, 25 da ferramenta, 24 da proposta).** As dez escolas eram preparadas em série e o token de acesso (10 min) da escola 1 já chegava ao k6 vencido: a escola 1 fez 61 turnos e as cinco últimas, 164 cada. Conserto: as escolas em paralelo, sem reconstruir o `dist` a cada sessão (de mais de 10 min para 8 s), e o script recusa a corrida se as sessões passarem de 30 s.
2. **22:17, vermelha (20 respostas inesperadas, só da ferramenta: uma por escola em duas trocas de worker).** O script recriava o `worker-ia` 2 s depois do fim da carga, e a ferramenta de 50 s em voo era abortada (o aluno via `sem_conclusao`). As janelas, o Tutor e o resto estavam verdes. Conserto: esperar 45 s antes de trocar o worker (`DRENAGEM_ANTES_DE_TROCAR_O_WORKER_S`), com 70 s de intervalo e janelas de 30 s, para o k6 inteiro caber nos 10 min do token.
3. **22:32 (13 min), verde, mas com a máquina ocupada (load 4,24): não vale como registro** (a ordem de correção da rodada 1 mandou repetir). O relatório por janela (`turnos`, p95 do turno, indisponível, prazo esgotado, outras, interrompidas, reserva atendeu, balde recusou):

   | janela | turnos | p95 | indisp. | prazo esg. | outras | interr. | reserva atendeu | balde recusou |
   |---|---|---|---|---|---|---|---|---|
   | `controle` | 220 | 6.180 ms | 0 | 0 | 0 | 0 | 0 | 0 |
   | `5xx` | 230 | 6.228 ms | 0 | 0 | 0 | 0 | 260 | 0 |
   | `prazo` | 220 | 6.193 ms | 0 | 0 | 0 | 0 | 240 | 0 |
   | `429` | 230 | 6.623 ms | 0 | 0 | 0 | 0 | 260 | 0 |
   | `balde` | 420 | 14.121 ms | 0 | 0 | 0 | 0 | 100 | 140 |

   Referência: o p95 do `controle` (6.180 ms), limite da queda 7.180 ms. k6: 0 execuções com `IA_TEMPO_ESGOTADO`, 0 interrompidas vistas pelo aluno, nenhuma troca de worker atrasada, nenhum threshold cruzado.
4. **Controle negativo, 22:45 (13 min), saída 0, também com a máquina ocupada:** reprovou pelo indisponível (260 na `5xx`, 230 no `prazo`, 260 no `429`, 115 no `balde`), com `provedor_de_reserva` em 0 e o `controle` verde (220 turnos, p95 6.208 ms).

5. **23:57 de 22/11 (12 min), verde, com a máquina calma: é a que vale como registro.** Load de 1 minuto **0,70** (5 min: 2,60) e `docker ps` vazio na partida, as linhas 1 e 2 sem portão nem suíte (o Orquestrador derrubou as pilhas `educa-teste*` antes). Hash `9e09f039` mais as mudanças da tarefa (já com a leitura do Prometheus começando na volta da troca do worker, item 14 da ordem):

   | janela | turnos | p95 | indisp. | prazo esg. | outras | interr. | reserva atendeu | balde recusou |
   |---|---|---|---|---|---|---|---|---|
   | `controle` | 220 | 6.128 ms | 0 | 0 | 0 | 0 | 0 | 0 |
   | `5xx` | 230 | 6.202 ms | 0 | 0 | 0 | 0 | 260 | 0 |
   | `prazo` | 220 | 6.145 ms | 0 | 0 | 0 | 0 | 240 | 0 |
   | `429` | 230 | 6.581 ms | 0 | 0 | 0 | 0 | 260 | 0 |
   | `balde` | 420 | 14.086 ms | 0 | 0 | 0 | 0 | 100 | 140 |

   Referência: o p95 do `controle` (6.128 ms), limite da queda 7.128 ms. k6: 0 execuções com `IA_TEMPO_ESGOTADO`, 0 interrompidas vistas pelo aluno, nenhuma troca de worker atrasada, nenhum threshold cruzado.
6. **Controle negativo (`falso-sem-aprovacao`), 00:10 de 23/11 (12 min), saída 0:** reprovou pelo indisponível (260 na `5xx`, 230 no `prazo`, 260 no `429`, 120 no `balde`), com `provedor_de_reserva` em 0 em todas e o `controle` verde (220 turnos, p95 6.148 ms). Load de 1 minuto **2,41** na partida (5 min: 2,20), `docker ps` vazio: o 1 minuto ainda trazia o fim da corrida 5, que acabara de derrubar o compose, e a média de 15 min era 3,32; só a corrida 5 e esta rodavam. O que prova que o worker subiu com a reserva não elegível são os indisponíveis gravados nas janelas `5xx` e `429` (o `controle` roda com a reserva desligada); o `controle` só mostra que a carga correu.

**Condição da máquina (`docs/runbook.md`, "Quando a carga vale como registro").** Hash `9e09f039` (HEAD; a árvore leva as mudanças desta tarefa). **A condição 1 foi cumprida na corrida 5** (load 0,70, `docker ps` vazio, nenhum outro agente com a máquina) e **ficou no limite no controle negativo** (2,41, pelo rastro da corrida anterior; os números dele são de contagem, não de latência, e reprovaram por ampla margem). As condições 2 e 3 (hash de senha e `cpu.stat` das APIs) **não se aplicam**: a fase `reserva` não passa pelo hash (os tokens são sessões sintéticas de `ops:sessao-sintetica`) e o critério não é latência de login. As corridas 3 e 4 (máquina ocupada) e a 5 deram a mesma coisa: o p95 de cada janela difere do `controle` da mesma corrida em +48 ms (`5xx`), +13 ms (`prazo`) e +443 ms (`429`, que espera o recuo da repetição) na 3, e em +74 ms, +17 ms e +453 ms na 5, contra o limite de 1 s.

## Como testar

- Veredito: `infra/test/carga.test.ts` › "qualquer outra falha, e todo "indisponível", falham a fase, mesmo com o k6 limpo" e › "a espera p95
  de cada escola é julgada contra 2 s no Tutor e 10 s na ferramenta, e o limite exato reprova"
- O falso: › "o ambiente de carga é o do adaptador falso, e o script recusa qualquer outro" e › "a latência por perfil e os tokens do falso
  são os da sala, cabem no prazo de cada perfil, e as outras fases ficam como estavam"
- O balde: › "o balde que não recusou nenhuma reserva reprova (o teto não mordeu)…"
- O roteiro: `docs/runbook.md`, "Rodar o cenário de carga"
- `npx vitest run infra/test/carga.test.ts` (e `npx vitest run --project infra infra/test/carga-da-manha.int.test.ts` para o que lê o banco)
- A carga: `flock /tmp/educa-carga.lock npm run carga:reserva` e `npm run carga:reserva:controle-negativo` (o segundo só sai com 0 se a fase reprovar pelo indisponível); cada uma leva uns 13 min e constrói os pacotes antes
- Armadilha: a carga só se prova rodando; peça a vez ao Orquestrador (o compose é um só na máquina) e rode com a máquina calma. O token de acesso vale 10 min: as sessões das dez escolas saem em segundos (em paralelo), e o script recusa a corrida se passarem de 30 s

## Fora do escopo desta tarefa

O contratado real de tokens por minuto (14.0).

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano antes de codar.

1. **Mutação de cada cláusula:** a seção "Mutações" tem 76 blocos: um por termo das linhas novas de `carga.ts` com condição (o veredito, a janela, as variáveis da reserva nas três fases, a saída do controle negativo e a da fase que não terminou, a leitura do resumo do k6, a do Prometheus e a do banco, a escolha da fase em `--so=`, o relatório) e seis do k6 (o executor, o prazo esgotado esperado só na `reserva`, a validação da `FASE`, `NA_SALA`, o intervalo depois da última janela e a escolha entre `sala` e `reserva`). O `--faltando` não lista nenhuma (`infra/scripts` não é produção para ele): a lista é a minha. As duas consultas ao banco citam um teste de **unidade** que fixa as cláusulas e a ordem dos parâmetros, porque a corrida de mutações só roda os `*.int.test.ts` do projeto `integracao` e o teste de comportamento (`carga-da-manha.int.test.ts`) é do projeto `infra`: o portão o roda, e ele continua na tabela. **Ficam sem bloco, com o motivo, o que só a corrida prova:** `executarAReserva`, `trocarOsWorkersEntreAsJanelas` (a espera até o fim da janela, a recriação dos workers, `trocadasEmMs[indice] = Date.now()`, o `trocasAtrasadas`), `aguardarOInicioDaCarga`, `prepararAReserva` e `medirAsJanelas` (a idade dos tokens); `esperarAte` (`if (falta > 0) await esperar(falta)` só decide quanto dormir: sem a guarda o `esperar` recebe um número negativo e devolve de imediato, o mesmo efeito, e a espera certa é a que a corrida das trocas prova); o `semBuild ?` de `sessoesSinteticas` (escolhe entre o `dist` já construído e o `npm run`: os dois dão a mesma sessão, a diferença é o tempo, de mais de 10 min para 8 s, e quem prova é a corrida); a linha final `if (so === 'reserva') process.exitCode = await executarAReserva(...)` (a ligação do comando à corrida; a escolha da fase tem bloco em `faseDaLinhaDeComando`); `encerrarAReserva` (a guarda `if (reprovacoes === undefined) return codigo` e os ternários `codigo === 0 ? '✔ …' : '✖ …'` das mensagens): a função não é exportada, é a ligação da corrida ao relatório, como a linha final do `--so`; o código de saída é decidido por `codigoDeSaidaDaReserva`, que tem bloco para o `undefined` (`return 1` → `return 0`), para o `if (controleNegativo)` e para o `.every`, a guarda só evita que a fase que não terminou chegue a `reprovacoes.length` (sem ela o `TypeError` derruba o processo com saída diferente de zero, e o resultado é o mesmo `1`), e as mensagens são texto que a corrida mostra; e o termo `referencia !== undefined` do `reprovacoesDoTurno`, que só estreita o tipo: sem ele o limite é `NaN` e a comparação é falsa do mesmo jeito (mutante equivalente).
2. **Texto na tela:** não toca tela nem texto de `apps/web`; nenhum e2e cita o que mudou (`grep` em `e2e/` por `carga` e `reserva`).
3. **O que distingue está no teste:** cada veredito tem os dois lados (0 e 1 indisponível; o limite exato do p95 e um milissegundo acima; o degrau que sobe e o que não sobe); a `sala` é comparada com a `reserva` pelas variáveis (vazias contra preenchidas) e pelo `ambienteDaSala` com o shell exportando as do worker.
4. **Checagem anterior que responde antes:** o `exigirReservaFalsa` e o `exigirAdaptadorFalso` derrubam o script antes de subir; a configuração do worker recusa a reserva sem adaptador (`MOTIVO_RESERVA_SEM_ADAPTADOR`), e é por isso que as três variáveis da reserva não moram em `infra/carga.env` com o nome `IA_RESERVA_*`.
5. **Asserção olha o resultado:** critérios e detalhes devolvidos por `julgarReserva`, as variáveis devolvidas por `variaveisDaReserva`, as linhas lidas do banco; as de texto de arquivo (k6, compose, env) são o roteiro, e o que elas distinguem está na tabela.
6. **Guarda nova:** nenhuma.
7. **Comentário que afirma o que o código não faz:** o do compose (`vazio vale como ausente`) é provado por `opcional()` em `llm-config.ts` e pela corrida; o do `degrauNaJanela` (o worker nasce de novo antes de cada janela) é o que a corrida confirma.
8. **Divergência:** quatro, abaixo.
9. **Peça que já existe:** `prepararAsEscolasDaSala`, `criarEscolasDaSala`, `lerResumoDoK6`, `consultarPrometheus`, `semearEscolaDaSala`, o molde de `julgarSala` e o helper `execucaoDaEscola` do teste de integração.
10. **Concorrência:** a corrida é de uma linha só, dentro de `flock /tmp/educa-carga.lock`; o k6 tem ritmo constante e os intervalos sem carga garantem que a troca do worker não pega fila.
11. **Isolamento entre escolas:** não cria repository, query de produto nem endpoint; as consultas novas são rotina de teste de carga, como as da `sala`, sobre as escolas sintéticas dela.
12. **Guardiões:** `infra-guardian` (regra 80, itens 4 e 11: a reserva cai e o aluno não fica sem resposta; a carga nunca chama provedor pago), `llm-integrator` (a reserva só pela porta, e a falsa), `privacy-guardian` (escolas e usuários sintéticos; o relatório só tem contagens e ids).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| A queda não é ligada "a meio" de uma carga contínua: são **cinco janelas** (`controle`, `5xx`, `prazo`, `429`, `balde`) com 70 s sem carga entre elas, e o `carga.ts` recria os dois `worker-ia` no intervalo | `IA_FALHA_FALSA` só se lê na subida do worker (`llm-config.ts`), e mudar isso é código de produção fora desta tarefa. Recriar com a carga no ritmo atrasaria o p95 da janela pelo tempo de subida | `techspec.md` §7c, "A fase `reserva` da carga (9.0)"; `cenarios.md` §5 (primeiro parágrafo e a queda por 429); `docs/runbook.md`, "Rodar a carga da queda do principal" |
| "O p95 da fase `sala`" é o da janela `controle` da própria fase (a configuração da `sala`, reserva desligada), e não o de uma corrida `--so=sala` separada | o token de acesso vale 10 min e as duas fases somadas passam disso; a janela de controle na mesma corrida também é a mesma máquina e o mesmo minuto | `techspec.md` §7c; `cenarios.md` §5 |
| As variáveis da reserva moram em `infra/carga.env` como `RESERVA_DA_CARGA_*`, e só o script as passa ao worker | com o nome `IA_RESERVA_*` o compose as levaria ao `worker-ia` de toda fase (a `sala` ganharia reserva, e `LLM_RESERVA_*` sem adaptador recusa a subida); a 1.0 as pôs lá sem o compose as repassar. O caso da 1.0 em `packages/core/src/config/llm-config.test.ts` (a carga liga a falsa, `falso-reserva`, com o contratado próprio) passa a ler os nomes novos e a mapeá-los como o script faz; o que ele prova não muda | `techspec.md` §7c, linha "Carga" e o parágrafo da 9.0; `cenarios.md` §5; `infra/carga.env` |
| A janela do `balde` baixa o `LLM_TOKENS_POR_MINUTO` do principal para 1,2 milhão | o da `sala` (1,95 milhão) deixa o balde 4 % abaixo da carga de propósito, para a espera de 8 s bastar: sem reduzir, o transbordo à reserva não acontece | `techspec.md` §7c; `cenarios.md` §5; `docs/runbook.md` |

## Mutações

`--faltando: 0 linhas` (a saída: "Nenhuma linha nova de produção com condição fica sem bloco"). A ferramenta não lê `infra/scripts` nem `infra/k6`: os 76 blocos abaixo são a lista da pergunta 1, e o portão os aplicou um a um (todas vermelhas, em 22/11/2026).

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o contador das interrompidas só é lido quando é número
-return typeof valor === 'number' ? valor : undefined
+return true ? valor : undefined
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o contador das interrompidas só é lido quando é número
-temposEsgotados: numeroDaMetrica(metricas, 'tempos_esgotados_reserva', 'count'),
+temposEsgotados: numeroDaMetrica(metricas, 'tempos_esgotados', 'count'),
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › indisponível acima de zero na janela de 5xx
-if (medida.indisponiveis > 0) reprovacoes.push({ criterio: `indisponivel_${nome}`, detalhe: `reserva: ${medida.indisponiveis} execuções terminaram IA_INDISPONIVEL na janela ${nome}` })
+if (medida.indisponiveis > 1) reprovacoes.push({ criterio: `indisponivel_${nome}`, detalhe: `reserva: ${medida.indisponiveis} execuções terminaram IA_INDISPONIVEL na janela ${nome}` })
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › qualquer outro erro em qualquer janela reprova
-if (medida.outrasFalhas > 0) reprovacoes.push({ criterio: `falhas_${nome}`, detalhe: `reserva: ${medida.outrasFalhas} execuções falharam na janela ${nome} com outro erro que não IA_INDISPONIVEL, IA_TEMPO_ESGOTADO nem EXECUCAO_INTERROMPIDA` })
+if (medida.outrasFalhas > 2) reprovacoes.push({ criterio: `falhas_${nome}`, detalhe: `reserva: ${medida.outrasFalhas} execuções falharam na janela ${nome} com outro erro que não IA_INDISPONIVEL, IA_TEMPO_ESGOTADO nem EXECUCAO_INTERROMPIDA` })
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › na queda por prazo o `IA_TEMPO_ESGOTADO` passa
-if (medida.temposEsgotados > 0 && nome !== 'prazo') reprovacoes.push({ criterio: `tempo_esgotado_${nome}`, detalhe: `reserva: ${medida.temposEsgotados} execuções terminaram IA_TEMPO_ESGOTADO na janela ${nome}, e só a queda por prazo as produz` })
+if (medida.temposEsgotados > 0) reprovacoes.push({ criterio: `tempo_esgotado_${nome}`, detalhe: `reserva: ${medida.temposEsgotados} execuções terminaram IA_TEMPO_ESGOTADO na janela ${nome}, e só a queda por prazo as produz` })
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › na queda por prazo o `IA_TEMPO_ESGOTADO` passa
-if (medida.temposEsgotados > 0 && nome !== 'prazo') reprovacoes.push({ criterio: `tempo_esgotado_${nome}`, detalhe: `reserva: ${medida.temposEsgotados} execuções terminaram IA_TEMPO_ESGOTADO na janela ${nome}, e só a queda por prazo as produz` })
+if (nome !== 'prazo') reprovacoes.push({ criterio: `tempo_esgotado_${nome}`, detalhe: `reserva: ${medida.temposEsgotados} execuções terminaram IA_TEMPO_ESGOTADO na janela ${nome}, e só a queda por prazo as produz` })
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › a janela com poucos turnos, ou sem p95
-const turnoMedido = medida.amostrasDoTutor >= AMOSTRAS_MINIMAS_DA_JANELA && medida.turnoDoTutorP95Ms !== null
+const turnoMedido = medida.amostrasDoTutor > AMOSTRAS_MINIMAS_DA_JANELA && medida.turnoDoTutorP95Ms !== null
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › a janela com poucos turnos, ou sem p95
-const turnoMedido = medida.amostrasDoTutor >= AMOSTRAS_MINIMAS_DA_JANELA && medida.turnoDoTutorP95Ms !== null
+const turnoMedido = medida.amostrasDoTutor >= AMOSTRAS_MINIMAS_DA_JANELA
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › a janela com poucos turnos, ou sem p95
-if (!turnoMedido && (nome === 'controle' || nome === '5xx' || nome === '429')) {
+if (!turnoMedido && (nome === 'controle' || nome === '5xx')) {
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › a janela com poucos turnos, ou sem p95
-if (!turnoMedido && (nome === 'controle' || nome === '5xx' || nome === '429')) {
+if (!turnoMedido && (nome === '5xx' || nome === '429')) {
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o p95 do turno do Tutor 1 s acima do controle passa
-if ((nome === '5xx' || nome === '429') && turnoMedido && referencia !== undefined) return reprovacaoDoLimiteDoTurno(nome, medida, referencia)
+if ((nome === '5xx') && turnoMedido && referencia !== undefined) return reprovacaoDoLimiteDoTurno(nome, medida, referencia)
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o p95 do turno do Tutor 1 s acima do controle passa
-if ((nome === '5xx' || nome === '429') && turnoMedido && referencia !== undefined) return reprovacaoDoLimiteDoTurno(nome, medida, referencia)
+if ((nome === '429') && turnoMedido && referencia !== undefined) return reprovacaoDoLimiteDoTurno(nome, medida, referencia)
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › a janela com poucos turnos, ou sem p95
-if (controle?.turnoDoTutorP95Ms == null || controle.amostrasDoTutor < AMOSTRAS_MINIMAS_DA_JANELA) return undefined
+if (controle?.turnoDoTutorP95Ms == null || false) return undefined
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › a janela com poucos turnos, ou sem p95
-if (controle?.turnoDoTutorP95Ms == null || controle.amostrasDoTutor < AMOSTRAS_MINIMAS_DA_JANELA) return undefined
+if (controle.amostrasDoTutor < AMOSTRAS_MINIMAS_DA_JANELA) return undefined
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o p95 do turno do Tutor 1 s acima do controle passa
-if (turno > limite) {
+if (turno >= limite) {
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o degrau da reserva que não subiu reprova a janela
-if (nome !== 'controle' && !((medida.degrauDaReserva ?? 0) > 0)) {
+if (!((medida.degrauDaReserva ?? 0) > 0)) {
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o degrau da reserva que não subiu reprova a janela
-if (nome !== 'controle' && !((medida.degrauDaReserva ?? 0) > 0)) {
+if (nome !== 'controle' && !((medida.degrauDaReserva ?? 1) > 0)) {
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o balde cheio que não recusou nada
-if (nome === 'balde' && !((medida.recusadasPeloBalde ?? 0) > 0)) {
+if (!((medida.recusadasPeloBalde ?? 0) > 0)) {
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o balde cheio que não recusou nada
-if (nome === 'balde' && !((medida.recusadasPeloBalde ?? 0) > 0)) {
+if (nome === 'balde' && !((medida.recusadasPeloBalde ?? 1) > 0)) {
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › threshold do k6 cruzado reprova com o nome da fase
-if (resultado.k6.codigo !== saidaEsperada) reprovacoes.push({ criterio: 'k6_reserva', detalhe: `reserva: k6 saiu com ${resultado.k6.codigo}, e o resumo pedia ${saidaEsperada}` })
+if (false as boolean) reprovacoes.push({ criterio: 'k6_reserva', detalhe: `reserva: k6 saiu com ${resultado.k6.codigo}, e o resumo pedia ${saidaEsperada}` })
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › threshold do k6 cruzado reprova com o nome da fase
 for (const { metrica, criterio } of resultado.k6.cruzados) reprovacoes.push({ criterio: `reserva:${metrica}`, detalhe: `reserva: ${metrica} ${criterio}` })
-const saidaEsperada = resultado.k6.cruzados.length > 0 ? CODIGO_THRESHOLD_CRUZADO : 0
+const saidaEsperada = resultado.k6.cruzados.length > 0 ? 0 : CODIGO_THRESHOLD_CRUZADO
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › threshold do k6 cruzado reprova com o nome da fase
-for (const { metrica, criterio } of resultado.k6.cruzados) reprovacoes.push({ criterio: `reserva:${metrica}`, detalhe: `reserva: ${metrica} ${criterio}` })
+for (const { metrica, criterio } of [] as typeof resultado.k6.cruzados) reprovacoes.push({ criterio: `reserva:${metrica}`, detalhe: `reserva: ${metrica} ${criterio}` })
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › threshold do k6 cruzado reprova com o nome da fase
-for (const nome of resultado.trocasAtrasadas) reprovacoes.push({ criterio: `troca_atrasada_${nome}`, detalhe: `reserva: o worker da janela ${nome} não subiu dentro do intervalo de ${INTERVALO_ENTRE_AS_JANELAS_S} s` })
+for (const nome of [] as typeof resultado.trocasAtrasadas) reprovacoes.push({ criterio: `troca_atrasada_${nome}`, detalhe: `reserva: o worker da janela ${nome} não subiu dentro do intervalo de ${INTERVALO_ENTRE_AS_JANELAS_S} s` })
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › a janela com poucos turnos, ou sem p95
-if (medida === undefined) {
+if (false as boolean) {
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › qualquer outro erro em qualquer janela reprova
-reprovacoes.push(...reprovacoesDasFalhas(nome, medida), ...reprovacoesDoTurno(nome, medida, controle), ...reprovacoesDaReserva(nome, medida))
+reprovacoes.push(...reprovacoesDoTurno(nome, medida, controle), ...reprovacoesDaReserva(nome, medida))
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › a janela com poucos turnos, ou sem p95
-reprovacoes.push(...reprovacoesDasFalhas(nome, medida), ...reprovacoesDoTurno(nome, medida, controle), ...reprovacoesDaReserva(nome, medida))
+reprovacoes.push(...reprovacoesDasFalhas(nome, medida), ...reprovacoesDaReserva(nome, medida))
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o degrau da reserva que não subiu reprova a janela
-reprovacoes.push(...reprovacoesDasFalhas(nome, medida), ...reprovacoesDoTurno(nome, medida, controle), ...reprovacoesDaReserva(nome, medida))
+reprovacoes.push(...reprovacoesDasFalhas(nome, medida), ...reprovacoesDoTurno(nome, medida, controle))
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › cada janela começa depois da anterior
-return fim ? antes + (JANELAS_DA_RESERVA[indice]?.duracaoS ?? 0) : antes
+return antes
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o resultado de cada janela separa as falhas do banco
-.filter(([erro]) => erro !== 'IA_INDISPONIVEL' && erro !== 'IA_TEMPO_ESGOTADO' && erro !== 'EXECUCAO_INTERROMPIDA')
+.filter(([erro]) => erro !== 'IA_TEMPO_ESGOTADO' && erro !== 'EXECUCAO_INTERROMPIDA')
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o resultado de cada janela separa as falhas do banco
-.filter(([erro]) => erro !== 'IA_INDISPONIVEL' && erro !== 'IA_TEMPO_ESGOTADO' && erro !== 'EXECUCAO_INTERROMPIDA')
+.filter(([erro]) => erro !== 'IA_INDISPONIVEL' && erro !== 'EXECUCAO_INTERROMPIDA')
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o resultado de cada janela separa as falhas do banco
-.filter(([erro]) => erro !== 'IA_INDISPONIVEL' && erro !== 'IA_TEMPO_ESGOTADO' && erro !== 'EXECUCAO_INTERROMPIDA')
+.filter(([erro]) => erro !== 'IA_INDISPONIVEL' && erro !== 'IA_TEMPO_ESGOTADO')
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › cada janela leva ao worker a falha e a reserva dela
-const ligada = janela?.reserva === true
+const ligada = janela !== undefined
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o controle negativo troca só o id
-const provedor = controleNegativo ? PROVEDOR_DA_RESERVA_SEM_APROVACAO : doArquivo['RESERVA_DA_CARGA_PROVEDOR_ID']
+const provedor = false ? PROVEDOR_DA_RESERVA_SEM_APROVACAO : doArquivo['RESERVA_DA_CARGA_PROVEDOR_ID']
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › a `sala` não liga a reserva
-return ligada ? (valor ?? '') : ''
+return true ? (valor ?? '') : ''
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › cada janela leva ao worker a falha e a reserva dela
-IA_FALHA_FALSA: janela?.falha ?? '',
+IA_FALHA_FALSA: undefined ?? '',
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › cada janela leva ao worker a falha e a reserva dela
-...(janela?.tokensPorMinuto === undefined ? {} : { LLM_TOKENS_POR_MINUTO: String(janela.tokensPorMinuto) }),
+...(false as boolean ? {} : { LLM_TOKENS_POR_MINUTO: String(janela.tokensPorMinuto) }),
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › a reserva da carga é sempre a falsa
-if (adaptador !== 'falso') throw new Error(`a carga só roda com RESERVA_DA_CARGA_ADAPTADOR=falso (veio ${adaptador ?? 'nada'}): ela nunca chama provedor pago`)
+if (false as boolean) throw new Error(`a carga só roda com RESERVA_DA_CARGA_ADAPTADOR=falso (veio ${adaptador ?? 'nada'}): ela nunca chama provedor pago`)
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › reprova pelo indisponível das janelas de queda
-if (controleNegativo) return reprovadoPeloIndisponivel(reprovacoes) ? 0 : 1
+if (controleNegativo) return reprovadoPeloIndisponivel(reprovacoes) ? 1 : 0
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › reprova pelo indisponível das janelas de queda
 if (controleNegativo) return reprovadoPeloIndisponivel(reprovacoes) ? 0 : 1
-return reprovacoes.length === 0 ? 0 : 1
+return reprovacoes.length > 5 ? 0 : 1
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o worker que nem subiu reprova por outro motivo
-return JANELAS_DO_CONTROLE_NEGATIVO_DA_RESERVA.every((nome) => reprovacoes.some((reprovacao) => reprovacao.criterio === `indisponivel_${nome}`))
+return JANELAS_DO_CONTROLE_NEGATIVO_DA_RESERVA.every((nome) => reprovacoes.some((reprovacao) => reprovacao.criterio.startsWith('indisponivel_')))
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o controle negativo exige o indisponível nas duas janelas de queda, e o de uma só não basta
-return JANELAS_DO_CONTROLE_NEGATIVO_DA_RESERVA.every((nome) => reprovacoes.some((reprovacao) => reprovacao.criterio === `indisponivel_${nome}`))
+return JANELAS_DO_CONTROLE_NEGATIVO_DA_RESERVA.some((nome) => reprovacoes.some((reprovacao) => reprovacao.criterio === `indisponivel_${nome}`))
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › as consultas da janela levam as escolas e o intervalo
-from execucao_agente where escola_id = any($1::uuid[]) and funcao = 'tutor_com_o_aluno' and estado = 'concluida' and criada_em >= $2 and criada_em < $3`,
+from execucao_agente where escola_id = any($1::uuid[]) and funcao = 'tutor_com_o_aluno' and estado = 'concluida' and criada_em >= $2 and criada_em < now()`,
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › as consultas da janela levam as escolas e o intervalo
-from execucao_agente where escola_id = any($1::uuid[]) and funcao = 'tutor_com_o_aluno' and estado = 'concluida' and criada_em >= $2 and criada_em < $3`,
+from execucao_agente where escola_id = any($1::uuid[]) and funcao = 'tutor_com_o_aluno' and estado = 'concluida' and criada_em >= $3 - interval '1 year' and criada_em < $3`,
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › as consultas da janela levam as escolas e o intervalo
-from execucao_agente where escola_id = any($1::uuid[]) and funcao = 'tutor_com_o_aluno' and estado = 'concluida' and criada_em >= $2 and criada_em < $3`,
+from execucao_agente where funcao = 'tutor_com_o_aluno' and estado = 'concluida' and criada_em >= $2 and criada_em < $3`,
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › as consultas da janela levam as escolas e o intervalo
-from execucao_agente where escola_id = any($1::uuid[]) and funcao = 'tutor_com_o_aluno' and estado = 'concluida' and criada_em >= $2 and criada_em < $3`,
+from execucao_agente where escola_id = any($1::uuid[]) and estado = 'concluida' and criada_em >= $2 and criada_em < $3`,
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › as consultas da janela levam as escolas e o intervalo
-from execucao_agente where escola_id = any($1::uuid[]) and funcao = 'tutor_com_o_aluno' and estado = 'concluida' and criada_em >= $2 and criada_em < $3`,
+from execucao_agente where escola_id = any($1::uuid[]) and funcao = 'tutor_com_o_aluno' and criada_em >= $2 and criada_em < $3`,
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › as consultas da janela levam as escolas e o intervalo
-"select erro, count(*)::int as n from execucao_agente where escola_id = any($1::uuid[]) and estado = 'falhou' and criada_em >= $2 and criada_em < $3 group by erro",
+"select erro, count(*)::int as n from execucao_agente where escola_id = any($1::uuid[]) and estado = 'falhou' and criada_em >= $2 and criada_em < now() group by erro",
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › as consultas da janela levam as escolas e o intervalo
-"select erro, count(*)::int as n from execucao_agente where escola_id = any($1::uuid[]) and estado = 'falhou' and criada_em >= $2 and criada_em < $3 group by erro",
+"select erro, count(*)::int as n from execucao_agente where escola_id = any($1::uuid[]) and estado = 'falhou' and criada_em < $3 group by erro",
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › as consultas da janela levam as escolas e o intervalo
-"select erro, count(*)::int as n from execucao_agente where escola_id = any($1::uuid[]) and estado = 'falhou' and criada_em >= $2 and criada_em < $3 group by erro",
+"select erro, count(*)::int as n from execucao_agente where estado = 'falhou' and criada_em >= $2 and criada_em < $3 group by erro",
```

```mutacao
arquivo: infra/k6/justica-entre-escolas.js
teste: infra/test/carga.test.ts › o k6 da `reserva` dá a carga da sala em estágios
-const base = { executor: 'ramping-arrival-rate', env: ambiente, startRate: 0, timeUnit: '1m' }
+const base = { executor: 'constant-arrival-rate', env: ambiente, startRate: 0, timeUnit: '1m' }
```

```mutacao
arquivo: infra/k6/justica-entre-escolas.js
teste: infra/test/carga.test.ts › o k6 da `reserva` dá a carga da sala em estágios
-else if (desfecho === 'IA_TEMPO_ESGOTADO' && FASE === 'reserva') temposEsgotadosDaReserva.add(1, { escola, grupo })
+else if (desfecho === 'IA_TEMPO_ESGOTADO' ) temposEsgotadosDaReserva.add(1, { escola, grupo })
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › as durações e o intervalo do k6 são os do script
-if (fase === 'sala' || fase === 'reserva') return { IA_LATENCIA_FALSA_MS: '6000', IA_LATENCIA_FALSA_MS_PADRAO: '50000', IA_TOKENS_FALSOS_ENTRADA: '3000', IA_TOKENS_FALSOS_SAIDA: '250' }
+if (fase === 'sala') return { IA_LATENCIA_FALSA_MS: '6000', IA_LATENCIA_FALSA_MS_PADRAO: '50000', IA_TOKENS_FALSOS_ENTRADA: '3000', IA_TOKENS_FALSOS_SAIDA: '250' }
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › a janela com poucos turnos, ou sem p95
-if (!turnoMedido && (nome === 'controle' || nome === '5xx' || nome === '429')) {
+if (!turnoMedido && (nome === 'controle' || nome === '429')) {
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › reprova pelo indisponível das janelas de queda
-if (controleNegativo) return reprovadoPeloIndisponivel(reprovacoes) ? 0 : 1
+if (false as boolean) return reprovadoPeloIndisponivel(reprovacoes) ? 0 : 1
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › a fase que não terminou, porque o compose ou o worker não subiu, sai 1
 // A fase que nem terminou (o compose não subiu, o worker não subiu na troca) não provou nada, nem como controle negativo.
-if (reprovacoes === undefined) return 1
+if (reprovacoes === undefined) return 0
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › as consultas da janela levam as escolas e o intervalo
-"select erro, count(*)::int as n from execucao_agente where escola_id = any($1::uuid[]) and estado = 'falhou' and criada_em >= $2 and criada_em < $3 group by erro",
+"select erro, count(*)::int as n from execucao_agente where escola_id = any($1::uuid[]) and criada_em >= $2 and criada_em < $3 group by erro",
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o turno do Tutor e as falhas da janela viram o que o banco devolve
-return { amostras: Number(linha?.amostras ?? 0), p95Ms: linha?.p95 === null || linha?.p95 === undefined ? null : Number(linha.p95) }
+return { amostras: Number(linha?.amostras ?? 0), p95Ms: Number(linha?.p95) }
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o turno do Tutor e as falhas da janela viram o que o banco devolve
-return { amostras: Number(linha?.amostras ?? 0), p95Ms: linha?.p95 === null || linha?.p95 === undefined ? null : Number(linha.p95) }
+return { amostras: Number(linha?.amostras ?? 1), p95Ms: linha?.p95 === null || linha?.p95 === undefined ? null : Number(linha.p95) }
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o degrau da janela é a soma das séries no fim da janela
-return consultarPrometheus(prometheus, `sum(max_over_time(ia_degradacao_total{degrau="${degrau}"}[${String(segundos)}s]))`, janela.fim)
+return consultarPrometheus(prometheus, `sum(increase(ia_degradacao_total{degrau="${degrau}"}[${String(segundos)}s]))`, janela.fim)
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o degrau da janela é a soma das séries no fim da janela
-return consultarPrometheus(prometheus, `sum(max_over_time(ia_degradacao_total{degrau="${degrau}"}[${String(segundos)}s]))`, janela.fim)
+return consultarPrometheus(prometheus, `sum(max_over_time(ia_degradacao_total{degrau="${degrau}"}[${String(segundos)}s]))`, janela.inicio)
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o degrau da janela é a soma das séries no fim da janela
 export async function degrauNaJanela(prometheus: string, degrau: string, janela: { inicio: Date; fim: Date }): Promise<number | undefined> {
-const segundos = Math.max(10, Math.ceil((janela.fim.getTime() - janela.inicio.getTime()) / 1_000))
+const segundos = Math.max(1, Math.ceil((janela.fim.getTime() - janela.inicio.getTime()) / 1_000))
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › a leitura do Prometheus de cada janela começa quando a troca do worker voltou
-return new Date(trocadaEm ?? comeco.inicioLocalMs + limiteDaJanelaS(indice) * 1_000 - 5_000)
+return new Date(comeco.inicioLocalMs + limiteDaJanelaS(indice) * 1_000 - 5_000)
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › a leitura do Prometheus de cada janela começa quando a troca do worker voltou
-return new Date(trocadaEm ?? comeco.inicioLocalMs + limiteDaJanelaS(indice) * 1_000 - 5_000)
+return new Date(trocadaEm ?? comeco.inicioLocalMs + limiteDaJanelaS(indice) * 1_000 - 4_000)
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › `--so=` escolhe uma das três fases
-if (so !== undefined && so !== 'base' && so !== 'sala' && so !== 'reserva') throw new Error('--so aceita base, sala ou reserva')
+if (so !== 'base' && so !== 'sala' && so !== 'reserva') throw new Error('--so aceita base, sala ou reserva')
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › `--so=` escolhe uma das três fases
-if (so !== undefined && so !== 'base' && so !== 'sala' && so !== 'reserva') throw new Error('--so aceita base, sala ou reserva')
+if (so !== undefined  && so !== 'sala' && so !== 'reserva') throw new Error('--so aceita base, sala ou reserva')
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › `--so=` escolhe uma das três fases
-if (so !== undefined && so !== 'base' && so !== 'sala' && so !== 'reserva') throw new Error('--so aceita base, sala ou reserva')
+if (so !== undefined && so !== 'base'  && so !== 'reserva') throw new Error('--so aceita base, sala ou reserva')
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › `--so=` escolhe uma das três fases
-if (so !== undefined && so !== 'base' && so !== 'sala' && so !== 'reserva') throw new Error('--so aceita base, sala ou reserva')
+if (so !== undefined && so !== 'base' && so !== 'sala' ) throw new Error('--so aceita base, sala ou reserva')
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › as fases `base` e `carga` também levam a reserva e a falha falsa desligadas
 ...ambienteDoFalso('base'),
-...variaveisDaReserva(undefined, doArquivo),
+// ...variaveisDaReserva(undefined, doArquivo),
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › as fases `base` e `carga` também levam a reserva e a falha falsa desligadas
-VAGAS_POR_ESCOLA_DESLIGADAS: controleNegativo ? 'true' : 'false',
+VAGAS_POR_ESCOLA_DESLIGADAS: controleNegativo ? 'false' : 'true',
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o relatório da fase traz, por janela
 export function descreverReserva(resultado: ResultadoDaReserva): string[] {
-const ms = (valor: number | null) => (valor === null ? '-' : `${Math.round(valor)} ms`)
+const ms = (valor: number | null) => (valor === undefined ? '-' : `${Math.round(valor)} ms`)
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o relatório da fase traz, por janela
-`  ${medida.janela.padEnd(8)}  ${String(medida.amostrasDoTutor).padStart(6)}  ${ms(medida.turnoDoTutorP95Ms).padEnd(12)}  ${String(medida.indisponiveis).padStart(12)}  ${String(medida.temposEsgotados).padStart(14)}  ${String(medida.outrasFalhas).padStart(6)}  ${String(medida.interrompidas).padStart(13)}  ${numero(medida.degrauDaReserva).padStart(15)}  ${numero(medida.recusadasPeloBalde).padStart(13)}`,
+`  ${medida.janela.padEnd(8)}  ${String(medida.amostrasDoTutor).padStart(6)}  ${ms(medida.turnoDoTutorP95Ms).padEnd(12)}  ${String(medida.indisponiveis).padStart(12)}  ${String(medida.temposEsgotados).padStart(14)}  ${String(medida.outrasFalhas).padStart(6)}  ${String(medida.interrompidas).padStart(13)}  ${String(medida.degrauDaReserva).padStart(15)}  ${numero(medida.recusadasPeloBalde).padStart(13)}`,
```

```mutacao
arquivo: infra/scripts/carga.ts
teste: infra/test/carga.test.ts › o relatório da fase traz, por janela
-`  referência (controle, a configuração da sala, sem reserva): p95 do turno ${ms(controle?.turnoDoTutorP95Ms ?? null)}; limite da queda ${controle?.turnoDoTutorP95Ms == null ? '-' : `${Math.round(controle.turnoDoTutorP95Ms + ACRESCIMO_MAXIMO_DO_TURNO_NA_QUEDA_MS)} ms`}`,
+`  referência (controle, a configuração da sala, sem reserva): p95 do turno ${ms(controle?.turnoDoTutorP95Ms ?? null)}; limite da queda ${false ? '-' : `${Math.round(controle.turnoDoTutorP95Ms + ACRESCIMO_MAXIMO_DO_TURNO_NA_QUEDA_MS)} ms`}`,
```

```mutacao
arquivo: infra/k6/justica-entre-escolas.js
teste: infra/test/carga.test.ts › o k6 da `reserva` dá a carga da sala em estágios
-if (FASE !== 'base' && FASE !== 'expurgo' && FASE !== 'carga' && FASE !== 'sala' && FASE !== 'reserva') throw new Error('FASE precisa ser base, expurgo, carga, sala ou reserva')
+if (FASE !== 'base' && FASE !== 'expurgo' && FASE !== 'carga' && FASE !== 'sala' ) throw new Error('FASE precisa ser base, expurgo, carga, sala ou reserva')
```

```mutacao
arquivo: infra/k6/justica-entre-escolas.js
teste: infra/test/carga.test.ts › o k6 da `reserva` dá a carga da sala em estágios
-const NA_SALA = FASE === 'sala' || FASE === 'reserva'
+const NA_SALA = FASE === 'sala'
```

```mutacao
arquivo: infra/k6/justica-entre-escolas.js
teste: infra/test/carga.test.ts › o k6 da `reserva` dá a carga da sala em estágios
-if (indice < DURACOES_DAS_JANELAS_DA_RESERVA_S.length - 1) lista.push({ target: 0, duration: '1s' }, { target: 0, duration: `${INTERVALO_ENTRE_AS_JANELAS_S - 1}s` })
+if (indice < DURACOES_DAS_JANELAS_DA_RESERVA_S.length) lista.push({ target: 0, duration: '1s' }, { target: 0, duration: `${INTERVALO_ENTRE_AS_JANELAS_S - 1}s` })
```

```mutacao
arquivo: infra/k6/justica-entre-escolas.js
teste: infra/test/carga.test.ts › o k6 da `reserva` dá a carga da sala em estágios
-const daSala = FASE === 'sala' ? sala() : FASE === 'reserva' ? reserva() : { cenarios: {}, thresholds: {} }
+const daSala = FASE === 'sala' ? sala() : FASE === 'reserva' ? sala() : { cenarios: {}, thresholds: {} }
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| llm-integrator 1ª | A janela `balde` depende de `LLM_TOKENS_POR_MINUTO_NO_BALDE_CHEIO` ficar abaixo da carga do pico: "confirme que há asserção para isso" | Já existe: `infra/test/carga.test.ts` › `expect(LLM_TOKENS_POR_MINUTO_NO_BALDE_CHEIO).toBeLessThan(Number(doArquivoDeCarga()['LLM_TOKENS_POR_MINUTO']))`. Nada a mudar |
| llm-integrator 1ª, privacy-guardian 1ª, infra-guardian 1ª | Repetir a corrida com a máquina calma / os p95 absolutos dependem da máquina | Aplicada: item 1 da ordem da rodada 1 (as duas corridas refeitas com a máquina calma, em "Corridas de carga") |
| privacy-guardian 1ª | `tokens.json` gravado com 0o644 numa pasta 0o777 (o mesmo padrão da fase `sala`): 0o600 no arquivo ou 0o700 na pasta | `TODO.md`, tarefa de infra futura: muda o modo de arquivo que a `sala` (X6) também usa, e os tokens são de sessão sintética de um compose que cai no fim da corrida |
| conformidade-reviewer 1ª | O teste de `llm-config.test.ts` só ajusta os nomes; a regra 70 não depende dele | Nota do revisor, sem ação |
| test-engineer 1ª | Nenhuma janela de queda de rede (`principal:conexao`): o falso aceita o valor e nenhuma janela o usa | `TODO.md`: o PRD (RF3) e `cenarios.md` §5 pedem 5xx, prazo e 429; a queda de rede é cenário de borda ainda não pedido |
| test-engineer 1ª | `executarASala` ignora a idade do token que `prepararAsEscolasDaSala` devolve; o teto de 30 s só vale na `reserva` | `TODO.md`: é a fase `sala` da X6, e a 9.0 a mantém sem mudança, comparável à X6 |
| revisor-geral 1ª | A tabela "Recomendações sem aplicar" estava vazia, mas a linha da condição da máquina dizia "Fica como recomendação, sem aplicar" | Esta tabela; a recomendação de repetir a corrida deixou de ser "sem aplicar" (primeira linha de cima) |
| privacy-guardian 2ª | `ambienteDaSala` e `ambienteDaBase` montam o ambiente em duas funções parecidas; juntar numa só | `TODO.md`: refatoração sem mudança de comportamento, fora do que a 9.0 pede |
| conformidade-reviewer 2ª | `infra/test/carga.test.ts`: o nome do teste ainda diz "o worker sobe com uma reserva que nenhuma aprovação cobre" | `TODO.md`: só texto de nome de teste; o item 16 da ordem da rodada 1 tratou as mensagens e os documentos |
| revisor-geral 2ª, infra-guardian 2ª | O documento dizia "Cinco corridas": são seis | Aplicada na edição da rodada 3 ("Corridas de carga") |
| revisor-geral 2ª | A frase da "Condição da máquina" citava só as diferenças da corrida 5 | Aplicada na edição da rodada 3 (a corrida 3 entrou com +48, +13 e +443 ms) |
| revisor-geral 2ª, infra-guardian 2ª, llm-integrator 2ª | A corrida 6 (controle negativo) partiu com load 2,41, acima de ~2; escrever no runbook que o controle de contagem aceita o rastro da corrida anterior, ou repeti-lo parado alguns minutos | `TODO.md`, para a próxima corrida de registro (14.0): o veredito do controle é de contagem, e a tarefa já declara a condição por escrito |
| llm-integrator 2ª | Nenhum teste liga o `new Counter('tempos_esgotados_reserva')` do k6 ao nome que o `carga.ts` lê | `TODO.md`, a 14.0, a próxima tarefa que toca `infra/k6/justica-entre-escolas.js`: o número que julga a janela sai do banco |
| llm-integrator 2ª | `carga.ts` e o k6 têm mtime depois das duas corridas | Nota do revisor: por inspeção, o nome do contador é consistente entre os dois lados; sem ação |
| test-engineer 3ª | A frase de "ficam sem bloco" sobre a guarda de `encerrarAReserva` dizia que ela "só estreita o tipo para a escrita"; sem ela a fase que não terminou chega a `reprovacoes.length` e lança `TypeError` | Aplicada na edição da rodada 3, depois da aprovação: só texto de justificativa, a saída é diferente de zero de qualquer jeito |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-22 23:44:52 | 2026-11-22 23:45:17 | `llm-integrator` | 1 | APROVADO | ad8c8db2293af7504 |
| 2026-11-22 23:44:54 | 2026-11-22 23:45:28 | `tenancy-guardian` | 1 | APROVADO | a90ab29779e00b2c4 |
| 2026-11-22 23:44:48 | 2026-11-22 23:45:38 | `privacy-guardian` | 1 | APROVADO | ae51055263c64354c |
| 2026-11-22 23:44:55 | 2026-11-22 23:45:43 | `conformidade-reviewer` | 1 | APROVADO | a8e2d694da8b1bbe6 |
| 2026-11-22 23:44:50 | 2026-11-22 23:46:37 | `infra-guardian` | 1 | APROVADO | a65ce043f8a759ad8 |
| 2026-11-22 23:44:59 | 2026-11-22 23:46:54 | `revisor-geral` | 1 | REPROVADO | a77ce634a688cf6a6 |
| 2026-11-22 23:44:57 | 2026-11-22 23:49:09 | `test-engineer` | 1 | REPROVADO | aebe4efb4bf1efa45 |
| 2026-11-23 00:52:31 | 2026-11-23 00:53:13 | `privacy-guardian` | 2 | APROVADO | ae92725cf9545451e |
| 2026-11-23 00:52:47 | 2026-11-23 00:53:19 | `tenancy-guardian` | 2 | APROVADO | a6fa4ba68b0d97fe1 |
| 2026-11-23 00:52:52 | 2026-11-23 00:53:31 | `conformidade-reviewer` | 2 | APROVADO | adf4aa974b28f7a24 |
| 2026-11-23 00:52:15 | 2026-11-23 00:53:44 | `revisor-geral` | 2 | APROVADO | ac100ae9f16817c2c |
| 2026-11-23 00:52:36 | 2026-11-23 00:53:57 | `infra-guardian` | 2 | APROVADO | a556c91a3a513bf3e |
| 2026-11-23 00:52:26 | 2026-11-23 00:54:03 | `test-engineer` | 2 | REPROVADO | a09f4fc3da8bacbfa |
| 2026-11-23 00:52:42 | 2026-11-23 00:54:18 | `llm-integrator` | 2 | APROVADO | a7959de72e81bb40b |
| 2026-11-23 01:07:02 | 2026-11-23 01:07:31 | `test-engineer` | 3 | APROVADO | a29d86a88c59fce99 |
