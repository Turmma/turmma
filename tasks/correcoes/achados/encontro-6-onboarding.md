# Achados das revisões — `tasks/correcoes/encontro-6-onboarding.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## test-engineer · 1ª rodada · APROVADO · 2026-11-03 22:19:54 · `tasks/correcoes/encontro-6-onboarding.md`

VEREDITO: APROVADO

Cenários exigidos: esta correção só resolve um conflito de merge. Os casos que ela precisa provar são estes:
1. Nada além dos três arquivos de exports (`index.ts`) mudou em relação à árvore que o git junta sozinho.
2. Os exports das duas tarefas, 5.0 e 6.0, estão todos lá, sem nenhum marcador de conflito.
3. Os testes da 6.0 continuam passando agora que as regras da 5.0 valem para a planilha de professores. São três: o limite de 20 pedidos por minuto por usuário, as 2 vagas por escola e o teto de 3.000 linhas.
4. Não entrou nenhuma cláusula nova que precisasse de mutação.

Cobertos:
- **1:** comparei a árvore que o git junta sozinho (`1aed6608…`) com a árvore preparada para o commit (`3684288d…`). As únicas diferenças são `packages/core/src/importacao/index.ts`, `packages/core/src/index.ts`, `packages/shared/src/index.ts` e o próprio `tasks/correcoes/encontro-6-onboarding.md`. Nos três `index.ts` a mudança é só a união das linhas de cada lado, sem marcador.
- **2:** estão `ImportacaoLida`, `CalendarioRepository`, `ContaDaPlanilhaPerdidaError`, `DiferencaNaPlanilhaError`, `LIMITE_DA_PLANILHA_POR_MINUTO`, `MINUTOS_DA_IMPORTACAO_NA_FILA_PARA_ALERTAR`, `MAXIMO_DE_LINHAS_DA_PLANILHA`, `MAXIMO_DE_LINHAS_DA_PLANILHA_DE_PROFESSORES` e `VAGAS_DA_PLANILHA_POR_ESCOLA`.
- **3:** os dois tetos de linhas não brigam: o da planilha de professores é 300, abaixo do teto geral de 3.000. O teste da 6.0 de "acima do teto" (301 linhas) continua chegando à regra própria, que devolve `acima_do_teto`. Cada caso de `apps/api/test/professores.int.test.ts` cria uma coordenação nova com `escolaComCoordenacao()`, então nenhum deles bate no balde de 20 por minuto do mesmo usuário. Rodei nesta árvore, todos verdes:
  - `apps/api/test/professores.int.test.ts`: 35 de 35
  - `apps/worker/test/gravar-planilha-professores.int.test.ts`: 29 de 29
  - `packages/shared/src/importacao/contratos.test.ts`, `packages/core/src/importacao/tipos/professores.test.ts` e `packages/core/src/rate-limit/school-semaphore.test.ts`: 44 de 44
  - `apps/api/test/architecture.test.ts` e `tools/guardas/camadas.test.ts`: 99 de 99
- **4:** a linha "Sem mutação" do documento se confirma: os três arquivos só repassam exports e não têm nenhuma condição. As mutações e os testes do código que veio com o merge são das tarefas 5.0 e 6.0, que já passaram pelo portão.

Bloqueantes: nenhum.

Recomendações:
- O portão da tarefa só roda os testes de integração que a árvore alterou em relação ao HEAD. Por isso `apps/api/test/professores.int.test.ts` e `apps/worker/test/gravar-planilha-professores.int.test.ts` não rodariam antes do commit, embora agora passem pelo guarda de limite e pelas vagas da 5.0. Rodei os dois uma vez nesta rodada e passaram. Vale o documento registrar que os encontros de linha devem rodar as suítes de integração do lado que não mudou e que agora passam pelo código do outro, para não deixar isso só para a esteira.
- As regras da 5.0 não dependem do tipo de planilha e passam a valer para `professores`: o limite por usuário, as 2 vagas por escola e o fechamento da importação parada, que apaga `linhas` e `marcas`. Nenhum teste as exercita com o tipo `professores`; as da 5.0 provam com outro tipo. Isso não bloqueia nesta correção. Fica como cobertura extra para a validação da spec: uma importação de professores parada na fila deve ter as `marcas.desligar` apagadas pelo expurgo.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-03 22:20:11 · `tasks/correcoes/encontro-6-onboarding.md`

VEREDITO: APROVADO
Caminho quente tocado: fila
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- A planilha de professores da 6.0 agora passa pelos limites que a 5.0 trouxe: o balde de 20 por minuto por usuário (`@ImportacaoRateLimit` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/api/src/estrutura/importacao/importacao.controller.ts:40` e `:48`), as 2 vagas por escola no Redis (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/rate-limit/school-semaphore.ts`) e o teto de 3.000 linhas no corpo, com o teto próprio de 300 linhas dentro do tipo. Isso está certo, mas nenhum teste de integração junta as duas coisas, por exemplo a terceira prévia de professores da mesma escola recusada com `LIMITE_EXCEDIDO`. O teste pode entrar na 16.0, junto com o cenário `importacao-7h30.js`, que já ficou de incluir o job de professores (registro do `infra-guardian` em `tasks/prd-onboarding-por-convite/6_task.md:901`).
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/worker/src/processors/gravar-planilha.ts:55`: o processor agora mede o passo (3) e passa `acharConta`/`travarContas` na mesma linha. Os 300 professores fazem o passo (3) durar mais, e o alerta `importacao-passo3-lento` (acima de 1 s) pode disparar com eles. Essa medida tem de ser conferida na 16.0, antes de o alerta ir para produção.

Conferências feitas:
- A árvore que o git junta sozinho, comparada com a que vai para o commit, só difere nos três arquivos de exports e no próprio documento da correção.
- Os exports resolvidos são a soma dos dois lados, sem nada tirado nem renomeado.
- Não sobrou marcador de conflito nesses três arquivos.
- `npm run typecheck` passou na raiz, no `e2e/`, na `infra/` e em todos os pacotes.
- Passaram os testes do semáforo, do alerta com runbook, dos contratos da importação e do leitor de professores: 54 de 54.
