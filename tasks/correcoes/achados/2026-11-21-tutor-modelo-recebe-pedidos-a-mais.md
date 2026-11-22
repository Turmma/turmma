# Achados das revisões — `tasks/correcoes/2026-11-21-tutor-modelo-recebe-pedidos-a-mais.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-21 10:39:33 · `tasks/correcoes/2026-11-21-tutor-modelo-recebe-pedidos-a-mais.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova e nenhuma migration. A mudança fica toda no harness de teste: `apps/api/test/fila-de-ia.fixture.ts` e o teste novo `apps/api/test/fila-de-ia-sem-heranca.int.test.ts`.

Queries verificadas:
- `FilaDeIa.subir` (`fila-de-ia.fixture.ts:184`) apaga de `job_registro` os jobs de IA não terminados de todas as escolas, sem filtro de escola. Não é bloqueante. É SQL cru do harness, roda contra o banco de teste e nenhum código de `apps/*/src` ou `packages/` o importa. Fora de teste, `worker-de-ia.ts:174` e `montar-comandos.ts:24` só citam o fixture em comentário. Não é repository, então a exigência de `@Unscoped()` não se aplica.
- Teste novo, linhas 25-27: `estadoDa` e `jobDa` leem por id de execução, só para conferir o resultado.
- Teste novo, linha 42 (`afterAll`): a limpeza filtra por `escola_id`.
- Nenhum repository, endpoint ou DTO foi alterado. Não há `escolaId` vindo do cliente, a resposta 404/403 não muda, nenhum id novo foi criado fora de UUID e a camada de rede não é tocada.

Teste de isolamento: não se aplica. A tarefa não muda escopo de tenant, e o teste novo prova que a fila de um arquivo não passa para o seguinte, não o isolamento entre escolas. Para o que ele prova, é efetivo: as duas mutações descritas na tarefa quebram os dois casos, e o primeiro caso tem controle de que a bancada está viva e consumindo (`fila-de-ia-sem-heranca.int.test.ts:55-57`).

Bloqueantes: nenhum

Recomendações:
- No comentário de `fila-de-ia.fixture.ts:181-183`, registrar que o delete entre escolas só é aceitável porque é limpeza de harness no banco de teste. Assim ninguém copia a linha para um repository ou para uma rotina de `apps/worker/src` sem `@Unscoped()` e sem justificativa.
- O trecho "rodaria no worker dela, contra o modelo dela" mostra o efeito colateral do despachante, que reserva job de qualquer escola (`DISPONIVEL_PARA_RESERVA`). Isso é desenho previsto do worker, não vazamento, mas vale anotar na retro: o processador sempre roda o job no contexto da escola que está na própria linha, e é isso que garante o isolamento nesse caminho.

## llm-integrator · 1ª rodada · APROVADO · 2026-11-21 10:39:35 · `tasks/correcoes/2026-11-21-tutor-modelo-recebe-pedidos-a-mais.md`

VEREDITO: APROVADO
Perfis usados: nenhum. A correção só mexe em fixture e teste de integração. Nenhum prompt é criado e nenhuma chamada de modelo muda. O teste novo usa o modelo falso local (`startFakeModel`), então nenhum provedor pago é chamado.
Custo estimado por professor/mês: não se aplica. A tarefa não adiciona chamada de modelo. Ela só impede que a bancada de teste execute jobs de IA que outro arquivo deixou na fila.
Prompt versionado: não se aplica (nenhum prompt foi tocado)
Validação de schema: não se aplica (nenhuma saída de modelo nova)
Aprovação humana no caminho: não se aplica

Bloqueantes: nenhum.

O que conferi:
- **Causa e escopo.** A correção está em `apps/api/test/fila-de-ia.fixture.ts` (`FilaDeIa.subir`) e não toca `packages/` nem `apps/*/src`. `ia.executar` e `ia.executar-lote` são os únicos tipos de job de IA no código de produção; `ia.degradacao` não é tipo de job. A lista `TIPOS_DE_JOB_DE_IA` está completa.
- **Quando apaga.** A limpeza só apaga job `ia.*` ainda não terminado (`aguardando` ou em andamento), e só quando nenhuma bancada do arquivo está de pé (`#vivas === 0`). Ela roda antes de `ligar()` e antes de o teste gravar qualquer job.
- **Contador de bancadas.** `#fechada` faz o `fechar()` baixar o contador uma única vez, e o `fechar` é idempotente.
- **Outros arquivos que usam `FilaDeIa.subir`.** Nenhum agenda job antes de subir a bancada. Os que usam `semConsumir` criam o job depois do `subir`, em `describe` com bancada nova. `fila-de-ia.int.test.ts:725` e `:773` sobem uma réplica com outra bancada de pé; `#vivas > 0` impede a limpeza nesse caso. Esse limite é o que o segundo teste cobre.
- **Mutações.** As duas mutações declaradas atacam exatamente a linha nova: remover a limpeza, e tirar a condição `#vivas === 0`. Cada uma tem seu caso, e o primeiro é o controle de que a bancada seguinte está viva (a execução nova conclui).
- **Teste sem provedor pago.** Usa modelo falso, e o `afterAll` limpa os jobs da escola criada. O `esperar(2_000)` é uma espera fixa. Ela só vale como prova negativa e não torna o teste instável.
- **Regras 10 e 20.** Não há DTO, tabela, dado pessoal nem log novos. O `delete` roda só em fixture de teste, em banco de teste. O `tenancy-guardian` e o `privacy-guardian` não encontram o que cobrar.

Recomendações:
- A limpeza apaga job `ia.*` de qualquer escola, o que é legítimo no banco de teste. Um comentário curto no fixture dizendo que isso vale só porque o banco de teste é compartilhado (e que `@Unscoped` não se aplica) evitaria dúvida na leitura.
- Esta correção só tira da fila o job de IA que sobra de outro arquivo. A causa de origem fica de fora: `extrair-pdf.int.test.ts` continua deixando `ia.executar-lote` `aguardando`. Se aparecer outro consumidor desse lote, vale limpar também no fim daquele arquivo, o que é o que `classificacao-da-coordenacao` já faz.
- O mesmo `ia.executar-lote` herdado pode ter aparecido em testes de outros consumidores além de `FilaDeIa`. Vale uma conferência na próxima esteira.

Arquivos relevantes:
- `apps/api/test/fila-de-ia.fixture.ts`
- `apps/api/test/fila-de-ia-sem-heranca.int.test.ts`
- `tasks/correcoes/2026-11-21-tutor-modelo-recebe-pedidos-a-mais.md`

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-21 10:39:35 · `tasks/correcoes/2026-11-21-tutor-modelo-recebe-pedidos-a-mais.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A mudança fica toda em `apps/api/test/`. O fixture passa a apagar linhas de `job_registro` dos tipos `ia.executar` e `ia.executar-lote` que ainda não terminaram. O teste novo grava só mensagens sintéticas de tutor, como "não entendi o que é reagente limitante", sobre escola e aluno criados pelo próprio fixture.

Fora da tabela de dados do docs/lgpd.md: nada. A tarefa não tem migration nem campo novo, e não mexe em `packages/` nem em `apps/*/src`.

Autorização por objeto: não se aplica. A tarefa não cria nem altera rota, repository ou DTO.

Logs: limpos. O teste novo não loga nada. O fixture continua com o logger de antes (`InMemoryLog` ou `linhasDeLog`) e a tarefa não acrescenta nenhuma linha de log.

Auditoria: não se aplica. A tarefa não tem nenhuma das ações que a regra 20, item 10, obriga a auditar. O `delete` em `job_registro` (`apps/api/test/fila-de-ia.fixture.ts:184`) acontece só no banco de teste e deixa `execucao_agente` intacto. A execução órfã continua `pendente` e consultável, e o teste depende disso.

Envio externo: nenhum. Os pedidos vão ao modelo falso local (`startFakeModel` com `fakeModelEnv`). A correção, aliás, diminui o que chega ao modelo de teste: o modelo de um arquivo deixa de receber jobs que outro arquivo deixou na fila. O `ExecucaoAgente` não muda.

Seed/fixture: sintético. Escola, aluno e atividade saem de `montarEscolaComAssistente` e `aplicarAtividade`, e o `afterAll` apaga os jobs da escola criada no teste.

Bloqueantes: nenhum.

Recomendações:
- `apps/api/test/fila-de-ia.fixture.ts:118`: o contador `static #vivas` só funciona porque o Vitest dá a cada arquivo de teste uma cópia nova dos módulos. `vitest.config.ts` não muda essa configuração, então hoje vale o padrão, que isola. Se alguém um dia desligar esse isolamento, um arquivo que esqueça de chamar `fechar()` deixa o contador acima de zero e a limpeza para sem avisar. Vale uma linha de comentário ali dizendo dessa dependência. Não afeta privacidade.
- O `delete` da linha 184 apaga jobs de qualquer escola. No banco de teste isso é o que se quer, mas o fixture não confere que está mesmo no banco de teste. Se `configuracaoDoBanco` ainda não recusa um banco que não seja o de teste, vale pôr essa trava no helper, para que um fixture de teste nunca possa apagar `job_registro` de outro ambiente.

Pergunta de fechamento: a resposta não muda. A tarefa não toca o arquivo do titular (`arquivo-do-titular`), o `ExecucaoAgente` nem o registro de envio. O que o sistema guarda sobre um aluno e para onde foi continua respondido pelo mesmo código de antes.

Arquivos auditados:
- apps/api/test/fila-de-ia.fixture.ts
- apps/api/test/fila-de-ia-sem-heranca.int.test.ts
- tasks/correcoes/2026-11-21-tutor-modelo-recebe-pedidos-a-mais.md

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-21 10:39:42 · `tasks/correcoes/2026-11-21-tutor-modelo-recebe-pedidos-a-mais.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. O diff só mexe em teste (`apps/api/test/fila-de-ia.fixture.ts`, mais o teste novo `apps/api/test/fila-de-ia-sem-heranca.int.test.ts`). Ele não toca `Nota`, `apps/*/src` nem `packages/` — todos com autor humano? sim (nenhum caminho novo)
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok (o fluxo de entrega e artefato não mudou; o fixture só apaga job de IA herdado antes de ligar o consumo)
Supervisão do tutor: ok. O teste do `tutor-modelo` continua esperando 2 pedidos ao modelo, e o teste de supervisão (`apps/api/src/tutor/tutor.int.test.ts`) segue igual.
Autonomia declarada e visível: sim (sem alteração)
Bloqueantes: nenhum

O que conferi, da regra 70:
- O `delete` em `job_registro` roda no `FilaDeIa.subir`, antes de o teste gravar qualquer job, e só quando não há outra bancada de pé no arquivo. Por isso nenhum teste que prova a regra 70 passa a passar sem provar nada:
  - `entrega`, `artefato`, `tutor`, `governanca`, `assistente` e `analista` sobem a bancada no `beforeAll` e criam os jobs depois dela.
  - Os arquivos com vários `describe` (`classificacao`, `execucao-interrompida`, `sem-resposta`) também montam o que precisam depois do `subir`.
  - Nenhum caso dessas suítes conta com job deixado por um `describe` anterior.
- O teste novo prova as duas coisas, e as mutações declaradas acompanham. Primeiro, o job que ficou de outra bancada não roda; o controle é o pedido novo concluído e o modelo recebendo um pedido só. Segundo, a segunda bancada do mesmo arquivo não apaga o job da primeira.
- Não aparece campo, saída ou prompt novo que leve nota a discursiva ou redação (D55), nem dado sobre o comportamento do aluno ou indicador de professor.

Recomendações:
- O job apagado deixa a `execucao_agente` dele em `pendente` para sempre no banco de teste. Hoje nenhum teste conta pendentes sem filtrar pela escola que criou. Vale registrar esse fato no comentário do fixture, para quem um dia contar execuções pendentes sem esse filtro.
- O contador `static #vivas` só zera entre arquivos porque o vitest isola os módulos por arquivo (padrão atual, e o `vitest.config.ts` não muda isso). Uma linha no comentário dizendo que ele depende desse isolamento evitaria surpresa se alguém ligar `isolate: false`.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-21 10:40:05 · `tasks/correcoes/2026-11-21-tutor-modelo-recebe-pedidos-a-mais.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. A correção só mexe na bancada de teste: `packages/` e `apps/*/src` ficam como estavam, e o `2` do `tutor-modelo` não muda.
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

O que conferi:
- **Arquivos que sobem a bancada mais de uma vez.** `classificacao`, `corte-da-espera`, `execucao-interrompida`, `sem-resposta` e `fila-de-ia` sobem cada bancada no `beforeAll` de um `describe` e a fecham no `afterAll` do mesmo `describe`. Quando o `describe` seguinte sobe a dele e apaga o que ficou na fila, nenhum caso perde um job de que precisava.
- **Réplica no meio de um caso.** É o que `fila-de-ia.int.test.ts` faz, e o contador `#vivas` impede essa réplica de apagar o job da primeira bancada. O segundo caso do teste novo prova isso.
- **Fechar duas vezes.** O `#fechada` impede que o contador baixe duas vezes quando `fechar()` é chamado de novo, como no `afterAll` do teste novo.
- **Contador entre arquivos.** O `#vivas` é estático, e o Vitest carrega os módulos de novo a cada arquivo. Ele volta a zero no arquivo seguinte, então uma bancada que um arquivo esqueceu aberta não trava a limpeza do próximo.

Recomendações:
1. `apps/api/test/fila-de-ia.fixture.ts:383`: o `ociosa()` repete os dois tipos de job à mão em vez de usar a `TIPOS_DE_JOB_DE_IA` criada na linha 99. O `afterAll` de `fila-de-ia-sem-heranca.int.test.ts` repete também. Usar a constante nos dois lugares evita que um tipo novo de job de IA entre num lugar e fique fora do outro.
2. `tasks/correcoes/2026-11-21-tutor-modelo-recebe-pedidos-a-mais.md`: o documento prova a correção só com o teste novo. Ele não registra que a falha original foi rodada de novo e passou: os dez arquivos que vêm antes do `tutor-modelo` na fatia 1/3, na ordem da esteira. Vale uma linha dizendo que essa sequência ficou verde depois da correção, já que é ela o sintoma que abriu a tarefa.
3. `apps/api/test/fila-de-ia-sem-heranca.int.test.ts`: a espera fixa de 2 s (`esperar(2_000)`) é aceitável, porque provar que algo não rodou pede alguma espera. Mesmo assim, ela entra em toda integração. Se o despachante tiver um sinal de "rodada de publicação feita", esperar por ele seria mais curto e daria a mesma certeza.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-21 10:40:20 · `tasks/correcoes/2026-11-21-tutor-modelo-recebe-pedidos-a-mais.md`

VEREDITO: APROVADO

Caminho quente tocado: nenhum. A tarefa muda só a bancada de teste (`apps/api/test/fila-de-ia.fixture.ts`) e acrescenta um teste de integração. `packages/` e `apps/*/src` ficam intactos.

Rate limit: ok. Não se aplica, nenhum limite foi mexido.

Fila e prioridade: ok. Despachante, filas e vagas por escola não mudam. A limpeza roda dentro de `subir`, antes de `ligar()`, e é em `ligar()` que o despachante começa a publicar. O prefixo do Redis é novo a cada bancada, então nenhuma cópia antiga de job no Redis chega ao worker novo.

Concorrência: protegida. O contador `#vivas` só tem sentido porque os testes rodam um arquivo por vez (`fileParallelism: false`) e cada arquivo carrega os módulos do zero. A réplica aberta no meio de um caso (`fila-de-ia.int.test.ts:725`) encontra `#vivas` igual a 1 e não apaga o job da primeira bancada, o que o segundo caso do teste novo prova. Nos arquivos com mais de uma bancada, cada `describe` sobe a sua bancada antes de gravar job. Conferi isso no `classificacao`, no `sem-resposta`, no `corte-da-espera`, no `execucao-interrompida` e no `fila-de-ia`.

Índice e paginação: ok. Não há query nova em produção. O `delete` por `tipo` é só da bancada.

Degradação de IA: não se aplica.

Migration: não se aplica.

Métrica e alerta: ok. Não se aplica, nada novo no caminho quente.

Bloqueantes: nenhum.

Recomendações:
- O primeiro caso de `apps/api/test/fila-de-ia-sem-heranca.int.test.ts` prova que o job órfão não rodou com uma espera fixa (`esperar(2_000)`), apoiada no controle do pedido novo. O controle torna a espera aceitável, mas trocar o sono por uma condição observável, como o despachante já ter feito uma volta depois do pedido novo, deixaria a prova menos dependente da velocidade da máquina.
- `#vivas` depende de cada arquivo carregar os módulos do zero, que é o padrão do Vitest (`isolate`). Vale uma linha no comentário de `apps/api/test/fila-de-ia.fixture.ts` dizendo isso, para que ninguém ligue `isolate: false` no projeto `integracao` sem perceber que o contador passaria de um arquivo para o outro.
- Não rodei a integração. Há um compose de teste de pé (`educa-teste-2-*`) que pode ser de outra sessão, e não quis disputar o banco com ela. A auditoria foi feita lendo o código. A prova verde fica com a esteira, que deve rodar a fatia 1/3 completa, com o `tutor-modelo` na ordem de sempre.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-21 10:41:08 · `tasks/correcoes/2026-11-21-tutor-modelo-recebe-pedidos-a-mais.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
1. Caminho feliz: a bancada nova consome o job que nasce depois que ela sobe.
2. A bancada não executa o job `ia.executar` que outro arquivo deixou `aguardando`.
3. A bancada não executa o job `ia.executar-lote` que a extração do PDF deixou `aguardando`. Foi este que derrubou o `tutor-modelo`.
4. A réplica que sobe no meio de um caso, com a primeira bancada ainda de pé, não apaga o job da primeira.
5. Chamar `fechar` duas vezes não deixa o contador `#vivas` negativo.
6. Os arquivos que já usam `FilaDeIa.subir` não gravam job antes da limpeza.
7. Permissão e isolamento entre escolas: não se aplicam. A mudança é só de bancada de teste e não toca código de produção nem escopo de escola.
8. Concorrência: não se aplica. A integração roda um arquivo por vez (`fileParallelism: false`).

**Cobertos:**
- Cenários 1 e 2, no caso `o job que ficou aguardando antes da bancada não roda nela...` (`fila-de-ia-sem-heranca.int.test.ts:46`). Tem controle positivo (o pedido novo termina `concluida`) e duas checagens de resultado: o órfão continua `pendente` e o modelo falso recebe só 1 pedido.
- Cenário 4, no segundo caso (`:67`). A mutação que tira o `if (#vivas === 0)` deixa esse caso vermelho de forma determinística.
- Cenário 5: o `#fechada` impede a segunda baixa, e o `afterAll` do teste chama `fechar` de novo sobre a bancada `deixou`.
- Cenário 6: conferi os 26 pontos que chamam `FilaDeIa.subir`. Em todos, o job é gravado depois do `subir`. Os arquivos com várias bancadas (`classificacao`, `fila-de-ia`, `sem-resposta`) fecham cada uma no `afterAll` do seu `describe`. A única réplica com outra bancada de pé é a do caso testado.
- Rodei o arquivo novo: 2 de 2 passaram. Nenhum `.skip`. O modelo é o falso (`startFakeModel`), sem provedor pago.

**Bloqueantes:**
- `apps/api/test/fila-de-ia.fixture.ts:99` (`TIPOS_DE_JOB_DE_IA`) e `apps/api/test/fila-de-ia-sem-heranca.int.test.ts:46-65`.
  - **O que está errado:** a causa que o documento descreve é o job `ia.executar-lote` que a extração do PDF deixa na fila (17 jobs do lote). Mas o teste que "reproduz" só deixa um órfão `ia.executar`, a mensagem do Tutor. Se alguém tirar `'ia.executar-lote'` da lista, os dois casos continuam verdes e o `tutor-modelo` volta a contar 17 pedidos. A parte da regra que corrige a falha de fato não tem teste que a prove, e nenhum bloco `mutacao` a alcança. O `--faltando` deu 0 só porque a pasta `test/` fica fora dele.
  - **Correção exigida:** no primeiro caso, deixar também um órfão `ia.executar-lote` antes da bancada seguinte subir. Pode ser uma execução da rotina de classificação, enfileirada na fila `lote` pelo outbox, como faz o `enfileirar` de `classificacao.int.test.ts:96`. Depois, conferir que ela não termina e que o modelo não a recebe. E acrescentar ao documento o bloco de mutação que tira `'ia.executar-lote'` de `TIPOS_DE_JOB_DE_IA`, com esse caso vermelho.

**Recomendações:**
- `fila-de-ia-sem-heranca.int.test.ts:59`: o `esperar(2_000)` só pesa com a mutação aplicada. Sem a limpeza, o vermelho depende de o despachante alcançar o órfão em 2 s, o que pode falhar numa máquina carregada. Um teste determinístico seria conferir, logo depois do `subir`, que a linha do órfão sumiu de `job_registro` (`jobDa(orfao)` igual a `[]`), mantendo as checagens de resultado que já existem.
- `fila-de-ia-sem-heranca.int.test.ts:42`: o `afterAll` apaga só os jobs de `job_registro`. As linhas de `execucao_agente` da escola `a` ficam no banco, e o órfão fica `pendente` sem job, que é justamente o que a varredura de outro arquivo trata. Vale apagar também `execucao_agente` e `consumo_ia` da escola, como faz `classificacao.int.test.ts:172-174`.
- Nenhum teste cobre o filtro `estado not in ('concluido', 'falhou')`: a mutação que o tira continuaria verde. O dano é pequeno (apagaria histórico de outro arquivo), mas fica o registro.
- `fila-de-ia.fixture.ts:119`: o `static #vivas` só zera por arquivo porque o Vitest isola os módulos de cada arquivo (o padrão `isolate: true`). Uma linha no comentário dizendo isso evita que alguém o quebre ao ligar `isolate: false`.

Arquivos auditados:
- `apps/api/test/fila-de-ia.fixture.ts`
- `apps/api/test/fila-de-ia-sem-heranca.int.test.ts`
- `tasks/correcoes/2026-11-21-tutor-modelo-recebe-pedidos-a-mais.md`

## revisor-geral · 2ª rodada · APROVADO · 2026-11-21 11:37:54 · `tasks/correcoes/2026-11-21-tutor-modelo-recebe-pedidos-a-mais.md`

VEREDITO: APROVADO

Escopo: respeitado. A mudança fica em teste, fixture, no documento da correção, no índice de achados e no TODO.md. `git diff HEAD -- packages apps/*/src` vem vazio.

Aderência à Tech Spec: ok. É uma correção de harness de teste e não toca a arquitetura.

Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)").

Bloqueantes: nenhum.

As três correções que a 1ª rodada exigiu foram feitas:
1. **Lista única de tipos.** `TIPOS_DE_JOB_DE_IA` está exportada e é usada no `ociosa()` (`apps/api/test/fila-de-ia.fixture.ts`, perto da linha 390) e no `afterAll` (`apps/api/test/fila-de-ia-sem-heranca.int.test.ts:58`). O `jobDa` continua com os tipos escritos à mão, e de propósito: o comentário na linha 29 explica que o teste que confere a lista não pode ler dela. Isso está certo, porque é o que faz a segunda mutação ficar vermelha.
2. **Fatia 1/3 verde.** O documento registra que a sequência ficou verde depois da rodada 1: 12 arquivos, 373 casos, mais os sete arquivos da bancada rodados isolados.
3. **Fim do `esperar(2_000)`.** Saiu. No lugar dele, `jobDa(...)` é conferido igual a `[]` logo depois do `subir` (linhas 76 e 77). Isso não depende do tempo de máquina.

O que a test-engineer exigiu também está feito. `deixarOLote` grava o órfão `ia.executar-lote` na fila `lote` pelo outbox, e o documento ganhou um bloco de mutação que reduz `TIPOS_DE_JOB_DE_IA` a `['ia.executar']`. Esse bloco falha em `jobDa(lote)` igual a `[]`, então o órfão do lote está coberto. O `afterAll` agora apaga também `mensagem_tutor`, `consumo_ia` e `execucao_agente`, filtrando pela escola do teste.

Recomendações:
- `apps/api/test/fila-de-ia-sem-heranca.int.test.ts:32`: o comentário cita `classificacao.int.test.ts` sem caminho, e quem procura em `apps/api/test/` não acha. O arquivo fica em `apps/api/src/material/classificacao.int.test.ts`. Escrever o caminho inteiro.
- `apps/api/test/fila-de-ia-sem-heranca.int.test.ts:38`: `rows[0]?.id ?? ''` deixa passar uma string vazia se o `insert` não devolver linha, e o erro só aparece depois, numa asserção que não aponta a causa. Melhor lançar erro ali mesmo, ou conferir o `id` antes de seguir.
- O comentário novo do `delete` sem escopo, no `fila-de-ia.fixture.ts` (perto da linha 188), tem três linhas longas, e o aviso de não copiar a linha para repository fica no meio do texto. Dá para enxugar e deixar o aviso numa frase própria.

## test-engineer · 2ª rodada · APROVADO · 2026-11-21 11:38:21 · `tasks/correcoes/2026-11-21-tutor-modelo-recebe-pedidos-a-mais.md`

VEREDITO: APROVADO

Cenários exigidos:
- Caminho feliz: depois que a bancada seguinte sobe, um pedido novo roda até `concluida` e o modelo falso recebe só esse pedido.
- O job `ia.executar` deixado na fila por outro arquivo (a mensagem do Tutor) não roda na bancada seguinte.
- O job `ia.executar-lote` deixado na fila pela extração do PDF ou pela rotina das 19h não roda na bancada seguinte. É a causa real dos 17 pedidos.
- Limite da correção: quando uma segunda bancada sobe no mesmo arquivo com a primeira ainda de pé, ela não apaga o job que a primeira gravou. É a réplica de `fila-de-ia.int.test.ts`.
- Controle: a bancada seguinte está viva e consome. Sem isso, "o órfão não rodou" passaria também numa bancada parada.
- O teste não depende do tempo da máquina: a conferência é feita logo que o `subir` retorna, sem espera fixa.
- Permissão e isolamento entre escolas não se aplicam como cenário de produto. É código de harness, e o `delete` sem escopo de escola está justificado no comentário de `fila-de-ia.fixture.ts:188-190`.

Cobertos:
- **Correção exigida na rodada 1, feita.** `fila-de-ia-sem-heranca.int.test.ts:68` deixa um órfão `ia.executar-lote` na fila `lote`. Ele é gravado pelo outbox (`enfileirarUmaVez`, `TIPO_EXECUTAR_LOTE`, que vale `'ia.executar-lote'` em `packages/shared/src/system/job-definitions.ts:30`), do mesmo jeito que a rotina grava. O teste confere `['aguardando']` antes, `[]` logo depois do `subir` (linha 77) e `pendente` no fim (linha 84).
- **O bloco de mutação novo alcança a cláusula.** Com `TIPOS_DE_JOB_DE_IA = ['ia.executar']`, a linha 76 continua verde e o vermelho cai na linha 77 (`expect(await jobDa(lote)).toEqual([])`), que é o motivo certo.
- **O teste não lê da lista que ele mesmo confere.** O `jobDa` (linha 31) escreve os dois tipos no próprio texto e não usa `TIPOS_DE_JOB_DE_IA`. Se lesse da lista, a mutação acima não daria vermelho.
- **Os outros dois blocos seguem certos.** Tirar o `delete` deixa a linha 76 vermelha. Tirar a condição `#vivas === 0` deixa a linha 98 vermelha, no segundo caso.
- **Recomendações da rodada 1, aplicadas:**
  - O `esperar(2_000)` saiu e a conferência é feita na volta do `subir` (linhas 76-77).
  - O `afterAll` agora apaga também `mensagem_tutor`, `consumo_ia` e `execucao_agente` da escola (linhas 58-61).
  - A constante `TIPOS_DE_JOB_DE_IA` está em uso no `subir` e no `ociosa` do fixture (linhas 191 e 390-391).
  - O comentário do `#vivas` explica que ele depende do `isolate` padrão do Vitest (linhas 118-122).
- Rodei `npx vitest run apps/api/test/fila-de-ia-sem-heranca.int.test.ts` duas vezes seguidas, sobre o mesmo banco: 2 de 2 casos verdes nas duas. A limpeza do `afterAll` não esbarra em chave estrangeira.
- Não há `.skip`, nem teste comentado, nem provedor pago: o modelo é o falso, via `startFakeModel`. Nenhum mock esconde a regra.

Bloqueantes: nenhum.

Recomendações:
- `fila-de-ia-sem-heranca.int.test.ts:84`: o `expect(await estadoDa(lote)).toBe('pendente')` pesa pouco sozinho. O job está na fila `lote`, e a execução tem só `{ tarefa: 'classificar_secoes' }`, sem seções. Mesmo sem a correção, talvez o lote não chegasse ao modelo (pela janela de lote ou pela entrada vazia). O que prova a correção é a linha 77, e o comentário poderia dizer isso, para ninguém tomar a linha 84 como a prova.
- O `TODO.md` e o `indice.md` não têm o que testar. Só confiram que o achado registrado no índice aponta para este documento de correção.

Arquivos relevantes:
- apps/api/test/fila-de-ia-sem-heranca.int.test.ts
- apps/api/test/fila-de-ia.fixture.ts
- tasks/correcoes/2026-11-21-tutor-modelo-recebe-pedidos-a-mais.md
