# Achados das revisões — `tasks/correcoes/2026-11-03-metrica-escola-id-fora-da-lista.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-04 00:08:47 · `tasks/correcoes/2026-11-03-metrica-escola-id-fora-da-lista.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum (só um teste de infra: a enumeração esperada da lista fechada de métricas com `escola_id`)
Rate limit: ok (não foi tocado)
Fila e prioridade: ok (não foi tocado)
Concorrência: protegida (não há escrita nova)
Índice e paginação: ok (não há query nova)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok. `importacao_minutos_na_fila` aparece igual nos quatro lugares onde precisa estar: `METRICS_WITH_ESCOLA` e o teste dela no core (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/telemetry/metrics.ts:166,188`, `metrics.test.ts:151`), o mapa de nomes do Prometheus (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/tools/testes/metricas.ts:98`) e agora a enumeração escrita à mão (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/infra/test/metricas.int.test.ts:252-253`). A série traz só a escola e um número de minutos, sem id de importação, sem autor e sem linha da planilha (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/worker/src/importacao-gauge.ts:39-42`). Ela só existe enquanto a escola tem importação na fila, então a cardinalidade fica limitada a no máximo uma série por escola. O alerta `infra/grafana/alertas/importacao-parada.yaml` tem a seção correspondente no runbook (`docs/runbook.md:703`).
Bloqueantes: nenhum
Recomendações:
- Não rodei a suíte de infra, que precisa do Prometheus de pé. O "verde" vem do que a tarefa relata: `npx vitest run --project infra infra/test/metricas.int.test.ts`, 6 de 6. A esteira que vem depois do pouso é a que confirma.
- O título do caso de teste em `infra/test/metricas.int.test.ts:219` cresce a cada métrica que entra na lista. Vale encurtar para "`escola_id` só nas métricas de `METRICS_WITH_ESCOLA`" e deixar a lista nominal só no comentário, para a próxima entrada não precisar editar o título de novo.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-04 00:08:49 · `tasks/correcoes/2026-11-03-metrica-escola-id-fora-da-lista.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. A métrica `importacao.minutos_na_fila` fica com `escola_id`, como a Tech Spec do onboarding define na seção 7c. A correção mantém essa decisão e só acerta o teste que estava desatualizado. A lista fechada em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/telemetry/metrics.ts` (linha 188), o nome no Prometheus em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/tools/testes/metricas.ts` (linha 98), o alerta em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/infra/grafana/alertas/importacao-parada.yaml` e a seção dele no `docs/runbook.md` (linha 703) usam o mesmo nome e o mesmo rótulo. Nada diverge. A série que o worker publica (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/worker/src/importacao-gauge.ts`) leva só a escola e o número de minutos, sem id de importação nem autor. A justificativa de privacidade do documento confere com o código.

Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)

Bloqueantes: nenhum

Recomendações:
- O comentário e o título do caso em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/infra/test/metricas.int.test.ts` (linhas 219 e 229–230) listam à mão as métricas da lista fechada. Essa é a mesma lista duplicada que causou a falha. Vale avaliar, em outra tarefa, montar a lista esperada só a partir de `METRICS_WITH_ESCOLA` e `NOMES_NO_PROMETHEUS`, ou deixar no título só "as métricas da lista fechada". Assim a próxima métrica com escola não volta a quebrar só na esteira.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-04 00:08:52 · `tasks/correcoes/2026-11-03-metrica-escola-id-fora-da-lista.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A mudança fica só num teste. A métrica `importacao.minutos_na_fila` leva `escola_id` e um número de minutos. Não leva id de importação, autor, nome nem linha da planilha (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/worker/src/importacao-gauge.ts:14-21` e `:38-41`).

Fora da tabela de dados do docs/lgpd.md: nada. Não há dado pessoal novo: `escola_id` identifica o controlador, não um titular.

Autorização por objeto: ok. Esta correção não cria rota nem consulta. O gauge lê pelo `ImportacaoRepository`, com o escopo do contexto da `EscolaGauge`.

Logs: limpos. O evento `worker.medicao_da_importacao_indisponivel` não carrega conteúdo.

Auditoria: presente onde a regra exige. A correção não toca nenhuma ação auditável.

Envio externo: nenhum. A métrica fica no Prometheus e no Grafana da nossa infra, e não passa por provedor de IA.

Seed/fixture: sintético. A correção não toca seed nem fixture.

Bloqueantes: nenhum.

O que conferi:
- A métrica já estava na lista fechada do core (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/telemetry/metrics.ts:176-189`), e o nome no Prometheus já estava em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/tools/testes/metricas.ts:98`. A correção só alinha a segunda cópia da lista, a de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/infra/test/metricas.int.test.ts:251-253`.
- O teste continua exigindo três coisas: nenhum rótulo com `usuario` ou `user`, nenhuma série com `usuario_id`, e `escola_id` só nas métricas admitidas. A garantia de privacidade fica intacta: a lista fechada ganhou um nome justificado e não ficou mais frouxa.
- O `escola_id` é necessário. O alerta `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/infra/grafana/alertas/importacao-parada.yaml:41` agrupa `max by (escola_id)`, e o `docs/runbook.md:703` descreve a métrica do mesmo jeito. Sem o rótulo, o alerta não diria qual escola tem a importação parada.

Recomendações:
- Hoje existem duas cópias da lista fechada: `METRICS_WITH_ESCOLA` no core e a enumeração escrita à mão no teste de infra. Cada métrica nova com escola precisa entrar nas duas. Vale um comentário em `metrics.ts`, junto da lista, avisando que a enumeração de `infra/test/metricas.int.test.ts` precisa mudar junto. Isso evita repetir esta falha da esteira. A duplicação em si é desejável, porque é ela que obriga uma pessoa a olhar quando entra um rótulo novo.

## test-engineer · 1ª rodada · APROVADO · 2026-11-04 00:10:51 · `tasks/correcoes/2026-11-03-metrica-escola-id-fora-da-lista.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- Caminho feliz: a métrica `importacao_minutos_na_fila` passa a constar na lista fechada de métricas que levam `escola_id`, e o teste de permissão da infra fica verde.
- Regressão: o teste fica vermelho se alguém incluir uma métrica nova em `METRICS_WITH_ESCOLA` sem atualizar a lista escrita à mão. Foi o vermelho que a esteira pegou, e essa proteção continua de pé.
- Permissão: nenhuma série tem rótulo de usuário, e o id de usuário não aparece em rótulo algum.
- Isolamento: só as métricas admitidas aparecem com `escola_id` no Prometheus.

**Cobertos:**
- O caminho feliz está em `infra/test/metricas.int.test.ts:219-257`. Rodei `npx vitest run --project infra infra/test/metricas.int.test.ts` e deu 6 de 6 verdes, em 104 s.
- A regressão está coberta. Se a linha nova (`metricas.int.test.ts:253`) sair, a comparação das linhas 234-255 volta a dar 14 contra 13, que é o vermelho registrado na esteira (run 41753649636).
- O resto da lista bate com o código:
  - `METRICS_WITH_ESCOLA` (`packages/core/src/telemetry/metrics.ts:176-189`) tem `minutosDaImportacaoNaFila`.
  - `tools/testes/metricas.ts:98` traduz esse nome para `importacao_minutos_na_fila`.
  - O teste de lista fechada do core (`packages/core/src/telemetry/metrics.test.ts:151`) já incluía o nome.
- Permissão e isolamento ficaram como estavam. As asserções das linhas 221-225 (rótulo e id de usuário) e da linha 256 (nenhuma série com `escola_id` fora da lista) não foram tocadas.
- A seção "Mutações" está correta ao dizer que não há bloco. O diff mexe só em arquivo de teste: nada em `apps/*/src` nem em `packages/*/src`, então nenhuma cláusula de produção nova fica sem bloco (RF17 não se aplica). Não há `.skip`, teste comentado, mock nem provedor de IA. Nenhuma operação concorrente está em jogo.

**Bloqueantes:** nenhum.

**Recomendações:**
1. Nenhum caso da infra mostra a métrica de verdade no Prometheus com `escola_id`. O cenário não roda o gauge (`apps/worker/src/importacao-gauge.ts`), então a linha 256 só confere que a métrica não vaza. Não confere que ela chega lá com a escola, e é disso que o alerta `infra/grafana/alertas/importacao-parada.yaml` precisa. Um caso que deixe uma importação parada em `na_fila` e veja a série com o `escola_id` certo fecharia essa lacuna. É cobertura extra, fora desta correção.
2. A lista da linha 234 é uma segunda cópia de `METRICS_WITH_ESCOLA` mantida à mão, e uma tarefa que criar métrica nova vai esquecê-la de novo. Ela tem utilidade: obriga a revisar a cardinalidade no Prometheus. Para a próxima métrica não depender da esteira, vale uma linha no checklist da Tech Spec ou no `docs/guia-do-desenvolvedor.md`: "métrica nova com escola: atualizar `METRICS_WITH_ESCOLA`, o `metrics.test.ts` e o `infra/test/metricas.int.test.ts`".

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/tasks/correcoes/2026-11-03-metrica-escola-id-fora-da-lista.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/infra/test/metricas.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/packages/core/src/telemetry/metrics.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/tools/testes/metricas.ts

## test-engineer · 2ª rodada · APROVADO · 2026-11-04 00:19:11 · `tasks/correcoes/2026-11-03-metrica-escola-id-fora-da-lista.md`

VEREDITO: APROVADO

**Cenários exigidos.** A correção só acrescenta `minutosDaImportacaoNaFila` à lista fechada que o teste de infraestrutura espera. Por isso só há um cenário a provar: `escola_id` aparece apenas nas métricas dessa lista, agora com a dos minutos da importação na fila, e nenhuma série tem rótulo de usuário. Isso é o mesmo que eu exigi na 1ª rodada.

**Cobertos.** Nesta rodada mudou só o título do caso em `infra/test/metricas.int.test.ts:219`. Ele ficou mais curto, como recomendei na 1ª rodada, e agora termina em "… e `escola_id` só aparece nas métricas da lista fechada". As asserções não mudaram. As três que tratam de usuário continuam lá: nenhum rótulo `usuario|user`, nenhuma série com `{usuario_id!=""}` e nenhum id de usuário em rótulo algum. A comparação de `comEscola` com o conjunto `admitidas` também continua, e esse conjunto já inclui `...NOMES_NO_PROMETHEUS.minutosDaImportacaoNaFila` (linhas 252 e 253). A lista das métricas ficou só no comentário (linhas 229 e 230), que já cita a importação de planilha na fila. Procurei o título antigo em `docs/`, `tasks/` e `tools/` e nenhum arquivo o cita pelo nome, então encurtar o título não quebra nenhuma referência.

**Documento.** A seção "Correção" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/tasks/correcoes/2026-11-03-metrica-escola-id-fora-da-lista.md` agora descreve bem o que mudou. A nova seção "Recomendações sem aplicar" lista as minhas duas recomendações da 1ª rodada, cada uma com destino (`TODO.md`) e motivo. A seção "Mutações" sem bloco está certa: a correção não acrescenta cláusula de código de produto, só um nome à lista esperada do teste.

**Execução.** Não rodei o teste. Ele precisa da infraestrutura local de observabilidade no ar, com o Prometheus, e trocar o texto do título não muda o que ele verifica.

Bloqueantes: nenhum

Recomendações: nenhuma nova. As duas da 1ª rodada estão registradas com destino no documento: um caso que veja a série `importacao_minutos_na_fila` com o `escola_id` certo, e um aviso de que cada métrica nova com escola muda três arquivos.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-04 00:19:14 · `tasks/correcoes/2026-11-03-metrica-escola-id-fora-da-lista.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido
Bloqueantes: nenhum

Esta rodada só olhou o diff novo. A correção que eu tinha pedido foi feita: o título do caso em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/infra/test/metricas.int.test.ts:219` não lista mais as métricas. A lista ficou só no comentário das linhas 229 e 230, que já cita a métrica da importação na fila. A seção "Correção" do documento agora descreve exatamente essa mudança. O que o teste confere não mudou: a lista esperada ainda ganha `NOMES_NO_PROMETHEUS.minutosDaImportacaoNaFila`, nas linhas 252 e 253.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/tasks/correcoes/2026-11-03-metrica-escola-id-fora-da-lista.md`, seção "Recomendações sem aplicar": as duas linhas mandam a recomendação para o `TODO.md`, mas o `TODO.md` não foi alterado e não cita nenhuma delas. Se o registro ali cabe a esta correção, ele precisa entrar antes do commit. Se cabe à validação ou ao pouso, o destino deve dizer "a registrar no `TODO.md` na validação", para não parecer que já foi feito.
