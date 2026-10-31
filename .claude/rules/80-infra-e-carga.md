---
paths:
  - "apps/**"
  - "packages/core/**"
  - "infra/**"
  - ".github/**"
  - "tools/ci/**"
  - "compose.yaml"
---

# Regra 80 — Infraestrutura, carga e operação

## Por que esta regra existe

Uma escola que entra traz 400 usuários de uma vez, e eles não se espalham pelo dia: às 7h30
turmas inteiras fazem login no mesmo minuto, e às 10h seis turmas usam o tutor juntas. Tudo
isso sai do mesmo IP, porque a escola é uma rede só.

Um sistema que funciona com dez usuários de teste pode cair exatamente nesse momento, e o
momento é o pior possível: no meio de uma prova, na frente da turma, com o professor que
ainda estava decidindo se confia em nós. Depois do vazamento de dado, é o jeito mais rápido
de perder uma escola.

E quem opera é uma pessoa só, sem plantão. O sistema precisa se defender sozinho e avisar
antes de a escola ligar.

O desenho completo, com o modelo de carga em números, está em `docs/infra.md`.

## O modelo mental

**Dimensione para a manhã de segunda, não para a média.** A pergunta que decide qualquer
código no caminho quente não é "funciona?". É **"o que acontece com isso às 10h, com
sessenta turmas ao mesmo tempo?"**.

## As regras

1. **Rate limit é por usuário e por escola, nunca só por IP.** A escola inteira aparece
   como um IP. Bloquear IP por força bruta no login bloqueia 400 alunos por causa de um. A
   proteção de login é por conta (escola + matrícula).
   Checagem: `apps/api/test/ataque-de-senha.int.test.ts`, `apps/api/test/semaforo-de-login.int.test.ts`, `infra-guardian`.

2. **Nada demorado em request** (regra 00, item 4), e a fila tem **prioridade**:
   interativa (tutor em sala, ferramenta com o professor esperando), normal, e lote
   (ingestão, correção em massa, agente noturno, expurgo). Lote nunca atrasa interativo. Lote
   que não é urgente roda fora do horário letivo.
   Checagem: `apps/despachante/test/janela.int.test.ts`, `apps/despachante/test/vagas.int.test.ts`, `infra-guardian`.

3. **Uma escola não degrada outra.** Job de fila tem limite de concorrência por escola.
   Query tem `statement_timeout`. Upload tem limite de tamanho e de quantidade por vez.
   Checagem: `apps/despachante/test/vagas.int.test.ts`, `infra-guardian`.

4. **Toda chamada de modelo passa pelo limitador do gateway de IA**, com prioridade,
   limite de tokens por minuto abaixo do contratado, timeout, e degradação declarada: fila
   curta com aviso, depois modelo menor do mesmo perfil, depois provedor de reserva. Nunca
   erro cru para o aluno.
   Checagem: só a revisão garante (`infra-guardian`, `llm-integrator`) o limitador de tokens por minuto e a degradação; o que há de teste: `packages/core/src/ia/resilient-adapter.test.ts`.

5. **API, realtime e worker não guardam estado em memória** que outra instância precise.
   Sessão, sala ao vivo e rate limit ficam em Redis. Com duas instâncias, qualquer
   requisição pode cair em qualquer uma.
   Nota (24/10/2026): hoje a **sessão é lida do Postgres**, sem cache; sala e rate limit é que estão no Redis. A
   medida da N2 da X5 decide se o texto da regra passa a dizer "Postgres, medido" ou se a sessão ganha cache, e tem
   dois limites no cenário `rajada`: p95 de `sessao.leitura.duracao` até 50 ms **e** espera do pool de conexões até
   100 ms (R40, `tasks/prd-reengenharia/DECISOES.md`); a espera do pool sai de `observeDatabasePool` (`apps/api/src/main.ts`)
   e a leitura de sessão de `packages/core/src/identidade/sessao.guard.ts`. Até lá o que vale é "nada em memória do processo".
   Checagem: só a revisão garante (`infra-guardian`).

6. **Resposta de prova nunca se perde.** Salva no servidor a cada item, com gravação
   idempotente, reenvio no cliente quando a conexão volta, e relógio da prova no servidor.
   Queda do sistema não conta como tempo do aluno.
   Checagem: só a revisão garante (`infra-guardian`).

7. **Concorrência resolvida no banco, não com "verifica e depois grava".** Dois alunos
   reivindicando o mesmo nome, dois cliques em aprovar, job rodando duas vezes: restrição
   única, transação, ou chave de idempotência.
   Checagem: `apps/api/test/limites-da-sala.int.test.ts`, `apps/api/test/convite.int.test.ts`, `infra-guardian`.

8. **Toda query em tabela que cresce com aluno tem índice que começa pelo escopo**
   (`escolaId`, e `anoLetivoId` quando houver), e listagem é paginada. `MensagemTutor`,
   `Resposta`, `Evento` e `TrechoIndexado` são as primeiras que crescem.
   Checagem: só a revisão garante (`infra-guardian`).

9. **Migration é compatível com a versão anterior do código.** Expandir, migrar, contrair.
   Deploy em produção só fora do horário letivo, e rollback é um comando.
   Checagem: só a revisão garante (`infra-guardian`).

10. **Código novo no caminho quente mede a si mesmo.** Latência, erro e, se for fila,
    tamanho e idade do job por escola. Alerta novo vem com o parágrafo do runbook que diz o
    que fazer (`docs/runbook.md`).
    Checagem: `tools/guardas/alerta-tem-runbook.test.ts`, `apps/realtime/test/metricas.int.test.ts`, `infra-guardian`.

11. **Teste de carga não chama provedor pago** (regra 30). Usa o adaptador falso com a
    latência de streaming simulada.
    Checagem: só a revisão garante (`infra-guardian`, `llm-integrator`).

12. **Staging nunca tem dado real** (regra 20). Seed sintético, sempre.
    Checagem: só a revisão garante (`infra-guardian`, `privacy-guardian`).

## Como isso é checado

O subagente `infra-guardian` audita toda tarefa que mexe em login, tutor, modo sala, prova
online, fila, gateway de IA, migration em tabela grande, deploy ou configuração de
ambiente. O veto dele é falha da tarefa.
