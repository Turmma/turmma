# Revisão de spec — camada-ia

**Subagentes obrigatórios:** `test-engineer`, `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `conformidade-reviewer`, `llm-integrator`, `frontend-reviewer`, `revisor-geral`

## Rodada 1 — 20/11/2026

**Veredito: REPROVADA**

Tamanho: PRD 2.000 palavras · Tech Spec 1.995 palavras.

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `test-engineer` | REPROVADO | 18 (cenários que faltam; limite exato do teto; meses anteriores; linha do principal que caiu; mutações que não derrubam) |
| `tenancy-guardian` | REPROVADO | isolamento efetivo só para uma das três leituras do `OrcamentoDoMesRepository` |
| `privacy-guardian` | REPROVADO | a interrompida durante a chamada à reserva grava só o principal: a lista de compartilhamento perde a reserva |
| `infra-guardian` | REPROVADO | a `chaveEnvio` do `PUT` sem lugar, e o `antes` lido fora da trava; a interrompida na reserva |
| `conformidade-reviewer` | REPROVADO | a aprovação vale para tarefa e modelo, e `IA_RESERVA_TAREFAS` guarda só a tarefa |
| `llm-integrator` | AJUSTES | o Tutor fora da lista sem cenário no caminho "sem vaga" |
| `frontend-reviewer` | AJUSTES | o diálogo da rede sem confirmação do efeito; 360 px de quatro telas; acessibilidade do diálogo e do aviso |
| `revisor-geral` | REPROVADO | rota de uso duplicada contra o I1; `chaveEnvio`; meses anteriores; `>` contra `>=`; custo da interrompida; vocabulário "reserva" |

### Correções exigidas na Tech Spec
- §3, §5, §7b: a reserva só atende o par tarefa e modelo com aprovação versionada (`MODELOS_APROVADOS`, com relatório e sha256); some `IA_RESERVA_TAREFAS` (`conformidade-reviewer`)
- §3: a interrompida e a chamada que caiu depois do envio gravam a estimativa; com reserva aprovada para a tarefa, também a linha da reserva (`privacy-guardian`, `infra-guardian`, `revisor-geral`, `test-engineer`)
- §4, §7c: o `PUT` sem `chaveEnvio`, numa transação com `for update`, e auditoria só quando `antes ≠ depois` (`infra-guardian`, `revisor-geral`, `test-engineer`)
- §4, §6: o uso de IA estende o `GET /v1/operacao/uso` e o `uso()` do `PainelRepository`, que segue com três `@Unscoped` (I1); os meses rodam no contexto da escola (`revisor-geral`, `tenancy-guardian`)
- §3, §4: retrato mensal de alunos ativos e valor, para o mês fechado (`test-engineer`, `revisor-geral`)
- §5: o teto adia só **acima** (`>`); cenários alinhados (`revisor-geral`, `test-engineer`)
- §2: glossário revisto, e o conceito novo com o nome "provedor de reserva" (`revisor-geral`)
- §9: confirmação do diálogo com antes, depois e as escolas atingidas; 360 px; acessibilidade (`frontend-reviewer`)
- `cenarios.md`: os cenários e as mutações de todos os bloqueantes acima (`test-engineer`, `tenancy-guardian`, `llm-integrator`)

### Recomendações
- Máximo de chamadas por execução declarado; contador do lote adiado; runbook do teto cita a classificação atrasada; ultrapassagem do teto por até 2 vagas de lote, escrita
- `EXPLAIN` com o volume de um ano; o índice sem `concurrently`, com `lock_timeout`
- O mesmo vínculo de aprovação para o principal (`TODO.md`); a AIA do Tutor descreve a queda para a reserva
- Guarda de que `tools/ia/amostras/` não tem correção de discursiva (D55); o lote retido sem trecho de material de terceiro
- Aviso às escolas antes de um suboperador novo entrar no caminho

## Rodada 2 — 20/11/2026

**Veredito: REPROVADA**

Tamanho: PRD 2.000 palavras · Tech Spec 2.000 palavras.

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `frontend-reviewer` | APROVADO | — |
| `llm-integrator` | APROVADO | — |
| `conformidade-reviewer` | APROVADO | — |
| `tenancy-guardian` | REPROVADO | §2 sem as duas escolas conferidas e com B abaixo do teto; `PUT` da rede sem isolamento |
| `privacy-guardian` | REPROVADO | a estimada da reserva só na varredura (falta a reentrega); a reserva fora do Brasil com tarefa que envia `trabalho_do_aluno` |
| `infra-guardian` | REPROVADO | a estimada da reserva só na varredura |
| `test-engineer` | REPROVADO | 9: `PUT` sem ano em curso; reentrega; preço da interrompida; provedor na aprovação; o que o sha256 prende; a aprovação do falso na carga; números do `uso()`; mutação dos meses; auditoria da rede |
| `revisor-geral` | REPROVADO | o repository do mês em `apps/api` (o gauge não importa); o `PUT` da rede sem `@Unscoped` declarado e com contagem entre escolas; a interrompida incoerente |

### Correções exigidas na Tech Spec
- §3: a linha estimada da reserva nasce no `registrarEstimada`, pela varredura e pela reentrega, cada linha ao preço do seu modelo (`privacy-guardian`, `infra-guardian`, `test-engineer`, `revisor-geral`)
- §5: a reserva exige Brasil sempre, como o principal (`privacy-guardian`)
- §5: o `sha256` é do `relatorio.md` e a guarda o recalcula; `aprovadoPor`; a entrada do falso não vale em produção (`test-engineer`, `conformidade-reviewer` em recomendação)
- §2, §6: `OrcamentoDoMesRepository` em `packages/core`; a rede grava no `@Unscoped` único de um `OrcamentoDaRedeRepository`; a contagem das escolas que usam o valor da rede só pelo `GET …/redes`; o `uso()` usa os mesmos trechos da soma (`revisor-geral`, `test-engineer`)
- `cenarios.md`: §2 refeito com as duas escolas e duas variantes; o `PUT` da rede; a reentrega; o provedor na aprovação; o falso em produção; o `uso()` por escola; os meses; a auditoria da rede; o `PUT` sem ano em curso; o aviso nulo no mês fechado (`tenancy-guardian`, `test-engineer`, `privacy-guardian`)

### Recomendações
- "Teto de segurança" é jargão no diálogo; `Esc` e foco preso no diálogo (`frontend-reviewer`)
- O 429 que sobra conta nas quatro chamadas (`llm-integrator`)
- O índice `consumo_ia_funcao_idx` pode ficar redundante; decidir na contração (`infra-guardian`)
- `orcamento_ia_do_mes` sem `anoLetivoId`, com o motivo, e `sem_pessoa` na classificação de privacidade (`tenancy-guardian`, `privacy-guardian`)
- O cadastro de suboperador não confere "permite serviço usado por menor"; linha no runbook (`privacy-guardian`)
- `ORDENS_DO_PAINEL`: um schema próprio para o `uso` com `custo` (`revisor-geral`)

## Rodada 3 — 20/11/2026

**Veredito: REPROVADA**

Tamanho: PRD 2.000 palavras · Tech Spec 1.995 palavras.

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `privacy-guardian` | APROVADO | — |
| `tenancy-guardian` | APROVADO | — |
| `infra-guardian` | REPROVADO | `AMBIENTE=carga` não existe; a carga roda em `local` |
| `revisor-geral` | REPROVADO | a interrompida com "entrada contada" contra o PRD, o `docs/lgpd.md` e o código: são os dois tetos |
| `test-engineer` | REPROVADO | 7: `AMBIENTE=carga`; a entrada do falso na guarda e a recusa na elegibilidade; a estimada só por tarefa e provedor sem cenário; o `distinct` do `uso()`; o `@Unscoped` único sem teste; os meses numa mutação só; `escolasQueUsamOValorDaRede` coluna a coluna |

### Correções exigidas
- §3: a chamada que caiu grava a entrada contada; a interrompida, os dois tetos, uma linha por destino (`revisor-geral`)
- §5: o falso é `provedorId = 'falso'`, com relatório sintético versionado, recusado pela elegibilidade em produção (`test-engineer`)
- §4: `escolasQueUsamOValorDaRede` conta valor ou teto vindo da rede (`test-engineer`)
- `cenarios.md`: a carga em `AMBIENTE=local`; a elegibilidade do falso por ambiente; a estimada com `modelo-y`; preços diferentes nos dois destinos; o aluno em duas turmas no `uso()`; o relógio como parâmetro; os meses em dois blocos; o `@Unscoped` único em `architecture.test.ts`; os casos mistos da contagem (`infra-guardian`, `test-engineer`)

### Recomendações
- Gravar a rede no `EscolaRepository`, que já tem o `@Unscoped` da rede, em vez de um repository novo (`tenancy-guardian`)
- A estimada da reserva entra com a reserva só configurada, mesmo recusada na conferência: escrever a escolha na linha 99 do `docs/lgpd.md` (`privacy-guardian`)
- A varredura e o processor recebem os dois destinos e `MODELOS_APROVADOS` pelo `ia-do-worker.module.ts`; a medida publica as duas séries de uma soma só (`revisor-geral`)
- `IA_FALHA_FALSA` declarada em `llm-config.ts` (`infra-guardian`)

## Rodada 4 — 20/11/2026

**Veredito: REPROVADA**

Tamanho: PRD 2.000 palavras · Tech Spec 1.999 palavras.

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `revisor-geral` | APROVADO | — |
| `infra-guardian` | REPROVADO | a reserva falsa com o id e o balde do principal; em produção, a falsa some sem alerta |
| `test-engineer` | REPROVADO | 4: a isenção do falso na guarda; a recusa em produção só na função pura; a estimada sem o caso de outro provedor; a contagem da rede com uma rede só |

### Correções exigidas
- §5: a reserva falsa leva o id de `IA_RESERVA_PROVEDOR_ID` (`falso-reserva`), com balde, rótulo e disjuntor próprios; a subida recusa reserva com o id do principal e, em produção, a falsa (`infra-guardian`, `test-engineer`, `revisor-geral` em recomendação)
- `cenarios.md`: a guarda do falso com hash errado; a recusa pela configuração real; a identidade própria no gateway; a estimada com outro provedor; a contagem com duas redes; a carga com `falso-reserva` e o controle negativo com um id sem aprovação (`infra-guardian`, `test-engineer`)

## Rodada 5 — 20/11/2026

**Veredito: REPROVADA**

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `infra-guardian` | APROVADO | — |
| `test-engineer` | REPROVADO | o alerta de `ia.provedor_de_reserva.conferido` "só com reserva configurada" sem cenário |

### Correções exigidas
- `cenarios.md` RF9: sem reserva configurada, a série não é publicada e o alerta não dispara (`test-engineer`)

### Recomendações (aplicadas no `cenarios.md`)
- A comparação dos dois ids com caso em `AMBIENTE=local`; o motivo da reprovação do controle negativo da carga (`test-engineer`)
- A recusa de `falso-reserva` sobre `openai_compat` vale em todo ambiente? Fica para a tarefa decidir com o `infra-guardian` (`infra-guardian`)

## Rodada 6 — 20/11/2026

**Veredito: APROVADA**

Tamanho: PRD 2.000 palavras · Tech Spec 1.997 palavras.

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `test-engineer` | APROVADO (rodada 6) | — |
| `infra-guardian` | APROVADO (rodada 5) | — |
| `revisor-geral` | APROVADO (rodada 4) | — |
| `tenancy-guardian` | APROVADO (rodada 3) | — |
| `privacy-guardian` | APROVADO (rodada 3) | — |
| `conformidade-reviewer` | APROVADO (rodada 2) | — |
| `llm-integrator` | APROVADO (rodada 2) | — |
| `frontend-reviewer` | APROVADO (rodada 2) | — |

### Recomendações que vão para as tarefas
- A série `ia.provedor_de_reserva.conferido` passa a 1 na reconferência; a reserva meio configurada recusa a subida citando a variável que falta (`test-engineer`)
- Todas as recomendações das rodadas 1 a 5 acima, cada uma como subtarefa ou linha de teste na tarefa que toca o arquivo

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-20 22:33:35 | 2026-11-20 22:33:57 | `frontend-reviewer` | 1 | AJUSTES NECESSÁRIOS | ad316d3ddf1b3e597 |
| 2026-11-20 22:33:33 | 2026-11-20 22:34:25 | `llm-integrator` | 1 | AJUSTES NECESSÁRIOS | a7fc122c8752a103e |
| 2026-11-20 22:33:31 | 2026-11-20 22:35:04 | `conformidade-reviewer` | 1 | REPROVADO | a986610ce1edd7676 |
| 2026-11-20 22:33:25 | 2026-11-20 22:35:34 | `tenancy-guardian` | 1 | REPROVADO | ae337a35e68729723 |
| 2026-11-20 22:33:27 | 2026-11-20 22:35:39 | `privacy-guardian` | 1 | REPROVADO | a82dc4f8accfdb368 |
| 2026-11-20 22:33:22 | 2026-11-20 22:37:22 | `test-engineer` | 1 | REPROVADO | afa2ffe11e6b41d6f |
| 2026-11-20 22:33:29 | 2026-11-20 22:37:50 | `infra-guardian` | 1 | REPROVADO | aeec892966d615aff |
| 2026-11-20 22:33:38 | 2026-11-20 22:38:13 | `revisor-geral` | 1 | REPROVADO | a0f65e9c57e2e8bb1 |
| 2026-11-20 22:44:34 | 2026-11-20 22:44:48 | `frontend-reviewer` | 2 | APROVADO | a1a971ee5f6e96b67 |
| 2026-11-20 22:44:31 | 2026-11-20 22:45:00 | `llm-integrator` | 2 | APROVADO | adbe0541a837e8f3d |
| 2026-11-20 22:44:28 | 2026-11-20 22:45:19 | `conformidade-reviewer` | 2 | APROVADO | aff6264e96082faee |
| 2026-11-20 22:44:16 | 2026-11-20 22:46:02 | `tenancy-guardian` | 2 | REPROVADO | a7792451e9297b4cf |
| 2026-11-20 22:44:20 | 2026-11-20 22:46:26 | `privacy-guardian` | 2 | REPROVADO | a4d61560601f23701 |
| 2026-11-20 22:44:24 | 2026-11-20 22:47:09 | `infra-guardian` | 2 | REPROVADO | ab977de999507e292 |
| 2026-11-20 22:44:12 | 2026-11-20 22:47:21 | `test-engineer` | 2 | REPROVADO | ae6ee645c63916dca |
| 2026-11-20 22:44:39 | 2026-11-20 22:48:22 | `revisor-geral` | 2 | REPROVADO | acb934a66ae128e11 |
| 2026-11-20 22:50:35 | 2026-11-20 22:51:24 | `privacy-guardian` | 3 | APROVADO | a77e699cfd0c1b2aa |
| 2026-11-20 22:50:32 | 2026-11-20 22:51:52 | `tenancy-guardian` | 3 | APROVADO | a8f0b1d6f4473b15c |
| 2026-11-20 22:50:39 | 2026-11-20 22:52:03 | `infra-guardian` | 3 | REPROVADO | a61bc687f3cabe235 |
| 2026-11-20 22:50:46 | 2026-11-20 22:53:08 | `revisor-geral` | 3 | REPROVADO | a81517ca059189973 |
| 2026-11-20 22:50:43 | 2026-11-20 22:53:30 | `test-engineer` | 3 | REPROVADO | a9e69ab09382bb429 |
| 2026-11-20 22:54:23 | 2026-11-20 22:55:46 | `infra-guardian` | 4 | REPROVADO | a60b7c7dd94917694 |
| 2026-11-20 22:54:29 | 2026-11-20 22:55:57 | `test-engineer` | 4 | REPROVADO | aa5ed3cef3b49353a |
| 2026-11-20 22:54:26 | 2026-11-20 22:55:59 | `revisor-geral` | 4 | APROVADO | a9f7bff62b32a9f45 |
| 2026-11-20 22:56:38 | 2026-11-20 22:57:22 | `infra-guardian` | 5 | APROVADO | ad35aedfd50ec2932 |
| 2026-11-20 22:56:41 | 2026-11-20 22:58:04 | `test-engineer` | 5 | REPROVADO | a3645a9abd85b45f4 |
| 2026-11-20 22:58:16 | 2026-11-20 22:59:19 | `test-engineer` | 6 | APROVADO | a36599145732eabcd |
| 2026-11-20 23:12:25 | 2026-11-20 23:17:22 | `test-engineer` | 7 | REPROVADO | a97677c494549bebb |
