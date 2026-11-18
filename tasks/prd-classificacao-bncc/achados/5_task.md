# Achados das revisões — `tasks/prd-classificacao-bncc/5_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-18 04:14:42 · `tasks/prd-classificacao-bncc/5_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nem migration nova nesta tarefa. Toda escrita nova vai para tabelas que já existem e todas levam `escola_id`: `execucao_agente`, `secao_do_material` (`execucao_id`) e `job_registro`. A execução da classificação fica com `ano_letivo_id` nulo. Isso está certo, porque ela pertence ao material e não varia por período.

Queries verificadas:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/material/agendamento-da-classificacao.repository.ts`:
  - `funcaoEstaAtiva` filtra por `requireEscolaId()`.
  - `proximasSecoes` filtra por `secaoDoMaterial.escolaId` vindo do contexto, e as junções e o `exists` usam a chave composta da escola.
  - `#seriesDosMateriais` filtra pela escola do contexto.
  - Em `#criarExecucao`, o insert usa a escola do contexto, o `update ... where s.escola_id = ${escolaId}` e o `delete` também levam a escola.
  - Nenhum método recebe `escolaId` como parâmetro. O `materialId` do filtro vem do job de extração, que já roda no contexto da escola.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/material/classificacao-atrasada.repository.ts`: `atrasadas` filtra por `requireEscolaId()`, e a métrica só sai com contagem e `escola_id`.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/worker/src/processors/agendar-classificacao.ts`:
  - A rotina só roda com `rotinaDoSistema` e lista as escolas por `CronEscolasRepository.listarIds`, que já existia e está na lista de `architecture.test.ts`.
  - Ela grava um job por escola dentro de `runInContext` da escola. O `material.agendar-classificacao` tem escopo `escola` e dados `semDados`, então a escola vem do registro do job e nunca do payload.
- Não há endpoint novo, ninguém aceita `escolaId` do cliente e não aparece nenhum `@Unscoped()` novo.

Teste de isolamento: presente e efetivo.
- `apps/api/src/material/agendamento.int.test.ts:535`, "isolamento: o repository, no contexto da A…": se a cláusula `eq(secaoDoMaterial.escolaId, escolaId)` for removida, a leitura no contexto da B deixa de ser exatamente as seções da B e a asserção da linha 542 quebra.
- `apps/worker/test/classificacao-agendada.int.test.ts:199`: se a escola for removida em `atrasadas`, a escola A passa a ter série com a execução da B e a asserção `{ [b]: 1 }` quebra.
- Há casos complementares, onde a rotina, a suspensão e a extração da A não tocam a B, em `agendamento.int.test.ts:210` e `:224` e no isolamento de `extrair-pdf.int.test.ts`.

Bloqueantes: nenhum.

Recomendações:
- `agendamento-da-classificacao.repository.ts:186` e `:193`: o termo de escola no `update` cru e no `delete` da execução que perdeu a corrida está declarado como mutante equivalente, porque a FK composta e a leitura com escopo já protegem. Vale manter os dois termos como defesa em profundidade, sem teste próprio. Também vale registrar no docblock que eles não podem sair numa refatoração.
- `agendamento.int.test.ts:210`, "a rotina da escola A não toca a seção da B": esse caso sozinho não pega a remoção do `where` de escola em `proximasSecoes`, porque `#seriesDosMateriais` descarta a seção da B. Quem pega é o caso de `:535`. Vale citar no nome ou num comentário que o isolamento da leitura é provado lá, para ninguém apagar o caso `:535` achando que repete o `:210`.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-18 04:14:49 · `tasks/prd-classificacao-bncc/5_task.md`

VEREDITO: APROVADO

A tarefa 5.0 não introduz nenhum dado pessoal novo e não abre caminho de exposição. O agendamento só mexe com seções do material licenciado, execuções da classificação e jobs, sempre no escopo da escola.

Campos pessoais tocados: nenhum. As linhas novas de `execucao_agente` não têm pessoa (`solicitadaPor: null`) nem ano letivo, e o campo `entrada` guarda só `{ tarefa: 'classificar_secoes' }`. Os campos de `secao_do_material` que a tarefa usa são do material, não de pessoa: `execucao_id`, `falhas_seguidas` e `corrigida_em`.

Fora da tabela de dados do docs/lgpd.md: nada. Nenhuma migration e nenhum campo pessoal novo.

Autorização por objeto: ok. A tarefa não tem rota HTTP. Nas consultas, a escola vem sempre do contexto (`requireEscolaId()`), e isso vale para `proximasSecoes`, `#seriesDosMateriais`, `funcaoEstaAtiva`, o `update ... where s.escola_id = ${escolaId}` e `ClassificacaoAtrasadaRepository.atrasadas`. A única consulta sem escopo é `CronEscolasRepository.listarIds`, que já existia. O isolamento é testado em `apps/api/src/material/agendamento.int.test.ts` ("isolamento: o repository, no contexto da A…", com teste de mutação sobre o `escolaId`).

Logs: limpos.
- `classificacao.rotina_disparada` e `classificacao.escola_nao_enfileirada` (`apps/worker/src/processors/agendar-classificacao.ts`) levam só contagens, `escolaId` e `summarizeError`.
- `classificacao.agendada` leva `escolaId`, `estado` e contagens.
- `material.extraido` (`apps/worker/src/processors/extrair-pdf.ts`) ganhou só `execucoesTotal`.
- Dois testes provam a ausência de texto no log: "sigilosa" em `agendamento.int.test.ts:347` e "sintética" em `classificacao-agendada.int.test.ts:81`.
- A métrica `classificacao.execucoes_atrasadas` e o alerta `infra/grafana/alertas/classificacao-atrasada.yaml` levam só `escola_id`.
- As consultas do runbook ("Classificação do material atrasada") leem só ids, estados, códigos, datas e contagens.

Auditoria: não se aplica. A tarefa não tem leitura de dado de aluno, exportação, mudança de nota ou de permissão, nem aprovação de saída de IA.

Envio externo: nenhum nesta tarefa. Ela só cria a execução registrada em `execucao_agente` e o job `ia.executar-lote` pelo `JobOutbox`. O envio ao modelo e a checagem de soberania são da 4.0. A carga rodou com o adaptador falso.

Seed/fixture: sintético.
- `infra/scripts/carga-classificacao.ts` gera "Apostila n", a disciplina 'Química' e páginas repetidas a partir de um texto fixo; os alunos da B saem de `ops:sessao-sintetica`.
- Os testes usam "Capítulo n", "Coordenação sintética" e nomes com `randomUUID()`.

Pergunta de fechamento: o código continua respondendo. A tarefa não grava nada sobre aluno e não manda dado de pessoa a lugar nenhum. As execuções novas não são de pessoa e ficam consultáveis em `execucao_agente` por escola.

Bloqueantes: nenhum.

Recomendações:
1. `docs/runbook.md`, causa 2, diz "~625 execuções, ~65 min", mas a carga mediu 630 execuções em cerca de 2,4 h. Não é da regra 20, mas o operador vai ler esse número; vale passar ao `infra-guardian`.
2. A primeira consulta do runbook devolve a coluna `erro` de `execucao_agente`. Hoje ela guarda só código, mas vale pôr uma linha no runbook dizendo isso, para ninguém trocar por uma coluna de texto livre no futuro.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/material/agendamento-da-classificacao.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/material/classificacao-atrasada.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/worker/src/processors/agendar-classificacao.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/worker/src/processors/extrair-pdf.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/worker/src/classificacao-gauge.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/infra/grafana/alertas/classificacao-atrasada.yaml
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/infra/scripts/carga-classificacao.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/docs/runbook.md

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-18 04:14:50 · `tasks/prd-classificacao-bncc/5_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A tarefa não grava em `Nota` nem em `lancadaPor` por nenhum caminho: extração, rotina das 19h, agendamento por escola, medição, carga ou seed sintético. O seed de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/infra/scripts/carga-classificacao.ts` insere só disciplina, material, série, trecho, seção e job. Todos com autor humano? Não se aplica, porque não há escrita.

Decisão autônoma sobre aluno: ausente. A rotina classifica seções do material da escola. A execução nasce sem pessoa e sem ano (`solicitadaPor: null`, `anoLetivoId: null`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/material/agendamento-da-classificacao.repository.ts:168-176`), e o job não toca aluno, turma nem trajetória.

Aprovação registrada: ok. A função `classificacao_do_material` está declarada com autonomia 1 (faz e registra), em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/shared/src/time/funcoes.ts:59-66`. Nada chega ao aluno por ela: a habilidade da questão só vale quando o professor confere e aplica a atividade. O controle humano é a correção da coordenação, que vence, e a tarefa o respeita em dois pontos:
- **Na leitura:** a seção corrigida fica de fora (`isNull(corrigidaEm)`, linha 95).
- **Na gravação:** o `update` traz `s.corrigida_em is null` (linha 189), e há teste para a correção que chega entre a leitura e o agendamento (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/agendamento.int.test.ts:462`).

A exceção do tutor (D47) não aparece em nenhum outro agente.

Supervisão do tutor: ok. A tarefa não muda o tutor. Na carga, o Tutor da B só mede latência com alunos sintéticos, e a mudança em `infra/k6/ingestao.js` só deixa o ritmo dos turnos configurável.

Autonomia declarada e visível: sim. O nível 1 está no catálogo, `docs/agentes.md:79` traz o texto em português comum, e a tela de governança usa `textos-da-governanca.ts`. A suspensão da função pela escola funciona nos dois caminhos, cada um com teste:
- **Extração:** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/worker/src/processors/extrair-pdf.ts:557-562`, com o teste em `extrair-pdf.int.test.ts:1242`.
- **Rotina noturna:** a suspensão é lida a cada lote em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/worker/src/processors/agendar-classificacao.ts:307`, com os testes em `agendamento.int.test.ts:224` e `:244`.

Demais itens da regra 70:
- **Auditoria (item 6):** a execução fica registrada em `execucao_agente`, com função, tarefa e datas.
- **Supervisão sem vigilância (item 7):** nada mede comportamento nem emoção. A métrica `classificacao.execucoes_atrasadas` é só uma contagem por escola, sem execução, seção, material ou pessoa.
- **Discursiva e redação (item 8, D55):** nenhum campo, tela ou prompt envolve nota nessas modalidades.
- **Medir o professor (item 9, D45):** não há métrica de professor. O alerta e o runbook falam só de escola.

Bloqueantes: nenhum.

Recomendações:
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/docs/runbook.md`, causa 3 da entrada "Classificação do material atrasada": o texto sugere suspender a função pelo "comando D76 com chamado". Ao fechar a 7.0, conferir se o caminho da equipe Turmma deixa na auditoria da escola quem suspendeu e por quê. A tela de governança tem de continuar respondendo "quem desligou a IA e quando".
- A consulta "o que a IA gerou" para a classificação junta `execucao_agente` e a correção da coordenação. Vale um caso no teste de auditoria ou de governança que prove isso para uma seção agendada pela rotina, que não tem `solicitada_por`. É cobertura extra; a tarefa 4.0 já tratou da gravação.

## infra-guardian · 1ª rodada · REPROVADO · 2026-11-18 04:15:29 · `tasks/prd-classificacao-bncc/5_task.md`

VEREDITO: REPROVADO
Caminho quente tocado: fila | IA
Rate limit: ok (a tarefa não abre rota; o lote passa pela vaga da escola e pelo balde `lote`)
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: faltando
Degradação de IA: ok
Migration: não se aplica
Métrica e alerta: ok

Bloqueantes:

1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/material/classificacao-atrasada.repository.ts:19-27`. A consulta nova da medição do alerta não tem índice que a sirva e não veio com `EXPLAIN`.
   - **A tabela cresce com aluno.** `execucao_agente` ganha uma linha a cada `turno_do_tutor` e só é anonimizada, nunca apagada (`packages/core/drizzle/0026_anonimizacao.sql`).
   - **A consulta roda no horário de aula.** A `ClassificacaoGauge` a executa a cada 5 min, para cada escola, o dia inteiro, inclusive às 10h.
   - **O ramo `estado = 'falhou' and concluida_em in [fechouEm, abriuEm)` não tem índice.** O único índice parcial de estado, `execucao_agente_abertas_idx` (`packages/core/src/db/schema/execucao-agente.ts:87`), só cobre `pendente` e `rodando`. Os outros que começam por `escola_id` não filtram nem a função nem o estado. Como o `or` precisa dos dois ramos indexáveis, o plano cai em ler todas as linhas da escola, todos os turnos de Tutor acumulados no ano, 12 vezes por hora e por escola, junto com o pico do Tutor.
   - **O `EXPLAIN` registrado na tarefa é de outras consultas.** Ele cobre a cobertura e o join da busca, não esta.
   - **Correção exigida:**
     - Migration só de expansão com `CREATE INDEX CONCURRENTLY execucao_agente_classificacao_idx ON execucao_agente (escola_id, estado, concluida_em) WHERE tarefa = 'classificar_secoes'`, ou outro parcial equivalente que cubra os dois ramos (`falhou` por `concluida_em`, `pendente` por `criada_em`).
     - `EXPLAIN (ANALYZE)` da consulta com volume de Tutor semeado na mesma escola (centenas de milhares de `turno_do_tutor` e algumas `classificar_secoes`), mostrando que o plano usa o índice e não percorre os turnos.
     - Registro do resultado no `5_task.md`.

Recomendações:
- **O limite da noite zera na retentativa.** O `execucoesTotal` de `criarAgendamentoDaClassificacao` (`apps/worker/src/processors/agendar-classificacao.ts:91`) recomeça do zero quando o job é tentado de novo, e a `RETENTATIVA_DE_HOJE` faz até 5 tentativas. Uma falha no meio do laço (um `statement_timeout`, por exemplo) leva a escola a até cerca de 5.000 execuções na noite, e cai a frase "nunca passa de ~R$ 32". Melhor contar o que já foi criado desde o fecho da janela a partir de `execucao_agente` antes de calcular o `maximoDeExecucoes`.
- **O runbook diverge da medida.** A causa 2 de "Classificação do material atrasada" (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/docs/runbook.md`) ainda diz "~625 execuções, ~65 min". O medido em 18/11, já anotado em `docs/infra.md`, é 630 execuções e cerca de 2,4 h. Também vale conferir o "~625" e o "até ~7.500" da causa 3.
- **A medida do Tutor da B foi feita a 30 turnos por minuto.** O cenário da ingestão usa 90 (`infra/k6/ingestao.js`), e a carga reduziu o ritmo porque o adaptador falso dá a todo turno os ~31 mil tokens da classificação. Vale registrar no `TODO.md` refazer a fase do Tutor com o falso por perfil (cerca de 3 mil tokens no Tutor e 31 mil no lote) e 90 turnos por minuto, para medir o pior caso de verdade.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-18 04:15:48 · `tasks/prd-classificacao-bncc/5_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. As oito divergências da tabela do `5_task.md` já estão na `techspec.md` (§2, §5 "Agendar" (a), §7c) e no `cenarios.md` ("Seções e agendamento", "Alerta e métrica", "Carga"):
- o agendamento mora no `core`;
- a rotina e o job da escola rodam no `worker-lote`;
- o limite de 1.000 execuções por noite;
- o tipo `sistema.agendar-classificacao`;
- a métrica `classificacao.execucoes_atrasadas` com `ultimaNoite`;
- 630 execuções em vez de 625;
- o Tutor da B a 30 turnos por minuto;
- o `EXPLAIN` sobre a forma da consulta, com entrada no `TODO.md`.

Nada invade a 6.0 (os dois `PATCH` e o limpar) nem a 7.0 (reclassificar e D76). O `materialId` do filtro serve só à extração.
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum
Recomendações:
1. **Números do runbook contradizem a medição e o limite da própria tarefa.**
   - Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/docs/runbook.md:1003`, a causa 2 diz "~625 execuções, ~65 min". A carga mediu 630 execuções em ~2,4 h, e a `techspec.md` §7c e o `docs/infra.md` já foram corrigidos para esses números.
   - Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/docs/runbook.md:1005`, a causa 3 diz "até ~7.500 execuções numa noite". Com `EXECUCOES_POR_NOITE_DA_ESCOLA` (1.000), o job da escola não passa de 1.000 por noite, e o resto vai para as noites seguintes.
   - Quem opera vai ler esses números para diagnosticar, então vale alinhar.
2. **Comentário desatualizado.** O docblock de `EXECUCOES_POR_NOITE_DA_ESCOLA`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/material/agendamento-da-classificacao.repository.ts:19-20`, ainda fala em "~625 execuções" e "R$ 4 a R$ 20 por 625 execuções". O número medido é 630.
3. **Agrupamento só dentro de cada lote.** `proximasSecoes` ordena pelo id da seção, e `agendar` agrupa por recorte só dentro do lote de 500 (`agendamento-da-classificacao.repository.ts:110` e `:139-149`). Numa escola com muitos recortes, cada lote deixa uma execução parcial por recorte, e não uma só como no cenário da carga, que tinha um recorte único. Ordenar pelo material ou pelo recorte antes do id reduziria as execuções extras. Não é bug; é custo.
4. **Entrada do `TODO.md` com dono errado.** A entrada da 4.0 (`tenancy-guardian`, "Um teste do comando, pelo worker, que prove a recusa da seção de outra escola") aponta como dono "a tarefa que tocar o comando em seguida, a 5.0". A 5.0 não tocou o comando, então a entrada fica aberta e precisa de outro dono.
5. **"Provedor fora" na carga.** O teste da carga parou os `worker-ia` em vez de fazer o provedor recusar, então mostra que a fila retoma sozinha, mas não que os jobs adiam. O adiamento por `IA_INDISPONIVEL` vem da 4.0, e a troca está registrada no `cenarios.md`. Vale deixar isso explícito também na linha "carga" da tabela de testes do `5_task.md`, que ainda diz "adiam e retomam".

## test-engineer · 1ª rodada · REPROVADO · 2026-11-18 04:18:23 · `tasks/prd-classificacao-bncc/5_task.md`

**VEREDITO: REPROVADO**

**Cenários exigidos:** os 23 da tabela "Testes que provam a regra" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/5_task.md`. Entre eles, cinco eram obrigatórios para mim:
- **Caminho feliz:** 25 seções, mais execução e job.
- **Casos de borda:** seção herdada, falha de 12, quarta noite, `EXECUCAO_INTERROMPIDA` e o limite da noite.
- **Permissão:** a rotina só roda como rotina do sistema.
- **Isolamento:** a rotina da A não toca a B, também na medição e na extração.
- **Concorrência real:** P9 com duas transações intercaladas, a rotina duas vezes em `Promise.all` e dois jobs da extração em `Promise.all`.

**Cobertos:** todos, com teste citado pelo nome, menos os dois bloqueantes abaixo.
- Os três arquivos de integração passam aqui: `agendamento.int.test.ts` (30 casos), `classificacao-agendada.int.test.ts` (13 casos) e o bloco de extração da 5.0 em `extrair-pdf.int.test.ts` (8 casos).
- Não há `.skip`, `.only`, `any` nem mock da regra testada.
- A carga usa o adaptador falso, sem provedor pago.
- Os dois testes P9 são concorrência de verdade: duas transações abertas, com barreira.
- "As 11 zeram, a que falha chega a 3" está provado pela soma de duas coisas: a divisão em execuções de uma seção, aqui, e o contador da 4.0 (`classificacao.int.test.ts:793`).

**Bloqueantes:**

1. **O teste de isolamento do repository só funciona com o banco quase vazio.**
   - **Onde:** `apps/api/src/material/agendamento.int.test.ts:547-548`. O bloco de mutação que tira `eq(secaoDoMaterial.escolaId, escolaId)` cita este caso.
   - **Por que falha em provar:** `proximasSecoes(10)` ordena por id e para em 10. Sem a cláusula de escola, a leitura da A traz primeiro as seções elegíveis mais antigas de qualquer escola. Com 8 ou mais delas no banco, as seções da B (as mais novas) ficam de fora do limite, e `not.toContain(daB.secoes[0])` passa com a cláusula removida.
   - **O que eu medi:** contei, só lendo o banco do compose de teste, as seções elegíveis que os testes deixaram. Eram **8**. Depois de uma rodada do bloco da extração eram **12**: a `QueueFixtures` não apaga material, e os casos "função suspensa" e "outro material" deixam 4 seções elegíveis por rodada. Com 8 ou mais, essa mutação já não deixa o caso vermelho. O vermelho que o portão viu dependeu de o banco estar recém-limpo.
   - **E o caso de cima também não prova:** `agendamento.int.test.ts:210` ("a rotina da escola A não toca a seção da B") não distingue essa mutação. Quem joga fora a seção da B é a busca das séries, `#seriesDosMateriais`, e não o `where`.
   - **Correção exigida:** no contexto da A, ler `proximasSecoes(10, { materialId: daB.materialId })` e esperar `[]`, ou usar `depoisDe` com um id logo antes das seções da B. Assim o resultado não depende do que há no banco. Depois, apontar o bloco de mutação para esse caso.

2. **A tabela promete "um lote por transação", e nenhum teste prova isso.**
   - **Onde:** `apps/api/src/material/agendamento.int.test.ts:337-348`. O nome do caso diz "cada lote numa transação", mas ele só confere que todas as seções foram agendadas e que `lotesTotal` é 3.
   - **Por que falha em provar:** se `criarAgendamentoDaClassificacao` (`apps/worker/src/processors/agendar-classificacao.ts:94-122`) abrisse uma transação só em volta do laço inteiro, esse caso, o do sinal e o do limite continuariam verdes. A Tech Spec (§7c "Laços") pede uma transação por lote, e a tabela traz isso como item próprio.
   - **Correção exigida:** um caso em que o enfileirador do segundo lote faz uma de duas coisas:
     - (a) lê por outra conexão (`bancada.pool`) e confere que as 3 seções do primeiro lote já aparecem com `execucao_id`, ou seja, já foram gravadas;
     - (b) lança um erro, e o teste confere que as 3 do primeiro lote continuam com a execução e o job delas.

**Recomendações:**
- **O alerta depende do relógio de parede.** `infra/test/alerta-de-classificacao-atrasada.int.test.ts:32,79-80` calcula a noite com `new Date()`, e o worker do compose mede com o relógio dele, minutos depois (por causa do `--build`). Perto das 5h ou das 7h de um dia letivo, os dois veem noites diferentes. Além disso, o caso da escola com janela própria só distingue a janela dela da padrão se rodar entre 5h e 7h. A prova que não depende da hora é `classificacao-agendada.int.test.ts:212`, então vale corrigir o comentário da linha 83, que diz o contrário.
- **Suspensão entre lotes.** A autoconferência 4 diz que a suspensão é lida "a cada lote", mas nenhum caso suspende a função entre o primeiro e o segundo lote. Um caso assim garante isso.
- **`statement_timeout` sem teste.** O `set_config('statement_timeout', …)` de cada lote (`agendar-classificacao.ts:106`) não tem teste nem justificativa na lista "sem bloco".
- **Texto que promete mais que o código.** O comentário de `ultimaNoite` (`packages/core/src/queue/janela-letiva.ts:73-77`) diz que "feriado de dia da semana letivo alonga a noite", mas a `JanelaLetiva` não conhece feriado. Corrigir o texto, ou registrar o feriado no dia da abertura como caso conhecido.
- **Citação a acrescentar.** Na lista "Linha → caso", a linha "noite seguinte à falha de 12" deveria citar também `classificacao.int.test.ts` › "a saída inválida soma 1 nas doze seções…".
- **Classificada e sem habilidade.** Os dois estados dividem um caso só, o da execução `concluida`. Isso basta, porque a regra lê só o estado da execução, mas o texto da tabela pede "um caso cada".
- **Veredito da carga mudado depois da corrida.** O veredito passou de 625 para 630 depois da corrida e não foi corrido de novo. Os números medidos passam no veredito novo; fica registrado para a validação.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-18 04:46:13 · `tasks/prd-classificacao-bncc/5_task.md`

VEREDITO: APROVADO

Caminho quente tocado: fila | IA | migration

Rate limit: ok

Fila e prioridade: ok

Concorrência: protegida

Índice e paginação: ok

Degradação de IA: ok

Migration: compatível

Métrica e alerta: ok

Bloqueantes: nenhum. A correção exigida na 1ª rodada foi feita:
- **Índice.** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/drizzle/0064_indice_da_classificacao_atrasada.sql` cria `execucao_agente_classificacao_idx` em `(escola_id, estado, concluida_em)`, parcial em `funcao = 'classificacao_do_material'`. Esse é o mesmo predicado da consulta (`classificacao-atrasada.repository.ts:22`), então o índice serve aos dois ramos. No banco de teste, o plano real da consulta usa `execucao_agente_classificacao_idx` com `escola_id` como condição do índice, sem passar pelos turnos do Tutor.
- **Plano medido.** O `EXPLAIN (ANALYZE)` com 400 mil turnos de Tutor está registrado no `5_task.md`: `BitmapOr` em 0,075 ms e 5 buffers, contra o `Parallel Seq Scan` de 22 ms sem o índice.
- **Teste.** A definição do índice é guardada por teste (`classificacao-agendada.int.test.ts:136`).
- **Sem `CONCURRENTLY`.** O índice saiu sem `CONCURRENTLY`, e eu aceito porque o projeto já trata assim. O `migrar` roda em uma transação só, como na 0034 e na 0057. Hoje o dado é sintético, o `lock_timeout` é de 5 s e já existe no `TODO.md` (por volta das linhas 249-251) uma entrada que obriga índice com `concurrently` em toda migration a partir do staging.
- **Recomendações da 1ª rodada.** As três foram aplicadas: o limite da noite que zera na retentativa e o Tutor da B a 30 turnos por minuto estão no `TODO.md`, e o runbook traz 630 execuções, cerca de 2,4 h e o limite de 1.000.

Recomendações:
- Citar a 0064 nominalmente na entrada do `TODO.md` sobre índices sem `concurrently` antes do staging, junto da 0057. É ela que pesa ali, porque `execucao_agente` cresce a cada turno do Tutor. Ao refazer com volume real, considerar também o `statement_timeout` de 2 s do migrador.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/infra/test/alerta-de-classificacao-atrasada.int.test.ts:83`: o caso da janela própria depende do relógio de parede e só distingue as duas janelas entre 5h e 7h de um dia letivo. Isso já está documentado, e a prova que não depende da hora está no teste do worker. Vale fixar o relógio quando alguém tocar esse cenário.
- A antiga recomendação do limite da noite que zera na retentativa (até cerca de 5.000 execuções numa noite) continua aberta no `TODO.md` com prazo "antes do piloto". É o teto de custo da noite e não pode escorregar desse prazo.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-18 04:46:18 · `tasks/prd-classificacao-bncc/5_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum neste diff. A rodada 2 não toca `Nota` nem as tabelas de nota. Todos com autor humano: sim, sem mudança desde a 1ª rodada.
Decisão autônoma sobre aluno: ausente.
Aprovação registrada: ok. A classificação BNCC continua uma saída sobre o material da escola, não sobre o aluno, e o diff não muda o fluxo de aprovação nem de correção pela coordenação.
Supervisão do tutor: ok. O tutor só aparece no comentário do índice e na nota de carga do `TODO.md`, como volume em `execucao_agente`. Nada muda no que o professor vê.
Autonomia declarada e visível: sim. Nenhuma mudança em governança. A suspensão de `classificacao_do_material` continua sendo conferida a cada lote, e agora há um caso que prova isso: `apps/api/src/material/agendamento.int.test.ts`, "a função suspensa entre o primeiro e o segundo lote".

Escopo desta rodada: li o diff `22a2903c..58a7e8da`, sem o snapshot e sem a pasta `achados/`. Ele traz:
- **Migration e schema:** a migration `0064_indice_da_classificacao_atrasada.sql` e o índice parcial `execucao_agente_classificacao_idx` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/db/schema/execucao-agente.ts:89`.
- **Testes novos:** casos de transação por lote, suspensão, `statement_timeout` e isolamento em `agendamento.int.test.ts`; o teste que confere a definição do índice em `apps/worker/test/classificacao-agendada.int.test.ts`.
- **Comentários e documentos:** docblocks e comentários no repository de agendamento, em `janela-letiva.ts` e no teste do alerta; o runbook, o `TODO.md`, a Tech Spec, os `cenarios.md` e o `5_task.md`.

É mudança de desempenho, infra e teste. Nenhuma linha cria campo, tela ou prompt de nota em discursiva ou redação (D55). Também não há métrica nova por professor, inferência sobre comportamento do aluno nem caminho de escrita em `Nota`. O runbook (`docs/runbook.md`, a partir da linha 996) passa a dizer que a coluna `erro` guarda só o código. Isso reforça a auditoria e não tira nada dela.

Correções exigidas na 1ª rodada: nenhuma. As duas recomendações da 1ª rodada estão registradas:
- **Auditoria da seção agendada sem `solicitada_por`:** no `TODO.md`, com dono, e no `5_task.md`.
- **Auditoria da suspensão pelo comando D76:** no `5_task.md`, com dono na tarefa 7.0.

Bloqueantes: nenhum.

Recomendações:
- Continua aberta a recomendação da 1ª rodada: um caso em `packages/core/src/auditoria/auditoria.int.test.ts` ou em `apps/api/src/governanca/governanca.int.test.ts` que responda "o que a IA gerou, quem aprovou e quando" para uma execução da rotina das 19h, que não tem pessoa que a pediu. Já está no `TODO.md`, com dono.
- O item do `TODO.md` sobre o limite da noite que recomeça na retentativa (até cerca de 5.000 execuções) é custo e regra 80, não regra 70. Registro aqui só porque a suspensão da função é o freio que a coordenação vê: vale conferir na 7.0 que esse freio continua bastando antes do piloto.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-18 04:46:22 · `tasks/prd-classificacao-bncc/5_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova. `execucao_agente` só ganhou o índice parcial `execucao_agente_classificacao_idx (escola_id, estado, concluida_em) WHERE funcao = 'classificacao_do_material'`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/drizzle/0064_indice_da_classificacao_atrasada.sql` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/db/schema/execucao-agente.ts:89`. O índice começa por `escola_id`, nenhuma coluna mudou e o id continua UUID. A tabela segue com `escolaId`, e `anoLetivoId` continua `null` na execução da rotina, como foi aprovado na 1ª rodada.

Queries verificadas: as queries de `AgendamentoDaClassificacaoRepository` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/material/agendamento-da-classificacao.repository.ts`) não mudaram nesta rodada, só o comentário de documentação (docblock). Conferi de novo:
- `proximasSecoes` aplica `eq(secaoDoMaterial.escolaId, requireEscolaId())`.
- `#seriesDosMateriais`, `funcaoEstaAtiva`, o `update` cru e o `delete` em `#criarExecucao` levam a escola do contexto.
- Nenhum método recebe `escolaId`, nenhum endpoint novo foi criado e não há `@Unscoped()`.

O teste do índice no worker (`classificacao-agendada.int.test.ts:136`) lê `pg_indexes` e não toca dado de escola.

Teste de isolamento: presente e efetivo. O caso mudado (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/agendamento.int.test.ts:631`) chama `proximasSecoes(10, { materialId: daB.materialId })` no contexto da A e espera `[]`. Tirei a cláusula de escola mentalmente:
- Os joins com `material`, `disciplina` e `execucao_agente` e o `exists` em `material_serie` se amarram por `secaoDoMaterial.escolaId`, e não pela escola do contexto.
- Não há RLS nas migrations.
- O material da B é elegível: a mesma leitura no contexto da B devolve as duas seções.

Logo, sem a cláusula, a consulta devolveria as duas seções da B e o teste quebraria. Ficou mais forte que a versão da 1ª rodada, cujo resultado dependia do limite e da ordem por id. A mutação registrada no `5_task.md` aponta para este caso.

Bloqueantes: nenhum.

Recomendações:
- O `update` cru e o `delete` de `#criarExecucao` dependem só do comentário de documentação para manter o termo de escola. Um caso que chame `agendar` no contexto da A com as seções da B e confira que nenhuma linha da B foi trocada, mesmo sem a FK composta, protegeria esses dois pontos contra uma refatoração. Hoje a FK composta cobre a falta. Fica para a retro.
- O caso "falha da noite da janela própria" de `infra/test/alerta-de-classificacao-atrasada.int.test.ts` só diferencia a janela da escola da janela padrão entre 5h e 7h. O próprio comentário diz isso e aponta a prova que não depende do relógio. Não afeta o isolamento.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-18 04:46:36 · `tasks/prd-classificacao-bncc/5_task.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. A migration `0064_indice_da_classificacao_atrasada.sql` é uma divergência em relação ao plano da tarefa, que não previa migration. Ela está registrada nos três lugares exigidos: `techspec.md` §7c ("Alerta"), `cenarios.md` ("Alerta e métrica") e a tabela de divergências do `5_task.md`. Junto vêm o motivo, a exceção ao `concurrently` (a mesma da 0034 e da 0057) e o `EXPLAIN` antes e depois do índice. O índice declarado no schema bate com o SQL e com o snapshot. O teste novo em `classificacao-agendada.int.test.ts` confere que o índice existe e tem a definição esperada.

Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo).

Bloqueantes: nenhum.

O que esta rodada mudou:
- **Isolamento em `agendamento.int.test.ts`:** a leitura no contexto da A agora pede o material da B pelo filtro `materialId` e espera lista vazia. A prova não depende mais do limite nem da ordem por id. O bloco de mutação que tira `eq(secaoDoMaterial.escolaId, escolaId)` agora aponta para esse caso, e o comentário na linha 211 explica por que o outro caso não pega a remoção.
- **Quatro casos novos do laço:** um lote por transação, visto de outra conexão; o lote que falha desfaz só a si mesmo; a função suspensa entre dois lotes; o `statement_timeout` de 20 s. Os quatro têm bloco de mutação e entraram na tabela de testes do `5_task.md`.
- **Repository de agendamento:** mudaram só os docblocks. O aviso de que o termo de escola do `update` e do `delete` em `#criarExecucao` é defesa em profundidade é a forma certa de registrar o que nenhum teste distingue.
- **Comentário de `ultimaNoite` em `janela-letiva.ts`:** agora diz certo que feriado num dia letivo não alonga a noite.
- **Runbook:** atualizado para 630 execuções e para o teto de 1.000 por noite, com o aviso de que a coluna `erro` guarda só o código.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/5_task.md`: a divergência da 0064 cita `docs/infra.md` como lugar onde ficou registrada, mas esse documento não menciona a 0064 nem `execucao_agente_classificacao_idx`. Uma saída é tirar a referência; a outra é registrar o índice no trecho da classificação em `docs/infra.md`.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/cenarios.md:183`: falta o ponto entre "tirar cada termo do `where`" e "O índice parcial…", e as duas frases ficam coladas.
- O `TODO.md` ganhou a entrada do limite da noite que recomeça do zero na retentativa (até cerca de 5.000 execuções por escola numa noite), marcada para antes do piloto. Ela continua sendo o principal risco de custo deixado pela tarefa e precisa de dono definido antes do piloto, não só "a tarefa que tocar o agendamento".

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-18 04:46:36 · `tasks/prd-classificacao-bncc/5_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A única mudança de schema é a migration 0064, que só cria um índice parcial `execucao_agente_classificacao_idx` sobre `(escola_id, estado, concluida_em)`, restrito a `funcao = 'classificacao_do_material'`. Ela não cria nem altera coluna. São ids, estados e datas de execução, sem pessoa e sem conteúdo.

Fora da tabela de dados do docs/lgpd.md: nada. O índice não cria dado novo.

Autorização por objeto: ok. O único ponto do diff que toca isso é um caso de isolamento de `apps/api/src/material/agendamento.int.test.ts`. Ele agora pede `proximasSecoes(10, { materialId: daB.materialId })` no contexto da escola A e espera `[]`. Ficou mais forte que antes, porque não depende mais da ordem nem do limite. O novo docblock de `packages/core/src/material/agendamento-da-classificacao.repository.ts` também pede que não se tire o termo de escola do `update` e do `delete`.

Logs: limpos. O diff não adiciona nenhum log. O único que os testes novos conferem é `classificacao.agendada`, com `escolaId` e `estado`. O caso que já existia continua provando que o conteúdo da seção (`'sigilosa'`) não aparece no log. A consulta nova do `docs/runbook.md` lê só ids, estado, `erro`, datas e contagens. O texto acrescentado proíbe trocar `erro` por texto livre ou copiar para lá o que o modelo devolveu.

Auditoria: presente. O diff não tem nenhuma ação que exija auditoria pela regra 20, item 10. Os novos casos de "função suspensa entre lotes" fazem um insert sintético em `suspensao_de_funcao`, com `suspensa_por` e `motivo`. Falta um caso de auditoria para a execução da rotina sem `solicitada_por`. Esse item já está no `TODO.md` e é do conformidade-reviewer.

Envio externo: nada novo. O diff não muda prompt, gateway nem o que vai ao provedor. O que foi aprovado na 1ª rodada continua valendo: ids e versão do prompt, registrados em `ExecucaoAgente` e `consumo_ia`.

Seed/fixture: sintético. Os testes usam `escolaNova`, `materialNovo` e `bancada.sessoes`. O `EXPLAIN (ANALYZE)` registrado no `5_task.md` rodou sobre uma cópia do banco de teste com turnos sintéticos, não sobre um dump de produção.

Bloqueantes: nenhum.

Recomendações:
- Fechar a pendência da 4.0 que já está no `TODO.md`, com dono na 9.0: anotar em `docs/lgpd.md`, na linha de `consumo_ia`, que `classificar_secoes` guarda só ids e versão do prompt. O índice novo aumenta a consulta por execução da classificação, e o mapa de dados deve dizer o que essas linhas contêm.
- No `docs/runbook.md`, a consulta de "Primeiro olhar" lê `execucao_agente` com o `escola_id` da escola. Vale uma linha lembrando que esse acesso vem de chamado e fica registrado (D76), como já acontece nos outros comandos do runbook que tocam dado de escola.

Pergunta de fechamento: a resposta é a mesma da 1ª rodada. A rodada não muda o que se guarda sobre o aluno nem para onde vai. A execução da rotina não tem pessoa e guarda só ids de seção, e o arquivo do titular segue como foi aprovado.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/drizzle/0064_indice_da_classificacao_atrasada.sql
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/db/schema/execucao-agente.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/material/agendamento-da-classificacao.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/agendamento.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/worker/test/classificacao-agendada.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/docs/runbook.md

## test-engineer · 2ª rodada · APROVADO · 2026-11-18 04:46:45 · `tasks/prd-classificacao-bncc/5_task.md`

VEREDITO: APROVADO

**Cenários exigidos:** as duas correções da 1ª rodada, que são:
1. Isolamento da leitura que não depende de quanto há no banco.
2. Uma transação por lote, provada.

Também conferi as recomendações da rodada anterior e o que o diff desde `22a2903c` alcança: o caso da função suspensa entre lotes, o caso do `statement_timeout`, o índice da 0064 e a tabela "Linha → caso".

**Cobertos:**
- **Correção 1, feita.** O caso em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/agendamento.int.test.ts:631`, no contexto da A, agora lê `proximasSecoes(10, { materialId: daB.materialId })` e espera `[]`.
  - Sem o `eq(secaoDoMaterial.escolaId, escolaId)` (repository, linha 97), o join com `material` casa a escola pela própria seção. O filtro de material então traz as seções da B, e o caso fica vermelho seja qual for o conteúdo do banco.
  - Com o banco sujo, a linha 625 (`lidasDaB` igual às seções da B) também ficaria vermelha pelo mesmo motivo.
  - O bloco de mutação foi reapontado para "as seções da B não aparecem nas próximas da A".
  - O comentário nas linhas 211-212 explica por que o caso "a rotina da escola A não toca a seção da B" não prova o `where`.
  - Rodei o arquivo sobre o banco do compose, que já tinha sobras de outras rodadas: 34 de 34 verdes.
- **Correção 2, feita nas duas formas pedidas.**
  - (a), na linha 353: quando o segundo lote enfileira, uma conexão separada (`bancada.pool`) já vê as 3 seções do primeiro lote com `execucao_id`. Com uma transação só em volta do laço, ela veria 0.
  - (b), na linha 371: quando o segundo lote lança erro, ficam 3 seções agendadas, 1 job e 1 execução. Com uma transação só, o erro desfaria tudo.
  - Há um bloco de mutação que embrulha o laço numa transação única e cita o caso (a).
- **Recomendações da 1ª rodada, todas aplicadas:**
  - comentário da linha 83 do teste do alerta (dependência do relógio de parede, com a prova independente apontada);
  - docblock de `ultimaNoite` (feriado em dia letivo não alonga a noite);
  - a tabela "Linha → caso" agora cita a seção corrigida pela leitura, o caso da 4.0 para a falha de 12 e os casos novos do laço;
  - caso da suspensão entre lotes (linha 392), que insere a suspensão por outra conexão durante o primeiro lote, com bloco `cursor === undefined && …`;
  - o `statement_timeout` saiu do "sem bloco" e ganhou caso (linha 416, `current_setting` lido dentro da transação do lote) e bloco próprios.
- **Índice da 0064.** `classificacao-agendada.int.test.ts` › "a consulta da medição tem o índice parcial" confere colunas e predicado em `pg_indexes`. A ausência de bloco para o SQL da migration está justificada, e o `EXPLAIN` foi registrado no `5_task.md`. Rodei o arquivo: 14 de 14 verdes.
- **Proibidos:** nenhum `.skip`, teste comentado ou mock que esconda a regra. Os espiões envolvem o `JobOutbox` real, e nenhum teste chama provedor.

**Bloqueantes:** nenhum.

**Recomendações:**
- `agendamento.int.test.ts:416`: o caso "cada lote corre com o `statement_timeout` de 20 s" cobre um lote só (2 seções, com o lote padrão de 500). Usar `lote: 1` com 2 seções e guardar o valor das duas chamadas prova o "cada" do nome.
- `TODO.md`: a nova entrada do `infra-guardian` sobre o limite da noite que recomeça na retentativa (`execucoesTotal` local ao job) é o cenário "job executado duas vezes" da regra 80. Vale cobrar na Validação que ela feche antes do piloto, como a própria entrada diz.
