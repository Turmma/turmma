# Achados das revisões — `tasks/correcoes/2026-11-06-restos-da-carga-da-16.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-06 06:00:32 · `tasks/correcoes/2026-11-06-restos-da-carga-da-16.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. É uma correção que só renomeia, sem mudar comportamento, e não toca a arquitetura.
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/TODO.md:154` ainda cita `chamarApi`. É o da web (13.0), não o de `carga-sala.ts`, então está certo. Registro só para ninguém confundir os dois numa troca futura.
- Os três blocos de mutação citam o teste como `tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados` e deixam de fora o `describe` "restos na árvore". O documento usa o caminho inteiro na seção "Sintoma". Se a ferramenta de mutação casa pelo nome completo, é melhor alinhar. Quem confere é o `test-engineer`.

Conferências que fiz:
- O diff em `infra/` só renomeia. `chamarApi` virou `callApi`: a declaração e 3 usos em `carga-sala.ts`, mais o import e 4 usos em `carga-importacao.ts`. `SessaoSintetica` virou `LoadSession`: a declaração e 2 usos. `semComentarios` virou `stripComments`: a declaração e 2 usos no teste. Nenhuma lógica mudou.
- Nenhum `chamarApi`, `SessaoSintetica` ou `semComentarios` sobrou em `infra/`. Os que existem em `apps/` são de outros arquivos e não entram nesta correção.
- Nenhum dos nomes novos aparece como `de` nos mapas de `tools/renomear/mapas/`. `stripComments` aparece só como `para`, no mapa 10, o que é coerente com a direção da X8.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-06 06:00:32 · `tasks/correcoes/2026-11-06-restos-da-carga-da-16.md`

VEREDITO: APROVADO

A correção só renomeia três símbolos. Nenhum dado, campo, rota, log ou envio mudou de comportamento. Conferi com `git diff -- infra/`: são 15 linhas trocadas por 15, e cada linha só troca um nome.

Campos pessoais tocados: nenhum. As trocas são `chamarApi` por `callApi` (export de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/infra/scripts/carga-sala.ts` e seus usos em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/infra/scripts/carga-importacao.ts`), `SessaoSintetica` por `LoadSession` (interface local, com os mesmos campos `usuarioId` e `token`) e `semComentarios` por `stripComments` (ajudante de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/infra/test/carga-importacao.test.ts`).
Fora da tabela de dados do docs/lgpd.md: nada. A correção não cria campo novo.
Autorização por objeto: não se aplica. Nenhuma rota foi criada ou alterada; os scripts de carga chamam as mesmas rotas, com os mesmos tokens de sessões sintéticas.
Logs: limpos. A correção não adiciona nem muda nenhum log.
Auditoria: não se aplica. Nenhuma ação que a exige foi tocada.
Envio externo: nenhum. A checagem que proíbe provedor externo (openai, anthropic, gemini, maritaca, oidc) no k6 e em `carga-importacao.ts` continua com a mesma expressão; só o nome do ajudante mudou.
Seed/fixture: sintético. As sessões continuam vindo de `createSyntheticSessions`, e as matrículas e nomes da carga são gerados como antes.
Bloqueantes: nenhum.
Recomendações:
- Nenhum outro arquivo importa `chamarApi`; a busca na árvore não acha resto em `infra/`. O `semComentarios` que sobra em `tools/processo/caducidade.ts` e `tools/ci/duracao-do-e2e.test.ts` é outro símbolo, local a esses arquivos e fora desta correção. Se ele também for um nome que os mapas trocam, cabe ao `restos.test.ts` acusar, não a esta auditoria.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-06 06:00:41 · `tasks/correcoes/2026-11-06-restos-da-carga-da-16.md`

VEREDITO: APROVADO

Caminho quente tocado: nenhum

Rate limit: ok

Fila e prioridade: ok

Concorrência: protegida

Índice e paginação: ok

Degradação de IA: não se aplica

Migration: não se aplica

Métrica e alerta: ok

Bloqueantes: nenhum

Recomendações:
- A correção só troca nomes: `chamarApi` vira `callApi` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/infra/scripts/carga-sala.ts` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/infra/scripts/carga-importacao.ts`, `SessaoSintetica` vira `LoadSession`, e `semComentarios` vira `stripComments` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/infra/test/carga-importacao.test.ts`. O comportamento dos cenários de carga não muda. O rodízio de sessões da coordenação continua igual, com cada sessão abaixo do limite por usuário, e a espera pelo `Retry-After` no 429 também. Nenhum outro arquivo importa o export antigo de `carga-sala.ts`.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/api/client.test.ts:81` ainda tem `describe('chamarApi', ...)`. É texto de `describe`, fora desta correção, e o `restos` hoje não o aponta. Vale conferir na retro da X8 se o mapa 10 deveria pegar esse caso.

## test-engineer · 1ª rodada · APROVADO · 2026-11-06 06:01:37 · `tasks/correcoes/2026-11-06-restos-da-carga-da-16.md`

VEREDITO: APROVADO

**Cenários exigidos.** Esta correção só troca três nomes antigos da 16.0, e nenhum comportamento muda. Por isso não há regra escolar nova a provar: não cabe pedir caminho feliz, casos de borda do domínio, permissão, isolamento nem concorrência. O que precisa ser provado:
1. O teste dos restos acusa cada nome antigo de volta num uso.
2. Os testes de carga que já existiam continuam passando depois da troca.
3. Nenhum nome novo aparece como nome a ser trocado (`de`) em mapa algum.

**Cobertos.**
- **Item 1:** os três blocos de mutação, um por nome. O primeiro devolve `chamarApi` no import de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/infra/scripts/carga-importacao.ts`. O segundo devolve `SessaoSintetica` no uso em `coordenacoes`. O terceiro devolve `semComentarios` no uso em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/infra/test/carga-importacao.test.ts`. O teste é texto puro, e o vermelho vem do `toEqual([])`, que é o motivo certo, não de erro de carga. A `--faltando` dá 0 linhas e bate com o `git diff -- infra/`.
- **Falta de bloco para o `callApi` em `carga-sala.ts`:** o documento justifica, e a justificativa está certa. O mapa 10 classifica o `chamarApi` desse arquivo como `fica` (`tools/renomear/mapas/10.json:2437-2440`), então o teste dos restos não o acusaria ali.
- **Item 2:** rodei `npx vitest run tools/renomear/restos.test.ts -t "a árvore não tem resto dos mapas aplicados"`, que passou (1 passou, 42 ignorados). Rodei também `npx vitest run infra/test/carga-importacao.test.ts infra/test/carga-sala.test.ts`, com 55 de 55 passando.
- **Item 3:** procurei nos mapas de `tools/renomear/mapas/`. `callApi` e `LoadSession` não aparecem como `de`. `stripComments` só aparece como `para`, no mapa 10, linha 1019. Os nomes antigos não sobram em `infra/`. O `chamarApi` em `TODO.md:154` e em `apps/web` é o da web, outro símbolo.
- **Teste afrouxado:** nenhum. Não há `.skip`, teste comentado, mock nem asserção enfraquecida. A asserção que barra provedor externo no k6 e em `carga-importacao.ts` manteve a mesma expressão; só o nome do ajudante mudou.

**Bloqueantes:** nenhum.

**Recomendações:**
- Com esta correção, a entrada `fica` de `infra/scripts/carga-sala.ts › chamarApi` no mapa 10 (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/tools/renomear/mapas/10.json:2437`) deixa de ter o que liberar. O documento acerta em não editar o mapa aqui. Ainda assim, o teste dos restos poderia acusar entrada `fica` que não casa com nada na árvore, para que uma liberação parada não esconda um resto no futuro. Isso fica para a retro, não para esta correção.
