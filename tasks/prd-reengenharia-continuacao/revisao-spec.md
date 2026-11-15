# Revisão de spec — reengenharia-continuacao

**Subagentes obrigatórios:** `test-engineer`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `llm-integrator`, `frontend-reviewer`, `revisor-geral`

## Rodada 1 — 15/11/2026

**Veredito: REPROVADA**

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `test-engineer` | REPROVADO | 9 |
| `tenancy-guardian` | APROVADO | 0 |
| `privacy-guardian` | REPROVADO | 2 |
| `conformidade-reviewer` | REPROVADO | 1 |
| `infra-guardian` | REPROVADO | 3 |
| `llm-integrator` | APROVADO | 0 |
| `frontend-reviewer` (sem veto) | AJUSTES NECESSÁRIOS | 3 |
| `revisor-geral` | REPROVADO | 4 |

### Correções exigidas na Tech Spec

**Muda critério do PRD (parada do Joaquim):**
- §5 "Os tokens", RF7: o modelo menor não entra no `turno_do_tutor` enquanto não passar pela medida de risco à vida e pela suíte de
  recusa (D36, regra 30.11; `docs/aia/tutor.md`); a AIA registra a degradação e os turnos sem modelo como limitação; a tarefa dos
  tokens ganha o `conformidade-reviewer` (`conformidade-reviewer`)

**Desenho, sem mudar o PRD:**
- §5 tabela de estados: o corte dos 20 s é uma passagem condicional pelo relógio do banco, feita por quem chega primeiro (o
  processador e o `GET`); o `pendente → rodando` ganha a condição de idade; a métrica soma só na transição; teste com barreira
  (`infra-guardian`, `revisor-geral`, `test-engineer`)
- §5 "Os tokens": a `ferramenta` tem teto próprio abaixo do da `interativa`; a §7c soma os tokens de ferramenta ao pico; a
  `FASE=sala` roda com teto finito (`infra-guardian`)
- §5 varredura: o limiar sai do `prazoMs` da fila; a `pendente` com job vivo não é encerrada; teste com duas réplicas
  (`infra-guardian`)
- §8: a linha estimada da execução interrompida leva o envio do adaptador configurado (`envio_externo`, `provedor`), entra no
  rastro do titular, e a estimativa sai de `preparar` + `montarPedido` sem modelo, na transação da passagem que venceu
  (`privacy-guardian`, `revisor-geral`)
- §5 "A D62": o suboperador cobre a união das categorias que as tarefas registradas enviam, cada tarefa declarando as suas; um
  caso por categoria (`privacy-guardian`, `revisor-geral`)
- §5 "A web" e §2: a tela de falha da raiz cobre as rotas sem área (entrada, sala pública, troca de senha, sistema); o
  "Voltar ao início" não existe no `Falha` e entra nele; `FALHA_DA_AREA` exportado de onde a raiz o usa (`frontend-reviewer`,
  `revisor-geral`)
- §5 "O Redis fora": a espera do `Retry-After` com o botão desabilitado e aviso, um teto, e o segundo 503 no `ErrorState` sem
  nova espera (`frontend-reviewer`)
- §10: o harness que publica pelo outbox e consome com o `JobExecutor` real, e as suítes que migram para ele; os casos do
  contexto no worker (vínculo encerrado, papel, alcance das ferramentas); a mensagem fixa sem job com a fila cheia; as três
  camadas do Tutor desligado sem job; o clique duplo em paralelo; o Redis voltando antes e depois dos 20 s; o professor vendo
  a pergunta; a marca `levaTextoDeAluno` fixada por tarefa e o caso positivo do falso e do local; o degrau sem modelo menor; o
  `PUT` pendurado, o cancelamento sem erro na tela, a raiz e a guarda do `fetch`; o celular a 360 px (`test-engineer`,
  `frontend-reviewer`)

### Recomendações
- A migration é a 0058, não a 0050; o `worker-pdf` fica em `apps/worker`; `escopo: 'escola'` e as filas do `ia.executar`;
  `ferramenta` em `WORKER_POOL_OPTIONS_BY_QUEUE` e em `QUEUE_PRIORITY`; o motivo do `@Unscoped` da varredura
- A D62 só conferida na subida: o runbook diz que encerrar o suboperador pede reiniciar a API e os `worker-ia`
- O modelo que respondeu gravado em `consumo_ia` na degradação; a suspensão entre o `202` e o worker; a virada de ano
- PRD: RF3 diz `falhou EXECUCAO_INTERROMPIDA`; "a pergunta sem resposta aparece no uso, sem o texto"; a exceção de
  `ia.espera_estourada{escola_id}` no §8
- O rollback com `ia.executar` em voo; o `IA_REPLICAS` conferido contra o compose; o `RateLimiterRedis` como troca deliberada
  (D81); a custo de base por professor no relatório da tarefa de carga

## Rodada 2 — 15/11/2026

**Veredito: REPROVADA**

Tamanho: PRD 1997 palavras · Tech Spec 1998 (depois das correções) · cenários de teste em `cenarios.md`.

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `test-engineer` | REPROVADO | 5 |
| `tenancy-guardian` | APROVADO | 0 |
| `privacy-guardian` | REPROVADO | 1 |
| `conformidade-reviewer` | APROVADO | 0 |
| `infra-guardian` | REPROVADO | 1 |
| `llm-integrator` | AJUSTES NECESSÁRIOS | 1 |
| `frontend-reviewer` (sem veto) | APROVADO | 0 |
| `revisor-geral` | REPROVADO | 3 |

### Correções exigidas na Tech Spec

Nenhuma muda critério do PRD. A espera da `ferramenta` volta a 8 s, a do RF7.

- §5 "Os estados": o processador tenta primeiro o `pendente → rodando` e só com zero linhas o corte; o `GET` corta só depois de
  ler a linha no escopo de quem pediu; os casos do corte sem `GET` e só com o `GET`, e o [P] nas duas ordens (`test-engineer`,
  `tenancy-guardian`)
- §5 "Os tokens" e tabela de estados: a espera do teto conta dentro do corte do perfil, abaixo do `prazoMs` (`llm-integrator`,
  `test-engineer`, `infra-guardian`)
- §7c: o contrato é piso, (Tutor + ferramenta) ÷ 0,7 ≈ 2,5 milhões com a `normal` cheia; o `carga.env` na escala do falso
  (`infra-guardian`)
- §5 "A varredura" e §8: a `rodando` encerrada pela varredura grava a linha estimada; a `pendente`, não; a linha vai sem
  `aluno_id`, fora do freio (`privacy-guardian`)
- §5 e §2: a pergunta sem resposta no uso (RF5), que hoje a `supervisao.repository.ts` tira de propósito: `semRespostaHoje` por
  aluno, sem texto, com o recorte de disciplina (`revisor-geral`)
- §8 e §2: `maximoDeTokensDeEntrada` em `TaskDefinition`, com a recusa antes do envio (`revisor-geral`, `llm-integrator`)
- §5 "A web": "Voltar ao início" é `<a href="/">`, com `/operacao` na operação (`revisor-geral`, `frontend-reviewer`)
- `cenarios.md`: as corridas de `onda-3a.md` §3 separadas por momento, o pool do banco, `categoriasEnviadas` de toda tarefa no
  `DECLARADO` (`test-engineer`, `privacy-guardian`)

### Recomendações acolhidas
- O payload `{ execucaoId: uuid }` estrito; nenhum método do repository recebe a escola; a varredura iguala a escola do job; o
  `EXPLAIN` da varredura na tarefa (`tenancy-guardian`, `infra-guardian`)
- A trava do Tutor cita a D36 e a regra 30.11, e liberar pede decisão registrada; a saída do modelo menor passa pela mesma
  conferência; a mensagem fixa visível acima do "Tentar de novo" (`conformidade-reviewer`)
- O aviso da espera com texto fixo e a contagem `aria-hidden`; o `DrawerContext` padrão (`frontend-reviewer`)
- O preço do modelo menor na tabela, ou a subida falha; o balde que superestima depois de um `kill -9` (`llm-integrator`)
- `naoUrgente` no `ia.executar`; o rollback com linhas de `ferramenta`; o alerta de tokens medido sobre o contratado; a linha de
  `consumo_ia` no `docs/lgpd.md`; a guarda do executor; `Retry-After` de 10 e 11; o `page.route` no e2e

## Rodada 3 — 15/11/2026

**Veredito: REPROVADA**

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `test-engineer` | REPROVADO | 6 |
| `tenancy-guardian` | APROVADO | 0 |
| `privacy-guardian` | APROVADO | 0 |
| `conformidade-reviewer` | APROVADO | 0 |
| `infra-guardian` | REPROVADO | 2 |
| `llm-integrator` | AJUSTES NECESSÁRIOS | 1 |
| `frontend-reviewer` (sem veto) | APROVADO | 0 |
| `revisor-geral` | REPROVADO | 1 |

### Correções exigidas na Tech Spec

Nenhuma muda critério do PRD.

- §5 tabela de estados, linha `rodando`: o corte do perfil valia por chamada, e o gateway faz duas tentativas mais o degrau. Passa
  a ser um **prazo único da execução** (60 s, 140 s), contado do `rodando`, repassado como `pedido.sinal`, cobrindo espera,
  tentativas e degrau; estourado, `falhou IA_INDISPONIVEL` pelo processador (`llm-integrator`, `infra-guardian`, `test-engineer`)
- §8: o `maximoDeTokensDeEntrada` sai do pior pedido válido (cada campo no limite do `esquemaDeEntrada`), e a recusa é guarda de
  defeito, com código, métrica e alerta próprios (`revisor-geral`, `infra-guardian`, `test-engineer`)
- `cenarios.md`: o `GET` sobre `concluida`, `rodando` e `ferramenta`; a varredura em paralelo com barreira; o "de hoje" com a
  pergunta de ontem; o pior pedido por tarefa; o prazo de 140 s e não 148 s, com prazo por chamada como mutação; a linha do uso a
  360 px (`test-engineer`)

### Recomendações acolhidas
- `semRespostaHoje` conta só `IA_INDISPONIVEL` e `EXECUCAO_INTERROMPIDA` sem mensagem fixa (não a S12, a suspensão nem o
  `NAO_ENCONTRADO`), no `FUSO_DO_USO`, com o recorte de turma, ano e disciplina; o texto "N perguntas que o Tutor não respondeu
  hoje", neutro e separado do freio; a N21 da AIA, o `uso.ts` e a linha "Uso do Tutor" do `docs/lgpd.md` (`conformidade-reviewer`,
  `privacy-guardian`, `revisor-geral`, `frontend-reviewer`)
- O corte do `GET` só na `interativa`; a linha estimada com a escola do `returning` e o `execucao_id`; duas escolas no mesmo
  ciclo da varredura; outra turma e outro ano fora do `semRespostaHoje` (`tenancy-guardian`, `privacy-guardian`)
- `levaTextoDeAluno: true` exige `conversa_do_aluno` (`privacy-guardian`, `revisor-geral`, `test-engineer`)
- O alerta de tokens aos 70 % do contratado; os dois pisos (3.000 + 250 e 5.000 + 300) no `docs/infra.md`; `fila in (…)` no
  `not exists` (`infra-guardian`)
- A reserva nova a cada chamada; o texto próprio da falha da raiz; o "Voltar ao início" secundário (`llm-integrator`,
  `revisor-geral`, `frontend-reviewer`)

## Rodada 4 — 15/11/2026

**Veredito: REPROVADA**

Rodada só com quem reprovou ou pediu ajuste na 3.

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `test-engineer` | REPROVADO | 3 |
| `infra-guardian` | APROVADO | 0 |
| `llm-integrator` | APROVADO | 0 |
| `revisor-geral` | REPROVADO | 2 |

### Correções exigidas

Nenhuma muda critério do PRD: o alerta de tokens volta aos 80 % do RF8.

- §7c: "Tokens acima de 80 %" do contratado, como no RF8 (o balde cheio; o runbook diz que é saturação), com aviso aos 70 %
  (`revisor-geral`)
- §5 "A pergunta sem resposta": conta os códigos passageiros (a lista `PASSAGEIROS` da web, com `IA_TEMPO_ESGOTADO`,
  `IA_SAIDA_INVALIDA` e `PEDIDO_ACIMA_DO_TETO`), e não só o corte e a interrompida; um caso por código (`revisor-geral`,
  `test-engineer`)
- `cenarios.md` §4: o prazo único com `LLM_TIMEOUT_MS_<PERFIL>` acima do prazo, os dois relógios juntos e tempos em que a mutação
  "prazo por chamada" passa do `prazoMs` (`test-engineer`)
- `cenarios.md` §3: `aparenciaDaFalha('PEDIDO_ACIMA_DO_TETO') === 'fila'` (`test-engineer`)

### Recomendações acolhidas
- O prazo estourado grava `IA_TEMPO_ESGOTADO` (o código de hoje), decidido pelo próprio sinal; o abort do desligamento não grava
  (`llm-integrator`, `infra-guardian`, `revisor-geral`)
- A ordem dos baldes: o da fila antes, devolvido com `reward` se o geral recusar; a espera pelo `msBeforeNext` e pelo
  `pedido.sinal` (`infra-guardian`)
- `PEDIDO_ACIMA_DO_TETO` na §2 (`LLM_ERROR_CODES`, `shared/src/errors`, `HTTP_STATUS_BY_CODE`, `PASSAGEIROS`), sem `consumo_ia`
  (`revisor-geral`, `llm-integrator`)
- As mutações do `GET` na decisão da leitura; a barreira da varredura entre o `update … returning` e o `commit`; o "agora" fixo e a
  mutação "dia em UTC"; o gerador do pior pedido que falha sem limite (`test-engineer`)

## Rodada 5 — 15/11/2026

**Veredito: REPROVADA**

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `test-engineer` | REPROVADO | 2 |
| `revisor-geral` | APROVADO | 0 |

### Correções exigidas (só em `cenarios.md`)
- §1: um caso parametrizado sobre a `PASSAGEIROS` importada de `packages/shared`, com `ERRO_INTERNO` e `IA_ENTRADA_INVALIDA`;
  mutação "lista copiada" (`test-engineer`)
- §4: a variante do modelo menor com a configuração e o instante próprios (600 s: 140 contra 148 s; 100 s: 108 contra 140 s), e o
  primeiro caso dizendo que a vaga abre e o pedido vai ao modelo principal (`test-engineer`)

### Recomendações acolhidas
- Sem `erro_inesperado` no prazo estourado; os tempos da 2.ª reserva; o teto rebaixado na definição injetada; os limiares dos
  alertas, com o balde cheio disparando o de 80 % (`test-engineer`, `revisor-geral`)
- `PEDIDO_ACIMA_DO_TETO` com 503, como o `IA_INDISPONIVEL`; a `PASSAGEIROS` saindo da web na §2 (`revisor-geral`)

## Rodada 6 — 15/11/2026

**Veredito: APROVADA**

Tamanho: PRD 1997 palavras · Tech Spec 1998 · cenários de teste em `cenarios.md`.

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `test-engineer` | APROVADO | 0 |

Os demais revisores aprovaram nas rodadas anteriores, sobre correções que não voltaram a mexer na área deles: `tenancy-guardian`,
`privacy-guardian`, `conformidade-reviewer` e `frontend-reviewer` na 3, `infra-guardian` e `llm-integrator` na 4,
`revisor-geral` na 5.

### Recomendações acolhidas
- O caso parametrizado sem filtro, e um teste em `packages/shared` que fixa a `PASSAGEIROS` inteira; a vaga aos 7 s no primeiro
  caso do prazo (`test-engineer`)

### Recomendações para as tarefas
- O valor 503 do `PEDIDO_ACIMA_DO_TETO` só importa se um caminho síncrono o devolver; a tarefa diz qual, ou registra que não há
  (`test-engineer`)
- O custo de base por professor fica para o `docs/infra.md` ou a `docs/avaliacao-de-modelos.md`, depois da D37 (`llm-integrator`)

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-15 01:16:24 | 2026-11-15 01:16:52 | `frontend-reviewer` | 1 | AJUSTES NECESSÁRIOS | a31b12a97ca721279 |
| 2026-11-15 01:16:21 | 2026-11-15 01:17:41 | `llm-integrator` | 1 | APROVADO | af9d628db140736a3 |
| 2026-11-15 01:16:09 | 2026-11-15 01:18:32 | `tenancy-guardian` | 1 | APROVADO | ace91d331928cd3da |
| 2026-11-15 01:16:12 | 2026-11-15 01:19:27 | `privacy-guardian` | 1 | REPROVADO | a8aec7f0d982a30a7 |
| 2026-11-15 01:16:15 | 2026-11-15 01:19:48 | `conformidade-reviewer` | 1 | REPROVADO | a8a2d2cc645e89a14 |
| 2026-11-15 01:16:18 | 2026-11-15 01:21:03 | `infra-guardian` | 1 | REPROVADO | a4c8f52d0f6aa3257 |
| 2026-11-15 01:16:06 | 2026-11-15 01:21:24 | `test-engineer` | 1 | REPROVADO | a3e7f18431db0bdd1 |
| 2026-11-15 01:16:27 | 2026-11-15 01:21:46 | `revisor-geral` | 1 | REPROVADO | a5b314fc5209a8117 |
| 2026-11-15 02:37:12 | 2026-11-15 02:37:31 | `frontend-reviewer` | 2 | APROVADO | a13e695c3c860c937 |
| 2026-11-15 02:37:18 | 2026-11-15 02:37:55 | `llm-integrator` | 2 | AJUSTES NECESSÁRIOS | a4e717e86e9a635ed |
| 2026-11-15 02:36:53 | 2026-11-15 02:38:24 | `conformidade-reviewer` | 2 | APROVADO | a6ed258dac33ddbbf |
| 2026-11-15 02:36:47 | 2026-11-15 02:39:00 | `privacy-guardian` | 2 | REPROVADO | a87ddd982bd85d7f9 |
| 2026-11-15 02:37:23 | 2026-11-15 02:39:01 | `tenancy-guardian` | 2 | APROVADO | ae517082a9245c923 |
| 2026-11-15 02:36:41 | 2026-11-15 02:39:02 | `test-engineer` | 2 | REPROVADO | a2bef0d67bff3c38e |
| 2026-11-15 02:36:59 | 2026-11-15 02:40:11 | `infra-guardian` | 2 | REPROVADO | acbbe05ff3ad86e72 |
| 2026-11-15 02:37:06 | 2026-11-15 02:40:28 | `revisor-geral` | 2 | REPROVADO | a72f3bd9fb2b5903d |
| 2026-11-15 02:45:58 | 2026-11-15 02:46:17 | `frontend-reviewer` | 3 | APROVADO | a77927e88791005a9 |
| 2026-11-15 02:45:42 | 2026-11-15 02:46:20 | `llm-integrator` | 3 | AJUSTES NECESSÁRIOS | a59ce37e028eaca3f |
| 2026-11-15 02:45:48 | 2026-11-15 02:47:09 | `conformidade-reviewer` | 3 | APROVADO | ad853bb08259dd437 |
| 2026-11-15 02:45:23 | 2026-11-15 02:47:14 | `privacy-guardian` | 3 | APROVADO | a8c6bfe8df929e347 |
| 2026-11-15 02:45:54 | 2026-11-15 02:47:20 | `tenancy-guardian` | 3 | APROVADO | ac235a701ff02128d |
| 2026-11-15 02:45:36 | 2026-11-15 02:47:34 | `revisor-geral` | 3 | REPROVADO | ab1ef1ae67133b4a4 |
| 2026-11-15 02:45:16 | 2026-11-15 02:48:17 | `test-engineer` | 3 | REPROVADO | a4d287b66f795fb6a |
| 2026-11-15 02:45:29 | 2026-11-15 02:48:58 | `infra-guardian` | 3 | REPROVADO | ac2af96b5ba6edbbf |
| 2026-11-15 02:52:07 | 2026-11-15 02:52:34 | `llm-integrator` | 4 | APROVADO | a9d47df39bcc8b922 |
| 2026-11-15 02:52:01 | 2026-11-15 02:54:52 | `revisor-geral` | 4 | REPROVADO | a0c99c90c590b0612 |
| 2026-11-15 02:51:54 | 2026-11-15 02:55:15 | `infra-guardian` | 4 | APROVADO | a9c88e0794c0307bc |
| 2026-11-15 02:51:47 | 2026-11-15 02:56:04 | `test-engineer` | 4 | REPROVADO | ac903948c042a1a22 |
| 2026-11-15 02:58:17 | 2026-11-15 02:59:50 | `revisor-geral` | 5 | APROVADO | ac11e064b9b3603f1 |
| 2026-11-15 02:58:10 | 2026-11-15 03:00:52 | `test-engineer` | 5 | REPROVADO | aab714ec4610eb016 |
| 2026-11-15 03:01:55 | 2026-11-15 03:04:06 | `test-engineer` | 6 | APROVADO | a6e40182533de9a99 |
