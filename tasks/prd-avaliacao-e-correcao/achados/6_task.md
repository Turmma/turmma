# Achados das revisões — `tasks/prd-avaliacao-e-correcao/6_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-27 08:39:32 · `tasks/prd-avaliacao-e-correcao/6_task.md`

VEREDITO: APROVADO

Tabelas verificadas: a tarefa não cria tabela nova. A migration `packages/core/drizzle/0069_auditoria_da_rotina_da_prova.sql` só acrescenta `atividade.encerrada_pelo_limite` ao check `auditoria_rotina_so_nas_acoes`, e o espelho em `packages/core/src/db/schema/auditoria.ts` está igual. As consultas tocam `atividade_aplicada`, `tentativa_atividade`, `extensao_de_tempo`, `resposta_atividade`, `entrega`, `correcao` e `ano_letivo`, que já tinham `escola_id` e `ano_letivo_id`, e as consultas novas usam os dois. `pulso_da_api` e `indisponibilidade` são fatos globais da API, sem dono.

Queries verificadas:
- `packages/core/src/atividade/encerramento.repository.ts`: `lockDaRotina`, `encerrar`, `tentativasEmAndamento`, `extensoes` e `registrarVencidas` filtram por `requireEscolaId()` e `requireAnoEmCurso()` em toda consulta. Nenhum método recebe escola ou ano por argumento.
- `packages/core/src/atividade/provas-vencidas.repository.ts`:
  - `anoEmCursoDaEscola`, `vencidasDaEscola` e `abertasComJanelaVencidaHa` têm o escopo do contexto.
  - `escolasComProvaVencida` é `@Unscoped`, com justificativa escrita, e devolve só ids de escola.
- `packages/core/src/atividade/correcao-de-objetiva.repository.ts`: as quatro consultas vieram de `CorrecaoRepository` sem mudança e continuam com o escopo do contexto.
- `packages/core/src/atividade/quedas-da-api.repository.ts` e `packages/core/src/ia/suspensao.repository.ts`: só mudaram de lugar. A primeira mantém o `@Unscoped` com a justificativa, a segunda o `requireEscolaId()`.
- `apps/worker/src/processors/encerrar-provas-vencidas.ts`:
  - O payload dos dois jobs é `semDados`. A escola vem da linha do outbox, e o ano de `anoEmCursoDaEscola`.
  - A rotina grava o job de cada escola dentro de `runInContext` com o id que a consulta do banco devolveu, nunca com valor vindo de fora.
- `apps/worker/src/prova-aberta-gauge.ts`: mede no contexto de cada escola e manda só a escola e um número, sem id de prova, turma ou aluno.
- O encerramento da professora em `atividade-aplicada.service.ts` continua passando antes pelo `lock` no alcance dela, e só então chama `encerrarProva`. A resposta para o que não está ao alcance continua `NAO_ENCONTRADO`.
- A auditoria `atividade.encerrada_pelo_limite` pega a escola do contexto do job. O `depois` é estrito, com `turmaId` e a contagem `vencidas`, e não registra aluno.
- A tarefa não cria nem muda endpoint, então nenhum aceita `escolaId` do cliente. Todo id continua UUID. Nada passa pela camada de rede.
- Há dois `@Unscoped` em `packages/core/src/atividade` (`escolasComProvaVencida` e `leituraDesde`), ambos com justificativa. O limite da regra é três.

Teste de isolamento: presente e efetivo, em `apps/worker/test/encerrar-provas.int.test.ts`.
- O bloco "os repositórios da rotina só alcançam a escola e o ano do contexto" testa combinações cruzadas:
  - A escola de A com o ano de B sobre a prova de B: se a cláusula de `escolaId` sair, o teste quebra.
  - A escola de A com um ano aleatório sobre a prova de A: se a cláusula de `anoLetivoId` sair, o teste quebra.
- Isso vale para a trava, as tentativas, as extensões, `encerrar` e `registrarVencidas`. O teste confere o estado no banco depois, e as mutações declaradas cobrem cada cláusula.
- O caso do job de A deixa a prova de B aberta, sem lote nem auditoria, e mostra que um payload com o id de B é recusado.
- `atividade-isolamento.int.test.ts` continua cobrindo as consultas que foram para `CorrecaoDeObjetivaRepository`.

Bloqueantes: nenhum.

Recomendações:
- `packages/core/src/atividade/correcao-de-objetiva.repository.ts:92`: o join de `entrega` em `historicoAprovado` amarra só `escolaId`, sem `anoLetivoId`. Já era assim antes desta tarefa e não vaza, porque `correcao` já é filtrada pelo ano. Amarrar o ano no join deixa o join no mesmo padrão dos outros.
- `escolasComProvaVencida` lê tudo sem escopo, pela própria natureza. Falta um caso que prove que ela nunca devolve nada além do id da escola, por exemplo uma asserção sobre o formato de cada item.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-27 08:39:56 · `tasks/prd-avaliacao-e-correcao/6_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. Esta tarefa não grava `Nota`, e as tabelas `nota` e `boletim` nem existem (`apps/api/src/atividade/correcao/correcao.int.test.ts:249` confere isso). O caminho novo, a rotina `sistema.encerrar-provas-vencidas` com o job `atividade.encerrar-vencidas`, só grava quatro coisas: o encerramento, `enviada_em` e `envio = 'limite'` nas tentativas vencidas, uma auditoria e o lote em `entrega`. Todos com autor humano? Sim, nenhuma nota nasce sem a professora.
- O lote nasce `pendente`. `createLote` não passa estado (`packages/core/src/atividade/correcao-de-objetiva.repository.ts:120-122`), e o banco garante isso: o default é `pendente` e o check exige `pendente ⇔ decidida_por is null` (`packages/core/src/db/schema/entrega.ts:56,102`). O teste é `apps/worker/test/encerrar-provas.int.test.ts:182`.
- A migration 0069 abre o check `auditoria_rotina_so_nas_acoes` para uma única ação nova, `atividade.encerrada_pelo_limite`. A rotina continua sem poder assinar `lote.aprovado`, rejeitar ou validar; o teste é `packages/core/src/auditoria/auditoria.int.test.ts:257-262`.

Decisão autônoma sobre aluno: ausente. A rotina só encerra no fim do tempo que a professora definiu (`fecha_em` mais as extensões e o limite de cada aluno), e não encerra se a API estiver parada. Ela não aprova, não reprova, não encaminha e não lê a contagem de saída da aba. A AIA 1.4/1 e 1.4/9 dizem o mesmo (`docs/aia/correcao-de-objetiva.md:67,83`).

Aprovação registrada: ok. O fluxo de aprovação do lote (`CorrecaoService`, com a marca do que foi apresentado, D56) não mudou; só a leitura das respostas passou a usar o repository do `core`. A rotina só cria lote pendente. Com a função suspensa, a prova encerra sem lote (`encerramento.ts:110`, com teste). A exceção D47 não aparece fora do tutor.

Supervisão do tutor: não se aplica, a tarefa não mexe no tutor.

Autonomia declarada e visível: sim. `correcao_de_objetiva` continua no nível 2, com o texto em português comum em `packages/shared/src/time/funcoes.ts:43-50`. O gatilho pela rotina não é decisão de IA.

Auditoria "o que a IA gerou, quem aprovou, quando": responde. A nova `atividade.encerrada_pelo_limite` sai uma por aplicação, sem aluno: guarda só a turma e quantas tentativas venceram, com `strictObject` que recusa `alunoId` e percentual (`packages/core/src/auditoria/acoes.ts:809-819`, testado em `acoes.test.ts:153`). O lote continua com a sua aprovação auditada (`lote.aprovado`).

Supervisão não é vigilância: ok. O alerta e o gauge da prova aberta mandam só `escola_id`. A rotina não toca em navegação nem em tempo ocioso.

D46/D55 (discursiva e redação): não se aplica. É só objetiva, e o repository diz que nenhuma coluna guarda nota ou conceito.

D45 (medir o professor): não se aplica, a tarefa não cria indicador de professor.

Bloqueantes: nenhum.

Recomendações:
1. **Mostrar ao professor a tentativa enviada pelo limite.** A própria tarefa já encaminha isto ao Orquestrador (`6_task.md`, item 12 da autoconferência). O lote poderia mostrar quais tentativas foram enviadas pelo limite, e o registro da validação (D56) guardaria isso. A validação fica mais completa porque o professor vê que aquela prova não foi entregue pelo aluno. Precisa de dono e destino definidos antes da validação da spec.
2. **Citar a rotina no `fazSozinha`.** O texto de `correcao_de_objetiva` em `packages/shared/src/time/funcoes.ts:48` poderia dizer que, na prova online, a correção também começa quando a prova vence. Assim a coordenação responde "quando isso roda sozinho?" pela tela. Hoje o texto não está errado, só não fala do gatilho.
3. **Comentário com contagem desatualizada.** Em `packages/core/src/db/schema/auditoria.ts:71-74`, o comentário ainda fala em "as seis ações", mas a lista do check agora tem sete. O título do `describe` em `auditoria.int.test.ts:230` também perdeu uma vírgula ("(8.0) na herança"). É só texto.

Não rodei os testes de integração. O veredito vem da leitura do código, dos casos citados na tarefa e dos checks do banco. A 6.5 (a carga registrada com a máquina calma e o controle negativo) segue aberta, mas não é assunto da regra 70; fica com o `infra-guardian`.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-27 08:40:25 · `tasks/prd-avaliacao-e-correcao/6_task.md`

VEREDITO: APROVADO

A tarefa 6.0 não cria campo de pessoa, rota, DTO de saída nem envio externo. O que ela traz de novo é a rotina do worker que encerra a prova vencida, o miolo do encerramento movido para `packages/core/src/atividade/`, uma auditoria sem aluno, uma métrica por escola, dois alertas e a carga sintética. O resto do diff no `apps/api` só muda `import` e move código.

Campos pessoais tocados: `tentativa_atividade.enviada_em` e `tentativa_atividade.envio`, agora gravados também pela rotina, com o valor `'limite'` e o limite de cada tentativa. As duas colunas já existiam. A tarefa não cria coluna nova.

Fora da tabela de dados do docs/lgpd.md: nada. A linha 59 de `docs/lgpd.md` já cobre "como foi enviada (pelo aluno, pelo limite, pelo encerramento)" e a linha 48 cobre `tentativa_atividade`. O arquivo do titular (`packages/core/src/titular/leitura-do-titular.ts:313`) já lê `enviada_em` e `envio`. A nova ação `atividade.encerrada_pelo_limite` (`packages/core/src/auditoria/acoes.ts:809-819`) guarda só `turmaId` e a contagem de vencidas, sem aluno, com `strictObject`.

Autorização por objeto: ok.
- O job `atividade.encerrar-vencidas` vem com o payload vazio (`semDados`). Ele tira a escola do contexto do outbox e o ano de `anoEmCursoDaEscola`, que lê `requireEscolaId()`.
- Todas as consultas de `EncerramentoDaProvaRepository` e de `ProvasVencidasRepository.#abertasAte` filtram por `requireEscolaId()` e `requireAnoEmCurso()`.
- Há duas consultas sem escopo, as duas com `@Unscoped` e justificativa. `escolasComProvaVencida` devolve só ids de escola. `QuedasDaApiRepository.leituraDesde` lê só fatos globais da API.
- O teste A × B manda o id da prova de B no payload do job de A, e a prova de B não fecha.
- O encerramento pela professora continua passando por `AtividadeAplicadaRepository.lock` e responde `NAO_ENCONTRADO`, sem diferença entre "não existe" e "sem permissão".

Logs: limpos. `encerrar-provas-vencidas.ts` loga só `escolaId`, `atividadeAplicadaId`, contagens e `summarizeError`, que descarta a mensagem do erro e guarda tipo, sqlstate e pilha filtrada. As consultas que o runbook manda rodar trazem só ids, datas e `left(query, 60)` do `pg_stat_activity`, onde os valores aparecem como parâmetros (`$1`).

Auditoria: presente. A rotina grava uma auditoria por aplicação, com autor `rotina`. O check da `0069_auditoria_da_rotina_da_prova.sql` só acrescenta essa ação e continua impedindo a rotina de aprovar, rejeitar ou validar. Não há alteração de nota: o lote nasce como `entrega` pendente pelo mesmo `corrigirLote`. Não há exportação, leitura por coordenação ou rede, nem mudança de permissão.

Envio externo: nenhum. A rotina, a correção e a carga não chamam IA.

Seed/fixture: sintético. `infra/scripts/carga-prova.ts` cria escolas por `ops:escola`, sessões por `ops:sessao-sintetica`, enunciados "sintéticos", e roda num compose descartável que é derrubado com os volumes. Nenhum nome ou matrícula aparece no k6 nem em `apps/worker/test/encerrar-provas.int.test.ts`.

Pergunta de fechamento: responde. O que a rotina grava sobre o aluno (`enviada_em` = limite, `envio = 'limite'`) sai no arquivo do titular, e não houve envio a lugar nenhum.

Bloqueantes: nenhum.

Recomendações:
1. O lote ainda não mostra ao professor qual tentativa foi enviada pelo limite, nem guarda isso no registro da validação (D56). A própria tarefa já aponta isso ao Orquestrador. Quando for feito, o DTO do lote deve trazer só o `envio` por correção, sem horário de saída nem limite individual na tela da coordenação.
2. `infra/scripts/carga-prova.ts:312` deixa a pasta com os tokens aberta para todos (`0o777`). Hoje está contido e comentado, porque as sessões são sintéticas e a pasta é apagada no `finally`. Vale uma guarda ou um teste que impeça esse padrão de ser copiado para fora da carga.
3. `infra/scripts/carga-prova.ts:326` imprime as últimas 100 linhas do log da API e do worker quando a carga falha. É aceitável num ambiente sintético, mas convém registrar no runbook que essa saída não pode ir para o `TODO.md` nem para uma issue pública sem conferir antes.

## infra-guardian · 1ª rodada · REPROVADO · 2026-11-27 08:41:56 · `tasks/prd-avaliacao-e-correcao/6_task.md`

VEREDITO: REPROVADO
Caminho quente tocado: prova | fila | migration
Rate limit: ok (a tarefa não cria rota; o PUT, o `comecar` e o `tempo` seguem com o limite por usuário e por escola que já existia)
Fila e prioridade: ok (os dois tipos vão na fila `lote` com `naoUrgente: false`; cada escola tem as vagas `lote` dela; nada novo entra na fila interativa)
Concorrência: protegida (`for update` na aplicação, nos dois caminhos de encerrar; chave do minuto no `enfileirarUmaVez`; `hasLoteVigente` dentro da trava; os casos (c), (e), (f), (j) e (l) com ordem forçada)
Índice e paginação: ok (índice parcial `atividade_aplicada_prova_aberta_idx`; `extensao_de_tempo` usa o prefixo `(escola_id, atividade_aplicada_id)` do unique; laço de até 200; EXPLAIN com 5.000 provas encerradas semeadas)
Degradação de IA: não se aplica
Migration: compatível (só afrouxa o check; `lock_timeout` de 5 s)
Métrica e alerta: ok (gauge `prova.aberta_alem_do_fim` por escola, alerta do p95 do PUT, os dois com seção no runbook)

Bloqueantes:
1. **`tasks/prd-avaliacao-e-correcao/6_task.md:225` (subtarefa 6.5 aberta) e `:264` (linha "Carga [C]").** O caminho quente da prova não tem registro de carga válido. A única rodada de `npm run carga:prova` (27/11) reprovou:
   - `put_ms` p95 = 1,37 s, com teto de 500 ms.
   - A própria tarefa diz que a rodada não vale: havia `educa-teste-2` e `educa-teste-3` de pé, e o load estava acima de 2.
   - O controle negativo (`npm run carga:prova:controle-negativo`) nunca rodou, então não está provado que o cenário consegue reprovar.
   - A distribuição (mediana 12 ms, p90 1,02 s) tem duas faixas. Isso parece fila ou rajada, e não um host uniformemente mais lento. O mais provável é a volta das APIs: 2.100 VUs reenviam juntos o que guardaram na pausa de 90 s, e os 10% sem rede descarregam a fila deles. O `put_ms` conta esses 200 com até 5 s (`infra/k6/prova-online.js:42`, `:89`).
   - **Correção exigida:**
     - Repetir `carga:prova` com a máquina calma, conforme a condição 1 de "Quando a carga vale como registro" em `docs/runbook.md`.
     - Rodar o controle negativo.
     - Registrar na coluna "Caso" o comando, a data e os números das duas rodadas, e fechar a 6.5.
     - Se o p95 continuar acima de 500 ms com a máquina calma, o defeito é do produto e precisa de correção. Se o Arquiteto decidir que o critério deve olhar a recuperação da queda à parte, isso vai para a Tech Spec §7c, e não é ajustado no script.

Recomendações:
- **Mesma escola à noite.** `atividade.encerrar-vencidas` divide a vaga `lote` da escola (`VAGAS_ESCOLA_LOTE`, 2 no `.env.example`) com `material.agendar-classificacao` (prazo de 30 min, às 19h) e `sistema.expurgar-escola` (prazo de 6 h). Uma prova avaliativa feita à noite pode esperar além dos 5 min do alerta. De manhã isso não acontece, porque o não urgente fica segurado pela janela letiva. Vale uma linha no runbook, ou uma vaga reservada para o encerramento.
- **Starvation no laço do job.** `packages/core/src/atividade/provas-vencidas.repository.ts:58-60` (`vencidasDaEscola`) ordena por `fecha_em` com `limit 200`. Uma escola com mais de 200 provas abertas e já vencidas, todas "não vencidas" por extensão, deixa as seguintes sem rodar. É improvável, mas o laço não avança além delas.
- **Migration 0069.** Com `NOT VALID` e `VALIDATE` na mesma transação, o `VALIDATE` varre `auditoria` sob o `ACCESS EXCLUSIVE` do `ADD`, então separar os dois não ganha nada. Como o check só afrouxa, a varredura é custo puro numa tabela que cresce. Segue o precedente da 0056 e da 0060 e o deploy é fora do horário letivo, por isso não bloqueia.
- **Leitura das quedas no encerramento da professora.** `packages/core/src/atividade/encerramento.ts:26` (`encerrarProva`) chama `limitesLidos(..., new Date(0))` e lê toda a `indisponibilidade` desde a época. A tabela é pequena hoje, mas `aPartirDe` poderia ser o `abre_em`, ou o menor `iniciada_em` das tentativas.
- **Custo do gauge.** `apps/worker/src/prova-aberta-gauge.ts:44` faz três consultas por prova candidata (até 200 por escola, a cada 5 min). Está aceitável agora; vale medir se o worker-lote ficar disputado.

Arquivos citados:
- tasks/prd-avaliacao-e-correcao/6_task.md
- infra/k6/prova-online.js
- infra/scripts/carga-prova.ts
- packages/core/src/atividade/provas-vencidas.repository.ts
- packages/core/src/atividade/encerramento.ts
- packages/core/drizzle/0069_auditoria_da_rotina_da_prova.sql
- apps/worker/src/prova-aberta-gauge.ts

## test-engineer · 1ª rodada · REPROVADO · 2026-11-27 08:42:12 · `tasks/prd-avaliacao-e-correcao/6_task.md`

VEREDITO: REPROVADO

**Cenários exigidos**
- Isolamento: o job da escola A deixa intacta a prova da B, e o payload não carrega id de prova.
- Aluno estendido. Extensão da turma (aluno nulo) no fim efetivo, que era a recomendação da 5.0.
- Queda da API dentro da janela.
- Pulso de 1 min contra pulso de 20 s, na rotina e no job.
- Job gravado antes da queda.
- `naoUrgente: false`.
- Ano encerrado contra ano em curso, na rotina e no alerta.
- Função suspensa em A enquanto B corrige.
- Vencida sem envio, com `enviada_em` igual ao limite.
- Professora encerrando uma prova vencida e outra com tempo.
- Uma auditoria por aplicação, sem aluno, e o check da 0069.
- As corridas (c), (e), (f), (j) e (l) da `cenarios.md` §3.
- Regra do alerta, na unidade e no gauge.
- Carga [C] da `cenarios.md` §5, com o controle negativo.

**Cobertos**
- Todos os anteriores, menos a carga e as partes de (e) e (f) apontadas abaixo. Cada linha da tabela tem o caso citado pelo nome.
- Rodei `npx vitest run --project integracao apps/worker/test/encerrar-provas.int.test.ts`: 35 de 35 passaram, em 12 s.
- Os casos olham o banco: `estado`, `enviada_em`, `envio`, lote, auditoria, `job_registro`.
- O isolamento cobre cada metade do escopo, a escola e o ano, em `lockDaRotina`, `tentativasEmAndamento`, `extensoes`, `encerrar` e `registrarVencidas`.
- (c), (f) parte job × job, (j) e (l) têm a ordem forçada (`esperarNaTrava`, `WriteBlockTrigger`).
- Nenhum `.skip`, `.only` ou `any`. Nenhum provedor de IA envolvido.
- Os blocos de mutação conferem com o `git diff`. As 11 linhas listadas no `--faltando` têm motivo plausível na prosa.

**Bloqueantes**

1. **A corrida (e) não força ordem nenhuma e não prova o que diz.**
   - Onde: `apps/worker/test/encerrar-provas.int.test.ts:493-501`.
   - O que está errado: o caso é `Promise.all([rotas.encerrar(...), rodarJob(...)])`, sem ordem forçada. A §3 (e) exige outra coisa: a professora segura a trava, e o job espera e encontra o lote vigente. A autoconferência, item 10, diz que (e) usa `WriteBlockTrigger` e `esperarNaTrava`, e não usa.
   - Por que o caso passa à toa: o `UPDATE` de `encerrar` e o `hasLoteVigente`, lido de novo depois da espera, já dão um lote só em qualquer ordem. "Sem lock: dois lotes", como a tabela afirma, não fica vermelho.
   - A brecha que fica sem prova: com a professora primeiro e o `lockDaRotina` sem `for update`, o job leria `aberta` no snapshot, esperaria no `UPDATE` e gravaria **uma `atividade.encerrada_pelo_limite` falsa**, dizendo que a rotina encerrou a prova que a professora encerrou. O caso nem confere a auditoria.
   - Correção exigida:
     - Segurar a transação da professora com `WriteBlockTrigger` no insert da `entrega` daquela aplicação.
     - Disparar o job e `esperarNaTrava('%atividade_aplicada%for update%')`.
     - Soltar a trava e afirmar: um lote, `auditorias(id) === 0`, e `encerradasTotal: 0` no desfecho do job.
     - De preferência, também a ordem inversa: o job segura e a professora espera.

2. **O "cron duplicado do minuto" em (f) é uma asserção que sempre passa, e o paralelo nunca é exercitado.**
   - Onde: `apps/worker/test/encerrar-provas.int.test.ts:521-523`.
   - O que está errado: ali a prova de A já está encerrada e A não tem outra vencida. A rotina não lista A, e `toHaveLength(0)` passa com ou sem a chave do minuto.
   - O caso da linha 379 não cobre: em `:388`, o `Promise.all([rodarRotina(), rodarRotina()])` roda com o job daquele minuto já gravado pelas chamadas em sequência de `:382` e `:384`. Duas rotinas disputando a primeira gravação nunca acontecem. A chave do minuto só está provada em sequência, o que a regra de concorrência não aceita como teste.
   - Correção exigida: antes do `Promise.all`, criar uma vencida aberta em A e apagar o `job_registro` dela. Rodar as duas rotinas em paralelo e afirmar exatamente um job, com `chave: chaveDoMinuto(relogioDoMinuto.agora())`.

3. **A linha Carga [C] não tem registro válido, e a corrida que houve reprovou.**
   - Onde: `tasks/prd-avaliacao-e-correcao/6_task.md:67` e a subtarefa 6.5, ainda sem marca.
   - O que está errado:
     - O p95 do PUT deu 1,37 s, contra o teto de 500 ms.
     - A corrida foi feita com outros composes de pé e load de 2 a 7, então não vale como registro pelas condições do runbook.
     - O controle negativo (`npm run carga:prova:controle-negativo`) não rodou.
   - O que fica sem prova: a regra 80, item 6, e a §5 da `cenarios.md`. Não rodei a carga: a máquina não pode ser posta sob carga pela revisão.
   - Correção exigida:
     - Repetir `npm run carga:prova` com a máquina calma, conforme "Quando a carga vale como registro" no runbook.
     - Rodar o controle negativo.
     - Registrar na coluna "Caso" o comando, a data e os números.
     - Se o p95 continuar acima de 500 ms com a máquina calma, é defeito de desempenho do PUT, e se corrige antes de fechar a tarefa.

**Recomendações**
- `encerrar-provas-vencidas.ts:106`: nenhum teste prova que o `statement_timeout` de 20 s é aplicado na transação de cada aplicação. Vale um caso que leia `current_setting('statement_timeout')` dentro dela, ou uma consulta lenta que seja cortada.
- (j), em `:526`: a extensão é simulada por SQL à mão, com `for share` e insert. Passando pela rota real de estender (`rotas.estender`) com `WriteBlockTrigger` em `extensao_de_tempo`, como pede a §3 (j), a prova cobriria também que a rota toma o `for share`.
- (l), em `:555`: o pulso também é simulado com `update` à mão. Passando pelo `PulsoRepository` (o tique), a ordem forçada ficaria a da §3 (l), com a trava entre o `update` e a indisponibilidade.
- (c), em `:473`: o PUT também é simulado por SQL. A versão pela rota, com `WriteBlockTrigger` em `resposta_atividade`, prova o caminho real.
- A linha "Dentro do horário letivo" prova `nao_urgente: false` gravado, mas não o despachante soltando o job em horário letivo. Se `apps/despachante/test/janela.int.test.ts` já cobre isso de forma genérica, basta citá-lo na linha.
- Comentário em `prova-online-aluno.int.test.ts:470`: diz "a Bia segue `encerramento`", mas o caso afirma `envio` nulo. Alinhar o texto ao que é afirmado.

Arquivos relevantes:
- apps/worker/test/encerrar-provas.int.test.ts
- tasks/prd-avaliacao-e-correcao/6_task.md
- tasks/prd-avaliacao-e-correcao/cenarios.md
- packages/core/src/atividade/encerramento.ts
- apps/worker/src/processors/encerrar-provas-vencidas.ts

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-27 08:42:15 · `tasks/prd-avaliacao-e-correcao/6_task.md`

VEREDITO: REPROVADO
Escopo: incompleto
Aderência à Tech Spec: divergência em `cenarios.md` §5 e `techspec.md` §7c (Carga), decidida pelo Implementador sem triagem
Portão local: carimbo válido

Bloqueantes:

1. **A subtarefa 6.5 não foi feita.** `tasks/prd-avaliacao-e-correcao/6_task.md:28` está desmarcada, e a linha da carga [C], na `:67`, admite: "Não vale como registro, e reprovou."
   - O `put_ms` p95 deu 1,37 s, contra um teto de 500 ms.
   - A máquina não estava calma: havia outros composes de pé e o load de 1 min passava de 2.
   - O controle negativo (`npm run carga:prova:controle-negativo`) não rodou.
   - O objetivo da tarefa ("a carga da manhã de segunda prova isso em escala") e o critério do `cenarios.md` §5 seguem sem prova.

   **Correção exigida:** repetir `npm run carga:prova` com a máquina calma, conforme a primeira condição de "Quando a carga vale como registro" em `docs/runbook.md`. Depois, rodar `npm run carga:prova:controle-negativo`, que precisa reprovar pelo `put_p95`. Registrar o comando, a data, o load antes, os números de cada critério e o throttling na coluna "Caso", e marcar a 6.5. Se o p95 continuar acima de 500 ms com a máquina calma, o defeito é do produto e vira correção. A linha do cenário não pode ser rebaixada.

2. **A divergência da carga foi decidida pelo Implementador e já editada na spec, sem triagem do Arquiteto.**
   - `6_task.md:106` diz textualmente "Decisão do Implementador, a confirmar pelo Arquiteto".
   - Mesmo assim, o texto já foi reescrito em `cenarios.md:162` ("**separado** da `FASE=sala`") e em `techspec.md:174`. Antes, os dois diziam "junto da `FASE=sala`".
   - As outras duas linhas de divergência dizem "decidido na triagem da 6.0". Esta não. O `estado.md` não registra triagem dela.
   - O `executar-task` manda parar e enviar `/seguir DIVERGÊNCIA de Implementador` (Motivo: desenho), e veda editar o documento para acomodar o resultado.

   **Correção exigida:** enviar a `DIVERGÊNCIA` ao Orquestrador para o Arquiteto triar. Com a decisão tomada, reescrever a linha em `6_task.md:106`, `cenarios.md:162` e `techspec.md:174` como decidida na triagem. Se a decisão for rodar junto da `FASE=sala`, voltar a spec ao texto original e implementar assim.

Recomendações:
- **`packages/core/src/atividade/encerramento.ts:69`:** `encerrarProva` passa `new Date(0)` como `aPartirDe`. A redução em `limitesLidos` (`:51`) começa desse valor, então o `desde` fica sempre na época e a professora lê todas as indisponibilidades dos 13 meses. O resultado do limite está certo, mas a leitura é maior que o necessário. Partir do menor `iniciadaEm` das tentativas (ou de `now()` sem tentativa) resolve.
- **`apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts:226`:** `AtividadeAplicadaRepository.encerrar` ficou sem chamador em produção. É um segundo `update` igual ao do `EncerramentoDaProvaRepository.encerrar`, e o caso de isolamento em `apps/api/src/atividade/atividade-isolamento.int.test.ts:350` ainda testa essa cópia morta. Apagar o método e apontar o caso para o do `core`.
- **`apps/worker/src/composition.ts:427`:** o comentário perdeu o "e" antes de "o expurgo do dado pessoal".
- **`apps/worker/src/job-schedules.ts:27`:** o cabeçalho ainda diz "O job nasce não urgente na fila de lote", e a rotina nova é urgente. Ajustar a frase para as rotinas noturnas.
- **`packages/core/src/atividade/provas-vencidas.repository.ts:82`:** o job lê as 200 de `fecha_em` mais antigo. Numa escola com mais de 200 provas vencidas que ainda não chegaram ao fim efetivo (aluno estendido), as mesmas 200 voltariam todo minuto e as demais não seriam vistas. É improvável na escala do piloto, mas vale um caso ou uma linha na Tech Spec §7c ("Laços").

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-27 22:20:40 · `tasks/prd-avaliacao-e-correcao/6_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nem migration no diff da rodada 2. Ficam como estavam na rodada 1: a `0069`, `atividade_aplicada`, `tentativa_atividade`, `extensao_de_tempo` e `entrega`, todas com `escolaId` e `anoLetivoId`, e `indisponibilidade` e `pulso_da_api`, que são tabelas globais do sistema e não têm dado de escola.

Queries verificadas:
- **`AtividadeAplicadaRepository.encerrar` removido.** Era cópia sem uso. Não sobrou nenhum chamador em `apps/api/src`.
- **`EncerramentoDaProvaRepository.encerrar`** (`packages/core/src/atividade/encerramento.repository.ts:76-80`): o escopo vem do contexto, por `requireEscolaId()` e `requireAnoEmCurso()`.
- **`limitesLidos` e `encerrarProva`** (`packages/core/src/atividade/encerramento.ts:47-70`): agora a leitura de quedas começa na primeira tentativa, ou no momento atual quando não há tentativa. As leituras de tentativas e extensões continuam com escopo do contexto. `QuedasDaApiRepository.leituraDesde` lê só as tabelas globais e não toca dado de escola.
- **Scripts de carga** (`infra/k6/prova-online.js`, `infra/scripts/carga-prova.ts`, `infra/scripts/conferir-carga-prova.ts`): a identidade vai só no token `Bearer`. Nenhum `escolaId` vai no corpo ou na query.
- Não há endpoint novo nem `@Unscoped()` novo.

Teste de isolamento: presente e efetivo.
- **Escrita com escola ou ano trocado** (`apps/api/src/atividade/atividade-isolamento.int.test.ts:350`): o caso agora chama o repository que roda em produção, `EncerramentoDaProvaRepository.encerrar`. Ele quebra se a cláusula de escola ou de ano sair. Sem ela, a aplicação `aberta` passaria a `encerrada` e o `retrato()` mudaria.
- **Item 8 da ordem, parte do tenancy, aplicado** (`apps/worker/test/encerrar-provas.int.test.ts:825-828`): o caso agora confere que `escolasComProvaVencida` devolve só ids no formato UUID. O `toContain` vem antes, então a lista não está vazia e o `every` não passa à toa.

Bloqueantes: nenhum.

Recomendações:
- `apps/worker/test/encerrar-provas.int.test.ts:828`: a regex aceitaria qualquer texto em formato de UUID. Como a função devolve id de escola, `expect(escolas.every(id => typeof id === 'string'))` junto com o tipo de retorno já basta. Para travar o formato de vez, vale um `toEqual` com a lista exata das escolas que o caso montou. Isso não bloqueia.
- A recomendação da rodada 1 sobre o `anoLetivoId` no join de `entrega` em `historicoAprovado` segue registrada no `TODO.md` e não mudou.

Arquivos auditados nesta rodada:
- apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
- apps/api/src/atividade/atividade-isolamento.int.test.ts
- packages/core/src/atividade/encerramento.ts
- packages/core/src/atividade/encerramento.repository.ts
- apps/worker/test/encerrar-provas.int.test.ts
- infra/k6/prova-online.js
- infra/scripts/carga-prova.ts
- infra/scripts/conferir-carga-prova.ts

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-27 22:20:54 · `tasks/prd-avaliacao-e-correcao/6_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta rodada. O diff não grava, não cria e não muda escrita em `Nota`. A rotina `sistema.encerrar-provas-vencidas` e o job `atividade.encerrar-vencidas` continuam gravando só o encerramento da aplicação, a `entrega` pendente e a auditoria `atividade.encerrada_pelo_limite`. O cenário de carga (`infra/k6/prova-online.js`, `infra/scripts/carga-prova.ts`) só exercita o PUT da resposta e o encerramento pela rotina. Ele não aprova lote. Todos com autor humano? sim, porque não existe caminho novo.

Decisão autônoma sobre aluno: ausente. A rotina encerra a prova pelo limite de tempo e põe o lote na fila. Ela não aprova, não reprova e não encaminha ninguém. O lote nasce pendente.

Aprovação registrada: ok. O que mudou nesta rodada reforça a regra:
- **Professora primeiro, job depois.** O caso novo está em `apps/worker/test/encerrar-provas.int.test.ts:550`. A professora segura a trava com `WriteBlockTrigger` e o job espera no `for update`. O teste afirma `auditorias(id) === 0` e `encerradasTotal: 0` nas linhas 571 e 572. Isso fecha o risco apontado na rodada 1: o job gravar uma `atividade.encerrada_pelo_limite` falsa, em nome da `rotina`, sobre uma prova que a professora encerrou.
- **Job primeiro, professora depois.** Na ordem inversa (linha 575), o resultado é um lote, uma auditoria e uma resposta 200.
- **O que a `rotina` pode assinar.** O check `auditoria_rotina_so_nas_acoes` não mudou nesta rodada. Só o comentário passou a dizer "sete ações", na linha 71 de `packages/core/src/db/schema/auditoria.ts`, e a vírgula do `describe` em `packages/core/src/auditoria/auditoria.int.test.ts` foi corrigida. A `rotina` segue sem poder assinar `lote.aprovado`, nem rejeitar ou validar.

Supervisão do tutor: ok. O diff não toca o tutor.

Autonomia declarada e visível: sim. Nada mudou aqui. Seguem os níveis da rodada 1, e o texto do `fazSozinha` foi para o `TODO.md`, como recomendado.

Itens 6 a 9: sem mudança.
- A auditoria continua respondendo "o que a IA gerou, quem aprovou e quando".
- Nada mede comportamento ou navegação do aluno. A carga é sintética.
- Não há campo nem prompt de nota em discursiva ou redação.
- Não há indicador de professor.

A mudança em `packages/core/src/atividade/encerramento.ts:47-53` só muda o ponto de partida da leitura das indisponibilidades: passa do começo dos tempos para a primeira tentativa, ou para o momento atual quando não há tentativa. Ela não altera quem decide nem quem aprova. O caso que a cobre está na linha 390 do teste do worker.

Correções exigidas na rodada anterior: nenhuma pelas minhas regras. A recomendação de texto do meu item 7 da ordem foi aplicada.

Bloqueantes: nenhum.

Recomendações:
- Continua em aberto, com o Orquestrador, "mostrar ao professor a tentativa enviada pelo limite": o lote ainda não diz qual tentativa foi enviada pelo limite, e o registro da validação (D56) não guarda isso. Precisa ter dono antes da validação da spec, porque é parte do que o professor vê antes de aprovar o lote.
- Ainda vale a do `fazSozinha` de `correcao_de_objetiva` (`packages/shared/src/time/funcoes.ts:48`), já anotada no `TODO.md`. O texto que a coordenação lê deveria dizer, em português comum, que o sistema encerra sozinho a prova cujo tempo acabou, e que a nota continua dependendo do professor.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-27 22:20:54 · `tasks/prd-avaliacao-e-correcao/6_task.md`

VEREDITO: APROVADO

Esta é a rodada 2. Auditei só o diff `ac9e2531` → `41866e20` e o que ele afeta. O commit `6bfcc86b` (pool-503) ficou fora, como a ordem pede.

Campos pessoais tocados: nenhum. Não há migration nova neste diff. A 0069 já foi auditada na 1ª rodada, e o check dela só mudou de comentário ("seis" virou "sete" ações) em `packages/core/src/db/schema/auditoria.ts:552`.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok.
- O caso de isolamento em `apps/api/src/atividade/atividade-isolamento.int.test.ts:350` agora testa `EncerramentoDaProvaRepository.encerrar`, que é o código que roda. A cópia morta em `atividade-aplicada.repository.ts` foi apagada (item 6 da ordem).
- Em `apps/worker/test/encerrar-provas.int.test.ts:427-430` entrou o caso que confere o formato do retorno de `escolasComProvaVencida()`, a única leitura sem escopo. Ela devolve só UUIDs de escola, nenhuma outra coluna (item 8, recomendação do tenancy-guardian).

Logs: limpos.
- O código de produção mudou só em `encerramento.ts`, nas linhas 47-53 e 70: o `desde` agora vem da primeira tentativa, ou de agora quando não há tentativa. Essa mudança não grava log nenhum.
- `infra/k6/prova-online.js` não tem `console.*`.
- As mensagens novas de `carga-prova.ts` e `conferir-carga-prova.ts` só trazem números e nomes de critério.
- A linha pedida pelo privacy-guardian na 1ª rodada entrou em `docs/runbook.md`, seção "Rodar o cenário da prova": a saída de log da carga que falhou não vai para o `TODO.md` nem para issue pública sem ser conferida antes.

Auditoria: presente.
- A rodada não removeu nada que estivesse auditado.
- As duas corridas (e) novas agora afirmam a auditoria do limite: `auditorias(id) === 0` quando a professora encerra primeiro, e `=== 1` quando o job encerra primeiro. Com isso o teste fecha o risco que a 1ª rodada apontou, de gravar uma `atividade.encerrada_pelo_limite` falsa.

Envio externo: nenhum. A prova e o cenário de carga não chamam provedor de IA.

Seed/fixture: sintético.
- A carga usa escolas e alunos sintéticos, com sessões criadas no compose descartável.
- Os casos novos do worker criam tabela e gatilho temporários (`teste_prazo_do_job`) que guardam só o id da aplicação e o valor do `statement_timeout`, e os apagam no `finally`.

Bloqueantes: nenhum.

Recomendações:
- Em `encerramento.ts:53`, quando não há tentativa, `leituraDesde(desde ?? new Date())` usa a hora da máquina, e não a do banco. O resultado não muda, porque sem tentativa nenhuma queda entra no limite. Mesmo assim, o comentário poderia dizer que esse valor serve só para cortar a leitura, e não como relógio.
- A recomendação da 1ª rodada que eu e o conformidade-reviewer fizemos continua em aberto, com o Orquestrador: o lote ainda não mostra ao professor qual tentativa foi enviada pelo limite, e o registro da validação (D56) não guarda isso.

Pergunta de fechamento: sim, o código responde. Esta rodada não acrescentou dado de aluno nem destino de envio. O encerramento pela rotina continua auditado com o autor `rotina`, sem nome de aluno, e o arquivo do titular (D85) e `ExecucaoAgente` não foram tocados.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-27 22:22:11 · `tasks/prd-avaliacao-e-correcao/6_task.md`

VEREDITO: APROVADO
Caminho quente tocado: prova | fila | migration
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: compatível
Métrica e alerta: ok
Bloqueantes: nenhum

A correção exigida na rodada 1 foi feita:
- **Rodada nova, com a máquina calma.** `npm run carga:prova` rodou em 27/11, às 18:39Z. Antes de começar, o `docker ps` estava vazio e o load de 1 min era 0,24, o que cumpre a condição 1 do runbook. A rodada passou. O PUT do fluxo normal ficou com p95 de 14 ms, a fila mais lenta esvaziou em 26 s, as 42.000 respostas enviadas estão gravadas, a lacuna gravada foi de 98 s, nenhuma prova foi encerrada na queda, e a canária teve o limite andado em 98 s.
- **Os dois controles negativos rodaram e reprovaram, cada um pelo seu critério.** O do PUT reprovou pelo `put_p95` (4.567 ms). O da volta reprovou pela `fila_da_volta` (162 s).
- **A 6.5 está fechada.** O primeiro vermelho continua escrito junto do resultado novo, como o runbook exige.
- **A mudança de critério passou pela triagem.** A opção A está em `techspec.md` §7c e em `cenarios.md` §5, e o script mede o que as duas dizem: `tocouAJanelaDaVolta`, `naQueda` até `FIM_DA_JANELA_DA_VOLTA_S` e os limites `p(95)<500` e `max<60`.
- **As recomendações que a Mesa levou na ordem foram aplicadas, e as corridas (e) e (f) também.** Sobre a `indisponibilidade`, `encerrarProva` agora lê a partir da primeira tentativa, e o caso com spy prova isso. Sobre a vaga `lote` à noite, o runbook ganhou o passo 6. As corridas (e) e (f) agora forçam a ordem: a (e) roda nas duas ordens e confere a auditoria; a (f) apaga o `job_registro` antes do `Promise.all`.

Recomendações:
1. Na linha 174 de `tasks/prd-avaliacao-e-correcao/techspec.md`, a §7c diz "o que esvazia a fila acumulada, 1,62 s". O registro da rodada que vale, em `6_task.md:67`, traz `put_da_volta_ms` p95 de 4,98 s. Alinhar ao número da rodada registrada, ou dizer de qual rodada vem o 1,62 s.
2. O sorteio de 0 a 5 s quando a rede volta é atribuído ao app, mas o app ainda não o tem. Ele aparece em `cenarios.md:167` ("as constantes são as do app… confere as duas"), em `docs/runbook.md:2086` e em `infra/k6/prova-online.js:10-11` e `:63-64`.
   - Hoje `apps/web/src/areas/aluno/fila-de-respostas.ts:172` chama `tryTodas` assim que chega o `online`, e `respostas.ts` não tem `ESPERA_MAXIMA_NA_VOLTA_DA_REDE_MS`.
   - `infra/test/carga-prova.test.ts:176-182` não confere essa constante.
   - Nesta rodada o resultado não depende disso, porque a rede volta aos 180 s com as APIs já pausadas. Fica descoberto até a 12.3 o caso da escola inteira que reenvia no mesmo segundo quando a rede volta.
   - Até lá, escrever "a partir da 12.3" nos três textos.
3. `cenarios.md:182` fala do 503 com `Retry-After` dentro da janela, mas o `registrarFalha` do k6 (`prova-online.js:115-118`) aceita 503 sem olhar o cabeçalho. Contar como falha o 503 sem `Retry-After` faria a carga confirmar também o contrato da correção pool-503.
4. O load antes dos controles não foi lido. Na próxima corrida, escrever o load junto de cada controle.
5. Na rodada verde, `put_fluxo_normal_na_volta_ms` teve p95 de 2,78 s. É o que o aluno sem fila acumulada sente por cerca de 60 s depois de uma reinicialização em produção. A medida do pool em 20 por instância já está no `TODO.md`. Vale citar esse número nela, para a decisão da N2 levar o que o aluno sente, e não só o resultado da fila.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-27 22:22:48 · `tasks/prd-avaliacao-e-correcao/6_task.md`

**VEREDITO: APROVADO**

**Escopo:** respeitado

**Aderência à Tech Spec:** ok

**Portão local:** carimbo válido. O `conferir` respondeu "portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)".

**Bloqueantes:** nenhum.

As duas correções exigidas na rodada 1 foram feitas:

1. **A 6.5 está fechada.** Está marcada em `6_task.md:28`. A linha "Carga [C]" (`:67`) registra:
   - o comando, a data, a máquina calma (`docker ps` vazio, load de 1 min 0,24) e o número de cada critério;
   - os dois controles negativos, cada um reprovando pelo critério dele: `put_p95` com 4.567 ms e `fila_da_volta` com 162 s.

   Pela regra do runbook, o `carga:prova` só precisa da primeira condição de "Quando a carga vale como registro". O throttling que eu pedi na rodada 1 ia além da regra, e não reprovo por ele. O script mede o que a spec escreve:
   - a janela da volta, que vai de `FIM_DA_QUEDA_S` a `+60`, aparece em `tocouAJanelaDaVolta` e `naQueda` (`infra/k6/prova-online.js:102-107`);
   - só os status 0, 502, 503 e 504 contam como falha da queda;
   - o veredito usa `put_fluxo_normal_ms` e `fila_esvaziada_na_volta_s` em `infra/scripts/conferir-carga-prova.ts`.

   Isso bate com a `cenarios.md` §5 e com a `techspec.md` §7c.

2. **A divergência da carga foi triada.** O Arquiteto triou o "separado da `FASE=sala`" em 27/11 ~09:10 (está no `estado.md` do térreo). Ele triou também a opção A (`.processo/divergencia-6.0-carga.md`, item 3). `6_task.md:106`, `cenarios.md:162` e `techspec.md:174` agora dizem "decidido na triagem da 6.0".

As recomendações 5, 6 e 7 da ordem também foram feitas. A leitura das quedas parte da primeira tentativa, com caso e mutação. `AtividadeAplicadaRepository.encerrar` foi apagado, e o caso de isolamento passou a usar o repository do `core`. Os quatro comentários foram corrigidos.

**Recomendações:**
- **`6_task.md`, "Divergências resolvidas nesta tarefa":** faltam o critério dividido (decisão do Joaquim, N = 60 s) e a janela da volta (opção A). As duas já mudaram a `cenarios.md` §5 e a `techspec.md` §7c durante esta tarefa. Vale uma linha para cada, apontando para onde estão na spec.
- **`6_task.md:90` (autoconferência, item 8):** ainda diz "as duas linhas da seção abaixo", e a seção tem quatro.
- **`ESPERA_MAXIMA_NA_VOLTA_DA_REDE_MS`:** o k6 já imita o sorteio de 0 a 5 s (`infra/k6/prova-online.js:64`, `:168`), mas o app só ganha isso na 12.0. `cenarios.md` §5, o cabeçalho do k6 (`:16-17`) e o runbook dizem que `carga-prova.test.ts` confere as constantes. Hoje ele não confere esta. A linha "Carga [C]" deveria avisar que a rodada verde mediu esse sorteio da volta da rede antes de o app tê-lo.
- **Números antigos na spec:** `techspec.md:174` cita o PUT da volta com p95 de "1,62 s". A rodada que vale como registro mediu 4,98 s. Atualizar ou dizer de qual rodada é o número.
- **Load dos controles:** não foi lido na partida. Os dois controles reprovam por construção (o gatilho de 600 ms; a queda que termina depois do fim da janela), então isso não muda a conclusão. Mesmo assim, vale registrar nas próximas rodadas.
- **"O script k6 não foi mexido pelo Implementador" (`6_task.md:67`):** a frase é verdadeira, mas o k6, o `conferir-carga-prova.ts` e o teste mudaram nesta rodada, pelas mãos do Arquiteto. Dizer quem mexeu e por quê evita parecer que o k6 ficou como estava.

Arquivos principais:
- tasks/prd-avaliacao-e-correcao/6_task.md
- infra/k6/prova-online.js
- infra/scripts/conferir-carga-prova.ts
- tasks/prd-avaliacao-e-correcao/cenarios.md
- tasks/prd-avaliacao-e-correcao/techspec.md

## test-engineer · 2ª rodada · APROVADO · 2026-11-27 22:23:39 · `tasks/prd-avaliacao-e-correcao/6_task.md`

VEREDITO: APROVADO

**Cenários exigidos.** Conferi a rodada nova contra o diff desde a árvore `ac9e2531`. O que a 6.0 tinha de provar:
- a corrida (e) nas duas ordens forçadas, sem auditoria falsa do limite;
- a (f) com a primeira gravação do minuto disputada de verdade;
- a carga [C] com registro válido, com o p95 do fluxo normal, a fila da volta, enviadas = gravadas, a queda que anda o limite e não encerra, e dois controles negativos, cada um reprovando pelo seu critério;
- as recomendações que a Mesa pôs na ordem: o `statement_timeout`, o formato de `escolasComProvaVencida`, a leitura das quedas na professora, o comentário da Bia e a citação do despachante.

Rodei os dois arquivos: `npx vitest run infra/test/carga-prova.test.ts` passou com 20 de 20, e `npx vitest run --project integracao apps/worker/test/encerrar-provas.int.test.ts` passou com 38 de 38.

**Cobertos.**
- **Correção 1, a corrida (e):** feita. `apps/worker/test/encerrar-provas.int.test.ts:550-596` tem agora dois casos.
  - "corrida e, professora × job": o `WriteBlockTrigger` para o insert da `entrega` da professora, o job espera em `esperarNaTrava('%atividade_aplicada%for update%')`, e o caso confere 1 lote, 1 correção, `auditorias(id) === 0` e `encerradasTotal: 0` no desfecho do job.
  - "corrida e, job × professora": o job segura a trava, a professora espera (o padrão pelas colunas do começo da consulta está justificado no comentário), e o caso confere 1 lote e 1 auditoria.
  - O bloco que tira o `.for('update')` cita o primeiro caso. Sem o `for update`, o job não espera na trava, e o caso fica vermelho na espera.
- **Correção 2, o cron duplicado:** feita nos dois lugares.
  - Em `:443-447`, o `job_registro` de A é apagado antes do `Promise.all([rodarRotina(), rodarRotina()])`, e o caso afirma um job só, com `chave: chaveDoMinuto(...)`.
  - Na (f), em `:617-622`, há uma vencida nova aberta em A, o registro é apagado, as duas rotinas rodam em paralelo e o caso afirma um job com a chave do minuto.
  - O bloco que troca a chave por `randomUUID()` cobre a cláusula.
- **Correção 3, a carga [C]:** a coluna "Caso" tem o comando, a data e os números. A rodada verde teve a máquina calma (`docker ps` vazio, load 0,24). Os números:
  - PUT do fluxo normal: p95 de 14 ms.
  - Fila da volta: 26 s.
  - Respostas: 42.000 enviadas = 42.000 gravadas.
  - Queda: lacuna de 98 s, 0 provas encerradas durante ela, canária com o limite andado.
  - Os dois controles reprovaram pelo critério de cada um: `put_p95` com 4.567 ms e `fila_da_volta` com 162 s.
  - `infra/test/carga-prova.test.ts` prova o veredito separado. O teto do p95 do fluxo normal está no limite exato e logo abaixo dele. O PUT da volta não tem teto. A fila de 60 s ou mais reprova, e sem fila medida é `sem_amostra`. O veredito não lê o `put_ms`, cada controle só passa pelo critério dele (e não pelo do outro), e as constantes do recuo, do jitter e do prazo do PUT do k6 são as do app. Os thresholds do k6 usam as métricas novas.
- **Recomendações da ordem:**
  - O `statement_timeout` é lido por um gatilho dentro da transação do job, que afirma `['20s']`, com bloco de mutação.
  - O formato UUID de `escolasComProvaVencida` está afirmado.
  - A leitura das quedas desde a primeira tentativa, e desde agora quando não há tentativa, tem três blocos. O `spyOn` não troca a implementação, então não esconde a regra.
  - O comentário da Bia, o cabeçalho do `job-schedules`, a citação do despachante e a linha do runbook foram feitos.
  - O método morto `AtividadeAplicadaRepository.encerrar` saiu, e o caso de isolamento aponta agora para o repository do `core`.
- Não há `.skip`, teste comentado nem provedor pago.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **A largura da janela da volta não é guardada por teste.** Em `infra/k6/prova-online.js`, `FIM_DA_JANELA_DA_VOLTA_S = FIM_DA_QUEDA_S + LIMITE_DA_VOLTA_S` e `FIM_DA_QUEDA_S` são expressões, e o `constante()` de `infra/test/carga-prova.test.ts` só lê literal. Se alguém alargar a janela, o PUT normal da volta sai do critério sem nada ficar vermelho. O controle de 600 ms também continuaria reprovando, pelos PUT de antes da queda. Vale afirmar o texto das duas linhas no teste.
2. **O controle `fila_da_volta` reprova por construção.** Com as APIs fora por 150 s, elas só voltam aos 330 s, que é exatamente o fim da queda prevista mais 60 s. Esse controle prova que a medição e o veredito funcionam, mas não prova que um reenvio lento seria pego numa queda normal. Vale escrever isso em `cenarios.md` §5, onde hoje está "o controle de 150 s prova isso".
3. **O load antes dos controles não foi lido.** A coluna "Caso" diz isso. Uma máquina disputada facilita a reprovação, então o controle fica mais fraco. Na próxima rodada, vale ler o load também antes deles.
4. **O cliente do k6 já sorteia de 0 a 5 s quando a rede volta, e o app ainda não.** Hoje o `fila-de-respostas.ts:172` chama `tryTodas` na hora, e o sorteio é a subtarefa 12.3. Até a 12.3 pousar, a carga registrada mede um cliente mais gentil que o app de hoje. A 12.0 já prevê conferir `ESPERA_MAXIMA_NA_VOLTA_DA_REDE_MS` no `carga-prova.test.ts`. Vale lembrar de rodar a carga de novo depois dela.
5. **No primeiro caso da (e), o vermelho sem `for update` vem da espera, e não da asserção.** O `esperarNaTrava` estoura o tempo antes de chegar a `auditorias(id) === 0`. O vermelho está correto, mas pela espera, não pela auditoria falsa. Não precisa mudar nada.

Arquivos relevantes:
- apps/worker/test/encerrar-provas.int.test.ts
- infra/test/carga-prova.test.ts
- infra/k6/prova-online.js
- infra/scripts/conferir-carga-prova.ts
- tasks/prd-avaliacao-e-correcao/6_task.md
- apps/web/src/areas/aluno/fila-de-respostas.ts
