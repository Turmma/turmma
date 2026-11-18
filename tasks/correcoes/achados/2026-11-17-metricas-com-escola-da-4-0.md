# Achados das revisões — `tasks/correcoes/2026-11-17-metricas-com-escola-da-4-0.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-17 23:30:59 · `tasks/correcoes/2026-11-17-metricas-com-escola-da-4-0.md`

VEREDITO: APROVADO

A correção só faz o teste de cardinalidade do Prometheus conhecer uma métrica que a tarefa 4.0 já tinha posto na lista fechada. Nenhum código de produção muda de comportamento.

Campos pessoais tocados: nenhum. A métrica `material.classificacao.espera` leva só o rótulo `escola_id`, que é o UUID da instituição, e a duração em segundos. Ela é gravada em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/ia/metricas-da-execucao.ts:32`, chamada por `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/classificar-secoes.command.ts:112`. Não leva usuário, aluno, material, seção, título nem código.

Fora da tabela de dados do docs/lgpd.md: nada. Não entra campo pessoal novo nem migration.

Autorização por objeto: não se aplica. A correção não cria rota nem query.

Logs: limpos. Não há log novo; só mudam um JSDoc em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/telemetry/metrics.ts:247` e a lista esperada do teste.

Auditoria: não se aplica. Nenhuma ação desta correção pede registro em auditoria.

Envio externo: nenhum. A métrica vai para a observabilidade da própria infra e não sai para provedor de IA.

Seed/fixture: não foi tocado.

Bloqueantes: nenhum. A parte do teste que protege a privacidade continua igual: nenhuma série pode ter rótulo de usuário, e `escola_id` só aparece nas métricas da lista fechada. A lista esperada em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/infra/test/metricas.int.test.ts:259-260` passa a conhecer a métrica nova, com a justificativa citada (Tech Spec §7c). Ela confere com `METRICS_WITH_ESCOLA` (`metrics.ts:265`) e com `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tools/testes/metricas.ts:115`. É certo não fazer teste de mutação, porque a correção muda só um comentário e o teste. Ele estava vermelho no HEAD (20 séries contra 17) e fica verde com a métrica na lista.

Recomendações:
- O comentário de `infra/test/metricas.int.test.ts:229-230`, que enumera a lista fechada, ainda deixa de fora as senhas provisórias, a espera estourada e a execução interrompida, que estão em `METRICS_WITH_ESCOLA`. Vale completar quando alguém voltar a esse arquivo; o teste não depende disso, porque monta a lista a partir do código.
- No JSDoc de `metrics.ts:247`, a enumeração continua sem vírgula entre os itens ("expurgo (F3, tarefa 3.0) as horas…"), o que dificulta a leitura.
- Pergunta de fechamento: esta correção não cria dado sobre aluno nem envio para fora do sistema, então a resposta à secretaria não muda. A métrica é agregada por escola e não identifica aluno.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-17 23:31:01 · `tasks/correcoes/2026-11-17-metricas-com-escola-da-4-0.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum. A correção mexe só na observabilidade: um comentário JSDoc e a lista esperada de um teste de infra.
Rate limit: ok. A correção não toca em limite.
Fila e prioridade: ok. Não muda fila; a classificação continua no lote, como a 4.0 deixou.
Concorrência: protegida. Não há escrita nova.
Índice e paginação: ok. Não há query nova.
Degradação de IA: não se aplica.
Migration: não se aplica.
Métrica e alerta: ok.
- `material.classificacao.espera` já estava em `METRICS_WITH_ESCOLA` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/telemetry/metrics.ts:265`). O nome dela no Prometheus está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tools/testes/metricas.ts:115`.
- A métrica é gravada só com `escola_id` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/ia/metricas-da-execucao.ts:32`). Isso dá uma série por escola e por faixa do histograma, para até dez escolas, e nenhum rótulo de usuário, aluno ou material.
- A lista esperada em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/infra/test/metricas.int.test.ts:259-260` passa a conhecer as três séries que faltavam, com a justificativa no comentário. O comportamento de produção não muda.
- Não rodei o teste: ele depende do compose e só roda na esteira. O verde vale quando o job `infra 2/3` passar.

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/telemetry/metrics.ts:247`: o JSDoc de `METRICS_WITH_ESCOLA` ainda não cita `esperaEstourada` nem `execucaoInterrompida` (reengenharia-continuacao, tarefa 7.0), e as duas estão na lista. A omissão é anterior a esta correção, mas a enumeração diz "Nenhuma outra pode levar escola" e não confere com a lista.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/infra/test/metricas.int.test.ts:229-230`: pelo mesmo motivo, o comentário que enumera as métricas da lista não cita as senhas provisórias nem as duas do Tutor da 7.0.
- Para retro: a falha da 4.0 só apareceu na esteira porque o teste de cardinalidade roda só no compose. Um teste unitário poderia comparar `METRICS_WITH_ESCOLA` com a lista explícita de nomes do Prometheus, sem precisar do compose, e pegaria isso no portão local da próxima métrica com escola.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-17 23:31:02 · `tasks/correcoes/2026-11-17-metricas-com-escola-da-4-0.md`

VEREDITO: APROVADO
Caminhos de escrita em Nota: nenhum nesta correção. O diff não toca `Nota`, correção nem lançamento. Autor humano: não se aplica.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. A correção não cria nem muda saída de IA que chegue ao aluno.
Supervisão do tutor: ok. A correção não toca o Tutor.
Autonomia declarada e visível: sim. A correção não muda agente, nível nem a tela de governança.
Bloqueantes: nenhum
Recomendações:
- Faltam duas coisas no JSDoc de `METRICS_WITH_ESCOLA`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/telemetry/metrics.ts:244-248`. A enumeração não cita as métricas da reengenharia-continuacao 7.0 (`esperaEstourada`, `execucaoInterrompida`), que a lista esperada do teste já admite. E, com vírgulas ausentes, ela ficou difícil de ler. Vale acertar na retro ou na próxima tarefa que mexer no arquivo. Não bloqueia: é só comentário.

O que conferi pela regra 70:
- **A métrica leva só a escola.** Ela é gravada em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/ia/metricas-da-execucao.ts:31-32`, com o único rótulo `escola_id`. Mede a espera de uma seção de material entre o envio e a classificação. Não leva aluno, professor, usuário nem material.
- **Professor (item 8, D45, D64).** A métrica não mede o professor: não há indicador por professor, ranking nem dado de adoção nominal. O material é da escola e entra pela coordenação (D75), então o agregado por escola não vira métrica de pessoa.
- **Supervisão sem vigilância (item 7).** A métrica não toca comportamento, navegação nem estado emocional de aluno.
- **Discursiva e redação (D55).** Não há campo, tela nem prompt com nota ou sugestão de nota.
- **O diff.** O teste `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/infra/test/metricas.int.test.ts:259-260` passa a admitir na lista fechada as três séries da métrica, e o resto é comentário. O teste que barra rótulo de usuário em qualquer série continua valendo. A métrica já estava em `METRICS_WITH_ESCOLA` desde a tarefa 4.0, e a correção só alinha o teste do compose a essa lista.
- **`docs/regulacao.md`.** Não foi alterado e não precisa ser.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-17 23:31:04 · `tasks/correcoes/2026-11-17-metricas-com-escola-da-4-0.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma. A correção não cria nem altera tabela, migration ou schema.

Queries verificadas: nenhuma nova, porque o diff não mexe em repository nem em endpoint. Também conferi de onde vem o `escola_id` da métrica que a lista passa a conhecer. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/classificar-secoes.command.ts:111`, o valor sai de `requireEscolaId()`, ou seja, do contexto autenticado do job, e não de parâmetro do cliente. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/ia/metricas-da-execucao.ts:32`, a métrica é gravada só com o rótulo `escola_id`, sem usuário, aluno, material ou seção.

Teste de isolamento: não se aplica, porque a correção não cria módulo, consulta nem endpoint. O que ela mexe é a guarda de rótulos em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/infra/test/metricas.int.test.ts`, que confere que o `escola_id` só aparece nas métricas da lista fechada. Essa guarda continua efetiva: a lista esperada é escrita à mão e comparada com `METRICS_WITH_ESCOLA`. Se alguém puser outra métrica com escola na lista fechada, o teste quebra, como quebrou agora com as 20 séries contra 17 esperadas. Se uma série com escola ficar fora da lista, o filtro `comEscola` também quebra. Não rodei o teste: ele usa o compose e só roda na esteira.

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/infra/test/metricas.int.test.ts:229`: o comentário que enumera a lista fechada ainda deixa de fora as senhas provisórias, a espera estourada e a execução interrompida. Melhor trocar a enumeração por uma remissão ao JSDoc de `METRICS_WITH_ESCOLA`, para não ficar desatualizada de novo.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/telemetry/metrics.ts:244-248`: o JSDoc também omite a espera estourada e a execução interrompida (reengenharia-continuacao, tarefa 7.0), que estão na lista.
- Processo: o portão local da tarefa 4.0 não alcançou o teste do compose. Fica para a retro registrar que a tarefa que acrescenta métrica com `escola_id` precisa atualizar também a lista esperada em `infra/test/metricas.int.test.ts`.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-17 23:31:04 · `tasks/correcoes/2026-11-17-metricas-com-escola-da-4-0.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

O que conferi:
- A correção faz o que o documento pede. A lista esperada em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/infra/test/metricas.int.test.ts:259-260` ganhou `...NOMES_NO_PROMETHEUS.esperaDaClassificacao`, com o comentário que cita a tarefa 4.0 e a Tech Spec §7c. Essa entrada traz as três séries (`_bucket`, `_count`, `_sum`, em `tools/testes/metricas.ts:115`), e com elas a lista passa de 17 para 20, o número que o teste encontrava.
- A decisão de manter `escola_id` segue a Tech Spec. A linha 190 da `techspec.md` da classificação diz "por escola, nunca por professor". A métrica já está em `METRICS_WITH_ESCOLA` (`packages/core/src/telemetry/metrics.ts:265`), e o painel `infra/grafana/paineis/fundacao.json:2629` depende do `sum by (le, escola_id)`. Nenhum rótulo novo de pessoa entrou.
- Em `metrics.ts`, a mudança fica no JSDoc. Nenhuma linha de código mudou.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/telemetry/metrics.ts:245-248`: o JSDoc de `METRICS_WITH_ESCOLA` continua sem citar `esperaEstourada` e `execucaoInterrompida`, que já estão na lista. A falta vem de antes desta correção. A frase também ficou longa e sem vírgulas entre os itens. Melhor trocar a enumeração por algo que não envelheça, como "ver a lista abaixo; cada uma justificada no teste de cardinalidade", em vez de acrescentar um item a cada tarefa.
- A causa registrada, de que o teste do compose só roda na esteira e o portão da tarefa não o alcança, vai acontecer de novo a cada métrica nova com escola. Vale levar à retro um teste de unidade que compare `METRICS_WITH_ESCOLA` com a lista esperada do `metricas.int.test.ts`, ou que monte essa lista a partir de `METRICS_WITH_ESCOLA`.

## test-engineer · 1ª rodada · APROVADO · 2026-11-17 23:31:17 · `tasks/correcoes/2026-11-17-metricas-com-escola-da-4-0.md`

VEREDITO: APROVADO

Cenários exigidos:
- Caminho feliz: a lista fechada de métricas que podem levar `escola_id` reconhece a métrica nova da 4.0 (`material.classificacao.espera`), e o teste de cardinalidade da observabilidade volta a verde.
- Permissão: nenhuma série tem rótulo de usuário. Uma métrica que leva `escola_id` sem estar na lista fechada deixa o teste vermelho.
- Isolamento e cardinalidade: a métrica nova leva só `escola_id`. Não leva usuário, aluno, material, seção nem código.
- Reprodução: o teste fica vermelho no HEAD (20 séries contra 17 esperadas) e verde com a correção.

Cobertos:
- `infra/test/metricas.int.test.ts:219`, no caso "permissão: nenhuma série tem rótulo de usuário…". A lista explícita das linhas 234 a 262 ganhou `...NOMES_NO_PROMETHEUS.esperaDaClassificacao`, com a justificativa da Tech Spec §7c. Essa chave existe em `tools/testes/metricas.ts:115`, com os três nomes que o Prometheus dá ao histograma.
- O teste falharia se a regra mudasse, por dois caminhos:
  - Se `METRICS.esperaDaClassificacao` sair de `METRICS_WITH_ESCOLA`, a lista que o teste monta a partir dela cai para 17 séries e a linha 234 fica vermelha. A linha 263 também fica, se a métrica for emitida com escola.
  - Se alguém puser outra métrica na lista fechada sem justificar no teste, a linha 234 fica vermelha. A asserção prova a lista fechada; não apenas confirma que o código rodou.
- Mutações: `**Sem mutação:**` traz o motivo. O `git diff` de `packages/core/src/telemetry/metrics.ts` confirma que só mudou o JSDoc de `METRICS_WITH_ESCOLA`, sem cláusula nova de código. O RF17 está atendido.
- Sem `.skip`, sem teste comentado, sem mock e sem provedor de IA.
- Concorrência não se aplica: a correção não toca operação que possa acontecer duas vezes ao mesmo tempo.
- Não rodei o teste. Ele depende do compose de observabilidade, que só sobe na esteira, então o verde fica para a esteira confirmar.

Bloqueantes: nenhum.

Recomendações:
1. O cenário do compose não roda a classificação. Por isso a métrica nova não aparece no Prometheus desse teste, e a linha 263 não a observa de fato. A garantia de que ela leva só `escola_id` está em `packages/core/src/telemetry/metrics.test.ts:155` e no `classificacao.int.test.ts:1163` que o documento cita. Para a validação: se o cenário de infra passar a disparar um job de classificação, o teste veria a série real com `escola_id` e sem outro rótulo pessoal.
2. Na enumeração do JSDoc de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/telemetry/metrics.ts:247` faltam vírgulas entre os itens ("expurgo (F3, tarefa 3.0) as horas…", "(F2, tarefa 5.0) as senhas…"). O defeito já existia antes e a correção o repete. É só texto.
3. Para a retro: a causa é a de sempre. O teste de infra só roda na esteira e o portão da 4.0 não o alcançou. Vale ter um teste de unidade que compare `METRICS_WITH_ESCOLA` com a lista explícita do teste de infra, para pegar o esquecimento antes do commit.

Arquivos:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/infra/test/metricas.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/telemetry/metrics.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/correcoes/2026-11-17-metricas-com-escola-da-4-0.md`

## revisor-geral · 2ª rodada · APROVADO · 2026-11-17 23:40:51 · `tasks/correcoes/2026-11-17-metricas-com-escola-da-4-0.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

As duas recomendações da 1ª rodada foram aplicadas. Conferi na árvore:
- **JSDoc de `METRICS_WITH_ESCOLA`** (`packages/core/src/telemetry/metrics.ts:244-249`): não enumera mais as métricas. Agora aponta para a lista e para os dois testes que a guardam, então não tem como ficar desatualizado de novo.
- **Comentário do teste de infra** (`infra/test/metricas.int.test.ts:229-230`): também não enumera mais as métricas. Cada uma continua justificada logo abaixo, na lista esperada, inclusive `esperaDaClassificacao` com a tarefa 4.0.
- **Seção "Recomendações sem aplicar" e a linha nova do `TODO.md`**: as duas trazem destino e dono, e explicam por que ficaram fora (teste novo e mudança no cenário do compose saem do escopo de uma correção de lista).

Recomendações:
- O JSDoc novo (`packages/core/src/telemetry/metrics.ts:246-247`) diz que cada métrica está justificada, com a tarefa que a criou, também em `metrics.test.ts`. Mas o título do teste em `packages/core/src/telemetry/metrics.test.ts:135` enumera as métricas e deixa de fora a espera da classificação (classificacao-bncc, tarefa 4.0). A lista esperada logo abaixo inclui essa métrica, então o teste está certo e o problema é só o título. Ou o título passa a citar a 4.0, ou o JSDoc fala só do teste de infra. O mais limpo é trocar o título por um texto curto, sem lista, como foi feito no JSDoc. O defeito veio da 4.0, não desta correção, mas o JSDoc novo passou a apontar para lá.
