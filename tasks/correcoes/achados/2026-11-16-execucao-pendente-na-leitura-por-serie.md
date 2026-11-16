# Achados das revisões — `tasks/correcoes/2026-11-16-execucao-pendente-na-leitura-por-serie.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## llm-integrator · 1ª rodada · APROVADO · 2026-11-16 03:26:17 · `tasks/correcoes/2026-11-16-execucao-pendente-na-leitura-por-serie.md`

VEREDITO: APROVADO
Perfis usados: nenhum. A correção só altera teste e não adiciona chamada de modelo. O caso conferido não chama o adaptador, porque a execução falha por `MATERIAL_INSUFICIENTE` antes do modelo.
Custo estimado por professor/mês: não se aplica. Nenhuma chamada nova, então não há estimativa a anexar. O custo da correção é de 2,5 s de tempo de teste por caso, nos três casos do laço.
Prompt versionado: não se aplica (nenhum prompt alterado).
Validação de schema: não se aplica.
Aprovação humana no caminho: não se aplica. O caso confere que a execução falha pelo material e não grava nada oficial.
Bloqueantes: nenhum.

O que conferi:
- O diff mexe só em `apps/api/test/leitura-por-serie.int.test.ts`: um import de `testConfig` e uma espera dentro de `reenviandoComAExecucaoPendente` (linhas 369-370). Nenhum arquivo de `src` muda, e nenhum SDK de provedor aparece fora dos adaptadores.
- A causa descrita bate com o código. A bancada do worker usa `TEMPO_DA_CONSULTA_MS = 30_000` (`apps/api/test/fila-de-ia.fixture.ts:71`, usado na linha 126), e esse pool é que executa o `update` preso no `WriteBlockTrigger`. Já `testConfig({}).banco.timeoutConsultaMs` vem do `BANCO_TIMEOUT_CONSULTA_MS` do ambiente de teste, via `loadConfig`.
- O teste usa fila, adaptador falso (`FakeAdapter`) e `FilaDeIa`. Nenhum provedor pago é chamado (regra 7 do meu checklist).
- A espera fica dentro do `try`, antes do `desarmar()` do `finally`, então o gatilho é sempre solto.

Recomendações:
- A prova do vermelho é manual: alguém trocou o `TEMPO_DA_CONSULTA_MS` da bancada por 1_500 e depois restaurou. Nenhum teste protege a bancada de voltar a um corte menor que o da API. Um teste curto que afirme `TEMPO_DA_CONSULTA_MS` maior que `testConfig({}).banco.timeoutConsultaMs` tornaria a folga explícita. Esse valor hoje é constante não exportada.
- A espera de `timeoutConsultaMs + 500` é fixa e depende de o ambiente de teste manter `BANCO_TIMEOUT_CONSULTA_MS` baixo. Se um dia o valor subir muito, o caso fica lento sem avisar. Um comentário ou um teto bastaria.

Arquivos: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/test/leitura-por-serie.int.test.ts`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tasks/correcoes/2026-11-16-execucao-pendente-na-leitura-por-serie.md`.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-16 03:26:19 · `tasks/correcoes/2026-11-16-execucao-pendente-na-leitura-por-serie.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A mudança só altera o teste e não toca schema, DTO, repository nem `src`.
Fora da tabela de dados do docs/lgpd.md: nada.
Autorização por objeto: ok. Nenhuma rota nem query de produção mudou. O ajudante continua consultando `execucao_agente` com `escola_id` e `id`.
Logs: limpos. A mudança não acrescenta `console` nem `logger`, e o arquivo de teste não tem nenhum.
Auditoria: presente. Nenhuma ação que a exija mudou.
Envio externo: nenhum. O caso usa o `FakeAdapter` e a fila da bancada, e confere justamente que o modelo não é chamado.
Seed/fixture: sintético. A fixture usa UUIDs gerados, a professora da fixture de sessão, a turma do 9º ano e o tema "estequiometria". Não há dado real.

Bloqueantes: nenhum.

A mudança está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/test/leitura-por-serie.int.test.ts:17` (import de `testConfig`) e `:369-370` (espera de `timeoutConsultaMs + 500` com o `rodando` preso no gatilho de teste). É uma espera temporizada que reproduz a condição da esteira. Não muda nada em coleta, exposição, log, IA nem ciclo de vida.

Pergunta de fechamento: esta correção não muda nada nela. A resposta continua sendo a mesma do código existente (`arquivo-do-titular`, `pedido-titular`, registros em `ExecucaoAgente`).

Recomendações:
- O `testConfig({})` é montado a cada chamada do ajudante só para ler `banco.timeoutConsultaMs`. Calcular uma vez fora do ajudante deixaria claro que o corte é fixo. É questão de organização e não pesa para a privacidade.
- A tarefa em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tasks/correcoes/2026-11-16-execucao-pendente-na-leitura-por-serie.md` cita só `.env.example` como fonte dos 2 s. Vale citar também onde a API lê `BANCO_TIMEOUT_CONSULTA_MS`, para quem conferir depois.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-16 03:26:25 · `tasks/correcoes/2026-11-16-execucao-pendente-na-leitura-por-serie.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta correção. A mudança está só em `apps/api/test/leitura-por-serie.int.test.ts` e no documento da correção. Nenhum arquivo de `apps/*/src` nem de `packages/*/src` mudou, e o teste não grava `Nota`. Todos com autor humano: sim, porque a correção não criou nem alterou nenhum caminho de escrita.

Decisão autônoma sobre aluno: ausente

Aprovação registrada: ok. A correção não toca entrega, artefato nem aprovação. Os casos mexidos são `atividade_objetiva`, `plano_de_aula` e `chat`. Neles, a execução que o reenvio retoma falha pelo material que saiu, sem chamar o modelo e sem gravar consumo. Nenhuma saída de IA nasce, e nada chega ao aluno sem aprovação.

Supervisão do tutor: ok. O caso do Tutor com a execução pendente (linha 485) não mudou, e o ajudante alterado só é usado no laço das três ferramentas da professora.

Autonomia declarada e visível: sim. A correção não mexe em governança nem em nível de agente.

Bloqueantes: nenhum.

O que a correção faz, em `apps/api/test/leitura-por-serie.int.test.ts`:
- Linha 17: importa `testConfig`.
- Linhas 369-370: o ajudante `reenviandoComAExecucaoPendente` passa a esperar `testConfig({}).banco.timeoutConsultaMs + 500` antes de soltar o gatilho. Isso deixa a execução parada em `rodando` por mais tempo que o corte de consulta da API.

Não há `.skip`, nenhuma asserção ficou mais fraca e nenhum timeout de produção subiu. O caso continua exigindo `falhou` com o erro de material, o modelo não chamado e nenhum consumo. A prova do vermelho está no documento: com o pool da bancada (`apps/api/test/fila-de-ia.fixture.ts:71`) no corte da API, os três casos caem no sintoma da esteira.

Não há conflito com os itens 7, 8 e 9 da regra 70: nada mede o aluno nem o professor, e nenhuma tela ou prompt muda.

Recomendações:
- O comentário da linha 369 diz "falhar pelo material do mesmo jeito", mas não diz que a folga vem do pool do worker (30 s). Citar `fila-de-ia.fixture.ts` ali evita que alguém, mais tarde, encurte o corte da bancada sem perceber que é esse corte que o caso põe à prova.
- Os 2,5 s a mais em cada um dos três casos estão declarados no documento. Vale olhar na retro se o mesmo efeito sai com um corte de bancada menor e explícito.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/test/leitura-por-serie.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tasks/correcoes/2026-11-16-execucao-pendente-na-leitura-por-serie.md

## revisor-geral · 1ª rodada · APROVADO · 2026-11-16 03:26:38 · `tasks/correcoes/2026-11-16-execucao-pendente-na-leitura-por-serie.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. A correção muda só um teste: nenhum arquivo de `apps/*/src` ou `packages/*/src` foi alterado e a arquitetura definida não muda.
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum

Recomendações:
1. O documento diz que o ajudante afeta "os três casos do laço" e que o custo é "2,5 s a mais em cada um dos três casos". Isso está errado: o caso do Tutor (`apps/api/test/leitura-por-serie.int.test.ts:485`) também chama `reenviandoComAExecucaoPendente`. São quatro casos e cerca de 10 s a mais. Corrija as seções "Teste que reproduz" e "Correção" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tasks/correcoes/2026-11-16-execucao-pendente-na-leitura-por-serie.md`.
2. O documento diz que a 5.0 executa o `update` "com 30 s" e que o caso passa a "exigir a folga que o worker tem". Os 30 s são da bancada de teste (`apps/api/test/fila-de-ia.fixture.ts:71`). O worker de produção usa o mesmo `BANCO_TIMEOUT_CONSULTA_MS` de 2 s da API (`.env.example:163-164`). Em produção não há trava, porque o `rodando` só fica preso pelo gatilho que existe apenas no banco de teste. O que o caso exige de fato é que a execução não volte para o pool da API. Reescreva assim para não dar a impressão de que o worker de produção tem 30 s de folga.
3. Em `apps/api/test/leitura-por-serie.int.test.ts:370`, a espera usa `testConfig({}).banco.timeoutConsultaMs` como referência para o corte da API. Isso só vale enquanto o `api` desta suíte for montado sem sobrepor `banco.timeoutConsultaMs`. Vale extrair o valor numa constante com nome (por exemplo, `ALEM_DO_CORTE_DA_API_MS`) declarada perto do ajudante, para que a dependência fique visível.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-16 03:26:39 · `tasks/correcoes/2026-11-16-execucao-pendente-na-leitura-por-serie.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum. A mudança é só de teste, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/test/leitura-por-serie.int.test.ts`. A fila de IA aparece nela apenas pela bancada de teste.
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida. O reenvio com a mesma `chaveEnvio` e a execução pendente continua coberto pelos três casos do laço.
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- O documento da correção (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tasks/correcoes/2026-11-16-execucao-pendente-na-leitura-por-serie.md`, seções "Causa" e "Correção") diz que "a 5.0 já corrigiu o pool da execução" e que o caso passa a exigir "a folga que o worker tem". Isso só vale para a bancada. O worker de produção usa o mesmo `BANCO_TIMEOUT_CONSULTA_MS` de 2 s da API: o `.env.example` registra que o statement_timeout dos workers da fila é o da API, e o pool é montado em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/packages/core/src/db/pool.ts:186`. Os 30 s existem só em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/test/fila-de-ia.fixture.ts:71`. Vale ajustar o texto para dizer que o teste prende o `rodando` além do corte da API e depende do pool folgado da bancada, e que esse pool não é o de produção. Assim ninguém lê o teste como prova de que a produção aguenta uma espera longa nessa transição.
- O caso em que a passagem a `rodando` é cortada pelo statement_timeout (2 s) no worker de produção não tem teste. Pela D49 (entrega ao menos uma vez), o job deveria ser tentado de novo, retomar a execução `pendente` e terminar `falhou` pelo material, sem ficar `pendente` para sempre. Um caso com a bancada no corte de produção, provando essa retomada, cobriria o comportamento real. Hoje a "prova do vermelho" da correção mostra justamente o oposto: a execução fica `pendente`.
- A espera fixa custa 2,5 s em cada um dos três casos, 7,5 s ao todo. Não bloqueia. Se a integração apertar o prazo da esteira, dá para trocar a espera fixa por um corte menor configurado só para esse caso.

Não rodei o teste: o veredito se apoia na leitura do diff e no vermelho e verde descritos no arquivo da correção.

## test-engineer · 1ª rodada · APROVADO · 2026-11-16 03:27:53 · `tasks/correcoes/2026-11-16-execucao-pendente-na-leitura-por-serie.md`

VEREDITO: APROVADO

**Cenários exigidos**
- Caminho feliz: quando o material sai do alcance e a professora reenvia com a mesma `chaveEnvio`, a resposta traz o mesmo `execucaoId`. A execução retomada confere o material de novo e termina `falhou` com o código do material. O modelo não é chamado, nenhum `consumo_ia` é gravado e só existe uma linha de `execucao_agente` para aquela chave.
- Caso de borda 1, o da esteira: a transição `pendente → rodando` fica presa por mais tempo que o corte de consulta da API (`BANCO_TIMEOUT_CONSULTA_MS=2000`), e a execução precisa falhar pelo material do mesmo jeito, sem ficar `pendente`.
- Caso de borda 2: o material sai do alcance por motivos diferentes. Nas ferramentas e no chat ele é tirado da série; no Tutor, a licença vence.
- Permissão: uma chave aceita para um pedido não libera a conferência de outro pedido, nem a de outra professora da mesma escola.
- Isolamento: a leitura da execução é filtrada por `escola_id`. Esta correção não toca em repository nem em escopo.

**Cobertos**
- O caso de borda 1 agora é determinístico. O ajudante `reenviandoComAExecucaoPendente` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/test/leitura-por-serie.int.test.ts:370`) segura a transição por `testConfig({}).banco.timeoutConsultaMs + 500`, em vez de depender de o runner ser rápido. Se a execução voltar a rodar num pool com o corte da API, os casos ficam vermelhos pelo motivo certo, com o sintoma da esteira: `pendente` com `erro` vazio. É o vermelho descrito no documento.
- As asserções conferem o resultado no banco (estado, erro, consumo e contagem de linhas), não só o status da resposta.
- Rodei `npx vitest run apps/api/test/leitura-por-serie.int.test.ts -t "execução ainda pendente"`: 4 passaram, 33 ficaram de fora pelo filtro, em 17 s.
- Não há `.skip`, teste comentado nem mock da regra. O modelo é o `FakeAdapter`, só espiado, e nenhum provedor pago é chamado.
- O prazo do caso (`testTimeout` de 60 s, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/vitest.config.ts:29`) comporta os 2,5 s a mais com folga.
- A linha "Sem mutação" está correta: o diff só altera teste, nada em `apps/*/src` nem em `packages/*/src`.

**Bloqueantes:** nenhum.

**Recomendações**
1. O documento conta errado os casos afetados. As linhas 35 e 47 de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tasks/correcoes/2026-11-16-execucao-pendente-na-leitura-por-serie.md` falam em "os três casos do laço" e "2,5 s a mais em cada um dos três casos". Mas o caso do Tutor (`leitura-por-serie.int.test.ts:491`) usa o mesmo ajudante, então são quatro casos e 10 s no total. O vermelho descrito também não menciona o caso do Tutor.
2. A frase sobre a folga do worker induz a erro. A linha 46 diz que o caso passa a "exigir a folga que o worker tem". Essa folga de 30 s é da bancada de teste (`TEMPO_DA_CONSULTA_MS`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/test/fila-de-ia.fixture.ts:71`). O worker de IA em produção usa o mesmo corte de 2 s da API (`.env.example:164`). Na prática, o caso protege o valor da bancada contra quem um dia o reduza para o corte da API. O texto deveria dizer isso.
3. Fica uma pergunta de produto para registrar na retro ou na 6.0, não nesta correção. O vermelho com o pool em 1,5 s mostra o que acontece quando a passagem a `rodando` é cortada pelo limite de consulta. O `marcarRodando` lança a exceção fora do `try` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/src/ia/execucao.processor.ts:75`) e a execução fica `pendente` com `erro` vazio. Em produção, uma trava de linha concorrente pode causar esse corte. Falta saber se a nova tentativa do job no BullMQ resolve, ou se o pedido fica parado até a varredura (`execucao.repository.ts:108`). Hoje nenhum teste prova a resposta.
4. Detalhe: dar nome ao valor da espera (algo como `ALEM_DO_CORTE_DA_API_MS`) deixaria o motivo legível sem o comentário longo.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-16 03:36:40 · `tasks/correcoes/2026-11-16-execucao-pendente-na-leitura-por-serie.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. A correção mexe só no teste e não altera o desenho da 5.0, que já tira a execução do pool da API.
Portão local: carimbo válido. O `conferir` passou para o código atual, com typecheck, lint, segredo, dependências, unidade e alvo.
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/test/leitura-por-serie.int.test.ts:353-357`: o comentário de `ALEM_DO_CORTE_DA_API_MS` repete o que o documento da correção já diz. Pode ficar em duas linhas: de onde vem o valor e qual folga da bancada o caso põe à prova. O resto, a diferença para a produção, já está no documento e na linha do `TODO.md`.
- Para registro, sem pedir mudança: o próprio documento admite que o vermelho medido cobre só os três casos do laço, e que o do Tutor herda a prova por usar o mesmo ajudante. Para uma correção só de teste, basta.

Conferi as três recomendações da 1ª rodada no diff e as três foram aplicadas:
- O documento conta quatro casos e cerca de 10 s; o caso do Tutor, na linha 498, de fato usa o ajudante.
- O documento diz que a folga de 30 s é só da bancada e que o worker de produção corta em 2 s.
- A constante `ALEM_DO_CORTE_DA_API_MS` é calculada uma vez e usada na linha 377.

As referências que o documento cita batem com o código: `packages/core/src/db/database.ts:61` e `:74`, `.env.example:46` com `BANCO_TIMEOUT_CONSULTA_MS=2000`, e `fila-de-ia.fixture.ts:71` com `TEMPO_DA_CONSULTA_MS = 30_000`.

As duas linhas novas do `TODO.md` têm dono e destino: o teste da folga da bancada, e o `marcarRodando` cortado em produção, que vai para a retro e para a 6.0. A recusa da troca da espera fixa vem com motivo no documento.

## test-engineer · 2ª rodada · APROVADO · 2026-11-16 03:36:45 · `tasks/correcoes/2026-11-16-execucao-pendente-na-leitura-por-serie.md`

VEREDITO: APROVADO

**Cenários exigidos:** quatro casos de reenvio com a mesma chave enquanto a execução ainda está `pendente` e o material já saiu: as três ferramentas do laço e o Tutor. Em todos, o `rodando` fica preso além do corte de consulta da API. Cada caso tem de devolver o mesmo id, e a execução tem de falhar pelo material, sem chamar o modelo; no Tutor, também sem resposta e sem consumo. Vermelho com o pool da bancada no corte da API, verde com os 30 s.

**Cobertos:** os quatro passam pelo ajudante `reenviandoComAExecucaoPendente`. Conferi o uso em `apps/api/test/leitura-por-serie.int.test.ts:480` (laço) e `:498` (Tutor). Nesta rodada só mudou a forma da espera: a expressão `testConfig({}).banco.timeoutConsultaMs + 500` foi para a constante `ALEM_DO_CORTE_DA_API_MS`, calculada uma vez (`:358`) e usada no mesmo `setTimeout` (`:377`). O comportamento é idêntico, e a asserção sobre o estado `falhou` ficou como estava. O arquivo não tem `.skip` nem `.only`.

As três recomendações da 1ª rodada foram aplicadas:
- **Quatro casos e cerca de 10 s:** o documento agora conta os quatro e diz que o vermelho medido foi o dos três do laço. É verdade, e o Tutor usa o mesmo ajudante e a mesma espera.
- **Folga só da bancada:** o documento e o comentário da constante deixam claro que os 30 s são só da bancada de teste e que o worker de produção tem o corte de 2 s.
- **Constante única:** o ajudante usa `ALEM_DO_CORTE_DA_API_MS`.

As referências novas do documento conferem: `packages/core/src/db/database.ts:61` e `:74` (`BANCO_TIMEOUT_CONSULTA_MS` vai para `timeoutConsultaMs`) e `apps/api/test/fila-de-ia.fixture.ts:126` (o pool da bancada com `TEMPO_DA_CONSULTA_MS`). As duas linhas novas do `TODO.md` levam as recomendações sem aplicar com dono e motivo. A de produção, o `marcarRodando` cortado pelos 2 s no worker real, ficou registrada fora do escopo de uma correção só de teste, e é o destino certo.

**Não consegui rodar o teste.** `npx vitest run test/leitura-por-serie.int.test.ts` falhou antes de carregar a suíte, com `Failed to resolve entry for package "@educa/core"`: o pacote não está compilado nesta worktree. Não compilei, porque isso escreveria arquivos na árvore que os outros revisores leem ao mesmo tempo. O veredito se apoia em a mudança ser só a extração da mesma expressão para uma constante, além da execução verde e do vermelho registrados na rodada anterior.

**Bloqueantes:** nenhum.

**Recomendações:**
- O vermelho do caso do Tutor foi deduzido de ele usar o mesmo ajudante, não medido. O documento diz isso abertamente, então basta registrar para a validação.
- A validação deve rodar o teste com `@educa/core` compilado antes do commit, já que esta rodada não conseguiu executá-lo.
